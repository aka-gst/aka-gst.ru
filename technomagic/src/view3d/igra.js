/*
 * ТЕХНОМАГИЯ — изометрия в самой игре (не в пилоте vid.html).
 *
 * Решение Сергея 03.10 (docs/ЕВГЕНИЙ-ЛЕСТНИЦА-2026-10-03.md §7, ФИНИШ v2
 * п.5): основной вид «Лестницы» — изометрия как в Ultima Online,
 * стандартный ракурс по умолчанию; камеру можно повернуть; приближение —
 * для тонкой работы с предметами; стены не закрывают героя.
 *
 * КАК ВСТРОЕНО
 * ---------------------------------------------------------
 * Этот модуль — вторая отрисовка с той же дверью, что у плоской
 * (render.js): resize, draw(world, view) → { zoom, camX, camY },
 * invalidate, toWorld, setAvoid. main.js выбирает одну из двух при
 * загрузке (vvod.js, pickView) и дальше почти не знает, какая перед ним.
 * Логика игры (world.js, ai.js, lestnica.js, magic.js, field.js) не
 * тронута: мир клеточный, его рисуют объёмом, только и всего.
 *
 * Холстов два, и это сделано нарочно:
 *   #screen3d — WebGL, мир объёмом; создаётся здесь и лежит ПОД #screen,
 *               касаний не принимает;
 *   #screen   — прежний холст игры. Он остаётся поверхностью ввода
 *               (input.js слушает именно его, и стики, тапы, мышь не
 *               переделываются) и становится прозрачной плоской
 *               накладкой: тексты над головой, стрелка подсказки у края
 *               экрана, вспышка. Плоский мир на нём больше не рисуется.
 * HTML поверх (HUD, кнопки стихий, «НА САЙТ») не меняется вовсе.
 *
 * ЧТО ПЕРЕНЕСЕНО ИЗ ПЛОСКОГО ВИДА (render.js), кроме того, что уже умел
 * пилот (пол, стены, предметы, маги, заклинания, вещество на полу, цель
 * подсказки кольцом и стрелкой-конусом):
 *   кольцо героя цветом набранной стихии; очередь стихий над головой
 *   (на телефоне это единственный её показ: .hud-stack там спрятан);
 *   конусы дозора на полу тем же coneShape МГС; метки «?» и «!» над
 *   стражем в поиске и в погоне; кольцо стойкости (чем не бить), кольцо
 *   крепкого; метки состояния (горит, мокрый, хрупкий, проводит ток);
 *   замах — линия, куда прилетит удар; вспышка попадания; зона опасности
 *   (opasnost.js — одна формула с плоским видом); подсветка клеток,
 *   которые берёт набранное; захват цели и чем её брать; всплывающая
 *   плата (world.marks); вспышка экрана; стрелка подсказки у края.
 * ЧТО НЕ ПЕРЕНЕСЕНО СОЗНАТЕЛЬНО: виньетка и плоский слой ночи (у объёма
 *   свой свет), тряска и «клевок» кадра (камера изометрии стоит ровно —
 *   тряска ломает прицел мышью по полу), пунктиры (заменены пульсом
 *   яркости), спрайты магов (в объёме фигуры).
 */

import { TILE_SIZE, weakTo, brokenBy } from '../level.js';
import { BODY } from '../world.js';
import { colourOf, CHARGE_STEP, spellOf } from '../magic.js';
import { GROUND, groundAt, conducts } from '../field.js';
import { hintPointer } from '../ukazatel.js';
import { speechMarks } from '../zhiteli-vid.js';
import { dangerZone } from '../opasnost.js';
import { lightPools, poolLit, POOL_CORE, sightRegion, coneTint, guardMark, COIN_NOISE, RING_TIME } from '../vidimost.js';
import { Renderer, Node, Builder, Geo, STRIDE, SURF } from './engine.js';
import { bakeLevel, bakeGround, createLiveScene, levelOf } from './scene.js';
import { createCamera, worldToScreen, zoomScale, groundAxes, INTRO, GLANCE, GLANCE_LENGTH, glanceCurve } from './camera.js';
import { keysToWorld, stickToWorld, screenAngleToWorld, pickWorld, isoViewRadius, cellHeight } from './vvod.js';
import * as M from './math.js';

const T = TILE_SIZE;

/* Цвета — те же, что у плоского вида (render.js: STATE_COLOURS,
   WEAKNESS_COLOURS, WEAPON_REACH). Это вид, а не правило, поэтому копия, а
   не общий модуль; правило (радиус опасности) — общее, opasnost.js. Цвет
   взгляда стражи — общий с плоским видом (vidimost.js, CONE_TINT): с
   03.10 у него четыре состояния, и копия разошлась бы на первом же. */
const STATE_COLOURS = {
  [GROUND.WATER]: '34,170,255',
  [GROUND.FIRE]: '255,90,25',
  [GROUND.ICE]: '160,230,255',
  [GROUND.MUD]: '186,152,72',
};
const WEAKNESS_COLOURS = { burn: '#ff5a1f', wet: '#4de1ff', freeze: '#9fe8ff', crush: '#d08a3e', shock: '#ffe14d' };
const WEAPON_REACH = { bat: 38 };

const glow = (colour, alpha, emissive = 1.2) => ({ color: M.rgb(colour), emissive, alpha, additive: true, unlit: 1 });

/*
 * ОДИН АКЦЕНТ НА КАДР (приёмка Глаз 03.10, второй заход). Пока у
 * подсказки есть цель, ярче всего в кадре — она: на цели луч, кольцо и
 * свет (scene.js, hintLayer), за кадром — крупная стрелка у края со
 * свечением (drawOverlay). Украшения, которые с ней спорили, на это
 * время приглушены: обод и умбон щитов (scene.js), кольцо стойкости
 * («этим не бей») и белое кольцо крепкого под стражами (gameLayer).
 * Вспышка «заблокировал» (e.blocked) не приглушается — это ответ на
 * действие игрока. ACCENT.on = false — поломка для проверок: прежние
 * яркости, замер «цель подсказки — главный акцент» обязан покраснеть.
 */
export const ACCENT = { on: true, rings: 0.4, arrow: 24 };

