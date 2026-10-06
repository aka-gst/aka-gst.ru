// 18.0: a tiny Python for the first hour. Сергей 03.10: «print("wake")
// написал — не запустилось» and «ошибки объяснять как нормальная IDE».
//
// The first lessons (print, if) must work instantly and offline, without the
// 13 MB Pyodide download that the static page may not even have, and every
// mistake must point at a line and column and say in plain Russian what is
// wrong and how to fix it. This is a real (small) subset of Python, not a
// regex: it tokenizes, checks indentation, parses statements and runs them.
//
// Subset: expression statements and calls, `name = expr`, if / elif / else,
// for x in <list|range>, while (capped), pass, strings, numbers, True/False/
// None, == != < > <= >= + - * / % , and/or/not, attribute calls (arm.take()).
//
// API:
//   check(source, { names })         -> { ok, diagnostics, program }
//   run(source, { names, env, maxSteps }) -> { ok, stdout, diagnostics, steps }
// A diagnostic: { line, col, endCol, message, fix, code } (1-based line/col).

const KEYWORDS = new Set(['if', 'elif', 'else', 'for', 'in', 'while', 'def', 'return', 'and', 'or', 'not', 'pass', 'True', 'False', 'None', 'break', 'continue']);
const BLOCK_KEYWORDS = new Set(['if', 'elif', 'else', 'for', 'while', 'def']);
export const BUILTINS = Object.freeze(['print', 'len', 'range', 'str', 'int']);

// Russian keyboard layout -> Latin, to catch «зкште» typed instead of print.
const RU_TO_EN = Object.fromEntries([...'йцукенгшщзхъфывапролджэячсмитьбю'].map((ch, i) => [ch, 'qwertyuiop[]asdfghjkl;\'zxcvbnm,.'[i]]));
export function fromRussianLayout(word) {
  return [...String(word)].map((ch) => RU_TO_EN[ch.toLowerCase()] ?? ch).join('');
}

export function levenshtein(a, b) {
  const m = a.length; const n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return d[m][n];
}

export function didYouMean(word, candidates) {
  const lower = word.toLowerCase();
  const exactCase = candidates.find((c) => c.toLowerCase() === lower);
  if (exactCase) return { name: exactCase, why: 'case' };
  const layout = fromRussianLayout(word);
  if (layout !== word) {
    const hit = candidates.find((c) => c === layout || c.toLowerCase() === layout.toLowerCase());
    if (hit) return { name: hit, why: 'layout' };
  }
  let best = null; let bestD = Infinity;
  for (const c of candidates) {
    const dist = levenshtein(lower, c.toLowerCase());
    if (dist < bestD) { best = c; bestD = dist; }
  }
  if (best && bestD <= (best.length <= 3 ? 1 : 2)) return { name: best, why: 'typo' };
  return null;
}

class PyError extends Error {
  constructor(line, col, message, fix = '', code = 'error', endCol = null) {
    super(message);
    this.diag = { line, col, endCol: endCol ?? col + 1, message, fix, code };
  }
}

// Smart quotes from phones and Word become plain quotes: that is what the
// player meant, and Python on a real keyboard would get exactly that.
export function normalizeSource(source) {
  return String(source ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[“”„«»]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/ /g, ' ');
}

// ------------------------------------------------------------------ lexer --

function tokenizeLine(text, lineNo) {
  const tokens = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    const col = i + 1;
    if (ch === ' ' || ch === '\t') { i++; continue; }
    if (ch === '#') break;
    if (ch === '"' || ch === "'") {
      const end = text.indexOf(ch, i + 1);
      if (end < 0) {
        const other = ch === '"' ? "'" : '"';
        const closeOther = text.indexOf(other, i + 1);
        throw new PyError(lineNo, col, closeOther >= 0
          ? `Кавычки разные: открыл ${ch}, а закрыл ${other}. Python так не понимает.`
          : `Кавычка ${ch} открыта, но не закрыта до конца строки.`,
        closeOther >= 0 ? `Сделай обе кавычки одинаковыми: ${ch}…${ch}.` : `Допиши закрывающую ${ch} сразу после слова.`, 'unclosed-string', text.length + 1);
      }
      tokens.push({ type: 'str', value: text.slice(i + 1, end), line: lineNo, col, endCol: end + 2 });
      i = end + 1; continue;
    }
    if (/[0-9]/.test(ch)) {
      let j = i; while (j < text.length && /[0-9.]/.test(text[j])) j++;
      tokens.push({ type: 'num', value: Number(text.slice(i, j)), line: lineNo, col, endCol: j + 1 });
      i = j; continue;
    }
    if (/[A-Za-z_Ѐ-ӿ]/.test(ch)) {
      let j = i; while (j < text.length && /[A-Za-z0-9_Ѐ-ӿ]/.test(text[j])) j++;
      const word = text.slice(i, j);
      tokens.push({ type: KEYWORDS.has(word) ? 'kw' : 'name', value: word, line: lineNo, col, endCol: j + 1 });
      i = j; continue;
    }
    const two = text.slice(i, i + 2);
    if (['==', '!=', '<=', '>='].includes(two)) { tokens.push({ type: 'op', value: two, line: lineNo, col, endCol: col + 2 }); i += 2; continue; }
    if ('()[],.:=<>+-*/%'.includes(ch)) { tokens.push({ type: 'op', value: ch, line: lineNo, col, endCol: col + 1 }); i++; continue; }
    throw new PyError(lineNo, col, `Знак «${ch}» Python здесь не понимает.`, ch === ';' ? 'Точка с запятой не нужна — просто убери её.' : 'Убери этот знак.', 'bad-char');
  }
  return tokens;
}

