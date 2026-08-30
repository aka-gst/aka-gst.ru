// Записывает по несколько секунд игры для превью на карточке.
//
//   node tools/record-games.mjs            все игры
//   node tools/record-games.mjs acid coin  только эти
//
// Путь до игрового экрана берётся из общего плана (games-plan.mjs), а само
// вождение — из tools/igrat.mjs, общего со съёмкой кадров. Пока у записи была
// своя копия вождения, она отставала: не умела ни настоящих кодов клавиш, ни
// удержания, и половина роликов выходила фотографиями неподвижного экрана.
//
// Два режима записи.
//
// СЦЕНАРНЫЙ — если игра дала вызов вида «поставь сцену и шагни на dt». Тогда
// мы шагаем сами и снимаем по кадру между шагами. Так лучше по двум причинам:
// сцена детерминирована (два прогона дают одинаковые кадры, ролик можно
// переснять точно таким же), и запись не зависит от того, успевает ли
// экранная трансляция за игрой. Первым такой вызов дал ПЕРИМЕТР.
//
// ЖИВОЙ — если вызова нет: включаем Page.startScreencast и параллельно делаем
// то, что описано в `during` у игры. Половина игр в покое неподвижна — монета
// ждёт броска, шары ждут хода, — и без этого вышел бы кадр, а не ролик.
//
// Обрезка — та же область, что и у неподвижного кадра, чтобы превью и постер
// совпадали и переход между ними не дёргался.

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync, statSync } from 'node:fs';
import { PLAN } from './games-plan.mjs';
import { запуститьChrome, подключиться, дойти, шаг, sleep } from './igrat.mjs';

const PORT = 9370;
const OUT = new URL('../.shots/', import.meta.url).pathname;
const TMP = new URL('../.shots/frames/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const only = process.argv.slice(2);

// Потолок веса. Считается не от веса страницы, а от ожидания человека: петля
// грузится только на наведении, и при 1.6 Мбит/с 300 КБ — это полторы секунды
// черноты, которые читаются как поломка. 150 КБ дают около 0.7 с.
const ПОТОЛОК_КБ = 150;

const собрать = ({ game, кадров, секунд, лог, режим }) => {
  const c = game.during?.clip || game.clip;
  // Чётные стороны обязательны для yuv420p.
  const crop = c ? `crop=${c.width - (c.width % 2)}:${c.height - (c.height % 2)}:${c.x}:${c.y},` : '';
  const цель = `${OUT}clip-${game.id}.mp4`;
  // Частоту на входе берём настоящую, без ограничения сверху: ограничение
  // растягивало время — у Деревни 361 кадр за 5 секунд превращались в 15
  // секунд ролика. Выходную задаём отдельно, тогда ffmpeg выбрасывает или
  // повторяет кадры, а длительность остаётся живой.
  const ff = spawnSync('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-framerate', Math.max(0.5, кадров / Math.max(0.1, секунд)).toFixed(3), '-i', `${TMP}f%04d.jpg`,
    '-vf', `${crop}scale=600:-2:flags=lanczos`,
    '-an', '-r', '20', '-t', String(game.scene ? Math.ceil(секунд) : 6),
    '-c:v', 'libx264', '-profile:v', 'main', '-pix_fmt', 'yuv420p',
    '-crf', '32', '-preset', 'slow', '-movflags', '+faststart',
    цель,
  ]);
  if (ff.status !== 0 || !existsSync(цель)) {
    console.log(`${game.id.padEnd(12)} ${лог.join(' ')} · ffmpeg: ${ff.stderr.toString().trim().slice(0, 140)}`);
    return { плохо: true };
  }
  const кб = Math.round(statSync(цель).size / 1024);
  const длит = Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=nk=1:nw=1', цель]).stdout.toString().trim());
  // У видео не бывает прозрачных пикселей — в yuv420p альфы нет по устройству
  // формата. Поэтому пустую петлю ловим не прозрачностью, а неподвижностью:
  // десяток кадров за шесть секунд означает, что игра во время записи стояла,
  // и на карточку поедет фотография под видом ролика.
  // Пустая петля жмётся почти в ноль: ровная заливка фона на две секунды
  // весила 3 КБ. Живая петля того же размера — десятки килобайт. Так что
  // слишком лёгкий файл — такой же признак беды, как слишком тяжёлый.
  const пустая = кб < 12;
  const стояла = кадров < 20;
  const тяжёлый = кб > ПОТОЛОК_КБ;
  const беды = [
    стояла && 'ИГРА СТОЯЛА',
    пустая && `ПУСТАЯ ПЕТЛЯ: ${кб} КБ`,
    тяжёлый && `ТЯЖЕЛО: ${кб} КБ > ${ПОТОЛОК_КБ}`,
  ].filter(Boolean);
  console.log(`${game.id.padEnd(12)} ${режим} ${лог.join(' ')} · кадров ${String(кадров).padStart(3)} за ${секунд.toFixed(1)}с · ролик ${длит.toFixed(1)}с · ${кб} КБ${беды.length ? '  ← ' + беды.join(', ') : ''}`);
  return { плохо: беды.length > 0 };
};

