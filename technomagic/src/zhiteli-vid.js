/*
 * ЖИТЕЛИ НА ЭКРАНЕ: ГОВОРИТЬ, ОТВЕЧАТЬ, ЖУРНАЛ (слой «г», 03.10.2026)
 * =========================================================
 * Логика жителей, разговоров и заданий — src/zhiteli.js, razgovory.js,
 * zadaniya.js (проверены в Node, tests/sloy-g.mjs). Здесь — только то,
 * что нужно экрану: чистые вопросы к миру и строки, без DOM и холста.
 * main.js, render.js и view3d/igra.js зовут их каждый кадр, а прогон в
 * Node — те же функции (tests/sloy-g-vid.mjs). Мир этот модуль не
 * меняет ни на бит.
 *
 * МИР НЕ СТОИТ, ПОКА ГОВОРИШЬ — решение слоя «г», как в Ultima Online:
 * полоса разговора лежит поверх идущей игры, стража смотрит, огонь
 * горит. Поэтому клавиши разговора не отбирают у боя ничего, кроме
 * цифр: стрелки и ⇧ набирают стихии и при открытой полосе.
 *
 * КЛАВИШИ
 *   F       говорить с тем, кто рядом; при открытой полосе — уйти.
 *           Свободна: WASD, стрелки, 1–5, ⇧, пробел, Enter, J, Q, ⌫, B,
 *           Tab, Esc, P, M, R, E и клавиши камеры заняты.
 *   1 2 3   при открытой полосе — ответ по номеру. Цифры 1–5 в бою —
 *           дубль стрелок для стихий; пока полоса открыта, цифры целиком
 *           принадлежат ей (лишняя цифра не делает ничего), а стихии
 *           набираются стрелками и ⇧, как и были. Кнопки стихий на
 *           экране шлют свои коды (input.js: ElemFire…), а не цифры,
 *           иначе палец на ОГНЕ при открытой полосе выбирал бы ответ.
 *   L       журнал заданий.
 */

import { sawCrime, residentOf, REPUTATION, WITNESS_PATIENCE } from './zhiteli.js';
import { SPOTS } from './lestnica.js';
import { TILE_SIZE } from './level.js';

export const TALK_KEY = 'F';
export const TALK_CODE = 'KeyF';
export const LOG_KEY = 'L';
export const LOG_CODE = 'KeyL';

/*
 * Поломка для проверки (п.6): `KEY_RULES.panelOwnsDigits = false` —
 * цифры при открытой полосе снова набирают стихии. Проверка «1 при
 * открытой полосе — ответ, а не огонь» обязана от этого покраснеть.
 */
export const KEY_RULES = { panelOwnsDigits: true };

/*
 * Куда идёт нажатая клавиша. `view` — то, что на полосе сейчас
 * (talkNow(world) или null), `chargeKeys` — таблица стихий main.js.
 * Ответ: { say: id } — ответ жителю; { charge: стихия } — набор;
 * { swallow: true } — цифра при открытой полосе без такого ответа;
 * null — клавиша не наша.
 */
export function keyRoute(code, view, chargeKeys) {
  const digit = /^Digit([1-9])$/.exec(code);
  if (digit && view && KEY_RULES.panelOwnsDigits) {
    const choice = view.choices[Number(digit[1]) - 1];
    return choice ? { say: choice.id } : { swallow: true };
  }
  if (chargeKeys[code]) return { charge: chargeKeys[code] };
  return null;
}

/*
 * Станет ли житель говорить. null — станет; иначе причина отказа тем же
 * словом, что у мира (zhiteli.js, REFUSALS): saw, hushed, wanted, alarm,
 * и своё — down (упал/мёртв) и none (не житель).
 *
 * Порядок — тот же, что в startTalk (zhiteli.js): бегущего свидетеля
 * догоняют и уговаривают, его не спрашивают про розыск. Копия правила
 * отказа — потому что у мира нет вопроса «станет ли говорить» без
 * попытки (попытка с видевшим зовёт стража). Что копия не разошлась с
 * миром, держит tests/sloy-g-vid.mjs: для каждого случая сверяется с
 * настоящей попыткой через update().
 */
export function talkWhy(world, civ) {
  if (!world || !world.zhiteli || !civ || !civ.resident) return 'none';
  if (!civ.alive || civ.downed > 0) return 'down';
  const w = civ.witness;
  if (w && w.state === 'run') return null;
  if (sawCrime(civ)) return 'saw';
  if (w && w.state === 'hushed') return 'hushed';
  if (world.zhiteli.wanted && REPUTATION.wanted) return 'wanted';
  if (world.trevoga && world.trevoga.state === 'alert') return 'alarm';
  return null;
}

/*
 * Метка «…» над головой: житель, который станет говорить, и не бегущий
 * свидетель — у того своя метка «!» (слой «в»). `mode`: 'talk' — с ним
 * сейчас разговор, 'near' — он в дальности разговора (кнопка горит),
 * 'idle' — просто готов поговорить.
 */
