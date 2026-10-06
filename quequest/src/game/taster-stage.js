// 19.0 part C · the taster inside the professions screen: the person, the
// level's goal, its controls (three buttons / a settings panel / a few lines
// of code with a legend), the live scene, and one human sentence after every
// try. Drives career-tasters.js (judges) and taster-scene.js (the scene).
//
// career-worlds.js hands over the same stage nodes the garage uses (canvas,
// controls box, the big run button, the result line) and gets back
// onWin(id, index, hints) → rubles paid for that first win.

import { tasterById, judgeLevel, knobStart, tasterStatus, firstOpenLevel, TASTER_END, WAY_WORDS } from './career-tasters.js';
import { createTasterCanvas } from './taster-scene.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LEVEL_NAMES = ['КНОПКА', 'НАСТРОЙКИ', 'КОД'];

export function createTasterStage({ canvas, controls, runButton, result, head = {}, reduceMotion = false, getProfile = () => ({}), onSound = () => {}, onWin = () => 0, onBack = () => {} } = {}) {
  const scene = createTasterCanvas(canvas, { reduceMotion });
  let taster = null, index = 0, input = null, playing = false, phase = 'try', fails = 0, hints = 0, ended = false;
  const doc = controls?.ownerDocument;

  function say(text, ok = null) { if (!result) return; result.textContent = text; result.dataset.ok = ok === null ? 'false' : String(ok); }
  function header() {
    const level = taster.levels[index];
    if (head.subtitle) head.subtitle.textContent = `${taster.name.toUpperCase()} · ПРОБА · УРОВЕНЬ ${index + 1} ИЗ ${taster.levels.length}`;
    if (head.title) head.title.textContent = ended ? `${taster.victim.toUpperCase()}: ПРОБА ПРОЙДЕНА` : level.title.toUpperCase();
    if (head.prompt) head.prompt.textContent = taster.story;
  }
  function pips() {
    const st = tasterStatus(getProfile(), taster.id);
    return `<ol class="taster-pips" aria-label="Уровни пробы">${st.map((s, i) => `<li><button type="button" data-taster-level="${i}" data-status="${s.status}" aria-current="${i === index && !ended}" ${s.status === 'locked' ? 'disabled' : ''}><b>${s.status === 'done' ? '✓' : i + 1}</b><span>${esc(WAY_WORDS[s.way])}</span></button></li>`).join('')}</ol>`;
  }
  function render() {
    if (!controls || !taster) return;
    const level = taster.levels[index];
    header();
    const story = `<section class="taster-story"><b>${esc(taster.victim)} · ${esc(taster.who)}</b><p>${esc(taster.story)}</p></section>`;
    let body = '';
    if (ended) {
      body = `<section class="taster-end" data-taster-end><b>ПРОБА ПРОЙДЕНА</b><p class="taster-end__thanks">${esc(taster.thanks)}</p><p class="taster-end__lead">${esc(TASTER_END)}</p><ul>${taster.next.map((n) => `<li>${esc(n)}</li>`).join('')}</ul><p class="taster-end__note">Это проба: три коротких уровня. Целая профессия ещё строится.</p></section>`;
    } else if (level.way === 'tap') {
      body = `<div class="taster-choices" role="group" aria-label="Что сделать">${level.choices.map((c) => `<button type="button" data-taster-choice="${esc(c.id)}"><strong>${esc(c.label)}</strong><small>${esc(c.note)}</small></button>`).join('')}</div>`;
    } else if (level.way === 'knobs') {
      body = `<div class="taster-knobs">${level.knobs.map((k) => `<div class="taster-knob" data-knob="${esc(k.id)}"><span>${esc(k.label)}</span><div role="radiogroup" aria-label="${esc(k.label)}">${k.options.map(([v, l]) => `<button type="button" role="radio" data-knob-value="${esc(v)}" aria-checked="${String(input[k.id]) === String(v)}">${esc(l)}</button>`).join('')}</div></div>`).join('')}</div>`;
    } else {
      body = `<dl class="taster-legend">${level.legend.map(([w, m]) => `<div><dt><code>${esc(w)}</code></dt><dd>${esc(m)}</dd></div>`).join('')}</dl>
        <div class="code-editor taster-code"><span aria-hidden="true">PY</span><textarea id="tasterCode" rows="5" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="Правило на Python"></textarea></div>
        <div class="taster-chips" aria-label="Кусочки, которые можно вставить">${level.chips.map((c, i) => `<button type="button" data-taster-chip="${i}"><code>${esc(c)}</code></button>`).join('')}${fails >= 2 ? '<button type="button" data-taster-hint class="taster-hint">ПОКАЗАТЬ ГОТОВОЕ ПРАВИЛО</button>' : ''}</div>`;
    }
    controls.innerHTML = `<div class="taster-ui" data-way="${ended ? 'end' : level.way}">${pips()}${index === 0 || ended ? story : ''}${ended ? '' : `<p class="taster-goal"><i>ЗАДАЧА</i>${esc(level.goal)}</p>`}${body}</div>`;
    const ta = controls.querySelector('#tasterCode');
    if (ta) { ta.value = input; ta.addEventListener('input', () => { input = ta.value; }); ta.addEventListener('keydown', editorKey); }
    runButtonState();
  }
  function runButtonState() {
    if (!runButton || !taster) return;
    const level = taster.levels[index];
    runButton.hidden = false; runButton.removeAttribute('aria-disabled');
    if (ended) runButton.textContent = '← К ПРОФЕССИЯМ';
    else if (phase === 'won') runButton.textContent = index + 1 < taster.levels.length ? `УРОВЕНЬ ${index + 2}: ${LEVEL_NAMES[index + 1]} →` : 'ЧТО ДАЛЬШЕ →';
    else if (level.way === 'tap') { runButton.textContent = 'ВЫБЕРИ ОДНУ ИЗ КНОПОК ВЫШЕ'; runButton.setAttribute('aria-disabled', 'true'); runButton.hidden = true; }
    else runButton.textContent = '▶ ПРОВЕРИТЬ';
    if (playing) runButton.setAttribute('aria-disabled', 'true');
  }
  function editorKey(e) {
    const ta = e.target;
    if (e.key === 'Tab') { e.preventDefault(); insert(ta, '    ', false); }
    else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); run(); }
    else if (e.key === 'Enter') {
      const before = ta.value.slice(0, ta.selectionStart), line = before.split('\n').at(-1);
      const indent = (line.match(/^\s*/)?.[0] ?? '') + (/:\s*$/.test(line) ? '    ' : '');
      e.preventDefault(); insert(ta, `\n${indent}`, false);
    }
  }
  function insert(ta, text, smart = true) {
    const s = ta.selectionStart ?? ta.value.length, e = ta.selectionEnd ?? s;
    let piece = text;
    if (smart) {
      const before = ta.value.slice(0, s), line = before.split('\n').at(-1), prev = before.split('\n').at(-2) ?? '';
      const statement = /^(if|else|elif|print)\b/.test(text);
      if (statement && line.trim()) { const ind = (line.match(/^\s*/)?.[0] ?? '') + (/:\s*$/.test(line) ? '    ' : ''); piece = `\n${/^(else|elif)\b/.test(text) ? '' : ind}${text}`; }
      else if (statement && !line.trim() && /:\s*$/.test(prev) && !/^(else|elif)\b/.test(text) && !line.length) piece = `    ${text}`;
      else if (!statement && line.length && !/\s$/.test(line)) piece = ` ${text}`;
    }
    ta.setRangeText(piece, s, e, 'end'); input = ta.value; ta.focus({ preventScroll: true });
  }

  function open(id, level = null) {
    taster = tasterById(id); if (!taster) return false;
    const st = tasterStatus(getProfile(), id);
    index = level ?? firstOpenLevel(getProfile(), id);
    if (level === null && st.every((s) => s.status === 'done')) index = 0;
    ended = false; startLevel();
    return true;
  }
  function startLevel() {
    const level = taster.levels[index];
    phase = 'try'; fails = 0; hints = 0; playing = false;
    input = level.way === 'knobs' ? knobStart(level) : level.way === 'code' ? level.starter : null;
    render();
    say(level.way === 'tap' ? 'Нажми кнопку — сцена сразу покажет, что будет.' : level.way === 'knobs' ? 'Выставь настройки и нажми «ПРОВЕРИТЬ».' : 'Поправь правило. Нажми «ПРОВЕРИТЬ» — все случаи пройдут через него на сцене.');
    scene.idle(taster.id, index, { input: level.way === 'knobs' ? input : null, caption: `${taster.victim}: ${level.title}` });
  }
  function play(res) {
    playing = true; runButtonState();
    for (const b of controls.querySelectorAll('button')) b.setAttribute('aria-disabled', 'true');
    say('Смотри на сцену…');
    onSound('ui-click');
    scene.play(taster.id, index, res, {
      caption: res.ok ? 'ПОЛУЧИЛОСЬ' : 'СМОТРИ, ЧТО СЛУЧИЛОСЬ',
      onDone: () => {
        playing = false;
        for (const b of controls.querySelectorAll('button')) b.removeAttribute('aria-disabled');
        if (res.ok) {
          phase = 'won';
          const paid = onWin(taster.id, index, hints) || 0;
          say(`✓ ${res.why}${paid ? ` +${paid} ₽.` : ''}`, true); onSound('reward');
          render(); say(`✓ ${res.why}${paid ? ` +${paid} ₽.` : ''}`, true);
        } else {
          fails += 1;
          say(`✗ ${res.why} Попробуй иначе — прогресс не отнимается.`, false); onSound('blocked');
          if (taster.levels[index].way === 'code' && fails === 2) { const keep = input; render(); input = keep; const ta = controls.querySelector('#tasterCode'); if (ta) ta.value = keep; say(`✗ ${res.why} Можно открыть готовое правило — кнопка под редактором.`, false); }
          runButtonState();
        }
      },
    });
  }
  function run() {
    if (!taster || playing) return;
    if (ended) { onBack(); return; }
    if (phase === 'won') { if (index + 1 < taster.levels.length) { index += 1; startLevel(); } else { ended = true; render(); say(`${taster.thanks}`, true); onSound('reward'); } return; }
    const level = taster.levels[index];
    if (level.way === 'tap') return;
    play(judgeLevel(taster.id, index, input));
  }
  controls?.addEventListener('click', (e) => {
    if (!taster) return;
    const story = e.target.closest?.('.taster-story'); if (story) { story.dataset.open = String(story.dataset.open !== 'true'); return; }
    const t = e.target.closest?.('button'); if (!t || t.getAttribute('aria-disabled') === 'true' || playing) return;
    if (t.dataset.tasterLevel !== undefined) { const i = Number(t.dataset.tasterLevel); if (tasterStatus(getProfile(), taster.id)[i]?.status !== 'locked') { index = i; ended = false; startLevel(); onSound('ui-click'); } return; }
    if (t.dataset.tasterChoice && phase !== 'won') { for (const b of controls.querySelectorAll('[data-taster-choice]')) b.dataset.picked = String(b === t); play(judgeLevel(taster.id, index, t.dataset.tasterChoice)); return; }
    const knob = t.closest('[data-knob]');
    if (knob && t.dataset.knobValue !== undefined) {
      const level = taster.levels[index], k = level.knobs.find((x) => x.id === knob.dataset.knob);
      const opt = k.options.find(([v]) => String(v) === t.dataset.knobValue); if (!opt) return;
      input = { ...input, [k.id]: opt[0] }; if (phase === 'won') phase = 'try';
      for (const b of knob.querySelectorAll('[data-knob-value]')) b.setAttribute('aria-checked', String(b === t));
      scene.idle(taster.id, index, { input, caption: `${k.label}: ${opt[1]}` }); runButtonState(); onSound('ui-click');
      return;
    }
    if (t.dataset.tasterChip !== undefined) { const ta = controls.querySelector('#tasterCode'); if (ta) { insert(ta, taster.levels[index].chips[Number(t.dataset.tasterChip)]); onSound('ui-click'); } return; }
    if (t.dataset.tasterHint !== undefined) { const ta = controls.querySelector('#tasterCode'); if (ta) { ta.value = taster.levels[index].solution; input = ta.value; hints = 1; say('Вот готовое правило. Прочитай его по легенде сверху и нажми «ПРОВЕРИТЬ».'); } }
  });
  return {
    open, run,
    stop() { scene.stop(); taster = null; playing = false; if (runButton) runButton.hidden = false; },
    get active() { return Boolean(taster); },
    get state() { return taster ? { id: taster.id, index, phase, ended, playing, input } : null; },
  };
}
