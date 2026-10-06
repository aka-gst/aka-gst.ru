// 19.1 · ДУЭЛЬ ЗАДАЧКАМИ, ТИСКИ-ШТУРМ и ВЗЛОМ (canon §19) — one pure engine.
// VitalSchool's core loop inside Глубина: «реши быстрый пример — получи баф».
// Every round flashes a quick task (duel-tasks.js) on an area of the diver
// card; right and fast → a buff whose strength comes from your rating in
// that area (diver-card.js: floors × stages of the §13 grid) and your speed.
// Wrong or late → no buff and one plain sentence why.
//
// The ring is a ТИСКИ training hall: their interns measure themselves there
// in the evenings; you come to beat them at their own game.
//
// Pure functions only: duel-ui.js draws and drives, tests play it headless.

import { AREAS, AREA_IDS, areaById, diverCard, powersOf, cleanNick, AVATARS } from './diver-card.js';
import { makeTask, rng, hashStr, FAMILIES } from './duel-tasks.js';
import { masteryEvent } from './mastery.js';

const freeze = (v) => Object.freeze(v);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// -------------------------------------------------------------- БАФЫ
// base: the value at rating 50 and an average-speed answer.
export const BUFFS = freeze({
  attack: freeze({ id: 'attack', name: 'УДАР', base: 14, line: 'бьёт соперника' }),
  double: freeze({ id: 'double', name: 'ДВОЙНОЙ УДАР', base: 8, hits: 2, line: 'цикл: два удара подряд' }),
  shield: freeze({ id: 'shield', name: 'ЩИТ', base: 14, line: 'держит удары этот и следующий раунд' }),
  heal: freeze({ id: 'heal', name: 'ПОЧИНКА', base: 12, line: 'возвращает здоровье' }),
  aura: freeze({ id: 'aura', name: 'ПОЛЕ', base: 40, line: 'поле вокруг: +40% к двум следующим бафам' }),
  auto: freeze({ id: 'auto', name: 'АВТОМАТ', base: 5, turns: 3, line: 'бьёт сам три раунда подряд' }),
});
export const buffOfArea = (area) => BUFFS[areaById(area)?.buff ?? 'attack'];

// rating 0..100 → ×0.7..×1.3; speed (share of time left) → ×0.8..×1.4.
export function ratingMul(power = 0) { return 0.7 + 0.6 * clamp(Number(power) || 0, 0, 100) / 100; }
export function speedMul(ms, limitSec) { const left = clamp(1 - (Number(ms) || 0) / (limitSec * 1000), 0, 1); return 0.8 + 0.6 * left; }
export function buffValue(kind, power, ms, limitSec, aura = false) {
  const b = BUFFS[kind];
  if (kind === 'aura') return b.base; // aura is a share, not scaled
  return Math.max(1, Math.round(b.base * ratingMul(power) * speedMul(ms, limitSec) * (aura ? 1.4 : 1)));
}

