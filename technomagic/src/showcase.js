/*
 * СЦЕНА ДЛЯ ВИТРИНЫ
 * =========================================================
 * Игра даёт снаряд, витрина стреляет. Здесь ставится сцена и отдаются
 * рычаги: шаг, отрисовка, состояние. Снимает её другой.
 *
 * Что показываем — решено не вкусом. На карточке сейчас пустое зелёное
 * поле с фигурой в двенадцать пикселей, по которому нельзя понять, во что
 * играют. А отличает эту игру от всех соседних по витрине ровно одно:
 * следствие остаётся в мире и работает дальше само. Вода растекается,
 * разряд идёт по разлитой воде, тела падают по очереди.
 *
 * Статичный кадр этого показать не может в принципе: там нечего снимать,
 * пока не пошло время. Петля может.
 *
 * Сцена детерминирована: свой сид, руками расставленные участники,
 * остановленный цикл игры. Два прогона дают одинаковые кадры — без этого
 * нельзя отступить назад и переснять тот же момент.
 */

import { createWorld, update, TILE_SIZE } from './world.js';
import { TILE } from './level.js';

/* Свой источник случайности на время съёмки. Тот же сид — тот же кадр. */
function seeded(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

/*
 * Сцена размечается сама, а не по вбитым числам: ищется бочка, под
 * которой стоят трое, и всё остальное считается от неё. Вбитые
 * координаты пережили бы ровно одну правку этажа.
 */
function findBarrel(world) {
  for (let i = 0; i < world.tiles.length; i += 1) {
    if (world.tiles[i] !== TILE.BARREL) continue;
    const bx = ((i % world.w) + 0.5) * TILE_SIZE;
    const by = (((i / world.w) | 0) + 0.5) * TILE_SIZE;
    const under = world.enemies.filter((enemy) => Math.abs(enemy.x - bx) <= TILE_SIZE * 1.4
      && enemy.y - by > 0 && enemy.y - by <= TILE_SIZE * 1.8).length;
    if (under >= 3) return { at: i, x: bx, y: by };
  }
  return null;
}

export function createShowcase(level, renderer, hooks = {}) {
  const world = createWorld(level);

  const barrel = findBarrel(world);
  if (!barrel) throw new Error('на этаже нет бочки, под которой стоят трое');

  /* Лишние участники убираются: в кадре должно быть то, ради чего он снят. */
  for (const enemy of world.enemies) {
    const near = Math.hypot(enemy.x - barrel.x, enemy.y - barrel.y) < TILE_SIZE * 2.4;
    if (!near) enemy.alive = false;
  }

  world.elements = ['fire', 'water', 'wind', 'earth', 'bolt'];
  world.engaged = true;

  /* Игрок встаёт слева и в стороне: он в кадре, но не заслоняет цепь. */
  world.player.x = barrel.x - TILE_SIZE * 3.2;
  world.player.y = barrel.y + TILE_SIZE * 0.6;
  world.player.angle = Math.atan2(barrel.y - world.player.y, barrel.x - world.player.x);

  /* Крупный план. Двенадцать пикселей на витрине не читаются ничем. */
  world.zoomOverride = 4.2;

  const view = {
    x: (world.player.x + barrel.x) / 2 + TILE_SIZE * 0.4,
    y: barrel.y + TILE_SIZE * 0.7,
  };

  const idle = { moveX: 0, moveY: 0, aimAngle: null, attack: false, charge: null };
  let elapsed = 0;
  let fired = false;

  function step(dt) {
    elapsed += dt;

    /*
     * Один ход, и дальше мир играет сам. Молния в бочку: вода разливается,
     * разряд идёт по ней, трое падают по очереди. Ждём полсекунды до
     * выстрела, чтобы в петлю попал и замах, а не одни последствия.
     */
    if (!fired && elapsed >= 0.5) {
      fired = true;
      world.player.stack = ['bolt'];
      update(world, dt, { ...idle, aimAngle: world.player.angle, attack: true });
      return;
    }

    update(world, dt, { ...idle, aimAngle: world.player.angle });
  }

  function render() {
    renderer.draw(world, view);
  }

  /*
   * Состояние для ловли момента по признаку, а не по времени. «Снять на
   * второй секунде» — надежда; «крутить, пока не упали двое» — адрес.
   */
  function state() {
    return {
      секунд: Number(elapsed.toFixed(2)),
      выстрел: fired,
      живых: world.enemies.filter((enemy) => enemy.alive).length,
      упавших: world.corpses.length,
      мокрых: world.enemies.filter((enemy) => (enemy.wet || 0) > 0).length,
      подТоком: Boolean(world.charged),
      частиц: world.particles.length,
    };
  }

  return { world, view, step, render, state, hooks };
}

/* Сид держится ровно на время съёмки и возвращается назад: подменять
   случайность у всей страницы навсегда — способ получить необъяснимые
   отчёты через час. */
export function withSeed(seed, run) {
  const real = Math.random;
  Math.random = seeded(seed);
  try {
    return run();
  } finally {
    Math.random = real;
  }
}
