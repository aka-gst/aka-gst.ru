import assert from "node:assert/strict";
import test from "node:test";
import { resolveVoiceClip, voiceBankEntries } from "./voice-bank.js";

// Голос виджета: какая записанная фраза звучит на вопрос. null — записи нет,
// ответ читает голос браузера. Кризис — всегда своими словами, без заглушки.
const CASES = [
  ["Где вы находитесь?", "generic-location"],
  ["Где находится центр?", "generic-location"],
  ["Сколько стоит консультация?", "generic-payment"],
  ["Какая цена аренды?", "generic-payment"],
  ["Какие у вас специалисты?", "generic-specialists"],
  ["Нужен психолог", "generic-specialists"],
  ["Можно арендовать зал?", "generic-rental"],
  ["Как к вам записаться?", "generic-signup"],
  ["Что такое психологический клуб?", null],
  ["Какой у вас телефон?", "generic-contacts"],
  ["Какие ближайшие мероприятия?", "generic-schedule"],
  ["Мне очень плохо", null],
];

test("тема фразы — по вопросу, без ошибок на 12 вопросах", () => {
  const wrong = CASES.filter(([q, want]) => (resolveVoiceClip({ question: q, answer: { text: "Центр указывает адрес и цены." } })?.id ?? null) !== want)
    .map(([q, want]) => `${q} → ${resolveVoiceClip({ question: q, answer: { text: "Центр указывает адрес и цены." } })?.id ?? null} (ждали ${want})`);
  assert.deepEqual(wrong, []);
});

test("слово «центр» в ответе не делает фразу про оплату", () => {
  assert.equal(resolveVoiceClip({ question: "Где вы находитесь?", answer: { text: "Центр указывает адрес: Боткинская ул., д. 1." } })?.id, "generic-location");
});

test("кризисный ответ никогда не озвучивается общей фразой", () => {
  for (const q of ["Мне очень плохо, я не хочу жить", "Где вы находитесь? мне плохо", "Сколько стоит, я не хочу жить"]) {
    assert.equal(resolveVoiceClip({ question: q, answer: { kind: "crisis", text: "Если есть риск… позвоните 112." } }), null, q);
  }
});

test("тема не узнана — записи нет (читает голос браузера)", () => {
  assert.equal(resolveVoiceClip({ question: "Какая завтра погода?", answer: { text: "Точного ответа нет." } }), null);
});

test("подготовленный ответ звучит своей точной записью", () => {
  const exact = voiceBankEntries.find((e) => e.exact);
  assert.equal(resolveVoiceClip({ question: "что угодно", answer: { spokenText: exact.spokenText } }), exact);
});
