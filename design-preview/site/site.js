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
    let index = Math.floor(Math.random() * phrases.length);
    // Кнопки паузы нет (Сергей 03.10: «убери, нахуй она не нужна»). Длинная фраза обрезается
    // многоточием — целиком её показывает своё окошко: сразу при наведении, по касанию на телефоне,
    // по фокусу с клавиатуры. Системный title не годится: он появляется через секунду и выглядит чужим.
    const pop = document.getElementById('phrase-pop');
    let open = false;
    let timer;
    let glitchTimer;
    const cut = () => phraseNode.scrollWidth > phraseNode.clientWidth + 1;
    const hidePop = () => {
      if (!pop || !open) return;
      open = false;
      pop.classList.remove('is-open');
      pop.hidden = true;
      schedule();
    };
    const showPop = () => {
      if (!pop || !cut()) return false;
      pop.textContent = phraseNode.textContent;
      pop.hidden = false;
      pop.classList.add('is-open');
      open = true;
      clearTimeout(timer); // пока окно открыто, фраза под ним не меняется
      return true;
    };
    const show = () => {
      const text = `${phrases[index]} (с)`;
      phraseNode.textContent = text;
      phraseNode.dataset.text = text;
    };
    const schedule = () => {
      clearTimeout(timer);
      clearTimeout(glitchTimer);
      phraseNode.classList.remove('is-glitching');
      if (open || reducedMotion.matches || document.hidden) return;
      timer = setTimeout(() => {
        index = (index + 1) % phrases.length;
        show();
        phraseNode.classList.add('is-glitching');
        glitchTimer = setTimeout(() => phraseNode.classList.remove('is-glitching'), 320);
        timer = setTimeout(schedule, 320);
      }, 10000);
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
    reducedMotion.addEventListener('change', schedule);
    document.addEventListener('visibilitychange', schedule);
    show();
    schedule();
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
