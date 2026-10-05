// 17.4 · AR-ШЛЕМ. Сергей 02.10: «даже к компьютеру подходить не обязательно.
// Можно надевать на себя шлем виртуальной реальности, и тогда у тебя
// AR-вещи появляются сразу поверх, и ты можешь прямо в игре чинить, прогать
// и вот это всё делать».
//
// Pure (no DOM): the headset's state machine (found on the workbench, put on
// / taken off, the holo editor open / closed), the projection that pins a
// holo-tag to a world point through the raycaster's own camera, what each
// tag reads out, the command packets of the garage gateway as flights in 3D,
// the look of the visor per engine era, and the small "broken things" of the
// garage and the apartment -- each one a tiny Python task judged by the same
// strict interpreter as the gateway (garage-rule.js). fp-world.js draws and
// drives it; tools/ar-headset.test.mjs pins it.
import { runRule, compileRule, formatRuleError } from './garage-rule.js';
import { GARAGE, judgeNight, simGarage, garageDay } from './garage-night.js';
import { eraSettings } from './engine-eras.js';

const freeze = Object.freeze;

export const AR_OWNED_KEY = 'quequest.ar.owned';
export const AR_FIXED_KEY = 'quequest.ar.fixed';
export const AR_TASK_KEY = (id) => `quequest.ar.task.${id}`;
export const AR_TOGGLE_KEYS = freeze(['KeyQ', 'KeyV']);
// Where it lies: on the workbench, next to the laptop.
export const HEADSET_SPOT = freeze({ x: 1.62, z: 6.35, y: 0.95 });

// ------------------------------------------------------------ state machine
// none (not found) → off (owned) → boot (visor drops) → on ⇄ edit
//                                   on → unboot (visor lifts) → off
export const HEADSET_TIMELINE = freeze({ boot: 1500, unboot: 420, bootReduced: 300 });

// A better device boots faster (vr-devices.js: boot multiplier).
export function bootLength({ reduced = false, speed = 1 } = {}) {
  return reduced ? HEADSET_TIMELINE.bootReduced : Math.round(HEADSET_TIMELINE.boot * speed);
}

export function createHeadsetState({ owned = false } = {}) {
  return { phase: owned ? 'off' : 'none', since: 0, editor: null, reduced: false };
}

export function headsetStep(state, event, now = 0, payload = {}) {
  const s = state;
  const age = now - s.since;
  switch (event) {
    case 'pickup':
      return s.phase === 'none' ? { ...s, phase: 'off', since: now } : s;
    case 'toggle':
      if (s.phase === 'off') return { ...s, phase: 'boot', since: now, reduced: Boolean(payload.reduced), bootMs: bootLength(payload), editor: null };
      if (s.phase === 'on' || s.phase === 'edit' || s.phase === 'boot') return { ...s, phase: 'unboot', since: now, editor: null };
      return s;
    case 'tick': {
      if (s.phase === 'boot' && age >= (s.bootMs ?? HEADSET_TIMELINE.boot)) return { ...s, phase: 'on', since: now };
      if (s.phase === 'unboot' && age >= HEADSET_TIMELINE.unboot) return { ...s, phase: 'off', since: now };
      return s;
    }
    case 'open':
      if (s.phase !== 'on' || !payload.tag) return s;
      return { ...s, phase: 'edit', since: now, editor: payload.tag };
    case 'close':
      return s.phase === 'edit' ? { ...s, phase: 'on', since: now, editor: null } : s;
    default:
      return s;
  }
}
export const headsetOwned = (s) => s.phase !== 'none';
export const headsetWorn = (s) => s.phase === 'on' || s.phase === 'edit';
export const headsetVisible = (s) => s.phase === 'boot' || s.phase === 'on' || s.phase === 'edit' || s.phase === 'unboot';
export function headsetProgress(s, now) {
  const ms = s.phase === 'boot' ? (s.bootMs ?? HEADSET_TIMELINE.boot) : s.phase === 'unboot' ? HEADSET_TIMELINE.unboot : 0;
  if (!ms) return headsetWorn(s) ? 1 : 0;
  return Math.max(0, Math.min(1, (now - s.since) / ms));
}

