// 19.0 part C · the live scenes of the five tasters (career-tasters.js) and
// the engineer's showcase (a tiny Pythonio workshop). Same pixel language as
// the garage and the first shift: a 320×180 frame, the 5×7 font, painted by
// makePainter. The scene never decides anything: it plays the result object
// the judge returned (what you see is what counts).

import { rgb } from './raycaster.js';
import { textWidth } from './pixel-font.js';
import { makePainter, PREVIEW_W as W, PREVIEW_H as H } from './career-previews.js';
import { TASTERS, tasterById, judgeLevel, SYS_HOUSES, LOW_WEIGHTS, stationOf } from './career-tasters.js';

const C = {
  white: rgb(236, 236, 228), dim: rgb(150, 150, 146), dark: rgb(8, 9, 12), bar: rgb(14, 15, 19),
  gold: rgb(255, 200, 70), red: rgb(232, 60, 44), green: rgb(96, 224, 124), cyan: rgb(110, 240, 255),
  skin: rgb(226, 188, 150), wood: rgb(120, 78, 42), night: rgb(10, 14, 30),
};
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => 1 - (1 - clamp(k, 0, 1)) ** 2;
const TOP = 14, BOTTOM = 160;

// --------------------------------------------------------------- timeline
// Actors come one after another: GAP apart, WALK to the decision point,
// then FATE seconds to show what happened. The banner comes after.
export const GAP = 0.6, WALK = 1.3, FATE = 0.9;
export function actorsOf(id, way, result) {
  const run = result?.run;
  if (!run) return [];
  if (run.cases) return run.cases.map((c) => ({ ...c, name: c.label, fate: fateOfCase(id, c), ok: c.ok }));
  return run.actors ?? [];
}
function fateOfCase(id, c) {
  const got = c.got;
  if (id === 'security') return got === 'ПУСТИТЬ' ? 'pass' : 'block';
  if (id === 'web') return got === 'ЗАКАЗАТЬ' ? (c.vars.пирогов > 0 ? 'buy' : 'angry') : (c.vars.пирогов > 0 ? 'leave' : 'calm');
  if (id === 'ai') return got === 'СПРЯТАТЬ' ? 'hide' : 'show';
  if (id === 'systems') return got === 'ОТКЛЮЧИТЬ' ? 'dark' : 'lit';
  if (id === 'lowlevel') return got === 'ГОРИТ' ? 'on' : 'off';
  return 'show';
}
export function playLength(id, way, result) {
  const n = Math.max(1, actorsOf(id, way, result).length);
  if (!result?.run?.cases && (id === 'systems' || id === 'lowlevel')) return 4.2;
  return (n - 1) * GAP + WALK + FATE + 0.4;
}
// Where actor i is: phase 'wait' (not yet), 'walk' k∈[0,1], 'fate' k∈[0,1], 'done'.
function phaseOf(i, t) {
  const s = i * GAP;
  if (t < s) return ['wait', 0];
  if (t < s + WALK) return ['walk', (t - s) / WALK];
  if (t < s + WALK + FATE) return ['fate', (t - s - WALK) / FATE];
  return ['done', 1];
}

// ------------------------------------------------------------ small art
function person(P, x, y, body, { head = C.skin, frame = 0, scale = 1 } = {}) {
  x = Math.round(x); y = Math.round(y);
  const s = scale;
  P.rect(x + s, y, 3 * s, 3 * s, head); P.rect(x, y + 3 * s, 5 * s, 4 * s, body);
  const leg = rgb(40, 40, 46);
  if (frame) { P.rect(x, y + 7 * s, 2 * s, 2 * s, leg); P.rect(x + 3 * s, y + 7 * s, 2 * s, s, leg); }
  else { P.rect(x + s, y + 7 * s, s, 2 * s, leg); P.rect(x + 3 * s, y + 7 * s, s, 2 * s, leg); }
}
function bot(P, x, y, frame = 0, scale = 1) {
  const s = scale; x = Math.round(x); y = Math.round(y);
  P.rect(x, y, 6 * s, 5 * s, rgb(170, 30, 30)); P.rect(x + s, y + s, s, s, C.gold); P.rect(x + 4 * s, y + s, s, s, C.gold);
  P.rect(x + 2 * s, y - 2 * s, s, 2 * s, rgb(120, 20, 20));
  P.rect(x + s, y + 5 * s, 4 * s, 3 * s, rgb(110, 24, 24));
  P.rect(x + (frame ? 0 : s), y + 8 * s, s, s, rgb(60, 10, 10)); P.rect(x + (frame ? 5 : 4) * s, y + 8 * s, s, s, rgb(60, 10, 10));
}
function shards(P, x, y, k, c = C.red) {
  for (let i = 0; i < 8; i++) { const a = i * 0.785 + 0.3, r = 3 + k * 16; P.rect(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.7, 2, 2, c); }
}
function ring(P, x, y, r, c) { for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; P.put(x + Math.cos(a) * r, y + Math.sin(a) * r, c); } }
function sky(P, time, h = 112) {
  for (let y = TOP; y < h; y++) P.rect(0, y, W, 1, rgb(8 + ((y - TOP) / 7) | 0, 10 + ((y - TOP) / 6) | 0, 26 + ((y - TOP) / 3) | 0));
  for (let i = 0; i < 34; i++) { const x = (i * 97 + 13) % W, y = TOP + ((i * 53 + 7) % (h - TOP - 30)); const tw = 0.5 + 0.5 * Math.sin(time * 1.3 + i * 2.1); P.put(x, y, rgb(220 * tw | 0, 230 * tw | 0, 255 * tw | 0)); }
}
function tag(P, x, y, s, c) { P.ctext(y, s, c, 1, x); }
// The case on show: sweeps through the cases and stops on the first wrong
// one — the one the sentence under the scene talks about.
function caseAt(cases, k) {
  const wrong = cases.findIndex((c) => !c.ok), last = wrong >= 0 ? wrong : cases.length - 1;
  return clamp(Math.floor(k), 0, last);
}
function wrongMark(P, x, y, time) { if (Math.floor(time * 6) % 2) ring(P, x, y, 9, C.red); P.text(x - 2, y - 18, '!', C.red); }

