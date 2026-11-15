// 20.x · ПРОБА «БИТМЕЙКЕР» (музыка и звук правилами).
// Костя играет на гитаре в переходе у метро; ему нужен ритм, который идёт за ним. «ТИСКИ»
// продают «ТИСКИ-Минус» — платную подложку с их звуковой меткой и ровным темпом, который
// не ждёт. Мысль пробы: ритм — это правило над шагами такта. Восемь шагов, на каждом
// звучит бочка, малый барабан, тарелка или тишина. Три этажа §13 на одной задаче:
//   ТЫК   — выбрать, под что играет Костя;
//   РУЧКИ — расставить бочку, малый, тарелку и темп на сетке из восьми шагов;
//   КОД   — то же правило словами: какой шаг → какой звук, и тишина, когда Костя молчит.
// Сцена немая (только пиксели): звук показан светом клеток, прыгающими полосками и нотами.
import { C, rgb, W, TOP, BOTTOM, lerp, ease, phaseOf, person, tag, wrongMark } from '../taster-art.js';

export const skill = { name: 'Ритм и звук правилами (музыка)', guild: 'ai' };

// Правильный ритм на восемь шагов: бочка на 1 и 5, малый на 3 и 7, тарелка между ними.
export const BEAT_STEPS = 8;
const TARGET = { 1: ['kick'], 2: ['hat'], 3: ['snare'], 4: ['hat'], 5: ['kick'], 6: ['hat'], 7: ['snare'], 8: ['hat'] };
const same = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
const steps = (hitsOf, okOf = (s, h) => same(h, TARGET[s])) => Array.from({ length: BEAT_STEPS }, (_, i) => {
  const s = i + 1, hits = hitsOf(s);
  return { name: `шаг ${s}`, step: s, hits, ok: okOf(s, hits), fate: hits.length ? 'play' : 'rest' };
});
const run = (actors, extra = {}) => ({ actors, good: actors.every((a) => a.ok), ...extra });

