import { createInput } from './input.js';
import { createAudioBus } from './audio.js';
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
} from './model.js?v=5';
import { renderGame } from './render.js?v=9';
import { getWakeFailureGuidance } from './wake-help.js?v=2';
import { createCheckpointPersistence, loadCheckpoint } from './save.js?v=2';
import { createTelemetry } from './telemetry.js';
import { CHECKPOINTS, OTHER_MIND_AWAKE_HOLD_DURATION, REWARD_REVEAL_DURATION } from './config.js?v=6';
import { getViewportTransform, screenToWorld } from './viewport.js';

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
const requestedCheckpoint = new URLSearchParams(location.search).get('checkpoint');
const checkpoint = isLocal && CHECKPOINTS.includes(requestedCheckpoint)
  ? { checkpoint: requestedCheckpoint }
  : loadCheckpoint();
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const narrowViewport = window.matchMedia('(max-width: 760px)');
const telemetry = createTelemetry({ enabled: isLocal });
let state = createCheckpointState(checkpoint.checkpoint);
let fakeGateway;
let otherMindRuntime;
let otherMindWakingAt = null;
let lastTime = performance.now();
let firstMovementSeen = false;
let lastScene = state.scene;
let machineOpen = false;
let machineRunning = false;
let wakeAttempts = 0;
const input = createInput(canvas);
const audio = createAudioBus();
let lastAutoDelivered = state.warehouse.autoDelivered;
let lastThreats = state.prologue.threats;
let audioPeak = 0;
let firstActionRecorded = false;
let manualStartedAt = null;
let automationAcceptedAt = null;
let lastAutoFinishedAt = null;
let incomeNoticeUntil = 0;
let warehouseCueStage = 0;
let codeInputMethod = 'typed';

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
  hud.feedback.textContent = 'Канал не активен';
  hud.feedback.dataset.status = 'idle';
  hud.machineTitle.textContent = 'Терминал узла 07';
  hud.machineBrief.textContent = 'Мёртвая кнопка соединена с рукой. Здесь можно вернуть ей питание.';
  hud.code.value = '';
  wakeAttempts = 0;
}

function openMachinePanel() {
  machineOpen = true;
  prepareMachinePython();
  requestAnimationFrame(() => {
    if (machineOpen) hud.code.focus();
  });
}

function resizeCanvas() {
  const scale = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(canvas.clientWidth * scale));
  canvas.height = Math.max(1, Math.round(canvas.clientHeight * scale));
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
}

function useAction() {
  const action = getNearbyAction(state);
  if (!action) return;
  recordFirstAction();
  if (action.type === 'open-machine') {
    openMachinePanel();
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
  if (machineOpen) {
    input.consume('action');
    return;
  }
  if (input.consume('action')) useAction();
}

function updateHud(now = performance.now()) {
  game.dataset.scene = state.scene;
  game.dataset.intro = state.scene === 'warehouse' && !state.warehouse.introComplete ? 'warehouse' : '';
  game.dataset.wakeReveal = state.arm.wakeRevealRemaining > 0 ? 'true' : 'false';
  const nearby = getNearbyAction(state);
  const firstActionGuide = narrowViewport.matches ? getFirstActionGuide(state) : null;
  game.dataset.firstActionGuide = firstActionGuide ? 'true' : 'false';
  const inWarehouse = ['warehouse', 'machine', 'automation', 'red-crate', 'reward'].includes(state.scene);
  const powers = document.querySelectorAll('.power');
  powers.forEach((button) => { button.disabled = !state.powers[button.id.replace('power', '').toLowerCase()]; });
  hud.action.style.display = nearby && !machineOpen ? 'flex' : 'none';
  if (nearby) hud.action.querySelector('b').textContent = nearby.label;

  if (state.scene === 'prologue') {
    hud.chapter.textContent = 'ПРОЛОГ · ДО ПАДЕНИЯ';
    hud.mission.textContent = firstMovementSeen ? 'Верни контроль' : 'Ты всё умел. Теперь вспомни.';
    hud.message.textContent = 'WASD · МАНЕВРИРУЙ · ОРУДИЕ СТРЕЛЯЕТ САМО';
    hud.progress.style.width = `${(state.prologue.threats / 24) * 100}%`;
    hud.system.textContent = 'БОЕВАЯ';
    hud.sector.textContent = '00-А';
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
    if (state.scene === 'machine') {
      hud.mission.textContent = 'Со стены сорвало плакат';
      hud.message.textContent = nearby?.label ?? 'Подойди к загоревшемуся терминалу';
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
        ? `+ ₽120 · +4 МИНУТЫ СВОБОДЫ · АВТО ${state.warehouse.autoDelivered}/6`
        : (nearby?.label ?? (state.arm.active ? 'РУКА РАБОТАЕТ · ДЕНЬГИ КАПАЮТ' : `Автоматически: ${state.warehouse.autoDelivered}/6`))));
    } else if (state.scene === 'red-crate') {
      hud.mission.textContent = 'Машина остановилась';
      hud.message.textContent = nearby?.label ?? 'Подойди к красному ящику';
    } else if (state.scene === 'reward') {
      hud.mission.textContent = 'Первый контур восстановлен';
      hud.message.textContent = 'Q‑Bot ждёт дома';
    } else {
      hud.mission.textContent = 'Перенеси три ящика';
      hud.message.textContent = nearby?.label ?? firstActionGuide?.label ?? 'Найди ящик слева';
    }
    const completed = state.warehouse.manualDelivered + state.warehouse.autoDelivered;
    hud.progress.style.width = `${Math.min(100, (completed / 9) * 100)}%`;
    hud.system.textContent = state.arm.blocked ? 'БЛОК' : (state.arm.awake ? 'АВТО' : (state.scene === 'machine' ? 'ДОСТУП' : 'ОТКЛЮЧЕНА'));
    hud.sector.textContent = 'СКЛАД-07';
    hud.targets.textContent = state.arm.awake ? `${state.warehouse.autoDelivered}/6` : `${state.warehouse.manualDelivered}/3`;
  }

  hud.machine.hidden = !machineOpen;
  hud.ending.hidden = state.scene !== 'reward' || state.sceneTime < REWARD_REVEAL_DURATION;
  hud.journal.hidden = !['automation', 'red-crate'].includes(state.scene) || !state.arm.awake;
  hud.printSkillMethod.textContent = codeInputMethod === 'pasted'
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
  if (!machineOpen && Math.abs(input.state.moveX) + Math.abs(input.state.moveY) > 0) {
    firstMovementSeen = true;
    recordFirstAction();
  }
  updateControls();
  state = stepGame(state, input.state, (now - lastTime) / 1000, { paused: machineOpen });
  lastTime = now;
  if (state.scene !== lastScene) {
    if (['warehouse', 'machine', 'red-crate', 'reward'].includes(state.checkpoint)) persistence.save(state);
    lastScene = state.scene;
    if (state.scene === 'machine') {
      resetMachinePanel();
      prepareMachinePython();
      audio.play('poster');
    }
    if (state.scene === 'warehouse') warehouseCueStage = 0;
    if (state.scene === 'collapse') audio.play('collapse');
    if (state.scene === 'red-crate') audio.play('blocked');
    if (audio.created()) audio.setAmbient(ambientForScene());
    telemetry.mark(`scene-${state.scene}`);
  }
  if (state.scene === 'warehouse' && !state.warehouse.introComplete && state.sceneTime >= 3.65 && warehouseCueStage < 1) {
    warehouseCueStage = 1;
    audio.play('door');
  }
  if (state.arm.active && automationAcceptedAt !== null) {
    telemetry.mark('event-to-motion-ms', Math.round(now - automationAcceptedAt));
    automationAcceptedAt = null;
    lastAutoFinishedAt = now;
  }
  if (state.warehouse.autoDelivered > lastAutoDelivered) {
    audio.play('arm');
    if (lastAutoFinishedAt !== null) telemetry.mark('automatic-transfer-ms', Math.round(now - lastAutoFinishedAt));
    lastAutoFinishedAt = now;
    lastAutoDelivered = state.warehouse.autoDelivered;
    incomeNoticeUntil = now + 1100;
  }
  if (state.prologue.threats > lastThreats) {
    audio.play('cannon');
    audio.play('impact');
    lastThreats = state.prologue.threats;
  }
  updateHud(now);
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
    },
  );
  if (isLocal) {
    audioPeak = Math.max(audioPeak, audio.level());
    game.dataset.audioPeak = audioPeak.toFixed(5);
  }
  requestAnimationFrame(frame);
}

