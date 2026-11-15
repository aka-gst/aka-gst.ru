// Presentation only: the underlying list, event order and game state stay intact.
export function pageWindow(total, requested, size = 2) {
  if (!Number.isInteger(size) || size < 1) throw new RangeError('page size must be positive');
  const pages = Math.max(1, Math.ceil(total / size));
  const page = Math.max(0, Math.min(pages - 1, requested));
  return { page, pages, start: page * size, end: Math.min(total, (page + 1) * size) };
}
export function attachLogPages(list, size = 2) {
  const doc = list.ownerDocument;
  const nav = doc.createElement('nav'); nav.className = 'ui-pages'; nav.setAttribute('aria-label', 'Страницы журнала');
  nav.innerHTML = '<button type="button" data-page="prev">← ПРЕД</button><output></output><button type="button" data-page="next">СЛЕД →</button>';
  list.after(nav);
  const prev = nav.querySelector('[data-page="prev"]'), next = nav.querySelector('[data-page="next"]'), label = nav.querySelector('output');
  let page = 0, follow = true;
  function render() {
    const items = [...list.children]; const last = pageWindow(items.length, Number.MAX_SAFE_INTEGER, size);
    const window = pageWindow(items.length, follow ? last.page : page, size); page = window.page;
    items.forEach((item, i) => { item.hidden = i < window.start || i >= window.end; });
    list.scrollTop = 0;
    prev.disabled = page === 0; next.disabled = page === window.pages - 1;
    label.textContent = `${page + 1} / ${window.pages}`;
  }
  prev.addEventListener('click', () => { follow = false; page--; render(); });
  next.addEventListener('click', () => { page++; follow = page >= pageWindow(list.children.length, Number.MAX_SAFE_INTEGER, size).page; render(); });
  const observer = new doc.defaultView.MutationObserver(render); observer.observe(list, { childList: true }); render();
  return { refresh: render, destroy() { observer.disconnect(); nav.remove(); } };
}
