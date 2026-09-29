import { createInput } from './input.js';
import { createCompanion } from './companion.js?v=center-virus-1';
import { createAudioBus } from './audio.js?v=novice-1';
import { getInteractionTarget, navigateToTarget, placeWorldButton, buildWakeFragment } from './wayfinding.js?v=novice-1';
import { createFutureComic } from './future-comic.js?v=novice-1';
import { createFriendSandbox } from './friend-sandbox.js?v=novice-1';
import { prepareMachinePython, runWake } from './machine.js?v=3';
import {
  createFakeGateway,
  createMachineListeningEvent,
  createOtherMindRuntime,
} from './other-mind.js';
import {
  applyGameAction,
  createCheckpointState,
  createGameState,
  getFirstActionGuide,
  getNearbyAction,
  stepGame,
} from './model.js?v=novice-1';
import { renderGame } from './render.js?v=center-virus-1';
import { getWakeFailureGuidance } from './wake-help.js?v=2';
import { createCheckpointPersistence, loadCheckpoint } from './save.js?v=2';
import { createTelemetry } from './telemetry.js';
import { CHECKPOINTS, OTHER_MIND_AWAKE_HOLD_DURATION, REWARD_REVEAL_DURATION } from './config.js?v=novice-1';
import { getSceneCameraTarget, getViewportTransform, screenToWorld } from './viewport.js?v=2';

const canvas = document.querySelector('#gameCanvas');
const ctx = canvas.getContext('2d');
const game = document.querySelector('#game');
const hud = {
  chapter: document.querySelector('#chapterText'),
  mission: document.querySelector('#missionText'),
  message: document.querySelector('#gameMessage'),
  progress: document.querySelector('#missionProgress'),
  system: document.querySelector('#systemState'),
  sector: document.querySelector('#sectorState'),
  targets: document.querySelector('#targetState'),
  action: document.querySelector('#actionButton'),
  chip: document.querySelector('#pythonChip'),
  machine: document.querySelector('#machinePanel'),
  ending: document.querySelector('#endingPanel'),
  code: document.querySelector('#codeInput'),
  run: document.querySelector('#runCode'),
  feedback: document.querySelector('#codeFeedback'),
  machineTitle: document.querySelector('#machineTitle'),
  machineBrief: document.querySelector('#machineBrief'),
  otherMind: document.querySelector('#otherMindStatus'),
  otherMindPhase: document.querySelector('#otherMindPhase'),
  otherMindLine: document.querySelector('#otherMindLine'),
  journal: document.querySelector('#skillJournal'),
  printSkillMethod: document.querySelector('#printSkillMethod'),
  storageWarning: document.querySelector('#storageWarning'),
};

const isLocal = ['127.0.0.1', 'localhost'].includes(location.hostname);
const query = new URLSearchParams(location.search);
const requestedCheckpoint = query.get('checkpoint');
const showcaseChip = isLocal && query.get('showcase') === 'chip';
const showcaseManual = isLocal && query.get('showcase') === 'manual';
game.dataset.chipShowcase = showcaseChip ? 'true' : 'false';
const checkpoint = (isLocal && CHECKPOINTS.includes(requestedCheckpoint)) || requestedCheckpoint === 'start'
  ? { checkpoint: requestedCheckpoint }
  : (showcaseChip ? { checkpoint: 'chip' } : (showcaseManual ? { checkpoint: 'warehouse' } : loadCheckpoint()));
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const narrowViewport = window.matchMedia('(max-width: 760px)');
const telemetry = createTelemetry({ enabled: isLocal });
let state = createCheckpointState(checkpoint.checkpoint);
if (showcaseManual) state = { ...state, warehouse: { ...state.warehouse, introComplete: true } };
let fakeGateway;
let otherMindRuntime;
let otherMindWakingAt = null;
let lastTime = performance.now();
let firstMovementSeen = false;
let lastScene = state.scene;
let machineOpen = false;
let machineRunning = false;
let gameGeneration = 0;
let wakeAttempts = 0;
const input = createInput(canvas);
const companion = createCompanion(game, document.querySelector('#cursorCompanion'), hud.ending, prefersReducedMotion);
const audio = createAudioBus();
let lastAutoDelivered = state.warehouse.autoDelivered;
let lastThreats = state.prologue.threats;
let audioPeak = 0;
let cashPeak = 0;
let firstActionRecorded = false;
let manualStartedAt = null;
let automationAcceptedAt = null;
let lastAutoFinishedAt = null;
let incomeNoticeUntil = 0;
let warehouseCueStage = 0;
let codeInputMethod = 'typed';
let showcaseStartedAt = showcaseChip ? performance.now() : null;
let started = checkpoint.checkpoint !== 'start' || showcaseChip || showcaseManual;
let walkingTarget = null;
let lastIncomeAt = state.warehouse.incomeAt;
let storyActive = false;
let storyCallback = null;
let friendVisited = false;
let journalOpen = false;
let exitOpen = false;
const startPanel = document.querySelector('#startPanel');
const wallet = document.querySelector('#wallet');
const incomeToast = document.querySelector('#incomeToast');
const comic = createFutureComic(document.querySelector('#futureComic'), { onSound: name => audio.play(name) });
const friendSandbox = createFriendSandbox(document.querySelector('#friendSandbox'), { onComplete: () => comic.show(0), onSound: name => audio.play(name) });

