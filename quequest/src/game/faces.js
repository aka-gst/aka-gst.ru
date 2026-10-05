// 18.0: faces (Сергей 03.10: «лицо начальника перерисовать — смешнее и
// мерзотнее; каждому персонажу в комнате уникальное лицо и одежду»).
//
// Pixel portraits drawn in code on a 32×32 grid, so they stay in the game's
// pixel style and can be re-tuned without binaries. Each person has their own
// skin, hair, face features, accessory and collar. The boss is the worst of
// them on purpose: shiny forehead, comb-over, unibrow, beady eyes, a red nose
// with a hairy wart, a crumb-filled moustache, a gold tooth, a double chin,
// sweat, a too-tight tie with a stain.
export const FACES = Object.freeze({
  boss: { skin: '#e2a383', shade: '#b8775c', hair: '#3b2a1c', name: 'НАЧАЛЬНИК' },
  welder: { skin: '#c98d62', shade: '#9a6644', hair: '#2a2420', name: 'СВАРЩИК' },
  fitter: { skin: '#f0c49c', shade: '#c79772', hair: '#b5652a', name: 'СЛЕСАРЬ' },
  electrician: { skin: '#a8724f', shade: '#7c5237', hair: '#141414', name: 'ЭЛЕКТРИК' },
  lunch: { skin: '#f2b896', shade: '#cf8f70', hair: '#d8d0c0', name: 'ГРУЗЧИК' },
  radio: { skin: '#e2a383', shade: '#b8775c', hair: '#3b2a1c', name: 'РАЦИЯ' },
  hero: { skin: '#e8b48e', shade: '#c08a66', hair: '#5a3a22', name: 'ТЫ' },
});

// Which portrait a speaker label belongs to.
export function faceIdFor(speaker = '') {
  const s = String(speaker).toUpperCase();
  if (s.includes('НАЧАЛЬНИК') || s.includes('ДВЕР')) return 'boss';
  if (s.includes('РАЦИЯ')) return 'radio';
  if (s.includes('СВАРЩИК')) return 'welder';
  if (s.includes('СЛЕСАРЬ')) return 'fitter';
  if (s.includes('ЭЛЕКТРИК')) return 'electrician';
  if (s.includes('ГРУЗЧИК')) return 'lunch';
  if (s.startsWith('ТЫ')) return 'hero';
  return null;
}

// px(x, y, color) / rect / ellipse on a 32×32 grid.
function painter(ctx, s) {
  const px = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(x * s, y * s, s, s); };
  const rect = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x * s, y * s, w * s, h * s); };
  const ell = (cx, cy, rx, ry, c) => {
    ctx.fillStyle = c;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) ctx.fillRect(x * s, y * s, s, s);
    }
  };
  return { px, rect, ell };
}

