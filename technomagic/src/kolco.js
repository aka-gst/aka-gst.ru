/*
 * КОЛЬЦО ВОЗРОЖДЕНИЯ (05.10.2026)
 * =========================================================
 * Сергей, 05.10: в начале игры кольцо возрождения достаётся «каким-то
 * магическим образом»; что это и почему — длинный квест-загадка (как
 * личинка в Baldur's Gate 3). Умер — откидывает на несколько секунд
 * назад, «сейф от системы». Главное условие: «никогда не сохранять перед
 * таким моментом, что ты 100% умрёшь», точка — только в нормальном месте.
 *
 * КАК. Раз в PERIOD секунд мир предлагает кандидата в точку отката.
 * Кандидат записывается, только если прошёл ОБА сита:
 *   (а) дешёвое — «нормальное место» прямо сейчас (unsafeNow): жив, не
 *       оглушён и не горит, огня рядом нет, лёд рва под ним не тает,
 *       снаряда, летящего в него, ближе THREAT_R нет, взрыва и тока рядом
 *       нет, страж в тревоге/поиске его не видит, урона не было QUIET
 *       секунд, цепная реакция (world.beats) не идёт;
 *   (б) доказательство (п.7и «путь проходим»): из копии мира прогоняем
 *       LOOK секунд вперёд тремя простыми политиками — стоять; отходить
 *       назад по своему следу; бежать от ближайшей угрозы. Точка годится,
 *       только если хотя бы одна выжила.
 * Сита разные нарочно: (а) не видит снаряда издалека и стража, который
 * повернёт через секунду, — их ловит (б); (б) не знает, что «вплотную к
 * стражу в тревоге» — не нормальное место, даже если удрать можно, — это
 * ловит (а). Поломка любого из двух роняет tests/kolco.mjs.
 *
 * ОТКАТ. Смерть → самая свежая точка не моложе MIN_BACK секунд (и не
 * старше KEEP — старые выброшены). Мир восстанавливается целиком: кто
 * умер после точки — снова жив, тревога, журнал, клетки — как были.
 * Нет такой точки — обычная смерть, как раньше.
 *
 * ЧИСЛА (п.7а: у правила есть число):
 *   PERIOD   1 с     — как часто предлагается точка;
 *   QUIET    2 с     — N: без урона (поджог, толчок, купание, удар током)
 *                      и столько же после того, как рядом растаял лёд;
 *   THREAT_R 6 кл.   — R: снаряд/взрыв/ток ближе — не точка;
 *   LOOK     3.5 с   — T: столько обязана прожить хотя бы одна политика;
 *   MIN_BACK 3 с, KEEP 15 с — окно отката «на несколько секунд назад».
 *
 * ЧИСТЫЙ МОДУЛЬ: ни DOM, ни таймеров. Состояние записи живёт снаружи
 * мира (createRing → объект записи), в мире — только world.kolco
 * (нашлось ли, сколько раз вернуло) и он откатом не трогается.
 */

import { update, hasSight, TILE_SIZE, BODY } from './world.js';
import { TILE } from './level.js';
import { GROUND } from './field.js';
import { ALERT, SEARCH } from './vospriyatie/alarm.js';
import { takeRingQuest } from './zhiteli.js';

