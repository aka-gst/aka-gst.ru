import { createGameState, stepGame, applyGameAction, getNearbyAction } from './model.js?v=novice-1';
import { PALLET } from './config.js?v=novice-1';

// A fixed input tape through the real engine. No gameplay state/score is fabricated.
// The only edit is a declared cut from combat to warehouse, omitting the disconnect.
export function buildReplay() {
  const fps = 30, dt = 1 / 60;
  const frames = [], events = [];
  let state = createGameState();
  let warehouseTick = 0, tail = 0, cutFrame = -1;
  for (let tick = 0; tick < 2700; tick++) {
    let input = {};
    if (state.scene === 'prologue') {
      if (tick === 0 || tick === 132) state = applyGameAction(state, { type: 'shield' });
      input = { moveX: tick < 120 ? -.35 : .35, moveY: -.15 };
    } else if (state.scene === 'warehouse') {
      if (state.warehouse.manualDelivered < 2) {
        const action = getNearbyAction(state);
        if (action && ['pick-crate', 'drop-crate'].includes(action.type)) {
          const target = action.type === 'drop-crate' ? PALLET : state.warehouse.crates.find(c => c.id === action.crateId);
          const distance = Math.hypot(target.x-state.player.x, target.y-state.player.y);
          const crateId = action.crateId ?? state.player.carrying;
          const beforeWage = state.warehouse.wage;
          state = applyGameAction(state, { ...action, distance });
          events.push({ type: action.type, crateId, distance, beforeWage, afterWage: state.warehouse.wage, at: state.elapsed });
        }
        if (state.warehouse.manualDelivered < 2) {
          const target = state.player.carrying ? PALLET : state.warehouse.crates
            .filter(c => c.status === 'source')
            .sort((a,b) => Math.hypot(a.x-state.player.x,a.y-state.player.y)-Math.hypot(b.x-state.player.x,b.y-state.player.y))[0];
          input = { moveX: target.x-state.player.x, moveY: target.y-state.player.y };
        }
      } else tail++;
    }
    state = stepGame(state, input, dt);
    if (state.scene === 'prologue' && tick >= 23 && tick < 263 && tick % 2 === 1) {
      frames.push({ state, now: state.elapsed * 1000 });
    }
    if (state.scene === 'warehouse') {
      if (cutFrame < 0) cutFrame = frames.length;
      if (warehouseTick++ % 2 === 0) frames.push({ state, now: state.elapsed * 1000 });
      if (tail >= 90) return { fps, frames, events, cutFrame, durationMs: frames.length / fps * 1000 };
    }
  }
  throw new Error('Replay did not complete two legal human deliveries within 45 simulated seconds');
}
