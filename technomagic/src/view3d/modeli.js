/*
 * ТЕХНОМАГИЯ — 3D-модели из библиотеки в изометрии (05.10).
 *
 * Выбор Сергея 03.10 (docs/ЕВГЕНИЙ-АССЕТЫ-ВЫБОР-2026-10-03.md) и
 * персонажи из шортлиста Библиотекаря; сборка файлов — tools/modeli/
 * sobrat.mjs, учёт — assets/ISTOCHNIKI.md. Здесь:
 *
 *   createModelLibrary() — грузит assets/models/*.glb (gltf.js), один раз
 *     на загрузку страницы. Не загрузилась модель (нет файла, битый файл,
 *     нет WebGL-программы для кожи) — console.warn ОДИН раз на модель, и
 *     дальше на её месте рисуется прежняя процедурная фигура: пустоты
 *     вместо стены или героя не бывает никогда.
 *   bakeModel() — неподвижная модель в печь этажа (scene.js, bakeLevel):
 *     вершины в формат движка, со срезом и якорем клетки, как у
 *     процедурных стен; с картинкой — в отдельный буфер на картинку.
 *   Aktyor — персонаж с кожей: клип выбирается по состоянию (стоит, идёт,
 *     бежит, получил удар, колдует, упал), смена клипа — плавная.
 *
 * Ничего не пишет в мир (world.js) и ничего из него не решает.
 */

import { parseGLB, flattenStatic, prepareSkinned, createPose, resetPose, sampleClip, finishPose, nodePoint } from './gltf.js';
import { Node, STRIDE } from './engine.js';

export const MODEL_BASE = 'assets/models/';
/* Шаг вершины модели с картинкой: формат движка + (u, v). */
export const TEX_STRIDE = STRIDE + 2;

/* Что грузится. kind: 'static' — в печь и узлами; 'actor' — с кожей. */
export const MODELI = {
  stena: { kind: 'static' },      /* Kenney retro fantasy wall — стена (выбор Сергея) */
  dver: { kind: 'static' },       /* Quaternius Arch_Door — дверь (выбор Сергея) */
  bochka: { kind: 'static' },     /* Quaternius Barrel — бочка (выбор Сергея) */
  kristall: { kind: 'static' },   /* Quaternius Crystal1 — кристалл (выбор Сергея) */
  fonar: { kind: 'static' },      /* Quaternius Lantern_Wall — светильник (выбор Сергея) */
  truba: { kind: 'static' },      /* Quaternius Column_Pipes — труба (выбор Сергея, упрощена) */
  bashnya: { kind: 'static' },    /* Quaternius WatchTower_FirstAge_Level2 — башня (выбор Сергея) */
  mag: { kind: 'actor' },         /* Wizard — герой (шортлист) */
  soldat: { kind: 'actor' },      /* Soldier_Male — стража */
  rycar: { kind: 'actor' },       /* Knight_Male — щитоносец */
  rabochiy: { kind: 'actor' },    /* Worker_Male — житель */
  gorozhanka: { kind: 'actor' },  /* Casual_Female — жительница */
};

/* Кто кем рисуется. Житель — по чётности номера, чтобы двор не был одним лицом. */
export function actorModel(kind, obj = null) {
  if (kind === 'player') return 'mag';
  if (kind === 'carrier') return 'rycar';
  if (kind === 'civil' || kind === 'hostage') {
    const seed = obj ? Math.floor((obj.homeX ?? obj.x ?? 0) / 32) + Math.floor((obj.homeY ?? obj.y ?? 0) / 32) * 7 : 0;
    return kind === 'civil' && seed % 2 ? 'gorozhanka' : 'rabochiy';
  }
  return 'soldat';
}

/* Один масштаб на всех: рост из модели (солдат 3.1 → 1.03 клетки,
   маг со шляпой 3.95 → 1.3) — тела соразмерны друг другу, как в наборе. */
export const ACTOR_SCALE = 0.33;