export const KOLCO = Object.freeze({
  FOUND_AT: 3,                 /* с от начала этажа: кольцо находит героя */
  PERIOD: 1,                   /* с: раз в столько предлагается точка */
  QUIET: 2,                    /* N, с: без урона */
  THREAT_R: 6 * TILE_SIZE,     /* R: снаряд, взрыв, ток */
  FIRE_R: 1.5 * TILE_SIZE,     /* огонь на полу ближе — не точка */
  ICE_FIRE_R: 3 * TILE_SIZE,   /* лёд рва под ногами тает, если огонь ближе */
  GUARD_SIGHT: 12 * TILE_SIZE, /* страж в тревоге видит героя ближе — не точка */
  GUARD_NEAR: 1.5 * TILE_SIZE, /* неспокойный страж вплотную — не точка */
  LOOK: 3.5,                   /* T, с: прогон вперёд */
  /* Шаг прогона — 1/30: мир с переменным шагом даёт тот же исход при 30
     и 60 кадрах (навык progony, «детерминированный сценарий»), а прогон
     вдвое дешевле. Проверка в tests/kolco.mjs идёт своим шагом 1/60. */
  LOOK_DT: 1 / 30,
  /* Сколько шагов прогона за кадр игры: прогон размазан по кадрам, а не
     встаёт столбом раз в секунду (0.15–0.2 мс шаг на компьютере). */
  LOOK_BUDGET: 6,
  MIN_BACK: 3,                 /* откат не ближе, с */
  KEEP: 15,                    /* и не дальше, с */
  TRAIL: 6,                    /* с следа для политики «назад по следу» */
  TRAIL_STEP: 0.25,
  FLASH_FADE: 1.4,             /* вспышка отката гаснет за 1/1.4 с */
});

/* Состояния стражи, в которых он опасен, если видит. */
const HOSTILE = new Set(['chase', 'alert', 'search']);

/* Что считается уроном для QUIET: события мира, задевшие героя. */
function hurtBy(event) {
  if (!event) return false;
  if (event.type === 'ignite' || event.type === 'plunge') return Boolean(event.player);
  return event.type === 'shoved' || event.type === 'shocked-self' || event.type === 'death'
    || event.type === 'backfire';
}


/* =========================================================
   СНИМОК: глубокая копия мира
   =========================================================
   Не structuredClone: уровень (world.level) общий и неизменный, и
   ссылки в него (прямоугольники триггеров, клетка молота) обязаны
   остаться ссылками. Связи внутри мира сохраняются (ядро — и в props,
   и в world.core; цель прицела — тот же объект, что во врагах).
   Функция в мире — громкая ошибка (п.7р): значит, кто-то положил в мир
   замыкание, и снимок его не повторит.
   ========================================================= */

const SKIP = new Set(['level', 'kolco', 'events']);
const levelMemo = new WeakMap();

function sharedOf(level) {
  let memo = levelMemo.get(level);
  if (memo) return memo;
  memo = new Map();
  const walk = (v) => {
    if (v === null || typeof v !== 'object' || memo.has(v)) return;
    memo.set(v, v);
    if (v instanceof Map) for (const [k, x] of v) { walk(k); walk(x); }
    else if (v instanceof Set) for (const x of v) walk(x);
    else if (!ArrayBuffer.isView(v)) for (const k of Object.keys(v)) walk(v[k]);
  };
  walk(level);
  levelMemo.set(level, memo);
  return memo;
}

function copy(value, memo, path) {
  if (typeof value === 'function') throw new Error(`кольцо: функция в мире (${path})`);
  if (value === null || typeof value !== 'object') return value;
  if (memo.has(value)) return memo.get(value);
  let out;
  if (ArrayBuffer.isView(value)) {
    out = value.slice();
    memo.set(value, out);
    return out;
  }
  if (Array.isArray(value)) {
    out = new Array(value.length);
    memo.set(value, out);
    for (let i = 0; i < value.length; i += 1) out[i] = copy(value[i], memo, path);
    return out;
  }
  if (value instanceof Map) {
    out = new Map();
    memo.set(value, out);
    for (const [k, v] of value) out.set(copy(k, memo, path), copy(v, memo, path));
    return out;
  }
  if (value instanceof Set) {
    out = new Set();
    memo.set(value, out);
    for (const v of value) out.add(copy(v, memo, path));
    return out;
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    throw new Error(`кольцо: не простой объект в мире (${path})`);
  }
  out = {};
  memo.set(value, out);
  for (const key of Object.keys(value)) out[key] = copy(value[key], memo, `${path}.${key}`);
  return out;
}

