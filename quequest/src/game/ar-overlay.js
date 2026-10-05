// 17.4 · What the AR headset draws over the 3D view, straight into the
// era's own frame buffer (so a Wolfenstein visor is as chunky as the world
// behind it, and a Half-Life one as clean): the visor drop, the boot text,
// the scan sweep through the room (a depth-buffer shell expanding from your
// eyes), holo-tags pinned to things, and the gateway's command packets in
// flight. Positions come from ar-headset.js' projectPoint -- the raycaster's
// own camera math.
import { rgb } from './raycaster.js';
import { drawText, textWidth } from './pixel-font.js';
import { projectPoint, onScreen, occluded, AR_GATE } from './ar-headset.js';
import { deviceSettings, deviceField, deviceJitter } from './vr-devices.js';

const pack = (c) => rgb(c[0] | 0, c[1] | 0, c[2] | 0);
function mix(buf, i, c, a) {
  const p = buf[i];
  const r = (p & 255) + (c[0] - (p & 255)) * a, g = ((p >>> 8) & 255) + (c[1] - ((p >>> 8) & 255)) * a, b = ((p >>> 16) & 255) + (c[2] - ((p >>> 16) & 255)) * a;
  buf[i] = (0xff000000 | ((b | 0) << 16) | ((g | 0) << 8) | (r | 0)) >>> 0;
}
function add(buf, i, c, a) {
  const p = buf[i];
  const r = Math.min(255, (p & 255) + c[0] * a), g = Math.min(255, ((p >>> 8) & 255) + c[1] * a), b = Math.min(255, ((p >>> 16) & 255) + c[2] * a);
  buf[i] = (0xff000000 | ((b | 0) << 16) | ((g | 0) << 8) | (r | 0)) >>> 0;
}
function rectFill(buf, W, H, x0, y0, w, h, c, a) {
  const xa = Math.max(0, x0), xb = Math.min(W, x0 + w), ya = Math.max(0, y0), yb = Math.min(H, y0 + h);
  for (let y = ya; y < yb; y++) for (let x = xa; x < xb; x++) mix(buf, y * W + x, c, a);
}
function rectLine(buf, W, H, x0, y0, w, h, c, t = 1) {
  const col = pack(c);
  for (let k = 0; k < t; k++) {
    for (let x = x0; x < x0 + w; x++) { put(buf, W, H, x, y0 + k, col); put(buf, W, H, x, y0 + h - 1 - k, col); }
    for (let y = y0; y < y0 + h; y++) { put(buf, W, H, x0 + k, y, col); put(buf, W, H, x0 + w - 1 - k, y, col); }
  }
}
function put(buf, W, H, x, y, col) { if (x >= 0 && y >= 0 && x < W && y < H) buf[y * W + x] = col; }
function line(buf, W, H, x0, y0, x1, y1, c, a = 1) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n);
    if (x >= 0 && y >= 0 && x < W && y < H) mix(buf, y * W + x, c, a);
  }
}
function blob(buf, W, H, depth, cx, cy, dz, r, c, { glow = 1, test = true } = {}) {
  const R = Math.max(1, r), R2 = R * R * 4;
  const x0 = Math.floor(cx - R * 2), x1 = Math.ceil(cx + R * 2), y0 = Math.floor(cy - R * 2), y1 = Math.ceil(cy + R * 2);
  for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) {
    const d2 = (x - cx) ** 2 + (y - cy) ** 2;
    if (d2 > R2) continue;
    const i = y * W + x;
    const hidden = test && depth && depth[i] + 0.2 < dz;
    const core = d2 <= R * R;
    const a = (core ? 1 : (1 - (d2 - R * R) / (R2 - R * R)) * 0.55) * glow * (hidden ? 0.3 : 1);
    if (core && !hidden) buf[i] = pack(c); else add(buf, i, c, a);
  }
}

