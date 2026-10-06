/*
 * ТЕХНОМАГИЯ — вид заклинаний в изометрии (отзыв Сергея 04.10, п.17:
 * «гораздо больше эффектов заклинаний — сейчас непонятно, что кастуешь»).
 *
 * До 05.10 любой снаряд был одним и тем же светящимся шаром с хвостом из
 * шести искр — отличался только цвет, а цвета у огня, жара, лавы, вулкана
 * и пепла — пять оттенков оранжевого. Теперь вещество читается ФОРМОЙ и
 * ДВИЖЕНИЕМ (навык igry §10: исход различают формой, а не числом и не
 * оттенком):
 *
 *   ember   огонь, жар, лава…  угли летят вверх, жёлтое у ядра → цвет к хвосту
 *   drop    вода, гроза        капли падают дугой под хвостом
 *   swirl   ветер              спираль вокруг пути
 *   rock    земля, магнит      тяжёлые комья кувыркаются, пыль
 *   magma   лава, вулкан       горящие тяжёлые капли каплют вниз, корка темнеет
 *   zigzag  молния, разряд     ломаная, перескакивает 30 раз в секунду
 *   flake   стужа, метель      хлопья медленно кружат
 *   puff    пар, туман, гейзер клубы растут и бледнеют
 *   blob    грязь, зыбун       тёмные шлепки падают
 *   grain   песок              мелкая сечка веером
 *   ring    магнит (тяга)      кольцо сжимается к снаряду
 *
 * Форма — по чертам вещества (magic.js, traits), первая по порядку ORDER;
 * вторая черта добавляет половину частиц своей формы (жар = угли + вихрь,
 * лава = угли + комья). У ядра снаряда своя фигура (scene.js, spellCore).
 *
 * Чистый модуль: частицы — числа [x, y, z, r, g, b, a, размер] в клетках,
 * как у engine.js (drawParticles). glow — сложением (светятся), soft —
 * обычным смешиванием (тёмное: комья, грязь, пар — сложением их не видно).
 * Различимость десяти частых заклинаний меряется tests/vid-zaklinaniy.mjs.
 */

import { allSubstances, substanceOf, FORMS, SIGNATURES } from '../magic.js';

export const SPELL_LOOK = { on: true };

const ORDER = ['steam', 'freeze', 'mire', 'shock', 'burn', 'wet', 'shred', 'pull', 'crush', 'gust'];
const SHAPE_OF = { steam: 'puff', freeze: 'flake', mire: 'blob', shock: 'zigzag', burn: 'ember', wet: 'drop', shred: 'grain', pull: 'ring', crush: 'rock', gust: 'swirl' };
const TINT = {
  ember: [1, 0.86, 0.38], drop: [0.62, 0.86, 1], swirl: [0.82, 1, 0.86], rock: [0.4, 0.31, 0.22],
  zigzag: [1, 1, 0.78], flake: [0.93, 0.98, 1], puff: [0.86, 0.89, 0.93], blob: [0.28, 0.2, 0.11],
  grain: [0.86, 0.73, 0.46], ring: [0.86, 0.86, 0.42], magma: [1, 0.78, 0.3], spark: [1, 1, 1],
};
/* Тёмное — обычным смешиванием: сложением тёмно-бурый ком невидим. */
const SOFT = new Set(['rock', 'blob', 'puff']);
export const SHAPES = Object.keys(TINT);

