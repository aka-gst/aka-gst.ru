// The Shift 1 factory hall as a grid for src/game/raycaster.js. Pure data and
// pure helpers only (no DOM), so tools/first-shift-map.test.mjs can walk it.
//
// 29.09, Сергей: crates, then the arm, then the belt, in one line; the belt
// runs into the wall "и там типа или пустота, или другая часть завода"; the
// room smaller rather than empty; people around doing something.
import { createCell, cellAt } from './raycaster.js';

export const EYE = 1.6;
export const HALL_CEIL = 4;
export const GIRDER_CEIL = 3.4;
export const CRATE_H = 0.8;
export const BELT_H = 0.88;
export const DOOR_H = 2.67;
export const LINTEL_H = 2;
export const PLAYER_R = 0.28;
const STEP_UP = 0.3;
const HEADROOM = 1.9;

// 20 x 18 cells, 1 m each. Legend below. The hall is x 1..15, z 1..13.
export const FACTORY_ROWS = [
  '####################',
  '#MM..RRRRRR.....####',
  '#MM.............P###',
  '#...............P###',
  '#..ccc..........####',
  '#..ccc.A.=======Obb#',
  '#...............####',
  '#k..I.....I.....####',
  '#kk.............####',
  '#K..............E###',
  '#.....WW........####',
  '#...I.....I.....####',
  '#...............####',
  '#kk.............####',
  '############aa######',
  '############DD######',
  '############ff######',
  '####################',
];
const GIRDER_ROWS = new Set([3, 7, 11]);

// The pile the player carries from, by cell: 9 crates, 3 by hand, 6 for the arm.
export const PILE = Object.freeze([
  { cx: 3, cz: 4, count: 2 }, { cx: 4, cz: 4, count: 2 }, { cx: 5, cz: 4, count: 1 },
  { cx: 3, cz: 5, count: 2 }, { cx: 4, cz: 5, count: 1 }, { cx: 5, cz: 5, count: 1 },
]);

export const SPOTS = Object.freeze({
  spawn: { x: 8.5, z: 13.2, yaw: 0 },
  boss: { x: 8.5, z: 10.5 },
  arm: { x: 7.5, z: 5.5 },
  beltDrop: { x: 9.5, z: 5.5 },
  beltEnd: { x: 18.6, z: 5.5 },
  door: { x: 13, z: 15.5 },
  // Where the boss walks when he leaves; the chip falls out at the first point.
  bossExit: [{ x: 10.6, z: 12.1 }, { x: 13, z: 13.3 }, { x: 13, z: 14.6 }, { x: 13, z: 16.6 }],
});

// facing is a world yaw (0 = north, PI/2 = east): who looks at what. The
// people are drawn from 8 sides, so walking around them shows their back.
export const WORKER_SPOTS = Object.freeze({
  welder: { x: 3.35, z: 2.45, facing: -Math.PI / 2 },
  fitter: { x: 15.25, z: 2.6, facing: Math.PI / 2 },
  electrician: { x: 15.3, z: 9.5, facing: Math.PI / 2 },
  lunch: { x: 2.3, z: 11.4, facing: Math.PI / 2 },
});

// Which of the 8 drawn views the camera sees: 0 front, 2 the person's right
// side, 4 back, 6 their left side (Doom's A1..A8 rotations).
export function viewIndex(facing, camX, camZ, x, z) {
  const toCam = Math.atan2(camX - x, -(camZ - z));
  let r = toCam - facing;
  while (r > Math.PI) r -= Math.PI * 2;
  while (r < -Math.PI) r += Math.PI * 2;
  return ((Math.round(r / (Math.PI / 4)) % 8) + 8) % 8;
}

// A point given in a person's own frame (forward metres, right metres),
// placed in the world -- e.g. where the welding torch actually is.
export function localToWorld(x, z, facing, forward, right) {
  const fx = Math.sin(facing), fz = -Math.cos(facing);
  return { x: x + fx * forward + Math.cos(facing) * right, z: z + fz * forward + Math.sin(facing) * right };
}

