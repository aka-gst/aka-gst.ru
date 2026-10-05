// 17.1 · GARAGE · НОЧНОЙ ШЛЮЗ — the pixel scene. Night garage, rain in the
// window, a work lamp swinging over the blue training car, a bench with the
// phone, the radio module and the antenna lead; one bus cable runs along the
// floor through the gateway box (the player's Python lives there) into the
// car. Everything drawn here is read from simGarage (garage-night.js): a
// packet shatters only because the rule said БЛОК, the alarm screams only
// because a stranger's command really crossed the gateway.
import { rgb } from './raycaster.js';
import { textWidth } from './pixel-font.js';
import { GARAGE, shouldPass } from './garage-night.js';

const W = 320, TOP = 14, BOTTOM = 160, FLOOR = 122, BUS = 142;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, k) => a + (b - a) * k;
const shade = (c, k) => rgb(clamp(((c & 255) * k) | 0, 0, 255), clamp((((c >>> 8) & 255) * k) | 0, 0, 255), clamp((((c >>> 16) & 255) * k) | 0, 0, 255));
// Deterministic noise so shards and rain look random but replay identically.
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export const GC = Object.freeze({
  white: rgb(236, 236, 228), dim: rgb(150, 150, 146), dark: rgb(8, 9, 12),
  gold: rgb(255, 200, 70), red: rgb(240, 58, 44), green: rgb(96, 230, 124), cyan: rgb(110, 236, 255),
  orange: rgb(255, 150, 40), blue: rgb(60, 112, 214), steel: rgb(110, 118, 130),
});
const WHO_COLOR = { owner: GC.green, radio: GC.cyan, stranger: rgb(196, 196, 204), red: GC.red };
const CMD_LABEL = { unlock: 'UNLOCK', start: 'START', lights: 'LIGHTS', volume: 'VOLUME' };

// Emitters on the bench and the routes their packets take to the gateway.
export const GATE = Object.freeze([128, BUS]);
const LOCK = [236, 92];
const ROUTES = {
  app: [[22, 100], [22, BUS], GATE],
  radio: [[48, 96], [48, BUS], GATE],
  air: [[56, 34], [74, 34], [74, BUS], GATE],
};
const TO_CAR = [GATE, [214, BUS], [214, 128], [LOCK[0], 108]];

function along(points, k) {
  let total = 0; const segs = [];
  for (let i = 1; i < points.length; i++) { const d = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]); segs.push(d); total += d; }
  let m = clamp(k, 0, 1) * total;
  for (let i = 0; i < segs.length; i++) {
    if (m <= segs[i]) { const f = segs[i] ? m / segs[i] : 0; return [lerp(points[i][0], points[i + 1][0], f), lerp(points[i][1], points[i + 1][1], f)]; }
    m -= segs[i];
  }
  return points.at(-1);
}

// A soft round glow: tint falling off with distance.
function glow(P, cx, cy, r, col, a) {
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const d = Math.hypot(dx, dy * 1.4) / r;
    if (d < 1) P.tint(cx + dx, cy + dy, 1, 1, col, a * (1 - d) * (1 - d));
  }
}

// A light cone: rows tinted, widening away from the source.
function cone(P, x0, y0, len, spread, dir, col, a) {
  for (let i = 0; i < len; i++) {
    const half = 1 + i * spread, fade = a * (1 - i / len);
    if (dir === 'down') P.tint(x0 - half, y0 + i, half * 2, 1, col, fade);
    else P.tint(x0 - i, y0 - half, 1, half * 2, col, fade);
  }
}

