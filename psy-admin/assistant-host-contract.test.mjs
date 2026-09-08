import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { tmpdir } from "node:os";

const repoRoot = new URL("../", import.meta.url).pathname;
const voiceA = await readFile(new URL("./audio/voices/psyadmin-A.wav", import.meta.url));
assert.equal(voiceA.subarray(0, 4).toString("ascii"), "RIFF");
assert.ok(voiceA.length > 10_000, "Голос A должен быть настоящим WAV, а не пустой заглушкой");
const fixture = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head><body>
<script>
window.__audioStops = 0;
window.__speechStops = 0;
window.__spokenTexts = [];
window.__handoffNetworkRequests = [];
window.__handoffResponseStatus = 201;
window.fetch = async (url, init = {}) => {
  window.__handoffNetworkRequests.push({ url: String(url), method: init.method, body: init.body });
  if (String(url).endsWith("/booking/api/ask")) {
    return new Response(JSON.stringify({ text: "Ответ на backspace.com/path и orion-center.ru/schedule \\\\ служебный хвост.", kind: "route" }), { status: 200, headers: { "content-type": "application/json" } });
  }
  const status = window.__handoffResponseStatus;
  return new Response(JSON.stringify(status === 201
    ? { publicCode: "ORION-RECEIPT", status: "pending", message: "Администратор свяжется с вами." }
    : { error: "Сервис записи временно недоступен." }), { status, headers: { "content-type": "application/json" } });
};
class TestXHR { open() { window.__handoffNetworkRequests += 1; } send() {} }
window.XMLHttpRequest = TestXHR;
class TestAudio {
  constructor(src) { this.src = src; this.currentTime = 0; this.volume = 1; this.paused = true; }
  addEventListener() {}
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; window.__audioStops += 1; }
}
class TestAudioContext {
  constructor() { this.state = "running"; this.destination = {}; }
  createMediaElementSource() { return { connect: () => ({ connect() {} }) }; }
  createBiquadFilter() { return { type: "", frequency: {}, Q: {}, gain: {}, connect() {} }; }
  close() { return Promise.resolve(); }
  resume() { return Promise.resolve(); }
}
window.Audio = TestAudio;
window.AudioContext = TestAudioContext;
class TestRecognition {
  addEventListener() {}
  start() {}
  abort() {}
}
window.SpeechRecognition = TestRecognition;
class TestUtterance {
  constructor(text) { this.text = text; }
  addEventListener() {}
}
window.SpeechSynthesisUtterance = TestUtterance;
Object.defineProperty(window, "speechSynthesis", { configurable: true, value: {
  speaking: true,
  cancel() { window.__speechStops += 1; this.speaking = false; },
  getVoices() { return []; },
  speak(utterance) { window.__spokenTexts.push(utterance.text); },
} });
</script>
<script type="module" src="/psy-admin/psy-widget.js"></script></body></html>`;

const mime = { ".js": "text/javascript", ".css": "text/css", ".wav": "audio/wav", ".html": "text/html" };
const server = createServer(async (request, response) => {
  if (request.url === "/__assistant-host-test.html") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(fixture);
    return;
  }
  const pathname = normalize(decodeURIComponent((request.url || "/").split("?")[0])).replace(/^\.\.(\/|\\)/, "");
  try {
    const body = await readFile(join(repoRoot, pathname));
    response.writeHead(200, { "content-type": mime[extname(pathname)] || "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end("not found");
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const portProbe = createServer();
await new Promise((resolve) => portProbe.listen(0, "127.0.0.1", resolve));
const debuggingPort = portProbe.address().port;
await new Promise((resolve) => portProbe.close(resolve));
const profile = await mkdtemp(join(tmpdir(), "psy-assistant-host-test-"));
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
  "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  `--user-data-dir=${profile}`,
  `--remote-debugging-port=${debuggingPort}`, `http://127.0.0.1:${port}/__assistant-host-test.html`,
], { stdio: "ignore" });

async function waitForTarget() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const targets = await fetch(`http://127.0.0.1:${debuggingPort}/json`).then((response) => response.json());
      const target = targets.find((item) => item.type === "page" && item.url.includes("__assistant-host-test"));
      if (target) return target.webSocketDebuggerUrl;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Chrome DevTools target did not start");
}

