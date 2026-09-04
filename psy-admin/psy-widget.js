import { createWidgetState, preparedQuestionCases, reduceWidgetState, routeWidgetQuestion, widgetPresentation } from "./widget-contract.js?v=psy-widget-20260904-17";

const stylesheet = document.createElement("link");
stylesheet.rel = "stylesheet";
stylesheet.href = new URL("./widget.css?v=psy-widget-20260904-17", import.meta.url).href;
document.head.append(stylesheet);

const mount = document.createElement("div");
mount.innerHTML = `
  <section class="psy-widget" data-psy-widget data-open="false" aria-label="Помощник сайта">
    <button class="psy-widget-trigger" type="button" aria-label="Спросить помощника" aria-controls="psy-widget-panel" aria-expanded="false">
      <span aria-hidden="true">✦</span><span>Спросить помощника</span>
    </button>
    <aside class="psy-widget-panel" id="psy-widget-panel" aria-label="AI-администратор" hidden>
      <header class="psy-widget-head">
        <div><b>Голосовой AI-администратор</b><span>Можно спросить голосом. Выберите естественный голос: A, Б, В или Г.</span></div>
        <div class="psy-widget-head-actions">
          <button class="psy-widget-fullscreen" type="button" aria-label="Развернуть чат на весь экран">↗</button>
          <button class="psy-widget-close" type="button" aria-label="Закрыть помощника">×</button>
        </div>
      </header>
      <div class="psy-widget-voice-preview" aria-label="Предварительные варианты голоса">
        <span>Голос:</span>
        <button type="button" data-voice-preview="/psy-admin/audio/voices/psyadmin-A.wav" data-voice-volume="0.55" data-voice-eq-gain="-5">A</button>
        <button type="button" data-voice-preview="/psy-admin/audio/voices/psyadmin-B.wav" data-voice-volume="0.72">Б</button>
        <button type="button" data-voice-preview="/psy-admin/audio/voices/psyadmin-C.wav" data-voice-volume="0.72">В</button>
        <button type="button" data-voice-preview="/psy-admin/audio/voices/psyadmin-D.ogg" data-voice-volume="0.72">Г</button>
        <button class="psy-widget-voice-preview-stop" type="button" data-voice-stop aria-label="Остановить пример голоса" title="Остановить голос: пробел">■ Стоп</button>
      </div>
      <div class="psy-widget-evaluation">
        <label for="psy-widget-evaluation-select">60 проверочных вопросов</label>
        <select class="psy-widget-evaluation-select" id="psy-widget-evaluation-select" aria-describedby="psy-widget-evaluation-status">
          <option value="">Выбери вопрос для проверки</option>
        </select>
        <p class="psy-widget-evaluation-status" id="psy-widget-evaluation-status" aria-live="polite"></p>
      </div>
      <div class="psy-widget-messages" aria-live="polite"></div>
      <section class="psy-widget-booking-area" aria-label="Запись в центр Орион-С">
        <p><b>Запись в центр «Орион‑С»</b><span>Заявка уйдёт администратору на подтверждение.</span></p>
        <div class="psy-widget-actions">
          <a class="psy-widget-booking" href="/psy-admin/booking/?kind=specialist">Записаться к специалисту</a>
          <a class="psy-widget-booking psy-widget-booking-secondary" href="/psy-admin/booking/?kind=seminar">Записаться на семинар</a>
          <a class="psy-widget-booking psy-widget-booking-secondary" href="/psy-admin/booking/?kind=rental">Оставить заявку на аренду</a>
          <a class="psy-widget-payment" href="https://orion-center.ru/payment" target="_blank" rel="noopener noreferrer">
            <span>Оплатить ↗</span>
            <small>Официальный сайт</small>
          </a>
        </div>
      </section>
      <form class="psy-widget-form">
        <label class="sr-only" for="psy-widget-question">Вопрос помощнику</label>
        <input id="psy-widget-question" maxlength="500" autocomplete="off" placeholder="Например: где посмотреть расписание?" required>
        <button class="psy-widget-mic" type="button" aria-label="Задать вопрос голосом" aria-pressed="false">🎙</button>
        <button type="submit">Спросить</button>
      </form>
      <p class="psy-widget-voice-status" aria-live="polite"></p>
    </aside>
  </section>`;
