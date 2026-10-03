/*
 * ТЕХНОМАГИЯ — помощь прицеливанию.
 *
 * Играть можно тремя разными телами: мышью, клавишами и пальцем. Точность
 * у них разная на порядок, а правила боя одни, поэтому прицел приходится
 * дотягивать — иначе клавиатура честно проигрывает мыши на ровном месте.
 *
 * Модуль ничего не знает про ввод и про экран: ему дают мир и угол, он
 * возвращает угол. Поэтому его проверяет прогон, а не глаз.
 */

import { hasSight, angleDelta, TILE_SIZE } from './world.js';
import { weakTo } from './level.js';
import { lightOn } from './vospriyatie/light.js';

/*
 * Помощь прицеливанию. Ширина сектора зависит от того, чем целятся:
 * мышь наводится точно и почти не нуждается в помощи, стрелки дают
 * всего восемь направлений, а бег — одно, и между ними зияют дыры,
 * в которые проваливается всё, что не строго по курсу.
 */
export const AIM_CONE = {
  mouse: 0.06,
  stick: 0.45,
  run: 0.7,
};

export function assistAim(world, angle, cone) {
  const player = world.player;
  let best = angle;
  let bestScore = Infinity;

  for (const enemy of world.enemies) {
    if (!enemy.alive) continue;
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 360) continue;

    const toEnemy = Math.atan2(dy, dx);
    const diff = Math.abs(angleDelta(angle, toEnemy));
    if (diff > cone) continue;
    if (!hasSight(world, player.x, player.y, enemy.x, enemy.y)) continue;

    /* Ближний важнее идеально соосного: бьют того, кто уже дышит в лицо. */
    const score = diff + dist / 1400;
    if (score >= bestScore) continue;
    bestScore = score;
    best = toEnemy;
  }

  return best;
}

/*
 * Стоя без единой нажатой клавиши, повернуться было нечем: прицел брался
 * только из движения. Поэтому вплотную подошедший враг сам притягивает
 * взгляд — иначе игра требует отбежать, чтобы ударить стоящего рядом.
 */
export function closeThreat(world, radius = 130) {
  const player = world.player;
  let angle = null;
  let best = radius;

  for (const enemy of world.enemies) {
    if (!enemy.alive) continue;
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist > best) continue;
    if (!hasSight(world, player.x, player.y, enemy.x, enemy.y)) continue;
    best = dist;
    angle = Math.atan2(dy, dx);
  }

  return angle;
}

/*
 * Есть ли цель под прицелом — для пальца: на телефоне наведённый стик
 * выпускает набранное сам, потому что целиться и жать одним и тем же
 * большим пальцем невозможно.
 */
export function hasTargetUnderAim(world, angle) {
  const player = world.player;

  for (const enemy of world.enemies) {
    if (!enemy.alive) continue;
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    if (Math.hypot(dx, dy) > 360) continue;
    if (Math.abs(angleDelta(angle, Math.atan2(dy, dx))) > 0.2) continue;
    if (!hasSight(world, player.x, player.y, enemy.x, enemy.y)) continue;
    return true;
  }

  return false;
}


/*
 * Захват цели.
 *
 * Доводка прицела помогает, только когда игрок уже смотрит примерно туда.
 * С клавиатуры «примерно туда» не получается: направление берётся из бега,
 * а бежать приходится в сторону. Поэтому при живой цели в комнате взгляд
 * держится за неё сам — как ствол за плечом, а не как курсор за мышью.
 *
 * Прежняя цель не бросается, пока жива и видна: иначе прицел прыгает
 * между двумя одинаково удобными врагами и промахивается по обоим.
 */
const LOCK_RANGE = 470;
const LOCK_KEEP = 520;