const socket = new WebSocket(await waitForTarget());
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});
let commandId = 0;
const pending = new Map();
socket.addEventListener("message", ({ data }) => {
  const message = JSON.parse(data);
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message));
  else resolve(message.result);
});
function cdp(method, params = {}) {
  const id = ++commandId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
async function evaluate(expression) {
  const result = await cdp("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

try {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (await evaluate("Boolean(document.querySelector('[data-psy-widget]'))")) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  await evaluate("document.querySelector('.psy-widget-trigger').click()");
  const initial = await evaluate(`(() => {
    const root = document.querySelector('[data-psy-widget]');
    const voiceButtons = [...root.querySelectorAll('[data-voice-preview]')];
    const stop = root.querySelector('[data-voice-stop]');
    return {
      marker: root.dataset.assistantHost,
      voiceLabels: voiceButtons.map((button) => button.textContent.trim()),
      stopText: stop?.textContent.trim(),
      stopVisible: Boolean(stop && stop.getBoundingClientRect().width && stop.getBoundingClientRect().height),
      text: root.textContent,
      labels: [...root.querySelectorAll('.psy-widget-handoff label')].map((label) => label.firstChild.textContent.trim()).filter(Boolean),
      timeOptions: [...root.querySelectorAll('[name="requestedTime"] option')].length,
    };
  })()`);
  assert.equal(initial.marker, "live");
  assert.deepEqual(initial.voiceLabels, []);
  assert.equal(initial.stopText, "Остановить голос");
  assert.equal(initial.stopVisible, true);
  assert.doesNotMatch(initial.text, /естественный голос|голос B|голос Б|голос C|голос В/i);
  for (const label of ["Что вас интересует?", "К какому психологу хотите записаться?", "Желаемые дата и время", "Ваше имя", "Комментарий", "Телефон или e-mail"]) {
    assert.ok(initial.labels.includes(label), `в форме должна быть подпись «${label}»`);
  }
  assert.match(initial.text, /Я согласен передать указанный контакт администратору центра только для обработки этой заявки\./);
  assert.equal(initial.timeOptions, 0, "Желаемое время не должно изображать расписание слотами");
  assert.match(initial.text, /Для личных консультаций пока нет общего календаря свободных окон/);

  const stopResult = await evaluate(`(async () => {
    const root = document.querySelector('[data-psy-widget]');
    const mic = root.querySelector('.psy-widget-mic');
    const before = mic.getBoundingClientRect();
    root.querySelector('[data-voice-stop]').click();
    const after = mic.getBoundingClientRect();
    return { audioStops: window.__audioStops, speechStops: window.__speechStops, sameGeometry: before.width === after.width && before.height === after.height && before.x === after.x };
  })()`);
  assert.ok(stopResult.speechStops >= 1);
  assert.equal(stopResult.sameGeometry, true);

  const listeningGeometry = await evaluate(`(() => {
    const mic = document.querySelector('.psy-widget-mic');
    const before = mic.getBoundingClientRect();
    mic.click();
    const active = mic.getBoundingClientRect();
    document.querySelector('[data-voice-stop]').click();
    return { widthDelta: active.width - before.width, heightDelta: active.height - before.height, xDelta: active.x - before.x };
  })()`);
  assert.ok(Math.abs(listeningGeometry.widthDelta) < 0.01);
  assert.ok(Math.abs(listeningGeometry.heightDelta) < 0.01);
  assert.ok(Math.abs(listeningGeometry.xDelta) < 0.01);

  const spokenAnswer = await evaluate(`(async () => {
    const root = document.querySelector('[data-psy-widget]');
    const input = root.querySelector('#psy-widget-question');
    input.value = 'Неподготовленный вопрос';
    input.form.requestSubmit();
    for (let attempt = 0; attempt < 40 && !window.__spokenTexts.length; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 25));
    const spoken = window.__spokenTexts.at(-1) || '';
    window.__handoffNetworkRequests = [];
    return spoken;
  })()`);
  assert.match(spokenAnswer, /Ответ на/i);
  assert.doesNotMatch(spokenAnswer, /backspace|orion-center|\.com|\.ru|https?|[\\/]/i, "В объект озвучивания не должны попадать домены и slash/backslash");

  const handoff = await evaluate(`(async () => {
    const root = document.querySelector('[data-psy-widget]');
    root.querySelector('.psy-widget-handoff-toggle').click();
    root.querySelector('[name="requestKind"]').value = "specialist";
    root.querySelector('[name="subject"]').value = "Не знаю — администратор поможет подобрать";
    root.querySelector('[name="requestedTime"]').value = "будни после 18:00";
    root.querySelector('[name="clientName"]').value = "Анна";
    root.querySelector('[name="comment"]').value = "Первая консультация";
    root.querySelector('[name="contact"]').value = "+7 900 000-00-00";
    root.querySelector('[name="consent"]').checked = true;
    root.querySelector('.psy-widget-handoff').requestSubmit();
    for (let attempt = 0; attempt < 40 && !root.querySelector('.psy-widget-message.success'); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 25));
    return { receipt: root.querySelector('.psy-widget-message.success')?.textContent || '', formHidden: root.querySelector('.psy-widget-handoff').hidden, inbox: window.__psyAdminTestInbox, networkRequests: window.__handoffNetworkRequests };
  })()`);
  assert.match(handoff.receipt, /Заявка отправлена/);
  assert.match(handoff.receipt, /ORION-RECEIPT/);
  assert.equal(handoff.formHidden, true);
  assert.equal(handoff.inbox, undefined);
  assert.equal(handoff.networkRequests.length, 1);
  assert.equal(handoff.networkRequests[0].method, "POST");
  assert.match(handoff.networkRequests[0].url, /\/psy-admin\/booking\/api\/requests$/);
  assert.deepEqual(JSON.parse(handoff.networkRequests[0].body), {
    kind: "specialist",
    subject: "Не знаю — администратор поможет подобрать",
    requestedDateTime: "будни после 18:00",
    clientName: "Анна",
    details: "Первая консультация",
    contact: "+7 900 000-00-00",
    consent: true,
  });

  const rejectedHandoff = await evaluate(`(async () => {
    const root = document.querySelector('[data-psy-widget]');
    window.__handoffResponseStatus = 503;
    root.querySelector('.psy-widget-handoff-toggle').click();
    root.querySelector('[name="subject"]').value = "Смирнова Юлия Сергеевна";
    root.querySelector('[name="requestedTime"]').value = "завтра утром";
    root.querySelector('[name="clientName"]').value = "Анна";
    root.querySelector('[name="contact"]').value = "client@example.test";
    root.querySelector('[name="consent"]').checked = true;
    root.querySelector('.psy-widget-handoff').requestSubmit();
    for (let attempt = 0; attempt < 40 && !root.querySelector('.psy-widget-handoff-status').textContent.includes('недоступен'); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 25));
    return { receipt: root.querySelector('.psy-widget-handoff-status').textContent, specialist: root.querySelector('[name="subject"]').value, networkCount: window.__handoffNetworkRequests.length };
  })()`);
  assert.match(rejectedHandoff.receipt, /временно недоступен/i);
  assert.equal(rejectedHandoff.specialist, "Смирнова Юлия Сергеевна");
  assert.equal(rejectedHandoff.networkCount, 2);

  const stickyStop = await evaluate(`(() => {
    const panel = document.querySelector('.psy-widget-panel');
    const stop = document.querySelector('[data-voice-stop]');
    panel.scrollTop = panel.scrollHeight;
    const panelBox = panel.getBoundingClientRect();
    const stopBox = stop.getBoundingClientRect();
    return stopBox.top >= panelBox.top && stopBox.bottom <= panelBox.bottom;
  })()`);
  assert.equal(stickyStop, true, "Стоп должен оставаться видимым после прокрутки панели");

  if (process.env.PSY_WIDGET_SCREENSHOT) {
    const shot = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    await writeFile(process.env.PSY_WIDGET_SCREENSHOT, Buffer.from(shot.data, "base64"));
  }

  await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  const mobile = await evaluate(`(() => {
    const root = document.querySelector('[data-psy-widget]');
    const stop = root.querySelector('[data-voice-stop]').getBoundingClientRect();
    const mic = root.querySelector('.psy-widget-mic').getBoundingClientRect();
    return { overflow: document.documentElement.scrollWidth - innerWidth, stopWidth: stop.width, stopHeight: stop.height, micWidth: mic.width, micHeight: mic.height };
  })()`);
  assert.ok(mobile.overflow <= 1);
  assert.ok(mobile.stopWidth >= 44 && mobile.stopHeight >= 44);
  assert.ok(mobile.micWidth >= 44 && mobile.micHeight >= 44);
  console.log("psy-admin assistant host contract: passed desktop and 390px mobile");
} finally {
  socket.close();
  chrome.kill("SIGTERM");
  server.close();
  await rm(profile, { recursive: true, force: true });
}
