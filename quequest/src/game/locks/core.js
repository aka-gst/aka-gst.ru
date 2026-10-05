// Ядро замка из «Вскрытия» (/vskrytie/lock-core), перенесённое в QueQuest.
//
// Это ВЫДУМАННЫЙ игровой механизм в духе мини-игр Thief / Oblivion / Skyrim,
// а не инструкция к настоящим замкам. Модель нарочно условная:
//   pressure  — «натяжение» (0..100) на воротке;
//   sector    — номер штифта в рамке устройства (0..N-1);
//   pattern   — какой штифт этот механизм «просит» следующим и в какой
//               полосе натяжения он садится (полосы и порядок придуманы для
//               каждого устройства мастерской Сани);
//   falseEcho — «заклинило»: подняли не тот штифт, нужно отпустить вороток;
//   trick     — штифт-обманка: сначала даёт ложную посадку, садится по-
//               настоящему только на чуть ослабленном натяжении;
//   drift     — полоса «плывёт» во времени (ритм);
//   strainLimit — стойкое устройство само сбрасывается, если его мучить;
//   tempo     — посаженный штифт держится ограниченное время.
// Всё чистое: функции возвращают новое состояние, время t передаётся
// явно (секунды) — тесты: tools/lock-core.test.mjs.

const freeze = Object.freeze;

// Учебный механизм пилота — без изменений (на нём четыре исходных теста).
export const TRAINING_PATTERN = freeze([
  freeze({ sector: 2, min: 40, max: 56 }),
  freeze({ sector: 4, min: 60, max: 74 }),
  freeze({ sector: 1, min: 30, max: 42 }),
]);

const step = (sector, min, max, extra = {}) => freeze({ sector, min, max, ...extra });

// Устройства «доски Сани»: вымышленные марки нашего города. Сложность растёт
// по одной идее за раз.
export const MECHANISMS = freeze([
  freeze({ id: 'sota', brand: 'СОТА-1', title: 'Учебная сота', tier: 1, sectors: 5, pattern: TRAINING_PATTERN,
    idea: 'Три штифта, широкие полосы. Найди натяжение, где штифт отвечает, и поднимай по одному.' }),
  freeze({ id: 'meduza', brand: 'МЕДУЗА-4', title: 'Четыре щупальца', tier: 2, sectors: 6,
    pattern: freeze([step(3, 34, 46), step(0, 52, 62), step(5, 44, 54), step(1, 64, 74)]),
    idea: 'Четыре штифта и полосы уже. Здесь ценится спокойная рука.' }),
  freeze({ id: 'obmanka', brand: 'ЛИСА-3', title: 'Хитрые штифты', tier: 3, sectors: 6,
    pattern: freeze([step(4, 46, 58), step(1, 40, 52, { trick: true }), step(2, 56, 66, { trick: true })]),
    idea: 'Штифты-обманки: «садятся» понарошку. Ослабь натяжение — и подними их ещё раз.' }),
  freeze({ id: 'mayak', brand: 'МАЯК-Д', title: 'Плавающая полоса', tier: 4, sectors: 6,
    pattern: freeze([step(2, 42, 58), step(5, 48, 64), step(0, 38, 54)]), drift: freeze({ amp: 10, period: 6 }),
    idea: 'Полоса натяжения плывёт туда-сюда. Лови ритм, а не цифру.' }),
  freeze({ id: 'chasovoy', brand: 'ЧАСОВОЙ', title: 'Защищает себя', tier: 5, sectors: 7,
    pattern: freeze([step(6, 40, 52), step(2, 54, 64), step(4, 36, 46, { trick: true }), step(0, 58, 68)]), strainLimit: 3, tempo: 9,
    idea: 'Три грубые ошибки — и он сам всё сбрасывает. Посаженные штифты держатся 9 секунд.' }),
  freeze({ id: 'kit', brand: 'КИТ-6', title: 'Мастерская работа', tier: 6, sectors: 8,
    pattern: freeze([step(5, 44, 56), step(1, 50, 60, { trick: true }), step(7, 38, 50), step(3, 56, 66), step(0, 46, 56, { trick: true })]),
    drift: freeze({ amp: 7, period: 7 }), strainLimit: 4, tempo: 11,
    idea: 'Всё сразу: плывущая полоса, обманки, самосброс и темп. Экзамен Сани.' }),
]);
export const MECHANISM_IDS = freeze(MECHANISMS.map((m) => m.id));
export const mechanismById = (id) => MECHANISMS.find((m) => m.id === id) ?? null;

