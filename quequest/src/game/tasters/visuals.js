// 20.x · ПРОБА «ВИЗУАЛЬЩИК» (шейдеры и генеративная графика, PLANS/ПЛАТФОРМА-НАВЫКОВ-РЫНОК.md).
// Рома — молодой диджей, сегодня его первый вечер в клубе «Подвал», а экран за пультом пустой;
// «ТИСКИ» продают «ТИСКИ-Визуал»: три одинаковые заставки по кругу с их логотипом. Идея пробы:
// картинка считается правилом для каждой точки экрана — из места, времени и громкости музыки.
//   ТЫК   — что рисует экран: их заставки / своё правило, которое слышит удар / фотография;
//   РУЧКИ — за чем идёт цвет, насколько ярко на ударе, как быстро бегут волны;
//   КОД   — правило словами: громкость + доля такта → ВСПЫШКА / ВОЛНА / ТЕМНО.
// Модуль задаёт данные, судью ручек, судьбу случая в сцене и саму сцену; рама проб
// (career-tasters.js, taster-scene.js) подключает его через src/game/tasters/index.js.
import { C, rgb, W, TOP, BOTTOM, clamp, lerp, ease, phaseOf, person, tag, wrongMark } from '../taster-art.js';

export const skill = { name: 'Свет и картинка из правил (визуал)', guild: 'ai' };

// Шесть мгновений одного трека. right — что должен показать экран в это мгновение.
export const VIS_MOMENTS = Object.freeze([
  { name: 'бочка на первой доле', loud: 90, beat: 1, right: 'flash' },
  { name: 'середина такта', loud: 50, beat: 2, right: 'wave' },
  { name: 'громко, третья доля', loud: 85, beat: 3, right: 'wave' },
  { name: 'пауза перед припевом', loud: 5, beat: 1, right: 'dark' },
  { name: 'тихое вступление', loud: 30, beat: 1, right: 'wave' },
  { name: 'стоп в музыке', loud: 10, beat: 3, right: 'dark' },
]);
const run = (fates, extra = {}) => ({
  actors: VIS_MOMENTS.map((m, i) => ({ name: m.name, kind: m.right, loud: m.loud, beat: m.beat, fate: fates[i], ok: fates[i] === m.right })),
  ...extra,
});
const RIGHT_FATES = VIS_MOMENTS.map((m) => m.right);