// -------------------------------------------------------------- ПРИЗРАКИ
// powers in AREA_IDS order: say, if, loop, auto, guard, web, ai, city, hw.
export const GHOSTS = freeze([
  freeze({ id: 'intern', name: 'Стажёр «ТИСКОВ»', avatar: 6, powers: freeze([20, 15, 10, 5, 10, 10, 15, 5, 10]), hello: 'Я тут третий день. Но у меня бейдж!', win: 'Бейдж не помог. Ты быстрее.', lose: 'Ха! Бейдж решает.' }),
  freeze({ id: 'vitya', name: 'Витя', avatar: 1, powers: freeze([30, 35, 15, 10, 55, 10, 10, 30, 50]), hello: 'Замки и железо — моё. Код — твоё. Посмотрим.', win: 'Ну ты даёшь, сосед. Машину бы мне так стерёг.', lose: 'Железо не обманешь. Ещё раз?' }),
  freeze({ id: 'dina', name: 'Дина', avatar: 5, powers: freeze([40, 30, 25, 15, 20, 60, 55, 15, 20]), hello: 'Подделку я вижу за секунду. А ты?', win: 'Окей, ты быстрый. Записываю тебя в свою команду.', lose: 'Сайты и отзывы — моя территория.' }),
  freeze({ id: 'sanya', name: 'Саня', avatar: 7, powers: freeze([25, 45, 35, 30, 45, 10, 15, 40, 60]), hello: 'Я в прошивках каждый бит знаю.', win: 'Хм. Без инструкции, и всё равно меня сделал.', lose: 'Биты, брат. Учи биты.' }),
  freeze({ id: 'timur', name: 'Тимур', avatar: 0, powers: freeze([55, 55, 60, 40, 70, 30, 35, 40, 35]), hello: 'Мой сервер ни разу не лёг. Проверим твой?', win: 'Сильно. Пойдёшь админить со мной?', lose: 'Защита — это не кнопка. Приходи ещё.' }),
  freeze({ id: 'spec', name: 'Специалист «ТИСКОВ»', avatar: 3, powers: freeze([70, 70, 65, 60, 75, 55, 65, 60, 65]), hello: '«Мы держим всё». И тебя удержим.', win: 'Это… не по регламенту. Охрана!', lose: 'Регламент сильнее самоучки.' }),
]);
export const ghostById = (id) => GHOSTS.find((g) => g.id === id) ?? null;
export function ladder(profile = {}) {
  const beaten = new Set(profile.duel?.beaten ?? []);
  return GHOSTS.map((g, i) => ({ ...g, beaten: beaten.has(g.id), open: i === 0 || beaten.has(GHOSTS[i - 1].id) }));
}
export function nextGhost(profile = {}) { return ladder(profile).find((g) => g.open && !g.beaten) ?? GHOSTS.at(-1); }

// Ghost answer for one task: right with p from its rating, time from it too.
export function ghostPlan(power, limitSec, r) {
  const p = clamp(Number(power) || 0, 0, 100) / 100;
  const correct = r.next() < 0.3 + 0.6 * p;
  const frac = clamp(0.85 - 0.5 * p + (r.next() - 0.5) * 0.2, 0.2, 0.95);
  return { correct, ms: Math.round(frac * limitSec * 1000) };
}

// -------------------------------------------------------------- ТЕМЫ
export const DEMO_TOPICS = freeze(['say', 'if', 'loop', 'hw', 'guard']);
// Topics from the areas the player actually has, strongest first, plus one
// stretch topic (the weakest or a new one). Nothing yet → the demo set.
export function pickTopics(powers = [], { r = rng(1), count = 7 } = {}) {
  const have = AREA_IDS.map((id, i) => ({ id, p: powers[i] ?? 0 })).filter((a) => a.p > 0).sort((a, b) => b.p - a.p).map((a) => a.id);
  const base = have.length ? have.slice(0, 4) : [...DEMO_TOPICS];
  const rest = AREA_IDS.filter((id) => !base.includes(id));
  const stretch = rest.length ? r.pick(rest) : base.at(-1);
  const order = r.shuffle(base);
  const out = [];
  for (let i = 0; out.length < count; i++) {
    if (out.length === 2 || out.length === 5) out.push({ area: stretch, stretch: true });
    else out.push({ area: order[i % order.length], stretch: false });
  }
  return out.slice(0, count);
}

