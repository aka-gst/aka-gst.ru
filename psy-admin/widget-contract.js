import { quickQuestions } from "./content.js?v=psy-widget-20260909-07";
import { answerQuestion } from "./router.js?v=psy-widget-20260909-07";

const preparedAnswerLabels = {
  boundary: "граница безопасности",
  crisis: "экстренная помощь",
  offer: "подтверждённое предложение",
  unconfirmed: "не называет неподтверждённое",
};

export function preparedQuestionCases() {
  return quickQuestions.map((item, index) => {
    const answer = answerQuestion(item.question);
    return {
      id: `prepared-question-${index + 1}`,
      category: item.category,
      question: item.question,
      expected: preparedAnswerLabels[answer.kind] || "подтверждённый ответ",
    };
  });
}

export function widgetPresentation(viewportWidth, voiceCapabilities, askedByVoice = false) {
  const presentation = {
    mode: viewportWidth <= 620 ? "bottom-sheet" : "side-panel",
    minTouchTarget: 44,
  };

  if (!voiceCapabilities) return presentation;

  const inputAvailable = Boolean(voiceCapabilities.recognitionAvailable);
  const outputAvailable = Boolean(voiceCapabilities.speechAvailable);
  return {
    ...presentation,
    voice: {
      inputAvailable,
      outputAvailable,
      fallbackMessage: inputAvailable
        ? (outputAvailable ? "" : "Ответ пока придёт коротким текстом. Озвучивание ответов ещё не подключено.")
        : "Голосовой ввод недоступен в этом браузере. Напишите вопрос текстом.",
      shouldSpeakReply: outputAvailable,
    },
  };
}

export function createWidgetState() {
  return { open: false, panelVisible: false, fullScreen: false, returnFocusToTrigger: false };
}

export function reduceWidgetState(state, action) {
  if (action === "trigger") {
    return state.open
      ? { open: false, panelVisible: false, fullScreen: false, returnFocusToTrigger: true }
      : { open: true, panelVisible: true, fullScreen: false, returnFocusToTrigger: false };
  }
  if (action === "fullscreen" && state.open) {
    return { ...state, fullScreen: !state.fullScreen, returnFocusToTrigger: false };
  }
  if (action === "close") {
    return { open: false, panelVisible: false, fullScreen: false, returnFocusToTrigger: true };
  }
  if (action === "escape") {
    return state.fullScreen
      ? { ...state, fullScreen: false, returnFocusToTrigger: false }
      : { open: false, panelVisible: false, fullScreen: false, returnFocusToTrigger: true };
  }
  return state;
}

export function createHandoffPayload(fields) {
  const requestedKind = String(fields.requestKind || "").trim();
  return {
    kind: ["specialist", "seminar", "rental"].includes(requestedKind) ? requestedKind : "specialist",
    subject: String(fields.subject || "").trim(),
    requestedDateTime: String(fields.requestedTime || "").trim(),
    clientName: String(fields.clientName || "").trim(),
    details: String(fields.comment || "").trim(),
    contact: String(fields.contact || "").trim(),
    consent: fields.consent === true,
  };
}

// Ответ для озвучивания должен остаться кратким и не читать адреса ссылок.
// Вопрос уходит в серверный помощник, но сервер не сохраняет его в базе или журнале.
export function sanitizeSpokenText(rawText, linkLabels = []) {
  let text = String(rawText || "");
  for (const label of linkLabels) {
    if (!label) continue;
    text = text.replaceAll(label, "");
  }
  text = text
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, "")
    .replace(/\b(?:[a-z0-9а-яё-]+\.)+(?:[a-z]{2,24}|рф)(?:\/[^\s]*)?/giu, "")
    .replace(/\b[\w.-]+\.(?:html?|php)\b/gi, "")
    .replace(/\\(?:n|r|t|b|f|v|0|x[0-9a-f]{2}|u[0-9a-f]{4})/gi, " ")
    .replace(/\b(?:backspace|backslash|escape|markdown)\b/gi, " ")
    .replace(/(?:б[еэ]кспейс|б[еэ]ксл[еэ]ш|обратн(?:ый|ая)\s+(?:сл[еэ]ш|косая\s+черта))/giu, " ")
    .replace(/[`*_#~|<>{}\[\]]+/g, " ")
    .replace(/[\\/]+/g, " ")
    .replace(/[→↗]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const sentences = text.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g) || [];
  return (sentences[0] || text).trim().slice(0, 160);
}

export function selectPreferredRussianVoice(voices = []) {
  const russian = [...voices].filter((voice) => String(voice?.lang || "").toLowerCase().startsWith("ru"));
  const preferred = russian.find((voice) => /milena/i.test(`${voice?.name || ""} ${voice?.voiceURI || ""}`));
  if (preferred) return preferred;
  const detectableFemale = russian.find((voice) => /female|женск/iu.test(`${voice?.name || ""} ${voice?.voiceURI || ""} ${voice?.gender || ""}`));
  if (detectableFemale) return detectableFemale;
  return russian.sort((left, right) => {
    const leftKey = `${left?.name || ""}\u0000${left?.voiceURI || ""}`.toLowerCase();
    const rightKey = `${right?.name || ""}\u0000${right?.voiceURI || ""}`.toLowerCase();
    return leftKey < rightKey ? -1 : (leftKey > rightKey ? 1 : 0);
  })[0];
}

export function waitForPreferredRussianVoice(synthesis, timeoutMs = 300) {
  const available = selectPreferredRussianVoice(synthesis?.getVoices?.() || []);
  if (available || !synthesis?.addEventListener) return Promise.resolve(available);
  return new Promise((resolve) => {
    let settled = false;
    let timer;
    const finish = (voice) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      synthesis.removeEventListener?.("voiceschanged", onVoicesChanged);
      resolve(voice);
    };
    const onVoicesChanged = () => {
      const voice = selectPreferredRussianVoice(synthesis.getVoices?.() || []);
      if (voice) finish(voice);
    };
    synthesis.addEventListener("voiceschanged", onVoicesChanged);
    timer = setTimeout(() => finish(selectPreferredRussianVoice(synthesis.getVoices?.() || [])), timeoutMs);
  });
}

export function normalizeAssistantResult(result, fallback) {
  if (!result?.text) return fallback;
  const serverText = String(result.text);
  const hasUnsafeRefusal = /(?:^|[.!?]\s*)(?:я\s+не\s+(?:могу|буду|имею|ставлю|провожу|стану)(?:\s|$|[,.!?;:—-])|по\s+одному\s+сообщению(?:\s|$|[,.!?;:—-]))/iu.test(serverText);
  const text = hasUnsafeRefusal ? fallback.text : serverText;
  return {
    kind: result.kind || "route",
    text,
    spokenText: sanitizeSpokenText(text),
    sources: (result.sources || []).map((source) => ({
      ...source,
      url: String(source.url || "/"),
    })),
    leadIn: fallback.leadIn,
    followUp: fallback.followUp,
  };
}

export function routeWidgetQuestion(question) {
  const answer = answerQuestion(question);
  const sources = answer.url ? [{ url: answer.url, label: answer.linkText || "Открыть официальный источник" }] : [];
  const linkLabels = [...sources.map(({ label }) => label), answer.action?.label].filter(Boolean);
  return {
    ...answer,
    sources,
    spokenText: sanitizeSpokenText(answer.spokenText || answer.text, linkLabels),
  };
}

export function shouldKeepVerifiedAnswer(answer) {
  return Boolean(answer?.kind && answer.kind !== "fallback");
}
