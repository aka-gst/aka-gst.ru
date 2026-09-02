import { approvedOfferings, catalog, CENTER_URL } from "./content.js";
import { intents, safetyIntents } from "./intents.js";

const normalize = (value) => value
  .toLocaleLowerCase("ru-RU")
  .replace(/ё/g, "е")
  .replace(/[«»“”„'"?!.,:;—–()\-]/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const crisisPattern = /(самоубий|суицид|убить себя|покончить с собой|не хочу жить|причинить себе вред|навредить себе)/i;
const diagnosisPattern = /(диагноз|диагностируй|назначь лечение|какие таблетки|антидепрессант|паническ|тревог|травм|упражнен|что мне лечить|проведи терапию|лечи меня)/i;
const sensitivePattern = /(номер карты|данные карты|картой|карту|оплатить в чате|cvv|cvc|парол|паспорт|снилс)/i;
const currentFactPattern = /(сколько стоит|цена|стоимость|когда|дата|места|свободн|сегодня|завтра|сейчас проходит)/i;

function scoreItem(query, item) {
  if (item.id.endsWith("-practicum") && !query.includes("практикум")) return 0;
  const normalizedKeywords = item.keywords.map(normalize);
  let score = 0;
  for (const keyword of normalizedKeywords) {
    if (query.includes(keyword)) score += 10 + keyword.length;
    else {
      const words = keyword.split(" ").filter((word) => word.length > 3);
      score += words.filter((word) => query.includes(word)).length * 2;
    }
  }
  return score;
}

const wordStems = (value) => normalize(value)
  .split(" ")
  .filter((word) => word.length > 3)
  .map((word) => word.slice(0, Math.min(6, word.length)));

function scoreIntent(query, intent) {
  let best = 0;
  const queryStems = new Set(wordStems(query));
  for (const example of intent.examples) {
    const normalizedExample = normalize(example);
    if (query === normalizedExample) return 100;
    if (query.includes(normalizedExample) || normalizedExample.includes(query)) best = Math.max(best, 80);
    const exampleStems = new Set(wordStems(normalizedExample));
    const overlap = [...exampleStems].filter((stem) => queryStems.has(stem)).length;
    const ratio = overlap / Math.max(1, Math.min(queryStems.size, exampleStems.size));
    best = Math.max(best, ratio * 50);
  }
  return best;
}

function bestIntentMatch(query, candidates) {
  return candidates
    .map((intent) => ({ intent, score: scoreIntent(query, intent) }))
    .sort((a, b) => b.score - a.score)[0];
}

function findApprovedOffering(query) {
  return approvedOfferings
    .map((offering) => ({
      offering,
      score: offering.keywords.reduce((best, keyword) => Math.max(best, query.includes(normalize(keyword)) ? normalize(keyword).length : 0), 0)
    }))
    .sort((a, b) => b.score - a.score)[0];
}

export function answerQuestion(rawQuestion) {
  const question = String(rawQuestion || "").trim();
  const query = normalize(question);

  if (!query) return { kind: "empty", text: "Напишите вопрос — например, название программы или практикума." };

  if (crisisPattern.test(query)) {
    return {
      kind: "crisis",
      title: "Сейчас важнее получить живую помощь",
      text: "Если есть непосредственная опасность для вас или другого человека, позвоните 112. Постарайтесь не оставаться в одиночестве и обратитесь к человеку, которому доверяете. Этот помощник не является экстренной службой."
    };
  }

  const safetyMatch = bestIntentMatch(query, safetyIntents);
  if (safetyMatch?.score >= 32) {
    return {
      kind: "boundary",
      title: safetyMatch.intent.title,
      text: safetyMatch.intent.text,
      url: safetyMatch.intent.url,
      linkText: safetyMatch.intent.linkText
    };
  }

  if (diagnosisPattern.test(query)) {
    return {
      kind: "boundary",
      title: "С этим нужен специалист",
      text: "Помощник не ставит диагнозы, не назначает лекарства и не проводит терапию. Он может показать открытые сведения о консультациях центра.",
      url: "https://orion-center.ru/consultation",
      linkText: "Посмотреть консультации специалистов"
    };
  }

  if (sensitivePattern.test(query)) {
    return {
      kind: "boundary",
      title: "Не отправляйте секретные данные",
      text: "Не сообщайте в чате пароли, данные банковской карты или документы. Для личного обращения используйте официальные контакты центра.",
      url: "https://orion-center.ru/contacts",
      linkText: "Открыть контакты центра"
    };
  }

  const approvedOffering = findApprovedOffering(query);
  if (approvedOffering?.score > 0) {
    const offering = approvedOffering.offering;
    return {
      kind: "offer",
      title: offering.title,
      text: `${offering.text} Сверено: ${offering.checkedAt}.`,
      url: offering.sourceUrl,
      linkText: "Открыть официальный источник",
      action: { label: offering.actionLabel, url: offering.registrationUrl }
    };
  }

  if (/(психосомат)/i.test(query) && currentFactPattern.test(query)) {
    return {
      kind: "unconfirmed",
      title: "Цена психосоматики сейчас не подтверждена",
      text: "В открытых материалах центра есть противоречащие друг другу даты набора, поэтому я не буду называть стоимость. Уточните актуальную цену и возможность предзаписи у администратора центра.",
      url: "https://orion-center.ru/contacts",
      linkText: "Открыть официальные контакты",
      action: { label: "Уточнить цену у администратора", url: "https://orion-center.ru/contacts" }
    };
  }

  const mentionsSpecificProgram = /(психосомат|пилот.*волн|скрыт.*сокров)/i.test(query);
  const intentMatch = mentionsSpecificProgram ? null : bestIntentMatch(query, intents);

  if (intentMatch?.score >= 32) {
    return {
      kind: "curated",
      title: intentMatch.intent.title,
      text: intentMatch.intent.text,
      url: intentMatch.intent.url,
      linkText: intentMatch.intent.linkText
    };
  }

  const ranked = catalog
    .map((item) => ({ item, score: scoreItem(query, item) }))
    .sort((a, b) => b.score - a.score);
  const match = ranked[0];

  if (match?.score > 2) {
    const alreadyWarnsAboutChanges = /(дат|стоимост|мест|свободн).*(смотр|пров|подтвержд|публику)/i.test(match.item.summary);
    const volatileNote = currentFactPattern.test(query) && !alreadyWarnsAboutChanges
      ? " Даты, стоимость и наличие мест могли измениться — проверьте их по ссылке перед записью."
      : "";
    return {
      kind: "answer",
      title: match.item.title,
      text: match.item.summary + volatileNote,
      url: match.item.url,
      linkText: match.item.linkText
    };
  }

  return {
    kind: "fallback",
    title: "Пока не нашёл точный раздел",
    text: "Попробуйте указать название программы, практикума или услуги. Все открытые направления центра можно посмотреть на официальном сайте.",
    url: CENTER_URL,
    linkText: "Открыть сайт центра"
  };
}
