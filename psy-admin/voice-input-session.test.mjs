import assert from "node:assert/strict";
import test from "node:test";

import * as widgetContract from "./widget-contract.js";

test("second microphone tap submits one question accumulated across recognition restarts", () => {
  assert.equal(typeof widgetContract.createVoiceInputSession, "function");
  assert.equal(typeof widgetContract.appendVoiceInputResult, "function");
  assert.equal(typeof widgetContract.finishVoiceInputSession, "function");

  let session = widgetContract.createVoiceInputSession();
  session = widgetContract.appendVoiceInputResult(session, {
    finalFragments: ["Какие мероприятия"],
    interimFragment: "",
  });

  // Browser SpeechRecognition `end` only restarts recognition. It must not
  // finish, submit or clear this production session.
  assert.equal(session.text, "Какие мероприятия");
  assert.equal(session.submitted, false);

  session = widgetContract.appendVoiceInputResult(session, {
    finalFragments: ["ближайшие"],
    interimFragment: "",
  });
  const finished = widgetContract.finishVoiceInputSession(session);

  assert.equal(finished.question, "Какие мероприятия ближайшие");
  assert.deepEqual(finished.session, widgetContract.createVoiceInputSession());
});

test("empty second microphone tap does not create a submission", () => {
  const finished = widgetContract.finishVoiceInputSession(widgetContract.createVoiceInputSession());
  assert.equal(finished.question, "");
  assert.equal(finished.session.submitted, false);
});
