// 17.3 · Гараж и квартира от первого лица, в духе Duke Nukem 3D. Сергей
// 02.10: «давай и в гараже и в квартире ходить как в режиме дюк-нюкема 3д».
//
// Pure data and pure rules (no DOM): the two levels as raycaster grids
// (cells with their own floor/ceiling heights -- stairs, a loft, a sunken
// living room, a car you can climb), the things you can press E on, what
// each press does, and which one you are looking at. fp-world.js draws and
// drives it; tools/fp-world.test.mjs walks it.
import { createCell, cellAt } from './raycaster.js';

const freeze = Object.freeze;
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- garage
// 16 x 17 cells, 1 m each. Inside x 1..14, z 1..11; the roll-up door is the
// DDDD in the south wall, the street (rain) is beyond it. Legend:
//   R rack (2.0)   L loft (1.8)   s old sofa on the loft   B workbench (0.95)
//   n h r k  the blue car: nose 0.75, hood 0.95, roof 1.45, trunk 1.0
//   1..5 stairs (0.3 each)   t T tyre stacks   D roll-up door   H door home
//   o street   # wall
export const GARAGE_ROWS = freeze([
  '################',
  '#RRRRR....LLLLL#',
  '#.........LLsLL#',
  '#B........LLLLL#',
  '#B...nn......55#',
  '#B...hh......44#',
  '#B...rr......33#',
  '#....rr......22#',
  '#....kk......11#',
  '#t.............#',
  '#T.............H',
  '#..............#',
  '####DDDD########',
  '#oooooooooooooo#',
  '#oooooooooooooo#',
  '#oooooooooooooo#',
  '################',
]);
export const GARAGE_CEIL = 4.4;
export const ROLL_DOOR_OPEN = 3.0;
export const CAR = freeze({ x0: 5, x1: 7, z0: 4, z1: 9 });
const CAR_H = freeze({ n: 0.75, h: 0.95, r: 1.45, k: 1.0 });

// ------------------------------------------------------------- apartment
// 15 x 12. Base floor is 0.3 m (the living room is a sunken pit at 0).
//   b bed (0.75)  d desk with the PC (1.05)  _ sunken living room (0)
//   f sofa (0.75)  k kitchen counter (1.2)  F fridge  a bath (0.85)
//   W window   V TV   Q bathroom door   M mirror   E door to the garage
export const HOME_ROWS = freeze([
  '##WW#####VV####',
  '#bb..dd#______#',
  '#bb....#______#',
  '#......#______#',
  '#.............#',
  '#......#..ff..#',
  '#......#......#',
  '##Q#######...##',
  '#..#kkkk.....F#',
  'M..#..........E',
  '#aa#..........#',
  '###############',
]);
export const HOME_BASE = 0.3;
export const HOME_CEIL = 3.0;
export const DOOR_OPEN_H = 2.4;

export const LEVELS = freeze({
  garage: freeze({ id: 'garage', title: 'ГАРАЖ · МАШИНА ВИТИ', rows: GARAGE_ROWS, spawn: freeze({ x: 9.3, z: 10.6, yaw: -0.75 }) }),
  home: freeze({ id: 'home', title: 'КВАРТИРА · НОЧЬ', rows: HOME_ROWS, spawn: freeze({ x: 12.5, z: 9.5, yaw: -Math.PI / 2 }) }),
});
// Where you come in through a connecting door.
export const ARRIVALS = freeze({
  garage: freeze({ x: 13.6, z: 10.5, yaw: -Math.PI / 2 }),
  home: freeze({ x: 13.3, z: 9.5, yaw: -Math.PI / 2 }),
});

