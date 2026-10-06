// Новая главная aka-gst.ru — решение Сергея 02.10.2026 («да, после твоих проверок»).
//
// Кандидат живёт в design-preview/site/ (Кодекс, 30.09–01.10, независимая приёмка
// интерфейса PASS) и собирается своим build-content.mjs из тех же data/*.json.
// Этот шаг кладёт три его страницы в корень сайта и делает из них боевые:
//  - пути ../../ (картинки и значок из корня) → ./, ссылки https://aka-gst.ru/x → /x
//    (проверка сирот в verify.sh видит только ссылки вида href="/...");
//  - вписывает счётчик /pulse и превью для соцсетей — у локального кандидата их не было;
//  - копирует стили, скрипты, шрифты, страницу геймдизайна и свои картинки кандидата.
// Запускается последним шагом build.mjs, поэтому deploy.sh и verify.sh видят новую главную.
// Откат — убрать вызов из build.mjs: старая главная по-прежнему собирается раньше.
import { readFileSync, writeFileSync, cpSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'design-preview', 'site');
execFileSync(process.execPath, [path.join(src, 'build-content.mjs')], { stdio: 'inherit' });

const site = JSON.parse(readFileSync(path.join(root, 'data', 'site.json'), 'utf8'));
// Растровые значки берём у старой главной: build.mjs только что собрал её и
// поставил версию по содержимому (?v=…), тест favicon требует их на каждой странице.
const oldIndex = globalThis.__starayaGlavnaya ?? readFileSync(path.join(root, 'index.html'), 'utf8');
const icons = [...oldIndex.matchAll(/<link rel="(?:icon|apple-touch-icon)"[^>]*>/g)].map(m => m[0]).filter(l => !l.includes('favicon.svg'));
if (!icons.some(l => l.includes('favicon-32.png'))) throw new Error('в собранной главной нет favicon-32.png — значки взять неоткуда');
const pages = { 'index.html': '/', 'games.html': '/games.html', 'stories.html': '/stories.html' };
const esc = v => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

for (const [file, urlPath] of Object.entries(pages)) {
  let html = readFileSync(path.join(src, file), 'utf8');
  html = html.replaceAll('../../', './').replace(/(<a\b[^>]*?\shref=")https:\/\/aka-gst\.ru\//g, '$1/');
  // На бою пути от корня: сторожа verify.sh (ассеты, сироты) видят только href="/…".
  html = html.replace(/(\s(?:src|href|poster)=")\.\//g, '$1/');
  // Сайт с сентября на растровом значке (tests/favicon.test.mjs запрещает /favicon.svg) —
  // SVG-строку кандидата убираем, растровые вставляются ниже вместе со счётчиком.
  html = html.replace(/<link rel="icon" href="\/favicon\.svg"[^>]*>\s*/g, '');
  if (html.includes('../../')) throw new Error(`${file}: остался путь ../../`);
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1];
  const description = html.match(/<meta name="description" content="([^"]*)"/)?.[1];
  if (!title || !description) throw new Error(`${file}: нет <title> или description — превью собрать не из чего`);
  if (html.includes('/pulse/script.js') || html.includes('og:title')) throw new Error(`${file}: счётчик или превью уже есть — шаг запущен дважды по одному файлу?`);
  const url = `https://aka-gst.ru${urlPath}`;
  const head = [
    `<link rel="canonical" href="${url}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="aka-gst">`,
    `<meta property="og:locale" content="ru_RU">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    `<meta property="og:image" content="https://aka-gst.ru/og.png">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:image" content="https://aka-gst.ru/og.png">`,
    `<script defer src="/pulse/script.js" data-website-id="${esc(site.umamiId)}"></script>`,
    ...icons,
  ].join('\n');
  if ((html.match(/<\/head>/g) || []).length !== 1) throw new Error(`${file}: </head> должен быть ровно один`);
  html = html.replace('</head>', `${head}\n</head>`);
  writeFileSync(path.join(root, file), html);
}

for (const f of ['site.css', 'site.js', 'phrases.js']) cpSync(path.join(src, f), path.join(root, f));
for (const d of ['fonts', 'game-design']) cpSync(path.join(src, d), path.join(root, d), { recursive: true });
// Страница геймдизайна тоже выкладывается — счётчик и на ней (правило 30).
const gd = path.join(root, 'game-design', 'index.html');
let gdHtml = readFileSync(gd, 'utf8');
if (!gdHtml.includes('/pulse/script.js')) {
  if ((gdHtml.match(/<\/head>/g) || []).length !== 1) throw new Error('game-design: </head> должен быть ровно один');
  gdHtml = gdHtml.replace('</head>', `<script defer src="/pulse/script.js" data-website-id="${esc(site.umamiId)}"></script>\n</head>`);
  writeFileSync(gd, gdHtml);
}
const owned = new Set(readFileSync(path.join(root, 'tools', 'novaya-glavnaya-assets.txt'), 'utf8').split('\n').filter(Boolean));
for (const a of readdirSync(path.join(src, 'assets'))) {
  const from = path.join(src, 'assets', a), to = path.join(root, 'assets', a);
  // Свои картинки новой главной (список tools/novaya-glavnaya-assets.txt) обновляются свободно;
  // чужой файл с тем же именем в assets/ — стоп, чтобы не затереть картинку старых страниц.
  if (existsSync(to) && !owned.has(a) && !readFileSync(to).equals(readFileSync(from))) throw new Error(`assets/${a}: в корне лежит другой файл с тем же именем`);
  cpSync(from, to);
}
console.log('Новая главная: index.html, games.html, stories.html в корне');
