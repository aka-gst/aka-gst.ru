// Проверка на отказ для помощников, которые могут «не сделать».
//
// Заведена 5 сентября 2026 по распоряжению Сергея: «это частая проблема —
// почини и не допускай такого больше!» (правило 7р). Два помощника, setTrack
// и setCurrent, молча возвращались при неизвестном значении: наша же опечатка
// в вызове не делала НИЧЕГО и никто об этом не узнавал.
//
// Формула: молча для человека, громко для нас. Значение приходит извне
// (якорь в адресе, хранилище), поэтому страницу не роняем — но предупреждаем,
// и предупреждение видно проверкам.
//
//   node tools/proverka-otkaza.mjs                  # по бою
//   SITE=http://127.0.0.1:8820 node tools/proverka-otkaza.mjs
//
// ВАЖНО про случай B. Чепуха в localStorage до setTrack НЕ доходит: встроенный
// скрипт в шапке отсеивает её раньше. Я на этом сперва и попался — проверка
// краснела на исправном коде. Настоящий путь к guard — наша же разметка,
// setTrack(button.dataset.trackTo). Проверять надо путь, а не намерение.
//
// Случай A обязателен: без него проверка зеленела бы и на коде, который орёт
// на всё подряд. У проверки должны быть оба исхода (правило 7и).
//
// Код выхода: 0 — все три случая как ожидалось, 1 — хоть один разошёлся.

// Проверка на отказ (правило 7р). Три случая, и третий обязателен:
//   A. норма          → криков быть НЕ должно
//   B. чепуха в хранилище → [app] setTrack обязан крикнуть
//   C. несуществующая глава в адресе → [put] setCurrent обязан крикнуть
// Без случая A проверка зеленела бы и на коде, который орёт всегда.
import { запуститьChrome, подключиться, sleep } from './igrat.mjs';
const БАЗА = process.env.SITE || 'https://aka-gst.ru';
const ПЕРЕХВАТ = 'window.__k=[];(function(){const o=console.warn;console.warn=function(){window.__k.push(Array.prototype.join.call(arguments," "));o.apply(console,arguments);};})();';

// Порт свой на каждый случай: предыдущий Chrome отпускает его не мгновенно,
// и второй прогон падал на пустом списке целей.
let порт = 9380;
const прогон = async (адрес, доЗагрузки, послеЗагрузки) => {
  порт += 1;
  const ПОРТ = порт;
  const chrome = запуститьChrome(ПОРТ, '900,700');
  try {
    const send = await подключиться(ПОРТ);
    await send('Page.enable'); await send('Runtime.enable');
    if (доЗагрузки) {                       // хранилище живёт на источнике —
      await send('Page.navigate', { url: БАЗА + '/' });   // сперва попасть туда
      await sleep(900);
      await send('Runtime.evaluate', { expression: доЗагрузки });
    }
    // Ставим перехват ДО скриптов страницы, иначе она успеет крикнуть раньше.
    await send('Page.addScriptToEvaluateOnNewDocument', { source: ПЕРЕХВАТ });
    await send('Page.navigate', { url: адрес });
    await sleep(1800);
    if (послеЗагрузки) { await send('Runtime.evaluate', { expression: послеЗагрузки }); await sleep(600); }
    const { result } = await send('Runtime.evaluate', { expression: 'JSON.stringify(window.__k||[])', returnByValue: true });
    return JSON.parse(result.value || '[]');
  } finally { chrome.kill(); await sleep(700); }
};

const случаи = [
  ['A. норма, криков быть не должно', БАЗА + '/', null, false],
  // Чепуха в хранилище до setTrack НЕ доходит: встроенный скрипт в шапке
  // отсеивает её раньше. Настоящий путь к guard — наша же разметка:
  // setTrack(button.dataset.trackTo). Опечатка в data-track-to и есть тот
  // случай, ради которого правило 7р написано.
  ['B. опечатка в нашей разметке', БАЗА + '/', null, true,
   "document.querySelector('[data-track-to]').dataset.trackTo='chepuha';document.querySelector('[data-track-to]').click();"],
  ['C. несуществующая глава', БАЗА + '/put/#glava-kotoroy-net', null, true],
];
let всёВерно = true;
for (const [имя, адрес, подг, ждёмКрик, после] of случаи) {
  const крики = await прогон(адрес, подг, после);
  const есть = крики.some((k) => k.includes('отброшено'));
  const ок = есть === ждёмКрик;
  if (!ок) всёВерно = false;
  console.log(`  ${ок ? 'ok  ' : 'ПРОВАЛ'} ${имя.padEnd(34)} ждали ${ждёмКрик ? 'крик' : 'тишину'}, получили ${есть ? 'крик' : 'тишину'}`);
  if (есть) console.log(`         └ ${крики.filter((k) => k.includes('отброшено'))[0]}`);
}
console.log(всёВерно ? '  ИТОГ: проверка на отказ пройдена, оба исхода' : '  ИТОГ: ПРОВАЛ');
process.exit(всёВерно ? 0 : 1);
