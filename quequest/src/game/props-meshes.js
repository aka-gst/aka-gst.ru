// 17.4 · Real 3D props for the polygon tiers of the engine ladder: the blue
// car, the laptop and the PC with their live screens, hanging lamps, the
// ceiling fan, barrels, the radio, the toilet, the hall's crates -- and the
// cat, built from parts (body, head, ears, four legs, a tail in segments).
// With "animProps" on, the parts move like a skeleton: each joint is a
// rotation applied to everything after it in the chain (the tail), the fan's
// blades turn, the cat breathes and turns its head toward you.
//
// Pure: no DOM. A prop is a list of parts { tex, data:number[] } in world
// space, in the vertex layout of mesh-builder.js.
import { STRIDE, MAT } from './mesh-builder.js';

const rgb = (r, g, b) => [r / 255, g / 255, b / 255];
const BLUE = rgb(44, 96, 206), BLUE_D = rgb(22, 46, 110), RUBBER = rgb(22, 22, 24), CHROME = rgb(176, 180, 188);

// A tiny mesh writer: triangles with flat normals, in a local frame that
// is moved by `xf` (a function point -> point, normal -> normal).
function writer(tex = null) {
  const data = [];
  const part = { tex, data };
  part.tri = (a, b, c, alb, mat = MAT.lit, uv = [[0, 0], [1, 0], [1, 1]]) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    [a, b, c].forEach((p, i) => {
      data.push(p[0], p[1], p[2], uv[i][0], uv[i][1], nx, ny, nz, -1, -1, 1, 1, 1, alb[0], alb[1], alb[2], mat, 0, 0);
    });
  };
  // Quad a b c d (counter-clockwise seen from outside).
  part.quad = (a, b, c, d, alb, mat = MAT.lit, uv = [[0, 1], [1, 1], [1, 0], [0, 0]]) => {
    part.tri(a, b, c, alb, mat, [uv[0], uv[1], uv[2]]);
    part.tri(a, c, d, alb, mat, [uv[0], uv[2], uv[3]]);
  };
  part.box = (x0, y0, z0, x1, y1, z1, alb, mat = MAT.lit, { top = alb, uvFace = null } = {}) => {
    const P = (x, y, z) => [x, y, z];
    part.quad(P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1), alb, mat, uvFace?.s);
    part.quad(P(x1, y0, z0), P(x0, y0, z0), P(x0, y1, z0), P(x1, y1, z0), alb, mat, uvFace?.n);
    part.quad(P(x1, y0, z1), P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), alb, mat, uvFace?.e);
    part.quad(P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0), alb, mat, uvFace?.w);
    part.quad(P(x0, y1, z1), P(x1, y1, z1), P(x1, y1, z0), P(x0, y1, z0), top, mat, uvFace?.t);
    part.quad(P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1), alb, mat);
  };
  // Cylinder along an axis ('x' | 'y' | 'z'), centre c, radius r, length h.
  part.cyl = (c, axis, r, h, segs, alb, mat = MAT.lit, { caps = true, capAlb = alb, r2 = r } = {}) => {
    const at = (a, rr, t) => {
      const u = Math.cos(a) * rr, v = Math.sin(a) * rr, w = (t - 0.5) * h;
      if (axis === 'x') return [c[0] + w, c[1] + u, c[2] + v];
      if (axis === 'z') return [c[0] + u, c[1] + v, c[2] + w];
      return [c[0] + u, c[1] + w, c[2] + v];
    };
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2, a1 = ((i + 1) / segs) * Math.PI * 2;
      const flip = axis === 'y';
      if (flip) part.quad(at(a0, r, 0), at(a1, r, 0), at(a1, r2, 1), at(a0, r2, 1), alb, mat);
      else part.quad(at(a1, r, 0), at(a0, r, 0), at(a0, r2, 1), at(a1, r2, 1), alb, mat);
      if (caps) {
        const c0 = at(0, 0, 0), c1 = at(0, 0, 1);
        if (flip) { part.tri(c0, at(a1, r, 0), at(a0, r, 0), capAlb, mat); part.tri(c1, at(a0, r2, 1), at(a1, r2, 1), capAlb, mat); }
        else { part.tri(c0, at(a0, r, 0), at(a1, r, 0), capAlb, mat); part.tri(c1, at(a1, r2, 1), at(a0, r2, 1), capAlb, mat); }
      }
    }
  };
  return part;
}

