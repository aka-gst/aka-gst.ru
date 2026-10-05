// 17.3 · ЭПОХИ ДВИЖКА. Сергей (PLANS/3D-SHOOTER-EPOCHS-BRANCH.md): «от совсем
// плоских текстур … эпоха Вольфенштайна, потом Дума … Duke Nukem 3D, Quake,
// Unreal, Quake 2, Half-Life» -- and 02.10: «в зависимости от прокачки движка
// и прокачки вообще — мир будет всё ближе к халф-лайфу через все промежуточные
// этапы». One renderer (raycaster.js), six setting tiers. The tier comes from
// the player's real progress (learned Python moves, campus rank, held
// profession days) plus engine upgrades bought on the home PC (ДВИЖОК.EXE).
//
// Pure: no DOM. tools/engine-eras.test.mjs pins the ladder.

import { ERA_END, engineDeeds, clampLevel, eraOfLevel, ladderStatus } from './engine-ladder.js';

const freeze = Object.freeze;

// rows: the frame's height in pixels (width follows the window's aspect).
// tex: texture detail divisor (2 = half resolution, blocky). levels: colours
// per channel after quantising (0 = true colour). bands: light steps (0 =
// smooth). pitch: how far you can look up/down (fraction of 75°). fog: [r,g,b,
// density] blended by depth, or null. filter: bilinear upscale. bloom: glow.
export const ERAS = freeze([
  freeze({
    id: 'wolf', n: 0, year: 1992, name: 'WOLFENSTEIN 3D', short: 'WOLF3D',
    rows: 120, tex: 2, levels: 6, bands: 6, flatLight: 1.02, flats: true, pitch: 0, jump: 1, bob: 0, fov: 72,
    mirrors: false, smoothLight: false, colorLights: 0, fog: null, filter: false, bloom: 0, vignette: 0, grain: 0, ao: 0, decals: false,
    hud: 'wolf', screen: 'crt-green',
    learn: 'Стены — это полоски. Один луч на колонку экрана, высота полоски = 1 / расстояние. Пол и потолок — просто заливка, света нет.',
  }),
  freeze({
    id: 'doom', n: 1, year: 1993, name: 'DOOM', short: 'DOOM',
    rows: 200, tex: 1, levels: 9, bands: 16, flatLight: 0, flats: false, pitch: 0.25, jump: 1, bob: 1.6, fov: 78,
    mirrors: false, smoothLight: false, colorLights: 0.15, fog: null, filter: false, bloom: 0, vignette: 0, grain: 0, ao: 0, decals: false,
    hud: 'doom', screen: 'crt',
    learn: 'Сектора: у каждой клетки своя высота пола и потолка. Текстурный пол, свет полосами «темнее с расстоянием».',
  }),
  freeze({
    id: 'duke', n: 2, year: 1996, name: 'DUKE NUKEM 3D', short: 'BUILD',
    rows: 240, tex: 1, levels: 16, bands: 24, flatLight: 0, flats: false, pitch: 1, jump: 1, bob: 1.4, fov: 80,
    mirrors: true, smoothLight: false, colorLights: 0.5, fog: null, filter: false, bloom: 0, vignette: 0, grain: 0, ao: 0, decals: false,
    hud: 'duke', screen: 'crt',
    learn: 'Build: смотреть вверх-вниз (сдвиг горизонта), зеркала (луч отражается от стекла), выключатели, двери, всё можно трогать.',
  }),
  freeze({
    id: 'quake', n: 3, year: 1996, name: 'QUAKE', short: 'QUAKE',
    rows: 288, tex: 1, levels: 0, bands: 0, flatLight: 0, flats: false, pitch: 1, jump: 1, bob: 1.1, fov: 84,
    mirrors: true, smoothLight: true, colorLights: 0.55, fog: [34, 24, 14, 0.045], filter: false, bloom: 0, vignette: 0.25, grain: 0, ao: 0.25, decals: false,
    hud: 'quake', screen: 'crt',
    learn: 'Карта освещения сглажена (билинейно), свет без ступенек, туман. Мир читается как настоящий объём.',
  }),
  freeze({
    id: 'unreal', n: 4, year: 1998, name: 'QUAKE II / UNREAL', short: 'UNREAL',
    rows: 336, tex: 1, levels: 0, bands: 0, flatLight: 0, flats: false, pitch: 1, jump: 1, bob: 0.9, fov: 86,
    mirrors: true, smoothLight: true, colorLights: 1, fog: [22, 26, 48, 0.032], filter: true, bloom: 0.22, vignette: 0.3, grain: 0, ao: 0.35, decals: false,
    hud: 'unreal', screen: 'lcd',
    learn: 'Цветной свет, сглаживание текстур (bilinear filtering), свечение ламп. Эпоха 3D-ускорителей.',
  }),
  freeze({
    id: 'hl', n: 5, year: 1998, name: 'HALF-LIFE', short: 'GOLDSRC',
    rows: 384, tex: 1, levels: 0, bands: 0, flatLight: 0, flats: false, pitch: 1, jump: 1, bob: 0.7, fov: 90,
    mirrors: true, smoothLight: true, colorLights: 1, fog: [26, 30, 36, 0.024], filter: true, bloom: 0.3, vignette: 0.38, grain: 0.05, ao: 0.6, decals: true,
    hud: 'hl', screen: 'lcd',
    learn: 'Детали: затенение по углам (AO), грязь и пятна (decals), цветной туман, плёночное зерно, сюжет без катсцен.',
  }),
]);

