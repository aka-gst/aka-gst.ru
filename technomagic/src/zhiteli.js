/*
 * ЖИТЕЛИ «БАШНИ»: РАЗГОВОРЫ, ЗАДАНИЯ, РЕПУТАЦИЯ (слой «г», 03.10.2026)
 * =========================================================
 * Сергей, 03.10 04:25: «маленькая РПГшка, как Прага в Deus Ex, где можно
 * пройти задания разными способами… можно разговаривать с персонажами…
 * отыгрываешь жителя… что-то обязательно, что-то нет… и как в Ultima
 * Online». ФИНИШ.md, пункт 3 — задания; пункт 4 — свидетеля можно
 * «уговорить».
 *
 * Это клей: чистые движки — src/razgovory.js (разговор) и src/zadaniya.js
 * (журнал); здесь — жители этого этажа, их слова, задания этажа и то,
 * как выбор реплики и дела в мире становятся сделанным заданием. Всё
 * идёт через update() мира, как у стражи и свидетелей, — значит прогон в
 * Node видит ровно то, что увидит человек.
 *
 * МИР НЕ СТОИТ, ПОКА ГОВОРИШЬ (решение слоя «г»). Как в Ultima Online:
 * разговор — полоса реплик поверх игры, стража на постах продолжает
 * смотреть, огонь горит. Причины: (1) иначе разговор — стоп-кадр, которым
 * можно заморозить дозор посреди его конуса, и стелс перестаёт быть
 * стелсом; (2) стражи здесь стоят на постах, а не бродят, — кто стоял в
 * тени, тот и говорит в тени; (3) прогону не нужен особый режим. Отошёл
 * дальше 3.5 клетки, житель упал, поднялась ТРЕВОГА — разговор
 * обрывается сам. Если отрисовка решит ставить паузу — логика от этого не
 * ломается: пока update() не зовут, разговор просто ждёт.
 *
 * НАМЕРЕНИЯ (ввод — main.js, ещё не подключено):
 *   intent.talk = 'kuznec'     начать разговор (житель ближе TALK_REACH;
 *                              кого предложить — talkTarget(world))
 *   intent.say = 'molot'       выбрать реплику по её id
 *   intent.talkEnd = true      уйти из разговора
 *
 * ЖИТЕЛИ (клетка на карте → запись в LESTNICA.residents):
 *   kuznec     Кузнец, двор башни у сторожки. Даёт «Молот».
 *   mefodiy    Мефодий, у рва. Ангел в отставке, бросает курить — из
 *              рассказа Сергея «Близорукий торопыга» (мир-рассказов.md:
 *              ТЕХНОМАДЖИКА ← «Близорукий торопыга»; имя по канону п.35б).
 *              За монету или за чужой долг наврёт стражу.
 *   denis      Денис, в клетке у западной стены. Колдовал без спросу —
 *              оттуда же: Денис нашёл заклинание «О, могучий Эсперар,
 *              позволь этому миру…». Даёт «Клетку».
 *   podmaster  Подмастерье, двор мастерской. Знает, кто кому должен.
 *
 * ЗАДАНИЯ (src/zadaniya.js, решения — четыре вида из ФИНИША):
 *   yadro   обязательное: ядро к выходу. Бой / скрытность / хитрость —
 *           три пути «Башни» (world.route: boi / tiho / hitrost).
 *   molot   Кузнец: увести стража от ворот сторожки хоть на три клетки,
 *           кузнец сам сходит за молотом. Решение — по тому, что увело
 *           стража: монета (скрытность), Мефодий наврал (разговор),
 *           страж лежит (бой); любой другой шум — хитрость.
 *   kletka  Денис: снять поле клетки. Щиток на стене стихией (хитрость),
 *           или кузнец, которому помог, откроет ключом (разговор).
 *
 * РЕПУТАЦИЯ (слой «в» → «г»). Житель, видевший твоё преступление, не
 * говорит и зовёт ближайшего стража к себе (страж идёт — это видно).
 * Донесли хоть раз — розыск: говорить не станет никто, кроме тех, кого
 * ты уже купил. Бегущего свидетеля можно догнать и уговорить: монета или
 * «тебе показалось» (верят, только если видели порчу, а не нападение).
 */

import { openTalk, stepTalk, talkView as viewOf } from './razgovory.js';
import {
  quest, approach, createQuestLog, stepQuests, questsView, questState, STATE,
} from './zadaniya.js';
import { blocksMove, TILE_SIZE } from './level.js';
import { GROUND } from './field.js';
import { hasSight, setCircuit } from './world.js';
import { INVESTIGATE } from './vospriyatie/tuning.js';

