/*
 * Прогресс ученика. Хранится локально, а при входе в общий аккаунт
 * подхватывается адаптером синхронизации без изменения остального кода.
 */

import { TIERS, lessons, lessonById } from './content/index.js';

const KEY = 'qaquest.v2';
const LEGACY_DONE = 'qaquest.completed';

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function daysBetween(from, to) {
  if (!from) return null;
  const diff = Date.parse(`${to}T00:00:00`) - Date.parse(`${from}T00:00:00`);
  return Math.round(diff / 86400000);
}

function blank() {
  return {
    version: 2,
    // Полный курс — единственный маршрут, пока его доводим до конца.
    // Поля оставлены ради уже сохранённого прогресса прошлой версии.
    mode: 'deep',
    modePicked: true,
    tasks: {},
    code: {},
    checks: {},
    streak: { current: 0, best: 0, lastDay: null },
    unlocked: { python: true, testing: false, llm: false },
    updatedAt: 0,
  };
}

/**
 * Курс переписан целиком, поэтому старые миссии MVP переносятся по карте
 * соответствий: пройденная миссия закрывает первую задачу нового урока.
 * Ключи прежней версии не удаляются — они ничему не мешают.
 */
const LEGACY_MAP = {
  'py-01': 'py-vars', 'py-types': 'py-types', 'py-07': 'py-strings',
  'py-03': 'py-numbers', 'py-logic': 'py-logic', 'py-02': 'py-if',
  'py-list-methods': 'py-list', 'py-08': 'py-dict', 'py-09': 'py-for',
  'py-04': 'py-for', 'py-05': 'py-func', 'py-06': 'py-errors',
  'py-assert': 'qa-assert', 'py-10': 'py-project',
};

function importLegacy(state) {
  try {
    const done = JSON.parse(localStorage.getItem(LEGACY_DONE) || '[]');
    if (!Array.isArray(done)) return state;
    done.forEach((id) => {
      const lesson = lessonById(LEGACY_MAP[id] || '');
      if (lesson) state.tasks[`${lesson.id}:${lesson.tasks[0].id}`] = { done: true, at: 0, firstTry: false };
    });
  } catch (_) { /* старый формат повреждён — начинаем с чистого */ }
  return state;
}

export const store = {
  state: blank(),
  remote: null,
};

const listeners = new Set();

export function subscribe(callback) {
  listeners.add(callback);
  callback(store.state);
  return () => listeners.delete(callback);
}

function notify() {
  listeners.forEach((callback) => callback(store.state));
}

let saveTimer = null;
function persist({ immediate = false } = {}) {
  store.state.updatedAt = Date.now();
  clearTimeout(saveTimer);
  const write = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(store.state));
    } catch (_) { /* приватный режим браузера — работаем без сохранения */ }
    if (store.remote) store.remote.push(store.state);
  };
  if (immediate) write();
  else saveTimer = setTimeout(write, 400);
  notify();
}

export function loadStore() {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch (_) { saved = null; }
  store.state = saved && saved.version === 2 ? { ...blank(), ...saved } : importLegacy(blank());
  // Старое «Коротко» не должно обрезать урок для вернувшегося человека.
  store.state.mode = 'deep';
  store.state.modePicked = true;
  store.state.checks = store.state.checks || {};
  store.state.unlocked = { ...blank().unlocked, ...(store.state.unlocked || {}) };
  refreshUnlocks();
  notify();
  return store.state;
}

/* ---------- чтение прогресса ---------- */

export const taskKey = (lessonId, taskId) => `${lessonId}:${taskId}`;

export function isTaskDone(lessonId, taskId) {
  return Boolean(store.state.tasks[taskKey(lessonId, taskId)]?.done);
}

/** Пока делаем один полный маршрут: урок закрывают все его задачи. */
export function requiredTasks(lesson) {
  return lesson.tasks;
}

export function lessonState(lesson) {
  const done = lesson.tasks.filter((task) => isTaskDone(lesson.id, task.id));
  const required = requiredTasks(lesson);
  const doneRequired = required.filter((task) => isTaskDone(lesson.id, task.id));
  return {
    doneCount: done.length,
    total: lesson.tasks.length,
    // Полный маршрут закрывается только всеми задачами урока.
    requiredDone: doneRequired.length,
    requiredTotal: required.length,
    complete: doneRequired.length === required.length,
    mastered: done.length === lesson.tasks.length,
    xp: done.reduce((sum, task) => sum + task.xp, 0),
  };
}

export function tierState(tierId) {
  const list = lessons.filter((lesson) => lesson.tier === tierId);
  const complete = list.filter((lesson) => lessonState(lesson).complete).length;
  return {
    lessons: list,
    complete,
    total: list.length,
    ratio: list.length ? complete / list.length : 0,
    unlocked: Boolean(store.state.unlocked[tierId]),
  };
}

export function totalXp() {
  return lessons.reduce((sum, lesson) => sum + lessonState(lesson).xp, 0);
}

export function levelInfo() {
  const xp = totalXp();
  let level = 1;
  let need = 120;
  let rest = xp;
  while (rest >= need) {
    rest -= need;
    level += 1;
    need = Math.round(need * 1.25);
  }
  return { xp, level, into: rest, need };
}