function lex(source) {
  const lines = normalizeSource(source).split('\n');
  const out = [];
  lines.forEach((text, idx) => {
    const lineNo = idx + 1;
    if (!text.trim() || text.trim().startsWith('#')) return;
    const indentText = text.match(/^[ \t]*/)[0];
    if (indentText.includes('\t')) {
      throw new PyError(lineNo, 1, 'В отступе стоит табуляция. Здесь отступ — это пробелы.', 'Сотри отступ и поставь 4 пробела.', 'tab-indent', indentText.length + 1);
    }
    out.push({ lineNo, indent: indentText.length, tokens: tokenizeLine(text, lineNo), text });
  });
  return out;
}

// ----------------------------------------------------------------- parser --

function parseExpression(tokens, pos, ctx) {
  let p = pos;
  const peek = () => tokens[p];
  const at = (type, value) => tokens[p] && tokens[p].type === type && (value === undefined || tokens[p].value === value);
  const lastCol = () => (tokens[p - 1]?.endCol ?? 1);

  function primary() {
    const t = peek();
    if (!t) throw new PyError(ctx.line, lastCol(), 'Строка оборвалась: не хватает значения.', 'Допиши, с чем сравнить или что передать.', 'eol');
    if (t.type === 'str') { p++; return { k: 'lit', v: t.value, t }; }
    if (t.type === 'num') { p++; return { k: 'lit', v: t.value, t }; }
    if (t.type === 'kw' && ['True', 'False', 'None'].includes(t.value)) { p++; return { k: 'lit', v: t.value === 'True' ? true : (t.value === 'False' ? false : null), t }; }
    if (t.type === 'name') { p++; return { k: 'name', name: t.value, t }; }
    if (t.type === 'op' && t.value === '(') {
      p++;
      const inner = or();
      if (!at('op', ')')) throw new PyError(t.line, t.col, 'Скобка ( открыта, но не закрыта.', 'Добавь ) в конце.', 'unclosed-paren', lastCol());
      p++;
      return inner;
    }
    if (t.type === 'op' && t.value === '[') {
      p++;
      const items = [];
      while (!at('op', ']')) {
        if (!peek()) throw new PyError(t.line, t.col, 'Квадратная скобка [ не закрыта.', 'Добавь ] в конце списка.', 'unclosed-bracket', lastCol());
        items.push(or());
        if (at('op', ',')) p++;
      }
      p++;
      return { k: 'list', items, t };
    }
    if (t.type === 'kw') throw new PyError(t.line, t.col, `Слово «${t.value}» здесь не к месту.`, 'Проверь порядок слов в строке.', 'kw-misplaced', t.endCol);
    throw new PyError(t.line, t.col, `Знак «${t.value}» здесь не ожидался.`, 'Проверь строку: возможно, знак лишний.', 'unexpected', t.endCol);
  }

  function postfix() {
    let node = primary();
    for (;;) {
      if (at('op', '.')) {
        p++;
        const nameTok = peek();
        if (!nameTok || nameTok.type !== 'name') throw new PyError(ctx.line, lastCol(), 'После точки нужно имя команды.', 'Например: arm.take()', 'attr');
        p++;
        node = { k: 'attr', obj: node, name: nameTok.value, t: nameTok };
        continue;
      }
      if (at('op', '(')) {
        const open = peek();
        p++;
        const args = [];
        while (!at('op', ')')) {
          if (!peek()) throw new PyError(open.line, open.col, 'Скобка ( открыта, но не закрыта.', 'Добавь ) в конце строки.', 'unclosed-paren', lastCol());
          args.push(or());
          if (at('op', ',')) { p++; continue; }
          if (!at('op', ')')) {
            const t = peek();
            if (t?.type === 'name' || t?.type === 'str') throw new PyError(t.line, t.col, 'Между значениями в скобках нужна запятая.', 'Поставь запятую или убери лишнее.', 'comma', t.endCol);
          }
        }
        p++;
        node = { k: 'call', fn: node, args, t: open };
        continue;
      }
      return node;
    }
  }

  function unary() {
    if (at('kw', 'not')) { const t = peek(); p++; return { k: 'not', v: unary(), t }; }
    if (at('op', '-')) { const t = peek(); p++; return { k: 'neg', v: unary(), t }; }
    return postfix();
  }
  function term() {
    let left = unary();
    while (at('op', '*') || at('op', '/') || at('op', '%')) { const t = peek(); p++; left = { k: 'bin', op: t.value, a: left, b: unary(), t }; }
    return left;
  }
  function arith() {
    let left = term();
    while (at('op', '+') || at('op', '-')) { const t = peek(); p++; left = { k: 'bin', op: t.value, a: left, b: term(), t }; }
    return left;
  }
  function compare() {
    let left = arith();
    while (peek()?.type === 'op' && ['==', '!=', '<', '>', '<=', '>='].includes(peek().value)) {
      const t = peek(); p++;
      left = { k: 'bin', op: t.value, a: left, b: arith(), t };
    }
    if (at('kw', 'in')) { const t = peek(); p++; left = { k: 'bin', op: 'in', a: left, b: arith(), t }; }
    return left;
  }
  function and() {
    let left = compare();
    while (at('kw', 'and')) { const t = peek(); p++; left = { k: 'and', a: left, b: compare(), t }; }
    return left;
  }
  function or() {
    let left = and();
    while (at('kw', 'or')) { const t = peek(); p++; left = { k: 'or', a: left, b: and(), t }; }
    return left;
  }
  const node = or();
  return { node, pos: p };
}