function tellStory(speaker, title, line, button, callback) {
  walkingTarget = null;
  storyActive = true;
  storyCallback = callback;
  document.querySelector('#storySpeaker').textContent = speaker;
  document.querySelector('#storyTitle').textContent = title;
  document.querySelector('#storyLine').textContent = line;
  document.querySelector('#storyNext').textContent = button;
  document.querySelector('#storyBeat').hidden = false;
}

document.querySelector('#storyNext').addEventListener('click', () => {
  storyActive = false;
  document.querySelector('#storyBeat').hidden = true;
  const next = storyCallback;
  storyCallback = null;
  next?.();
});

document.querySelector('#startGame').addEventListener('click', () => {
  started = true;
  lastTime = performance.now();
  unlockAudioForScene();
  startPanel.hidden = true;
  telemetry.mark('play-start');
});

document.querySelector('#homeLink').addEventListener('click', event => {
  event.preventDefault();
  if (!started) { window.location.assign(event.currentTarget.href); return; }
  exitOpen = true;
  const dialog = document.querySelector('#exitDialog');
  dialog.hidden = false;
  for (const child of game.children) if (child !== dialog) child.inert = true;
  document.querySelector('#stayInGame').focus();
});
function closeExitDialog() {
  exitOpen = false;
  document.querySelector('#exitDialog').hidden = true;
  for (const child of game.children) child.inert = false;
  document.querySelector('#homeLink').focus();
}
document.querySelector('#stayInGame').addEventListener('click', closeExitDialog);
document.querySelector('#exitDialog').addEventListener('keydown', event => {
  event.stopPropagation();
  if (event.key === 'Escape') { event.preventDefault(); closeExitDialog(); }
  if (event.key === 'Tab') {
    event.preventDefault();
    const stay = document.querySelector('#stayInGame');
    (document.activeElement === stay ? document.querySelector('#confirmExit') : stay).focus();
  }
});
document.querySelector('#journalToggle').addEventListener('click', () => {
  journalOpen = !journalOpen;
  document.querySelector('#journalToggle').setAttribute('aria-expanded', String(journalOpen));
});

const persistence = createCheckpointPersistence({
  storage: localStorage,
  onFailure: () => {
    hud.storageWarning.hidden = false;
  },
});

function ambientForScene() {
  return ['prologue', 'collapse'].includes(state.scene) ? 'combat' : 'warehouse';
}

async function unlockAudioForScene() {
  if (await audio.unlock()) await audio.setAmbient(ambientForScene());
}

function prepareOtherMindRuntime() {
  const failGateway = isLocal && new URLSearchParams(location.search).get('fakeGateway') === 'fail';
  fakeGateway = createFakeGateway({ fail: failGateway, chunks: 4, delay: 330 });
  otherMindRuntime = createOtherMindRuntime({
    gateway: fakeGateway,
    onTransition: ({ phase, line }) => {
      const previous = state.otherMind.phase;
      if (phase === 'waking' && previous !== 'waking') otherMindWakingAt = performance.now();
      const actionType = {
        waking: 'other-mind-waking',
        awake: 'other-mind-awake',
        silent: 'other-mind-silent',
      }[phase];
      if (actionType) state = applyGameAction(state, { type: actionType, line });
      if (phase === 'awake' && previous !== 'awake') audio.play('wake');
      if (phase !== previous) telemetry.mark(`other-mind-${phase}`);
    },
  });
}

prepareOtherMindRuntime();

function recordFirstAction() {
  if (firstActionRecorded) return;
  firstActionRecorded = true;
  telemetry.mark('first-action');
}

function resetMachinePanel() {
  hud.feedback.textContent = 'Собери сигнал кнопками выше — или напиши его сам.';
  hud.feedback.dataset.status = 'idle';
  hud.machineTitle.textContent = 'Терминал узла 07';
  hud.machineBrief.textContent = 'Чип помнит форму команды. Собери сигнал, который разбудит руку.';
  hud.code.value = '';
  wakeAttempts = 0;
  updateSignalBuilder();
}

