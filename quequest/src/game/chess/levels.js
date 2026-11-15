// ЛЁД-64 · the first five minutes (plan section 7). No rule screen: the lit squares are the only
// instruction, one line from Витя per level. Unit names are TD names (танк, разведчик…) until level 6 is
// held — then Витя says «это ж шахматы» and the chess names appear over the units.
//
// objective: 'collect' (every packet that is not «big»), 'clear' (no red left).
// failOnLoss: a blue unit taken = the level is lost (undo is free). breach: red on row 0 = the level is lost.
// maxTurns: the night ends; red still on the board = lost. reward: ₽ for holding the night (on top of packets).
import { createState, start, playTurn, legalMoves, unitById, JUMPS } from './rules.js';
import { BUGGY_JUMPS_CODE, parseJumps } from './python-jumps.js';

export const LEVELS = Object.freeze([
  Object.freeze({
    id: 'l1', title: 'Сторож', goal: 'Собери три пакета данных',
    vitya: 'Сеть ночью сыплет пакетами. Тронь сторожа — он покажет, куда может',
    objective: 'collect',
    units: [{ id: 'T', kind: 'tank', side: 'blue', x: 0, y: 0 }],
    packets: [{ x: 0, y: 5, v: 20 }, { x: 5, y: 5, v: 20 }, { x: 5, y: 2, v: 20 }],
    walls: [[3, 2], [2, 6]],
  }),
  Object.freeze({
    id: 'l2', title: 'За стеной', goal: 'Пакет за стеной: танк туда не пройдёт',
    vitya: 'Стены — это фаерволы. Через них ходит только мой прыгун',
    objective: 'collect',
    units: [{ id: 'T', kind: 'tank', side: 'blue', x: 0, y: 0 }, { id: 'S', kind: 'scout', side: 'blue', x: 3, y: 0 }],
    packets: [{ x: 6, y: 6, v: 40 }, { x: 0, y: 6, v: 20 }],
    walls: [[5, 6], [7, 6], [6, 5], [6, 7], [5, 5], [7, 5]],
  }),
  Object.freeze({
    id: 'l3', title: 'Первый взломщик', goal: 'Сотри красный скрипт, пока он не дошёл до низа',
    vitya: 'Стрелка — куда он пойдёт. Встанешь на него — рассыплется',
    objective: 'clear', breach: true, reward: 40,
    units: [{ id: 'T', kind: 'tank', side: 'blue', x: 1, y: 1 }, { id: 'r1', kind: 'engineer', side: 'red', x: 5, y: 6 }],
    walls: [[3, 4]],
  }),
  Object.freeze({
    id: 'l4', title: 'Жирный пакет', goal: 'Собери два обычных пакета и не потеряй танк',
    vitya: 'Видишь, какие клетки красные? Туда бьёт их артиллерия',
    objective: 'collect', failOnLoss: true, maxTurns: 8,
    units: [{ id: 'T', kind: 'tank', side: 'blue', x: 0, y: 0 }, { id: 'a1', kind: 'artillery', side: 'red', x: 6, y: 7, still: true }],
    packets: [{ x: 0, y: 6, v: 20 }, { x: 5, y: 0, v: 20 }, { x: 2, y: 3, v: 60, big: true }],
  }),
  Object.freeze({
    id: 'l5', title: 'Ремонтник', goal: 'Два скрипта идут лоб в лоб. Не пусти ни одного',
    vitya: 'Мой ремонтник прёт только вперёд. А бьёт ключом вбок',
    objective: 'clear', breach: true, failOnLoss: true, reward: 60,
    units: [{ id: 'E', kind: 'engineer', side: 'blue', x: 3, y: 1 }, { id: 'F', kind: 'engineer', side: 'blue', x: 4, y: 1 }, { id: 'r1', kind: 'engineer', side: 'red', x: 3, y: 5 }, { id: 'r2', kind: 'engineer', side: 'red', x: 4, y: 5 }],
  }),
  Object.freeze({
    id: 'l6', title: 'Ночная волна', goal: 'Удержи ядро и сотри всю волну',
    vitya: 'Ядро — это сервер. Тронут ядро — ночь проиграна',
    objective: 'clear', maxTurns: 12, reward: 120,
    units: [
      { id: 'K', kind: 'core', side: 'blue', x: 4, y: 0 },
      { id: 'T', kind: 'tank', side: 'blue', x: 0, y: 0 },
      { id: 'S', kind: 'scout', side: 'blue', x: 6, y: 0 },
      { id: 'E', kind: 'engineer', side: 'blue', x: 3, y: 1 },
      { id: 'r1', kind: 'engineer', side: 'red', x: 5, y: 4 },
      { id: 'r2', kind: 'scout', side: 'red', x: 2, y: 5 },
      { id: 'r3', kind: 'artillery', side: 'red', x: 7, y: 6 },
    ],
    reveal: true,
  }),
  // 20.x · the first Python of the night: Витя's scout jumps crooked; the player fixes its list of jumps and the
  // engine moves it by the player's code. The only take that saves the core needs the jump the code got wrong.
  Object.freeze({
    id: 'l7', title: 'Кривой прыгун', goal: 'Взломщик целит в ядро. Почини разведчику прыжки и сотри взломщика',
    vitya: 'Мой старый разведчик прыгает криво: я в девяностые опечатался. Код справа, поправь',
    objective: 'clear', maxTurns: 1, reward: 150, code: 'jumps', codeUnit: 'S', timeLine: 'Взломщик ушёл: разведчик до него не допрыгнул. Поправь список прыжков',
    units: [{ id: 'K', kind: 'core', side: 'blue', x: 3, y: 0 }, { id: 'S', kind: 'scout', side: 'blue', x: 4, y: 1 }, { id: 'r', kind: 'scout', side: 'red', x: 2, y: 2 }],
  }),
  // 20.x · «Наряд»: five real positions from live games (Lichess puzzles, CC0, src/game/chess/naryady.js).
  Object.freeze({
    id: 'l8', title: 'Наряд', goal: 'Пять задач из живых партий. Взломщик только что сходил — найди лучший ответ',
    vitya: 'Это настоящие партии: шахматисты играли, а я переодел их во взлом. Красная стрелка — их последний ход',
    objective: 'puzzles', puzzles: 5, perPuzzle: 20, units: [],
  }),
]);
// The fixed list for tests (the player writes their own).
export const FIXED_JUMPS = Object.freeze(JUMPS.map((p) => [...p]));
export const levelById = (id) => LEVELS.find((l) => l.id === id) ?? null;
export const REVEAL_LINE = 'Это ж шахматы. Я ЛЁД по шахматам писал';

