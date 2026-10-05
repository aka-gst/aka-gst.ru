// 17.3 · Procedural textures and sprites for the garage and the apartment.
// Each texture is a function of texel coordinates at its base resolution, so
// the same painting can be produced blocky (Wolfenstein: half resolution) or
// fine (Unreal / Half-Life: double resolution, more grain, plus decals: oil
// stains, grime, graffiti). No DOM; tools/fp-world.test.mjs checks sizes.
import { rgb } from './raycaster.js';

const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
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
function fbm(x, y, s = 0, oct = 3) {
  let v = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { v += vnoise(x * f, y * f, s + i * 17) * amp; f *= 2; amp *= 0.5; }
  return v;
}
const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

// def: { w, h, ppmx, ppmy, paint(u, v, ctx) -> [r,g,b] (or null = transparent) }
// ctx: { grain(u,v) -> -1..1 fine noise, decals: bool, era }.
export function makeTexture(def, { scale = 1, decals = false, era = 2 } = {}) {
  const w = Math.max(4, Math.round(def.w * scale)), h = Math.max(4, Math.round(def.h * scale));
  const data = new Uint32Array(w * h);
  const ctx = { decals, era, scale, grain: (u, v) => (hash(Math.floor(u * scale * 1.0001), Math.floor(v * scale * 1.0001), 99) - 0.5) * 2 };
  const amp = scale >= 2 ? 1.25 : 1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = (x + 0.5) / scale, v = (y + 0.5) / scale;
    const c = def.paint(u, v, ctx);
    if (!c) { data[y * w + x] = 0; continue; }
    const g = (def.grain ?? 6) * ctx.grain(u, v) * amp;
    data[y * w + x] = rgb(clamp(c[0] + g), clamp(c[1] + g), clamp(c[2] + g));
  }
  return { w, h, data, ppm: (def.ppm ?? def.ppmx ?? 32) * scale, ppmx: (def.ppmx ?? def.ppm ?? 32) * scale, ppmy: (def.ppmy ?? def.ppm ?? 32) * scale, rows: def.rows };
}

// ------------------------------------------------------------- garage
const BLUE = [38, 86, 196], BLUE_D = [18, 40, 104], GLASS = [26, 40, 58];

// Car side as a function of the world: z along the car (4..9), height in m.
function carSideAt(z, hgt) {
  const wheel = (wz) => Math.hypot(z - wz, hgt - 0.33);
  for (const wz of [4.85, 8.1]) {
    const d = wheel(wz);
    if (d < 0.18) return d < 0.08 ? [170, 170, 176] : [96, 98, 104];
    if (d < 0.33) return [20, 20, 22];
    if (d < 0.38) return [8, 8, 10];
  }
  const roofTop = 1.42;
  if (z >= 6 && z <= 8 && hgt > 0.98) {
    if (hgt > roofTop) return BLUE;
    const pillar = Math.abs(z - 7) < 0.06 || z < 6.08 || z > 7.92;
    if (pillar) return BLUE_D;
    const sky = (hgt - 0.98) / 0.44;
    return mix(GLASS, [84, 112, 140], sky * 0.6 + (Math.abs(z - 6.6 + hgt * 0.5) < 0.12 ? 0.5 : 0));
  }
  if (hgt < 0.18) return [16, 16, 18];
  if (hgt < 0.28) return [24, 40, 80];
  let c = BLUE;
  if (Math.abs(hgt - 0.78) < 0.025) c = [120, 170, 240];
  if ((Math.abs(z - 6.02) < 0.02 || Math.abs(z - 7.02) < 0.02 || Math.abs(z - 7.98) < 0.02) && hgt > 0.3) c = BLUE_D;
  if (hgt > 0.62 && hgt < 0.67 && (Math.abs(z - 6.7) < 0.1 || Math.abs(z - 7.6) < 0.1)) c = [200, 210, 220];
  if (z < 4.25 && hgt > 0.5 && hgt < 0.66) c = [255, 190, 80];
  if (z > 8.8 && hgt > 0.62 && hgt < 0.8) c = [210, 30, 30];
  return mul(c, 0.85 + 0.25 * (hgt - 0.3));
}
function carSide(east) {
  return {
    w: 160, h: 48, ppmx: 32, ppmy: 32, grain: 3,
    paint(u, v) {
      const hgt = (48 - v) / 32; // texture row 0 = 1.5 m
      let z;
      if (!east) z = u >= 128 ? u / 32 : u / 32 + 5;
      else z = u <= 32 ? 5 - u / 32 : 10 - u / 32;
      return carSideAt(z, hgt);
    },
  };
}
// Front/rear faces: symmetric about the car's centre line (u = 0 seam).
const carEnd = (rear) => ({
  w: 64, h: 48, ppmx: 32, ppmy: 32, grain: 3,
  paint(u, v) {
    const dx = Math.min(u, 64 - u) / 32, hgt = (48 - v) / 32;
    if (dx > 0.96) return [20, 20, 22];
    if (hgt < 0.18) return [14, 14, 16];
    if (!rear) {
      if (hgt > 0.5 && hgt < 0.68 && dx > 0.5 && dx < 0.85) return dx > 0.62 && dx < 0.76 ? [255, 250, 220] : [210, 200, 160];
      if (hgt > 0.28 && hgt < 0.48 && dx < 0.4) return ((u | 0) % 4 < 2) ? [20, 22, 26] : [60, 64, 70];
      if (hgt > 0.2 && hgt < 0.28) return [70, 74, 80];
    } else {
      if (hgt > 0.58 && hgt < 0.8 && dx > 0.55 && dx < 0.9) return [220, 30, 24];
      if (hgt > 0.32 && hgt < 0.46 && dx < 0.3) return [230, 230, 222];
    }
    return mul(BLUE, 0.8 + hgt * 0.3);
  },
});
const glassFace = (front) => ({
  w: 64, h: 48, ppmx: 32, ppmy: 32, grain: 2,
  paint(u, v) {
    const dx = Math.min(u, 64 - u) / 32, hgt = (48 - v) / 32;
    if (hgt < 0.98 || hgt > 1.42 || dx > 0.9) return BLUE;
    const streak = Math.abs(dx - (hgt - 0.98) * (front ? 1.2 : 0.8) - 0.1) < 0.06 ? 0.45 : 0;
    return mix(GLASS, [120, 150, 180], streak + (hgt - 0.98));
  },
});
const carTop = (roof) => ({
  w: 64, h: 64, ppm: 32, grain: 3,
  paint(u, v) {
    const glint = Math.abs((u + v) % 64 - 20) < 3 ? 0.4 : 0;
    const base = roof ? BLUE : mul(BLUE, 0.95);
    if (!roof && (u | 0) % 32 === 0) return BLUE_D;
    return mix(base, [170, 200, 255], glint);
  },
});

