// 18.0: DOM for the skill tree and the quest log (data: progress-map.js).
// One screen each, no page scroll: the tree pans by dragging if it does not
// fit, the quest list scrolls inside its own box only when it has to.
import { FLOOR_NAMES } from './progress-map.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const STATE_LABEL = { done: 'ГОТОВО', now: 'СЕЙЧАС', next: 'СЛЕДУЮЩЕЕ', locked: 'ЗАКРЫТО', active: 'В РАБОТЕ' };

function panTo(el) {
  let drag = null;
  el.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    drag = { x: e.clientX, y: e.clientY, sl: el.scrollLeft, st: el.scrollTop, id: e.pointerId };
    try { el.setPointerCapture?.(e.pointerId); } catch { /* synthetic touch */ }
    el.dataset.dragging = 'true';
  });
  el.addEventListener('pointermove', (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    el.scrollLeft = drag.sl - (e.clientX - drag.x);
    el.scrollTop = drag.st - (e.clientY - drag.y);
  });
  const end = () => { drag = null; el.dataset.dragging = 'false'; };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
}

export function createSkillTreeView(root, { getTree, onEnterRealm = () => {}, onClose = () => {}, sound = () => {} } = {}) {
  if (!root) return { open() {}, close() {}, isOpen: () => false };
  let selected = null;
  function render() {
    const tree = getTree();
    const all = tree.flatMap((b) => b.nodes);
    if (!selected || !all.find((n) => n.id === selected)) selected = (all.find((n) => n.state === 'next' || n.state === 'now') ?? all[0])?.id;
    const sel = all.find((n) => n.id === selected);
    root.innerHTML = `
      <header class="tree__head"><div><small>QUEQUEST · ПРОКАЧКА</small><h2 id="treeTitle">Дерево навыков</h2></div>
        <p class="tree__legend"><span data-s="done">готово</span><span data-s="next">следующее</span><span data-s="locked">закрыто</span><span class="tree__pipkey">${FLOOR_NAMES.map((f) => `<i></i>${f}`).join(' ')}</span></p>
        <button class="tree__close" type="button" aria-label="Закрыть дерево навыков">×</button></header>
      <div class="tree__canvas" tabindex="0" aria-label="Ветки навыков. Перетащи, чтобы подвинуть.">
        ${tree.map((b) => `<section class="tree__branch" data-branch="${b.id}"><h3>${esc(b.title)}</h3><ol>${b.nodes.map((n) => `
          <li><button type="button" class="tree__node" data-id="${n.id}" data-state="${n.state}" data-kind="${n.kind}" aria-pressed="${n.id === selected}" aria-label="${esc(n.title)}: ${STATE_LABEL[n.state]}">
            <b>${esc(n.icon)}</b><span>${esc(n.title)}</span>${n.floors ? `<em class="tree__pips" aria-label="этажи">${n.floors.map((f, i) => `<i data-on="${f}" title="${FLOOR_NAMES[i]}"></i>`).join('')}</em>` : ''}
          </button></li>`).join('')}</ol></section>`).join('')}
      </div>
      <aside class="tree__detail" aria-live="polite">${sel ? `
        <div><small>${STATE_LABEL[sel.state]}${sel.code ? ` · <code>${esc(sel.code)}</code>` : ''}</small><h3>${esc(sel.icon)} ${esc(sel.title)}</h3><p>${esc(sel.what)}</p>
        ${sel.floors ? `<p class="tree__floors">${sel.floors.map((f, i) => `<span data-on="${f}">${f ? '✓' : '·'} ${FLOOR_NAMES[i]}</span>`).join('')}</p>` : ''}</div>
        <div class="tree__gate">${sel.state === 'done' ? '<b>Освоено.</b>' : `<b>Как открыть:</b> ${esc(sel.gate || 'Уже можно')}`}
        ${sel.kind === 'realm' && sel.state !== 'locked' ? `<button type="button" class="tree__enter" data-realm="${esc(sel.realm)}">ВОЙТИ В ПРОФЕССИЮ →</button>` : ''}</div>` : ''}
      </aside>`;
    root.querySelector('.tree__close').addEventListener('click', close);
    for (const b of root.querySelectorAll('.tree__node')) b.addEventListener('click', () => { selected = b.dataset.id; sound('ui-click'); const keep = root.querySelector('.tree__canvas'); const sl = keep.scrollLeft; const st = keep.scrollTop; render(); const c = root.querySelector('.tree__canvas'); c.scrollLeft = sl; c.scrollTop = st; });
    root.querySelector('.tree__enter')?.addEventListener('click', (e) => { close(); onEnterRealm(e.currentTarget.dataset.realm); });
    panTo(root.querySelector('.tree__canvas'));
  }
  function open() { root.hidden = false; render(); root.querySelector('.tree__close')?.focus(); }
  function close() { if (root.hidden) return; root.hidden = true; onClose(); }
  root.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); close(); } });
  return { open, close, isOpen: () => !root.hidden, render };
}

const TABS = [['main', 'Главный сюжет'], ['side', 'Дополнительные'], ['money', 'На деньги'], ['freelance', 'Фриланс']];

export function createQuestLogView(root, { getLog, onClose = () => {}, sound = () => {} } = {}) {
  if (!root) return { open() {}, close() {}, isOpen: () => false };
  let tab = 'main';
  function render() {
    const log = getLog();
    const list = log.tabs[tab] ?? [];
    root.innerHTML = `
      <header class="qlog__head"><div><small>QUEQUEST · ЖУРНАЛ</small><h2 id="qlogTitle">Квесты</h2></div><button class="qlog__close" type="button" aria-label="Закрыть журнал">×</button></header>
      <nav class="qlog__tabs" role="tablist">${TABS.map(([id, name]) => {
        const n = (log.tabs[id] ?? []).filter((q) => q.status === 'active').length;
        return `<button type="button" role="tab" data-tab="${id}" aria-selected="${id === tab}">${name}${n ? ` <i>${n}</i>` : ''}</button>`;
      }).join('')}</nav>
      <ol class="qlog__list" role="tabpanel">${list.map((q) => `
        <li class="qlog__q" data-status="${q.status}"${log.current?.id === q.id ? ' data-current="true"' : ''}>
          <div class="qlog__title"><b>${esc(q.title)}</b><span class="qlog__chip">${STATE_LABEL[q.status]}</span></div>
          <p class="qlog__giver">${esc(q.giver)}</p>
          <p class="qlog__goal">${esc(q.status === 'locked' && q.gate ? q.gate : q.goal)}</p>
          <p class="qlog__reward">Награда: ${esc(q.reward)}</p>
        </li>`).join('') || '<li class="qlog__empty">Пока пусто.</li>'}</ol>`;
    root.querySelector('.qlog__close').addEventListener('click', close);
    for (const b of root.querySelectorAll('[data-tab]')) b.addEventListener('click', () => { tab = b.dataset.tab; sound('ui-click'); render(); root.querySelector(`[data-tab="${tab}"]`)?.focus(); });
  }
  function open(which = 'main') { tab = which; root.hidden = false; render(); root.querySelector('.qlog__close')?.focus(); }
  function close() { if (root.hidden) return; root.hidden = true; onClose(); }
  root.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); close(); } });
  return { open, close, isOpen: () => !root.hidden, render };
}
