// Шаг 2 «СЛЕДУЮЩИХ ШАГОВ»: Pythonio — глубина профессии AUTO.
//
// Pythonio (aka-gst/pythonio, тот же автор, MIT) лежит статикой в
// games/pythonio/ (версия и коммит — games/pythonio/VERSION). Входы:
// домашний комп → «4 ПИТОНИО» → нырок (screen-dive.js) → мастерская
// во весь экран, внутри рамки программы; и финиш дня ЛИНИИ 03 →
// «дальше — мастерская». «↑ ВЫНЫРНУТЬ» / Esc — обратно в комнату (или к
// профессиям, если вошёл не с компа).
//
// Протокол 1, только postMessage между окнами одного origin:
//   QueQuest → Pythonio  {source:'quequest', type:'hello', protocol:1, player, known}
//     known — выученные в QueQuest приёмы (print, if, for, while, list, def,
//     dict, try, log, queue, lock): Pythonio не вводит их заново.
//   Pythonio → QueQuest  {source:'pythonio', type:'ready', protocol:1, version}
//                        {source:'pythonio', type:'order-complete', protocol:1,
//                         id:'order-NN', index, name, reward, rep, finale, method?}
//     method (18.1): 'manual' | 'rules' | 'def' — the §13 floor of the order.
// Награда — по своей таблице (не по цифрам из сообщения) и один раз на id:
// ключ `pythonio:order-NN` в skillLedger профиля (ветка AUTO) и в awards (XP).

import { awardCampusXp } from './campus-profile.js';
import { pythonioStory, ENGINEER_QUESTS, MEGACORP } from './career-story.js';

export const PYTHONIO_PROTOCOL = 1;
// ?v= — the iframe page and its files are cached by browsers; bump with games/pythonio/index.html's ?v=
export const PYTHONIO_SRC = 'games/pythonio/index.html?v=20.0.5';
export const PYTHONIO_SKILL = 'automation';

// Сверено с games/pythonio/src/data.js (tools/pythonio-bridge.test.mjs).
const ORDERS = [['Двенадцать фотографий', 170], ['Фото налево, текст направо', 220], ['Слишком много фото', 250], ['Архив без ошибок', 280], ['Мы это уже делали', 360], ['Городская премьера', 500], ['Газета к открытию школы', 560], ['Мастерская без тебя', 700], ['Поздравления без копипаста', 640], ['Чеки в таблицу', 720], ['Районная рассылка', 860], ['Утренняя рутина', 1100], ['Расходы по категориям', 1280], ['Отчёт к девяти', 1500], ['Выгрузка бухгалтеру', 1720], ['Заявки прямо в CRM', 1950], ['Архив сам раскладывается', 2140], ['JSON для соседнего сервиса', 2360], ['Письма уходят сами', 2600], ['Сервис иногда падает', 2950], ['Ответ потерялся', 3400], ['Ночная смена без человека', 3900]];
export const pythonioOrderId = (index) => `order-${String(index + 1).padStart(2, '0')}`;
// QueQuest pays 20 ₽ per required file; workshop equipment coins stay separate.
const ORDER_COUNTS = [12,20,42,20,30,48,36,60,28,32,44,64,36,40,34,36,38,34,32,30,28,26];
export const PYTHONIO_ORDERS = Object.freeze(ORDERS.map(([name, coins], index) => Object.freeze({
  id: pythonioOrderId(index), index, name, coins,
  count: ORDER_COUNTS[index], pay: ORDER_COUNTS[index] * 20,
  xp: 40 + index * 10,
  skillGain: index === ORDERS.length - 1 ? 2 : 1,
})));

const LEARNED = [['printUnlocked', ['print']], ['ifUnlocked', ['if']], ['forUnlocked', ['for']], ['whileUnlocked', ['while']], ['listUnlocked', ['list']], ['funcUnlocked', ['def']], ['dictUnlocked', ['dict']], ['reliabilityUnlocked', ['try', 'log']], ['asyncUnlocked', ['queue', 'lock']]];
export function knownMoves(learning = {}) {
  return LEARNED.filter(([flag]) => Boolean(learning?.[flag])).flatMap(([, moves]) => moves);
}

// 19.0 · story: the engineer quests (career-story.js) reframe Pythonio's
// first orders as people «ТИСКИ-Маркет» squeezes. Optional for Pythonio:
// an older build simply ignores the field.
export function helloMessage({ learning = {}, player = null, story = pythonioStory() } = {}) {
  return { source: 'quequest', type: 'hello', protocol: PYTHONIO_PROTOCOL, player: player ? String(player).slice(0, 32) : '', known: knownMoves(learning), story };
}

