// aka-gst — клиентский слой поверх статики, собранной build.mjs.
(() => {
  'use strict';

  const root = document.documentElement;
  const STORE = 'aka-gst:track';

  // ── Переключатель «Работа / Игры / Рассказы» ──────────────────────
  const titles = {
    work: 'aka-gst — Архитектор AI-продуктов и агентных систем',
    play: 'aka-gst — игры в браузере',
    stories: 'aka-gst — рассказы Сергея Гостова',
  };

  const setTrack = (track, { push = true } = {}) => {
    if (!['work', 'play', 'stories'].includes(track)) return;
    root.dataset.track = track;
    document.title = titles[track];
    const markKey = track === 'play' ? 'markPlay' : track === 'stories' ? 'markStories' : 'markWork';
    document.querySelectorAll('[data-brand-mark]').forEach((mark) => {
      if (mark.dataset[markKey]) mark.src = mark.dataset[markKey];
    });
    try {
      localStorage.setItem(STORE, track);
    } catch (e) {}
    if (push) {
      const hash = track === 'play' ? '#games' : track === 'stories' ? '#stories' : '#work';
      if (location.hash !== hash) history.replaceState(null, '', hash);
    }
    document.querySelectorAll('[data-track-to]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.trackTo === track));
    });
  };

  document.querySelectorAll('[data-track-to]').forEach((button) => {
    button.addEventListener('click', () => {
      setTrack(button.dataset.trackTo);
      scrollTo({ top: 0 });
    });
  });

  setTrack(root.dataset.track || 'work', { push: false });
  addEventListener('hashchange', () => {
    if (location.hash === '#games') setTrack('play', { push: false });
    if (location.hash === '#work') setTrack('work', { push: false });
    if (location.hash === '#stories') setTrack('stories', { push: false });
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

  // Высота прилипшей шапки — в переменную, чтобы отступ прыжка по якорю
  // считался от неё, а не от вписанного числа. На телефоне шапка
  // переносится и вырастает с 71 до 128, и константа промахивалась ровно
  // на разницу: заголовок уезжал под шапку целиком.
  const мерятьШапку = () => {
    const шапка = document.querySelector('.topbar');
    if (!шапка) return;
    const h = Math.round(шапка.getBoundingClientRect().height);
    if (h > 0) document.documentElement.style.setProperty('--shapka', `${h}px`);
  };
  мерятьШапку();
  addEventListener('resize', мерятьШапку);
  addEventListener('load', мерятьШапку);
  // До готовности шрифтов высота другая: строка ещё не перенеслась.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(мерятьШапку);

  // Замер высоты разделов убран вместе с магнитом прокрутки 31 августа:
  // класс is-tall существовал только чтобы снимать привязку с раздела,
  // который не помещается под шапкой. Привязки нет — замер не читает никто,
  // а мёртвая машинерия через месяц выглядит нужной и её начинают чинить.
  //
  // Что стоило тех сорока строк, чтобы не платить дважды, если магнит
  // захотят вернуть: жёсткая привязка (mandatory) делает раздел выше экрана
  // нечитаемым — прокрутка упирается; proximity без scroll-snap-stop: always
  // почти не срабатывает при инерционной прокрутке трекпадом; а порог
  // «помещается ли раздел» надо считать от высоты ПОД шапкой, а не от всего
  // окна — раздел в 853px при экране 900 проходил как помещающийся, хотя
  // под шапкой ему доступно 829, и приезжал обрезанным снизу.

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

  // ── Подсветка карточки, на которой остановились ──────────────────
  // Класс один на оба способа ввода, и в стилях у игровых карточек нет
  // :hover. Так вышло из двух ошибок сразу: на тач-экранах :hover
  // залипает на карточке после касания, и анимировались две — залипшая
  // и та, на которой остановились; а вторая копия каждого правила рядом
  // с классом жила бы своей жизнью при первой же правке.
  // Карточки с петлёй. Игровые — все, рабочие — только те, у которых
  // ролик правда снят: сборка не ставит <video> без файла, а пустой слой
  // хуже статичного снимка. Так механизм включается сам, когда клип
  // появится, и молчит, пока его нет.
  const gameCards = [
    ...document.querySelectorAll('a.gcard'),
    ...[...document.querySelectorAll('.card')].filter((c) => c.querySelector('.gclip')),
  ];
  if (gameCards.length) {
    let dwell;
    let текущая = null;

    // На ощупь — палец, иначе мышь. Проверяем при каждом событии, а не
    // один раз при загрузке: к планшету могли подключить мышь.
    const наОщупь = () => matchMedia('(hover: none)').matches;

    // Ролик с куском игры. Адрес лежит в data-src и подставляется при первом
    // наведении: иначе восемь роликов тянулись бы при загрузке страницы ради
    // того, что большинство посетителей не откроет.
    const ролик = (карточка, включить) => {
      const v = карточка && карточка.querySelector('.gclip');
      if (!v) return;
      if (!включить) {
        v.pause();
        v.classList.remove('is-playing');
        return;
      }
      if (!движениеРазрешено) return;
      if (!v.src && v.dataset.src) v.src = v.dataset.src;
      v.classList.add('is-playing');
      // play() возвращает обещание и может отказать — например, если вкладку
      // увели раньше, чем ролик успел начаться. Тогда просто прячем слой.
      const начат = v.play();
      if (начат && начат.catch) начат.catch(() => v.classList.remove('is-playing'));
    };

    // Прогрев. Замер Тестера: первое наведение на карточку стоит около
    // 900 мс против 120–230 на последующих — всё это время файл только
    // едет, а человек смотрит на неподвижный кадр и решает, что превью
    // мёртвое. Начинаем качать, когда карточка показалась на экране: к
    // моменту, когда до неё доведут мышь, она уже готова.
    //
    // Только там, где наведение вообще есть, и только если человек не
    // просил экономить трафик. На телефоне наведения нет, а качать по
    // мобильной сети то, чего никто не просил, — плохой обмен.
    const экономят = () => {
      const c = navigator.connection;
      return Boolean(c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || '')));
    };
    if (!наОщупь() && движениеРазрешено && !экономят() && 'IntersectionObserver' in window) {
      const прогрев = new IntersectionObserver((записи) => {
        for (const з of записи) {
          if (!з.isIntersecting) continue;
          const v = з.target.querySelector('.gclip');
          if (v && !v.src && v.dataset.src) v.src = v.dataset.src;
          прогрев.unobserve(з.target);
        }
      }, { rootMargin: '300px' });
      for (const c of gameCards) if (c.querySelector('.gclip')) прогрев.observe(c);
    }

    const подсветить = (карточка) => {
      // Ту же карточку не трогаем: снять и вернуть класс — значит
      // запустить анимацию заново, и это читается как дёрганье.
      if (карточка === текущая) return;
      if (текущая) {
        текущая.classList.remove('is-lit');
        ролик(текущая, false);
      }
      if (карточка) {
        карточка.classList.add('is-lit');
        ролик(карточка, true);
      }
      текущая = карточка;
    };

    const центральная = () => {
      let лучшая = null;
      let ближе = Infinity;
      for (const card of gameCards) {
        const r = card.getBoundingClientRect();
        if (r.bottom <= 0 || r.top >= innerHeight) continue;
        const d = Math.abs(r.top + r.height / 2 - innerHeight / 2);
        if (d < ближе) { ближе = d; лучшая = card; }
      }
      return лучшая;
    };

    const приОстановке = () => подсветить(наОщупь() ? центральная() : null);

    const приДвижении = () => {
      if (!наОщупь()) return;
      // В движении ничего не гасим. Раньше класс снимался на каждом
      // событии прокрутки, и анимация начиналась заново от любого
      // сдвига на пиксель.
      clearTimeout(dwell);
      dwell = setTimeout(приОстановке, 220);
    };

    for (const card of gameCards) {
      card.addEventListener('pointerenter', () => { if (!наОщупь()) подсветить(card); });
      card.addEventListener('pointerleave', () => { if (!наОщупь()) подсветить(null); });
    }

    addEventListener('scroll', приДвижении, { passive: true });
    addEventListener('resize', приДвижении);
    приОстановке();
  }


})();

