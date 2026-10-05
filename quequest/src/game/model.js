import {
  ARM_TRANSFER_DURATION,
  CHIP_INSERT_DURATION,
  AUTOFIRE_FIRST_SHOT,
  AUTOFIRE_INTERVAL,
  COLLAPSE_DURATION,
  CRATE_LAYOUT,
  CONDITION_LAYOUT,
  CONDITION_LAYOUT_B,
  LESSON_BATCHES,
  LESSON_STAGES,
  FUNCTION_LAYOUT,
  INTERACTION_RADIUS,
  MANUAL_CRATES_REQUIRED,
  MACHINE,
  MAX_DT,
  NIGHT_QUEUE_LAYOUT,
  PALLET,
  PLAYER_SPEED,
  CRATE_PAY,
  PROLOGUE_TIMEOUT,
  RED_CRATE_FAILURE_DURATION,
  SECOND_SHIFT_LAYOUT,
  THREAT_LAYOUT,
  THREATS_TO_COLLAPSE,
  WAKE_REVEAL_DURATION,
  WAREHOUSE_INTRO_DURATION,
  WORLD,
} from './config.js?v=novice-1';

const DEFAULT_STATE = Object.freeze({
  scene: 'prologue',
  sceneTime: 0,
  elapsed: 0,
  checkpoint: 'start',
  powers: Object.freeze({ dash: true, pulse: true, shield: true }),
  player: Object.freeze({
    x: 800,
    y: 720,
    facingX: 1,
    facingY: 0,
    carrying: null,
    energy: 3,
    shieldUntil: 0,
  }),
  prologue: Object.freeze({
    threats: 0,
    waveRadius: 0,
    enemies: [],
    nextShotAt: AUTOFIRE_FIRST_SHOT,
    lastShotAt: -1,
    lastTargets: [],
  }),
  warehouse: Object.freeze({
    introComplete: true,
    bossEntrance: false,
    manualDelivered: 0,
    autoDelivered: 0,
    wage: 0,
    freeTime: 0,
    crates: [],
    lastPickupAt: -1,
    lastDropAt: -1,
    lastDroppedId: null,
    lastDropDelivered: false,
    incomeAt: -100,
    incomeSource: null,
    autoTarget: 6,
    looseButtonTried: false,
    // 18.0 day 2: 'button' (press the green button) -> 'print' (say wake with
    // words) -> 'tear' (the boss tears the button off) -> 'print2' (the arm
    // still listens to the terminal) -> 'done'.
    day2: null,
    button: 'mounted',
    // 18.0 condition: 'rules' (rule panel, buttons) -> 'if' (the same in code).
    ruleStage: null,
    // 18.1: floors of the for / while / def lessons: 'tap' → 'knobs' → 'code' (→ 'combo').
    lessonStage: null,
  }),
  arm: Object.freeze({ awake: false, blocked: false, chip: 'missing', queue: [], active: null, failure: null, wakeRevealRemaining: 0, returnTo: null }),
  otherMind: Object.freeze({ phase: 'sleeping', line: '' }),
  learning: Object.freeze({ chapter: 1, printUnlocked: false, forUnlocked: false, ifUnlocked: false, listUnlocked: false, whileUnlocked: false, funcUnlocked: false, dictUnlocked: false, reliabilityUnlocked: false, asyncUnlocked: false, aiUnlocked: false, llmUnlocked: false, botUnlocked: false, queueTrace: [], functionTrace: [] }),
});

const RESTORED_OTHER_MIND_LINE = 'Я слышу машину. Теперь научи меня понимать её.';
const MACHINE_TERMINAL = Object.freeze({ x: MACHINE.x, y: MACHINE.y + 175 });
const LOOSE_START_BUTTON = Object.freeze({ x: MACHINE.x + 145, y: MACHINE.y + 200 });
const CHIP_FLOOR = Object.freeze({ x: 850, y: 535 });
const CHIP_SOCKET = Object.freeze({ x: MACHINE.x, y: MACHINE.y + 286 });

function cloneEnemies(enemies = THREAT_LAYOUT) {
  return enemies.map((enemy) => ({ ...enemy, alive: enemy.alive ?? true }));
}

function cloneCrates(crates = CRATE_LAYOUT) {
  return crates.map((crate) => ({ ...crate }));
}

function mergePart(base, override) {
  return { ...base, ...(override ?? {}) };
}

export function createGameState(overrides = {}) {
  const prologue = mergePart(DEFAULT_STATE.prologue, overrides.prologue);
  const warehouse = mergePart(DEFAULT_STATE.warehouse, overrides.warehouse);
  return {
    ...DEFAULT_STATE,
    ...overrides,
    powers: mergePart(DEFAULT_STATE.powers, overrides.powers),
    player: mergePart(DEFAULT_STATE.player, overrides.player),
    prologue: {
      ...prologue,
      enemies: cloneEnemies(overrides.prologue?.enemies ?? THREAT_LAYOUT),
    },
    warehouse: {
      ...warehouse,
      crates: cloneCrates(overrides.warehouse?.crates ?? CRATE_LAYOUT),
    },
    arm: {
      ...mergePart(DEFAULT_STATE.arm, overrides.arm),
      queue: [...(overrides.arm?.queue ?? DEFAULT_STATE.arm.queue)],
      active: overrides.arm?.active ? { ...overrides.arm.active } : null,
      failure: overrides.arm?.failure ? { ...overrides.arm.failure } : null,
    },
    otherMind: mergePart(DEFAULT_STATE.otherMind, overrides.otherMind),
    learning: mergePart(DEFAULT_STATE.learning, overrides.learning),
  };
}