document.body.append(mount);

// В снимке намеренно нет стороннего JavaScript Tilda. Возвращаем только
// безопасную механику мобильного меню, чтобы копия оставалась проходимой.
document.querySelectorAll(".t-menuburger").forEach((button) => {
  const record = button.closest(".t-rec");
  const menu = record?.querySelector("[data-menu='yes']");
  if (!menu) return;
  button.addEventListener("click", () => {
    const open = menu.classList.toggle("tmenu-mobile__menucontent_hidden");
    // toggle() выше возвращает наличие hidden-класса, поэтому раскрытие — !open.
    button.classList.toggle("t-menuburger-opened", !open);
    button.setAttribute("aria-expanded", String(!open));
  });
});

const root = mount.querySelector("[data-psy-widget]");
const trigger = root.querySelector(".psy-widget-trigger");
const panel = root.querySelector(".psy-widget-panel");
const closeButton = root.querySelector(".psy-widget-close");
const fullScreenButton = root.querySelector(".psy-widget-fullscreen");
const messages = root.querySelector(".psy-widget-messages");
const questionForm = root.querySelector(".psy-widget-form");
const questionInput = root.querySelector("#psy-widget-question");
const mic = root.querySelector(".psy-widget-mic");
const previewStopButton = root.querySelector("[data-voice-stop]");
const voiceStatus = root.querySelector(".psy-widget-voice-status");
const evaluationSelect = root.querySelector(".psy-widget-evaluation-select");
const evaluationStatus = root.querySelector(".psy-widget-evaluation-status");
let previewAudio = null;
let previewAudioContext = null;
let recognition = null;
let listening = false;
let finalizedTranscript = "";
let interimTranscript = "";
let silenceTimer = null;
let recognitionRestartTimer = null;
const VOICE_QUIET_GAP_MS = 1400;
// Помощник не закрывает человеку страницу сам: на любой ширине он появляется
// только после явного нажатия на плавающую кнопку. На панели остаётся крестик.
let state = createWidgetState();
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const voiceCapabilities = {
  recognitionAvailable: Boolean(Recognition),
  speechAvailable: false,
};