function garageCell(ch, x, z) {
  const base = { floor: 0, ceil: GARAGE_CEIL, ftex: 'GFLOOR', ctex: 'GCEIL', upper: 'CEMENT1', kind: ch };
  if (ch >= '1' && ch <= '5') return createCell({ ...base, floor: Number(ch) * 0.3, wall: 'STAIR', ftex: 'STAIRTOP', kind: 'stair' });
  if ('nhrk'.includes(ch)) {
    const faces = { w: 'CAR_W', e: 'CAR_E', n: ch === 'r' ? 'CAR_WSHIELD' : 'CAR_FRONT', s: ch === 'r' ? 'CAR_RWIN' : 'CAR_REAR' };
    return createCell({ ...base, floor: CAR_H[ch], wall: 'CAR_W', ftex: ch === 'r' ? 'CAR_ROOF' : 'CAR_HOOD', faces, kind: 'car', part: ch });
  }
  switch (ch) {
    case '#': return createCell({ ...base, solid: true, wall: z >= 12 ? 'BRICK' : (x === 0 && z >= 3 && z <= 6 ? 'TOOLWALL' : 'GWALL') });
    case 'R': return createCell({ ...base, floor: 2.0, wall: 'RACK', ftex: 'CRATOP1', kind: 'rack' });
    case 'L': return createCell({ ...base, floor: 1.8, wall: 'LOFTSIDE', ftex: 'PLANKS', kind: 'loft' });
    case 's': return createCell({ ...base, floor: 2.25, wall: 'SOFA', ftex: 'SOFATOP', kind: 'sofa' });
    case 'B': return createCell({ ...base, floor: 0.95, wall: 'BENCH', ftex: 'BENCHTOP', kind: 'bench' });
    case 't': return createCell({ ...base, floor: 0.8, wall: 'TIRE', ftex: 'TIRETOP', kind: 'tyres' });
    case 'T': return createCell({ ...base, floor: 1.25, wall: 'TIRE', ftex: 'TIRETOP', kind: 'tyres' });
    case 'D': return createCell({ ...base, ceil: 0, upper: 'ROLLDOOR', ftex: 'GFLOOR', door: 'roll', kind: 'door' });
    case 'H': return createCell({ ...base, solid: true, wall: 'GWALL', faces: { e: null, w: 'HOMEDOOR' }, kind: 'exit' });
    case 'o': return createCell({ ...base, ceil: 9, ftex: 'ASPHALT', ctex: 'SKY', upper: 'BRICK', kind: 'street', outdoor: true });
    default: return createCell(base);
  }
}

function homeCell(ch, x, z) {
  const kitchen = z >= 8 && x >= 4, bath = z >= 8 && x <= 3;
  const base = { floor: HOME_BASE, ceil: HOME_CEIL, ftex: bath ? 'TILE' : kitchen ? 'KTILE' : 'PARQUET', ctex: 'PLASTER', upper: 'WALLPAPER', kind: ch };
  switch (ch) {
    case '#': return createCell({ ...base, solid: true, wall: bath && x <= 4 ? 'TILEWALL' : (kitchen ? 'KWALL' : 'WALLPAPER') });
    case 'W': return createCell({ ...base, solid: true, wall: 'WALLPAPER', faces: { s: 'WINDOW' }, kind: 'window' });
    case 'V': return createCell({ ...base, solid: true, wall: 'WALLPAPER', faces: { s: 'TV_OFF' }, kind: 'tv' });
    case 'M': return createCell({ ...base, solid: true, wall: 'TILEWALL', faces: { e: 'MIRROR' }, mirror: true, kind: 'mirror' });
    case 'E': return createCell({ ...base, solid: true, wall: 'KWALL', faces: { w: 'EXITDOOR' }, kind: 'exit' });
    case 'F': return createCell({ ...base, solid: true, wall: 'KWALL', faces: { w: 'FRIDGE', n: 'FRIDGE_SIDE', s: 'FRIDGE_SIDE' }, kind: 'fridge' });
    case 'b': return createCell({ ...base, floor: 0.75, wall: 'BED', ftex: 'BEDTOP', kind: 'bed' });
    case 'd': return createCell({ ...base, floor: 1.05, wall: 'DESK', ftex: 'DESKTOP', kind: 'desk' });
    case 'f': return createCell({ ...base, floor: 0.75, wall: 'SOFA', ftex: 'SOFATOP', kind: 'sofa' });
    case 'k': return createCell({ ...base, floor: 1.2, wall: 'COUNTER', ftex: 'COUNTERTOP', kind: 'counter' });
    case 'a': return createCell({ ...base, floor: 0.85, wall: 'BATH', ftex: 'BATHTOP', kind: 'bath' });
    case '_': return createCell({ ...base, floor: 0, wall: 'PARQUET', ftex: 'CARPET', kind: 'pit' });
    case 'Q': return createCell({ ...base, ceil: HOME_BASE, upper: 'WOODDOOR', door: 'swing', kind: 'door' });
    default: return createCell(base);
  }
}

