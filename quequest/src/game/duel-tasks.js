// 19.1 · QUICK TASKS for the duel, the storm and the hack (canon §19).
// «Реши быстрый пример — получи баф»: every round flashes one small task on
// an area of the diver card. Tasks are generated from a seed so they do not
// repeat, every code answer is computed by the game's own mini-python (the
// same interpreter the garage and the tasters run), and every task has one
// right option and one plain sentence that explains it.
//
//   makeTask(area, seed, { family }) -> {
//     id, family, area, skill, way, title, prompt, code, scene, options[], answer, explain, limit }
//
// `explain` is shown when the answer was wrong (or late): learning, not
// punishment. tools/duel.test.mjs plays thousands of seeds of every family.

import { run, check } from './mini-python.js';

const freeze = (v) => Object.freeze(v);

export function rng(seed = 1) {
  let a = (Number(seed) >>> 0) || 0x9e3779b9;
  const next = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return {
    next,
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    shuffle: (arr) => { const out = [...arr]; for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; } return out; },
    chance: (p) => next() < p,
  };
}
export function hashStr(s) { let h = 2166136261 >>> 0; for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }

// way: the §13 floor a right answer proves. limit: seconds for the round.
export const FAMILIES = freeze({
  out: freeze({ id: 'out', title: 'Что выведет код', way: 'code', limit: 16 }),
  bug: freeze({ id: 'bug', title: 'Найди ошибку', way: 'code', limit: 18 }),
  rule: freeze({ id: 'rule', title: 'Выбери правило', way: 'knobs', limit: 18 }),
  guard: freeze({ id: 'guard', title: 'Кого пустит сторож', way: 'knobs', limit: 15 }),
  bits: freeze({ id: 'bits', title: 'Биты 8 · 4 · 2 · 1', way: 'knobs', limit: 12 }),
  fake: freeze({ id: 'fake', title: 'Отличи подделку', way: 'knobs', limit: 13 }),
  site: freeze({ id: 'site', title: 'Понятная страница', way: 'tap', limit: 10 }),
  city: freeze({ id: 'city', title: 'Цепочка поломок', way: 'knobs', limit: 13 }),
});
export const AREA_FAMILIES = freeze({
  say: freeze(['out', 'bug']), if: freeze(['out', 'rule', 'bug']), loop: freeze(['out', 'bug']), auto: freeze(['out']),
  guard: freeze(['guard']), web: freeze(['site']), ai: freeze(['fake']), city: freeze(['city']), hw: freeze(['bits']),
});
// The §13 skill a right answer is a proof for.
const AREA_SKILL = freeze({ say: 'print', if: 'if', loop: 'for', auto: 'def', guard: 'guard', web: 'site', ai: 'train', city: 'cascade', hw: 'bits' });

const runOut = (code) => { const r = run(code); if (!r.ok) throw new Error(`task code failed: ${r.diagnostics[0]?.message}\n${code}`); return r.stdout; };

// Build options: the right one plus distinct distractors, shuffled.
function options(r, right, wrongs, fill = []) {
  const seen = new Set([String(right)]);
  const out = [String(right)];
  for (const w of [...wrongs, ...fill]) { const s = String(w); if (out.length >= 4) break; if (!seen.has(s) && s !== '') { seen.add(s); out.push(s); } }
  const shuffled = r.shuffle(out);
  return { options: shuffled.map((label) => ({ label })), answer: shuffled.indexOf(String(right)) };
}

const NAMES = freeze(['Витя', 'Дина', 'Саня', 'Тимур', 'Лида', 'Марк', 'Ася', 'Зарина']);

