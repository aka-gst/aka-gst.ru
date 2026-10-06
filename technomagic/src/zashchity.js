/*
 * ТЕХНОМАГИЯ — защиты врага на экране (отзыв Сергея 04.10, п.18:
 * «непонятно, какие заклинания против каких противников: показывать
 * защиты»).
 *
 * До 05.10 защита щитоносца читалась только кольцом его цвета на полу и
 * цветом щита — «этим цветом не бей» надо было знать заранее. Теперь над
 * головой каждого врага с защитой — щиток со знаком стихии (ОГ, ВД…) её
 * цветом, по одному на стихию; у врага под прицелом — словами.
 *
 * Откуда брать защиты: сейчас мир держит одну — `enemy.resist` (имя
 * стихии или null, world.js). Соседний проход по логике (отзыв, п.18 —
 * «убил огнём одного — второй уже защищён») может завести несколько или
 * выученные. Поэтому читается всё, что похоже на список стихий, и
 * незнакомое молча отбрасывается — щиток не врёт и не падает:
 *   resist: 'fire' | ['fire', 'wind'] | Set | { fire: 1, wind: 0 }
 *   resists / adapted / learned — так же.
 *   gear — снаряжение (05.10: мокрый плащ со склада, src/podgotovka.js;
 *   мир держит ['fire'], пока плащ мокрый, и null, когда высох).
 * Проверка — tests/zashchity.mjs.
 */

const FIELDS = ['resist', 'resists', 'adapted', 'learned', 'gear'];

function idsOf(value) {
  if (!value) return [];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value) || value instanceof Set) return [...value].filter((v) => typeof v === 'string');
  if (typeof value === 'object') return Object.keys(value).filter((k) => value[k]);
  return [];
}

export function resistList(enemy, elements) {
  if (!enemy) return [];
  const out = [];
  for (const field of FIELDS) {
    for (const id of idsOf(enemy[field])) if (elements[id] && !out.includes(id)) out.push(id);
  }
  return out;
}

/* Подпись под прицелом: «НЕ БЕРЁТ: ОГОНЬ, ВЕТЕР». */
export function resistWords(ids, elements) {
  return ids.length ? `НЕ БЕРЁТ: ${ids.map((id) => elements[id].name).join(', ')}` : '';
}