/**
 * Урок открыт, если ступень открыта и закрыт предыдущий урок того же слоя.
 * Тренажёр и практикум — две независимые цепочки: практикум не заперт за
 * одиннадцатью браузерными упражнениями, а тому, кто пришёл именно за
 * практикумом, не нужно сначала проходить тренажёр.
 */
export function isLessonOpen(lesson) {
  if (!store.state.unlocked[lesson.tier]) return false;
  const list = lessons.filter((item) => item.tier === lesson.tier && item.kind === lesson.kind);
  const position = list.findIndex((item) => item.id === lesson.id);
  if (position <= 0) return true;
  return lessonState(list[position - 1]).complete;
}

export function nextLesson() {
  return lessons.find((lesson) => isLessonOpen(lesson) && !lessonState(lesson).complete) || null;
}

/* ---------- изменение прогресса ---------- */

export function saveCode(lessonId, taskId, code) {
  store.state.code[taskKey(lessonId, taskId)] = code;
  persist();
}

/* ---------- чек-лист практикума ---------- */

/**
 * Ступени 2 и 3 выполняются на своей машине, автоматически их не проверить.
 * Поэтому критерий завершения — отмеченные пункты done_when из практикума.
 */
export function checkedItems(lesson, task) {
  const saved = store.state.checks[taskKey(lesson.id, task.id)];
  const items = task.items || [];
  return items.map((_, index) => Boolean(saved && saved[index]));
}

export function toggleCheck(lesson, task, index) {
  const key = taskKey(lesson.id, task.id);
  const marks = checkedItems(lesson, task);
  marks[index] = !marks[index];
  store.state.checks[key] = marks;
  if (marks.every(Boolean)) return completeTask(lesson, task, { firstTry: false });
  persist();
  return null;
}

export function loadCode(lessonId, taskId, fallback) {
  const saved = store.state.code[taskKey(lessonId, taskId)];
  return typeof saved === 'string' ? saved : fallback;
}

function bumpStreak() {
  const streak = store.state.streak;
  const day = today();
  if (streak.lastDay === day) return false;
  const gap = daysBetween(streak.lastDay, day);
  streak.current = gap === 1 ? streak.current + 1 : 1;
  streak.best = Math.max(streak.best, streak.current);
  streak.lastDay = day;
  return true;
}

/** Следующая ступень открывается, когда пройдено не меньше 80% предыдущей. */
function refreshUnlocks() {
  const order = TIERS.map((tier) => tier.id);
  let changed = false;
  order.forEach((tierId, index) => {
    if (index === 0) return;
    if (store.state.unlocked[tierId]) return;
    const previous = tierState(order[index - 1]);
    if (previous.total && previous.ratio >= 0.8) {
      store.state.unlocked[tierId] = true;
      changed = true;
    }
  });
  return changed;
}

export function unlockTier(tierId) {
  if (store.state.unlocked[tierId]) return;
  store.state.unlocked[tierId] = true;
  persist({ immediate: true });
}

export function completeTask(lesson, task, { firstTry = false } = {}) {
  const key = taskKey(lesson.id, task.id);
  const already = Boolean(store.state.tasks[key]?.done);
  const beforeLevel = levelInfo().level;
  store.state.tasks[key] = {
    done: true,
    at: Date.now(),
    firstTry: already ? store.state.tasks[key].firstTry : firstTry,
  };
  const streakGrew = already ? false : bumpStreak();
  const unlocked = refreshUnlocks();
  persist({ immediate: true });
  return {
    already,
    xp: already ? 0 : task.xp,
    leveledUp: levelInfo().level > beforeLevel,
    streakGrew,
    tierUnlocked: unlocked,
  };
}

export function resetProgress() {
  store.state = blank();
  persist({ immediate: true });
}

/* ---------- синхронизация с общим аккаунтом ---------- */

/** Объединяем локальное и серверное: решённое не теряется ни на одном устройстве. */
export function mergeState(remote) {
  if (!remote || remote.version !== 2) return;
  const local = store.state;
  Object.entries(remote.tasks || {}).forEach(([key, value]) => {
    const mine = local.tasks[key];
    if (!mine) {
      local.tasks[key] = value;
      return;
    }
    local.tasks[key] = {
      done: Boolean(mine.done || value.done),
      at: Math.min(mine.at || Infinity, value.at || Infinity) || 0,
      firstTry: Boolean(mine.firstTry || value.firstTry),
    };
  });
  Object.entries(remote.checks || {}).forEach(([key, value]) => {
    const mine = local.checks[key];
    if (!mine) {
      local.checks[key] = value;
      return;
    }
    local.checks[key] = mine.map((mark, index) => Boolean(mark || value[index]));
  });
  Object.entries(remote.code || {}).forEach(([key, value]) => {
    if (!local.code[key] || (remote.updatedAt || 0) > (local.updatedAt || 0)) local.code[key] = value;
  });
  const streak = remote.streak || {};
  local.streak.best = Math.max(local.streak.best || 0, streak.best || 0);
  if ((streak.lastDay || '') > (local.streak.lastDay || '')) {
    local.streak.lastDay = streak.lastDay;
    local.streak.current = streak.current || local.streak.current;
  }
  Object.entries(remote.unlocked || {}).forEach(([tier, open]) => {
    if (open) local.unlocked[tier] = true;
  });
  refreshUnlocks();
  persist({ immediate: true });
}

export function attachRemote(remote) {
  store.remote = remote;
}
