/*
 * УКАЗАТЕЛЬ ЦЕЛИ ПОДСКАЗКИ — геометрия экрана, без холста и без DOM
 * =========================================================
 * Приёмка 03.10, пункт 1: на телефоне 375×812 подсказка «СОЖГИ ДЕРЕВЯННЫЕ
 * ВОРОТА» видна, а ворота — в одиннадцати клетках правее, за краем кадра.
 * Подсказке нужна точка на экране:
 *
 *   цель в кадре   → кольцо прямо на цели;
 *   цель за кадром → стрелка у края экрана, на линии «от игрока к цели»,
 *                    острием к цели.
 *
 * Модуль чистый: ему дают размер кадра в CSS-пикселях, точку цели и
 * якорь (игрок на экране) в тех же пикселях, он возвращает, где и куда
 * рисовать. Поэтому его проверяет прогон в Node (tests/ukazatel.mjs), а
 * отрисовка (render.js) только рисует то, что он сказал.
 *
 * ДВА ПРАВИЛА, ОБА ВЫСТРАДАННЫЕ
 *
 * 1. Стрелка стоит на ЛУЧЕ от игрока к цели, а не в ближайшей точке края.
 *    Простой зажим координат (x в пределы, y в пределы) для цели «вправо
 *    и далеко вверх» ставит стрелку в угол экрана, и острие из угла
 *    показывает не туда: человек пойдёт по диагонали, а цель почти
 *    прямо вверх. Такой зажим держится в проверке как отрицательный
 *    контроль: на нём проверка обязана краснеть.
 *
 * 2. Стрелка не ложится под кнопки. На телефоне низ и углы заняты
 *    кнопками стихий, «ПУСК», шапкой операции, «НА САЙТ», — main.js
 *    отдаёт их прямоугольники (в пикселях холста), и стрелка, попавшая
 *    под любой из них, сдвигается вдоль края до ближайшего свободного
 *    места. Острие при этом пересчитывается от нового места к цели, а не
 *    остаётся прежним: указатель, сдвинутый вбок, но смотрящий «как
 *    раньше», показывал бы мимо.
 */

/*
 * 3. Цель ПОД КНОПКОЙ — не в кадре (приёмка слоя «г», 03.10). Цель
 *    подсказки, лёгшая под ПУСК (телефон боком, компьютер), считалась «в
 *    кадре»: кольцо рисовалось под кнопкой, стрелки не было, и человек
 *    не видел ни того, ни другого. Теперь цель, накрытая любым
 *    прямоугольником из `avoid`, — за кадром: стрелка встаёт на луче от
 *    игрока к цели прямо перед накрывшей её кнопкой и смотрит на цель
 *    («она тут, за кнопкой»); если и там кнопка — вдоль края, как в п.2.
 *    Поломка для проверки: `POINTER.covered = false` — прежнее
 *    поведение, проверка tests/ukazatel.mjs обязана покраснеть.
 */
export const POINTER = {
  /* Цель под кнопкой — не в кадре (п.3 выше). */
  covered: true,
  /* Отступ от края кадра: стрелка целиком внутри и не под пальцем у
     самой кромки. */
  margin: 30,
  /* Запас вокруг кнопок: остриё не касается кнопки. */
  pad: 10,
  /* Шаг поиска свободного места вдоль края. */
  step: 4,
};

function inside(x, y, rect, pad) {
  return x >= rect.x - pad && x <= rect.x + rect.w + pad
    && y >= rect.y - pad && y <= rect.y + rect.h + pad;
}

/*
 * Периметр внутреннего прямоугольника как одна линия: позиция s от 0 до
 * длины периметра ↔ точка на краю. Нужен, чтобы «сдвинуться вдоль края»
 * через угол без особых случаев.
 */
function perimeter(box) {
  const w = box.x1 - box.x0;
  const h = box.y1 - box.y0;
  const total = 2 * (w + h);
  const at = (s) => {
    let t = ((s % total) + total) % total;
    if (t <= w) return { x: box.x0 + t, y: box.y0, side: 'top' };
    t -= w;
    if (t <= h) return { x: box.x1, y: box.y0 + t, side: 'right' };
    t -= h;
    if (t <= w) return { x: box.x1 - t, y: box.y1, side: 'bottom' };
    t -= w;
    return { x: box.x0, y: box.y1 - t, side: 'left' };
  };
  const of = (x, y) => {
    if (Math.abs(y - box.y0) < 1e-6) return x - box.x0;
    if (Math.abs(x - box.x1) < 1e-6) return w + (y - box.y0);
    if (Math.abs(y - box.y1) < 1e-6) return w + h + (box.x1 - x);
    return 2 * w + h + (box.y1 - y);
  };
  return { total, at, of };
}

/*
 * view    { w, h }        размер кадра в CSS-пикселях
 * target  { x, y }        цель на экране (может быть далеко за кадром)
 * options.anchor { x, y } откуда «смотрит» стрелка — игрок на экране;
 *                         по умолчанию центр кадра
 * options.avoid  [{x,y,w,h}] прямоугольники кнопок в пикселях кадра
 *
 * Ответ: { onScreen: true, x, y } — рисовать кольцо в (x, y);
 *        { onScreen: false, x, y, angle, side } — стрелку в (x, y)
 *        острием по углу angle (радианы, экранные: y вниз).
 */
