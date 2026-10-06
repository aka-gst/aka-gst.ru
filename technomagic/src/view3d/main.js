/*
 * ТЕХНОМАГИЯ — объёмный вид (vid.html), второй заход: решение Сергея
 * 03.10 (docs/ЕВГЕНИЙ-ЛЕСТНИЦА-2026-10-03.md §7).
 *
 *   vid.html?level=yadro              изометрия как в UO — основной вид
 *   vid.html?level=lestnica           «Башня» (64×48)
 *   vid.html?cam=bg3                  пилотная перспектива, для сравнения
 *   &step=0..3  &zoom=-0.35..1        ракурс и приближение сразу
 *   &persp=1                          лёгкая перспектива на крупном плане
 *   &punch=1                          наезд камеры, когда мир изменился
 *   &massa=0                          масса стен кубами (кадр «до»)
 *
 * Мир — тот же createWorld/update из world.js, что и у игры; меняется
 * только то, чем на него смотрят. Здесь нет ни звука, ни счёта, ни
 * обучения: это проба вида, а не новая игра. Встраивание в игру — позже,
 * отдельной работой: src/main.js и src/input.js этот файл не трогает.
 *
 * Управление камерой — клавишами, которых игра не занимает (у неё WASD,
 * стрелки, 1–5, правый Shift, пробел, Enter, J, Q, Backspace, B, Tab,
 * Esc, P, M, R):
 *   [ ]  или  , .     повернуть на 90° (влево / вправо)
 *   − =  (и на цифровом блоке)   дальше / ближе
 *   0                 стандартный ракурс и общий план
 *   колесо мыши       ближе / дальше
 * На телефоне: кнопки ⟲ ⟳ − + ⌂ в углу, щипок двумя пальцами —
 * приближение, поворот двумя пальцами — поворот (встаёт на ближайший из
 * четырёх ракурсов, когда пальцы отпущены).
 *
 * Пульт для съёмки и проверок — window.vid (см. внизу).
 */

import { createWorld, update, grantElement } from '../world.js';
import { Renderer } from './engine.js';
import { bakeLevel, bakeGround, createLiveScene, levelOf, hintCell, unknownTilesWarned, setModelStatics } from './scene.js';
import { createModelLibrary } from './modeli.js';
import { createCamera, groundAxes, MODES, screenToGround, worldToScreen, zoomScale, cutAmount } from './camera.js';
import { tightSpots, openSpot } from './spots.js';
import { TILE_SIZE } from '../level.js';
import { GROUND } from '../field.js';
/* Сид — тем же способом, что у витрины игры: подменяется сам источник
   случайности, а не перечень мест, где он вызывается. */
import { withSeed } from '../showcase.js';

/*
 * Уровни по имени. Новый подключается одной строкой: имя → модуль →
 * экспорт. Нет файла — не глохнем молча, а говорим на экране и
 * открываем «Ядро».
 */
const LEVELS = {
  yadro: () => import('../evgeny-sandbox.js').then((m) => m.EVGENY_SANDBOX),
  lestnica: () => import('../lestnica.js').then((m) => m.LESTNICA),
  stancii: () => import('../element-sandbox.js').then((m) => m.ELEMENT_SANDBOX),
  vilka: () => import('../operation-fork.js').then((m) => m.OPERATION_FORK),
  komnata: () => import('../systemic-room.js').then((m) => m.SYSTEMIC_ROOM),
};

const params = new URLSearchParams(window.location.search);
const camName = MODES[params.get('cam')] ? params.get('cam') : 'uo';
const shooting = params.has('shot');
const punchOn = params.get('punch') === '1';
const massRoof = params.get('massa') !== '0';
const canvas = document.getElementById('view');
const note = document.getElementById('note');

function say(text, warn = false) {
  if (!note) return;
  note.textContent = text;
  note.dataset.warn = warn ? '1' : '0';
  note.hidden = !text;
}

