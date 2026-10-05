// «JUMP KILL · Лабиринт» — the world's arena: everyone goes there, climbs
// levels and fights each other. A nod to the Doom-like labyrinth of
// Deeptown, under the author's own game name. The game itself is the author's Black Ice
// NIGHTFALL (aka-gst/jump-kill, games/blackice/, MIT); this module is the pure
// part on the QueQuest side: the floor ladder, the people you fight (bots with
// names and personalities of QueQuest's NPCs), the message contract, the
// idempotent reward, the local leaderboard and ghost store, and the feed event.
// blackice-bridge.js is the DOM half. tools/labyrinth.test.mjs.
//
// Protocol 1, postMessage between same-origin windows only:
//   QueQuest -> game {source:'quequest', type:'hello', protocol:1, player, floor, ghost?}
//   game -> QueQuest {source:'blackice', type:'ready', protocol:1, version}
//                    {source:'blackice', type:'floor-clear'|'match-end', protocol:1,
//                     floor, mode, won, kills, deaths, time, score, ghost?}
// Rewards are paid by the table below, never by numbers in a message, and once
// per floor: the key `labyrinth:floor-NN` in profile.awards.

import { awardCampusXp } from './campus-profile.js';

export const BLACKICE_PROTOCOL = 1;
export const BLACKICE_SRC = 'games/blackice/index.html';
// Сергей 02.10: «пока пусть будет jump kill» — the program keeps the game's name.
export const LABYRINTH_NAME = 'JUMP KILL · ЛАБИРИНТ';
export const LABYRINTH_EVENT = 'labyrinth:floor';
export const LABYRINTH_STORE_KEY = 'quequest-labyrinth-v1';

const freeze = Object.freeze;

// The people of the world, as arena bots. role: Black Ice's bot roles —
// rocketeer (rockets, leads the target), striker (bursts, strafes), lancer
// (charged rail beam). hp/speed multiply the stock bot.
export const LABYRINTH_ROSTER = freeze({
  vitya: freeze({ id: 'vitya', name: 'ВИТЯ', who: 'сосед по гаражу', role: 'rocketeer', hp: 1, speed: 1, taunt: 'Шлем как у мухи, зато видит всё!' }),
  welder: freeze({ id: 'welder', name: 'СВАРЩИК', who: 'рабочий склада', role: 'lancer', hp: 1, speed: 0.9, taunt: 'Шов ровный. А вот ты — нет.' }),
  fitter: freeze({ id: 'fitter', name: 'СЛЕСАРЬ', who: 'рабочий склада', role: 'striker', hp: 1, speed: 1, taunt: 'Попрыгай ещё. Глядишь, фраги сами пойдут.' }),
  electrician: freeze({ id: 'electrician', name: 'ЭЛЕКТРИК', who: 'рабочий склада', role: 'lancer', hp: 0.9, speed: 1.15, taunt: 'Только не на щиток. Ой. Поздно.' }),
  loader: freeze({ id: 'loader', name: 'ГРУЗЧИК', who: 'рабочий склада', role: 'striker', hp: 1.6, speed: 0.8, taunt: 'Мм. Физкультура. Уважаю. (жуёт)' }),
  vika: freeze({ id: 'vika', name: 'ВИКА', who: 'подруга', role: 'striker', hp: 0.8, speed: 1.3, taunt: 'Я помню твой маршрут. Весь.' }),
  boss: freeze({ id: 'boss', name: 'НАЧАЛЬНИК', who: 'начальник склада', role: 'rocketeer', hp: 3, speed: 0.9, taunt: 'Прыгать будешь в обед. Работай.' }),
});

