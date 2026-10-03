/*
 * МОНЕТА — из МГС Сергея (stealth@6fda077, src/world.js: throwCoin :272,
 * stepCoins :365). Перенесена ЛОГИКОЙ, а не файлом: у МГС она живёт
 * внутри его world.js рядом с пистолетом и коробкой, и дословная копия
 * потащила бы их за собой. Строки ниже — те же шаги в том же порядке;
 * отличия названы:
 *
 *   1. Куда. МГС бросает по взгляду на всю дальность. Здесь — в точку
 *      (`intent.throwCoin = { x, y }`), но не дальше дальности МГС:
 *      палец на телефоне показывает место, а не направление, и монета,
 *      пролетевшая мимо пальца, читалась бы как промах ввода.
 *   2. Чем держится. МГС спрашивает solidAt своей карты; у нас монету
 *      держит то же, что держит снаряд (blocksShot): стена, створка,
 *      мебель — а ров, пропасть и стекло она перелетает.
 *   3. Числа ×4/3 (тайл 24 → 32): полёт 202.7 px, шум 173.3 px — те же
 *      6.3 и 5.4 клетки, что у МГС (src/vospriyatie/tuning.js, COIN).
 *
 * Шум падения — наш emitNoise, и страж идёт НА ЗВУК, а не к игроку:
 * отвлечение получается само, без единой строки про «отвлечь». Точно в
 * место падения, без разброса (world.js, emitNoise) — как у МГС, где
 * hearNoise ставит подозрение ровно в точку шума.
 *
 * Только на этаже, который назвал число монет (`level.coins`, «Башня» —
 * три); на остальных `world.coins` нет, и намерение бросить молча
 * ничего не делает.
 */

import { COIN, NOISE } from './tuning.js';
import { blocksShot, TILE_SIZE } from '../level.js';

/* Подобрать упавшую: 14 px МГС ×4/3. */
const PICKUP = 14 * (32 / 24);

export function createCoins(world, count = COIN.count) {
  world.coins = [];
  world.coinsLeft = count;
}

function blocked(world, x, y) {
  const tx = Math.floor(x / TILE_SIZE);
  const ty = Math.floor(y / TILE_SIZE);
  if (tx < 0 || ty < 0 || tx >= world.w || ty >= world.h) return true;
  return blocksShot(world.tiles[ty * world.w + tx]);
}

/*
 * Бросить монету в точку. Возвращает true, если бросок состоялся. Пустой
 * карман — событие `coin-empty`, а не тишина: иначе человек решит, что
 * кнопка не сработала (МГС: deny).
 */
export function throwCoin(world, target) {
  const p = world.player;
  if (!world.coins || !p.alive || !target) return false;
  if (world.coinsLeft <= 0) {
    world.events.push({ type: 'coin-empty' });
    return false;
  }
  const dx = target.x - p.x;
  const dy = target.y - p.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1) return false;
  world.coinsLeft -= 1;
  world.coins.push({
    x: p.x,
    y: p.y,
    vx: (dx / distance) * COIN.speed,
    vy: (dy / distance) * COIN.speed,
    left: Math.min(COIN.range, distance),
    landed: false,
    t: 0,
  });
  world.events.push({ type: 'coin-thrown', left: world.coinsLeft });
  return true;
}

/*
 * Полёт, падение, шум. `emitNoise` — дверь мира (world.js): монета о
 * слухе стражи не знает ничего, кроме того, что падение звучит.
 */
export function stepCoins(world, dt, emitNoise) {
  if (!world.coins) return;
  for (const c of world.coins) {
    if (c.landed) { c.t += dt; continue; }
    const nx = c.x + c.vx * dt;
    const ny = c.y + c.vy * dt;
    c.left -= Math.hypot(nx - c.x, ny - c.y);
    if (blocked(world, nx, ny) || c.left <= 0) {
      c.landed = true;
      /* Кто услышит: живой, на ногах, не в погоне, в радиусе шума. Число
         — для счётчика и проверок; само «услышал» решает emitNoise. */
      const heard = world.enemies.filter((e) => e.alive && !(e.downed > 0) && e.state !== 'chase'
        && Math.hypot(e.x - c.x, e.y - c.y) <= NOISE.coin).length;
      emitNoise(world, c.x, c.y, NOISE.coin, 'coin');
      world.events.push({ type: 'coin', x: c.x, y: c.y, heard });
    } else {
      c.x = nx;
      c.y = ny;
    }
  }
  /* Упавшую монетку можно подобрать: их всего три, и они не расходники. */
  const p = world.player;
  world.coins = world.coins.filter((c) => {
    if (c.landed && c.t > 0.4 && p.alive && Math.hypot(c.x - p.x, c.y - p.y) < PICKUP) {
      world.coinsLeft += 1;
      world.events.push({ type: 'coin-picked', left: world.coinsLeft });
      return false;
    }
    return true;
  });
}
