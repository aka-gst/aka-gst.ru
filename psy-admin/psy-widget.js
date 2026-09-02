import { createWidgetState, demoHandoffOutcome, preparedQuestionCases, reduceWidgetState, routeWidgetQuestion, widgetPresentation } from "./widget-contract.js?v=psy-widget-20260902-4";

const stylesheet = document.createElement("link");
stylesheet.rel = "stylesheet";
stylesheet.href = new URL("./widget.css?v=psy-widget-20260902-4", import.meta.url).href;
document.head.append(stylesheet);

const mount = document.createElement("div");
mount.innerHTML = `
  <section class="psy-widget" data-psy-widget data-open="false" aria-label="Помощник сайта">
    <button class="psy-widget-trigger" type="button" aria-label="Спросить помощника" aria-controls="psy-widget-panel" aria-expanded="false">
      <span aria-hidden="true">✦</span><span>Спросить помощника</span>
    </button>
    <aside class="psy-widget-panel" id="psy-widget-panel" aria-label="AI-администратор" hidden>
      <header class="psy-widget-head">
        <div><b>AI-администратор</b><span>Только открытые источники</span></div>
        <div class="psy-widget-head-actions">
          <button class="psy-widget-fullscreen" type="button" aria-label="Развернуть чат на весь экран">↗</button>
          <button class="psy-widget-close" type="button" aria-label="Закрыть помощника">×</button>
        </div>
      </header>
      <p class="psy-widget-boundary">Демо по открытым страницам центра. Не заменяет специалиста или экстренную помощь.</p>
      <div class="psy-widget-evaluation">
        <button class="psy-widget-evaluation-open" type="button" aria-controls="psy-widget-evaluation-panel" aria-expanded="false">Показать 60 проверочных вопросов</button>
        <section class="psy-widget-evaluation-panel" id="psy-widget-evaluation-panel" aria-label="60 проверочных вопросов" hidden>
          <p>Вопросы, по которым проверяли помощника: на каждом видно ожидаемый режим ответа.</p>
          <div class="psy-widget-evaluation-list"></div>
        </section>
      </div>
      <div class="psy-widget-messages" aria-live="polite"></div>
      <div class="psy-widget-suggestions" aria-label="Примеры вопросов">
        <button type="button" data-question="Какие мероприятия ближайшие?">Расписание</button>
        <button type="button" data-question="Хочу консультацию онлайн">Консультация онлайн</button>
      </div>
      <form class="psy-widget-form">
        <label class="sr-only" for="psy-widget-question">Вопрос помощнику</label>
        <input id="psy-widget-question" maxlength="500" autocomplete="off" placeholder="Например: где посмотреть расписание?" required>
        <button class="psy-widget-mic" type="button" aria-label="Задать вопрос голосом" aria-pressed="false">🎙</button>
        <button type="submit">Спросить</button>
      </form>
      <p class="psy-widget-voice-status" aria-live="polite"></p>
      <div class="psy-widget-handoff">
        <button class="psy-widget-handoff-open" type="button">Оставить вопрос администратору</button>
        <form class="psy-widget-handoff-form" hidden>
          <p><b>Демо-передача</b><br>Тема и один способ связи нужны только для демонстрации формы. Ничего не отправляется.</p>
          <label>Тема<select required><option value="">Выберите тему</option><option>Консультация</option><option>Мероприятие</option><option>Аренда</option></select></label>
          <label>Как связаться<input maxlength="120" autocomplete="email" placeholder="Телефон или e-mail" required></label>
          <button type="submit">Проверить передачу</button>
          <p class="psy-widget-handoff-status" aria-live="polite"></p>
        </form>
      </div>
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
const voiceStatus = root.querySelector(".psy-widget-voice-status");
const handoffOpen = root.querySelector(".psy-widget-handoff-open");
const handoffForm = root.querySelector(".psy-widget-handoff-form");
const handoffStatus = root.querySelector(".psy-widget-handoff-status");
const evaluationOpen = root.querySelector(".psy-widget-evaluation-open");
const evaluationPanel = root.querySelector(".psy-widget-evaluation-panel");
const evaluationList = root.querySelector(".psy-widget-evaluation-list");
let state = window.innerWidth > 620
  ? { open: true, panelVisible: true, fullScreen: false, returnFocusToTrigger: false }
  : createWidgetState();
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const voiceCapabilities = {
  recognitionAvailable: Boolean(Recognition),
  speechAvailable: "speechSynthesis" in window && "SpeechSynthesisUtterance" in window,
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

function speak(spokenText) {
  if (!voiceCapabilities.speechAvailable) return;
  window.speechSynthesis.cancel();
  const utterance = new window.SpeechSynthesisUtterance(spokenText);
  utterance.lang = "ru-RU";
  window.speechSynthesis.speak(utterance);
}

async function ask(question, askedByVoice = false) {
  const value = question.trim();
  if (!value) return;
  appendMessage("user", { text: value });
  const result = routeWidgetQuestion(value);
  appendMessage("assistant", result);
  if (widgetPresentation(window.innerWidth, voiceCapabilities, askedByVoice).voice.shouldSpeakReply && result.spokenText) speak(result.spokenText);
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
    const group = document.createElement("section");
    group.className = "psy-widget-evaluation-group";
    const heading = document.createElement("h3");
    heading.textContent = `${category} · ${items.length}`;
    group.append(heading);
    for (const item of items) {
      const row = document.createElement("article");
      row.className = "psy-widget-evaluation-question";
      const question = document.createElement("p");
      question.textContent = item.question;
      const expected = document.createElement("small");
      expected.textContent = `Ожидается: ${item.expected}`;
      const askButton = document.createElement("button");
      askButton.type = "button";
      askButton.dataset.preparedQuestion = item.question;
      askButton.textContent = "Спросить";
      row.append(question, expected, askButton);
      group.append(row);
    }
    evaluationList.append(group);
  }
}

trigger.addEventListener("click", () => transition("trigger"));
closeButton.addEventListener("click", () => transition("close"));
fullScreenButton.addEventListener("click", () => transition("fullscreen"));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.open) transition("escape");
});
window.addEventListener("resize", render);
questionForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void ask(questionInput.value, false);
});
root.querySelectorAll("[data-question]").forEach((button) => button.addEventListener("click", () => void ask(button.dataset.question)));
evaluationOpen.addEventListener("click", () => {
  const willOpen = evaluationPanel.hidden;
  evaluationPanel.hidden = !willOpen;
  evaluationOpen.setAttribute("aria-expanded", String(willOpen));
  evaluationOpen.textContent = willOpen ? "Скрыть 60 проверочных вопросов" : "Показать 60 проверочных вопросов";
});
evaluationList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-prepared-question]");
  if (button) void ask(button.dataset.preparedQuestion);
});
handoffOpen.addEventListener("click", () => {
  handoffOpen.hidden = true;
  handoffForm.hidden = false;
  handoffForm.querySelector("select").focus();
});
handoffForm.addEventListener("submit", (event) => {
  event.preventDefault();
  handoffStatus.textContent = demoHandoffOutcome().message;
  handoffForm.reset();
});

if (!voiceCapabilities.recognitionAvailable) {
  mic.addEventListener("click", () => setVoiceStatus(widgetPresentation(window.innerWidth, voiceCapabilities).voice.fallbackMessage));
} else {
  const recognition = new Recognition();
  recognition.lang = "ru-RU";
  recognition.interimResults = false;
  let listening = false;
  const stopListening = () => {
    listening = false;
    mic.setAttribute("aria-pressed", "false");
  };

  recognition.addEventListener("result", (event) => {
    const heard = event.results[0][0].transcript.trim();
    if (heard) {
      setVoiceStatus(voiceCapabilities.speechAvailable ? "" : "Голосовой ответ недоступен в этом браузере. Ответ останется текстовым.");
      void ask(heard, true);
    }
  });
  recognition.addEventListener("error", (event) => {
    stopListening();
    setVoiceStatus(event.error === "not-allowed"
      ? "Доступ к микрофону не разрешён. Напишите вопрос текстом."
      : "Не удалось распознать голос. Напишите вопрос текстом.");
  });
  recognition.addEventListener("end", stopListening);
  mic.addEventListener("click", () => {
    if (listening) {
      recognition.stop();
      stopListening();
      return;
    }
    if (voiceCapabilities.speechAvailable) window.speechSynthesis.cancel();
    setVoiceStatus("Слушаю…");
    listening = true;
    mic.setAttribute("aria-pressed", "true");
    recognition.start();
  });
}

renderPreparedQuestions();
appendMessage("assistant", { text: "Здравствуйте. Помогу с расписанием, консультациями, программами и психологическим клубом." });
render();