// A code level starts with the player's current list (or Витя's crooked one).
export function startLevel(level, { jumps } = {}) {
  const s = createState(level);
  if (level.code === 'jumps') { const u = s.units.find((x) => x.id === level.codeUnit); if (u) u.jumps = jumps ?? parseJumps(BUGGY_JUMPS_CODE).jumps; }
  return start(s);
}

// The verdict after a turn: 'won' | 'lost:<why>' | null (still playing).
export function judge(level, s) {
  const blue = s.units.filter((u) => u.side === 'blue'), red = s.units.filter((u) => u.side === 'red');
  if (level.units.some((u) => u.kind === 'core') && !blue.some((u) => u.kind === 'core')) return 'lost:core';
  if (level.failOnLoss && s.lost.length) return 'lost:unit';
  if (level.breach && red.some((u) => u.y === 0)) return 'lost:breach';
  if (level.objective === 'collect' && !s.packets.some((p) => !p.big)) return 'won';
  if (level.objective === 'clear' && !red.length) return 'won';
  if (level.maxTurns && s.turn >= level.maxTurns) return 'lost:time';
  if (!blue.some((u) => legalMoves(s, u).length)) return 'lost:stuck';
  return null;
}
export function step(level, s, unitId, x, y) {
  const r = playTurn(s, unitId, x, y);
  if (r.ok) s.over = judge(level, s);
  return r;
}

// Breadth-first search for the shortest winning line (tests and the hint): [[unitId, x, y], …] or null.
export function solve(level, maxDepth = 10, opts = {}) {
  const s0 = startLevel(level, opts);
  const sig = (s) => s.units.map((u) => `${u.id}${u.x}${u.y}`).join('') + '|' + s.packets.map((p) => `${p.x}${p.y}`).join('');
  let frontier = [{ s: s0, line: [] }]; const seen = new Set([sig(s0)]);
  for (let d = 0; d < maxDepth && frontier.length; d++) {
    const next = [];
    for (const { s, line } of frontier) {
      for (const u of s.units.filter((o) => o.side === 'blue')) {
        for (const m of legalMoves(s, u)) {
          const t = structuredCloneState(s);
          step(level, t, u.id, m.x, m.y);
          const l2 = [...line, [u.id, m.x, m.y]];
          if (t.over === 'won') return l2;
          if (t.over) continue;
          const k = sig(t); if (seen.has(k)) continue; seen.add(k);
          next.push({ s: t, line: l2 });
        }
      }
    }
    frontier = next;
  }
  return null;
}
function structuredCloneState(s) {
  return { ...s, units: s.units.map((u) => ({ ...u })), packets: s.packets.map((p) => ({ ...p })), plans: { ...s.plans }, lost: [...s.lost], taken: [...s.taken] };
}

// A player who taps a random lit square: the negative control of the levels (they must not win by chance).
export function randomPlay(level, rng = Math.random, maxTurns = 30, opts = {}) {
  const s = startLevel(level, opts);
  for (let i = 0; i < maxTurns && !s.over; i++) {
    const opts = [];
    for (const u of s.units.filter((o) => o.side === 'blue')) for (const m of legalMoves(s, u)) opts.push([u.id, m.x, m.y]);
    if (!opts.length) break;
    const [id, x, y] = opts[Math.floor(rng() * opts.length)];
    step(level, s, id, x, y);
  }
  return s.over;
}
export { unitById };