const chrome = запуститьChrome(PORT);

const run = async () => {
  const send = await подключиться(PORT);
  await send('Page.enable');

  // Один слушатель на весь проход, а не по одному на игру: раньше они
  // накапливались, и к третьей игре каждый кадр писался трижды.
  let n = 0;
  let пишем = false;
  send.on(async (m) => {
    if (m.method !== 'Page.screencastFrame') return;
    if (пишем) writeFileSync(`${TMP}f${String((n += 1)).padStart(4, '0')}.jpg`, Buffer.from(m.params.data, 'base64'));
    await send('Page.screencastFrameAck', { sessionId: m.params.sessionId }).catch(() => {});
  });

  const плохие = [];
  for (const game of PLAN) {
    if (only.length && !only.includes(game.id)) continue;
    const лог = [];
    try {
      await Promise.race([
        дойти(send, game, лог),
        sleep(70000).then(() => { throw new Error('страница не дошла за 70 с'); }),
      ]);
    } catch (e) {
      console.log(`${game.id.padEnd(12)} пропущена: ${e.message}`);
      плохие.push(game.id);
      continue;
    }

    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(TMP, { recursive: true });
    n = 0;

    if (game.scene) {
      const сц = game.scene;
      const dt = сц.dt || 1 / 60;
      const наКадр = Math.max(1, Math.round(1 / dt / (сц.fps || 30)));
      await send('Runtime.evaluate', { expression: сц.setup, returnByValue: true, awaitPromise: true });
      let t = 0;
      const шагнуть = async () => { await send('Runtime.evaluate', { expression: сц.step }); t += dt; };
      while (t < (сц.from || 0)) await шагнуть();
      while (t < сц.to) {
        for (let k = 0; k < наКадр; k += 1) await шагнуть();
        await send('Runtime.evaluate', { expression: сц.render }).catch(() => {});
        // Снимаем весь кадр целиком, а обрезаем потом, в ffmpeg — как и в
        // живом режиме. Снимок С ОБРЕЗКОЙ заставляет Chrome пересобирать
        // поверхность на каждый вызов: первый кадр занимал семь минут,
        // второго не было. А fromSurface: false, которым я это сначала
        // «починил», просто не берёт холст: страница выходит пустой, и
        // ролик получился ровной заливкой фона. Проверено обоими снимками.
        const к = await send('Page.captureScreenshot', { format: 'jpeg', quality: 88 });
        writeFileSync(`${TMP}f${String((n += 1)).padStart(4, '0')}.jpg`, Buffer.from(к.data, 'base64'));
      }
      лог.push('сцена+');
      if (собрать({ game, кадров: n, секунд: n / (сц.fps || 30), лог, режим: 'сцена' }).плохо) плохие.push(game.id);
      continue;
    }

    const начали = Date.now();
    пишем = true;
    await send('Page.startScreencast', { format: 'jpeg', quality: 80, everyNthFrame: 1 });
    const план = game.during || { seconds: 5 };
    const до = начали + (план.seconds || 5) * 1000;
    while (Date.now() < до) {
      if (!план.шаги?.length) { await sleep(300); continue; }
      for (const s of план.шаги) {
        if (Date.now() >= до) break;
        await шаг(send)(s);
      }
    }
    await send('Page.stopScreencast');
    пишем = false;
    await sleep(400);
    if (собрать({ game, кадров: n, секунд: (Date.now() - начали) / 1000, лог, режим: 'живьём' }).плохо) плохие.push(game.id);
  }

  rmSync(TMP, { recursive: true, force: true });
  if (плохие.length) console.log(`\nне ставить на карточки: ${плохие.join(', ')}`);
  send.закрыть();
  chrome.kill();
};

run().catch((e) => { console.error(e.message); chrome.kill(); process.exit(1); });
