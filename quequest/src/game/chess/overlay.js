// ЛЁД-64 · the night assault screen. Its own element and stylesheet (like the locks overlay), the board is
// drawn on our own canvas (Lichess's chessground is GPL — not used). One screen, no scroll.
//
// Touch your guard → its light paths show where it can go. Touch a lit square → it goes, then red does
// what its arrow said. Red zones are where red shoots. «⟲ ХОД НАЗАД» is free. A hint arrow shows after
// 20 s without a move or after two lost tries; it never moves for you.
import { drawPlate, drawGlyph } from './glyphs.js';
import { SIZE, KINDS, rawMoves, legalMoves, attacked, coreUnderFire, unitAt, unitById, clone, parMoves, key } from './rules.js';
import { LEVELS, REVEAL_LINE, startLevel, step, solve } from './levels.js';
import { BUGGY_JUMPS_CODE, parseJumps, jumpsReport } from './python-jumps.js';
import { NARYADY, startNaryad, unitsOf, litFor, tryMove, hintOf } from './naryad.js';

const CSS_HREF = new URL('./overlay.css?v=ice8', import.meta.url).href;
export const ICE64_KEY = 'quequest.ice64.v1';
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LOST = { 'lost:core': 'Ядро взяли. Ночь проиграна', 'lost:unit': 'Сторожа сняли. Ход назад бесплатный', 'lost:breach': 'Скрипт прошёл до низа и ушёл в сеть', 'lost:time': 'Утро. Волна не стёрта', 'lost:stuck': 'Сторожам некуда идти' };
const COL = { bg: '#071019', cell: '#0c1a26', cell2: '#0f2130', grid: '#1d3a4f', wall: '#24303a', wallHatch: '#3b4b58', blue: '#5fd2ff', blueD: '#1b6f96', red: '#ff5a52', redD: '#8e2420', redZone: 'rgba(255,90,82,0.16)', lit: 'rgba(95,210,255,0.28)', litTake: '#ffb347', packet: '#69f0c8', big: '#ffc857', text: '#e8f4ff', dim: '#86a3b8' };

function load() { try { return JSON.parse(localStorage.getItem(ICE64_KEY) ?? '{}') || {}; } catch { return {}; } }
function save(v) { try { localStorage.setItem(ICE64_KEY, JSON.stringify(v)); } catch { /* the night still plays */ } }
// The professions screen: one row per level, done / active / locked (read from this browser's store).
export function ice64Quests() {
  const st = load(); let open = true;
  return LEVELS.map((l, i) => { const done = Boolean(st.done?.[l.id]); const status = done ? 'done' : open ? 'active' : 'locked'; if (!done) open = false; return { id: `ice64:${l.id}`, title: `${i + 1} · ${l.title}`, story: l.goal, status }; });
}
function track(event, data) { try { if (typeof globalThis.umami?.track === 'function') globalThis.umami.track(event, data); } catch { /* never break the night */ } }