/*
 * КРАСКА ПО КЛАССУ (приёмка Глаз 05.10, кадры pilot-vid/v11). В сером
 * страж и житель были одним пятном: средний цвет (34,38,60) против
 * (36,35,64), около 40 из 255 на полу около 107, отличалась одна каска;
 * страж над крышей стены — контраст −3, пропадал. Маг — 104 против пола 108.
 * Ночью свет на боках фигуры слабый, и светлая краска упирается в 1:
 * множителем всей фигуры (как ×1.7 у мага) светлеет и то, что должно
 * остаться тёмным. Поэтому МЕТКА — одна часть одного класса, со своим
 * свечением (как золото щитоносца — свет его щита), а не общий подъём:
 *   soldat (стража)   — тёплая светлая форма: каска, куртка, ремни,
 *                       штаны (лицо и руки — тёмные, как были);
 *   rabochiy, gorozhanka (жители) — без краски, как в наборе;
 *   mag (герой)       — балахон и шляпа светлее, тем же синим.
 * Одной частью (только каска, только куртка) не выходит: замер доли
 * части на экране — каска белым со свечением 1.5 поднимает средний
 * серый стража всего на 33, куртка на 18, а нужно +30 к жителю и +25 к
 * кромке стены при пике не выше ~215 (ярче — спорит с целью подсказки).
 * Тон — тёмный цвет и сильное свечение, а не светлый цвет: свечение
 * одинаково во тьме и на свету, а цвет растёт со светом. Страж под самым
 * фонарём (сторожка, 19,17) на светлом пятне иначе сливался по среднему
 * серому (было −65 тёмным силуэтом, со светлой краской −19.5, с этой
 * −25.8 на телефоне и −26.6 на компьютере — запас всего в единицу).
 * Цвет — в гамме (как col после prepareSkinned), glow — свечение части
 * (engine.js, a_glow). Числа подобраны замером «серый лист классов»
 * (pilot-vid/zamer-v12.mjs): разница страж/житель в сером, страж/крыша
 * стены, светлота мага. Нет такой части в модели — краска молча не
 * ложится: проверка — tests/gltf.mjs (каждая часть из таблицы есть).
 */
export const KRASKI = {
  soldat: {
    Helmet: { color: [0.36, 0.29, 0.18], glow: 1.2 },     /* латунная каска */
    Main: { color: [0.4, 0.3, 0.18], glow: 1.65 },        /* светлая куртка-кираса */
    Black: { color: [0.3, 0.23, 0.15], glow: 1.3 },       /* ремни и сапоги — кожа */
    DarkGreen: { color: [0.24, 0.19, 0.14], glow: 1.1 },  /* штаны — тёмная охра */
  },
  mag: { Clothes: { color: [0.34, 0.52, 0.76] }, Hat: { color: [0.27, 0.41, 0.66] } },
};

/* Краска на вершины модели с кожей: от исходных цветов (col0), заново. */
export function paintSkinned(k, table) {
  if (!k.col0) k.col0 = k.col.slice();
  k.col.set(k.col0);
  k.glow = null;
  if (!table) return k;
  for (const part of k.parts || []) {
    const paint = table[part.material];
    if (!paint) continue;
    if (!k.glow) k.glow = new Float32Array(k.vertices);
    for (let i = part.start; i < part.start + part.count; i += 1) {
      if (paint.color) k.col.set(paint.color, i * 3);
      if (paint.glow) k.glow[i] = paint.glow;
    }
  }
  return k;
}

async function defaultDecode(bytes, mime) {
  if (typeof createImageBitmap !== 'function' || typeof Blob !== 'function') return null;
  return createImageBitmap(new Blob([bytes], { type: mime }));
}