// ── Снимок во весь экран ──────────────────────────────────────────────
// Просьба владельца: «картинка может быть маленькой, а при клике уже
// раскрываться на весь экран». Разметка приходит рабочей ссылкой на полный
// файл — без скриптов человек всё равно откроет его отдельной вкладкой, —
// а этот код перехватывает клик и показывает поверх страницы.
(() => {
  const ссылки = [...document.querySelectorAll('a.shot-link')];
  if (!ссылки.length) return;

  let слой = null;
  let откуда = null;

  const закрыть = () => {
    if (!слой) return;
    слой.remove();
    слой = null;
    document.documentElement.style.overflow = '';
    // Возвращаем внимание туда, откуда его увели: иначе после закрытия
    // клавиатура оказывается в начале страницы.
    откуда?.focus();
  };

  const открыть = (адрес, подпись) => {
    закрыть();
    слой = document.createElement('div');
    слой.className = 'shot-full';
    слой.setAttribute('role', 'dialog');
    слой.setAttribute('aria-modal', 'true');
    слой.setAttribute('aria-label', подпись || 'Снимок целиком');
    слой.innerHTML = `
      <button type="button" class="shot-full-close" aria-label="Закрыть">✕</button>
      <img src="${адрес}" alt="${подпись || ''}">
      ${подпись ? `<p class="shot-full-cap">${подпись}</p>` : ''}`;
    document.body.append(слой);
    // Пока картинка едет, страница под ней не должна прокручиваться:
    // иначе колесо уводит фон, а человек думает, что промахнулся.
    document.documentElement.style.overflow = 'hidden';
    слой.querySelector('.shot-full-close').focus();
    слой.addEventListener('click', (e) => {
      // Клик по самой картинке не закрывает: её как раз пришли смотреть.
      if (e.target.tagName !== 'IMG') закрыть();
    });
  };

  addEventListener('keydown', (e) => { if (e.key === 'Escape') закрыть(); });

  for (const a of ссылки) {
    a.addEventListener('click', (e) => {
      // Средняя кнопка, Ctrl и Cmd открывают в новой вкладке — не мешаем.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      откуда = a;
      открыть(a.getAttribute('href'), a.querySelector('figcaption')?.textContent?.trim() || '');
    });
  }
})();