// --------------------------------------------------------------- projection
// The exact math of raycaster.js' sprites: yaw 0 looks to -z, +x is right.
// view: { F, horizon } as renderer.render() returns them; cam: { x, z, yaw, eye }.
export const AR_NEAR = 0.25;
export function projectPoint(cam, view, W, p) {
  // 17.5: the polygon rungs hand over their own view-projection (engine-core.js).
  if (view && typeof view.project === 'function') return view.project(p);
  const sin = Math.sin(cam.yaw), cos = Math.cos(cam.yaw);
  const rx = p.x - cam.x, rz = p.z - cam.z;
  const dz = rx * sin - rz * cos;
  const dx = rx * cos + rz * sin;
  if (dz < AR_NEAR) return { x: NaN, y: NaN, dz, front: false };
  return { x: W / 2 + (dx / dz) * view.F, y: view.horizon - ((p.y ?? 0) - cam.eye) * view.F / dz, dz, front: true };
}
// On screen (with a margin) and in front of the camera.
export function onScreen(pt, W, H, margin = 0) {
  return pt.front && pt.x >= -margin && pt.x < W + margin && pt.y >= -margin && pt.y < H + margin;
}
// Is the anchor hidden behind a wall? depth: the renderer's depth buffer.
export function occluded(pt, depth, W, H, slack = 0.35) {
  if (!depth || !onScreen(pt, W, H)) return false;
  const i = Math.min(H - 1, Math.max(0, Math.round(pt.y))) * W + Math.min(W - 1, Math.max(0, Math.round(pt.x)));
  return depth[i] + slack < pt.dz;
}

// ------------------------------------------------------------- visor looks
// One per engine era: Wolfenstein/Doom chunky green wireframe, Build amber,
// Quake/Unreal cyan glass, Half-Life a clean hazard-suit orange HUD.
export const AR_STYLES = freeze([
  freeze({ id: 'wire', name: 'ШЛЕМ-92 · ВЕКТОР', fg: [70, 255, 100], dim: [20, 120, 45], bad: [255, 80, 60], good: [140, 255, 140], bg: [0, 26, 8], fill: 0.5, scan: true, line: 2, boot: ['ШЛЕМ-92 BIOS', 'ВЕКТОРНЫЙ ДИСПЛЕЙ: OK', 'ПРИВЯЗКА К ЛУЧАМ...', 'СКАН КОМНАТЫ'] }),
  freeze({ id: 'wire', name: 'ШЛЕМ-93 · ВЕКТОР', fg: [90, 255, 110], dim: [24, 120, 50], bad: [255, 70, 50], good: [150, 255, 150], bg: [0, 22, 6], fill: 0.5, scan: true, line: 2, boot: ['ШЛЕМ-93 BIOS', 'СЕКТОРА: OK', 'ПРИВЯЗКА К КАМЕРЕ...', 'СКАН КОМНАТЫ'] }),
  freeze({ id: 'amber', name: 'ШЛЕМ-96 · BUILD', fg: [255, 196, 70], dim: [130, 90, 20], bad: [255, 70, 50], good: [150, 255, 120], bg: [26, 14, 0], fill: 0.55, scan: true, line: 1, boot: ['ШЛЕМ-96', 'ЗЕРКАЛА И ДВЕРИ: OK', 'ПРИВЯЗКА К КАМЕРЕ...', 'СКАН КОМНАТЫ'] }),
  freeze({ id: 'glass', name: 'ШЛЕМ-96Q · СТЕКЛО', fg: [120, 230, 255], dim: [40, 100, 130], bad: [255, 90, 80], good: [140, 255, 190], bg: [2, 16, 26], fill: 0.6, scan: false, line: 1, boot: ['ШЛЕМ-96Q', 'КАРТА СВЕТА: OK', 'ПРИВЯЗКА К КАМЕРЕ...', 'СКАН ОБЪЁМА'] }),
  freeze({ id: 'glass', name: 'ШЛЕМ-98 · НЕОН', fg: [140, 220, 255], dim: [60, 90, 150], bad: [255, 90, 120], good: [140, 255, 200], bg: [6, 10, 30], fill: 0.62, scan: false, line: 1, accent: [255, 110, 220], boot: ['ШЛЕМ-98', '3D-УСКОРИТЕЛЬ: OK', 'ЦВЕТНОЙ СВЕТ: OK', 'СКАН ОБЪЁМА'] }),
  freeze({ id: 'hev', name: 'ЗАЩИТНЫЙ HUD · 1998', fg: [255, 168, 50], dim: [150, 90, 20], bad: [255, 70, 40], good: [170, 255, 120], bg: [10, 8, 4], fill: 0.66, scan: false, line: 1, boot: ['ДОБРО ПОЖАЛОВАТЬ', 'ЗАЩИТНЫЙ HUD АКТИВЕН', 'ДАТЧИКИ СРЕДЫ: OK', 'СКАН ПОМЕЩЕНИЯ'] }),
]);
export function arStyle(era) { return AR_STYLES[eraSettings(era).n]; }

