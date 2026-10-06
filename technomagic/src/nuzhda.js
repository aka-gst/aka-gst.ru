/*
 * ПОДСКАЗКА В МОМЕНТ НУЖДЫ: СВЕТ И МОНЕТА (слой «б», 03.10.2026)
 * =========================================================
 * Свод, п.11: подсказка приходит в момент нужды, а не списком на старте;
 * п.9: она обязана ответить на действие. Слово этих двух подсказок и
 * ответ на действие — ступени src/lestnica.js (STEPS.svet, STEPS.moneta),
 * то есть та же лестничная подсказка с целью в мире (world.hint: кольцо на
 * цели или стрелка у края). Здесь — только КОГДА: чистые вопросы к миру,
 * которые main.js задаёт каждый кадр, а Node — в tests/nuzhda.mjs.
 *
 *   svet    игрок стоит в свете ЛАМПЫ (не огня: огонь водой не погасить
 *           одной строкой подсказки), и рядом страж, которому до него
 *           есть прямая видимость, — именно свет сейчас решает, увидят
 *           ли его. Совет — вода гасит лампу; цель — эта лампа.
 *   moneta  в кармане есть монета, и спокойный страж на посту смотрит
 *           прямо на игрока ближе шести клеток — пост перекрывает дорогу.
 *           Совет — монета; цель — этот страж.
 *
 * Каждая — один раз за попытку (needs.shown), и только когда лестница
 * молчит: своя ступень лестницы важнее совета.
 */

import { illumination, lightOn } from './vendor/stels-ii@1.0.0/light.js';
import { sightReach, angleDiff } from './vendor/stels-ii@1.0.0/vision.js';
import { sightMul } from './vendor/stels-ii@1.0.0/alarm.js';
import { GUARD, LIGHT } from './vendor/stels-ii@1.0.0/tuning.js';
import { hasSight, TILE_SIZE } from './world.js';

/* Пост «перекрывает дорогу», если стоит ближе стольких клеток. */
export const POST_CELLS = 6;

export function createNeeds() {
  return { shown: new Set() };
}

const awake = (e) => e.alive && !(e.downed > 0);

/* Лампа, которая светит на игрока сильнее остальных, если её свет не
   ниже порога «в тени» (LIGHT.hidden МГС). */
export function lampToDouse(world) {
  if (!world.lights) return null;
  const p = world.player;
  let best = null;
  let bestLit = LIGHT.hidden;
  for (const lamp of world.lights) {
    if (!lightOn(lamp)) continue;
    const lit = illumination(world, [lamp], p.x, p.y);
    if (lit >= bestLit) { best = lamp; bestLit = lit; }
  }
  return best;
}

/* Страж, которому до игрока есть прямая видимость в пределах полной
   дальности взгляда (на свету). Не в погоне: там советовать поздно. */
function guardNear(world) {
  const p = world.player;
  const mul = world.trevoga ? sightMul(world.trevoga) : 1;
  const reach = sightReach(1, mul);
  return world.enemies.find((e) => awake(e) && e.state !== 'chase'
    && Math.hypot(e.x - p.x, e.y - p.y) <= reach && hasSight(world, e.x, e.y, p.x, p.y)) || null;
}

/* Спокойный страж на посту, в чьём конусе (55° МГС) игрок ближе
   POST_CELLS клеток и виден напрямую. */
export function blockingPost(world) {
  const p = world.player;
  return world.enemies.find((e) => {
    if (!awake(e) || e.state !== 'idle' || !e.post) return false;
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    if (d > POST_CELLS * TILE_SIZE || d < 1) return false;
    if (Math.abs(angleDiff(Math.atan2(p.y - e.y, p.x - e.x), e.angle)) > GUARD.half) return false;
    return hasSight(world, e.x, e.y, p.x, p.y);
  }) || null;
}

/* Какой совет нужен сейчас: 'svet', 'moneta' или null. Ничего не
   помечает — показанным совет делает тот, кто его показал. */
export function needNow(needs, world) {
  if (!world.trevoga || world.state !== 'play' || !world.player.alive) return null;
  if (!needs.shown.has('svet') && (world.elements || []).includes('water')
    && lampToDouse(world) && guardNear(world)) return 'svet';
  if (!needs.shown.has('moneta') && world.coins && world.coinsLeft > 0 && blockingPost(world)) return 'moneta';
  return null;
}