export const taster = {
  id: 'visuals', name: 'Визуальщик', glyph: '◐', skill: 'shader',
  title: 'ВИЗУАЛЬЩИК · КЛУБ «ПОДВАЛ»',
  line: 'Рисуешь экран за диджеем правилом: каждая точка считает свой цвет из места, времени и громкости музыки.',
  victim: 'Рома', who: 'молодой диджей, сегодня первый вечер в клубе «Подвал»',
  story: 'Сегодня у Ромы первый вечер в клубе «Подвал», а большой экран за пультом пустой. «ТИСКИ» продают ему «ТИСКИ-Визуал» за 2490 ₽ в месяц: по кругу три одинаковые заставки с их логотипом — хоть бочка бьёт, хоть тишина. Зал смотрит на чёрный экран и уходит к бару.',
  pay: [100, 150, 250],
  pitch: {
    fantasy: 'Экран, который слышит музыку.',
    verbs: ['выбрать, что рисует экран за диджеем', 'настроить, как картинка отвечает на удар', 'записать правило картинки словами Python'],
    life: 'В жизни этим заняты визуальщики: свет и картинка на концертах, в клубах, на выставках и в клипах — то, что считается само из музыки и времени.',
  },
  levels: [
    {
      way: 'tap', title: 'Что рисует экран',
      goal: 'Чтобы экран за Ромой жил вместе с музыкой, а зал танцевал, а не смотрел в телефоны.',
      choices: [
        { id: 'tiski', label: 'Подписаться на «ТИСКИ-Визуал»', note: '2490 ₽ в месяц', ok: false,
          why: 'По кругу три заставки с логотипом «ТИСКОВ»: бочка бьёт, а экран плывёт сам по себе. Через полчаса зал узнал заставку и перестал смотреть. А Рома платит каждый месяц.',
          run: run(['logo', 'logo', 'logo', 'logo', 'logo', 'logo'], { mode: 'tiski' }) },
        { id: 'rule', label: 'Своя картинка по правилу: цвет каждой точки — из места, времени и громкости', note: 'экран слушает музыку', ok: true,
          why: 'Экран слушает музыку: на ударе бочки вспыхивает, в середине такта бегут волны, в тишине гаснет. Зал танцует под картинку. Одно мгновение вышло слишком ярким — это поправим дальше.',
          run: run(['flash', 'wave', 'flash', 'dark', 'wave', 'dark'], { mode: 'rule' }) },
        { id: 'photo', label: 'Поставить на экран красивую фотографию', note: 'бесплатно', ok: false,
          why: 'Красивый закат висит весь вечер и не шелохнётся. Музыка меняется, а картинка нет — через десять минут её никто не замечает.',
          run: run(['photo', 'photo', 'photo', 'photo', 'photo', 'photo'], { mode: 'photo' }) },
      ],
    },
    {
      way: 'knobs', title: 'Настрой картинку',
      goal: 'Картинка — это правило: за чем идёт цвет, как ярко на сильном ударе, как быстро бегут волны. Настрой его, чтобы экран дышал вместе с треком.',
      knobs: [
        { id: 'follow', label: 'За чем идёт цвет', options: [['time', 'за временем: плывёт сам'], ['beat', 'за ударом музыки']], start: 'time' },
        { id: 'flash', label: 'Яркость на сильном ударе', options: [['low', 'чуть светлее'], ['mid', 'вспышка'], ['max', 'белым на весь зал']], start: 'max' },
        { id: 'speed', label: 'Скорость волн', options: [['slow', 'медленно'], ['tempo', 'в такт музыке'], ['fast', 'быстро']], start: 'slow' },
      ],
      knobsWin: { follow: 'beat', flash: 'mid', speed: 'tempo' },
    },
    {
      way: 'code', title: 'Картинка — словами',
      goal: 'Сейчас экран вспыхивает на каждой первой доле — даже в тишине. Сделай так: тише 20 — темно; громче 70 и первая доля — вспышка; всё остальное — волна.',
      legend: [['громкость', 'насколько громко сейчас играет музыка, от 0 до 100'], ['доля', 'какой удар такта сейчас: 1, 2, 3 или 4; на первой бьёт бочка'], ['and', '«и»: обе проверки должны выполниться сразу'], ['<  >', 'меньше и больше']],
      starter: 'if доля == 1:\n    print("ВСПЫШКА")\nelse:\n    print("ВОЛНА")',
      solution: 'if громкость < 20:\n    print("ТЕМНО")\nelif громкость > 70 and доля == 1:\n    print("ВСПЫШКА")\nelse:\n    print("ВОЛНА")',
      chips: ['if громкость < 20:', 'print("ТЕМНО")', 'elif громкость > 70 and доля == 1:', 'else:'],
      words: ['ВСПЫШКА', 'ВОЛНА', 'ТЕМНО'],
      cases: [
        { label: 'бочка на первой доле', kind: 'flash', vars: { громкость: 90, доля: 1 }, expect: 'ВСПЫШКА', why: 'Бочка ударила изо всех сил, а экран даже не моргнул — зал не почувствовал удара.' },
        { label: 'середина такта', kind: 'wave', vars: { громкость: 50, доля: 2 }, expect: 'ВОЛНА', why: 'В середине такта экран замер — картинка остановилась посреди песни.' },
        { label: 'громко, третья доля', kind: 'wave', vars: { громкость: 85, доля: 3 }, expect: 'ВОЛНА', why: 'Экран вспыхнул и на третьей доле — вспышки через каждые полсекунды, у людей слезятся глаза.' },
        { label: 'пауза перед припевом', kind: 'dark', vars: { громкость: 5, доля: 1 }, expect: 'ТЕМНО', why: 'Перед припевом музыка стихла, а экран всё равно вспыхнул — удар на экране пришёл раньше музыки, и весь припев смазан.' },
        { label: 'тихое вступление', kind: 'wave', vars: { громкость: 30, доля: 1 }, expect: 'ВОЛНА', why: 'Вступление тихое, а экран лупит вспышкой, как на припеве — зал не понимает, что сейчас будет.' },
        { label: 'стоп в музыке', kind: 'dark', vars: { громкость: 10, доля: 3 }, expect: 'ТЕМНО', why: 'Музыка остановилась, а на экране бегут волны — будто картинка не слышит, что песня кончилась.' },
      ],
    },
  ],
  thanks: 'Рома: «Зал смотрел на экран и прыгал на каждом ударе. Хозяин „Подвала“ позвал меня ещё на пятницу — и без всяких „ТИСКОВ“».',
  next: [
    'программы для живого визуала: то же правило «место + время + громкость → цвет», только на большой экран и прямо во время музыки',
    'считать цвет каждой точки правилом — так рисуют свет в играх, клипах и световых шоу',
  ],
};

