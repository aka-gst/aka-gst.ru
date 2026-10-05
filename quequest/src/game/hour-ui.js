// 18.0: small DOM pieces of the new first hour.
//
// showSeam — the «приход»: for a moment you see the seams of the world and a
// line of code under them. Canon §14: the deep-program is yours, from the
// future; you sent yourself commands back, so knowledge "arrives" as seams,
// overheard words and coincidences. Short, skippable, never a lecture.

export function showSeam(root, { kicker = 'ШОВ', lines = [], from = '', ms = 3600 } = {}, done = () => {}) {
  if (!root) { done(); return () => {}; }
  root.innerHTML = `<div class="seam__noise" aria-hidden="true"></div><div class="seam__card" role="dialog" aria-live="assertive"><small>${kicker}</small>${lines.map((l, i) => `<p style="--i:${i}">${l}</p>`).join('')}${from ? `<em>${from}</em>` : ''}<span class="seam__skip">клик / пробел — дальше</span></div>`;
  root.hidden = false;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    root.hidden = true;
    root.innerHTML = '';
    window.removeEventListener('keydown', onKey, true);
    clearTimeout(timer);
    done();
  };
  const onKey = (event) => {
    if (['Space', 'Enter', 'Escape', 'KeyE'].includes(event.code)) { event.preventDefault(); event.stopPropagation(); close(); }
  };
  window.addEventListener('keydown', onKey, true);
  root.addEventListener('pointerdown', close, { once: true });
  const timer = setTimeout(close, ms);
  return close;
}

// The in-page confirmation (no window.confirm): «начать заново» must be one
// deliberate action that can't be hit by accident, and visible in the page.
export function confirmInPage(root, { title, text, yes = 'ДА', no = 'ОТМЕНА' }, onYes) {
  if (!root) return;
  root.innerHTML = `<div class="confirm__card" role="alertdialog" aria-modal="true" aria-labelledby="confirmTitle"><h2 id="confirmTitle">${title}</h2><p>${text}</p><div class="confirm__actions"><button type="button" data-no>${no}</button><button type="button" data-yes>${yes}</button></div></div>`;
  root.hidden = false;
  const close = () => { root.hidden = true; root.innerHTML = ''; window.removeEventListener('keydown', onKey, true); };
  const onKey = (event) => { if (event.key === 'Escape') { event.preventDefault(); close(); } };
  window.addEventListener('keydown', onKey, true);
  root.querySelector('[data-no]').addEventListener('click', close);
  root.querySelector('[data-yes]').addEventListener('click', () => { close(); onYes(); });
  root.querySelector('[data-no]').focus();
}
