import {
  ARM_TRANSFER_DURATION,
  AUTOFIRE_FIRST_SHOT,
  AUTOFIRE_INTERVAL,
  COLLAPSE_DURATION,
  CRATE_LAYOUT,
  INTERACTION_RADIUS,
  MANUAL_CRATES_REQUIRED,
  MACHINE,
  MAX_DT,
  PALLET,
  PLAYER_SPEED,
  PROLOGUE_TIMEOUT,
  RED_CRATE_FAILURE_DURATION,
  THREAT_LAYOUT,
  THREATS_TO_COLLAPSE,
  WAKE_REVEAL_DURATION,
  WAREHOUSE_INTRO_DURATION,
  WORLD,
} from './config.js?v=5';

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
    manualDelivered: 0,
    autoDelivered: 0,
    wage: 0,
    freeTime: 0,
    crates: [],
    lastPickupAt: -1,
    lastDropAt: -1,
    lastDroppedId: null,
    lastDropDelivered: false,
  }),
  arm: Object.freeze({ awake: false, blocked: false, queue: [], active: null, failure: null, wakeRevealRemaining: 0 }),
  otherMind: Object.freeze({ phase: 'sleeping', line: '' }),
});

const RESTORED_OTHER_MIND_LINE = 'Я слышу машину. Теперь научи меня понимать её.';

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
  };
}