// ------------------------------------------------------------- broken things
// Each task: the variables the device gives the code, a starter that is
// wrong in a way you can SEE in the room, cases that define "fixed", and
// what to read back (a variable, or what was printed).
const ONE_PRINT = (r) => {
  const t = String(r.prints[0] ?? '').trim().toUpperCase();
  if (t === 'ОТКРЫТЬ') return 'open';
  if (t === 'ЗАКРЫТО' || t === 'ЗАКРЫТЬ') return 'closed';
  return r.prints.length ? `?${r.prints[0]}` : 'closed';
};
export const AR_TASKS = freeze({
  lamp: freeze({
    id: 'lamp', level: 'garage', thing: 'worklamp', reward: 80,
    title: 'РАБОЧАЯ ЛАМПА МИГАЕТ',
    brief: 'Контроллер лампы крутит это правило каждый такт: tick = 0, 1, 2, 3, снова 0… switch — выключатель (True / False). Лампа горит, когда light == "on". Сейчас она мигает. Сделай так, чтобы она просто слушалась выключателя.',
    vars: 'switch, tick',
    starter: [
      '# РАБОЧАЯ ЛАМПА · контроллер',
      '# switch — выключатель: True / False',
      '# tick — такт: 0, 1, 2, 3, 0, 1...',
      'light = "off"',
      'if switch:',
      '    light = "on"',
      'if tick == 1 or tick == 3:',
      '    light = "off"',
    ].join('\n'),
    solution: 'light = "off"\nif switch:\n    light = "on"',
    chips: [['if switch:', 'if switch:\n    '], ['light = "on"', 'light = "on"'], ['light = "off"', 'light = "off"']],
    cases: [0, 1, 2, 3].flatMap((tick) => [true, false].map((sw) => freeze({ vars: freeze({ switch: sw, tick }), want: sw ? 'on' : 'off' }))),
    read: (r) => (Object.prototype.hasOwnProperty.call(r.env, 'light') ? String(r.env.light) : '?нет light'),
    win: 'Лампа больше не мигает: горит, когда выключатель включён, и только тогда.',
  }),
  lock: freeze({
    id: 'lock', level: 'home', thing: 'lock', reward: 100,
    title: 'ЗАМОК ОТКРЫВАЕТ ВСЕМ',
    brief: 'Кодовый замок входной двери. who — кто у двери ("я", "сосед", "курьер", "кот"), code — что набрали на панели. Наш код — "0310" (записан на стикере у двери). Сейчас замок открывает любому. Открывай только тому, кто набрал наш код: print("ОТКРЫТЬ"), иначе print("ЗАКРЫТО").',
    vars: 'who, code',
    starter: [
      '# ЗАМОК · ВХОДНАЯ ДВЕРЬ',
      '# who — кто у двери, code — что набрали',
      '# ответ замку: print("ОТКРЫТЬ") или print("ЗАКРЫТО")',
      'print("ОТКРЫТЬ")',
    ].join('\n'),
    solution: 'if code == "0310":\n    print("ОТКРЫТЬ")\nelse:\n    print("ЗАКРЫТО")',
    chips: [['if code == "0310":', 'if code == "0310":\n    '], ['else:', 'else:\n    '], ['print("ОТКРЫТЬ")', 'print("ОТКРЫТЬ")'], ['print("ЗАКРЫТО")', 'print("ЗАКРЫТО")']],
    cases: freeze([
      freeze({ vars: freeze({ who: 'я', code: '0310' }), want: 'open' }),
      freeze({ vars: freeze({ who: 'курьер', code: '' }), want: 'closed' }),
      freeze({ vars: freeze({ who: 'сосед', code: '0000' }), want: 'closed' }),
      freeze({ vars: freeze({ who: 'я', code: '' }), want: 'closed' }),
      freeze({ vars: freeze({ who: 'сосед', code: '0310' }), want: 'open' }),
      freeze({ vars: freeze({ who: 'кот', code: '1111' }), want: 'closed' }),
    ]),
    read: ONE_PRINT,
    win: 'Замок держит: открывает только по коду 0310.',
  }),
  fridge: freeze({
    id: 'fridge', level: 'home', thing: 'fridge', reward: 80,
    title: 'ХОЛОДИЛЬНИК ПИЩИТ БЕЗ КОНЦА',
    brief: 'Пищалка холодильника. door — открыта ли дверь (True / False), seconds — сколько секунд она открыта. Пищать (beep = True) нужно, только если дверь открыта дольше 30 секунд. Сейчас он пищит всегда.',
    vars: 'door, seconds',
    starter: [
      '# ХОЛОДИЛЬНИК · ПИЩАЛКА',
      '# door — дверь открыта? True / False',
      '# seconds — сколько секунд открыта',
      'beep = True',
    ].join('\n'),
    solution: 'beep = False\nif door and seconds > 30:\n    beep = True',
    chips: [['beep = False', 'beep = False'], ['if door and seconds > 30:', 'if door and seconds > 30:\n    '], ['beep = True', 'beep = True']],
    cases: freeze([
      freeze({ vars: freeze({ door: false, seconds: 0 }), want: false }),
      freeze({ vars: freeze({ door: true, seconds: 5 }), want: false }),
      freeze({ vars: freeze({ door: true, seconds: 30 }), want: false }),
      freeze({ vars: freeze({ door: true, seconds: 31 }), want: true }),
      freeze({ vars: freeze({ door: true, seconds: 90 }), want: true }),
      freeze({ vars: freeze({ door: false, seconds: 90 }), want: false }),
    ]),
    read: (r) => (Object.prototype.hasOwnProperty.call(r.env, 'beep') ? r.env.beep === true || r.env.beep === 1 : '?нет beep'),
    win: 'Тишина. Холодильник пищит, только если дверь забыли открытой дольше 30 секунд.',
  }),
});
export const AR_TASK_IDS = freeze(Object.keys(AR_TASKS));