/* Снимок мира. Цепная реакция в полёте (world.beats — замыкания) —
   снимка нет: точку посреди неё не пишут (unsafeNow тоже это знает). */
export function snapshot(world) {
  if (world.beats && world.beats.length) return null;
  const memo = new Map(sharedOf(world.level));
  const state = {};
  for (const key of Object.keys(world)) {
    if (SKIP.has(key)) continue;
    state[key] = copy(world[key], memo, `world.${key}`);
  }
  state.beats = [];
  return state;
}

/* Мир из снимка — новым объектом (для прогона вперёд и проверок). */
export function worldFrom(state, level) {
  const memo = new Map(sharedOf(level));
  const world = copy(state, memo, 'snap');
  world.level = level;
  world.events = [];
  world.beats = [];
  return world;
}

/* Мир из снимка — в ТОТ ЖЕ объект: на него держат ссылки main.js,
   отрисовка и пульт. world.kolco и уровень остаются как были. */
export function restoreInto(world, state) {
  const fresh = worldFrom(state, world.level);
  for (const key of Object.keys(world)) {
    if (key === 'level' || key === 'kolco') continue;
    if (!(key in fresh)) delete world[key];
  }
  for (const key of Object.keys(fresh)) {
    if (key === 'level') continue;
    world[key] = fresh[key];
  }
  world.events = [];
  world.beats = [];
  return world;
}

/*
 * Первое расхождение двух миров (путь) или null. Для проверок: «мир после
 * отката равен снимку», «прогон из копии повторяет прогон оригинала».
 */
export function firstDiff(a, b, path = 'world', seen = new Map()) {
  if (Object.is(a, b)) return null;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') {
    return `${path}: ${String(a).slice(0, 40)} ≠ ${String(b).slice(0, 40)}`;
  }
  if (seen.get(a) === b) return null;
  seen.set(a, b);
  if (ArrayBuffer.isView(a)) {
    if (!ArrayBuffer.isView(b) || a.length !== b.length) return `${path}: длина`;
    for (let i = 0; i < a.length; i += 1) if (!Object.is(a[i], b[i])) return `${path}[${i}]: ${a[i]} ≠ ${b[i]}`;
    return null;
  }
  if (a instanceof Map || a instanceof Set) {
    const ea = [...a.entries()];
    const eb = [...b.entries()];
    if (ea.length !== eb.length) return `${path}: размер ${ea.length} ≠ ${eb.length}`;
    return firstDiff(ea, eb, path, seen);
  }
  const ka = Object.keys(a).filter((k) => !(path === 'world' && SKIP.has(k)));
  const kb = Object.keys(b).filter((k) => !(path === 'world' && SKIP.has(k)));
  const keys = new Set([...ka, ...kb]);
  for (const key of keys) {
    const d = firstDiff(a[key], b[key], `${path}.${key}`, seen);
    if (d) return d;
  }
  return null;
}


/* =========================================================
   (а) НОРМАЛЬНОЕ ЛИ МЕСТО — СЕЙЧАС
   ========================================================= */

function fireNear(world, x, y, radius) {
  const cx = Math.floor(x / TILE_SIZE);
  const cy = Math.floor(y / TILE_SIZE);
  const span = Math.ceil(radius / TILE_SIZE) + 1;
  for (let dy = -span; dy <= span; dy += 1) {
    for (let dx = -span; dx <= span; dx += 1) {
      const tx = cx + dx;
      const ty = cy + dy;
      if (tx < 0 || ty < 0 || tx >= world.w || ty >= world.h) continue;
      const at = ty * world.w + tx;
      if (world.ground[at] !== GROUND.FIRE) continue;
      const near = Math.hypot((tx + 0.5) * TILE_SIZE - x, (ty + 0.5) * TILE_SIZE - y);
      if (near <= radius + TILE_SIZE * 0.5) return true;
    }
  }
  return false;
}