// ── Навыки: свёрнуты до пяти названий, раскрываются по нажатию ────────
// Владелец с телефона: «целую страницу занимает, бессмысленно много… надо
// сильно короче либо как-то раскрываемее». Померено: список тегов 719 px
// при экране 844, то есть 85% экрана на одни теги.
//
// Сворачивает именно скрипт, а не сборка: без него страница остаётся такой
// же полной, как была, и поисковик видит все 43 тега. Свёрнутый вид — пять
// названий групп с числами, две строки.
(() => {
  const список = document.querySelector('.skills');
  if (!список) return;
  const групп = список.querySelectorAll('.skill').length;
  const тегов = список.querySelectorAll('dd span').length;
  if (групп < 2 || тегов < 12) return;

  const кнопка = document.createElement('button');
  кнопка.type = 'button';
  кнопка.className = 'skills-more';
  кнопка.setAttribute('aria-controls', список.id || (список.id = 'skills-list'));

  const показать = (раскрыт) => {
    список.classList.toggle('is-folded', !раскрыт);
    кнопка.setAttribute('aria-expanded', String(раскрыт));
    кнопка.textContent = раскрыт ? 'свернуть' : `показать все ${тегов}`;
  };
  кнопка.addEventListener('click', () => показать(список.classList.contains('is-folded')));
  список.after(кнопка);
  показать(false);
})();

