import { quickQuestions } from "./content.js?v=psy-widget-20260913-23";
import { answerQuestion } from "./router.js?v=psy-widget-20260913-23";

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

export function createVoiceInputSession() {
  return { finalText: "", interimText: "", text: "", submitted: false };
}

export function appendVoiceInputResult(session, { finalFragments = [], interimFragment = "" } = {}) {
  const finalText = [session?.finalText, ...finalFragments]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  const interimText = String(interimFragment || "").replace(/\s+/g, " ").trim();
  return {
    finalText,
    interimText,
    text: `${finalText} ${interimText}`.replace(/\s+/g, " ").trim(),
    submitted: false,
  };
}

export function finishVoiceInputSession(session) {
  return {
    question: String(session?.text || "").replace(/\s+/g, " ").trim(),
    session: createVoiceInputSession(),
  };
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
  let text = String(rawText || "").normalize("NFKC");
  // Decode before stripping markup: otherwise &#92; becomes pronounceable "92".
  for (let depth = 0; depth < 3; depth += 1) {
    text = text.replace(/&amp;/gi, "&").replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (_, code) => {
      const point = code[0].toLowerCase() === "x" ? parseInt(code.slice(1), 16) : Number(code);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : " ";
    }).replace(/&[a-z]+;/gi, " ");
  }
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
    // Only prose reaches TTS, never quote/slash variants or formatting symbols.
    .replace(/[^\p{L}\p{M}\p{N}\s.,!?…:;—–-]/gu, " ")
    .replace(/\s+([.,!?…:;])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  const sentences = text.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g) || [];
  return (sentences[0] || text).trim().slice(0, 160);
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

export function routeWidgetQuestion(question, context = {}) {
  const answer = answerQuestion(question, context);
  const sources = answer.url ? [{ url: answer.url, label: answer.linkText || "Открыть официальный источник" }] : [];
  const linkLabels = [...sources.map(({ label }) => label), answer.action?.label].filter(Boolean);
  return {
    ...answer,
    sources,
    spokenText: sanitizeSpokenText(answer.spokenText || answer.text, linkLabels),
  };
}

export function nextConversationContext(answer) {
  return answer?.context || {};
}

export function shouldKeepVerifiedAnswer(answer) {
  return Boolean(answer?.kind && answer.kind !== "fallback");
}
