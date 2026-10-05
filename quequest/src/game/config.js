export const GAME_VERSION = 2;
export const STORAGE_KEY = 'quequest.game.v1';

export const WORLD = Object.freeze({ width: 1600, height: 900 });
export const THREATS_TO_COLLAPSE = 22;
export const MANUAL_CRATES_REQUIRED = 3;
export const COLLAPSE_DURATION = 2.8;
export const MAX_DT = 0.05;
export const PLAYER_SPEED = 310;
export const CRATE_PAY = 20;
export const INTERACTION_RADIUS = 92;
export const AUTOFIRE_FIRST_SHOT = 0.35;
export const AUTOFIRE_INTERVAL = 0.36;
export const PROLOGUE_TIMEOUT = 4.8;
export const WAREHOUSE_INTRO_DURATION = 7.2;
export const CHIP_INSERT_DURATION = 1.05;
export const WAKE_REVEAL_DURATION = 2.6;
export const OTHER_MIND_AWAKE_HOLD_DURATION = 1.5;
export const REWARD_REVEAL_DURATION = 1.8;
export const ARM_TRANSFER_DURATION = 2;
export const RED_CRATE_FAILURE_DURATION = 3.6;

export const PALLET = Object.freeze({ id: 'pallet-a', x: 1300, y: 590, width: 180, height: 120 });
export const MACHINE = Object.freeze({ x: 1010, y: 350 });

export const THREAT_LAYOUT = Object.freeze(Array.from({ length: 24 }, (_, index) => ({
  id: `threat-${String(index + 1).padStart(2, '0')}`,
  x: 175 + (index % 8) * 178 + (Math.floor(index / 8) % 2) * 34,
  y: 105 + Math.floor(index / 8) * 145 + (index % 2) * 22,
})));

export const CRATE_LAYOUT = Object.freeze([
  { id: 'box-01', kind: 'normal', x: 265, y: 560, status: 'source' },
  { id: 'box-02', kind: 'normal', x: 205, y: 630, status: 'source' },
  { id: 'box-03', kind: 'normal', x: 325, y: 650, status: 'source' },
  { id: 'box-04', kind: 'normal', x: 120, y: 500, status: 'queued' },
  { id: 'box-05', kind: 'normal', x: 190, y: 500, status: 'queued' },
  { id: 'box-06', kind: 'normal', x: 260, y: 485, status: 'queued' },
  { id: 'box-07', kind: 'normal', x: 330, y: 500, status: 'queued' },
  { id: 'box-08', kind: 'normal', x: 110, y: 580, status: 'queued' },
  { id: 'box-09', kind: 'normal', x: 120, y: 665, status: 'queued' },
  { id: 'red-01', kind: 'red', x: 25, y: 585, status: 'hidden' },
]);

// Вторая смена использует тот же склад, но уже как учебную задачу: сначала
// машина снова переносит обычные ящики после ручного сигнала, затем в поток
// попадает красный груз и старое правило перестаёт подходить.
export const SECOND_SHIFT_LAYOUT = Object.freeze([
  { id: 's2-box-01', kind: 'normal', x: 120, y: 500, status: 'queued' },
  { id: 's2-box-02', kind: 'normal', x: 190, y: 500, status: 'queued' },
  { id: 's2-box-03', kind: 'normal', x: 260, y: 485, status: 'queued' },
  { id: 's2-box-04', kind: 'normal', x: 330, y: 500, status: 'queued' },
  { id: 's2-box-05', kind: 'normal', x: 110, y: 580, status: 'queued' },
  { id: 's2-box-06', kind: 'normal', x: 120, y: 665, status: 'queued' },
  { id: 's2-red-01', kind: 'red', x: 25, y: 585, status: 'hidden' },
]);

// После первой ошибки игрок получает маленькую, но уже настоящую задачу на
// условие. Красные ящики видны в том же списке, однако правильная программа
// должна дать миру команды только для обычных.
export const CONDITION_LAYOUT = Object.freeze([
  { id: 'if-box-01', kind: 'normal', x: 105, y: 495, status: 'queued' },
  { id: 'if-red-01', kind: 'red', x: 180, y: 510, status: 'queued' },
  { id: 'if-box-02', kind: 'normal', x: 255, y: 485, status: 'queued' },
  { id: 'if-red-02', kind: 'red', x: 325, y: 520, status: 'queued' },
  { id: 'if-box-03', kind: 'normal', x: 115, y: 600, status: 'queued' },
]);

// 18.0: after the rule panel (buttons) cleared the first batch, a second one
// rolls in for the same rule written as `if`.
export const CONDITION_LAYOUT_B = Object.freeze([
  { id: 'ifb-red-01', kind: 'red', x: 105, y: 495, status: 'queued' },
  { id: 'ifb-box-01', kind: 'normal', x: 180, y: 510, status: 'queued' },
  { id: 'ifb-box-02', kind: 'normal', x: 255, y: 485, status: 'queued' },
  { id: 'ifb-red-02', kind: 'red', x: 325, y: 520, status: 'queued' },
  { id: 'ifb-box-03', kind: 'normal', x: 115, y: 600, status: 'queued' },
]);