// ── Компактный блок практикумов ─────────────────────────────────────
// Оба маршрута приходят в HTML целиком. Скрипт лишь выбирает, какой из них
// показать первым, поэтому без JavaScript курсы всё равно доступны.
(() => {
  document.querySelectorAll('[data-practicum-switch]').forEach((switcher) => {
    const buttons = [...switcher.querySelectorAll('[data-practicum-to]')];
    const panels = [...switcher.querySelectorAll('[data-practicum-panel]')];
    if (buttons.length < 2 || buttons.length !== panels.length) return;

    const show = (id, focus = false) => {
      buttons.forEach((button) => {
        const selected = button.dataset.practicumTo === id;
        button.setAttribute('aria-selected', String(selected));
        button.tabIndex = selected ? 0 : -1;
        if (selected && focus) button.focus();
      });
      panels.forEach((panel) => {
        panel.hidden = panel.dataset.practicumPanel !== id;
      });
    };

    buttons.forEach((button, index) => {
      button.addEventListener('click', () => show(button.dataset.practicumTo));
      button.addEventListener('keydown', (event) => {
        if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        event.preventDefault();
        const next = buttons[(index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length];
        show(next.dataset.practicumTo, true);
      });
    });

    show(buttons.find((button) => button.getAttribute('aria-selected') === 'true')?.dataset.practicumTo || buttons[0].dataset.practicumTo);
  });
})();

// ── Рассказы на главной: обложка → сборник → текст в одной панели ──
(() => {
  const panel = document.querySelector('.story-lead');
  if (!panel) return;
  const covers = [...panel.querySelectorAll('[data-story-collection]')];
  const collections = [...panel.querySelectorAll('[data-story-collection-panel]')];
  const reader = panel.querySelector('[data-story-reader]');
  const source = panel.querySelector('.story-source');
  const all = panel.querySelector('[data-story-all]');
  let currentCollection = null;
  const closeReader = () => { if (reader) reader.hidden = true; };
  // Мгновенный перенос к элементу. Плавную прокрутку сюда возвращать нельзя:
  // владелец 31 августа 2026 — «уберите его вообще отовсюду и чтоб он больше
  // не появлялся!!». Убрано именно ощущение самовольного скольжения, а не сам
  // перенос: без переноса нажатие на телефоне выглядит как ничего — заголовок
  // читалки встаёт на 870-й пиксель при окне 844.
  // scroll-padding-top учитываем руками, потому что его знает scrollIntoView,
  // а им пользоваться нельзя — он под запретом проверки.
  const кПередвижению = (el) => {
    if (!el) return;
    const отступ = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    scrollTo(0, Math.max(0, el.getBoundingClientRect().top + scrollY - отступ));
  };
  const showCollection = (id) => {
    currentCollection = id;
    closeReader();
    covers.forEach((cover) => cover.setAttribute('aria-expanded', String(cover.dataset.storyCollection === id)));
    collections.forEach((collection) => { collection.hidden = collection.dataset.storyCollectionPanel !== id; });
    all?.setAttribute('aria-expanded', 'false');
    if (all?.querySelector('b')) all.querySelector('b').textContent = '↓';
    const current = collections.find((collection) => collection.dataset.storyCollectionPanel === id);
    requestAnimationFrame(() => кПередвижению(current));
  };
  covers.forEach((cover) => cover.addEventListener('click', () => showCollection(cover.dataset.storyCollection)));
  all?.addEventListener('click', () => {
    closeReader();
    const open = all.getAttribute('aria-expanded') !== 'true';
    currentCollection = null;
    all.setAttribute('aria-expanded', String(open));
    all.querySelector('b').textContent = open ? '↑' : '↓';
    collections.forEach((collection) => { collection.hidden = !open; });
    covers.forEach((cover) => cover.setAttribute('aria-expanded', String(open)));
  });
  panel.querySelectorAll('[data-story-open]').forEach((button) => button.addEventListener('click', () => {
    const story = source?.querySelector(`[data-story-source="${CSS.escape(button.dataset.storyOpen)}"]`);
    if (!story || !reader) return;
    currentCollection = button.dataset.storyOpen.split('--')[0];
    reader.querySelector('[data-story-reader-meta]').textContent = `Рассказ · ${story.dataset.storyBook}`;
    reader.querySelector('[data-story-reader-title]').textContent = story.dataset.storyTitle;
    reader.querySelector('[data-story-reader-copy]').innerHTML = story.innerHTML;
    collections.forEach((collection) => { collection.hidden = true; });
    reader.hidden = false;
    кПередвижению(reader);
  }));
  panel.querySelector('[data-story-back]')?.addEventListener('click', () => {
    if (currentCollection) showCollection(currentCollection);
    else closeReader();
  });
  // Плавность тут разрешена: человек жмёт кнопку сам, это не притягивание.
  panel.querySelector('[data-story-top]')?.addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' })); // по руке человека
})();

// ── Заявка о партнёрстве ────────────────────────────────────────────
// Сервис сам валидирует поля, ловит заполненный honeypot и режет частые
// запросы. Здесь только UX: не отправить одну форму дважды и назвать ответ.
(() => {
  const form = document.querySelector('[data-contact-form]');
  if (!form) return;
  const status = form.querySelector('[data-contact-status]');
  const submit = form.querySelector('button[type="submit"]');
  const say = (text, state) => {
    status.textContent = text;
    status.dataset.state = state;
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity() || submit.disabled) return;

    const data = new FormData(form);
    const payload = Object.fromEntries(['name', 'reply', 'message', 'company'].map((key) => [key, data.get(key)]));
    submit.disabled = true;
    say('Отправляю…', 'pending');

    try {
      const response = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        form.reset();
        say('Запрос отправлен. Отвечу по указанному способу связи.', 'ok');
      } else if (response.status === 429) {
        say('С этого устройства запросов уже много. Попробуй позже.', 'error');
      } else {
        say('Не получилось отправить. Проверь поля и повтори позже.', 'error');
      }
    } catch (error) {
      say('Связь оборвалась. Попробуй ещё раз.', 'error');
    } finally {
      submit.disabled = false;
    }
  });
})();

