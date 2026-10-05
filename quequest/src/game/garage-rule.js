// 17.1 · The garage gateway runs the player's own Python rule on every
// command that crosses the car's bus. This is a small, strict subset of
// Python -- exactly what the main game has taught by the time the garage
// opens (variables, print, if / elif / else, ==, !=, and / or / not, in) --
// interpreted here in pure JS so that the scene, the verdict and the tests
// are one deterministic function (the career rule: what you see is what
// counts). Anything outside the subset is an honest, Python-styled error,
// never a silent guess. Every valid program here is also valid Python with
// the same result.

export const VERDICT_PASS = 'ПРОПУСТИТЬ';
export const VERDICT_BLOCK = 'БЛОК';
const PASS_WORDS = new Set(['ПРОПУСТИТЬ', 'ПРОПУСК', 'PASS', 'ALLOW', 'OK']);
const BLOCK_WORDS = new Set(['БЛОК', 'БЛОКИРОВАТЬ', 'BLOCK', 'DENY', 'STOP']);

export class RuleError extends Error {
  constructor(type, text, line = null) {
    super(`${type}: ${text}`);
    this.type = type; this.text = text; this.line = line;
  }
}

// Russian/typographic quotes typed on a phone or pasted from chat.
export function normalizeRuleSource(source) {
  return String(source ?? '').replace(/\r\n?/g, '\n').replace(/\t/g, '    ').replace(/[“”„«»]/g, '"').replace(/[‘’]/g, "'");
}

// ---------------------------------------------------------------- lexer

const KEYWORDS = new Set(['if', 'elif', 'else', 'and', 'or', 'not', 'in', 'True', 'False', 'None', 'pass', 'print', 'is']);
const UNSUPPORTED = new Set(['for', 'while', 'def', 'return', 'import', 'from', 'class', 'lambda', 'try', 'except', 'with', 'yield', 'global', 'del', 'exec', 'eval', 'open']);

function tokenize(text, line) {
  const out = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === ' ') { i++; continue; }
    if (ch === '#') break;
    if (ch === '"' || ch === "'") {
      let j = i + 1, s = '';
      while (j < text.length && text[j] !== ch) {
        if (text[j] === '\\' && j + 1 < text.length) { const n = text[j + 1]; s += n === 'n' ? '\n' : n === 't' ? '\t' : n; j += 2; continue; }
        s += text[j++];
      }
      if (j >= text.length) throw new RuleError('SyntaxError', 'строка не закрыта кавычкой', line);
      out.push({ t: 'str', v: s }); i = j + 1; continue;
    }
    if (/[0-9]/.test(ch)) {
      const m = /^[0-9]+(\.[0-9]+)?/.exec(text.slice(i));
      out.push({ t: 'num', v: Number(m[0]) }); i += m[0].length; continue;
    }
    if (/[A-Za-z_А-Яа-яЁё]/.test(ch)) {
      const m = /^[A-Za-z_А-Яа-яЁё0-9]+/.exec(text.slice(i));
      const w = m[0];
      if (UNSUPPORTED.has(w)) throw new RuleError('SyntaxError', `«${w}» в шлюзе не нужен: здесь только переменные, print и if / elif / else`, line);
      out.push({ t: KEYWORDS.has(w) ? 'kw' : 'name', v: w }); i += w.length; continue;
    }
    const two = text.slice(i, i + 2);
    if (['==', '!=', '<=', '>='].includes(two)) { out.push({ t: 'op', v: two }); i += 2; continue; }
    if ('()[],:=<>+'.includes(ch)) { out.push({ t: 'op', v: ch }); i++; continue; }
    throw new RuleError('SyntaxError', `непонятный символ «${ch}»`, line);
  }
  return out;
}

// ---------------------------------------------------------------- parser

