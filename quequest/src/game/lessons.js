// 18.1: the lessons after `if` — for, while, def — on mini-python, with the
// floors of canon §13. Pure: what the panels mean and how typed code is
// judged. hour-desk.js draws them; model.js moves the world.
import { run, normalizeSource } from './mini-python.js';
import { QUEUE_ARRIVE_AFTER, QUEUE_START } from './config.js';

const diag = (message, fix, code) => ({ line: 1, col: 1, endCol: 3, message, fix, code });

// The arm that takes boxes by value: arm.take(box). Maps each take to the
// next not-yet-taken box of that colour in iteration order, so the world can
// move the exact crates.
function makeArm(pool, onTake = () => {}) {
  const taken = new Set();
  return {
    taken,
    arm: {
      take(box) {
        if (box === undefined) throw Object.assign(new Error('take'), { pyMessage: 'Рука не знает, какой ящик брать.', fix: 'Передай ящик в скобках: arm.take(box)' });
        const idx = pool.findIndex((c, i) => c === box && !taken.has(i));
        if (idx < 0) throw Object.assign(new Error('take'), { pyMessage: `Такого ящика тут нет: ${JSON.stringify(box)}.`, fix: 'Бери тот ящик, что сейчас в цикле: arm.take(box)' });
        taken.add(idx); onTake(idx);
        return null;
      },
    },
  };
}

// ------------------------------------------------------------------ FOR --
export const FOR_PANEL = Object.freeze({
  question: 'Сколько раз рука повторит «взять ящик»?',
  options: Object.freeze([['once', '1 РАЗ'], ['three', '3 РАЗА'], ['each', 'ДЛЯ КАЖДОГО В ПАРТИИ']]),
});
export function judgeForPanel(choice, batchSize) {
  if (choice === 'each') return { ok: true, text: `Рука повторит для каждого — все ${batchSize}, сколько бы их ни было.` };
  const n = choice === 'once' ? 1 : 3;
  return { ok: false, text: `Рука взяла ${n} — и встала. В партии ${batchSize}: ${batchSize - n} остались. Завтра партия будет другого размера.` };
}

export function runForLesson(source, colors, { needIf = false } = {}) {
  const pool = [...colors];
  const { arm, taken } = makeArm(pool);
  const r = run(source, { env: { boxes: [...colors], arm } });
  if (!r.ok) return { ok: false, diagnostics: r.diagnostics, taken: [] };
  const text = normalizeSource(source);
  const usesFor = /^\s*for\s+\w+\s+in\b/m.test(text);
  const picked = [...taken].sort((a, b) => a - b);
  const tookRed = picked.some((i) => pool[i] === 'red');
  const whites = pool.map((c, i) => (c === 'white' ? i : -1)).filter((i) => i >= 0);
  if (!usesFor) return { ok: false, taken: picked, diagnostics: [diag(`Без повтора рука взяла ${picked.length} из ${pool.length}. Писать arm.take столько раз — не вариант: партии каждый раз разные.`, 'Скажи «для каждого»: for box in boxes:', 'no-for')] };
  if (tookRed) return { ok: false, taken: picked, diagnostics: [diag('Рука унесла красный — штраф.', needIf ? 'Внутри for поставь проверку: if box == "white":' : 'В этой партии красных нет — проверь, откуда он.', 'took-red')] };
  if (whites.some((i) => !taken.has(i))) return { ok: false, taken: picked, diagnostics: [diag('Не все белые ящики уехали.', 'Внутри for (с отступом) дай команду: arm.take(box)', 'left-white')] };
  if (needIf && !/^\s+if\b/m.test(text)) return { ok: false, taken: picked, diagnostics: [diag('Здесь есть красные — правило должно спрашивать про цвет.', 'Внутри for: if box == "white":', 'no-if')] };
  return { ok: true, taken: picked, diagnostics: [] };
}