function expectEnd(tokens, pos, line) {
  const t = tokens[pos];
  if (!t) return;
  if (t.type === 'str' || t.type === 'name') {
    throw new PyError(line, t.col, 'Тут два значения подряд, а между ними ничего нет.', 'Если это сообщение для print — оно должно быть внутри скобок: print("…").', 'two-values', t.endCol);
  }
  throw new PyError(line, t.col, `Лишнее в конце строки: «${t.value}».`, 'Убери лишние знаки.', 'trailing', t.endCol);
}

function parseLines(lines) {
  let i = 0;
  function block(indent) {
    const body = [];
    while (i < lines.length) {
      const L = lines[i];
      if (L.indent < indent) break;
      if (L.indent > indent) {
        throw new PyError(L.lineNo, 1, 'Лишний отступ в начале строки.', body.length ? 'Сделай отступ таким же, как у строки выше.' : 'Убери пробелы в начале строки — отступ нужен только внутри if / for.', 'unexpected-indent', L.indent + 1);
      }
      body.push(statement(L, indent));
    }
    return body;
  }
  function childBlock(header, indent) {
    i++;
    const next = lines[i];
    if (!next || next.indent <= indent) {
      const kw = header.tokens[0].value;
      if (next) {
        throw new PyError(next.lineNo, 1, `Эта строка — внутри «${kw}», значит, ей нужен отступ.`,
          'Поставь 4 пробела в начале строки.', 'expected-indent', next.indent + 2);
      }
      throw new PyError(header.lineNo, header.text.length, `После «${kw} …:» нужна строка с отступом — что делать.`,
        'Нажми Enter и начни новую строку с 4 пробелов, например:     arm.take()', 'expected-indent', header.text.length + 1);
    }
    return block(next.indent);
  }
  function header(L, kwTok) {
    const toks = L.tokens;
    const last = toks[toks.length - 1];
    if (!last || !(last.type === 'op' && last.value === ':')) {
      const col = (last?.endCol ?? L.text.length + 1);
      throw new PyError(L.lineNo, col, `В конце строки с «${kwTok.value}» не хватает двоеточия.`, 'Поставь : в самом конце строки — так Python понимает, что дальше идёт то, что делать.', 'missing-colon', col + 1);
    }
    return toks.slice(1, -1);
  }
  function statement(L, indent) {
    const toks = L.tokens;
    const first = toks[0];
    if (first.type === 'kw' && first.value === 'if') {
      const cond = header(L, first);
      if (!cond.length) throw new PyError(L.lineNo, first.endCol, 'После if нужно условие.', 'Например: if box == "white":', 'empty-cond');
      const eqIdx = cond.findIndex((t) => t.type === 'op' && t.value === '=');
      if (eqIdx >= 0) throw new PyError(L.lineNo, cond[eqIdx].col, 'В условии сравнивают двумя знаками: ==', 'Замени = на == . Один = значит «положить в коробку», а не «равно ли».', 'assign-in-if', cond[eqIdx].endCol);
      const { node, pos } = parseExpression(cond, 0, { line: L.lineNo });
      expectEnd(cond, pos, L.lineNo);
      const body = childBlock(L, indent);
      const branches = [{ cond: node, body, line: L.lineNo }];
      let orelse = null;
      while (i < lines.length && lines[i].indent === indent && lines[i].tokens[0].type === 'kw' && ['elif', 'else'].includes(lines[i].tokens[0].value)) {
        const E = lines[i];
        const kw = E.tokens[0];
        if (kw.value === 'elif') {
          const c = header(E, kw);
          const parsed = parseExpression(c, 0, { line: E.lineNo });
          expectEnd(c, parsed.pos, E.lineNo);
          branches.push({ cond: parsed.node, body: childBlock(E, indent), line: E.lineNo });
        } else {
          const rest = header(E, kw);
          if (rest.length) throw new PyError(E.lineNo, rest[0].col, 'После else условие не пишут.', 'Оставь просто else:', 'else-cond', rest[rest.length - 1].endCol);
          orelse = childBlock(E, indent);
          break;
        }
      }
      return { k: 'if', branches, orelse, line: L.lineNo };
    }
    if (first.type === 'kw' && (first.value === 'elif' || first.value === 'else')) {
      throw new PyError(L.lineNo, first.col, `«${first.value}» без if перед ним.`, `Поставь ${first.value} ровно под своим if — с тем же отступом.`, 'orphan-else', first.endCol);
    }
    if (first.type === 'kw' && first.value === 'for') {
      const h = header(L, first);
      const v = h[0];
      if (!v || v.type !== 'name') throw new PyError(L.lineNo, first.endCol, 'После for нужно имя: for box in boxes:', 'Напиши имя переменной после for.', 'for-name');
      if (!(h[1]?.type === 'kw' && h[1].value === 'in')) throw new PyError(L.lineNo, v.endCol, 'В for не хватает слова in.', 'Пример: for box in boxes:', 'for-in');
      const { node, pos } = parseExpression(h, 2, { line: L.lineNo });
      expectEnd(h, pos, L.lineNo);
      return { k: 'for', name: v.value, iter: node, body: childBlock(L, indent), line: L.lineNo };
    }
    if (first.type === 'kw' && first.value === 'while') {
      const h = header(L, first);
      const { node, pos } = parseExpression(h, 0, { line: L.lineNo });
      expectEnd(h, pos, L.lineNo);
      return { k: 'while', cond: node, body: childBlock(L, indent), line: L.lineNo };
    }
    if (first.type === 'kw' && first.value === 'def') {
      const h = header(L, first);
      const nameTok = h[0];
      if (!nameTok || nameTok.type !== 'name') throw new PyError(L.lineNo, first.endCol, 'После def нужно имя навыка: def route(batch):', 'Напиши имя после def.', 'def-name');
      if (!(h[1]?.type === 'op' && h[1].value === '(')) throw new PyError(L.lineNo, nameTok.endCol, 'После имени нужны скобки: def route(batch):', 'Поставь скобки, в них — имя того, что навык получает.', 'def-parens', nameTok.endCol + 1);
      const params = [];
      let j = 2;
      while (j < h.length && !(h[j].type === 'op' && h[j].value === ')')) {
        if (h[j].type === 'name') params.push(h[j].value);
        else if (!(h[j].type === 'op' && h[j].value === ',')) throw new PyError(L.lineNo, h[j].col, 'В скобках def пишут только имена через запятую.', 'Например: def route(batch):', 'def-params', h[j].endCol);
        j++;
      }
      if (j >= h.length) throw new PyError(L.lineNo, h[1].col, 'Скобка ( после имени не закрыта.', 'Добавь ) перед двоеточием.', 'unclosed-paren', h[h.length - 1].endCol);
      expectEnd(h, j + 1, L.lineNo);
      return { k: 'def', name: nameTok.value, params, body: childBlock(L, indent), line: L.lineNo, t: nameTok };
    }
    if (first.type === 'kw' && first.value === 'return') {
      i++;
      if (toks.length === 1) return { k: 'return', value: null, line: L.lineNo };
      const { node, pos } = parseExpression(toks, 1, { line: L.lineNo });
      expectEnd(toks, pos, L.lineNo);
      return { k: 'return', value: node, line: L.lineNo };
    }
    if (first.type === 'kw' && first.value === 'pass') { i++; return { k: 'pass', line: L.lineNo }; }
    if (first.type === 'kw' && (first.value === 'break' || first.value === 'continue')) { i++; return { k: first.value, line: L.lineNo, t: first }; }
    if (first.type === 'kw' && BLOCK_KEYWORDS.has(first.value) && first.value !== 'def') {
      throw new PyError(L.lineNo, first.col, `«${first.value}» в этой игре пока не нужен.`, 'Убери эту строку.', 'unsupported', first.endCol);
    }
    // print "wake" / print wake — the classic first mistake.
    if (first.type === 'name' && first.value === 'print' && toks[1] && !(toks[1].type === 'op' && toks[1].value === '(')) {
      throw new PyError(L.lineNo, toks[1].col, 'После print нужны круглые скобки.', `Напиши так: print(${toks[1].type === 'str' ? `"${toks[1].value}"` : '"…"'})`, 'print-parens', toks[toks.length - 1].endCol);
    }
    if (first.type === 'name' && toks[1]?.type === 'op' && toks[1].value === '=') {
      const { node, pos } = parseExpression(toks, 2, { line: L.lineNo });
      expectEnd(toks, pos, L.lineNo);
      i++;
      return { k: 'assign', name: first.value, value: node, line: L.lineNo, t: first };
    }
    const { node, pos } = parseExpression(toks, 0, { line: L.lineNo });
    const after = toks[pos];
    if (after?.type === 'op' && after.value === ':') {
      throw new PyError(L.lineNo, after.col, 'Двоеточие стоит не там: в конце строки оно бывает только после if, else, for.', 'Убери двоеточие.', 'stray-colon', after.endCol);
    }
    expectEnd(toks, pos, L.lineNo);
    i++;
    return { k: 'expr', node, line: L.lineNo };
  }
  const program = block(0);
  return program;
}