export function buildLevelMap(id) {
  const level = LEVELS[id];
  if (!level) throw new Error(`unknown level ${id}`);
  const rows = level.rows;
  const h = rows.length, w = rows[0].length;
  const cells = [];
  for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) {
    const ch = rows[z][x];
    const c = id === 'garage' ? garageCell(ch, x, z) : homeCell(ch, x, z);
    c.x = x; c.z = z;
    cells.push(c);
  }
  // 17.4 liquids: rain puddles at the roll door, an oil pool by the bench,
  // the water in the bath (engine-ladder.js "liquids").
  const puddles = id === 'garage' ? [[5, 13, 'PUDDLE'], [6, 13, 'PUDDLE'], [6, 14, 'PUDDLE'], [10, 14, 'PUDDLE'], [11, 13, 'PUDDLE'], [3, 9, 'OILPOOL']] : [];
  for (const [x, z, t] of puddles) { const c = cells[z * w + x]; c.ftex = t; c.liquid = true; }
  for (const c of cells) if (c.kind === 'bath') c.liquid = true;
  return { id, w, h, cells, textures: {} };
}

// ---------------------------------------------------------------- lights
// Baked lamps by group; a switch toggles a group (the lightmap is re-baked,
// it takes a millisecond). `always` lamps have no switch.
export const LAMPS = freeze({
  garage: freeze([
    freeze({ group: 'main', x: 6.5, z: 4.5, radius: 7.5, intensity: 0.85, color: [0.85, 0.95, 1] }),
    freeze({ group: 'main', x: 6.5, z: 9.5, radius: 6.5, intensity: 0.75, color: [0.85, 0.95, 1] }),
    freeze({ group: 'work', x: 3.2, z: 7.6, radius: 5, intensity: 1.1, color: [1, 0.78, 0.45] }),
    freeze({ group: 'loft', x: 12, z: 2, radius: 4.5, intensity: 0.8, color: [1, 0.7, 0.4] }),
    freeze({ group: 'street', x: 9.5, z: 15.3, radius: 7, intensity: 0.95, color: [1, 0.55, 0.2] }),
  ]),
  home: freeze([
    freeze({ group: 'bedroom', x: 3.5, z: 3.5, radius: 5.5, intensity: 0.9, color: [1, 0.86, 0.66] }),
    freeze({ group: 'living', x: 10.5, z: 3.2, radius: 6.5, intensity: 0.9, color: [1, 0.84, 0.6] }),
    freeze({ group: 'kitchen', x: 9, z: 9.2, radius: 5.5, intensity: 0.95, color: [0.9, 0.97, 1] }),
    freeze({ group: 'bath', x: 1.8, z: 9.2, radius: 3.4, intensity: 0.95, color: [0.85, 0.95, 1] }),
    freeze({ group: 'street', x: 2.5, z: -1.5, radius: 3.2, intensity: 0.5, color: [0.5, 0.6, 1] }),
  ]),
});
export const START_LIGHTS = freeze({
  garage: freeze({ main: true, work: true, loft: true, street: true }),
  home: freeze({ bedroom: true, living: true, kitchen: true, bath: true, street: true }),
});

export function activeLamps(id, lights = {}) {
  return LAMPS[id].filter((L) => lights[L.group] !== false);
}

