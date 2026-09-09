import assert from "node:assert/strict";
import test from "node:test";

import * as router from "./router.js";
import * as widgetContract from "./widget-contract.js";

test("short follow-up keeps the nearest published event as its subject", () => {
  const nearest = router.answerQuestion("Какие мероприятия ближайшие?");

  assert.deepEqual(nearest.context, { topic: "next-published-event" });
  assert.equal(nearest.followUp, "Хотите узнать формат этой программы или оставить заявку?");

  const format = router.answerQuestion("формат", nearest.context);
  assert.equal(format.title, "Формат ближайшей программы");
  assert.equal(
    format.text,
    "Программа «Теория и практика работы с измененными и экстремальными состояниями сознания» проходит онлайн.",
  );
  assert.equal(format.url, "https://orion-center.ru/alteredstates-online");
  assert.deepEqual(format.context, nearest.context);
});

test("an unrelated full question replaces the old event subject", () => {
  const nearest = router.answerQuestion("Какие мероприятия ближайшие?");
  const club = router.answerQuestion("Сколько стоит психологический клуб?", nearest.context);

  assert.match(club.text, /1\s*000\s*(?:руб|₽)/i);
  assert.equal(club.context, undefined);
});

test("widget contract carries the event subject across messages", () => {
  assert.equal(typeof widgetContract.nextConversationContext, "function");
  const nearest = widgetContract.routeWidgetQuestion("Какие мероприятия ближайшие?");
  const context = widgetContract.nextConversationContext(nearest);
  const format = widgetContract.routeWidgetQuestion("формат", context);

  assert.match(format.text, /проходит онлайн/i);
  assert.deepEqual(widgetContract.nextConversationContext(format), context);
});

test("program and registration follow-ups answer about the same event", () => {
  const nearest = router.answerQuestion("Какие мероприятия ближайшие?");
  const program = router.answerQuestion("программа", nearest.context);
  const registration = router.answerQuestion("способ записи", nearest.context);

  assert.match(program.text, /Теория и практика работы с измененными и экстремальными состояниями сознания/);
  assert.match(program.text, /11 занятий/);
  assert.equal(program.url, "https://orion-center.ru/alteredstates-online");
  assert.match(registration.text, /форм[ае] помощника/i);
  assert.equal(registration.action?.url, "/psy-admin/booking/?kind=seminar");
});
