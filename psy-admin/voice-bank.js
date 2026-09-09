import { preparedQuestionCases, routeWidgetQuestion } from "./widget-contract.js?v=psy-widget-20260909-17";

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

function genericClipId(question, answer) {
  const text = `${question || ""} ${answer?.text || ""}`.toLowerCase();
  if (/телеграм|telegram|почт|email|e-mail|телефон|контакт|написат|связат/.test(text)) return "generic-contacts";
  if (/расписан|когда|дата|время|ближайш|мероприят|анонс|афиш/.test(text)) return "generic-schedule";
  if (/онлайн|очно|формат|участи/.test(text)) return "generic-format";
  if (/цен|стоим|оплат|тариф|рубл|возврат|деньг/.test(text)) return "generic-payment";
  if (/запис|регистр|заявк|места/.test(text)) return "generic-signup";
  if (/психолог|специалист|консультац|терап/.test(text)) return "generic-specialists";
  if (/адрес|находит|добрат|проезд|метро/.test(text)) return "generic-location";
  if (/аренд|зал|кабинет|помещен/.test(text)) return "generic-rental";
  if (/программ|курс|обучен|семинар|мастер-класс/.test(text)) return "generic-programs";
  return "generic-general";
}

export function resolveVoiceClip({ question = "", answer = {} } = {}) {
  const exact = preparedByText.get(String(answer?.spokenText || ""));
  if (exact) return exact;
  return genericById.get(genericClipId(question, answer)) || genericById.get("generic-general");
}
