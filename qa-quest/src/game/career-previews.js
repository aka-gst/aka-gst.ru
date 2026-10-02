// 16.8 · Live pixel scenes for the seven professions. One scene per
// profession, drawn from its simulation (career-sims.js) into a 320×180 frame
// in the first shift's pixel language: same font, same atlas (crates, arm 07,
// workers, Freedoom walls). Used twice: as the looping demo in the showcase,
// and as the live scene inside a profession, where your choices change it.
import { rgb } from './raycaster.js';
import { drawText, textWidth } from './pixel-font.js';
import { loadAtlas } from './first-shift-atlas.js';
import { SIM_DAY, VEH, SEC, AI, simulateRealm, previewAt, PREVIEW_SCRIPTS } from './career-sims.js';

export const PREVIEW_W = 320;
export const PREVIEW_H = 180;
const W = PREVIEW_W, H = PREVIEW_H;
const TOP = 14, BOTTOM = 160;

const C = {
  white: rgb(236, 236, 228), dim: rgb(150, 150, 146), dark: rgb(8, 9, 12), bar: rgb(14, 15, 19),
  gold: rgb(255, 200, 70), red: rgb(232, 60, 44), green: rgb(96, 224, 124), cyan: rgb(110, 240, 255),
  yellow: rgb(240, 214, 80), orange: rgb(240, 140, 50), blue: rgb(70, 130, 230),
};
const TONE = { bad: C.red, good: C.green, neutral: C.white };
const SHORT = { automation: 'AUTO', vehicle: 'VEH', security: 'SEC', web: 'WEB', ai: 'AI', systems: 'SYS', lowlevel: 'LOW' };

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, k) => a + (b - a) * k;
const shade = (c, k) => rgb(clamp(((c & 255) * k) | 0, 0, 255), clamp((((c >>> 8) & 255) * k) | 0, 0, 255), clamp((((c >>> 16) & 255) * k) | 0, 0, 255));

// -------------------------------------------------------------- painter

function makePainter(buf) {
  const put = (x, y, c) => { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < W && y < H) buf[y * W + x] = c; };
  const rect = (x, y, w, h, c) => {
    const x0 = clamp(Math.round(x), 0, W), x1 = clamp(Math.round(x + w), 0, W);
    const y0 = clamp(Math.round(y), 0, H), y1 = clamp(Math.round(y + h), 0, H);
    if (x1 <= x0) return;
    for (let yy = y0; yy < y1; yy++) buf.fill(c, yy * W + x0, yy * W + x1);
  };
  const box = (x, y, w, h, c) => { rect(x, y, w, 1, c); rect(x, y + h - 1, w, 1, c); rect(x, y, 1, h, c); rect(x + w - 1, y, 1, h, c); };
  const line = (x0, y0, x1, y1, c, dash = 0, phase = 0) => {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy, i = 0;
    for (;;) {
      if (!dash || ((i + phase) % (dash * 2) + dash * 2) % (dash * 2) < dash) put(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
      i++;
    }
  };
  const disc = (cx, cy, r, c) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r + r * 0.5) put(cx + dx, cy + dy, c); };
  const tint = (x, y, w, h, [r, g, b], a) => {
    for (let yy = Math.max(0, y | 0); yy < Math.min(H, (y + h) | 0); yy++) {
      for (let xx = Math.max(0, x | 0); xx < Math.min(W, (x + w) | 0); xx++) {
        const i = yy * W + xx, c = buf[i];
        buf[i] = rgb(((c & 255) * (1 - a) + r * a) | 0, (((c >>> 8) & 255) * (1 - a) + g * a) | 0, (((c >>> 16) & 255) * (1 - a) + b * a) | 0);
      }
    }
  };
  const tile = (tex, x, y, w, h, { ox = 0, oy = 0, k = 1, scale = 1 } = {}) => {
    if (!tex) { rect(x, y, w, h, shade(rgb(60, 60, 64), k)); return; }
    for (let yy = Math.max(0, y | 0); yy < Math.min(H, (y + h) | 0); yy++) {
      const v = ((Math.floor((yy - y + oy) / scale) % tex.h) + tex.h) % tex.h;
      for (let xx = Math.max(0, x | 0); xx < Math.min(W, (x + w) | 0); xx++) {
        const u = ((Math.floor((xx - x + ox) / scale) % tex.w) + tex.w) % tex.w;
        buf[yy * W + xx] = shade(tex.data[v * tex.w + u], k);
      }
    }
  };
  // Sprite blit with alpha test; rot turns it 90° clockwise.
  const blit = (img, x, y, { scale = 1, flip = false, k = 1, rot = false } = {}) => {
    if (!img?.data) return;
    const sw = rot ? img.h : img.w, sh = rot ? img.w : img.h;
    const w = Math.round(sw * scale), h = Math.round(sh * scale);
    for (let j = 0; j < h; j++) {
      const py = Math.round(y) + j; if (py < 0 || py >= H) continue;
      for (let i = 0; i < w; i++) {
        const px = Math.round(x) + i; if (px < 0 || px >= W) continue;
        let su = Math.min(sw - 1, Math.floor(i / scale)); const sv = Math.min(sh - 1, Math.floor(j / scale));
        if (flip) su = sw - 1 - su;
        const c = rot ? img.data[(img.h - 1 - su) * img.w + sv] : img.data[sv * img.w + su];
        if ((c >>> 24) < 128) continue;
        buf[py * W + px] = k === 1 ? c : shade(c, k);
      }
    }
  };
  const text = (x, y, s, c, scale = 1, shadow = rgb(3, 4, 6)) => drawText(buf, W, H, Math.round(x), Math.round(y), s, c, { scale, shadow });
  const ctext = (y, s, c, scale = 1, cx = W / 2) => text(Math.round(cx - textWidth(s, scale) / 2), y, s, c, scale);
  const rtext = (xr, y, s, c, scale = 1) => text(Math.round(xr - textWidth(s, scale)), y, s, c, scale);
  return { put, rect, box, line, disc, tint, tile, blit, text, ctext, rtext };
}

