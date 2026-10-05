// A small Doom-style software renderer for Shift 1.
//
// 29.09: Сергей — "он это всё ещё не как дум выглядит". The old view painted
// walls with canvas gradients and props with vector shapes. This renders the
// way Doom did: into a low-resolution frame buffer, one ray per column,
// textured walls, per-pixel textured floors and ceilings, light that falls off
// with distance, and billboard sprites clipped by a depth buffer.
//
// The world is a grid of cells, each with its own floor and ceiling height
// (a cut-down version of Doom's sectors): a crate stack is a cell whose floor
// is 1.6 m up, the belt is a cell at 0.88 m, a girder is a cell whose ceiling
// comes down to 3.4 m, a door is a cell whose ceiling rises. Walking a ray
// front-to-back through those cells and keeping a per-column open window
// [top, bottom) is enough to draw steps, lintels and doors without overdraw.
//
// Units: metres. Camera yaw 0 looks toward -z; +x is to the right.

export const NEAR = 0.05;
const MAX_STEPS = 96;

// ABGR packing for ImageData on little-endian machines.
export const rgb = (r, g, b) => (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;

export function createCell(props = {}) {
  return {
    solid: false, floor: 0, ceil: 4, wall: null, upper: null, ftex: null, ctex: null,
    scroll: null, peg: 'floor', dark: false, bright: false, ...props,
  };
}

export function cellAt(map, x, z) {
  const cx = Math.floor(x), cz = Math.floor(z);
  if (cx < 0 || cz < 0 || cx >= map.w || cz >= map.h) return null;
  return map.cells[cz * map.w + cx];
}

// Static lighting, baked once: a grid at `res` samples per metre, lamps with
// quadratic falloff, and cells flagged `dark` (beyond the walls) kept dim.
export function bakeLightmap(map, lamps, { res = 4, ambient = [0.2, 0.21, 0.24] } = {}) {
  const w = map.w * res, h = map.h * res;
  const data = new Float32Array(w * h * 3);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const x = (i + 0.5) / res, z = (j + 0.5) / res;
    const cell = cellAt(map, x, z);
    let r = ambient[0], g = ambient[1], b = ambient[2];
    if (cell && !cell.dark) {
      for (const L of lamps) {
        const d = Math.hypot(x - L.x, z - L.z);
        if (d >= L.radius) continue;
        const k = (1 - d / L.radius) ** 2 * L.intensity;
        r += k * L.color[0]; g += k * L.color[1]; b += k * L.color[2];
      }
    } else if (cell?.dark) { r *= 0.35; g *= 0.35; b *= 0.4; }
    const o = (j * w + i) * 3;
    data[o] = r; data[o + 1] = g; data[o + 2] = b;
  }
  return { res, w, h, data };
}

