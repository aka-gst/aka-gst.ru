// 18.0: the terminal of Arm 07 for the first hour (day 2). Replaces the old
// machine panel for these steps, which threw `for` + `if` at a beginner in
// one typed lesson («ТВОЁ ПРАВИЛО · PYTHON», for box in boxes / if / move).
//
// Every idea goes through the floors of canon §13: first a button (ТЫК), then
// words / a rule panel (РУЧКИ), then code (КОД). Steps:
//   print  — the button sends one word; say it yourself. Copy allowed.
//   print2 — the boss tore the button off; the arm still listens. From memory.
//   rules  — white → ВЗЯТЬ, red → ОСТАВИТЬ, built by clicking.
//   if     — the same rule in Python; paste and drop are switched off.
import { createCodeEditor } from './code-editor.js';
import { checkWake, runRule } from './mini-python.js';
import { FOR_PANEL, WHILE_PANEL, DEF_PANEL, judgeForPanel, judgeWhilePanel, judgeDefPanel, runForLesson, runWhileLesson, runDefLesson } from './lessons.js';
import { ASSEMBLE, judgeAssemble, SHEET_LINE, HAND_RULE, WEEK } from './week.js';
import { createPieceLine } from './piece-line.js';

export const DESK_STEPS = Object.freeze({
  print: { floor: 'СЛОВА → КОД', title: 'Скажи руке словами', paste: true },
  print2: { floor: 'КОД · ПО ПАМЯТИ', title: 'Кнопки нет. Терминал есть', paste: true },
  rules: { floor: 'РУЧКИ · ПАНЕЛЬ ПРАВИЛ', title: 'Только белые', paste: true },
  if: { floor: 'КОД · БЕЗ ВСТАВКИ', title: 'То же правило — словами Python', paste: false },
  // 18.1: for, while, def — each through ТЫК → РУЧКИ → КОД.
  'for-tap': { floor: 'ТЫК · КНОПКА', title: 'Повторить для каждого', kind: 'button', button: '▶ ПОВТОРИТЬ ДЛЯ КАЖДОГО ЯЩИКА', f: 'tap' },
  'for-knobs': { floor: 'РУЧКИ · ПАНЕЛЬ', title: 'Сколько раз повторить?', kind: 'choice', panel: 'for', f: 'knobs' },
  'for-code': { floor: 'КОД', title: '«Для каждого» словами Python', kind: 'code', paste: true, f: 'code' },
  'for-combo': { floor: 'КОД · БЕЗ ВСТАВКИ', title: 'Для каждого — и только белые', kind: 'code', paste: false, f: 'code' },
  'while-tap': { floor: 'ТЫК · КНОПКА', title: 'Ночью ящики всё едут', kind: 'button', button: '▶ РАБОТАТЬ, ПОКА ЕСТЬ ЯЩИКИ', f: 'tap' },
  'while-knobs': { floor: 'РУЧКИ · ПАНЕЛЬ', title: 'Сколько работать ночью?', kind: 'choice', panel: 'while', f: 'knobs' },
  'while-code': { floor: 'КОД · БЕЗ ВСТАВКИ', title: '«Пока есть» словами Python', kind: 'code', paste: false, f: 'code' },
  'def-tap': { floor: 'ТЫК · КНОПКА', title: 'Две линии, одно правило', kind: 'button', button: '▶ ПОДКЛЮЧИТЬ ОДНО ПРАВИЛО К ДВУМ ЛИНИЯМ', f: 'tap' },
  'def-knobs': { floor: 'РУЧКИ · ПАНЕЛЬ', title: 'Копия или имя?', kind: 'choice', panel: 'def', f: 'knobs' },
  'def-code': { floor: 'КОД · БЕЗ ВСТАВКИ', title: 'Свой навык с именем', kind: 'code', paste: false, f: 'code' },
  // 19.0 · the first week (week.js): one terminal visit a day.
  copy: { floor: 'ДЕНЬ 2 · КОПИЯ', title: 'Листок электрика', kind: 'week', week: 2, paste: true },
  assemble: { floor: 'ДЕНЬ 3 · СБОРКА', title: 'Порванный листок', kind: 'week', week: 3 },
  hand: { floor: 'ДЕНЬ 4 · РУКАМИ', title: 'Без листка', kind: 'week', week: 4, paste: false },
  auto: { floor: 'ДЕНЬ 5 · АВТОМАТ', title: 'Вся линия — сама', kind: 'week', week: 5, paste: false },
});

