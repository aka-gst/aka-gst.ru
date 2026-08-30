// Снимает игровой экран, а не заставку.
//
//   node tools/shoot-games.mjs            все игры
//   node tools/shoot-games.mjs acid coin  только эти
//
// Одиночный `--screenshot` у Chrome снимает то, что видно сразу после
// загрузки, а это всегда меню: «СТАРТ», «НАЧАТЬ», правила. Здесь Chrome
// поднимается с отладочным портом, по нему прокликивается путь до игры,
// и только потом делается кадр.
//
// Вождение (клики, клавиши, пульт игры) живёт в tools/igrat.mjs — общее с
// записью роликов. Здесь остаётся своё: обрезка, оценка кадра и файл.
//
// clip — область кадра. Нужна там, где рядом с полем висит таблица
// рекордов: чужие ники не должны застывать картинкой на портфолио.
//
// Кадры кладутся в scratch-папку рядом со скриптом; в assets/shots их
// переводит sips — см. раздел «Снимки экрана» в README.

import { writeFileSync, mkdirSync } from 'node:fs';
import { PLAN } from './games-plan.mjs';
import { запуститьChrome, подключиться, дойти, скриптОсмотра, sleep } from './igrat.mjs';

const PORT = 9334;
const OUT = new URL('../.shots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const only = process.argv.slice(2);

// Проверяем сам кадр, а не факт, что он получился. Пустой холст даёт файл
// нормального веса и код успеха — и уезжает на витрину чёрным прямоугольником,
// о чём никто не узнает раньше владельца. Два числа: доля полностью
// прозрачных пикселей (у живого кадра ноль, у неотрисованного почти сто) и
// средняя яркость. Формулировку про прозрачные подсказала сессия ПЕРИМЕТРА.
const оценить = (данные) => `
  (async () => {
    const i = new Image();
    i.src = 'data:image/png;base64,' + ${JSON.stringify(данные)};
    await i.decode();
    const c = new OffscreenCanvas(i.width, i.height);
    const g = c.getContext('2d');
    g.drawImage(i, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let сумма = 0, n = 0, прозрачных = 0, тёмных = 0;
    for (let k = 0; k < d.length; k += 16) {
      if (d[k + 3] < 8) прозрачных += 1;
      const y = 0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2];
      if (y < 16) тёмных += 1;
      сумма += y; n += 1;
    }
    return { яркость: +(сумма / n).toFixed(1), прозрачных: +(100 * прозрачных / n).toFixed(1), тёмных: +(100 * тёмных / n).toFixed(1) };
  })()`;

const chrome = запуститьChrome(PORT);

const run = async () => {
  const send = await подключиться(PORT);
  await send('Page.enable');
  const пустые = [];

  for (const game of PLAN) {
    if (only.length && !only.includes(game.id)) continue;
    const лог = [];
    try {
      // Гонка со временем: одна медленная страница не должна вешать проход.
      await Promise.race([
        дойти(send, game, лог),
        sleep(60000).then(() => { throw new Error('слишком долго'); }),
      ]);
    } catch (e) {
      лог.push(`(${e.message})`);
    }
    const осмотр = await send('Runtime.evaluate', { expression: скриптОсмотра, returnByValue: true })
      .catch(() => ({ result: { value: '—' } }));
    const кадр = await send('Page.captureScreenshot',
      game.clip ? { format: 'png', clip: { ...game.clip, scale: 1 } } : { format: 'png' });
    writeFileSync(`${OUT}play-${game.id}.png`, Buffer.from(кадр.data, 'base64'));

    const оценка = await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: оценить(кадр.data) })
      .catch(() => null);
    const о = оценка?.result?.value;
    const беда = о && (о.прозрачных > 20 || о.тёмных > 92);
    if (беда) пустые.push(game.id);
    const числа = о ? `яркость ${о.яркость}, прозрачных ${о.прозрачных}%, тёмных ${о.тёмных}%` : 'не измерен';
    console.log(`${game.id.padEnd(9)} ${лог.join(' ')}\n          ${беда ? 'ПУСТОЙ КАДР: ' : ''}${числа}\n          осталось: ${осмотр.result.value}`);
  }

  if (пустые.length) console.log(`\nне ставить на витрину: ${пустые.join(', ')} — кадр пустой или почти чёрный`);
  send.закрыть();
  chrome.kill();
};

run().catch((e) => { console.error(e.message); chrome.kill(); process.exit(1); });