export function speechMarks(world, nearId = null) {
  const out = [];
  if (!world || !world.zhiteli) return out;
  const talking = world.zhiteli.talk ? world.zhiteli.talk.with : null;
  for (const civ of world.civilians || []) {
    if (!civ.resident) continue;
    if (civ.witness && civ.witness.state === 'run') continue;
    const id = civ.resident.id;
    if (id !== talking && talkWhy(world, civ) !== null) continue;
    out.push({ id, x: civ.x, y: civ.y, mode: id === talking ? 'talk' : id === nearId ? 'near' : 'idle' });
  }
  return out;
}

/* Подсказка у героя, когда рядом есть с кем говорить. */
export function talkPrompt(name, touch) {
  return touch ? `ГОВОРИТЬ · ${name}` : `ГОВОРИТЬ (${TALK_KEY}) · ${name}`;
}

/* Нажал «говорить», а рядом никого. */
export const NOBODY = 'НЕКОМУ — ПОДОЙДИ К ЖИТЕЛЮ С «…» НАД ГОЛОВОЙ';

/* Сколько ещё слушает догнанный свидетель (zhiteli.js, WITNESS_PATIENCE). */
export function patienceLeft(world) {
  const zh = world && world.zhiteli;
  if (!zh || !zh.talk) return null;
  const civ = residentOf(world, zh.talk.with);
  if (!civ || !civ.witness || civ.witness.state !== 'talk') return null;
  return Math.max(0, Math.ceil(WITNESS_PATIENCE - (world.time - zh.talkSince)));
}


/* =========================================================
   СТРОКИ СОБЫТИЙ
   =========================================================
   Каждое событие слоя «г» доходит до человека словом (п.10). Что
   сказать — здесь, а не в main.js: так строки проверяются в Node. */

const QUEST_TITLES = { yadro: 'ЯДРО ИЗ БАШНИ', molot: 'МОЛОТ КУЗНЕЦА', kletka: 'КЛЕТКА ДЕНИСА' };
const STATE_WORDS = { vzyato: 'ВЗЯТО', sdelano: 'СДЕЛАНО', provaleno: 'ПРОВАЛЕНО' };
const KIND_WORDS = { boi: 'БОЙ', skrytnost: 'СКРЫТНОСТЬ', hitrost: 'ХИТРОСТЬ СТИХИЯМИ', razgovor: 'РАЗГОВОР' };

/* «ЗАДАНИЕ: МОЛОТ КУЗНЕЦА — ВЗЯТО» и т. п. */
export function questToast(event) {
  if (!event || event.type !== 'quest') return null;
  const title = QUEST_TITLES[event.id] || String(event.id).toUpperCase();
  const word = STATE_WORDS[event.state];
  if (!word) return null;
  const how = event.state === 'sdelano' && KIND_WORDS[event.solution] ? ` (${KIND_WORDS[event.solution]})` : '';
  return `ЗАДАНИЕ: ${title} — ${word}${how}`;
}

const CLOSE_WORDS = {
  left: 'РАЗГОВОР ОБОРВАН — ТЫ ОТОШЁЛ',
  'ran-off': 'НЕ СТАЛ СЛУШАТЬ — БЕЖИТ ДОНОСИТЬ',
  alarm: 'ТРЕВОГА — НЕ ДО РАЗГОВОРОВ',
  gone: 'РАЗГОВОР ОБОРВАН',
};

/*
 * Строка на событие разговора и жителей, или null — сказать нечего.
 * `ctx.names` — имена жителей по id, `ctx.refusedSaw` — в этом же кадре
 * видевший отказал (тогда «страж позван» — его зов, а не враньё
 * Мефодия: других зовущих у мира нет).
 */
export function talkEventToast(event, ctx = {}) {
  const names = ctx.names || {};
  const name = (id) => names[id] || String(id || '').toUpperCase();
  switch (event.type) {
    case 'talk-refused': return ctx.line ? `${name(event.id)}: «${ctx.line}»` : `${name(event.id)} НЕ СТАЛ ГОВОРИТЬ`;
    case 'talk-close': return CLOSE_WORDS[event.why] || null;
    case 'guard-called': return ctx.refusedSaw ? 'ЖИТЕЛЬ ЗОВЁТ СТРАЖУ — УХОДИ' : 'МЕФОДИЙ КРИЧИТ СТРАЖУ: «У АМБАРА ШАРЯТСЯ!»';
    case 'errand': return event.what === 'hammer' ? 'СТРАЖ УШЁЛ — КУЗНЕЦ ПОШЁЛ ЗА МОЛОТОМ' : null;
    case 'item-taken': return event.what === 'molot' ? 'КУЗНЕЦ ЗАБРАЛ МОЛОТ' : null;
    case 'cell-opened': return 'КУЗНЕЦ СНЯЛ ПОЛЕ КЛЕТКИ КЛЮЧОМ';
    case 'released': return `${name(event.id)} НА СВОБОДЕ`;
    case 'hushed': return 'УГОВОРИЛ — НЕ ДОНЕСЁТ';
    case 'coins': return event.delta < 0
      ? `МОНЕТА ОТДАНА · В КАРМАНЕ ${event.left}`
      : `+${event.delta} МОНЕТЫ · В КАРМАНЕ ${event.left}`;
    default: return null;
  }
}


