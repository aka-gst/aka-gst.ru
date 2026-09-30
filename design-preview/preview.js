const choices = [...document.querySelectorAll('[data-choose]')];
const panels = [...document.querySelectorAll('[data-panel]')];

function showDesign(id, updateHistory = true) {
  if (!choices.some((choice) => choice.dataset.choose === id)) return;
  document.body.dataset.design = id;
  for (const choice of choices) {
    choice.setAttribute('aria-pressed', String(choice.dataset.choose === id));
  }
  for (const panel of panels) panel.hidden = panel.dataset.panel !== id;
  if (updateHistory) history.replaceState(null, '', `#${id}`);
  window.scrollTo({ top: 0, behavior: 'instant' });
}

for (const choice of choices) {
  choice.addEventListener('click', () => showDesign(choice.dataset.choose));
}

window.addEventListener('hashchange', () => showDesign(location.hash.slice(1), false));
showDesign(location.hash.slice(1) || 'a', false);

if (window.matchMedia('(prefers-reduced-motion: no-preference)').matches && 'IntersectionObserver' in window) {
  const moments = document.querySelectorAll('.a-case-main, .b-feature, .c-tiles');
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('in-view');
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.18 });
  for (const moment of moments) observer.observe(moment);
}
