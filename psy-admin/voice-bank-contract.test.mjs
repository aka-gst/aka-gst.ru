import assert from "node:assert/strict";
import { access, readdir } from "node:fs/promises";
import test from "node:test";

import { resolveVoiceClip, voiceBankEntries } from "./voice-bank.js";
import { preparedQuestionCases, routeWidgetQuestion } from "./widget-contract.js";

test("all prepared answers resolve to one of 41 exact voice A clips", () => {
  const resolved = preparedQuestionCases().map(({ question }) => {
    const answer = routeWidgetQuestion(question);
    return resolveVoiceClip({ question, answer });
  });

  assert.equal(new Set(resolved.map(({ id }) => id)).size, 41);
  assert.ok(resolved.every(({ id, exact, src }) => id.startsWith("prepared-") && exact === true && /\/voice-a\/prepared-\d{2}\.wav/.test(src)));
});

test("a nearby freeform question keeps dynamic text but selects a short complete topic phrase", () => {
  const clip = resolveVoiceClip({
    question: "А если я захочу написать вам в телеграм завтра?",
    answer: { kind: "route", text: "Любой динамический текст ответа сервера" },
  });

  assert.equal(clip.id, "generic-contacts");
  assert.equal(clip.exact, false);
  assert.match(clip.spokenText, /контакт/i);
  assert.match(clip.spokenText, /[.!?]$/);
});

test("unknown freeform questions use a neutral complete phrase without system TTS", () => {
  const clip = resolveVoiceClip({
    question: "А можно подробнее?",
    answer: { kind: "route", text: "Подробный динамический ответ остаётся в чате" },
  });

  assert.equal(clip.id, "generic-general");
  assert.equal(clip.exact, false);
  assert.match(clip.spokenText, /сообщении/i);
});

test("voice bank contains only safe complete phrases and never a recorded variant G", () => {
  assert.equal(voiceBankEntries.filter(({ id }) => id.startsWith("prepared-")).length, 41);
  assert.equal(voiceBankEntries.some(({ id }) => /(?:variant-?g|psyadmin-g)/i.test(id)), false);
  for (const entry of voiceBankEntries) {
    assert.match(entry.spokenText, /[.!?]$/, `${entry.id} must be a complete phrase`);
    assert.doesNotMatch(entry.spokenText, /backslash|б[еэ]ксл[еэ]ш|обратн(?:ый|ая)\s+(?:сл[еэ]ш|косая)|[\\/]/iu, `${entry.id} must not contain slash speech`);
  }
});

test("every declared voice A clip exists and the bank contains exactly 51 WAV files", async () => {
  const directory = new URL("./audio/voice-a/", import.meta.url);
  const wavFiles = (await readdir(directory)).filter((name) => name.endsWith(".wav"));
  assert.equal(wavFiles.length, 51);
  assert.equal(voiceBankEntries.length, 51);
  for (const entry of voiceBankEntries) {
    const filename = new URL(entry.src, new URL("./voice-bank.js", import.meta.url)).pathname.split("/").pop().split("?")[0];
    await access(new URL(filename, directory));
  }
});
