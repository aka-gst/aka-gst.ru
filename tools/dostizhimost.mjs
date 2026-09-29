// Достижимость с витрины — глазами БРАУЗЕРА, а не курлом.
//
// Заведено 5 сентября 2026. Слепое пятно нашлось спором: связной утверждал,
// что ссылка на игру собирается скриптом и потому не видна `curl`. В тот раз
// ссылки не оказалось вовсе, но довод верный — статичный поиск такие ссылки
// пропускает, а требование Сергея прямое: «надо чтоб можно было попасть на
// всё, что есть на сайте».
//
// Чем отличается от раздела в verify.sh: тот читает разметку, этот открывает
// страницу в настоящем браузере, разворачивает все вкладки и собирает ссылки
// из РЕНДЕРЕННОГО DOM. Если оба говорят одно — хорошо; если расходятся, прав
// этот, и расхождение само по себе находка.
//
//   node tools/dostizhimost.mjs
//
// Код выхода: 0 — сирот нет, 1 — есть или прогон недействителен.
//
// Имена переменных латиницей там, где они уходят в оболочку.

import { execFileSync } from 'node:child_process';
import { запуститьChrome, подключиться, sleep } from './igrat.mjs';

const САЙТ = process.env.SITE || 'https://aka-gst.ru';
const ПОРТ = 9333;

// Служебное в счёт не идёт — то же исключение, что и в verify.sh.
const СЛУЖЕБНОЕ = /^(assets|404\.html|503\.html|index\.html|favicon|og\.png|robots|sitemap|game-menu|player-name|tour\.js|data)/;
// Названные владельцем исключения. Держим здесь же, чтобы два списка не
// разъезжались: правило 27 — правка в одной из копий не считается правкой.
const РАЗРЕШЁННЫЕ_СИРОТЫ = new Set(['leela', 'zoo', 'puzzle-quest', 'psy-admin-v2']);

const папкиСервера = () => {
  const вывод = execFileSync('ssh', ['-o', 'ConnectTimeout=20', 'bonita', 'ls -1 /opt/zakriva/caddy/site'], {
    encoding: 'utf8',
  });
  return вывод.split('\n').map((s) => s.trim()).filter((s) => s && !СЛУЖЕБНОЕ.test(s));
};

const main = async () => {
  const папки = папкиСервера();
  if (папки.length < 5) {
    console.log(`  ПРОВАЛ: с сервера пришло ${папки.length} папок — сверять не с чем`);
    process.exit(1);
  }
  console.log(`  папок на сервере: ${папки.length}`);

  const chrome = запуститьChrome(ПОРТ, '1440,900');
  try {
    const send = await подключиться(ПОРТ);
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Page.navigate', { url: `${САЙТ}/` });
    await sleep(3000);

    // Разворачиваем ВСЕ вкладки: содержимое скрытой панели в DOM есть, но
    // ссылки, которые дорисовывает скрипт при показе, появляются только
    // после переключения. Мера, смотрящая на скрытое, возвращает «нету».
    const { result } = await send('Runtime.evaluate', {
      awaitPromise: true,
      returnByValue: true,
      expression: `(async () => {
        const ждать = (мс) => new Promise((r) => setTimeout(r, мс));
        const кнопки = [...document.querySelectorAll('[data-panel-to],[data-track-to]')];
        for (const к of кнопки) { к.click(); await ждать(500); }
        await ждать(500);
        const ссылки = [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'));
        return {
          ссылки,
          всего: ссылки.length,
          вкладок: кнопки.length,
          заголовок: document.title,
        };
      })()`,
    });
    const данные = result?.value;

    // ПОЛОЖИТЕЛЬНЫЙ КОНТРОЛЬ до выводов: страница без ссылок означает, что
    // мы смотрим не туда, а не что сайт пуст. Без этой строки пустой ответ
    // дал бы «все папки сироты» — красиво и неверно.
    if (!данные || данные.всего < 10) {
      console.log(`  ПРОВАЛ: со страницы собрано ${данные?.всего ?? 0} ссылок — прогон недействителен`);
      process.exit(1);
    }
    console.log(`  ссылок в рендеренном DOM: ${данные.всего}, вкладок развёрнуто: ${данные.вкладок}`);

    const свои = new Set(
      данные.ссылки
        .filter((h) => h && h.startsWith('/'))
        .map((h) => h.replace(/^\//, '').split(/[/?#]/)[0])
        .filter(Boolean)
    );

    const кандидаты = папки.filter((d) => !свои.has(d) && !РАЗРЕШЁННЫЕ_СИРОТЫ.has(d));

    // Старый адрес, ведущий на новый, — не сирота, а ДВЕРЬ для тех, у кого он
    // в закладках. Правило есть в verify.sh, и я его тут сперва забыл: первый
    // же прогон объявил сиротами knb, udar и worm — три исправных редиректа.
    // Проверка, кричащая на исправном, живёт до первого «да ну её».
    const сироты = [];
    for (const d of кандидаты) {
      let код = 0;
      try {
        код = (await fetch(`${САЙТ}/${d}/`, { redirect: 'manual' })).status;
      } catch { код = 0; }
      if (код >= 300 && код < 400) continue;
      сироты.push(d);
    }
    if (сироты.length === 0) {
      console.log('  ok    на каждую папку сервера есть ссылка в живом DOM');
      process.exit(0);
    }
    console.log(`  СИРОТЫ (лежат, но с витрины не достижимы): ${сироты.join(' ')}`);
    process.exit(1);
  } finally {
    chrome.kill();
  }
};

main().catch((e) => {
  console.log(`  ПРОВАЛ: ${e.message}`);
  process.exit(1);
});
