// 17.4 · The holo editor: a semi-transparent panel IN the view while the
// headset is on. The world keeps rendering behind it (slowed down), the code
// is judged by the same strict Python subset as the garage gateway.
// DOM only; what the code means lives in ar-headset.js / garage-night.js.
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function createArEditor(el, { onRun = () => {}, onClose = () => {}, onInput = () => {}, onSound = () => {} } = {}) {
  if (!el) return { open() {}, close() {}, result() {}, lint() {}, mode() {}, get isOpen() { return false; }, get code() { return ''; } };
  let cfg = null;
  let ta = null;

  function open(c) {
    cfg = c;
    el.hidden = false;
    el.dataset.mode = 'edit';
    el.dataset.kind = c.kind ?? 'task';
    el.innerHTML = `
      <header><small>ГОЛО-РЕДАКТОР · ${esc(c.device ?? 'ШЛЕМ')}</small><b>${esc(c.title)}</b><button type="button" data-ar-close>Esc · СВЕРНУТЬ</button></header>
      <p class="fp-ar__brief">${esc(c.brief)}</p>
      <div class="code-editor fp-ar__code"><span aria-hidden="true">PY</span><textarea rows="${c.rows ?? 8}" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="${esc(c.title)} · код на Python"></textarea></div>
      <div class="fp-ar__chips" aria-label="Вставить кусок кода">${(c.chips ?? []).map(([label], i) => `<button type="button" data-chip="${i}">${esc(label)}</button>`).join('')}</div>
      <p class="fp-ar__lint" role="status"></p>
      <div class="fp-ar__actions"><button type="button" class="fp-ar__run" data-ar-run>${esc(c.runLabel ?? '▶ ЗАПУСТИТЬ')}</button><button type="button" data-ar-reset>СБРОС</button></div>
      <p class="fp-ar__result" role="status" aria-live="polite"></p>
      <ol class="fp-ar__cases"></ol>`;
    ta = el.querySelector('textarea');
    ta.value = c.code ?? '';
    ta.addEventListener('input', () => { onInput(ta.value); });
    ta.addEventListener('keydown', keys);
    el.querySelector('[data-ar-close]').addEventListener('click', () => onClose());
    el.querySelector('[data-ar-run]').addEventListener('click', () => onRun(ta.value));
    el.querySelector('[data-ar-reset]').addEventListener('click', () => { ta.value = c.starter ?? ''; onInput(ta.value); onSound('ui-click'); });
    for (const b of el.querySelectorAll('[data-chip]')) b.addEventListener('click', () => { ta.focus(); ta.setRangeText(c.chips[Number(b.dataset.chip)][1], ta.selectionStart, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input')); onSound('ui-click'); });
    onInput(ta.value);
    ta.focus({ preventScroll: true });
  }
  // Tab indents, Enter keeps the indent (one more after a colon),
  // Ctrl/Cmd+Enter runs, Esc folds the panel away.
  function keys(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); onRun(ta.value); return; }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); return; }
    if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); ta.setRangeText('    ', ta.selectionStart, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input')); return; }
    if (e.key === 'Enter' && !e.shiftKey) {
      const before = ta.value.slice(0, ta.selectionStart), ln = before.slice(before.lastIndexOf('\n') + 1);
      const indent = /^ */.exec(ln)[0] + (/:\s*$/.test(ln) ? '    ' : '');
      if (indent) { e.preventDefault(); ta.setRangeText(`\n${indent}`, ta.selectionStart, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input')); }
    }
  }
  function close() { el.hidden = true; el.innerHTML = ''; cfg = null; ta = null; }
  function lint(text, ok) { const p = el.querySelector('.fp-ar__lint'); if (p) { p.textContent = text; p.dataset.ok = String(Boolean(ok)); } }
  function result(text, ok, cases = null) {
    const p = el.querySelector('.fp-ar__result'); if (p) { p.textContent = text; p.dataset.ok = String(Boolean(ok)); }
    const ol = el.querySelector('.fp-ar__cases');
    if (ol) ol.innerHTML = (cases ?? []).map((c) => `<li data-pass="${c.pass}">${c.pass ? '✓' : '✗'} ${esc(c.text)}</li>`).join('');
  }
  // 'edit' or 'watch' (folded to a strip while the night plays in the room).
  function mode(m) { if (!el.hidden) el.dataset.mode = m; const b = el.querySelector('[data-ar-run]'); if (b && cfg) b.textContent = m === 'watch' ? '⏩ ПЕРЕМОТАТЬ' : cfg.runLabel ?? '▶ ЗАПУСТИТЬ'; }
  return { open, close, lint, result, mode, get isOpen() { return Boolean(cfg); }, get code() { return ta?.value ?? ''; }, get config() { return cfg; } };
}