const show = (v) => (v === true ? 'True' : v === false ? 'False' : typeof v === 'string' ? `"${v}"` : String(v));
// Runs a task's code on every case. ok only if every case gives what it should.
export function checkTask(id, source) {
  const task = AR_TASKS[id];
  if (!task) return { ok: false, error: { type: 'Error', text: 'нет такой поломки', line: null }, results: [], message: 'нет такой поломки' };
  const compiled = compileRule(source);
  if (!compiled.ok) return { ok: false, error: compiled.error, results: [], message: formatRuleError(compiled.error) };
  const results = task.cases.map((c) => {
    const r = compiled.judge({ ...c.vars });
    const got = r.error ? `!${r.error.type}` : task.read(r);
    return { vars: c.vars, want: c.want, got, pass: !r.error && got === c.want, error: r.error, prints: r.prints };
  });
  const fail = results.find((r) => !r.pass);
  const ok = !fail;
  let message = task.win;
  if (fail) {
    const vars = Object.entries(fail.vars).map(([k, v]) => `${k} = ${show(v)}`).join(', ');
    message = fail.error ? `При ${vars}: ${formatRuleError(fail.error)}` : `При ${vars} получилось ${typeof fail.got === 'string' && fail.got.startsWith('?') ? fail.got.slice(1) : show(fail.got === 'open' ? 'ОТКРЫТЬ' : fail.got === 'closed' ? 'ЗАКРЫТО' : fail.got)}, а нужно ${show(fail.want === 'open' ? 'ОТКРЫТЬ' : fail.want === 'closed' ? 'ЗАКРЫТО' : fail.want)}.`;
  }
  return { ok, error: null, results, passed: results.filter((r) => r.pass).length, total: results.length, message };
}

// What the device does right now with the player's code (for the room).
// Lamp: four ticks of light, true = lit. null = the code does not run.
export function lampSequence(source, switchOn) {
  const c = compileRule(source);
  if (!c.ok) return null;
  return [0, 1, 2, 3].map((tick) => { const r = c.judge({ switch: Boolean(switchOn), tick }); return !r.error && r.env.light === 'on'; });
}
export function fridgeBeeps(source, door, seconds) {
  const r = runRule(source, { door: Boolean(door), seconds: Math.floor(seconds) });
  return !r.ok ? true : r.env.beep === true || r.env.beep === 1;
}
export function lockOpensFor(source, who, code) {
  const r = runRule(source, { who, code });
  return r.ok && ONE_PRINT(r) === 'open';
}

