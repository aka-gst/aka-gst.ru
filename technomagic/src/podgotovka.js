/*
 * ТЕХНОМАГИЯ — «БАШНЯ»: стража учится поведением, а не бронёй (05.10.2026)
 * =========================================================
 * Сергей, 05.10, про выучку «свалил своего огнём — через секунду огонь их
 * не берёт»: «как он через секунду не боится огня? Так могут только
 * спец-маги, или если он сбегает за спец-защитой. Проще сделать, чтобы
 * они видели, что творится с их коллегами, и уже тогда понимали, что не
 * надо подходить к огню, или лучше его затушить, если опасности больше
 * нет — и сделать это». Про склад: «сжечь/украсть склад, и подготовка
 * спадает — ваще пиздато, делай». Добавка того же дня: «мокрый плащ
 * действует недолго».
 *
 * Что здесь (мир зовёт stepPodgotovka раз в кадр, ИИ — taskStep):
 *
 *   СТРАХ    enemy.fearOf — Set стихий. Видел, как своего жжёт / бьёт
 *            током в луже (world.js, witnessHurt), или сам упёрся в
 *            пламя по дороге (ai.js) — держится от огня на клетку,
 *            сквозь огонь не гонится (ai.js, hazardIndex). Защиты страх
 *            не даёт: огонь берёт его, как брал.
 *   ТУШИТ    enemy.task = 'tushit'. Видевший, как жгли СВОЕГО (douser),
 *            при тишине (тихо или НАСТОРОЖЕ — после ПОИСКА) и огне в своём
 *            углу идёт к ближайшей воде (бочка, ров), черпает — несёт
 *            (enemy.carry = 'voda') — плещет. Плещет той же водой, что
 *            разливает бочка (world.js, splashWater → таблица встреч
 *            field.js): своего правила тушения нет. Увидел игрока,
 *            услышал шум, тревога — роняет ведро (лужа у ног).
 *   ПЛАЩ     enemy.task = 'za-plashchom'. Видевший горящего своего, если
 *            до склада дойти (SKLAD.reach клеток), идёт туда, роется
 *            секунду, надевает мокрый плащ: enemy.cloak = { wet: 0..1 },
 *            enemy.gear = ['fire'], пока wet > 0 (world.js, resistList;
 *            щиток над головой — zashchity.js). Плащ сохнет за
 *            CLOAK.dry секунд, шаг в огонь выпаривает CLOAK.contact,
 *            секунда в огне — CLOAK.burn. Сухой не держит; у воды
 *            (бочка, ров, лужа, грязь) страж его перемачивает
 *            (enemy.task = 'mochit').
 *   СКЛАД    world.sklad — сундук (TILE.TABLE, деревянный) с плащами.
 *            Сгорел или разбит — плащей нет; игрок постоял у сундука
 *            секунду — унёс. Кто придёт после, вернётся ни с чем (событие
 *            `plashch` what 'net' — тост «ПЛАЩЕЙ НЕТ»).
 *   ПЕРЕХВАТ Поручение за плащом — одно решение на одно увиденное:
 *            сбили с дороги (шум, монета, увидел игрока, лёг) — забыл,
 *            зачем шёл. Новое горе своего — новое решение.
 *
 * Чего здесь НЕТ (решение Сергея — позже, для большой игры между
 * локациями): медленной подготовки всего вида по главному приёму игрока,
 * как в MGS5. Здесь учатся только те, кто видел, и только поведению.
 *
 * Устройство — маленький автомат поручения поверх тревоги МГС (совет
 * Библиотекаря по Робертсу/Шилю и Миллингтону §5.6.4: «тушить, когда
 * угроза ниже порога»), без планировщика.
 */

import { TILE, TILE_SIZE, blocksMove } from './level.js';
import { GROUND } from './field.js';
import { hasSight, tileIndex, splashWater, turnToward } from './world.js';
import { pathStep, hazardIndex } from './ai.js';
import { CALM, CAUTION, ALERT } from './vendor/stels-ii@1.0.0/alarm.js';

/* Мокрый плащ. 20 с — порядок, названный Сергеем через координатора
   («15–25 с»): на одну ходку к огню и бой рядом хватает, на этаж — нет.
   Шаг в пламя (и огненный удар) выпаривает четверть, секунда в пламени —
   ещё четверть: свежий плащ держит четыре касания или около трёх секунд
   в огне (вход + 3 с). Перемачивает, когда влаги меньше трети. */