export function createCheckpointState(checkpoint = 'start') {
  if (checkpoint === 'start') return createGameState();
  const powers = { dash: false, pulse: false, shield: false };
  if (checkpoint === 'warehouse') {
    return createGameState({
      scene: 'warehouse', checkpoint, powers,
      player: { x: 520, y: 580 },
      warehouse: { introComplete: false },
    });
  }
  if (checkpoint === 'machine') {
    return createGameState({
      scene: 'machine', checkpoint, powers,
      player: { x: 1120, y: 580 },
      warehouse: {
        manualDelivered: 3,
        wage: 360,
        crates: CRATE_LAYOUT.map((crate) => (
          ['box-01', 'box-02', 'box-03'].includes(crate.id)
            ? { ...crate, status: 'pallet', x: PALLET.x, y: PALLET.y }
            : crate
        )),
      },
    });
  }
  if (checkpoint === 'red-crate' || checkpoint === 'reward') {
    return createGameState({
      scene: checkpoint,
      checkpoint,
      powers,
      player: { x: 800, y: 580 },
      arm: { awake: true, blocked: true },
      otherMind: { phase: 'awake', line: RESTORED_OTHER_MIND_LINE },
      warehouse: {
        manualDelivered: 3,
        autoDelivered: 6,
        wage: 1080,
        freeTime: 24,
        crates: CRATE_LAYOUT.map((crate) => {
          if (crate.id === 'red-01') return { ...crate, status: 'blocked', x: 720, y: 575 };
          return { ...crate, status: 'pallet', x: PALLET.x, y: PALLET.y };
        }),
      },
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
      introComplete: false,
    },
  };
}

export function getArmTransferPhase(progress = 0) {
  const value = Math.max(0, Math.min(1, progress));
  if (value < .24) return 'pickup';
  if (value < .84) return 'carry';
  return 'release';
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
        scene: manualDelivered === MANUAL_CRATES_REQUIRED ? 'machine' : state.scene,
        sceneTime: manualDelivered === MANUAL_CRATES_REQUIRED ? 0 : state.sceneTime,
        checkpoint: manualDelivered === MANUAL_CRATES_REQUIRED ? 'machine' : state.checkpoint,
        warehouse: { ...state.warehouse, manualDelivered },
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
        scene: manualDelivered === MANUAL_CRATES_REQUIRED ? 'machine' : state.scene,
        sceneTime: manualDelivered === MANUAL_CRATES_REQUIRED ? 0 : state.sceneTime,
        checkpoint: manualDelivered === MANUAL_CRATES_REQUIRED ? 'machine' : state.checkpoint,
        player: { ...state.player, carrying: null },
        warehouse: {
          ...state.warehouse,
          manualDelivered,
          wage: state.warehouse.wage + (delivered ? 120 : 0),
          lastDropAt: state.elapsed,
          lastDroppedId: crateId,
          lastDropDelivered: delivered,
          crates: updateCrate(state, crateId, (crate) => ({
            ...crate,
            x: delivered ? PALLET.x : (action.x ?? state.player.x),
            y: delivered ? PALLET.y : (action.y ?? state.player.y),
            status: delivered ? 'pallet' : 'floor',
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
    case 'first-command-accepted': {
      if (state.scene !== 'machine') return state;
      const queue = state.warehouse.crates
        .filter((crate) => crate.kind === 'normal' && crate.status === 'queued')
        .map((crate) => ({ type: 'arm.move', boxId: crate.id, targetId: PALLET.id }));
      return {
        ...state,
        scene: 'automation',
        checkpoint: 'machine',
        arm: {
          ...state.arm,
          awake: true,
          blocked: false,
          active: null,
          queue,
          wakeRevealRemaining: WAKE_REVEAL_DURATION,
        },
      };
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
      const autoDelivered = state.warehouse.autoDelivered + 1;
      const finished = autoDelivered >= 6;
      return {
        ...state,
        scene: state.scene,
        sceneTime: state.sceneTime,
        checkpoint: state.checkpoint,
        warehouse: {
          ...state.warehouse,
          autoDelivered,
          wage: state.warehouse.wage + 120,
          freeTime: state.warehouse.freeTime + 4,
          crates: state.warehouse.crates.map((crate) => {
            if (crate.id === action.boxId) return { ...crate, status: 'pallet' };
            if (finished && crate.id === 'red-01') return { ...crate, status: 'scan', x: 720, y: 575 };
            return crate;
          }),
        },
        arm: {
          ...state.arm,
          active: null,
          queue: finished ? [] : state.arm.queue,
          failure: finished ? { progress: 0, phase: 'reach' } : state.arm.failure,
          blocked: false,
        },
      };
    }
    case 'arm-failure-finished': {
      if (state.scene !== 'automation' || !state.arm.failure) return state;
      return {
        ...state,
        scene: 'red-crate',
        sceneTime: 0,
        checkpoint: 'red-crate',
        warehouse: {
          ...state.warehouse,
          crates: updateCrate(state, 'red-01', (crate) => ({ ...crate, status: 'blocked' })),
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
      return { ...state, scene: 'reward', sceneTime: 0, checkpoint: 'reward' };
    }
    default:
      return state;
  }
}

export function getNearbyAction(state) {
  if (state.scene === 'red-crate') {
    const red = state.warehouse.crates.find((crate) => crate.id === 'red-01');
    return red && distance(state.player, red) <= INTERACTION_RADIUS + 25
      ? { type: 'inspect-red-crate', label: 'ПРОВЕРИТЬ ЯЩИК' }
      : null;
  }
  if (state.scene === 'machine') {
    return distance(state.player, MACHINE) <= INTERACTION_RADIUS + 45
      ? { type: 'open-machine', label: 'ОТКРЫТЬ ТЕРМИНАЛ' }
      : null;
  }
  if (state.scene === 'automation') {
    return !state.arm.active && !state.arm.failure && state.arm.queue.length === 0 && distance(state.player, MACHINE) <= INTERACTION_RADIUS + 45
      ? { type: 'open-machine', label: 'ОТКРЫТЬ КОНСОЛЬ' }
      : null;
  }
  if (state.scene !== 'warehouse') return null;
  if (!state.warehouse.introComplete) return null;
  if (state.player.carrying) {
    if (distance(state.player, PALLET) <= INTERACTION_RADIUS + 35) {
      return { type: 'drop-crate', target: PALLET.id, label: 'НА ПАЛЕТУ' };
    }
    return { type: 'drop-crate', target: 'floor', label: 'ПОСТАВИТЬ' };
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

  if (next.scene === 'warehouse' && !next.warehouse.introComplete && next.sceneTime >= WAREHOUSE_INTRO_DURATION) {
    next = {
      ...next,
      warehouse: { ...next.warehouse, introComplete: true },
    };
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