// ------------------------------------------------------------------ tags
// The holo-tags: one per scriptable thing, anchored a little above it.
// edit: which code the holo editor opens on E ('gateway' or a task id).
const TAG = (id, x, z, y, title, extra = {}) => freeze({ id, x, z, y, title, ...extra });
export const AR_TAGS = freeze({
  garage: freeze([
    TAG('car', 6.0, 6.5, 2.05, 'ШЛЮЗ · СИНЯЯ МАШИНА', { thing: 'car', edit: 'gateway', kind: 'gateway' }),
    TAG('worklamp', 3.2, 7.6, 1.95, 'РАБОЧАЯ ЛАМПА', { thing: 'worklamp', edit: 'lamp', kind: 'lamp', group: 'work' }),
    TAG('sw-main', 14.9, 9.0, 1.65, 'СВЕТ · ГАРАЖ', { thing: 'sw-main', kind: 'switch', group: 'main' }),
    TAG('loftlamp', 12.0, 1.2, 3.45, 'ЛАМПА · АНТРЕСОЛЬ', { thing: 'loftlamp', kind: 'switch', group: 'loft' }),
    TAG('radio', 11.0, 1.4, 2.4, 'МАГНИТОЛА', { thing: 'radio', kind: 'radio' }),
    TAG('rolldoor', 5.9, 11.9, 2.3, 'ВОРОТА', { thing: 'rolldoor', kind: 'rolldoor' }),
    TAG('laptop', 1.62, 4.6, 1.45, 'НОУТБУК', { thing: 'laptop', kind: 'laptop' }),
    TAG('arcade', 1.6, 11.35, 2.15, 'АВТОМАТ · JUMP KILL', { thing: 'arcade', kind: 'arcade' }),
  ]),
  home: freeze([
    TAG('lock', 13.9, 10.25, 1.75, 'ЗАМОК · ВХОДНАЯ ДВЕРЬ', { thing: 'lock', edit: 'lock', kind: 'lock' }),
    TAG('fridge', 12.95, 8.5, 2.05, 'ХОЛОДИЛЬНИК', { thing: 'fridge', edit: 'fridge', kind: 'fridge' }),
    TAG('tv', 9.5, 0.95, 2.3, 'ТЕЛЕВИЗОР', { thing: 'tv', kind: 'tv' }),
    TAG('sw-bed', 6.93, 6.2, 1.85, 'СВЕТ · КОМНАТА', { thing: 'sw-bed', kind: 'switch', group: 'bedroom' }),
    TAG('sw-living', 13.93, 6.2, 1.85, 'СВЕТ · ГОСТИНАЯ', { thing: 'sw-living', kind: 'switch', group: 'living' }),
    TAG('sw-kitchen', 8.5, 8.07, 1.85, 'СВЕТ · КУХНЯ', { thing: 'sw-kitchen', kind: 'switch', group: 'kitchen' }),
    TAG('door-bath', 2.5, 7.5, 2.0, 'ДВЕРЬ · ВАННАЯ', { thing: 'door-bath', kind: 'door' }),
    TAG('pc', 5.6, 1.35, 1.8, 'КОМПЬЮТЕР', { thing: 'pc', kind: 'pc' }),
    TAG('cat', 10.4, 5.45, 1.35, 'КОТ БАЙТ', { thing: 'cat', kind: 'cat' }),
  ]),
});
export function tagFor(level, thingId) { return (AR_TAGS[level] ?? []).find((t) => t.thing === thingId) ?? null; }

// First line of code that is not a comment, for a one-line readout.
export function codeLine(source, max = 34) {
  const line = String(source ?? '').split('\n').map((l) => l.trim()).find((l) => l && !l.startsWith('#')) ?? '';
  return line.length > max ? `${line.slice(0, max - 2)}..` : line;
}