export const ERA_COUNT = ERAS.length;
// 17.4: the eras are milestones of the feature ladder (engine-ladder.js).
// "Points" are now steps: every completed thing turns on one engine
// feature; an era is reached when all of its features are on.
export const ERA_POINTS = freeze(ERA_END.slice(0, ERAS.length));
// Engine upgrades on the home PC: price of the next one, in game rubles.
// Each bought upgrade turns on one more feature.
export const UPGRADE_PRICES = freeze([150, 250, 400, 600, 850, 1150, 1500, 1900, 2400, 3000]);
export const UPGRADE_POINTS = 1;

export function clampEra(n) {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.max(0, Math.min(ERA_COUNT - 1, v)) : 0;
}

// What the player has achieved, flattened from the game's real state:
// learned Python moves, shifts held, machines fixed, campus rank, profession
// days, engine upgrades bought (engine-ladder.js engineDeeds).
export function engineProgress(args = {}) {
  const d = engineDeeds(args);
  return { ...d, rankIndex: d.rank, realmDays: d.days };
}

// One step per completed thing.
export function enginePoints(p = {}) {
  if (Number.isFinite(p.total)) return p.total;
  return engineDeeds({ ...p, learning: p.learning ?? {}, rankIndex: p.rankIndex ?? p.rank ?? 0, realmDays: p.realmDays ?? p.days ?? 0, fixes: p.fixes ?? 0, chapter: (p.shifts ?? 0) + 1 }).total + (p.moves ?? 0);
}
export function levelFromProgress(p = {}) { return clampLevel(enginePoints(p)); }

export function eraFromPoints(points = 0) { return Math.min(ERA_COUNT - 1, eraOfLevel(clampLevel(points))); }

export function eraFromProgress(p = {}) { return eraFromPoints(enginePoints(p)); }

// Where the bar stands: current level and era, how many steps to the next era.
export function engineStatus(p = {}) {
  const points = enginePoints(p);
  const st = ladderStatus({ total: points });
  const era = Math.min(ERA_COUNT - 1, st.era);
  return {
    era, level: st.level, points: st.level, feature: st.feature.id, nextFeature: st.next?.id ?? null,
    next: st.nextEra, toNext: st.toNextEra,
    progress: st.nextEra === null ? 1 : (st.level - ERA_END[st.era]) / (ERA_END[st.nextEra] - ERA_END[st.era]),
    upgradePrice: upgradePrice(p.upgrades ?? 0),
  };
}

export function upgradePrice(bought = 0) {
  return bought < UPGRADE_PRICES.length ? UPGRADE_PRICES[bought] : null;
}

// Buying an engine upgrade: pure, returns what changed (or why not).
export function buyUpgrade({ upgrades = 0, wallet = 0 } = {}) {
  const price = upgradePrice(upgrades);
  if (price === null) return { ok: false, reason: 'max', upgrades, wallet };
  if (wallet < price) return { ok: false, reason: 'money', price, upgrades, wallet };
  return { ok: true, price, upgrades: upgrades + 1, wallet: wallet - price };
}

