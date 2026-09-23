// Снимает три варианта строки терминала для выбора Сергея.
//
// Зачем скриптом: вариантов три, а рамку нашего сайта в чужую страницу не
// вставить — заголовок frame-ancestors 'self' это запрещает, и правильно.
// Значит выбор показываем настоящими снимками, а не пересобранным макетом:
// макет разойдётся с сайтом на первой же правке.
//
//   node tools/kadry-stroki.mjs [папка]
import { writeFileSync, mkdirSync } from 'node:fs';
import { запуститьChrome, подключиться, sleep } from './igrat.mjs';

const ПАПКА = process.argv[2] || `${process.env.HOME}/Desktop/vybor-stroki-terminala`;
const ФРАЗА = 'Герой не изменился, просто подешевело быть честным.';
const ВИДЫ = [
  ['a', 'значок робота слева от строки'],
  ['b', 'робот в самом логотипе, строка без значка'],
  ['v', 'приставка «ии:» перед фразой'],
];

mkdirSync(ПАПКА, { recursive: true });
const порт = 9713;
const chrome = запуститьChrome(порт, '1200,300');
await sleep(1800);
const send = await подключиться(порт);

for (const [вид, подпись] of ВИДЫ) {
  await send('Page.navigate', { url: `https://aka-gst.ru/?vid=${вид}` });
  await sleep(2600);
  // Печать по букве идёт своим таймером и перепишет что угодно. Подменяем
  // узел копией: таймер продолжает писать в отсоединённый, на экране стоит
  // наша фраза целиком — иначе на снимке половина слова.
  await send('Runtime.evaluate', {
    expression: `(() => {
      const t = document.querySelector('.hero-term-tekst');
      if (!t) return 'строки нет';
      const c = t.cloneNode(false);
      c.textContent = ${JSON.stringify(ФРАЗА)};
      t.replaceWith(c);
      return document.querySelector('.hero-term-tekst').textContent;
    })()`,
    returnByValue: true,
  });
  await sleep(400);
  const кадр = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const файл = `${ПАПКА}/variant-${вид}.png`;
  writeFileSync(файл, Buffer.from(кадр.data, 'base64'));
  console.log(`  ${вид}: ${подпись} → ${файл}`);
}

chrome.kill();
console.log('  готово');