export function createRenderer(width, height) {
  const buf = new Uint32Array(width * height);
  const depth = new Float32Array(width * height);
  // 17.3: per column, the ray distance at which it bounced off a mirror (0 = none).
  const mirrorT = new Float32Array(width);
  const light = [0, 0, 0];

  function render(scene) {
    const { map, cam, lightmap, dynLights = [], sprites = [], time = 0, fov = 80 } = scene;
    const F = (width / 2) / Math.tan((fov * Math.PI / 180) / 2);
    const vh = scene.viewH || height;
    const horizon = vh / 2 + (cam.bob || 0) + (cam.pitch || 0);
    const eye = cam.eye;
    const sin = Math.sin(cam.yaw), cos = Math.cos(cam.yaw);
    const fogK = scene.fog ?? 0.07;
    // 17.3 engine eras (engine-eras.js). Defaults keep the 16.5 Doom look:
    // bands -- light steps (0 = smooth, Quake on); flatLight -- one light
    // level for everything, no lightmap (Wolfenstein); flatFloor/flatCeil --
    // untextured flats; smoothLight -- bilinear lightmap; mirrors -- rays
    // bounce off cells flagged `mirror` (Build engine trick).
    const bands = scene.bands ?? 24;
    const flatLight = scene.flatLight ?? 0;
    const flatFloor = scene.flatFloor ?? 0, flatCeil = scene.flatCeil ?? 0;
    const smoothLight = Boolean(scene.smoothLight);
    const mirrors = Boolean(scene.mirrors);
    // 17.4 liquids (engine-ladder.js): floors flagged `liquid` ripple.
    const liquids = Boolean(scene.liquids);
    let mirrorPlane = null;
    buf.fill(0xff000000);
    depth.fill(1e9);
    mirrorT.fill(0);

    // Light at a world point, written into `light` (no allocation per pixel).
    const lmW = lightmap.w, lmH = lightmap.h, lmRes = lightmap.res, lm = lightmap.data;
    const nDyn = dynLights.length;
    function sampleLight(wx, wz, dist, faceK) {
      if (flatLight) { light[0] = light[1] = light[2] = flatLight * faceK; return; }
      let r, g, b;
      if (smoothLight) {
        let fx = wx * lmRes - 0.5, fz = wz * lmRes - 0.5;
        if (fx < 0) fx = 0; else if (fx > lmW - 1.001) fx = lmW - 1.001;
        if (fz < 0) fz = 0; else if (fz > lmH - 1.001) fz = lmH - 1.001;
        const i0 = fx | 0, j0 = fz | 0, ax = fx - i0, az = fz - j0;
        const o00 = (j0 * lmW + i0) * 3, o10 = o00 + 3, o01 = o00 + lmW * 3, o11 = o01 + 3;
        const w00 = (1 - ax) * (1 - az), w10 = ax * (1 - az), w01 = (1 - ax) * az, w11 = ax * az;
        r = lm[o00] * w00 + lm[o10] * w10 + lm[o01] * w01 + lm[o11] * w11;
        g = lm[o00 + 1] * w00 + lm[o10 + 1] * w10 + lm[o01 + 1] * w01 + lm[o11 + 1] * w11;
        b = lm[o00 + 2] * w00 + lm[o10 + 2] * w10 + lm[o01 + 2] * w01 + lm[o11 + 2] * w11;
      } else {
        let i = (wx * lmRes) | 0, j = (wz * lmRes) | 0;
        if (i < 0) i = 0; else if (i >= lmW) i = lmW - 1;
        if (j < 0) j = 0; else if (j >= lmH) j = lmH - 1;
        const o = (j * lmW + i) * 3;
        r = lm[o]; g = lm[o + 1]; b = lm[o + 2];
      }
      for (let n = 0; n < nDyn; n++) {
        const L = dynLights[n];
        const dx = wx - L.x, dz = wz - L.z;
        const d2 = dx * dx + dz * dz;
        if (d2 >= L.r2) continue;
        const k = (1 - Math.sqrt(d2) / L.radius) ** 2 * L.intensity;
        r += k * L.color[0]; g += k * L.color[1]; b += k * L.color[2];
      }
      // Doom's "diminished lighting": things get darker with distance, in bands.
      const fog = faceK / (1 + dist * fogK);
      if (bands > 0) {
        light[0] = Math.floor(Math.min(1.6, r * fog) * bands) / bands;
        light[1] = Math.floor(Math.min(1.6, g * fog) * bands) / bands;
        light[2] = Math.floor(Math.min(1.6, b * fog) * bands) / bands;
      } else {
        light[0] = Math.min(1.8, r * fog); light[1] = Math.min(1.8, g * fog); light[2] = Math.min(1.8, b * fog);
      }
    }
    function shade(c) {
      let r = (c & 255) * light[0], g = ((c >>> 8) & 255) * light[1], b = ((c >>> 16) & 255) * light[2];
      if (r > 255) r = 255; if (g > 255) g = 255; if (b > 255) b = 255;
      return (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
    }

    const cells = map.cells, mw = map.w, mh = map.h;
    const tex = map.textures;

    for (let sx = 0; sx < width; sx++) {
      const k = (sx + 0.5 - width / 2) / F;
      let dirX = sin + k * cos;
      let dirZ = -cos + k * sin;
      // Ray origin: the camera, or its mirror image after a bounce.
      let ox = cam.x, oz = cam.z;
      let mapX = Math.floor(cam.x), mapZ = Math.floor(cam.z);
      const deltaX = dirX === 0 ? 1e30 : Math.abs(1 / dirX);
      const deltaZ = dirZ === 0 ? 1e30 : Math.abs(1 / dirZ);
      let stepX = dirX < 0 ? -1 : 1, stepZ = dirZ < 0 ? -1 : 1;
      let sideX = dirX < 0 ? (cam.x - mapX) * deltaX : (mapX + 1 - cam.x) * deltaX;
      let sideZ = dirZ < 0 ? (cam.z - mapZ) * deltaZ : (mapZ + 1 - cam.z) * deltaZ;
      let t0 = 0;
      let top = 0, bot = vh;

      for (let step = 0; step < MAX_STEPS && top < bot; step++) {
        const cur = cells[mapZ * mw + mapX];
        let t1, nx = mapX, nz = mapZ, side;
        if (sideX < sideZ) { t1 = sideX; sideX += deltaX; nx += stepX; side = 0; }
        else { t1 = sideZ; sideZ += deltaZ; nz += stepZ; side = 1; }

        // Floor of the current cell between t0 and t1.
        const fh = cur.floor;
        if (fh < eye) {
          const yFar = horizon + (eye - fh) * F / t1;
          const yNear = t0 > NEAR ? horizon + (eye - fh) * F / t0 : 1e9;
          let r0 = Math.ceil(yFar - 0.5); if (r0 < top) r0 = top;
          let r1 = Math.ceil(yNear - 0.5); if (r1 > bot) r1 = bot;
          const ft = tex[cur.ftex];
          if (ft && r0 < r1) {
            const sc = cur.scroll;
            const offX = sc ? sc[0] * time : 0, offZ = sc ? sc[1] * time : 0;
            const ppm = ft.ppm, tw = ft.w, th = ft.h, td = ft.data;
            const liq = liquids && cur.liquid;
            for (let r = r0; r < r1; r++) {
              const d = (eye - fh) * F / (r + 0.5 - horizon);
              const wx = ox + dirX * d, wz = oz + dirZ * d;
              let fx = wx - offX, fz = wz - offZ;
              if (liq) { const a = fx; fx += Math.sin(fz * 3.1 + time * 2.2) * 0.06; fz += Math.cos(a * 2.7 + time * 1.8) * 0.06; }
              let u = Math.floor(fx * ppm) % tw; if (u < 0) u += tw;
              let v = Math.floor(fz * ppm) % th; if (v < 0) v += th;
              const idx = r * width + sx;
              const texel = flatFloor || td[v * tw + u];
              if (cur.bright) { light[0] = light[1] = light[2] = 1; buf[idx] = texel; }
              else { sampleLight(wx, wz, d, 1); buf[idx] = shade(texel); }
              depth[idx] = d;
            }
          }
          if (r0 < bot) bot = Math.max(top, r0);
        }
        // Ceiling of the current cell.
        const ch = cur.ceil;
        if (ch > eye && top < bot) {
          const yFar = horizon - (ch - eye) * F / t1;
          const yNear = t0 > NEAR ? horizon - (ch - eye) * F / t0 : -1e9;
          let r0 = Math.ceil(yNear - 0.5); if (r0 < top) r0 = top;
          let r1 = Math.ceil(yFar - 0.5); if (r1 > bot) r1 = bot;
          const ct = tex[cur.ctex];
          if (ct && r0 < r1) {
            const ppm = ct.ppm, tw = ct.w, th = ct.h, td = ct.data;
            for (let r = r0; r < r1; r++) {
              const d = (ch - eye) * F / (horizon - (r + 0.5));
              const wx = ox + dirX * d, wz = oz + dirZ * d;
              let u = Math.floor(wx * ppm) % tw; if (u < 0) u += tw;
              let v = Math.floor(wz * ppm) % th; if (v < 0) v += th;
              const idx = r * width + sx;
              sampleLight(wx, wz, d, 0.9);
              buf[idx] = shade(flatCeil || td[v * tw + u]);
              depth[idx] = d;
            }
          }
          if (r1 > top) top = Math.min(bot, Math.max(top, r1));
        }
        if (top >= bot) break;

        // Crossing into the next cell.
        const out = nx < 0 || nz < 0 || nx >= mw || nz >= mh;
        const next = out ? null : cells[nz * mw + nx];
        const wx = ox + dirX * t1, wz = oz + dirZ * t1;
        // A mirror: the ray turns round at the glass and goes on from the
        // camera's mirror image (one bounce per column).
        if (mirrors && next && next.mirror && !mirrorT[sx]) {
          if (side === 0) { const m = stepX > 0 ? mapX + 1 : mapX; ox = 2 * m - ox; dirX = -dirX; stepX = -stepX; mirrorPlane ??= { axis: 'x', at: m }; }
          else { const m = stepZ > 0 ? mapZ + 1 : mapZ; oz = 2 * m - oz; dirZ = -dirZ; stepZ = -stepZ; mirrorPlane ??= { axis: 'z', at: m }; }
          mirrorT[sx] = t1; t0 = t1;
          continue;
        }
        const u = side === 0 ? (stepX > 0 ? wz : -wz) : (stepZ > 0 ? -wx : wx);
        // Light is sampled just in front of the face, on the open side.
        const lx = wx - dirX * 0.02, lz = wz - dirZ * 0.02;
        const faceK = side === 0 ? 1 : 0.82;

        const span = (hLo, hHi, t, anchor, texName) => {
          const T = tex[texName];
          const yHi = horizon - (hHi - eye) * F / t1;
          const yLo = horizon - (hLo - eye) * F / t1;
          let r0 = Math.ceil(yHi - 0.5); if (r0 < top) r0 = top;
          let r1 = Math.ceil(yLo - 0.5); if (r1 > bot) r1 = bot;
          if (r0 >= r1) return [Math.ceil(yHi - 0.5), Math.ceil(yLo - 0.5)];
          if (!T) {
            for (let r = r0; r < r1; r++) { buf[r * width + sx] = 0xff000000; depth[r * width + sx] = t1; }
            return [Math.ceil(yHi - 0.5), Math.ceil(yLo - 0.5)];
          }
          const tw = T.w, th = T.h, td = T.data;
          let tu = Math.floor(u * T.ppmx) % tw; if (tu < 0) tu += tw;
          const bright = t && t.bright;
          if (bright) { light[0] = light[1] = light[2] = 1; } else sampleLight(lx, lz, t1, faceK);
          for (let r = r0; r < r1; r++) {
            const h = eye - (r + 0.5 - horizon) * t1 / F;
            let v = Math.floor((h - anchor) * T.ppmy) % th; if (v < 0) v += th;
            const c = td[(th - 1 - v) * tw + tu];
            const idx = r * width + sx;
            buf[idx] = shade(c);
            depth[idx] = t1;
          }
          return [Math.ceil(yHi - 0.5), Math.ceil(yLo - 0.5)];
        };

        // 17.3: a cell can wear a different texture per face (car front,
        // fridge door, TV screen): faces.n is the side you see walking +z.
        const fx = next && next.faces;
        const faceWall = fx ? ((side === 0 ? (stepX > 0 ? fx.w : fx.e) : (stepZ > 0 ? fx.n : fx.s)) || next.wall) : next?.wall;
        if (!next || next.solid) {
          const texName = next ? faceWall : null;
          const T = tex[texName];
          const anchor = next && next.peg === 'top' && T ? cur.ceil - T.h / T.ppmy : 0;
          span(cur.floor, cur.ceil, next, anchor, texName);
          break;
        }
        if (next.floor > cur.floor) {
          const T = tex[faceWall];
          const anchor = next.peg === 'top' && T ? next.floor - T.h / T.ppmy : 0;
          const [yTopEdge] = span(cur.floor, next.floor, next, anchor, faceWall);
          if (yTopEdge < bot) bot = Math.max(top, yTopEdge);
        }
        if (next.ceil < cur.ceil) {
          const [, yBotEdge] = span(Math.max(next.ceil, cur.floor), cur.ceil, null, next.ceil, next.upper);
          if (yBotEdge > top) top = Math.min(bot, yBotEdge);
        }
        mapX = nx; mapZ = nz; t0 = t1;
      }
    }

    // Sprites: billboards, depth-tested per pixel against everything above.
    const view = [];
    for (const s of sprites) {
      if (s.mirrorOnly) continue;
      const rx = s.x - cam.x, rz = s.z - cam.z;
      const dz = rx * sin - rz * cos;
      if (dz < 0.2) continue;
      view.push({ s, dz, dx: rx * cos + rz * sin, mirrored: false });
    }
    // Reflections: every sprite again, at its mirror image, only through glass.
    if (mirrorPlane) {
      const { axis, at } = mirrorPlane;
      for (const s of sprites) {
        const mx = axis === 'x' ? 2 * at - s.x : s.x, mz = axis === 'z' ? 2 * at - s.z : s.z;
        const rx = mx - cam.x, rz = mz - cam.z;
        const dz = rx * sin - rz * cos;
        if (dz < 0.2) continue;
        view.push({ s: { ...s, x: mx, z: mz, flip: !s.flip, img: s.mirrorImg || s.img }, dz, dx: rx * cos + rz * sin, mirrored: true });
      }
    }
    view.sort((a, b) => b.dz - a.dz);
    for (const { s, dz, dx, mirrored } of view) {
      const img = s.img;
      if (!img || !img.data) continue;
      const ppm = s.ppm || img.ppm || 40;
      const wM = img.w / ppm * (s.scale || 1), hM = img.h / ppm * (s.scale || 1);
      const pxW = wM * F / dz, pxH = hM * F / dz;
      const x0 = width / 2 + dx / dz * F - pxW / 2 + (s.shiftPx || 0);
      const y0 = horizon - ((s.y || 0) + hM - eye) * F / dz;
      let c0 = Math.ceil(x0 - 0.5), c1 = Math.ceil(x0 + pxW - 0.5);
      let r0 = Math.ceil(y0 - 0.5), r1 = Math.ceil(y0 + pxH - 0.5);
      if (c0 < 0) c0 = 0; if (c1 > width) c1 = width;
      if (r0 < 0) r0 = 0; if (r1 > vh) r1 = vh;
      if (c0 >= c1 || r0 >= r1) continue;
      if (s.fullbright) { light[0] = light[1] = light[2] = s.glow || 1; }
      else sampleLight(s.x, s.z, dz, 1);
      const iw = img.w, ih = img.h, id = img.data;
      for (let c = c0; c < c1; c++) {
        const mt = mirrorT[c];
        if (mirrored ? (!mt || dz <= mt) : (mt && dz > mt)) continue;
        let u = Math.floor((c + 0.5 - x0) / pxW * iw);
        if (u < 0) u = 0; else if (u >= iw) u = iw - 1;
        if (s.flip) u = iw - 1 - u;
        for (let r = r0; r < r1; r++) {
          const idx = r * width + c;
          if (dz >= depth[idx]) continue;
          let v = Math.floor((r + 0.5 - y0) / pxH * ih);
          if (v < 0) v = 0; else if (v >= ih) v = ih - 1;
          const px = id[v * iw + u];
          if ((px >>> 24) < 128) continue;
          buf[idx] = shade(px);
          depth[idx] = dz;
        }
      }
    }

    // Additive sparks and glints: tiny, fullbright, still depth-tested.
    for (const p of scene.particles || []) {
      const rx = p.x - cam.x, rz = p.z - cam.z;
      const dz = rx * sin - rz * cos;
      if (dz < 0.2) continue;
      const dx = rx * cos + rz * sin;
      const c = Math.round(width / 2 + dx / dz * F - 0.5);
      const r = Math.round(horizon - (p.y - eye) * F / dz - 0.5);
      const size = Math.max(1, Math.round((p.size || 0.03) * F / dz));
      for (let yy = 0; yy < size; yy++) for (let xx = 0; xx < size; xx++) {
        const cc = c + xx, rr = r + yy;
        if (cc < 0 || rr < 0 || cc >= width || rr >= vh) continue;
        const idx = rr * width + cc;
        if (dz >= depth[idx] || (mirrorT[cc] && dz > mirrorT[cc])) continue;
        buf[idx] = p.color;
      }
    }
    return { buf, depth, F, horizon, mirrorT, mirrorPlane };
  }

  // Straight blit of an atlas image into the frame (HUD, weapon, status bar).
  function blit(img, x, y, { scale = 1, flip = false, tint = null, clipBottom = height } = {}) {
    if (!img || !img.data) return;
    const w = Math.round(img.w * scale), h = Math.round(img.h * scale);
    for (let j = 0; j < h; j++) {
      const py = Math.round(y) + j;
      if (py < 0 || py >= clipBottom) continue;
      const v = Math.min(img.h - 1, Math.floor(j / scale));
      for (let i = 0; i < w; i++) {
        const px = Math.round(x) + i;
        if (px < 0 || px >= width) continue;
        let u = Math.min(img.w - 1, Math.floor(i / scale));
        if (flip) u = img.w - 1 - u;
        let c = img.data[v * img.w + u];
        if ((c >>> 24) < 128) continue;
        if (tint) {
          const r = Math.min(255, (c & 255) * tint[0]), g = Math.min(255, ((c >>> 8) & 255) * tint[1]), b = Math.min(255, ((c >>> 16) & 255) * tint[2]);
          c = (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
        }
        buf[py * width + px] = c;
      }
    }
  }

  return { width, height, buf, depth, mirrorT, render, blit };
}