// Move a part: rotate around Y by yaw about (px, pz), then translate.
function place(part, { x = 0, y = 0, z = 0, yaw = 0, pivot = [0, 0, 0] } = {}) {
  const d = part.data, c = Math.cos(yaw), s = Math.sin(yaw);
  for (let i = 0; i < d.length; i += STRIDE) {
    const lx = d[i] - pivot[0], lz = d[i + 2] - pivot[2];
    d[i] = pivot[0] + lx * c - lz * s + x; d[i + 1] += y; d[i + 2] = pivot[2] + lx * s + lz * c + z;
    const nx = d[i + 5], nz = d[i + 7];
    d[i + 5] = nx * c - nz * s; d[i + 7] = nx * s + nz * c;
  }
  return part;
}
// Rotate a part about an arbitrary axis through a pivot (Rodrigues).
function rotate(part, axis, angle, pivot) {
  const [ax, ay, az] = axis; const c = Math.cos(angle), s = Math.sin(angle), t = 1 - c;
  const R = [t * ax * ax + c, t * ax * ay - s * az, t * ax * az + s * ay, t * ax * ay + s * az, t * ay * ay + c, t * ay * az - s * ax, t * ax * az - s * ay, t * ay * az + s * ax, t * az * az + c];
  const d = part.data;
  for (let i = 0; i < d.length; i += STRIDE) {
    for (const [o, isN] of [[0, false], [5, true]]) {
      const x = d[i + o] - (isN ? 0 : pivot[0]), y = d[i + o + 1] - (isN ? 0 : pivot[1]), z = d[i + o + 2] - (isN ? 0 : pivot[2]);
      d[i + o] = R[0] * x + R[1] * y + R[2] * z + (isN ? 0 : pivot[0]);
      d[i + o + 1] = R[3] * x + R[4] * y + R[5] * z + (isN ? 0 : pivot[1]);
      d[i + o + 2] = R[6] * x + R[7] * y + R[8] * z + (isN ? 0 : pivot[2]);
    }
  }
  return part;
}