// ----------------------------------------------------------- ЧТО ВЫВЕДЕТ
function outSay(r) {
  const v = r.int(0, 2);
  if (v === 0) {
    const a = r.int(2, 9), b = r.int(2, 9);
    const code = `x = ${a}\ny = ${b}\nprint(x + y)`;
    const right = runOut(code);
    return { topic: 'say.print', skill: 'print', code, ...options(r, right, [`${a}${b}`, 'x + y', a * b, a + b + 1]), explain: `x и y — коробки с числами ${a} и ${b}; print показывает их сумму: ${right}.` };
  }
  if (v === 1) {
    const name = r.pick(NAMES);
    const code = `имя = "${name}"\nprint("Привет, " + имя)`;
    const right = runOut(code);
    return { topic: 'say.text', skill: 'print', code, ...options(r, right, ['Привет, имя', name, 'Привет, + имя']), explain: `Слово без кавычек — имя коробки: вместо «имя» подставится «${name}».` };
  }
  const a = r.int(3, 12), b = r.int(2, 6);
  const code = `ящиков = ${a}\nящиков = ящиков + ${b}\nprint(ящиков)`;
  const right = runOut(code);
  return { topic: 'say.text', skill: 'print', code, ...options(r, right, [a, b, 'ящиков', a + b + 1]), explain: `Вторая строка кладёт в коробку старое число плюс ${b}: ${a} + ${b} = ${right}.` };
}
function outIf(r) {
  if (r.chance(0.5)) {
    const color = r.pick(['white', 'red']);
    const code = `ящик = "${color}"\nif ящик == "white":\n    print("БЕРУ")\nelse:\n    print("ОСТАВЛЯЮ")`;
    const right = runOut(code);
    return { topic: 'if.ifelse', skill: 'if', code, ...options(r, right, [right === 'БЕРУ' ? 'ОСТАВЛЯЮ' : 'БЕРУ', 'БЕРУ и ОСТАВЛЯЮ', 'ничего']), explain: color === 'white' ? 'Ящик белый — условие верно, работает строка под if.' : 'Ящик красный — условие ложно, работает строка под else.' };
  }
  const hi = r.int(7, 10), mid = r.int(3, 5);
  const w = r.pick([hi, hi + r.int(1, 4), mid, mid + 1, r.int(1, mid - 1)]);
  const code = `вес = ${w}\nif вес > ${hi}:\n    print("ТЯЖЁЛЫЙ")\nelif вес > ${mid}:\n    print("СРЕДНИЙ")\nelse:\n    print("ЛЁГКИЙ")`;
  const right = runOut(code);
  const why = w > hi ? `${w} больше ${hi} — сработала первая ветка.` : w > mid ? `${w} не больше ${hi}${w === hi ? ' (оно равно, а знак > строгий)' : ''}, но больше ${mid} — сработал elif.` : `${w} не больше ни ${hi}, ни ${mid}${w === mid ? ' (равно — не больше)' : ''} — остался else.`;
  return { topic: 'if.elif', skill: 'if', code, ...options(r, right, ['ТЯЖЁЛЫЙ', 'СРЕДНИЙ', 'ЛЁГКИЙ', 'ТЯЖЁЛЫЙ и СРЕДНИЙ']), explain: why };
}
function outLoop(r) {
  const v = r.int(0, 3);
  if (v === 0) {
    const n = r.int(2, 5), k = r.int(2, 6);
    const code = `s = 0\nfor i in range(${n}):\n    s = s + ${k}\nprint(s)`;
    const right = runOut(code);
    return { topic: 'loop.for', skill: 'for', code, ...options(r, right, [n * k + k, k, n + k, n]), explain: `Цикл прошёл ${n} раз и каждый раз прибавлял ${k}: ${n} × ${k} = ${right}.` };
  }
  if (v === 1) {
    const n = r.int(3, 7);
    const code = `for i in range(${n}):\n    print(i)`;
    const right = runOut(code).split('\n').at(-1);
    return { topic: 'loop.for', skill: 'for', code, prompt: 'Какое число напечатается последним?', ...options(r, right, [n, n + 1, 0, n - 2]), explain: `range(${n}) — это ${n} чисел с нуля: 0 … ${n - 1}.` };
  }
  if (v === 2) {
    const boxes = Array.from({ length: r.int(3, 5) }, () => r.pick(['white', 'red']));
    const code = `for ящик in [${boxes.map((b) => `"${b}"`).join(', ')}]:\n    if ящик == "white":\n        print("БЕРУ")`;
    const right = String(runOut(code).split('\n').filter(Boolean).length);
    return { topic: 'loop.list', skill: 'for', code, prompt: 'Сколько раз напечатается БЕРУ?', ...options(r, right, [boxes.length, Number(right) + 1, Math.max(0, Number(right) - 1), boxes.length - Number(right)], [0, 1, 2, 3, 4, 5]), explain: `Цикл смотрит каждый ящик, а БЕРУ печатает только для белых — их ${right}.` };
  }
  const a = r.int(8, 15), b = r.int(3, 5);
  const code = `n = ${a}\nwhile n > 0:\n    n = n - ${b}\nprint(n)`;
  const right = runOut(code);
  return { topic: 'loop.while', skill: 'while', code, ...options(r, right, [0, a % b, Number(right) + b, -b]), explain: `Цикл крутится, пока n больше нуля: ${a} → … → ${right}, тут условие стало ложным.` };
}
function outAuto(r) {
  if (r.chance(0.5)) {
    const a = r.int(2, 9);
    const code = `def вдвое(x):\n    return x * 2\nprint(вдвое(${a}) + 1)`;
    const right = runOut(code);
    return { topic: 'auto.return', skill: 'def', code, ...options(r, right, [2 * a + 2, a + 1, 2 * a, a * 3]), explain: `Навык вдвое(${a}) вернул ${2 * a}, потом +1: ${right}.` };
  }
  const n = r.int(2, 6), p = r.pick([20, 30, 50]);
  const code = `def цена(ящики):\n    return ящики * ${p}\nprint(цена(${n}))`;
  const right = runOut(code);
  return { topic: 'auto.def', skill: 'def', code, ...options(r, right, [n + p, p, n, n * p + p]), explain: `Навык получил ящики = ${n} и вернул ${n} × ${p} = ${right}.` };
}
function makeOut(area, r) {
  const t = { say: outSay, if: outIf, loop: outLoop, auto: outAuto }[area](r);
  return { prompt: t.prompt ?? 'Что напечатает этот код?', ...t };
}

