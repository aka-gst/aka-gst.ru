// Снимает игровой экран, а не заставку.
//
//   node tools/shoot-games.mjs            все игры
//   node tools/shoot-games.mjs acid leela только эти
//
// Одиночный `--screenshot` у Chrome снимает то, что видно сразу после
// загрузки, а это всегда меню: «СТАРТ», «НАЧАТЬ», правила. Здесь Chrome
// поднимается с отладочным портом, по нему прокликивается путь до игры,
// и только потом делается кадр. WebSocket берём встроенный — в Node 22+
// он глобальный, лишних зависимостей не нужно.
//
// steps — цепочка подписей на кнопках с паузой после каждой. Скрипт
// сообщает, что нажалось (+) и что не нашлось (-), и называет кнопки,
// оставшиеся на экране: по ним видно, куда идти дальше, без угадывания.
//
// clip — область кадра. Нужна там, где рядом с полем висит таблица
// рекордов: чужие ники не должны застывать картинкой на портфолио.
//
// Кадры кладутся в scratch-папку рядом со скриптом; в assets/shots их
// переводит sips — см. раздел «Снимки экрана» в README.

import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9334;
const OUT = new URL('../.shots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const only = process.argv.slice(2);

const PLAN = [
  { id: 'acid',     url: 'https://aka-gst.ru/acid/',
    steps: [['ПОНЯТНО', 1500], ['ИГРАТЬ', 2500], ['ПОНЯТНО', 1500], ['НАЧАТЬ ПАРТИЮ', 4000]] },
  // clip — область кадра. Нужна там, где рядом с полем висит таблица
  // рекордов: чужие ники не должны застывать картинкой на портфолио,
  // хотя на живой странице они и так видны и меняются.
  { id: 'tetcolor', url: 'https://aka-gst.ru/tetcolor/',
    steps: [['СТАРТ', 3000]], clip: { x: 462, y: 60, width: 540, height: 562 } },
  { id: 'lines',    url: 'https://aka-gst.ru/lines/',
    steps: [['НАЧАТЬ', 2500]], clip: { x: 198, y: 20, width: 596, height: 590 } },
  { id: 'stihii',   url: 'https://aka-gst.ru/stihii/',
    steps: [['СВОБОДНЫЙ БОЙ', 1200], ['ЛЁГКИЙ', 2500]] },
  { id: 'leela',    url: 'https://aka-gst.ru/leela/',
    // Окно выбора проводника светлое и в ряду тёмных карточек бьёт по глазам.
    // Выбираем проводника и снимаем само поле.
    steps: [['ПУТЕШЕСТВЕННИК', 2500], ['БРОСИТЬ КУБИК', 2500]],
    clip: { x: 297, y: 55, width: 624, height: 596 } },
  // Кольчатый управляется камерой: в headless руки нет, игра не стартует.
  // Снимаем экран выбора оружия — дальше без живого человека не пройти.
  { id: 'worm',     url: 'https://aka-gst.ru/worm/', steps: [] },
  { id: 'coin',     url: 'https://aka-gst.ru/coin/',
    steps: [['ПОНЯТНО, НАЧИНАЕМ', 2500], ['ДОИТЬ', 1500]] },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
  `--remote-debugging-port=${PORT}`, '--window-size=1200,750', 'about:blank',
], { stdio: 'ignore' });

const session = (ws) => {
  let seq = 0;
  const waiting = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
  });
  return (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = (seq += 1);
      waiting.set(id, (m) => (m.error ? reject(new Error(m.error.message)) : resolve(m.result)));
      ws.send(JSON.stringify({ id, method, params }));
    });
};

const clickable = `[...document.querySelectorAll('button, a, [role=button], .btn, li, div, span')]
  .filter(el => {
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 20) return false;
    const t = (el.textContent || '').trim();
    return t && t.length < 200;
  })`;

const clickScript = (label) => `(() => {
  const hit = ${clickable}
    .filter(el => el.textContent.trim().toUpperCase().includes(${JSON.stringify(label)}))
    .sort((a, b) => a.textContent.length - b.textContent.length)[0];
  if (!hit) return false;
  hit.click();
  return true;
})()`;

const probeScript = `(() => {
  const t = new Set(${clickable}
    .map(el => el.textContent.trim().replace(/\\s+/g, ' '))
    .filter(s => s.length < 60));
  return [...t].slice(0, 14).join(' | ');
})()`;

const run = async () => {
  for (let i = 0; i < 60; i += 1) {
    try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break; } catch {}
    await sleep(250);
  }
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  const send = session(ws);
  await send('Page.enable');

  for (const game of PLAN) {
    if (only.length && !only.includes(game.id)) continue;
    const log = [];
    try {
      // Гонка со временем: одна медленная страница не должна вешать проход.
      await Promise.race([
        (async () => {
          await send('Page.navigate', { url: game.url });
          await sleep(4500);
          for (const [label, pause] of game.steps) {
            const hit = await send('Runtime.evaluate', { expression: clickScript(label), returnByValue: true });
            log.push(`${label}${hit.result.value ? '+' : '-'}`);
            if (hit.result.value) await sleep(pause);
          }
        })(),
        sleep(30000).then(() => { throw new Error('слишком долго'); }),
      ]);
    } catch (e) {
      log.push(`(${e.message})`);
    }
    const probe = await send('Runtime.evaluate', { expression: probeScript, returnByValue: true })
      .catch(() => ({ result: { value: '—' } }));
    const shot = await send('Page.captureScreenshot',
      game.clip ? { format: 'png', clip: { ...game.clip, scale: 1 } } : { format: 'png' });
    writeFileSync(`${OUT}play-${game.id}.png`, Buffer.from(shot.data, 'base64'));
    console.log(`${game.id.padEnd(9)} ${log.join(' ')}\n          осталось: ${probe.result.value}`);
  }
  ws.close();
  chrome.kill();
};

run().catch((e) => { console.error(e.message); chrome.kill(); process.exit(1); });