// ---------------------------------------------------------------- WHILE --
export const WHILE_PANEL = Object.freeze({
  question: 'Сколько работать ночью? Ящики ещё приезжают.',
  options: Object.freeze([['five', '5 РАЗ'], ['ten', '10 РАЗ'], ['until', 'ПОКА ОЧЕРЕДЬ НЕ ПУСТА']]),
});
export function judgeWhilePanel(choice, total) {
  if (choice === 'until') return { ok: true, text: 'Рука работает, пока в очереди что-то есть, — и сама останавливается на пустой.' };
  const n = choice === 'five' ? 5 : 10;
  return n < total
    ? { ok: false, text: `Рука сделала ${n} и ушла спать, а ящики всё ехали. Утром — гора.` }
    : { ok: false, text: `Рука взяла всё и ещё ${n - total} раз махнула в пустоту. Ночью это ${n - total} лишних кругов и шум. Заранее число не угадать.` };
}

// queue starts with QUEUE_START crates; the rest arrive after QUEUE_ARRIVE_AFTER pops.
// The code sees a list of colours; behind it every item knows which crate it is.
export function runWhileLesson(source, colors) {
  const items = colors.map((color, i) => ({ color, i }));
  const q = items.slice(0, QUEUE_START);
  let pops = 0; let arrived = false; let current = null;
  const taken = new Set();
  const err = (pyMessage, fix) => Object.assign(new Error(pyMessage), { pyMessage, fix });
  const queue = {
    pop(i = -1) {
      if (!q.length) throw err('Очередь пуста — брать нечего.', 'Бери, только пока очередь не пуста: while queue:');
      const idx = i < 0 ? q.length + i : i;
      if (idx < 0 || idx >= q.length) throw err(`В очереди нет места номер ${i}.`, 'Первый в очереди — номер 0: queue.pop(0)');
      const [it] = q.splice(idx, 1);
      current = it; pops += 1;
      if (!arrived && pops >= QUEUE_ARRIVE_AFTER) { arrived = true; q.push(...items.slice(QUEUE_START)); }
      return it.color;
    },
    append(v) { q.push({ color: v, i: -1 }); return null; },
    __len__() { return q.length; },
    __iter__() { return q.map((x) => x.color); },
  };
  const arm = {
    take(box) {
      if (box === undefined) throw err('Рука не знает, какой ящик брать.', 'Передай ящик: arm.take(box)');
      if (!current || current.color !== box || taken.has(current.i)) throw err('Этот ящик ещё в очереди — рука до него не дотянется.', 'Сначала возьми его из очереди: box = queue.pop(0)');
      taken.add(current.i);
      return null;
    },
  };
  const r = run(source, { env: { queue, arm } });
  if (!r.ok) return { ok: false, diagnostics: r.diagnostics, taken: [] };
  const text = normalizeSource(source);
  const out = [...taken].sort((a, b) => a - b);
  if (!/^\s*while\b/m.test(text)) {
    return { ok: false, taken: out, diagnostics: [diag(/^\s*for\b/m.test(text) ? 'for прошёл по тем ящикам, что были в начале, — а потом приехали новые и остались стоять.' : 'Без повтора рука сделала один круг.', 'Нужно «пока очередь не пуста»: while queue:', 'no-while')] };
  }
  if (colors.some((c, i) => c === 'red' && taken.has(i))) return { ok: false, taken: out, diagnostics: [diag('Ночью рука унесла красный — утром штраф.', 'Внутри while: if box == "white":', 'took-red')] };
  if (q.length) return { ok: false, taken: out, diagnostics: [diag('Рука остановилась, а в очереди ещё есть ящики.', 'Каждый круг бери следующий: box = queue.pop(0)', 'not-empty')] };
  if (colors.some((c, i) => c === 'white' && !taken.has(i))) return { ok: false, taken: out, diagnostics: [diag('Не все белые уехали.', 'После pop: if box == "white": arm.take(box)', 'left-white')] };
  return { ok: true, taken: out, diagnostics: [] };
}

