// Arm 07 awake, painted at runtime in the same pixel language as the atlas
// (tools/build-first-shift-art.py: aliased shapes, industrial orange, one
// dark outline pass). The atlas only has the dead, slumped arm; the old
// chapters drew the woken arm as grey bars with red circles on a vector
// canvas. These are billboards for the raycaster, like everything else.
import { rgb } from './raycaster.js';

const ARM_O = [226, 128, 30];
const ARM_O_D = [164, 84, 18];
const ARM_O_L = [250, 168, 70];
const STEEL = [150, 156, 164];
const STEEL_D = [104, 110, 118];
const BASE = [60, 64, 70];
const BASE_L = [90, 96, 104];
const BASE_D = [40, 44, 50];
const HAZ = [230, 190, 40];
const CYAN = [110, 240, 255];
const CRATE = [150, 104, 56];
const CRATE_D = [100, 66, 32];

function painter(w, h) {
  const data = new Uint32Array(w * h);
  const put = (x, y, c) => {
    x = Math.round(x); y = Math.round(y);
    if (x >= 0 && y >= 0 && x < w && y < h) data[y * w + x] = rgb(c[0], c[1], c[2]);
  };
  const rect = (x, y, rw, rh, c) => { for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) put(x + i, y + j, c); };
  const ell = (cx, cy, rx, ry, c) => {
    for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) put(cx + x, cy + y, c);
  };
  const poly = (pts, c) => {
    const ys = pts.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [x1, y1] = pts[i]; const [x2, y2] = pts[(i + 1) % pts.length];
        if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.ceil(xs[k]); x <= Math.floor(xs[k + 1]); x++) put(x, y, c);
    }
  };
  // A limb from a to b, `t` thick, with a lit edge and a shaded edge.
  const limb = (a, b, t, light, mid, dark) => {
    const dx = b[0] - a[0], dy = b[1] - a[1]; const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * t / 2, ny = (dx / len) * t / 2;
    poly([[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]], mid);
    poly([[a[0] - nx, a[1] - ny], [b[0] - nx, b[1] - ny], [b[0] - nx * 0.5, b[1] - ny * 0.5], [a[0] - nx * 0.5, a[1] - ny * 0.5]], dark);
    poly([[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] + nx * 0.6, b[1] + ny * 0.6], [a[0] + nx * 0.6, a[1] + ny * 0.6]], light);
  };
  const line = (a, b, c, t = 1) => {
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]));
    for (let i = 0; i <= n; i++) rect(a[0] + ((b[0] - a[0]) * i) / n - (t >> 1), a[1] + ((b[1] - a[1]) * i) / n - (t >> 1), t, t, c);
  };
  const outline = (k = 0.45) => {
    const src = data.slice();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = src[y * w + x];
      if (!c) continue;
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const nx = x + dx, ny = y + dy;
        return nx < 0 || ny < 0 || nx >= w || ny >= h || !src[ny * w + nx];
      });
      if (edge) data[y * w + x] = rgb(((c & 255) * k) | 0, (((c >>> 8) & 255) * k) | 0, (((c >>> 16) & 255) * k) | 0);
    }
  };
  return { data, put, rect, ell, poly, limb, line, outline };
}

const POSES = {
  // shoulder angle from vertical (deg, + leans right), elbow bend, wrist tip.
  idle: { a1: 12, a2: -118, grip: 'open', crate: false },
  reach: { a1: -38, a2: -70, grip: 'open', crate: false },
  lift: { a1: 4, a2: -100, grip: 'closed', crate: true },
  drop: { a1: 34, a2: -128, grip: 'open', crate: false },
};