/* Дальность разговора: сквозь прутья клетки — две клетки с хвостом. */
export const TALK_REACH = 2.25 * TILE_SIZE;
/* Отошёл дальше — разговор оборвался. */
export const TALK_LEAVE = 3.5 * TILE_SIZE;
/* Страж «ушёл с поста», когда дальше этого от поста. */
export const AWAY = 3 * TILE_SIZE;
/* Житель ходит медленнее бегущего свидетеля (100). */
export const WALK_SPEED = 80;
/* Через сколько секунд Мефодий крикнет стражу. Успеть отойти в тень. */
export const LIE_DELAY = 3;
/* Отказ висит на экране столько секунд. */
export const REFUSAL_TIME = 2.5;
/* Бегущий свидетель слушает не дольше этого — потом бежит дальше.
   Без этого разговор был бы цепью: открыл и стоишь, а он не донесёт
   никогда. */
export const WITNESS_PATIENCE = 6;
/* Видевший зовёт стража не чаще раза в столько секунд. */
export const CALL_COOLDOWN = 6;
/*
 * Поломка для проверки (п.6): `REPUTATION.wanted = false` — розыск
 * забыт, донесённому отвечают как чистому. Проверка «донесли — не
 * говорят» обязана от этого покраснеть (tests/sloy-g.mjs).
 */
export const REPUTATION = { wanted: true };


/* =========================================================
   СЛОВА
   =========================================================
   Строки — не длиннее 70 знаков (lintTree), выборы — 40: на телефоне
   они идут над кнопками стихий. Голос — бытовой, с усмешкой, как в
   «Близоруком торопыге»; цитат из рассказа нет, взяты имена, формула
   заклинания и то, что Мефодий бросает курить.
   ========================================================= */

const KUZNEC = {
  name: 'КУЗНЕЦ',
  start: [
    { if: { quest: 'molot', is: 'sdelano' }, node: 'drug' },
    { if: { quest: 'molot', is: 'vzyato' }, node: 'zhdu' },
    { node: 'privet' },
  ],
  nodes: {
    privet: {
      say: ['Ночь, а ты шатаешься. Чего надо?', 'Опять ты. Ну?'],
      choices: [
        { id: 'hmuryy', text: 'Чего такой хмурый?', if: { quest: 'molot', is: 'ne-vzyato' }, next: 'molot' },
        { id: 'bashnya', text: 'Что за башня?', next: 'bashnya' },
        { id: 'poka', text: 'Ничего. Бывай.', next: null },
      ],
    },
    molot: {
      say: 'Страж у сторожки отобрал мой молот. Стоит над ним, как над кладом.',
      choices: [
        { id: 'vzyat', text: 'Уведу его — заберёшь?', do: [{ quest: 'molot', to: 'vzyato' }], next: 'vzyal' },
        { id: 'net', text: 'Сам разбирайся.', next: null },
      ],
    },
    vzyal: {
      say: 'Уведёшь хоть на три шага — я мигом. Только без крови, ладно?',
      choices: [{ id: 'ok', text: 'Договорились.', next: null }],
    },
    zhdu: {
      say: ['Молот всё там же. Уведи стража от ворот.', 'Ну? Стоит же, гад.'],
      choices: [
        { id: 'kak', text: 'Как его увести?', next: 'kak' },
        { id: 'poka', text: 'Работаю.', next: null },
      ],
    },
    kak: {
      say: 'Монету кинь — они на звон идут. Или Мефодия у рва попроси.',
      choices: [{ id: 'ok', text: 'Понял.', next: null }],
    },
    drug: {
      say: ['Молот при мне. Должен буду.', 'Чего ещё?'],
      choices: [
        { id: 'kletka', text: 'Открой клетку Дениса.', if: { quest: 'kletka', is: ['ne-vzyato', 'vzyato'] },
          do: [{ act: 'open-cell' }], next: 'otkroyu' },
        { id: 'bashnya', text: 'Что за башня?', next: 'bashnya' },
        { id: 'poka', text: 'Бывай.', next: null },
      ],
    },
    otkroyu: {
      say: 'Клетку я ковал, ключ у меня. Пошли, выпущу дурня.',
      choices: [{ id: 'ok', text: 'Спасибо.', next: null }],
    },
    bashnya: {
      say: 'Ядро там. Щитоносцы кругом, поле. Тебе туда не надо.',
      choices: [{ id: 'ok', text: 'Посмотрим.', next: null }],
    },
  },
};