function room(P, sim, time, art) {
  const a = art.atlas;
  // Back wall, roll-up door behind the car, floor with oil stains.
  P.tile(a?.CEMENT6 ?? a?.CEMENT1, 0, TOP, W, FLOOR - TOP, { k: 0.26, scale: 0.6 });
  P.tile(a?.BIGDOOR2, 166, 24, 148, FLOOR - 24, { k: 0.2, scale: 0.6 });
  P.rect(164, 22, 152, 2, rgb(40, 42, 48));
  P.tile(a?.FLOOR0_7 ?? a?.FLOOR0_5, 0, FLOOR, W, BOTTOM - FLOOR, { k: 0.3, scale: 0.55 });
  P.rect(0, FLOOR, W, 1, rgb(54, 56, 62));
  for (const [x, y, r] of [[150, 152, 6], [262, 150, 9], [96, 156, 4]]) for (let i = -r; i <= r; i++) P.rect(x + i, y + ((i * i) % 3 === 0 ? 0 : 1), 1, 1, rgb(10, 11, 14));
  // Window with rain and the occasional lightning.
  const flash = (time % 9.3) < 0.09 || ((time % 9.3) > 0.18 && (time % 9.3) < 0.24);
  P.rect(16, 24, 60, 40, flash ? rgb(150, 160, 200) : rgb(12, 18, 34)); P.box(15, 23, 62, 42, rgb(70, 74, 82)); P.rect(45, 24, 2, 40, rgb(70, 74, 82));
  for (let i = 0; i < 26; i++) {
    const x = 17 + ((i * 37) % 58), y = 24 + ((time * 70 + i * 13) % 40);
    P.rect(x, y, 1, 3, flash ? rgb(230, 235, 255) : rgb(80, 100, 140));
  }
  // Antenna lead: a mast outside with a blinking tip -- the "air" source.
  P.rect(56, 30, 1, 30, rgb(120, 124, 132)); P.rect(53, 34, 7, 1, rgb(120, 124, 132));
  P.disc(56, 29, 1, Math.floor(time * 2) % 2 ? GC.red : shade(GC.red, 0.4));
  P.text(18, 66, 'AIR', GC.dim);
  // Bench: phone (app), radio module, laptop sniffing the bus.
  P.rect(4, 104, 84, 4, rgb(96, 70, 44)); P.rect(4, 108, 84, 2, rgb(60, 42, 26));
  P.rect(8, 110, 3, 12, rgb(60, 42, 26)); P.rect(80, 110, 3, 12, rgb(60, 42, 26));
  P.rect(16, 88, 12, 16, rgb(20, 22, 30)); P.box(16, 88, 12, 16, rgb(130, 134, 150)); P.rect(18, 90, 8, 11, rgb(36, 90, 150));
  P.text(10, 80, 'APP', GC.dim);
  P.rect(36, 94, 24, 10, rgb(34, 30, 30)); P.box(36, 94, 24, 10, rgb(110, 100, 96)); P.disc(42, 99, 2, rgb(70, 64, 60)); P.rect(48, 97, 9, 2, rgb(255, 170, 60));
  P.text(32, 84, 'RADIO', GC.dim);
  P.rect(62, 96, 20, 8, rgb(30, 34, 40)); P.rect(64, 86, 16, 10, rgb(26, 30, 36)); P.rect(65, 87, 14, 8, rgb(12, 40, 48));
  for (let i = 0; i < 3; i++) P.rect(66, 88 + i * 2, 4 + ((Math.floor(time * 6) + i * 5) % 9), 1, GC.cyan);
  // Work lamp on its cord, swinging a little, warm cone over the car.
  const sway = Math.sin(time * 0.9) * 3, lx = 214 + sway, ly = 44;
  P.line(214, TOP, lx, ly - 4, rgb(30, 30, 30));
  P.rect(lx - 3, ly - 4, 7, 4, rgb(70, 66, 60)); P.disc(lx, ly + 1, 2, rgb(255, 236, 170));
  const flicker = 0.13 + 0.03 * Math.sin(time * 17) * Math.sin(time * 3.1);
  cone(P, lx, ly + 3, FLOOR + 14 - ly, 0.85, 'down', [255, 196, 110], flicker);
}

function wheel(P, cx, cy, spin) {
  P.disc(cx, cy, 11, rgb(18, 18, 20)); P.disc(cx, cy, 6, rgb(150, 154, 162)); P.disc(cx, cy, 3, rgb(70, 72, 78));
  for (let i = 0; i < 4; i++) { const a = spin + (i * Math.PI) / 2; P.put(cx + Math.round(Math.cos(a) * 5), cy + Math.round(Math.sin(a) * 5), rgb(40, 40, 44)); }
}

