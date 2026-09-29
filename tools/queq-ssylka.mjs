#!/usr/bin/env node
// По картинке карточки QueQuest переходят в игру.
//
// Написан из прямого вопроса Сергея 6 сентября: «где ссылка? почему по
// картинке не переходит!!??» — и он был прав буквально: в карточке было
// НОЛЬ ссылок и одна кнопка, клик по картинке играл ролик перехода, а
// единственная ссылка на игру лежала в списке далеко внизу страницы.
//
// Проверяется ПОСЛЕДСТВИЕ клика — сменился ли адрес, — а не наличие
// атрибута href: атрибут может быть, а поверх него лежать кнопка.
//
//   node tools/queq-ssylka.mjs                       проверить бой
//   node tools/queq-ssylka.mjs http://localhost:4180 1470 нет
// Главный вопрос Сергея: «почему по картинке не переходит?» Меряем
// ПОСЛЕДСТВИЕ клика, а не наличие атрибута.
import { запуститьChrome, подключиться, sleep } from './igrat.mjs';
const база = process.argv[2] || 'https://aka-gst.ru';
const ш = process.argv[3] || '1470';
const palcem = process.argv[4] || 'нет';
const ПОРТ = 9502;
const chrome = запуститьChrome(ПОРТ, `${ш},950`);
let плохо = 0;
try {
  const send = await подключиться(ПОРТ);
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: +ш, height: 950, deviceScaleFactor: 1, mobile: palcem === 'да' });
  if (palcem === 'да') await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send('Page.navigate', { url: база + '/' });
  await sleep(2800);
  const о = async (e) => (await send('Runtime.evaluate', { returnByValue: true, expression: e })).result.value;

  // Положительный контроль. Без него не приехавшая страница выглядит как
  // «всё сломано»: карточки нет — значит все проверки красные и клик никуда
  // не ведёт. Ровно это со мной и случилось на бою: один прогон дал пять
  // красных, три следующих — чистые. Отличать «сломано» от «не загрузилось»
  // должна мера, а не догадка.
  for (let i = 0; i < 12; i += 1) {
    const есть = await о(`!!document.querySelector('.quequest-card')`);
    if (есть) break;
    await sleep(700);
  }
  const приехало = await о(`document.querySelectorAll('a.gcard, .quequest-card').length`);
  if (!приехало) {
    console.log('  СТРАНИЦА НЕ ПРИЕХАЛА: карточек на ней ноль — мерить нечего');
    process.exitCode = 2;
    send.закрыть(); chrome.kill(); process.exit(2);
  }
  console.log('  контроль: карточек на странице', приехало);

  const состав = JSON.parse(await о(`(() => {
    const к = document.querySelector('.quequest-card');
    if (!к) return JSON.stringify({ ошибка: 'карточки нет' });
    const кн = к.querySelector('.quequest-open');
    const пер = к.querySelector('.quequest-play-btn');
    const r = (e) => e ? Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height) : 'нет';
    return JSON.stringify({
      ссылок: [...к.querySelectorAll('a[href]')].length,
      картинкаЭтоСсылка: к.querySelector('.quequest-visual')?.tagName === 'A',
      заголовокСсылка: !!к.querySelector('h3 a'),
      кнопкаОткрыть: r(кн), кнопкаПереход: r(пер),
    });
  })()`));
  console.log(`  ${ш}px, палец ${palcem}:`, JSON.stringify(состав));
  const проверки = [
    ['картинка — ссылка', состав.картинкаЭтоСсылка === true],
    ['заголовок — ссылка', состав.заголовокСсылка === true],
    ['кнопка «Открыть игру» не меньше 44', Number((состав.кнопкаОткрыть || '0x0').split('x')[1]) >= 44],
    ['кнопка «показать переход» не меньше 44', Number((состав.кнопкаПереход || '0x0').split('x')[1]) >= 44],
  ];
  for (const [имя, ок] of проверки) { if (!ок) плохо += 1; console.log(`  ${ок ? 'ok  ' : 'ПЛОХО'} ${имя}`); }

  // Клик по картинке: последствие — адрес сменился
  await о(`document.querySelector('.quequest-visual').scrollIntoView({block:'center'})`);
  await sleep(400);
  await о(`document.querySelector('.quequest-visual').click()`);
  await sleep(3500);
  const где = await о(`location.pathname + ' | ' + document.title`);
  const ок = где.startsWith('/qa-quest/');
  if (!ок) плохо += 1;
  console.log(`  ${ок ? 'ok  ' : 'ПЛОХО'} клик по картинке → ${где}`);
  send.закрыть();
} finally { chrome.kill(); }
console.log(плохо ? `ПЛОХО: ${плохо}` : 'по картинке переходит');
process.exitCode = плохо ? 1 : 0;
