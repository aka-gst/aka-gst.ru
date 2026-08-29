/*
 * Пробная поездка — награда за пройденные шаги в истории «Ночь в боксе».
 *
 * Смысл не в игре как таковой: игру рядом с курсом сделать легко, и она была бы
 * просто отвлечением. Смысл в связи. Тяга и сцепление машины взяты из числа
 * пройденных шагов ночи: чем больше прошивки собрано, тем дальше она едет.
 * Поэтому поездка не заменяет учёбу, а показывает её результат — то же, что
 * человек делает в реальном тюнинге: правит карту и едет проверять.
 *
 * Всё рисуется на canvas без единой внешней библиотеки. Дорога — обычная
 * псевдотрёхмерная развёртка: сегменты от горизонта к низу экрана, каждый
 * проецируется на свою ширину и смещение.
 */

import { lessons } from '../content/index.js';
import { lessonState } from '../store.js';
import { activeTheme } from '../content/themes.js';
import { el, $ } from './dom.js';

const BEST_KEY = 'qa-quest.rig.best';

/** Сколько шагов ночи пройдено — от этого зависит вся машина. */
export function rigProgress() {
  const theme = activeTheme();
  const own = lessons.filter((lesson) => theme.lessons.some((item) => item.id === lesson.id));
  const done = own.filter((lesson) => lessonState(lesson).complete).length;
  return { done, total: own.length };
}

function readBest() {
  try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch (_) { return 0; }
}

function writeBest(value) {
  try { localStorage.setItem(BEST_KEY, String(Math.round(value))); } catch (_) { /* приватный режим */ }
}

/* ---------- трасса ---------- */

const SEG_LEN = 200;
const ROAD_W = 1500;
const DRAW = 90;
const CAM_D = 0.84;
/* Высота камеры над полотном. Без неё проекция вырождается: все полосы
   сходятся в горизонт и дороги на экране просто нет — так и было в первой
   версии, пока рендер не показал пустой кадр. */
const CAM_H = 1000;
/* Машина едет впереди камеры, а не в ней. Без этого ближние сегменты
   оказываются вплотную к объективу, разъезжаются шире экрана и дорога у
   нижнего края превращается в однотонное пятно. */
const PLAYER_Z = CAM_H * CAM_D;
/* Горизонт выше середины кадра: если он ровно посередине, дороги видно
   полоску в восемьдесят пикселей, а половину экрана занимает пустое небо. */
const HORIZON = 0.42;
const TRACK_LEN = 1400;

/* Своё случайное с зерном: трасса у всех одинаковая, и сравнить результат с
   другом можно честно. Math.random дал бы каждому свою дорогу. */