// --------------------------------------------------------- СЕТЕВИК
function paintSecurity(P, view) {
  const { time, t, result, actors } = view;
  sky(P, time, 118);
  P.rect(0, 118, W, BOTTOM - 118, rgb(26, 30, 34));
  P.rect(0, 130, 200, 3, rgb(60, 60, 66));
  // The house wall with the door, Тимур's server behind it.
  P.rect(196, 54, 124, 76, rgb(44, 40, 52)); P.box(196, 54, 124, 76, rgb(90, 84, 100));
  P.line(190, 54, 258, 30, rgb(110, 96, 110)); P.line(258, 30, 320, 54, rgb(110, 96, 110));
  const server = result?.run?.server ?? (view.idle ? 'down' : 'ok');
  const doorOpen = server !== 'off';
  P.rect(198, 98, 14, 32, doorOpen ? rgb(30, 26, 22) : rgb(90, 60, 40)); P.box(198, 98, 14, 32, rgb(120, 96, 70));
  // Guard at the door once a guard exists (levels 2-3, or the right button).
  const guard = view.level > 0 || result?.choice === 'guard';
  if (guard) { person(P, 214, 112, rgb(60, 110, 200), { scale: 2 }); tag(P, 219, 100, 'СТОРОЖ', C.cyan); }
  // Server rack.
  const rack = server === 'tiski' ? rgb(120, 26, 26) : rgb(30, 32, 40);
  P.rect(268, 70, 30, 56, rack); P.box(268, 70, 30, 56, rgb(110, 114, 128));
  const passedBots = actors.filter((a, i) => a.kind === 'bot' && a.fate === 'pass' && phaseOf(i, t)[0] !== 'wait' && phaseOf(i, t)[0] !== 'walk').length;
  const end = result && t >= playLength('security', '', result) - 0.4;
  const down = (server === 'down' && (passedBots > 0 || end)) || (view.idle && Math.floor(time) % 4 === 3);
  for (let r = 0; r < 5; r++) {
    P.rect(271, 74 + r * 10, 24, 7, rgb(18, 20, 26));
    if (server === 'off') continue;
    const c = down ? (Math.floor(time * 4 + r) % 2 ? C.red : rgb(80, 20, 20)) : (r + Math.floor(time * 2)) % 3 ? C.green : C.cyan;
    P.rect(273 + ((r * 7 + Math.floor(time * 3)) % 3) * 6, 76 + r * 10, 3, 2, c);
  }
  tag(P, 283, 60, server === 'off' ? 'ВЫКЛ' : server === 'tiski' ? 'ТИСКИ' : down ? 'ЛЁГ' : 'СЕРВЕР', server === 'off' || down ? C.red : server === 'tiski' ? C.gold : C.green);
  if (server === 'tiski') for (let i = 0; i < 3; i++) { const k = (time * 0.7 + i / 3) % 1; P.text(250 + i * 10, 40 - k * 24, '₽', C.gold); }
  // Load bar.
  const load = clamp(view.idle ? 0.6 + 0.4 * Math.sin(time * 2) : passedBots / 2, 0, 1);
  P.rect(268, 128, 30, 3, rgb(40, 40, 40)); P.rect(268, 128, Math.round(30 * load), 3, load > 0.7 ? C.red : C.green);
  // Idle: bots hammer the door.
  if (view.idle) {
    for (let i = 0; i < 6; i++) { const k = ((time * 0.6 + i / 6) % 1); bot(P, lerp(-8, 186, k), 118, Math.floor(time * 6 + i) % 2); }
    person(P, 30, 119, C.green, { frame: Math.floor(time * 3) % 2 }); tag(P, 33, 108, 'АНЯ', C.green);
    return;
  }
  actors.forEach((a, i) => {
    const [ph, k] = phaseOf(i, t); if (ph === 'wait') return;
    const y = 119, door = 186, frame = Math.floor(time * 6 + i) % 2;
    let x = ph === 'walk' ? lerp(-10, door, k) : door;
    let hide = false;
    if (ph !== 'walk') {
      if (a.fate === 'pass') { x = lerp(door, 250, ease(k)); hide = ph === 'done'; }
      if (a.fate === 'block') { x = door - ease(k) * 26; if (ph === 'fate') shards(P, door + 4, y + 2, k, a.kind === 'bot' ? C.red : C.gold); }
      if (a.fate === 'wait') x = door - (i % 3) * 8 - Math.floor(i / 3) * 4;
    }
    if (hide) return;
    if (a.kind === 'bot') bot(P, x, y - 1, frame); else person(P, x, y, C.green, { frame });
    if (a.kind === 'friend') tag(P, x + 2, y - 10, a.name.toUpperCase(), C.green);
    if (a.stolen || /чужим/.test(a.name)) tag(P, x + 3, y - 12, 'КРАДЕНОЕ', C.gold);
    if (!a.ok && ph !== 'walk') wrongMark(P, x + 3, y + 3, time);
  });
}

