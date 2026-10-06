/*
 * «ТОЛКНУЛ СТРАЖНИКА — УДАРИТ» (слой «б», 03.10.2026)
 * =========================================================
 * Слово Сергея: «ты житель; толкнул стражника — он может ударить». В МГС
 * такого правила нет (там любой увиденный — чужой), поэтому это наше,
 * и названо прямо. Сделано из того, что уже есть, без нового оружия:
 *
 *   Игрок вошёл в СПОКОЙНОГО стража (на ногах, не в погоне) — тот
 *   отталкивает: игрока отбрасывает на клетку с лишним и на 0.7 с он не
 *   свой (ни шага, ни набора, ни выпуска). Это и есть удар — с одного
 *   удара в этой игре умирают все, поэтому «немного урона» здесь значит
 *   «сбит с ног», а не полоска здоровья.
 *
 *   Страж разворачивается и идёт смотреть, куда ушёл толкнувший
 *   (подозрение: состояние alert с точкой — та же ветка, что на шум).
 *   Тревоги нет: толкнули — не преступление.
 *
 *   Второй раз за 12 секунд — уже не случайность: страж бьёт всерьёз
 *   (погоня, крик) и поднимает ТРЕВОГУ МГС с точкой «где игрок»
 *   (world.js, noteAlarm 'spot').
 *
 * Отброс без флага `shove`: брошенное тело разбивается о стену уже со
 * 105 px/с (world.js, moveBody), а отброшенный стражем человек должен
 * удариться и встать, а не умереть о кладку. Скорость 240 < 300 —
 * порога своего хода, — поэтому стена его просто останавливает.
 *
 * Только на этаже с дозором (world.trevoga): на старых этажах игрок
 * проходит сквозь врагов, как проходил.
 */

import { noteAlarm, emitNoise } from '../world.js';

const TOUCH = 21;          /* два тела по 9 и запас: вошёл — значит коснулся */
const INTO = 30;           /* шёл НА него, а не мимо: проекция скорости, px/с */
export const SHOVE_SPEED = 240;
export const SHOVE_STUN = 0.7;
export const REPEAT = 12;  /* второй толчок за столько секунд — тревога */
const COOLDOWN = 0.8;      /* один толчок — одно касание, а не каждый кадр */

export function bumpGuards(world) {
  if (!world.trevoga) return;
  const p = world.player;
  if (!p.alive || (p.stun || 0) > 0) return;
  for (const enemy of world.enemies) {
    if (!enemy.alive || enemy.downed > 0 || enemy.stagger > 0) continue;
    if (enemy.state === 'chase') continue;
    if ((enemy.bumpCd || 0) > world.time) continue;
    const dx = enemy.x - p.x;
    const dy = enemy.y - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist > TOUCH || dist < 0.01) continue;
    const into = (p.vx * dx + p.vy * dy) / dist;
    if (into < INTO) continue;
    shoved(world, enemy, dx / dist, dy / dist);
    return;
  }
}

function shoved(world, enemy, ux, uy) {
  const p = world.player;
  const repeat = enemy.bumpAt !== undefined && world.time - enemy.bumpAt <= REPEAT;
  enemy.bumpAt = world.time;
  enemy.bumpCd = world.time + COOLDOWN;
  enemy.bumps = (enemy.bumps || 0) + 1;

  /* Удар: отбросить и сбить с ног. */
  p.vx = ux * -SHOVE_SPEED;
  p.vy = uy * -SHOVE_SPEED;
  p.stun = SHOVE_STUN;
  p.stack = [];
  p.charging = null;
  p.chargeLeft = 0;
  enemy.angle = Math.atan2(-uy, -ux);
  enemy.swing = 0.16;
  world.fx.shake = Math.max(world.fx.shake, 4);

  if (!repeat) {
    /* Подозрение: развернулся и идёт посмотреть, без тревоги. */
    enemy.state = 'alert';
    enemy.heard = { x: p.x, y: p.y, origin: { x: p.x, y: p.y, source: 'shove' } };
    enemy.think = 0;
    world.events.push({ type: 'shoved', x: enemy.x, y: enemy.y, repeat: false, bumps: enemy.bumps });
    return;
  }

  /* Второй раз — бьёт всерьёз: погоня, крик, ТРЕВОГА с местом игрока. */
  enemy.state = 'chase';
  enemy.lost = 0;
  emitNoise(world, enemy.x, enemy.y, 240, 'shout');
  world.events.push({ type: 'shoved', x: enemy.x, y: enemy.y, repeat: true, bumps: enemy.bumps });
  world.events.push({ type: 'spot', x: enemy.x, y: enemy.y, cause: 'shove' });
  noteAlarm(world, 'spot', p.x, p.y);
}

/*
 * Сбитый с ног: летит, тормозит, не управляется. Зовётся из updatePlayer
 * вместо обычного шага, пока `stun` не истёк. Возвращает true, если шаг
 * съеден оглушением.
 */
export function stunnedStep(world, dt, moveBody) {
  const p = world.player;
  if (!((p.stun || 0) > 0)) return false;
  p.stun = Math.max(0, p.stun - dt);
  const drag = Math.pow(0.9, dt * 60);
  p.vx *= drag;
  p.vy *= drag;
  moveBody(world, p, p.vx * dt, p.vy * dt);
  return true;
}
