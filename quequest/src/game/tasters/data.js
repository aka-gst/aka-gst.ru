// 20.x · ПРОБА «ЗНАТОК ТАБЛИЦ» (таблицы и данные: таблица → фильтры и сводные → Python).
// У Рената маленькая веломастерская; в конце месяца касса не сходится, и он не видит, куда
// уходят деньги. «ТИСКИ» продают ему «ТИСКИ-Учёт»: платно, ещё и процент с ремонтов, а список
// его клиентов уходит на сторону. Три этажа §13 на одной задаче:
//   ТЫК   — где держать чеки;
//   РУЧКИ — как собрать таблицу: группировка, повторы, возвраты, сортировка — так, чтобы
//           ответить на вопрос «куда уходят деньги?»;
//   КОД   — правило для одной строки чека: категория + сумма + повтор → куда её записать.
// Модуль задаёт данные, судью ручек, судьбу строки в сцене и саму сцену; рама проб
// (career-tasters.js, taster-scene.js) подключает его через src/game/tasters/index.js.
import { C, rgb, W, TOP, BOTTOM, lerp, ease, phaseOf, person, tag, wrongMark } from '../taster-art.js';

export const skill = { name: 'Порядок в данных (таблицы)', guild: 'automation' };

// Шесть чеков одного месяца. kind — что это на самом деле: income — деньги пришли,
// expense — ушли, dup — тот же чек пробит второй раз, return — деньги вернули клиенту.
export const DATA_ROWS = Object.freeze([
  { name: 'ремонты, 1-я неделя', cat: 'ремонт', sum: 24000, kind: 'income' },
  { name: 'запчасти', cat: 'запчасти', sum: 9000, kind: 'expense' },
  { name: 'аренда', cat: 'аренда', sum: 35000, kind: 'expense' },
  { name: 'запчасти, тот же чек', cat: 'запчасти', sum: 9000, kind: 'dup' },
  { name: 'возврат клиенту', cat: 'возврат', sum: 3000, kind: 'return' },
  { name: 'ремонты, 2-я неделя', cat: 'ремонт', sum: 26000, kind: 'income' },
]);
const RIGHT = { income: 'income', expense: 'expense', dup: 'skip', return: 'minus', zero: 'skip' };
const run = (fates, extra = {}, oks = null) => ({
  actors: DATA_ROWS.map((r, i) => ({ name: r.name, kind: r.kind, sum: r.sum, fate: fates[i], ok: oks ? oks[i] : fates[i] === RIGHT[r.kind] })),
  ...extra,
});