export function hintPointer(view, target, options = {}) {
  const margin = options.margin ?? POINTER.margin;
  const pad = options.pad ?? POINTER.pad;
  const avoid = options.avoid || [];
  const box = { x0: margin, y0: margin, x1: view.w - margin, y1: view.h - margin };

  const inFrame = target.x >= box.x0 && target.x <= box.x1 && target.y >= box.y0 && target.y <= box.y1;
  const cover = inFrame && POINTER.covered ? avoid.find((rect) => inside(target.x, target.y, rect, 0)) : null;
  if (inFrame && !cover) {
    return { onScreen: true, x: target.x, y: target.y };
  }

  /* Якорь обязан быть внутри рамки, иначе луч из него может не встретить
     край вовсе. Игрок на экране всегда внутри, но защита дешевле поломки. */
  const ax = Math.min(box.x1, Math.max(box.x0, options.anchor ? options.anchor.x : view.w / 2));
  const ay = Math.min(box.y1, Math.max(box.y0, options.anchor ? options.anchor.y : view.h / 2));
  const dx = target.x - ax;
  const dy = target.y - ay;
  const blocked = (px, py) => avoid.some((rect) => inside(px, py, rect, pad));

  /* Цель под кнопкой: стрелка — на луче к цели, там, где он входит в
     кнопку (с запасом pad), острием к цели. */
  if (cover) {
    const t = enterAt(ax, ay, dx, dy, cover, pad);
    if (t !== null) {
      const x = ax + dx * t;
      const y = ay + dy * t;
      if (x >= box.x0 && x <= box.x1 && y >= box.y0 && y <= box.y1 && !blocked(x, y)) {
        return { onScreen: false, covered: true, x, y, side: 'cover', moved: false, angle: Math.atan2(target.y - y, target.x - x) };
      }
    }
  }

  /* Где луч из якоря к цели выходит из рамки: ближайшее из пересечений
     с вертикальной и горизонтальной стороной. */
  const tx = dx > 0 ? (box.x1 - ax) / dx : dx < 0 ? (box.x0 - ax) / dx : Infinity;
  const ty = dy > 0 ? (box.y1 - ay) / dy : dy < 0 ? (box.y0 - ay) / dy : Infinity;
  const t = Math.min(tx, ty);
  let x = Math.min(box.x1, Math.max(box.x0, ax + dx * t));
  let y = Math.min(box.y1, Math.max(box.y0, ay + dy * t));
  let side = tx < ty ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'bottom' : 'top');
  let moved = false;

  /* Под кнопкой — вдоль края к ближайшему свободному месту, в обе
     стороны сразу; победил тот, кто ближе. */
  if (blocked(x, y)) {
    const line = perimeter(box);
    const s0 = line.of(x, y);
    for (let d = POINTER.step; d <= line.total / 2; d += POINTER.step) {
      const a = line.at(s0 + d);
      const b = line.at(s0 - d);
      const pick = !blocked(a.x, a.y) ? a : !blocked(b.x, b.y) ? b : null;
      if (pick) {
        x = pick.x;
        y = pick.y;
        side = pick.side;
        moved = true;
        break;
      }
    }
  }

  return { onScreen: false, covered: Boolean(cover), x, y, side, moved, angle: Math.atan2(target.y - y, target.x - x) };
}

/*
 * Где луч (ax, ay) + t·(dx, dy), t ∈ [0, 1], входит в прямоугольник,
 * раздутый на pad, — чуть раньше входа (на 1 px), чтобы точка была
 * снаружи. null — якорь уже внутри или луч прямоугольник не встречает.
 */
function enterAt(ax, ay, dx, dy, rect, pad) {
  const x0 = rect.x - pad;
  const x1 = rect.x + rect.w + pad;
  const y0 = rect.y - pad;
  const y1 = rect.y + rect.h + pad;
  if (ax >= x0 && ax <= x1 && ay >= y0 && ay <= y1) return null;
  let tMin = 0;
  let tMax = 1;
  for (const [p, d, lo, hi] of [[ax, dx, x0, x1], [ay, dy, y0, y1]]) {
    if (Math.abs(d) < 1e-9) {
      if (p < lo || p > hi) return null;
      continue;
    }
    let t0 = (lo - p) / d;
    let t1 = (hi - p) / d;
    if (t0 > t1) [t0, t1] = [t1, t0];
    tMin = Math.max(tMin, t0);
    tMax = Math.min(tMax, t1);
    if (tMin > tMax) return null;
  }
  const len = Math.hypot(dx, dy) || 1;
  return Math.max(0, tMin - 1 / len);
}

/* Мир → экран тем же переводом, что у отрисовки сверху (render.js, draw):
   камера в центре кадра, масштаб zoom. */
export function worldToScreen(point, cam, view) {
  return {
    x: (point.x - cam.camX) * cam.zoom + view.w / 2,
    y: (point.y - cam.camY) * cam.zoom + view.h / 2,
  };
}