// --------------------------------------------------------- САЙТЫ
function paintWeb(P, view) {
  const { time, t, result, actors } = view;
  P.rect(0, TOP, W, 80, rgb(150, 190, 220)); P.rect(0, 70, W, 30, rgb(120, 160, 190));
  P.rect(0, 100, W, BOTTOM - 100, rgb(70, 72, 78)); P.rect(0, 128, W, 2, rgb(200, 200, 190));
  // Нина's stall (right) and the «ТИСКИ-Маркет» booth.
  P.rect(250, 76, 64, 34, rgb(220, 200, 160)); P.rect(246, 70, 72, 8, rgb(200, 60, 60)); for (let i = 0; i < 9; i++) P.rect(246 + i * 8, 70, 4, 8, C.white);
  tag(P, 282, 60, 'ПИРОГИ', C.dark);
  const run = result?.run, cases = run?.cases, curCase = cases ? caseAt(cases, t / GAP) : -1;
  const pies = cases ? cases[curCase].vars.пирогов : 6;
  for (let i = 0; i < Math.min(pies, 6); i++) { P.rect(256 + i * 9, 100, 7, 4, rgb(200, 140, 60)); P.rect(257 + i * 9, 99, 5, 1, rgb(230, 180, 90)); }
  person(P, 278, 84, rgb(150, 80, 140), { head: rgb(236, 210, 190) }); P.rect(278, 83, 5, 1, C.white);
  P.rect(150, 132, 56, 20, rgb(150, 24, 24)); tag(P, 178, 138, 'ТИСКИ-МАРКЕТ', C.gold);
  // The phone with her page.
  const page = run?.page ?? {};
  const px = 96, py = 22;
  P.rect(px, py, 50, 78, rgb(20, 20, 24)); P.rect(px + 3, py + 6, 44, 66, page.tiski ? rgb(150, 24, 24) : C.white);
  if (page.loading && !(t > 2.5 && Math.floor(t) % 2)) { const a = time * 6; for (let i = 0; i < 6; i++) P.rect(px + 25 + Math.cos(a + i) * 8, py + 38 + Math.sin(a + i) * 8, 2, 2, C.dim); tag(P, px + 25, py + 56, '9 С...', C.dim); }
  else if (page.tiski) { tag(P, px + 25, py + 30, 'ТИСКИ', C.gold); tag(P, px + 25, py + 42, 'ПИРОГИ', C.white); }
  else if (cases) {
    tag(P, px + 25, py + 14, 'НИНА', C.dark); tag(P, px + 25, py + 24, `ОСТАЛОСЬ ${pies}`, C.dark);
    const word = cases[curCase].got || '...', okc = cases[curCase].ok;
    P.rect(px + 6, py + 46, 38, 12, okc ? rgb(40, 150, 70) : C.red); tag(P, px + 25, py + 49, word.slice(0, 7), C.white);
  } else if (view.idle || !run) {
    tag(P, px + 25, py + 14, 'ГЛАВНАЯ', C.dim); for (let i = 0; i < 5; i++) P.rect(px + 8, py + 26 + i * 7, 34 - (i % 2) * 10, 3, rgb(200, 200, 200));
    tag(P, px + 25, py + 62, '?', C.red);
  } else {
    if (page.hidden) { tag(P, px + 25, py + 20, 'НЕ', C.red); tag(P, px + 25, py + 30, 'НАЙДЕНО', C.red); }
    else {
      tag(P, px + 25, py + 12, 'ПИРОГИ', C.dark); tag(P, px + 25, py + 21, 'НИНЫ', C.dark);
      if (page.address !== false) tag(P, px + 25, py + 32, 'ЛИПОВАЯ 7', rgb(60, 60, 60));
      P.rect(px + 6, py + 50, 38, 12, rgb(40, 150, 70)); tag(P, px + 25, py + 53, 'ЗВОНОК', C.white);
    }
  }
  if (view.idle) {
    for (let i = 0; i < 4; i++) { const k = (time * 0.35 + i / 4) % 1; person(P, lerp(20, 170, k), 116, rgb(70, 110, 200), { frame: Math.floor(time * 5 + i) % 2 }); if (k > 0.7) tag(P, lerp(20, 170, k) + 2, 104, '?', C.red); }
    return;
  }
  actors.forEach((a, i) => {
    const [ph, k] = phaseOf(i, t); if (ph === 'wait') return;
    const frame = Math.floor(time * 5 + i) % 2, y = 116;
    let x = ph === 'walk' ? lerp(-8, 200, k) : 200, yy = y;
    if (ph !== 'walk') {
      if (a.fate === 'buy') { x = lerp(200, 262, ease(k)); if (ph === 'done') { tag(P, 262, 104, '+', C.green); } }
      if (a.fate === 'leave' || a.fate === 'calm') { x = lerp(200, 120, ease(k)); tag(P, x + 2, 104, a.fate === 'calm' ? 'ЗАВТРА' : '?', a.fate === 'calm' ? C.green : C.red); }
      if (a.fate === 'tiski') { x = lerp(200, 176, ease(k)); yy = lerp(y, 122, ease(k)); }
      if (a.fate === 'angry') { x = 240; tag(P, x + 2, 100, '!!', C.red); }
    }
    person(P, x, yy, a.fate === 'tiski' && ph !== 'walk' ? rgb(160, 60, 60) : rgb(70, 110, 200), { frame });
    if (!a.ok && ph !== 'walk') wrongMark(P, x + 3, yy + 4, time);
  });
}