export const taster = {
  id: 'data', name: 'Знаток таблиц', glyph: '▤', skill: 'table',
  title: 'ТАБЛИЦЫ · ВЕЛОМАСТЕРСКАЯ',
  line: 'Собираешь чеки в таблицу и раскладываешь по столбцам — так, чтобы было видно, куда уходят деньги.',
  victim: 'Ренат', who: 'чинит велосипеды в маленькой мастерской у рынка',
  story: 'Работы у Рената много, а в конце месяца касса не сходится, и он не понимает, куда уходят деньги. «ТИСКИ» продают ему «ТИСКИ-Учёт» за 2490 ₽ в месяц — сервис ещё берёт процент с каждого ремонта и продаёт список его клиентов. Ренат готов платить, лишь бы перестать гадать.',
  pay: [100, 150, 250],
  pitch: {
    fantasy: 'Таблица, которая сама отвечает на вопрос «куда ушли деньги?».',
    verbs: ['выбрать, где держать чеки', 'собрать таблицу: сгруппировать, убрать повторы, отсортировать', 'записать правило для строки словами Python'],
    life: 'В жизни это работа с таблицами и данными: ею живут бухгалтеры, закупщики, аналитики и владельцы маленьких дел.',
  },
  levels: [
    {
      way: 'tap', title: 'Где держать чеки',
      goal: 'Чтобы в конце месяца Ренат видел, куда ушли деньги, и не платил за это «ТИСКАМ».',
      choices: [
        { id: 'tiski', label: 'Подключить «ТИСКИ-Учёт»', note: '2490 ₽ в месяц и процент', ok: false,
          why: 'Сервис что-то посчитал, но забрал по три процента с каждого ремонта и продал список клиентов — теперь им звонят чужие мастерские. А куда уходят деньги, Ренат так и не понял.',
          run: run(DATA_ROWS.map(() => 'tiski'), { mode: 'tiski' }, DATA_ROWS.map(() => false)) },
        { id: 'table', label: 'Собрать все чеки в одну таблицу с категориями', note: 'ремонт, запчасти, аренда, возврат', ok: true,
          why: 'Каждый чек стал строкой с категорией — и сразу видно, что больше всего съедает аренда. Одна строка ещё врёт: чек за запчасти пробит дважды. Это в следующем уровне.',
          run: run(['income', 'expense', 'expense', 'expense', 'minus', 'income'], { mode: 'table', note: 'повтор пока посчитан' }) },
        { id: 'box', label: 'Складывать бумажные чеки в коробку', note: 'бесплатно', ok: false,
          why: 'К концу месяца в коробке триста бумажек, половина выцвела. Ренат высыпал их на стол, просидел вечер и так и не понял, куда ушли деньги.',
          run: run(DATA_ROWS.map(() => 'box'), { mode: 'box' }, DATA_ROWS.map(() => false)) },
      ],
    },
    {
      way: 'knobs', title: 'Собери таблицу',
      goal: 'Таблица отвечает на вопрос, только если её правильно собрать: как сгруппировать, что делать с повторами и возвратами, в каком порядке показать. Настрой — и посмотри, сойдётся ли касса.',
      knobs: [
        { id: 'group', label: 'Сгруппировать чеки', options: [['day', 'по дням'], ['cat', 'по категориям']], start: 'day' },
        { id: 'dups', label: 'Одинаковые чеки', options: [['keep', 'оставить'], ['drop', 'убрать повтор']], start: 'keep' },
        { id: 'returns', label: 'Возврат клиенту', options: [['plus', 'как доход'], ['minus', 'минусом']], start: 'plus' },
        { id: 'sort', label: 'Порядок строк', options: [['date', 'по дате'], ['sum', 'по сумме, крупное сверху']], start: 'date' },
      ],
      knobsWin: { group: 'cat', dups: 'drop', returns: 'minus', sort: 'sum' },
    },
    {
      way: 'code', title: 'Правило для строки',
      goal: 'Сейчас правило знает только «ремонт — доход, всё остальное — расход». Добавь: повтор и пустой чек на 0 ₽ — пропустить, возврат — записать минусом.',
      legend: [['категория', 'что за чек: "ремонт", "запчасти", "аренда" или "возврат"'], ['сумма', 'сколько рублей в чеке'], ['повтор', '"да", если этот же чек уже есть в таблице, иначе "нет"'], ['or', '«или»: хватит, чтобы подошло одно из двух'], ['elif', '«иначе, если»: следующая проверка, когда первая не подошла']],
      starter: 'if категория == "ремонт":\n    print("ДОХОД")\nelse:\n    print("РАСХОД")',
      solution: 'if повтор == "да" or сумма == 0:\n    print("ПРОПУСТИТЬ")\nelif категория == "ремонт":\n    print("ДОХОД")\nelif категория == "возврат":\n    print("МИНУС")\nelse:\n    print("РАСХОД")',
      chips: ['if повтор == "да" or сумма == 0:', 'elif категория == "возврат":', 'print("ПРОПУСТИТЬ")', 'print("МИНУС")'],
      words: ['ДОХОД', 'РАСХОД', 'МИНУС', 'ПРОПУСТИТЬ'],
      cases: [
        { label: 'ремонт колеса', kind: 'income', sum: 800, vars: { категория: 'ремонт', сумма: 800, повтор: 'нет' }, expect: 'ДОХОД', why: 'Ренат починил колесо и получил 800 ₽, а в таблице этих денег нет — будто работал бесплатно.' },
        { label: 'запчасти', kind: 'expense', sum: 9000, vars: { категория: 'запчасти', сумма: 9000, повтор: 'нет' }, expect: 'РАСХОД', why: 'Запчасти на 9000 ₽ не попали в расходы — в таблице денег больше, чем в кассе.' },
        { label: 'аренда', kind: 'expense', sum: 35000, vars: { категория: 'аренда', сумма: 35000, повтор: 'нет' }, expect: 'РАСХОД', why: 'Аренда — самая большая трата месяца, а правило её не записало в расходы. Главный ответ на «куда уходят деньги» пропал.' },
        { label: 'тот же чек дважды', kind: 'dup', sum: 9000, vars: { категория: 'запчасти', сумма: 9000, повтор: 'да' }, expect: 'ПРОПУСТИТЬ', why: 'Чек пробили дважды — расход посчитан два раза, и Ренат думал, что работает в минус.' },
        { label: 'возврат клиенту', kind: 'return', sum: 3000, vars: { категория: 'возврат', сумма: 3000, повтор: 'нет' }, expect: 'МИНУС', why: 'Ренат вернул клиенту 3000 ₽, а правило записало это не минусом — касса опять не сходится.' },
        { label: 'гарантия, 0 ₽', kind: 'zero', sum: 0, vars: { категория: 'ремонт', сумма: 0, повтор: 'нет' }, expect: 'ПРОПУСТИТЬ', why: 'Гарантийный ремонт бесплатный, 0 ₽ — а правило записало его в доходы, и Ренат решил, что платных починок больше, чем было.' },
      ],
    },
  ],
  thanks: 'Ренат: «Оказывается, половину денег съедает аренда, а я грешил на запчасти. Теперь знаю, о чём говорить с хозяином помещения. А «ТИСКИ-Учёт» пусть считают кому-нибудь другому».',
  next: [
    'сводные таблицы в обычной программе для таблиц: то же «сгруппировать и сложить», только на тысячах строк и в два щелчка',
    'таблицы на языке программирования и запросы к базам данных: миллион строк разбирается тем же правилом, что шесть чеков Рената',
  ],
};

