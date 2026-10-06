/*
 * ТЕХНОМАГИЯ — что делают враги.
 *
 * Противник ничего не знает о мире напрямую: он видит конусом, слышит
 * точкой шума и ходит по волне, построенной от игрока. Никакого «врагу
 * всегда известно, где вы» — иначе исчезает единственная тактика,
 * которая тут есть: обойти и ударить первым.
 *
 * Состояния:
 *   idle   стоит на месте, лениво водит взглядом
 *   alert  идёт смотреть, откуда шумнуло
 *   chase  видит игрока и идёт убивать
 *   down   лежит после удара кулаком или брошенной битой
 *
 * До первой смерти этаж спит. Маг в парке — не тревога: пока никто не
 * убит, на игрока смотрят и не трогают. Это и есть та половина игры,
 * которой не хватало: комнату можно обойти, разглядеть, что где стоит, и
 * подготовить ход — а бой начинается тогда, когда его начал ты.
 *
 * Считается именно смерть, а не шум и не вид заряженного. Иначе «тихая
 * фаза» кончалась бы неизвестно от чего, и игрок не понимал бы, что
 * именно её оборвало.
 *
 * ИСКЛЮЧЕНИЕ — ЭТАЖ С ДОЗОРОМ (флаг `watchful`, пока только «Башня»).
 * Там правило выше давало проход без единого приёма: тихо и хитрость
 * проходились без пара и без приманки (приёмка 03.10). На таком этаже
 * страж видит глазами МГС (src/vendor/stels-ii@1.0.0/vision.js, дословно), узнаёт
 * по формуле МГС (watchNotice), тревога — машина МГС (world.js,
 * noteAlarm), а стоит он на посту и смотрит туда, куда поставлен. На шум
 * идёт по прямой; в стену и в огонь не лезет — встаёт и смотрит; домой
 * возвращается своим путём (homeStep). Остальные этажи — как были.
 */

import { TILE_SIZE, BODY, WEAPONS, angleDelta, turnToward, clamp, hasSight, hasShot, emitNoise, tileIndex, noteAlarm } from './world.js';
import { blocksMove } from './level.js';
import { burningIndex, GROUND } from './field.js';
import { canSee } from './vendor/stels-ii@1.0.0/vision.js';
import { sightMul } from './vendor/stels-ii@1.0.0/alarm.js';
import { GUARD, INVESTIGATE } from './vendor/stels-ii@1.0.0/tuning.js';
import { glanceAngle } from './vospriyatie/svideteli.js';
import { taskStep, learnFear } from './podgotovka.js';

const SIGHT_RANGE = 300;
const SIGHT_HALF = 0.95;   /* половина конуса, ~110° целиком */
const FEEL_RANGE = 58;     /* за спиной, но вплотную — заметит */
const NOTICE_TIME = 0.2;   /* столько взгляда нужно, чтобы понять */
const FORGET_TIME = 3.5;

const NEIGHBOURS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];


/*
 * ОПАСНАЯ КЛЕТКА — СВОЯ У КАЖДОГО СТРАЖА (05.10, ответ Сергея: «чтобы они
 * видели, что творится с их коллегами, и уже тогда понимали, что не надо
 * подходить к огню»).
 *
 * Горящий пол — стена для всех, как и было. Сверх этого тот, кто ВИДЕЛ,
 * как своего жжёт (enemy.fearOf, src/podgotovka.js), держится от пламени
 * на клетку: соседняя с огнём клетка для него тоже стена, и молодой огонь
 * (ещё не разгоревшийся, FIRE_CATCH) — тоже. Видевший разряд по луже
 * обходит лужи. Тактический поиск пути из Миллингтона (§6.3: «стоимость
 * клетки растёт у огня») в самом дешёвом виде: стоимость бесконечная,
 * и обход получается без отдельной логики.
 */
export const fears = (enemy, element) => Boolean(enemy && enemy.fearOf && enemy.fearOf.has(element));

function flameNear(world, idx) {
  if (world.ground[idx] === GROUND.FIRE) return true;
  const x = idx % world.w;
  const y = (idx / world.w) | 0;
  for (const [dx, dy] of NEIGHBOURS) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= world.w || ny >= world.h) continue;
    if (world.ground[ny * world.w + nx] === GROUND.FIRE) return true;
  }
  return false;
}

