// Вождение игры через отладочный протокол Chrome: подключиться, прокликать
// путь до игрового экрана, нажать и подержать клавиши, выполнить снippet,
// который даёт сама игра.
//
// Вынесено отдельно, потому что этим занимаются два инструмента — съёмка
// кадров и запись роликов, — и пока у каждого была своя копия, копии
// разъезжались. Съёмка научилась настоящим кодам клавиш и удержанию, а
// записывалка осталась со старым «пробел — 32, всё прочее — 40», и половина
// её роликов выходила фотографиями. Правило 27 в чистом виде: правка в одной
// из копий не сделана.

import { spawn, execSync } from 'node:child_process';

export const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Подметалка ПЕРЕД прогоном, а не уборка после.
//
// 5 сентября 2026: у Глаз висело 4 процесса и 0.92 ГБ. Причина не в
// `chrome.kill()` — он честен, дети умирают вместе с ним, проверено обоими
// исходами. Причина в том, что прогон шёл через `| head -80`: head закрыл
// трубу, следующая печать дала SIGPIPE, Node умер ДО `finally`, и убирать
// стало некому. Уборка, зависящая от того, доживёт ли процесс до конца, —
// уборка на честном слове.
//
// Метём ТОЛЬКО свой порт, а не всё безголовое: на машине работает несколько
// сессий разом, и слепая уборка убила бы чужой живой прогон.
const подмести = (порт) => {
  try {
    const хвосты = execSync(`pgrep -f 'remote-debugging-port=${порт}' || true`)
      .toString().trim().split('\n').filter(Boolean);
    if (!хвосты.length) return 0;
    execSync(`pkill -f 'remote-debugging-port=${порт}' || true`);
    // Пауза ТОЛЬКО когда мели: убитые процессы отпускают порт не мгновенно,
    // и новый Chrome падал с ECONNREFUSED. Поймано проверкой поломкой —
    // подметалка сработала, а прогон после неё не поднялся.
    execSync('sleep 1');
    return хвосты.length;
  } catch { return 0; }
};

export const запуститьChrome = (порт, размер = '1200,750') => {
  const убрано = подмести(порт);
  if (убрано) console.warn(`  igrat: подмёл ${убрано} хвостов с прошлого прогона на порту ${порт}`);
  return spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
    `--remote-debugging-port=${порт}`, `--window-size=${размер}`, 'about:blank',
  ], { stdio: 'ignore' });
};

export const подключиться = async (порт) => {
  for (let i = 0; i < 60; i += 1) {
    try { if ((await fetch(`http://127.0.0.1:${порт}/json/version`)).ok) break; } catch {}
    await sleep(250);
  }
  const список = await (await fetch(`http://127.0.0.1:${порт}/json/list`)).json();
  const ws = new WebSocket(список.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));

  let seq = 0;
  const ждут = new Map();
  const слушатели = [];
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && ждут.has(m.id)) { ждут.get(m.id)(m); ждут.delete(m.id); return; }
    if (m.method) слушатели.forEach((fn) => fn(m));
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = (seq += 1);
      ждут.set(id, (m) => (m.error ? reject(new Error(m.error.message)) : resolve(m.result)));
      ws.send(JSON.stringify({ id, method, params }));
    });
  send.on = (fn) => слушатели.push(fn);
  send.закрыть = () => ws.close();
  return send;
};

const кликабельное = `[...document.querySelectorAll('button, a, [role=button], .btn, li, div, span')]
  .filter(el => {
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 20) return false;
    const t = (el.textContent || '').trim();
    return t && t.length < 200;
  })`;

export const скриптКлика = (подпись) => `(() => {
  const hit = ${кликабельное}
    .filter(el => el.textContent.trim().toUpperCase().includes(${JSON.stringify(подпись)}))
    .sort((a, b) => a.textContent.length - b.textContent.length)[0];
  if (!hit) return false;
  hit.click();
  return true;
})()`;

export const скриптОсмотра = `(() => {
  const t = new Set(${кликабельное}
    .map(el => el.textContent.trim().replace(/\\s+/g, ' '))
    .filter(s => s.length < 60));
  return [...t].slice(0, 14).join(' | ');
})()`;

// Код клавиши передаётся настоящий, а не угаданный: раньше здесь стояло
// «пробел — 32, всё остальное — 40», то есть любая стрелка приезжала в игру
// как «вниз». Пока жали только пробел, это не было видно.
export const нажать = (send) => async (key, code, раз = 1, vk = 32, пауза = 140) => {
  for (let i = 0; i < раз; i += 1) {
    for (const type of ['keyDown', 'keyUp']) {
      await send('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: vk }).catch(() => {});
    }
    await sleep(пауза);
  }
};

// Ходьба — это зажатая клавиша, а не серия нажатий. Пока умели только
// нажимать-отпускать, герой ПЕРИМЕТРА за тридцать «шагов» сдвигался на пиксель.
export const держать = (send) => async (key, code, мс, vk = 32) => {
  const общее = { key, code, windowsVirtualKeyCode: vk };
  await send('Input.dispatchKeyEvent', { type: 'keyDown', autoRepeat: false, ...общее }).catch(() => {});
  await sleep(мс);
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...общее }).catch(() => {});
};

// Один шаг сценария: выполнить снippet игры, зажать клавишу, нажать её
// несколько раз или кликнуть по подписи на кнопке.
export const шаг = (send) => async (s) => {
  if (s.js) await send('Runtime.evaluate', { expression: s.js, awaitPromise: true }).catch(() => {});
  else if (s.hold) await держать(send)(s.key, s.code, s.hold, s.vk ?? 32);
  else if (s.click) await send('Runtime.evaluate', { expression: скриптКлика(s.click) }).catch(() => {});
  else await нажать(send)(s.key, s.code, s.times || 1, s.vk ?? 32, s.pause ?? 140);
  if (s.after) await sleep(s.after);
};

// Довести игру до игрового экрана: заставка, отладочный пульт, первые ходы.
export const дойти = async (send, game, лог = []) => {
  await send('Page.navigate', { url: game.url });
  await sleep(4500);
  for (const [подпись, пауза] of game.steps || []) {
    const попал = await send('Runtime.evaluate', { expression: скриптКлика(подпись), returnByValue: true });
    лог.push(`${подпись}${попал.result.value ? '+' : '-'}`);
    if (попал.result.value) await sleep(пауза);
  }
  // Игра может дать свой путь к нужному экрану — отладочный пульт, переход
  // на уровень, включённый свет. Это честнее, чем водить героя вслепую.
  if (game.js) {
    const r = await send('Runtime.evaluate', { expression: game.js, returnByValue: true, awaitPromise: true });
    лог.push(r.exceptionDetails ? 'пульт-' : 'пульт+');
    await sleep(game.jsWait || 900);
  }
  if (game.play) {
    for (const s of game.play.keys || []) await шаг(send)(s);
    await нажать(send)(' ', 'Space', game.play.drops || 0);
    await sleep(game.play.wait || 0);
  }
  return лог;
};