// ------------------------------------------------------------ small art

function crate(P, x, y, { red = false, k = 1 } = {}) {
  const base = red ? rgb(176, 64, 44) : rgb(152, 106, 58), edge = rgb(82, 54, 28), light = red ? rgb(220, 110, 80) : rgb(200, 150, 88);
  P.rect(x, y, 11, 9, shade(base, k)); P.box(x, y, 11, 9, shade(edge, k)); P.rect(x + 1, y + 1, 9, 1, shade(light, k));
  P.line(x + 2, y + 2, x + 8, y + 6, shade(edge, k)); P.line(x + 8, y + 2, x + 2, y + 6, shade(edge, k));
}

// 5×9 pixel person; frame toggles the legs.
function person(P, x, y, body, { head = rgb(226, 188, 150), frame = 0, mark = null } = {}) {
  x = Math.round(x); y = Math.round(y);
  P.rect(x + 1, y, 3, 3, head); P.rect(x, y + 3, 5, 4, body); P.put(x, y + 3, shade(body, 0.7));
  const leg = shade(body, 0.55);
  if (frame) { P.rect(x, y + 7, 2, 2, leg); P.rect(x + 3, y + 7, 2, 1, leg); } else { P.rect(x + 1, y + 7, 1, 2, leg); P.rect(x + 3, y + 7, 1, 2, leg); }
  if (mark) P.text(x - 1, y - 8, mark[0], mark[1]);
}

function cross(P, cx, cy, c, r = 3) { P.line(cx - r, cy - r, cx + r, cy + r, c); P.line(cx - r + 1, cy - r, cx + r + 1, cy + r, c); P.line(cx + r, cy - r, cx - r, cy + r, c); P.line(cx + r + 1, cy - r, cx - r + 1, cy + r, c); }

function stars(P, time, count = 40, maxY = 100) {
  for (let i = 0; i < count; i++) {
    const x = (i * 97 + 13) % W, y = TOP + ((i * 53 + 7) % (maxY - TOP));
    const tw = 0.55 + 0.45 * Math.sin(time * 1.3 + i * 2.1);
    P.put(x, y, shade(rgb(220, 230, 255), tw));
  }
}

// -------------------------------------------------------- AUTO · line

function paintAutomation(P, sim, time, art) {
  const t = sim.t, a = art.atlas;
  P.tile(a?.CEMENT1, 0, TOP, W, 110, { k: 0.4 });
  P.tile(a?.FLOOR0_5, 0, 124, W, BOTTOM - 124, { k: 0.42, scale: 0.75 });
  P.tile(a?.PIPES, 0, TOP, 28, 90, { k: 0.5, scale: 0.7 });
  const beltY = 104, slot = (i) => 214 - 13 * i;
  const left = slot(sim.cap - 1) - 16, right = 248;
  if (sim.buffer) {
    P.tile(a?.RACK, left, 60, 222 - left, 42, { k: 0.62, scale: 0.34 });
    P.text(left + 2, 52, 'БУФЕР', C.gold);
  }
  // Belt, moving right.
  P.tile(a?.BELT_TOP, left, beltY, right - left, 8, { ox: -Math.floor(time * 30), k: 0.9, scale: 0.5 });
  P.tile(a?.BELT_SIDE, left, beltY + 8, right - left, 7, { k: 0.75, scale: 0.4 });
  P.rect(left - 3, beltY - 1, 3, 17, C.red);
  // Chute the bursts drop out of.
  const chuteX = left + 2;
  P.rect(chuteX - 4, TOP, 19, 26, rgb(22, 22, 26)); P.box(chuteX - 4, TOP, 19, 26, rgb(92, 92, 98));
  P.tile(a?.HAZARD, chuteX - 4, TOP + 22, 19, 4, { k: 0.9, scale: 0.25 });
  // Stations: arm 07, and the second worker when there is one.
  const busy = (st) => sim.crates.some((c) => c.station === st && c.start <= t && t < c.end);
  P.blit(a?.[`arm07_${busy(0) ? Math.floor(time * 7) % 2 : 0}`], 222, 52, { scale: 0.5 });
  if (sim.worker) {
    P.rect(222, beltY + 24, 26, 3, rgb(110, 110, 116)); P.rect(224, beltY + 27, 2, 10, rgb(70, 70, 74)); P.rect(244, beltY + 27, 2, 10, rgb(70, 70, 74));
    P.blit(a?.[`fitter_work${busy(1) ? [0, 1, 2, 1][Math.floor(time * 7) % 4] : 0}_r6`], 244, beltY - 6, { scale: 0.42 });
    P.text(196, 150, 'РАБОЧИЙ 2', C.gold);
  }
  // 17.0 · day 2's new part: the robot packer, a third station.
  const st = (i) => (i === 0 ? [230, beltY - 9] : i === 1 ? [228, beltY + 15] : [196, beltY + 15]);
  if (sim.robot) {
    P.rect(188, beltY + 24, 26, 3, rgb(110, 110, 116)); P.rect(190, beltY + 27, 2, 10, rgb(70, 70, 74)); P.rect(210, beltY + 27, 2, 10, rgb(70, 70, 74));
    if (art.robot) P.blit(art.robot, 170, beltY + 9 - (busy(2) ? Math.floor(time * 7) % 2 : 0), { scale: 0.1 });
    else P.rect(172, beltY + 12, 12, 14, C.gold);
    P.text(152, 150, 'РОБОТ', C.gold);
  }
  // Pallet of finished work.
  P.rect(272, 128, 40, 4, rgb(120, 86, 48)); P.rect(274, 132, 3, 3, rgb(90, 62, 34)); P.rect(306, 132, 3, 3, rgb(90, 62, 34));
  const onPallet = sim.crates.filter((c) => c.end !== undefined && t >= c.end + 0.35).length;
  for (let i = 0; i < Math.min(onPallet, 15); i++) crate(P, 273 + (i % 3) * 12, 119 - Math.floor(i / 3) * 9);
  if (sim.drop) { P.rect(left - 30, 128, 20, 14, rgb(120, 30, 24)); P.box(left - 30, 128, 20, 14, rgb(200, 60, 40)); P.text(left - 34, 146, 'СБРОС', C.red); }
  // Crates.
  for (const c of sim.crates) {
    if (t < c.arrive - 0.35) continue;
    if (t < c.arrive) { crate(P, chuteX, lerp(TOP + 4, beltY - 9, (t - (c.arrive - 0.35)) / 0.35)); continue; }
    if (c.lost !== undefined) {
      const u = t - c.lost; if (u > 0.9) continue;
      crate(P, chuteX - 8 - u * 14, beltY - 9 + u * u * 110, { red: true });
      P.text(left - 12, beltY - 22 - u * 18, '-1', C.red);
      continue;
    }
    if (c.dropped !== undefined) {
      const u = t - c.dropped; if (u > 0.5) continue;
      crate(P, lerp(chuteX, left - 26, u / 0.5), beltY - 9 - Math.sin((u / 0.5) * Math.PI) * 18 + (u / 0.5) * 30, { red: true });
      continue;
    }
    if (t < c.start) {
      const ahead = sim.crates.filter((d) => d.queued !== undefined && d.start > t && (d.queued < c.queued || (d.queued === c.queued && d.id < c.id))).length;
      crate(P, lerp(chuteX, slot(ahead), clamp((t - c.arrive) / 0.3, 0, 1)), beltY - 9);
      continue;
    }
    const [sx, sy] = st(c.station);
    if (t < c.end) { crate(P, sx, sy); continue; }
    const u = t - c.end;
    if (u < 0.35) crate(P, lerp(sx, 285, u / 0.35), lerp(sy, 110, u / 0.35));
  }
  return [[`ГОТОВО ${sim.served}`, C.white], [`ПОТЕРИ ${sim.lost}`, sim.lost ? C.red : C.dim], ...(sim.drop ? [[`В МУСОР ${sim.dropped}`, C.red]] : [])];
}