/*
 * Целью может быть не только живой. Бочку, валун и кристалл ломают тем же
 * заклинанием, что и врага, — а попасть по ним с клавиатуры было нельзя
 * вовсе: прицел держался за тела и на неподвижное не наводился никогда.
 * Обучалка при этом просила разбить бочку, и сделать это можно было только
 * мышью. Теперь предметы стоят в том же списке целей.
 *
 * Но стоят позади: пока в комнате есть живой, взгляд держится за живого —
 * иначе в бою прицел уезжал бы на скамейку. Переключает Tab.
 */
const PROP_PENALTY = 900;

function targetAt(world, index) {
  return {
    prop: index,
    x: ((index % world.w) + 0.5) * TILE_SIZE,
    y: (((index / world.w) | 0) + 0.5) * TILE_SIZE,
  };
}

function sameTarget(a, b) {
  if (!a || !b) return false;
  if (a.worldProp || b.worldProp) return a.worldProp === b.worldProp;
  if (a.prop !== undefined || b.prop !== undefined) return a.prop === b.prop;
  return a === b;
}

/* Живой ли ещё захват. Предмет «жив», пока цел: разбитый перестаёт быть
   целью в тот же кадр, и прицел уходит дальше сам. */
function alive(world, target) {
  if (!target) return false;
  /* Новую зажжённую свечу больше не предлагаем в списке, но уже
     выбранную сохраняем: игрок должен успеть прочитать смену состояния. */
  if (target.worldProp) return target.worldProp.kind === 'candle';
  if (target.prop !== undefined) return weakTo(world.tiles[target.prop]) !== null;
  return Boolean(target.alive);
}

function visible(world, target, limit) {
  if (!alive(world, target)) return false;

  const player = world.player;
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const dist = Math.hypot(dx, dy);
  if (dist > limit) return false;
  if (!dist) return true;

  /*
   * До предмета луч ведётся не до середины клетки, а до её лицевой
   * стороны. Иначе стог загораживает сам себя: проверка упирается в ту
   * самую клетку, в которую целятся, и объявляет её невидимой.
   *
   * Из-за этого нельзя было выбрать ни стог, ни валун, ни ящик — то есть
   * ровно те вещи, ради которых прицел по предметам и делался. Видно их
   * при этом было прекрасно.
   */
  const back = target.prop !== undefined || target.worldProp
    ? Math.min(dist - 1, TILE_SIZE * 0.7) : 0;
  const face = { x: target.x - (dx / dist) * back, y: target.y - (dy / dist) * back };

  return hasSight(world, player.x, player.y, face.x, face.y);
}

/* Все цели по порядку удобства: сначала живые, потом предметы. */
export function lockCandidates(world, facing, limit = LOCK_RANGE) {
  const player = world.player;
  const out = [];

  const add = (target, penalty) => {
    if (!visible(world, target, limit)) return;
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const off = Math.abs(angleDelta(facing, Math.atan2(dy, dx)));
    /* Ближе — важнее, но и разворачиваться на 180° ради лишнего метра глупо. */
    out.push({ target, score: Math.hypot(dx, dy) + off * 140 + penalty });
  };

  for (const enemy of world.enemies) add(enemy, 0);
  for (let i = 0; i < world.tiles.length; i += 1) {
    if (weakTo(world.tiles[i])) add(targetAt(world, i), PROP_PENALTY);
  }
  for (const prop of world.props || []) {
    if (prop.kind === 'candle' && !prop.lit) add({ worldProp: prop, x: prop.x, y: prop.y }, PROP_PENALTY);
  }

  return out.sort((a, b) => a.score - b.score).map((entry) => entry.target);
}

/*
 * Обновить выбранную руками цель. Она либо остаётся собой, либо исчезает —
 * подменять её на ближайшую нельзя: игрок целился в бочку, а удар ушёл бы
 * в того, кто рядом, и виноват был бы он.
 */
export function keepPicked(world, picked) {
  if (!picked) return null;
  const limit = Math.max(LOCK_KEEP, (world.viewRadius || 0) + 160);
  if (!visible(world, picked, limit)) return null;
  return picked.prop !== undefined ? targetAt(world, picked.prop) : picked;
}

