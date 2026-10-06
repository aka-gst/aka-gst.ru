// 17.1 → 19.0 · ГАРАЖ · СТОРОЖ МАШИНЫ — the playable stage inside the hacker
// profession (canon §18: revenge on «ТИСКИ»). Each night is one quest about
// one named person (career-story.js): Витя's car, Дина's radio, Санин lock.
// The player reads what flies into the car, writes the watchman's rule in
// Python with everyday variable names (откуда, что, ключ), and runs the night:
// the scene (garage-scene.js) shows every command hit the rule, blocked ones
// shatter, a leaked one opens the car with an alarm; then «ТИСКИ» try their
// spare tricks the rule has never seen. Night 3 starts the other way round:
// open the car with the corporation's own master key first, then patch.
// The verdict is simGarage's -- the same function the scene draws.
//
// Layout (career-worlds.css): one screen without page scroll at 1280×800;
// on a phone the right column becomes three tabs: ИСТОРИЯ / ПРАВИЛО / ЖУРНАЛ.
import { paintPreview } from './career-previews.js';
import { GARAGE, GARAGE_DAYS, RULE_VARS, garageDay, judgeNight, simGarage, slowmoMoments, garageVerdict, tryPicklock, picklockNight, packetLine, staleRule } from './garage-night.js';
import { compileRule, formatRuleError } from './garage-rule.js';
import { loadAtlas } from './first-shift-atlas.js';
import { hackerQuestForDay, HACKER_QUESTS } from './career-story.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k) { try { return globalThis.localStorage?.getItem(k) ?? null; } catch { return null; } },
  set(k, v) { try { globalThis.localStorage?.setItem(k, v); } catch { /* private mode: drafts just don't persist */ } },
  del(k) { try { globalThis.localStorage?.removeItem(k); } catch { /* ignore */ } },
};
export { packetLine };

// Drafts saved before 19.0 use src / cmd / key and would only raise
// NameError now: drop them once (the AR headset reads the same keys).
export function migrateGarageDrafts(s = store) {
  let dropped = 0;
  for (const d of GARAGE_DAYS) {
    for (const k of [`quequest.garage.d${d.day}.rule`, `quequest.garage.d${d.day}.pick`]) {
      const v = s.get(k);
      if (v !== null && staleRule(v)) { s.del(k); dropped++; }
    }
  }
  return dropped;
}

// What a non-programmer reads before the code: who, what «ТИСКИ» did, the goal.
export function questCard(day = 1) {
  const q = hackerQuestForDay(day), d = garageDay(day);
  return { quest: q, day: d, label: `НОЧЬ ${day} ИЗ ${HACKER_QUESTS.length} · ${q.title.toUpperCase()}`, who: `${q.victim} — ${q.who}` };
}
export function legendRows(day = 1) {
  const d = garageDay(day);
  return RULE_VARS.map((v) => ({ name: v.name, means: v.means, values: v.name === 'ключ' ? `"${d.owner}" (ключ: ${d.ownerName}) или "" (никакого)` : v.values.map((x) => `"${x}"`).join(', ') }));
}

