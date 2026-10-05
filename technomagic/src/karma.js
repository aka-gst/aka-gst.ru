/*
 * КАРМА (отзыв Сергея 04.10, п.19)
 * =========================================================
 * «Мир: монстров (плохих) можно убивать; за убийство людей и хороших
 * существ — карма (как в каноне Глубины §12)».
 *
 * Канон — design bible «Глубины» (dev/_games/neon-abyss/docs/
 * NEON_ABYSS_FULL_VISION_HISTORY.md, он же Game/Sources/neon-abyss в
 * dev/_games/glubina), раздел 12 «Свидетели и слухи»: репутация не
 * меняется магически глобально; событие увидел NPC → выжил → дошёл →
 * рассказал → слух пошёл дальше → конкретные люди начали реагировать;
 * репутация живёт на уровне фракции, поселения и отдельного человека.
 *
 * Отсюда устройство:
 *
 *   кто плохой   враги этажа (world.enemies: громилы, заклинатели,
 *                щитоносцы) — «монстры»: убивать можно, карма не
 *                меняется. Закон (свидетель донёс страже → розыск,
 *                vospriyatie/svideteli.js) — отдельно и как был.
 *   кто хороший  жители и мирные (world.civilians, заложник) — их смерть
 *                от рук игрока пишется в карму: `score` −1 за жизнь и
 *                запись `deeds` (кто, когда, кто видел).
 *   кто знает    не все сразу. Знает тот житель, кто ВИДЕЛ (тот же конус
 *                со светом, что у свидетелей: ночью в тени убийство не
 *                видно), или кому РАССКАЗАЛ знающий — слух идёт от
 *                человека к человеку, когда двое оказались рядом и видят
 *                друг друга (RUMOUR_REACH). Знание у каждого своё:
 *                `known[id] = 'saw' | 'heard'`.
 *   последствие  знающий с тобой не говорит («Ты убил … Не подходи.») и
 *                его задание проваливается (zhiteli.js: refuse 'karma',
 *                провал с why 'karma'). Незнающий говорит как раньше:
 *                кровь на тебе есть (`score`), но мир о ней не знает.
 *
 * Модуль чистый: состояние — простой объект в мире (кольцо его снимает и
 * возвращает вместе с миром, src/kolco.js), события — в world.events.
 * Для экрана: `world.karma.score`, `world.karma.known`, события `karma`
 * (жизнь на совести: кто, сколько видело) и `rumour` (слух дошёл до
 * жителя).
 */

import { TILE_SIZE } from './level.js';
import { hasSight } from './world.js';
import { canSee } from './vospriyatie/vision.js';
import { litAt } from './vospriyatie/svet.js';

/* Цена одной хорошей жизни. */
export const LIFE_COST = 1;
/* Слышал своими ушами: ближе этого убийство знают и не видя. */
export const HEAR_REACH = 2 * TILE_SIZE;
/* Рассказать можно тому, кто в паре шагов и кого видишь. */
export const RUMOUR_REACH = 3 * TILE_SIZE;
/* Без дозора (старые этажи) «видел» — прямая видимость на это расстояние. */
const PLAIN_SIGHT = 300;

export function createKarma() {
  return { score: 0, deeds: [], known: {} };
}

const residentId = (civ) => (civ && civ.resident ? civ.resident.id : null);
const awake = (civ) => civ && civ.alive && !(civ.downed > 0);

/* Видел ли житель точку (место смерти). */
function sawPoint(world, civ, x, y) {
  const d = Math.hypot(civ.x - x, civ.y - y);
  if (d <= HEAR_REACH) return true;
  if (world.trevoga) {
    return canSee(world, { x: civ.x, y: civ.y, angle: civ.angle || 0 }, { x, y, lit: litAt(world, x, y) });
  }
  return d <= PLAIN_SIGHT && hasSight(world, civ.x, civ.y, x, y);
}

/*
 * Убийство хорошего — смерть мирного не от врага. Причина `enemy`
 * зарезервирована под смерть от чужой руки: сейчас мирных бьёт только
 * игрок и то, что он поджёг, — но правило пишется заранее, чтобы чужая
 * пуля не легла на совесть игрока, когда она появится.
 */
export function isGoodDeath(event) {
  return event.type === 'neutral-death' && event.cause !== 'enemy';
}

/* Шаг: смерти кадра → карма и знание; знающие рассказывают. */
export function stepKarma(world) {
  const karma = world.karma;
  if (!karma) return;
  const civs = world.civilians || [];

  for (const event of [...world.events]) {
    if (!isGoodDeath(event)) continue;
    karma.score -= LIFE_COST;
    const seenBy = [];
    for (const civ of civs) {
      const id = residentId(civ);
      if (!id || id === event.id || !awake(civ)) continue;
      if (!sawPoint(world, civ, event.x, event.y)) continue;
      seenBy.push(id);
      karma.known[id] = 'saw';
    }
    karma.deeds.push({ t: world.time, kind: event.kind, id: event.id || null, seenBy });
    world.events.push({
      type: 'karma', delta: -LIFE_COST, score: karma.score, victim: event.id || event.kind,
      seen: seenBy.length, x: event.x, y: event.y,
    });
  }

  /* Слух: знающий на ногах рассказывает соседу, которого видит. Один
     шаг за кадр — передача не прыгает через весь двор в один миг. */
  const told = [];
  for (const from of civs) {
    const a = residentId(from);
    if (!a || !karma.known[a] || !awake(from)) continue;
    for (const to of civs) {
      const b = residentId(to);
      if (!b || b === a || karma.known[b] || !awake(to)) continue;
      if (Math.hypot(from.x - to.x, from.y - to.y) > RUMOUR_REACH) continue;
      if (!hasSight(world, from.x, from.y, to.x, to.y)) continue;
      told.push([a, b]);
    }
  }
  for (const [a, b] of told) {
    if (karma.known[b]) continue;
    karma.known[b] = 'heard';
    world.events.push({ type: 'rumour', from: a, to: b });
  }
}

/* Знает ли этот житель, что на тебе хорошая кровь. */
export function knowsBlood(world, civ) {
  const id = residentId(civ);
  return Boolean(id && world.karma && world.karma.known[id]);
}
