import { CRATE_PAY } from './config.js';
import { createRenderer, bakeLightmap, rgb, cellAt } from './raycaster.js';
import {
  buildFactoryMap, PILE, SPOTS, WORKER_SPOTS, LAMPS, EYE, CRATE_H, BELT_H, DOOR_H, HALL_CEIL,
  castCenter, viewIndex, localToWorld, nearBossDoor,
} from './first-shift-map.js';
import { drawText, textWidth } from './pixel-font.js';
import { loadAtlas } from './first-shift-atlas.js';
import { createDiveFx, diveStageAt, DIVE_MS, DIVE_TIMELINE, DIVE_VISIONS, DIVE_WORDS, DIVE_THOUGHT } from './first-shift-dive.js';
import { createBody, moveBody, stepBody, jump, landingDip, clampPitch, pitchShear } from './fp-body.js';
import { createChatter, createMomentWatcher } from './npc-chatter.js';
import { drawSpeech, surfaceOf, dressHall, subtitleFloorRow } from './fp-overlay.js';
import { onReleaseKeys } from './key-guard.js';
import { drawFace, faceIdFor } from './faces.js';
import { REFLEXES, fightBeat, BAR_BEATS } from './gamer-reflex.js';
import { ANGER_FULL, PUNCH_PHASES, PUNCHES_TO_BEATING, WORKER_FISTS, BOSS_FISTS, fightGain, FIGHT_MISS, angerFull, angerLabel, PUNCH_REACH, THUD_LINES, FIST_FLAGS } from './fists.js';
import { createHands, drawHands, handsPose, swing, CRACK_AT_MS, KO_MS } from './fp-hands.js';
import { armDeadIn, OPENING_LINES, OPENING_FLAGS, SHOCK_WORDS, SHOCK_THOUGHT, DEEP_CODE, pryStep, pryRelease, pryFromSlide } from './opening.js';
import { paintChildLock, paintWakeButton, buildArmSprites, armPoseAt } from './arm-art.js';

// One price for a crate across the whole game; the first shift pays the same piece rate.
export const FIRST_SHIFT_PAY = CRATE_PAY;

const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const wrapAngle = (value) => {
  let v = value;
  while (v > Math.PI) v -= TAU;
  while (v < -Math.PI) v += TAU;
  return v;
};

const FIGHT_WIN_METER = 100;
const FIGHT_LOSE_METER = 0;
// 19.4 (§21): the push gain comes from anger (fists.js fightGain): three
// crates = full anger = two clean hits after БАМ put him down.
const FIGHT_MISS_LOSS = FIGHT_MISS;

// 29.09: Сергей's script -- "ты три ящика таскаешь под его надзором". 19.5
// (§22): then «Медленно!», the slam on the table by the arm, the child-lock,
// the shock. The pile is 9 (PILE in first-shift-map.js); the other 6 are what
// the arm takes over once the shock wakes it.
const MANUAL_DELIVERY_TARGET = 3;
function crateStack() {
  const crates = [];
  for (const { cx, cz, count } of PILE) {
    for (let level = count - 1; level >= 0; level--) {
      crates.push({ id: `${cz}-${cx}-${level}`, x: cx + 0.5, z: cz + 0.5, cx, cz, level, delivered: false });
    }
  }
  return crates;
}

export function createFirstShiftState() {
  return {
    phase: 'briefing', delivered: 0, carrying: null, bossBeat: 0, complete: false,
    // 19.5 (§22) the new start: the child-lock on the arm's casing pops loose
    // on the boss's slam, you pry it off (0..1), the button, the shock.
    lockLoose: false, pry: 0, lockOff: false, shocked: false, armAwake: false,
    fightMeter: 50, fightWon: null, asks: {}, lastAsk: null,
    // 19.4 (§21) the hands: anger from delivered crates, who you punched, who
    // laid you out, and whether you are on the floor right now.
    anger: 0, hits: {}, beatenBy: {}, punchedPeople: 0, bossSwats: 0, ko: null, lastPunch: null, angerWin: false, cleanHands: false, fightOnAnger: false,
    player: { x: SPOTS.spawn.x, z: SPOTS.spawn.z, yaw: SPOTS.spawn.yaw },
    crates: crateStack(),
  };
}

// Crates still standing in a pile cell (not carried, not delivered).
export function pileCount(state, cx, cz) {
  return state.crates.filter((c) => c.cx === cx && c.cz === cz && !c.delivered && c.id !== state.carrying).length;
}

export function topCrateId(state, cx, cz) {
  const left = state.crates
    .filter((c) => c.cx === cx && c.cz === cz && !c.delivered && c.id !== state.carrying)
    .sort((a, b) => b.level - a.level);
  return left[0]?.id ?? null;
}

// 29.09: Сергей -- "Когда не работает эта рука, можно подойти к ним, E нажать,
// попросить помочь таскать ящики или попросить починить руку. Все
// отмахиваются". Nobody agrees; each refuses in their own way, and repeat
// asks get shorter. No author moral in here, just people at work.
export const FIRST_SHIFT_WORKERS = Object.freeze({
  welder: Object.freeze({
    title: 'СВАРЩИК',
    greet: 'Не видишь — варю. Чего тебе?',
    carry: ['Я тебе грузчик, что ли? У меня шов остывает.', 'Сказал же — занят. Шов, понимаешь? Шов.', 'Ещё раз подойдёшь — прижгу.'],
    fix: ['Рука? Это не сварка, это электроника. Не моё.', 'Могу приварить её к полу, чтоб не падала. Надо?', 'Не моё. Иди к электрику.'],
  }),
  fitter: Object.freeze({
    title: 'СЛЕСАРЬ',
    greet: 'Ну?',
    carry: ['Мне бы свою трубу добить. Она с утра течёт.', 'Таскай сам, ты молодой.', 'Отстань, а.'],
    fix: ['Я по трубам. У неё там мозги, а не трубы.', 'Постучать могу. Ключом. Поможет вряд ли.', 'Не моё, сказал же.'],
  }),
  electrician: Object.freeze({
    title: 'ЭЛЕКТРИК',
    greet: 'Ничего тут не трогай. Чего хотел?',
    carry: ['Я электрик. Ящики — не электричество.', 'У меня тут фаза гуляет. Иди-иди.', 'Не мешай, шибанёт — обоих.'],
    fix: ['Питание на ней есть. Подключили, настроили — а она не хочет. Это не ко мне.', 'Я всё прозвонил. Ток идёт. Дальше — не моё, там мозги.', 'Сказал — не ко мне.'],
  }),
  lunch: Object.freeze({
    title: 'ГРУЗЧИК',
    greet: 'Мм? (жуёт)',
    carry: ['Обед у меня. Святое. На часы глянь — одиннадцать. Самое время.', 'Видишь бутерброд? Вот когда не увидишь — тогда.', 'Обед, говорю. Часы же висят.'],
    fix: ['Я её не ломал. Я вообще обедаю.', 'Её утром привезли. Стоит, как памятник. Красивая.', 'Обед!'],
  }),
});
export const WORKER_TOPICS = Object.freeze({ carry: 'ПОМОГИ С ЯЩИКАМИ', fix: 'ПОЧИНИ РУКУ' });
const ASK_PHASES = ['manual', 'report', 'slam', 'lock', 'button'];

export function firstShiftWorkerLine(worker, topic, n = 0) {
  const w = FIRST_SHIFT_WORKERS[worker];
  if (!w) return null;
  if (topic === 'greet') return [w.title, w.greet, 'НИЧЕГО'];
  const lines = w[topic];
  if (!lines) return null;
  return [w.title, lines[Math.min(lines.length - 1, Math.max(0, n))], 'ЯСНО'];
}

export function stepFirstShift(state, action) {
  const s = { ...state, player: { ...state.player }, crates: state.crates.map((c) => ({ ...c })) };
  if (action === 'briefing-done' && s.phase === 'briefing') { s.phase = 'manual'; return s; }
  if (action?.type === 'pick' && s.phase === 'manual' && !s.carrying && !s.ko) { s.carrying = action.id; return s; }
  if (action === 'drop' && s.phase === 'manual' && s.carrying) {
    const crate = s.crates.find((c) => c.id === s.carrying); if (crate) crate.delivered = true;
    s.carrying = null; s.delivered = s.crates.filter((c) => c.delivered).length;
    // 19.4 (§21): every crate you carried makes you angrier.
    s.anger = Math.min(ANGER_FULL, (s.anger ?? 0) + 1);
    if (s.delivered >= MANUAL_DELIVERY_TARGET) {
      s.phase = 'report'; s.bossBeat = 0;
      if (!(s.punchedPeople > 0)) s.cleanHands = true;
    }
    return s;
  }
  // 19.4 (§21): the fists. Punch whoever (or whatever) is in front of you.
  // A worker warns you once, then lays you out (ko); you wake at the spawn.
  // The boss swats you away -- unless the three crates made you angry enough
  // and the work is done: then the fight starts right there, on anger.
  if (action?.type === 'punch') {
    if (s.carrying || s.ko || !PUNCH_PHASES.includes(s.phase)) { s.lastPunch = { who: action.who ?? 'air', kind: s.carrying ? 'busy' : 'blocked' }; return s; }
    const who = action.who ?? 'air';
    if (WORKER_FISTS[who]) {
      const n = (state.hits?.[who] ?? 0) + 1;
      s.punchedPeople = (s.punchedPeople ?? 0) + 1;
      if (n >= PUNCHES_TO_BEATING) {
        s.hits = { ...(state.hits || {}), [who]: 0 };
        s.beatenBy = { ...(state.beatenBy || {}), [who]: true };
        s.ko = { by: who };
        s.lastPunch = { who, kind: 'beat', line: WORKER_FISTS[who].beat };
      } else {
        s.hits = { ...(state.hits || {}), [who]: n };
        s.lastPunch = { who, kind: 'warn', line: WORKER_FISTS[who].warn };
      }
      return s;
    }
    if (who === 'boss') {
      s.punchedPeople = (s.punchedPeople ?? 0) + 1;
      if (s.phase === 'report' && angerFull(s.anger)) {
        s.phase = 'fight'; s.fightMeter = 50; s.fightWon = null; s.fightOnAnger = true;
        s.lastPunch = { who, kind: 'start', line: BOSS_FISTS.angry };
        return s;
      }
      s.bossSwats = (s.bossSwats ?? 0) + 1;
      s.lastPunch = { who, kind: 'swat', line: s.bossSwats > 1 ? BOSS_FISTS.swatAgain : BOSS_FISTS.swat };
      return s;
    }
    s.lastPunch = { who, kind: 'thud' };
    return s;
  }
  // Back on your feet at the spawn, a coworker standing over you.
  if (action === 'wake' && s.ko) {
    const by = s.ko.by; const f = WORKER_FISTS[by];
    s.ko = null;
    s.player = { x: SPOTS.spawn.x, z: SPOTS.spawn.z, yaw: SPOTS.spawn.yaw };
    s.lastPunch = { who: f?.waker ?? 'lunch', kind: 'wake', line: f?.wake ?? 'Новенький, ты чего?', by };
    return s;
  }
  // Asking a worker for help: allowed while the arm is dead (before the shock),
  // never changes the shift itself -- everyone says no.
  if (action?.type === 'ask' && ASK_PHASES.includes(s.phase) && FIRST_SHIFT_WORKERS[action.worker] && WORKER_TOPICS[action.topic]) {
    const key = `${action.worker}:${action.topic}`;
    const n = state.asks?.[key] ?? 0;
    s.asks = { ...(state.asks || {}), [key]: n + 1 };
    s.lastAsk = { worker: action.worker, topic: action.topic, n };
    return s;
  }
  // Reaching the boss now opens a choice (talk or shove him) instead of
  // jumping straight to payday — Сергей 22.09: "с боссом подраться,
  // поговорить можно было". Talk keeps the original one-line handoff.
  if (action === 'report-boss' && s.phase === 'report') { s.phase = 'confront'; return s; }
  if (action === 'talk' && s.phase === 'confront') { s.phase = 'payday'; return s; }
  if (action === 'fight-start' && s.phase === 'confront') { s.phase = 'fight'; s.fightMeter = 50; s.fightWon = null; s.fightOnAnger = angerFull(s.anger); return s; }
  if (action?.type === 'push' && s.phase === 'fight') {
    s.fightMeter = Math.max(FIGHT_LOSE_METER, Math.min(FIGHT_WIN_METER, s.fightMeter + (action.hit ? fightGain(s.anger) : -FIGHT_MISS_LOSS)));
    if (s.fightMeter >= FIGHT_WIN_METER) { s.phase = 'fight-result'; s.fightWon = true; if (angerFull(s.anger)) s.angerWin = true; }
    else if (s.fightMeter <= FIGHT_LOSE_METER) { s.phase = 'fight-result'; s.fightWon = false; }
    return s;
  }
  if (action === 'fight-done' && s.phase === 'fight-result') { s.phase = 'payday'; return s; }
  // 19.5 (§22): «Медленно!» -- he storms to the table by the arm and slams it.
  if (action === 'payday-done' && s.phase === 'payday') { s.phase = 'slam'; return s; }
  // The slam knocks the child-lock nobody cut off loose on the arm's casing.
  if (action === 'slam' && s.phase === 'slam') { s.phase = 'lock'; s.lockLoose = true; return s; }
  // Pry it off: amount is the share of the pry this frame (negative: it
  // springs back when you let go early). At 1 it comes off -- the button.
  if (action?.type === 'pry' && s.phase === 'lock' && !s.carrying && !s.ko) {
    s.pry = Math.max(0, Math.min(1, (s.pry ?? 0) + (Number(action.amount) || 0)));
    if (s.pry >= 1) { s.phase = 'button'; s.lockOff = true; }
    return s;
  }
  // print("wake") -- and 220 volts through you.
  if (action === 'press' && s.phase === 'button' && !s.carrying && !s.ko) { s.phase = 'shock'; s.shocked = true; return s; }
  // Back from the deep program: the arm is awake and works.
  if (action === 'arm-wakes' && s.phase === 'shock') { s.phase = 'done'; s.armAwake = true; s.complete = true; return s; }
  return s;
}