const MEFODIY = {
  name: 'МЕФОДИЙ',
  start: [
    { if: { flag: 'mefodiy-navral' }, node: 'posle' },
    { node: 'privet' },
  ],
  nodes: {
    privet: {
      say: ['Огоньку не будет? А, нет. Бросаю я.', 'Опять ты. Курить не дам.'],
      choices: [
        { id: 'strazh', text: 'Помоги со стражем у сторожки.', if: { quest: 'molot', is: 'vzyato' }, next: 'strazh' },
        { id: 'kto', text: 'Ты кто?', next: 'kto' },
        { id: 'poka', text: 'Бывай.', next: null },
      ],
    },
    kto: {
      say: 'Мефодий. Ангел в отставке. Желания исполнял — теперь вот курю.',
      choices: [
        { id: 'zhelanie', text: 'А моё исполнишь?', next: 'zhelanie' },
        { id: 'poka', text: 'Ясно.', next: null },
      ],
    },
    zhelanie: {
      say: 'Только истинные. И требует времени. Ты ж не дождёшься.',
      choices: [{ id: 'ok', text: 'Посмотрим.', next: null }],
    },
    strazh: {
      say: 'Наврать служивому? Это можно. Не за так.',
      choices: [
        { id: 'moneta', text: 'Держи монету.', if: { coins: 1 },
          do: [{ coins: -1 }, { act: 'lie-guard' }, { flag: 'mefodiy-navral' }], next: 'vru' },
        { id: 'dolg', text: 'Ты кузнецу три бутылки должен.', if: { flag: 'znaet-dolg' },
          do: [{ act: 'lie-guard' }, { flag: 'mefodiy-navral' }], next: 'vru' },
        { id: 'net', text: 'Обойдусь.', next: null },
      ],
    },
    vru: {
      say: 'Отойди в тень. Сейчас крикну ему, что у амбара шарятся.',
      choices: [{ id: 'ok', text: 'Спасибо.', next: null }],
    },
    posle: {
      say: ['Наврал как смог. Дальше сам.', 'Всё, я на пенсии.'],
      choices: [{ id: 'poka', text: 'Бывай.', next: null }],
    },
  },
};

const DENIS = {
  name: 'ДЕНИС',
  start: [
    { if: { flag: 'denis-svoboden' }, node: 'svoboden' },
    { if: { quest: 'kletka', is: 'vzyato' }, node: 'zhdu' },
    { node: 'privet' },
  ],
  nodes: {
    privet: {
      say: ['О, могучий Эсперар, позволь этому миру… А, это ты. Вытащи меня.', 'Ну что, вытащишь?'],
      choices: [
        { id: 'za-chto', text: 'За что сидишь?', next: 'za-chto' },
        { id: 'vzyat', text: 'Вытащу.', do: [{ quest: 'kletka', to: 'vzyato' }], next: 'kak' },
        { id: 'poka', text: 'Сиди пока.', next: null },
      ],
    },
    'za-chto': {
      say: 'Колдовал без спросу. Пятихатку наколдовал. Теперь вот.',
      choices: [
        { id: 'vzyat', text: 'Вытащу.', do: [{ quest: 'kletka', to: 'vzyato' }], next: 'kak' },
        { id: 'poka', text: 'Сиди.', next: null },
      ],
    },
    kak: {
      say: 'Поле от щитка на стене. Тихо — вода с разрядом. Или проси кузнеца.',
      choices: [{ id: 'ok', text: 'Жди.', next: null }],
    },
    zhdu: {
      say: ['Жду. Ключ у кузнеца, щиток на стене.', 'Ну?'],
      choices: [{ id: 'poka', text: 'Скоро.', next: null }],
    },
    svoboden: {
      say: ['Свободен! Слушай: в подвале двое, пар их слепит.', 'Пар, говорю. Снизу.'],
      choices: [
        { id: 'nagrada', text: 'А спасибо?', if: { not: { flag: 'denis-dal' } },
          do: [{ coins: 2 }, { flag: 'denis-dal' }], next: 'nagrada' },
        { id: 'poka', text: 'Бывай.', next: null },
      ],
    },
    nagrada: {
      say: 'Держи две. Последние, наколдованные.',
      choices: [{ id: 'ok', text: 'Бывай.', next: null }],
    },
  },
};

const PODMASTER = {
  name: 'ПОДМАСТЕРЬЕ',
  start: [{ node: 'privet' }],
  nodes: {
    privet: {
      say: ['Тсс. Страж спит — не буди, а то мне влетит.', 'Опять ты? Тише.'],
      choices: [
        { id: 'kto', text: 'Кто живёт за рвом?', next: 'zhiteli' },
        { id: 'poka', text: 'Бывай.', next: null },
      ],
    },
    zhiteli: {
      say: 'Кузнец у сторожки. И Мефодий у воды — курит вечно.',
      choices: [
        { id: 'mefodiy', text: 'Что за Мефодий?', do: [{ flag: 'znaet-dolg' }], next: 'dolg' },
        { id: 'poka', text: 'Ясно.', next: null },
      ],
    },
    dolg: {
      say: 'Ангел, говорит, в отставке. Кузнецу три бутылки должен.',
      choices: [{ id: 'ok', text: 'Запомню.', next: null }],
    },
  },
};

/*
 * Бегущий свидетель (слой «в»): догнал — уговаривай. Одно дерево на всех
 * жителей: что бы он ни видел, говорит он одно и то же. «Показалось»
 * работает только на порчу (поджог, щиток) — нападение и убийство
 * «показаться» не могут.
 */