// ------------------------------------------------------ VEH · garage

function along(points, k) {
  const segs = []; let total = 0;
  for (let i = 1; i < points.length; i++) { const d = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]); segs.push(d); total += d; }
  let m = clamp(k, 0, 1) * total;
  for (let i = 0; i < segs.length; i++) {
    if (m <= segs[i]) { const f = segs[i] ? m / segs[i] : 0; return [lerp(points[i][0], points[i + 1][0], f), lerp(points[i][1], points[i + 1][1], f)]; }
    m -= segs[i];
  }
  return points.at(-1);
}

function paintVehicle(P, sim, time, art) {
  const t = sim.t, a = art.atlas;
  P.tile(a?.FLOOR0_7 ?? a?.FLOOR0_5, 0, TOP, W, BOTTOM - TOP, { k: 0.38, scale: 0.8 });
  for (const x of [150, 290]) P.rect(x, 50, 2, 90, rgb(200, 180, 60));
  // Phone app, service cloud, the car with its gateway and door lock.
  const phone = [30, 72], cloud = [104, 34], gate = [196, 104], lock = [230, 86];
  P.rect(22, 58, 16, 26, rgb(20, 22, 30)); P.box(22, 58, 16, 26, rgb(120, 124, 140)); P.rect(24, 61, 12, 18, rgb(40, 90, 150));
  P.text(8, 88, 'ПРИЛОЖЕНИЕ', C.dim);
  for (const [dx, dy, r] of [[-10, 2, 7], [0, -2, 9], [11, 2, 7], [3, 5, 7]]) P.disc(cloud[0] + dx, cloud[1] + dy, r, rgb(190, 196, 210));
  P.ctext(cloud[1] - 2, 'СЕРВИС', rgb(40, 44, 60), 1, cloud[0]);
  if (art.car) P.blit(art.car, 164, 64, { scale: 0.78, rot: true });
  else { P.rect(164, 64, 102, 55, C.blue); }
  P.rect(gate[0] - 9, gate[1] - 5, 18, 10, rgb(30, 34, 44)); P.box(gate[0] - 9, gate[1] - 5, 18, 10, sim.fixed ? C.green : rgb(150, 150, 160));
  P.ctext(gate[1] + 8, 'ШЛЮЗ', sim.gateway ? C.gold : C.dim, 1, gate[0]);
  P.rect(lock[0] - 4, lock[1] - 4, 8, 8, rgb(230, 230, 230)); P.rect(lock[0] - 2, lock[1] - 7, 4, 3, rgb(230, 230, 230)); P.rect(lock[0] - 1, lock[1] - 1, 2, 3, rgb(30, 30, 30));
  // What you inspected.
  if (sim.owner) { P.box(18, 54, 24, 34, C.green); P.text(4, 96, 'КЛЮЧ: ЕСТЬ', C.green); }
  if (sim.gateway) P.text(150, 124, sim.fixed ? 'ЖДЁТ КЛЮЧ ВЛАДЕЛЬЦА' : 'ПУСКАЕТ БЕЗ КЛЮЧА!', sim.fixed ? C.green : C.red);
  if (sim.radio) for (let i = 0; i < 3; i++) { const x = 250 + i * 9, y = 60 - ((time * 12 + i * 5) % 16); P.rect(x, y, 2, 5, C.cyan); P.rect(x + 2, y, 2, 1, C.cyan); }
  // Route and packets.
  const route1 = [phone, cloud, gate], route2 = [gate, lock];
  for (let i = 0; i < 2; i++) P.line(route1[i][0], route1[i][1], route1[i + 1][0], route1[i + 1][1], rgb(70, 80, 100), 2, Math.floor(time * 8));
  P.line(gate[0], gate[1], lock[0], lock[1], rgb(70, 80, 100), 2, Math.floor(time * 8));
  let alarm = false;
  for (const p of sim.packets) {
    const col = p.kind === 'owner' ? C.green : rgb(170, 170, 180);
    if (t >= p.t0 && t < p.atGate) {
      const [x, y] = along(route1, (t - p.t0) / VEH.toGateway); P.rect(x - 2, y - 2, 5, 5, col); if (p.kind !== 'owner') P.put(x, y, C.red);
    } else if (p.rejected && t >= p.atGate && t < p.atGate + 0.7) {
      cross(P, gate[0], gate[1] - 12, C.red, 3); P.text(gate[0] - 20, gate[1] - 26, 'ОТКАЗ', C.red);
    } else if (p.atLock !== undefined && t >= p.atGate && t < p.atLock) {
      const [x, y] = along(route2, (t - p.atGate) / VEH.toLock); P.rect(x - 2, y - 2, 5, 5, col);
    } else if (p.atLock !== undefined && t >= p.atLock && t < p.atLock + 0.9) {
      if (p.kind === 'stranger') { alarm = true; } else P.text(lock[0] - 22, lock[1] - 18, 'ВЛАДЕЛЕЦ', C.green);
    }
  }
  if (alarm) { P.tint(164, 64, 102, 55, [230, 40, 30], 0.35); P.ctext(46, 'ОТКРЫТО ЧУЖИМ!', C.red, 1, 214); }
  return [[`ЧУЖИХ ОТКРЫТИЙ ${sim.breaches}`, sim.breaches ? C.red : C.dim]];
}