// Static check of names: unknown names get «did you mean» before running.
function checkNames(program, known) {
  const diags = [];
  const assigned = new Set();
  function expr(n) {
    if (!n) return;
    if (n.k === 'name') {
      if (!known.has(n.name) && !assigned.has(n.name)) diags.push(unknownName(n.name, n.t, [...known, ...assigned]));
    } else if (n.k === 'attr') expr(n.obj);
    else if (n.k === 'call') { expr(n.fn); n.args.forEach(expr); }
    else if (n.k === 'bin' || n.k === 'and' || n.k === 'or') { expr(n.a); expr(n.b); }
    else if (n.k === 'not' || n.k === 'neg') expr(n.v);
    else if (n.k === 'list') n.items.forEach(expr);
  }
  function stmts(list) {
    for (const s of list) {
      if (s.k === 'expr') expr(s.node);
      else if (s.k === 'assign') { expr(s.value); assigned.add(s.name); }
      else if (s.k === 'if') { s.branches.forEach((b) => { expr(b.cond); stmts(b.body); }); if (s.orelse) stmts(s.orelse); }
      else if (s.k === 'for') { expr(s.iter); assigned.add(s.name); stmts(s.body); }
      else if (s.k === 'while') { expr(s.cond); stmts(s.body); }
      else if (s.k === 'def') { assigned.add(s.name); const before = new Set(assigned); for (const prm of s.params) assigned.add(prm); stmts(s.body); for (const n of [...assigned]) if (!before.has(n)) assigned.delete(n); assigned.add(s.name); }
      else if (s.k === 'return' && s.value) expr(s.value);
    }
  }
  stmts(program);
  return diags;
}

