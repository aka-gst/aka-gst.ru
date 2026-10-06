// 17.4 · Lightmaps for polygons (the Quake way). Every quad of the level
// gets its own small grid of light samples ("luxels", 4 per metre), packed
// into one atlas texture. Each luxel adds up the lamps that reach it: falloff
// with distance, the angle to the lamp, and a visibility test -- a ray marched
// through the cell grid toward the lamp; if a wall, a floor or a ceiling is
// in the way, the luxel is in shadow. Baked once per light switch, sampled
// by the GPU every pixel.
//
// Pure: no DOM. tools/mesh-builder.test.mjs checks packing and shadows.
import { cellAt } from './raycaster.js';
import { quadSize } from './mesh-builder.js';

export function lampPos(map, L) {
  if (Number.isFinite(L.y)) return [L.x, L.y, L.z];
  const c = cellAt(map, L.x, L.z);
  const y = c && !c.solid ? Math.min(c.ceil - 0.55, c.floor + 3.4) : 3;
  return [L.x, Math.max(0.6, y), L.z];
}

// Is the segment p -> q free of walls, floors and ceilings?
export function visible(map, p, q, step = 0.12) {
  const dx = q[0] - p[0], dy = q[1] - p[1], dz = q[2] - p[2];
  const d = Math.hypot(dx, dy, dz);
  const n = Math.max(1, Math.ceil(d / step));
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const x = p[0] + dx * t, y = p[1] + dy * t, z = p[2] + dz * t;
    const c = cellAt(map, x, z);
    if (!c || c.solid) return false;
    if (y < c.floor - 0.01 || y > c.ceil + 0.01) return false;
  }
  return true;
}

// Light arriving at point p with normal n. lamps: { x, z, y?, radius,
// intensity, color, group }. Distance is mostly horizontal (like the
// raycaster's 2D lightmap) so the two tiers keep the same mood.
export function lightAt(map, lamps, p, n, { ambient = [0.3, 0.3, 0.33], occlude = true, dark = false } = {}) {
  let r = ambient[0], g = ambient[1], b = ambient[2];
  if (dark) return [r * 0.35, g * 0.35, b * 0.4];
  const q = [p[0] + n[0] * 0.04, p[1] + n[1] * 0.04, p[2] + n[2] * 0.04];
  for (const L of lamps) {
    const lp = L._pos ?? lampPos(map, L);
    const dx = lp[0] - q[0], dy = lp[1] - q[1], dz = lp[2] - q[2];
    const dist = Math.hypot(dx, dz, dy * 0.45);
    if (dist >= L.radius) continue;
    const real = Math.hypot(dx, dy, dz) || 1;
    const ndl = (n[0] * dx + n[1] * dy + n[2] * dz) / real;
    if (ndl <= -0.05) continue;
    let k = (1 - dist / L.radius) ** 2 * L.intensity * (0.4 + 0.6 * Math.max(0, ndl));
    if (occlude && !visible(map, q, lp)) k *= 0.12;
    r += k * L.color[0]; g += k * L.color[1]; b += k * L.color[2];
  }
  return [r, g, b];
}

// Shelf-pack rectangles (w, h in texels) into a square-ish atlas.
export function packRects(sizes, maxW = 1024) {
  const order = sizes.map((s, i) => i).sort((a, b) => sizes[b].h - sizes[a].h || sizes[b].w - sizes[a].w);
  const out = new Array(sizes.length);
  let x = 0, y = 0, shelf = 0, W = 0;
  for (const i of order) {
    const { w, h } = sizes[i];
    if (x + w > maxW) { x = 0; y += shelf; shelf = 0; }
    out[i] = { x, y, w, h };
    x += w; if (h > shelf) shelf = h; if (x > W) W = x;
  }
  return { rects: out, w: Math.max(1, W), h: Math.max(1, y + shelf) };
}

// A quad's identity across rebuilds: where it is and how big (a door that
// moved makes a new quad, which then uses vertex light until the next bake).
export function quadId(q) {
  return `${q.key}|${q.o.map((v) => v.toFixed(3)).join(',')}|${quadSize(q).map((v) => v.toFixed(3)).join(',')}`;
}

// Bake all quads. Returns { w, h, data (Float32 RGBA), rect(q) -> uv rect }.
export function bakeAtlas(quads, map, lamps, { res = 4, ambient, occlude = true, maxW = 1024 } = {}) {
  const ls = lamps.map((L) => ({ ...L, _pos: lampPos(map, L) }));
  const sizes = quads.map((q) => {
    const [a, b] = quadSize(q);
    return { w: Math.max(2, Math.ceil(a * res) + 1), h: Math.max(2, Math.ceil(b * res) + 1) };
  });
  const pack = packRects(sizes, maxW);
  const W = pack.w, H = pack.h;
  const data = new Float32Array(W * H * 4);
  const rects = new Map();
  quads.forEach((q, qi) => {
    const R = pack.rects[qi];
    for (let j = 0; j < R.h; j++) for (let i = 0; i < R.w; i++) {
      const s = i / (R.w - 1), t = j / (R.h - 1);
      // Pull the sample a hair inside the quad so edge luxels don't test
      // against the neighbouring wall.
      const ss = 0.02 + s * 0.96, tt = 0.02 + t * 0.96;
      const p = [q.o[0] + q.U[0] * ss + q.V[0] * tt, q.o[1] + q.U[1] * ss + q.V[1] * tt, q.o[2] + q.U[2] * ss + q.V[2] * tt];
      const c = lightAt(map, ls, p, q.n, { ambient, occlude, dark: q.dark });
      const o = ((R.y + j) * W + R.x + i) * 4;
      data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 1;
    }
    rects.set(quadId(q), { u0: (R.x + 0.5) / W, v0: (R.y + 0.5) / H, u1: (R.x + R.w - 0.5) / W, v1: (R.y + R.h - 0.5) / H });
  });
  return { w: W, h: H, data, rect: (q) => rects.get(quadId(q)) ?? null, count: quads.length };
}
