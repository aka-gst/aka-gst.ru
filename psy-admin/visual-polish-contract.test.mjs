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
  assert.doesNotMatch(buildSource, /\.t-rec_pt_150/);
  assert.match(buildSource, /grid-template-columns:repeat\(3/);
  assert.doesNotMatch(buildSource, /#rec3723957301\{display:none!important\}/);
  assert.match(buildSource, /#rec1773910081 \.t-btnflex\{[^}]*font-size:18px/s);
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

test("the mobile helper stays compact at the safe lower edge", () => {
  assert.match(widgetCss, /\.psy-widget-trigger\s*\{[^}]*bottom:\s*max\(16px,[^}]*width:\s*52px\s*!important[^}]*height:\s*52px\s*!important/s);
  assert.match(widgetCss, /\.psy-widget-trigger > span:last-child\s*\{[^}]*display:\s*none\s*!important/s);
});

test("the mobile hero sizes the inline Tilda child instead of splitting Russian words", () => {
  assert.match(buildSource, /#rec908825596 \.t1120__title>div\s*\{[^}]*font-size:\s*32px[^}]*overflow-wrap:\s*normal/s);
});

test("schedule body links cannot fall back to the old orange accent", () => {
  assert.match(buildSource, /\.t522__title a\s*\{[^}]*color:\s*#1f00a6!important/s);
});

test("the same polish layer reaches the live Tilda host through the installed widget", () => {
  assert.match(widgetCss, /data-orion-host-polish/);
  assert.match(widgetCss, /\.t-btn:hover/);
  assert.match(widgetCss, /\.t522__title a/);
  assert.match(widgetSource, /applyHostPagePolish/);
  assert.match(widgetSource, /orion-polish-homebar/);
  assert.match(widgetSource, /Листайте отзывы/);
  assert.match(widgetCss, /\.orion-polish-homebar \{ box-sizing: border-box/);
  assert.match(widgetSource, /\.orion-review-hint/);
  assert.match(widgetSource, /element\.remove\(\)/);
});

test("live homepage repair is narrow and preserves the original page rhythm", () => {
  assert.doesNotMatch(widgetCss, /html\[data-orion-host-polish\] \.t-rec_pt_/);
  assert.match(widgetCss, /#rec1773853311 \.t522 > \.t-container[^}]+display:\s*grid/s);
  assert.match(widgetCss, /#rec908825596 \.t1120__title[\s\S]*opacity:\s*1\s*!important/);
  assert.doesNotMatch(widgetCss, /#rec3723957301\s*\{\s*display:\s*none\s*!important/);
  assert.match(widgetCss, /#rec623335436,[\s\S]*#rec401787399,[\s\S]*#rec605382040,[\s\S]*#rec282808065\s*\{[^}]*display:\s*none\s*!important/s);
  assert.match(widgetCss, /#rec908825596 \.t-cover[^}]*min-height:\s*calc\(100svh - 60px\)/s);
  assert.match(widgetCss, /#rec282570514 \.t396__artboard[^{]*\{[^}]*height:\s*620px/s);
  assert.match(widgetCss, /#rec282570514 \[data-elem-id="1613643387114"\][^}]*text-align:\s*center/s);
  assert.match(widgetCss, /#rec1773910081 \.t-btnflex[^}]*min-height:\s*60px[^}]*font-size:\s*18px/s);
  assert.match(widgetCss, /#rec1773910081\s*\{[^}]*padding-top:\s*24px[^}]*padding-bottom:\s*32px/s);
  assert.match(widgetCss, /#rec729134751\s*\{[^}]*padding-top:\s*32px[^}]*padding-bottom:\s*48px/s);
  assert.match(widgetCss, /#rec729134751 \.t-section__title\s*\{[^}]*margin-bottom:\s*40px/s);
  assert.match(widgetCss, /#rec401577081\s*\{[^}]*padding-bottom:\s*24px/s);
  assert.match(widgetCss, /#rec283510213\s*\{[^}]*display:\s*none\s*!important/s);
  assert.match(widgetCss, /#rec288715564\s*\{[^}]*padding-top:\s*40px[^}]*padding-bottom:\s*24px/s);
  assert.match(widgetCss, /#rec288715564 \.t-feed__buttons-wrapper\s*\{[^}]*margin-top:\s*28px/s);
  assert.match(widgetCss, /#rec283637376 \.t-container\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*repeat\(3/s);
  assert.match(widgetCss, /#rec283637376 \.t-container::before,[\s\S]*#rec283637376 \.t-container::after\s*\{[^}]*display:\s*none/s);
  assert.match(widgetCss, /#rec283637377 \.t345-content\s*\{[^}]*display:\s*flex[^}]*justify-content:\s*space-between/s);
  assert.match(widgetCss, /@media \(max-width:767px\)[\s\S]*#rec1773853311 \.t522__personimgwrapper,[\s\S]*width:\s*140px[^}]*height:\s*140px[^}]*border-radius:\s*50%/s);
  assert.match(widgetCss, /#rec908825596 \.orion-hero-left-action[^}]*position:\s*absolute/s);
  assert.match(widgetSource, /scheduleButton\.parentElement !== leftAction/);
  assert.match(widgetCss, /\.orion-review-hint\s*\{\s*display:\s*none\s*!important/);
  assert.match(widgetCss, /@media \(max-width:767px\)[^{]*\{[\s\S]*#rec282570514 \.t396__artboard[^{]*\{[^}]*height:\s*830px/s);
  assert.match(widgetCss, /\[data-elem-id="1497357188037"\][^}]*width:\s*calc\(100% - 40px\)/s);
});