// ------------------------------------------------- SEC · own server

function paintSecurity(P, sim, time, art) {
  const t = sim.t, a = art.atlas;
  for (let y = TOP; y < 112; y++) P.rect(0, y, W, 1, rgb(8 + ((y - TOP) / 6) | 0, 10 + ((y - TOP) / 5) | 0, 28 + ((y - TOP) / 3) | 0));
  stars(P, time, 46, 100); P.disc(40, 32, 7, rgb(230, 230, 210)); P.disc(43, 30, 6, rgb(18, 22, 44));
  P.rect(0, 112, W, BOTTOM - 112, rgb(24, 32, 26));
  const main = [[40, 122], [150, 122], [266, 122]], bypass = [[50, 124], [72, 148], [236, 148], [262, 126]];
  P.rect(40, 121, 228, 3, rgb(70, 62, 48));
  for (let i = 1; i < bypass.length; i++) P.line(bypass[i - 1][0], bypass[i - 1][1], bypass[i][0], bypass[i][1], rgb(90, 78, 60), 2, 0);
  P.text(92, 151, 'ОБХОД', rgb(120, 104, 80));
  // Client house, the gate wall, the server rack.
  P.rect(12, 104, 26, 18, rgb(60, 54, 70)); P.line(10, 104, 25, 94, rgb(90, 80, 96)); P.line(25, 94, 40, 104, rgb(90, 80, 96)); P.rect(20, 110, 6, 5, C.yellow);
  P.tile(a?.SUPPORT2 ?? a?.CEMENT3, 146, 70, 8, 44, { k: 0.55, scale: 0.5 }); P.rect(146, 124, 8, 8, rgb(60, 60, 64));
  if (sim.roles) { P.rect(132, 60, 36, 9, rgb(40, 60, 110)); P.ctext(61, 'РОЛИ', C.cyan, 1, 150); }
  const test = along(bypass, 0.55);
  if (sim.negative) { P.rect(test[0] - 7, test[1] - 12, 14, 10, rgb(30, 70, 50)); P.box(test[0] - 7, test[1] - 12, 14, 10, C.green); P.ctext(test[1] - 21, 'ТЕСТ', C.green, 1, test[0]); }
  const off = sim.shutdown;
  P.rect(266, 62, 30, 60, rgb(30, 32, 40)); P.box(266, 62, 30, 60, rgb(110, 114, 128));
  for (let r = 0; r < 6; r++) {
    P.rect(269, 66 + r * 9, 24, 6, rgb(18, 20, 26));
    if (!off) P.rect(271 + ((r * 7 + Math.floor(time * 3)) % 3) * 6, 68 + r * 9, 3, 2, (r + Math.floor(time * 2)) % 3 ? C.green : C.cyan);
  }
  P.ctext(52, off ? 'ВЫКЛЮЧЕН' : 'СЕРВЕР', off ? C.red : C.dim, 1, 281);
  let breach = false;
  for (const ac of sim.actors) {
    const hostile = ac.kind !== 'player';
    const body = hostile ? rgb(200, 44, 40) : rgb(70, 190, 110), head = hostile ? rgb(120, 20, 20) : rgb(226, 188, 150);
    const pathPts = ac.path === 'bypass' ? bypass : main;
    const dur = ac.path === 'bypass' ? SEC.bypassToServer : SEC.toGate + SEC.gateToServer;
    const end = ac.stoppedAt ?? ac.atServer;
    if (t < ac.t0) continue;
    if (t < end) {
      const k = ac.path === 'bypass' ? (t - ac.t0) / dur : (t - ac.t0 <= SEC.toGate ? (t - ac.t0) / SEC.toGate * 0.5 : 0.5 + (t - ac.t0 - SEC.toGate) / SEC.gateToServer * 0.5);
      const [x, y] = along(pathPts, k); person(P, x - 2, y - 10, body, { head, frame: Math.floor(time * 8 + ac.id) % 2 });
    } else if (ac.stoppedAt !== undefined && t < ac.stoppedAt + 0.8) {
      const k = ac.stop === 'test' ? 0.55 : ac.stop === 'gate' ? 0.47 : 1;
      const [x, y] = along(pathPts, k); person(P, x - 2, y - 10, shade(body, 0.6), { head }); cross(P, x, y - 16, ac.kind === 'player' ? C.orange : C.red, 2);
    } else if (ac.atServer !== undefined && !ac.bounced && t < ac.atServer + 0.8) {
      if (hostile) breach = true; else P.text(272, 128, '+1', C.green);
    }
  }
  if (breach) { P.tint(262, 58, 38, 68, [230, 30, 20], 0.4); P.ctext(40, 'ВЗЛОМ!', C.red, 1, 281); }
  return [[`ВЗЛОМОВ ${sim.breaches}`, sim.breaches ? C.red : C.dim], ...(sim.shutdown ? [[`СВОИХ НЕ ПУСТИЛИ ${sim.refused}`, C.red]] : [[`ИГРОКОВ ${sim.served}`, C.green]])];
}