function car(P, sim, time) {
  const t = sim.t;
  const running = Boolean(sim.started);
  const bob = running ? (Math.floor(time * 14) % 2) : 0;
  const alarmOn = sim.alarm !== null && sim.alarm < 2.6;
  const blink = alarmOn && Math.floor(time * 6) % 2 === 0;
  const unlockedBy = sim.unlocked ? (shouldPass(sim.unlocked) ? 'owner' : 'stranger') : null;
  const y = 92 + bob;
  const body = GC.blue, dark = shade(body, 0.62), hi = shade(body, 1.35);
  // Shadow under the car.
  P.tint(178, 142, 128, 6, [0, 0, 0], 0.5);
  // Lower body and cabin.
  P.rect(172, y + 10, 134, 26, body); P.rect(172, y + 30, 134, 6, dark);
  P.rect(176, y + 6, 126, 6, body); P.rect(178, y + 6, 122, 1, hi);
  for (let i = 0; i < 20; i++) P.rect(198 + i, y - 14 + Math.max(0, 20 - i), 1, Math.min(20, i) + 1, body);
  P.rect(218, y - 14, 50, 21, body);
  for (let i = 0; i < 16; i++) P.rect(268 + i, y - 14 + i, 1, 21 - i, body);
  // Windows, dome light when unlocked.
  const glass = unlockedBy ? (unlockedBy === 'owner' ? rgb(110, 92, 50) : rgb(120, 30, 30)) : rgb(26, 38, 58);
  for (let i = 0; i < 16; i++) P.rect(203 + i, y - 10 + Math.max(0, 16 - i), 1, Math.min(16, i), glass);
  P.rect(219, y - 10, 21, 16, glass); P.rect(243, y - 10, 24, 16, glass);
  for (let i = 0; i < 12; i++) P.rect(267 + i, y - 10 + i, 1, 16 - i, glass);
  P.line(222, y - 9, 230, y + 4, shade(glass, 1.8)); P.line(246, y - 9, 252, y + 2, shade(glass, 1.6));
  // Door seams and handle.
  P.rect(241, y - 12, 1, 46, dark); P.rect(216, y + 6, 1, 28, dark); P.rect(268, y + 6, 1, 24, dark);
  P.rect(230, y + 12, 6, 2, rgb(200, 204, 214)); P.rect(256, y + 12, 6, 2, rgb(200, 204, 214));
  P.rect(172, y + 22, 134, 1, hi);
  // Bumpers, headlight (front faces left), tail light.
  P.rect(168, y + 26, 8, 6, rgb(60, 62, 70)); P.rect(302, y + 26, 6, 6, rgb(60, 62, 70));
  const lightsAt = sim.packets.filter((p) => p.verdict === 'pass' && p.cmd === 'lights' && p.atCar <= t).at(-1);
  const lightsFlash = lightsAt && t - lightsAt.atCar < 0.9 && Math.floor((t - lightsAt.atCar) * 6) % 2 === 0;
  const head = running || lightsFlash || blink;
  P.rect(170, y + 12, 6, 6, head ? rgb(255, 250, 210) : rgb(150, 150, 140));
  P.rect(302, y + 12, 4, 6, running || blink ? rgb(255, 50, 40) : rgb(120, 30, 26));
  // Hazards.
  if (blink) { P.rect(176, y + 20, 4, 3, GC.orange); P.rect(296, y + 20, 4, 3, GC.orange); }
  if (head) cone(P, 168, y + 15, 120, 0.32, 'left', [255, 244, 190], blink ? 0.32 : 0.22);
  // Wheels.
  const spin = running ? time * 20 : 0;
  wheel(P, 194, 134 + bob * 0, spin); wheel(P, 284, 134, spin);
  P.rect(180, y + 34, 28, 2, dark); P.rect(270, y + 34, 28, 2, dark);
  // Exhaust when the engine runs.
  if (running) for (let i = 0; i < 6; i++) {
    const u = ((time * 0.9 + i / 6) % 1), px = 308 + u * 14, py = 128 - u * 22;
    P.disc(Math.round(px), Math.round(py), 1 + Math.round(u * 3), shade(rgb(150, 150, 156), 0.9 - u * 0.6));
  }
  // Music notes when the radio really plays.
  const vol = sim.packets.filter((p) => p.verdict === 'pass' && p.cmd === 'volume' && p.atCar <= t).at(-1);
  if (vol && t - vol.atCar < 1.4) for (let i = 0; i < 3; i++) {
    const u = (t - vol.atCar) / 1.4, nx = 238 + i * 9 + Math.sin(u * 6 + i) * 3, ny = y - 18 - u * 16 - i * 3;
    P.rect(nx, ny, 2, 2, GC.cyan); P.rect(nx + 1, ny - 4, 1, 4, GC.cyan);
  }
  // Lock state above the door.
  const [lx, ly] = LOCK;
  const lockCol = unlockedBy === 'stranger' ? GC.red : unlockedBy === 'owner' ? GC.green : GC.white;
  P.rect(lx - 4, ly - 2, 9, 7, lockCol); P.rect(lx, ly, 1, 3, GC.dark);
  if (unlockedBy) { P.rect(lx - 3, ly - 7, 1, 5, lockCol); P.rect(lx - 3, ly - 8, 6, 1, lockCol); }
  else { P.rect(lx - 3, ly - 6, 1, 4, lockCol); P.rect(lx + 3, ly - 6, 1, 4, lockCol); P.rect(lx - 3, ly - 7, 7, 1, lockCol); }
  return { alarmOn, blink };
}

