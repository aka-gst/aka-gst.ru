const MOVEMENT_KEYS = new Map([
  ['KeyW', [0, -1]],
  ['ArrowUp', [0, -1]],
  ['KeyS', [0, 1]],
  ['ArrowDown', [0, 1]],
  ['KeyA', [-1, 0]],
  ['ArrowLeft', [-1, 0]],
  ['KeyD', [1, 0]],
  ['ArrowRight', [1, 0]],
]);

const ACTION_KEYS = new Map([
  ['ShiftLeft', 'dash'],
  ['ShiftRight', 'dash'],
  ['KeyQ', 'pulse'],
  ['KeyE', 'shield'],
  ['Space', 'action'],
]);

export function createInput(target = window) {
  const held = new Set();
  const pressed = new Set();
  const state = { moveX: 0, moveY: 0 };
  let pointer = null;

  function calculateMovement() {
    let x = 0;
    let y = 0;
    for (const code of held) {
      const movement = MOVEMENT_KEYS.get(code);
      if (movement) {
        x += movement[0];
        y += movement[1];
      }
    }
    if (pointer) {
      const dx = pointer.x - pointer.startX;
      const dy = pointer.y - pointer.startY;
      const length = Math.hypot(dx, dy);
      if (length > 12) {
        x += dx / Math.max(64, length);
        y += dy / Math.max(64, length);
      }
    }
    state.moveX = Math.max(-1, Math.min(1, x));
    state.moveY = Math.max(-1, Math.min(1, y));
  }

  function keyDown(event) {
    if (event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement) return;
    if (MOVEMENT_KEYS.has(event.code)) held.add(event.code);
    const action = ACTION_KEYS.get(event.code);
    if (action && !event.repeat) pressed.add(action);
    if (MOVEMENT_KEYS.has(event.code) || action) event.preventDefault();
    calculateMovement();
  }

  function keyUp(event) {
    held.delete(event.code);
    calculateMovement();
  }

  function pointerDown(event) {
    if (event.target !== target) return;
    pointer = { id: event.pointerId, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY };
    target.setPointerCapture?.(event.pointerId);
  }

  function pointerMove(event) {
    if (!pointer || pointer.id !== event.pointerId) return;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    calculateMovement();
  }

  function pointerUp(event) {
    if (!pointer || pointer.id !== event.pointerId) return;
    pointer = null;
    calculateMovement();
  }

  window.addEventListener('keydown', keyDown, { passive: false });
  window.addEventListener('keyup', keyUp);
  target.addEventListener('pointerdown', pointerDown);
  target.addEventListener('pointermove', pointerMove);
  target.addEventListener('pointerup', pointerUp);
  target.addEventListener('pointercancel', pointerUp);

  return {
    state,
    press(action) { pressed.add(action); },
    consume(action) {
      const active = pressed.has(action);
      pressed.delete(action);
      return active;
    },
    destroy() {
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      target.removeEventListener('pointerdown', pointerDown);
      target.removeEventListener('pointermove', pointerMove);
      target.removeEventListener('pointerup', pointerUp);
      target.removeEventListener('pointercancel', pointerUp);
    },
  };
}