const SVIDETEL = {
  name: 'СВИДЕТЕЛЬ',
  start: [{ node: 'stoi' }],
  nodes: {
    stoi: {
      say: 'Не подходи! Я всё видел — к страже бегу!',
      choices: [
        { id: 'moneta', text: 'Монета. Ты ничего не видел.', if: { coins: 1 },
          do: [{ coins: -1 }, { act: 'hush' }], next: 'kupil' },
        { id: 'pokazalos', text: 'Тебе показалось.', if: { crime: ['arson', 'hack'] },
          do: [{ act: 'hush' }], next: 'poveril' },
        { id: 'pokazalos', text: 'Тебе показалось.', if: { not: { crime: ['arson', 'hack'] } },
          next: 'ne-veryu' },
      ],
    },
    kupil: {
      say: 'Монета? …Ничего не видел. Ночь, темно.',
      choices: [{ id: 'ok', text: 'Вот и славно.', next: null }],
    },
    poveril: {
      say: 'Показалось? …Может, и показалось. Темно же.',
      choices: [{ id: 'ok', text: 'Иди спать.', next: null }],
    },
    'ne-veryu': {
      say: 'Показалось?! Я видел, как ты его!',
      choices: [{ id: 'ok', text: '…', next: null }],
    },
  },
};

export const TREES = { kuznec: KUZNEC, mefodiy: MEFODIY, denis: DENIS, podmaster: PODMASTER, svidetel: SVIDETEL };
export const NAMES = { kuznec: 'КУЗНЕЦ', mefodiy: 'МЕФОДИЙ', denis: 'ДЕНИС', podmaster: 'ПОДМАСТЕРЬЕ' };

/* Отказы — не узлы дерева: с тем, кто отказал, разговора нет. */
export const REFUSALS = {
  saw: 'Не подходи! Стража!',
  wanted: 'Тебя ищут. Иди отсюда.',
  alarm: 'Не сейчас — тревога!',
  hushed: 'Я ничего не видел. Иди.',
};


/* =========================================================
   ЗАДАНИЯ ЭТАЖА
   ========================================================= */

export const QUESTS = [
  quest({
    id: 'yadro', title: 'ЯДРО ИЗ БАШНИ', must: true, blind: true,
    brief: 'Вынести ядро к выходу у старта.',
    approaches: [
      approach('boi', 'Через сторожку, в лоб'),
      approach('skrytnost', 'Через подвал, в паре'),
      approach('hitrost', 'Пожар амбара — приманка, щиток боковой двери'),
    ],
  }),
  quest({
    id: 'molot', title: 'МОЛОТ КУЗНЕЦА', giver: 'kuznec',
    brief: 'Увести стража от ворот сторожки — кузнец заберёт молот сам.',
    approaches: [
      approach('skrytnost', 'Монета на звон'),
      approach('razgovor', 'Мефодий наврёт стражу'),
      approach('boi', 'Усыпить стража там, где кузнец не видит'),
    ],
  }),
  quest({
    id: 'kletka', title: 'КЛЕТКА ДЕНИСА', giver: 'denis', blind: true,
    brief: 'Снять поле с клетки у западной стены.',
    approaches: [
      approach('hitrost', 'Щиток на стене: вода с разрядом'),
      approach('razgovor', 'Кузнец откроет своим ключом'),
    ],
  }),
];

/* Путь «Башни» → вид решения обязательного задания. */
export const ROUTE_KIND = { boi: 'boi', tiho: 'skrytnost', hitrost: 'hitrost' };


/* =========================================================
   МИР
   ========================================================= */

const cellOf = (body) => [Math.floor(body.x / TILE_SIZE), Math.floor(body.y / TILE_SIZE)];
const centre = ([x, y]) => ({ x: (x + 0.5) * TILE_SIZE, y: (y + 0.5) * TILE_SIZE });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/* Жители этажа: клетка карты → id. Зовётся из createWorld. */
export function initResidents(world) {
  const spec = world.level && world.level.residents;
  if (!spec) return;
  const zh = {
    flags: {},
    memory: {},
    log: createQuestLog(QUESTS),
    talk: null,
    refusal: null,
    wanted: false,
    lie: null,
    cellCause: null,
    hammer: null,
    called: {},
  };
  world.zhiteli = zh;

  /* Обязательное взято с первой секунды: о нём говорит строка этажа. */
  zh.log.entries.yadro = { ...zh.log.entries.yadro, state: STATE.taken, at: 0 };

  for (const civ of world.civilians) {
    const [x, y] = cellOf(civ);
    const entry = spec[`${x},${y}`];
    if (!entry) continue;
    civ.resident = { id: entry.id, name: NAMES[entry.id] || entry.id, home: [x, y], angle: civ.angle };
    if (entry.witness === false) civ.witness = null;
  }

  const sb = world.level.sandbox || {};
  if (sb.hammer) zh.hammer = { cell: sb.hammer, ...centre(sb.hammer), taken: false };
}

