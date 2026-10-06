/*
 * ЗАДАНИЯ — ЖУРНАЛ (слой «г», 03.10.2026)
 * =========================================================
 * ФИНИШ.md, пункт 3: «Ядро из башни — обязательное задание, плюс минимум
 * два необязательных у жителей. У каждого задания минимум два решения из
 * четырёх видов: бой, скрытность, хитрость стихиями, разговор».
 *
 * ОТКУДА. Перенесено из QueQuest (READ-ONLY, ~/dev/_games/QueQuest),
 * src/game/quest-guild.js, чистая часть до DOM (~:304):
 *   - quest({…}) / approach(id, …) — замороженные записи заданий и
 *     подходов: у одного заказа три подхода, каждый ведёт к результату;
 *   - isGuildQuestUnlocked(profile, item) — `requires` → { ok, reason }:
 *     задание закрыто, пока не сделано связанное;
 *   - evaluateGuildApproach — выбранный подход проверяется по записи.
 * Здесь подход — вид решения (бой / скрытность / хитрость / разговор), а
 * выбирает его не кнопка, а то, что игрок сделал в мире: какое решение
 * сработало, решает src/zhiteli.js и сообщает сюда.
 *
 * ЧИСТЫЙ МОДУЛЬ: журнал — данные, шаг — редьюсер (как stepFirstShift
 * в first-shift.js): действие → новый журнал и события. Ни мира, ни DOM.
 *
 * СОСТОЯНИЯ: не взято → взято → сделано | провалено. Сделанное и
 * проваленное — навсегда (за попытку). Сделать можно и не взяв, если
 * задание это допускает (`blind: true`): Прага в Deus Ex засчитывает
 * дело, даже если ты о нём не спрашивал.
 */

export const STATE = {
  open: 'ne-vzyato',
  taken: 'vzyato',
  done: 'sdelano',
  failed: 'provaleno',
};
export const STATE_NAMES = {
  'ne-vzyato': 'НЕ ВЗЯТО',
  vzyato: 'ВЗЯТО',
  sdelano: 'СДЕЛАНО',
  provaleno: 'ПРОВАЛЕНО',
};

/* Четыре вида решения из финишной черты. */
export const KINDS = {
  boi: 'БОЙ',
  skrytnost: 'СКРЫТНОСТЬ',
  hitrost: 'ХИТРОСТЬ СТИХИЯМИ',
  razgovor: 'РАЗГОВОР',
};

/*
 * Коды для счётчика (правило 30: только числа, ничего про человека).
 * Номер значит одно и то же навсегда — новые задания дописываются в
 * конец, старые номера не переезжают.
 */
export const QUEST_CODE = { yadro: 1, molot: 2, kletka: 3, kolco: 4 };
export const STATE_CODE = { 'ne-vzyato': 0, vzyato: 1, sdelano: 2, provaleno: 3 };
export const SOLUTION_CODE = { boi: 1, skrytnost: 2, hitrost: 3, razgovor: 4 };

const freeze = (v) => Object.freeze(v);

/* Подход (quest-guild.js: approach) — вид решения и как его назвать игроку. */
export function approach(kind, human) {
  if (!KINDS[kind]) throw new Error(`неизвестный вид решения: ${kind}`);
  return freeze({ kind, human });
}

/* Задание (quest-guild.js: quest). `must` — обязательное. */
export function quest({ id, title, giver = null, must = false, brief, approaches, requires = {}, blind = false }) {
  if (!approaches || approaches.length < 2) throw new Error(`у задания ${id} меньше двух решений`);
  return freeze({ id, title, giver, must, brief, approaches: freeze(approaches), requires: freeze({ ...requires }), blind });
}

export function createQuestLog(defs) {
  const entries = {};
  for (const def of defs) entries[def.id] = { state: STATE.open, solution: null, at: null, why: null };
  return { entries };
}

export function questState(log, id) {
  return log && log.entries[id] ? log.entries[id].state : null;
}

/* quest-guild.js: isGuildQuestUnlocked — `requires.done` — сначала сделай это. */
export function isUnlocked(log, def) {
  const need = def.requires && def.requires.done;
  if (!need || !need.length) return { ok: true, reason: '' };
  const missing = need.filter((id) => questState(log, id) !== STATE.done);
  return missing.length ? { ok: false, reason: `сначала: ${missing.join(', ')}` } : { ok: true, reason: '' };
}

const FINAL = new Set([STATE.done, STATE.failed]);

/*
 * Шаг журнала. Действия:
 *   { type: 'take', id, t }
 *   { type: 'done', id, solution, t }
 *   { type: 'fail', id, why, t }
 * Возвращает { log, events, rejected }. Недопустимое (взять сделанное,
 * сдать проваленное, неизвестный вид решения) — журнал как был.
 */
export function stepQuests(log, action, defs) {
  const def = defs.find((d) => d.id === (action && action.id));
  const entry = def && log.entries[def.id];
  const same = { log, events: [], rejected: true };
  if (!def || !entry) return same;

  const put = (patch) => {
    const next = { ...entry, ...patch };
    return {
      log: { entries: { ...log.entries, [def.id]: next } },
      events: [{ type: 'quest', id: def.id, state: next.state, solution: next.solution }],
      rejected: false,
    };
  };

  if (action.type === 'take') {
    if (entry.state !== STATE.open) return same;
    if (!isUnlocked(log, def).ok) return same;
    return put({ state: STATE.taken, at: action.t ?? null });
  }
  if (action.type === 'done') {
    if (FINAL.has(entry.state)) return same;
    if (!KINDS[action.solution]) return same;
    if (entry.state === STATE.open && !def.blind) return same;
    return put({ state: STATE.done, solution: action.solution, at: action.t ?? null });
  }
  if (action.type === 'fail') {
    if (FINAL.has(entry.state)) return same;
    return put({ state: STATE.failed, why: action.why || null, at: action.t ?? null });
  }
  return same;
}

/* Для экрана журнала: что показать по каждому заданию. */
export function questsView(log, defs) {
  return defs.map((def) => {
    const entry = log.entries[def.id];
    return {
      id: def.id,
      title: def.title,
      must: def.must,
      state: entry.state,
      stateName: STATE_NAMES[entry.state],
      solution: entry.solution,
      solutionName: entry.solution ? KINDS[entry.solution] : null,
      brief: def.brief,
      ways: def.approaches.map((a) => KINDS[a.kind]),
    };
  });
}

/* Счётчик: событие журнала → [имя, данные] только числами. */
export function questPulse(event) {
  if (!event || event.type !== 'quest') return null;
  return ['lestnica_quest', {
    id: QUEST_CODE[event.id] || 0,
    state: STATE_CODE[event.state] ?? -1,
    solution: event.solution ? (SOLUTION_CODE[event.solution] || 0) : 0,
  }];
}