export const LAMPS = Object.freeze([
  { x: 4.5, z: 4.6, radius: 6.5, intensity: 1.05, color: [1, 0.86, 0.62] },
  { x: 11.5, z: 4.6, radius: 6.5, intensity: 1.05, color: [1, 0.86, 0.62] },
  { x: 4.5, z: 9.4, radius: 6, intensity: 0.95, color: [1, 0.86, 0.62] },
  { x: 11.5, z: 9.4, radius: 6, intensity: 0.95, color: [1, 0.86, 0.62] },
  { x: 8.5, z: 12.6, radius: 5, intensity: 0.8, color: [1, 0.88, 0.7] },
  { x: 2.8, z: 2.8, radius: 3.8, intensity: 0.85, color: [0.75, 0.88, 1] },
  { x: 14.2, z: 2.6, radius: 4, intensity: 0.75, color: [1, 0.86, 0.62] },
  { x: 14.2, z: 9.5, radius: 4, intensity: 0.7, color: [1, 0.86, 0.62] },
  { x: 2.4, z: 11.6, radius: 3.6, intensity: 0.7, color: [1, 0.9, 0.7] },
]);

function wallTex(x, z) {
  return ['CEMENT1', 'CEMENT3', 'CEMENT1', 'CEMENT6'][(x * 7 + z * 3) % 4];
}

export function buildFactoryMap(rows = FACTORY_ROWS) {
  const h = rows.length, w = rows[0].length;
  const cells = [];
  const pile = new Map(PILE.map((p) => [`${p.cx},${p.cz}`, p.count]));
  for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) {
    const ch = rows[z][x];
    const girder = GIRDER_ROWS.has(z) && x > 0 && x < 16 && z < 14;
    const base = {
      floor: 0, ceil: girder ? GIRDER_CEIL : HALL_CEIL, ftex: 'FLOOR0_7', ctex: girder ? 'FLAT23' : 'CEIL3_5',
      upper: girder ? 'SHAWN02' : 'CEMENT1', kind: ch,
    };
    let c;
    switch (ch) {
      case '#': c = createCell({ ...base, solid: true, wall: wallTex(x, z) }); break;
      case 'V': c = createCell({ ...base, solid: true, wall: null }); break;
      case 'I': c = createCell({ ...base, solid: true, wall: 'SUPPORT2' }); break;
      case 'P': c = createCell({ ...base, solid: true, wall: 'PIPES' }); break;
      case 'E': c = createCell({ ...base, solid: true, wall: 'SILVER3' }); break;
      case 'M': c = createCell({ ...base, floor: 1.4, wall: 'COMPSTA1', peg: 'top', ftex: 'CONS1_1' }); break;
      case 'R': c = createCell({ ...base, floor: 2.6, wall: 'RACK', ftex: 'CRATOP1' }); break;
      case 'k': c = createCell({ ...base, floor: CRATE_H * 2, wall: 'CRATE_G', ftex: 'CRATOP1' }); break;
      case 'K': c = createCell({ ...base, floor: CRATE_H * 3, wall: 'CRATE_G', ftex: 'CRATOP1' }); break;
      case 'W': c = createCell({ ...base, floor: 0.9, wall: 'SHAWN02', ftex: 'CRATOP2' }); break;
      case 'c': c = createCell({ ...base, floor: CRATE_H * (pile.get(`${x},${z}`) ?? 0), wall: 'CRATE_B', ftex: 'CRATOP2' }); break;
      case 'A': c = createCell({ ...base, floor: 0.25, wall: 'CEMENT1', ftex: 'HAZARD' }); break;
      case '=': c = createCell({ ...base, floor: BELT_H, wall: 'BELT_SIDE', ftex: 'BELT_TOP', scroll: [0.55, 0] }); break;
      case 'O': c = createCell({ ...base, floor: BELT_H, ceil: LINTEL_H, wall: 'BELT_SIDE', upper: 'SIGN_LOAD', ftex: 'BELT_TOP', scroll: [0.55, 0] }); break;
      case 'b': c = createCell({ ...base, floor: BELT_H, ceil: LINTEL_H, wall: 'BELT_SIDE', ftex: 'BELT_TOP', scroll: [0.55, 0], dark: true }); break;
      case 'a': c = createCell({ ...base, ceil: DOOR_H, upper: 'CEMENT1', ftex: 'FLOOR0_5' }); break;
      case 'D': c = createCell({ ...base, ceil: 0, upper: 'BIGDOOR2', ftex: 'FLOOR0_5', door: true }); break;
      case 'f': c = createCell({ ...base, ceil: DOOR_H, ftex: 'FLOOR0_5', dark: true }); break;
      default: c = createCell(base);
    }
    c.x = x; c.z = z;
    cells.push(c);
  }
  const map = { w, h, cells, textures: {} };
  // Wall signs are separate textures on specific solid cells.
  for (const [x, z, name] of [[8, 0, 'SIGN_HALL_L'], [9, 0, 'SIGN_HALL_R'], [0, 12, 'SIGN_LUNCH'], [0, 10, 'SIGN_CLOCK']]) {
    map.cells[z * w + x].wall = name;
  }
  return map;
}

