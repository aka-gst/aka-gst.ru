// Записывает по несколько секунд игры для превью на карточке.
//
//   node tools/record-games.mjs            все игры
//   node tools/record-games.mjs acid coin  только эти
//
// Путь до игрового экрана берётся из общего плана (games-plan.mjs) — того
// же, по которому снимаются неподвижные кадры. Отличие одно: во время
// записи игре надо чем-то заниматься. Половина из них в покое неподвижна —
// монета ждёт броска, шары ждут хода, — и ролик вышел бы фотографией.
// Поэтому у каждой записи свой набор действий: жать пробел, кликать кнопку,
// идти клавишами.
//
// Кадры собирает Page.startScreencast, склеивает ffmpeg. Обрезка — та же
// область, что и у неподвижного кадра, чтобы превью и постер совпадали.

import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { PLAN } from './games-plan.mjs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9370;
const OUT = new URL('../.shots/', import.meta.url).pathname;
const TMP = new URL('../.shots/frames/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

// Чем игра занята во время записи и, если нужно, своя область кадра.
// У Тетколора она выше, чем у снимка: снимок нацелен на дно стакана, где к
// тому времени уже лежит стопка, а в свежей партии кубики появляются сверху
// и до низа доезжают не сразу — первые секунды ролика были пустой сеткой.
const DURING = {
  acid: { seconds: 5 },                                   // соперники ходят сами, идёт таймер
  tetcolor: { seconds: 6, clip: { x: 458, y: 150, width: 300, height: 300 } },
  lines: { seconds: 5, click: 'НОВАЯ ИГРА', everyMs: 1700 }, // шары появляются заново
  stihii: { seconds: 5, click: 'В БОЙ', everyMs: 1800 },   // размен ударами
  technomagic: { seconds: 5, key: 'd', everyMs: 260 },      // маг идёт по парку
  worm: { seconds: 5 },                                    // противники подходят сами
  coin: { seconds: 5, click: 'БРОСИТЬ МОНЕТУ', everyMs: 1500 },
};

const only = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
  `--remote-debugging-port=${PORT}`, '--window-size=1200,750', 'about:blank',
], { stdio: 'ignore' });

const session = (ws) => {
  let seq = 0;
  const waiting = new Map();
  const listeners = [];
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); return; }
    if (m.method) listeners.forEach((fn) => fn(m));
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = (seq += 1);
      waiting.set(id, (m) => (m.error ? reject(new Error(m.error.message)) : resolve(m.result)));
      ws.send(JSON.stringify({ id, method, params }));
    });
  send.on = (fn) => listeners.push(fn);
  return send;
};

