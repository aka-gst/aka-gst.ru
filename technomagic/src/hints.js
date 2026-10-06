/*
 * СТРОКИ ПОДСКАЗОК, КОТОРЫЕ ЗАВИСЯТ ОТ ЭТАЖА
 * =========================================================
 * Собраны здесь, а не в main.js, по одной причине: их можно проверить в
 * Node. «СНАЧАЛА НАБЕРИ» до 03.10 была зашита строкой со всеми пятью
 * стихиями и слэшем вместо шифта — молния переехала на ⇧ давно, а
 * строка продолжала врать, и заметить это было некому: строку в
 * main.js прогон не видит.
 *
 * Клавиши и имена берутся из самих стихий (magic.js), список — из того,
 * что этаж дал прямо сейчас (world.elements), а не что обещал на старте.
 */

import { ELEMENTS, ELEMENT_ORDER } from './magic.js';

/* Порядок — порядок клавиш, а не порядок выдачи: ← ↑ → ↓ ⇧. */
export function givenInOrder(elements) {
  return ELEMENT_ORDER.filter((id) => (elements || ELEMENT_ORDER).includes(id));
}

export function dryHint(elements, touch = false) {
  if (touch) return 'СНАЧАЛА НАБЕРИ СТИХИЮ КНОПКОЙ ВНИЗУ';
  const list = givenInOrder(elements).map((id) => `${ELEMENTS[id].key} ${ELEMENTS[id].name}`);
  return `СНАЧАЛА НАБЕРИ: ${list.join(' ')}`;
}

/* Закрытая стихия: «ещё впереди» или «не на этом этаже». */
export function lockedHint(element, later) {
  const name = ELEMENTS[element].name;
  return later ? `${name} ЕЩЁ НЕ ОТКРЫТА — ЖДЁТ ВПЕРЕДИ` : `${name} — НЕ НА ЭТОМ ЭТАЖЕ`;
}

/* Рук меньше трёх, и очередь полна. */
export function stackFullHint(limit) {
  return limit === 1
    ? 'ПОКА ОДНА РУКА — ВТОРАЯ ВПЕРЕДИ'
    : 'ПОКА ДВЕ РУКИ — ТРЕТЬЯ ВПЕРЕДИ';
}

/*
 * Клавиша монеты (слой «б»). Одна строка на подпись кнопки, подсказку
 * «МОНЕТА: ОТВЛЕКИ ЗВОНОМ» и проверку: main.js читает её как
 * input.tookKey('KeyE'), и tests/nuzhda.mjs держит, что код и подпись
 * не разошлись.
 */
export const COIN_KEY = 'E';