// Black Ice ships one arena and three modes (ARENA, FLIGHT SCHOOL, CITADEL).
// The Labyrinth is a run of levels on top of it: each has its own layout
// (games/blackice/levels/NN.json, a few hundred bytes, fetched only when the
// level is entered and built by the game's own procedural parts), an
// objective, a roster, mutators and three story beats. Two levels use the
// stock maps (level: null). par: the NPCs' own results (seconds), the bar on
// the local board.
//   objective: frags — reach the frag limit; rings — the ring course, no
//   enemies; breach — the ring course under fire; mission — CITADEL.
const F = (n, id, title, mode, objective, brief, o = {}) => freeze({
  n, id, title, mode, objective, brief,
  intro: o.intro ?? brief, outro: o.outro ?? '', beats: freeze((o.beats ?? []).map(([at, text]) => freeze({ at, text }))),
  level: o.level === null ? null : `games/blackice/levels/${String(n).padStart(2, '0')}.json`,
  fragLimit: o.fragLimit ?? 10, duration: o.duration ?? 240,
  roster: freeze(o.roster ?? []), bots: (o.roster ?? []).length || 1,
  botHp: o.botHp ?? 1, botSpeed: o.botSpeed ?? 1, damageTaken: o.damageTaken ?? 1,
  mutators: freeze(o.mutators ?? []),
  par: freeze(o.par ?? []),
  xp: 60 + n * 25, pay: n * 120,
});
export const LABYRINTH_FLOORS = freeze([
  F(1, 'sluice', 'ШЛЮЗ', 'training', 'rings', 'Вход в Лабиринт. Шесть колец: бег, прыжок, рывок, двойной прыжок.', {
    intro: 'Это и есть Лабиринт. Ночью сюда ныряет весь город. Сначала — научись двигаться.',
    outro: 'Шлюз открыт. Внизу слышно стрельбу: там уже кто-то есть.',
    beats: [[2, 'ВИТЯ (по рации): «Ты тоже нырнул? Я на складе, спускайся!»'], [5, 'Двойной прыжок — Space ещё раз в воздухе.']], par: [['vika', 21], ['vitya', 34]] }),
  F(2, 'store', 'СКЛАД', 'arena', 'frags', 'Двое со склада пришли размяться после смены. Шесть фрагов.', {
    intro: 'Склад. Грузчик и слесарь — свои, но здесь все друг другу соперники.',
    outro: 'Грузчик: «Ладно, ладно. Завтра на смене поговорим».',
    beats: [[3, 'СЛЕСАРЬ: «Ты где так прыгать научился?»']], fragLimit: 6, duration: 180, roster: ['loader', 'fitter'], botHp: 0.7, damageTaken: 0.6, par: [['loader', 150], ['fitter', 128]] }),
  F(3, 'draft', 'СКВОЗНЯК', 'training', 'rings', 'Террасы и перелёты: десять колец без врагов. Лабиринт проверяет, умеешь ли ты летать.', {
    intro: 'Сквозняк — этаж, где никого нет. Только ветер и высота.',
    outro: 'ВИКА: «Видела твой перелёт. Неплохо. Встретимся ниже».',
    beats: [[4, 'Стены здесь можно пробегать — двигайся вдоль стены в воздухе.'], [8, 'Не долетишь — пад слева внизу подбросит.']], par: [['vika', 64], ['vitya', 95]] }),
  F(4, 'shop', 'ЦЕХ', 'arena', 'frags', 'Весь склад после смены. Сварщик бьёт лучом издалека — не стой на открытом.', {
    intro: 'Цех. Три террасы, QUAD на центральном станке. Кто держит центр — держит этаж.',
    outro: 'СВАРЩИК: «Шов ровный. Признаю».',
    beats: [[4, 'QUAD на центральном станке — пад внизу закинет.'], [8, 'Ещё два — и вниз.']], fragLimit: 10, duration: 240, roster: ['welder', 'fitter', 'loader'], botHp: 0.9, damageTaken: 0.8, par: [['welder', 205], ['fitter', 220]] }),
  F(5, 'breach', 'ПРОРЫВ', 'arena', 'breach', 'Шесть колец к выходу, пока по тебе стреляют. Фраги не нужны — нужна скорость.', {
    intro: 'Кто-то запер нижние этажи. Прорвись к выходу, пока охрана не опомнилась.',
    outro: 'ЭЛЕКТРИК: «Это не я запер. Говорят, ключи у начальника».',
    beats: [[2, 'ЭЛЕКТРИК: «Стой! Тут нельзя бегать!»'], [4, 'Выход близко. Не останавливайся.']], duration: 200, roster: ['electrician', 'fitter', 'vitya'], par: [['vika', 70], ['vitya', 96]] }),
  F(6, 'rockets', 'РАКЕТНЫЙ ДВОР', 'arena', 'frags', 'Только ракетница. Витя притащил свою. Рокет-джамп — X, башни берутся только им.', {
    intro: 'Ракетный двор. Витя: «Шлем как у мухи — а ракету вижу издалека!»',
    outro: 'ВИТЯ: «Ты на ракете летал? В моём шлеме? Уважаю».',
    beats: [[6, 'На башнях MEGA и QUAD. Рокет-джамп: X.']], fragLimit: 12, duration: 240, roster: ['vitya', 'welder', 'fitter', 'electrician'], mutators: ['rockets'], par: [['vitya', 190], ['electrician', 230]] }),
  F(7, 'towers', 'ДВЕ БАШНИ', 'arena', 'frags', 'Только рельса. Две башни смотрят друг на друга через открытое поле, MEGA — посередине.', {
    intro: 'Две башни. Наверху рельса и весь уровень как на ладони. Внизу — MEGA и смерть.',
    outro: 'ВИКА: «Нижний этаж — зеркальный. Там тебя ждёт… ты».',
    beats: [[6, 'Половина. Смени башню — на старой тебя уже ждут.']], fragLimit: 12, duration: 240, roster: ['electrician', 'welder', 'vika', 'loader'], mutators: ['rail'], botHp: 0.85, par: [['vika', 175], ['electrician', 200]] }),
  F(8, 'mirror', 'ЗЕРКАЛО', 'arena', 'frags', 'Первый забег Лабиринт запоминает. Со второго здесь ходит твой призрак — кадр в кадр, стреляет, когда стрелял ты.', {
    intro: 'Зеркальный этаж. Лабиринт запомнил, как ты бегал. Теперь это твой враг.',
    outro: 'Призрак гаснет. Лабиринт учится на тебе — значит, и ты на нём.',
    beats: [[7, 'Порталы по бокам переносят на другую сторону с той же скоростью.']], fragLimit: 14, duration: 270, roster: ['vika', 'vitya', 'fitter'], par: [['vika', 230]] }),
  F(9, 'well', 'КОЛОДЕЦ', 'training', 'rings', 'Шесть колец вверх по террасам. Высота — 6 метров.', {
    intro: 'Колодец. Единственный путь вниз в Лабиринте — сначала наверх.',
    outro: 'С вершины видно: в самом низу горит кабинет начальника.',
    beats: [[3, 'Каждая терраса — 1,2 м. Один прыжок.']], par: [['vika', 30], ['vitya', 52]] }),
  F(10, 'roofs', 'СТЕКЛЯННЫЕ КРЫШИ', 'arena', 'frags', 'Крыши над улицей: 60 здоровья, без брони, быстрые ноги. Упал на улицу — пад закинет обратно.', {
    intro: 'Стеклянные крыши. Броню здесь не носят. Прыгай между крышами или разобьёшься.',
    outro: 'ГРУЗЧИК: «Я бы так не смог. Я бы разбился. (жуёт)»',
    beats: [[6, 'Пады на улице закидывают обратно на крыши.']], fragLimit: 12, duration: 240, roster: ['vitya', 'welder', 'electrician', 'fitter', 'loader'], mutators: ['glass', 'haste'], par: [['vitya', 225]] }),
  F(11, 'district', 'РАЙОН 09', 'arena', 'frags', 'Старая арена Black Ice — Ghost District 09. Шесть бойцов, 18 фрагов.', {
    intro: 'Старый район. Здесь Лабиринт начинался — мост, порталы, пады, QUAD на мосту.',
    outro: 'ВИКА: «Дальше — только кабинет. Ты готов?»',
    beats: [[9, 'QUAD — на мосту в центре.']], level: null, fragLimit: 18, duration: 300, roster: ['vika', 'vitya', 'welder', 'electrician', 'fitter', 'loader'], par: [['vika', 260], ['vitya', 290]] }),
  F(12, 'office', 'КАБИНЕТ НАЧАЛЬНИКА', 'arena', 'frags', 'Начальник сам вышел на арену. У него втрое больше брони и ракетница.', {
    intro: 'НАЧАЛЬНИК: «Прыгать будешь в обед. А сейчас — работай!»',
    outro: 'НАЧАЛЬНИК: «Ладно. Ключ от нижнего этажа — твой. Там Цитадель».',
    beats: [[6, 'MEGA на столе начальника.'], [12, 'НАЧАЛЬНИК: «Это ещё не всё!»']], fragLimit: 18, duration: 300, roster: ['boss', 'vitya', 'welder', 'electrician', 'vika', 'loader'], botHp: 1.1, par: [['boss', 280], ['vika', 290]] }),
  F(13, 'citadel', 'ЦИТАДЕЛЬ', 'mission', 'mission', 'Дно Лабиринта: три узла, подкрепления и ARCHON. Выход — у входа.', {
    intro: 'Цитадель. Сердце Лабиринта охраняет ARCHON. Захвати три узла и вернись живым.',
    outro: 'Лабиринт пройден. Город проснётся и будет рассказывать, кто это сделал.',
    beats: [[1, 'Узел взят. Подкрепление уже идёт.'], [3, 'ARCHON проснулся.']], level: null, par: [['boss', 420]] }),
]);
export const floorById = (n) => LABYRINTH_FLOORS.find((f) => f.n === n) ?? null;
export const floorKey = (n) => `labyrinth:floor-${String(n).padStart(2, '0')}`;

