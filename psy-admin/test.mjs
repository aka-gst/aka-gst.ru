import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { answerQuestion } from "./router.js";
import { quickQuestions } from "./content.js";
import { createHandoffPayload, createWidgetState, preparedQuestionCases, reduceWidgetState, routeWidgetQuestion, sanitizeSpokenText } from "./widget-contract.js";
import * as widgetContract from "./widget-contract.js";

const widgetVersion = "psy-widget-20260909-07";
const widgetSource = await readFile(new URL("./psy-widget.js", import.meta.url), "utf8");
const contractSource = await readFile(new URL("./widget-contract.js", import.meta.url), "utf8");
const buildSource = await readFile(new URL("./tools/build-orion-demo.mjs", import.meta.url), "utf8");
const widgetCss = await readFile(new URL("./widget.css", import.meta.url), "utf8");
const homePage = await readFile(new URL("./index.html", import.meta.url), "utf8");
const caddyfile = await readFile(new URL("../Caddyfile", import.meta.url), "utf8");
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
assert.match(widgetSource, /<label for="psy-widget-evaluation-select">Частые вопросы<\/label>/);
assert.match(widgetSource, /<select class="psy-widget-evaluation-select"/);
assert.match(widgetSource, /Выберите вопрос/);
assert.doesNotMatch(widgetSource, /psy-widget-evaluation-open/);
assert.doesNotMatch(widgetSource, /psy-widget-evaluation-toggle|psy-widget-evaluation-content|60 проверочных вопросов|Ожидается:/);
assert.match(widgetSource, /preparedQuestionCases/);
assert.doesNotMatch(widgetSource, /Только открытые источники|Демо по открытым страницам|Демо-передача/);
assert.match(widgetSource, /Запись, семинары и аренда/);
assert.match(widgetSource, /Расписание мероприятий уже опубликовано/);
assert.match(widgetSource, /нет общего календаря свободных окон/);
assert.doesNotMatch(widgetSource, /Пока точного расписания нет/);
assert.match(widgetSource, /name="requestKind"/);
assert.match(widgetSource, /К какому психологу хотите записаться\?/);
assert.match(widgetSource, /Не знаю — администратор поможет подобрать/);
assert.doesNotMatch(widgetSource, /Помогите выбрать специалиста|Запись, аренда и оплата/);
for (const specialist of ["Смирнова Юлия Сергеевна", "Сербина Людмила Николаевна", "Белозеров Евгений Владимирович", "Бутусова Елена Сергеевна", "Андреева Татьяна Владимировна", "Гайнулина Оксана Владимировна", "Извекова Ирина Владимировна", "Сатикова Светлана Валентиновна"]) {
  assert.match(widgetSource, new RegExp(specialist));
}
assert.match(widgetSource, /name="requestedTime"/);
assert.match(widgetSource, /name="clientName"/);
assert.match(widgetSource, /name="comment"/);
assert.match(widgetSource, /name="contact"/);
assert.match(widgetSource, /name="consent"/);
assert.doesNotMatch(widgetSource, /__psyAdminTestInbox|PSY-TEST|Добавить в тестовый стенд/);
assert.deepEqual(createHandoffPayload({ requestKind: "specialist", subject: "Юлия Смирнова", requestedTime: "будни вечером", clientName: "Анна", comment: "Первичная встреча", contact: "+7 900 000-00-00", consent: true }), {
  kind: "specialist", subject: "Юлия Смирнова", requestedDateTime: "будни вечером", clientName: "Анна", details: "Первичная встреча", contact: "+7 900 000-00-00", consent: true,
});
assert.equal(createHandoffPayload({ requestKind: "rental" }).kind, "rental");
assert.equal(createHandoffPayload({ requestKind: "seminar" }).kind, "seminar");
assert.equal(createHandoffPayload({ requestKind: "unexpected" }).kind, "specialist");
assert.match(widgetSource, /data-assistant-host="live"/);
assert.match(widgetSource, /aria-label="Вам помочь\?"/);
assert.match(widgetSource, /<span aria-hidden="true">✦<\/span><span>Вам помочь\?<\/span>/);
assert.doesNotMatch(widgetSource, /Спросить помощника/);
assert.match(widgetSource, />Оставить заявку<\/button>/);
assert.match(widgetSource, /<a class="psy-widget-payment" href="https:\/\/orion-center\.ru\/payment" target="_blank" rel="noopener noreferrer">/);
assert.match(widgetSource, /Перейти к оплате ↗/);
assert.match(widgetSource, /После выбора и согласования услуги/);
assert.doesNotMatch(widgetSource, /href="\/psy-admin\/booking\/\?kind=/);
assert.doesNotMatch(widgetSource, /<select[^>]+name="requestedTime"/);
assert.match(widgetCss, /\.psy-widget-handoff \{ display: grid;/);
assert.match(widgetCss, /\.psy-widget-handoff-area/);
assert.match(widgetCss, /\.psy-widget-panel \{[^}]*width: min\(520px, calc\(100vw - 32px\)\);/);
assert.match(widgetCss, /\.psy-widget\[data-fullscreen="true"\] \.psy-widget-panel \{[^}]*width: min\(760px, calc\(100vw - 48px\)\);/);
assert.doesNotMatch(widgetCss, /\.psy-widget-trigger span:last-child \{ display: none; \}/);
assert.doesNotMatch(widgetCss, /data-fullscreen="true"[^}]*inset:\s*0/);
assert.match(widgetCss, /\.psy-widget-handoff-area > \.psy-widget-payment \{[^}]*min-height: 44px;/);
assert.match(widgetCss, /\.psy-widget-voice-status \{[^}]*min-height: 1\.35em;[^}]*white-space: nowrap;/);
assert.match(widgetCss, /\.psy-widget-message\.assistant \{[^}]*justify-self: start;[^}]*width: fit-content;/);
assert.doesNotMatch(widgetSource, /\/psy-admin\/payment/);
assert.doesNotMatch(widgetSource, /psyadmin-A\.wav|data-voice-preview|Голос:/);
const widgetCorsStart = caddyfile.indexOf("@orion_widget_assets");
const widgetCors = caddyfile.slice(widgetCorsStart, caddyfile.indexOf("root * /srv", widgetCorsStart));
assert.match(widgetCors, /header Origin https:\/\/orion-center\.ru/);
assert.match(widgetCors, /Access-Control-Allow-Origin "https:\/\/orion-center\.ru"/);
assert.match(widgetCors, /\/psy-admin\/psy-widget\.js/);
assert.match(widgetCors, /\/psy-admin\/audio\/voices\/psyadmin-A\.wav/);
assert.doesNotMatch(widgetCors, /\/psy-admin\/(?:admin|booking)/);
assert.doesNotMatch(widgetCors.replaceAll("https://orion-center.ru", "https://attacker.invalid"), /https:\/\/orion-center\.ru/);
assert.doesNotMatch(widgetSource, /psyadmin-B\.wav/);
assert.doesNotMatch(widgetSource, /psyadmin-C\.wav/);
assert.doesNotMatch(widgetSource, /psyadmin-D\.ogg/);
assert.match(widgetSource, /Ответ помощника будет озвучен<\/span>/);
assert.doesNotMatch(widgetSource, /естественный голос/i);
assert.match(widgetSource, /data-voice-stop/);
assert.match(widgetSource, />Остановить голос<\/button>/);
assert.match(widgetSource, /event\.code === "Space"/);
assert.match(widgetSource, /previewStopButton\.addEventListener/);
assert.match(widgetSource, /function renderVoiceControl\(\)/);
assert.match(widgetSource, /mic\.textContent = playing \? "🔇" : "🎙"/);
assert.match(widgetSource, /if \(voiceIsPlaying\(\) \|\| listening\)/);
assert.doesNotMatch(widgetSource, /class="psy-widget-stop"/);
assert.doesNotMatch(widgetSource, /softenPreviewTone|previewAudio/);
assert.match(widgetSource, /VOICE_QUIET_GAP_MS = 1400/);
assert.match(widgetSource, /recognition\.continuous = true/);
assert.match(widgetSource, /Можете делать паузы/);
assert.match(widgetSource, /voiceIsActive/);
assert.match(widgetCss, /psy-widget-listening/);
assert.match(widgetSource, /new SpeechSynthesisUtterance/);
assert.match(widgetSource, /speechSynthesis\.speak/);
assert.match(widgetSource, /new URL\("\.\/booking\/api\/ask", import\.meta\.url\)\.href/);
assert.match(widgetSource, /fetch\(assistantApiUrl/);
assert.match(widgetSource, /sanitizeSpokenText/);
assert.match(widgetSource, /const keepVerifiedAnswer = shouldKeepVerifiedAnswer\(fallback\)/);
assert.match(widgetSource, /handoffForm\.hidden = true/);
assert.match(widgetSource, /appendMessage\("assistant", \{ kind: "success", text: successText \}\)/);
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
const compoundScheduleAndClubPrice = answerQuestion("Когда будет ближайший семинар и сколько стоит психологический клуб?");
assert.equal(compoundScheduleAndClubPrice.title, "Ближайшее мероприятие и стоимость клуба");
assert.match(compoundScheduleAndClubPrice.text, /14 сентября 2026/);
assert.match(compoundScheduleAndClubPrice.text, /1\s*000\s*(руб|₽)/i);
assert.equal(compoundScheduleAndClubPrice.url, "https://orion-center.ru/schedule#actual");
assert.equal(compoundScheduleAndClubPrice.action?.url, "https://orion-center.ru/psycluborion");
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
const bareDomainSpeech = sanitizeSpokenText(
  "Ответ на backspace.com/path и orion-center.ru/schedule. [Открыть расписание](https://orion-center.ru/schedule) \\ служебный хвост.",
);
assert.doesNotMatch(bareDomainSpeech, /backspace|orion-center|\.com|\.ru|https?|[\\/]|\]\(/i);
assert.equal(sanitizeSpokenText("Первая суть. Вторая подробность, которую говорить не нужно."), "Первая суть.");
assert.equal(
  sanitizeSpokenText("Ближайшее мероприятие → открыть ↗ \\ служебный хвост."),
  "Ближайшее мероприятие открыть служебный хвост.",
);

const routedNearestEvent = routeWidgetQuestion("Какие мероприятия ближайшие?");
assert.equal(
  routedNearestEvent.spokenText,
  "Ближайшее опубликованное мероприятие — «Теория и практика работы с измененными и экстремальными состояниями сознания».",
);
assert.doesNotMatch(routedNearestEvent.spokenText, /https?:\/\/|www\.|[\\/]|[→↗]|\.(?:html?|php)\b/i);

const routedClub = routeWidgetQuestion("Сколько стоит психологический клуб?");
assert.match(routedClub.text, /1\s*000\s*(руб|₽)/i); // Полный ответ остаётся видимым.
assert.match(routedClub.action?.label || "", /записаться/i); // И кнопка ссылки остаётся видимой.
assert.ok(routedClub.spokenText.length > 0);
assert.doesNotMatch(routedClub.spokenText, /https?:\/\/|www\.|[\\/]|\.(?:html?|php)\b|записаться/i);
assert.equal(widgetContract.shouldKeepVerifiedAnswer?.(routedClub), true); // Сервер не должен перезаписать проверенную цену общим ответом.
assert.equal(widgetContract.shouldKeepVerifiedAnswer?.({ kind: "fallback" }), false); // Неизвестный вопрос по-прежнему можно уточнить на сервере.

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
