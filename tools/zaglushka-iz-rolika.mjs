#!/usr/bin/env node
// Заглушка карточки = нулевой кадр её ролика, нарисованный САМИМ БРАУЗЕРОМ.
//
// Зачем вообще: снимок и петля лежат на карточке друг на друге, и в момент
// подмены человек видит рывок, если это разные картинки. Раньше их снимали
// двумя отдельными прогонами одной сцены, и они расходились всегда: я
// вытащил сорок первых кадров ролика и сравнил с заглушкой — лучший 6.4,
// первый 6.9, совпадения нет ни у одного.
//
// Почему браузером, а не ffmpeg'ом — это главное, что тут стоит знать.
// Заглушка, сделанная `ffmpeg -frames:v 1`, всё равно давала на живой
// странице 11.4 и 12.8 из 255, хотя была буквально нулевым кадром. Разница
// оказалась ровным полем, а не структурой, то есть тональной. Прямой опыт:
// тот же кадр, нарисованный в <canvas> средствами браузера, расходится с
// ffmpeg'овым на 12.7 и 10.5 — то есть на весь остаток. **Браузер и ffmpeg
// декодируют цвет видео по-разному**, и подбором in_range/out_range/
// in_color_matrix это не закрывается: пробовал четыре набора.
// Поэтому кадр берётся оттуда, где его увидит человек.
//
// Списка «сделать всем» здесь нет намеренно. Роликов на сайте шесть, и
// четыре у карточек игр: их кадры ставили Глаза под «самый яркий момент»,
// и подмена на нулевой — решение про вид, а не про стык. Чужой принятый
// кадр не трогаем (правило 15), проекты называются руками.
//
//   node tools/zaglushka-iz-rolika.mjs qa-quest psy-ai-admin
//   node tools/zaglushka-iz-rolika.mjs --posmotret        # что вообще есть
import { readFileSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { запуститьChrome, подключиться, sleep } from './igrat.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const смотреть = process.argv.includes('--posmotret');
const названы = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!смотреть && !названы.length) {
  console.error('  назовите проекты: node tools/zaglushka-iz-rolika.mjs qa-quest psy-ai-admin');
  console.error('  посмотреть, что есть: --posmotret');
  process.exit(2);
}

const projects = JSON.parse(readFileSync(join(root, 'data', 'projects.json'), 'utf8'));

// Имя ролика ищется тем же двойным правилом, что в build.mjs: у Psy AI
// Admin id `psy-ai-admin`, а снимок и клип `psy-admin`; у QA Quest
// наоборот — id `qa-quest`, снимок `qa-quest-lesson`. Одно правило чинит
// один случай и ломает другой.
const ролик = (p) => {
  const снимок = p.shots?.[0]?.file;
  if (!снимок) return null;
  return [
    `clip-${снимок.replace(/\.(jpe?g|png|webp)$/i, '')}.mp4`,
    снимок.replace(/^game-(.+)\.(jpe?g|png|webp)$/i, 'clip-$1.mp4'),
    `clip-${p.id}.mp4`,
  ].find((n) => n.endsWith('.mp4') && existsSync(join(root, 'assets/clips', n)));
};
const размер = (f) =>
  JSON.parse(
    execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height', '-of', 'json', f], { encoding: 'utf8' })
  ).streams[0];

const работа = [];
for (const p of projects.projects ?? projects) {
  const клип = ролик(p);
  const снимок = p.shots?.[0]?.file;
  if (!клип || !снимок || !existsSync(join(root, 'assets/shots', снимок))) continue;
  const было = размер(join(root, 'assets/shots', снимок));
  const у = размер(join(root, 'assets/clips', клип));
  console.log(`\n  ${p.id}`);
  console.log(`    заглушка ${было.width}×${было.height}, ролик ${у.width}×${у.height}`);
  if (!смотреть && названы.includes(p.id)) работа.push({ id: p.id, клип, снимок });
}
if (смотреть || !работа.length) {
  console.log(смотреть ? '\n  только смотрел' : '\n  никого не выбрано');
  process.exit(0);
}

const ТИПЫ = { '.mp4': 'video/mp4', '.html': 'text/html' };
const сервер = createServer(async (req, res) => {
  const п = decodeURIComponent(req.url.split('?')[0]);
  if (п === '/') {
    res.writeHead(200, { 'content-type': 'text/html' });
    return res.end('<!doctype html><meta charset=utf-8><body style="margin:0;background:#000">');
  }
  // Файл читаем ДО того, как отправить заголовки: иначе на неудаче
  // заголовки уже ушли, и попытка отдать 404 валит сервер.
  let тело;
  try {
    тело = await readFile(join(root, п));
  } catch {
    res.writeHead(404);
    return res.end('нет');
  }
  res.writeHead(200, { 'content-type': ТИПЫ[extname(п)] || 'application/octet-stream' });
  res.end(тело);
});
await new Promise((r) => сервер.listen(4201, '127.0.0.1', r));

const PORT = 9473;
const chrome = запуститьChrome(PORT, '1400,1000');
const send = await подключиться(PORT);
await send('Page.enable');
await send('Page.navigate', { url: 'http://127.0.0.1:4201/' });
await sleep(1500);

for (const { id, клип, снимок } of работа) {
  const данные = await send('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: `(async () => {
      const v = document.createElement('video');
      v.muted = true; v.playsInline = true;
      v.src = '/assets/clips/${клип}';
      document.body.append(v);
      v.load();
      try { await v.play(); } catch (e) {}
      v.pause();
      for (let n = 0; n < 80; n++) {
        await new Promise((r) => setTimeout(r, 120));
        if (v.readyState >= 2 && v.videoWidth) break;
      }
      if (!v.videoWidth) return 'НЕ ЗАГРУЗИЛСЯ';
      // Перемотку надо ДОЖДАТЬСЯ: пока seek не закончился, на экране
      // остаётся тот кадр, куда ролик успел уехать после play().
      await new Promise((r) => {
        if (v.currentTime === 0) return r();
        v.addEventListener('seeked', r, { once: true });
        v.currentTime = 0;
        setTimeout(r, 3000);
      });
      const c = document.createElement('canvas');
      c.width = v.videoWidth; c.height = v.videoHeight;
      c.getContext('2d').drawImage(v, 0, 0);
      v.remove();
      return c.toDataURL('image/png').slice(22);
    })()`,
  }).then((r) => r.result.value);

  if (данные === 'НЕ ЗАГРУЗИЛСЯ') {
    console.log(`\n  ${id}: ролик не загрузился, заглушка не тронута`);
    continue;
  }
  const врем = join(root, 'assets/shots', `.${снимок}.png`);
  writeFileSync(врем, Buffer.from(данные, 'base64'));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', врем, '-q:v', '2',
    join(root, 'assets/shots', снимок)]);
  execFileSync('rm', ['-f', врем]);
  const стало = размер(join(root, 'assets/shots', снимок));
  const вес = Math.round(statSync(join(root, 'assets/shots', снимок)).size / 1024);
  console.log(`\n  ${id} → ${снимок} ${стало.width}×${стало.height}, ${вес} КБ, нарисовано браузером`);
}

send.закрыть();
chrome.kill();
сервер.close();