// -------------------------------------------------------------- МАТЧ
export const MODES = freeze({
  duel: freeze({ id: 'duel', hp: 50, rounds: 7 }),
  storm: freeze({ id: 'storm', hp: 60, rounds: 5, waves: freeze([12, 14, 17, 20, 24]) }),
  hack: freeze({ id: 'hack', hp: 3, rounds: 7, layers: freeze([18, 22, 26]) }),
});
export const STORM_SITES = freeze({
  garage: freeze({ id: 'garage', title: 'ШТУРМ ГАРАЖА ВИТИ', who: 'Витя', line: 'Ночью «ТИСКИ-Авто» шлют пять волн команд на Витину машину. Каждая волна — задачка: решил — поставил защиту.', topics: freeze(['guard', 'if', 'hw', 'city', 'guard']) }),
  server: freeze({ id: 'server', title: 'ШТУРМ СЕРВЕРА ТИМУРА', who: 'Тимур', line: 'Боты «ТИСКИ-Связи» идут на сервер Тимура волнами. Решил задачку — сторож держит волну.', topics: freeze(['guard', 'loop', 'if', 'city', 'guard']) }),
});
export const HACK_TARGET = freeze({ title: 'ВЗЛОМ ЗАМКА «ТИСКОВ»', line: 'В сейфе «ТИСКОВ» лежит прошивка с мастер-ключом от машин всего района. Три слоя защиты. Каждая решённая задачка — удар по слою; три ошибки — сработает тревога.', topics: freeze(['hw', 'if', 'loop', 'say', 'hw', 'auto', 'guard']) });

function side({ name = 'Дайвер', avatar = 0, powers = [], hp = 60, id = 'me' } = {}) {
  return { id, name, avatar, powers: AREA_IDS.map((_, i) => clamp(Math.round(Number(powers[i]) || 0), 0, 100)), hp, maxHp: hp, shield: 0, shieldLeft: 0, aura: 0, auto: 0, autoLeft: 0 };
}

export function createMatch({ mode = 'duel', seed = 1, me = {}, foe = null, site = 'garage', topics = null } = {}) {
  const M = MODES[mode];
  const r = rng(seed);
  const mine = side({ ...me, hp: M.hp, id: 'me' });
  let foeSide = null, list;
  if (mode === 'duel') {
    const g = foe ?? GHOSTS[0];
    foeSide = { ...side({ ...g, hp: M.hp, id: 'foe' }), ghostId: g.id ?? null, hello: g.hello ?? '', winLine: g.win ?? '', loseLine: g.lose ?? '', friend: Boolean(g.friend) };
    list = topics ? topics.map((a) => ({ area: a, stretch: false })) : pickTopics(mine.powers, { r, count: M.rounds });
  } else if (mode === 'storm') {
    const s = STORM_SITES[site] ?? STORM_SITES.garage;
    list = s.topics.map((a) => ({ area: a, stretch: false }));
    foeSide = { id: 'foe', name: 'Волны «ТИСКОВ»', waves: [...M.waves], site: s.id };
  } else {
    list = HACK_TARGET.topics.map((a) => ({ area: a, stretch: false }));
    foeSide = { id: 'foe', name: 'Замок «ТИСКОВ»', layers: [...M.layers], layer: 0, alarm: 0 };
  }
  return { mode, seed, round: 0, maxRounds: list.length, topics: list, me: mine, foe: foeSide, task: null, plan: null, results: [], used: [], over: false, outcome: null };
}

const powerOf = (s, area) => s.powers?.[AREA_IDS.indexOf(area)] ?? 0;

// The player's side for a match: area powers and every topic % of the card.
export function meFromProfile(profile = {}, nick = null) {
  const c = diverCard(profile);
  return { name: nick ?? c.nick, avatar: c.avatar, powers: powersOf(c) };
}

export function startRound(m) {
  if (m.over) return m;
  const topic = m.topics[m.round];
  let task = null;
  for (let k = 0; k < 12; k++) {
    const t = makeTask(topic.area, hashStr(`${m.seed}:${m.round}:${k}`));
    if (!m.used.includes(t.id)) { task = t; break; }
    task = t;
  }
  const r = rng(hashStr(`${m.seed}:ghost:${m.round}`));
  const plan = m.mode === 'duel' ? ghostPlan(powerOf(m.foe, topic.area), task.limit, r) : null;
  return { ...m, task: { ...task, stretch: topic.stretch, buff: m.mode === 'duel' ? buffOfArea(topic.area).id : m.mode === 'storm' ? 'shield' : 'attack' }, plan, used: [...m.used, task.id] };
}

// One side's action this round → effect values.
function effect(s, kind, area, ms, limit) {
  const aura = s.aura > 0;
  const v = buffValue(kind, powerOf(s, area), ms, limit, aura);
  return { kind, value: v, aura };
}

