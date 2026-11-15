// ЛЁД-64 · a unit's badge draws its move (Сергей 26.10: names on the board in 10 px are «мелко»):
//   rook  — a cross to the edges        bishop — a diagonal cross
//   knight — an «Г» with a dot at its end   pawn — one short step forward (and two dots: where it takes)
//   king  — a ring and eight dots (one step any way)   queen — a long 8-ray star (the puzzles' piece)
// One function for the board, the legend and the 40-pixel distinctness test. Pure canvas drawing.

export function drawPlate(ctx, cx, cy, size, { fill, stroke }) {
  const r = size / 2, k = size * 0.18;
  ctx.beginPath();
  ctx.moveTo(cx - r + k, cy - r); ctx.lineTo(cx + r - k, cy - r); ctx.quadraticCurveTo(cx + r, cy - r, cx + r, cy - r + k);
  ctx.lineTo(cx + r, cy + r - k); ctx.quadraticCurveTo(cx + r, cy + r, cx + r - k, cy + r);
  ctx.lineTo(cx - r + k, cy + r); ctx.quadraticCurveTo(cx - r, cy + r, cx - r, cy + r - k);
  ctx.lineTo(cx - r, cy - r + k); ctx.quadraticCurveTo(cx - r, cy - r, cx - r + k, cy - r);
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = Math.max(1.5, size * 0.07); ctx.strokeStyle = stroke; ctx.stroke();
}

// chess: 'rook'|'bishop'|'knight'|'pawn'|'king'|'queen'; dir: +1 = forward is up (blue), −1 = down (red).
export function drawGlyph(ctx, chess, cx, cy, size, color, dir = 1) {
  const r = size * 0.36, w = Math.max(2, size * 0.13);
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const line = (x0, y0, x1, y1) => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
  const dot = (x, y, d) => { ctx.beginPath(); ctx.arc(x, y, d, 0, Math.PI * 2); ctx.fill(); };
  if (chess === 'rook') { line(cx - r, cy, cx + r, cy); line(cx, cy - r, cx, cy + r); }
  else if (chess === 'bishop') { const d = r * 0.86; line(cx - d, cy - d, cx + d, cy + d); line(cx + d, cy - d, cx - d, cy + d); }
  else if (chess === 'knight') {
    // up two, right one: the «Г», mirrored for red so its foot points the way it faces
    const s = dir > 0 ? 1 : -1;
    ctx.beginPath(); ctx.moveTo(cx - r * 0.45, cy + r * s); ctx.lineTo(cx - r * 0.45, cy - r * s); ctx.lineTo(cx + r * 0.55, cy - r * s); ctx.stroke();
    dot(cx + r * 0.55, cy - r * s, w * 0.9);
  } else if (chess === 'pawn') {
    const s = dir > 0 ? -1 : 1; // screen y of «forward»
    line(cx, cy + r * 0.5 * -s, cx, cy + r * 0.35 * s);
    ctx.beginPath(); ctx.moveTo(cx - r * 0.5, cy + r * 0.0 * s); ctx.lineTo(cx, cy + r * 0.55 * s); ctx.lineTo(cx + r * 0.5, cy + r * 0.0 * s); ctx.stroke();
    dot(cx - r * 0.85, cy + r * 0.75 * s, w * 0.6); dot(cx + r * 0.85, cy + r * 0.75 * s, w * 0.6);
  } else if (chess === 'king') {
    // a ring and eight dots: one step any way (the queen's long rays are the other «any way»)
    ctx.lineWidth = w; ctx.beginPath(); ctx.arc(cx, cy, r * 0.42, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 8; i++) { const a = Math.PI / 4 * i; dot(cx + Math.cos(a) * r * 0.92, cy + Math.sin(a) * r * 0.92, w * 0.55); }
  } else if (chess === 'queen') {
    for (let i = 0; i < 4; i++) { const a = Math.PI / 4 * i; line(cx - Math.cos(a) * r, cy - Math.sin(a) * r, cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
    dot(cx, cy, w * 1.1);
  }
  ctx.restore();
}
