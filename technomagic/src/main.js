/*
 * ТЕХНОМАГИЯ — сборка игры.
 *
 * Здесь живёт то, что связывает остальное: цикл кадра, камера, прицел,
 * экраны между попытками и перезапуск. Правил боя тут нет — они в
 * world.js, поведения врагов нет — оно в ai.js.
 */

import { CAMPAIGN } from './levels.js';
import { systemicLabel } from './systemic-room.js';
import { decode, encode } from './level.js';
import { createWorld, update } from './world.js';
import { AIM_CONE, assistAim, closeThreat, hasTargetUnderAim, lockTarget, keepPicked, cycleTarget, targetNear, keyboardAim, stickAim } from './aim.js';
import { createRenderer } from './render.js';
import { createInput, STICK_RANGE } from './input.js';
import { createAudio } from './audio.js';
import { createScore, readBest, writeBest } from './score.js';
import { ELEMENTS, ELEMENT_ORDER, STACK_LIMIT, CHARGE_STEP, spellOf, colourOf } from './magic.js';
import { parseHash, buildLink, compare, cleanNick, NICK_KEY } from './challenge.js';
import { loadBook, noteSpell, noteObservation, bookPages, bookCount, elementMarks } from './book.js';
import { iconTag } from './icons.js';
import { pulse } from './pulse.js';
import { createTrace, traceEvent, traceKey, traceDelivery } from './trace.js';
import { createEpisodeShowcase, createShowcase, withSeed } from './showcase.js';
import { loadArt } from './art.js';
import { operationResult, operationGrade } from './operation.js';
import { physicalHint } from './observations.js';
import { pickEntry, entryLevel } from './entry.js';
import { createGuide, stepOfUnlock, ladderPulses, ladderTick, createLadderMeter, ROUTE_NAMES } from './lestnica.js';
import { dryHint, lockedHint, stackFullHint, COIN_KEY } from './hints.js';
import { createNeeds, needNow } from './nuzhda.js';
import { createIsoRenderer } from './view3d/igra.js';
import { pickView, CAMERA_KEYS } from './view3d/vvod.js';
import { lightLevel, coinTarget, coinLanding } from './vidimost.js';
import { ALARM_NAMES } from './vospriyatie/alarm.js';
import { talkTarget, talkNow, questLog, NAMES as RESIDENT_NAMES } from './zhiteli.js';
import {
  keyRoute, talkPrompt, NOBODY, patienceLeft, questToast, talkEventToast, questNext, questTarget,
  knownQuests, TALK_KEY, LOG_KEY,
} from './zhiteli-vid.js';

const $ = (id) => document.getElementById(id);

const canvas = $('screen');

/*
 * КАКОЙ ВИД
 * =========================================================
 * Решение Сергея 03.10: «Лестница» играется в изометрии как в Ultima
 * Online (src/view3d/igra.js); ?vid=2d возвращает плоский вид, ?vid=iso
 * включает объём на любом этаже. Старая кампания по умолчанию плоская —
 * она принята такой. Нет WebGL — не глохнем, а играем плоско и говорим
 * об этом в консоль (свод, п.7р: молча для человека, громко для нас).
 */
const viewWanted = pickView(location.search, pickEntry(location.search, location.hash));
const renderer = makeRenderer(viewWanted);

function makeRenderer(mode) {
  if (mode === 'iso') {
    try {
      return createIsoRenderer(canvas, { buttons: document.getElementById('camctl') });
    } catch (error) {
      console.warn('[vid] изометрия не поднялась, играем плоско:', error && error.message);
    }
  }
  return createRenderer(canvas);
}
const input = createInput(canvas);
const audio = createAudio();

const ui = {
  kills: $('kills'),
  clock: $('clock'),
  toast: $('toast'),
  veil: $('veil'),
  veilKicker: $('veilKicker'),
  veilTitle: $('veilTitle'),
  veilText: $('veilText'),
  veilStats: $('veilStats'),
  veilAction: $('veilAction'),
  veilSecond: $('veilSecond'),
  veilCode: $('veilCode'),
  codeBox: $('codeBox'),
  veilScore: $('veilScore'),
  rankLetter: $('rankLetter'),
  scoreLines: $('scoreLines'),
  scoreTotal: $('scoreTotal'),
  scoreBest: $('scoreBest'),
  score: $('score'),
  systemic: $('systemic'),
  systemicActions: $('systemicActions'),
  combo: $('combo'),
  target: $('target'),
  targetTime: $('targetTime'),
  veilShare: $('veilShare'),
  nickBox: $('nickBox'),
  linkBox: $('linkBox'),
  stack: $('stack'),
  form: $('form'),
  mute: $('mute'),
  ghostMove: $('ghostMove'),
  ghostAim: $('ghostAim'),
  tome: $('tome'),
  tomeCount: $('tomeCount'),
  tomeStats: $('tomeStats'),
  tomeSubstances: $('tomeSubstances'),
  tomeSignatures: $('tomeSignatures'),
  tomeObservations: $('tomeObservations'),
  tomeClose: $('tomeClose'),
  tomeOpen: $('tomeOpen'),
  found: $('found'),
  foundKicker: $('foundKicker'),
  foundName: $('foundName'),
  foundNote: $('foundNote'),
  operationHud: $('operationHud'),
  operationGoal: $('operationGoal'),
  operationOptional: $('operationOptional'),
  operationLesson: $('operationLesson'),
  physicalObservation: $('physicalObservation'),
  vidno: $('vidno'),
  vidnoWord: $('vidnoWord'),
  vidnoCells: $('vidnoCells'),
  operationVidno: $('operationVidno'),
  coin: $('btn-coin'),
  daemons: $('daemons'),
  /* Слой «г»: разговор и журнал заданий. */
  talkBtn: $('btn-talk'),
  talk: $('talk'),
  talkName: $('talkName'),
  talkWait: $('talkWait'),
  talkLine: $('talkLine'),
  talkChoices: $('talkChoices'),
  questOpen: $('questOpen'),
  zhurnal: $('zhurnal'),
  zhurnalList: $('zhurnalList'),
  zhurnalCount: $('zhurnalCount'),
  zhurnalMore: $('zhurnalMore'),
  zhurnalClose: $('zhurnalClose'),
};

/*
 * Книга живёт рядом с игрой, а не внутри мира: мир не знает, что игрок
 * уже видел, и знать не должен — иначе один и тот же этаж вёл бы себя
 * по-разному у двух людей и перестал бы быть тем же этажом.
 */
const book = loadBook();

/*
 * Стихии набираются правой рукой: четыре на стрелках, пятая — на правом
 * шифте под ними. Слэш пробовали и убрали: до него приходится тянуться
 * через весь нижний ряд, а шифт лежит там же, где и так стоит ладонь.
 * Цифровой ряд оставлен дубликатом — кому-то привычнее он, а стоит это
 * пяти строк.
 *
 * Сброс очереди уехал со стрелки вниз на Q и Backspace: стрелку забрала
 * земля. Q — потому что левая рука на WASD и мизинец до неё дотягивается,
 * не отпуская хода.
 */
const CHARGE_KEYS = {
  ArrowLeft: 'fire',
  ArrowUp: 'water',
  ArrowRight: 'wind',
  ArrowDown: 'earth',
  ShiftRight: 'bolt',
  Digit1: 'fire',
  Digit2: 'water',
  Digit3: 'wind',
  Digit4: 'earth',
  Digit5: 'bolt',
  /* Кнопки стихий на экране (input.js): свои коды, не цифры — цифры при
     открытой полосе разговора отвечают жителю (zhiteli-vid.js). */
  ElemFire: 'fire',
  ElemWater: 'water',
  ElemWind: 'wind',
  ElemEarth: 'earth',
  ElemBolt: 'bolt',
};

const SFX_BY_EVENT = {
  shot: 'shot',
  swing: 'swing',
  impact: 'impact',
  'charge-start': 'charge',
  charge: 'land',
  'daemon-windup': 'beamup',
  resist: 'resist',
  knock: 'knock',
  kill: 'kill',
  death: 'death',
  pickup: 'pickup',
  dry: 'dry',
  glass: 'glass',
  panel: 'chain',
  slam: 'impact',
  spot: 'spot',
  cleared: 'exit',
  chain: 'chain',
  ignite: 'ignite',
  doused: 'doused',
  spill: 'doused',
};

let levelIndex = 0;
let custom = false;
let challenge = null;   /* чужой результат, если этаж открыт по ссылке */
let locked = null;      /* цель, за которую держится прицел на клавиатуре */
let picked = null;      /* цель, выбранная руками: тап, клик или Tab */
let level = CAMPAIGN[0];
let world = null;
let score = null;
let levelCode = '';
let result = null;
let scene = 'call';          /* call → play → dead | clear, плюс pause */
let view = { x: 0, y: 0 };
let lastView = { zoom: 1, camX: 0, camY: 0 };
let toastTimer = 0;
let tomeVisible = false;
let foundTimer = 0;
let deathHold = 0;
let attempts = 0;

/* «Лестница»: подсказка, которая идёт за руками, и что уже ушло в
   счётчик за эту попытку. Живут попытку, пересоздаются в startLevel. */
let guide = createGuide({ touch: byTouch });
let meter = createLadderMeter();
/* Советы слоя «б» в момент нужды (src/nuzhda.js): какие уже показаны. */
let needs = createNeeds();

/*
 * МОНЕТА (слой «б», src/vospriyatie/moneta.js). Кнопка МОНЕТА взводит
 * бросок: дальше «куда» говорит тап или клик по полю, отпущенный правый
 * стик (направление и насколько отклонён) или второе нажатие кнопки —
 * тогда туда, куда показывает пунктир. E бросает сразу: под мышь, если
 * ей целятся, иначе по прицелу на всю дальность. Живут попытку.
 */
let coinArmed = false;
let coinPoint = null;       /* куда полетит, пока взведено (точка мира) */
let coinStickUsed = false;  /* правый стик вели, пока взведено */
let coinClickHold = false;  /* клик, бросивший монету, — не удар */
/* До какой секунды этажа строка успеха ступени не перебивается «сухим»
   выпуском (drainEvents, 'dry'). */
let successUntil = 0;

/*
 * РАЗГОВОР И ЖУРНАЛ (слой «г», src/zhiteli.js; экранное — zhiteli-vid.js).
 * Кнопки полосы — DOM: нажатие кладёт выбор сюда, а в мир он уходит
 * намерением в следующем же кадре (buildIntent), той же дверью, что F и
 * цифры. `tracked` — какое задание ведёт стрелка у края (null — никакое);
 * взятое задание начинает вести само, сделанное перестаёт.
 */
let pendingSay = null;
let pendingLeave = false;
let talkShown = '';
let logVisible = false;
let tracked = null;


/* =========================================================
   ЧУЖОЙ ЭТАЖ ИЗ АДРЕСА
   ========================================================= */

/*
 * Уровень целиком лежит в ссылке. Редактора пока нет, но канал уже
 * рабочий: код из адресной строки проходит тот же путь, что пройдёт код
 * из чужих рук.
 */
function levelFromHash() {
  const parsed = parseHash(location.hash);
  challenge = parsed.challenge;
  if (!parsed.code) return null;

  try {
    const outside = decode(parsed.code);
    outside.title = challenge ? 'ВЫЗОВ' : 'ЧУЖОЙ ЭТАЖ';
    outside.call = challenge
      ? `${challenge.nick} прошёл этот этаж за ${formatTime(challenge.time)}, ранг ${challenge.rank}. Автоответчик передал вызов — теперь твоя очередь.`
      : 'Код прислали снаружи. Кто там внутри — в сообщении не сказано.';
    return outside;
  } catch (error) {
    setToast(`КОД НЕ ОТКРЫЛСЯ: ${error.message}`, 5);
    return null;
  }
}


/* =========================================================
   ВЫЗОВ
   ========================================================= */

function readNick() {
  try {
    return cleanNick(localStorage.getItem(NICK_KEY) || '');
  } catch (error) {
    return '';
  }
}

function rememberNick(nick) {
  try { localStorage.setItem(NICK_KEY, nick); } catch (error) { /* приватный режим */ }
}

/* Ссылка перестраивается на каждое нажатие в поле имени: подписаться под
   вызовом должно быть так же дёшево, как его скопировать. */
function refreshLink() {
  if (!result) return;
  const base = location.origin + location.pathname;
  ui.linkBox.value = buildLink(base, levelCode, {
    nick: ui.nickBox.value,
    time: world.time,
    score: result.total,
    rank: result.rank,
  });
}


/* =========================================================
   ЭКРАНЫ
   ========================================================= */

function showVeil(config) {
  ui.veilKicker.textContent = config.kicker || '';
  ui.veilTitle.textContent = config.title || '';
  ui.veilText.textContent = config.text || '';
  ui.veilStats.innerHTML = config.stats || '';
  ui.veilAction.textContent = config.action || 'ДАЛЬШЕ';
  ui.veilSecond.textContent = config.second || '';
  ui.veilSecond.hidden = !config.second;
  ui.veilCode.hidden = !config.code;
  if (config.code) ui.codeBox.value = config.code;

  ui.veilScore.hidden = !config.result;
  if (config.result) fillScore(config.result, config.best, config.record);

  ui.veilShare.hidden = !config.share;
  if (config.share) {
    ui.nickBox.value = readNick();
    refreshLink();
  }
  ui.veil.hidden = false;
  ui.veil.dataset.tone = config.tone || 'call';
  audio.setMenu(true);
}

function hideVeil() {
  ui.veil.hidden = true;
  audio.setMenu(false);
}

/*
 * Разбор забега. Строки приходят из score.js уже посчитанными — здесь
 * только вёрстка, чтобы правила начисления жили в одном месте.
 */
function fillScore(final, best, record) {
  ui.veilScore.dataset.rank = final.rank;
  ui.rankLetter.textContent = final.rank;

  ui.scoreLines.innerHTML = final.lines
    .map((line) => `<li><span>${line.label}</span><b>${line.value ? '+' + line.value : '—'}</b></li>`)
    .join('');

  ui.scoreTotal.textContent = final.total;

  if (record) {
    ui.scoreBest.textContent = 'НОВЫЙ РЕКОРД ЭТАЖА';
    ui.scoreBest.dataset.record = '1';
  } else if (best) {
    ui.scoreBest.textContent = `ЛУЧШЕЕ: ${best.total} · РАНГ ${best.rank}`;
    ui.scoreBest.dataset.record = '0';
  } else {
    ui.scoreBest.textContent = '';
    ui.scoreBest.dataset.record = '0';
  }
}

