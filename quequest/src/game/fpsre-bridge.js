// 20.0 · «ЧУЖОЙ МИР» inside QueQuest: the DOM half of fpsre-portal.js.
//
// The home PC desktop → «6 ЧУЖОЙ МИР» → the screen dive (screen-dive.js) →
// this overlay, full screen: FPS-RE V14.02 in a same-origin iframe. The game's
// files are not touched: once the frame loads, the bridge subscribes to the
// game's own EventBus (window.FPS_RE_DEBUG.ctx.events) and turns the events
// fpsre-portal.js knows into §13 proofs (deep:skill) and one-time rewards.
//
// Leaving (canon rule 29б): «↑ ВЫНЫРНУТЬ» / Esc leaves at once until the route
// has started; after that the first press turns the button into a question
// («ТОЧНО? ПРОГРЕСС МИРА ПРОПАДЁТ») and only the second press leaves — the
// world keeps no save of its route.
//
// Phones: the world needs a keyboard and a mouse, so a touch-only device gets
// an honest card instead of a frame it can't control.
import { FPSRE_SRC, FPSRE_NAME, FPSRE_EVENTS, readFpsreEvent, fpsreSurfaceLine, fpsreNeedsDesktop } from './fpsre-portal.js';

const CSS_HREF = new URL('./fpsre-bridge.css', import.meta.url).href;
const ROOT_URL = new URL('../../', import.meta.url);
const ASK_MS = 4000;

function track(event, data) {
  try { if (typeof globalThis.umami?.track === 'function') globalThis.umami.track(event, data); } catch { /* the counter must not break the game */ }
}

