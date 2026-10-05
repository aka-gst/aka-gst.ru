// 18.0: the skill tree and the quest log (Сергей 03.10): «Прокачка = дерево
// веток, видно, что дальше» and «квест-лог как в RPG: Главный сюжет /
// Дополнительные / На деньги / Фриланс». Replaces «ВЫБЕРИ ПРОФЕССИЮ» with its
// «ЗАКРЫТО · НУЖНО PRINT + IF + FOR» that a player who never saw those words
// could not understand. Every gate here names what to DO in the world.
//
// Pure data from game state; tools/progress-map.test.mjs checks it.

const ERA_NODES = Object.freeze([
  ['wolf', 'WOLF 3D', '▦', 'Стены лучами, мир из клеток.'],
  ['doom', 'DOOM', '▲', 'Текстуры на полу, свет гаснет вдали.'],
  ['duke', 'DUKE 3D', '◩', 'Взгляд вверх-вниз, зеркала, цветной свет.'],
  ['quake', 'QUAKE', '◆', 'Настоящие полигоны и z-буфер.'],
  ['unreal', 'UNREAL', '✶', 'Мягкий свет, отражения.'],
  ['hl', 'HALF-LIFE', 'λ', 'Живой мир. Только тут видно финального босса.'],
]);

// What to do in the world to open a key. Never a bare keyword.
export const WORLD_GATES = Object.freeze({
  print: 'Скажи руке «wake» словами — день 2, терминал у руки',
  if: 'Научи руку брать только белые ящики — день 2',
  for: 'Разгрузи фуру вечером дня 2: «для каждого ящика»',
  while: 'Переживи ночную смену: рука работает одна, пока есть ящики',
  func: 'Собери один маршрут для двух линий — день 3',
});
export function worldGate(missing = []) {
  const uniq = [...new Set(missing.map((k) => WORLD_GATES[k] ?? k))];
  return uniq.length ? uniq[0] : '';
}

// Who you become in each realm (career-worlds SKILL_ROLES), short for nodes.
export const PROFESSION_NAMES = Object.freeze({ automation: 'Автоматизатор', vehicle: 'Автохакер', security: 'Защитник', web: 'Создатель сайтов', ai: 'Тренер ИИ', systems: 'Спасатель систем', lowlevel: 'Знаток железа' });

import { floorsOf } from './mastery.js';

const FLOOR_NAMES = Object.freeze(['ТЫК', 'РУЧКИ', 'КОД', 'С НУЛЯ']);
export { FLOOR_NAMES };

function after(checkpoint, list) { return list.includes(checkpoint); }
const AFTER_DAY2 = ['red2', 'condition', 'reward2', 'forlesson', 'reward-for', 'shift3', 'queue', 'reward3', 'function', 'reward4', 'friends', 'reward5', 'vika', 'reward6', 'virus', 'reward7', 'foundry', 'reward8', 'campus', 'ai-lab', 'reward9', 'llm-lab', 'reward10'];