async function loadLevel(name) {
  const wanted = LEVELS[name] ? name : 'yadro';
  if (name && !LEVELS[name]) say(`уровня «${name}» нет в списке — открыт «Ядро»`, true);
  try {
    const level = await LEVELS[wanted]();
    if (!level || !level.tiles) throw new Error('в модуле нет уровня');
    return { level, name: wanted };
  } catch (error) {
    /* Громко для нас, молча для игры: человек видит «Ядро», а не пустоту. */
    console.warn(`[vid] уровень «${wanted}» не загрузился:`, error.message);
    say(`уровня «${wanted}» в этой ветке ещё нет — открыт «Ядро»`, true);
    return { level: await LEVELS.yadro(), name: 'yadro' };
  }
}

const { level, name: levelName } = await loadLevel(params.get('level') || 'yadro');
/*
 * В съёмочном адресе мир создаётся под сидом: createWorld сам тянет
 * Math.random (стража, таймеры), и без сида кадр «молния в лужу» в трёх
 * прогонах подряд дал два разных исхода — убит один / не убит никто.
 */
const makeWorld = () => (shooting ? withSeed(20261003, () => createWorld(level)) : createWorld(level));
let world = makeWorld();
const renderer = new Renderer(canvas);
const live = createLiveScene(renderer);
/* 3D-модели (modeli.js): ?modeli=0 — всё процедурное, кадр «до»;
   ?modeli=ploskiy — картинки моделей сведены к цвету грани (сверка стилей). */
const models = params.get('modeli') === '0' ? null : createModelLibrary({ style: params.get('modeli') === 'ploskiy' ? 'ploskiy' : 'tekstura' });
renderer.models = models;
if (models) models.load().then(() => { models.attach(renderer); bake(); if (held) draw(clock, 0); });
const camera = createCamera(camName, {
  yaw: params.has('yaw') ? Number(params.get('yaw')) : undefined,
  persp: params.get('persp') === '1' ? 1 : 0,
});
camera.set({
  step: params.has('step') ? Number(params.get('step')) : undefined,
  zoom: params.has('zoom') ? Number(params.get('zoom')) : undefined,
});
let baked = null;
let tilesSeen = null;
let bakeMs = 0;

function bake() {
  const t0 = performance.now();
  baked = bakeLevel(world, { massRoof, models });
  setModelStatics(renderer, baked);
  renderer.setStatic('static', baked.opaque);
  renderer.setStatic('shadows', baked.shadows, { shadow: true });
  renderer.setStatic('glass', baked.glass, { transparent: true });
  tilesSeen = world.tiles.slice();
  bakeMs = performance.now() - t0;
}
bake();

/*
 * Что изменилось в сетке — сравнением, а не подпиской на события мира:
 * сравнить три тысячи байт дешевле, чем помнить, кто и где мог её
 * поменять, и сравнение не потребляет world.events, которые читает игра.
 * Время изменения — по часам мира: на остановленном мире след не стареет,
 * и кадр «после» повторяется байт в байт.
 */
let changes = [];
function noteChanges() {
  const t = world.tiles;
  let found = 0;
  for (let i = 0; i < t.length; i += 1) {
    if (t[i] === tilesSeen[i]) continue;
    const x = i % world.w, y = Math.floor(i / world.w);
    changes.push({ x, y, from: tilesSeen[i], to: t[i], born: world.time });
    found += 1;
    if (punchOn && found === 1) camera.punchAt(x + 0.5, y + 0.5);
  }
  if (found) bake();
  changes = changes.filter((c) => world.time - c.born < 2);
  return found;
}

function viewport() {
  const cssWidth = canvas.clientWidth || window.innerWidth;
  const cssHeight = canvas.clientHeight || window.innerHeight;
  renderer.resize(cssWidth, cssHeight, window.devicePixelRatio || 1);
  return { width: renderer.width, height: renderer.height, cssWidth, cssHeight };
}

/* ---------------------------------------------------------
   ВВОД
   --------------------------------------------------------- */