export function unknownName(name, t, candidates) {
  const hint = didYouMean(name, candidates);
  const cyr = /[Ѐ-ӿ]/.test(name);
  let message = `Python не знает имя «${name}».`;
  let fix = '';
  if (hint?.why === 'case') { message += ' Большие и маленькие буквы различаются.'; fix = `Напиши ${hint.name} — именно так, маленькими.`; }
  else if (hint?.why === 'layout') { message += ' Похоже, включена русская раскладка.'; fix = `Переключи раскладку: «${name}» — это ${hint.name}.`; }
  else if (hint) fix = `Может, ты имел в виду ${hint.name}?`;
  else if (cyr) fix = 'Команды Python пишутся латиницей. Русские слова можно только внутри кавычек: "привет".';
  else fix = `Если это слово-сообщение, возьми его в кавычки: "${name}".`;
  return { line: t.line, col: t.col, endCol: t.endCol, message, fix, code: 'unknown-name', suggestion: hint?.name ?? null };
}

export function check(source, { names = [] } = {}) {
  const src = normalizeSource(source);
  if (!src.trim()) return { ok: false, diagnostics: [{ line: 1, col: 1, endCol: 2, message: 'Терминал пуст.', fix: 'Напиши команду.', code: 'empty' }], program: null };
  let program;
  try {
    program = parseLines(lex(src));
  } catch (error) {
    if (error instanceof PyError) return { ok: false, diagnostics: [error.diag], program: null };
    throw error;
  }
  const known = new Set([...BUILTINS, ...names]);
  const diagnostics = checkNames(program, known);
  return { ok: diagnostics.length === 0, diagnostics, program };
}