/* Снаряд идёт в героя: ближе R и проходит мимо него ближе трёх тел. */
function boltAt(world, bullet, player) {
  if (bullet.life <= 0) return false;
  const dx = player.x - bullet.x;
  const dy = player.y - bullet.y;
  const dist = Math.hypot(dx, dy);
  if (dist > KOLCO.THREAT_R) return false;
  if (dist < BODY * 3) return true;
  const speed = Math.hypot(bullet.vx || 0, bullet.vy || 0);
  if (speed < 1) return false;
  const along = (dx * bullet.vx + dy * bullet.vy) / speed;
  if (along <= 0) return false;
  const miss = Math.abs(dx * bullet.vy - dy * bullet.vx) / speed;
  return miss < BODY * 3;
}

/*
 * Причина, по которой здесь НЕ место для точки, или null. Дёшево: один
 * проход по врагам и снарядам, окрестность 5×5 клеток.
 */
export function unsafeNow(world, ring = null) {
  const player = world.player;
  if (!player || !player.alive || world.state !== 'play') return 'mertv';
  if ((player.stun || 0) > 0 || (player.zap || 0) > 0) return 'oglushen';
  if ((player.burning || 0) > 0) return 'gorit';
  if ((player.windup || 0) > 0 || player.pending) return 'koldovstvo';
  if (ring && world.clock - ring.lastHurt < KOLCO.QUIET) return 'uron';
  if (world.beats && world.beats.length) return 'cep';

  /* Лёд рва под ногами тает: рядом только что растаял лёд (событие
     `moat` thaw), огонь ближе ICE_FIRE_R или своё огненное в полёте. */
  const at = Math.floor(player.y / TILE_SIZE) * world.w + Math.floor(player.x / TILE_SIZE);
  if (world.tiles[at] === TILE.FROZEN) {
    const flying = world.bullets.some((b) => b.life > 0 && b.from === 'player'
      && b.elements && b.elements.includes('fire'));
    const thawed = ring && world.clock - ring.lastThaw < KOLCO.QUIET;
    if (thawed || flying || fireNear(world, player.x, player.y, KOLCO.ICE_FIRE_R)) return 'lyod';
  }
  if (fireNear(world, player.x, player.y, KOLCO.FIRE_R)) return 'ogon';

  for (const bullet of world.bullets) {
    if (bullet.from === 'player') continue;
    if (boltAt(world, bullet, player)) return 'snaryad';
  }
  for (const blast of world.blasts) {
    if ((blast.life || 0) <= 0) continue;
    const reach = (blast.radius || blast.reach || 0) + KOLCO.THREAT_R;
    if (Math.hypot(blast.x - player.x, blast.y - player.y) <= reach) return 'vzryv';
  }
  for (const live of [world.charged, world.residual]) {
    if (live && Math.hypot(live.x - player.x, live.y - player.y) <= KOLCO.THREAT_R) return 'tok';
  }

  const loud = world.trevoga && (world.trevoga.state === ALERT || world.trevoga.state === SEARCH);
  for (const enemy of world.enemies) {
    if (!enemy.alive || (enemy.downed || 0) > 0) continue;
    const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    const hostile = HOSTILE.has(enemy.state) || (loud && enemy.state !== 'idle');
    if (hostile && dist <= KOLCO.GUARD_NEAR) return 'strazh-vplotnuyu';
    if ((hostile || loud) && dist <= KOLCO.GUARD_SIGHT
        && hasSight(world, enemy.x, enemy.y, player.x, player.y)) return 'strazh-vidit';
  }
  return null;
}


/* =========================================================
   (б) ДОКАЗАТЕЛЬСТВО: ПРОГОН ВПЕРЁД
   ========================================================= */

const IDLE = Object.freeze({ moveX: 0, moveY: 0, aimAngle: null, attack: false, charge: null });

/* Свой сид на прогон: ход живой игры (её Math.random) не трогается. */
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function toward(player, x, y) {
  const dx = x - player.x;
  const dy = y - player.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return IDLE;
  return { ...IDLE, moveX: dx / len, moveY: dy / len };
}