export function createFpsreBridge(host = globalThis.document?.body, {
  onProof = () => {}, onMilestone = () => ({ first: false }), onExit = () => {}, onSound = () => {},
  src = FPSRE_SRC, device = null,
} = {}) {
  if (!host?.ownerDocument && !host?.querySelector) return { open() {}, close() {}, get active() { return false; } };
  const doc = host.ownerDocument ?? host;
  if (!doc.querySelector('link[data-fpsre-css]')) {
    const link = doc.createElement('link'); link.rel = 'stylesheet'; link.href = CSS_HREF; link.dataset.fpsreCss = '';
    doc.head.append(link);
  }
  const root = doc.createElement('section');
  root.id = 'fpsreDive'; root.className = 're-dive'; root.hidden = true;
  root.setAttribute('aria-label', FPSRE_NAME);
  root.innerHTML = `<header class="re-dive__bar"><button type="button" class="re-dive__surface" data-re-surface>↑ ВЫНЫРНУТЬ · Esc</button>
    <div class="re-dive__title"><small>ГЛУБИНА · ЧУЖАЯ РЕАЛЬНОСТЬ</small><b>${FPSRE_NAME}</b></div>
    <div class="re-dive__stat" data-re-stat aria-live="polite"></div></header>
    <div class="re-dive__frame" data-re-frameview><iframe title="FPS-RE — System Archaeology" data-re-frame allow="fullscreen; pointer-lock"></iframe></div>
    <article class="re-dive__phone" data-re-phone hidden><h3>Этот мир — с клавиатурой и мышью</h3>
      <p>Здесь ходят на WASD и смотрят мышью: на телефоне им не управлять. Зайди с компьютера — прогресс QueQuest тот же.</p>
      <p>Что там: робот Q-Bot, который не знает, где ты, а только помнит и слышит. Пойми его правило — и заставь его систему работать на тебя.</p></article>
    <p class="re-dive__toast" data-re-toast role="status" hidden></p>`;
  host.append(root);
  const $ = (s) => root.querySelector(s);
  const frame = $('[data-re-frame]'); const stat = $('[data-re-stat]'); const toastEl = $('[data-re-toast]');
  const surfaceBtn = $('[data-re-surface]'); const frameView = $('[data-re-frameview]'); const phoneCard = $('[data-re-phone]');
  let active = false; let fromDive = false; let ready = false; let off = [];
  let run = null; let askUntil = 0; let askTimer = 0; let toastTimer = 0;

  const freshRun = () => ({ started: false, observed: 0, model: false, forced: false, solved: null, complete: false, exploits: 0, milestones: [] });
  const isPhone = () => (device ? device.phone : fpsreNeedsDesktop({
    fine: Boolean(globalThis.matchMedia?.('(pointer: fine)').matches),
    touch: Boolean(globalThis.matchMedia?.('(pointer: coarse)').matches) || (globalThis.navigator?.maxTouchPoints ?? 0) > 0,
  }));

  function renderStat() {
    if (!run) { stat.textContent = ''; return; }
    stat.innerHTML = `<span>УЛИКИ <b>${Math.min(4, run.observed)}/4</b></span><span>МОДЕЛЬ <b>${run.model ? 'ДОКАЗАНА' : run.forced ? 'СИЛОЙ' : '—'}</b></span><span>A17 <b>${run.solved ? 'ОТКРЫТ' : '—'}</b></span>`;
  }
  function toast(text, ok = true) {
    toastEl.textContent = text; toastEl.dataset.ok = String(ok); toastEl.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { toastEl.hidden = true; }, 6500);
  }
  function resetAsk() {
    askUntil = 0; clearTimeout(askTimer);
    surfaceBtn.textContent = '↑ ВЫНЫРНУТЬ · Esc'; surfaceBtn.dataset.ask = 'false';
  }

  // One game event (already from the game's own bus). Exposed for tests.
  function handle(ev) {
    if (!active || !run) return null;
    const r = readFpsreEvent(ev);
    if (!r) return null;
    if (r.started) run.started = true;
    if (ev.type === 'ARCHAEOLOGY_OBSERVATION') run.observed = Math.max(run.observed, Number(ev.count) || run.observed + 1);
    if (ev.type === 'ARCHAEOLOGY_MODEL_UNLOCKED') run.model = true;
    if (ev.type === 'ARCHAEOLOGY_EXPLOIT') run.exploits += 1;
    if (ev.type === 'FRAG' && !run.model) { run.forced = true; track('fpsre-forced', {}); }
    if (ev.type === 'RE_SOLVED') { run.solved = String(ev.solution); track('fpsre-solved', { solution: run.solved }); }
    if (r.milestone === 'complete') run.complete = true;
    if (r.milestone === 'model') track('fpsre-model', {});
    if (r.milestone === 'complete') track('fpsre-complete', {});
    if (r.proof) onProof(r.proof);
    if (r.milestone) {
      const reward = onMilestone(r.milestone) ?? { first: false };
      run.milestones.push(r.milestone);
      if (reward.first) { toast(`${reward.milestone?.line ?? ''} +${reward.pay} ₽ · +${reward.xp} XP.`, true); onSound('cash'); }
    }
    renderStat();
    return r;
  }

  function attach() {
    off.forEach((f) => f()); off = [];
    let w; try { w = frame.contentWindow; } catch { return false; }
    const dbg = w?.FPS_RE_DEBUG; const bus = dbg?.ctx?.events;
    if (!bus?.on) return false;
    // Not our server: the game's autolog would POST /api/log to the site.
    if (dbg.logger) dbg.logger.server = false;
    const logStatus = w.document.getElementById('logStatus');
    if (logStatus) logStatus.textContent = '';
    for (const type of FPSRE_EVENTS) off.push(bus.on(type, (e) => handle({ ...e, type })));
    try { w.addEventListener('keydown', escape, true); } catch { /* not same-origin */ }
    ready = true;
    return true;
  }
  frame.addEventListener('load', () => { if (active && frame.src !== 'about:blank') attach(); });

  const gameLocked = () => { try { return Boolean(frame.contentDocument?.pointerLockElement); } catch { return false; } };
  function surfacePress() {
    if (!active) return false;
    if (run?.started && !run.complete && Date.now() > askUntil) {
      askUntil = Date.now() + ASK_MS;
      surfaceBtn.textContent = 'ТОЧНО? ПРОГРЕСС МИРА ПРОПАДЁТ · ещё раз'; surfaceBtn.dataset.ask = 'true';
      clearTimeout(askTimer); askTimer = setTimeout(resetAsk, ASK_MS);
      onSound('blocked');
      return false;
    }
    return close();
  }
  function escape(ev) {
    if (ev.key !== 'Escape' || !active) return;
    if (gameLocked()) return; // the first Esc only frees the mouse
    ev.preventDefault(); ev.stopImmediatePropagation?.();
    surfacePress();
  }
  surfaceBtn.addEventListener('click', () => surfacePress());

  function open({ fromDive: dive = false } = {}) {
    active = true; fromDive = Boolean(dive); ready = false; run = freshRun(); resetAsk();
    root.hidden = false; root.dataset.from = fromDive ? 'dive' : 'menu';
    const phone = isPhone();
    root.dataset.view = phone ? 'phone' : 'game';
    phoneCard.hidden = !phone; frameView.hidden = phone;
    if (!phone) { const target = new URL(src, ROOT_URL); frame.src = target.pathname + target.search; }
    globalThis.addEventListener?.('keydown', escape, true);
    renderStat();
    onSound('boot');
    track('fpsre-open', { phone });
    return true;
  }
  function close() {
    if (!active) return false;
    active = false; root.hidden = true; toastEl.hidden = true; resetAsk();
    off.forEach((f) => f()); off = []; ready = false;
    globalThis.removeEventListener?.('keydown', escape, true);
    frame.src = 'about:blank';
    onSound('whoosh');
    const r = run ?? freshRun(); run = null;
    onExit({ fromDive, result: { ok: r.model || Boolean(r.solved) || r.complete, program: 'fpsre', line: fpsreSurfaceLine(r), ...r } });
    return true;
  }
  return {
    open, close, handle, attach, surfacePress,
    get active() { return active; }, get ready() { return ready; }, get run() { return run ? { ...run } : null; },
    get root() { return root; }, get frame() { return frame; },
  };
}