export function createGarageStage({ canvas, visual, controls, runButton, result, reduceMotion = false, onSound = () => {}, onDayResult = () => {} } = {}) {
  if (!canvas) return { open() {}, run() {}, stop() {}, pause() {}, tab() {}, state: () => null };
  migrateGarageDrafts();
  const ctx = canvas.getContext('2d');
  const W = 320, H = 180;
  canvas.width = W; canvas.height = H;
  const buf = new Uint32Array(W * H);
  const image = new ImageData(new Uint8ClampedArray(buf.buffer), W, H);
  const art = { atlas: null };
  loadAtlas().then((a) => { art.atlas = a; }).catch(() => {});
  const stageEl = controls?.parentElement ?? null;

  let day = 1, d = garageDay(1), phase = 'rule', raf = 0, mode = null, paused = false;
  let ruleSource = '', goodRule = '', picklock = null, lastT = 0, lastNow = 0, log = [];
  let els = {};
  const who = (p) => ({ owner: d.ownerName, radio: 'магнитола', stranger: '«ТИСКИ»', red: 'утро' }[p.who] ?? '');

  function setShake(size) {
    if (reduceMotion || !visual) return;
    visual.dataset.shake = size;
    clearTimeout(setShake.timer);
    setShake.timer = setTimeout(() => { delete visual.dataset.shake; }, size === 'l' ? 520 : 240);
  }
  // Phone tabs: ИСТОРИЯ · ПРАВИЛО · ЖУРНАЛ (the desktop shows all three).
  function tab(name = 'code') {
    if (!stageEl) return;
    stageEl.dataset.gtab = name;
    for (const b of controls.querySelectorAll('.garage-tabs [data-gtab]')) b.setAttribute('aria-selected', String(b.dataset.gtab === name));
  }

  // ------------------------------------------------------------- DOM
  function build() {
    const card = questCard(day);
    const logBox = document.createElement('section');
    logBox.className = 'garage-sniffer';
    logBox.innerHTML = '<small>ЧТО ПРИЛЕТАЕТ В МАШИНУ · ПО ПОРЯДКУ</small><ol id="garageLog" aria-live="off"></ol>';
    visual.querySelector('.garage-sniffer')?.remove();
    visual.append(logBox);
    const legend = legendRows(day).map((r) => `<div><code>${esc(r.name)}</code><span>${esc(r.means)}: ${esc(r.values)}</span></div>`).join('');
    const pick = d.factory ? `
      <section class="garage-pick" data-phase="${phase}">
        <small>ПРОШИВКА «ТИСКОВ» · ТОЛЬКО ЧТЕНИЕ</small>
        <pre class="garage-factory">${esc(d.factory)}</pre>
        <small>ТВОЙ ПРИЁМ · КЛЮЧА «${esc(d.owner)}» У ТЕБЯ НЕТ</small>
        <div class="code-editor"><span aria-hidden="true">PY</span><textarea id="garagePick" rows="5" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="Приём «ТИСКОВ» на Python: три переменные"></textarea></div>
        <p class="garage-picked" id="garagePicked"></p>
      </section>` : '';
    controls.innerHTML = `
      <div class="garage-ui" data-day="${day}" data-phase="${phase}">
        <nav class="garage-tabs" role="tablist" aria-label="Что показать">
          <button type="button" role="tab" data-gtab="story">ИСТОРИЯ</button><button type="button" role="tab" data-gtab="code">ПРАВИЛО</button><button type="button" role="tab" data-gtab="log">ЖУРНАЛ</button>
        </nav>
        <section class="garage-story" data-quest="${esc(card.quest.id)}">
          <b>${esc(card.label)}</b>
          <p class="garage-story__who">${esc(card.who)}</p>
          <p>${esc(card.quest.story)}</p>
          <p class="garage-goal"><i>ЦЕЛЬ</i> ${esc(card.quest.goal)}</p>
          <button type="button" class="garage-to-code" data-gtab="code">К ПРАВИЛУ →</button>
        </section>
        ${pick}
        <section class="garage-code" data-phase="${phase}">
          <small id="garageCodeLabel">ПРАВИЛО СТОРОЖА · Ctrl+Enter — проверить ночью</small>
          <div class="garage-legend" aria-label="Что значат слова в правиле">${legend}</div>
          <div class="garage-chips" aria-label="Вставить кусок кода в правило (туда, где курсор)">${(d.chips ?? []).map(([label], i) => `<button type="button" data-chip="${i}">${esc(label)}</button>`).join('')}</div>
          <div class="code-editor"><span aria-hidden="true">PY</span><textarea id="garageCode" rows="9" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="Правило сторожа машины на Python"></textarea></div>
          <p id="garageLint" class="garage-lint" role="status"></p>
        </section>
      </div>`;
    els = {
      log: visual.querySelector('#garageLog'), code: controls.querySelector('#garageCode'), lint: controls.querySelector('#garageLint'),
      pick: controls.querySelector('#garagePick'), codeBox: controls.querySelector('.garage-code'), pickBox: controls.querySelector('.garage-pick'),
      ui: controls.querySelector('.garage-ui'), picked: controls.querySelector('#garagePicked'),
    };
    els.code.value = ruleSource;
    if (els.pick) els.pick.value = store.get(`quequest.garage.d${day}.pick`) ?? d.pickStarter;
    els.code.addEventListener('input', () => { ruleSource = els.code.value; store.set(`quequest.garage.d${day}.rule`, ruleSource); lint(); rewatch(); });
    for (const ta of [els.code, els.pick].filter(Boolean)) ta.addEventListener('keydown', editorKeys);
    els.pick?.addEventListener('input', () => store.set(`quequest.garage.d${day}.pick`, els.pick.value));
    for (const b of controls.querySelectorAll('[data-chip]')) b.addEventListener('click', () => insertChip(d.chips[Number(b.dataset.chip)][1]));
    for (const b of controls.querySelectorAll('[data-gtab]')) b.addEventListener('click', () => { tab(b.dataset.gtab); onSound('ui-click'); });
    syncPhase();
  }

  // Tab indents, Enter keeps the indent (and adds one after a colon),
  // Ctrl/Cmd+Enter runs.
  function editorKeys(e) {
    const ta = e.currentTarget;
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); return; }
    if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); ta.setRangeText('    ', ta.selectionStart, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input')); return; }
    if (e.key === 'Enter' && !e.shiftKey) {
      const before = ta.value.slice(0, ta.selectionStart), line = before.slice(before.lastIndexOf('\n') + 1);
      const indent = /^ */.exec(line)[0] + (/:\s*$/.test(line) ? '    ' : '');
      if (indent) { e.preventDefault(); ta.setRangeText(`\n${indent}`, ta.selectionStart, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input')); }
    }
  }
  function insertChip(text) {
    const ta = els.code; if (ta.readOnly) return;
    ta.focus({ preventScroll: true }); ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input')); onSound('ui-click');
  }

  function lint() {
    const c = compileRule(ruleSource);
    if (c.ok) { goodRule = ruleSource; els.lint.dataset.ok = 'true'; els.lint.textContent = '✓ Сторож понимает правило. Сцена уже крутит его.'; }
    else { els.lint.dataset.ok = 'false'; els.lint.textContent = formatRuleError(c.error); }
    if (mode?.kind === 'watch') mode.night = judgeNight(goodRule, day);
    return c.ok;
  }

  function syncPhase() {
    const pickPhase = phase === 'pick';
    if (els.code) { els.code.readOnly = pickPhase; els.codeBox.dataset.phase = phase; }
    if (els.pickBox) els.pickBox.dataset.phase = phase;
    if (els.ui) els.ui.dataset.phase = phase;
    if (els.picked) els.picked.textContent = picklock ? `Твой приём сработал: ${packetLine(picklock, day)}. Теперь залатай замок внизу.` : '';
    runButton.textContent = pickPhase ? '▶ ОТПРАВИТЬ ПРИЁМ' : phase === 'patch' ? '▶ ПРОВЕРИТЬ ЗАПЛАТКУ НОЧЬЮ' : '▶ ПРОВЕРИТЬ НОЧЬЮ';
  }

  function pushLog(p) {
    const verdict = p.verdict === 'pass' ? (p.leak ? 'ПРОШЛА · «ТИСКИ»!' : 'ПРОПУСК') : p.verdict === 'error' ? 'ОШИБКА' : (p.denied ? 'БЛОК · СВОЙ!' : 'БЛОК');
    const tone = p.leak || p.denied || p.verdict === 'error' ? 'bad' : p.verdict === 'pass' ? 'pass' : 'block';
    const li = `<li data-tone="${tone}" data-phase="${p.phase}"><code>№${String(p.id + 1).padStart(2, '0')} ${esc(packetLine(p, day))}</code><b>${verdict}</b><i>${esc(who(p))}${p.note ? ` · ${esc(p.note)}` : ''}</i></li>`;
    log.push(li);
    if (log.length > 40) log.shift();
    if (els.log) {
      els.log.insertAdjacentHTML('beforeend', li);
      while (els.log.children.length > 40) els.log.firstElementChild.remove();
      els.log.scrollTop = els.log.scrollHeight;
    }
  }

  // ------------------------------------------------------------ loop
  function frame(now) {
    raf = 0;
    if (!mode || !canvas.isConnected) return;
    // Paused (Esc): the night stands still until the player comes back.
    if (paused) { if (mode.kind === 'watch' && lastNow) mode.since += now - lastNow; lastNow = now; raf = requestAnimationFrame(frame); return; }
    const dt = lastNow ? Math.min(0.1, (now - lastNow) / 1000) : 0; lastNow = now;
    const time = now / 1000;
    let t, slow = 0;
    if (mode.kind === 'watch') {
      const span = GARAGE.night + 1.8;
      t = reduceMotion ? GARAGE.night : ((now - mode.since) / 1000) % span;
      if (t < lastT) { log = []; if (els.log) els.log.innerHTML = ''; }
    } else {
      // Slow motion around the deciding moments.
      const near = mode.moments.reduce((m, at) => Math.max(m, mode.t > at - 0.2 && mode.t < at + 0.5 ? 1 : 0), 0);
      mode.slow += ((reduceMotion || mode.fast ? 0 : near) - mode.slow) * Math.min(1, dt * 10);
      slow = mode.slow;
      mode.t += dt * (mode.fast ? 4 : 1 - slow * (1 - GARAGE.slowmo));
      t = Math.min(mode.t, mode.night.end);
    }
    const nightNow = mode.night;
    events(nightNow, lastT, t);
    lastT = t;
    const done = mode.kind === 'run' && t >= nightNow.end;
    const cfg = { day, night: nightNow, slow };
    if (done) {
      if (!mode.verdict) finish();
      cfg.banner = { ...mode.banner, k: Math.min(1, (now - mode.doneAt) / 300) };
    }
    paintPreview(buf, 'vehicle', cfg, t, time, art, { label: mode.kind === 'run' ? (mode.picklock ? 'ПРИЁМ «ТИСКОВ»' : `НОЧЬ ${day}`) : `ГАРАЖ · НОЧЬ ${day}`, caption: caption(t, nightNow), tone: done ? (mode.verdict?.ok ? 'good' : 'bad') : 'neutral' });
    ctx.putImageData(image, 0, 0);
    raf = requestAnimationFrame(frame);
  }
  function caption(t, n) {
    if (!mode) return '';
    if (mode.kind === 'watch') return 'ТВОЁ ПРАВИЛО УЖЕ В СТОРОЖЕ · СМОТРИ';
    if (mode.picklock) return t < n.end ? 'ПРИЁМ ЛЕТИТ В ЗАМОК' : '';
    if (t >= n.end) return '';
    if (n.redSkipped && t >= GARAGE.night) return 'НОЧЬ ПРОИГРАНА — ДО ТРЮКОВ НЕ ДОШЛО';
    return !n.redSkipped && t >= GARAGE.redStart - 0.3 ? 'УТРО: ЗАПАСНЫЕ ТРЮКИ «ТИСКОВ»' : `НОЧЬ: ${t.toFixed(1)} С${mode.fast ? ' · ПЕРЕМОТКА' : ''}`;
  }
  // Sounds, shake and the log follow what crossed the watchman this frame.
  function events(n, from, to) {
    if (to < from) return;
    for (const p of n.packets) {
      if (p.atGate > from && p.atGate <= to) {
        pushLog(p);
        if (mode.kind === 'run') {
          if (p.verdict !== 'pass') { onSound(p.denied ? 'blocked' : 'clank'); setShake('s'); }
          else onSound('scan');
        }
      }
      if (mode.kind === 'run' && p.atCar !== undefined && p.atCar > from && p.atCar <= to) {
        if (p.leak) { onSound('impact'); onSound(p.cmd === 'start' ? 'power' : 'blocked'); setShake('l'); }
        else if (p.cmd === 'start') onSound('power');
        else if (p.cmd === 'unlock') onSound('lock');
      }
    }
    if (mode.kind === 'run' && !mode.picklock && !n.redSkipped && from < GARAGE.redStart - 0.3 && to >= GARAGE.redStart - 0.3) onSound('dash');
  }

  function finish() {
    mode.doneAt = performance.now();
    if (mode.picklock) {
      const opened = mode.night.packets[0].verdict === 'pass';
      mode.verdict = { ok: opened };
      mode.banner = opened ? { ok: false, title: 'ОТКРЫТО БЕЗ КЛЮЧА', sub: 'ДЫРА ЕСТЬ. ТЕПЕРЬ ЗАЛАТАЙ ЕЁ.' } : { ok: false, title: 'ОТБИЛИ', sub: 'ПРОШИВКА ЭТО НЕ ПУСТИЛА' };
      if (opened) {
        phase = 'patch'; picklock = mode.picklockPacket; store.set(`quequest.garage.d${day}.picked`, JSON.stringify(picklock));
        result.dataset.ok = 'false';
        result.textContent = `Получилось — и это плохая новость для Сани: ${packetLine(picklock, day)} открыла машину без ключа. Прошивка «ТИСКОВ» пускает всё, где откуда == "эфир": «or» сделал дверь шире. Перепиши правило так, чтобы этот приём разбился о сторожа, а Саня и музыка прошли.`;
        syncPhase(); tab('code'); els.code.focus({ preventScroll: true });
      }
      onSound(opened ? 'reward' : 'blocked');
      return;
    }
    const sim = simGarage({ day, night: mode.night }, Infinity);
    const v = garageVerdict(sim);
    mode.verdict = v;
    const paid = Number(onDayResult({ ok: v.ok, verdict: v, sim, rule: mode.rule, day, picklock })) || 0;
    mode.banner = { ok: v.ok, title: v.title, sub: v.ok ? (paid ? `+${paid} ₽ В КОШЕЛЁК` : 'НОЧЬ СНОВА ТВОЯ') : v.title === 'ТИСКИ НАШЛИ ЛАЗЕЙКУ' ? 'НОЧЬ ДЕРЖАЛ, НО ТРЮК ПРОШЁЛ' : 'ПОПРАВЬ ПРАВИЛО И ПРОВЕРЬ СНОВА' };
  }

  // ------------------------------------------------------------ API
  function watch() {
    mode = { kind: 'watch', since: performance.now(), night: judgeNight(goodRule, day) };
    lastT = 0; log = []; if (els.log) els.log.innerHTML = '';
    kick();
  }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }

  function open(dayNo = 1) {
    stop();
    paused = false;
    day = dayNo; d = garageDay(dayNo);
    let saved = null; try { saved = JSON.parse(store.get(`quequest.garage.d${day}.picked`) ?? 'null'); } catch { saved = null; }
    picklock = d.factory ? saved : null;
    phase = d.factory ? (picklock ? 'patch' : 'pick') : 'rule';
    const draft = store.get(`quequest.garage.d${day}.rule`);
    ruleSource = draft !== null && !staleRule(draft) ? draft : d.starter;
    goodRule = compileRule(ruleSource).ok ? ruleSource : d.starter;
    build(); lint(); watch();
    // A first visit starts with the story; a return goes straight to the rule.
    tab(draft === null && !picklock ? 'story' : 'code');
    result.dataset.ok = 'false';
    result.textContent = phase === 'pick'
      ? 'Прочитай прошивку «ТИСКОВ»: какой вход она пускает без ключа? Впиши его в свой приём и нажми «ОТПРАВИТЬ ПРИЁМ».'
      : day === 1 ? 'Смотри журнал: машину уже открывает команда «ТИСКОВ». Поменяй правило — сцена сразу крутит его. Потом «ПРОВЕРИТЬ НОЧЬЮ»: после ночи «ТИСКИ» попробуют запасные трюки.'
        : 'Правило сторожа — твоё. Поправь его и проверь ночью.';
  }

  function run() {
    if (paused) return;
    // A second press during the night fast-forwards it.
    if (mode?.kind === 'run' && !mode.verdict) { mode.fast = true; return; }
    if (phase === 'pick') {
      const tryIt = tryPicklock(els.pick.value, day);
      if (!tryIt.packet) { result.dataset.ok = 'false'; result.textContent = tryIt.message; setShake('s'); onSound('blocked'); return; }
      if (tryIt.reason === 'owner-key' || tryIt.reason === 'src' || tryIt.reason === 'harmless') { result.dataset.ok = 'false'; result.textContent = tryIt.message; setShake('s'); onSound('blocked'); return; }
      const n = picklockNight(tryIt.packet, day);
      mode = { kind: 'run', picklock: true, picklockPacket: tryIt.packet, t: 0, slow: 0, night: n, moments: [n.packets[0].atGate], rule: d.factory };
      lastT = 0; log = []; if (els.log) els.log.innerHTML = '';
      result.dataset.ok = 'false'; result.textContent = tryIt.ok ? 'Приём ушёл в машину…' : `${tryIt.message}`;
      onSound('whoosh'); kick(); return;
    }
    if (!compileRule(ruleSource).ok) {
      result.dataset.ok = 'false'; result.textContent = `Сторож не может запустить такое правило. ${formatRuleError(compileRule(ruleSource).error)}`;
      tab('code'); els.code.focus({ preventScroll: true }); setShake('s'); onSound('blocked'); return;
    }
    const n = judgeNight(ruleSource, day, { picklock });
    mode = { kind: 'run', t: 0, slow: 0, night: n, moments: slowmoMoments(n), rule: ruleSource };
    lastT = 0; log = []; if (els.log) els.log.innerHTML = '';
    result.dataset.ok = 'false'; result.textContent = 'Ночь пошла. Смотри на сторожа. Нажми ещё раз — перемотать.';
    onSound('ui-click'); kick();
  }

  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; mode = null; lastNow = 0; paused = false; visual?.querySelector('.garage-sniffer')?.remove(); if (visual) delete visual.dataset.shake; if (stageEl) delete stageEl.dataset.gtab; }
  function rewatch() { if (mode?.kind === 'run' && mode.verdict) watch(); }
  function pause(on = true) { paused = Boolean(on); }

  return {
    open, run, stop, rewatch, pause, tab,
    state: () => (mode ? { kind: mode.kind, day, phase, paused, done: Boolean(mode.verdict), verdict: mode.verdict ?? null, quest: hackerQuestForDay(day).id } : null),
    get phase() { return phase; },
  };
}