function gateway(P, sim, time, art) {
  const [gx, gy] = GATE, t = sim.t;
  // Bus cable: emitters → gateway → car. Pulses run along it.
  const cable = rgb(46, 52, 62), pulse = shade(GC.cyan, 0.6);
  for (const route of Object.values(ROUTES)) for (let i = 1; i < route.length; i++) P.line(route[i - 1][0], route[i - 1][1], route[i][0], route[i][1], cable);
  for (let i = 1; i < TO_CAR.length; i++) P.line(TO_CAR[i - 1][0], TO_CAR[i - 1][1], TO_CAR[i][0], TO_CAR[i][1], cable);
  for (let i = 0; i < 4; i++) { const [x, y] = along(ROUTES.radio, ((time * 0.35 + i / 4) % 1)); P.put(x, y, pulse); }
  // The box with the player's code in it.
  const recent = sim.packets.filter((p) => p.atGate <= t && t - p.atGate < 0.35).at(-1);
  const lamp = recent ? (recent.verdict === 'pass' ? GC.green : recent.verdict === 'error' ? GC.gold : GC.red) : shade(GC.gold, 0.5 + 0.2 * Math.sin(time * 4));
  P.rect(gx - 14, gy - 12, 28, 18, rgb(28, 32, 40)); P.box(gx - 14, gy - 12, 28, 18, sim.night.ok ? rgb(150, 156, 170) : GC.gold);
  P.rect(gx - 11, gy - 9, 10, 6, rgb(16, 42, 50)); P.text(gx - 11, gy - 9, 'PY', GC.cyan);
  P.disc(gx + 7, gy - 6, 2, lamp);
  if (recent) glow(P, gx, gy - 4, 22, recent.verdict === 'pass' ? [96, 230, 124] : [240, 58, 44], 0.45);
  P.text(gx - 14, gy + 8, 'ШЛЮЗ', GC.gold);
}

function packets(P, sim, time) {
  const t = sim.t;
  for (const p of sim.packets) {
    const col = WHO_COLOR[p.who] ?? GC.white;
    if (t >= p.t && t < p.atGate) {
      const [x, y] = along(ROUTES[p.src] ?? ROUTES.app, (t - p.t) / GARAGE.toGate);
      P.rect(x - 3, y - 2, 7, 5, col); P.box(x - 3, y - 2, 7, 5, shade(col, 0.5));
      if (p.who === 'red' || p.who === 'stranger') P.put(x, y, GC.red);
      if (y > BUS - 3) P.text(Math.round(x - textWidth(CMD_LABEL[p.cmd] ?? p.cmd) / 2), y - 10, CMD_LABEL[p.cmd] ?? p.cmd, shade(col, 0.9));
    } else if (p.verdict === 'pass' && t >= p.atGate && t < p.atCar) {
      const [x, y] = along(TO_CAR, (t - p.atGate) / GARAGE.toCar);
      P.rect(x - 3, y - 2, 7, 5, col);
      if (p.leak) { P.box(x - 5, y - 4, 11, 9, GC.red); }
    } else if (p.verdict !== 'pass' && t >= p.atGate && t < p.atGate + 0.85) {
      // Shatter: shards fly out of the gateway and fall, a ring and a flash.
      const u = t - p.atGate, [gx, gy] = GATE;
      for (let i = 0; i < 18; i++) {
        const ang = -Math.PI * (0.05 + 0.9 * hash(p.id * 13 + i)), sp = 30 + hash(p.id * 7 + i) * 70;
        const x = gx + Math.cos(ang) * sp * u, y = gy - 6 + Math.sin(ang) * sp * u + 120 * u * u;
        const big = i % 4 === 0;
        P.rect(x, y, big ? 3 : 2, big ? 2 : 1 + (i % 2), i % 3 === 0 ? GC.white : shade(col, 1.1 - u));
      }
      if (u < 0.3) { const rr = 4 + u * 60; for (let a = 0; a < 36; a++) { const an = (a / 36) * Math.PI * 2; P.put(gx + Math.cos(an) * rr, gy - 6 + Math.sin(an) * rr * 0.55, shade(p.verdict === 'error' ? GC.gold : GC.red, 1 - u * 2.5)); } }
      if (u < 0.1) { glow(P, gx, gy - 6, 34, [255, 226, 180], 0.55); P.disc(gx, gy - 6, Math.round(9 - u * 50), rgb(255, 244, 214)); }
      const word = p.verdict === 'error' ? 'ОШИБКА' : p.denied ? 'СВОЙ!' : 'БЛОК';
      P.text(gx - textWidth(word) / 2, gy - 26 - u * 14, word, p.denied || p.verdict === 'error' ? GC.gold : GC.red);
    } else if (p.verdict === 'pass' && t >= p.atCar && t < p.atCar + 1.0 && !p.leak) {
      const u = t - p.atCar, word = p.who === 'radio' ? 'МУЗЫКА' : p.cmd === 'start' ? 'ВЛАДЕЛЕЦ ЗАВЁЛ' : 'ВЛАДЕЛЕЦ';
      if (!(p.harmless)) P.text(LOCK[0] - textWidth(word) / 2, LOCK[1] - 22 - u * 8, word, GC.green);
    }
  }
}

