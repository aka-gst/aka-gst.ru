// 18.0: an IDE-like editor for the first hour (Сергей 03.10: «ошибки
// объяснять как нормальная IDE — строка, что не так, как исправить»).
//
// A plain <textarea> stays the input (phones, screen readers, IME all work);
// behind it a mirror <pre> draws a red squiggle under the exact columns, the
// gutter numbers lines and marks the broken one, and a problems strip says
// «Строка 1, символ 7: … → как исправить». On the hardest steps paste and
// drop are switched off, and the editor says why instead of failing silently.

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

export function createCodeEditor(host, { label = 'Код', onInput = () => {}, onRun = null } = {}) {
  host.classList.add('ce');
  host.innerHTML = `
    <div class="ce__box">
      <ol class="ce__gutter" aria-hidden="true"></ol>
      <div class="ce__stack">
        <pre class="ce__mirror" aria-hidden="true"></pre>
        <textarea class="ce__input" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" aria-label="${esc(label)}"></textarea>
      </div>
    </div>
    <p class="ce__notice" role="status" hidden></p>
    <div class="ce__problems" role="alert" hidden></div>`;
  const input = host.querySelector('.ce__input');
  const mirror = host.querySelector('.ce__mirror');
  const gutter = host.querySelector('.ce__gutter');
  const problems = host.querySelector('.ce__problems');
  const notice = host.querySelector('.ce__notice');
  let diagnostics = [];
  let pasteAllowed = true;
  let pasteWhy = '';

  function render() {
    const lines = input.value.split('\n');
    const bad = new Map(diagnostics.map((d) => [d.line, d]));
    gutter.innerHTML = lines.map((_, i) => `<li data-bad="${bad.has(i + 1)}">${i + 1}</li>`).join('');
    mirror.innerHTML = lines.map((text, i) => {
      const d = bad.get(i + 1);
      if (!d) return esc(text) || ' ';
      const from = Math.max(0, Math.min(text.length, d.col - 1));
      let to = Math.max(from + 1, Math.min(text.length, (d.endCol ?? d.col + 1) - 1));
      // An error past the end of the line (a missing colon, a missing quote)
      // squiggles one blank cell where the character should be.
      const pad = to > text.length ? ' '.repeat(to - text.length) : '';
      const full = text + pad;
      to = Math.min(full.length, to);
      return `${esc(full.slice(0, from))}<mark class="ce__squiggle" title="${esc(d.message)}">${esc(full.slice(from, to)) || ' '}</mark>${esc(full.slice(to))}`;
    }).join('\n') + '\n';
    mirror.scrollTop = input.scrollTop; mirror.scrollLeft = input.scrollLeft;
    if (!diagnostics.length) { problems.hidden = true; problems.innerHTML = ''; return; }
    problems.hidden = false;
    problems.innerHTML = diagnostics.slice(0, 3).map((d) => `<p><b>Строка ${d.line}, символ ${d.col}</b> ${esc(d.message)}${d.fix ? `<span>→ ${esc(d.fix)}</span>` : ''}</p>`).join('');
  }

  function say(text, ms = 4200) {
    notice.textContent = text; notice.hidden = false;
    clearTimeout(say.t); say.t = setTimeout(() => { notice.hidden = true; }, ms);
  }

  // Move the selected lines (or the caret's line) right by 4 spaces, or left.
  function shiftLines(back = false) {
    const { selectionStart: a, selectionEnd: b, value } = input;
    const from = value.lastIndexOf('\n', a - 1) + 1;
    let to = b > a && value[b - 1] === '\n' ? b - 1 : b;
    const end = value.indexOf('\n', to); to = end < 0 ? value.length : end;
    const lines = value.slice(from, to).split('\n');
    const moved = lines.map((l) => (back ? l.replace(/^ {1,4}/, '') : `    ${l}`)).join('\n');
    input.value = value.slice(0, from) + moved + value.slice(to);
    input.selectionStart = from; input.selectionEnd = from + moved.length;
    input.dispatchEvent(new Event('input'));
  }
  input.addEventListener('input', () => { diagnostics = []; render(); onInput(input.value); });
  input.addEventListener('scroll', () => { mirror.scrollTop = input.scrollTop; mirror.scrollLeft = input.scrollLeft; });
  input.addEventListener('keydown', (event) => {
    event.stopPropagation(); // WASD in the editor must not walk the player
    if (event.key === 'Tab') {
      event.preventDefault();
      const { selectionStart: a, selectionEnd: b, value } = input;
      // 19.0: several lines selected — move them all right (Shift+Tab: left),
      // like every IDE. Day 5 needs it: the rule goes inside the loop.
      if (value.slice(a, b).includes('\n') || event.shiftKey) { shiftLines(event.shiftKey); return; }
      input.value = `${value.slice(0, a)}    ${value.slice(b)}`;
      input.selectionStart = input.selectionEnd = a + 4;
      input.dispatchEvent(new Event('input'));
    } else if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
      // Auto-indent after a line ending with ':' — what every IDE does.
      const { selectionStart: a, value } = input;
      const lineStart = value.lastIndexOf('\n', a - 1) + 1;
      const line = value.slice(lineStart, a);
      const indent = line.match(/^ */)[0] + (/:\s*$/.test(line) ? '    ' : '');
      if (indent) {
        event.preventDefault();
        input.value = `${value.slice(0, a)}\n${indent}${value.slice(input.selectionEnd)}`;
        input.selectionStart = input.selectionEnd = a + 1 + indent.length;
        input.dispatchEvent(new Event('input'));
      }
    } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && onRun) {
      event.preventDefault(); onRun();
    }
  });
  const block = (event) => {
    if (pasteAllowed) return;
    event.preventDefault();
    say(pasteWhy || 'Вставка здесь выключена — набери руками.');
  };
  input.addEventListener('paste', block);
  input.addEventListener('drop', block);
  input.addEventListener('beforeinput', (event) => {
    if (!pasteAllowed && ['insertFromPaste', 'insertFromDrop', 'insertFromPasteAsQuotation'].includes(event.inputType)) block(event);
  });

  render();
  return {
    input,
    get value() { return input.value; },
    set value(v) { input.value = v; diagnostics = []; render(); },
    setDiagnostics(list = []) {
      diagnostics = list;
      render();
      const first = list[0];
      if (first) {
        // Put the caret on the broken spot, like an IDE jumping to an error.
        const lines = input.value.split('\n');
        let offset = 0;
        for (let i = 0; i < Math.min(first.line - 1, lines.length); i++) offset += lines[i].length + 1;
        const pos = Math.min(input.value.length, offset + Math.max(0, first.col - 1));
        try { input.setSelectionRange(pos, pos); } catch { /* hidden */ }
        // On a short phone screen the card scrolls: bring the error into view.
        try { problems.scrollIntoView({ block: 'nearest' }); } catch { /* old browsers */ }
      }
    },
    diagnostics: () => diagnostics.slice(),
    setPasteAllowed(allowed, why = '') { pasteAllowed = Boolean(allowed); pasteWhy = why; host.dataset.paste = pasteAllowed ? 'on' : 'off'; },
    pasteAllowed: () => pasteAllowed,
    focus() { input.focus({ preventScroll: true }); },
    shiftLines,
    say,
  };
}