function parseExpr(tokens, line) {
  let p = 0;
  const peek = () => tokens[p];
  const is = (t, v) => tokens[p] && tokens[p].t === t && (v === undefined || tokens[p].v === v);
  const eat = (t, v, what) => {
    if (!is(t, v)) throw new RuleError('SyntaxError', what ?? `ожидалось «${v ?? t}»`, line);
    return tokens[p++];
  };
  function or() { let l = and(); while (is('kw', 'or')) { p++; l = { k: 'or', l, r: and() }; } return l; }
  function and() { let l = not(); while (is('kw', 'and')) { p++; l = { k: 'and', l, r: not() }; } return l; }
  function not() { if (is('kw', 'not')) { p++; return { k: 'not', e: not() }; } return cmp(); }
  function cmp() {
    let l = sum();
    for (;;) {
      if (is('op') && ['==', '!=', '<', '>', '<=', '>='].includes(peek().v)) { const op = tokens[p++].v; l = { k: 'cmp', op, l, r: sum() }; continue; }
      if (is('kw', 'in')) { p++; l = { k: 'cmp', op: 'in', l, r: sum() }; continue; }
      if (is('kw', 'not') && tokens[p + 1]?.t === 'kw' && tokens[p + 1].v === 'in') { p += 2; l = { k: 'cmp', op: 'not in', l, r: sum() }; continue; }
      if (is('kw', 'is')) { p++; const neg = is('kw', 'not') ? (p++, true) : false; l = { k: 'cmp', op: neg ? 'is not' : 'is', l, r: sum() }; continue; }
      if (is('op', '=')) throw new RuleError('SyntaxError', 'в условии нужно «==» (сравнить), а не «=» (присвоить)', line);
      return l;
    }
  }
  function sum() { let l = atom(); while (is('op', '+')) { p++; l = { k: 'add', l, r: atom() }; } return l; }
  function atom() {
    const tk = peek();
    if (!tk) throw new RuleError('SyntaxError', 'выражение оборвалось', line);
    if (tk.t === 'str' || tk.t === 'num') { p++; return { k: 'lit', v: tk.v }; }
    if (tk.t === 'kw' && (tk.v === 'True' || tk.v === 'False' || tk.v === 'None')) { p++; return { k: 'lit', v: tk.v === 'True' ? true : tk.v === 'False' ? false : null }; }
    if (tk.t === 'name') {
      p++;
      if (is('op', '(')) throw new RuleError('NameError', `функции «${tk.v}» в шлюзе нет — есть только print`, line);
      return { k: 'var', name: tk.v };
    }
    if (is('op', '(')) {
      p++; const items = []; let tuple = false;
      if (!is('op', ')')) { items.push(or()); while (is('op', ',')) { p++; tuple = true; if (is('op', ')')) break; items.push(or()); } }
      eat('op', ')', 'не хватает закрывающей скобки «)»');
      return tuple || !items.length ? { k: 'list', items } : items[0];
    }
    if (is('op', '[')) {
      p++; const items = [];
      if (!is('op', ']')) { items.push(or()); while (is('op', ',')) { p++; if (is('op', ']')) break; items.push(or()); } }
      eat('op', ']', 'не хватает закрывающей скобки «]»');
      return { k: 'list', items };
    }
    if (tk.t === 'kw' && tk.v === 'print') throw new RuleError('SyntaxError', 'print — это команда, её не сравнивают', line);
    throw new RuleError('SyntaxError', `здесь не может стоять «${tk.v}»`, line);
  }
  const expr = or();
  return { expr, rest: tokens.slice(p) };
}

function parseFull(tokens, line) {
  const { expr, rest } = parseExpr(tokens, line);
  if (rest.length) {
    const tk = rest[0];
    if (tk.t === 'op' && tk.v === ':') throw new RuleError('SyntaxError', 'двоеточие здесь лишнее', line);
    throw new RuleError('SyntaxError', `лишнее «${tk.v}» после выражения`, line);
  }
  return expr;
}

// One simple statement: print(...), name = expr, pass.
function parseSimple(tokens, line) {
  const tk = tokens[0];
  if (!tk) throw new RuleError('SyntaxError', 'пустая команда', line);
  if (tk.t === 'kw' && tk.v === 'pass') { if (tokens.length > 1) throw new RuleError('SyntaxError', 'после pass ничего не пишут', line); return { k: 'pass', line }; }
  if (tk.t === 'kw' && tk.v === 'print') {
    if (tokens[1]?.v !== '(' ) throw new RuleError('SyntaxError', 'print пишется со скобками: print("БЛОК")', line);
    if (tokens.at(-1)?.v !== ')') throw new RuleError('SyntaxError', 'не хватает закрывающей скобки «)» у print', line);
    const inner = tokens.slice(2, -1), args = [];
    let depth = 0, start = 0;
    for (let i = 0; i <= inner.length; i++) {
      const t = inner[i];
      if (t && t.t === 'op' && (t.v === '(' || t.v === '[')) depth++;
      if (t && t.t === 'op' && (t.v === ')' || t.v === ']')) depth--;
      if (i === inner.length || (depth === 0 && t.t === 'op' && t.v === ',')) {
        const part = inner.slice(start, i);
        if (part.length) args.push(parseFull(part, line));
        start = i + 1;
      }
    }
    return { k: 'print', args, line };
  }
  if (tk.t === 'name' && tokens[1]?.t === 'op' && tokens[1].v === '=') {
    if (tokens.length < 3) throw new RuleError('SyntaxError', `после «${tk.v} =» нужно значение`, line);
    return { k: 'set', name: tk.v, expr: parseFull(tokens.slice(2), line), line };
  }
  if (tk.t === 'kw' && (tk.v === 'elif' || tk.v === 'else')) throw new RuleError('SyntaxError', `«${tk.v}» без своего if выше`, line);
  if (tk.t === 'name' && tokens.length === 1) throw new RuleError('SyntaxError', `строка «${tk.v}» ничего не делает — может, print(${tk.v})?`, line);
  throw new RuleError('SyntaxError', 'шлюз понимает только print(...), присваивание и if / elif / else', line);
}

