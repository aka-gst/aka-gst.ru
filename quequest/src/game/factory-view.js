// The warehouse chapters (chip → arm wakes → red crate → if / while / def)
// drawn the way Shift 1 is drawn: the same Doom-style hall, textures, people
// and light, instead of the 16.2 vector projection (flat "ГРУЗ" squares on a
// perspective grid and an arm made of grey bars with red circles). Сергей
// 02.10: «а чо там постоянно куски старой игры??? так быть не должно».
//
// The chapters' rules stay in model.js (pixel coordinates on a 1600 x 900
// floor). This view maps that floor into the hall: the arm's terminal lands
// in front of Arm 07, the incoming crates are the pile the player carried
// from, delivered crates ride the belt out. The player walks, looks up and
// down, jumps onto crates and benches with the same body as in Shift 1
// (fp-body.js), and the people in the hall comment (npc-chatter.js).
import { createRenderer, bakeLightmap, rgb, cellAt } from './raycaster.js';
import {
  buildFactoryMap, SPOTS, WORKER_SPOTS, LAMPS, EYE, CRATE_H, BELT_H, HALL_CEIL, viewIndex, nearBossDoor,
} from './first-shift-map.js';
import { loadAtlas } from './first-shift-atlas.js';
import { drawText, textWidth } from './pixel-font.js';
import { dressHall, drawSpeech, surfaceOf, subtitleFloorRow } from './fp-overlay.js';
import { buildArmSprites, armPoseAt, tint, paintTerminal, paintButton } from './arm-art.js';
import { createBody, moveBody, stepBody, openAt, jump as bodyJump, landingDip, clampPitch, pitchShear } from './fp-body.js';
import { createChatter, createMomentWatcher, SPEAKERS } from './npc-chatter.js';
// 17.4: the hall is drawn at the player's rung of the engine ladder too.
import { createEngineCore, frameDims } from './engine-core.js';
import { featureFlags, featureMoment, clampLevel, FEATURES, ERA_NAMES, eraOfLevel } from './engine-ladder.js';
import { makeTexture, TEXTURE_DEFS } from './fp-textures.js';

// model px -> hall metres. One uniform scale, so angles (and model.js's
// "looking at the target" test) are the same in both spaces.
export const HALL_SCALE = 0.0063;
export const HALL_ORIGIN = Object.freeze({ x: 7.5 - 1010 * HALL_SCALE, z: 6.6 - 525 * HALL_SCALE });
export function toHall(p) { return { x: HALL_ORIGIN.x + p.x * HALL_SCALE, z: HALL_ORIGIN.z + p.y * HALL_SCALE }; }
export function toWorld(m) { return { x: (m.x - HALL_ORIGIN.x) / HALL_SCALE, y: (m.z - HALL_ORIGIN.z) / HALL_SCALE }; }

// The arm's terminal stands just right of Arm 07, facing the hall.
export const HALL_TERMINAL = Object.freeze({ x: SPOTS.arm.x + 0.78, z: SPOTS.arm.z + 0.62 });
// model.js puts the chip socket and the terminal on the floor south of the
// machine; in the hall they are on Arm 07 and its console. "Looking at the
// target" in first person means looking at those.
export function hallAimPoints(target) {
  if (['insert-python-chip', 'open-machine'].includes(target?.type)) return [toWorld(SPOTS.arm), toWorld(HALL_TERMINAL)];
  return target ? [target] : [];
}

// Pile cells, nearest the arm first: the arm takes from the front.
export const PILE_ORDER = Object.freeze([[5, 5], [5, 4], [4, 5], [4, 4], [3, 5], [3, 4]]);
// Crates that are not part of the incoming pile: the three carried by hand in
// Shift 1, and the red ones that turn up on the floor in front of the arm.
const OFF_PILE = new Set(['box-01', 'box-02', 'box-03', 'red-01', 's2-red-01']);

