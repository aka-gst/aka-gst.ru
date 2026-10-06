// 19.2 · In-game account UI for the site's shared login (/akkaunty):
// a small pill («ВОЙТИ» / nick + save state) on the title screen and on the
// diver card, and one dialog (Google, passkey, nick + password, logout).
// QueQuest's look, not the site widget. It never blocks play: the dialog is
// optional, every call is non-throwing, and the pill stays HIDDEN until the
// service actually answers (it may not be deployed yet).
//
// account = window.QQ_AKK (akkaunty-adapter.js) or null → this is a no-op.

import { cleanNick, NICK_MAX } from './diver-card.js';
import { errorText, NICK_RULE, PASSWORD_RULE, checkLogin } from './akkaunty-adapter.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CSS_HREF = new URL('./account-ui.css?v=192', import.meta.url).href;
const METHOD_NAMES = { google: 'Google', passkey: 'passkey', password: 'ник и пароль' };

export function saveLine(st = {}) {
  if (!st.user) return 'Без входа прогресс живёт в этом браузере.';
  if (st.sync === 'offline' || st.sync === 'error') return 'Нет связи — сохраняется в браузере';
  if (st.sync === 'saving') return 'Сохраняю на аккаунт…';
  return 'Сохраняется на аккаунт ✓';
}