export const TEXTURE_DEFS = {
  GFLOOR: { w: 64, h: 64, ppm: 32, grain: 9, paint(u, v, { decals }) {
    let c = mul([104, 102, 96], 0.8 + fbm(u / 18, v / 18, 3) * 0.4);
    if ((u | 0) % 64 === 0 || (v | 0) % 64 === 0) c = mul(c, 0.7);
    const stain = fbm(u / 9 + 40, v / 9, 7);
    if (stain > (decals ? 0.66 : 0.74)) c = mul(c, decals ? 0.35 : 0.6);
    if (decals && Math.abs(Math.sin(u / 7) * 6 + 30 - v) < 1.2) c = mul(c, 0.7); // tyre mark
    return c;
  } },
  GCEIL: { w: 64, h: 64, ppm: 32, grain: 4, paint(u) { const k = 0.7 + 0.3 * Math.abs(Math.sin(u / 64 * Math.PI * 8)); return mul([120, 124, 128], k); } },
  GWALL: { w: 64, h: 160, ppmx: 32, ppmy: 32, grain: 6, paint(u, v, { decals }) {
    const hgt = (160 - v) / 32;
    const row = Math.floor(v / 8), off = row % 2 ? 8 : 0;
    const mortar = (v | 0) % 8 === 0 || ((u + off) | 0) % 16 === 0;
    let c = hgt < 1.1 ? [70, 98, 80] : [168, 170, 160];
    if (Math.abs(hgt - 1.1) < 0.03) c = [40, 56, 46];
    if (mortar) c = mul(c, 0.82);
    if (decals) {
      const grime = fbm(u / 10, v / 30, 11);
      if (grime > 0.6) c = mul(c, 0.75);
      // a little lambda tag, sprayed by someone with taste
      const lx = u - 40, ly = v - 98;
      if (lx > 0 && lx < 12 && ly > 0 && ly < 14 && (Math.abs(lx - 6 - (ly - 7) * -0.2) < 1 + (ly > 7 ? 0 : 0) || Math.abs(lx - (ly - 1) * 0.4) < 1 && ly > 6)) c = [230, 120, 20];
    }
    return c;
  } },
  TOOLWALL: { w: 64, h: 160, ppmx: 32, ppmy: 32, grain: 4, paint(u, v0) {
    const hgt = (160 - v0) / 32, v = v0 - 96;
    if (hgt < 1.1) return Math.abs(hgt - 1.08) < 0.03 ? [40, 56, 46] : [70, 98, 80];
    if (hgt > 1.95) return [168, 170, 160];
    let c = [150, 112, 70];
    if ((u | 0) % 4 === 2 && (v | 0) % 4 === 2) c = [70, 50, 30];
    // tools: wrench, hammer, saw
    if (u > 6 && u < 9 && v > 6 && v < 24) c = [180, 184, 190];
    if (u > 4 && u < 11 && v > 5 && v < 8) c = [180, 184, 190];
    if (u > 22 && u < 25 && v > 10 && v < 26) c = [120, 80, 40];
    if (u > 18 && u < 29 && v > 7 && v < 11) c = [90, 92, 98];
    if (u > 38 && u < 58 && v > 9 && v < 16 && (v - 9) < (u - 38) * 0.4) c = [196, 200, 206];
    if (u > 54 && u < 60 && v > 7 && v < 17) c = [160, 40, 30];
    return c;
  } },
  BRICK: { w: 64, h: 64, ppmx: 32, ppmy: 32, grain: 10, paint(u, v, { decals }) {
    const row = Math.floor(v / 8), off = row % 2 ? 8 : 0;
    const mortar = (v | 0) % 8 === 0 || ((u + off) | 0) % 16 === 0;
    let c = mortar ? [70, 64, 60] : mul([120, 58, 44], 0.75 + hash(Math.floor((u + off) / 16), row, 5) * 0.4);
    c = mul(c, 0.7); // wet
    if (decals && u > 10 && u < 34 && v > 14 && v < 40) c = mix(c, [200, 190, 160], 0.6); // a flyer
    return c;
  } },
  BENCH: { w: 64, h: 32, ppmx: 32, ppmy: 32, grain: 5, paint(u, v) {
    const hgt = (32 - v) / 32;
    if (hgt > 0.85) return [120, 84, 50];
    if ((u | 0) % 32 < 2) return [60, 44, 30];
    if (hgt > 0.5 && hgt < 0.8) return Math.abs(hgt - 0.65) < 0.02 ? [200, 200, 200] : [96, 70, 44];
    return [80, 58, 38];
  } },
  BENCHTOP: { w: 64, h: 64, ppm: 32, grain: 8, paint(u, v) { return mul([138, 98, 60], 0.8 + vnoise(u / 2, v / 14, 4) * 0.35); } },
  TIRE: { w: 64, h: 32, ppmx: 64, ppmy: 80, grain: 4, paint(u, v) { const k = Math.sin((v / 32) * Math.PI); return mul([34, 34, 36], 0.6 + k * 0.6 + ((u | 0) % 6 < 2 ? 0.1 : 0)); } },
  TIRETOP: { w: 32, h: 32, ppm: 32, grain: 3, paint(u, v) { const d = Math.hypot(u - 16, v - 16); return d < 7 ? [10, 10, 10] : d < 15 ? [40, 40, 42] : [26, 26, 28]; } },
  STAIR: { w: 32, h: 32, ppmx: 32, ppmy: 106, grain: 3, paint(u, v) { return v < 6 ? (((u / 4) | 0) % 2 ? [220, 180, 30] : [20, 20, 20]) : [90, 92, 96]; } },
  STAIRTOP: { w: 16, h: 16, ppm: 32, grain: 3, paint(u, v) { return ((u + v) | 0) % 8 < 2 ? [160, 164, 170] : [110, 114, 120]; } },
  LOFTSIDE: { w: 64, h: 64, ppmx: 32, ppmy: 32, grain: 6, paint(u, v) { const hgt = (64 - v) / 32; if (hgt > 1.65) return [110, 80, 50]; return (u | 0) % 32 < 3 ? [60, 60, 64] : [90, 92, 96]; } },
  PLANKS: { w: 64, h: 64, ppm: 32, grain: 8, paint(u, v) { return (v | 0) % 8 === 0 ? [60, 40, 24] : mul([128, 90, 56], 0.8 + vnoise(u / 12, Math.floor(v / 8), 2) * 0.3); } },
  SOFA: { w: 32, h: 32, ppmx: 32, ppmy: 40, grain: 6, paint(u, v) { return v < 6 ? [70, 100, 60] : [56, 82, 48]; } },
  SOFATOP: { w: 32, h: 32, ppm: 32, grain: 8, paint(u, v) { return (u | 0) % 16 < 1 ? [40, 60, 34] : [66, 96, 56]; } },
  ROLLDOOR: { w: 64, h: 96, ppmx: 32, ppmy: 32, grain: 4, paint(u, v, { decals }) {
    let c = mul([150, 150, 140], 0.75 + 0.25 * Math.abs(Math.sin(v / 6 * Math.PI)));
    if (fbm(u / 4, v / 40, 6) > 0.62) c = mul(c, 0.8); // water runs
    if (decals && v > 60 && fbm(u / 8, v / 8, 9) > 0.6) c = mul(c, [1, 0.7, 0.5]);
    return c;
  } },
  HOMEDOOR: { w: 32, h: 96, ppmx: 32, ppmy: 32, grain: 4, paint(u, v) {
    const hgt = (96 - v) / 32;
    if (hgt > 2.1 || u < 3 || u > 29) return [168, 170, 160];
    if (hgt > 1.5 && hgt < 1.7 && u > 6 && u < 26) return [230, 220, 120];
    if (Math.abs(u - 24) < 2 && Math.abs(hgt - 1.0) < 0.05) return [210, 200, 120];
    return [110, 62, 40];
  } },
  ASPHALT: { w: 64, h: 64, ppm: 32, grain: 10, paint(u, v) { const p = fbm(u / 16, v / 16, 21); return p > 0.6 ? [40, 44, 60] : mul([46, 46, 50], 0.8 + fbm(u / 4, v / 4, 22) * 0.3); } },
  SKY: { w: 64, h: 64, ppm: 8, grain: 2, paint(u, v) { return hash(u | 0, v | 0, 31) > 0.985 ? [140, 150, 170] : [10, 12, 22]; } },
  CAR_W: carSide(false), CAR_E: carSide(true),
  CAR_FRONT: carEnd(false), CAR_REAR: carEnd(true),
  CAR_WSHIELD: glassFace(true), CAR_RWIN: glassFace(false),
  CAR_HOOD: carTop(false), CAR_ROOF: carTop(true),

  // ---------------------------------------------------------- apartment
  WALLPAPER: { w: 32, h: 128, ppmx: 32, ppmy: 32, grain: 4, paint(u, v, { decals }) {
    const hgt = (128 - v) / 32;
    if (hgt < 0.4 && hgt > 0.3) return [90, 60, 36];
    let c = [196, 178, 140];
    const du = Math.abs(((u + 8) % 16) - 8), dv = Math.abs(((v + 8) % 16) - 8);
    if (Math.abs(du + dv - 5) < 0.9) c = [150, 110, 80];
    if (Math.abs(hgt - 2.6) < 0.03) c = [140, 120, 96];
    if (decals && fbm(u / 6, v / 10, 41) > 0.68 && hgt > 2) c = mul(c, 0.82); // water stain
    return c;
  } },
  PARQUET: { w: 32, h: 32, ppm: 32, grain: 6, paint(u, v) {
    const block = (Math.floor(u / 8) + Math.floor(v / 8)) % 2;
    const along = block ? u : v;
    if ((along | 0) % 8 === 0) return [70, 44, 24];
    return mul([150, 96, 54], 0.85 + vnoise(block ? v / 2 : u / 2, along / 8, 5) * 0.3);
  } },
  CARPET: { w: 32, h: 32, ppm: 16, grain: 8, paint(u, v) {
    const d = Math.abs(u - 16) + Math.abs(v - 16);
    if (u < 2 || v < 2 || u > 30 || v > 30) return [200, 170, 90];
    if (Math.abs(d - 10) < 1.5 || d < 3) return [210, 180, 100];
    if (Math.abs(d - 18) < 1.2) return [30, 40, 80];
    return [140, 30, 34];
  } },
  TILE: { w: 16, h: 16, ppm: 32, grain: 3, paint(u, v) { return (u | 0) % 8 === 0 || (v | 0) % 8 === 0 ? [150, 160, 166] : [224, 230, 232]; } },
  TILEWALL: { w: 16, h: 96, ppmx: 32, ppmy: 32, grain: 3, paint(u, v) {
    const hgt = (96 - v) / 32;
    const seam = (u | 0) % 8 === 0 || (v | 0) % 8 === 0;
    if (hgt > 1.8) return [226, 228, 224];
    return seam ? [90, 120, 150] : [120, 170, 210];
  } },
  KTILE: { w: 16, h: 16, ppm: 32, grain: 4, paint(u, v) { return (Math.floor(u / 8) + Math.floor(v / 8)) % 2 ? [36, 36, 40] : [214, 210, 200]; } },
  KWALL: { w: 32, h: 96, ppmx: 32, ppmy: 32, grain: 4, paint(u, v) {
    const hgt = (96 - v) / 32;
    if (hgt > 1.2 && hgt < 1.8) return ((u | 0) % 6 === 0 || (v | 0) % 6 === 0) ? [170, 170, 160] : [236, 236, 224];
    return [214, 204, 150];
  } },
  PLASTER: { w: 32, h: 32, ppm: 16, grain: 4, paint(u, v) { return mul([214, 214, 206], 0.92 + fbm(u / 10, v / 10, 51) * 0.1); } },
  WINDOW: { w: 64, h: 96, ppmx: 32, ppmy: 32, grain: 3, paint(u, v) {
    const hgt = (96 - v) / 32, dx = (u - 32) / 32;
    if (Math.abs(dx) > 0.82 || hgt < 1.0 || hgt > 2.35) return TEXTURE_DEFS.WALLPAPER.paint(u % 32, (v + 32) % 128, {});
    if (Math.abs(dx) > 0.76 || hgt < 1.06 || hgt > 2.29 || Math.abs(dx) < 0.03 || Math.abs(hgt - 1.85) < 0.03) return [226, 226, 220];
    // night city: blocks of houses with lit windows
    const bx = Math.floor((u + 3) / 9), top = 1.25 + hash(bx, 0, 61) * 0.7;
    if (hgt < top) {
      const lit = hash(Math.floor(u / 2), Math.floor(v / 3), 62) > 0.78;
      return ((u | 0) % 2 === 0 && (v | 0) % 3 === 1 && lit) ? [250, 210, 110] : [18, 20, 34];
    }
    return mix([12, 16, 34], [40, 30, 60], (hgt - top) / 1.2);
  } },
  TV_OFF: { w: 64, h: 96, ppmx: 32, ppmy: 32, grain: 3, paint(u, v) { return tvPaint(u, v, null); } },
  FRIDGE: { w: 32, h: 96, ppmx: 32, ppmy: 32, grain: 3, paint(u, v) { return fridgePaint(u, v, false); } },
  FRIDGE_OPEN: { w: 32, h: 96, ppmx: 32, ppmy: 32, grain: 3, paint(u, v) { return fridgePaint(u, v, true); } },
  FRIDGE_SIDE: { w: 32, h: 96, ppmx: 32, ppmy: 32, grain: 2, paint(u, v) { const hgt = (96 - v) / 32; return hgt > 2.1 ? [214, 204, 150] : [226, 228, 226]; } },
  EXITDOOR: { w: 32, h: 96, ppmx: 32, ppmy: 32, grain: 4, paint(u, v) {
    const hgt = (96 - v) / 32;
    if (hgt > 2.35 || u < 3 || u > 29 || hgt < 0.3) return [214, 204, 150];
    if (hgt > 1.6 && hgt < 1.8 && u > 7 && u < 25) return [240, 200, 60];
    if (Math.abs(u - 25) < 2 && Math.abs(hgt - 1.2) < 0.05) return [220, 220, 200];
    return [96, 60, 40];
  } },
  MIRROR: { w: 32, h: 96, ppmx: 32, ppmy: 32, grain: 2, paint(u, v) {
    const hgt = (96 - v) / 32;
    if (hgt < 1.1 || hgt > 2.1 || u < 3 || u > 29) return TEXTURE_DEFS.TILEWALL.paint(u % 16, v, {});
    if (u < 5 || u > 27 || hgt < 1.15 || hgt > 2.05) return [200, 200, 196];
    return mix([120, 136, 150], [200, 214, 224], Math.abs(((u - v * 0.5) % 24) - 12) < 2 ? 0.6 : 0.1);
  } },
  WOODDOOR: { w: 32, h: 96, ppmx: 32, ppmy: 32, grain: 5, paint(u, v) { const hgt = (96 - v) / 32; if (Math.abs(u - 26) < 2 && Math.abs(hgt - 1.0) < 0.05) return [210, 200, 120]; return (u | 0) % 16 === 0 ? [100, 66, 40] : [150, 104, 64]; } },
  BED: { w: 32, h: 32, ppmx: 32, ppmy: 40, grain: 5, paint(u, v) { return v < 10 ? [180, 60, 60] : [110, 70, 40]; } },
  BEDTOP: { w: 64, h: 64, ppm: 32, grain: 6, paint(u, v) { if (v > 32 && v < 45) return [236, 236, 230]; return ((u / 6 | 0) + (v / 6 | 0)) % 2 ? [190, 70, 70] : [170, 56, 60]; } },
  DESK: { w: 32, h: 40, ppmx: 32, ppmy: 32, grain: 5, paint(u, v) { const hgt = (40 - v) / 32; if (hgt > 1.0) return [120, 84, 54]; if ((u | 0) % 32 > 22 && hgt > 0.4) return [100, 70, 44]; return hgt < 0.36 ? [60, 40, 26] : [80, 58, 38]; } },
  DESKTOP: { w: 32, h: 32, ppm: 32, grain: 6, paint(u, v) { return mul([132, 92, 58], 0.85 + vnoise(u / 2, v / 10, 8) * 0.3); } },
  COUNTER: { w: 32, h: 40, ppmx: 32, ppmy: 32, grain: 4, paint(u, v) { const hgt = (40 - v) / 32; if (hgt > 1.15) return [60, 60, 64]; if ((u | 0) % 16 === 0) return [150, 150, 140]; if (Math.abs((u % 16) - 13) < 1 && hgt > 0.8 && hgt < 0.95) return [80, 80, 80]; return [226, 222, 206]; } },
  COUNTERTOP: { w: 32, h: 32, ppm: 32, grain: 4, paint(u, v) { const d = Math.hypot((u % 16) - 8, (v % 16) - 8); return d < 5 && d > 3 ? [30, 30, 30] : [176, 176, 168]; } },
  // 17.4 liquids: a rain puddle on the street, an oil pool on the garage floor.
  PUDDLE: { w: 64, h: 64, ppm: 32, grain: 3, paint(u, v) { const r = fbm(u / 10, v / 10, 81); return mix([34, 44, 66], [70, 90, 130], r) ; } },
  OILPOOL: { w: 64, h: 64, ppm: 32, grain: 3, paint(u, v) { const r = fbm(u / 8, v / 8, 83); return mix([16, 14, 20], [70, 50, 90], Math.max(0, r - 0.45) * 2); } },
  BATH: { w: 32, h: 32, ppmx: 32, ppmy: 32, grain: 2, paint() { return [236, 238, 236]; } },
  BATHTOP: { w: 32, h: 32, ppm: 32, grain: 4, paint(u, v) { return u < 3 || v < 3 || u > 29 || v > 29 ? [240, 240, 238] : mix([90, 150, 200], [170, 210, 240], vnoise(u / 5, v / 5, 71)); } },
};

