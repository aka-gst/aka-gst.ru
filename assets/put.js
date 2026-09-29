(() => {
  const index = document.querySelector('[data-put-index]');
  const chapters = [...document.querySelectorAll('[data-put-chapter]')];
  if (!index || !chapters.length) return;

  const links = new Map([...index.querySelectorAll('a[href^="#"]')].map((link) => [link.hash.slice(1), link]));
  const setCurrent = (id, updateHistory) => {
    if (!id) return;
    if (!links.has(id)) {
      console.warn('[put] setCurrent: главы нет, значение отброшено:', id);
      return;
    }
    for (const [chapterId, link] of links) link.setAttribute('aria-current', String(chapterId === id));
    if (updateHistory && location.hash !== `#${id}`) history.pushState({ chapter: id }, '', `#${id}`);
  };

  const fromHash = () => setCurrent(location.hash.slice(1), false);
  addEventListener('popstate', fromHash);
  addEventListener('hashchange', fromHash);
  index.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    setCurrent(link.hash.slice(1), true);
  });

  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (visible) setCurrent(visible.target.id, false);
  }, { rootMargin: '-20% 0px -65% 0px', threshold: [0, .2, .65] });
  chapters.forEach((chapter) => observer.observe(chapter));
  fromHash();
})();
