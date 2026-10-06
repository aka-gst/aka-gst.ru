// 17.4 · Procedural assets for the upper rungs of the engine ladder: the
// night-city sky cube (skybox), decal textures (oil, cracks, tyre marks,
// a poster) and where each level puts its decals. Pure: no DOM.
import { MAT, STRIDE } from './mesh-builder.js';
import { drawText, textWidth } from './pixel-font.js';

const pack = (r, g, b, a = 255) => ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
function hash(x, y, s = 0) {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + s * 2147483647;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y, s = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const a = hash(ix, iy, s), b = hash(ix + 1, iy, s), c = hash(ix, iy + 1, s), d = hash(ix + 1, iy + 1, s);
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

// ------------------------------------------------------------------ sky
// The colour of the night sky in direction d: a dark zenith, an orange city
// glow at the horizon, stars, the moon, and a skyline of blocks with lit
// windows all the way round.
export function skyColor(dx, dy, dz) {
  const az = Math.atan2(dx, -dz); // 0 = north (-z)
  const elev = Math.asin(Math.max(-1, Math.min(1, dy)));
  let r, g, b;
  const t = Math.max(0, Math.min(1, elev / 0.9));
  r = 46 + (8 - 46) * t; g = 34 + (10 - 34) * t; b = 52 + (26 - 52) * t;
  const glow = Math.exp(-Math.max(0, elev) * 7);
  r += 70 * glow; g += 34 * glow; b += 6 * glow;
  if (elev > 0.05) {
    const sx = Math.floor((az + Math.PI) * 120), sy = Math.floor(elev * 120);
    const s = hash(sx, sy, 7);
    if (s > 0.992) { const k = (s - 0.992) / 0.008; r += 180 * k; g += 180 * k; b += 200 * k; }
  }
  // moon
  const mx = 0.45, my = 0.42, mz = -0.79; const ml = Math.hypot(mx, my, mz);
  const md = (dx * mx + dy * my + dz * mz) / ml;
  if (md > 0.9993) { r = 236; g = 232; b = 214; }
  else if (md > 0.995) { const k = (md - 0.995) / 0.0043; r += 50 * k; g += 50 * k; b += 46 * k; }
  // skyline
  const col = Math.floor((az + Math.PI) * 26);
  const top = 0.03 + hash(col, 0, 3) * 0.16 + (hash(col >> 2, 1, 4) > 0.7 ? 0.08 : 0);
  if (elev < top && elev > -0.02) {
    r = 14; g = 15; b = 24;
    const wx = Math.floor((az + Math.PI) * 26 * 6), wy = Math.floor(elev * 160);
    if ((wx % 2 === 0) && (wy % 2 === 0) && hash(wx, wy, 11) > 0.72) { const warm = hash(wx, wy, 12) > 0.3; r = warm ? 250 : 170; g = warm ? 206 : 210; b = warm ? 110 : 250; }
  }
  if (elev <= -0.02) { r = 12; g = 12; b = 16; }
  return [Math.min(255, r), Math.min(255, g), Math.min(255, b)];
}

export function buildSkyCube(size = 128) {
  const data = [];
  const dirs = [
    (u, v) => [1, -v, -u], (u, v) => [-1, -v, u], (u, v) => [u, 1, v],
    (u, v) => [u, -1, -v], (u, v) => [u, -v, 1], (u, v) => [-u, -v, -1],
  ];
  for (const f of dirs) {
    const b = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = ((x + 0.5) / size) * 2 - 1, v = ((y + 0.5) / size) * 2 - 1;
      const [dx, dy, dz] = f(u, v); const l = Math.hypot(dx, dy, dz);
      const c = skyColor(dx / l, dy / l, dz / l);
      const o = (y * size + x) * 4;
      b[o] = c[0]; b[o + 1] = c[1]; b[o + 2] = c[2]; b[o + 3] = 255;
    }
    data.push(b);
  }
  return { key: `night-${size}`, size, data };
}