// TV wall: cabinet + set; `frame` (when on) is a function giving screen pixels.
function tvPaint(u, v, frame) {
  const hgt = (96 - v) / 32, dx = u < 32 ? u / 32 : (u - 64) / 32;
  if (Math.abs(dx) < 0.7 && hgt > 0.3 && hgt < 0.85) return Math.abs(hgt - 0.55) < 0.02 ? [60, 40, 26] : [110, 76, 46];
  if (Math.abs(dx) < 0.5 && hgt > 0.85 && hgt < 1.55) {
    if (Math.abs(dx) < 0.42 && hgt > 0.92 && hgt < 1.48) return frame ? frame(dx, hgt) : [26, 30, 32];
    return [40, 40, 44];
  }
  return TEXTURE_DEFS.WALLPAPER.paint(u % 32, (v + 32) % 128, {});
}
function fridgePaint(u, v, open) {
  const hgt = (96 - v) / 32;
  if (hgt > 2.1 || u < 2 || u > 30) return [214, 204, 150];
  if (!open) {
    if (Math.abs(hgt - 1.45) < 0.02) return [170, 170, 170];
    if (u > 25 && u < 27 && hgt > 1.0 && hgt < 1.9) return [150, 150, 150];
    return [232, 234, 232];
  }
  if (u < 4 || u > 28 || hgt < 0.36 || hgt > 2.04) return [232, 234, 232];
  if ((Math.abs(hgt - 0.9) < 0.02) || Math.abs(hgt - 1.4) < 0.02) return [200, 220, 230];
  if (hgt > 0.92 && hgt < 1.25 && u > 8 && u < 12) return [244, 244, 255]; // kefir
  if (hgt > 0.92 && hgt < 1.05 && u > 16 && u < 26) return [190, 80, 70]; // sausage
  if (hgt > 1.42 && hgt < 1.6 && u > 14 && u < 20) return [200, 150, 40]; // jar
  return [250, 252, 240];
}