// floors: [tap, knobs, code, raw] as booleans (canon §13).
// The pips come from the §13 registry (profile.mastery, mastery.js); the
// learning flags only fill in floors for saves made before 18.1.
export function pythonSkills({ learning = {}, warehouse = {}, checkpoint = 'start', mastery = {} } = {}) {
  const fromRegistry = (id, flags) => floorsOf({ mastery }, id).map((on, i) => on || flags[i]);
  const day2 = warehouse.day2;
  const printTap = Boolean(learning.printUnlocked || (day2 && day2 !== 'button') || after(checkpoint, AFTER_DAY2));
  const printRaw = Boolean(learning.printUnlocked && (day2 === 'done' || after(checkpoint, AFTER_DAY2)));
  const ifSeen = Boolean(warehouse.ruleStage || learning.ifUnlocked);
  const list = [
    { id: 'print', icon: '›_', title: 'Сказать машине', code: 'print', floors: [printTap, Boolean(learning.printUnlocked), Boolean(learning.printUnlocked), printRaw], gate: WORLD_GATES.print, what: 'Кнопка → слово → print("wake").' },
    { id: 'if', icon: '⑂', title: 'Выбрать по условию', code: 'if', floors: [ifSeen, Boolean(learning.rulesBuilt || learning.ifUnlocked), Boolean(learning.ifUnlocked), Boolean(learning.ifUnlocked)], gate: WORLD_GATES.if, what: 'Панель правил → «если белый — бери» → if.' },
    { id: 'for', icon: '⟳', title: 'Для каждого', code: 'for', floors: [Boolean(learning.forUnlocked || warehouse.lessonStage && checkpoint === 'forlesson'), Boolean(learning.forUnlocked), Boolean(learning.forUnlocked), Boolean(learning.forUnlocked)], gate: WORLD_GATES.for, what: 'Кнопка «повторить» → «для каждого в партии» → for box in boxes:' },
    { id: 'while', icon: '↻', title: 'Пока есть работа', code: 'while / for', floors: [Boolean(learning.whileUnlocked), Boolean(learning.whileUnlocked), Boolean(learning.whileUnlocked), false], gate: WORLD_GATES.while, what: 'Очередь живая: повторяй, пока она не пуста.' },
    { id: 'def', icon: 'ƒ', title: 'Свой навык с именем', code: 'def', floors: [Boolean(learning.funcUnlocked), Boolean(learning.funcUnlocked), Boolean(learning.funcUnlocked), false], gate: WORLD_GATES.func, what: 'Одно правило — две линии.' },
    { id: 'dict', icon: '{}', title: 'Свойства клетки', code: 'dict', floors: [Boolean(learning.dictUnlocked), Boolean(learning.dictUnlocked), Boolean(learning.dictUnlocked), false], gate: 'Вечер у друзей: помоги Вике вспомнить', what: 'Словарь = свойства клетки мира: стена, свет, дверь.' },
    { id: 'try', icon: '⛨', title: 'Пережить ошибку', code: 'try', floors: [Boolean(learning.reliabilityUnlocked), Boolean(learning.reliabilityUnlocked), Boolean(learning.reliabilityUnlocked), false], gate: 'Вирус ломает процесс — удержи его', what: 'Процесс не падает от неожиданности.' },
    { id: 'class', icon: '▣', title: 'Вещи с методами', code: 'class', floors: [false, false, false, false], gate: 'Скоро: дверь, выключатель, телевизор — объекты с методами', what: 'door.open(), lamp.toggle(), tv.show(картинка).' },
  ];
  return list.map((sk) => ({ ...sk, floors: fromRegistry(sk.id === 'def' ? 'def' : sk.id, sk.floors.map(() => false)).map((on, i) => on || sk.floors[i]) }));
}

function nodeState(done, prevDone) { return done ? 'done' : (prevDone ? 'next' : 'locked'); }

export function skillTree({ learning = {}, warehouse = {}, checkpoint = 'start', engine = { era: 0, toNext: 0 }, realms = [], realmWins = [], mastery = {} } = {}) {
  const py = pythonSkills({ learning, warehouse, checkpoint, mastery });
  let prev = true;
  const python = py.map((s) => {
    const done = s.floors[2];
    const n = { ...s, kind: 'skill', state: nodeState(done, prev) };
    prev = done;
    return n;
  });
  const era = Math.max(0, Math.min(ERA_NODES.length - 1, engine.era ?? 0));
  const engineNodes = ERA_NODES.map(([id, title, icon, what], i) => ({
    id: `era-${id}`, kind: 'era', icon, title, what,
    state: i < era ? 'done' : (i === era ? 'now' : (i === era + 1 ? 'next' : 'locked')),
    gate: i === era ? `Ты здесь. До следующей эпохи — ещё ${Math.max(1, engine.toNext ?? 1)}: учи команды, отрабатывай смены, чини машины.`
      : i === era + 1 ? `Ещё ${Math.max(1, engine.toNext ?? 1)} шаг(а): учи команды, отрабатывай смены, чини машины` : (i > era + 1 ? 'Сначала предыдущая эпоха' : ''),
  }));
  engineNodes.push({ id: 'boss', kind: 'boss', icon: '?', title: '???', what: 'Финальный босс. Виден только на максимуме движка.', state: 'locked', gate: 'Допиши движок до Half-Life' });
  const wins = new Set(realmWins);
  const professions = realms.map((r) => {
    const missing = (r.gate ?? []).filter((k) => !learning[{ print: 'printUnlocked', if: 'ifUnlocked', for: 'forUnlocked', while: 'whileUnlocked', func: 'funcUnlocked' }[k]]);
    return {
      id: `realm-${r.id}`, realm: r.id, kind: 'realm', icon: r.glyph ?? '◇', title: PROFESSION_NAMES[r.id] ?? r.title, what: `${r.title} · ${r.subtitle ?? ''}`,
      state: wins.has(r.id) ? 'done' : (missing.length ? 'locked' : 'next'),
      gate: missing.length ? worldGate(missing) : 'Открыто — заходи',
    };
  });
  return [
    { id: 'engine', title: 'ГЛАВНЫЙ СЮЖЕТ · ПИШЕШЬ ДВИЖОК', nodes: engineNodes },
    { id: 'python', title: 'PYTHON · ЧЕМУ НАУЧИЛАСЬ РУКА', nodes: python },
    { id: 'realms', title: 'ПРОФЕССИИ · ДВЕРИ В МИРЫ', nodes: professions },
  ];
}