// Третья смена: Q-Bot остаётся один на ночь. Количество работы заранее неизвестно,
// поэтому игрок видит очередь как список и учит правило «пока очередь не пуста».
// Красные ящики остаются в линии и показывают, что старый if продолжает работать
// внутри нового while-цикла.
export const NIGHT_QUEUE_LAYOUT = Object.freeze([
  { id: 'q-box-01', kind: 'normal', x: 105, y: 495, status: 'queued' },
  { id: 'q-red-01', kind: 'red', x: 180, y: 510, status: 'queued' },
  { id: 'q-box-02', kind: 'normal', x: 255, y: 485, status: 'queued' },
  { id: 'q-box-03', kind: 'normal', x: 325, y: 520, status: 'queued' },
  { id: 'q-red-02', kind: 'red', x: 115, y: 600, status: 'queued' },
  { id: 'q-box-04', kind: 'normal', x: 195, y: 610, status: 'queued' },
]);



// Четвёртая смена: две входные линии требуют одного и того же поведения.
// Игрок должен перестать копировать правило и оформить его как функцию route(batch),
// которую можно применить к обеим линиям.
export const FUNCTION_LAYOUT = Object.freeze([
  { id: 'fn-a-01', line: 'A', kind: 'normal', x: 90, y: 470, status: 'queued' },
  { id: 'fn-a-red', line: 'A', kind: 'red', x: 165, y: 485, status: 'queued' },
  { id: 'fn-a-02', line: 'A', kind: 'normal', x: 240, y: 470, status: 'queued' },
  { id: 'fn-b-01', line: 'B', kind: 'normal', x: 90, y: 640, status: 'queued' },
  { id: 'fn-b-red', line: 'B', kind: 'red', x: 165, y: 655, status: 'queued' },
  { id: 'fn-b-02', line: 'B', kind: 'normal', x: 240, y: 640, status: 'queued' },
]);

// 18.1: every lesson after `if` goes through the floors of canon §13 —
// ТЫК (a button) → РУЧКИ (a rule panel) → КОД (typed, the last step without
// paste). Each floor gets its own batch of crates so the world moves each time.
function batch(prefix, kinds, lines = null) {
  return Object.freeze(kinds.map((k, i) => Object.freeze({
    id: `${prefix}-${String(i + 1).padStart(2, '0')}${k === 'r' ? '-red' : ''}`,
    kind: k === 'r' ? 'red' : 'normal',
    ...(lines ? { line: lines[i] } : {}),
    x: 105 + (i % 4) * 70, y: 495 + Math.floor(i / 4) * 100, status: 'queued',
  })));
}
export const LESSON_STAGES = Object.freeze({
  forlesson: Object.freeze(['tap', 'knobs', 'code', 'combo']),
  queue: Object.freeze(['tap', 'knobs', 'code']),
  function: Object.freeze(['tap', 'knobs', 'code']),
});
export const LESSON_BATCHES = Object.freeze({
  forlesson: Object.freeze({
    tap: batch('ft', ['w', 'w', 'w', 'w']),
    knobs: batch('fk', ['w', 'w', 'w', 'w', 'w']),
    code: batch('fc', ['w', 'w', 'w', 'w', 'w', 'w']),
    combo: batch('fx', ['w', 'r', 'w', 'w', 'r', 'w']),
  }),
  queue: Object.freeze({
    tap: batch('qt', ['w', 'w', 'r', 'w']),
    knobs: batch('qk', ['w', 'r', 'w', 'w']),
    code: NIGHT_QUEUE_LAYOUT,
  }),
  function: Object.freeze({
    tap: batch('ut', ['w', 'w', 'w', 'w'], ['A', 'A', 'B', 'B']),
    knobs: batch('uk', ['w', 'r', 'w', 'w', 'r', 'w'], ['A', 'A', 'A', 'B', 'B', 'B']),
    code: FUNCTION_LAYOUT,
  }),
});
// In the night queue two crates "arrive" while the arm works (after the
// second one it takes): the count is not known in advance — that is why while.
export const QUEUE_ARRIVE_AFTER = 2;
export const QUEUE_START = 4;

export const CHECKPOINTS = Object.freeze([
  'start',
  'warehouse',
  'chip',
  'machine',
  'red-crate',
  'reward',
  'shift2',
  'red2',
  'condition',
  'reward2',
  'forlesson',
  'reward-for',
  'shift3',
  'queue',
  'reward3',
  'function',
  'reward4',
  'friends',
  'reward5',
  'vika',
  'reward6',
  'virus',
  'reward7',
  'foundry',
  'reward8',
  'campus',
  'ai-lab',
  'reward9',
  'llm-lab',
  'reward10',
]);
