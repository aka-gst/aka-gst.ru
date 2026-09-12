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
      if (mobile) {
        await send("Network.setUserAgentOverride", {
          userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1",
          platform: "iPhone",
        });
      }
      await send("Page.navigate", { url: `${baseUrl}/psy-admin/` });
      await sleep(5_500);
      if (mobile) {
        await send("Runtime.evaluate", {
          expression: `(() => {
            const record = [...document.querySelectorAll('#t-header > .r')]
              .find((node) => node.querySelector('.tmenu-mobile')?.getBoundingClientRect().height > 0);
            record?.classList.add('t-rec_pt_15', 't-rec_pb_15');
          })()`,
        });
      }
      const result = await send("Runtime.evaluate", {
        returnByValue: true,
        expression: `(() => {
          const news = document.querySelector('#rec288715564');
          const newsRect = news.getBoundingClientRect();
          const description = document.querySelector('#rec1773853311 .t-section__descr').getBoundingClientRect();
          const heroTitle = document.querySelector('#rec908825596 .t1120__title');
          const heroTitleStyle = getComputedStyle(heroTitle);
          const hero = document.querySelector('#rec908825596').getBoundingClientRect();
          const heroTitleRect = heroTitle.getBoundingClientRect();
          const heroScheduleButton = document.querySelector('#rec908825596 .orion-hero-left-action .t-btnflex_type_button2');
          const heroRegisterButton = document.querySelector('#rec908825596 .t1120__buttons .t-btnflex_type_button');
          const heroScheduleButtonRect = heroScheduleButton?.getBoundingClientRect();
          const heroRegisterButtonRect = heroRegisterButton?.getBoundingClientRect();
          const schedule = document.querySelector('#rec1773853311').getBoundingClientRect();
          const scheduleRows = [...document.querySelectorAll('#rec1773853311 .t522__row')]
            .map((row) => row.getBoundingClientRect())
            .map((rect) => ({ top: Math.round(rect.top), left: Math.round(rect.left), width: Math.round(rect.width), height: Math.round(rect.height) }));
          const scheduleCards = [...document.querySelectorAll('#rec1773853311 .t522__row')].map((row) => {
            const circle = row.querySelector('.t522__personimgwrapper').getBoundingClientRect();
            const circleStyle = getComputedStyle(row.querySelector('.t522__personimgwrapper'));
            const imageStyle = getComputedStyle(row.querySelector('.t522__img'));
            const name = row.querySelector('.t522__persname').getBoundingClientRect();
            const caption = row.querySelector('.t522__title').getBoundingClientRect();
            return {
              circle: { width: circle.width, height: circle.height, radius: circleStyle.borderRadius, backgroundSize: imageStyle.backgroundSize },
              name: { top: name.top, height: name.height },
              caption: { top: caption.top, height: caption.height },
            };
          });
          const directions = document.querySelector('#rec282570514 .t396__artboard').getBoundingClientRect();
          const directionTitleIds = ['1613643387114', '1474906621455', '1690964264025', '1690967422558'];
          const directionButtonIds = ['1613643678385', '1613643795239', '1613643798757', '1690962575043'];
          const directionTitles = directionTitleIds.map((id) => document.querySelector('#rec282570514 [data-elem-id="' + id + '"]').getBoundingClientRect());
          const directionButtons = directionButtonIds.map((id) => document.querySelector('#rec282570514 [data-elem-id="' + id + '"]').getBoundingClientRect());
          const directionGaps = directionTitles.map((title, index) => Math.round(directionButtons[index].top - title.bottom));
          const trigger = document.querySelector('.psy-widget-trigger').getBoundingClientRect();
          const contactMarkers = [...document.querySelectorAll('#rec283637376 .t567__col-wrapper')].map((node) => ({
            imageDisplay: getComputedStyle(node.querySelector('.t567__img')).display,
            symbol: getComputedStyle(node, '::before').content,
          }));
          const mobileHeader = document.querySelector('#rec307228255');
          const mobileHeaderStyle = mobileHeader ? getComputedStyle(mobileHeader) : null;
          const visibleMobileMenuBars = [...document.querySelectorAll('#t-header .tmenu-mobile')]
            .filter((node) => node.getBoundingClientRect().height > 0).length;
          const visibleMobileMenuBar = [...document.querySelectorAll('#t-header .tmenu-mobile')]
            .find((node) => node.getBoundingClientRect().height > 0)?.getBoundingClientRect();
          const renderedHeader = document.querySelector('#t-header')?.getBoundingClientRect();
          const blankSpacers = ['rec623335436', 'rec401787399', 'rec605382040', 'rec282808065']
            .map((id) => Math.round(document.querySelector('#' + id).getBoundingClientRect().height));
          return {
            viewportWidth: innerWidth,
            documentWidth: document.documentElement.scrollWidth,
            widgetScript: document.querySelector('script[src*="psy-widget.js"]')?.src || '',
            newsHeight: Math.round(newsRect.height),
            newsPosts: news.querySelectorAll('.t-feed__post, .js-feed-container > li').length,
            scheduleGap: Math.round(scheduleRows[0].top - description.bottom),
            heroTitleOpacity: Number(heroTitleStyle.opacity),
            heroTitleVisibility: heroTitleStyle.visibility,
            heroTitleOffset: Math.round(heroTitleRect.top - hero.top),
            heroPaddingTop: getComputedStyle(document.querySelector('#rec908825596')).paddingTop,
            heroColumnTransform: getComputedStyle(heroTitle.closest('.t1120__col-left')).transform,
            heroScheduleParent: heroScheduleButton?.parentElement?.className || '',
            heroButtonTopDelta: heroScheduleButtonRect && heroRegisterButtonRect ? Math.round(Math.abs(heroScheduleButtonRect.top - heroRegisterButtonRect.top)) : null,
            partnerSpacerDisplay: getComputedStyle(document.querySelector('#rec283510213')).display,
            scheduleHeight: Math.round(schedule.height),
            scheduleRows,
            scheduleCards,
            directionsHeight: Math.round(directions.height),
            directionGaps,
            trigger: { width: Math.round(trigger.width), height: Math.round(trigger.height), bottom: Math.round(innerHeight - trigger.bottom) },
            contactMarkers,
            mobileHeaderBackground: mobileHeaderStyle?.backgroundColor || '',
            visibleMobileMenuBars,
            renderedHeader: renderedHeader ? { top: Math.round(renderedHeader.top), height: Math.round(renderedHeader.height) } : null,
            visibleMobileMenuBar: visibleMobileMenuBar ? { top: Math.round(visibleMobileMenuBar.top), height: Math.round(visibleMobileMenuBar.height) } : null,
            heroTop: Math.round(hero.top),
            blankSpacers,
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
      assert.deepEqual(metrics.blankSpacers, [0, 0, 0, 0], `пустые Tilda-секции должны быть схлопнуты: ${metrics.blankSpacers}`);
      assert.equal(metrics.heroTitleVisibility, "visible", "заголовок героя не должен ждать анимацию Tilda");
      assert.equal(metrics.heroTitleOpacity, 1, "заголовок героя должен быть виден с первого кадра");
      if (!mobile) {
        assert.match(metrics.heroColumnTransform, /matrix\([^)]*, -96\)$/, `левый текст должен иметь заданный подъём: ${metrics.heroColumnTransform}`);
        assert.ok(metrics.heroTitleOffset <= 120, `левый текст первого экрана должен быть поднят, сейчас отступ ${metrics.heroTitleOffset}px`);
        assert.match(metrics.heroScheduleParent, /orion-hero-left-action/, "кнопка расписания должна находиться под левым заголовком");
        assert.ok(metrics.heroButtonTopDelta <= 2, `кнопки первого экрана должны стоять на одной высоте, разбежка ${metrics.heroButtonTopDelta}px`);
        assert.equal(metrics.partnerSpacerDisplay, "none", "пустой 20vh-блок перед партнёрами должен быть скрыт");
        assert.ok(metrics.scheduleHeight <= 760, `расписание должно помещаться в экран, сейчас ${metrics.scheduleHeight}px`);
        assert.ok(Math.max(...metrics.scheduleRows.map((row) => row.top)) - Math.min(...metrics.scheduleRows.map((row) => row.top)) <= 8,
          `три вида расписания должны стоять в одном ряду: ${JSON.stringify(metrics.scheduleRows)}`);
        assert.ok(metrics.scheduleCards.every(({ circle }) => Math.abs(circle.width - 140) <= 1 && Math.abs(circle.height - 140) <= 1 && circle.radius !== '0px' && circle.backgroundSize === 'cover'),
          `три круга должны иметь одинаковый видимый диаметр: ${JSON.stringify(metrics.scheduleCards)}`);
        assert.ok(Math.max(...metrics.scheduleCards.map(({ name }) => name.height)) - Math.min(...metrics.scheduleCards.map(({ name }) => name.height)) <= 1,
          `подписи кругов должны занимать одинаковую строку: ${JSON.stringify(metrics.scheduleCards)}`);
        assert.ok(Math.max(...metrics.scheduleCards.map(({ caption }) => caption.top)) - Math.min(...metrics.scheduleCards.map(({ caption }) => caption.top)) <= 1,
          `пояснения под кругами должны начинаться на одной линии: ${JSON.stringify(metrics.scheduleCards)}`);
        const negativeControl = await send("Runtime.evaluate", {
          returnByValue: true,
          expression: `(() => {
            const style = document.createElement('style');
            style.textContent = '#rec1773853311 .t522__row:first-child .t522__title{transform:translateY(30px)!important}';
            document.head.append(style);
            const tops = [...document.querySelectorAll('#rec1773853311 .t522__title')].map((node) => node.getBoundingClientRect().top);
            style.remove();
            return Math.max(...tops) - Math.min(...tops);
          })()`,
        });
        assert.ok(negativeControl.result.value > 20, `отрицательный контроль должен поймать сломанное выравнивание, получил ${negativeControl.result.value}px`);
        assert.ok(metrics.directionsHeight <= 650, `направления не должны оставлять экран пустоты, сейчас ${metrics.directionsHeight}px`);
      } else {
        assert.ok(metrics.scheduleCards.every(({ circle }) => Math.abs(circle.width - 140) <= 1 && Math.abs(circle.height - 140) <= 1 && circle.radius !== '0px'),
          `на телефоне изображения расписания тоже должны оставаться кругами: ${JSON.stringify(metrics.scheduleCards)}`);
        assert.ok(metrics.directionsHeight <= height, `мобильные направления должны целиком помещаться в экран, сейчас ${metrics.directionsHeight}px при ${height}px`);
        assert.ok(metrics.trigger.width <= 56 && metrics.trigger.height >= 44,
          `компактный помощник должен занимать не больше 56px и оставаться нажимаемым: ${JSON.stringify(metrics.trigger)}`);
        assert.ok(metrics.trigger.bottom <= 24,
          `помощник должен стоять у безопасного нижнего края, а не поверх контента: ${JSON.stringify(metrics.trigger)}`);
        assert.ok(metrics.directionGaps.every((gap) => gap >= 10),
          `между заголовками направлений и кнопками нужен зазор 10px: ${metrics.directionGaps}`);
        assert.ok(metrics.contactMarkers.every(({ imageDisplay, symbol }) => imageDisplay === 'none' && !['none', 'normal', '""'].includes(symbol)),
          `пустые Ellipse_41.png должны быть заменены смысловыми маркерами: ${JSON.stringify(metrics.contactMarkers)}`);
        assert.equal(metrics.heroPaddingTop, '0px',
          `между мобильной шапкой и hero не должно быть белого padding: ${metrics.heroPaddingTop}`);
        assert.equal(metrics.visibleMobileMenuBars, 1,
          `на телефоне должна оставаться одна полоса меню, сейчас ${metrics.visibleMobileMenuBars}`);
        assert.deepEqual(metrics.renderedHeader, { top: 0, height: 64 },
          `вся мобильная шапка должна занимать ровно 64px: ${JSON.stringify(metrics.renderedHeader)}`);
        assert.deepEqual(metrics.visibleMobileMenuBar, { top: 0, height: 64 },
          `видимая полоса меню должна начинаться без 15px отступа: ${JSON.stringify(metrics.visibleMobileMenuBar)}`);
        assert.equal(metrics.heroTop, 64,
          `hero должен начинаться сразу после 64px шапки: ${metrics.heroTop}px`);
        await send("Runtime.evaluate", {
          expression: `scrollTo(0, document.querySelector('#rec282570514').getBoundingClientRect().top + scrollY - 110)`,
        });
        await sleep(350);
        const helperOverlap = await send("Runtime.evaluate", {
          returnByValue: true,
          expression: `(() => {
            const trigger = document.querySelector('.psy-widget-trigger').getBoundingClientRect();
            const targets = ['1613643387114', '1474906621455', '1690964264025', '1690967422558', '1613643678385', '1613643795239', '1613643798757', '1690962575043']
              .map((id) => document.querySelector('#rec282570514 [data-elem-id="' + id + '"]')?.getBoundingClientRect())
              .filter(Boolean);
            return Math.round(targets.reduce((sum, rect) => sum + Math.max(0, Math.min(trigger.right, rect.right) - Math.max(trigger.left, rect.left)) * Math.max(0, Math.min(trigger.bottom, rect.bottom) - Math.max(trigger.top, rect.top)), 0));
          })()`,
        });
        assert.equal(helperOverlap.result.value, 0,
          `компактный помощник не должен перекрывать заголовки и CTA направлений: ${helperOverlap.result.value}px²`);
        const helperNegativeControl = await send("Runtime.evaluate", {
          returnByValue: true,
          expression: `(() => {
            const style = document.createElement('style');
            style.textContent = '.psy-widget-trigger{width:141px!important;min-width:141px!important}';
            document.head.append(style);
            const width = document.querySelector('.psy-widget-trigger').getBoundingClientRect().width;
            style.remove();
            return Math.round(width);
          })()`,
        });
        assert.ok(helperNegativeControl.result.value > 56,
          `отрицательный контроль обязан поймать возврат широкой кнопки: ${helperNegativeControl.result.value}px`);
        await send("Runtime.evaluate", { expression: `document.querySelector('.psy-widget-trigger').click()` });
        await sleep(200);
        const fullscreenControl = await send("Runtime.evaluate", {
          returnByValue: true,
          expression: `(() => {
            const node = document.querySelector('.psy-widget-fullscreen');
            const rect = node.getBoundingClientRect();
            return { display: getComputedStyle(node).display, width: Math.round(rect.width), height: Math.round(rect.height) };
          })()`,
        });
        assert.deepEqual(fullscreenControl.result.value, { display: 'grid', width: 44, height: 44 },
          `разворот помощника должен оставаться видимым контролом 44x44: ${JSON.stringify(fullscreenControl.result.value)}`);
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