// РУЧКИ: первое, что заметит человек в зале, — одной фразой.
export function knobs(v) {
  const beat = v.follow === 'beat';
  const wave = v.speed === 'tempo' ? 'wave' : v.speed === 'fast' ? 'fastwave' : 'slowwave';
  const flash = v.flash === 'mid' ? 'flash' : v.flash === 'max' ? 'blind' : 'dim';
  const fates = VIS_MOMENTS.map((m) => {
    if (!beat) return 'drift';
    if (m.right === 'dark') return 'dark';
    if (m.right === 'flash') return flash;
    return wave;
  });
  const r = run(fates, { mode: 'rule', speed: v.speed, flash: v.flash });
  if (!beat) return { ok: false, why: 'Цвет плывёт сам по себе: бочка бьёт, а экран не дрогнул. Люди танцуют под музыку, а не под картинку.', run: r };
  if (v.flash === 'max') return { ok: false, why: 'На каждом ударе экран белеет на весь зал — люди жмурятся и отворачиваются от сцены.', run: r };
  if (v.flash === 'low') return { ok: false, why: 'Удар бочки на экране почти не видно — зал не чувствует, где сильная доля.', run: r };
  if (v.speed === 'slow') return { ok: false, why: 'Волны ползут вдвое медленнее музыки — картинка будто из другой, сонной песни.', run: r };
  if (v.speed === 'fast') return { ok: false, why: 'Волны мельтешат быстрее музыки — рябит в глазах, и непонятно, где такт.', run: r };
  return { ok: true, why: 'Цвет идёт за ударом, вспышка яркая, но не слепит, волны бегут в такт. Зал прыгает вместе с экраном.', run: r };
}

// КОД: что сказало правило → что показал экран в сцене.
export function fate(c) {
  return { 'ВСПЫШКА': 'flash', 'ВОЛНА': 'wave', 'ТЕМНО': 'dark' }[c.got] ?? 'lost';
}

export const label = 'ВИЗУАЛЬЩИК';

// ------------------------------------------------------------- сцена
// Подвал: сверху большой экран, по бокам колонки, под экраном пульт Ромы, внизу танцпол.
// Экран считается клетками 4×4 — каждая клетка берёт цвет из своего места, времени и
// громкости, как настоящая картинка-правило. Люди танцуют, когда экран попал в музыку,
// и скучают, когда нет. Заставки «ТИСКОВ» — красные, с логотипом.
const SX = 64, SY = 28, SW = 192, SH = 56, CELL = 4;

function hue(h, s = 1, v = 1) {
  h = ((h % 1) + 1) % 1;
  const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), u = v * (1 - (1 - f) * s);
  const [r, g, b] = [[v, u, p], [q, v, p], [p, v, u], [p, q, v], [u, p, v], [v, p, q]][i % 6];
  return rgb((r * 255) | 0, (g * 255) | 0, (b * 255) | 0);
}