// ------------------------------------------------------------ НАЙДИ ОШИБКУ
// One working program, one injected mistake; check() must point at it.
const BUGS = freeze({
  colon: 'В конце строки с if / for / else нужно двоеточие «:» — без него Python не знает, где начинается «что делать».',
  assign: 'В условии сравнивают двумя знаками «==»; один «=» значит «положить в коробку».',
  quote: 'Слово в кавычках должно закрываться той же кавычкой — иначе Python не видит, где слово кончилось.',
  typo: 'Команда пишется ровно print — с опечаткой Python её не узнаёт.',
  range: 'Повторить N раз — это range(N); с опечаткой Python не знает такого слова.',
});
function bugProgram(area, r) {
  if (area === 'say') {
    const name = r.pick(NAMES);
    return { skill: 'print', lines: [`имя = "${name}"`, 'привет = "Привет, " + имя', 'print(привет)'], spots: [[0, 'quote'], [1, 'quote'], [2, 'typo']] };
  }
  if (area === 'if') {
    const color = r.pick(['white', 'red']);
    return { skill: 'if', lines: [`ящик = "${color}"`, 'if ящик == "white":', '    print("БЕРУ")', 'else:', '    print("ОСТАВЛЯЮ")'], spots: [[1, 'colon'], [1, 'assign'], [2, 'typo'], [3, 'colon'], [4, 'quote']] };
  }
  const n = r.int(2, 6), k = r.int(2, 5);
  return { skill: 'for', lines: ['s = 0', `for i in range(${n}):`, `    s = s + ${k}`, 'print(s)'], spots: [[1, 'colon'], [1, 'range'], [3, 'typo']] };
}
function inject(line, kind) {
  if (kind === 'colon') return line.replace(/:\s*$/, '');
  if (kind === 'assign') return line.replace('==', '=');
  if (kind === 'typo') return line.replace('print', 'pritn');
  if (kind === 'range') return line.replace('range', 'rnage');
  if (kind === 'quote') { const i = line.lastIndexOf('"'); return line.slice(0, i) + line.slice(i + 1); }
  return line;
}
function makeBug(area, r) {
  const p = bugProgram(area, r);
  const [at, kind] = r.pick(p.spots);
  const lines = p.lines.map((l, i) => (i === at ? inject(l, kind) : l));
  const opts = lines.map((l, i) => ({ label: `${i + 1}`, code: l }));
  return { topic: `${area}.bug`, skill: p.skill, prompt: 'В какой строке ошибка? Нажми на неё.', code: lines.join('\n'), lines, fixed: p.lines.join('\n'), bugKind: kind, options: opts, answer: at, explain: `Строка ${at + 1}: ${BUGS[kind]}` };
}