// --------------------------------------------------- WEB · micro-service

function paintWeb(P, sim, time, art) {
  const t = sim.t, a = art.atlas;
  for (let y = TOP; y < 132; y++) P.rect(0, y, W, 1, rgb(90 + ((y - TOP) / 3) | 0, 140 + ((y - TOP) / 4) | 0, 190));
  P.tile(a?.CEMENT6 ?? a?.CEMENT1, 168, 36, 144, 96, { k: 0.7, scale: 0.6 });
  P.rect(168, 36, 144, 12, rgb(40, 50, 80)); P.ctext(39, 'МИКРО-СЕРВИС', C.gold, 1, 240);
  P.rect(196, 102, 18, 30, rgb(40, 30, 24)); P.rect(198, 104, 14, 28, rgb(70, 52, 36));
  P.rect(262, 104, 30, 18, rgb(30, 40, 60)); P.box(262, 104, 30, 18, rgb(150, 160, 190)); P.ctext(110, 'ЗАКАЗ', C.white, 1, 277);
  P.rect(0, 132, W, BOTTOM - 132, rgb(90, 90, 96)); P.rect(0, 132, W, 1, rgb(140, 140, 146));
  if (sim.cache) { P.rect(176, 64, 30, 30, rgb(20, 40, 50)); P.box(176, 64, 30, 30, C.cyan); for (let i = 0; i < 3; i++) P.rect(180 + i * 8, 70, 6, 8, shade(C.cyan, 0.6 + 0.4 * Math.sin(time * 2 + i))); P.ctext(84, 'КЭШ', C.cyan, 1, 191); }
  if (sim.queue) { for (let i = 0; i < 4; i++) P.rect(226 + i * 10, 124, 1, 8, C.gold); P.line(226, 125, 256, 125, C.gold); P.text(222, 114, 'ОЧЕРЕДЬ', C.gold); }
  if (sim.banner) { const hue = Math.floor(time * 2) % 3; P.rect(212, 50, 90, 12, [C.red, C.gold, C.cyan][hue]); P.ctext(53, 'СКИДКИ!!!', C.dark, 1, 257); }
  const door = 202, orderX = 258, walk = 2.4;
  const waitingReads = sim.users.filter((u) => u.kind === 'read' && t >= u.arrive && ((u.start !== undefined && t < u.start) || (u.left !== undefined && t < u.left)));
  const waitingOrders = sim.users.filter((u) => u.kind === 'order' && u.start !== undefined && t >= u.arrive && t < u.start);
  for (const u of sim.users) {
    const body = u.kind === 'order' ? rgb(200, 150, 60) : rgb(80, 120, 200);
    const target = u.kind === 'order' ? orderX : door;
    const frame = Math.floor(time * 8 + u.id) % 2;
    if (t < u.arrive - walk) continue;
    if (t < u.arrive) { const k = (t - (u.arrive - walk)) / walk; person(P, lerp(-8, target - 12, k), 122, body, { frame }); continue; }
    if (u.left !== undefined && t >= u.left) { const k = (t - u.left) / 1.4; if (k < 1) person(P, lerp(door - 12, -10, k), 122, shade(body, 0.8), { frame, mark: ['!', C.red] }); continue; }
    if (u.dropped !== undefined) { const k = (t - u.dropped) / 1.4; if (k < 1) { person(P, lerp(orderX - 12, -10, k), 122, shade(body, 0.8), { frame, mark: ['X', C.red] }); } continue; }
    if (u.start !== undefined && t < u.start) {
      const line = u.kind === 'order' ? waitingOrders : waitingReads, idx = line.indexOf(u);
      person(P, (u.kind === 'order' ? orderX : door) - 12 - idx * 7, 122, body); continue;
    }
    if (u.done !== undefined && t < u.done) continue; // inside
    if (u.done !== undefined) { const k = (t - u.done) / 1.2; if (k < 1) person(P, lerp(target + 6, W + 8, k), 122, body, { frame, mark: u.kind === 'order' ? ['₽', C.gold] : ['+', C.green] }); }
  }
  const load = waitingReads.length;
  P.rect(172, 124 - Math.min(20, load * 3), 4, Math.min(20, load * 3), load > 3 ? C.red : C.green);
  return [[`₽ ${sim.revenue.toLocaleString('ru-RU')}`, C.gold], [`УШЛИ ${sim.left}`, sim.left ? C.red : C.dim], [`ЗАКАЗОВ ПОТЕРЯНО ${sim.dropped}`, sim.dropped ? C.red : C.dim]];
}

// ----------------------------------------------------------- AI · Q-Bot

