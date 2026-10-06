// 19.4 · Руки на заводе (canon §21): two fists at the bottom of the view,
// Doom-style, from the very first frame of Shift 1 and in the hall after it.
//
// handsPose() is pure (tools/fists.test.mjs): given the hands' clock and what
// the body is doing, it says which atlas sprites go where. drawHands() paints
// them with a renderer's blit() plus a small anger glow. The sprites are the
// first-shift atlas's own (Freedoom PUNG frames and the carried crate); the
// left hand is the right one mirrored.

export const SPAWN_MS = 1100;      // rise · clench · knuckle crack
export const CRACK_AT_MS = 560;    // when the crack sound plays
export const PUNCH_MS = 340;
export const GRAB_MS = 320;
export const PLACE_MS = 520;
export const KO_MS = 900;          // the fists fly off as you go down

const FIST = { w: 85, h: 39 };     // punga0
const CARRY = { w: 176, h: 112 };  // carry
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeOut = (k) => 1 - (1 - k) * (1 - k);

export function createHands(now = 0) {
  return { spawnAt: now, punchAt: -1e9, punchSide: 'left', grabAt: -1e9, placeAt: -1e9, koAt: -1e9, cracked: false };
}

// The next punch swings the other fist.
export function swing(hands, now) {
  return { ...hands, punchAt: now, punchSide: hands.punchSide === 'right' ? 'left' : 'right' };
}

export function handsMood({ anger = 0, full = 3 } = {}) {
  const k = clamp01(anger / full);
  return { k, full: k >= 1, tint: k >= 1 ? [1.28, 0.86, 0.74] : null };
}

// The four punch frames of the right arm, relative to the view's centre
// (the 18.2 fight's numbers). A left punch is the same, mirrored.
const PUNCH_FRAMES = [
  { until: 70, name: 'pungb0', w: 231, dx: -110, dy: -39 },
  { until: 160, name: 'pungc0', w: 161, dx: -60, dy: -75 },
  { until: 260, name: 'pungd0', w: 232, dx: -96, dy: -88 },
  { until: PUNCH_MS, name: 'pungc0', w: 161, dx: -60, dy: -75 },
];

