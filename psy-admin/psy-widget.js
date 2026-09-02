import { createWidgetState, reduceWidgetState, routeWidgetQuestion, widgetPresentation } from "./widget-contract.js";

const mount = document.createElement("div");
mount.innerHTML = `
  <section class="psy-widget" data-psy-widget data-open="false" aria-label="Помощник сайта">
    <button class="psy-widget-trigger" type="button" aria-label="Спросить помощника" aria-controls="psy-widget-panel" aria-expanded="false"><span aria-hidden="true">✦</span><span>Спросить помощника</span></button>
    <aside class="psy-widget-panel" id="psy-widget-panel" aria-label="AI-администратор" hidden>
      <header class="psy-widget-head"><div><b>AI-администратор</b><span>Только открытая информация центра</span></div><button class="psy-widget-close" type="button" aria-label="Закрыть помощника">×</button></header>
      <p class="psy-widget-boundary">Помощник не хранит переписку, не заменяет психолога, врача или экстренную службу.</p>
      <div class="psy-widget-messages" aria-live="polite"></div>
      <div class="psy-widget-suggestions" aria-label="Примеры вопросов"><button type="button" data-question="Какие ближайшие мероприятия?">Расписание</button><button type="button" data-question="Сколько стоит психологический клуб?">Психологический клуб</button><button type="button" data-question="У меня кризис, что делать?">Нужна срочная помощь</button></div>
      <form class="psy-widget-form"><label class="sr-only" for="psy-widget-question">Вопрос помощнику</label><input id="psy-widget-question" maxlength="500" autocomplete="off" placeholder="Например: где посмотреть расписание?" required><button class="psy-widget-mic" type="button" aria-label="Задать вопрос голосом" aria-pressed="false">🎙</button><button type="submit">Спросить</button></form>
      <p class="psy-widget-voice-status" aria-live="polite"></p>
    </aside>
  </section>`;
document.body.append(mount);

const root = mount.querySelector("[data-psy-widget]");
const trigger = root.querySelector(".psy-widget-trigger");
const panel = root.querySelector(".psy-widget-panel");
const closeButton = root.querySelector(".psy-widget-close");
const messages = root.querySelector(".psy-widget-messages");
const questionForm = root.querySelector(".psy-widget-form");
const questionInput = root.querySelector("#psy-widget-question");
const mic = root.querySelector(".psy-widget-mic");
const voiceStatus = root.querySelector(".psy-widget-voice-status");
// На широком экране это часть демонстрации, а не скрытая функция: панель
// видна сразу. На телефоне оставляем компактную кнопку, чтобы не перекрывать
// первый экран сайта.
let state = window.innerWidth > 620
  ? { open: true, panelVisible: true, returnFocusToTrigger: false }
  : createWidgetState();
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const voiceCapabilities = { recognitionAvailable: Boolean(Recognition), speechAvailable: "speechSynthesis" in window && "SpeechSynthesisUtterance" in window };

function appendMessage(role, answer) {
  const article = document.createElement("article");
  article.className = `psy-widget-message ${role} ${answer.kind || ""}`;
  if (answer.title) { const title = document.createElement("b"); title.textContent = answer.title; article.append(title); }
  const paragraph = document.createElement("p");
  paragraph.textContent = answer.text;
  article.append(paragraph);
  if (answer.sources?.length || answer.action) {
    const links = document.createElement("div"); links.className = "psy-widget-links";
    for (const source of answer.sources || []) {
      const link = document.createElement("a"); link.href = source.url; link.target = "_blank"; link.rel = "noopener noreferrer"; link.textContent = `${source.label} →`; links.append(link);
    }
    if (answer.action) {
      const action = document.createElement("a"); action.className = "psy-widget-action"; action.href = answer.action.url; action.target = "_blank"; action.rel = "noopener noreferrer"; action.textContent = answer.action.label; links.append(action);
    }
    article.append(links);
  }
  messages.append(article);
  article.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function render() {
  const presentation = widgetPresentation(window.innerWidth, voiceCapabilities);
  root.dataset.open = String(state.open); root.dataset.mode = presentation.mode;
  root.style.setProperty("--psy-widget-touch-target", `${presentation.minTouchTarget}px`);
  panel.hidden = !state.panelVisible; trigger.setAttribute("aria-expanded", String(state.open));
  if (state.open) questionInput.focus();
  if (state.returnFocusToTrigger) trigger.focus();
}

function transition(action) { state = reduceWidgetState(state, action); render(); }
function setVoiceStatus(message) { voiceStatus.textContent = message; }
function speak(text) {
  if (!voiceCapabilities.speechAvailable) return;
  window.speechSynthesis.cancel(); const utterance = new window.SpeechSynthesisUtterance(text); utterance.lang = "ru-RU"; window.speechSynthesis.speak(utterance);
}
function ask(question, askedByVoice = false) {
  const value = question.trim(); if (!value) return;
  appendMessage("user", { text: value });
  const result = routeWidgetQuestion(value); appendMessage("assistant", result);
  if (widgetPresentation(window.innerWidth, voiceCapabilities, askedByVoice).voice.shouldSpeakReply) speak(result.text);
  questionInput.value = ""; questionInput.focus();
}

trigger.addEventListener("click", () => transition("trigger"));
closeButton.addEventListener("click", () => transition("close"));
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && state.open) transition("escape"); });
window.addEventListener("resize", render);
questionForm.addEventListener("submit", (event) => { event.preventDefault(); ask(questionInput.value, false); });
root.querySelectorAll("[data-question]").forEach((button) => button.addEventListener("click", () => ask(button.dataset.question)));

if (!voiceCapabilities.recognitionAvailable) {
  mic.addEventListener("click", () => setVoiceStatus(widgetPresentation(window.innerWidth, voiceCapabilities).voice.fallbackMessage));
} else {
  const recognition = new Recognition(); recognition.lang = "ru-RU"; recognition.interimResults = false; let listening = false;
  const stopListening = () => { listening = false; mic.setAttribute("aria-pressed", "false"); };
  recognition.addEventListener("result", (event) => { const heard = event.results[0][0].transcript.trim(); if (heard) { setVoiceStatus(voiceCapabilities.speechAvailable ? "" : "Голосовой ответ недоступен в этом браузере. Ответ останется текстовым."); ask(heard, true); } });
  recognition.addEventListener("error", (event) => { stopListening(); setVoiceStatus(event.error === "not-allowed" ? "Доступ к микрофону не разрешён. Напишите вопрос текстом." : "Не удалось распознать голос. Напишите вопрос текстом."); });
  recognition.addEventListener("end", stopListening);
  mic.addEventListener("click", () => { if (listening) { recognition.stop(); stopListening(); return; } if (voiceCapabilities.speechAvailable) window.speechSynthesis.cancel(); setVoiceStatus("Слушаю…"); listening = true; mic.setAttribute("aria-pressed", "true"); recognition.start(); });
}

appendMessage("assistant", { text: "Здравствуйте. Помогу найти расписание, консультации, программы или ответ о психологическом клубе." });
render();