export const CLOAK = { dry: 20, contact: 0.25, burn: 0.25, rewet: 0.3 };

/* Тушение. «Свой угол» — до 8 клеток от поста или 4 от себя, и огонь
   должен быть виден оттуда, где он стоит. Плещет с 2.6 клетки (держится
   от огня на клетку, ближе не подходит), ведро гасит 3×3. */
export const DOUSE = { area: 8, near: 4, reach: 2.6, splash: 1.5, fill: 0.8, throwTime: 0.4, water: 45 };

/* Склад: «до склада дойти» — не дальше 30 клеток пути; роется секунду;
   украсть — постоять вплотную секунду (центр ближе 1.2 клетки, не бегом). */
export const SKLAD = { reach: 30, take: 1.0, steal: 1.2 };

/* Поломки для проверки (п.6): каждая обязана покраснить свой раздел
   tests/adaptaciya.mjs. */
export const RULES = { douse: true, gear: true, sklad: true, interrupt: true, dry: true };

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/* =========================================================
   СТРАХ
   ========================================================= */

/* Записать страх. `why`: 'kollega' — видел своего, 'ogon' — упёрся в
   пламя сам. Возвращает true, если стихия новая. Волна осторожных
   (world.flowWary) пересчитывается со следующего кадра. */
export function learnFear(world, enemy, element, why, emit = true) {
  if (!world.level || !world.level.adaptive || !element) return false;
  if (!enemy.fearOf) enemy.fearOf = new Set();
  if (!enemy.fearWhy) enemy.fearWhy = {};
  if (why === 'kollega') enemy.fearWhy[element] = 'kollega';
  if (enemy.fearOf.has(element)) return false;
  enemy.fearOf.add(element);
  if (!enemy.fearWhy[element]) enemy.fearWhy[element] = why;
  world.flowTimer = 0;
  if (emit) world.events.push({ type: 'fear', element, learners: 1, why, x: enemy.x, y: enemy.y });
  return true;
}

/* Чьими глазами строить волну осторожных: всё, чего боится хоть один
   живой. null — бояться некому, волна не нужна. */
export function fearProbe(world) {
  let union = null;
  for (const enemy of world.enemies) {
    if (!enemy.alive || !enemy.fearOf || !enemy.fearOf.size) continue;
    if (!union) union = new Set();
    for (const element of enemy.fearOf) union.add(element);
  }
  return union ? { fearOf: union } : null;
}

/* =========================================================
   ПЛАЩ
   ========================================================= */

function setGear(enemy) {
  enemy.gear = (RULES.gear && enemy.cloak && enemy.cloak.wet > 0) ? ['fire'] : null;
}

/* Плащ в воде (лужа, грязь, бочка, ров) — снова мокрый. */
export function wetCloak(world, enemy) {
  if (!enemy.cloak) return;
  const was = enemy.cloak.wet;
  enemy.cloak.wet = 1;
  setGear(enemy);
  if (was < 0.9) world.events.push({ type: 'plashch', what: 'namochil', x: enemy.x, y: enemy.y });
}

/* Касание огня (шаг в пламя, огненный удар по нему). */
export function cloakContact(world, enemy) {
  if (!enemy.cloak) return;
  const was = enemy.cloak.wet;
  enemy.cloak.wet = Math.max(0, was - CLOAK.contact);
  setGear(enemy);
  if (was > 0 && enemy.cloak.wet <= 0) world.events.push({ type: 'plashch', what: 'vysoh', x: enemy.x, y: enemy.y });
}

/* Кадр в пламени или рядом: вход — касание, стоять — сохнет быстрее. */
export function cloakHeat(world, body, onFire, dt) {
  if (!body.cloak) return;
  if (onFire && !body.inFlame) cloakContact(world, body);
  if (onFire && body.cloak.wet > 0) {
    body.cloak.wet = Math.max(0, body.cloak.wet - CLOAK.burn * dt);
    if (body.cloak.wet <= 0) world.events.push({ type: 'plashch', what: 'vysoh', x: body.x, y: body.y });
  }
  body.inFlame = onFire;
  setGear(body);
}

/* =========================================================
   СКЛАД
   ========================================================= */

/* Этаж с полем `sklad`: { chest: [x, y], stand: [x, y], cloaks: n }.
   Сундук — клетка TILE.TABLE (горит и бьётся, как любое дерево), stand —
   клетка пола перед ним, куда страж подходит. */
