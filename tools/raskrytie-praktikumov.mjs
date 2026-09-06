#!/usr/bin/env node
// Кнопка «Ещё практикумы» раскрывает два блока и складывает их обратно.
//
// Сергей 6 сентября: два практикума под QueQuest занимали пол-экрана впустую,
// и он выбрал спрятать их за кнопку. Проверять надо ПОСЛЕДСТВИЕ, а не клик:
// свёрнуто — карточек не видно ни одной; раскрыто — видны обе и ничего не
// обрезано. Высота ребёнка внутри свёрнутого контейнера остаётся прежней,
// поэтому «высота больше нуля» тут ничего не значит: меряем пересечение с
// рамкой раскрытия.
//
// Проверка живёт в репозитории, а не во временной папке: временную у меня
// дважды сметало, и проверка «падала» не своей поломкой, а отсутствием файла.
//
//   node tools/raskrytie-praktikumov.mjs                  проверить бой
//   node tools/raskrytie-praktikumov.mjs http://localhost:4180
import { запуститьChrome, подключиться, sleep } from './igrat.mjs';

const база = process.argv[2] || 'https://aka-gst.ru';
const ш = Number(process.argv[3] || 1440);
const ПОРТ = 9490;
const chrome = запуститьChrome(ПОРТ, `${ш},900`);
let плохо = 0;
try {
  const send = await подключиться(ПОРТ);
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: ш, height: 900, deviceScaleFactor: 1, mobile: ш < 700 });
  await send('Page.navigate', { url: база + '/' });
  await sleep(2600);
  const о = async (e) => (await send('Runtime.evaluate', { returnByValue: true, expression: e })).result.value;
  const снять = async () => JSON.parse(await о(`(() => {
    const b = document.querySelector('.practicum-more-btn');
    const тело = document.getElementById('practicum-more-body');
    if (!b || !тело) return JSON.stringify({ ошибка: 'кнопки или тела нет' });
    const rb = b.getBoundingClientRect(), rt = тело.getBoundingClientRect();
    const карточки = [...тело.querySelectorAll('.practicum-detail')];
    const видно = карточки.filter((c) => {
      const r = c.getBoundingClientRect();
      return Math.min(r.bottom, rt.bottom) - Math.max(r.top, rt.top) > 20;
    }).length;
    return JSON.stringify({
      кнопка: Math.round(rb.width) + 'x' + Math.round(rb.height),
      раскрыто: b.getAttribute('aria-expanded'),
      видно, всего: карточки.length,
      скрытоОтКлавиатуры: тело.hasAttribute('inert') || тело.hasAttribute('hidden'),
      страница: document.documentElement.scrollHeight,
    });
  })()`));
  const до = await снять();
  await о(`document.querySelector('.practicum-more-btn').click()`);
  await sleep(900);
  const после = await снять();
  await о(`document.querySelector('.practicum-more-btn').click()`);
  await sleep(900);
  const обратно = await снять();
  const проверки = [
    ['свёрнуто по умолчанию', до.раскрыто === 'false' && до.видно === 0],
    ['в свёрнутом виде не доступно и с клавиатуры', до.скрытоОтКлавиатуры === true],
    ['кнопка не меньше 44 точек', Number(до.кнопка.split('x')[1]) >= 44],
    ['раскрылось, видны все', после.раскрыто === 'true' && после.видно === после.всего && после.всего >= 2],
    ['страница выросла', после.страница > до.страница],
    ['свернулось обратно', обратно.раскрыто === 'false' && обратно.видно === 0],
  ];
  for (const [имя, ок] of проверки) { if (!ок) плохо += 1; console.log(`  ${ок ? 'ok  ' : 'ПЛОХО'} ${имя}`); }
  console.log(`  до ${JSON.stringify(до)}\n  после ${JSON.stringify(после)}`);
  send.закрыть();
} finally { chrome.kill(); }
console.log(плохо ? `ПЛОХО: ${плохо}` : 'раскрытие работает обоими исходами');
process.exitCode = плохо ? 1 : 0;
