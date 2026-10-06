/*
 * ТЕХНОМАГИЯ — объёмный вид: тесные места уровня.
 *
 * Отдельным модулем, чтобы те же места считались и в браузере (кадры и
 * замер среза стен), и в Node (pilot-vid/test-kamera.mjs) — одна формула
 * на оба прогона, а не две, которые однажды разойдутся.
 *
 * Не руками, а по сетке: проходимая клетка, вокруг которой больше всего
 * высокого (стены, двери, кристалл). Из кандидатов берётся по одному
 * лучшему каждого рода — коридор (высокое с двух противоположных сторон),
 * проём (рядом дверь или кристалл в стене), угол (с двух соседних), —
 * чтобы три места проверяли разные беды, а не три одинаковых угла.
 */

import { TILE, blocksMove } from '../level.js';
import { isTall } from './scene.js';

export function tightSpots(w) {
  const at = (x, y) => (x < 0 || y < 0 || x >= w.w || y >= w.h ? TILE.WALL : w.tiles[y * w.w + x]);
  const high = (t) => isTall(t) || t === TILE.CRYSTAL;
  const doorish = (t) => t !== TILE.WALL && (isTall(t) || t === TILE.CRYSTAL);
  const out = [];
  for (let y = 0; y < w.h; y += 1) {
    for (let x = 0; x < w.w; x += 1) {
      const t = at(x, y);
      if (blocksMove(t) || isTall(t)) continue;
      /* Клетка с ядром или свечой — не место для героя: в «Башне» поиск
         сначала выбрал клетку ядра внутри кольца силовых дверей, и мера
         честно показала 40% — героя закрывал постамент ядра, а не стены. */
      if ((w.props || []).some((p) => Math.hypot(p.x / 32 - (x + 0.5), p.y / 32 - (y + 0.5)) < 0.75)) continue;
      let n8 = 0;
      for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) if ((dx || dy) && high(at(x + dx, y + dy))) n8 += 1;
      if (n8 < 3) continue;
      const N = high(at(x, y - 1)), S = high(at(x, y + 1)), W = high(at(x - 1, y)), E = high(at(x + 1, y));
      const corridor = (N && S) || (W && E);
      const door = [[0, -1], [0, 1], [-1, 0], [1, 0]].some(([dx, dy]) => doorish(at(x + dx, y + dy)));
      const corner = (N || S) && (W || E);
      const kind = corridor ? 'коридор' : door ? 'проём' : corner ? 'угол' : 'стена';
      out.push({ x, y, n8, kind, score: n8 + (corridor ? 3 : 0) + (door ? 2 : 0) });
    }
  }
  out.sort((a, b) => b.score - a.score || a.y - b.y || a.x - b.x);
  const picked = [];
  for (const kind of ['коридор', 'проём', 'угол']) {
    const best = out.find((c) => c.kind === kind && picked.every((p) => Math.hypot(p.x - c.x, p.y - c.y) >= 4));
    if (best) picked.push(best);
  }
  for (const c of out) {
    if (picked.length >= 3) break;
    if (picked.every((p) => Math.hypot(p.x - c.x, p.y - c.y) >= 4)) picked.push(c);
  }
  return { picked, candidates: out.length };
}

/*
 * Открытый двор для опорной меры: проходимая клетка, вокруг которой в
 * радиусе трёх клеток нет ничего высокого. Ближайшая к точке near.
 */
export function openSpot(w, near = [w.w / 2, w.h / 2]) {
  const at = (x, y) => (x < 0 || y < 0 || x >= w.w || y >= w.h ? TILE.WALL : w.tiles[y * w.w + x]);
  let best = null;
  for (let y = 3; y < w.h - 3; y += 1) {
    for (let x = 3; x < w.w - 3; x += 1) {
      let clear = true;
      for (let dy = -3; dy <= 3 && clear; dy += 1) for (let dx = -3; dx <= 3; dx += 1) {
        const t = at(x + dx, y + dy);
        if (t !== TILE.FLOOR && t !== TILE.RUG) { clear = false; break; }
      }
      if (!clear) continue;
      /* Ядро и свеча — тоже высокое, хоть и не клетка. */
      if ((w.props || []).some((p) => Math.hypot(p.x / 32 - (x + 0.5), p.y / 32 - (y + 0.5)) < 3.5)) continue;
      const d = Math.hypot(x - near[0], y - near[1]);
      if (!best || d < best.d) best = { x, y, d };
    }
  }
  return best;
}