// Цвет одной клетки экрана: (u, v) — место от 0 до 1, time — время, k — сколько прошло от удара.
function cell(fateName, u, v, time, k, loud) {
  const dx = u - 0.5, dy = (v - 0.5) * 0.6, r = Math.sqrt(dx * dx + dy * dy);
  const waveAt = (sp) => 0.5 + 0.5 * Math.sin(u * 14 - time * sp + Math.sin(v * 5 + time) * 1.5);
  switch (fateName) {
    case 'flash': { const b = clamp(1 - r * 2.2 + (1 - k) * 0.6, 0, 1) * (1 - k * 0.6); return hue(0.85 + r * 0.3, 0.7, 0.25 + 0.75 * b); }
    case 'blind': return rgb(250, 250, 250);
    case 'dim': { const w = waveAt(4); return hue(0.62 + w * 0.15, 0.8, 0.3 + w * 0.35 + 0.08 * (1 - k)); }
    case 'wave': { const w = waveAt(4); return hue(0.55 + w * 0.25 + loud / 400, 0.85, 0.3 + w * 0.6); }
    case 'slowwave': { const w = waveAt(0.8); return hue(0.6 + w * 0.2, 0.6, 0.2 + w * 0.4); }
    case 'fastwave': { const w = 0.5 + 0.5 * Math.sin(u * 40 - time * 30 + v * 9); return hue(0.5 + w * 0.4, 0.9, 0.2 + w * 0.8); }
    case 'drift': return hue(time * 0.15 + u * 0.3, 0.6, 0.55);
    case 'dark': return ((u * 47 + v * 13) | 0) % 9 === 0 ? rgb(24, 22, 40) : rgb(6, 6, 12);
    case 'photo': return v < 0.55 ? hue(0.03 + v * 0.12, 0.7, 0.95 - v * 0.6) : (Math.abs(u - 0.5) < 0.12 && v < 0.75 ? rgb(250, 200, 90) : rgb(30, 40 + (v * 40) | 0, 80));
    case 'logo': {
      const which = Math.floor(time / 1.5) % 3;
      if (which === 0) return ((u * 12 + time) | 0) % 2 ? rgb(130, 20, 20) : rgb(70, 10, 10);
      if (which === 1) return (((u * 10) | 0) + ((v * 4) | 0)) % 2 ? rgb(120, 24, 24) : rgb(40, 8, 8);
      return r < 0.18 + 0.05 * Math.sin(time * 2) ? rgb(170, 30, 30) : rgb(50, 10, 10);
    }
    default: return ((u * 31 + v * 17 + time * 7) | 0) % 3 ? rgb(40, 40, 46) : rgb(70, 70, 76);
  }
}

function screen(P, fateName, time, k, loud) {
  P.rect(SX - 3, SY - 3, SW + 6, SH + 6, rgb(20, 20, 24)); P.box(SX - 3, SY - 3, SW + 6, SH + 6, rgb(80, 80, 90));
  if (!fateName) {
    P.rect(SX, SY, SW, SH, rgb(4, 4, 8));
    tag(P, SX + SW / 2, SY + SH / 2 - 3, 'ЭКРАН ПУСТОЙ', rgb(70, 70, 80));
    return;
  }
  for (let y = 0; y < SH; y += CELL) for (let x = 0; x < SW; x += CELL) P.rect(SX + x, SY + y, CELL, CELL, cell(fateName, x / SW, y / SH, time, k, loud));
  if (fateName === 'logo') {
    const bx = SX + SW / 2 + Math.sin(time * 1.3) * 50, by = SY + 22 + Math.sin(time * 1.9) * 12;
    P.ctext(Math.round(by), 'ТИСКИ', C.white, 2, bx);
    tag(P, bx, by + 16, 'ВИЗУАЛ', C.gold);
  }
  if (fateName === 'photo') tag(P, SX + SW - 18, SY + SH - 9, 'ФОТО', C.white);
}

function speaker(P, x, loud, time) {
  P.rect(x, 34, 30, 60, rgb(26, 24, 30)); P.box(x, 34, 30, 60, rgb(70, 66, 76));
  const pulse = loud > 60 ? Math.round(Math.abs(Math.sin(time * 8)) * 2) : 0;
  P.disc(x + 15, 50, 7 + pulse, rgb(50, 48, 56)); P.disc(x + 15, 50, 3, rgb(90, 88, 96));
  P.disc(x + 15, 76, 10 + pulse, rgb(50, 48, 56)); P.disc(x + 15, 76, 4, rgb(90, 88, 96));
}

const CROWD = [22, 58, 94, 210, 246, 282];
const BODIES = [rgb(200, 90, 150), rgb(90, 160, 220), rgb(230, 170, 60), rgb(120, 200, 120), rgb(180, 110, 230), rgb(230, 110, 90)];

