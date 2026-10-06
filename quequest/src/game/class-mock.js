// 19.1 · «КЛАСС» — a MOCK of the teacher view (canon §19). No server, no
// real children: ten made-up students («пример класса»), each with a §13
// mastery grid built the same way the game builds it, shown through the same
// diverCard() the player sees. It shows what accounts + a teacher dashboard
// would give: ratings per area, proofs, who is stuck where, what to give next.

import { AREAS, AREA_IDS, AREA_QUESTS, diverCard, powersOf } from './diver-card.js';

const W = ['tap', 'knobs', 'code', 'raw'];
// [skill, way, stage, proofs] per student. misses: wrong duel answers by area.
const STUDENTS = Object.freeze([
  { id: 'ex-01', nick: 'Аня К.', xp: 820, grid: [['print', 2, 4, 3], ['if', 2, 3, 3], ['for', 2, 2, 2], ['site', 1, 3, 2]], misses: { loop: 1 } },
  { id: 'ex-02', nick: 'Боря Л.', xp: 310, grid: [['print', 2, 2, 2], ['if', 1, 2, 2], ['bits', 1, 4, 3]], misses: { if: 4, loop: 3 } },
  { id: 'ex-03', nick: 'Вика М.', xp: 1460, grid: [['print', 2, 5, 4], ['if', 2, 4, 4], ['for', 2, 3, 3], ['def', 2, 2, 2], ['guard', 2, 3, 3], ['train', 1, 3, 2]], misses: {} },
  { id: 'ex-04', nick: 'Гоша Н.', xp: 120, grid: [['print', 0, 2, 1], ['if', 0, 1, 1]], misses: { say: 2, if: 5 } },
  { id: 'ex-05', nick: 'Даша О.', xp: 640, grid: [['print', 2, 3, 2], ['site', 1, 4, 3], ['train', 1, 4, 3], ['if', 1, 3, 2]], misses: { loop: 4 } },
  { id: 'ex-06', nick: 'Егор П.', xp: 980, grid: [['print', 2, 3, 3], ['if', 2, 3, 3], ['lock', 2, 3, 2], ['guard', 1, 4, 3], ['bits', 1, 3, 2], ['cascade', 1, 2, 1]], misses: { web: 2 } },
  { id: 'ex-07', nick: 'Женя Р.', xp: 260, grid: [['print', 1, 3, 2], ['for', 1, 1, 1], ['cascade', 1, 3, 2]], misses: { loop: 6 } },
  { id: 'ex-08', nick: 'Зоя С.', xp: 1890, grid: [['print', 3, 3, 4], ['if', 2, 5, 5], ['for', 2, 4, 4], ['while', 2, 3, 2], ['def', 2, 3, 3], ['route', 2, 3, 2], ['bits', 1, 4, 2]], misses: {} },
  { id: 'ex-09', nick: 'Илья Т.', xp: 430, grid: [['print', 2, 2, 2], ['if', 2, 1, 1], ['guard', 1, 2, 2], ['bits', 1, 2, 1]], misses: { if: 3, guard: 2 } },
  { id: 'ex-10', nick: 'Кира У.', xp: 700, grid: [['print', 2, 3, 2], ['site', 1, 3, 2], ['train', 1, 2, 2], ['cascade', 1, 4, 3], ['try', 1, 2, 1]], misses: { hw: 3 } },
]);

function profileOf(s) {
  const mastery = {};
  for (const [skill, wi, stage, n] of s.grid) {
    const ways = { tap: 0, knobs: 0, code: 0, raw: 0 };
    for (let i = 0; i <= wi; i++) ways[W[i]] = i === wi ? stage : Math.max(ways[W[i]], Math.min(5, stage + 1));
    const proofs = Array.from({ length: n }, (_, k) => ({ key: `ex:${skill}:${k}`, way: W[Math.min(wi, k)], stage: Math.max(1, stage - (n - 1 - k)), hints: 0, source: 'example' }));
    mastery[skill] = { ways, best: W[wi], proofs };
  }
  return { xp: s.xp, mastery, duel: { nick: s.nick, avatar: (Number(s.id.slice(-2)) * 3) % 8 } };
}

// Stuck = the area with the most wrong duel answers (3+), else the weakest
// area the student already touched. Suggest = the place in the game for it.
export function studentView(s) {
  const profile = profileOf(s);
  const card = diverCard(profile);
  const missTop = Object.entries(s.misses).sort((a, b) => b[1] - a[1])[0];
  const stuckId = missTop && missTop[1] >= 3 ? missTop[0] : (card.weakest?.id ?? null);
  const stuck = stuckId ? AREAS.find((a) => a.id === stuckId) : null;
  return {
    id: s.id, nick: s.nick, example: true, card, powers: powersOf(card), misses: { ...s.misses },
    stuck: stuck ? { id: stuck.id, name: stuck.name, why: missTop && missTop[0] === stuck.id && missTop[1] >= 3 ? `${missTop[1]} ошибок подряд в дуэлях` : 'слабее всего из начатого' } : null,
    suggest: stuck ? AREA_QUESTS[stuck.id] : null,
  };
}
export function sampleClass() { return STUDENTS.map(studentView); }

export function classSummary(list = sampleClass()) {
  const avg = AREA_IDS.map((id, i) => ({ id, name: AREAS[i].name, short: AREAS[i].short, avg: Math.round(list.reduce((s, x) => s + x.powers[i], 0) / list.length), stuck: list.filter((x) => x.stuck?.id === id).length }));
  const weakest = [...avg].sort((a, b) => a.avg - b.avg)[0];
  const mostStuck = [...avg].sort((a, b) => b.stuck - a.stuck)[0];
  return { students: list.length, avg, weakest, mostStuck, proofs: list.reduce((s, x) => s + x.card.proofs, 0) };
}

// A real class (accounts): one row per player snapshot from the adapter's
// listPlayers({ classId }). Misses come from the duel history in the profile.
export function studentFromSnapshot({ id, nick, snapshot } = {}) {
  const profile = snapshot?.profile ?? {};
  const misses = {};
  for (const h of profile.duel?.history ?? []) for (const t of h.misses ?? []) { const area = String(t ?? '').split('.')[0]; if (area) misses[area] = (misses[area] ?? 0) + 1; }
  const view = studentView({ id: String(id ?? 'x-00'), nick: nick ?? snapshot?.card?.nick ?? '—', xp: profile.xp ?? 0, grid: [], misses });
  const card = diverCard(profile);
  const missTop = Object.entries(misses).sort((a, b) => b[1] - a[1])[0];
  const stuckId = missTop && missTop[1] >= 3 ? missTop[0] : (card.weakest?.id ?? null);
  const stuck = stuckId ? AREAS.find((a) => a.id === stuckId) : null;
  return { ...view, example: false, card, powers: powersOf(card), stuck: stuck ? { id: stuck.id, name: stuck.name, why: missTop && missTop[0] === stuck.id && missTop[1] >= 3 ? `${missTop[1]} ошибок в дуэлях` : 'слабее всего из начатого' } : null, suggest: stuck ? AREA_QUESTS[stuck.id] : null };
}
