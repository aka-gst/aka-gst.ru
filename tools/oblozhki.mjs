// Готовит уменьшенные копии обложек для оглавления рассказов.
//
//   node tools/oblozhki.mjs        собрать недостающие и устаревшие
//   node tools/oblozhki.mjs --все  пересобрать всё заново
//
// Зачем. В оглавлении обложка рассказа показывается квадратом 44 пикселя, а
// лежит файлом в 900 пикселей и четверть мегабайта. Браузер скачивал картинку
// примерно в четыреста раз больше той, что рисовал, и первый заход на
// /rasskazy/ стоил 2.3 МБ — при том что сама разметка весит 19 КБ.
//
// Почему jpeg, а не webp. Webp тут дал бы ещё минус треть, но кодировщика в
// системе нет ни одного: cwebp не установлен, ffmpeg собран без libwebp, а
// sips показывает webp в списке форматов без пометки Writable — то есть
// читает, но не пишет. Врать в отчёте про webp, отдавая jpeg, нельзя, поэтому
// здесь честный jpeg. Основную экономию даёт не формат, а размер: 266 КБ
// против 8 КБ — это уменьшение, webp сверху добавил бы три килобайта.
//
// Оригиналы не трогаются: на странице самого рассказа обложка показывается во
// всю меру текста, и там нужен большой файл.

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const covers = join(root, 'assets/covers');
const заново = process.argv.includes('--все');

// Размеры считаны с вёрстки, а не выбраны на глаз:
//   .story-thumb  — 44×44, object-fit: cover  → 132 под экраны тройной плотности
//   .book-cover   — height 300, object-fit: contain → 600 под двойную
// Тройная плотность для миниатюры и двойная для обложки — потому что разница в
// весе у миниатюры копеечная, а у обложки сборника уже заметная.
const МИНИ = 132;
const ПОЛКА = 600;

const sips = (args) => {
  const r = spawnSync('sips', args, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`sips: ${(r.stderr || '').trim().slice(0, 200)}`);
  return r.stdout;
};

const размер = (файл) => {
  const out = sips(['-g', 'pixelWidth', '-g', 'pixelHeight', файл]);
  const w = Number(out.match(/pixelWidth:\s*(\d+)/)?.[1]);
  const h = Number(out.match(/pixelHeight:\s*(\d+)/)?.[1]);
  if (!w || !h) throw new Error(`не прочитан размер: ${файл}`);
  return { w, h };
};

const хеш = (путь) =>
  createHash('sha256').update(readFileSync(путь)).digest('hex').slice(0, 12);

// Квадрат под object-fit: cover — сначала подгоняем короткую сторону, потом
// режем по центру. Обрезка sips центральная, как и у браузера, поэтому
// миниатюра показывает ровно тот кусок, что показывал полный файл.
const мини = (исток, цель) => {
  const { w, h } = размер(исток);
  const сторона = w <= h ? '--resampleWidth' : '--resampleHeight';
  sips([сторона, String(МИНИ), '-s', 'format', 'jpeg', '-s', 'formatOptions', '72',
    исток, '--out', цель]);
  sips(['-c', String(МИНИ), String(МИНИ), цель]);
};

const полка = (исток, цель) => {
  sips(['--resampleHeight', String(ПОЛКА), '-s', 'format', 'jpeg', '-s', 'formatOptions', '78',
    исток, '--out', цель]);
};

// Кусок обложки сборника для рассказа, у которого своей обложки нет.
// Решение владельца 31 августа: «там где нет обложек — ставить обложку
// сборника». Ставим не одну и ту же картинку десять раз, а разные её
// участки: у «А потом наступит счастье» без обложки ВСЕ семь рассказов,
// и семь одинаковых квадратиков подряд — это уже не список, различить в
// нём труднее, чем когда картинок нет вовсе (правило 17).
//
// Участки берём КОЛЬЦОМ ВОКРУГ ЦЕНТРА, а не решёткой по всему полю.
// Первая попытка раскладывала их по девяти углам, и вышло тринадцать
// почти чёрных квадратиков: Кассиопея — это туманность в середине и
// пустой космос по краям, а у рисованных обложек по краям поля лежит
// название. Крайние участки честно снимали пустоту и обрывки букв.
//
// Смещение здесь в долях ПОЛОВИНЫ свободного хода: 0 — точный центр,
// 1 — упор в край. Держимся в пределах трети, там у всех трёх обложек
// есть содержимое.
const УЧАСТКИ = [
  [0.00, 0.00],
  [0.30, 0.00], [-0.30, 0.00], [0.00, 0.30], [0.00, -0.30],
  [0.22, 0.22], [-0.22, 0.22], [0.22, -0.22], [-0.22, -0.22],
];