// How far the trick pin wants the tension eased below its band.
export const EASE_DEPTH = 14;

export function createLock(spec = {}) {
  return {
    id: spec.id ?? 'training',
    sectors: spec.sectors ?? 5,
    pattern: spec.pattern ?? TRAINING_PATTERN,
    drift: spec.drift ?? null,
    strainLimit: spec.strainLimit ?? 0,
    tempo: spec.tempo ?? 0,
    pressure: 0,
    progress: 0,
    setSectors: [],
    falseEcho: false,
    trickPending: null, // sector that gave a false set and waits for eased tension
    strain: 0,
    seized: false,
    lastSetAt: null,
    phase: 'reading',
    lastEvent: 'waiting',
  };
}

export function setPressure(lock, pressure) {
  return { ...lock, pressure: Math.max(0, Math.min(100, Math.round(pressure))) };
}

export function releasePressure(lock) {
  return {
    ...lock,
    pressure: 0,
    falseEcho: false,
    trickPending: null,
    seized: false,
    strain: Math.max(0, lock.strain - 2),
    phase: lock.phase === 'opened' ? 'opened' : 'reading',
    lastEvent: 'released',
  };
}

// The working band of the next pin at time t (drift moves it, rhythmically).
export function bandAt(lock, t = 0) {
  const target = lock.pattern[lock.progress];
  if (!target) return null;
  let shift = 0;
  if (lock.drift) shift = Math.round(lock.drift.amp * Math.sin((2 * Math.PI * t) / lock.drift.period + lock.progress * 1.3));
  return { sector: target.sector, min: target.min + shift, max: target.max + shift, trick: Boolean(target.trick) };
}

// 0..1: how "alive" the tool feels right now -- the hum the overlay plays.
// Peaks in the middle of the band; a jammed or opened lock is silent.
export function feel(lock, t = 0) {
  if (lock.phase === 'opened' || lock.falseEcho || lock.seized || lock.pressure <= 0) return 0;
  const band = bandAt(lock, t);
  if (!band) return 0;
  const center = (band.min + band.max) / 2, half = (band.max - band.min) / 2;
  return Math.max(0, Math.min(1, 1 - Math.abs(lock.pressure - center) / (half + 14)));
}

// Seconds left before the last set pin slips (tempo devices), or null.
export function tempoLeft(lock, t = 0) {
  if (!lock.tempo || !lock.progress || lock.lastSetAt === null || lock.phase === 'opened') return null;
  return Math.max(0, lock.tempo - (t - lock.lastSetAt));
}

function strained(lock, event) {
  const strain = lock.strain + 1;
  if (lock.strainLimit && strain >= lock.strainLimit) {
    // A sturdier device protects itself: everything drops, it needs a release.
    return result({ ...lock, strain: 0, progress: 0, setSectors: [], seized: true, falseEcho: false, trickPending: null, lastSetAt: null, phase: 'seized', lastEvent: 'seized' }, 'seized');
  }
  if (event === 'false-echo') return result({ ...lock, strain, falseEcho: true, phase: 'false-echo', lastEvent: 'false-echo' }, 'false-echo');
  return result({ ...lock, strain, phase: 'reading', lastEvent: event }, event);
}