// ?era=N (0..5) or a name (?era=duke) forces an era for debugging/screens.
export function eraFromQuery(search = '') {
  const params = new URLSearchParams(String(search).replace(/^\?/, ''));
  if (!params.has('era')) return null;
  const raw = params.get('era').trim().toLowerCase();
  const byId = ERAS.findIndex((e) => e.id === raw || e.short.toLowerCase() === raw);
  if (byId >= 0) return byId;
  if (!/^\d+$/.test(raw)) return null;
  return clampEra(raw);
}

// The "ENGINE UPGRADE" moment fires once per era: when the era the player
// now has is above the one they have already seen.
export function upgradeMoment(seenEra, era) {
  if (!(era > (seenEra ?? -1))) return null;
  const from = seenEra === null || seenEra === undefined || seenEra < 0 ? null : ERAS[clampEra(seenEra)];
  const to = ERAS[clampEra(era)];
  return { from: from?.name ?? null, to: to.name, era: to.n, year: to.year, learn: to.learn };
}

export function eraSettings(n) { return ERAS[clampEra(n)]; }

// Frame size for an era at a given window aspect; `scale` < 1 is the dynamic
// resolution step when frames get slow.
export function frameSize(era, aspect = 16 / 9, scale = 1) {
  const e = eraSettings(era);
  const rows = Math.max(90, Math.round(e.rows * scale / 2) * 2);
  const a = aspect > 0 && Number.isFinite(aspect) ? aspect : 16 / 9;
  const cols = Math.max(160, Math.min(Math.round(rows * 2.4), Math.round(rows * a)));
  return { w: cols, h: rows };
}

// Colour quantising (VGA-ish palettes in the early eras), in place on an ABGR
// buffer. levels per channel; ordered dither so gradients don't band flat.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export function quantize(buf, w, h, levels, dither = levels <= 6 ? 0 : levels <= 9 ? 0.35 : 0.2) {
  if (!levels || levels < 2) return buf;
  const step = 255 / (levels - 1);
  for (let y = 0, i = 0; y < h; y++) {
    for (let x = 0; x < w; x++, i++) {
      const c = buf[i];
      const d = (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * step * dither;
      let r = Math.round(((c & 255) + d) / step) * step, g = Math.round((((c >>> 8) & 255) + d) / step) * step, b = Math.round((((c >>> 16) & 255) + d) / step) * step;
      r = r < 0 ? 0 : r > 255 ? 255 : r; g = g < 0 ? 0 : g > 255 ? 255 : g; b = b < 0 ? 0 : b > 255 ? 255 : b;
      buf[i] = (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
    }
  }
  return buf;
}

// Depth fog toward a colour (Quake on), vignette and film grain (late eras).
export function postFx(buf, depth, w, h, era, time = 0) {
  const e = eraSettings(era);
  const fog = e.fog, vig = e.vignette, grain = e.grain;
  if (!fog && !vig && !grain) return buf;
  const [fr, fg, fb, dens] = fog ?? [0, 0, 0, 0];
  const cx = w / 2, cy = h / 2, inv = 1 / (cx * cx + cy * cy);
  let seed = (time * 977) | 0;
  for (let y = 0, i = 0; y < h; y++) {
    for (let x = 0; x < w; x++, i++) {
      const c = buf[i];
      let r = c & 255, g = (c >>> 8) & 255, b = (c >>> 16) & 255;
      if (dens) {
        const d = depth[i] > 60 ? 60 : depth[i];
        const f = 1 - Math.exp(-d * dens);
        r += (fr - r) * f; g += (fg - g) * f; b += (fb - b) * f;
      }
      if (vig) {
        const dx = x - cx, dy = y - cy;
        const k = 1 - vig * (dx * dx + dy * dy) * inv;
        r *= k; g *= k; b *= k;
      }
      if (grain) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        const n = ((seed >> 16) / 32768 - 0.5) * 255 * grain;
        r += n; g += n; b += n;
      }
      r = r < 0 ? 0 : r > 255 ? 255 : r; g = g < 0 ? 0 : g > 255 ? 255 : g; b = b < 0 ? 0 : b > 255 ? 255 : b;
      buf[i] = (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
    }
  }
  return buf;
}

// Lamp colours per era: early engines had one grey light, colour arrives
// with Duke's palette tricks and is fully there by Quake II / Unreal.
export function eraLampColor(color, era) {
  const k = eraSettings(era).colorLights;
  const l = color[0] * 0.3 + color[1] * 0.59 + color[2] * 0.11;
  return [l + (color[0] - l) * k, l + (color[1] - l) * k, l + (color[2] - l) * k];
}
