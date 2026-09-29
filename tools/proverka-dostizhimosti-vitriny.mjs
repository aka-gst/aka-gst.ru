#!/usr/bin/env node
// Проверка: есть ли с витрины сайта путь на каждую вещь, которая лежит на
// сервере — и обратно, не ведёт ли витрина туда, чего на сервере нет.
//
// Повод: NEON CLAW лежала на сервере и отвечала 200 неделю, а ссылки на
// неё с витрины не было вовсе — попасть можно было только по прямому
// адресу. Правило владельца от 1 сентября 2026, дословно: «надо чтоб можно
// было попасть на всё, что есть на сайте!! это важно».
//
// Сверяются ДВА списка, и расхождение в любую сторону — беда:
//   А. что реально лежит на сервере (каталоги в корне выкладки, по ssh);
//   Б. куда ведут видимые ссылки с главной страницы витрины (по href).
//   лежит и не видно  -> «сирота» (as in NEON CLAW);
//   видно и не лежит   -> мёртвая ссылка на витрине.
//
// Ссылки ищутся ОТРИЦАНИЕМ: собираются вообще все внутренние href="/...",
// а не по словарю известных имён игр — так же, как NEON CLAW нашли не по
// имени папки /neon-claw/ (её и нет — игра лежит в /claw/), а потому что
// её вообще нигде не было среди ссылок.
//
// Старый адрес, который ОТВЕЧАЕТ САМ, но 30x-редиректом уводит на новый
// (уже слинкованный) адрес — не сирота, а оставленная дверь для тех, у
// кого адрес в закладках (/knb/ -> /stihii/, /worm/ -> /naotmash/,
// /udar/ -> /hotline-abakan/). Сиротой считается только то, что отвечает
// само (200) и никуда не ведёт.
//
//   node tools/proverka-dostizhimosti-vitriny.mjs            проверить бой
//   node tools/proverka-dostizhimosti-vitriny.mjs <адрес>     другой адрес
//   node tools/proverka-dostizhimosti-vitriny.mjs --test      самопроверка на выдумке, без сети

import { execSync } from 'node:child_process';

const SSH_HOST = process.env.SSH_HOST || 'bonita';
const SITE_ROOT = process.env.SITE_ROOT || '/opt/zakriva/caddy/site';

// Служебное — не контент, в сравнение не идёт.
const SERVICE_DIRS = new Set(['assets', 'data']);

// Названное владельцем исключение (совпадает с verify.sh, раздел «на всё,
// что лежит на сервере, можно попасть с витрины»): три экспериментальные
// сборки пульта нарочно не выставлены на витрину, владелец проверяет игры
// через вкладку «Игры», а не через них. Это решение, названное вслух, а
// не сирота, о которой никто не знает.
const NAMED_EXCEPTIONS = new Set(['leela', 'zoo', 'puzzle-quest']);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function httpStatus(url, { redirect = 'manual', retries = 3 } = {}) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { redirect, signal: AbortSignal.timeout(20000) });
      return res.status;
    } catch {
      if (attempt === retries) return 0; // 000 — ответа не было, это не 404
      await sleep(1000);
    }
  }
  return 0;
}

// Каталоги в корне выкладки — правда о том, что лежит на сервере.
// mindepth/maxdepth 1, только директории: файлы (robots.txt, og.png,
// index.html и т.п.) сюда не идут, они не «вещи», на которые нужен путь.
function serverDirsLive() {
  const out = execSync(
    `ssh -o ConnectTimeout=8 -o BatchMode=yes ${SSH_HOST} ` +
      `'find ${SITE_ROOT} -maxdepth 1 -mindepth 1 -type d -printf "%f\\n"'`,
    { encoding: 'utf8', timeout: 20000 },
  );
  return out.split('\n').map((s) => s.trim()).filter(Boolean).sort();
}

// Все внутренние href="/..." с главной — без словаря имён, любой
// адресный переход считается ссылкой. Берём первый сегмент пути: ссылка
// на /praktikum/llm/ считается ссылкой на «praktikum». Ссылки на файлы в
// корне (og.png, robots.txt — есть точка в первом сегменте) не каталоги,
// отбрасываются.
function topLevelLinks(html) {
  const out = new Set();
  const re = /href="(\/[^"#?]+)"/g;
  let m;
  while ((m = re.exec(html))) {
    const seg = m[1].split('/').filter(Boolean)[0];
    if (!seg) continue;
    if (seg.includes('.')) continue; // файл в корне, не каталог
    out.add(seg);
  }
  return out;
}