// РУЧКИ: первое, что заметит человек, — одной фразой.
export function knobs(v) {
  const byCat = v.group === 'cat', drop = v.dups === 'drop', minus = v.returns === 'minus';
  const cat = DATA_ROWS.map((r) => {
    if (r.kind === 'dup') return drop ? 'skip' : 'expense';
    if (r.kind === 'return') return minus ? 'minus' : 'income';
    return RIGHT[r.kind];
  });
  const oks = cat.map((f, i) => f === RIGHT[DATA_ROWS[i].kind]);
  const r = run(byCat ? cat : cat.map(() => 'pile'), { mode: byCat ? 'table' : 'day', sort: v.sort }, oks);
  if (!byCat) return { ok: false, why: 'По дням видно только «во вторник ушло много», а на что — непонятно. Чтобы ответить, куда уходят деньги, их надо сложить по категориям.', run: r };
  if (!drop) return { ok: false, why: 'Чек за запчасти пробили дважды — 9000 ₽ посчитаны два раза, и таблица говорит, что Ренат работает в минус.', run: r };
  if (!minus) return { ok: false, why: 'Возврат клиенту 3000 ₽ записан как доход — в таблице денег больше, чем в кассе, и снова не сходится.', run: r };
  if (v.sort !== 'sum') return { ok: false, why: 'Строки идут по датам — самая большая трата, аренда, затерялась в середине. Отсортируй по сумме, и главное окажется сверху.', run: r };
  return { ok: true, why: 'По категориям, без повторов, возврат — минусом, крупное сверху: видно, что половину денег съедает аренда. Касса сошлась до рубля.', run: r };
}

// КОД: что сказало правило → в какой столбец едет строка в сцене.
export function fate(c) {
  return { 'ДОХОД': 'income', 'РАСХОД': 'expense', 'МИНУС': 'minus', 'ПРОПУСТИТЬ': 'skip' }[c.got] ?? 'lost';
}

export const label = 'ЗНАТОК ТАБЛИЦ';

// ------------------------------------------------------------- сцена
// Слева прилавок мастерской: Ренат, колесо на стойке, стопка чеков, над ним лицо и стрелка
// кассы. Справа — таблица из четырёх столбцов: ДОХОД, РАСХОД, МИНУС, МИМО. Чеки летят со
// стопки и съезжают в свой столбец; неверная строка мигает. «ТИСКИ-Учёт» — красный ящик
// поверх таблицы, коробка — бумажки падают на пол, «по дням» — всё в одну кучу.
const PAPER = rgb(226, 220, 196), INK = rgb(60, 56, 50);
const COLS = {
  income: [116, 'ДОХОД', C.green],
  expense: [165, 'РАСХОД', C.gold],
  minus: [214, 'МИНУС', C.cyan],
  skip: [263, 'МИМО', C.dim],
};
const LX = 114, LY = 46, LW = 200, LH = 110;
const FROM = [16, 104];