// ------------------------------------------------------------------ car
// The car stands in cells x 5..7, z 4..9, nose toward -z. Profile heights
// match the cells you can climb (hood 0.95, roof 1.45, trunk 1.0).
export function carMesh({ glass = false } = {}) {
  const body = writer(), cabin = writer(), wheels = writer(), lights = writer();
  const X0 = 5.06, X1 = 6.94;
  const prof = [[4.02, 0.26], [4.02, 0.7], [4.35, 0.9], [6.0, 0.97], [8.1, 1.0], [8.92, 0.98], [8.98, 0.7], [8.98, 0.26]];
  // Sides (convex profile -> fan), then the skin across.
  for (const [x, sgn] of [[X0, -1], [X1, 1]]) {
    for (let i = 1; i + 1 < prof.length; i++) {
      const a = [x, prof[0][1], prof[0][0]], b = [x, prof[i][1], prof[i][0]], c = [x, prof[i + 1][1], prof[i + 1][0]];
      if (sgn > 0) body.tri(a, b, c, BLUE, MAT.paint); else body.tri(a, c, b, BLUE, MAT.paint);
    }
  }
  for (let i = 0; i < prof.length; i++) {
    const [z0, y0] = prof[i], [z1, y1] = prof[(i + 1) % prof.length];
    body.quad([X1, y0, z0], [X0, y0, z0], [X0, y1, z1], [X1, y1, z1], i === prof.length - 1 ? RUBBER : BLUE, i === prof.length - 1 ? MAT.lit : MAT.paint);
  }
  // Belt-line chrome strip.
  body.box(X0 - 0.01, 0.76, 4.4, X0, 0.79, 8.8, CHROME); body.box(X1, 0.76, 4.4, X1 + 0.01, 0.79, 8.8, CHROME);
  // Cabin: windshield, roof, rear window, side glass.
  const C0 = 5.22, C1 = 6.78;
  const cp = [[6.0, 0.97], [6.5, 1.44], [7.7, 1.46], [8.1, 1.0]];
  const glassAlb = glass ? rgb(60, 90, 120) : rgb(26, 40, 58), glassMat = glass ? MAT.carglass : MAT.lit;
  cabin.quad([C1, cp[0][1], cp[0][0]], [C0, cp[0][1], cp[0][0]], [C0, cp[1][1], cp[1][0]], [C1, cp[1][1], cp[1][0]], glassAlb, glassMat);
  cabin.quad([C1, cp[1][1], cp[1][0]], [C0, cp[1][1], cp[1][0]], [C0, cp[2][1], cp[2][0]], [C1, cp[2][1], cp[2][0]], BLUE, MAT.paint);
  cabin.quad([C1, cp[2][1], cp[2][0]], [C0, cp[2][1], cp[2][0]], [C0, cp[3][1], cp[3][0]], [C1, cp[3][1], cp[3][0]], glassAlb, glassMat);
  for (const [x, sgn] of [[C0, -1], [C1, 1]]) {
    const a = [x, cp[0][1], cp[0][0]], b = [x, cp[1][1], cp[1][0]], c = [x, cp[2][1], cp[2][0]], d = [x, cp[3][1], cp[3][0]];
    if (sgn > 0) { cabin.tri(a, b, c, glassAlb, glassMat); cabin.tri(a, c, d, glassAlb, glassMat); } else { cabin.tri(a, c, b, glassAlb, glassMat); cabin.tri(a, d, c, glassAlb, glassMat); }
  }
  // Pillars between the windows.
  for (const x of [C0 - 0.005, C1 - 0.035]) cabin.box(x, 0.97, 6.98, x + 0.04, 1.45, 7.04, BLUE_D);
  // Wheels: 12-sided tyres with a chrome hub.
  for (const z of [4.85, 8.1]) for (const x of [X0 + 0.06, X1 - 0.06]) {
    wheels.cyl([x, 0.32, z], 'x', 0.32, 0.24, 12, RUBBER, MAT.lit, { capAlb: rgb(40, 40, 44) });
    wheels.cyl([x + (x < 6 ? -0.125 : 0.125), 0.32, z], 'x', 0.15, 0.02, 8, CHROME);
  }
  // Bumpers and lights.
  body.box(X0 + 0.02, 0.26, 3.94, X1 - 0.02, 0.42, 4.04, rgb(30, 30, 34));
  body.box(X0 + 0.02, 0.26, 8.96, X1 - 0.02, 0.42, 9.06, rgb(30, 30, 34));
  for (const x of [5.25, 6.45]) lights.box(x, 0.54, 3.99, x + 0.3, 0.66, 4.04, rgb(255, 236, 170), MAT.emissive);
  for (const x of [5.2, 6.55]) lights.box(x, 0.62, 8.96, x + 0.25, 0.76, 9.01, rgb(230, 30, 30), MAT.emissive);
  lights.box(5.85, 0.33, 9.02, 6.15, 0.43, 9.04, rgb(236, 236, 220)); // number plate
  return [body, cabin, wheels, lights];
}