export function firstShiftBossLine(phase = 'briefing', fightWon = null, onAnger = false) {
  if (phase === 'confront') return [
    'НАЧАЛЬНИК',
    'Три готово. Ну, чего встал. Говорить будем или?..',
    'ПОНЯЛ',
  ];
  if (phase === 'fight-result' && fightWon && onAnger) return [
    'НАЧАЛЬНИК',
    'Всё! Всё, понял! Злой ты, новенький… Рука 07 правда не включается — никто не знает почему.',
    'ХОРОШО',
  ];
  if (phase === 'fight-result') return fightWon ? [
    'НАЧАЛЬНИК',
    'Так, всё, всё! Понял, погорячился. Рука 07 правда не включается — никто не знает почему.',
    'ХОРОШО',
  ] : [
    'НАЧАЛЬНИК',
    'Куда ты лезешь. Иди работай, силач. Железка не включается — значит, таскаешь ты.',
    'ЛАДНО',
  ];
  // 19.5 (§22): «Медленно!» -- then he storms to the table by the arm.
  if (phase === 'payday') return fightWon === true ? [
    'НАЧАЛЬНИК',
    `${OPENING_LINES.payday.won} И... драка — это между нами, ладно?`,
    'НУ-НУ',
  ] : [
    'НАЧАЛЬНИК',
    fightWon === false ? OPENING_LINES.payday.lost : OPENING_LINES.payday.talk,
    'НУ-НУ',
  ];
  return [
    'НАЧАЛЬНИК',
    OPENING_LINES.briefing,
    'ПОНЯЛ',
  ];
}

// ------------------------------------------------------------------ view --

const VIEW_ROWS = 240;
const BAR_H = 32;
const REACH = 2.1;
const WHITE = rgb(236, 236, 228);
const RED = rgb(232, 60, 44);
const GOLD = rgb(255, 200, 70);
const CYAN = rgb(110, 240, 255);
const DIM = rgb(150, 150, 146);