// One awake arm sprite, 96 x 112 px at 40 px/m (the dead one is 96 x 104).
export function paintArm(pose = 'idle', { led = true } = {}) {
  const P = POSES[pose] ?? POSES.idle;
  const w = 96, h = 112;
  const g = painter(w, h);
  // Base drum, hazard stripes, turntable.
  g.rect(28, 86, 40, 24, BASE); g.rect(28, 86, 40, 4, BASE_L); g.rect(58, 86, 10, 24, BASE_D);
  for (let x = 30; x < 66; x += 6) g.rect(x, 106, 3, 4, HAZ);
  g.ell(48, 84, 18, 6, ARM_O_D); g.ell(48, 82, 16, 5, ARM_O);
  const rad = (d) => (d * Math.PI) / 180;
  const sh = [48, 78];
  const L1 = 44, L2 = 38;
  const el = [sh[0] + Math.sin(rad(P.a1)) * L1, sh[1] - Math.cos(rad(P.a1)) * L1];
  const a2 = P.a1 + 180 + P.a2;
  const wr = [el[0] + Math.sin(rad(a2)) * L2, el[1] - Math.cos(rad(a2)) * L2];
  // Cable loom behind the arm.
  g.line([sh[0] + 6, sh[1] - 2], [el[0] + 4, el[1] + 6], [30, 30, 30], 2);
  g.limb(sh, el, 12, ARM_O_L, ARM_O, ARM_O_D);
  g.ell(el[0], el[1], 8, 8, ARM_O_D); g.ell(el[0], el[1], 5, 5, STEEL_D);
  g.limb(el, wr, 9, ARM_O_L, ARM_O, ARM_O_D);
  g.ell(sh[0], sh[1], 7, 7, ARM_O_D); g.ell(sh[0], sh[1], 4, 4, STEEL_D);
  // Wrist + gripper, pointing along the forearm.
  const fx = Math.sin(rad(a2)), fy = -Math.cos(rad(a2));
  const px = -fy, py = fx;
  g.ell(wr[0], wr[1], 5, 5, STEEL);
  const tip = [wr[0] + fx * 8, wr[1] + fy * 8];
  const spread = P.grip === 'open' ? 6 : 3;
  for (const s of [-1, 1]) {
    const root = [wr[0] + fx * 3 + px * s * 3, wr[1] + fy * 3 + py * s * 3];
    const end = [tip[0] + px * s * spread, tip[1] + py * s * spread];
    g.line(root, end, STEEL_D, 3);
    g.line(end, [end[0] + fx * 4 - px * s * 2, end[1] + fy * 4 - py * s * 2], STEEL_D, 2);
  }
  if (P.crate) {
    const cx = tip[0] + fx * 7, cy = tip[1] + fy * 7;
    g.rect(Math.round(cx - 9), Math.round(cy - 8), 18, 16, CRATE);
    g.rect(Math.round(cx - 9), Math.round(cy - 8), 18, 3, [190, 140, 80]);
    g.line([cx - 8, cy - 6], [cx + 8, cy + 7], CRATE_D, 1);
    g.line([cx + 8, cy - 6], [cx - 8, cy + 7], CRATE_D, 1);
  }
  g.outline();
  // Stencil "07" and the status LED: cyan = awake.
  for (const [dx, dy] of [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2], [0, 3], [2, 3], [0, 4], [1, 4], [2, 4]]) g.put(36 + dx, 94 + dy, [30, 30, 30]);
  for (const [dx, dy] of [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [1, 2], [1, 3], [1, 4]]) g.put(41 + dx, 94 + dy, [30, 30, 30]);
  g.rect(60, 92, 3, 3, led ? CYAN : [30, 80, 90]);
  g.rect(31, 90, 24, 1, led ? CYAN : [30, 80, 90]);
  return { w, h, data: g.data, ppm: 40 };
}

// Every pose x LED blink, built once.
export function buildArmSprites() {
  const out = {};
  for (const pose of Object.keys(POSES)) {
    out[`arm07_${pose}_0`] = paintArm(pose, { led: true });
    out[`arm07_${pose}_1`] = paintArm(pose, { led: false });
  }
  return out;
}

// Which pose for a hauling cycle at progress t (0..1).
export function armPoseAt(t) {
  if (t == null) return 'idle';
  if (t < 0.3) return 'reach';
  if (t < 0.78) return 'lift';
  return 'drop';
}

// A tinted copy of an atlas image (red crates for the condition chapters).
export function tint(img, [kr, kg, kb]) {
  const data = new Uint32Array(img.data.length);
  for (let i = 0; i < data.length; i++) {
    const c = img.data[i];
    const r = Math.min(255, (c & 255) * kr) | 0, gg = Math.min(255, ((c >>> 8) & 255) * kg) | 0, b = Math.min(255, ((c >>> 16) & 255) * kb) | 0;
    data[i] = ((c & 0xff000000) | (b << 16) | (gg << 8) | r) >>> 0;
  }
  return { ...img, data };
}

// The arm's terminal: a steel pedestal with a small screen, cyan once the
// arm is alive. 40 x 56 px at 40 px/m.
export function paintTerminal(awake = false, slotGlow = false) {
  const w = 40, h = 56;
  const g = painter(w, h);
  g.rect(14, 26, 12, 28, BASE); g.rect(14, 26, 3, 28, BASE_L); g.rect(23, 26, 3, 28, BASE_D);
  g.rect(8, 52, 24, 4, BASE_D);
  g.poly([[4, 6], [36, 6], [38, 26], [2, 26]], STEEL_D);
  g.rect(6, 8, 28, 15, [12, 18, 22]);
  const scr = awake ? [60, 200, 220] : [120, 40, 36];
  for (let y = 10; y < 21; y += 3) g.rect(8, y, awake ? 14 + ((y * 7) % 10) : 8, 1, scr);
  g.rect(16, 30, 8, 3, slotGlow ? CYAN : [20, 20, 24]);
  g.outline();
  return { w, h, data: g.data, ppm: 40 };
}

// The green start button lying on the floor (shift 2). 24 x 12 px.
export function paintButton(tried = false) {
  const w = 24, h = 12;
  const g = painter(w, h);
  g.rect(1, 4, 22, 8, [45, 51, 54]); g.rect(1, 4, 22, 1, [120, 129, 133]);
  g.ell(12, 5, 5, 3, tried ? [49, 83, 66] : [66, 183, 106]);
  g.rect(10, 3, 3, 1, tried ? [70, 110, 90] : [170, 255, 190]);
  g.outline();
  return { w, h, data: g.data, ppm: 40 };
}
