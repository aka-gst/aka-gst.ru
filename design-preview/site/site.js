(() => {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');

  for (const frame of document.querySelectorAll('.animation-frame')) {
    const video = frame.querySelector('video');
    const toggle = frame.querySelector('.animation-toggle');
    if (!video || !toggle) continue;
    const sync = () => {
      toggle.setAttribute('aria-pressed', String(!video.paused));
      toggle.textContent = video.paused ? 'Запустить анимацию' : 'Остановить анимацию';
    };
    toggle.addEventListener('click', async () => {
      if (!video.paused) video.pause();
      else {
        try { await video.play(); }
        catch { toggle.textContent = 'Повторить запуск'; return; }
      }
      sync();
    });
    video.addEventListener('play', sync);
    video.addEventListener('pause', sync);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) video.pause();
    });
    reducedMotion.addEventListener('change', () => {
      if (reducedMotion.matches) video.pause();
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(entries => {
        if (!entries[0].isIntersecting) video.pause();
      }).observe(frame);
    }
    sync();
  }

  const phraseNode = document.getElementById('phrase-text');
  const phrases = Array.isArray(window.sitePhrases) ? window.sitePhrases : [];
  if (phraseNode && phrases.length) {
    // Как на прошлой версии сайта (assets/app.js до 02.10): фраза набирается по букве (45 мс на символ),
    // висит 22 с, стирается справа налево, пауза на пустоте — и следующая, случайная, не та же.
    // «(с)» печатается вместе с фразой (шутка Сергея про патентованные фразы ИИ).
    // Зелёный курсор справа виден только пока строка набирается или стирается — «бесит постоянно
    // моргающая штука». Глитч редкий (каждые 4,5–8 с), короткий, одного из трёх видов.
    // Сергей 03.10 06:25: твиты «меняются слишком быстро… вернуть как на прошлом сайте».
    // Кнопки паузы нет (Сергей 03.10: «убери»). Длинная фраза обрезается многоточием — целиком её
    // показывает своё окошко: при наведении, по касанию на телефоне, по фокусу с клавиатуры.
    const полоса = phraseNode.closest('.phrase') || phraseNode.parentElement;
    const pop = document.getElementById('phrase-pop');
    const БУКВА = 45, СТЁРКА = 22, ДЕРЖИМ = 22000, ПУСТО = 900, ЗНАЧОК = ' (с)';
    const ГЛИТЧ_НЕ_ЧАЩЕ = 4500;
    let index = Math.floor(Math.random() * phrases.length);
    const следующая = () => {
      if (phrases.length < 2) return index;
      let к = index;
      while (к === index) к = Math.floor(Math.random() * phrases.length);
      return к;
    };
    let open = false;
    let печать = null;
    let ждём = null;
    // Стартуем сразу, как прошлая версия: страница, открытая в фоновой вкладке, иначе ждёт события
    // видимости, которого у части окон (встроенные панели) не бывает — и строка остаётся пустой.
    let живо = true;
    let глитч = null;
    const cut = () => phraseNode.scrollWidth > phraseNode.clientWidth + 1;
    const показать = (строка, к) => {
      const всё = строка + ЗНАЧОК;
      const text = всё.slice(0, Math.max(0, Math.min(к, всё.length)));
      phraseNode.textContent = text;
      phraseNode.dataset.text = text;
    };
    const шаг = (строка, от, до, скорость) => new Promise((готово) => {
      let к = от;
      полоса.dataset.nabor = '1';
      печать = setInterval(() => {
        к += от < до ? 1 : -1;
        показать(строка, к);
        if (к === до || !живо) { clearInterval(печать); печать = null; delete полоса.dataset.nabor; готово(); }
      }, скорость);
    });
    const пауза = (мс) => new Promise((г) => { ждём = setTimeout(г, мс); });
    const круг = async () => {
      while (живо) {
        const строка = phrases[index];
        const всё = строка.length + ЗНАЧОК.length;
        if (reducedMotion.matches) {
          показать(строка, всё);
          await пауза(ДЕРЖИМ);
        } else {
          await шаг(строка, 0, всё, БУКВА);
          if (!живо) break;
          await пауза(ДЕРЖИМ);
          while (open && живо) await пауза(400); // пока окно с полной фразой открыто, она не меняется
          if (!живо) break;
          await шаг(строка, всё, 0, СТЁРКА);
          await пауза(ПУСТО);
        }
        if (!живо) break;
        index = следующая();
      }
    };
    const глитчить = () => {
      if (reducedMotion.matches || !phraseNode.textContent || полоса.dataset.glitch) return;
      полоса.dataset.glitch = String(1 + Math.floor(Math.random() * 3));
      setTimeout(() => delete полоса.dataset.glitch, 320);
    };
    const завестиГлитч = () => {
      if (глитч) clearInterval(глитч);
      глитч = reducedMotion.matches ? null : setInterval(глитчить, ГЛИТЧ_НЕ_ЧАЩЕ + Math.random() * 3500);
    };
    const hidePop = () => {
      if (!pop || !open) return;
      open = false;
      pop.classList.remove('is-open');
      pop.hidden = true;
    };
    const showPop = () => {
      if (!pop || !cut()) return false;
      pop.textContent = phraseNode.textContent;
      pop.hidden = false;
      pop.classList.add('is-open');
      open = true;
      return true;
    };
    if (pop) {
      phraseNode.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') showPop(); });
      phraseNode.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hidePop(); });
      // Касание: открыть/закрыть. Мышь окно уже открыла наведением — её щелчок окно не трогает.
      let lastPointer = '';
      phraseNode.addEventListener('pointerdown', (e) => { lastPointer = e.pointerType; });
      phraseNode.addEventListener('click', () => { if (lastPointer === 'mouse') return; if (open) hidePop(); else showPop(); });
      // Фокус с клавиатуры (Tab) — показать; фокус от касания тут не считается, иначе щелчок сразу закрыл бы окно.
      phraseNode.addEventListener('focus', () => { if (phraseNode.matches(':focus-visible')) showPop(); });
      phraseNode.addEventListener('blur', hidePop);
      phraseNode.addEventListener('keydown', (e) => { if (e.key === 'Escape') hidePop(); });
      document.addEventListener('pointerdown', (e) => {
        if (open && e.target !== phraseNode && !pop.contains(e.target)) hidePop();
      });
      addEventListener('scroll', hidePop, { passive: true });
    }
    // Вкладку убрали — цикл останавливаем: печатать в невидимую страницу значит жечь батарею.
    // Вернулись — начинаем с чистой фразы.
    document.addEventListener('visibilitychange', () => {
      живо = !document.hidden;
      clearInterval(печать); печать = null;
      clearTimeout(ждём);
      delete полоса.dataset.nabor;
      if (глитч) { clearInterval(глитч); глитч = null; }
      if (живо) { показать(phrases[index], 0); круг(); завестиГлитч(); }
    });
    reducedMotion.addEventListener('change', завестиГлитч);
    показать(phrases[index], 0);
    круг();
    завестиГлитч();
  }

  if (!reducedMotion.matches && 'IntersectionObserver' in window) {
    document.documentElement.classList.add('js-motion');
    const reveal = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        reveal.unobserve(entry.target);
      }
    }, { threshold: 0.06, rootMargin: '0px 0px -25px 0px' });
    document.querySelectorAll('[data-reveal]').forEach((element) => reveal.observe(element));
    reducedMotion.addEventListener('change', () => {
      if (reducedMotion.matches) {
        reveal.disconnect();
        document.documentElement.classList.remove('js-motion');
      }
    }, { once: true });
  }

  for (const card of document.querySelectorAll('[data-video-preview]')) {
    const video = card.querySelector('video');
    if (!video) continue;
    const stop = () => {
      card.classList.remove('is-previewing');
      video.pause();
      video.currentTime = 0;
    };
    const start = async () => {
      if (!finePointer.matches || reducedMotion.matches) return;
      try {
        await video.play();
        if (card.matches(':hover')) card.classList.add('is-previewing');
        else stop();
      } catch {
        stop();
      }
    };
    card.addEventListener('pointerenter', start);
    card.addEventListener('pointerleave', stop);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop();
    });
    reducedMotion.addEventListener('change', () => {
      if (reducedMotion.matches) stop();
    });
  }
})();
