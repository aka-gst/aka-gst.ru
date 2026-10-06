// Things drawn into the Doom-style frame on top of the world: speech bubbles
// over the person who is talking (or a subtitle line when they're off-screen
// or behind a wall), and the "what am I standing on" lookup used by the NPC
// comments. Shared by the first shift and the later warehouse chapters.
import { rgb } from './raycaster.js';
import { drawText, textWidth } from './pixel-font.js';
import { wrapBubble } from './npc-chatter.js';

const INK = rgb(16, 16, 18);
const PAPER = rgb(236, 232, 214);
const EDGE = rgb(40, 36, 30);
const NAME = rgb(170, 60, 30);
const SUB_BG = rgb(14, 14, 16);
const GOLD = rgb(255, 200, 70);
const WHITE = rgb(236, 236, 228);

// What kind of surface a cell is, for comments ("на ящиках", "на ленте").
export function surfaceOf(cell) {
  if (!cell) return 'floor';
  const k = cell.kind;
  if (k === 'c' || k === 'k' || k === 'K' || k === 'p') return 'crates';
  if (k === '=' || k === 'O' || k === 'b') return 'belt';
  if (cell.floor >= 1.3) return 'high';
  if (cell.floor >= 0.5) return 'thing';
  return 'floor';
}

function box(buf, W, H, x0, y0, w, h, fill, edge) {
  for (let y = Math.max(0, y0); y < Math.min(H, y0 + h); y++) {
    for (let x = Math.max(0, x0); x < Math.min(W, x0 + w); x++) {
      const border = y === y0 || y === y0 + h - 1 || x === x0 || x === x0 + w - 1;
      buf[y * W + x] = border ? edge : fill;
    }
  }
}

// speech: { name, text }. at: { x, y (metres above floor), z } of the
// speaker's head, or null for the radio. view: what renderer.render returned
// plus the camera. Returns 'bubble' | 'subtitle'.
// 17.3 · the subtitle must never sit under the DOM action prompt («E · ВЗЯТЬ
// ЯЩИК» overlapped the caption). Given where the prompt's top edge is on the
// canvas (CSS px) and the canvas' own box, the lowest frame row the caption
// may reach. null prompt -> the default 78 % line.
export function subtitleFloorRow(viewH, rows, canvasRect, promptRect, gap = 3) {
  const fallback = Math.round(viewH * 0.78);
  if (!canvasRect || !promptRect || !(canvasRect.height > 0) || !(promptRect.height > 0)) return fallback;
  const top = (promptRect.top - canvasRect.top) / canvasRect.height * rows;
  if (!Number.isFinite(top)) return fallback;
  return Math.max(Math.round(viewH * 0.4), Math.min(fallback, Math.floor(top) - gap));
}

export function drawSpeech(buf, W, viewH, speech, at, view, { floor = null, bubbleOnly = false } = {}) {
  if (!speech) return null;
  const lines = wrapBubble(speech.text, 30);
  const name = String(speech.name).replace(/Ё/g, 'Е');
  let mode = 'subtitle';
  let sx = 0; let sy = 0;
  if (at && view) {
    const { cam, F, horizon, depth } = view;
    const sin = Math.sin(cam.yaw), cos = Math.cos(cam.yaw);
    const rx = at.x - cam.x, rz = at.z - cam.z;
    const dz = rx * sin - rz * cos;
    const dx = rx * cos + rz * sin;
    if (dz > 0.4 && dz < 14) {
      sx = Math.round(W / 2 + (dx / dz) * F);
      sy = Math.round(horizon - ((at.y ?? 1.9) - cam.eye) * F / dz);
      const probeY = Math.min(viewH - 1, Math.max(0, sy + 4));
      const visible = sx > 8 && sx < W - 8 && sy > 4 && sy < viewH - 4 && (!depth || depth[probeY * W + sx] + 0.3 >= dz);
      if (visible) mode = 'bubble';
    }
  }
  if (bubbleOnly && mode !== 'bubble') return 'none';
  const textW = Math.max(textWidth(name), ...lines.map((l) => textWidth(l)));
  if (mode === 'bubble') {
    const w = textW + 8; const h = 10 + lines.length * 9 + 2;
    let x0 = Math.round(sx - w / 2); x0 = Math.max(2, Math.min(W - w - 2, x0));
    // 18.0: keep speech bubbles out of the top band where the DOM HUD (day,
    // quest title, status) lives — Сергей: «надписи перекрывают друг друга».
    const hudBand = Math.round(viewH * 0.3);
    let y0 = sy - h - 6; if (y0 < hudBand) y0 = Math.min(hudBand, Math.max(2, viewH - h - 2));
    box(buf, W, viewH, x0, y0, w, h, PAPER, EDGE);
    // Tail toward the speaker.
    const tx = Math.max(x0 + 4, Math.min(x0 + w - 5, sx));
    for (let i = 0; i < 5; i++) for (let j = -2 + Math.ceil(i / 2); j <= 2 - Math.ceil(i / 2); j++) {
      const px = tx + j, py = y0 + h - 1 + i;
      if (px >= 0 && px < W && py >= 0 && py < viewH) buf[py * W + px] = (j === -2 + Math.ceil(i / 2) || j === 2 - Math.ceil(i / 2)) ? EDGE : PAPER;
    }
    drawText(buf, W, viewH, x0 + 4, y0 + 3, name, NAME, { shadow: 0 });
    lines.forEach((l, i) => drawText(buf, W, viewH, x0 + 4, y0 + 12 + i * 9, l, INK, { shadow: 0 }));
    return 'bubble';
  }
  // Subtitle: bottom of the view, like a radio caption -- wrapped as wide as
  // the frame allows, so it stays two or three lines and clear of the
  // crosshair above and the action prompt below.
  const wide = wrapBubble(speech.text, Math.max(30, Math.min(52, Math.floor((W - 18) / 6))));
  const all = [`${name}:`, ...wide];
  const w = Math.min(W - 8, Math.max(...all.map((l) => textWidth(l))) + 10);
  const h = all.length * 9 + 5;
  // Above the DOM action prompt (which sits over the bottom fifth of the view).
  const x0 = Math.round((W - w) / 2); const y0 = Math.max(2, (floor ?? Math.round(viewH * 0.78)) - h);
  for (let y = Math.max(0, y0); y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const i = y * W + x; const c = buf[i];
    buf[i] = rgb(((c & 255) * 0.25) | 0, (((c >>> 8) & 255) * 0.25) | 0, (((c >>> 16) & 255) * 0.25) | 0);
  }
  box(buf, W, viewH, x0, y0, w, 1, SUB_BG, GOLD);
  all.forEach((l, i) => drawText(buf, W, viewH, Math.round(W / 2 - textWidth(l) / 2), y0 + 3 + i * 9, l, i === 0 ? GOLD : WHITE));
  return 'subtitle';
}