export const taster = {
  id: 'sound', name: 'Битмейкер', glyph: '♪', skill: 'beat',
  title: 'БИТМЕЙКЕР · ПЕРЕХОД У МЕТРО',
  line: 'Собираешь ритм правилом: на каком шаге такта бьёт бочка, малый барабан и тарелка — и чтобы он шёл за музыкантом.',
  victim: 'Костя', who: 'играет на гитаре в переходе у метро «Садовая»',
  story: 'Костя поёт в переходе, и ему не хватает ритма за спиной. «ТИСКИ» продают «ТИСКИ-Минус» за 790 ₽ в месяц: готовая подложка с их звуковой меткой и ровным темпом, который не ждёт. Костя к припеву разгоняется, подложка — нет, и песня разваливается прямо перед прохожими.',
  pay: [100, 150, 250],
  pitch: {
    fantasy: 'Ритм, который ты собрал сам и который идёт за живым музыкантом.',
    verbs: ['выбрать, под что играет Костя', 'расставить барабаны по шагам такта', 'записать ритм правилом на Python'],
    life: 'В жизни это битмейкинг и звук: ритмы собирают музыканты, звукорежиссёры, авторы звука для игр и видео — и всё это правила над шагами.',
  },
  levels: [
    {
      way: 'tap', title: 'Под что играть',
      goal: 'Чтобы у Кости был ритм за спиной, и чтобы прохожие останавливались, а не шли мимо.',
      choices: [
        { id: 'tiski', label: 'Купить «ТИСКИ-Минус»', note: '790 ₽ в месяц', ok: false,
          why: 'Подложка идёт ровно, а Костя к припеву ускоряется — к пятому шагу они разошлись. Сквозь музыку слышно «ТИСКИ-Минус», и люди отворачиваются.',
          run: run(steps((s) => TARGET[s], (s) => s < 5), { mode: 'tiski', tempo: 'fixed' }) },
        { id: 'grid', label: 'Собрать свой ритм на сетке из восьми шагов', note: 'идёт за Костей', ok: true,
          why: 'Бочка, малый и тарелка встали по своим шагам, а темп идёт за Костей: он ускоряется — ритм вместе с ним. Люди останавливаются.',
          run: run(steps((s) => TARGET[s]), { mode: 'beat', tempo: 'his' }) },
        { id: 'none', label: 'Играть без ритма', note: 'бесплатно', ok: false,
          why: 'Одна гитара в гулком переходе тонет в шуме шагов: никто не притопнул, никто не остановился.',
          run: run(steps(() => []), { mode: 'none' }) },
      ],
    },
    {
      way: 'knobs', title: 'Расставь барабаны',
      goal: 'В такте восемь шагов. Реши, на каких бьёт бочка, на каких малый барабан, где тарелка — и кто держит темп.',
      knobs: [
        { id: 'kick', label: 'Бочка (низкий «бум»)', options: [['15', 'на 1 и 5 шаге'], ['all', 'на каждом шаге'], ['none', 'нигде']], start: 'all' },
        { id: 'snare', label: 'Малый барабан (хлёсткий «тыщ»)', options: [['37', 'на 3 и 7 шаге'], ['1', 'на 1 шаге, вместе с бочкой'], ['none', 'нигде']], start: 'none' },
        { id: 'hat', label: 'Тарелка (тихое «ц»)', options: [['even', 'на чётных шагах, между ударами'], ['all', 'на каждом шаге'], ['none', 'нигде']], start: 'none' },
        { id: 'tempo', label: 'Кто держит темп', options: [['fixed', 'ровно, как у «ТИСКОВ»'], ['his', 'идёт за Костей']], start: 'fixed' },
      ],
      knobsWin: { kick: '15', snare: '37', hat: 'even', tempo: 'his' },
    },
    {
      way: 'code', title: 'Ритм — словами',
      goal: 'Сейчас правило знает только бочку на первом шаге, а дальше трещит тарелка. Добавь: бочка на 1 и 5, малый на 3 и 7 — а когда Костя молчит, ритм тоже молчит.',
      legend: [['доля', 'номер шага в такте, от 1 до 8'], ['костя', 'что делает Костя: "играет" или "молчит"'], ['in [1, 5]', '«среди»: шаг 1 или шаг 5'], ['elif', '«иначе, если»: следующая проверка, когда первая не подошла']],
      starter: 'if доля == 1:\n    print("БОЧКА")\nelse:\n    print("ТАРЕЛКА")',
      solution: 'if костя == "молчит":\n    print("ТИШИНА")\nelif доля in [1, 5]:\n    print("БОЧКА")\nelif доля in [3, 7]:\n    print("МАЛЫЙ")\nelse:\n    print("ТАРЕЛКА")',
      chips: ['if костя == "молчит":', 'elif доля in [1, 5]:', 'elif доля in [3, 7]:', 'print("МАЛЫЙ")', 'print("ТИШИНА")'],
      words: ['БОЧКА', 'МАЛЫЙ', 'ТАРЕЛКА', 'ТИШИНА'],
      cases: [
        { label: 'шаг 1', vars: { доля: 1, костя: 'играет' }, expect: 'БОЧКА', why: 'На первом шаге нет бочки — Костя не слышит, где начало такта, и вступил не туда.' },
        { label: 'шаг 2', vars: { доля: 2, костя: 'играет' }, expect: 'ТАРЕЛКА', why: 'Между ударами дыра — без тарелки ритм звучит пусто, и Костя торопится её заполнить.' },
        { label: 'шаг 3', vars: { доля: 3, костя: 'играет' }, expect: 'МАЛЫЙ', why: 'На третьем шаге должен хлестнуть малый барабан, а его нет — у ритма пропал «тыщ», хлопнуть не на что.' },
        { label: 'шаг 5', vars: { доля: 5, костя: 'играет' }, expect: 'БОЧКА', why: 'На пятом шаге нет бочки — вторая половина такта провисла, и Костя сбился.' },
        { label: 'шаг 7', vars: { доля: 7, костя: 'играет' }, expect: 'МАЛЫЙ', why: 'На седьмом шаге малого нет — такт закончился без удара, прохожие сбились с шага.' },
        { label: 'шаг 8', vars: { доля: 8, костя: 'играет' }, expect: 'ТАРЕЛКА', why: 'Последний шаг такта пустой или громкий не к месту — переход к следующему такту споткнулся.' },
        { label: 'Костя молчит', vars: { доля: 1, костя: 'молчит' }, expect: 'ТИШИНА', why: 'Костя замолчал, чтобы сказать людям «спасибо», а бочка гремит поверх его голоса.' },
      ],
    },
  ],
  thanks: 'Костя: «Я ускоряюсь — и ритм со мной. Люди хлопают на малый барабан, чехол полный. «ТИСКИ-Минус» пусть сами под себя играют».',
  next: [
    'настоящая программа для ритмов, например драм-машина или секвенсор: та же сетка шагов, только звуков больше и тактов много',
    'как ритм слушает музыканта: темп по его игре, паузы и сбивки — то, что ты сделал правилом «Костя молчит»',
  ],
};

