#!/usr/bin/env node
// Снимает воспроизводимый QueQuest showcase через его покадровый engine-hook.
// Не пишет экран по таймеру: на загруженной машине такой ролик меняет темп.
//
//   node tools/capture-quequest-replay.mjs http://127.0.0.1:8765/showcase-replay.html /tmp/quequest-frames
import { mkdirSync, writeFileSync } from 'node:fs';
import { запуститьChrome, подключиться, sleep } from './igrat.mjs';

const url = process.argv[2] || 'http://127.0.0.1:8765/showcase-replay.html';
const out = process.argv[3];
if (!out) throw new Error('Укажи папку для PNG-кадров вторым аргументом');

mkdirSync(out, { recursive: true });
const port = 9492;
const chrome = запуститьChrome(port, '1280,720');

try {
  const send = await подключиться(port);
  await send('Page.enable');
  await send('Page.navigate', { url: `${url}?frame=0` });

  let meta;
  for (let i = 0; i < 80; i += 1) {
    const result = await send('Runtime.evaluate', {
      expression: `(() => {
        const replay = window.__QUEQUEST_REPLAY__;
        if (!replay) return null;
        replay.pause();
        return { frameCount: replay.frameCount, fps: replay.fps, width: replay.width, height: replay.height, cutFrame: replay.cutFrame };
      })()`,
      returnByValue: true,
    });
    meta = result.result.value;
    if (meta) break;
    await sleep(100);
  }
  if (!meta) throw new Error('window.__QUEQUEST_REPLAY__ не появился');
  if (meta.frameCount !== 411 || meta.width !== 1280 || meta.height !== 720) {
    throw new Error(`Неожиданный replay: ${JSON.stringify(meta)}`);
  }

  for (let frame = 0; frame < meta.frameCount; frame += 1) {
    const result = await send('Runtime.evaluate', {
      expression: `(() => {
        window.__QUEQUEST_REPLAY__.seek(${frame});
        const canvas = document.querySelector('canvas');
        return canvas.toDataURL('image/png').slice('data:image/png;base64,'.length);
      })()`,
      returnByValue: true,
    });
    if (result.exceptionDetails || !result.result.value) throw new Error(`Не снят кадр ${frame}`);
    writeFileSync(`${out}/frame-${String(frame).padStart(4, '0')}.png`, Buffer.from(result.result.value, 'base64'));
    if (frame % 60 === 0 || frame === meta.frameCount - 1) console.log(`  кадр ${frame}/${meta.frameCount - 1}`);
  }
  send.закрыть();
  console.log(JSON.stringify(meta));
} finally {
  chrome.kill();
}
