import assert from "node:assert/strict";
import test from "node:test";

import * as widgetContract from "./widget-contract.js";
import { resolveVoiceClip } from "./voice-bank.js";

test("speech never receives Unicode slashes, quotes, or encoded markup", () => {
  const spoken = widgetContract.sanitizeSpokenText('Ближайшее — «Программа» ＼ ﹨ ∖ &#92; &bsol; &#x5c; &quot;текст&quot;.');
  assert.equal(spoken, 'Ближайшее — Программа текст.');
});

test("spoken reply resolves to prerecorded voice A instead of browser TTS", () => {
  assert.equal("configureSpeechUtterance" in widgetContract, false);
  const clip = resolveVoiceClip({
    question: "Какие мероприятия ближайшие?",
    answer: widgetContract.routeWidgetQuestion("Какие мероприятия ближайшие?"),
  });
  assert.equal(clip.id, "prepared-01");
  assert.match(clip.src, /\/audio\/voice-a\/prepared-01\.wav/);
});