export function tvFrame(time, era) {
  // News, then the weather, then a hockey match; early eras: noise.
  const show = Math.floor(time / 5) % 3;
  return (dx, hgt) => {
    const x = (dx + 0.42) / 0.84, y = (1.48 - hgt) / 0.56;
    if (era <= 0) { const n = hash(Math.floor(x * 30 + time * 60), Math.floor(y * 20), 3) * 200; return [n, n, n]; }
    if (show === 0) return y > 0.75 ? [20, 40, 140] : (Math.abs(x - 0.5) < 0.15 && y > 0.25 ? [200, 160, 130] : [40, 60, 120]);
    if (show === 1) return y < 0.3 ? [120, 180, 250] : (Math.hypot(x - 0.35, y - 0.5) < 0.15 ? [250, 220, 60] : [60, 160, 60]);
    const puck = Math.abs(x - (0.5 + 0.4 * Math.sin(time * 2))) < 0.03 && Math.abs(y - 0.6) < 0.04;
    return puck ? [10, 10, 10] : (Math.abs(x - 0.5) < 0.01 ? [200, 30, 30] : [220, 230, 240]);
  };
}
export function paintTvScreen(tex, time, era, scale = 1) {
  const f = tvFrame(time, era);
  const { w, h, data } = tex;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = (x + 0.5) / scale, v = (y + 0.5) / scale;
    const hgt = (96 - v) / 32, dx = u < 32 ? u / 32 : (u - 64) / 32;
    if (Math.abs(dx) < 0.42 && hgt > 0.92 && hgt < 1.48) {
      const c = f(dx, hgt);
      const scan = (y % 2) ? 0.85 : 1;
      data[y * w + x] = rgb(clamp(c[0] * scan), clamp(c[1] * scan), clamp(c[2] * scan));
    }
  }
}

