// 17.3 · The garage and the apartment, walked in first person like Duke
// Nukem 3D, drawn by the same raycaster as Shift 1 -- at the engine era the
// player has earned (engine-eras.js): Wolfenstein flats and no looking up,
// Doom sectors and banded light, Build mirrors, Quake smooth light and fog,
// Unreal coloured glow and filtering, Half-Life grime, AO and grain.
//
// The computers are doors into programs: walk up, E, the camera flies into
// the screen and you dive (screen-dive.js) -- the host (career-worlds.js)
// then shows the program world full size. Surfacing brings you back to the
// computer; the garage reacts to the night (the car alarm, or a chirp).
import { createRenderer, bakeLightmap, rgb, cellAt } from './raycaster.js';
import { createBody, moveBody, stepBody, jump as bodyJump, landingDip, clampPitch, pitchShear, PITCH_LIMIT } from './fp-body.js';
import { createChatter, createMomentWatcher } from './npc-chatter.js';
import { drawSpeech, subtitleFloorRow } from './fp-overlay.js';
import { drawText, textWidth } from './pixel-font.js';
import { loadAtlas } from './first-shift-atlas.js';
import { createDiveFx } from './first-shift-dive.js';
import {
  LEVELS, ARRIVALS, THINGS, buildLevelMap, activeLamps, createWorldState, interact, afterProgram, alarmActive,
  pickThing, surfaceKind, surfaceUnder, doorTarget, wrapYaw, CAR, HOME_BASE, DOOR_OPEN_H,
} from './fp-levels.js';
import { downsample, paintLaptop, paintPc, paintTvScreen, SPRITES, buildTexturesWith } from './fp-textures.js';
import { ERAS, eraSettings, clampEra } from './engine-eras.js';
// 17.4: the engine is a ladder of real rendering features (engine-ladder.js),
// drawn through engine-core.js (raycaster rungs, then polygons on WebGL2).
import { FEATURES, featureFlags, eraOfLevel, levelForEra, clampLevel, featureMoment, textureScale, ERA_NAMES, ERA_END, MAX_LEVEL, UNLOCK_SOURCES } from './engine-ladder.js';
import { createEngineCore, frameDims } from './engine-core.js';
import { createScreenState, screenStep, screenProgress, zoomPose, SCREEN_WORDS } from './screen-dive.js';
import {
  createHeadsetState, headsetStep, headsetOwned, headsetWorn, headsetVisible, headsetProgress, bootLength, arStyle, AR_TAGS, AR_TASKS, AR_TOGGLE_KEYS,
  AR_OWNED_KEY, AR_FIXED_KEY, AR_TASK_KEY, HEADSET_SPOT, tagFor, tagReadout, checkTask, lampSequence, fridgeBeeps, packetFlights, gatewayNight,
  gatewayCounters, WATCH_SPAN,
} from './ar-headset.js';
import { drawAr, drawReticle } from './ar-overlay.js';
import { arcadeSprite, CABINET, cabinetColliders } from './labyrinth-cabinet.js';
import { createArEditor } from './ar-editor.js';
import { deviceSettings, clampDevice, DEVICE_KEY, upgradeDevice } from './vr-devices.js';
import { GARAGE, garageDay, simGarage, slowmoMoments, garageVerdict } from './garage-night.js';
import { compileRule, formatRuleError } from './garage-rule.js';
// Доска Сани: выдуманные механизмы-замки на верстаке и шкаф (src/game/locks/).
import { BENCH_THINGS, isBenchThing, benchSprites, LOCK_CHATTER } from './locks/bench.js';
import { createLockBench } from './locks/overlay.js';
import { onReleaseKeys } from './key-guard.js';

const WHITE = rgb(236, 236, 228);
const GOLD = rgb(255, 200, 70);
const CYAN = rgb(110, 240, 255);
const RED = rgb(232, 60, 44);
const ORANGE = rgb(255, 150, 40);

export const WORLD_SPEAKERS = Object.freeze({ me: 'ТЫ', radio: 'РАДИО «НОЧЬ FM»', neighbor: 'СОСЕД ВИТЯ', tv: 'ТЕЛЕВИЗОР', cat: 'КОТ БАЙТ', sanya: 'САНЯ' });

// [speaker, line]. Duke had one-liners; here it's you, the neighbour, the
// radio, the TV and the cat.
export const WORLD_CHATTER = Object.freeze({
  jump: { cooldown: 10, lines: [['me', 'Прыжок. В Вольфенштейне так не умели.'], ['neighbor', 'Ты там не убейся, акробат.'], ['radio', 'А у нас в эфире — топот. Это ты?'], ['cat', 'Мяу?! (кот считает, что ты сломался)']] },
  'jump-spam': { cooldown: 18, priority: 1, lines: [['neighbor', 'Хватит скакать, у меня люстра качается!'], ['me', 'Распрыгался. Код сам себя не напишет.'], ['cat', 'Ш-ш-ш! (кот уходит)']] },
  'land-car-roof': { cooldown: 12, priority: 2, lines: [['me', 'Крыша держит. Хорошая машина. Моя машина.'], ['neighbor', 'С крыши слезь! Вмятину сам рихтовать будешь.'], ['radio', 'Говорят, на крыше машины лучше ловит. Не ловит.']] },
  'land-car': { cooldown: 12, priority: 1, lines: [['me', 'Капот тёплый. Мотор ещё помнит день.'], ['neighbor', 'По капоту в ботинках? Ну ты зверь.']] },
  'land-high': { cooldown: 14, priority: 1, lines: [['me', 'Отсюда всё как на ладони.'], ['neighbor', 'Высоко сидишь — далеко до травмпункта.'], ['cat', 'Мрр. (кот одобряет высоту)']] },
  'land-bed': { cooldown: 10, priority: 2, lines: [['me', 'Пружины! Как батут, только советский.'], ['cat', 'Мрррау. (ты разбудил кота)']] },
  'hard-fall': { cooldown: 10, priority: 2, lines: [['me', 'Ауч. Колени — это не баг, это фича.'], ['neighbor', 'Бум! Живой там?']] },
  bonk: { cooldown: 10, lines: [['me', 'Потолок. Твёрдый. Как в настоящем движке.']] },
  'look-up': { cooldown: 25, lines: [['me', 'Потолок. Раньше на него даже посмотреть было нельзя.'], ['radio', 'Смотрите в небо? Там дождь до утра.']] },
  'look-down': { cooldown: 25, lines: [['me', 'Ботинки на месте. Работаем.'], ['cat', 'Мяу. (кот у твоих ног)']] },
  idle: { cooldown: 24, lines: [['radio', 'Ночь FM. Для тех, кто не спит и пишет код.'], ['neighbor', 'Чего стоишь? Ноутбук сам себя не откроет.'], ['me', 'Так. Шлюз сам себя не напишет.'], ['cat', 'Мяу. (кот намекает на миску)'], ['tv', '…а теперь о погоде: дождь.']] },
  dark: { cooldown: 8, lines: [['me', 'Темно. Как в Doom 3, только без фонарика.'], ['cat', 'Мяу? (кот не одобряет темноту)'], ['neighbor', 'Свет выключил — спать собрался?']] },
  honk: { cooldown: 4, priority: 1, lines: [['neighbor', 'Ты чего сигналишь в час ночи?!'], ['radio', 'Би-бип! Привет водителю синей машины.'], ['me', 'Гудит. Значит, шина живая.']] },
  'honk-spam': { cooldown: 10, priority: 2, lines: [['neighbor', 'Ещё раз посигналишь — сниму твой аккумулятор.'], ['me', 'Ладно, ладно. Машина — не пианино.']] },
  rain: { cooldown: 12, priority: 1, lines: [['me', 'Дождь. Хорошая ночь, чтобы угонять машины. Мою — не дам.'], ['neighbor', 'Закрывай ворота, зальёт!']] },
  tv: { cooldown: 4, priority: 1, lines: [['tv', 'Новости: в городе снова открывают машины «по воздуху».'], ['tv', 'Прогноз: дождь. Завтра тоже дождь.'], ['tv', 'Хоккей! Шайба в воротах! Чужих не пускать — это и про шлюз.']] },
  fridge: { cooldown: 4, priority: 1, lines: [['me', 'Кефир, колбаса и банка неизвестного. Классика.'], ['me', 'Холодно. Как в серверной.'], ['cat', 'МЯУ! (кот услышал колбасу)']] },
  flush: { cooldown: 3, priority: 1, lines: [['me', 'Смыл. Как вчерашний коммит.'], ['me', 'Это был не код. Это был мой первый скрипт.']] },
  'flush-spam': { cooldown: 6, priority: 2, lines: [['me', 'Да, унитаз интерактивный. Как в Duke Nukem 3D.'], ['cat', 'Мяу?! (кот в шоке)']] },
  mirror: { cooldown: 3, priority: 1, lines: [['me', 'Ну и рожа. Зато код пишет.'], ['me', 'Зеркало как в Duke 3D: луч отражается от стекла. Я проверял.'], ['me', 'Привет. Ты сегодня что-нибудь выучил?']] },
  'mirror-old': { cooldown: 3, priority: 1, lines: [['me', 'Зеркало серое. Движок ещё не умеет отражения — нужен Build.']] },
  cat: { cooldown: 3, priority: 1, lines: [['cat', 'Мрррр.'], ['cat', 'Мяу. (требует еды, а не Python)'], ['cat', 'Мур. (лёг бы на клавиатуру, но ты рядом)']] },
  window: { cooldown: 4, priority: 1, lines: [['me', 'Город спит. Где-то там чьи-то машины открываются «по воздуху».'], ['me', 'Дождь по стеклу. Хорошо, что я внутри.']] },
  barrel: { cooldown: 4, priority: 1, lines: [['me', 'Бочка. Не взрывается. Это другой движок.'], ['neighbor', 'Не пинай бочку, там отработка!']] },
  'radio-on': { cooldown: 3, priority: 2, lines: [['radio', 'Ночь FM! Для всех в гаражах — музыка без ключа владельца.'], ['radio', 'Ночь FM. Звонок в студию: «у меня машина сама открылась». Классика.']] },
  'night-ok': { cooldown: 1, priority: 3, lines: [['neighbor', 'О, машина подмигнула и молчит. Сделал?'], ['radio', 'Хорошие новости: синюю машину этой ночью никто не открыл.'], ['me', 'Шлюз держит. Можно спать. Нет — дальше интереснее.']] },
  'night-fail': { cooldown: 1, priority: 3, lines: [['neighbor', 'ОПЯТЬ ОРЁТ! Выключи свою сигналку!'], ['radio', 'Слышите? Чья-то машина орёт. Кто-то плохо написал правило.'], ['me', 'Чужая команда прошла. Ныряй обратно и чини.']] },
  upgrade: { cooldown: 1, priority: 3, lines: [['radio', 'Говорят, у кого-то обновился движок. Мир стал резче.'], ['me', 'Ого. Текстуры стали… текстуристей.'], ['cat', 'Мяу. (кот теперь в высоком разрешении)']] },
  'enter-garage': { cooldown: 1, priority: 2, lines: [['me', 'Гараж. Ноутбук на верстаке, машина ждёт.'], ['neighbor', 'О, сосед! Опять ночью со своим шлюзом?']] },
  'enter-home': { cooldown: 1, priority: 2, lines: [['me', 'Дом. Комп на столе, кот на диване.'], ['cat', 'Мяу. (кот встречает)']] },
  'no-jump-look': { cooldown: 30, lines: [['me', 'Вверх-вниз не смотрится. Это Вольфенштейн: у него горизонт гвоздями прибит.']] },
  // 17.4 · the AR headset.
  'headset-pick': { cooldown: 1, priority: 3, lines: [['neighbor', 'Это мой старый шлем, бери. Я в нём как муха — глаза на пол-лица.'], ['neighbor', 'Шлем забирай, мне он ни к чему. Нажми Q и смотри, как вещи думают.']] },
  'headset-on': { cooldown: 18, priority: 2, lines: [['neighbor', 'Ты в этом как муха.'], ['neighbor', 'Ну всё, ушёл в свою виртуальность. Ужинать будешь там же?'], ['radio', 'Говорят, через шлемы теперь видно команды. Не верьте, это же радио.'], ['cat', 'Мяу?! (кот не узнаёт тебя в шлеме)'], ['me', 'О. Всё вокруг — с подписями. И у всего есть код.'], ['tv', '…специалисты предупреждают: не ходите в AR-шлемах по лестнице.']] },
  'headset-off': { cooldown: 30, lines: [['me', 'Мир без подписей. Непривычно.'], ['neighbor', 'О, лицо вернулось.'], ['cat', 'Мрр. (кот снова тебя узнаёт)']] },
  'ar-edit': { cooldown: 25, lines: [['me', 'Код прямо в воздухе. Вот это я понимаю.'], ['neighbor', 'Ты чего руками в воздухе машешь? Мух ловишь?'], ['cat', '(кот ловит голограмму лапой)']] },
  'ar-fix': { cooldown: 1, priority: 3, lines: [['me', 'Починил, не вставая с места. Даже к компу не подходил.'], ['neighbor', 'Лампа перестала моргать? Ну ты колдун.'], ['cat', 'Мрр. (кот одобряет тишину)'], ['radio', 'А у нас в студии всё тоже само починилось. Совпадение?'], ['tv', 'Срочно: в одной квартире техника заработала как надо.']] },
  'ar-fail': { cooldown: 6, priority: 1, lines: [['me', 'Не то. Код говорит одно, а вещь хочет другого.'], ['neighbor', 'Ну что, заработало? По лицу вижу — нет.'], ['cat', 'Мяу. (кот видел и не такие баги)']] },
  'fridge-beep': { cooldown: 22, lines: [['cat', 'МЯУ! (кот уверен, что холодильник зовёт его)'], ['me', 'Пищит. Опять. Дверь же закрыта!'], ['tv', '…и о бытовой технике: она тоже хочет внимания.']] },
  'lamp-flicker': { cooldown: 30, lines: [['neighbor', 'У тебя лампа моргает, как в фильме ужасов.'], ['me', 'Лампа мигает. Не проводка — кто-то так написал.']] },
  'lock-panel': { cooldown: 3, priority: 1, lines: [['me', 'Кодовая панель. Без шлема видно только кнопки.'], ['me', 'Стикер: «код 0310». Безопасность уровня «сосед».']] },
  ...LOCK_CHATTER,
});