export function initPodgotovka(world) {
  const spec = world.level && world.level.sklad;
  if (!spec) { world.sklad = null; return; }
  const [cx, cy] = spec.chest;
  const [sx, sy] = spec.stand;
  world.sklad = {
    at: cy * world.w + cx,
    x: (cx + 0.5) * TILE_SIZE,
    y: (cy + 0.5) * TILE_SIZE,
    stand: { x: (sx + 0.5) * TILE_SIZE, y: (sy + 0.5) * TILE_SIZE },
    cloaks: spec.cloaks ?? 3,
    state: 'polon',      /* polon | pust | sgorel | razbit | ukraden */
    taken: 0,
  };
}

function stepSklad(world, dt) {
  const s = world.sklad;
  if (!s || !RULES.sklad) return;
  if (s.cloaks > 0 && world.tiles[s.at] !== TILE.TABLE) {
    const lost = s.cloaks;
    s.cloaks = 0;
    s.state = world.ground[s.at] === GROUND.FIRE ? 'sgorel' : 'razbit';
    world.events.push({ type: 'sklad', what: s.state, lost, x: s.x, y: s.y });
    return;
  }
  /* Кража — постоять у сундука секунду (столько же роется страж), а не
     пройти мимо: бот «боя» без этого уносил плащи на бегу, в драке у
     сторожки, сам того не зная (замер 05.10, 5 прогонов из 5). */
  const p = world.player;
  const close = p && p.alive && Math.hypot(p.x - s.x, p.y - s.y) <= SKLAD.steal * TILE_SIZE
    && Math.hypot(p.vx || 0, p.vy || 0) < 30;
  s.stealT = close && s.cloaks > 0 ? (s.stealT || 0) + dt : 0;
  if (s.cloaks > 0 && s.stealT >= SKLAD.take) {
    const lost = s.cloaks;
    s.cloaks = 0;
    s.state = 'ukraden';
    s.stolen = (s.stolen || 0) + lost;
    world.events.push({ type: 'sklad', what: 'ukraden', lost, x: s.x, y: s.y });
  }
}

/* =========================================================
   ПОИСК КЛЕТОК (глазами этого стража: опасное — стена)
   ========================================================= */

/* Ширина от стража до первой клетки, где test(idx) — да. -1 — нет. */
function nearest(world, enemy, test, limit) {
  const start = tileIndex(world, enemy.x, enemy.y);
  if (start < 0) return -1;
  const dist = new Int16Array(world.w * world.h).fill(-1);
  const queue = new Int32Array(world.w * world.h);
  let head = 0;
  let tail = 0;
  dist[start] = 0;
  queue[tail++] = start;
  while (head < tail) {
    const at = queue[head++];
    if (test(at)) return at;
    if (dist[at] >= limit) continue;
    const ax = at % world.w;
    const ay = (at / world.w) | 0;
    for (const [dx, dy] of N4) {
      const nx = ax + dx;
      const ny = ay + dy;
      if (nx < 0 || ny < 0 || nx >= world.w || ny >= world.h) continue;
      const idx = ny * world.w + nx;
      if (dist[idx] !== -1 || blocksMove(world.tiles[idx]) || hazardIndex(world, enemy, idx)) continue;
      dist[idx] = dist[at] + 1;
      queue[tail++] = idx;
    }
  }
  return -1;
}

const centreOf = (world, idx) => ({ x: ((idx % world.w) + 0.5) * TILE_SIZE, y: (((idx / world.w) | 0) + 0.5) * TILE_SIZE });

/* Клетка у воды: рядом бочка или ров (ручей). */
function byWater(world, idx) {
  const x = idx % world.w;
  const y = (idx / world.w) | 0;
  for (const [dx, dy] of N4) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= world.w || ny >= world.h) continue;
    const tile = world.tiles[ny * world.w + nx];
    if (tile === TILE.BARREL || tile === TILE.DEEP) return true;
  }
  return false;
}

function nearestWater(world, enemy) {
  const idx = nearest(world, enemy, (at) => byWater(world, at), DOUSE.water);
  return idx < 0 ? null : centreOf(world, idx);
}

/* Огонь «в своём углу»: до DOUSE.area клеток от поста или DOUSE.near от
   себя, и виден оттуда, где страж стоит. Ближайший к нему. */