// Only validated ready, active-order and completed-order messages are accepted.
export function validatePythonioMessage(data) {
  if (!data || typeof data !== 'object' || data.source !== 'pythonio' || data.protocol !== PYTHONIO_PROTOCOL) return null;
  if (data.type === 'ready') return { type: 'ready', version: typeof data.version === 'string' ? data.version.slice(0, 24) : '' };
  if (!['order-complete', 'order-active'].includes(data.type)) return null;
  if (!Number.isInteger(data.index) || data.index < 0 || data.index >= PYTHONIO_ORDERS.length) return null;
  const order = PYTHONIO_ORDERS[data.index];
  if (data.id !== order.id) return null;
  if (data.type === 'order-active') return { type: 'order-active', id: order.id, index: order.index, order };
  if (data.reward !== undefined && !(Number.isFinite(data.reward) && data.reward >= 0)) return null;
  // 18.1 (canon §13): how the order was done → the floor in mastery.js:
  // manual → tap, rules/table → knobs, def route → code. Optional.
  const method = ['manual', 'rules', 'table', 'def'].includes(data.method) ? data.method : 'manual';
  return { type: 'order-complete', id: order.id, index: order.index, order, method };
}

const ledgerKey = (id) => `pythonio:${id}`;
export function pythonioDone(profile = {}) {
  const ledger = profile.labs?.guild?.skillLedger ?? {};
  return PYTHONIO_ORDERS.filter((o) => ledger[ledgerKey(o.id)]).map((o) => o.id);
}
// 20.0: the dive bar shows rubles earned in Pythonio, from the saved profile. It showed the shift
// wallet (state.warehouse.wage), which lives only until a reload: 100 ₽ after two orders became 0 ₽.
export function pythonioEarned(profile = {}) {
  const done = new Set(pythonioDone(profile));
  return PYTHONIO_ORDERS.filter((o) => done.has(o.id)).reduce((sum, o) => sum + (profile.labs?.guild?.creditLedger?.[ledgerKey(o.id)] ?? Math.max(10,Math.round(o.coins*.25/10)*10)), 0);
}

// Pure, idempotent: the second call for the same id changes nothing and pays 0.
export function markPythonioOrder(profile = {}, id) {
  const order = PYTHONIO_ORDERS.find((o) => o.id === id);
  if (!order) return { profile, first: false, pay: 0, xp: 0, skillGain: 0, order: null };
  const guild = profile.labs?.guild ?? {};
  const key = ledgerKey(order.id);
  if (guild.skillLedger?.[key] || Object.prototype.hasOwnProperty.call(profile.awards ?? {}, key)) return { profile, first: false, pay: 0, xp: 0, skillGain: 0, order };
  let next = { ...profile, labs: { ...(profile.labs ?? {}), guild: { ...guild, skillLedger: { ...(guild.skillLedger ?? {}), [key]: { [PYTHONIO_SKILL]: order.skillGain } }, creditLedger:{...(guild.creditLedger??{}),[key]:order.pay} } } };
  next = awardCampusXp(next, order.xp, key);
  return { profile: next, first: true, pay: order.pay, xp: order.xp, skillGain: order.skillGain, order };
}

// Deduplicate repeated state reports within one actual workshop visit.
export function createOrderStartGate(onStart = () => {}) {
  let current = null;
  return {
    observe(index) {
      if (!Number.isInteger(index) || index < 0 || index >= PYTHONIO_ORDERS.length || current === index) return false;
      current = index; onStart(index); return true;
    },
    reset() { current = null; },
  };
}