// ------------------------------------------------------------ ПРАВИЛО ДЛЯ РУКИ
const RULES = freeze([
  ['цвет == "white" and вес > N', (b, n) => b.c === 'white' && b.w > n],
  ['цвет == "white" or вес > N', (b, n) => b.c === 'white' || b.w > n],
  ['цвет == "white"', (b) => b.c === 'white'],
  ['вес > N', (b, n) => b.w > n],
  ['цвет == "red" and вес > N', (b, n) => b.c === 'red' && b.w > n],
  ['цвет == "white" and вес <= N', (b, n) => b.c === 'white' && b.w <= n],
]);
function evalRule(src, box) {
  const res = run(`if ${src}:\n    print("1")`, { env: { цвет: box.c, вес: box.w } });
  if (!res.ok) throw new Error(`rule failed: ${src}`);
  return res.stdout === '1';
}
function makeRule(area, r) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const n = r.int(3, 6);
    const boxes = Array.from({ length: 5 }, () => ({ c: r.pick(['white', 'red']), w: r.int(1, 9) }));
    const pool = r.shuffle(RULES.map(([s]) => s.replace('N', n)));
    const target = pool[0];
    const take = boxes.map((b) => evalRule(target, b));
    if (!take.some(Boolean) || take.every(Boolean)) continue;
    const others = pool.slice(1).filter((s) => boxes.some((b, i) => evalRule(s, b) !== take[i])).slice(0, 3);
    if (others.length < 3) continue;
    const opts = r.shuffle([target, ...others]);
    return {
      topic: 'if.andor', skill: 'if', prompt: 'Рука должна взять только ящики с ✓. Какое правило ей дать?',
      code: null, scene: { kind: 'boxes', items: boxes.map((b, i) => ({ color: b.c, weight: b.w, take: take[i] })) },
      options: opts.map((s) => ({ label: `if ${s}:`, mono: true })), answer: opts.indexOf(target),
      explain: `Только «${target}» берёт ровно ящики с ✓: ${target.includes(' and ') ? '«and» — нужно оба условия сразу' : target.includes(' or ') ? '«or» — хватает любого из двух' : 'одного условия здесь достаточно'}.`,
    };
  }
  throw new Error('rule: no unique task');
}

// ------------------------------------------------------------ СТОРОЖ
function guardPasses(src, g) {
  const res = run(`if ${src}:\n    print("ПУСТИТЬ")\nelse:\n    print("БЛОК")`, { env: { пропуск: g.pass, стуков: g.rate } });
  if (!res.ok) throw new Error(`guard failed: ${src}`);
  return res.stdout === 'ПУСТИТЬ';
}
function makeGuard(area, r) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const lim = r.int(2, 5);
    const src = r.pick([`пропуск and стуков <= ${lim}`, `пропуск and стуков < ${lim + 1}`]);
    const names = r.shuffle(['Аня', 'Лёша', 'Оля', 'Дима', 'Гоша', 'Ира']).slice(0, 4);
    const guests = names.map((name) => ({ name, pass: r.chance(0.5), rate: r.pick([1, lim, lim + 1, lim + r.int(2, 9)]) }));
    const pass = guests.map((g) => guardPasses(src, g));
    if (pass.filter(Boolean).length !== 1) continue;
    const i = pass.indexOf(true), g = guests[i];
    return {
      topic: 'guard.door', skill: 'guard', prompt: 'Сторож у двери. Кого из четверых он пустит?',
      code: `if ${src}:\n    print("ПУСТИТЬ")\nelse:\n    print("БЛОК")`,
      scene: { kind: 'guests', items: guests },
      options: guests.map((x) => ({ label: `${x.name} · ${x.pass ? 'с пропуском' : 'без пропуска'} · стуков ${x.rate}` })), answer: i,
      explain: `Нужен и пропуск, и не больше ${lim} стуков в секунду — так подходит только ${g.name}.`,
    };
  }
  throw new Error('guard: no unique task');
}

