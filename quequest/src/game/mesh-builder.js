// 17.4 · From cells to polygons. The Quake tier of the engine ladder
// (engine-ladder.js) stops casting rays through the grid and builds the level
// as real geometry, once: a floor quad and a ceiling quad per open cell, a
// wall quad wherever a neighbour is solid, a riser where the next floor is
// higher (steps, the car's hood, the loft), a lintel where the next ceiling
// is lower (doors, girders). Texture coordinates follow the raycaster's own
// conventions, so a wall looks the same in both renderers -- only the way it
// is drawn changes.
//
// Pure: no DOM, no GL. tools/mesh-builder.test.mjs counts and bounds it.

// Vertex layout shared by gl-renderer.js and soft-raster.js.
// pos3 uv2 nrm3 lm2 vlight3 albedo3 mat1 scroll2
export const STRIDE = 19;
export const OFF = Object.freeze({ pos: 0, uv: 3, nrm: 5, lm: 8, vl: 10, alb: 13, mat: 16, scroll: 17 });
export const MAT = Object.freeze({ lit: 0, bright: 1, black: 2, window: 3, water: 4, mirror: 5, carglass: 6, emissive: 7, sprite: 8, decal: 9, liquid: 10, paint: 11 });

// Which textures are special surfaces.
export const SURFACES = Object.freeze({ WINDOW: 'window', MIRROR: 'mirror', BATHTOP: 'water', CAR_WSHIELD: 'carglass', CAR_RWIN: 'carglass' });

// Direction table: dx, dz, the face key the raycaster uses for that look
// direction (faces.n is what you see walking +z), the face's normal (into
// the current cell), its U axis and the raycaster's u at the quad origin.
const DIRS = [
  { dx: 1, dz: 0, face: 'w', n: [-1, 0, 0], U: [0, 0, 1], o: (cx, cz) => [cx + 1, cz], u0: (cx, cz) => cz },
  { dx: -1, dz: 0, face: 'e', n: [1, 0, 0], U: [0, 0, -1], o: (cx, cz) => [cx, cz + 1], u0: (cx, cz) => -(cz + 1) },
  { dx: 0, dz: 1, face: 'n', n: [0, 0, -1], U: [-1, 0, 0], o: (cx, cz) => [cx + 1, cz + 1], u0: (cx, cz) => -(cx + 1) },
  { dx: 0, dz: -1, face: 's', n: [0, 0, 1], U: [1, 0, 0], o: (cx, cz) => [cx, cz], u0: (cx) => cx },
];

function faceTexture(next, face) {
  const fx = next.faces;
  if (fx && face in fx) return fx[face] || next.wall;
  return next.wall;
}

// Options:
//   view(cell) -> cell     a substitute for a cell (the 3D car replaces the
//                          car's cells with floor; hinged doors keep their frame)
//   sky: bool              ceilings textured SKY become holes (the skybox shows)
//   surfaces: bool         windows/mirrors/water/car glass get their materials
// Returns { quads, bounds }.
export function buildLevelQuads(map, { view = (c) => c, sky = false, surfaces = true } = {}) {
  const { w, h } = map;
  const tex = map.textures || {};
  const at = (x, z) => (x < 0 || z < 0 || x >= w || z >= h ? null : view(map.cells[z * w + x]));
  const quads = [];
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  const grow = (p) => { for (let i = 0; i < 3; i++) { if (p[i] < min[i]) min[i] = p[i]; if (p[i] > max[i]) max[i] = p[i]; } };
  const surf = (name) => (surfaces && name && SURFACES[name]) || null;

  for (let cz = 0; cz < h; cz++) for (let cx = 0; cx < w; cx++) {
    const c = at(cx, cz);
    if (!c || c.solid) continue;
    const fl = c.floor, ce = c.ceil;
    const open = ce > fl + 1e-4;
    const cellMat = c.bright ? 'bright' : null;
    // Floor and ceiling.
    if (open && c.ftex) {
      const T = tex[c.ftex];
      const ppm = T?.ppm ?? 32, tw = T?.w ?? 64, th = T?.h ?? 64;
      const sc = c.scroll ? [-c.scroll[0] * ppm / tw, -c.scroll[1] * ppm / th] : null;
      const q = {
        key: `f${cx},${cz}`, kind: 'floor', tex: c.ftex, o: [cx, fl, cz], U: [1, 0, 0], V: [0, 0, 1], n: [0, 1, 0],
        uv: [cx * ppm / tw, cz * ppm / th, (cx + 1) * ppm / tw, (cz + 1) * ppm / th], mat: cellMat ?? surf(c.ftex) ?? (c.liquid ? (c.ftex === 'PUDDLE' && surfaces ? 'puddle' : 'liquid') : 'lit'), scroll: sc, cell: c, dark: Boolean(c.dark),
      };
      quads.push(q); grow(q.o); grow([cx + 1, fl, cz + 1]);
    }
    if (open && c.ctex && !(sky && c.ctex === 'SKY')) {
      const T = tex[c.ctex];
      const ppm = T?.ppm ?? 32, tw = T?.w ?? 64, th = T?.h ?? 64;
      // Wound the other way round so the normal faces down.
      const q = {
        key: `c${cx},${cz}`, kind: 'ceil', tex: c.ctex, o: [cx, ce, cz], U: [0, 0, 1], V: [1, 0, 0], n: [0, -1, 0],
        uv: [cz * ppm / th, cx * ppm / tw, (cz + 1) * ppm / th, (cx + 1) * ppm / tw], swapUV: true, mat: 'lit', cell: c, dark: Boolean(c.dark),
      };
      quads.push(q); grow(q.o); grow([cx + 1, ce, cz + 1]);
    }
    if (!open) continue;
    // Walls toward the four neighbours.
    for (const d of DIRS) {
      const nx = cx + d.dx, nz = cz + d.dz;
      const next = at(nx, nz);
      const [ox, oz] = d.o(cx, cz);
      const u0 = d.u0(cx, cz);
      const wall = (y0, y1, texName, anchor, kind) => {
        if (!(y1 > y0 + 1e-4)) return;
        const T = texName ? tex[texName] : null;
        const ppmx = T?.ppmx ?? 32, ppmy = T?.ppmy ?? 32, tw = T?.w ?? 64, th = T?.h ?? 64;
        const q = {
          key: `${kind}${cx},${cz}${d.face}`, kind, tex: texName ?? null, o: [ox, y0, oz], U: d.U.slice(), V: [0, y1 - y0, 0], n: d.n.slice(),
          // u along U, v (texture row from the top) along V
          uv: [u0 * ppmx / tw, 1 - (y0 - anchor) * ppmy / th, (u0 + 1) * ppmx / tw, 1 - (y1 - anchor) * ppmy / th],
          mat: !texName ? 'black' : (surf(texName) ?? 'lit'), cell: c, dark: Boolean(c.dark),
        };
        quads.push(q); grow(q.o); grow([ox + d.U[0], y1, oz + d.U[2]]);
      };
      if (!next || next.solid) {
        const texName = next ? faceTexture(next, d.face) : null;
        const T = texName ? tex[texName] : null;
        const anchor = next && next.peg === 'top' && T ? ce - T.h / T.ppmy : 0;
        wall(fl, ce, texName, anchor, 'wall');
        continue;
      }
      if (next.floor > fl) {
        const texName = faceTexture(next, d.face);
        const T = texName ? tex[texName] : null;
        const anchor = next.peg === 'top' && T ? next.floor - T.h / T.ppmy : 0;
        wall(fl, Math.min(next.floor, ce), texName, anchor, 'riser');
      }
      if (next.ceil < ce) wall(Math.max(next.ceil, fl), ce, next.upper, next.ceil, 'lintel');
    }
  }
  return { quads, bounds: { min, max } };
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);