// ------------------------------------------------------------- sprites
// A sprite is painted on a small grid: rows of chars, palette per char.
function sheet(rows, palette, ppm) {
  const h = rows.length, w = rows[0].length;
  const data = new Uint32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = palette[rows[y][x]];
    data[y * w + x] = c ? rgb(c[0], c[1], c[2]) : 0;
  }
  return { w, h, data, ppm };
}

export function paintLaptop(screen = 'crt-green', on = true, time = 0) {
  const w = 28, h = 20, data = new Uint32Array(w * h);
  const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < w && y < h) data[y * w + x] = rgb(c[0], c[1], c[2]); };
  for (let y = 0; y < 13; y++) for (let x = 3; x < 25; x++) set(x, y, [40, 42, 48]);
  for (let y = 1; y < 12; y++) for (let x = 4; x < 24; x++) {
    let c = [8, 10, 12];
    if (on) {
      const line = (y - 2) % 2 === 0 && x > 5 && x < 6 + ((y * 7 + Math.floor(time * 4)) % 15);
      if (screen === 'crt-green') c = line ? [80, 255, 120] : [6, 30, 12];
      else if (screen === 'crt') c = line ? [250, 220, 120] : [20, 26, 60];
      else c = line ? (x < 9 ? [255, 120, 200] : [140, 230, 255]) : [24, 28, 40];
    }
    set(x, y, c);
  }
  for (let y = 13; y < 20; y++) for (let x = 0; x < 28; x++) {
    const inset = 19 - y;
    if (x < inset * 0.4 || x > 27 - inset * 0.4) continue;
    set(x, y, (x + y) % 3 === 0 && y < 18 ? [80, 82, 88] : [56, 58, 64]);
  }
  return { w, h, data, ppm: 64 };
}