export function createAccountUi(host, { account = null, getProfile = () => ({}), getPlayer = () => null, onProfile = () => {}, onSound = () => {}, onChange = () => {} } = {}) {
  if (!account || !host) return { decorate() {}, refresh() {}, open() {}, close() {} };
  const doc = host.ownerDocument ?? document;
  if (!doc.querySelector('link[data-akk-css]')) { const l = doc.createElement('link'); l.rel = 'stylesheet'; l.href = CSS_HREF; l.dataset.akkCss = ''; doc.head.append(l); }
  let dlg = null, msg = '', busy = false, mode = 'login';
  const st = () => account.status();
  const nick = () => { const p = getProfile(); return cleanNick(p.duel?.nick || getPlayer()?.nick || ''); };

  // On the title: the nick; on the card (the nick is right above): «аккаунт».
  function pillHtml(where) {
    const s = st();
    if (s.service !== 'on') return '';
    if (!s.user) return '<b>ВОЙТИ</b><small>аккаунт сайта</small>';
    const warn = s.sync === 'offline' || s.sync === 'error';
    return `<b>● ${where === 'card' ? 'аккаунт' : esc(nick())}</b><small>${warn ? '⚠ в браузере' : s.sync === 'saving' ? 'сохраняю…' : 'на аккаунте ✓'}</small>`;
  }
  function paintPills() {
    for (const slot of doc.querySelectorAll('[data-akk-slot]')) {
      const html = pillHtml(slot.dataset.akkSlot);
      let b = slot.querySelector('.akk-pill');
      if (!b) { b = doc.createElement('button'); b.type = 'button'; b.className = 'akk-pill'; b.addEventListener('click', (e) => { e.stopPropagation(); onSound('ui-click'); open(); }); slot.append(b); }
      b.hidden = !html; b.innerHTML = html; b.dataset.user = String(Boolean(st().user)); b.dataset.warn = String(st().sync === 'offline' || st().sync === 'error');
      b.setAttribute('aria-label', st().user ? `Аккаунт: ${nick()}. ${saveLine(st())}` : 'Войти в аккаунт сайта');
      slot.hidden = !html;
    }
  }
  function decorate(node) {
    if (!node) return;
    if (!node.querySelector('[data-akk-slot]') && !node.matches?.('[data-akk-slot]')) { const s = doc.createElement('span'); s.className = 'akk-slot akk-slot--title'; s.dataset.akkSlot = 'title'; node.append(s); }
    paintPills();
  }

  // ------------------------------------------------------------ dialog
  function close() { dlg?.remove(); dlg = null; msg = ''; }
  function open() { if (st().service !== 'on') return; mode = 'login'; render(); }
  async function act(fn, okText = '') {
    if (busy) return; busy = true; msg = 'Секунду…'; render();
    let r;
    try { r = await fn(); } catch { r = { ok: false, error: 'offline' }; }
    busy = false;
    msg = r?.ok ? okText : errorText(r?.error);
    if (r?.ok) onSound('reflex-save'); else onSound('blocked');
    render(); paintPills(); onChange();
    return r;
  }
  function render() {
    const s = st();
    if (!dlg) {
      dlg = doc.createElement('div'); dlg.className = 'akk'; dlg.setAttribute('role', 'dialog'); dlg.setAttribute('aria-modal', 'true'); dlg.setAttribute('aria-labelledby', 'akkTitle');
      dlg.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } e.stopPropagation(); });
      dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
      doc.body.append(dlg);
    }
    const methods = (s.methods ?? []).map((m) => METHOD_NAMES[m] ?? m).join(', ');
    const body = s.user ? `
      <p class="akk__lead">Ты вошёл${methods ? ` · вход: <b>${esc(methods)}</b>` : ''}.</p>
      <p class="akk__save" data-warn="${s.sync === 'offline' || s.sync === 'error'}">${esc(saveLine(s))}</p>
      <label class="akk__field">Ник в игре <small>виден в дуэлях и в кодах друзьям</small><input id="akkNick" maxlength="${NICK_MAX}" value="${esc(nick())}" autocomplete="off"></label>
      <div class="akk__row"><button type="button" data-akk="passkey-add">+ PASSKEY К АККАУНТУ</button><span id="akkGoogle" class="akk__google"></span></div>
      <button type="button" class="akk__out" data-akk="logout">ВЫЙТИ</button>
      <small class="akk__note">После выхода в этом браузере снова будет прогресс гостя. Твой — на аккаунте, войди с любого устройства.</small>` : `
      <p class="akk__lead">Один вход для игр сайта. Прогресс поедет между устройствами. Без входа всё работает как раньше — в этом браузере, и при первом входе он <b>добавится</b> в аккаунт.</p>
      <div id="akkGoogle" class="akk__google"></div>
      <div class="akk__row"><button type="button" data-akk="passkey-login">ВОЙТИ ПО PASSKEY</button><button type="button" data-akk="passkey-new">СОЗДАТЬ PASSKEY</button></div>
      <form class="akk__form" id="akkForm" autocomplete="on">
        <div class="akk__tabs" role="tablist"><button type="button" role="tab" aria-selected="${mode === 'login'}" data-mode="login">ВХОД</button><button type="button" role="tab" aria-selected="${mode === 'register'}" data-mode="register">НОВЫЙ АККАУНТ</button></div>
        <label class="akk__field">Ник для входа<input id="akkLogin" name="username" autocomplete="username" maxlength="32" spellcheck="false" autocapitalize="off"></label>
        <label class="akk__field">Пароль<input id="akkPass" name="password" type="password" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}" maxlength="128"></label>
        ${mode === 'register' ? `<small class="akk__rule">${esc(NICK_RULE)}<br>${esc(PASSWORD_RULE)}<br>Ник для входа никому не показывается; в игре у тебя свой ник.</small>` : ''}
        <button type="submit" class="akk__go">${mode === 'login' ? 'ВОЙТИ' : 'СОЗДАТЬ АККАУНТ'}</button>
      </form>`;
    dlg.innerHTML = `<section class="akk__panel">
      <header class="akk__top"><div><small>АККАУНТ САЙТА · AKA-GST</small><h2 id="akkTitle">${s.user ? esc(nick()) : 'Вход'}</h2></div><button type="button" class="akk__close" aria-label="Закрыть">×</button></header>
      ${body}
      <p class="akk__msg" role="status" ${msg ? '' : 'hidden'}>${esc(msg)}</p>
    </section>`;
    dlg.querySelector('.akk__close').addEventListener('click', close);
    const on = (sel, fn) => dlg.querySelector(sel)?.addEventListener('click', fn);
    on('[data-akk="passkey-login"]', () => act(() => account.passkeyLogin(), 'Вход выполнен.'));
    on('[data-akk="passkey-new"]', () => act(() => account.passkeyRegister(), 'Аккаунт с passkey создан.'));
    on('[data-akk="passkey-add"]', () => act(() => account.passkeyRegister(), 'Passkey привязан к аккаунту.'));
    on('[data-akk="logout"]', () => act(() => account.logout(), 'Выход…'));
    for (const t of dlg.querySelectorAll('[data-mode]')) t.addEventListener('click', () => { mode = t.dataset.mode; msg = ''; render(); });
    dlg.querySelector('#akkForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const n = dlg.querySelector('#akkLogin').value, p = dlg.querySelector('#akkPass').value;
      if (mode === 'register') { const bad = checkLogin(n, p); if (bad) { msg = bad; render(); dlg.querySelector('#akkLogin').value = n; return; } }
      act(() => (mode === 'login' ? account.loginPassword(n, p) : account.registerPassword(n, p)), mode === 'login' ? 'Вход выполнен.' : 'Аккаунт создан, прогресс перенесён.');
    });
    dlg.querySelector('#akkNick')?.addEventListener('change', (e) => { const pr = getProfile(); onProfile({ ...pr, duel: { ...(pr.duel ?? {}), nick: cleanNick(e.target.value) } }); msg = 'Ник в игре сохранён.'; render(); paintPills(); onChange(); });
    const g = dlg.querySelector('#akkGoogle');
    if (g) { g.hidden = true; account.googleButton(g).then((ok) => { if (ok && g.isConnected) g.hidden = false; }).catch(() => {}); }
    (dlg.querySelector('#akkLogin') ?? dlg.querySelector('.akk__close'))?.focus({ preventScroll: true });
  }

  account.subscribe((s) => { paintPills(); if (dlg && (s.type === 'login' || s.type === 'service')) render(); if (s.type !== 'sync') onChange(); });
  return { decorate, refresh: paintPills, open, close, isOpen: () => Boolean(dlg) };
}
