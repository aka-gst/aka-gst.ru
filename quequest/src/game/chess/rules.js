// ЛЁД-64 · the rules of the night assault (Сергей 26.10: «шахматы будут частью скиллов-профессий»,
// form A «Штурм ЛЁД-64», PLANS: ~/dev/___trash/obo-mne/shahmaty-v-quequest-2026-10-26.md).
//
// Pure functions, no DOM. The board is 8×8, x = file 0..7 (left→right), y = rank 0..7 (0 = bottom, the
// core's row). Blue guards (the player) stand below, red programs come from the top. Every unit moves by a
// chess rule, but the player is not told so: the names come after the skill (level 6, Витя's reveal).
//
//   tank      — rook:   any number of squares in a straight line, stops at a wall or a unit, takes an enemy
//   scout     — knight: an L-jump, over walls and units
//   artillery — bishop: diagonals, like the tank
//   engineer  — pawn:   one square forward (two from its first row), takes only diagonally forward
//   core      — king:   one square any way, never into a square an enemy hits next turn
// Red programs use the same moves; «forward» for red is down.
//
// «What you see is what counts»: legalMoves() feeds both the light paths on the board and the move the
// game accepts. Red plans its move before the player moves and shows it as an arrow (Into the Breach);
// after the player's move every plan is executed if it is still a legal move in the new position.