/* Политики: функция (мир) → намерение. Одна копия — одна политика. */
export const POLICIES = {
  /* Стоять. */
  stand: () => () => IDLE,
  /* Назад по своему следу: от свежих точек к старым. */
  retreat: (trail) => {
    const points = [...(trail || [])].reverse();
    let i = 0;
    return (world) => {
      const p = world.player;
      while (i < points.length && Math.hypot(points[i].x - p.x, points[i].y - p.y) < 10) i += 1;
      if (i >= points.length) return IDLE;
      return toward(p, points[i].x, points[i].y);
    };
  },
  /* От ближайшей угрозы: неспокойный страж, чужой снаряд, огонь. */
  flee: () => (world) => {
    const p = world.player;
    let best = null;
    let bestD = Infinity;
    const consider = (x, y) => {
      const d = Math.hypot(x - p.x, y - p.y);
      if (d < bestD) { bestD = d; best = { x, y }; }
    };
    for (const e of world.enemies) {
      if (e.alive && (e.downed || 0) <= 0 && e.state !== 'idle') consider(e.x, e.y);
    }
    for (const b of world.bullets) if (b.life > 0 && b.from !== 'player') consider(b.x, b.y);
    if (!best) return IDLE;
    return toward(p, p.x * 2 - best.x, p.y * 2 - best.y);
  },
};


/* Политика по имени — для прогона по шагам и для проверок. */
export function makePolicy(name, trail) {
  return POLICIES[name](trail);
}
export const POLICY_ORDER = Object.freeze(Object.keys(POLICIES));

/*
 * Один прогон политики, по шагам: можно гнать целиком (run(Infinity)) или
 * понемногу за кадр (ringTick). Свой сид: ход живой игры не трогается.
 * Итог: null — ещё идёт, true — прожил LOOK, false — погиб. Выход с
 * этажа — тоже жив; горящий в конце — не жив (через 0.7 с умрёт).
 */
export function createRun(state, level, policyName, trail, seed, seconds = KOLCO.LOOK, dt = KOLCO.LOOK_DT) {
  return {
    world: worldFrom(state, level),
    policy: makePolicy(policyName, trail),
    name: policyName,
    rand: seeded(seed),
    frames: Math.ceil(seconds / dt),
    dt,
    frame: 0,
    result: null,
  };
}

export function stepRun(run, budget) {
  if (run.result !== null) return 0;
  const saved = Math.random;
  Math.random = run.rand;
  let done = 0;
  try {
    while (done < budget && run.frame < run.frames) {
      update(run.world, run.dt, run.policy(run.world));
      run.frame += 1;
      done += 1;
      if (!run.world.player.alive || run.world.state === 'dead') { run.result = false; return done; }
      if (run.world.state === 'clear') { run.result = true; return done; }
    }
  } finally {
    Math.random = saved;
  }
  if (run.frame >= run.frames) {
    run.result = run.world.player.alive && !((run.world.player.burning || 0) > 0);
  }
  return done;
}

/* Прожил ли герой seconds секунд из снимка под политикой (целиком, сразу). */
export function survives(state, level, policyName, trail, seconds = KOLCO.LOOK, seed = 1, dt = KOLCO.LOOK_DT) {
  const run = createRun(state, level, policyName, trail, seed, seconds, dt);
  stepRun(run, Infinity);
  return run.result;
}


/* =========================================================
   ЗАПИСЬ И ОТКАТ
   ========================================================= */

/*
 * Кольцо этажа. Только там, где этаж его даёт (`level.kolco`, «Башня»);
 * на остальных — null, и всё идёт по-старому.
 */
