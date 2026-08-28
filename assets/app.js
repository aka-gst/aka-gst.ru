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

  // ── Подсветка карточки в центре экрана на тач-устройствах ─────────
  const gameCards = [...document.querySelectorAll('a.gcard')];
  if (gameCards.length) {
    let queued = false;
    const activate = () => {
      queued = false;
      if (!matchMedia('(hover:none)').matches) {
        gameCards.forEach((card) => card.classList.remove('is-mobile-active'));
        return;
      }
      const center = innerHeight / 2;
      let best = null;
      let bestDistance = Infinity;
      gameCards.forEach((card) => {
        const rect = card.getBoundingClientRect();
        if (rect.bottom <= 0 || rect.top >= innerHeight) return;
        const distance = Math.abs(rect.top + rect.height / 2 - center);
        if (distance < bestDistance) {
          best = card;
          bestDistance = distance;
        }
      });
      gameCards.forEach((card) => card.classList.toggle('is-mobile-active', card === best));
    };
    const queue = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(activate);
    };
    addEventListener('scroll', queue, { passive: true });
    addEventListener('resize', queue);
    activate();
  }

})();
