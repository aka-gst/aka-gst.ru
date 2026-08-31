// Проверяет, что прыжок по якорю не загоняет заголовок под прилипшую шапку.
//
//   node tools/yakor.mjs                  по бою
//   node tools/yakor.mjs http://адрес     по другому адресу
//
// Меряет на двух размерах: шапка на телефоне переносится и вырастает с 71 до
// 128 пикселей, и отступ, вписанный числом, промахивается ровно на разницу.
// Так и было: на десктопе заголовок вставал чисто, на телефоне уезжал под
// шапку целиком — 24 пикселя из 24.
//
// ГЛАВНОЕ В ЭТОЙ ПРОВЕРКЕ — не перекрытие, а доказательство прокрутки.
// Первые замеры соседа дали «закрыто 0» просто потому, что страница не
// прокрутилась вовсе: при плавной прокрутке scrollTop оставался нулём, и
// измеритель честно мерил нетронутый экран. Поэтому здесь каждая строка
// несёт «доехала» — если она false, число рядом ничего не значит.

import { запуститьChrome, подключиться, sleep } from '/Users/gst/dev/aka-gst.ru/tools/igrat.mjs';
const PORT = 9425;
const АДРЕС = process.argv[2] || 'https://aka-gst.ru/';
const chrome = запуститьChrome(PORT, '1440,900');
const send = await подключиться(PORT);
await send('Page.enable');
const из = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result.value;

for (const [имя, w, h, dpr, mobile] of [['десктоп', 1440, 900, 1, false], ['телефон', 390, 844, 2, true]]) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile });
  await send('Page.navigate', { url: АДРЕС });
  await sleep(4000);
  const итог = await из(`(async () => {
    document.documentElement.style.scrollBehavior = 'auto';
    const шапка = document.querySelector('.topbar');
    const вш = шапка ? Math.round(shapkaH(шапка)) : 0;
    function shapkaH(s){ return s.getBoundingClientRect().height; }
    const цели = ['products-title','own-products-title','profile-title','all-work-title'].map(id => document.getElementById(id)).filter(Boolean);
    const строки = [];
    for (const ц of цели) {
      window.scrollTo(0, 0);
      await new Promise(r => setTimeout(r, 120));
      const было = window.scrollY;
      location.hash = '#' + ц.id.replace('-title','');
      ц.scrollIntoView();
      await new Promise(r => setTimeout(r, 400));
      const стало = window.scrollY;
      const r = ц.getBoundingClientRect();
      const закрыто = Math.max(0, Math.min(r.bottom, вш) - Math.max(r.top, 0));
      строки.push({
        цель: ц.id,
        прокрутка: было + '→' + Math.round(стало),
        доехала: стало > было + 50,
        верх: Math.round(r.top),
        закрытоШапкой: Math.round(закрыто) + ' из ' + Math.round(r.height),
      });
    }
    return JSON.stringify({ высотаШапки: Math.round(вш), строки }, null, 1);
  })()`);
  console.log(`  ── ${имя} ──`);
  console.log(итог.split('\n').map(l => '  ' + l).join('\n'));
}
send.закрыть(); chrome.kill();

// Итог одной строкой, чтобы можно было смотреть глазами и грепом.
