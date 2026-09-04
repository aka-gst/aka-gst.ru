import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { answerQuestion } from "./router.js";
import { quickQuestions } from "./content.js";
import { createWidgetState, preparedQuestionCases, reduceWidgetState, routeWidgetQuestion, sanitizeSpokenText } from "./widget-contract.js";

const widgetVersion = "psy-widget-20260904-16";
const widgetSource = await readFile(new URL("./psy-widget.js", import.meta.url), "utf8");
const contractSource = await readFile(new URL("./widget-contract.js", import.meta.url), "utf8");
const buildSource = await readFile(new URL("./tools/build-orion-demo.mjs", import.meta.url), "utf8");
const widgetCss = await readFile(new URL("./widget.css", import.meta.url), "utf8");
const homePage = await readFile(new URL("./index.html", import.meta.url), "utf8");
const officialHero = "https://static.tildacdn.com/tild6564-6339-4335-b465-333932373236/WhatsApp_Image_2024-.jpeg";
assert.equal((homePage.match(new RegExp(officialHero.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length, 3);
assert.match(homePage, /linear-gradient\(to bottom, rgba\(0,0,0,0\.60\), rgba\(51,51,51,0\.30\)\)/);
assert.doesNotMatch(homePage, /orion-hero-trajectory\.png/);
assert.match(widgetSource, new RegExp(`widget-contract\\.js\\?v=${widgetVersion}`));
assert.match(contractSource, new RegExp(`router\\.js\\?v=${widgetVersion}`));
assert.match(buildSource, new RegExp(`\\?v=${widgetVersion}`));
assert.match(widgetSource, /let state = createWidgetState\(\);/);
assert.doesNotMatch(widgetSource, /window\.innerWidth\s*>\s*620\s*\?\s*\{\s*open:\s*true/);
for (const page of ["index.html", "psycluborion/index.html", "services/index.html", "programs/index.html", "schedule/index.html", "consultation/index.html", "pweducation/index.html"]) {
  const html = await readFile(new URL(`./${page}`, import.meta.url), "utf8");
  assert.match(html, new RegExp(`psy-widget\\.js\\?v=${widgetVersion}`));
}

assert.equal(quickQuestions.length, 60);
assert.equal(preparedQuestionCases().length, 60);
assert.deepEqual(preparedQuestionCases().map(({ category, question }) => ({ category, question })), quickQuestions);
assert.equal(preparedQuestionCases().filter(({ expected }) => !expected).length, 0);
assert.match(widgetSource, /<select class="psy-widget-evaluation-select"/);
assert.match(widgetSource, /Выбери вопрос для проверки/);
assert.doesNotMatch(widgetSource, /psy-widget-evaluation-open/);
assert.match(widgetSource, /preparedQuestionCases/);
assert.doesNotMatch(widgetSource, /Только открытые источники|Демо по открытым страницам|Демо-передача/);
assert.match(widgetSource, /Запись в центр «Орион‑С»/);
assert.match(widgetSource, /Заявка уйдёт администратору на подтверждение/);
assert.match(widgetSource, /<a class="psy-widget-payment" href="https:\/\/orion-center\.ru\/payment" target="_blank" rel="noopener noreferrer">/);
assert.match(widgetSource, /Оплатить ↗/);
assert.match(widgetSource, /Официальный сайт/);
assert.match(widgetSource, /<div class="psy-widget-actions">[\s\S]*psy-widget-payment/);
assert.doesNotMatch(widgetSource, /psy-widget-payment-area|psy-widget-suggestions/);
assert.match(widgetCss, /\.psy-widget-actions \{ display: grid; grid-template-columns: repeat\(4, minmax\(0, 1fr\)\); gap: 8px; \}/);
assert.match(widgetCss, /@media \(max-width: 620px\)[\s\S]*\.psy-widget-actions \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);
assert.match(widgetCss, /\.psy-widget\[data-fullscreen="true"\] \.psy-widget-actions/);
assert.match(widgetCss, /\.psy-widget-panel \{[^}]*width: min\(520px, calc\(100vw - 32px\)\);/);
assert.match(widgetCss, /\.psy-widget-payment \{[^}]*min-height: 54px;/);
assert.match(widgetCss, /\.psy-widget-booking \{[^}]*min-height: 54px;/);
assert.doesNotMatch(widgetSource, /\/psy-admin\/payment/);
assert.match(widgetSource, /href="\/psy-admin\/booking\/\?kind=specialist">Записаться к специалисту<\/a>/);
assert.match(widgetSource, /href="\/psy-admin\/booking\/\?kind=seminar">Записаться на семинар<\/a>/);
assert.match(widgetSource, /href="\/psy-admin\/booking\/\?kind=rental">Оставить заявку на аренду<\/a>/);
assert.match(widgetSource, /psyadmin-A\.wav/);
assert.match(widgetSource, /psyadmin-B\.wav/);
assert.match(widgetSource, /psyadmin-C\.wav/);
assert.match(widgetSource, /psyadmin-D\.ogg/);
assert.match(widgetSource, /Выберите естественный голос: A, Б, В или Г\./);
assert.ok((await stat(new URL("./audio/voices/psyadmin-D.ogg", import.meta.url))).size > 800_000);
assert.match(widgetSource, /data-voice-volume="0\.55" data-voice-eq-gain="-5"/);
assert.match(widgetSource, /data-voice-stop/);
assert.match(widgetSource, /Остановить голос/);
assert.match(widgetSource, /event\.code === "Space"/);
assert.match(widgetSource, /previewStopButton\.addEventListener/);
assert.match(widgetSource, /function renderVoiceControl\(\)/);
assert.match(widgetSource, /mic\.textContent = playing \? "🔇" : "🎙"/);
assert.match(widgetSource, /if \(voiceIsPlaying\(\) \|\| listening\)/);
assert.doesNotMatch(widgetSource, /class="psy-widget-stop"/);
assert.match(widgetSource, /filter\.frequency\.value = 520/);
assert.match(widgetSource, /filter\.Q\.value = 0\.75/);
assert.match(widgetSource, /filter\.gain\.value = gain/);
assert.match(widgetSource, /VOICE_QUIET_GAP_MS = 1400/);
assert.match(widgetSource, /recognition\.continuous = true/);
assert.match(widgetSource, /Можете делать паузы/);
assert.match(widgetSource, /voiceIsActive/);
assert.match(widgetCss, /psy-widget-listening/);
assert.doesNotMatch(widgetSource, /SpeechSynthesisUtterance|speechSynthesis\.speak/);
assert.doesNotMatch(widgetSource, /data-question="У меня мысли о самоубийстве"/);
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
assert.equal(answerQuestion("где расписнаие").url, "https://orion-center.ru/schedule#actual");
assert.equal(answerQuestion("где распсинаие").url, "https://orion-center.ru/schedule#actual");
const nextEvent = answerQuestion("Когда ближайший семинар?");
assert.equal(nextEvent.title, "Ближайшее опубликованное мероприятие");
assert.match(nextEvent.text, /Теория и практика работы с измененными и экстремальными состояниями сознания/);
assert.match(nextEvent.text, /14 сентября 2026/);
assert.equal(nextEvent.action?.url, "/psy-admin/booking/?kind=seminar");
assert.match(answerQuestion("какого цвета кабинет").title, /нет в подтверждённых данных/i);

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

const unsafeSpeech = sanitizeSpokenText(
  "Подробный ответ: https://orion-center.ru/file.html www.orion-center.ru /path/form.php. Открыть файл и Записаться на встречу клуба.",
  ["Открыть файл", "Записаться на встречу клуба"],
);
assert.doesNotMatch(unsafeSpeech, /https?:\/\/|www\.|[\\/]|\.(?:html?|php)\b|Открыть файл|Записаться на встречу клуба/i);
assert.match(unsafeSpeech, /Подробный ответ/i);
assert.ok(unsafeSpeech.length <= 160);
assert.equal(sanitizeSpokenText("Первая суть. Вторая подробность, которую говорить не нужно."), "Первая суть.");

const routedClub = routeWidgetQuestion("Сколько стоит психологический клуб?");
assert.match(routedClub.text, /1\s*000\s*(руб|₽)/i); // Полный ответ остаётся видимым.
assert.match(routedClub.action?.label || "", /записаться/i); // И кнопка ссылки остаётся видимой.
assert.ok(routedClub.spokenText.length > 0);
assert.doesNotMatch(routedClub.spokenText, /https?:\/\/|www\.|[\\/]|\.(?:html?|php)\b|записаться/i);

let widgetState = reduceWidgetState(createWidgetState(), "trigger");
widgetState = reduceWidgetState(widgetState, "fullscreen");
assert.equal(widgetState.fullScreen, true);
widgetState = reduceWidgetState(widgetState, "fullscreen");
assert.equal(widgetState.fullScreen, false); // fullscreen → normal

widgetState = reduceWidgetState(widgetState, "fullscreen");
widgetState = reduceWidgetState(widgetState, "close");
assert.deepEqual(widgetState, { open: false, panelVisible: false, fullScreen: false, returnFocusToTrigger: true }); // fullscreen → close

widgetState = reduceWidgetState(reduceWidgetState(createWidgetState(), "trigger"), "fullscreen");
widgetState = reduceWidgetState(widgetState, "escape");
assert.equal(widgetState.fullScreen, false);
assert.equal(widgetState.open, true); // Первый Escape только сворачивает fullscreen.
widgetState = reduceWidgetState(widgetState, "escape");
assert.equal(widgetState.open, false); // Следующий Escape закрывает.

console.log("psy-admin: 60 prepared questions and safety checks passed");
