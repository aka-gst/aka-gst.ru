// 17.4 · The engine core: one entry point that draws a level at whatever
// rung of the engine ladder (engine-ladder.js) the player has reached.
//
//   rungs 0..10  the column raycaster (raycaster.js), with its own features
//                switched one by one: textured flats, distance light, the
//                lamp lightmap, rippling liquids, the VGA palette, 320x200, y-shearing,
//                mirrors, coloured lamps, smooth light;
//   rungs 11..30 the polygon renderer: the same level turned into triangles
//                (mesh-builder.js), lit by a baked per-face lightmap
//                (lm-bake.js), with 3D props (props-meshes.js), drawn by
//                WebGL2 (gl-renderer.js) -- or, without WebGL2, by the
//                software rasterizer (soft-raster.js).
//
// Both write the same Uint32 frame buffer, so the HUD, the speech bubbles,
// the dive into a computer and the upgrade wipe work on every rung. The
// garage, the apartment (fp-world.js) and the warehouse hall
// (factory-view.js) all draw through here.
import { bakeLightmap, rgb } from './raycaster.js';
import { createGlRenderer } from './gl-renderer.js';
import { createSoftRaster, painterOrder } from './soft-raster.js';
import { buildLevelQuads, quadsToVertices, STRIDE, OFF, MAT } from './mesh-builder.js';
import { bakeAtlas, lightAt, lampPos } from './lm-bake.js';
import * as PM from './props-meshes.js';
import { buildSkyCube, levelDecals, decalVertices, DECAL_TEX } from './engine-assets.js';
import { featureFlags, raySettings, colorLevels, frameRows } from './engine-ladder.js';
import { projection, viewMatrix, mul, perspectiveFov, lookAt } from './mat4.js';

const TRANS_MATS = new Set([MAT.window, MAT.water, MAT.carglass]);
let SKY = null;
const skyCube = () => (SKY ??= buildSkyCube(128));

// Frame size for a rung at a window aspect; scale < 1 is dynamic resolution.
export function frameDims(flags, aspect = 16 / 9, scale = 1, maxRows = Infinity) {
  const rows = Math.max(90, Math.round(Math.min(maxRows, frameRows(flags)) * scale / 2) * 2);
  const a = aspect > 0 && Number.isFinite(aspect) ? aspect : 16 / 9;
  const cols = Math.max(160, Math.min(Math.round(rows * 2.4), Math.round(rows * a)));
  return { w: cols, h: rows };
}