export function hazardIndex(world, enemy, idx) {
  if (idx < 0) return false;
  if (burningIndex(world, idx)) return true;
  if (!enemy || !enemy.fearOf || !enemy.fearOf.size || !RULES.wary) return false;
  if (enemy.fearOf.has('fire') && flameNear(world, idx)) return true;
  if (enemy.fearOf.has('bolt') && world.ground[idx] === GROUND.WATER) return true;
  return false;
}

/* Поломка для проверки (п.6): RULES.wary = false — видевший ходит, как
   невидевший; tests/adaptaciya.mjs, раздел «обход», обязан покраснеть. */
export const RULES = { wary: true };

/*
 * Волна расстояний от игрока по проходимым клеткам. Поле маленькое
 * (тысяча клеток), поэтому проще пересчитать его целиком четыре раза в
 * секунду, чем вести и чинить пути для каждого врага.
 *
 * `who` — чьими глазами считать опасные клетки (hazardIndex): null —
 * общая волна (горящий пол), страж со страхом — волна осторожных
 * (world.flowWary, world.js).
 */
export function buildFlowField(world, x, y, who = null) {
  const size = world.w * world.h;
  const field = new Int16Array(size).fill(-1);
  const start = tileIndex(world, x, y);

  if (blocksMove(world.tiles[start])) return field;

  const queue = new Int32Array(size);
  let head = 0;
  let tail = 0;
  queue[tail++] = start;
  field[start] = 0;

  while (head < tail) {
    const at = queue[head++];
    const ax = at % world.w;
    const ay = (at / world.w) | 0;
    const next = field[at] + 1;

    for (let i = 0; i < 4; i += 1) {
      const nx = ax + NEIGHBOURS[i][0];
      const ny = ay + NEIGHBOURS[i][1];
      if (nx < 0 || ny < 0 || nx >= world.w || ny >= world.h) continue;
      const idx = ny * world.w + nx;
      /*
       * Разгоревшийся пол для волны — та же стена. Без этого враги идут в
       * огонь по кратчайшей и умирают там пачками: этаж зачищает себя сам,
       * а пожар из инструмента превращается в кнопку «победить». Пусть
       * лучше стоят по ту сторону и ждут, пока прогорит.
       */
      if (field[idx] !== -1 || blocksMove(world.tiles[idx]) || hazardIndex(world, who, idx)) continue;
      field[idx] = next;
      queue[tail++] = idx;
    }
  }

  return field;
}


/* Куда шагнуть, чтобы стать ближе к игроку по волне. Видевший огонь
   ходит по своей волне (world.flowWary): у пламени не идёт. Стоит в
   опасной клетке — шагает в любую соседнюю, откуда волна есть. */
function flowStep(world, enemy) {
  const field = (enemy.fearOf && enemy.fearOf.size && world.flowWary) ? world.flowWary : world.flow;
  const cx = Math.floor(enemy.x / TILE_SIZE);
  const cy = Math.floor(enemy.y / TILE_SIZE);
  const here = field[cy * world.w + cx];
  if (here === undefined) return null;
  if (here < 0 && field === world.flow) return null;

  let best = here < 0 ? Infinity : here;
  let bestX = 0;
  let bestY = 0;

  for (const [dx, dy] of NEIGHBOURS) {
    const nx = cx + dx;
    const ny = cy + dy;
    if (nx < 0 || ny < 0 || nx >= world.w || ny >= world.h) continue;

    /* По диагонали — только если оба бока свободны: иначе врагу срезает угол сквозь косяк. */
    if (dx && dy) {
      if (blocksMove(world.tiles[cy * world.w + nx])) continue;
      if (blocksMove(world.tiles[ny * world.w + cx])) continue;
      /* Осторожный не срезает угол и у пламени: тело по диагонали
         цепляет соседние клетки. */
      if (field === world.flowWary && (hazardIndex(world, enemy, cy * world.w + nx)
        || hazardIndex(world, enemy, ny * world.w + cx))) continue;
    }

    const value = field[ny * world.w + nx];
    if (value < 0 || value >= best) continue;
    best = value;
    bestX = dx;
    bestY = dy;
  }

  if (!bestX && !bestY) return null;

  /* Целимся в центр соседней клетки, а не в её край — так меньше трения о стены. */
  const tx = (cx + bestX + 0.5) * TILE_SIZE;
  const ty = (cy + bestY + 0.5) * TILE_SIZE;
  const angle = Math.atan2(ty - enemy.y, tx - enemy.x);
  return { x: Math.cos(angle), y: Math.sin(angle) };
}


