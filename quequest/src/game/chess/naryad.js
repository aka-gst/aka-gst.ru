// ЛЁД-64 · «Наряд»: real positions from live games (Lichess puzzles, CC0) dressed as a break-in. Red has just
// moved (the puzzle's first move, shown as an arrow); the player finds the answer. A mate in one counts with
// any mating move; every other puzzle counts only by its line. Pure: no DOM.
import { fromFen, applyUci, legalFrom, at, isMate, sqName, parseSq } from './board.js';
import DATA from './naryady.js';

export const NARYADY = Object.freeze(DATA.puzzles);
export const KIND_OF = Object.freeze({ k: 'core', q: 'heavy', r: 'tank', b: 'artillery', n: 'scout', p: 'engineer' });

export function startNaryad(z) {
  const before = fromFen(z.fen);
  const board = applyUci(before, z.moves[0]);
  const f = parseSq(z.moves[0].slice(0, 2)), t = parseSq(z.moves[0].slice(2, 4));
  return { z, board, me: board.turn, last: { from: f, to: t }, step: 1, done: false };
}
// Board → screen: the player's side always at the bottom (black plays from a turned board).
export const view = (nz, x, y) => (nz.me === 'w' ? { x, y } : { x: 7 - x, y: 7 - y });
export const unview = view; // the turn is its own inverse
export function unitsOf(nz) {
  return nz.board.pieces.map((p) => { const v = view(nz, p.x, p.y); return { id: p.id, kind: KIND_OF[p.t], side: p.c === nz.me ? 'blue' : 'red', x: v.x, y: v.y }; });
}
// Lit squares for a piece at a screen square (in screen coordinates).
export function litFor(nz, sx, sy) {
  const b = unview(nz, sx, sy); const p = at(nz.board, b.x, b.y);
  if (!p || p.c !== nz.me || nz.done) return [];
  return legalFrom(nz.board, p).map((q) => ({ ...view(nz, q.x, q.y), take: Boolean(at(nz.board, q.x, q.y)) }));
}
// The player's move between two screen squares -> { ok, done, uci, reply?, mate? }
export function tryMove(nz, from, to) {
  const a = unview(nz, from.x, from.y), b = unview(nz, to.x, to.y);
  const p = at(nz.board, a.x, a.y);
  if (!p || !legalFrom(nz.board, p).some((q) => q.x === b.x && q.y === b.y)) return { ok: false, illegal: true };
  let uci = sqName(a.x, a.y) + sqName(b.x, b.y);
  if (p.t === 'p' && (b.y === 7 || b.y === 0)) uci += 'q';
  const want = nz.z.moves[nz.step];
  const after = applyUci(nz.board, uci);
  const mate = isMate(after);
  const right = uci === want || (want && uci.slice(0, 4) === want.slice(0, 4)) || (nz.z.theme === 'mateIn1' && mate);
  if (!right) return { ok: false, uci };
  nz.board = after; nz.step++;
  let reply = null;
  if (nz.step < nz.z.moves.length) { reply = nz.z.moves[nz.step]; nz.board = applyUci(nz.board, reply); nz.last = { from: parseSq(reply.slice(0, 2)), to: parseSq(reply.slice(2, 4)) }; nz.step++; }
  nz.done = nz.step >= nz.z.moves.length;
  return { ok: true, done: nz.done, uci, reply, mate };
}
// The answer's first square pair, in screen coordinates (the hint arrow).
export function hintOf(nz) {
  const m = nz.z.moves[nz.step]; if (!m) return null;
  const f = parseSq(m.slice(0, 2)), t = parseSq(m.slice(2, 4));
  return { from: view(nz, f.x, f.y), to: view(nz, t.x, t.y) };
}
