import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  auditPageReleases,
  auditRelease,
  compareReleaseVersions,
  extractRelease,
  fetchTextWithRetry,
} from "./tools/release-guard.mjs";

const release = "psy-widget-20260905-02";
const widget = `<script type="module" src="/psy-admin/widget-contract.js?v=${release}"></script>
const stylesheet = new URL("./widget.css?v=${release}", import.meta.url).href;
const preparedQuestionCases = [];
<button class="psy-widget-evaluation-toggle" aria-expanded="false">Проверить помощника</button>
<div id="psy-widget-evaluation-content" hidden></div>`;
const contract = `import { answerQuestion } from "./router.js?v=${release}";`;
const css = `.psy-widget-panel { width: min(520px, calc(100vw - 32px)); }
.psy-widget-actions { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }
@media (max-width: 620px) { .psy-widget-actions { grid-template-columns: repeat(2, minmax(0, 1fr)); } }`;
const pages = [
  "index.html",
  "consultation/index.html",
  "programs/index.html",
  "psycluborion/index.html",
  "pweducation/index.html",
  "schedule/index.html",
  "services/index.html",
].map((path) => ({ path, source: `<script type="module" src="/psy-admin/psy-widget.js?v=${release}"></script>` }));

assert.deepEqual(auditRelease({ release, widget, contract, css }), []);
assert.deepEqual(auditPageReleases({ release, pages }), []);
assert.match(
  auditRelease({ release, widget, contract, css: css.replace("520px", "360px") }).join("\n"),
  /520px/,
);
assert.match(
  auditRelease({ release, widget, contract, css: `${css}\n.psy-widget-panel { width: min(360px, calc(100vw - 32px)); }` }).join("\n"),
  /360px/,
);
assert.match(
  auditRelease({ release, widget: widget.replace(release, "psy-widget-20260903-15"), contract, css }).join("\n"),
  /метка ассетов/,
);
assert.match(
  auditRelease({
    release,
    widget: widget.replace(`widget.css?v=${release}`, "widget.css?v=psy-widget-20260903-15"),
    contract,
    css,
  }).join("\n"),
  /CSS/,
);
assert.match(
  auditRelease({ release, widget, contract: contract.replace(release, "psy-widget-20260903-15"), css }).join("\n"),
  /router/,
);
assert.match(
  auditPageReleases({
    release,
    pages: pages.map((page, index) => index === 0
      ? { ...page, source: page.source.replace(release, "psy-widget-20260903-15") }
      : page),
  }).join("\n"),
  /index.html/,
);
assert.equal(compareReleaseVersions("psy-widget-20260905-02", "psy-widget-20260904-17"), 1);
assert.equal(compareReleaseVersions("psy-widget-20260904-17", "psy-widget-20260905-02"), -1);
assert.equal(compareReleaseVersions(release, release), 0);
assert.equal(
  extractRelease(`<script type="module" src="/psy-admin/psy-widget.js?v=${release}"></script>`, "бой"),
  release,
);

let retryAttempts = 0;
const fetchedText = await fetchTextWithRetry("https://example.test/psy-admin/", {
  attempts: 3,
  timeoutMs: 20,
  fetchImpl: async () => {
    retryAttempts += 1;
    if (retryAttempts < 3) throw new Error("временный обрыв");
    return { ok: true, text: async () => "готово" };
  },
});
assert.equal(fetchedText, "готово");
assert.equal(retryAttempts, 3);

let timeoutAttempts = 0;
await assert.rejects(
  () => fetchTextWithRetry("https://example.test/psy-admin/", {
    attempts: 2,
    timeoutMs: 5,
    fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
      timeoutAttempts += 1;
      signal.addEventListener("abort", () => reject(new Error("превышен срок")), { once: true });
    }),
  }),
  /после 2 попыток/,
);
assert.equal(timeoutAttempts, 2);

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

const rootDirectory = dirname(psyAdminDirectory);
const mockBin = await mkdtemp(join(tmpdir(), "psy-admin-vylozhit-"));
const tracePath = join(mockBin, "trace.txt");
for (const [name, source] of Object.entries({
  node: "#!/bin/sh\nprintf 'node %s\\n' \"$*\" >> \"$TRACE\"\nexit 1\n",
  rsync: "#!/bin/sh\nprintf 'rsync\\n' >> \"$TRACE\"\nexit 0\n",
  curl: "#!/bin/sh\nprintf 'curl\\n' >> \"$TRACE\"\nprintf 'old bytes'\n",
})) {
  const path = join(mockBin, name);
  await writeFile(path, source);
  await chmod(path, 0o755);
}
function runVylozhit(args) {
  return new Promise((resolveRun) => {
    const child = spawn("sh", ["tools/vylozhit.sh", ...args], {
      cwd: rootDirectory,
      env: { ...process.env, PATH: `${mockBin}:${process.env.PATH}`, TRACE: tracePath },
    });
    child.on("close", (code) => resolveRun({ code }));
  });
}
const nestedVylozhitGuard = await runVylozhit(["psy-admin/index.html"]);
const nestedVylozhitTrace = await readFile(tracePath, "utf8");
await writeFile(tracePath, "");
const allVylozhitGuard = await runVylozhit(["--vse"]);
const allVylozhitTrace = await readFile(tracePath, "utf8");
await rm(mockBin, { recursive: true, force: true });
assert.equal(nestedVylozhitGuard.code, 1);
assert.match(nestedVylozhitTrace, /^node psy-admin\/tools\/release-guard\.mjs --live-base https:\/\/aka-gst\.ru/m);
assert.doesNotMatch(nestedVylozhitTrace, /rsync/);
assert.equal(allVylozhitGuard.code, 1);
assert.match(allVylozhitTrace, /^node psy-admin\/tools\/release-guard\.mjs --live-base https:\/\/aka-gst\.ru/m);
assert.doesNotMatch(allVylozhitTrace, /rsync/);

console.log("psy-admin release guard: valid, narrow and stale controls passed");
