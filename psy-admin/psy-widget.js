// Точка входа, которую Tilda подключает одним <script type="module"> на
// orion-center.ru. Здесь — только то, что не имеет права зависеть от
// голосового помощника: правка хедера и заголовка героя. Сама логика
// ассистента (импорты widget-contract/router/voice-bank) переехала в
// psy-widget-app.js и грузится динамическим import() ниже.
//
// Почему так, а не два отдельных <script> тега: второй тег пришлось бы
// вставлять в настройки самой Tilda (кастомный код проекта), а туда у
// меня нет доступа — только к файлам на aka-gst.ru. Динамический импорт
// решает ту же задачу тем же единственным тегом: статический import в
// ES-модуле обязан быть в начале файла и валиться целиком, если сорвался
// любой из них (так было раньше — CORS на voice-bank.js рвал весь модуль,
// и вместе с помощником отключалась правка хедера, к которой он вообще не
// имеет отношения). import() — обычный вызов, его падение ловится try/catch
// и не трогает код, который выполнился до него.
//
// Настоящая причина наездов в шапке — не про этот файл вовсе: в самом
// Tilda-проекте после 7 сентября 2026 завёлся ДУБЛЬ блока меню
// (rec3822213101, точная копия rec300329466, тот же класс
// t-screenmin-480px). Родной CSS Tilda показывает оба разом на любой
// ширине от 480px — это и есть источник многолетних жалоб на «наезжающий
// хедер». Ниже — только маскировка после отрисовки, не устранение
// причины. Настоящий фикс — открыть Zero Block этой страницы в Tilda и
// удалить дубль меню руками; сделать это можно только из редактора Tilda.
function applyHostPagePolish() {
  const isLiveOrion = /(^|\.)orion-center\.ru$/i.test(window.location.hostname);
  const isLocalDemo = /^(127\.0\.0\.1|localhost)$/i.test(window.location.hostname) && /^\/psy-admin\//i.test(window.location.pathname);
  if (!isLiveOrion && !isLocalDemo) return;
  document.documentElement.dataset.orionHostPolish = "20260909";

  // Старая версия пыталась угадывать дубль по высоте .r-записи в момент
  // вызова — у Tilda эти обёртки-записи ВСЕГДА нулевой высоты (реальное
  // меню рисуется их содержимым по-другому), так что фильтр по height>0
  // никогда не находил ни одной "видимой" записи и ничего не прятал.
  // Дубль известен точно и по имени: rec3822213101 — байт-в-байт копия
  // rec300329466 (тот же t-screenmin-480px, те же 9 пунктов меню),
  // появившаяся в Tilda-проекте после 7 сентября 2026. Прячем её прямо —
  // без гадания, без зависимости от того, что и когда отрисовала Tilda.
  // В черновике Tilda старый блок rec300329466 уже выключен; после
  // публикации шапки rec3822213101 останется единственным десктопным меню
  // и прятать его будет нельзя. Прячем только пока оба на странице.
  const originalMenu = document.getElementById("rec300329466");
  const duplicateMenu = document.getElementById("rec3822213101");
  if (originalMenu && duplicateMenu) duplicateMenu.style.display = "none";

  document.querySelectorAll(".t-title,.t-name,.t-descr,[field],.orion-review-hint").forEach((element) => {
    const text = element.textContent.replace(/\s+/g, " ").trim();
    if (/^Отзывы клиентов\s*❤️?$/iu.test(text)) element.textContent = "Отзывы";
    if (/^Листайте отзывы$/iu.test(text)) element.remove();
  });

  document.querySelectorAll("img").forEach((image, index) => {
    image.decoding = "async";
    if (index > 1 && !image.hasAttribute("fetchpriority")) image.loading = "lazy";
  });

  // Раньше кнопка "Расписание центра" подгонялась JS под высоту правой
  // колонки (position:absolute + вычисленный --orion-hero-action-top).
  // При заголовке на 5-6 строк это либо клало кнопку поверх текста, либо
  // отрывало её от заголовка на непредсказуемую высоту — визуально «кнопки
  // на разной высоте». Теперь кнопка просто в обычном потоке сразу под
  // заголовком (CSS: margin-top в widget.css) — она никогда не наедет на
  // текст и всегда на одном и том же расстоянии от него, вне зависимости
  // от длины заголовка и того, что делает правая колонка.
  const hero = document.querySelector('#allrecords[data-tilda-page-id="17421901"] #rec908825596');
  const heroLeft = hero?.querySelector(".t1120__col-left");
  const heroTitle = heroLeft?.querySelector(".t1120__title");
  const scheduleButton = hero?.querySelector(".t-btnflex_type_button2");
  if (heroLeft && heroTitle && scheduleButton) {
    let leftAction = heroLeft.querySelector(".orion-hero-left-action");
    if (!leftAction) {
      leftAction = document.createElement("div");
      leftAction.className = "orion-hero-left-action";
      heroTitle.insertAdjacentElement("afterend", leftAction);
    }
    if (scheduleButton.parentElement !== leftAction) leftAction.append(scheduleButton);
  }

  if (/^\/pweducation\/?$/i.test(window.location.pathname) && !document.querySelector(".orion-polish-homebar")) {
    const nav = document.createElement("nav");
    nav.className = "orion-polish-homebar";
    nav.setAttribute("aria-label", "Навигация центра Орион-С");
    nav.innerHTML = '<a class="orion-polish-homebar__brand" href="/">Орион-С</a><a href="/">Главная</a><a href="/schedule">Расписание</a><a href="/consultation">Психологи</a><a href="/contacts">Контакты</a>';
    document.body.prepend(nav);
  }

  if (!window.__orionHostPolishResizeBound) {
    window.__orionHostPolishResizeBound = true;
    window.addEventListener("resize", applyHostPagePolish, { passive: true });
  }
}

// Без блокирующих import'ов этот скрипт стартует раньше, чем Tilda сама
// успевает проставить видимость своих блоков меню (её собственный рантайм
// грузится и решает это отдельно, без гарантированного момента). Фиксированные
// паузы 800/1800ms были подобраны на глаз под старую, более медленную
// последовательность и ничего не гарантируют. Вместо угадывания — слушаем
// сам хедер: как только Tilda что-то в нём меняет, пробуем снова.
const header = document.getElementById("t-header");
if (header && !window.__orionHostPolishObserverBound) {
  window.__orionHostPolishObserverBound = true;
  let polishing = false;
  const observer = new MutationObserver(() => {
    // Сама правка тоже трогает классы внутри хедера (orion-mobile-menu-*) —
    // без этого флага наблюдатель реагировал бы сам на себя бесконечно.
    if (polishing) return;
    polishing = true;
    observer.disconnect();
    applyHostPagePolish();
    observer.observe(header, { attributes: true, attributeFilter: ["class", "style"], childList: true, subtree: true });
    polishing = false;
  });
  observer.observe(header, { attributes: true, attributeFilter: ["class", "style"], childList: true, subtree: true });
}

applyHostPagePolish();
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", applyHostPagePolish, { once: true });
window.addEventListener("load", applyHostPagePolish, { once: true });
window.setTimeout(applyHostPagePolish, 800);
window.setTimeout(applyHostPagePolish, 1800);

try {
  await import(new URL("./psy-widget-app.js?v=psy-widget-20260913-24", import.meta.url).href);
} catch (error) {
  console.error("Голосовой помощник не загрузился, хедер и вёрстка страницы этим не затронуты:", error);
}