// РУЧКИ: первое, что заметит человек, — одной фразой.
export function knobs(v) {
  const hitsOf = (s) => {
    const h = [];
    if (v.kick === 'all' || (v.kick === '15' && (s === 1 || s === 5))) h.push('kick');
    if ((v.snare === '37' && (s === 3 || s === 7)) || (v.snare === '1' && s === 1)) h.push('snare');
    if (v.hat === 'all' || (v.hat === 'even' && s % 2 === 0)) h.push('hat');
    return h;
  };
  const his = v.tempo === 'his';
  const r = run(steps(hitsOf, (s, h) => same(h, TARGET[s]) && (his || s < 5)), { mode: 'beat', tempo: his ? 'his' : 'fixed' });
  if (v.kick === 'all') return { ok: false, why: 'Бочка бьёт на каждом шаге, как отбойный молоток — люди морщатся и прибавляют шаг.', run: r };
  if (v.kick === 'none') return { ok: false, why: 'Без бочки у ритма нет пульса — непонятно, где начало такта, никто не притопывает.', run: r };
  if (v.snare === '1') return { ok: false, why: 'Малый ударил вместе с бочкой — вышел один громкий хлопок вместо «бум — тыщ», и Костя сбился.', run: r };
  if (v.snare === 'none') return { ok: false, why: 'Без малого барабана ритм — одно «бум… бум…»: хлопнуть в ладоши не на что.', run: r };
  if (v.hat === 'all') return { ok: false, why: 'Тарелка трещит на каждом шаге поверх всего — звенит как будильник, голоса Кости не слышно.', run: r };
  if (v.hat === 'none') return { ok: false, why: 'Между ударами дыры — ритм звучит пусто, и Костя торопится их заполнить.', run: r };
  if (!his) return { ok: false, why: 'Ритм идёт ровно, а Костя к припеву ускоряется — с пятого шага они разошлись, и песня развалилась.', run: r };
  return { ok: true, why: 'Бочка на 1 и 5, малый на 3 и 7, тарелка между ними — и всё идёт за Костей. Люди остановились, в чехол летят монеты.', run: r };
}

// КОД: что сказало правило → какой звук в сцене.
export function fate(c) {
  return { 'БОЧКА': 'kick', 'МАЛЫЙ': 'snare', 'ТАРЕЛКА': 'hat', 'ТИШИНА': 'rest' }[c.got] ?? 'lost';
}

export const label = 'БИТМЕЙКЕР';

// ------------------------------------------------------------- сцена
// Переход у метро: слева Костя с гитарой и колонкой, справа вверху — сетка из восьми
// шагов (бочка, малый, тарелка); клетки загораются по шагам. Когда звучит верно, над
// колонкой прыгают полоски и летят ноты, прохожие останавливаются и бросают монеты в
// чехол. Когда неверно — красная метка на клетке, кривые ноты, люди идут мимо. На
// «ТИСКИ-Минус» поверх сетки лежит их красная звуковая метка.
const ROWS = [['kick', 'БОЧКА', rgb(255, 120, 60)], ['snare', 'МАЛЫЙ', C.gold], ['hat', 'ТАРЕЛКА', C.cyan]];
const GX = 146, GY = 40, CW = 20, CH = 11;
const HIT = { kick: ['kick'], snare: ['snare'], hat: ['hat'], rest: [], lost: [] };
const stepOf = (a) => a.step ?? a.vars?.доля ?? 1;
const hitsOf = (a) => a.hits ?? HIT[a.fate] ?? [];