// ---------------------------------------------------------------- runtime --

const show = (v) => (v === true ? 'True' : v === false ? 'False' : v === null || v === undefined ? 'None' : Array.isArray(v) ? `[${v.map((x) => (typeof x === 'string' ? `'${x}'` : show(x))).join(', ')}]` : String(v));

const RETURN = Symbol('return');

function pyLen(v) {
  if (v && typeof v.__len__ === 'function') return v.__len__();
  return v?.length ?? 0;
}

export function run(source, { names = [], env = {}, maxSteps = 2000 } = {}) {
  const envNames = Object.keys(env);
  const checked = check(source, { names: [...names, ...envNames] });
  if (!checked.ok) return { ok: false, stdout: '', diagnostics: checked.diagnostics, steps: 0 };
  const out = [];
  let steps = 0;
  const globals = Object.create(null);
  Object.assign(globals, env);
  const builtins = {
    print: (...args) => { out.push(args.map(show).join(' ')); return null; },
    len: (v) => pyLen(v),
    range: (a, b) => { const [s0, e] = b === undefined ? [0, a] : [a, b]; return Array.from({ length: Math.max(0, Math.min(1000, e - s0)) }, (_, k) => s0 + k); },
    str: (v) => show(v),
    int: (v) => Math.trunc(Number(v)),
  };
  const BREAK = Symbol('break'); const CONTINUE = Symbol('continue');
  const fail = (t, message, fix, code = 'runtime') => { throw new PyError(t?.line ?? 1, t?.col ?? 1, message, fix, code, t?.endCol); };
  let depth = 0;

  function listMethod(arr, name, t) {
    if (name === 'pop') return (i) => {
      if (!arr.length) fail(t, 'Список пуст — брать из него нечего.', 'Сначала проверь, что в нём что-то есть: while queue:', 'empty-pop');
      const idx = i === undefined ? arr.length - 1 : (i < 0 ? arr.length + i : i);
      if (idx < 0 || idx >= arr.length) fail(t, `В списке нет места номер ${i}.`, 'Первый элемент — номер 0: pop(0).', 'index');
      return arr.splice(idx, 1)[0];
    };
    if (name === 'append') return (v) => { arr.push(v); return null; };
    return null;
  }

  function evalExpr(n, scope) {
    if (n.k === 'lit') return n.v;
    if (n.k === 'name') {
      if (n.name in scope) return scope[n.name];
      if (n.name in builtins) return builtins[n.name];
      fail(n.t, `Python не знает имя «${n.name}».`, 'Может, это имя появляется только внутри навыка (def)? Снаружи его не видно.', 'unknown-name');
    }
    if (n.k === 'list') return n.items.map((x) => evalExpr(x, scope));
    if (n.k === 'attr') {
      const obj = evalExpr(n.obj, scope);
      if (Array.isArray(obj)) {
        const m = listMethod(obj, n.name, n.t);
        if (m) return m;
      } else if (obj && typeof obj === 'object' && n.name in obj && !n.name.startsWith('_')) return obj[n.name];
      const owner = n.obj.k === 'name' ? n.obj.name : 'объекта';
      const choices = Array.isArray(obj) ? ['pop', 'append'] : (obj && typeof obj === 'object' ? Object.keys(obj).filter((k) => !k.startsWith('_') && typeof obj[k] === 'function') : []);
      const hint = didYouMean(n.name, choices);
      fail(n.t, `У ${owner} нет команды «${n.name}».`, hint ? `Может, ${owner}.${hint.name}()? ` : (choices.length ? `Есть: ${choices.map((c) => `${owner}.${c}()`).join(', ')}.` : ''), 'unknown-attr');
    }
    if (n.k === 'call') {
      const fn = evalExpr(n.fn, scope);
      if (typeof fn !== 'function') {
        const label = n.fn.k === 'name' ? n.fn.name : 'это';
        fail(n.t, `«${label}» — не команда, её нельзя вызвать скобками.`, typeof fn === 'string' ? 'Это слово. Чтобы напечатать его: print(' + label + ')' : 'Убери скобки.', 'not-callable');
      }
      const args = n.args.map((x) => evalExpr(x, scope));
      if (fn.__py) {
        if (args.length !== fn.__py.params.length) fail(n.t, `Навык ${fn.__py.name} ждёт ${fn.__py.params.length} ${fn.__py.params.length === 1 ? 'значение' : 'значения'} в скобках, а получил ${args.length}.`, `Вызови так: ${fn.__py.name}(${fn.__py.params.join(', ')})`, 'arity');
      }
      try {
        return fn(...args);
      } catch (error) {
        if (error instanceof PyError) throw error;
        if (error?.pyMessage) fail(n.t, error.pyMessage, error.fix ?? '', 'world');
        throw error;
      }
    }
    if (n.k === 'not') return !truthy(evalExpr(n.v, scope));
    if (n.k === 'neg') return -evalExpr(n.v, scope);
    if (n.k === 'and') { const a = evalExpr(n.a, scope); return truthy(a) ? evalExpr(n.b, scope) : a; }
    if (n.k === 'or') { const a = evalExpr(n.a, scope); return truthy(a) ? a : evalExpr(n.b, scope); }
    if (n.k === 'bin') {
      const a = evalExpr(n.a, scope); const b = evalExpr(n.b, scope);
      switch (n.op) {
        case '==': return a === b;
        case '!=': return a !== b;
        case '<': return a < b;
        case '>': return a > b;
        case '<=': return a <= b;
        case '>=': return a >= b;
        case '+':
          if (typeof a !== typeof b) fail(n.t, 'Нельзя сложить слово и число.', 'Сделай оба значения словами: str(…), или оба числами.', 'type');
          return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/': if (b === 0) fail(n.t, 'На ноль делить нельзя.', 'Проверь делитель.', 'zero'); return a / b;
        case '%': return a % b;
        case 'in': return Array.isArray(b) || typeof b === 'string' ? b.includes(a) : false;
        default: return null;
      }
    }
    return null;
  }
  function truthy(v) {
    if (v && typeof v === 'object' && typeof v.__len__ === 'function') return v.__len__() > 0;
    return !(v === false || v === null || v === undefined || v === 0 || v === '' || (Array.isArray(v) && v.length === 0));
  }
  function tick(line) {
    steps += 1;
    if (steps > maxSteps) fail({ line, col: 1, endCol: 2 }, 'Программа крутится слишком долго — похоже, цикл не заканчивается.', 'Проверь условие while: оно должно когда-то стать ложным (например, брать из очереди: queue.pop(0)).', 'too-long');
  }
  function iterate(v) {
    if (Array.isArray(v) || typeof v === 'string') return [...v];
    if (v && typeof v.__iter__ === 'function') return v.__iter__();
    return null;
  }
  function exec(list, scope) {
    for (const s of list) {
      tick(s.line);
      if (s.k === 'expr') evalExpr(s.node, scope);
      else if (s.k === 'assign') scope[s.name] = evalExpr(s.value, scope);
      else if (s.k === 'pass') { /* nothing */ }
      else if (s.k === 'break') return BREAK;
      else if (s.k === 'continue') return CONTINUE;
      else if (s.k === 'return') { scope[RETURN] = s.value ? evalExpr(s.value, scope) : null; return RETURN; }
      else if (s.k === 'def') {
        const def = s;
        const fn = (...args) => {
          depth += 1;
          if (depth > 40) fail(def.t, 'Навык вызывает сам себя без конца.', 'Проверь, что внутри def нет вызова самого себя.', 'recursion');
          const local = Object.create(globals);
          def.params.forEach((p, i) => { local[p] = args[i]; });
          const r = exec(def.body, local);
          depth -= 1;
          return r === RETURN ? local[RETURN] : null;
        };
        fn.__py = { name: def.name, params: def.params };
        scope[def.name] = fn;
      } else if (s.k === 'if') {
        let done = false;
        for (const b of s.branches) {
          if (truthy(evalExpr(b.cond, scope))) { const r = exec(b.body, scope); if (r) return r; done = true; break; }
        }
        if (!done && s.orelse) { const r = exec(s.orelse, scope); if (r) return r; }
      } else if (s.k === 'for') {
        const items = iterate(evalExpr(s.iter, scope));
        if (!items) fail({ line: s.line, col: 1, endCol: 4 }, 'По этому значению нельзя пройти циклом.', 'for работает со списком: for box in boxes:', 'not-iterable');
        for (const item of items) { scope[s.name] = item; const r = exec(s.body, scope); if (r === BREAK) break; if (r === RETURN) return r; }
      } else if (s.k === 'while') {
        while (truthy(evalExpr(s.cond, scope))) { tick(s.line); const r = exec(s.body, scope); if (r === BREAK) break; if (r === RETURN) return r; }
      }
    }
    return null;
  }
  try {
    exec(checked.program, globals);
  } catch (error) {
    if (error instanceof PyError) return { ok: false, stdout: out.join('\n'), diagnostics: [error.diag], steps };
    if (error?.pyMessage) return { ok: false, stdout: out.join('\n'), diagnostics: [{ line: error.line ?? 1, col: 1, endCol: 2, message: error.pyMessage, fix: error.fix ?? '', code: 'world' }], steps };
    throw error;
  }
  return { ok: true, stdout: out.join('\n'), diagnostics: [], steps, globals };
}

