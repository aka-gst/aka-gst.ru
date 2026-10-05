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

export const PYTHONIO_PROTOCOL = 1;
export const PYTHONIO_SRC = 'games/pythonio/index.html';
export const PYTHONIO_SKILL = 'automation';

// Сверено с games/pythonio/src/data.js (tools/pythonio-bridge.test.mjs).
const ORDERS = [['Двенадцать фотографий', 170], ['Фото налево, текст направо', 220], ['Слишком много фото', 250], ['Архив без ошибок', 280], ['Мы это уже делали', 360], ['Городская премьера', 500], ['Газета к открытию школы', 560], ['Мастерская без тебя', 700], ['Поздравления без копипаста', 640], ['Чеки в таблицу', 720], ['Районная рассылка', 860], ['Утренняя рутина', 1100], ['Расходы по категориям', 1280], ['Отчёт к девяти', 1500], ['Выгрузка бухгалтеру', 1720], ['Заявки прямо в CRM', 1950], ['Архив сам раскладывается', 2140], ['JSON для соседнего сервиса', 2360], ['Письма уходят сами', 2600], ['Сервис иногда падает', 2950], ['Ответ потерялся', 3400], ['Ночная смена без человека', 3900]];
export const pythonioOrderId = (index) => `order-${String(index + 1).padStart(2, '0')}`;
// Монеты Pythonio (¤) → рубли QueQuest: четверть, круглыми десятками.
// Весь Pythonio даёт ~8,5 тыс. ₽ и 3190 XP; ветка AUTO +1 за заказ, финал +2.
export const PYTHONIO_ORDERS = Object.freeze(ORDERS.map(([name, coins], index) => Object.freeze({
  id: pythonioOrderId(index), index, name, coins,
  pay: Math.max(10, Math.round((coins * 0.25) / 10) * 10),
  xp: 40 + index * 10,
  skillGain: index === ORDERS.length - 1 ? 2 : 1,
})));

const LEARNED = [['printUnlocked', ['print']], ['ifUnlocked', ['if']], ['forUnlocked', ['for']], ['whileUnlocked', ['while']], ['listUnlocked', ['list']], ['funcUnlocked', ['def']], ['dictUnlocked', ['dict']], ['reliabilityUnlocked', ['try', 'log']], ['asyncUnlocked', ['queue', 'lock']]];
export function knownMoves(learning = {}) {
  return LEARNED.filter(([flag]) => Boolean(learning?.[flag])).flatMap(([, moves]) => moves);
}

export function helloMessage({ learning = {}, player = null } = {}) {
  return { source: 'quequest', type: 'hello', protocol: PYTHONIO_PROTOCOL, player: player ? String(player).slice(0, 32) : '', known: knownMoves(learning) };
}