// ------------------------------------------------------------- progress
export function labyrinthCleared(profile = {}) {
  const awards = profile.awards ?? {};
  return LABYRINTH_FLOORS.filter((f) => Object.prototype.hasOwnProperty.call(awards, floorKey(f.n))).map((f) => f.n);
}
// Floor 1 is always open; each next one opens when the one below is cleared.
export function floorUnlocked(profile, n) {
  if (!floorById(n)) return false;
  return n === 1 || labyrinthCleared(profile).includes(n - 1);
}
export function nextFloor(profile = {}) {
  const done = new Set(labyrinthCleared(profile));
  return LABYRINTH_FLOORS.find((f) => !done.has(f.n) && floorUnlocked(profile, f.n))?.n ?? null;
}

// The «Лабиринт» stat. The source of truth is the awards ledger (merged by
// profile sync); profile.stats.labyrinthFloors/labyrinthTop are its cached copy.
export function labyrinthStat(profile = {}) {
  const done = labyrinthCleared(profile);
  return { floors: done.length, top: done.length ? Math.max(...done) : 0, total: LABYRINTH_FLOORS.length };
}

// Pure, idempotent: the second clear of the same floor pays 0 and changes
// nothing. The new «Лабиринт» stat lives in profile.stats (kept by
// createCampusProfile): floors cleared and the deepest floor.
export function markLabyrinthFloor(profile = {}, n) {
  const floor = floorById(n);
  const none = { profile, first: false, pay: 0, xp: 0, floor };
  if (!floor) return none;
  const key = floorKey(n);
  if (Object.prototype.hasOwnProperty.call(profile.awards ?? {}, key)) return none;
  let next = awardCampusXp(profile, floor.xp, key);
  const st = labyrinthStat(next);
  next = { ...next, stats: { ...(next.stats ?? {}), labyrinthFloors: st.floors, labyrinthTop: st.top } };
  return { profile: next, first: true, pay: floor.pay, xp: floor.xp, floor };
}