/* Пиксели картинки для «плоского» вида (цвет грани из рисунка). */
function pixelsOf(bitmap) {
  if (!bitmap || typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = bitmap.width; c.height = bitmap.height;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(bitmap, 0, 0);
  return { w: c.width, h: c.height, data: x.getImageData(0, 0, c.width, c.height).data };
}

export function createModelLibrary(options = {}) {
  const fetchFn = options.fetch || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
  const base = options.base ?? MODEL_BASE;
  const warn = options.warn || ((...a) => console.warn(...a));
  const decode = options.decodeImage || defaultDecode;
  /* Краска по классу (KRASKI); {} — модели как в наборе. */
  const kraski = options.kraski || KRASKI;
  const entries = new Map();
  const warned = new Set();
  const lib = {
    ready: false,
    version: 0,
    /* 'tekstura' — картинки моделей как есть; 'ploskiy' — цвет грани из
       картинки (низкополигональная заливка, как у персонажей и башни). */
    style: options.style || 'tekstura',
    failed: new Map(),
    has: (id) => Boolean(entries.get(id)),
    entry: (id) => entries.get(id) || null,
    warnOnce(id, message) {
      lib.failed.set(id, message);
      if (warned.has(id)) return;
      warned.add(id);
      warn(`[модели] ${id}: ${message} — на её месте прежняя фигура`);
    },

    /* Загрузка всех (или названных) моделей; ошибки — warnOnce, не исключение. */
    async load(ids = Object.keys(MODELI)) {
      await Promise.all(ids.map(async (id) => {
        try {
          if (!fetchFn) throw new Error('нет fetch');
          const res = await fetchFn(`${base}${id}.glb`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const doc = parseGLB(await res.arrayBuffer());
          const e = { id, kind: MODELI[id] ? MODELI[id].kind : 'static', doc };
          if (e.kind === 'actor') e.skinned = paintSkinned(prepareSkinned(doc), kraski[id]);
          else {
            e.flat = flattenStatic(doc);
            e.images = await Promise.all(doc.images.map(async (img) => {
              try { return await decode(img.bytes, img.mime); } catch { return null; }
            }));
            e.pixels = e.images.map((b) => { try { return pixelsOf(b); } catch { return null; } });
          }
          entries.set(id, e);
        } catch (error) {
          entries.set(id, null);
          lib.warnOnce(id, error.message || String(error));
        }
      }));
      lib.ready = true;
      lib.version += 1;
      return lib;
    },

    /* Перекрасить персонажей (замер «серый лист», igra.js debug.kraski):
       table — как KRASKI, null — цвета набора. Мир не трогается. */
    repaint(renderer, table) {
      for (const [id, e] of entries) {
        if (!e || e.kind !== 'actor') continue;
        paintSkinned(e.skinned, table ? table[id] : null);
        if (e.attached === renderer) renderer.registerSkinned(`skin:${id}`, e.skinned);
      }
    },
    /* Текстуры и буферы — в рендерер (после load, один раз на рендерер). */
    attach(renderer) {
      for (const [id, e] of entries) {
        if (!e || e.attached === renderer) continue;
        try {
          if (e.kind === 'actor') {
            if (!renderer.skinReady()) throw new Error(`программа кожи не собралась: ${renderer.skinError}`);
            renderer.registerSkinned(`skin:${id}`, e.skinned);
          } else {
            e.textures = e.images.map((b) => (b ? renderer.createTexture(b) : null));
            /* Части модели узлами (фонарь у лампы): в своих координатах. */
            e.parts = e.flat.parts.map((part, i) => {
              const key = `mdl:${id}:${i}`;
              const out = { plain: [], tex: new Map() };
              pushPart(out, e, part, IDENTITY, {}, lib.style);
              const textured = [...out.tex.values()][0];
              if (textured) renderer.register(key, textured.data, { stride: TEX_STRIDE, texture: textured.texture });
              else renderer.register(key, out.plain);
              return key;
            });
          }
          e.attached = renderer;
        } catch (error) {
          entries.set(id, null);
          lib.warnOnce(id, error.message);
        }
      }
      lib.version += 1;
    },
  };
  return lib;
}

const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

/* ---------------------------------------------------------
   НЕПОДВИЖНЫЕ: в печь этажа
   --------------------------------------------------------- */

/*
 * out — { plain: массив вершин формата движка (без картинки), tex: Map
 * ключ → { data, texture } }. m — матрица места; opts:
 *   tint [r,g,b]   — множитель цвета (тон этажа у стены); tintTop — у граней вверх;
 *   color [r,g,b]  — цвет вместо цвета модели (кристалл в цвет молнии — правило);
 *   shade(p)       — множитель цвета по мировой точке (низ стены темнее);
 *   emissive, surf — как у процедурных фигур;
 *   cut, anchor    — срез стены (1), украшение (2), редеющий предмет (3);
 *   planarUV       — картинка по миру (клетка = один повтор): стена Kenney
 *                    тянется по высоте, а камень остаётся камнем;
 *   flat           — цвет грани из картинки вместо картинки.
 */
export function bakeModel(out, lib, id, m, opts = {}) {
  const e = lib && lib.entry(id);
  if (!e || !e.flat) return false;
  for (const part of e.flat.parts) pushPart(out, e, part, m, opts, lib.style);
  return true;
}

function pushPart(out, e, part, m, opts, style) {
  const tint = opts.tint || [1, 1, 1];
  const emissive = opts.emissive || 0, surf = opts.surf || 0, cut = opts.cut || 0;
  const anchor = opts.anchor || [0, 0];
  const mat = e.doc.materials[part.material];
  const imageIndex = mat && mat.texture ? mat.texture.image : -1;
  const texture = imageIndex >= 0 && e.textures ? e.textures[imageIndex] : null;
  const pixels = imageIndex >= 0 && e.pixels ? e.pixels[imageIndex] : null;
  const flat = (opts.flat ?? style === 'ploskiy') && pixels;
  const useTex = part.uv && texture && !flat;
  let data;
  if (useTex) {
    const key = `${e.id}/${imageIndex}`;
    if (!out.tex.has(key)) out.tex.set(key, { data: [], texture });
    data = out.tex.get(key).data;
  } else data = out.plain;
  const P = part.pos, N = part.nrm, U = part.uv, C = part.col;
  for (let v = 0; v < P.length / 3; v += 1) {
    const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
    const wx = m[0] * x + m[4] * y + m[8] * z + m[12];
    const wy = m[1] * x + m[5] * y + m[9] * z + m[13];
    const wz = m[2] * x + m[6] * y + m[10] * z + m[14];
    const nx0 = N[v * 3], ny0 = N[v * 3 + 1], nz0 = N[v * 3 + 2];
    let nx = m[0] * nx0 + m[4] * ny0 + m[8] * nz0, ny = m[1] * nx0 + m[5] * ny0 + m[9] * nz0, nz = m[2] * nx0 + m[6] * ny0 + m[10] * nz0;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl; ny /= nl; nz /= nl;
    const tt = opts.tintTop && ny > 0.7 ? opts.tintTop : tint;
    const k = opts.shade ? opts.shade([wx, wy, wz]) : 1;
    const base = opts.color || [C[v * 3], C[v * 3 + 1], C[v * 3 + 2]];
    let r = base[0] * tt[0] * k, g = base[1] * tt[1] * k, b = base[2] * tt[2] * k;
    if (flat && U) {
      /* Цвет грани — картинка в середине треугольника: у листа-палитры
         (Kenney) это ровно цвет клетки палитры, у листа-фактуры — её тон. */
      const t0 = v - (v % 3);
      const cu = (U[t0 * 2] + U[t0 * 2 + 2] + U[t0 * 2 + 4]) / 3, cv = (U[t0 * 2 + 1] + U[t0 * 2 + 3] + U[t0 * 2 + 5]) / 3;
      const px = sample(pixels, cu, cv);
      r *= px[0]; g *= px[1]; b *= px[2];
    }
    data.push(wx, wy, wz, nx, ny, nz, r, g, b, emissive, surf, cut, 1, anchor[0], anchor[1]);
    if (useTex) {
      if (opts.planarUV) {
        /* Грань вбок — (вдоль грани, высота), вверх — (x, z): клетка — один повтор. */
        if (Math.abs(ny) > 0.7) data.push(wx, wz);
        else if (Math.abs(nx) > Math.abs(nz)) data.push(wz, -wy);
        else data.push(wx, -wy);
      } else data.push(U[v * 2], U[v * 2 + 1]);
    }
  }
}

function sample(px, u, v) {
  const x = ((Math.floor((u - Math.floor(u)) * px.w) % px.w) + px.w) % px.w;
  const y = ((Math.floor((v - Math.floor(v)) * px.h) % px.h) + px.h) % px.h;
  const i = (y * px.w + x) * 4;
  return [px.data[i] / 255, px.data[i + 1] / 255, px.data[i + 2] / 255];
}

/* Размер модели в её координатах — для подгонки под клетку. */
export function modelBounds(lib, id) {
  const e = lib && lib.entry(id);
  return e && e.flat ? { min: e.flat.min, max: e.flat.max } : null;
}

/* Узлы модели для живой части кадра (фонарь у лампы игры). */
export function modelNodes(lib, id, material = {}) {
  const e = lib && lib.entry(id);
  if (!e || !e.parts) return null;
  const root = new Node();
  for (const key of e.parts) root.add(new Node(key, { color: [1, 1, 1], ...material }));
  return root;
}

/* ---------------------------------------------------------
   ПЕРСОНАЖИ
   --------------------------------------------------------- */

/* Длительность плавной смены клипа: короче — дёргается, длиннее — ватно. */
export const BLEND = 0.18;
/*
 * Клетка/с: ниже IDLE_BELOW — стоит, выше RUN_FROM — бежит. Клипы набора
 * записаны неспешно: «Walk» проходит 0.57 клетки/с, «Run» — 0.99 (замер
 * ступни, tests/gltf.mjs), а мир ходит быстро: патруль и жители 2–2.5,
 * герой ~6.5. Поэтому «Walk» — только на крадущемся шаге, патруль бежит
 * клипом «Run» в темпе ×2–2.4; темп выше RATE_MAX не поднимается —
 * у героя на полном ходу ступня скользит (≈×2.7), это видно и названо.
 */
export const IDLE_BELOW = 0.25;
export const RUN_FROM = 1.0;
export const RATE_MAX = 2.4;
const PULSE_CLIP = { hit: 'RecieveHit', cast: 'Shoot_OneHanded', swing: 'SwordSlash', punch: 'Punch' };

/*
 * Персонаж: узел с костями (renderer.drawSkinned) и выбор клипа.
 */
export class Aktyor {
  constructor(lib, id) {
    const e = lib.entry(id);
    this.id = id;
    this.k = e.skinned;
    this.pose = createPose(this.k.skel);
    this.clip = 'Idle'; this.t = 0; this.once = false;
    this.prev = null; this.prevT = 0; this.fade = 1;
    this.node = new Node(`skin:${id}`, { color: [1, 1, 1], surf: 14 /* SURF.SKIN: подсветка края */ });
    this.node.skin = this.pose.joints;
    /* Шаг клипа «Walk» в клетках за цикл: из того, сколько проходит ступня. */
    this.stride = { Walk: strideOf(this.k, 'Walk'), Run: strideOf(this.k, 'Run') };
  }

  /*
   * state = { speed (клетка/с), down (лежит), pulse: 'hit' | 'cast' |
   * 'swing' | 'punch' | null — событие этого кадра }. Разовый клип
   * (удар, колдовство, получил) доигрывает до конца, если его не перебило
   * новое событие; «упал» держит последний кадр, пока лежит.
   */
  update(dt, state) {
    let want, once = false, restart = false;
    if (state.down) { want = 'Death'; once = true; }
    else if (state.pulse && PULSE_CLIP[state.pulse]) { want = PULSE_CLIP[state.pulse]; once = true; restart = true; }
    else if (this.once && this.clip !== 'Death' && this.t < this.duration(this.clip)) { want = this.clip; once = true; }
    else want = state.speed < IDLE_BELOW ? 'Idle' : state.speed >= RUN_FROM ? 'Run' : 'Walk';
    if (want !== this.clip || restart) {
      this.prev = this.clip; this.prevT = this.t; this.prevOnce = this.once; this.fade = 0;
      this.clip = want; this.t = 0; this.once = once;
    }
    let rate = 1;
    const s = this.stride[this.clip];
    if (s && state.speed > 0) rate = Math.min(RATE_MAX, Math.max(0.6, state.speed / s * this.duration(this.clip)));
    this.t += dt * rate;
    if (this.prev) this.prevT += dt;
    this.fade = Math.min(1, this.fade + dt / BLEND);
    const k = this.k;
    resetPose(k.skel, this.pose);
    const blending = this.prev && this.fade < 1;
    if (blending) sampleClip(k.clips.get(this.prev), this.prevT, this.pose, 1, !this.prevOnce);
    sampleClip(k.clips.get(this.clip), this.t, this.pose, blending ? this.fade : 1, !this.once);
    finishPose(k.skel, this.pose);
    return this.node;
  }

  duration(clip) { const c = this.k.clips.get(clip); return c ? c.duration : 1; }

  /* Мировая точка кости (кисть — для щита и шара в руке); w — матрица узла. */
  bonePoint(name, w) {
    const p = nodePoint(this.k.skel, this.pose, name);
    if (!p) return null;
    return [w[0] * p[0] + w[4] * p[1] + w[8] * p[2] + w[12], w[1] * p[0] + w[5] * p[1] + w[9] * p[2] + w[13], w[2] * p[0] + w[6] * p[1] + w[10] * p[2] + w[14]];
  }
}

function strideOf(k, clipName) {
  const clip = k.clips.get(clipName);
  if (!clip) return 0;
  const pose = createPose(k.skel);
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i <= 24; i += 1) {
    resetPose(k.skel, pose);
    sampleClip(clip, clip.duration * i / 24, pose);
    finishPose(k.skel, pose);
    const p = nodePoint(k.skel, pose, 'Foot.L');
    if (!p) return 0;
    lo = Math.min(lo, p[2]); hi = Math.max(hi, p[2]);
  }
  /* За цикл ступня проходит размах дважды (вперёд под телом, назад — опорой). */
  return (hi - lo) * 2 * ACTOR_SCALE;
}