const keys = new Set();
const taps = new Set();
const CHARGE = { Digit1: 'fire', Digit2: 'water', Digit3: 'wind', Digit4: 'earth', Digit5: 'bolt', ArrowLeft: 'fire', ArrowUp: 'water', ArrowRight: 'wind', ArrowDown: 'earth', ShiftRight: 'bolt' };
/* Клавиши камеры. Ни одна не занята игрой — см. список в шапке. */
const CAMERA_KEYS = {
  BracketRight: () => camera.rotate(1), Period: () => camera.rotate(1),
  BracketLeft: () => camera.rotate(-1), Comma: () => camera.rotate(-1),
  Equal: () => camera.zoomBy(0.25), NumpadAdd: () => camera.zoomBy(0.25),
  Minus: () => camera.zoomBy(-0.25), NumpadSubtract: () => camera.zoomBy(-0.25),
  Digit0: () => camera.reset(), Numpad0: () => camera.reset(),
};
window.addEventListener('keydown', (e) => {
  if (!keys.has(e.code)) {
    taps.add(e.code);
    if (CAMERA_KEYS[e.code]) CAMERA_KEYS[e.code]();
  }
  keys.add(e.code);
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());
/* Колесо: тачпад шлёт мелкие доли, мышь — крупные щелчки; шаг по
   величине прокрутки, но не больше четверти диапазона за событие. */
canvas.addEventListener('wheel', (e) => {
  const d = Math.max(-0.25, Math.min(0.25, -e.deltaY * 0.0022));
  camera.zoomBy(d);
  e.preventDefault();
}, { passive: false });

/*
 * Пальцы. Один — стик: тянешь от точки касания, герой идёт туда, куда
 * тянешь. Два — жест камеры: щипок приближает, поворот крутит. Мышь без
 * кнопки — наведение: рамка на клетке под указателем.
 */
const pointers = new Map();
const stick = { id: null, x0: 0, y0: 0, dx: 0, dy: 0 };
let gesture = null;
let cursor = null;
const pairState = () => {
  const [a, b] = [...pointers.values()];
  return { d: Math.hypot(b.x - a.x, b.y - a.y), a: Math.atan2(b.y - a.y, b.x - a.x) };
};
canvas.addEventListener('pointerdown', (e) => {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  canvas.setPointerCapture(e.pointerId);
  if (pointers.size === 2) {
    /* Второй палец отменяет стик: жест камеры не должен вести героя. */
    stick.id = null; stick.dx = 0; stick.dy = 0;
    const vp = { cssWidth: canvas.clientWidth, cssHeight: canvas.clientHeight };
    const ratio = zoomScale(vp, 1, camera.mode) / zoomScale(vp, 0, camera.mode);
    gesture = { ...pairState(), zoom: camera.state.zoomGoal, logRatio: Math.log(ratio) };
    return;
  }
  if (pointers.size === 1) { stick.id = e.pointerId; stick.x0 = e.clientX; stick.y0 = e.clientY; stick.dx = 0; stick.dy = 0; }
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'mouse' && lastSpec) {
    const r = canvas.getBoundingClientRect();
    const hit = screenToGround(lastSpec, e.clientX - r.left, e.clientY - r.top);
    cursor = hit && hit.tx >= 0 && hit.ty >= 0 && hit.tx < world.w && hit.ty < world.h ? hit : null;
  }
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (gesture && pointers.size === 2) {
    const now = pairState();
    camera.zoomTo(gesture.zoom + Math.log(now.d / Math.max(1, gesture.d)) / gesture.logRatio, true);
    let da = now.a - gesture.a;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    /* Знак: пальцы по часовой — мир по часовой (test-kamera.mjs). */
    camera.twist(da);
    return;
  }
  if (e.pointerId === stick.id) { stick.dx = e.clientX - stick.x0; stick.dy = e.clientY - stick.y0; }
});
const release = (e) => {
  pointers.delete(e.pointerId);
  if (gesture && pointers.size < 2) { gesture = null; camera.twist(null); }
  if (e.pointerId === stick.id) { stick.id = null; stick.dx = 0; stick.dy = 0; }
};
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') cursor = null; });
for (const button of document.querySelectorAll('[data-cam-act]')) {
  button.addEventListener('click', () => {
    const act = button.dataset.camAct;
    if (act === 'left') camera.rotate(-1);
    if (act === 'right') camera.rotate(1);
    if (act === 'in') camera.zoomBy(0.25);
    if (act === 'out') camera.zoomBy(-0.25);
    if (act === 'home') camera.reset();
  });
}

