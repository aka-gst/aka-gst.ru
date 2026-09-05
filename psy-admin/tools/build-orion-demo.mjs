import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outputRoot = resolve(here, "..");
const snapshot = "/Users/gst/dev/psy-ai-admin/reference/orion-center-public-snapshot";
const pages = {
  "index.html": "index.html",
  "schedule/index.html": "schedule.html",
  "psycluborion/index.html": "psycluborion.html",
  "pweducation/index.html": "pweducation.html",
  "consultation/index.html": "consultation.html",
  "services/index.html": "services.html",
  "programs/index.html": "programs.html",
};
const internal = new Set(["schedule", "psycluborion", "pweducation", "consultation", "services", "programs"]);
// Оставляем без домена намеренно: куда должен вести /contacts — решает
// владелец, вопрос у него с 4 сентября 2026. До ответа не трогаем, иначе
// уведём людей туда, куда никто не договаривался. Встречается 12 раз.
const bezDomena = new Set(["contacts"]);

function localHref(raw = "") {
  const decoded = raw.replace(/&amp;/g, "&");
  const found = decoded.match(/^https?:\/\/orion-center\.ru\/?([^?#]*)(.*)$/i);
  if (!found && !decoded.startsWith("/")) return raw;
  const path = (found ? found[1] : decoded).replace(/^\//, "").replace(/\/$/, "");
  const suffix = found ? found[2] : "";
  if (!path || path === "index.html") return `/psy-admin/${suffix}`;
  if (internal.has(path)) return `/psy-admin/${path}/${suffix}`;
  if (/members\/login|payment|pay|cart|order/i.test(decoded)) return "#psy-demo-notice";
  // Внешняя ссылка БЕЗ домена. Снимок Тильды хранит соседние страницы
  // заказчицы относительными («/alteredstates-online»), а на нашем адресе
  // такой путь ведёт в никуда: aka-gst.ru отдаёт 404. Раньше сюда попадал
  // `raw`, то есть ссылка оставалась битой — семь штук на pweducation.
  // Абсолютные ссылки на orion-center.ru этой ветки не достигают: их
  // разбирает `found` выше и возвращает как есть.
  if (!found && decoded.startsWith("/") && !bezDomena.has(path)) {
    return `https://orion-center.ru/${path}${suffix}`;
  }
  return raw;
}

function sanitise(html, widgetPath) {
  let page = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<script\b[^>]*\/?>/gi, "")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript\s*>/gi, "")
    .replace(/\sdata-tilda-formskey=(['"]).*?\1/gi, "")
    .replace(/<form\b[^>]*>/gi, '<section class="psy-demo-form" aria-label="Форма отключена в демонстрации">')
    .replace(/<\/form\s*>/gi, "</section>")
    .replace(/<(input|textarea|select)\b([^>]*)>/gi, '<$1$2 disabled aria-disabled="true">')
    .replace(/<button\b([^>]*)type=(['"])submit\2([^>]*)>/gi, '<button$1type="button"$3 disabled aria-disabled="true">');
  // Без Tilda JS ленивые изображения навсегда остаются двадцатипиксельными
  // превью. Подставляем уже указанный самой страницей оригинал.
  page = page.replace(/<img\b[^>]*>/gi, (tag) => {
    const original = tag.match(/\bdata-original=(['"])(.*?)\1/i)?.[2];
    return original ? tag.replace(/\bsrc=(['"])(.*?)\1/i, `src="${original}"`) : tag;
  });
  page = page.replace(/<[^>]+\bdata-original=(['"])(.*?)\1[^>]*>/gi, (tag, _quote, original) => (
    /background-image\s*:/i.test(tag)
      ? tag.replace(/background-image\s*:\s*url\((['"]?).*?\1\)/i, `background-image:url('${original}')`)
      : tag
  ));
  // Обложки Tilda хранят полноразмерный фон не в data-original, а в дочернем
  // carrier. Без tilda-cover JS внешний .t-cover иначе остаётся на превью 20px.
  const coverBackgrounds = new Map(
    [...page.matchAll(/data-content-cover-id=(['"])(\d+)\1[^>]*\bdata-content-cover-bg=(['"])(.*?)\3/gi)]
      .map((match) => [match[2], match[4]]),
  );
  page = page.replace(/<div\b([^>]*\bid=(['"])recorddiv(\d+)\2[^>]*)>/gi, (tag, attrs, _quote, id) => {
    const original = coverBackgrounds.get(id);
    if (!original || !/\bt-cover\b/i.test(attrs)) return tag;
    return /background-image\s*:/i.test(tag)
      ? tag.replace(/background-image\s*:\s*url\((['"]?).*?\1\)/i, `background-image:url('${original}')`)
      : tag.replace(/\sstyle=(['"])(.*?)\1/i, (_style, quote, body) => ` style=${quote}${body};background-image:url('${original}')${quote}`);
  });
  page = page.replace(/\bhref=(['"])(.*?)\1/gi, (_all, quote, href) => `href=${quote}${localHref(href)}${quote}`);
  page = page.replace(/<\/head>/i, `<style>
    /* Снимок больше не исполняет Tilda JS, поэтому раскрываем их стартовые
       hidden/animation-состояния CSS-правил. */
    html,body{max-width:100%;overflow-x:hidden}
    .t-records,.t-records_animated,.t-rec,.t396__elem,.t396__group,.t-animate{opacity:1!important;visibility:visible!important}
    #psy-demo-notice{position:fixed;z-index:2147482990;left:12px;bottom:12px;max-width:min(390px,calc(100vw - 24px));padding:10px 12px;border-radius:8px;background:#171420e8;color:#fff;font:12px/1.35 Arial,sans-serif;box-shadow:0 8px 28px #0005}#psy-demo-notice b{display:block;margin-bottom:2px}.psy-demo-form{opacity:.58;pointer-events:none}
  </style></head>`);
  page = page.replace(/<body\b([^>]*)>/i, `<body$1><aside id="psy-demo-notice"><b>Тестовая версия PsyAdmin</b>Не официальный сайт «Орион-С». Заявки поступают в тестовую панель; оплата, аналитика и личный кабинет отключены.</aside>`);
  const widget = `<script type="module" src="${widgetPath}?v=psy-widget-20260905-02"></script>`;
  const complete = page.includes("</body>") ? page.replace("</body>", `${widget}</body>`) : `${page}${widget}`;
  return complete.replace(/[ \t]+$/gm, "");
}

for (const [output, source] of Object.entries(pages)) {
  const target = resolve(outputRoot, output);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, sanitise(await readFile(resolve(snapshot, source), "utf8"), output === "index.html" ? "./psy-widget.js" : "../psy-widget.js"));
}
console.log(`Собрано ${Object.keys(pages).length} безопасных страниц Orion-S.`);
