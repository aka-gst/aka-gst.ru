import { quickQuestions } from "./content.js?v=psy-widget-20260908-02";
import { answerQuestion } from "./router.js?v=psy-widget-20260908-02";

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
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, "")
    .replace(/\b[\w.-]+\.(?:html?|php)\b/gi, "")
    .replace(/[\\/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const sentences = text.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g) || [];
  return (sentences[0] || text).trim().slice(0, 160);
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