// ------------------------------------------------------------- quest log --

const MAIN = Object.freeze([
  { id: 'q-manual', title: 'Не твой участок', giver: 'Начальник', goal: 'Перенеси три ящика на ленту и подойди к начальнику.', short: 'Перенеси 3 ящика на ленту', reward: '60 ₽', doneAt: ['chip', 'machine', 'red-crate', 'reward', 'shift2', ...AFTER_DAY2] },
  { id: 'q-chip', title: 'Мёртвая рука 07', giver: 'Чип с пола', goal: 'Вставь сервисный чип в руку — пусть таскает сама.', short: 'Вставь чип в руку 07', reward: '120 ₽ · рука работает', doneAt: ['reward', 'shift2', ...AFTER_DAY2] },
  { id: 'q-word', title: 'Слово для руки', giver: 'Терминал руки', goal: 'Нажми зелёную кнопку, а потом скажи руке «wake» словами.', short: 'Скажи руке wake словами', reward: 'навык print', done: (s) => Boolean(s.learning.printUnlocked) },
  { id: 'q-torn', title: 'Кто разрешил?!', giver: 'Начальник', goal: 'Кнопку оторвали. Заставь руку работать без неё.', short: 'Рука без кнопки: снова скажи wake', reward: '60 ₽', done: (s) => s.warehouse.day2 === 'done' || after(s.checkpoint, AFTER_DAY2) },
  { id: 'q-white', title: 'Только белые', giver: 'Начальник по рации', goal: 'Придумай правило: белые — брать, красные — оставить. Сначала кнопками, потом if.', short: 'Только белые: придумай правило', reward: 'навык if · без штрафа', done: (s) => Boolean(s.learning.ifUnlocked) },
  { id: 'q-for', title: 'Фура', giver: 'Начальник по рации', goal: 'Партия ящиков, в каждой разное число. Скажи руке: для каждого.', short: 'Фура: «для каждого ящика»', reward: 'навык for', done: (s) => Boolean(s.learning.forUnlocked) },
  { id: 'q-night', title: 'Ночная смена', giver: 'Рука 07', goal: 'Рука остаётся одна: пусть работает, пока есть ящики.', short: 'Ночная смена: пока есть ящики', reward: 'навык while', done: (s) => Boolean(s.learning.whileUnlocked) },
  { id: 'q-lines', title: 'Две линии', giver: 'Начальник', goal: 'Одно правило на две линии — собери свой навык с именем.', short: 'Одно правило на две линии', reward: 'навык def', done: (s) => Boolean(s.learning.funcUnlocked) },
  { id: 'q-engine', title: 'Движок', giver: 'Ты · из будущего', goal: 'Пиши движок от Wolfenstein до Half-Life. Только на максимуме виден финальный босс.', short: 'Пиши движок дальше', reward: 'новая эпоха мира', done: () => false },
]);