// choice: option index or null (late). ms: time used.
export function answerRound(m, { choice = null, ms = 0 } = {}) {
  if (m.over || !m.task) return { match: m, events: [] };
  const t = m.task;
  const limit = t.limit;
  const late = ms >= limit * 1000 || choice === null || choice === undefined;
  const correct = !late && choice === t.answer;
  const me = { ...m.me }; let foe = { ...m.foe };
  const events = [{ type: 'answer', who: 'me', correct, late, ms, explain: correct ? null : t.explain }];
  const result = { taskId: t.id, area: t.area, family: t.family, skill: t.skill, way: t.way, correct, ms: Math.round(ms), limit, stretch: Boolean(t.stretch) };

  if (m.mode === 'duel') {
    const plan = m.plan ?? { correct: false, ms: limit * 1000 };
    events.push({ type: 'answer', who: 'foe', correct: plan.correct, ms: plan.ms });
    const acts = [];
    if (correct) acts.push(['me', effect(me, t.buff, t.area, ms, limit)]);
    if (plan.correct) acts.push(['foe', effect(foe, t.buff, t.area, plan.ms, limit)]);
    const S = { me, foe };
    // Auras get used by the buffs they boosted; shields from the round before expire.
    for (const k of ['me', 'foe']) { if (S[k].shieldLeft > 0) { S[k].shieldLeft -= 1; if (!S[k].shieldLeft) S[k].shield = 0; } }
    for (const [who, e] of acts) { if (e.aura && e.kind !== 'aura') S[who].aura -= 1; }
    // 1 · shields and auras, 2 · heals, 3 · hits (and automatons).
    for (const [who, e] of acts) {
      events.push({ type: 'buff', who, kind: e.kind, value: e.value, aura: e.aura });
      if (e.kind === 'shield') { S[who].shield += e.value; S[who].shieldLeft = 2; }
      if (e.kind === 'aura') S[who].aura = 2;
      if (e.kind === 'auto') { S[who].auto = e.value; S[who].autoLeft = BUFFS.auto.turns; }
    }
    for (const [who, e] of acts) if (e.kind === 'heal') { const before = S[who].hp; S[who].hp = Math.min(S[who].maxHp, S[who].hp + e.value); events.push({ type: 'heal', to: who, value: S[who].hp - before }); }
    const hit = (from, to, value, kind) => {
      const blocked = Math.min(S[to].shield, value); S[to].shield -= blocked;
      const dmg = value - blocked; S[to].hp = Math.max(0, S[to].hp - dmg);
      events.push({ type: 'hit', from, to, value: dmg, blocked, kind });
    };
    for (const [who, e] of acts) {
      const to = who === 'me' ? 'foe' : 'me';
      if (e.kind === 'attack') hit(who, to, e.value, 'attack');
      if (e.kind === 'double') { hit(who, to, e.value, 'double'); hit(who, to, e.value, 'double'); }
    }
    for (const who of ['me', 'foe']) {
      if (S[who].autoLeft > 0) { hit(who, who === 'me' ? 'foe' : 'me', S[who].auto, 'auto'); S[who].autoLeft -= 1; }
    }
    Object.assign(me, S.me); foe = S.foe;
    result.foeCorrect = plan.correct;
  } else if (m.mode === 'storm') {
    const wave = m.foe.waves[m.round];
    const def = correct ? buffValue('shield', powerOf(me, t.area), ms, limit) + 2 : 0;
    const dmg = Math.max(0, wave - def);
    me.hp = Math.max(0, me.hp - dmg);
    events.push({ type: 'wave', index: m.round, power: wave, defense: def, value: dmg, held: dmg === 0, field: correct });
  } else {
    if (correct) {
      const hitV = buffValue('attack', powerOf(me, t.area), ms, limit) + 4;
      let v = hitV;
      const layers = [...foe.layers]; let layer = foe.layer;
      const before = layer;
      while (v > 0 && layer < layers.length) { const d = Math.min(layers[layer], v); layers[layer] -= d; v -= d; if (layers[layer] <= 0) layer += 1; }
      events.push({ type: 'crack', value: hitV, broke: layer - before, layer });
      foe = { ...foe, layers, layer };
    } else {
      foe = { ...foe, alarm: foe.alarm + 1 };
      events.push({ type: 'alarm', value: foe.alarm });
    }
  }

  result.topic = t.topic;

  const round = m.round + 1;
  let over = false, outcome = null;
  if (m.mode === 'duel') {
    if (me.hp <= 0 || foe.hp <= 0 || round >= m.maxRounds) { over = true; outcome = me.hp === foe.hp ? 'draw' : me.hp > foe.hp ? 'win' : 'lose'; }
  } else if (m.mode === 'storm') {
    if (me.hp <= 0) { over = true; outcome = 'lose'; } else if (round >= m.maxRounds) { over = true; outcome = 'win'; }
  } else {
    if (foe.layer >= foe.layers.length) { over = true; outcome = 'win'; } else if (foe.alarm >= MODES.hack.hp) { over = true; outcome = 'lose'; } else if (round >= m.maxRounds) { over = true; outcome = 'lose'; }
  }
  if (over) events.push({ type: 'over', outcome });
  return { match: { ...m, me, foe, round, task: null, plan: null, results: [...m.results, result], over, outcome }, events };
}