function updateSignalBuilder() {
  const source = hud.code.value.trim();
  document.querySelector('#fragmentPrint').hidden = source === 'print' || /print\s*\(/i.test(source);
  document.querySelector('#fragmentWake').hidden = !source || /print\s*\(/i.test(source);
  document.querySelector('#signalPrompt').textContent = !source
    ? '1. Как заговорить с машиной? Нажми найденный фрагмент.'
    : (source === 'print' ? '2. Что ей сказать? Wake значит «проснись».' : 'Сигнал собран. Нажми «Разбудить руку» — и смотри на неё.');
  if (!machineRunning) hud.run.disabled = !source || source === 'print';
}

for (const [id, fragment] of [['fragmentPrint', 'print'], ['fragmentWake', 'wake']]) {
  document.querySelector(`#${id}`).addEventListener('click', () => {
    hud.code.value = buildWakeFragment(hud.code.value, fragment);
    codeInputMethod = 'assembled';
    updateSignalBuilder();
    audio.play('pickup');
  });
}
hud.code.addEventListener('input', updateSignalBuilder);

function openMachinePanel() {
  machineOpen = true;
  prepareMachinePython();
  requestAnimationFrame(() => {
    if (!machineOpen) return;
    if (window.matchMedia('(pointer: coarse), (max-width: 760px), (max-height: 500px)').matches && !hud.code.value) document.querySelector('#fragmentPrint').focus({ preventScroll: true });
    else hud.code.focus();
  });
}

function resizeCanvas() {
  const scale = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(canvas.clientWidth * scale));
  canvas.height = Math.max(1, Math.round(canvas.clientHeight * scale));
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
}

function useAction() {
  if (exitOpen) return;
  const action = getNearbyAction(state);
  if (!action) return;
  recordFirstAction();
  if (action.type === 'open-machine') {
    openMachinePanel();
    return;
  }
  if (action.type === 'inspect-red-crate') {
    tellStory('СКЛАД · КОНЕЦ СМЕНЫ', 'Обычный груз уезжал сам. Этот — другой.', 'Рука не сломалась: она пока знает только один маршрут. Другой груз потребует другого правила. Ты уже заработал $1080 и освободил 24 минуты. Пора домой — друзьям есть что показать.', 'ЗАКОНЧИТЬ СМЕНУ · ДОМОЙ →', () => {
      state = applyGameAction(state, { type: 'inspect-red-crate' });
      audio.play('reward');
    });
    return;
  }
  const wasCarrying = Boolean(state.player.carrying);
  if (action.type === 'pick-crate') manualStartedAt = performance.now();
  state = applyGameAction(state, {
    ...action,
    distance: 0,
    x: state.player.x,
    y: state.player.y,
  });
  if (action.type === 'inspect-red-crate') audio.play('reward');
  else audio.play(wasCarrying ? 'drop' : 'pickup');
  if (wasCarrying && action.target === 'pallet-a' && manualStartedAt !== null) {
    telemetry.mark('manual-transfer-ms', Math.round(performance.now() - manualStartedAt));
    manualStartedAt = null;
  }
}

function openMachineFromCanvas(event) {
  if (state.scene !== 'machine') return;
  const rect = canvas.getBoundingClientRect();
  const transform = getViewportTransform({ width: rect.width, height: rect.height }, state.player);
  const point = screenToWorld({ x: event.clientX - rect.left, y: event.clientY - rect.top }, transform);
  const player = {
    ...state.player,
    x: point.x,
    y: point.y,
  };
  const action = getNearbyAction({ ...state, player });
  if (action?.type !== 'open-machine') return;
  recordFirstAction();
  openMachinePanel();
}

function updateControls() {
  if (!started || machineOpen || storyActive || !document.querySelector('#futureComic').hidden) {
    input.consume('action');
    return;
  }
  if (input.consume('action')) useAction();
}

function updateHud(now = performance.now()) {
  startPanel.hidden = started;
  game.dataset.started = String(started);
  game.dataset.scene = state.scene;
  game.dataset.manualShowcase = showcaseManual ? 'true' : 'false';
  game.dataset.chipShowcase = showcaseChip ? 'true' : 'false';
  game.dataset.intro = state.scene === 'warehouse' && !state.warehouse.introComplete ? 'warehouse' : '';
  game.dataset.wakeReveal = state.arm.wakeRevealRemaining > 0 ? 'true' : 'false';
  const nearby = getNearbyAction(state);
  const firstActionGuide = narrowViewport.matches ? getFirstActionGuide(state) : null;
  game.dataset.firstActionGuide = firstActionGuide ? 'true' : 'false';
  const inWarehouse = ['warehouse', 'chip', 'machine', 'automation', 'red-crate', 'reward'].includes(state.scene);
  const powers = document.querySelectorAll('.power');
  powers.forEach((button) => { button.disabled = !state.powers[button.id.replace('power', '').toLowerCase()]; });
  const target = getInteractionTarget(state);
  const transform = getViewportTransform({ width: canvas.clientWidth, height: canvas.clientHeight }, getSceneCameraTarget(state));
  hud.action.style.display = target && !machineOpen && !storyActive ? 'flex' : 'none';
  hud.chip.hidden = true;
  hud.action.querySelector('.action-button__key').hidden = narrowViewport.matches;
  if (target) {
    const pos = placeWorldButton(target, transform, { width: canvas.clientWidth, height: canvas.clientHeight }, hud.action.offsetWidth || 220);
    hud.action.style.left = `${pos.x}px`;
    hud.action.style.top = `${pos.y}px`;
    hud.action.dataset.direction = pos.direction;
    hud.action.dataset.walking = String(Boolean(walkingTarget));
    hud.action.querySelector('b').textContent = walkingTarget ? 'ИДУ…' : `${pos.direction === 'left' ? '← ' : pos.direction === 'right' ? '→ ' : ''}${target.label}`;
    hud.action.querySelector('.action-button__key').textContent = nearby?.type === target.type ? 'SPACE / КЛИК' : 'КЛИК';
  }
  const coach = document.querySelector('#movementCoach');
  coach.hidden = !started || state.scene !== 'prologue' || firstMovementSeen;
  if (!coach.hidden) {
    const pos = placeWorldButton(state.player, transform, { width: canvas.clientWidth, height: canvas.clientHeight }, 290);
    coach.style.left = `${pos.x}px`; coach.style.top = `${pos.y}px`;
    coach.textContent = narrowViewport.matches ? 'Веди пальцем по полю · я стреляю сам' : '↑ ↓ ← → Двигайся · я стреляю сам';
  }
  wallet.hidden = !started || ['prologue', 'collapse'].includes(state.scene) || machineOpen;
  document.querySelector('#walletTotal').textContent = `$${state.warehouse.wage}`;
  document.querySelector('#walletMode').textContent = state.arm.awake ? `РУКА ЗАРАБОТАЛА $${state.warehouse.autoDelivered * 120}` : '+$120 за каждый ящик';
  incomeToast.hidden = now >= incomeNoticeUntil;

  if (state.scene === 'prologue') {
    hud.chapter.textContent = 'ПРОЛОГ · ВНУТРИ АНТИВИРУСА';
    hud.mission.textContent = firstMovementSeen ? 'Вычисти заражение' : 'Уничтожай вирусы';
    hud.message.textContent = 'WASD · МАНЕВРИРУЙ · ОРУДИЕ СТРЕЛЯЕТ САМО';
    hud.progress.style.width = `${(state.prologue.threats / 24) * 100}%`;
    hud.system.textContent = 'ЗАЩИТА';
    hud.sector.textContent = 'ТВОЙ ПК';
    hud.targets.textContent = `${state.prologue.threats}/24`;
  } else if (state.scene === 'collapse') {
    hud.chapter.textContent = 'СЕТЬ · СОЕДИНЕНИЕ ПОТЕРЯНО';
    hud.mission.textContent = state.sceneTime < 2 ? 'ОБРЫВ СВЯЗИ' : 'ПАМЯТЬ НЕ НАЙДЕНА';
    hud.message.textContent = state.sceneTime < 2 ? 'КАНАЛ РАЗРУШЕН' : 'ЗАГРУЗКА РЕАЛЬНОСТИ';
    hud.progress.style.width = '100%';
    hud.system.textContent = 'ОТКАЗ';
    hud.sector.textContent = '???';
    hud.targets.textContent = '—';
  } else if (inWarehouse) {
    hud.chapter.textContent = 'ГЛАВА 1 · НИЖНИЙ УРОВЕНЬ';
    if (state.scene === 'chip') {
      hud.mission.textContent = state.arm.chip === 'inserting' ? 'Чип встаёт на место' : 'Нашёлся чип Python';
      hud.message.textContent = state.arm.chip === 'inserting' ? 'РУКА 07 ПОЛУЧАЕТ НОВЫЙ НАВЫК' : 'НАЖМИ ЧИП · ВСТАВЬ ЕГО В РУКУ';
    } else if (state.scene === 'machine') {
      hud.mission.textContent = 'Чип установлен. Разбуди руку.';
      hud.message.textContent = machineOpen ? 'СОБЕРИ СИГНАЛ В ОКНЕ РЯДОМ' : 'НАЖМИ КНОПКУ НАД ТЕРМИНАЛОМ';
    } else if (state.scene === 'automation') {
      const revealing = state.arm.wakeRevealRemaining > 0;
      const failureCopy = state.arm.failure ? {
        reach: ['Рука увидела новый груз', 'МАНИПУЛЯТОР ТЯНЕТСЯ К КРАСНОМУ ЯЩИКУ'],
        scan: ['Сканирование груза', 'МАРШРУТ ИЩЕТ СОВПАДЕНИЕ'],
        'reject-one': ['Первый отказ', 'РУКУ ОТДЁРНУЛО · ПОВТОРНАЯ ПОПЫТКА'],
        'reject-two': ['Второй отказ', 'МАНИПУЛЯТОР НЕ МОЖЕТ ПРОДОЛЖИТЬ'],
        freeze: ['Рука застыла', 'СТАРЫЙ МАРШРУТ СЛОМАН'],
      }[state.arm.failure.phase] : null;
      hud.mission.textContent = failureCopy?.[0] ?? (revealing
        ? 'Машина услышала тебя'
        : (state.arm.active || state.arm.queue.length ? 'Работа идёт сама' : 'Дай машине правило'));
      hud.message.textContent = failureCopy?.[1] ?? (revealing
        ? 'PRINT ОТКРЫТ · РУКА 07 ПОЛУЧАЕТ ПИТАНИЕ'
        : (now < incomeNoticeUntil
        ? `+$120 · +4 МИНУТЫ СВОБОДЫ · АВТО ${state.warehouse.autoDelivered}/6`
        : (nearby?.label ?? (state.arm.active ? 'РУКА РАБОТАЕТ · ДЕНЬГИ КАПАЮТ' : `Автоматически: ${state.warehouse.autoDelivered}/6`))));
    } else if (state.scene === 'red-crate') {
      hud.mission.textContent = 'Машина остановилась';
      hud.message.textContent = nearby?.label ?? 'Подойди к красному ящику';
    } else if (state.scene === 'reward') {
      hud.mission.textContent = 'Первый контур восстановлен';
      hud.message.textContent = 'Q‑Bot ждёт дома';
    } else {
      hud.mission.textContent = 'Перенеси три ящика';
      hud.message.textContent = state.player.carrying ? 'ЯЩИК В РУКАХ · НАЖМИ КНОПКУ НАД ЛЕНТОЙ' : `ДОСТАВЛЕНО ${state.warehouse.manualDelivered}/3 · НАЖМИ КНОПКУ НАД ЯЩИКОМ`;
    }
    const completed = state.warehouse.manualDelivered + state.warehouse.autoDelivered;
    hud.progress.style.width = `${Math.min(100, (completed / 9) * 100)}%`;
    hud.system.textContent = state.arm.blocked ? 'БЛОК' : (state.arm.awake ? 'АВТО' : (state.scene === 'machine' ? 'ДОСТУП' : 'ОТКЛЮЧЕНА'));
    hud.sector.textContent = 'СКЛАД-07';
    hud.targets.textContent = state.arm.awake ? `${state.warehouse.autoDelivered}/6` : `${state.warehouse.manualDelivered}/3`;
  }

  hud.machine.hidden = !machineOpen;
  hud.ending.hidden = state.scene !== 'reward' || state.sceneTime < REWARD_REVEAL_DURATION || storyActive || !document.querySelector('#friendSandbox').hidden || !document.querySelector('#futureComic').hidden;
  document.querySelector('#journalToggle').hidden = !state.arm.awake || machineOpen || storyActive || !document.querySelector('#friendSandbox').hidden || !document.querySelector('#futureComic').hidden;
  hud.journal.hidden = !journalOpen || document.querySelector('#journalToggle').hidden;
  hud.printSkillMethod.textContent = codeInputMethod === 'assembled' ? 'СПОСОБ: СОБРАНО ИЗ ФРАГМЕНТОВ' : codeInputMethod === 'pasted'
    ? 'СПОСОБ: ВСТАВЛЕНО · ЗАСЧИТАНО'
    : 'СПОСОБ: НАБРАНО РУКАМИ';
  const mindCopy = {
    sleeping: ['СПИТ', 'Пока это только пустая оболочка.'],
    waking: ['СЛЫШИТ', 'Связь собирается…'],
    awake: ['ПРОСНУЛСЯ', 'Я слышу машину. Теперь научи меня понимать её.'],
    silent: ['МОЛЧИТ', 'Разум сейчас молчит. Рука всё равно тебя услышала.'],
  }[state.otherMind.phase];
  hud.otherMind.dataset.phase = state.otherMind.phase;
  hud.otherMindPhase.textContent = mindCopy[0];
  hud.otherMindLine.textContent = state.otherMind.line || mindCopy[1];
}

function frame(now) {
  if (showcaseChip) {
    const phase = (now - showcaseStartedAt) % 9000;
    if (phase < 2300 && state.scene !== 'chip') {
      state = createCheckpointState('chip');
      machineOpen = false;
    } else if (phase >= 2300 && state.scene === 'chip' && state.arm.chip === 'fallen') {
      state = applyGameAction(state, { type: 'insert-python-chip' });
    } else if (phase >= 3600 && state.scene === 'machine' && !machineOpen) {
      openMachinePanel();
    }
  }
  if (started && !machineOpen && !storyActive && Math.abs(input.state.moveX) + Math.abs(input.state.moveY) > 0) {
    firstMovementSeen = true;
    recordFirstAction();
  }
  updateControls();
  let movement = input.state;
  if (Math.abs(input.state.moveX) + Math.abs(input.state.moveY) > 0) walkingTarget = null;
  if (walkingTarget && !machineOpen && !storyActive && !exitOpen) {
    const target = getInteractionTarget(state);
    movement = navigateToTarget(state.player, target);
    if (movement.arrived || !target) {
      walkingTarget = null;
      if (target) useAction();
    }
  }
  state = stepGame(state, movement, (now - lastTime) / 1000, { paused: !started || machineOpen || storyActive || exitOpen || !document.querySelector('#friendSandbox').hidden || !document.querySelector('#futureComic').hidden });
  lastTime = now;
  if (state.scene !== lastScene) {
    if (!showcaseChip && ['warehouse', 'chip', 'machine', 'red-crate', 'reward'].includes(state.checkpoint)) persistence.save(state);
    lastScene = state.scene;
    if (state.scene === 'machine') {
      resetMachinePanel();
      prepareMachinePython();
      if (state.arm.chip === 'installed') openMachinePanel();
      audio.play('poster');
    }
    if (state.scene === 'warehouse') {
      warehouseCueStage = 0;
      tellStory('НАЧАЛЬНИК · СКЛАД-07', 'Проснулся? За работу.', 'Во сне ты управлял боевой машиной. Здесь — обычный человек на складе. За каждый ящик на ленте тебе платят $120. Старая рука рядом всё ещё пытается включиться…', 'ПОСМОТРЕТЬ НА ЯЩИКИ →');
    }
    if (state.scene === 'collapse') audio.play('collapse');
    if (state.scene === 'red-crate') audio.play('blocked');
    if (audio.created()) audio.setAmbient(ambientForScene());
    telemetry.mark(`scene-${state.scene}`);
  }
  if (state.scene === 'warehouse' && state.warehouse.bossEntrance && !state.warehouse.introComplete && state.sceneTime >= 3.65 && warehouseCueStage < 1) {
    warehouseCueStage = 1;
    audio.play('door');
  }
  if (state.arm.active && automationAcceptedAt !== null) {
    telemetry.mark('event-to-motion-ms', Math.round(now - automationAcceptedAt));
    automationAcceptedAt = null;
    lastAutoFinishedAt = now;
  }
  if (state.warehouse.autoDelivered > lastAutoDelivered) {
    if (lastAutoFinishedAt !== null) telemetry.mark('automatic-transfer-ms', Math.round(now - lastAutoFinishedAt));
    lastAutoFinishedAt = now;
    lastAutoDelivered = state.warehouse.autoDelivered;
  }
  if (state.warehouse.incomeAt !== lastIncomeAt && state.warehouse.incomeAt >= 0) {
    lastIncomeAt = state.warehouse.incomeAt;
    cashPeak = 0;
    audio.play('cash');
    incomeNoticeUntil = now + 1850;
    document.querySelector('#incomeSource').textContent = state.warehouse.incomeSource === 'robot' ? 'Рука заработала. Ты не таскал.' : 'Ящик доставлен. Ты заработал!';
    incomeToast.getAnimations().forEach(animation => animation.cancel());
    incomeToast.animate([{ opacity: 0, transform: 'translate(-50%, -50%) scale(.8)' }, { opacity: 1, transform: 'translate(-50%, -50%) scale(1.08)', offset: .2 }, { opacity: 1, transform: 'translate(-50%, -50%) scale(1)', offset: .85 }, { opacity: 0, transform: 'translate(-50%, -50%) scale(.96)' }], { duration: prefersReducedMotion ? 1 : 1850 });
  }
  if (state.prologue.threats > lastThreats) {
    if (started) { audio.play('cannon'); audio.play('impact'); }
    lastThreats = state.prologue.threats;
  }
  updateHud(now);
  companion.update(state.scene === 'reward' && !storyActive && !exitOpen && document.querySelector('#friendSandbox').hidden && document.querySelector('#futureComic').hidden, now);
  const wakeProgress = state.otherMind.phase === 'waking' && otherMindWakingAt !== null
    ? Math.min(1, Math.max(0, (now - otherMindWakingAt) / 1200))
    : (state.otherMind.phase === 'awake' ? 1 : 0);
  renderGame(
    ctx,
    state,
    { width: canvas.clientWidth, height: canvas.clientHeight },
    now,
    {
      reducedMotion: prefersReducedMotion,
      machineFocus: machineOpen,
      wakeProgress,
      firstActionGuide: narrowViewport.matches ? getFirstActionGuide(state) : null,
      manualShowcase: showcaseManual,
      chipShowcase: showcaseChip,
      showcaseStartedAt,
    },
  );
  if (isLocal) {
    const level = audio.level();
    audioPeak = Math.max(audioPeak, level);
    game.dataset.audioPeak = audioPeak.toFixed(5);
    game.dataset.audioLevel = level.toFixed(5);
    if (now < incomeNoticeUntil) cashPeak = Math.max(cashPeak, level);
    game.dataset.cashPeak = cashPeak.toFixed(5);
    game.dataset.incomeSource = state.warehouse.incomeSource ?? '';
  }
  requestAnimationFrame(frame);
}

for (const [selector, action] of [['#actionButton', 'action']]) {
  document.querySelector(selector).addEventListener('pointerdown', (event) => {
    event.preventDefault();
    recordFirstAction();
    unlockAudioForScene();
    const target = getInteractionTarget(state);
    if (target?.type === 'insert-python-chip') {
      state = applyGameAction(state, { type: 'insert-python-chip' });
      audio.play('power');
    } else if (target) walkingTarget = target;
  });
}

document.querySelector('#restartGame').addEventListener('click', () => {
  const progressed = state.checkpoint !== 'start';
  if (progressed && !window.confirm('Начать заново? Текущий прогресс этой игры исчезнет.')) return;
  persistence.reset();
  gameGeneration += 1;
  machineRunning = false;
  state = createGameState();
  started = false;
  walkingTarget = null;
  storyActive = false;
  storyCallback = null;
  friendVisited = false;
  journalOpen = false;
  document.querySelector('#storyBeat').hidden = true;
  comic.reset();
  friendSandbox.reset();
  lastIncomeAt = -100;
  lastAutoDelivered = 0;
  incomeNoticeUntil = 0;
  audio.setAmbient(null);
  otherMindWakingAt = null;
  prepareOtherMindRuntime();
  firstMovementSeen = false;
  machineOpen = false;
  wakeAttempts = 0;
  resetMachinePanel();
  lastThreats = 0;
  lastScene = state.scene;
});

document.querySelector('#closeMachine').addEventListener('click', () => {
  machineOpen = false;
});

hud.chip.addEventListener('click', () => {
  if (state.scene !== 'chip' || state.arm.chip !== 'fallen') return;
  recordFirstAction();
  audio.unlock();
  state = applyGameAction(state, { type: 'insert-python-chip' });
  hud.chip.hidden = true;
  audio.play('power');
});

hud.run.addEventListener('click', async () => {
  if (machineRunning) return;
  machineRunning = true;
  hud.run.disabled = true;
  hud.run.textContent = 'PYTHON ЗАПУСКАЕТСЯ…';
  hud.feedback.textContent = 'Поднимаю питание и передаю команду…';
  hud.feedback.dataset.status = 'loading';
  const source = hud.code.value;
  const runGeneration = gameGeneration;
  const runStarted = performance.now();
  const result = await runWake(source);
  if (runGeneration !== gameGeneration) return;
  telemetry.mark('python-wake-ui-ms', Math.round(performance.now() - runStarted));
  telemetry.mark('python-exec-ms', result.ms);
  if (!result.ok) {
    wakeAttempts += 1;
    const guidance = getWakeFailureGuidance(wakeAttempts, result, source);
    hud.feedback.textContent = guidance.message;
    if (guidance.prefill !== null) {
      hud.code.value = guidance.prefill;
      hud.code.setSelectionRange(hud.code.value.length, hud.code.value.length);
    }
    hud.code.focus();
    hud.feedback.dataset.status = 'error';
    document.querySelector('#signalPrompt').textContent = 'Чип поможет собрать сигнал. Нажми print, затем «проснись».';
    document.querySelector('#fragmentPrint').hidden = false;
  } else {
    state = applyGameAction(state, { type: 'first-command-accepted' });
    automationAcceptedAt = performance.now();
    persistence.save(state);
    audio.play('power');
    hud.feedback.textContent = 'КОМАНДА ПРИНЯТА · КНОПКА ОЖИЛА · МАРШРУТ ЗАПУЩЕН';
    hud.feedback.dataset.status = 'success';
    machineOpen = false;
    const mindResult = await otherMindRuntime.unlock(createMachineListeningEvent());
    if (runGeneration !== gameGeneration) return;
    if (!mindResult.ok) {
      hud.feedback.textContent = mindResult.line;
      hud.feedback.dataset.status = 'error';
    } else {
      hud.run.textContent = 'СВЯЗЬ УСТАНОВЛЕНА';
      await new Promise((resolve) => {
        window.setTimeout(resolve, OTHER_MIND_AWAKE_HOLD_DURATION * 1000);
      });
      if (runGeneration !== gameGeneration) return;
    }
    machineOpen = false;
  }
  machineRunning = false;
  hud.run.disabled = false;
  hud.run.innerHTML = '<span>▶</span> РАЗБУДИТЬ РУКУ';
});

hud.code.addEventListener('beforeinput', (event) => {
  if (event.inputType === 'insertFromPaste') codeInputMethod = 'pasted';
  else if (event.inputType?.startsWith('insert')) codeInputMethod = 'typed';
});

document.querySelector('#continueGame').addEventListener('click', () => {
  if (!friendVisited) {
    friendVisited = true;
    tellStory('ДОМА · СООБЩЕНИЕ ОТ ДРУГА', 'Ты освободил себе вечер.', '«Ты оживил ту руку? Тогда заходи в наш тренировочный чат. Мы устроили друг другу испытания — только в своей игровой сети». На столе мигает тот самый чип. Откуда на нём оказалась подсказка из твоего сна?', 'ОТКРЫТЬ ЧАТ ДРУЗЕЙ →', () => friendSandbox.open());
  } else comic.show(0);
});

document.querySelector('#soundToggle').addEventListener('click', async () => {
  await unlockAudioForScene();
  const muted = audio.toggle();
  const button = document.querySelector('#soundToggle');
  button.setAttribute('aria-pressed', String(muted));
  button.setAttribute('aria-label', muted ? 'Включить звук' : 'Выключить звук');
  button.textContent = muted ? '×))' : '◖))';
});

if (isLocal) {
  window.__QUEQUEST_AUDIO__ = audio;
  window.__QUEQUEST_DEBUG__ = {
    events: telemetry.events,
    snapshot: () => JSON.parse(JSON.stringify({
      scene: state.scene,
      checkpoint: state.checkpoint,
      player: state.player,
      threats: state.prologue.threats,
      remainingThreats: state.prologue.enemies.filter(({ alive }) => alive).length,
      lastShotAt: state.prologue.lastShotAt,
      manualDelivered: state.warehouse.manualDelivered,
      autoDelivered: state.warehouse.autoDelivered,
      wage: state.warehouse.wage,
      arm: state.arm,
      showcase: showcaseChip ? 'chip' : (showcaseManual ? 'manual' : false),
      crates: state.warehouse.crates,
      machineOpen,
      machineDraft: hud.code.value,
      inputFocused: document.activeElement === hud.code,
    })),
    dispatch: (action) => {
      state = applyGameAction(state, action);
      return window.__QUEQUEST_DEBUG__.snapshot();
    },
    measureFps: () => new Promise((resolve) => {
      let frames = 0;
      const started = performance.now();
      function count(now) {
        frames += 1;
        if (now - started >= 1000) resolve(Math.round((frames * 1000) / (now - started)));
        else requestAnimationFrame(count);
      }
      requestAnimationFrame(count);
    }),
    otherMind: () => ({
      ...otherMindRuntime.snapshot(),
      phase: state.otherMind.phase,
      line: state.otherMind.line,
    }),
  };
}

window.addEventListener('resize', resizeCanvas);
window.addEventListener('keydown', unlockAudioForScene, { once: true });
canvas.addEventListener('pointerdown', unlockAudioForScene, { once: true });
canvas.addEventListener('click', openMachineFromCanvas);
resizeCanvas();
if (state.scene === 'machine') {
  resetMachinePanel();
  prepareMachinePython();
}
updateHud();
requestAnimationFrame(frame);