// opts: { cam, view: {F, horizon}, depth, style, device, phase, k, t (s),
// tags: [{ tag, readout, target }], flights, label, reduced, gateway }.
export function drawAr(buf, W, H, opts) {
  const { style, phase, k = 1, reduced = false } = opts;
  const dev = deviceSettings(opts.device ?? 0);
  const fld = deviceField(dev.n, W, H);
  const worn = phase === 'on' || phase === 'edit';
  const fg = style.fg, bg = style.bg;
  if (phase === 'boot' || phase === 'unboot') {
    drawTransition(buf, W, H, opts, dev, fld);
    return;
  }
  if (!worn) return;
  // Field of the device: a dark visor rim (or a phone bezel) outside it.
  drawRim(buf, W, H, fld, dev, style);
  if (style.scan && !reduced) for (let y = fld.y0; y < fld.y1; y += 2) for (let x = fld.x0; x < fld.x1; x++) mix(buf, y * W + x, bg, 0.12);
  // The gateway ring and the packets (garage).
  if (opts.flights) drawPackets(buf, W, H, opts, dev, fld);
  if (opts.gateway) drawGate(buf, W, H, opts);
  drawTags(buf, W, H, opts, dev, fld);
  // Status line along the top of the field (centred when the field is the
  // whole view, so it clears the page's own corner HUD).
  const sc = H >= 300 ? 2 : 1;
  const top = fld.y0 + 4;
  if (dev.frame === 'none') {
    const lbl = `AR · ${opts.label ?? ''} · ${dev.name}`;
    const lw = textWidth(lbl, sc);
    rectFill(buf, W, H, Math.round(W / 2 - lw / 2) - 4, top - 2, lw + 8, 7 * sc + 4, bg, 0.6);
    drawText(buf, W, H, Math.round(W / 2 - lw / 2), top, lbl, pack(fg), { scale: sc, shadow: 0 });
  } else {
    const left = `AR · ${opts.label ?? ''}`;
    const right = `${style.name} · ${dev.name}`;
    rectFill(buf, W, H, fld.x0 + 4, top - 2, Math.min(fld.x1 - fld.x0 - 8, textWidth(left, sc) + 8), 7 * sc + 4, bg, 0.6);
    drawText(buf, W, H, fld.x0 + 8, top, left, pack(fg), { scale: sc, shadow: 0 });
    if (textWidth(left, sc) + textWidth(right, 1) + 40 < fld.x1 - fld.x0) drawText(buf, W, H, fld.x1 - textWidth(right) - 8, top + (sc - 1) * 3, right, pack(style.dim), { shadow: 0 });
  }
  // Corner brackets.
  const L = Math.max(6, Math.round(Math.min(W, H) * 0.06)), c = pack(fg), th = style.line;
  for (const [x, y, sx, sy] of [[fld.x0 + 2, fld.y0 + 2, 1, 1], [fld.x1 - 3, fld.y0 + 2, -1, 1], [fld.x0 + 2, fld.y1 - 3, 1, -1], [fld.x1 - 3, fld.y1 - 3, -1, -1]]) {
    for (let i = 0; i < L; i++) for (let j = 0; j < th; j++) { put(buf, W, H, x + i * sx, y + j * sy, c); put(buf, W, H, x + j * sx, y + i * sy, c); }
  }
}

function drawRim(buf, W, H, fld, dev, style) {
  if (dev.frame === 'none') return;
  const dark = [4, 5, 7];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const inside = x >= fld.x0 && x < fld.x1 && y >= fld.y0 && y < fld.y1;
    if (inside) {
      if (dev.frame === 'visor') {
        // Rounded visor corners.
        const rx = Math.min(x - fld.x0, fld.x1 - 1 - x), ry = Math.min(y - fld.y0, fld.y1 - 1 - y), R = 14;
        if (rx < R && ry < R && (R - rx) ** 2 + (R - ry) ** 2 > R * R) buf[y * W + x] = pack(dark);
      }
      continue;
    }
    const i = y * W + x;
    if (dev.frame === 'phone') mix(buf, i, dark, 0.9);
    else mix(buf, i, [style.bg[0] * 0.5, style.bg[1] * 0.5, style.bg[2] * 0.5], 0.78);
  }
}

