/*
 * ТЕХНОМАГИЯ — знамя нового навыка (отзыв Сергея 04.10, п.16:
 * «ТЫ УЗНАЛ НОВЫЙ НАВЫК — большими буквами»).
 *
 * До 05.10 ступень лестницы объявлялась той же плашкой, что новое
 * вещество: строка «ОТКРЫТА СТИХИЯ» 10 точек серым и имя крупно, 2.6 с.
 * Что это новый навык, а не очередная находка, по плашке не читалось.
 * Теперь на каждое событие мира `unlock` — крупное «ТЫ УЗНАЛ НОВЫЙ
 * НАВЫК», под ним имя и чем его взять (клавиша или кнопка), 1.8 с, по
 * центру, сквозь неё нажимается (pointer-events: none, style.css).
 *
 * Чистая функция: событие → что написать. Виды события сейчас два —
 * стихия (`kind: 'element'`) и рука (`kind: 'stack'`, size 2 или 3); если
 * мир заведёт новые (навыки стелса, уговоры), знамя не молчит и не
 * падает: имя берётся из события (name / label / skill), иначе «НОВЫЙ
 * НАВЫК». Проверка — tests/znamya.mjs.
 */

export const BANNER = { kicker: 'ТЫ УЗНАЛ НОВЫЙ НАВЫК', seconds: 1.8 };

const HANDS = {
  2: { name: 'ДВЕ СТИХИИ РАЗОМ', note: 'ТЕПЕРЬ ИХ МОЖНО СМЕШАТЬ' },
  3: { name: 'ТРИ СТИХИИ РАЗОМ', note: 'ЛУЧ, ПРОБОЙ, ВСПЫШКА' },
};

export function unlockBanner(event, elements = {}, touch = false) {
  if (!event || event.type !== 'unlock') return null;
  const base = { kicker: BANNER.kicker, seconds: BANNER.seconds };
  if (event.kind === 'element' && elements[event.element]) {
    const e = elements[event.element];
    return { ...base, name: e.name, colour: e.colour,
      note: touch ? `КНОПКА «${e.name}» ВНИЗУ` : `КЛАВИША ${e.key}` };
  }
  if (event.kind === 'stack' && HANDS[event.size]) {
    return { ...base, ...HANDS[event.size], colour: '#ffe14d' };
  }
  const named = event.name || event.label || event.skill || event.element || '';
  return { ...base, name: String(named || 'НОВЫЙ НАВЫК').toUpperCase(), note: String(event.note || ''), colour: event.colour || '#ffe14d' };
}
