/*
 * ВИДИМОСТЬ НА ЭКРАНЕ: свет, взгляд, монета (слои «б» и «в», 03.10.2026)
 * =========================================================
 * Логика света, взгляда и монеты уже есть и проверена в Node
 * (src/vospriyatie/, tests/sloy-b.mjs, tests/sloy-v.mjs). Этот модуль —
 * только перевод того, что она считает, в фигуры для экрана. Им пользуются
 * обе отрисовки: плоская (render.js) и изометрия (view3d/igra.js), — и
 * проверки в Node (tests/vidimost.mjs) зовут те же функции.
 *
 * Главное правило модуля — навык «скрытность» и шапка vision.js МГС:
 * «картинка, которая врёт о правиле, хуже отсутствующей». Поэтому:
 *
 *   ПЯТНО СВЕТА  — ровно та область, которую считает light.js: лучи
 *                  lightShape, укороченные о стены (и о пар — у кэша МГС
 *                  пара нет, поэтому при облаках веер считается заново
 *                  тем же rayReach), яркость по радиусу — та же формула
 *                  contribution: полная до 26 % радиуса, дальше к нулю.
 *   ВЗГЛЯД       — не конус «на всю дальность», а место, где стоящего
 *                  ВИДНО: каждая точка спрашивается у canSee МГС — той
 *                  же функции, которой смотрит ai.js, — с освещённостью
 *                  этой точки (litAt, svet.js). Во тьме конус короткий,
 *                  в пятне лампы длинный, сзади на клетку «чует спиной».
 *                  До 03.10 конус рисовался полной дальностью на свету и
 *                  врал: ночью страж видит на клетку, а не на семь.
 *   МОНЕТА       — точка броска и место падения считаются шагами
 *                  moneta.js (та же скорость, та же дальность, тот же
 *                  упор blocksShot), а не прямой до пальца.
 *
 * Модуль чистый: ни DOM, ни холста. Пишет только свой кэш.
 */

import { canSee, coneShape, sightReach, feelReach, angleDiff } from './vendor/stels-ii@1.0.0/vision.js';
import { sightMul } from './vendor/stels-ii@1.0.0/alarm.js';
import { lightShape, lightOn } from './vendor/stels-ii@1.0.0/light.js';
import { litAt } from './vospriyatie/svet.js';
import { rayReach } from './vendor/stels-ii@1.0.0/level.js';
import { GUARD, LIGHT, COIN, NOISE } from './vendor/stels-ii@1.0.0/tuning.js';
import { blocksShot, TILE_SIZE } from './level.js';


/* =========================================================
   ПРИБОР ВИДИМОСТИ
   ========================================================= */

/*
 * Пороги — МГС (tuning.js, LIGHT.hidden 0.22 и LIGHT.bright 0.6). Вместе
 * со словом — число: на скольких клетках страж, глядящий прямо на тебя,
 * увидит тебя сейчас. Это и есть правило, только сказанное в клетках.
 */
export const LIGHT_WORDS = { ten: 'В ТЕНИ', polumrak: 'ПОЛУМРАК', svet: 'НА СВЕТУ' };

export function lightLevel(world) {
  if (!world || !world.lights) return null;
  const lit = world.player.lit ?? 0;
  const level = lit < LIGHT.hidden ? 'ten' : lit < LIGHT.bright ? 'polumrak' : 'svet';
  const mul = world.trevoga ? sightMul(world.trevoga) : 1;
  const cells = sightReach(lit, mul) / TILE_SIZE;
  return { level, lit, word: LIGHT_WORDS[level], cells: Math.round(cells * 10) / 10 };
}


/* =========================================================
   ПЯТНА СВЕТА
   ========================================================= */

/* Яркость пятна на расстоянии d от источника радиуса r — формула
   contribution из light.js (лампа, не прожектор), без проверки стен:
   стены уже срезали сам многоугольник. */
export function poolLit(d, r) {
  if (d >= r) return 0;
  return Math.min(1, (1 - d / r) * LIGHT.core);
}

/* Доля радиуса, до которой пятно светит в полную силу: (1 − 1/core). */
export const POOL_CORE = 1 - 1 / LIGHT.core;

const freshShapes = new WeakMap();

/*
 * Веер лучей одного источника. Без облаков — кэш МГС (lightShape, он
 * сбрасывается сам, когда лампу гасят или бьют). С облаками кэш МГС
 * солгал бы: пар держит свет (rayBlocked → hasSight → cloudsBlock), а
 * кэш посчитан до пара. Тогда веер считается заново тем же rayReach и
 * держится один кадр мира.
 */