const clickScript = (label) => `(() => {
  const hit = [...document.querySelectorAll('button, a, [role=button], .btn, li, div, span')]
    .filter(el => {
      const r = el.getBoundingClientRect();
      const t = (el.textContent || '').trim();
      return r.width > 40 && r.height > 20 && t && t.length < 200 &&
             t.toUpperCase().includes(${JSON.stringify(label)});
    })
    .sort((a, b) => a.textContent.length - b.textContent.length)[0];
  if (!hit) return false;
  hit.click();
  return true;
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

  let n = 0;
  let пишем = false;
  send.on(async (m) => {
    if (m.method !== 'Page.screencastFrame') return;
    if (пишем) {
      writeFileSync(`${TMP}f${String((n += 1)).padStart(4, '0')}.jpg`, Buffer.from(m.params.data, 'base64'));
    }
    await send('Page.screencastFrameAck', { sessionId: m.params.sessionId }).catch(() => {});
  });

  for (const game of PLAN) {
    if (only.length && !only.includes(game.id)) continue;
    const plan = DURING[game.id] || { seconds: 5 };

    try {
      await Promise.race([
        (async () => {
          await send('Page.navigate', { url: game.url });
          await sleep(4500);
          for (const [label, pause] of game.steps) {
            const hit = await send('Runtime.evaluate', { expression: clickScript(label), returnByValue: true });
            if (hit.result.value) await sleep(pause);
          }
        })(),
        sleep(40000).then(() => { throw new Error('страница не дошла за 40 с'); }),
      ]);
    } catch (e) {
      console.log(`${game.id.padEnd(12)} пропущена: ${e.message}`);
      continue;
    }
    // game.play из общего плана здесь намеренно не выполняется: те нажатия
    // существуют, чтобы на неподвижном кадре поле было не пустым. В записи
    // они доводили партию до конца, экран замирал, и вместо ролика
    // получалась фотография — первый прогон дал ровно один кадр.

    // ── запись ──────────────────────────────────────────────────────
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(TMP, { recursive: true });
    n = 0;

    const started = Date.now();
    пишем = true;
    await send('Page.startScreencast', { format: 'jpeg', quality: 80, everyNthFrame: 1 });
    const until = started + plan.seconds * 1000;
    while (Date.now() < until) {
      if (plan.key) {
        for (const type of ['keyDown', 'keyUp']) {
          await send('Input.dispatchKeyEvent', {
            type, key: plan.key, code: plan.key === ' ' ? 'Space' : `Key${plan.key.toUpperCase()}`,
            windowsVirtualKeyCode: plan.key === ' ' ? 32 : plan.key.toUpperCase().charCodeAt(0),
          }).catch(() => {});
        }
      }
      if (plan.click) await send('Runtime.evaluate', { expression: clickScript(plan.click) }).catch(() => {});
      await sleep(plan.everyMs || 500);
    }
    await send('Page.stopScreencast');
    пишем = false;
    await sleep(400);

    const seconds = (Date.now() - started) / 1000;
    // Частоту на входе берём настоящую, без ограничения сверху. Ограничение
    // растягивало время: у Деревни 361 кадр за 5 секунд превращались в 15
    // секунд ролика. Выходную частоту задаём отдельно (-r), тогда ffmpeg
    // выбрасывает или повторяет кадры, а длительность остаётся живой.
    const c = plan.clip || game.clip;
    // Обрезаем ту же область, что и у неподвижного кадра, и приводим ширину
    // к 600px: на карточке полоса 287px, с учётом плотных экранов этого
    // хватает с запасом. Чётные стороны обязательны для yuv420p.
    const crop = c ? `crop=${c.width - (c.width % 2)}:${c.height - (c.height % 2)}:${c.x}:${c.y},` : '';
    const ff = spawnSync('ffmpeg', [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-framerate', (Math.max(0.5, n / seconds)).toFixed(3), '-i', `${TMP}f%04d.jpg`,
      '-vf', `${crop}scale=600:-2:flags=lanczos`,
      '-an', '-r', '20', '-t', '6',
      '-c:v', 'libx264', '-profile:v', 'main', '-pix_fmt', 'yuv420p',
      '-crf', '32', '-preset', 'slow', '-movflags', '+faststart',
      `${OUT}clip-${game.id}.mp4`,
    ]);
    const size = ff.status === 0
      ? readdirSync(OUT).includes(`clip-${game.id}.mp4`)
        ? `${Math.round(spawnSync('stat', ['-f%z', `${OUT}clip-${game.id}.mp4`]).stdout.toString().trim() / 1024)} КБ`
        : 'файла нет'
      : `ffmpeg: ${ff.stderr.toString().trim().slice(0, 120)}`;
    const длит = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
      '-of', 'default=nk=1:nw=1', `${OUT}clip-${game.id}.mp4`]).stdout.toString().trim();
    console.log(`${game.id.padEnd(12)} кадров ${String(n).padStart(3)} за ${seconds.toFixed(1)}с · ролик ${Number(длит).toFixed(1)}с · ${size}`);
  }
  rmSync(TMP, { recursive: true, force: true });
  ws.close();
  chrome.kill();
};

run().catch((e) => { console.error(e.message); chrome.kill(); process.exit(1); });