// --------------------------------------------------------- ТРЕНЕР ИИ
function qbot(P, x, y, mood, time) {
  P.rect(x, y, 30, 22, rgb(200, 210, 220)); P.box(x, y, 30, 22, rgb(110, 120, 140));
  P.rect(x + 14, y - 6, 2, 6, rgb(110, 120, 140)); P.disc(x + 15, y - 7, 2, mood === 'bad' ? C.red : C.cyan);
  const eye = mood === 'bad' ? C.red : mood === 'good' ? C.green : C.cyan, blink = Math.floor(time * 2) % 7 === 0;
  P.rect(x + 6, y + 7, 5, blink ? 1 : 5, eye); P.rect(x + 19, y + 7, 5, blink ? 1 : 5, eye);
  P.rect(x + 9, y + 16, 12, 2, mood === 'bad' ? C.red : rgb(60, 70, 90));
  P.rect(x + 4, y + 22, 22, 14, rgb(150, 160, 175)); P.rect(x - 3, y + 24, 7, 3, rgb(150, 160, 175)); P.rect(x + 26, y + 24, 7, 3, rgb(150, 160, 175));
  tag(P, x + 15, y + 40, 'Q-BOT', C.cyan);
}
function card(P, x, y, a, reveal) {
  P.rect(x, y, 24, 14, a.kind === 'fake' && reveal ? rgb(220, 190, 190) : C.white); P.box(x, y, 24, 14, rgb(90, 90, 90));
  P.rect(x + 3, y + 4, 16, 1, rgb(120, 120, 120)); P.rect(x + 3, y + 8, 12, 1, rgb(120, 120, 120));
  if (reveal && a.kind === 'fake') P.text(x + 17, y + 4, 'Т', C.red);
}
function paintAi(P, view) {
  const { time, t, result, actors } = view;
  P.rect(0, TOP, W, BOTTOM - TOP, rgb(46, 34, 30));
  for (let x = 0; x < W; x += 20) P.rect(x, TOP, 1, 90, rgb(56, 42, 36));
  P.rect(0, 104, W, BOTTOM - 104, rgb(90, 64, 44));
  // The page board (top right) and the bin (bottom right).
  P.rect(222, 20, 92, 66, rgb(20, 40, 30)); P.box(222, 20, 92, 66, rgb(80, 120, 90)); tag(P, 268, 24, 'НА СТРАНИЦЕ', C.green);
  P.rect(246, 120, 46, 30, rgb(60, 60, 66)); P.box(246, 120, 46, 30, rgb(110, 110, 120)); tag(P, 269, 112, 'СПРЯТАНО', C.dim);
  P.rect(0, 98, 140, 4, rgb(70, 70, 76)); // conveyor
  for (let x = 0; x < 140; x += 8) P.rect(x + ((time * 16) % 8), 99, 3, 2, rgb(110, 110, 116));
  const anyBad = actors.some((a, i) => !a.ok && ['fate', 'done'].includes(phaseOf(i, t)[0]));
  qbot(P, 142, 62, view.idle ? 'idle' : anyBad ? 'bad' : result?.ok && t > 1 ? 'good' : 'idle', time);
  tag(P, 160, 18, 'КОФЕЙНЯ «ЗЁРНЫШКО»', C.gold);
  if (view.idle) {
    for (let i = 0; i < 4; i++) { const k = (time * 0.3 + i / 4) % 1; card(P, lerp(-24, 118, k), 84, { kind: i % 2 ? 'fake' : 'real' }, false); }
    for (let i = 0; i < 6; i++) card(P, 228 + (i % 3) * 28, 36 + Math.floor(i / 3) * 22, { kind: i % 3 ? 'fake' : 'real' }, true);
    tag(P, 268, 90, 'ПОДДЕЛКИ!', C.red);
    return;
  }
  let shown = 0, hidden = 0;
  actors.forEach((a, i) => {
    const [ph, k] = phaseOf(i, t); if (ph === 'wait') return;
    const reveal = ph !== 'walk';
    if (ph === 'walk') { card(P, lerp(-24, 118, k), 84, a, false); return; }
    let x, y;
    if (a.fate === 'show') { const slot = shown++; x = lerp(118, 228 + (slot % 3) * 28, ease(k)); y = lerp(84, 36 + Math.floor(slot / 3) * 22, ease(k)); }
    else { const slot = hidden++; x = lerp(118, 250 + (slot % 3) * 12, ease(k)); y = lerp(84, 128 + Math.floor(slot / 3) * 4, ease(k)); }
    card(P, x, y, a, reveal);
    if (!a.ok) wrongMark(P, x + 12, y + 7, time);
  });
}

