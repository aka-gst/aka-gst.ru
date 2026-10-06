import { buildReplay } from './showcase-replay.js';

const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const status = document.querySelector('#status');
const field = document.querySelector('#frame');
const replay = buildReplay();
let frame = 0, timer = 0, generation = 0;
// Prime both exact renderer assets before importing its Image instances.
await Promise.all(['art/night2-hero.jpg','art/garage-milestone-1.jpg'].map(async src => {
  const image = new Image(); image.src = src; await image.decode();
}));
const { renderGame } = await import('./render.js');
await document.fonts.ready;
await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

function draw(index) {
  frame = Math.max(0, Math.min(replay.frames.length - 1, Math.trunc(index) || 0));
  const sample = replay.frames[frame];
  renderGame(ctx, sample.state, { width:1280, height:720 }, sample.now);
  ctx.save();
  ctx.fillStyle = '#081119e8'; ctx.fillRect(28, 26, 510, 64);
  ctx.font = 'bold 22px monospace'; ctx.fillStyle = '#72ffac';
  ctx.fillText(sample.state.scene === 'prologue' ? 'ЗАЩИТА СИСТЕМЫ / ЗАРАЖЕНИЕ' : `РУЧНАЯ СМЕНА / $${sample.state.warehouse.wage}`, 46, 66);
  ctx.restore();
  field.value = frame;
  status.textContent = `Кадр ${frame}/${replay.frames.length-1} · ${(frame/replay.fps).toFixed(2)} с · ${sample.state.scene === 'prologue' ? 'Защита системы' : 'Перенесено человеком: '+sample.state.warehouse.manualDelivered}`;
  return frame;
}
function pause() { generation++; clearTimeout(timer); }
function seek(index) { pause(); return draw(index); }
function play() {
  pause(); const run = generation; draw(0);
  const next = () => {
    if (run !== generation || frame === replay.frames.length-1) return;
    draw(frame+1); timer = setTimeout(next,1000/replay.fps);
  };
  timer = setTimeout(next,1000/replay.fps);
}
async function digest(bytes) {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2,'0')).join('');
}
async function verify() {
  pause(); const previous = frame;
  const indices = [0,replay.cutFrame,Math.floor(replay.frames.length/2),replay.frames.length-1];
  const passes = [];
  for (let pass=0;pass<2;pass++) {
    const hashes=[];
    for (const index of indices) {
      draw(index);
      hashes.push(await digest(ctx.getImageData(0,0,1280,720).data));
    }
    passes.push(hashes);
  }
  const bytes = ctx.getImageData(0,0,1280,720).data;
  const original = await digest(bytes); bytes[0] ^= 255;
  const negative = original !== await digest(bytes);
  draw(previous);
  const matched = passes[0].every((hash,i) => hash === passes[1][i]);
  status.textContent = `${matched && negative ? 'PASS' : 'FAIL'} · 4 контрольных кадра × 2 повтора: ${matched ? 'RGBA совпадают' : 'расхождение'}; изменённый пиксель: ${negative ? 'обнаружен' : 'НЕ обнаружен'}.\n${passes[0].join(' / ')}`;
  return { indices, hashes: passes, negative, matched };
}
field.max = replay.frames.length-1;
document.querySelector('#first').onclick = () => seek(0);
document.querySelector('#warehouse').onclick = () => seek(replay.cutFrame);
document.querySelector('#last').onclick = () => seek(replay.frames.length-1);
document.querySelector('#play').onclick = play;
document.querySelector('#pause').onclick = pause;
document.querySelector('#verify').onclick = verify;
field.oninput = () => seek(Number(field.value));
field.onchange = () => seek(Number(field.value));
document.addEventListener('visibilitychange', () => { if(document.hidden) pause(); });
document.querySelector('#receipt').textContent = `1280×720 · ${replay.fps} кадров/с · ${replay.durationMs/1000} с · переход на склад: кадр ${replay.cutFrame}. Две доставки через движок → 2 400 ₽; роборука выключена.`;
window.__QUEQUEST_REPLAY__ = Object.freeze({ seek, play, pause, verify, fps:replay.fps, frameCount:replay.frames.length, cutFrame:replay.cutFrame, width:1280, height:720, durationMs:replay.durationMs });
seek(Number(new URL(location.href).searchParams.get('frame')) || 0);