function setToast(text, seconds = 2) {
  ui.toast.textContent = text;
  ui.toast.hidden = false;
  toastTimer = seconds;
}

/*
 * Подсказка перечисляет только то, что этаж даёт. Перечислять все пять
 * стихий на этаже, где их две, — верный способ научить человека жать
 * кнопки, которые молчат.
 */
/* Пальцем играют или клавишами — от этого зависит каждая подсказка в игре.
   Одна дверь на все места, где это надо знать. */
function byTouch() {
  return input.isTouch() || matchMedia('(pointer: coarse)').matches;
}

/*
 * Что этаж даёт прямо сейчас. С 03.10 стихии выдаются и посреди этажа
 * («Лестница»), поэтому спрашивать надо мир, а не уровень: уровень
 * помнит только то, что было дано на старте.
 */
function givenNow() {
  return (world && world.elements) || level.elements || ELEMENT_ORDER;
}

function controlsHint() {
  const given = ELEMENT_ORDER.filter((id) => givenNow().includes(id))
    .map((id) => `${ELEMENTS[id].key} ${ELEMENTS[id].name}`)
    .join(' ');

  /* Камера изометрии — одной фразой в конце, только там, где она есть. */
  const cameraHint = !renderer.iso ? ''
    : byTouch() ? ' КНОПКИ ⟲ ⟳ ПОВОРАЧИВАЮТ КАМЕРУ, + − ПРИБЛИЖАЮТ, 0 — ОБЩИЙ ПЛАН.'
      : ' [ ] ПОВОРАЧИВАЮТ КАМЕРУ, КОЛЕСО ИЛИ − = ПРИБЛИЖАЮТ, 0 — ОБЩИЙ ПЛАН.';

  /* Монета — только там, где она есть («Башня»). */
  const coinHint = !level.coins ? ''
    : byTouch() ? ' МОНЕТА В РЯДУ КНОПОК: НАЖМИ, ПОТОМ ТАПНИ, КУДА, — ЗВОН УВОДИТ СТРАЖУ.'
      : ' E — МОНЕТА ПОД МЫШЬ ИЛИ ПО ПРИЦЕЛУ: ЗВОН УВОДИТ СТРАЖУ.';

  /* Жители и задания — только там, где они есть («Башня», слой «г»). */
  const talkHint = !level.residents ? ''
    : byTouch() ? ' ГОВОРИТЬ — КНОПКА В РЯДУ, КОГДА РЯДОМ ЖИТЕЛЬ С «…» НАД ГОЛОВОЙ; ЗАДАНИЯ — КНОПКА РЯДОМ С КНИГОЙ.'
      : ` ${TALK_KEY} — ГОВОРИТЬ С ЖИТЕЛЕМ («…» НАД ГОЛОВОЙ), 1 2 3 — ОТВЕТ, ${LOG_KEY} — ЗАДАНИЯ.`;

  return (byTouch()
    ? 'ЛЕВЫЙ ПАЛЕЦ ПО ПОЛЮ ВЕДЁТ, ПРАВЫЙ ЦЕЛИТ И БЬЁТ САМ. '
      + 'КНОПКИ ВНИЗУ НАБИРАЮТ СТИХИИ, БОЛЬШАЯ ВЫПУСКАЕТ.'
    : `WASD — ИДТИ. СТИХИИ: ${given} — ИЛИ МЫШЬЮ ПО КНОПКАМ ВНИЗУ. `
      + 'КЛИК ПО БОЧКЕ ИЛИ ВРАГУ НАВОДИТ НА НЕГО, TAB МЕНЯЕТ ЦЕЛЬ ПО КРУГУ, '
      + 'КЛИК ПО ПУСТОМУ МЕСТУ СНИМАЕТ. ПРОБЕЛ ИЛИ ПУСК ВЫПУСКАЕТ, Q СБРАСЫВАЕТ. '
      + 'СОСТАВ РЕШАЕТ, ЧТО ВЫЛЕТИТ, ПОРЯДОК — КАКОЙ ФОРМЫ. B — КНИГА, R — ЗАНОВО.') + coinHint + talkHint + cameraHint;
}

/*
 * Панель пяти клавиш. Подписи берутся из самих стихий, поэтому смена
 * раскладки не требует править разметку: молния переехала со слэша на
 * шифт — панель узнала об этом сама.
 *
 * Недоступное на этаже тушится, а не прячется: игрок должен видеть, что
 * стихий пять, и какие ещё впереди. Обещания тут нет — по такой кнопке
 * сразу видно, что она закрыта.
 */
function syncElementButtons() {
  const given = givenNow();

  for (const id of ELEMENT_ORDER) {
    const button = $(`btn-${id}`);
    if (!button) continue;

    const element = ELEMENTS[id];
    const open = given.includes(id);

    button.innerHTML = `<b>${element.key}</b><i>${element.name}</i>`;
    button.style.color = open ? element.colour : '#8fa39b';
    button.dataset.locked = open ? '0' : '1';
    button.disabled = !open;
  }
}

/* Подсветка нажатой стихии: набирается — горит. Иначе панель остаётся
   картинкой, а она должна отвечать. */
function markCharging() {
  const charging = world && world.player.alive ? world.player.charging : null;
  for (const id of ELEMENT_ORDER) {
    const button = $(`btn-${id}`);
    if (button) button.dataset.active = id === charging ? '1' : '0';
  }
}

/*
 * Находка объявляется крупно и по центру. Всё остальное в этой игре можно
 * прочитать потом в книге; новое заклинание — единственное, что надо
 * заметить сейчас, иначе игрок так и не узнает, что нашёл его.
 */
function showFound(kicker, name, note, colour) {
  ui.foundKicker.textContent = kicker;
  ui.foundName.textContent = name;
  ui.foundName.style.color = colour;
  ui.foundNote.textContent = note || '';
  ui.found.hidden = false;

  /* Пересборка анимации: без неё вторая находка подряд не «щёлкает». */
  ui.found.style.animation = 'none';
  void ui.found.offsetWidth;
  ui.found.style.animation = '';

  foundTimer = 2.6;
}


/* =========================================================
   ЗАПУСК ЭТАЖА
   ========================================================= */

function startLevel(next, { silent } = {}) {
  const changed = next && next !== level;
  level = next || level;
  if (changed || !levelCode) levelCode = encode(level);

  world = createWorld(level);
  syncElementButtons();
  tutorStart();
  view = { x: world.player.x, y: world.player.y };
  renderer.invalidate();
  scene = 'play';
  hideVeil();
  attempts += 1;
  result = null;
  locked = null;
  picked = null;
  score = createScore(level, attempts);
  if (!silent) audio.playTrack(level.track || 0);

  trace = createTrace();

  /* Начало попытки. Номер попытки здесь важнее всего остального: он и
     отвечает на вопрос, сколько раз человек готов вернуться. */
  pulse('etazh-nachat', { etazh: level.title, popytka: attempts });

  guide = createGuide({ touch: byTouch });
  meter = createLadderMeter();
  needs = createNeeds();
  coinArmed = false;
  coinPoint = null;
  coinStickUsed = false;
  successUntil = 0;
  pendingSay = null;
  pendingLeave = false;
  tracked = null;
  hideLog();
  if (level.ladder) {
    pulse('lestnica_start', { popytka: attempts });
    /* Первая ступень — огонь в руке с порога. Подсказка говорит, что с
       ним делать здесь, и уйдёт, как только ворота сгорят. */
    setToast(guide.start('fire', world), 5);
  }
  updateHud(true);
  syncTalk();
}

function callScreen() {
  scene = 'call';
  const best = readBest(levelCode);

  showVeil({
    tone: 'call',
    kicker: 'СООБЩЕНИЕ · 03:14',
    title: level.title,
    text: level.call,
    stats: `<span>${controlsHint()}</span>`
      + (best ? `<span>ЛУЧШЕЕ ЗДЕСЬ: ${best.total} · РАНГ ${best.rank} · ${formatTime(best.time)}</span>` : '')
      /* Выключенный звук переживает перезагрузку, и молчащая игра выглядит
         сломанной. Пусть об этом будет сказано там, где на это смотрят. */
      + (audio.isMuted() ? '<span data-warn="1">ЗВУК ВЫКЛЮЧЕН — КЛАВИША M ВКЛЮЧАЕТ</span>' : ''),
    action: 'ВЗЯТЬ КЛЮЧИ',
  });
}

function deathScreen() {
  scene = 'dead';

  /*
   * Смерть от своей же руки — не то же самое, что смерть от чужой, и
   * называться должна иначе. Считаем своей ту, что случилась в пределах
   * пары секунд после собственного пожара или своего разряда: дальше это
   * уже совпадение, а не причина.
   */
  const ownDeath = selfHarm && world.time - selfHarm.at < 2.5 ? selfHarm.kind : null;
  selfHarm = null;

  /* Смерть с числами: сколько успел вырезать и сколько прожил. По ним
     видно разницу между «не понял управление» и «не хватило чуть-чуть». */
  pulse('smert', {
    etazh: level.title,
    popytka: attempts,
    vyrezano: world.kills,
    vsego: world.total,
    sekund: Math.round(world.time),
  });
  showVeil({
    tone: 'dead',
    kicker: `ПОПЫТКА ${attempts}`,
    title: ownDeath ? 'САМ' : 'ТЕБЯ УБИЛИ',
    text: ownDeath
      ? (ownDeath === 'fire'
        ? 'Ты сгорел в своём собственном костре. Огонь не смотрит, кто его позвал: он просто идёт по соломе дальше — и по тебе тоже.'
        : 'Ты сам разлил воду, сам в неё встал и сам пустил по ней разряд. Ток не спрашивает, чья лужа.')
      : 'Здесь умирают с одного удара — и ты, и они. Разница только в том, кто ударил первым.',
    stats: `<span>ВЫРЕЗАНО ${world.kills} ИЗ ${world.total}</span><span>${formatTime(world.time)}</span>`
      + `<span>СГОРЕЛО ОЧКОВ: ${score.state.score}</span>`,
    action: 'ЗАНОВО',
  });
}

function hasNextFloor() {
  return !custom && levelIndex + 1 < CAMPAIGN.length;
}

function clearScreen() {
  scene = 'clear';

  result = score.finish(world);

  if (level.ladder) {
    /* «Башня» — не операция с заложником: строк про человека и мирных
       тут нет, потому что их нет на этаже. Есть путь и время. */
    const facts = operationResult(world);
    showVeil({
      tone: 'clear',
      kicker: 'БАШНЯ ВЗЯТА',
      title: 'ЯДРО ВЫНЕСЕНО',
      text: 'Одна рука, две, три — и каждая пришла там, где без неё было не пройти. Тот же ров берётся льдом, грязью или камнем, та же башня — боем, тихо или хитростью.',
      stats: `<span>ПУТЬ: ${ROUTE_NAMES[world.route] || '—'}</span>`
        + `<span>ВРЕМЯ ${formatTime(world.time)} · ПОПЫТОК ${attempts}</span>`
        + `<span>ОХРАНА: ДЕЙСТВУЕТ ${facts.guardsActive} · БЕЗ СОЗНАНИЯ ${facts.guardsUnconscious} · ПОГИБЛА ${facts.guardsDead}</span>`
        + `<span>ШУМНЫЕ ИНЦИДЕНТЫ ${facts.alerts}</span>`,
      action: 'ЕЩЁ РАЗ',
      second: 'СТАРЫЕ ЭТАЖИ',
    });
    return;
  }

  if (world.operation) {
    const facts = operationResult(world);
    const grade = operationGrade(facts);
    const hostage = facts.hostage === 'rescued' ? 'СПАСЁН'
      : facts.hostage === 'dead' ? 'ПОГИБ' : 'ОСТАВЛЕН';
    showVeil({
      tone: 'clear',
      kicker: `ОПЕРАЦИЯ ЗАВЕРШЕНА · РАНГ ${grade.rank}`,
      title: grade.title,
      text: 'Мир запомнил не способ, а последствия. Лучший результат — забрать ядро, вывести человека и не превращать объект в кладбище.',
      stats: `<span>ЗАЛОЖНИК: ${hostage}</span>`
        + `<span>МИРНЫЕ: ЖИВЫ ${facts.civiliansAlive} · ПОГИБЛИ ${facts.civiliansDead}</span>`
        + `<span>ОХРАНА: ДЕЙСТВУЕТ ${facts.guardsActive} · БЕЗ СОЗНАНИЯ ${facts.guardsUnconscious} · ПОГИБЛА ${facts.guardsDead}</span>`
        + `<span>ШУМНЫЕ ИНЦИДЕНТЫ ${facts.alerts} · ВРЕМЯ ${formatTime(facts.time)}</span>`,
      action: 'ЕЩЁ РАЗ',
      second: 'СТАРЫЕ ЭТАЖИ',
    });
    return;
  }

  pulse('etazh-zachischen', {
    etazh: level.title,
    popytka: attempts,
    sekund: Math.round(world.time),
    rang: result.rank,

    /*
     * След решения. Отвечает не на «прошёл ли», а на «чем прошёл», и
     * только он позволяет посчитать, сколькими разными способами комнату
     * проходят. Про человека в нём нет ничего.
     */
    sled: traceKey(trace),
    pravil: trace.rules.size,
    chem: traceDelivery(trace),
  });
  const record = writeBest(levelCode, result, world.time);
  const more = hasNextFloor();

  /* Вызов принят или нет — это первое, что должно быть видно на экране. */
  const duel = compare({ time: world.time, score: result.total }, challenge);
  const verdict = duel
    ? (duel.beaten
      ? `ВЫЗОВ ПРИНЯТ: БЫСТРЕЕ ${challenge.nick} НА ${formatTime(duel.delta)}`
      : `${challenge.nick} ВСЁ ЕЩЁ БЫСТРЕЕ НА ${formatTime(duel.delta)}`)
    : '';

  showVeil({
    tone: 'clear',
    kicker: duel ? (duel.beaten ? 'ВЫЗОВ ОТБИТ' : 'ВЫЗОВ НЕ ВЗЯТ') : 'ЭТАЖ СДАН',
    title: duel ? (duel.beaten ? 'ТЫ БЫСТРЕЕ' : 'ПОКА МЕДЛЕННЕЕ') : (more ? 'СЛЕДУЮЩЕЕ СООБЩЕНИЕ' : 'ТИХО'),
    text: duel
      ? 'Отправь ссылку обратно — в ней твой результат и тот же самый этаж.'
      : (more
        ? 'Автоответчик уже мигает. Очки платят за темп: цепочка обрывается через четыре секунды без убийства.'
        : 'Этаж сдан. Отправь его кому-нибудь: ссылка несёт и уровень, и твоё время.'),
    stats: `<span>ВРЕМЯ ${formatTime(world.time)}</span><span>ПОПЫТОК ${attempts}</span>`
      + (verdict ? `<span>${verdict}</span>` : ''),
    share: true,
    action: more ? 'СЛЕДУЮЩИЙ ЭТАЖ' : 'ПРОЙТИ ЧИЩЕ',
    second: more ? 'ПРОЙТИ ЭТОТ ЧИЩЕ' : 'ВЫЙТИ В МЕНЮ',
    result,
    best: record.best,
    record: record.record,
  });
}