// ------------------------------------------------------- lesson checkers --

// Lesson «print»: the arm listens to the terminal for one word, wake.
// Accepts print("wake"), print('wake'), «wake», spaces, WAKE, wake!.
export function checkWake(source) {
  const result = run(source);
  if (!result.ok) return { ...result, ok: false };
  const said = result.stdout.trim();
  const word = said.toLowerCase().replace(/[!.\s]+$/g, '').trim();
  if (word === 'wake') return { ...result, ok: true, heard: said };
  if (!said) {
    return { ...result, ok: false, heard: '', diagnostics: [{ line: 1, col: 1, endCol: normalizeSource(source).split('\n')[0].length + 1, message: 'Терминал ничего не напечатал — рука ничего не услышала.', fix: 'Чтобы сказать руке слово, его печатают: print("wake")', code: 'silent' }] };
  }
  const hint = levenshtein(word, 'wake') <= 2
    ? `Почти: напечаталось «${said}», а рука ждёт ровно wake. Проверь буквы.`
    : (/[Ѐ-ӿ]/.test(word) ? `Напечаталось «${said}». Рука понимает только английское слово wake.` : `Напечаталось «${said}», а рука ждёт слово wake.`);
  return { ...result, ok: false, heard: said, diagnostics: [{ line: 1, col: 1, endCol: normalizeSource(source).split('\n')[0].length + 1, message: hint, fix: 'Внутри кавычек должно быть одно слово: "wake"', code: 'wrong-word' }] };
}

