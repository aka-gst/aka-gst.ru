// 16.7 · Погружение. Picking up the chip works like the deep-program in
// Lukyanenko's "Labyrinth of Reflections": a hypnotic spiral pulls you into a
// reality where you already can do all this, then you surface back into the
// grey factory knowing it can be learned. The timeline is pure (tested); the
// effects draw into the same 240-row Doom frame as the shift.
import { rgb } from './raycaster.js';

export const DIVE_TIMELINE = Object.freeze([
  Object.freeze({ stage: 'grip', ms: 1100 }),
  Object.freeze({ stage: 'enter', ms: 1900 }),
  Object.freeze({ stage: 'vision', index: 0, ms: 2400 }),
  Object.freeze({ stage: 'vision', index: 1, ms: 2400 }),
  Object.freeze({ stage: 'vision', index: 2, ms: 2400 }),
  Object.freeze({ stage: 'peak', ms: 1500 }),
  Object.freeze({ stage: 'exit', ms: 1000 }),
  Object.freeze({ stage: 'melt', ms: 1100 }),
]);
export const DIVE_MS = DIVE_TIMELINE.reduce((n, s) => n + s.ms, 0);

// What you are, for a few seconds. Images live in art/.
export const DIVE_VISIONS = Object.freeze([
  Object.freeze({ id: 'shop', image: 'future-shop.jpg', caption: 'ТЫ СПИШЬ. МАГАЗИН РАБОТАЕТ.', sub: 'ЗАКАЗ ОТПРАВЛЕН · +2 400 ₽', tint: [255, 206, 110] }),
  Object.freeze({ id: 'battle', image: 'future-battle.jpg', caption: 'ТВОИ БОТЫ ДЕРЖАТ СЕРВЕР.', sub: 'ТЫСЯЧА АТАК · НИ ОДНОЙ ДЫРЫ', tint: [120, 220, 255] }),
  Object.freeze({ id: 'vika', image: 'future-vika.jpg', caption: 'ТЫ СОЗДАЛ НЕ ПРОСТО ПРОГРАММУ.', sub: '— А ВОТ И ТЫ.', tint: [130, 255, 220] }),
]);

// As in the book: "deep, Ввод. Темноту экранов расчертили падающие звёзды,
// радужная спираль закрутилась перед глазами" -- and out with "Глубина,
// глубина, я не твой…".
export const DIVE_WORDS = Object.freeze({
  grip: 'DEEP',
  gripEnter: 'ВВОД',
  enter: 'ПОГРУЖЕНИЕ...',
  peak: 'ТЫ МОЖЕШЬ.',
  exit: 'ГЛУБИНА, ГЛУБИНА, Я НЕ ТВОЙ...',
  after: 'ЭТОМУ МОЖНО НАУЧИТЬСЯ.',
  afterSub: 'ИГРАЮЧИ. ПО ШАГУ. С РУКИ 07.',
});

// The hero's own thought once he is back: [speaker, line, button].
export const DIVE_THOUGHT = Object.freeze([
  'ТЫ · ОШАРАШЕН',
  'Ого… ЧТО это было?! Это же я — через годы? Не сон. Пару секунд это было «могу». Так умеют люди, у которых этот чип в голове, — и этому учатся: по шагу, играючи. Первый шаг — рука 07.',
  'ВСТАВИТЬ ЧИП В РУКУ 07 →',
]);

export function diveStageAt(ms) {
  if (!(ms >= 0)) return { stage: 'grip', index: 0, k: 0, t: 0, step: 0 };
  let acc = 0;
  for (let i = 0; i < DIVE_TIMELINE.length; i++) {
    const s = DIVE_TIMELINE[i];
    if (ms < acc + s.ms) return { stage: s.stage, index: s.index ?? 0, k: (ms - acc) / s.ms, t: ms - acc, step: i };
    acc += s.ms;
  }
  return { stage: 'after', index: 0, k: 1, t: ms - acc, step: DIVE_TIMELINE.length };
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);