export function parseRule(source) {
  const raw = normalizeRuleSource(source).split('\n');
  const lines = [];
  raw.forEach((text, i) => {
    const toks = tokenize(text, i + 1);
    if (!toks.length) return;
    const indent = text.length - text.trimStart().length;
    lines.push({ indent, toks, line: i + 1 });
  });
  let pos = 0;
  function block(indent) {
    const body = [];
    while (pos < lines.length) {
      const L = lines[pos];
      if (L.indent < indent) break;
      if (L.indent > indent) throw new RuleError('IndentationError', 'лишний отступ', L.line);
      const head = L.toks[0];
      if (head.t === 'kw' && head.v === 'if') { body.push(ifStmt(indent)); continue; }
      pos++;
      body.push(parseSimple(L.toks, L.line));
    }
    return body;
  }
  function suite(L, indent, colonAt) {
    const after = L.toks.slice(colonAt + 1);
    pos++;
    if (after.length) return [parseSimple(after, L.line)];
    const next = lines[pos];
    if (!next || next.indent <= indent) throw new RuleError('IndentationError', 'после двоеточия нужна строка с отступом', L.line);
    return block(next.indent);
  }
  function colonOf(L, word) {
    let depth = 0;
    for (let i = 0; i < L.toks.length; i++) {
      const t = L.toks[i];
      if (t.t === 'op' && (t.v === '(' || t.v === '[')) depth++;
      if (t.t === 'op' && (t.v === ')' || t.v === ']')) depth--;
      if (depth === 0 && t.t === 'op' && t.v === ':') return i;
    }
    throw new RuleError('SyntaxError', `в конце строки с ${word} нужно двоеточие «:»`, L.line);
  }
  function ifStmt(indent) {
    const branches = [];
    let L = lines[pos], c = colonOf(L, 'if');
    if (c === 1) throw new RuleError('SyntaxError', 'после if нужно условие', L.line);
    branches.push({ cond: parseFull(L.toks.slice(1, c), L.line), body: suite(L, indent, c), line: L.line });
    let orelse = null;
    while (pos < lines.length && lines[pos].indent === indent) {
      L = lines[pos];
      const head = L.toks[0];
      if (head.t === 'kw' && head.v === 'elif') {
        c = colonOf(L, 'elif');
        if (c === 1) throw new RuleError('SyntaxError', 'после elif нужно условие', L.line);
        branches.push({ cond: parseFull(L.toks.slice(1, c), L.line), body: suite(L, indent, c), line: L.line });
        continue;
      }
      if (head.t === 'kw' && head.v === 'else') {
        c = colonOf(L, 'else');
        if (c !== 1) throw new RuleError('SyntaxError', 'у else не бывает условия: просто «else:»', L.line);
        orelse = suite(L, indent, c);
      }
      break;
    }
    return { k: 'if', branches, orelse, line: branches[0].line };
  }
  if (!lines.length) return [];
  if (lines[0].indent !== 0) throw new RuleError('IndentationError', 'первая команда должна начинаться с начала строки', lines[0].line);
  const program = block(0);
  if (pos < lines.length) throw new RuleError('IndentationError', 'отступ не совпадает ни с одним блоком выше', lines[pos].line);
  return program;
}

// ------------------------------------------------------------- evaluator

function pyRepr(v) {
  if (v === true) return 'True'; if (v === false) return 'False'; if (v === null) return 'None';
  if (Array.isArray(v)) return `[${v.map((x) => (typeof x === 'string' ? `'${x}'` : pyRepr(x))).join(', ')}]`;
  return String(v);
}
const truthy = (v) => !(v === false || v === null || v === 0 || v === '' || (Array.isArray(v) && !v.length));
const typeName = (v) => (typeof v === 'string' ? 'str' : typeof v === 'number' ? 'int' : typeof v === 'boolean' ? 'bool' : v === null ? 'NoneType' : Array.isArray(v) ? 'list' : 'object');