export function paintPc(on = true, era = 2, time = 0) {
  const w = 30, h = 30, data = new Uint32Array(w * h);
  const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < w && y < h) data[y * w + x] = rgb(c[0], c[1], c[2]); };
  const lcd = era >= 4;
  const x0 = lcd ? 2 : 4, x1 = lcd ? 28 : 26, y1 = lcd ? 18 : 21;
  for (let y = 0; y < y1; y++) for (let x = x0; x < x1; x++) set(x, y, lcd ? [26, 26, 30] : [200, 196, 176]);
  for (let y = 2; y < y1 - 3; y++) for (let x = x0 + 2; x < x1 - 2; x++) {
    let c = [10, 12, 14];
    if (on) {
      const t = Math.floor(time * 3);
      if (era <= 1) c = ((y + t) % 3 === 0 && x < x0 + 4 + ((y * 5 + t) % 14)) ? [170, 170, 170] : [0, 0, 160]; // DOS blue
      else if (era <= 3) c = y < 4 ? [0, 0, 128] : (x < x0 + 6 && (y % 3) === 0 ? [250, 250, 250] : [0, 128, 128]); // 95
      else c = (y % 2 === 0 && x < x0 + 4 + ((y * 7 + t) % 18)) ? [140, 230, 255] : [26, 32, 48];
    }
    set(x, y, c);
  }
  for (let y = y1; y < y1 + 3; y++) for (let x = 12; x < 18; x++) set(x, y, lcd ? [40, 40, 44] : [180, 176, 156]);
  for (let y = y1 + 3; y < 30; y++) for (let x = 6; x < 24; x++) set(x, y, (x + y) % 2 ? [180, 176, 156] : [160, 156, 140]);
  return { w, h, data, ppm: 46 };
}

