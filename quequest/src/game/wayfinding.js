import { CRATE_PAY, MACHINE, PALLET } from './config.js?v=game-162';

const MACHINE_TERMINAL = Object.freeze({ x: MACHINE.x, y: MACHINE.y + 175 });
const CHIP_SOCKET_TARGET = Object.freeze({ x: MACHINE.x, y: MACHINE.y + 286 });
const LOOSE_START_BUTTON = Object.freeze({ x: MACHINE.x + 145, y: MACHINE.y + 200 });

// One destination, one verb. The same physical object drives the prompt and SPACE/E action.
export function getInteractionTarget(state) {
  if (state.scene === 'chip' && ['fallen','held'].includes(state.arm.chip)) {
    return state.arm.chip === 'held'
      ? { ...CHIP_SOCKET_TARGET, type: 'insert-python-chip', label: 'Вставить чип в разъём руки' }
      : { x: 850, y: 535, type: 'pick-python-chip', label: 'Поднять чип' };
  }
  // 19.0 · the first week: day 1 the green button, then the terminal.
  if (state.warehouse?.week && ['machine', 'condition'].includes(state.scene)) {
    if (state.warehouse.week === 'button') return { ...LOOSE_START_BUTTON, type: 'press-start-button', label: 'Нажать зелёную кнопку «ПУСК»' };
    const label = { copy: 'Терминал руки · скопировать строчку', assemble: 'Терминал руки · собрать строчку', hand: 'Терминал руки · написать правило', auto: 'Терминал руки · запустить всю линию' }[state.warehouse.week];
    return { ...MACHINE_TERMINAL, type: 'open-machine', label };
  }
  if (state.scene === 'machine' && state.checkpoint === 'shift2' && state.warehouse.day2 === 'button') {
    return { ...LOOSE_START_BUTTON, type: 'press-start-button', label: 'Нажать зелёную кнопку' };
  }
  if (state.scene === 'machine' && state.checkpoint === 'shift2' && state.warehouse.day2 === 'tear') return null;
  if (['machine','condition','forlesson','queue','function'].includes(state.scene)) {
    return { ...MACHINE_TERMINAL, type: 'open-machine', label: state.scene === 'machine' ? 'Открыть терминал руки' : 'Открыть терминал' };
  }
  if (state.scene === 'automation' && !state.arm.active && !state.arm.failure && state.arm.queue.length === 0) {
    return { ...MACHINE_TERMINAL, type: 'open-machine', label: 'Открыть терминал' };
  }
  if (state.scene === 'red-crate') {
    const crate = state.warehouse.crates.find(({ kind, status }) => kind === 'red' && ['blocked','scan','queued'].includes(status));
    return crate ? { ...crate, type: 'inspect-red-crate', label: 'Осмотреть остановившийся груз' } : null;
  }
  if (state.scene !== 'warehouse' || !state.warehouse.introComplete) return null;
  if (state.player.carrying) return { ...PALLET, type: 'drop-crate', target: PALLET.id, label: `Положить на палету · +${CRATE_PAY} ₽` };
  const crate = state.warehouse.crates
    .filter(({ kind, status }) => kind === 'normal' && ['source', 'floor'].includes(status))
    .sort((a, b) => Math.hypot(a.x - state.player.x, a.y - state.player.y) - Math.hypot(b.x - state.player.x, b.y - state.player.y))[0];
  return crate ? { ...crate, type: 'pick-crate', crateId: crate.id, label: 'Взять ящик' } : null;
}

export function navigateToTarget(player, target) {
  if (!target) return { moveX: 0, moveY: 0, arrived: false };
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const length = Math.hypot(dx, dy);
  return { moveX: length > 48 ? dx / length : 0, moveY: length > 48 ? dy / length : 0, arrived: length <= 48 };
}

export function placeWorldButton(target, transform, viewport, width = 220) {
  const x = target.x * transform.scale + transform.offsetX;
  const y = (target.y - 85) * transform.scale + transform.offsetY;
  const margin = Math.min(width, viewport.width - 24) / 2 + 12;
  return {
    x: Math.max(margin, Math.min(viewport.width - margin, x)),
    y: Math.max(150, Math.min(viewport.height - 105, y)),
    direction: x < margin ? 'left' : (x > viewport.width - margin ? 'right' : 'here'),
  };
}

// Legacy helper kept for compatibility with old tests/tools. 16.2 no longer inserts code by clicking fragments.
export function buildWakeFragment(source, fragment) {
  if (fragment === 'print') return 'print';
  if (fragment === 'wake') return 'print("wake")';
  return source;
}