// Which pile cell holds which crate, and how tall each cell stands. Slots are
// stable (by position in the layout), so a crate never hops between cells.
export function pileLayout(crates = []) {
  const slotted = crates.filter((c) => !OFF_PILE.has(c.id));
  const cells = new Map(PILE_ORDER.map(([cx, cz]) => [`${cx},${cz}`, { cx, cz, count: 0, red: false }]));
  const slotOf = new Map();
  slotted.forEach((c, i) => {
    const [cx, cz] = PILE_ORDER[i % PILE_ORDER.length];
    slotOf.set(c.id, { cx, cz });
    if (c.status !== 'queued') return;
    const cell = cells.get(`${cx},${cz}`);
    cell.count += 1;
    if (c.kind === 'red') cell.red = true;
  });
  return { cells: [...cells.values()], slotOf };
}

const WHITE = rgb(236, 236, 228);
const GOLD = rgb(255, 200, 70);
const CYAN = rgb(110, 240, 255);
const RED = rgb(232, 60, 44);
const REACH_SPEED = 3.2;

// 18.2: slip(event) -> a §16 gamer line ({ me, who, reply }) to say instead
// of the usual chatter for this event, or null (the host keeps one per scene).
export function createFactoryView({ onSound = () => {}, onFlag = () => {}, reducedMotion = false, getEngineLevel = () => 4, storage = globalThis.localStorage, slip = () => null } = {}) {
  const core = createEngineCore({ reducedMotion });
  let forcedLevel = null; let level = null; let moment = null;
  const map = buildFactoryMap();
  for (const cell of map.cells) if (cell.door) cell.ceil = 0;
  // An oil spill under Arm 07 (engine-ladder.js "liquids").
  for (const [x, z] of [[6, 6], [7, 6]]) { const c = map.cells[z * map.w + x]; c.ftex = 'OILPOOL'; c.liquid = true; }
  const lightmap = bakeLightmap(map, LAMPS, { ambient: [0.26, 0.27, 0.31] });
  let atlas = null;
  let arms = null;
  const extra = {};
  loadAtlas().then((a) => {
    atlas = a;
    dressHall(map, a);
    arms = buildArmSprites();
    map.textures.CRATE_R = tint(a.CRATE_B, [1.35, 0.42, 0.38]);
    map.textures.OILPOOL = makeTexture(TEXTURE_DEFS.OILPOOL);
    map.textures.CRATOP_R = tint(a.CRATOP2, [1.35, 0.42, 0.38]);
    extra.crateRed = tint(a.crate3q, [1.4, 0.45, 0.4]);
    extra.termDead = paintTerminal(false); extra.termLive = paintTerminal(true); extra.termSlot = paintTerminal(false, true);
    extra.button = paintButton(false); extra.buttonTried = paintButton(true);
  }).catch(() => { atlas = null; });

  const frame = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  const fctx = frame?.getContext('2d');
  let W = 427; let VIEW_ROWS = 240; let renderer = createRenderer(W, VIEW_ROWS); let imageData = null;
  function size(viewport) {
    const aspect = viewport.width > 0 && viewport.height > 0 ? viewport.width / viewport.height : 16 / 9;
    const { w, h } = frameDims(featureFlags(level ?? 0), aspect, 1, 400);
    if (w !== W || h !== VIEW_ROWS || !imageData) {
      W = w; VIEW_ROWS = h; renderer = createRenderer(W, VIEW_ROWS);
      if (frame) { frame.width = W; frame.height = VIEW_ROWS; }
      imageData = typeof ImageData !== 'undefined' ? new ImageData(new Uint8ClampedArray(renderer.buf.buffer), W, VIEW_ROWS) : null;
    }
  }
  function currentLevel() { return forcedLevel ?? clampLevel(getEngineLevel()); }
  function seen() { try { const v = storage?.getItem('quequest.engine.seenLevel'); return v === null || v === undefined ? null : Number(v); } catch { return null; } }
  function markSeen(n) { try { storage?.setItem('quequest.engine.seenLevel', String(n)); } catch { /* private mode */ } }
  // The engine grows while you work in the hall (a shift held, the arm
  // fixed): the moment plays right here.
  function checkLevel(now) {
    const next = currentLevel();
    if (level === null) { level = next; if (forcedLevel === null && (seen() === null || next > seen())) markSeen(next); return; }
    if (next === level) return;
    if (next > level && forcedLevel === null) {
      const m = featureMoment(level, next);
      if (m) { moment = { ...m, at: now }; onSound('upgrade'); }
      markSeen(next);
    }
    level = next;
  }

  const TERMINAL = HALL_TERMINAL;
  let body = createBody(SPOTS.arm.x, 7.5);
  let lastPx = null; // where we last put state.player, to notice teleports
  let pitch = 0; let dipAt = -1e9; let dipImpact = 0; let walkPhase = 0; let stepAcc = 0;
  const chatter = createChatter();
  const moments = createMomentWatcher();
  let speech = null;
  // 17.3: where the DOM action prompt is ({ canvas, prompt } rects), so the
  // NPC subtitle stays above it. main.js sets it every frame.
  let promptBox = null;
  let gagReadyAt = 0; let pushUntil = 0;
  let lastWage = null; let lastScene = null; let lastFailure = null; let lastChip = null; let lastDelivered = null;

  const present = () => new Set(['welder', 'fitter', 'electrician', 'lunch', 'radio']);
  // 18.2 (§16): the hero says one gamer thing, somebody answers, puzzled.
  let pairTimer = 0;
  function pair(g, now) {
    speech = { who: 'me', name: 'ТЫ', text: g.me, until: now + 2600 };
    onSound('chatter');
    clearTimeout(pairTimer);
    pairTimer = setTimeout(() => {
      const t = performance.now();
      speech = { who: g.who, name: SPEAKERS[g.who] ?? g.who, text: g.reply, until: t + 2800 };
      onSound('chatter');
    }, 2700);
    return { who: 'me', text: g.me, event: 'slip' };
  }
  // The person (or the boss's radio on his desk) right in front of you, for
  // E · ПОГОВОРИТЬ. yaw is the view from main.js.
  const DESK = { x: 7.55, z: 10.5 };
  function personInFront(yaw) {
    const sin = Math.sin(yaw), cos = Math.cos(yaw);
    let best = null;
    for (const [id, at] of [['lunch', WORKER_SPOTS.lunch], ['desk', DESK]]) {
      const dx = at.x - body.x, dz = at.z - body.z; const dist = Math.hypot(dx, dz);
      const fwd = dx * sin - dz * cos; const side = dx * cos + dz * sin;
      if (fwd <= 0.1 || dist > 2.3 || Math.abs(Math.atan2(side, fwd)) > 0.42) continue;
      if (!best || dist < best.dist) best = { id, dist };
    }
    return best?.id ?? null;
  }
  function comment(event, now, force = false) {
    const g = slip(event);
    if (g) return pair(g, now);
    const line = chatter.say(event, now / 1000, { present: present(), force });
    if (!line) return null;
    speech = { ...line, until: now + 2400 + line.text.length * 50 };
    onSound('chatter');
    return line;
  }
  function speakerAt(who) {
    const w = WORKER_SPOTS[who];
    return w ? { x: w.x, z: w.z, y: who === 'lunch' ? 1.35 : 1.8 } : null;
  }

  function syncPile(state) {
    const { cells } = pileLayout(state.warehouse?.crates);
    for (const c of cells) {
      const cell = map.cells[c.cz * map.w + c.cx];
      cell.floor = CRATE_H * c.count;
      cell.wall = c.red ? 'CRATE_R' : 'CRATE_B';
      cell.ftex = c.red ? 'CRATOP_R' : 'CRATOP2';
    }
  }

  function circles() {
    const out = [{ x: SPOTS.arm.x, z: SPOTS.arm.z, r: 0.55, top: 2.3 }, { x: TERMINAL.x, z: TERMINAL.z, r: 0.22, top: 1.3 }];
    for (const w of Object.values(WORKER_SPOTS)) out.push({ x: w.x, z: w.z, r: w === WORKER_SPOTS.lunch ? 0.62 : 0.6, top: 1.85 });
    return out;
  }

  // Put the body where the model says the player is (checkpoint load, scene
  // change, or the first frame).
  function place(state) {
    const m = toHall(state.player);
    body = createBody(m.x, m.z);
    // Never spawn inside a crate or a person: nudge south until free.
    for (let i = 0; i < 20 && !free(body.x, body.z); i++) body.z += 0.2;
    lastPx = toWorld(body);
  }
  // model.js clamps the player to its 1600 x 900 floor every step; the hall is
  // bigger. Only a real jump (checkpoint, scene setup) re-places the body.
  function teleported(p, last) {
    if (!last) return true;
    const near = (q) => Math.hypot(p.x - q.x, p.y - q.y) <= 3;
    return !near(last) && !near({ x: Math.max(40, Math.min(1560, last.x)), y: Math.max(40, Math.min(860, last.y)) });
  }
  function free(x, z) { return openAt(map, x, z, 0, { circles: circles() }); }

  // One frame of walking/jumping. forward/strafe in -1..1, yaw from main.js.
  // Returns the player's new model position.
  function step(state, dt, { forward = 0, strafe = 0, yaw = 0, paused = false } = {}, now = performance.now()) {
    syncPile(state);
    if (teleported(state.player, lastPx)) place(state);
    let moving = false;
    if (!paused && (forward || strafe)) {
      const len = Math.hypot(forward, strafe) || 1;
      const sin = Math.sin(yaw), cos = Math.cos(yaw);
      const speed = (state.player.carrying ? 2.1 : REACH_SPEED) * dt;
      const moved = moveBody(map, body, ((sin * forward) + (cos * strafe)) / len * speed, ((-cos * forward) + (sin * strafe)) / len * speed, { circles: circles() });
      if (moved > 0.0005) {
        moving = true;
        if (body.grounded) { walkPhase += moved * 3.2; stepAcc += moved; if (stepAcc > 0.78) { stepAcc = 0; onSound('step'); } }
      }
    }
    if (!moving || !body.grounded) walkPhase *= 0.9;
    const fall = stepBody(map, body, dt, { circles: circles() });
    if (fall.landed) {
      if (fall.impact > 3) { dipAt = now; dipImpact = fall.impact; onSound('land'); }
      const surface = body.y > 0.3 ? surfaceOf(cellAt(map, body.x, body.z)) : 'floor';
      const said = moments.landed({ impact: fall.impact, fall: fall.fall, surface });
      if (said) comment(said, now);
    }
    if (fall.bonk) { onSound('hit'); comment('bonk', now); }
    // 18.0: same gag as Shift 1 — the boss's gate pushes you out.
    if (!paused && nearBossDoor(body.x, body.z) && now > gagReadyAt) {
      gagReadyAt = now + 3500; pushUntil = now + 520;
      onSound('door'); onSound('hit');
      speech = { who: 'radio', name: 'ГОЛОС ИЗ-ЗА ДВЕРИ', text: 'Куда?! Только для мееенеджеров!', until: now + 3200 };
      onFlag('doorGag');
    }
    if (now < pushUntil) moveBody(map, body, 0, -dt * 5.2, { circles: circles() });
    if (!paused) for (const ev of moments.frame(dt, { pitch, moving })) comment(ev, now);
    watchStory(state, now);
    if (speech && now > speech.until) speech = null;
    lastPx = toWorld(body);
    return { ...lastPx };
  }

  // Comments on what the chapter itself does: money, the arm waking, a stop.
  function watchStory(state, now) {
    const wage = state.warehouse?.wage ?? 0;
    if (lastWage !== null && wage > lastWage && Math.floor(wage / 100) > Math.floor(lastWage / 100)) comment('money', now);
    lastWage = wage;
    const delivered = state.warehouse?.autoDelivered ?? 0;
    if (lastDelivered !== null && delivered > lastDelivered && !(state.warehouse?.autoTarget && delivered >= state.warehouse.autoTarget)) comment('deliver', now);
    if (lastDelivered !== null && state.warehouse?.autoTarget && delivered >= state.warehouse.autoTarget && lastDelivered < state.warehouse.autoTarget) comment('task-done', now, true);
    lastDelivered = delivered;
    const chip = state.arm?.chip;
    if (lastChip && lastChip !== 'installed' && chip === 'installed') comment('arm-awake', now, true);
    lastChip = chip;
    const failure = state.arm?.failure?.phase ?? null;
    if (failure === 'freeze' && lastFailure !== 'freeze') comment('task-fail', now, true);
    lastFailure = failure;
    if (lastScene !== null && state.scene !== lastScene && ['reward'].includes(state.scene)) comment('task-done', now, true);
    lastScene = state.scene;
  }

  function doJump(state, now = performance.now()) {
    if (!bodyJump(body)) return false;
    onSound('jump');
    comment(state.player.carrying ? 'carry-jump' : moments.jumped(now / 1000), now);
    return true;
  }
  function look(dx, dy) { pitch = clampPitch(pitch - dy); return pitch; }
  function tilt(dir, dt) { pitch = clampPitch(pitch + dir * dt * 1.8); }

  // ------------------------------------------------------------------ draw

  function sprite(img, x, z, y = 0, extraProps = {}) {
    return img ? { img, x, z, y, ppm: img.ppm || 40, ...extraProps } : null;
  }

  function armSprite(state, now) {
    const blink = Math.floor(now / 600) % 2;
    const failure = state.arm?.failure?.phase;
    if (!state.arm?.awake && state.arm?.chip !== 'installed') return atlas[`arm07_${blink}`];
    if (failure === 'freeze') return atlas[`arm07_${blink}`];
    let pose = 'idle';
    if (failure === 'reach' || failure === 'scan') pose = 'reach';
    else if (failure === 'reject-one' || failure === 'reject-two') pose = 'drop';
    else if (state.arm?.active) pose = armPoseAt(state.arm.active.progress ?? 0);
    return arms[`arm07_${pose}_${failure ? blink : 0}`];
  }

  // 18.0: in portrait the picture is letterboxed at 4:3 instead of being
  // squeezed into a tall strip (Сергей: «в вертикали вытянуто»).
  function letterbox(viewport) {
    const portrait = viewport.width / Math.max(1, viewport.height) < 1.1;
    if (!portrait) return { x: 0, y: 0, w: viewport.width, h: viewport.height, portrait };
    const h = Math.round(viewport.width * 0.75);
    return { x: 0, y: Math.round(Math.max(0, viewport.height - h) * 0.42), w: viewport.width, h, portrait };
  }
  function draw(ctx, viewport, state, now, { yaw = 0 } = {}) {
    if (!atlas || !arms || !fctx) return false;
    checkLevel(now);
    const box = letterbox(viewport);
    size({ width: box.w, height: box.h });
    syncPile(state);
    const buf = renderer.buf;
    const viewH = VIEW_ROWS;
    const bob = reducedMotion || !body.grounded ? 0 : Math.sin(walkPhase * 2) * 1.6;
    const dip = reducedMotion ? 0 : landingDip(dipImpact, (now - dipAt) / 320);
    const cam = { x: body.x, z: body.z, yaw, eye: body.y + EYE - dip * 0.22, bob: bob + dip * 6, pitch: pitchShear(pitch, viewH) };
    const sprites = [];
    const push = (s) => { if (s) sprites.push(s); };
    for (const L of LAMPS.slice(0, 5)) push(sprite(atlas.lamp, L.x, L.z, HALL_CEIL - 1.2, { prop: 'lamp' }));
    push(sprite(armSprite(state, now), SPOTS.arm.x, SPOTS.arm.z, 0.25));
    const chipHeld = state.arm?.chip === 'held';
    push(sprite(state.arm?.awake ? extra.termLive : (chipHeld ? extra.termSlot : extra.termDead), TERMINAL.x, TERMINAL.z));
    for (const [x, z] of [[14.6, 12.6], [15.3, 12.1], [1.6, 6.4], [15.4, 6.6]]) push(sprite(atlas.bar1a0, x, z, 0, { ppm: 30, prop: 'barrel' }));
    // The people of the hall, at work (they turn to you while they talk).
    const talking = (id) => speech?.who === id && now < speech.until;
    const person = (name, w, face) => sprite(atlas[`${name}_r${viewIndex(face, cam.x, cam.z, w.x, w.z)}`], w.x, w.z);
    const toCam = (w) => Math.atan2(cam.x - w.x, -(cam.z - w.z));
    const tf = Math.floor(now / 260) % 2;
    const wel = WORKER_SPOTS.welder, fit = WORKER_SPOTS.fitter, ele = WORKER_SPOTS.electrician, lun = WORKER_SPOTS.lunch;
    push(person(talking('welder') ? `welder_talk${tf}` : `welder_work${Math.floor(now / 80) % 2}`, wel, talking('welder') ? toCam(wel) : wel.facing));
    push(person(talking('fitter') ? `fitter_talk${tf}` : `fitter_work${[0, 0, 1, 2, 2, 1, 0][Math.floor(now / 110) % 7]}`, fit, talking('fitter') ? toCam(fit) : fit.facing));
    push(person(talking('electrician') ? `electrician_talk${tf}` : `electrician_work${Math.floor(now / 420) % 2}`, ele, talking('electrician') ? toCam(ele) : ele.facing));
    push(person(talking('lunch') ? 'lunch_wave' : `lunch_eat${[0, 1, 1, 1][Math.floor(now / 520) % 4]}`, lun, talking('lunch') ? toCam(lun) : lun.facing));

    const crates = state.warehouse?.crates ?? [];
    const { slotOf } = pileLayout(crates);
    for (const c of crates) {
      const img = c.kind === 'red' ? extra.crateRed : atlas.crate3q;
      const crateProp = { prop: 'crate', crateTex: c.kind === 'red' ? 'CRATE_R' : 'CRATE_B' };
      if (['blocked', 'scan', 'floor', 'source'].includes(c.status)) {
        const m = toHall(c);
        push(sprite(img, m.x, m.z, 0, crateProp));
      } else if (c.status === 'pallet' && Number.isFinite(c.deliveredAt)) {
        const age = (state.elapsed ?? 0) - c.deliveredAt;
        const x = SPOTS.beltDrop.x + age * 0.55;
        if (age >= 0 && x < 18.9) push(sprite(img, x, SPOTS.beltDrop.z, BELT_H, crateProp));
      } else if (c.status === 'arm' || c.id === state.arm?.active?.boxId) {
        const from = slotOf.get(c.id) ?? { cx: 5, cz: 5 };
        const t = Math.max(0, Math.min(1, state.arm?.active?.progress ?? 0));
        const a = { x: from.cx + 0.5, z: from.cz + 0.5, y: 0 };
        const b = { x: SPOTS.beltDrop.x, z: SPOTS.beltDrop.z, y: BELT_H };
        const k = t < 0.3 ? 0 : t > 0.85 ? 1 : (t - 0.3) / 0.55;
        const e = k * k * (3 - 2 * k);
        const lift = Math.sin(Math.PI * e) * 1.3 + (t >= 0.3 && t < 0.85 ? 0.15 : 0);
        push(sprite(img, a.x + (b.x - a.x) * e, a.z + (b.z - a.z) * e, a.y + (b.y - a.y) * e + lift, crateProp));
      }
    }
    if (state.arm?.chip === 'fallen') {
      const m = toHall({ x: 850, y: 535 });
      push(sprite(atlas.chip, m.x, m.z, 0.02, { ppm: 48, fullbright: true, glow: 1.2 }));
    }
    if (['shift2', 'red2'].includes(state.checkpoint) || (state.scene === 'machine' && (state.learning?.chapter ?? 1) >= 2)) {
      const m = toHall({ x: 1155, y: 550 });
      push(sprite(state.warehouse?.looseButtonTried ? extra.buttonTried : extra.button, m.x, m.z, 0));
    }

    const dynLights = [];
    const awake = Boolean(state.arm?.awake);
    const blinkOn = Math.floor(now / 600) % 2 === 0;
    dynLights.push({ x: SPOTS.arm.x + 0.3, z: SPOTS.arm.z + 0.3, radius: 1.6, r2: 2.56, intensity: awake ? 0.45 : (blinkOn ? 0.35 : 0), color: awake && !state.arm?.failure ? [0.3, 1, 1.1] : [1, 0.2, 0.15] });
    if (chipHeld) dynLights.push({ x: TERMINAL.x, z: TERMINAL.z, radius: 1.2, r2: 1.44, intensity: 0.4 + Math.sin(now / 180) * 0.2, color: [0.3, 1, 1.1] });
    cam.pitchAngle = pitch;
    const renderAt = (L) => core.render({ w: W, h: VIEW_ROWS, viewH, buf, ray: renderer }, {
      levelId: 'hall', map, cam, fov: 80, lamps: LAMPS, lightKey: 'hall', ambient: [0.26, 0.27, 0.31], time: now / 1000,
      dynLights, sprites, particles: [], shadowLamp: LAMPS[0], doorTex: 'BIGDOOR2',
    }, L);
    let view;
    const wipeK = moment ? (now - moment.at) / 1600 : 2;
    if (moment && wipeK < 1) {
      // Old picture below the line, the new one from the top.
      const cut = Math.round(Math.max(0, Math.min(1, (wipeK - 0.1) / 0.8)) * viewH);
      renderAt(moment.from);
      const old = buf.slice(cut * W, viewH * W);
      view = renderAt(moment.to);
      buf.set(old, cut * W);
      for (let x = 0; x < W; x++) if (cut > 0 && cut < viewH) buf[cut * W + x] = WHITE;
    } else view = renderAt(level);
    void lightmap;

    const k = viewH / 240;
    if (chipHeld) chipInHand(buf, viewH, now);
    if (state.player?.carrying && atlas.carry) renderer.blit(atlas.carry, Math.round(W / 2 - atlas.carry.w * k / 2), Math.round(viewH - 70 * k + bob * 1.5 * k), { clipBottom: viewH, scale: k });
    if (moment && now - moment.at < 6000) {
      const f = moment.feature;
      banner(buf, viewH, moment.era ? `ДВИЖОК +${moment.gained.length} · ЭПОХА ${moment.era.name}` : `ДВИЖОК +${moment.gained.length} · ${ERA_NAMES[eraOfLevel(moment.to)]} ${moment.to + 1}/${FEATURES.length}`, f.name, GOLD);
    } else if (moment) moment = null;
    if (state.arm?.awake && state.arm.wakeRevealRemaining > 0) {
      const fromChip = state.arm.startSource === 'chip';
      banner(buf, viewH, fromChip ? 'СЕРВИСНЫЙ ЧИП ПРИНЯТ' : 'КОМАНДА ПРИНЯТА', 'РУКА 07 · РАБОТАЕТ', fromChip ? GOLD : CYAN);
    }
    if (state.scene === 'red-crate' || state.arm?.failure?.phase === 'freeze') {
      if (Math.floor(now / 500) % 2 === 0) drawText(buf, W, viewH, Math.round(W / 2 - textWidth('ЛИНИЯ СТОИТ') / 2), 6, 'ЛИНИЯ СТОИТ', RED);
    }
    if (speech) {
      const floor = promptBox ? subtitleFloorRow(viewH, VIEW_ROWS, promptBox.canvas, promptBox.prompt) : null;
      drawSpeech(buf, W, viewH, speech, speakerAt(speech.who), { ...view, cam }, { floor });
    }

    fctx.putImageData(imageData, 0, 0);
    ctx.save();
    ctx.imageSmoothingEnabled = Boolean(featureFlags(level ?? 0).bilinear);
    if (box.portrait) { ctx.fillStyle = '#050608'; ctx.fillRect(0, 0, viewport.width, viewport.height); }
    ctx.drawImage(frame, box.x, box.y, box.w, box.h);
    ctx.restore();
    return true;
  }

  function banner(buf, viewH, top, bottom, color) {
    const y0 = Math.round(viewH * 0.16);
    const big = textWidth(bottom, 2) + 20 <= W ? 2 : 1;
    const w = Math.min(W - 4, Math.max(textWidth(top), textWidth(bottom, big)) + 16);
    const x0 = Math.round((W - w) / 2);
    for (let y = y0; y < y0 + 30; y++) for (let x = x0; x < x0 + w; x++) {
      const edge = y === y0 || y === y0 + 29 || x === x0 || x === x0 + w - 1;
      const i = y * W + x; const c = buf[i];
      buf[i] = edge ? color : rgb(((c & 255) * 0.2) | 0, (((c >>> 8) & 255) * 0.2) | 0, (((c >>> 16) & 255) * 0.2) | 0);
    }
    drawText(buf, W, viewH, Math.round(W / 2 - textWidth(top) / 2), y0 + 4, top, color);
    drawText(buf, W, viewH, Math.round(W / 2 - textWidth(bottom, big) / 2), y0 + 14, bottom, WHITE, { scale: big });
  }

  function chipInHand(buf, viewH, now) {
    const img = atlas.chip;
    const k = viewH / 240;
    const scale = Math.max(1, Math.round(3 * k));
    const cx = W / 2 + 70 * k, cy = viewH - 30 * k + Math.sin(now / 240) * 2;
    const R = 40 * k; const pulse = 0.75 + 0.25 * Math.sin(now / 160);
    for (let y = Math.max(0, (cy - R) | 0); y < Math.min(viewH, cy + R); y++) {
      for (let x = Math.max(0, (cx - R) | 0); x < Math.min(W, cx + R); x++) {
        const d = Math.hypot(x - cx, y - cy) / R;
        if (d >= 1) continue;
        const a = (1 - d) * (1 - d) * 0.7 * pulse;
        const i = y * W + x; const c = buf[i];
        buf[i] = rgb(Math.min(255, (c & 255) + 60 * a) | 0, Math.min(255, ((c >>> 8) & 255) + 220 * a) | 0, Math.min(255, ((c >>> 16) & 255) + 255 * a) | 0);
      }
    }
    renderer.blit(img, Math.round(cx - (img.w * scale) / 2), Math.round(cy - (img.h * scale) / 2), { scale, clipBottom: viewH });
  }

  return {
    ready: () => Boolean(atlas && arms),
    step, draw, jump: doJump, look, tilt, comment, place,
    setPromptBox(box) { promptBox = box && box.canvas && box.prompt ? box : null; },
    body: () => ({ ...body, pitch }),
    engine: () => ({ level, feature: FEATURES[level ?? 0].id, path: core.stats.path, ms: Math.round(core.stats.ms * 10) / 10, tris: core.stats.tris }),
    speech: () => speech,
    // 18.0: story beats speak through the same subtitles as the chatter.
    say(who, text) {
      const now = performance.now();
      speech = { who, name: SPEAKERS[who] ?? who, text, until: now + 2600 + text.length * 55 };
      onSound('chatter');
      return speech;
    },
    comment(event) { return comment(event, performance.now(), true); },
    // 18.2: a gamer slip right now ({ me, who, reply }), and talking to
    // someone in front of you with a line from gamer-reflex.js meaning layers.
    pair(g) { return g ? pair(g, performance.now()) : null; },
    personInFront,
    talk(who, text) {
      const now = performance.now();
      speech = { who, name: SPEAKERS[who] ?? who, text, until: now + 2800 + text.length * 50 };
      onSound('chatter');
      return speech;
    },
    debug(patch = {}) {
      if (patch.pitch !== undefined) pitch = clampPitch(patch.pitch);
      if (patch.rtx) core.rtx(patch.rtx);
      if (patch.engine !== undefined) { forcedLevel = patch.engine === null ? null : clampLevel(patch.engine); level = null; }
      if (patch.body) Object.assign(body, patch.body);
      if (patch.speech) speech = { ...patch.speech, until: performance.now() + 4000 };
      if (patch.comment) comment(patch.comment, performance.now(), true);
      lastPx = toWorld(body);
      return { ...lastPx };
    },
    map,
  };
}