export const residentOf = (world, id) => world.civilians.find((c) => c.resident && c.resident.id === id) || null;

function guardAtPost(world, cell) {
  if (!cell) return null;
  return world.enemies.find((e) => e.post
    && Math.floor(e.post.x / TILE_SIZE) === cell[0] && Math.floor(e.post.y / TILE_SIZE) === cell[1]) || null;
}

function questStates(world) {
  const out = {};
  for (const [id, entry] of Object.entries(world.zhiteli.log.entries)) out[id] = entry.state;
  return out;
}

/* Видел ли житель твоё преступление и не куплен ли. */
export function sawCrime(civ) {
  const w = civ && civ.witness;
  return Boolean(w && w.crime && w.state !== 'hushed');
}

/* Снимок мира для условий разговора (razgovory.js, testCond). */
export function ctxFor(world, civ) {
  const zh = world.zhiteli;
  return {
    flags: zh.flags,
    coins: world.coinsLeft || 0,
    quests: questStates(world),
    wanted: zh.wanted,
    alarm: world.trevoga ? world.trevoga.state : 'calm',
    saw: sawCrime(civ),
    crime: civ && civ.witness && civ.witness.crime ? civ.witness.crime.kind : null,
    witness: civ && civ.witness ? civ.witness.state : null,
  };
}

/* Задание: шаг журнала + события в мир. */
function questStep(world, action) {
  const zh = world.zhiteli;
  const out = stepQuests(zh.log, { t: world.time, ...action }, QUESTS);
  if (out.rejected) return false;
  zh.log = out.log;
  for (const event of out.events) world.events.push(event);
  return true;
}

/*
 * Позвать стража в точку — как шум МГС, но одному стражу и без шума на
 * весь двор (ai.js, ветка alert: дойдёт, осмотрится INVESTIGATE секунд,
 * вернётся на пост). Тревога от этого не поднимается: позвали — не
 * значит «видели чужого».
 */
export function callGuard(world, guard, point, source) {
  if (!guard || !guard.alive || guard.downed > 0 || guard.state === 'chase') return false;
  guard.heard = { x: point.x, y: point.y, origin: { x: point.x, y: point.y, source } };
  guard.state = 'alert';
  guard.think = 0;
  guard.search = INVESTIGATE;
  world.events.push({ type: 'guard-called', x: point.x, y: point.y, source });
  return true;
}

function nearestGuardTo(world, point) {
  let best = null;
  let bestD = Infinity;
  for (const g of world.enemies) {
    if (!g.alive || g.downed > 0 || g.state === 'chase') continue;
    const d = dist(g, point);
    if (d < bestD) { bestD = d; best = g; }
  }
  return best;
}

/* Поступки жителей по слову разговора. */
const ACTS = {
  /* Мефодий: через LIE_DELAY крикнет стражу у сторожки, что у амбара
     шарятся. Страж уходит смотреть — разговор, а не монета. */
  'lie-guard': (world) => {
    world.zhiteli.lie = { at: world.time + LIE_DELAY };
  },
  /* Кузнец идёт к клетке и открывает её ключом. */
  'open-cell': (world, civ) => {
    const sb = world.level.sandbox || {};
    if (!sb.cell || !civ) return;
    civ.errand = { what: 'open-cell', to: sb.cell.key, back: civ.resident.home };
  },
  /* Свидетель уговорён: не донесёт. */
  hush: (world, civ) => {
    if (!civ || !civ.witness) return;
    civ.witness.state = 'hushed';
    civ.witness.target = null;
    civ.vx = 0;
    civ.vy = 0;
    world.events.push({ type: 'hushed', id: civ.resident ? civ.resident.id : null, kind: civ.witness.crime ? civ.witness.crime.kind : null });
  },
};

function applyEffects(world, civ, effects) {
  const zh = world.zhiteli;
  for (const effect of effects) {
    if (effect.flag) zh.flags[effect.flag] = true;
    if (effect.coins) {
      if (world.coinsLeft === undefined) world.coinsLeft = 0;
      world.coinsLeft = Math.max(0, world.coinsLeft + effect.coins);
      world.events.push({ type: 'coins', delta: effect.coins, left: world.coinsLeft });
    }
    if (effect.quest) {
      if (effect.to === 'vzyato') questStep(world, { type: 'take', id: effect.quest });
      if (effect.to === 'sdelano') questStep(world, { type: 'done', id: effect.quest, solution: effect.solution });
      if (effect.to === 'provaleno') questStep(world, { type: 'fail', id: effect.quest });
    }
    if (effect.act && ACTS[effect.act]) ACTS[effect.act](world, civ, effect);
  }
}