function fan(world, light) {
  if (!world.clouds || !world.clouds.length) return lightShape(world, light);
  const kept = freshShapes.get(light);
  if (kept && kept.time === world.time) return kept.points;
  const points = [];
  const rays = 40;
  for (let i = 0; i < rays; i += 1) {
    const a = (Math.PI * 2 * i) / rays;
    points.push({ a, d: rayReach(world, light.x, light.y, a, light.r) });
  }
  freshShapes.set(light, { time: world.time, points });
  return points;
}

/*
 * Пятна, которые светят сейчас. `near` — точка и радиус, в пределах
 * которых пятна нужны (камера): дальние не считаются вовсе.
 */
export function lightPools(world, near = null) {
  if (!world.lights) return [];
  const out = [];
  for (const light of world.lightSources || world.lights) {
    if (!lightOn(light)) continue;
    if (near && Math.hypot(light.x - near.x, light.y - near.y) > near.r + light.r) continue;
    const kind = light.fire ? 'fire' : light.candle ? 'candle' : 'lamp';
    out.push({ light, kind, x: light.x, y: light.y, r: light.r, rays: fan(world, light) });
  }
  return out;
}


/* =========================================================
   ВЗГЛЯД СТРАЖА
   ========================================================= */

/*
 * Цвет взгляда — настроение стража. До 03.10 у обыска (ai.js, `search`)
 * цвета не было вовсе, и обыскивающий выглядел спокойным.
 *   idle   спокоен, на посту            бледный
 *   alert  идёт на шум, осматривается   жёлтый
 *   search обыск по доносу / пропаже    лиловый
 *   chase  гонится                      красный
 */
export const CONE_TINT = { idle: '255,240,200', alert: '255,214,77', search: '205,120,255', chase: '255,45,90' };
export const coneTint = (state) => CONE_TINT[state] || CONE_TINT.idle;

/* Метка над головой: «?» — ищет (на шум или обыском), «!» — гонится. */
export function guardMark(enemy) {
  if (!enemy.alive || enemy.downed > 0) return null;
  if (enemy.state === 'chase') return '!';
  if (enemy.state === 'alert' || enemy.state === 'search') return '?';
  return null;
}

const regions = new WeakMap();

function lightsKey(world) {
  const list = world.lightSources || world.lights || [];
  let key = `${list.length}:`;
  for (const l of list) key += lightOn(l) ? '1' : '0';
  return key;
}

/* Видно ли стоящего в точке — ровно вопрос ai.js: canSee МГС с
   освещённостью этой точки и поправкой тревоги. */
export function seesPoint(world, enemy, x, y) {
  const mul = world.trevoga ? sightMul(world.trevoga) : 1;
  return canSee(world, enemy, { x, y, lit: litAt(world, x, y) }, mul);
}

/*
 * Где этот страж увидит стоящего. Ответ — куски кольцевых секторов
 * { a0, a1, d0, d1 }: веер по конусу (WEDGES клиньев, шаг STEP по
 * радиусу) плюс кольцо «чует спиной» вокруг. Каждая проба — seesPoint,
 * то есть canSee МГС; кусок закрашен, если видна его середина.
 *
 * `outline` — конус полной дальности (coneShape МГС, укорочен о стены и
 * пар): куда страж смотрит и докуда увидит, если там светло.
 *
 * Кэш — по месту, повороту, тревоге и состоянию света: стоящий на посту
 * страж не пересчитывается вовсе. При облаках — каждый кадр мира.
 */
export const WEDGES = 14;
export const STEP = TILE_SIZE / 4;
const BACK_WEDGES = 12;