export function fireInArea(world, enemy) {
  const post = enemy.home || enemy;
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < world.ground.length; i += 1) {
    if (world.ground[i] !== GROUND.FIRE) continue;
    const c = centreOf(world, i);
    const fromPost = Math.hypot(c.x - post.x, c.y - post.y) / TILE_SIZE;
    const fromHim = Math.hypot(c.x - enemy.x, c.y - enemy.y) / TILE_SIZE;
    if (fromPost > DOUSE.area && fromHim > DOUSE.near) continue;
    if (fromHim >= bestD) continue;
    if (!hasSight(world, enemy.x, enemy.y, c.x, c.y)) continue;
    best = i;
    bestD = fromHim;
  }
  return best;
}

/* Откуда плеснуть в эту клетку огня: ближайшая безопасная клетка, с
   которой до огня не дальше DOUSE.reach и его видно. */
function throwSpot(world, enemy, fire) {
  const f = centreOf(world, fire);
  const idx = nearest(world, enemy, (at) => {
    const c = centreOf(world, at);
    return Math.hypot(c.x - f.x, c.y - f.y) <= DOUSE.reach * TILE_SIZE && hasSight(world, c.x, c.y, f.x, f.y);
  }, DOUSE.water);
  return idx < 0 ? null : centreOf(world, idx);
}

/* Дойдёт ли страж до точки не длиннее limit клеток (для «до склада дойти»). */
function within(world, enemy, point, limit) {
  const goal = tileIndex(world, point.x, point.y);
  return nearest(world, enemy, (at) => at === goal, limit) >= 0;
}

/* =========================================================
   ПОРУЧЕНИЕ: назначить, вести, сорвать
   ========================================================= */

function start(world, enemy, task, phase, goal) {
  enemy.task = task;
  enemy.taskPhase = phase;
  enemy.taskGoal = goal;
  enemy.taskWait = 0;
  enemy.taskStall = 0;
  world.events.push({ type: 'poruchenie', task, what: 'nachal', x: enemy.x, y: enemy.y });
}

function end(enemy) {
  enemy.task = null;
  enemy.taskPhase = null;
  enemy.taskGoal = null;
  enemy.taskWait = 0;
  enemy.carry = null;
}

/* Сорвать поручение. Ведро — на пол (лужа у ног), за плащом — забыл. */
export function cancelTask(world, enemy, why) {
  if (!enemy.task) return;
  const task = enemy.task;
  if (enemy.carry === 'voda') {
    splashWater(world, enemy.x, enemy.y, TILE_SIZE * 0.6);
    world.events.push({ type: 'tushit', what: 'uronil', x: enemy.x, y: enemy.y });
  }
  if (task === 'za-plashchom') enemy.wantsCloak = false;
  end(enemy);
  world.events.push({ type: 'poruchenie', task, what: 'sorvano', why, x: enemy.x, y: enemy.y });
}

function interrupted(world, enemy) {
  if (!RULES.interrupt) return null;
  if (enemy.state === 'chase') return 'zametil';
  if (enemy.heard) return 'uslyshal';
  if (enemy.state === 'search') return 'obysk';
  const alarm = world.trevoga ? world.trevoga.state : CALM;
  if (alarm === ALERT) return 'trevoga';
  if (enemy.task === 'tushit' && alarm !== CALM && alarm !== CAUTION) return 'trevoga';
  return null;
}

function free(enemy) {
  return enemy.state === 'idle' || (enemy.state === 'alert' && !enemy.heard);
}

function assign(world, enemy) {
  if (!free(enemy) || world.time < (enemy.shockUntil || 0)) return;
  const alarm = world.trevoga ? world.trevoga.state : CALM;
  if (alarm === ALERT) return;

  /* 1. За плащом: видел горящего своего, плаща нет, склад досягаем. */
  if (enemy.wantsCloak && !enemy.cloak) {
    const s = world.sklad;
    if (s && within(world, enemy, s.stand, SKLAD.reach)) start(world, enemy, 'za-plashchom', 'k-skladu', s.stand);
    else enemy.wantsCloak = false;
    return;
  }

  /* 2. Плащ сохнет — к воде, перемочить. */
  if (enemy.cloak && enemy.cloak.wet < CLOAK.rewet && enemy.fearOf && enemy.fearOf.has('fire')) {
    const water = nearestWater(world, enemy);
    if (water) { start(world, enemy, 'mochit', 'k-vode', water); return; }
  }

  /* 3. Тушить: видел, как жгли своего, тихо, огонь в своём углу. */
  if (RULES.douse && enemy.douser && (alarm === CALM || alarm === CAUTION) && fireInArea(world, enemy) >= 0) {
    const water = nearestWater(world, enemy);
    if (water) start(world, enemy, 'tushit', 'k-vode', water);
  }
}