function card(P, x, y, kind, { unknown = false } = {}) {
  P.rect(x, y, 20, 24, rgb(236, 232, 220)); P.box(x, y, 20, 24, rgb(120, 116, 104));
  const cx = x + 10, cy = y + 12;
  if (kind === 'cat') { P.disc(cx, cy, 6, rgb(150, 150, 160)); P.line(cx - 6, cy - 3, cx - 4, cy - 9, rgb(150, 150, 160)); P.line(cx - 4, cy - 9, cx - 2, cy - 5, rgb(150, 150, 160)); P.line(cx + 6, cy - 3, cx + 4, cy - 9, rgb(150, 150, 160)); P.line(cx + 4, cy - 9, cx + 2, cy - 5, rgb(150, 150, 160)); }
  if (kind === 'dog') { P.disc(cx, cy, 6, rgb(150, 100, 60)); P.rect(cx - 8, cy - 4, 3, 8, rgb(110, 70, 40)); P.rect(cx + 6, cy - 4, 3, 8, rgb(110, 70, 40)); P.rect(cx - 1, cy + 1, 3, 2, rgb(30, 20, 20)); }
  if (kind === 'fox') { for (let r = 0; r < 9; r++) P.rect(cx - 7 + (r >> 1), cy - 6 + r, 15 - r, 1, rgb(230, 120, 40)); P.rect(cx - 7, cy - 9, 3, 3, rgb(230, 120, 40)); P.rect(cx + 5, cy - 9, 3, 3, rgb(230, 120, 40)); P.rect(cx - 1, cy + 2, 3, 2, rgb(30, 20, 20)); }
  if (kind !== 'fox') { P.put(cx - 2, cy - 1, rgb(20, 20, 20)); P.put(cx + 2, cy - 1, rgb(20, 20, 20)); } else { P.put(cx - 2, cy - 2, rgb(20, 20, 20)); P.put(cx + 2, cy - 2, rgb(20, 20, 20)); }
  if (unknown) P.text(x + 7, y + 25, '?', C.gold);
}

function paintAi(P, sim, time, art) {
  const t = sim.t, a = art.atlas;
  P.tile(a?.SILVER3, 0, TOP, W, 104, { k: 0.4, scale: 0.6 });
  P.rect(0, 118, W, BOTTOM - 118, rgb(40, 36, 44)); P.rect(150, 116, 160, 4, rgb(120, 96, 70)); P.rect(156, 120, 3, 30, rgb(80, 62, 44)); P.rect(300, 120, 3, 30, rgb(80, 62, 44));
  // Q-Bot: the Kenney robot (its face looks right, at the cards), with our
  // antenna and eyes that light up.
  const bob = Math.round(Math.sin(time * 3) * 1), qx = 18, qy = 66 + bob;
  if (art.robot) P.blit(art.robot, qx, qy, { scale: 0.45 });
  else { P.rect(qx, qy, 82, 58, rgb(236, 190, 50)); }
  const eye = sim.answered === 'dontknow' ? C.green : sim.answered ? C.red : C.cyan, look = sim.unknownShown ? 1 : 0;
  P.rect(qx + 53 + look, qy + 25, 3, 3, eye); P.rect(qx + 74 + look, qy + 25, 3, 3, eye);
  P.rect(qx + 62, qy - 10, 2, 10, rgb(150, 110, 20)); P.disc(qx + 63, qy - 11, 2, sim.answered === 'dontknow' ? C.green : sim.answered ? C.red : C.gold);
  if (sim.authority && t >= AI.examplesAt) { P.rect(qx + 44, qy - 4, 36, 4, C.gold); P.ctext(qy - 22, 'ПРАВА+', C.gold, 1, qx + 62); }
  if (sim.abstain && t >= AI.abstainAt) { P.rect(qx + 4, qy + 20, 34, 11, rgb(30, 80, 60)); P.ctext(qy + 22, 'НЕ ЗНАЮ', C.green, 1, qx + 21); }
  // Confidence.
  const conf = sim.confidence;
  const col = conf >= 90 ? C.red : conf >= AI.abstainBelow ? C.yellow : C.green;
  P.rect(16, 22, 80, 6, rgb(30, 30, 36)); P.rect(16, 22, Math.round(80 * conf / 100), 6, col); P.box(16, 22, 80, 6, rgb(90, 90, 100));
  P.text(16, 31, `УВЕРЕН ${conf}%`, col);
  // Cards.
  if (t >= 0.3) card(P, 164, 90, 'cat');
  if (t >= 0.9) card(P, 190, 90, 'cat');
  if (sim.examples && t >= AI.examplesAt) { card(P, 216, 90, 'dog'); P.text(206, 80, 'НЕ КОТ', C.gold); }
  if (sim.unknownShown) card(P, 266, 88, 'fox', { unknown: true });
  if (t < AI.examplesAt) P.text(164, 70, 'ДВА КОТА — И ВСЁ ЯСНО?', C.white);
  if (sim.answered) {
    const say = { dontknow: ['НЕ ЗНАЮ.', 'СПРОШУ ЧЕЛОВЕКА.', C.green], guess: ['ЭТО КОТ.', 'НАВЕРНОЕ.', C.red], acts: ['ЭТО КОТ!', 'ОТКРЫВАЮ ДВЕРЬ.', C.red] }[sim.answered];
    P.rect(84, 40, 110, 24, rgb(236, 236, 228)); P.box(84, 40, 110, 24, say[2]); P.line(84, 56, 74, 66, rgb(236, 236, 228));
    P.text(89, 44, say[0], say[2]); P.text(89, 53, say[1], rgb(40, 40, 50));
    if (sim.answered === 'acts') { P.rect(300, 60, 14, 56, rgb(90, 60, 40)); P.tint(300, 60, 14, 56, [230, 40, 30], 0.3 + 0.2 * Math.sin(time * 4)); }
  }
  return [[`УВЕРЕН ${conf}%`, col], ...(sim.answered ? [[sim.answered === 'dontknow' ? 'ЧЕСТНО' : 'ОШИБСЯ', sim.answered === 'dontknow' ? C.green : C.red]] : [])];
}

// ------------------------------------------------------ SYS · city graph