function appendMessage(role, answer) {
  const article = document.createElement("article");
  article.className = `psy-widget-message ${role} ${answer.kind || ""}`;
  if (answer.title) {
    const title = document.createElement("b");
    title.textContent = answer.title;
    article.append(title);
  }
  const paragraph = document.createElement("p");
  paragraph.textContent = answer.text;
  article.append(paragraph);
  if (answer.sources?.length || answer.action) {
    const links = document.createElement("div");
    links.className = "psy-widget-links";
    for (const source of answer.sources || []) {
      const link = document.createElement("a");
      link.href = source.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = `${source.label} →`;
      links.append(link);
    }
    if (answer.action) {
      const action = document.createElement("a");
      action.className = "psy-widget-action";
      action.href = answer.action.url;
      action.target = "_blank";
      action.rel = "noopener noreferrer";
      action.textContent = answer.action.label;
      links.append(action);
    }
    article.append(links);
  }
  messages.append(article);
  article.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function render() {
  const presentation = widgetPresentation(window.innerWidth, voiceCapabilities);
  root.dataset.open = String(state.open);
  root.dataset.mode = presentation.mode;
  root.dataset.fullscreen = String(state.fullScreen);
  root.style.setProperty("--psy-widget-touch-target", `${presentation.minTouchTarget}px`);
  panel.hidden = !state.panelVisible;
  trigger.setAttribute("aria-expanded", String(state.open));
  fullScreenButton.setAttribute("aria-label", state.fullScreen ? "Вернуть обычный размер" : "Развернуть чат на весь экран");
  fullScreenButton.setAttribute("aria-pressed", String(state.fullScreen));
  if (state.open && document.activeElement === trigger) questionInput.focus({ preventScroll: true });
  if (state.returnFocusToTrigger) trigger.focus();
}

function transition(action) {
  state = reduceWidgetState(state, action);
  render();
}

function setVoiceStatus(message) {
  voiceStatus.textContent = message;
}

function clearSilenceTimer() {
  if (silenceTimer) window.clearTimeout(silenceTimer);
  silenceTimer = null;
}

function clearRecognitionRestartTimer() {
  if (recognitionRestartTimer) window.clearTimeout(recognitionRestartTimer);
  recognitionRestartTimer = null;
}

function setListeningState(active) {
  listening = active;
  root.dataset.listening = String(active);
  renderVoiceControl();
}

function renderVoiceControl() {
  const playing = voiceIsPlaying();
  mic.dataset.mode = playing ? "mute" : "mic";
  mic.textContent = playing ? "🔇" : "🎙";
  mic.setAttribute("aria-pressed", String(!playing && listening));
  mic.setAttribute("aria-label", playing
    ? "Выключить звук"
    : (listening ? "Слушаю. Нажмите ещё раз, чтобы остановить запись." : "Задать вопрос голосом"));
  mic.title = playing ? "Выключить звук" : "Задать вопрос голосом";
}

function setVoicePlaying(active) {
  root.dataset.voicePlaying = String(active);
  renderVoiceControl();
}

function stopListening() {
  clearSilenceTimer();
  clearRecognitionRestartTimer();
  finalizedTranscript = "";
  interimTranscript = "";
  setListeningState(false);
  if (recognition) {
    try {
      recognition.abort();
    } catch {
      // Браузер уже мог завершить распознавание сам.
    }
  }
}

function stopVoice({ announce = true } = {}) {
  stopListening();
  if (previewAudio) {
    previewAudio.pause();
    previewAudio.currentTime = 0;
    previewAudio = null;
  }
  if (previewAudioContext) {
    void previewAudioContext.close();
    previewAudioContext = null;
  }
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  setVoicePlaying(false);
  if (announce) setVoiceStatus("Голос остановлен.");
}

function voiceIsPlaying() {
  return root.dataset.voicePlaying === "true" || Boolean(window.speechSynthesis?.speaking);
}

function voiceIsActive() {
  return listening || voiceIsPlaying();
}

function softenPreviewTone(button) {
  const gain = Number(button.dataset.voiceEqGain || 0);
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!previewAudio || !gain || !AudioContext) return;
  try {
    previewAudioContext = new AudioContext();
    const source = previewAudioContext.createMediaElementSource(previewAudio);
    const filter = previewAudioContext.createBiquadFilter();
    filter.type = "peaking";
    filter.frequency.value = 520;
    filter.Q.value = 0.75;
    filter.gain.value = gain;
    source.connect(filter).connect(previewAudioContext.destination);
    if (previewAudioContext.state === "suspended") void previewAudioContext.resume();
  } catch {
    // Браузер всё равно проиграет пример без эквалайзера.
    previewAudioContext = null;
  }
}

async function ask(question, askedByVoice = false) {
  const value = question.trim();
  if (!value) return;
  appendMessage("user", { text: value });
  const result = routeWidgetQuestion(value);
  appendMessage("assistant", result);
  if (askedByVoice) setVoiceStatus(widgetPresentation(window.innerWidth, voiceCapabilities, true).voice.fallbackMessage);
  questionInput.value = "";
  questionInput.focus({ preventScroll: true });
}

function renderPreparedQuestions() {
  const groups = new Map();
  for (const item of preparedQuestionCases()) {
    if (!groups.has(item.category)) groups.set(item.category, []);
    groups.get(item.category).push(item);
  }
  for (const [category, items] of groups) {
    const group = document.createElement("optgroup");
    group.label = `${category} · ${items.length}`;
    for (const item of items) {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = item.question;
      option.dataset.question = item.question;
      option.dataset.expected = item.expected;
      group.append(option);
    }
    evaluationSelect.append(group);
  }
}