// One frame of the garage. Returns the HUD counters for the top bar.
export function paintGarage(P, sim, time, art = {}) {
  const t = sim.t;
  room(P, sim, time, art);
  gateway(P, sim, time, art);
  const { alarmOn, blink } = car(P, sim, time);
  packets(P, sim, time);
  // Red-team phase: the room goes red, a label says whose attack this is.
  if (sim.phase === 'red' && t < sim.night.end) {
    P.tint(0, TOP, W, BOTTOM - TOP, [200, 20, 30], 0.07 + 0.03 * Math.sin(time * 8));
    P.text(160 - textWidth('RED-TEAM · ТВОЙ ШТУРМ') / 2, 27, 'RED-TEAM · ТВОЙ ШТУРМ', GC.red);
  }
  // Alarm: hazards, red pulse, siren rings.
  if (alarmOn) {
    P.tint(0, TOP, W, BOTTOM - TOP, [255, 30, 20], blink ? 0.3 : 0.12);
    for (let r = 0; r < 3; r++) { const rr = ((time * 60 + r * 20) % 60) + 8; for (let a = 0; a < 40; a++) { const an = (a / 40) * Math.PI * 2; P.put(240 + Math.cos(an) * rr, 104 + Math.sin(an) * rr * 0.6, GC.red); } }
    const msg = sim.lastLeak?.cmd === 'start' ? 'УГОН! МОТОР ЗАВЁЛ ЧУЖОЙ' : 'ТРЕВОГА! ОТКРЫЛ ЧУЖОЙ';
    P.text(160 - textWidth(msg, 1) / 2, 38, msg, blink ? GC.white : GC.red);
  }
  // Slow motion: letterbox bars and a label.
  if (sim.slow > 0) {
    const h = Math.round(10 * sim.slow);
    P.rect(0, TOP, W, h, GC.dark); P.rect(0, BOTTOM - h, W, h, GC.dark);
    if (sim.slow > 0.6) P.text(W - 54, TOP + 2, 'ЗАМЕДЛ.', GC.gold);
  }
  // Day banner.
  if (sim.banner) {
    const b = sim.banner, k = clamp(b.k ?? 1, 0, 1);
    P.tint(0, 66, W, 40, [0, 0, 0], 0.62 * k);
    const s = b.title, col = b.ok ? GC.green : GC.red;
    P.text(160 - textWidth(s, 2) / 2, 72, s, col, 2);
    if (b.sub) P.text(160 - textWidth(b.sub) / 2, 92, b.sub, b.ok ? GC.gold : GC.white);
  }
  const hud = [[`СВОИ ${sim.ownerIn}/${sim.ownerTotal}`, sim.denied ? GC.gold : GC.green], [`ЧУЖИЕ ${sim.leaks}`, sim.leaks ? GC.red : GC.dim]];
  if (sim.blocked) hud.push([`БЛОК ${sim.blocked}`, GC.dim]);
  return hud;
}
