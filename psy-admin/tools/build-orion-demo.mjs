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
    /* Правим только известные блоки главной. Общие классы отступов Tilda не
       трогаем: предыдущая глобальная правка сжала несвязанные секции. */
    #rec908825596{padding-top:60px!important;padding-bottom:0!important;overflow:visible!important}
    #rec908825596 .t-cover,#rec908825596 .t-cover__carrier,#rec908825596 .t-cover__filter,
    #rec908825596 .t-container,#rec908825596 .t1120__col_center,#rec908825596 .t1120__wrapper{height:calc(100svh - 60px)!important;min-height:calc(100svh - 60px)!important}
    #rec908825596 .t1120__title,#rec908825596 .t1120__descr,#rec908825596 .t1120__buttons,#rec908825596 .t-btn{opacity:1!important;visibility:visible!important;transform:none!important}
    #rec623335436,#rec401787399,#rec605382040,#rec282808065{display:none!important}
    #rec282570514 [data-elem-id="1613643387114"] .tn-atom,
    #rec282570514 [data-elem-id="1474906621455"] .tn-atom,
    #rec282570514 [data-elem-id="1690964264025"] .tn-atom,
    #rec282570514 [data-elem-id="1690967422558"] .tn-atom{text-align:center!important}
    #rec1773910081{padding-top:24px!important;padding-bottom:32px!important}
    #rec1773910081 .t-btnflex{min-width:min(440px,calc(100vw - 32px))!important;min-height:60px!important;padding:14px 24px!important;font-size:18px!important;line-height:1.25!important}
    #rec729134751{padding-top:32px!important;padding-bottom:48px!important}
    #rec729134751 .t-section__container{height:auto!important}
    #rec729134751 .t-section__title{margin-bottom:40px!important}
    #rec759291094{padding-top:32px!important;padding-bottom:24px!important}
    #rec584106074{padding-top:24px!important;padding-bottom:32px!important}
    #rec623395186{padding-top:24px!important}
    #rec282788666{padding-top:28px!important;padding-bottom:28px!important}
    #rec401577081{padding-bottom:24px!important}
    #rec283510213{display:none!important}
    #rec288715564{padding-top:40px!important;padding-bottom:24px!important}
    #rec288715564 .t-section__container{height:auto!important}
    #rec288715564 .t-section__title{margin-bottom:40px!important}
    #rec288715564 .t-feed__buttons-wrapper{margin-top:28px!important}
    #rec283637376{padding-top:18px!important;padding-bottom:10px!important}
    #rec283637376 .t-container{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:28px!important}
    #rec283637376 .t-container::before,#rec283637376 .t-container::after{display:none!important}
    #rec283637376 .t567__col{float:none!important;width:auto!important;margin:0!important}
    #rec283637376 .t567__col-wrapper{display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:flex-start!important;height:100%!important;padding-top:0!important}
    #rec283637376 .t567__img{margin-bottom:10px!important}
    #rec283637377 .t345-content{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:32px!important;height:auto!important;min-height:0!important;padding:12px 0!important}
    #rec504823956{padding:4px 0!important}
    #rec307228255 .t396__artboard,#rec307228255 .t396__carrier,#rec307228255 .t396__filter{height:64px!important;min-height:64px!important}
    @media(max-width:767px){#rec1773853311 .t522__right-tablewrapper{display:flex!important;flex-direction:column!important;align-items:center!important;height:auto!important}#rec1773853311 .t522__personimgwrapper,#rec1773853311 .t522__img{width:140px!important;height:140px!important;border-radius:50%!important}#rec1773853311 .t522__personimgwrapper{overflow:hidden!important}#rec1773853311 .t522__img{background-position:center!important;background-size:cover!important}#rec1773853311 .t522__textwrapper{width:100%!important;padding-top:16px!important;text-align:center!important}#rec1773853311 .t522__persname,#rec1773853311 .t522__title{text-align:center!important}#rec283637376{padding:22px 20px 14px!important}#rec283637376 .t-container{grid-template-columns:1fr!important;gap:22px!important;width:100%!important;max-width:520px!important;margin:0 auto!important}#rec283637376 .t567__col,#rec283637376 .t567__col-wrapper{min-height:0!important}#rec283637377 .t345-content{display:grid!important;justify-items:center!important;gap:18px!important;padding:14px 0!important;text-align:center!important}#rec283637377 .t345-text__wrapper,#rec283637377 .t345-socials{float:none!important;width:auto!important;margin:0!important}}
    .orion-review-hint{display:none!important}

    /* Одна и та же реакция на все кнопки сайта. */
    .t-btn,.t-btnflex,.tn-elem[data-elem-type="button"] .tn-atom{transition:transform .22s ease,box-shadow .22s ease,filter .22s ease!important;will-change:transform}
    .t-btn:hover,.t-btnflex:hover,.tn-elem[data-elem-type="button"] .tn-atom:hover{transform:translateY(-3px);box-shadow:0 13px 28px rgba(31,0,166,.20)!important;filter:saturate(1.08)}
    .t-btn:active,.t-btnflex:active,.tn-elem[data-elem-type="button"] .tn-atom:active{transform:translateY(0) scale(.985)}
    .t-card__btn-wrapper{display:flex!important;justify-content:center!important;align-items:flex-end}
    .t-card__btn{min-width:172px;justify-content:center}

    /* Активная крошка не должна внезапно становиться оранжевой. */
    #rec285338838 .t758__link-item_active{color:#1f00a6!important}
    .t522__title a{color:#1f00a6!important}
    [style*="color: rgb(255, 126, 102)"],[style*="color:#ff7e66"],a[style*="#ff7e66"]{color:#1f00a6!important}

    /* Увеличиваем только соцсети; структуру футера оставляет Tilda. */
    #rec283637377 .t-sociallinks__item a,#rec283637377 .t-sociallinks__svg{width:42px!important;height:42px!important}
    #rec283637377 .t-sociallinks__svg path{fill:#1f00a6!important}
    @media (min-width:961px){
      #rec908825596 .t1120__col-left{position:relative!important;transform:translateY(-96px)!important}
      #rec908825596 .orion-hero-left-action{position:absolute!important;top:var(--orion-hero-action-top,calc(100% + 32px))!important;right:0!important;left:0!important;display:flex!important;justify-content:flex-start!important}
      #rec908825596 .orion-hero-left-action .t-btn{width:min(100%,360px)!important}
      #rec1773853311{padding-top:32px!important;padding-bottom:32px!important}
      #rec1773853311 .t-section__title{margin-bottom:16px!important}
      #rec1773853311 .t-section__descr{margin-bottom:0!important}
      #rec1773853311 .t522>.t-container:not(.t-section__container){box-sizing:border-box!important;display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:32px!important;width:min(1200px,calc(100% - 48px))!important;padding-top:24px!important;margin:0 auto!important}
      #rec1773853311 .t522>.t-container:not(.t-section__container)::before,#rec1773853311 .t522>.t-container:not(.t-section__container)::after{display:none!important}
      #rec1773853311 .t522__row{display:block!important;float:none!important;width:auto!important;height:auto!important;margin:0!important;opacity:1!important;transform:none!important}
      #rec1773853311 .t522__leftcol,#rec1773853311 .t522__line{display:none!important}
      #rec1773853311 .t522__rightcol{float:none!important;width:auto!important;height:auto!important;margin:0!important}
      #rec1773853311 .t522__right-tablewrapper{display:flex!important;flex-direction:column!important;align-items:center!important;width:100%!important;height:auto!important}
      #rec1773853311 .t522__personimgwrapper{display:block!important;width:140px!important;height:140px!important;overflow:hidden!important;border-radius:50%!important}
      #rec1773853311 .t522__img{width:140px!important;height:140px!important;border-radius:50%!important;background-position:center!important;background-size:cover!important}
      #rec1773853311 .t522__textwrapper{box-sizing:border-box!important;display:block!important;width:100%!important;height:auto!important;padding-top:16px!important;text-align:center!important}
      #rec1773853311 .t522__persname,#rec1773853311 .t522__title{text-align:center!important}
      #rec1773853311 .t522__persname{display:flex!important;align-items:center!important;justify-content:center!important;min-height:97px!important;font-size:28px!important;line-height:1.15!important}
      #rec1773853311 .t522__title{font-size:18px!important;line-height:1.45!important}
      #rec1773853311 .t-section__bottomwrapper{margin-top:24px!important}
    }
    @media (min-width:1200px){
      #rec282570514 .t396__artboard,#rec282570514 .t396__carrier,#rec282570514 .t396__filter{height:620px!important;min-height:620px!important}
      #rec282570514 [data-elem-id="1613643493683"],#rec282570514 [data-elem-id="1690964155999"],
      #rec282570514 [data-elem-id="1613644294582"],#rec282570514 [data-elem-id="1690962540232"],
      #rec282570514 [data-elem-id="1613643387114"],#rec282570514 [data-elem-id="1474906621455"],
      #rec282570514 [data-elem-id="1690964264025"],#rec282570514 [data-elem-id="1690967422558"],
      #rec282570514 [data-elem-id="1613643798757"],#rec282570514 [data-elem-id="1613643795239"],
      #rec282570514 [data-elem-id="1613643678385"],#rec282570514 [data-elem-id="1690962575043"]{transform:none!important}
      #rec282570514 [data-elem-id="1497357188037"]{top:30px!important}
      #rec282570514 [data-elem-id="1497357188044"]{top:104px!important}
      #rec282570514 [data-elem-id="1613643493683"],#rec282570514 [data-elem-id="1690964155999"],#rec282570514 [data-elem-id="1613644294582"],#rec282570514 [data-elem-id="1690962540232"]{top:190px!important}
      #rec282570514 [data-elem-id="1613643387114"],#rec282570514 [data-elem-id="1474906621455"],#rec282570514 [data-elem-id="1690964264025"],#rec282570514 [data-elem-id="1690967422558"]{top:435px!important}
      #rec282570514 [data-elem-id="1613643678385"],#rec282570514 [data-elem-id="1613643795239"],#rec282570514 [data-elem-id="1613643798757"],#rec282570514 [data-elem-id="1690962575043"]{top:535px!important;width:200px!important;height:60px!important}
      #rec282570514 [data-elem-id="1613643798757"]{left:calc(50% - 600px + 70px)!important}
      #rec282570514 [data-elem-id="1613643795239"]{left:calc(50% - 600px + 359px)!important}
      #rec282570514 [data-elem-id="1613643678385"]{left:calc(50% - 600px + 647px)!important}
      #rec282570514 [data-elem-id="1690962575043"]{left:calc(50% - 600px + 937px)!important}
      #rec282570514 [data-elem-id="1613643678385"] .tn-atom,#rec282570514 [data-elem-id="1613643795239"] .tn-atom,#rec282570514 [data-elem-id="1613643798757"] .tn-atom,#rec282570514 [data-elem-id="1690962575043"] .tn-atom{font-size:18px!important}
    }
    @media (max-width:767px){
      #rec282570514 .t396__artboard,#rec282570514 .t396__carrier,#rec282570514 .t396__filter{height:830px!important;min-height:830px!important}
      #rec282570514 [data-elem-id="1497357188037"]{left:20px!important;top:24px!important;width:calc(100% - 40px)!important;height:48px!important;transform:none!important}
      #rec282570514 [data-elem-id="1497357188044"]{left:20px!important;top:88px!important;width:calc(100% - 40px)!important;height:48px!important;transform:none!important}
      #rec282570514 [data-elem-id="1497357188037"] .tn-atom,#rec282570514 [data-elem-id="1497357188044"] .tn-atom{text-align:center!important}
      #rec282570514 [data-elem-id="1613643493683"],#rec282570514 [data-elem-id="1613644294582"],#rec282570514 [data-elem-id="1690964155999"],#rec282570514 [data-elem-id="1690962540232"]{width:calc(50% - 28px)!important;height:155px!important;transform:none!important}
      #rec282570514 [data-elem-id="1613643493683"],#rec282570514 [data-elem-id="1613644294582"]{left:20px!important}
      #rec282570514 [data-elem-id="1690964155999"],#rec282570514 [data-elem-id="1690962540232"]{left:calc(50% + 8px)!important}
      #rec282570514 [data-elem-id="1613643493683"],#rec282570514 [data-elem-id="1690964155999"]{top:150px!important}
      #rec282570514 [data-elem-id="1613644294582"],#rec282570514 [data-elem-id="1690962540232"]{top:480px!important}
      #rec282570514 [data-elem-id="1613643387114"],#rec282570514 [data-elem-id="1474906621455"],#rec282570514 [data-elem-id="1690964264025"],#rec282570514 [data-elem-id="1690967422558"]{width:calc(50% - 28px)!important;height:100px!important;transform:none!important}
      #rec282570514 [data-elem-id="1613643387114"],#rec282570514 [data-elem-id="1690964264025"]{left:20px!important}
      #rec282570514 [data-elem-id="1474906621455"],#rec282570514 [data-elem-id="1690967422558"]{left:calc(50% + 8px)!important}
      #rec282570514 [data-elem-id="1613643387114"],#rec282570514 [data-elem-id="1474906621455"]{top:315px!important}
      #rec282570514 [data-elem-id="1690964264025"],#rec282570514 [data-elem-id="1690967422558"]{top:645px!important}
      #rec282570514 [data-elem-id="1613643387114"] .tn-atom,#rec282570514 [data-elem-id="1474906621455"] .tn-atom,#rec282570514 [data-elem-id="1690964264025"] .tn-atom,#rec282570514 [data-elem-id="1690967422558"] .tn-atom{font-size:19px!important;line-height:1.12!important;text-align:center!important}
      #rec282570514 [data-elem-id="1613643678385"],#rec282570514 [data-elem-id="1613643795239"],#rec282570514 [data-elem-id="1613643798757"],#rec282570514 [data-elem-id="1690962575043"]{width:calc(50% - 28px)!important;height:55px!important;transform:none!important}
      #rec282570514 [data-elem-id="1613643678385"],#rec282570514 [data-elem-id="1613643798757"]{left:20px!important}
      #rec282570514 [data-elem-id="1613643795239"],#rec282570514 [data-elem-id="1690962575043"]{left:calc(50% + 8px)!important}
      #rec282570514 [data-elem-id="1613643678385"],#rec282570514 [data-elem-id="1613643795239"]{top:405px!important}
      #rec282570514 [data-elem-id="1613643798757"],#rec282570514 [data-elem-id="1690962575043"]{top:750px!important}
      #rec282570514 [data-elem-id="1693418956003"],#rec282570514 [data-elem-id="1693480480743"],#rec282570514 [data-elem-id="1693480617986"]{display:none!important}
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
  const widget = `${счётчик}<script type="module" src="${widgetPath}?v=psy-widget-20260913-22&theme=orion-blue-20260908"></script>`;
  const complete = page.includes("</body>") ? page.replace("</body>", `${widget}</body>`) : `${page}${widget}`;
  return complete.replace(/[ \t]+$/gm, "");
}

for (const [output, source] of Object.entries(pages)) {
  const target = resolve(outputRoot, output);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, sanitise(await readFile(resolve(snapshot, source), "utf8"), output === "index.html" ? "./psy-widget.js" : "../psy-widget.js"));
}
console.log(`Собрано ${Object.keys(pages).length} безопасных страниц Orion-S.`);