export const SIZE = 8;
export const KINDS = Object.freeze({
  // name: our guard; redName: the intruder program of the same move (plan: «обходчик, сканер, прыгун»)
  tank: { chess: 'rook', name: 'ТАНК', redName: 'ОБХОДЧИК', chessName: 'ЛАДЬЯ' },
  scout: { chess: 'knight', name: 'РАЗВЕДЧИК', redName: 'ПРЫГУН', chessName: 'КОНЬ' },
  artillery: { chess: 'bishop', name: 'АРТИЛЛЕРИЯ', redName: 'СКАНЕР', chessName: 'СЛОН' },
  engineer: { chess: 'pawn', name: 'РЕМОНТНИК', redName: 'СКРИПТ', chessName: 'ПЕШКА' },
  core: { chess: 'king', name: 'ЯДРО', redName: 'ЯДРО', chessName: 'КОРОЛЬ' },
  heavy: { chess: 'queen', name: 'ТЯЖЁЛЫЙ', redName: 'ТЯЖЁЛЫЙ', chessName: 'ФЕРЗЬ' }, // the puzzles' queen
});
const LINES = { rook: [[1, 0], [-1, 0], [0, 1], [0, -1]], bishop: [[1, 1], [1, -1], [-1, 1], [-1, -1]] };
LINES.queen = [...LINES.rook, ...LINES.bishop];
export const JUMPS = Object.freeze([[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]);
const AROUND = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

export const key = (x, y) => `${x},${y}`;
export const onBoard = (x, y) => x >= 0 && y >= 0 && x < SIZE && y < SIZE;

// A fresh state from a level: units [{id, kind, side:'blue'|'red', x, y}], walls [[x,y]], packets [{x,y,v}].
export function createState(level) {
  return {
    units: (level.units ?? []).map((u) => ({ moved: false, ...u })),
    walls: new Set((level.walls ?? []).map(([x, y]) => key(x, y))),
    packets: (level.packets ?? []).map((p) => ({ ...p })),
    plans: {},
    turn: 0,
    moves: 0,
    money: 0,
    lost: [],
    taken: [],
    over: null,
  };
}
export function clone(s) {
  return { ...s, units: s.units.map((u) => ({ ...u })), walls: s.walls, packets: s.packets.map((p) => ({ ...p })), plans: { ...s.plans }, lost: [...s.lost], taken: [...s.taken] };
}
export const unitAt = (s, x, y) => s.units.find((u) => u.x === x && u.y === y) ?? null;
export const isWall = (s, x, y) => s.walls.has(key(x, y));

// The squares a unit can move to now: [{x, y, take: unitId|null}]. «Forward» is +y for blue, −y for red.
export function rawMoves(s, u) {
  const out = [];
  const t = KINDS[u.kind]?.chess;
  const free = (x, y) => onBoard(x, y) && !isWall(s, x, y);
  const push = (x, y) => {
    if (!free(x, y)) return false;
    const o = unitAt(s, x, y);
    if (!o) { out.push({ x, y, take: null }); return true; }
    if (o.side !== u.side) out.push({ x, y, take: o.id });
    return false;
  };
  if (t === 'rook' || t === 'bishop' || t === 'queen') {
    for (const [dx, dy] of LINES[t]) for (let k = 1; k < SIZE; k++) if (!push(u.x + dx * k, u.y + dy * k)) break;
  } else if (t === 'knight') {
    // u.jumps: the player's own list (level 7, Витя's scout) — the engine moves by the player's code
    for (const [dx, dy] of (u.jumps ?? JUMPS)) push(u.x + dx, u.y + dy);
  } else if (t === 'king') {
    for (const [dx, dy] of AROUND) push(u.x + dx, u.y + dy);
  } else if (t === 'pawn') {
    const f = u.side === 'blue' ? 1 : -1;
    if (free(u.x, u.y + f) && !unitAt(s, u.x, u.y + f)) {
      out.push({ x: u.x, y: u.y + f, take: null });
      const home = u.side === 'blue' ? u.y <= 1 : u.y >= SIZE - 2;
      if (home && !u.moved && free(u.x, u.y + 2 * f) && !unitAt(s, u.x, u.y + 2 * f)) out.push({ x: u.x, y: u.y + 2 * f, take: null });
    }
    for (const dx of [-1, 1]) {
      const o = free(u.x + dx, u.y + f) ? unitAt(s, u.x + dx, u.y + f) : null;
      if (o && o.side !== u.side) out.push({ x: u.x + dx, y: u.y + f, take: o.id });
    }
  }
  return out;
}

// Squares a side hits (could take on): the red «under fire» zone drawn on the board.
export function attacked(s, side) {
  const hit = new Set();
  for (const u of s.units) {
    if (u.side !== side) continue;
    if (KINDS[u.kind].chess === 'pawn') { const f = side === 'blue' ? 1 : -1; for (const dx of [-1, 1]) if (onBoard(u.x + dx, u.y + f) && !isWall(s, u.x + dx, u.y + f)) hit.add(key(u.x + dx, u.y + f)); continue; }
    // a slider hits through to the first unit, a unit of its own side included (it defends it)
    for (const m of rawMoves({ ...s, units: s.units.filter((o) => o.side !== side || o.id === u.id) }, u)) hit.add(key(m.x, m.y));
  }
  return hit;
}

// Red decides before the player moves: take a blue unit if it can (the core first, then the dearest),
// else step towards the core (or straight down when there is no core). Plans are shown as arrows.
const VALUE = { core: 100, tank: 5, artillery: 3, scout: 3, engineer: 1 };
export function planRed(s) {
  const plans = {};
  const core = s.units.find((u) => u.side === 'blue' && u.kind === 'core');
  for (const u of s.units) {
    if (u.side !== 'red') continue;
    const ms = rawMoves(s, u);
    if (!ms.length) continue;
    const takes = ms.filter((m) => m.take).sort((a, b) => VALUE[unitById(s, b.take).kind] - VALUE[unitById(s, a.take).kind]);
    if (takes.length) { plans[u.id] = { x: takes[0].x, y: takes[0].y }; continue; }
    if (u.still) continue; // a guard post: shoots, never walks
    const goal = core ?? { x: u.x, y: 0 };
    const quiet = ms.filter((m) => !m.take).sort((a, b) => (Math.abs(a.x - goal.x) + Math.abs(a.y - goal.y)) - (Math.abs(b.x - goal.x) + Math.abs(b.y - goal.y)) || a.y - b.y || a.x - b.x);
    plans[u.id] = { x: quiet[0].x, y: quiet[0].y };
  }
  return plans;
}
export const unitById = (s, id) => s.units.find((u) => u.id === id) ?? null;

function turretTarget(s, u) {
  const t = rawMoves(s, u).filter((m) => m.take).sort((a, b) => VALUE[unitById(s, b.take).kind] - VALUE[unitById(s, a.take).kind])[0];
  return t ? { x: t.x, y: t.y } : null;
}
// Execute every red plan that is still a legal move; returns the events (for the scene and the sounds).
export function runRed(s) {
  const events = [];
  for (const u of [...s.units]) {
    if (u.side !== 'red' || !unitById(s, u.id)) continue;
    // a guard post (still) is a turret: it fires at whatever stands in its red zone after the player's move
    const p = u.still ? turretTarget(s, u) : s.plans[u.id];
    if (!p) continue;
    const m = rawMoves(s, u).find((q) => q.x === p.x && q.y === p.y);
    if (!m) { events.push({ type: 'blocked', id: u.id }); continue; }
    if (m.take) {
      const victim = unitById(s, m.take);
      s.units = s.units.filter((o) => o.id !== m.take);
      s.lost.push(victim.kind);
      events.push({ type: 'take', id: u.id, victim: victim.id, kind: victim.kind, x: m.x, y: m.y });
    } else events.push({ type: 'move', id: u.id, x: m.x, y: m.y });
    u.x = m.x; u.y = m.y; u.moved = true;
  }
  s.plans = {};
  return events;
}

// Would the core be taken if red runs its current plans after this blue move? (the «check» filter)
function coreTakenAfter(s, u, m) {
  const t = clone(s);
  applyBlue(t, t.units.find((o) => o.id === u.id), m, { quiet: true });
  runRed(t);
  return !t.units.some((o) => o.side === 'blue' && o.kind === 'core') && s.units.some((o) => o.side === 'blue' && o.kind === 'core');
}

// The player's legal moves for a unit: its raw moves, minus those that leave the core to a planned hit
// (when the core is under fire, only saving moves stay lit — a check, without the word).
export function legalMoves(s, u) {
  if (!u || u.side !== 'blue' || s.over) return [];
  const ms = rawMoves(s, u);
  if (!s.units.some((o) => o.side === 'blue' && o.kind === 'core')) return ms;
  return ms.filter((m) => !coreTakenAfter(s, u, m) && !(u.kind === 'core' && coreHitAt(s, u, m)));
}
// The core never steps onto a square red hits after the step (as a king): stepping along the line of a
// planned shot only blocks it for one turn, so «leave the line» would stop being the lesson.
function coreHitAt(s, u, m) {
  const t = clone(s);
  t.units = t.units.filter((o) => o.id !== m.take);
  const c = t.units.find((o) => o.id === u.id); c.x = m.x; c.y = m.y;
  return attacked(t, 'red').has(key(m.x, m.y));
}
export function coreUnderFire(s) {
  const core = s.units.find((o) => o.side === 'blue' && o.kind === 'core');
  return Boolean(core && Object.values(s.plans).some((p) => p.x === core.x && p.y === core.y));
}

function applyBlue(s, u, m, { quiet = false } = {}) {
  const events = [];
  if (m.take) {
    const v = unitById(s, m.take);
    s.units = s.units.filter((o) => o.id !== m.take);
    delete s.plans[m.take];
    s.taken.push(v.kind);
    events.push({ type: 'take', id: u.id, victim: v.id, kind: v.kind, x: m.x, y: m.y });
  } else events.push({ type: 'move', id: u.id, x: m.x, y: m.y });
  u.x = m.x; u.y = m.y; u.moved = true;
  const pk = s.packets.findIndex((p) => p.x === m.x && p.y === m.y);
  if (pk >= 0) { const p = s.packets[pk]; s.packets.splice(pk, 1); s.money += p.v; events.push({ type: 'packet', x: p.x, y: p.y, v: p.v, big: Boolean(p.big) }); }
  if (!quiet) s.moves++;
  return events;
}

// One full turn: the player's move, then red executes its plans, then red plans the next turn.
// Returns { ok, events } — ok=false when the move is not among legalMoves (the board never lit it).
export function playTurn(s, unitId, x, y) {
  const u = unitById(s, unitId);
  const m = legalMoves(s, u).find((q) => q.x === x && q.y === y);
  if (!m) return { ok: false, events: [] };
  const events = applyBlue(s, u, m);
  events.push(...runRed(s));
  s.turn++;
  s.plans = planRed(s);
  return { ok: true, events };
}
export function start(s) { s.plans = planRed(s); return s; }

// Minimum player moves to collect every packet with one unit on an empty field (the «лучший» count / stars).
// Red is ignored here; a level that wants stars has no red.
export function parMoves(level) {
  const s0 = start(createState(level));
  const blues = s0.units.filter((u) => u.side === 'blue');
  const startKey = (s) => s.units.filter((u) => u.side === 'blue').map((u) => `${u.id}:${u.x},${u.y}`).join('|') + '#' + s.packets.map((p) => key(p.x, p.y)).join(';');
  let frontier = [s0]; const seen = new Set([startKey(s0)]);
  for (let d = 0; d < 40 && frontier.length; d++) {
    const next = [];
    for (const s of frontier) {
      if (!s.packets.length) return d;
      for (const u of s.units.filter((o) => o.side === 'blue')) {
        for (const m of rawMoves(s, u)) {
          if (m.take) continue;
          const t = clone(s); applyBlue(t, unitById(t, u.id), m);
          const k = startKey(t); if (seen.has(k)) continue; seen.add(k); next.push(t);
        }
      }
    }
    frontier = next;
  }
  void blues;
  return null;
}