export function createRing(world) {
  if (!world || !world.level || !world.level.kolco) return null;
  world.kolco = { found: false, rewinds: 0, back: 0, ready: false };
  return {
    points: [],          /* записанные точки, от старых к свежим */
    pending: null,       /* кандидат, чей прогон вперёд ещё идёт */
    trail: [],
    trailAt: -Infinity,
    nextAt: 0,
    lastHurt: -Infinity,
    lastThaw: -Infinity,
    offered: 0,
    recorded: 0,
    rejected: {},
    lookMs: [],          /* мс прогона на кандидата (сумма по кадрам) */
    sliceMs: 0,          /* самый дорогой кадр прогона */
    slices: [],          /* мс прогона по кадрам (последние 2000) */
    /* Для отрицательных контролей (tests/kolco.mjs): выключить сито. */
    check: { predicate: true, lookahead: true },
  };
}

const now = () => (globalThis.performance || Date).now();

function reject(ring, why) {
  ring.rejected[why] = (ring.rejected[why] || 0) + 1;
  return { ok: false, why };
}

function record(ring, cand, clock, policy) {
  ring.points.push({
    clock: cand.clock, time: cand.time, state: cand.state, trail: cand.trail,
    lastHurt: cand.lastHurt, lastThaw: cand.lastThaw, policy,
  });
  ring.recorded += 1;
  ring.points = ring.points.filter((p) => clock - p.clock <= KOLCO.KEEP);
  return { ok: true, why: null, policy };
}

/*
 * Предложить нынешний мир в точку. Сито (а) — сразу; сито (б) — прогон,
 * который дальше идёт по кадрам (advance). Возвращает { ok, why }:
 * ok === null — прогон начат, итог позже.
 */
export function offer(ring, world) {
  ring.offered += 1;
  if (ring.check.predicate) {
    const why = unsafeNow(world, ring);
    if (why) return reject(ring, why);
  } else if (!world.player.alive || world.state !== 'play') {
    return reject(ring, 'mertv');
  }
  let state;
  try {
    state = snapshot(world);
  } catch (error) {
    console.warn(String(error && error.message || error));
    return reject(ring, 'kopiya');
  }
  if (!state) return reject(ring, 'cep');
  const cand = {
    clock: world.clock,
    time: world.time,
    state,
    trail: ring.trail.map((p) => ({ x: p.x, y: p.y })),
    lastHurt: ring.lastHurt,
    lastThaw: ring.lastThaw,
    seed: 0x5eed ^ Math.round(world.clock * 1000),
    next: 0,
    run: null,
    ms: 0,
  };
  if (!ring.check.lookahead) return record(ring, cand, world.clock, 'bez-progona');
  ring.pending = cand;
  return { ok: null, why: null };
}

/*
 * Двинуть прогон кандидата на budget шагов. Политики по очереди: первая
 * выжившая — точка записана; все погибли — отказ «progon».
 */
export function advance(ring, level, clock, budget = KOLCO.LOOK_BUDGET) {
  const cand = ring.pending;
  if (!cand) return null;
  const t0 = now();
  let left = budget;
  let verdict = null;
  while (left > 0 && verdict === null) {
    if (!cand.run) {
      cand.run = createRun(cand.state, level, POLICY_ORDER[cand.next], cand.trail, cand.seed + cand.next);
    }
    left -= Math.max(1, stepRun(cand.run, left));
    if (cand.run.result === true) {
      verdict = record(ring, cand, clock, cand.run.name);
    } else if (cand.run.result === false) {
      cand.next += 1;
      cand.run = null;
      if (cand.next >= POLICY_ORDER.length) verdict = reject(ring, 'progon');
    }
  }
  const spent = now() - t0;
  cand.ms += spent;
  ring.sliceMs = Math.max(ring.sliceMs, spent);
  ring.slices.push(spent);
  if (ring.slices.length > 2000) ring.slices.shift();
  if (verdict) {
    ring.pending = null;
    ring.lookMs.push(cand.ms);
    if (ring.lookMs.length > 400) ring.lookMs.shift();
  }
  return verdict;
}

