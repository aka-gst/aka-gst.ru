// The arcade cabinet in the garage corner: the way into JUMP KILL · Лабиринт.
// A billboard sprite for the raycaster (same format as fp-textures.js sprites:
// {w, h, data: Uint32Array, ppm}); its screen flickers with a tiny arena —
// a corridor, a bot, a tracer — and shows how many levels are cleared.
import { rgb } from './raycaster.js';

// x/z: the cabinet's front centre (the picture). On the polygon rungs it is a
// box (props-meshes panelMesh) reaching `depth` back to the wall at x = 1.
export const CABINET = Object.freeze({ x: 1.6, z: 11.35, y: 0, depth: 0.55, level: 'garage' });
// Collision: a circle the body can't walk into (fp-body.js openAt circles),
// centred inside the box; top = the cabinet's height (feet above it pass over).
export const CABINET_COLLIDER = Object.freeze({ x: 1.32, z: 11.35, r: 0.42, top: 1.9 });
export const cabinetColliders = (level) => (level === CABINET.level ? [CABINET_COLLIDER] : []);

export function paintArcade(time = 0, cleared = 0, total = 13) {
  const w = 18, h = 38, data = new Uint32Array(w * h);
  const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < w && y < h) data[y * w + x] = rgb(c[0] | 0, c[1] | 0, c[2] | 0); };
  const body = [34, 18, 22], side = [70, 26, 30], trim = [255, 130, 70];
  for (let y = 0; y < h; y++) for (let x = 1; x < w - 1; x++) {
    // Silhouette: marquee on top, screen recess, control deck sticking out, base.
    const inset = y >= 22 && y < 26 ? 0 : y < 4 ? 1 : 2;
    if (x < inset || x > w - 1 - inset) continue;
    set(x, y, x === inset || x === w - 1 - inset ? side : body);
  }
  // Marquee: «JK» in lit letters on red.
  for (let y = 0; y < 6; y++) for (let x = 2; x < w - 2; x++) set(x, y, [200, 40, 50]);
  const J = ['111', '001', '001', '101', '010'], K = ['101', '110', '100', '110', '101'];
  for (const [glyph, ox] of [[J, 5], [K, 10]]) glyph.forEach((row, j) => [...row].forEach((b, i) => { if (b === '1') set(ox + i, j + 0.5 | 0, [255, 240, 200]); }));
  // Screen: a corridor in perspective, a bot, a tracer, flicker.
  const t = time;
  for (let y = 6; y < 20; y++) for (let x = 3; x < w - 3; x++) {
    const cx = x - w / 2 + 0.5, cy = y - 13;
    const wall = Math.abs(cx) > 2 + Math.abs(cy) * 0.6;
    const k = 0.75 + 0.25 * Math.sin(t * 9 + y);
    let c = wall ? [40 * k, 20 * k, 60 * k] : (cy > 0 ? [60 * k, 30 * k, 26 * k] : [10, 6, 20]);
    if (y === 6 || y === 19 || x === 3 || x === w - 4) c = [20, 10, 14];
    set(x, y, c);
  }
  const bx = Math.round(w / 2 + Math.sin(t * 1.7) * 2);
  for (const [dx, dy] of [[0, 0], [0, 1], [0, 2], [-1, 1], [1, 1], [0, -1]]) set(bx + dx, 12 + dy, [255, 120, 60]);
  if (Math.floor(t * 3) % 2 === 0) for (let i = 0; i < 4; i++) set(w / 2 - 1 + i, 17 - i, [120, 255, 255]);
  // Progress pips under the screen: cleared levels lit green.
  for (let i = 0; i < Math.min(total, 13); i++) set(2 + i, 21, i < cleared ? [90, 255, 120] : [60, 40, 40]);
  // Control deck: stick and two buttons, trim strip.
  for (let x = 0; x < w; x++) set(x, 22, trim);
  set(5, 23, [20, 20, 20]); set(5, 24, [230, 30, 30]); set(11, 24, [255, 210, 40]); set(13, 24, [60, 160, 255]);
  // Coin slot, glowing.
  set(8, 30, [255, 180, 60]); set(9, 30, [255, 180, 60]);
  return { w, h, data, ppm: 20 };
}

// fp-world.js draws the cabinet with arcadeSprite(now); main.js tells it the
// progress. Cached per 200 ms so the raycaster gets the same image object.
let progress = { cleared: 0, total: 13 }; let cache = null; let cacheKey = '';
export function setCabinetProgress(cleared = 0, total = 13) { progress = { cleared: Math.max(0, cleared | 0), total: Math.max(1, total | 0) }; cacheKey = ''; }
export function arcadeSprite(now = 0) {
  const key = `${Math.floor(now / 200)}|${progress.cleared}`;
  if (key !== cacheKey) { cacheKey = key; cache = paintArcade(now / 1000, progress.cleared, progress.total); }
  return cache;
}