// Long text for a computer screen, short for a phone (week.css picks one).
const WEEK_STORY = Object.freeze({
  copy: {
    long: `<p>Электрик переписал на листок, что сидело внутри кнопки: <b>одну строчку</b>. Рука слушает эту строчку, а не кнопку.</p>
    <p>Перенеси её в терминал: <b>выдели → скопируй → вставь</b>. Потом «▶ ОТПРАВИТЬ РУКЕ».</p>`,
    short: '<p>На листке — строчка, что сидела в кнопке. <b>Скопируй</b> её и <b>вставь</b> в терминал.</p>',
  },
  assemble: {
    long: `<p>Начальник порвал листок. На ленте белые и красные ящики — брать можно <b>только белые</b>.</p>
    <p>Сложи куски по русским словам над клетками. Одно слово оторвано совсем — впиши его сам: <b>на белых ящиках штамп WHITE</b>.</p>`,
    short: '<p>Брать <b>только белые</b>. Сложи куски по русским словам, оторванное слово впиши сам: на белых ящиках штамп <b>WHITE</b>.</p>',
  },
  hand: {
    long: `<p>Листка нет. Вчера ты собрал фразу: <b>«если ящик белый — рука, возьми ящик»</b>.</p>
    <p>Напиши её сам, две строчки. Вставка выключена: в этот раз — только твои руки.</p>`,
    short: '<p>Листка нет. Напиши сам: <b>«если ящик белый — рука, возьми ящик»</b>. Две строчки.</p>',
  },
  auto: {
    long: `<p>Фура: в линии <b>9 ящиков</b>, белые и красные вперемешку. Твоё правило уже в терминале — но оно про <b>один</b> ящик.</p>
    <table class="desk__map"><tr><td>для каждого ящика в линии</td><td><code>for box in boxes:</code></td></tr><tr><td>…делай моё правило</td><td>твои две строчки — уже <b>сдвинуты вправо</b>, внутрь</td></tr></table>
    <p>Над правилом пустая строчка — напиши там <code>for box in boxes:</code></p>
    <p>Это и есть программирование: ты пишешь один раз — машина повторяет сколько угодно.</p>`,
    short: '<p>Твоё правило уже внутри. В пустой верхней строчке напиши <code>for box in boxes:</code> — «для каждого ящика». Пишешь раз — машина повторяет. Это и есть программирование.</p>',
  },
});
const WEEK_HINTS = Object.freeze({
  copy: ['Щёлкни по строчке на листке, нажми Ctrl+A (Mac: Cmd+A), потом Ctrl+C. Щёлкни в поле ниже — Ctrl+V.', 'Или просто: кнопка «КОПИРОВАТЬ», потом «ВСТАВИТЬ».'],
  hand: ['Первая строчка: if box == "white":   (двоеточие в конце!)', 'Вторая — с 4 пробелами в начале:     arm.take(box)'],
  auto: ['В самой первой строчке: for box in boxes:   (двоеточие в конце!)', 'Под ней твоё правило, сдвинутое вправо: if… на 4 пробела, arm.take(box) — на 8. Сбилось — кнопки «⇥ / ⇤».'],
});

const PANELS = { for: FOR_PANEL, while: WHILE_PANEL, def: DEF_PANEL };
const LESSON_STORY = Object.freeze({
  'for-tap': `<p>Пришла фура. Кнопка «взять» — это один ящик. А их — партия, и в каждой партии разное число.</p><p>Электрик поставил на терминал новую кнопку: <b>«повторить для каждого»</b>. Рука сама пройдёт по всей партии — по одному ящику, пока не кончатся.</p>`,
  'for-knobs': '<p>Кнопку отдали на другой склад (конечно). На панели осталась настройка: сколько раз повторить. Новая партия — пять ящиков.</p>',
  'for-code': `<p><b>Сначала словами:</b> «для каждого ящика в партии — взять этот ящик». Python говорит то же самое почти теми же словами:</p>
    <table class="desk__map"><tr><td>для каждого ящика</td><td><code>for box</code></td></tr><tr><td>в партии</td><td><code>in boxes:</code></td></tr><tr><td>взять этот ящик</td><td><code>arm.take(box)</code> — с отступом 4 пробела</td></tr></table>
    <p><code>box</code> — это «текущий ящик»: на каждом круге в нём лежит следующий. Всё, что с отступом, повторяется для каждого.</p>`,
  'for-combo': `<p>Новая партия — и в ней опять красные. Ты уже знаешь, как сказать «только белые»: <code>if box == "white":</code></p><p>Сложи два знания: <b>для каждого</b> ящика — <b>если</b> белый — взять. Отступ внутри отступа. Это экзамен: вставка выключена.</p>`,
  'while-tap': `<p>Ночная смена. Ящики приезжают, пока рука работает: сколько их будет — не знает никто.</p><p>Кнопка на терминале: <b>«работать, пока есть ящики»</b>. Рука берёт первый из очереди, снова смотрит: есть ещё? — и так, пока очередь не опустеет.</p>`,
  'while-knobs': '<p>Кнопку унёс сторож (он тоже хочет). На панели — настройка: сколько работать. В очереди сейчас четыре, но ещё едут.</p>',
  'while-code': `<p><b>Сначала словами:</b> «пока очередь не пуста — взять первый ящик из очереди; если он белый — отдать руке».</p>
    <table class="desk__map"><tr><td>пока очередь не пуста</td><td><code>while queue:</code></td></tr><tr><td>взять первый</td><td><code>box = queue.pop(0)</code></td></tr><tr><td>если белый — отдать руке</td><td><code>if box == "white":</code> → <code>arm.take(box)</code></td></tr></table>
    <p>Без <code>pop(0)</code> очередь не уменьшится — и цикл не кончится. Экзамен: без вставки.</p>`,
  'def-tap': `<p>Включили вторую линию. Начальник хотел скопировать правило в её терминал. Электрик поставил кнопку получше: <b>одно правило — на обе линии</b>.</p>`,
  'def-knobs': '<p>Кнопку забрал начальник «до выяснения». На панели выбор: скопировать правило во вторую линию или дать ему имя и подключить обе.</p>',
  'def-code': `<p><b>Сначала словами:</b> «навык route: для каждого ящика в партии — если белый, взять. Включить route на линии A и на линии B».</p>
    <table class="desk__map"><tr><td>навык с именем route, получает партию</td><td><code>def route(batch):</code></td></tr><tr><td>внутри — то, что ты уже умеешь</td><td><code>for box in batch:</code> → <code>if</code> → <code>arm.take(box)</code></td></tr><tr><td>включить на линии A и B</td><td><code>route(line_a)</code> и <code>route(line_b)</code> — без отступа</td></tr></table>`,
});