function paintSystems(P, sim, time) {
  P.rect(0, TOP, W, BOTTOM - TOP, rgb(10, 22, 40));
  for (let x = 0; x < W; x += 16) P.rect(x, TOP, 1, BOTTOM - TOP, rgb(16, 34, 58));
  for (let y = TOP; y < BOTTOM; y += 16) P.rect(0, y, W, 1, rgb(16, 34, 58));
  const S = [66, 86], svc = (i) => [248, 30 + i * 26], R = [150, 146];
  const colour = { green: C.green, yellow: C.yellow, red: C.red };
  // Edges with traffic pulses; a retry storm floods them.
  for (let i = 0; i < 5; i++) {
    const [x, y] = svc(i), st = sim.states[i];
    P.line(S[0] + 18, S[1], x - 22, y, st === 'red' ? rgb(120, 40, 40) : rgb(50, 90, 130));
    const n = sim.retry ? 4 : 1, speed = sim.retry ? 1.6 : 0.6;
    for (let j = 0; j < n; j++) {
      const k = ((time * speed + j / n + i * 0.17) % 1);
      P.rect(lerp(S[0] + 18, x - 22, k) - 1, lerp(S[1], y, k) - 1, 3, 3, sim.retry ? C.red : C.cyan);
    }
    if (sim.isolate) P.rect(S[0] + 30, lerp(S[1], y, 0.12) - 4, 3, 8, rgb(200, 200, 210));
    if (sim.fallback) { P.line(R[0], R[1], x - 22, y, rgb(200, 180, 60), 2, Math.floor(time * 6)); }
    if (st === 'yellow') P.line(R[0], R[1], x - 22, y, C.yellow, 2, Math.floor(time * 10));
    P.rect(x - 22, y - 8, 44, 16, shade(colour[st], 0.35)); P.box(x - 22, y - 8, 44, 16, colour[st]);
    P.ctext(y - 3, `СЕРВИС ${sim.services[i].name}`, colour[st], 1, x);
  }
  const wob = !sim.nodeDown ? Math.round(Math.sin(time * 18) * (time % 2 > 1 ? 1 : 0)) : 0;
  P.rect(S[0] - 22 + wob, S[1] - 10, 44, 20, sim.nodeDown ? rgb(90, 20, 20) : rgb(30, 50, 80)); P.box(S[0] - 22 + wob, S[1] - 10, 44, 20, sim.nodeDown ? C.red : C.gold);
  P.ctext(S[1] - 7, 'ОБЩИЙ', sim.nodeDown ? C.red : C.gold, 1, S[0] + wob); P.ctext(S[1] + 1, sim.nodeDown ? 'ЛЁГ' : 'УЗЕЛ', sim.nodeDown ? C.red : C.gold, 1, S[0] + wob);
  if (sim.isolate) P.text(S[0] + 14, S[1] + 18, 'ПЕРЕБОРКИ', rgb(200, 200, 210));
  if (sim.fallback) { P.rect(R[0] - 18, R[1] - 6, 36, 12, rgb(60, 50, 10)); P.box(R[0] - 18, R[1] - 6, 36, 12, C.yellow); P.ctext(R[1] - 3, 'РЕЗЕРВ', C.yellow, 1, R[0]); }
  if (sim.retry) P.text(20, 128, 'ПОВТОРЯЙ! ПОВТОРЯЙ!', C.red);
  return [[`КРАСНЫХ ${sim.red}/5`, sim.red > 1 ? C.red : C.green]];
}

// -------------------------------------------------- LOW · unknown machine

function paintLowlevel(P, sim, time, art) {
  const a = art.atlas;
  P.tile(a?.COMPSTA1 ?? a?.SILVER3, 0, TOP, W, BOTTOM - TOP, { k: 0.34, scale: 0.7 });
  P.rect(20, 40, 180, 100, rgb(30, 32, 38)); P.box(20, 40, 180, 100, rgb(120, 124, 132));
  P.text(28, 46, 'НЕИЗВЕСТНАЯ МАШИНА', C.dim);
  // Door with the pattern it wants engraved above.
  const open = sim.open;
  P.rect(232, 34, 64, 108, rgb(16, 18, 22)); P.rect(236, 38, 56, 100, rgb(255, 230, 150));
  P.tile(a?.DOORTRAK ?? a?.SILVER3, 236, 38, 56, Math.round(100 * (1 - open)), { k: 0.8, scale: 0.8 });
  P.text(248, 24, '0011', C.gold, 1);
  for (let i = 0; i < 4; i++) {
    const on = sim.bits[i];
    const x = 36 + i * 40, y = 70;
    P.disc(x + 12, y + 12, 12, on ? rgb(255, 210, 90) : rgb(50, 46, 40)); P.disc(x + 12, y + 12, 9, on ? rgb(255, 240, 180) : rgb(70, 64, 56));
    P.ctext(y + 30, String(on), on ? C.gold : C.dim, 2, x + 12);
    // Wire to the lock; a pulse runs along when the bit is on.
    P.line(x + 12, y + 46, x + 12, 132, rgb(80, 80, 90)); P.line(x + 12, 132, 230, 132, rgb(80, 80, 90));
    if (on) { const k = (time * 0.8 + i * 0.2) % 1; P.rect(lerp(x + 12, 230, k) - 1, 131, 3, 3, C.gold); }
  }
  P.text(28, 122, `СОСТОЯНИЕ ${sim.bits.join('')}`, sim.ok ? C.green : C.white);
  if (sim.ok) P.ctext(146, 'ОТКРЫТО', C.green, 1, 264);
  return [[`СОСТОЯНИЕ ${sim.bits.join('')}`, sim.ok ? C.green : C.white]];
}

const PAINT = { automation: paintAutomation, vehicle: paintVehicle, security: paintSecurity, web: paintWeb, ai: paintAi, systems: paintSystems, lowlevel: paintLowlevel };

// ------------------------------------------------------------- frames

