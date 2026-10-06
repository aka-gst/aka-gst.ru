/*
 * ОТДЕЛЬНЫЕ ВХОДЫ
 * =========================================================
 * Этажи, которые не стоят в кампании и не приходят кодом, а открываются
 * словом в адресе — `?lestnica` или `#lestnica`, `?pesochnitsa` или
 * `#pesochnitsa`. Кампания при этом не меняется: CAMPAIGN[0] остаётся
 * операцией «Ядро», восемь старых этажей и их коды — какими были.
 *
 *   lestnica     «Башня» — одиночные → двойные → тройные (src/lestnica.js)
 *   pesochnitsa  «Пять стихий» — песочница 22.09 на шесть станций по
 *                одной стихии (src/element-sandbox.js). До 03.10 её
 *                импортировали только тесты: в игре её не было вовсе.
 *
 * Разбор адреса — здесь, без DOM, чтобы его проверял прогон в Node, а
 * не глаз в браузере.
 */

import { LESTNICA } from './lestnica.js';
import { ELEMENT_SANDBOX } from './element-sandbox.js';

const ENTRIES = {
  lestnica: { words: ['lestnica', 'лестница'], level: () => LESTNICA },
  pesochnitsa: { words: ['pesochnitsa', 'песочница'], level: () => ELEMENT_SANDBOX },
};

/*
 * Какой вход назван в адресе, или null. Слово должно стоять отдельным
 * параметром: `?lestnica`, `?lestnica=1`, `#lestnica`, `&lestnica` — да;
 * `?xlestnica` — нет. Кириллица в адресе приходит закодированной, поэтому
 * строка сперва раскодируется, а битая кодировка не роняет разбор.
 */
export function pickEntry(search = '', hash = '') {
  let text = `${search || ''}${hash || ''}`;
  try { text = decodeURIComponent(text); } catch (error) { /* оставить как есть */ }

  for (const [name, entry] of Object.entries(ENTRIES)) {
    for (const word of entry.words) {
      const pattern = new RegExp(`(^|[?&#])${word}([=&#]|$)`, 'i');
      if (pattern.test(text)) return name;
    }
  }
  return null;
}

export function entryLevel(name) {
  const entry = ENTRIES[name];
  return entry ? entry.level() : null;
}