export function lockTarget(world, previous, facing) {
  if (visible(world, previous, LOCK_KEEP)) {
    /* Предмет пересобирается каждый кадр, поэтому возвращаем свежий
       объект с теми же координатами, а не устаревший. */
    return previous.prop !== undefined ? targetAt(world, previous.prop) : previous;
  }
  return lockCandidates(world, facing)[0] || null;
}

/*
 * Цель под пальцем. Тап по полю выбирает то, что ближе всего к точке
 * касания, — живого или предмет, без разницы: половина игры в том, чтобы
 * ударить в бочку, а не в того, кто рядом с ней.
 *
 * Радиус щедрый намеренно. Палец толще курсора, и требовать от него
 * пиксельной точности значит требовать промахов.
 */
export function targetNear(world, x, y, reach = 90) {
  let best = null;
  let bestDist = reach;

  /*
   * Ткнуть можно во всё, что видно на экране. Автонаведение держится
   * ближнего круга нарочно — оно выбирает за игрока, и хватать цель через
   * полкарты ему не положено. Но когда игрок показал пальцем сам, ограничивать
   * его тем же кругом незачем: он именно этого и хотел — ударить дальнюю
   * бочку, стоя далеко.
   */
  const reachAll = Math.max(LOCK_RANGE, (world.viewRadius || 0) + 120);

  for (const target of lockCandidates(world, 0, reachAll)) {
    const dist = Math.hypot(target.x - x, target.y - y);
    if (dist >= bestDist) continue;
    bestDist = dist;
    best = target;
  }

  return best;
}

/*
 * ЦЕЛЬ ПОДСКАЗКИ ВМЕСТО БЛИЖНЕГО КРУГА
 * =========================================================
 * Приёмка 03.10, пункт 4. Щиток поля ядра — в 26 клетках от края зала, а
 * автонаводка держит ближний круг (LOCK_RANGE, 470 px ≈ 15 клеток): с
 * клавиатуры и без стика тройное с края зала уходило по взгляду, то есть
 * куда угодно, только не в щиток. Найти его глазами на телефоне, где
 * кадр берёт одиннадцать клеток, тоже нельзя.
 *
 * Поэтому, пока жива подсказка ступени с флагом `aim` (сейчас — только
 * тройная, src/lestnica.js) и игрок не целится сам, автонаводка смотрит на
 * её цель. «Сам» — это мышь, стик или выбранная тапом цель: те ветки в
 * main.js стоят раньше и сюда не доходят. Подсказка снята — правило
 * молчит, и наводка снова держит ближний круг.
 *
 * Одно исключение, и оно в пользу игрока: если на него уже идёт видимый
 * враг ближе 300 px, ближний круг важнее щитка — иначе прицел смотрит на
 * пропасть, пока громила бьёт в спину.
 *
 * Видимость — та же, что у предмета (visible выше): луч до лицевой
 * стороны щитка. Над пропастью взгляд и снаряд летят (blocksSight и
 * blocksShot её не держат), из-за стены — нет.
 */
/*
 * ЛАМПА — ТОЖЕ ЦЕЛЬ ПОДСКАЗКИ (приёмка слоя «б», 03.10). Совет «НА СВЕТУ
 * ТЕБЯ ВИДНО — ВОДА ГАСИТ ЛАМПУ» ставит цель на лампу (lestnica.js,
 * STEPS.svet), но флага `aim` у него нет — и наводка держала ближних
 * стражей: лампу «prohod» между двумя стражами пальцем было не погасить
 * вовсе (стик прилипал к стражу в 9° от лампы и бил его водой). Теперь
 * правило то же, что у щитка поля: пока жива подсказка, чья клетка —
 * горящая лампа, наводка смотрит на неё. Флаг ступени не нужен: лампа в
 * клетке цели и есть признак. Погасла — подсказка снята, правило молчит.
 *
 * Поломка для проверки (п.6): `HINT_AIM.lamps = false` — лампа снова не
 * цель, `HINT_AIM.stick = false` — стик снова не знает подсказки.
 * Проверки «стик берёт лампу» обязаны от этого покраснеть
 * (tests/sloy-g-vid.mjs).
 */
