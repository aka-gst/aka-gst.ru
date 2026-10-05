// 17.3 · Нырок в программу через экран. Сергей 02.10: «игры типа питонио
// можно делать в экране компа» и «через дип программу мож? тогда
// визуализация всего будет адекватно смотреться!». So: walk up to the
// laptop/PC, E -- the camera zooms into its screen (that is only the
// transition), then the deep-program dive (the same spiral as the chip in
// Shift 1, first-shift-dive.js) and you are INSIDE the program: the editor
// and the live picture of what the code does, full size. Esc / «ВЫНЫРНУТЬ»
// surfaces you back at the computer, and the room reacts to how it went.
//
// Pure timeline + state machine; tools/fp-world.test.mjs drives it.

export const SCREEN_TIMELINE = Object.freeze({
  zoom: 650, // walk-in: the camera flies into the screen
  dive: 1500, // DEEP · ВВОД · spiral
  surface: 1300, // «ГЛУБИНА, ГЛУБИНА, Я НЕ ТВОЙ…» + Doom melt back into the room
});

export const SCREEN_WORDS = Object.freeze({
  deep: 'DEEP',
  enter: 'ВВОД',
  inside: 'ПОГРУЖЕНИЕ...',
  exit: 'ГЛУБИНА, ГЛУБИНА, Я НЕ ТВОЙ...',
});

export function createScreenState() {
  return { phase: 'walk', program: null, since: 0, result: null };
}

// Events: 'enter' (with program), 'tick', 'cancel', 'inside', 'surface'
// (with result). Returns a new state; illegal events leave it unchanged.
export function screenStep(state, event, now = 0, payload = {}) {
  const s = { ...state };
  const age = (now - state.since) / (state.speed > 0 ? state.speed : 1);
  switch (event) {
    case 'enter':
      if (state.phase !== 'walk' || !payload.program) return state;
      // 17.4: a better VR device dives faster (vr-devices.js `dive`).
      return { phase: 'zoom', program: payload.program, since: now, result: null, speed: payload.speed > 0 ? payload.speed : 1 };
    case 'tick':
      // The home PC zooms onto its desktop first: you pick a program there.
      if (state.phase === 'zoom' && age >= SCREEN_TIMELINE.zoom) return { ...s, phase: state.program === 'menu' ? 'menu' : 'dive', since: now };
      if (state.phase === 'dive' && age >= SCREEN_TIMELINE.dive) return { ...s, phase: 'inside', since: now };
      if (state.phase === 'surface' && age >= SCREEN_TIMELINE.surface) return { ...s, phase: 'walk', since: now, program: null };
      return state;
    case 'cancel': // Esc during the zoom or on the desktop: step back.
      if (state.phase === 'zoom' || state.phase === 'menu') return { ...s, phase: 'walk', program: null, since: now };
      return state;
    case 'choose': // a program picked on the PC's desktop
      if (state.phase !== 'menu' || !payload.program) return state;
      return { ...s, phase: 'dive', program: payload.program, since: now };
    case 'surface':
      if (state.phase !== 'inside' && state.phase !== 'dive') return state;
      return { ...s, phase: 'surface', since: now, result: payload.result ?? null };
    default:
      return state;
  }
}

// 0..1 progress of the current phase.
export function screenProgress(state, now) {
  const ms = SCREEN_TIMELINE[state.phase] * (state.speed > 0 ? state.speed : 1);
  if (!ms) return state.phase === 'inside' ? 1 : 0;
  return Math.max(0, Math.min(1, (now - state.since) / ms));
}

// Does the walking world take input / draw normally?
export const screenBlocksWalk = (state) => state.phase !== 'walk';
export const screenHidesWorld = (state) => state.phase === 'inside';

// The camera pose during the zoom: from where you stand toward a point just
// in front of the screen, looking straight at it. Smoothstep.
export function zoomPose(from, screen, k) {
  const e = k * k * (3 - 2 * k);
  const dx = screen.x - from.x, dz = screen.z - from.z;
  const len = Math.hypot(dx, dz) || 1;
  const stop = 0.32; // metres in front of the glass
  const tx = screen.x - (dx / len) * stop, tz = screen.z - (dz / len) * stop;
  const targetYaw = Math.atan2(dx, -dz);
  let dy = targetYaw - from.yaw;
  while (dy > Math.PI) dy -= Math.PI * 2;
  while (dy < -Math.PI) dy += Math.PI * 2;
  return {
    x: from.x + (tx - from.x) * e,
    z: from.z + (tz - from.z) * e,
    yaw: from.yaw + dy * e,
    eye: from.eye + (screen.y - from.eye) * e,
    pitch: from.pitch * (1 - e),
    fov: 80 - 38 * e,
  };
}
