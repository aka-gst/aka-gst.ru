// Читалка: грунт, размер текста, полоса прочитанного и возврат на место.
// Всё, что читатель выбрал, запоминается — иначе на телефоне, где читают в
// три захода, каждый заход начинается с настройки заново.
(() => {
  const root = document.documentElement;
  const ПАМЯТЬ = 'aka-gst:read';

  const прочитать = () => {
    try {
      return JSON.parse(localStorage.getItem(ПАМЯТЬ)) || {};
    } catch (e) {
      // Приватный режим и запрет хранилища — не повод ломать чтение.
      return {};
    }
  };
  const записать = (что) => {
    try {
      localStorage.setItem(ПАМЯТЬ, JSON.stringify({ ...прочитать(), ...что }));
    } catch (e) {
      /* читать можно и без памяти */
    }
  };

  const настройки = прочитать();
  const РАЗМЕРЫ = ['s', '', 'l', 'xl'];
  let размер = РАЗМЕРЫ.indexOf(настройки.размер ?? '');
  if (размер < 0) размер = 1;

  const применить = () => {
    root.dataset.ground = настройки.грунт === 'paper' ? 'paper' : 'dark';
    if (РАЗМЕРЫ[размер]) root.dataset.size = РАЗМЕРЫ[размер];
    else delete root.dataset.size;
  };
  применить();

  document.querySelector('[data-ground-toggle]')?.addEventListener('click', () => {
    настройки.грунт = настройки.грунт === 'paper' ? 'dark' : 'paper';
    применить();
    записать({ грунт: настройки.грунт });
  });

  for (const кнопка of document.querySelectorAll('[data-size]')) {
    кнопка.addEventListener('click', () => {
      размер = Math.min(РАЗМЕРЫ.length - 1, Math.max(0, размер + Number(кнопка.dataset.size)));
      применить();
      записать({ размер: РАЗМЕРЫ[размер] });
    });
  }

  const рассказ = document.querySelector('.story');
  if (!рассказ) return;

  const слаг = рассказ.dataset.story;
  const полоса = document.querySelector('.reader-progress i');

  // Одна дверь наверх, а не второй набор навигации. На первом экране её нет:
  // появляется только после целой высоты чтения и только если странице есть
  // куда прокручиваться. Так короткий рассказ не получает бесполезную кнопку.
  const наверх = document.createElement('button');
  наверх.type = 'button';
  наверх.className = 'reader-back-to-top';
  наверх.hidden = true;
  наверх.setAttribute('aria-label', 'Вернуться к началу рассказа');
  наверх.title = 'Вернуться к началу рассказа';
  наверх.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m7 14 5-5 5 5"/></svg>';
  document.body.append(наверх);

  const высотаОкна = () => Math.max(1, window.visualViewport?.height || innerHeight);
  const обновитьНаверх = () => {
    const высота = высотаОкна();
    const длинныйТекст = document.documentElement.scrollHeight > высота + 1;
    наверх.hidden = !(длинныйТекст && scrollY >= высота);
  };
  наверх.addEventListener('click', () => {
    scrollTo(0, 0); // мгновенно: плавность запрещена вообще отовсюду
    // При reduced motion браузер прыгает сразу; не ждём следующего scroll,
    // чтобы круг не висел на верхнем экране лишний кадр.
    requestAnimationFrame(обновитьНаверх);
  });

  // Доля прочитанного считается по самому тексту, а не по всей странице:
  // шапка и навигация внизу не должны попадать в «сколько осталось».
  const доля = () => {
    const r = рассказ.getBoundingClientRect();
    const пройдено = -r.top + innerHeight * 0.6;
    return Math.min(1, Math.max(0, пройдено / Math.max(1, r.height)));
  };

  let ждём = false;
  const обновить = () => {
    if (полоса) полоса.style.width = `${(доля() * 100).toFixed(1)}%`;
    ждём = false;
  };
  addEventListener(
    'scroll',
    () => {
      if (ждём) return;
      ждём = true;
      requestAnimationFrame(обновить);
    },
    { passive: true }
  );
  обновить();
  обновитьНаверх();
  addEventListener('scroll', обновитьНаверх, { passive: true });
  addEventListener('resize', обновитьНаверх);
  addEventListener('load', обновитьНаверх);
  window.visualViewport?.addEventListener('resize', обновитьНаверх);

  // Место храним в долях высоты, а не в пикселях: при другом размере шрифта
  // или на другом экране пиксели указывают не туда.
  const места = настройки.места || {};
  let таймер;
  addEventListener(
    'scroll',
    () => {
      clearTimeout(таймер);
      таймер = setTimeout(() => {
        const d = доля();
        // Начало и самый конец не запоминаем: возвращать в них незачем.
        записать({ места: { ...прочитать().места, [слаг]: d > 0.04 && d < 0.97 ? d : 0 } });
      }, 600);
    },
    { passive: true }
  );

  const было = места[слаг];
  if (было > 0.04) {
    const r = рассказ.getBoundingClientRect();
    const цель = r.top + scrollY + r.height * было - innerHeight * 0.6;
    // Предлагаем вернуться, а не прыгаем сами: непрошеный прыжок при
    // открытии страницы сбивает сильнее, чем помогает.
    const подсказка = document.createElement('button');
    подсказка.type = 'button';
    подсказка.className = 'reader-resume';
    подсказка.textContent = `Вернуться на ${Math.round(было * 100)}%`;
    подсказка.addEventListener('click', () => {
      scrollTo({ top: цель });
      подсказка.remove();
    });
    рассказ.querySelector('.story-meta')?.after(подсказка);
  }
})();

