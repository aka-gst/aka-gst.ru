/*
 * СВЕТ В НАШЕМ МИРЕ: откуда берутся источники и что с ними делают стихии
 * =========================================================
 * Сама модель света — МГС дословно (./light.js): освещённость — МАКСИМУМ
 * по источникам, а не сумма; стены свет держат; ночь — `ambient` этажа.
 * Здесь только то, чего в МГС нет и быть не могло, — наш мир:
 *
 *   ЛАМПЫ    стенные фонари этажа (level.lamps, «Башня» — src/lestnica.js).
 *            Каждая — createLight МГС, поставленная в клетку пола у стены
 *            и сдвинутая к стене на 11 px: свет рождается в комнате, а не
 *            в камне (иначе первый же шаг луча упёрся бы в свою стену).
 *   ОГОНЬ    каждая горящая клетка пола (GROUND.FIRE) — сама источник.
 *            Подожжённый амбар освещает двор, залитый — гаснет: вода и
 *            огонь не знают о свете ни строки, свет читает пол.
 *   СВЕЧА    зажжённая свеча (prop 'candle', lit) — маленький источник.
 *
 * Кристаллы и щитки источниками не сделаны: в нашем мире они не светятся
 * постоянно (кристалл — вспышка разряда, щиток — искры), и вечный свет
 * от них был бы новым правилом, которого игрок нигде не видел.
 *
 * СТИХИИ ПРОТИВ ЛАМПЫ — через ту же дверь, что свеча (world.js, land):
 * вещество, легшее на клетку лампы, решает по своим чертам, а не по
 * списку заклинаний:
 *
 *   shock (молния и всё с ней)   РАЗБИТА насовсем (breakLight МГС) — и
 *                                громко: звон стекла 300 px, как витрина;
 *   douse/wet/steam/freeze       ПОГАШЕНА, пока не зажгут (douseLight МГС
 *                                со сроком «навсегда»: у МГС гасит
 *                                рубильник на 9 с, у нас вода — до огня);
 *   burn                         ЗАЖЖЕНА снова, если не разбита.
 *
 * Молния проверяется первой: ПРОБОЙ ⇧↑⇧ несёт и воду, и разряд — лампу он
 * бьёт, а не тушит. Тихо погасить — водой; темно и громко — молнией.
 *
 * Этаж без ламп (всё, кроме «Башни») света не получает вовсе: у игрока
 * нет поля `lit`, vision.js считает его освещённым целиком, и восемь
 * этажей кампании видят как видели.
 */

import { createLight, updateLights, illumination, breakLight, douseLight, lightOn } from '../vendor/stels-ii@1.0.0/light.js';
import { LIGHT } from '../vendor/stels-ii@1.0.0/tuning.js';
import { TILE_SIZE } from '../level.js';
import { GROUND } from '../field.js';

const SCALE = 32 / 24;

/* Горящая клетка светит как средний фонарь МГС (88–98 px ×4/3), свеча —
   вдвое меньше. Числа на глаз МГС, не замер: поправлять здесь. */
export const FIRE_LIGHT = 92 * SCALE;
export const CANDLE_LIGHT = 48 * SCALE;
/* Лампа без своего радиуса — как фонари склада МГС (108 px ×4/3). */
export const LAMP_LIGHT = 108 * SCALE;
/* Насколько лампа сдвинута к своей стене от середины клетки. */
const MOUNT = 11;
/* Звон разбитой лампы — тот же, что у разбитой витрины (world.js, glass). */
export const GLASS_NOISE = 300;

const WALL_SHIFT = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] };

export function hasLighting(world) {
  return Boolean(world.lights);
}

/*
 * Свет этажа. Зовётся из createWorld, только если этаж назвал свои лампы
 * (даже пустым списком): так «ночь» — решение этажа, а не умолчание.
 */
export function createLighting(world, level) {
  world.ambient = level.ambient ?? LIGHT.ambient;
  world.lights = (level.lamps || []).map((spec, i) => {
    const [cx, cy] = spec.at;
    const [sx, sy] = WALL_SHIFT[spec.wall] || [0, 0];
    const lamp = createLight({
      x: (cx + 0.5) * TILE_SIZE + sx * MOUNT,
      y: (cy + 0.5) * TILE_SIZE + sy * MOUNT,
      r: spec.r ?? LAMP_LIGHT,
    });
    lamp.id = spec.id || `lamp-${i}`;
    lamp.cell = cy * world.w + cx;
    lamp.wall = spec.wall || null;
    return lamp;
  });
  world.fireLights = new Map();
  world.lightSources = world.lights.slice();
}