const hexRgb = (hex) => {
  const h = String(hex || '#ffffff').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const hash = (a, b) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

const looks = new Map();
export function spellLook(substance) {
  if (!substance) return null;
  const key = substance.id || substance.colour;
  if (looks.has(key)) return looks.get(key);
  const traits = substance.traits || {};
  let shapes = SPELL_LOOK.on ? ORDER.filter((t) => traits[t]).map((t) => SHAPE_OF[t]) : [];
  /* Жжёт и давит — расплав: не угли вверх, а тяжёлые капли вниз. Без
     этого лава от огня отличалась половиной хвоста (замер 0.18). */
  if (SPELL_LOOK.on && traits.burn && traits.crush) shapes = ['magma', ...shapes.filter((x) => x !== 'ember' && x !== 'rock')];
  const primary = shapes[0] || 'spark';
  const secondary = shapes.find((s) => s !== primary) || null;
  const look = { id: substance.id, name: substance.name, colour: hexRgb(substance.colour), primary, secondary };
  if (SPELL_LOOK.on) looks.set(key, look);
  return look;
}

/* Снаряды несут вещество; вспышки форм (конус, луч, круг) — только цвет.
   Цвета веществ различны (magic.js), поэтому цвет → вещество однозначен. */
let byColour = null;
export function lookByColour(hex) {
  if (!byColour) {
    byColour = new Map();
    for (const s of allSubstances()) if (!byColour.has(s.colour.toLowerCase())) byColour.set(s.colour.toLowerCase(), s);
  }
  const s = byColour.get(String(hex || '').toLowerCase());
  return s ? spellLook(s) : null;
}

/* ---------------------------------------------------------
   ХВОСТ СНАРЯДА
   ---------------------------------------------------------
   (x, y, z) — ядро в клетках, (dx, dz) — куда летит (единичный),
   time — часы отрисовки, seed — свой у снаряда (кадры замера совпадают).
   --------------------------------------------------------- */

function trail(shape, n, c, out) {
  const { x, y, z, dx, dz, time, seed, colour } = c;
  const px = -dz, pz = dx;
  const tint = TINT[shape];
  const put = (back, side, up, col, a, size) => {
    const list = SOFT.has(shape) ? out.soft : out.glow;
    list.push(x - dx * back + px * side, y + up, z - dz * back + pz * side, col[0], col[1], col[2], a, size);
  };
  for (let k = 1; k <= n; k += 1) {
    const f = k / (n + 1);
    const h1 = hash(seed + k, 3.1), h2 = hash(k, seed + 7.7);
    switch (shape) {
      case 'ember': {
        const fl = 0.6 + 0.4 * Math.sin(time * 23 + k * 1.7 + seed);
        put(k * 0.09, (h1 - 0.5) * 0.12, k * 0.04 + 0.03 * fl, mix(tint, colour, f), 0.95 * (1 - f) * fl, 0.12 * (1 - f * 0.6));
        break;
      }
      case 'drop':
        put(k * 0.1, (k % 2 ? 1 : -1) * 0.06, -(k * 0.05) * (k * 0.05) * 9, mix(tint, colour, f * 0.6), 0.85 * (1 - f * 0.5), 0.075);
        break;
      case 'swirl': {
        const a = time * 14 + k * 0.95 + seed;
        put(k * 0.065, Math.cos(a) * 0.2, Math.sin(a) * 0.2, mix(tint, colour, 0.3), 0.8 * (1 - f), 0.055);
        break;
      }
      case 'rock':
        put(k * 0.16, (h1 - 0.5) * 0.18, -k * 0.035 + (h2 - 0.5) * 0.06, mix(tint, colour, 0.25), 0.95, 0.13 - k * 0.012);
        break;
      case 'zigzag': {
        const jag = (hash(k, Math.floor(time * 30) + seed) - 0.5) * 0.26;
        put(k * 0.07, jag, (hash(k + 9, Math.floor(time * 30)) - 0.5) * 0.16, k % 2 ? tint : colour, 1, 0.05);
        break;
      }
      case 'flake': {
        const a = time * 3 + k * 1.3 + seed;
        const r = 0.1 + k * 0.03;
        put(k * 0.08, Math.cos(a) * r, Math.sin(a) * r, tint, 0.9 * (1 - f * 0.7), 0.07);
        break;
      }
      case 'puff':
        put(k * 0.12, (h1 - 0.5) * 0.1, k * 0.02, mix(tint, colour, 0.3), 0.42 * (1 - f), 0.14 + k * 0.05);
        break;
      case 'blob':
        put(k * 0.1, (h1 - 0.5) * 0.1, -(k * 0.05) * (k * 0.05) * 8, mix(tint, colour, 0.3), 0.92, 0.1);
        break;
      case 'magma': {
        /* Капля расплава: чем дальше от ядра, тем ниже и темнее. */
        const drop = (k * 0.06) * (k * 0.06) * 10;
        const glowing = mix(tint, colour, f);
        put(k * 0.075, (h1 - 0.5) * 0.08, -drop, k > n - 2 ? [0.25, 0.08, 0.03] : glowing, 0.95, 0.105 - k * 0.006);
        break;
      }
      case 'grain': {
        const spread = k * 0.022;
        put(k * 0.05, (h1 - 0.5) * 2 * spread, (h2 - 0.5) * 2 * spread * 0.6, mix(tint, colour, 0.3), 0.85 * (1 - f * 0.6), 0.035);
        break;
      }
      case 'ring': {
        const a = (k / n) * Math.PI * 2 + time * 4;
        const r = 0.3 * (1 - ((time * 2 + seed) % 1));
        put(0.05, Math.cos(a) * r, Math.sin(a) * r, mix(tint, colour, 0.4), 0.9, 0.05);
        break;
      }
      default: {
        /* Прежний хвост (до 05.10): шесть искр по прямой. */
        put(k * 0.12, 0, 0, colour, 0.75 * (1 - k / 7), 0.11 * (1 - k / 9));
      }
    }
  }
}

const COUNT = { magma: 8, ember: 9, drop: 7, swirl: 12, rock: 4, zigzag: 9, flake: 8, puff: 5, blob: 5, grain: 14, ring: 10, spark: 6 };

export function trailParticles(look, x, y, z, dx, dz, time, seed = 0) {
  const out = { glow: [], soft: [] };
  if (!look) return out;
  const c = { x, y, z, dx, dz, time, seed, colour: look.colour };
  trail(look.primary, COUNT[look.primary], c, out);
  if (look.secondary) trail(look.secondary, Math.ceil(COUNT[look.secondary] / 2), c, out);
  return out;
}

/* ---------------------------------------------------------
   РАЗЛЁТ НА МЕСТЕ (попадание, конус, луч, круг)
   ---------------------------------------------------------
   t — доля прожитого (0 → 1). Форма та же, что у хвоста: угли вверх,
   капли вниз брызгами, комья в стороны и на пол, ломаная трещит.
   --------------------------------------------------------- */

function burst(shape, n, c, out) {
  const { x, y, z, t, seed, colour, spread = 1 } = c;
  const tint = TINT[shape];
  const list = SOFT.has(shape) ? out.soft : out.glow;
  const fade = 1 - t;
  for (let k = 0; k < n; k += 1) {
    let a = (k / n) * Math.PI * 2 + hash(seed, k) * 0.8;
    const h = hash(k, seed + 1.3);
    let r = (0.15 + 0.45 * t) * spread * (0.6 + 0.4 * h), up = 0, size = 0.08, col = mix(tint, colour, 0.4), alpha = fade;
    switch (shape) {
      case 'ember': up = 0.1 + t * (0.6 + 0.5 * h); r *= 0.6; size = 0.1 * fade + 0.03; break;
      case 'drop': up = t * 0.5 - t * t * 1.1; size = 0.07; break;
      case 'swirl': a += t * 6; r = (0.2 + 0.3 * t) * spread; up = 0.1 + 0.4 * t; size = 0.05; alpha = fade * 0.8; break;
      case 'rock': up = t * 0.35 - t * t * 0.9; size = 0.12; alpha = 0.95 * Math.min(1, fade * 2); break;
      case 'zigzag': r = spread * (0.1 + 0.5 * hash(k, Math.floor(t * 12) + seed)); up = (hash(k + 3, Math.floor(t * 12)) - 0.3) * 0.4; size = 0.05; col = k % 2 ? tint : colour; break;
      case 'flake': up = 0.15 + 0.2 * Math.sin(a * 3 + t * 4); r = (0.3 + 0.2 * t) * spread; size = 0.065; col = tint; break;
      case 'puff': r = (0.1 + 0.3 * t) * spread; up = 0.2 + 0.4 * t; size = 0.18 + 0.3 * t; alpha = 0.4 * fade; break;
      case 'blob': up = t * 0.25 - t * t * 0.7; size = 0.1; alpha = 0.9 * Math.min(1, fade * 2); break;
      case 'magma': up = t * 0.3 - t * t * 0.9; r *= 0.7; size = 0.1; col = mix(tint, colour, t); break;
      case 'grain': r *= 1.4; up = (h - 0.5) * 0.3; size = 0.035; break;
      case 'ring': r = (0.5 - 0.4 * t) * spread; up = 0.3; size = 0.05; break;
      default: size = 0.06;
    }
    list.push(x + Math.cos(a) * r, y + Math.max(-y + 0.02, up), z + Math.sin(a) * r, col[0], col[1], col[2], alpha, size);
  }
}

export function burstParticles(look, x, y, z, t, seed = 0, spread = 1) {
  const out = { glow: [], soft: [] };
  if (!look) return out;
  const c = { x, y, z, t, seed, colour: look.colour, spread };
  burst(look.primary, COUNT[look.primary] + 2, c, out);
  if (look.secondary) burst(look.secondary, Math.ceil(COUNT[look.secondary] / 2), c, out);
  return out;
}

/* ---------------------------------------------------------
   ИМЯ НАД ГЕРОЕМ
   ---------------------------------------------------------
   Что выпущено — словом над головой 1.2 с: «ЖАР · ВЫДОХ», у именного —
   его имя («БОРОЗДА»), цветом вещества: читается и «что», и «как».
   Берётся из события мира `daemon` (world.js: substance — id вещества,
   form — id формы, signature — id именного), а не из очереди: очередь к
   этому кадру уже пуста.
   --------------------------------------------------------- */

export const CAST_LABEL_TIME = 1.2;
export function castLabel(event) {
  if (!event || event.type !== 'daemon' || !event.substance) return null;
  const substance = substanceOf(String(event.substance).split('+'));
  if (!substance) return null;
  const sig = event.signature ? Object.values(SIGNATURES).find((x) => x.id === event.signature) : null;
  const form = FORMS[event.form] || Object.values(FORMS).find((f) => f.id === event.form);
  const text = sig ? sig.name : form ? `${substance.name} · ${form.name}` : substance.name;
  return { text, colour: substance.colour };
}