// ------------------------------------------------------------------ DOM
const CSS_HREF = new URL('./pythonio-bridge.css?v=qq206', import.meta.url).href;
function esc(v) { return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

export function createPythonioBridge(host = globalThis.document?.body, {
  getLearning = () => ({}), getPlayer = () => null, getProfile = () => ({}), getWallet = () => 0, getLevel = () => 0,
  onOrder = () => ({ first: false }), onActiveOrder = () => {}, onExit = () => {}, onSound = () => {}, src = PYTHONIO_SRC,
} = {}) {
  if (!host?.ownerDocument && !host?.querySelector) return { open() {}, close() {}, get active() { return false; } };
  const doc = host.ownerDocument ?? host;
  if (!doc.querySelector('link[data-pythonio-css]')) {
    const link = doc.createElement('link'); link.rel = 'stylesheet'; link.href = CSS_HREF; link.dataset.pythonioCss = '';
    doc.head.append(link);
  }
  const root = doc.createElement('section');
  root.id = 'pythonioDive'; root.className = 'pyio-dive'; root.hidden = true;
  root.setAttribute('aria-label', 'Питонио — мастерская инженера');
  root.innerHTML = `<header class="pyio-dive__bar"><button type="button" class="pyio-dive__surface" data-pyio-surface>↑ ВЫНЫРНУТЬ</button>
    <div class="pyio-dive__title"><small>ИНЖЕНЕР · СВОЙ ЦЕХ ВМЕСТО «ТИСКИ-МАРКЕТА»</small><b>ПИТОНИО · МАСТЕРСКАЯ</b></div>
    <div class="pyio-dive__stat" data-pyio-stat aria-live="polite"></div></header>
    <div class="pyio-dive__frame"><iframe title="Pythonio" data-pyio-frame></iframe></div>
    <p class="pyio-dive__toast" data-pyio-toast role="status" hidden></p>
    <div class="pyio-dive__pause" data-pyio-pause role="dialog" aria-label="Пауза" hidden><b>ПАУЗА</b><button type="button" data-pyio-resume>ПРОДОЛЖИТЬ · Esc</button><button type="button" data-pyio-leave>↑ ВЫНЫРНУТЬ</button></div>`;
  host.append(root);
  const frame = root.querySelector('[data-pyio-frame]');
  const stat = root.querySelector('[data-pyio-stat]');
  const toastEl = root.querySelector('[data-pyio-toast]');
  const orderStarts = createOrderStartGate(onActiveOrder);
  let active = false; let fromDive = false; let earned = []; let toastTimer = 0; let ready = false;

  function renderStat() {
    const done = pythonioDone(getProfile()).length;
    stat.innerHTML = `<span>ЗАКАЗЫ <b>${done}/${PYTHONIO_ORDERS.length}</b></span><span>ИНЖЕНЕР <b>ур. ${esc(getLevel())}</b></span><span>ЗАРАБОТАНО <b>${pythonioEarned(getProfile()).toLocaleString('ru-RU')}</b> ₽</span>`;
  }
  // 20.0: the reward line sat at the bottom, where Pythonio's own letter keeps its button. The frame
  // is same-origin, so its buttons are visible from here: the line takes the first spot over none.
  const toastSpots = () => [{ top: 'auto', bottom: '22px' }, { top: `${Math.round(frame.getBoundingClientRect().top + 8)}px`, bottom: 'auto' }, { top: '45%', bottom: 'auto' }];
  function frameButtonsUnder(r) {
    const hit = (L, T, w, h) => w && L < r.right && L + w > r.left && T < r.bottom && T + h > r.top;
    let n = [...root.querySelectorAll('button,a[href]')].filter((e) => e.offsetParent && !frame.contains(e)).filter((e) => { const b = e.getBoundingClientRect(); return hit(b.left, b.top, b.width, b.height); }).length;
    try {
      const fr = frame.getBoundingClientRect(); const d = frame.contentDocument; if (!d) return n;
      n += [...d.querySelectorAll('button,a[href],input,select,textarea,[role="button"]')].filter((e) => e.offsetParent).filter((e) => {
        const b = e.getBoundingClientRect(); return hit(fr.left + b.left, fr.top + b.top, b.width, b.height);
      }).length;
    } catch { /* frame gone */ }
    return n;
  }
  function placeToast() {
    let best = null;
    for (const spot of toastSpots()) {
      Object.assign(toastEl.style, spot);
      const n = frameButtonsUnder(toastEl.getBoundingClientRect());
      if (!best || n < best.n) best = { spot, n };
      if (!n) return;
    }
    Object.assign(toastEl.style, best.spot);
  }
  let toastPlaceTimer = 0;
  function toast(text, ok = true) {
    toastEl.textContent = text; toastEl.dataset.ok = String(ok); toastEl.hidden = true;
    clearInterval(toastPlaceTimer); clearTimeout(toastTimer);
    // Pythonio's letter opens a beat after the order: show the line once it is there, and keep it clear of it
    toastTimer = setTimeout(() => {
      toastEl.hidden = false; placeToast();
      toastPlaceTimer = setInterval(() => { if (toastEl.hidden) clearInterval(toastPlaceTimer); else placeToast(); }, 250);
      toastTimer = setTimeout(() => { toastEl.hidden = true; clearInterval(toastPlaceTimer); }, 5200);
    }, 600);
  }
  function sendHello() {
    try { frame.contentWindow?.postMessage(helloMessage({ learning: getLearning(), player: getPlayer() }), location.origin); } catch { /* frame gone */ }
  }
  function onMessage(ev) {
    if (!active || ev.source !== frame.contentWindow || ev.origin !== location.origin) return;
    const msg = validatePythonioMessage(ev.data);
    if (!msg) return;
    if (msg.type === 'ready') { ready = true; sendHello(); return; }
    if (msg.type === 'order-active') { orderStarts.observe(msg.index); return; }
    const res = onOrder(msg) ?? { first: false };
    if (res.first) {
      earned.push(msg.id);
      const q = ENGINEER_QUESTS.find((x) => x.order === msg.id);
      toast(q ? `${q.victim}: «${q.thanks}» +${res.pay} ₽ · +${res.xp} XP · ветка ИНЖЕНЕР +${res.skillGain}` : `«${msg.order.name}» сдан: +${res.pay} ₽ · +${res.xp} XP · ветка ИНЖЕНЕР +${res.skillGain}`);
    } else toast(`«${msg.order.name}» уже засчитан в QueQuest — награда один раз.`, false);
    renderStat();
  }
  // Esc inside the workshop: Pythonio uses it to drop a tool or close its
  // dialogs; only a "free" Esc (no dialog, select tool) surfaces.
  function pyioWantsEsc(d) {
    if (!d) return false;
    if (d.querySelector('dialog[open]')) return true;
    const tool = d.querySelector('.tool-mode.active');
    return Boolean(tool && tool.dataset.mode && tool.dataset.mode !== 'select');
  }
  function onFrameKey(ev) {
    if (ev.key !== 'Escape' || !active) return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(ev.target?.tagName)) return;
    if (pyioWantsEsc(frame.contentDocument)) return;
    ev.preventDefault(); setPause(!paused);
  }
  function onHostKey(ev) {
    if (ev.key !== 'Escape' || !active) return;
    ev.preventDefault(); ev.stopImmediatePropagation(); setPause(!paused);
  }
  // 19.0: Esc pauses (Esc again resumes); leaving is the explicit button.
  const pauseEl = root.querySelector('[data-pyio-pause]');
  let paused = false; let pausedSpeed = 1;
  function setPause(on) {
    paused = Boolean(on) && active;
    pauseEl.hidden = !paused;
    try { const S = frame.contentWindow?.Workshop?.state; if (S) { if (paused) { pausedSpeed = S.speed; S.speed = 0; } else if (S.speed === 0) S.speed = pausedSpeed || 1; } } catch { /* not ready */ }
    if (paused) pauseEl.querySelector('[data-pyio-resume]')?.focus({ preventScroll: true });
    else { try { frame.focus(); } catch { /* ignore */ } }
    onSound('ui-click');
  }
  pauseEl.querySelector('[data-pyio-resume]').addEventListener('click', () => setPause(false));
  pauseEl.querySelector('[data-pyio-leave]').addEventListener('click', () => { setPause(false); close(); });
  frame.addEventListener('load', () => {
    try { frame.contentWindow?.addEventListener('keydown', onFrameKey); } catch { /* not same-origin: no Esc hook */ }
  });
  root.querySelector('[data-pyio-surface]').addEventListener('click', () => close());
  globalThis.addEventListener?.('message', onMessage);

  function open({ fromDive: dive = false, demoOrder = null } = {}) {
    active = true; fromDive = Boolean(dive); earned = []; ready = false; orderStarts.reset();
    root.hidden = false; root.dataset.from = fromDive ? 'dive' : 'menu';
    renderStat();
    const entry = new URL(src, doc.baseURI);
    if (/^(?:[1-9]|1\d|2[0-2])$/.test(String(demoOrder??''))) entry.searchParams.set('qq-demo-order', demoOrder);
    frame.src = entry.href;
    globalThis.addEventListener?.('keydown', onHostKey, true);
    onSound('boot');
    setTimeout(() => { try { frame.focus(); } catch { /* ignore */ } }, 50);
    return true;
  }
  // A trusted host Next continues through the existing child UI handler.
  function nextOrder() {
    if (!active || paused) return false;
    try {
      const button = frame.contentDocument?.querySelector('#modal[open] #advance');
      if (!button || button.disabled || !button.getClientRects().length) return false;
      button.click(); return true;
    } catch { return false; }
  }
  function close() {
    if (!active) return false;
    active = false; paused = false; pauseEl.hidden = true; root.hidden = true; toastEl.hidden = true;
    globalThis.removeEventListener?.('keydown', onHostKey, true);
    frame.src = 'about:blank'; // Pythonio saves on unload; stop its loop.
    onSound('whoosh');
    onExit({ fromDive, result: { ok: earned.length > 0, program: 'pythonio', orders: [...earned] } });
    return true;
  }
  return {
    open, close, sendHello, nextOrder,
    get active() { return active; }, get ready() { return ready; }, get root() { return root; }, get frame() { return frame; },
  };
}