// ------------------------------------------------------------ БИТЫ
const W = freeze([8, 4, 2, 1]);
const bitsOf = (n) => W.map((w) => ((n & w) ? 1 : 0));
const valueOf = (bits) => bits.reduce((s, b, i) => s + b * W[i], 0);
function makeBits(area, r) {
  if (r.chance(0.5)) {
    const n = r.int(3, 14);
    const bits = bitsOf(n);
    const reversed = valueOf([...bits].reverse());
    const count = bits.filter(Boolean).length;
    return {
      topic: 'hw.read', skill: 'bits', prompt: 'Переключатели 8 · 4 · 2 · 1. Какое число они показывают?', code: null,
      scene: { kind: 'bits', bits },
      ...options(r, n, [reversed, count, n + 1, n - 1, 15 - n]),
      explain: `Складываем веса включённых: ${W.filter((w, i) => bits[i]).join(' + ')} = ${n}.`,
    };
  }
  const n = r.int(3, 14);
  const right = bitsOf(n).join(' ');
  const wrongs = [bitsOf(valueOf([...bitsOf(n)].reverse())).join(' '), bitsOf((n + 1) & 15).join(' '), bitsOf((n + 2) & 15).join(' '), bitsOf(n ^ 8).join(' ')];
  return {
    topic: 'hw.make', skill: 'bits', prompt: `Включи станцию ${n}: какие переключатели 8 · 4 · 2 · 1 поднять?`, code: null,
    scene: { kind: 'bits', bits: null, target: n },
    ...options(r, right, wrongs.map((s) => s)), mono: true,
    explain: `${n} = ${W.filter((w) => n & w).join(' + ')}: поднимаем эти переключатели — ${right}.`,
  };
}

// ------------------------------------------------------------ ОТЛИЧИ ПОДДЕЛКУ
export const SIGNS = freeze({ new: 'аккаунт вчерашний', copy: 'такой же текст у других', star1: 'одна звезда', exclaim: 'много «!!!»' });
const REVIEW_TEXT = freeze(['Кофе остыл, жаль', 'Лучший раф в районе', 'Тихо, можно учиться', 'Ужасно, не ходите', 'Грязно и дорого', 'Впервые зашла — вкусно', 'Пирог с капустой — огонь', 'Долго ждал заказ']);
function makeFake(area, r) {
  const keys = Object.keys(SIGNS);
  const who = r.shuffle(['Галя', 'Дима', 'Оля', 'Соня', 'Гоша', 'Тома']).slice(0, 3);
  const fakeAt = r.int(0, 2);
  const texts = r.shuffle(REVIEW_TEXT).slice(0, 3);
  const items = who.map((name, i) => {
    const n = i === fakeAt ? r.int(2, 4) : r.int(0, 1);
    return { who: i === fakeAt ? r.pick(['гость_8812', 'user1990', 'отзыв_бот']) : name, text: texts[i], signs: r.shuffle(keys).slice(0, n) };
  });
  const f = items[fakeAt];
  return {
    topic: 'ai.fake', skill: 'train', prompt: 'Правило робота: подделка — если примет 2 и больше. Какой отзыв — подделка?', code: null,
    scene: { kind: 'reviews', items },
    options: items.map((x) => ({ label: `«${x.text}» — ${x.who}` })), answer: fakeAt,
    explain: `У подделки ${f.signs.length} приметы: ${f.signs.map((s) => SIGNS[s]).join(', ')}; у остальных — одна или ни одной.`,
  };
}

// ------------------------------------------------------------ ПОНЯТНАЯ СТРАНИЦА
const SHOPS = freeze([
  ['Пироги Нины Петровны', 'Липовая, 7', 'ПИРОГИ'], ['Ремонт обуви у Сани', 'Заречная, 3', 'РЕМОНТ'], ['Кофейня «Зёрнышко»', 'Садовая, 12', 'КОФЕ'],
  ['Фотоателье Лиды', 'Вокзальная, 5', 'ФОТО'], ['Лавка Марка', 'у станции, 1', 'ТОВАРЫ'], ['Цветы Аси', 'рынок, ряд 4', 'ЦВЕТЫ'],
]);
function makeSite(area, r) {
  const [name, addr, loud] = r.pick(SHOPS);
  if (r.chance(0.5)) {
    const right = `${name} — ${addr}`;
    return { topic: 'web.title', skill: 'site', prompt: `Человек открыл страницу «${name}» с телефона. Что написать сверху?`, code: null, ...options(r, right, ['Главная', `ЛУЧШИЕ ${loud}!!! ЖМИ!!!`, 'Добро пожаловать на наш сайт']), explain: 'Сверху — кто вы и где вы: имя и адрес. Остальное человек дочитает, если поймёт, что пришёл туда.' };
  }
  const right = 'Сегодня всё раскупили — приходите завтра с 9:00';
  return { topic: 'web.honest', skill: 'site', prompt: `В «${name}» сегодня всё закончилось. Какая кнопка честная?`, code: null, ...options(r, right, ['Купить', 'Скидка 90%!!! Только сегодня', 'Нажми, чтобы узнать']), explain: 'Честная кнопка говорит правду: товара нет и когда он будет. Иначе человек придёт зря.' };
}

