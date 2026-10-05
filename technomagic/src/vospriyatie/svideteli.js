/*
 * СВИДЕТЕЛИ, ДОНОС, КРАЖА ЯДРА (слой «в», 03.10.2026)
 * =========================================================
 * Слово Сергея: «ты житель… свидетель преступления может донести». И его
 * же решение про ядро: «если на глазах или они обнаружат его пропажу —
 * да; если украл и никто не видит — не надо».
 *
 * ГЛАЗА — МГС. Житель видит теми же глазами, что страж: конус и
 * дальность vision.js (дословно), освещённость — light.js (дословно)
 * через svet.js. Преступление в темноте или за спиной не видно — и не
 * доносится. Отдельных «глаз жителя» нет: два зрения в одной игре
 * разошлись бы, и игрок выучил бы не то.
 *
 * ПРЕСТУПЛЕНИЕ — событие мира с местом (crimeOf ниже):
 *   kill     убил стража или жителя;
 *   assault  вырубил, усыпил, заморозил стража или жителя;
 *   arson    сжёг или разбил чужое: дерево, солому, створку, скамью;
 *   hack     замкнул или взломал щиток, заведённый на тревогу (щиток
 *            учебных ворот к рву не заведён — `alarm: false`);
 *   theft    взял ядро.
 *
 * ДОНОС. Увидевший бежит к ближайшему стражу, до которого можно
 * дойти (поиск в ширину по клеткам, огонь — стена), и, добежав,
 * говорит, где было. Это ПОИСК МГС (alarm.js, disturb): знают, ЧТО
 * случилось и ГДЕ, но не знают, где ты. Кражу на глазах — ТРЕВОГА с
 * местом вора (spotted): вора видели.
 *
 * ПЕРЕХВАТ. Пока бежит — его можно усыпить одиночной стихией (на этаже
 * с дозором житель от неё засыпает, как страж, а не умирает — world.js,
 * hitNeutral), заморозить, сбить. Лежащий не доносит. Огонь на пути —
 * стена для бегущего: пока горит, он ждёт.
 *
 * ПОСЛЕДСТВИЕ — ОДНО И ВИДНОЕ: ОБЫСК. Страж, которому донесли, и
 * ближайший к нему второй уходят с постов на место преступления и
 * прочёсывают его, пока тревога не спадёт из ПОИСКА (20 с МГС), потом
 * возвращаются (ai.js, ветка search). Пост, с которого ушли, на это
 * время открыт — и это тоже последствие, которое игрок видит.
 *
 * ПРОПАЖА ЯДРА. Никто не видел кражи — тревоги нет. Но щитоносец у ядра
 * раз в минуту оглядывается на постамент (lestnica.js, GLANCES; ai.js,
 * ветка idle) — и если постамент пуст и освещён, это находка, как тело
 * в МГС (world.js:431 / guard.js:115 noticeBody): ПОИСК у постамента,
 * обыск там же. Тихий вор, вышедший до оглядки, выходит без тревоги.
 *
 * Всё — только на этаже с дозором (world.trevoga). На старых этажах
 * жителей с полем `witness` нет, и ни одна строка ниже не исполняется.
 */

import { canSee } from '../vendor/stels-ii@1.0.0/vision.js';
import { sightMul } from '../vendor/stels-ii@1.0.0/alarm.js';
import { ALARM } from '../vendor/stels-ii@1.0.0/tuning.js';
import { litAt, seen as litTarget } from './svet.js';
import { noteAlarm, hasSight, TILE_SIZE } from '../world.js';
import { blocksMove, TILE } from '../level.js';
import { GROUND } from '../field.js';

/* Бежит быстрее идущего стража (53) и медленнее игрока (191): догнать и
   перехватить можно, но не стоя на месте. */
export const RUN_SPEED = 100;
/* Добежал — значит в шаге и видит стража. */
export const REPORT_REACH = 40;
/* Чужое: то, что горит или ломается и не стоит в стене. */
const PROPERTY = new Set([TILE.WOOD, TILE.HAY, TILE.DOOR, TILE.TABLE]);
/* Номер вида для счётчика: только числа (правило 30). */
export const CRIME_CODE = { kill: 1, assault: 2, arson: 3, hack: 4, theft: 5 };

const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/* Жители «Башни» становятся свидетелями. Зовётся из createWorld. */
export function initWitnesses(world) {
  if (!world.trevoga) return;
  for (const civ of world.civilians) {
    civ.witness = { state: 'calm', crime: null, target: null, ran: 0, path: null, replan: 0, since: 0 };
  }
}

/* Преступление ли событие мира, и где оно. */
export function crimeOf(world, event) {
  const at = (kind) => (event.x === undefined || event.x === null ? null : { kind, x: event.x, y: event.y });
  switch (event.type) {
    case 'kill': return at('kill');
    case 'neutral-death': return at('kill');
    case 'sleep':
    case 'frozen':
    case 'neutral-knock':
    case 'neutral-sleep': return at('assault');
    case 'altered': return PROPERTY.has(event.tile) ? at('arson') : null;
    case 'panel': {
      const circuit = (world.circuits || []).find((c) => c.id === event.circuit);
      if (circuit && circuit.alarm === false) return null;
      return at('hack');
    }
    case 'core-taken': return { kind: 'theft', x: world.player.x, y: world.player.y };
    default: return null;
  }
}