// What a tag says. ctx: { ws, fixed: Set|array, codes: { [task]: source },
// gateway: { day, rule, blocked, passed, leaks, phase } }.
// Returns { lines: [..], tone: 'ok' | 'bad' | 'info' }.
export function tagReadout(tag, ctx = {}) {
  const ws = ctx.ws ?? {};
  const fixed = new Set(ctx.fixed ?? []);
  const lit = (g) => ws.lights?.[g] !== false;
  switch (tag.kind) {
    case 'gateway': {
      const g = ctx.gateway ?? {};
      const lines = [`ДЕНЬ ${g.day ?? 1} · ${codeLine(g.rule, 28) || 'ПРАВИЛА НЕТ'}`, `ПРОПУСК ${g.passed ?? 0} · БЛОК ${g.blocked ?? 0} · ЧУЖИЕ ${g.leaks ?? 0}`];
      if (g.error) lines[1] = `ОШИБКА: ${g.error}`;
      return { lines, tone: g.error || (g.leaks ?? 0) > 0 ? 'bad' : 'ok' };
    }
    case 'lamp': {
      if (!ctx.owned || fixed.has('lamp')) return { lines: ['IF SWITCH: LIGHT = "ON"', `SWITCH = ${lit(tag.group) ? 'TRUE' : 'FALSE'}`], tone: 'ok' };
      return { lines: [codeLine(ctx.codes?.lamp ?? AR_TASKS.lamp.starter), 'МИГАЕТ · E — ПОЧИНИТЬ'], tone: 'bad' };
    }
    case 'switch':
      return { lines: ['IF SWITCH: LIGHT = "ON"', `SWITCH = ${lit(tag.group) ? 'TRUE' : 'FALSE'}`], tone: 'info' };
    case 'radio':
      return { lines: [`RADIO = ${ws.radio ? 'TRUE' : 'FALSE'}`, 'SRC = "RADIO" → ШЛЮЗ'], tone: 'info' };
    case 'rolldoor':
      return { lines: [`DOOR = "${ws.doors?.rolldoor ? 'OPEN' : 'CLOSED'}"`, 'SRC = "AIR" ЛЕТИТ С УЛИЦЫ'], tone: 'info' };
    case 'laptop':
      return { lines: ['E — НЫРНУТЬ В ПРОГРАММУ', 'ИЛИ ЧИНИ ШЛЮЗ ПРЯМО ЗДЕСЬ'], tone: 'info' };
    case 'lock': {
      if (fixed.has('lock')) return { lines: ['IF CODE == "0310": ОТКРЫТЬ', 'ЗАМОК ДЕРЖИТ'], tone: 'ok' };
      return { lines: [codeLine(ctx.codes?.lock ?? AR_TASKS.lock.starter), 'ОТКРЫВАЕТ ВСЕМ · E — ПОЧИНИТЬ'], tone: 'bad' };
    }
    case 'fridge': {
      if (fixed.has('fridge')) return { lines: [`DOOR = ${ws.fridge ? 'TRUE' : 'FALSE'} · BEEP = ${ctx.fridgeBeep ? 'TRUE' : 'FALSE'}`, 'ПИЩИТ ПО ДЕЛУ'], tone: 'ok' };
      return { lines: [codeLine(ctx.codes?.fridge ?? AR_TASKS.fridge.starter), 'ПИЩИТ ВСЕГДА · E — ПОЧИНИТЬ'], tone: 'bad' };
    }
    case 'tv':
      return { lines: [`TV = ${ws.tv ? 'TRUE' : 'FALSE'}`, ws.tv ? 'КАНАЛ = "НОВОСТИ"' : 'КАНАЛ = NONE'], tone: 'info' };
    case 'door':
      return { lines: [`DOOR = "${ws.doors?.['door-bath'] ? 'OPEN' : 'CLOSED'}"`], tone: 'info' };
    case 'pc':
      return { lines: ['E — НЫРНУТЬ · ДВИЖОК.EXE'], tone: 'info' };
    case 'arcade':
      return { lines: ['E — НЫРНУТЬ В ЛАБИРИНТ', 'JUMP KILL · УРОВНИ И ДРУЗЬЯ'], tone: 'info' };
    case 'cat':
      return { lines: ['HUNGRY = TRUE', 'ЭТО НЕ ЛЕЧИТСЯ КОДОМ'], tone: 'info' };
    default:
      return { lines: [], tone: 'info' };
  }
}