// --------------------------------------------------------- СПАСАТЕЛЬ
const HX = [92, 134, 176, 222, 270];
function house(P, i, lit, time, { valya = false, mark = null } = {}) {
  const x = HX[i], y = valya ? 66 : 82, h = valya ? 50 : 34;
  P.rect(x - 14, y, 28, h, rgb(52, 50, 60)); P.box(x - 14, y, 28, h, rgb(90, 88, 100));
  for (let r = 0; r < (valya ? 5 : 3); r++) for (let c = 0; c < 3; c++) {
    const on = lit && ((r * 3 + c + i) % 4 !== 0 || valya);
    P.rect(x - 10 + c * 8, y + 4 + r * 9, 5, 5, on ? rgb(255, 220, 120) : rgb(24, 24, 30));
  }
  tag(P, x, y + h + 4, SYS_HOUSES[i].replace('Дом бабы Вали', 'ВАЛЯ').toUpperCase(), valya ? C.gold : C.dim);
  if (mark) tag(P, x, y - 10, mark[0], mark[1]);
}
function paintSystems(P, view) {
  const { time, t, result, actors } = view;
  sky(P, time, 120);
  P.rect(0, 120, W, BOTTOM - 120, rgb(22, 24, 28));
  // Substation.
  const run = result?.run, mode = run?.mode, cases = run?.cases;
  let hot = view.idle ? 0.5 + 0.5 * Math.sin(time * 3) : 0;
  if (mode === 'cascade' || mode === 'burn' || mode === 'surge') hot = clamp(t / 1.2, 0, 1);
  if (mode === 'one') hot = clamp(1 - (t - 1.2) / 2, 0, 1);
  P.rect(14, 84, 40, 32, hot > 0.6 ? rgb(150, 50, 30) : rgb(60, 64, 70)); P.box(14, 84, 40, 32, rgb(140, 140, 150));
  tag(P, 34, 74, 'ПОДСТАНЦИЯ', hot > 0.6 ? C.red : C.dim);
  if (mode === 'burn' && t > 1.4) for (let i = 0; i < 5; i++) { const k = (time + i / 5) % 1; P.disc(26 + i * 5, 84 - k * 30, 2 + k * 3, rgb(90 - k * 40 | 0, 90 - k * 40 | 0, 90 - k * 40 | 0)); }
  // Lines to the houses.
  P.line(54, 100, 300, 100, rgb(80, 80, 90));
  const walls = view.level >= 1 && (mode === 'walls' || mode === 'surge' || cases);
  if (walls) for (const x of [155, 246]) { P.rect(x, 92, 3, 16, C.cyan); }
  const backup = run?.actors?.[3]?.fate === 'lit' && (mode === 'walls' || mode === 'surge');
  if (backup) { P.line(222, 66, 222, 40, C.green); P.line(222, 40, 316, 40, C.green); tag(P, 280, 30, 'ЗАПАС', C.green); }
  for (let i = 0; i < 5; i++) {
    let lit = true, mark = null;
    if (view.idle) lit = !(Math.floor(time * 0.8) % 5 >= 3 && i <= Math.floor(time * 2) % 5);
    else if (cases) {
      const c = cases.find((x) => x.house === i), ci = cases.indexOf(c);
      if (c) {
        const [ph] = phaseOf(ci, t);
        if (ph !== 'wait') { mark = [`${c.vars.нагрузка}%`, c.vars.нагрузка > 90 ? C.red : C.white]; if (ph !== 'walk') { lit = c.got !== 'ОТКЛЮЧИТЬ'; if (!c.ok) wrongMark(P, HX[i], 60, time); } }
      }
    } else {
      const fate = run.actors[i].fate;
      const at = mode === 'cascade' ? 1.2 + i * 0.5 : mode === 'burn' ? 1.8 : mode === 'surge' ? (t < 2.4 ? 1.2 : 3.0) : 1.2;
      if (fate === 'dark') lit = t < at || (mode === 'surge' && t >= 2.4 && t < 2.8);
      if (fate === 'pause') lit = t < 1.2 || t > 3.4;
      if (mode === 'surge' && fate === 'lit') lit = true;
      if (fate === 'dark' && t >= at && t < at + 0.4) shards(P, HX[i], 96, (t - at) / 0.4, C.gold);
      if (!run.actors[i].ok && t > at + 0.4) wrongMark(P, HX[i], 60, time);
    }
    house(P, i, lit, time, { valya: i === 3, mark });
  }
}