/*
 * Шаг мира для свидетелей. Зовётся после ИИ стражи, когда события кадра
 * (кража, смерти, поджоги) уже все на месте.
 */
export function updateWitnesses(world, dt) {
  if (!world.trevoga) return;
  const crimes = [];
  for (const event of world.events) {
    const crime = crimeOf(world, event);
    if (crime) crimes.push({ ...crime, t: world.time });
  }

  /* Кражу на глазах у стража — ТРЕВОГА сразу: вора видели, место знают. */
  if (crimes.some((c) => c.kind === 'theft')) theftSeenByGuards(world);

  for (const civ of world.civilians) {
    const w = civ.witness;
    if (!w) continue;
    if (!civ.alive || civ.downed > 0) {
      if (w.state === 'run') {
        w.state = 'stopped';
        world.events.push({ type: 'witness-stopped', x: civ.x, y: civ.y });
      }
      continue;
    }
    if (w.state === 'calm') {
      for (const crime of crimes) {
        const target = { x: crime.x, y: crime.y, lit: litAt(world, crime.x, crime.y) };
        if (!canSee(world, civ, target)) continue;
        w.state = 'run';
        w.crime = crime;
        w.since = world.time;
        world.events.push({ type: 'witness', x: civ.x, y: civ.y, kind: crime.kind });
        break;
      }
    }
    if (w.state === 'run') runToGuard(world, civ, w, dt);
  }

  checkPedestal(world, dt);
}

function theftSeenByGuards(world) {
  const thief = litTarget(world, world.player);
  for (const guard of world.enemies) {
    if (!guard.alive || guard.downed > 0) continue;
    if (!canSee(world, guard, thief, sightMul(world.trevoga))) continue;
    guard.state = 'chase';
    guard.lost = 0;
    world.events.push({ type: 'spot', x: guard.x, y: guard.y, cause: 'theft' });
    noteAlarm(world, 'spot', world.player.x, world.player.y);
    return true;
  }
  return false;
}

/* Можно ли бегущему встать на клетку: держит тело и не горит. */
function passable(world, at) {
  if (blocksMove(world.tiles[at])) return false;
  return world.ground[at] !== GROUND.FIRE;
}

/*
 * Поиск в ширину от клетки жителя: расстояние до каждой клетки. Из него
 * и ближайший страж (по шагам, а не по прямой), и первый шаг к нему.
 */
function distances(world, from) {
  const field = new Int32Array(world.w * world.h).fill(-1);
  const queue = new Int32Array(world.w * world.h);
  let head = 0;
  let tail = 0;
  field[from] = 0;
  queue[tail++] = from;
  while (head < tail) {
    const at = queue[head++];
    const ax = at % world.w;
    const ay = (at / world.w) | 0;
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = ax + dx;
      const ny = ay + dy;
      if (nx < 0 || ny < 0 || nx >= world.w || ny >= world.h) continue;
      const idx = ny * world.w + nx;
      if (field[idx] !== -1 || !passable(world, idx)) continue;
      field[idx] = field[at] + 1;
      queue[tail++] = idx;
    }
  }
  return field;
}

const cellOf = (world, body) => Math.floor(body.y / TILE_SIZE) * world.w + Math.floor(body.x / TILE_SIZE);

/* Ближайший страж, до которого можно дойти: на ногах, не в погоне. */
export function nearestGuard(world, civ) {
  const field = distances(world, cellOf(world, civ));
  let best = null;
  let bestD = Infinity;
  for (const guard of world.enemies) {
    if (!guard.alive || guard.downed > 0) continue;
    const d = field[cellOf(world, guard)];
    if (d < 0 || d >= bestD) continue;
    best = guard;
    bestD = d;
  }
  return best ? { guard: best, steps: bestD } : null;
}