export const SPRITES = {
  worklamp: sheet([
    '..YYYYYY..', '.YWWWWWWY.', '.YWWWWWWY.', '..YYYYYY..', '....KK....', '....KK....', '....KK....', '....KK....',
    '....KK....', '....KK....', '....KK....', '....KK....', '....KK....', '....KK....', '...K..K...', '..K....K..', '.K......K.', 'K........K',
  ], { Y: [220, 180, 40], W: [255, 250, 220], K: [40, 40, 44] }, 11),
  switchOn: sheet(['WWWWW', 'W...W', 'W.K.W', 'W.K.W', 'W...W', 'W...W', 'WWWWW'].map((r) => r.replace(/\./g, 'G')), { W: [230, 228, 220], G: [210, 208, 200], K: [60, 60, 60] }, 70),
  switchOff: sheet(['WWWWW', 'W...W', 'W...W', 'W.K.W', 'W.K.W', 'W...W', 'WWWWW'].map((r) => r.replace(/\./g, 'G')), { W: [230, 228, 220], G: [210, 208, 200], K: [60, 60, 60] }, 70),
  toilet: sheet([
    '..WWWWWWW...', '..WGGGGGW...', '..WWWWWWW...', '...WWWWW....', 'WWWWWWWWWWW.', 'WGGGGGGGGGW.', '.WWWWWWWWW..', '..WWWWWWW...', '...WWWWW....', '...WWWWW....', '..WWWWWWW...',
  ], { W: [236, 238, 236], G: [200, 210, 214] }, 15),
  radio: sheet([
    '....KKKKKK....', 'KKKKKKKKKKKKKK', 'KSSKKRRKKKKSSK', 'SSSSKGGGGKSSSS', 'SKKSKGGGGKSKKS', 'SSSSKKKKKKSSSS', 'KSSKKKKKKKKSSK',
  ], { K: [30, 30, 34], S: [90, 92, 100], R: [220, 40, 40], G: [80, 220, 120] }, 32),
  cat0: sheet([
    'K.K...........', 'KKK...........', 'KYK.......K...', 'KKKKKKKKKK.K..', '.KKKKKKKKK..K.', '.KKKKKKKKK....', '.K.K....K.K...',
  ], { K: [36, 34, 38], Y: [220, 220, 60] }, 30),
  cat1: sheet([
    'K.K...........', 'KKK......K....', 'KYK.....K.....', 'KKKKKKKKK.....', '.KKKKKKKKK....', '.KKKKKKKKK....', '.K.K....K.K...',
  ], { K: [36, 34, 38], Y: [220, 220, 60] }, 30),
  // 17.4 · Витя's old AR headset on the workbench: visor, strap, a green eye.
  headset: sheet([
    '...KKKKKKKK...', '..KSSSSSSSSK..', '.KSGGGSSGGGSK.', 'KSSGCGSSGCGSSK', 'KSSGGGSSGGGSSK', '.KSSSSKKSSSSK.', '..KKKK..KKKK..',
  ], { K: [30, 30, 36], S: [96, 100, 112], G: [40, 140, 80], C: [140, 255, 170] }, 40),
  // You, for the mirror: hoodie, jeans, a face that has seen Python errors.
  hero: sheet([
    '.....HHHH.....', '....HHHHHH....', '....HSSSSH....', '....HSESEH....', '....HSSSSH....', '.....SMMS.....', '...HHHHHHHH...', '..HHHHHHHHHH..',
    '..HHHHQQHHHH..', '..HH.HHHH.HH..', '..HH.HHHH.HH..', '..SS.HHHH.SS..', '.....JJJJ.....', '.....JJJJ.....', '.....JJJJ.....', '.....JJ.JJ....',
    '.....JJ.JJ....', '.....JJ.JJ....', '....BBB.BBB...',
  ], { H: [60, 64, 80], S: [222, 180, 150], E: [40, 30, 30], M: [170, 110, 100], Q: [240, 200, 70], J: [50, 70, 120], B: [30, 30, 30] }, 10.5),
};

