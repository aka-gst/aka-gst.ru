// Сколько байт уходит на ПЕРВУЮ загрузку телефона и сколько из них видно.
//
// Заведено 5 сентября 2026, когда понадобилось освободить место под «живое»
// на первом экране. Замер сразу нашёл 363 КБ, уходившие на значок 34x34.
//
// Меряет ДВЕ разные вещи, и путать их нельзя:
//   * что СКАЧАНО — по сетевым ответам. Разметка обещает, сеть отвечает;
//   * что ВИДНО в первом экране — по положению картинки на странице.
// Разница между ними и есть впустую потраченный первый экран.
//
// ВАЖНО, проверено делом: `loading="lazy"` этой разницы НЕ убирает. Chrome
// тянет всё, что ближе ~1250 пикселей к экрану, поэтому картинка на 2043-м
// пикселе грузится в первую же загрузку, сколько ленивости ей ни пропиши.
// Поэтому мера смотрит в сеть, а не в атрибуты: атрибуты соврут.
//
//   node tools/ves-pervogo-ekrana.mjs [адрес]
//
// Код выхода: 0 — замер состоялся, 1 — прогон недействителен.

import { запуститьChrome, подключиться, sleep } from './igrat.mjs';

const АДРЕС = process.argv[2] || process.env.SITE || 'https://aka-gst.ru/';
const ПОРТ = Number(process.env.PORT_CDP || 9353);
// iPhone 14/15: 390x844 CSS-пикселей, плотность 3.
const ЭКРАН = { w: 390, h: 844, dpr: 3 };

const кб = (b) => (b / 1024).toFixed(0).padStart(5) + ' КБ';

const chrome = запуститьChrome(ПОРТ, `${ЭКРАН.w},${ЭКРАН.h}`);
try {
  const send = await подключиться(ПОРТ);
  await send('Page.enable');
  await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: ЭКРАН.w, height: ЭКРАН.h, deviceScaleFactor: ЭКРАН.dpr, mobile: true,
  });
  await send('Page.navigate', { url: АДРЕС });
  await sleep(6000);

  const { result } = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const экран = innerHeight;
      const байты = new Map();
      for (const r of performance.getEntriesByType('resource')) {
        байты.set(r.name.split('?')[0], r.transferSize || r.encodedBodySize || 0);
      }
      const кадры = [...document.images]
        .filter((i) => i.complete && i.naturalWidth > 0)
        .map((i) => {
          const r = i.getBoundingClientRect();
          return {
            имя: i.currentSrc.split('/').pop().split('?')[0],
            байт: байты.get(i.currentSrc.split('?')[0]) || 0,
            ленивая: i.loading === 'lazy',
            верх: Math.round(r.top),
            показ: Math.round(r.width) + 'x' + Math.round(r.height),
            настоящая: i.naturalWidth + 'x' + i.naturalHeight,
            видна: r.top < экран && r.bottom > 0 && r.width > 0,
          };
        });
      const nav = performance.getEntriesByType('navigation')[0];
      return { экран, кадры, всего: performance.getEntriesByType('resource').length,
               документ: nav ? nav.transferSize : 0,
               доИнтерактива: nav ? Math.round(nav.domInteractive) : 0 };
    })()`,
  });
  const д = result.value;
  // ПОЛОЖИТЕЛЬНЫЙ КОНТРОЛЬ: нулевой экран или пустая страница значат, что мы
  // смотрим не туда, а не что страница лёгкая. Без этой строки пустой ответ
  // дал бы «первый экран весит ноль» — красиво и неверно.
  if (!д || !д.экран || д.всего < 3) {
    console.log(`  ПРОВАЛ: экран ${д?.экран}, запросов ${д?.всего} — прогон недействителен`);
    process.exit(1);
  }

  const видны = д.кадры.filter((k) => k.видна);
  const впрок = д.кадры.filter((k) => !k.видна);
  const сум = (a) => a.reduce((s, k) => s + k.байт, 0);

  console.log(`  ${АДРЕС}  —  экран ${ЭКРАН.w}x${д.экран}, плотность ${ЭКРАН.dpr}`);
  console.log(`  документ ${кб(д.документ)}, до интерактива ${д.доИнтерактива} мс\n`);
  console.log(`  картинок скачано: ${д.кадры.length} на ${кб(сум(д.кадры))}`);
  console.log(`    из них ВИДНО:   ${видны.length} на ${кб(сум(видны))}`);
  console.log(`    из них ВПРОК:   ${впрок.length} на ${кб(сум(впрок))}   ← потраченный первый экран\n`);
  console.log('  видна  ленивая     верх     байт  показ      настоящая   файл');
  for (const k of д.кадры.sort((a, b) => a.верх - b.верх)) {
    console.log(`  ${k.видна ? ' ДА  ' : ' нет '}  ${k.ленивая ? ' да ' : ' НЕТ'}    ${String(k.верх).padStart(5)}  ${String(k.байт).padStart(7)}  ${k.показ.padEnd(9)}  ${k.настоящая.padEnd(10)}  ${k.имя}`);
  }

  // Крупнее показа больше чем втрое — значит везём пиксели, которых не видно.
  // SVG из этой проверки исключён: вектор не везёт лишних пикселей, у него
  // 150x150 в разметке ничего не стоит. Проверка, кричащая на исправном,
  // живёт до первого «да ну её» (правило 7и).
  const жирные = д.кадры.filter((k) => {
    if (/\.svg$/i.test(k.имя)) return false;
    const надо = parseInt(k.показ, 10) * ЭКРАН.dpr;
    return надо > 0 && parseInt(k.настоящая, 10) > надо * 1.5;
  });
  if (жирные.length) {
    console.log('\n  КРУПНЕЕ, ЧЕМ ПОКАЗЫВАЮТ (везём невидимые пиксели):');
    for (const k of жирные) {
      console.log(`    ${k.имя}: ${k.настоящая} ради показа ${k.показ} — надо ${parseInt(k.показ, 10) * ЭКРАН.dpr}px`);
    }
  }
  process.exit(0);
} finally {
  chrome.kill();
}