for (const [selector, action] of [['#actionButton', 'action']]) {
  document.querySelector(selector).addEventListener('pointerdown', (event) => {
    event.preventDefault();
    recordFirstAction();
    audio.unlock();
    input.press(action);
  });
}

document.querySelector('#restartGame').addEventListener('click', () => {
  const progressed = state.checkpoint !== 'start';
  if (progressed && !window.confirm('Начать заново? Текущий прогресс этой игры исчезнет.')) return;
  persistence.reset();
  state = createGameState();
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

hud.run.addEventListener('click', async () => {
  if (machineRunning) return;
  machineRunning = true;
  hud.run.disabled = true;
  hud.run.textContent = 'PYTHON ЗАПУСКАЕТСЯ…';
  hud.feedback.textContent = 'Поднимаю питание и передаю команду…';
  hud.feedback.dataset.status = 'loading';
  const source = hud.code.value;
  const runStarted = performance.now();
  const result = await runWake(source);
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
  } else {
    state = applyGameAction(state, { type: 'first-command-accepted' });
    automationAcceptedAt = performance.now();
    persistence.save(state);
    audio.play('power');
    hud.feedback.textContent = 'КОМАНДА ПРИНЯТА · КНОПКА ОЖИЛА · МАРШРУТ ЗАПУЩЕН';
    hud.feedback.dataset.status = 'success';
    const mindResult = await otherMindRuntime.unlock(createMachineListeningEvent());
    if (!mindResult.ok) {
      hud.feedback.textContent = mindResult.line;
      hud.feedback.dataset.status = 'error';
    } else {
      hud.run.textContent = 'СВЯЗЬ УСТАНОВЛЕНА';
      await new Promise((resolve) => {
        window.setTimeout(resolve, OTHER_MIND_AWAKE_HOLD_DURATION * 1000);
      });
    }
    machineOpen = false;
  }
  machineRunning = false;
  hud.run.disabled = false;
  hud.run.innerHTML = '<span>▶</span> ЗАПУСТИТЬ';
});

hud.code.addEventListener('beforeinput', (event) => {
  if (event.inputType === 'insertFromPaste') codeInputMethod = 'pasted';
  else if (event.inputType?.startsWith('insert')) codeInputMethod = 'typed';
});

document.querySelector('#continueGame').addEventListener('click', () => {
  document.querySelector('#endingTitle').textContent = 'ДАЛЬШЕ — БОТЫ, АГЕНТЫ И СВОЙ ИНОЙ РАЗУМ';
  document.querySelector('#continueGame').textContent = 'ПРОДОЛЖЕНИЕ СКОРО';
  document.querySelector('#continueGame').disabled = true;
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
      arm: state.arm,
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