function note(P, x, y, c) { x = Math.round(x); y = Math.round(y); P.rect(x, y + 4, 3, 2, c); P.rect(x + 2, y, 1, 5, c); P.rect(x + 3, y, 2, 1, c); }
function guitar(P, x, y, strum) {
  P.disc(x, y, 4, C.wood); P.disc(x + 4, y - 2, 3, C.wood); P.put(x + 1, y - 1, C.dark);
  P.line(x + 5, y - 4, x + 14, y - 12, rgb(70, 46, 26));
  if (strum) P.rect(x - 1, y - 3, 2, 1, C.white);
}
function kostya(P, playing, time) {
  person(P, 30, 98, rgb(60, 110, 70), { scale: 2, frame: playing ? Math.floor(time * 4) % 2 : 0 });
  guitar(P, 34, 109, playing && Math.floor(time * 8) % 2);
  tag(P, 35, 122, 'КОСТЯ', C.gold);
}
function grid(P, cur, cells) {
  P.rect(GX - 50, GY - 12, 214, 54, rgb(18, 20, 26)); P.box(GX - 50, GY - 12, 214, 54, rgb(70, 74, 90));
  for (let s = 1; s <= BEAT_STEPS; s++) tag(P, GX + (s - 1) * CW + CW / 2, GY - 9, String(s), s === cur ? C.white : C.dim);
  ROWS.forEach(([key, name, col], r) => {
    P.rtext(GX - 4, GY + r * CH + 2, name, col);
    for (let s = 1; s <= BEAT_STEPS; s++) {
      const x = GX + (s - 1) * CW + 2, y = GY + r * CH, c = cells[`${r}:${s}`];
      P.rect(x, y, CW - 4, CH - 2, c === 'on' ? col : c === 'bad' ? C.red : rgb(36, 38, 46));
      if (s === cur) P.box(x - 1, y - 1, CW - 2, CH, C.white);
    }
  });
}
function bars(P, hits, k, ok) {
  // колонка и прыгающие полоски над ней — звук, показанный глазами
  P.rect(64, 100, 18, 26, rgb(30, 30, 36)); P.box(64, 100, 18, 26, rgb(90, 90, 100));
  P.disc(73, 116, 5, rgb(60, 60, 70)); P.disc(73, 116, 2, rgb(20, 20, 24)); P.disc(73, 105, 2, rgb(60, 60, 70));
  const amp = Math.max(0, 1 - k);
  ROWS.forEach(([key, , col], i) => {
    const h = hits.includes(key) ? Math.round(4 + 14 * amp) : 1;
    P.rect(65 + i * 6, 98 - h, 4, h, ok ? col : C.red);
  });
}
export function paint(P, view) {
  const { time, t, result, actors } = view;
  // стены перехода — кафель, пол, табличка
  P.rect(0, TOP, W, 104, rgb(40, 58, 62));
  for (let y = TOP; y < 118; y += 8) P.rect(0, y, W, 1, rgb(32, 46, 50));
  for (let x = 0; x < W; x += 12) P.rect(x, TOP, 1, 104, rgb(34, 50, 54));
  P.rect(0, 118, W, BOTTOM - 118, rgb(70, 66, 60)); P.rect(0, 118, W, 1, rgb(100, 96, 88));
  tag(P, 48, 18, 'ПЕРЕХОД · МЕТРО', C.white);
  const mode = result?.run?.mode ?? 'beat', tempo = result?.run?.tempo;
  // чехол от гитары
  P.rect(10, 138, 42, 8, rgb(30, 24, 20)); P.box(10, 138, 42, 8, rgb(80, 60, 40));

  if (view.idle) {
    const cur = (Math.floor(time * 3) % BEAT_STEPS) + 1, cells = {};
    ROWS.forEach(([key], r) => { for (let s = 1; s <= BEAT_STEPS; s++) if (TARGET[s].includes(key) && s === cur) cells[`${r}:${s}`] = 'on'; });
    grid(P, cur, cells); kostya(P, true, time); bars(P, TARGET[cur], (time * 3) % 1, true);
    for (let i = 0; i < 3; i++) person(P, ((W + 20 - (time * 18 + i * 110)) % (W + 40)) - 10, 130, rgb(90 + i * 40, 80, 120), { scale: 2, frame: Math.floor(time * 4 + i) % 2 });
    return;
  }

  // какие клетки уже прозвучали, какой шаг звучит сейчас, верно ли всё до сих пор
  const cells = {}; let cur = 0, now = null, nowK = 1, bad = false, coins = 0, last = null, silentNow = false;
  actors.forEach((a, i) => {
    const [ph, k] = phaseOf(i, t); if (ph === 'wait') return;
    const s = stepOf(a), h = hitsOf(a);
    if (ph === 'walk') { cur = s; return; }
    cur = s; last = a;
    ROWS.forEach(([key], r) => { if (h.includes(key)) cells[`${r}:${s}`] = a.ok ? 'on' : 'bad'; });
    if (!a.ok && !h.length) ROWS.forEach((_, r) => { if (TARGET[s].includes(ROWS[r][0])) cells[`${r}:${s}`] = 'bad'; });
    if (!a.ok) bad = true; else coins++;
    if (ph === 'fate') { now = a; nowK = k; }
    silentNow = a.vars?.костя === 'молчит' && ph !== 'done';
  });
  grid(P, cur, cells);
  if (mode === 'tiski') {
    // звуковая метка «ТИСКОВ» поверх сетки
    P.tint(GX - 50, GY - 12, 214, 54, [150, 20, 20], 0.35);
    P.rect(GX + 14, GY + 9, 92, 13, rgb(170, 30, 30)); tag(P, GX + 60, GY + 12, '«ТИСКИ-МИНУС»', C.white);
    for (let i = 0; i < 3; i++) { const k = (time * 0.7 + i / 3) % 1; P.text(104 + i * 12, 110 - k * 22, '₽', C.gold); }
  }
  if (tempo) tag(P, GX + 58, GY + 46, tempo === 'his' ? 'ТЕМП ИДЁТ ЗА КОСТЕЙ' : 'ТЕМП РОВНЫЙ, НЕ ЖДЁТ', tempo === 'his' ? C.green : C.red);
  if (mode === 'none') tag(P, GX + 58, GY + 46, 'БЕЗ РИТМА · ОДНА ГИТАРА', C.dim);

  kostya(P, !silentNow, time);
  if (silentNow) { P.rect(48, 84, 50, 11, C.white); tag(P, 73, 86, 'СПАСИБО!', C.dark); }
  const nh = now ? hitsOf(now) : [];
  bars(P, nh, nowK, !now || now.ok);
  if (now && nh.length) for (let i = 0; i < 2; i++) {
    const k = (nowK + i * 0.5) % 1;
    note(P, 70 + i * 14 + (now.ok ? 0 : Math.sin(time * 20 + i) * 3), 90 - k * 40, now.ok ? C.white : C.red);
  }
  if (now && !now.ok) {
    const s = stepOf(now), r = Math.max(0, ROWS.findIndex(([key]) => (nh.length ? nh : TARGET[s]).includes(key)));
    wrongMark(P, GX + (s - 1) * CW + CW / 2, GY + r * CH + 4, time);
  }

  // прохожие: верно — останавливаются и бросают монеты, неверно — идут мимо
  const stopAt = [112, 142, 172];
  for (let i = 0; i < 3; i++) {
    const free = W + 10 - (t * 34 + i * 40);
    const stay = !bad && mode !== 'none' && actors.length > 0;
    const x = stay ? Math.max(stopAt[i], free) : free;
    if (x < -10) continue;
    const standing = stay && x === stopAt[i];
    person(P, x, 130, rgb(90 + i * 40, 80, 120 + i * 20), { scale: 2, frame: standing ? 0 : Math.floor(t * 5 + i) % 2 });
    if (standing) { // монета летит в чехол
      const k = ((t * 0.8 + i * 0.33) % 1);
      if (k < 0.8) P.rect(lerp(x + 4, 30, ease(k / 0.8)), lerp(136, 140, ease(k / 0.8)) - Math.sin(k / 0.8 * Math.PI) * 16, 2, 2, C.gold);
    }
  }
  for (let i = 0; i < Math.min(coins, 12); i++) P.rect(13 + i * 3, 140 + (i % 2) * 2, 2, 2, C.gold);
  if (bad && last) tag(P, 220, 150, 'ЛЮДИ ИДУТ МИМО', C.red);
  else if (coins >= 3) tag(P, 220, 150, 'ЛЮДИ ОСТАНОВИЛИСЬ', C.green);
}