// ------------------------------------------------------------- messages
const GHOST_RE = /^g1:[0-9a-z,;!-]*$/;
// Anything that is not exactly one of our messages is dropped. A floor-clear
// must be for a real floor, in that floor's mode, and in the arena with at
// least the frag limit when frags are the objective.
export function validateBlackIceMessage(data) {
  if (!data || typeof data !== 'object' || data.source !== 'blackice' || data.protocol !== BLACKICE_PROTOCOL) return null;
  if (data.type === 'ready') return { type: 'ready', version: typeof data.version === 'string' ? data.version.slice(0, 40) : '', webgl: data.webgl !== false };
  if (data.type !== 'floor-clear' && data.type !== 'match-end') return null;
  const floor = floorById(data.floor);
  if (!floor || data.mode !== floor.mode) return null;
  const int = (v, max) => Number.isInteger(v) && v >= 0 && v <= max;
  if (!int(data.kills, 999) || !int(data.deaths, 999) || !(Number.isFinite(data.time) && data.time >= 0 && data.time <= 3600)) return null;
  const won = data.type === 'floor-clear';
  if (data.won !== won) return null;
  if (won && floor.objective === 'frags' && data.kills < floor.fragLimit) return null;
  const score = int(data.score, 1e7) ? data.score : 0;
  const ghost = won && typeof data.ghost === 'string' && data.ghost.length <= 80000 && GHOST_RE.test(data.ghost) ? data.ghost : null;
  return { type: data.type, won, floor, kills: data.kills, deaths: data.deaths, time: Math.round(data.time * 100) / 100, score, ghost };
}

// What the game gets for a floor: everything it needs to set it up.
export function floorConfig(floor) {
  const roster = floor.roster.map((id) => LABYRINTH_ROSTER[id]).filter(Boolean)
    .map(({ name, role, hp, speed, taunt }) => ({ name, role, hp, speed, taunt }));
  return {
    n: floor.n, mode: floor.mode, objective: floor.objective, title: floor.title, brief: floor.brief, intro: floor.intro,
    beats: floor.beats.map(({ at, text }) => ({ at, text })),
    fragLimit: floor.fragLimit, duration: floor.duration, bots: Math.max(1, roster.length),
    botHp: floor.botHp, botSpeed: floor.botSpeed, damageTaken: floor.damageTaken,
    mutators: [...floor.mutators], roster,
  };
}
// level: the parsed level file (games/blackice/levels/NN.json) or null for a stock map.
export function helloMessage({ floor, player = '', ghost = null, level = null } = {}) {
  const msg = { source: 'quequest', type: 'hello', protocol: BLACKICE_PROTOCOL, player: String(player ?? '').slice(0, 32), floor: floorConfig(floor), level: floor.level && level && typeof level === 'object' ? level : null };
  if (floor.mode === 'arena' && ghost?.data) msg.ghost = { name: String(ghost.name ?? 'ПРИЗРАК').slice(0, 16), data: ghost.data };
  return msg;
}

