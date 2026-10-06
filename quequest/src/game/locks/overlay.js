// Доска Сани — оверлей мини-игры замков поверх гаража (свой элемент и свой
// stylesheet, как pythonio-bridge.js: index.html и styles.css не трогаем).
//
// Вкладки: УСТРОЙСТВА (шесть выдуманных механизмов на ядре core.js),
// ШКАФ (cabinet.js), PYTHON (python-tasks.js), КАРТОЧКИ (bench.js).
// Управление устройством:
//   W/S или ↑/↓ (держать), колесо, ползунок — натяжение воротка;
//   1..8 или клик по штифту — поднять штифт; второй раз в верхнем окне —
//   посадить (в режиме «без тайминга» — сразу);
//   Пробел / R — отпустить вороток; X — рентген; N — следующее; Esc — отойти.
import {
  MECHANISMS, mechanismById, createLock, setPressure, releasePressure, probeSector, tick, bandAt, feel, tempoLeft, liftAt, variant, EASE_DEPTH,
} from './core.js';
import { createState as createCabinet, attemptOpen, cabinetAction, ROUTE_NAMES } from './cabinet.js';
import { LOCK_PY_TASKS, lockTaskById, checkLockTask } from './python-tasks.js';
import { LOCK_CARDS } from './bench.js';
import { xrayTier } from './rewards.js';
import { locksBus, LOCKS_OPEN } from './events.js';

const CSS_HREF = new URL('./overlay.css', import.meta.url).href;
export const LOCKS_STORE_KEY = 'quequest.locks.v1';
const STOCK_MAX = 3;
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const WORDS = Object.freeze({
  waiting: ['ГОТОВ', 'Подтяни вороток и подними штифт. Механизм ответит звуком и дрожью.'],
  light: ['ЛЕГКО', 'Штифт болтается — натяжения мало. Подтяни вороток.'],
  hard: ['ТУГО', 'Всё зажато, штифт не идёт. Ослабь натяжение.'],
  'false-echo': ['ЗАКЛИНИЛО', 'Не тот штифт. Механизм встал — отпусти вороток (Пробел).'],
  blocked: ['ЗАЖАТО', 'Пока не отпустишь вороток, механизм ничего не скажет.'],
  'false-set': ['ЛОЖНАЯ ПОСАДКА', 'Штифт-обманка сел понарошку. Чуть ослабь натяжение и подними его ещё раз.'],
  dropped: ['УПАЛ', 'Слишком ослабил — обманка провалилась. Чуть сильнее, и снова.'],
  set: ['ПОСАДКА', 'Щёлк. Штифт на месте — теперь механизм ждёт следующий.'],
  released: ['ОТПУЩЕНО', 'Вороток отпущен. Посаженные штифты держатся, заклинивание ушло.'],
  seized: ['САМОСБРОС', 'Устройство защитилось: всё сброшено. Отпусти вороток и начни спокойнее.'],
  relock: ['ТЕМП', 'Штифт упал — время вышло. Здесь важен ритм.'],
  missed: ['МИМО', 'Не попал в верхнее окно. Жми второй раз, когда штифт завис наверху.'],
  opened: ['ОТКРЫТО', 'Механизм сдался. Не силой — пониманием.'],
});

function loadStore(storage) {
  try { const v = JSON.parse(storage?.getItem(LOCKS_STORE_KEY) ?? 'null'); if (v && typeof v === 'object') return { opened: {}, best: {}, stock: 0, routes: [], py: {}, timing: true, ...v }; } catch { /* broken */ }
  return { opened: {}, best: {}, stock: 0, routes: [], py: {}, timing: true };
}