/* Предложить и досчитать сразу — для проверок и ручных кандидатов. */
export function judge(ring, world) {
  const first = offer(ring, world);
  if (first.ok !== null) return first;
  return advance(ring, world.level, world.clock, Infinity);
}

/* Самая свежая точка не моложе MIN_BACK — или null. */
export function pickPoint(ring, clock) {
  for (let i = ring.points.length - 1; i >= 0; i -= 1) {
    const point = ring.points[i];
    if (clock - point.clock >= KOLCO.MIN_BACK) return point;
  }
  return null;
}

/*
 * Шаг кольца — после update() мира, до разбора событий: события, которые
 * кладёт кольцо (нашлось, задание взято), разбирает тот же drainEvents.
 */
export function ringTick(ring, world, dt) {
  if (!ring || !world.kolco) return;
  for (const event of world.events) {
    if (hurtBy(event)) ring.lastHurt = world.clock;
    if (event.type === 'moat' && event.kind === 'thaw') ring.lastThaw = world.clock;
  }
  if (world.fx && world.fx.ring > 0) world.fx.ring = Math.max(0, world.fx.ring - dt * KOLCO.FLASH_FADE);

  if (!world.kolco.found && world.clock >= KOLCO.FOUND_AT && world.player.alive) {
    world.kolco.found = true;
    world.events.push({ type: 'ring-found' });
    takeRingQuest(world);
    ring.nextAt = world.clock;
  }
  if (!world.kolco.found) return;

  if (world.player.alive && world.clock - ring.trailAt >= KOLCO.TRAIL_STEP) {
    ring.trailAt = world.clock;
    ring.trail.push({ x: world.player.x, y: world.player.y, t: world.clock });
    while (ring.trail.length && world.clock - ring.trail[0].t > KOLCO.TRAIL) ring.trail.shift();
  }

  if (ring.pending) {
    advance(ring, world.level, world.clock);
  } else if (world.clock >= ring.nextAt && world.state === 'play') {
    ring.nextAt = world.clock + KOLCO.PERIOD;
    offer(ring, world);
  }
  world.kolco.ready = Boolean(pickPoint(ring, world.clock));
}

/*
 * Откат после смерти. Есть точка — мир возвращается в неё целиком,
 * вспышка, событие `ring-rewind` (счётчик — lestnica.js, ladderPulses).
 * Нет — null, и вызывающий показывает обычную смерть.
 */
export function ringRewind(ring, world) {
  if (!ring || !world.kolco || !world.kolco.found) return null;
  const clock = world.clock;
  const point = pickPoint(ring, clock);
  if (!point) return null;
  restoreInto(world, point.state);
  ring.points = ring.points.filter((p) => p.clock <= point.clock);
  ring.pending = null;
  ring.trail = point.trail.map((p) => ({ ...p, t: point.clock }));
  ring.trailAt = point.clock;
  ring.lastHurt = point.lastHurt;
  ring.lastThaw = point.lastThaw;
  ring.nextAt = point.clock + KOLCO.PERIOD;
  const back = clock - point.clock;
  world.kolco.rewinds += 1;
  world.kolco.back = back;
  /* Куда вернуло — для пульта и проверок (main.js, technomagic.state). */
  world.kolco.at = { x: Math.round(world.player.x), y: Math.round(world.player.y), clock: point.clock };
  world.kolco.ready = Boolean(pickPoint(ring, world.clock));
  world.fx.ring = 1;
  world.events.push({ type: 'ring-rewind', n: world.kolco.rewinds, back: Math.round(back) });
  return { back, point };
}

/*
 * Шаг мира с кольцом — для прогонов в Node: update, кольцо, и при смерти
 * сразу откат (в игре между смертью и откатом 0.32 с показа — main.js).
 * Возвращает итог отката, если он случился в этом шаге.
 */
export function stepWithRing(ring, world, dt, intent) {
  update(world, dt, intent);
  ringTick(ring, world, dt);
  if (world.state === 'dead' && ring) return ringRewind(ring, world);
  return null;
}