export function createCheckpointState(checkpoint = 'start') {
  if (checkpoint === 'start') return createGameState();
  const powers = { dash: false, pulse: false, shield: false };
  if (checkpoint === 'warehouse') {
    return createGameState({
      scene: 'warehouse', checkpoint, powers,
      player: { x: 520, y: 580 },
      warehouse: { introComplete: true },
    });
  }
  if (checkpoint === 'chip') {
    return createGameState({
      scene: 'chip', checkpoint, powers,
      player: { x: 1140, y: 720 },
      arm: { chip: 'held' },
      warehouse: {
        manualDelivered: 3,
        wage: 3 * CRATE_PAY,
        crates: CRATE_LAYOUT.map((crate) => (
          ['box-01', 'box-02', 'box-03'].includes(crate.id)
            ? { ...crate, status: 'pallet', x: PALLET.x, y: PALLET.y }
            : crate
        )),
      },
    });
  }
  if (checkpoint === 'machine') {
    return startChipAutomation(createGameState({
      scene: 'machine', checkpoint, powers,
      player: { x: 1120, y: 580 },
      arm: { chip: 'installed' },
      warehouse: {
        manualDelivered: 3,
        wage: 3 * CRATE_PAY,
        crates: CRATE_LAYOUT.map((crate) => (
          ['box-01', 'box-02', 'box-03'].includes(crate.id)
            ? { ...crate, status: 'pallet', x: PALLET.x, y: PALLET.y }
            : crate
        )),
      },
    }));
  }
  if (checkpoint === 'red-crate' || checkpoint === 'reward') {
    return createGameState({
      scene: checkpoint,
      checkpoint,
      powers,
      player: { x: 800, y: 580 },
      arm: { awake: true, blocked: checkpoint === 'red-crate', chip: 'installed', startSource: checkpoint === 'reward' ? 'chip' : null },
      otherMind: { phase: 'awake', line: RESTORED_OTHER_MIND_LINE },
      warehouse: {
        manualDelivered: 3,
        autoDelivered: 6,
        wage: 9 * CRATE_PAY,
        freeTime: 24,
        crates: CRATE_LAYOUT.map((crate) => {
          if (crate.id === 'red-01') return { ...crate, status: checkpoint === 'red-crate' ? 'blocked' : 'hidden', x: 720, y: 575 };
          return { ...crate, status: 'pallet', x: PALLET.x, y: PALLET.y };
        }),
      },
    });
  }
  if (checkpoint === 'shift2') {
    return createGameState({
      scene: 'machine', checkpoint, powers,
      player: { x: MACHINE.x - 95, y: MACHINE.y + 215 },
      arm: { chip: 'installed', awake: false, startSource: 'command' },
      otherMind: { phase: 'awake', line: RESTORED_OTHER_MIND_LINE },
      learning: { chapter: 2 },
      warehouse: {
        manualDelivered: 3,
        autoDelivered: 0,
        autoTarget: 6,
        day2: 'button',
        button: 'mounted',
        wage: 9 * CRATE_PAY,
        freeTime: 24,
        crates: SECOND_SHIFT_LAYOUT,
      },
    });
  }
  if (checkpoint === 'red2') {
    return createGameState({
      scene: 'red-crate', checkpoint, powers,
      player: { x: 790, y: 590 },
      arm: { chip: 'installed', awake: true, blocked: true, startSource: 'command', failure: { progress: 1, phase: 'freeze' } },
      otherMind: { phase: 'awake', line: RESTORED_OTHER_MIND_LINE },
      learning: { chapter: 2, printUnlocked: true },
      warehouse: {
        manualDelivered: 3,
        autoDelivered: 6,
        autoTarget: 6,
        wage: 15 * CRATE_PAY,
        freeTime: 48,
        crates: SECOND_SHIFT_LAYOUT.map((crate) => (
          crate.kind === 'red'
            ? { ...crate, status: 'blocked', x: 720, y: 575 }
            : { ...crate, status: 'pallet', x: PALLET.x, y: PALLET.y }
        )),
      },
    });
  }
  if (checkpoint === 'condition') {
    return createGameState({
      scene: 'condition', checkpoint, powers,
      player: { x: MACHINE.x - 95, y: MACHINE.y + 215 },
      arm: { chip: 'installed', awake: true, blocked: true, startSource: 'condition' },
      otherMind: { phase: 'awake', line: RESTORED_OTHER_MIND_LINE },
      learning: { chapter: 2, printUnlocked: true },
      warehouse: {
        manualDelivered: 3,
        autoDelivered: 0,
        autoTarget: 3,
        wage: 15 * CRATE_PAY,
        freeTime: 48,
        crates: CONDITION_LAYOUT,
        ruleStage: 'rules',
        button: 'torn',
      },
    });
  }
  if (checkpoint === 'reward2') {
    return createGameState({
      scene: 'reward', checkpoint, powers,
      player: { x: 800, y: 580 },
      arm: { chip: 'installed', awake: true, blocked: false, startSource: 'condition' },
      otherMind: { phase: 'awake', line: RESTORED_OTHER_MIND_LINE },
      learning: { chapter: 2, printUnlocked: true, ifUnlocked: true, rulesBuilt: true, botUnlocked: true },
      warehouse: {
        manualDelivered: 3,
        autoDelivered: 3,
        autoTarget: 3,
        wage: 18 * CRATE_PAY,
        freeTime: 60,
        crates: CONDITION_LAYOUT.map((crate) => (
          crate.kind === 'normal' ? { ...crate, status: 'pallet', x: PALLET.x, y: PALLET.y } : crate
        )),
      },
    });
  }
  if (checkpoint === 'forlesson' || checkpoint === 'reward-for') {
    const reward = checkpoint === 'reward-for';
    return createGameState({
      scene: reward ? 'reward' : 'forlesson', checkpoint, powers,
      player: reward ? { x: 800, y: 580 } : { x: MACHINE.x - 95, y: MACHINE.y + 215 },
      arm: { chip: 'installed', awake: true, blocked: !reward, startSource: 'for' },
      otherMind: { phase: 'awake', line: 'Ящиков много. Одно правило — для каждого.' },
      learning: { chapter: 2, printUnlocked: true, ifUnlocked: true, rulesBuilt: true, forUnlocked: reward, botUnlocked: true },
      warehouse: {
        manualDelivered: 3, autoDelivered: 0, autoTarget: 99, wage: 18 * CRATE_PAY, freeTime: 60, button: 'torn',
        lessonStage: reward ? null : 'tap',
        crates: reward ? LESSON_BATCHES.forlesson.combo.map((c) => (c.kind === 'normal' ? { ...c, status: 'pallet', x: PALLET.x, y: PALLET.y } : c)) : LESSON_BATCHES.forlesson.tap,
      },
    });
  }
  if (checkpoint === 'shift3' || checkpoint === 'queue') {
    return createGameState({
      scene: 'queue', checkpoint: 'queue', powers,
      player: { x: MACHINE.x - 95, y: MACHINE.y + 215 },
      arm: { chip: 'installed', awake: true, blocked: false, startSource: 'queue' },
      otherMind: { phase: 'awake', line: 'Очередь живая. Я не знаю, сколько ящиков придёт дальше.' },
      learning: { chapter: 3, printUnlocked: true, forUnlocked: true, ifUnlocked: true, botUnlocked: true },
      warehouse: {
        manualDelivered: 3,
        autoDelivered: 0,
        autoTarget: 99,
        wage: 18 * CRATE_PAY,
        freeTime: 60,
        lessonStage: 'tap',
        crates: LESSON_BATCHES.queue.tap,
      },
    });
  }
  if (checkpoint === 'reward3') {
    return createGameState({
      scene: 'reward', checkpoint, powers,
      player: { x: 800, y: 580 },
      arm: { chip: 'installed', awake: true, blocked: false, startSource: 'queue' },
      otherMind: { phase: 'awake', line: 'Пока очередь жива — я продолжаю. Когда она пуста — останавливаюсь.' },
      learning: { chapter: 3, printUnlocked: true, forUnlocked: true, ifUnlocked: true, listUnlocked: true, whileUnlocked: true, botUnlocked: true },
      warehouse: {
        manualDelivered: 3,
        autoDelivered: NIGHT_QUEUE_LAYOUT.filter((crate) => crate.kind === 'normal').length,
        autoTarget: NIGHT_QUEUE_LAYOUT.filter((crate) => crate.kind === 'normal').length,
        wage: 22 * CRATE_PAY,
        freeTime: 76,
        crates: NIGHT_QUEUE_LAYOUT.map((crate) => (
          crate.kind === 'normal' ? { ...crate, status: 'pallet', x: PALLET.x, y: PALLET.y } : crate
        )),
      },
    });
  }
  if (checkpoint === 'function') {
    return createGameState({
      scene: 'function', checkpoint, powers,
      player: { x: MACHINE.x - 95, y: MACHINE.y + 215 },
      arm: { chip: 'installed', awake: true, blocked: false, startSource: 'function' },
      otherMind: { phase: 'awake', line: 'Две линии. Одно правило. Не копируй меня — дай мне имя.' },
      learning: { chapter: 4, printUnlocked: true, forUnlocked: true, ifUnlocked: true, listUnlocked: true, whileUnlocked: true, botUnlocked: true },
      warehouse: {
        manualDelivered: 3,
        autoDelivered: 0,
        autoTarget: 99,
        wage: 22 * CRATE_PAY,
        freeTime: 76,
        lessonStage: 'tap',
        crates: LESSON_BATCHES.function.tap,
      },
    });
  }
  if (checkpoint === 'reward4') {
    return createGameState({
      scene: 'reward', checkpoint, powers,
      player: { x: 800, y: 580 },
      arm: { chip: 'installed', awake: true, blocked: false, startSource: 'function' },
      otherMind: { phase: 'awake', line: 'route(batch) — один навык, который я могу применить где угодно.' },
      learning: { chapter: 4, printUnlocked: true, forUnlocked: true, ifUnlocked: true, listUnlocked: true, whileUnlocked: true, funcUnlocked: true, botUnlocked: true },
      warehouse: {
        manualDelivered: 3,
        autoDelivered: FUNCTION_LAYOUT.filter((crate) => crate.kind === 'normal').length,
        autoTarget: FUNCTION_LAYOUT.filter((crate) => crate.kind === 'normal').length,
        wage: 26 * CRATE_PAY,
        freeTime: 92,
        crates: FUNCTION_LAYOUT.map((crate) => (
          crate.kind === 'normal' ? { ...crate, status: 'pallet', x: PALLET.x, y: PALLET.y } : crate
        )),
      },
    });
  }
  if (checkpoint === 'friends' || checkpoint === 'reward5') {
    return createGameState({
      scene: 'reward', checkpoint, powers,
      player: { x: 800, y: 580 },
      arm: { chip: 'installed', awake: true, blocked: false, startSource: 'function' },
      otherMind: { phase: 'awake', line: checkpoint === 'reward5' ? 'Шесть событий. Один указатель. Три устойчивых приёма.' : 'Входные события уже пришли. Я подержу указатель — выбирай приём.' },
      learning: { chapter: 5, printUnlocked: true, forUnlocked: true, ifUnlocked: true, listUnlocked: true, whileUnlocked: true, funcUnlocked: true, botUnlocked: true },
      warehouse: {
        manualDelivered: 3,
        autoDelivered: FUNCTION_LAYOUT.filter((crate) => crate.kind === 'normal').length,
        autoTarget: FUNCTION_LAYOUT.filter((crate) => crate.kind === 'normal').length,
        wage: 26 * CRATE_PAY,
        freeTime: 92,
        crates: FUNCTION_LAYOUT.map((crate) => (
          crate.kind === 'normal' ? { ...crate, status: 'pallet', x: PALLET.x, y: PALLET.y } : crate
        )),
      },
    });
  }
  if (checkpoint === 'vika' || checkpoint === 'reward6') {
    return createGameState({
      scene: 'reward', checkpoint, powers,
      player: { x: 800, y: 580 },
      arm: { chip: 'installed', awake: true, blocked: false, startSource: 'function' },
      otherMind: { phase: 'awake', line: checkpoint === 'reward6' ? 'Один и тот же вход. Другое решение — потому что память уже изменилась.' : 'Вход повторяется. Я покажу, что изменилось не снаружи, а внутри состояния.' },
      learning: { chapter: 6, printUnlocked: true, forUnlocked: true, ifUnlocked: true, listUnlocked: true, whileUnlocked: true, funcUnlocked: true, dictUnlocked: checkpoint === 'reward6', botUnlocked: true },
      warehouse: {
        manualDelivered: 3,
        autoDelivered: FUNCTION_LAYOUT.filter((crate) => crate.kind === 'normal').length,
        autoTarget: FUNCTION_LAYOUT.filter((crate) => crate.kind === 'normal').length,
        wage: 26 * CRATE_PAY,
        freeTime: 92,
        crates: FUNCTION_LAYOUT.map((crate) => (
          crate.kind === 'normal' ? { ...crate, status: 'pallet', x: PALLET.x, y: PALLET.y } : crate
        )),
      },
    });
  }
  if (checkpoint === 'virus' || checkpoint === 'reward7') {
    return createGameState({
      scene: 'reward', checkpoint, powers,
      player: { x: 800, y: 580 },
      arm: { chip: 'installed', awake: true, blocked: false, startSource: 'function' },
      otherMind: { phase: 'awake', line: checkpoint === 'reward7' ? 'Сбой больше не стирает процесс: тест воспроизводит, except восстанавливает, log оставляет след.' : 'Не бей ошибку. Сначала пойми, какое предположение сломалось.' },
      learning: { chapter: 7, printUnlocked: true, forUnlocked: true, ifUnlocked: true, listUnlocked: true, whileUnlocked: true, funcUnlocked: true, dictUnlocked: true, reliabilityUnlocked: checkpoint === 'reward7', botUnlocked: true },
      warehouse: { manualDelivered: 3, autoDelivered: FUNCTION_LAYOUT.filter((crate) => crate.kind === 'normal').length, autoTarget: FUNCTION_LAYOUT.filter((crate) => crate.kind === 'normal').length, wage: 26 * CRATE_PAY, freeTime: 92, crates: FUNCTION_LAYOUT.map((crate) => (crate.kind === 'normal' ? { ...crate, status: 'pallet', x: PALLET.x, y: PALLET.y } : crate)) },
    });
  }
  if (checkpoint === 'foundry' || checkpoint === 'reward8') {
    return createGameState({
      scene: 'reward', checkpoint, powers,
      player: { x: 800, y: 580 },
      arm: { chip: 'installed', awake: true, blocked: false, startSource: 'function' },
      otherMind: { phase: 'awake', line: checkpoint === 'reward8' ? 'Queue держит поток. Два worker-а делят работу. Lock защищает общую память.' : 'Теперь не ускоряй один шаг вслепую. Смотри, где копится поток.' },
      learning: { chapter: 8, printUnlocked: true, forUnlocked: true, ifUnlocked: true, listUnlocked: true, whileUnlocked: true, funcUnlocked: true, dictUnlocked: true, reliabilityUnlocked: true, asyncUnlocked: checkpoint === 'reward8', botUnlocked: true },
      warehouse: { manualDelivered: 3, autoDelivered: FUNCTION_LAYOUT.filter((crate) => crate.kind === 'normal').length, autoTarget: FUNCTION_LAYOUT.filter((crate) => crate.kind === 'normal').length, wage: 26 * CRATE_PAY, freeTime: 92, crates: FUNCTION_LAYOUT.map((crate) => (crate.kind === 'normal' ? { ...crate, status: 'pallet', x: PALLET.x, y: PALLET.y } : crate)) },
    });
  }
  if (['campus', 'ai-lab', 'reward9', 'llm-lab', 'reward10'].includes(checkpoint)) {
    const aiUnlocked = ['reward9', 'llm-lab', 'reward10'].includes(checkpoint);
    const llmUnlocked = checkpoint === 'reward10';
    return createGameState({
      scene: 'reward', checkpoint, powers,
      player: { x: 800, y: 580 },
      arm: { chip: 'installed', awake: true, blocked: false, startSource: 'function' },
      otherMind: { phase: 'awake', line: llmUnlocked ? 'Модель — только один модуль. Контекст, инструменты и evals делают из неё систему.' : (aiUnlocked ? 'Поведение модели изменилось не от магии, а от данных, reward и проверки.' : 'Кампания закончилась. Теперь выбирай, какую систему строить дальше.') },
      learning: { chapter: llmUnlocked ? 10 : (aiUnlocked ? 9 : 8), printUnlocked: true, forUnlocked: true, ifUnlocked: true, listUnlocked: true, whileUnlocked: true, funcUnlocked: true, dictUnlocked: true, reliabilityUnlocked: true, asyncUnlocked: true, aiUnlocked, llmUnlocked, botUnlocked: true },
      warehouse: { manualDelivered: 3, autoDelivered: FUNCTION_LAYOUT.filter((crate) => crate.kind === 'normal').length, autoTarget: FUNCTION_LAYOUT.filter((crate) => crate.kind === 'normal').length, wage: 26 * CRATE_PAY, freeTime: 92, crates: FUNCTION_LAYOUT.map((crate) => (crate.kind === 'normal' ? { ...crate, status: 'pallet', x: PALLET.x, y: PALLET.y } : crate)) },
    });
  }
  return createGameState();
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function withNeutralized(state, ids) {
  const idSet = new Set(ids);
  const enemies = state.prologue.enemies.map((enemy) => (
    idSet.has(enemy.id) ? { ...enemy, alive: false, destroyedAt: state.sceneTime } : enemy
  ));
  const threats = enemies.filter((enemy) => !enemy.alive).length;
  const next = {
    ...state,
    prologue: {
      ...state.prologue,
      enemies,
      threats,
      lastShotAt: state.sceneTime,
      lastTargets: [...ids],
    },
  };
  return threats >= THREATS_TO_COLLAPSE
    ? { ...next, scene: 'collapse', sceneTime: 0 }
    : next;
}

function nearestAlive(state, maxDistance = Infinity) {
  return state.prologue.enemies
    .filter((enemy) => enemy.alive)
    .map((enemy) => ({ enemy, distance: distance(state.player, enemy) }))
    .filter((entry) => entry.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance);
}

function enterWarehouse(state) {
  return {
    ...state,
    scene: 'warehouse',
    sceneTime: 0,
    checkpoint: 'warehouse',
    powers: { dash: false, pulse: false, shield: false },
    player: {
      ...state.player,
      x: 520,
      y: 580,
      carrying: null,
      shieldUntil: 0,
    },
    warehouse: {
      ...state.warehouse,
      introComplete: true,
      bossEntrance: false,
    },
  };
}

export function getArmTransferPhase(progress = 0) {
  const value = Math.max(0, Math.min(1, progress));
  if (value < .24) return 'pickup';
  if (value < .84) return 'carry';
  return 'release';
}

function startChipAutomation(state) {
  return {
    ...state,
    scene: 'automation', sceneTime: 0, checkpoint: 'machine',
    arm: {
      ...state.arm, chip: 'installed', startSource: 'chip', awake: true,
      blocked: false, active: null, failure: null,
      wakeRevealRemaining: WAKE_REVEAL_DURATION,
      queue: state.warehouse.crates
        .filter((crate) => crate.kind === 'normal' && crate.status === 'queued')
        .map((crate) => ({ type: 'arm.move', boxId: crate.id, targetId: PALLET.id })),
    },
  };
}

export function getArmFailurePhase(progress = 0) {
  const value = Math.max(0, Math.min(1, progress));
  if (value < .28) return 'reach';
  if (value < .52) return 'scan';
  if (value < .76) return 'reject-one';
  if (value < .92) return 'reject-two';
  return 'freeze';
}

function updateCrate(state, crateId, updater) {
  return state.warehouse.crates.map((crate) => (
    crate.id === crateId ? updater(crate) : crate
  ));
}

// 18.0: a short arm run (the button: one crate; the first print: two; the
// rule panel: every allowed crate) that hands the scene back afterwards
// instead of finishing the shift.
function runArmBatch(state, count, source, returnTo) {
  const queued = state.warehouse.crates.filter((crate) => crate.status === 'queued');
  const allowed = source === 'rules' ? queued.filter((crate) => crate.kind === 'normal') : queued.filter((crate) => crate.kind === 'normal');
  const queue = allowed.slice(0, count).map((crate) => ({ type: 'arm.move', boxId: crate.id, targetId: PALLET.id }));
  if (!queue.length) return state;
  return {
    ...state,
    scene: 'automation',
    sceneTime: 0,
    arm: { ...state.arm, awake: true, blocked: false, active: null, failure: null, startSource: source, queue, returnTo, wakeRevealRemaining: WAKE_REVEAL_DURATION * .5 },
  };
}

function finishLessonBatch(state, boxId) {
  const scene = state.arm.returnTo;
  const stages = LESSON_STAGES[scene];
  const next = stages[Math.min(stages.length - 1, stages.indexOf(state.warehouse.lessonStage) + 1)];
  const delivered = state.warehouse.crates.map((crate) => (crate.id === boxId ? { ...crate, status: 'pallet', x: PALLET.x, y: PALLET.y, deliveredAt: state.elapsed } : crate)).filter((crate) => crate.status === 'pallet');
  const fresh = cloneCrates(LESSON_BATCHES[scene][next]);
  const final = next === stages[stages.length - 1];
  return {
    ...state, scene, sceneTime: 0,
    warehouse: {
      ...state.warehouse, lessonStage: next, autoDelivered: 0,
      autoTarget: final ? fresh.filter((c) => c.kind === 'normal').length : 99,
      wage: state.warehouse.wage + CRATE_PAY, incomeAt: state.elapsed, incomeSource: 'robot', freeTime: state.warehouse.freeTime + 4,
      crates: [...delivered, ...fresh],
    },
    arm: { ...state.arm, active: null, queue: [], returnTo: null, awake: true, blocked: true, startSource: scene === 'forlesson' ? 'for' : scene },
  };
}

function finishReturningBatch(state, boxId) {
  if (state.arm.startSource === 'lesson') return finishLessonBatch(state, boxId);
  const returnTo = state.arm.returnTo;
  const ruleDone = state.arm.startSource === 'rules';
  const crates = state.warehouse.crates.map((crate) => (crate.id === boxId ? { ...crate, status: 'pallet', x: PALLET.x, y: PALLET.y, deliveredAt: state.elapsed } : crate));
  return {
    ...state,
    scene: returnTo,
    sceneTime: 0,
    warehouse: {
      ...state.warehouse,
      autoDelivered: ruleDone ? 0 : state.warehouse.autoDelivered + 1,
      wage: state.warehouse.wage + CRATE_PAY,
      incomeAt: state.elapsed,
      incomeSource: 'robot',
      freeTime: state.warehouse.freeTime + 4,
      ruleStage: ruleDone ? 'if' : state.warehouse.ruleStage,
      // The rule panel cleared its batch; a new one rolls in for the `if`.
      crates: ruleDone ? [...crates.filter((crate) => crate.status === 'pallet'), ...cloneCrates(CONDITION_LAYOUT_B)] : crates,
    },
    arm: { ...state.arm, active: null, queue: [], returnTo: null, awake: returnTo === 'condition', blocked: returnTo === 'condition', startSource: returnTo === 'condition' ? 'condition' : 'command' },
    learning: ruleDone ? { ...state.learning, rulesBuilt: true } : state.learning,
  };
}

function startNextArmTransfer(state) {
  if (state.scene !== 'automation' || state.arm.active || !state.arm.queue.length) return state;
  const [event, ...queue] = state.arm.queue;
  return {
    ...state,
    warehouse: {
      ...state.warehouse,
      crates: updateCrate(state, event.boxId, (crate) => ({ ...crate, status: 'arm' })),
    },
    arm: { ...state.arm, queue, active: { ...event, progress: 0 } },
  };
}

export function applyGameAction(state, action) {
  switch (action?.type) {
    case 'threat-neutralized': {
      if (state.scene !== 'prologue') return state;
      const target = state.prologue.enemies.find((enemy) => enemy.alive);
      return target ? withNeutralized(state, [target.id]) : state;
    }
    case 'manual-crate-delivered': {
      if (state.scene !== 'warehouse') return state;
      const manualDelivered = Math.min(
        MANUAL_CRATES_REQUIRED,
        state.warehouse.manualDelivered + 1,
      );
      return {
        ...state,
        scene: state.scene,
        sceneTime: manualDelivered === MANUAL_CRATES_REQUIRED ? 0 : state.sceneTime,
        checkpoint: state.checkpoint,
        warehouse: {
          ...state.warehouse,
          manualDelivered,
          introComplete: manualDelivered === MANUAL_CRATES_REQUIRED ? false : state.warehouse.introComplete,
          bossEntrance: manualDelivered === MANUAL_CRATES_REQUIRED,
        },
      };
    }
    case 'dash': {
      if (!state.powers.dash || state.scene !== 'prologue') return state;
      const rawX = action.x ?? state.player.facingX ?? 1;
      const rawY = action.y ?? state.player.facingY ?? 0;
      const length = Math.hypot(rawX, rawY) || 1;
      const x = rawX / length;
      const y = rawY / length;
      const moved = {
        ...state,
        player: {
          ...state.player,
          x: Math.max(40, Math.min(WORLD.width - 40, state.player.x + x * 180)),
          y: Math.max(40, Math.min(WORLD.height - 40, state.player.y + y * 180)),
          facingX: x,
          facingY: y,
          energy: Math.max(0, state.player.energy - 1),
        },
      };
      const target = nearestAlive(state, 360).find(({ enemy }) => {
        const dx = enemy.x - state.player.x;
        const dy = enemy.y - state.player.y;
        const projection = dx * x + dy * y;
        const side = Math.abs(dx * y - dy * x);
        return projection > 0 && side < 125;
      });
      return target ? withNeutralized(moved, [target.enemy.id]) : moved;
    }
    case 'pulse': {
      if (!state.powers.pulse || state.scene !== 'prologue') return state;
      const targets = nearestAlive(state, 340).slice(0, 2).map(({ enemy }) => enemy.id);
      const waved = {
        ...state,
        prologue: { ...state.prologue, waveRadius: 210 },
      };
      return targets.length ? withNeutralized(waved, targets) : waved;
    }
    case 'shield':
      if (!state.powers.shield || state.scene !== 'prologue') return state;
      return {
        ...state,
        player: { ...state.player, shieldUntil: state.elapsed + 2 },
      };
    case 'pick-crate': {
      if (state.scene !== 'warehouse' || !state.warehouse.introComplete || state.player.carrying || action.distance > INTERACTION_RADIUS) return state;
      const crate = state.warehouse.crates.find(({ id }) => id === action.crateId);
      if (!crate || crate.kind !== 'normal' || !['source', 'floor'].includes(crate.status)) return state;
      return {
        ...state,
        player: { ...state.player, carrying: crate.id },
        warehouse: {
          ...state.warehouse,
          lastPickupAt: state.elapsed,
          crates: updateCrate(state, crate.id, (item) => ({ ...item, status: 'carried' })),
        },
      };
    }
    case 'drop-crate': {
      if (state.scene !== 'warehouse' || !state.player.carrying) return state;
      const crateId = state.player.carrying;
      const delivered = action.target === PALLET.id;
      const manualDelivered = Math.min(
        MANUAL_CRATES_REQUIRED,
        state.warehouse.manualDelivered + (delivered ? 1 : 0),
      );
      return {
        ...state,
        scene: state.scene,
        sceneTime: manualDelivered === MANUAL_CRATES_REQUIRED ? 0 : state.sceneTime,
        checkpoint: state.checkpoint,
        player: { ...state.player, carrying: null },
        warehouse: {
          ...state.warehouse,
          manualDelivered,
          introComplete: manualDelivered === MANUAL_CRATES_REQUIRED ? false : state.warehouse.introComplete,
          bossEntrance: manualDelivered === MANUAL_CRATES_REQUIRED,
          wage: state.warehouse.wage + (delivered ? CRATE_PAY : 0),
          incomeAt: delivered ? state.elapsed : state.warehouse.incomeAt,
          incomeSource: delivered ? 'manual' : state.warehouse.incomeSource,
          lastDropAt: state.elapsed,
          lastDroppedId: crateId,
          lastDropDelivered: delivered,
          crates: updateCrate(state, crateId, (crate) => ({
            ...crate,
            x: delivered ? PALLET.x : (action.x ?? state.player.x),
            y: delivered ? PALLET.y : (action.y ?? state.player.y),
            status: delivered ? 'pallet' : 'floor',
            deliveredAt: delivered ? state.elapsed : null,
          })),
        },
      };
    }
    case 'arm-awake': {
      if (state.scene !== 'machine') return state;
      return {
        ...state,
        scene: 'automation',
        sceneTime: 0,
        checkpoint: 'machine',
        arm: { ...state.arm, awake: true, blocked: false },
      };
    }
    case 'pick-python-chip': {
      if (state.scene !== 'chip' || state.arm.chip !== 'fallen') return state;
      return { ...state, arm: { ...state.arm, chip: 'held' } };
    }
    case 'insert-python-chip': {
      if (state.scene !== 'chip' || state.arm.chip !== 'held') return state;
      return {
        ...state,
        sceneTime: 0,
        arm: { ...state.arm, chip: 'inserting' },
      };
    }
    // 18.0 day 2, floor 1: the green button still works -- one crate.
    case 'press-start-button': {
      if (state.scene !== 'machine' || state.checkpoint !== 'shift2' || state.warehouse.day2 !== 'button') return state;
      return runArmBatch({ ...state, warehouse: { ...state.warehouse, day2: 'print', looseButtonTried: true } }, 1, 'button', 'machine');
    }
    // The boss saw the arm work and tore the button off. The arm doesn't care:
    // it listens to the terminal, not to the button.
    case 'boss-tears-button': {
      if (state.scene !== 'machine' || state.warehouse.day2 !== 'tear') return state;
      return { ...state, warehouse: { ...state.warehouse, day2: 'print2', button: 'torn' } };
    }
    case 'pick-torn-button': {
      if (state.warehouse.button !== 'torn') return state;
      return { ...state, warehouse: { ...state.warehouse, button: 'pocket' } };
    }
    case 'condition-rules-accepted': {
      if (state.scene !== 'condition' || state.warehouse.ruleStage !== 'rules') return state;
      const rules = action.rules ?? {};
      if (rules.red === 'take' || rules.white !== 'take') return state;
      return runArmBatch(state, Infinity, 'rules', 'condition');
    }
    case 'first-command-accepted': {
      if (state.scene !== 'machine') return state;
      if (state.checkpoint === 'shift2' && state.warehouse.day2 === 'print') {
        return runArmBatch({ ...state, warehouse: { ...state.warehouse, day2: 'tear' }, learning: { ...state.learning, printUnlocked: true } }, 2, 'command', 'machine');
      }
      if (state.checkpoint === 'shift2' && state.warehouse.day2 !== 'print2') return state;
      const queue = state.warehouse.crates
        .filter((crate) => crate.kind === 'normal' && crate.status === 'queued')
        .map((crate) => ({ type: 'arm.move', boxId: crate.id, targetId: PALLET.id }));
      return {
        ...state,
        scene: 'automation',
        checkpoint: state.checkpoint === 'shift2' ? 'shift2' : 'machine',
        arm: {
          ...state.arm,
          awake: true,
          blocked: false,
          active: null,
          queue,
          startSource: 'command',
          returnTo: null,
          wakeRevealRemaining: WAKE_REVEAL_DURATION,
        },
        warehouse: state.warehouse.day2 ? { ...state.warehouse, day2: 'done' } : state.warehouse,
        learning: { ...state.learning, chapter: Math.max(2, state.learning.chapter), printUnlocked: true },
      };
    }
    case 'start-second-shift': {
      if (state.scene !== 'reward') return state;
      return createCheckpointState('shift2');
    }
    case 'condition-command-accepted': {
      if (state.scene !== 'condition' || !Array.isArray(action.events) || !action.events.length) return state;
      if (state.warehouse.ruleStage === 'rules') return state;
      return {
        ...state,
        scene: 'automation',
        sceneTime: 0,
        checkpoint: 'condition',
        arm: {
          ...state.arm,
          awake: true,
          blocked: false,
          active: null,
          failure: null,
          startSource: 'condition',
          queue: action.events.map((event) => ({ ...event })),
          wakeRevealRemaining: .9,
          returnTo: null,
        },
        learning: { ...state.learning, chapter: 2, printUnlocked: true, ifUnlocked: true },
      };
    }
    case 'start-for-shift': {
      if (state.scene !== 'reward' || state.checkpoint !== 'reward2') return state;
      return createCheckpointState('forlesson');
    }
    // 18.1: a floor below code (the button, the rule panel) or the plain for:
    // the arm runs this batch, then the next batch for the next floor rolls in.
    case 'lesson-accepted': {
      const stages = LESSON_STAGES[state.scene];
      const stage = state.warehouse.lessonStage;
      if (!stages || !stage || stage === stages[stages.length - 1]) return state;
      if (Array.isArray(action.events) && action.events.length) {
        return { ...state, scene: 'automation', sceneTime: 0, arm: { ...state.arm, awake: true, blocked: false, active: null, failure: null, startSource: 'lesson', returnTo: state.scene, queue: action.events.map((e) => ({ ...e })), wakeRevealRemaining: WAKE_REVEAL_DURATION * .5 } };
      }
      return runArmBatch(state, Infinity, 'lesson', state.scene);
    }
    case 'for-command-accepted': {
      if (state.scene !== 'forlesson' || state.warehouse.lessonStage !== 'combo' || !Array.isArray(action.events) || !action.events.length) return state;
      return {
        ...state, scene: 'automation', sceneTime: 0, checkpoint: 'forlesson',
        warehouse: { ...state.warehouse, autoDelivered: 0, autoTarget: action.events.length },
        arm: { ...state.arm, awake: true, blocked: false, active: null, failure: null, startSource: 'for', returnTo: null, queue: action.events.map((e) => ({ ...e })), wakeRevealRemaining: .9 },
      };
    }
    case 'start-third-shift': {
      if (state.scene !== 'reward' || !['reward2', 'reward-for'].includes(state.checkpoint)) return state;
      return createCheckpointState('queue');
    }
    case 'queue-command-accepted': {
      if (state.scene !== 'queue' || !Array.isArray(action.events) || !action.events.length) return state;
      if (state.warehouse.lessonStage && state.warehouse.lessonStage !== 'code') return state;
      return {
        ...state,
        scene: 'automation',
        sceneTime: 0,
        checkpoint: 'queue',
        arm: {
          ...state.arm,
          awake: true,
          blocked: false,
          active: null,
          failure: null,
          startSource: 'queue',
          queue: action.events.map((event) => ({ ...event })),
          wakeRevealRemaining: .65,
        },
        learning: { ...state.learning, chapter: 3, listUnlocked: true, whileUnlocked: true, queueTrace: Array.isArray(action.trace) ? action.trace.map((entry) => ({ ...entry })) : [] },
      };
    }
    case 'start-fourth-shift': {
      if (state.scene !== 'reward' || state.checkpoint !== 'reward3') return state;
      return createCheckpointState('function');
    }
    case 'function-command-accepted': {
      if (state.scene !== 'function' || !Array.isArray(action.events) || !action.events.length) return state;
      if (state.warehouse.lessonStage && state.warehouse.lessonStage !== 'code') return state;
      return {
        ...state,
        scene: 'automation',
        sceneTime: 0,
        checkpoint: 'function',
        arm: {
          ...state.arm, awake: true, blocked: false, active: null, failure: null,
          startSource: 'function', queue: action.events.map((event) => ({ ...event })), wakeRevealRemaining: .65,
        },
        learning: { ...state.learning, chapter: 4, funcUnlocked: true, functionTrace: Array.isArray(action.trace) ? action.trace.map((entry) => ({ ...entry })) : [] },
      };
    }
    case 'start-friends-defense': {
      if (state.scene !== 'reward' || !['reward4', 'friends'].includes(state.checkpoint)) return state;
      return { ...state, checkpoint: 'friends', learning: { ...state.learning, chapter: 5 } };
    }
    case 'friends-defense-complete': {
      if (state.scene !== 'reward' || state.checkpoint !== 'friends') return state;
      return { ...state, checkpoint: 'reward5', learning: { ...state.learning, chapter: 5 } };
    }
    case 'start-vika-memory': {
      if (state.scene !== 'reward' || !['reward5', 'vika'].includes(state.checkpoint)) return state;
      return { ...state, checkpoint: 'vika', learning: { ...state.learning, chapter: 6 } };
    }
    case 'vika-memory-complete': {
      if (state.scene !== 'reward' || state.checkpoint !== 'vika') return state;
      return { ...state, checkpoint: 'reward6', learning: { ...state.learning, chapter: 6, dictUnlocked: true } };
    }
    case 'start-virus-finale': {
      if (state.scene !== 'reward' || !['reward6', 'virus'].includes(state.checkpoint)) return state;
      return { ...state, checkpoint: 'virus', learning: { ...state.learning, chapter: 7 } };
    }
    case 'virus-finale-complete': {
      if (state.scene !== 'reward' || state.checkpoint !== 'virus') return state;
      return { ...state, checkpoint: 'reward7', learning: { ...state.learning, chapter: 7, reliabilityUnlocked: true } };
    }
    case 'start-automation-foundry': {
      if (state.scene !== 'reward' || !['reward7', 'foundry'].includes(state.checkpoint)) return state;
      return { ...state, checkpoint: 'foundry', learning: { ...state.learning, chapter: 8 } };
    }
    case 'automation-foundry-complete': {
      if (state.scene !== 'reward' || state.checkpoint !== 'foundry') return state;
      return { ...state, checkpoint: 'reward8', learning: { ...state.learning, chapter: 8, asyncUnlocked: true } };
    }
    case 'open-campus': {
      if (state.scene !== 'reward' || !['reward8', 'campus', 'reward9', 'reward10'].includes(state.checkpoint)) return state;
      return { ...state, checkpoint: 'campus', learning: { ...state.learning, chapter: Math.max(8, state.learning.chapter) } };
    }
    case 'start-ai-lab': {
      if (state.scene !== 'reward' || !['reward8', 'campus', 'ai-lab'].includes(state.checkpoint)) return state;
      return { ...state, checkpoint: 'ai-lab', learning: { ...state.learning, chapter: 9 } };
    }
    case 'ai-lab-complete': {
      if (state.scene !== 'reward' || state.checkpoint !== 'ai-lab') return state;
      return { ...state, checkpoint: 'reward9', learning: { ...state.learning, chapter: 9, aiUnlocked: true } };
    }
    case 'start-llm-workshop': {
      if (state.scene !== 'reward' || !['reward8', 'campus', 'reward9', 'llm-lab'].includes(state.checkpoint)) return state;
      return { ...state, checkpoint: 'llm-lab', learning: { ...state.learning, chapter: 10, aiUnlocked: state.learning.aiUnlocked || state.checkpoint === 'reward9' } };
    }
    case 'llm-workshop-complete': {
      if (state.scene !== 'reward' || state.checkpoint !== 'llm-lab') return state;
      return { ...state, checkpoint: 'reward10', learning: { ...state.learning, chapter: 10, aiUnlocked: true, llmUnlocked: true } };
    }
    case 'other-mind-waking': {
      if (!state.arm.awake || !['sleeping', 'waking'].includes(state.otherMind.phase)) return state;
      return {
        ...state,
        otherMind: {
          phase: 'waking',
          line: typeof action.line === 'string' ? action.line.slice(0, 160) : state.otherMind.line,
        },
      };
    }
    case 'other-mind-awake': {
      if (state.otherMind.phase !== 'waking' || typeof action.line !== 'string' || !action.line.trim()) return state;
      return {
        ...state,
        otherMind: { phase: 'awake', line: action.line.slice(0, 160) },
      };
    }
    case 'other-mind-silent': {
      if (state.otherMind.phase !== 'waking') return state;
      return {
        ...state,
        otherMind: {
          phase: 'silent',
          line: typeof action.line === 'string' ? action.line.slice(0, 160) : '',
        },
      };
    }
    case 'automation-queued': {
      if (state.scene !== 'automation' || !state.arm.awake || state.arm.active) return state;
      return {
        ...state,
        arm: {
          ...state.arm,
          queue: (action.events ?? []).map((event) => ({ ...event })),
        },
      };
    }
    case 'arm-transfer-finished': {
      if (state.scene !== 'automation' || state.arm.active?.boxId !== action.boxId) return state;
      if (state.arm.returnTo && state.arm.queue.length === 0) return finishReturningBatch(state, action.boxId);
      const autoDelivered = state.warehouse.autoDelivered + 1;
      const finished = autoDelivered >= (state.warehouse.autoTarget ?? 6);
      const episodeFinished = finished && state.arm.startSource === 'chip';
      const conditionFinished = finished && state.arm.startSource === 'condition';
      const queueFinished = finished && state.arm.startSource === 'queue';
      const functionFinished = finished && state.arm.startSource === 'function';
      const forFinished = finished && state.arm.startSource === 'for';
      const anyReward = episodeFinished || conditionFinished || queueFinished || functionFinished || forFinished;
      return {
        ...state,
        scene: anyReward ? 'reward' : state.scene,
        sceneTime: anyReward ? 0 : state.sceneTime,
        checkpoint: forFinished ? 'reward-for' : (functionFinished ? 'reward4' : (queueFinished ? 'reward3' : (conditionFinished ? 'reward2' : (episodeFinished ? 'reward' : state.checkpoint)))),
        warehouse: {
          ...state.warehouse,
          autoDelivered,
          wage: state.warehouse.wage + CRATE_PAY,
          incomeAt: state.elapsed,
          incomeSource: 'robot',
          freeTime: state.warehouse.freeTime + 4,
          crates: state.warehouse.crates.map((crate) => {
            if (crate.id === action.boxId) return { ...crate, status: 'pallet', x: PALLET.x, y: PALLET.y, deliveredAt: state.elapsed };
            if (finished && !anyReward && crate.kind === 'red') return { ...crate, status: 'scan', x: 720, y: 575 };
            return crate;
          }),
        },
        arm: {
          ...state.arm,
          active: null,
          queue: finished ? [] : state.arm.queue,
          failure: finished && !anyReward ? { progress: 0, phase: 'reach' } : state.arm.failure,
          blocked: false,
        },
        learning: forFinished
          ? { ...state.learning, forUnlocked: true }
          : functionFinished
          ? { ...state.learning, chapter: 4, printUnlocked: true, forUnlocked: true, ifUnlocked: true, listUnlocked: true, whileUnlocked: true, funcUnlocked: true, botUnlocked: true, functionTrace: state.learning.functionTrace ?? [] }
          : queueFinished
          ? { ...state.learning, chapter: 3, printUnlocked: true, forUnlocked: true, ifUnlocked: true, listUnlocked: true, whileUnlocked: true, botUnlocked: true, queueTrace: state.learning.queueTrace ?? [] }
          : conditionFinished
            ? { ...state.learning, chapter: 2, printUnlocked: true, ifUnlocked: true, botUnlocked: true }
            : state.learning,
      };
    }
    case 'arm-failure-finished': {
      if (state.scene !== 'automation' || !state.arm.failure) return state;
      const redId = state.warehouse.crates.find((crate) => crate.kind === 'red')?.id;
      return {
        ...state,
        scene: 'red-crate',
        sceneTime: 0,
        checkpoint: state.arm.startSource === 'command' ? 'red2' : 'red-crate',
        warehouse: {
          ...state.warehouse,
          crates: redId ? updateCrate(state, redId, (crate) => ({ ...crate, status: 'blocked' })) : state.warehouse.crates,
        },
        arm: {
          ...state.arm,
          active: null,
          queue: [],
          blocked: true,
          failure: { progress: 1, phase: 'freeze' },
        },
      };
    }
    case 'inspect-red-crate': {
      if (state.scene !== 'red-crate') return state;
      if (state.arm.startSource === 'command') return createCheckpointState('condition');
      return { ...state, scene: 'reward', sceneTime: 0, checkpoint: 'reward' };
    }
    default:
      return state;
  }
}

export function getNearbyAction(state) {
  if (state.scene === 'chip') {
    if (state.arm.chip === 'fallen' && distance(state.player, CHIP_FLOOR) <= INTERACTION_RADIUS + 20) {
      return { type: 'pick-python-chip', label: 'ПОДНЯТЬ ЧИП' };
    }
    if (state.arm.chip === 'held' && distance(state.player, CHIP_SOCKET) <= INTERACTION_RADIUS + 55) {
      return { type: 'insert-python-chip', label: 'ВСТАВИТЬ ЧИП В РАЗЪЁМ' };
    }
    return null;
  }
  if (state.scene === 'red-crate') {
    const red = state.warehouse.crates.find((crate) => crate.kind === 'red' && ['blocked', 'scan', 'queued'].includes(crate.status));
    return red && distance(state.player, red) <= INTERACTION_RADIUS + 25
      ? { type: 'inspect-red-crate', label: 'ПРОВЕРИТЬ ЯЩИК' }
      : null;
  }
  if (state.scene === 'machine') {
    const day2 = state.warehouse.day2;
    const nearButton = distance(state.player, LOOSE_START_BUTTON) <= INTERACTION_RADIUS + 25;
    const nearTerminal = distance(state.player, MACHINE_TERMINAL) <= INTERACTION_RADIUS + 45;
    // 18.0: things are used when you are NEAR them and press E, never by
    // stepping on them (Сергей: «зелёную кнопку брать, когда рядом»).
    if (state.checkpoint === 'shift2' && day2 === 'button') {
      return nearButton ? { type: 'press-start-button', label: 'НАЖАТЬ ЗЕЛЁНУЮ КНОПКУ' } : null;
    }
    if (state.checkpoint === 'shift2' && day2 === 'tear') return null;
    if (state.warehouse.button === 'torn' && nearButton && (!nearTerminal || distance(state.player, LOOSE_START_BUTTON) < distance(state.player, MACHINE_TERMINAL))) {
      return { type: 'pick-torn-button', label: 'ПОДНЯТЬ ОТОРВАННУЮ КНОПКУ' };
    }
    return nearTerminal
      ? { type: 'open-machine', label: day2 === 'print' || day2 === 'print2' ? 'НАПИСАТЬ РУКЕ В ТЕРМИНАЛ' : 'ОТКРЫТЬ ТЕРМИНАЛ' }
      : null;
  }
  if (state.scene === 'condition') {
    return distance(state.player, MACHINE_TERMINAL) <= INTERACTION_RADIUS + 70
      ? { type: 'open-machine', label: state.warehouse.ruleStage === 'rules' ? 'НАСТРОИТЬ ПРАВИЛО РУКИ' : 'ЗАПИСАТЬ ПРАВИЛО СЛОВАМИ PYTHON' }
      : null;
  }
  if (['forlesson', 'queue', 'function'].includes(state.scene)) {
    const stage = state.warehouse.lessonStage;
    const label = stage === 'tap' ? 'НАЖАТЬ КНОПКУ НА ТЕРМИНАЛЕ' : (stage === 'knobs' ? 'НАСТРОИТЬ ПАНЕЛЬ' : 'ЗАПИСАТЬ СЛОВАМИ PYTHON');
    return distance(state.player, MACHINE_TERMINAL) <= INTERACTION_RADIUS + 70 ? { type: 'open-machine', label } : null;
  }
  if (state.scene === 'automation') {
    return !state.arm.active && !state.arm.failure && state.arm.queue.length === 0 && distance(state.player, MACHINE_TERMINAL) <= INTERACTION_RADIUS + 45
      ? { type: 'open-machine', label: 'ОТКРЫТЬ КОНСОЛЬ' }
      : null;
  }
  if (state.scene !== 'warehouse') return null;
  if (!state.warehouse.introComplete) return null;
  if (state.player.carrying) {
    if (distance(state.player, PALLET) <= INTERACTION_RADIUS + 35) {
      return { type: 'drop-crate', target: PALLET.id, label: `НА ПАЛЕТУ · +${CRATE_PAY} ₽` };
    }
    return null;
  }

  const nearby = state.warehouse.crates
    .filter((crate) => crate.kind === 'normal' && ['source', 'floor'].includes(crate.status))
    .map((crate) => ({ crate, distance: distance(state.player, crate) }))
    .filter((entry) => entry.distance <= INTERACTION_RADIUS)
    .sort((a, b) => a.distance - b.distance)[0];
  return nearby
    ? { type: 'pick-crate', crateId: nearby.crate.id, label: 'ВЗЯТЬ ЯЩИК' }
    : null;
}

export function getFirstActionGuide(state) {
  if (state.scene !== 'warehouse' || !state.warehouse.introComplete || state.warehouse.manualDelivered > 0) return null;
  if (state.player.carrying) {
    return {
      action: 'drop-crate',
      targetId: PALLET.id,
      x: PALLET.x,
      y: PALLET.y,
      label: 'НЕСИ К ЖЁЛТОЙ РАМКЕ · НАЖМИ ДЕЙСТВИЕ',
    };
  }
  const nearest = state.warehouse.crates
    .filter((crate) => crate.kind === 'normal' && ['source', 'floor'].includes(crate.status))
    .map((crate) => ({ crate, distance: distance(state.player, crate) }))
    .sort((a, b) => a.distance - b.distance)[0]?.crate;
  return nearest ? {
    action: 'pick-crate',
    targetId: nearest.id,
    x: nearest.x,
    y: nearest.y,
    label: 'ИДИ ПО СТРЕЛКЕ · У ЯЩИКА НАЖМИ ДЕЙСТВИЕ',
  } : null;
}

function autoFire(state) {
  if (state.prologue.threats >= THREATS_TO_COLLAPSE) return state;
  if (state.sceneTime + Number.EPSILON < state.prologue.nextShotAt) return state;
  const target = nearestAlive(state)[0]?.enemy;
  if (!target) return state;
  const nextShotAt = state.prologue.nextShotAt + AUTOFIRE_INTERVAL;
  const fired = withNeutralized({
    ...state,
    prologue: { ...state.prologue, nextShotAt },
  }, [target.id]);
  return fired;
}

function moveEnemies(state, dt) {
  let reflected = [];
  const enemies = state.prologue.enemies.map((enemy) => {
    if (!enemy.alive) return enemy;
    const dx = state.player.x - enemy.x;
    const dy = state.player.y - enemy.y;
    const length = Math.hypot(dx, dy) || 1;
    const moved = {
      ...enemy,
      x: enemy.x + (dx / length) * 54 * dt,
      y: enemy.y + (dy / length) * 54 * dt,
    };
    if (state.player.shieldUntil > state.elapsed && distance(moved, state.player) < 78) {
      reflected.push(enemy.id);
    }
    return moved;
  });
  const moved = { ...state, prologue: { ...state.prologue, enemies } };
  return reflected.length ? withNeutralized(moved, reflected) : moved;
}

export function stepGame(state, input = {}, rawDt, options = {}) {
  if (options.paused) return state;
  const dt = Math.min(MAX_DT, Math.max(0, Number.isFinite(rawDt) ? rawDt : 0));
  const moveLength = Math.hypot(input.moveX ?? 0, input.moveY ?? 0) || 1;
  const moveX = (input.moveX ?? 0) / moveLength;
  const moveY = (input.moveY ?? 0) / moveLength;
  const isMoving = Math.abs(input.moveX ?? 0) + Math.abs(input.moveY ?? 0) > 0;
  const warehouseIntroLocked = state.scene === 'warehouse' && !state.warehouse.introComplete;
  let next = {
    ...state,
    elapsed: state.elapsed + dt,
    sceneTime: state.sceneTime + dt,
    player: {
      ...state.player,
      x: warehouseIntroLocked ? state.player.x : Math.max(40, Math.min(WORLD.width - 40, state.player.x + moveX * PLAYER_SPEED * dt)),
      y: warehouseIntroLocked ? state.player.y : Math.max(40, Math.min(WORLD.height - 40, state.player.y + moveY * PLAYER_SPEED * dt)),
      facingX: isMoving && !warehouseIntroLocked ? moveX : state.player.facingX,
      facingY: isMoving && !warehouseIntroLocked ? moveY : state.player.facingY,
      energy: Math.min(3, state.player.energy + dt * .25),
    },
    prologue: {
      ...state.prologue,
      waveRadius: Math.max(0, state.prologue.waveRadius - dt * 260),
    },
  };

  if (next.scene === 'prologue') {
    next = moveEnemies(next, dt);
    next = autoFire(next);
    if (next.sceneTime >= PROLOGUE_TIMEOUT) {
      next = { ...next, scene: 'collapse', sceneTime: 0 };
    }
  }

  if (next.scene === 'collapse' && next.sceneTime >= COLLAPSE_DURATION) {
    return enterWarehouse(next);
  }

  if (next.scene === 'warehouse' && next.warehouse.bossEntrance && !next.warehouse.introComplete && next.sceneTime >= WAREHOUSE_INTRO_DURATION) {
    next = {
      ...next,
      scene: 'chip',
      sceneTime: 0,
      checkpoint: 'chip',
      arm: { ...next.arm, chip: 'fallen' },
      warehouse: { ...next.warehouse, introComplete: true, bossEntrance: false },
    };
  }

  if (next.scene === 'chip' && next.arm.chip === 'inserting' && next.sceneTime >= CHIP_INSERT_DURATION) {
    next = startChipAutomation(next);
  }

  if (next.scene === 'automation' && next.arm.awake) {
    if (next.arm.failure) {
      const progress = next.arm.failure.progress + dt / RED_CRATE_FAILURE_DURATION;
      next = {
        ...next,
        arm: {
          ...next.arm,
          failure: { progress, phase: getArmFailurePhase(progress) },
        },
      };
      if (progress >= 1) next = applyGameAction(next, { type: 'arm-failure-finished' });
      return next;
    }
    if (next.arm.wakeRevealRemaining > 0) {
      next = {
        ...next,
        arm: {
          ...next.arm,
          wakeRevealRemaining: Math.max(0, next.arm.wakeRevealRemaining - dt),
        },
      };
    }
    if (next.arm.wakeRevealRemaining <= 0 && !next.arm.active && next.arm.queue.length) {
      next = startNextArmTransfer(next);
    } else if (next.arm.active) {
      const progress = next.arm.active.progress + dt / ARM_TRANSFER_DURATION;
      next = {
        ...next,
        arm: { ...next.arm, active: { ...next.arm.active, progress } },
      };
      if (progress >= 1) {
        next = applyGameAction(next, { type: 'arm-transfer-finished', boxId: next.arm.active.boxId });
        next = startNextArmTransfer(next);
      }
    }
  }

  return next;
}
