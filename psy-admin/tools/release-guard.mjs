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
  // Роутер подключают и виджет, и контракт: разные метки — два экземпляра модуля в браузере.
  for (const match of widget.matchAll(/router\.js\?v=(psy-widget-\d{8}-\d+)/g)) {
    if (match[1] !== release) errors.push("метка router в виджете не совпадает с контрактом");
  }
  if (!widget.includes('<label for="psy-widget-evaluation-select">Частые вопросы</label>')) {
    errors.push("нет единственного списка «Частые вопросы»");
  }
  if (!widget.includes('class="psy-widget-evaluation-select"')) errors.push("не подключён список частых вопросов");
  if (/psy-widget-evaluation-toggle|psy-widget-evaluation-content|60 проверочных вопросов/.test(widget)) {
    errors.push("в виджете остался старый проверочный интерфейс");
  }
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

// С 29.09 виджет — два файла: загрузчик psy-widget.js (его подключают страницы)
// и модуль psy-widget-app.js (разметка, контракт, CSS). Метка загрузчика у
// страниц своя, метка модуля — в импорте внутри загрузчика: её и сверяем с боем.
export function extractAppRelease(loader, label) {
  const match = loader.match(/psy-widget-app\.js\?v=(psy-widget-\d{8}-\d+)/);
  if (!match) throw new Error(`${label}: загрузчик не подключает psy-widget-app.js с меткой`);
  return match[1];
}

export function auditLoader({ loader, appRelease }) {
  const imports = [...loader.matchAll(/psy-widget-app\.js\?v=(psy-widget-\d{8}-\d+)/g)].map((m) => m[1]);
  if (imports.length !== 1) return [`загрузчик подключает psy-widget-app.js ${imports.length} раз(а)`];
  return imports[0] === appRelease ? [] : ["метка модуля в загрузчике не совпадает с кандидатом"];
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

async function fetchLiveAppRelease(base) {
  const url = new URL("/psy-admin/psy-widget.js", base);
  url.searchParams.set("psy_admin_release_guard", Date.now().toString());
  return extractAppRelease(await fetchTextWithRetry(url), "бой");
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
  const [loader, app, css, contract, ...pageSources] = await Promise.all([
    readFile(resolve(psyAdminDirectory, "psy-widget.js"), "utf8"),
    readFile(resolve(psyAdminDirectory, "psy-widget-app.js"), "utf8"),
    readFile(resolve(psyAdminDirectory, "widget.css"), "utf8"),
    readFile(resolve(psyAdminDirectory, "widget-contract.js"), "utf8"),
    ...pagePaths.map((path) => readFile(resolve(psyAdminDirectory, path), "utf8")),
  ]);
  const widget = `${loader}\n${app}`;
  const release = extractRelease(app, "кандидат");          // метка контракта, CSS и роутера внутри модуля
  const appRelease = extractAppRelease(loader, "кандидат"); // метка модуля в загрузчике
  const pages = pagePaths.map((path, index) => ({ path, source: pageSources[index] }));
  const pageRelease = extractRelease(pages[0].source, pages[0].path); // метка загрузчика у страниц
  const errors = [
    ...auditLoader({ loader, appRelease }),
    ...auditRelease({ release, widget, contract, css }),
    ...auditPageReleases({ release: pageRelease, pages }),
  ];
  if (errors.length) throw new Error(errors.join("; "));

  if (liveBase) {
    const [livePage, liveApp] = await Promise.all([fetchLiveRelease(liveBase), fetchLiveAppRelease(liveBase)]);
    if (compareReleaseVersions(pageRelease, livePage) < 0) {
      throw new Error(`страницы ${pageRelease} старее боя ${livePage}: выкладка отменена`);
    }
    if (compareReleaseVersions(appRelease, liveApp) < 0) {
      throw new Error(`модуль ${appRelease} старее боя ${liveApp}: выкладка отменена`);
    }
    console.log(`psy-admin release guard: модуль ${appRelease} (бой ${liveApp}), страницы ${pageRelease} (бой ${livePage}), ресурсы ${release}; понижения версии нет`);
    return;
  }
  console.log(`psy-admin release guard: модуль ${appRelease}, страницы ${pageRelease}, ресурсы ${release}; локальная структура верна`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`psy-admin release guard: ${error.message}`);
    process.exitCode = 1;
  });
}
