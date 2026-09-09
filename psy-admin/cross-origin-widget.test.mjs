import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import * as router from "./router.js";

const widgetScript = "https://aka-gst.ru/psy-admin/psy-widget.js?v=psy-widget-20260909-14";
const embeddingPage = "https://orion-center.ru/?incident=iphone-booking-20260909";
const widgetSource = readFileSync(new URL("./psy-widget.js", import.meta.url), "utf8");
const widgetCss = readFileSync(new URL("./widget.css", import.meta.url), "utf8");

test("booking links resolve from the loaded widget script, not the embedding page", () => {
  assert.equal(typeof router.resolveWidgetPublicUrl, "function", "widget URL resolver is missing");
  for (const kind of ["specialist", "seminar", "rental"]) {
    const relative = `/psy-admin/booking/?kind=${kind}`;
    assert.equal(
      router.resolveWidgetPublicUrl(relative, widgetScript),
      `https://aka-gst.ru/psy-admin/booking/?kind=${kind}`,
    );
    assert.notEqual(router.resolveWidgetPublicUrl(relative, widgetScript), new URL(relative, embeddingPage).href);
  }
});

test("ordinary specialist, seminar and rental anchors emit script-host URLs", () => {
  const emitted = ["specialist", "seminar", "rental"]
    .map((kind) => `<a href="${router.resolveWidgetPublicUrl(`/psy-admin/booking/?kind=${kind}`, widgetScript)}">${kind}</a>`)
    .join("");
  for (const kind of ["specialist", "seminar", "rental"]) {
    assert.match(emitted, new RegExp(`href="https://aka-gst\\.ru/psy-admin/booking/\\?kind=${kind}"`));
  }
  assert.doesNotMatch(emitted, /orion-center\.ru\/psy-admin\/booking/);
});

test("widget copy and chat geometry match the visible Orion contract", () => {
  assert.match(widgetSource, /Ответ помощника будет озвучен<\/span>/);
  assert.doesNotMatch(widgetSource, /Ответ помощника будет озвучен\.<\/span>/);
  assert.match(widgetCss, /\.psy-widget-message\.assistant\s*\{[^}]*justify-self:\s*start/s);
  assert.match(widgetCss, /\.psy-widget-message\.user\s*\{[^}]*justify-self:\s*end/s);
  assert.match(widgetCss, /\.psy-widget-links \.psy-widget-action\s*\{[^}]*min-height:\s*44px[^}]*background:\s*var\(--psy-widget-primary\)[^}]*color:\s*#fff/s);
});

test("the nearest-event CTA follows the same cross-origin contract", () => {
  const answer = router.answerQuestion("Какие мероприятия ближайшие?");
  assert.equal(answer.action?.url, "/psy-admin/booking/?kind=seminar");
  assert.equal(
    router.resolveWidgetPublicUrl(answer.action.url, widgetScript),
    "https://aka-gst.ru/psy-admin/booking/?kind=seminar",
  );
});
