/*
 * ТЕХНОМАГИЯ — камера над миром.
 *
 * Решение Сергея 03.10, 04:00 (docs/ЕВГЕНИЙ-ЛЕСТНИЦА-2026-10-03.md §7):
 * основной вид — изометрия как в Ultima Online, стандартный ракурс по
 * умолчанию; камеру можно иногда повернуть; стены не закрывают героя; от
 * BG3 — приближение, чтобы было видно, на что наложено заклинание и что
 * оно сделало. Отсюда устройство:
 *
 *   uo  — ОСНОВНОЙ. Ортографическая, классический угол (поворот 45°,
 *         наклон 30°). Поворот — шагами по 90° с плавным переходом: у
 *         изометрии четыре честных ракурса, промежуточные углы ломают
 *         сетку и ничего не дают. Приближение — от общего плана (~20
 *         клеток по ширине компьютера) до крупного (~6,5 клетки), где
 *         читаются предметы и цель заклинания. Одна кнопка возвращает
 *         стандартный ракурс и общий план.
 *   bg3 — пилотная перспектива, оставлена для сравнения кадров; шаг
 *         поворота у неё 45°.
 *
 * Слежение — по образцу общей камеры Vanta (engine/runtime3d/
 * camera-controller.js, vanta-forge 4f5246b): мягкое догоняние через
 * экспоненциальное затухание и потолок отставания, чтобы герой не уходил
 * из кадра на рывке.
 *
 * Модуль чистый: ни DOM, ни WebGL. Поэтому всё, что в нём считается, —
 * луч из пальца на пол, оси «вверх по экрану», срез стен, наезд —
 * проверяется в Node без браузера (pilot-vid/test-kamera.mjs).
 */

import * as M from './math.js';

const DEG = Math.PI / 180;

/* Нижняя граница приближения: чуть дальше общего плана — мир большой,
   и иногда нужно окинуть взглядом соседний двор. Верхняя (1) — крупный. */
export const ZOOM_MIN = -0.35;
export const ZOOM_MAX = 1;

export const MODES = {
  uo: { ortho: true, yaw: 45 * DEG, pitch: 30 * DEG, turnStep: 90 * DEG, closeTiles: 6.5 },
  bg3: { ortho: false, yaw: -28 * DEG, pitch: 55 * DEG, fov: 35 * DEG, distance: 12, turnStep: 45 * DEG, lead: 1.6 },
};

/* Плавный поворот: разгон и торможение, а не экспонента. Экспонента
   дёргает в начале — кадр прыгает на треть угла за первый же кадр. */
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const TURN_TIME = 0.42;

function clampLag(current, desired, maxLag) {
  const d = Math.hypot(current[0] - desired[0], current[1] - desired[1], current[2] - desired[2]);
  if (d <= maxLag || d < 1e-9) return current;
  const s = maxLag / d;
  return current.map((v, i) => desired[i] + (v - desired[i]) * s);
}

/*
 * Точек на клетку для общего плана и для крупного. Общий — от короткой
 * стороны экрана, как в пилоте: на телефоне клетка не становится
 * горошиной. Крупный — ~6,5 клетки по ширине, но не меньше чем вдвое
 * ближе общего: на узком телефоне иначе «крупный» почти не отличался бы.
 */
export function zoomScale(viewport, zoom, mode = MODES.uo) {
  const short = Math.min(viewport.cssWidth, viewport.cssHeight);
  /*
   * portraitTiles (игра, igra.js; пилот — без него): на телефоне стоя
   * общий план считается от ширины — столько клеток поперёк. От короткой
   * стороны выходило 31 точка на клетку, упиралось в нижний порог 36, и
   * маг был 47–53 точки ростом при метках в 7–8 (приёмка Глаз 03.10).
   */
  const portrait = mode.portraitTiles && viewport.cssHeight > viewport.cssWidth * 1.15;
  const overview = portrait ? M.clamp(viewport.cssWidth / mode.portraitTiles, 36, 64) : M.clamp(short / 12.5, 36, 64);
  const close = Math.max(viewport.cssWidth / (mode.closeTiles || 6.5), overview * 2);
  return overview * Math.pow(close / overview, zoom);
}

/*
 * Наезд по событию (за флагом ?punch=1): мир изменился — камера на миг
 * подъезжает к месту и возвращается. Кривая — подъезд, задержка, отъезд.
 */