// --------------------------------------------------------------- things
export function laptopMesh(x, y, z, screenTex, { facing = Math.PI / 2 } = {}) {
  const base = writer(), screen = writer(screenTex);
  base.box(-0.17, 0, -0.12, 0.17, 0.02, 0.12, rgb(54, 56, 62));
  base.box(-0.15, 0.02, -0.04, 0.15, 0.022, 0.1, rgb(30, 30, 34)); // keys
  // Lid hinged at the back edge, open 105°.
  const lid = writer();
  lid.box(-0.17, 0, -0.012, 0.17, 0.23, 0.0, rgb(54, 56, 62));
  rotate(lid, [1, 0, 0], -0.25, [0, 0, 0]);
  screen.quad([-0.155, 0.012, 0.002], [0.155, 0.012, 0.002], [0.155, 0.218, 0.002], [-0.155, 0.218, 0.002], [1, 1, 1], MAT.emissive, [[0, 1], [1, 1], [1, 0], [0, 0]]);
  rotate(screen, [1, 0, 0], -0.25, [0, 0, 0]);
  for (const p of [lid, screen]) place(p, { z: -0.115, y: 0.02 });
  return [base, lid, screen].map((p) => place(p, { x, y, z, yaw: facing - Math.PI / 2 + Math.PI }));
}

export function pcMesh(x, y, z, screenTex) {
  const body = writer(), screen = writer(screenTex);
  body.box(-0.24, 0, -0.18, 0.24, 0.05, 0.02, rgb(200, 196, 180)); // stand
  body.box(-0.06, 0.05, -0.12, 0.06, 0.12, -0.02, rgb(190, 186, 170));
  body.box(-0.27, 0.12, -0.2, 0.27, 0.52, 0.03, rgb(206, 202, 186)); // CRT-ish monitor
  screen.quad([-0.22, 0.16, 0.031], [0.22, 0.16, 0.031], [0.22, 0.49, 0.031], [-0.22, 0.49, 0.031], [1, 1, 1], MAT.emissive, [[0, 1], [1, 1], [1, 0], [0, 0]]);
  body.box(0.34, -0.0, -0.22, 0.52, 0.42, 0.18, rgb(196, 192, 176)); // tower
  body.box(0.36, 0.3, 0.18, 0.5, 0.34, 0.185, rgb(60, 60, 60));
  body.box(-0.22, 0, 0.08, 0.22, 0.02, 0.24, rgb(210, 206, 190)); // keyboard
  return [body, screen].map((p) => place(p, { x, y, z }));
}

export function lampMesh(x, ceil, z, bottom, { lit = true, fan = 0, blades = false } = {}) {
  const shade = writer(), bulb = writer();
  const cordTop = ceil, shadeY = bottom;
  shade.box(x - 0.012, shadeY + 0.22, z - 0.012, x + 0.012, cordTop, z + 0.012, rgb(30, 30, 30));
  shade.cyl([x, shadeY + 0.12, z], 'y', 0.26, 0.2, 10, rgb(60, 70, 64), MAT.lit, { caps: false, r2: 0.08 });
  bulb.cyl([x, shadeY + 0.05, z], 'y', 0.07, 0.1, 8, lit ? rgb(255, 240, 200) : rgb(120, 116, 100), lit ? MAT.emissive : MAT.lit);
  const out = [shade, bulb];
  if (blades) {
    const fanPart = writer();
    fanPart.cyl([x, shadeY + 0.3, z], 'y', 0.12, 0.08, 10, rgb(150, 110, 70));
    for (let i = 0; i < 4; i++) {
      const b = writer();
      b.box(0.1, -0.008, -0.07, 0.75, 0.008, 0.07, rgb(150, 110, 70));
      rotate(b, [1, 0, 0], 0.12, [0, 0, 0]);
      place(b, { x, y: shadeY + 0.3, z, yaw: fan + (i * Math.PI) / 2 });
      out.push(b);
    }
    out.push(fanPart);
  }
  return out;
}

export function barrelMesh(x, z, { h = 0.9, r = 0.3 } = {}) {
  const p = writer();
  p.cyl([x, h / 2, z], 'y', r, h, 12, rgb(96, 64, 40), MAT.lit, { capAlb: rgb(60, 44, 30) });
  for (const y of [0.18, h - 0.18]) p.cyl([x, y, z], 'y', r + 0.012, 0.05, 12, rgb(60, 60, 64), MAT.lit, { caps: false });
  return [p];
}

