// Две короткие задачи на Python про выдуманные устройства мастерской:
// только переменные, print и if / elif / else (тот же строгий интерпретатор,
// что и правило шлюза — garage-rule.js; for / while там не нужны).
// Ответ проверяется не по тексту, а прогоном по набору случаев: код игрока
// должен вести себя как ядро (core.js) и шкаф (cabinet.js).
import { runRule, formatRuleError } from '../garage-rule.js';
import { createLock, setPressure, probeSector } from './core.js';
import { attemptOpen } from './cabinet.js';

const freeze = Object.freeze;
const EVENT_WORD = freeze({ light: 'ЛЕГКО', hard: 'ТУГО', 'false-echo': 'ЗАКЛИНИЛО', set: 'СЕЛ', opened: 'СЕЛ' });

// What the core says for one pin of a one-pin device.
export function coreResponse({ pressure, low, high, pin, wanted }) {
  const lock = setPressure(createLock({ pattern: [{ sector: wanted, min: low, max: high }, { sector: 0, min: 0, max: 100 }], sectors: 6 }), pressure);
  return EVENT_WORD[probeSector(lock, pin).event];
}
const ROUTE_WORD = freeze({ signal: 'СИГНАЛ', stabilizer: 'СТАБИЛИЗАТОР', lamp: 'ЛАМПА' });
export function cabinetResponse(vars) {
  const r = attemptOpen(vars);
  return r.status === 'opened' ? ROUTE_WORD[r.route] : 'ЗАКРЫТ';
}

const otklikCases = [
  { pressure: 20, low: 40, high: 56, pin: 2, wanted: 2 },
  { pressure: 39, low: 40, high: 56, pin: 3, wanted: 2 },
  { pressure: 40, low: 40, high: 56, pin: 2, wanted: 2 },
  { pressure: 48, low: 40, high: 56, pin: 2, wanted: 2 },
  { pressure: 56, low: 40, high: 56, pin: 1, wanted: 2 },
  { pressure: 57, low: 40, high: 56, pin: 2, wanted: 2 },
  { pressure: 90, low: 60, high: 74, pin: 0, wanted: 4 },
  { pressure: 66, low: 60, high: 74, pin: 4, wanted: 4 },
  { pressure: 66, low: 60, high: 74, pin: 0, wanted: 4 },
].map((vars) => freeze({ vars: freeze(vars), want: coreResponse(vars) }));

const bools = [false, true];
const shkafCases = [];
for (const lamp of bools) for (const generator of bools) for (const signal of bools) for (const stabilizer of bools) {
  if (signal && !generator) continue; // сигнал без генератора не снять
  const vars = freeze({ lamp, generator, signal, stabilizer });
  shkafCases.push(freeze({ vars, want: cabinetResponse(vars) }));
}

export const LOCK_PY_TASKS = freeze([
  freeze({
    id: 'py-otklik', title: 'Модель отклика штифта',
    brief: 'Опиши словами одного штифта учебной СОТЫ. Даны: pressure (натяжение), low и high (полоса, края входят), pin (какой штифт подняли), wanted (какой ждёт механизм). Напечатай ровно одно слово: ЛЕГКО — натяжение ниже полосы; ТУГО — выше; ЗАКЛИНИЛО — в полосе, но штифт не тот; СЕЛ — в полосе и тот.',
    vars: ['pressure', 'low', 'high', 'pin', 'wanted'],
    starter: '# pressure, low, high, pin, wanted уже заданы\nif pressure < low:\n    print("ЛЕГКО")\nelse:\n    print("СЕЛ")\n',
    cases: freeze(otklikCases),
  }),
  freeze({
    id: 'py-shkaf', title: 'Какой путь откроет шкаф',
    brief: 'Шкаф Сани. Даны True/False: lamp, generator, signal, stabilizer. Напечатай путь, которым шкаф откроется: СИГНАЛ (если снят сигнал — он важнее всего), иначе СТАБИЛИЗАТОР, иначе ЛАМПА, а если ничего не готово — ЗАКРЫТ.',
    vars: ['lamp', 'generator', 'signal', 'stabilizer'],
    starter: '# lamp, generator, signal, stabilizer уже заданы\nif lamp:\n    print("ЛАМПА")\nelse:\n    print("ЗАКРЫТ")\n',
    cases: freeze(shkafCases),
  }),
]);
export const lockTaskById = (id) => LOCK_PY_TASKS.find((t) => t.id === id) ?? null;

const fmt = (vars) => Object.entries(vars).map(([k, v]) => `${k}=${v === true ? 'True' : v === false ? 'False' : v}`).join(', ');

export function checkLockTask(id, code) {
  const task = lockTaskById(id);
  if (!task) return { ok: false, passed: 0, total: 0, fails: [], error: 'нет такой задачи' };
  const fails = []; let passed = 0; let error = null;
  for (const c of task.cases) {
    const r = runRule(code, c.vars);
    if (!r.ok) { error = formatRuleError(r.error); fails.push({ vars: fmt(c.vars), want: c.want, got: '—' }); continue; }
    const got = String(r.prints[0] ?? '').trim().toUpperCase();
    if (r.prints.length === 1 && got === c.want) passed++;
    else fails.push({ vars: fmt(c.vars), want: c.want, got: r.prints.length ? r.prints.join(' / ') : '(тишина)' });
  }
  return { ok: passed === task.cases.length, passed, total: task.cases.length, fails, error };
}