// Wolfenstein-era textures are half resolution: nearest downsample.
export function downsample(t, k = 2) {
  if (k <= 1) return t;
  const w = Math.max(2, Math.floor(t.w / k)), h = Math.max(2, Math.floor(t.h / k));
  const data = new Uint32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data[y * w + x] = t.data[(y * k) * t.w + x * k];
  return { ...t, w, h, data, ppm: t.ppm / k, ppmx: t.ppmx / k, ppmy: t.ppmy / k };
}

// Build every texture for one era. Detail scale: Wolf 0.5, Doom/Duke/Quake 1,
// Unreal/HL 2; HL adds decals.
export function buildTextures(era = 2, names = Object.keys(TEXTURE_DEFS)) {
  const scale = era <= 0 ? 0.5 : era >= 4 ? 2 : 1;
  const decals = era >= 5;
  const out = {};
  for (const n of names) out[n] = makeTexture(TEXTURE_DEFS[n], { scale, decals, era });
  return out;
}

// 17.4: textures for a rung of the engine ladder: detail scale and decals
// come from the features on (engine-ladder.js textureScale / decals).
export function buildTexturesWith({ scale = 1, decals = false, era = 2 } = {}, names = Object.keys(TEXTURE_DEFS)) {
  const out = {};
  for (const n of names) out[n] = makeTexture(TEXTURE_DEFS[n], { scale, decals, era });
  return out;
}
