// JUMP KILL · Лабиринт inside QueQuest: the DOM half of labyrinth.js.
//
// The author's Black Ice NIGHTFALL lies as a static build in games/blackice/
// (source repo and commit in games/blackice/VERSION). Entries: the home PC
// desktop → «5 JUMP KILL», the arcade cabinet in the garage, and the cabinet's
// AR holo-tag → the screen dive (screen-dive.js) → this overlay, full screen,
// inside the program's frame: a lobby with the level ladder, then the game in
// an iframe. «↑ ВЫНЫРНУТЬ» / Esc (when the game is not running) goes back —
// first to the lobby, then out to the room.
//
// Level layouts are fetched lazily (games/blackice/levels/NN.json) only when a
// level is entered, and handed to the game in the hello message.
import {
  BLACKICE_SRC, BLACKICE_PROTOCOL, LABYRINTH_NAME, LABYRINTH_EVENT, LABYRINTH_STORE_KEY, LABYRINTH_FLOORS, LABYRINTH_ROSTER,
  floorById, floorUnlocked, labyrinthCleared, nextFloor, validateBlackIceMessage, helloMessage, parseStore, recordRun,
  leaderboard, ghostFor, labyrinthEventDetail, labyrinthLines,
} from './labyrinth.js';

const CSS_HREF = new URL('./blackice-bridge.css', import.meta.url).href;
const ROOT_URL = new URL('../../', import.meta.url);
function esc(v) { return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
const clock = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const GOAL = { frags: (f) => `${f.fragLimit} фрагов · ${clock(f.duration)}`, rings: () => 'кольца на время', breach: (f) => `прорыв · ${clock(f.duration)}`, mission: () => 'операция CITADEL' };
const MUT = { rockets: 'ТОЛЬКО РАКЕТЫ', rail: 'ТОЛЬКО РЕЛЬСА', glass: 'СТЕКЛО', haste: 'HASTE', quad: 'QUAD' };

export function createBlackIceBridge(host = globalThis.document?.body, {
  getPlayer = () => null, getProfile = () => ({}), getWallet = () => 0,
  onFloor = () => ({ first: false }), onExit = () => {}, onSound = () => {}, onEvent = null,
  storage = globalThis.localStorage, fetchJson = (url) => fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
  src = BLACKICE_SRC, quality = null,
} = {}) {
  if (!host?.ownerDocument && !host?.querySelector) return { open() {}, close() {}, get active() { return false; } };
  const doc = host.ownerDocument ?? host;
  if (!doc.querySelector('link[data-blackice-css]')) {
    const link = doc.createElement('link'); link.rel = 'stylesheet'; link.href = CSS_HREF; link.dataset.blackiceCss = '';
    doc.head.append(link);
  }
  const root = doc.createElement('section');
  root.id = 'blackiceDive'; root.className = 'bi-dive'; root.hidden = true;
  root.setAttribute('aria-label', 'JUMP KILL — Лабиринт');
  root.innerHTML = `<header class="bi-dive__bar"><button type="button" class="bi-dive__surface" data-bi-surface>↑ ВЫНЫРНУТЬ · Esc</button>
    <button type="button" class="bi-dive__surface" data-bi-lobby hidden>≡ УРОВНИ</button>
    <div class="bi-dive__title"><small>ГЛУБИНА · ОБЩИЙ МИР ГОРОДА</small><b>${esc(LABYRINTH_NAME)}</b></div>
    <div class="bi-dive__stat" data-bi-stat aria-live="polite"></div></header>
    <div class="bi-dive__lobby" data-bi-lobbyview><ol class="bi-ladder" data-bi-ladder></ol><article class="bi-floor" data-bi-floor></article></div>
    <div class="bi-dive__frame" data-bi-frameview hidden><iframe title="Jump Kill — Black Ice" data-bi-frame allow="fullscreen; pointer-lock"></iframe></div>
    <p class="bi-dive__toast" data-bi-toast role="status" hidden></p>`;
  host.append(root);
  const $ = (s) => root.querySelector(s);
  const frame = $('[data-bi-frame]'); const stat = $('[data-bi-stat]'); const toastEl = $('[data-bi-toast]');
  const ladder = $('[data-bi-ladder]'); const floorEl = $('[data-bi-floor]');
  const lobbyView = $('[data-bi-lobbyview]'); const frameView = $('[data-bi-frameview]'); const lobbyBtn = $('[data-bi-lobby]');
  let active = false; let fromDive = false; let view = 'lobby'; let picked = 1; let playing = null; let level = null;
  let ready = false; let toastTimer = 0; let results = []; let lastError = '';

  const readStore = () => { try { return parseStore(storage?.getItem(LABYRINTH_STORE_KEY) ?? 'null'); } catch { return parseStore('null'); } };
  const writeStore = (s) => { try { storage?.setItem(LABYRINTH_STORE_KEY, JSON.stringify(s)); } catch { /* private mode */ } };
  const player = () => String(getPlayer() || 'ТЫ').toUpperCase();

  function renderStat() {
    const done = labyrinthCleared(getProfile()).length;
    stat.innerHTML = `<span>УРОВНИ <b>${done}/${LABYRINTH_FLOORS.length}</b></span><span><b>${Number(getWallet() || 0).toLocaleString('ru-RU')}</b> ₽</span>`;
  }
  function renderLobby() {
    const profile = getProfile(); const done = new Set(labyrinthCleared(profile)); const store = readStore();
    ladder.innerHTML = LABYRINTH_FLOORS.map((f) => {
      const open = floorUnlocked(profile, f.n); const state = done.has(f.n) ? 'clear' : open ? 'open' : 'locked';
      return `<li><button type="button" data-bi-pick="${f.n}" data-state="${state}" aria-pressed="${f.n === picked}" ${open ? '' : 'aria-disabled="true"'}>
        <kbd>${String(f.n).padStart(2, '0')}</kbd><b>${esc(f.title)}</b><small>${state === 'clear' ? '✓ пройден' : state === 'open' ? esc(GOAL[f.objective](f)) : '🔒 закрыт'}</small></button></li>`;
    }).join('');
    const f = floorById(picked); const open = floorUnlocked(profile, f.n);
    const roster = f.roster.map((id) => LABYRINTH_ROSTER[id]).filter(Boolean);
    const ghost = ghostFor(store, f, player());
    const board = leaderboard(store, f.n).slice(0, 7);
    floorEl.innerHTML = `<header><small>УРОВЕНЬ ${f.n} · ${esc(GOAL[f.objective](f).toUpperCase())}${f.level ? '' : ' · КАРТА BLACK ICE'}</small><h3>${esc(f.title)}</h3></header>
      <p class="bi-floor__intro">${esc(f.intro)}</p><p>${esc(f.brief)}</p>
      ${f.mutators.length ? `<p class="bi-floor__mut">${f.mutators.map((m) => `<span>${esc(MUT[m] ?? m)}</span>`).join('')}</p>` : ''}
      ${roster.length ? `<h4>НА УРОВНЕ</h4><ul class="bi-floor__roster">${roster.map((r) => `<li><b>${esc(r.name)}</b> <small>${esc(r.who)} · «${esc(r.taunt)}»</small></li>`).join('')}${ghost ? `<li><b>${esc(ghost.name)}</b> <small>твой забег ${esc(clock(ghost.time))} — повторяет каждый шаг и выстрел</small></li>` : ''}</ul>` : ''}
      <h4>ДОСКА УРОВНЯ</h4><ol class="bi-floor__board">${board.map((r) => `<li data-npc="${Boolean(r.npc)}" data-won="${r.won}"><b>${esc(r.name)}</b><span>${r.won ? clock(r.time) : '—'}</span><small>${f.objective === 'frags' ? `${r.kills} фр.${r.npc ? '' : ` · ${r.deaths} см.`}` : ''}</small></li>`).join('')}</ol>
      <p class="bi-floor__reward">Первое прохождение: +${f.pay} ₽ · +${f.xp} XP</p>
      <button type="button" class="bi-floor__go" data-bi-go ${open ? '' : 'disabled'}>${open ? `ВОЙТИ НА УРОВЕНЬ ${f.n} →` : 'СНАЧАЛА ПРОЙДИ ПРЕДЫДУЩИЙ'}</button>
      ${lastError ? `<p class="bi-floor__err">${esc(lastError)}</p>` : ''}`;
    renderStat();
  }
  function setView(v) {
    view = v; lobbyView.hidden = v !== 'lobby'; frameView.hidden = v !== 'game'; lobbyBtn.hidden = v !== 'game';
    root.dataset.view = v;
  }
  function toast(text, ok = true) {
    toastEl.textContent = text; toastEl.dataset.ok = String(ok); toastEl.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { toastEl.hidden = true; }, 6500);
  }
  function sendHello() {
    if (!playing) return;
    try { frame.contentWindow?.postMessage(helloMessage({ floor: playing, player: player(), ghost: ghostFor(readStore(), playing, player()), level }), location.origin); } catch { /* frame gone */ }
  }
  async function enter(n = picked) {
    const f = floorById(n);
    if (!f || !floorUnlocked(getProfile(), n)) return false;
    picked = n; playing = f; level = null; ready = false; lastError = '';
    if (f.level) {
      try { level = await fetchJson(new URL(f.level, ROOT_URL).href); } catch (e) { lastError = `Уровень не загрузился: ${e.message ?? e}`; playing = null; renderLobby(); return false; }
      if (!active || playing !== f) return false;
    }
    setView('game');
    const q = quality ?? (globalThis.navigator?.webdriver ? 'low' : null);
    frame.src = `${new URL(src, ROOT_URL).pathname}?qq=1${q ? `&quality=${q}` : ''}`;
    onSound('boot');
    setTimeout(() => { try { frame.focus(); } catch { /* ignore */ } }, 80);
    return true;
  }
  function lobby() {
    if (view !== 'game') return false;
    frame.src = 'about:blank'; playing = null; ready = false;
    setView('lobby'); renderLobby(); onSound('ui-click');
    return true;
  }
  // A result from the game (or the debug hook): validated, recorded on the
  // local board, paid once per level, announced to the feed.
  function handle(data) {
    const msg = validateBlackIceMessage(data);
    if (!msg) return null;
    if (msg.type === 'ready') { ready = true; sendHello(); return msg; }
    if (!playing || msg.floor.n !== playing.n) return null;
    const { store, ghostSaved } = recordRun(readStore(), msg, { player: player(), at: Date.now() });
    writeStore(store);
    const reward = msg.won ? (onFloor(msg) ?? { first: false }) : { first: false };
    const detail = labyrinthEventDetail(msg, reward);
    results.push(detail);
    try { globalThis.dispatchEvent?.(new CustomEvent(LABYRINTH_EVENT, { detail })); } catch { /* old browser */ }
    onEvent?.(detail, labyrinthLines(detail));
    if (msg.won) {
      const next = nextFloor(getProfile());
      toast(`${reward.first ? `Уровень ${msg.floor.n} пройден: +${reward.pay} ₽ · +${reward.xp} XP.` : `Уровень ${msg.floor.n} снова пройден — награда была один раз.`}${ghostSaved ? ' Забег записан призраком.' : ''} ${msg.floor.outro}${next && next !== msg.floor.n ? ` Открыт уровень ${next}.` : ''}`, true);
    } else toast(`Уровень ${msg.floor.n}: ${labyrinthLines(detail)[0]?.[1] ?? 'ещё раз.'}`, false);
    renderStat();
    return { msg, reward, detail };
  }
  function onMessage(ev) {
    if (!active || ev.source !== frame.contentWindow || ev.origin !== location.origin) return;
    if (ev.data?.source === 'blackice' && ev.data?.type === 'level-error') { lastError = `Уровень не собрался: ${String(ev.data.error ?? '').slice(0, 120)}`; return; }
    handle(ev.data);
  }
  // Esc inside the game pauses it; only an Esc while it is not running leaves.
  const gameRunning = () => { try { return frame.contentWindow?.CITADEL?.state === 'playing'; } catch { return false; } };
  function escape(ev) {
    if (ev.key !== 'Escape' || !active) return;
    if (view === 'game' && gameRunning()) return;
    ev.preventDefault(); ev.stopImmediatePropagation?.();
    if (view === 'game') lobby(); else close();
  }
  frame.addEventListener('load', () => {
    try { frame.contentWindow?.addEventListener('keydown', escape, true); } catch { /* not same-origin */ }
  });
  root.querySelector('[data-bi-surface]').addEventListener('click', () => close());
  lobbyBtn.addEventListener('click', () => lobby());
  root.addEventListener('click', (ev) => {
    const pick = ev.target.closest?.('[data-bi-pick]');
    if (pick) { picked = Number(pick.dataset.biPick); renderLobby(); onSound('ui-click'); return; }
    if (ev.target.closest?.('[data-bi-go]')) enter(picked);
  });
  globalThis.addEventListener?.('message', onMessage);

  function open({ fromDive: dive = false, floor = null } = {}) {
    active = true; fromDive = Boolean(dive); results = []; ready = false; lastError = '';
    picked = floor ?? nextFloor(getProfile()) ?? 1;
    root.hidden = false; root.dataset.from = fromDive ? 'dive' : 'menu';
    setView('lobby'); renderLobby();
    globalThis.addEventListener?.('keydown', escape, true);
    onSound('boot');
    return true;
  }
  function close() {
    if (!active) return false;
    active = false; root.hidden = true; toastEl.hidden = true; playing = null;
    globalThis.removeEventListener?.('keydown', escape, true);
    frame.src = 'about:blank';
    onSound('whoosh');
    const won = results.filter((r) => r.won);
    onExit({ fromDive, result: { ok: won.length > 0, program: 'blackice', floors: won.map((r) => r.floor), results: [...results] } });
    return true;
  }
  return {
    open, close, enter, lobby, handle, sendHello,
    get active() { return active; }, get ready() { return ready; }, get view() { return view; }, get playing() { return playing?.n ?? null; },
    get root() { return root; }, get frame() { return frame; }, protocol: BLACKICE_PROTOCOL,
  };
}
