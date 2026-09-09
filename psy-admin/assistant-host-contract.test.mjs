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
window.__playedAudio = [];
window.__speechStops = 0;
window.__spokenTexts = [];
window.__spokenVoices = [];
window.__handoffNetworkRequests = [];
window.__handoffResponseStatus = 201;
window.fetch = async (url, init = {}) => {
  window.__handoffNetworkRequests.push({ url: String(url), method: init.method, body: init.body });
  if (String(url).endsWith("/booking/api/ask")) {
    const technicalJunk = "Ответ спокойно backspace backslash бэкспейс обратный слэш \\\\b " + String.fromCharCode(0, 8, 11, 31, 127) + " продолжим?";
    return new Response(JSON.stringify({ text: technicalJunk, kind: "route" }), { status: 200, headers: { "content-type": "application/json" } });
  }
  const status = window.__handoffResponseStatus;
  return new Response(JSON.stringify(status === 201
    ? { publicCode: "ORION-RECEIPT", status: "pending", message: "Администратор свяжется с вами." }
    : { error: "Сервис записи временно недоступен." }), { status, headers: { "content-type": "application/json" } });
};
class TestXHR { open() { window.__handoffNetworkRequests += 1; } send() {} }
window.XMLHttpRequest = TestXHR;
class TestAudio {
  constructor(src = "") { this.src = src; this.currentTime = 0; this.volume = 1; this.paused = true; this.listeners = new Map(); }
  addEventListener(name, listener) { this.listeners.set(name, listener); }
  play() {
    this.paused = false;
    window.__playedAudio.push(this.src);
    this.listeners.get("play")?.();
    setTimeout(() => { this.paused = true; this.listeners.get("ended")?.(); }, 0);
    return Promise.resolve();
  }
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
  constructor() { this.listeners = new Map(); this.starts = 0; window.__testRecognition = this; }
  addEventListener(name, listener) { this.listeners.set(name, listener); }
  start() { this.starts += 1; }
  abort() { this.listeners.get("end")?.({}); }
  emit(name, event = {}) { this.listeners.get(name)?.(event); }
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
  getVoices() { return [{ name: "Yuri", lang: "ru-RU", voiceURI: "test-yuri" }, { name: "Milena", lang: "ru-RU", voiceURI: "test-milena" }]; },
  speak(utterance) { window.__spokenTexts.push(utterance.text); window.__spokenVoices.push(utterance.voice?.name || ""); },
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

async function hoverStyle(selector) {
  const box = await evaluate(`(() => {
    const rect = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
  await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x: box.x, y: box.y });
  await new Promise((resolve) => setTimeout(resolve, 180));
  return evaluate(`(() => {
    const style = getComputedStyle(document.querySelector(${JSON.stringify(selector)}));
    return { background: style.backgroundColor, color: style.color, transform: style.transform };
  })()`);
}

try {
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (await evaluate("Boolean(document.querySelector('[data-psy-widget]'))")) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  await evaluate("document.querySelector('.psy-widget-trigger').click()");
  const initial = await evaluate(`(() => {
    const root = document.querySelector('[data-psy-widget]');
    const launcher = root.querySelector('.psy-widget-trigger');
    const voiceButtons = [...root.querySelectorAll('[data-voice-preview]')];
    const stop = root.querySelector('[data-voice-stop]');
    return {
      marker: root.dataset.assistantHost,
      launcherText: launcher?.textContent.replace(/\\s+/g, ''),
      launcherLabel: launcher?.getAttribute('aria-label'),
      launcherCount: root.querySelectorAll('.psy-widget-trigger').length,
      launcherInsideActions: Boolean(root.querySelector('.psy-widget-actions .psy-widget-trigger, .psy-widget-handoff-area .psy-widget-trigger')),
      launcherTextVisible: getComputedStyle(launcher.querySelector('span:last-child')).display !== 'none',
      launcherWidth: launcher.getBoundingClientRect().width,
      launcherHeight: launcher.getBoundingClientRect().height,
      voiceLabels: voiceButtons.map((button) => button.textContent.trim()),
      stopText: stop?.textContent.trim(),
      stopVisible: Boolean(stop && stop.getBoundingClientRect().width && stop.getBoundingClientRect().height),
      text: root.textContent,
      labels: [...root.querySelectorAll('.psy-widget-handoff label')].map((label) => label.firstChild.textContent.trim()).filter(Boolean),
      timeOptions: [...root.querySelectorAll('[name="requestedTime"] option')].length,
    };
  })()`);
  assert.equal(initial.marker, "live");
  assert.equal(initial.launcherText, "✦Вампомочь?");
  assert.equal(initial.launcherLabel, "Вам помочь?");
  assert.equal(initial.launcherCount, 1);
  assert.equal(initial.launcherInsideActions, false);
  assert.equal(initial.launcherTextVisible, true);
  assert.ok(initial.launcherWidth >= 44 && initial.launcherWidth <= 160);
  assert.ok(initial.launcherHeight >= 44);
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

  const fullScreenHover = await hoverStyle(".psy-widget-fullscreen");
  const closeHover = await hoverStyle(".psy-widget-close");
  for (const [name, style] of [["разворот", fullScreenHover], ["закрытие", closeHover]]) {
    assert.match(style.background, /^rgb\(31, [01], 166\)$/, `кнопка «${name}» должна менять фон при наведении`);
    assert.match(style.color, /^rgb\(255, 25[45], 255\)$/, `кнопка «${name}» должна менять цвет знака при наведении`);
    assert.notEqual(style.transform, "none", `кнопка «${name}» должна визуально реагировать на наведение`);
  }

  const stopResult = await evaluate(`(async () => {
    const root = document.querySelector('[data-psy-widget]');
    const mic = root.querySelector('.psy-widget-mic');
    const before = mic.getBoundingClientRect();
    root.querySelector('[data-voice-stop]').click();
    const after = mic.getBoundingClientRect();
    return { audioStops: window.__audioStops, speechStops: window.__speechStops, sameGeometry: before.width === after.width && before.height === after.height && before.x === after.x };
  })()`);
  assert.ok(stopResult.audioStops >= 1);
  assert.equal(stopResult.speechStops, 0, "Системный TTS нельзя даже запускать или останавливать");
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
    for (let attempt = 0; attempt < 40 && !window.__playedAudio.length; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 25));
    const played = window.__playedAudio.at(-1) || '';
    window.__handoffNetworkRequests = [];
    return { played, systemSpeechCount: window.__spokenTexts.length };
  })()`);
  assert.match(spokenAnswer.played, /\/psy-admin\/audio\/voice-a\/generic-general\.wav\?v=orion-voice-a-20260909-01$/);
  assert.equal(spokenAnswer.systemSpeechCount, 0, "Milena, Google и любой другой SpeechSynthesis не должны использоваться");

  const eventContinuity = await evaluate(`(async () => {
    const root = document.querySelector('[data-psy-widget]');
    const input = root.querySelector('#psy-widget-question');
    const submit = async (question) => {
      const before = root.querySelectorAll('.psy-widget-message.assistant').length;
      input.value = question;
      input.form.requestSubmit();
      for (let attempt = 0; attempt < 40 && root.querySelectorAll('.psy-widget-message.assistant').length === before; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      return [...root.querySelectorAll('.psy-widget-message.assistant')].at(-1);
    };
    const eventAnswer = await submit('Какое ближайшее мероприятие?');
    const links = [...eventAnswer.querySelectorAll('.psy-widget-links > a')];
    const sourceBox = links[0].getBoundingClientRect();
    const actionBox = links[1].getBoundingClientRect();
    const followUpBox = eventAnswer.querySelector('[data-supportive-followup]').getBoundingClientRect();
    const formatAnswer = await submit('формат');
    return {
      eventText: eventAnswer.textContent,
      formatText: formatAnswer.textContent,
      sourceActionGap: actionBox.top - sourceBox.bottom,
      actionFollowUpGap: followUpBox.top - actionBox.bottom,
    };
  })()`);
  assert.match(eventContinuity.eventText, /Что показать дальше: программу, расписание или помочь записаться\?/);
  assert.ok(eventContinuity.sourceActionGap >= 12, `Ссылка и кнопка слиплись: ${eventContinuity.sourceActionGap}px`);
  assert.ok(eventContinuity.actionFollowUpGap >= 14, `Кнопка и вопрос слиплись: ${eventContinuity.actionFollowUpGap}px`);
  assert.match(eventContinuity.formatText, /«Теория и практика работы с измененными и экстремальными состояниями сознания» проходит онлайн\./);
  assert.doesNotMatch(eventContinuity.formatText, /формат зависит|если вы назовете программу/i);
  if (process.env.PSY_WIDGET_EVENT_DESKTOP_SCREENSHOT) {
    const shot = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    await writeFile(process.env.PSY_WIDGET_EVENT_DESKTOP_SCREENSHOT, Buffer.from(shot.data, "base64"));
  }
  if (process.env.PSY_WIDGET_EVENT_MOBILE_SCREENSHOT) {
    await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await new Promise((resolve) => setTimeout(resolve, 100));
    const shot = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    await writeFile(process.env.PSY_WIDGET_EVENT_MOBILE_SCREENSHOT, Buffer.from(shot.data, "base64"));
    await cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const secondTapVoiceInput = await evaluate(`(async () => {
    const root = document.querySelector('[data-psy-widget]');
    const mic = root.querySelector('.psy-widget-mic');
    const userCountBefore = root.querySelectorAll('.psy-widget-message.user').length;
    const speechResult = (text) => {
      const result = [{ transcript: text }];
      result.isFinal = true;
      return { resultIndex: 0, results: [result] };
    };
    mic.click();
    window.__testRecognition.emit('result', speechResult('Какие ближайшие'));
    window.__testRecognition.emit('end');
    await new Promise((resolve) => setTimeout(resolve, 160));
    window.__testRecognition.emit('result', speechResult('мероприятия'));
    const beforeSecondTap = root.querySelectorAll('.psy-widget-message.user').length;
    mic.click();
    for (let attempt = 0; attempt < 40 && root.querySelectorAll('.psy-widget-message.user').length === beforeSecondTap; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    const users = [...root.querySelectorAll('.psy-widget-message.user')];
    return {
      noEarlySubmit: beforeSecondTap === userCountBefore,
      submittedCount: users.length - userCountBefore,
      submittedText: users.at(-1)?.textContent || '',
      recognitionStarts: window.__testRecognition.starts,
    };
  })()`);
  assert.equal(secondTapVoiceInput.noEarlySubmit, true, "Пауза распознавания не должна отправлять вопрос");
  assert.equal(secondTapVoiceInput.submittedCount, 1, "Второе нажатие должно отправить вопрос ровно один раз");
  assert.equal(secondTapVoiceInput.submittedText, "Какие ближайшие мероприятия");
  assert.ok(secondTapVoiceInput.recognitionStarts >= 2, "Распознавание должно продолжаться после внутренней паузы браузера");

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

  const stickyControls = await evaluate(`(() => {
    const panel = document.querySelector('.psy-widget-panel');
    const messages = document.querySelector('.psy-widget-messages');
    const stop = document.querySelector('[data-voice-stop]');
    for (let index = 0; index < 12; index += 1) {
      const message = document.createElement('p');
      message.className = 'psy-widget-message assistant';
      message.textContent = 'Проверочная длинная строка ответа ' + index;
      messages.append(message);
    }
    const visible = () => {
      const panelBox = panel.getBoundingClientRect();
      const headBox = document.querySelector('.psy-widget-head').getBoundingClientRect();
      const formBox = document.querySelector('.psy-widget-form').getBoundingClientRect();
      const stopBox = stop.getBoundingClientRect();
      return {
        head: headBox.top >= panelBox.top - 1 && headBox.bottom <= panelBox.bottom + 1,
        form: formBox.top >= panelBox.top - 1 && formBox.bottom <= panelBox.bottom + 1,
        stop: stopBox.top >= panelBox.top - 1 && stopBox.bottom <= panelBox.bottom + 1,
      };
    };
    panel.scrollTop = 0;
    const atTop = visible();
    panel.scrollTop = panel.scrollHeight;
    const atBottom = visible();
    return { atTop, atBottom, overflow: panel.scrollHeight - panel.clientHeight };
  })()`);
  assert.ok(stickyControls.overflow > 100, "тестовая панель должна действительно прокручиваться");
  for (const [position, state] of [["сверху", stickyControls.atTop], ["снизу", stickyControls.atBottom]]) {
    assert.equal(state.head, true, `шапка должна быть целиком видна при прокрутке ${position}`);
    assert.equal(state.form, true, `поле, микрофон и кнопка должны быть целиком видны при прокрутке ${position}`);
    assert.equal(state.stop, true, `стоп должен оставаться видимым при прокрутке ${position}`);
  }

  if (process.env.PSY_WIDGET_SCREENSHOT) {
    const shot = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    await writeFile(process.env.PSY_WIDGET_SCREENSHOT, Buffer.from(shot.data, "base64"));
  }

  await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  const mobile = await evaluate(`(() => {
    const root = document.querySelector('[data-psy-widget]');
    const panel = root.querySelector('.psy-widget-panel');
    const stop = root.querySelector('[data-voice-stop]').getBoundingClientRect();
    const mic = root.querySelector('.psy-widget-mic').getBoundingClientRect();
    const launcher = root.querySelector('.psy-widget-trigger');
    const visible = () => {
      const panelBox = panel.getBoundingClientRect();
      const head = root.querySelector('.psy-widget-head').getBoundingClientRect();
      const form = root.querySelector('.psy-widget-form').getBoundingClientRect();
      return {
        head: head.top >= panelBox.top - 1 && head.bottom <= panelBox.bottom + 1,
        form: form.top >= panelBox.top - 1 && form.bottom <= panelBox.bottom + 1,
      };
    };
    panel.scrollTop = 0;
    const atTop = visible();
    panel.scrollTop = panel.scrollHeight;
    const atBottom = visible();
    return {
      overflow: document.documentElement.scrollWidth - innerWidth,
      stopWidth: stop.width,
      stopHeight: stop.height,
      micWidth: mic.width,
      micHeight: mic.height,
      launcherWidth: launcher.getBoundingClientRect().width,
      launcherHeight: launcher.getBoundingClientRect().height,
      launcherTextVisible: getComputedStyle(launcher.querySelector('span:last-child')).display !== 'none',
      atTop,
      atBottom,
    };
  })()`);
  assert.ok(mobile.overflow <= 1);
  assert.ok(mobile.stopWidth >= 44 && mobile.stopHeight >= 44);
  assert.ok(mobile.micWidth >= 44 && mobile.micHeight >= 44);
  assert.ok(mobile.launcherWidth >= 44 && mobile.launcherWidth <= 160);
  assert.ok(mobile.launcherHeight >= 44);
  assert.equal(mobile.launcherTextVisible, true);
  assert.deepEqual(mobile.atTop, { head: true, form: true });
  assert.deepEqual(mobile.atBottom, { head: true, form: true });
  console.log("psy-admin assistant host contract: passed desktop and 390px mobile");
} finally {
  socket.close();
  chrome.kill("SIGTERM");
  server.close();
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
}
