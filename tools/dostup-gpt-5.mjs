#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const SITE = process.env.DOSTUP_SITE || 'https://aka-gst.ru/';
const SSH_HOST = process.env.DOSTUP_HOST || 'bonita';
const SERVER_ROOT = process.env.DOSTUP_ROOT || '/opt/zakriva/caddy/site';
const REQUEST_TIMEOUT_MS = Number(process.env.DOSTUP_TIMEOUT_MS || 20_000);
const RETRIES = Number(process.env.DOSTUP_RETRIES || 3);
const CONCURRENCY = Number(process.env.DOSTUP_CONCURRENCY || 6);

function usage() {
  console.log(`Использование:
  node tools/dostup-gpt-5.mjs             сверить живой сервер и витрину
  node tools/dostup-gpt-5.mjs --self-test проверить сам измеритель без сети

Настройки: DOSTUP_SITE, DOSTUP_HOST, DOSTUP_ROOT, DOSTUP_TIMEOUT_MS,
DOSTUP_RETRIES, DOSTUP_CONCURRENCY.`);
}

function assertSettings() {
  if (!/^https?:\/\//.test(SITE)) throw new Error(`неверный DOSTUP_SITE: ${SITE}`);
  if (!/^[a-z0-9_.@-]+$/i.test(SSH_HOST)) throw new Error(`неверный DOSTUP_HOST: ${SSH_HOST}`);
  if (!/^\/[a-z0-9_./-]+$/i.test(SERVER_ROOT)) throw new Error(`неверный DOSTUP_ROOT: ${SERVER_ROOT}`);
  for (const [name, value] of [
    ['DOSTUP_TIMEOUT_MS', REQUEST_TIMEOUT_MS],
    ['DOSTUP_RETRIES', RETRIES],
    ['DOSTUP_CONCURRENCY', CONCURRENCY],
  ]) {
    if (!Number.isInteger(value) || value < 1) throw new Error(`неверный ${name}: ${value}`);
  }
}

function sameSite(a, b) {
  const host = (url) => `${url.hostname.toLowerCase().replace(/^www\./, '')}:${url.port}`;
  return host(a) === host(b) && a.protocol === b.protocol;
}

function decodeHtml(value) {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(Number.parseInt(n, 16)))
    .replace(/&#([0-9]+);/g, (_, n) => String.fromCodePoint(Number.parseInt(n, 10)));
}

// Берём только настоящие <a href>. URL в тексте, JSON, комментарии, script,
// style и template не создаёт для человека путь с витрины.
export function extractPageLinks(html, base) {
  const clean = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  const baseUrl = new URL(base);
  const links = new Set();
  const anchor = /<a\b([^>]*)>/gi;

  for (const match of clean.matchAll(anchor)) {
    const attrs = match[1];
    const hrefMatch = attrs.match(/(?:^|\s)href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i);
    if (!hrefMatch) continue;

    // Сама ссылка навсегда скрыта — это не путь. Скрытый tabpanel не
    // исключаем: человек открывает его кнопкой, и карточка становится видна.
    if (/(?:^|\s)hidden(?:\s|=|$)/i.test(attrs)) continue;
    if (/(?:^|\s)aria-hidden\s*=\s*(?:"true"|'true'|true)(?:\s|$)/i.test(attrs)) continue;
    if (/(?:^|\s)style\s*=\s*(?:"[^"]*(?:display\s*:\s*none|visibility\s*:\s*hidden)[^"]*"|'[^']*(?:display\s*:\s*none|visibility\s*:\s*hidden)[^']*')/i.test(attrs)) continue;

    const raw = decodeHtml(hrefMatch[1] ?? hrefMatch[2] ?? hrefMatch[3] ?? '').trim();
    if (!raw || raw.startsWith('#')) continue;

    let url;
    try { url = new URL(raw, baseUrl); } catch { continue; }
    if (!['http:', 'https:'].includes(url.protocol) || !sameSite(url, baseUrl)) continue;

    const last = url.pathname.split('/').filter(Boolean).at(-1) || '';
    const pageLike = url.pathname.endsWith('/') || !last.includes('.') || /\.html?$/i.test(last);
    if (!pageLike || url.pathname === '/') continue;
    url.hash = '';
    url.search = '';
    links.add(url.href);
  }
  return [...links].sort();
}

export function routeKey(input) {
  const url = input instanceof URL ? input : new URL(input, SITE);
  const first = url.pathname.split('/').filter(Boolean)[0];
  if (!first) return null;
  return /\.html?$/i.test(first) ? `/${first}` : `/${first}/`;
}

export function compareSets(server, showcase) {
  const sort = (values) => [...values].sort((a, b) => a.localeCompare(b, 'ru'));
  return {
    onlyServer: sort([...server].filter((route) => !showcase.has(route))),
    onlyShowcase: sort([...showcase].filter((route) => !server.has(route))),
  };
}

function discoverServerCandidates() {
  // Один уровень — отдельные вещи сайта. Вложенные страницы принадлежат
  // своей верхнеуровневой вещи (/rasskazy/x/ -> /rasskazy/).
  const command = `find ${SERVER_ROOT} -mindepth 1 -maxdepth 2 -type f -name '*.html' -print`;
  const result = spawnSync('ssh', [
    '-o', 'BatchMode=yes',
    '-o', 'ConnectTimeout=15',
    SSH_HOST,
    command,
  ], { encoding: 'utf8', timeout: 30_000, maxBuffer: 4 * 1024 * 1024 });

  if (result.error) throw new Error(`SSH не выполнился: ${result.error.message}`);
  if (result.status !== 0) {
    const detail = (result.stderr || '').trim().split('\n').at(-1) || `код ${result.status}`;
    throw new Error(`SSH не выполнился: ${detail}`);
  }

  const prefix = `${SERVER_ROOT.replace(/\/$/, '')}/`;
  const files = result.stdout.split('\n').map((line) => line.trim()).filter(Boolean);
  if (!files.length) throw new Error('SSH вернул пустой список HTML-файлов');

  const candidates = new Map();
  for (const file of files) {
    if (!file.startsWith(prefix)) continue;
    const relative = file.slice(prefix.length);
    const parts = relative.split('/');
    let path = null;

    if (parts.length === 2 && parts[1] === 'index.html') {
      path = `/${encodeURIComponent(parts[0])}/`;
    } else if (parts.length === 1 && /\.html?$/i.test(parts[0]) && !/^(?:index|404|503)\.html?$/i.test(parts[0])) {
      path = `/${encodeURIComponent(parts[0])}`;
    }
    if (path) candidates.set(path, { path, file });
  }

  if (!candidates.size) throw new Error('не найдено ни одной верхнеуровневой вещи с HTML-входом');
  return [...candidates.values()].sort((a, b) => a.path.localeCompare(b.path, 'ru'));
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function get(url) {
  let lastError;
  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: { 'user-agent': 'aka-gst-dostup-gpt-5/1.0' },
      });
      const body = await response.text();
      const result = {
        requested: url,
        finalUrl: response.url,
        status: response.status,
        bytes: Buffer.byteLength(body),
        body,
      };
      if (response.status < 500 || attempt === RETRIES) return result;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
      if (attempt === RETRIES) break;
    }
    await delay(250 * attempt);
  }
  throw new Error(`${url}: сеть не ответила после ${RETRIES} попыток (${lastError?.message || 'неизвестная ошибка'})`);
}