function pauseScreen() {
  scene = 'pause';
  /* Этаж, чьи правила не живут в коде («Башня»: ступени, цепи, вечный
     огонь), кодом не предлагается: по нему открылась бы карта без
     лестницы, то есть другой этаж под тем же именем. */
  const shareable = level.shareable !== false;
  showVeil({
    tone: 'pause',
    kicker: 'ПАУЗА',
    title: level.title,
    text: shareable
      ? 'Этаж целиком помещается в эту строку. Скопируй её — и тот, кому дашь, откроет ровно этот же этаж.'
      : 'Этот этаж открывается адресом, а не кодом: его ступени живут в игре, а не в строке.',
    stats: `<span>${controlsHint()}</span>`,
    action: 'ПРОДОЛЖИТЬ',
    second: 'НАЧАТЬ ЭТАЖ ЗАНОВО',
    code: shareable ? levelCode : '',
  });
}

function formatTime(seconds) {
  const total = Math.floor(seconds * 10) / 10;
  const minutes = Math.floor(total / 60);
  const rest = (total - minutes * 60).toFixed(1).padStart(4, '0');
  return `${minutes}:${rest}`;
}


/* =========================================================
   ИЗОМЕТРИЯ: ЭКРАН → МИР
   =========================================================
   Плоский вид смотрит на мир сверху, и экран с миром совпадают: W — на
   север, стик вправо — на восток. В изометрии камера повёрнута (и её
   можно крутить), поэтому сырой ввод переводится в мир здесь, до
   buildIntent, — дальше всё как было: прицел, автонаводка, keyboardAim
   получают направления уже в мире. Как переводится — src/view3d/vvod.js
   (клавиши по осям экрана, палец — с поправкой на сжатие пола), проверка —
   tests/vid-vvod.mjs. Мышь и тап переводит сама отрисовка (toWorld).

   Клавиши камеры — тоже здесь, через тот же input.tookKey, что у игры:
   ни одна из них игрой не занята (проверка — там же).
   ========================================================= */

function isoInput(raw) {
  if (!renderer.iso) return;
  if (raw.moveX || raw.moveY) {
    const fromStick = Boolean(raw.sticks && raw.sticks.move.active);
    [raw.moveX, raw.moveY] = renderer.screenMove(raw.moveX, raw.moveY, fromStick);
  }
  if (raw.aimStick !== null) raw.aimStick = renderer.screenAngle(raw.aimStick);
  for (const [code, act] of Object.entries(CAMERA_KEYS)) {
    if (input.tookKey(code)) renderer.cameraAct(act);
  }
}


/* =========================================================
   ПРИЦЕЛ
   ========================================================= */

function buildIntent(raw) {
  const player = world.player;
  const intent = {
    moveX: raw.moveX,
    moveY: raw.moveY,
    aimAngle: null,
    attack: false,
    charge: null,
    /* Сброс набранного: время потрачено, но выпустить не туда — хуже. */
    dump: input.tookKey('KeyQ') || input.tookKey('Backspace'),
  };

  /*
   * Забираем все три нажатия, а не первое: иначе непрочитанное всплывёт
   * кадром позже. Цифры при открытой полосе разговора — ответы, а не
   * стихии (zhiteli-vid.js, keyRoute; проверка — tests/sloy-g-vid.mjs):
   * стрелки и ⇧ набирают и тогда — мир при разговоре не стоит.
   */
  const talking = talkNow(world);
  for (const code of Object.keys(CHARGE_KEYS)) {
    if (!input.tookKey(code)) continue;
    const routed = keyRoute(code, talking, CHARGE_KEYS);
    if (routed && routed.say) intent.say = routed.say;
    else if (routed && routed.charge) intent.charge = routed.charge;
  }
  talkIntent(intent, talking);

  /* Монета — до тапа: взведённая забирает тап себе («куда»), а не на
     выбор цели. */
  coinIntent(raw, intent);

  /*
   * Тап и клик по полю выбирают цель — то же, что Tab, только сразу в
   * нужную, а не по кругу. Промах по пустому месту снимает выбор: иначе
   * от навязанной цели нельзя было бы избавиться, не убив её.
   */
  const tapped = input.tookTap();
  if (tapped) {
    const at = renderer.toWorld(tapped.x, tapped.y, lastView);
    const target = targetNear(world, at.x, at.y);
    if (target) {
      picked = target;
      audio.sfx('spot');
    } else {
      picked = null;
    }
  }

  /* Мёртвое и разбитое перестаёт быть целью само — но подменять его на
     соседнее нельзя: выбор делал игрок. */
  if (picked && picked.alive === false) picked = null;
  if (picked) picked = keepPicked(world, picked);

  let stickHint = null;
  if (raw.aimStick !== null) {
    /* Стик — это прямое прицеливание рукой, и оно главнее выбранной цели.
       Цель подсказки в конусе стика (лампа совета «свет», щиток поля)
       главнее стражей рядом с ней — aim.js, stickAim. */
    picked = null;
    locked = null;
    world.locked = null;
    const aimed = stickAim(world, raw.aimStick);
    intent.aimAngle = aimed.angle;
    stickHint = aimed.hint;
  } else if (picked) {
    /*
     * Выбранная руками цель держится, чем бы игрок ни водил. Раньше её
     * стирало любое движение мыши — то есть на настольном компьютере
     * выбор не работал вовсе, ни тапом, ни клавишей: следующий же кадр
     * возвращал прицел под курсор.
     */
    locked = picked;
    world.locked = picked;
    intent.aimAngle = Math.atan2(picked.y - player.y, picked.x - player.x);
  } else if (!raw.touch && raw.mouse.moved) {
    locked = null;
    world.locked = null;
    /* Курсор показывает на ромб, а мир считает по квадрату: перевод знает
       только отрисовка, у неё и спрашиваем. */
    const at = renderer.toWorld(raw.mouse.x, raw.mouse.y, lastView);
    intent.aimAngle = assistAim(world, Math.atan2(at.y - player.y, at.x - player.x), AIM_CONE.mouse);
  } else {
    /*
     * Мышь не трогают — значит, играют с клавиатуры, и прицел держится за
     * живую цель сам. Бежать при этом можно куда угодно: направление бега
     * больше не решает, куда смотрит игрок.
     */
    /* Правило целиком в aim.js (keyboardAim): там же цель подсказки —
       щиток поля, пока жива тройная ступень «Лестницы», — и прогон в
       Node зовёт ту же дверь. Без подсказки поведение прежнее. */
    const aim = keyboardAim(world, locked, player.angle, raw.moveX, raw.moveY);
    locked = aim.locked;
    world.locked = locked;
    intent.aimAngle = aim.angle;
  }

  /* Удержание — это очередь ударов, а не один: темп задаёт откат оружия. */
  const fired = input.tookKey('Fire') || input.tookKey('Space')
    || input.tookKey('Enter') || input.tookKey('KeyJ');
  intent.attack = fired || raw.attackHeld;

  /*
   * Палец не умеет одновременно целиться стиком и жать кнопку: это один и
   * тот же большой палец. Поэтому наведённый на цель стик бьёт сам —
   * но только когда цель действительно под прицелом, иначе обойма
   * уходит в стену за две секунды.
   */
  if (!intent.attack && raw.aimStick !== null && intent.aimAngle !== null && !coinArmed) {
    /* По цели подсказки — только когда в руке есть что выпускать: пустой
       выпуск дал бы «СНАЧАЛА НАБЕРИ» поверх строки успеха (прогон 03.10). */
    intent.attack = hasTargetUnderAim(world, intent.aimAngle) || Boolean(stickHint && player.stack.length);
  }

  /* Клик, которым бросили монету, — не удар, пока кнопка мыши зажата. */
  if (coinClickHold) {
    if (raw.mouse.down) intent.attack = false;
    else coinClickHold = false;
  }

  return intent;
}

/*
 * РАЗГОВОР: F или кнопка ГОВОРИТЬ — заговорить с тем, кто в дальности
 * (talkTarget), а при открытой полосе — уйти; рядом никого — сказать, к
 * кому подходить, а не молчать (п.10). Нажатое на полосе пальцем или
 * мышью (pendingSay, pendingLeave) уходит в мир здесь же.
 */
function talkIntent(intent, talking) {
  if (!world.zhiteli) return;
  if (input.tookKey('KeyF') || input.tookKey('Talk')) {
    if (talking) intent.talkEnd = true;
    else {
      const id = talkTarget(world);
      if (id) intent.talk = id;
      else setToast(NOBODY, 2);
    }
  }
  if (pendingLeave) { intent.talkEnd = true; pendingLeave = false; }
  if (pendingSay) {
    if (talking) intent.say = pendingSay;
    pendingSay = null;
  }
}

/*
 * МОНЕТА: из нажатий — намерение `throwCoin` (точка мира), которое мир
 * исполняет сам (world.js → moneta.js). Точку считает vidimost.js:
 * дальность МГС, а место падения — шагами moneta.js, и пунктир на поле
 * показывает именно его (world.coinAim, рисуют обе отрисовки).
 */
function coinIntent(raw, intent) {
  if (!world.coins) { world.coinAim = null; return; }
  const player = world.player;
  const mousePoint = () => (!raw.touch && raw.mouse.moved ? renderer.toWorld(raw.mouse.x, raw.mouse.y, lastView) : null);
  const throwAt = (target) => {
    intent.throwCoin = target;
    coinArmed = false;
    coinPoint = null;
    coinStickUsed = false;
  };

  const key = input.tookKey('KeyE');
  const button = input.tookKey('Coin');

  if (key) {
    /* E — сразу. Монет нет — бросок всё равно уходит в мир: тот ответит
       событием coin-empty, и игрок услышит «монет нет», а не тишину. */
    throwAt(coinTarget(world, { point: coinPoint || mousePoint(), angle: player.angle }));
  } else if (button && coinArmed) {
    throwAt(coinPoint || coinTarget(world, { angle: player.angle }));
  } else if (button) {
    if (world.coinsLeft <= 0) {
      throwAt(coinTarget(world, { angle: player.angle }));
    } else {
      coinArmed = true;
      coinPoint = null;
      coinStickUsed = false;
      setToast(byTouch()
        ? 'МОНЕТА: ТАПНИ, КУДА БРОСИТЬ, ИЛИ ВЕДИ ПРАВЫМ ПАЛЬЦЕМ И ОТПУСТИ'
        : 'МОНЕТА: КЛИКНИ, КУДА БРОСИТЬ, ИЛИ НАЖМИ ЕЩЁ РАЗ — ПО ПУНКТИРУ', 2.6);
    }
  }

  if (coinArmed) {
    const tap = input.tookTap();
    if (tap) {
      /* Тап или клик по полю — туда. Клик заодно нажал «удар»: снимаем. */
      throwAt(coinTarget(world, { point: renderer.toWorld(tap.x, tap.y, lastView) }));
      input.tookKey('Fire');
      coinClickHold = true;
    } else if (raw.aimStick !== null) {
      const stick = raw.sticks.aim;
      const frac = Math.min(1, Math.hypot(stick.dx, stick.dy) / STICK_RANGE);
      coinPoint = coinTarget(world, { angle: raw.aimStick, frac });
      coinStickUsed = true;
    } else if (coinStickUsed) {
      /* Правый палец отпущен — бросок туда, куда он показывал. */
      throwAt(coinPoint);
    } else {
      const point = mousePoint();
      coinPoint = point ? coinTarget(world, { point }) : null;
    }
  }

  world.coinAim = coinArmed
    ? coinLanding(world, coinPoint || coinTarget(world, { angle: player.angle }))
    : null;
}

/* Кнопка монеты: есть ли на этаже, сколько в кармане, взведена ли. */
function syncCoinButton() {
  if (!ui.coin) return;
  const has = Boolean(world && world.coins);
  if (ui.coin.hidden === has) ui.coin.hidden = !has;
  ui.daemons.dataset.coin = has ? '1' : '0';
  if (!has) return;
  const label = coinArmed ? 'КУДА?' : `МОНЕТА ×${world.coinsLeft}`;
  /*
   * Меняется только текст, а не разметка. Палец, нажавший кнопку, лежит
   * на её подписи; замени innerHTML — и подпись, на которой начато
   * касание, уходит из документа, touchend до кнопки не доходит, и она
   * так и остаётся «нажатой» (поймано прогоном на 390×844).
   */
  if (!ui.coin.firstElementChild) ui.coin.innerHTML = `<b>${COIN_KEY}</b><i></i>`;
  const text = ui.coin.lastElementChild;
  if (text.textContent !== label) text.textContent = label;
  ui.coin.dataset.armed = coinArmed ? '1' : '0';
  ui.coin.dataset.empty = world.coinsLeft > 0 ? '0' : '1';
}