function drawTransition(buf, W, H, opts, dev, fld) {
  const { style, phase, k, reduced, depth } = opts;
  const fg = style.fg;
  if (phase === 'unboot') {
    const edge = Math.round(H * (1 - k));
    for (let y = 0; y < edge; y++) for (let x = 0; x < W; x++) mix(buf, y * W + x, style.bg, 0.4);
    for (let x = 0; x < W; x++) put(buf, W, H, x, edge, pack(fg));
    return;
  }
  // Visor drops (0..0.25), boot text types (0.15..0.6), the scan sweep
  // runs out from your eyes through the room (0.35..1).
  const drop = reduced ? 1 : Math.min(1, k / 0.25);
  const edge = Math.round(H * drop);
  for (let y = 0; y < edge; y++) for (let x = 0; x < W; x++) mix(buf, y * W + x, style.bg, 0.35 * (reduced ? k : 1));
  if (!reduced && drop < 1) for (let x = 0; x < W; x++) { put(buf, W, H, x, edge, pack(fg)); put(buf, W, H, x, edge - 1, pack(style.dim)); }
  if (!reduced && k > 0.3 && depth) {
    const R = 0.4 + ((k - 0.3) / 0.7) ** 1.4 * 11, band = 0.45;
    for (let i = 0, n = W * H; i < n; i++) {
      const d = depth[i];
      if (d > 50) continue;
      const off = Math.abs(d - R);
      if (off < band) add(buf, i, fg, (1 - off / band) * 0.9);
      else if (d < R) mix(buf, i, style.bg, 0.12);
    }
  }
  const sc = H >= 300 ? 2 : 1;
  const lines = style.boot;
  lines.forEach((text, i) => {
    const t0 = 0.15 + i * 0.11;
    if (k < t0) return;
    const chars = reduced ? text.length : Math.min(text.length, Math.floor((k - t0) / 0.08 * text.length));
    drawText(buf, W, H, fld.x0 + 10, fld.y0 + 10 + i * (9 * sc), text.slice(0, chars) + (chars < text.length && !reduced ? '_' : ''), pack(i === lines.length - 1 ? fg : style.dim), { scale: sc, shadow: 0 });
  });
  const name = `${dev.long.toUpperCase()}`;
  if (k > 0.6) drawText(buf, W, H, fld.x1 - textWidth(name) - 10, fld.y1 - 16, name, pack(fg), { shadow: 0 });
}

function drawGate(buf, W, H, opts) {
  const { cam, view, style, t } = opts;
  const hit = opts.gateway.hit ?? 0;
  const c = hit > 0 ? (opts.gateway.hitTone === 'bad' ? style.bad : style.good) : style.fg;
  // A ring lying flat over the roof, turning: the rule the packets hit.
  const n = 10, R = 0.5 + hit * 0.15, rot = t * 0.8;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    pts.push(projectPoint(cam, view, W, { x: AR_GATE.x + Math.cos(a) * R, z: AR_GATE.z + Math.sin(a) * R, y: AR_GATE.y }));
  }
  for (let i = 0; i < n; i++) {
    const p0 = pts[i], p1 = pts[i + 1];
    if (!p0.front || !p1.front || (!onScreen(p0, W, H) && !onScreen(p1, W, H))) continue;
    line(buf, W, H, p0.x, p0.y, p1.x, p1.y, c, i % 2 ? 0.5 : 0.95);
  }
  const mid = projectPoint(cam, view, W, AR_GATE);
  if (hit > 0 && onScreen(mid, W, H)) blob(buf, W, H, null, mid.x, mid.y, mid.dz, Math.max(2, 0.18 * view.F / mid.dz) * hit, c, { glow: hit, test: false });
}