async function mapLimit(items, limit, worker) {
  const output = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      output[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return output;
}

function isLivePage(result, base) {
  if (result.status !== 200 || result.bytes === 0) return false;
  try { return sameSite(new URL(result.finalUrl), new URL(base)); } catch { return false; }
}

function printList(title, items, empty) {
  console.log(`${title}: ${items.length}`);
  if (!items.length) console.log(`  ${empty}`);
  else for (const item of items) console.log(`  ${item}`);
}

function printControls(serverSet, showcaseSet, title = 'КОНТРОЛИ НА ЗАВЕДОМО ИЗВЕСТНОМ') {
  const controls = [
    { route: '/claw/', server: true, showcase: true, label: 'положительный' },
    { route: '/psy-admin-v2/', server: true, showcase: false, label: 'отрицательный' },
  ];
  let passed = 0;

  console.log(`\n${title}`);
  for (const control of controls) {
    const server = Number(serverSet.has(control.route));
    const showcase = Number(showcaseSet.has(control.route));
    const differences = Number(server !== showcase);
    const expectedDifferences = Number(control.server !== control.showcase);
    const ok = server === Number(control.server)
      && showcase === Number(control.showcase)
      && differences === expectedDifferences;
    if (ok) passed += 1;
    console.log(`  ${ok ? 'PASS' : 'FAIL'} ${control.route} ${control.label}: сервер=${server}, витрина=${showcase}, расхождений=${differences}, итог=${differences ? 'КРАСНЫЙ' : 'ЗЕЛЁНЫЙ'}`);
  }
  console.log(`  контролей подтверждено: ${passed}/${controls.length}`);
  return passed === controls.length;
}

async function runLive() {
  assertSettings();
  const base = new URL(SITE);
  const serverCandidates = discoverServerCandidates();

  const homepage = await get(base.href);
  if (!isLivePage(homepage, base)) {
    throw new Error(`витрина не прочитана: HTTP ${homepage.status}, ${homepage.bytes} байт`);
  }
  const linkUrls = extractPageLinks(homepage.body, base);
  if (!linkUrls.length) throw new Error('витрина прочитана, но в ней не найдено ни одной внутренней ссылки на страницу');

  const serverChecks = await mapLimit(serverCandidates, CONCURRENCY, async (candidate) => {
    const result = await get(new URL(candidate.path, base).href);
    const live = isLivePage(result, base);
    return {
      ...candidate,
      ...result,
      live,
      key: live ? routeKey(result.finalUrl) : null,
    };
  });

  const linkChecks = await mapLimit(linkUrls, CONCURRENCY, async (href) => {
    const result = await get(href);
    const live = isLivePage(result, base);
    return { href, ...result, live, key: live ? routeKey(result.finalUrl) : routeKey(href) };
  });

  const serverSet = new Set(serverChecks.filter((item) => item.live && item.key).map((item) => item.key));
  const showcaseSet = new Set(linkChecks.filter((item) => item.live && item.key).map((item) => item.key));
  const unserved = serverChecks.filter((item) => !item.live);
  const deadLinks = linkChecks.filter((item) => !item.live);
  const { onlyServer, onlyShowcase } = compareSets(serverSet, showcaseSet);

  console.log(`ИЗМЕРИТЕЛЬ: SSH-файлов=${serverCandidates.length}, HTTP-проверено=${serverChecks.length}; ссылок <a href>=${linkUrls.length}, HTTP-проверено=${linkChecks.length}`);
  console.log(`СПИСКИ: сервер=${serverSet.size}, витрина=${showcaseSet.size}`);
  printList('ЛЕЖИТ И ОТВЕЧАЕТ, НО ПУТИ С ВИТРИНЫ НЕТ', onlyServer, 'нет');
  printList('ВИТРИНА ВЕДЁТ ВНЕ СПИСКА СЕРВЕРА', onlyShowcase, 'нет');
  printList(
    'ВИТРИНА ВЕДЁТ НА НЕОТВЕЧАЮЩИЙ АДРЕС',
    deadLinks.map((item) => `${new URL(item.href).pathname} -> HTTP ${item.status}, ${item.bytes} байт`),
    'нет',
  );
  printList(
    'HTML-ВХОД ЛЕЖИТ НА ДИСКЕ, НО ЕГО АДРЕС НЕ ОТВЕЧАЕТ',
    unserved.map((item) => `${item.path} -> HTTP ${item.status}, ${item.bytes} байт`),
    'нет',
  );
  const controlsOk = printControls(serverSet, showcaseSet);

  const differences = onlyServer.length + onlyShowcase.length + deadLinks.length + unserved.length;
  console.log(`\nИТОГ: ${differences === 0 ? 'ЗЕЛЁНЫЙ' : 'КРАСНЫЙ'}; расхождений=${differences}`);
  if (!controlsOk) {
    console.error('НЕ ПРОВЕРЕНО: известные контроли не подтвердились; общему итогу верить нельзя');
    process.exitCode = 2;
  } else if (differences > 0) {
    process.exitCode = 1;
  }
}

function selfTest() {
  const tests = [];
  const test = (name, condition) => tests.push({ name, condition: Boolean(condition) });

  const equal = compareSets(new Set(['/claw/']), new Set(['/claw/']));
  test('зелёный исход: одинаковые списки', equal.onlyServer.length === 0 && equal.onlyShowcase.length === 0);

  const orphan = compareSets(new Set(['/claw/', '/psy-admin-v2/']), new Set(['/claw/']));
  test('красный исход: серверная сирота', orphan.onlyServer.join() === '/psy-admin-v2/');

  const extra = compareSets(new Set(['/claw/']), new Set(['/claw/', '/missing/']));
  test('красный исход: лишняя ссылка витрины', extra.onlyShowcase.join() === '/missing/');

  const links = extractPageLinks(`
    <a href="/claw/">NEON CLAW</a>
    <a href="/psy-admin/">не v2</a>
    <script>const fake = '<a href="/psy-admin-v2/">нет</a>';</script>
    <!-- <a href="/psy-admin-v2/">нет</a> -->
  `, SITE);
  test('/claw/ найден по href, а не по имени', links.some((href) => routeKey(href) === '/claw/'));
  test('/psy-admin/ не покрывает /psy-admin-v2/', !links.some((href) => routeKey(href) === '/psy-admin-v2/'));

  const controlsOk = printControls(
    new Set(['/claw/', '/psy-admin-v2/']),
    new Set(['/claw/']),
    'КОНТРОЛИ ФОРМАТА И СРАВНЕНИЯ (ФИКСТУРА, НЕ ЖИВОЙ ЗАМЕР)',
  );
  test('числовые контроли дали ожидаемые зелёный и красный исходы', controlsOk);

  for (const item of tests) console.log(`${item.condition ? 'PASS' : 'FAIL'} ${item.name}`);
  const passed = tests.filter((item) => item.condition).length;
  console.log(`САМОПРОВЕРКА: ${passed}/${tests.length}`);
  if (passed !== tests.length) process.exitCode = 1;
}

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  usage();
} else if (args.length === 1 && args[0] === '--self-test') {
  selfTest();
} else if (args.length) {
  usage();
  process.exitCode = 2;
} else {
  runLive().catch((error) => {
    console.error(`НЕ ПРОВЕРЕНО: ${error.message}`);
    process.exitCode = 2;
  });
}
