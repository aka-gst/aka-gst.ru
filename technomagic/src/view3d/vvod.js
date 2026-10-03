/*
 * ТЕХНОМАГИЯ — ввод в изометрии: экран ↔ мир, без DOM и без WebGL.
 *
 * Решение Сергея 03.10 (docs/ЕВГЕНИЙ-ЛЕСТНИЦА-2026-10-03.md §7): основной
 * вид «Лестницы» — изометрия как в Ultima Online, камеру можно повернуть и
 * приблизить. Мир при этом остаётся клеточным и смотрит в свои стороны
 * света (world.js не меняется), а человек смотрит в экран. Всё, что
 * переводит одно в другое, — здесь, чистыми функциями, чтобы перевод
 * проверялся прогоном в Node (tests/vid-vvod.mjs), а не глазом:
 *
 *   ходьба клавишами  W — вверх по экрану, D — вправо, при любом повороте;
 *   ходьба пальцем    куда тянешь по экрану, туда герой и идёт на экране;
 *   прицел стиком     куда показал палец на экране, туда и летит;
 *   мышь и тап        что под указателем — фигура, бочка, ворота, пол.
 *
 * Плоский вид (render.js) ничего этого не зовёт: у него экран и мир
 * смотрят в одну сторону, и перевод — тождество.
 */

import { TILE, TILE_SIZE } from '../level.js';
import { groundAxes, screenToGround, worldToScreen, cutLimit, WALL_H } from './camera.js';

const T = TILE_SIZE;

/* ---------------------------------------------------------
   КАКОЙ ВИД
   ---------------------------------------------------------
   ?vid=2d   — плоский вид на любом уровне (запасной путь, если объём на
               чьём-то телефоне не тянет или врёт);
   ?vid=iso  — изометрия на любом уровне, включая старую кампанию;
   ?lestnica — изометрия по умолчанию (решение Сергея 03.10).
   Старая кампания по умолчанию остаётся плоской — она принята в 2D, и
   «улучшить заодно» здесь значило бы сломать принятое (свод, п.15).
   --------------------------------------------------------- */
