// 19.3 · «Взломай меня» overlay (canon §20): the vulnerable practice system
// with five flags, an «инструменты исследователя» panel so phones without
// DevTools can play, the ethics end card, «Сообщить о дыре» and «Зал славы».
// Data + judges live in polygon.js (pure); this file only draws and drives.
// One overlay, one screen, ≥14px, no page scroll (the flag list / tool panel
// scroll inside themselves if needed).

import { FLAG_IDS, FLAGS, submitOrder, clickAdmin, submitInput, guessToken, forgeSignature, correctSignatureFor, naiveFilter, MY_TOKEN, REAL_PRICE, SIGN_CHALLENGE, flagsFound, polygonDone, markFlag, ETHICS, composeReport, reportValid, hallOfFame, addToHall, addReport } from './polygon.js';
import { TAMPER_SALT } from './tamper.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CSS_HREF = new URL('./hack.css?v=193', import.meta.url).href;

export function createHackPolygon(root, { getProfile = () => ({}), onProfile = () => {}, onSound = () => {}, onBadge = () => {}, getNick = () => 'Дайвер', onClose = () => {} } = {}) {
  if (!root) return { open() {}, close() {}, isOpen: () => false, state: () => ({}) };
  const doc = root.ownerDocument;
  if (doc && !doc.querySelector('link[data-hack-css]')) { const l = doc.createElement('link'); l.rel = 'stylesheet'; l.href = CSS_HREF; l.dataset.hackCss = ''; doc.head.append(l); }
  let open = false, view = 'polygon', picked = 'price', msg = '', report = '';
  // Per-flag editable state the «инструменты» panel changes.
  let st = fresh();
  function fresh() { return { price: REAL_PRICE, adminDisabled: true, input: '', token: '', salt: '' }; }
  const sound = (n) => { try { onSound(n); } catch { /* optional */ } };

  function shell(title, kicker, body, { back = view !== 'polygon' } = {}) {
    root.innerHTML = `<header class="hk__top"><div><small>${esc(kicker)}</small><h2>${esc(title)}</h2></div>
      <div class="hk__actions">${back ? '<button type="button" class="hk__back" data-go="polygon">← ПОЛИГОН</button>' : ''}<button type="button" class="hk__close" aria-label="Закрыть">×</button></div></header>
      <div class="hk__body" data-view="${view}">${body}</div>`;
    root.querySelector('.hk__close').addEventListener('click', close);
    for (const b of root.querySelectorAll('[data-go]')) b.addEventListener('click', () => { sound('ui-click'); go(b.dataset.go); });
  }
  function go(where) { view = where; msg = ''; render(); }

  function solve(id, ok, { badgeMsg = '' } = {}) {
    if (!ok) { msg = 'Пока нет. Подсказка в панели «инструменты исследователя».'; sound('duel-wrong'); render(); return; }
    const before = Boolean(getProfile().hack?.flags?.[id]);
    const r = markFlag(getProfile(), id);
    onProfile(r.profile);
    if (!before) { onBadge(FLAGS[id].badge); sound('duel-buff'); }
    else sound('ui-click');
    msg = `ФЛАГ ${FLAGS[id].n}/5 · ${FLAGS[id].title}. ${FLAGS[id].lesson}`;
    void badgeMsg;
    render();
  }

  // ------------------------------------------------------------ the mini system
  function flagBody(id) {
    const p = getProfile();
    const done = Boolean(p.hack?.flags?.[id]);
    const F = FLAGS[id];
    let system = '', tools = '';
    if (id === 'price') {
      system = `<div class="hk-shop"><h4>Магазин «ТИСКОВ»</h4><p>Товар: приёмник. Цена на сервере: <b>${REAL_PRICE} ₽</b>.</p>
        <label>Цена в заказе (из браузера) <input id="hkPrice" type="number" value="${st.price}"></label>
        <button type="button" class="hk-go" data-act="price-send">ОТПРАВИТЬ ЗАКАЗ</button></div>`;
      tools = `<p>Это поле цены приходит с твоего браузера — «сервер» ему верит. Поставь цену меньше ${REAL_PRICE} и отправь.</p>
        <button type="button" class="hk-tool" data-act="price-cheat">↯ поставить 1 ₽ в поле</button>`;
    } else if (id === 'admin') {
      system = `<div class="hk-shop"><h4>Панель «ТИСКОВ»</h4>
        <button type="button" class="hk-admin" ${st.adminDisabled ? 'disabled' : ''} data-act="admin-click">ВОЙТИ КАК admin</button>
        <p class="hk-note">${st.adminDisabled ? 'Кнопка серая — отключена атрибутом disabled.' : 'Кнопка включена.'}</p></div>`;
      tools = `<p>Кнопка «admin» на странице есть — её только «отключили» атрибутом disabled. Сними его и нажми.</p>
        <button type="button" class="hk-tool" data-act="admin-enable">↯ снять disabled с кнопки</button>`;
    } else if (id === 'input') {
      system = `<div class="hk-shop"><h4>Имя пользователя</h4>
        <label>Введи имя <input id="hkInput" value="${esc(st.input)}" autocomplete="off" spellcheck="false"></label>
        <p class="hk-note">Фильтр вырезает слово «админ». Текст после фильтра: <code>${esc(naiveFilter(st.input))}</code></p>
        <button type="button" class="hk-go" data-act="input-send">ОТПРАВИТЬ</button></div>`;
      tools = `<p>Фильтр вырезает «админ» всего один раз. Напиши так, чтобы после вырезания слово осталось: <code>адмадминин</code>.</p>
        <button type="button" class="hk-tool" data-act="input-fill">↯ вставить «адмадминин»</button>`;
    } else if (id === 'token') {
      system = `<div class="hk-shop"><h4>Твой заказ</h4><p>Номер твоего заказа: <b>${MY_TOKEN}</b>.</p>
        <label>Открыть заказ по номеру <input id="hkToken" value="${esc(st.token)}" placeholder="KOD-00000" autocomplete="off"></label>
        <button type="button" class="hk-go" data-act="token-send">ОТКРЫТЬ</button></div>`;
      tools = `<p>Коды идут по порядку. Если твой — ${MY_TOKEN}, то чей-то соседний — следующий по счёту.</p>
        <button type="button" class="hk-tool" data-act="token-next">↯ подставить следующий код</button>`;
    } else {
      system = `<div class="hk-shop"><h4>Сохранение подписано</h4><p>Проверь значение: <code>${esc(SIGN_CHALLENGE)}</code>.</p>
        <label>Соль подписи (или готовая сумма) <input id="hkSalt" value="${esc(st.salt)}" autocomplete="off" spellcheck="false"></label>
        <button type="button" class="hk-go" data-act="sign-send">ПОДПИСАТЬ</button></div>`;
      tools = `<p>Исходник открыт — соль лежит прямо в коде (как кнопка admin из флага 2). Вот она: <code>${esc(TAMPER_SALT)}</code>. Или впиши готовую сумму: <code>${esc(correctSignatureFor(SIGN_CHALLENGE))}</code>.</p>
        <button type="button" class="hk-tool" data-act="sign-reveal">↯ взять соль из исходника</button>`;
    }
    return `<article class="hk-flag" data-done="${done}">
      <div class="hk-flag__sys">${system}<p class="hk-msg" id="hkMsg" role="status">${esc(msg)}</p></div>
      <aside class="hk-flag__tools"><b>ИНСТРУМЕНТЫ ИССЛЕДОВАТЕЛЯ</b>${tools}
        ${done ? `<div class="hk-lesson"><b>✓ ФЛАГ ${F.n}</b><p>${esc(F.lesson)}</p><p class="hk-def">Как защищаются по-настоящему: ${esc(F.defender)}</p></div>` : ''}
      </aside></article>`;
  }

  function renderPolygon() {
    const p = getProfile();
    const found = flagsFound(p);
    const list = FLAG_IDS.map((id) => { const F = FLAGS[id]; const done = found.includes(id); return `<li><button type="button" data-flag="${id}" aria-pressed="${picked === id}" data-done="${done}"><b>${done ? '✓' : F.n}</b><span>${esc(F.title)}</span></button></li>`; }).join('');
    shell('Взломай меня', 'ТИСКИ · ТЕСТОВЫЙ СЕРВЕР (учебный полигон)', `
      <p class="hk-intro"><b>Тимур:</b> «ТИСКИ забыли выключить тестовый сервер. Он нарочно дырявый — на нём можно учиться законно. Найди пять дыр и пойми, как от них защищаются. Это наш полигон: ломать можно только его».</p>
      <div class="hk-grid">
        <ol class="hk-flags">${list}</ol>
        <section class="hk-stage">${flagBody(picked)}</section>
      </div>
      <nav class="hk-nav"><span>Найдено ${found.length} из 5</span><button type="button" class="hk-link" data-go="report">СООБЩИТЬ О ДЫРЕ</button><button type="button" class="hk-link" data-go="hall">ЗАЛ СЛАВЫ</button>${polygonDone(p) ? '<button type="button" class="hk-go" data-go="ethics">ИТОГ →</button>' : ''}</nav>`, { back: false });
    for (const b of root.querySelectorAll('[data-flag]')) b.addEventListener('click', () => { picked = b.dataset.flag; msg = ''; sound('ui-click'); renderPolygon(); });
    wireFlag();
    if (polygonDone(p) && !p.hack?.polygonCardShown) { onProfile({ ...p, hack: { ...(p.hack ?? {}), polygonCardShown: true } }); }
  }
  function syncField(id, key, cast = (v) => v) { const el = root.querySelector(id); if (el) el.addEventListener('input', () => { st[key] = cast(el.value); }); }
  function wireFlag() {
    syncField('#hkPrice', 'price', Number); syncField('#hkInput', 'input'); syncField('#hkToken', 'token'); syncField('#hkSalt', 'salt');
    const act = (name, fn) => { const b = root.querySelector(`[data-act="${name}"]`); if (b) b.addEventListener('click', fn); };
    act('price-cheat', () => { st.price = 1; renderPolygon(); });
    act('price-send', () => solve('price', submitOrder({ price: st.price }).flag));
    act('admin-enable', () => { st.adminDisabled = false; renderPolygon(); });
    act('admin-click', () => solve('admin', clickAdmin({ disabled: st.adminDisabled }).flag));
    act('input-fill', () => { st.input = 'адмадминин'; renderPolygon(); });
    act('input-send', () => solve('input', submitInput(st.input).flag));
    act('token-next', () => { st.token = 'KOD-00042'; renderPolygon(); });
    act('token-send', () => solve('token', guessToken(st.token).flag));
    act('sign-reveal', () => { st.salt = TAMPER_SALT; renderPolygon(); });
    act('sign-send', () => solve('sign', forgeSignature({ salt: st.salt }).flag));
  }

  function renderEthics() {
    shell(ETHICS.title, 'ВЗЛОМАЙ МЕНЯ · ЭТИКА', `
      <section class="hk-ethics">
        <p class="hk-ethics__win">Все пять флагов найдены. Ты научился видеть швы — теперь важно, куда ты это направишь.</p>
        <ul>${ETHICS.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
        <nav class="hk-nav"><button type="button" class="hk-link" data-go="report">СООБЩИТЬ О ДЫРЕ</button><button type="button" class="hk-link" data-go="hall">ЗАЛ СЛАВЫ</button><button type="button" class="hk-go" data-go="polygon">НАЗАД К ФЛАГАМ</button></nav>
      </section>`);
  }

  function renderReport() {
    shell('Сообщить о дыре', 'НАШЁЛ ДЫРУ У НАС?', `
      <section class="hk-report">
        <p>Нашёл настоящую дыру в QueQuest? Опиши её — соберём текст, который можно скопировать. Пока это не уходит на сервер (бэкенда ещё нет); владелец позже подключит свою форму/сервис.</p>
        <label>Что за дыра <input id="hkWhat" autocomplete="off"></label>
        <label>Где (экран, кнопка) <input id="hkWhere" autocomplete="off"></label>
        <label>Как повторить <textarea id="hkHow" rows="3"></textarea></label>
        <button type="button" class="hk-go" id="hkReportMake">СОБРАТЬ ОТЧЁТ</button>
        <pre class="hk-report__out" id="hkReportOut" ${report ? '' : 'hidden'}>${esc(report)}</pre>
        <div class="hk-report__row" ${report ? '' : 'hidden'}><button type="button" id="hkReportCopy">СКОПИРОВАТЬ</button><span id="hkReportDone" role="status">${esc(msg)}</span></div>
      </section>`);
    root.querySelector('#hkReportMake').addEventListener('click', () => {
      const what = root.querySelector('#hkWhat').value, where = root.querySelector('#hkWhere').value, how = root.querySelector('#hkHow').value;
      if (!reportValid({ what, how })) { msg = 'Напиши хотя бы «что» и «как повторить».'; sound('duel-wrong'); renderReport(); return; }
      report = composeReport({ what, where, how, nick: getNick() });
      onProfile(addReport(getProfile(), report).profile);
      msg = ''; sound('reflex-save'); renderReport();
    });
    const copyBtn = root.querySelector('#hkReportCopy');
    if (copyBtn) copyBtn.addEventListener('click', async () => {
      let ok = false; try { await navigator.clipboard.writeText(report); ok = true; } catch { /* select instead */ }
      const el = root.querySelector('#hkReportDone'); if (el) el.textContent = ok ? '✓ Скопировано' : 'Выдели текст и скопируй вручную';
      sound('ui-click');
    });
  }

  function renderHall() {
    const rows = hallOfFame(getProfile()).map((e) => `<li><b>${esc(e.nick)}</b><span>${esc(e.deed || '—')}</span></li>`).join('');
    shell('Зал славы', 'НАШЛИ ШВЫ ЧЕСТНО', `
      <section class="hk-hall">
        <p>Те, кто нашёл швы в QueQuest и сообщил по-честному. Владелец может вписать сюда настоящие имена.</p>
        <ul class="hk-hall__list">${rows}</ul>
        <label class="hk-hall__add">Записать себя (нашёл дыру?) <input id="hkHallDeed" placeholder="что нашёл" autocomplete="off"></label>
        <button type="button" class="hk-go" id="hkHallAdd">ДОБАВИТЬ В ЗАЛ СЛАВЫ</button>
      </section>`);
    root.querySelector('#hkHallAdd').addEventListener('click', () => {
      const deed = root.querySelector('#hkHallDeed').value.trim(); if (!deed) return;
      onProfile(addToHall(getProfile(), { nick: getNick(), deed }).profile);
      sound('reflex-save'); renderHall();
    });
  }

  function render() {
    if (view === 'polygon') renderPolygon(); else if (view === 'ethics') renderEthics(); else if (view === 'report') renderReport(); else if (view === 'hall') renderHall(); else renderPolygon();
    root.dataset.view = view;
  }
  function openPolygon(v = 'polygon') { open = true; root.hidden = false; st = fresh(); view = v; msg = ''; report = ''; render(); }
  function close() { open = false; root.hidden = true; onClose(); }
  root.addEventListener('keydown', (e) => { if (root.hidden) return; if (e.key === 'Escape' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) { e.preventDefault(); if (view === 'polygon') close(); else go('polygon'); } });

  return {
    open: openPolygon, close, isOpen: () => open,
    // for tests / the admin panel: solve a flag directly (same as the tools).
    state: () => ({ open, view, picked, found: flagsFound(getProfile()), done: polygonDone(getProfile()) }),
    solveFlag: (id) => { const fn = { price: () => submitOrder({ price: 1 }).flag, admin: () => clickAdmin({ disabled: false }).flag, input: () => submitInput('адмадминин').flag, token: () => guessToken('KOD-00042').flag, sign: () => forgeSignature({ salt: TAMPER_SALT }).flag }[id]; if (fn) solve(id, fn()); },
  };
}
