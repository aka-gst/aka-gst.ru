// Удобство чтения страницы рассказа — в настоящем браузере, тем, что видит
// человек (правило 7б), а не по тексту CSS. Заведено 02.10.2026 вместе с
// переездом читалки на новую главную (правка Сергея №14).
//
// По рассказу из каждого сборника, на телефоне 375×812 и ноутбуке 1440×900:
//  - шапка новой главной: Работа / Игры / Рассказы, фраза ИИ;
//  - ни точки прокрутки вбок, кегль текста не меньше 17 px даже на «А−»;
//  - на ноутбуке 60–75 знаков в строке;
//  - на телефоне название рассказа на первом экране, оглавление — после текста;
//  - картинки рассказа загрузились;
//  - полоса прочитанного идёт, сборники сворачиваются, грунт переключается
//    вместе с шапкой, кнопка «наверх» прыгает мгновенно (плавности нет —
//    слово Сергея от 31 августа, а /site.css ставит плавную прокрутку на html).
// Отрицательные контроли — в отчёте сдачи: каждая проверка ломалась руками.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import test from 'node:test';
import { запуститьChrome, подключиться, sleep } from '../tools/igrat.mjs';

const root = new URL('..', import.meta.url).pathname;
const ТИПЫ = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const СЛАГИ = ['blizorukiy-toropyga', 'chetvertaya-stena', 's']; // Соляночка, Три изнутри, А потом

const ЗАМЕР = `(async () => {
  await document.fonts.ready;
  const art = document.querySelector('article.story');
  for (const img of art.querySelectorAll('img')) img.loading = 'eager';
  await Promise.all([...art.querySelectorAll('img')].map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; })));
  const абзацы = [...art.querySelectorAll(':scope > p:not([class])')];
  const строки = [];
  for (const p of абзацы) {
    const t = p.firstChild; if (!t || t.nodeType !== 3) continue;
    const r = document.createRange(); const верх = new Map();
    for (let i = 0; i < t.length; i++) { r.setStart(t, i); r.setEnd(t, i + 1); const rc = r.getClientRects()[0]; if (!rc) continue;
      const k = Math.round(rc.top); верх.set(k, (верх.get(k) || 0) + 1); }
    const n = [...верх.values()]; n.pop(); строки.push(...n); // последняя строка абзаца неполная
  }
  строки.sort((a, b) => a - b);
  const шапка = document.querySelector('header.site-header');
  return {
    ширина: innerWidth, вбок: document.documentElement.scrollWidth - innerWidth,
    кегль: parseFloat(getComputedStyle(абзацы[0]).fontSize),
    строки,
    картинки: [...art.querySelectorAll('img')].map((i) => i.complete && i.naturalWidth > 0),
    шапка: шапка && [...шапка.querySelectorAll('.main-nav a')].map((a) => a.textContent + (a.getAttribute('aria-current') === 'page' ? '*' : '')),
    фраза: document.querySelector('.phrase-text')?.textContent || '',
    заголовок: art.querySelector('h1').getBoundingClientRect().top + scrollY,
    низТекста: art.getBoundingClientRect().bottom + scrollY,
    верхОглавления: document.querySelector('.reader-side').getBoundingClientRect().top + scrollY,
    левоОглавления: document.querySelector('.reader-side').getBoundingClientRect().left,
    левоТекста: art.getBoundingClientRect().left,
  };
})()`;