// ── Карточки проектов: техника прячется под «подробнее» ───────────────
// Владелец с телефона: «тут просто должна быть короткая карточка,
// продающая меня обычному человеку… потом уже профессионал заинтересуется,
// подробнее узнает сам». Сверху остаётся название и одна строка словами,
// под кнопкой — длинное описание, стек и числа.
//
// Сворачивает скрипт, а не сборка: без него карточка остаётся полной, и
// поисковик видит всё. Так же устроены навыки и сборники рассказов.
(() => {
  const карточки = [...document.querySelectorAll('.card')].filter((к) => {
    const низ = к.querySelector('.card-more');
    // Нечего прятать — нечего и сворачивать: кнопка без содержимого
    // раздражает сильнее, чем длинный текст.
    return низ && низ.textContent.trim().length > 40;
  });
  if (!карточки.length) return;

  for (const к of карточки) {
    const низ = к.querySelector('.card-more');
    низ.id = низ.id || `more-${к.id || Math.random().toString(36).slice(2)}`;
    const кнопка = document.createElement('button');
    кнопка.type = 'button';
    кнопка.className = 'card-more-btn';
    кнопка.setAttribute('aria-controls', низ.id);

    const показать = (открыт) => {
      низ.hidden = !открыт;
      кнопка.setAttribute('aria-expanded', String(открыт));
      кнопка.textContent = открыт ? 'свернуть' : 'подробнее';
    };
    кнопка.addEventListener('click', () => {
      const pair = к.closest('[data-shared-details]');
      if (!pair) return показать(низ.hidden);
      const open = [...pair.querySelectorAll('.card-more')].some((item) => item.hidden);
      pair.querySelectorAll('.card-more').forEach((item) => { item.hidden = !open; });
      pair.querySelectorAll('.card-more-btn').forEach((item) => {
        item.setAttribute('aria-expanded', String(open));
        item.textContent = open ? 'свернуть' : 'подробнее';
      });
    });
    низ.before(кнопка);
    показать(false);
  }
})();