// Anything that is not exactly one of our two messages is dropped.
export function validatePythonioMessage(data) {
  if (!data || typeof data !== 'object' || data.source !== 'pythonio' || data.protocol !== PYTHONIO_PROTOCOL) return null;
  if (data.type === 'ready') return { type: 'ready', version: typeof data.version === 'string' ? data.version.slice(0, 24) : '' };
  if (data.type !== 'order-complete') return null;
  if (!Number.isInteger(data.index) || data.index < 0 || data.index >= PYTHONIO_ORDERS.length) return null;
  const order = PYTHONIO_ORDERS[data.index];
  if (data.id !== order.id) return null;
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

// Pure, idempotent: the second call for the same id changes nothing and pays 0.
export function markPythonioOrder(profile = {}, id) {
  const order = PYTHONIO_ORDERS.find((o) => o.id === id);
  if (!order) return { profile, first: false, pay: 0, xp: 0, skillGain: 0, order: null };
  const guild = profile.labs?.guild ?? {};
  const key = ledgerKey(order.id);
  if (guild.skillLedger?.[key] || Object.prototype.hasOwnProperty.call(profile.awards ?? {}, key)) return { profile, first: false, pay: 0, xp: 0, skillGain: 0, order };
  let next = { ...profile, labs: { ...(profile.labs ?? {}), guild: { ...guild, skillLedger: { ...(guild.skillLedger ?? {}), [key]: { [PYTHONIO_SKILL]: order.skillGain } } } } };
  next = awardCampusXp(next, order.xp, key);
  return { profile: next, first: true, pay: order.pay, xp: order.xp, skillGain: order.skillGain, order };
}

// ------------------------------------------------------------------ DOM
const CSS_HREF = new URL('./pythonio-bridge.css', import.meta.url).href;
function esc(v) { return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

export function createPythonioBridge(host = globalThis.document?.body, {
  getLearning = () => ({}), getPlayer = () => null, getProfile = () => ({}), getWallet = () => 0, getLevel = () => 0,
  onOrder = () => ({ first: false }), onExit = () => {}, onSound = () => {}, src = PYTHONIO_SRC,
} = {}) {
  if (!host?.ownerDocument && !host?.querySelector) return { open() {}, close() {}, get active() { return false; } };
  const doc = host.ownerDocument ?? host;
  if (!doc.querySelector('link[data-pythonio-css]')) {
    const link = doc.createElement('link'); link.rel = 'stylesheet'; link.href = CSS_HREF; link.dataset.pythonioCss = '';
    doc.head.append(link);
  }
  const root = doc.createElement('section');
  root.id = 'pythonioDive'; root.className = 'pyio-dive'; root.hidden = true;
  root.setAttribute('aria-label', 'Pythonio — мастерская AUTO');
  root.innerHTML = `<header class="pyio-dive__bar"><button type="button" class="pyio-dive__surface" data-pyio-surface>↑ ВЫНЫРНУТЬ · Esc</button>
    <div class="pyio-dive__title"><small>AUTO · ГЛУБИНА ПРОФЕССИИ</small><b>ПИТОНИО · МАСТЕРСКАЯ</b></div>
    <div class="pyio-dive__stat" data-pyio-stat aria-live="polite"></div></header>
    <div class="pyio-dive__frame"><iframe title="Pythonio" data-pyio-frame></iframe></div>
    <p class="pyio-dive__toast" data-pyio-toast role="status" hidden></p>`;
  host.append(root);
  const frame = root.querySelector('[data-pyio-frame]');
  const stat = root.querySelector('[data-pyio-stat]');
  const toastEl = root.querySelector('[data-pyio-toast]');
  let active = false; let fromDive = false; let earned = []; let toastTimer = 0; let ready = false;

  function renderStat() {
    const done = pythonioDone(getProfile()).length;
    stat.innerHTML = `<span>ЗАКАЗЫ <b>${done}/${PYTHONIO_ORDERS.length}</b></span><span>AUTO <b>ур. ${esc(getLevel())}</b></span><span><b>${Number(getWallet() || 0).toLocaleString('ru-RU')}</b> ₽</span>`;
  }
  function toast(text, ok = true) {
    toastEl.textContent = text; toastEl.dataset.ok = String(ok); toastEl.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { toastEl.hidden = true; }, 5200);
  }
  function sendHello() {
    try { frame.contentWindow?.postMessage(helloMessage({ learning: getLearning(), player: getPlayer() }), location.origin); } catch { /* frame gone */ }
  }
  function onMessage(ev) {
    if (!active || ev.source !== frame.contentWindow || ev.origin !== location.origin) return;
    const msg = validatePythonioMessage(ev.data);
    if (!msg) return;
    if (msg.type === 'ready') { ready = true; sendHello(); return; }
    const res = onOrder(msg) ?? { first: false };
    if (res.first) {
      earned.push(msg.id);
      toast(`«${msg.order.name}» сдан: +${res.pay} ₽ · +${res.xp} XP · ветка AUTO +${res.skillGain}`);
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
    ev.preventDefault(); close();
  }
  function onHostKey(ev) {
    if (ev.key !== 'Escape' || !active) return;
    ev.preventDefault(); ev.stopImmediatePropagation(); close();
  }
  frame.addEventListener('load', () => {
    try { frame.contentWindow?.addEventListener('keydown', onFrameKey); } catch { /* not same-origin: no Esc hook */ }
  });
  root.querySelector('[data-pyio-surface]').addEventListener('click', () => close());
  globalThis.addEventListener?.('message', onMessage);

  function open({ fromDive: dive = false } = {}) {
    active = true; fromDive = Boolean(dive); earned = []; ready = false;
    root.hidden = false; root.dataset.from = fromDive ? 'dive' : 'menu';
    renderStat();
    frame.src = src;
    globalThis.addEventListener?.('keydown', onHostKey, true);
    onSound('boot');
    setTimeout(() => { try { frame.focus(); } catch { /* ignore */ } }, 50);
    return true;
  }
  function close() {
    if (!active) return false;
    active = false; root.hidden = true; toastEl.hidden = true;
    globalThis.removeEventListener?.('keydown', onHostKey, true);
    frame.src = 'about:blank'; // Pythonio saves on unload; stop its loop.
    onSound('whoosh');
    onExit({ fromDive, result: { ok: earned.length > 0, program: 'pythonio', orders: [...earned] } });
    return true;
  }
  return {
    open, close, sendHello,
    get active() { return active; }, get ready() { return ready; }, get root() { return root; }, get frame() { return frame; },
  };
}
