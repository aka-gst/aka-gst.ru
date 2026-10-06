/*
 * ТЕХНОМАГИЯ — ходьба фигур в изометрии (отзыв Сергея 04.10, п.6:
 * «нет анимации ходьбы»).
 *
 * До 05.10 маг и жители скользили по полу неподвижной куклой. Теперь шаг
 * считается из того, сколько фигура прошла на самом деле (позиция мира
 * между кадрами отрисовки), а не из нажатых клавиш: упёрся в стену —
 * ноги стоят; толкнуло взрывом — шагов нет, только скольжение не дольше
 * одного кадра. Фаза растёт с пройденным путём, поэтому шаг не «буксует»:
 * быстрее идёшь — чаще шагаешь, длина шага растёт с темпом.
 *
 * Что двигается (scene.js, makeFigure): ступни под балахоном — вперёд и
 * назад по очереди с подъёмом; рукава — навстречу ногам; корпус — вверх
 * дважды за цикл и вбок раз; чуть вперёд на ходу. Стоит — ничего из
 * этого, только дыхание (корпус на 1% выше-ниже раз в три секунды).
 *
 * Чистый модуль: ни WebGL, ни DOM. Проверка — tests/hodba.mjs.
 */

export const WALK = {
  on: true,
  /* Клеток на цикл (две ступни) при темпе v клеток/с: 1.2 + 0.3·v.
     Герой (6 кл/с) — 2 цикла в секунду, патруль (2 кл/с) — 1.1. */
  strideBase: 1.2,
  strideGrow: 0.3,
  /* Темп, при котором размах полный (клеток в секунду). */
  fullSpeed: 2.4,
  /* Размах — с кадра дыма v9: при 0.13 клетки ступня на общем плане
     компьютера выходила из-под подола на 2–3 точки и шаг не читался. */
  bob: 0.07,
  roll: 0.12,
  lean: 0.12,
  arm: 0.8,
  foot: 0.19,
  lift: 0.09,
  breathe: 0.012,
  /* Больше этого за кадр — не шаг, а перенос (кольцо, постановка). */
  jump: 1.5,
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createGait(seed = 0) {
  return { phase: 0, speed: 0, x: null, z: null, t: null, seed };
}

/*
 * Кадр: x, z — где фигура сейчас (клетки), time — часы отрисовки (с).
 * Часы стоят (щуп замера) — поза не меняется: кадры совпадают.
 */
export function stepGait(gait, x, z, time) {
  if (gait.x === null) {
    gait.x = x; gait.z = z; gait.t = time;
    return walkPose(gait, time);
  }
  const dt = clamp(time - gait.t, 0, 0.1);
  let d = Math.hypot(x - gait.x, z - gait.z);
  gait.x = x; gait.z = z; gait.t = time;
  if (d > WALK.jump) d = 0;
  if (dt > 0) {
    const v = d / dt;
    /* Темп сглажен (≈0.1 с): кадр без сдвига посреди ходьбы не роняет ноги. */
    gait.speed += (v - gait.speed) * (1 - Math.exp(-dt * 10));
    if (gait.speed < 0.05 && d === 0) gait.speed = 0;
  }
  const stride = WALK.strideBase + WALK.strideGrow * gait.speed;
  gait.phase = (gait.phase + (d / stride) * Math.PI * 2) % (Math.PI * 2 * 1000);
  return walkPose(gait, time);
}

export function walkPose(gait, time) {
  const k = WALK.on ? clamp(gait.speed / WALK.fullSpeed, 0, 1) : 0;
  const s = Math.sin(gait.phase), c = Math.cos(gait.phase);
  return {
    k,
    bob: Math.abs(s) * WALK.bob * k,
    roll: s * WALK.roll * k,
    lean: WALK.lean * k,
    armL: -s * WALK.arm * k,
    armR: s * WALK.arm * k,
    footL: s * WALK.foot * k,
    footR: -s * WALK.foot * k,
    liftL: Math.max(0, c) * WALK.lift * k,
    liftR: Math.max(0, -c) * WALK.lift * k,
    breathe: (1 - k) * Math.sin(time * 2.1 + gait.seed) * WALK.breathe,
  };
}
