// 19.4 · Руки на заводе (canon §21). Pure data and pure rules, no DOM:
// tools/fists.test.mjs.
//
// The owner's idea: on the factory you walk with your HANDS from the first
// frame, like a weapon in Doom. You can start a fight with anyone right away
// -- and everybody beats you up. So you take a crate into those hands. Three
// crates make you angry enough, and on that anger you can beat the boss.
//
// first-shift.js keeps the state machine (stepFirstShift: 'punch', 'wake',
// anger on 'drop', the fight's push gain); this file holds the lines, the
// numbers and the deeds the badges read.

export const ANGER_FULL = 3;
// How far a fist reaches (metres, from the eye); the raycaster's E reach is 2.1.
export const PUNCH_REACH = 1.55;
// How many punches a worker takes before he answers: the first one is a warning.
export const PUNCHES_TO_BEATING = 2;
// Phases where the fists are free (not a dialogue, not the fight's own bar).
export const PUNCH_PHASES = Object.freeze(['manual', 'report', 'choice']);
export const WORKER_IDS = Object.freeze(['welder', 'fitter', 'electrician', 'lunch']);

// The fight with the boss (1 · 2 · 3 · БАМ): a push on the beat right after
// БАМ gains this much of the meter. Without anger he simply outweighs you;
// on full anger two clean hits put him on the floor.
export function fightGain(anger = 0) {
  const a = Math.max(0, Math.min(ANGER_FULL, Number(anger) || 0));
  return 7 + a * 6; // 7 · 13 · 19 · 25
}
export const FIGHT_MISS = 9;
export const angerFull = (anger) => (Number(anger) || 0) >= ANGER_FULL;

// Each worker: the warning after the first punch, the line as he lays you
// out, and who picks you up afterwards (with what).
export const WORKER_FISTS = Object.freeze({
  welder: Object.freeze({
    warn: 'Ты чего, сдурел? Я с горелкой стою. Ещё раз — и сварю.',
    beat: 'Ну всё. Огрёб, новенький.',
    waker: 'fitter',
    wake: 'Новенький, ты чего? Сварщика трогать — себе дороже.',
  }),
  fitter: Object.freeze({
    warn: 'Ещё раз махнёшь — получишь ключом.',
    beat: 'Предупреждал. Ключом.',
    waker: 'lunch',
    wake: 'Новенький, ты чего? (жуёт) Он же с ключом.',
  }),
  electrician: Object.freeze({
    warn: 'Не трогай! Я под напряжением, нас обоих шибанёт.',
    beat: 'Сам напросился. Двести двадцать!',
    waker: 'welder',
    wake: 'Новенький, ты чего? Электрика бить — током бьёт.',
  }),
  lunch: Object.freeze({
    warn: 'Ты на мой обед покусился?! (жуёт) Отойди.',
    beat: 'ОБЕД — СВЯТОЕ!',
    waker: 'electrician',
    wake: 'Новенький, ты чего? У него обед. Это святое.',
  }),
});

export const BOSS_FISTS = Object.freeze({
  swat: 'Ха! Сначала поработай.',
  swatAgain: 'Ха-ха. Ящики сами себя не перенесут. Сначала поработай.',
  angry: 'Ты на кого руку поднял, а?!',
  knocked: 'Ай! Ты чего… ты чего злой такой?!',
});

// What the hero mutters when his fists hit something that is not a person.
export const THUD_LINES = Object.freeze({
  crate: 'БУМ. Ящик качнулся. Ящику не больно.',
  wall: 'БУМ. Стена победила.',
  air: '',
  busy: 'Руки заняты — ящик.',
});

// The status line under the hands.
export function angerLabel(anger = 0) {
  const a = Math.max(0, Math.min(ANGER_FULL, Number(anger) || 0));
  if (a >= ANGER_FULL) return 'ЗЛОСТЬ · ПОЛНАЯ';
  return `ЗЛОСТЬ · ${a}/${ANGER_FULL}`;
}

// Badges (canon §20 + §21). Deeds are flags the first shift raises; the
// «whole hall» one is cumulative across runs: every worker type has beaten
// you at least once.
export const FIST_FLAGS = Object.freeze({
  beatenBy: (who) => `beatenBy-${who}`,
  angerWin: 'angerBossWin',
  cleanHands: 'cleanHands3',
});
export function beatenByAll(flags = {}) {
  return WORKER_IDS.every((id) => Boolean(flags[FIST_FLAGS.beatenBy(id)]));
}