// ---------------------------------------------------------------- things
// Things you can press E on. y: height of the thing (for the prompt and the
// "is it under the crosshair" test). reach: how close you must be.
const T = (id, kind, x, z, y, label, extra = {}) => freeze({ id, kind, x, z, y, label, reach: 1.7, ...extra });
export const THINGS = freeze({
  garage: freeze([
    T('laptop', 'laptop', 1.62, 4.6, 1.05, 'НОУТБУК · СТОРОЖ МАШИНЫ', { program: 'garage', reach: 1.9 }),
    T('sw-main', 'switch', 14.93, 9.0, 1.3, 'СВЕТ', { group: 'main' }),
    T('worklamp', 'switch', 3.2, 7.6, 1.5, 'РАБОЧАЯ ЛАМПА', { group: 'work' }),
    T('loftlamp', 'switch', 12.0, 1.2, 3.2, 'ЛАМПА НА АНТРЕСОЛИ', { group: 'loft' }),
    T('car', 'car', 6.0, 6.5, 1.0, 'МАШИНА · ПОСИГНАЛИТЬ', { reach: 2.0, radius: 1.6 }),
    T('radio', 'radio', 11.0, 1.4, 2.05, 'МАГНИТОЛА', { reach: 1.8 }),
    T('rolldoor', 'rolldoor', 5.9, 11.9, 1.4, 'ВОРОТА', { reach: 2.0, radius: 1.6 }),
    T('door-home', 'exit', 14.9, 10.5, 1.2, 'ДВЕРЬ · В КВАРТИРУ', { to: 'home' }),
    T('barrel', 'barrel', 12.6, 10.6, 0.6, 'БОЧКА', { reach: 1.4 }),
    // 17.4 · the AR headset, on the workbench (Витя's old one). Gone once taken.
    T('headset', 'headset', 1.62, 6.35, 1.1, 'AR-ШЛЕМ · ВЗЯТЬ', { reach: 1.8 }),
    // JUMP KILL · Лабиринт: the arcade cabinet in the corner (labyrinth-cabinet.js).
    T('arcade', 'arcade', 1.6, 11.35, 1.3, 'АВТОМАТ JUMP KILL · НЫРНУТЬ В ЛАБИРИНТ', { program: 'blackice', reach: 1.9 }),
  ]),
  home: freeze([
    T('pc', 'pc', 5.6, 1.35, 1.35, 'КОМПЬЮТЕР · НЫРНУТЬ', { program: 'menu', reach: 1.9 }),
    T('sw-bed', 'switch', 6.93, 6.2, 1.5, 'СВЕТ · КОМНАТА', { group: 'bedroom' }),
    T('sw-living', 'switch', 13.93, 6.2, 1.5, 'СВЕТ · ГОСТИНАЯ', { group: 'living' }),
    T('sw-kitchen', 'switch', 8.5, 8.07, 1.5, 'СВЕТ · КУХНЯ', { group: 'kitchen' }),
    T('sw-bath', 'switch', 1.4, 6.93, 1.5, 'СВЕТ · ВАННАЯ', { group: 'bath' }),
    T('door-bath', 'door', 2.5, 7.5, 1.2, 'ДВЕРЬ', { cell: [2, 7] }),
    T('tv', 'tv', 9.5, 0.95, 1.6, 'ТЕЛЕВИЗОР', { reach: 2.6, radius: 1.1 }),
    T('fridge', 'fridge', 12.95, 8.5, 1.3, 'ХОЛОДИЛЬНИК', { reach: 1.6 }),
    T('toilet', 'toilet', 1.5, 8.35, 0.7, 'УНИТАЗ · СМЫТЬ', { reach: 1.4 }),
    T('mirror', 'mirror', 1.0, 9.5, 1.6, 'ЗЕРКАЛО', { reach: 1.5 }),
    T('window', 'window', 2.95, 0.95, 1.6, 'ОКНО', { reach: 1.6, radius: 0.9 }),
    T('cat', 'cat', 10.4, 5.45, 0.9, 'КОТ', { reach: 1.5 }),
    T('door-garage', 'exit', 13.95, 9.5, 1.2, 'ДВЕРЬ · В ГАРАЖ', { to: 'garage' }),
    // 17.4 · the code lock's keypad by the front door (a broken thing for the headset).
    T('lock', 'lock', 13.93, 10.35, 1.4, 'КОДОВАЯ ПАНЕЛЬ ЗАМКА', { reach: 1.5 }),
  ]),
});

// ----------------------------------------------------------- world state
export function createWorldState(level = 'garage') {
  return {
    level,
    lights: { ...START_LIGHTS[level] },
    doors: { rolldoor: false, 'door-bath': true },
    tv: false, fridge: false, radio: false,
    flushes: 0, honks: 0, mirrorLooks: 0, catPets: 0,
    lastProgram: null, alarm: null, // { ok, at }
  };
}

