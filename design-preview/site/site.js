(() => {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  // A muted inline loop, with a still poster when motion is reduced.
  for (const video of document.querySelectorAll('.animation-frame video')) {
    let inView = true;
    const sync = () => {
      if (document.hidden || reducedMotion.matches || !inView) video.pause();
      else video.play().catch(() => {});
    };
    document.addEventListener('visibilitychange', sync);
    reducedMotion.addEventListener('change', sync);
    if ('IntersectionObserver' in window) new IntersectionObserver(entries => {
      inView = entries[0].isIntersecting;
      sync();
    }).observe(video);
    sync();
  }

  const text = document.getElementById('phrase-text');
  const phrase = text?.closest('.phrase');
  const phrases = Array.isArray(window.sitePhrases) ? window.sitePhrases : [];
  if (!text || !phrase || !phrases.length) return;
  let index = Math.floor(Math.random() * phrases.length);
  let timer, glitchTimer, glitchEnd;
  let generation = 0;
  const clear = () => {
    generation++;
    clearTimeout(timer); clearTimeout(glitchTimer); clearTimeout(glitchEnd);
    delete phrase.dataset.typing; delete phrase.dataset.glitch;
  };
  const nextIndex = () => {
    if (phrases.length < 2) return index;
    return (index + 1 + Math.floor(Math.random() * (phrases.length - 1))) % phrases.length;
  };
  const run = () => {
    clear();
    if (document.hidden) return;
    const token = generation;
    if (reducedMotion.matches) { text.textContent = phrases[index]; return; }
    const step = (characters, target, speed, done) => {
      if (token !== generation) return;
      phrase.dataset.typing = '1';
      text.textContent = phrases[index].slice(0, characters);
      if (characters === target) {
        delete phrase.dataset.typing;
        done();
      } else timer = setTimeout(() => step(characters + (characters < target ? 1 : -1), target, speed, done), speed);
    };
    const type = () => step(0, phrases[index].length, 45, () => {
      timer = setTimeout(() => step(phrases[index].length, 0, 22, () => {
        timer = setTimeout(() => { index = nextIndex(); type(); }, 900);
      }), 22000);
    });
    const glitch = () => {
      glitchTimer = setTimeout(() => {
        if (token !== generation) return;
        if (text.textContent) {
          phrase.dataset.glitch = '1';
          glitchEnd = setTimeout(() => delete phrase.dataset.glitch, 260);
        }
        glitch();
      }, 4500 + Math.random() * 3500);
    };
    type(); glitch();
  };
  document.addEventListener('visibilitychange', run);
  reducedMotion.addEventListener('change', run);
  run();
})();