// Corners of a quad: o, o+U, o+U+V, o+V.
export function quadCorners(q) {
  const { o, U, V } = q;
  return [o, [o[0] + U[0], o[1] + U[1], o[2] + U[2]], [o[0] + U[0] + V[0], o[1] + U[1] + V[1], o[2] + U[2] + V[2]], [o[0] + V[0], o[1] + V[1], o[2] + V[2]]];
}
export function quadSize(q) { return [len(q.U), len(q.V)]; }

const MAT_CODE = { liquid: MAT.liquid, puddle: MAT.water, paint: MAT.paint, lit: MAT.lit, bright: MAT.bright, black: MAT.black, window: MAT.window, water: MAT.water, mirror: MAT.mirror, carglass: MAT.carglass, emissive: MAT.emissive, decal: MAT.decal };

// Quads -> interleaved triangles. lmRect(q) -> { u0, v0, u1, v1 } in the
// lightmap atlas, or null (the quad then uses its vertex light). vlight(p, n)
// -> [r, g, b]. Returns { data: Float32Array, count (vertices), tris }.
export function quadsToVertices(quads, { lmRect = () => null, vlight = () => [1, 1, 1] } = {}) {
  const data = new Float32Array(quads.length * 6 * STRIDE);
  let k = 0;
  for (const q of quads) {
    const P = quadCorners(q);
    const [u0, v0, u1, v1] = q.uv;
    // (s, t) per corner: s along U, t along V.
    const ST = [[0, 0], [1, 0], [1, 1], [0, 1]];
    const lr = lmRect(q);
    const L = P.map((p) => vlight(p, q.n, q));
    const mat = MAT_CODE[q.mat] ?? 0;
    const alb = q.albedo ?? [1, 1, 1];
    for (const i of [0, 1, 2, 0, 2, 3]) {
      const p = P[i], [s, t] = ST[i];
      data[k] = p[0]; data[k + 1] = p[1]; data[k + 2] = p[2];
      if (q.swapUV) { data[k + 3] = v0 + (v1 - v0) * t; data[k + 4] = u0 + (u1 - u0) * s; } // ceiling: U runs along z
      else { data[k + 3] = u0 + (u1 - u0) * s; data[k + 4] = v0 + (v1 - v0) * t; }
      data[k + 5] = q.n[0]; data[k + 6] = q.n[1]; data[k + 7] = q.n[2];
      if (lr) { data[k + 8] = lr.u0 + (lr.u1 - lr.u0) * s; data[k + 9] = lr.v0 + (lr.v1 - lr.v0) * t; } else { data[k + 8] = -1; data[k + 9] = -1; }
      data[k + 10] = L[i][0]; data[k + 11] = L[i][1]; data[k + 12] = L[i][2];
      data[k + 13] = alb[0]; data[k + 14] = alb[1]; data[k + 15] = alb[2];
      data[k + 16] = mat;
      data[k + 17] = q.scroll ? q.scroll[0] : 0; data[k + 18] = q.scroll ? q.scroll[1] : 0;
      k += STRIDE;
    }
  }
  return { data, count: quads.length * 6, tris: quads.length * 2 };
}

// Mesh statistics (for tests and the debug overlay).
export function meshStats(quads) {
  const byKind = {};
  let area = 0;
  for (const q of quads) { byKind[q.kind] = (byKind[q.kind] ?? 0) + 1; const [a, b] = quadSize(q); area += a * b; }
  return { quads: quads.length, tris: quads.length * 2, byKind, area };
}

export { sub, len };