/* =========================================================
   РАЗГОВОР НА ЭКРАНЕ (слой «г»)
   =========================================================
   Каждый кадр: кнопка ГОВОРИТЬ в ряду стихий (тусклая — рядом никого,
   горит — житель в дальности, «УЙТИ» — идёт разговор), подпись у героя
   (world.talkPrompt — рисуют обе отрисовки), полоса разговора и цель
   ведомого задания для стрелки у края (world.questPin). Всё это —
   данные экрана в мире, как world.coinAim и world.locked: правила мира
   их не читают.
   ========================================================= */

function syncTalk() {
  const has = Boolean(world && world.zhiteli);
  if (ui.talkBtn.hidden === has) ui.talkBtn.hidden = !has;
  if (ui.questOpen.hidden === has) ui.questOpen.hidden = !has;
  ui.daemons.dataset.talk = has ? '1' : '0';
  if (!has) {
    if (world) { world.talkPrompt = null; world.talkNear = null; world.questPin = null; }
    renderTalk(null);
    return;
  }

  const view = talkNow(world);
  const near = view || !world.player.alive || world.state !== 'play' ? null : talkTarget(world);
  world.talkNear = near;
  world.talkPrompt = near ? { id: near, text: talkPrompt(RESIDENT_NAMES[near] || near, byTouch()) } : null;

  /* Текст кнопки меняется, а разметка — нет: палец, начавший касание на
     подписи, иначе терял бы touchend (как у монеты, syncCoinButton). */
  if (!ui.talkBtn.firstElementChild) ui.talkBtn.innerHTML = `<b>${TALK_KEY}</b><i></i>`;
  const label = view ? 'УЙТИ' : 'ГОВОРИТЬ';
  const text = ui.talkBtn.lastElementChild;
  if (text.textContent !== label) text.textContent = label;
  const nearFlag = view || near ? '1' : '0';
  if (ui.talkBtn.dataset.near !== nearFlag) ui.talkBtn.dataset.near = nearFlag;
  const armed = view ? '1' : '0';
  if (ui.talkBtn.dataset.armed !== armed) ui.talkBtn.dataset.armed = armed;

  renderTalk(view);
  world.questPin = tracked ? questTarget(world, tracked) : null;
}

function choiceButton(key, label, onPress, leave = false) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = leave ? 'talk-choice talk-leave' : 'talk-choice';
  const b = document.createElement('b');
  b.textContent = key;
  const span = document.createElement('span');
  span.textContent = label;
  button.append(b, span);
  button.addEventListener('click', (event) => {
    onPress();
    audio.sfx('ui');
    /* Фокус снимается: иначе пробел (выпуск) нажимал бы эту кнопку снова. */
    event.currentTarget.blur();
  });
  return button;
}

/*
 * Полоса: имя, строка, ответы 1–3 и УЙТИ. Перестраивается только когда
 * сменилась реплика; пока свидетель слушает — сколько ещё (6 с,
 * zhiteli.js WITNESS_PATIENCE). Где у неё верх — в --talk-top: тост на
 * это время встаёт над полосой (style.css, body.is-talking).
 */
function renderTalk(view) {
  if (!view) {
    if (!ui.talk.hidden) {
      ui.talk.hidden = true;
      document.body.classList.remove('is-talking');
    }
    talkShown = '';
    return;
  }
  const key = `${view.with}|${view.node}|${view.line}|${view.choices.map((c) => c.id).join(',')}`;
  if (key !== talkShown) {
    talkShown = key;
    ui.talkName.textContent = view.name;
    ui.talkLine.textContent = view.line;
    ui.talkChoices.textContent = '';
    view.choices.forEach((choice, i) => {
      ui.talkChoices.append(choiceButton(String(i + 1), choice.text, () => { pendingSay = choice.id; }));
    });
    ui.talkChoices.append(choiceButton(TALK_KEY, 'УЙТИ', () => { pendingLeave = true; }, true));
  }
  if (ui.talk.hidden) {
    ui.talk.hidden = false;
    document.body.classList.add('is-talking');
  }
  const wait = patienceLeft(world);
  const waitText = wait === null ? '' : `СЛУШАЕТ ЕЩЁ ${wait} С`;
  if (ui.talkWait.textContent !== waitText) ui.talkWait.textContent = waitText;
  if (ui.talkWait.hidden === Boolean(waitText)) ui.talkWait.hidden = !waitText;
  const top = `${Math.round(window.innerHeight - ui.talk.getBoundingClientRect().top)}px`;
  if (document.body.style.getPropertyValue('--talk-top') !== top) document.body.style.setProperty('--talk-top', top);
}

/* =========================================================
   ЖУРНАЛ ЗАДАНИЙ (слой «г»)
   =========================================================
   Как книга: слоем поверх, мир на это время стоит. Только то, что
   игрок взял; у взятого — следующий шаг словами жителя и ВЕСТИ:
   стрелка у края экрана (ukazatel.js) поведёт к молоту, клетке или
   кузнецу. Счётчик не трогается: взятие и сдача заданий уже уходят
   через ladderPulses (lestnica.js, questPulse).
   ========================================================= */

const STATE_SHORT = { vzyato: 'ВЗЯТО', sdelano: 'СДЕЛАНО', provaleno: 'ПРОВАЛЕНО' };

function renderLog() {
  if (!world || !world.zhiteli) return;
  const all = questLog(world);
  const known = knownQuests(all);
  ui.zhurnalCount.textContent = `${known.filter((q) => q.state === 'sdelano').length}/${known.length} СДЕЛАНО`;
  ui.zhurnalList.textContent = '';
  for (const q of known) {
    const li = document.createElement('li');
    li.className = 'zhurnal-item';
    li.dataset.state = q.state;
    li.dataset.id = q.id;
    const top = document.createElement('div');
    top.className = 'zhurnal-top';
    const title = document.createElement('b');
    title.textContent = q.must ? `${q.title} · ГЛАВНОЕ` : q.title;
    const state = document.createElement('span');
    state.className = 'zhurnal-state';
    state.textContent = STATE_SHORT[q.state] || q.stateName;
    top.append(title, state);
    const next = document.createElement('p');
    next.className = 'zhurnal-next';
    next.textContent = questNext(world, q);
    const ways = document.createElement('span');
    ways.className = 'zhurnal-ways';
    ways.textContent = `РЕШЕНИЙ ${q.ways.length}: ${q.ways.join(' · ')}`;
    li.append(top, next, ways);
    if (q.state === 'vzyato' && questTarget(world, q.id)) {
      const track = document.createElement('button');
      track.type = 'button';
      track.className = 'zhurnal-track';
      track.dataset.on = tracked === q.id ? '1' : '0';
      track.textContent = tracked === q.id ? 'СТРЕЛКА ВЕДЁТ СЮДА — СНЯТЬ' : 'ВЕСТИ СТРЕЛКОЙ У КРАЯ';
      track.addEventListener('click', () => {
        tracked = tracked === q.id ? null : q.id;
        audio.sfx('ui');
        renderLog();
      });
      li.append(track);
    }
    ui.zhurnalList.append(li);
  }
  const unknown = all.length - known.length;
  ui.zhurnalMore.hidden = !unknown;
  ui.zhurnalMore.textContent = unknown ? `ЕЩЁ ${unknown} — У ЖИТЕЛЕЙ С «…» НАД ГОЛОВОЙ` : '';
}

function showLog() {
  if (!world || !world.zhiteli) return;
  if (tomeVisible) hideTome();
  renderLog();
  ui.zhurnal.hidden = false;
  logVisible = true;
}

function hideLog() {
  ui.zhurnal.hidden = true;
  logVisible = false;
}

function toggleLog() {
  if (logVisible) hideLog();
  else showLog();
}

/* =========================================================
   ОБУЧАЛКА
   =========================================================
   Первый этаж учит не кнопкам, а главному правилу игры:
   стихии работают друг через друга. Огонь вскрывает бочку,
   вода из неё разливается под ногами у врагов, разряд в
   лужу забирает троих разом.

   Подсказки идут по событиям мира, а не по таймеру: игрок
   узнаёт про бочку, когда убил первого, и про молнию —
   когда вода уже на полу. Сказанное заранее не запоминается.
   ========================================================= */

let tutorStep = 0;

/*
 * ОБУЧАЛКА
 * =========================================================
 * Две фразы, и обе в первых двух комнатах. Дальше молчим.
 *
 * Так просил автор дословно: «выстрели в эту точку, чтобы понять, как
 * работает магия; тут собери линию — а потом тебя отпускают в уровень, и
 * там ты уже сам барахтайся». Ключевое слово — отпускают. Подсказка,
 * которая идёт весь этаж, отменяет игру: придумывать нечего, за игрока
 * уже придумали, а предвкушение связки и есть то, ради чего в это играют.
 *
 * Последняя фраза — «ДАЛЬШЕ САМ» — не украшение. Игрок должен знать, что
 * подсказок больше не будет, иначе он будет их ждать и не начнёт пробовать.
 */
/*
 * ПОДКОЛЫ
 * =========================================================
 * Игра про то, как убить всех разом, — и ровно в той же мере про то, как
 * при этом уцелеть. Собственный пожар и своя лужа под током не изъян, а
 * половина тактики, поэтому наказывать за них скучной строкой нельзя:
 * над этим надо смеяться.
 *
 * Первый раз, впрочем, объясняем. Игрок, который горит впервые, не знает,
 * что делать, и шутка вместо инструкции — это издевательство, а не юмор.
 * Дальше объяснять нечего, и слово переходит к насмешке.
 */
const JABS = {
  ignite: [
    'ГОРИШЬ КРАСИВО, НО НЕДОЛГО',
    'ОГОНЬ НЕ РАЗБИРАЕТ, КТО ЕГО ЗВАЛ',
    'ЗАЖИГАЛКА СРАБОТАЛА. НА ТЕБЕ',
    'ТЁПЛО? ЭТО ТЫ',
    'СВОЙ ЖЕ КОСТЁР. ПОЗДРАВЛЯЕМ',
  ],
  shock: [
    'ТОК НЕ СПРАШИВАЕТ, ЧЬЯ ЛУЖА',
    'САМ НАЛИЛ, САМ И ВСТАЛ',
    'ФИЗИКА РАБОТАЕТ В ОБЕ СТОРОНЫ',
    'ГЕНИАЛЬНО. ТЕПЕРЬ ЕЩЁ РАЗ, НО В СТОРОНЕ',
    'ВОДА ПРОВОДИТ. ДАЖЕ ТЕБЯ',
  ],
  sleep: [
    'ДЫШИТ. ЗАПОМНИ, ГДЕ ЛЁГ',
    'МИЛОСЕРДИЕ С ТАЙМЕРОМ',
    'ЖИВОЙ. ЭТО БЫЛ ТВОЙ ВЫБОР',
    'ОДНА СТИХИЯ — ОДИН ОБМОРОК',
    'СПИТ. НЕ ВЕЧНО',
  ],
  wake: [
    'ОТОСПАЛСЯ',
    'ПОДНЯЛСЯ. И НЕ В ДУХЕ',
    'ВСПОМНИЛ ТВОЁ ЛИЦО',
    'ВОТ И ОН',
  ],
  held: [
    'НЕ ВПЕЧАТЛИЛО',
    'ОН ТАКОЕ НА ЗАВТРАК ЕСТ',
    'ИСКРА ЕМУ НЕ СОПЕРНИК — НУЖНО ВЕЩЕСТВО',
    'ЩЕКОТНО. ПОПРОБУЙ СЕРЬЁЗНЕЕ',
  ],
  gust: [
    'ПОЛЕТЕЛ. КУДА — ТВОЁ ДЕЛО',
    'ОДНА СТИХИЯ ТОЛЬКО ДВИГАЕТ',
    'ВЕТЕР ГОТОВИТ, УБИВАЕТ ЧТО-ТО ДРУГОЕ',
    'ТЕПЕРЬ ОН СНАРЯД',
  ],
  slam: [
    'ПРИЛОЖИЛО',
    'СТЕНА ВЫИГРАЛА',
    'ЛЁД ДОВЁЗ',
    'РАЗОГНАЛСЯ И ПРИЕХАЛ',
  ],
  fling: [
    'КЕГЛЯ',
    'ОДНИМ ТЕЛОМ ДВОИХ',
    'ОН ПРИЛЕТЕЛ НЕ ОДИН',
    'БИЛЬЯРД',
  ],
  hack: [
    'У ЩИТКА НИКТО НЕ УСЛЫШАЛ',
    'СОСТАВ ДАЁТ ТОЧНОСТЬ, А НЕ СИЛУ',
    'ЩИТОК ЖИВ — МОЖНО ВЕРНУТЬ ОБРАТНО',
    'НИКОГО ТУДА НЕ ПОЗВАЛО',
  ],
  panel: [
    'ПУСТЬ СХОДЯТ ПОСМОТРЯТ',
    'ИСКРИТ ТАМ. ТЫ ЗДЕСЬ',
    'ЛУЧШИЙ ВЫСТРЕЛ — В СТОРОНУ',
    'ШУМ БЕЗ СВИДЕТЕЛЕЙ',
  ],
  /* Слой «в»: свидетель и толчок. Первая строка — что делать (в коде
     вызова), дальше — короче: правило уже знакомо. */
  witness: [
    'СВИДЕТЕЛЬ БЕЖИТ ДОНОСИТЬ',
    'УВИДЕЛИ. БЕЖИТ К СТРАЖЕ',
    'ЕГО ЕЩЁ МОЖНО ПЕРЕХВАТИТЬ',
  ],
  shove: [
    'СТРАЖА ТОЛКАЕТСЯ В ОТВЕТ',
    'ОТЛЕТЕЛ. ВТОРОЙ РАЗ — ТРЕВОГА',
    'НЕ ТОЛКАЙСЯ С ТЕМ, КТО ПРИ ДУБИНКЕ',
  ],
  backfire: [
    'ВСПЫШКА В ТЕСНОТЕ — ПРИВЕТ ОТ СЕБЯ',
    'РАДИУС БОЛЬШЕ КОМНАТЫ. КАК И ЗАДУМАНО?',
    'ВЗОРВАЛ ВСЕХ. СЕБЯ В ТОМ ЧИСЛЕ',
  ],
};

const jabSeen = {};

/* Чем игрок навредил себе последний раз и когда. Экран смерти
   спрашивает об этом, чтобы не говорить «тебя убили» тому, кто убил
   себя сам: это разные события и разного тона. */
