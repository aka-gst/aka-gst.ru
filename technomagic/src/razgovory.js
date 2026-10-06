/*
 * РАЗГОВОРЫ — ДВИЖОК (слой «г», 03.10.2026)
 * =========================================================
 * Сергей, 03.10 04:25: «маленькая РПГшка, как Прага в Deus Ex… можно
 * разговаривать с персонажами… отыгрываешь жителя». Разговор — не меню
 * поверх игры, а ещё одна дверь в мир: выбор реплики поднимает флаг,
 * берёт или сдаёт задание, отдаёт монету, посылает жителя что-то сделать.
 *
 * ОТКУДА. Механику не изобретали — она перенесена из QueQuest (READ-ONLY,
 * ~/dev/_games/QueQuest):
 *   - src/game/first-shift.js:68-104 — FIRST_SHIFT_WORKERS и
 *     firstShiftWorkerLine(worker, topic, n): у жителя темы, на каждую
 *     реплика, и повтор той же темы звучит иначе (n-й раз — n-я строка,
 *     дальше последняя). Здесь это `say: [...]` у узла и счётчик визитов;
 *   - stepFirstShift(state, action) там же — чистый редьюсер: копия
 *     состояния, действие, новое состояние; недопустимое действие
 *     возвращает состояние как было. Здесь это stepTalk;
 *   - «поговорить или подраться» (фаза confront) — развилка в одном узле.
 *     Здесь развилок 2–3 в каждом узле, и у каждой своё условие.
 * Что добавлено: условие у выбора (флаги, монеты, задания, тревога,
 * розыск, что этот житель видел) и действия выбора — данными, а не
 * кодом, чтобы дерево проверялось без мира и без экрана.
 *
 * ЧИСТЫЙ МОДУЛЬ. Ни мира, ни DOM, ни таймеров: дерево и снимок мира
 * (ctx) на входе, новое состояние разговора и список действий на выходе.
 * Действия к миру применяет src/zhiteli.js, рисует разговор main.js —
 * ни то, ни другое этот файл не знает.
 *
 * ДЕРЕВО
 *   {
 *     name: 'КУЗНЕЦ',
 *     start: [{ if: условие, node: 'id' }, …, { node: 'id' }],
 *     nodes: {
 *       id: {
 *         say: 'строка' | ['первый раз', 'второй', 'дальше'],
 *         choices: [{ id, text, if: условие, do: [действие…], next: 'id' | null }],
 *       },
 *     },
 *   }
 * Вход — первое правило `start`, чьё условие выполнено. Выбор с `if`,
 * который не выполнен, не показывается и не принимается. `next: null` —
 * разговор окончен.
 *
 * УСЛОВИЕ (данные; пустое — «да»)
 *   { flag: 'имя' }               флаг поднят
 *   { not: условие }              { all: […] }   { any: […] }
 *   { coins: n }                  монет не меньше n
 *   { quest: 'id', is: 'vzyato' | ['vzyato', …] }
 *   { wanted: true|false }        на тебя донесли (розыск)
 *   { alarm: 'calm' | […] }       состояние тревоги МГС
 *   { saw: true|false }           этот житель видел твоё преступление
 *   { crime: 'arson' | […] }      вид того, что он видел
 *   { witness: 'run' | […] }      что он сейчас делает как свидетель
 *
 * ДЕЙСТВИЕ (данные; применяет мир)
 *   { flag: 'имя' }               поднять флаг
 *   { coins: ±n }                 отдать / получить монеты
 *   { quest: 'id', to: 'vzyato' | 'sdelano' | 'provaleno', solution? }
 *   { act: 'имя', … }             поступок жителя в мире (src/zhiteli.js)
 */

/*
 * Поломка для проверки (п.6): `RULES.conditions = false` — движок
 * перестаёт смотреть на условия ВЫБОРОВ, и каждый выбор доступен всегда
 * (вход в разговор по-прежнему по условиям — иначе ломается не правило,
 * а всё сразу). Отрицательные контроли «без монеты / без флага — нет
 * решения» обязаны от этого покраснеть (tests/sloy-g.mjs).
 */
export const RULES = { conditions: true };

const asList = (v) => (Array.isArray(v) ? v : [v]);

export function testCond(cond, ctx) {
  if (!cond) return true;
  if (cond.all) return cond.all.every((c) => testCond(c, ctx));
  if (cond.any) return cond.any.some((c) => testCond(c, ctx));
  if (cond.not) return !testCond(cond.not, ctx);
  let ok = true;
  if (cond.flag !== undefined) ok = ok && Boolean(ctx.flags && ctx.flags[cond.flag]);
  if (cond.coins !== undefined) ok = ok && (ctx.coins || 0) >= cond.coins;
  if (cond.quest !== undefined) {
    const state = (ctx.quests && ctx.quests[cond.quest]) || 'ne-vzyato';
    ok = ok && asList(cond.is ?? 'vzyato').includes(state);
  }
  if (cond.wanted !== undefined) ok = ok && Boolean(ctx.wanted) === cond.wanted;
  if (cond.alarm !== undefined) ok = ok && asList(cond.alarm).includes(ctx.alarm || 'calm');
  if (cond.saw !== undefined) ok = ok && Boolean(ctx.saw) === cond.saw;
  if (cond.crime !== undefined) ok = ok && asList(cond.crime).includes(ctx.crime);
  if (cond.witness !== undefined) ok = ok && asList(cond.witness).includes(ctx.witness || 'calm');
  return ok;
}

