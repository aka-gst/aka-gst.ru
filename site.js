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
    const toggle = document.querySelector('.phrase-toggle');
    let paused = false;
    let timer;
    let glitchTimer;
    const show = () => {
      const text = `${phrases[index]} (с)`;
      phraseNode.textContent = text;
      phraseNode.dataset.text = text;
      phraseNode.title = text; // длинная фраза в шапке обрезается многоточием — полный текст при наведении
    };
    const schedule = () => {
      clearTimeout(timer);
      clearTimeout(glitchTimer);
      phraseNode.classList.remove('is-glitching');
      if (paused || reducedMotion.matches || document.hidden) return;
      timer = setTimeout(() => {
        index = (index + 1) % phrases.length;
        show();
        phraseNode.classList.add('is-glitching');
        glitchTimer = setTimeout(() => phraseNode.classList.remove('is-glitching'), 320);
        timer = setTimeout(schedule, 320);
      }, 10000);
    };
    toggle?.addEventListener('click', () => {
      paused = !paused;
      toggle.setAttribute('aria-pressed', String(paused));
      toggle.setAttribute('aria-label', paused ? 'Продолжить ленту фраз' : 'Остановить ленту фраз');
      toggle.textContent = paused ? '▶' : 'Ⅱ';
      schedule();
    });
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
