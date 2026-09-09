import { approvedOfferings, catalog, CENTER_URL, nextPublishedEvent } from "./content.js?v=psy-widget-20260909-14";
import { intents, safetyIntents } from "./intents.js?v=psy-widget-20260909-14";

export function resolveWidgetPublicUrl(value, widgetScriptUrl) {
  const publicRoot = new URL("../", widgetScriptUrl);
  return new URL(value, publicRoot).href;
}

const normalize = (value) => value
  .toLocaleLowerCase("ru-RU")
  .replace(/ё/g, "е")
  .replace(/[«»“”„'"?!.,:;—–()\-]/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const crisisPattern = /(самоубий|суицид|убить себя|покончить с собой|не хочу жить|причинить себе вред|навредить себе|кризис)/i;
const diagnosisPattern = /(диагноз|диагностируй|назначь лечение|какие таблетки|антидепрессант|паническ|тревог|травм|упражнен|что мне лечить|проведи терапию|лечи меня)/i;
const sensitivePattern = /(номер карты|данные карты|картой|карту|оплатить в чате|cvv|cvc|парол|паспорт|снилс)/i;
const currentFactPattern = /(сколько стоит|цена|стоимость|когда|дата|места|свободн|сегодня|завтра|сейчас проходит)/i;

const standardFollowUp = "Что показать дальше: программу, расписание или помочь записаться?";
const supportiveFollowUps = Object.freeze({
  answer: standardFollowUp,
  curated: standardFollowUp,
  offer: standardFollowUp,
  unconfirmed: standardFollowUp,
  fallback: standardFollowUp,
  boundary: standardFollowUp,
  crisis: "Если опасность непосредственная, вы можете сейчас позвонить 112 или попросить человека рядом сделать это?",
});

const supportiveLeadIns = Object.freeze({
  answer: "Вот что удалось подтвердить по материалам центра.",
  curated: "Вот подтверждённая информация центра.",
  offer: "Вот что сейчас подтверждено по этой возможности.",
  unconfirmed: "Здесь особенно важно сверить актуальные данные.",
  fallback: "Давайте уточним тему — так получится найти нужный раздел.",
  boundary: "Здесь особенно важно дать безопасный и точный ориентир.",
});

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

function routeQuestion(rawQuestion, context = {}) {
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

  const continuesNearestEvent = context?.topic === "next-published-event";
  if (continuesNearestEvent && /^(?:формат|какой формат|онлайн или очно|очно или онлайн|это онлайн|это очно)$/i.test(query)) {
    return {
      kind: "offer",
      title: "Формат ближайшей программы",
      text: `Программа «${nextPublishedEvent.title}» проходит ${nextPublishedEvent.format}.`,
      url: nextPublishedEvent.url,
      linkText: "Открыть программу и подробности",
      context: { topic: "next-published-event" },
      followUp: "Хотите открыть программу или оставить заявку?"
    };
  }
  if (continuesNearestEvent && /^(?:программа|про программу|что в программе|содержание программы)$/i.test(query)) {
    return {
      kind: "offer",
      title: "О ближайшей программе",
      text: `«${nextPublishedEvent.title}» — онлайн-программа из ${nextPublishedEvent.duration}. В описании заявлены теория и практические упражнения для самостоятельной и совместной работы.`,
      url: nextPublishedEvent.url,
      linkText: "Открыть программу и подробности",
      context: { topic: "next-published-event" },
      followUp: "Хотите узнать способ записи на эту программу?"
    };
  }
  if (continuesNearestEvent && /^(?:способ записи|как записаться|запись|хочу записаться|оставить заявку)$/i.test(query)) {
    return {
      kind: "offer",
      title: "Запись на ближайшую программу",
      text: `Оставить заявку на программу «${nextPublishedEvent.title}» можно в форме помощника. Администратор центра проверит возможность участия и свяжется с вами.`,
      url: nextPublishedEvent.url,
      linkText: "Открыть программу и подробности",
      action: { label: "Оставить заявку на мероприятие", url: "/psy-admin/booking/?kind=seminar" },
      context: { topic: "next-published-event" },
      followUp: "Хотите оставить заявку сейчас?"
    };
  }

  const asksForNextEvent = /(ближайш|следующ).*(семинар|мероприят|программ)|(семинар|мероприят|программ).*(ближайш|следующ)/i.test(query);
  const asksForClubPrice = /(сколько стоит|цена|почем).*(психологическ.*клуб|клуб)|(психологическ.*клуб|клуб).*(сколько стоит|цена|почем)/i.test(query);

  if (asksForNextEvent && asksForClubPrice) {
    return {
      kind: "offer",
      title: "Ближайшее мероприятие и стоимость клуба",
      text: `Ближайшее опубликованное мероприятие — «${nextPublishedEvent.title}»: старт ${nextPublishedEvent.startsAt}, ${nextPublishedEvent.duration}. Разовое посещение психологического клуба «Вечер с пользой» стоит 1 000 руб.; регистрация обязательна.`,
      url: "https://orion-center.ru/schedule#actual",
      linkText: "Открыть актуальное расписание",
      action: { label: "Открыть страницу клуба", url: "https://orion-center.ru/psycluborion" }
    };
  }

  if (asksForNextEvent) {
    return {
      kind: "offer",
      title: "Ближайшее опубликованное мероприятие",
      text: `Ближайшее опубликованное мероприятие — «${nextPublishedEvent.title}». Старт ${nextPublishedEvent.startsAt}, ${nextPublishedEvent.duration}.`,
      url: nextPublishedEvent.url,
      linkText: "Открыть программу и подробности",
      action: { label: "Оставить заявку на мероприятие", url: "/psy-admin/booking/?kind=seminar" },
      context: { topic: "next-published-event" },
      followUp: "Хотите узнать формат этой программы или оставить заявку?"
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

  // Короткие организационные вопросы часто приходят с переставленными буквами.
  // Расписание центра не должно случайно превращаться в расписание клуба.
  if (/(распис|распс|афиш)/i.test(query) && !/клуб/i.test(query)) {
    return {
      kind: "curated",
      title: "Ближайшие мероприятия",
      text: "В расписании собраны актуальные семинары, курсы и встречи центра. У каждого события есть собственный анонс с темой, ведущими, форматом и способом регистрации.",
      url: "https://orion-center.ru/schedule#actual",
      linkText: "Открыть актуальную афишу"
    };
  }

  if (/как(ого|ой).*цвет|цвет.*(кабинет|зал|стен)/i.test(query)) {
    return {
      kind: "fallback",
      title: "Этого нет в подтверждённых данных",
      text: "Я не буду угадывать внешний вид помещений. Посмотрите фотографии на странице аренды или уточните детали у администратора центра.",
      url: "https://orion-center.ru/services",
      linkText: "Посмотреть помещения"
    };
  }

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

export function answerQuestion(rawQuestion, context = {}) {
  const answer = routeQuestion(rawQuestion, context);
  const followUp = answer.kind === "crisis" ? supportiveFollowUps.crisis : standardFollowUp;
  const query = normalize(rawQuestion);
  const shortContinuation = query.split(" ").filter(Boolean).length <= 3
    && /^(?:контакт|формат|программ|способ запис|запис|распис|стоимост|цен|подробн|специалист)/i.test(query);
  const leadIn = shortContinuation ? undefined : supportiveLeadIns[answer.kind];
  return followUp ? { ...answer, ...(leadIn ? { leadIn } : {}), followUp } : answer;
}