function seeded(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function buildTrack() {
  const rnd = seeded(20260829);
  const segments = [];
  let curve = 0;
  for (let i = 0; i < TRACK_LEN; i += 1) {
    // Повороты меняются плавно и редко: резкая смена на телефоне читается
    // как рывок картинки, а не как поворот.
    if (i % 40 === 0) curve = (rnd() - 0.5) * 5.5;
    const mud = i > 60 && rnd() < 0.09
      ? { x: (rnd() - 0.5) * 1.4, w: 0.34 + rnd() * 0.22 }
      : null;
    segments.push({ curve, mud });
  }
  return segments;
}

/* ---------- сама поездка ---------- */

export function openRig() {
  const dialog = $('rigDialog');
  // Второе открытие поверх первого — это исключение от showModal и мёртвый
  // диалог до перезагрузки. Дешевле не пустить.
  if (dialog.open) return;
  const canvas = $('rigCanvas');
  const hud = $('rigHud');
  const verdict = $('rigVerdict');
  const ctx = canvas.getContext('2d');

  const { done, total } = rigProgress();
  // Голая машина едет, но плохо: даже нулевая прошивка должна доехать хоть
  // куда-то, иначе первая же поездка выглядит как поломка, а не как задел.
  const power = 0.45 + 0.55 * (done / total);
  const grip = 0.5 + 0.5 * (done / total);

  const segments = buildTrack();
  let pos = 0;
  let playerX = 0;
  let speed = 0;
  let steer = 0;
  let running = true;
  let frame = null;
  let last = 0;
  let best = readBest();
  let finished = false;

  const maxSpeed = 320 * power;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function project(worldX, dz, width, height) {
    const scale = CAM_D / Math.max(dz, 1);
    return {
      x: width / 2 - scale * worldX * width / 2,
      y: height * HORIZON + scale * CAM_H * height / 2,
      w: scale * ROAD_W * width / 2,
    };
  }

  function draw(width, height) {
    // Небо и земля. Гаражная ночь — тёплая, поэтому земля уходит в бурый,
    // а не в синий, как у истории про сеть.
    const sky = ctx.createLinearGradient(0, 0, 0, height * HORIZON);
    sky.addColorStop(0, '#0a0f16');
    sky.addColorStop(1, '#1a1a17');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height * HORIZON);
    ctx.fillStyle = '#07090c';
    ctx.fillRect(0, height * HORIZON, width, height * (1 - HORIZON));

    const base = Math.floor(pos / SEG_LEN);
    let camX = playerX * ROAD_W / 2;
    let dx = 0;
    let x = 0;
    let prev = null;

    for (let n = 0; n < DRAW; n += 1) {
      const seg = segments[(base + n) % segments.length];
      const dz = PLAYER_Z + (n * SEG_LEN) - (pos % SEG_LEN);
      dx += seg.curve;
      x += dx;
      const p = project(camX - x, dz, width, height);
      if (prev && p.y < prev.y) {
        const light = ((base + n) >> 2) % 2 === 0;
        // Полотно
        ctx.fillStyle = light ? '#2f2a20' : '#26221a';
        ctx.beginPath();
        ctx.moveTo(prev.x - prev.w, prev.y);
        ctx.lineTo(prev.x + prev.w, prev.y);
        ctx.lineTo(p.x + p.w, p.y);
        ctx.lineTo(p.x - p.w, p.y);
        ctx.fill();
        // Обочина
        ctx.fillStyle = light ? '#4a3c24' : '#33291a';
        const edge = Math.max(2, prev.w * 0.07);
        ctx.fillRect(prev.x + prev.w, p.y, edge, Math.max(1, prev.y - p.y));
        ctx.fillRect(prev.x - prev.w - edge, p.y, edge, Math.max(1, prev.y - p.y));
        // Прерывистая осевая: без неё ночью не видно, что ты вообще едешь.
        if (light) {
          ctx.fillStyle = 'rgba(255, 209, 102, .22)';
          ctx.fillRect(prev.x - prev.w * 0.012, p.y, Math.max(1, prev.w * 0.024), Math.max(1, prev.y - p.y));
        }
        // Грязь
        if (seg.mud) {
          ctx.fillStyle = 'rgba(38, 30, 20, .92)';
          const mx = p.x + seg.mud.x * p.w;
          ctx.fillRect(mx - p.w * seg.mud.w / 2, p.y, Math.max(2, p.w * seg.mud.w), Math.max(2, prev.y - p.y));
        }
      }
      prev = p;
    }

    // Свет фар: узкий тёплый конус, чтобы ночь читалась ночью.
    const beam = ctx.createRadialGradient(width / 2, height * 0.92, 10, width / 2, height * 0.92, height * 0.72);
    beam.addColorStop(0, 'rgba(255, 209, 102, .10)');
    beam.addColorStop(1, 'rgba(255, 209, 102, 0)');
    ctx.fillStyle = beam;
    ctx.fillRect(0, 0, width, height);

    // Машина: силуэт, а не картинка. Рисованный кузов на канвасе выглядел бы
    // хуже фотографии, а фотография не поворачивается вместе с дорогой.
    const cw = width * 0.22;
    const ch = cw * 0.44;
    const cx = width / 2 + playerX * width * 0.07;
    const cy = height * 0.97;
    ctx.fillStyle = '#0b0d10';
    ctx.fillRect(cx - cw / 2, cy - ch, cw, ch);
    ctx.fillStyle = '#151a1f';
    ctx.fillRect(cx - cw / 2 + cw * 0.1, cy - ch - ch * 0.5, cw * 0.8, ch * 0.5);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(cx - cw / 2 + cw * 0.06, cy - ch * 0.72, cw * 0.14, ch * 0.16);
    ctx.fillRect(cx + cw / 2 - cw * 0.2, cy - ch * 0.72, cw * 0.14, ch * 0.16);
  }

  function step(now) {
    if (!running) return;
    const dt = Math.min((now - (last || now)) / 1000, 0.05);
    last = now;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    const seg = segments[Math.floor(pos / SEG_LEN) % segments.length];
    const offRoad = Math.abs(playerX) > 1;
    const inMud = seg.mud && Math.abs(playerX - seg.mud.x) < seg.mud.w;

    const target = offRoad ? maxSpeed * 0.34 : (inMud ? maxSpeed * 0.55 : maxSpeed);
    speed += (target - speed) * dt * (speed < target ? 0.8 : 3.2);

    playerX += steer * dt * 1.7 * grip;
    // Центробежная: на скорости поворот сносит наружу, и это единственное, что
    // заставляет держать руль, а не зажать одну сторону.
    playerX -= seg.curve * (speed / maxSpeed) * dt * 0.055;
    playerX = Math.max(-1.9, Math.min(1.9, playerX));

    pos += speed * dt * SEG_LEN * 0.06;
    const metres = Math.round(pos / SEG_LEN * 4);

    resizeIfNeeded(width, height);
    draw(canvas.clientWidth, canvas.clientHeight);

    hud.textContent = `${metres} м · ${Math.round(speed)} км/ч`
      + (offRoad ? ' · обочина' : inMud ? ' · грязь' : '');

    if (metres >= 2000 && !finished) {
      finished = true;
      stop(`Груз доставлен. 2000 метров, прошивка на ${done} из ${total} шагов.`);
      return;
    }
    frame = requestAnimationFrame(step);
  }

  let lastW = 0;
  let lastH = 0;
  function resizeIfNeeded(width, height) {
    if (width === lastW && height === lastH) return;
    lastW = width;
    lastH = height;
    resize();
  }

  function stop(message) {
    running = false;
    cancelAnimationFrame(frame);
    const metres = Math.round(pos / SEG_LEN * 4);
    if (metres > best) {
      best = metres;
      writeBest(metres);
    }
    verdict.hidden = false;
    verdict.textContent = message || `Остановился на ${metres} м. Лучшее: ${best} м.`;
  }

  /* ---------- управление ---------- */

  const setSteer = (value) => { steer = value; };
  const onKeyDown = (event) => {
    if (event.key === 'ArrowLeft') setSteer(-1);
    if (event.key === 'ArrowRight') setSteer(1);
  };
  const onKeyUp = (event) => {
    if (event.key === 'ArrowLeft' && steer < 0) setSteer(0);
    if (event.key === 'ArrowRight' && steer > 0) setSteer(0);
  };
  const onPointer = (event) => {
    const rect = canvas.getBoundingClientRect();
    setSteer(event.clientX - rect.left < rect.width / 2 ? -1 : 1);
  };

  // Все подписки живут ровно одну поездку. Холст в разметке постоянный, и без
  // общего отзыва каждое открытие вешало бы на него ещё один комплект
  // обработчиков — к десятой поездке руль слушали бы десять раз подряд.
  const trip = new AbortController();
  const on = { signal: trip.signal };
  window.addEventListener('keydown', onKeyDown, on);
  window.addEventListener('keyup', onKeyUp, on);
  canvas.addEventListener('pointerdown', onPointer, on);
  canvas.addEventListener('pointermove', (event) => { if (steer !== 0) onPointer(event); }, on);
  canvas.addEventListener('pointerup', () => setSteer(0), on);
  canvas.addEventListener('pointercancel', () => setSteer(0), on);

  // Останавливаем цикл при закрытии: невидимый requestAnimationFrame сажает
  // батарею телефона и греет его молча.
  dialog.addEventListener('close', () => {
    running = false;
    cancelAnimationFrame(frame);
    trip.abort();
  }, { once: true });

  $('rigTuning').textContent = `Прошивка: ${done} из ${total} шагов · тяга ${Math.round(power * 100)}% · сцепление ${Math.round(grip * 100)}%`;
  verdict.hidden = true;
  dialog.showModal();
  resize();
  frame = requestAnimationFrame(step);
}

/** Кнопка на карте. Появляется, когда есть что показывать. */
export function rigButton() {
  const theme = activeTheme();
  if (theme.id !== 'garage') return null;
  const { done, total } = rigProgress();
  if (done < 4) return null;
  return el('button', { class: 'rig-button', onclick: openRig }, [
    el('span', { class: 'rig-button-name', text: 'Пробная поездка' }),
    el('span', { class: 'rig-button-hint', text: `Прошивка на ${done} из ${total} шагов — посмотри, как едет` }),
  ]);
}