// Lift one pin (sector) at the current tension, at time t (seconds).
export function probeSector(lock, sector, t = 0) {
  if (lock.phase === 'opened') return result(lock, 'opened');
  if (lock.seized || lock.falseEcho) return result({ ...lock, lastEvent: 'blocked' }, 'blocked');

  // Tempo: a set pin only holds for so long.
  const slip = tick(lock, t);
  if (slip.event) return slip;

  const band = bandAt(lock, t);

  // A trick pin that already gave its false set: it wants eased tension.
  if (lock.trickPending !== null) {
    if (sector !== lock.trickPending) return strained({ ...lock, trickPending: null }, 'false-echo');
    if (lock.pressure >= band.min) return result({ ...lock, phase: 'false-set', lastEvent: 'false-set' }, 'false-set');
    if (lock.pressure < band.min - EASE_DEPTH) return result({ ...lock, trickPending: null, phase: 'reading', lastEvent: 'dropped' }, 'dropped');
    return setPin({ ...lock, trickPending: null }, sector, t);
  }

  if (lock.pressure < band.min) return result({ ...lock, phase: 'reading', lastEvent: 'light' }, 'light');
  if (lock.pressure > band.max) return strained(lock, 'hard');
  if (sector !== band.sector) return strained(lock, 'false-echo');
  if (band.trick) return result({ ...lock, trickPending: sector, phase: 'false-set', lastEvent: 'false-set' }, 'false-set');
  return setPin(lock, sector, t);
}

// Time passing on its own: on a tempo device the last set pin slips back.
export function tick(lock, t = 0) {
  if (tempoLeft(lock, t) !== 0) return result(lock, null);
  const setSectors = lock.setSectors.slice(0, -1);
  return result({ ...lock, progress: lock.progress - 1, setSectors, trickPending: null, lastSetAt: setSectors.length ? t : null, phase: 'reading', lastEvent: 'relock' }, 'relock');
}

function setPin(lock, sector, t) {
  const setSectors = [...lock.setSectors, sector];
  const progress = lock.progress + 1;
  const opened = progress === lock.pattern.length;
  return result({
    ...lock,
    progress,
    setSectors,
    lastSetAt: t,
    phase: opened ? 'opened' : 'reading',
    lastEvent: opened ? 'opened' : 'set',
  }, opened ? 'opened' : 'set');
}

function result(lock, event) {
  return { lock, event };
}

// ---------------------------------------------------- the lift (timing)
// Oblivion-style: pressing a pin starts a lift; the pin rises, hangs at the
// top for a moment and falls back. The press that "sets" must land while the
// pin is in the top window. Pure: phase of a lift started at t0, seen at t.
export const LIFT = freeze({ rise: 0.32, hold: 0.22, fall: 0.38 });
export function liftAt(t0, t, lift = LIFT) {
  if (t0 === null || t0 === undefined) return { h: 0, window: false, done: true };
  const d = t - t0;
  if (d < 0) return { h: 0, window: false, done: false };
  if (d < lift.rise) { const k = d / lift.rise; return { h: 1 - (1 - k) * (1 - k), window: k > 0.8, done: false }; }
  if (d < lift.rise + lift.hold) return { h: 1, window: true, done: false };
  const f = (d - lift.rise - lift.hold) / lift.fall;
  if (f < 1) return { h: 1 - f * f, window: false, done: false };
  return { h: 0, window: false, done: true };
}

// Repeat attempts after the first opening get a shuffled copy: same idea,
// other pins, bands nudged. Deterministic by seed.
export function variant(spec, seed = 1) {
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  const rnd = () => { s = (s * 48271) % 2147483647; return s / 2147483647; };
  const order = Array.from({ length: spec.sectors }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const pattern = spec.pattern.map((p) => { const n = Math.round(rnd() * 12) - 6; return freeze({ ...p, sector: order[p.sector], min: p.min + n, max: p.max + n }); });
  return freeze({ ...spec, pattern: freeze(pattern), seed });
}
