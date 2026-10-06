// 17.4 · A software triangle rasterizer: the Quake tier without a GPU.
//
// Each triangle is transformed by a 4x4 matrix into clip space, clipped
// against the near plane, projected, and filled pixel by pixel with edge
// functions. Texture coordinates are interpolated perspective-correctly
// (u/w, v/w and 1/w are linear on screen; u = (u/w) / (1/w)). With the
// z-buffer on, a pixel is written only if it is nearer than what is already
// there -- "глубина = [inf] * (w * h)" -- so the order of drawing stops
// mattering. With it off, the caller sorts back to front (painter's
// algorithm). Used as the fallback when WebGL2 is missing, and by
// tools/soft-raster.test.mjs to prove the depth test.
import { STRIDE, OFF, MAT } from './mesh-builder.js';

const NEAR_W = 0.05;

export function createSoftRaster(width, height) {
  const color = new Uint32Array(width * height);
  const depth = new Float32Array(width * height);
  const stats = { tris: 0, pixels: 0, rejected: 0 };

  function clear(c = 0xff000000) { color.fill(c); depth.fill(Infinity); stats.tris = 0; stats.pixels = 0; stats.rejected = 0; }

  function sample(tex, u, v, bilinear) {
    const tw = tex.w, th = tex.h, td = tex.data;
    if (!bilinear) {
      let x = Math.floor(u * tw) % tw; if (x < 0) x += tw;
      let y = Math.floor(v * th) % th; if (y < 0) y += th;
      return td[y * tw + x];
    }
    const fx = u * tw - 0.5, fy = v * th - 0.5;
    const x0 = Math.floor(fx), y0 = Math.floor(fy), ax = fx - x0, ay = fy - y0;
    const X0 = ((x0 % tw) + tw) % tw, X1 = (X0 + 1) % tw, Y0 = ((y0 % th) + th) % th, Y1 = (Y0 + 1) % th;
    const c00 = td[Y0 * tw + X0], c10 = td[Y0 * tw + X1], c01 = td[Y1 * tw + X0], c11 = td[Y1 * tw + X1];
    let out = 0;
    for (let s = 0; s < 32; s += 8) {
      const a = (c00 >>> s) & 255, b = (c10 >>> s) & 255, c = (c01 >>> s) & 255, d = (c11 >>> s) & 255;
      const top = a + (b - a) * ax, bot = c + (d - c) * ax;
      out |= (Math.round(top + (bot - top) * ay) & 255) << s;
    }
    return out >>> 0;
  }

  function lmSample(lm, u, v, out) {
    const fx = u * lm.w - 0.5, fy = v * lm.h - 0.5;
    let x0 = Math.floor(fx), y0 = Math.floor(fy);
    const ax = fx - x0, ay = fy - y0;
    if (x0 < 0) x0 = 0; if (y0 < 0) y0 = 0;
    const x1 = Math.min(lm.w - 1, x0 + 1), y1 = Math.min(lm.h - 1, y0 + 1);
    const d = lm.data;
    for (let k = 0; k < 3; k++) {
      const a = d[(y0 * lm.w + x0) * 4 + k], b = d[(y0 * lm.w + x1) * 4 + k], c = d[(y1 * lm.w + x0) * 4 + k], e = d[(y1 * lm.w + x1) * 4 + k];
      out[k] = (a + (b - a) * ax) * (1 - ay) + (c + (e - c) * ax) * ay;
    }
  }

  // Varyings per vertex: u, v, lmu, lmv, lr, lg, lb, ar, ag, ab
  const NV = 10;
  function clipVerts(m, data, i) {
    const o = i * STRIDE;
    const x = data[o], y = data[o + 1], z = data[o + 2];
    return {
      c: [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14], m[3] * x + m[7] * y + m[11] * z + m[15]],
      v: [data[o + OFF.uv], data[o + OFF.uv + 1], data[o + OFF.lm], data[o + OFF.lm + 1], data[o + OFF.vl], data[o + OFF.vl + 1], data[o + OFF.vl + 2], data[o + OFF.alb], data[o + OFF.alb + 1], data[o + OFF.alb + 2]],
    };
  }
  function lerpV(a, b, t) {
    return { c: a.c.map((x, k) => x + (b.c[k] - x) * t), v: a.v.map((x, k) => x + (b.v[k] - x) * t) };
  }
  function clipNear(poly) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const ina = a.c[3] >= NEAR_W, inb = b.c[3] >= NEAR_W;
      if (ina) out.push(a);
      if (ina !== inb) out.push(lerpV(a, b, (NEAR_W - a.c[3]) / (b.c[3] - a.c[3])));
    }
    return out;
  }

  const L = [0, 0, 0];
  // Draw `count` vertices (count / 3 triangles) of an interleaved buffer.
  function draw(data, first, count, { mvp, tex = null, bilinear = false, zbuffer = true, lightmap = null, alphaTest = true, writeDepth = true } = {}) {
    for (let t = first; t < first + count; t += 3) {
      const mat = data[t * STRIDE + OFF.mat];
      let poly = [clipVerts(mvp, data, t), clipVerts(mvp, data, t + 1), clipVerts(mvp, data, t + 2)];
      poly = clipNear(poly);
      if (poly.length < 3) { stats.rejected++; continue; }
      const P = poly.map((p) => {
        const iw = 1 / p.c[3];
        return { x: (p.c[0] * iw * 0.5 + 0.5) * width, y: (1 - (p.c[1] * iw * 0.5 + 0.5)) * height, z: p.c[2] * iw, iw, v: p.v.map((q) => q * iw) };
      });
      for (let k = 1; k + 1 < P.length; k++) fill(P[0], P[k], P[k + 1], mat, tex, bilinear, zbuffer, lightmap, alphaTest, writeDepth);
      stats.tris++;
    }
  }

  function fill(a, b, c, mat, tex, bilinear, zbuffer, lightmap, alphaTest, writeDepth) {
    const area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    if (Math.abs(area) < 1e-9) return;
    let x0 = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x))), x1 = Math.min(width - 1, Math.ceil(Math.max(a.x, b.x, c.x)));
    let y0 = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y))), y1 = Math.min(height - 1, Math.ceil(Math.max(a.y, b.y, c.y)));
    const inv = 1 / area;
    const va = a.v, vb = b.v, vc = c.v;
    const vv = new Float64Array(NV);
    for (let y = y0; y <= y1; y++) {
      const py = y + 0.5;
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5;
        let w0 = ((b.x - px) * (c.y - py) - (b.y - py) * (c.x - px)) * inv;
        let w1 = ((c.x - px) * (a.y - py) - (c.y - py) * (a.x - px)) * inv;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = w0 * a.z + w1 * b.z + w2 * c.z;
        const idx = y * width + x;
        if (zbuffer && z >= depth[idx]) continue;
        const iw = w0 * a.iw + w1 * b.iw + w2 * c.iw;
        const r = 1 / iw;
        for (let k = 0; k < NV; k++) vv[k] = (w0 * va[k] + w1 * vb[k] + w2 * vc[k]) * r;
        let texel = 0xffffffff;
        if (tex && mat !== MAT.black) {
          texel = sample(tex, vv[0], vv[1], bilinear);
          if (alphaTest && (texel >>> 24) < 128) continue;
        }
        if (mat === MAT.black) texel = 0xff000000;
        if (mat === MAT.bright || mat === MAT.emissive) { L[0] = L[1] = L[2] = 1; }
        else if (lightmap && vv[2] >= 0) lmSample(lightmap, vv[2], vv[3], L);
        else { L[0] = vv[4]; L[1] = vv[5]; L[2] = vv[6]; }
        let R = (texel & 255) * vv[7] * L[0], G = ((texel >>> 8) & 255) * vv[8] * L[1], B = ((texel >>> 16) & 255) * vv[9] * L[2];
        if (R > 255) R = 255; if (G > 255) G = 255; if (B > 255) B = 255;
        color[idx] = (0xff000000 | (B << 16) | (G << 8) | R) >>> 0;
        if (writeDepth) depth[idx] = z;
        stats.pixels++;
      }
    }
  }

  return { width, height, color, depth, stats, clear, draw, sample };
}

// Painter's algorithm: triangle order, far to near, for a camera position.
export function painterOrder(data, count, eye) {
  const n = count / 3;
  const order = new Array(n);
  const dist = new Float64Array(n);
  for (let t = 0; t < n; t++) {
    let cx = 0, cy = 0, cz = 0;
    for (let k = 0; k < 3; k++) { const o = (t * 3 + k) * STRIDE; cx += data[o]; cy += data[o + 1]; cz += data[o + 2]; }
    dist[t] = Math.hypot(cx / 3 - eye[0], cy / 3 - eye[1], cz / 3 - eye[2]);
    order[t] = t;
  }
  order.sort((a, b) => dist[b] - dist[a]);
  return order;
}