function evalExpr(e, env, line) {
  switch (e.k) {
    case 'lit': return e.v;
    case 'var':
      if (!Object.prototype.hasOwnProperty.call(env, e.name)) {
        const hint = Object.keys(env).find((k) => k.toLowerCase() === e.name.toLowerCase());
        throw new RuleError('NameError', `имя «${e.name}» не определено${hint ? ` — может, «${hint}»?` : ''}`, line);
      }
      return env[e.name];
    case 'list': return e.items.map((x) => evalExpr(x, env, line));
    case 'not': return !truthy(evalExpr(e.e, env, line));
    case 'and': { const l = evalExpr(e.l, env, line); return truthy(l) ? evalExpr(e.r, env, line) : l; }
    case 'or': { const l = evalExpr(e.l, env, line); return truthy(l) ? l : evalExpr(e.r, env, line); }
    case 'add': {
      const l = evalExpr(e.l, env, line), r = evalExpr(e.r, env, line);
      if (typeof l === 'string' && typeof r === 'string') return l + r;
      if (typeof l === 'number' && typeof r === 'number') return l + r;
      throw new RuleError('TypeError', `нельзя сложить ${typeName(l)} и ${typeName(r)}`, line);
    }
    case 'cmp': {
      const l = evalExpr(e.l, env, line), r = evalExpr(e.r, env, line);
      const eq = (a, b) => (Array.isArray(a) && Array.isArray(b) ? a.length === b.length && a.every((x, i) => eq(x, b[i])) : a === b);
      switch (e.op) {
        case '==': return eq(l, r);
        case '!=': return !eq(l, r);
        case 'is': return l === r;
        case 'is not': return l !== r;
        case 'in': case 'not in': {
          let has;
          if (typeof r === 'string') { if (typeof l !== 'string') throw new RuleError('TypeError', 'в строке можно искать только строку', line); has = r.includes(l); }
          else if (Array.isArray(r)) has = r.some((x) => eq(x, l));
          else throw new RuleError('TypeError', `в ${typeName(r)} нельзя искать через in`, line);
          return e.op === 'in' ? has : !has;
        }
        default: {
          if (!(typeof l === typeof r && (typeof l === 'number' || typeof l === 'string'))) throw new RuleError('TypeError', `нельзя сравнить ${typeName(l)} и ${typeName(r)} через ${e.op}`, line);
          return e.op === '<' ? l < r : e.op === '>' ? l > r : e.op === '<=' ? l <= r : l >= r;
        }
      }
    }
    default: throw new RuleError('SyntaxError', 'непонятное выражение', line);
  }
}

function execBlock(body, env, out) {
  for (const st of body) {
    if (st.k === 'pass') continue;
    if (st.k === 'set') { env[st.name] = evalExpr(st.expr, env, st.line); continue; }
    if (st.k === 'print') { out.push({ text: st.args.map((a) => { const v = evalExpr(a, env, st.line); return typeof v === 'string' ? v : pyRepr(v); }).join(' '), line: st.line }); continue; }
    if (st.k === 'if') {
      const hit = st.branches.find((b) => truthy(evalExpr(b.cond, env, b.line)));
      if (hit) execBlock(hit.body, env, out); else if (st.orelse) execBlock(st.orelse, env, out);
    }
  }
}

export function verdictOf(text) {
  const w = String(text).trim().toUpperCase().replace(/[.!]+$/, '');
  if (PASS_WORDS.has(w)) return 'pass';
  if (BLOCK_WORDS.has(w)) return 'block';
  return null;
}

// Runs a program with the given variables. Returns prints, the final
// variables and -- for a gateway rule -- the first verdict it printed.
// A rule that says nothing is a closed gateway: silence means БЛОК.
export function runRule(source, vars = {}, { program = null } = {}) {
  try {
    const prog = program ?? parseRule(source);
    const env = { ...vars }, out = [];
    execBlock(prog, env, out);
    const said = out.find((o) => verdictOf(o.text));
    return { ok: true, prints: out.map((o) => o.text), env, verdict: said ? verdictOf(said.text) : 'block', silent: !said, line: said?.line ?? null, error: null };
  } catch (err) {
    if (!(err instanceof RuleError)) throw err;
    return { ok: false, prints: [], env: { ...vars }, verdict: 'block', silent: true, line: err.line, error: { type: err.type, text: err.text, line: err.line } };
  }
}

// Parse once, judge many packets. A program that fails to parse fails every
// packet the same way; a runtime error (NameError...) fails only the packets
// that reach the broken line -- just like real Python.
export function compileRule(source) {
  try {
    const program = parseRule(source);
    return { ok: true, error: null, judge: (vars) => runRule(null, vars, { program }) };
  } catch (err) {
    if (!(err instanceof RuleError)) throw err;
    const error = { type: err.type, text: err.text, line: err.line };
    return { ok: false, error, judge: (vars) => ({ ok: false, prints: [], env: { ...vars }, verdict: 'block', silent: true, line: err.line, error }) };
  }
}

export function formatRuleError(error) {
  if (!error) return '';
  return `${error.type}${error.line ? ` · строка ${error.line}` : ''}: ${error.text}`;
}