// What you practised: one line per area for the end card.
export function practiceSummary(m) {
  const by = new Map();
  for (const r of m.results) { const e = by.get(r.area) ?? { area: r.area, name: areaById(r.area).name, right: 0, total: 0 }; e.total += 1; if (r.correct) e.right += 1; by.set(r.area, e); }
  return [...by.values()];
}

// -------------------------------------------------------------- ДОКАЗАТЕЛЬСТВА
// Each right answer is a §13 proof on the family's floor: one per skill ×
// task family per day (idempotent key), and at most DAILY_CAP per day in
// all. Fast (half the time or less) = stage 2 «собрал», else 1 «попробовал».
export const DAILY_CAP = 6;
export function dayKey(date = new Date()) { const d = new Date(date); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
export function duelProofs(profile = {}, results = [], { date = new Date(), source = 'duel' } = {}) {
  const day = dayKey(date);
  const duel = profile.duel ?? {};
  let used = duel.daily?.day === day ? duel.daily.n : 0;
  let p = profile; const written = []; let capped = false;
  for (const r of results) {
    if (!r.correct) continue;
    if (used >= DAILY_CAP) { capped = true; break; }
    const key = `duel:${r.skill}:${r.family}:${day}`;
    const stage = r.ms <= r.limit * 500 ? 2 : 1;
    const ev = masteryEvent(p, { skill: r.skill, way: r.way, stage, source, key });
    if (ev.first) { p = ev.profile; used += 1; written.push({ key, skill: r.skill, way: r.way, stage, xp: ev.xp }); }
  }
  p = { ...p, duel: { ...(p.duel ?? duel), daily: { day, n: used } } };
  return { profile: p, written, capped, left: Math.max(0, DAILY_CAP - used) };
}
export function recordOutcome(profile = {}, m) {
  const duel = { ...(profile.duel ?? {}) };
  const stats = { ...(duel.stats ?? {}) };
  stats[m.mode] = { played: (stats[m.mode]?.played ?? 0) + 1, won: (stats[m.mode]?.won ?? 0) + (m.outcome === 'win' ? 1 : 0) };
  duel.stats = stats;
  const right = m.results.filter((r) => r.correct).length;
  duel.history = [...(duel.history ?? []), { at: Date.now(), mode: m.mode, foe: m.foe.name, outcome: m.outcome, right, total: m.results.length, misses: m.results.filter((r) => !r.correct).map((r) => r.topic) }].slice(-20);
  if (m.mode === 'duel' && m.outcome === 'win' && m.foe.ghostId && ghostById(m.foe.ghostId)) duel.beaten = [...new Set([...(duel.beaten ?? []), m.foe.ghostId])];
  return { ...profile, duel };
}

// -------------------------------------------------------------- КОД ДЛЯ ДРУГА
// QQ1.<base64url(bytes)>: [version 1, avatar, rank, 9 powers, nick length,
// nick UTF-8 …, FNV-1a 32-bit checksum of everything before + salt].
export const SHARE_PREFIX = 'QQ1.';
const SALT = 'ГЛУБИНА·ТИСКИ·19';
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
function b64(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 3) { const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0); const k = Math.min(3, bytes.length - i); s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (k > 1 ? B64[(n >> 6) & 63] : '') + (k > 2 ? B64[n & 63] : ''); } return s; }
function unb64(s) { const out = []; let buf = 0, bits = 0; for (const ch of s) { const v = B64.indexOf(ch); if (v < 0) return null; buf = (buf << 6) | v; bits += 6; if (bits >= 8) { bits -= 8; out.push((buf >> bits) & 255); } } return Uint8Array.from(out); }
function checksum(bytes) { let h = 2166136261 >>> 0; for (const b of bytes) { h ^= b; h = Math.imul(h, 16777619) >>> 0; } for (const ch of new TextEncoder().encode(SALT)) { h ^= ch; h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }

export function encodeShare({ nick = 'Дайвер', avatar = 0, rankIndex = 0, powers = [] } = {}) {
  const name = new TextEncoder().encode(cleanNick(nick));
  const body = [1, clamp(avatar | 0, 0, AVATARS.length - 1), clamp(rankIndex | 0, 0, 255), ...AREA_IDS.map((_, i) => clamp(Math.round(Number(powers[i]) || 0), 0, 100)), name.length, ...name];
  const h = checksum(body);
  return SHARE_PREFIX + b64(Uint8Array.from([...body, (h >>> 24) & 255, (h >>> 16) & 255, (h >>> 8) & 255, h & 255]));
}
export function shareFromProfile(profile = {}, nick = null) {
  const c = diverCard(profile);
  return encodeShare({ nick: nick ?? c.nick, avatar: c.avatar, rankIndex: c.rankIndex, powers: powersOf(c) });
}
export function decodeShare(code = '') {
  const s = String(code).replace(/\s+/g, '');
  if (!s.startsWith(SHARE_PREFIX)) return { ok: false, reason: 'Это не код QueQuest: он начинается с QQ1.' };
  const bytes = unb64(s.slice(SHARE_PREFIX.length));
  if (!bytes || bytes.length < 18) return { ok: false, reason: 'Код обрезан — скопируй его целиком.' };
  const body = bytes.slice(0, -4), tail = bytes.slice(-4);
  const h = ((tail[0] << 24) | (tail[1] << 16) | (tail[2] << 8) | tail[3]) >>> 0;
  if (checksum(body) !== h) return { ok: false, reason: 'Код повреждён или изменён: контрольная сумма не сходится.' };
  if (body[0] !== 1) return { ok: false, reason: 'Код из другой версии игры.' };
  const powers = [...body.slice(3, 12)];
  const len = body[12];
  if (powers.some((p) => p > 100) || body[1] >= AVATARS.length || body.length !== 13 + len) return { ok: false, reason: 'Код повреждён.' };
  let nick;
  try { nick = new TextDecoder('utf-8', { fatal: true }).decode(body.slice(13)); } catch { return { ok: false, reason: 'Код повреждён.' }; }
  return { ok: true, card: { nick: cleanNick(nick), avatar: body[1], rankIndex: body[2], powers } };
}
export function ghostFromShare(card) {
  return { id: `friend-${hashStr(`${card.nick}|${card.powers.join(',')}`).toString(36)}`, name: card.nick, avatar: card.avatar, powers: card.powers, friend: true, hello: 'Это мой призрак — он отвечает так, как я умею.', win: 'Мой призрак проиграл. Придётся подтянуться!', lose: 'Мой призрак победил. Подтянись и вызови снова!' };
}

export { AREAS, FAMILIES };
