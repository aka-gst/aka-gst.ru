import { MACHINE, WORLD } from './config.js';

export function getSceneCameraTarget(state) {
  if (state.scene !== 'automation' || !state.arm?.failure) return state.player;

  const redCrate = state.warehouse?.crates?.find((crate) => crate.id === 'red-01');
  if (!redCrate) return state.player;

  return {
    x: redCrate.x * 0.6 + MACHINE.x * 0.4,
    y: state.player.y,
  };
}

export function getViewportTransform(viewport, player) {
  const portrait = viewport.width < viewport.height * 0.82;
  if (!portrait) {
    const scale = Math.min(viewport.width / WORLD.width, viewport.height / WORLD.height);
    return {
      scale,
      offsetX: (viewport.width - WORLD.width * scale) / 2,
      offsetY: (viewport.height - WORLD.height * scale) / 2,
    };
  }

  const scale = viewport.height / WORLD.height;
  const visibleWidth = viewport.width / scale;
  const cameraX = Math.max(visibleWidth / 2, Math.min(WORLD.width - visibleWidth / 2, player.x));
  return {
    scale,
    offsetX: viewport.width / 2 - cameraX * scale,
    offsetY: 0,
  };
}

export function screenToWorld(point, transform) {
  return {
    x: (point.x - transform.offsetX) / transform.scale,
    y: (point.y - transform.offsetY) / transform.scale,
  };
}
