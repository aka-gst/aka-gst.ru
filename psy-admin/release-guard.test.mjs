import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { auditRelease, compareReleaseVersions, extractRelease } from "./tools/release-guard.mjs";

const release = "psy-widget-20260905-01";
const widget = `<script type="module" src="/psy-admin/widget-contract.js?v=${release}"></script>
const preparedQuestionCases = [];
<button class="psy-widget-evaluation-toggle" aria-expanded="false">Проверить помощника</button>
<div id="psy-widget-evaluation-content" hidden></div>`;
const css = `.psy-widget-panel { width: min(520px, calc(100vw - 32px)); }
.psy-widget-actions { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }
@media (max-width: 620px) { .psy-widget-actions { grid-template-columns: repeat(2, minmax(0, 1fr)); } }`;

assert.deepEqual(auditRelease({ release, widget, css }), []);
assert.match(
  auditRelease({ release, widget, css: css.replace("520px", "360px") }).join("\n"),
  /520px/,
);
assert.match(
  auditRelease({ release, widget, css: `${css}\n.psy-widget-panel { width: min(360px, calc(100vw - 32px)); }` }).join("\n"),
  /360px/,
);
assert.match(
  auditRelease({ release, widget: widget.replace(release, "psy-widget-20260903-15"), css }).join("\n"),
  /метка ассетов/,
);
assert.equal(compareReleaseVersions("psy-widget-20260905-01", "psy-widget-20260904-17"), 1);
assert.equal(compareReleaseVersions("psy-widget-20260904-17", "psy-widget-20260905-01"), -1);
assert.equal(compareReleaseVersions(release, release), 0);
assert.equal(
  extractRelease(`<script type="module" src="/psy-admin/psy-widget.js?v=${release}"></script>`, "бой"),
  release,
);

const psyAdminDirectory = dirname(fileURLToPath(import.meta.url));
const localGuard = await new Promise((resolveRun) => {
  const child = spawn(process.execPath, ["./tools/release-guard.mjs"], { cwd: psyAdminDirectory });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  child.on("close", (code) => resolveRun({ code, output }));
});
assert.equal(localGuard.code, 0, localGuard.output);
assert.match(localGuard.output, /локальная структура верна/);

console.log("psy-admin release guard: valid, narrow and stale controls passed");