export function paint(P, view) {
  const { time, t, result, actors } = view;
  P.rect(0, TOP, W, BOTTOM - TOP, rgb(18, 16, 22));
  for (let y = TOP; y < 100; y += 8) for (let x = (y / 8) % 2 ? 0 : 8; x < W; x += 16) P.rect(x, y, 7, 3, rgb(24, 21, 28));
  P.rect(0, 118, W, BOTTOM - 118, rgb(28, 24, 34));
  for (let x = 0; x < W; x += 20) P.rect(x, 118, 1, BOTTOM - 118, rgb(36, 32, 42));
  P.text(4, 16, 'КЛУБ «ПОДВАЛ»', C.dim);

  // что сейчас на экране: последнее мгновение, у которого уже наступил удар;
  // в конце — первое неверное, о нём говорит фраза под сценой
  let cur = -1, k = 0;
  if (!view.idle && actors.length) {
    actors.forEach((a, i) => { const [ph, kk] = phaseOf(i, t); if (ph === 'fate' || ph === 'done') { cur = i; k = ph === 'fate' ? kk : 1; } });
    if (cur === actors.length - 1 && phaseOf(cur, t)[0] === 'done') { const w = actors.findIndex((a) => !a.ok); if (w >= 0) { cur = w; k = (time % 0.5) * 2; } }
  }
  const a = cur >= 0 ? actors[cur] : null;
  const loud = a ? (a.loud ?? a.vars?.громкость ?? 50) : (view.idle ? 70 : 0);
  const beat = a ? (a.beat ?? a.vars?.доля ?? 1) : 1;
  const mode = result?.run?.mode;
  const idleFate = view.idle ? (view.level > 0 ? 'wave' : null) : (mode === 'tiski' ? 'logo' : mode === 'photo' ? 'photo' : null);
  screen(P, a ? a.fate : idleFate, time, ease(k), loud);
  speaker(P, 18, loud, time); speaker(P, 272, loud, time);

  // пульт Ромы, такт 1–4 и громкость
  person(P, 155, 92, rgb(40, 40, 60), { scale: 2, frame: Math.floor(time * 4) % 2 });
  P.rect(126, 106, 68, 14, rgb(40, 36, 46)); P.box(126, 106, 68, 14, rgb(100, 96, 110));
  P.disc(140, 113, 4, rgb(20, 20, 24)); P.disc(180, 113, 4, rgb(20, 20, 24));
  for (let i = 0; i < 4; i++) P.rect(152 + i * 5, 110, 3, 3, a && beat === i + 1 ? C.gold : rgb(60, 56, 66));
  P.rect(152, 115, 18, 2, rgb(30, 30, 36)); P.rect(152, 115, Math.round(18 * loud / 100), 2, loud > 70 ? C.red : loud < 20 ? C.dim : C.green);
  tag(P, 112, 110, 'РОМА', C.gold);

  // танцпол: попал экран в музыку — танцуют, нет — скучают
  const good = a ? a.ok : false;
  CROWD.forEach((x, i) => {
    if (good) person(P, x, 126 + Math.round(Math.sin(time * 9 + i) * 2), BODIES[i], { scale: 2, frame: Math.floor(time * 6 + i) % 2 });
    else person(P, x + (i % 2 ? 2 : -2), 128, rgb(80, 78, 88), { scale: 2, head: rgb(170, 150, 130) });
  });
  if (a) {
    tag(P, 160, 150, a.name.toUpperCase(), a.ok ? C.green : C.red);
    if (!a.ok) wrongMark(P, SX + SW - 10, SY + 12, time);
  } else if (view.idle && !view.level) tag(P, 160, 150, 'ЗАЛ СКУЧАЕТ', C.dim);

  // лента такта под экраном: какие мгновения уже прошли и как
  actors.forEach((x, i) => {
    const [ph] = phaseOf(i, t); const bx = SX + 4 + i * 32;
    P.rect(bx, SY + SH + 4, 28, 2, view.idle || ph === 'wait' || ph === 'walk' ? rgb(50, 48, 56) : x.ok ? C.green : C.red);
  });
}
