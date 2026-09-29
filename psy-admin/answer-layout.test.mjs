import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = await readFile(new URL("./widget.css", import.meta.url), "utf8");

function declaration(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] || "";
}

test("event source, action and continuation have separate readable rows", () => {
  const links = declaration(".psy-widget-links");
  const anchors = declaration(".psy-widget-links > a");
  const followUp = declaration(".psy-widget-links + [data-supportive-followup]");

  const gap = Number(links.match(/gap:\s*(\d+)px/)?.[1] || 0);
  const followUpMargin = Number(followUp.match(/margin-top:\s*(\d+)px/)?.[1] || 0);

  assert.ok(gap >= 12, `source/action gap is ${gap}px`);
  assert.match(anchors, /display:\s*block/);
  assert.ok(followUpMargin >= 14, `action/follow-up margin is ${followUpMargin}px`);
});
