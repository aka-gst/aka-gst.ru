// 19.0 · day 3: the torn sheet. Pieces of a line of words lie in a tray;
// tap one and it goes to the next empty cell (or to the cell you picked),
// tap a placed piece and it goes back. With a mouse they can also be
// dragged. One cell has a hole: that word you type yourself.
//
// Small and self-contained (not the garage's piece editor): slots and
// pieces come from week.js (ASSEMBLE), the judging is week.js too.

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function createPieceLine(host, { slots = [], pieces = [], onChange = () => {}, sound = () => {} } = {}) {
  let placed = {}; // slotId -> pieceId
  let picked = null; // a selected empty slot
  const pieceById = new Map(pieces.map((p) => [p.id, p]));

  host.classList.add('pl');
  host.innerHTML = `
    <div class="pl__sheet">
      ${[1, 2].map((line) => `<div class="pl__line" data-line="${line}">${slots.filter((s) => s.line === line).map((s) => (s.typed
        ? `<label class="pl__slot pl__slot--typed" data-slot="${s.id}"><small>${esc(s.gloss)}</small><span class="pl__q">"<input class="pl__input" type="text" inputmode="text" lang="en" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="12" aria-label="Впиши слово: ${esc(s.gloss)}">"</span></label>`
        : `<button type="button" class="pl__slot" data-slot="${s.id}" aria-label="Клетка: ${esc(s.gloss)}"><small>${esc(s.gloss)}</small><span class="pl__got"></span></button>`)).join('')}</div>`).join('')}
    </div>
    <div class="pl__tray" aria-label="Куски строчки"></div>`;
  const tray = host.querySelector('.pl__tray');
  const input = host.querySelector('.pl__input');

  function used() { return new Set(Object.values(placed)); }
  function render() {
    const u = used();
    tray.innerHTML = pieces.filter((p) => !u.has(p.id)).map((p) => `<button type="button" class="pl__piece" draggable="true" data-piece="${p.id}"><code>${esc(p.text)}</code><small>${esc(p.gloss)}</small></button>`).join('')
      || '<p class="pl__empty">Все куски на листке. Проверь и нажми «▶ ЗАПУСТИТЬ».</p>';
    for (const el of host.querySelectorAll('button.pl__slot')) {
      const id = placed[el.dataset.slot];
      const p = id ? pieceById.get(id) : null;
      el.querySelector('.pl__got').innerHTML = p ? `<code>${esc(p.text)}</code>` : '';
      el.dataset.full = String(Boolean(p));
      el.dataset.picked = String(picked === el.dataset.slot);
    }
    onChange(state());
  }
  function firstEmpty() {
    return slots.find((s) => !s.typed && !placed[s.id])?.id ?? null;
  }
  function place(pieceId, slotId = null) {
    const target = slotId ?? (picked && !placed[picked] ? picked : firstEmpty());
    if (!target) return false;
    for (const [k, v] of Object.entries(placed)) if (v === pieceId) delete placed[k];
    placed[target] = pieceId;
    picked = null;
    clearMarks();
    sound('ui-click');
    render();
    return true;
  }
  function unplace(slotId) {
    if (!placed[slotId]) return;
    delete placed[slotId];
    clearMarks();
    sound('ui-click');
    render();
  }
  function clearMarks() { for (const el of host.querySelectorAll('.pl__slot')) delete el.dataset.bad; }

  tray.addEventListener('click', (ev) => {
    const b = ev.target.closest('.pl__piece');
    if (b) place(b.dataset.piece);
  });
  for (const el of host.querySelectorAll('button.pl__slot')) {
    el.addEventListener('click', () => {
      const id = el.dataset.slot;
      if (placed[id]) unplace(id);
      else { picked = picked === id ? null : id; render(); }
    });
    el.addEventListener('dragover', (ev) => { ev.preventDefault(); el.dataset.over = 'true'; });
    el.addEventListener('dragleave', () => { delete el.dataset.over; });
    el.addEventListener('drop', (ev) => {
      ev.preventDefault(); delete el.dataset.over;
      const id = ev.dataTransfer?.getData('text/x-piece');
      if (id && pieceById.has(id)) place(id, el.dataset.slot);
    });
  }
  host.addEventListener('dragstart', (ev) => {
    const b = ev.target.closest?.('.pl__piece');
    if (!b) return;
    ev.dataTransfer?.setData('text/x-piece', b.dataset.piece);
    ev.dataTransfer && (ev.dataTransfer.effectAllowed = 'move');
  });
  input?.addEventListener('input', () => { clearMarks(); onChange(state()); });
  input?.addEventListener('keydown', (ev) => ev.stopPropagation());

  // slotId -> piece text, plus the typed word.
  function state() {
    const out = {};
    for (const [slot, id] of Object.entries(placed)) out[slot] = pieceById.get(id)?.text ?? '';
    return { placed: out, typed: input?.value ?? '' };
  }
  function mark(ids = []) {
    clearMarks();
    for (const id of ids) { const el = host.querySelector(`[data-slot="${id}"]`); if (el) el.dataset.bad = 'true'; }
  }
  function reset() { placed = {}; picked = null; if (input) input.value = ''; clearMarks(); render(); }

  render();
  return { state, mark, reset, place, unplace, input, focusTyped: () => input?.focus({ preventScroll: true }) };
}