// --------------------------------------------------------- ЖЕЛЕЗО
function paintLowlevel(P, view) {
  const { time, t, result } = view;
  P.rect(0, TOP, W, BOTTOM - TOP, rgb(54, 44, 38));
  P.rect(0, 120, W, BOTTOM - 120, rgb(84, 60, 40));
  const run = result?.run, cases = run?.cases;
  // The radio.
  const rx = 70, ry = 34;
  P.rect(rx, ry, 180, 86, rgb(130, 82, 44)); P.box(rx, ry, 180, 86, rgb(70, 44, 20));
  P.rect(rx + 8, ry + 8, 60, 70, rgb(60, 40, 24)); for (let y = 0; y < 66; y += 4) P.rect(rx + 10, ry + 10 + y, 56, 1, rgb(90, 64, 40));
  // Dial with the needle on the station.
  const bits = run?.bits ?? (view.input ? LOW_WEIGHTS.map((w) => (Number(view.input[`b${w}`]) ? 1 : 0)) : [0, 0, 0, 0]);
  const station = run?.station ?? bits.reduce((n, b, i) => n + b * LOW_WEIGHTS[i], 0);
  P.rect(rx + 78, ry + 10, 92, 18, rgb(230, 210, 160)); for (let i = 0; i <= 8; i++) { P.rect(rx + 80 + i * 11, ry + 22, 1, 4, C.dark); }
  P.rect(rx + 80 + clamp(station, 0, 8) * 11, ry + 11, 2, 16, C.red);
  tag(P, rx + 124, ry + 2, `СТАНЦИЯ ${station}`, C.gold);
  // Four switches 8 4 2 1 with lamps.
  LOW_WEIGHTS.forEach((w, i) => {
    const x = rx + 84 + i * 22, y = ry + 38;
    P.rect(x, y, 12, 18, rgb(40, 40, 44)); P.rect(x + 3, bits[i] ? y + 2 : y + 9, 6, 7, bits[i] ? C.gold : rgb(120, 120, 120));
    P.disc(x + 6, y + 26, 3, bits[i] ? rgb(255, 210, 90) : rgb(60, 50, 40));
    tag(P, x + 6, y + 33, String(w), C.white);
  });
  // The power lamp («ВКЛ») and the plug.
  let lamp = run?.radio === 'plays', plug = true, button = true;
  if (cases) {
    const c = cases[caseAt(cases, t / (GAP * 1.6))];
    plug = c.vars.вилка === 1; button = c.vars.кнопка === 1; lamp = c.got === 'ГОРИТ';
    tag(P, 160, 128, c.label.toUpperCase(), c.ok ? C.green : C.red);
    if (!c.ok) wrongMark(P, rx + 170, ry + 70, time);
  }
  P.disc(rx + 170, ry + 70, 4, lamp ? rgb(255, 80, 60) : rgb(60, 30, 26)); tag(P, rx + 170, ry + 78, 'ВКЛ', C.white);
  P.rect(rx + 150, ry + 64, 8, 6, button ? C.green : rgb(80, 80, 80));
  P.line(rx + 180, ry + 80, 290, 140, rgb(30, 30, 30)); P.rect(290, plug ? 136 : 146, 10, 6, rgb(220, 220, 220)); P.rect(298, 128, 14, 16, rgb(240, 240, 230));
  // Sound.
  const state = run?.radio;
  if (state === 'plays' && t > 0.8) for (let i = 0; i < 4; i++) { const k = (time * 0.8 + i / 4) % 1; const x = rx + 30 + Math.sin(k * 6 + i) * 16, y = ry - k * 30 + 30; P.rect(x, y, 2, 6, C.gold); P.rect(x + 2, y, 3, 1, C.gold); P.disc(x, y + 6, 2, C.gold); }
  if (state === 'crackle' && t < 1.4) for (let i = 0; i < 6; i++) P.line(rx + 10 + i * 9, ry + 20 + ((i * 7 + Math.floor(time * 20)) % 30), rx + 15 + i * 9, ry + 30 + ((i * 5 + Math.floor(time * 20)) % 30), C.white);
  if (state === 'tiski') { P.rect(rx, ry, 180, 86, rgb(150, 24, 24)); tag(P, rx + 90, ry + 30, 'ТИСКИ-РАДИО', C.gold); tag(P, rx + 90, ry + 46, 'РЕКЛАМА РЕКЛАМА', C.white); tag(P, rx + 90, ry + 62, '299 ₽ В МЕСЯЦ', C.gold); }
  if (state === 'other' && t > 0.8) tag(P, rx + 36, ry + 30, '~~~', C.dim);
  if (run?.open && t < 2.6) { P.rect(rx + 8, ry + 8, 60, 70, rgb(30, 60, 40)); P.line(rx + 20, ry + 30, rx + 50, ry + 50, C.gold); if (t > 1.2) shards(P, rx + 50, ry + 50, (t - 1.2) % 1, C.gold); tag(P, rx + 38, ry + 64, 'ПРОВОД', C.gold); }
  person(P, 22, 98, rgb(90, 90, 110), { head: rgb(220, 200, 180), scale: 2 }); P.rect(22, 96, 10, 2, rgb(220, 220, 220));
  tag(P, 28, 84, 'ДЕД МИША', C.gold);
  if (view.idle && !view.input) tag(P, rx + 36, ry + 40, '...', C.dim);
}

