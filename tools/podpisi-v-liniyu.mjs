#!/usr/bin/env node
// Две стрелочные подписи под карточками первого экрана стоят в одну линию.
//
// Просьба Сергея от 6 сентября 2026: «и чтобы подписи „Один AI…“ /
// „Другой ведёт…“ были ровно». Держится это не само собой: подпись у каждой
// колонки последняя, а излишек высоты забирает то, что выше неё. Стоит
// кому-нибудь поменять порядок в колонке — линия разъедется, и заметит это
// он, а не мы.
//
// Заодно проверяется порядок правой колонки: сверху комикс, под ним Dharma.
// Это тоже его слово, и тоже легко потерять при следующей перестановке.
//
//   node tools/podpisi-v-liniyu.mjs                  проверить бой
//   node tools/podpisi-v-liniyu.mjs http://localhost:4180
import { запуститьChrome, подключиться, sleep } from './igrat.mjs';

const база = process.argv[2] || 'https://aka-gst.ru';
let плохо = 0;
for (const ш of [1100, 1280, 1470, 1920]) {
  const ПОРТ = 9486;
  const chrome = запуститьChrome(ПОРТ, `${ш},1000`);
  try {
    const send = await подключиться(ПОРТ);
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: ш, height: 1000, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: база + '/' });
    await sleep(2400);
    const r = await send('Runtime.evaluate', { returnByValue: true, expression: `(() => {
      const п = [...document.querySelectorAll('.work-duet-note')];
      if (п.length !== 2) return JSON.stringify({ ошибка: 'подписей ' + п.length + ', а не две' });
      const y = п.map((e) => Math.round(e.getBoundingClientRect().top));
      const порядок = [...document.querySelectorAll('.work-col--dharma > *')].map((e) => e.className.split(' ')[0]);
      return JSON.stringify({ верх: y, разница: Math.abs(y[0] - y[1]), правая: порядок });
    })()` });
    const о = JSON.parse(r.result.value);
    if (о.ошибка) { плохо += 1; console.log(`  ПЛОХО ${ш}px: ${о.ошибка}`); send.закрыть(); continue; }
    const ок = о.разница <= 2 && о.правая[0] === 'work-put';
    if (!ок) плохо += 1;
    console.log(`  ${ок ? 'ok  ' : 'ПЛОХО'} ${ш}px: подписи на ${о.верх.join(' и ')} (разница ${о.разница}), правая колонка ${о.правая.join(' → ')}`);
    send.закрыть();
  } finally { chrome.kill(); }
}
console.log(плохо ? `ПЛОХО: ${плохо}` : 'подписи в линию, порядок правой колонки верный');
process.exitCode = плохо ? 1 : 0;