export function createIce64(host = globalThis.document?.body, { onSound = () => {}, onClose = () => {}, onWin = () => {} } = {}) {
  const doc = host.ownerDocument ?? host;
  if (!doc.querySelector('link[data-ice64-css]')) { const l = doc.createElement('link'); l.rel = 'stylesheet'; l.href = CSS_HREF; l.dataset.ice64Css = ''; doc.head.append(l); }
  const root = doc.createElement('section');
  root.id = 'ice64'; root.className = 'ice'; root.hidden = true; root.setAttribute('aria-label', 'ЛЁД-64 — ночной штурм');
  root.innerHTML = `<header class="ice__top"><div><small id="iceKicker">ЛЁД-64 · НОЧНОЙ ШТУРМ</small><h2 id="iceTitle">Сторож</h2></div>
      <div class="ice__stats"><span id="iceMoney">0 ₽</span><span id="iceMoves">ходов 0</span></div>
      <button type="button" class="ice__close" id="iceClose" aria-label="Выйти">×</button></header>
    <div class="ice__body"><div class="ice__boardWrap"><canvas id="iceBoard" width="640" height="640" aria-label="Поле сети: 8 на 8 клеток"></canvas><p class="ice__alarm" id="iceAlarm" hidden>ЯДРО ПОД УДАРОМ</p></div>
      <aside class="ice__side">
        <ol class="ice__levels" id="iceLevels"></ol>
        <ul class="ice__legend" id="iceLegend" aria-label="Кто на поле"></ul>
        <p class="ice__goal" id="iceGoal"></p>
        <p class="ice__vitya"><b>Витя</b><span id="iceVitya"></span></p>
        <div class="ice__code" id="iceCodeBox" hidden><label for="iceCode">PYTHON · разведчик Вити</label><textarea id="iceCode" rows="4" spellcheck="false" autocomplete="off" autocapitalize="off"></textarea><div class="ice__codeRow"><button type="button" id="iceRun">▶ ЗАПУСТИТЬ КОД</button><span id="iceCodeReport" role="status"></span></div></div>
        <p class="ice__verdict" id="iceVerdict" role="status"></p>
        <div class="ice__buttons"><button type="button" id="iceUndo">⟲ ХОД НАЗАД</button><button type="button" id="iceRestart">↻ ЗАНОВО</button><button type="button" id="iceNext" hidden>ДАЛЬШЕ →</button></div>
      </aside></div>`;
  host.append(root);
  const $ = (id) => root.querySelector(`#${id}`);
  const canvas = $('iceBoard'), ctx = canvas.getContext('2d');
  let store = load();
  let pz = null, pzSel = null, pzSolved = 0, pzMisses = 0; // «Наряд»: the current puzzle, the picked square, solved this run
  let codeJumps = null; // the player's list for a code level (null = Витя's crooked one)
  let level = LEVELS[0], s = null, history = [], selected = null, fails = 0, idleAt = 0, hint = null, fx = [], raf = 0, closeArmed = false;
  const named = () => Boolean(store.revealed);

  function setLevel(l) {
    level = l; s = startLevel(l, { jumps: codeJumps ?? undefined }); history = []; selected = null; fails = 0; hint = null; fx = []; idleAt = performance.now();
    $('iceTitle').textContent = l.title; $('iceGoal').textContent = l.goal; $('iceVitya').textContent = l.vitya;
    $('iceVerdict').textContent = ''; $('iceVerdict').dataset.state = ''; $('iceNext').hidden = true; closeArmed = false; $('iceClose').textContent = '×';
    pz = null; pzSel = null; pzSolved = 0; pzMisses = 0;
    if (l.puzzles) nextPuzzle(true);
    const box = $('iceCodeBox'); box.hidden = !l.code; root.dataset.code = String(Boolean(l.code)); root.dataset.puzzle = String(Boolean(l.puzzles));
    if (l.code && !$('iceCode').value) $('iceCode').value = store.code ?? BUGGY_JUMPS_CODE;
    if (l.code) $('iceCodeReport').textContent = jumpsReport(parseJumps($('iceCode').value));
    renderLevels(); sync();
    track('ice64-level-start', { level: LEVELS.indexOf(l) + 1 });
  }
  function renderLevels() {
    $('iceLevels').innerHTML = LEVELS.map((l, i) => {
      const st = store.done?.[l.id]; const cur = l.id === level.id;
      return `<li><button type="button" data-ice-level="${l.id}" aria-current="${cur}" data-done="${Boolean(st)}" title="${esc(l.title)}">${st ? '★'.repeat(st) : i + 1}</button></li>`;
    }).join('');
    for (const b of root.querySelectorAll('[data-ice-level]')) b.addEventListener('click', () => { const l = LEVELS.find((x) => x.id === b.dataset.iceLevel); if (l && (store.done?.[l.id] || LEVELS.indexOf(l) <= unlockedUpTo())) { onSound('ui-click'); setLevel(l); } });
  }
  const unlockedUpTo = () => { let i = 0; while (i < LEVELS.length - 1 && store.done?.[LEVELS[i].id]) i++; return i; };
  function sync() {
    $('iceMoney').textContent = `${s.money} ₽`;
    const par = level.objective === 'collect' && !level.units.some((u) => u.side === 'red') ? parMoves(level) : null;
    $('iceMoves').textContent = level.puzzles ? `задача ${Math.min(pzSolved + 1, level.puzzles)} из ${level.puzzles}` : par ? `ходов ${s.moves} · лучший ${par}` : `ходов ${s.moves}`;
    $('iceAlarm').hidden = !(coreUnderFire(s) && !s.over);
    $('iceUndo').disabled = !history.length;
    renderLegend();
    draw();
  }
  function stars() {
    if (level.puzzles) return pzMisses === 0 ? 3 : pzMisses < 3 ? 2 : 1;
    const par = parMoves(level);
    if (par == null || level.units.some((u) => u.side === 'red')) return s.lost.length ? 2 : 3;
    return s.moves <= par ? 3 : s.moves <= par + 2 ? 2 : 1;
  }
  function finish() {
    if (s.over === 'won') {
      s.money += level.reward ?? 0;
      const st = stars();
      store = { ...store, done: { ...(store.done ?? {}), [level.id]: Math.max(st, store.done?.[level.id] ?? 0) } };
      let line = `✓ УДЕРЖАНО · +${s.money} ₽ · ${'★'.repeat(st)}${'☆'.repeat(3 - st)}`;
      if (level.reveal && !store.revealed) { store.revealed = true; $('iceVitya').textContent = REVEAL_LINE; line += ' · над сторожами теперь их настоящие имена'; onSound('reflex-pattern'); }
      else onSound('power');
      save(store);
      $('iceVerdict').textContent = line; $('iceVerdict').dataset.state = 'won';
      const i = LEVELS.indexOf(level); $('iceNext').hidden = i >= LEVELS.length - 1;
      track('ice64-level-win', { level: i + 1, stars: st });
      try { onWin({ id: level.id, n: i + 1, money: s.money, stars: st }); } catch { /* the board still says it */ }
      renderLevels();
    } else if (s.over) {
      fails++; onSound('alarm');
      $('iceVerdict').textContent = `✗ ${(s.over === 'lost:time' && level.timeLine) || LOST[s.over] || 'Не удержали'}`; $('iceVerdict').dataset.state = 'lost';
    }
    sync();
  }

  // ---------------------------------------------------------------- input
  function squareAt(ev) {
    const r = canvas.getBoundingClientRect(); const c = r.width / SIZE;
    const x = Math.floor((ev.clientX - r.left) / c), y = SIZE - 1 - Math.floor((ev.clientY - r.top) / c);
    return x >= 0 && y >= 0 && x < SIZE && y < SIZE ? { x, y } : null;
  }
  canvas.addEventListener('click', (ev) => {
    if (level.puzzles) { puzzleClick(squareAt(ev)); return; }
    if (!s || s.over) return;
    const q = squareAt(ev); if (!q) return;
    const u = unitAt(s, q.x, q.y);
    if (selected) {
      const m = legalMoves(s, unitById(s, selected)).find((mm) => mm.x === q.x && mm.y === q.y);
      if (m) {
        history.push(clone(s)); const from = { ...unitById(s, selected) };
        const r = step(level, s, selected, q.x, q.y);
        selected = null; hint = null; idleAt = performance.now();
        for (const e of r.events) {
          if (e.type === 'take') { burst(e.x, e.y, (unitById(s, e.id)?.side ?? 'blue') === 'blue' ? COL.blue : COL.red); onSound('impact'); }
          if (e.type === 'packet') { float(e.x, e.y, `+${e.v} ₽`, e.big ? COL.big : COL.packet); onSound('cash'); }
        }
        if (!r.events.some((e) => e.type === 'take' || e.type === 'packet')) onSound('step');
        void from;
        if (s.over) finish(); else { if (coreUnderFire(s)) onSound('alarm'); sync(); }
        return;
      }
    }
    if (u && u.side === 'blue') { selected = u.id === selected ? null : u.id; onSound('ui-click'); sync(); return; }
    selected = null; sync();
  });
  // ---------------------------------------------------------------- «Наряд»
  function nextPuzzle(first = false) {
    const i = (store.pzNext ?? 0) % NARYADY.length;
    pz = startNaryad(NARYADY[i]); pzSel = null; hint = null; fails = 0; idleAt = performance.now();
    if (!first) { $('iceVerdict').textContent = ''; $('iceVerdict').dataset.state = ''; }
  }
  function puzzleClick(q) {
    if (!q || !pz || pz.done || s.over) return;
    const mine = unitsOf(pz).find((u) => u.x === q.x && u.y === q.y && u.side === 'blue');
    if (pzSel && litFor(pz, pzSel.x, pzSel.y).some((m) => m.x === q.x && m.y === q.y)) {
      const took = unitsOf(pz).some((u) => u.x === q.x && u.y === q.y && u.side === 'red');
      const r = tryMove(pz, pzSel, q); pzSel = null; idleAt = performance.now();
      if (!r.ok) { fails++; pzMisses++; hint = null; onSound('blocked'); $('iceVerdict').textContent = '✗ Не тот ход. Что сейчас бьёт и что стоит без защиты?'; $('iceVerdict').dataset.state = 'lost'; sync(); return; }
      if (took) { burst(q.x, q.y, COL.red); onSound('impact'); } else onSound('step');
      if (r.done) {
        pzSolved++; s.money += level.perPuzzle ?? 0; float(q.x, q.y, `+${level.perPuzzle ?? 0} ₽`, COL.packet);
        store = { ...store, pzNext: (store.pzNext ?? 0) + 1 }; save(store);
        track('ice64-puzzle-solved', { theme: pz.z.theme, fails });
        if (pzSolved >= level.puzzles) { s.over = 'won'; finish(); return; }
        $('iceVerdict').textContent = r.mate ? '✓ Мат. Ядро взломщика взято' : '✓ Верно. Висящая фигура снята'; $('iceVerdict').dataset.state = 'won'; onSound('cash');
        sync(); setTimeout(() => { if (level.puzzles && !s.over) { nextPuzzle(); sync(); } }, 900);
        return;
      }
      sync(); return;
    }
    pzSel = mine ? (pzSel && pzSel.x === q.x && pzSel.y === q.y ? null : { x: q.x, y: q.y }) : null;
    if (mine) onSound('ui-click');
    sync();
  }
  function drawPuzzle(c) {
    // the last red move: the only red arrow on the board
    const lf = pz.me === 'w' ? pz.last.from : { x: 7 - pz.last.from.x, y: 7 - pz.last.from.y };
    const lt = pz.me === 'w' ? pz.last.to : { x: 7 - pz.last.to.x, y: 7 - pz.last.to.y };
    for (const q of [lf, lt]) { const [px, py] = cellXY(q.x, q.y, c); ctx.fillStyle = 'rgba(255,90,82,0.18)'; ctx.fillRect(px, py, c, c); }
    if (pzSel) {
      const [ux, uy] = cellXY(pzSel.x, pzSel.y, c); ctx.strokeStyle = COL.blue; ctx.lineWidth = c * 0.06; ctx.strokeRect(ux + 3, uy + 3, c - 6, c - 6);
      for (const m of litFor(pz, pzSel.x, pzSel.y)) { const [px, py] = cellXY(m.x, m.y, c); ctx.fillStyle = m.take ? 'rgba(255,179,71,0.35)' : COL.lit; ctx.fillRect(px + 2, py + 2, c - 4, c - 4); }
    }
    arrow(lf.x, lf.y, lt.x, lt.y, c, COL.red);
    if (hint) arrow(hint.fx, hint.fy, hint.x, hint.y, c, COL.big, true);
    for (const u of unitsOf(pz)) drawUnit(u, c);
    if (!hint && !pz.done && (performance.now() - idleAt > 20000 || fails >= 2)) { const h = hintOf(pz); if (h) { hint = { fx: h.from.x, fy: h.from.y, x: h.to.x, y: h.to.y }; track('ice64-hint', { level: LEVELS.indexOf(level) + 1 }); } }
  }
  // The player's code runs the scout: parse, and the level restarts with exactly that list (lit squares follow).
  $('iceRun').addEventListener('click', () => {
    const r = parseJumps($('iceCode').value);
    $('iceCodeReport').textContent = jumpsReport(r);
    $('iceCodeReport').dataset.state = r.ok && !r.notL.length && !r.missing.length ? 'ok' : 'bad';
    if (!r.ok) { onSound('blocked'); return; }
    codeJumps = r.jumps; store = { ...store, code: $('iceCode').value }; save(store);
    onSound('boot'); track('ice64-code-run', { level: LEVELS.indexOf(level) + 1, ok: !r.notL.length && !r.missing.length });
    setLevel(level);
  });
  $('iceUndo').addEventListener('click', () => { if (!history.length) return; s = history.pop(); s.over = null; selected = null; $('iceVerdict').textContent = ''; $('iceVerdict').dataset.state = ''; $('iceNext').hidden = true; onSound('ui-click'); sync(); });
  $('iceRestart').addEventListener('click', () => { onSound('ui-click'); setLevel(level); });
  $('iceNext').addEventListener('click', () => { const i = LEVELS.indexOf(level); if (i < LEVELS.length - 1) { onSound('ui-click'); setLevel(LEVELS[i + 1]); } });
  // Leaving mid-level asks first (rule 29а): the first press says the price, the second leaves.
  $('iceClose').addEventListener('click', () => {
    const started = s && s.moves > 0 && !s.over;
    if (started && !closeArmed) { closeArmed = true; $('iceClose').textContent = 'ТОЧНО? НОЧЬ ПРОПАДЁТ'; return; }
    close();
  });
  root.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); $('iceClose').click(); } });

  // ---------------------------------------------------------------- juice
  function burst(x, y, color) { for (let i = 0; i < 14; i++) fx.push({ kind: 'shard', x: x + 0.5, y: y + 0.5, vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.2) * 3, t: 0, color }); }
  function float(x, y, text, color) { fx.push({ kind: 'text', x: x + 0.5, y: y + 0.5, t: 0, text, color }); }

  // ---------------------------------------------------------------- draw
  function fit() {
    const r = canvas.getBoundingClientRect(); const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    const w = Math.max(160, Math.round(r.width * dpr));
    if (canvas.width !== w) { canvas.width = w; canvas.height = w; }
  }
  function cellXY(x, y, c) { return [x * c, (SIZE - 1 - y) * c]; }
  function draw() {
    if (!s) return;
    fit();
    const W = canvas.width, c = W / SIZE, now = performance.now();
    ctx.fillStyle = COL.bg; ctx.fillRect(0, 0, W, W);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) { const [px, py] = cellXY(x, y, c); ctx.fillStyle = (x + y) % 2 ? COL.cell : COL.cell2; ctx.fillRect(px, py, c, c); }
    if (pz) { ctx.strokeStyle = COL.grid; ctx.lineWidth = Math.max(1, c * 0.02); for (let i = 0; i <= SIZE; i++) { ctx.beginPath(); ctx.moveTo(i * c, 0); ctx.lineTo(i * c, W); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i * c); ctx.lineTo(W, i * c); ctx.stroke(); } drawPuzzle(c); drawFx(c); return; }
    // red zone: where red shoots
    for (const k of attacked(s, 'red')) { const [x, y] = k.split(',').map(Number); const [px, py] = cellXY(x, y, c); ctx.fillStyle = COL.redZone; ctx.fillRect(px, py, c, c); }
    ctx.strokeStyle = COL.grid; ctx.lineWidth = Math.max(1, c * 0.02);
    for (let i = 0; i <= SIZE; i++) { ctx.beginPath(); ctx.moveTo(i * c, 0); ctx.lineTo(i * c, W); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i * c); ctx.lineTo(W, i * c); ctx.stroke(); }
    // walls: firewalls
    for (const k of s.walls) { const [x, y] = k.split(',').map(Number); const [px, py] = cellXY(x, y, c); ctx.fillStyle = COL.wall; ctx.fillRect(px + 2, py + 2, c - 4, c - 4); ctx.strokeStyle = COL.wallHatch; ctx.lineWidth = c * 0.05; for (let i = -1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(px + i * c * 0.4, py + c); ctx.lineTo(px + i * c * 0.4 + c * 0.6, py); ctx.save(); ctx.rect(px + 2, py + 2, c - 4, c - 4); ctx.clip(); ctx.stroke(); ctx.restore(); } }
    // packets
    for (const p of s.packets) { const [px, py] = cellXY(p.x, p.y, c); const pulse = 0.85 + 0.15 * Math.sin(now / 260 + p.x); const r = c * (p.big ? 0.24 : 0.18) * pulse; ctx.fillStyle = p.big ? COL.big : COL.packet; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = c * 0.3; ctx.beginPath(); ctx.moveTo(px + c / 2, py + c / 2 - r); ctx.lineTo(px + c / 2 + r, py + c / 2); ctx.lineTo(px + c / 2, py + c / 2 + r); ctx.lineTo(px + c / 2 - r, py + c / 2); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0; ctx.fillStyle = COL.text; ctx.font = `700 ${Math.round(c * 0.17)}px ui-monospace,monospace`; ctx.textAlign = 'center'; ctx.fillText(`${p.v}`, px + c / 2, py + c * 0.93); }
    // lit squares of the selected guard
    if (selected) {
      const u = unitById(s, selected);
      if (u) { const [ux, uy] = cellXY(u.x, u.y, c); ctx.strokeStyle = COL.blue; ctx.lineWidth = c * 0.06; ctx.strokeRect(ux + 3, uy + 3, c - 6, c - 6); }
      for (const m of legalMoves(s, u)) { const [px, py] = cellXY(m.x, m.y, c); ctx.fillStyle = m.take ? 'rgba(255,179,71,0.35)' : COL.lit; ctx.fillRect(px + 2, py + 2, c - 4, c - 4); if (m.take) { ctx.strokeStyle = COL.litTake; ctx.lineWidth = c * 0.05; ctx.strokeRect(px + 4, py + 4, c - 8, c - 8); } }
    }
    // a code level: every jump the player's code gives the scout, as dots — a jump that is not an «Г» is a red cross
    if (level.code === 'jumps') {
      const u = unitById(s, level.codeUnit);
      if (u) for (const [dx, dy] of u.jumps ?? []) {
        const x = u.x + dx, y = u.y + dy; if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) continue;
        const [px, py] = cellXY(x, y, c); const good = (Math.abs(dx) === 1 && Math.abs(dy) === 2) || (Math.abs(dx) === 2 && Math.abs(dy) === 1);
        if (good) { ctx.fillStyle = 'rgba(95,210,255,0.85)'; ctx.beginPath(); ctx.arc(px + c / 2, py + c / 2, c * 0.1, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.strokeStyle = '#ff5a52'; ctx.lineWidth = c * 0.07; ctx.beginPath(); ctx.moveTo(px + c * 0.32, py + c * 0.32); ctx.lineTo(px + c * 0.68, py + c * 0.68); ctx.moveTo(px + c * 0.68, py + c * 0.32); ctx.lineTo(px + c * 0.32, py + c * 0.68); ctx.stroke(); }
      }
    }
    // red arrows under the units: the next move of every red program (the units and their names stay readable)
    for (const [id, p] of Object.entries(s.plans)) { const u = unitById(s, id); if (u && !u.still) arrow(u.x, u.y, p.x, p.y, c, COL.red); }
    if (hint) arrow(hint.fx, hint.fy, hint.x, hint.y, c, COL.big, true);
    // units
    for (const u of s.units) drawUnit(u, c);
    drawFx(c);
    // the hint: after 20 s without a move or two lost tries, never a move for the player
    if (!hint && !s.over && (now - idleAt > 20000 || fails >= 2)) {
      const line = solve(level, 8, level.code === 'jumps' ? { jumps: codeJumps ?? undefined } : {}); const first = line?.[0];
      if (first) { const u = unitById(s, first[0]); if (u) { hint = { fx: u.x, fy: u.y, x: first[1], y: first[2] }; track('ice64-hint', { level: LEVELS.indexOf(level) + 1 }); } }
    }
  }
  function drawFx(c) {
    fx = fx.filter((f) => f.t < 1);
    for (const f of fx) {
      f.t += 0.025;
      const [px, py] = cellXY(f.x - 0.5, f.y - 0.5, c);
      if (f.kind === 'shard') { f.x += f.vx * 0.02; f.y += f.vy * 0.02; f.vy -= 0.08; ctx.fillStyle = f.color; ctx.globalAlpha = 1 - f.t; ctx.fillRect(px + c / 2, py + c / 2, c * 0.09, c * 0.09); ctx.globalAlpha = 1; }
      else { ctx.globalAlpha = 1 - f.t; ctx.fillStyle = f.color; ctx.font = `800 ${Math.round(c * 0.3)}px ui-monospace,monospace`; ctx.textAlign = 'center'; ctx.fillText(f.text, px + c / 2, py + c / 2 - f.t * c * 0.8); ctx.globalAlpha = 1; }
    }
  }
  function arrow(x0, y0, x1, y1, c, color, dashed = false) {
    const [ax, ay] = cellXY(x0, y0, c), [bx, by] = cellXY(x1, y1, c);
    const sx = ax + c / 2, sy = ay + c / 2, ex = bx + c / 2, ey = by + c / 2; const a = Math.atan2(ey - sy, ex - sx);
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = c * 0.07; ctx.setLineDash(dashed ? [c * 0.12, c * 0.1] : []);
    ctx.beginPath(); ctx.moveTo(sx + Math.cos(a) * c * 0.3, sy + Math.sin(a) * c * 0.3); ctx.lineTo(ex - Math.cos(a) * c * 0.22, ey - Math.sin(a) * c * 0.22); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex - Math.cos(a - 0.5) * c * 0.28, ey - Math.sin(a - 0.5) * c * 0.28); ctx.lineTo(ex - Math.cos(a + 0.5) * c * 0.28, ey - Math.sin(a + 0.5) * c * 0.28); ctx.closePath(); ctx.fill();
  }
  function drawUnit(u, c) {
    // the badge draws the move (glyphs.js); names live in the legend under the board (≥14 px)
    const [px, py] = cellXY(u.x, u.y, c); const blue = u.side === 'blue';
    const main = blue ? COL.blue : COL.red, dark = blue ? COL.blueD : COL.redD;
    if (u.kind === 'core') { const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 300); ctx.shadowColor = main; ctx.shadowBlur = c * 0.25 * pulse; }
    drawPlate(ctx, px + c / 2, py + c / 2, c * 0.78, { fill: dark, stroke: main });
    ctx.shadowBlur = 0;
    drawGlyph(ctx, KINDS[u.kind].chess, px + c / 2, py + c / 2, c * 0.78, blue ? '#e8f8ff' : '#ffe1de', blue ? 1 : -1);
  }
  // The legend: the units of this level, badge + name (their TD name, the chess name after the reveal).
  function renderLegend() {
    const seen = new Map();
    for (const u of (pz ? unitsOf(pz) : s.units)) { const k = `${u.side}:${u.kind}`; if (!seen.has(k)) seen.set(k, u); }
    const items = [...seen.values()].sort((a, b) => (a.side === b.side ? 0 : a.side === 'blue' ? -1 : 1));
    const box = $('iceLegend'); box.innerHTML = '';
    for (const u of items) {
      const li = doc.createElement('li'); li.dataset.side = u.side; li.dataset.kind = u.kind; li.dataset.selected = String(Boolean(selected && unitById(s, selected)?.kind === u.kind && u.side === 'blue'));
      const cv = doc.createElement('canvas'); const dpr = Math.min(2, globalThis.devicePixelRatio || 1); cv.width = cv.height = Math.round(30 * dpr); cv.style.width = cv.style.height = '30px';
      const g = cv.getContext('2d'); drawPlate(g, cv.width / 2, cv.height / 2, cv.width * 0.92, { fill: u.side === 'blue' ? COL.blueD : COL.redD, stroke: u.side === 'blue' ? COL.blue : COL.red });
      drawGlyph(g, KINDS[u.kind].chess, cv.width / 2, cv.height / 2, cv.width * 0.92, u.side === 'blue' ? '#e8f8ff' : '#ffe1de', u.side === 'blue' ? 1 : -1);
      const name = doc.createElement('span'); name.textContent = named() ? KINDS[u.kind].chessName : u.side === 'blue' ? KINDS[u.kind].name : KINDS[u.kind].redName;
      li.append(cv, name); box.append(li);
    }
  }
  function loop() { draw(); raf = root.hidden ? 0 : requestAnimationFrame(loop); }

  function open(id) {
    store = load();
    root.hidden = false;
    const l = LEVELS.find((x) => x.id === id) ?? LEVELS[Math.min(unlockedUpTo(), LEVELS.length - 1)];
    setLevel(l);
    if (!raf) raf = requestAnimationFrame(loop);
    root.tabIndex = -1; root.focus?.({ preventScroll: true });
  }
  function close() { root.hidden = true; if (raf) cancelAnimationFrame(raf); raf = 0; try { onClose(); } catch { /* fine */ } }
  return {
    open, close, isOpen: () => !root.hidden,
    // tests and the admin page: the state, and a move as if the player had tapped (same path as a tap)
    puzzle: () => (pz ? { id: pz.z.id, theme: pz.z.theme, me: pz.me, solved: pzSolved, answer: pz.z.moves[pz.step] ?? null, units: unitsOf(pz), lit: pzSel ? litFor(pz, pzSel.x, pzSel.y).map((m) => [m.x, m.y]) : [] } : null),
    state: () => ({ level: level.id, over: s?.over ?? null, moves: s?.moves ?? 0, money: s?.money ?? 0, revealed: named(), coreUnderFire: s ? coreUnderFire(s) : false, units: s?.units.map((u) => ({ ...u })) ?? [], plans: { ...(s?.plans ?? {}) }, lit: selected ? legalMoves(s, unitById(s, selected)).map((m) => [m.x, m.y]) : [], hint }),
    squareCenter: (x, y) => { const r = canvas.getBoundingClientRect(); const c = r.width / SIZE; return { x: r.left + (x + 0.5) * c, y: r.top + (SIZE - 1 - y + 0.5) * c }; },
    solution: () => solve(level, 12),
    reset: () => { store = {}; save(store); },
    key,
  };
}