// Pressing E on a thing. Pure: returns the new state and what the world
// should do about it -- sound, a line someone says, a dive into a program,
// a trip through a door.
export function interact(state, thingId, now = 0) {
  const s = { ...state, lights: { ...state.lights }, doors: { ...state.doors } };
  const thing = (THINGS[s.level] ?? []).find((t) => t.id === thingId);
  if (!thing) return { state: s, sound: null, say: null };
  switch (thing.kind) {
    case 'switch': {
      const on = !(s.lights[thing.group] !== false);
      s.lights[thing.group] = on;
      return { state: s, sound: 'switch', say: on ? null : 'dark', relight: true };
    }
    case 'door': case 'rolldoor': {
      s.doors[thing.id] = !s.doors[thing.id];
      return { state: s, sound: thing.kind === 'rolldoor' ? 'rolldoor' : 'door', say: thing.kind === 'rolldoor' && s.doors[thing.id] ? 'rain' : null };
    }
    case 'tv': s.tv = !s.tv; return { state: s, sound: s.tv ? 'tv' : 'switch', say: s.tv ? 'tv' : null };
    case 'fridge': s.fridge = !s.fridge; return { state: s, sound: 'fridge', say: s.fridge ? 'fridge' : null };
    case 'radio': s.radio = !s.radio; return { state: s, sound: s.radio ? 'tv' : 'switch', say: s.radio ? 'radio-on' : null };
    case 'toilet': s.flushes += 1; return { state: s, sound: 'flush', say: s.flushes >= 3 ? 'flush-spam' : 'flush' };
    case 'mirror': s.mirrorLooks += 1; return { state: s, sound: null, say: 'mirror' };
    case 'cat': s.catPets += 1; return { state: s, sound: 'meow', say: 'cat' };
    case 'window': return { state: s, sound: null, say: 'window' };
    case 'barrel': return { state: s, sound: 'clank', say: 'barrel' };
    case 'headset': return { state: s, sound: 'pickup', say: 'headset-pick', pickup: 'headset' };
    case 'lock': return { state: s, sound: 'ui-click', say: 'lock-panel' };
    case 'car': s.honks += 1; return { state: s, sound: 'honk', say: s.honks >= 3 ? 'honk-spam' : 'honk' };
    case 'exit': return { state: s, sound: 'door', go: thing.to };
    case 'laptop': case 'pc': case 'arcade': s.lastProgram = thing.program; return { state: s, sound: 'boot', dive: thing.program };
    default: return { state: s, sound: null, say: null };
  }
}

// The result of a night in the gateway program, seen from the garage: the
// car's alarm goes off on a fail, it chirps twice on a held night.
export function afterProgram(state, result, now = 0) {
  if (!result) return { ...state };
  return { ...state, alarm: { ok: Boolean(result.ok), at: now } };
}
export const ALARM_MS = 6000;
export function alarmActive(state, now) {
  return Boolean(state.alarm && now - state.alarm.at < (state.alarm.ok ? 1600 : ALARM_MS));
}

// Which thing is under the crosshair: in reach, in front, nearest to the
// line of sight. yaw: 0 looks to -z. Returns the thing or null.
export function pickThing(level, { x, z, y = 0 }, yaw, things = THINGS[level] ?? []) {
  const fx = Math.sin(yaw), fz = -Math.cos(yaw);
  let best = null; let bestScore = Infinity;
  for (const t of things) {
    const dx = t.x - x, dz = t.z - z;
    const dist = Math.hypot(dx, dz);
    const r = t.radius ?? 0.35;
    if (dist - r > t.reach) continue;
    if (Math.abs(t.y - (y + 1.6)) > 2.4) continue;
    const along = dx * fx + dz * fz;
    if (along < -r * 0.5) continue;
    const side = Math.abs(dx * fz - dz * fx);
    const ang = Math.atan2(Math.max(0, side - r), Math.max(0.05, along));
    if (ang > 0.42) continue;
    const score = ang * 2 + dist * 0.2;
    if (score < bestScore) { bestScore = score; best = t; }
  }
  return best;
}

// What kind of surface you landed on, for the comments.
export function surfaceKind(cell) {
  if (!cell) return 'floor';
  if (cell.kind === 'car') return cell.part === 'r' ? 'car-roof' : 'car';
  if (cell.kind === 'bed') return 'bed';
  if (['rack', 'loft', 'sofa', 'counter', 'desk', 'tyres', 'bath', 'bench'].includes(cell.kind)) return cell.kind;
  return 'floor';
}

// The surface the body stands on: the highest touched cell at the feet'
// height (standing on the hood's edge still counts as the hood).
export function surfaceUnder(map, x, z, y, r = 0.28) {
  let best = cellAt(map, x, z);
  for (const [dx, dz] of [[r, 0], [-r, 0], [0, r], [0, -r], [0, 0]]) {
    const c = cellAt(map, x + dx, z + dz);
    if (c && !c.solid && Math.abs(c.floor - y) < 0.05 && (!best || best.floor < c.floor || Math.abs(best.floor - y) >= 0.05)) best = c;
  }
  return best;
}

// Door cells' ceilings follow the doors' state (animated in fp-world.js).
export function doorTarget(level, cell, doors) {
  if (cell.door === 'roll') return doors.rolldoor ? ROLL_DOOR_OPEN : 0;
  if (cell.door === 'swing') return doors['door-bath'] ? HOME_BASE + DOOR_OPEN_H : HOME_BASE;
  return cell.ceil;
}

export function wrapYaw(a) { let v = a; while (v > Math.PI) v -= TAU; while (v < -Math.PI) v += TAU; return v; }
export { cellAt };
