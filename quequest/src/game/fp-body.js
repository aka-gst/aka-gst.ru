// A first-person body for the grid worlds (src/game/raycaster.js maps):
// walking with wall slide, stepping up small ledges, jumping, gravity, and
// standing on anything that has a floor height -- crate piles, the belt,
// benches, consoles, racks. Pure, no DOM, so tools/fp-body.test.mjs can drive it.
//
// Сергей 02.10: "вниз посмотреть нельзя и вверх плохо… и прыгать по карте на
// предметы". The map already stores every surface as a cell floor height, so
// jumping onto a crate is just "your feet are higher than its top now".
import { cellAt } from './raycaster.js';

export const BODY = Object.freeze({
  radius: 0.28,
  height: 1.8, // head clearance needed above the feet
  eye: 1.6,
  stepUp: 0.32, // walk up without jumping (the arm's 0.25 plinth, door sills)
  gravity: 22,
  jumpSpeed: 7, // apex = v² / 2g ≈ 1.11 m: onto one crate or the belt, not a rack
});

export const PITCH_LIMIT = (75 * Math.PI) / 180;

export function jumpApex(body = BODY) { return (body.jumpSpeed * body.jumpSpeed) / (2 * body.gravity); }

export function createBody(x, z, y = 0) {
  return { x, z, y, vy: 0, grounded: true, peak: y };
}

// Cells a circle at (x, z) actually touches.
function touched(map, x, z, r) {
  const out = [];
  for (let cz = Math.floor(z - r); cz <= Math.floor(z + r); cz++) {
    for (let cx = Math.floor(x - r); cx <= Math.floor(x + r); cx++) {
      const nx = Math.max(cx, Math.min(x, cx + 1));
      const nz = Math.max(cz, Math.min(z, cz + 1));
      if ((x - nx) ** 2 + (z - nz) ** 2 >= r * r) continue;
      out.push(cellAt(map, cx + 0.5, cz + 0.5));
    }
  }
  return out;
}

// Can a body with its feet at `feet` stand/hang at (x, z)? Walls are solid;
// a cell is a ledge you bump into when its top is above your knees; a low
// ceiling (lintel, girder, the gate) blocks when your head wouldn't fit.
export function openAt(map, x, z, feet, { r = BODY.radius, height = BODY.height, stepUp = BODY.stepUp, circles = [] } = {}) {
  for (const cell of touched(map, x, z, r)) {
    if (!cell || cell.solid) return false;
    if (cell.floor > feet + stepUp) return false;
    if (cell.ceil - Math.max(cell.floor, feet) < height) return false;
  }
  for (const c of circles) {
    if (feet >= (c.top ?? Infinity)) continue;
    if ((x - c.x) ** 2 + (z - c.z) ** 2 < (r + c.r) ** 2) return false;
  }
  return true;
}

// The highest surface under the body that its feet can rest on.
export function groundAt(map, x, z, feet, { r = BODY.radius, stepUp = BODY.stepUp } = {}) {
  let g = 0;
  for (const cell of touched(map, x, z, r)) {
    if (!cell || cell.solid) continue;
    if (cell.floor <= feet + stepUp && cell.floor > g) g = cell.floor;
  }
  return g;
}

export function ceilingAt(map, x, z, { r = BODY.radius } = {}) {
  let c = Infinity;
  for (const cell of touched(map, x, z, r)) if (cell && !cell.solid && cell.ceil < c) c = cell.ceil;
  return c;
}

// Horizontal move, one axis at a time so walls slide. Stepping onto a ledge
// no higher than stepUp lifts the feet straight away (no jump needed).
export function moveBody(map, body, dx, dz, opts = {}) {
  let { x, z } = body;
  if (dx && openAt(map, x + dx, z, body.y, opts)) x += dx;
  if (dz && openAt(map, x, z + dz, body.y, opts)) z += dz;
  const moved = Math.hypot(x - body.x, z - body.z);
  body.x = x; body.z = z;
  if (body.grounded) {
    const g = groundAt(map, x, z, body.y, opts);
    if (g > body.y) body.y = g;
  }
  return moved;
}

export function jump(body, speed = BODY.jumpSpeed) {
  if (!body.grounded) return false;
  body.vy = speed; body.grounded = false; body.peak = body.y;
  return true;
}

// Gravity, ceilings and landing. Returns what happened this step so the view
// can dip the camera and the people in the hall can comment on it.
export function stepBody(map, body, dt, opts = {}) {
  const { gravity = BODY.gravity, height = BODY.height, stepUp = BODY.stepUp } = opts;
  const ground = groundAt(map, body.x, body.z, body.y, opts);
  const out = { landed: false, impact: 0, fall: 0, ground, bonk: false };
  if (body.grounded) {
    if (body.y - ground > 1e-4) {
      // Walked off an edge: a step down snaps, anything taller is a fall.
      if (body.y - ground <= stepUp * 0.5) { body.y = ground; return out; }
      body.grounded = false; body.vy = 0; body.peak = body.y;
    } else { body.y = ground; return out; }
  }
  body.vy -= gravity * dt;
  body.y += body.vy * dt;
  if (body.y > body.peak) body.peak = body.y;
  const ceil = ceilingAt(map, body.x, body.z, opts);
  if (body.y + height > ceil) { body.y = Math.max(ground, ceil - height); if (body.vy > 0) { body.vy = 0; out.bonk = true; } }
  const landOn = groundAt(map, body.x, body.z, Math.max(body.y, ground), opts);
  if (body.vy <= 0 && body.y <= landOn) {
    out.landed = true; out.impact = -body.vy; out.fall = body.peak - landOn; out.ground = landOn;
    body.y = landOn; body.vy = 0; body.grounded = true; body.peak = landOn;
  }
  return out;
}

// Camera dip after a landing: quick down, slower recovery. `k` is 0..1 of the
// dip's life; strength grows with the impact speed, capped.
export function landingDip(impact, k) {
  if (k <= 0 || k >= 1) return 0;
  const strength = Math.min(1, Math.max(0, (impact - 2) / 9));
  const shape = k < 0.25 ? k / 0.25 : 1 - (k - 0.25) / 0.75;
  return strength * shape;
}

export function clampPitch(pitch, limit = PITCH_LIMIT) {
  return Math.max(-limit, Math.min(limit, pitch));
}

// Raycasters can't tilt the camera, they shear it (Doom/Build/Heretic): the
// horizon slides. A true tan() runs off to infinity near ±90°, which is what
// made looking up "плохо": a sliver of ceiling, then nothing. This keeps the
// sheared horizon on (or just past) the screen at the clamp, and reads as
// up/down to the eye.
export function pitchShear(pitch, viewH, limit = PITCH_LIMIT) {
  const k = clampPitch(pitch, limit) / limit; // -1..1
  return Math.sign(k) * Math.pow(Math.abs(k), 0.85) * viewH * 1.05;
}