// 18.2: onReflex(id) -- a gamer reflex (§16) fired; gamerLine(scene) -- the
// host hands out one gamer slip per scene (gamer-reflex.js), or null.
export function createFirstShift(root, { onComplete = () => {}, onSound = () => {}, onFlag = () => {}, onReflex = () => {}, gamerLine = () => null } = {}) {
  if (!root) return { open() {}, close() {}, state: () => createFirstShiftState() };
  const canvas = root.querySelector('#firstShiftCanvas'); const ctx = canvas?.getContext('2d');
  const dialogue = root.querySelector('#firstShiftDialogue'); const bossNext = root.querySelector('#firstShiftBossNext');
  const choices = root.querySelector('#firstShiftChoices'); const bossTalk = root.querySelector('#firstShiftBossTalk'); const bossFightBtn = root.querySelector('#firstShiftBossFight');
  const fightPanel = root.querySelector('#firstShiftFight'); const fightMeterEl = root.querySelector('#firstShiftFightMeter');
  const beatPips = [...root.querySelectorAll('#firstShiftBeats li')];
  const status = root.querySelector('#firstShiftStatus'); const wallet = root.querySelector('#firstShiftPay'); const prompt = root.querySelector('#firstShiftPrompt');
  // 19.5 (§22): the pry track (hold E / press and slide).
  const pryEl = root.querySelector('#firstShiftPry'); const pryLabel = root.querySelector('#firstShiftPryLabel'); const pryThumb = root.querySelector('#firstShiftPryThumb');
  const reduceMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  // 19.4 (§21): the anger meter next to the hands, and the phone's E label.
  const angerEl = root.querySelector('#firstShiftAnger'); const angerText = root.querySelector('#firstShiftAngerText');
  const touchUseEl = () => document.querySelector('#touchPad .touch__use small');
  let touchUse = null;

  let state = createFirstShiftState(); let active = false; let raf = 0; let last = performance.now();
  const held = new Set(); let target = null; let fightClockStart = 0;
  // 29.09: idle-nudge (boss hurries you, then smacks you) and the post-fight
  // daydream haze are presentation-only timers, not part of stepFirstShift's
  // tested state machine.
  let idleSeconds = 0; let idleStage = 0; let nudgeUntil = 0; let nudgeText = ''; let flashUntil = 0; let flashColor = 'white'; let daydreamUntil = 0;
  let talk = null; // { worker, stage: 'greet' | 'reply', line }
  const talkedUntil = {};
  let message = ''; let messageUntil = 0;
  let walkPhase = 0; let stepAcc = 0; let shakeUntil = 0; let punchAt = -1e9; let bossHitUntil = 0; let bossAngryUntil = 0; let faceOuchUntil = 0;
  let turnTo = null;
  // 19.4 (§21): the hands. Their own clock (spawn clench, punches, grab,
  // place, going down), the blackout after a beating, the boss knocked back.
  let hands = createHands(performance.now());
  let koAt = -1e9; let wakeAt = -1e9; let bossKnockAt = -1e9; let crateWobbleAt = -1e9; let swatAt = -1e9; let swatDir = null;
  const hitFlash = {};
  const KO_TOTAL_MS = 2000; // laid out: hit, drop to the floor, blackout
  // 19.5: the fists stay through the shock (they jitter) and in the deep view after it.
  const fistsVisible = () => state.phase !== 'done' && (!dive || dive.after || diveStage(performance.now())?.stage === 'shock');
  // 18.1: look assist — when you walk up to someone or something you can use,
  // the view eases down so the target is in sight (unless you are aiming yourself).
  let manualLookAt = -1e9;
  // 17.0: look up/down (pitch, + is up), jump and stand on things, and people
  // who comment on it. The body owns the player's position; state.player
  // mirrors x/z for the tested state machine.
  let body = createBody(SPOTS.spawn.x, SPOTS.spawn.z);
  let pitch = 0; let dipAt = -1e9; let dipImpact = 0;
  const chatter = createChatter();
  const moments = createMomentWatcher();
  let speech = null; // { who, name, text, until }
  // 19.5 (§22) the boss leaving: «Медленно!» -- he storms to the table by
  // the arm, bangs his fist on it (the child-lock on the casing pops loose),
  // walks to the gate, the gate lifts.
  let boss = { x: SPOTS.boss.x, z: SPOTS.boss.z, mode: 'stand', t: 0, leg: 0, facing: Math.PI };
  // The lone crate by his way out (a prop since 19.5: you can punch it).
  const LONE = SPOTS.loneCrate;
  const crateAt = () => LONE;
  // The child-lock on the arm's casing and the button under it. lockAt: when
  // it popped loose; lockFall: { at, x, z } when it came off and fell.
  let lockAt = -1e9; let lockFall = null; let prying = false; let pryDrag = null; let pryCreakAt = 0; let shockAt = -1e9; let slowSaid = false;
  let lockImg = null; let lockLooseImg = null; let buttonImg = null; let awakeArms = null;
  // Where the lock sits: on the arm's casing, on the side you look from.
  const lockSpot = () => {
    const p = state.player;
    const dx = p.x - SPOTS.arm.x, dz = p.z - SPOTS.arm.z; const len = Math.hypot(dx, dz) || 1;
    return { x: SPOTS.arm.x + (dx / len) * 0.5, z: SPOTS.arm.z + (dz / len) * 0.5, y: 0.82 };
  };
  let lastBeat = -1; let slamAt = -1e9; let holdBeat = null; // debug: freeze the bar at a moment (ms)
  const fightMs = (now) => holdBeat ?? (now - fightClockStart);
  // Gamer slips: one per scene, the reply a moment later.
  const slipScenes = new Set(); let slipTimer = 0; let manualSince = 0;
  function slip(scene) {
    if (slipScenes.has(scene)) return false;
    const line = gamerLine(scene);
    if (!line) return false;
    slipScenes.add(scene);
    const now = performance.now();
    speech = { who: 'me', name: 'ТЫ', text: line.me, until: now + 2600 };
    onSound('chatter');
    clearTimeout(slipTimer);
    slipTimer = setTimeout(() => {
      if (!active) return;
      const t = performance.now();
      // Someone else spoke meanwhile (a wake-up, a punch): don't talk over them.
      if (state.ko || (speech && speech.who !== 'me' && t < speech.until)) return;
      speech = { who: line.who, name: FIRST_SHIFT_WORKERS[line.who]?.title ?? 'НАЧАЛЬНИК', text: line.reply, until: t + 2800 };
      if (WORKER_SPOTS[line.who]) talkedUntil[line.who] = Math.max(talkedUntil[line.who] ?? 0, t + 2200);
      onSound('chatter');
    }, 2700);
    return true;
  }
  // Where everyone is looking (world yaw). People turn to you when you talk
  // to them and back to their work after; the boss keeps an eye on you.
  const facing = {};
  const resetFacing = () => { for (const [id, w] of Object.entries(WORKER_SPOTS)) facing[id] = w.facing; boss.facing = Math.PI; };
  const talkingTo = (id) => talk?.worker === id || performance.now() < (talkedUntil[id] ?? 0);
  const yawTo = (fx, fz, tx, tz) => Math.atan2(tx - fx, -(tz - fz));
  const turnToward = (from, to, maxStep) => { const d = wrapAngle(to - from); return wrapAngle(from + clamp(d, -maxStep, maxStep)); };
  let door = 0; let doorWanted = 0;
  // 18.0 door gag: peek open a crack, shove the player back, one line.
  let peekUntil = 0; let pushUntil = 0; let gagReadyAt = 0; let clockSeen = false;
  // 19.5 (§22): the shock starts the dive (first-shift-dive.js); the shift's
  // state machine is in 'shock' until you come back, then 'done'.
  const diveFx = createDiveFx({ artBase: new URL('../../art/', import.meta.url) });
  let dive = null; // { start, step, after, meltSrc }
  const diveStage = (now) => (dive ? diveStageAt(now - dive.start) : null);
  const beltCrates = [];
  const particles = [];
  let dynFlash = null;

  // World
  const map = buildFactoryMap();
  const lightmap = bakeLightmap(map, LAMPS, { ambient: [0.26, 0.27, 0.31] });
  let atlas = null;
  loadAtlas().then((a) => {
    atlas = a;
    lockImg = paintChildLock('on'); lockLooseImg = paintChildLock('loose'); buttonImg = paintWakeButton(true);
    try { awakeArms = buildArmSprites(); } catch { awakeArms = null; }
    for (const [name, t] of Object.entries(a)) map.textures[name] = t;
    dressHall(map, a);
  }).catch(() => { atlas = null; });

  let W = 427; let renderer = createRenderer(W, VIEW_ROWS); let imageData = null;
  function resize() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const aspect = rect.width > 0 && rect.height > 0 ? rect.width / rect.height : 16 / 9;
    const nextW = clamp(Math.round(VIEW_ROWS * aspect), 320, 640);
    if (nextW !== W || !imageData) {
      W = nextW;
      renderer = createRenderer(W, VIEW_ROWS);
      canvas.width = W; canvas.height = VIEW_ROWS;
      imageData = new ImageData(new Uint8ClampedArray(renderer.buf.buffer), W, VIEW_ROWS);
    }
  }

  // 18.2 (§16 «у всех боссов есть паттерн»): 1 · 2 · 3 · БАМ -- he slams his
  // desk every 4th beat and is open right after; that is when a push lands.
  function fightHot(now) { return state.phase === 'fight' && fightBeat(fightMs(now)).hot; }
  function say(text, ms = 2200) { message = text; messageUntil = performance.now() + ms; }
  function armDead() { return armDeadIn(state.phase); }
  function bossPresent() { return boss.mode !== 'gone'; }

  let dialogueOpenedAt = 0;
  function setDialogue() {
    const single = state.phase === 'briefing' || state.phase === 'payday' || state.phase === 'fight-result';
    const confront = state.phase === 'confront';
    const talking = !!talk;
    const thought = Boolean(dive?.after);
    const wasHidden = dialogue.hidden;
    dialogue.hidden = !(single || confront || talking || thought);
    // A dialogue needs the mouse back (buttons), and a moment before a held
    // action key can skip it.
    if (wasHidden && !dialogue.hidden) {
      dialogueOpenedAt = performance.now();
      if (document.pointerLockElement === canvas) document.exitPointerLock?.();
    }
    if (fightPanel) fightPanel.hidden = state.phase !== 'fight';
    if (thought) {
      const [speaker, line, button] = DIVE_THOUGHT;
      root.querySelector('#firstShiftSpeaker').textContent = speaker; paintFace(speaker);
      root.querySelector('#firstShiftLine').textContent = line;
      if (choices) choices.hidden = true;
      delete bossFightBtn.dataset.tone;
      bossNext.hidden = false; bossNext.textContent = button;
      return;
    }
    if (talking) {
      const [speaker, line, button] = talk.stage === 'greet'
        ? firstShiftWorkerLine(talk.worker, 'greet')
        : firstShiftWorkerLine(talk.worker, talk.topic, talk.n);
      root.querySelector('#firstShiftSpeaker').textContent = speaker; paintFace(speaker);
      root.querySelector('#firstShiftLine').textContent = line;
      if (choices) choices.hidden = talk.stage !== 'greet';
      bossTalk.textContent = `1 · ${WORKER_TOPICS.carry}`; bossFightBtn.textContent = `2 · ${WORKER_TOPICS.fix}`;
      bossFightBtn.dataset.tone = 'plain';
      bossNext.hidden = false; bossNext.textContent = button;
      return;
    }
    bossTalk.textContent = '1 · ПОГОВОРИТЬ'; bossFightBtn.textContent = '2 · ПОДРАТЬСЯ';
    delete bossFightBtn.dataset.tone;
    bossNext.hidden = !single;
    if (choices) choices.hidden = !confront;
    if (single || confront) {
      const [speaker, line, button] = firstShiftBossLine(state.phase, state.fightWon, state.angerWin);
      root.querySelector('#firstShiftSpeaker').textContent = speaker; paintFace(speaker); root.querySelector('#firstShiftLine').textContent = line;
      if (single) bossNext.textContent = button;
    }
  }

  function dialogueOpen() { return !dialogue.hidden; }
  // 18.0: a portrait next to whoever talks; the boss gets angry in a fight.
  function paintFace(speaker) {
    const c = root.querySelector('#firstShiftFace');
    if (!c) return;
    const id = faceIdFor(speaker);
    c.hidden = !id;
    if (id) drawFace(c, id, { mood: ['confront', 'fight-result'].includes(state.phase) ? 'angry' : 'talk', frame: 1 });
  }

  function workerTargets() {
    const out = [];
    if (!armDead()) return out;
    for (const [id, spot] of Object.entries(WORKER_SPOTS)) out.push({ kind: 'worker', id, x: spot.x, z: spot.z });
    return out;
  }

  function chooseTarget() {
    const p = state.player;
    const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
    const cands = [];
    const consider = (t) => {
      const dx = t.x - p.x, dz = t.z - p.z;
      const fwd = dx * sin - dz * cos;
      const side = dx * cos + dz * sin;
      const dist = Math.hypot(dx, dz);
      if (fwd <= 0.1 || dist > REACH + 0.2) return;
      if (Math.abs(Math.atan2(side, fwd)) > 0.3) return;
      cands.push({ ...t, dist });
    };
    if (state.phase === 'report' && bossPresent()) consider({ kind: 'boss', x: boss.x, z: boss.z });
    // 19.5 (§22): the child-lock on the arm's casing, then the button under it.
    if ((state.phase === 'lock' || state.phase === 'button') && !state.carrying && !state.ko) {
      const at = lockSpot();
      const dx = at.x - p.x, dz = at.z - p.z; const dist = Math.hypot(dx, dz);
      const fwd = dx * sin - dz * cos; const side = dx * cos + dz * sin;
      if (fwd > 0.05 && dist < REACH + 0.3 && Math.abs(Math.atan2(side, fwd)) < 0.5) cands.push({ kind: state.phase === 'lock' ? 'lock' : 'button', x: at.x, z: at.z, dist: Math.max(0, dist - 0.4) });
    }
    if (!talk) for (const w of workerTargets()) consider(w);
    const hit = castCenter(map, p.x, p.z, p.yaw, REACH, EYE);
    if (hit) {
      const kind = hit.cell.kind;
      if (kind === 'c' && state.phase === 'manual' && !state.carrying && pileCount(state, hit.cx, hit.cz) > 0) {
        cands.push({ kind: 'crate', cx: hit.cx, cz: hit.cz, dist: hit.dist });
      } else if ((kind === '=' || kind === 'O') && state.phase === 'manual' && state.carrying) {
        cands.push({ kind: 'belt', cx: hit.cx, cz: hit.cz, dist: hit.dist });
      }
    }
    cands.sort((a, b) => a.dist - b.dist);
    return cands[0] ?? null;
  }

  function openTalk(worker) {
    talk = { worker, stage: 'greet' };
    talkedUntil[worker] = Infinity;
    onSound('ui-click');
    document.exitPointerLock?.();
    setDialogue(); renderText();
  }
  function ask(topic) {
    if (!talk || talk.stage !== 'greet') return;
    state = stepFirstShift(state, { type: 'ask', worker: talk.worker, topic });
    const n = state.lastAsk?.n ?? 0;
    talk = { worker: talk.worker, stage: 'reply', topic, n };
    onSound('blocked');
    setDialogue(); renderText();
  }
  function closeTalk() {
    if (!talk) return;
    talkedUntil[talk.worker] = performance.now() + 1400;
    talk = null;
    setDialogue(); renderText();
    canvas?.focus({ preventScroll: true });
    canvas?.requestPointerLock?.();
  }

  function action() {
    if (talk) { closeTalk(); return; }
    if (state.phase === 'briefing' || state.phase === 'payday' || state.phase === 'confront' || state.phase === 'fight-result') return;
    const now = performance.now();
    if (state.phase === 'fight') {
      const hit = fightHot(now);
      state = stepFirstShift(state, { type: 'push', hit });
      punchAt = now; hands = swing(hands, now);
      if (hit && angerFull(state.anger)) {
        // 19.4 (§21): on anger the punch lands for real -- he flies back.
        onSound('impact'); onSound('fist-hit'); bossHitUntil = now + 420; bossKnockAt = now; shakeUntil = now + 200;
        for (let i = 0; i < 12; i++) particles.push({ x: boss.x + (Math.random() - 0.5) * 0.3, z: boss.z + (Math.random() - 0.5) * 0.3, y: 1.4 + Math.random() * 0.3, vx: (Math.random() - 0.5) * 2, vz: (Math.random() - 0.5) * 2, vy: Math.random() * 2, life: 0.4 + Math.random() * 0.3, color: rgb(255, 230, 200), size: 0.03 });
        if (state.phase === 'fight') speech = { who: 'boss', name: 'НАЧАЛЬНИК', text: BOSS_FISTS.knocked, until: now + 1600 };
      } else if (hit) { onSound('impact'); bossHitUntil = now + 320; shakeUntil = now + 120; }
      else { onSound('whoosh'); setTimeout(() => { if (active) { onSound('hit'); faceOuchUntil = performance.now() + 500; flashUntil = performance.now() + 140; flashColor = 'red'; shakeUntil = performance.now() + 200; bossAngryUntil = performance.now() + 380; } }, 160); }
      if (state.phase === 'fight-result') {
        if (state.angerWin) onFlag(FIST_FLAGS.angerWin);
        // Сергей: "победишь или проиграешь, в конце это такая типа дымка, и
        // такой эх, мечты, мечты" -- hold the boss's line back behind a
        // brief haze instead of popping the dialogue box immediately.
        daydreamUntil = now + 1500;
        renderText();
        setTimeout(() => { setDialogue(); renderText(); canvas?.focus({ preventScroll: true }); }, 1500);
      } else {
        renderText(); setDialogue();
      }
      return;
    }
    // 19.5: E held at the lock pries whenever the lock comes into view.
    if (state.phase === 'lock' && (!target || target.kind === 'lock')) { prying = true; if (target) say(OPENING_LINES.pryHint, 1400); renderText(); return; }
    if (!target) { onSound('blocked'); return; }
    if (target.kind === 'crate') {
      const id = topCrateId(state, target.cx, target.cz);
      if (!id) return;
      state = stepFirstShift(state, { type: 'pick', id });
      hands = { ...hands, grabAt: now };
      onSound('pickup'); say('ЯЩИК. ТЯЖЁЛЫЙ.');
      comment('pick');
    } else if (target.kind === 'belt') {
      const angerBefore = state.anger;
      state = stepFirstShift(state, 'drop');
      hands = { ...hands, placeAt: now };
      if (state.anger > angerBefore) onSound(angerFull(state.anger) ? 'anger-full' : 'anger');
      if (state.cleanHands) onFlag(FIST_FLAGS.cleanHands);
      beltCrates.push({ x: clamp(target.cx + 0.5, SPOTS.beltDrop.x, 15.5), z: SPOTS.beltDrop.z });
      onSound('drop'); onSound('cash');
      say(state.phase === 'report' ? `+${FIRST_SHIFT_PAY} ₽ · ТРИ ГОТОВО` : `+${FIRST_SHIFT_PAY} ₽`, 2200);
      if (state.delivered === 1 && !slowSaid && bossPresent()) {
        // 19.5 (§22): «Медленно!» -- he yells while you carry.
        slowSaid = true; bossAngryUntil = now + 1600;
        speech = { who: 'boss', name: 'НАЧАЛЬНИК', text: OPENING_LINES.slow, until: now + 2800 };
        onSound('chatter');
      } else comment(state.phase === 'report' ? 'task-done' : (state.delivered === 2 ? 'money' : 'deliver'));
    } else if (target.kind === 'boss') {
      state = stepFirstShift(state, 'report-boss'); onSound('ui-click'); document.exitPointerLock?.();
    } else if (target.kind === 'worker') {
      openTalk(target.id); return;
    } else if (target.kind === 'lock') {
      // A tap is not enough: hold E (or slide on the phone's track).
      prying = true; say(OPENING_LINES.pryHint, 1400);
    } else if (target.kind === 'button') {
      pressWake(now);
      return;
    }
    renderText(); setDialogue();
  }

  // 19.4 (§21): what the fist would hit -- a person within reach and in
  // front, else a crate or a wall straight ahead, else air.
  function punchTarget() {
    const p = state.player;
    const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
    let best = null;
    const consider = (who, x, z, r) => {
      const dx = x - p.x, dz = z - p.z;
      const fwd = dx * sin - dz * cos; const side = dx * cos + dz * sin;
      const dist = Math.hypot(dx, dz);
      if (fwd <= 0.05 || dist > PUNCH_REACH + r) return;
      if (Math.abs(Math.atan2(side, fwd)) > 0.42) return;
      if (!best || dist < best.dist) best = { who, x, z, dist };
    };
    for (const [id, w] of Object.entries(WORKER_SPOTS)) consider(id, w.x, w.z, 0.62);
    if (bossPresent() && boss.mode === 'stand') consider('boss', boss.x, boss.z, 0.64);
    if (best) return best;
    const c = crateAt(); consider('crate', c.x, c.z, 0.42);
    if (best) return best;
    const hit = castCenter(map, p.x, p.z, p.yaw, PUNCH_REACH, EYE);
    if (hit) return { who: hit.cell.kind === 'c' ? 'crate' : 'wall', dist: hit.dist, cx: hit.cx, cz: hit.cz };
    return { who: 'air' };
  }

  function punch() {
    if (!active || dive || talk) return;
    const now = performance.now();
    if (state.phase === 'fight') { if (dialogue.hidden) action(); return; }
    if (!dialogue.hidden || state.ko || now - hands.punchAt < 240) return;
    if (state.carrying) { say(THUD_LINES.busy, 1200); onSound('blocked'); return; }
    if (!PUNCH_PHASES.includes(state.phase)) return;
    const t = punchTarget();
    hands = swing(hands, now); punchAt = now;
    onSound('fist-swing');
    state = stepFirstShift(state, { type: 'punch', who: t.who });
    const lp = state.lastPunch;
    if (!lp) return;
    if (lp.kind === 'warn' || lp.kind === 'beat') {
      const w = WORKER_SPOTS[lp.who];
      onSound('fist-hit'); shakeUntil = now + 140; hitFlash[lp.who] = now + 200;
      talkedUntil[lp.who] = Math.max(talkedUntil[lp.who] ?? 0, now + (lp.kind === 'beat' ? KO_TOTAL_MS + 400 : 2600));
      speech = { who: lp.who, name: FIRST_SHIFT_WORKERS[lp.who].title, text: lp.line, until: now + (lp.kind === 'beat' ? 1500 : 2800) };
      onSound('chatter');
      if (lp.kind === 'beat') {
        // He answers. Hard. The view goes to the floor, then black.
        koAt = now + 260; hands = { ...hands, koAt };
        held.clear();
        turnTo = Math.atan2(w.x - state.player.x, -(w.z - state.player.z));
        setTimeout(() => {
          if (!active || !state.ko) return;
          onSound('impact'); onSound('fist-hit'); setTimeout(() => active && onSound('collapse'), 380);
          shakeUntil = performance.now() + 520; flashUntil = performance.now() + 260; flashColor = 'red'; faceOuchUntil = performance.now() + 1800;
        }, 260);
        onFlag(FIST_FLAGS.beatenBy(lp.who));
      }
    } else if (lp.kind === 'swat') {
      // The boss swats you off like a fly, and laughs.
      onSound('fist-hit'); setTimeout(() => active && onSound('hit'), 120);
      shakeUntil = now + 300; flashUntil = now + 120; flashColor = 'white'; faceOuchUntil = now + 900; bossAngryUntil = now + 900;
      swatAt = now; const dx = state.player.x - boss.x, dz = state.player.z - boss.z; const len = Math.hypot(dx, dz) || 1; swatDir = { x: dx / len, z: dz / len };
      speech = { who: 'boss', name: 'НАЧАЛЬНИК', text: lp.line, until: now + 2600 };
      onSound('chatter');
    } else if (lp.kind === 'start') {
      // Three crates of anger: the fight starts right here.
      onSound('fist-hit'); shakeUntil = now + 160; bossAngryUntil = now + 900;
      startFight(now);
      say('НА ЗЛОСТИ!', 1600);
    } else if (lp.kind === 'thud') {
      onSound(t.who === 'air' ? 'whoosh' : 'fist-thud');
      if (t.who !== 'air') shakeUntil = now + 90;
      if (t.who === 'crate') { crateWobbleAt = now; say(THUD_LINES.crate, 1600); }
      else if (t.who === 'wall') say(THUD_LINES.wall, 1400);
    }
    renderText(); setDialogue();
  }

  // The fight with the boss, from the dialogue's «ПОДРАТЬСЯ» or a punch on anger.
  function startFight(now) {
    fightClockStart = now; onSound('door');
    // 18.2 (§16): before the first slam the hand already knows the rhythm.
    lastBeat = -1;
    speech = { who: 'me', name: 'ТЫ', text: REFLEXES.pattern.thought, until: now + 3600 };
    onSound(REFLEXES.pattern.sound); onReflex('pattern');
    turnTo = Math.atan2(boss.x - state.player.x, -(boss.z - state.player.z));
  }

  // Back at the spawn after a beating, someone from the hall standing over you.
  function wakeUp(now) {
    state = stepFirstShift(state, 'wake');
    body = createBody(state.player.x, state.player.z); pitch = 0; turnTo = null;
    wakeAt = now; hands = { ...createHands(now), punchSide: hands.punchSide };
    const lp = state.lastPunch;
    if (lp?.kind === 'wake') {
      speech = { who: lp.who, name: FIRST_SHIFT_WORKERS[lp.who]?.title ?? 'ГОЛОС', text: lp.line, until: now + 3600 };
      talkedUntil[lp.who] = Math.max(talkedUntil[lp.who] ?? 0, now + 3000);
      onSound('wake'); onSound('chatter');
    }
    renderText();
  }

  // 19.5 (§22): the boss's fist lands on the table by the arm -- and the
  // child-lock nobody cut off pops loose on the casing.
  function slamTable(now) {
    const T = SPOTS.armTable;
    onSound('impact'); onSound('clank');
    for (let i = 0; i < 22; i++) particles.push({ x: T.x + (Math.random() - 0.5) * 0.6, z: T.z + (Math.random() - 0.5) * 0.5, y: T.y, vx: (Math.random() - 0.5) * 1.6, vz: (Math.random() - 0.5) * 1.6, vy: 0.6 + Math.random() * 1.6, life: 0.5 + Math.random() * 0.5, color: rgb(190, 180, 160), size: 0.03 });
    dynFlash = { x: T.x, z: T.z, until: now + 140 };
    shakeUntil = now + 220;
    state = stepFirstShift(state, 'slam');
    lockAt = now;
    say(OPENING_LINES.slam, 1600);
    setTimeout(() => { if (active) { say(OPENING_LINES.lockPop, 2600); onSound('scan'); } }, 700);
    speech = { who: 'boss', name: 'НАЧАЛЬНИК', text: OPENING_LINES.slamSay, until: now + 2600 };
    renderText();
  }
  // The lock came off: it drops to the floor, the button is there.
  function lockCameOff(now) {
    const at = lockSpot();
    lockFall = { at: now, x: at.x, z: at.z };
    prying = false; pryDrag = null;
    onSound('lock-pop'); onSound('pickup');
    say(OPENING_LINES.pryDone, 1800);
    onFlag(OPENING_FLAGS.childLock);
    speech = { who: 'me', name: 'ТЫ', text: OPENING_LINES.buttonSeen, until: now + 3200 };
    renderText();
  }
  // One frame of prying (hold E / the finger on the track).
  function pryBy(amount, now) {
    if (state.phase !== 'lock') return;
    state = stepFirstShift(state, { type: 'pry', amount });
    if (amount > 0 && now - pryCreakAt > 170) { pryCreakAt = now; onSound('pry'); }
    if (state.phase === 'button') lockCameOff(now);
  }
  function letGo(now) {
    if (state.phase !== 'lock' || !(state.pry > 0)) { prying = false; return; }
    prying = false;
    state = stepFirstShift(state, { type: 'pry', amount: pryRelease(state.pry) - state.pry });
    if (state.pry < 1) { onSound('blocked'); say('ЩЁЛК — ОБРАТНО. ДЕРЖИ ДОЛЬШЕ', 1400); }
    void now;
  }
  // print("wake") -- 220 volts. The view goes inside.
  function pressWake(now) {
    state = stepFirstShift(state, 'press');
    if (state.phase !== 'shock') return;
    shockAt = now;
    hands = { ...swing(hands, now), shockAt: now };
    onSound('button-press'); onSound('shock');
    onFlag(OPENING_FLAGS.shocked);
    shakeUntil = now + 1400;
    speech = null;
    if (document.pointerLockElement === canvas) document.exitPointerLock?.();
    startDive(now);
    renderText(); setDialogue();
  }

  // ------------------------------------------------------------- the dive

  function startDive(now) {
    dive = { start: now, step: -1, after: false, meltSrc: null };
    diveFx.load();
    held.clear(); target = null;
  }
  function skipDive() {
    if (!dive || dive.after) return;
    dive.start = performance.now() - DIVE_MS - 1;
  }
  function finishDive() {
    // Back from the deep program: Arm 07 is awake.
    state = stepFirstShift(state, 'arm-wakes');
    dive = null; active = false; root.hidden = true; cancelAnimationFrame(raf);
    root.dataset.dive = '';
    if (touchUse) touchUse.textContent = 'ВЗЯТЬ';
    if (document.pointerLockElement === canvas) document.exitPointerLock?.();
    onComplete({ delivered: state.delivered, extra: 0, shocked: true, player: { x: body.x, z: body.z, yaw: state.player.yaw } });
  }
  const DIVE_SOUNDS = { enter: 'power', peak: 'reward', exit: 'whoosh' };
  const VISION_SOUNDS = ['cash', 'impact', 'wake'];
  function updateDive(now) {
    const st = diveStage(now);
    if (!st || st.step === dive.step) return;
    dive.step = st.step;
    const sound = st.stage === 'vision' ? VISION_SOUNDS[st.index] : DIVE_SOUNDS[st.stage];
    if (sound) onSound(sound);
    if (st.stage === 'after' && !dive.after) {
      dive.after = true;
      setDialogue(); renderText();
    }
  }

  // ------------------------------------------------------- people talking

  function present() {
    const out = new Set(Object.keys(WORKER_SPOTS));
    out.add(bossPresent() ? 'boss' : 'radio');
    return out;
  }
  function comment(event, force = false) {
    if (!dialogue.hidden || dive || talk) return null;
    const now = performance.now();
    // The boss yelling is not talked over by hall chatter.
    if (!force && speech?.who === 'boss' && now < speech.until) return null;
    const line = chatter.say(event, now / 1000, { present: present(), force });
    if (!line) return null;
    speech = { ...line, until: now + 2400 + line.text.length * 50 };
    // Whoever speaks turns to you for a moment (and waves, like when asked).
    if (WORKER_SPOTS[line.who]) talkedUntil[line.who] = Math.max(talkedUntil[line.who] ?? 0, now + 1800);
    onSound('chatter');
    return line;
  }
  function speakerAt(who) {
    if (who === 'boss' && bossPresent()) return { x: boss.x, z: boss.z, y: 1.95 };
    const w = WORKER_SPOTS[who];
    return w ? { x: w.x, z: w.z, y: who === 'lunch' ? 1.35 : 1.8 } : null;
  }

  function renderText() {
    if (wallet) wallet.textContent = `НАЧИСЛЕНО · ${(state.delivered * FIRST_SHIFT_PAY).toLocaleString('ru-RU')} ₽`;
    if (state.phase === 'briefing') status.textContent = 'Начальник ждёт у стола.';
    else if (state.ko) status.textContent = 'Тебя отделали. Лежи, отдыхай.';
    else if (state.phase === 'manual') status.textContent = state.carrying ? 'Ящик в руках, тяжёлый. Лента — за рукой 07. Положи на неё.' : `Осталось перенести: ${MANUAL_DELIVERY_TARGET - state.delivered}. Ящики — в куче слева.`;
    else if (state.phase === 'report') status.textContent = 'Три ящика на ленте. Вернись к начальнику.';
    else if (state.phase === 'confront') status.textContent = 'Выбирай: поговорить или толкнуть его.';
    else if (state.phase === 'fight') status.textContent = 'Считай: 1 · 2 · 3 · БАМ. Толкай сразу после БАМ.';
    else if (state.phase === 'fight-result') status.textContent = state.fightWon ? 'Начальник отступил.' : 'Начальник тебя отодвинул.';
    else if (state.phase === 'payday') status.textContent = 'Начальник орёт.';
    else if (state.phase === 'slam') status.textContent = 'Начальник идёт к столу у руки 07. Злой.';
    else if (state.phase === 'lock') status.textContent = state.pry > 0 ? `Отжимаешь защиту… ${Math.round(state.pry * 100)}%` : 'С корпуса руки отскочила наклейка — «ЗАЩИТА ОТ ДЕТЕЙ». Отожми её.';
    else if (state.phase === 'button') status.textContent = 'Под защитой — кнопка print("wake"). Нажми.';
    else if (state.phase === 'shock') status.textContent = 'ТЕБЯ БЬЁТ ТОКОМ.';
    // 29.09: Сергей -- boss should hurry you along if you just stand there,
    // and eventually smack you if you keep ignoring him.
    if (performance.now() < nudgeUntil) status.textContent = nudgeText;
    if (dive) status.textContent = dive.after ? 'Рука 07 гудит. Ты видишь код под стенами.' : 'ТЕБЯ БЬЁТ ТОКОМ. Что-то происходит…';
    root.dataset.dive = dive ? (dive.after ? 'after' : diveStage(performance.now()).stage) : '';
    root.dataset.anger = String(state.anger ?? 0);
    root.dataset.ko = String(Boolean(state.ko));
    root.dataset.hands = fistsVisible() ? (state.carrying ? 'crate' : 'fists') : 'none';
    if (angerEl) {
      angerEl.hidden = !fistsVisible() || Boolean(state.ko) || ['lock', 'button', 'shock'].includes(state.phase) || ['fight', 'fight-result'].includes(state.phase) && !dialogue.hidden;
      angerEl.dataset.level = String(state.anger ?? 0);
      angerEl.dataset.full = String(angerFull(state.anger));
      if (angerText) angerText.textContent = angerLabel(state.anger);
    }
    touchUse ??= touchUseEl();
    if (touchUse) { const t = state.carrying ? 'ПОЛОЖИТЬ' : 'ВЗЯТЬ'; if (touchUse.textContent !== t) touchUse.textContent = t; }
    const blocked = ['confront', 'fight', 'fight-result', 'shock'].includes(state.phase) || !!talk || !!dive || !!state.ko;
    const pryShown = state.phase === 'lock' && !blocked && (target?.kind === 'lock' || prying || Boolean(pryDrag) || state.pry > 0);
    // The pry track carries its own words; the prompt steps aside for it.
    if (prompt) prompt.hidden = blocked || pryShown;
    // 19.5 (§22): the pry track -- hold E, or press and slide on a phone.
    if (pryEl) {
      const show = pryShown;
      if (pryEl.hidden === show) pryEl.hidden = !show;
      if (show) {
        const touch = document.querySelector('#game')?.dataset.touch === 'true';
        const label = touch ? OPENING_LINES.pryTouch : (document.pointerLockElement === canvas ? OPENING_LINES.pryHint : `${OPENING_LINES.pryHint} · ИЛИ ТЯНИ МЫШЬЮ`);
        if (pryLabel && pryLabel.textContent !== label) pryLabel.textContent = label;
        pryEl.style.setProperty('--pry', String(state.pry ?? 0));
        pryEl.dataset.active = String(Boolean(prying || pryDrag));
      }
    }
    if (prompt && !prompt.hidden) {
      const touch = document.querySelector('#game')?.dataset.touch === 'true';
      let text = touch ? 'ДЖОЙСТИК — ИДТИ · ВЕДИ ПАЛЬЦЕМ СПРАВА — СМОТРЕТЬ' : 'WASD · ИДТИ · МЫШЬ · СМОТРЕТЬ · F / КЛИК · УДАР';
      const fist = touch ? 'УДАР' : 'F';
      if (target?.kind === 'crate') text = 'E · ВЗЯТЬ ЯЩИК';
      else if (target?.kind === 'belt') text = 'E · ПОЛОЖИТЬ НА ЛЕНТУ';
      else if (target?.kind === 'boss') text = angerFull(state.anger) ? `E · К НАЧАЛЬНИКУ · ${fist} · НА ЗЛОСТИ` : 'E · К НАЧАЛЬНИКУ';
      else if (target?.kind === 'worker') text = `E · ${FIRST_SHIFT_WORKERS[target.id].title}: ПОПРОСИТЬ · ${fist} · УДАРИТЬ`;
      else if (state.carrying) text = touch ? 'НЕСИ К ЛЕНТЕ ЗА РУКОЙ 07' : 'НЕСИ К ЛЕНТЕ ЗА РУКОЙ 07 · РУКИ ЗАНЯТЫ';
      else if (target?.kind === 'lock') text = touch ? `${OPENING_LINES.pryTouch} · ЗАЩИТА ОТ ДЕТЕЙ` : 'ДЕРЖИ E · ОТЖАТЬ ЗАЩИТУ ОТ ДЕТЕЙ';
      else if (target?.kind === 'button') text = touch ? 'E · НАЖАТЬ print("wake")' : OPENING_LINES.press;
      else if (state.phase === 'lock') text = 'ПОДОЙДИ К РУКЕ 07 · НАКЛЕЙКА НА КОРПУСЕ';
      prompt.textContent = text; prompt.dataset.hot = String(Boolean(target));
    }
    root.dataset.target = String(Boolean(target) && !blocked);
    root.dataset.phase = state.phase;
    if (fightMeterEl) fightMeterEl.style.width = `${state.fightMeter}%`;
    if (fightPanel) fightPanel.dataset.hot = String(fightHot(performance.now()));
    if (state.phase === 'fight' && beatPips.length) {
      const b = fightBeat(fightMs(performance.now())).beat;
      beatPips.forEach((li, i) => { li.dataset.on = String(i === b); });
    }
  }

  // ------------------------------------------------------------ simulation

  // People and the arm are round obstacles up to their height: jump high
  // enough (off a crate) and you clear them, like in Doom.
  function circles() {
    const out = [{ x: SPOTS.arm.x, z: SPOTS.arm.z, r: 0.55, top: 2.1 }];
    // 18.1 (Сергей 04.10: «подходишь близко — их не видно»): people keep a
    // little personal space, so they never slide out under the view.
    if (bossPresent() && boss.mode === 'stand') out.push({ x: boss.x, z: boss.z, r: 0.62, top: 1.9 });
    for (const w of Object.values(WORKER_SPOTS)) out.push({ x: w.x, z: w.z, r: w === WORKER_SPOTS.lunch ? 0.62 : 0.6, top: 1.85 });
    const c = crateAt(); out.push({ x: c.x, z: c.z, r: 0.42, top: CRATE_H });
    return out;
  }

  function syncPile() {
    for (const { cx, cz } of PILE) {
      const cell = map.cells[cz * map.w + cx];
      cell.floor = CRATE_H * pileCount(state, cx, cz);
    }
  }

  // The boss's desk (the bench 'WW' west of him) and where his fist lands.
  const DESK = { x: 7.55, z: 10.5, y: 0.95 };
  let bossPath = SPOTS.bossExitFromTable;

  function updateBoss(dt, now) {
    // 19.5 (§22): «Медленно!» -- off to the table by the arm.
    if (boss.mode === 'stand' && state.phase === 'slam') { boss.mode = 'toTable'; boss.t = 0; boss.leg = 0; boss.banged = false; }
    if (boss.mode === 'toTable') {
      boss.t += dt;
      const to = SPOTS.bossToTable[boss.leg];
      const dx = to.x - boss.x, dz = to.z - boss.z; const d = Math.hypot(dx, dz);
      const v = 2.3 * dt;
      if (d <= v) {
        boss.x = to.x; boss.z = to.z; boss.leg += 1;
        if (boss.leg >= SPOTS.bossToTable.length) { boss.mode = 'bang'; boss.t = 0; boss.leg = 0; }
      } else { boss.x += dx / d * v; boss.z += dz / d * v; boss.facing = turnToward(boss.facing, yawTo(0, 0, dx, dz), 8 * dt); }
    } else if (boss.mode === 'bang') {
      boss.t += dt;
      // 18.1 (Сергей 04.10: «стукает по столу — кажется, что по нам»): he
      // turns to the table and the fist lands THERE: dust and a jump of the
      // things on it.
      const T = SPOTS.armTable;
      boss.facing = turnToward(boss.facing, yawTo(boss.x, boss.z, T.x, T.z), 10 * dt);
      if (boss.t > 0.45 && !boss.banged) { boss.banged = true; slamTable(now); }
      if (boss.t > 1.6) { boss.mode = 'walk'; boss.leg = 0; boss.t = 0; bossPath = SPOTS.bossExitFromTable; }
    } else if (boss.mode === 'walk') {
      boss.t += dt;
      const wp = bossPath[boss.leg];
      const dx = wp.x - boss.x, dz = wp.z - boss.z; const d = Math.hypot(dx, dz);
      const v = 2.2 * dt;
      if (d <= v) {
        boss.x = wp.x; boss.z = wp.z;
        boss.leg += 1;
        if (boss.leg >= bossPath.length) {
          boss.mode = 'gone'; doorWanted = 0;
          // He's gone. You look at the casing: what was that?
          if (state.phase === 'lock' && !speech) { speech = { who: 'me', name: 'ТЫ', text: OPENING_LINES.lockSeen, until: now + 3400 }; }
          setTimeout(() => { if (active && state.phase === 'lock' && !speech) { const t = performance.now(); speech = { who: 'lunch', name: FIRST_SHIFT_WORKERS.lunch.title, text: OPENING_LINES.lockLoader, until: t + 3000 }; talkedUntil.lunch = Math.max(talkedUntil.lunch ?? 0, t + 2400); onSound('chatter'); } }, 4200);
        }
      } else { boss.x += dx / d * v; boss.z += dz / d * v; boss.facing = turnToward(boss.facing, yawTo(0, 0, dx, dz), 6 * dt); }
      const dd = Math.hypot(boss.x - SPOTS.door.x, boss.z - SPOTS.door.z);
      if (boss.mode === 'walk' && dd < 3.2) doorWanted = 1;
    }
    // The gate: lifts like a Doom door, closes behind him.
    const prev = door;
    const doorGoal = doorWanted ? 1 : (performance.now() < peekUntil ? 0.32 : 0);
    door = clamp(door + Math.sign(doorGoal - door) * Math.min(Math.abs(doorGoal - door), dt * (doorWanted ? 0.8 : 1.6)), 0, 1);
    if ((prev === 0 && door > 0) || (prev === 1 && door < 1)) onSound('door');
    for (const cell of map.cells) if (cell.door) cell.ceil = door * DOOR_H;
  }

  // The fight's bar: a soft tick on 1, 2, 3 and the desk slam on 4.
  function updateBeat(now) {
    const fb = fightBeat(fightMs(now));
    const key = fb.bar * BAR_BEATS + fb.beat;
    if (key === lastBeat) return;
    lastBeat = key;
    if (fb.slam) {
      slamAt = now; onSound('impact');
      for (let i = 0; i < 10; i++) particles.push({ x: DESK.x + (Math.random() - 0.5) * 0.5, z: DESK.z + (Math.random() - 0.5) * 0.4, y: DESK.y, vx: (Math.random() - 0.5) * 1.2, vz: (Math.random() - 0.5) * 1.2, vy: 0.5 + Math.random(), life: 0.4 + Math.random() * 0.3, color: rgb(190, 180, 160), size: 0.03 });
      dynFlash = { x: DESK.x, z: DESK.z, until: now + 90 };
    } else onSound('beat');
  }

  function updateFacing(dt) {
    const p = state.player;
    for (const [id, w] of Object.entries(WORKER_SPOTS)) {
      const want = talkingTo(id) ? yawTo(w.x, w.z, p.x, p.z) : w.facing;
      facing[id] = turnToward(facing[id], want, 5 * dt);
    }
    if (boss.mode !== 'walk' && boss.mode !== 'gone') boss.facing = turnToward(boss.facing, yawTo(boss.x, boss.z, p.x, p.z), 3 * dt);
  }

  function updateWorld(dt, now) {
    for (const c of beltCrates) c.x += 0.55 * dt;
    while (beltCrates.length && beltCrates[0].x > 18.9) beltCrates.shift();
    // Welding sparks and the blue flicker; now and then the electrician's cabinet spits too.
    const wel = WORKER_SPOTS.welder;
    const tip = localToWorld(wel.x, wel.z, facing.welder, 0.62, 0.06);
    if (!reduceMotion && !talkingTo('welder') && Math.random() < 0.8) {
      for (let i = 0; i < 3; i++) particles.push({ x: tip.x, z: tip.z, y: 0.8, vx: (Math.random() - 0.5) * 1.6, vz: (Math.random() - 0.5) * 1.6, vy: Math.random() * 1.6, life: 0.35 + Math.random() * 0.4, color: Math.random() < 0.5 ? rgb(255, 236, 170) : rgb(255, 160, 60), size: 0.04 });
    }
    const ele = WORKER_SPOTS.electrician;
    if (!reduceMotion && !talkingTo('electrician') && Math.random() < dt * 0.35) {
      const st = localToWorld(ele.x, ele.z, facing.electrician, 0.62, 0.2);
      dynFlash = { x: st.x, z: st.z, until: now + 160 };
      for (let i = 0; i < 14; i++) particles.push({ x: st.x, z: st.z, y: 1.38, vx: Math.random() * 1.5 - 0.3, vz: (Math.random() - 0.5) * 1.5, vy: Math.random() * 2, life: 0.3 + Math.random() * 0.4, color: rgb(200, 230, 255), size: 0.025 });
      if (Math.hypot(ele.x - state.player.x, ele.z - state.player.z) < 6) onSound('wire');
    }
    for (const p of particles) { p.vy -= 6 * dt; p.x += p.vx * dt; p.z += p.vz * dt; p.y += p.vy * dt; p.life -= dt; if (p.y < 0.01) { p.y = 0.01; p.vy *= -0.3; } }
    for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);
    // The fitter's wrench lands every ~0.7 s.
    const fitFrame = Math.floor(now / 110) % 7;
    if (fitFrame === 3 && lastFitterFrame !== 3) {
      const fit = WORKER_SPOTS.fitter;
      if (Math.hypot(fit.x - state.player.x, fit.z - state.player.z) < 7) onSound('clank');
    }
    lastFitterFrame = fitFrame;
  }
  let lastFitterFrame = 0;

  function update(now) {
    if (!active) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const blocked = !dialogue.hidden || ['confront', 'fight', 'fight-result', 'shock'].includes(state.phase) || !!dive || !!state.ko;
    if (blocked) held.clear();
    // 19.5 (§22): holding E on the child-lock pries it.
    if (prying && !blocked && state.phase === 'lock') {
      // Keep pushing while the lock is in front; a glance away just pauses it
      // (letting go of E is what makes it click back).
      if (target?.kind === 'lock') pryBy(pryStep(state.pry, { held: true, dt: dt * 1000 }) - state.pry, now);
    }
    if (dive) updateDive(now);
    // 19.4 (§21): the knuckle crack on spawn; a beating ends at the spawn.
    if (!hands.cracked && now - hands.spawnAt > CRACK_AT_MS && fistsVisible()) { hands.cracked = true; onSound('knuckles'); }
    if (state.ko && now - koAt >= KO_TOTAL_MS - 260) wakeUp(now);
    if (now - swatAt < 320 && swatDir) { moveBody(map, body, swatDir.x * dt * 4.5, swatDir.z * dt * 4.5, { circles: circles() }); state.player.x = body.x; state.player.z = body.z; }
    const forward = (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0) - (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0);
    const strafe = (held.has('KeyD') ? 1 : 0) - (held.has('KeyA') ? 1 : 0);
    const turn = (held.has('ArrowRight') ? 1 : 0) - (held.has('ArrowLeft') ? 1 : 0);
    state.player.yaw = wrapAngle(state.player.yaw + turn * dt * 2.2);
    const tilt = (held.has('KeyR') || held.has('PageUp') ? 1 : 0) - (held.has('KeyV') || held.has('PageDown') ? 1 : 0);
    if (tilt) { pitch = clampPitch(pitch + tilt * dt * 1.8); manualLookAt = now; }
    if (turnTo !== null) {
      const diff = wrapAngle(turnTo - state.player.yaw);
      state.player.yaw = wrapAngle(state.player.yaw + diff * Math.min(1, dt * 8));
      if (Math.abs(diff) < 0.01) turnTo = null;
    }
    // 29.09: Сергей -- boss nudges you if you stand around, then smacks you
    // if you keep ignoring him. Tracked only while manually carrying crates.
    if (state.phase === 'manual' && !blocked) {
      if (forward === 0 && strafe === 0) idleSeconds += dt; else idleSeconds = 0;
      if (idleStage === 0 && idleSeconds > 7) {
        idleStage = 1; nudgeText = 'НАЧАЛЬНИК: Шевелись давай, я тут не сплю с тобой.'; nudgeUntil = now + 2600; bossAngryUntil = now + 1400; onSound('ui-click');
      } else if (idleStage === 1 && idleSeconds > 14) {
        idleStage = 0; idleSeconds = 0; nudgeText = 'Подзатыльник. ДВИГАЙСЯ.'; nudgeUntil = now + 2200; flashUntil = now + 180; flashColor = 'white'; faceOuchUntil = now + 700; shakeUntil = now + 250; onSound('blocked');
        moveBody(map, body, Math.sin(state.player.yaw) * 0.35, -Math.cos(state.player.yaw) * 0.35, { circles: circles() });
        state.player.x = body.x; state.player.z = body.z;
      }
    } else idleSeconds = 0;
    // 29.09: carrying a big crate should feel heavy, not free.
    let moving = false;
    if (!blocked && (forward || strafe)) {
      const speed = state.carrying ? 2.1 : 3.2;
      const sin = Math.sin(state.player.yaw), cos = Math.cos(state.player.yaw);
      const len = Math.hypot(forward, strafe);
      const dx = ((sin * forward) + (cos * strafe)) / len * speed * dt;
      const dz = ((-cos * forward) + (sin * strafe)) / len * speed * dt;
      const moved = moveBody(map, body, dx, dz, { circles: circles() });
      state.player.x = body.x; state.player.z = body.z;
      if (moved > 0.0005) {
        moving = true;
        if (body.grounded) {
          walkPhase += moved * 3.2;
          stepAcc += moved;
          if (stepAcc > (state.carrying ? 0.62 : 0.78)) { stepAcc = 0; onSound('step'); }
        }
      }
    }
    if (!moving || !body.grounded) walkPhase *= 0.9;
    syncPile();
    // Gravity, landing on crates/the belt/benches, and what people say about it.
    const fall = stepBody(map, body, dt, { circles: circles() });
    state.player.x = body.x; state.player.z = body.z;
    if (fall.landed) {
      if (fall.impact > 3) { dipAt = now; dipImpact = fall.impact; onSound('land'); if (fall.impact > 9.5) shakeUntil = now + 160; }
      const cell = cellAt(map, body.x, body.z);
      const surface = body.y > 0.3 ? surfaceOf(cell) : 'floor';
      const said = moments.landed({ impact: fall.impact, fall: fall.fall, surface });
      if (said) comment(said);
    }
    if (fall.bonk) { onSound('hit'); shakeUntil = now + 120; comment('bonk'); }
    // 18.0: the boss's gate is not a dead end, it's a gag — the door lifts a
    // crack, a hand shoves you out: «только для мееенеджеров».
    if (!blocked && nearBossDoor(body.x, body.z) && door < 0.5 && now > gagReadyAt) {
      gagReadyAt = now + 3500; peekUntil = now + 1300; pushUntil = now + 520;
      onSound('door'); setTimeout(() => active && onSound('hit'), 260);
      shakeUntil = now + 220; flashUntil = now + 90; flashColor = 'white';
      speech = { who: bossPresent() ? 'boss' : 'radio', name: bossPresent() ? 'НАЧАЛЬНИК' : 'ГОЛОС ИЗ-ЗА ДВЕРИ', text: 'Куда?! Только для мееенеджеров!', until: now + 3200 };
      onFlag('doorGag');
    }
    if (now < pushUntil) { moveBody(map, body, 0, -dt * 5.2, { circles: circles() }); state.player.x = body.x; state.player.z = body.z; }
    // 18.0: looking at the clock above the loader (side quest «Обед в 11:00»).
    if (!clockSeen) {
      const look = castCenter(map, body.x, body.z, state.player.yaw, 6, EYE);
      if (look?.cell?.wall === 'SIGN_CLOCK') { clockSeen = true; onFlag('sawClock'); comment('clock', true); }
    }
    if (!blocked) for (const ev of moments.frame(dt, { pitch, moving, busy: state.phase === 'manual' || !!talk })) comment(ev);
    if (speech && now > speech.until) speech = null;
    if (state.phase === 'fight') updateBeat(now);
    // Gamer slips (§16), one per scene: wondering where to save a little into
    // the carrying, the "!" over the boss once the three crates are done.
    if (state.phase === 'manual' && !blocked) { if (!manualSince) manualSince = now; if (now - manualSince > 9000 && !speech) slip('shift1-manual'); }
    if (state.phase === 'report' && !blocked && !speech && state.delivered >= MANUAL_DELIVERY_TARGET) slip('shift1-report');
    updateBoss(dt, now);
    updateFacing(dt);
    updateWorld(dt, now);
    target = blocked ? null : chooseTarget();
    // The pop pulls the eye to the arm's casing.
    if (!target && state.phase === 'lock' && boss.mode === 'gone' && now - manualLookAt > 1500) {
      const at = lockSpot();
      const dist = Math.max(0.5, Math.hypot(at.x - body.x, at.z - body.z));
      const want = clampPitch(Math.atan2(at.y - (body.y + EYE), dist));
      if (want < pitch) pitch += (want - pitch) * Math.min(1, dt * 3);
    }
    if (target && now - manualLookAt > 1500) {
      const aimY = target.kind === 'lock' || target.kind === 'button' ? 0.82 : target.kind === 'worker' ? (target.id === 'lunch' ? 0.95 : 1.15) : target.kind === 'boss' ? 1.3
        : target.kind === 'crate' ? Math.max(0.4, CRATE_H * pileCount(state, target.cx, target.cz) - 0.2) : BELT_H;
      const tx = target.x ?? target.cx + 0.5; const tz = target.z ?? target.cz + 0.5;
      const dist = Math.max(0.5, Math.hypot(tx - body.x, tz - body.z));
      const want = clampPitch(Math.atan2(aimY - (body.y + EYE), dist));
      if (want < pitch) pitch += (want - pitch) * Math.min(1, dt * 3.5);
    }
    renderText(); draw(now);
    raf = requestAnimationFrame(update);
  }

  // ----------------------------------------------------------------- draw

  function sprite(name, x, z, y = 0, extra = {}) {
    const img = atlas?.[name];
    return img ? { img, x, z, y, ppm: img.ppm || 40, ...extra } : null;
  }

  function faceName(now) {
    if (now < faceOuchUntil) return 'stfouch0';
    const ds = diveStage(now);
    if (ds && ['shock', 'enter'].includes(ds.stage)) return 'stfouch0'; // the shock first
    if (ds && ['vision', 'peak', 'after'].includes(ds.stage)) return 'stfevl0';
    if (state.phase === 'fight') return 'stfkill0';
    if (state.phase === 'button') return 'stfevl0';
    return `stfst0${[1, 0, 2, 1][Math.floor(now / 1700) % 4]}`;
  }

  function drawStatusBar(buf, now) {
    const y0 = VIEW_ROWS - BAR_H;
    const bar = atlas.stbar;
    const x0 = Math.round((W - 320) / 2);
    const stone = atlas.FLAT5_4;
    for (let y = y0; y < VIEW_ROWS; y++) for (let x = 0; x < W; x++) {
      if (x >= x0 && x < x0 + 320) continue;
      const c = stone.data[((y - y0) % stone.h) * stone.w + (x % stone.w)];
      const k = y === y0 ? 0.95 : 0.5;
      buf[y * W + x] = rgb(((c & 255) * k) | 0, (((c >>> 8) & 255) * k) | 0, (((c >>> 16) & 255) * k) | 0);
    }
    renderer.blit(bar, x0, y0);
    // Cover Doom's English labels with our own plates.
    const plate = (px, pw, text, color = DIM) => {
      for (let y = y0 + 23; y < y0 + 31; y++) for (let x = x0 + px; x < x0 + px + pw; x++) buf[y * W + x] = rgb(40, 40, 40);
      drawText(buf, W, VIEW_ROWS, x0 + px + Math.round((pw - textWidth(text)) / 2), y0 + 24, text, color, { shadow: 0 });
    };
    plate(2, 100, 'РУБЛИ · ЯЩИКИ');
    plate(106, 36, 'РУКА 07');
    plate(180, 54, 'НАЧАЛЬНИК');
    // Right-hand block (was ammo counts).
    for (let y = y0 + 3; y < y0 + 29; y++) for (let x = x0 + 250; x < x0 + 317; x++) buf[y * W + x] = rgb(34, 34, 34);
    drawText(buf, W, VIEW_ROWS, x0 + 253, y0 + 5, 'СМЕНА 1', WHITE, { shadow: 0 });
    drawText(buf, W, VIEW_ROWS, x0 + 253, y0 + 14, 'СКЛАД 07', DIM, { shadow: 0 });
    drawText(buf, W, VIEW_ROWS, x0 + 253, y0 + 22, `${FIRST_SHIFT_PAY}₽/ЯЩ`, GOLD, { shadow: 0 });
    // Big red numbers: money, crates.
    const bigNum = (value, rightX) => {
      const digits = String(value);
      let x = rightX - digits.length * 14;
      for (const d of digits) { renderer.blit(atlas[`sttnum${d}`], x0 + x, y0 + 3); x += 14; }
    };
    bigNum(state.delivered * FIRST_SHIFT_PAY, 46);
    bigNum(state.delivered, 88);
    drawText(buf, W, VIEW_ROWS, x0 + 90, y0 + 10, `/${MANUAL_DELIVERY_TARGET}`, RED, { shadow: 0 });
    // Arm 07 status and the boss's mood.
    const blink = Math.floor(now / 500) % 2 === 0;
    if (armDead()) drawText(buf, W, VIEW_ROWS, x0 + 110, y0 + 10, 'СТОИТ', blink ? RED : rgb(120, 40, 30), { shadow: 0 });
    else drawText(buf, W, VIEW_ROWS, x0 + 110, y0 + 10, 'ОЖИЛА', CYAN, { shadow: 0 });
    let mood = 'СЛЕДИТ';
    if (state.phase === 'fight') mood = 'ДЕРЁТСЯ';
    else if (now < nudgeUntil || now < bossAngryUntil) mood = 'ОРЁТ';
    else if (state.phase === 'confront' || state.phase === 'fight-result') mood = 'ЗЛОЙ';
    else if (state.phase === 'payday' || (state.phase === 'slam' && boss.mode !== 'walk')) mood = 'ОРЁТ';
    else if (['slam', 'lock', 'button', 'shock', 'done'].includes(state.phase)) mood = boss.mode === 'gone' ? 'УШЁЛ' : 'УХОДИТ';
    drawText(buf, W, VIEW_ROWS, x0 + 207 - Math.round(textWidth(mood) / 2), y0 + 10, mood, mood === 'УШЁЛ' ? GOLD : RED, { shadow: 0 });
    renderer.blit(atlas[faceName(now)], x0 + 148, y0 + 2);
  }

  function draw(now) {
    if (!ctx || !canvas || !imageData) return;
    const viewH = VIEW_ROWS - BAR_H;
    const buf = renderer.buf;
    if (!atlas) {
      buf.fill(rgb(8, 9, 10));
      drawText(buf, W, VIEW_ROWS, W / 2 - textWidth('ЗАГРУЗКА...') / 2, VIEW_ROWS / 2, 'ЗАГРУЗКА...', DIM);
      ctx.putImageData(imageData, 0, 0);
      return;
    }
    const t = now / 1000;
    const shake = now < shakeUntil && !reduceMotion ? (Math.random() - 0.5) * 4 : 0;
    const bob = reduceMotion ? 0 : Math.sin(walkPhase * 2) * 1.6;
    const dip = reduceMotion ? 0 : landingDip(dipImpact, (now - dipAt) / 320);
    // 19.4 (§21): laid out -- the view drops to the floor and tips up.
    const kd = state.ko ? Math.min(1, Math.max(0, (now - koAt) / 640)) : 0;
    const fallK = kd * kd;
    const viewEye = body.y + EYE - dip * 0.22 - fallK * (EYE - 0.22);
    // 19.5 (§22): the shock jolts the whole view.
    const zap = now - shockAt < 1600 && !reduceMotion ? (Math.random() - 0.5) * 10 * (1 - (now - shockAt) / 1600) : 0;
    const cam = { x: state.player.x, z: state.player.z, yaw: state.player.yaw + shake * 0.004 + zap * 0.003, eye: viewEye, bob: (body.grounded ? bob : 0) + shake + zap + dip * 6, pitch: pitchShear(clampPitch(pitch + fallK * 0.35), viewH) };

    const sprites = [];
    const push = (s) => { if (s) sprites.push(s); };
    for (const L of LAMPS.slice(0, 5)) push(sprite('lamp', L.x, L.z, HALL_CEIL - 1.2));
    // Arm 07: dead (the atlas's slumped one) until the shock wakes it.
    const armAwake = !armDead() && (state.phase === 'done' || dive?.after);
    if (armAwake && awakeArms) {
      const cyc = ((now - shockAt) / 2600) % 1;
      sprites.push({ img: awakeArms[`arm07_${armPoseAt(cyc)}_${Math.floor(now / 500) % 2}`], x: SPOTS.arm.x, z: SPOTS.arm.z, y: 0.25, ppm: 40 });
    } else push(sprite(`arm07_${Math.floor(now / 600) % 2}`, SPOTS.arm.x, SPOTS.arm.z, 0.25));
    // 19.5 (§22): the child-lock on its casing -- flat, then hanging loose
    // after the slam (shaking while you pry), then falling off; the button.
    if (lockImg) {
      const at = lockSpot();
      if (!state.lockOff && !lockFall) {
        const loose = state.lockLoose;
        const pop = now - lockAt;
        const hop = pop >= 0 && pop < 500 ? Math.sin((pop / 500) * Math.PI) * 0.18 : 0;
        const pryK = state.pry ?? 0;
        const shakeX = (prying || pryDrag) && !reduceMotion ? (Math.random() - 0.5) * 0.03 : 0;
        const hot = target?.kind === 'lock';
        sprites.push({ img: loose ? lockLooseImg : lockImg, x: at.x + shakeX + pryK * 0.06, z: at.z, y: at.y + hop - (loose ? 0.04 : 0) + pryK * 0.05, ppm: loose ? 64 : 80, ...(hot || pop < 1500 ? { fullbright: true, glow: hot ? 1.35 : 1.15 } : {}) });
      }
      if (lockFall) {
        const k = Math.min(1, (now - lockFall.at) / 420);
        sprites.push({ img: lockLooseImg, x: lockFall.x + k * 0.25, z: lockFall.z, y: Math.max(0.02, at.y * (1 - k * k)), ppm: 64 });
      }
      if (state.lockOff || lockFall) {
        const hot = target?.kind === 'button';
        const pulse = state.phase === 'button' ? 1.15 + 0.2 * Math.sin(now / 160) : 1;
        sprites.push({ img: buttonImg, x: at.x, z: at.z, y: at.y, ppm: 64, fullbright: true, glow: hot ? 1.5 : pulse });
      }
    }
    for (const [x, z] of [[14.6, 12.6], [15.3, 12.1], [1.6, 6.4], [15.4, 6.6]]) push(sprite('bar1a0', x, z, 0, { ppm: 30 }));
    push(sprite('colua0', 1.5, 3.6, 0, { ppm: 32 }));
    // People, drawn from whichever of 8 sides the camera is on. Working
    // loops, or turned to you and waving you off.
    const person = (name, x, z, face, y = 0) => {
      const sp = sprite(`${name}_r${viewIndex(face, cam.x, cam.z, x, z)}`, x, z, y);
      // 19.4: the one you just punched flashes.
      const who = name.split('_')[0];
      if (sp && now < (hitFlash[who] ?? 0)) return { ...sp, fullbright: true, glow: 1.7 };
      // 18.1: whoever E would talk to glows a little — no more pressing blind.
      const hot = sp && target && ((target.kind === 'worker' && Math.hypot(WORKER_SPOTS[target.id].x - x, WORKER_SPOTS[target.id].z - z) < 0.05) || (target.kind === 'boss' && name.startsWith('boss_')));
      return hot ? { ...sp, fullbright: true, glow: 1.3 } : sp;
    };
    const wel = WORKER_SPOTS.welder, fit = WORKER_SPOTS.fitter, ele = WORKER_SPOTS.electrician, lun = WORKER_SPOTS.lunch;
    const talkFrame = Math.floor(now / 260) % 2;
    push(person(talkingTo('welder') ? `welder_talk${talkFrame}` : `welder_work${Math.floor(now / 80) % 2}`, wel.x, wel.z, facing.welder));
    push(person(talkingTo('fitter') ? `fitter_talk${talkFrame}` : `fitter_work${[0, 0, 1, 2, 2, 1, 0][Math.floor(now / 110) % 7]}`, fit.x, fit.z, facing.fitter));
    push(person(talkingTo('electrician') ? `electrician_talk${talkFrame}` : `electrician_work${Math.floor(now / 420) % 2}`, ele.x, ele.z, facing.electrician));
    push(person(talkingTo('lunch') ? 'lunch_wave' : `lunch_eat${[0, 1, 1, 1][Math.floor(now / 520) % 4]}`, lun.x, lun.z, facing.lunch));
    // The boss.
    if (bossPresent()) {
      let pose = 'idle';
      if (state.phase === 'briefing') pose = 'point';
      if (now < bossAngryUntil) pose = 'angry';
      if (state.phase === 'confront') pose = 'angry';
      if (state.phase === 'fight') pose = now < bossHitUntil ? 'hit' : (now - slamAt < 320 ? 'bang' : 'fight');
      if (state.phase === 'fight-result') pose = state.fightWon ? 'hit' : 'angry';
      if (boss.mode === 'bang') pose = boss.t > 0.3 && boss.t < 0.8 ? 'bang' : 'angry';
      if (state.phase === 'payday') pose = 'angry';
      if (boss.mode === 'walk' || boss.mode === 'toTable') pose = `walk${Math.floor(boss.t * 6) % 4}`;
      const sway = state.phase === 'fight' ? Math.sin(now * 0.011) * 0.08 : 0;
      // 19.4 (§21): on anger a landed punch knocks him back a step.
      const kk = (now - bossKnockAt) / 450;
      let kx = 0, kz = 0;
      if (kk >= 0 && kk < 1) { const dx = boss.x - state.player.x, dz = boss.z - state.player.z; const len = Math.hypot(dx, dz) || 1; const off = Math.sin(kk * Math.PI) * 0.6; kx = dx / len * off; kz = dz / len * off; }
      push(person(`boss_${pose}`, boss.x + sway + kx, boss.z + kz, boss.facing));
    }
    const lone = crateAt();
    const wob = now - crateWobbleAt < 500 ? Math.sin((now - crateWobbleAt) / 35) * 0.04 * (1 - (now - crateWobbleAt) / 500) : 0;
    push(sprite('crate3q', lone.x + wob, lone.z, 0));
    for (const c of beltCrates) push(sprite('crate3q', c.x, c.z, BELT_H));

    const dynLights = [];
    const flick = 0.35 + Math.random() * 0.6;
    const torch = localToWorld(wel.x, wel.z, facing.welder, 0.62, 0.06);
    if (!talkingTo('welder')) dynLights.push({ x: torch.x, z: torch.z, radius: 3.4, r2: 3.4 * 3.4, intensity: flick, color: [0.55, 0.75, 1.25] });
    if (armAwake) dynLights.push({ x: SPOTS.arm.x + 0.3, z: SPOTS.arm.z + 0.3, radius: 1.8, r2: 3.24, intensity: 0.55, color: [0.3, 1, 1.1] });
    else dynLights.push({ x: SPOTS.arm.x + 0.3, z: SPOTS.arm.z + 0.3, radius: 1.4, r2: 1.96, intensity: Math.floor(now / 600) % 2 ? 0 : 0.35, color: [1, 0.2, 0.15] });
    // The button glows red under the lock; the shock lights the hall blue-white.
    if (state.phase === 'button') { const at = lockSpot(); dynLights.push({ x: at.x, z: at.z, radius: 1.2, r2: 1.44, intensity: 0.4 + Math.sin(now / 160) * 0.15, color: [1.2, 0.3, 0.2] }); }
    if (now - shockAt < 1600) dynLights.push({ x: SPOTS.arm.x, z: SPOTS.arm.z, radius: 6, r2: 36, intensity: Math.floor((now - shockAt) / 90) % 2 ? 1.4 : 0.5, color: [0.7, 0.95, 1.4] });
    if (dynFlash && now < dynFlash.until) dynLights.push({ x: dynFlash.x, z: dynFlash.z, radius: 3, r2: 9, intensity: 0.9, color: [0.8, 0.9, 1.2] });

    const view = renderer.render({ map, cam, lightmap, dynLights, sprites, particles, time: t, viewH });

    // Weapon layer (19.4, §21): the two fists from the first frame, or the
    // crate in both hands; they glow as the anger fills.
    if (fistsVisible()) {
      const pryK = state.phase === 'lock' && (prying || pryDrag) ? Math.max(0.05, state.pry ?? 0) : 0;
      const pose = handsPose(hands, now, { W, viewH, walkPhase, carrying: Boolean(state.carrying), anger: state.anger ?? 0, full: ANGER_FULL, reduceMotion, ko: Boolean(state.ko), pry: pryK });
      drawHands(renderer, atlas, pose, { W, viewH });
    }

    // Screen effects: smack flash, miss flash, the daydream haze.
    const blend = (rgbT, a) => {
      const [tr, tg, tb] = rgbT;
      for (let i = 0; i < W * viewH; i++) {
        const c = buf[i];
        const r = (c & 255) * (1 - a) + tr * a, g = ((c >>> 8) & 255) * (1 - a) + tg * a, b = ((c >>> 16) & 255) * (1 - a) + tb * a;
        buf[i] = rgb(r | 0, g | 0, b | 0);
      }
    };
    if (now < flashUntil) blend(flashColor === 'red' ? [200, 20, 10] : [255, 255, 255], flashColor === 'red' ? 0.35 : 0.5);
    // 19.4 (§21): the blackout after a beating, and coming to at the spawn.
    const black = state.ko ? Math.min(1, Math.max(0, (now - koAt - 640) / 520)) : Math.max(0, 1 - (now - wakeAt) / 900);
    if (black > 0) {
      blend([0, 0, 0], black);
      if (state.ko && black > 0.7) headline(buf, 'ОГРЁБ.', Math.round(viewH / 2 - 7), rgb(200, 40, 30), 2);
    }
    if (now < daydreamUntil) {
      const k = Math.min(1, 1 - (daydreamUntil - now) / 1500);
      blend([214, 226, 255], Math.sin(k * Math.PI) * 0.6);
      const txt = 'ЭХ... МЕЧТЫ, МЕЧТЫ.';
      if (k > 0.15) drawText(buf, W, VIEW_ROWS, Math.round(W / 2 - textWidth(txt, 2) / 2), Math.round(viewH / 2 - 7), txt, rgb(40, 50, 80), { scale: 2, shadow: rgb(240, 244, 255) });
    }
    if (speech && !dive && dialogue.hidden) {
      const floor = prompt && !prompt.hidden ? subtitleFloorRow(viewH, VIEW_ROWS, canvas.getBoundingClientRect(), prompt.getBoundingClientRect()) : null;
      // 19.5: once the lock popped, lines go up and leave the arm's casing clear.
      const raised = ['lock', 'button'].includes(state.phase) ? Math.round(viewH * 0.42) : null;
      drawSpeech(buf, W, viewH, speech, speakerAt(speech.who), { ...view, cam }, { floor: raised ?? floor });
    }
    if (dive) drawDive(buf, now, viewH);
    // Doom-style pickup/event message, top-left of the view.
    if (now < messageUntil && !dive) drawText(buf, W, VIEW_ROWS, Math.round(W / 2 - textWidth(message) / 2), 5, message, message.startsWith('+') ? GOLD : RED);
    drawStatusBar(buf, now);
    ctx.putImageData(imageData, 0, 0);
  }

  // Centred pixel text, one size smaller until it fits a narrow frame.
  function headline(buf, text, y, color, scale, shadow = rgb(8, 10, 18)) {
    let s = scale;
    while (s > 1 && textWidth(text, s) > W - 16) s--;
    drawText(buf, W, VIEW_ROWS, Math.round(W / 2 - textWidth(text, s) / 2), y, text, color, { scale: s, shadow });
    return s;
  }
  function shadeRows(buf, y0, y1, viewH, a = 0.55) {
    for (let y = Math.max(0, y0); y < Math.min(viewH, y1); y++) {
      for (let x = 0, i = y * W; x < W; x++, i++) {
        const c = buf[i];
        buf[i] = rgb(((c & 255) * (1 - a)) | 0, (((c >>> 8) & 255) * (1 - a)) | 0, (((c >>> 16) & 255) * (1 - a)) | 0);
      }
    }
  }
  // 19.5 (§22): the shock -- white flashes (three, slow enough not to
  // strobe), blue-white arcs crawling from the button to the fists, the
  // crackle on top. Over the live frame.
  function shockFx(buf, viewH, now, k) {
    const flash = k < 0.12 ? 0.92 : (k > 0.3 && k < 0.38) ? 0.7 : (k > 0.6 && k < 0.66) ? 0.5 : 0;
    if (flash > 0) {
      for (let i = 0; i < W * viewH; i++) {
        const c = buf[i];
        buf[i] = rgb(((c & 255) * (1 - flash) + 255 * flash) | 0, (((c >>> 8) & 255) * (1 - flash) + 255 * flash) | 0, (((c >>> 16) & 255) * (1 - flash) + 255 * flash) | 0);
      }
    }
    if (!reduceMotion) {
      // Arcs: jagged lines from the middle (the button) down to both fists.
      const seed = Math.floor(now / 60);
      let r = seed * 9301 + 49297;
      const rnd = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
      const arcs = k < 0.85 ? 4 : 1;
      for (let a = 0; a < arcs; a++) {
        let x = W / 2 + (rnd() - 0.5) * 40, y = viewH * 0.45 + (rnd() - 0.5) * 30;
        const tx = a % 2 ? W / 2 + 60 + rnd() * 40 : W / 2 - 60 - rnd() * 40; const ty = viewH - 12;
        for (let s2 = 0; s2 < 14; s2++) {
          const nx = x + (tx - x) / (14 - s2) + (rnd() - 0.5) * 16; const ny = y + (ty - y) / (14 - s2) + (rnd() - 0.5) * 6;
          const n = Math.ceil(Math.hypot(nx - x, ny - y));
          for (let i = 0; i <= n; i++) {
            const px = Math.round(x + ((nx - x) * i) / n), py = Math.round(y + ((ny - y) * i) / n);
            for (const [ox, oy, c] of [[0, 0, rgb(255, 255, 255)], [1, 0, rgb(150, 230, 255)], [0, 1, rgb(150, 230, 255)]]) {
              const qx = px + ox, qy = py + oy;
              if (qx >= 0 && qy >= 0 && qx < W && qy < viewH) buf[qy * W + qx] = c;
            }
          }
          x = nx; y = ny;
        }
      }
    }
    if (k > 0.05) {
      shadeRows(buf, Math.round(viewH * 0.16) - 4, Math.round(viewH * 0.16) + 40, viewH, 0.35);
      const s = headline(buf, DIVE_WORDS.shock, Math.round(viewH * 0.16), rgb(255, 250, 200), 4, rgb(20, 40, 80));
      headline(buf, DIVE_WORDS.shockSub, Math.round(viewH * 0.16) + 7 * s + 6, CYAN, 2);
    }
  }
  // 19.5 (§22, §14 «швы»): after the shock you SEE the deep program -- the
  // hall drawn as its seams (edges lit cyan over a dark teal), code running
  // down under the walls, pulses running along the wires at the floor.
  let deepScratch = null;
  function deepSight(buf, viewH, now) {
    const n = W * viewH;
    if (!deepScratch || deepScratch.length !== n) deepScratch = new Uint8Array(n);
    const L = deepScratch;
    for (let i = 0; i < n; i++) { const c = buf[i]; L[i] = (((c & 255) * 3 + ((c >>> 8) & 255) * 5 + ((c >>> 16) & 255) * 2) / 10) | 0; }
    for (let y = 0; y < viewH; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x; const l = L[i];
        const gx = x + 1 < W ? Math.abs(L[i + 1] - l) : 0; const gy = y + 1 < viewH ? Math.abs(L[i + W] - l) : 0;
        const e = Math.min(1, (gx + gy) / 46);
        const base = l * 0.22;
        buf[i] = rgb(Math.min(255, base * 0.5 + 90 * e) | 0, Math.min(255, base * 0.9 + 240 * e) | 0, Math.min(255, base * 1.1 + 255 * e) | 0);
      }
    }
    // Code under the walls: a few columns of lines drifting down, dim.
    const t = reduceMotion ? 0 : now / 1000;
    const cols = Math.max(3, Math.floor(W / 110));
    for (let c = 0; c < cols; c++) {
      const x = Math.round(8 + c * (W - 16) / cols);
      for (let j = 0; j < 7; j++) {
        const line = DEEP_CODE[(c * 5 + j) % DEEP_CODE.length];
        const y = Math.round(((j * 30 + t * (14 + c * 3)) % (viewH + 30)) - 18);
        if (y < 2 || y > viewH - 10) continue;
        const bright = (j + c + Math.floor(t * 2)) % 7 === 0;
        drawText(buf, W, VIEW_ROWS, x, y, line, bright ? rgb(190, 255, 230) : rgb(40, 140, 130), { shadow: 0 });
      }
    }
    // Wires along the floor, a pulse running each one.
    for (let w2 = 0; w2 < 3; w2++) {
      const y0 = viewH - 24 - w2 * 9;
      const head = ((t * 120 + w2 * 90) % (W + 60)) - 30;
      for (let x = 0; x < W; x++) {
        const y = Math.round(y0 + Math.sin(x / 23 + w2 * 2) * 2);
        if (y < 0 || y >= viewH) continue;
        const d = Math.abs(x - head);
        buf[y * W + x] = d < 12 ? rgb(255, 255, 200) : rgb(30, 110, 120);
      }
    }
    shadeRows(buf, Math.round(viewH * 0.2) - 6, Math.round(viewH * 0.2) + 30, viewH, 0.45);
    const s = headline(buf, DIVE_WORDS.after, Math.round(viewH * 0.2), GOLD, 2);
    headline(buf, DIVE_WORDS.afterSub, Math.round(viewH * 0.2) + 7 * s + 6, WHITE, 1);
  }
  // A vision's words type themselves out over a dark band; measured on the
  // full caption so the line doesn't shift while it types.
  function visionCaption(buf, v, chars, viewH) {
    if (chars <= 0) return;
    let s = 2;
    while (s > 1 && textWidth(v.caption, s) > W - 16) s--;
    const y0 = viewH - 7 * s - 22;
    shadeRows(buf, y0 - 6, y0 + 7 * s + 18, viewH);
    drawText(buf, W, VIEW_ROWS, Math.round(W / 2 - textWidth(v.caption, s) / 2), y0, v.caption.slice(0, chars), WHITE, { scale: s, shadow: rgb(8, 10, 18) });
    if (chars >= v.caption.length) headline(buf, v.sub, y0 + 7 * s + 6, rgb(...v.tint), 1);
  }

  const VISION_MS = DIVE_TIMELINE.find((s) => s.stage === 'vision').ms;
  function drawDive(buf, now, viewH) {
    const st = diveStage(now);
    const H = viewH; const t = (now - dive.start) / 1000;
    const maxR = diveFx.radius(W, H);
    const ease = (k) => 1 - (1 - k) * (1 - k);
    if (st.stage === 'after') { deepSight(buf, H, now); return; }
    if (st.stage === 'shock') { shockFx(buf, H, now, st.k); return; }
    if (reduceMotion) { drawDiveCalm(buf, st, H, now); return; }
    if (st.stage === 'enter') {
      // The screen goes dark, stars fall across it, then the rainbow spiral
      // winds up in the middle and wipes the factory away.
      const src = diveFx.snapshot(buf, W, H, 'a');
      diveFx.swirl(buf, src, W, H, st.k * st.k * 3.2);
      diveFx.blend(buf, W, H, [2, 3, 8], Math.min(1, st.k / 0.35) * 0.86);
      const open = Math.max(0, (st.k - 0.25) / 0.75);
      if (open > 0) diveFx.tunnel(buf, W, H, t, { R: maxR * Math.pow(open, 1.4), soft: 48, outside: 0.1 * open });
      diveFx.stars(buf, W, H, t, st.k < 0.8 ? 1 : (1 - st.k) / 0.2);
      if (st.k > 0.45) headline(buf, DIVE_WORDS.enter, H - 16, WHITE, 1);
    } else if (st.stage === 'vision') {
      diveFx.tunnel(buf, W, H, t);
      const open = ease(Math.min(1, st.t / 450));
      const close = Math.max(0, (st.t - (VISION_MS - 380)) / 380);
      diveFx.vision(buf, W, H, st.index, st.k, t, maxR * open * (1 - close * close));
      if (close < 0.5) visionCaption(buf, DIVE_VISIONS[st.index], Math.floor((st.t - 300) / 38), H);
    } else if (st.stage === 'peak') {
      diveFx.tunnel(buf, W, H, t, { spin: 1.6 });
      if (st.k > 0.08) {
        shadeRows(buf, Math.round(H / 2 - 22), Math.round(H / 2 + 22), H, 0.4);
        headline(buf, DIVE_WORDS.peak, Math.round(H / 2 - 14), GOLD, 4, rgb(30, 16, 4));
      }
    } else if (st.stage === 'exit') {
      diveFx.tunnel(buf, W, H, t, { dir: -1, sat: 1 - st.k * 0.85 });
      shadeRows(buf, Math.round(H / 2 - 13), Math.round(H / 2 + 13), H, 0.4);
      headline(buf, DIVE_WORDS.exit, Math.round(H / 2 - 7), WHITE, 2);
      dive.meltSrc = diveFx.snapshot(buf, W, H, 'b');
    } else if (st.stage === 'melt') {
      if (!dive.meltSrc) {
        const src = diveFx.snapshot(buf, W, H, 'b');
        diveFx.tunnel(src, W, H, t, { dir: -1, sat: 0.15 });
        dive.meltSrc = src;
      }
      if (!dive.meltStarted) { diveFx.meltReset(W); dive.meltStarted = true; }
      diveFx.desaturate(buf, W, H, 0.35 * st.k);
      diveFx.melt(buf, dive.meltSrc, W, H, Math.floor(st.t / 20));
    }
  }
  // prefers-reduced-motion: no spiral, no twist, no melt -- calm fades.
  function drawDiveCalm(buf, st, H, now) {
    const dark = [10, 14, 24];
    if (st.stage === 'enter') { diveFx.blend(buf, W, H, dark, st.k); return; }
    if (st.stage === 'melt') { buf.fill(rgb(...dark), 0, W * H); return; }
    buf.fill(rgb(...dark), 0, W * H);
    if (st.stage === 'vision') {
      diveFx.vision(buf, W, H, st.index, 0, 0, diveFx.radius(W, H) + 10, { ripple: 0 });
      const v = DIVE_VISIONS[st.index];
      visionCaption(buf, v, v.caption.length, H);
    } else if (st.stage === 'peak') headline(buf, DIVE_WORDS.peak, Math.round(H / 2 - 14), GOLD, 4, rgb(30, 16, 4));
    else if (st.stage === 'exit') headline(buf, DIVE_WORDS.exit, Math.round(H / 2 - 7), WHITE, 2);
  }

  // --------------------------------------------------------------- input

  function keyDown(event) {
    if (!active) return;
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyR', 'KeyV', 'PageUp', 'PageDown'].includes(event.code)) { held.add(event.code); event.preventDefault(); }
    if (event.repeat) return;
    // 19.4 (§21): F punches (the phone's УДАР sends F too).
    if (event.code === 'KeyF') { event.preventDefault(); if (!(dive && !dive.after) && !talk) punch(); return; }
    if (dive && !dive.after) {
      if (['Space', 'KeyE', 'Enter', 'Escape'].includes(event.code)) { event.preventDefault(); skipDive(); }
      return;
    }
    if (talk) {
      if (talk.stage === 'greet' && event.code === 'Digit1') { event.preventDefault(); ask('carry'); return; }
      if (talk.stage === 'greet' && event.code === 'Digit2') { event.preventDefault(); ask('fix'); return; }
      if (['Space', 'KeyE', 'Enter', 'Escape'].includes(event.code)) { event.preventDefault(); closeTalk(); return; }
      return;
    }
    if (state.phase === 'confront' && event.code === 'Digit1') { event.preventDefault(); bossTalk?.click(); return; }
    if (state.phase === 'confront' && event.code === 'Digit2') { event.preventDefault(); bossFightBtn?.click(); return; }
    if (!dialogue.hidden) {
      // 19.4: a key pressed BEFORE this dialogue opened (a Space meant to
      // skip the dive, delivered late by a busy frame) must not confirm it.
      // event.timeStamp is when the key was pressed, not when we got it.
      const pressedBefore = event.timeStamp > 0 && event.timeStamp < dialogueOpenedAt + 120;
      if (['Space', 'KeyE', 'Enter'].includes(event.code) && !bossNext.hidden && (choices?.hidden ?? true) && performance.now() - dialogueOpenedAt > 450 && !pressedBefore) {
        event.preventDefault(); bossNext.click();
      }
      return;
    }
    // 17.0: E acts, Space jumps (in the fight Space still shoves -- see above).
    if (event.code === 'Space' && dialogue.hidden) {
      event.preventDefault();
      if (state.phase === 'fight') { action(); return; }
      if (jump(body)) {
        onSound('jump');
        const said = moments.jumped(performance.now() / 1000);
        comment(state.carrying ? 'carry-jump' : said);
      }
      return;
    }
    if ((event.code === 'KeyE' || event.code === 'Enter') && dialogue.hidden) { event.preventDefault(); action(); }
  }
  function keyUp(event) {
    held.delete(event.code);
    // 19.5 (§22): let go of E before the lock came off -- it clicks back.
    if (event.code === 'KeyE' && prying && active) letGo(performance.now());
  }
  // 19.5 (§22): the pry track -- press the thumb and slide it right.
  pryThumb?.addEventListener('pointerdown', (e) => {
    if (!active || state.phase !== 'lock') return;
    e.preventDefault();
    const track = pryThumb.parentElement.getBoundingClientRect();
    pryDrag = { id: e.pointerId, startX: e.clientX, base: state.pry ?? 0, width: Math.max(40, track.width - pryThumb.getBoundingClientRect().width) };
    try { pryThumb.setPointerCapture?.(e.pointerId); } catch { /* synthetic */ }
    onSound('pry'); renderText();
  });
  window.addEventListener('pointermove', (e) => {
    if (!pryDrag || !active) return;
    if (state.phase !== 'lock') { pryDrag = null; return; }
    const want = Math.min(1, pryDrag.base + pryFromSlide(pryDrag.startX, e.clientX, pryDrag.width));
    if (want > state.pry) pryBy(want - state.pry, performance.now());
  });
  const pryUp = () => { if (!pryDrag) return; pryDrag = null; if (active && state.phase === 'lock') letGo(performance.now()); };
  window.addEventListener('pointerup', pryUp); window.addEventListener('pointercancel', pryUp);
  function mouseMove(event) {
    if (!active || document.pointerLockElement !== canvas) return;
    state.player.yaw = wrapAngle(state.player.yaw + event.movementX * 0.0024);
    pitch = clampPitch(pitch - event.movementY * 0.0024);
    if (Math.abs(event.movementY) > 1) manualLookAt = performance.now();
  }
  canvas?.addEventListener('click', () => {
    if (active && dive && !dive.after) { skipDive(); return; }
    // 19.4 (§21): with the mouse captured, a click is a punch.
    if (active && dialogue.hidden && document.pointerLockElement === canvas) { punch(); return; }
    if (active && dialogue.hidden) canvas.requestPointerLock?.();
  });
  window.addEventListener('keydown', keyDown, { passive: false }); window.addEventListener('keyup', keyUp); window.addEventListener('mousemove', mouseMove);
  onReleaseKeys(() => held.clear());
  // 18.0: touch look (touch-controls.js).
  window.addEventListener('qq:look', (ev) => { if (!active || (dive && !dive.after) || !dialogue.hidden) return; state.player.yaw = wrapAngle(state.player.yaw + ev.detail.dx); pitch = clampPitch(pitch - ev.detail.dy); if (Math.abs(ev.detail.dy) > 0.01) manualLookAt = performance.now(); });
  bossNext.addEventListener('click', () => {
    if (dive?.after) { onSound('ui-click'); finishDive(); return; }
    if (talk) { closeTalk(); return; }
    if (state.phase === 'briefing') { state = stepFirstShift(state, 'briefing-done'); onSound('ui-click'); }
    else if (state.phase === 'payday') { state = stepFirstShift(state, 'payday-done'); onSound('ui-click'); }
    else if (state.phase === 'fight-result') { state = stepFirstShift(state, 'fight-done'); onSound('ui-click'); }
    setDialogue(); renderText(); canvas?.focus({ preventScroll: true }); if (dialogue.hidden) canvas?.requestPointerLock?.();
  });
  bossTalk?.addEventListener('click', () => {
    if (talk) { ask('carry'); return; }
    if (state.phase !== 'confront') return; state = stepFirstShift(state, 'talk'); onSound('ui-click'); setDialogue(); renderText(); canvas?.focus({ preventScroll: true });
  });
  bossFightBtn?.addEventListener('click', () => {
    if (talk) { ask('fix'); return; }
    if (state.phase !== 'confront') return;
    state = stepFirstShift(state, 'fight-start'); startFight(performance.now());
    setDialogue(); renderText(); canvas?.focus({ preventScroll: true }); canvas?.requestPointerLock?.();
  });
  window.addEventListener('resize', resize);

  function open() {
    state = createFirstShiftState(); active = true; root.hidden = false;
    idleSeconds = 0; idleStage = 0; nudgeUntil = 0; flashUntil = 0; daydreamUntil = 0; talk = null; message = ''; messageUntil = 0;
    boss = { x: SPOTS.boss.x, z: SPOTS.boss.z, mode: 'stand', t: 0, leg: 0, facing: Math.PI }; bossPath = SPOTS.bossExitFromTable; door = 0; doorWanted = 0; resetFacing();
    lockAt = -1e9; lockFall = null; prying = false; pryDrag = null; shockAt = -1e9; slowSaid = false;
    hands = createHands(performance.now()); koAt = -1e9; wakeAt = -1e9; bossKnockAt = -1e9; crateWobbleAt = -1e9; swatAt = -1e9; swatDir = null;
    beltCrates.length = 0; particles.length = 0; turnTo = null; dive = null; lastBeat = -1; slamAt = -1e9; slipScenes.clear(); clearTimeout(slipTimer); manualSince = 0;
    body = createBody(state.player.x, state.player.z); pitch = 0; dipAt = -1e9; speech = null; chatter.reset();
    diveFx.load();
    resize(); setDialogue(); renderText(); last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(update); bossNext.focus({ preventScroll: true });
  }
  function close() { if (touchUse) touchUse.textContent = 'ВЗЯТЬ'; active = false; dive = null; root.hidden = true; cancelAnimationFrame(raf); held.clear(); if (document.pointerLockElement === canvas) document.exitPointerLock?.(); }
  // Test/debug hook: lets the screenshot script stand the player somewhere.
  function debug(patch = {}) {
    if (patch.player?.yaw !== undefined) turnTo = null;
    if (patch.player) { Object.assign(state.player, patch.player); body.x = state.player.x; body.z = state.player.z; if (patch.player.y !== undefined) { body.y = patch.player.y; body.grounded = false; } }
    if (patch.pitch !== undefined) pitch = clampPitch(patch.pitch);
    if (patch.comment) comment(patch.comment, true);
    if (patch.speech) speech = { ...patch.speech, until: performance.now() + 4000 };
    if (patch.state) state = { ...state, ...patch.state };
    if (patch.boss) Object.assign(boss, patch.boss);
    // 19.5 (§22): pry (0..1 added to the pry), press (print("wake")), slam (the boss's slam right now).
    if (patch.slam && state.phase === 'slam') slamTable(performance.now());
    if (patch.pry !== undefined && state.phase === 'lock') pryBy(Number(patch.pry) || 0, performance.now());
    if (patch.press && state.phase === 'button') { pressWake(performance.now()); return; }
    if (patch.door !== undefined) { door = patch.door; doorWanted = patch.door; }
    if (patch.talk !== undefined) { talk = patch.talk; }
    if (patch.punch) { punchAt = performance.now(); hands = swing(hands, punchAt); }
    // 19.4: punch / fistPunch -- throw a real punch at whatever is in front.
    if (patch.fist) punch();
    if (patch.holdBeat !== undefined) { holdBeat = patch.holdBeat; lastBeat = -1; }
    if (patch.fightClock) { fightClockStart = performance.now() - (Number(patch.fightClock) || 0); lastBeat = -1; }
    // dive: milliseconds into the dive (null ends it), for screenshots.
    if (patch.dive !== undefined) dive = patch.dive === null ? null : { start: performance.now() - patch.dive, step: -1, after: false, meltSrc: null };
    setDialogue(); renderText();
  }
  return { open, close, state: () => JSON.parse(JSON.stringify(state)), debug, body: () => ({ ...body, pitch }), speech: () => speech, boss: () => ({ mode: boss.mode, x: boss.x, z: boss.z }), lock: () => ({ ...lockSpot(), prying, drag: Boolean(pryDrag), fell: Boolean(lockFall) }) };
}