/* Кого из жителей можно сейчас позвать к разговору (для кнопки). */
export function talkTarget(world) {
  if (!world.zhiteli || !world.player.alive) return null;
  let best = null;
  let bestD = TALK_REACH;
  for (const civ of world.civilians) {
    if (!civ.resident || !civ.alive || civ.downed > 0) continue;
    const d = dist(civ, world.player);
    if (d > bestD) continue;
    if (!hasSight(world, world.player.x, world.player.y, civ.x, civ.y)) continue;
    best = civ;
    bestD = d;
  }
  return best ? best.resident.id : null;
}

function treeFor(civ) {
  const w = civ.witness;
  if (w && (w.state === 'run' || w.state === 'talk')) return TREES.svidetel;
  return TREES[civ.resident.id];
}

/* Что показать сейчас: разговор (имя, строка, выборы) или null. */
export function talkNow(world) {
  const zh = world.zhiteli;
  if (!zh || !zh.talk) return null;
  const civ = residentOf(world, zh.talk.with);
  if (!civ) return null;
  const view = viewOf(zh.talk, treeFor(civ), ctxFor(world, civ));
  /* Бегущий свидетель говорит общим деревом, но имя у него своё. */
  return view ? { ...view, name: civ.resident.name } : null;
}

/* Журнал для экрана. */
export function questLog(world) {
  return world.zhiteli ? questsView(world.zhiteli.log, QUESTS) : [];
}

function refuse(world, civ, why) {
  const zh = world.zhiteli;
  zh.refusal = { with: civ.resident.id, why, line: REFUSALS[why], until: world.time + REFUSAL_TIME };
  world.events.push({ type: 'talk-refused', id: civ.resident.id, why });
  if (why !== 'saw') return;
  /* Видевший зовёт ближайшего стража к себе — последствие видно в мире. */
  const last = zh.called[civ.resident.id] ?? -Infinity;
  if (world.time - last < CALL_COOLDOWN) return;
  zh.called[civ.resident.id] = world.time;
  callGuard(world, nearestGuardTo(world, civ), { x: civ.x, y: civ.y }, 'call');
}

function closeTalk(world, why) {
  const zh = world.zhiteli;
  if (!zh.talk) return;
  const civ = residentOf(world, zh.talk.with);
  /* Свидетель, которого не уговорили, бежит дальше. */
  if (civ && civ.witness && civ.witness.state === 'talk') {
    civ.witness.state = civ.alive && !(civ.downed > 0) ? 'run' : 'stopped';
  }
  world.events.push({ type: 'talk-close', id: zh.talk.with, why });
  zh.talk = null;
}

function startTalk(world, id) {
  const zh = world.zhiteli;
  const civ = residentOf(world, id);
  if (!civ || !civ.alive || civ.downed > 0) return;
  if (dist(civ, world.player) > TALK_REACH) return;
  if (!hasSight(world, world.player.x, world.player.y, civ.x, civ.y)) return;
  if (zh.talk) closeTalk(world, 'switch');

  const w = civ.witness;
  const running = w && w.state === 'run';
  if (!running) {
    if (sawCrime(civ)) return refuse(world, civ, 'saw');
    if (w && w.state === 'hushed') return refuse(world, civ, 'hushed');
    if (zh.wanted && REPUTATION.wanted) return refuse(world, civ, 'wanted');
    if (world.trevoga && world.trevoga.state === 'alert') return refuse(world, civ, 'alarm');
  }

  const tree = treeFor(civ);
  const memory = zh.memory[id] || {};
  const opened = openTalk(id, tree, ctxFor(world, civ), memory);
  if (!opened) return;
  zh.memory[id] = opened.memory;
  zh.talk = opened.state;
  zh.talkSince = world.time;
  zh.refusal = null;
  if (running) {
    /* Догнал бегущего — он встал и слушает. */
    w.state = 'talk';
    civ.vx = 0;
    civ.vy = 0;
  }
  world.events.push({ type: 'talk-open', id, node: zh.talk.node });
}

function sayInTalk(world, choiceId) {
  const zh = world.zhiteli;
  if (!zh.talk) return;
  const civ = residentOf(world, zh.talk.with);
  if (!civ) { closeTalk(world, 'gone'); return; }
  const tree = treeFor(civ);
  const id = zh.talk.with;
  const out = stepTalk(zh.talk, { type: 'say', id: choiceId }, tree, ctxFor(world, civ), zh.memory[id] || {});
  if (out.rejected) {
    world.events.push({ type: 'talk-rejected', id, choice: choiceId });
    return;
  }
  zh.memory[id] = out.memory;
  applyEffects(world, civ, out.effects);
  world.events.push({ type: 'talk-say', id, choice: choiceId, node: out.state ? out.state.node : null });
  if (out.state) zh.talk = out.state;
  else closeTalk(world, 'done');
}

/*
 * Шаг жителя к клетке: поиск в ширину от цели, шаг на соседнюю клетку,
 * которая к ней ближе (как бег свидетеля в svideteli.js). Огонь — стена.
 * Возвращает true, когда дошёл.
 */