let selfHarm = null;

/* Чем прошли эту попытку. Живёт от начала этажа до его конца. */
let trace = createTrace();

/* Сколько стихий было в очереди на прошлом кадре: по разнице видно, что
   одна только что легла, и её ячейку надо зажечь. */
let landed = 0;

/* Идёт съёмка витрины. Пока не null — игра стоит, а кадр рисует сцена. */
let shooting = null;

function jab(kind, first) {
  const seen = jabSeen[kind] || 0;
  jabSeen[kind] = seen + 1;

  /* Первый раз — что делать. Дальше — что о тебе думают. */
  if (!seen) return first;

  const lines = JABS[kind];
  return lines[Math.floor(Math.random() * lines.length)];
}

const TUTOR_STEPS = [
  {
    on: (event) => event.type === 'kill',
    say: 'СОБЕРИ ЛИНИЮ: ТРИ ОДИНАКОВЫХ — ЛУЧ. ОН ИДЁТ НАСКВОЗЬ',
  },
  {
    on: (event) => event.type === 'crystal',
    say: 'ДАЛЬШЕ САМ',
  },
];

function tutorStart() {
  tutorStep = level.tutorial ? 1 : 0;
  /* Клавиши берутся из самих стихий: раскладка уже переезжала, и вшитый
     в текст слэш пережил бы переезд и врал бы игроку. */
  if (!tutorStep) return;

  setToast(byTouch()
    ? 'ЖМИ ОГОНЬ ВНИЗУ, ПОТОМ ПУСК'
    : `НАБЕРИ ${ELEMENTS.fire.key} ОГОНЬ, ЖМИ ПРОБЕЛ. ${ELEMENTS.bolt.key} — МОЛНИЯ`,
  3.6);
}

function tutorFeed(event) {
  if (!tutorStep) return;

  const step = TUTOR_STEPS[tutorStep - 1];
  if (!step || !step.on(event)) return;

  tutorStep += 1;
  setToast(step.say, 4.2);
}


/* =========================================================
   КНИГА
   ========================================================= */

function renderTome() {
  const pages = bookPages(book);
  const count = bookCount(book);

  ui.tomeCount.textContent =
    `${count.substances}/${count.substancesTotal} · ИМЕННЫХ ${count.signatures}/${count.signaturesTotal}`
    + ` · МИР ${count.observations}/${count.observationsTotal}`;

  /* Счёт попытки — те же числа, что в HUD (updateHud); на телефоне стоя
     в объёмном виде HUD со счётом спрятан, и видны они здесь. */
  if (ui.tomeStats && world) {
    ui.tomeStats.textContent = `ВЫРЕЗАНО ${world.kills}/${world.total} · ВРЕМЯ ${formatTime(world.time)} · СЧЁТ ${score ? score.state.score : 0}`
      + (world.systemic ? ` · СВЯЗЕЙ ${world.systemic.actions}` : '');
  }

  ui.tomeSubstances.innerHTML = pages.substances.map((entry) => {
    const marks = elementMarks(entry.elements)
      .map((element) => `<i style="background:${entry.known ? element.colour : '#4a4358'}"></i>`)
      .join('');

    /* Неоткрытое показывает размер состава: это и есть подсказка, где
       искать, — и единственная, какую книга даёт. */
    const name = entry.known
      ? `<b class="tome-name" style="color:${entry.colour}">${entry.name}</b>`
      : `<b class="tome-name">${'?'.repeat(entry.size + 2)}</b>`;
    const note = entry.known && entry.note
      ? `<span class="tome-note">${entry.note}</span>`
      : '';

    /* Значок только у открытого: закрытая клетка обязана оставаться
       вопросом, а картинка выдала бы ответ раньше времени. */
    const icon = entry.known ? iconTag(entry.name) : '';

    return `<div class="tome-cell" data-known="${entry.known ? 1 : 0}">`
      + `<span class="tome-marks">${marks}</span>${icon}${name}${note}</div>`;
  }).join('');

  /*
   * Заклинание попадает в список, как только известно его вещество: игрок
   * должен видеть, что в ЛАВЕ что-то есть, и искать порядок, а не гадать,
   * существует ли то, что он ищет. Остальные сворачиваются в одну строку —
   * десять одинаковых «???» подряд не сообщают ничего, кроме длины списка.
   */
  const shown = pages.signatures.filter((entry) => entry.known || entry.hinted);
  const rest = pages.signatures.length - shown.length;

  ui.tomeSignatures.innerHTML = shown.map((entry) => {
    if (entry.known) {
      return `<li data-known="1" style="border-left-color:${entry.colour}">`
        + iconTag(entry.name)
        + `<b class="tome-sign" style="color:${entry.colour}">${entry.name}</b> `
        + `<span class="tome-recipe">${entry.substance} · ${entry.form}</span>`
        + `<br><span class="tome-note">${entry.note}</span></li>`;
    }

    return `<li data-known="0" style="border-left-color:${entry.colour}">`
      + `<b class="tome-sign">???</b> `
      + `<span class="tome-recipe">${entry.substance} · ${entry.form}</span>`
      + `<br><span class="tome-note">${entry.formHint}</span></li>`;
  }).join('')
    + (rest
      ? `<li data-known="0"><span class="tome-note">`
        + `ещё ${rest} — их вещества пока не открыты</span></li>`
      : '');

  ui.tomeObservations.innerHTML = pages.observations.map((entry) => (
    entry.known
      ? `<li data-known="1"><b class="tome-sign">${entry.name}</b>`
        + `<br><span class="tome-note">${entry.note}</span></li>`
      : '<li data-known="0"><b class="tome-sign">???</b>'
        + '<br><span class="tome-note">Наблюдай последствия действий.</span></li>'
  )).join('');
}

function showTome() {
  /* Книга — половина игры, и до сих пор неизвестно, открывает ли её
     кто-нибудь вообще. Считаем только сам факт открытия и сколько к тому
     моменту найдено: что именно найдено — это уже про человека. */
  pulse('kniga-otkryta', { naydeno: bookCount(book).substances });

  renderTome();
  ui.tome.hidden = false;
  tomeVisible = true;
}

function hideTome() {
  ui.tome.hidden = true;
  tomeVisible = false;
}

function toggleTome() {
  if (tomeVisible) hideTome();
  else showTome();
}


/* =========================================================
   HUD
   ========================================================= */

function updateHud(force) {
  const player = world.player;

  const player2 = world.player;
  const loaded = spellOf(player2.stack);
  const hands = world.stackLimit || STACK_LIMIT;
  const key = player2.stack.join('') + (player2.charging || '')
    + (player2.chargeLeft > 0 ? Math.round((1 - player2.chargeLeft / CHARGE_STEP) * 6) : '')
    + `/${hands}`;

  if (force || ui.stack.dataset.key !== key) {
    ui.stack.dataset.key = key;
    let slots = '';
    for (let i = 0; i < STACK_LIMIT; i += 1) {
      const element = player2.stack[i];
      if (i >= hands) {
        /*
         * Рука, которой ещё нет. Тушится, а не прячется — по тому же
         * уговору, что и закрытые стихии на кнопках: игрок видит, что
         * ячеек три и две впереди, и ждёт их, а не думает, что очередь
         * сломалась на первой.
         */
        slots += '<i class="is-locked"></i>';
      } else if (element) {
        /*
         * Только что легшая стихия помечается отдельно и вспыхивает.
         * Набор из трёх — это три события, а не одно действие: между
         * ними и живёт предвкушение связки, ради которого в игру играют.
         * Пока ячейка просто оказывалась заполненной, три нажатия
         * читались как одно движение руки.
         */
        const fresh = i === player2.stack.length - 1 && landed === player2.stack.length;
        slots += `<i class="${fresh ? 'is-landed' : ''}" style="background:${colourOf(element)};`
          + `box-shadow:0 0 8px ${colourOf(element)}"></i>`;
      } else if (i === player2.stack.length && player2.chargeLeft > 0) {
        const fill = 1 - player2.chargeLeft / CHARGE_STEP;
        slots += `<i class="is-charging" style="border-color:${colourOf(player2.charging)};`
          + `background:linear-gradient(to top, ${colourOf(player2.charging)} ${Math.round(fill * 100)}%, transparent 0)"></i>`;
      } else {
        slots += '<i></i>';
      }
    }
    ui.stack.innerHTML = slots;

    /*
     * Подпись говорит две разные вещи и потому не молчит никогда: пока
     * стихия набирается — её имя, как только легла — имя формы, которая
     * вылетит. Раньше здесь было пусто ровно в тот момент, когда игрок
     * больше всего хотел знать, что у него в руке.
     */
    if (player2.chargeLeft > 0) {
      ui.form.textContent = `${ELEMENTS[player2.charging].name}…`;
      ui.form.style.color = colourOf(player2.charging);
      ui.form.hidden = false;
    } else if (loaded) {
      /*
       * Две оси набора показываются врозь, потому что и решаются врозь:
       * состав говорит, что вылетит, узор — какой формы. Игрок, видящий
       * «СТУЖА · ВЫДОХ», понимает, что вторая половина зависит от порядка,
       * а первая — нет.
       */
      ui.form.textContent = `${loaded.substance.name} · ${loaded.form.name}`;
      ui.form.style.color = loaded.substance.colour;
      ui.form.hidden = false;
    } else {
      ui.form.hidden = true;
    }
  }

  ui.kills.textContent = `${world.kills}/${world.total}`;
  ui.clock.textContent = formatTime(world.time);

  if (world.operation && level.ladder) {
    /* В «Башне» заложника нет — вместо него строка ступени: сколько рук
       и сколько стихий из пяти уже в руке. */
    ui.operationHud.hidden = false;
    ui.operationGoal.textContent = world.operation.coreTaken
      ? 'ВЕРНУТЬСЯ К ВЫХОДУ' : 'ВЫНЕСТИ ЯДРО';
    /* Тревога МГС (alarm.js) — словом и отсчётом: ТРЕВОГА, ПОИСК 14 С,
       НАСТОРОЖЕ 30 С. Без неё «почему все ходят» оставалось загадкой, а
       распад тревоги — то, чем платят за шум, и его надо видеть. */
    const alarm = world.trevoga;
    const alarmState = alarm && alarm.state !== 'calm' ? alarm.state : '';
    const alarmText = !alarmState ? ''
      : alarmState === 'alert' ? ` · ${ALARM_NAMES.alert}`
        : ` · ${ALARM_NAMES[alarmState]} ${Math.max(1, Math.ceil(alarm.t))} С`;
    const optional = `РУКИ ${world.stackLimit}/${STACK_LIMIT} · СТИХИИ ${world.elements.length}/${ELEMENT_ORDER.length}${alarmText}`;
    if (ui.operationOptional.textContent !== optional) ui.operationOptional.textContent = optional;
    if (ui.operationOptional.dataset.alarm !== alarmState) ui.operationOptional.dataset.alarm = alarmState;
    ui.operationLesson.hidden = true;
  } else if (world.operation) {
    ui.operationHud.hidden = false;
    ui.operationGoal.textContent = world.operation.coreTaken
      ? 'ВЕРНУТЬСЯ К ВЫХОДУ' : 'УКРАСТЬ ЯДРО';
    ui.operationOptional.textContent = !world.hostage?.alive
      ? 'ЗАЛОЖНИК: ПОГИБ' : world.hostage.rescued
        ? 'ЗАЛОЖНИК: СПАСЁН' : world.hostage.released
          ? 'ЗАЛОЖНИК: ДОВЕДИ ДО ВЫХОДА' : 'ЗАЛОЖНИК: ОТКЛЮЧИ ПИТАНИЕ';
    ui.operationLesson.hidden = world.operation.waterLesson;
    ui.operationLesson.textContent = world.operation.candleLesson
      ? 'ЛУЖА ПРОВОДИТ РАЗРЯД ПО ВСЕМ, КТО С НЕЙ СОЕДИНЁН'
      : 'ЗАЖГИ СВЕЧУ ТОЧНО. ШИРОКИЙ ОГОНЬ ЗАДЕНЕТ ВСЁ РЯДОМ';
  } else {
    ui.operationHud.hidden = true;
  }

  /* Прибор видимости (слой «б»): только там, где свет — правило. Текст
     меняется, только когда изменился, — иначе браузер перекладывает HUD
     каждый кадр. */
  /* Два места на один прибор: HUD у очереди рук на компьютере и строка
     под «РУКИ» в шапке операции на телефоне — какое видно, решают стили. */
  const seen = lightLevel(world);
  if (seen && ui.vidno) {
    const cells = `ВИДЯТ С ${Math.max(1, Math.round(seen.cells))} КЛ`;
    const line = `ТЫ ${seen.word} · ${cells}`;
    if (ui.vidno.hidden) ui.vidno.hidden = false;
    if (ui.vidno.dataset.level !== seen.level) ui.vidno.dataset.level = seen.level;
    if (ui.vidnoWord.textContent !== seen.word) ui.vidnoWord.textContent = seen.word;
    if (ui.vidnoCells.textContent !== cells) ui.vidnoCells.textContent = cells;
    if (ui.operationVidno.hidden) ui.operationVidno.hidden = false;
    if (ui.operationVidno.dataset.level !== seen.level) ui.operationVidno.dataset.level = seen.level;
    if (ui.operationVidno.textContent !== line) ui.operationVidno.textContent = line;
  } else if (ui.vidno && !ui.vidno.hidden) {
    ui.vidno.hidden = true;
    ui.operationVidno.hidden = true;
  }

  syncCoinButton();

  const observation = physicalHint(world, picked);
  ui.physicalObservation.textContent = observation;
  ui.physicalObservation.hidden = !observation;

  if (challenge) {
    ui.target.hidden = false;
    ui.targetTime.textContent = `${challenge.nick} ${formatTime(challenge.time)}`;
    ui.target.dataset.late = world.time > challenge.time ? '1' : '0';
  } else if (!ui.target.hidden) {
    ui.target.hidden = true;
  }

  ui.score.textContent = score.state.score;

  if (world.systemic) {
    ui.systemic.hidden = false;
    ui.systemicActions.textContent = world.systemic.actions;
  } else {
    ui.systemic.hidden = true;
  }

  const combo = score.state.combo;
  if (combo > 1) {
    if (ui.combo.hidden || ui.combo.dataset.value !== String(combo)) {
      ui.combo.hidden = false;
      ui.combo.dataset.value = String(combo);
      ui.combo.firstElementChild.textContent = `×${combo}`;
      /* Пересборка анимации: без неё каждое следующее убийство не «щёлкает». */
      ui.combo.style.animation = 'none';
      void ui.combo.offsetWidth;
      ui.combo.style.animation = '';
    }
    ui.combo.lastElementChild.style.transform = `scaleX(${Math.max(0, score.state.comboLeft / 4)})`;
  } else if (!ui.combo.hidden) {
    ui.combo.hidden = true;
    ui.combo.dataset.value = '';
  }
}