export function createLockBench(host = globalThis.document?.body, {
  getProfile = () => ({}), getWallet = () => 0, getXray = () => ({ headset: false, device: 0 }), getMuted = () => false,
  onReward = () => ({ first: false }), onSay = () => null, onSound = () => {}, onClose = () => {},
  storage = globalThis.localStorage, reducedMotion = false,
} = {}) {
  if (!host?.ownerDocument && !host?.querySelector) return { open() {}, close() {}, get active() { return false; }, state: () => null };
  const doc = host.ownerDocument ?? host;
  if (!doc.querySelector('link[data-locks-css]')) {
    const link = doc.createElement('link'); link.rel = 'stylesheet'; link.href = CSS_HREF; link.dataset.locksCss = '';
    doc.head.append(link);
  }
  let store = loadStore(storage);
  const save = () => { try { storage?.setItem(LOCKS_STORE_KEY, JSON.stringify(store)); } catch { /* private mode */ } };

  const root = doc.createElement('section');
  root.id = 'locksBench'; root.className = 'lk'; root.hidden = true;
  root.setAttribute('aria-label', 'Доска Сани — мастерская замков');
  root.innerHTML = `<header class="lk-bar">
      <button type="button" class="lk-back" data-lk-close>← ОТОЙТИ · Esc</button>
      <div class="lk-title"><small>ГАРАЖ · ВЕРСТАК · ВЫДУМАННЫЕ УСТРОЙСТВА</small><b>ДОСКА САНИ</b></div>
      <div class="lk-stat" data-lk-stat aria-live="polite"></div>
    </header>
    <nav class="lk-tabs" role="tablist">
      <button type="button" role="tab" data-lk-tab="board">УСТРОЙСТВА</button>
      <button type="button" role="tab" data-lk-tab="cabinet">ШКАФ</button>
      <button type="button" role="tab" data-lk-tab="python">PYTHON</button>
      <button type="button" role="tab" data-lk-tab="cards">КАРТОЧКИ</button>
    </nav>
    <div class="lk-view" data-lk-view="board">
      <ol class="lk-list" data-lk-list></ol>
      <div class="lk-stage" data-lk-stage>
        <div class="lk-head"><b data-lk-brand></b><span data-lk-idea></span></div>
        <svg class="lk-svg" data-lk-svg viewBox="0 0 640 340" role="img" aria-label="Разрез выдуманного механизма"></svg>
        <div class="lk-meter">
          <label>НАТЯЖЕНИЕ <input type="range" min="0" max="100" value="0" data-lk-pressure aria-label="Натяжение воротка"></label>
          <output data-lk-pv>00</output>
          <button type="button" class="lk-btn" data-lk-release>ОТПУСТИТЬ · Пробел</button>
        </div>
        <div class="lk-readout" data-lk-readout aria-live="polite"><span data-lk-event></span><p data-lk-msg></p></div>
        <div class="lk-row">
          <button type="button" class="lk-btn" data-lk-xray>X · РЕНТГЕН</button>
          <button type="button" class="lk-btn" data-lk-timing>ТАЙМИНГ</button>
          <button type="button" class="lk-btn" data-lk-next>N · СЛЕДУЮЩЕЕ</button>
        </div>
        <p class="lk-hint"><kbd>W</kbd>/<kbd>S</kbd> или <kbd>↑</kbd>/<kbd>↓</kbd> — натяжение · <kbd>1</kbd>–<kbd>8</kbd> или клик — поднять штифт, ещё раз наверху — посадить · <kbd>Пробел</kbd> — отпустить · <kbd>X</kbd> — рентген. Это выдуманная игровая механика, а не инструкция для настоящих замков.</p>
      </div>
    </div>
    <div class="lk-view" data-lk-view="cabinet" hidden></div>
    <div class="lk-view" data-lk-view="python" hidden></div>
    <div class="lk-view" data-lk-view="cards" hidden></div>
    <p class="lk-say" data-lk-say hidden><b></b><span></span></p>
    <p class="lk-toast" data-lk-toast role="status" hidden></p>`;
  host.append(root);
  const $ = (s) => root.querySelector(s);
  const svg = $('[data-lk-svg]'); const stage = $('[data-lk-stage]');
  const pressureEl = $('[data-lk-pressure]'); const pvEl = $('[data-lk-pv]');

  let active = false; let raf = 0; let tab = 'board';
  let mech = MECHANISMS[0]; let spec = mech; let lock = createLock(spec);
  let lifts = {}; // sector -> t0 (seconds)
  let event = 'waiting'; let shakeUntil = 0; let shakeAmp = 0; let started = null; let openedAt = null;
  let xrayOn = true; let held = new Set(); let lastT = 0; let shownP = 0; let kick = 0; let acc = 0.6; let pAcc = 0;
  let cab = createCabinet(); let cabRun = null; let cabResult = null; let cabNote = 'Шкаф Сани. Шкала молчит: сначала подготовка — свет, сигнал или стабилизатор.';
  let pyTask = LOCK_PY_TASKS[0].id; let pyResult = null;
  let toastTimer = 0; let sayTimer = 0;

  // ------------------------------------------------------------ sound
  let ac = null; let hum = null;
  function ctx() {
    if (getMuted()) return null;
    try {
      if (!ac) { const A = globalThis.AudioContext || globalThis.webkitAudioContext; if (!A) return null; ac = new A(); }
      if (ac.state === 'suspended') ac.resume();
      return ac;
    } catch { return null; }
  }
  function tone(f0, f1, dur, gain = 0.05, type = 'triangle', delay = 0) {
    const a = ctx(); if (!a) return;
    const t = a.currentTime + delay; const o = a.createOscillator(); const g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, gain = 0.04, freq = 900, delay = 0) {
    const a = ctx(); if (!a) return;
    const len = Math.floor(a.sampleRate * dur); const buf = a.createBuffer(1, len, a.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = a.createBufferSource(); s.buffer = buf; const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 2;
    const g = a.createGain(); g.gain.value = gain; s.connect(f).connect(g).connect(a.destination); s.start(a.currentTime + delay);
  }
  const SFX = {
    lift: () => tone(620, 940, 0.09, 0.018, 'sine'),
    light: () => { tone(1500, 1300, 0.03, 0.025, 'square'); noise(0.03, 0.02, 3000); },
    hard: () => { tone(90, 70, 0.22, 0.06, 'square'); noise(0.18, 0.05, 400); },
    'false-echo': () => { tone(720, 690, 0.05, 0.05, 'triangle'); tone(520, 500, 0.07, 0.05, 'triangle', 0.08); noise(0.06, 0.03, 1200, 0.08); },
    'false-set': () => { noise(0.04, 0.06, 2400); tone(300, 210, 0.12, 0.05, 'triangle', 0.01); },
    set: () => { noise(0.03, 0.08, 3200); tone(240, 140, 0.14, 0.08, 'square', 0.005); },
    opened: () => { noise(0.05, 0.1, 2600); [392, 494, 587, 784].forEach((f, i) => tone(f, f, 0.32, 0.05, 'sine', 0.06 + i * 0.07)); },
    seized: () => { for (let i = 0; i < 4; i++) { noise(0.05, 0.06, 1400 - i * 250, i * 0.06); } tone(260, 60, 0.5, 0.06, 'sawtooth'); },
    relock: () => { tone(500, 180, 0.2, 0.04, 'triangle'); },
    dropped: () => { tone(420, 200, 0.12, 0.03, 'triangle'); },
    released: () => { tone(200, 120, 0.12, 0.03, 'sine'); noise(0.08, 0.015, 600); },
    blocked: () => { tone(110, 105, 0.12, 0.04, 'square'); },
    missed: () => { tone(800, 600, 0.05, 0.015, 'sine'); },
    generator: () => { for (let i = 0; i < 14; i++) tone(55 + (i % 2) * 6, 50, 0.09, 0.05, 'sawtooth', i * 0.08); },
    door: () => { tone(160, 90, 0.5, 0.05, 'sawtooth'); noise(0.3, 0.02, 500); },
  };
  const sfx = (name) => { try { SFX[name]?.(); } catch { /* audio blocked */ } };
  function setHum(level) {
    const a = level > 0 ? ctx() : ac;
    if (!a) return;
    if (!hum && level > 0) {
      const o = a.createOscillator(); const o2 = a.createOscillator(); const g = a.createGain();
      o.type = 'sine'; o2.type = 'triangle'; o.frequency.value = 96; o2.frequency.value = 193; g.gain.value = 0;
      o.connect(g); o2.connect(g); g.connect(a.destination); o.start(); o2.start(); hum = { o, o2, g };
    }
    if (!hum) return;
    const t = a.currentTime; const v = getMuted() ? 0 : level;
    hum.g.gain.setTargetAtTime(v * v * 0.05, t, 0.05);
    hum.o.frequency.setTargetAtTime(80 + v * 70, t, 0.05); hum.o2.frequency.setTargetAtTime(170 + v * 150, t, 0.05);
  }

  // ------------------------------------------------------------ helpers
  const nowS = () => performance.now() / 1000;
  const openedCount = () => MECHANISMS.filter((m) => (store.opened[m.id] ?? 0) > 0).length;
  const unlocked = (m) => { const i = MECHANISMS.indexOf(m); return i <= 0 || (store.opened[MECHANISMS[i - 1].id] ?? 0) > 0; };
  const tier = () => { const x = getXray() ?? {}; return xrayTier({ headset: Boolean(x.headset), device: Number(x.device) || 0, opened: openedCount() }); };
  const xray = () => (xrayOn ? tier() : 0);
  function toast(text, ok = true) {
    const el = $('[data-lk-toast]'); el.textContent = text; el.dataset.ok = String(ok); el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 5200);
  }
  function say(ev) {
    const line = onSay(ev);
    if (!line) return null;
    const el = $('[data-lk-say]'); el.querySelector('b').textContent = line.name ?? ''; el.querySelector('span').textContent = line.text ?? '';
    el.hidden = false; el.dataset.who = line.who ?? '';
    clearTimeout(sayTimer); sayTimer = setTimeout(() => { el.hidden = true; }, 3200 + String(line.text ?? '').length * 45);
    return line;
  }
  function reward(id) {
    const r = onReward(id) ?? { first: false };
    if (r.first) toast(`Впервые: +${r.pay} ₽ · +${r.xp} XP${r.skillGain ? ` · ветка ${r.reward?.skill === 'automation' ? 'AUTO' : 'SEC'} +${r.skillGain}` : ''}`);
    renderStat();
    return r;
  }
  function shake(amp, ms = 260) { if (reducedMotion) return; shakeAmp = amp; shakeUntil = performance.now() + ms; }

  // ------------------------------------------------------------ board
  function pick(m, { keepFresh = false } = {}) {
    if (!m || !unlocked(m)) { sfx('blocked'); return false; }
    mech = m;
    const n = store.opened[m.id] ?? 0;
    spec = n > 0 && !keepFresh ? variant(m, n * 7919 + m.tier * 31) : m;
    lock = createLock(spec); lifts = {}; event = 'waiting'; started = null; openedAt = null; held.clear();
    renderList(); renderHead(); render();
    return true;
  }
  function setP(v) {
    if (lock.phase === 'opened') return;
    if (started === null && v > 0) started = performance.now();
    lock = setPressure(lock, v);
  }
  function release() {
    if (lock.phase === 'opened') return;
    lock = releasePressure(lock); lifts = {}; event = 'released'; sfx('released'); render();
  }
  function lift(sector) {
    if (sector < 0 || sector >= lock.sectors || lock.phase === 'opened') return;
    const t = nowS();
    if (!store.timing) { lifts[sector] = t; return probe(sector, t); }
    const L = liftAt(lifts[sector], t);
    if (!L.done && lifts[sector] !== undefined) {
      if (L.window) return probe(sector, t);
      event = 'missed'; sfx('missed'); render(); return null;
    }
    lifts[sector] = t; sfx('lift'); render();
    return null;
  }
  function probe(sector, t = nowS()) {
    if (started === null) started = performance.now();
    const before = lock;
    const r = probeSector(lock, sector, t);
    lock = r.lock; event = r.event;
    delete lifts[sector];
    sfx(event);
    if (event === 'hard') { shake(5); }
    if (event === 'false-echo') { shake(8); say('locks-echo'); }
    if (event === 'false-set') { kick = 1; shake(3); say('locks-false-set'); }
    if (event === 'seized') { shake(12, 520); say('locks-seized'); }
    if (event === 'relock') { say('locks-relock'); }
    if (event === 'set') shake(2, 140);
    if (event === 'opened' && before.phase !== 'opened') win();
    render();
    return r;
  }
  function win() {
    openedAt = performance.now();
    const ms = Math.round(openedAt - (started ?? openedAt));
    const first = !(store.opened[mech.id] > 0);
    store.opened[mech.id] = (store.opened[mech.id] ?? 0) + 1;
    if (!store.best[mech.id] || ms < store.best[mech.id]) store.best[mech.id] = ms;
    let gotStab = false;
    if (mech.tier >= 3 && store.stock < STOCK_MAX) { store.stock += 1; gotStab = true; }
    save();
    onSound('reward');
    shake(4, 300);
    say('locks-open');
    const r = reward(mech.id);
    if (!r.first) toast(`${mech.brand} открыт за ${(ms / 1000).toFixed(1)} с${gotStab ? ' · +1 стабилизатор для шкафа' : ''}. Награда за устройство — один раз.`, true);
    else if (gotStab) setTimeout(() => toast('Саня: «Держи стабилизатор — пригодится у шкафа»'), 2600);
    locksBus.emit(LOCKS_OPEN, { kind: 'mechanism', id: mech.id, brand: mech.brand, first, ms, at: Date.now() });
    renderList(); renderStat();
  }

  function renderStat() {
    const n = openedCount(); const t = tier();
    $('[data-lk-stat]').innerHTML = `<span>УСТРОЙСТВА <b>${n}/${MECHANISMS.length}</b></span><span>РЕНТГЕН <b>${['НЕТ', 'КОНТУР', 'ГЛУБИНА'][t]}</b></span><span>СТАБИЛИЗАТОРЫ <b>${store.stock}</b></span><span><b>${Number(getWallet() || 0).toLocaleString('ru-RU')}</b> ₽</span>`;
  }
  function renderList() {
    $('[data-lk-list]').innerHTML = MECHANISMS.map((m, i) => {
      const open = unlocked(m); const n = store.opened[m.id] ?? 0; const best = store.best[m.id];
      return `<li><button type="button" data-lk-mech="${m.id}" data-on="${m.id === mech.id}" ${open ? '' : 'disabled'}>
        <i>${'◆'.repeat(m.tier)}${'◇'.repeat(6 - m.tier)}</i><b>${esc(m.brand)}</b><small>${open ? esc(m.title) : `откроется после ${esc(MECHANISMS[i - 1].brand)}`}</small>
        <em>${n ? `открыт ×${n}${best ? ` · ${(best / 1000).toFixed(1)} с` : ''}` : open ? 'новый' : '🔒'}</em></button></li>`;
    }).join('');
  }
  function renderHead() {
    $('[data-lk-brand]').textContent = `${mech.brand} · ${mech.title}`;
    $('[data-lk-idea]').textContent = mech.idea + ((store.opened[mech.id] ?? 0) > 0 ? ' (Перемешано: штифты и полосы другие.)' : '');
  }

  // The cutaway: housing, pins, springs, plug, bolt, wrench, tension bar.
  function drawSvg(t) {
    const N = lock.sectors; const x0 = 118; const w = 420; const step = w / N; const shear = 186;
    const xr = xray(); const band = bandAt(lock, t);
    const opened = lock.phase === 'opened';
    const openK = opened && openedAt ? Math.min(1, (performance.now() - openedAt) / 600) : opened ? 1 : 0;
    const p = shownP;
    let s = `<defs><linearGradient id="lkBrass" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#f1cf7a"/><stop offset="1" stop-color="#b8862f"/></linearGradient>
      <linearGradient id="lkSteel" x1="0" x2="1"><stop offset="0" stop-color="#8fa6aa"/><stop offset=".5" stop-color="#d7e2e0"/><stop offset="1" stop-color="#7d9396"/></linearGradient>
      <filter id="lkGlow"><feGaussianBlur stdDeviation="3"/></filter></defs>`;
    // housing
    s += `<rect x="96" y="40" width="466" height="226" rx="14" class="lk-housing"/>`;
    s += `<rect x="104" y="${shear}" width="450" height="66" rx="30" class="lk-plug" style="transform:translateY(${openK * 3}px)"/>`;
    if (xr >= 1) s += `<line x1="104" x2="554" y1="${shear}" y2="${shear}" class="lk-shear"/>`;
    const setSet = new Set(lock.setSectors);
    for (let i = 0; i < N; i++) {
      const cx = x0 + step * (i + 0.5); const pw = Math.min(30, step * 0.56);
      const L = liftAt(lifts[i], t); const isSet = setSet.has(i); const trick = lock.trickPending === i;
      let lift = isSet ? 1 : trick ? 0.8 : L.h; if (opened) lift = 1;
      const rise = lift * 34;
      const keyTop = shear + 6 - rise; const keyH = 40 + (i * 7) % 16;
      const drvBottom = keyTop - (isSet || opened ? 0 : 0); const drvH = 44;
      // chamber
      s += `<rect x="${cx - pw / 2 - 4}" y="56" width="${pw + 8}" height="${shear - 50}" class="lk-chamber"/>`;
      // spring (zigzag compresses as the pin rises)
      const sTop = 60; const sBot = drvBottom - drvH; const coils = 6; let d = `M${cx} ${sTop}`;
      for (let k = 1; k <= coils; k++) d += ` L${cx + (k % 2 ? pw / 2 - 3 : -pw / 2 + 3)} ${sTop + ((sBot - sTop) * k) / coils}`;
      s += `<path d="${d} L${cx} ${sBot}" class="lk-spring"/>`;
      // driver (steel) and key pin (brass)
      const glow = isSet && xr >= 1 ? ' data-set="1"' : '';
      s += `<rect x="${cx - pw / 2}" y="${drvBottom - drvH}" width="${pw}" height="${drvH}" rx="3" fill="url(#lkSteel)" class="lk-driver"${trick && xr >= 1 ? ' data-trick="1"' : ''}/>`;
      s += `<rect x="${cx - pw / 2}" y="${keyTop + (trick ? 6 : 0)}" width="${pw}" height="${keyH}" rx="${pw / 2 - 2}" fill="url(#lkBrass)" class="lk-key"${glow}/>`;
      if (isSet && xr >= 1) s += `<rect x="${cx - pw / 2 - 3}" y="${shear - 3}" width="${pw + 6}" height="6" rx="3" class="lk-setmark" filter="url(#lkGlow)"/>`;
      if (L.window && !isSet && store.timing) s += `<rect x="${cx - pw / 2 - 5}" y="${keyTop - 6}" width="${pw + 10}" height="4" rx="2" class="lk-window"/>`;
      s += `<g class="lk-pinbtn" data-lk-pin="${i}"><rect x="${cx - step / 2 + 3}" y="270" width="${step - 6}" height="30" rx="6"/><text x="${cx}" y="290">${i + 1}</text></g>`;
    }
    // bolt
    s += `<rect x="${556 - openK * 46}" y="${shear + 14}" width="74" height="30" rx="5" class="lk-bolt" data-open="${opened}"/>`;
    s += `<circle cx="600" cy="62" r="9" class="lk-lamp" data-state="${opened ? 'open' : lock.seized ? 'seized' : lock.falseEcho ? 'jam' : lock.phase === 'false-set' ? 'trick' : 'idle'}"/>`;
    // wrench: rotates with tension, kicks back on a false set
    const ang = -p * 0.16 + kick * 6;
    s += `<g class="lk-wrench" style="transform:rotate(${ang}deg);transform-origin:96px 236px"><path d="M30 228 H100 V244 H30 Z M30 228 V198 H44 V228 Z"/></g>`;
    // tension bar
    const bx = 104, bw = 450, by = 312;
    s += `<rect x="${bx}" y="${by}" width="${bw}" height="12" rx="6" class="lk-bar-bg"/>`;
    if (xr >= 2 && band && !opened) {
      s += `<rect x="${bx + (bw * band.min) / 100}" y="${by - 3}" width="${(bw * (band.max - band.min)) / 100}" height="18" rx="4" class="lk-band"/>`;
      if (band.trick && lock.trickPending !== null) s += `<rect x="${bx + (bw * Math.max(0, band.min - EASE_DEPTH)) / 100}" y="${by - 3}" width="${(bw * EASE_DEPTH) / 100}" height="18" rx="4" class="lk-band lk-band--ease"/>`;
    }
    s += `<rect x="${bx}" y="${by}" width="${(bw * p) / 100}" height="12" rx="6" class="lk-bar-fill"/>`;
    s += `<rect x="${bx + (bw * p) / 100 - 2}" y="${by - 6}" width="4" height="24" class="lk-bar-needle"/>`;
    // x-ray readouts
    if (xr >= 1) {
      const left = tempoLeft(lock, t);
      s += `<text x="110" y="30" class="lk-xr">РЕНТГЕН · ${xr === 2 ? 'ГЛУБИНА' : 'КОНТУР'} · ШТИФТ ${Math.min(lock.progress + 1, lock.pattern.length)}/${lock.pattern.length}</text>`;
      if (lock.strainLimit) s += `<text x="370" y="30" class="lk-xr" data-warn="${lock.strain >= lock.strainLimit - 1}">ПЕРЕГРУЗ ${lock.strain}/${lock.strainLimit}</text>`;
      if (left !== null) s += `<text x="480" y="30" class="lk-xr" data-warn="${left < 3}">ТЕМП ${left.toFixed(1)} С</text>`;
    } else {
      s += `<text x="110" y="30" class="lk-xr lk-xr--dim">РЕНТГЕН НЕДОСТУПЕН · ТОЛЬКО ЗВУК И ДРОЖЬ</text>`;
    }
    svg.innerHTML = s;
  }

  function render() {
    if (!active) return;
    const [title, text] = WORDS[event] ?? WORDS.waiting;
    $('[data-lk-event]').textContent = title; $('[data-lk-msg]').textContent = text;
    $('[data-lk-readout]').dataset.event = event; stage.dataset.event = event; stage.dataset.phase = lock.phase;
    pressureEl.value = String(lock.pressure); pvEl.textContent = String(lock.pressure).padStart(2, '0');
    const xb = $('[data-lk-xray]'); const t = tier();
    xb.disabled = t === 0; xb.textContent = t === 0 ? 'РЕНТГЕН · НЕТ' : `X · РЕНТГЕН ${xrayOn ? 'ВКЛ' : 'ВЫКЛ'}`; xb.setAttribute('aria-pressed', String(xrayOn && t > 0));
    const tb = $('[data-lk-timing]'); tb.textContent = `ТАЙМИНГ ${store.timing ? 'ВКЛ' : 'ВЫКЛ'}`; tb.setAttribute('aria-pressed', String(store.timing));
  }

  // ------------------------------------------------------------ cabinet
  function renderCabinet() {
    const v = $('[data-lk-view="cabinet"]');
    const open = cabResult?.status === 'opened' && !cabRun;
    const running = Boolean(cabRun);
    const k = running ? Math.min(1, (performance.now() - cabRun.at) / cabRun.ms) : open ? 1 : 0;
    v.innerHTML = `<div class="lk-cab" data-open="${open}" data-running="${running}">
      <div class="lk-cab__box"><div class="lk-cab__door"><i class="lk-cab__dial" data-lamp="${cab.lamp}" data-gen="${cab.generator}" data-sig="${cab.signal}" data-stab="${cab.stabilizer}"></i><span>ШКАФ САНИ</span></div>
        <div class="lk-cab__inside"><b>ВНУТРИ</b><p>Записка Сани: «Ты выбрал путь — значит, понял, что у каждого пути своя цена. Быстрый шумит, тихий долгий, подготовленный тратит запас».</p></div></div>
      <div class="lk-cab__side">
        <div class="lk-cab__state"><span data-on="${cab.lamp}">ЛАМПА</span><span data-on="${cab.generator}">ГЕНЕРАТОР</span><span data-on="${cab.signal}">СИГНАЛ</span><span data-on="${cab.stabilizer}">СТАБИЛИЗАТОР</span></div>
        <div class="lk-cab__tools">
          <button type="button" class="lk-btn" data-cab="lamp" ${running || open ? 'disabled' : ''}>ЛАМПА</button>
          <button type="button" class="lk-btn" data-cab="generator" ${running || open ? 'disabled' : ''}>ГЕНЕРАТОР</button>
          <button type="button" class="lk-btn" data-cab="signal" ${running || open ? 'disabled' : ''}>СНЯТЬ СИГНАЛ</button>
          <button type="button" class="lk-btn" data-cab="stabilizer" ${running || open ? 'disabled' : ''}>СТАБИЛИЗАТОР ×${store.stock}</button>
        </div>
        <button type="button" class="lk-btn lk-btn--go" data-cab-open ${running || open ? 'disabled' : ''}>ОТКРЫТЬ ШКАФ</button>
        <div class="lk-cab__run"><i style="width:${Math.round(k * 100)}%"></i></div>
        <p class="lk-cab__note" aria-live="polite">${esc(cabNote)}</p>
        <p class="lk-cab__routes">Пути: ${['lamp', 'signal', 'stabilizer'].map((r) => `<span data-done="${store.routes.includes(r)}">${ROUTE_NAMES[r]}</span>`).join(' ')}</p>
        <button type="button" class="lk-btn" data-cab-reset>ЗАКРЫТЬ И СБРОСИТЬ</button>
      </div></div>`;
  }
  function cabinetDo(action) {
    const r = cabinetAction(cab, action, { stock: store.stock });
    cab = r.state; cabNote = r.note;
    if (r.blocked) sfx('blocked'); else onSound('ui-click');
    if (r.noise) { sfx('generator'); say('locks-noise'); }
    renderCabinet();
  }
  function cabinetOpen() {
    const r = attemptOpen(cab);
    cabResult = r; cabNote = r.message;
    if (r.status !== 'opened') { sfx('blocked'); shake(4); renderCabinet(); return r; }
    if (r.spentStabilizer) { store.stock = Math.max(0, store.stock - 1); save(); }
    cabRun = { at: performance.now(), ms: reducedMotion ? 300 : r.time * 380, route: r.route };
    renderCabinet();
    return r;
  }
  function cabinetFinish() {
    const route = cabRun.route; cabRun = null;
    sfx('door'); onSound('reward');
    const first = !store.routes.includes(route);
    if (first) { store.routes.push(route); save(); }
    say('locks-cabinet');
    reward(`cabinet-${route}`);
    locksBus.emit(LOCKS_OPEN, { kind: 'cabinet', id: 'cabinet', route, first, noise: cabResult?.noise ?? 0, at: Date.now() });
    renderCabinet();
  }
  function cabinetReset() { cab = createCabinet(); cabResult = null; cabRun = null; cabNote = 'Шкаф закрыт. Шкала снова молчит.'; onSound('ui-click'); renderCabinet(); }

  // ------------------------------------------------------------ python
  function renderPython() {
    const v = $('[data-lk-view="python"]'); const task = lockTaskById(pyTask);
    const code = store.py[task.id] ?? task.starter; const done = Boolean(store.py[`${task.id}:ok`]);
    v.innerHTML = `<div class="lk-py">
      <div class="lk-py__tabs">${LOCK_PY_TASKS.map((t) => `<button type="button" class="lk-btn" data-py-task="${t.id}" aria-pressed="${t.id === pyTask}">${esc(t.title)}${store.py[`${t.id}:ok`] ? ' ✓' : ''}</button>`).join('')}</div>
      <p class="lk-py__brief">${esc(task.brief)}</p>
      <p class="lk-py__vars">Переменные: ${task.vars.map((n) => `<code>${n}</code>`).join(' ')} · только <code>if</code> / <code>elif</code> / <code>else</code>, <code>print</code>, сравнения, <code>and</code> / <code>or</code> / <code>not</code>.</p>
      <textarea spellcheck="false" data-py-code aria-label="Код на Python">${esc(code)}</textarea>
      <div class="lk-row"><button type="button" class="lk-btn lk-btn--go" data-py-run>ЗАПУСТИТЬ ПРОВЕРКУ · Ctrl+Enter</button><button type="button" class="lk-btn" data-py-reset>ВЕРНУТЬ ЗАГОТОВКУ</button>${done ? '<span class="lk-py__done">РЕШЕНО</span>' : ''}</div>
      <div class="lk-py__out" data-py-out aria-live="polite">${pyResult ? pyOut(pyResult) : ''}</div></div>`;
  }
  function pyOut(r) {
    if (r.ok) return `<b data-ok="true">ВСЕ ${r.total} СЛУЧАЕВ СОВПАЛИ С МЕХАНИЗМОМ.</b>`;
    return `<b data-ok="false">${r.passed}/${r.total} совпало.${r.error ? ` ${esc(r.error)}` : ''}</b><ul>${r.fails.slice(0, 4).map((f) => `<li><code>${esc(f.vars)}</code> → ждали <b>${esc(f.want)}</b>, получили <b>${esc(f.got)}</b></li>`).join('')}</ul>`;
  }
  function pyRun() {
    const ta = $('[data-py-code]'); const code = ta?.value ?? '';
    store.py[pyTask] = code; save();
    pyResult = checkLockTask(pyTask, code);
    if (pyResult.ok) {
      const first = !store.py[`${pyTask}:ok`]; store.py[`${pyTask}:ok`] = true; save();
      onSound('reward'); say('locks-python'); reward(pyTask);
      if (first) locksBus.emit(LOCKS_OPEN, { kind: 'python', id: pyTask, first, at: Date.now() });
    } else sfx('blocked');
    renderPython();
    return pyResult;
  }

  // ------------------------------------------------------------ cards
  function cardOpen(c) { return c.after === 'cabinet' ? store.routes.length > 0 : (store.opened[c.after] ?? 0) > 0; }
  function renderCards() {
    $('[data-lk-view="cards"]').innerHTML = `<div class="lk-cards">${LOCK_CARDS.map((c) => {
      const on = cardOpen(c); const after = c.after === 'cabinet' ? 'шкафа' : mechanismById(c.after)?.brand;
      return `<article class="lk-card" data-on="${on}"><small>${on ? 'КАРТОЧКА' : `ОТКРОЕТСЯ ПОСЛЕ ${esc(after)}`}</small><b>${esc(c.title)}</b><p>${on ? esc(c.text) : '…'}</p></article>`;
    }).join('')}</div><p class="lk-hint">Карточки — про то, как замки держат закрытым и как сильные конструкции защищают себя. Устройства доски выдуманы.</p>`;
  }

  function show(next) {
    tab = next;
    root.querySelectorAll('[data-lk-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.lkTab === tab)));
    root.querySelectorAll('[data-lk-view]').forEach((v) => { v.hidden = v.dataset.lkView !== tab; });
    if (tab === 'cabinet') renderCabinet();
    if (tab === 'python') renderPython();
    if (tab === 'cards') renderCards();
    if (tab !== 'board') setHum(0);
    root.dataset.tab = tab;
  }

  // ------------------------------------------------------------ loop
  function frame(ms) {
    if (!active) return;
    const t = ms / 1000; const dt = Math.min(0.05, lastT ? t - lastT : 0); lastT = t;
    if (tab === 'board') {
      const rate = held.has('ShiftLeft') || held.has('ShiftRight') ? 18 : 55;
      const up = held.has('KeyW') || held.has('ArrowUp'); const down = held.has('KeyS') || held.has('ArrowDown');
      if ((up || down) && lock.phase !== 'opened') { acc = Math.min(1.6, acc + dt); pAcc += (up ? 1 : -1) * rate * dt * acc; const whole = Math.trunc(pAcc); if (whole) { pAcc -= whole; setP(lock.pressure + whole); } }
      if (!up && !down) { acc = 0.6; pAcc = 0; }
      const r = tick(lock, nowS());
      if (r.event) { lock = r.lock; event = r.event; sfx('relock'); say('locks-relock'); render(); }
      shownP += (lock.pressure - shownP) * Math.min(1, dt * 14);
      kick *= Math.pow(0.02, dt);
      const f = feel(lock, nowS());
      setHum(f);
      // Feel: the tool trembles when it is near a working band; events shake.
      let sx = 0, sy = 0;
      if (!reducedMotion) {
        const tremble = f * f * 1.6;
        sx = (Math.random() - 0.5) * tremble; sy = (Math.random() - 0.5) * tremble;
        if (performance.now() < shakeUntil) { const k = (shakeUntil - performance.now()) / 300; sx += (Math.random() - 0.5) * shakeAmp * k; sy += (Math.random() - 0.5) * shakeAmp * 0.5 * k; }
      }
      svg.style.transform = `translate(${sx.toFixed(2)}px, ${sy.toFixed(2)}px)`;
      stage.style.setProperty('--feel', f.toFixed(3));
      pvEl.textContent = String(lock.pressure).padStart(2, '0'); pressureEl.value = String(lock.pressure);
      drawSvg(nowS());
    }
    if (tab === 'cabinet' && cabRun) {
      if (performance.now() - cabRun.at >= cabRun.ms) cabinetFinish();
      else { const bar = root.querySelector('.lk-cab__run i'); if (bar) bar.style.width = `${Math.round(((performance.now() - cabRun.at) / cabRun.ms) * 100)}%`; }
    }
    raf = requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------ input
  const BOARD_KEYS = ['KeyW', 'KeyS', 'ArrowUp', 'ArrowDown', 'ShiftLeft', 'ShiftRight'];
  function onKey(ev) {
    if (!active) return;
    const inText = ['INPUT', 'TEXTAREA', 'SELECT'].includes(ev.target?.tagName) && ev.target.type !== 'range';
    if (ev.code === 'Escape') { ev.preventDefault(); ev.stopImmediatePropagation(); close(); return; }
    ev.stopImmediatePropagation(); // the garage underneath must not walk or jump
    if (inText) {
      if (ev.code === 'Enter' && (ev.ctrlKey || ev.metaKey) && tab === 'python') { ev.preventDefault(); pyRun(); }
      return;
    }
    if (tab !== 'board') return;
    if (BOARD_KEYS.includes(ev.code)) { held.add(ev.code); ev.preventDefault(); return; }
    if (ev.repeat) return;
    const d = /^(Digit|Numpad)([1-8])$/.exec(ev.code);
    if (d) { ev.preventDefault(); lift(Number(d[2]) - 1); return; }
    if (ev.code === 'Space' || ev.code === 'KeyR') { ev.preventDefault(); release(); return; }
    if (ev.code === 'KeyX') { ev.preventDefault(); toggleXray(); return; }
    if (ev.code === 'KeyN') { ev.preventDefault(); next(); }
  }
  function onKeyUp(ev) { if (active) held.delete(ev.code); }
  function toggleXray() { if (tier() === 0) { sfx('blocked'); return; } xrayOn = !xrayOn; onSound('ui-click'); render(); }
  function next() { const i = MECHANISMS.indexOf(mech); const m = MECHANISMS[(i + 1) % MECHANISMS.length]; if (!pick(m)) toast(`«${m.brand}» откроется после «${mech.brand}».`, false); }

  root.addEventListener('click', (ev) => {
    const el = ev.target.closest?.('[data-lk-close],[data-lk-tab],[data-lk-mech],[data-lk-pin],[data-lk-release],[data-lk-xray],[data-lk-timing],[data-lk-next],[data-cab],[data-cab-open],[data-cab-reset],[data-py-task],[data-py-run],[data-py-reset]');
    if (!el) return;
    const ds = el.dataset;
    if ('lkClose' in ds) close();
    else if (ds.lkTab) { show(ds.lkTab); onSound('ui-click'); }
    else if (ds.lkMech) { pick(mechanismById(ds.lkMech)); onSound('ui-click'); }
    else if (ds.lkPin !== undefined) lift(Number(ds.lkPin));
    else if ('lkRelease' in ds) release();
    else if ('lkXray' in ds) toggleXray();
    else if ('lkTiming' in ds) { store.timing = !store.timing; save(); lifts = {}; render(); }
    else if ('lkNext' in ds) next();
    else if (ds.cab) cabinetDo(ds.cab);
    else if ('cabOpen' in ds) cabinetOpen();
    else if ('cabReset' in ds) cabinetReset();
    else if (ds.pyTask) { const ta = $('[data-py-code]'); if (ta) { store.py[pyTask] = ta.value; save(); } pyTask = ds.pyTask; pyResult = null; renderPython(); }
    else if ('pyRun' in ds) pyRun();
    else if ('pyReset' in ds) { delete store.py[pyTask]; save(); pyResult = null; renderPython(); }
  });
  pressureEl.addEventListener('input', () => setP(Number(pressureEl.value)));
  stage.addEventListener('wheel', (ev) => { if (!active || tab !== 'board') return; ev.preventDefault(); setP(lock.pressure + (ev.deltaY < 0 ? 2 : -2)); }, { passive: false });
  globalThis.addEventListener?.('keydown', onKey, true);
  globalThis.addEventListener?.('keyup', onKeyUp, true);

  function open(view = 'board') {
    store = loadStore(storage);
    active = true; root.hidden = false; held.clear();
    if (!unlocked(mech)) mech = MECHANISMS[0];
    pick(mech, { keepFresh: false });
    renderStat(); show(view === 'cabinet' ? 'cabinet' : view === 'python' ? 'python' : view === 'cards' ? 'cards' : 'board');
    lastT = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
    say(view === 'cabinet' ? 'locks-cabinet-look' : 'locks-board');
    onSound('ui-click');
    return true;
  }
  function close() {
    if (!active) return false;
    active = false; root.hidden = true; cancelAnimationFrame(raf); raf = 0; held.clear(); setHum(0);
    if (cabRun) cabinetFinish();
    onSound('whoosh');
    onClose();
    return true;
  }
  function state() {
    return {
      active, tab, mech: mech.id, lock: { pressure: lock.pressure, progress: lock.progress, setSectors: [...lock.setSectors], phase: lock.phase, falseEcho: lock.falseEcho, trickPending: lock.trickPending, strain: lock.strain, seized: lock.seized },
      event, xray: xray(), tier: tier(), store: JSON.parse(JSON.stringify(store)), cabinet: { ...cab, result: cabResult?.status ?? null, running: Boolean(cabRun) },
      spec: { pattern: spec.pattern.map((p) => ({ ...p })), drift: spec.drift ?? null },
      band: bandAt(lock, nowS()),
    };
  }
  // For tests/screenshots: drive the board without a keyboard.
  function debug(patch = {}) {
    if (patch.tab) show(patch.tab);
    if (patch.mech) pick(mechanismById(patch.mech), { keepFresh: Boolean(patch.fresh) });
    if (patch.pressure !== undefined) setP(patch.pressure);
    if (patch.probe !== undefined) probe(patch.probe);
    if (patch.release) release();
    if (patch.timing !== undefined) { store.timing = Boolean(patch.timing); save(); }
    if (patch.lift !== undefined) lifts[patch.lift] = nowS() - (patch.liftAt ?? 0);
    if (patch.cab) cabinetDo(patch.cab);
    if (patch.cabOpen) cabinetOpen();
    if (patch.stock !== undefined) { store.stock = patch.stock; save(); }
    if (patch.pyCode !== undefined) { const ta = $('[data-py-code]'); if (ta) ta.value = patch.pyCode; }
    if (patch.pyTask) { pyTask = patch.pyTask; renderPython(); }
    if (patch.pyRun) pyRun();
    render();
    return state();
  }
  return {
    open, close, state, debug,
    get active() { return active; }, get root() { return root; },
    get cabinetOpen() { return cabResult?.status === 'opened' && !cabRun; },
  };
}