export function createIsoRenderer(surface, options = {}) {
  const doc = surface.ownerDocument;
  const glCanvas = doc.createElement('canvas');
  glCanvas.id = 'screen3d';
  glCanvas.setAttribute('aria-hidden', 'true');
  surface.parentNode.insertBefore(glCanvas, surface);

  let gl;
  try {
    gl = new Renderer(glCanvas);
  } catch (error) {
    /* Нет WebGL — холст убирается, main.js поднимет плоский вид. */
    glCanvas.remove();
    throw error;
  }
  const overlay = surface.getContext('2d');
  const live = createLiveScene(gl);
  gl.register('thinring', new Builder().add(Geo.ring(0.9, 1, Math.PI * 2, 48), M.identity()).data);
  /* Телефон стоя — девять клеток поперёк на общем плане (camera.js,
     zoomScale): маг ×1.2 крупнее прежнего. Дальность огня стрелков
     (world.viewRadius) идёт от того же плана — «не стреляют из-за края
     кадра» остаётся правдой. */
  const camera = createCamera('uo', { portraitTiles: 9 });
  doc.body.classList.add('vid-iso');

  const size = { cssW: 0, cssH: 0, dpr: 1 };
  let placed = '';
  let bakedFor = null;
  let baked = null;
  let tilesSeen = null;
  let changes = [];
  let lastSpec = null;
  let lastDraw = performance.now();
  let snapNext = true;
  let avoidRects = [];
  let mouse = null;
  const clock0 = performance.now();
  const stats = { drawMs: [], gaps: [] };
  /*
   * ЩУП ДЛЯ ЗАМЕРОВ (pilot-vid/zamer-chitaemost.mjs), по умолчанию выключен
   * и кадра не меняет. clock — часы отрисовки стоят (рябь, мерцание, пульс
   * не двигаются, и два кадра подряд совпадают пиксель в пиксель); hide —
   * что не рисовать: hero (фигура героя без кольца и тени), stack (очередь
   * над головой), lamps, shields, coins, marks, cones — разница двух
   * кадров и есть то, что видит человек на месте этой вещи; voidMask —
   * всё за краем карты чистым пурпуром, без тумана и свечения: доля
   * пурпура = доля пустоты в кадре.
   */
  const probe = { clock: null, hide: new Set(), voidMask: false };

  /* ---------------- холст под холстом ---------------- */

  /*
   * Место и размер WebGL-холста берутся у #screen, а не из своих правил
   * CSS: на телефоне стоя #screen занимает верхние 74% (снизу полка под
   * кнопки), и вторая копия этих правил однажды разошлась бы с первой.
   */
  function place() {
    const r = surface.getBoundingClientRect();
    const key = `${r.left},${r.top},${r.width},${r.height}`;
    if (key === placed) return;
    placed = key;
    Object.assign(glCanvas.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  }

  function resize(cssW, cssH, ratio) {
    place();
    const dpr = Math.min(2, ratio || 1);
    size.cssW = cssW; size.cssH = cssH; size.dpr = dpr;
    gl.resize(cssW, cssH, dpr);
    const w = Math.round(cssW * dpr), h = Math.round(cssH * dpr);
    if (surface.width !== w || surface.height !== h) { surface.width = w; surface.height = h; }
  }

  /* ---------------- печь этажа ---------------- */

  function rebake(world) {
    baked = bakeLevel(world, { decorLamps: !world.lights, voidMask: probe.voidMask, readable: true });
    gl.setStatic('static', baked.opaque);
    gl.setStatic('shadows', baked.shadows, { shadow: true });
    gl.setStatic('glass', baked.glass, { transparent: true });
    tilesSeen = world.tiles.slice();
  }

  /*
   * Что изменилось в сетке — сравнением, как в пилоте (view3d/main.js):
   * три тысячи байт сравнить дешевле, чем помнить, кто мог их поменять, и
   * сравнение не ест world.events, которые читает игра.
   */
  function noteChanges(world) {
    const t = world.tiles;
    let found = 0;
    for (let i = 0; i < t.length; i += 1) {
      if (t[i] === tilesSeen[i]) continue;
      changes.push({ x: i % world.w, y: Math.floor(i / world.w), from: tilesSeen[i], to: t[i], born: world.time });
      found += 1;
    }
    if (found) rebake(world);
    changes = changes.filter((c) => world.time - c.born < 2 && world.time >= c.born);
  }

  /* ---------------- кадр ---------------- */

  function draw(world) {
    const t0 = performance.now();
    /* Часы отрисовки остановлены щупом замера — стоит и камера (доводка,
       первый кадр, взгляд на цель): кадры замера совпадают. */
    const dt = probe.clock !== null ? 0 : Math.min(0.05, Math.max(0, (t0 - lastDraw) / 1000));
    stats.gaps.push(t0 - lastDraw);
    lastDraw = t0;
    if (size.cssW < 1 || size.cssH < 1) return lastView();
    world.rebake = false;

    const vp = { cssWidth: size.cssW, cssHeight: size.cssH, width: size.cssW, height: size.cssH };
    if (world !== bakedFor) {
      bakedFor = world;
      changes = [];
      rebake(world);
      snapNext = true;
    }
    noteChanges(world);

    const p = world.player;
    const spec = camera.update([p.x / T, p.y / T], dt, vp, snapNext, framing(world, vp, dt));
    snapNext = false;
    gl.cut = { ...spec.cut };
    gl.setStatic('ground', bakeGround(world), { transparent: true });

    const time = probe.clock ?? (t0 - clock0) / 1000;
    const ages = changes.map((c) => ({ ...c, age: world.time - c.born }));
    let cursor = null;
    if (mouse && lastSpec) {
      const hit = pickWorld(lastSpec, world, mouse.x, mouse.y);
      if (hit && hit.tx >= 0 && hit.ty >= 0 && hit.tx < world.w && hit.ty < world.h) {
        cursor = { tx: hit.tx, ty: hit.ty, level: levelOf(world.tiles[hit.ty * world.w + hit.tx]) };
      }
    }
    const frame = live.update(world, baked, time, { changes: ages, cursor, hide: probe.hide, calm: calmNow(world) });
    nightFor(world);
    gameLayer(world, gl.scene, spec, time, frame.lights);
    if (probe.voidMask) {
      gl.fog = [1, 0, 1];
      gl.render(spec, { time, lights: frame.lights, fogRange: [1e4, 2e4], bloom: 0 }, frame.particles, frame.soft);
      gl.fog = FOG;
    } else {
      /* Виньетка вдвое слабее пилотной: на телефоне край кадра и так
         под кнопками, а тёмный край ночью читался краем мира. */
      gl.render(spec, { time, lights: frame.lights, fogRange: fogFor(spec), bloom: 0.85, vignette: 0.1 }, frame.particles, frame.soft);
    }
    lastSpec = spec;
    if (probe.voidMask) {
      overlay.setTransform(1, 0, 0, 1, 0, 0);
      overlay.clearRect(0, 0, surface.width, surface.height);
    } else drawOverlay(world, spec, time);

    stats.drawMs.push(performance.now() - t0);
    if (stats.drawMs.length > 240) { stats.drawMs.shift(); stats.gaps.shift(); }
    return lastView();
  }

  /*
   * КАДР В ПРЕДЕЛАХ КАРТЫ (camera.js, frameFocus): размер этажа и на какую
   * долю половины кадра герой может уйти от середины. Вбок — 0.55 везде.
   * По высоте — по тому, что лежит поверх поля (кадры «после» 03.10):
   *   телефон стоя — 0.55 вверх и вниз: шапка и полка вне поля;
   *   телефон боком — 0: сверху шапка задачи до 135 точек, снизу тост с
   *     226 при высоте 390 — между ними герой помещается только посередине;
   *   компьютер — 0.35: шапка до 122, тост с 594 при высоте 800.
   */
  const framing = (world, vp, dt) => {
    const portrait = vp.cssHeight > vp.cssWidth * 1.15;
    const vertical = portrait ? 0.55 : vp.cssHeight < 560 ? 0 : 0.35;
    return { w: world.w, h: world.h, keepUp: vertical, keepDown: vertical, intro: introFor(world, dt), glance: glanceFor(world, dt) };
  };

  /*
   * ПЕРВЫЙ КАДР (приёмка Глаз 03.10, второй заход; геометрия — camera.js,
   * introFrame). Попытка началась, подсказка с целью пришла — кадр держит
   * героя и цель вместе (вес 1). Отпускает первый шаг (герой отошёл от
   * точки старта на полклетки), INTRO.hold секунд по часам этажа, уход
   * подсказки, конец партии или кнопка камеры (кроме «0»); потом вес
   * плавно уходит к нулю за INTRO.ease секунд — к обычному слежению.
   * Скачок героя больше двух клеток за кадр — постановка или перезапуск,
   * не шаг: кадр сразу обычный.
   */
  const intro = { world: null, home: null, last: null, since: null, target: null, k: 0, out: false, cancel: false };
  function introFor(world, dt) {
    const p = world.player;
    if (world !== intro.world) {
      Object.assign(intro, { world, home: [p.x, p.y], last: [p.x, p.y], since: null, target: null, k: 0, out: false, cancel: false });
    }
    const hint = world.hint;
    if (!intro.out) {
      if (intro.since === null && hint && hint.target && world.state === 'play') {
        intro.since = world.time;
        intro.target = [hint.target.x / T, hint.target.y / T];
        intro.k = 1;
      }
      const moved = Math.hypot(p.x - intro.home[0], p.y - intro.home[1]) > 0.5 * T;
      const late = intro.since !== null && world.time - intro.since > INTRO.hold;
      const gone = intro.since !== null && (!hint || !hint.target || world.state !== 'play');
      if (moved || late || gone || intro.cancel) intro.out = true;
    }
    if (Math.hypot(p.x - intro.last[0], p.y - intro.last[1]) > 2 * T) intro.k = 0;
    intro.last = [p.x, p.y];
    if (intro.out) intro.k = Math.max(0, intro.k - dt / INTRO.ease);
    if (!(intro.k > 0) || !intro.target) return null;
    const k = intro.k * intro.k * (3 - 2 * intro.k);
    return { target: intro.target, k, avoid: avoidRects };
  }

  /*
   * ВЗГЛЯД НА ЦЕЛЬ (приёмка Глаз 03.10, второй заход; кривая и кадр —
   * camera.js, glanceCurve и glanceFrame). Только для ступеней из
   * GLANCE_STEPS — сейчас это «ТРИ РУКИ. ЩИТОК ПОЛЯ ЗА ПРОПАСТЬЮ»: щиток в
   * двадцати шести клетках от зала, и одной стрелки у края мало, чтобы
   * понять, где он. Раз на ступень за попытку и только если цели в кадре
   * нет. Мир не стоит; любое новое нажатие (клавиша, касание, щелчок —
   * слушатели ниже) прерывает взгляд: кадр возвращается за GLANCE.ease.
   * Удержание клавиши, начатое до взгляда, его не прерывает — иначе
   * идущий в зал игрок не увидел бы его вовсе.
   */
  const GLANCE_STEPS = new Set(['stack3']);
  const glance = { world: null, seen: new Set(), t: null, target: null, cut: null };
  function glanceFor(world, dt) {
    if (world !== glance.world) Object.assign(glance, { world, seen: new Set(), t: null, target: null, cut: null });
    const hint = world.hint;
    if (hint && hint.target && GLANCE_STEPS.has(hint.step) && !glance.seen.has(hint.step) && world.state === 'play') {
      glance.seen.add(hint.step);
      const s = lastSpec ? worldToScreen(lastSpec, [hint.target.x / T, 0, hint.target.y / T]) : null;
      const inside = s && s.x >= 0 && s.y >= 0 && s.x <= size.cssW && s.y <= size.cssH;
      if (!inside) Object.assign(glance, { t: 0, target: [hint.target.x / T, hint.target.y / T], cut: null });
    }
    if (glance.t === null) return null;
    glance.t += dt;
    let g = glanceCurve(glance.t);
    if (glance.cut) {
      glance.cut.t += dt;
      g = Math.min(g, glance.cut.g * Math.max(0, 1 - glance.cut.t / GLANCE.ease));
    }
    if (glance.t >= GLANCE_LENGTH || g <= 0 && glance.t > 0.05) {
      glance.t = null;
      return null;
    }
    return { target: glance.target, g, avoid: avoidRects };
  }
  const skipGlance = (event) => {
    if (event && event.repeat) return;
    if (glance.t !== null && !glance.cut) glance.cut = { g: glanceCurve(glance.t), t: 0 };
  };
  doc.addEventListener('keydown', skipGlance, true);
  doc.addEventListener('pointerdown', skipGlance, true);
  doc.addEventListener('touchstart', skipGlance, { capture: true, passive: true });

  /*
   * Что отдаётся main.js. zoom — точек экрана на точку мира у
   * СТАНДАРТНОГО плана; viewRadius — сколько мира видно (vvod.js,
   * isoViewRadius): main.js кладёт его в world.viewRadius, и приближение
   * камеры не меняет, откуда стрелки начинают бить.
   */
  function lastView() {
    const vp = { cssWidth: size.cssW || 1, cssHeight: size.cssH || 1 };
    const standard = zoomScale(vp, 0, camera.mode);
    const focus = lastSpec ? lastSpec.focus : [0, 0, 0];
    return {
      zoom: standard / T,
      camX: focus[0] * T,
      camY: focus[2] * T,
      viewRadius: isoViewRadius(vp.cssWidth, vp.cssHeight, standard, camera.mode.pitch),
      iso: true,
    };
  }

  /*
   * НОЧЬ «БАШНИ» (слой «б», 03.10; читаемость — приёмка Глаз 03.10).
   * На этаже с настоящим светом (world.lights, ambient 0) было «небо,
   * земля и луна вдвое тише» — и кадр на телефоне выходил чёрным: средняя
   * яркость поля 15–30 из 255, 97% точек на старте темнее 25 (замер
   * pilot-vid/zamer-chitaemost.mjs, «до»). Теперь ночь — холодный лунный
   * свет, а не темнота: пол и стены читаются, тьма правила видна цветом и
   * разницей с пятнами ламп (тёплые, по-прежнему ярче фона больше чем в
   * 1.8 раза — мера «пятно/фон» того же замера). Правило света (light.js,
   * vidimost.js) не тронуто: «не видно» по-прежнему там, где нет пятна.
   * Светлые места — пятна света на полу (lightPools, та же форма и
   * яркость, что считает light.js МГС) и сами лампы. Свет фонарей точкой
   * (GL) стен не знает и просочился бы сквозь кладку туда, где по правилу
   * темно, — поэтому у лампы он короткий, на свой угол стены, а пятно на
   * полу рисует правило.
   */
  const DAY = { sky: [...gl.sky], ground: [...gl.ground], moon: [...gl.moonColor] };
  const FOG = [...gl.fog];
  /* Множители к дневным: небо и луна чуть холоднее и ярче дня — лунная
     заливка пола; «земля» (отражённый свет на бока стен и фигур) — почти
     вдвое: стена, отвёрнутая от луны, иначе оставалась чёрной полосой. */
  const NIGHT = { sky: [1.3, 1.35, 1.45], ground: [1.8, 1.8, 1.95], moon: [1.25, 1.3, 1.4] };
  function nightFor(world) {
    const night = world.lights && (world.ambient ?? 1) <= 0;
    gl.sky = DAY.sky.map((c, i) => c * (night ? NIGHT.sky[i] : 1));
    gl.ground = DAY.ground.map((c, i) => c * (night ? NIGHT.ground[i] : 1));
    gl.moonColor = DAY.moon.map((c, i) => c * (night ? NIGHT.moon[i] : 1));
    gl.grass = night ? 1.9 : 1;
  }

  /*
   * Туман — за краем кадра, а не в его верхней половине. Камера считала
   * его от точки взгляда по большей половине экрана (camera.js), а пол в
   * изометрии виден вглубь вдвое дальше высоты экрана (1/sin 30°): на
   * телефоне стоя верхние 40% поля уходили в туман почти до черноты.
   * Теперь туман начинается у дальнего угла кадра на полу.
   */
  function fogFor(spec) {
    if (!spec.ortho || !spec.pxPerUnit) return spec.fogRange;
    const halfW = spec.cssWidth / spec.pxPerUnit / 2;
    const halfH = spec.cssHeight / spec.pxPerUnit / 2;
    const reach = Math.hypot(halfW, halfH / Math.max(0.2, Math.sin(spec.pitch)));
    return [reach, reach * 1.8];
  }
  const POOL_RGB = { lamp: [1, 0.82, 0.55], fire: [1, 0.5, 0.18], candle: [1, 0.7, 0.35] };
  const POOL_POWER = { lamp: 0.5, fire: 0.25, candle: 0.4 };

  /* ---------------- игровые метки в объёме ---------------- */

  /* Подсказка с целью в партии — украшения приглушены (ACCENT выше). */
  const calmNow = (world) => ACCENT.on && Boolean(world.hint && world.hint.target) && world.state === 'play';

  function gameLayer(world, root, spec, time, lights) {
    const add = (geo, material, position, scale = [1, 1, 1], rotation = null) => {
      const n = new Node(geo, material);
      n.position = position;
      n.scale = scale;
      if (rotation) n.rotation = rotation;
      root.add(n);
      return n;
    };
    const flatRing = (x, z, r, colour, alpha, geo = 'thinring', y = 0.045) => add(geo, glow(colour, alpha), [x, y, z], [r, 1, r]);
    const dim = calmNow(world) ? ACCENT.rings : 1;
    const player = world.player;
    const right = groundAxes(spec.yaw).right;

    /*
     * ПЯТНА СВЕТА (слой «б»): ровно та область, которую считает light.js
     * МГС (vidimost.js, lightPools — лучи lightShape, укороченные о стены),
     * и ровно та яркость: полная до POOL_CORE радиуса, к краю — к нулю.
     * Один буфер на кадр, сложением: пятно светит, а не красит.
     */
    if (world.lights) {
      const data = [];
      const vert = (x, z, c, a) => data.push(x, 0.028, z, 0, 1, 0, c[0], c[1], c[2], 0, SURF.SHADOW, 0, a, x, z);
      const reachView = Math.max(14, spec.tilesAcross || 14) * T;
      for (const pool of lightPools(world, { x: player.x, y: player.y, r: reachView })) {
        const c = POOL_RGB[pool.kind] || POOL_RGB.lamp;
        const power = POOL_POWER[pool.kind] || 0.4;
        const cx = pool.x / T, cz = pool.y / T;
        const ring = pool.rays.map((ray) => {
          const inner = Math.min(ray.d, POOL_CORE * pool.r);
          return {
            ix: cx + Math.cos(ray.a) * inner / T, iz: cz + Math.sin(ray.a) * inner / T, ia: poolLit(inner, pool.r) * power,
            ox: cx + Math.cos(ray.a) * ray.d / T, oz: cz + Math.sin(ray.a) * ray.d / T, oa: poolLit(ray.d, pool.r) * power,
          };
        });
        for (let i = 0; i < ring.length; i += 1) {
          const a = ring[i], b = ring[(i + 1) % ring.length];
          vert(cx, cz, c, power); vert(a.ix, a.iz, c, a.ia); vert(b.ix, b.iz, c, b.ia);
          vert(a.ix, a.iz, c, a.ia); vert(a.ox, a.oz, c, a.oa); vert(b.ox, b.oz, c, b.oa);
          vert(a.ix, a.iz, c, a.ia); vert(b.ox, b.oz, c, b.oa); vert(b.ix, b.iz, c, b.ia);
        }
      }
      if (data.length) {
        gl.register('pools', data);
        add('pools', { color: [1, 1, 1], alpha: 0.99, additive: true, unlit: 1, surf: SURF.SHADOW }, [0, 0, 0]);
      }

      /*
       * Лампы этажа (svet.js): фонарь на кронштейне — железная плашка на
       * кладке, брус от стены, клетка с колпаком, внутри огонь. До 03.10
       * лампа была светящимся шаром 7–8 точек на телефоне и серым читалась
       * как навершие посоха героя (приёмка Глаз): форма «брус к стене +
       * клетка» у посоха не бывает. Горит — тёплый огонь и ореол со светом
       * на свой угол; погашена водой — тёмное стекло и голубая кайма на
       * полу; разбита — тёмное стекло без каймы.
       */
      const AWAY = { n: [0, 1], s: [0, -1], w: [1, 0], e: [-1, 0] };
      const iron = { color: [0.1, 0.095, 0.09], emissive: 0, surf: SURF.METAL };
      for (const lamp of world.lights) {
        const on = !lamp.broken && lamp.out <= 0;
        const [ax, az] = AWAY[lamp.wall] || [0, 0];
        /* Точка на кладке (svet.js: лампа отнесена к стене на 11 точек
           мира, грань стены — на полклетки) и фонарь на конце бруса. */
        const wx = lamp.x / T - ax * 0.15, wz = lamp.y / T - az * 0.15;
        const lx = wx + ax * 0.36, lz = wz + az * 0.36;
        const pos = [lx, 1.08, lz];
        if (!probe.hide.has('lamps')) {
          const along = (k, thin) => (ax ? [k, thin, thin] : [thin, thin, k]);
          add('cube', iron, [wx + ax * 0.02, 1.3, wz + az * 0.02], ax ? [0.04, 0.34, 0.16] : [0.16, 0.34, 0.04]);
          add('cube', iron, [(wx + lx) / 2, 1.44, (wz + lz) / 2], along(0.38, 0.045));
          add('cube', iron, [lx, 1.36, lz], [0.03, 0.14, 0.03]);
          add('cone', iron, [lx, 1.27, lz], [0.15, 0.1, 0.15]);
          add('cube', iron, [lx, 0.92, lz], [0.2, 0.03, 0.2]);
          for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
            add('cube', iron, [lx + ox * 0.085, 1.08, lz + oz * 0.085], [0.022, 0.32, 0.022]);
          }
          if (on) {
            add('cube', { color: M.rgb('#fff1c9'), emissive: 2.4, unlit: 1 }, pos, [0.13, 0.24, 0.13]);
            add('sphere', glow('#ffd9a0', 0.26), pos, [0.27, 0.3, 0.27]);
          } else {
            add('cube', { color: [0.16, 0.18, 0.22], emissive: 0, unlit: 0.4 }, pos, [0.13, 0.24, 0.13]);
            if (!lamp.broken) flatRing(lamp.x / T, lamp.y / T, 0.26, '#4de1ff', 0.45);
          }
        }
        if (on) lights.push({ pos, color: [1, 0.82, 0.55], power: 1.1, range: 2.2 });
      }
    }

    /*
     * ВЗГЛЯД СТРАЖИ — только на этаже с дозором (world.trevoga). С 03.10
     * закрашено не «куда смотрит», а «где стоящего ВИДНО»: каждую точку
     * спрашивают у canSee МГС с её освещённостью — той же функции, которой
     * смотрит ai.js (vidimost.js, sightRegion). Во тьме это клетка у носа,
     * в пятне лампы — семь, сзади клетка «чует спиной». Тонкая кромка —
     * конус полной дальности (coneShape МГС): куда смотрит и докуда увидит
     * на свету. До 03.10 конус рисовался полной дальностью и ночью врал.
     * Все — один буфер на кадр, ровным цветом без света: это разметка.
     */
    if (world.trevoga && !probe.hide.has('cones')) {
      const data = [];
      const vert = (x, z, c, a) => data.push(x, 0.03, z, 0, 1, 0, c[0], c[1], c[2], 0, SURF.SHADOW, 0, a, x, z);
      const reachView = Math.max(14, spec.tilesAcross || 14) * T + 300;
      for (const e of world.enemies) {
        if (!e.alive || e.downed > 0) continue;
        if (Math.hypot(e.x - player.x, e.y - player.y) > reachView) continue;
        const c = M.rgb(coneTint(e.state));
        const idle = e.state === 'idle';
        const fill = idle ? 0.24 : 0.34, edge = idle ? 0.3 : 0.55;
        const region = sightRegion(world, e);
        const cx = e.x / T, cz = e.y / T;
        const at = (a, d) => [cx + Math.cos(a) * d / T, cz + Math.sin(a) * d / T];
        for (const s of region.spans) {
          const [p0x, p0z] = at(s.a0, s.d0), [p1x, p1z] = at(s.a0, s.d1);
          const [p2x, p2z] = at(s.a1, s.d1), [p3x, p3z] = at(s.a1, s.d0);
          vert(p0x, p0z, c, fill); vert(p1x, p1z, c, fill); vert(p2x, p2z, c, fill);
          vert(p0x, p0z, c, fill); vert(p2x, p2z, c, fill); vert(p3x, p3z, c, fill);
        }
        /* Кромка полной дальности: полоска внутрь от края на 0,05 клетки. */
        const pts = region.outline.map((r) => at(r.a, r.d));
        for (let i = 0; i + 1 < pts.length; i += 1) {
          const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
          const ia = 1 - 0.05 / Math.max(0.1, Math.hypot(ax - cx, az - cz));
          const ib = 1 - 0.05 / Math.max(0.1, Math.hypot(bx - cx, bz - cz));
          const aix = cx + (ax - cx) * ia, aiz = cz + (az - cz) * ia;
          const bix = cx + (bx - cx) * ib, biz = cz + (bz - cz) * ib;
          vert(ax, az, c, edge); vert(bx, bz, c, edge); vert(bix, biz, c, edge);
          vert(ax, az, c, edge); vert(bix, biz, c, edge); vert(aix, aiz, c, edge);
        }
      }
      if (data.length) {
        gl.register('cones', data);
        add('cones', { color: [1, 1, 1], alpha: 0.99, unlit: 1, surf: SURF.SHADOW }, [0, 0, 0]);
      }
    }

    /* Метки состояния — как stateMark у плоского вида, пятнами на полу. */
    const stateMark = (body) => {
      const x = body.x / T, z = body.y / T;
      if (body.burning > 0) {
        add('disc', glow('255,120,40', 0.45 * (0.6 + 0.4 * Math.abs(Math.sin(time * 23 + x)))), [x, 0.04, z], [(BODY + 5) / T, 1, (BODY + 5) / T]);
        return;
      }
      if ((body.brittle || 0) > 0) flatRing(x, z, (BODY + 9) / T, '#b9f4ff', 0.75 + Math.sin(time * 12) * 0.2);
      const colour = STATE_COLOURS[groundAt(world, body.x, body.y)] || ((body.wet || 0) > 0 ? STATE_COLOURS[GROUND.WATER] : null);
      if (!colour) return;
      const pulse = 0.72 + Math.sin(time * 4 + body.x) * 0.28;
      add('disc', glow(colour, 0.32 * pulse), [x, 0.035, z], [(BODY + 11) / T, 1, (BODY + 11) / T]);
      /* Мокрый проводит — подписан цветом ответа, если молния вообще в руках. */
      if (conducts(world, body) && world.elements.includes('bolt')) flatRing(x, z, (BODY + 12) / T, '#ffe14d', 0.35 + pulse * 0.4);
    };

    for (const e of world.enemies) {
      if (!e.alive) continue;
      const x = e.x / T, z = e.y / T;
      stateMark(e);
      /* Стихия врага — кольцом: «этим цветом не бей». Пока у подсказки
         есть цель — вполсилы (ACCENT выше), вспышка блока — всегда полная. */
      if (e.resist) {
        const pulse = 0.45 + Math.sin(time * 6 + (e.home ? e.home.x : 0)) * 0.2;
        flatRing(x, z, (BODY + 9) / T, colourOf(e.resist), e.blocked > 0 ? 1 : (pulse + 0.2) * dim, 'ring', 0.05);
      }
      /* Крепкий — тонкое белое; надломленный — розовое. */
      if ((e.hp || 1) > 1 || e.tough) flatRing(x, z, (BODY + 3) / T, '#d9e2ea', 0.6 * dim);
      else if (e.wasTough) flatRing(x, z, (BODY + 3) / T, '#ffb0b8', 0.55 * dim);
      if (e.hitFlash > 0) add('sphere', glow('#ffffff', Math.min(1, e.hitFlash * 3), 1.5), [x, 0.55, z], [0.38, 0.5, 0.38]);
      /* Замах: линия туда, куда прилетит, и кольцо, стягивающееся к телу. */
      if ((e.windup || 0) > 0.02) {
        const melee = WEAPON_REACH[e.weapon] || 0;
        const full = melee || Math.hypot(player.x - e.x, player.y - e.y);
        const grow = Math.min(1, e.windup / 0.42);
        const len = (full * grow) / T;
        const tint = e.element ? colourOf(e.element) : '#ff5d7a';
        const a = e.angle || 0;
        if (len > 0.02) {
          add('quad', glow(tint, 0.25 + grow * 0.55, 1.4), [x + Math.cos(a) * len / 2, 0.06, z + Math.sin(a) * len / 2],
            [len, 1, 0.05 + 0.06 * grow], [0, -a, 0]);
        }
        flatRing(x, z, (BODY + 16 - grow * 12) / T, tint, 0.35 + grow * 0.5);
      }
    }

    if (player && player.alive) {
      const px = player.x / T, pz = player.y / T;
      /* Кольцо героя — цветом того, что в руках, как у плоского вида. */
      const held = player.stack.length ? colourOf(player.stack[player.stack.length - 1]) : null;
      live.ring.material.color = M.rgb(player.chargeLeft > 0 ? colourOf(player.charging) : (held || '#9df9ff'));
      stateMark(player);

      /* Очередь над головой — поперёк экрана при любом повороте камеры. */
      const n = probe.hide.has('stack') ? 0 : player.stack.length;
      const slot = (i) => (i - (n - 1) / 2) * 0.3;
      for (let i = 0; i < n; i += 1) {
        const c = colourOf(player.stack[i]);
        const y = 1.92 + Math.sin(time * 4 + i) * 0.04;
        const pos = [px + right[0] * slot(i), y, pz + right[1] * slot(i)];
        add('sphere', { color: M.rgb(c), emissive: 1.6, unlit: 1 }, pos, [0.085, 0.085, 0.085]);
        add('sphere', glow(c, 0.35), pos, [0.16, 0.16, 0.16]);
      }
      if (player.chargeLeft > 0) {
        const fill = 1 - player.chargeLeft / CHARGE_STEP;
        const pos = [px + right[0] * slot(n), 1.92, pz + right[1] * slot(n)];
        add('sphere', glow(colourOf(player.charging), 0.4 + 0.5 * fill), pos, [0.03 + 0.07 * fill, 0.03 + 0.07 * fill, 0.03 + 0.07 * fill]);
      }
    }

    /* Обыск (слой «в»): лиловый круг на месте, куда ушли двое. */
    if (world.trevoga) {
      const seenSpots = [];
      for (const e of world.enemies) {
        if (!e.alive || e.downed > 0 || e.state !== 'search' || !e.searchPoint) continue;
        if (seenSpots.some((s) => Math.hypot(s.x - e.searchPoint.x, s.y - e.searchPoint.y) < 8)) continue;
        seenSpots.push(e.searchPoint);
        flatRing(e.searchPoint.x / T, e.searchPoint.y / T, 1.4, coneTint('search'), 0.55 + 0.35 * Math.sin(time * 4));
      }
    }
    /* Свидетель бежит — пульсирующее кольцо у ног. */
    for (const civ of world.civilians || []) {
      if (!civ.alive || !civ.witness || civ.witness.state !== 'run') continue;
      flatRing(civ.x / T, civ.y / T, (BODY + 9) / T, '#ff8c3c', 0.5 + 0.4 * Math.sin(time * 9));
    }

    /*
     * МОНЕТА (слой «б», moneta.js) — как у плоского вида (render.js,
     * drawCoins): летит — серебряный шар на высоте руки; лежит — блестит
     * (можно подобрать); звон — кольцо до края слышимости МГС за RING_TIME;
     * взведено «куда?» — черта до места падения (шаги moneta.js) и бледный
     * круг, докуда услышат.
     */
    if (world.coins) {
      const aim = world.coinAim;
      if (aim && player.alive) {
        const px = player.x / T, pz = player.y / T, ax = aim.x / T, az = aim.y / T;
        const len = Math.hypot(ax - px, az - pz);
        const a = Math.atan2(az - pz, ax - px);
        if (len > 0.05) add('quad', glow('#cfd8dc', 0.45, 1), [(px + ax) / 2, 0.06, (pz + az) / 2], [len, 1, 0.04], [0, -a, 0]);
        flatRing(ax, az, 0.3, '#e8eef0', 0.8 + 0.2 * Math.sin(time * 6));
        flatRing(ax, az, COIN_NOISE / T, '#cfd8dc', 0.3);
      }
      for (const coin of probe.hide.has('coins') ? [] : world.coins) {
        const x = coin.x / T, z = coin.y / T;
        if (!coin.landed) {
          add('sphere', { color: M.rgb('#e8eef0'), emissive: 1.8, unlit: 1 }, [x, 0.75, z], [0.09, 0.09, 0.09]);
          add('sphere', glow('#cfd8dc', 0.35), [x, 0.75, z], [0.18, 0.18, 0.18]);
          continue;
        }
        /* Лежащая монета — серебряный кружок с бликом и бледным кольцом:
           до 03.10 это был диск в 0.22 клетки, 8×4 точки на телефоне, и на
           кадре его не было вовсе (замер «до»: 0). Её подбирают обратно —
           её надо находить глазами. */
        const glint = 0.7 + 0.3 * Math.max(0, Math.sin(time * 6.3 + coin.x));
        add('disc', { color: M.rgb('#dfe6ea'), emissive: 1.2, unlit: 1 }, [x, 0.05, z], [0.17, 1, 0.17]);
        add('disc', glow('#ffffff', glint, 1.6), [x, 0.055, z], [0.09, 1, 0.09]);
        add('sphere', glow('#f4f8fa', 0.35 * glint, 1.4), [x, 0.16, z], [0.07, 0.16, 0.07]);
        flatRing(x, z, 0.32, '#e8eef0', 0.55);
        if (coin.t < RING_TIME) {
          const k = coin.t / RING_TIME;
          flatRing(x, z, Math.max(0.15, (COIN_NOISE * k) / T), '#e8eef0', 0.9 * (1 - k));
          flatRing(x, z, COIN_NOISE / T, '#cfd8dc', 0.3 * (1 - k));
        }
      }
    }

    /* Молот кузнеца (слой «г», zhiteli.js), пока лежит у ног стража:
       сталь на рукояти, с бликом — это цель задания, её ищут глазами. */
    const hammer = world.zhiteli && world.zhiteli.hammer;
    if (hammer && !hammer.taken) {
      const x = hammer.x / T, z = hammer.y / T;
      add('cylinder', { color: M.rgb('#7a5532'), emissive: 0.2 }, [x, 0.05, z], [0.035, 0.42, 0.035], [Math.PI / 2, 0.6, 0]);
      add('cube', { color: M.rgb('#c9d2d6'), emissive: 0.5 }, [x + Math.cos(0.6) * 0.2, 0.08, z - Math.sin(0.6) * 0.2], [0.17, 0.09, 0.09], [0, 0.6, 0]);
      flatRing(x, z, 0.32, '#e8eef0', 0.25 + 0.2 * Math.sin(time * 3));
    }

    /* Зона опасности — тот же круг, что у плоского вида (opasnost.js). */
    const zone = dangerZone(world);
    if (zone) {
      const beat = 0.6 + Math.sin(time * 7) * 0.4;
      const x = zone.x / T, z = zone.y / T, r = zone.r / T;
      flatRing(x, z, r, zone.self ? '#ff4d5e' : zone.colour, zone.self ? 0.5 + beat * 0.5 : 0.5, 'thinring', 0.05);
      if (zone.burns) flatRing(x, z, r * 1.35, zone.self ? '#ff4d5e' : '#ff8a3d', 0.25, 'thinring', 0.05);
    }

    /*
     * Подходящее подсвечивается: набрал огонь — обвелась солома и ворота.
     * Решает тот же brokenBy, что и разрушение. Клетки — в пределах
     * видимого: в изометрии пол виден вдвое глубже ширины экрана.
     */
    const spell = player && player.alive && player.stack.length ? spellOf(player.stack) : null;
    if (spell) {
      const traits = spell.substance.traits;
      const beat = 0.5 + Math.sin(time * 4) * 0.18;
      const reach = Math.ceil(spec.tilesAcross);
      const fx = Math.floor(spec.focus[0]), fz = Math.floor(spec.focus[2]);
      for (let ty = Math.max(0, fz - reach); ty <= Math.min(world.h - 1, fz + reach); ty += 1) {
        for (let tx = Math.max(0, fx - reach); tx <= Math.min(world.w - 1, fx + reach); tx += 1) {
          const tile = world.tiles[ty * world.w + tx];
          if (!weakTo(tile) || !brokenBy(tile, traits)) continue;
          add('frame', glow(spell.substance.colour, beat, 1), [tx + 0.5, levelOf(tile) + 0.035, ty + 0.5], [0.86, 1, 0.86]);
        }
      }
    }

    /* Захват цели: кольцо и над целью — чем её брать. */
    if (world.locked) {
      const { x, y } = world.locked;
      flatRing(x / T, y / T, 0.62, '#ffffff', 0.8);
      if (world.locked.prop !== undefined) {
        const need = weakTo(world.tiles[world.locked.prop]) || [];
        const tx = Math.floor(x / T), ty = Math.floor(y / T);
        const top = cellHeight(world, tx, ty) + 0.4;
        need.forEach((trait, k) => {
          const off = (k - (need.length - 1) / 2) * 0.22;
          add('sphere', { color: M.rgb(WEAKNESS_COLOURS[trait] || '#ffffff'), emissive: 1.6, unlit: 1 },
            [x / T + right[0] * off, top, y / T + right[1] * off], [0.07, 0.07, 0.07]);
        });
      }
    }
    return lights;
  }

  /* ---------------- плоская накладка ---------------- */

  function drawOverlay(world, spec, time) {
    const g = overlay;
    const W = size.cssW, H = size.cssH;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, surface.width, surface.height);
    g.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
    const at = (x, y, h) => worldToScreen(spec, [x / T, h, y / T]);

    if (world.fx && world.fx.flash > 0.01) {
      g.fillStyle = `rgba(120,255,214,${world.fx.flash * 0.2})`;
      g.fillRect(0, 0, W, H);
    }

    g.textAlign = 'center';
    g.textBaseline = 'middle';

    const label = (text, s, colour, size = 18) => {
      g.font = `900 ${size}px ui-monospace, Menlo, monospace`;
      g.lineWidth = 4;
      g.strokeStyle = 'rgba(6,8,14,.9)';
      g.strokeText(text, s.x, s.y);
      g.fillStyle = colour;
      g.fillText(text, s.x, s.y);
    };

    /* «?» — страж идёт на шум или обыскивает, «!» — гонится. Цвет — его
       же взгляда (vidimost.js: guardMark, coneTint — у обыска свой). */
    if (world.trevoga) {
      for (const e of world.enemies) {
        const mark = probe.hide.has('marks') ? null : guardMark(e);
        /* 22 точки, а не 18: на телефоне метка была 13–16 точек (замер). */
        if (mark) label(mark, at(e.x, e.y, 1.8), `rgb(${coneTint(e.state)})`, 22);
      }
      /* Место обыска — словом над лиловым кругом на полу (gameLayer). */
      const spots = [];
      for (const e of world.enemies) {
        if (!e.alive || e.downed > 0 || e.state !== 'search' || !e.searchPoint) continue;
        if (spots.some((s) => Math.hypot(s.x - e.searchPoint.x, s.y - e.searchPoint.y) < 8)) continue;
        spots.push(e.searchPoint);
        label('ОБЫСК', at(e.searchPoint.x, e.searchPoint.y, 0.6), `rgb(${coneTint('search')})`, 11);
      }
    }

    /* Свидетель бежит доносить (svideteli.js) — «!» над ним: его ещё можно
       перехватить. */
    for (const civ of world.civilians || []) {
      if (!civ.alive || !civ.witness || civ.witness.state !== 'run' || probe.hide.has('marks')) continue;
      label('!', at(civ.x, civ.y, 1.8), '#ff8c3c', 22);
    }

    /* Сбит с ног толчком стража (tolchok.js) — звёзды над головой. */
    const p = world.player;
    if (p.alive && (p.stun || 0) > 0) {
      for (let i = 0; i < 3; i += 1) {
        const a = time * 7 + (i * Math.PI * 2) / 3;
        const s = at(p.x + Math.cos(a) * 9, p.y + Math.sin(a) * 9, 2.05);
        label('✦', s, '#ffe14d', 17);
      }
    }

    /* Всплывающая плата — в мире, где способ сработал, над местом. */
    for (const mark of world.marks || []) {
      const fade = Math.min(1, mark.life / (mark.max * 0.45));
      const s = at(mark.x, mark.y, 1.3);
      g.globalAlpha = Math.max(0, fade);
      g.font = `800 ${mark.big ? 16 : 13}px ui-monospace, Menlo, monospace`;
      g.lineWidth = 3;
      g.strokeStyle = 'rgba(6,8,14,.85)';
      g.strokeText(mark.text, s.x, s.y);
      g.fillStyle = mark.big ? '#ffe14d' : '#e8f2f6';
      g.fillText(mark.text, s.x, s.y);
    }
    g.globalAlpha = 1;

    /*
     * Стрелка подсказки у края: где — решает ukazatel.js (луч от героя к
     * цели, не под кнопками), здесь — только перевод точек мира в экран
     * через ту же матрицу, которой нарисован кадр. Цель в кадре — её
     * показывает кольцо и стрелка-конус в объёме (scene.js, hintLayer).
     */
    pointer = null;
    const hint = world.hint;
    if (hint && hint.target && world.state === 'play') {
      const target = at(hint.target.x, hint.target.y, 0);
      const anchor = at(world.player.x, world.player.y, 0);
      /* Запас от кнопок — с половину стрелки: ukazatel.js сторожит остриё,
         а тело стрелки (±16 точек) на кадре 844×390 ложилось на кнопку
         ОГНЯ краем. */
      /* Стрелка с 03.10 (второй заход) крупнее — не меньше ACCENT.arrow
         точек и не меньше 0.55 клетки на экране (на компьютере клетка
         крупнее, и лампа рядом крупнее), — сплошная, светлее и со
         свечением: за кадром она и есть акцент кадра. Дышит размером и
         свечением, а не прозрачностью — прозрачная она темнела до 170 из
         255 и проигрывала белому огню ламп. Запас от кнопок — по её телу
         (±0.78 размера). */
      const big = ACCENT.on ? Math.max(ACCENT.arrow, 0.55 * (spec.pxPerUnit || 0)) : 13;
      pointer = hintPointer({ w: W, h: H }, target, { anchor, avoid: avoidRects, pad: Math.max(24, Math.round(big * 0.9 + 10)) });
      if (!pointer.onScreen && !probe.hide.has('hint')) {
        const breath = 0.5 + 0.5 * Math.sin(world.time * 4.2);
        const sizePx = ACCENT.on ? big * (0.92 + 0.16 * breath) : big + breath * 3;
        g.save();
        g.translate(pointer.x, pointer.y);
        g.rotate(pointer.angle);
        g.beginPath();
        g.moveTo(sizePx, 0);
        g.lineTo(-sizePx * 0.7, -sizePx * 0.78);
        g.lineTo(-sizePx * 0.3, 0);
        g.lineTo(-sizePx * 0.7, sizePx * 0.78);
        g.closePath();
        g.lineWidth = 3;
        g.strokeStyle = 'rgba(5,11,12,0.92)';
        g.stroke();
        if (ACCENT.on) {
          g.shadowColor = 'rgba(255,225,77,0.9)';
          g.shadowBlur = 10 + breath * 10;
          g.fillStyle = '#ffe96e';
        } else g.fillStyle = `rgba(255,225,77,${0.75 + 0.25 * breath})`;
        g.fill();
        g.restore();
      }
    }

    talkOverlay(world, g, at, label, W, H);
  }
  let pointer = null;

  /*
   * ЖИТЕЛИ (слой «г») — как у плоского вида (render.js, drawTalkMarks):
   * «…» в облачке над головой у того, кто станет говорить; ярче — он в
   * дальности разговора; «»» — с ним разговор. Под героем — «ГОВОРИТЬ
   * (F) · КУЗНЕЦ». Цель ведомого задания (world.questPin) — бирюзовым
   * кольцом на полу в кадре или стрелкой у края, с подписью словом.
   */
  function talkOverlay(world, g, at, label, W, H) {
    if (!world.zhiteli) return;
    for (const m of speechMarks(world, world.talkNear || null)) {
      const s = at(m.x, m.y, 2.2);
      const big = m.mode !== 'idle';
      const w = big ? 30 : 24, h = big ? 18 : 14;
      const y = s.y - (m.mode === 'near' ? 3 + Math.sin(world.time * 5) * 2 : 0);
      g.save();
      g.globalAlpha = big ? 1 : 0.85;
      g.fillStyle = m.mode === 'talk' ? '#ffe9a8' : '#f2e6c9';
      g.strokeStyle = 'rgba(6,8,14,.92)';
      g.lineWidth = 2;
      if (big) { g.shadowColor = '#f2e6c9'; g.shadowBlur = 12; }
      g.beginPath();
      g.roundRect(s.x - w / 2, y - h / 2, w, h, 5);
      g.moveTo(s.x - 4, y + h / 2);
      g.lineTo(s.x, y + h / 2 + 5);
      g.lineTo(s.x + 4, y + h / 2);
      g.fill();
      g.stroke();
      g.shadowBlur = 0;
      g.fillStyle = '#16120c';
      g.font = `900 ${big ? 14 : 12}px ui-monospace, Menlo, monospace`;
      g.fillText(m.mode === 'talk' ? '»' : '…', s.x, y - (m.mode === 'talk' ? 0 : 2));
      g.restore();
    }

    const p = world.player;
    if (world.talkPrompt && p.alive) {
      const s = at(p.x, p.y, 0);
      g.save();
      g.font = '900 12px ui-monospace, Menlo, monospace';
      const tw = g.measureText(world.talkPrompt.text).width + 16;
      const y = s.y + 30;
      g.fillStyle = 'rgba(7,11,13,.86)';
      g.fillRect(s.x - tw / 2, y - 10, tw, 20);
      g.strokeStyle = '#f2e6c9';
      g.lineWidth = 1;
      g.strokeRect(s.x - tw / 2, y - 10, tw, 20);
      g.fillStyle = '#f2e6c9';
      g.fillText(world.talkPrompt.text, s.x, y);
      g.restore();
    }

    questPin = null;
    const pin = world.questPin;
    if (!pin || world.state !== 'play') return;
    const target = at(pin.x, pin.y, 0);
    /* Стрелку подсказки ступени обходит, как кнопку: две в одном месте
       ложились одна на другую (кадр 03.10). */
    const avoid = pointer && !pointer.onScreen ? [...avoidRects, { x: pointer.x - 22, y: pointer.y - 22, w: 44, h: 44 }] : avoidRects;
    questPin = hintPointer({ w: W, h: H }, target, { anchor: at(p.x, p.y, 0), avoid, pad: 24 });
    const breath = 0.5 + 0.5 * Math.sin(world.time * 3.4);
    let lx = questPin.x, ly = questPin.y;
    g.save();
    if (questPin.onScreen) {
      g.lineWidth = 2.5;
      g.setLineDash([6, 5]);
      g.strokeStyle = `rgba(127,252,255,${0.55 + 0.35 * breath})`;
      g.beginPath();
      g.ellipse(questPin.x, questPin.y, 22 + breath * 3, 11 + breath * 1.5, 0, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
      ly = questPin.y - 26;
    } else {
      const sizePx = 12 + breath * 3;
      g.save();
      g.translate(questPin.x, questPin.y);
      g.rotate(questPin.angle);
      g.beginPath();
      g.moveTo(sizePx, 0);
      g.lineTo(-sizePx * 0.7, -sizePx * 0.78);
      g.lineTo(-sizePx * 0.3, 0);
      g.lineTo(-sizePx * 0.7, sizePx * 0.78);
      g.closePath();
      g.lineWidth = 3;
      g.strokeStyle = 'rgba(5,11,12,0.92)';
      g.stroke();
      g.fillStyle = `rgba(127,252,255,${0.75 + 0.25 * breath})`;
      g.fill();
      g.restore();
      lx = questPin.x - Math.cos(questPin.angle) * 30;
      ly = questPin.y - Math.sin(questPin.angle) * 22;
    }
    label(pin.label, { x: lx, y: ly }, '#7ffcff', 11);
    g.restore();
  }
  let questPin = null;

  /* ---------------- камера: клавиши, колесо, кнопки ---------------- */

  function cameraAct(act) {
    /* Кнопка камеры — тоже ввод: первый кадр и взгляд на цель уступают
       руке игрока («0» — стандартный вид, первый кадр и есть он). */
    if (act !== 'home') intro.cancel = true;
    skipGlance();
    if (act === 'left') camera.rotate(-1);
    else if (act === 'right') camera.rotate(1);
    else if (act === 'in') camera.zoomBy(0.25);
    else if (act === 'out') camera.zoomBy(-0.25);
    else if (act === 'home') camera.reset();
  }

  /* Колесо: тачпад шлёт мелкие доли, мышь — крупные щелчки. */
  surface.addEventListener('wheel', (event) => {
    camera.zoomBy(Math.max(-0.25, Math.min(0.25, -event.deltaY * 0.0022)));
    event.preventDefault();
  }, { passive: false });

  /*
   * Кнопки камеры. Касание кнопки до холста не доходит (кнопка лежит
   * поверх), поэтому стики её не путают с ходьбой и прицелом. Жестов
   * двумя пальцами в игре нет нарочно: два пальца здесь — это ходьба и
   * прицел разом, и щипок от них не отличить.
   */
  /*
   * Одна кнопка КАМЕРА раскрывает пять (index.html, #camToggle): свёрнуты
   * с начала — пять квадратов в углу первым делом читались отладочной
   * панелью (приёмка Глаз 03.10). Клавиши камеры работают и при свёрнутой.
   */
  const toggle = doc.getElementById('camToggle');
  const setCamOpen = (open) => {
    if (!options.buttons) return;
    options.buttons.hidden = !open;
    if (toggle) {
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.dataset.open = open ? '1' : '0';
    }
  };
  if (options.buttons && toggle) {
    toggle.hidden = false;
    setCamOpen(false);
    toggle.addEventListener('click', (event) => {
      setCamOpen(options.buttons.hidden);
      event.currentTarget.blur();
    });
  }
  if (options.buttons) {
    if (!toggle) options.buttons.hidden = false;
    for (const button of options.buttons.querySelectorAll('[data-cam]')) {
      button.addEventListener('click', (event) => {
        cameraAct(button.dataset.cam);
        event.currentTarget.blur();
      });
    }
  }

  /* ---------------- экран → мир ---------------- */

  const yawNow = () => (lastSpec ? lastSpec.yaw : camera.state.yaw);

  function toWorld(x, y) {
    const hit = lastSpec && bakedFor ? pickWorld(lastSpec, bakedFor, x, y) : null;
    if (hit) return { x: hit.x, y: hit.y, kind: hit.kind };
    const p = bakedFor ? bakedFor.player : { x: 0, y: 0 };
    return { x: p.x, y: p.y, kind: 'none' };
  }

  /* ---------------- пульт для проверок ---------------- */

  const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
  const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * q))] : 0; };

  const debug = {
    get spec() { return lastSpec; },
    get camera() { return camera; },
    get pointer() { return pointer; },
    /* Стрелка ведомого задания (слой «г») — как pointer, для проверок. */
    get questPin() { return questPin; },
    /* Первый кадр и взгляд на цель — для замеров (вес, фаза). */
    get intro() { return { k: intro.k, out: intro.out, since: intro.since, target: intro.target }; },
    get glance() { return { t: glance.t, g: glance.t === null ? 0 : glanceCurve(glance.t), cut: Boolean(glance.cut), target: glance.target, seen: [...glance.seen] }; },
    /* Точка мира (точки мира, высота в клетках) → экран, CSS-пиксели от угла холста. */
    project(x, y, h = 0) { return lastSpec ? worldToScreen(lastSpec, [x / T, h, y / T]) : null; },
    pick(x, y) { return lastSpec && bakedFor ? pickWorld(lastSpec, bakedFor, x, y) : null; },
    cam({ step, zoom } = {}) { camera.set({ step, zoom }); snapNext = true; return { step: camera.state.step, zoom: camera.state.zoom }; },
    /* Щуп замеров (см. probe выше). Меняет только отрисовку; мир не трогает. */
    probe(options = {}) {
      if ('clock' in options) probe.clock = options.clock;
      if ('hide' in options) probe.hide = new Set(options.hide || []);
      if ('voidMask' in options && Boolean(options.voidMask) !== probe.voidMask) {
        probe.voidMask = Boolean(options.voidMask);
        if (bakedFor) rebake(bakedFor);
      }
      return { clock: probe.clock, hide: [...probe.hide], voidMask: probe.voidMask };
    },
    /* Нарисовать кадр сейчас, мимо кадрового цикла игры (для замера при
       остановленном цикле). */
    redraw() { if (bakedFor) draw(bakedFor); return Boolean(bakedFor); },
    act: cameraAct,
    /* Время кадра: отрисовка на процессоре и промежутки между кадрами. */
    frames() {
      return { n: stats.drawMs.length, drawMedianMs: +median(stats.drawMs).toFixed(2), drawP95Ms: +pct(stats.drawMs, 0.95).toFixed(2),
        gapMedianMs: +median(stats.gaps).toFixed(2), gapP95Ms: +pct(stats.gaps, 0.95).toFixed(2) };
    },
    /* n кадров подряд с ожиданием видеокарты (readPixels одной точки). */
    measure(n = 60) {
      if (!bakedFor) return null;
      const one = new Uint8Array(4), times = [];
      for (let i = 0; i < n; i += 1) {
        const t0 = performance.now();
        draw(bakedFor);
        gl.gl.readPixels(0, 0, 1, 1, gl.gl.RGBA, gl.gl.UNSIGNED_BYTE, one);
        times.push(performance.now() - t0);
      }
      return { n, medianMs: +median(times).toFixed(2), p95Ms: +pct(times, 0.95).toFixed(2), width: gl.width, height: gl.height,
        calls: gl.stats.calls, triangles: Math.round(gl.stats.triangles) };
    },
  };

  return {
    iso: true,
    resize,
    draw,
    invalidate() { snapNext = true; },
    toWorld,
    setAvoid(rects) { avoidRects = rects || []; },
    /* Мышь для рамки клетки под указателем; null — мышью не целятся. */
    pointer(m) { mouse = m ? { x: m.x, y: m.y } : null; },
    screenMove(mx, my, fromStick) {
      return fromStick ? stickToWorld(yawNow(), camera.mode.pitch, mx, my) : keysToWorld(yawNow(), mx, my);
    },
    screenAngle(angle) { return screenAngleToWorld(yawNow(), camera.mode.pitch, angle); },
    cameraAct,
    debug,
  };
}