/* События слоя «г», у которых есть слово на экране (zhiteli-vid.js). */
const TALK_EVENTS = new Set(['talk-refused', 'talk-close', 'guard-called', 'errand', 'item-taken', 'cell-opened', 'released', 'hushed', 'coins']);
const TALK_SFX = { 'talk-open': 'ui', 'talk-refused': 'dry', 'guard-called': 'spot', 'item-taken': 'pickup', 'cell-opened': 'chain', released: 'exit', hushed: 'pickup', coins: 'pickup' };

function drainEvents() {
  /* Видевший отказал в этом кадре — значит, следующий «страж позван»
     его, а не враньё Мефодия (других зовущих у мира нет). */
  let refusedSaw = false;
  for (const event of world.events) {
    /* След решения собирается здесь же: все правила, какие срабатывают,
       проходят через события, и второго места для этого не нужно. */
    traceEvent(trace, event);

    /* Счётчик «Лестницы» — до любых экранов: выход с ядром ниже уводит
       на итог, и событие, отправленное после, уже некому было бы
       отправить. */
    if (level.ladder) {
      for (const [name, data] of ladderPulses(meter, world, event)) pulse(name, data);
    }

    const name = SFX_BY_EVENT[event.type];
    if (name) audio.sfx(name, event);

    const observation = noteObservation(book, event);
    if (observation) {
      showFound('НАБЛЮДЕНИЕ МИРА', observation.name, observation.note, '#7ffcff');
      audio.sfx('spot');
    }

    if (event.type === 'daemon') {
      /* Очередь ушла в выстрел — метка «только что легла» больше ни к
         чему не относится и должна погаснуть вместе с ней. */
      landed = 0;

      audio.sfx(event.form === 'beam' ? 'beam' : event.form === 'nova' ? 'nova' : 'zap', event);
      if (event.form === 'nova') vibrate(30);

      /*
       * Находка объявляется один раз — в тот момент, когда случилась.
       * Именное заклинание перебивает вещество: если игрок сразу попал в
       * сигнатуру, важнее сказать про неё.
       */
      const found = noteSpell(book, event);
      if (found.signature) {
        showFound('НАЙДЕНО ЗАКЛИНАНИЕ', found.signature.name, found.signature.note, '#ffe14d');
        audio.sfx('spot');
        vibrate([20, 40, 20]);
      } else if (found.substance) {
        showFound('НОВОЕ ВЕЩЕСТВО', found.substance.name,
          found.substance.note, found.substance.colour);
        audio.sfx('pickup');
      }
    } else if (event.type === 'backfire') {
      setToast(jab('backfire', 'ВСПЫШКА В ТЕСНОТЕ — СВОИМ ЖЕ'), 2.4);
    } else if (event.type === 'charge') {
      landed = event.size;
      updateHud(true);
    } else if (event.type === 'gust') {
      /* Ветер один никого не убивает — и сказать это надо ровно один раз,
         иначе игрок решит, что промахнулся. */
      setToast(jab('gust', 'ВЕТЕР НЕ УБИВАЕТ — ОН ОТПРАВЛЯЕТ'), 2);
      vibrate(8);
    } else if (event.type === 'slam') {
      setToast(jab('slam', 'В СТЕНУ. СТЕНА НЕ МЯГЧЕ ЧЕЛОВЕКА'), 1.8);
      vibrate([14, 22]);
    } else if (event.type === 'fling') {
      /* Новый глагол, и о нём надо сказать: врагами можно бросаться. */
      setToast(jab('fling', 'ТЕЛО ТОЖЕ СНАРЯД'), 1.8);
      vibrate([10, 20]);
    } else if (event.type === 'sleep') {
      /*
       * Новый исход, которого игрок раньше не видел: он ударил, враг не
       * умер и при этом не отбился. Без слов это читается как промах,
       * а не как милосердие. Поэтому первая строка несёт факт, а не
       * шутку: не убит; поднимется ли он, сообщает само событие.
       */
      setToast(jab('sleep', event.permanent
        ? 'НЕ УБИТ — БЕЗ СОЗНАНИЯ. НЕ ПОДНИМЕТСЯ'
        : 'НЕ УБИТ — В ОТКЛЮЧКЕ. ЧЕРЕЗ ВРЕМЯ ВСТАНЕТ'), 2.4);
      vibrate(10);
    } else if (event.type === 'wake' && event.subdued) {
      /* Сбитого с ног в ближнем бою не объявляем — он встаёт каждые две
         секунды, и экран превратился бы в ленту. Объявляем только того,
         кого игрок сознательно оставил в живых. */
      setToast(jab('wake', 'ТОТ САМЫЙ. ПОДНЯЛСЯ'), 2);
      vibrate([8, 14]);
    } else if (event.type === 'held') {
      /* Промаха не было — был неподходящий удар, и сказать это надо
         сразу, иначе игрок решит, что игра его обманула. */
      setToast(jab('held', 'ДЕРЖИТ УДАР — НУЖЕН СОСТАВ, ДОРОГАЯ ФОРМА ИЛИ ДОБИВАНИЕ'), 2.2);
      vibrate(12);
    } else if (event.type === 'resist') {
      setToast(`${ELEMENTS[event.element].name} ЕГО НЕ БЕРЁТ — БЕЙ ДРУГИМ`, 1.8);
    } else if (event.type === 'ignite' && event.player) {
      /* У горящего есть полсекунды и один выход — вода. Сказать об этом
         надо ровно один раз и ровно тогда, а не в подсказках перед боем. */
      setToast(jab('ignite', 'ГОРИШЬ — В ВОДУ ИЛИ В ГРЯЗЬ'), 1.6);
      selfHarm = { kind: 'fire', at: world.time };
      vibrate(20);
    } else if (event.type === 'locked') {
      setToast(lockedHint(event.element, event.later), 1.6);
    } else if (event.type === 'stack-full') {
      setToast(stackFullHint(event.limit), 1.6);
    } else if (event.type === 'unlock') {
      /*
       * Ступень пришла. Кнопки и подсказка управления узнают об этом
       * здесь же — они читают мир, но перерисовываются только по зову.
       * Находка объявляется крупно, как новое заклинание: это тоже то,
       * что надо заметить сейчас, а не прочитать потом.
       */
      syncElementButtons();
      updateHud(true);
      if (event.kind === 'element') {
        const element = ELEMENTS[event.element];
        showFound('ОТКРЫТА СТИХИЯ', element.name, `КЛАВИША ${element.key}`, element.colour);
      } else {
        showFound('ОТКРЫТА РУКА', event.size === 2 ? 'ДВЕ СТИХИИ' : 'ТРИ СТИХИИ',
          event.size === 2 ? 'ТЕПЕРЬ ИХ МОЖНО СМЕШАТЬ' : 'ЛУЧ, ПРОБОЙ, ВСПЫШКА', '#ffe14d');
      }
      audio.sfx('pickup');
      const start = guide.start(stepOfUnlock(event), world);
      if (start) setToast(start, 5);
    } else if (event.type === 'plunge' && event.player) {
      setToast('ЛЁД РАСТАЯЛ — ВЫНЕСЛО НА КРАЙ, ТЫ МОКРЫЙ', 2.2);
    } else if (event.type === 'shocked-self') {
      setToast(jab('shock', 'СВОЯ ЖЕ ЛУЖА ПОД ТОКОМ'), 2.4);
      selfHarm = { kind: 'shock', at: world.time };
    } else if (event.type === 'chain' && event.size > 1) {
      /* Цепь — единственное место, где одно нажатие стоит нескольких, и
         число обязано быть на экране: без него игрок не поймёт, что
         сделал что-то большее, чем обычный выстрел. */
      setToast(`ЦЕПЬ ×${event.size}`, 1.8);
      vibrate([15, 25, 15]);
    } else if (event.type === 'consequence') {
      setToast(`СВЯЗЬ ${event.actions} · ${systemicLabel(event.kind)}`, 1.8);
      vibrate(12);
    } else if (event.type === 'barrel') {
      /* Про воду больше не пишем: она теперь растекается на глазах, и
         подпись успевала объявить её раньше, чем она появлялась. */
      setToast('БОЧКА ВСКРЫТА', 1.4);
    } else if (event.type === 'power') {
      setToast(event.on ? 'ПИТАНИЕ ЕСТЬ — СИЛОВЫЕ ЗАКРЫЛИСЬ'
        : `ПИТАНИЯ НЕТ — СИЛОВЫХ ${event.doors} ОТКРЫЛОСЬ`, 2.4);
    } else if (event.type === 'panel') {
      /* Первый шум, который звучит не там, где игрок. Сказать об этом
         надо один раз: дальше он сам увидит, куда пошла стража. */
      if (event.точно) {
        /* Взлом — не громкая победа, а её отсутствие: сказать надо ровно
           то, чем он отличается, иначе игрок не поймёт, за что платил. */
        setToast(jab('hack', 'ВЗЛОМАНО — ЩИТОК ЦЕЛ, МОЖНО ВЕРНУТЬ'), 2.4);
        vibrate(10);
      } else {
        setToast(jab('panel', 'ЩИТОК ЗАМКНУЛО — ШУМ ТАМ, А НЕ ЗДЕСЬ'), 2.4);
        vibrate([12, 18, 12]);
      }
    } else if (event.type === 'lamp') {
      /* Слой «б»: лампа сменила состояние — сказать, что это значит для
         взгляда стражи, а не только что случилось с лампой. */
      if (event.how === 'doused') {
        setToast('ЛАМПА ПОГАСЛА — ЗДЕСЬ ТЕПЕРЬ ТЕНЬ', 2.2);
        audio.sfx('doused');
      } else if (event.how === 'broken') {
        setToast('ЛАМПА РАЗБИТА — ТЕМНО, НО ЗВОН СЛЫШАЛИ', 2.4);
        audio.sfx('glass');
      } else if (event.how === 'lit') {
        setToast('ЛАМПА ЗАЖЖЕНА — ЗДЕСЬ СНОВА ВИДНО', 2.2);
        audio.sfx('ignite');
      }
    } else if (event.type === 'witness') {
      /* Слой «в»: житель увидел — первый раз объяснить, что это значит и
         что с этим делать; дальше хватит «!» над ним. */
      setToast(jab('witness', 'ЖИТЕЛЬ ВИДЕЛ — БЕЖИТ К СТРАЖЕ. ПЕРЕХВАТИ'), 2.6);
      audio.sfx('spot');
    } else if (event.type === 'report') {
      setToast(event.kind === 'theft' ? 'ДОНЕСЛИ О КРАЖЕ: ТРЕВОГА' : 'ДОНЕСЛИ: ОБЫСК', 2.4);
      audio.sfx('spot');
      vibrate([10, 30, 10]);
    } else if (event.type === 'witness-stopped') {
      setToast('СВИДЕТЕЛЬ НЕ ДОБЕЖАЛ', 1.8);
    } else if (event.type === 'pedestal-empty') {
      setToast('ПРОПАЖУ ЗАМЕТИЛИ — ОБЫСК У ПОСТАМЕНТА', 2.6);
      audio.sfx('spot');
    } else if (event.type === 'shoved') {
      /* Толчок (tolchok.js): сбит с ног на 0.7 с — управление вернётся само.
         Второй раз за 12 с — уже тревога, и это надо сказать до, а не после. */
      setToast(event.repeat ? 'ВТОРОЙ ТОЛЧОК — ТРЕВОГА'
        : jab('shove', 'ТОЛКНУЛ СТРАЖА — ОН ОТТОЛКНУЛ. ЕЩЁ РАЗ ЗА 12 С — ТРЕВОГА'), 2.4);
      audio.sfx('knock');
      vibrate([20, 20]);
    } else if (event.type === 'coin-thrown') {
      audio.sfx('swing');
    } else if (event.type === 'coin') {
      /* Звон — по последствию, а не по нажатию (свод, 7п): сколько стражей
         его услышали. Ноль — тоже ответ: значит, бросил мимо слуха. */
      audio.sfx('pickup');
      setToast(event.heard ? `ЗВОН — УСЛЫШАЛИ: ${event.heard}` : 'ЗВОН — НИКТО НЕ УСЛЫШАЛ', 1.8);
    } else if (event.type === 'coin-empty') {
      audio.sfx('dry');
      setToast('МОНЕТ НЕТ — ПОДБЕРИ УПАВШИЕ', 1.8);
    } else if (event.type === 'coin-picked') {
      audio.sfx('pickup');
      setToast(`МОНЕТА ПОДОБРАНА · В КАРМАНЕ ${event.left}`, 1.6);
    } else if (event.type === 'crystal') {
      setToast('КРИСТАЛЛ ОТДАЛ РАЗРЯД', 1.6);
    } else if (event.type === 'hay') {
      setToast('СОЛОМА ЗАНЯЛАСЬ', 1.6);
    } else if (event.type === 'engaged') {
      /* Тихая фаза кончилась, и сказать об этом надо один раз: дальше
         этаж ведёт себя как обычно, и объяснять это второй раз незачем. */
      setToast('ЭТО ВИДЕЛИ — ТЕПЕРЬ ОНИ ЗНАЮТ', 2);
    } else if (event.type === 'quest') {
      /* Слой «г»: задание сменило состояние — «ЗАДАНИЕ: МОЛОТ КУЗНЕЦА —
         ВЗЯТО». Взятое начинает вести стрелку само, сделанное и
         проваленное — перестаёт. Счётчик — уже выше, в ladderPulses. */
      const text = questToast(event);
      if (text) setToast(text, 3.2);
      if (event.state === 'vzyato' && event.id !== 'yadro') tracked = event.id;
      if (event.state !== 'vzyato' && tracked === event.id) tracked = null;
      audio.sfx(event.state === 'sdelano' ? 'exit' : event.state === 'provaleno' ? 'dry' : 'ui');
      if (logVisible) renderLog();
    } else if (TALK_EVENTS.has(event.type)) {
      /* Отказ, обрыв разговора, зов стражи, поручения жителей, монеты
         за слово — строкой (zhiteli-vid.js, talkEventToast). */
      if (event.type === 'talk-refused' && event.why === 'saw') refusedSaw = true;
      const text = talkEventToast(event, {
        names: RESIDENT_NAMES,
        line: event.type === 'talk-refused' && world.zhiteli && world.zhiteli.refusal ? world.zhiteli.refusal.line : null,
        refusedSaw,
      });
      if (text) setToast(text, event.type === 'talk-refused' ? 2.5 : 2.6);
      if (TALK_SFX[event.type]) audio.sfx(TALK_SFX[event.type]);
    } else if (event.type === 'talk-open') {
      audio.sfx(TALK_SFX['talk-open']);
    }

    tutorFeed(event);

    /* Подсказка ступени говорит последней: её строка важнее общей, и
       успех («РОВ ДЕРЖИТ») не должен тонуть под «СВЯЗЬ 3». */
    const said = guide.feed(world, event);
    if (said) setToast(said.text, said.success ? 2.4 : 4.5);
    if (said && said.success) successUntil = world.time + 2;

    if (event.type === 'kill') {
      vibrate(12);
    } else if (event.type === 'death') {
      vibrate([40, 30, 90]);
      deathHold = 0.32;
    } else if (event.type === 'cleared') {
      setToast('ЭТАЖ ЧИСТ — К ВЫХОДУ', 3);
    } else if (event.type === 'dry') {
      /* Только то, что этаж дал сейчас, и клавиши из самих стихий: зашитая
         строка перечисляла все пять со слэшем вместо шифта (hints.js).
         Свежую строку успеха ступени не перебивает: палец, погасивший
         лампу стиком, ещё держит его, стик соскальзывает на стража и
         выпускает пустую руку — и «ЛАМПА ПОГАСЛА» жила один кадр (прогон
         03.10, pilot-vid/snyat-v5.mjs prohod). */
      if (world.time >= successUntil) setToast(dryHint(world.elements, byTouch()), 1.8);
    } else if (event.type === 'exit') {
      clearScreen();
    }
  }
}