// One full frame: scene, top strip with counters, bottom caption strip.
export function paintPreview(buf, realm, cfg, t, time, art, { label = '', caption = '', tone = 'neutral', progress = null, verdict = null, since = 0 } = {}) {
  const P = makePainter(buf);
  const sim = simulateRealm(realm, cfg, t);
  if (realm === 'lowlevel' && sim.ok) sim.open = clamp((time - since) / 1.2, 0, 1);
  P.rect(0, 0, W, H, C.dark);
  const hud = (PAINT[realm] ?? (() => []))(P, sim, time, art) ?? [];
  P.rect(0, 0, W, TOP, C.bar); P.rect(0, TOP - 1, W, 1, rgb(40, 42, 50));
  P.text(4, 4, label || SHORT[realm] || '', C.gold);
  let x = W - 4;
  for (let i = hud.length - 1; i >= 0; i--) { const [s, c] = hud[i]; P.rtext(x, 4, s, c); x -= textWidth(s) + 10; }
  P.rect(0, BOTTOM, W, H - BOTTOM, C.bar); P.rect(0, BOTTOM, W, 1, rgb(40, 42, 50));
  if (caption) {
    let scale = 1; P.ctext(BOTTOM + 7, caption, TONE[tone] ?? C.white, scale);
  }
  if (progress) {
    const { index, count, k } = progress;
    for (let i = 0; i < count; i++) P.rect(W - 8 - (count - i) * 8, BOTTOM + 15, 6, 2, i < index ? C.dim : i === index ? shade(C.white, 0.5 + 0.5 * k) : rgb(50, 50, 56));
  }
  if (verdict) {
    P.tint(0, 70, W, 34, [0, 0, 0], 0.55);
    P.ctext(80, verdict.ok ? 'ДЕНЬ ВЫДЕРЖАН' : 'ДЕНЬ ПРОВАЛЕН', verdict.ok ? C.green : C.red, 2);
  }
  return sim;
}

// ----------------------------------------------------------- controller

async function loadSprite(url) {
  const img = new Image();
  img.src = new URL(`../../${url}`, import.meta.url).href;
  await img.decode();
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
  return { w: c.width, h: c.height, data: new Uint32Array(g.getImageData(0, 0, c.width, c.height).data.buffer) };
}

export function createCareerPreview(canvas, { reduceMotion = false, sprites = {} } = {}) {
  if (!canvas) return { demo() {}, live() {}, setConfig() {}, run() {}, stop() {} };
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const buf = new Uint32Array(W * H);
  const image = new ImageData(new Uint8ClampedArray(buf.buffer), W, H);
  const art = { atlas: null, car: null, robot: null };
  loadAtlas().then((a) => { art.atlas = a; paintOnce(); }).catch(() => {});
  if (sprites.car) loadSprite(sprites.car).then((s) => { art.car = s; }).catch(() => {});
  if (sprites.robot) loadSprite(sprites.robot).then((s) => { art.robot = s; }).catch(() => {});
  let mode = null; let raf = 0;

  function draw(now) {
    if (!mode) return;
    const time = now / 1000;
    if (mode.kind === 'demo') {
      const script = PREVIEW_SCRIPTS[mode.realm];
      if (reduceMotion) {
        const last = script.at(-1);
        paintPreview(buf, mode.realm, last.cfg, SIM_DAY, 0, art, { label: `ДЕМО · ${SHORT[mode.realm]}`, caption: last.caption, tone: last.tone, since: -10 });
      } else {
        const at = previewAt(mode.realm, now - mode.start);
        if (at.index !== mode.segment) { mode.segment = at.index; mode.segmentSince = time; }
        paintPreview(buf, mode.realm, at.cfg, at.t, time, art, { label: `ДЕМО · ${SHORT[mode.realm]}`, caption: at.caption, tone: at.tone, progress: { index: at.index, count: script.length, k: at.k }, since: mode.segmentSince });
      }
    } else {
      const day = SIM_DAY + 1.5;
      let t, verdict = null, caption = mode.caption ?? '';
      if (mode.run) {
        t = Math.min(SIM_DAY, (now - mode.run.start) / 1000);
        caption = t < SIM_DAY ? `ДЕНЬ: ${t.toFixed(1)} ИЗ ${SIM_DAY} С` : caption;
        if (t >= SIM_DAY) {
          const sim = simulateRealm(mode.realm, mode.cfg, SIM_DAY);
          verdict = { ok: sim.ok };
          if (!mode.run.done) { mode.run.done = true; mode.run.onDone?.(sim); }
        }
      } else t = reduceMotion ? SIM_DAY : ((now - mode.since) / 1000) % day;
      paintPreview(buf, mode.realm, mode.cfg, Math.min(t, SIM_DAY), time, art, { label: 'ТВОЯ СХЕМА', caption, tone: verdict ? (verdict.ok ? 'good' : 'bad') : 'neutral', verdict, since: mode.since / 1000 });
    }
    ctx.putImageData(image, 0, 0);
  }
  function frame(now) {
    raf = 0;
    if (!mode || !canvas.isConnected) return;
    if (canvas.offsetParent !== null && !document.hidden) draw(now);
    if (!reduceMotion || mode.run) raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }
  function paintOnce() { if (mode) draw(performance.now()); ctx.putImageData(image, 0, 0); }

  return {
    demo(realm) { mode = { kind: 'demo', realm, start: performance.now(), segment: -1, segmentSince: 0 }; paintOnce(); kick(); },
    live(realm, cfg, caption = '') { mode = { kind: 'live', realm, cfg, caption, since: performance.now(), run: null }; paintOnce(); kick(); },
    setConfig(cfg, caption) { if (mode?.kind !== 'live') return; mode.cfg = cfg; if (caption !== undefined) mode.caption = caption; mode.since = performance.now(); mode.run = null; paintOnce(); kick(); },
    run(onDone) { if (mode?.kind !== 'live') return; mode.run = { start: performance.now(), onDone, done: false }; kick(); },
    stop() { mode = null; if (raf) cancelAnimationFrame(raf); raf = 0; },
    state: () => (mode ? { kind: mode.kind, realm: mode.realm } : null),
  };
}