// -> { layers: [{ name, x, y, flip, tint }], glow: [{ x, y, r, a }], carrying, busy }
export function handsPose(hands, now, { W = 427, viewH = 208, walkPhase = 0, carrying = false, anger = 0, full = 3, reduceMotion = false, ko = false } = {}) {
  const layers = [];
  const glow = [];
  const mood = handsMood({ anger, full });
  const bobX = reduceMotion ? 0 : Math.cos(walkPhase) * (carrying ? 2 : 4);
  const bobY = reduceMotion ? 0 : Math.abs(Math.sin(walkPhase)) * (carrying ? 2.5 : 4);
  const cx = W / 2;
  // Spawn: up from below, a squeeze inward (the clench), then the crack.
  const ts = now - hands.spawnAt;
  let rise = 0; let squeeze = 0; let jitter = 0;
  if (ts >= 0 && ts < SPAWN_MS) {
    rise = (1 - easeOut(clamp01(ts / 380))) * 28; // the knuckles show from frame one
    if (ts > 380 && ts < 700) squeeze = Math.sin(((ts - 380) / 320) * Math.PI) * 9;
    if (ts > CRACK_AT_MS && ts < 900 && !reduceMotion) jitter = ((Math.floor(ts / 40) % 2) ? 1 : -1) * 1.5;
  }
  // Full anger: the fists keep clenching, a beat a second.
  if (mood.full && !reduceMotion) squeeze += Math.max(0, Math.sin(now / 160)) * 3;
  // Going down: the fists jerk and fall away.
  const tk = now - hands.koAt;
  let fall = 0;
  if (ko || (tk >= 0 && tk < KO_MS)) {
    const k = clamp01(tk / KO_MS);
    fall = k < 0.3 ? 0 : easeOut((k - 0.3) / 0.7) * 130;
    if (k < 0.3 && !reduceMotion) jitter += (Math.floor(tk / 30) % 2 ? 3 : -3);
  }
  const tp = now - hands.placeAt;
  const placing = tp >= 0 && tp < PLACE_MS;
  const tg = now - hands.grabAt;
  const grabbing = carrying && tg >= 0 && tg < GRAB_MS;
  if (carrying || (placing && tp < 300)) {
    // The crate in both hands. Grab: it comes up from below; strain: a
    // tremble; place: it goes down and away, the fists come back after.
    let y = viewH - 88 + bobY * 1.5;
    if (grabbing) y += (1 - easeOut(tg / GRAB_MS)) * 70;
    if (!carrying && placing) y += easeOut(tp / 300) * 90;
    const tremble = reduceMotion ? 0 : ((Math.floor(now / 90) % 3) - 1) * 0.6;
    layers.push({ name: 'carry', x: Math.round(cx - CARRY.w / 2 + bobX + tremble), y: Math.round(y + fall), flip: false, tint: null });
    return { layers, glow, carrying: true, busy: true };
  }
  // Back from placing: the fists rise again.
  if (placing) rise = Math.max(rise, (1 - easeOut(clamp01((tp - 300) / 220))) * 48);
  const baseY = viewH - FIST.h + bobY + rise + fall;
  const gap = 30 - squeeze;
  const idle = {
    right: { name: 'punga0', x: Math.round(cx + gap + bobX + jitter), y: Math.round(baseY), flip: false, tint: mood.tint },
    left: { name: 'punga0', x: Math.round(cx - gap - FIST.w - bobX - jitter), y: Math.round(baseY), flip: true, tint: mood.tint },
  };
  const te = now - hands.punchAt;
  let punching = null;
  if (te >= 0 && te < PUNCH_MS && !ko) {
    const f = PUNCH_FRAMES.find((p) => te < p.until);
    const x = cx + f.dx; const y = viewH + f.dy + bobY * 0.5;
    punching = hands.punchSide === 'left'
      ? { name: f.name, x: Math.round(W - x - f.w), y: Math.round(y), flip: true, tint: mood.tint }
      : { name: f.name, x: Math.round(x), y: Math.round(y), flip: false, tint: mood.tint };
  }
  if (punching) {
    layers.push(hands.punchSide === 'left' ? idle.right : idle.left, punching);
  } else layers.push(idle.left, idle.right);
  if (mood.k > 0) {
    const pulse = mood.full ? 0.75 + 0.25 * Math.sin(now / 140) : 0.6;
    for (const l of layers) glow.push({ x: l.x + (l.name === 'punga0' ? FIST.w / 2 : (l.flip ? 30 : 60)), y: l.y + 14, r: 20 + 22 * mood.k, a: 0.55 * mood.k * pulse });
  }
  return { layers, glow, carrying: false, busy: Boolean(punching) };
}

// Paint the pose: glow first (additive, warm), then the sprites.
export function drawHands(renderer, atlas, pose, { W, viewH, scale = 1 } = {}) {
  if (!renderer || !atlas || !pose) return;
  const buf = renderer.buf;
  for (const g of pose.glow) {
    const gx = g.x * scale, gy = g.y * scale, R = g.r * scale;
    for (let y = Math.max(0, (gy - R) | 0); y < Math.min(viewH, gy + R); y++) {
      for (let x = Math.max(0, (gx - R) | 0); x < Math.min(W, gx + R); x++) {
        const d = Math.hypot(x - gx, y - gy) / R;
        if (d >= 1) continue;
        const a = (1 - d) * (1 - d) * g.a;
        const i = y * W + x; const c = buf[i];
        const r = Math.min(255, (c & 255) + 255 * a) | 0, gg = Math.min(255, ((c >>> 8) & 255) + 90 * a) | 0, b = Math.min(255, ((c >>> 16) & 255) + 30 * a) | 0;
        buf[i] = (0xff000000 | (b << 16) | (gg << 8) | r) >>> 0;
      }
    }
  }
  for (const l of pose.layers) {
    const img = atlas[l.name];
    if (!img) continue;
    renderer.blit(img, Math.round(l.x * scale), Math.round(l.y * scale), { flip: l.flip, tint: l.tint, clipBottom: viewH, scale });
  }
}
