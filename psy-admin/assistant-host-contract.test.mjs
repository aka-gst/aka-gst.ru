import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const repoRoot = new URL("../", import.meta.url).pathname;
const voiceA = await readFile(new URL("./audio/voices/psyadmin-A.wav", import.meta.url));
assert.equal(voiceA.subarray(0, 4).toString("ascii"), "RIFF");
assert.ok(voiceA.length > 10_000, "Голос A должен быть настоящим WAV, а не пустой заглушкой");
const fixture = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head><body>
<script>
window.__audioStops = 0;
window.__speechStops = 0;
window.__handoffNetworkRequests = 0;
window.fetch = (...args) => { window.__handoffNetworkRequests += 1; return Promise.reject(new Error("network disabled in contract")); };
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
Object.defineProperty(window, "speechSynthesis", { configurable: true, value: { speaking: true, cancel() { window.__speechStops += 1; this.speaking = false; } } });
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
const debuggingPort = port + 1;
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
  "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
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
      labels: [...root.querySelectorAll('.psy-widget-handoff label')].map((label) => label.firstChild.textContent.trim()),
      timeOptions: [...root.querySelectorAll('[name="requestedTime"] option')].length,
    };
  })()`);
  assert.equal(initial.marker, "candidate");
  assert.deepEqual(initial.voiceLabels, ["A"]);
  assert.equal(initial.stopText, "■ Стоп");
  assert.equal(initial.stopVisible, true);
  assert.doesNotMatch(initial.text, /естественный голос|голос B|голос Б|голос C|голос В/i);
  assert.deepEqual(initial.labels, ["К кому вы хотите пойти?", "Желаемое время", "Комментарий", "Телефон или e-mail"]);
  assert.equal(initial.timeOptions, 0, "Желаемое время не должно изображать расписание слотами");
  assert.match(initial.text, /Администратор уточнит время у психолога и подтвердит запись\./);

  const stopResult = await evaluate(`(async () => {
    const root = document.querySelector('[data-psy-widget]');
    const mic = root.querySelector('.psy-widget-mic');
    const before = mic.getBoundingClientRect();
    root.querySelector('[data-voice-preview]').click();
    await Promise.resolve();
    root.querySelector('[data-voice-stop]').click();
    const after = mic.getBoundingClientRect();
    return { audioStops: window.__audioStops, speechStops: window.__speechStops, sameGeometry: before.width === after.width && before.height === after.height && before.x === after.x };
  })()`);
  assert.ok(stopResult.audioStops >= 1);
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

  const handoff = await evaluate(`(() => {
    const root = document.querySelector('[data-psy-widget]');
    root.querySelector('.psy-widget-handoff-toggle').click();
    root.querySelector('[name="specialist"]').value = "help-me-choose";
    root.querySelector('[name="requestedTime"]').value = "будни после 18:00";
    root.querySelector('[name="comment"]').value = "Первая консультация";
    root.querySelector('[name="contact"]').value = "+7 900 000-00-00";
    root.querySelector('.psy-widget-handoff').requestSubmit();
    return { receipt: root.querySelector('.psy-widget-handoff-status').textContent, inbox: window.__psyAdminTestInbox, networkRequests: window.__handoffNetworkRequests };
  })()`);
  assert.match(handoff.receipt, /PSY-TEST-/);
  assert.match(handoff.receipt, /ничего не отправлено/i);
  assert.equal(handoff.inbox.length, 1);
  assert.equal(handoff.inbox[0].specialist, "help-me-choose");
  assert.equal(handoff.networkRequests, 0);

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
}