/*
 * Намерение для мира: W — вверх по экрану при любом повороте камеры.
 * Оси — groundAxes(yaw) того ракурса, который сейчас на экране (во время
 * плавного поворота — промежуточного): палец тянет туда, куда смотрит.
 */
export function moveFromScreen(yaw, forward, sideways) {
  const { up, right } = groundAxes(yaw);
  return [up[0] * forward + right[0] * sideways, up[1] * forward + right[1] * sideways];
}

function intentFrom(yaw) {
  let f = 0, s = 0;
  if (keys.has('KeyW')) f += 1;
  if (keys.has('KeyS')) f -= 1;
  if (keys.has('KeyD')) s += 1;
  if (keys.has('KeyA')) s -= 1;
  if (stick.id !== null) {
    const len = Math.hypot(stick.dx, stick.dy);
    if (len > 12) { const k = Math.min(1, len / 60) / len; s += stick.dx * k; f -= stick.dy * k; }
  }
  const [moveX, moveY] = moveFromScreen(yaw, f, s);
  let charge = null;
  for (const code of taps) if (CHARGE[code]) charge = CHARGE[code];
  const intent = { moveX, moveY, aimAngle: null, attack: taps.has('Space'), charge, dump: taps.has('Backspace') };
  if (taps.has('KeyR') && world.state !== 'play') restart();
  taps.clear();
  return intent;
}

function restart() {
  world = makeWorld();
  changes = [];
  bake();
  say('');
}

/* ---------------------------------------------------------
   КАДР
   --------------------------------------------------------- */

const frameTimes = [];
/* В съёмочном адресе мир стоит с первого кадра: иначе до hold() успевают
   пройти несколько шагов стражи, и два прогона снимают разные кадры. */
let held = shooting;
let clock = 0;
let last = performance.now();
let lastSpec = null;
let lastRenderMs = 0;
let cutEnabled = true;

function draw(time, dt, snap = false, liveOptions = {}, renderOptions = {}) {
  noteChanges();
  const vp = viewport();
  const p = world.player;
  const spec = camera.update([p.x / TILE_SIZE, p.y / TILE_SIZE], dt, vp, snap);
  renderer.cut = { ...spec.cut, on: spec.cut.on && cutEnabled };
  renderer.setStatic('ground', bakeGround(world), { transparent: true });
  const ages = changes.map((c) => ({ ...c, age: world.time - c.born }));
  const cur = liveOptions.cursor !== undefined ? liveOptions.cursor : cursor
    && { tx: cursor.tx, ty: cursor.ty, level: levelOf(world.tiles[cursor.ty * world.w + cursor.tx]) };
  const frame = live.update(world, baked, time, { changes: ages, ...liveOptions, cursor: cur });
  const t0 = performance.now();
  renderer.render(spec, { time, lights: frame.lights, fogRange: spec.fogRange, bloom: renderOptions.bloom ?? 0.85 }, frame.particles, frame.soft);
  lastRenderMs = performance.now() - t0;
  lastSpec = spec;
  return spec;
}

function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!held) {
    frameTimes.push(dt * 1000);
    if (frameTimes.length > 240) frameTimes.shift();
    clock += dt;
    const intent = intentFrom(lastSpec ? lastSpec.yaw : camera.state.yaw);
    if (world.state === 'play') update(world, dt, intent);
    else say('тебя заметили — R или касание, чтобы заново');
    draw(clock, dt);
    if (world.state !== 'play' && stick.id !== null) restart();
  }
  requestAnimationFrame(tick);
}

document.body.dataset.cam = camName;
/* На телефоне клавиш нет — подсказка про пробел и цифры там врёт. */
const hint = document.querySelector('.hint');
if (hint && window.matchMedia('(pointer: coarse)').matches) {
  hint.textContent = 'тяни пальцем — идти · два пальца — приблизить и повернуть';
}
document.body.classList.toggle('is-shot', shooting);
for (const a of document.querySelectorAll('[data-cam-link]')) {
  const next = new URLSearchParams(window.location.search);
  next.set('cam', a.dataset.camLink);
  a.href = `?${next.toString()}`;
  if (a.dataset.camLink === camName) a.setAttribute('aria-current', 'page');
}
draw(0, 0, true);
requestAnimationFrame(tick);

