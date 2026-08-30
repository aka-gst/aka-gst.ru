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

const книга = JSON.parse(readFileSync(join(root, 'data/stories.json'), 'utf8'));
const работа = [];
for (const c of книга.сборники) {
  if (c.cover) работа.push({ файл: c.cover, вид: 'polka', делать: полка });
  for (const st of c.stories) if (st.cover) работа.push({ файл: st.cover, вид: 'mini', делать: мини });
}

const списокПуть = join(covers, 'proizvodnye.json');
const было = existsSync(списокПуть) && !заново
  ? JSON.parse(readFileSync(списокПуть, 'utf8'))
  : {};
const стало = {};

mkdirSync(join(covers, 'mini'), { recursive: true });
mkdirSync(join(covers, 'polka'), { recursive: true });

let сделано = 0;
let весДо = 0;
let весПосле = 0;
for (const { файл, вид, делать } of работа) {
  const исток = join(covers, файл);
  const цель = join(covers, вид, файл);
  const ключ = `${вид}/${файл}`;
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