function passable(world, at) {
  return !blocksMove(world.tiles[at]) && world.ground[at] !== GROUND.FIRE;
}
function fieldFrom(world, cell) {
  const field = new Int32Array(world.w * world.h).fill(-1);
  const queue = new Int32Array(world.w * world.h);
  let head = 0;
  let tail = 0;
  const start = cell[1] * world.w + cell[0];
  field[start] = 0;
  queue[tail++] = start;
  while (head < tail) {
    const at = queue[head++];
    const ax = at % world.w;
    const ay = (at / world.w) | 0;
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = ax + dx;
      const ny = ay + dy;
      if (nx < 0 || ny < 0 || nx >= world.w || ny >= world.h) continue;
      const idx = ny * world.w + nx;
      if (field[idx] !== -1 || !passable(world, idx)) continue;
      field[idx] = field[at] + 1;
      queue[tail++] = idx;
    }
  }
  return field;
}
export function walkCivilian(world, civ, cell, dt, speed = WALK_SPEED) {
  const goal = centre(cell);
  if (dist(civ, goal) < 4) { civ.vx = 0; civ.vy = 0; return true; }
  const field = fieldFrom(world, cell);
  const [hx, hy] = cellOf(civ);
  const here = hy * world.w + hx;
  let best = field[here] < 0 ? Infinity : field[here];
  let to = null;
  for (const [dx, dy] of NEIGHBOURS) {
    const nx = hx + dx;
    const ny = hy + dy;
    if (nx < 0 || ny < 0 || nx >= world.w || ny >= world.h) continue;
    const v = field[ny * world.w + nx];
    if (v < 0 || v >= best) continue;
    best = v;
    to = [nx, ny];
  }
  if (field[here] < 0 && !to) { civ.vx = 0; civ.vy = 0; return false; }
  /* Сначала в центр своей клетки по поперечной оси — иначе угол двери. */
  const target = to ? centre(to) : goal;
  const c = centre([hx, hy]);
  let tx = target.x;
  let ty = target.y;
  if (to) {
    if (to[0] === hx && Math.abs(civ.x - c.x) > 2) { tx = c.x; ty = civ.y; }
    if (to[1] === hy && Math.abs(civ.y - c.y) > 2) { ty = c.y; tx = civ.x; }
  }
  const dx = tx - civ.x;
  const dy = ty - civ.y;
  const len = Math.hypot(dx, dy) || 1;
  const step = Math.min(speed * dt, len);
  const nx = civ.x + (dx / len) * step;
  const ny = civ.y + (dy / len) * step;
  const at = (x, y) => Math.floor(y / TILE_SIZE) * world.w + Math.floor(x / TILE_SIZE);
  if (passable(world, at(nx, civ.y))) civ.x = nx;
  if (passable(world, at(civ.x, ny))) civ.y = ny;
  civ.vx = (dx / len) * speed;
  civ.vy = (dy / len) * speed;
  civ.angle = Math.atan2(dy, dx);
  return false;
}

/*
 * Почему страж у ворот не на посту — это и есть вид решения «Молота».
 * null — он на посту, или ушёл не из-за игрока (обыск, погоня): тогда
 * кузнец не идёт.
 */
export function awayCause(guard) {
  if (!guard) return null;
  if (!guard.alive || guard.downed > 0) return 'boi';
  if (guard.state !== 'alert' || !guard.post) return null;
  if (Math.hypot(guard.x - guard.post.x, guard.y - guard.post.y) < AWAY) return null;
  const source = guard.heard && guard.heard.origin ? guard.heard.origin.source : null;
  if (!source) return null;
  if (source === 'coin') return 'skrytnost';
  if (source === 'call') return 'razgovor';
  if (source === 'step') return null;
  return 'hitrost';
}

function stepErrands(world, dt) {
  const zh = world.zhiteli;
  const sb = world.level.sandbox || {};
  for (const civ of world.civilians) {
    const errand = civ.errand;
    if (!errand || !civ.alive || civ.downed > 0) continue;
    if (errand.phase === 'back') {
      if (walkCivilian(world, civ, errand.back, dt)) {
        civ.errand = null;
        if (civ.resident && civ.resident.angle !== undefined) civ.angle = civ.resident.angle;
      }
      continue;
    }
    if (!walkCivilian(world, civ, errand.to, dt)) continue;
    /* Дошёл. */
    if (errand.what === 'hammer' && zh.hammer && !zh.hammer.taken) {
      zh.hammer.taken = true;
      world.events.push({ type: 'item-taken', what: 'molot', x: zh.hammer.x, y: zh.hammer.y });
      questStep(world, { type: 'done', id: 'molot', solution: errand.solution });
    }
    if (errand.what === 'open-cell' && sb.cell) {
      const circuit = (world.circuits || []).find((c) => c.id === sb.cell.circuit);
      if (circuit && circuit.powered) {
        if (!zh.cellCause) zh.cellCause = 'razgovor';
        setCircuit(world, circuit, false);
        world.events.push({ type: 'cell-opened', by: 'kuznec' });
      }
    }
    errand.phase = 'back';
  }
}