// ------------------------------------------------- ИНЖЕНЕР · Питонио
// The engineer's showcase: Лида's line in a tiny Pythonio workshop. Files
// arrive, three by hand first, then the fork sends photos to the machine.
function paintPythonio(P, view) {
  const { time } = view;
  P.rect(0, TOP, W, BOTTOM - TOP, rgb(20, 39, 32));
  for (let x = 0; x < W; x += 16) P.rect(x, TOP, 1, BOTTOM - TOP, rgb(28, 50, 41));
  for (let y = TOP; y < BOTTOM; y += 16) P.rect(0, y, W, 1, rgb(28, 50, 41));
  const cycle = time % 12, auto = cycle > 4;
  const node = (x, y, label, c, on = true) => { P.rect(x - 22, y - 12, 44, 24, on ? rgb(40, 60, 50) : rgb(30, 44, 38)); P.box(x - 22, y - 12, 44, 24, on ? c : rgb(70, 90, 80)); tag(P, x, y - 3, label, on ? c : rgb(100, 120, 110)); };
  const IN = [40, 88], FORK = [120, 88], PHOTO = [200, 60], OUT = [280, 88];
  if (auto) { P.line(IN[0] + 22, IN[1], FORK[0] - 22, FORK[1], C.gold); P.line(FORK[0] + 22, FORK[1], PHOTO[0] - 22, PHOTO[1], C.gold); P.line(PHOTO[0] + 22, PHOTO[1], OUT[0] - 22, OUT[1], C.gold); }
  node(...IN, 'ПРИЁМ', rgb(216, 167, 94)); node(...FORK, 'РАЗВИЛКА', rgb(229, 182, 79), auto); node(...PHOTO, 'ФОТО', rgb(95, 198, 206), auto); node(...OUT, 'ГОТОВО', rgb(185, 214, 139));
  if (!auto) {
    // By hand: the hand icon carries one photo straight to «ГОТОВО».
    const k = (cycle % 1.33) / 1.33; const x = lerp(IN[0], OUT[0], k);
    P.rect(x - 4, 116 - Math.sin(k * Math.PI) * 14, 8, 6, C.white); tag(P, x, 128 - Math.sin(k * Math.PI) * 14, 'РУКАМИ', C.gold);
  } else {
    for (let i = 0; i < 5; i++) {
      const k = ((cycle - 4) * 0.35 + i / 5) % 1;
      const [x, y] = k < 0.33 ? [lerp(IN[0], FORK[0], k / 0.33), lerp(IN[1], FORK[1], k / 0.33)] : k < 0.66 ? [lerp(FORK[0], PHOTO[0], (k - 0.33) / 0.33), lerp(FORK[1], PHOTO[1], (k - 0.33) / 0.33)] : [lerp(PHOTO[0], OUT[0], (k - 0.66) / 0.34), lerp(PHOTO[1], OUT[1], (k - 0.66) / 0.34)];
      P.rect(x - 3, y - 3, 7, 6, k > 0.66 ? rgb(95, 198, 206) : C.white);
    }
    P.rect(84, 118, 152, 14, rgb(14, 28, 22)); tag(P, 160, 121, 'ЕСЛИ ФОТО → В ФОТО', C.gold);
  }
  const done = auto ? Math.min(12, 3 + Math.floor((cycle - 4) * 1.2)) : Math.min(3, Math.floor(cycle / 1.33));
  tag(P, 280, 112, `${done} ИЗ 12`, done >= 12 ? C.green : C.white);
  person(P, 26, 120, rgb(200, 120, 160), { scale: 2 }); tag(P, 32, 108, 'ЛИДА', C.gold);
}

const PAINT = { security: paintSecurity, web: paintWeb, ai: paintAi, systems: paintSystems, lowlevel: paintLowlevel, automation: paintPythonio };
const LABEL = { security: 'СЕТЕВИК', web: 'САЙТЫ', ai: 'ТРЕНЕР ИИ', systems: 'СПАСАТЕЛЬ', lowlevel: 'ЖЕЛЕЗО', automation: 'ИНЖЕНЕР · ПИТОНИО' };