// `сдвиг` — куда смещать всё кольцо по вертикали, в долях половины хода.
// У «Трёх изнутри» верх занят названием, и без сдвига вниз миниатюры
// получались обрывками букв: «ТРИ ИЗ», «И ИЗНУ».
const кусок = (номер, сдвиг = 0) => (исток, цель) => {
  const { w, h } = размер(исток);
  const окно = Math.round(Math.min(w, h) * 0.42);
  const [дх, ду] = УЧАСТКИ[номер % УЧАСТКИ.length];
  // sips считает смещение ОТ ЦЕНТРА кадра — проверено опытом, а не взято
  // из справки: там второй параметр подписан offsetH, хотя это по горизонтали.
  const x = Math.round(дх * (w - окно) / 2);
  const y = Math.round(Math.max(-1, Math.min(1, ду + сдвиг)) * (h - окно) / 2);
  sips(['-c', String(окно), String(окно), '--cropOffset', String(y), String(x),
    '-s', 'format', 'jpeg', '-s', 'formatOptions', '72', исток, '--out', цель]);
  sips(['--resampleWidth', String(МИНИ), цель]);
};

const книга = JSON.parse(readFileSync(join(root, 'data/stories.json'), 'utf8'));
const работа = [];
for (const c of книга.сборники) {
  if (c.cover) работа.push({ файл: c.cover, вид: 'polka', делать: полка });
  let без = 0;
  for (const st of c.stories) {
    if (st.cover) { работа.push({ файл: st.cover, вид: 'mini', делать: мини }); continue; }
    if (!c.cover) continue;
    работа.push({ файл: c.cover, вид: `kusok/${st.slug}`, делать: кусок(без, Number(c.фокус) || 0) });
    без += 1;
  }
}

const списокПуть = join(covers, 'proizvodnye.json');
const было = existsSync(списокПуть) && !заново
  ? JSON.parse(readFileSync(списокПуть, 'utf8'))
  : {};
const стало = {};

mkdirSync(join(covers, 'mini'), { recursive: true });
mkdirSync(join(covers, 'polka'), { recursive: true });
mkdirSync(join(covers, 'kusok'), { recursive: true });

let сделано = 0;
let весДо = 0;
let весПосле = 0;
for (const { файл, вид, делать } of работа) {
  const исток = join(covers, файл);
  // У обычной копии вид — это папка (mini/, polka/), а у куска обложки вид
  // уже несёт имя рассказа (kusok/vstuplenie). Пока путь считался одинаково,
  // все миниатюры писались в один файл assets/covers/mini.jpg.
  const цель = вид.includes('/') ? join(covers, `${вид}.jpg`) : join(covers, вид, файл);
  const ключ = вид.includes('/') ? `${вид}.jpg` : `${вид}/${файл}`;
  const h = хеш(исток);
  весДо += statSync(исток).size;

  if (было[ключ] === h && existsSync(цель)) {
    стало[ключ] = h;
    весПосле += statSync(цель).size;
    continue;
  }
  делать(исток, цель);
  стало[ключ] = h;
  сделано += 1;
  весПосле += statSync(цель).size;
  const { w, h: hh } = размер(цель);
  console.log(`  ${ключ.padEnd(40)} ${w}×${hh}  ${Math.round(statSync(исток).size / 1024)} → ${Math.round(statSync(цель).size / 1024)} КБ`);
}

writeFileSync(списокПуть, `${JSON.stringify(стало, null, 2)}\n`);
console.log(`\nпересобрано ${сделано} из ${работа.length}`);
console.log(`оглавление тянуло ${Math.round(весДо / 1024)} КБ, станет ${Math.round(весПосле / 1024)} КБ`);