function vibrate(pattern) {
  if (navigator.vibrate) {
    try { navigator.vibrate(pattern); } catch (error) { /* браузер против */ }
  }
}


/* =========================================================
   КАДР
   ========================================================= */

let previous = performance.now();

/*
 * Кадр не имеет права убить игру.
 *
 * Пока планирование следующего кадра стояло последней строкой самого
 * кадра, любая ошибка внутри останавливала цикл навсегда: мир замирал,
 * кнопки переставали отвечать, и снаружи это выглядело как «игра просто не
 * двигается» — без единой строчки в консоли, потому что ошибка случалась
 * один раз и больше некому было её повторить.
 *
 * Теперь следующий кадр планируется всегда, а ошибка показывается игроку
 * и запоминается в window.technomagic.error. Сломанная игра должна об этом
 * говорить, а не молчать.
 */
function frame(now) {
  requestAnimationFrame(frame);

  try {
    step(now);
  } catch (error) {
    if (!window.technomagic.error) {
      window.technomagic.error = error;
      setToast(`СБОЙ: ${String(error && error.message || error).slice(0, 60)}`, 6);
      console.error('кадр упал', error);
    }
  }
}

function step(now) {
  const dt = Math.min(0.05, (now - previous) / 1000);
  previous = now;

  resize();

  /*
   * На съёмке свой цикл игры молчит, но отрисовка работает. Останавливать
   * надо ход, а не рисование: холст очищается при любом изменении размера,
   * и остановленная отрисовка даёт пустой кадр вместо сцены.
   */
  if (shooting) {
    shooting.render();
    return;
  }

  const raw = input.read();
  isoInput(raw);

  if (input.tookKey('KeyB')) toggleTome();
  /* Журнал заданий — только там, где есть жители (слой «г»). */
  if (input.tookKey('KeyL') && world && world.zhiteli && scene !== 'call') toggleLog();

  /* Tab перебирает цели: живых сначала, предметы следом. Без него до
     бочки с клавиатуры было не добраться — прицел держится за живого. */
  if (world && scene === 'play' && input.tookKey('Tab')) {
    picked = cycleTarget(world, picked || locked, world.player.angle);
    locked = picked;
    world.locked = picked;
  }

  if (input.tookKey('Escape') || input.tookKey('KeyP')) {
    if (logVisible) hideLog();
    else if (tomeVisible) hideTome();
    else if (scene === 'play') pauseScreen();
    else if (scene === 'pause') { hideVeil(); scene = 'play'; }
  }

  if (input.tookKey('KeyM')) toggleMute();

  if (scene === 'play' && !tomeVisible && !logVisible) {
    const intent = buildIntent(raw);
    update(world, dt, intent);
    /*
     * Плата за способ показывается сразу и на месте. До сих пор весь счёт
     * игрок видел только в конце этажа — то есть узнавал, что его ход
     * засчитан, через минуту после того, как перестал на него смотреть.
     */
    for (const award of score.feed(world.events)) {
      if (!award.x && !award.y) continue;
      world.marks.push({
        x: award.x,
        y: award.y - 14,
        text: `+${award.gain} ${award.reason}`,
        big: award.combo > 1,
        life: 1.1,
        max: 1.1,
      });
    }
    score.update(dt);
    drainEvents();

    /* «Застрял на ступени» — это отсутствие события, по событиям мира его
       не поймать: спрашиваем каждый кадр (lestnica.js, ladderTick). */
    if (level.ladder) {
      for (const [name, data] of ladderTick(meter, world)) pulse(name, data);

      /* Совет в момент нужды (слой «б»): стоишь в свете лампы у стража —
         «вода гасит лампу»; пост смотрит прямо на тебя — «монета». Один
         раз за попытку и только когда лестница молчит; без ответа уходит
         сам (guide.expire), ответ на действие — guide.feed в drainEvents. */
      guide.expire(world);
      const need = guide.step ? null : needNow(needs, world);
      if (need) {
        needs.shown.add(need);
        const said = guide.start(need, world);
        if (said) setToast(said, 5);
      }
    }

    const alerted = world.enemies.filter((e) => e.alive && e.state === 'chase').length;
    audio.setIntensity(world.total ? alerted / world.total : 0);

    if (world.state === 'dead') {
      deathHold = 0.32;
      scene = 'dying';
    }

    updateHud(false);
  } else if (scene === 'dying') {
    update(world, dt, { moveX: 0, moveY: 0, aimAngle: null, attack: false });
    drainEvents();
    deathHold -= dt;
    if (deathHold <= 0) deathScreen();
  } else if (world && (scene !== 'call' || tomeVisible || logVisible)) {
    /* На паузе, в книге и после смерти мир не двигается, но кадр рисуем. */
    update(world, 0, { moveX: 0, moveY: 0, aimAngle: null, attack: false });
  }

  /* R перезапускает этаж откуда угодно, кроме экрана звонка. */
  const restart = input.tookKey('KeyR');
  if (scene === 'dead' || scene === 'dying') {
    /* После смерти перезапускает всё, что под рукой: R, пробел, удар. */
    if (restart || input.tookKey('Fire') || input.tookKey('Enter') || input.tookKey('Space')) {
      startLevel(level, { silent: true });
    }
  } else if (restart && (scene === 'play' || scene === 'pause')) {
    startLevel(level, { silent: true });
  } else if (scene === 'call' && !tomeVisible
      && (input.tookKey('Fire') || input.tookKey('Enter') || input.tookKey('Space'))) {
    /* Стартовый экран тоже открывается тем, что под рукой. Единственный вход
       в игру не должен зависеть от одной кнопки: пока он от неё зависел,
       пропавший стиль этой кнопки означал, что игру нельзя начать вовсе. */
    ui.veilAction.click();
  }

  /* Разговор на экране (слой «г») — каждый кадр и в любой сцене, до
     отрисовки: подпись у героя и цель задания она читает из мира. */
  if (world) syncTalk();

  if (world) {
    /* Камера смотрит чуть вперёд по прицелу и догоняет быстро: на этой
       скорости мягкое слежение отстаёт и игрок упирается в край кадра. */
    const player = world.player;
    const lead = 52;
    view.x += (player.x + Math.cos(player.angle) * lead - view.x) * Math.min(1, dt * 11);
    view.y += (player.y + Math.sin(player.angle) * lead - view.y) * Math.min(1, dt * 11);
    renderer.setAvoid(overlayRects());
    /* Рамка клетки под мышью — только пока мышью целятся (input.js). */
    if (renderer.pointer) renderer.pointer(!raw.touch && raw.mouse.moved ? raw.mouse : null);
    lastView = renderer.draw(world, view);

    /*
     * Сколько мира влезло в экран — знает только камера, а нужно это ИИ.
     * Кладём радиус в мир: стрелки не станут бить из невидимого.
     */
    /*
     * В изометрии экранный пиксель короче мирового по вертикали вдвое, и
     * прямой перевод дал бы стрелкам вдвое большую дальность, чем игрок
     * видит. Берём меньшую из сторон и делим на диагональ ромба.
     */
    /* Изометрия считает видимое сама (vvod.js, isoViewRadius): её пол
       виден эллипсом, а не ромбом, и по стандартному плану, а не по
       текущему приближению. */
    world.viewRadius = lastView.viewRadius ?? Math.min(
      canvas.clientWidth / (2 * lastView.zoom),
      canvas.clientHeight / lastView.zoom,
    ) / 1.42 - 24;
    drawSticks(raw);
  }

  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) ui.toast.hidden = true;
  }

  if (foundTimer > 0) {
    foundTimer -= dt;
    if (foundTimer <= 0) ui.found.hidden = true;
  }

  markCharging();

  input.endFrame();
}


/*
 * ЧТО ЛЕЖИТ ПОВЕРХ ХОЛСТА
 * =========================================================
 * Стрелка подсказки у края экрана (src/ukazatel.js) не должна ложиться
 * под кнопки: на телефоне боком ряд стихий и «ПУСК» лежат прямо на
 * холсте, в портрете у нижнего края холста висит тост, сверху — шапка
 * операции. Прямоугольники берутся у самих элементов, в пикселях холста,
 * и не чаще двух раз в секунду: раскладка меняется поворотом и тостом, а
 * не каждый кадр.
 */
const OVERLAY_IDS = ['daemons', 'pad', 'operationHud', 'mute', 'tomeOpen', 'toast', 'physicalObservation', 'found', 'camctl', 'camToggle', 'vidno', 'talk', 'questOpen'];
let overlayCache = { at: -1, rects: [] };
function overlayRects() {
  const now = performance.now();
  if (now - overlayCache.at < 500) return overlayCache.rects;
  const box = canvas.getBoundingClientRect();
  const nodes = [...OVERLAY_IDS.map((id) => document.getElementById(id)),
    document.querySelector('.hud'), document.querySelector('.game-home-menu')];
  const rects = [];
  for (const node of nodes) {
    if (!node || node.hidden) continue;
    const r = node.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const x = r.left - box.left;
    const y = r.top - box.top;
    if (x > box.width || y > box.height || x + r.width < 0 || y + r.height < 0) continue;
    rects.push({ x, y, w: r.width, h: r.height });
  }
  overlayCache = { at: now, rects };
  return rects;
}

/* Призраки стиков: палец должен видеть, что игра его поняла. */
function drawSticks(raw) {
  /* Стики считаются от угла холста (input.js), а призрак стоит на
     странице: с 03.10 на телефоне стоя в объёмном виде холст начинается
     под верхней полосой, и без сдвига призрак висел на 62 точки выше
     пальца. */
  let box = null;
  for (const [ghost, stick] of [[ui.ghostMove, raw.sticks.move], [ui.ghostAim, raw.sticks.aim]]) {
    if (!stick.active) { ghost.hidden = true; continue; }
    box = box || canvas.getBoundingClientRect();
    ghost.hidden = false;
    ghost.style.left = `${stick.baseX + box.left}px`;
    ghost.style.top = `${stick.baseY + box.top}px`;
    ghost.firstElementChild.style.transform = `translate(${stick.dx}px, ${stick.dy}px)`;
  }
}


/* =========================================================
   ОБВЯЗКА
   ========================================================= */

function toggleMute() {
  audio.setMuted(!audio.isMuted());
  ui.mute.dataset.off = audio.isMuted() ? '1' : '0';
  ui.mute.textContent = audio.isMuted() ? 'ЗВУК ВЫКЛ' : 'ЗВУК ВКЛ';
}

/*
 * Размер сверяется каждый кадр, а не только по событию resize: в Safari
 * адресная строка меняет высоту окна без события, а в фоновой вкладке
 * окно какое-то время сообщает нули.
 */
function resize() {
  /*
   * Размер берётся у самого холста, а не у окна. На телефоне холст занимает
   * не весь экран: снизу отведена полоса под кнопки, и мир, нарисованный по
   * высоте окна, уезжал бы под них.
   */
  const width = canvas.clientWidth || window.innerWidth || document.documentElement.clientWidth;
  const height = canvas.clientHeight || window.innerHeight || document.documentElement.clientHeight;
  if (width < 1 || height < 1) return;
  /* Повтор ничего не стоит: холст сам отбросит вызов, если размер тот же. */
  renderer.resize(width, height, window.devicePixelRatio || 1);
}

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 120));