export function pickView(search = '', entry = null) {
  let text = String(search || '');
  try { text = decodeURIComponent(text); } catch (error) { /* как есть */ }
  const named = text.match(/(?:^|[?&])vid=([^&#]*)/i);
  const word = named ? named[1].toLowerCase() : '';
  if (word === '2d' || word === 'flat' || word === 'плоский') return '2d';
  if (word === 'iso' || word === 'uo' || word === 'изо') return 'iso';
  return entry === 'lestnica' ? 'iso' : '2d';
}

/* ---------------------------------------------------------
   КЛАВИШИ КАМЕРЫ
   ---------------------------------------------------------
   Только те, что игра не занимает: у неё WASD, стрелки, 1–5, правый
   Shift, пробел, Enter, J, Q, Backspace, B, Tab, Esc, P, M, R. Что
   пересечений нет, проверяет tests/vid-vvod.mjs по тексту main.js —
   новая игровая клавиша, совпавшая с камерой, покраснит прогон.
   --------------------------------------------------------- */
export const CAMERA_KEYS = {
  BracketLeft: 'left', Comma: 'left',
  BracketRight: 'right', Period: 'right',
  Minus: 'out', NumpadSubtract: 'out',
  Equal: 'in', NumpadAdd: 'in',
  Digit0: 'home', Numpad0: 'home',
};

/* ---------------------------------------------------------
   ХОДЬБА
   --------------------------------------------------------- */

/*
 * Клавиши: W — «вверх по экрану», D — «вправо по экрану», это оси
 * groundAxes того ракурса, что сейчас на экране. Диагональ W+D при этом
 * идёт по линии сетки (в изометрии 2:1 это и есть «вверх-вправо»): улицы и
 * коридоры «Башни» лежат вдоль сторон света, и клавишная диагональ ведёт
 * вдоль них, а не царапает стену под углом.
 *
 * moveX, moveY — как их отдаёт input.js: вправо и ВНИЗ по экрану.
 * Длина сохраняется: скорость героя не зависит от поворота камеры.
 */
export function keysToWorld(yaw, moveX, moveY) {
  const { up, right } = groundAxes(yaw);
  return [right[0] * moveX - up[0] * moveY, right[1] * moveX - up[1] * moveY];
}

/*
 * Палец: стик аналоговый, и человек тянет его туда, куда хочет, чтобы
 * герой пошёл НА ЭКРАНЕ. Пол в изометрии сжат по вертикали экрана в
 * sin(наклона) раз (при 30° — вдвое), поэтому без поправки палец, ведущий
 * под 45°, увёл бы героя под 27°. Поправка — растянуть экранную вертикаль
 * обратно на пол, а длину вернуть исходную.
 */
export function stickToWorld(yaw, pitch, sx, sy) {
  const len = Math.hypot(sx, sy);
  if (len < 1e-9) return [0, 0];
  const { up, right } = groundAxes(yaw);
  const a = sx;
  const b = -sy / Math.max(0.2, Math.sin(pitch));
  const gx = right[0] * a + up[0] * b;
  const gy = right[1] * a + up[1] * b;
  const k = len / (Math.hypot(gx, gy) || 1);
  return [gx * k, gy * k];
}

/* Угол прицельного стика (экранный, y вниз) → угол в мире. */
export function screenAngleToWorld(yaw, pitch, angle) {
  const [x, y] = stickToWorld(yaw, pitch, Math.cos(angle), Math.sin(angle));
  return Math.atan2(y, x);
}

/* ---------------------------------------------------------
   ЧТО ПОД УКАЗАТЕЛЕМ
   ---------------------------------------------------------
   Голый screenToGround отвечает «какая точка ПОЛА под пальцем». Для
   прицела этого мало: тело стража, бочка, ворота стоят над полом, и луч
   через грудь стража упирается в пол на 0,9 клетки дальше него (наклон
   30°: высота 0,5 / tg 30°). Клик по бочке попадал бы за бочку. Поэтому
   по порядку:

   1. фигура — середина тела на экране ближе радиуса тела: берётся сама
      фигура;
   2. высокая клетка — луч идёт сверху вниз, первая клетка, чья высота
      (с поправкой на срез стен у героя: срезанная стена — пенёк, и за ней
      видно пол) выше луча, — её середина;
   3. иначе — пол.
   --------------------------------------------------------- */

/* Высоты в клетках — те же, что у печи этажа (scene.js). */
const HEIGHTS = (() => {
  const h = new Map();
  for (const [name, v] of Object.entries({
    WALL: WALL_H, DOOR: WALL_H, WOOD: WALL_H, METAL: WALL_H, FORCE: WALL_H, FORCE_OFF: WALL_H, GLASS: WALL_H,
    CRYSTAL: 1.4, PANEL: 1.25, BARREL: 0.78, BOULDER: 0.7, HAY: 0.62, TABLE: 0.6, DRIFT: 0.45,
  })) if (Number.isInteger(TILE[name])) h.set(TILE[name], v);
  return h;
})();
/* Стены и двери режутся у героя (срез 1), предметы — нет (срез 3, редеют). */
const CUT_TILES = new Set(['WALL', 'DOOR', 'WOOD', 'METAL', 'FORCE', 'FORCE_OFF', 'GLASS']
  .filter((n) => Number.isInteger(TILE[n])).map((n) => TILE[n]));

export function cellHeight(world, tx, ty, cut = null) {
  if (tx < 0 || ty < 0 || tx >= world.w || ty >= world.h) return 0;
  const t = world.tiles[ty * world.w + tx];
  let h = HEIGHTS.get(t) || 0;
  if (h && cut && CUT_TILES.has(t)) h = Math.min(h, cutLimit(cut, tx + 0.5, ty + 0.5));
  return h;
}

/* Кого можно взять указателем: живые и видимые, кроме самого героя. */
function figures(world) {
  const out = [];
  for (const e of world.enemies || []) if (e.alive) out.push(e);
  for (const c of world.civilians || []) if (c.alive) out.push(c);
  if (world.hostage && world.hostage.alive && !world.hostage.rescued) out.push(world.hostage);
  return out;
}

/*
 * spec — кадр камеры (camera.update), cssX/cssY — точка от левого
 * верхнего угла холста. Ответ — точка мира в его точках (x, y как у
 * world.player) и что под указателем: 'figure' | 'cell' | 'ground'.
 * null — луч пола не встретил (такого у изометрии не бывает, но
 * обязанность сказать «не знаю» лучше выдуманной точки).
 */
export function pickWorld(spec, world, cssX, cssY) {
  const ppu = spec.pxPerUnit || 48;
  let best = null;
  for (const f of figures(world)) {
    const h = (f.downed || 0) > 0 ? 0.15 : 0.45;
    const s = worldToScreen(spec, [f.x / T, h, f.y / T]);
    const d = Math.hypot(s.x - cssX, s.y - cssY);
    const r = Math.max(16, 0.42 * ppu);
    if (d <= r && (!best || d < best.d)) best = { d, f };
  }
  if (best) {
    return { x: best.f.x, y: best.f.y, tx: Math.floor(best.f.x / T), ty: Math.floor(best.f.y / T), kind: 'figure', target: best.f };
  }

  const cut = spec.cut && spec.cut.on ? spec.cut : null;
  for (let h = WALL_H + 0.1; h > 0.02; h -= 0.05) {
    const p = screenToGround(spec, cssX, cssY, h);
    if (!p) break;
    if (cellHeight(world, p.tx, p.ty, cut) >= h) {
      return { x: (p.tx + 0.5) * T, y: (p.ty + 0.5) * T, tx: p.tx, ty: p.ty, kind: 'cell' };
    }
  }

  const g = screenToGround(spec, cssX, cssY, 0);
  if (!g) return null;
  return { x: g.x * T, y: g.z * T, tx: g.tx, ty: g.ty, kind: 'ground' };
}

/*
 * Сколько мира видно, в точках мира — для world.viewRadius (стрелки не
 * бьют из-за края кадра, ai.js). Считается по СТАНДАРТНОМУ плану, а не по
 * текущему приближению: иначе приближение меняло бы правила — приблизил
 * камеру, и стрелки замолчали. Круг на полу в изометрии виден эллипсом:
 * по ширине экрана в масштабе 1, по высоте — в sin(наклона), отсюда
 * второй член. Запас 24 точки — тот же, что у плоского вида (main.js).
 */
export function isoViewRadius(cssWidth, cssHeight, pxPerUnit, pitch, focusHeight = 0.55) {
  const halfW = cssWidth / pxPerUnit / 2;
  /* Камера смотрит не в ступни, а на 0,55 клетки выше (camera.js, target):
     ступни на экране ниже середины, и снизу пола видно меньше. Без этой
     поправки на телефоне боком край круга уходил за нижнюю кромку. */
  const below = focusHeight * Math.cos(pitch);
  const halfH = (cssHeight / pxPerUnit / 2 - below) / Math.max(0.2, Math.sin(pitch));
  return Math.min(halfW, halfH) * T - 24;
}
