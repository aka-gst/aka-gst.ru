import { preparedQuestionCases, routeWidgetQuestion } from "./widget-contract.js?v=psy-widget-20260913-26";

export const VOICE_BANK_VERSION = "orion-voice-a-20260909-01";

const preparedEntries = [];
const preparedByText = new Map();

for (const { question } of preparedQuestionCases()) {
  const spokenText = routeWidgetQuestion(question).spokenText;
  if (preparedByText.has(spokenText)) continue;
  const id = `prepared-${String(preparedEntries.length + 1).padStart(2, "0")}`;
  const entry = {
    id,
    spokenText,
    src: `./audio/voice-a/${id}.wav?v=${VOICE_BANK_VERSION}`,
    exact: true,
  };
  preparedEntries.push(entry);
  preparedByText.set(spokenText, entry);
}

const genericEntries = [
  ["generic-contacts", "Контакты и способы связи я показала в сообщении. Хотите уточнить что-нибудь ещё?"],
  ["generic-schedule", "Актуальные даты и расписание я показала в сообщении. Хотите уточнить конкретное мероприятие?"],
  ["generic-format", "Формат участия я уточнила в сообщении. Хотите узнать другие подробности программы?"],
  ["generic-payment", "Информацию о стоимости и оплате я показала в сообщении. Хотите уточнить способ записи?"],
  ["generic-signup", "Способ записи я показала в сообщении. Хотите, я помогу выбрать следующий шаг?"],
  ["generic-specialists", "Информацию о специалистах я показала в сообщении. Хотите уточнить направление работы?"],
  ["generic-location", "Адрес и способ добраться я показала в сообщении. Остались вопросы о посещении центра?"],
  ["generic-rental", "Условия аренды я показала в сообщении. Хотите уточнить помещение, дату или количество участников?"],
  ["generic-programs", "Информацию о программах я показала в сообщении. Хотите уточнить формат, содержание или запись?"],
  ["generic-general", "Ответ уже показан в сообщении. Хотите уточнить что-нибудь ещё?"],
].map(([id, spokenText]) => ({
  id,
  spokenText,
  src: `./audio/voice-a/${id}.wav?v=${VOICE_BANK_VERSION}`,
  exact: false,
}));

const genericById = new Map(genericEntries.map((entry) => [entry.id, entry]));

export const voiceBankEntries = Object.freeze([...preparedEntries, ...genericEntries]);

// Тема записанной фразы — только по вопросу и по порядку правил. Прежний подбор
// склеивал вопрос с ответом и ловил подстроки: «цен» из «центр» давал фразу про
// оплату на любой ответ со словом «центр», «стоит» не считалось ценой,
// «психологический» уходил в специалистов (найдено 03.10.2026 на orion_2).
// Цена раньше специалистов: «сколько стоит консультация» — про цену.
const TOPIC_RULES = [
  ["generic-payment", /сколько сто|стоимост|(^|[^а-яё])цен[аыуеой]|оплат|тариф|руб|деньг|возврат/],
  ["generic-location", /где (вы|наход)|адрес|находит|добрат|проезд|метро/],
  ["generic-contacts", /телефон|почт|e-?mail|связат|контакт|телеграм|telegram/],
  ["generic-rental", /аренд|зал|кабинет|помещен/],
  ["generic-schedule", /расписан|когда|ближайш|мероприят|анонс|афиш|свободн|время/],
  ["generic-programs", /программ|курс|обучен|семинар|мастер-класс/],
  ["generic-format", /онлайн|очно|формат|участи/],
  ["generic-signup", /запис|регистр|заявк/],
  ["generic-specialists", /специалист|консультац|терап|(^|[^а-яё])психолог(а|у|ом|ам|и|ов)?([^а-яё]|$)/],
];

export function topicClipId(question) {
  const text = String(question || "").toLowerCase();
  return TOPIC_RULES.find(([, rule]) => rule.test(text))?.[0] || null;
}

// null — записи нет: виджет читает сам ответ голосом браузера, а не общую заглушку.
// Кризисный ответ — всегда своими словами (со 112), никогда общей фразой.
export function resolveVoiceClip({ question = "", answer = {} } = {}) {
  const exact = preparedByText.get(String(answer?.spokenText || ""));
  if (exact) return exact;
  if (answer?.kind === "crisis") return null;
  const id = topicClipId(question);
  return id ? genericById.get(id) || null : null;
}