/* ---------------------------------------------------------
   ПУЛЬТ ДЛЯ СЪЁМКИ И ПРОВЕРОК
   --------------------------------------------------------- */

const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * q))] : 0; };

function readPixels() {
  const gl = renderer.gl, w = renderer.width, h = renderer.height;
  const px = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return px;
}

/*
 * Разность двух отрисовок: сколько точек отличается заметно, где их
 * середина (в CSS-пикселях, от левого верхнего угла) и рамка. Одна мера
 * на героя и на рамку клетки — порог один.
 */
function diffStats(a, b, threshold = 60) {
  const w = renderer.width, h = renderer.height;
  const sx = (canvas.clientWidth || w) / w, sy = (canvas.clientHeight || h) / h;
  let n = 0, cx = 0, cy = 0, x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let i = 0, p = 0; i < a.length; i += 4, p += 1) {
    if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) <= threshold) continue;
    const x = p % w, yUp = Math.floor(p / w), y = h - 1 - yUp;
    n += 1; cx += x; cy += y;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return {
    pixels: n,
    /* Доля в CSS-пикселях: число точек холста зависит от плотности экрана. */
    cssPixels: Math.round(n * sx * sy),
    centroid: n ? { x: +((cx / n + 0.5) * sx).toFixed(2), y: +((cy / n + 0.5) * sy).toFixed(2) } : null,
    box: n ? [x0 * sx, y0 * sy, (x1 + 1) * sx, (y1 + 1) * sy].map((v) => Math.round(v)) : null,
  };
}