// 18.0: the corridor in front of the boss's gate (cells 'aa', row 14). Going
// in there pushes you back: «только для мееенеджеров».
export function nearBossDoor(x, z) {
  return z > 14.3 && z < 15.2 && x > 11.9 && x < 14.1;
}

export function isBlockedCell(cell) {
  if (!cell || cell.solid) return true;
  if (cell.floor > STEP_UP) return true;
  return cell.ceil - Math.max(0, cell.floor) < HEADROOM;
}

// Circle vs. grid (and vs. people/machines as circles).
export function collides(map, x, z, r = PLAYER_R, circles = []) {
  for (let cz = Math.floor(z - r); cz <= Math.floor(z + r); cz++) {
    for (let cx = Math.floor(x - r); cx <= Math.floor(x + r); cx++) {
      const cell = cellAt(map, cx + 0.5, cz + 0.5);
      if (!isBlockedCell(cell)) continue;
      const nx = Math.max(cx, Math.min(x, cx + 1));
      const nz = Math.max(cz, Math.min(z, cz + 1));
      if ((x - nx) ** 2 + (z - nz) ** 2 < r * r) return true;
    }
  }
  for (const c of circles) {
    if ((x - c.x) ** 2 + (z - c.z) ** 2 < (r + c.r) ** 2) return true;
  }
  return false;
}

// Axis-separated move, so walking into a wall slides along it like in Doom.
export function moveWithCollision(map, x, z, dx, dz, r = PLAYER_R, circles = []) {
  let nx = x, nz = z;
  if (dx && !collides(map, x + dx, z, r, circles)) nx = x + dx;
  if (dz && !collides(map, nx, z + dz, r, circles)) nz = z + dz;
  return { x: nx, z: nz };
}

// Cells reachable on foot from a point (4-connected flood fill).
export function reachableCells(map, from) {
  const seen = new Set();
  const start = [Math.floor(from.x), Math.floor(from.z)];
  const queue = [start];
  seen.add(start.join(','));
  while (queue.length) {
    const [x, z] = queue.shift();
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz, key = `${nx},${nz}`;
      if (seen.has(key)) continue;
      if (isBlockedCell(cellAt(map, nx + 0.5, nz + 0.5))) continue;
      seen.add(key);
      queue.push([nx, nz]);
    }
  }
  return seen;
}

// First cell face a ray hits within `maxDist`, walking the grid like the
// renderer does. Used for "what is under the crosshair".
export function castCenter(map, x, z, yaw, maxDist, eye = EYE) {
  const dirX = Math.sin(yaw), dirZ = -Math.cos(yaw);
  let mapX = Math.floor(x), mapZ = Math.floor(z);
  const deltaX = dirX === 0 ? 1e30 : Math.abs(1 / dirX);
  const deltaZ = dirZ === 0 ? 1e30 : Math.abs(1 / dirZ);
  const stepX = dirX < 0 ? -1 : 1, stepZ = dirZ < 0 ? -1 : 1;
  let sideX = dirX < 0 ? (x - mapX) * deltaX : (mapX + 1 - x) * deltaX;
  let sideZ = dirZ < 0 ? (z - mapZ) * deltaZ : (mapZ + 1 - z) * deltaZ;
  for (let i = 0; i < 64; i++) {
    let t;
    if (sideX < sideZ) { t = sideX; sideX += deltaX; mapX += stepX; }
    else { t = sideZ; sideZ += deltaZ; mapZ += stepZ; }
    if (t > maxDist) return null;
    const cell = cellAt(map, mapX + 0.5, mapZ + 0.5);
    if (!cell) return null;
    if (cell.solid || cell.floor > 0.3 || cell.ceil < eye) return { cell, cx: mapX, cz: mapZ, dist: t };
  }
  return null;
}
