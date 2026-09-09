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
  let imageIndex = 0;
  page = page.replace(/<img\b[^>]*>/gi, (tag) => {
    imageIndex += 1;
    const original = tag.match(/\bdata-original=(['"])(.*?)\1/i)?.[2];
    const sourceTag = original ? tag.replace(/\bsrc=(['"])(.*?)\1/i, `src="${original}"`) : tag;
    if (/\bdecoding=/i.test(sourceTag)) return sourceTag;
    const loading = imageIndex <= 2 ? 'fetchpriority="high" decoding="async"' : 'loading="lazy" decoding="async"';
    return sourceTag.replace(/\s*\/>$/, ` ${loading}>`);
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
  page = page
    .replace(/Отзывы клиентов\s*❤️/gi, "Отзывы")
    .replace(/Листайте отзывы/gi, "Отзывы");
  page = page.replace(/<\/head>/i, `<style data-orion-polish="20260909">
    /* Снимок больше не исполняет Tilda JS, поэтому раскрываем их стартовые
       hidden/animation-состояния CSS-правил. */
    html,body{max-width:100%;overflow-x:hidden}
    .t-records,.t-records_animated,.t-rec,.t396__elem,.t396__group,.t-animate{opacity:1!important;visibility:visible!important}
    #psy-demo-notice{position:fixed;z-index:2147482990;left:12px;bottom:12px;max-width:min(390px,calc(100vw - 24px));padding:10px 12px;border-radius:8px;background:#171420e8;color:#fff;font:12px/1.35 Arial,sans-serif;box-shadow:0 8px 28px #0005}#psy-demo-notice b{display:block;margin-bottom:2px}.psy-demo-form{opacity:.58;pointer-events:none}
    /* В статической копии Tilda feed не запускается. Пустой контейнер не
       должен оставлять вместо новостей экран пустоты; реальные карточки,
       если они появятся в разметке, автоматически вернут блок. */
    #rec288715564:has(.js-feed-container:empty){display:none}
    /* Экспортная сетка T522 подтягивает первую линию на 10px внутрь текста.
       Отступ относится только к списку расписания, не меняя сам текст. */
    #rec1773853311 .t522>.t-container:not(.t-section__container){padding-top:26px}
    /* Вертикальная сетка: большие экспортные отступы Tilda давали по экрану
       пустоты между связанными секциями. */
    .t-rec_pt_75,.t-rec_pt_90,.t-rec_pt_105,.t-rec_pt_120,.t-rec_pt_135,.t-rec_pt_150,.t-rec_pt_165,.t-rec_pt_180{padding-top:64px!important}
    .t-rec_pb_75,.t-rec_pb_90,.t-rec_pb_105,.t-rec_pb_120,.t-rec_pb_135,.t-rec_pb_150,.t-rec_pb_165,.t-rec_pb_180{padding-bottom:64px!important}
    #rec584106074{padding-top:34px!important;padding-bottom:34px!important}
    #rec759291094{padding-bottom:18px!important}
    #rec759291094 .t050__title>div{font-size:58px!important}
    #rec605382232,#rec605382040,#rec283508943,#rec283510213,#rec605379906{height:72px!important;min-height:72px!important;overflow:hidden}
    #rec603818649,#rec605379914,#rec605379977{display:none!important}
    #rec605382232 .t-cover,#rec605382232 .t-cover__carrier,#rec605382232 .t-cover__filter,#rec605382232 .t-cover__wrapper,
    #rec605382040 .t-cover,#rec605382040 .t-cover__carrier,#rec605382040 .t-cover__filter,#rec605382040 .t-cover__wrapper,
    #rec283508943 .t-cover,#rec283508943 .t-cover__carrier,#rec283508943 .t-cover__filter,#rec283508943 .t-cover__wrapper,
    #rec283510213 .t-cover,#rec283510213 .t-cover__carrier,#rec283510213 .t-cover__filter,#rec283510213 .t-cover__wrapper{height:72px!important;min-height:72px!important}
    #rec605379906 .t396__artboard,#rec605379906 .t396__filter,#rec605379906 .t396__carrier{height:72px!important;min-height:72px!important}
    #rec634096591{display:none!important}

    /* Одна и та же реакция на все кнопки сайта. */
    .t-btn,.t-btnflex,.tn-elem[data-elem-type="button"] .tn-atom{transition:transform .22s ease,box-shadow .22s ease,filter .22s ease!important;will-change:transform}
    .t-btn:hover,.t-btnflex:hover,.tn-elem[data-elem-type="button"] .tn-atom:hover{transform:translateY(-3px);box-shadow:0 13px 28px rgba(31,0,166,.20)!important;filter:saturate(1.08)}
    .t-btn:active,.t-btnflex:active,.tn-elem[data-elem-type="button"] .tn-atom:active{transform:translateY(0) scale(.985)}
    .t-card__btn-wrapper{display:flex!important;justify-content:center!important;align-items:flex-end}
    .t-card__btn{min-width:172px;justify-content:center}

    /* Три главных типа программ читаются как единый ряд, а не как случайная
       высокая колонка. Мобильная версия остаётся последовательной. */
    @media (min-width:960px){
      #rec1773853311 .t522>.t-container:not(.t-section__container){display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:28px;padding-top:28px}
      #rec1773853311 .t522__row{width:auto!important;margin:0!important;display:block}
      #rec1773853311 .t522__row_1{grid-column:1}
      #rec1773853311 .t522__row_2{grid-column:2}
      #rec1773853311 .t522__row_3{grid-column:3}
      #rec1773853311 .t522__leftcol{display:none}
      #rec1773853311 .t522__rightcol{float:none;width:100%!important;margin:0!important}
      #rec1773853311 .t522__right-tablewrapper{display:flex;flex-direction:column;align-items:center;text-align:center}
      #rec1773853311 .t522__personimgwrapper{float:none!important;margin:0 auto 24px!important}
      #rec1773853311 .t522__textwrapper{padding:0!important}
    }

    /* Активная крошка не должна внезапно становиться оранжевой. */
    #rec285338838 .t758__link-item_active{color:#1f00a6!important}
    .t522__title a{color:#1f00a6!important}
    [style*="color: rgb(255, 126, 102)"],[style*="color:#ff7e66"],a[style*="#ff7e66"]{color:#1f00a6!important}

    /* Нижняя часть страницы собирается в одну линию: юридический блок,
       рейтинг, оплата и крупные ссылки на соцсети. */
    #rec283637377,#rec504823956,#rec307228255{display:inline-block!important;vertical-align:middle;box-sizing:border-box}
    #rec283637377{width:46%;padding-left:max(24px,calc((100vw - 1200px)/2))}
    #rec504823956{width:18%}
    #rec307228255{width:34%}
    #rec283637377 .t345-content{height:auto!important;min-height:116px}
    #rec283637377 .t-sociallinks__item a,#rec283637377 .t-sociallinks__svg{width:42px!important;height:42px!important}
    #rec283637377 .t-sociallinks__svg path{fill:#1f00a6!important}
    #rec307228255 .t396__artboard,#rec307228255 .t396__filter,#rec307228255 .t396__carrier{height:116px!important}
    @media (max-width:959px){
      .t-rec_pt_75,.t-rec_pt_90,.t-rec_pt_105,.t-rec_pt_120,.t-rec_pt_135,.t-rec_pt_150,.t-rec_pt_165,.t-rec_pt_180{padding-top:42px!important}
      .t-rec_pb_75,.t-rec_pb_90,.t-rec_pb_105,.t-rec_pb_120,.t-rec_pb_135,.t-rec_pb_150,.t-rec_pb_165,.t-rec_pb_180{padding-bottom:42px!important}
      #rec759291094 .t050__title>div{font-size:42px!important}
      #rec283637377,#rec504823956,#rec307228255{display:block!important;width:100%;padding-left:0}
    }
    @media (max-width:479px){
      #rec908825596 .t1120__title>div{font-size:32px!important;line-height:1.1!important;word-break:normal!important;overflow-wrap:normal!important;hyphens:auto}
    }
    @media (prefers-reduced-motion:reduce){.t-btn,.t-btnflex,.tn-elem[data-elem-type="button"] .tn-atom{transition:none!important}.t-btn:hover,.t-btnflex:hover,.tn-elem[data-elem-type="button"] .tn-atom:hover{transform:none}}
  </style></head>`);
  page = page.replace(/<body\b([^>]*)>/i, `<body$1><aside id="psy-demo-notice"><b>Тестовая версия PsyAdmin</b>Не официальный сайт «Орион-С». Заявки поступают в тестовую панель; оплата и личный кабинет отключены.</aside>`);
  // Счётчик страниц. Он БЫЛ здесь (коммит f565a17) и пропал, когда страницу
  // пересобрали поверх снимка сайта заказчицы: sanitise вырезает из снимка
  // все script и возвращает только виджет. Возвращён 6 сентября по правилу 30
  // вместе со снятием слова «аналитика» из предупреждения — иначе страница
  // обещала бы человеку то, чего на ней уже нет.
  const счётчик = '<script defer src="/pulse/script.js" data-website-id="de024048-c4c3-4639-bbdf-808c558f6d71"></script>';
  const widget = `${счётчик}<script type="module" src="${widgetPath}?v=psy-widget-20260909-10&theme=orion-blue-20260908"></script>`;
  const complete = page.includes("</body>") ? page.replace("</body>", `${widget}</body>`) : `${page}${widget}`;
  return complete.replace(/[ \t]+$/gm, "");
}

for (const [output, source] of Object.entries(pages)) {
  const target = resolve(outputRoot, output);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, sanitise(await readFile(resolve(snapshot, source), "utf8"), output === "index.html" ? "./psy-widget.js" : "../psy-widget.js"));
}
console.log(`Собрано ${Object.keys(pages).length} безопасных страниц Orion-S.`);