// ------------------------------------------------------------ ЦЕПОЧКА ПОЛОМОК
function makeCity(area, r) {
  const n = r.int(5, 7);
  const walls = new Set(r.shuffle(Array.from({ length: n - 1 }, (_, i) => i + 1)).slice(0, r.int(1, 2))); // wall after house i (1-based)
  const fault = r.int(1, n);
  let lo = fault, hi = fault;
  while (lo > 1 && !walls.has(lo - 1)) lo--;
  while (hi < n && !walls.has(hi)) hi++;
  const dark = hi - lo + 1;
  return {
    topic: 'city.walls', skill: 'cascade', prompt: `Дома на одной линии, «|» — перегородка. Авария в доме ${fault}. Сколько домов погаснет?`, code: null,
    scene: { kind: 'line', n, walls: [...walls].sort((a, b) => a - b), fault },
    ...options(r, dark, [n, 1, dark + 1, dark - 1, n - dark].filter((x) => x >= 1)),
    explain: `Свет гаснет до ближайших перегородок: дома ${lo}–${hi}, это ${dark}.`,
  };
}

const MAKERS = freeze({ out: makeOut, bug: makeBug, rule: makeRule, guard: makeGuard, bits: makeBits, fake: makeFake, site: makeSite, city: makeCity });

export function makeTask(area, seed = 1, { family = null } = {}) {
  const fams = AREA_FAMILIES[area];
  if (!fams) throw new Error(`unknown area ${area}`);
  const r = rng(seed);
  const fam = family && fams.includes(family) ? family : r.pick(fams);
  const t = MAKERS[fam](area, r);
  const meta = FAMILIES[fam];
  const id = `${fam}:${area}:${hashStr(`${t.prompt}|${t.code ?? ''}|${JSON.stringify(t.scene ?? null)}|${t.options.map((o) => o.label).join('|')}`).toString(36)}`;
  return { id, family: fam, area, skill: t.skill ?? AREA_SKILL[area], way: meta.way, title: meta.title, limit: meta.limit, code: null, scene: null, ...t };
}

// For tests and for the e2e: is the task well formed (one right answer,
// distinct options, and the code really says what the task claims)?
export function verifyTask(t) {
  const labels = t.options.map((o) => `${o.label}|${o.code ?? ''}`);
  if (new Set(labels).size !== labels.length) return 'options repeat';
  if (!(t.answer >= 0 && t.answer < t.options.length)) return 'no answer';
  if (t.options.length < 2) return 'too few options';
  if (!t.explain || t.explain.length > 170) return 'explain missing or long';
  if (t.family === 'out') {
    const out = run(t.code);
    if (!out.ok) return 'code fails';
    const lines = out.stdout.split('\n').filter(Boolean);
    const right = t.options[t.answer].label;
    if (/последним/.test(t.prompt)) return lines.at(-1) === right ? null : 'last mismatch';
    if (/Сколько раз/.test(t.prompt)) return String(lines.length) === right ? null : 'count mismatch';
    if (out.stdout !== right) return 'output mismatch';
    if (t.options.some((o, i) => i !== t.answer && o.label === out.stdout)) return 'two right';
  }
  if (t.family === 'bug') {
    if (!check(t.fixed).ok) return 'fixed program fails';
    const c = check(t.code);
    if (c.ok) return 'bug not detected';
    if (c.diagnostics[0].line !== t.answer + 1) return `bug on line ${c.diagnostics[0].line}, task says ${t.answer + 1}`;
  }
  return null;
}
