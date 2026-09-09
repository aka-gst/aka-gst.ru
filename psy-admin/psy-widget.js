import { appendVoiceInputResult, createHandoffPayload, createVoiceInputSession, createWidgetState, finishVoiceInputSession, nextConversationContext, normalizeAssistantResult, preparedQuestionCases, reduceWidgetState, routeWidgetQuestion, shouldKeepVerifiedAnswer, widgetPresentation } from "./widget-contract.js?v=psy-widget-20260909-10";
import { resolveWidgetPublicUrl } from "./router.js?v=psy-widget-20260909-10";
import { resolveVoiceClip } from "./voice-bank.js?v=psy-widget-20260909-10";

const bookingApiUrl = new URL("./booking/api/requests", import.meta.url).href;
const assistantApiUrl = new URL("./booking/api/ask", import.meta.url).href;

const stylesheet = document.createElement("link");
stylesheet.rel = "stylesheet";
stylesheet.href = new URL("./widget.css?v=psy-widget-20260909-10&theme=orion-blue-20260908", import.meta.url).href;
document.head.append(stylesheet);

const mount = document.createElement("div");
mount.innerHTML = `
  <section class="psy-widget" data-psy-widget data-assistant-host="live" data-open="false" aria-label="Помощник сайта">
    <button class="psy-widget-trigger" type="button" aria-label="Вам помочь?" aria-controls="psy-widget-panel" aria-expanded="false">
      <span aria-hidden="true">✦</span><span>Вам помочь?</span>
    </button>
    <aside class="psy-widget-panel" id="psy-widget-panel" aria-label="AI-администратор" hidden>
      <header class="psy-widget-head">
        <div><b>AI-администратор</b><span>Можно спросить голосом или написать. Ответ помощника будет озвучен</span></div>
        <div class="psy-widget-head-actions">
          <button class="psy-widget-voice-preview-stop" type="button" data-voice-stop aria-label="Остановить голос" title="Остановить голос: пробел">Остановить голос</button>
          <button class="psy-widget-fullscreen" type="button" aria-label="Увеличить окно помощника">↗</button>
          <button class="psy-widget-close" type="button" aria-label="Закрыть помощника">×</button>
        </div>
      </header>
      <div class="psy-widget-evaluation">
        <label for="psy-widget-evaluation-select">Частые вопросы</label>
        <select class="psy-widget-evaluation-select" id="psy-widget-evaluation-select">
          <option value="">Выберите вопрос</option>
        </select>
      </div>
      <div class="psy-widget-messages" aria-live="polite"></div>
      <section class="psy-widget-handoff-area" aria-label="Заявка в центр Орион-С">
        <button class="psy-widget-handoff-toggle" type="button" aria-expanded="false" aria-controls="psy-widget-handoff">Оставить заявку</button>
        <form class="psy-widget-handoff" id="psy-widget-handoff" hidden>
          <p><b>Запись, семинары и аренда</b><span>Расписание мероприятий уже опубликовано. Для личных консультаций пока нет общего календаря свободных окон: укажите желаемые дату и время — администратор согласует их со специалистом и свяжется с вами.</span></p>
          <label>Что вас интересует?
            <select name="requestKind" required>
              <option value="specialist">Консультация психолога</option>
              <option value="seminar">Семинар или программа</option>
              <option value="rental">Аренда зала или кабинета</option>
            </select>
          </label>
          <label><span data-handoff-subject-label>К кому или на что хотите записаться?</span>
            <input name="subject" list="psy-widget-specialists" maxlength="160" placeholder="Выберите психолога или попросите администратора подобрать" required>
            <datalist id="psy-widget-specialists">
              <option value="Не знаю — администратор поможет подобрать"></option>
              <option value="Смирнова Юлия Сергеевна"></option>
              <option value="Сербина Людмила Николаевна"></option>
              <option value="Белозеров Евгений Владимирович"></option>
              <option value="Бутусова Елена Сергеевна"></option>
              <option value="Андреева Татьяна Владимировна"></option>
              <option value="Гайнулина Оксана Владимировна"></option>
              <option value="Извекова Ирина Владимировна"></option>
              <option value="Сатикова Светлана Валентиновна"></option>
            </datalist>
          </label>
          <div class="psy-widget-handoff-grid">
          <label>Желаемые дата и время
            <input name="requestedTime" maxlength="120" placeholder="Например: будни после 18:00" required>
          </label>
          <label>Ваше имя
            <input name="clientName" maxlength="80" autocomplete="name" placeholder="Как к вам обращаться" required>
          </label>
          </div>
          <label>Комментарий
            <textarea name="comment" maxlength="500" rows="2" placeholder="Что важно учесть"></textarea>
          </label>
          <label>Телефон или e-mail
            <input name="contact" maxlength="160" autocomplete="email" placeholder="Как с вами связаться" required>
          </label>
          <label class="psy-widget-consent">
            <input name="consent" type="checkbox" value="yes" required>
            <span>Я согласен передать указанный контакт администратору центра только для обработки этой заявки.</span>
          </label>
          <button type="submit">Отправить заявку</button>
          <p class="psy-widget-handoff-status" aria-live="polite"></p>
        </form>
        <a class="psy-widget-payment" href="https://orion-center.ru/payment" target="_blank" rel="noopener noreferrer">
          <span>Перейти к оплате ↗</span>
          <small>После выбора и согласования услуги</small>
        </a>
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
const handoffToggle = root.querySelector(".psy-widget-handoff-toggle");
const handoffForm = root.querySelector(".psy-widget-handoff");
const handoffStatus = root.querySelector(".psy-widget-handoff-status");
const handoffKind = handoffForm.querySelector("[name='requestKind']");
const handoffSubject = handoffForm.querySelector("[name='subject']");
const handoffSubjectLabel = handoffForm.querySelector("[data-handoff-subject-label]");
let recognition = null;
let listening = false;
let voiceInputSession = createVoiceInputSession();
let recognitionRestartTimer = null;
// Помощник не закрывает человеку страницу сам: на любой ширине он появляется
// только после явного нажатия на плавающую кнопку. На панели остаётся крестик.
let state = createWidgetState();
let conversationContext = {};
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const replyAudio = new Audio();
replyAudio.preload = "auto";
const voiceCapabilities = {
  recognitionAvailable: Boolean(Recognition),
  speechAvailable: typeof replyAudio.play === "function",
};
const widgetPublicUrl = (value) => resolveWidgetPublicUrl(value, import.meta.url);

function appendMessage(role, answer) {
  const article = document.createElement("article");
  article.className = `psy-widget-message ${role} ${answer.kind || ""}`;
  if (answer.leadIn) {
    const leadIn = document.createElement("p");
    leadIn.setAttribute("data-supportive-lead-in", "");
    leadIn.textContent = answer.leadIn;
    article.append(leadIn);
  }
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
      link.href = widgetPublicUrl(source.url);
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = `${source.label} →`;
      links.append(link);
    }
    if (answer.action) {
      const action = document.createElement("a");
      action.className = "psy-widget-action";
      action.href = widgetPublicUrl(answer.action.url);
      action.target = "_blank";
      action.rel = "noopener noreferrer";
      action.textContent = answer.action.label;
      links.append(action);
    }
    article.append(links);
  }
  if (answer.followUp) {
    const followUp = document.createElement("p");
    followUp.setAttribute("data-supportive-followup", "");
    const question = document.createElement("strong");
    question.textContent = answer.followUp;
    followUp.append(question);
    article.append(followUp);
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
  fullScreenButton.setAttribute("aria-label", state.fullScreen ? "Вернуть обычный размер" : "Увеличить окно помощника");
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

function stopListening({ resetDraft = true } = {}) {
  clearRecognitionRestartTimer();
  if (resetDraft) voiceInputSession = createVoiceInputSession();
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
  replyAudio.pause();
  replyAudio.currentTime = 0;
  setVoicePlaying(false);
  if (announce) setVoiceStatus("Голос остановлен.");
}

function voiceIsPlaying() {
  return root.dataset.voicePlaying === "true" || !replyAudio.paused;
}

function voiceIsActive() {
  return listening || voiceIsPlaying();
}

async function speakReply(answer, question) {
  const presentation = widgetPresentation(window.innerWidth, voiceCapabilities);
  const clip = resolveVoiceClip({ question, answer });
  if (!presentation.voice.shouldSpeakReply || !clip?.src) return;
  stopVoice({ announce: false });
  replyAudio.src = new URL(clip.src, import.meta.url).href;
  replyAudio.currentTime = 0;
  setVoicePlaying(true);
  setVoiceStatus("Помощник отвечает. Остановить голос можно верхней кнопкой или пробелом.");
  try {
    await replyAudio.play();
  } catch {
    setVoicePlaying(false);
    setVoiceStatus("Ответ показан текстом. Нажмите микрофон или задайте следующий вопрос, чтобы продолжить.");
  }
}

replyAudio.addEventListener("ended", () => {
  setVoicePlaying(false);
  setVoiceStatus("");
});
replyAudio.addEventListener("error", () => {
  setVoicePlaying(false);
  setVoiceStatus("Ответ показан текстом: аудиофраза временно недоступна.");
});

async function ask(question, askedByVoice = false) {
  const value = question.trim();
  if (!value) return;
  appendMessage("user", { text: value });
  const fallback = routeWidgetQuestion(value, conversationContext);
  let result = fallback;
  const keepVerifiedAnswer = shouldKeepVerifiedAnswer(fallback);
  try {
    if (keepVerifiedAnswer) throw new Error("use-verified-answer");
    const response = await fetch(assistantApiUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: value }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Помощник временно недоступен.");
    result = normalizeAssistantResult(data, fallback);
  } catch (error) {
    if (error?.message !== "use-verified-answer") {
      setVoiceStatus("Сервер временно недоступен — показан проверенный ответ из резервной базы.");
    }
  }
  conversationContext = nextConversationContext(result);
  appendMessage("assistant", result);
  void speakReply(result, value);
  if (askedByVoice && !voiceCapabilities.speechAvailable) {
    setVoiceStatus(widgetPresentation(window.innerWidth, voiceCapabilities, true).voice.fallbackMessage);
  }
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
previewStopButton.addEventListener("click", () => stopVoice());
evaluationSelect.addEventListener("change", () => {
  const option = evaluationSelect.selectedOptions[0];
  if (!option?.dataset.question) return;
  void ask(option.dataset.question);
});
handoffToggle.addEventListener("click", () => {
  const expanded = handoffToggle.getAttribute("aria-expanded") !== "true";
  handoffToggle.setAttribute("aria-expanded", String(expanded));
  handoffForm.hidden = !expanded;
  handoffToggle.textContent = expanded ? "Скрыть форму" : "Оставить заявку";
  if (expanded) handoffKind.focus({ preventScroll: true });
});
const handoffModes = {
  specialist: {
    label: "К какому психологу хотите записаться?",
    placeholder: "Выберите имя или попросите администратора подобрать",
  },
  seminar: {
    label: "Какой семинар или программа вас интересует?",
    placeholder: "Название или тема мероприятия",
  },
  rental: {
    label: "Какой зал или кабинет вам нужен?",
    placeholder: "Например: кабинет для консультации",
  },
};
function renderHandoffMode() {
  const mode = handoffModes[handoffKind.value] || handoffModes.specialist;
  handoffSubjectLabel.textContent = mode.label;
  handoffSubject.placeholder = mode.placeholder;
}
handoffKind.addEventListener("change", renderHandoffMode);
renderHandoffMode();
handoffForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const fields = new FormData(handoffForm);
  const payload = createHandoffPayload({
    requestKind: String(fields.get("requestKind") || ""),
    subject: String(fields.get("subject") || ""),
    requestedTime: String(fields.get("requestedTime") || ""),
    clientName: String(fields.get("clientName") || ""),
    comment: String(fields.get("comment") || ""),
    contact: String(fields.get("contact") || ""),
    consent: fields.get("consent") === "yes",
  });
  const submitButton = handoffForm.querySelector("button[type='submit']");
  submitButton.disabled = true;
  handoffStatus.dataset.state = "pending";
  handoffStatus.textContent = "Отправляем заявку…";
  try {
    const response = await fetch(bookingApiUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Не удалось отправить заявку.");
    const successText = `Заявка отправлена. Номер: ${result.publicCode}. ${result.message || "Администратор центра проверит возможность записи и свяжется с вами."}`;
    handoffForm.reset();
    renderHandoffMode();
    handoffForm.hidden = true;
    handoffToggle.setAttribute("aria-expanded", "false");
    handoffToggle.textContent = "Оставить заявку";
    appendMessage("assistant", { kind: "success", text: successText });
  } catch (error) {
    handoffStatus.dataset.state = "error";
    handoffStatus.textContent = error?.message || "Сервис записи временно недоступен. Попробуйте ещё раз позже.";
  } finally {
    submitButton.disabled = false;
  }
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
    const finalFragments = [];
    const interimFragments = [];
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      const fragment = result[0]?.transcript?.trim();
      if (!fragment) continue;
      if (result.isFinal) finalFragments.push(fragment);
      else interimFragments.push(fragment);
    }
    voiceInputSession = appendVoiceInputResult(voiceInputSession, {
      finalFragments,
      interimFragment: interimFragments.join(" "),
    });
    if (!voiceInputSession.text) return;
    setVoiceStatus("Слушаю… Нажмите микрофон ещё раз, когда закончите вопрос.");
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
    if (voiceIsPlaying()) {
      stopVoice();
      return;
    }
    if (listening) {
      const finished = finishVoiceInputSession(voiceInputSession);
      voiceInputSession = finished.session;
      stopListening({ resetDraft: false });
      if (finished.question) {
        setVoiceStatus("Вопрос записан. Отправляю помощнику.");
        void ask(finished.question, true);
      } else {
        setVoiceStatus("Запись пуста. Нажмите микрофон и задайте вопрос.");
      }
      return;
    }
    stopVoice({ announce: false });
    voiceInputSession = createVoiceInputSession();
    setListeningState(true);
    setVoiceStatus("Слушаю… Нажмите микрофон ещё раз, когда закончите вопрос.");
    restartRecognition();
  });
}

renderPreparedQuestions();
appendMessage("assistant", { text: "Здравствуйте. Чем помочь?" });
render();