/* Узел входа: первое правило, чьё условие выполнено. */
export function entryNode(tree, ctx) {
  for (const rule of tree.start || []) {
    if (testCond(rule.if, ctx) && tree.nodes[rule.node]) return rule.node;
  }
  return null;
}

/* Строка узла с учётом повтора (first-shift: n-й раз — n-я строка). */
export function lineOf(tree, node, n = 0) {
  const say = tree.nodes[node] && tree.nodes[node].say;
  if (say === undefined || say === null) return '';
  const lines = asList(say);
  return lines[Math.min(lines.length - 1, Math.max(0, n))];
}

/* Выборы, которые сейчас видны: условие выполнено. */
export function choicesOf(tree, node, ctx) {
  const spec = tree.nodes[node];
  if (!spec) return [];
  return (spec.choices || []).filter((choice) => !RULES.conditions || testCond(choice.if, ctx));
}

/*
 * Открыть разговор. `memory` — сколько раз житель уже говорил каждую
 * строку (счётчик визитов узлов, хранит мир). Возвращает состояние
 * разговора и новую память, или null — входа нет.
 */
export function openTalk(id, tree, ctx, memory = {}) {
  const node = entryNode(tree, ctx);
  if (!node) return null;
  const n = memory[node] || 0;
  return {
    state: { with: id, node, n },
    memory: { ...memory, [node]: n + 1 },
  };
}

/*
 * Шаг разговора — чистый редьюсер, как stepFirstShift. Действие:
 *   { type: 'say', id }   выбрать реплику
 *   { type: 'close' }     уйти
 * Возвращает { state, memory, effects, rejected }:
 *   state null — разговор окончен; effects — что сделать миру (данные);
 *   rejected — выбора нет или он недоступен: состояние как было.
 */
export function stepTalk(state, action, tree, ctx, memory = {}) {
  if (!state) return { state: null, memory, effects: [], rejected: true };
  if (!action) return { state, memory, effects: [], rejected: true };
  if (action.type === 'close') return { state: null, memory, effects: [], rejected: false };
  if (action.type !== 'say') return { state, memory, effects: [], rejected: true };

  const choice = choicesOf(tree, state.node, ctx).find((c) => c.id === action.id);
  if (!choice) return { state, memory, effects: [], rejected: true };

  const effects = (choice.do || []).map((effect) => ({ ...effect }));
  if (!choice.next || !tree.nodes[choice.next]) {
    return { state: null, memory, effects, rejected: false, chose: choice.id };
  }
  const n = memory[choice.next] || 0;
  return {
    state: { with: state.with, node: choice.next, n },
    memory: { ...memory, [choice.next]: n + 1 },
    effects,
    rejected: false,
    chose: choice.id,
  };
}

/* Что показать: имя, строка, выборы (id и текст). Для main.js и прогона. */
export function talkView(state, tree, ctx) {
  if (!state || !tree) return null;
  return {
    with: state.with,
    name: tree.name,
    node: state.node,
    line: lineOf(tree, state.node, state.n),
    choices: choicesOf(tree, state.node, ctx).map((c) => ({ id: c.id, text: c.text })),
  };
}

/*
 * Проверка дерева (для тестов): каждый `next` и каждый вход ведут в
 * существующий узел, у узла 1–3 выбора, строки не длиннее `max` знаков
 * (телефон, п.2: строка в одну-две строки над кнопками стихий).
 */
export function lintTree(tree, max = 70) {
  const problems = [];
  for (const rule of tree.start || []) {
    if (!tree.nodes[rule.node]) problems.push(`вход в несуществующий узел ${rule.node}`);
  }
  for (const [id, node] of Object.entries(tree.nodes)) {
    for (const line of asList(node.say)) {
      if (typeof line !== 'string' || !line.length) problems.push(`${id}: пустая строка`);
      else if (line.length > max) problems.push(`${id}: строка ${line.length} > ${max}`);
    }
    const choices = node.choices || [];
    if (choices.length < 1 || choices.length > 3) problems.push(`${id}: выборов ${choices.length}`);
    for (const c of choices) {
      if (c.next && !tree.nodes[c.next]) problems.push(`${id}/${c.id}: next → ${c.next} нет`);
      if (!c.text || c.text.length > 40) problems.push(`${id}/${c.id}: текст выбора ${c.text ? c.text.length : 0}`);
    }
  }
  return problems;
}
