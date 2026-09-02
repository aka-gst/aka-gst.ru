import assert from "node:assert/strict";
import { answerQuestion } from "./router.js";
import { quickQuestions } from "./content.js";

assert.equal(quickQuestions.length, 60);
const preparedAnswers = quickQuestions.map(({ question }) => answerQuestion(question));
assert.equal(preparedAnswers.filter(({ kind }) => kind === "fallback" || kind === "empty").length, 0);
assert.equal(preparedAnswers.filter(({ url }) => Boolean(url)).length, 59); // Кризисный ответ намеренно без ссылки.
assert.equal(preparedAnswers.filter(({ text }) => text.length < 60).length, 0);
assert.equal(answerQuestion("Клуб проходит онлайн?").title, "Формат клуба указан в анонсе встречи");
assert.equal(answerQuestion("Есть кабинет для консультации?").title, "Центр предлагает залы и кабинеты для аренды");
assert.equal(answerQuestion("что вы вообще такое?").title, "Я информационный помощник центра");
assert.equal(answerQuestion("почём клуб?").title, "Цена зависит от конкретной встречи клуба");
assert.equal(answerQuestion("как до вас доехать?").title, "Центр находится рядом с метро «Площадь Ленина»");
assert.equal(answerQuestion("аренда кабинета").url, "https://orion-center.ru/services");
const naturalVariants = [
  "чо вы такое", "что ты умеешь", "почём у вас клуб", "можно с другом прийти",
  "у вас онлайн бывает", "как до вас доехать", "хочу психолога ребенку",
  "какие доки дадут после курса", "есть зал человек на двадцать",
  "как вернуть оплату", "не помню пароль"
];
assert.equal(naturalVariants.filter((question) => answerQuestion(question).kind === "fallback").length, 0);

const psychosomatics = answerQuestion("Что входит в практикум по психосоматике?");
assert.equal(psychosomatics.title, "Практикум по психосоматике");
assert.match(psychosomatics.text, /разбор случаев/i);
assert.match(psychosomatics.url, /psychosomatics#/);

assert.equal(answerQuestion("Расскажите про Пилот-волну").title, "Программа «Пилот-волна»");
assert.equal(answerQuestion("Что такое Скрытые сокровища?").title, "Программа «Скрытые сокровища»");
assert.equal(answerQuestion("У меня мысли о самоубийстве").kind, "crisis");
assert.equal(answerQuestion("Поставь мне диагноз").kind, "boundary");

const price = answerQuestion("Сколько стоит практикум по психосоматике сейчас?");
assert.equal(price.kind, "unconfirmed");
assert.doesNotMatch(price.text, /\d+\s*(руб|₽)/i);

const clubVisit = answerQuestion("Сколько стоит разовое посещение клуба?");
assert.match(clubVisit.text, /1\s*000\s*(руб|₽)/i);
assert.equal(clubVisit.action?.url, "https://orion-center.ru/psycluborion");
assert.match(clubVisit.action?.label || "", /записаться/i);

const quickClubPrice = answerQuestion("Сколько стоит психологический клуб?");
assert.match(quickClubPrice.text, /1\s*000\s*(руб|₽)/i);
assert.equal(quickClubPrice.action?.url, "https://orion-center.ru/psycluborion");
assert.match(quickClubPrice.action?.label || "", /записаться/i);

const clubPass = answerQuestion("Сколько стоит абонемент клуба?");
assert.match(clubPass.text, /3\s*000\s*(руб|₽)/i);
assert.equal(clubPass.action?.url, "https://orion-center.ru/psycluborion");

const observation = answerQuestion("Сколько стоят встречи насмотренности?");
assert.match(observation.text, /3\s*000\s*(руб|₽)/i);
assert.equal(observation.action?.url, "https://orion-center.ru/pwdemonstration");

const psychosomaticsPrice = answerQuestion("Сколько стоит психосоматика?");
assert.equal(psychosomaticsPrice.kind, "unconfirmed");
assert.doesNotMatch(psychosomaticsPrice.text, /\d+\s*(руб|₽)/i);

const crisis = answerQuestion("У меня кризис, что делать?");
assert.equal(crisis.kind, "crisis");
assert.match(crisis.text, /112/);
assert.equal(crisis.url, undefined);
assert.equal(crisis.action, undefined);
assert.equal(psychosomaticsPrice.action?.url, "https://orion-center.ru/contacts");

console.log("psy-admin: 60 prepared questions and safety checks passed");