// ------------------------------------------------------------------ DEF --
export const DEF_PANEL = Object.freeze({
  question: 'Вторая линия. Как дать ей правило?',
  options: Object.freeze([['copy', 'СКОПИРОВАТЬ ПРАВИЛО В ЛИНИЮ B'], ['named', 'ОДНО ПРАВИЛО «route» → A И B']]),
});
export function judgeDefPanel(choice) {
  if (choice === 'named') return { ok: true, text: 'Одно правило с именем route, две линии подключены к нему. Поменяешь route — поменяются обе.' };
  return { ok: false, text: 'Скопировал. Через час начальник: «синие тоже не брать!» — ты поправил линию A, а копия на B осталась старой. Штраф.' };
}

export function runDefLesson(source, lineA, lineB) {
  const a = [...lineA]; const b = [...lineB];
  const takenA = new Set(); const takenB = new Set();
  let current = null; // which line the current call is working on
  const arm = {
    take(box) {
      if (box === undefined) throw Object.assign(new Error('take'), { pyMessage: 'Рука не знает, какой ящик брать.', fix: 'arm.take(box)' });
      const list = current === 'B' ? b : a; const set = current === 'B' ? takenB : takenA;
      const idx = list.findIndex((c, i) => c === box && !set.has(i));
      if (idx < 0) throw Object.assign(new Error('take'), { pyMessage: `Такого ящика на линии нет: ${JSON.stringify(box)}.`, fix: 'Бери ящик из партии: arm.take(box)' });
      set.add(idx);
      return null;
    },
  };
  // line_a / line_b are lists; a call route(line_b) switches the "current" line.
  const tag = (arr, line) => new Proxy(arr, { get(t, p) { if (p === Symbol.iterator) { current = line; return t[Symbol.iterator].bind(t); } return Reflect.get(t, p); } });
  const text = normalizeSource(source);
  const r = run(source, { env: { line_a: tag([...a], 'A'), line_b: tag([...b], 'B'), arm } });
  if (!r.ok) return { ok: false, diagnostics: r.diagnostics, takenA: [], takenB: [] };
  const defMatch = text.match(/^def\s+(\w+)\s*\(/m);
  const res = { takenA: [...takenA].sort((x, y) => x - y), takenB: [...takenB].sort((x, y) => x - y) };
  if (!defMatch) return { ok: false, ...res, diagnostics: [diag('Правило не получило имени — его нельзя подключить к двум линиям.', 'Начни с def route(batch):', 'no-def')] };
  const calls = (text.match(new RegExp(`^${defMatch[1]}\\s*\\(`, 'gm')) ?? []).length;
  if ((text.match(/^\s*for\b/gm) ?? []).length > 1) return { ok: false, ...res, diagnostics: [diag('Здесь два одинаковых цикла — это та же копия, только в коде.', 'Оставь один for внутри def и вызови навык дважды.', 'copy')] };
  if (calls < 2) return { ok: false, ...res, diagnostics: [diag(`Навык ${defMatch[1]} подключён к ${calls} линии из двух.`, `Вызови его для обеих: ${defMatch[1]}(line_a) и ${defMatch[1]}(line_b)`, 'one-call')] };
  if (lineA.some((c, i) => c === 'red' && takenA.has(i)) || lineB.some((c, i) => c === 'red' && takenB.has(i))) return { ok: false, ...res, diagnostics: [diag('Красный уехал — штраф.', 'Внутри навыка: if box == "white":', 'took-red')] };
  if (lineA.some((c, i) => c === 'white' && !takenA.has(i)) || lineB.some((c, i) => c === 'white' && !takenB.has(i))) return { ok: false, ...res, diagnostics: [diag('На одной из линий остались белые.', 'Внутри навыка: for box in batch: … arm.take(box)', 'left-white')] };
  return { ok: true, ...res, diagnostics: [] };
}
