import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { запуститьChrome, подключиться, sleep } from "../tools/igrat.mjs";

const root = resolve(new URL("..", import.meta.url).pathname);
const types = new Map([
  [".css", "text/css"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript"],
  [".svg", "image/svg+xml"],
]);

const server = createServer(async (request, response) => {
  try {
    const cleanPath = request.url.split("?")[0];
    const relativePath = cleanPath.endsWith("/") ? `${cleanPath}index.html` : cleanPath;
    const path = resolve(root, `.${relativePath}`);
    if (!path.startsWith(root)) throw new Error("outside root");
    const body = await readFile(path);
    response.writeHead(200, { "content-type": types.get(extname(path)) || "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
});

await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
const baseUrl = `http://127.0.0.1:${server.address().port}`;

try {
  for (const [width, height, mobile, port] of [
    [1280, 900, false, 9440],
    [390, 844, true, 9441],
  ]) {
    const chrome = запуститьChrome(port, `${Math.max(width, 500)},${height}`);
    let send;
    try {
      send = await подключиться(port);
      await send("Emulation.setDeviceMetricsOverride", {
        width,
        height,
        deviceScaleFactor: 1,
        mobile,
      });
      await send("Page.navigate", { url: `${baseUrl}/psy-admin/` });
      await sleep(5_500);
      const result = await send("Runtime.evaluate", {
        returnByValue: true,
        expression: `(() => {
          const news = document.querySelector('#rec288715564');
          const newsRect = news.getBoundingClientRect();
          const description = document.querySelector('#rec1773853311 .t-section__descr').getBoundingClientRect();
          const heroTitle = document.querySelector('#rec908825596 .t1120__title');
          const heroTitleStyle = getComputedStyle(heroTitle);
          const schedule = document.querySelector('#rec1773853311').getBoundingClientRect();
          const scheduleRows = [...document.querySelectorAll('#rec1773853311 .t522__row')]
            .map((row) => row.getBoundingClientRect())
            .map((rect) => ({ top: Math.round(rect.top), left: Math.round(rect.left), width: Math.round(rect.width), height: Math.round(rect.height) }));
          const directions = document.querySelector('#rec282570514 .t396__artboard').getBoundingClientRect();
          return {
            viewportWidth: innerWidth,
            documentWidth: document.documentElement.scrollWidth,
            widgetScript: document.querySelector('script[src*="psy-widget.js"]')?.src || '',
            newsHeight: Math.round(newsRect.height),
            newsPosts: news.querySelectorAll('.t-feed__post, .js-feed-container > li').length,
            scheduleGap: Math.round(scheduleRows[0].top - description.bottom),
            heroTitleOpacity: Number(heroTitleStyle.opacity),
            heroTitleVisibility: heroTitleStyle.visibility,
            scheduleHeight: Math.round(schedule.height),
            scheduleRows,
            directionsHeight: Math.round(directions.height),
          };
        })()`,
      });
      const metrics = result.result.value;
      console.log(JSON.stringify({ width, ...metrics }));
      assert.equal(metrics.newsPosts, 0, "локальная копия не должна выдумывать новости");
      assert.match(metrics.widgetScript, /orion-blue-20260908/, "страница должна обойти старый кэш виджета");
      assert.ok(metrics.newsHeight <= 1, `пустой блок новостей не должен занимать ${metrics.newsHeight}px`);
      assert.ok(metrics.scheduleGap >= 16, `линия расписания должна идти ниже текста, сейчас зазор ${metrics.scheduleGap}px`);
      assert.equal(metrics.documentWidth, metrics.viewportWidth, `страница не должна распирать viewport ${width}px`);
      assert.equal(metrics.heroTitleVisibility, "visible", "заголовок героя не должен ждать анимацию Tilda");
      assert.equal(metrics.heroTitleOpacity, 1, "заголовок героя должен быть виден с первого кадра");
      if (!mobile) {
        assert.ok(metrics.scheduleHeight <= 760, `расписание должно помещаться в экран, сейчас ${metrics.scheduleHeight}px`);
        assert.ok(Math.max(...metrics.scheduleRows.map((row) => row.top)) - Math.min(...metrics.scheduleRows.map((row) => row.top)) <= 8,
          `три вида расписания должны стоять в одном ряду: ${JSON.stringify(metrics.scheduleRows)}`);
        assert.ok(metrics.directionsHeight <= 650, `направления не должны оставлять экран пустоты, сейчас ${metrics.directionsHeight}px`);
      }
      console.log(`${width}px: новости ${metrics.newsHeight}px, зазор до линии ${metrics.scheduleGap}px`);
    } finally {
      send?.закрыть();
      chrome.kill("SIGTERM");
    }
  }
} finally {
  server.close();
}

console.log("PsyAdmin: пустая лента схлопнута, линия не пересекает текст");
