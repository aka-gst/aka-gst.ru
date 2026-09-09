import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("./", import.meta.url);
const buildSource = await readFile(new URL("tools/build-orion-demo.mjs", root), "utf8");
const home = await readFile(new URL("index.html", root), "utf8");
const education = await readFile(new URL("pweducation/index.html", root), "utf8");
const widgetCss = await readFile(new URL("widget.css", root), "utf8");
const widgetSource = await readFile(new URL("psy-widget.js", root), "utf8");

test("the generated site carries one deliberate Orion polish layer", () => {
  assert.match(buildSource, /data-orion-polish/);
  assert.match(buildSource, /\.t-rec_pt_150/);
  assert.match(buildSource, /\.t-btn:hover/);
  assert.match(buildSource, /\.t-card__btn-wrapper/);
});

test("reviews use the short heading requested by the owner", () => {
  assert.doesNotMatch(home, /Отзывы клиентов|Листайте отзывы/);
  assert.match(home, />Отзывы</);
});

test("non-critical images are decoded and loaded without blocking the first screen", () => {
  assert.match(home, /loading="lazy" decoding="async"/);
  assert.match(education, /loading="lazy" decoding="async"/);
});

test("every generated inner page retains a route back to the home page", async () => {
  for (const path of ["schedule", "psycluborion", "pweducation", "consultation", "services", "programs"]) {
    const html = await readFile(new URL(`${path}/index.html`, root), "utf8");
    assert.match(html, /href=["']\/psy-admin\//, `${path} has no local home route`);
  }
});

test("the mobile helper clears the persistent demo notice", () => {
  assert.match(widgetCss, /\.psy-widget-trigger\s*\{[^}]*bottom:\s*96px/s);
});

test("the mobile hero sizes the inline Tilda child instead of splitting Russian words", () => {
  assert.match(buildSource, /#rec908825596 \.t1120__title>div\s*\{[^}]*font-size:\s*32px[^}]*overflow-wrap:\s*normal/s);
});

test("schedule body links cannot fall back to the old orange accent", () => {
  assert.match(buildSource, /\.t522__title a\s*\{[^}]*color:\s*#1f00a6!important/s);
});

test("the same polish layer reaches the live Tilda host through the installed widget", () => {
  assert.match(widgetCss, /data-orion-host-polish/);
  assert.match(widgetCss, /\.t-rec_pt_150/);
  assert.match(widgetCss, /\.t-btn:hover/);
  assert.match(widgetCss, /\.t522__title a/);
  assert.match(widgetSource, /applyHostPagePolish/);
  assert.match(widgetSource, /orion-polish-homebar/);
  assert.match(widgetSource, /Листайте отзывы/);
  assert.match(widgetCss, /\.orion-polish-homebar \{ box-sizing: border-box/);
});
