// 18.1: one registry of skill mastery for the whole Deep (canon §13).
//
// A skill is a grid «way × stage». Way — HOW you do it, four floors that never
// close: tap (button / preset) → knobs (rules, sliders, graph) → code (Python)
// → raw (from scratch, no hints / no paste / the real tool). Stage — HOW SURE,
// 1..5: tried → built → without hints → carried to another task → proven blind.
//
//   profile.mastery[skillId] = { ways: { tap, knobs, code, raw }, best, proofs: [...] }
//
// Every game sends the same event; QueQuest stores it once per key, through
// the existing ledgers: profile.awards (XP → the rank is a view of it) and the
// guild skillLedger (guild points → GUILD_LEVELS is a view of it). No game keeps
// its own counter any more.
//
//   postMessage({ type: 'deep:skill', skill, way, stage, hints, source, key })

import { awardCampusXp } from './campus-profile.js';

export const WAYS = Object.freeze(['tap', 'knobs', 'code', 'raw']);
export const WAY_NAMES = Object.freeze({ tap: 'ТЫК', knobs: 'РУЧКИ', code: 'КОД', raw: 'С НУЛЯ' });
export const STAGE_NAMES = Object.freeze(['—', 'попробовал', 'собрал', 'без подсказок', 'перенёс', 'подтвердил']);

// Skill ids and which guild branch their proofs count for.
export const SKILLS = Object.freeze({
  print: { name: 'Сказать машине', guild: 'automation' },
  if: { name: 'Выбрать по условию', guild: 'automation' },
  for: { name: 'Для каждого', guild: 'automation' },
  while: { name: 'Пока есть работа', guild: 'automation' },
  def: { name: 'Свой навык с именем', guild: 'automation' },
  dict: { name: 'Свойства клетки', guild: 'systems' },
  try: { name: 'Пережить ошибку', guild: 'systems' },
  class: { name: 'Вещи с методами', guild: 'systems' },
  route: { name: 'Сортировка потока (Питонио)', guild: 'automation' },
  light: { name: 'Свет и картинка (TD Lab)', guild: 'ai' },
  lock: { name: 'Замки', guild: 'security' },
  // 19.0 C · the five profession tasters (career-tasters.js).
  guard: { name: 'Сторож сервера (Сетевик)', guild: 'security' },
  site: { name: 'Понятная страница (Создатель сайтов)', guild: 'web' },
  train: { name: 'Учить робота на примерах (Тренер ИИ)', guild: 'ai' },
  cascade: { name: 'Остановить цепочку поломок (Спасатель города)', guild: 'systems' },
  bits: { name: 'Сигналы и переключатели (Знаток железа)', guild: 'lowlevel' },
});

// One level scale for guild points (was GUILD_LEVELS in quest-guild.js and a
// separate floor(points/2) in career-worlds.js — two counters for one thing).
export const LEVELS = Object.freeze([
  Object.freeze({ level: 0, min: 0, name: 'НЕ ПРОБОВАЛ' }),
  Object.freeze({ level: 1, min: 2, name: 'ПРАКТИК' }),
  Object.freeze({ level: 2, min: 5, name: 'СПЕЦ' }),
  Object.freeze({ level: 3, min: 9, name: 'МАСТЕР' }),
  Object.freeze({ level: 4, min: 14, name: 'ЛЕГЕНДА' }),
]);
export function levelOf(points = 0) {
  const v = Math.max(0, Number(points) || 0);
  return [...LEVELS].reverse().find((l) => v >= l.min) ?? LEVELS[0];
}

export function emptySkill() { return { ways: { tap: 0, knobs: 0, code: 0, raw: 0 }, best: null, proofs: [] }; }

function bestWay(ways) {
  let best = null;
  for (const w of WAYS) if ((ways[w] ?? 0) > 0) best = w;
  return best;
}

const clampStage = (n) => Math.max(1, Math.min(5, Math.round(Number(n) || 1)));
const XP_PER = Object.freeze({ tap: 10, knobs: 15, code: 25, raw: 40 });

