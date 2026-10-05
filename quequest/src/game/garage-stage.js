// 17.1 · GARAGE · НОЧНОЙ ШЛЮЗ — the playable stage inside the vehicle
// profession. The player reads intercepted bus traffic, writes the gateway
// rule in Python, and runs the night: the scene (garage-scene.js) shows every
// command hit the rule, blocked ones shatter, a leaked one opens the car with
// an alarm; then their own red team throws commands the rule has never seen.
// Day 3 starts the other way round: break the factory rule first, then patch.
// The verdict is simGarage's -- the same function the scene draws.
import { makePainter, paintPreview } from './career-previews.js';
import { GARAGE, garageDay, judgeNight, simGarage, slowmoMoments, garageVerdict, tryPicklock, picklockNight } from './garage-night.js';
import { compileRule, formatRuleError } from './garage-rule.js';
import { loadAtlas } from './first-shift-atlas.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const WHO = { owner: 'хозяин', radio: 'магнитола', stranger: '???', red: 'red-team' };
const store = {
  get(k) { try { return globalThis.localStorage?.getItem(k) ?? null; } catch { return null; } },
  set(k, v) { try { globalThis.localStorage?.setItem(k, v); } catch { /* private mode: drafts just don't persist */ } },
};

export function packetLine(p) {
  return `src="${p.src}" cmd="${p.cmd}" key="${p.key}"`;
}

