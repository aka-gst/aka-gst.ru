/*
 * Стенд урока: то, что делает написанный код, видно на самой машине.
 *
 * Замысел простой и общий для всех задач, а не по одной сцене на урок — иначе
 * сорок восемь задач превратились бы в сорок восемь мультиков, которые никто
 * не станет поддерживать. Правило одно:
 *
 *   каждая напечатанная строка выходит на лобовое стекло и моргает поворотником.
 *
 * Отсюда бесплатно получается всё остальное. Задача на print — на стекле
 * появляется твоя строка. Задача на цикл — поворотник моргает столько раз,
 * сколько прошёл цикл. Число — стрелка приборов уходит на его величину.
 * True или False — загорается зелёная или красная лампа допуска. Ошибка —
 * загорается check engine.
 *
 * Никакой настройки в уроках это не требует: механизм читает обычный вывод
 * программы, тот же, что видно в терминале.
 */

import { el } from './dom.js';
import { activeTheme } from './../content/themes.js';
import { scene } from './pingcar.js';
import { incidentForRun } from './incident-feed.js';

/*
 * Русские числительные. Тернарник «одно или много» здесь не работает: выходит
 * «4 рывков» и «1 раза», и это первое, за что цепляется глаз. Правило то же,
 * что в языке: одиннадцать — двадцать один особые.
 */
function plural(n, one, few, many) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  const mod10 = n % 10;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

let timers = [];
/* Последний проигранный запуск. Успешное решение перерисовывает урок целиком,
   и стенд создавался заново пустым — награда пропадала ровно в тот момент,
   ради которого она и сделана. Помним результат и возвращаем его на место
   после отрисовки, без повторной анимации: второй раз моргать нечему. */
let last = null;

function clearTimers() {
  timers.forEach(clearTimeout);
  timers = [];
}

const at = (ms, fn) => timers.push(setTimeout(fn, ms));

/*
 * Слова стенда у историй разные, приборы одни и те же. В боксе моргает
 * поворотник и натягивается лебёдка, в сети уходят пакеты и идёт подбор —
 * но считает это одно и то же место в коде.
 */
const CAPS = {
  garage: {
    one: 'на стекло вышла строка',
    many: (n, p) => `поворотник моргнул ${n} ${p(n, 'раз', 'раза', 'раз')}`,
    list: (n) => `список · ${n}`,
    dash: 'приборная панель',
    winch: (n, p) => `лебёдка · ${n} ${p(n, 'рывок', 'рывка', 'рывков')}`,
    calls: 'вошло → вернулось',
    silent: 'тишина — программа ничего не вывела',
    fault: 'блок отказал',
  },
  ice: {
    one: 'ушёл один пакет',
    many: (n, p) => `по линии ушло ${n} ${p(n, 'пакет', 'пакета', 'пакетов')}`,
    list: (n) => `узлов в ответе · ${n}`,
    dash: 'журнал узла',
    winch: (n, p) => `подбор · ${n} ${p(n, 'попытка', 'попытки', 'попыток')}`,
    calls: 'запрос → ответ',
    silent: 'тишина — узел ничего не прислал',
    fault: 'связь оборвалась',
  },
};

const caps = () => CAPS[activeTheme().id] || CAPS.garage;

/** Панель стенда. Сцена берётся у истории: в боксе машина, в сети узел. */
export function standPanel() {
  const box = el('div', { class: 'stand' });
  box.innerHTML = scene();
  return el('div', { class: 'stand-wrap' }, [
    el('div', { class: 'stand-head' }, [
      el('span', { text: 'СТЕНД' }),
      el('small', { class: 'stand-note', text: 'что сделал твой код' }),
    ]),
    box,
    el('div', { class: 'stand-extra', hidden: true }),
    el('aside', { class: 'incident-feed', hidden: true, 'aria-live': 'polite' }),
  ]);
}

function renderIncident(feed, result) {
  const incident = incidentForRun({
    themeId: activeTheme().id,
    outcome: result.error ? 'error' : 'success',
  });
  if (!incident) {
    feed.hidden = true;
    feed.replaceChildren();
    return;
  }
  feed.replaceChildren(
    el('span', { class: 'incident-eyebrow', text: incident.eyebrow }),
    el('b', { text: incident.title }),
    el('p', { class: 'incident-lead', text: incident.lead }),
    el('p', { text: incident.fact }),
    el('p', { class: 'incident-defense', text: incident.defense }),
    el('a', {
      href: incident.sourceUrl,
      target: '_blank',
      rel: 'noopener',
      text: `${incident.sourceLabel} →`,
    }),
  );
  feed.hidden = false;
}

/*
 * Приборы под машиной. Какой показать — решает сам вывод, а не настройка в
 * уроке: словарь выглядит словарём, список списком, а про цикл while честнее
 * всего говорит исходник. Порядок важен, показываем один прибор: два сразу
 * превращают стенд в приборную свалку.
 */
const PY_PAIR = /['"]([^'"]+)['"]\s*:\s*([^,}]+)/g;

