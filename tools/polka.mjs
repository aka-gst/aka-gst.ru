#!/usr/bin/env node
// Полка сборников: проверка поведения, а не разметки.
//
// Правило 7в — мерить надо то, что делает человек, а не то, что мы имели
// в виду. Разметку и стили можно проверить чтением, но вопрос у человека
// другой: стоят ли три обложки рядом, раскрывается ли сборник, сворачивается
// ли он повторным нажатием, доезжает ли текст рассказа. Ни на один из этих
// вопросов чтение файла не отвечает: ряд задаётся раскладкой, сворачивание —
// двумя обработчиками, текст — сетью.
//
// Ловится этим, в частности, поломка, которая тут уже была: список рассказов
// шире карточки, и при автоподборе колонок он разрывал строку на себе — одна
// карточка оставалась наверху, две уезжали под список. Разметка при этом
// была верной, тесты зелёными, и увидеть это можно было только замером.
//
//   node tools/polka.mjs                      # по местному дереву
//   node tools/polka.mjs https://aka-gst.ru   # по бою
import { запуститьChrome, подключиться, sleep } from './igrat.mjs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const КОРЕНЬ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ТИПЫ = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.mp4': 'video/mp4',
};

const внешний = process.argv[2];
let сервер = null;
let адрес = внешний ? `${внешний.replace(/\/$/, '')}/rasskazy/` : 'http://127.0.0.1:4199/rasskazy/';

if (!внешний) {
  сервер = createServer(async (req, res) => {
    let п = decodeURIComponent(req.url.split('?')[0]);
    if (п.endsWith('/')) п += 'index.html';
    try {
      const т = await readFile(join(КОРЕНЬ, п));
      res.writeHead(200, { 'content-type': ТИПЫ[extname(п)] || 'application/octet-stream' });
      res.end(т);
    } catch {
      res.writeHead(404);
      res.end('нет');
    }
  });
  await new Promise((r) => сервер.listen(4199, '127.0.0.1', r));
}

const PORT = 9467;
const chrome = запуститьChrome(PORT, '1280,900');
const send = await подключиться(PORT);
await send('Page.enable');

const из = async (e) =>
  (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result
    .value;

const беды = [];
const проверить = (что, ладно, чем) => {
  console.log(`  ${ладно ? '✓' : '✗'} ${что}${чем ? ` — ${чем}` : ''}`);
  if (!ладно) беды.push(что);
};

const открытые = `[...document.querySelectorAll('.book')]
  .filter((b) => !b.querySelector('.book-body').hidden)
  .map((b) => b.querySelector('h2').textContent)`;

for (const [экран, w, h, mobile] of [
  ['широкий', 1280, 900, false],
  ['телефон', 390, 844, true],
]) {
  console.log(`\n${экран} ${w}×${h}`);
  await send('Emulation.setDeviceMetricsOverride', {
    width: w, height: h, deviceScaleFactor: 1, mobile,
  });
  await send('Page.navigate', { url: адрес });
  await sleep(3200);

  const карточек = await из(`document.querySelectorAll('.bcard').length`);
  проверить('три карточки сборников есть', карточек === 3, `их ${карточек}`);
  if (карточек !== 3) break;

  // Ряд: на широком экране три карточки обязаны стоять на одной высоте,
  // на телефоне — наоборот, друг под другом.
  const верх = await из(
    `JSON.stringify([...document.querySelectorAll('.bcard')].map((c) => Math.round(c.getBoundingClientRect().top)))`
  );
  const рядов = new Set(JSON.parse(верх)).size;
  if (mobile) проверить('на телефоне карточки идут столбцом', рядов === 3, `рядов ${рядов}`);
  else проверить('три обложки стоят в одном ряду', рядов === 1, `верх: ${верх}`);

  // Карточки видны целиком: обложка не обрезана полосой.
  const вылез = await из(`[...document.querySelectorAll('.bart-list')].filter((i) => {
    const b = i.getBoundingClientRect(), п = i.closest('.bart').getBoundingClientRect();
    return b.height > п.height + 1 || b.width > п.width + 1;
  }).length`);
  проверить('обложки вписаны в полосу, не обрезаны', вылез === 0, `вылезло ${вылез}`);

  const сперва = JSON.parse(await из(`JSON.stringify(${открытые})`));
  проверить('при загрузке раскрыт ровно один сборник', сперва.length === 1, сперва.join(', '));
  проверить('раскрыт самый свежий', сперва[0] === (await из(`document.querySelector('.book h2').textContent`)));

  await из(`document.querySelectorAll('.bcard')[1].click(); 1`);
  await sleep(400);
  const второй = JSON.parse(await из(`JSON.stringify(${открытые})`));
  проверить('нажатие на карточку раскрывает её', второй.length === 1 && второй[0] !== сперва[0], второй.join(', '));

  await из(`document.querySelectorAll('.bcard')[1].click(); 1`);
  await sleep(400);
  const снова = JSON.parse(await из(`JSON.stringify(${открытые})`));
  проверить('повторное нажатие сворачивает', снова.length === 0, снова.join(', ') || 'закрыт');

  // Строка действия лежит ВНУТРИ карточки: если бы у неё был свой
  // обработчик, нажатие сработало бы дважды и не изменило бы ничего.
  await из(`document.querySelectorAll('.book-toggle')[2].click(); 1`);
  await sleep(400);
  const надпись = JSON.parse(await из(`JSON.stringify(${открытые})`));
  проверить('нажатие на надпись работает один раз, а не два', надпись.length === 1, надпись.join(', ') || 'ничего не открылось');

  const абзацев = await из(`(async () => {
    const a = document.querySelector('.book-body:not([hidden]) .book-list a');
    a.click();
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const т = document.querySelector('.story-inline-body');
      if (т) return т.querySelectorAll('p').length;
    }
    return 0;
  })()`);
  проверить('рассказ разворачивается на месте', абзацев > 3, `абзацев ${абзацев}`);
}

send.закрыть();
chrome.kill();
сервер?.close();

console.log(беды.length ? `\nне сошлось: ${беды.length}` : '\nвсё сошлось');
process.exit(беды.length ? 1 : 0);