window.vid = {
  ready: true,
  /* Модели: загружены ли и какие не пришли (null — выключены ?modeli=0). */
  modeli: () => (models ? { ready: models.ready, failed: Object.fromEntries(models.failed), skin: renderer.skinError } : null),
  level: levelName,
  cam: camName,
  get world() { return world; },
  get renderer() { return renderer; },
  get camera() { return camera; },
  get spec() { return lastSpec; },

  hold() { held = true; return true; },
  release() { held = false; last = performance.now(); return true; },

  /* Ракурс и приближение — поставить сразу. */
  cam({ step, zoom, persp } = {}) {
    if (Number.isFinite(persp)) camera.state.persp = persp;
    camera.set({ step, zoom });
    return { step: camera.state.step, zoom: camera.state.zoom, persp: camera.state.persp };
  },

  /*
   * Поставить героя и условия. Это постановка, а не подделка: свеча
   * зажигается в игре огнём (world.js, candle-lit), герой туда доходит
   * ногами. Числа, от которых зависит исход, не трогаются.
   */
  stage({ x, y, angle, candle } = {}) {
    const p = world.player;
    if (Number.isFinite(x)) p.x = x * TILE_SIZE;
    if (Number.isFinite(y)) p.y = y * TILE_SIZE;
    if (Number.isFinite(angle)) p.angle = angle;
    p.vx = 0; p.vy = 0;
    if (candle) for (const prop of world.props) if (prop.kind === 'candle') prop.lit = true;
    return { x: p.x / TILE_SIZE, y: p.y / TILE_SIZE };
  },

  /* Выдать стихии и руки своим же путём мира (grantElement): ступени
     «Башни» иначе пришлось бы проходить ногами до каждого кадра. */
  grant(elements = [], stack = null) {
    for (const e of elements) grantElement(world, e, 'vid');
    if (Number.isFinite(stack)) world.stackLimit = stack;
    return { elements: [...world.elements], stackLimit: world.stackLimit };
  },

  /* Поставить клетки руками — только для проверки отрисовки (новые
     клетки, неизвестный номер). Перепекается сразу, без следа изменения. */
  setTiles(list) {
    for (const [x, y, t] of list) world.tiles[y * world.w + x] = t;
    bake();
    changes = [];
    return baked.fixtures.unknown.length;
  },
  unknownWarned: () => unknownTilesWarned(),

  /*
   * Заклинание настоящим ходом мира: набрать стихии, выпустить, прожить
   * after секунд. Ничего не подкручивается — огонь появляется только
   * если мир сам решил, что солома горит. Под сидом: стража думает
   * через Math.random, и без него кадр был бы лотереей.
   */
  cast({ elements = ['fire'], angle = 0, after = 1.2, seed = 20261003 } = {}) {
    held = true;
    return withSeed(seed, () => {
      const intent = (extra = {}) => ({ moveX: 0, moveY: 0, aimAngle: angle, attack: false, charge: null, dump: false, ...extra });
      const step = (extra) => { update(world, 1 / 60, intent(extra)); noteChanges(); };
      const run = (seconds, extra) => { for (let t = 0; t < seconds - 1e-6; t += 1 / 60) step(extra); };
      for (const element of elements) { step({ charge: element }); run(0.25); }
      const stacked = world.player.stack.length;
      step({ attack: true });
      run(after);
      const count = (g) => { let n = 0; for (const v of world.ground) if (v === g) n += 1; return n; };
      return {
        stacked, alive: world.player.alive, state: world.state,
        fireTiles: count(GROUND.FIRE), waterTiles: count(GROUND.WATER), iceTiles: count(GROUND.ICE), mudTiles: count(GROUND.MUD),
        changes: changes.map((c) => ({ x: c.x, y: c.y, from: c.from, to: c.to, age: +(world.time - c.born).toFixed(2) })),
        blasts: world.blasts.map((b) => b.kind), bullets: world.bullets.length, clouds: world.clouds.length,
      };
    });
  },
  /* Прожить мир ещё немного без ввода (после заклинания: пожар, пар). */
  wait(seconds = 0.5, seed = 7) {
    held = true;
    return withSeed(seed, () => {
      for (let t = 0; t < seconds - 1e-6; t += 1 / 60) {
        update(world, 1 / 60, { moveX: 0, moveY: 0, aimAngle: null, attack: false, charge: null, dump: false });
        noteChanges();
      }
      return { time: +world.time.toFixed(2), changes: changes.length };
    });
  },

  /* Кадр в заданный миг часов отрисовки, камера поставлена, а не доведена. */
  frame(time = 1.5, { cut = true, cursor = null } = {}) {
    held = true;
    cutEnabled = cut;
    const spec = draw(time, 0, true, cursor ? { cursor } : {});
    cutEnabled = true;
    return this.check(spec);
  },

  /*
   * СКОЛЬКО ГЕРОЯ ВИДНО. Две отрисовки — с героем и без него — героем
   * ровного цвета без света, свечение кадра выключено: ореол свечения
   * проходит сквозь стену и засчитал бы спрятанного героя видимым.
   * Тени и кольцо под ногами в замер не входят: меряется тело.
   */
  heroArea(time = 1.5, { cut = true } = {}) {
    held = true;
    cutEnabled = cut;
    draw(time, 0, true, { hideHero: true, flatHero: true, noActors: true, cursor: null }, { bloom: 0 });
    const without = readPixels();
    const spec = draw(time, 0, true, { flatHero: true, noActors: true, cursor: null }, { bloom: 0 });
    const withHero = readPixels();
    cutEnabled = true;
    const d = diffStats(withHero, without);
    const p = world.player;
    const feet = worldToScreen(spec, [p.x / TILE_SIZE, 0, p.y / TILE_SIZE]);
    return { ...d, step: spec.step, zoom: +spec.zoom.toFixed(2), feet: { x: +feet.x.toFixed(1), y: +feet.y.toFixed(1) } };
  },

  /*
   * ПРОВЕРКА НАВЕДЕНИЯ ПО НАРИСОВАННОМУ: рамка клетки рисуется и не
   * рисуется, середина разности — где на экране клетка на самом деле;
   * луч из этой точки обязан попасть в ту же клетку. Это вторая рука к
   * проверке в Node: та сверяет формулу с формулой, эта — формулу с
   * тем, что видит глаз (переворот по Y, плотность экрана, поворот).
   */
  cellCheck(tx, ty, time = 1.5) {
    held = true;
    const level0 = levelOf(world.tiles[ty * world.w + tx]);
    draw(time, 0, true, { cursor: null, hideHero: true, noActors: true }, { bloom: 0 });
    const without = readPixels();
    const spec = draw(time, 0, true, { cursor: { tx, ty, level: level0 }, hideHero: true, noActors: true }, { bloom: 0 });
    const withCell = readPixels();
    const d = diffStats(withCell, without, 40);
    if (!d.centroid) return { tx, ty, seen: false };
    /* Рамка, обрезанная краем экрана, сдвигает середину: такие клетки
       помечаются, и в сводку точности не идут. */
    const whole = d.box[0] > 1 && d.box[1] > 1 && d.box[2] < spec.cssWidth - 1 && d.box[3] < spec.cssHeight - 1;
    const hit = screenToGround(spec, d.centroid.x, d.centroid.y, level0 + 0.025);
    /* Отрицательный контроль: та же точка без переворота оси Y (самая
       частая ошибка «экран → мир») обязана промахнуться. */
    const flip = screenToGround(spec, d.centroid.x, spec.cssHeight - d.centroid.y, level0 + 0.025);
    return {
      tx, ty, seen: true, whole, step: spec.step, zoom: +spec.zoom.toFixed(2),
      centroid: d.centroid, picked: { x: +hit.x.toFixed(3), z: +hit.z.toFixed(3), tx: hit.tx, ty: hit.ty },
      error: +Math.hypot(hit.x - (tx + 0.5), hit.z - (ty + 0.5)).toFixed(3),
      flipError: flip ? +Math.hypot(flip.x - (tx + 0.5), flip.z - (ty + 0.5)).toFixed(3) : null,
    };
  },

  pick(cssX, cssY) { return lastSpec ? screenToGround(lastSpec, cssX, cssY) : null; },
  project(x, z, h = 0) { return lastSpec ? worldToScreen(lastSpec, [x, h, z]) : null; },
  tightSpots: () => tightSpots(world),
  openSpot: (near) => openSpot(world, near),
  cutAt(ax, az) { return lastSpec ? +cutAmount({ ...lastSpec.cut, on: true }, ax, az).toFixed(3) : null; },
  hint: () => hintCell(world),

  /*
   * Самопроверка кадра — по нарисованному, а не по задуманному: доля
   * почти чёрных точек, разброс яркости и где на экране герой.
   */
  check(spec = lastSpec) {
    const px = readPixels();
    let dark = 0, sum = 0, sum2 = 0, n = 0;
    for (let i = 0; i < px.length; i += 4 * 7) {
      const l = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      if (l < 6) dark += 1;
      sum += l; sum2 += l * l; n += 1;
    }
    const mean = sum / n;
    const p = world.player;
    const hero = worldToScreen(spec, [p.x / TILE_SIZE, 0.7, p.y / TILE_SIZE]);
    return {
      width: renderer.width, height: renderer.height,
      darkShare: +(dark / n).toFixed(3),
      meanLuma: +mean.toFixed(1),
      lumaSpread: +Math.sqrt(Math.max(0, sum2 / n - mean * mean)).toFixed(1),
      hero: { x: +(hero.x / spec.cssWidth).toFixed(3), y: +(hero.y / spec.cssHeight).toFixed(3) },
      tilesAcross: +spec.tilesAcross.toFixed(1),
      step: spec.step, zoom: +spec.zoom.toFixed(2), ortho: spec.ortho,
      calls: renderer.stats.calls,
      triangles: Math.round(renderer.stats.triangles),
      lights: renderer.stats.lights,
      bakeMs: +bakeMs.toFixed(1),
      bakedVertices: baked.vertices,
      massCells: baked.massCells,
      unknown: baked.fixtures.unknown.length,
    };
  },

  measure(n = 60) {
    held = true;
    const gl = renderer.gl, one = new Uint8Array(4), times = [];
    for (let i = 0; i < n; i += 1) {
      const t0 = performance.now();
      draw(1.5 + i / 60, 1 / 60, true);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, one);
      times.push(performance.now() - t0);
    }
    return { n, medianMs: +median(times).toFixed(2), p95Ms: +pct(times, 0.95).toFixed(2), renderCpuMs: +lastRenderMs.toFixed(2) };
  },

  loopStats() {
    return { frames: frameTimes.length, medianMs: +median(frameTimes).toFixed(2), p95Ms: +pct(frameTimes, 0.95).toFixed(2) };
  },
};