// A painted vision becomes a frame of the same world: a few levels per
// channel with ordered dithering, like a 90s VGA screen.
export function posterize(rgba, w, h, levels = 6) {
  const out = new Uint32Array(w * h);
  const step = 255 / (levels - 1);
  for (let y = 0, i = 0; y < h; y++) {
    for (let x = 0; x < w; x++, i++) {
      const d = (BAYER4[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * step;
      const q = (v) => clamp255(Math.round(Math.min(255, Math.max(0, v + d)) / step) * step);
      out[i] = rgb(q(rgba[i * 4]), q(rgba[i * 4 + 1]), q(rgba[i * 4 + 2]));
    }
  }
  return out;
}

// Rainbow with a soft brightness band so the spiral arms read. The band is
// slow enough that no pixel pulses faster than ~2 Hz (no strobing).
const PR = new Uint8Array(256), PG = new Uint8Array(256), PB = new Uint8Array(256);
for (let i = 0; i < 256; i++) {
  const h = (i / 256) * 6, s = 0.72, v = 0.72 + 0.28 * Math.cos((i / 256) * Math.PI * 8);
  const c = v * s, x = c * (1 - Math.abs((h % 2) - 1)), m = v - c;
  const [r, g, b] = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x];
  PR[i] = clamp255((r + m) * 255); PG[i] = clamp255((g + m) * 255); PB[i] = clamp255((b + m) * 255);
}

export function createDiveFx({ artBase } = {}) {
  const visions = DIVE_VISIONS.map(() => null);
  let loading = null;
  let tw = 0; let th = 0; let ang = null; let dep = null; let rad = null;
  let scratchA = null; let scratchB = null;
  let meltCols = null; let meltTick = 0;

  function prep(img) {
    const w = 480, h = 300;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true });
    const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    g.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    return { w, h, data: posterize(g.getImageData(0, 0, w, h).data, w, h) };
  }

  function load() {
    if (loading || typeof Image === 'undefined' || !artBase) return loading;
    loading = Promise.all(DIVE_VISIONS.map((v, i) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { try { visions[i] = prep(img); } catch { visions[i] = null; } resolve(); };
      img.onerror = () => resolve();
      img.src = new URL(v.image, artBase).href;
    })));
    return loading;
  }

  function tables(W, H) {
    if (W === tw && H === th) return;
    tw = W; th = H;
    ang = new Uint8Array(W * H); dep = new Uint16Array(W * H); rad = new Float32Array(W * H);
    scratchA = new Uint32Array(W * H); scratchB = new Uint32Array(W * H);
    const cx = W / 2, cy = H / 2;
    for (let y = 0, i = 0; y < H; y++) {
      for (let x = 0; x < W; x++, i++) {
        const dx = x - cx + 0.5, dy = y - cy + 0.5;
        const d = Math.hypot(dx, dy);
        rad[i] = d;
        ang[i] = Math.floor((Math.atan2(dy, dx) / (Math.PI * 2) + 0.5) * 256) & 255;
        dep[i] = Math.min(65535, Math.floor(4096 / (d + 1)));
      }
    }
  }

  // Copy of the frame (the world before it gets twisted, or the last tunnel
  // frame the Doom melt slides away).
  function snapshot(buf, W, H, which = 'a') {
    tables(W, H);
    const dst = which === 'a' ? scratchA : scratchB;
    dst.set(buf.subarray(0, W * H));
    return dst;
  }

  // The world twists around the chip's light, harder towards the middle.
  function swirl(dst, src, W, H, strength) {
    tables(W, H);
    const cx = W / 2, cy = H / 2, maxR = Math.hypot(cx, cy);
    for (let y = 0, i = 0; y < H; y++) {
      for (let x = 0; x < W; x++, i++) {
        const f = 1 - rad[i] / maxR;
        const th2 = strength * f * f;
        const dx = x - cx, dy = y - cy;
        const c = Math.cos(th2), s = Math.sin(th2);
        const sx = Math.min(W - 1, Math.max(0, (cx + dx * c - dy * s) | 0));
        const sy = Math.min(H - 1, Math.max(0, (cy + dx * s + dy * c) | 0));
        dst[i] = src[sy * W + sx];
      }
    }
  }

  // The hypnotic spiral: rings rush towards you, arms turn, light at the
  // end. R/soft/outside mask it to a growing hole; sat < 1 drains colour.
  function tunnel(dst, W, H, time, { dir = 1, spin = 1, sat = 1, R = 1e9, soft = 32, outside = 0 } = {}) {
    tables(W, H);
    const du = Math.floor(time * 46 * dir), dv = Math.floor(time * 18 * spin), hue = Math.floor(time * 30);
    const glowR = H * 0.2;
    for (let i = 0, n = W * H; i < n; i++) {
      const r = rad[i];
      const a = r < R ? 1 : Math.max(outside, 1 - (r - R) / soft);
      if (a <= 0) continue;
      const idx = (dep[i] + du + 2 * (ang[i] + dv) + hue) & 255;
      const f = Math.min(1, 0.38 + 64 / (r + 10));
      let cr = PR[idx] * f, cg = PG[idx] * f, cb = PB[idx] * f;
      if (r < glowR) { const g = 1 - r / glowR; const w = g * g * 230; cr += w; cg += w; cb += w; }
      if (sat < 1) { const l = cr * 0.3 + cg * 0.59 + cb * 0.11; cr = l + (cr - l) * sat; cg = l + (cg - l) * sat; cb = l + (cb - l) * sat; }
      if (a < 1) {
        const c = dst[i];
        cr = (c & 255) * (1 - a) + cr * a; cg = ((c >>> 8) & 255) * (1 - a) + cg * a; cb = ((c >>> 16) & 255) * (1 - a) + cb * a;
      }
      dst[i] = rgb(clamp255(cr), clamp255(cg), clamp255(cb));
    }
  }

  // A vision seen through the hole in the spiral, slowly coming closer, with
  // a faint ripple: real, but not quite.
  function vision(dst, W, H, index, k, time, R, { ripple = 1 } = {}) {
    const img = visions[index];
    if (!img) return false;
    tables(W, H);
    const zoom = 1 + 0.12 * k;
    const cover = Math.max(W / img.w, H / img.h) * zoom;
    const cx = W / 2, cy = H / 2, ix = img.w / 2, iy = img.h / 2;
    for (let y = 0; y < H; y++) {
      const off = ripple ? Math.sin(y * 0.09 + time * 2.6) * 1.2 * ripple : 0;
      const v = Math.min(img.h - 1, Math.max(0, Math.floor(iy + (y - cy) / cover)));
      for (let x = 0; x < W; x++) {
        const i = y * W + x; const r = rad[i];
        if (r > R + 5) continue;
        const u = Math.min(img.w - 1, Math.max(0, Math.floor(ix + (x - cx + off) / cover)));
        let c = img.data[v * img.w + u];
        if (r > R - 5) {
          const a = (R + 5 - r) / 10, o = dst[i];
          c = rgb(clamp255((o & 255) * (1 - a) + (c & 255) * a), clamp255(((o >>> 8) & 255) * (1 - a) + ((c >>> 8) & 255) * a), clamp255(((o >>> 16) & 255) * (1 - a) + ((c >>> 16) & 255) * a));
        }
        dst[i] = c;
      }
    }
    return true;
  }

  // Doom's screen melt: the old frame slides down in 2-px columns with
  // ragged starts, uncovering the new one.
  function meltReset(W) {
    const n = Math.ceil(W / 2);
    meltCols = new Int16Array(n);
    meltCols[0] = -((Math.random() * 16) | 0);
    for (let i = 1; i < n; i++) meltCols[i] = Math.max(-15, Math.min(0, meltCols[i - 1] + ((Math.random() * 3) | 0) - 1));
    meltTick = 0;
  }
  function melt(dst, src, W, H, ticks) {
    if (!meltCols || meltCols.length !== Math.ceil(W / 2)) meltReset(W);
    while (meltTick < ticks) {
      meltTick++;
      for (let i = 0; i < meltCols.length; i++) {
        const y = meltCols[i];
        meltCols[i] = y < 0 ? y + 1 : Math.min(H, y + (y < 16 ? y + 1 : 8));
      }
    }
    for (let c = 0; c < meltCols.length; c++) {
      const off = Math.max(0, meltCols[c]);
      if (off >= H) continue;
      for (let x = c * 2; x < Math.min(W, c * 2 + 2); x++) {
        for (let y = H - 1; y >= off; y--) dst[y * W + x] = src[(y - off) * W + x];
      }
    }
  }

  // Falling stars scoring the dark screen, before the spiral takes over.
  // Few, bright-headed, long-tailed, slanting: shooting stars, not rain.
  const STARS = Array.from({ length: 34 }, (_, i) => {
    const r = (n) => { const x = Math.sin((i + 1) * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x); };
    return { x: r(1), y: r(2), speed: 0.7 + r(3) * 0.9, len: 18 + r(4) * 34, bright: 0.6 + r(5) * 0.4 };
  });
  function stars(dst, W, H, time, alpha = 1) {
    if (alpha <= 0) return;
    const add = (x, y, a) => {
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const i = y * W + x, c = dst[i];
      dst[i] = rgb(clamp255((c & 255) + 235 * a), clamp255(((c >>> 8) & 255) + 242 * a), clamp255(((c >>> 16) & 255) + 255 * a));
    };
    for (const s of STARS) {
      const travel = time * s.speed;
      const y0 = ((s.y + travel) % 1) * (H + 60) - 30;
      const x0 = (((s.x - travel * 0.8) % 1) + 1) % 1 * (W + 60) - 30;
      for (let j = 0; j < s.len; j++) {
        const f = 1 - j / s.len;
        add(Math.round(x0 + j * 0.8), Math.round(y0 - j), alpha * s.bright * f * f);
      }
      const hx = Math.round(x0), hy = Math.round(y0);
      add(hx, hy, alpha); add(hx + 1, hy, alpha * 0.7); add(hx, hy + 1, alpha * 0.7); add(hx - 1, hy, alpha * 0.4); add(hx, hy - 1, alpha * 0.4);
    }
  }

  function blend(dst, W, H, [tr, tg, tb], a) {
    for (let i = 0, n = W * H; i < n; i++) {
      const c = dst[i];
      dst[i] = rgb(clamp255((c & 255) * (1 - a) + tr * a), clamp255(((c >>> 8) & 255) * (1 - a) + tg * a), clamp255(((c >>> 16) & 255) * (1 - a) + tb * a));
    }
  }

  function desaturate(dst, W, H, amount) {
    for (let i = 0, n = W * H; i < n; i++) {
      const c = dst[i]; const r = c & 255, g = (c >>> 8) & 255, b = (c >>> 16) & 255;
      const l = r * 0.3 + g * 0.59 + b * 0.11;
      dst[i] = rgb(clamp255(r + (l - r) * amount), clamp255(g + (l - g) * amount), clamp255(b + (l - b) * amount));
    }
  }

  return {
    load, snapshot, swirl, tunnel, vision, melt, meltReset, blend, desaturate, stars,
    ready: () => visions.every(Boolean),
    radius: (W, H) => Math.hypot(W / 2, H / 2),
  };
}
