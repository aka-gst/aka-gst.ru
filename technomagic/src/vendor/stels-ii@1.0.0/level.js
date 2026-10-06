/*
 * ФАЙЛ ИГРЫ, НЕ МОДУЛЯ — прокладка ТехноМагии для общего модуля stels-ii.
 * =========================================================
 * Лежит в папке вендора рядом с файлами модуля только потому, что
 * vision.js и light.js модуля импортируют `./level.js` из своей папки
 * (MANIFEST.json → needs: rayBlocked, rayReach). В MANIFEST.json не входит
 * и sha-сверкой не охраняется — правится здесь, как любой файл игры.
 * tools/obnovit-stels-ii.sh при смене версии модуля переносит его в папку
 * новой версии байт в байт. Импорты игры — на две папки вверх (src/).
 *
 * ПРОКЛАДКА: луч для vision.js модуля
 * =========================================================
 * vision.js (дословно из МГС, модуль stels-ii) импортирует из `./level.js`
 * две функции луча — rayBlocked и rayReach — и зовёт их с первым
 * аргументом `level`. В МГС это его карта; здесь это наш мир целиком:
 * так зрение стража ходит по нашим клеткам и нашим облакам, а не по
 * чужой сетке.
 *
 * rayBlocked — «между точками есть заслон», то есть ровно отрицание
 * нашего hasSight (world.js). Это главное, ради чего прокладка сделана
 * так, а не своей проверкой клеток: hasSight уже знает, что пар и пыль
 * прячут всех одинаково (field.js, cloudsBlock), и страж МГС слепнет в
 * нашем паре сам, без единой строки о паре в его коде. Свой обход
 * клеток здесь разошёлся бы с тем, чем целится игрок, — и пар слепил
 * бы игрока, но не стражу.
 *
 * rayReach — докуда доходит луч, прежде чем упрётся. Нужен только для
 * отрисовки конуса (coneShape); шаг — треть клетки, как в МГС, упор —
 * то, что держит взгляд у нас (blocksSight), и облако пара или пыли на
 * отрезке от стража (cloudsBlock — та же проверка, что в hasSight).
 * Конус, нарисованный сквозь пар, врал бы о правиле: игрок видел бы,
 * что страж смотрит сквозь облако, а страж бы не видел.
 */

import { hasSight, tileAt } from '../../world.js';
import { blocksSight, TILE_SIZE } from '../../level.js';
import { cloudsBlock } from '../../field.js';

export function rayBlocked(world, ax, ay, bx, by) {
  return !hasSight(world, ax, ay, bx, by);
}

export function rayReach(world, x, y, angle, maxDist) {
  const step = TILE_SIZE / 3;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const clouds = world.clouds && world.clouds.length;
  for (let d = step; d <= maxDist; d += step) {
    const px = x + cos * d;
    const py = y + sin * d;
    if (blocksSight(tileAt(world, px, py))) return d - step;
    if (clouds && cloudsBlock(world, x, y, px, py)) return d - step;
  }
  return maxDist;
}