const PROGRAMS = Object.freeze([
  Object.freeze({ id: 'garage', key: '1', title: 'ШЛЮЗ СИНЕЙ МАШИНЫ', sub: 'VEH · Python-правило против ночи и своего red-team' }),
  Object.freeze({ id: 'automation', key: '2', title: 'ЛИНИЯ 03 · AUTO', sub: 'Мост в Pythonio: линия, буфер, рабочие' }),
  Object.freeze({ id: 'engine', key: '3', title: 'ДВИЖОК.EXE', sub: 'Прокачка движка: эпохи шутеров от Wolfenstein до Half-Life' }),
  Object.freeze({ id: 'pythonio', key: '4', title: 'ПИТОНИО', sub: 'Мастерская AUTO: 22 настоящих заказа — файлы, таблицы, API' }),
  Object.freeze({ id: 'blackice', key: '5', title: 'JUMP KILL', sub: 'Лабиринт: 13 уровней — прыжки, рельса, ракеты; Витя, рабочие, начальник' }),
]);
export const WORLD_PROGRAMS = PROGRAMS;

export function createFpWorld(root, {
  onSound = () => {}, onDive = () => {}, onLeave = () => {}, onBuyUpgrade = () => ({ ok: false }),
  getEra = () => 2, getLevel = null, getEngine = () => null, getWallet = () => 0, eraDebug = false, reducedMotion = false,
  storage = globalThis.localStorage,
  // 17.4 · the AR headset: ?ar=1 starts owning it (?ar=on also wearing it),
  // ?device=0..3 forces a VR device tier; getGarageDay -- the gateway day the
  // headset edits; onGatewayNight({day, rule, picklock, ok}) -> rubles paid;
  // onArFix(taskId, reward) -> rubles paid for a broken thing fixed.
  arOwned = false, arWorn = false, device = null, getGarageDay = () => 1,
  onGatewayNight = () => 0, onArFix = () => 0,
  // Доска Сани: onLockReward(id) -> { first, pay, xp, skillGain, reward }.
  onLockReward = () => ({ first: false }), getMuted = () => false,
} = {}) {
  if (!root) return { open() {}, close() {}, surface() {}, state: () => null };
  const canvas = root.querySelector('#fpWorldCanvas'); const ctx = canvas.getContext('2d');
  const promptEl = root.querySelector('#fpWorldPrompt'); const whereEl = root.querySelector('#fpWorldWhere'); const eraEl = root.querySelector('#fpWorldEra');
  const sayEl = root.querySelector('#fpWorldSay');
  const menuEl = root.querySelector('#fpWorldMenu'); const upgradeEl = root.querySelector('#fpWorldUpgrade'); const leaveBtn = root.querySelector('#fpWorldLeave');
  const arBtn = root.querySelector('#fpArToggle');

  let active = false; let raf = 0; let last = 0;
  let levelId = 'garage'; let map = null; let ws = createWorldState('garage');
  let body = createBody(0, 0); let yaw = 0; let pitch = 0; let walkPhase = 0; let stepAcc = 0; let dipAt = -1e9; let dipImpact = 0;
  let screen = createScreenState(); let zoomFrom = null; let target = null;
  let speech = null; let forcedLevel = null; let lvl = levelForEra(2); let era = eraOfLevel(lvl);
  const core = createEngineCore({ reducedMotion });
  injectEngineStyles();
  let lastFrame = null;
  let upgrade = null; // { from, to, at, info }
  let lightKey = ''; let lightmap = null; let lastAlarmBeep = 0;
  let dynScale = 1; let slowFrames = 0; let fastFrames = 0;
  const held = new Set();
  const chatter = createChatter({ table: WORLD_CHATTER });
  const moments = createMomentWatcher();
  const diveFx = createDiveFx({ artBase: new URL('../../art/', import.meta.url) });
  // ------------------------------------------------------- AR headset state
  const read = (k) => { try { return storage?.getItem(k) ?? null; } catch { return null; } };
  const write = (k, v) => { try { storage?.setItem(k, v); } catch { /* private mode */ } };
  let hs = createHeadsetState({ owned: Boolean(arOwned) || read(AR_OWNED_KEY) === '1' });
  let arWantWorn = Boolean(arWorn);
  let forcedDevice = device === null || device === undefined ? null : clampDevice(device);
  let fixed = new Set((() => { try { return JSON.parse(read(AR_FIXED_KEY) ?? '[]'); } catch { return []; } })());
  const taskCode = (id) => read(AR_TASK_KEY(id)) ?? AR_TASKS[id].starter;
  let wt = 0; // world time (s): slows down while the holo editor is open
  let gw = null; // gateway through the headset: { mode: 'watch'|'run', night, rule, day, t, since, ... }
  let gwHit = { at: -1e9, tone: 'good' };
  let fridgeOpenAt = null; let lastBeep = -1e9; let lampLit = true;
  let lastSeenView = null;
  const editor = createArEditor(root.querySelector('#fpArEditor'), {
    onRun: (code) => editorRun(code), onClose: () => closeEditor(), onInput: (code) => editorInput(code), onSound: (n) => onSound(n),
  });
  function deviceNow() { return deviceSettings(forcedDevice ?? Number(read(DEVICE_KEY) ?? 0)); }
  let atlas = null;
  loadAtlas().then((a) => { atlas = a; texCache.clear(); }).catch(() => { atlas = null; });

  // --------------------------------------------------------- per-era assets
  const texCache = new Map();
  function texturesFor(L) {
    const fl = featureFlags(L);
    // Grime is real decal geometry now (engine-core.js), not painted in.
    const scale = textureScale(fl), decals = false;
    const key = `${scale}|${decals}`;
    if (texCache.has(key)) return texCache.get(key);
    const own = buildTexturesWith({ scale, decals, era: eraOfLevel(L) });
    const k = scale < 1 ? 2 : 1;
    if (atlas) for (const name of ['CEMENT1', 'RACK', 'CRATOP1', 'FLAT5_4']) own[name] = downsample(atlas[name], k);
    const base = { WINDOW: own.WINDOW.data.slice(), TV: own.TV_OFF.data.slice() };
    own.TV_ON = { ...own.TV_OFF, data: own.TV_OFF.data.slice() };
    const set = { tex: own, base, scale };
    texCache.set(key, set);
    return set;
  }
  const frames = new Map(); // "w x h" -> { renderer, imageData, canvas, w, h }
  function frameFor(L, aspect) {
    const { w, h } = frameDims(featureFlags(L), aspect, dynScale);
    const key = `${w}x${h}`;
    let f = frames.get(key);
    if (!f) {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const renderer = createRenderer(w, h);
      f = { w, h, renderer, canvas: c, g: c.getContext('2d'), imageData: new ImageData(new Uint8ClampedArray(renderer.buf.buffer), w, h) };
      frames.set(key, f);
      if (frames.size > 6) frames.delete(frames.keys().next().value);
    }
    return f;
  }

  // Lights are baked by engine-core.js for the rung in use (a 2D grid for
  // the raycaster, a per-face atlas for polygons); this only notes a change.
  function relight() { lightKey = `${levelId}|${JSON.stringify(ws.lights)}|${lampIsBroken()}`; }
  function litLamps() { return activeLamps(levelId, lampIsBroken() ? { ...ws.lights, work: false } : ws.lights); }

  // ------------------------------------------------------------- levels
  function loadLevel(id, { arrive = false } = {}) {
    levelId = id;
    map = buildLevelMap(id);
    const prev = ws;
    ws = { ...createWorldState(id), alarm: prev.level === id ? prev.alarm : null, lastProgram: prev.lastProgram };
    const at = arrive ? ARRIVALS[id] : LEVELS[id].spawn;
    body = createBody(at.x, at.z, id === 'home' ? HOME_BASE : 0);
    yaw = at.yaw; pitch = 0; lightKey = '';
    if (whereEl) whereEl.textContent = LEVELS[id].title;
    root.dataset.level = id;
    chatter.reset(); speech = null;
  }

  function present() {
    const p = new Set(['me']);
    if (levelId === 'garage') { p.add('neighbor'); p.add('sanya'); if (ws.radio) p.add('radio'); }
    else { p.add('cat'); if (ws.tv) p.add('tv'); }
    return p;
  }
  function comment(event, force = false, now = performance.now()) {
    const line = chatter.say(event, now / 1000, { present: present(), force });
    if (!line) return null;
    speech = { ...line, name: WORLD_SPEAKERS[line.who] ?? line.name, until: now + 2600 + line.text.length * 45 };
    onSound('chatter');
    return line;
  }
  function speakerAt(who) {
    if (who === 'neighbor' && levelId === 'garage' && ws.doors.rolldoor) return { x: 5.0, z: 14.0, y: 1.85 };
    if (who === 'cat' && levelId === 'home') return { x: 10.4, z: 5.45, y: 1.05 };
    return null; // subtitle (radio, TV, you)
  }

  // --------------------------------------------------------------- era
  function currentLevel() {
    if (forcedLevel !== null) return forcedLevel;
    return clampLevel(getLevel ? getLevel() : levelForEra(clampEra(getEra())));
  }
  function setLvl(n) { lvl = clampLevel(n); era = eraOfLevel(lvl); }
  function seenLevel() { try { const v = storage?.getItem('quequest.engine.seenLevel'); return v === null || v === undefined ? null : Number(v); } catch { return null; } }
  function markSeen(n) { try { storage?.setItem('quequest.engine.seenLevel', String(n)); } catch { /* private mode */ } }
  // Re-read the engine level; if it went up since the player last saw the
  // world, play the ENGINE UPGRADE moment: the old picture wipes into the
  // new one and a card names the feature and the Python idea behind it.
  function checkEra(now = performance.now(), { quiet = false } = {}) {
    const next = currentLevel();
    const seen = seenLevel();
    if (forcedLevel === null && !quiet) {
      const m = featureMoment(seen, next);
      if (m && seen !== null) startUpgrade(m.from, m.to, m, now);
    }
    if (forcedLevel === null && (seen === null || next > seen)) markSeen(next);
    setLvl(next);
    lightKey = '';
    renderEraLabel();
  }
  let deferredUpgrade = null;
  function startUpgrade(from, to, info, now) {
    // Bought from ENGINE.EXE: the moment plays when you step back from the PC.
    if (screen.phase === 'menu') { deferredUpgrade = deferredUpgrade ? [deferredUpgrade[0], to, null] : [from, to, null]; return; }
    const m = info?.gained ? info : featureMoment(from, to) ?? { from, to, gained: [FEATURES[to]], feature: FEATURES[to], era: null };
    upgrade = { from, to, at: now, info: m };
    onSound('upgrade');
    comment('upgrade', true, now);
    if (upgradeEl) {
      upgradeEl.hidden = false;
      const f = m.feature;
      const more = m.gained.length > 1 ? `<ul class="fp-up__list">${m.gained.slice(0, -1).map((g) => `<li>+ ${g.name}</li>`).join('')}</ul>` : '';
      const eraLine = m.era ? `<em class="fp-up__era">ЭПОХА: ${m.era.name}</em>` : `<em>${ERA_NAMES[eraOfLevel(to)]} · ${to + 1}/${FEATURES.length}</em>`;
      upgradeEl.innerHTML = `<small>ДВИЖОК ОБНОВЛЁН · +${m.gained.length}</small><b>${f.name}</b>${eraLine}${more}<p>${f.what}</p><code class="fp-up__py">${escapeHtml(f.py)}</code>`;
      clearTimeout(startUpgrade.t);
      startUpgrade.t = setTimeout(() => { if (upgradeEl) upgradeEl.hidden = true; }, reducedMotion ? 5000 : 7000);
    }
  }
  function renderEraLabel() {
    const e = eraSettings(era);
    const f = FEATURES[lvl];
    const rtxNote = f.id === 'rtx' && core.stats.rtx === 'off-slow' ? ' (ВЫКЛ: ВИДЕОКАРТА НЕ УСПЕВАЕТ)' : '';
    if (eraEl) eraEl.textContent = `ДВИЖОК: ${ERA_NAMES[era]} · ${lvl + 1}/${FEATURES.length} · ${f.name}${rtxNote}${forcedLevel !== null ? ' · ОТЛАДКА' : ''}`;
    root.dataset.era = e.id;
    root.dataset.engine = String(lvl);
    root.dataset.screen = e.screen;
  }

  // ------------------------------------------------------------ input
  function keyDown(ev) {
    if (!active) return;
    if (ev.target?.closest?.('textarea, input')) return;
    const code = ev.code;
    if (screen.phase === 'menu') {
      const pick = PROGRAMS.find((p) => `Digit${p.key}` === code || `Numpad${p.key}` === code);
      if (pick) { ev.preventDefault(); choose(pick.id); return; }
      if (code === 'Escape') { ev.preventDefault(); back(); }
      return;
    }
    if (screen.phase !== 'walk') {
      if (code === 'Escape' && screen.phase === 'zoom') { ev.preventDefault(); back(); }
      return;
    }
    if (hs.phase === 'edit') {
      if (code === 'Escape') { ev.preventDefault(); closeEditor(); }
      else if (AR_TOGGLE_KEYS.includes(code) && !ev.repeat) { ev.preventDefault(); toggleHeadset(); }
      return;
    }
    if (AR_TOGGLE_KEYS.includes(code) && !ev.repeat && headsetOwned(hs)) { ev.preventDefault(); toggleHeadset(); return; }
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyR', 'KeyF', 'PageUp', 'PageDown'].includes(code)) { held.add(code); ev.preventDefault(); }
    if (ev.repeat) return;
    if (code === 'Space') { ev.preventDefault(); doJump(); return; }
    if (code === 'KeyE' || code === 'Enter') { ev.preventDefault(); act(); return; }
    if (eraDebug && (code === 'BracketLeft' || code === 'BracketRight')) {
      ev.preventDefault();
      const dir = code === 'BracketRight' ? 1 : -1;
      // [ / ] one feature; Shift+[ / ] a whole era.
      const nextL = ev.shiftKey ? levelForEra(Math.max(0, Math.min(ERA_END.length - 1, era + dir))) : clampLevel((forcedLevel ?? lvl) + dir);
      const from = lvl;
      forcedLevel = nextL; setLvl(nextL); lightKey = ''; renderEraLabel(); onSound('ui-click');
      if (nextL > from) startUpgrade(from, nextL, null, performance.now());
      return;
    }
    if (code === 'Escape' && document.pointerLockElement !== canvas) { ev.preventDefault(); leave(); }
  }
  function keyUp(ev) { held.delete(ev.code); }
  function mouseMove(ev) {
    if (!active || document.pointerLockElement !== canvas || screen.phase !== 'walk') return;
    yaw = wrapYaw(yaw + ev.movementX * 0.0024);
    look(ev.movementY * 0.0024);
  }
  function look(dy) {
    const lim = PITCH_LIMIT * (featureFlags(lvl).yshear ? 1 : 0);
    if (lim <= 0) { if (Math.abs(dy) > 0.02) comment('no-jump-look'); pitch = 0; return; }
    pitch = clampPitch(pitch - dy, lim);
  }
  canvas.addEventListener('click', () => { if (active && screen.phase === 'walk') canvas.requestPointerLock?.(); });
  window.addEventListener('keydown', keyDown, { passive: false });
  window.addEventListener('keyup', keyUp);
  window.addEventListener('mousemove', mouseMove);
  onReleaseKeys(() => held.clear());
  // 18.0: touch look (touch-controls.js).
  window.addEventListener('qq:look', (ev) => { if (!active || screen.phase !== 'walk') return; yaw = wrapYaw(yaw + ev.detail.dx); look(ev.detail.dy); });
  leaveBtn?.addEventListener('click', () => leave());
  arBtn?.addEventListener('click', () => { if (active && screen.phase === 'walk') toggleHeadset(); });
  menuEl?.addEventListener('click', (ev) => {
    const b = ev.target.closest?.('[data-program]');
    if (b) { choose(b.dataset.program); return; }
    if (ev.target.closest?.('[data-engine-buy]')) { buy(); return; }
    if (ev.target.closest?.('[data-menu-back]')) back();
  });

  function doJump(now = performance.now()) {
    if (!bodyJump(body, eraSettings(era).jump * 7)) return false;
    onSound('jump');
    comment(moments.jumped(now / 1000), false, now);
    return true;
  }

  function act(now = performance.now()) {
    if (!target) return null;
    // With the headset on, E on a thing that has code opens the holo editor.
    const tag = headsetWorn(hs) ? tagFor(levelId, target.id) : null;
    if (tag?.edit) { openEditor(tag, now); return { editor: tag.id }; }
    if (isBenchThing(target)) { openBench(target.id === 'cabinet' ? 'cabinet' : 'board'); return { bench: target.id }; }
    const r = interact(ws, target.id, now);
    if (r.pickup === 'headset') pickupHeadset(now);
    ws = r.state;
    if (r.sound) onSound(r.sound);
    if (r.relight) lightKey = '';
    let say = r.say;
    if (say === 'mirror' && !featureFlags(lvl).mirrors) say = 'mirror-old';
    if (say) comment(say, true, now);
    if (r.go) { travel(r.go); return r; }
    if (r.dive) enterScreen(target, r.dive, now);
    return r;
  }

  function travel(to) {
    if (document.pointerLockElement === canvas) document.exitPointerLock?.();
    loadLevel(to, { arrive: true });
    relight();
    flash = { color: [0, 0, 0], at: performance.now(), ms: 500 };
    comment(`enter-${to}`, true);
  }
  let flash = null;

  // ------------------------------------------------------- screen dive
  function enterScreen(thing, program, now) {
    zoomFrom = { x: body.x, z: body.z, yaw, eye: body.y + 1.6, pitch };
    screen = screenStep(screen, 'enter', now, { program, speed: headsetWorn(hs) ? deviceNow().dive : 1 });
    screen.thing = thing;
    held.clear();
    if (document.pointerLockElement === canvas) document.exitPointerLock?.();
  }
  function choose(program, now = performance.now()) {
    if (program === 'engine') { renderMenu('engine'); onSound('ui-click'); return; }
    screen = { ...screenStep(screen, 'choose', now, { program }), thing: screen.thing };
    if (menuEl) menuEl.hidden = true;
    onSound('boot');
  }
  function back(now = performance.now()) {
    screen = screenStep(screen, 'cancel', now);
    if (menuEl) menuEl.hidden = true;
    if (deferredUpgrade) { const [f, t] = deferredUpgrade; deferredUpgrade = null; startUpgrade(f, t, null, now); }
    onSound('ui-click');
  }
  function buy() {
    const res = onBuyUpgrade() || { ok: false };
    if (res.ok) { onSound('cash'); checkEra(); }
    else onSound('blocked');
    renderMenu('engine', res);
  }
  function renderMenu(view = 'main', res = null) {
    if (!menuEl) return;
    if (upgradeEl) upgradeEl.hidden = true;
    const e = eraSettings(era);
    menuEl.hidden = false;
    menuEl.dataset.os = e.n <= 1 ? 'dos' : e.n <= 3 ? 'win95' : 'xp';
    if (view === 'engine') {
      const st = getEngine() ?? {};
      const note = res ? (res.ok ? `Куплено. Движок +1: «${FEATURES[Math.min(MAX_LEVEL, lvl)].name}».` : res.reason === 'money' ? `Не хватает денег: нужно ${res.price} ₽.` : res.reason === 'max' ? 'Все апгрейды уже куплены.' : '') : '';
      const nextF = lvl < MAX_LEVEL ? FEATURES[lvl + 1] : null;
      const nextEra = era + 1 < ERA_END.length ? era + 1 : null;
      menuEl.innerHTML = `<header><b>ДВИЖОК.EXE</b><button type="button" data-menu-back>Esc · НАЗАД</button></header>
        <div class="fp-menu__engine"><p>Сейчас: <b>${ERA_NAMES[era]}</b> · включено <b>${lvl + 1} из ${FEATURES.length}</b> возможностей движка${nextEra !== null ? ` · до эпохи «${ERA_NAMES[nextEra]}» ещё ${ERA_END[nextEra] - lvl}` : ' · вершина лестницы'}.</p>
        ${nextF ? `<p class="fp-menu__learn">Следующее: <b>${nextF.name}</b> — ${nextF.what}<br><code>${escapeHtml(nextF.py)}</code></p>` : ''}
        <ol class="fp-menu__ladder fp-menu__features">${FEATURES.map((x, i) => `<li data-on="${i <= lvl}" data-era="${x.era}" title="${escapeHtml(x.what)}">${x.name}</li>`).join('')}</ol>
        <p>Каждое сделанное дело включает следующую возможность: ${UNLOCK_SOURCES.map((u) => u.name).join(', ')}.</p>
        <button type="button" data-engine-buy ${st.upgradePrice ? '' : 'disabled'}>${st.upgradePrice ? `КУПИТЬ АПГРЕЙД · ${st.upgradePrice} ₽ (+1 возможность)` : 'АПГРЕЙДЫ КУПЛЕНЫ'}</button>
        <small>В кошельке: ${Number(getWallet() || 0).toLocaleString('ru-RU')} ₽. ${note}</small></div>`;
      return;
    }
    menuEl.innerHTML = `<header><b>${e.n <= 1 ? 'C:\\> MENU.BAT' : 'РАБОЧИЙ СТОЛ'}</b><button type="button" data-menu-back>Esc · ОТОЙТИ</button></header>
      <ul class="fp-menu__list">${PROGRAMS.map((p) => `<li><button type="button" data-program="${p.id}"><kbd>${p.key}</kbd><b>${p.title}</b><small>${p.sub}</small></button></li>`).join('')}</ul>`;
  }

  // Host calls this when the player leaves the program world.
  function surface(result = null, now = performance.now()) {
    if (screen.phase !== 'inside' && screen.phase !== 'dive') return false;
    screen = { ...screenStep(screen, 'surface', now, { result }), thing: screen.thing };
    root.hidden = false; root.dataset.phase = screen.phase;
    if (result && (screen.program === 'garage')) ws = afterProgram(ws, result, now + 900);
    diveFx.meltReset(lastFrame?.w ?? 320);
    checkEra(now + 1, { quiet: true });
    cancelAnimationFrame(raf); last = now; raf = requestAnimationFrame(frame);
    return true;
  }

  function leave() {
    if (!active) return;
    close();
    onLeave();
  }

  // ------------------------------------------------------------- loop
  function frame(now) {
    if (!active) return;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
    const prevPhase = screen.phase;
    screen = { ...screenStep(screen, 'tick', now), thing: screen.thing };
    if (prevPhase !== screen.phase) phaseChanged(prevPhase, now);
    if (root.dataset.phase !== screen.phase) root.dataset.phase = screen.phase;
    if (screen.phase === 'inside') { raf = 0; return; }
    const prevHs = hs.phase;
    hs = headsetStep(hs, 'tick', now);
    if (prevHs !== hs.phase) headsetChanged(prevHs, now);
    // Focus/scrollIntoView on a menu button must never scroll the world box.
    if (root.scrollTop || root.scrollLeft) { root.scrollTop = 0; root.scrollLeft = 0; }
    update(dt, now);
    draw(now);
    renderSay();
    raf = requestAnimationFrame(frame);
  }
  function phaseChanged(prev, now) {
    root.dataset.phase = screen.phase;
    if (screen.phase === 'menu') renderMenu('main');
    if (screen.phase === 'dive') { onSound('whoosh'); const f = lastFrame; if (f) diveFx.snapshot(f.renderer.buf, f.w, f.h, 'a'); }
    if (screen.phase === 'inside') { root.hidden = true; onDive(screen.program, { level: levelId, era, engine: lvl }); }
    if (screen.phase === 'walk' && prev === 'surface') {
      if (ws.alarm && Math.abs(ws.alarm.at - now) < 3000) comment(ws.alarm.ok ? 'night-ok' : 'night-fail', true, now);
      if (ws.alarm) ws = { ...ws, alarm: { ...ws.alarm, at: now } };
    }
  }

  function update(dt, now) {
    const walking = screen.phase === 'walk' && hs.phase !== 'edit';
    wt += dt * (hs.phase === 'edit' && gw?.mode !== 'run' ? 0.35 : 1);
    updateAr(dt, now);
    let moving = false;
    if (walking) {
      const f = (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0) - (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0);
      const s = (held.has('KeyD') ? 1 : 0) - (held.has('KeyA') ? 1 : 0);
      const turn = (held.has('ArrowRight') ? 1 : 0) - (held.has('ArrowLeft') ? 1 : 0);
      yaw = wrapYaw(yaw + turn * dt * 2.2);
      const tilt = (held.has('KeyR') || held.has('PageUp') ? 1 : 0) - (held.has('KeyF') || held.has('PageDown') ? 1 : 0);
      if (tilt) look(-tilt * dt * 1.8);
      if (f || s) {
        const len = Math.hypot(f, s), sin = Math.sin(yaw), cos = Math.cos(yaw), sp = 3.4 * dt;
        const moved = moveBody(map, body, ((sin * f) + (cos * s)) / len * sp, ((-cos * f) + (sin * s)) / len * sp, { circles: cabinetColliders(levelId) });
        if (moved > 0.0005) {
          moving = true;
          if (body.grounded) { walkPhase += moved * 3.2; stepAcc += moved; if (stepAcc > 0.8) { stepAcc = 0; onSound('step'); } }
        }
      }
    }
    if (!moving || !body.grounded) walkPhase *= 0.9;
    // Door ceilings follow the doors.
    for (const c of map.cells) if (c.door) { const t = doorTarget(levelId, c, ws.doors); c.ceil += Math.sign(t - c.ceil) * Math.min(Math.abs(t - c.ceil), dt * 2.2); }
    const fall = stepBody(map, body, dt, { circles: cabinetColliders(levelId) });
    if (fall.landed) {
      if (fall.impact > 3) { dipAt = now; dipImpact = fall.impact; onSound('land'); }
      const kind = surfaceKind(surfaceUnder(map, body.x, body.z, body.y));
      let ev = null;
      if (kind === 'bed' && fall.impact > 2.5) { body.vy = Math.min(9, fall.impact * 0.8); body.grounded = false; body.peak = body.y; onSound('boing'); ev = 'land-bed'; }
      else if (kind === 'car-roof') ev = 'land-car-roof';
      else if (kind === 'car') ev = 'land-car';
      else if (['rack', 'loft', 'sofa', 'counter', 'tyres'].includes(kind) && body.y > 0.9) ev = 'land-high';
      else if (fall.impact > 9.5 || fall.fall > 1.7) ev = 'hard-fall';
      if (ev) comment(ev, false, now);
    }
    if (fall.bonk) { onSound('hit'); comment('bonk', false, now); }
    if (walking) for (const e of moments.frame(dt, { pitch, moving })) comment(e, false, now);
    if (speech && now > speech.until) speech = null;
    target = walking ? pickThing(levelId, body, yaw, thingsNow()) : null;
    // The car alarm, after a lost night.
    if (levelId === 'garage' && alarmActive(ws, now) && !ws.alarm.ok && now - lastAlarmBeep > 480) { lastAlarmBeep = now; onSound('alarm'); }
    if (levelId === 'garage' && ws.alarm?.ok && now - ws.alarm.at > 0 && now - ws.alarm.at < 700 && now - lastAlarmBeep > 300) { lastAlarmBeep = now; onSound('chirp'); }
    renderPrompt();
  }

  let speechInFrame = false;
  function renderSay() {
    if (!sayEl) return;
    const show = Boolean(speech) && screen.phase === 'walk' && !speechInFrame;
    sayEl.hidden = !show;
    if (!show) return;
    const key = `${speech.who}|${speech.text}`;
    if (sayEl.dataset.key === key) return;
    sayEl.dataset.key = key;
    sayEl.querySelector('b').textContent = speech.name;
    sayEl.querySelector('span').textContent = speech.text;
  }
  function renderPrompt() {
    if (!promptEl) return;
    const walking = screen.phase === 'walk' && hs.phase !== 'edit';
    promptEl.hidden = !walking;
    if (!walking) return;
    const e = eraSettings(era);
    if (target) {
      let label = target.label;
      if (target.kind === 'switch') label = `${ws.lights[target.group] !== false ? 'ВЫКЛЮЧИТЬ' : 'ВКЛЮЧИТЬ'} · ${label}`;
      if (target.kind === 'rolldoor') label = ws.doors.rolldoor ? 'ЗАКРЫТЬ ВОРОТА' : 'ОТКРЫТЬ ВОРОТА';
      if (target.kind === 'door') label = ws.doors['door-bath'] ? 'ЗАКРЫТЬ ДВЕРЬ' : 'ОТКРЫТЬ ДВЕРЬ';
      if (target.kind === 'tv') label = ws.tv ? 'ВЫКЛЮЧИТЬ ТЕЛЕВИЗОР' : 'ВКЛЮЧИТЬ ТЕЛЕВИЗОР';
      if (target.kind === 'fridge') label = ws.fridge ? 'ЗАКРЫТЬ ХОЛОДИЛЬНИК' : 'ОТКРЫТЬ ХОЛОДИЛЬНИК';
      if (target.kind === 'radio') label = ws.radio ? 'ВЫКЛЮЧИТЬ МАГНИТОЛУ' : 'ВКЛЮЧИТЬ МАГНИТОЛУ';
      const tag = headsetWorn(hs) ? tagFor(levelId, target.id) : null;
      if (tag?.edit) label = `ГОЛО-РЕДАКТОР · ${tag.edit === 'gateway' ? 'ПРАВИЛО ШЛЮЗА' : AR_TASKS[tag.edit].title}`;
      promptEl.textContent = `E · ${label}`;
      promptEl.dataset.hot = 'true';
    } else {
      const ar = headsetOwned(hs) ? ` · Q · ${headsetWorn(hs) || hs.phase === 'boot' ? 'СНЯТЬ ШЛЕМ' : 'НАДЕТЬ ШЛЕМ'}` : '';
      promptEl.textContent = `WASD · ИДТИ · МЫШЬ · СМОТРЕТЬ${featureFlags(lvl).yshear ? '' : ' (ТОЛЬКО ВБОК)'} · ПРОБЕЛ · ПРЫЖОК${ar} · Esc · ВЫЙТИ`;
      promptEl.dataset.hot = 'false';
    }
    root.dataset.target = String(Boolean(target));
  }

  // ------------------------------------------------------- AR headset
  function thingsNow() {
    let list = THINGS[levelId] ?? [];
    if (levelId === 'garage') list = [...list, ...BENCH_THINGS];
    return headsetOwned(hs) ? list.filter((t) => t.kind !== 'headset') : list;
  }
  // ------------------------------------------------------- Доска Сани
  let bench = null;
  function openBench(view = 'board') {
    if (document.pointerLockElement === canvas) document.exitPointerLock?.();
    held.clear();
    bench ??= createLockBench(document.body, {
      getWallet, getMuted, reducedMotion, storage,
      getXray: () => ({ headset: headsetOwned(hs), device: deviceNow().n }),
      onReward: (id) => onLockReward(id),
      onSay: (event) => { const line = comment(event, true); return line ? { ...line, name: WORLD_SPEAKERS[line.who] ?? line.name } : null; },
      onSound, onClose: () => { held.clear(); speech = null; },
    });
    bench.open(view);
  }
  // The broken things only act up once you can see them (headset owned).
  function lampIsBroken() { return levelId === 'garage' && headsetOwned(hs) && !fixed.has('lamp'); }
  function pickupHeadset(now = performance.now(), quiet = false) {
    if (headsetOwned(hs)) return;
    hs = headsetStep(hs, 'pickup', now);
    write(AR_OWNED_KEY, '1');
    lightKey = '';
    if (!quiet) { onSound('pickup'); flash = { color: [120, 255, 160], at: now, ms: 260 }; }
    renderArButton();
  }
  function toggleHeadset(now = performance.now()) {
    if (!headsetOwned(hs)) return;
    if (editor.isOpen) { editor.close(); }
    const before = hs.phase;
    hs = headsetStep(hs, 'toggle', now, { reduced: reducedMotion, speed: deviceNow().boot });
    if (hs.phase === before) return;
    if (hs.phase === 'boot') {
      onSound('wake');
      held.clear();
      comment('headset-on', true, now);
      gw = null;
    } else if (hs.phase === 'unboot') {
      onSound('switch');
      if (gw?.mode === 'run' && !gw.verdict) gw = null;
      comment('headset-off', false, now);
    }
    renderArButton();
  }
  function headsetChanged(prev, now) {
    if (hs.phase === 'on' && prev === 'boot') onSound('reward'); // the chime
    root.dataset.ar = hs.phase;
    renderArButton();
  }
  function renderArButton() {
    root.dataset.ar = hs.phase;
    if (!arBtn) return;
    arBtn.hidden = !headsetOwned(hs);
    arBtn.textContent = headsetWorn(hs) || hs.phase === 'boot' ? 'Q · СНЯТЬ ШЛЕМ' : 'Q · НАДЕТЬ ШЛЕМ';
    arBtn.setAttribute('aria-pressed', String(headsetWorn(hs)));
  }

  // The gateway the headset edits: the same day, rule and picklock the
  // laptop's program uses (garage-stage.js keeps them in localStorage).
  function gatewayDay() { return Math.max(1, Math.min(3, Number(getGarageDay()) || 1)); }
  function gatewayRule(day) { return read(`quequest.garage.d${day}.rule`) ?? garageDay(day).starter; }
  function gatewayPicklock(day) { if (!garageDay(day).factory) return null; try { return JSON.parse(read(`quequest.garage.d${day}.picked`) ?? 'null'); } catch { return null; } }
  function ensureWatch() {
    const day = gatewayDay();
    const rule = gatewayRule(day);
    const good = compileRule(rule).ok ? rule : garageDay(day).starter;
    if (gw && gw.mode === 'watch' && gw.day === day && gw.rule === good) return;
    gw = { mode: 'watch', day, rule: good, broken: !compileRule(rule).ok ? compileRule(rule).error : null, night: gatewayNight(good, day, { watch: true }), since: wt, last: 0 };
  }

  function updateAr(dt, now) {
    // Broken lamp: four ticks of its own code.
    if (lampIsBroken()) {
      const seq = lampSequence(taskCode('lamp'), ws.lights.work !== false);
      const tick = Math.floor(wt * 6) % 4;
      const was = lampLit;
      lampLit = seq ? seq[tick] : Math.sin(wt * 37) > 0.3;
      if (was !== lampLit && !lampLit && ws.lights.work !== false && reducedMotion === false && Math.random() < 0.02) comment('lamp-flicker', false, now);
    } else lampLit = true;
    // Fridge: beeps when its code says so.
    if (levelId === 'home' && headsetOwned(hs)) {
      if (ws.fridge && fridgeOpenAt === null) fridgeOpenAt = wt;
      if (!ws.fridge) fridgeOpenAt = null;
      const secs = fridgeOpenAt === null ? 0 : wt - fridgeOpenAt;
      const code = fixed.has('fridge') ? AR_TASKS.fridge.solution : taskCode('fridge');
      if (fridgeBeeps(code, ws.fridge, secs) && now - lastBeep > 2200) { lastBeep = now; onSound('chirp'); comment('fridge-beep', false, now); }
    }
    // The gateway's traffic through the headset.
    if (levelId !== 'garage' || !headsetWorn(hs)) { if (gw?.mode !== 'run') gw = null; return; }
    if (!gw || gw.mode === 'watch') ensureWatch();
    let from, to;
    if (gw.mode === 'watch') {
      from = gw.last; to = (wt - gw.since) % WATCH_SPAN;
      if (to < from) from = -1;
    } else {
      const near = gw.moments.reduce((m, at) => Math.max(m, gw.t > at - 0.2 && gw.t < at + 0.5 ? 1 : 0), 0);
      gw.slow += ((reducedMotion || gw.fast ? 0 : near) - gw.slow) * Math.min(1, dt * 10);
      from = gw.t;
      gw.t = Math.min(gw.night.end, gw.t + dt * (gw.fast ? 4 : 1 - gw.slow * (1 - GARAGE.slowmo)));
      to = gw.t;
    }
    for (const p of gw.night.packets) {
      if (p.atGate > from && p.atGate <= to) {
        gwHit = { at: now, tone: p.verdict === 'pass' && !p.leak ? 'good' : 'bad' };
        if (gw.mode === 'run') onSound(p.verdict === 'pass' ? 'scan' : p.denied ? 'blocked' : 'clank');
      }
      if (gw.mode === 'run' && p.leak && p.atCar !== undefined && p.atCar > from && p.atCar <= to) {
        onSound('impact');
        ws = { ...ws, alarm: { ok: false, at: now } };
      }
    }
    gw.last = to;
    if (gw.mode === 'run') {
      const sim = gatewayCounters(gw.night, gw.day, gw.t);
      if (!gw.verdict && gw.t >= gw.night.end) finishGateway(now);
      if (editor.isOpen && !gw.verdict) editor.result(`НОЧЬ ИЗ ШЛЕМА · ${gw.t.toFixed(1)} С${gw.fast ? ' · ПЕРЕМОТКА' : ''} · ПРОПУСК ${sim.passed} · БЛОК ${sim.blocked} · ЧУЖИЕ ${sim.leaks}`, sim.leaks === 0);
    }
  }

  function openEditor(tag, now = performance.now()) {
    if (!headsetWorn(hs)) return;
    if (hs.phase === 'edit') hs = headsetStep(hs, 'close', now);
    hs = headsetStep(hs, 'open', now, { tag });
    held.clear();
    if (document.pointerLockElement === canvas) document.exitPointerLock?.();
    const dev = deviceNow();
    if (tag.edit === 'gateway') {
      const day = gatewayDay(), d = garageDay(day);
      editor.open({ kind: 'gateway', title: `ШЛЮЗ · ДЕНЬ ${day} · ${d.title}`, brief: `${d.brief}${d.factory && !gatewayPicklock(day) ? ' (Отмычку для дня 3 собирают в ноутбуке — шлем гонит ночь без неё.)' : ''}`, code: gatewayRule(day), starter: d.starter, chips: d.chips, runLabel: '▶ ПРОГНАТЬ НОЧЬ ИЗ ШЛЕМА', rows: 9, device: dev.name });
    } else {
      const task = AR_TASKS[tag.edit];
      editor.open({ kind: 'task', title: fixed.has(task.id) ? `${task.title} · ПОЧИНЕНО` : task.title, brief: `${task.brief} Переменные: ${task.vars}.`, code: taskCode(task.id), starter: task.starter, chips: task.chips, runLabel: '▶ ПРОВЕРИТЬ И ЗАЛИТЬ', rows: 8, device: dev.name });
      if (fixed.has(task.id)) editor.result(task.win, true);
    }
    root.dataset.editor = tag.id;
    onSound('scan');
    comment('ar-edit', false, now);
  }
  function closeEditor(now = performance.now()) {
    editor.close();
    if (hs.phase === 'edit') hs = headsetStep(hs, 'close', now);
    delete root.dataset.editor;
    canvas.focus({ preventScroll: true });
  }
  function editorInput(code) {
    const tag = hs.editor;
    if (!tag) return;
    const c = compileRule(code);
    editor.lint(c.ok ? '✓ Код понятен. Ctrl+Enter — запустить.' : formatRuleError(c.error), c.ok);
    if (tag.edit === 'gateway') write(`quequest.garage.d${gatewayDay()}.rule`, code);
    else write(AR_TASK_KEY(tag.edit), code);
  }
  function editorRun(code, now = performance.now()) {
    const tag = hs.editor;
    if (!tag) return;
    if (tag.edit === 'gateway') {
      if (gw?.mode === 'run' && !gw.verdict) { gw.fast = true; return; }
      const day = gatewayDay();
      const c = compileRule(code);
      if (!c.ok) { editor.result(`Шлюз не может запустить такое правило. ${formatRuleError(c.error)}`, false); onSound('blocked'); return; }
      write(`quequest.garage.d${day}.rule`, code);
      const picklock = gatewayPicklock(day);
      const night = gatewayNight(code, day, { picklock });
      gw = { mode: 'run', day, rule: code, picklock, night, t: 0, slow: 0, fast: false, moments: slowmoMoments(night), last: 0, verdict: null };
      ws = { ...ws, alarm: null };
      editor.mode('watch');
      onSound('ui-click');
      return;
    }
    const task = AR_TASKS[tag.edit];
    write(AR_TASK_KEY(task.id), code);
    const res = checkTask(task.id, code);
    const cases = res.results.map((r) => ({ pass: r.pass, text: `${Object.entries(r.vars).map(([k, v]) => `${k}=${typeof v === 'string' ? `"${v}"` : v === true ? 'True' : v === false ? 'False' : v}`).join(' ')} → ${r.got === true ? 'True' : r.got === false ? 'False' : r.got === 'open' ? 'ОТКРЫТЬ' : r.got === 'closed' ? 'ЗАКРЫТО' : r.got}` }));
    if (!res.ok) { editor.result(res.message, false, cases); onSound('blocked'); comment('ar-fail', false, now); return; }
    const first = !fixed.has(task.id);
    fixed.add(task.id);
    write(AR_FIXED_KEY, JSON.stringify([...fixed]));
    lightKey = '';
    const paid = first ? Number(onArFix(task.id, task.reward)) || 0 : 0;
    editor.result(`${task.win}${paid ? ` +${paid} ₽ В КОШЕЛЁК.` : ''}`, true, cases);
    onSound('reward'); if (paid) onSound('cash');
    if (task.id === 'lock') onSound('lock');
    flash = { color: [120, 255, 160], at: now, ms: 420 };
    comment('ar-fix', true, now);
  }
  function finishGateway(now) {
    const sim = simGarage({ day: gw.day, night: gw.night }, Infinity);
    const v = garageVerdict(sim);
    gw.verdict = { ok: v.ok, title: v.title };
    ws = { ...ws, alarm: { ok: v.ok, at: now } };
    const paid = Number(onGatewayNight({ day: gw.day, rule: gw.rule, picklock: gw.picklock, ok: v.ok })) || 0;
    onSound(v.ok ? 'reward' : 'alarm');
    if (paid) onSound('cash');
    comment(v.ok ? 'night-ok' : 'night-fail', true, now);
    if (editor.isOpen) { editor.mode('edit'); editor.result(`${v.title}. ${v.line}${paid ? ` +${paid} ₽ В КОШЕЛЁК.` : ''}`, v.ok); }
    // Back to the live loop a few seconds later.
    setTimeout(() => { if (gw?.mode === 'run' && gw.verdict) gw = null; }, 4000);
  }

  function drawHeadset(buf, W, viewH, n, now, view) {
    const style = arStyle(n);
    const dev = deviceNow();
    const t = now / 1000;
    const tags = [];
    let flights = null, gateway = null;
    if (headsetWorn(hs)) {
      const ctx = { ws, fixed, owned: true, codes: { lamp: taskCode('lamp'), lock: taskCode('lock'), fridge: taskCode('fridge') }, fridgeBeep: now - lastBeep < 2200 };
      if (levelId === 'garage' && gw) {
        const tt = gw.mode === 'run' ? gw.t : (wt - gw.since) % WATCH_SPAN;
        const c = gatewayCounters(gw.night, gw.day, tt);
        ctx.gateway = { day: gw.day, rule: gw.rule, ...c, error: gw.broken ? formatRuleError(gw.broken).slice(0, 30) : null };
        flights = packetFlights(gw.night, tt);
        const hit = Math.max(0, 1 - (now - gwHit.at) / 350);
        gateway = { hit, hitTone: gwHit.tone };
      }
      for (const tag of AR_TAGS[levelId] ?? []) tags.push({ tag, readout: tagReadout(tag, ctx), target: target?.id === tag.thing });
    }
    lastSeenView = view;
    drawAr(buf, W, viewH, {
      cam: view.cam, view, depth: view.depth, style, device: dev.n, phase: hs.phase, k: headsetProgress(hs, now), t, tags, flights, gateway,
      label: `${levelId === 'garage' ? 'ГАРАЖ' : 'КВАРТИРА'}${gw?.mode === 'run' ? ' · НОЧЬ' : ''}`, reduced: reducedMotion,
    });
  }

  // ------------------------------------------------------------- draw
  const rain = Array.from({ length: 160 }, (_, i) => ({ x: 1 + ((i * 7.31) % 14), z: 12.6 + ((i * 3.17) % 3.3), y: (i * 1.37) % 5, v: 7 + (i % 5) }));
  let laptopImg = null; let laptopKey = ''; let pcImg = null; let pcKey = '';
  function sprites(now, e) {
    const out = [];
    const S = (img, x, z, y = 0, extra = {}) => { if (img) out.push({ img, x, z, y, ppm: img.ppm || 40, ...extra }); };
    const sw = (t) => S(ws.lights[t.group] !== false ? SPRITES.switchOn : SPRITES.switchOff, t.x, t.z, t.y - 0.05, { fullbright: false });
    if (levelId === 'garage') {
      const lk = `${e.screen}|${Math.floor(now / 250)}`;
      if (lk !== laptopKey) { laptopKey = lk; laptopImg = paintLaptop(e.screen, true, now / 1000); }
      S(laptopImg, 1.62, 4.6, 0.95, { fullbright: true, glow: 1.05, prop: 'laptop' });
      S(SPRITES.worklamp, 3.2, 7.6, 0, { fullbright: ws.lights.work !== false && lampLit, glow: 1.1, prop: 'worklamp' });
      // JUMP KILL · Лабиринт: the arcade cabinet by the west wall, facing +x.
      S(arcadeSprite(now), CABINET.x, CABINET.z, CABINET.y, { fullbright: true, glow: 0.9, prop: 'panel', facing: [1, 0, 0], depth: CABINET.depth });
      if (!headsetOwned(hs)) S(SPRITES.headset, HEADSET_SPOT.x, HEADSET_SPOT.z, HEADSET_SPOT.y, { fullbright: false });
      if (atlas?.lamp) for (const [x, z] of [[6.5, 4.5], [6.5, 9.5]]) S(atlas.lamp, x, z, 4.4 - 1.2, { fullbright: ws.lights.main !== false, prop: 'lamp' });
      if (atlas?.lamp) S(atlas.lamp, 12, 1.2, 4.4 - 1.2, { fullbright: ws.lights.loft !== false, prop: 'lamp' });
      S(SPRITES.radio, 11.0, 1.4, 1.8, { fullbright: false, prop: 'radio' });
      // Sanya's lock board and cabinet: flat sprites on the column rungs,
      // real boxes with the art on their front on the polygon rungs.
      for (const [img, x, z, y, extra] of benchSprites({ cabinetOpen: Boolean(bench?.cabinetOpen) })) S(img, x, z, y, { ...extra, prop: 'panel', ...(z < 2 ? { facing: [0, 0, 1], depth: 0.42 } : { facing: [1, 0, 0], depth: 0.05 }) });
      if (atlas?.bar1a0) { S(atlas.bar1a0, 12.6, 10.6, 0, { ppm: 30, prop: 'barrel' }); S(atlas.bar1a0, 13.3, 10.9, 0, { ppm: 30, prop: 'barrel' }); }
      for (const t of THINGS.garage) if (t.kind === 'switch' && t.id === 'sw-main') sw(t);
      if (atlas) {
        const talking = speech?.who === 'neighbor' && now < speech.until;
        const name = talking ? `fitter_talk${Math.floor(now / 260) % 2}` : `fitter_work${Math.floor(now / 700) % 2}`;
        const face = talking ? Math.atan2(body.x - 5.0, -(body.z - 14.0)) : 0;
        const toCam = Math.atan2(body.x - 5.0, -(body.z - 14.0));
        let r = toCam - face; while (r > Math.PI) r -= Math.PI * 2; while (r < -Math.PI) r += Math.PI * 2;
        S(atlas[`${name}_r${((Math.round(r / (Math.PI / 4)) % 8) + 8) % 8}`], 5.0, 14.0, 0);
      }
    } else {
      const pk = `${e.n}|${Math.floor(now / 300)}`;
      if (pk !== pcKey) { pcKey = pk; pcImg = paintPc(true, e.n, now / 1000); }
      S(pcImg, 5.6, 1.35, 1.05, { fullbright: true, glow: 1, prop: 'pc' });
      S(SPRITES.toilet, 1.5, 8.35, HOME_BASE, { prop: 'toilet' });
      S(Math.floor(now / 700) % 3 === 0 ? SPRITES.cat1 : SPRITES.cat0, 10.4, 5.45, 0.75, { prop: 'cat' });
      for (const t of THINGS.home) if (t.kind === 'switch') sw(t);
      if (atlas?.lamp) for (const [x, z, g] of [[3.5, 3.5, 'bedroom'], [10.5, 3.2, 'living'], [9, 9.2, 'kitchen']]) S(atlas.lamp, x, z, 3.0 - 1.2, { fullbright: ws.lights[g] !== false, ppm: 48, prop: 'lamp', fan: g === 'living' });
    }
    // You, for the mirror only (Build-era reflections).
    S(SPRITES.hero, body.x, body.z, body.y, { mirrorOnly: true, fullbright: true, glow: 0.85 });
    return out;
  }
  function dynLights(now) {
    const L = [];
    const add = (x, z, radius, intensity, color) => L.push({ x, z, radius, r2: radius * radius, intensity, color });
    if (levelId === 'garage') {
      add(1.9, 4.6, 1.5, 0.35 + Math.sin(now / 300) * 0.05, [0.4, 1, 0.9]);
      if (alarmActive(ws, now)) {
        const on = Math.floor((now - ws.alarm.at) / 250) % 2 === 0;
        if (ws.alarm.ok) add(6, 4.2, 3, on ? 0.9 : 0.2, [0.4, 1, 0.5]);
        else { add(6, 4.0, 3.5, on ? 1.2 : 0.1, [1, 0.45, 0.05]); add(6, 9.0, 3.5, on ? 0.1 : 1.1, [1, 0.1, 0.05]); }
      }
      if (ws.radio) add(11, 1.4, 1.2, 0.3, [0.4, 1, 0.5]);
      // 17.4 · the broken work lamp: its light is what its code outputs, tick by tick.
      if (lampIsBroken() && lampLit && ws.lights.work !== false) add(3.2, 7.6, 5, 1.1, [1, 0.78, 0.45]);
      // Unreal on: coloured light everywhere -- a neon tube over the racks,
      // the laptop's glow spilling cyan.
      if (featureFlags(lvl).dynLights) { add(3, 1.3, 3.6, 0.55, [1, 0.2, 0.8]); add(2.2, 4.6, 2.6, 0.35, [0.2, 0.9, 1.2]); }
    } else {
      add(5.6, 1.6, 1.8, 0.4, featureFlags(lvl).dynLights ? [0.5, 0.8, 1.1] : [0.4, 0.5, 1]);
      if (ws.tv) add(9.5, 1.3, 3.2, 0.5 + 0.3 * Math.sin(now / 97) * Math.sin(now / 61), [0.5, 0.65, 1.1]);
      if (ws.fridge) add(12.5, 8.5, 2.2, 0.9, [0.95, 1, 1.05]);
      if (now - lastBeep < 260) add(12.4, 8.5, 1.6, 0.8, [1, 0.15, 0.1]);
      if (featureFlags(lvl).dynLights) add(1.8, 2.4, 2.4, 0.35, [1, 0.3, 0.7]);
    }
    return L;
  }
  function particles(now) {
    if (levelId !== 'garage') return [];
    const out = [];
    const t = wt;
    // The car's own lights: blinking hazards while the alarm screams, a
    // double green flash when the night held.
    if (alarmActive(ws, now)) {
      const on = Math.floor((now - ws.alarm.at) / 250) % 2 === 0;
      if (on) {
        const front = ws.alarm.ok ? rgb(120, 255, 150) : rgb(255, 170, 40), rear = ws.alarm.ok ? rgb(120, 255, 150) : rgb(255, 40, 30);
        for (const x of [5.25, 5.45, 6.55, 6.75]) { out.push({ x, z: 3.98, y: 0.62, color: front, size: 0.09 }); out.push({ x, z: 9.02, y: 0.72, color: rear, size: 0.09 }); }
      }
    }
    for (const d of rain) {
      const y = 5 - ((d.y + t * d.v) % 5);
      out.push({ x: d.x, z: d.z, y, color: rgb(150, 170, 200), size: 0.02 });
      out.push({ x: d.x, z: d.z, y: y + 0.12, color: rgb(90, 110, 140), size: 0.015 });
    }
    return out;
  }
  function animateTextures(set, now, e) {
    const { tex, base, scale } = set;
    // Rain running down the window glass.
    if (levelId === 'home') {
      const W = tex.WINDOW; W.data.set(base.WINDOW);
      const t = now / 1000;
      for (let i = 0; i < 18; i++) {
        const u = ((i * 23.7) % 46 + 9) * scale, v0 = (((i * 13.1 + t * (18 + i % 5)) % 50) + 26) * scale;
        for (let k = 0; k < 5 * scale; k++) {
          const x = Math.round(u + Math.sin((v0 + k) * 0.2) * scale), y = Math.round(v0 + k);
          if (x >= 0 && y >= 0 && x < W.w && y < W.h) W.data[y * W.w + x] = rgb(170, 190, 220);
        }
      }
      for (const c of map.cells) if (c.kind === 'fridge') c.faces = { ...c.faces, w: ws.fridge ? 'FRIDGE_OPEN' : 'FRIDGE' };
      const tvCell = map.cells.filter((c) => c.kind === 'tv');
      for (const c of tvCell) c.faces = { ...c.faces, s: ws.tv ? 'TV_ON' : 'TV_OFF' };
      if (ws.tv) paintTvScreen(tex.TV_ON, now / 1000, e.n, scale);
    }
  }

  function draw(now) {
    const rect = canvas.getBoundingClientRect();
    const cw = Math.max(320, Math.round(rect.width * Math.min(1.5, globalThis.devicePixelRatio || 1)));
    const chh = Math.max(180, Math.round(rect.height * Math.min(1.5, globalThis.devicePixelRatio || 1)));
    if (canvas.width !== cw || canvas.height !== chh) { canvas.width = cw; canvas.height = chh; }
    const aspect = rect.width > 0 && rect.height > 0 ? rect.width / rect.height : 16 / 9;
    relight();
    const t0 = performance.now();
    const upK = upgrade ? (now - upgrade.at) / 1800 : 2;
    if (upgrade && upK >= 1.3) upgrade = null;
    if (upgrade && upK < 1) {
      // The wipe: the new era from the top, the old one below the line.
      const cut = Math.max(0, Math.min(1, (upK - 0.15) / 0.75));
      const oldF = renderEra(upgrade.from, now, aspect, { hud: true });
      blitEra(oldF, upgrade.from, 1);
      const newF = renderEra(upgrade.to, now, aspect, { hud: true });
      lastFrame = newF;
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, canvas.width, canvas.height * cut); ctx.clip();
      blitEra(newF, upgrade.to, 1);
      ctx.restore();
      ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.85; ctx.fillRect(0, canvas.height * cut - 2, canvas.width, 4); ctx.globalAlpha = 1;
    } else {
      const f = renderEra(lvl, now, aspect, { hud: true, dive: true });
      lastFrame = f;
      blitEra(f, lvl, 1);
    }
    if (flash) {
      const k = (now - flash.at) / flash.ms;
      if (k >= 1) flash = null;
      else { ctx.fillStyle = `rgba(${flash.color.join(',')},${(1 - k).toFixed(3)})`; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    }
    if (core.stats.rtx !== draw.rtx) { draw.rtx = core.stats.rtx; renderEraLabel(); }
    // Dynamic resolution: keep the frame fast on slow machines.
    const ms = performance.now() - t0;
    if (ms > 28) { slowFrames++; fastFrames = 0; if (slowFrames > 20 && dynScale > 0.6) { dynScale = Math.max(0.6, dynScale * 0.85); slowFrames = 0; } }
    else if (ms < 10) { fastFrames++; slowFrames = 0; if (fastFrames > 90 && dynScale < 1) { dynScale = Math.min(1, dynScale / 0.85); fastFrames = 0; } }
  }

  function blitEra(f, L, alpha) {
    const fl = featureFlags(L);
    ctx.save();
    ctx.globalAlpha = alpha;
    // Upscaling the low-res frame: blocky pixels until bilinear filtering is
    // on (the GPU tiers do their own glow in gl-renderer.js).
    ctx.imageSmoothingEnabled = Boolean(fl.bilinear);
    ctx.drawImage(f.canvas, 0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  function renderEra(L, now, aspect, { hud = true, dive = false } = {}) {
    const fl = featureFlags(L);
    const n = eraOfLevel(L);
    const e = eraSettings(n);
    const f = frameFor(L, aspect);
    const set = texturesFor(L);
    map.textures = set.tex;
    animateTextures(set, now, e);
    const { renderer, w: W, h: H } = f;
    const buf = renderer.buf;
    const barH = e.hud === 'wolf' || e.hud === 'doom' || e.hud === 'quake' ? Math.round(H * 0.14) : 0;
    const viewH = H - barH;
    // Camera: walking, or flying into the screen.
    let cx = body.x, cz = body.z, cyaw = yaw, ceye = body.y + 1.6, cpitch = pitch, fov = e.fov;
    const zk = screenProgress(screen, now);
    if ((screen.phase === 'zoom' || screen.phase === 'dive' || screen.phase === 'menu') && screen.thing && zoomFrom) {
      const p = zoomPose(zoomFrom, screen.thing, screen.phase === 'zoom' ? zk : 1);
      cx = p.x; cz = p.z; cyaw = p.yaw; ceye = p.eye; cpitch = p.pitch; fov = Math.min(e.fov, p.fov + (e.fov - 80));
    }
    const walking = screen.phase === 'walk';
    const bob = reducedMotion || !body.grounded || !walking ? 0 : Math.sin(walkPhase * 2) * e.bob * (viewH / 240);
    const dip = reducedMotion ? 0 : landingDip(dipImpact, (now - dipAt) / 320);
    const cam = { x: cx, z: cz, yaw: cyaw, eye: ceye - dip * 0.2, bob: bob + dip * 6 * (viewH / 240), pitch: pitchShear(cpitch, viewH), pitchAngle: cpitch };
    const lamps = litLamps();
    const shadowGroup = levelId === 'garage' ? 'main' : 'living';
    const view = core.render({ w: W, h: H, viewH, buf, ray: renderer, depth: renderer.depth }, {
      levelId, map, cam, fov, lamps, lightKey, time: now / 1000,
      ambient: levelId === 'garage' ? [0.3, 0.31, 0.36] : [0.3, 0.29, 0.32],
      dynLights: dynLights(now), sprites: sprites(now, e), particles: particles(now),
      shadowLamp: lamps.find((l) => l.group === shadowGroup) ?? null,
      dirtyTextures: levelId === 'home' ? ['WINDOW', ...(ws.tv ? ['TV_ON'] : [])] : [], doorOpenH: DOOR_OPEN_H,
    }, L);
    // The headset's holo tags use the frame's own camera: the raycaster's
    // columns on the early rungs, the GPU's view-projection (with true
    // pitch and roll) on the polygon rungs -- view.project / view.depth.
    if (walking && headsetVisible(hs)) drawHeadset(buf, W, viewH, n, now, { ...view, cam });
    if (hud) drawHud(buf, W, H, viewH, barH, e, now);
    // Someone in view (the neighbour in the doorway, the cat) gets a bubble
    // in the frame; everyone else -- the radio, the TV, you -- a DOM caption
    // in the bottom column above the prompt (renderSay).
    speechInFrame = false;
    if (speech && walking && speakerAt(speech.who) && viewH >= 170) {
      const floor = promptEl && !promptEl.hidden ? subtitleFloorRow(viewH, H, canvas.getBoundingClientRect(), promptEl.getBoundingClientRect()) : null;
      speechInFrame = drawSpeech(buf, W, viewH, speech, speakerAt(speech.who), { ...view, cam }, { floor, bubbleOnly: true }) === 'bubble';
    }
    root.style.setProperty('--bar', `${(barH / H * 100).toFixed(2)}%`);
    if (dive) drawDive(buf, W, H, now);
    if (walking && L >= 1) crosshair(buf, W, viewH, target ? GOLD : rgb(200, 200, 200));
    if (walking && headsetWorn(hs)) drawReticle(buf, W, viewH, arStyle(n), Boolean(target && tagFor(levelId, target.id)?.edit));
    f.g.putImageData(f.imageData, 0, 0);
    void fl;
    return f;
  }

  function crosshair(buf, W, viewH, c) {
    const cx = Math.round(W / 2), cy = Math.round(viewH / 2);
    for (const [dx, dy] of [[-3, 0], [-2, 0], [2, 0], [3, 0], [0, -3], [0, -2], [0, 2], [0, 3]]) buf[(cy + dy) * W + cx + dx] = c;
  }

  // The deep-program dive (and the way back), over the era's own frame.
  function drawDive(buf, W, H, now) {
    const ph = screen.phase;
    if (ph !== 'dive' && ph !== 'surface') return;
    const k = screenProgress(screen, now);
    const t = now / 1000;
    if (ph === 'dive') {
      const src = diveFx.snapshot(buf, W, H, 'b');
      if (k < 0.35) diveFx.swirl(buf, src, W, H, k * 9);
      const R = k < 0.35 ? (k / 0.35) * diveFx.radius(W, H) * 0.6 : 1e9;
      diveFx.tunnel(buf, W, H, t, { R, soft: 24, sat: Math.min(1, k * 2) });
      diveFx.stars(buf, W, H, t, 1 - k);
      const word = k < 0.3 ? SCREEN_WORDS.deep : k < 0.55 ? SCREEN_WORDS.enter : SCREEN_WORDS.inside;
      const sc = W > 420 ? 3 : 2;
      drawText(buf, W, H, Math.round(W / 2 - textWidth(word, sc) / 2), Math.round(H / 2 - 4 * sc), word, WHITE, { scale: sc });
    } else {
      if (k < 0.5) {
        diveFx.tunnel(buf, W, H, t, { dir: -1, sat: 1 - k, R: (1 - k * 2) * diveFx.radius(W, H), soft: 30 });
        const sc = W > 420 ? 2 : 1;
        drawText(buf, W, H, Math.round(W / 2 - textWidth(SCREEN_WORDS.exit, sc) / 2), Math.round(H / 2 - 4 * sc), SCREEN_WORDS.exit, WHITE, { scale: sc });
      }
    }
  }

  // HUD per era: Wolfenstein's blue bar, Doom's stone bar with red digits,
  // Duke's corner numbers, Quake's brown bar, Unreal's glass panels, HL's
  // orange numbers.
  function drawHud(buf, W, H, viewH, barH, e, now) {
    const money = Math.max(0, Math.round(Number(getWallet()) || 0));
    const where = levelId === 'garage' ? 'ГАРАЖ' : 'КВАРТИРА';
    const sc = H >= 300 ? 2 : 1;
    const shadeRect = (x0, y0, w, h, k, tint = null) => {
      for (let y = Math.max(0, y0); y < Math.min(H, y0 + h); y++) for (let x = Math.max(0, x0); x < Math.min(W, x0 + w); x++) {
        const i = y * W + x, c = buf[i];
        let r = (c & 255) * k, g = ((c >>> 8) & 255) * k, b = ((c >>> 16) & 255) * k;
        if (tint) { r += tint[0]; g += tint[1]; b += tint[2]; }
        buf[i] = rgb(Math.min(255, r) | 0, Math.min(255, g) | 0, Math.min(255, b) | 0);
      }
    };
    if (e.hud === 'wolf') {
      for (let y = viewH; y < H; y++) for (let x = 0; x < W; x++) buf[y * W + x] = y === viewH ? rgb(80, 80, 200) : rgb(0, 0, 112);
      const y = viewH + Math.round((barH - 7) / 2);
      drawText(buf, W, H, 6, y, where, WHITE);
      drawText(buf, W, H, Math.round(W / 2 - textWidth(`${money} ₽`) / 2), y, `${money} ₽`, GOLD);
      drawText(buf, W, H, W - textWidth('WOLF3D') - 6, y, 'WOLF3D', WHITE);
      return;
    }
    if (e.hud === 'doom') {
      const stone = atlas?.FLAT5_4;
      for (let y = viewH; y < H; y++) for (let x = 0; x < W; x++) {
        const c = stone ? stone.data[((y - viewH) % stone.h) * stone.w + (x % stone.w)] : rgb(90, 90, 90);
        const k = y === viewH ? 1.2 : 0.75;
        buf[y * W + x] = rgb(Math.min(255, (c & 255) * k) | 0, Math.min(255, ((c >>> 8) & 255) * k) | 0, Math.min(255, ((c >>> 16) & 255) * k) | 0);
      }
      const digits = String(money);
      const dw = 14; const x0 = 8; const y0 = viewH + Math.round((barH - 16) / 2);
      if (atlas?.sttnum0) for (let i = 0; i < digits.length; i++) renderer0(buf, W, H, atlas[`sttnum${digits[i]}`], x0 + i * dw, y0);
      else drawText(buf, W, H, x0, y0, digits, RED, { scale: 2 });
      drawText(buf, W, H, x0 + digits.length * dw + 4, y0 + 5, '₽', RED);
      drawText(buf, W, H, W - textWidth(where) - 8, y0 + 1, where, WHITE);
      drawText(buf, W, H, W - textWidth('DOOM') - 8, y0 + 9, 'DOOM', RED);
      return;
    }
    if (e.hud === 'duke') {
      const txt = `${money}`;
      drawText(buf, W, H, 8, H - 18 * sc, '₽', GOLD, { scale: sc });
      drawText(buf, W, H, 8 + 8 * sc, H - 18 * sc, txt, GOLD, { scale: sc * 2 });
      drawText(buf, W, H, W - textWidth('BUILD', sc) - 8, H - 12 * sc, 'BUILD', rgb(255, 230, 120), { scale: sc });
      return;
    }
    if (e.hud === 'quake') {
      for (let y = viewH; y < H; y++) for (let x = 0; x < W; x++) {
        const n = ((x * 7 + y * 13) % 11) * 2;
        buf[y * W + x] = y === viewH ? rgb(150, 110, 60) : rgb(70 + n, 52 + n, 34 + n);
      }
      const y0 = viewH + Math.round((barH - 7 * sc) / 2);
      drawText(buf, W, H, 10, y0, `₽ ${money}`, rgb(255, 210, 120), { scale: sc });
      drawText(buf, W, H, W - textWidth(where, sc) - 10, y0, where, rgb(200, 170, 120), { scale: sc });
      return;
    }
    if (e.hud === 'unreal') {
      const bw = textWidth(`₽ ${money}`, sc) + 16;
      shadeRect(W - bw - 8, H - 18 * sc - 6, bw, 14 * sc, 0.4, [0, 30, 40]);
      drawText(buf, W, H, W - bw, H - 15 * sc - 6, `₽ ${money}`, CYAN, { scale: sc });
      drawText(buf, W, H, 10, H - 12 * sc, where, rgb(140, 220, 255), { scale: sc });
      return;
    }
    // Half-Life
    const s2 = sc * 2;
    shadeRect(8, H - 14 * s2 - 4, textWidth(`₽${money}`, s2) + 16, 11 * s2, 0.55);
    drawText(buf, W, H, 16, H - 13 * s2, `₽${money}`, ORANGE, { scale: s2, shadow: 0 });
    drawText(buf, W, H, W - textWidth(where, sc) - 14, H - 12 * sc - 6, where, ORANGE, { scale: sc, shadow: 0 });
  }
  function renderer0(buf, W, H, img, x, y) {
    if (!img) return;
    for (let j = 0; j < img.h; j++) for (let i = 0; i < img.w; i++) {
      const c = img.data[j * img.w + i];
      if ((c >>> 24) < 128) continue;
      const px = x + i, py = y + j;
      if (px >= 0 && py >= 0 && px < W && py < H) buf[py * W + px] = c;
    }
  }

  // ------------------------------------------------------------- API
  function open(level = 'garage', opts = {}) {
    if (opts.era !== undefined && opts.era !== null) forcedLevel = levelForEra(opts.era);
    if (opts.engine !== undefined && opts.engine !== null) forcedLevel = clampLevel(opts.engine);
    active = true; root.hidden = false;
    screen = createScreenState(); root.dataset.phase = 'walk';
    if (menuEl) menuEl.hidden = true;
    if (!map || opts.reset !== false || level !== levelId) loadLevel(level, { arrive: Boolean(opts.arrive) });
    checkEra(performance.now());
    relight();
    held.clear();
    comment(`enter-${level}`, true);
    if (arWantWorn && headsetOwned(hs) && !headsetWorn(hs)) { hs = { ...headsetStep(hs, 'toggle', performance.now(), { reduced: true }), phase: 'on' }; arWantWorn = false; }
    renderArButton();
    last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
    canvas.focus({ preventScroll: true });
  }
  function close() {
    if (editor.isOpen) { editor.close(); if (hs.phase === 'edit') hs = headsetStep(hs, 'close', performance.now()); }
    if (bench?.active) bench.close();
    if (gw?.mode === 'run') gw = null;
    active = false; root.hidden = true; cancelAnimationFrame(raf); raf = 0; held.clear();
    if (document.pointerLockElement === canvas) document.exitPointerLock?.();
    if (upgradeEl) upgradeEl.hidden = true;
  }
  function debug(patch = {}) {
    if (patch.level && patch.level !== levelId) { loadLevel(patch.level); relight(); }
    if (patch.body) Object.assign(body, patch.body);
    if (patch.yaw !== undefined) yaw = patch.yaw;
    if (patch.pitch !== undefined) pitch = clampPitch(patch.pitch);
    if (patch.era !== undefined) { forcedLevel = patch.era === null ? null : levelForEra(patch.era); setLvl(currentLevel()); lightKey = ''; renderEraLabel(); }
    if (patch.engine !== undefined) { forcedLevel = patch.engine === null ? null : clampLevel(patch.engine); setLvl(currentLevel()); lightKey = ''; renderEraLabel(); }
    if (patch.lights) { ws = { ...ws, lights: { ...ws.lights, ...patch.lights } }; lightKey = ''; }
    if (patch.world) ws = { ...ws, ...patch.world };
    if (patch.interact) { target = THINGS[levelId].find((t) => t.id === patch.interact) ?? null; act(); }
    if ('speech' in patch) speech = patch.speech ? { ...patch.speech, until: performance.now() + 5000 } : null;
    if (patch.comment) comment(patch.comment, true);
    if (patch.upgrade) startUpgrade(clampLevel(patch.upgrade[0]), clampLevel(patch.upgrade[1]), null, performance.now());
    if (patch.alarm !== undefined) ws = { ...ws, alarm: patch.alarm === null ? null : { ok: Boolean(patch.alarm), at: performance.now() } };
    if (patch.dynScale) dynScale = patch.dynScale;
    if (patch.rtx) core.rtx(patch.rtx);
    if (patch.device !== undefined) forcedDevice = patch.device === null ? null : clampDevice(patch.device);
    if (patch.ar === 'pickup' || patch.ar === 'own') pickupHeadset(performance.now(), patch.ar === 'own');
    if (patch.ar === 'on' && !headsetWorn(hs)) { if (!headsetOwned(hs)) pickupHeadset(performance.now(), true); hs = { ...headsetStep(hs, 'toggle', performance.now(), { reduced: true }), phase: 'on' }; renderArButton(); }
    if (patch.ar === 'boot') { if (!headsetOwned(hs)) pickupHeadset(performance.now(), true); if (headsetWorn(hs)) hs = { ...hs, phase: 'off' }; toggleHeadset(); if (patch.bootAt !== undefined) hs = { ...hs, since: performance.now() - patch.bootAt * (hs.bootMs ?? 1500) }; }
    if (patch.ar === 'off' && headsetVisible(hs)) { if (editor.isOpen) closeEditor(); hs = { ...hs, phase: 'off', editor: null }; renderArButton(); }
    if (patch.arCode) { write(AR_TASK_KEY(patch.arCode.task), patch.arCode.code); }
    if (patch.arEdit) { const tag = (AR_TAGS[levelId] ?? []).find((t) => t.id === patch.arEdit); if (tag) openEditor(tag); }
    if (patch.arType !== undefined && editor.isOpen) { const taEl = root.querySelector('#fpArEditor textarea'); if (taEl) { taEl.value = patch.arType; editorInput(taEl.value); } }
    if (patch.arRun && editor.isOpen) editorRun(editor.code);
    if (patch.arFast && gw?.mode === 'run') gw.fast = true;
    if (patch.arFixed !== undefined) { fixed = new Set(patch.arFixed); write(AR_FIXED_KEY, JSON.stringify([...fixed])); lightKey = ''; }
    if (patch.wt !== undefined) wt = patch.wt;
    if (patch.bench) openBench(patch.bench);
    if (patch.locks && bench) bench.debug(patch.locks);
    return snapshot();
  }
  function snapshot() {
    return {
      active, level: levelId, era, eraId: eraSettings(era).id, engine: lvl, feature: FEATURES[lvl].id, forcedLevel, render: { path: core.stats.path, ms: Math.round(core.stats.ms * 10) / 10, cpuMs: Math.round((core.stats.cpuAvg ?? 0) * 10) / 10, msAvg: Math.round((core.stats.msAvg ?? 0) * 10) / 10, tris: core.stats.tris, gl: core.stats.gl, rtx: core.stats.rtx, bakeMs: Math.round(core.stats.bakeMs) }, phase: screen.phase, program: screen.program,
      body: { x: body.x, z: body.z, y: body.y, grounded: body.grounded }, yaw, pitch, target: target?.id ?? null,
      locks: bench?.active ? bench.state() : null, world: JSON.parse(JSON.stringify(ws)), speech: speech ? { who: speech.who, text: speech.text } : null, dynScale,
      ar: { phase: hs.phase, owned: headsetOwned(hs), worn: headsetWorn(hs), editor: hs.editor?.id ?? null, fixed: [...fixed], device: deviceNow().id,
        lampLit, gateway: gw ? { mode: gw.mode, t: gw.t ?? null, done: Boolean(gw.verdict), verdict: gw.verdict ?? null, day: gw.day } : null, editorMode: root.querySelector('#fpArEditor')?.dataset.mode ?? null },
    };
  }
  return {
    open, close, surface, debug, state: snapshot,
    get locks() { return bench; },
    get phase() { return screen.phase; },
    setEra(n) { forcedLevel = n === null ? null : levelForEra(n); setLvl(currentLevel()); lightKey = ''; renderEraLabel(); },
    setLevel(n) { forcedLevel = n === null ? null : clampLevel(n); setLvl(currentLevel()); lightKey = ''; renderEraLabel(); },
    refreshEra: () => checkEra(),
    // 17.4 · the VR device ladder (vr-devices.js). Only the headset is
    // obtainable in play now; the hook is here for the next rungs.
    get device() { return deviceNow(); },
    upgradeDevice(spend = () => true) {
      const r = upgradeDevice({ device: deviceNow().n, wallet: Number(getWallet()) || 0 });
      if (r.ok && spend(r.price) !== false) write(DEVICE_KEY, String(r.device));
      return r;
    },
  };
}

function escapeHtml(t) { return String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }

// 17.4: styles for the feature card and the ENGINE.EXE ladder, kept here so
// styles.css stays untouched.
function injectEngineStyles() {
  if (typeof document === 'undefined' || document.getElementById('engineLadderStyles')) return;
  const st = document.createElement('style');
  st.id = 'engineLadderStyles';
  st.textContent = `.fp-up__py{display:block;margin:10px auto 0;padding:8px 10px;max-width:100%;border:1px solid #9fe8ff55;border-radius:6px;background:#04161c;color:#9fe8ff;font:700 13px ui-monospace,monospace;text-align:left;white-space:pre-wrap;overflow-wrap:anywhere}
.fp-up__list{margin:6px 0 0;padding:0;list-style:none;color:#ffc857;font:700 11px ui-monospace,monospace}
.fp-up__era{display:block;color:#ffc857!important;font-size:14px!important}
.fp-menu__features{columns:2;column-gap:18px;font-size:11px;line-height:1.5}
.fp-menu__features li[data-on="true"]{color:#9fe8ff}.fp-menu__features li[data-on="false"]{opacity:.45}
.fp-menu__learn code{color:#9fe8ff;font:700 12px ui-monospace,monospace;white-space:pre-wrap}
@media(max-width:760px){.fp-menu__features{columns:1}}`;
  document.head.appendChild(st);
}
