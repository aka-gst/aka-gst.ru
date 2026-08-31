#!/usr/bin/env node
// Заглушка против ролика: насколько дёргается карточка в момент подмены.
//
// Меряется НА ЖИВОЙ СТРАНИЦЕ, а не на файлах: между файлом и глазом стоят
// object-fit, object-position, масштаб карточки и цветовой диапазон видео,
// и любое из них двигает картинку сильнее, чем разница файлов.
//
// Две ямы, в которые тут уже падали, обе дают уверенный ноль на исправной
// странице:
//   * при preload="none" назначить v.src мало — браузер не начнёт качать,
//     пока не позовут v.load(). Иначе сравниваешь заглушку саму с собой;
//   * Page.captureScreenshot с параметром clip заставляет пересобирать
//     поверхность и на видео падает. Снимаем кадр целиком, режем ffmpeg.
//
// Отрицательный контроль встроен: заглушка сравнивается сама с собой и
// обязана дать ровно 0. Не дала — врёт мера, а не страница.
//
//   node tools/zaglushka.mjs                     # по бою
//   node tools/zaglushka.mjs http://127.0.0.1:4199
import { запуститьChrome, подключиться, sleep } from './igrat.mjs';
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const ВРЕМЕННО = mkdtempSync(join(tmpdir(), 'zaglushka-'));
const PORT = 9469;
const chrome = запуститьChrome(PORT, '1440,1000');
const send = await подключиться(PORT);
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: (process.argv[2] || 'https://aka-gst.ru').replace(/\/$/, '') + '/' });
await sleep(4000);
const из = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result.value;

const сколько = await из(`document.querySelectorAll('.shot .gclip').length`);
console.log(`  роликов на карточках работы: ${сколько}`);

for (let i = 0; i < сколько; i++) {
  const имя = await из(`document.querySelectorAll('.shot .gclip')[${i}].dataset.src.split('/').pop().split('?')[0]`);
  // Показываем фигуру и грузим ролик руками: preload="none", сам он не приедет.
  const готов = await из(`(async () => {
    const v = document.querySelectorAll('.shot .gclip')[${i}];
    v.closest('.shot').scrollIntoView({ block: 'center' });
    // preload="none" — назначить src мало, браузер не начнёт качать, пока
    // его не попросят явно. Тестер упёрся ровно в это и двадцать шесть
    // кадров сравнивал заглушку саму с собой.
    if (!v.src) v.src = v.dataset.src;
    v.load();
    try { await v.play(); } catch (e) { /* без звука пускать должно */ }
    v.pause();
    for (let n = 0; n < 60; n++) {
      await new Promise(r => setTimeout(r, 150));
      if (v.readyState >= 2 && v.videoWidth) break;
    }
    if (!v.videoWidth) return 'НЕ ЗАГРУЗИЛСЯ readyState=' + v.readyState;
    // Перемотку надо ДОЖДАТЬСЯ. Просто присвоить currentTime мало: пока
    // seek не закончился, на экране остаётся тот кадр, где ролик успел
    // оказаться после play(), и мы сравниваем заглушку не с тем, с чем
    // думаем. Молчаливая версия этой ямы и даёт «почти совпало».
    await new Promise((r) => {
      if (v.currentTime === 0) return r();
      v.addEventListener('seeked', r, { once: true });
      v.currentTime = 0;
      setTimeout(r, 3000);
    });
    return v.videoWidth + 'x' + v.videoHeight + ', t=' + v.currentTime.toFixed(3);
  })()`);
  const коробка = JSON.parse(await из(`(() => {
    const r = document.querySelectorAll('.shot .gclip')[${i}].getBoundingClientRect();
    return JSON.stringify({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) });
  })()`));
  const позиции = await из(`(() => {
    const v = document.querySelectorAll('.shot .gclip')[${i}];
    const s = v.closest('.shot').querySelector('img');
    const g = (e) => getComputedStyle(e).objectFit + ' / ' + getComputedStyle(e).objectPosition;
    return 'снимок ' + g(s) + '  ·  ролик ' + g(v);
  })()`);
  console.log(`\n  ${имя}`);
  console.log(`    ролик ${готов}, коробка ${коробка.w}×${коробка.h}`);
  console.log(`    ${позиции}`);
  if (готов.startsWith('НЕ')) continue;

  // Снимаем кадр ЦЕЛИКОМ и режем ffmpeg'ом: захват с параметром clip
  // заставляет браузер пересобирать поверхность и на видео падает.
  const режем = `crop=${коробка.w}:${коробка.h}:${коробка.x}:${коробка.y}`;
  await из(`document.querySelectorAll('.shot .gclip')[${i}].classList.remove('is-playing'); 1`);
  await sleep(500);
  const a = (await send('Page.captureScreenshot', { format: 'png' })).data;
  await из(`document.querySelectorAll('.shot .gclip')[${i}].classList.add('is-playing'); 1`);
  await sleep(700);
  const b = (await send('Page.captureScreenshot', { format: 'png' })).data;
  writeFileSync(`${ВРЕМЕННО}/a.png`, Buffer.from(a, 'base64'));
  writeFileSync(`${ВРЕМЕННО}/b.png`, Buffer.from(b, 'base64'));
  const вывод = execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `${ВРЕМЕННО}/a.png`,
    '-i', `${ВРЕМЕННО}/b.png`, '-filter_complex',
    `[0:v]${режем}[a];[1:v]${режем}[b];[a][b]blend=all_mode=difference,signalstats,metadata=print:file=-`,
    '-f', 'null', '-'], { encoding: 'utf8' });
  const яркость = вывод.match(/YAVG=([\d.]+)/)?.[1];
  const макс = вывод.match(/YMAX=([\d.]+)/)?.[1];
  // Отрицательный контроль: тот же кадр сам с собой обязан дать ноль.
  // Без него не отличить «слои совпали» от «мера ничего не видит».
  const свой = execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `${ВРЕМЕННО}/a.png`,
    '-i', `${ВРЕМЕННО}/a.png`, '-filter_complex',
    `[0:v]${режем}[a];[1:v]${режем}[b];[a][b]blend=all_mode=difference,signalstats,metadata=print:file=-`,
    '-f', 'null', '-'], { encoding: 'utf8' }).match(/YAVG=([\d.]+)/)?.[1];
  console.log(`    расхождение заглушка↔кадр: средняя ${яркость}, максимум ${макс} (из 255)`);
  console.log(`    контроль (кадр сам с собой): ${свой}${свой === '0.000000' || Number(свой) === 0 ? '' : '  ← МЕРА ВРЁТ'}`);
  if (process.env.RAZBOR) {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `${ВРЕМЕННО}/a.png`, '-vf', режем, `${process.env.RAZBOR}/${имя}-zaglushka.png`]);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `${ВРЕМЕННО}/b.png`, '-vf', режем, `${process.env.RAZBOR}/${имя}-rolik.png`]);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `${ВРЕМЕННО}/a.png`, '-i', `${ВРЕМЕННО}/b.png`,
      '-filter_complex', `[0:v]${режем}[a];[1:v]${режем}[b];[a][b]blend=all_mode=difference,eq=brightness=0.3:contrast=3`,
      `${process.env.RAZBOR}/${имя}-raznica.png`]);
    console.log(`    разложено в ${process.env.RAZBOR}`);
  }
}
send.закрыть(); chrome.kill();
