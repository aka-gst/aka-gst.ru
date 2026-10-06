import { CHIP_INSERT_DURATION, MACHINE } from './config.js';

export const CHIP_SOCKET = Object.freeze({ x: MACHINE.x, y: MACHINE.y + 286 });
export const DOOR_SLAM_AT = 5;
const clamp = (value) => Math.max(0, Math.min(1, value));
const smooth = (value) => { const t = clamp(value); return t * t * (3 - 2 * t); };

export function getBossBeat(time) {
  const entering = smooth(time / .9);
  const leaving = smooth((time - 4) / .8);
  return {
    x: 885 - 170 * entering + 170 * leaving,
    bossVisible: time < 4.8,
    speaking: time >= 1 && time < 4,
    doorOpen: time < 4.8 ? 1 : 1 - smooth((time - 4.8) / .2),
    fall: smooth((time - DOOR_SLAM_AT) / 1.2),
  };
}

export function getChipPose(state, reducedMotion = false) {
  if (state.scene === 'warehouse') {
    const t = getBossBeat(state.sceneTime).fall;
    return { x: 1180 - 330 * t, y: 215 + 320 * t, rotation: reducedMotion ? 0 : -.12 * t, scale: 1 };
  }
  const installed = state.arm.chip === 'installed';
  const t = installed ? 1 : state.arm.chip === 'inserting' ? smooth(state.sceneTime / CHIP_INSERT_DURATION) : 0;
  const p = reducedMotion && t < 1 ? 0 : t;
  return {
    x: 850 + (CHIP_SOCKET.x - 850) * p,
    y: 535 + (CHIP_SOCKET.y - 535) * p - (reducedMotion ? 0 : Math.sin(p * Math.PI) * 70),
    rotation: reducedMotion || p === 1 ? 0 : -.12 * (1 - p),
    scale: p === 1 ? .7 : 1 - .3 * p,
  };
}