// ------------------------------------------------- local board + ghosts
// Async «друг с другом» without a server: per floor, the NPCs' par results
// plus your runs (best 5), and your best arena run kept as a ghost that the
// next visit replays as an enemy.
export function createStore(raw = null) {
  const s = raw && typeof raw === 'object' ? raw : {};
  return { runs: s.runs && typeof s.runs === 'object' ? { ...s.runs } : {}, ghosts: s.ghosts && typeof s.ghosts === 'object' ? { ...s.ghosts } : {} };
}
export function parseStore(text) {
  try { return createStore(JSON.parse(text)); } catch { return createStore(); }
}
const better = (a, b) => (a.won !== b.won ? (a.won ? -1 : 1) : a.won ? a.time - b.time || b.kills - a.kills : b.kills - a.kills || a.time - b.time);
export function recordRun(store, msg, { player = 'ТЫ', at = 0 } = {}) {
  const s = createStore(store);
  const n = msg.floor.n;
  const run = { name: String(player || 'ТЫ').slice(0, 24), won: msg.won, kills: msg.kills, deaths: msg.deaths, time: msg.time, at };
  s.runs[n] = [...(s.runs[n] ?? []), run].sort(better).slice(0, 5);
  let ghostSaved = false;
  if (msg.won && msg.ghost && msg.floor.mode === 'arena') {
    const old = s.ghosts[n];
    if (!old || msg.time < old.time) { s.ghosts[n] = { data: msg.ghost, time: msg.time, kills: msg.kills, at }; ghostSaved = true; }
  }
  return { store: s, ghostSaved };
}
// The board for a floor: NPC pars and your runs, best first.
export function leaderboard(store, n) {
  const floor = floorById(n);
  if (!floor) return [];
  const npc = floor.par.map(([id, time]) => ({ name: LABYRINTH_ROSTER[id]?.name ?? id, npc: true, won: true, time, kills: floor.objective === 'frags' ? floor.fragLimit : 0, deaths: 0 }));
  return [...npc, ...(createStore(store).runs[n] ?? [])].sort(better);
}
// Which ghost walks this level: your own best won run of it (arena only —
// a ghost is a path through that level's walls).
export function ghostFor(store, floor, player = 'ТЫ') {
  if (floor.mode !== 'arena') return null;
  const g = createStore(store).ghosts[floor.n];
  return g?.data ? { name: `${String(player || 'ТЫ').slice(0, 9)}·ПРИЗРАК`, data: g.data, time: g.time } : null;
}

// ------------------------------------------------------- feed / chatter
// window.dispatchEvent(new CustomEvent(LABYRINTH_EVENT, {detail})) after each
// result, so friends can comment later; this table is in npc-chatter's format.
export function labyrinthEventDetail(msg, reward = {}) {
  return { floor: msg.floor.n, title: msg.floor.title, mode: msg.floor.mode, won: msg.won, first: Boolean(reward.first), kills: msg.kills, deaths: msg.deaths, time: msg.time, pay: reward.pay ?? 0, xp: reward.xp ?? 0 };
}
export const LABYRINTH_CHATTER = freeze({
  'labyrinth-clear': { cooldown: 1, priority: 3, lines: [['neighbor', 'Видел тебя в Лабиринте! Уровень {n}, «{title}». Я там ракетами кидался.'], ['radio', 'Ночь FM: кто-то из нашего района прошёл уровень {n} Лабиринта.'], ['cat', 'Мяу. (кот видел, как ты прыгал на ракете)']] },
  'labyrinth-fail': { cooldown: 6, priority: 1, lines: [['neighbor', 'Что, разобрали тебя на уровне {n}? Бывает. Я тоже там лежал.'], ['me', 'Уровень {n}, «{title}». Ещё раз. Ногами быстрее.']] },
  'labyrinth-boss': { cooldown: 1, priority: 3, lines: [['radio', 'Говорят, начальника склада сегодня разобрали в его же кабинете.'], ['neighbor', 'Ты начальника уронил? В Лабиринте? Уважаю.']] },
});
export function labyrinthLines(detail) {
  const key = detail.won ? (detail.floor === 12 ? 'labyrinth-boss' : 'labyrinth-clear') : 'labyrinth-fail';
  return LABYRINTH_CHATTER[key].lines.map(([who, text]) => [who, text.replace('{n}', String(detail.floor)).replace('{title}', detail.title)]);
}
