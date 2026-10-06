// Шапка новой главной на страницах рассказов — правка Сергея №14, 02.10.2026:
// «не переделал отдельные рассказы, когда читаешь — в том же странном цвете,
// не в духе нашего нового сайта».
//
// Своей копии шапки у рассказов нет. Шаг берёт из собранной stories.html
// (её только что положил tools/novaya-glavnaya.mjs) ровно три вещи — стили,
// скрипты фразы и саму шапку — и вставляет их в /rasskazy/ на места,
// которые build.mjs оставил метками. Поправят шапку или версию site.css на
// главной — рассказы получат то же самое при той же сборке (правило 27).
//
// Список страниц — из data/stories.json (белый список), а не обход папки:
// случайная папка в rasskazy/ не должна молча получить чужую шапку.
// Любая неожиданность — стоп сборки, а не тихий пропуск (правило 7р).
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const откуда = readFileSync(path.join(root, 'stories.html'), 'utf8');

const ровноОдин = (образец, что) => {
  const найдено = откуда.match(образец) || [];
  if (найдено.length !== 1) throw new Error(`stories.html: ${что} — найдено ${найдено.length}, нужно ровно 1`);
  return найдено[0];
};

const стили = ровноОдин(/<link rel="stylesheet" href="\/site\.css(?:\?v=[^"]*)?">/g, 'стили новой главной');
const фразы = ровноОдин(/<script defer src="\/phrases\.js(?:\?v=[^"]*)?"><\/script>/g, 'фразы шапки');
const скрипт = ровноОдин(/<script defer src="\/site\.js(?:\?v=[^"]*)?"><\/script>/g, 'скрипт шапки');
const шапка = ровноОдин(/<header class="site-header">[\s\S]*?<\/header>/g, 'шапка');

// Страницы рассказов лежат на два уровня ниже корня: относительный путь
// в шапке увёл бы со /rasskazy/x/ не туда. Боевая главная пишет пути от корня.
const относительные = шапка.match(/\s(?:href|src)="(?:\.\.?\/)[^"]*"/g);
if (относительные) throw new Error(`шапка stories.html с относительными путями: ${относительные.join(' ')}`);
if (!/aria-current="page">Рассказы</.test(шапка)) throw new Error('в шапке stories.html раздел «Рассказы» не отмечен текущим');

const МЕТКИ = {
  '<!-- SHAPKA-RASSKAZOV:HEAD -->': [стили, фразы, скрипт].join('\n    '),
  '<!-- SHAPKA-RASSKAZOV:HEADER -->': шапка,
};

const book = JSON.parse(readFileSync(path.join(root, 'data', 'stories.json'), 'utf8'));
const страницы = [
  'rasskazy/index.html',
  ...book.сборники.flatMap((c) => c.stories.map((st) => `rasskazy/${st.slug}/index.html`)),
];

const сколько = (html, что) => html.split(что).length - 1;

for (const файл of страницы) {
  const полный = path.join(root, файл);
  let html = readFileSync(полный, 'utf8');
  const меток = Object.keys(МЕТКИ).map((м) => сколько(html, м));
  if (меток.every((n) => n === 0)) {
    // Меток нет — страницу уже обработала параллельная сборка (тесты гоняют
    // build.mjs из двух файлов разом). Не пропуск: проверяем, что на месте
    // ровно то, что вставили бы сами, иначе стоп.
    const чужое = [стили, фразы, скрипт, шапка].filter((к) => сколько(html, к) !== 1);
    if (чужое.length) throw new Error(`${файл}: меток нет, а шапка новой главной не та или не одна — ${чужое.length} кусков не сходятся`);
    continue;
  }
  if (!меток.every((n) => n === 1)) throw new Error(`${файл}: метки ${Object.keys(МЕТКИ).join(', ')} встречаются ${меток.join(' и ')} раз, нужно ровно по 1`);
  for (const [метка, вставка] of Object.entries(МЕТКИ)) html = html.replace(метка, () => вставка);
  writeFileSync(полный, html);
}
console.log(`Шапка новой главной: ${страницы.length} страниц рассказов`);