export function radioMesh(x, y, z) {
  const p = writer();
  p.box(x - 0.22, y, z - 0.07, x + 0.22, y + 0.16, z + 0.07, rgb(34, 34, 38));
  for (const dx of [-0.13, 0.13]) p.cyl([x + dx, y + 0.08, z + 0.075], 'z', 0.06, 0.01, 10, rgb(90, 92, 100));
  p.box(x - 0.04, y + 0.06, z + 0.07, x + 0.04, y + 0.11, z + 0.075, rgb(80, 220, 120), MAT.emissive);
  return [p];
}

export function toiletMesh(x, y, z) {
  const p = writer();
  const W = rgb(236, 238, 236);
  p.cyl([x, y + 0.2, z + 0.05], 'y', 0.2, 0.4, 12, W, MAT.lit, { r2: 0.17 });
  p.cyl([x, y + 0.41, z + 0.05], 'y', 0.21, 0.03, 12, rgb(220, 224, 226));
  p.box(x - 0.2, y + 0.4, z - 0.32, x + 0.2, y + 0.78, z - 0.14, W);
  return [p];
}

export function crateMesh(x, z, y, tex, { size = 0.8, yaw = 0 } = {}) {
  const p = writer(tex);
  const h = size / 2;
  const uv = { s: [[0, 1], [1, 1], [1, 0], [0, 0]] };
  p.box(-h, 0, -h, h, size, h, [1, 1, 1], MAT.lit, { uvFace: { s: uv.s, n: uv.s, e: uv.s, w: uv.s, t: uv.s } });
  return [place(p, { x, y, z, yaw })];
}

// The cat: a chain of parts. pose: { t (seconds), breathe, look (yaw of the
// head relative to the body), tail (amplitude) } -- static without animProps.
export function catMesh(x, y, z, { t = 0, animate = false, lookAt = null, facing = -Math.PI / 2 } = {}) {
  const K = rgb(40, 38, 44), EYE = rgb(220, 220, 60), PINK = rgb(200, 120, 130);
  const breathe = animate ? 1 + Math.sin(t * 2.4) * 0.04 : 1;
  const body = writer(), head = writer(), tail = [];
  body.box(-0.2, 0.08, -0.09 * breathe, 0.2, 0.08 + 0.17 * breathe, 0.09 * breathe, K);
  for (const [lx, lz] of [[-0.15, -0.06], [-0.15, 0.06], [0.15, -0.06], [0.15, 0.06]]) body.box(lx - 0.025, 0, lz - 0.025, lx + 0.025, 0.1, lz + 0.025, K);
  // Head (nose toward +x in the cat's own frame).
  head.box(-0.07, -0.07, -0.08, 0.08, 0.07, 0.08, K);
  head.tri([-0.03, 0.06, -0.07], [0.04, 0.06, -0.07], [0.0, 0.14, -0.06], K);
  head.tri([-0.03, 0.06, 0.07], [0.0, 0.14, 0.06], [0.04, 0.06, 0.07], K);
  head.box(0.081, 0.01, -0.05, 0.083, 0.035, -0.02, EYE, MAT.emissive);
  head.box(0.081, 0.01, 0.02, 0.083, 0.035, 0.05, EYE, MAT.emissive);
  head.box(0.081, -0.03, -0.012, 0.086, -0.01, 0.012, PINK);
  let headYaw = 0;
  if (animate && lookAt) {
    // Turn toward the player, but only so far (a neck joint with limits).
    const want = Math.atan2(-(lookAt.z - z), lookAt.x - x) - (-facing + Math.PI / 2 - Math.PI / 2);
    headYaw = Math.max(-0.9, Math.min(0.9, Math.atan2(Math.sin(want), Math.cos(want))));
  }
  rotate(head, [0, 1, 0], headYaw + (animate ? Math.sin(t * 0.7) * 0.15 : 0), [0, 0, 0]);
  place(head, { x: 0.26, y: 0.25 * breathe });
  // Tail: five segments, each rotated relative to its parent.
  let px = -0.2, py = 0.2, angle = 0.9;
  for (let i = 0; i < 5; i++) {
    const seg = writer();
    const sway = animate ? Math.sin(t * 2.2 - i * 0.6) * 0.35 * (i + 1) / 5 : 0.1 * i;
    seg.box(-0.07, -0.016, -0.016, 0.0, 0.016, 0.016, K);
    rotate(seg, [0, 0, 1], -angle, [0, 0, 0]);
    rotate(seg, [0, 1, 0], sway, [0, 0, 0]);
    place(seg, { x: px, y: py });
    const dx = -Math.cos(angle) * 0.07 * Math.cos(sway), dy = Math.sin(angle) * 0.07;
    px += dx; py += dy; angle -= 0.18;
    tail.push(seg);
  }
  return [body, head, ...tail].map((p) => place(p, { x, y, z, yaw: facing }));
}

