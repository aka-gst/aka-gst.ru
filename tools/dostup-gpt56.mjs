#!/usr/bin/env node
/**
 * Сверяет опубликованные разделы с живыми ссылками главной витрины.
 * Запуск: node tools/dostup-gpt56.mjs
 * Контроли: node tools/dostup-gpt56.mjs --control /claw/
 *           node tools/dostup-gpt56.mjs --control /psy-admin-v2/
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const ORIGIN = 'https://aka-gst.ru';
const SSH_HOST = 'bonita';
const SITE_ROOT = '/opt/zakriva/caddy/site';
const control = process.argv.indexOf('--control');
const controlPath = control === -1 ? null : normalPath(process.argv[control + 1] || '');

function normalPath(value) {
  const url = new URL(value || '/', ORIGIN);
  if (url.origin !== ORIGIN) return null;
  const path = url.pathname.replace(/\/{2,}/g, '/');
  return path === '/' ? '/' : `${path.replace(/\/$/, '')}/`;
}

function hasHiddenAttribute(attributes) {
  return /\bhidden\b|\baria-hidden\s*=\s*["']?true\b|\bstyle\s*=\s*["'][^"']*(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(attributes);
}

function showcasePaths(html) {
  const paths = new Set();
  for (const match of html.matchAll(/<a\b([^>]*)>/gis)) {
    const attributes = match[1];
    const href = /\bhref\s*=\s*(["'])(.*?)\1/is.exec(attributes);
    if (!href || hasHiddenAttribute(attributes)) continue;
    const path = normalPath(href[2]);
    // Якорь витрины и переход на неё саму не являются отдельной вещью.
    if (path && path !== '/') paths.add(path);
  }
  return paths;
}

async function fetchWithRetry(path) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`${ORIGIN}${path}`, { redirect: 'follow' });
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  throw lastError;
}

async function serverRoutes() {
  // index.html — минимально проверяемая «вещь»: у неё есть самостоятельный URL.
  const command = `find ${SITE_ROOT} -mindepth 2 -type f -name index.html -printf '%P\\n' | sort`;
  const { stdout } = await execFileAsync('ssh', ['-o', 'BatchMode=yes', SSH_HOST, command]);
  return [...new Set(stdout.trim().split('\n').filter(Boolean)
    .map((file) => normalPath(`/${file.replace(/\/index\.html$/, '/')}`))
    .filter((path) => path && path !== '/'))];
}

async function main() {
  const [routes, showcaseResponse] = await Promise.all([serverRoutes(), fetchWithRetry('/')]);
  if (!showcaseResponse.ok) throw new Error(`витрина / ответила HTTP ${showcaseResponse.status}`);
  const links = showcasePaths(await showcaseResponse.text());

  const checks = await Promise.all(routes.map(async (path) => {
    try {
      const response = await fetchWithRetry(path);
      return [path, response.ok];
    } catch {
      return [path, false];
    }
  }));
  const live = new Set(checks.filter(([, ok]) => ok).map(([path]) => path));
  const serverOnly = [...live].filter((path) => !links.has(path)).sort();
  const showcaseOnly = [...links].filter((path) => !live.has(path)).sort();

  console.log(`SERVER ${live.size}/${routes.length} responding routes`);
  console.log(`SHOWCASE ${links.size} visible same-site links`);
  console.log(`SERVER_ONLY ${serverOnly.length}${serverOnly.length ? ` ${serverOnly.join(' ')}` : ''}`);
  console.log(`SHOWCASE_ONLY ${showcaseOnly.length}${showcaseOnly.length ? ` ${showcaseOnly.join(' ')}` : ''}`);

  if (controlPath) {
    const onServer = live.has(controlPath) ? 1 : 0;
    const onShowcase = links.has(controlPath) ? 1 : 0;
    const mismatch = onServer === onShowcase ? 0 : 1;
    console.log(`CONTROL ${controlPath} server=${onServer} showcase=${onShowcase} mismatch=${mismatch} ${mismatch ? 'RED' : 'GREEN'}`);
  }

  if (serverOnly.length || showcaseOnly.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`ERROR ${error.message}`);
  process.exitCode = 2;
});