/* Шаг мира: склад, сушка плащей, срыв и выдача поручений. Только «Башня»
   (флаг этажа adaptive). */
export function stepPodgotovka(world, dt) {
  if (!world.level || !world.level.adaptive) return;
  stepSklad(world, dt);
  for (const enemy of world.enemies) {
    if (enemy.cloak) {
      const was = enemy.cloak.wet;
      if (RULES.dry) enemy.cloak.wet = Math.max(0, was - dt / CLOAK.dry);
      if (was > 0 && enemy.cloak.wet <= 0) world.events.push({ type: 'plashch', what: 'vysoh', x: enemy.x, y: enemy.y });
      setGear(enemy);
    }
    if (!enemy.alive || (enemy.downed || 0) > 0) {
      if (enemy.task && (RULES.interrupt || !enemy.alive)) cancelTask(world, enemy, enemy.alive ? 'leg' : 'ubit');
      continue;
    }
    if (enemy.task) {
      const why = interrupted(world, enemy);
      if (why) cancelTask(world, enemy, why);
      continue;
    }
    enemy.taskCheck = (enemy.taskCheck || 0) - dt;
    if (enemy.taskCheck > 0) continue;
    enemy.taskCheck = 0.5;
    if (enemy.wantsCloak || enemy.douser || enemy.cloak) assign(world, enemy);
  }
}

/* Строка над стражем в мире (world.marks — те же всплывающие подписи,
   что «+300 ПО ВОДЕ»): «ПЛАЩЕЙ НЕТ» видно там, где он это понял. */
function say(world, enemy, text) {
  if (world.marks) world.marks.push({ x: enemy.x, y: enemy.y - 18, text, big: false, life: 1.8, max: 1.8 });
}

/* Дошёл до цели поручения. */
function arrive(world, enemy) {
  switch (enemy.taskPhase) {
    case 'k-skladu': enemy.taskPhase = 'roetsya'; enemy.taskWait = SKLAD.take; break;
    case 'k-vode': enemy.taskPhase = 'cherpaet'; enemy.taskWait = DOUSE.fill; break;
    case 'k-ognyu': {
      const fire = nearestFireInReach(world, enemy);
      if (fire >= 0) {
        const f = centreOf(world, fire);
        enemy.angle = Math.atan2(f.y - enemy.y, f.x - enemy.x);
        splashWater(world, f.x, f.y, DOUSE.splash * TILE_SIZE);
        world.events.push({ type: 'tushit', what: 'plesnul', x: f.x, y: f.y });
      }
      enemy.carry = null;
      enemy.taskPhase = 'plesnul';
      enemy.taskWait = DOUSE.throwTime;
      break;
    }
    default: end(enemy);
  }
}

function nearestFireInReach(world, enemy) {
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < world.ground.length; i += 1) {
    if (world.ground[i] !== GROUND.FIRE) continue;
    const c = centreOf(world, i);
    const d = Math.hypot(c.x - enemy.x, c.y - enemy.y);
    if (d > (DOUSE.reach + 0.5) * TILE_SIZE || d >= bestD) continue;
    if (!hasSight(world, enemy.x, enemy.y, c.x, c.y)) continue;
    best = i;
    bestD = d;
  }
  return best;
}

