#!/usr/bin/env node
// Страницу нельзя сдвинуть вбок ни на одной ширине, и пальцевые цели не
// мельчают. Нашёл Тестер 6 сентября 2026: на 320 у главной scrollWidth 351
// при clientWidth 320 — тридцать один пиксель вбок. Виноваты были сетка
// карточек (жёсткие 310 при доступных 288) и кнопки переключателя, которые
// в flex не сжимаются ниже своего содержимого.
//
// Мерка Тестера, и она тут главное: сравнивать scrollWidth надо с
// clientWidth, а НЕ с innerWidth. На разъехавшейся странице innerWidth сам
// вырастает до ширины макета, и проверка зеленеет на сломанном.
//
// Вторая ловушка, моя: 44 точки — правило для пальца. Требовать пальцевого
// размера от десктопной кнопки значит мерить не то, и я на этом получил
// два ложных «плохо».
// Третья, тоже моя: сперва я мерил по адресу, где никто не слушал. Пустая
// страница никуда не выезжает, и «уехало 0» выглядело починкой. Поэтому
// первым делом смотрите, что кнопок нашлось три, а не ноль.
//
//   node tools/uzkie-ekrany.mjs                    проверить бой
//   node tools/uzkie-ekrany.mjs http://localhost:4180
import { запуститьChrome, подключиться, sleep } from './igrat.mjs';

const база = process.argv[2] || 'https://aka-gst.ru';
let плохо = 0;
for (const ш of [320, 360, 390, 430, 768, 1280]) {
  const ПОРТ = 9461;
  const chrome = запуститьChrome(ПОРТ, `${ш},800`);
  try {
    const send = await подключиться(ПОРТ);
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: ш, height: 800, deviceScaleFactor: 2, mobile: ш < 768 });
    await send('Page.navigate', { url: база + '/' });
    await sleep(2600);
    const r = await send('Runtime.evaluate', { returnByValue: true, expression: `(() => {
      const d = document.documentElement;
      const кнопки = [...document.querySelectorAll('.track-switch button')].map((b) => {
        const r = b.getBoundingClientRect();
        return { т: b.textContent.trim().slice(0, 9), ш: Math.round(r.width), в: Math.round(r.height) };
      });
      return JSON.stringify({ уехало: d.scrollWidth - d.clientWidth, кнопки });
    })()` });
    const о = JSON.parse(r.result.value);
    const пальцем = ш < 768;
    const малые = пальцем ? о.кнопки.filter((k) => k.в < 44 || k.ш < 44) : [];
    const ок = о.уехало === 0 && малые.length === 0 && о.кнопки.length === 3;
    if (!ок) плохо += 1;
    console.log(`  ${ок ? 'ok  ' : 'ПЛОХО'} ${ш}px: уехало ${о.уехало}, кнопки ${о.кнопки.map((k) => `${k.т} ${k.ш}x${k.в}`).join(' · ')}`);
    send.закрыть();
  } finally { chrome.kill(); }
}
console.log(плохо ? `ПЛОХО: ${плохо}` : 'все ширины чисты');
process.exitCode = плохо ? 1 : 0;
