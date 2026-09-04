(() => {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  if (reduceMotion.matches) return;

  const titles = [...document.querySelectorAll('[data-afterimage-scroll]')];
  if (!titles.length) return;

  let scheduled = false;
  const render = () => {
    scheduled = false;
    const range = Math.min(220, Math.max(132, innerHeight * 0.28));
    const progress = Math.min(1, Math.max(0, scrollY / range));
    const delay = `${(-1.25 * progress).toFixed(3)}s`;
    titles.forEach((title) => title.style.setProperty('--afterimage-delay', delay));
  };
  const requestRender = () => {
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(render);
    }
  };

  addEventListener('scroll', requestRender, { passive: true });
  addEventListener('resize', requestRender, { passive: true });
  render();
})();