/* Отстоял на месте (роется, черпает, плеснул). */
function afterWait(world, enemy) {
  const phase = enemy.taskPhase;
  if (phase === 'roetsya') {
    const s = world.sklad;
    if (s && s.cloaks > 0) {
      s.cloaks -= 1;
      s.taken += 1;
      if (!s.cloaks) s.state = 'pust';
      enemy.cloak = { wet: 1 };
      setGear(enemy);
      world.events.push({ type: 'plashch', what: 'vzyal', left: s.cloaks, x: enemy.x, y: enemy.y });
      say(world, enemy, 'ВЗЯЛ ПЛАЩ');
    } else {
      world.events.push({ type: 'plashch', what: 'net', why: s ? s.state : 'net-sklada', x: enemy.x, y: enemy.y });
      say(world, enemy, 'ПЛАЩЕЙ НЕТ');
    }
    enemy.wantsCloak = false;
    end(enemy);
    return;
  }
  if (phase === 'cherpaet') {
    if (enemy.cloak) wetCloak(world, enemy);
    if (enemy.task !== 'tushit') { end(enemy); return; }
    enemy.carry = 'voda';
    const fire = fireInArea(world, enemy);
    const spot = fire >= 0 ? throwSpot(world, enemy, fire) : null;
    if (!spot) { end(enemy); return; }
    enemy.taskPhase = 'k-ognyu';
    enemy.taskGoal = spot;
    return;
  }
  if (phase === 'plesnul') {
    /* Ещё горит в своём углу — за следующим ведром. */
    const water = fireInArea(world, enemy) >= 0 ? nearestWater(world, enemy) : null;
    if (!water) { end(enemy); return; }
    enemy.taskPhase = 'k-vode';
    enemy.taskGoal = water;
    return;
  }
  end(enemy);
}

/*
 * Подпись над стражем для экрана (view3d/igra.js): что он сейчас делает
 * по поручению и что с плащом. null — подписывать нечего. Чистая
 * функция: читает только поля стража.
 */
export function taskLabel(enemy) {
  if (!enemy || !enemy.alive || (enemy.downed || 0) > 0) return null;
  if (enemy.task === 'tushit') {
    return enemy.carry === 'voda' ? { text: 'ТУШИТ · ВЕДРО', colour: '#4de1ff' } : { text: 'ТУШИТ · К ВОДЕ', colour: '#9fe8ff' };
  }
  if (enemy.task === 'za-plashchom') return { text: 'ЗА ПЛАЩОМ', colour: '#ffb347' };
  if (enemy.task === 'mochit') return { text: 'МОЧИТ ПЛАЩ', colour: '#9fe8ff' };
  if (enemy.cloak) {
    if (enemy.cloak.wet <= 0) return { text: 'ПЛАЩ СУХОЙ', colour: '#c8b89a' };
    if (enemy.cloak.wet < CLOAK.rewet) return { text: 'ПЛАЩ СОХНЕТ', colour: '#e8d8a8' };
    return { text: 'МОКРЫЙ ПЛАЩ', colour: '#4de1ff' };
  }
  return null;
}

/* Шаг поручения для ИИ (ai.js, thinkEnemy): куда идти. null — поручения
   больше нет, дальше обычная ветка состояния. */
export function taskStep(world, enemy, dt, speed) {
  if (!enemy.task) return null;
  if (enemy.taskWait > 0) {
    enemy.taskWait -= dt;
    if (enemy.taskWait <= 0) afterWait(world, enemy);
    return enemy.task ? { vx: 0, vy: 0 } : null;
  }
  const goal = enemy.taskGoal;
  if (!goal) { end(enemy); return null; }
  /* Сундук сгорел или разбит — видно издалека: рыться незачем,
     разворачивается ни с чем. Украденное видно только вблизи — роется. */
  const s = world.sklad;
  if (RULES.sklad && enemy.task === 'za-plashchom' && s && world.tiles[s.at] !== TILE.TABLE
    && Math.hypot(s.x - enemy.x, s.y - enemy.y) <= 4 * TILE_SIZE && hasSight(world, enemy.x, enemy.y, s.x, s.y)) {
    world.events.push({ type: 'plashch', what: 'net', why: s.state, x: enemy.x, y: enemy.y });
    say(world, enemy, 'ПЛАЩЕЙ НЕТ');
    enemy.wantsCloak = false;
    end(enemy);
    return null;
  }
  const gap = Math.hypot(goal.x - enemy.x, goal.y - enemy.y);
  if (gap > 10) {
    const step = pathStep(world, enemy, goal);
    if (!step) {
      enemy.taskStall = (enemy.taskStall || 0) + dt;
      if (enemy.taskStall > 2) cancelTask(world, enemy, 'net-puti');
      return enemy.task ? { vx: 0, vy: 0 } : null;
    }
    enemy.taskStall = 0;
    enemy.angle = turnToward(enemy.angle, Math.atan2(step.y, step.x), dt * 6);
    return { vx: step.x * speed.walk * 1.25, vy: step.y * speed.walk * 1.25 };
  }
  arrive(world, enemy);
  return enemy.task ? { vx: 0, vy: 0 } : null;
}