/*
 * Источники этого кадра: лампы, горящие клетки, зажжённые свечи. Огонь
 * берётся у пола каждый кадр (64×48 клеток — три тысячи сравнений), а
 * объекты света для клеток кэшируются: клетка не двигается.
 */
export function updateLighting(world, dt) {
  if (!world.lights) return;
  updateLights(world.lights, dt);
  const sources = world.lights.slice();
  const seen = new Set();
  for (let i = 0; i < world.ground.length; i += 1) {
    if (world.ground[i] !== GROUND.FIRE) continue;
    seen.add(i);
    let light = world.fireLights.get(i);
    if (!light) {
      light = createLight({
        x: ((i % world.w) + 0.5) * TILE_SIZE,
        y: (Math.floor(i / world.w) + 0.5) * TILE_SIZE,
        r: FIRE_LIGHT,
      });
      light.fire = true;
      world.fireLights.set(i, light);
    }
    sources.push(light);
  }
  for (const key of world.fireLights.keys()) if (!seen.has(key)) world.fireLights.delete(key);
  for (const prop of world.props) {
    if (prop.kind !== 'candle' || !prop.lit) continue;
    if (!prop.light) {
      prop.light = createLight({ x: prop.x, y: prop.y, r: CANDLE_LIGHT });
      prop.light.candle = true;
    }
    sources.push(prop.light);
  }
  world.lightSources = sources;
  world.player.lit = illumination(world, sources, world.player.x, world.player.y);
}

/* Освещённость точки: 1 на этаже без света (как было), иначе — МГС. */
export function litAt(world, x, y) {
  if (!world.lights) return 1;
  return illumination(world, world.lightSources || world.lights, x, y);
}

/*
 * Цель для canSee: точка с её освещённостью. На этаже без света поле
 * `lit` не ставится вовсе — vision.js сам считает такую цель видимой
 * целиком, и старые этажи не меняются ни на бит.
 */
export function seen(world, body) {
  if (!world.lights) return body;
  return { x: body.x, y: body.y, lit: litAt(world, body.x, body.y) };
}

/*
 * Вещество легло на клетки (world.js, land) — что стало с лампами на них.
 * `touched` — множество индексов клеток. Возвращает список событий
 * `lamp`, уже положенных в world.events; шум разбитой лампы поднимает
 * сам мир (emitNoise передаётся снаружи: свет о слухе не знает).
 */
export function lampsTouched(world, touched, substance, emitNoise) {
  if (!world.lights || !substance) return;
  for (const lamp of world.lights) {
    if (!touched.has(lamp.cell) || lamp.broken) continue;
    applyToLamp(world, lamp, substance.traits || {}, emitNoise);
  }
}

/*
 * Снаряд в полёте задел лампу (МГС, stepBullets: пуля ближе 10 px к
 * фонарю — фонарь разбит, пуля встала). У нас 10 ×4/3, и решает
 * вещество, а не «пуля»: вода гасит, огонь зажигает, молния бьёт.
 * Возвращает true — снаряд остановился о лампу.
 */
export const LAMP_HIT = 10 * SCALE;
export function lampHit(world, bullet, emitNoise) {
  if (!world.lights || !bullet.substance) return false;
  for (const lamp of world.lights) {
    if (lamp.broken) continue;
    if (Math.hypot(lamp.x - bullet.x, lamp.y - bullet.y) > LAMP_HIT) continue;
    applyToLamp(world, lamp, bullet.substance.traits || {}, emitNoise);
    return true;
  }
  return false;
}

function applyToLamp(world, lamp, t, emitNoise) {
  if (t.shock) {
    breakLight(lamp);
    world.events.push({ type: 'lamp', how: 'broken', id: lamp.id, x: lamp.x, y: lamp.y });
    emitNoise(world, lamp.x, lamp.y, GLASS_NOISE, 'glass');
    return;
  }
  if ((t.douse || t.wet || t.steam || t.freeze) && lightOn(lamp)) {
    douseLight(lamp, Number.POSITIVE_INFINITY);
    world.events.push({ type: 'lamp', how: 'doused', id: lamp.id, x: lamp.x, y: lamp.y });
    return;
  }
  if (t.burn && !lightOn(lamp)) {
    lamp.out = 0;
    lamp.shape = null;
    world.events.push({ type: 'lamp', how: 'lit', id: lamp.id, x: lamp.x, y: lamp.y });
  }
}

export { lightOn };