// --------------------------------------------------------------- decals
function tex(w, h, paint) {
  const data = new Uint32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = paint(x, y); data[y * w + x] = c ? pack(c[0], c[1], c[2], c[3]) : 0; }
  return { w, h, data, ppm: w };
}
export const DECAL_TEX = {};
function lazy(name, make) { Object.defineProperty(DECAL_TEX, name, { get() { const v = make(); Object.defineProperty(DECAL_TEX, name, { value: v }); return v; }, configurable: true, enumerable: true }); }
lazy('oil', () => tex(64, 64, (x, y) => {
  const d = Math.hypot(x - 32, y - 32) / 30 + (vnoise(x / 9, y / 9, 3) - 0.5) * 0.6;
  if (d > 1) return null;
  const a = Math.round(Math.min(1, (1 - d) * 2.4) * 200);
  const sheen = Math.abs(Math.sin(x * 0.3 + y * 0.2)) > 0.97 ? 40 : 0;
  return [10 + sheen, 9 + sheen, 12 + sheen * 1.4, a];
}));
lazy('crack', () => tex(64, 64, (x, y) => {
  let best = 9;
  let cx = 6, cy = 8;
  for (let i = 0; i < 12; i++) {
    const nx = cx + 4 + hash(i, 1, 5) * 3, ny = cy + 3 + (hash(i, 2, 5) - 0.4) * 6;
    const t = Math.max(0, Math.min(1, ((x - cx) * (nx - cx) + (y - cy) * (ny - cy)) / ((nx - cx) ** 2 + (ny - cy) ** 2)));
    best = Math.min(best, Math.hypot(x - (cx + (nx - cx) * t), y - (cy + (ny - cy) * t)));
    cx = nx; cy = ny;
  }
  if (best > 1.3) return null;
  return [20, 18, 16, 220];
}));
lazy('tyre', () => tex(32, 128, (x, y) => {
  const lane = Math.abs(x - 16 + Math.sin(y / 18) * 3);
  if (lane > 9) return null;
  const tread = (y % 6) < 3 ? 1 : 0.6;
  return [14, 14, 14, Math.round(120 * tread * (1 - lane / 9) * (0.6 + vnoise(x / 3, y / 5, 9) * 0.6))];
}));
lazy('scorch', () => tex(64, 64, (x, y) => {
  const d = Math.hypot(x - 32, y - 32) / 30 + (vnoise(x / 6, y / 6, 13) - 0.5) * 0.5;
  if (d > 1) return null;
  return [8, 6, 4, Math.round((1 - d) * 230)];
}));
lazy('water', () => tex(64, 64, (x, y) => {
  const d = Math.hypot(x - 32, y - 32) / 30 + (vnoise(x / 8, y / 8, 17) - 0.5) * 0.5;
  if (d > 1) return null;
  const rim = Math.abs(d - 0.85) < 0.06 ? 0.9 : 0.35;
  return [120, 96, 60, Math.round(rim * 150)];
}));
lazy('ring', () => tex(32, 32, (x, y) => { const d = Math.hypot(x - 16, y - 16); return Math.abs(d - 11) < 1.4 ? [70, 40, 20, 170] : null; }));
lazy('foot', () => tex(32, 64, (x, y) => {
  const inS = (cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1;
  return inS(16, 20, 7, 14) || inS(16, 50, 6, 8) ? [30, 26, 22, 110] : null;
}));
function posterTex(lines, bg, fg) {
  const w = 64, h = 96;
  const t = tex(w, h, (x, y) => (x < 2 || y < 2 || x > w - 3 || y > h - 3 ? [230, 226, 210, 255] : [bg[0] + (y >> 2), bg[1], bg[2], 255]));
  lines.forEach((l, i) => drawText(t.data, w, h, Math.round(w / 2 - textWidth(l) / 2), 10 + i * 12, l, pack(fg[0], fg[1], fg[2])));
  return t;
}
lazy('posterPy', () => posterTex(['PYTHON', '', 'FOR', 'X IN', 'МИР:', '', 'ЛУЧШЕ()'], [20, 40, 90], [255, 210, 70]));
lazy('posterQ', () => posterTex(['QUAKE', '1996', '', 'Z-', 'БУФЕР'], [70, 40, 20], [240, 160, 60]));

// Where each level wears its decals: { tex, c (centre), n (normal), up, w, h }.
export function levelDecals(levelId) {
  const D = (texName, c, n, w, h, up = null) => ({ tex: texName, c, n, w, h, up: up ?? (Math.abs(n[1]) > 0.5 ? [0, 0, -1] : [0, 1, 0]) });
  if (levelId === 'garage') return [
    D('oil', [6.0, 0.003, 6.6], [0, 1, 0], 1.3, 1.1), D('oil', [2.4, 0.003, 8.2], [0, 1, 0], 0.6, 0.5),
    D('tyre', [5.35, 0.004, 10.4], [0, 1, 0], 0.45, 2.2), D('tyre', [6.65, 0.004, 10.4], [0, 1, 0], 0.45, 2.2),
    D('scorch', [12.9, 0.003, 10.3], [0, 1, 0], 0.9, 0.9), D('crack', [8.5, 2.6, 1.002], [0, 0, 1], 1.0, 1.0),
    D('posterPy', [14.995, 1.75, 5.5], [-1, 0, 0], 0.6, 0.9), D('foot', [10.4, 0.004, 9.6], [0, 1, 0], 0.18, 0.36),
    D('foot', [10.8, 0.004, 9.0], [0, 1, 0], 0.18, 0.36),
  ];
  if (levelId === 'home') return [
    D('water', [2.0, 2.995, 9.0], [0, -1, 0], 1.0, 1.0), D('ring', [6.2, 1.053, 1.6], [0, 1, 0], 0.12, 0.12),
    D('posterQ', [1.005, 1.75, 4.5], [1, 0, 0], 0.6, 0.9), D('crack', [6.0, 2.4, 0.005 + 1], [0, 0, 1], 0.7, 0.7),
    D('foot', [12.2, 0.304, 9.4], [0, 1, 0], 0.18, 0.36),
  ];
  if (levelId === 'hall') return [
    D('oil', [7.6, 0.003, 6.7], [0, 1, 0], 1.2, 1.0), D('tyre', [8.5, 0.004, 9.5], [0, 1, 0], 0.5, 3.0),
    D('scorch', [3.0, 0.003, 7.2], [0, 1, 0], 1.0, 1.0), D('crack', [3.5, 2.2, 1.002], [0, 0, 1], 1.1, 1.1),
    D('foot', [8.2, 0.004, 11.8], [0, 1, 0], 0.18, 0.36),
  ];
  return [];
}

// A decal as two triangles in the shared vertex layout.
export function decalVertices(d, light = [1, 1, 1]) {
  const n = d.n; const up = d.up;
  // right = up x n
  let rx = up[1] * n[2] - up[2] * n[1], ry = up[2] * n[0] - up[0] * n[2], rz = up[0] * n[1] - up[1] * n[0];
  const rl = Math.hypot(rx, ry, rz) || 1; rx /= rl; ry /= rl; rz /= rl;
  const hw = d.w / 2, hh = d.h / 2;
  const P = (s, t) => [d.c[0] + rx * hw * s + up[0] * hh * t, d.c[1] + ry * hw * s + up[1] * hh * t, d.c[2] + rz * hw * s + up[2] * hh * t];
  const corners = [[P(-1, -1), [0, 1]], [P(1, -1), [1, 1]], [P(1, 1), [1, 0]], [P(-1, 1), [0, 0]]];
  const out = [];
  for (const i of [0, 1, 2, 0, 2, 3]) {
    const [p, uv] = corners[i];
    out.push(p[0], p[1], p[2], uv[0], uv[1], n[0], n[1], n[2], -1, -1, light[0], light[1], light[2], 1, 1, 1, MAT.decal, 0, 0);
  }
  return out;
}
export { STRIDE };