// Lesson «if»: the arm takes boxes one by one and asks the player's rule
// about each. `box` is the colour ("white" / "red"), arm.take() takes it.
export function runRule(source, colors) {
  const decisions = [];
  for (const color of colors) {
    let took = false;
    const arm = { take: () => { took = true; return null; }, skip: () => null, leave: () => null };
    const result = run(source, { env: { box: color, arm } });
    if (!result.ok) {
      const d = result.diagnostics[0];
      if (d?.code === 'unknown-name' && /^[Ѐ-ӿ]+$/.test(String(d.message.match(/«(.+)»/)?.[1] ?? ''))) {
        d.fix = 'Цвета у руки подписаны по-английски: "white" и "red" — в кавычках.';
      }
      return { ok: false, diagnostics: result.diagnostics, decisions };
    }
    decisions.push({ color, take: took });
  }
  const tookRed = decisions.some((d) => d.color === 'red' && d.take);
  const leftWhite = decisions.some((d) => d.color === 'white' && !d.take);
  const text = normalizeSource(source);
  const usesIf = /^\s*if\b/m.test(text);
  if (tookRed) return { ok: false, decisions, diagnostics: [{ line: 1, col: 1, endCol: 3, message: 'Рука унесла красный ящик — за это штраф.', fix: usesIf ? 'Проверь условие: брать нужно, только когда box == "white".' : 'Рука берёт всё подряд. Поставь проверку: if box == "white":', code: 'took-red' }] };
  if (leftWhite) return { ok: false, decisions, diagnostics: [{ line: 1, col: 1, endCol: 3, message: 'Белые ящики остались стоять — рука их не взяла.', fix: 'Внутри if дай команду: arm.take(box)  (с отступом в 4 пробела).', code: 'left-white' }] };
  if (!usesIf) return { ok: false, decisions, diagnostics: [{ line: 1, col: 1, endCol: 3, message: 'Правило должно спрашивать про цвет.', fix: 'Начни с if box == "white":', code: 'no-if' }] };
  return { ok: true, decisions, diagnostics: [] };
}