function slip(P, x, y, a, open) {
  const ok = a.ok !== false;
  const col = !open ? PAPER : a.fate === 'income' ? rgb(200, 236, 200) : a.fate === 'minus' ? rgb(196, 226, 240) : a.fate === 'skip' ? rgb(170, 170, 166) : a.fate === 'expense' ? rgb(244, 226, 176) : PAPER;
  P.rect(x, y, 44, 10, col); P.box(x, y, 44, 10, ok ? rgb(110, 104, 92) : C.red);
  const s = a.sum ?? a.vars?.сумма ?? 0;
  const txt = (open && a.fate === 'minus' ? '-' : '') + String(s);
  P.text(x + 3, y + 2, txt, INK, 1, 0);
  if (a.kind === 'dup') { P.line(x + 37, y + 2, x + 41, y + 7, C.red); P.line(x + 41, y + 2, x + 37, y + 7, C.red); }   // штамп «повтор»
}
function face(P, x, y, mood) {
  P.disc(x, y, 9, C.skin);
  P.rect(x - 8, y - 9, 16, 4, rgb(50, 36, 26));
  P.rect(x - 4, y - 2, 2, 2, C.dark); P.rect(x + 3, y - 2, 2, 2, C.dark);
  if (mood === 'happy') { P.rect(x - 3, y + 4, 7, 1, C.dark); P.put(x - 4, y + 3, C.dark); P.put(x + 4, y + 3, C.dark); }
  else { P.rect(x - 3, y + 4, 7, 1, C.dark); P.put(x - 4, y + 5, C.dark); P.put(x + 4, y + 5, C.dark); P.rect(x - 5, y - 5, 3, 1, C.dark); P.rect(x + 3, y - 5, 3, 1, C.dark); }
}
function gauge(P, cx, cy, k) {
  // k: -1 — касса не сходится (влево, красное), +1 — сходится (вправо, зелёное)
  for (let i = 0; i <= 20; i++) {
    const a = Math.PI + (i / 20) * Math.PI, col = i < 8 ? C.red : i > 12 ? C.green : C.dim;
    P.put(cx + Math.cos(a) * 16, cy + Math.sin(a) * 16, col); P.put(cx + Math.cos(a) * 15, cy + Math.sin(a) * 15, col);
  }
  const a = Math.PI * 1.5 + k * Math.PI * 0.42;
  P.line(cx, cy, cx + Math.cos(a) * 13, cy + Math.sin(a) * 13, C.white);
  P.disc(cx, cy, 2, C.white);
}
function wheel(P, cx, cy, time) {
  for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2; P.put(cx + Math.cos(a) * 11, cy + Math.sin(a) * 11, rgb(30, 30, 34)); P.put(cx + Math.cos(a) * 10, cy + Math.sin(a) * 10, rgb(30, 30, 34)); }
  for (let i = 0; i < 6; i++) { const a = time * 0.8 + i * 0.524 * 2; P.line(cx, cy, cx + Math.cos(a) * 9, cy + Math.sin(a) * 9, rgb(170, 170, 176)); }
  P.disc(cx, cy, 1, C.gold);
}

