// 19.0 · DOM of the first week: the pay card at the end of every day, and
// a pinned quest line that stays visible over the garage / apartment.
// The data comes from week.js; main.js decides when to show what.
import { WEEK, payLedger, FIRED } from './week.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const rub = (n) => `${n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('ru-RU')} ₽`;

export function createPayCard(host, { onNext = () => {}, sound = () => {} } = {}) {
  if (!host) return { show() {}, hide() {}, visible: () => false };
  const root = document.createElement('section');
  root.id = 'payCard';
  root.className = 'pay';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-labelledby', 'payTitle');
  host.appendChild(root);
  let shownKey = '';
  let nextAt = 0;

  // card: { day, fired, quote: { who, text }, me, ledger, button, wage }
  function show(card) {
    const key = JSON.stringify(card);
    if (!root.hidden && key === shownKey) return;
    shownKey = key;
    const ledger = card.ledger ?? payLedger(card.day, { wage: card.wage });
    const rows = ledger.rows.map((r) => `<tr data-tone="${r.tone ?? ''}"><td>${esc(r.label)}${r.count ? ` <small>${r.count} × 20 ₽</small>` : ''}</td><td>${r.value > 0 && r.tone ? '+' : ''}${rub(r.value)}</td></tr>`).join('');
    root.dataset.fired = String(Boolean(card.fired));
    root.innerHTML = `<div class="pay__card">
      <p class="pay__kicker">${esc(card.fired ? `РАСЧЁТ · ДЕНЬ 5 · 17:40` : `КАССА · ДЕНЬ ${card.day} · 17:00`)}</p>
      <h2 id="payTitle">${esc(card.fired ? 'Ты уволен.' : 'Расчётный листок')}</h2>
      <ol class="pay__week" aria-label="Неделя">${WEEK.map((d) => `<li data-state="${d.day < card.day ? 'done' : d.day === card.day ? 'now' : 'next'}"><b>${d.day}</b><span>${esc(d.way)}</span></li>`).join('')}</ol>
      ${card.quote ? `<blockquote class="pay__quote"><small>${esc(card.quote.who)}</small>«${esc(card.quote.text)}»${card.me ? `<em>Ты: «${esc(card.me)}»</em>` : ''}</blockquote>` : ''}
      <table class="pay__rows">${rows}</table>
      <p class="pay__total"><span>${card.fired ? 'НА РУКИ' : 'ЗА ДЕНЬ'}</span><b>${rub(ledger.total)}</b></p>
      <p class="pay__wallet">На счету: <b>${rub(card.wage ?? ledger.wage)}</b></p>
      ${card.fired ? `<p class="pay__chip">${esc(FIRED.chip)}</p>` : ''}
      <button type="button" class="pay__next run-code">${esc(card.button)}</button>
    </div>`;
    root.hidden = false;
    nextAt = performance.now() + 450;
    const btn = root.querySelector('.pay__next');
    btn.addEventListener('click', () => {
      if (performance.now() < nextAt) return;
      sound('ui-click');
      onNext();
    });
    setTimeout(() => btn.focus({ preventScroll: true }), 40);
  }
  function hide() { if (!root.hidden) { root.hidden = true; shownKey = ''; } }
  root.addEventListener('keydown', (ev) => {
    if (['Enter', 'Space', 'KeyE'].includes(ev.code)) { ev.preventDefault(); ev.stopPropagation(); root.querySelector('.pay__next')?.click(); }
  });
  return { show, hide, visible: () => !root.hidden, root };
}

// A quest pin above everything (the garage and the apartment cover the
// normal HUD): «◆ Сходи в гараж к Вите».
export function createWeekPin(host) {
  if (!host) return { set() {} };
  const el = document.createElement('p');
  el.id = 'weekPin';
  el.className = 'week-pin';
  el.hidden = true;
  el.setAttribute('aria-live', 'polite');
  host.appendChild(el);
  let last = '';
  return {
    set(text, tone = '') {
      if (!text) { el.hidden = true; last = ''; return; }
      const key = `${tone}|${text}`;
      if (key !== last) { el.innerHTML = `<b>${tone === 'done' ? '✓' : '◆'}</b> ${esc(text)}`; el.dataset.tone = tone; last = key; }
      el.hidden = false;
    },
    el,
  };
}