// --------------------------------------------------------- gateway packets
// Where the commands come from in the garage: "air" from the street, "app"
// from the owner's phone (through the door to the flat), "radio" from the
// radio on the loft. They all fly into the car's gateway above the roof.
export const AR_EMITTERS = freeze({
  air: freeze({ x: 6.0, z: 15.2, y: 1.3 }),
  app: freeze({ x: 14.6, z: 10.5, y: 1.5 }),
  radio: freeze({ x: 11.0, z: 1.4, y: 2.15 }),
});
export const AR_GATE = freeze({ x: 6.0, z: 6.5, y: 2.05 });
export const AR_CAR_IN = freeze({ x: 6.0, z: 6.5, y: 1.0 });
export const SHATTER_S = 0.6;
const lerp = (a, b, k) => a + (b - a) * k;

// Every packet's place at night-time t (seconds). stage: 'fly' (to the
// gate), 'in' (passed, sinking into the car), 'shatter' (blocked, shards).
// colour: who sent it while flying, the verdict after the gate.
export function packetFlights(night, t) {
  const out = [];
  if (!night) return out;
  for (const p of night.packets) {
    if (t < p.t) continue;
    const from = AR_EMITTERS[p.src] ?? AR_EMITTERS.air;
    const tone = p.who === 'owner' ? 'owner' : p.who === 'radio' ? 'radio' : 'stranger';
    if (t < p.atGate) {
      const k = (t - p.t) / (p.atGate - p.t);
      const at = (kk) => { const ee = kk * kk * (3 - 2 * kk); return { x: lerp(from.x, AR_GATE.x, ee), z: lerp(from.z, AR_GATE.z, ee), y: lerp(from.y, AR_GATE.y, ee) + Math.sin(Math.PI * kk) * 0.9 }; };
      const trail = [0.04, 0.08, 0.12].filter((d) => k - d > 0).map((d, i) => ({ ...at(k - d), w: 1 - (i + 1) / 4 }));
      out.push({ id: p.id, stage: 'fly', k, tone, verdict: null, ...at(k), trail, p });
      continue;
    }
    if (p.verdict === 'pass' && p.atCar !== undefined && t < p.atCar) {
      const k = (t - p.atGate) / (p.atCar - p.atGate);
      out.push({ id: p.id, stage: 'in', k, tone: p.leak ? 'leak' : 'pass', verdict: 'pass', x: lerp(AR_GATE.x, AR_CAR_IN.x, k), z: lerp(AR_GATE.z, AR_CAR_IN.z, k), y: lerp(AR_GATE.y, AR_CAR_IN.y, k), p });
      continue;
    }
    if (p.verdict !== 'pass' && t < p.atGate + SHATTER_S) {
      const k = (t - p.atGate) / SHATTER_S;
      out.push({ id: p.id, stage: 'shatter', k, tone: p.denied ? 'denied' : 'block', verdict: p.verdict, x: AR_GATE.x, z: AR_GATE.z, y: AR_GATE.y, shards: shards(p.id, k), p });
    }
  }
  return out;
}
// Six shards per blocked packet, flying out and falling; deterministic.
export function shards(id, k) {
  const out = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + id * 0.7;
    const v = 0.9 + ((id * 7 + i * 3) % 5) * 0.12;
    out.push({ x: AR_GATE.x + Math.cos(a) * v * k, z: AR_GATE.z + Math.sin(a) * v * k, y: AR_GATE.y + (0.6 * k - 1.6 * k * k) });
  }
  return out;
}

// The gateway as seen through the headset: the night on loop ('watch') or
// one real run ('run'). Night-time per wall-clock: watch loops the night
// part; run plays to the end (fast-forward and slow-mo are the caller's).
export const WATCH_SPAN = GARAGE.night + 1.8;
export function gatewayNight(rule, day = 1, { picklock = null, watch = false } = {}) {
  const night = judgeNight(rule ?? garageDay(day).starter, day, { picklock });
  if (!watch) return night;
  return { ...night, packets: night.packets.filter((p) => p.phase === 'night'), end: WATCH_SPAN };
}
export function gatewayCounters(night, day, t) {
  const sim = simGarage({ day, night }, t);
  return { passed: sim.ownerIn + sim.packets.filter((p) => p.verdict === 'pass' && p.harmless && p.atCar !== undefined && p.atCar <= t).length, blocked: sim.blocked, leaks: sim.leaks, denied: sim.denied, errors: sim.errors };
}