test('страница рассказа читается на телефоне и ноутбуке в стиле новой главной', { timeout: 120_000 }, async () => {
  const server = createServer(async (req, res) => {
    const путь = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
    const файл = join(root, путь.endsWith('/') ? `${путь}index.html` : путь);
    try { const тело = await readFile(файл); res.writeHead(200, { 'content-type': ТИПЫ[extname(файл)] || 'application/octet-stream' }); res.end(тело); }
    catch { res.writeHead(404); res.end(); }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const база = `http://127.0.0.1:${server.address().port}`;
  const chrome = запуститьChrome(9497, '1440,900');
  try {
    const send = await подключиться(9497);
    await send('Page.enable');
    const ev = async (expression) => {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    };
    const открыть = async (slug) => {
      await send('Page.navigate', { url: `${база}/rasskazy/${slug}/` });
      await sleep(600);
      await ev(`new Promise((r) => document.readyState === 'complete' ? r() : addEventListener('load', r, { once: true }))`);
    };

    for (const [w, h, mobile] of [[375, 812, true], [1440, 900, false]]) {
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile });
      for (const slug of СЛАГИ) {
        await открыть(slug);
        const м = await ev(ЗАМЕР);
        const где = `${slug} @${w}`;
        // На телефоне широкое содержимое раздвигает само окно (innerWidth 375 → 420+),
        // и scrollWidth − innerWidth остаётся нулём: прокрутку вбок ловит эта строка.
        assert.equal(м.ширина, w, `${где}: окно ${м.ширина} вместо ${w} — содержимое шире экрана (или среда не та)`);
        assert.deepEqual(м.шапка, ['Работа', 'Игры', 'Рассказы*'], `${где}: шапка не новой главной`);
        assert.match(м.фраза, /\S/, `${где}: нет фразы ИИ в шапке`);
        assert.equal(м.вбок, 0, `${где}: прокрутка вбок ${м.вбок} px`);
        assert.ok(м.кегль >= 17, `${где}: кегль ${м.кегль} px`);
        assert.ok(м.картинки.length >= 1 && м.картинки.every(Boolean), `${где}: картинки рассказа не загрузились ${JSON.stringify(м.картинки)}`);
        assert.ok(м.строки.length >= 10, `${где}: мерить нечего — полных строк ${м.строки.length}`);
        if (w === 1440) {
          const медиана = м.строки[м.строки.length >> 1];
          const вМере = м.строки.filter((n) => n >= 60 && n <= 75).length / м.строки.length;
          const длинных = м.строки.filter((n) => n > 75).length / м.строки.length;
          assert.ok(медиана >= 60 && медиана <= 75, `${где}: медиана ${медиана} знаков в строке, нужно 60–75`);
          assert.ok(вМере >= 0.85, `${где}: в мере 60–75 только ${(вМере * 100).toFixed(0)}% строк`);
          assert.ok(длинных <= 0.01, `${где}: строк длиннее 75 знаков ${(длинных * 100).toFixed(1)}%`);
          assert.ok(м.левоОглавления < м.левоТекста, `${где}: оглавление на ноутбуке должно стоять сбоку слева`);
        } else {
          assert.ok(м.заголовок < h, `${где}: название рассказа на ${Math.round(м.заголовок)} px — ниже первого экрана`);
          assert.ok(м.верхОглавления > м.низТекста, `${где}: на телефоне оглавление должно идти после текста`);
        }
      }
    }

    // Поведение — на телефоне, одним рассказом.
    await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
    await открыть('s');
    await ev(`localStorage.clear(), true`);
    const полоса = await ev(`(async () => {
      const кадр = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const i = document.querySelector('.reader-progress i');
      scrollTo({ top: 0, behavior: 'instant' }); await кадр(); const вНачале = parseFloat(i.style.width);
      const art = document.querySelector('article.story');
      scrollTo({ top: art.getBoundingClientRect().top + scrollY + art.offsetHeight / 2, behavior: 'instant' }); await кадр();
      return { вНачале, посредине: parseFloat(i.style.width) };
    })()`);
    assert.ok(полоса.посредине > полоса.вНачале && полоса.посредине > 20 && полоса.посредине < 100,
      `полоса прочитанного не идёт: ${JSON.stringify(полоса)}`);

    const наверх = await ev(`(async () => {
      const кнопка = document.querySelector('.reader-back-to-top');
      await new Promise((r) => setTimeout(r, 100));
      if (кнопка.hidden) return { видна: false };
      const было = scrollY; кнопка.click();
      await new Promise((r) => setTimeout(r, 30));
      return { видна: true, было, стало: scrollY };
    })()`);
    assert.ok(наверх.видна, 'кнопка «наверх» не появилась посреди рассказа');
    assert.ok(наверх.было > 800 && наверх.стало === 0, `«наверх» не мгновенная: было ${наверх.было}, через 30 мс ${наверх.стало}`);

    const сборники = await ev(`(async () => {
      const закрытый = [...document.querySelectorAll('.reader-side-group')].find((g) => !g.open);
      const summary = закрытый.querySelector('summary');
      const до = [закрытый.open, summary.getAttribute('aria-expanded')];
      summary.click(); await new Promise((r) => setTimeout(r, 50));
      const открыт = [закрытый.open, summary.getAttribute('aria-expanded')];
      summary.click(); await new Promise((r) => setTimeout(r, 50));
      return { до, открыт, снова: [закрытый.open, summary.getAttribute('aria-expanded')] };
    })()`);
    assert.deepEqual(сборники, { до: [false, 'false'], открыт: [true, 'true'], снова: [false, 'false'] },
      'сборник в оглавлении не раскрывается и не сворачивается');

    const мельче = await ev(`(async () => {
      const кнопка = document.querySelector('[data-size="-1"]');
      for (let i = 0; i < 5; i++) кнопка.click();
      const кегль = parseFloat(getComputedStyle(document.querySelector('article.story > p:not([class])')).fontSize);
      const размер = document.documentElement.dataset.size;
      for (let i = 0; i < 5; i++) document.querySelector('[data-size="1"]').click();
      return { кегль, размер };
    })()`);
    assert.equal(мельче.размер, 's', '«А−» не уменьшает текст');
    assert.ok(мельче.кегль >= 17, `на самом мелком «А−» кегль ${мельче.кегль} px`);
    await ev(`localStorage.clear(), true`);

    const грунт = await ev(`(async () => {
      const цвета = () => [getComputedStyle(document.body).backgroundColor, getComputedStyle(document.querySelector('.site-header')).backgroundColor,
        getComputedStyle(document.querySelector('article.story > p:not([class])')).color];
      const тёмный = цвета();
      document.querySelector('[data-ground-toggle]').click();
      const бумага = [document.documentElement.dataset.ground, ...цвета()];
      document.querySelector('[data-ground-toggle]').click();
      return { тёмный, бумага, обратно: document.documentElement.dataset.ground };
    })()`);
    assert.deepEqual(грунт.тёмный, ['rgb(11, 12, 13)', 'rgb(11, 12, 13)', 'rgb(238, 241, 243)'], 'тёмный грунт не из палитры новой главной');
    assert.equal(грунт.бумага[0], 'paper');
    assert.equal(грунт.бумага[1], грунт.бумага[2], 'на бумаге шапка должна светлеть вместе со страницей');
    assert.notEqual(грунт.бумага[1], грунт.тёмный[0], 'грунт не переключился');
    assert.equal(грунт.обратно, 'dark');
    await ev(`localStorage.clear(), true`);

    send.закрыть();
  } finally {
    chrome.kill();
    server.close();
  }
});