function runToGuard(world, civ, w, dt) {
  w.replan -= dt;
  if (!w.target || !w.target.alive || w.target.downed > 0 || w.replan <= 0) {
    const found = nearestGuard(world, civ);
    w.target = found ? found.guard : null;
    w.replan = 0.4;
  }
  const guard = w.target;
  if (!guard) return;   /* дойти не до кого: огонь, ров, двери — ждёт */

  const gap = Math.hypot(guard.x - civ.x, guard.y - civ.y);
  if (gap <= REPORT_REACH && hasSight(world, civ.x, civ.y, guard.x, guard.y)) {
    report(world, civ, w, guard);
    return;
  }

  /* Шаг к стражу: соседняя клетка, которая к нему ближе. Поиск — от
     стража, чтобы «ближе» значило «по шагам», а не по прямой. */
  const field = distances(world, cellOf(world, guard));
  const here = cellOf(world, civ);
  const hx = here % world.w;
  const hy = (here / world.w) | 0;
  let best = field[here] < 0 ? Infinity : field[here];
  let to = null;
  for (const [dx, dy] of NEIGHBOURS) {
    const nx = hx + dx;
    const ny = hy + dy;
    if (nx < 0 || ny < 0 || nx >= world.w || ny >= world.h) continue;
    const v = field[ny * world.w + nx];
    if (v < 0 || v >= best) continue;
    best = v;
    to = [nx, ny];
  }
  /* Своя клетка уже ближайшая — значит страж рядом: прямо к нему. */
  const tx = to ? (to[0] + 0.5) * TILE_SIZE : guard.x;
  const ty = to ? (to[1] + 0.5) * TILE_SIZE : guard.y;
  const dx = tx - civ.x;
  const dy = ty - civ.y;
  const len = Math.hypot(dx, dy) || 1;
  const step = Math.min(RUN_SPEED * dt, len);
  const nx = civ.x + (dx / len) * step;
  const ny = civ.y + (dy / len) * step;
  if (passable(world, cellOf(world, { x: nx, y: civ.y }))) civ.x = nx;
  if (passable(world, cellOf(world, { x: civ.x, y: ny }))) civ.y = ny;
  civ.vx = (dx / len) * RUN_SPEED;
  civ.vy = (dy / len) * RUN_SPEED;
  civ.angle = Math.atan2(dy, dx);
  w.ran += step;
}

function report(world, civ, w, guard) {
  const crime = w.crime;
  w.state = 'reported';
  civ.vx = 0;
  civ.vy = 0;
  /* Кражу видели — знают вора и место: ТРЕВОГА. Остальное — ПОИСК на
     месте преступления: что и где, но не кто и не куда ушёл. */
  noteAlarm(world, crime.kind === 'theft' ? 'spot' : 'report', crime.x, crime.y);
  world.events.push({
    type: 'report',
    x: crime.x,
    y: crime.y,
    kind: crime.kind,
    seconds: world.time - crime.t,
    cells: w.ran / TILE_SIZE,
  });
  startSearch(world, { x: crime.x, y: crime.y }, guard);
}

/*
 * ОБЫСК: тот, кому донесли (или кто нашёл), и ближайший к нему второй
 * идут на место и прочёсывают его, пока ПОИСК не кончится.
 */
export function startSearch(world, point, first) {
  const guards = world.enemies.filter((g) => g.alive && !(g.downed > 0) && g.state !== 'chase');
  const team = [];
  if (first && guards.includes(first)) team.push(first);
  const rest = guards.filter((g) => g !== first)
    .sort((a, b) => Math.hypot(a.x - (first || a).x, a.y - (first || a).y)
      - Math.hypot(b.x - (first || b).x, b.y - (first || b).y));
  if (rest.length && team.length < 2) team.push(rest[0]);
  for (const g of team) {
    g.state = 'search';
    g.searchPoint = { x: point.x, y: point.y };
    g.searchUntil = world.time + ALARM.searchTime;
    g.heard = null;
  }
  world.events.push({ type: 'search', x: point.x, y: point.y, guards: team.length });
  return team;
}

/*
 * Пустой постамент — как тело МГС: его находят глазами. Обход раз в
 * 0.2 с, как checkBodies у МГС. Нашли один раз — больше не ищут.
 */
function checkPedestal(world, dt) {
  const core = world.core;
  if (!core || !core.taken || world.pedestal) return;
  world.pedestalCheck = (world.pedestalCheck || 0) - dt;
  if (world.pedestalCheck > 0) return;
  world.pedestalCheck = 0.2;
  const spot = { x: core.x, y: core.y, lit: litAt(world, core.x, core.y) };
  for (const guard of world.enemies) {
    if (!guard.alive || guard.downed > 0 || guard.state === 'chase') continue;
    if (!canSee(world, guard, spot, sightMul(world.trevoga))) continue;
    world.pedestal = { at: world.time, by: guard };
    noteAlarm(world, 'pedestal', core.x, core.y);
    world.events.push({ type: 'pedestal-empty', x: core.x, y: core.y });
    startSearch(world, core, guard);
    return;
  }
}

/*
 * Оглядка щитоносца на постамент (ai.js зовёт для поста с `glance`):
 * угол, куда смотреть сейчас, или null — смотреть по посту. Часы этажа,
 * а не случай: человек видит, как конус разворачивается раз в минуту, и
 * может это выучить — стелс и есть выучить и обойти.
 */
export function glanceAngle(world, post) {
  const g = post && post.glance;
  if (!g) return null;
  const t = world.time - g.first;
  if (t < 0) return null;
  return (t % g.every) < g.hold ? g.angle : null;
}

/* Сколько секунд до начала следующей оглядки (для бота и подсказки). */
export function nextGlance(world, post) {
  const g = post && post.glance;
  if (!g) return Infinity;
  const t = world.time - g.first;
  if (t < 0) return -t;
  const phase = t % g.every;
  return phase < g.hold ? 0 : g.every - phase;
}