// One frame. view: { id, level, result, t, time, idle, input, caption, tone, banner }
export function paintTaster(buf, view) {
  const P = makePainter(buf);
  P.rect(0, 0, W, H, C.dark);
  const actors = actorsOf(view.id, '', view.result);
  (PAINT[view.id] ?? (() => {}))(P, { ...view, actors, t: view.t ?? 0 });
  P.rect(0, 0, W, TOP, C.bar); P.rect(0, TOP - 1, W, 1, rgb(40, 42, 50));
  P.text(4, 4, view.label ?? LABEL[view.id] ?? '', C.gold);
  if (view.right) P.rtext(W - 4, 4, view.right, C.white);
  P.rect(0, BOTTOM, W, H - BOTTOM, C.bar); P.rect(0, BOTTOM, W, 1, rgb(40, 42, 50));
  if (view.caption) P.ctext(BOTTOM + 7, String(view.caption).toUpperCase().slice(0, 52), view.tone === 'bad' ? C.red : view.tone === 'good' ? C.green : C.white);
  if (view.banner) {
    // A strip at the top, so the end state of the scene stays visible.
    P.tint(0, TOP, W, 22, [0, 0, 0], 0.65);
    const s = view.banner.text, sc = textWidth(s, 2) > W - 12 ? 1 : 2;
    P.ctext(TOP + (sc === 2 ? 4 : 7), s, view.banner.ok ? C.green : C.red, sc);
  }
  return actors;
}

// The showcase loop on the professions screen: the tempting wrong button,
// then the right one (level 1), with the person's name on top.
export function demoScript(id) {
  const t = tasterById(id);
  if (!t) return [];
  const l = t.levels[0], wrong = l.choices.find((c) => !c.ok), right = l.choices.find((c) => c.ok);
  return [
    { result: null, ms: 2600, caption: `${t.victim}: «ТИСКИ» ДАВЯТ`, tone: 'bad', idle: true },
    { result: judgeLevel(id, 0, wrong.id), ms: 4200, caption: wrong.label, tone: 'bad' },
    { result: judgeLevel(id, 0, right.id), ms: 5200, caption: right.label, tone: 'good' },
  ];
}

export function createTasterCanvas(canvas, { reduceMotion = false } = {}) {
  if (!canvas) return { idle() {}, play() {}, demo() {}, stop() {}, state: () => null };
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const buf = new Uint32Array(W * H);
  const image = new ImageData(new Uint8ClampedArray(buf.buffer), W, H);
  let mode = null, raf = 0;
  function draw(now) {
    if (!mode) return;
    const time = now / 1000;
    if (mode.kind === 'demo') {
      const script = mode.script;
      if (!script.length) { paintTaster(buf, { id: mode.id, idle: true, time, level: 0, label: `ДЕМО · ${LABEL[mode.id] ?? ''}` }); }
      else {
        const total = script.reduce((n, s) => n + s.ms, 0);
        let m = reduceMotion ? total - 1 : (now - mode.start) % total, i = 0;
        while (m >= script[i].ms) { m -= script[i].ms; i++; }
        const seg = script[i];
        paintTaster(buf, { id: mode.id, level: 0, result: seg.result, idle: Boolean(seg.idle), t: reduceMotion ? 99 : m / 1000, time, caption: seg.caption, tone: seg.tone, label: `ДЕМО · ${LABEL[mode.id] ?? ''}` });
      }
    } else if (mode.kind === 'idle') {
      paintTaster(buf, { id: mode.id, level: mode.level, idle: true, input: mode.input, time, caption: mode.caption, label: mode.label });
    } else {
      const len = playLength(mode.id, '', mode.result), t = reduceMotion ? len : (now - mode.start) / 1000;
      const end = t >= len;
      paintTaster(buf, { id: mode.id, level: mode.level, result: mode.result, t: Math.min(t, len), time, caption: end ? mode.caption : mode.playing, tone: end ? (mode.result.ok ? 'good' : 'bad') : 'neutral', label: mode.label, banner: end ? { ok: mode.result.ok, text: mode.result.ok ? 'ПОЛУЧИЛОСЬ' : 'НЕ ТАК' } : null });
      if (end && !mode.done) { mode.done = true; mode.onDone?.(); }
    }
    ctx.putImageData(image, 0, 0);
  }
  function frame(now) {
    raf = 0;
    if (!mode || !canvas.isConnected) return;
    if (!document.hidden) draw(now);
    if (!reduceMotion || (mode.kind === 'play' && !mode.done)) raf = requestAnimationFrame(frame);
  }
  function kick() { draw(performance.now()); if (!raf) raf = requestAnimationFrame(frame); }
  return {
    idle(id, level, { input = null, caption = '', label } = {}) { mode = { kind: 'idle', id, level, input, caption, label }; kick(); },
    play(id, level, result, { caption = '', playing = 'СМОТРИ НА СЦЕНУ', label, onDone } = {}) { mode = { kind: 'play', id, level, result, caption, playing, label, onDone, start: performance.now(), done: false }; kick(); },
    demo(id) { mode = { kind: 'demo', id, script: TASTERS.some((t) => t.id === id) ? demoScript(id) : [], start: performance.now() }; kick(); },
    stop() { mode = null; if (raf) cancelAnimationFrame(raf); raf = 0; },
    state: () => (mode ? { kind: mode.kind, id: mode.id, done: mode.done ?? null } : null),
  };
}
