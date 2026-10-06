/*
 * ОПАСНАЯ ЗОНА — где ляжет набранное заклинание, одной копией на оба вида
 * =========================================================
 * До 03.10 эта формула жила внутри render.js (createRenderer, замыкание)
 * и была никому больше не нужна. С изометрией (src/view3d/igra.js) тот же
 * круг рисуют два вида, и две копии формулы однажды разошлись бы: плоский
 * вид показывал бы один радиус, объёмный — другой, и игрок умирал бы в
 * круге, который на его экране «не доставал» (свод, п.27: правка в одной
 * из копий — не сделана). Поэтому формула вынесена сюда как есть, байт в
 * байт по смыслу, и render.js берёт её отсюда же.
 *
 * Разбор, зачем круг вообще, остался в render.js у drawDanger.
 */

import { TILE, TILE_SIZE } from './level.js';
import { BODY } from './world.js';
import { spellOf } from './magic.js';

export function dangerZone(world) {
  const player = world.player;
  if (!player.stack || !player.stack.length) return null;

  const spell = spellOf(player.stack);
  if (!spell || !spell.form) return null;

  const reach = spell.substance.traits.reach || 1;
  const burns = Boolean(spell.substance.traits.burn);

  /* Вспышка бьёт от себя — центр всегда на игроке. */
  if (spell.form.kind === 'nova') {
    return {
      x: player.x, y: player.y,
      r: (spell.form.radius || 104) * reach,
      colour: spell.substance.colour, burns, self: true,
    };
  }

  /* Остальное прилетает туда, куда смотрит прицел. Точку берём по
     захваченной цели, а без неё — по лучу, как летел бы снаряд. */
  const aim = world.locked
    ? { x: world.locked.x, y: world.locked.y }
    : rayEnd(world, player.x, player.y, player.angle, 320 * reach);

  const r = TILE_SIZE * 0.9 * reach * (burns ? 1.7 : 1);
  return {
    x: aim.x, y: aim.y, r,
    colour: spell.substance.colour, burns,
    self: Math.hypot(aim.x - player.x, aim.y - player.y) < r + BODY,
  };
}

/* Докуда долетит: шагаем тем же шагом, что и снаряд. */
function rayEnd(world, x, y, angle, limit) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  for (let t = 6; t < limit; t += 6) {
    const nx = x + dx * t;
    const ny = y + dy * t;
    const tile = world.tiles[tileRangeIndex(world, nx, ny)];
    if (tile === TILE.WALL) return { x: x + dx * (t - 6), y: y + dy * (t - 6) };
  }
  return { x: x + dx * limit, y: y + dy * limit };
}

function tileRangeIndex(world, x, y) {
  const tx = Math.max(0, Math.min(world.w - 1, (x / TILE_SIZE) | 0));
  const ty = Math.max(0, Math.min(world.h - 1, (y / TILE_SIZE) | 0));
  return ty * world.w + tx;
}