export const HINT_AIM = { lamps: true, stick: true };

function lampHinted(world, hint) {
  if (!HINT_AIM.lamps || !world.lights || !hint.cell) return false;
  const at = hint.cell[1] * world.w + hint.cell[0];
  return world.lights.some((lamp) => lamp.cell === at && lightOn(lamp));
}

export function hintAimTarget(world) {
  const hint = world.hint;
  if (!hint || !hint.target || !(hint.aim || lampHinted(world, hint))) return null;
  const target = { hint: hint.step, x: hint.target.x, y: hint.target.y };
  const player = world.player;
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const dist = Math.hypot(dx, dy);
  if (!dist) return target;
  const back = Math.min(dist - 1, TILE_SIZE * 0.7);
  if (!hasSight(world, player.x, player.y, target.x - (dx / dist) * back, target.y - (dy / dist) * back)) return null;
  return target;
}

function threatClose(world, radius = 300) {
  const player = world.player;
  return world.enemies.some((enemy) => enemy.alive && !(enemy.downed > 0) && enemy.state === 'chase'
    && Math.hypot(enemy.x - player.x, enemy.y - player.y) < radius
    && hasSight(world, player.x, player.y, enemy.x, enemy.y));
}

/*
 * Наводка, когда игрок не целится сам: клавиатура без мыши, палец без
 * стика. Вынесена из main.js сюда, чтобы прогон в Node звал её той же
 * дверью, что игра, — иначе проверка «наводка берёт щиток» проверяла бы
 * свою копию правила.
 *
 * Возвращает { locked, angle }: что держит прицел и куда смотреть. Без
 * подсказки — ровно прежнее поведение (захват, бег, ближняя угроза).
 */
export function keyboardAim(world, previous, facing, moveX = 0, moveY = 0) {
  const player = world.player;
  const hinted = hintAimTarget(world);
  const locked = hinted && !threatClose(world) ? hinted : lockTarget(world, previous, facing);
  if (locked) return { locked, angle: Math.atan2(locked.y - player.y, locked.x - player.x) };
  if (moveX || moveY) return { locked: null, angle: assistAim(world, Math.atan2(moveY, moveX), AIM_CONE.run) };
  return { locked: null, angle: closeThreat(world, player.stack.length ? 300 : 130) };
}

/*
 * Стик (палец): цель подсказки внутри конуса стика главнее стражей.
 * Палец целится сам, поэтому, в отличие от клавиатуры, цель подсказки
 * берётся, только когда стик и так смотрит в её сторону (AIM_CONE.stick):
 * отвёл в сторону — наводка прежняя, по живым. Угроза вплотную (как у
 * keyboardAim) — снова живые: прицел не смотрит на лампу, пока бьют.
 *
 * Возвращает { angle, hint }: hint — взятая цель подсказки или null.
 * main.js по ней же выпускает набранное сам, как по врагу под стиком
 * (hasTargetUnderAim): целиться и жать одним большим пальцем нельзя.
 */
export function stickAim(world, angle) {
  const player = world.player;
  const hinted = HINT_AIM.stick ? hintAimTarget(world) : null;
  if (hinted && !threatClose(world)) {
    const toHint = Math.atan2(hinted.y - player.y, hinted.x - player.x);
    if (Math.abs(angleDelta(angle, toHint)) <= AIM_CONE.stick) return { angle: toHint, hint: hinted };
  }
  return { angle: assistAim(world, angle, AIM_CONE.stick), hint: null };
}

/* Следующая цель по кругу. Один и тот же список, тот же порядок — значит
   Tab всегда идёт в одну сторону, а не прыгает случайно. */
export function cycleTarget(world, previous, facing) {
  const list = lockCandidates(world, facing);
  if (!list.length) return null;
  const at = list.findIndex((target) => sameTarget(target, previous));
  return list[(at + 1) % list.length];
}
