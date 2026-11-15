// ЛЁД-64 · real chess for the «наряды» (Lichess puzzles, CC0): a position from FEN, legal moves (a move that
// leaves your own king attacked is not legal), check and mate. Enough for the beginner puzzles we ship:
// no castling, no en passant, a promotion only when the UCI move names it. Own code (chess.js is not vendored).
//
// Board: pieces [{id, t:'k'|'q'|'r'|'b'|'n'|'p', c:'w'|'b', x, y}], x = file 0..7 (a..h), y = rank 0..7 (1..8).

const LINES = { r: [[1, 0], [-1, 0], [0, 1], [0, -1]], b: [[1, 1], [1, -1], [-1, 1], [-1, -1]] };
LINES.q = [...LINES.r, ...LINES.b];
const JUMP = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const AROUND = LINES.q;
const on = (x, y) => x >= 0 && y >= 0 && x < 8 && y < 8;
export const sqName = (x, y) => 'abcdefgh'[x] + (y + 1);
export const parseSq = (s) => ({ x: 'abcdefgh'.indexOf(s[0]), y: Number(s[1]) - 1 });

export function fromFen(fen) {
  const [rows, turn] = fen.split(' ');
  const pieces = []; let n = 0;
  rows.split('/').forEach((row, i) => {
    let x = 0; const y = 7 - i;
    for (const ch of row) {
      if (/\d/.test(ch)) { x += Number(ch); continue; }
      pieces.push({ id: `p${n++}`, t: ch.toLowerCase(), c: ch === ch.toLowerCase() ? 'b' : 'w', x, y });
      x++;
    }
  });
  return { pieces, turn: turn === 'b' ? 'b' : 'w' };
}
export const at = (b, x, y) => b.pieces.find((p) => p.x === x && p.y === y) ?? null;
const copy = (b) => ({ pieces: b.pieces.map((p) => ({ ...p })), turn: b.turn });

// Squares a piece attacks (for check), and its pseudo-legal moves.
function targets(b, p, attacksOnly = false) {
  const out = [];
  if (p.t === 'n' || p.t === 'k') {
    for (const [dx, dy] of p.t === 'n' ? JUMP : AROUND) { const x = p.x + dx, y = p.y + dy; if (!on(x, y)) continue; const o = at(b, x, y); if (!o || o.c !== p.c || attacksOnly) out.push({ x, y }); }
  } else if (p.t === 'p') {
    const f = p.c === 'w' ? 1 : -1;
    for (const dx of [-1, 1]) { const x = p.x + dx, y = p.y + f; if (!on(x, y)) continue; const o = at(b, x, y); if (attacksOnly || (o && o.c !== p.c)) out.push({ x, y }); }
    if (!attacksOnly && on(p.x, p.y + f) && !at(b, p.x, p.y + f)) {
      out.push({ x: p.x, y: p.y + f });
      const home = p.c === 'w' ? 1 : 6;
      if (p.y === home && !at(b, p.x, p.y + 2 * f)) out.push({ x: p.x, y: p.y + 2 * f });
    }
  } else {
    for (const [dx, dy] of LINES[p.t]) for (let k = 1; k < 8; k++) { const x = p.x + dx * k, y = p.y + dy * k; if (!on(x, y)) break; const o = at(b, x, y); if (!o) { out.push({ x, y }); continue; } if (o.c !== p.c || attacksOnly) out.push({ x, y }); break; }
  }
  return out;
}
export function attackedBy(b, x, y, color) { return b.pieces.some((p) => p.c === color && targets(b, p, true).some((q) => q.x === x && q.y === y)); }
export function inCheck(b, color) { const k = b.pieces.find((p) => p.t === 'k' && p.c === color); return Boolean(k && attackedBy(b, k.x, k.y, color === 'w' ? 'b' : 'w')); }

// Apply a move {from:{x,y}, to:{x,y}, promo?} — returns a new board (turn switches).
export function apply(b, m) {
  const n = copy(b);
  const p = at(n, m.from.x, m.from.y);
  if (!p) return null;
  n.pieces = n.pieces.filter((o) => !(o.x === m.to.x && o.y === m.to.y));
  p.x = m.to.x; p.y = m.to.y;
  if (p.t === 'p' && (p.y === 7 || p.y === 0)) p.t = m.promo ?? 'q';
  n.turn = b.turn === 'w' ? 'b' : 'w';
  return n;
}
export const applyUci = (b, uci) => apply(b, { from: parseSq(uci.slice(0, 2)), to: parseSq(uci.slice(2, 4)), promo: uci[4] });

export function legalFrom(b, p) {
  if (!p || p.c !== b.turn) return [];
  return targets(b, p).filter((q) => !inCheck(apply(b, { from: p, to: q }), p.c));
}
export function legalAll(b) { return b.pieces.filter((p) => p.c === b.turn).flatMap((p) => legalFrom(b, p).map((q) => ({ from: { x: p.x, y: p.y }, to: q }))); }
export function isMate(b) { return inCheck(b, b.turn) && legalAll(b).length === 0; }
export const uciOf = (m) => sqName(m.from.x, m.from.y) + sqName(m.to.x, m.to.y) + (m.promo ?? '');
