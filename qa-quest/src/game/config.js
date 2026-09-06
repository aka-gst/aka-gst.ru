export const GAME_VERSION = 1;
export const STORAGE_KEY = 'quequest.game.v1';

export const WORLD = Object.freeze({ width: 1600, height: 900 });
export const THREATS_TO_COLLAPSE = 22;
export const MANUAL_CRATES_REQUIRED = 3;
export const COLLAPSE_DURATION = 2.8;
export const MAX_DT = 0.05;
export const PLAYER_SPEED = 310;
export const INTERACTION_RADIUS = 92;
export const AUTOFIRE_FIRST_SHOT = 0.35;
export const AUTOFIRE_INTERVAL = 0.36;
export const PROLOGUE_TIMEOUT = 8.4;
export const WAREHOUSE_INTRO_DURATION = 5.2;
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

export const CHECKPOINTS = Object.freeze([
  'start',
  'warehouse',
  'chip',
  'machine',
  'red-crate',
  'reward',
]);
