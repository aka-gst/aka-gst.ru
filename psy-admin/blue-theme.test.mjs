import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";
const root = resolve(new URL("..", import.meta.url).pathname);
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const types = new Map([[".css", "text/css"], [".js", "text/javascript"]]);

function dumpDom(url, profile) {
  return new Promise((resolveDump, rejectDump) => {
    const child = spawn(chrome, [
      "--headless=new",
      "--disable-background-networking",
      "--disable-gpu",
      "--no-first-run",
      `--user-data-dir=${profile}`,
      "--window-size=1280,800",
      "--virtual-time-budget=1800",
      "--dump-dom",
      url,
    ]);
    let stdout = "";
    let complete = false;
    const deadline = setTimeout(() => {
      child.kill("SIGTERM");
      rejectDump(new Error("Chrome не отдал DOM за 10 секунд"));
    }, 10_000);
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (!stdout.includes("</html>")) return;
      complete = true;
      clearTimeout(deadline);
      child.kill("SIGTERM");
    });
    child.on("close", () => {
      if (complete) resolveDump(stdout);
    });
    child.on("error", (error) => {
      clearTimeout(deadline);
      rejectDump(error);
    });
  });
}

const fixture = `<!doctype html><meta charset="utf-8">
<script type="module" src="/psy-admin/psy-widget.js"></script>
<script>
  const timer = setInterval(() => {
    const trigger = document.querySelector('.psy-widget-trigger');
    const primary = document.querySelector('.psy-widget-handoff button[type="submit"]');
    const secondary = document.querySelector('.psy-widget-handoff-toggle');
    const submit = document.querySelector('.psy-widget-form button[type="submit"]');
    if (!trigger || !primary || !secondary || !submit || !document.styleSheets.length) return;
    clearInterval(timer);
    document.querySelector('.psy-widget-panel').hidden = false;
    document.querySelector('.psy-widget-handoff').hidden = false;
    const read = (node) => {
      const style = getComputedStyle(node);
      return { background: style.backgroundColor, color: style.color, height: node.getBoundingClientRect().height };
    };
    trigger.click();
    const input = document.querySelector('#psy-widget-question');
    input.value = 'аренда кабинета';
    document.querySelector('.psy-widget-form').requestSubmit();
    const answerTimer = setInterval(() => {
      const followUp = document.querySelector('.psy-widget-followup-actions');
      if (!followUp) return;
      clearInterval(answerTimer);
      followUp.querySelector('[data-support-action="booking"]').click();
      const result = {
        trigger: read(trigger), primary: read(primary), secondary: read(secondary), submit: read(submit),
        paymentCount: document.querySelectorAll('.psy-widget-payment').length,
        followUpText: followUp.closest('.psy-widget-message').textContent,
        paymentHref: followUp.querySelector('[data-support-action="payment"]').href,
        handoffVisible: !document.querySelector('.psy-widget-handoff').hidden,
        handoffKind: document.querySelector('[name="requestKind"]').value,
      };
      document.body.dataset.result = JSON.stringify(result);
    }, 20);
  }, 20);
</script>`;

const server = createServer(async (request, response) => {
  if (request.url === "/fixture") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(fixture);
    return;
  }
  try {
    const path = resolve(root, `.${request.url.split("?")[0]}`);
    if (!path.startsWith(root)) throw new Error("outside root");
    const body = await readFile(path);
    response.writeHead(200, { "content-type": types.get(extname(path)) || "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
});

await new Promise((resolveReady) => server.listen(0, "127.0.0.1", resolveReady));
const profile = await mkdtemp(join(tmpdir(), "psy-widget-blue-test-"));
try {
  const stdout = await dumpDom(`http://127.0.0.1:${server.address().port}/fixture`, profile);
  const encoded = stdout.match(/data-result="([^"]+)"/)?.[1]
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&");
  assert.ok(encoded, "виджет должен загрузиться и отдать вычисленные стили");
  const result = JSON.parse(encoded);
  for (const name of ["trigger", "primary", "submit"]) {
    assert.equal(result[name].background, "rgb(31, 0, 166)", `${name} должен быть синим Orion`);
    assert.equal(result[name].color, "rgb(255, 255, 255)", `${name} должен иметь белый текст`);
    assert.ok(result[name].height >= 44, `${name} должен оставаться не ниже 44px`);
  }
  assert.equal(result.secondary.background, "rgb(255, 255, 255)", "вторичная кнопка должна быть белой");
  assert.equal(result.secondary.color, "rgb(31, 0, 166)", "вторичная кнопка должна иметь синий текст");
  assert.ok(result.secondary.height >= 44, "вторичная кнопка должна оставаться не ниже 44px");
  assert.equal(result.paymentCount, 0, "помощник-поисковик не должен сам показывать кнопку оплаты");
  assert.match(result.followUpText, /Что показать дальше: программу, расписание или помочь записаться\?/);
  assert.match(result.followUpText, /Помочь записаться/);
  assert.match(result.followUpText, /Помочь оплатить/);
  assert.match(result.paymentHref, /orion-center\.ru\/payment/);
  assert.equal(result.handoffVisible, true, "запись должна открываться только после выбора человека");
  assert.equal(result.handoffKind, "rental", "форма должна учитывать тему текущего ответа");
  console.log("PsyAdmin: сине-белая тема кнопок видима в браузере");
} finally {
  server.close();
  await rm(profile, { recursive: true, force: true });
}