/*
 * Шаг мира для жителей. Зовётся из update() после свидетелей: события
 * кадра (донос, выход, щиток) уже на месте.
 */
export function updateResidents(world, dt, intent) {
  const zh = world.zhiteli;
  if (!zh) return;
  const sb = world.level.sandbox || {};

  /* 1. События кадра. Копия: квесты дописывают свои события в тот же
        список, и бежать по растущему списку незачем. */
  for (const event of [...world.events]) {
    if (event.type === 'report') zh.wanted = true;
    if (event.type === 'panel' && sb.cell && event.circuit === sb.cell.circuit && !zh.cellCause) zh.cellCause = 'hitrost';
    if (event.type === 'exit' && world.operation && world.operation.coreTaken) {
      questStep(world, { type: 'done', id: 'yadro', solution: ROUTE_KIND[world.route] || 'boi' });
    }
    if (event.type === 'death') questStep(world, { type: 'fail', id: 'yadro', why: 'death' });
  }

  /* 2. Провалы: дающий умер, уснул навсегда или видел твоё преступление. */
  for (const def of QUESTS) {
    if (!def.giver) continue;
    const state = questState(zh.log, def.id);
    if (state !== STATE.taken) continue;
    const giver = residentOf(world, def.giver);
    if (!giver || !giver.alive) questStep(world, { type: 'fail', id: def.id, why: 'dead' });
    else if (giver.downed > 0) questStep(world, { type: 'fail', id: def.id, why: 'down' });
    else if (sawCrime(giver)) questStep(world, { type: 'fail', id: def.id, why: 'saw' });
  }
  const denis = residentOf(world, 'denis');
  if (denis && !denis.alive) questStep(world, { type: 'fail', id: 'kletka', why: 'dead' });

  /* 3. Мефодий кричит стражу. */
  if (zh.lie && world.time >= zh.lie.at) {
    zh.lie = null;
    const guard = guardAtPost(world, sb.hammerGuard);
    if (guard && sb.lie) callGuard(world, guard, centre(sb.lie), 'call');
  }

  /* 4. «Молот»: страж ушёл — кузнец идёт за молотом. */
  if (questState(zh.log, 'molot') === STATE.taken && zh.hammer && !zh.hammer.taken) {
    const smith = residentOf(world, 'kuznec');
    const cause = awayCause(guardAtPost(world, sb.hammerGuard));
    if (smith && cause && !smith.errand && smith.alive && !(smith.downed > 0)
      && (!smith.witness || smith.witness.state === 'calm')) {
      smith.errand = { what: 'hammer', to: zh.hammer.cell, back: smith.resident.home, solution: cause };
      world.events.push({ type: 'errand', id: 'kuznec', what: 'hammer', cause });
    }
  }

  /* 5. «Клетка»: поле снято — Денис выходит. */
  if (sb.cell && denis && denis.alive && !(denis.downed > 0) && !zh.flags['denis-svoboden']) {
    const circuit = (world.circuits || []).find((c) => c.id === sb.cell.circuit);
    if (circuit && !circuit.powered) {
      if (walkCivilian(world, denis, sb.cell.out, dt)) {
        zh.flags['denis-svoboden'] = true;
        denis.resident.home = sb.cell.out;
        world.events.push({ type: 'released', id: 'denis' });
        /* Не взятая «Клетка» тоже засчитывается (blind): Денис вышел — дело
           сделано, спрашивал ты его или нет. */
        questStep(world, { type: 'done', id: 'kletka', solution: zh.cellCause || 'hitrost' });
      }
    }
  }

  stepErrands(world, dt);

  /* 6. Разговор: намерения и обрыв. */
  if (zh.talk) {
    const civ = residentOf(world, zh.talk.with);
    if (!civ || !civ.alive || civ.downed > 0) closeTalk(world, 'gone');
    else if (!world.player.alive || world.state !== 'play') closeTalk(world, 'gone');
    else if (dist(civ, world.player) > TALK_LEAVE) closeTalk(world, 'left');
    else if (civ.witness && civ.witness.state === 'talk' && world.time - zh.talkSince > WITNESS_PATIENCE) closeTalk(world, 'ran-off');
    else if (world.trevoga && world.trevoga.state === 'alert' && !(civ.witness && civ.witness.state === 'talk')) closeTalk(world, 'alarm');
  }
  if (intent) {
    if (intent.talkEnd) closeTalk(world, 'player');
    if (intent.talk) startTalk(world, intent.talk);
    if (intent.say) sayInTalk(world, intent.say);
  }
  if (zh.refusal && world.time > zh.refusal.until) zh.refusal = null;
}