function sees(world, enemy, target) {
  const dx = target.x - enemy.x;
  const dy = target.y - enemy.y;
  const dist = Math.hypot(dx, dy);
  if (dist > SIGHT_RANGE) return false;

  const toTarget = Math.atan2(dy, dx);
  const inCone = Math.abs(angleDelta(enemy.angle, toTarget)) < SIGHT_HALF;
  if (!inCone && dist > FEEL_RANGE) return false;

  return hasSight(world, enemy.x, enemy.y, target.x, target.y);
}


export function thinkEnemy(world, enemy, dt, speed) {
  const player = world.player;
  const result = { vx: 0, vy: 0, attack: false };

  /*
   * Заряженного видно издалека: стек горит над головой. Спрятать силу
   * нельзя — значит, на неё отвечают: громила ускоряется, чтобы достать
   * до выстрела, стрелок жмёт на спуск раньше.
   */
  const charged = player.stack && player.stack.length >= 2;

  /*
   * Этаж с дозором («Башня», флаг `watchful`) видит глазами МГС: конус
   * 55°, 7 клеток, чутьё спиной на клетку (src/vendor/stels-ii@1.0.0/vision.js,
   * дословно). Пар и пыль прячут сами — луч МГС здесь ходит через наш
   * hasSight. Остальные этажи смотрят прежним кругом в 110° и 300 px.
   */
  const watch = world.trevoga;
  const visible = player.alive && (watch
    ? canSee(world, enemy, player, sightMul(watch))
    : sees(world, enemy, player));
  const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
  const toPlayer = Math.atan2(player.y - enemy.y, player.x - enemy.x);

  if (watch) watchNotice(world, enemy, visible, dist, dt);

  /*
   * Пока на этаже никто не умер, игрок для них — прохожий. Не «замечают,
   * но терпят», а не обращают внимания вовсе: ни разворота вслед, ни
   * подхода. Раньше они провожали взглядом, и это читалось как слежка —
   * будто тебя уже раскусили и вот-вот бросятся, хотя ты ничего не сделал.
   * Тихая половина игры от этого не работала: подкрадываться незачем,
   * если на тебя и так смотрят все.
   *
   * Внимание начинается с преступления, а не с присутствия.
   */
  if (watch) {
    /* Внимание на этаже с дозором считает watchNotice выше — по МГС. */
  } else if (visible && !world.engaged) {
    enemy.notice = 0;
  } else if (visible) {
    enemy.notice = (enemy.notice || 0) + dt;
    if (enemy.notice > NOTICE_TIME && enemy.state !== 'chase') {
      enemy.state = 'chase';
      enemy.lost = 0;
      /* Крик — это тоже шум: одного увидевшего хватает, чтобы сбежался этаж. */
      emitNoise(world, enemy.x, enemy.y, 240, 'shout');
      world.events.push({ type: 'spot' });
    }
  } else {
    enemy.notice = Math.max(0, (enemy.notice || 0) - dt * 1.6);
  }

  /* Провожают взглядом: тихая фаза не должна выглядеть слепотой. */
  if (enemy.watching > 0) {
    enemy.watching -= dt;
    enemy.angle = turnToward(enemy.angle, toPlayer, dt * 3);
  }

  /*
   * ПОРУЧЕНИЕ (05.10, src/podgotovka.js): тушить, за плащом, намочить
   * плащ. Идёт, пока страж свободен — стоит на посту или возвращается
   * на него. Увидел игрока, услышал шум, лёг — поручение снимает
   * podgotovka.js, и дальше всё как было.
   */
  if (enemy.task && (enemy.state === 'idle' || (enemy.state === 'alert' && !enemy.heard))) {
    const move = taskStep(world, enemy, dt, speed);
    if (move) return { ...result, ...move };
  }

  switch (enemy.state) {

    case 'idle': {
      /*
       * Дозорный держит пост: стоит там, где поставлен, и смотрит туда,
       * куда поставлен (МГС — пост без осмотра). Сдвинули с места —
       * идёт обратно тем же шагом, что на шум. Блуждающий взгляд ниже
       * для дозора не годится: конус, который через минуту смотрит
       * куда угодно, не выучить, а стелс и есть выучить и обойти.
       */
      if (watch && enemy.post) {
        if (enemy.heard) { enemy.state = 'alert'; break; }
        const away = Math.hypot(enemy.post.x - enemy.x, enemy.post.y - enemy.y);
        if (away > 6) { enemy.state = 'alert'; enemy.search = INVESTIGATE; break; }
        /* Пост с оглядкой (щитоносец у ядра) раз в минуту смотрит назад —
           на то, что стережёт спиной (src/vospriyatie/svideteli.js). */
        const glance = glanceAngle(world, enemy.post);
        enemy.angle = turnToward(enemy.angle, glance ?? enemy.post.angle, dt * GUARD.turnRate);
        break;
      }

      /* Взгляд гуляет: неподвижный конус читается как слепое пятно. */
      enemy.think -= dt;
      if (enemy.think <= 0) {
        enemy.think = 1.4 + Math.random() * 2.2;
        enemy.lookAt = enemy.angle + (Math.random() - 0.5) * 2.4;
      }
      if (enemy.lookAt !== undefined) enemy.angle = turnToward(enemy.angle, enemy.lookAt, dt * 1.6);

      if (enemy.heard) enemy.state = 'alert';
      break;
    }

    case 'alert': {
      const point = enemy.heard || enemy.home;
      const gap = Math.hypot(point.x - enemy.x, point.y - enemy.y);

      /*
       * Дозорный, вернувшийся на пост, — снова дозорный. Возвращается он
       * точно, до шести пикселей, а не «примерно» (26, как к месту шума):
       * пост на полклетки в сторону — это конус на полклетки в сторону, и
       * выученный проход переставал быть проходом после первой проверки.
       */
      const arrive = watch && !enemy.heard ? 6 : 26;
      if (watch && !enemy.heard && gap <= arrive) {
        enemy.state = 'idle';
        break;
      }

      if (gap > arrive) {
        /* Домой дозорный идёт по своему пути, а не по прямой: свой пост он
           знает, и упереться в стену по дороге на пост — не «осмотреться»,
           а застрять навсегда (так и вышло: страж, зашедший на шум в
           боковую, стоял у стены прохода до конца прогона). */
        const step = watch && !enemy.heard
          ? (homeStep(world, enemy) || flowStepToward(world, enemy, point, true))
          : flowStepToward(world, enemy, point, Boolean(watch));

        /*
         * В огонь дозорный не идёт. Пришёл на треск горящего амбара —
         * встаёт у края и смотрит в пламя, сколько смотрел бы на месте
         * шума, а потом возвращается на пост. Без этого приманка
         * превращалась в ловушку: страж шёл точно в центр стога (треск
         * соломы ведёт без разброса, emitNoise), сгорал, и смерть на
         * глазах второго поднимала тревогу — хитрость становилась
         * убийством. Волна погони (buildFlowField) огонь и так обходит:
         * здесь то же правило, только для шага на шум.
         */
        if (watch && (!step || fireAhead(world, enemy, step))) {
          /* Упёрся в пламя по дороге — запомнил: огонь на пути тоже
             учит обходить (05.10). Только обходить: тушить и бегать за
             плащом учит лишь то, что сделали с СВОИМ (podgotovka.js). */
          if (step && burningIndex(world, tileIndex(world, enemy.x + step.x * (BODY + 10), enemy.y + step.y * (BODY + 10)))) {
            learnFear(world, enemy, 'fire', 'ogon');
          }
          enemy.angle = turnToward(enemy.angle, Math.atan2(point.y - enemy.y, point.x - enemy.x), dt * GUARD.turnRate);
          enemy.search = (enemy.search ?? INVESTIGATE) - dt;
          if (enemy.search <= 0) { enemy.heard = null; enemy.search = INVESTIGATE; }
          break;
        }

        result.vx = step.x * speed.walk * 1.25;
        result.vy = step.y * speed.walk * 1.25;
        enemy.angle = turnToward(enemy.angle, Math.atan2(step.y, step.x), dt * 6);
        enemy.search = watch ? INVESTIGATE : 2.6;

        /*
         * Застрял по дороге на шум — осматривается оттуда (04.10). Шаг на
         * шум сбрасывал отсчёт осмотра каждый кадр, и дозорный, упёршийся
         * в напарника у угла, стоял «настороже» до конца этажа: так двое
         * из подвала «Башни» сошлись у смятого стока и не вернулись на
         * посты за 70 с (tests/lestnica.mjs, «тихо», зерно 12). Три
         * секунды без сближения с местом шума — значит, дальше не пройти.
         */
        if (watch && enemy.heard) {
          if (enemy.stallFor !== enemy.heard || gap < (enemy.stallGap ?? Infinity) - 2) {
            enemy.stallFor = enemy.heard;
            enemy.stallGap = gap;
            enemy.stall = 0;
          } else {
            enemy.stall = (enemy.stall || 0) + dt;
            if (enemy.stall > 3) {
              enemy.heard = null;
              enemy.search = INVESTIGATE;
              enemy.stall = 0;
              enemy.stallGap = Infinity;
            }
          }
        }
      } else if (watch) {
        /* Дошёл до места шума — осматривается (МГС: investigate 2.8 с) и
           возвращается на пост: heard гаснет, и та же ветка ведёт домой. */
        enemy.search = (enemy.search ?? INVESTIGATE) - dt;
        enemy.angle += Math.sin(world.time * 2.2 + enemy.home.x) * dt * 2.2;
        if (enemy.search <= 0) {
          enemy.heard = null;
          enemy.search = INVESTIGATE;
        }
      } else {
        enemy.search = (enemy.search ?? 2.6) - dt;
        enemy.angle += Math.sin(world.time * 2.2 + enemy.home.x) * dt * 2.2;
        if (enemy.search <= 0) {
          enemy.heard = null;
          enemy.state = 'idle';
          enemy.think = 0.4;
        }
      }
      break;
    }

    /*
     * ОБЫСК (слой «в»): донесли или нашли пропажу — идти на место своим
     * путём (поиском по клеткам, как домой), осматриваться, пока ПОИСК МГС
     * не спадёт, и вернуться на пост (ветка alert без точки ведёт домой).
     */
    case 'search': {
      const point = enemy.searchPoint;
      if (!point || world.time > (enemy.searchUntil || 0)
        || (watch && watch.state !== 'search' && watch.state !== 'alert')) {
        enemy.state = 'alert';
        enemy.heard = null;
        enemy.searchPoint = null;
        enemy.search = INVESTIGATE;
        break;
      }
      const gap = Math.hypot(point.x - enemy.x, point.y - enemy.y);
      if (gap > 26) {
        const step = pathStep(world, enemy, point);
        if (step && !fireAhead(world, enemy, step)) {
          result.vx = step.x * speed.walk * 1.25;
          result.vy = step.y * speed.walk * 1.25;
          enemy.angle = turnToward(enemy.angle, Math.atan2(step.y, step.x), dt * 6);
          break;
        }
      }
      enemy.angle += Math.sin(world.time * 2.2 + enemy.home.x) * dt * 2.2;
      break;
    }

    case 'chase': {
      if (!visible) {
        enemy.lost = (enemy.lost || 0) + dt;
        if (enemy.lost > FORGET_TIME) {
          enemy.state = 'alert';
          enemy.heard = { x: player.x, y: player.y };
          enemy.search = 3;
          break;
        }
      } else {
        enemy.lost = 0;
        enemy.lastSeen = { x: player.x, y: player.y };
      }

      const weapon = WEAPONS[enemy.weapon];
      enemy.angle = turnToward(enemy.angle, toPlayer, dt * (visible ? 7 : 3.5));

      if (weapon.kind === 'gun') {
        /*
         * Дальность огня ограничена тем, что игрок видит на своём экране
         * (её сообщает камера). На узком телефоне стрелок подойдёт ближе,
         * на широком мониторе достанет издалека — но выстрела из-за края
         * кадра не будет нигде.
         */
        const reach = Math.min(330, world.viewRadius || 260);

        /* Стрелять можно только туда, куда снаряд долетит: мебель видно
           насквозь, но она держит выстрел, и стол между ними — это повод
           обойти, а не повод расстреливать стол. */
        const shootable = visible && dist < reach
          && hasShot(world, enemy.x, enemy.y, player.x, player.y)
          && Math.abs(angleDelta(enemy.angle, toPlayer)) < 0.2;

        /* Стрелок держит дистанцию: вплотную он беспомощен, и это шанс игрока. */
        if (dist < 90) {
          const away = toPlayer + Math.PI;
          /* Видевший огонь и пятясь в него не шагнёт. */
          if (!(wary(enemy) && lineHazard(world, enemy, away))) {
            result.vx = Math.cos(away) * speed.walk;
            result.vy = Math.sin(away) * speed.walk;
          }
        } else if (!shootable) {
          const step = flowStep(world, enemy)
            || (wary(enemy) ? { x: 0, y: 0 } : { x: Math.cos(toPlayer), y: Math.sin(toPlayer) });
          result.vx = step.x * speed.run;
          result.vy = step.y * speed.run;
        }

        if (shootable && enemy.cooldown <= 0) {
          /* Замах перед выстрелом: у игрока должно быть время уйти с линии. */
          enemy.windup = (enemy.windup || 0) + dt;
          if (enemy.windup > (charged ? 0.3 : 0.42)) {
            enemy.windup = 0;
            result.attack = true;
            enemy.cooldown = 0.9 + Math.random() * 0.5;
          }
        } else {
          enemy.windup = Math.max(0, (enemy.windup || 0) - dt * 2);
        }

        if (enemy.ammo <= 0) {
          /* Патроны кончились — идёт бить прикладом. */
          enemy.weapon = 'bat';
        }
        break;
      }

      const reach = weapon.reach + BODY - 6;
      if (dist > reach) {
        /* Видит — бежит напрямик. Кроме того, кто видел, как жжёт своих:
           напрямик через пламя он не побежит, а обойдёт по своей волне
           или встанет у края (05.10). Невидевший бежит как раньше —
           хоть сквозь огонь. */
        let step = (visible && hasSight(world, enemy.x, enemy.y, player.x, player.y))
          ? { x: Math.cos(toPlayer), y: Math.sin(toPlayer) }
          : (flowStep(world, enemy) || { x: 0, y: 0 });
        if (wary(enemy) && (step.x || step.y) && lineHazard(world, enemy, Math.atan2(step.y, step.x))) {
          step = flowStep(world, enemy) || { x: 0, y: 0 };
        }
        const rush = charged ? 1.14 : 1;
        result.vx = step.x * speed.run * rush;
        result.vy = step.y * speed.run * rush;
        enemy.windup = 0;
      } else if (enemy.cooldown <= 0) {
        enemy.windup = (enemy.windup || 0) + dt;
        if (enemy.windup > 0.22) {
          enemy.windup = 0;
          result.attack = true;
        }
      }
      break;
    }

    default:
      break;
  }

  return result;
}