export const PUNCH = { in: 0.32, hold: 0.55, out: 0.5, zoom: 0.55, pull: 0.45 };
function punchCurve(t) {
  if (t < 0) return 0;
  if (t < PUNCH.in) return easeInOut(t / PUNCH.in);
  if (t < PUNCH.in + PUNCH.hold) return 1;
  const u = (t - PUNCH.in - PUNCH.hold) / PUNCH.out;
  return u >= 1 ? 0 : 1 - easeInOut(u);
}
export const PUNCH_LENGTH = PUNCH.in + PUNCH.hold + PUNCH.out;

export function createCamera(modeName, options = {}) {
  const mode = { ...(MODES[modeName] || MODES.uo), ...(options.portraitTiles ? { portraitTiles: options.portraitTiles } : {}) };
  const yaw0 = Number.isFinite(options.yaw) ? options.yaw * DEG : mode.yaw;
  const state = {
    name: MODES[modeName] ? modeName : 'uo',
    base: yaw0,
    step: 0,
    yaw: yaw0,
    turn: null,           /* { from, to, t } — идущий поворот */
    twist: null,          /* живой поворот двумя пальцами: смещение в радианах */
    zoom: 0,
    zoomGoal: 0,
    focus: null,
    clock: 0,
    punch: null,          /* { x, z, t0 } */
    persp: Number(options.persp) || 0,
  };
  const yawOfStep = (step) => state.base + step * mode.turnStep;

  function startTurn(to) {
    state.turn = { from: state.yaw, to, t: 0 };
  }

  return {
    state,
    mode,
    /* dir: +1 / -1 — шаг поворота. Знак выбран так, что +1 крутит мир на
       экране по часовой (проверка: test-kamera.mjs, «знак поворота»). */
    rotate(dir) {
      state.step += Math.sign(dir) || 0;
      startTurn(yawOfStep(state.step));
    },
    /* Живой поворот двумя пальцами: мир идёт за пальцами, на отпускании
       встаёт на ближайший из четырёх ракурсов. */
    twist(offset) {
      if (offset === null) {
        if (!state.twist) return;
        const live = state.yaw;
        state.step = Math.round((live - state.base) / mode.turnStep);
        state.twist = null;
        state.turn = { from: live, to: yawOfStep(state.step), t: 0 };
        return;
      }
      state.twist = offset;
      state.turn = null;
      state.yaw = yawOfStep(state.step) + offset;
    },
    zoomBy(delta) { state.zoomGoal = M.clamp(state.zoomGoal + delta, ZOOM_MIN, ZOOM_MAX); },
    zoomTo(z, snap = false) {
      state.zoomGoal = M.clamp(z, ZOOM_MIN, ZOOM_MAX);
      if (snap) state.zoom = state.zoomGoal;
    },
    /* Стандартный ракурс и общий план — одной кнопкой. */
    reset() {
      const nearest = Math.round((state.yaw - state.base) / (Math.PI * 2)) * Math.PI * 2;
      state.base += nearest;
      state.step = 0;
      state.twist = null;
      startTurn(yawOfStep(0));
      state.zoomGoal = 0;
    },
    /* Поставить ракурс сразу, без перехода: для съёмки и проверок. */
    set({ step, zoom } = {}) {
      if (Number.isFinite(step)) { state.step = step; state.yaw = yawOfStep(step); state.turn = null; state.twist = null; }
      if (Number.isFinite(zoom)) { state.zoomGoal = M.clamp(zoom, ZOOM_MIN, ZOOM_MAX); state.zoom = state.zoomGoal; }
    },
    punchAt(x, z) { state.punch = { x, z, t0: state.clock }; },

    /*
     * hero — точка в клетках (x, z). snap — поставить, а не довести: для
     * съёмки камера ставится, иначе первый кадр ловит её на полпути.
     */
    update(hero, dt, viewport, snap = false, bounds = null) {
      state.clock += dt;
      if (state.turn) {
        state.turn.t += dt;
        const k = snap ? 1 : Math.min(1, state.turn.t / TURN_TIME);
        state.yaw = M.lerp(state.turn.from, state.turn.to, easeInOut(k));
        if (k >= 1) state.turn = null;
      }
      state.zoom = snap ? state.zoomGoal : M.damp(state.zoom, state.zoomGoal, 12, dt);

      /* Наезд: приближение и сдвиг точки взгляда к месту события. */
      let punchK = 0, punchFocus = null;
      if (state.punch) {
        const t = state.clock - state.punch.t0;
        punchK = punchCurve(t);
        if (t > PUNCH_LENGTH) state.punch = null;
        else punchFocus = [state.punch.x, state.punch.z];
      }

      const lead = mode.lead || 0;
      let tx = hero[0] - Math.sin(state.yaw) * lead, tz = hero[1] - Math.cos(state.yaw) * lead;
      if (punchFocus) {
        tx = M.lerp(tx, punchFocus[0], punchK * PUNCH.pull);
        tz = M.lerp(tz, punchFocus[1], punchK * PUNCH.pull);
      }
      /* Карта, а не пустота за ней (bounds — размер этажа в клетках). */
      let introK = 0, introZoom = state.zoom;
      if (bounds && mode.ortho) {
        const z0 = M.clamp(state.zoom + punchK * PUNCH.zoom, ZOOM_MIN, ZOOM_MAX + 0.15);
        const ppu = zoomScale(viewport, z0, mode);
        [tx, tz] = frameFocus([tx, tz], hero, state.yaw, mode.pitch, viewport.cssWidth / ppu / 2, viewport.cssHeight / ppu / 2, bounds);
        /*
         * Первый кадр (bounds.intro, igra.js): герой и цель подсказки
         * вместе. Вес k — от igra.js: 1, пока игрок не сдвинулся, к нулю за
         * INTRO.ease после первого шага. Смесь точки взгляда и плана, а не
         * переключение: иначе потолок отставания (clampLag) рванул бы кадр.
         */
        const intro = bounds.intro;
        if (INTRO.on && intro && intro.k > 0 && intro.target) {
          const f = introFrame({ hero, target: intro.target, yaw: state.yaw, pitch: mode.pitch, viewport, mode, zoom: state.zoom, bounds, avoid: intro.avoid });
          introK = M.clamp(intro.k, 0, 1);
          introZoom = f.zoom;
          tx = M.lerp(tx, f.focus[0], introK);
          tz = M.lerp(tz, f.focus[1], introK);
        }
        /*
         * Взгляд на цель (bounds.glance, igra.js): короткий проезд к цели
         * подсказки и обратно, вес g — кривая glanceCurve. Кадр сдвигается
         * ровно настолько, чтобы цель легла внутрь с запасом.
         */
        const glance = bounds.glance;
        if (glance && glance.g > 0 && glance.target) {
          const f = glanceFrame({ from: [tx, tz], target: glance.target, yaw: state.yaw, pitch: mode.pitch, viewport, mode, zoom: M.lerp(state.zoom, introZoom, introK), avoid: glance.avoid });
          tx = M.lerp(tx, f[0], glance.g);
          tz = M.lerp(tz, f[1], glance.g);
        }
      }
      const target = [tx, 0.55, tz];
      if (!state.focus || snap) state.focus = target.slice();
      else {
        for (let i = 0; i < 3; i += 1) state.focus[i] = M.damp(state.focus[i], target[i], 9, dt);
        state.focus = clampLag(state.focus, target, 1.2);
      }
      const zoom = M.clamp(M.lerp(state.zoom, introZoom, introK) + punchK * PUNCH.zoom, ZOOM_MIN, ZOOM_MAX + 0.15);
      const pitch = mode.pitch;
      const dir = [Math.sin(state.yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(state.yaw) * Math.cos(pitch)];
      const aspect = viewport.width / viewport.height;
      const focus = state.focus;
      let proj, eye, pointScale = 0, fogRange, tilesAcross, ortho = mode.ortho, pxPerUnit;

      if (mode.ortho) {
        pxPerUnit = zoomScale(viewport, zoom, mode);
        const halfW = viewport.cssWidth / pxPerUnit / 2;
        const halfH = viewport.cssHeight / pxPerUnit / 2;
        tilesAcross = halfW * 2;
        fogRange = [Math.max(halfW, halfH) * 1.15, Math.max(halfW, halfH) * 2.2];
        /*
         * Лёгкая перспектива на крупном плане (за флагом ?persp=1): угол
         * растёт только в последней трети приближения, а масштаб в точке
         * взгляда остаётся тем же — переход не дёргает кадр.
         */
        const blend = state.persp * M.clamp((zoom - 0.6) / 0.4, 0, 1);
        if (blend > 0.01) {
          const fov = blend * 28 * DEG;
          const dist = halfH / Math.tan(fov / 2);
          proj = M.perspective(fov, aspect, Math.max(0.2, dist - 60), dist + 90);
          eye = focus.map((v, i) => v + dir[i] * dist);
          ortho = false;
        } else {
          proj = M.ortho(halfW, halfH, 1, 200);
          eye = focus.map((v, i) => v + dir[i] * 80);
          pointScale = 1 / (halfH * 2);
        }
      } else {
        const distance = mode.distance * Math.pow(0.55, zoom) * (aspect < 1 ? 1.15 : 1);
        const vfov = aspect >= 1 ? mode.fov : 2 * Math.atan(Math.tan(mode.fov / 2) / aspect);
        proj = M.perspective(vfov, aspect, 0.3, 120);
        eye = focus.map((v, i) => v + dir[i] * distance);
        tilesAcross = 2 * distance * Math.tan(vfov / 2) * aspect;
        pxPerUnit = viewport.cssWidth / tilesAcross;
        fogRange = [distance * 0.95, distance * 1.9];
      }
      const view = M.lookAt(eye, focus);
      const viewProj = M.multiply(proj, view);

      return {
        view, proj, viewProj, eye, focus: focus.slice(), ortho, viewDir: dir, pointScale,
        fogRange, cut: cutSpec(hero, state.yaw, pitch), yaw: state.yaw, pitch, tilesAcross, pxPerUnit,
        zoom, step: state.step, punch: punchK,
        cssWidth: viewport.cssWidth, cssHeight: viewport.cssHeight,
      };
    },
  };
}

/* ---------------------------------------------------------
   КАДР В ПРЕДЕЛАХ КАРТЫ
   ---------------------------------------------------------
   Приёмка Глаз 03.10: на старте «Башни» камера стояла по центру героя, а
   герой — в углу карты, и половину поля на телефоне занимала земля за
   оградой (замер пустоты 51%). Точка взгляда теперь сдвигается так,
   чтобы прямоугольник кадра на полу лежал внутри карты, — но герой при
   этом не уходит из средней части кадра (keep — доля половины кадра по
   каждой оси). Где карта меньше кадра — середина карты по этой оси.

   Прямоугольник кадра на полу: ширина — по экранному «вправо», глубина —
   по экранному «вверх», halfH / sin(наклона): пол в изометрии виден
   вглубь вдвое дальше высоты экрана. Середина кадра на полу лежит на
   0.55 / tg(наклона) «выше» точки взгляда (взгляд — на высоте 0.55).
   --------------------------------------------------------- */

export function frameFocus(target, hero, yaw, pitch, halfW, halfH, bounds, keep = 0.55) {
  /* Вверх и вниз от середины — свои доли (bounds.keepUp, keepDown): боком
     и на компьютере верх кадра занят шапкой задачи, низ — тостом
     подсказки, и герой под ними пропадал. */
  const keepDown = Number.isFinite(bounds.keepDown) ? bounds.keepDown : keep;
  const keepUp = Number.isFinite(bounds.keepUp) ? bounds.keepUp : keep;
  const right = [Math.cos(yaw), -Math.sin(yaw)];
  const up = [-Math.sin(yaw), -Math.cos(yaw)];
  const R = halfW, U = halfH / Math.max(0.2, Math.sin(pitch));
  const lift = 0.55 / Math.max(0.2, Math.tan(pitch));
  /* Середина кадра на полу. */
  let cx = target[0] + up[0] * lift, cz = target[1] + up[1] * lift;
  const ex = R * Math.abs(right[0]) + U * Math.abs(up[0]);
  const ez = R * Math.abs(right[1]) + U * Math.abs(up[1]);
  cx = bounds.w > 2 * ex ? M.clamp(cx, ex, bounds.w - ex) : bounds.w / 2;
  cz = bounds.h > 2 * ez ? M.clamp(cz, ez, bounds.h - ez) : bounds.h / 2;
  /* Герой — в средней части кадра: по экранным осям не дальше keep. */
  const hr = (hero[0] - cx) * right[0] + (hero[1] - cz) * right[1];
  const hu = (hero[0] - cx) * up[0] + (hero[1] - cz) * up[1];
  const sr = hr - M.clamp(hr, -keep * R, keep * R);
  const su = hu - M.clamp(hu, -keepDown * U, keepUp * U);
  cx += right[0] * sr + up[0] * su;
  cz += right[1] * sr + up[1] * su;
  return [cx - up[0] * lift, cz - up[1] * lift];
}

/* ---------------------------------------------------------
   ПЕРВЫЙ КАДР: ГЕРОЙ И ЦЕЛЬ ПОДСКАЗКИ ВМЕСТЕ
   ---------------------------------------------------------
   Приёмка Глаз 03.10, второй заход: на старте «Башни» телефон стоя видел
   мага в левой нижней четверти, справа — плоские крыши стен, а ворота —
   цель первой подсказки — были за кадром: на них показывала только
   жёлтая стрелка у края. Ракурс не трогается (стандартный UO по
   умолчанию — решение Сергея), место старта тоже. Первый кадр ставится
   так, чтобы в нём были и герой (ступни и голова), и цель, с запасом от
   краёв и мимо кнопок (avoid — прямоугольники кнопок в точках холста).
   Если вдвоём они при текущем плане не помещаются, план отъезжает шагами
   INTRO.step, но не дальше INTRO.minZoom; не помещаются и так — кадр
   сдвигается к цели, насколько позволяет обычное правило «герой в
   средней части» (frameFocus): виден хотя бы край двора в сторону цели.
   Сколько держать и как отпускать — igra.js (первый шаг или INTRO.hold
   секунд, затем INTRO.ease секунд плавно к обычному слежению).

   Считается в осях экрана: c — точка пола в середине кадра; точка мира p
   на высоте y ложится на экран в
     x = W/2 + ((p − c)·right)·ppu
     y = H/2 − (((p − c)·up)·sin(наклона) + y·cos(наклона))·ppu,
   то есть для каждой точки допустимые c — отрезок по каждой оси, и всё
   решение — пересечение отрезков. Формула сверяется с worldToScreen в
   pilot-vid/test-kamera.mjs, раздел 8.

   INTRO.on = false — поломка для проверок: первый кадр прежний (обычное
   слежение), замер «ворота в кадре» обязан покраснеть.
   --------------------------------------------------------- */

export const INTRO = { on: true, hold: 6, ease: 0.9, minZoom: ZOOM_MIN, step: 0.025, margin: 34, wide: 0.1, heroTop: 1.6, pad: 8 };

/* Отрезок допустимых c по одной оси для набора точек; null — пусто. */
function span(list) {
  let lo = -Infinity, hi = Infinity;
  for (const [a, b] of list) { lo = Math.max(lo, a); hi = Math.min(hi, b); }
  return lo <= hi ? [lo, hi] : null;
}

/*
 * Герою — три пояса по очереди, и каждый пробуется на всех планах от
 * текущего до INTRO.minZoom, прежде чем взять следующий:
 *   keep — обычное правило (frameFocus: 0.55 половины кадра вбок, по
 *          высоте — доли bounds.keepUp/keepDown). Где цель и так влезает
 *          (компьютер, телефон боком), первый кадр совпадает с обычным;
 *   wide — не ближе INTRO.wide ширины к краю;
 *   edge — не ближе INTRO.margin точек.
 * Так план отъезжает, только если иначе герой прижат к краю, и герой
 * прижимается к краю, только если иначе цель не влезает вовсе.
 */
export function introFrame({ hero, target, yaw, pitch, viewport, mode = MODES.uo, zoom = 0, bounds = null, avoid = [] }) {
  const W = viewport.cssWidth, H = viewport.cssHeight;
  const right = [Math.cos(yaw), -Math.sin(yaw)];
  const up = [-Math.sin(yaw), -Math.cos(yaw)];
  const s = Math.max(0.2, Math.sin(pitch)), co = Math.cos(pitch);
  const lift = 0.55 / Math.max(0.2, Math.tan(pitch));
  const dot = (p, a) => p[0] * a[0] + p[1] * a[1];
  const toFocus = (cr, cu) => [right[0] * cr + up[0] * cu - up[0] * lift, right[1] * cr + up[1] * cu - up[1] * lift];
  const m = INTRO.margin;
  const keepUp = bounds && Number.isFinite(bounds.keepUp) ? bounds.keepUp : 0.55;
  const keepDown = bounds && Number.isFinite(bounds.keepDown) ? bounds.keepDown : 0.55;
  const hr = dot(hero, right), hu = dot(hero, up);
  const goal = { r: dot(target, right), u: dot(target, up), y: 0, box: [m, W - m, m, H - m] };
  const tiers = {
    keep: [W / 2 - 0.55 * W / 2, W / 2 + 0.55 * W / 2, H / 2 - keepUp * H / 2, H / 2 + keepDown * H / 2],
    wide: [INTRO.wide * W, (1 - INTRO.wide) * W, m, H - m],
    edge: [m, W - m, m, H - m],
  };
  /* Допустимые c по осям для точки p в прямоугольнике экрана box. */
  const rangeR = (p, ppu) => [p.r - (p.box[1] - W / 2) / ppu, p.r - (p.box[0] - W / 2) / ppu];
  const rangeU = (p, ppu) => [p.u - ((H / 2 - p.box[2]) / ppu - p.y * co) / s, p.u - ((H / 2 - p.box[3]) / ppu - p.y * co) / s];
  const screenOf = (p, cr, cu, ppu) => ({ x: W / 2 + (p.r - cr) * ppu, y: H / 2 - ((p.u - cu) * s + p.y * co) * ppu });
  /* Середина, которую выбрала бы карта: между героем и целью, кадр в
     пределах этажа (та же развёртка прямоугольника кадра, что frameFocus). */
  const mid = [(hero[0] + target[0]) / 2, (hero[1] + target[1]) / 2];
  const preferred = (ppu) => {
    if (!bounds) return [dot(mid, right), dot(mid, up)];
    const f = frameFocus([mid[0] - up[0] * lift, mid[1] - up[1] * lift], mid, yaw, pitch, W / ppu / 2, H / ppu / 2, { w: bounds.w, h: bounds.h }, 1);
    return [dot(f, right) + 0, dot(f, up) + lift];
  };
  const floor = Math.min(zoom, INTRO.minZoom);
  const zooms = [];
  for (let z = zoom; z > floor + 1e-9; z -= INTRO.step) zooms.push(z);
  zooms.push(floor);

  for (const tier of ['keep', 'wide', 'edge']) {
    const box = tiers[tier];
    /* Ступни — в поясе героя, голова — не выше края кадра с запасом. */
    const pts = [
      { r: hr, u: hu, y: 0, box },
      { r: hr, u: hu, y: INTRO.heroTop, box: [box[0], box[1], m, H - m] },
      goal,
    ];
    const hits = (cr, cu, ppu) => pts.some((p) => {
      const q = screenOf(p, cr, cu, ppu);
      return avoid.some((a) => q.x >= a.x - INTRO.pad && q.x <= a.x + a.w + INTRO.pad && q.y >= a.y - INTRO.pad && q.y <= a.y + a.h + INTRO.pad);
    });
    for (const z of zooms) {
      const ppu = zoomScale(viewport, z, mode);
      const sr = span(pts.map((p) => rangeR(p, ppu)));
      const su = span(pts.map((p) => rangeU(p, ppu)));
      if (!sr || !su) continue;
      const [pr, pu] = preferred(ppu);
      const cr = M.clamp(pr, sr[0], sr[1]), cu = M.clamp(pu, su[0], su[1]);
      if (!hits(cr, cu, ppu)) return { focus: toFocus(cr, cu), zoom: z, fits: true, tier };
      /* Под кнопкой — ближайшее к выбранному место без кнопок. */
      let best = null;
      for (let i = 0; i <= 8; i += 1) for (let j = 0; j <= 8; j += 1) {
        const r = M.lerp(sr[0], sr[1], i / 8), u = M.lerp(su[0], su[1], j / 8);
        if (hits(r, u, ppu)) continue;
        const d = Math.hypot((r - cr) * ppu, (u - cu) * ppu * s);
        if (!best || d < best.d) best = { r, u, d };
      }
      if (best) return { focus: toFocus(best.r, best.u), zoom: z, fits: true, tier };
    }
  }
  /* Не помещаются: план прежний, кадр сдвинут к цели по обычному правилу. */
  const ppu = zoomScale(viewport, zoom, mode);
  const toward = [mid[0] - up[0] * lift, mid[1] - up[1] * lift];
  const focus = bounds ? frameFocus(toward, hero, yaw, pitch, W / ppu / 2, H / ppu / 2, bounds) : toward;
  return { focus, zoom, fits: false, tier: null };
}

/* ---------------------------------------------------------
   ВЗГЛЯД НА ЦЕЛЬ И ОБРАТНО
   ---------------------------------------------------------
   Приёмка Глаз 03.10, второй заход: в зале подсказка «ЩИТОК ПОЛЯ ЗА
   ПРОПАСТЬЮ», а щиток — за краем кадра, и где он, говорит только
   стрелка. Когда такая подсказка приходит, камера коротко проезжает
   туда, где щиток виден, и возвращается (igra.js: какие ступени, когда
   и чем прерывается — любым вводом). Кадр сдвигается от обычного ровно
   настолько, чтобы цель легла внутрь с запасом GLANCE.margin долей
   половины кадра, — не дальше нужного. Длина — GLANCE.out + hold + back,
   не больше полутора секунд (проверка — test-kamera.mjs, раздел 9).
   --------------------------------------------------------- */

export const GLANCE = { out: 0.4, hold: 0.65, back: 0.4, margin: 0.5, ease: 0.25, pad: 14, lift: 1.2 };
export const GLANCE_LENGTH = GLANCE.out + GLANCE.hold + GLANCE.back;

export function glanceCurve(t) {
  if (t <= 0 || t >= GLANCE_LENGTH) return 0;
  if (t < GLANCE.out) return easeInOut(t / GLANCE.out);
  if (t < GLANCE.out + GLANCE.hold) return 1;
  return 1 - easeInOut((t - GLANCE.out - GLANCE.hold) / GLANCE.back);
}

/*
 * Точка взгляда, при которой цель (её верх с лучом — GLANCE.lift клетки
 * над полом) лежит в средней части кадра (доля GLANCE.margin половины) и
 * не под кнопками, тостом и объявлением (avoid, точки холста). Из всех
 * таких мест — ближайшее к тому, куда цель легла бы при самом коротком
 * сдвиге: камера едет не дальше нужного.
 */
export function glanceFrame({ from, target, yaw, pitch, viewport, mode = MODES.uo, zoom = 0, avoid = [] }) {
  const W = viewport.cssWidth, H = viewport.cssHeight;
  const ppu = zoomScale(viewport, zoom, mode);
  const s = Math.max(0.2, Math.sin(pitch)), co = Math.cos(pitch);
  const right = [Math.cos(yaw), -Math.sin(yaw)];
  const up = [-Math.sin(yaw), -Math.cos(yaw)];
  const lift = 0.55 / Math.max(0.2, Math.tan(pitch));
  const dot = (p, a) => p[0] * a[0] + p[1] * a[1];
  const c = [from[0] + up[0] * lift, from[1] + up[1] * lift];
  const tr = dot(target, right), tu = dot(target, up);
  /* Где цель на экране при точке пола c (cr, cu). */
  const at = (cr, cu) => ({ x: W / 2 + (tr - cr) * ppu, y: H / 2 - ((tu - cu) * s + GLANCE.lift * co) * ppu });
  const cOf = (q) => [tr - (q.x - W / 2) / ppu, tu - ((H / 2 - q.y) / ppu - GLANCE.lift * co) / s];
  const k = 1 - GLANCE.margin;
  const now = at(dot(c, right), dot(c, up));
  const q0 = { x: M.clamp(now.x, W / 2 - k * W / 2, W / 2 + k * W / 2), y: M.clamp(now.y, H / 2 - k * H / 2, H / 2 + k * H / 2) };
  const blocked = (q) => avoid.some((a) => q.x >= a.x - GLANCE.pad && q.x <= a.x + a.w + GLANCE.pad && q.y >= a.y - GLANCE.pad && q.y <= a.y + a.h + GLANCE.pad);
  let q = q0;
  if (blocked(q0)) {
    let best = null;
    for (let i = 0; i <= 10; i += 1) for (let j = 0; j <= 10; j += 1) {
      const cand = { x: M.lerp(0.15 * W, 0.85 * W, i / 10), y: M.lerp(0.15 * H, 0.85 * H, j / 10) };
      if (blocked(cand)) continue;
      const d = Math.hypot(cand.x - q0.x, cand.y - q0.y);
      if (!best || d < best.d) best = { q: cand, d };
    }
    if (best) q = best.q;
  }
  const [cr, cu] = cOf(q);
  return [right[0] * cr + up[0] * cu - up[0] * lift, right[1] * cr + up[1] * cu - up[1] * lift];
}

/* ---------------------------------------------------------
   СРЕЗ СТЕН
   ---------------------------------------------------------
   Стена между камерой и героем опускается до пенька прямо в вершинном
   шейдере (engine.js, VS) по «якорю» — центру своей клетки. Здесь та же
   формула на JS: шейдер не умеет отвечать обратно, а знать высоту среза
   нужно и сцене (фонарь на срезанной стене гаснет), и проверкам. Две
   копии одной формулы — менять обе разом; test-kamera.mjs сверяет их на
   сетке точек.

   Что опускается: клетка, лежащая между героем и камерой (вдоль взгляда
   впереди него), в полосе ±radius по ширине экрана, и при этом такая
   близкая, что луч от ступней героя к камере над ней не проходит. Клетка,
   в которой герой стоит сам (дверной проём), опускается всегда: перемычка
   над головой закрывает шляпу.
   --------------------------------------------------------- */

export const WALL_H = 1.6;

export function cutSpec(hero, yaw, pitch) {
  const dir = [Math.sin(yaw), Math.cos(yaw)];
  return {
    center: [hero[0], 0, hero[1]],
    dir,
    /* Тангенс наклона: на сколько поднимается луч к камере на клетку. */
    depth: Math.tan(pitch),
    /* Полоса по ширине экрана, где срез полный, и мягкий край за ней. */
    radius: 1.15,
    soft: 0.5,
    /* Высота пенька. */
    low: 0.3,
    /* Полуширина клетки вдоль взгляда: у диагонального ракурса угол
       клетки ближе к камере, чем середина её стороны. */
    extent: (Math.abs(dir[0]) + Math.abs(dir[1])) / 2,
    on: true,
  };
}

const smooth = (a, b, x) => { const t = M.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/* Доля среза клетки с якорем (ax, az): 0 — стоит целиком, 1 — пенёк. */
export function cutAmount(cut, ax, az) {
  if (!cut || !cut.on) return 0;
  const rx = ax - cut.center[0], rz = az - cut.center[2];
  const along = rx * cut.dir[0] + rz * cut.dir[1];
  const side = Math.abs(rx * cut.dir[1] - rz * cut.dir[0]);
  const dist = Math.hypot(rx, rz);
  const lateral = 1 - smooth(cut.radius, cut.radius + cut.soft, side);
  const front = Math.max(smooth(-0.15, 0.3, along), 1 - smooth(0.6, 0.9, dist));
  /* Высота, которую позволяет луч от ступней: над дальним краем клетки. */
  const allowed = (along - cut.extent) * cut.depth + 0.12;
  const need = 1 - smooth(WALL_H - 0.25, WALL_H + 0.35, allowed);
  return lateral * front * need;
}

/* Высота, до которой опущена клетка. */
export function cutLimit(cut, ax, az) {
  const k = cutAmount(cut, ax, az);
  return k <= 0 ? 10 : M.lerp(WALL_H + 0.02, cut.low, k);
}

/* ---------------------------------------------------------
   ЭКРАН ↔ ПОЛ
   --------------------------------------------------------- */

/*
 * Экранное направление «вверх» и «вправо» на полу: WASD ходят по экрану,
 * а не по сторонам света — иначе после поворота камеры W ведёт вбок.
 * Возвращает векторы в клетках мира (x, y мира = x, z сцены).
 */
export function groundAxes(yaw) {
  const up = [-Math.sin(yaw), -Math.cos(yaw)];
  const right = [Math.cos(yaw), -Math.sin(yaw)];
  return { up, right };
}

/* Точка мира → точка экрана в CSS-пикселях (то, что видит палец). */
export function worldToScreen(spec, p) {
  const v = M.transform(spec.viewProj, [p[0], p[1], p[2], 1]);
  const nx = v[0] / v[3], ny = v[1] / v[3];
  return { x: (nx * 0.5 + 0.5) * spec.cssWidth, y: (0.5 - ny * 0.5) * spec.cssHeight, depth: v[3] };
}

/*
 * Точка экрана (CSS-пиксели от левого верхнего угла холста) → точка на
 * полу (y = 0) в клетках и клетка под ней. Для прицела и наведения:
 * считается обращением той же матрицы, которой рисуется кадр, поэтому
 * верна при любом повороте, приближении и перспективе. Возвращает null,
 * если луч пол не пересекает.
 */
export function screenToGround(spec, cssX, cssY, height = 0) {
  const inv = spec.invViewProj || (spec.invViewProj = M.invert(spec.viewProj));
  if (!inv) return null;
  const nx = (cssX / spec.cssWidth) * 2 - 1;
  const ny = 1 - (cssY / spec.cssHeight) * 2;
  const a = M.transform(inv, [nx, ny, -1, 1]);
  const b = M.transform(inv, [nx, ny, 1, 1]);
  const p0 = [a[0] / a[3], a[1] / a[3], a[2] / a[3]];
  const p1 = [b[0] / b[3], b[1] / b[3], b[2] / b[3]];
  const dy = p1[1] - p0[1];
  if (Math.abs(dy) < 1e-9) return null;
  const t = (height - p0[1]) / dy;
  const x = p0[0] + (p1[0] - p0[0]) * t;
  const z = p0[2] + (p1[2] - p0[2]) * t;
  return { x, z, tx: Math.floor(x), ty: Math.floor(z) };
}
