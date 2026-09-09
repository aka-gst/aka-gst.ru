import assert from "node:assert/strict";
import test from "node:test";

import * as widgetContract from "./widget-contract.js";

test("spoken reply leaves browser voice selection automatic", () => {
  assert.equal(typeof widgetContract.configureSpeechUtterance, "function");

  const utterance = { lang: "", rate: 1, voice: null };
  const configured = widgetContract.configureSpeechUtterance(utterance);

  assert.equal(configured, utterance);
  assert.equal(configured.lang, "ru-RU");
  assert.equal(configured.rate, 0.96);
  assert.equal(configured.voice, null);
});