export function paint(P, view) {
  const { time, t, result, actors } = view;
  // стена мастерской
  P.rect(0, TOP, W, BOTTOM - TOP, rgb(34, 32, 30));
  for (let y = TOP + 6; y < BOTTOM; y += 12) P.rect(0, y, LX - 4, 1, rgb(42, 40, 37));
  tag(P, 160, 18, 'ВЕЛОМАСТЕРСКАЯ РЕНАТА', C.gold);
  // прилавок, Ренат, колесо, стопка чеков
  P.rect(0, 116, LX - 4, BOTTOM - 116, C.wood); P.rect(0, 116, LX - 4, 2, rgb(150, 100, 56));
  person(P, 44, 96, rgb(60, 90, 140), { scale: 2, frame: Math.floor(time * 2) % 2 });
  tag(P, 49, 120, 'РЕНАТ', C.white);
  wheel(P, 88, 104, time);
  for (let i = 0; i < 4; i++) P.rect(FROM[0] - 2 + (i % 2), FROM[1] + 8 - i * 3, 22, 3, i % 2 ? PAPER : rgb(206, 200, 178));

  const n = actors.length;
  const end = n ? (n - 1) * 0.6 + 1.3 + 0.9 : 0;
  const done = !view.idle && n > 0 && t >= end;
  const good = view.result ? (result?.ok ?? actors.every((a) => a.ok)) : false;
  const k = view.idle ? Math.sin(time * 1.7) * 0.25 : done ? (good ? 1 : -1) : Math.sin(time * 5) * 0.5;
  face(P, 22, 40, done && good ? 'happy' : 'worried');
  gauge(P, 70, 48, k);
  tag(P, 70, 54, done ? (good ? 'СХОДИТСЯ' : 'НЕ СХОДИТСЯ') : 'КАССА', done ? (good ? C.green : C.red) : C.dim);

  // таблица
  const mode = result?.run?.mode ?? (view.level > 0 ? 'table' : 'idle');
  P.rect(LX, LY, LW, LH, rgb(24, 28, 34)); P.box(LX, LY, LW, LH, rgb(80, 84, 92));
  if (mode === 'day') {
    tag(P, LX + LW / 2, LY + 3, 'ВСЁ ПО ДНЯМ', C.dim);
    for (let x = LX + 40; x < LX + LW; x += 40) P.rect(x, LY + 12, 1, LH - 12, rgb(40, 44, 52));
  } else {
    for (const [key, [x, name, ink]] of Object.entries(COLS)) {
      if (key !== 'income') P.rect(x - 2, LY, 1, LH, rgb(56, 60, 68));
      tag(P, x + 23, LY + 3, name, ink);
    }
  }
  P.rect(LX, LY + 12, LW, 1, rgb(80, 84, 92));
  if (mode === 'tiski') {
    P.rect(LX + 30, LY + 26, 140, 60, rgb(150, 24, 24)); P.box(LX + 30, LY + 26, 140, 60, C.red);
    tag(P, LX + 100, LY + 40, '«ТИСКИ-УЧЁТ»', C.white);
    tag(P, LX + 100, LY + 54, 'ВАШИ КЛИЕНТЫ — НАШИ', C.gold);
    tag(P, LX + 100, LY + 66, '+3% С РЕМОНТА', C.gold);
  }
  const boxFront = () => { P.rect(50, 142, 56, 16, rgb(150, 110, 60)); P.box(50, 142, 56, 16, rgb(90, 60, 30)); tag(P, 78, 147, 'КОРОБКА', C.dark); };
  if (mode === 'box') boxFront();

  if (view.idle) {
    for (let i = 0; i < 3; i++) {
      const kk = (time * 0.3 + i / 3) % 1;
      slip(P, lerp(FROM[0], LX + 6, kk), lerp(FROM[1], LY - 14, kk * kk), DATA_ROWS[i], false);
    }
    return;
  }

  // слоты в столбцах; при сортировке по сумме крупное встаёт наверх
  const slotOf = new Map(), byFate = {};
  actors.forEach((a, i) => (byFate[a.fate] ??= []).push(i));
  for (const list of Object.values(byFate)) {
    const order = result?.run?.sort === 'sum' ? [...list].sort((x, y) => (actors[y].sum ?? actors[y].vars?.сумма ?? 0) - (actors[x].sum ?? actors[x].vars?.сумма ?? 0)) : list;
    order.forEach((idx, slot) => slotOf.set(idx, slot));
  }
  actors.forEach((a, i) => {
    const [ph, kk] = phaseOf(i, t); if (ph === 'wait') return;
    if (ph === 'walk') { slip(P, lerp(FROM[0], LX + 6, kk), lerp(FROM[1], LY - 14, kk * kk), a, false); return; }
    const slot = slotOf.get(i) ?? 0;
    let tx, ty;
    if (a.fate === 'tiski') { tx = LX + 60 + (slot % 3) * 22; ty = LY + 40; }
    else if (a.fate === 'box') { tx = 54 + (slot % 3) * 4; ty = 134 + (slot % 2) * 3; }
    else if (a.fate === 'pile') { tx = LX + 8 + slot * 28; ty = LY + 18 + slot * 13; }
    else if (COLS[a.fate]) { tx = COLS[a.fate][0]; ty = LY + 16 + slot * 13; }
    else { tx = LX + 6 + kk * 10; ty = lerp(LY - 14, BOTTOM - 10, ease(kk)); }
    const x = lerp(LX + 6, tx, ease(kk)), y = lerp(LY - 14, ty, ease(kk));
    if (a.fate === 'tiski' && kk > 0.8) return;                // проглочено ящиком «ТИСКОВ»
    slip(P, x, y, a, true);
    if (!a.ok) wrongMark(P, x + 22, y + 5, time);
  });
  if (mode === 'box') boxFront();
  // крупнейшая трата сверху — подсветка, когда таблица собрана правильно
  if (done && good && mode === 'table' && result?.run?.sort === 'sum') {
    const top = actors.findIndex((a, i) => a.fate === 'expense' && slotOf.get(i) === 0);
    if (top >= 0) { P.box(COLS.expense[0] - 1, LY + 15, 46, 12, C.gold); tag(P, LX + LW / 2, LY + LH - 10, 'БОЛЬШЕ ВСЕГО УХОДИТ НА АРЕНДУ', C.gold); }
  }
}