export function createGarageStage({ canvas, visual, controls, runButton, result, reduceMotion = false, onSound = () => {}, onDayResult = () => {} } = {}) {
  if (!canvas) return { open() {}, run() {}, stop() {}, state: () => null };
  const ctx = canvas.getContext('2d');
  const W = 320, H = 180;
  canvas.width = W; canvas.height = H;
  const buf = new Uint32Array(W * H);
  const image = new ImageData(new Uint8ClampedArray(buf.buffer), W, H);
  const art = { atlas: null };
  loadAtlas().then((a) => { art.atlas = a; }).catch(() => {});

  let day = 1, d = garageDay(1), phase = 'rule', raf = 0, mode = null;
  let ruleSource = '', goodRule = '', picklock = null, night = null, lastT = 0, lastNow = 0, log = [];
  let els = {};

  function setShake(size) {
    if (reduceMotion || !visual) return;
    visual.dataset.shake = size;
    clearTimeout(setShake.timer);
    setShake.timer = setTimeout(() => { delete visual.dataset.shake; }, size === 'l' ? 520 : 240);
  }

  // ------------------------------------------------------------- DOM
  function build() {
    const logBox = document.createElement('section');
    logBox.className = 'garage-sniffer';
    logBox.innerHTML = '<small>ПЕРЕХВАТ ШИНЫ · ЧТО ДОХОДИТ ДО ШЛЮЗА</small><ol id="garageLog" aria-live="off"></ol>';
    visual.querySelector('.garage-sniffer')?.remove();
    visual.append(logBox);
    const pick = d.factory ? `
      <section class="garage-pick" data-phase="${phase}">
        <small>ЗАВОДСКОЙ ШЛЮЗ · ТОЛЬКО ЧТЕНИЕ</small>
        <pre class="garage-factory">${esc(d.factory)}</pre>
        <small>ТВОЯ ОТМЫЧКА · ТЫ УГОНЩИК, КЛЮЧА ВЛАДЕЛЬЦА НЕТ</small>
        <div class="code-editor"><span aria-hidden="true">PY</span><textarea id="garagePick" rows="5" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="Команда-отмычка на Python"></textarea></div>
      </section>` : '';
    controls.innerHTML = `
      <div class="garage-ui" data-day="${day}">
        <p class="garage-brief"><b>ДЕНЬ ${day} · ${esc(d.title)}</b> ${esc(d.brief)}</p>
        ${pick}
        <section class="garage-code" data-phase="${phase}">
          <small id="garageCodeLabel">ПРАВИЛО ШЛЮЗА · PYTHON · Ctrl+Enter — прогнать ночь</small>
          <div class="code-editor"><span aria-hidden="true">PY</span><textarea id="garageCode" rows="10" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="Правило шлюза на Python"></textarea></div>
          <div class="garage-chips" aria-label="Вставить кусок кода">${(d.chips ?? []).map(([label], i) => `<button type="button" data-chip="${i}">${esc(label)}</button>`).join('')}</div>
          <p id="garageLint" class="garage-lint" role="status"></p>
        </section>
      </div>`;
    els = {
      log: visual.querySelector('#garageLog'), code: controls.querySelector('#garageCode'), lint: controls.querySelector('#garageLint'),
      pick: controls.querySelector('#garagePick'), codeBox: controls.querySelector('.garage-code'), pickBox: controls.querySelector('.garage-pick'),
    };
    els.code.value = ruleSource;
    if (els.pick) els.pick.value = store.get(`quequest.garage.d${day}.pick`) ?? d.pickStarter;
    els.code.addEventListener('input', () => { ruleSource = els.code.value; store.set(`quequest.garage.d${day}.rule`, ruleSource); lint(); rewatch(); });
    for (const ta of [els.code, els.pick].filter(Boolean)) ta.addEventListener('keydown', editorKeys);
    els.pick?.addEventListener('input', () => store.set(`quequest.garage.d${day}.pick`, els.pick.value));
    for (const b of controls.querySelectorAll('[data-chip]')) b.addEventListener('click', () => insertChip(d.chips[Number(b.dataset.chip)][1]));
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
    ta.focus(); ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input')); onSound('ui-click');
  }

  function lint() {
    const c = compileRule(ruleSource);
    if (c.ok) { goodRule = ruleSource; els.lint.dataset.ok = 'true'; els.lint.textContent = '✓ Шлюз понимает правило. Сцена уже крутит его на ночном трафике.'; }
    else { els.lint.dataset.ok = 'false'; els.lint.textContent = formatRuleError(c.error); }
    if (mode?.kind === 'watch') mode.night = judgeNight(goodRule, day);
    return c.ok;
  }

  function syncPhase() {
    const pickPhase = phase === 'pick';
    if (els.code) { els.code.readOnly = pickPhase; els.codeBox.dataset.phase = phase; }
    if (els.pickBox) els.pickBox.dataset.phase = phase;
    runButton.textContent = pickPhase ? '▶ ОТПРАВИТЬ ОТМЫЧКУ' : phase === 'patch' ? '▶ ПРОГНАТЬ НОЧЬ С ПАТЧЕМ' : '▶ ПРОГНАТЬ НОЧЬ';
  }

  function pushLog(p) {
    const verdict = p.verdict === 'pass' ? (p.leak ? 'ПРОШЛА · ЧУЖАЯ!' : 'ПРОПУСК') : p.verdict === 'error' ? 'ОШИБКА' : (p.denied ? 'БЛОК · СВОЯ!' : 'БЛОК');
    const tone = p.leak || p.denied || p.verdict === 'error' ? 'bad' : p.verdict === 'pass' ? 'pass' : 'block';
    const li = `<li data-tone="${tone}" data-phase="${p.phase}"><code>#${String(p.id + 1).padStart(2, '0')} ${esc(packetLine(p))}</code><b>${verdict}</b><i>${esc(WHO[p.who] ?? '')}${p.note ? ` · ${esc(p.note)}` : ''}</i></li>`;
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
    paintPreview(buf, 'vehicle', cfg, t, time, art, { label: mode.kind === 'run' ? (mode.picklock ? 'ОТМЫЧКА' : `НОЧЬ ${day}`) : `ГАРАЖ · ДЕНЬ ${day}`, caption: caption(t, nightNow), tone: done ? (mode.verdict?.ok ? 'good' : 'bad') : 'neutral' });
    ctx.putImageData(image, 0, 0);
    raf = requestAnimationFrame(frame);
  }
  function caption(t, n) {
    if (!mode) return '';
    if (mode.kind === 'watch') return 'ЖИВОЙ ПЕРЕХВАТ · ТВОЁ ПРАВИЛО УЖЕ В ШЛЮЗЕ';
    if (mode.picklock) return t < n.end ? 'ОТМЫЧКА ЛЕТИТ В ЗАВОДСКОЙ ШЛЮЗ' : '';
    if (t >= n.end) return '';
    if (n.redSkipped && t >= GARAGE.night) return 'НОЧЬ ПРОИГРАНА — RED-TEAM НЕ ПОНАДОБИЛСЯ';
    return !n.redSkipped && t >= GARAGE.redStart - 0.3 ? 'RED-TEAM: КОМАНДЫ, КОТОРЫХ НОЧЬЮ НЕ БЫЛО' : `НОЧЬ: ${t.toFixed(1)} С${mode.fast ? ' · ПЕРЕМОТКА' : ''}`;
  }
  // Sounds, shake and the log follow what crossed the gateway this frame.
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
      mode.banner = opened ? { ok: false, title: 'ТЫ ВОШЁЛ', sub: 'БЕЗ КЛЮЧА. ТЕПЕРЬ ЗАКРОЙ ЭТУ ДЫРУ.' } : { ok: false, title: 'ОТБИЛИ', sub: 'ЗАВОДСКОЙ ШЛЮЗ ЭТО НЕ ПУСТИЛ' };
      if (opened) {
        phase = 'patch'; picklock = mode.picklockPacket; store.set(`quequest.garage.d${day}.picked`, JSON.stringify(picklock));
        result.dataset.ok = 'false';
        result.textContent = `Ты угонщик, и у тебя получилось: ${packetLine(picklock)} открыла машину без ключа. Заводское правило пускает всех, у кого src == "air" — «or» сделал дверь шире. Теперь перепиши правило так, чтобы твоя же отмычка разбилась о шлюз, а хозяин и музыка прошли.`;
        syncPhase(); els.code.focus({ preventScroll: true });
      }
      onSound(opened ? 'reward' : 'blocked');
      return;
    }
    const sim = simGarage({ day, night: mode.night }, Infinity);
    const v = garageVerdict(sim);
    mode.verdict = v;
    const paid = Number(onDayResult({ ok: v.ok, verdict: v, sim, rule: mode.rule, day, picklock })) || 0;
    mode.banner = { ok: v.ok, title: v.title, sub: v.ok ? (paid ? `+${paid} ₽ В КОШЕЛЁК` : 'НОЧЬ СНОВА ТВОЯ') : v.title === 'RED-TEAM ПРОШЁЛ' ? 'НОЧЬ ДЕРЖАЛ, НО СВОЙ ШТУРМ ВОШЁЛ' : 'ПОПРАВЬ ПРАВИЛО И ПРОГОНИ СНОВА' };
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
    day = dayNo; d = garageDay(dayNo);
    let saved = null; try { saved = JSON.parse(store.get(`quequest.garage.d${day}.picked`) ?? 'null'); } catch { saved = null; }
    picklock = d.factory ? saved : null;
    phase = d.factory ? (picklock ? 'patch' : 'pick') : 'rule';
    ruleSource = store.get(`quequest.garage.d${day}.rule`) ?? d.starter;
    goodRule = compileRule(ruleSource).ok ? ruleSource : d.starter;
    build(); lint(); watch();
    result.dataset.ok = 'false';
    result.textContent = phase === 'pick'
      ? 'Прочитай заводское правило. Где оно пускает шире, чем надо? Собери отмычку и отправь.'
      : day === 1 ? 'Смотри перехват: машину уже открывает чужая команда. Перепиши правило — сцена сразу крутит его на живом трафике. Потом прогони ночь: в конце придёт твой red-team.'
        : 'Правило в шлюзе — твоё. Поправь его и прогони ночь.';
  }

  function run() {
    // A second press during the night fast-forwards it.
    if (mode?.kind === 'run' && !mode.verdict) { mode.fast = true; return; }
    if (phase === 'pick') {
      const tryIt = tryPicklock(els.pick.value, day);
      if (!tryIt.packet) { result.dataset.ok = 'false'; result.textContent = tryIt.message; setShake('s'); onSound('blocked'); return; }
      if (tryIt.reason === 'owner-key' || tryIt.reason === 'src' || tryIt.reason === 'harmless') { result.dataset.ok = 'false'; result.textContent = tryIt.message; setShake('s'); onSound('blocked'); return; }
      const n = picklockNight(tryIt.packet, day);
      mode = { kind: 'run', picklock: true, picklockPacket: tryIt.packet, t: 0, slow: 0, night: n, moments: [n.packets[0].atGate], rule: d.factory };
      lastT = 0; log = []; if (els.log) els.log.innerHTML = '';
      result.dataset.ok = 'false'; result.textContent = tryIt.ok ? 'Отмычка ушла в шину…' : `${tryIt.message}`;
      onSound('whoosh'); kick(); return;
    }
    if (!compileRule(ruleSource).ok) {
      result.dataset.ok = 'false'; result.textContent = `Шлюз не может запустить такое правило. ${formatRuleError(compileRule(ruleSource).error)}`;
      els.code.focus(); setShake('s'); onSound('blocked'); return;
    }
    const n = judgeNight(ruleSource, day, { picklock });
    mode = { kind: 'run', t: 0, slow: 0, night: n, moments: slowmoMoments(n), rule: ruleSource };
    lastT = 0; log = []; if (els.log) els.log.innerHTML = '';
    result.dataset.ok = 'false'; result.textContent = 'Ночь пошла. Смотри на шлюз.';
    onSound('ui-click'); kick();
  }

  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; mode = null; lastNow = 0; visual?.querySelector('.garage-sniffer')?.remove(); if (visual) delete visual.dataset.shake; }
  function rewatch() { if (mode?.kind === 'run' && mode.verdict) watch(); }

  return { open, run, stop, rewatch, state: () => (mode ? { kind: mode.kind, day, phase, done: Boolean(mode.verdict), verdict: mode.verdict ?? null } : null), get phase() { return phase; } };
}
