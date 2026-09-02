import { quickQuestions } from "./content.js";
import { answerQuestion } from "./router.js";

const messages = document.querySelector("#messages");
const form = document.querySelector("#question-form");
const input = document.querySelector("#question");
const quickList = document.querySelector("#quick-list");
const examples = document.querySelector("#examples");

function scrollToAnswer(node) {
  // На мобильных клавиатура закрывается с анимацией и только затем меняется
  // высота видимой области. Две отложенные прокрутки удерживают новый ответ
  // в поле зрения и на iOS, и на Android.
  requestAnimationFrame(() => node.scrollIntoView({ behavior: "smooth", block: "start" }));
  window.setTimeout(() => node.scrollIntoView({ behavior: "smooth", block: "start" }), 360);
}

function addUserMessage(text) {
  const node = document.createElement("p");
  node.className = "message user-message";
  node.textContent = text;
  messages.append(node);
}

function addAnswer(answer) {
  const article = document.createElement("article");
  article.className = `message answer ${answer.kind}`;

  if (answer.title) {
    const title = document.createElement("h2");
    title.textContent = answer.title;
    article.append(title);
  }

  const text = document.createElement("p");
  text.textContent = answer.text;
  article.append(text);

  if (answer.url) {
    const link = document.createElement("a");
    link.className = "answer-link";
    link.href = answer.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", `Полный ответ: ${answer.linkText}`);
    const cue = document.createElement("span");
    cue.textContent = "Полный ответ на сайте центра";
    const destination = document.createElement("strong");
    destination.textContent = `${answer.linkText} →`;
    link.append(cue, destination);
    article.append(link);
  }

  if (answer.action) {
    const action = document.createElement("a");
    action.className = "answer-action";
    action.href = answer.action.url;
    action.target = "_blank";
    action.rel = "noopener noreferrer";
    action.textContent = answer.action.label;
    article.append(action);
  }

  const meta = document.createElement("small");
  meta.textContent = "Ответ составлен по открытым страницам центра. Переписка не сохраняется.";
  article.append(meta);
  messages.append(article);
  return article;
}

function ask(question) {
  const clean = question.trim();
  if (!clean) return;
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  addUserMessage(clean);
  const answerNode = addAnswer(answerQuestion(clean));
  input.value = "";
  scrollToAnswer(answerNode);
}

const questionGroups = new Map();
quickQuestions.forEach(({ category, question }) => {
  if (!questionGroups.has(category)) {
    const group = document.createElement("optgroup");
    group.label = category;
    questionGroups.set(category, group);
    quickList.append(group);
  }
  const option = document.createElement("option");
  option.value = question;
  option.textContent = question;
  questionGroups.get(category).append(option);
});

examples.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-question]");
  if (button) ask(button.dataset.question);
});

quickList.addEventListener("change", () => {
  if (quickList.value) ask(quickList.value);
  quickList.selectedIndex = 0;
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  ask(input.value);
});