export function sightRegion(world, enemy) {
  const mul = world.trevoga ? sightMul(world.trevoga) : 1;
  const key = `${Math.round(enemy.x)},${Math.round(enemy.y)},${Math.round(enemy.angle * 60)},${mul},${lightsKey(world)},`
    + `${world.clouds && world.clouds.length ? world.time : 0}`;
  const kept = regions.get(enemy);
  if (kept && kept.key === key) return kept.region;

  const reach = sightReach(1, mul);
  const spans = [];
  const sweep = (a0, a1, maxD) => {
    const am = (a0 + a1) / 2;
    const c = Math.cos(am);
    const s = Math.sin(am);
    let open = null;
    let last = 0;
    for (let d = STEP / 2; d <= maxD; d += STEP) {
      const on = seesPoint(world, enemy, enemy.x + c * d, enemy.y + s * d);
      if (on) last = d;
      if (on && open === null) open = Math.max(0, d - STEP / 2);
      if (!on && open !== null) { spans.push({ a0, a1, d0: open, d1: d - STEP / 2 }); open = null; }
    }
    if (open !== null) spans.push({ a0, a1, d0: open, d1: Math.min(maxD, last + STEP / 2) });
  };

  /* Конус. */
  const half = GUARD.half;
  for (let i = 0; i < WEDGES; i += 1) {
    const a0 = enemy.angle - half + (2 * half * i) / WEDGES;
    sweep(a0, a0 + (2 * half) / WEDGES, reach);
  }
  /* Спиной — на клетку при свете, вполовину во тьме (feelReach МГС). */
  const back = feelReach(1);
  const rest = Math.PI * 2 - 2 * half;
  for (let i = 0; i < BACK_WEDGES; i += 1) {
    const a0 = enemy.angle + half + (rest * i) / BACK_WEDGES;
    sweep(a0, a0 + rest / BACK_WEDGES, back);
  }

  const outline = coneShape(world, enemy, reach, 14);
  const region = { x: enemy.x, y: enemy.y, angle: enemy.angle, reach, dark: sightReach(0, mul), spans, outline };
  regions.set(enemy, { key, region });
  return region;
}

/* Попадает ли точка в нарисованное (для проверок: картинка ⇔ правило). */
export function regionHas(region, x, y) {
  const d = Math.hypot(x - region.x, y - region.y);
  const a = Math.atan2(y - region.y, x - region.x);
  return region.spans.some((span) => {
    if (d < span.d0 || d > span.d1) return false;
    const mid = (span.a0 + span.a1) / 2;
    return Math.abs(angleDiff(a, mid)) <= (span.a1 - span.a0) / 2;
  });
}


/* =========================================================
   МОНЕТА: КУДА И ГДЕ УПАДЁТ
   ========================================================= */

/*
 * Точка броска. Дальность — МГС (COIN.range, 6.3 клетки): дальше точку
 * подтягивает к игроку по той же прямой, а не отказывает.
 *   point  — мышь, тап или клик по полю (точка мира);
 *   angle  — направление стика или прицела; frac — насколько отклонён
 *            стик (0…1): короткий толчок — бросок под ноги, до упора —
 *            на всю дальность. Меньше четверти дальности не бывает: под
 *            ноги монета падает у самого тела, и звон — на тебе.
 */
export const COIN_RANGE = COIN.range;

export function coinTarget(world, { point = null, angle = null, frac = 1 } = {}) {
  const p = world.player;
  if (point) {
    const dx = point.x - p.x;
    const dy = point.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d <= COIN.range || d < 1) return { x: point.x, y: point.y };
    return { x: p.x + (dx / d) * COIN.range, y: p.y + (dy / d) * COIN.range };
  }
  const a = angle ?? p.angle ?? 0;
  const k = Math.max(0.25, Math.min(1, frac));
  return { x: p.x + Math.cos(a) * COIN.range * k, y: p.y + Math.sin(a) * COIN.range * k };
}

/*
 * Где упадёт — шаги stepCoins (moneta.js) с шагом кадра 1/60: та же
 * скорость, тот же остаток пути, тот же упор (blocksShot) и то же
 * «упала там, где была до упора». Кадр игры гуляет, поэтому настоящая
 * монета ляжет в пределах одного шага (≈5.6 px) от этой точки.
 */
export function coinLanding(world, target, dt = 1 / 60) {
  const p = world.player;
  const dx = target.x - p.x;
  const dy = target.y - p.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1) return { x: p.x, y: p.y, wall: false };
  const vx = (dx / distance) * COIN.speed;
  const vy = (dy / distance) * COIN.speed;
  let left = Math.min(COIN.range, distance);
  let x = p.x;
  let y = p.y;
  for (let i = 0; i < 600; i += 1) {
    const nx = x + vx * dt;
    const ny = y + vy * dt;
    left -= Math.hypot(nx - x, ny - y);
    const tx = Math.floor(nx / TILE_SIZE);
    const ty = Math.floor(ny / TILE_SIZE);
    const wall = tx < 0 || ty < 0 || tx >= world.w || ty >= world.h || blocksShot(world.tiles[ty * world.w + tx]);
    if (wall || left <= 0) return { x, y, wall };
    x = nx;
    y = ny;
  }
  return { x, y, wall: false };
}

/* Звон, который видно: кольцо от места падения до края слышимости за
   RING_TIME секунд. Радиус — шум монеты МГС (NOISE.coin, 5.4 клетки). */
export const RING_TIME = 0.8;
export const COIN_NOISE = NOISE.coin;