const SIDE = Object.freeze([
  { id: 's-door', title: 'Только для мееенеджеров', giver: 'Дверь начальника', goal: 'Попробуй войти в кабинет начальника. Тебя не пустят — но попробуй.', reward: 'улыбка', done: (s) => Boolean(s.flags.doorGag) },
  { id: 's-pocket', title: 'Сувенир', giver: 'Грузчик', goal: 'Подними оторванную начальником кнопку. На память.', reward: 'кнопка в кармане', done: (s) => s.warehouse.button === 'pocket', available: (s) => ['torn', 'pocket'].includes(s.warehouse.button) },
  { id: 's-clock', title: 'Обед в 11:00', giver: 'Грузчик', goal: 'Грузчик обедает с утра. Посмотри на часы у него над головой.', reward: '—', done: (s) => Boolean(s.flags.sawClock) },
  { id: 's-sorter', title: 'Поиграть с правилом', giver: 'Сортировочный цех', goal: 'Бонус: собери правила для разных ящиков без штрафов.', reward: 'опыт', done: () => false, available: (s) => Boolean(s.learning.ifUnlocked) },
]);

export function questLog({ learning = {}, warehouse = {}, checkpoint = 'start', flags = {}, realms = [], realmWins = [], realmPay = 300 } = {}) {
  const s = { learning, warehouse, checkpoint, flags };
  let found = false;
  const main = MAIN.map((q) => {
    const done = q.done ? q.done(s) : q.doneAt.includes(checkpoint);
    // The engine is a thread that runs through the whole game: always open.
    const status = done ? 'done' : (q.id === 'q-engine' || !found ? 'active' : 'locked');
    if (!done && q.id !== 'q-engine') found = true;
    return { ...q, status, done: undefined, doneAt: undefined };
  });
  const side = SIDE.map((q) => {
    const done = q.done(s);
    const status = done ? 'done' : (q.available && !q.available(s) ? 'locked' : 'active');
    return { ...q, status, done: undefined, available: undefined };
  });
  const wins = new Set(realmWins);
  const money = realms.map((r) => {
    const missing = (r.gate ?? []).filter((k) => !learning[{ print: 'printUnlocked', if: 'ifUnlocked', for: 'forUnlocked', while: 'whileUnlocked', func: 'funcUnlocked' }[k]]);
    return { id: `m-${r.id}`, realm: r.id, title: r.title, giver: r.subtitle?.split('·')[0]?.trim() || 'Профессия', goal: String(r.prompt ?? '').split(/(?<=[.!?])\s/)[0], reward: `${realmPay} ₽ за день`, status: wins.has(r.id) ? 'done' : (missing.length ? 'locked' : 'active'), gate: missing.length ? worldGate(missing) : '' };
  });
  const garageOpen = !(realms.find((r) => r.id === 'vehicle')?.gate ?? ['print', 'if']).some((k) => !learning[`${k}Unlocked`]);
  const freelance = [
    { id: 'f-pythonio', title: 'Питонио · сортировочный цех', giver: 'Компьютер дома', goal: 'Заказы на сортировку: руками, таблицей правил или своим def route().', reward: 'за каждый заказ' },
    { id: 'f-jumpkill', title: 'JUMP KILL · 13 уровней', giver: 'Автомат в гараже', goal: 'Пройди арену уровень за уровнем.', reward: 'рубли за уровень' },
    { id: 'f-locks', title: 'Замки Сани', giver: 'Саня, гараж', goal: 'Вскрой замки на доске: штифты руками, потом скриптом.', reward: 'детали и рубли' },
  ].map((q) => ({ ...q, status: garageOpen ? 'active' : 'locked', gate: garageOpen ? '' : 'Откроется в гараже: научи руку брать только белые (день 2)' }));
  const current = main.find((q) => q.status === 'active' && q.id !== 'q-engine') ?? main[main.length - 1];
  return { tabs: { main, side, money, freelance }, current };
}

// The one-line HUD pin for the current main quest.
export function questPin(log) {
  const q = log?.current;
  return q ? `${q.short ?? q.title}` : '';
}