// ── Оглавление: сборник раскрывается, рассказ разворачивается ─────────
// Просьба владельца: «три обложки сборника — кликаешь по ним появляются
// рассказы из него — а кликаешь по рассказу он уже ниже появляется».
//
// Разметка приходит РАСКРЫТОЙ, и сворачивает её этот код. Без него
// страница остаётся тем же полным оглавлением, что и была: человек без
// скриптов ничего не теряет, а поисковик видит все двадцать три записи.
//
// Прямые адреса рассказов живут по-прежнему — разворот их дополняет, а не
// заменяет. У развёрнутого есть ссылка «открыть отдельно».
(() => {
  const сборники = [...document.querySelectorAll('.reader-main .book')];
  if (сборники.length < 2) return;

  const тела = new Map();
  for (const с of сборники) {
    const тело = с.querySelector('.book-body');
    const карточка = с.querySelector('.bcard');
    if (!тело || !карточка) continue;
    тела.set(с, тело);

    const кнопка = document.createElement('button');
    кнопка.type = 'button';
    кнопка.className = 'book-toggle';
    кнопка.setAttribute('aria-controls', тело.id);
    карточка.querySelector('.bcard-body').append(кнопка);

    // Повторное нажатие сворачивает — просьба владельца. Раньше обложка
    // умела только раскрывать, и свернуть можно было лишь кнопкой: нажатие
    // на уже открытый сборник не делало ничего, а это читается как
    // «не работает», а не как «уже открыто».
    const переключить = () => раскрыть(тела.has(с) && !тела.get(с).hidden ? null : с);
    // Нажатие ловит вся карточка — владелец просил именно по обложке, а
    // карточка это обложка и есть. Кнопка внутри неё оставлена видимой,
    // чтобы было понятно, что карточка нажимается.
    карточка.addEventListener('click', переключить);
  }

  const раскрыть = (какой) => {
    for (const [с, тело] of тела) {
      const надо = с === какой;
      тело.hidden = !надо;
      с.classList.toggle('is-open', надо);
      с.querySelector('.book-toggle')?.setAttribute('aria-expanded', String(надо));
      const к = с.querySelector('.book-toggle');
      if (к) к.textContent = надо ? 'свернуть' : 'показать рассказы';
    }
    // Экран НИКУДА не едет сам. Раньше при раскрытии сборника страница
    // подвозила карточку к верху, и для человека это неотличимо от
    // магнита: он листает, а страница едет. Владелец 31 августа: «тут
    // снова есть притягивание — уберите его вообще отовсюду и чтоб он
    // больше не появлялся». Ничего плавного и ничего самовольного здесь
    // быть не должно; сторожит это проверка в verify.sh.
  };

  // Ничего не раскрыто: рассказы появляются по нажатию. Владелец прямо:
  // «рассказы должны снизу открываться по клику, а не сразу». Прежний
  // довод — «иначе первый экран три картинки и ни одного текста» — снят
  // им же: три карточки со сборниками теперь и есть первый экран.
  раскрыть(null);

  // ── Разворот рассказа на месте ─────────────────────────────────────
  const развернуть = async (ссылка) => {
    const строка = ссылка.closest('li');
    const уже = строка.querySelector('.story-inline');
    if (уже) {
      уже.remove();
      строка.classList.remove('is-open');
      history.replaceState(null, '', location.pathname);
      return;
    }
    for (const о of document.querySelectorAll('.story-inline')) {
      о.closest('li')?.classList.remove('is-open');
      о.remove();
    }
    const место = document.createElement('div');
    место.className = 'story-inline';
    место.innerHTML = '<p class="story-inline-wait">загружается…</p>';
    строка.append(место);
    строка.classList.add('is-open');

    const адрес = ссылка.dataset.tekst;
    try {
      const ответ = await fetch(адрес);
      if (!ответ.ok) throw new Error(String(ответ.status));
      const текст = await ответ.text();
      место.innerHTML = `<div class="story-inline-body">${текст}</div>` +
        `<p class="story-inline-more"><a href="${ссылка.getAttribute('href')}">Открыть отдельной страницей →</a></p>`;
      // В адрес кладём слаг, а не заголовок: заголовок кириллицей
      // превращается в частокол процентов и делиться таким адресом стыдно.
      const слаг = (ссылка.getAttribute('href') || '').split('/').filter(Boolean).pop();
      if (слаг) history.replaceState(null, '', `#${слаг}`);
    } catch (e) {
      // Сеть рвётся: молчать нельзя, пустое место читается как поломка.
      место.innerHTML = `<p class="story-inline-wait">Текст не доехал (${e.message}). ` +
        `<a href="${ссылка.getAttribute('href')}">Открыть отдельной страницей →</a></p>`;
    }
  };

  for (const a of document.querySelectorAll('.book-list a[data-tekst]')) {
    a.addEventListener('click', (e) => {
      // Средняя кнопка, Ctrl и Cmd открывают в новой вкладке — не мешаем.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      развернуть(a);
    });
  }
})();