// Pure and idempotent: the same key twice changes nothing.
export function masteryEvent(profile = {}, { skill, way, stage = 1, hints = 0, source = 'quequest', key } = {}) {
  if (!SKILLS[skill] || !WAYS.includes(way) || !key) return { profile, first: false };
  const ledgerKey = `mastery:${key}`;
  const guild = profile.labs?.guild ?? {};
  if (Object.prototype.hasOwnProperty.call(profile.awards ?? {}, ledgerKey) || guild.skillLedger?.[ledgerKey]) return { profile, first: false };
  const s = clampStage(stage);
  const prev = profile.mastery?.[skill] ?? emptySkill();
  const ways = { ...emptySkill().ways, ...prev.ways, [way]: Math.max(prev.ways?.[way] ?? 0, s) };
  const proof = { key: String(key).slice(0, 80), way, stage: s, hints: Math.max(0, Number(hints) || 0), source: String(source).slice(0, 24) };
  const entry = { ways, best: bestWay(ways), proofs: [...(prev.proofs ?? []), proof].slice(-40) };
  let next = { ...profile, mastery: { ...(profile.mastery ?? {}), [skill]: entry } };
  // Guild points: one per proof on a new floor, two for code / raw.
  const gain = way === 'code' || way === 'raw' ? 2 : 1;
  next = { ...next, labs: { ...(next.labs ?? {}), guild: { ...guild, skillLedger: { ...(guild.skillLedger ?? {}), [ledgerKey]: { [SKILLS[skill].guild]: gain } } } } };
  // Hints lower the reward, never the floor (canon §13 rule 3).
  const xp = Math.round(XP_PER[way] * s * ([1, 0.9, 0.78, 0.65][Math.min(3, proof.hints)]));
  next = awardCampusXp(next, xp, ledgerKey);
  return { profile: next, first: true, xp, entry };
}

// [tap, knobs, code, raw] as booleans for the skill tree pips.
export function floorsOf(profile = {}, skill) {
  const ways = profile.mastery?.[skill]?.ways ?? {};
  return WAYS.map((w) => (ways[w] ?? 0) > 0);
}

export function mergeMastery(a = {}, b = {}) {
  const out = { ...a };
  for (const [skill, entry] of Object.entries(b ?? {})) {
    const cur = out[skill] ?? emptySkill();
    const ways = {};
    for (const w of WAYS) ways[w] = Math.max(cur.ways?.[w] ?? 0, entry?.ways?.[w] ?? 0);
    const seen = new Set();
    const proofs = [...(cur.proofs ?? []), ...(entry?.proofs ?? [])].filter((p) => p && !seen.has(p.key) && seen.add(p.key)).slice(-40);
    out[skill] = { ways, best: bestWay(ways), proofs };
  }
  return out;
}

// What portals may send (Pythonio, TD Lab, KICK later). Anything else is dropped.
export function validateSkillMessage(data) {
  if (!data || typeof data !== 'object' || data.type !== 'deep:skill') return null;
  const { skill, way, key } = data;
  if (!SKILLS[skill] || !WAYS.includes(way) || typeof key !== 'string' || !key || key.length > 80) return null;
  const stage = Number(data.stage ?? 1);
  if (!Number.isFinite(stage) || stage < 1 || stage > 5) return null;
  return { skill, way, stage: Math.round(stage), hints: Math.max(0, Math.min(3, Number(data.hints) || 0)), source: typeof data.source === 'string' ? data.source.slice(0, 24) : 'portal', key: `${typeof data.source === 'string' ? data.source.slice(0, 24) : 'portal'}:${key}` };
}

// Pythonio: manual → tap, the rule table → knobs, `def route(item)` → code.
export function pythonioWay(method = 'manual') {
  return { manual: 'tap', hands: 'tap', table: 'knobs', rules: 'knobs', def: 'code', code: 'code' }[method] ?? 'tap';
}
// TD Lab: a spell → tap, the node graph → knobs, builder.py export → code, real TouchDesigner → raw.
export function tdlabWay(kind = 'spell') {
  return { spell: 'tap', graph: 'knobs', builder: 'code', export: 'code', td: 'raw', real: 'raw' }[kind] ?? 'tap';
}

// Listens for 'deep:skill' from same-origin frames; returns a stop function.
export function listenForSkills(onEvent, target = globalThis) {
  const handler = (ev) => {
    if (ev.origin && globalThis.location && ev.origin !== globalThis.location.origin) return;
    const msg = validateSkillMessage(ev.data);
    if (msg) onEvent(msg);
  };
  target.addEventListener?.('message', handler);
  return () => target.removeEventListener?.('message', handler);
}