// Wall signs are painted at runtime with the HUD font, on top of a real wall
// texture, so the text stays in the same pixel grid as everything else.
export function paintSign(base, w, h, { plate, rows, lines, ppmx, ppmy }) {
  const data = new Uint32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data[y * w + x] = base.data[(y % base.h) * base.w + (x % base.w)];
  const [px, py, pw, ph, color, edge] = plate;
  for (let y = py; y < py + ph; y++) for (let x = px; x < px + pw; x++) {
    data[y * w + x] = (y === py || y === py + ph - 1 || x === px || x === px + pw - 1) ? edge : color;
  }
  for (const [text, ty, tc, scale = 1] of lines) {
    drawText(data, w, h, Math.round(px + (pw - textWidth(text, scale)) / 2), ty, text, tc, { scale, shadow: 0 });
  }
  return { w, h, data, ppmx, ppmy, rows };
}

// Copies the atlas textures into the hall map and paints its signs.
export function dressHall(map, a) {
  for (const [name, t] of Object.entries(a)) map.textures[name] = t;
  const hall = paintSign(a.CEMENT1, 128, 128, {
    ppmx: 64, ppmy: 32,
    plate: [6, 10, 116, 26, rgb(206, 164, 36), rgb(40, 34, 20)],
    lines: [['СКЛАД 07', 13, rgb(28, 24, 18), 2], ['ЦЕХ ОТГРУЗКИ', 28, rgb(28, 24, 18)]],
  });
  map.textures.SIGN_HALL_L = hall; map.textures.SIGN_HALL_R = hall;
  map.textures.SIGN_LOAD = paintSign(a.CEMENT3, 64, 64, {
    ppmx: 64, ppmy: 32,
    plate: [4, 44, 56, 12, rgb(206, 164, 36), rgb(40, 34, 20)],
    lines: [['ПОГРУЗКА', 47, rgb(28, 24, 18)]],
  });
  map.textures.SIGN_LUNCH = paintSign(a.CEMENT1, 64, 128, {
    ppmx: 64, ppmy: 32,
    plate: [14, 66, 36, 22, rgb(226, 222, 204), rgb(120, 116, 104)],
    lines: [['ОБЕД', 69, rgb(30, 30, 30)], ['12-13', 78, rgb(160, 40, 30)]],
  });
  // 18.0 (Сергей: «фраза про обед → часы на стене 11:00»): the loader is
  // already at lunch, and the clock right above him says eleven.
  map.textures.SIGN_CLOCK = paintSign(a.CEMENT1, 64, 128, {
    ppmx: 64, ppmy: 32,
    plate: [8, 52, 48, 26, rgb(18, 22, 20), rgb(150, 150, 140)],
    lines: [['11:00', 58, rgb(255, 80, 60), 1], ['ЧАСЫ', 69, rgb(150, 160, 150)]],
  });
  return map;
}