/* =========================================================
   ЖУРНАЛ
   ========================================================= */

const WHY_FAILED = {
  dead: 'ТОТ, КТО ПРОСИЛ, ПОГИБ',
  down: 'ТОТ, КТО ПРОСИЛ, БЕЗ СОЗНАНИЯ',
  saw: 'ОН ВИДЕЛ ТВОЁ ПРЕСТУПЛЕНИЕ',
  death: 'ТЫ ПОГИБ',
};

/*
 * Следующий шаг одной строкой — то, что житель уже сказал словами, а не
 * разгадка (п.12): кузнец сам говорит «уведи стража хоть на три шага»,
 * Денис — «поле от щитка на стене… или проси кузнеца».
 */
export function questNext(world, entry) {
  const zh = world && world.zhiteli;
  if (!zh || !entry) return '';
  if (entry.state === 'sdelano') return `СДЕЛАНО: ${entry.solutionName || ''}`.trim();
  if (entry.state === 'provaleno') {
    const why = zh.log.entries[entry.id] && zh.log.entries[entry.id].why;
    return `ПРОВАЛЕНО${why && WHY_FAILED[why] ? ` — ${WHY_FAILED[why]}` : ''}`;
  }
  if (entry.state !== 'vzyato') return '';
  if (entry.id === 'yadro') {
    return world.operation && world.operation.coreTaken
      ? 'ЯДРО У ТЕБЯ — НЕСИ К ВЫХОДУ У СТАРТА'
      : 'ЯДРО В ЗАЛЕ БАШНИ ЗА РВОМ — ВЫНЕСИ К ВЫХОДУ У СТАРТА';
  }
  if (entry.id === 'molot') {
    const smith = residentOf(world, 'kuznec');
    if (smith && smith.errand && smith.errand.what === 'hammer') return 'КУЗНЕЦ ПОШЁЛ ЗА МОЛОТОМ — НЕ МЕШАЙ';
    return 'УВЕДИ СТРАЖА ОТ ВОРОТ СТОРОЖКИ ХОТЬ НА ТРИ ШАГА';
  }
  if (entry.id === 'kletka') {
    const molot = zh.log.entries.molot;
    return molot && molot.state === 'sdelano'
      ? 'КУЗНЕЦ ТЕБЕ ДОЛЖЕН — ПОПРОСИ ОТКРЫТЬ КЛЕТКУ'
      : 'СНИМИ ПОЛЕ КЛЕТКИ: ЩИТОК НА СТЕНЕ ИЛИ КЛЮЧ КУЗНЕЦА';
  }
  return entry.brief || '';
}

const centreOf = ([x, y]) => ({ x: (x + 0.5) * TILE_SIZE, y: (y + 0.5) * TILE_SIZE });

/*
 * Цель задания для стрелки у края (src/ukazatel.js — та же геометрия,
 * что у подсказки ступени): молот, клетка, кузнец, ядро, выход. Только
 * у взятого задания; сделанное и проваленное никуда не ведёт.
 */
export function questTarget(world, id) {
  const zh = world && world.zhiteli;
  if (!zh || !zh.log.entries[id] || zh.log.entries[id].state !== 'vzyato') return null;
  if (id === 'yadro') {
    if (world.operation && world.operation.coreTaken) return { ...centreOf(SPOTS.exit), label: 'ВЫХОД' };
    const core = world.core || centreOf(SPOTS.core);
    return { x: core.x, y: core.y, label: 'ЯДРО' };
  }
  if (id === 'molot') {
    if (!zh.hammer || zh.hammer.taken) return null;
    return { x: zh.hammer.x, y: zh.hammer.y, label: 'МОЛОТ' };
  }
  if (id === 'kletka') {
    const molot = zh.log.entries.molot;
    const who = molot && molot.state === 'sdelano' ? residentOf(world, 'kuznec') : residentOf(world, 'denis');
    if (!who || !who.alive) return null;
    return { x: who.x, y: who.y, label: who.resident.id === 'kuznec' ? 'КУЗНЕЦ' : 'КЛЕТКА' };
  }
  return null;
}

/* Что показать в журнале: только задания, о которых игрок знает. */
export function knownQuests(log) {
  return (log || []).filter((q) => q.state !== 'ne-vzyato');
}
