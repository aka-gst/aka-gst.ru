// aka-gst — клиентский слой поверх статики, собранной build.mjs.
(() => {
  'use strict';

  const root = document.documentElement;
  const STORE = 'aka-gst:track';

  // ── Переключатель «Работа / Игры» ─────────────────────────────────
  const titles = {
    work: 'aka-gst — AI/LLM QA и автоматизация',
    play: 'aka-gst — игры в браузере',
  };

  const setTrack = (track, { push = true } = {}) => {
    if (track !== 'work' && track !== 'play') return;
    root.dataset.track = track;
    document.title = titles[track];
    try {
      localStorage.setItem(STORE, track);
    } catch (e) {}
    if (push) {
      const hash = track === 'play' ? '#games' : '#work';
      if (location.hash !== hash) history.replaceState(null, '', hash);
    }
    document.querySelectorAll('[data-track-to]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.trackTo === track));
    });
  };

  document.querySelectorAll('[data-track-to]').forEach((button) => {
    button.addEventListener('click', () => {
      setTrack(button.dataset.trackTo);
      scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  setTrack(root.dataset.track || 'work', { push: false });
  addEventListener('hashchange', () => {
    if (location.hash === '#games') setTrack('play', { push: false });
    if (location.hash === '#work') setTrack('work', { push: false });
  });

  // ── Живые метрики прогона ─────────────────────────────────────────
  // Страница уже собрана со снимком data/qa-metrics.json. Если CI успел
  // опубликовать более свежий отчёт — заменяем значения на месте.
  const FEED = 'https://aka-gst.github.io/local-agent-gateway/qa-metrics.json';

  const formatMoment = (iso) => {
    const date = new Date(iso);
    if (Number.isNaN(date.valueOf())) return iso;
    return date.toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const stamp = document.querySelector('[data-metric-updated]');
  if (stamp) stamp.textContent = formatMoment(stamp.getAttribute('datetime'));

  const renderReport = (report) => {
    for (const card of report.headline || []) {
      const node = document.querySelector(`[data-metric="${card.key}"]`);
      if (!node) continue;
      node.querySelector('.value').textContent = card.display;
      node.querySelector('.label').textContent = card.label.ru;
      node.querySelector('.note').textContent = card.note.ru;
      node.dataset.status = card.status;
    }

    const verdict = document.querySelector('[data-metric-verdict]');
    if (verdict && report.tests) {
      verdict.textContent = `${report.tests.passed} passed · ${report.tests.failed} failed · ${report.tests.duration_ms} ms`;
      verdict.dataset.status = report.status;
    }

    const version = document.querySelector('[data-metric-version]');
    if (version && report.project?.version) version.textContent = `v${report.project.version}`;

    const run = document.querySelector('[data-metric-run]');
    if (run && report.commit?.run_url) run.href = report.commit.run_url;

    if (stamp && report.generated_at) {
      stamp.setAttribute('datetime', report.generated_at);
      stamp.textContent = formatMoment(report.generated_at);
    }
  };

  if (document.querySelector('[data-metric]')) {
    fetch(FEED, { cache: 'no-cache' })
      .then((response) => (response.ok ? response.json() : null))
      .then((live) => {
        // Принимаем только знакомую схему: чужой ответ не должен рисовать цифры.
        if (live && live.schema === 'aka-gst.qa-metrics/1') renderReport(live);
      })
      .catch(() => {});
  }

  // ── Прокрутка по блокам и проявление ─────────────────────────────
  const секции = [...document.querySelectorAll('.report, .block')];

  // Раздел выше экрана привязывать нельзя: прокрутка внутри него должна
  // оставаться свободной. Меряем, а не угадываем по числу карточек.
  const пометитьВысокие = () => {
    // Порог — вся высота окна, а не доля от неё. С 85% на обычном ноутбуке
    // почти каждый раздел оказывался «высоким», и привязка отключалась
    // везде, то есть выглядела как неработающая.
    // Нижняя граница на случай, если высота окна ещё не определена: без неё
    // порог схлопывается в ноль и высокими становятся все разделы подряд.
    const порог = Math.max(innerHeight, 480);
    секции.forEach((s) => s.classList.toggle('is-tall', s.offsetHeight > порог));
  };
  пометитьВысокие();
  addEventListener('resize', пометитьВысокие);
  // Замер зависит от того, когда он выполнен: до загрузки шрифтов высоты
  // другие, а скрытая панель меряется в ноль. Поэтому пересчитываем ещё раз
  // после отрисовки и после готовности шрифтов — дважды лишний раз дешевле,
  // чем один раз не вовремя.
  requestAnimationFrame(пометитьВысокие);
  addEventListener('load', пометитьВысокие);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(пометитьВысокие);
  // Скрытая панель меряется в ноль, поэтому при загрузке размечается только
  // активный трек. Пересчитываем после переключения — обработчик добавлен
  // вторым, так что отработает уже по новому треку.
  document.querySelectorAll('[data-track-to]').forEach((кнопка) =>
    кнопка.addEventListener('click', () => requestAnimationFrame(пометитьВысокие))
  );

  const движениеРазрешено = !matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Проявление ставим только если браузер умеет наблюдать за видимостью и
  // человек не просил убрать движение. Класс вешает скрипт, а не разметка:
  // не выполнится — содержимое просто останется видимым.
  if ('IntersectionObserver' in window && движениеРазрешено) {
    const показать = (el) => {
      el.classList.add('is-visible');
      наблюдатель.unobserve(el);
    };
    const наблюдатель = new IntersectionObserver(
      (записи) => записи.forEach((з) => з.isIntersecting && показать(з.target)),
      { rootMargin: '0px 0px -12% 0px' }
    );
    секции.forEach((s) => {
      s.dataset.reveal = '';
      наблюдатель.observe(s);
    });
    // Предохранитель: если наблюдатель почему-то не сработает, через две
    // секунды показываем всё. Невидимая страница хуже отсутствия анимации.
    setTimeout(() => секции.forEach((s) => s.classList.add('is-visible')), 2000);
  }

  // ── Рекорды дня ───────────────────────────────────────────────────
  const scoreUrl = (game, limit) =>
    `/api/leaderboard/scores?game=${encodeURIComponent(game)}&period=today&limit=${limit}`;

  const coinToday = document.querySelector('#coin-today');
  if (coinToday) {
    fetch(scoreUrl('coin-flip', 3))
      .then((r) => r.json())
      .then(({ scores = [] }) => {
        if (!scores.length) return;
        coinToday.replaceChildren(
          ...scores.map((entry, index) => {
            const li = document.createElement('li');
            const name = document.createElement('span');
            const score = document.createElement('b');
            name.textContent = `${index + 1}. ${entry.nickname}`;
            score.textContent = entry.score;
            li.append(name, score);
            return li;
          })
        );
      })
      .catch(() => {});
  }

  document.querySelectorAll('#other-today [data-game]').forEach((row) => {
    fetch(scoreUrl(row.dataset.game, 1))
      .then((r) => r.json())
      .then(({ scores = [] }) => {
        if (scores[0]) row.querySelector('b').textContent = `${scores[0].nickname} · ${scores[0].score}`;
      })
      .catch(() => {});
  });

  // ── Подсветка карточки, на которой остановились ──────────────────
  // Раньше класс пересчитывался на каждом кадре прокрутки, и анимации
  // проигрывались волной по очереди, пока листаешь. Теперь наоборот: в
  // движении гасим все, а включаем ту, что оказалась в центре, когда
  // прокрутка остановилась.
  const gameCards = [...document.querySelectorAll('a.gcard')];
  if (gameCards.length) {
    let dwell;

    const снять = () => gameCards.forEach((c) => c.classList.remove('is-mobile-active'));

    const включитьЦентральную = () => {
      if (!matchMedia('(hover:none)').matches) return снять();
      const центр = innerHeight / 2;
      let лучшая = null;
      let ближе = Infinity;
      for (const card of gameCards) {
        const r = card.getBoundingClientRect();
        if (r.bottom <= 0 || r.top >= innerHeight) continue;
        const d = Math.abs(r.top + r.height / 2 - центр);
        if (d < ближе) { ближе = d; лучшая = card; }
      }
      gameCards.forEach((c) => c.classList.toggle('is-mobile-active', c === лучшая));
    };

    const приДвижении = () => {
      снять();
      clearTimeout(dwell);
      // Инерция продолжает слать события и сбрасывать таймер, поэтому
      // подсветка включится только когда палец отпущен и страница встала.
      dwell = setTimeout(включитьЦентральную, 220);
    };

    addEventListener('scroll', приДвижении, { passive: true });
    addEventListener('resize', приДвижении);
    включитьЦентральную();
  }


})();