// The rule panel as a sentence — the bridge from buttons to `if`.
export function ruleSentence(rules) {
  const verb = (v) => (v === 'take' ? 'ВЗЯТЬ' : 'ОСТАВИТЬ');
  return `ЕСЛИ ящик белый → ${verb(rules.white)}. ЕСЛИ красный → ${verb(rules.red)}.`;
}

export function judgeRules(rules) {
  if (rules.red === 'take') return { ok: false, fine: true, text: 'Рука потянулась к красному. Начальник: «ШТРАФ!» Красные не трогаем.' };
  if (rules.white !== 'take') return { ok: false, fine: false, text: 'Рука стоит: ей нечего брать. Белые-то брать можно.' };
  return { ok: true, fine: false, text: 'Правило принято. Белые поедут на ленту, красные останутся.' };
}

const PASTE_WHY = 'Вставка выключена: это экзамен смены. Руки должны запомнить сами — набери строку, это 2 строчки.';

export function createHourDesk(root, { onWake = () => {}, onRules = () => {}, onRule = () => {}, onLesson = () => {}, onWeek = () => {}, getColors = () => [], getLines = () => ({ a: [], b: [] }), onClose = () => {}, sound = () => {} } = {}) {
  if (!root) return { open() {}, close() {}, isOpen: () => false, step: () => null };
  root.innerHTML = `
    <div class="desk__card" role="dialog" aria-modal="true" aria-labelledby="deskTitle">
      <header class="desk__head">
        <div><small id="deskFloor">ТЕРМИНАЛ РУКИ 07</small><h2 id="deskTitle"></h2></div>
        <button class="desk__close" type="button" aria-label="Закрыть терминал">×</button>
      </header>
      <ol class="desk__floors" aria-label="Этажи навыка"><li data-f="tap">КНОПКА</li><li data-f="knobs">СЛОВА / ПРАВИЛА</li><li data-f="code">КОД</li></ol>
      <ol class="desk__week" id="deskWeek" aria-label="Неделя на заводе" hidden>${WEEK.map((d) => `<li data-day="${d.day}"><b>${d.day}</b> <span>${d.way}</span></li>`).join('')}</ol>
      <div class="desk__story" id="deskStory"></div>
      <div class="desk__sheet" id="deskSheet" hidden>
        <small>ЛИСТОК ЭЛЕКТРИКА · НА СКОТЧЕ</small>
        <code id="deskSheetLine" tabindex="0">${SHEET_LINE.replace(/"/g, '&quot;')}</code>
        <ol class="desk__steps" id="deskSteps"><li data-k="select">ВЫДЕЛИ</li><li data-k="copy">СКОПИРУЙ</li><li data-k="paste">ВСТАВЬ</li></ol>
        <p class="desk__keys">Мышью: выдели строчку (или щёлкни по ней и <kbd>Ctrl</kbd>+<kbd>A</kbd>), <kbd>Ctrl</kbd>+<kbd>C</kbd>, щёлкни в поле ниже и <kbd>Ctrl</kbd>+<kbd>V</kbd>. На Mac — <kbd>Cmd</kbd>. На телефоне — кнопки:</p>
        <div class="desk__clip"><button type="button" id="deskCopy">⧉ КОПИРОВАТЬ</button><button type="button" id="deskPaste">⎘ ВСТАВИТЬ</button></div>
      </div>
      <div class="desk__torn" id="deskTorn" hidden></div>
      <div class="desk__rules" id="deskRules" hidden>
        <div class="desk__rule" data-color="white"><i class="desk__crate" data-c="white"></i><b>БЕЛЫЙ</b><span>→</span>
          <button type="button" data-set="take">ВЗЯТЬ</button><button type="button" data-set="leave">ОСТАВИТЬ</button></div>
        <div class="desk__rule" data-color="red"><i class="desk__crate" data-c="red"></i><b>КРАСНЫЙ</b><span>→</span>
          <button type="button" data-set="take">ВЗЯТЬ</button><button type="button" data-set="leave">ОСТАВИТЬ</button></div>
        <p class="desk__sentence" id="deskSentence"></p>
      </div>
      <div class="desk__choice" id="deskChoice" hidden><p id="deskQuestion"></p><div id="deskOptions"></div></div>
      <div class="desk__bridge" id="deskBridge" hidden></div>
      <div class="desk__tools" id="deskTools" hidden><button type="button" data-shift="all">⇥ ВСЁ ВПРАВО</button><button type="button" data-shift="line">⇥ СТРОЧКУ</button><button type="button" data-shift="back">⇤ СТРОЧКУ</button><span class="desk__tab">или Tab / Shift+Tab</span></div>
      <div class="desk__editor" id="deskEditor" hidden></div>
      <div class="desk__feedback" id="deskFeedback" role="status"></div>
      <div class="desk__actions"><button class="desk__hint" type="button" id="deskHint">ПОДСКАЗКА</button><button class="desk__run" type="button" id="deskRun">▶ ЗАПУСТИТЬ</button></div>
    </div>`;
  const $ = (s) => root.querySelector(s);
  const editor = createCodeEditor($('#deskEditor'), { label: 'Терминал руки 07', onRun: () => run(), onInput: () => { feedback(''); } });
  let step = null; let rules = { white: null, red: null }; let fails = 0; let hintLevel = 0; let busy = false; let choice = null;

  // 19.0 · week steps: the copy sheet, the torn sheet, by hand, the whole line.
  let pieceLine = null; let clip = ''; let marks = {}; let pasted = false;
  const sheetLine = root.querySelector('#deskSheetLine');
  function markStep(k) {
    if (k) marks[k] = true;
    for (const li of root.querySelectorAll('#deskSteps li')) li.dataset.done = String(Boolean(marks[li.dataset.k]));
  }
  function selectSheet() {
    try { const r = document.createRange(); r.selectNodeContents(sheetLine); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); } catch { /* old browsers */ }
    markStep('select');
  }
  sheetLine.addEventListener('keydown', (ev) => { if ((ev.ctrlKey || ev.metaKey) && ev.code === 'KeyA') { ev.preventDefault(); selectSheet(); } });
  sheetLine.addEventListener('click', () => { if (step === 'copy' && getSelection()?.isCollapsed) sheetLine.focus({ preventScroll: true }); });
  document.addEventListener('selectionchange', () => {
    if (step !== 'copy') return;
    const sel = getSelection();
    if (sel && !sel.isCollapsed && sheetLine.contains(sel.anchorNode) && sel.toString().includes('print')) markStep('select');
  });
  root.addEventListener('copy', () => {
    if (step !== 'copy') return;
    const sel = getSelection();
    if (sel && sheetLine.contains(sel.anchorNode)) { clip = sel.toString() || SHEET_LINE; markStep('select'); markStep('copy'); }
  });
  root.querySelector('#deskCopy').addEventListener('click', () => {
    selectSheet(); clip = SHEET_LINE;
    try { navigator.clipboard?.writeText(SHEET_LINE)?.catch?.(() => {}); } catch { /* no clipboard: our own buffer works */ }
    markStep('copy'); sound('ui-click');
    feedback('Скопировано. Теперь «ВСТАВИТЬ» — или Ctrl+V в поле ниже.', 'ok');
  });
  root.querySelector('#deskPaste').addEventListener('click', () => {
    if (!clip) { feedback('Сначала скопируй строчку с листка.', 'hint'); sound('blocked'); return; }
    const inp = editor.input; const a = inp.selectionStart ?? inp.value.length; const b = inp.selectionEnd ?? a;
    inp.value = inp.value.slice(0, a) + clip + inp.value.slice(b);
    inp.selectionStart = inp.selectionEnd = a + clip.length;
    inp.dispatchEvent(new Event('input'));
    pasted = true; markStep('paste'); sound('ui-click');
    feedback('Вставлено. Жми «▶ ОТПРАВИТЬ РУКЕ».', 'ok');
  });
  editor.input.addEventListener('paste', () => { if (step === 'copy') { pasted = true; markStep('paste'); } });

  for (const b of root.querySelectorAll('#deskTools [data-shift]')) {
    b.addEventListener('click', () => {
      const inp = editor.input;
      if (b.dataset.shift === 'all') { inp.selectionStart = 0; inp.selectionEnd = inp.value.length; }
      editor.shiftLines(b.dataset.shift === 'back');
      inp.focus({ preventScroll: true }); sound('ui-click');
    });
  }
  function openWeek(meta) {
    root.querySelector('.desk__floors').hidden = true;
    const wk = root.querySelector('#deskWeek'); wk.hidden = false;
    for (const li of wk.children) { const d = Number(li.dataset.day); li.dataset.state = d < meta.week ? 'done' : (d === meta.week ? 'now' : 'next'); }
    const story = WEEK_STORY[step];
    root.querySelector('#deskStory').innerHTML = story ? `<div class="desk__long">${story.long}</div><div class="desk__short">${story.short}</div>` : '';
    for (const id of ['#deskRules', '#deskBridge', '#deskChoice']) root.querySelector(id).hidden = true;
    root.querySelector('#deskSheet').hidden = step !== 'copy';
    root.querySelector('#deskTorn').hidden = step !== 'assemble';
    root.querySelector('#deskEditor').hidden = step === 'assemble';
    root.querySelector('#deskHint').hidden = step === 'assemble';
    root.querySelector('#deskTools').hidden = step !== 'auto';
    marks = {}; pasted = false; markStep(null);
    const run = root.querySelector('#deskRun');
    run.disabled = false;
    run.textContent = { copy: '▶ ОТПРАВИТЬ РУКЕ', assemble: '▶ ЗАПУСТИТЬ', hand: '▶ ЗАПУСТИТЬ ПРАВИЛО', auto: '▶ ЗАПУСТИТЬ ВСЮ ЛИНИЮ' }[step];
    if (step === 'assemble') {
      if (!pieceLine) pieceLine = createPieceLine(root.querySelector('#deskTorn'), { slots: ASSEMBLE.slots, pieces: ASSEMBLE.pieces, sound, onChange: () => feedback('') });
      else pieceLine.reset();
      return;
    }
    editor.setPasteAllowed(meta.paste !== false, 'Вставка выключена: сегодня — только твои руки. Это две строчки.');
    editor.input.placeholder = { copy: 'Сюда вставь строчку с листка: Ctrl+V или «ВСТАВИТЬ»', hand: 'Пиши здесь: две строчки', auto: '' }[step] ?? '';
    // Day 5: yesterday's rule is already inside (4 spaces right), with an
    // empty line above it for the one new line.
    editor.value = step === 'auto' ? `\n${HAND_RULE.split('\n').map((l) => `    ${l}`).join('\n')}` : '';
    setTimeout(() => {
      if (step === 'copy') sheetLine.focus({ preventScroll: true });
      else { editor.focus(); try { editor.input.setSelectionRange(0, 0); } catch { /* hidden */ } }
    }, 30);
  }
  function weekDone(result) {
    busy = true; sound('power');
    onWeek({ step, result, hints: hintLevel, fails });
    setTimeout(close, 900);
  }
  function runWeek() {
    const source = editor.value;
    if (step === 'copy') {
      const r = checkWake(source);
      editor.setDiagnostics(r.ok ? [] : r.diagnostics);
      if (!r.ok) {
        fails += 1; sound('blocked');
        feedback(fails >= 2 ? 'Строчка должна быть точь-в-точь как на листке. Скопируй её целиком ещё раз и вставь.' : 'Рука не поняла. Сверь с листком — подчёркнуто, где не так.', 'error');
        return;
      }
      feedback('Терминал: wake · рука проснулась', 'ok');
      weekDone({ source, pasted });
      return;
    }
    const colors = getColors();
    if (step === 'assemble') {
      const st = pieceLine.state();
      const v = judgeAssemble(st.placed, st.typed);
      if (!v.ok) { fails += 1; pieceLine.mark(v.wrong); sound('blocked'); feedback(v.text, v.code === 'typed-red' ? 'fine' : 'error'); return; }
      const r = runRule(v.source, colors.length ? colors : ['white', 'red', 'white']);
      if (!r.ok) { fails += 1; sound('blocked'); feedback(r.diagnostics[0]?.message ?? 'Не сработало.', 'error'); return; }
      feedback(v.text, 'ok');
      weekDone({ decisions: r.decisions, source: v.source });
      return;
    }
    if (step === 'hand') {
      const r = runRule(source, colors.length ? colors : ['white', 'red', 'white']);
      editor.setDiagnostics(r.ok ? [] : r.diagnostics);
      if (!r.ok) {
        fails += 1; sound('blocked');
        const code = r.diagnostics[0]?.code;
        feedback(code === 'took-red' ? 'ШТРАФ на словах: рука взяла бы красный. Проверь слово в кавычках.' : (fails >= 2 ? 'Не вышло. Смотри подчёркнутое или нажми «ПОДСКАЗКА».' : 'Правило не сработало. Смотри подчёркнутое.'), code === 'took-red' ? 'fine' : 'error');
        return;
      }
      feedback('Правило принято: белые — на ленту, красные — стоят.', 'ok');
      weekDone({ decisions: r.decisions, source });
      return;
    }
    if (step === 'auto') {
      const r = runForLesson(source, colors, { needIf: true });
      editor.setDiagnostics(r.ok ? [] : r.diagnostics);
      if (!r.ok) {
        fails += 1; sound('blocked');
        const code = r.diagnostics[0]?.code;
        feedback(code === 'took-red' ? 'ШТРАФ на словах: рука унесла бы красный.' : (fails >= 2 ? 'Не вышло. Смотри подчёркнутое или нажми «ПОДСКАЗКА».' : 'Линия не пошла. Смотри подчёркнутое.'), code === 'took-red' ? 'fine' : 'error');
        return;
      }
      feedback('Линия пошла. Смотри на руку.', 'ok');
      weekDone({ taken: r.taken, source });
    }
  }

  function feedback(text, tone = '') { const f = $('#deskFeedback'); f.textContent = text; f.dataset.tone = tone; }
  function setFloors(active) {
    for (const li of root.querySelectorAll('.desk__floors li')) {
      const order = ['tap', 'knobs', 'code'];
      li.dataset.state = order.indexOf(li.dataset.f) < order.indexOf(active) ? 'done' : (li.dataset.f === active ? 'now' : 'next');
    }
  }
  function syncRules() {
    for (const row of root.querySelectorAll('.desk__rule')) {
      for (const b of row.querySelectorAll('button')) b.setAttribute('aria-pressed', String(rules[row.dataset.color] === b.dataset.set));
    }
    $('#deskSentence').textContent = rules.white && rules.red ? ruleSentence(rules) : 'Нажми для каждого цвета: брать или оставить.';
    $('#deskRun').disabled = !(rules.white && rules.red);
  }
  for (const row of root.querySelectorAll('.desk__rule')) {
    for (const b of row.querySelectorAll('button')) b.addEventListener('click', () => { rules[row.dataset.color] = b.dataset.set; sound('ui-click'); syncRules(); feedback(''); });
  }

  const STORY = {
    print: `<p><b>Что делает кнопка?</b> Внутри неё — одна строчка. Она <em>печатает</em> руке слово <code>wake</code> («проснись»). Рука слушает терминал: услышала слово — работает.</p>
      <p class="desk__wire"><span class="desk__btn" aria-hidden="true"></span><i>→</i><code>print("wake")</code><i>→</i><span>РУКА 07</span></p>
      <p><b>print</b> — значит «напечатай». В скобках и кавычках — само слово. Напиши это вместо кнопки. Можно скопировать строчку выше.</p>`,
    print2: `<p>Начальник унёс кнопку с собой... то есть швырнул на пол. Но рука слушает <em>не кнопку</em>, а терминал.</p><p>Скажи ей то же слово ещё раз — по памяти.</p>`,
    rules: `<p>Начальник: «Рука тащит всё подряд. Таскай <b>только белые</b>. Увижу красный на ленте — <b>штраф</b>».</p><p>У руки есть панель правил. Реши для каждого цвета, что делать.</p>`,
    if: '',
  };

  function bridge(sentence) {
    return `<p>Панели правил завтра не будет (начальник уже косится). Скажи правило <b>словами Python</b>:</p>
      <table class="desk__map"><tr><td>ЕСЛИ</td><td><code>if</code></td></tr><tr><td>ящик белый</td><td><code>box == "white"</code></td></tr><tr><td>то</td><td><code>:</code> и отступ 4 пробела</td></tr><tr><td>ВЗЯТЬ</td><td><code>arm.take()</code></td></tr></table>
      <p class="desk__said">Твоё правило: ${sentence}</p>`;
  }

  function plainView() {
    root.querySelector('.desk__floors').hidden = false;
    for (const id of ['#deskWeek', '#deskSheet', '#deskTorn', '#deskTools']) root.querySelector(id).hidden = true;
    editor.input.placeholder = '';
  }
  function openLesson(meta) {
    plainView();
    $('#deskStory').innerHTML = LESSON_STORY[step] ?? '';
    $('#deskRules').hidden = true; $('#deskBridge').hidden = true;
    $('#deskEditor').hidden = meta.kind !== 'code';
    $('#deskChoice').hidden = meta.kind !== 'choice';
    $('#deskHint').hidden = meta.kind !== 'code';
    setFloors(meta.f);
    choice = null;
    if (meta.kind === 'choice') {
      const panel = PANELS[meta.panel];
      $('#deskQuestion').textContent = panel.question;
      $('#deskOptions').innerHTML = panel.options.map(([id, label]) => `<button type="button" data-choice="${id}" aria-pressed="false">${label}</button>`).join('');
      for (const b of root.querySelectorAll('[data-choice]')) b.addEventListener('click', () => { choice = b.dataset.choice; sound('ui-click'); for (const o of root.querySelectorAll('[data-choice]')) o.setAttribute('aria-pressed', String(o === b)); $('#deskRun').disabled = false; feedback(''); });
      $('#deskRun').disabled = true;
      $('#deskRun').textContent = '▶ ВКЛЮЧИТЬ';
    } else if (meta.kind === 'button') {
      $('#deskRun').disabled = false;
      $('#deskRun').textContent = meta.button;
    } else {
      editor.setPasteAllowed(meta.paste, PASTE_WHY);
      editor.value = '';
      $('#deskRun').disabled = false;
      $('#deskRun').textContent = '▶ ЗАПУСТИТЬ ПРАВИЛО';
      setTimeout(() => { editor.focus(); try { if (innerHeight < 520) editor.input.scrollIntoView({ block: 'center' }); } catch { /* old browsers */ } }, 30);
    }
  }

  function open(nextStep, ctx = {}) {
    step = nextStep; fails = 0; hintLevel = 0; busy = false;
    const meta = DESK_STEPS[step];
    if (!meta) return;
    if (meta.kind === 'week') {
      root.hidden = false; root.dataset.step = step;
      $('#deskTitle').textContent = meta.title;
      $('#deskFloor').textContent = `ТЕРМИНАЛ РУКИ 07 · ${meta.floor}`;
      feedback('');
      openWeek(meta);
      root.querySelector('.desk__card').scrollTop = 0;
      return;
    }
    if (meta.kind) {
      root.hidden = false; root.dataset.step = step;
      $('#deskTitle').textContent = meta.title;
      $('#deskFloor').textContent = `ТЕРМИНАЛ РУКИ 07 · ${meta.floor}`;
      feedback('');
      openLesson(meta);
      root.querySelector('.desk__card').scrollTop = 0;
      return;
    }
    $('#deskChoice').hidden = true;
    plainView();
    root.hidden = false; root.dataset.step = step;
    $('#deskTitle').textContent = meta.title;
    $('#deskFloor').textContent = `ТЕРМИНАЛ РУКИ 07 · ${meta.floor}`;
    $('#deskStory').innerHTML = STORY[step] ?? '';
    $('#deskRules').hidden = step !== 'rules';
    $('#deskEditor').hidden = step === 'rules';
    $('#deskBridge').hidden = step !== 'if';
    if (step === 'if') $('#deskBridge').innerHTML = bridge(ctx.sentence ?? ruleSentence({ white: 'take', red: 'leave' }));
    setFloors(step === 'rules' ? 'knobs' : 'code');
    feedback('');
    $('#deskHint').hidden = step === 'rules';
    $('#deskRun').textContent = step === 'rules' ? '▶ ВКЛЮЧИТЬ ПРАВИЛО' : (step === 'if' ? '▶ ПРОВЕРИТЬ ПРАВИЛО' : '▶ СКАЗАТЬ РУКЕ');
    editor.setPasteAllowed(meta.paste, PASTE_WHY);
    if (step === 'rules') { rules = { white: null, red: null }; syncRules(); }
    else {
      editor.value = '';
      $('#deskRun').disabled = false;
      setTimeout(() => { editor.focus(); try { if (innerHeight < 520) editor.input.scrollIntoView({ block: 'center' }); } catch { /* old browsers */ } }, 30);
    }
    root.querySelector('.desk__card').scrollTop = 0;
  }
  function close() { if (!root.hidden) { root.hidden = true; step = null; onClose(); } }

  function hint() {
    hintLevel += 1;
    sound('poster');
    if (WEEK_HINTS[step]) { feedback(WEEK_HINTS[step][Math.min(WEEK_HINTS[step].length - 1, hintLevel - 1)], 'hint'); return; }
    if (step === 'print' || step === 'print2') feedback(hintLevel === 1 ? 'Слово — wake. Команда «напечатать» — print. Слово берут в кавычки и скобки.' : 'Вот целиком: print("wake")', 'hint');
    else if (step === 'if') feedback(hintLevel === 1 ? 'Первая строка: if box == "white":   (двоеточие в конце!)' : 'Вторая строка с 4 пробелами в начале:     arm.take()', 'hint');
    else if (step === 'for-code') feedback(hintLevel === 1 ? 'Первая строка: for box in boxes:' : 'Вторая, с отступом:     arm.take(box)', 'hint');
    else if (step === 'for-combo') feedback(hintLevel === 1 ? 'for box in boxes:  →  внутри  if box == "white":' : 'Третья строка — 8 пробелов:         arm.take(box)', 'hint');
    else if (step === 'while-code') feedback(hintLevel === 1 ? 'while queue:  →  внутри  box = queue.pop(0)' : 'Дальше как днём: if box == "white": и внутри arm.take(box)', 'hint');
    else if (step === 'def-code') feedback(hintLevel === 1 ? 'def route(batch):  — а внутри твой for с if (для batch)' : 'В конце без отступа: route(line_a) и route(line_b)', 'hint');
  }

  function lessonDone(result, delay = 900) {
    const [lesson, stage] = step.split('-');
    busy = true; sound('power');
    onLesson({ lesson, stage, result, hints: hintLevel, choice });
    setTimeout(close, delay);
  }

  async function run() {
    if (busy || !step) return;
    const meta = DESK_STEPS[step];
    if (meta?.kind === 'week') { runWeek(); return; }
    if (meta?.kind === 'button') { feedback('Рука пошла по партии.', 'ok'); lessonDone({}); return; }
    if (meta?.kind === 'choice') {
      if (!choice) return;
      const n = getColors().length;
      const verdict = meta.panel === 'for' ? judgeForPanel(choice, n) : (meta.panel === 'while' ? judgeWhilePanel(choice, n) : judgeDefPanel(choice));
      feedback(verdict.text, verdict.ok ? 'ok' : 'error');
      if (!verdict.ok) { sound('blocked'); return; }
      lessonDone({}, 1400);
      return;
    }
    if (meta?.kind === 'code') {
      const source = editor.value;
      const colors = getColors();
      const r = step.startsWith('for') ? runForLesson(source, colors, { needIf: step === 'for-combo' })
        : step.startsWith('while') ? runWhileLesson(source, colors)
          : runDefLesson(source, getLines().a, getLines().b);
      editor.setDiagnostics(r.ok ? [] : r.diagnostics);
      if (!r.ok) {
        fails += 1; sound('blocked');
        const code = r.diagnostics[0]?.code;
        feedback(code === 'took-red' ? 'ШТРАФ на словах: рука взяла бы красный.' : (fails >= 2 ? 'Не вышло. Смотри подчёркнутое или нажми «ПОДСКАЗКА».' : 'Правило не сработало. Смотри подчёркнутое.'), code === 'took-red' ? 'fine' : 'error');
        return;
      }
      feedback('Правило принято. Смотри на руку.', 'ok');
      lessonDone(r);
      return;
    }
    if (step === 'rules') {
      const verdict = judgeRules(rules);
      feedback(verdict.text, verdict.ok ? 'ok' : (verdict.fine ? 'fine' : 'error'));
      sound(verdict.ok ? 'power' : 'blocked');
      onRules({ ...rules }, verdict);
      if (verdict.ok) { busy = true; setTimeout(close, 900); }
      return;
    }
    const source = editor.value;
    if (step === 'print' || step === 'print2') {
      const r = checkWake(source);
      editor.setDiagnostics(r.ok ? [] : r.diagnostics);
      if (!r.ok) {
        fails += 1; sound('blocked');
        feedback(fails >= 2 ? 'Не вышло. Нажми «ПОДСКАЗКА», если застрял.' : 'Рука не поняла. Смотри подчёркнутое — там и ошибка.', 'error');
        return;
      }
      feedback(`Терминал: ${r.heard} · Рука 07 проснулась`, 'ok'); sound('power');
      busy = true; onWake(source);
      setTimeout(close, 700);
      return;
    }
    if (step === 'if') {
      const colors = getColors();
      const r = runRule(source, colors.length ? colors : ['white', 'red', 'white']);
      editor.setDiagnostics(r.ok ? [] : r.diagnostics);
      if (!r.ok) {
        fails += 1; sound('blocked');
        const code = r.diagnostics[0]?.code;
        feedback(code === 'took-red' ? 'ШТРАФ на словах: рука взяла бы красный. Проверь условие.' : 'Правило не сработало. Смотри подчёркнутое.', code === 'took-red' ? 'fine' : 'error');
        return;
      }
      feedback('Правило принято: белые — на ленту, красные — стоят.', 'ok'); sound('power');
      busy = true; onRule(r.decisions, source);
      setTimeout(close, 900);
    }
  }

  $('#deskRun').addEventListener('click', run);
  $('#deskHint').addEventListener('click', hint);
  root.querySelector('.desk__close').addEventListener('click', close);
  root.addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.preventDefault(); close(); } event.stopPropagation(); });

  return { open, close, isOpen: () => !root.hidden, step: () => step, editor, run, rules: () => ({ ...rules }), hints: () => hintLevel };
}