/*
 * ВНИМАНИЕ ДОЗОРНОГО — ПО МГС
 * =========================================================
 * Формула из МГС (stealth/src/guard.js, накопление notice): чтобы
 * понять, что перед ним чужой, страж должен продержать его в конусе
 * `notice` секунд на пределе дальности — и тем меньше, чем ближе, до
 * доли `noticeNear` у самого носа. Иначе пробежать у стража под носом
 * выгоднее, чем красться: он честно не успевает понять. Мелькнуть на
 * краю конуса и уйти — не преступление.
 *
 * Не видит — внимание тает со скоростью 0.8 в секунду, как в МГС.
 *
 * Понял — гонится, кричит (крик — тоже шум, он собирает соседей) и
 * ставит этаж в ТРЕВОГУ с точкой «где игрок сейчас» (noteAlarm). Пока
 * видит — каждый кадр подтверждает тревогу: её память (memory 1.3 с)
 * начинает таять, только когда игрок пропал из конусов всех стражей.
 */
function watchNotice(world, enemy, visible, dist, dt) {
  if (!visible) {
    enemy.notice = Math.max(0, (enemy.notice || 0) - dt * 0.8);
    return;
  }
  enemy.notice = (enemy.notice || 0) + dt;
  const need = GUARD.notice
    * Math.max(GUARD.noticeNear, Math.min(1, dist / (GUARD.sight * sightMul(world.trevoga))));
  if (enemy.notice < need) return;

  if (enemy.state !== 'chase') {
    enemy.state = 'chase';
    enemy.lost = 0;
    emitNoise(world, enemy.x, enemy.y, 240, 'shout');
    world.events.push({ type: 'spot', x: enemy.x, y: enemy.y });
  }
  noteAlarm(world, 'spot', world.player.x, world.player.y);
}