// Сердце проверки. Не трогает сеть напрямую — приходит через checkRedirect
// и checkResolves, поэтому его можно прогнать на выдумке без сети (--test).
async function compare({ base, serverDirs, homepageHtml, checkRedirect, checkResolves }) {
  const linked = topLevelLinks(homepageHtml);

  const orphans = []; // лежит на сервере, ссылки с витрины нет
  for (const dir of serverDirs) {
    if (SERVICE_DIRS.has(dir) || NAMED_EXCEPTIONS.has(dir)) continue;
    if (linked.has(dir)) continue;
    const isAlias = await checkRedirect(`${base}/${dir}/`);
    if (isAlias) continue; // старый адрес, уводящий на новый — не сирота
    orphans.push(dir);
  }

  const deadLinks = []; // ссылка с витрины есть, а адрес не отвечает 200
  for (const seg of linked) {
    if (SERVICE_DIRS.has(seg)) continue;
    const ok = await checkResolves(`${base}/${seg}/`);
    if (!ok) deadLinks.push(seg);
  }

  return { linked, orphans, deadLinks, ok: orphans.length === 0 && deadLinks.length === 0 };
}

// ---------- боевой прогон ----------

async function runLive(base) {
  console.log(`== проверка достижимости с витрины: ${base} ==\n`);

  let serverDirs;
  try {
    serverDirs = serverDirsLive();
  } catch (e) {
    console.log('FAIL  список папок сервера не получен (ssh не ответил) — сверить достижимость не с чем');
    console.log(`      ${String(e.message || e).split('\n')[0]}`);
    process.exitCode = 1;
    return;
  }
  console.log(`сервер (${SITE_ROOT}, по ssh ${SSH_HOST}): ${serverDirs.length} каталогов`);
  console.log(`  ${serverDirs.join(', ')}\n`);

  let homepageHtml = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${base}/?svezho=${Date.now()}`, { signal: AbortSignal.timeout(20000) });
      homepageHtml = await res.text();
      break;
    } catch {
      if (attempt === 3) {
        console.log('FAIL  главная не отдала ответ (сеть) — сверить не с чем');
        process.exitCode = 1;
        return;
      }
      await sleep(1000);
    }
  }
  if (!homepageHtml) {
    console.log('FAIL  главная отдала пустоту — это не то же самое, что 404, но сверять не с чем');
    process.exitCode = 1;
    return;
  }

  const checkRedirect = (url) => httpStatus(url, { redirect: 'manual' }).then((c) => c >= 300 && c < 400);
  const checkResolves = (url) => httpStatus(url, { redirect: 'follow' }).then((c) => c === 200);

  const result = await compare({ base, serverDirs, homepageHtml, checkRedirect, checkResolves });

  console.log(`витрина: ${result.linked.size} внутренних ссылок с главной`);
  console.log(`  ${[...result.linked].sort().join(', ')}\n`);

  console.log('== лежит на сервере, а ссылки с витрины нет («сироты», как NEON CLAW) ==');
  if (result.orphans.length === 0) {
    console.log('  ok    сирот нет — на каждый каталог сервера есть ссылка (или он сам ведёт редиректом на слинкованный)');
  } else {
    for (const d of result.orphans) console.log(`  FAIL  /${d}/ — лежит на сервере, ссылки с витрины нет`);
  }

  console.log('\n== ссылка с витрины есть, а адрес не отвечает 200 (мёртвая ссылка) ==');
  if (result.deadLinks.length === 0) {
    console.log('  ok    мёртвых ссылок нет — все ссылки с витрины куда-то ведут');
  } else {
    for (const s of result.deadLinks) console.log(`  FAIL  /${s}/ — ссылка на витрине есть, адрес не отвечает 200`);
  }

  console.log('\n== контроль на заведомо известном ==');
  const clawOk = !result.orphans.includes('claw') && result.linked.has('claw');
  console.log(
    clawOk
      ? '  ok    /claw/: положительный контроль — путь с витрины есть, зелено, как и ожидали'
      : '  FAIL  /claw/: положительный контроль НЕ подтвердился — ожидали зелёный, получили другое',
  );
  const psyV2Orphan = result.orphans.includes('psy-admin-v2');
  console.log(
    psyV2Orphan
      ? '  ok    /psy-admin-v2/: отрицательный контроль — лежит на сервере, ссылки с витрины нет, красно, как и ожидали'
      : '  FAIL  /psy-admin-v2/: отрицательный контроль НЕ подтвердился — ожидали красный, получили другое',
  );

  const controlsOk = clawOk && psyV2Orphan;
  const bad = result.orphans.length + result.deadLinks.length;
  const ok = serverDirs.length + result.linked.size - bad;

  console.log(`\nитого: ${ok} ok / ${bad} FAIL`);
  process.exitCode = result.ok && controlsOk ? 0 : 1;
}

// ---------- самопроверка на выдумке (без сети, оба исхода) ----------

async function runSelfTest() {
  console.log('== самопроверка измерителя на выдумке (без сети) ==\n');
  let allPassed = true;

  const scenario = async (name, { serverDirs, homepageHtml, redirects = {}, resolves = {} }, expect) => {
    const checkRedirect = async (url) => Boolean(redirects[url]);
    const checkResolves = async (url) => resolves[url] !== false; // по умолчанию отвечает
    const r = await compare({ base: 'https://example.test', serverDirs, homepageHtml, checkRedirect, checkResolves });
    const pass =
      r.ok === expect.ok &&
      JSON.stringify(r.orphans.sort()) === JSON.stringify((expect.orphans || []).sort()) &&
      JSON.stringify(r.deadLinks.sort()) === JSON.stringify((expect.deadLinks || []).sort());
    console.log(`  ${pass ? 'ok  ' : 'FAIL'}  ${name}`);
    if (!pass) {
      console.log(`        получили: ok=${r.ok} orphans=[${r.orphans}] deadLinks=[${r.deadLinks}]`);
      console.log(`        ждали:    ok=${expect.ok} orphans=[${expect.orphans || []}] deadLinks=[${expect.deadLinks || []}]`);
      allPassed = false;
    }
  };

  // 1. Зелёный исход: всё, что лежит, слинковано; лишних ссылок нет.
  await scenario(
    'зелёный: сервер и витрина совпадают',
    {
      serverDirs: ['claw', 'stihii'],
      homepageHtml: '<a href="/claw/">claw</a><a href="/stihii/">stihii</a>',
    },
    { ok: true },
  );

  // 2. Красный по первому направлению: лежит на сервере, ссылки нет,
  //    и старым адресом (30x) оно тоже не прикрыто — настоящая сирота.
  await scenario(
    'красный: сирота на сервере (как NEON CLAW/psy-admin-v2)',
    {
      serverDirs: ['claw', 'psy-admin-v2'],
      homepageHtml: '<a href="/claw/">claw</a>',
      redirects: {}, // psy-admin-v2 не редиректит никуда
    },
    { ok: false, orphans: ['psy-admin-v2'] },
  );

  // 2б. Тот же сервер, но каталог отвечает 30x на свой собственный адрес —
  //     это не сирота, а оставленная дверь (как /knb/ -> /stihii/).
  await scenario(
    'зелёный: старый адрес редиректит на новый — не сирота',
    {
      serverDirs: ['claw', 'knb'],
      homepageHtml: '<a href="/claw/">claw</a><a href="/stihii/">stihii</a>',
      redirects: { 'https://example.test/knb/': true },
    },
    { ok: true },
  );

  // 3. Красный по второму направлению: ссылка с витрины есть, а адрес не
  //    отвечает 200 — мёртвая ссылка на самой витрине.
  await scenario(
    'красный: мёртвая ссылка на витрине',
    {
      serverDirs: ['claw'],
      homepageHtml: '<a href="/claw/">claw</a><a href="/udalili-igru/">была и нет</a>',
      resolves: { 'https://example.test/udalili-igru/': false },
    },
    { ok: false, deadLinks: ['udalili-igru'] },
  );

  console.log(`\nсамопроверка: ${allPassed ? 'все 4 сценария прошли — у измерителя есть оба исхода' : 'ЕСТЬ ПРОВАЛЫ'}`);
  process.exitCode = allPassed ? 0 : 1;
}

const arg = process.argv[2];
if (arg === '--test' || arg === '--self-test') {
  await runSelfTest();
} else {
  await runLive(arg && arg.startsWith('http') ? arg : 'https://aka-gst.ru');
}
