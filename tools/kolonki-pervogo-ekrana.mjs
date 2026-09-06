#!/usr/bin/env node
// Колонки первого экрана равны по высоте на ЛЮБОЙ ширине, а не в двух точках.
//
// Написан из ошибки 6 сентября 2026, и она стоит того, чтобы её помнить.
// Сергей написал «опять правый блок выше левого!». Я до этого отчитался
// числом «713 и 713» — и число было верным: колонки сетки равны по
// устройству, они не могут разойтись. Но человек видит не колонки, а то,
// ГДЕ КОНЧАЕТСЯ СОДЕРЖИМОЕ, а слева оно кончалось на 35 пикселей выше на
// всех семи ширинах, не только у него. Мера смотрела на контейнер вместо
// предмета и поэтому была зелёной на сломанном.
//
// Поэтому здесь меряются обе величины сразу: высота колонок И нижняя точка
// их содержимого. Порог 4 пикселя — на глаз незаметно, на подгонку не
// хватает.
//
//   node tools/kolonki-pervogo-ekrana.mjs                  проверить бой
//   node tools/kolonki-pervogo-ekrana.mjs http://localhost:4180
// Равенство колонок первого экрана на МНОГИХ ширинах, а не в двух точках.
// Сергей увидел перекос на ~1470, где у меня было «713 = 713» на 1440 и 2000.
// Мерим не только колонки, но и то, где КОНЧАЕТСЯ содержимое каждой: колонки
// могут быть равны сеткой, а карточка внутри левой — заканчиваться выше, и
// человек видит именно это.
import { запуститьChrome, подключиться, sleep } from './igrat.mjs';
const база = process.argv[2] || 'https://aka-gst.ru';
let плохо = 0;
for (const ш of [1100, 1280, 1366, 1470, 1600, 1920, 2000]) {
  const ПОРТ = 9480;
  const chrome = запуститьChrome(ПОРТ, `${ш},1000`);
  try {
    const send = await подключиться(ПОРТ);
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: ш, height: 1000, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: база + '/' });
    await sleep(2500);
    const r = await send('Runtime.evaluate', { returnByValue: true, expression: `(() => {
      const кол = [...document.querySelectorAll('.work-col')];
      if (кол.length !== 2) return JSON.stringify({ ошибка: 'колонок ' + кол.length });
      const низ = (el) => {
        const дети = [...el.children].filter((c) => c.getBoundingClientRect().height > 0);
        return дети.length ? Math.round(Math.max(...дети.map((c) => c.getBoundingClientRect().bottom))) : 0;
      };
      const a = кол[0].getBoundingClientRect(), b = кол[1].getBoundingClientRect();
      return JSON.stringify({
        колонки: [Math.round(a.height), Math.round(b.height)],
        низСодержимого: [низ(кол[0]), низ(кол[1])],
        карточкаШлюза: Math.round(кол[0].querySelector('.work-system').getBoundingClientRect().height),
      });
    })()` });
    const о = JSON.parse(r.result.value);
    const разн = Math.abs(о.колонки[0] - о.колонки[1]);
    const разнСодерж = Math.abs(о.низСодержимого[0] - о.низСодержимого[1]);
    const ок = разн <= 4 && разнСодерж <= 4;
    if (!ок) плохо += 1;
    console.log(`  ${ок ? 'ok  ' : 'ПЛОХО'} ${ш}px: колонки ${о.колонки.join(' и ')} (разница ${разн}), содержимое кончается на ${о.низСодержимого.join(' и ')} (разница ${разнСодерж}), карточка шлюза ${о.карточкаШлюза}`);
    send.закрыть();
  } finally { chrome.kill(); }
}
console.log(плохо ? `ПЛОХО: ${плохо} ширин из 7` : 'колонки равны на всех ширинах');
process.exitCode = плохо ? 1 : 0;
