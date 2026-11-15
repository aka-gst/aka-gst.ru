// ЛЁД-64 · level 7, «Кривой прыгун»: the player fixes Витя's scout in Python. Only the line the level needs is
// read — a list of (dx, dy) pairs bound to JUMPS. Not a Python interpreter: what is not this shape gets a plain
// sentence back, never a silent default (rule 7р). The engine then moves the scout by exactly this list.

// short lines: the whole list fits a phone's width at 14 px without wrapping
export const BUGGY_JUMPS_CODE = `# куда прыгает разведчик Вити
JUMPS = [(1, 2), (2, 1), (2, -1),
         (1, -2), (-1, -2), (-2, -1),
         (-2, 2), (-1, 2)]`;

const isL = ([dx, dy]) => (Math.abs(dx) === 1 && Math.abs(dy) === 2) || (Math.abs(dx) === 2 && Math.abs(dy) === 1);
const fmt = ([dx, dy]) => `(${dx}, ${dy})`;

// -> { ok: true, jumps, notL: [[dx,dy]…], missing: [[dx,dy]…], dupes } | { ok: false, error }
export function parseJumps(text = '') {
  const src = String(text).replace(/#[^\n]*/g, '');
  const m = src.match(/JUMPS\s*=\s*\[([\s\S]*)\]/);
  if (!m) return { ok: false, error: 'Нужна строка JUMPS = [ ... ] — список пар в квадратных скобках' };
  const body = m[1].trim();
  const pairs = [];
  const re = /\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/g;
  let rest = body, t;
  while ((t = re.exec(body))) { pairs.push([Number(t[1]), Number(t[2])]); }
  rest = body.replace(re, '').replace(/[\s,]/g, '');
  if (rest) return { ok: false, error: `Не понял кусок «${rest.slice(0, 20)}». Каждый прыжок — пара в скобках: (2, 1)` };
  if (!pairs.length) return { ok: false, error: 'Список пустой: разведчик никуда не прыгнет' };
  if (pairs.length > 16) return { ok: false, error: 'Слишком много прыжков: больше шестнадцати пар' };
  const key = (p) => p.join(',');
  const seen = new Set(), dupes = [];
  for (const p of pairs) { if (seen.has(key(p))) dupes.push(p); seen.add(key(p)); }
  const all = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
  return { ok: true, jumps: pairs, notL: pairs.filter((p) => !isL(p)), missing: all.filter((p) => !seen.has(key(p))), dupes };
}

// One line under the code: what the scout will now do. No full stop at the end (rule 23.10).
export function jumpsReport(r) {
  if (!r.ok) return r.error;
  const parts = [`прыжков ${r.jumps.length}`];
  if (r.notL.length) parts.push(`не буква «Г»: ${r.notL.map(fmt).join(' ')}`);
  if (r.missing.length) parts.push(`не хватает: ${r.missing.map(fmt).join(' ')}`);
  if (!r.notL.length && !r.missing.length) parts.push('все восемь — буквой «Г»');
  return parts.join(' · ');
}
export { isL };