// The VGA-ish colour quantiser (ordered dither), in place on an ABGR buffer.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export function quantizeBuf(buf, w, h, levels) {
  if (!levels || levels < 2) return buf;
  const step = 255 / (levels - 1), dither = levels <= 6 ? 0 : 0.25;
  for (let y = 0, i = 0; y < h; y++) {
    for (let x = 0; x < w; x++, i++) {
      const c = buf[i];
      const d = (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * step * dither;
      let r = Math.round(((c & 255) + d) / step) * step, g = Math.round((((c >>> 8) & 255) + d) / step) * step, b = Math.round((((c >>> 16) & 255) + d) / step) * step;
      r = r < 0 ? 0 : r > 255 ? 255 : r; g = g < 0 ? 0 : g > 255 ? 255 : g; b = b < 0 ? 0 : b > 255 ? 255 : b;
      buf[i] = (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
    }
  }
  return buf;
}

const grey = (c, k) => { const l = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11; return [l + (c[0] - l) * k, l + (c[1] - l) * k, l + (c[2] - l) * k]; };
const FOG = {
  garage: { color: [0.15, 0.16, 0.19], density: 0.022, height: 0.6, heightDensity: 0.06 },
  home: { color: [0.16, 0.14, 0.14], density: 0.018, height: 0.35, heightDensity: 0.03 },
  hall: { color: [0.2, 0.18, 0.15], density: 0.028, height: 0.9, heightDensity: 0.05 },
};

let texIds = new WeakMap(); let texNext = 1;
const idOf = (o) => { if (!o) return 0; let v = texIds.get(o); if (!v) { v = texNext++; texIds.set(o, v); } return v; };

export function createEngineCore({ reducedMotion = false, forceSoft = false } = {}) {
  let glr = null; let glTried = false;
  let soft = null;
  const stats = { path: 'ray', ms: 0, tris: 0, quads: 0, props: 0, sprites: 0, bakeMs: 0, gl: null };
  const rayLm = { key: '', lm: null };
  let geo = null; // static geometry cache
  let bake = { key: '', atlas: null, version: 0 };
  let sigChangedAt = 0; let lastSig = '';
  let roll = 0; let lastCam = null; let lastT = 0;
  const glassCopies = new WeakMap();
  const staticPropCache = new Map();
  // RTX rung: the level as a grid the fragment shader can trace, and an
  // honest switch-off when the GPU cannot keep up.
  let grid = null; let rtxSlow = 0; let rtxOff = false; let rtxForce = false;
  const avgCache = new WeakMap();
  function avgColor(t) {
    if (!t || !t.data) return [0.5, 0.5, 0.5];
    let a = avgCache.get(t);
    if (!a) {
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < t.data.length; i += 3) { const c = t.data[i]; if ((c >>> 24) < 128) continue; r += c & 255; g += (c >>> 8) & 255; b += (c >>> 16) & 255; n++; }
      a = n ? [r / n / 255, g / n / 255, b / n / 255] : [0.5, 0.5, 0.5];
      avgCache.set(t, a);
    }
    return a;
  }
  function gridFor(scene, flags, lamps, ambient, key) {
    if (grid && grid.key === key) return grid;
    const m = scene.map, tex = m.textures || {};
    const n = m.w * m.h;
    const cells = new Uint8Array(n * 4), floor = new Uint8Array(n * 4), wall = new Uint8Array(n * 4), ceil = new Uint8Array(n * 4);
    const put = (arr, i, c, k) => { for (let j = 0; j < 3; j++) arr[i * 4 + j] = Math.max(0, Math.min(255, Math.round(c[j] * k * 127.5))); arr[i * 4 + 3] = 255; };
    for (let i = 0; i < n; i++) {
      const c = m.cells[i];
      const x = (i % m.w) + 0.5, z = Math.floor(i / m.w) + 0.5;
      cells[i * 4] = Math.round(Math.max(0, Math.min(10, c.floor)) * 25.5);
      cells[i * 4 + 1] = Math.round(Math.max(0, Math.min(10, c.solid ? 0 : c.ceil)) * 25.5);
      cells[i * 4 + 2] = c.solid ? 255 : 0; cells[i * 4 + 3] = c.liquid ? 255 : 0;
      const Lf = c.solid ? ambient : lightAt(m, lamps, [x, c.floor, z], [0, 1, 0], { ambient, occlude: false, dark: c.dark });
      const Lc = c.solid ? ambient : lightAt(m, lamps, [x, c.ceil, z], [0, -1, 0], { ambient, occlude: false, dark: c.dark });
      const Lw = lightAt(m, lamps, [x, 1.4, z], [0, 1, 0], { ambient, occlude: false });
      const fa = avgColor(tex[c.ftex]), ca = c.ctex === 'SKY' ? [0.05, 0.06, 0.1] : avgColor(tex[c.ctex]), wa = avgColor(tex[c.wall]);
      put(floor, i, fa.map((v, j) => v * Lf[j]), 1); put(ceil, i, ca.map((v, j) => v * Lc[j]), 1); put(wall, i, wa.map((v, j) => v * Lw[j] * 0.8), 1);
    }
    grid = { key, w: m.w, h: m.h, cells, floor, wall, ceil };
    return grid;
  }

  function gl() {
    if (forceSoft) return null;
    if (!glTried) { glTried = true; glr = createGlRenderer(); stats.gl = glr ? (glr.hdr ? 'webgl2+hdr' : 'webgl2') : 'none'; }
    if (glr && glr.lost()) glr = null;
    return glr;
  }

  // ------------------------------------------------------------ raycaster
  function rayLightmap(scene, flags, rs) {
    const ambient = scene.ambient ?? [0.3, 0.3, 0.33];
    if (!rs.useLightmap) {
      const key = `flat|${scene.levelId}`;
      if (rayLm.key !== key) { rayLm.key = key; rayLm.lm = { res: 1, w: 1, h: 1, data: new Float32Array([0.95, 0.95, 0.95]) }; }
      return rayLm.lm;
    }
    const key = `${scene.levelId}|${scene.lightKey}|${rs.colorK}|${rs.smoothLight}|${scene.map.w}x${scene.map.h}`;
    if (rayLm.key !== key) {
      const lamps = scene.lamps.map((L) => ({ ...L, color: grey(L.color, rs.colorK) }));
      rayLm.key = key;
      rayLm.lm = bakeLightmap(scene.map, lamps, { res: rs.smoothLight ? 6 : 4, ambient: ambient.map((v) => v * (rs.smoothLight ? 1.1 : 1)) });
    }
    return rayLm.lm;
  }

  function renderRay(target, scene, flags) {
    const rs = raySettings(flags);
    const lm = rayLightmap(scene, flags, rs);
    const dyn = (scene.dynLights ?? []).map((L) => ({ ...L, r2: L.radius * L.radius, color: grey(L.color, rs.colorK) }));
    const view = target.ray.render({
      map: scene.map, cam: scene.cam, lightmap: lm, dynLights: dyn, sprites: scene.sprites ?? [], particles: scene.particles ?? [],
      time: scene.time, viewH: target.viewH, fov: scene.fov,
      liquids: rs.liquids, bands: rs.bands, flatLight: 0, smoothLight: rs.smoothLight, mirrors: rs.mirrors,
      flatFloor: rs.flats ? rgb(112, 112, 112) : 0, flatCeil: rs.flats ? rgb(56, 56, 56) : 0, fog: rs.fogK,
    });
    quantizeBuf(target.buf, target.w, target.viewH, colorLevels(flags));
    stats.path = 'ray';
    return { ...view, cam: scene.cam };
  }

  // ------------------------------------------------------------ geometry
  function cellView(scene, flags) {
    return (c) => {
      if (!c) return c;
      if (flags.props3d && c.kind === 'car') return { ...c, floor: 0, wall: null, faces: null, ftex: 'GFLOOR', kind: 'floor' };
      if (flags.animProps && c.door === 'swing') return { ...c, ceil: c.floor + (scene.doorOpenH ?? 2.4) };
      return c;
    };
  }
  function geometrySig(scene, flags) {
    const m = scene.map;
    let h = 0;
    for (let i = 0; i < m.cells.length; i++) { const c = m.cells[i]; h = (h * 31 + Math.round(c.floor * 100) * 7 + Math.round(c.ceil * 100)) | 0; }
    return `${scene.levelId}|${m.w}x${m.h}|${h}|${idOf(m.textures)}|${flags.props3d}|${flags.animProps}|${flags.skybox}|${flags.glass}|${flags.decals}`;
  }

  function lampsForBake(scene, flags) {
    const sh = flags.shadows ? scene.shadowLamp : null;
    return scene.lamps.filter((L) => L !== sh).map((L) => ({ ...L, color: flags.dynLights ? L.color : grey(L.color, 0.6) }));
  }

  function staticGeometry(scene, flags, now) {
    const sig = geometrySig(scene, flags);
    if (sig !== lastSig) { lastSig = sig; sigChangedAt = now; }
    const settled = now - sigChangedAt > 350;
    const lamps = lampsForBake(scene, flags);
    const ambient = scene.ambient ?? [0.3, 0.3, 0.33];
    const bakeKey = `${scene.levelId}|${scene.lightKey}|${flags.shadows}|${flags.dynLights}|${idOf(scene.map)}`;
    const quadsKey = sig;
    let quads = geo?.quadsKey === quadsKey ? geo.quads : null;
    if (!quads) {
      quads = buildLevelQuads(scene.map, { view: cellView(scene, flags), sky: flags.skybox, surfaces: true }).quads;
    }
    // Bake the lightmap when the lights changed, or when moving geometry has
    // settled (doors stop); while a door moves its new quads use vertex light.
    let rebaked = false;
    const want = `${bakeKey}|${sig}`;
    if (flags.polyLightmap && bake.key !== want && (!bake.atlas || bake.lightKey !== bakeKey || settled)) {
      const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
      bake = { key: want, lightKey: bakeKey, atlas: bakeAtlas(quads, scene.map, lamps, { res: 4, ambient }), version: bake.version + 1 };
      stats.bakeMs = (typeof performance !== 'undefined' ? performance.now() : 0) - t0;
      rebaked = true;
    }
    const version = `${sig}|${bakeKey}|${flags.polyLightmap ? bake.version : 'v'}|${flags.mirrors}`;
    if (geo && geo.version === version && !rebaked) return geo;

    const tex = scene.map.textures || {};
    const vl = (p, n, q) => lightAt(scene.map, lamps, p, n, { ambient, occlude: false, dark: q.dark });
    const atlas = flags.polyLightmap ? bake.atlas : null;
    // Group quads: opaque by texture, transparent one by one (sorted later).
    const groups = new Map();
    const transList = [];
    for (const q of quads) {
      let mat = q.mat;
      if (mat === 'puddle') mat = flags.glass ? 'water' : 'liquid';
      if (!flags.glass && mat === 'water') mat = 'liquid';
      if (!flags.glass && (mat === 'window' || mat === 'carglass')) mat = 'lit';
      const pass = mat === 'window' || mat === 'water' || mat === 'carglass' ? 'trans' : 'opaque';
      const qq = mat === q.mat ? q : { ...q, mat };
      if (pass === 'trans') { transList.push(qq); continue; }
      const k = `${q.tex}|${mat === 'mirror'}`;
      if (!groups.has(k)) groups.set(k, { texName: q.tex, quads: [], mirror: mat === 'mirror', pass });
      groups.get(k).quads.push(qq);
    }
    const all = [...groups.values(), ...transList.map((q) => ({ texName: q.tex, quads: [q], mirror: false, pass: 'trans', window: q.mat === 'window' }))];
    // Decals.
    const decalGroups = [];
    if (flags.decals) for (const d of levelDecals(scene.levelId)) {
      const light = lightAt(scene.map, lamps, d.c, d.n, { ambient, occlude: true });
      decalGroups.push({ decal: true, texObj: DECAL_TEX[d.tex], data: new Float32Array(decalVertices(d, light)), center: d.c, pass: 'decal' });
    }
    let total = 0;
    const built = all.map((g) => {
      const v = quadsToVertices(g.quads, { lmRect: atlas ? (q) => atlas.rect(q) : () => null, vlight: vl });
      total += v.count;
      return { g, v };
    });
    for (const d of decalGroups) total += d.data.length / STRIDE;
    const data = new Float32Array(total * STRIDE);
    const outGroups = [];
    const triGroup = new Uint16Array(total / 3);
    const centroids = new Float32Array(total);
    let first = 0;
    const push = (arr, info) => {
      data.set(arr, first * STRIDE);
      const count = arr.length / STRIDE;
      const gi = outGroups.length;
      let cx = 0, cy = 0, cz = 0;
      for (let t = 0; t < count / 3; t++) {
        let x = 0, y = 0, z = 0;
        for (let k = 0; k < 3; k++) { const o = (first + t * 3 + k) * STRIDE; x += data[o]; y += data[o + 1]; z += data[o + 2]; }
        const ti = first / 3 + t;
        triGroup[ti] = gi; centroids[ti * 3] = x / 3; centroids[ti * 3 + 1] = y / 3; centroids[ti * 3 + 2] = z / 3;
        cx += x / 3; cy += y / 3; cz += z / 3;
      }
      const n = Math.max(1, count / 3);
      outGroups.push({ ...info, first, count, center: [cx / n, cy / n, cz / n] });
      first += count;
    };
    for (const { g, v } of built) {
      let texObj = g.texName ? tex[g.texName] ?? null : null;
      if (g.window && texObj) texObj = glassCopy(texObj);
      push(v.data, { tex: texObj, texName: g.texName, pass: g.pass, mirror: g.mirror, window: Boolean(g.window) });
    }
    for (const d of decalGroups) push(d.data, { tex: d.texObj, pass: 'decal', mirror: false, casts: false });
    const mirrorQuad = flags.mirrors ? quads.find((q) => q.mat === 'mirror') : null;
    geo = {
      version, quadsKey, quads, data, count: total, groups: outGroups, triGroup, centroids,
      mirror: mirrorQuad ? { n: mirrorQuad.n, d: mirrorQuad.n[0] * mirrorQuad.o[0] + mirrorQuad.n[1] * mirrorQuad.o[1] + mirrorQuad.n[2] * mirrorQuad.o[2], o: mirrorQuad.o } : null,
      lightmap: atlas ? { key: `lm${bake.version}`, w: atlas.w, h: atlas.h, data: atlas.data } : null,
    };
    stats.quads = quads.length; stats.tris = total / 3;
    return geo;
  }

  // Window glass: the panes become see-through (the skybox shows), the
  // frame and the rain drops stay.
  function glassCopy(src, dirty = false) {
    let c = glassCopies.get(src);
    if (!c) { c = { ...src, data: new Uint32Array(src.data.length) }; glassCopies.set(src, c); dirty = true; }
    if (dirty) {
      const k = src.w / 64;
      for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
        const u = (x + 0.5) / k, v = (y + 0.5) / k;
        const dx = Math.abs(u - 32) / 32, hgt = (96 - v) / 32;
        const pane = dx < 0.76 && hgt > 1.06 && hgt < 2.29 && dx >= 0.03 && Math.abs(hgt - 1.85) >= 0.03;
        const s = src.data[y * src.w + x];
        if (!pane) { c.data[y * src.w + x] = s; continue; }
        const rain = (s & 255) > 150 && ((s >>> 16) & 255) > 200;
        c.data[y * src.w + x] = ((s & 0x00ffffff) | ((rain ? 150 : 40) << 24)) >>> 0;
      }
    }
    return c;
  }

  // ------------------------------------------------------------ props
  function propParts(scene, flags, camPos) {
    const parts = []; // { tex, data:number[] }
    const t = scene.time;
    if (flags.props3d && scene.levelId === 'garage') parts.push(...PM.carMesh({ glass: flags.glass }).map((p) => ({ ...p, static: 'car' })));
    const leftovers = [];
    for (const s of scene.sprites ?? []) {
      if (!flags.props3d || !s.prop) { leftovers.push(s); continue; }
      const y = s.y || 0;
      switch (s.prop) {
        case 'laptop': parts.push(...PM.laptopMesh(s.x, y + 0.0, s.z, s.img, { facing: s.facing ?? Math.PI / 2 })); break;
        case 'pc': parts.push(...PM.pcMesh(s.x, y, s.z - 0.1, s.img)); break;
        case 'lamp': {
          const c = scene.map.cells[Math.floor(s.z) * scene.map.w + Math.floor(s.x)];
          parts.push(...PM.lampMesh(s.x, c ? c.ceil : y + 1.2, s.z, y + 0.55, { lit: s.fullbright !== false, blades: Boolean(s.fan) && flags.props3d, fan: s.fan && flags.animProps ? t * 3.2 : 0.4 }));
          break;
        }
        case 'worklamp': parts.push(...PM.workLampMesh(s.x, s.z)); break;
        case 'barrel': parts.push(...PM.barrelMesh(s.x, s.z)); break;
        case 'radio': parts.push(...PM.radioMesh(s.x, y + 0.02, s.z)); break;
        case 'toilet': parts.push(...PM.toiletMesh(s.x, y, s.z)); break;
        case 'cat': parts.push(...PM.catMesh(s.x, y, s.z, { t, animate: flags.animProps, lookAt: { x: camPos[0], z: camPos[2] } })); break;
        case 'panel': parts.push(...PM.panelMesh(s.x, y, s.z, s.img, { facing: s.facing, depth: s.depth })); break;
        case 'crate': parts.push(...PM.crateMesh(s.x, s.z, y, scene.map.textures?.[s.crateTex ?? 'CRATE_B'] ?? null, { size: 0.8 })); break;
        default: leftovers.push(s);
      }
    }
    // Hinged doors.
    if (flags.animProps) for (const c of scene.map.cells) {
      if (c.door !== 'swing') continue;
      const openH = scene.doorOpenH ?? 2.4;
      const k = Math.max(0, Math.min(1, (c.ceil - c.floor) / openH));
      parts.push(...PM.doorMesh(c.x, c.x + 1, c.z + 0.5, c.floor, openH - 0.02, -k * Math.PI * 0.48, scene.map.textures?.[scene.doorTex ?? 'WOODDOOR'] ?? null));
    }
    return { parts, sprites: leftovers };
  }

  // Billboards: quads that turn to face the camera (or its mirror image).
  function billboards(sprites, camPos, light, { mirror = false } = {}) {
    const out = [];
    for (const s of sprites) {
      if (s.mirrorOnly && !mirror) continue;
      const img = s.img;
      if (!img || !img.data) continue;
      const ppm = s.ppm || img.ppm || 40;
      const wM = img.w / ppm * (s.scale || 1), hM = img.h / ppm * (s.scale || 1);
      let tx = camPos[0] - s.x, tz = camPos[2] - s.z;
      const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
      const rx = tz, rz = -tx;
      const y0 = s.y || 0, y1 = y0 + hM;
      const hw = wM / 2;
      const L = s.fullbright ? [s.glow || 1, s.glow || 1, s.glow || 1] : light([s.x, y0 + hM / 2, s.z], [tx, 0, tz]);
      const mat = s.fullbright ? MAT.bright : MAT.sprite;
      const P = [[s.x - rx * hw, y0, s.z - rz * hw], [s.x + rx * hw, y0, s.z + rz * hw], [s.x + rx * hw, y1, s.z + rz * hw], [s.x - rx * hw, y1, s.z - rz * hw]];
      const f = s.flip ? 1 : 0;
      const UV = [[f, 1], [1 - f, 1], [1 - f, 0], [f, 0]];
      const d = [];
      for (const i of [0, 1, 2, 0, 2, 3]) d.push(P[i][0], P[i][1], P[i][2], UV[i][0], UV[i][1], tx, 0, tz, -1, -1, L[0], L[1], L[2], 1, 1, 1, mat, 0, 0);
      out.push({ tex: s.mirror && s.mirrorImg ? s.mirrorImg : img, data: new Float32Array(d), pass: 'opaque', center: [s.x, (y0 + y1) / 2, s.z], casts: false, sprite: true });
    }
    return out;
  }

  function lightPropParts(parts, scene, lamps, ambient, flags) {
    const out = [];
    for (const p of parts) {
      // the car never moves: light and split it once per light setting
      const ck = p.static ? `${p.static}|${parts.indexOf(p)}|${scene.lightKey}|${flags.glass}|${flags.shadows}|${flags.dynLights}` : null;
      if (ck && staticPropCache.has(ck)) { out.push(...staticPropCache.get(ck)); continue; }
      const before = out.length;
      const d = p.data;
      // per-vertex light (no occlusion: props move)
      for (let i = 0; i < d.length; i += STRIDE) {
        const mat = d[i + OFF.mat];
        if (mat === MAT.emissive) continue;
        const L = lightAt(scene.map, lamps, [d[i], d[i + 1], d[i + 2]], [d[i + 5], d[i + 6], d[i + 7]], { ambient, occlude: false });
        d[i + OFF.vl] = L[0]; d[i + OFF.vl + 1] = L[1]; d[i + OFF.vl + 2] = L[2];
      }
      // split by pass (car glass is transparent when glass is on)
      const nT = d.length / (STRIDE * 3);
      const isT = new Uint8Array(nT);
      let nTr = 0, cx = 0, cy = 0, cz = 0;
      for (let t = 0, i = 0; t < nT; t++, i += STRIDE * 3) {
        if (flags.glass && TRANS_MATS.has(d[i + OFF.mat])) { isT[t] = 1; nTr++; }
        cx += d[i]; cy += d[i + 1]; cz += d[i + 2];
      }
      const src = d instanceof Float32Array ? d : new Float32Array(d);
      const op = new Float32Array((nT - nTr) * STRIDE * 3), tr = new Float32Array(nTr * STRIDE * 3);
      for (let t = 0, a = 0, b = 0; t < nT; t++) {
        const seg = src.subarray(t * STRIDE * 3, (t + 1) * STRIDE * 3);
        if (isT[t]) { tr.set(seg, b); b += seg.length; } else { op.set(seg, a); a += seg.length; }
      }
      const center = nT ? [cx / nT, cy / nT, cz / nT] : [0, 0, 0];
      if (op.length) out.push({ tex: typeof p.tex === 'string' ? scene.map.textures?.[p.tex] : p.tex, data: op, pass: 'opaque', center, casts: true });
      if (tr.length) out.push({ tex: null, data: tr, pass: 'trans', center, casts: false });
      if (ck) { if (staticPropCache.size > 32) staticPropCache.clear(); staticPropCache.set(ck, out.slice(before)); }
    }
    return out;
  }

  // ------------------------------------------------------------ camera
  function camera(target, scene, flags) {
    const W = target.w, VH = target.viewH;
    const F = (W / 2) / Math.tan(((scene.fov || 80) * Math.PI / 180) / 2);
    const c = scene.cam;
    const now = scene.time;
    let pitch = 0, shear = (c.bob || 0) + (c.pitch || 0);
    if (flags.trueLook) {
      pitch = (c.pitchAngle ?? 0);
      shear = c.bob || 0;
      // roll: lean into sideways motion (Quake's view roll)
      if (lastCam && now > lastT && !reducedMotion) {
        const dt = now - lastT;
        const vx = (c.x - lastCam.x) / dt, vz = (c.z - lastCam.z) / dt;
        const side = vx * Math.cos(c.yaw) + vz * Math.sin(c.yaw);
        const want = Math.max(-0.035, Math.min(0.035, -side * 0.009));
        roll += (want - roll) * Math.min(1, dt * 8);
      }
    } else roll = 0;
    lastCam = { x: c.x, z: c.z }; lastT = now;
    const V = viewMatrix({ x: c.x, z: c.z, eye: c.eye, yaw: c.yaw, pitch, roll });
    const P = projection(F, W, VH, 0.04, 70, shear);
    return { F, VP: mul(P, V), pos: [c.x, c.eye, c.z], horizon: VH / 2 + shear + (flags.trueLook ? F * Math.tan(pitch) : 0) };
  }

  // ------------------------------------------------------------ poly
  function renderPoly(target, scene, flags) {
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    const g = staticGeometry(scene, flags, t0);
    const cam = camera(target, scene, flags);
    const lamps = lampsForBake(scene, flags);
    const ambient = scene.ambient ?? [0.3, 0.3, 0.33];
    const lightFn = (p, n) => lightAt(scene.map, lamps, p, n, { ambient, occlude: false });
    const { parts, sprites } = propParts(scene, flags, cam.pos);
    const propDyn = lightPropParts(parts, scene, lamps, ambient, flags);
    const dyn = [...propDyn, ...billboards(sprites, cam.pos, lightFn)];
    stats.props = parts.length; stats.sprites = sprites.length;
    // Mirror: the camera's mirror image decides which way the billboards turn.
    let mirror = null;
    if (g.mirror) {
      const { n, d } = g.mirror;
      const side = n[0] * cam.pos[0] + n[1] * cam.pos[1] + n[2] * cam.pos[2] - d;
      if (side > 0.05 && side < 14) {
        const mc = [cam.pos[0] - 2 * side * n[0], cam.pos[1] - 2 * side * n[1], cam.pos[2] - 2 * side * n[2]];
        mirror = { n, d, dyn: [...propDyn.filter((p) => p.pass === 'opaque'), ...billboards(scene.sprites.filter((s) => !s.prop || !flags.props3d), mc, lightFn, { mirror: true })] };
      }
    }
    const lights = (scene.dynLights ?? []).map((L) => ({ x: L.x, y: L.y ?? 1.2, z: L.z, radius: L.radius, intensity: L.intensity, color: L.color }))
      .sort((a, b) => Math.hypot(a.x - cam.pos[0], a.z - cam.pos[2]) - Math.hypot(b.x - cam.pos[0], b.z - cam.pos[2])).slice(0, 8);
    let shadow = null;
    if (flags.shadows && scene.shadowLamp) {
      const L = scene.shadowLamp;
      const pos = lampPos(scene.map, L);
      const VP = mul(perspectiveFov((150 * Math.PI) / 180, 1, 0.05, 14), lookAt(pos, [pos[0], pos[1] - 1, pos[2]], [0, 0, -1]));
      shadow = { pos, radius: L.radius, intensity: L.intensity, color: flags.dynLights ? L.color : grey(L.color, 0.6), VP };
    }
    const dirty = new Set();
    for (const name of scene.dirtyTextures ?? []) {
      const tx = scene.map.textures?.[name];
      if (!tx) continue;
      dirty.add(tx);
      if (name === 'WINDOW' && flags.glass) dirty.add(glassCopy(tx, true));
    }
    const fog = scene.fogSpec ?? FOG[scene.levelId] ?? FOG.hall;
    const rtx = Boolean(flags.rtx && (!rtxOff || rtxForce));
    const gridData = rtx ? gridFor(scene, flags, lamps, ambient, g.version) : null;
    const r = gl();
    const out = target.buf;
    stats.cpuMs = (typeof performance !== 'undefined' ? performance.now() : 0) - t0;
    stats.cpuAvg = stats.cpuAvg ? stats.cpuAvg * 0.95 + stats.cpuMs * 0.05 : stats.cpuMs;
    stats.msAvg = stats.msAvg ?? 0;
    if (r) {
      try {
        r.render({
          W: target.w, H: target.viewH, out, flags, VP: cam.VP, cam: cam.pos, F: cam.F, time: scene.time,
          stat: { version: g.version, data: g.data, count: g.count, groups: g.groups, triGroup: g.triGroup, centroids: g.centroids },
          dyn, lightmap: g.lightmap, lights, shadow, fog, sky: flags.skybox ? skyCube() : null, mirror,
          particles: scene.particles ?? [], dirty, rtx, grid: gridData, depth: target.depth ?? null, near: 0.04, far: 70,
        });
        stats.path = 'gl';
      } catch (err) {
        if (typeof console !== 'undefined') console.warn('engine-core: GL failed, software fallback', err);
        glr = null; forceSoft = true;
        renderSoft(target, g, dyn, cam, flags);
      }
    } else renderSoft(target, g, dyn, cam, flags);
    quantizeBuf(out, target.w, target.viewH, colorLevels(flags));
    stats.ms = (typeof performance !== 'undefined' ? performance.now() : 0) - t0;
    stats.msAvg = stats.msAvg ? stats.msAvg * 0.95 + stats.ms * 0.05 : stats.ms;
    // RTX is only on while the frame keeps up: 90 slow frames in a row
    // (over 40 ms) switch it off and say so (stats.rtx).
    if (rtx && !rtxForce) { rtxSlow = stats.ms > 40 ? rtxSlow + 1 : 0; if (rtxSlow > 90) { rtxOff = true; rtxSlow = 0; } }
    stats.rtx = !flags.rtx ? 'none' : rtx ? 'on' : 'off-slow';
    // The GPU's own camera, for anything drawn on top in screen space (the
    // AR headset's tags, speech bubbles): same view-projection, so true
    // pitch and roll line up exactly.
    const VP = cam.VP, W = target.w, VH = target.viewH;
    const project = (p) => {
      const x = p.x, y = p.y ?? 0, z = p.z;
      const cx = VP[0] * x + VP[4] * y + VP[8] * z + VP[12], cy = VP[1] * x + VP[5] * y + VP[9] * z + VP[13], cw = VP[3] * x + VP[7] * y + VP[11] * z + VP[15];
      if (cw < 0.1) return { x: NaN, y: NaN, dz: cw, front: false };
      return { x: (cx / cw * 0.5 + 0.5) * W, y: (1 - (cy / cw * 0.5 + 0.5)) * VH, dz: cw, front: true };
    };
    return { F: cam.F, horizon: cam.horizon, depth: stats.path === 'gl' ? (target.depth ?? null) : null, cam: scene.cam, project };
  }

  // Without WebGL2: the same triangles through the software rasterizer, at
  // half resolution, without the GPU-only rungs (sky, glass, shadows, bloom).
  function renderSoft(target, g, dyn, cam, flags) {
    const sw = Math.max(160, Math.min(400, target.w >> 1)), sh = Math.max(90, Math.round(sw * target.viewH / target.w));
    if (!soft || soft.width !== sw || soft.height !== sh) soft = createSoftRaster(sw, sh);
    soft.clear(0xff000000);
    const opts = { mvp: cam.VP, bilinear: flags.bilinear, zbuffer: flags.zbuffer, lightmap: g.lightmap && flags.polyLightmap ? g.lightmap : null };
    if (flags.zbuffer) {
      for (const grp of g.groups) if (grp.pass !== 'decal') soft.draw(g.data, grp.first, grp.count, { ...opts, tex: grp.tex });
    } else {
      const order = painterOrder(g.data, g.count, cam.pos);
      for (const t of order) { const grp = g.groups[g.triGroup[t]]; if (grp.pass !== 'decal') soft.draw(g.data, t * 3, 3, { ...opts, tex: grp.tex }); }
    }
    for (const d of dyn) soft.draw(d.data, 0, d.data.length / STRIDE, { ...opts, tex: d.tex, lightmap: null });
    // nearest upscale into the frame
    const W = target.w, VH = target.viewH, src = soft.color;
    for (let y = 0; y < VH; y++) {
      const sy = Math.min(sh - 1, Math.floor(y * sh / VH));
      for (let x = 0; x < W; x++) target.buf[y * W + x] = src[sy * sw + Math.min(sw - 1, Math.floor(x * sw / W))];
    }
    stats.path = 'soft';
  }

  function render(target, scene, level) {
    const flags = featureFlags(level);
    if (!flags.poly) return renderRay(target, scene, flags);
    return renderPoly(target, scene, flags);
  }

  return {
    render, stats, flags: featureFlags, hasGl: () => Boolean(gl()),
    rtx(mode) { if (mode === 'force') { rtxForce = true; rtxOff = false; } else if (mode === 'auto') { rtxForce = false; rtxOff = false; rtxSlow = 0; } else if (mode === 'off') { rtxForce = false; rtxOff = true; } },
  };
}
