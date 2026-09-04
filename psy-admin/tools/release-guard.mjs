import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const RELEASE_PATTERN = /^psy-widget-(\d{8})-(\d+)$/;

function releaseParts(release) {
  const match = RELEASE_PATTERN.exec(release);
  if (!match) throw new Error(`некорректная метка ассетов: ${release}`);
  return [Number(match[1]), Number(match[2])];
}

export function compareReleaseVersions(left, right) {
  const [leftDate, leftRevision] = releaseParts(left);
  const [rightDate, rightRevision] = releaseParts(right);
  return Math.sign(leftDate - rightDate) || Math.sign(leftRevision - rightRevision);
}

export function auditRelease({ release, widget, contract, css }) {
  const errors = [];
  try {
    releaseParts(release);
  } catch (error) {
    errors.push(error.message);
    return errors;
  }
  if (!widget.includes(`widget-contract.js?v=${release}`)) errors.push("метка ассетов не совпадает с виджетом");
  if (!widget.includes(`widget.css?v=${release}`)) errors.push("метка CSS не совпадает с виджетом");
  if (!contract?.includes(`router.js?v=${release}`)) errors.push("метка router не совпадает с контрактом");
  if (!widget.includes('class="psy-widget-evaluation-toggle"') || !widget.includes('aria-expanded="false"')) {
    errors.push("кнопка проверочных вопросов не закрыта по умолчанию");
  }
  if (!widget.includes('id="psy-widget-evaluation-content" hidden')) errors.push("60 вопросов не скрыты до нажатия");
  if (!widget.includes("preparedQuestionCases")) errors.push("виджет не подключает 60 подготовленных вопросов");
  if (!css.includes("width: min(520px, calc(100vw - 32px));")) errors.push("панель должна быть шириной 520px на десктопе");
  if (css.includes("width: min(360px, calc(100vw - 32px));")) errors.push("в CSS осталась устаревшая панель 360px");
  if (!css.includes("grid-template-columns: repeat(4, minmax(0, 1fr));")) errors.push("на десктопе должны быть четыре равные кнопки записи");
  if (!css.includes("grid-template-columns: repeat(2, minmax(0, 1fr));")) errors.push("на телефоне должны быть две колонки кнопок записи");
  return errors;
}

export function auditPageReleases({ release, pages }) {
  const errors = [];
  for (const { path, source } of pages) {
    const releases = [...source.matchAll(/psy-widget\.js\?v=(psy-widget-\d{8}-\d+)/g)].map((match) => match[1]);
    if (releases.length === 0) {
      errors.push(`${path}: не подключён psy-widget.js`);
    } else if (releases.length !== 1) {
      errors.push(`${path}: psy-widget.js подключён ${releases.length} раз(а)`);
    } else if (releases[0] !== release) {
      errors.push(`${path}: метка виджета ${releases[0]} не совпадает с кандидатом ${release}`);
    }
  }
  return errors;
}

export function extractRelease(source, label) {
  const match = source.match(/(?:widget-contract|psy-widget)\.js\?v=(psy-widget-\d{8}-\d+)/);
  if (!match) throw new Error(`${label}: не найдена метка ассетов`);
  return match[1];
}

export async function fetchTextWithRetry(url, { fetchImpl = fetch, attempts = 3, timeoutMs = 7000 } = {}) {
  if (!Number.isInteger(attempts) || attempts < 1) throw new Error("число попыток должно быть положительным целым");
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error("превышен срок запроса")), timeoutMs);
    try {
      const response = await fetchImpl(url, { redirect: "follow", signal: controller.signal });
      if (!response.ok) throw new Error(`ответил ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`${url}: не удалось получить после ${attempts} попыток (${lastError?.message ?? "неизвестная ошибка"})`);
}

async function fetchLiveRelease(base) {
  const url = new URL("/psy-admin/", base);
  url.searchParams.set("psy_admin_release_guard", Date.now().toString());
  return extractRelease(await fetchTextWithRetry(url), "бой");
}

async function main() {
  const args = process.argv.slice(2);
  const index = args.indexOf("--live-base");
  const liveBase = index === -1 ? null : args[index + 1];
  if (index !== -1 && !liveBase) throw new Error("после --live-base нужен адрес");

  const psyAdminDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const pagePaths = [
    "index.html",
    "consultation/index.html",
    "programs/index.html",
    "psycluborion/index.html",
    "pweducation/index.html",
    "schedule/index.html",
    "services/index.html",
  ];
  const [widget, css, contract, ...pageSources] = await Promise.all([
    readFile(resolve(psyAdminDirectory, "psy-widget.js"), "utf8"),
    readFile(resolve(psyAdminDirectory, "widget.css"), "utf8"),
    readFile(resolve(psyAdminDirectory, "widget-contract.js"), "utf8"),
    ...pagePaths.map((path) => readFile(resolve(psyAdminDirectory, path), "utf8")),
  ]);
  const release = extractRelease(widget, "кандидат");
  const errors = [
    ...auditRelease({ release, widget, contract, css }),
    ...auditPageReleases({ release, pages: pagePaths.map((path, index) => ({ path, source: pageSources[index] })) }),
  ];
  if (errors.length) throw new Error(errors.join("; "));

  if (liveBase) {
    const liveRelease = await fetchLiveRelease(liveBase);
    if (compareReleaseVersions(release, liveRelease) < 0) {
      throw new Error(`кандидат ${release} старее боя ${liveRelease}: выкладка отменена`);
    }
    console.log(`psy-admin release guard: кандидат ${release}; бой ${liveRelease}; понижения версии нет`);
    return;
  }
  console.log(`psy-admin release guard: кандидат ${release}; локальная структура верна`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`psy-admin release guard: ${error.message}`);
    process.exitCode = 1;
  });
}