trigger.addEventListener("click", () => transition("trigger"));
closeButton.addEventListener("click", () => transition("close"));
fullScreenButton.addEventListener("click", () => transition("fullscreen"));
document.addEventListener("keydown", (event) => {
  if (event.code === "Space" && voiceIsActive()) {
    event.preventDefault();
    stopVoice();
    return;
  }
  if (event.key === "Escape" && state.open) transition("escape");
});
window.addEventListener("resize", render);
questionForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void ask(questionInput.value, false);
});
root.querySelectorAll("[data-question]").forEach((button) => button.addEventListener("click", () => void ask(button.dataset.question)));
root.querySelectorAll("[data-voice-preview]").forEach((button) => button.addEventListener("click", () => {
  stopVoice({ announce: false });
  previewAudio = new Audio(button.dataset.voicePreview);
  previewAudio.volume = Number(button.dataset.voiceVolume || 1);
  softenPreviewTone(button);
  previewAudio.addEventListener("ended", () => {
    setVoicePlaying(false);
  }, { once: true });
  setVoicePlaying(true);
  previewAudio.play().then(() => setVoiceStatus(`Включён голос ${button.textContent}. Стоп — кнопкой или пробелом.`)).catch(() => {
    setVoicePlaying(false);
    setVoiceStatus("Не удалось включить пример голоса. Проверьте звук в браузере.");
  });
}));
previewStopButton.addEventListener("click", () => stopVoice());
evaluationSelect.addEventListener("change", () => {
  const option = evaluationSelect.selectedOptions[0];
  if (!option?.dataset.question) {
    evaluationStatus.textContent = "";
    return;
  }
  evaluationStatus.textContent = `Ожидается: ${option.dataset.expected}.`;
  void ask(option.dataset.question);
});
if (!voiceCapabilities.recognitionAvailable) {
  mic.addEventListener("click", () => {
    if (voiceIsPlaying()) {
      stopVoice();
      return;
    }
    setVoiceStatus(widgetPresentation(window.innerWidth, voiceCapabilities).voice.fallbackMessage);
  });
} else {
  recognition = new Recognition();
  recognition.lang = "ru-RU";
  recognition.continuous = true;
  recognition.interimResults = true;

  const fullTranscript = () => `${finalizedTranscript} ${interimTranscript}`.replace(/\s+/g, " ").trim();
  const submitAfterPause = () => {
    clearSilenceTimer();
    const question = fullTranscript();
    if (!question) return;
    silenceTimer = window.setTimeout(() => {
      const completedQuestion = fullTranscript();
      stopListening();
      if (completedQuestion) void ask(completedQuestion, true);
    }, VOICE_QUIET_GAP_MS);
  };

  const restartRecognition = () => {
    if (!listening || !recognition) return;
    try {
      recognition.start();
    } catch (error) {
      if (error?.name !== "InvalidStateError") {
        stopListening();
        setVoiceStatus("Не удалось продолжить запись. Попробуйте ещё раз или напишите вопрос текстом.");
      }
    }
  };

  recognition.addEventListener("result", (event) => {
    if (!listening) return;
    interimTranscript = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      const fragment = result[0]?.transcript?.trim();
      if (!fragment) continue;
      if (result.isFinal) finalizedTranscript += `${fragment} `;
      else interimTranscript += `${fragment} `;
    }
    if (!fullTranscript()) return;
    setVoiceStatus("Слушаю… Можете делать паузы: отправлю вопрос, когда вы закончите фразу.");
    submitAfterPause();
  });
  recognition.addEventListener("error", (event) => {
    const wasListening = listening;
    stopListening();
    if (!wasListening || event.error === "aborted") return;
    setVoiceStatus(event.error === "not-allowed"
      ? "Доступ к микрофону не разрешён. Напишите вопрос текстом."
      : "Не удалось распознать голос. Напишите вопрос текстом.");
  });
  recognition.addEventListener("end", () => {
    if (!listening) return;
    // Web Speech иногда сам закрывает короткую паузу. Сохраняем индикатор и
    // поднимаем следующий отрезок, пока пользователь не завершил мысль.
    clearRecognitionRestartTimer();
    recognitionRestartTimer = window.setTimeout(restartRecognition, 120);
  });
  mic.addEventListener("click", () => {
    if (voiceIsPlaying() || listening) {
      stopVoice();
      return;
    }
    stopVoice({ announce: false });
    setListeningState(true);
    setVoiceStatus("Слушаю… Можете говорить спокойно: длинные паузы допустимы.");
    restartRecognition();
  });
}

renderPreparedQuestions();
appendMessage("assistant", { text: "Здравствуйте. Чем помочь?" });
render();