function splitTop(text) {
  const parts = [];
  let depth = 0;
  let start = 0;
  let quote = null;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) { if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if ('([{'.includes(ch)) depth += 1;
    else if (')]}'.includes(ch)) depth -= 1;
    else if (ch === ',' && depth === 0) { parts.push(text.slice(start, i)); start = i + 1; }
  }
  parts.push(text.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
}

function lamps(count) {
  return el('div', { class: 'st-lamps' }, [
    el('span', { class: 'st-cap', text: caps().list(count) }),
    el('div', { class: 'st-lamp-row' }, Array.from({ length: Math.min(count, 12) },
      () => el('i', { class: 'on' }))),
  ]);
}

function dashboard(pairs) {
  return el('div', { class: 'st-dash' }, [
    el('span', { class: 'st-cap', text: caps().dash }),
    ...pairs.slice(0, 4).map(([key, value]) => el('div', { class: 'st-row' }, [
      el('b', { text: key }), el('u', { text: value }),
    ])),
  ]);
}

function winch(steps) {
  return el('div', { class: 'st-winch' }, [
    el('span', { class: 'st-cap', text: caps().winch(steps, plural) }),
    el('div', { class: 'st-rope' }, el('i', { style: `width:${Math.min(100, steps * 14)}%` })),
  ]);
}

function calls(rows) {
  return el('div', { class: 'st-calls' }, [
    el('span', { class: 'st-cap', text: caps().calls }),
    ...rows.slice(0, 3).map(([input, output]) => el('div', { class: 'st-row' }, [
      el('b', { text: input }), el('u', { text: `→ ${output}` }),
    ])),
  ]);
}

function instrument(lines, result, source) {
  const last = lines[lines.length - 1] || '';

  if (/^\{.*\}$/.test(last)) {
    const pairs = [...last.matchAll(PY_PAIR)].map((m) => [m[1], m[2].trim()]);
    if (pairs.length) return dashboard(pairs);
  }
  if (/^\[.*\]$/.test(last)) {
    return lamps(splitTop(last.slice(1, -1)).length);
  }
  if (/\bwhile\b/.test(source) && lines.length) {
    return winch(lines.length);
  }
  const rows = (result.checks || [])
    .map((item) => /^(.+?) вернул (.+)$/.exec(item.detail || ''))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]);
  if (rows.length) return calls(rows);
  return null;
}

function hud(svg, text) {
  const node = svg.querySelector('.pc-hud text');
  if (!node) return;
  // На стекле помещается около сорока знаков; длинную строку обрезаем, а не
  // ужимаем шрифт: нечитаемая строка хуже обрезанной.
  node.textContent = text.length > 40 ? `${text.slice(0, 39)}…` : text;
}

/**
 * Проигрывает результат запуска на машине.
 * Берёт обычный вывод программы — тот же, что показан в терминале.
 */
export function standRestore() {
  if (last) standPlay(last.result, last.source, true);
}

export function standPlay(result, source = '', quiet = false) {
  const wrap = document.querySelector('.stand-wrap');
  if (!wrap) return;
  const svg = wrap.querySelector('svg');
  const note = wrap.querySelector('.stand-note');
  const extra = wrap.querySelector('.stand-extra');
  const feed = wrap.querySelector('.incident-feed');
  clearTimers();
  extra.hidden = true;
  extra.replaceChildren();
  last = { result, source };
  renderIncident(feed, result);
  svg.classList.remove('fault', 'ok', 'no', 'lights');

  if (result.error) {
    svg.classList.add('fault');
    hud(svg, result.error.type || 'ошибка');
    note.textContent = caps().fault;
    return;
  }

  const lines = (result.stdout || '').split('\n').filter((line) => line.trim() !== '');
  if (!lines.length) {
    hud(svg, caps().silent);
    note.textContent = 'ничего не пришло';
    return;
  }

  note.textContent = lines.length === 1 ? caps().one : caps().many(lines.length, plural);

  lines.forEach((line, index) => {
    const start = quiet ? 0 : index * 520;
    at(start, () => {
      hud(svg, line);
      svg.classList.add('blink');
      const value = Number(line.replace(',', '.'));
      if (Number.isFinite(value)) {
        // Стрелка идёт от нуля до упора: важно не точное значение, а то, что
        // число из кода двигает железо.
        svg.style.setProperty('--needle', `${Math.max(-1, Math.min(1, value / 200)) * 62}deg`);
      }
      const flag = line.trim();
      svg.classList.toggle('ok', flag === 'True');
      svg.classList.toggle('no', flag === 'False');
    });
    at(start + 240, () => svg.classList.remove('blink'));
  });

  // Прибор показываем после того, как строки отыграли: иначе он появляется
  // раньше причины и читается как что-то отдельное от кода.
  at(quiet ? 0 : lines.length * 520, () => {
    const node = instrument(lines, result, source);
    if (!node) return;
    extra.replaceChildren(node);
    extra.hidden = false;
  });
}
