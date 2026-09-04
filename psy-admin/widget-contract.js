import { quickQuestions } from "./content.js";
import { answerQuestion } from "./router.js?v=psy-widget-20260904-16";

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
  // Пока Qwen3-TTS не поднят отдельным сервисом, не подменяем обещанный
  // естественный голос системной браузерной озвучкой.
  const outputAvailable = false;
  return {
    ...presentation,
    voice: {
      inputAvailable,
      outputAvailable,
      fallbackMessage: inputAvailable
        ? (outputAvailable ? "" : "Ответ пока придёт коротким текстом: выбираем естественный голос A, Б или В.")
        : "Голосовой ввод недоступен в этом браузере. Напишите вопрос текстом.",
      shouldSpeakReply: false,
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

export function demoHandoffOutcome() {
  return {
    kind: "demo-only",
    networkRequest: null,
    message: "Демо: заявка никуда не отправляется. Канал связи с центром ещё не утверждён.",
  };
}

// Последний барьер перед будущим TTS: ответ должен остаться кратким.
// Вопрос пользователя никуда не отправляется.
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
