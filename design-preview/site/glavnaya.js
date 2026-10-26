// Главная «Работа» — живость без слопа: почта из base64, появление при прокрутке, петли.
(function () {
  'use strict';
  // Почта контакта — base64 в data-mail, собирается в mailto через atob (не plaintext в разметке).
  for (const a of document.querySelectorAll('a[data-mail]')) {
    try { a.href = 'mailto:' + atob(a.dataset.mail); } catch (e) {}
  }

  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)');

  // Появление при прокрутке один раз (С5: прячет только при живом скрипте, html.js уже стоит).
  var reveal = [].slice.call(document.querySelectorAll('[data-reveal]'));
  if (reveal.length) {
    if (!('IntersectionObserver' in window) || (reduce && reduce.matches)) {
      reveal.forEach(function (el) { el.classList.add('seen'); });
    } else {
      var ro = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('seen'); ro.unobserve(e.target); } });
      }, { rootMargin: '0px 0px -8% 0px' });
      reveal.forEach(function (el) { ro.observe(el); });
    }
  }

  // Петли: видео стоят с autoplay muted loop playsinline (С9) — браузер сам заводит их, когда они
  // в зоне видимости, и не трогает скрытые. Своей паузой по видимости их НЕ дёргаем (конфликтует с
  // нативным автоплеем). Единственное вмешательство — prefers-reduced-motion: там видео держим на
  // паузе (показывается постер), и если браузер попробует завести — гасим.
  var vids = [].slice.call(document.querySelectorAll('.pmedia video, .hmedia video'));
  function freeze() {
    vids.forEach(function (v) {
      v.removeAttribute('autoplay');
      try { v.pause(); } catch (e) {}
    });
  }
  if (vids.length && reduce) {
    if (reduce.matches) {
      freeze();
      vids.forEach(function (v) { v.addEventListener('play', function () { try { v.pause(); } catch (e) {} }); });
    }
    if (reduce.addEventListener) reduce.addEventListener('change', function () { if (reduce.matches) freeze(); });
  }
})();