/*
 * Шаг к своему посту по клеткам. Поиск в ширину от поста по тому, что
 * держит тело и не горит, — то же, что знает волна погони, только от
 * поста, а не от игрока. Путь кэшируется на полсекунды: двери на этаже
 * меняются (сгоревшие ворота, смятый сток), и путь, построенный однажды,
 * мог бы вести сквозь уже закрытое.
 */
function homeStep(world, enemy) {
  const here = tileIndex(world, enemy.x, enemy.y);
  const home = tileIndex(world, enemy.home.x, enemy.home.y);
  if (here === home) return null;
  if (!enemy.homeField || world.time - enemy.homeField.at > 0.5) {
    const field = new Int16Array(world.w * world.h).fill(-1);
    const queue = new Int32Array(world.w * world.h);
    let head = 0;
    let tail = 0;
    field[home] = 0;
    queue[tail++] = home;
    while (head < tail) {
      const at = queue[head++];
      const ax = at % world.w;
      const ay = (at / world.w) | 0;
      for (let i = 0; i < 4; i += 1) {
        const nx = ax + NEIGHBOURS[i][0];
        const ny = ay + NEIGHBOURS[i][1];
        if (nx < 0 || ny < 0 || nx >= world.w || ny >= world.h) continue;
        const idx = ny * world.w + nx;
        if (field[idx] !== -1 || blocksMove(world.tiles[idx]) || hazardIndex(world, enemy, idx)) continue;
        field[idx] = field[at] + 1;
        queue[tail++] = idx;
      }
    }
    enemy.homeField = { at: world.time, field };
  }
  const field = enemy.homeField.field;
  const cx = here % world.w;
  const cy = (here / world.w) | 0;
  let best = field[here] < 0 ? Infinity : field[here];
  let to = null;
  for (let i = 0; i < 4; i += 1) {
    const nx = cx + NEIGHBOURS[i][0];
    const ny = cy + NEIGHBOURS[i][1];
    if (nx < 0 || ny < 0 || nx >= world.w || ny >= world.h) continue;
    const value = field[ny * world.w + nx];
    if (value < 0 || value >= best) continue;
    best = value;
    to = [nx, ny];
  }
  if (!to) return null;
  /* Последний шаг — прямо в точку поста, а не в центр соседней клетки. */
  const target = best === 0 ? enemy.home : { x: (to[0] + 0.5) * TILE_SIZE, y: (to[1] + 0.5) * TILE_SIZE };
  const angle = Math.atan2(target.y - enemy.y, target.x - enemy.x);
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

/*
 * Шаг к произвольной точке по клеткам — тот же поиск в ширину, что домой
 * (homeStep), только от точки обыска. Кэш на полсекунды и на точку.
 */
export function pathStep(world, enemy, point) {
  const here = tileIndex(world, enemy.x, enemy.y);
  const goal = tileIndex(world, point.x, point.y);
  if (here === goal) return { x: (point.x - enemy.x) / (Math.hypot(point.x - enemy.x, point.y - enemy.y) || 1), y: (point.y - enemy.y) / (Math.hypot(point.x - enemy.x, point.y - enemy.y) || 1) };
  if (!enemy.searchField || enemy.searchField.goal !== goal || world.time - enemy.searchField.at > 0.5) {
    const field = new Int16Array(world.w * world.h).fill(-1);
    const queue = new Int32Array(world.w * world.h);
    let head = 0;
    let tail = 0;
    field[goal] = 0;
    queue[tail++] = goal;
    while (head < tail) {
      const at = queue[head++];
      const ax = at % world.w;
      const ay = (at / world.w) | 0;
      for (let i = 0; i < 4; i += 1) {
        const nx = ax + NEIGHBOURS[i][0];
        const ny = ay + NEIGHBOURS[i][1];
        if (nx < 0 || ny < 0 || nx >= world.w || ny >= world.h) continue;
        const idx = ny * world.w + nx;
        if (field[idx] !== -1 || blocksMove(world.tiles[idx]) || hazardIndex(world, enemy, idx)) continue;
        field[idx] = field[at] + 1;
        queue[tail++] = idx;
      }
    }
    enemy.searchField = { at: world.time, goal, field };
  }
  const field = enemy.searchField.field;
  const cx = here % world.w;
  const cy = (here / world.w) | 0;
  let best = field[here] < 0 ? Infinity : field[here];
  let to = null;
  for (let i = 0; i < 4; i += 1) {
    const nx = cx + NEIGHBOURS[i][0];
    const ny = cy + NEIGHBOURS[i][1];
    if (nx < 0 || ny < 0 || nx >= world.w || ny >= world.h) continue;
    const value = field[ny * world.w + nx];
    if (value < 0 || value >= best) continue;
    best = value;
    to = [nx, ny];
  }
  if (!to) return null;
  const target = best === 0 ? point : { x: (to[0] + 0.5) * TILE_SIZE, y: (to[1] + 0.5) * TILE_SIZE };
  const angle = Math.atan2(target.y - enemy.y, target.x - enemy.x);
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

/* Горит ли пол там, куда страж ступит следующим шагом. Щуп — тот же,
   что у упора в стену (flowStepToward): тело плюс десять пикселей. Для
   видевшего огонь «горит» — и клетка у пламени (hazardIndex). */
function fireAhead(world, enemy, step) {
  const probeX = enemy.x + step.x * (BODY + 10);
  const probeY = enemy.y + step.y * (BODY + 10);
  return hazardIndex(world, enemy, tileIndex(world, probeX, probeY));
}

const wary = (enemy) => Boolean(enemy.fearOf && enemy.fearOf.size);

/* Опасно ли бежать по прямой в эту сторону: щуп на шаг и на клетку. */
function lineHazard(world, enemy, angle) {
  for (const reach of [BODY + 10, TILE_SIZE * 1.1]) {
    const at = tileIndex(world, enemy.x + Math.cos(angle) * reach, enemy.y + Math.sin(angle) * reach);
    if (hazardIndex(world, enemy, at)) return true;
  }
  return false;
}

/* Волна построена от игрока, а к точке шума враг идёт по прямой со скольжением. */
function flowStepToward(world, enemy, point, watch = false) {
  const angle = Math.atan2(point.y - enemy.y, point.x - enemy.x);
  const ahead = { x: Math.cos(angle), y: Math.sin(angle) };

  const probeX = enemy.x + ahead.x * (BODY + 10);
  const probeY = enemy.y + ahead.y * (BODY + 10);
  const blocked = blocksMove(world.tiles[tileIndex(world, probeX, probeY)]);
  if (!blocked) return ahead;

  /*
   * Дозорный, упёршийся в стену по дороге на шум, дальше не идёт — встаёт
   * и смотрит туда (ветка alert). Обход ниже ведёт по волне, а волна
   * построена от ИГРОКА: страж, услышавший сток через стену подвала,
   * шёл не к стоку, а прямиком к спрятавшемуся игроку — через сток, двор
   * и половину карты. Это всеведение, а не слух; на обычных этажах оно
   * осталось как было.
   */
  if (watch) return null;

  /* Упёрся — пробуем обойти по волне, она знает про двери. */
  const step = flowStep(world, enemy);
  if (step) return step;

  const side = angle + (enemy.home.x % 2 ? 1.2 : -1.2);
  return { x: Math.cos(side), y: Math.sin(side) };
}

export { clamp };
