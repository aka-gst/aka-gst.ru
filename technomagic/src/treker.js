/*
 * ТЕХНОМАГИЯ — задания на экране слева (отзыв Сергея 04.10, п.20:
 * «квесты отображать на экране слева»).
 *
 * До 05.10 взятые задания жили только в журнале (L / ЗАДАНИЯ): чтобы
 * вспомнить, что делать, игру надо было остановить и открыть книгу.
 * Теперь слева сверху — короткий список взятых: название и следующий шаг
 * словами жителя (zhiteli-vid.js, questNext — тот же текст, что в
 * журнале). Ведомое стрелкой — первым и отмечено; главное — раньше
 * побочного. Не больше трёх строк, остальное — «ЕЩЁ N В ЖУРНАЛЕ».
 *
 * Чистая функция над миром: правила мира её не читают, она — их.
 * Проверка — tests/treker.mjs на настоящем мире «Башни».
 */

import { questLog } from './zhiteli.js';
import { knownQuests, questNext } from './zhiteli-vid.js';

export const TRACKER_ROWS = 3;

export function trackerView(world, tracked = null, limit = TRACKER_ROWS) {
  if (!world || !world.zhiteli) return null;
  const known = knownQuests(questLog(world));
  const open = known.filter((q) => q.state === 'vzyato');
  const rank = (q) => (q.id === tracked ? 2 : 0) + (q.must ? 1 : 0);
  const ordered = open.map((q, i) => ({ q, i })).sort((a, b) => rank(b.q) - rank(a.q) || a.i - b.i).map(({ q }) => q);
  return {
    rows: ordered.slice(0, limit).map((q) => ({
      id: q.id,
      title: q.title,
      next: questNext(world, q),
      must: Boolean(q.must),
      tracked: q.id === tracked,
    })),
    more: Math.max(0, ordered.length - limit),
    done: known.filter((q) => q.state === 'sdelano').length,
    known: known.length,
  };
}

/* Отпечаток для перерисовки только при смене (DOM не трогается каждый кадр). */
export function trackerKey(view) {
  if (!view) return '';
  return JSON.stringify([view.rows.map((r) => [r.id, r.next, r.tracked]), view.more, view.done, view.known]);
}