const TONES = { owner: [90, 220, 255], radio: [200, 255, 90], stranger: [255, 80, 230], pass: [110, 255, 140], leak: [255, 40, 30], block: [255, 110, 40], denied: [255, 190, 40] };
function drawPackets(buf, W, H, opts, dev, fld) {
  const { cam, view, depth, flights, reduced } = opts;
  for (const f of flights) {
    const c = TONES[f.tone] ?? TONES.stranger;
    if (f.stage === 'shatter') {
      if (reduced) {
        const pt = projectPoint(cam, view, W, f);
        if (onScreen(pt, W, H)) { const s = Math.max(2, 0.12 * view.F / pt.dz); line(buf, W, H, pt.x - s, pt.y - s, pt.x + s, pt.y + s, c); line(buf, W, H, pt.x - s, pt.y + s, pt.x + s, pt.y - s, c); }
        continue;
      }
      for (const s of f.shards) {
        const pt = projectPoint(cam, view, W, s);
        if (!onScreen(pt, W, H)) continue;
        blob(buf, W, H, depth, pt.x, pt.y, pt.dz, Math.max(1, 0.035 * view.F / pt.dz), c, { glow: 1 - f.k });
      }
      continue;
    }
    const pt = projectPoint(cam, view, W, f);
    if (!onScreen(pt, W, H, 4)) continue;
    const r = Math.min(H * 0.03, Math.max(1.8, 0.14 * view.F / pt.dz)) * (f.stage === 'in' ? 1 - f.k * 0.6 : 1);
    for (const tr of f.trail ?? []) {
      const q = projectPoint(cam, view, W, tr);
      if (onScreen(q, W, H)) blob(buf, W, H, depth, q.x, q.y, q.dz, Math.max(1, r * (0.35 + tr.w * 0.4)), c, { glow: 0.25 + tr.w * 0.4 });
    }
    blob(buf, W, H, depth, pt.x, pt.y, pt.dz, r, c, { glow: 1 });
    if (f.stage === 'fly' && pt.dz < 7 && pt.x > fld.x0 && pt.x < fld.x1) {
      const label = dev.rich ? `${f.p.src}:${f.p.cmd}:${f.p.key || '-'}` : f.p.cmd;
      drawText(buf, W, H, Math.round(pt.x - textWidth(label) / 2), Math.round(pt.y - r * 2 - 9), label, pack(c), { shadow: 0xff000000 });
    }
  }
}

// Pure layout: boxes placed in priority order, each pushed below (or above)
// whatever it would cover. items: [{ x, y, w, h }] desired; returns [{x,y}].
export function layoutBoxes(items, fld) {
  const placed = [];
  const hits = (x, y, it) => placed.find((p) => x < p.x + p.w + 2 && x + it.w + 2 > p.x && y < p.y + p.h + 2 && y + it.h + 2 > p.y);
  const fits = (x, y, it) => x >= fld.x0 && x + it.w <= fld.x1 && y >= fld.y0 && y + it.h <= fld.y1;
  for (const it of items) {
    let { x, y } = it;
    for (let n = 0; n < 12; n++) {
      const hit = hits(x, y, it);
      if (!hit) break;
      const cands = [[x, hit.y + hit.h + 3], [x, hit.y - it.h - 3], [hit.x + hit.w + 3, y], [hit.x - it.w - 3, y]];
      const free = cands.find(([cx, cy]) => fits(cx, cy, it) && !hits(cx, cy, it)) ?? cands.find(([cx, cy]) => fits(cx, cy, it));
      if (!free) break;
      [x, y] = free;
    }
    placed.push({ x, y, w: it.w, h: it.h });
  }
  return placed;
}

