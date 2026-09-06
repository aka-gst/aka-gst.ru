import { MACHINE, PALLET } from './config.js?v=novice-1';

// One destination, one verb. The same target drives the button and walking.
export function getInteractionTarget(state) {
  if (state.scene === 'chip' && state.arm.chip === 'fallen') {
    return { x: 850, y: 535, type: 'insert-python-chip', label: 'Вставить чип Python' };
  }
  if (state.scene === 'machine') return { ...MACHINE, type: 'open-machine', label: 'Разбудить руку' };
  if (state.scene === 'red-crate') {
    const crate = state.warehouse.crates.find(({ id }) => id === 'red-01');
    return crate ? { ...crate, type: 'inspect-red-crate', label: 'Что за красный ящик?' } : null;
  }
  if (state.scene !== 'warehouse' || !state.warehouse.introComplete) return null;
  if (state.player.carrying) return { ...PALLET, type: 'drop-crate', target: PALLET.id, label: 'На ленту · +$120' };
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

export function buildWakeFragment(source, fragment) {
  if (fragment === 'print') return 'print';
  if (fragment === 'wake') return 'print("wake")';
  return source;
}