export function drawFace(canvas, id, { mood = 'talk', frame = 0 } = {}) {
  const f = FACES[id] ?? FACES.boss;
  const ctx = canvas.getContext('2d');
  const s = Math.max(1, Math.floor(canvas.width / 32));
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const { px, rect, ell } = painter(ctx, s);
  const bg = { hero: '#0b2a33', boss: '#3a1d1d', radio: '#1b2a2f', welder: '#2b2118', fitter: '#16233a', electrician: '#24282a', lunch: '#1f2d1c' }[id] ?? '#222';
  rect(0, 0, 32, 32, bg);
  const open = mood === 'angry' || frame % 2 === 1;

  if (id === 'boss' || id === 'radio') {
    // Body: stained white shirt, tight red tie, yellow vest edges.
    rect(3, 26, 26, 6, '#d6d0b8'); rect(3, 26, 4, 6, '#d8d43c'); rect(25, 26, 4, 6, '#d8d43c');
    rect(14, 26, 4, 6, '#b3161b'); px(15, 28, '#7a0f12'); px(16, 30, '#6b5a1a');
    // Double chin and a fat round head.
    ell(16, 23.5, 8.5, 3.6, f.shade);
    ell(16, 15.5, 10.5, 10, mood === 'angry' ? '#e9806a' : f.skin);
    ell(9.5, 18, 2.6, 2.4, '#e88c80'); ell(22.5, 18, 2.6, 2.4, '#e88c80');
    // Shiny forehead + sweat.
    px(13, 8, '#fff2df'); px(14, 8, '#fff2df'); px(14, 7, '#fff2df');
    px(25, 12, '#9fd8ff'); px(25, 13, '#9fd8ff'); px(6, 14, '#9fd8ff');
    // Comb-over: three greasy strands.
    for (const [x, y] of [[9, 7], [10, 6], [11, 6], [12, 5], [13, 5], [14, 5], [15, 5], [16, 5], [17, 5], [18, 6], [19, 6], [20, 7]]) px(x, y, f.hair);
    for (const [x, y] of [[8, 8], [9, 8], [10, 7], [21, 7], [22, 8], [23, 9]]) px(x, y, f.hair);
    // Unibrow and beady eyes.
    rect(10, 12, 12, 1, '#2a1a10'); px(15, 11, '#2a1a10'); px(16, 11, '#2a1a10');
    rect(11, 14, 3, 2, '#fff8ec'); rect(18, 14, 3, 2, '#fff8ec');
    px(mood === 'angry' ? 13 : 12, 14, '#111'); px(mood === 'angry' ? 18 : 19, 14, '#111');
    if (mood === 'angry') {
      // V-brows, a forehead vein, steam from the ears.
      rect(10, 12, 12, 1, mood === 'angry' ? '#e9806a' : f.skin);
      for (const [x, y] of [[10, 10], [11, 11], [12, 11], [13, 12], [14, 12], [17, 12], [18, 12], [19, 11], [20, 11], [21, 10]]) px(x, y, '#2a1a10');
      px(18, 8, '#9a2030'); px(19, 9, '#9a2030'); px(18, 10, '#9a2030');
      for (const [x, y] of [[3, 12], [2, 10], [3, 8], [28, 12], [29, 10], [28, 8]]) px(x, y, '#e8e8e8');
    }
    // Huge red nose with a hairy wart.
    ell(16, 17.5, 2.6, 2.2, '#d6545a'); px(15, 16, '#ff9a9a'); px(18, 19, '#5a3a20'); px(19, 20, '#111');
    // Moustache with crumbs.
    rect(11, 20, 10, 2, '#3b2a1c'); px(10, 21, '#3b2a1c'); px(21, 21, '#3b2a1c');
    px(13, 21, '#e8d29a'); px(18, 20, '#e8d29a');
    // Mouth: open, a gold tooth, spit.
    if (open) { rect(13, 22, 6, 3, '#4a0d10'); px(14, 22, '#f0e8d0'); px(17, 22, '#ffd23c'); px(16, 24, '#c03040'); px(21, 23, '#cfe8ff'); }
    else { rect(13, 23, 6, 1, '#6a1a1a'); px(17, 23, '#ffd23c'); }
    // Ears.
    ell(5.5, 16, 1.4, 2.2, f.shade); ell(26.5, 16, 1.4, 2.2, f.shade);
    if (id === 'radio') { rect(0, 0, 32, 32, '#0008'); rect(22, 2, 8, 14, '#1c1c1c'); rect(23, 3, 6, 5, '#3b5b44'); px(29, 0, '#999'); px(29, 1, '#999'); }
    return canvas;
  }

  if (id === 'hero') {
    // 18.1: you, the moment the chip shows you the future: eyes wide, brows
    // up, mouth an «О», a drop of sweat, cyan light from the chip on the face.
    rect(4, 26, 24, 6, '#3b4a5a');
    ell(16, 15.5, 8, 9.5, f.skin);
    ell(16, 6.5, 8.5, 3.6, f.hair); rect(8, 5, 4, 4, f.hair); rect(21, 6, 3, 3, f.hair);
    ell(8, 16, 1.3, 2, f.shade); ell(24, 16, 1.3, 2, f.shade);
    rect(10, 10, 4, 1, f.hair); rect(18, 10, 4, 1, f.hair);
    rect(10, 12, 4, 4, '#fff'); rect(18, 12, 4, 4, '#fff');
    rect(11, 13, 2, 2, '#1a2a3a'); rect(19, 13, 2, 2, '#1a2a3a'); px(11, 13, '#9ff4ff'); px(19, 13, '#9ff4ff');
    rect(15, 17, 2, 2, f.shade);
    ell(16, 22.5, 2.2, 2.4, '#3a0d0d'); ell(16, 22.5, 1.2, 1.4, '#1a0505');
    px(24, 11, '#9fd8ff'); px(24, 12, '#9fd8ff');
    for (const [x, y] of [[6, 20], [7, 22], [25, 21], [26, 19]]) px(x, y, '#64e9ff');
    return canvas;
  }
  // Workers: shared build, own features.
  const collar = { welder: '#5a3a22', fitter: '#2f3f68', electrician: '#5c6366', lunch: '#2f5a2e' }[id];
  rect(4, 26, 24, 6, collar);
  ell(16, 15.5, 8, 9.5, f.skin);
  ell(8, 16, 1.3, 2, f.shade); ell(24, 16, 1.3, 2, f.shade);
  const eyes = (y = 14) => { rect(11, y, 3, 2, '#fff'); rect(18, y, 3, 2, '#fff'); px(12, y, '#151515'); px(19, y, '#151515'); };
  const mouth = (c = '#6a2a1a') => { if (open) { rect(14, 21, 4, 2, '#3a0d0d'); px(15, 21, '#eee'); } else rect(14, 22, 4, 1, c); };
  if (id === 'welder') {
    // Welding mask pushed up, soot, stubble, scar.
    rect(7, 3, 18, 6, '#30343a'); rect(10, 5, 12, 2, '#1a3a40'); px(12, 5, '#7fe0ff');
    rect(10, 12, 4, 1, '#222'); rect(18, 12, 4, 1, '#222'); eyes();
    rect(15, 16, 2, 3, f.shade);
    for (let x = 10; x < 23; x += 2) px(x, 23, '#5b4636');
    px(21, 17, '#d79a8a'); px(22, 18, '#d79a8a'); px(9, 19, '#333'); px(23, 13, '#333');
    mouth();
  } else if (id === 'fitter') {
    // Ginger beard, flat cap, wrench pencil behind the ear.
    rect(7, 5, 18, 4, '#3a4a6a'); rect(5, 8, 22, 1, '#2a3550');
    rect(10, 12, 4, 1, f.hair); rect(18, 12, 4, 1, f.hair); eyes();
    rect(15, 16, 2, 3, f.shade);
    ell(16, 22, 7, 3.2, f.hair); if (open) { rect(14, 21, 4, 2, '#3a0d0d'); } else rect(14, 21, 4, 1, '#7a3a14');
    rect(24, 10, 1, 6, '#9aa0a8');
  } else if (id === 'electrician') {
    // Yellow hard hat, round glasses, neat moustache.
    ell(16, 6.5, 9, 4, '#e0b520'); rect(6, 8, 20, 2, '#c99f12'); px(12, 5, '#fff3a0');
    rect(10, 13, 4, 4, '#222'); rect(18, 13, 4, 4, '#222'); rect(11, 14, 2, 2, '#bfe8ff'); rect(19, 14, 2, 2, '#bfe8ff'); rect(14, 14, 4, 1, '#222');
    px(12, 15, '#111'); px(20, 15, '#111');
    rect(15, 17, 2, 2, f.shade);
    rect(12, 20, 8, 1, f.hair);
    mouth();
  } else if (id === 'lunch') {
    // Chubby, grey hair, cheeks full of sandwich, crumbs, a sandwich in hand.
    ell(16, 6, 8, 3, f.hair); ell(16, 17, 9, 9, f.skin);
    ell(10, 19, 2.4, 2.2, '#f08f80'); ell(22, 19, 2.4, 2.2, '#f08f80');
    rect(11, 13, 3, 1, '#9a8f80'); rect(18, 13, 3, 1, '#9a8f80');
    rect(11, 15, 3, 1, '#151515'); rect(18, 15, 3, 1, '#151515');
    rect(15, 17, 2, 2, f.shade);
    ell(16, 22.5, 2.5, 1.6, '#7a2a20'); px(13, 24, '#e8d29a'); px(19, 25, '#e8d29a');
    rect(20, 24, 9, 4, '#e8c27a'); rect(20, 25, 9, 1, '#5aa04a'); rect(20, 26, 9, 1, '#d0605a');
  }
  return canvas;
}

// A portrait element for a DOM dialogue: <canvas class="face"> (64×64, crisp).
export function faceCanvas(id, opts = {}) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  c.className = 'face';
  c.dataset.face = id;
  c.setAttribute('aria-hidden', 'true');
  drawFace(c, id, opts);
  return c;
}