ui.veilAction.addEventListener('click', (event) => {
  audio.unlock();
  audio.sfx('ui');
  /* Снимаем фокус: иначе пробел в бою повторно нажимал бы эту кнопку. */
  event.currentTarget.blur();

  if (scene === 'call') startLevel(level);
  else if (scene === 'dead') startLevel(level, { silent: true });
  else if (scene === 'clear') {
    attempts = 0;
    if (world.operation) {
      startLevel(level, { silent: true });
      return;
    }
    if (hasNextFloor()) {
      levelIndex += 1;
      /* Следующий этаж — уже не тот, на который звали: цель снимается. */
      challenge = null;
      level = CAMPAIGN[levelIndex];
      levelCode = encode(level);
      world = createWorld(level);
      score = createScore(level, 0);
      view = { x: world.player.x, y: world.player.y };
      renderer.invalidate();
      updateHud(true);
      callScreen();
    } else {
      startLevel(level, { silent: true });
    }
  } else if (scene === 'pause') { hideVeil(); scene = 'play'; }
});

ui.veilSecond.addEventListener('click', (event) => {
  audio.sfx('ui');
  event.currentTarget.blur();
  if (scene === 'pause') startLevel(level, { silent: true });
  else if (scene === 'clear') {
    attempts = 0;
    if (world.operation && CAMPAIGN.length > 1) {
      levelIndex = 1;
      level = CAMPAIGN[levelIndex];
      world = createWorld(level);
      score = createScore(level, 0);
      levelCode = encode(level);
      view = { x: world.player.x, y: world.player.y };
      renderer.invalidate();
      updateHud(true);
      callScreen();
    } else startLevel(level, { silent: true });
  }
});

ui.codeBox.addEventListener('focus', () => ui.codeBox.select());

ui.nickBox.addEventListener('input', () => {
  const clean = cleanNick(ui.nickBox.value);
  if (ui.nickBox.value !== clean) ui.nickBox.value = clean;
  rememberNick(clean);
  refreshLink();
});

$('copyLink').addEventListener('click', async () => {
  refreshLink();
  ui.linkBox.select();
  try {
    await navigator.clipboard.writeText(ui.linkBox.value);
    setToast('ССЫЛКА СКОПИРОВАНА — ОТПРАВЬ ЕЁ', 2.4);
  } catch (error) {
    document.execCommand('copy');
  }
});

ui.linkBox.addEventListener('focus', () => ui.linkBox.select());

$('copyCode').addEventListener('click', async () => {
  ui.codeBox.select();
  try {
    await navigator.clipboard.writeText(ui.codeBox.value);
    setToast('КОД СКОПИРОВАН', 1.6);
  } catch (error) {
    document.execCommand('copy');
  }
});

/* На телефоне клавиши B нет — и обещать её на кнопке незачем. */
if (byTouch()) ui.tomeOpen.textContent = 'КНИГА';

ui.tomeOpen.addEventListener('click', () => { toggleTome(); ui.tomeOpen.blur(); });
ui.tomeClose.addEventListener('click', hideTome);

/* Щелчок мимо карточки закрывает книгу: она перекрывает игру целиком, и
   искать кнопку в такой ситуации не должно быть обязательным. */
ui.tome.addEventListener('click', (event) => { if (event.target === ui.tome) hideTome(); });

ui.mute.addEventListener('click', () => {
  audio.unlock();
  toggleMute();
});

for (const element of ELEMENT_ORDER) input.bindButton($(`btn-${element}`), element);
input.bindButton($('btnAttack'), 'attack');
/* Монета (слой «б»): нажатие приходит в игру как 'Coin' (input.js). */
input.bindButton($('btn-coin'), 'Coin');
/* ГОВОРИТЬ (слой «г»): нажатие приходит как 'Talk' — та же дверь, что F. */
input.bindButton($('btn-talk'), 'Talk');
ui.questOpen.addEventListener('click', () => { toggleLog(); ui.questOpen.blur(); });
ui.zhurnalClose.addEventListener('click', hideLog);
ui.zhurnal.addEventListener('click', (event) => { if (event.target === ui.zhurnal) hideLog(); });

document.addEventListener('visibilitychange', () => {
  if (document.hidden && scene === 'play') pauseScreen();
});

/* Первое касание экрана разрешает звук: без жеста браузер его не пустит. */
const wake = () => { audio.unlock(); window.removeEventListener('pointerdown', wake); };
window.addEventListener('pointerdown', wake);

/*
 * Диагностический вход. Через него проверяется то, что не проверить
 * снаружи: дошло ли нажатие до мира и в каком состоянии игра. Ничего не
 * меняет — только отдаёт ссылки на живые объекты.
 */
/*
 * ВХОД СНАРУЖИ
 * =========================================================
 * Имя своё, а не общее. Раньше здесь стояло window.avto — наследство от
 * прежнего названия игры, — и ровно такое же имя оказалось у соседнего
 * проекта. Две разные игры, две разные сцены, одно имя: на разных
 * страницах это не ломается само, но тот, кто снимает шесть игр по
 * записанному рецепту, применит к одной порядок вызовов другой. Ошибка
 * будет выглядеть как «сцена не работает», а искать её станут в сцене.
 *
 * Старое имя оставлено синонимом: на него могли уже сослаться.
 */
window.technomagic = {
  get world() { return world; },
  get scene() { return scene; },
  get level() { return level; },

  /* Ввод и отрисовка — тоже наружу. Проверить, доходит ли касание до мира
     и во что обходится кадр, иначе нечем: кадровый цикл в отладочных окнах
     не крутится, а спросить напрямую можно всегда. */
  get input() { return input; },
  get renderer() { return renderer; },

  /*
   * ЗВУК НАРУЖУ
   * ---------------------------------------------------------
   * Про звук спорят дольше всего именно потому, что его нельзя
   * предъявить: один говорит «молчит», другой «играет», и оба правы в
   * своём окне. Ручка превращает спор в команду — `technomagic.audio()`
   * отдаёт живой узел, а `.sfx(имя)` роняет в него один звук, и дальше
   * меряется выход, а не намерение.
   *
   * Заведена по просьбе соседней сессии, которая замером на бою нашла у
   * нас неработающий немой флаг. Их довод простой: у ПЕРИМЕТРА такая
   * ручка есть, и она превратила двухчасовой спор двух измерителей в
   * одну строчку.
   */
  audio() { return audio; },
  get view() { return lastView; },
  /* Какой вид на экране ('iso' или '2d') и пульт изометрии для проверок
     (src/view3d/igra.js, debug): точка мира → экран, что под указателем,
     ракурс, время кадра. У плоского вида пульта нет — null. */
  get vid() { return renderer.iso ? 'iso' : '2d'; },
  get iso() { return renderer.iso ? renderer.debug : null; },
  get picked() { return picked; },
  /* Подсказка лестницы и советы слоя «б» — для проверок: какая ступень
     идёт (guide.step) и что уже показано (needs.shown). Только чтение. */
  get guide() { return guide; },
  get needs() { return needs; },
  /* Слой «г», только чтение: что на полосе разговора (talkNow), с кем
     можно заговорить (talkTarget), журнал (questLog), какое задание
     ведёт стрелка. */
  talk() { return world ? talkNow(world) : null; },
  talkTarget() { return world ? talkTarget(world) : null; },
  quests() { return world ? questLog(world) : []; },
  get tracked() { return tracked; },
  get logVisible() { return logVisible; },
  state() {
    return {
      scene,
      worldState: world?.state ?? null,
      operation: world ? operationResult(world) : null,
      coreTaken: Boolean(world?.core?.taken),
      candleLit: Boolean(world?.props.find((prop) => prop.kind === 'candle')?.lit),
      /* Ступень «Лестницы»: сколько рук, какие стихии, каким путём вошёл.
         У старых этажей — null. */
      ladder: world?.level?.ladder
        ? { stack: world.stackLimit, elements: [...world.elements], route: world.route }
        : null,
    };
  },

  /*
   * СНАРЯД ДЛЯ ВИТРИНЫ
   * ---------------------------------------------------------
   * Ставит сцену и отдаёт рычаги: шаг, отрисовку, состояние. Снимает
   * другой — это разделение труда, а не лень: сцену умеет поставить
   * только тот, кто знает игру.
   *
   *   const s = window.technomagic.showcase({ width: 960, height: 540 });
   *   while (s.state().упавших < 2) s.step(1/60);
   *   s.render();                           // кадр в холсте
   *   s.stop();                             // вернуть игру
   *
   * Без аргументов сцена ещё и играет сама, с постоянным шагом: этого
   * хватает, чтобы снять петлю простым захватом холста.
   */
  showcase(options = {}) {
    const seed = options.seed || 20260830;

    /*
     * Размер холста ставит кадровый цикл — а на съёмке он молчит, и без
     * этой строки сцена рисуется в холст по умолчанию, триста на сто
     * пятьдесят. Кадр при этом выходит не пустой, а хуже: почти
     * правильный, только мелкий, и заметить это можно лишь замерив.
     * Поймано счётчиком прозрачных пикселей: их оказалось не ноль.
     *
     * Размер можно задать и прямо — снимающему обычно нужен постоянный
     * кадр, не зависящий от того, каким окном его открыли. А в скрытой
     * вкладке холст вообще не имеет размера, и спросить его не у кого.
     */
    if (options.width && options.height) {
      canvas.style.width = `${options.width}px`;
      canvas.style.height = `${options.height}px`;
      renderer.resize(options.width, options.height, options.dpr || 1);
    } else {
      resize();
    }

    const made = withSeed(seed, () => (
      options.episode
        ? createEpisodeShowcase(CAMPAIGN[0], renderer, {
          width: options.width || window.innerWidth,
          height: options.height || window.innerHeight,
        })
        : createShowcase(CAMPAIGN[0], renderer)
    ));

    document.body.classList.add('is-shooting');

    /* Каждый шаг и каждая отрисовка идут под тем же сидом: иначе искры
       и дым разойдутся на втором прогоне, и «детерминировано» окажется
       неправдой ровно там, где это важнее всего. */
    const wrapped = {
      world: made.world,
      step: (dt) => withSeed((seed + Math.round(made.state().секунд * 1000)) >>> 0,
        () => made.step(dt)),
      /*
       * Сид отрисовки свой на каждый кадр сцены, а не один на все: при
       * общем сиде искры и дуги замирали — каждый кадр рисовал ту же
       * «случайность», и остаточное электричество стояло как картинка.
       * Детерминизм не теряется: номер кадра при повторном прогоне тот же.
       */
      render: () => withSeed((seed + Math.round(made.state().секунд * 60)) >>> 0,
        () => made.render()),
      state: () => made.state(),
      stop() {
        shooting = null;
        document.body.classList.remove('is-shooting');
        canvas.style.width = '';
        canvas.style.height = '';
        resize();
        renderer.invalidate();
      },
    };

    /* Кадр рисует обёртка, а не сама сцена: подменять её собственный
       метод — верный способ получить бесконечную рекурсию, что и вышло
       с первой попытки. */
    shooting = wrapped;

    if (options.play !== false) {
      const tick = () => {
        if (shooting !== wrapped) return;
        wrapped.step(1 / 60);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }

    return wrapped;
  },
};


/*
 * Синоним под прежним именем — временный, до 6 сентября 2026 года.
 * Держится ради ссылок, которые могли остаться снаружи.
 *
 * Срок стоит здесь не для порядка: одна вещь под двумя именами — ровно та
 * болезнь, из-за которой это переименование и понадобилось. Синоним без
 * срока живёт вечно, и через полгода никто не помнит, какое имя
 * настоящее.
 */
window.avto = window.technomagic;

/*
 * Отдельный вход словом в адресе (src/entry.js): `?lestnica` — «Башня»,
 * `?pesochnitsa` — «Пять стихий». Он главнее кода в хэше: `#lestnica`
 * — не код этажа, и разбирать его как код значило бы показать «КОД НЕ
 * ОТКРЫЛСЯ» человеку, которому дали правильную ссылку.
 */
const entry = pickEntry(location.search, location.hash);
if (entry) {
  level = entryLevel(entry);
  custom = true;
} else {
  const fromHash = levelFromHash();
  if (fromHash) { level = fromHash; custom = true; }
}

loadArt();

/*
 * ВЫХОД С НАЧАТОЙ ПАРТИИ СПРАШИВАЕТ
 * =========================================================
 * Кнопка «НА САЙТ» висит поверх игрового поля, то есть под большим
 * пальцем, и уводит со страницы одним касанием. Владелец так уже потерял
 * партию в другой нашей игре — вышел мимоходом, и прогресс исчез молча.
 *
 * Спрашиваем только при идущей партии: на заставке, после смерти и на
 * зачищенном этаже терять нечего, и лишний вопрос там — помеха.
 *
 * Оба исхода обязаны работать: «отмена» удерживает адрес (для этого
 * `preventDefault` стоит ДО вопроса, а не после), «выйти» уводит. Проверка,
 * знающая только один исход, зелёная на сломанном.
 */
function партияИдёт() {
  return (scene === 'play' || scene === 'pause') && world && world.state === 'play';
}

const выход = document.querySelector('.game-home-menu');
if (выход) {
  выход.addEventListener('click', (event) => {
    if (!партияИдёт()) return;
    event.preventDefault();
    if (window.confirm('Точно выйти? Партия и прогресс потеряются.')) {
      window.location.href = выход.href;
    }
  });
}

resize();
levelCode = encode(level);
world = createWorld(level);
score = createScore(level, 0);
syncElementButtons();
view = { x: world.player.x, y: world.player.y };
updateHud(true);
callScreen();
ui.mute.dataset.off = audio.isMuted() ? '1' : '0';
ui.mute.textContent = audio.isMuted() ? 'ЗВУК ВЫКЛ' : 'ЗВУК ВКЛ';
requestAnimationFrame(frame);

/*
 * СЪЁМОЧНЫЙ АДРЕС: ?scena — сцена витрины стартует сама, без рук.
 * Снимающему не нужно знать пульт: открыл адрес — идёт бой для петли
 * (подход → заряд → разряд → остаточное электричество, ~4.5 с).
 * Сама глушит звук: съёмочный адрес обязан молчать без отдельного
 * параметра (снимающий всё равно дублирует это ключом браузера).
 * Проверка, что режим включился, — не «страница открылась», а признак
 * в состоянии: у window.technomagic.scena() есть поле «этап».
 */
if (/(^|[?&#])(scena|сцена)([=&#]|$)/i.test(`${location.search}${location.hash}`)) {
  audio.setMuted(true);
  const съёмка = window.technomagic.showcase({ width: 960, height: 540 });
  window.technomagic.scena = () => съёмка.state();
}