function drawTags(buf, W, H, opts, dev, fld) {
  const { cam, view, depth, style, t, tags } = opts;
  const list = [];
  for (const item of tags) {
    const pt = projectPoint(cam, view, W, item.tag);
    if (!pt.front || pt.dz > 10.5) continue;
    if (pt.x < fld.x0 || pt.x >= fld.x1 || pt.y < fld.y0 || pt.y >= fld.y1) continue;
    list.push({ ...item, pt });
  }
  // Priority: the thing under the crosshair, then the nearest.
  list.sort((a, b) => (b.target - a.target) || (a.pt.dz - b.pt.dz));
  const tiny = H < 150;
  // Keep clear of the status line along the top of the field.
  const area = { ...fld, y0: fld.y0 + 10 + 7 * (H >= 300 ? 2 : 1) };
  const maxChars = Math.max(8, Math.floor((fld.x1 - fld.x0 - 14) / 6));
  const shown = list.slice(0, tiny ? Math.min(3, dev.tagLimit) : dev.tagLimit);
  const boxes = shown.map((it) => {
    const j = deviceJitter(dev.n, t, it.tag.id.length + it.tag.x);
    const ax = Math.round(it.pt.x + j.dx), ay = Math.round(it.pt.y + j.dy);
    const full = it.target || dev.rich;
    const ro = it.readout.lines;
    // A tiny (Wolfenstein) frame: titles only, unless you look right at it.
    let lines = tiny ? [it.tag.title, ...(it.target ? ro : [])] : [it.tag.title, ...(full ? ro : ro.slice(-1))];
    if (dev.rich) lines.push(`${it.pt.dz.toFixed(1)} М`);
    if (it.target && it.tag.edit) lines.push(tiny ? 'E · КОД' : 'E · ГОЛО-РЕДАКТОР');
    lines = lines.map((l) => (l.length > maxChars ? `${l.slice(0, maxChars - 1)}.` : l));
    const w = Math.min(fld.x1 - fld.x0 - 8, Math.max(...lines.map((l) => textWidth(l))) + 8);
    const h = lines.length * 9 + 4;
    let bx = ax + 8, by = ay - h - 8;
    if (bx + w > fld.x1 - 2) bx = ax - w - 8;
    bx = Math.max(fld.x0 + 2, Math.min(fld.x1 - w - 2, bx));
    by = Math.max(area.y0, Math.min(fld.y1 - h - 2, by));
    return { it, ax, ay, lines, x: bx, y: by, w, h };
  });
  const placed = layoutBoxes(boxes, area);
  for (let n = boxes.length - 1; n >= 0; n--) {
    const { it, ax, ay, lines, w, h } = boxes[n];
    const { x: bx, y: by } = placed[n];
    const hidden = occluded(it.pt, depth, W, H);
    const tone = it.readout.tone === 'bad' ? style.bad : it.readout.tone === 'ok' ? style.good : style.fg;
    const a = hidden ? 0.45 : 1;
    rectFill(buf, W, H, bx, by, w, h, style.bg, Math.min(0.92, style.fill + (it.target ? 0.2 : 0)) * a);
    rectLine(buf, W, H, bx, by, w, h, hidden ? style.dim : tone, it.target ? 2 : 1);
    line(buf, W, H, ax, ay, bx + (bx > ax ? 0 : w - 1), by + (by > ay ? 0 : h - 1), hidden ? style.dim : tone, 0.8 * a);
    for (let d = -2; d <= 2; d++) { put(buf, W, H, ax + d, ay - (2 - Math.abs(d)), pack(tone)); put(buf, W, H, ax + d, ay + (2 - Math.abs(d)), pack(tone)); }
    lines.forEach((l, i) => drawText(buf, W, H, bx + 4, by + 3 + i * 9, l, pack(i === 0 ? tone : hidden ? style.dim : style.fg), { shadow: 0 }));
    // A cheap headset's holo text: every other row dimmed (low-res panel).
    if (dev.lowRes) for (let y = by + 1; y < by + h - 1; y += 2) for (let x = bx + 1; x < bx + w - 1; x++) if (y >= 0 && y < H && x >= 0 && x < W) mix(buf, y * W + x, style.bg, 0.3);
  }
}

// The holo reticle around the crosshair while the headset is on.
export function drawReticle(buf, W, viewH, style, hot) {
  const cx = Math.round(W / 2), cy = Math.round(viewH / 2), r = 7;
  const c = hot ? style.good : style.fg;
  for (let a = 0; a < 24; a++) {
    if (a % 6 === 5) continue;
    const ang = (a / 24) * Math.PI * 2;
    const x = Math.round(cx + Math.cos(ang) * r), y = Math.round(cy + Math.sin(ang) * r);
    if (x >= 0 && y >= 0 && x < W && y < viewH) mix(buf, y * W + x, c, 0.9);
  }
}