// A door slab on hinges: closed spans the cell's x0..x1 at z, opens by angle.
export function doorMesh(x0, x1, z, y0, h, angle, tex = null) {
  const p = writer(tex);
  const w = x1 - x0;
  const uvF = [[0, 1], [1, 1], [1, 0], [0, 0]];
  p.box(0, 0, -0.03, w, h, 0.03, [1, 1, 1], MAT.lit, { uvFace: { s: uvF, n: uvF } });
  rotate(p, [0, 1, 0], angle, [0, 0, 0]);
  return [place(p, { x: x0, y: y0, z })];
}

export function workLampMesh(x, z) {
  const p = writer(), bulb = writer();
  p.cyl([x, 0.02, z], 'y', 0.16, 0.04, 10, rgb(40, 40, 44));
  p.box(x - 0.015, 0.04, z - 0.015, x + 0.015, 1.3, z + 0.015, rgb(40, 40, 44));
  p.cyl([x, 1.36, z], 'y', 0.16, 0.14, 10, rgb(220, 180, 40), MAT.lit, { caps: false, r2: 0.06 });
  bulb.cyl([x, 1.31, z], 'y', 0.06, 0.06, 8, rgb(255, 246, 220), MAT.emissive);
  return [p, bulb];
}

// A box whose front carries a picture (Sanya's lock board, his cabinet):
// facing is the front's normal, [1,0,0] or [0,0,1]; bottom-centre at x,y,z.
export function panelMesh(x, y, z, img, { facing = [0, 0, 1], depth = 0.1 } = {}) {
  const ppm = img?.ppm || 40;
  const w = (img?.w ?? 20) / ppm, h = (img?.h ?? 20) / ppm;
  const body = writer(), front = writer(img);
  const SIDE = rgb(40, 42, 46);
  // local frame: front at +z, width along x
  body.box(-w / 2, 0, -depth, w / 2, h, 0, SIDE);
  front.quad([-w / 2, 0, 0.004], [w / 2, 0, 0.004], [w / 2, h, 0.004], [-w / 2, h, 0.004], [1, 1, 1], MAT.lit, [[0, 1], [1, 1], [1, 0], [0, 0]]);
  const yaw = facing[0] > 0.5 ? -Math.PI / 2 : facing[0] < -0.5 ? Math.PI / 2 : facing[2] < -0.5 ? Math.PI : 0;
  // the picture's anchor is its front centre, so pull the box back from it
  return [body, front].map((p) => place(p, { x, y, z, yaw }));
}

export function propStats(parts) {
  let verts = 0;
  for (const p of parts) verts += p.data.length / STRIDE;
  return { parts: parts.length, verts, tris: verts / 3 };
}

export { writer, place, rotate };
