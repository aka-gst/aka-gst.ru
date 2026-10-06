// 19.2 · the shared site login (/akkaunty) installs window.QQ_PROFILE_ADAPTER
// before anything below resolves it — only on aka-gst.ru / ?akk=1 (akkaunty-adapter.js).
import './akkaunty-adapter.js';
import { createInput } from './input.js';
import { DOOR_SLAM_AT } from './chip-scene.js';
import { createCompanion } from './companion.js?v=center-virus-1';
import { createAudioBus } from './audio.js?v=novice-1';
import { getInteractionTarget, navigateToTarget, placeWorldButton } from './wayfinding.js?v=novice-1';
import { createFutureComic } from './future-comic.js?v=game-07';
import { createFriendSandbox } from './friend-sandbox.js?v=friends-defense-1';
import { createVikaMemory } from './vika-memory.js?v=vika-memory-1';
import { createVirusFinale } from './virus-finale.js?v=virus-finale-1';
import { createAutomationFoundry } from './automation-foundry.js?v=automation-foundry-1';
import { createAiLab } from './ai-lab.js?v=ai-lab-1';
import { createModelWorkbench } from './model-workbench.js?v=model-workbench-1';
import { createNeuralFoundry } from './neural-foundry.js?v=neural-foundry-1';
import { createLlmWorkshop } from './llm-workshop.js?v=llm-workshop-1';
import { createRetrievalWarehouse } from './retrieval-warehouse.js?v=retrieval-warehouse-1';
import { createBotForge } from './bot-forge.js?v=bot-forge-1';
import { createAutomationLab } from './automation-lab.js?v=automation-lab-1';
import { createAiFactoryCapstone } from './ai-factory-capstone.js?v=ai-factory-capstone-1';
import { createSimnetLab } from './simnet-lab.js?v=simnet-1';
import { createFactoryNexus } from './factory-nexus.js?v=nexus-1';
import { createOpsDesk } from './ops-desk.js?v=ops-desk-1';
import { createWorldGrid } from './world-grid.js?v=world-grid-2';
import { createAutomationCommons } from './automation-commons.js?v=commons-1';
import { createCityOperations } from './city-operations.js?v=operations-1';
import { createCityChronicle } from './city-chronicle.js?v=chronicle-1';
import { createCityWeave } from './city-weave.js?v=weave-1';
import { createCityThreads } from './city-threads.js?v=threads-1';
import { createQuestGuild } from './quest-guild.js?v=guild-1';
import { CAREER_REALMS, createCareerWorlds, foundationStatus, characterSheet, heldRealmDay, nextRealmDay } from './career-worlds.js?v=career-11';
// 19.0: optional exports of the professions screen (realmAvailability,
// enterGarageQuest); read through the namespace so this works before and
// after the garage/professions branch lands.
import * as careerApi from './career-worlds.js?v=career-11';
import { deviceFromQuery } from './vr-devices.js';
import { createFpWorld } from './fp-world.js?v=fp-world-8';
import { createPythonioBridge, markPythonioOrder } from './pythonio-bridge.js';
import { createBlackIceBridge } from './blackice-bridge.js';
import { markLabyrinthFloor, labyrinthCleared, LABYRINTH_FLOORS } from './labyrinth.js';
import { setCabinetProgress } from './labyrinth-cabinet.js';
import { markLockReward } from './locks/rewards.js';
import { engineProgress, eraFromProgress, engineStatus, buyUpgrade, levelFromProgress } from './engine-eras.js';
import { levelFromQuery } from './engine-ladder.js';
import { getCampusRank } from './campus-profile.js?v=campus-profile-7';
import { createFirstShift } from './first-shift.js?v=first-shift-182';
import { REFLEXES, gamerLine, hearMeaning, knowledgeFrom, homeChanges, saveSnapshot, saveReport, saveWords, loadRecord, saveRecord, mark } from './gamer-reflex.js';
import { createHourDesk, ruleSentence } from './hour-desk.js';
import { showSeam, confirmInPage } from './hour-ui.js';
import { skillTree as buildSkillTree, questLog as buildQuestLog, questPin } from './progress-map.js';
import { createSkillTreeView, createQuestLogView } from './journal-ui.js';
import { onReleaseKeys, releaseAllKeys } from './key-guard.js';
import { createTouchControls, isTouchDevice } from './touch-controls.js';
import { drawFace, faceIdFor } from './faces.js';
import { masteryEvent, listenForSkills, pythonioWay } from './mastery.js';
import { applyBuildLabels, BUILD } from './version.js';
import { createRing } from './duel-ui.js';
import { resolveAdapter, profileSnapshot, applySnapshot } from './profile-store.js';
import { createAccountUi } from './account-ui.js';
// 19.0 · the first week: five days, button → fired → Витя's garage.
import { isWeekCheckpoint, weekDayOf, weekClock, weekPin, payLedger, legacyFromQuery, weekFromLegacy, BOSS_END, BOSS_MORNING, HALL_MORNING, EVENING, MORNING, FIRED, CORP, WEEK_PAY_CHECKPOINTS } from './week.js';
import { createPayCard, createWeekPin } from './week-ui.js';
import { firedHandoff } from './week-hooks.js';
import { createFactoryView, toWorld as hallToWorld, hallAimPoints } from './factory-view.js';
import { createSorterBay } from './sorter-bay.js?v=sorter-1';
import { createContractBoard } from './contract-board.js?v=contracts-1';
import { createSystemSandbox } from './system-sandbox.js?v=sandbox-1';
import { createPythonContracts } from './python-contracts.js?v=python-contracts-1';
import { createEngineerCampus } from './engineer-campus.js?v=campus-6';
import {
  loadCampusProfile, saveCampusProfile, createCampusProfile, markContractSolved, markPythonContractSolved, markSandboxSolved, markModelDatasetSolved, markCampusMission, markFactoryTrialSolved, markSimnetIncidentSolved, markNexusResearch, markNexusMission, markNexusRemix, markNexusTrialSolved, markNexusCompanionLesson, markNexusCompanionBuild, markDeskIncidentSolved, markWorldStorySolved, markWorldShiftSolved, markCommonsBlueprint, markCommonsDay, markCommonsCode, markOperationsArc, markOperationsRollback, markOperationsShift, markOperationsCode, markChronicleArc, markChronicleWindow, markChronicleCode, markWeaveArc, markWeaveSeason, markWeaveCode, markThreadsEpisode, markThreadsCycle, markThreadsCode, markGuildQuest, markGuildJob, markGuildRaid, markGuildRealm, markLabComplete,
} from './campus-profile.js?v=campus-profile-7';
import {
  createFakeGateway,
  createOtherMindRuntime,
} from './other-mind.js';
import {
  applyGameAction,
  createCheckpointState,
  createGameState,
  getFirstActionGuide,
  getNearbyAction,
  stepGame,
} from './model.js?v=game-190';
import { renderGame } from './render.js?v=game-03';
import { EXPLAIN_MODE_KEY, getAdaptiveCoach, getConceptBridge, getManualIncomeCopy, getSkillRecorderBeat, normalizeExplainMode } from './engagement-director.js?v=4';
import { createCheckpointPersistence, loadCheckpoint } from './save.js?v=190';
import { createTelemetry } from './telemetry.js';
import { CHECKPOINTS, CRATE_PAY, REWARD_REVEAL_DURATION } from './config.js?v=game-190';
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
  endingEyebrow: document.querySelector('#endingEyebrow'),
  endingTitle: document.querySelector('#endingTitle'),
  endingCopy: document.querySelector('#endingCopy'),
  code: document.querySelector('#codeInput'),
  run: document.querySelector('#runCode'),
  feedback: document.querySelector('#codeFeedback'),
  machineTitle: document.querySelector('#machineTitle'),
  machineBrief: document.querySelector('#machineBrief'),
  otherMind: document.querySelector('#otherMindStatus'),
  otherMindPhase: document.querySelector('#otherMindPhase'),
  otherMindLine: document.querySelector('#otherMindLine'),
  journal: document.querySelector('#skillJournal'),
  printSkill: document.querySelector('#printSkill'),
  forSkill: document.querySelector('#forSkill'),
  ifSkill: document.querySelector('#ifSkill'),
  listSkill: document.querySelector('#listSkill'),
  whileSkill: document.querySelector('#whileSkill'),
  funcSkill: document.querySelector('#funcSkill'),
  dictSkill: document.querySelector('#dictSkill'),
  reliabilitySkill: document.querySelector('#reliabilitySkill'),
  asyncSkill: document.querySelector('#asyncSkill'),
  aiSkill: document.querySelector('#aiSkill'),
  llmSkill: document.querySelector('#llmSkill'),
  botSkill: document.querySelector('#botSkill'),
  printSkillMethod: document.querySelector('#printSkillMethod'),
  codeReality: document.querySelector('#codeRealityLine'),
  programViz: document.querySelector('#programViz'),
  programVizCells: document.querySelector('#programVizCells'),
  programVizStep: document.querySelector('#programVizStep'),
  programVizLoop: document.querySelector('#programVizLoop'),
  programVizGate: document.querySelector('#programVizGate'),
  programVizAction: document.querySelector('#programVizAction'),
  storageWarning: document.querySelector('#storageWarning'),
  bridge: document.querySelector('#conceptBridge'),
  bridgeWorld: document.querySelector('#bridgeWorld'),
  bridgeMeaning: document.querySelector('#bridgeMeaning'),
  bridgePython: document.querySelector('#bridgePython'),
  bridgeQuestion: document.querySelector('#bridgeQuestion'),
  skillRecorder: document.querySelector('#skillRecorder'),
  skillRecorderLabel: document.querySelector('#skillRecorderLabel'),
  skillRecorderCells: document.querySelector('#skillRecorderCells'),
  skillRecorderCopy: document.querySelector('#skillRecorderCopy'),
  coach: document.querySelector('#adaptiveCoach'),
  coachTitle: document.querySelector('#adaptiveCoachTitle'),
  coachText: document.querySelector('#adaptiveCoachText'),
};

const isLocal = ['127.0.0.1', 'localhost'].includes(location.hostname);
const query = new URLSearchParams(location.search);
const requestedCheckpoint = query.get('checkpoint');
const showcaseChip = query.get('showcase') === 'chip';
const showcaseManual = query.get('showcase') === 'manual';
game.dataset.chipShowcase = showcaseChip ? 'true' : 'false';
// 19.0: chapters 5–10 and the campus only open with ?legacy=1; without it
// an old save lands on the matching day of the first week.
const legacy = legacyFromQuery(location.search)
  || Boolean(isLocal && requestedCheckpoint && CHECKPOINTS.includes(requestedCheckpoint) && !isWeekCheckpoint(requestedCheckpoint) && !['start', 'warehouse'].includes(requestedCheckpoint));
const checkpoint = (isLocal && CHECKPOINTS.includes(requestedCheckpoint)) || requestedCheckpoint === 'start'
  ? { checkpoint: requestedCheckpoint }
  : (showcaseChip ? { checkpoint: 'chip' } : (showcaseManual ? { checkpoint: 'warehouse' } : loadCheckpoint()));
if (!legacy && !showcaseChip && !showcaseManual) checkpoint.checkpoint = weekFromLegacy(checkpoint.checkpoint);
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const narrowViewport = window.matchMedia('(max-width: 760px)');
const telemetry = createTelemetry({ enabled: isLocal });
let state = checkpoint.checkpoint === 'start'
  ? createGameState({ scene: 'warehouse', checkpoint: 'start' })
  : createCheckpointState(checkpoint.checkpoint);
if (showcaseManual) state = { ...state, warehouse: { ...state.warehouse, introComplete: true } };
let fakeGateway;
let otherMindRuntime;
let otherMindWakingAt = null;
let lastTime = performance.now();
let firstMovementSeen = false;
let lastScene = state.scene;
let machineOpen = false;
let gameGeneration = 0;
let wakeAttempts = 0;
const input = createInput(canvas);
const companion = createCompanion(game, document.querySelector('#cursorCompanion'), hud.ending, prefersReducedMotion);
const audio = createAudioBus();
// 17.0: the warehouse chapters in the same Doom-style hall as Shift 1, with
// look up/down, jumping onto things, and people who comment.
const forcedEngineLevel = levelFromQuery(location.search);
const factoryView = createFactoryView({ onSound: name => audio.play(name), onFlag: (name) => setFlag(name), reducedMotion: prefersReducedMotion, getEngineLevel: () => engineLevelNow(), slip: (event) => hallSlip(event) });
const lookKeys = new Set();
window.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement) return;
  if (['KeyR', 'KeyF', 'PageUp', 'PageDown'].includes(event.code)) lookKeys.add(event.code);
});
window.addEventListener('keyup', (event) => lookKeys.delete(event.code));
window.addEventListener('blur', () => lookKeys.clear());
onReleaseKeys(() => lookKeys.clear());
const firstShift = createFirstShift(document.querySelector('#firstShift'), {
  onFlag: (name) => setFlag(name),
  onSound: name => audio.play(name),
  // 18.2 (§16): the hand remembered something; one gamer slip per scene.
  onReflex: (id) => reflexFired(id),
  gamerLine: (scene) => takeSlip(scene),
  onComplete: ({ delivered = 3, extra = 0, player = null } = {}) => {
    remember('quests', 'quest1');
    if (!legacy) { weekChipIn({ delivered, extra, player }); return; }
    state = createCheckpointState('chip');
    state = { ...state, warehouse: { ...state.warehouse, wage: Math.max(state.warehouse.wage, (delivered + extra) * CRATE_PAY) } };
    lastScene = state.scene;
    warehouseYaw = -1.0;
    // 17.0: same hall, same spot -- you stay where you picked the chip up,
    // looking where you looked, instead of jumping into another warehouse.
    if (player) {
      state = { ...state, player: { ...state.player, ...hallToWorld(player) } };
      warehouseYaw = player.yaw;
      factoryView.place(state);
    }
    started = true;
    lastTime = performance.now();
    startPanel.hidden = true;
    persistence.save(state);
    audio.setAmbient('warehouse');
    telemetry.mark('first-shift-chip-found');
  },
});
// 18.0: the first hour's terminal (day 2): print with words, the rule panel,
// then the same rule as `if`. Runs on mini-python, no Pyodide download.
const hourDesk = createHourDesk(document.querySelector('#hourDesk'), {
  sound: (name) => audio.play(name),
  getColors: () => state.warehouse.crates.filter((crate) => crate.status === 'queued').map((crate) => (crate.kind === 'red' ? 'red' : 'white')),
  getLines: () => {
    const q = state.warehouse.crates.filter((crate) => crate.status === 'queued');
    const col = (crate) => (crate.kind === 'red' ? 'red' : 'white');
    return { a: q.filter((c) => c.line === 'A').map(col), b: q.filter((c) => c.line === 'B').map(col) };
  },
  onLesson: ({ lesson, stage, result, hints }) => {
    const scene = state.scene;
    const queued = state.warehouse.crates.filter((crate) => crate.status === 'queued');
    const move = (crate) => ({ type: 'arm.move', boxId: crate.id, targetId: 'pallet-a' });
    const way = stage === 'tap' ? 'tap' : (stage === 'knobs' ? 'knobs' : 'code');
    recordSkill(lesson, way, { stage: way === 'code' ? (hints ? 2 : 3) : 1, hints, key: `${lesson}:${stage}` });
    const finalStage = (scene === 'forlesson' && stage === 'combo') || (scene !== 'forlesson' && stage === 'code');
    if (finalStage && !hints) recordSkill(lesson, 'raw', { stage: 1, key: `${lesson}:raw` });
    if (!finalStage) {
      const events = stage === 'code' && result?.taken ? result.taken.map((i) => queued[i]).filter(Boolean).map(move) : null;
      state = applyGameAction(state, { type: 'lesson-accepted', ...(events ? { events } : {}) });
    } else if (scene === 'forlesson') {
      state = applyGameAction(state, { type: 'for-command-accepted', events: result.taken.map((i) => queued[i]).filter(Boolean).map(move) });
    } else if (scene === 'queue') {
      state = applyGameAction(state, { type: 'queue-command-accepted', events: result.taken.map((i) => queued[i]).filter(Boolean).map(move) });
    } else if (scene === 'function') {
      const a = queued.filter((c) => c.line === 'A'); const b = queued.filter((c) => c.line === 'B');
      state = applyGameAction(state, { type: 'function-command-accepted', events: [...result.takenA.map((i) => a[i]), ...result.takenB.map((i) => b[i])].filter(Boolean).map(move) });
    }
    automationAcceptedAt = performance.now();
    persistence.save(state);
    factoryView.comment('code-ok');
  },
  onWake: () => {
    recordSkill('print', state.warehouse.day2 === 'print2' ? 'raw' : 'code', { stage: state.warehouse.day2 === 'print2' ? 1 : 2, hints: hourDesk.hints(), key: `print:${state.warehouse.day2}` });
    state = applyGameAction(state, { type: 'first-command-accepted' });
    automationAcceptedAt = performance.now();
    persistence.save(state);
    factoryView.comment('code-ok');
  },
  onRules: (rules, verdict) => {
    lastRules = rules;
    if (verdict.fine) { audio.play('hit'); factoryView.say('radio', 'Красный?! ШТРАФ! Я всё вижу!'); }
    if (!verdict.ok) return;
    recordSkill('if', 'knobs', { stage: 2, key: 'if:rules' });
    state = applyGameAction(state, { type: 'condition-rules-accepted', rules });
    automationAcceptedAt = performance.now();
    persistence.save(state);
  },
  onRule: (decisions) => {
    recordSkill('if', 'code', { stage: hourDesk.hints() ? 2 : 3, hints: hourDesk.hints(), key: 'if:code' });
    if (!hourDesk.hints()) recordSkill('if', 'raw', { stage: 1, key: 'if:raw' });
    const queued = state.warehouse.crates.filter((crate) => crate.status === 'queued');
    const events = queued.filter((crate, i) => decisions[i]?.take).map((crate) => ({ type: 'arm.move', boxId: crate.id, targetId: 'pallet-a' }));
    state = applyGameAction(state, { type: 'condition-command-accepted', events });
    automationAcceptedAt = performance.now();
    persistence.save(state);
  },
  // 19.0 · the first week: what you copied / assembled / wrote moves the arm.
  onWeek: ({ step, result, hints }) => {
    const queued = state.warehouse.crates.filter((crate) => crate.status === 'queued');
    const move = (crate) => ({ type: 'arm.move', boxId: crate.id, targetId: 'pallet-a' });
    let events = [];
    if (step === 'copy') {
      recordSkill('print', 'knobs', { stage: 2, key: 'print:copy' });
      events = queued.filter((c) => c.kind === 'normal').map(move);
    } else if (step === 'assemble' || step === 'hand') {
      if (step === 'assemble') recordSkill('if', 'knobs', { stage: 2, key: 'if:assemble' });
      else { recordSkill('if', 'code', { stage: hints ? 2 : 3, hints, key: 'if:hand' }); if (!hints) recordSkill('if', 'raw', { stage: 1, key: 'if:raw' }); }
      events = queued.filter((c, i) => result.decisions?.[i]?.take).map(move);
    } else if (step === 'auto') {
      recordSkill('for', 'code', { stage: hints ? 2 : 3, hints, key: 'for:auto' });
      events = (result.taken ?? []).map((i) => queued[i]).filter(Boolean).map(move);
    }
    state = applyGameAction(state, { type: 'week-command-accepted', events });
    automationAcceptedAt = performance.now();
    persistence.save(state);
    factoryView.comment('code-ok');
  },
  onClose: () => { canvas.focus?.({ preventScroll: true }); },
});
let lastRules = { white: 'take', red: 'leave' };
// 18.1: every lesson proof goes into the one §13 registry (mastery.js).
function recordSkill(skill, way, { stage = 1, hints = 0, key } = {}) {
  const r = masteryEvent(campusProfile, { skill, way, stage, hints, source: 'quequest', key: `qq:${key}` });
  if (r.first) updateCampusProfile({ type: 'replace', profile: r.profile });
  return r.first;
}
// Portals (Pythonio, TD Lab, …) report skills with postMessage({ type: 'deep:skill', … }).
listenForSkills((msg) => {
  const r = masteryEvent(campusProfile, msg);
  if (r.first) updateCampusProfile({ type: 'replace', profile: r.profile });
});
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
let warehouseYaw = -1.0;
let lastIncomeAt = state.warehouse.incomeAt;
let storyActive = false;
let storyCallback = null;
function loadExplainMode() {
  try { return normalizeExplainMode(localStorage.getItem(EXPLAIN_MODE_KEY)); } catch { return 'guided'; }
}
function saveExplainMode(value) {
  try { localStorage.setItem(EXPLAIN_MODE_KEY, value); } catch {}
}
let explainMode = loadExplainMode();
let engagementProgressKey = '';
let engagementProgressAt = performance.now();
let friendVisited = ['reward5', 'vika', 'reward6', 'virus', 'reward7', 'foundry', 'reward8', 'campus', 'ai-lab', 'reward9', 'llm-lab', 'reward10'].includes(checkpoint.checkpoint);
let journalOpen = false;
let exitOpen = false;
const BLOCKING_OVERLAY_IDS = ['deepRing','firstShift','hourDesk','seamFlash','skillTree','questLog','confirmDialog','careerWorlds','fpWorld','pythonioDive','blackiceDive','questGuild','friendSandbox','vikaMemory','virusFinale','automationFoundry','futureComic','sorterBay','engineerCampus','contractBoard','systemSandbox','pythonContracts','aiLab','modelWorkbench','neuralFoundry','llmWorkshop','retrievalWarehouse','botForge','automationLab','aiFactoryCapstone','simnetLab','factoryNexus','opsDesk','worldGrid','automationCommons','cityOperations','cityChronicle','cityWeave','cityThreads'];
function isBlockingOverlayOpen() {
  return BLOCKING_OVERLAY_IDS.some((id) => !document.querySelector(`#${id}`)?.hidden);
}
const FIRST_PERSON_SCENES = new Set(['warehouse','chip','machine','automation','red-crate','condition','forlesson','queue','function']);
function wrapAngle(value) {
  let angle = value;
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}
function firstPersonScene() { return FIRST_PERSON_SCENES.has(state.scene); }
function firstPersonActive() {
  return started && firstPersonScene() && !machineOpen && !storyActive && !exitOpen && !isBlockingOverlayOpen();
}
function yawTo(target) {
  if (!target) return warehouseYaw;
  return Math.atan2(target.x - state.player.x, -(target.y - state.player.y));
}
function faceTarget(target) { warehouseYaw = yawTo(hallAimPoints(target)[0] ?? target); }
function lookingAt(target, tolerance = .52) {
  return Boolean(target) && hallAimPoints(target).some((point) => Math.abs(wrapAngle(yawTo(point) - warehouseYaw)) <= tolerance);
}
const startPanel = document.querySelector('#startPanel');
const wallet = document.querySelector('#wallet');
const incomeToast = document.querySelector('#incomeToast');
const explainModeToggle = document.querySelector('#explainModeToggle');
const explainToggle = document.querySelector('#explainToggle');
function syncExplainMode() {
  const compact = explainMode === 'compact';
  game.dataset.explain = explainMode;
  explainModeToggle?.setAttribute('aria-pressed', String(compact));
  if (explainModeToggle) {
    explainModeToggle.querySelector('b').textContent = compact ? 'Я УЖЕ ПИСАЛ КОД' : 'Я НИКОГДА НЕ ПРОГАЛ';
    document.querySelector('#explainModeCopy').textContent = compact
      ? 'Оставь те же игровые действия, но убери ранние объяснения и задержи подсказки.'
      : 'Объясняй через действия и смысл. Код покажи потом.';
  }
  explainToggle?.setAttribute('aria-pressed', String(compact));
  if (explainToggle) {
    explainToggle.textContent = compact ? 'ПОДСКАЗКИ: КРАТКО' : 'ПОДСКАЗКИ: ПОДР.';
    explainToggle.setAttribute('aria-label', compact ? 'Включить подробные объяснения' : 'Сделать объяснения компактнее');
  }
}
function toggleExplainMode() {
  explainMode = explainMode === 'guided' ? 'compact' : 'guided';
  saveExplainMode(explainMode);
  syncExplainMode();
  engagementProgressAt = performance.now();
}
explainModeToggle?.addEventListener('click', toggleExplainMode);
explainToggle?.addEventListener('click', toggleExplainMode);
syncExplainMode();
const comic = createFutureComic(document.querySelector('#futureComic'), { onSound: name => audio.play(name) });
const sorterBay = createSorterBay(document.querySelector('#sorterBay'), {
  onSound: name => audio.play(name),
  onSolved: ({ seed, difficulty, rule }) => telemetry.mark(`sorter-${difficulty}-${rule}`, seed),
});
const friendSandbox = createFriendSandbox(document.querySelector('#friendSandbox'), {
  onComplete: () => {},
  onSound: name => audio.play(name),
  onCheckpoint: phase => {
    state = applyGameAction(state, { type: phase === 'complete' ? 'friends-defense-complete' : 'start-friends-defense' });
    persistence.save(state);
    telemetry.mark(`friends-defense-${phase}`);
  },
});
const vikaMemory = createVikaMemory(document.querySelector('#vikaMemory'), {
  onComplete: () => {},
  onSound: name => audio.play(name),
  onCheckpoint: phase => {
    state = applyGameAction(state, { type: phase === 'complete' ? 'vika-memory-complete' : 'start-vika-memory' });
    persistence.save(state);
    telemetry.mark(`vika-memory-${phase}`);
  },
});
const virusFinale = createVirusFinale(document.querySelector('#virusFinale'), {
  onComplete: () => {},
  onSound: name => audio.play(name),
  onCheckpoint: phase => {
    state = applyGameAction(state, { type: phase === 'complete' ? 'virus-finale-complete' : 'start-virus-finale' });
    persistence.save(state);
    telemetry.mark(`virus-finale-${phase}`);
  },
});
const automationFoundry = createAutomationFoundry(document.querySelector('#automationFoundry'), {
  onComplete: () => {},
  onSound: name => audio.play(name),
  onCheckpoint: phase => {
    state = applyGameAction(state, { type: phase === 'complete' ? 'automation-foundry-complete' : 'start-automation-foundry' });
    persistence.save(state);
    telemetry.mark(`automation-foundry-${phase}`);
  },
});
let campusProfile = loadCampusProfile();
// Campaign checkpoints remain authoritative if optional local campus meta-progress
// was cleared. Rebuild unlock facts without granting XP so account/import sync can
// never relock content the player already finished in the story save.
if (state.learning.aiUnlocked && !campusProfile.labs.ai.completed) {
  campusProfile = markLabComplete(campusProfile, 'ai', { bestAccuracy: campusProfile.labs.ai.bestAccuracy }, 0);
}
if (state.learning.llmUnlocked && !campusProfile.labs.llm.completed) {
  campusProfile = markLabComplete(campusProfile, 'llm', { missions: campusProfile.labs.llm.missions }, 0);
}
saveCampusProfile(campusProfile);
function syncCampusSkillJournal() {
  const pairs = [['#neuralSkill', campusProfile.labs.neural.completed], ['#ragSkill', campusProfile.labs.retrieval.completed], ['#agentSkill', campusProfile.labs.bot.completed], ['#automationSkill', campusProfile.labs.automation.completed], ['#factorySkill', campusProfile.labs.factory.completed], ['#simnetSkill', campusProfile.labs.simnet.completed], ['#deskSkill', campusProfile.labs.desk.completedMissions.length >= 5], ['#nexusSkill', campusProfile.labs.nexus.completedMissions.length >= 6], ['#commonsSkill', campusProfile.labs.commons.completedBriefs.length >= 4], ['#operationsSkill', campusProfile.labs.operations.completedArcs.length >= 5], ['#chronicleSkill', campusProfile.labs.chronicle.completedArcs.length >= 5], ['#weaveSkill', campusProfile.labs.weave.completedArcs.length >= 5], ['#threadsSkill', campusProfile.labs.threads.completedEpisodes.length >= 10], ['#guildSkill', (campusProfile.labs.guild?.completedQuests?.length ?? 0) > 0 || (campusProfile.labs.guild?.jobSeeds?.length ?? 0) > 0]];
  for (const [selector, unlocked] of pairs) { const node = document.querySelector(selector); if (node) node.dataset.unlocked = String(Boolean(unlocked)); }
}
syncCampusSkillJournal();
function updateCampusProfile(action) {
  if (action?.type === 'replace') campusProfile = action.profile;
  else if (action?.type === 'contract') campusProfile = markContractSolved(campusProfile, action.id, action.score, action.xp);
  else if (action?.type === 'python-contract') campusProfile = markPythonContractSolved(campusProfile, action.id, action.checks, action.xp);
  else if (action?.type === 'sandbox') campusProfile = markSandboxSolved(campusProfile, action.seed, action.score, action.xp);
  else if (action?.type === 'model-dataset') campusProfile = markModelDatasetSolved(campusProfile, action.id, action.accuracy, action.epochs, action.xp);
  else if (action?.type === 'lab-mission') campusProfile = markCampusMission(campusProfile, action.lab, action.id, action.patch, action.xp);
  else if (action?.type === 'code-run') campusProfile = { ...campusProfile, stats: { ...campusProfile.stats, codeRuns: campusProfile.stats.codeRuns + 1 } };
  else if (action?.type === 'ai-complete') campusProfile = markLabComplete(campusProfile, 'ai', { bestAccuracy: Math.max(campusProfile.labs.ai.bestAccuracy, action.accuracy ?? 0), feedbackRounds: Math.max(campusProfile.labs.ai.feedbackRounds, action.feedbackRounds ?? 0) }, 220);
  else if (action?.type === 'neural-complete') campusProfile = markLabComplete(campusProfile, 'neural', { bestAccuracy: Math.max(campusProfile.labs.neural.bestAccuracy, action.accuracy ?? 0), bestLoss: Math.min(campusProfile.labs.neural.bestLoss, action.loss ?? 999), epochs: Math.max(campusProfile.labs.neural.epochs, action.epochs ?? 0) }, 260);
  else if (action?.type === 'llm-complete') campusProfile = markLabComplete(campusProfile, 'llm', { missions: Math.max(campusProfile.labs.llm.missions, action.missions ?? 0) }, 240);
  else if (action?.type === 'retrieval-complete') campusProfile = markLabComplete(campusProfile, 'retrieval', { bestRecall: Math.max(campusProfile.labs.retrieval.bestRecall, action.bestRecall ?? 0) }, 280);
  else if (action?.type === 'bot-complete') campusProfile = markLabComplete(campusProfile, 'bot', { feedbackRounds: Math.max(campusProfile.labs.bot.feedbackRounds, action.feedbackRounds ?? 0) }, 360);
  else if (action?.type === 'automation-complete') campusProfile = markLabComplete(campusProfile, 'automation', { safeRuns: Math.max(campusProfile.labs.automation.safeRuns, action.missions ?? 0) }, 360);
  else if (action?.type === 'factory-complete') campusProfile = markLabComplete(campusProfile, 'factory', { bestScore: Math.max(campusProfile.labs.factory.bestScore, action.score ?? 0), bestCost: Math.min(campusProfile.labs.factory.bestCost, action.cost ?? 999) }, 600);
  else if (action?.type === 'factory-trial') campusProfile = markFactoryTrialSolved(campusProfile, action.seed, action.score, action.xp);
  else if (action?.type === 'simnet-complete') campusProfile = markLabComplete(campusProfile, 'simnet', {}, 700);
  else if (action?.type === 'simnet-incident') campusProfile = markSimnetIncidentSolved(campusProfile, action.seed, action.score, action.xp);
  else if (action?.type === 'nexus-research') campusProfile = markNexusResearch(campusProfile, action.id, action.xp);
  else if (action?.type === 'nexus-mission') campusProfile = markNexusMission(campusProfile, action.id, action.score, action.lesson, action.xp, action.blueprint);
  else if (action?.type === 'nexus-remix') campusProfile = markNexusRemix(campusProfile, action.id, action.xp);
  else if (action?.type === 'nexus-trial') campusProfile = markNexusTrialSolved(campusProfile, action.seed, action.score, action.xp, action.blueprint);
  else if (action?.type === 'nexus-companion-lesson') campusProfile = markNexusCompanionLesson(campusProfile, action.lesson, action.xp);
  else if (action?.type === 'nexus-companion-build') campusProfile = markNexusCompanionBuild(campusProfile, action.build, action.xp);
  else if (action?.type === 'desk-complete') campusProfile = markLabComplete(campusProfile, 'desk', { bestScore: Math.max(campusProfile.labs.desk?.bestScore ?? 0, action.score ?? 0) }, 420);
  else if (action?.type === 'desk-incident') campusProfile = markDeskIncidentSolved(campusProfile, action.seed, action.score, action.xp);
  else if (action?.type === 'world-story') campusProfile = markWorldStorySolved(campusProfile, action.id, action.score, action.discovered, action.playbook, action.xp, action.mastery);
  else if (action?.type === 'world-shift') campusProfile = markWorldShiftSolved(campusProfile, action.seed, action.score, action.discovered, action.playbook, action.xp, action.mastery, action.direct, action.blackBox);
  else if (action?.type === 'commons-blueprint') campusProfile = markCommonsBlueprint(campusProfile, action.id, action.blueprint, action.score, action.efficiency, action.xp);
  else if (action?.type === 'commons-day') campusProfile = markCommonsDay(campusProfile, action.seed, action.score, action.xp);
  else if (action?.type === 'commons-code') campusProfile = markCommonsCode(campusProfile, action.xp);
  else if (action?.type === 'operations-arc') campusProfile = markOperationsArc(campusProfile, action.id, action.patch, action.trust, action.xp);
  else if (action?.type === 'operations-rollback') campusProfile = markOperationsRollback(campusProfile, action.id, action.xp);
  else if (action?.type === 'operations-shift') campusProfile = markOperationsShift(campusProfile, action.seed, action.score, action.xp);
  else if (action?.type === 'operations-code') campusProfile = markOperationsCode(campusProfile, action.xp);
  else if (action?.type === 'chronicle-arc') campusProfile = markChronicleArc(campusProfile, action.id, action.decision, action.debt, action.postmortem, action.xp);
  else if (action?.type === 'chronicle-window') campusProfile = markChronicleWindow(campusProfile, action.seed, action.score, action.xp);
  else if (action?.type === 'chronicle-code') campusProfile = markChronicleCode(campusProfile, action.xp);
  else if (action?.type === 'weave-arc') campusProfile = markWeaveArc(campusProfile, action.id, action.choice, action.score, action.xp);
  else if (action?.type === 'weave-season') campusProfile = markWeaveSeason(campusProfile, action.seed, action.score, action.xp);
  else if (action?.type === 'weave-code') campusProfile = markWeaveCode(campusProfile, action.xp);
  else if (action?.type === 'threads-episode') campusProfile = markThreadsEpisode(campusProfile, action.id, action.choice, action.unlocks, action.echo, action.qbot, action.score, action.xp);
  else if (action?.type === 'threads-cycle') campusProfile = markThreadsCycle(campusProfile, action.seed, action.score, action.xp);
  else if (action?.type === 'threads-code') campusProfile = markThreadsCode(campusProfile, action.xp);
  else if (action?.type === 'guild-quest') campusProfile = markGuildQuest(campusProfile, action.id, action.approach, action.skills, action.credits, action.xp);
  else if (action?.type === 'guild-job') campusProfile = markGuildJob(campusProfile, action.seed, action.skill, action.skillGain, action.credits, action.xp);
  else if (action?.type === 'guild-raid') campusProfile = markGuildRaid(campusProfile, action.id, action.skills, action.credits, action.score, action.xp);
  else if (action?.type === 'guild-realm') campusProfile = markGuildRealm(campusProfile, action.id, action.score, action.skill, action.skillGain, action.xp, action.day);
  saveCampusProfile(campusProfile);
  accountSaveSoon();
  syncCampusSkillJournal();
  campus?.refresh?.();
  return campusProfile;
}
let campus;
let systemSandbox;
const contractBoard = createContractBoard(document.querySelector('#contractBoard'), {
  getProfile: () => campusProfile,
  onProfile: updateCampusProfile,
  onSound: name => audio.play(name),
  onClose: () => campus.open(),
  onOpenSandbox: () => systemSandbox.open(),
});
systemSandbox = createSystemSandbox(document.querySelector('#systemSandbox'), {
  getProfile: () => campusProfile,
  onProfile: updateCampusProfile,
  onSound: name => audio.play(name),
  onClose: () => contractBoard.open(),
});
const pythonContracts = createPythonContracts(document.querySelector('#pythonContracts'), {
  getProfile: () => campusProfile,
  onProfile: updateCampusProfile,
  onSound: name => audio.play(name),
  onClose: () => campus.open(),
});
const aiLab = createAiLab(document.querySelector('#aiLab'), {
  onSound: name => audio.play(name),
  onCheckpoint: phase => {
    state = applyGameAction(state, { type: phase === 'complete' ? 'ai-lab-complete' : 'start-ai-lab' });
    persistence.save(state);
    telemetry.mark(`ai-lab-${phase}`);
  },
  onComplete: result => {
    updateCampusProfile({ type:'ai-complete', ...result });
    campus.open();
  },
});
const modelWorkbench = createModelWorkbench(document.querySelector('#modelWorkbench'), {
  getProfile: () => campusProfile,
  onProfile: updateCampusProfile,
  onSound: name => audio.play(name),
  onClose: () => campus.open(),
});
const neuralFoundry = createNeuralFoundry(document.querySelector('#neuralFoundry'), {
  getProfile: () => campusProfile,
  onProfile: updateCampusProfile,
  onSound: name => audio.play(name),
  onClose: () => campus.open(),
});
const llmWorkshop = createLlmWorkshop(document.querySelector('#llmWorkshop'), {
  onSound: name => audio.play(name),
  onCheckpoint: phase => {
    state = applyGameAction(state, { type: phase === 'complete' ? 'llm-workshop-complete' : 'start-llm-workshop' });
    persistence.save(state);
    telemetry.mark(`llm-workshop-${phase}`);
  },
  onComplete: result => {
    updateCampusProfile({ type:'llm-complete', ...result });
    campus.open();
  },
});
const retrievalWarehouse = createRetrievalWarehouse(document.querySelector('#retrievalWarehouse'), {
  getProfile: () => campusProfile,
  onProfile: updateCampusProfile,
  onSound: name => audio.play(name),
  onClose: () => campus.open(),
});
const botForge = createBotForge(document.querySelector('#botForge'), {
  getProfile: () => campusProfile,
  onProfile: updateCampusProfile,
  onSound: name => audio.play(name),
  onClose: () => campus.open(),
});
const automationLab = createAutomationLab(document.querySelector('#automationLab'), {
  getProfile: () => campusProfile,
  onProfile: updateCampusProfile,
  onSound: name => audio.play(name),
  onClose: () => campus.open(),
});
const aiFactoryCapstone = createAiFactoryCapstone(document.querySelector('#aiFactoryCapstone'), {
  getProfile: () => campusProfile,
  onProfile: updateCampusProfile,
  onSound: name => audio.play(name),
  onClose: () => campus.open(),
});
const simnetLab = createSimnetLab(document.querySelector('#simnetLab'), {
  getProfile: () => campusProfile,
  onProfile: updateCampusProfile,
  onSound: name => audio.play(name),
  onClose: () => campus.open(),
});
const factoryNexus = createFactoryNexus(document.querySelector('#factoryNexus'), {
  getProfile: () => campusProfile,
  getMode: () => explainMode,
  onProfile: updateCampusProfile,
  onSound: name => audio.play(name),
  onClose: () => campus.open(),
});
const opsDesk = createOpsDesk(document.querySelector('#opsDesk'), {
  getProfile: () => campusProfile,
  getMode: () => explainMode,
  onProfile: updateCampusProfile,
  onSound: name => audio.play(name),
  onClose: () => campus.open(),
});
const worldGrid = createWorldGrid(document.querySelector('#worldGrid'), {
  getProfile: () => campusProfile,
  getMode: () => explainMode,
  onProfile: updateCampusProfile,
  onSound: name => audio.play(name),
  onClose: () => campus.open(),
});
const automationCommons = createAutomationCommons(document.querySelector('#automationCommons'), {
  getProfile: () => campusProfile,
  getMode: () => explainMode,
  onProfile: updateCampusProfile,
  onSound: name => audio.play(name),
  onClose: () => campus.open(),
});
const cityOperations = createCityOperations(document.querySelector('#cityOperations'), {
  getProfile: () => campusProfile,
  getMode: () => explainMode,
  onProfile: updateCampusProfile,
  onSound: name => audio.play(name),
  onClose: () => campus.open(),
});
const cityChronicle = createCityChronicle(document.querySelector('#cityChronicle'), {
  getProfile: () => campusProfile,
  getMode: () => explainMode,
  onProfile: updateCampusProfile,
  onSound: name => audio.play(name),
  onClose: () => campus.open(),
});
const cityWeave = createCityWeave(document.querySelector('#cityWeave'), {
  getProfile: () => campusProfile,
  getMode: () => explainMode,
  onProfile: updateCampusProfile,
  onSound: name => audio.play(name),
  onClose: () => campus.open(),
});
const questGuild = createQuestGuild(document.querySelector('#questGuild'), {
  getProfile: () => campusProfile,
  getMode: () => explainMode,
  onProfile: updateCampusProfile,
  onSound: name => audio.play(name),
  onClose: () => campus.open(),
});
// 17.3 · the garage and the apartment in first person (fp-world.js), drawn
// at the engine era the player has earned (engine-eras.js): learned Python
// moves, campus rank, held profession days, and engine upgrades bought on
// the home PC. ?era=0..5 (or ?era=duke) forces an era; [ / ] switch it.
const ENGINE_KEY = 'quequest.engine.upgrades';
function engineUpgrades() { try { return Math.max(0, Number(localStorage.getItem(ENGINE_KEY)) || 0); } catch { return 0; } }
function engineNow() {
  const realmDays = CAREER_REALMS.reduce((n, r) => n + heldRealmDay(campusProfile, r.id), 0);
  return engineProgress({ learning: state.learning, rankIndex: getCampusRank(campusProfile.xp ?? 0).index, realmDays, upgrades: engineUpgrades(), chapter: state.learning?.chapter, armFixed: state.arm?.chip === 'installed' });
}
// 17.4: ?engine=N (feature 0..30) or ?era=N (all features up to that era).
const forcedEraParam = forcedEngineLevel;
function engineLevelNow() { return forcedEngineLevel ?? levelFromProgress(engineNow()); }
const fpWorldRoot = document.querySelector('#fpWorld');
const fpWorld = createFpWorld(fpWorldRoot, {
  onSound: name => audio.play(name),
  getEra: () => eraFromProgress(engineNow()),
  getLevel: engineLevelNow,
  getEngine: () => engineStatus(engineNow()),
  getWallet: () => state.warehouse?.wage ?? 0,
  onBuyUpgrade: () => {
    const r = buyUpgrade({ upgrades: engineUpgrades(), wallet: state.warehouse?.wage ?? 0 });
    if (r.ok) {
      try { localStorage.setItem(ENGINE_KEY, String(r.upgrades)); } catch { /* private mode */ }
      state = { ...state, warehouse: { ...state.warehouse, wage: r.wallet } };
      persistence.save(state);
    }
    return r;
  },
  onDive: (program) => (program === 'pythonio' ? pythonio.open({ fromDive: true }) : program === 'blackice' ? blackice.open({ fromDive: true }) : careerWorlds.dive(program)),
  onLeave: () => careerWorlds.fromWorld(),
  eraDebug: isLocal || forcedEraParam !== null || query.has('debug'),
  reducedMotion: prefersReducedMotion,
  // 17.4 · AR headset. ?ar=1 — the headset is already yours; ?ar=on — and on
  // your head; ?device=0..3 — VR device tier (шлем, телефон, имплант, нейролинк).
  arOwned: ['1', 'on', 'true'].includes(query.get('ar')),
  arWorn: query.get('ar') === 'on',
  device: deviceFromQuery(location.search),
  getGarageDay: () => nextRealmDay(campusProfile, 'vehicle'),
  onGatewayNight: (r) => careerWorlds.creditGarage(r),
  // Доска Сани (src/game/locks/): награда за устройство, путь шкафа или
  // задачу на Python — один раз на id, как заказы Pythonio.
  onLockReward: (id) => {
    const r = markLockReward(campusProfile, id);
    if (!r.first) return r;
    updateCampusProfile({ type: 'replace', profile: r.profile });
    state = { ...state, warehouse: { ...state.warehouse, wage: (state.warehouse?.wage ?? 0) + r.pay } };
    persistence.save(state);
    updateHud();
    audio.play('cash');
    return r;
  },
  getMuted: () => audio.muted(),
  // 18.2 (§17): Витя's phrase in the layer you can hear now, the seam under
  // it, and the one thing at home that is different after the first quest.
  meaning: (id) => hear(id),
  onSeam: (code) => showMeaningSeam(code),
  homeChanges: () => homeChanges(reflexRecord, { checkpoint: state.checkpoint }).map((c) => ({ ...c, noticed: Boolean(reflexRecord.homeSeen[c.id]) })),
  onHomeNoticed: (id) => remember('homeSeen', id),
  onArFix: (id, reward) => {
    const pay = Math.max(0, Number(reward) || 0);
    if (pay) {
      state = { ...state, warehouse: { ...state.warehouse, wage: (state.warehouse?.wage ?? 0) + pay } };
      persistence.save(state);
      updateHud();
    }
    return pay;
  },
});
if (forcedEraParam !== null) fpWorld.setLevel(forcedEraParam);
let careerReturnToGuild = false;
const careerWorldsRoot = document.querySelector('#careerWorlds');
const careerWorlds = createCareerWorlds(careerWorldsRoot, {
  getProfile: () => campusProfile,
  getLearning: () => state.learning,
  getWallet: () => state.warehouse?.wage ?? 0,
  // A profession's first held day pays real game money, not only XP.
  onProfile: (action) => {
    updateCampusProfile(action);
    if (action?.pay > 0) {
      state = { ...state, warehouse: { ...state.warehouse, wage: (state.warehouse?.wage ?? 0) + action.pay } };
      persistence.save(state);
      audio.play('cash');
    }
  },
  onSound: name => audio.play(name),
  onClose: () => { if (careerReturnToGuild) questGuild.open(); },
  world: fpWorld,
  // ЛИНИЯ 03 → «дальше — мастерская»: Pythonio takes the dive over.
  onDeeper: () => { const fromDive = careerWorlds.release(); if (!fromDive) careerWorlds.close(); pythonio.open({ fromDive }); },
});
// 19.1 · КАРТОЧКА ДАЙВЕРА и ринг «ТИСКОВ» (canon §19, duel-ui.js). The
// profile store (profile-store.js) is the one seam for accounts: a page may
// set window.QQ_PROFILE_ADAPTER before boot; logins are Сергей's part.
const profileStore = resolveAdapter();
var ringPlayer = null; // var: updateCampusProfile may run before this line (TDZ)
// The player as the ring sees them: the in-game nick lives in the profile
// (editable on the card); the account gives only the id and a default nick.
const currentPlayer = () => (ringPlayer ? { ...ringPlayer, nick: campusProfile.duel?.nick || ringPlayer.nick } : null);
function ringGate() {
  if (legacy || state.checkpoint === 'fired' || loadFlags().vityaCalled || heldRealmDay(campusProfile, 'vehicle') >= 1) return { ok: true };
  return { ok: false, reason: 'Ринг откроется после увольнения: Витя расскажет, где «ТИСКИ» меряются задачками. Для показа есть «ПОКАЗ» в главном меню.' };
}
function saveRingSnapshot() {
  const id = ringPlayer?.id ?? 'local';
  try {
    const snap = profileSnapshot(campusProfile, { player: currentPlayer() });
    profileStore.saveSnapshot(id, snap);
    if (ringPlayer) profileStore.account?.publishCard?.(snap.card)?.catch?.(() => {});
  } catch (err) { console.warn(err); }
}
// 19.2 · every profile change (fights, days, professions, duels) goes to the
// account — debounced here and again in the adapter. localStorage is already
// written by saveCampusProfile. A guest: nothing more to do.
let accountTimer = 0;
function accountSaveSoon() {
  if (!ringPlayer) return;
  clearTimeout(accountTimer);
  accountTimer = setTimeout(saveRingSnapshot, 600);
}
function accountFlush(leaving) {
  if (!ringPlayer) return;
  clearTimeout(accountTimer);
  saveRingSnapshot();
  profileStore.flush({ leaving });
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') accountFlush(false); });
addEventListener('pagehide', () => accountFlush(true));
let accountUi = null;
const ring = createRing(document.querySelector('#deepRing'), {
  getProfile: () => campusProfile,
  onProfile: (profile) => { updateCampusProfile({ type: 'replace', profile }); saveRingSnapshot(); careerWorlds.refresh?.(); },
  onSound: (name) => audio.play(name),
  getPlayer: currentPlayer,
  canDuel: ringGate,
  store: profileStore,
  decorate: (node) => accountUi?.decorate(node),
});
function openRing(view = 'card', opts = {}) {
  releaseAllKeys('overlay');
  if (document.pointerLockElement) document.exitPointerLock?.();
  audio.unlock?.();
  ring.open(view, opts);
}
// A signed-in player: load the account, merge it with what this browser has
// (first login: the guest's progress goes INTO the account; another
// account's browser: start from the account), save the merge back. Runs at
// boot and again on login / when the service appears (event `qq:account`).
let syncing = null;
async function syncAccount() {
  const player = await profileStore.getCurrentPlayer();
  if (!player?.id) { ringPlayer = null; return; }
  if (ringPlayer?.id === String(player.id)) return;
  ringPlayer = { id: String(player.id), nick: player.nick ?? '', classId: player.classId ?? null };
  const claim = await profileStore.claimLocal(ringPlayer.id);
  const snap = await profileStore.loadSnapshot(ringPlayer.id);
  let next = claim === 'replace' ? createCampusProfile() : campusProfile;
  if (snap) next = applySnapshot(next, snap);
  if (!next.duel?.nick) next = { ...next, duel: { ...(next.duel ?? {}), nick: player.nick } };
  updateCampusProfile({ type: 'replace', profile: next });
  saveRingSnapshot();
  profileStore.flush();          // the merge goes up now, not after the debounce
  careerWorlds.refresh?.();
  ring.refresh?.();
  accountUi?.refresh();
}
function syncAccountOnce() { if (!syncing) syncing = syncAccount().catch((err) => console.warn(err)).finally(() => { syncing = null; }); return syncing; }
syncAccountOnce();
addEventListener('qq:account', (e) => {
  const d = e.detail ?? {};
  if (d.type === 'login' || (d.type === 'service' && d.user && !ringPlayer)) syncAccountOnce();
  if (d.type === 'logout') ringPlayer = null;
  // Another device saved newer: its progress joins the live profile (grows only).
  if (d.type === 'remote' && d.snapshot && ringPlayer) updateCampusProfile({ type: 'replace', profile: applySnapshot(campusProfile, d.snapshot) });
});
accountUi = createAccountUi(document.body, {
  account: profileStore.account,
  getProfile: () => campusProfile,
  getPlayer: currentPlayer,
  onProfile: (profile) => { updateCampusProfile({ type: 'replace', profile }); saveRingSnapshot(); },
  onSound: (name) => audio.play(name),
  onChange: () => ring.refresh?.(),
});
accountUi.decorate(document.querySelector('#startPanel'));
document.querySelector('#careerRing')?.addEventListener('click', () => { audio.play('ui-click'); openRing('card'); });
document.querySelector('#startDuelDemo')?.addEventListener('click', () => { telemetry.mark('ring-demo'); openRing('card', { demo: true }); });
// Витя tells about the ring once, the first time the professions open after the firing.
new MutationObserver(() => {
  if (careerWorldsRoot.hidden || !ringGate().ok || loadFlags().ringTold) return;
  setFlag('ringTold');
  showReflexToast({ kind: 'saved', kicker: 'СОСЕД ВИТЯ', thought: '«У ТИСКОВ стажёры по вечерам меряются на ринге — задачками».', more: 'Решил быстро — получил баф. Кнопка «⚔ РИНГ · КАРТОЧКА» — наверху.' }, 6500);
}).observe(careerWorldsRoot, { attributes: true, attributeFilter: ['hidden'] });

// Шаг 2: Pythonio as the depth of AUTO (pythonio-bridge.js, games/pythonio/).
// Its orders pay into the same profile (AUTO branch, XP) and wallet, once per order.
const pythonio = createPythonioBridge(document.body, {
  getLearning: () => state.learning,
  getPlayer: () => (careerApi.plainRank ?? ((n) => n))(getCampusRank(campusProfile.xp ?? 0).name),
  getProfile: () => campusProfile,
  getWallet: () => state.warehouse?.wage ?? 0,
  getLevel: () => characterSheet(campusProfile, state.learning).skills.find((k) => k.id === 'automation')?.level ?? 0,
  onOrder: ({ id, method }) => {
    const r = markPythonioOrder(campusProfile, id);
    if (!r.first) return r;
    updateCampusProfile({ type: 'replace', profile: r.profile });
    recordSkill('route', pythonioWay(method), { stage: 1, key: `pythonio:${id}` });
    state = { ...state, warehouse: { ...state.warehouse, wage: (state.warehouse?.wage ?? 0) + r.pay } };
    persistence.save(state);
    audio.play('cash');
    return r;
  },
  onSound: name => audio.play(name),
  onExit: ({ fromDive, result }) => { if (fromDive) fpWorld.surface(result); else careerWorlds.open(); },
});
// JUMP KILL · Лабиринт (blackice-bridge.js, labyrinth.js, games/blackice/):
// a cleared level pays XP and rubles once, and counts in the «Лабиринт» stat.
const blackice = createBlackIceBridge(document.body, {
  getPlayer: () => (careerApi.plainRank ?? ((n) => n))(getCampusRank(campusProfile.xp ?? 0).name),
  getProfile: () => campusProfile,
  getWallet: () => state.warehouse?.wage ?? 0,
  onFloor: (msg) => {
    const r = markLabyrinthFloor(campusProfile, msg.floor.n);
    if (!r.first) return r;
    updateCampusProfile({ type: 'replace', profile: r.profile });
    state = { ...state, warehouse: { ...state.warehouse, wage: (state.warehouse?.wage ?? 0) + r.pay } };
    persistence.save(state);
    setCabinetProgress(labyrinthCleared(campusProfile).length, LABYRINTH_FLOORS.length);
    audio.play('cash');
    return r;
  },
  onSound: name => audio.play(name),
  onExit: ({ fromDive, result }) => { if (fromDive) fpWorld.surface(result); },
});
setCabinetProgress(labyrinthCleared(campusProfile).length, LABYRINTH_FLOORS.length);
document.querySelector('#guildWorldsOpen').addEventListener('click', () => { careerReturnToGuild = true; questGuild.close(); careerWorlds.open(); });
// 18.0: the door opens the skill tree; professions are entered from it.
const FLAGS_KEY = 'quequest.flags.v1';
function loadFlags() { try { return JSON.parse(localStorage.getItem(FLAGS_KEY) || '{}') || {}; } catch { return {}; } }
function setFlag(name) { const f = loadFlags(); if (f[name]) return; f[name] = true; try { localStorage.setItem(FLAGS_KEY, JSON.stringify(f)); } catch { /* private mode */ } }

// ---------------------------------------------------------------- 18.2
// §16: the hero is a gamer who forgot he is one -- reflexes (save, look
// behind the crate, the boss's pattern) and one gamer slip per scene. §17:
// old phrases mean more once you know `if`; home changes after a quest.
// All of it is one small record in localStorage (gamer-reflex.js).
let reflexRecord = loadRecord(localStorage);
const slipScenes = new Set();
function remember(bucket, id, value = true) {
  const r = mark(reflexRecord, bucket, id, value);
  reflexRecord = r.record;
  saveRecord(localStorage, reflexRecord);
  return r.first;
}
function takeSlip(scene) {
  const line = gamerLine(scene, reflexRecord, slipScenes);
  if (!line) return null;
  slipScenes.add(scene);
  remember('lines', line.id);
  // «Где тут сохраниться?» -- the clock blinks once, softly: a hint, not a tutorial.
  if (line.id === 'where-save') setTimeout(() => {
    if (reflexRecord.reflexes.save) return;
    for (const c of document.querySelectorAll('[data-clock]')) { c.dataset.hint = 'true'; setTimeout(() => { c.dataset.hint = 'false'; }, 4200); }
  }, 5600);
  return line;
}
function hallSlip(event) {
  const scene = { 'jump-spam': 'hall-jump', 'task-fail': 'hall-fail' }[event];
  return scene ? takeSlip(scene) : null;
}
function knowsNow() { return knowledgeFrom({ learning: state.learning, record: reflexRecord }); }
// Hear a phrase in the layer the player can hear now; remembers the layer.
function hear(id) {
  const r = hearMeaning(id, knowsNow(), reflexRecord);
  if (!r.line) return null;
  reflexRecord = r.record;
  saveRecord(localStorage, reflexRecord);
  return r.line;
}
const reflexToast = document.querySelector('#reflexToast');
let reflexToastTimer = 0;
function showReflexToast({ kind = 'reflex', kicker = 'РЕФЛЕКС', thought = '', more = '', code = '' } = {}, ms = 4600) {
  if (!reflexToast) return;
  reflexToast.dataset.kind = kind;
  reflexToast.querySelector('#reflexKicker').textContent = kicker;
  reflexToast.querySelector('#reflexThought').textContent = thought;
  reflexToast.querySelector('#reflexMore').textContent = more;
  const c = reflexToast.querySelector('#reflexCode');
  c.textContent = code; c.hidden = !code;
  reflexToast.hidden = false;
  reflexToast.getAnimations?.().forEach((a) => { a.cancel(); a.play(); });
  clearTimeout(reflexToastTimer);
  reflexToastTimer = setTimeout(() => { reflexToast.hidden = true; }, prefersReducedMotion ? ms + 1500 : ms);
}
const meaningSeam = document.querySelector('#meaningSeam');
let meaningSeamTimer = 0;
function showMeaningSeam(code) {
  if (!meaningSeam || !code) return;
  meaningSeam.querySelector('#meaningSeamCode').textContent = code;
  meaningSeam.hidden = true; void meaningSeam.offsetWidth; meaningSeam.hidden = false;
  audio.play('seam');
  clearTimeout(meaningSeamTimer);
  meaningSeamTimer = setTimeout(() => { meaningSeam.hidden = true; }, 2900);
}
// A reflex from the first shift: the hand did it (the thought is said in the
// world); the toast names what it means, in words (§13: ТЫК → слова → код).
function reflexFired(id) {
  const first = remember('reflexes', id);
  const R = REFLEXES[id];
  if (!R || !first) return;
  showReflexToast({ kicker: R.kicker, thought: id === 'pattern' ? R.hint : R.words, more: id === 'pattern' ? R.words : '' }, 5200);
}
// F5 / a long press on the clock. The first time it is a reflex and it opens
// saving; after that it saves and shows what was kept: words until you write
// code, then the same as a line of Python.
function saveReflex() {
  if (!started) return;
  const first = remember('reflexes', 'save');
  if (state.checkpoint !== 'start') persistence.save(state);
  const snap = saveSnapshot(state);
  audio.play(REFLEXES.save.sound);
  if (first) {
    showReflexToast({ kicker: REFLEXES.save.kicker, thought: REFLEXES.save.thought, more: `${REFLEXES.save.unlock} Сохранено в этом браузере: ${saveWords(snap)}.` }, 6200);
  } else {
    const rep = saveReport(snap);
    showReflexToast({ kind: 'saved', kicker: 'СОХРАНЕНО · В ЭТОМ БРАУЗЕРЕ', thought: rep.mode === 'code' ? 'Записал, что сейчас есть:' : rep.text, code: rep.mode === 'code' ? rep.text : '' }, 4200);
  }
  for (const c of document.querySelectorAll('[data-clock]')) { c.dataset.saved = 'true'; setTimeout(() => { c.dataset.saved = 'false'; }, 900); }
  telemetry.mark(first ? 'reflex-save' : 'save');
}
window.addEventListener('keydown', (event) => {
  if (event.code !== 'F5' || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  if (!started) return; // before the game starts F5 still reloads the page
  event.preventDefault();
  if (!event.repeat) saveReflex();
}, { capture: true });
// Phones: hold the clock (~0.6 s).
for (const clock of document.querySelectorAll('[data-clock]')) {
  let timer = 0;
  const cancel = () => { clearTimeout(timer); clock.dataset.pressing = 'false'; };
  clock.addEventListener('pointerdown', (ev) => { ev.preventDefault(); clock.dataset.pressing = 'true'; clearTimeout(timer); timer = setTimeout(() => { clock.dataset.pressing = 'false'; saveReflex(); }, 600); });
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) clock.addEventListener(type, cancel);
  clock.addEventListener('contextmenu', (ev) => ev.preventDefault());
}
// The in-game time on the main HUD clock, by scene.
function clockText() {
  const w = state.warehouse;
  const wc = legacy ? null : weekClock(state);
  if (wc) return wc;
  if (state.scene === 'forlesson') return '18:40';
  if (state.scene === 'queue') return '23:10';
  if (state.scene === 'function') return '09:30';
  if (state.scene === 'condition') return '11:00';
  if (state.scene === 'machine') return w.day2 === 'button' ? '08:05' : '08:40';
  return state.checkpoint === 'chip' || state.scene === 'chip' ? '11:20' : '09:00';
}
// §17 in the hall: E on the loader, or on the boss's radio on his desk.
function hallTalkTarget() {
  if (!firstPersonScene()) return null;
  const who = factoryView.personInFront(warehouseYaw);
  if (who === 'desk' && state.warehouse.button === 'mounted') return null;
  return who;
}
const HALL_TALK_LABEL = { lunch: 'ГРУЗЧИК · ПОГОВОРИТЬ', desk: 'РАЦИЯ НАЧАЛЬНИКА · ВЫЗВАТЬ' };
function talkInHall(who) {
  const line = hear(who === 'lunch' ? 'loader.bread' : 'boss.button');
  if (!line) return null;
  if (who === 'desk') audio.play('ui-click');
  factoryView.talk(line.who, line.text);
  if (line.seam) setTimeout(() => showMeaningSeam(line.seam), 900);
  return line;
}
// ---------------------------------------------------------------- 19.0
// The first week (canon §18, week.js): day 1 the button, day 2 copy, day 3
// assemble, day 4 by hand, day 5 the whole line runs itself → fired → Витя's
// call → the garage. One terminal visit a day; a pay card every evening.
const weekOn = () => !legacy && isWeekCheckpoint(state.checkpoint);
const payCard = createPayCard(game, { onNext: () => weekCardNext(), sound: (n) => audio.play(n), onCard: () => openRing('card') });
const weekPinEl = createWeekPin(game);
// Shift 1 is over: «ВСТАВИТЬ ЧИП В РУКУ 07» really puts it in. You stand
// in front of Arm 07, the chip clicks into the socket, the arm gets power
// and waits for its green button.
function weekChipIn({ delivered = 3, extra = 0, player = null } = {}) {
  state = createCheckpointState('d1-button');
  state = {
    ...state, scene: 'chip', sceneTime: 0,
    arm: { ...state.arm, chip: 'inserting', awake: false },
    warehouse: { ...state.warehouse, wage: Math.max(state.warehouse.wage, (delivered + extra) * CRATE_PAY) },
  };
  void player;
  lastScene = state.scene;
  factoryView.place(state);
  faceTarget({ type: 'insert-python-chip', x: 1010, y: 636 });
  started = true;
  lastTime = performance.now();
  startPanel.hidden = true;
  persistence.save(state);
  audio.setAmbient('warehouse');
  audio.play('power');
  telemetry.mark('week-chip-in');
}
// A day starts in the hall: the boss (days 2–5) and someone in the hall.
function weekMorningBeat() {
  const day = weekDayOf(state.checkpoint);
  const hallLine = () => {
    for (const [who, text] of HALL_MORNING[day] ?? []) {
      const said = who === 'lunch' ? (hear('loader.bread')?.text ?? text) : text;
      setTimeout(() => { if (!storyActive) factoryView.say(who, said); }, 500);
    }
  };
  const seam = {
    2: { kicker: 'ШОВ · ЧТО БЫЛО ВНУТРИ КНОПКИ', lines: ['кнопка ничего не умела сама', 'она посылала руке одну строчку:', '<code>print("wake")</code>'], from: '— это не совпадение. Ты сам оставил себе эту подсказку.' },
    3: { kicker: 'ШОВ · МЫСЛЬ ПРИШЛА САМА', lines: ['белый → <b>бери</b>', 'красный → <b>оставь</b>', 'ЕСЛИ… ТО…'], from: '— это не совпадение. Ты сам оставил себе эту подсказку.' },
  }[day];
  const afterBoss = () => {
    if (day === 2) { audio.play('impact'); hear('boss.button'); }
    hallLine();
    if (seam) setTimeout(() => showSeam(document.querySelector('#seamFlash'), seam, () => { const t = getInteractionTarget(state); if (t) faceTarget(t); }), 2800);
    persistence.save(state);
  };
  const boss = BOSS_MORNING[day];
  if (boss) tellStory(day === 3 ? 'НАЧАЛЬНИК · ПО РАЦИИ' : 'НАЧАЛЬНИК', boss.title, boss.line, boss.button, afterBoss);
  else afterBoss();
  // §16: one gamer slip for the first morning with the button.
  if (day === 1) setTimeout(() => { if (state.scene === 'machine' && !storyActive) factoryView.pair(takeSlip('day2-morning')); }, 6500);
}
// The day's work is done: the boss says his line, then the pay card.
function weekEndBeat() {
  const day = weekDayOf(state.checkpoint);
  const b = BOSS_END[day];
  if (!b) return;
  const me = b.me ? ` Ты про себя: «${b.me}»` : '';
  tellStory('НАЧАЛЬНИК', b.title, `«${b.line}»${me}`, day === 5 ? 'ВЗЯТЬ ДЕНЬГИ' : 'В КАССУ', () => {
    audio.play(day === 5 ? 'blocked' : 'cash');
    persistence.save(state);
  });
}
function weekCard() {
  const day = weekDayOf(state.checkpoint);
  const fired = state.checkpoint === 'fired';
  const flags = loadFlags();
  return {
    day, fired, wage: state.warehouse.wage,
    ledger: { ...payLedger(day), wage: state.warehouse.wage },
    quote: { who: 'НАЧАЛЬНИК', text: BOSS_END[day]?.title ?? '' },
    me: BOSS_END[day]?.me ?? '',
    button: fired ? (flags.vityaGarage ? 'В ГАРАЖ К ВИТЕ →' : (flags.vityaCalled ? 'ИДТИ К ВИТЕ →' : 'ДАЛЬШЕ →')) : 'ДОМОЙ · ВЕЧЕР →',
  };
}
function weekCardNext() {
  if (storyActive) return;
  payCard.hide();
  const day = weekDayOf(state.checkpoint);
  if (state.checkpoint === 'fired') { firedNext(); return; }
  const ev = EVENING[day];
  const mo = MORNING[day + 1];
  tellStory(ev.when, ev.title, ev.line, 'СПАТЬ →', () => {
    tellStory(mo.when, mo.title, mo.line, 'НА СКЛАД →', () => {
      state = applyGameAction(state, { type: 'week-next' });
      if (loadFlags().buttonPocket && state.warehouse.button === 'torn') state = { ...state, warehouse: { ...state.warehouse, button: 'pocket' } };
      lastAutoDelivered = 0;
      const t = getInteractionTarget(state);
      if (t) faceTarget(t);
      persistence.save(state);
      telemetry.mark(`week-day-${day + 1}`);
    });
  });
}
// Fired. Витя calls; the quest «Сходи в гараж к Вите» is pinned; the evening
// is at home, and the garage is through the apartment's door.
function firedNext() {
  const flags = loadFlags();
  if (flags.vityaGarage) { if (!enterGarageQuest()) openWorld('garage'); return; }
  if (flags.vityaCalled) { if (enterGarageQuest()) { onFiredHandoff(); return; } openWorld('home'); return; }
  audio.play('chatter');
  tellStory(FIRED.callWho, FIRED.callTitle, FIRED.callLine, FIRED.callButton, () => {
    setFlag('vityaCalled');
    telemetry.mark('week-vitya-called');
    // The professions screen runs the garage quest itself when it can
    // (enterGarageQuest returns false until it is built); otherwise the
    // evening at home and the walk through the door to the garage.
    if (enterGarageQuest()) { onFiredHandoff(); return; }
    openWorld('home');
  });
}
function enterGarageQuest() {
  try {
    const fn = careerWorlds?.enterGarageQuest ?? careerApi.enterGarageQuest;
    return typeof fn === 'function' ? Boolean(fn.call(careerWorlds, FIRED.questId)) : false;
  } catch (err) { console.error(err); return false; }
}
function openWorld(level) {
  releaseAllKeys('overlay');
  fpWorld.open(level, { reset: true });
  // Look at the door to the garage: it is right behind you when you come home.
  if (level === 'home') fpWorld.debug({ yaw: Math.PI / 2 });
}
// The hook for the professions (week-hooks.js): once, when you step into
// Витя's garage after the firing.
function onFiredHandoff() {
  if (loadFlags().vityaGarage) return;
  setFlag('vityaGarage');
  remember('quests', FIRED.questId);
  telemetry.mark('week-garage-vitya');
  audio.play('poster');
  showReflexToast({ kind: 'saved', kicker: 'КВЕСТ ВЫПОЛНЕН', thought: FIRED.questTitle, more: `Витя ждёт у машины. Дальше — месть холдингу «${CORP.name}»: профессии в дереве навыков.` }, 5200);
  // Витя meets you with the reason you came (the garage's own lines follow).
  setTimeout(() => { if (!fpWorldRoot.hidden) fpWorld.debug({ speech: { who: 'neighbor', name: 'СОСЕД ВИТЯ', text: `Пришёл! Глянь: замок вскрыт, сигналка молчит. Это «${CORP.name}», я тебе говорю.` } }); }, 2600);
  firedHandoff({ questId: FIRED.questId, corp: CORP.name, from: 'home-door' });
}
let handoffCheckAt = 0;
function watchWeekWorld(now) {
  if (legacy) { weekPinEl.set(''); return; }
  const flags = loadFlags();
  const worldOpen = !fpWorldRoot.hidden;
  if (worldOpen && flags.vityaCalled && !flags.vityaGarage && now > handoffCheckAt) {
    handoffCheckAt = now + 350;
    if (fpWorld.state().level === 'garage') onFiredHandoff();
  }
  const pin = worldOpen && state.checkpoint === 'fired'
    ? (loadFlags().vityaGarage ? '' : `${FIRED.questTitle} — дверь прямо перед тобой`)
    : '';
  weekPinEl.set(pin);
}
function weekHud(nearby) {
  const day = weekDayOf(state.checkpoint);
  const w = state.warehouse;
  hud.chapter.textContent = `ДЕНЬ ${day} · СКЛАД 07`;
  if (state.scene === 'chip') {
    hud.mission.textContent = 'Чип защёлкивается';
    hud.message.textContent = 'ЩЁЛК · РУКА 07 ПОЛУЧАЕТ ПИТАНИЕ';
    return true;
  }
  if (['machine', 'condition'].includes(state.scene) && w.week) {
    hud.mission.textContent = { button: 'Кнопка «ПУСК»', copy: 'Листок электрика', assemble: 'Порванный листок', hand: 'Без листка', auto: 'Вся линия — сама' }[w.week];
    hud.message.textContent = nearby?.label ? `E · ${nearby.label}` : (w.week === 'button' ? 'ПОДОЙДИ К ЗЕЛЁНОЙ КНОПКЕ У РУКИ · E' : 'ПОДОЙДИ К ТЕРМИНАЛУ У РУКИ · E');
    return true;
  }
  if (state.scene === 'automation' && state.arm.startSource === 'week') {
    hud.mission.textContent = 'Рука таскает сама';
    hud.message.textContent = `ЯЩИКОВ НА ЛЕНТЕ: ${w.autoDelivered}/${w.autoTarget}`;
    return true;
  }
  if (state.scene === 'reward') {
    hud.mission.textContent = state.checkpoint === 'fired' ? 'Расчёт' : 'Конец смены';
    hud.message.textContent = 'КАССА';
    return true;
  }
  return false;
}
function progressInput() {
  return {
    learning: state.learning, warehouse: state.warehouse, checkpoint: state.checkpoint, flags: loadFlags(), scene: state.scene, arm: state.arm, legacy,
    engine: engineStatus(engineNow()), realms: CAREER_REALMS,
    availability: typeof careerApi.realmAvailability === 'function' ? (r) => careerApi.realmAvailability(r, campusProfile, state.learning) : null, realmWins: campusProfile?.labs?.guild?.realmWins ?? [], mastery: campusProfile?.mastery ?? {},
  };
}
function enterRealm(id) {
  careerReturnToGuild = false;
  careerWorlds.open();
  const pick = document.querySelector(`#careerRealmGrid [data-realm="${id}"]`);
  if (pick && careerWorldsRoot.dataset.picked !== id) pick.click();
  document.querySelector('#careerEnter')?.click();
}
const skillTreeView = createSkillTreeView(document.querySelector('#skillTree'), { getTree: () => buildSkillTree(progressInput()), onEnterRealm: enterRealm, sound: (n) => audio.play(n), onCard: () => openRing('card') });
const questLogView = createQuestLogView(document.querySelector('#questLog'), { getLog: () => buildQuestLog(progressInput()), sound: (n) => audio.play(n) });
document.querySelector('#careerDoor').addEventListener('click', () => { releaseAllKeys('overlay'); if (document.pointerLockElement) document.exitPointerLock?.(); skillTreeView.open(); audio.play('ui-click'); });
document.querySelector('#questDoor').addEventListener('click', () => { releaseAllKeys('overlay'); if (document.pointerLockElement) document.exitPointerLock?.(); questLogView.open(); audio.play('ui-click'); });
window.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement) return;
  if (!started || storyActive || machineOpen) return;
  if (event.code === 'KeyJ') { if (!isBlockingOverlayOpen()) { event.preventDefault(); document.querySelector('#questDoor').click(); } }
  if (event.code === 'KeyK' || event.code === 'Tab') { if (!isBlockingOverlayOpen() && !document.querySelector('#careerDoor').hidden) { event.preventDefault(); document.querySelector('#careerDoor').click(); } }
});
const cityThreads = createCityThreads(document.querySelector('#cityThreads'), {
  getProfile: () => campusProfile,
  getMode: () => explainMode,
  onProfile: updateCampusProfile,
  onSound: name => audio.play(name),
  onClose: () => campus.open(),
});
campus = createEngineerCampus(document.querySelector('#engineerCampus'), {
  getProfile: () => campusProfile,
  onProfile: updateCampusProfile,
  onOpenContracts: () => contractBoard.open(),
  onOpenPython: () => pythonContracts.open(),
  onOpenAi: () => aiLab.open(),
  onOpenModel: () => modelWorkbench.open(),
  onOpenNeural: () => neuralFoundry.open(),
  onOpenLlm: () => llmWorkshop.open(),
  onOpenRetrieval: () => retrievalWarehouse.open(),
  onOpenBot: () => botForge.open(),
  onOpenAutomation: () => automationLab.open(),
  onOpenFactory: () => aiFactoryCapstone.open(),
  onOpenSimnet: () => simnetLab.open(),
  onOpenNexus: () => factoryNexus.open(),
  onOpenDesk: () => opsDesk.open(),
  onOpenWorld: () => worldGrid.open(),
  onOpenCommons: () => automationCommons.open(),
  onOpenOperations: () => cityOperations.open(),
  onOpenChronicle: () => cityChronicle.open(),
  onOpenWeave: () => cityWeave.open(),
  onOpenThreads: () => cityThreads.open(),
  onOpenGuild: () => questGuild.open(),
  onSound: name => audio.play(name),
});

// 18.0 «игра зависла»: a story card opened while the mouse was captured by
// pointer lock could not be clicked — the cursor was hidden and nothing
// answered the keyboard. Now the lock is released, the button is focused,
// and Enter / Space / E press it.
let storyOpenedAt = 0;
window.addEventListener('keydown', (event) => {
  if (!storyActive || performance.now() - storyOpenedAt < 400) return;
  if (['Enter', 'Space', 'KeyE'].includes(event.code)) { event.preventDefault(); document.querySelector('#storyNext').click(); }
});
function tellStory(speaker, title, line, button, callback) {
  releaseAllKeys('overlay');
  if (document.pointerLockElement) document.exitPointerLock?.();
  storyOpenedAt = performance.now();
  setTimeout(() => document.querySelector('#storyNext')?.focus({ preventScroll: true }), 30);
  walkingTarget = null;
  storyActive = true;
  storyCallback = callback;
  document.querySelector('#storySpeaker').textContent = speaker;
  const face = document.querySelector('#storyFace');
  const faceId = faceIdFor(speaker);
  face.hidden = !faceId;
  if (faceId) drawFace(face, faceId, { mood: /ЧТО|!/.test(title) ? 'angry' : 'talk', frame: 1 });
  document.querySelector('#storyTitle').textContent = title;
  document.querySelector('#storyLine').textContent = line;
  document.querySelector('#storyNext').textContent = button;
  document.querySelector('#storyBeat').hidden = false;
}

document.querySelector('#storyNext').addEventListener('click', () => {
  if (!storyActive || performance.now() - storyOpenedAt < 300) return;
  storyActive = false;
  document.querySelector('#storyBeat').hidden = true;
  const next = storyCallback;
  storyCallback = null;
  next?.();
});

document.querySelector('#startGame').addEventListener('click', () => {
  // 16.0 FIRST SHIFT starts from a warehouse state with checkpoint=start.
  // Do not key this off the legacy prologue scene or the startup checkpoint snapshot:
  // after a reset those values are stale and the opening would be skipped.
  if (state.checkpoint === 'start') {
    startPanel.hidden = true;
    started = true;
    lastTime = performance.now();
    engagementProgressAt = lastTime;
    engagementProgressKey = currentEngagementProgressKey();
    unlockAudioForScene();
    audio.setAmbient('warehouse');
    firstShift.open();
    telemetry.mark('first-shift-open');
    return;
  }
  if (state.scene === 'prologue') {
    state = createCheckpointState('warehouse');
    lastScene = state.scene;
    lastThreats = 0;
    firstMovementSeen = false;
    audio.setAmbient('warehouse');
  }
  started = true;
  lastTime = performance.now();
  engagementProgressAt = lastTime;
  engagementProgressKey = currentEngagementProgressKey();
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

function openMachinePanel() {
  if (document.pointerLockElement === canvas) document.exitPointerLock?.();
  releaseAllKeys('overlay');
  if (state.warehouse.week && state.warehouse.week !== 'button') {
    hourDesk.open(state.warehouse.week);
    return;
  }
  if (state.scene === 'machine' && state.warehouse.day2) {
    hourDesk.open(state.warehouse.day2 === 'print2' ? 'print2' : 'print');
    return;
  }
  if (state.scene === 'condition' && state.warehouse.ruleStage) {
    hourDesk.open(state.warehouse.ruleStage === 'rules' ? 'rules' : 'if', { sentence: ruleSentence(lastRules) });
    return;
  }
  // 18.1: for / while / def go through the same terminal and floors.
  if (['forlesson', 'queue', 'function'].includes(state.scene) && state.warehouse.lessonStage) {
    hourDesk.open(`${state.scene === 'forlesson' ? 'for' : (state.scene === 'queue' ? 'while' : 'def')}-${state.warehouse.lessonStage}`);
  }
}

function resizeCanvas() {
  const scale = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(canvas.clientWidth * scale));
  canvas.height = Math.max(1, Math.round(canvas.clientHeight * scale));
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
}

// 18.0: story beats of the first hour, played once when a scene starts.
const beatsSeen = new Set();
function hourBeat() {
  const w = state.warehouse;
  const key = `${state.checkpoint}:${state.scene}:${w.day2 ?? ''}:${w.ruleStage ?? ''}:${w.week ?? ''}`;
  if (beatsSeen.has(key)) return;
  beatsSeen.add(key);
  if (weekOn()) {
    if (['machine', 'condition'].includes(state.scene) && w.week) weekMorningBeat();
    else if (state.scene === 'reward') weekEndBeat();
    return;
  }
  if (state.scene === 'machine' && w.day2 === 'button') {
    factoryView.comment('day2-morning');
    // §16: the tutorial look of it all (one slip for this scene).
    setTimeout(() => { if (state.scene === 'machine' && !storyActive) factoryView.pair(takeSlip('day2-morning')); }, 5200);
  } else if (state.scene === 'machine' && w.day2 === 'print') {
    // The button's insides: a seam shows the one line it was sending.
    showSeam(document.querySelector('#seamFlash'), {
      kicker: 'ШОВ · ТЫ ВИДИШЬ, ЧТО ВНУТРИ КНОПКИ',
      lines: ['кнопка ничего не умеет сама', 'она печатает руке одно слово:', '<code>print("wake")</code>'],
      from: '— напиши это сам. Терминал рядом с рукой.',
    }, () => { const t = getInteractionTarget(state); if (t) faceTarget(t); });
  } else if (state.scene === 'machine' && w.day2 === 'tear') {
    tellStory('НАЧАЛЬНИК', 'Это ЧТО?! Кто разрешил?!', 'Рука сама таскает?! Я тебя таскать нанимал, а не кнопочки жать! (хрясь — кнопка с проводами у него в кулаке) Всё. Нет кнопки — нет руки. Таскай руками!', 'ПРОВОЖАТЬ ЕГО ВЗГЛЯДОМ', () => {
      state = applyGameAction(state, { type: 'boss-tears-button' });
      audio.play('impact');
      hear('boss.button'); // §17: his words, as you hear them today
      persistence.save(state);
      setTimeout(() => factoryView.comment('button-torn'), 600);
    });
  } else if (state.scene === 'condition' && w.ruleStage === 'rules') {
    tellStory('НАЧАЛЬНИК · ПО РАЦИИ', 'Рука делает некачественно.', '«Тащит всё подряд. Таскай ТОЛЬКО БЕЛЫЕ. Красные — не трогать. Увижу красный на ленте — штраф из твоих». Кнопки у тебя нет... но у руки есть панель правил.', 'ЧТО ЖЕ ДЕЛАТЬ…', () => {
      factoryView.say('lunch', hear('loader.bread')?.text ?? 'Мне жена так и говорит: если хлеб белый — бери, если нет — не трогай. (жуёт)');
      setTimeout(() => showSeam(document.querySelector('#seamFlash'), {
        kicker: 'ШОВ · МЫСЛЬ ПРИШЛА САМА',
        lines: ['белый → <b>бери</b>', 'красный → <b>оставь</b>', 'ЕСЛИ… ТО…'],
        from: '— это не совпадение. Ты сам оставил себе эту подсказку.',
      }), 2600);
    });
  } else if (state.scene === 'condition' && w.ruleStage === 'if') {
    factoryView.comment('rules-done');
  } else if (state.scene === 'reward' && state.checkpoint === 'reward2') {
    factoryView.comment('if-done');
  } else if (state.scene === 'forlesson' && w.lessonStage === 'tap') {
    factoryView.say('lunch', 'Фура приехала. Сколько там? А кто их считал. Много.');
  } else if (state.scene === 'forlesson' && w.lessonStage === 'combo') {
    showSeam(document.querySelector('#seamFlash'), { kicker: 'ШОВ · ДВА ЗНАНИЯ ВМЕСТЕ', lines: ['для каждого ящика:', '    если белый:', '        взять'], from: '— отступ внутри отступа. Ты это уже умеешь, по отдельности.' });
  } else if (state.scene === 'queue' && w.lessonStage === 'tap') {
    factoryView.comment('day3-morning');
  }
}

function useAction() {
  if (exitOpen) return;
  const action = getNearbyAction(state);
  const target = getInteractionTarget(state);
  // 18.2 (§17): talking to the loader / the boss's radio, unless the thing
  // the scene wants is right under your eyes.
  const talkTo = hallTalkTarget();
  if (talkTo && !(action && target && action.type === target.type && lookingAt(target))) { talkInHall(talkTo); return; }
  if (!action) return;
  if (firstPersonScene() && target && action.type === target.type && !lookingAt(target)) return;
  recordFirstAction();
  if (action.type === 'open-machine') {
    openMachinePanel();
    return;
  }
  if (action.type === 'press-start-button') {
    recordSkill('print', 'tap', { stage: 1, key: 'print:button' });
    const weekButton = state.warehouse.week === 'button';
    state = applyGameAction(state, action);
    // 19.0: turn to the arm so you see it take the pile.
    if (weekButton) faceTarget({ type: 'insert-python-chip', x: 1010, y: 636 });
    audio.play('power');
    automationAcceptedAt = performance.now();
    persistence.save(state);
    return;
  }
  if (action.type === 'pick-torn-button') {
    state = applyGameAction(state, action);
    setFlag('buttonPocket');
    audio.play('pickup');
    factoryView.say('lunch', 'Кнопку в карман? Правильно. На память о начальнике. (жуёт)');
    return;
  }
  if (action.type === 'pick-python-chip') {
    state = applyGameAction(state, action);
    audio.play('pickup');
    return;
  }
  if (action.type === 'insert-python-chip') {
    state = applyGameAction(state, action);
    audio.play('power');
    return;
  }
  if (action.type === 'inspect-red-crate') {
    state = applyGameAction(state, action);
    if (state.scene === 'condition') recordSkill('if', 'tap', { stage: 1, key: 'if:idea' });
    audio.play('blocked');
    if (state.scene === 'condition') {
      const terminal = getInteractionTarget(state);
      if (terminal) faceTarget(terminal);
    }
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
  audio.play(wasCarrying ? 'drop' : 'pickup');
  if (wasCarrying && action.target === 'pallet-a' && manualStartedAt !== null) {
    telemetry.mark('manual-transfer-ms', Math.round(performance.now() - manualStartedAt));
    manualStartedAt = null;
  }
}

function openMachineFromCanvas(event) {
  if (!['machine', 'condition', 'forlesson', 'queue', 'function'].includes(state.scene)) return;
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
  if (!started || machineOpen || storyActive || isBlockingOverlayOpen()) {
    input.consume('action');
    input.consume('jump');
    return;
  }
  if (input.consume('jump')) {
    if (firstPersonActive()) factoryView.jump(state);
    else useAction();
  }
  if (input.consume('action')) useAction();
}

function currentEngagementProgressKey() {
  return [
    state.scene, state.checkpoint, state.player.carrying ?? '-',
    state.warehouse.manualDelivered, state.warehouse.autoDelivered,
    machineOpen ? 'machine-open' : 'world', wakeAttempts,
    hud.code?.value?.split('\n').filter(line => line.trim()).length ?? 0,
  ].join('|');
}

function updateLearningBridge() {
  const bridge = getConceptBridge(state.scene);
  if (!hud.bridge) return;
  hud.bridge.hidden = !bridge;
  if (!bridge) return;
  hud.bridgeWorld.textContent = bridge.world;
  hud.bridgeMeaning.textContent = bridge.meaning;
  hud.bridgePython.textContent = bridge.python;
  hud.bridgeQuestion.textContent = bridge.question;
}

function updateSkillRecorder() {
  if (!hud.skillRecorder) return;
  const visible = started && state.scene === 'warehouse' && state.checkpoint === 'start';
  hud.skillRecorder.hidden = !visible;
  if (!visible) return;
  const beat = getSkillRecorderBeat(state.warehouse.manualDelivered);
  hud.skillRecorder.dataset.complete = String(beat.complete);
  hud.skillRecorderLabel.textContent = beat.label;
  hud.skillRecorderCopy.textContent = beat.copy;
  [...hud.skillRecorderCells.children].forEach((cell, index) => { cell.dataset.filled = String(beat.cells[index]); });
}

function updateAdaptiveCoach(now) {
  if (!hud.coach) return;
  const progressKey = currentEngagementProgressKey();
  if (progressKey !== engagementProgressKey) {
    engagementProgressKey = progressKey;
    engagementProgressAt = now;
  }
  if (!started || storyActive || isBlockingOverlayOpen()) { hud.coach.hidden = true; return; }
  const coach = getAdaptiveCoach({
    scene: state.scene,
    carrying: Boolean(state.player.carrying),
    manualDelivered: state.warehouse.manualDelivered,
    machineOpen,
    failedAttempts: wakeAttempts,
    stalledMs: Math.max(0, now - engagementProgressAt),
    mode: explainMode,
  });
  hud.coach.hidden = !coach;
  if (!coach) return;
  hud.coach.dataset.level = String(coach.level);
  hud.coachTitle.textContent = coach.title;
  hud.coachText.textContent = coach.text;
}

function updateHud(now = performance.now()) {
  startPanel.hidden = started;
  game.dataset.started = String(started);
  game.dataset.scene = state.scene;
  game.dataset.firstPerson = String(started && firstPersonScene() && !machineOpen && !isBlockingOverlayOpen());
  game.dataset.machineOpen = String(machineOpen);
  input.setPointerNavigation(!firstPersonScene());
  game.dataset.manualShowcase = showcaseManual ? 'true' : 'false';
  game.dataset.chipShowcase = showcaseChip ? 'true' : 'false';
  updateLearningBridge();
  updateSkillRecorder();
  updateAdaptiveCoach(now);
  game.dataset.intro = state.scene === 'warehouse' && !state.warehouse.introComplete ? 'warehouse' : '';
  game.dataset.wakeReveal = state.arm.wakeRevealRemaining > 0 ? 'true' : 'false';
  const nearby = getNearbyAction(state);
  const firstActionGuide = narrowViewport.matches ? getFirstActionGuide(state) : null;
  game.dataset.firstActionGuide = firstActionGuide ? 'true' : 'false';
  const inWarehouse = ['warehouse', 'chip', 'machine', 'automation', 'red-crate', 'condition', 'forlesson', 'queue', 'function', 'reward'].includes(state.scene);
  const powers = document.querySelectorAll('.power');
  powers.forEach((button) => { button.disabled = !state.powers[button.id.replace('power', '').toLowerCase()]; });
  const target = getInteractionTarget(state);
  const transform = getViewportTransform({ width: canvas.clientWidth, height: canvas.clientHeight }, getSceneCameraTarget(state));
  const fpTargetReady = firstPersonScene() && target && nearby?.type === target.type && lookingAt(target);
  const talkWho = !fpTargetReady && !machineOpen && !storyActive && !isBlockingOverlayOpen() ? hallTalkTarget() : null;
  for (const c of document.querySelectorAll('#gameHud [data-clock]')) { const t = clockText(); if (c.textContent !== t) { c.textContent = t; c.setAttribute('aria-label', `Часы · ${t}`); } }
  hud.action.style.display = (!machineOpen && !storyActive && ((target && (firstPersonScene() ? fpTargetReady : true)) || talkWho)) ? 'flex' : 'none';
  hud.chip.hidden = true;
  hud.action.querySelector('.action-button__key').hidden = narrowViewport.matches;
  if (talkWho) {
    hud.action.style.left = '50%';
    hud.action.style.top = '';
    hud.action.dataset.direction = 'here';
    hud.action.dataset.walking = 'false';
    hud.action.querySelector('b').textContent = HALL_TALK_LABEL[talkWho];
    hud.action.querySelector('.action-button__key').textContent = 'E';
  } else if (target) {
    if (firstPersonScene()) {
      hud.action.style.left = '50%';
      hud.action.style.top = '';
      hud.action.dataset.direction = 'here';
      hud.action.dataset.walking = 'false';
      hud.action.querySelector('b').textContent = target.label.toUpperCase();
      hud.action.querySelector('.action-button__key').textContent = fpTargetReady ? 'E' : '';
    } else {
      const pos = placeWorldButton(target, transform, { width: canvas.clientWidth, height: canvas.clientHeight }, hud.action.offsetWidth || 220);
      hud.action.style.left = `${pos.x}px`;
      hud.action.style.top = `${pos.y}px`;
      hud.action.dataset.direction = pos.direction;
      hud.action.dataset.walking = String(Boolean(walkingTarget));
      hud.action.querySelector('b').textContent = walkingTarget ? 'ИДУ…' : `${pos.direction === 'left' ? '← ' : pos.direction === 'right' ? '→ ' : ''}${target.label}`;
      hud.action.querySelector('.action-button__key').textContent = nearby?.type === target.type ? 'ПРОБЕЛ' : '';
    }
  }
  const coach = document.querySelector('#movementCoach');
  coach.hidden = !started || state.scene !== 'prologue' || firstMovementSeen;
  if (!coach.hidden) {
    const pos = placeWorldButton(state.player, transform, { width: canvas.clientWidth, height: canvas.clientHeight }, 290);
    coach.style.left = `${pos.x}px`; coach.style.top = `${pos.y}px`;
    coach.textContent = narrowViewport.matches ? 'Веди пальцем по полю · я стреляю сам' : '↑ ↓ ← → Двигайся · я стреляю сам';
  }
  wallet.hidden = !started || ['prologue', 'collapse'].includes(state.scene) || machineOpen || payCard.visible();
  { const label = weekOn() ? 'НА СЧЕТУ' : 'СЧЁТ СМЕНЫ'; const el = wallet.querySelector('small'); if (el.textContent !== label) el.textContent = label; }
  document.querySelector('#walletTotal').textContent = `${state.warehouse.wage.toLocaleString('ru-RU')} ₽`;
  document.querySelector('#walletMode').textContent = weekOn() ? `+${CRATE_PAY} ₽ за каждый ящик` : state.arm.awake ? `РУКА ЗАРАБОТАЛА ${(state.warehouse.autoDelivered * CRATE_PAY).toLocaleString('ru-RU')} ₽` : `+${CRATE_PAY} ₽ за каждый ящик`;
  incomeToast.hidden = now >= incomeNoticeUntil;

  if (state.scene === 'prologue') {
    hud.chapter.textContent = 'ВЗГЛЯД В БУДУЩЕЕ';
    hud.mission.textContent = 'ВОТ КАКИМ ТЫ СТАНЕШЬ';
    hud.message.textContent = 'КОРОТКАЯ ВСПЫШКА · ДАЛЬШЕ — ЯЩИКИ И РУКА';
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
    hud.chapter.textContent = state.learning.chapter >= 10 ? 'ГЛАВА 10 · АГЕНТНЫЙ ЦЕХ'
      : state.learning.chapter >= 9 ? 'ГЛАВА 9 · AI-ПОЛИГОН'
      : state.learning.chapter >= 8 ? 'POSTGAME · ИНЖЕНЕРНЫЙ КАМПУС'
      : state.learning.chapter >= 7 ? 'ГЛАВА 7 · УСТОЙЧИВОСТЬ'
      : state.learning.chapter >= 6 ? 'ГЛАВА 6 · ПАМЯТЬ'
      : state.learning.chapter >= 5 ? 'ГЛАВА 5 · КОМАНДА'
      : state.learning.chapter >= 4 ? 'ДЕНЬ 3 · ДВЕ ЛИНИИ'
      : state.learning.chapter >= 3 ? 'ДЕНЬ 2 · НОЧЬ · СКЛАД 07'
      : state.learning.chapter >= 2 ? 'ДЕНЬ 2 · СКЛАД 07' : 'ДЕНЬ 1 · СКЛАД 07';
    if (state.scene === 'chip') {
      hud.mission.textContent = state.arm.chip === 'inserting' ? 'Чип защёлкивается в разъёме' : 'В руках — сервисный чип ARM 07';
      hud.message.textContent = state.arm.chip === 'inserting' ? 'СЛЫШЕН ЩЕЛЧОК · РУКА ПОЛУЧАЕТ ПИТАНИЕ' : 'ПОДОЙДИ К РУКЕ · НАЙДИ ПУСТОЙ РАЗЪЁМ';
    } else if (state.scene === 'machine' && state.warehouse.day2) {
      const d = state.warehouse.day2;
      hud.mission.textContent = d === 'button' ? 'Зелёная кнопка «ПУСК»' : (d === 'print' ? 'Скажи руке словами' : (d === 'tear' ? 'Идёт начальник…' : 'Кнопки нет. Терминал есть.'));
      hud.message.textContent = nearby?.label ? `E · ${nearby.label}` : (d === 'button' ? 'ПОДОЙДИ К КНОПКЕ У РУКИ · E' : 'ПОДОЙДИ К ТЕРМИНАЛУ У РУКИ · E');
    } else if (state.scene === 'condition' && state.warehouse.ruleStage) {
      hud.mission.textContent = state.warehouse.ruleStage === 'rules' ? 'Только белые. Красные — штраф.' : 'Новая партия. Скажи правило словами Python.';
      hud.message.textContent = nearby?.label ? `E · ${nearby.label}` : 'ПОДОЙДИ К ТЕРМИНАЛУ У РУКИ · E';
    } else if (['forlesson', 'queue', 'function'].includes(state.scene) && state.warehouse.lessonStage) {
      const st = state.warehouse.lessonStage;
      const title = { forlesson: 'Фура: ящиков много', queue: 'Ночь: ящики всё едут', function: 'Две линии — одно правило' }[state.scene];
      const floorName = { tap: 'КНОПКА', knobs: 'ПАНЕЛЬ', code: 'КОД', combo: 'КОД + IF · БЕЗ ВСТАВКИ' }[st];
      hud.mission.textContent = title;
      hud.message.textContent = nearby?.label ? `E · ${nearby.label}` : `ТЕРМИНАЛ У РУКИ · ${floorName}`;
    } else if (state.scene === 'queue') {
      hud.mission.textContent = 'Q-Bot остаётся один на ночь';
      hud.message.textContent = machineOpen ? 'ПОКА ОЧЕРЕДЬ ЖИВА · WHILE → POP → IF → MOVE' : 'ПОДОЙДИ К ТЕРМИНАЛУ · НАУЧИ БОТА НЕ ЗНАТЬ КОНЦА ЗАРАНЕЕ';
    } else if (state.scene === 'function') {
      hud.mission.textContent = 'Две линии. Одно поведение.';
      hud.message.textContent = machineOpen ? 'DEF ROUTE(BATCH) · СОБЕРИ ОДИН МОДУЛЬ · ПОДКЛЮЧИ A И B' : 'ПОДОЙДИ К ТЕРМИНАЛУ · ПЕРЕСТАНЬ КОПИРОВАТЬ ПРАВИЛО';
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
        ? (state.arm.startSource === 'chip' ? 'Чип закреплён. Рука ожила.' : 'Рука услышала команду')
        : (state.arm.active || state.arm.queue.length ? 'Работа идёт сама' : 'Дай машине правило'));
      hud.message.textContent = failureCopy?.[1] ?? (revealing
        ? (state.arm.startSource === 'chip' ? 'СТОЙ И СМОТРИ · РУКА САМА ДОТАСКИВАЕТ ОСТАТОК' : 'КОМАНДА ПРИНЯТА · РУКА 07 ЗАПУЩЕНА')
        : (now < incomeNoticeUntil
        ? `+${CRATE_PAY} ₽ · +4 МИНУТЫ СВОБОДЫ · АВТО ${state.warehouse.autoDelivered}/${state.warehouse.autoTarget ?? 6}`
        : (nearby?.label ?? (state.arm.active ? 'РУКА РАБОТАЕТ · ДЕНЬГИ КАПАЮТ' : `Автоматически: ${state.warehouse.autoDelivered}/${state.warehouse.autoTarget ?? 6}`))));
    } else if (state.scene === 'red-crate') {
      hud.mission.textContent = 'Машина остановилась';
      hud.message.textContent = nearby?.label ?? 'Подойди к красному ящику';
    } else if (state.scene === 'reward') {
      const rewardHud = {
        reward: ['Первый контур восстановлен', 'Следующая смена покажет, зачем нужен код'],
        reward2: ['Рука таскает только белые', 'ТЫ ПРИДУМАЛ ПРАВИЛО: КНОПКАМИ → СЛОВАМИ → IF'],
        'reward-for': ['Фура разгружена', 'ДЛЯ КАЖДОГО: КНОПКА → ПАНЕЛЬ → FOR → FOR + IF'],
        reward3: ['Ночная смена пережита', 'Q-BOT УМЕЕТ ЖИТЬ С ОЧЕРЕДЬЮ: ПОКА ЕСТЬ РАБОТА → БЕРИ → ПРОВЕРЯЙ → ДЕЛАЙ'],
        reward4: ['Один маршрут стал модулем', 'DEF ROUTE() ПОДКЛЮЧЁН К ДВУМ ЛИНИЯМ'],
        friends: ['Друзья ждут в тренировочном контуре', '6 СОБЫТИЙ · 3 ВРЕМЕННЫЕ AI-РОЛИ · 1 Q-BOT'],
        reward5: ['Командная защита удержана', 'FOR → DEF → IF СВЯЗАЛИ ВХОДНЫЕ СОБЫТИЯ С ПРИЁМАМИ'],
        vika: ['Память меняет решение', 'ОДИНАКОВЫЙ SIGNAL · ДРУГОЙ STATE'],
        reward6: ['Состояние сохранено', 'DICT / STATE ОТКРЫТ · ПАМЯТЬ СТАЛА ЧАСТЬЮ РЕШЕНИЯ'],
        virus: ['Финальный процесс сломан', 'ТИП · ПРОПУСК · TIMEOUT · ПОРЯДОК'],
        reward7: ['Первая игра завершена', 'TEST → TRY/EXCEPT → LOG · ПРОЦЕСС ПЕРЕЖИВАЕТ НЕОЖИДАННОСТЬ'],
        foundry: ['Цех автоматизации запущен', 'FILE · TEXT · TABLE → PIPELINE → BOTTLENECK'],
        reward8: ['Основная кампания завершена', 'КАМПУС ОТКРЫТ · СИСТЕМЫ · PYTHON · AI · LLM'],
        campus: ['Инженерный кампус', 'ВЫБЕРИ КОНТРАКТ ИЛИ ЛАБОРАТОРИЮ'],
        'ai-lab': ['AI-полигон активен', 'PIXELS → LABELS → EVAL → REWARD'],
        reward9: ['AI-полигон освоен', 'MODEL → EVAL → HUMAN FEEDBACK'],
        'llm-lab': ['Агентный цех активен', 'INSTRUCTION → CONTEXT → VALIDATOR → TOOL → EVAL'],
        reward10: ['LLM-обёртка собрана', 'PROMPT → CONTEXT → TOOL → EVAL · PROVIDER ЗАМЕНЯЕМ'],
      }[state.checkpoint] ?? ['Контур восстановлен', 'Система готова к следующему шагу'];
      [hud.mission.textContent, hud.message.textContent] = rewardHud;
    } else {
      hud.mission.textContent = 'Перенеси три ящика';
      hud.message.textContent = state.player.carrying ? 'ЯЩИК В РУКАХ · ДОЙДИ ДО ПАЛЕТЫ · E' : `ДОСТАВЛЕНО ${state.warehouse.manualDelivered}/3 · ПОДОЙДИ К ЯЩИКУ · E`;
    }
    if (weekOn()) weekHud(nearby);
    const completed = state.warehouse.manualDelivered + state.warehouse.autoDelivered;
    hud.progress.style.width = `${Math.min(100, (completed / 9) * 100)}%`;
    hud.system.textContent = state.arm.blocked ? 'БЛОК' : (state.arm.awake ? 'АВТО' : (['machine', 'condition', 'forlesson', 'queue', 'function'].includes(state.scene) ? 'ДОСТУП' : 'ОТКЛЮЧЕНА'));
    hud.sector.textContent = 'СКЛАД-07';
    hud.targets.textContent = state.arm.awake ? `${state.warehouse.autoDelivered}/${state.warehouse.autoTarget ?? 6}` : `${state.warehouse.manualDelivered}/3`;
  }

  hud.machine.hidden = !machineOpen;
  hud.ending.hidden = weekOn() || state.scene !== 'reward' || state.sceneTime < REWARD_REVEAL_DURATION || storyActive || isBlockingOverlayOpen();
  // 19.0: the pay card of the day (no overlaps: doors, wallet and the
  // companion step aside while it is up).
  if (weekOn() && started && state.scene === 'reward' && state.sceneTime >= .6 && !storyActive && !exitOpen && !isBlockingOverlayOpen()) payCard.show(weekCard());
  else payCard.hide();
  const sorterBonus = document.querySelector('#sorterBonus');
  const sorterUnlocked = ['reward2','reward3','reward4'].includes(state.checkpoint);
  sorterBonus.hidden = !sorterUnlocked;
  if (sorterUnlocked) sorterBonus.textContent = state.checkpoint === 'reward2'
    ? 'БОНУС · SORTER BAY · ПОИГРАТЬ С IF →'
    : state.checkpoint === 'reward3'
      ? 'БОНУС · SORTER BAY · ДВА ПРИЗНАКА →'
      : 'БОНУС · SORTER BAY · AND / OR / NOT →';
  const hasSkill = state.learning.printUnlocked || state.learning.forUnlocked || state.learning.ifUnlocked || state.learning.listUnlocked || state.learning.whileUnlocked || state.learning.funcUnlocked || state.learning.dictUnlocked || state.learning.reliabilityUnlocked || state.learning.asyncUnlocked || state.learning.aiUnlocked || state.learning.llmUnlocked || state.learning.botUnlocked;
  // 19.0: the old «ЧТО Я УЖЕ УМЕЮ» list covered the title on phones; the
  // skill tree (НАВЫКИ) says the same. It stays for ?legacy=1.
  document.querySelector('#journalToggle').hidden = !legacy || !hasSkill || machineOpen || storyActive || isBlockingOverlayOpen();
  const careerDoor = document.querySelector('#careerDoor');
  // 16.6: the door opens as soon as the chip wakes the arm (and stays from
  // chapter 2 / the first print on), not after chapter 8.
  const careerVisible = Boolean(state.arm?.awake || state.learning.printUnlocked || state.learning.chapter >= 2);
  careerDoor.hidden = !careerVisible || machineOpen || storyActive || isBlockingOverlayOpen() || payCard.visible();
  const questDoor = document.querySelector('#questDoor');
  const hudFree = started && !machineOpen && !storyActive && !isBlockingOverlayOpen() && !payCard.visible() && !['prologue', 'collapse'].includes(state.scene);
  questDoor.hidden = !hudFree;
  const questLine = document.querySelector('#questLine');
  const pin = hudFree && firstPersonScene() ? questPin(buildQuestLog(progressInput())) : '';
  questLine.hidden = !pin;
  const pinText = document.querySelector('#questLineText');
  if (pinText.textContent !== pin) pinText.textContent = pin;
  if (careerVisible) {
    const gates = ['vehicle','automation','security','web','ai','systems','lowlevel'];
    const unlocked = gates.filter(id => foundationStatus(state.learning, CAREER_REALMS.find(realm => realm.id === id)).ok).length;
    // 16.9.3: the door doubles as the always-visible character line.
    const me = characterSheet(campusProfile, state.learning, state.warehouse?.wage ?? 0);
    const line = `${me.rank} · ${me.money.toLocaleString('ru-RU')} ₽ · ДЕРЕВО`;
    const doorState = document.querySelector('#careerDoorState');
    if (doorState.textContent !== line) doorState.textContent = line;
  }
  hud.journal.hidden = !journalOpen || document.querySelector('#journalToggle').hidden;
  document.querySelector('#traceToggle').hidden = !state.learning.whileUnlocked || machineOpen || storyActive || isBlockingOverlayOpen();
  hud.printSkill.dataset.unlocked = String(state.learning.printUnlocked);
  hud.forSkill.dataset.unlocked = String(state.learning.forUnlocked);
  hud.ifSkill.dataset.unlocked = String(state.learning.ifUnlocked);
  hud.listSkill.dataset.unlocked = String(state.learning.listUnlocked);
  hud.whileSkill.dataset.unlocked = String(state.learning.whileUnlocked);
  hud.funcSkill.dataset.unlocked = String(state.learning.funcUnlocked);
  hud.dictSkill.dataset.unlocked = String(state.learning.dictUnlocked);
  hud.reliabilitySkill.dataset.unlocked = String(state.learning.reliabilityUnlocked);
  hud.asyncSkill.dataset.unlocked = String(state.learning.asyncUnlocked);
  hud.aiSkill.dataset.unlocked = String(state.learning.aiUnlocked);
  hud.llmSkill.dataset.unlocked = String(state.learning.llmUnlocked);
  hud.botSkill.dataset.unlocked = String(state.learning.botUnlocked);
  const learnedLabels = [
    ['Отправлять машине сообщение', state.learning.printUnlocked], ['Повторять для каждого', state.learning.forUnlocked], ['Выбирать по условию', state.learning.ifUnlocked],
    ['Хранить очередь', state.learning.listUnlocked], ['Работать, пока есть задачи', state.learning.whileUnlocked], ['Собирать повторяемый модуль', state.learning.funcUnlocked],
    ['Хранить состояние', state.learning.dictUnlocked], ['Переживать ошибки', state.learning.reliabilityUnlocked], ['Выполнять параллельно', state.learning.asyncUnlocked],
    ['Проверять модель', state.learning.aiUnlocked], ['Собирать LLM-контур', state.learning.llmUnlocked], ['Настраивать Q-Bot', state.learning.botUnlocked],
  ].filter(([, unlocked]) => unlocked).map(([label]) => label);
  document.querySelector('#journalToggle').textContent = learnedLabels.length ? 'ЧТО Я УЖЕ УМЕЮ' : 'НАВЫКИ';
  document.querySelector('#journalToggle').title = learnedLabels.join(' · ');
  if (state.checkpoint === 'reward10') {
    hud.endingEyebrow.textContent = `QUEQUEST ${BUILD} · АГЕНТНЫЙ ЦЕХ`;
    hud.endingTitle.textContent = 'Теперь модель — не магическая коробка, а заменяемая деталь системы.';
    hud.endingCopy.textContent = 'Instruction задаёт полномочия, context приносит факты, validator держит структуру и allowlist, tool выполняет действие, evals проверяют качество на наборе случаев. Кампус остаётся открыт для контрактов и кода.';
    document.querySelector('#continueGame').textContent = 'ВЕРНУТЬСЯ В ИНЖЕНЕРНЫЙ КАМПУС →';
  } else if (state.checkpoint === 'llm-lab') {
    hud.endingEyebrow.textContent = 'ГЛАВА 10 · АГЕНТНЫЙ ЦЕХ';
    hud.endingTitle.textContent = 'Обёртка ещё не собрана.';
    hud.endingCopy.textContent = 'Дай модели факты, заставь вернуть проверяемую структуру, ограничь инструменты и не доверяй одному красивому демо — прогони evals.';
    document.querySelector('#continueGame').textContent = 'ВЕРНУТЬСЯ К LLM-ОБЁРТКЕ →';
  } else if (state.checkpoint === 'reward9') {
    hud.endingEyebrow.textContent = 'ГЛАВА 9 · AI-ПОЛИГОН';
    hud.endingTitle.textContent = 'Ты изменил поведение модели данными и обратной связью.';
    hud.endingCopy.textContent = 'Один и тот же алгоритм стал точнее после нового размеченного примера. Затем reward изменил ценность действий. MODEL / EVAL / REWARD открыты.';
    document.querySelector('#continueGame').textContent = 'ВЕРНУТЬСЯ В КАМПУС →';
  } else if (state.checkpoint === 'ai-lab') {
    hud.endingEyebrow.textContent = 'ГЛАВА 9 · AI-ПОЛИГОН';
    hud.endingTitle.textContent = 'Модель ждёт твоей обратной связи.';
    hud.endingCopy.textContent = 'Сначала измерь ошибку на незнакомом классе, затем добавь label и проверь accuracy снова. После этого переключись на reward.';
    document.querySelector('#continueGame').textContent = 'ВЕРНУТЬСЯ К МОДЕЛИ →';
  } else if (state.checkpoint === 'campus') {
    hud.endingEyebrow.textContent = 'POSTGAME · ИНЖЕНЕРНЫЙ КАМПУС';
    hud.endingTitle.textContent = 'Теперь ты выбираешь, что усиливать.';
    hud.endingCopy.textContent = 'Системные контракты, настоящий Python, AI-полигон и LLM-обёртки живут в одном профиле. Это уже не линейная кампания, а долгий инженерный режим.';
    document.querySelector('#continueGame').textContent = 'ОТКРЫТЬ КАМПУС →';
  } else if (state.checkpoint === 'reward8') {
    hud.endingEyebrow.textContent = 'ОСНОВНАЯ КАМПАНИЯ · АВТОМАТИЗАЦИЯ';
    hud.endingTitle.textContent = 'Ты перестал ускорять шаги. Ты начал проектировать поток.';
    hud.endingCopy.textContent = 'FILE / TEXT / TABLE прошли pipeline, Queue удержала поток, два worker-а подняли throughput, Lock защитил shared state. Теперь открывается нелинейный инженерный кампус.';
    document.querySelector('#continueGame').textContent = 'ВОЙТИ В ИНЖЕНЕРНЫЙ КАМПУС →';
  } else if (state.checkpoint === 'foundry') {
    hud.endingEyebrow.textContent = 'ГЛАВА 8 · ЦЕХ АВТОМАТИЗАЦИИ';
    hud.endingTitle.textContent = 'Поток ещё не стабилен.';
    hud.endingCopy.textContent = 'Пройди ручной pipeline, собери линию, найди узкое место и только потом запускай несколько worker-ов.';
    document.querySelector('#continueGame').textContent = 'ВЕРНУТЬСЯ В ЦЕХ →';
  } else if (state.checkpoint === 'reward7') {
    hud.endingEyebrow.textContent = 'ФИНАЛ ПЕРВОЙ ИГРЫ · УСТОЙЧИВОСТЬ';
    hud.endingTitle.textContent = 'Теперь ошибка не обязана заканчивать процесс.';
    hud.endingCopy.textContent = 'Ты воспроизвёл четыре сбоя, восстановил каждый и оставил журнал. TEST → TRY/EXCEPT → LOG превращают неожиданность из финального удара в управляемый случай.';
    document.querySelector('#continueGame').textContent = 'ОТКРЫТЬ СЛЕДУЮЩИЙ ГОРИЗОНТ →';
  } else if (state.checkpoint === 'virus') {
    hud.endingEyebrow.textContent = 'ГЛАВА 7 · ВИРУС';
    hud.endingTitle.textContent = 'Процесс всё ещё сломан.';
    hud.endingCopy.textContent = 'Финал не про HP: восстанови неверный тип, пропуск, таймаут и нарушенный порядок.';
    document.querySelector('#continueGame').textContent = 'ВЕРНУТЬСЯ К СБОЮ →';
  } else if (state.checkpoint === 'reward6') {
    hud.endingEyebrow.textContent = 'ШЕСТОЙ КОНТУР · ПАМЯТЬ';
    hud.endingTitle.textContent = 'Одинаковый вход больше не означает одинаковое решение.';
    hud.endingCopy.textContent = 'Ты трижды увидел один и тот же сигнал. Решение менялось только потому, что система сохраняла seen и trusted. После победы физическая панель памяти раскрылась как DICT / STATE.';
    document.querySelector('#continueGame').textContent = 'ПОСМОТРЕТЬ, ЧТО ДАЛЬШЕ →';
  } else if (state.checkpoint === 'vika') {
    hud.endingEyebrow.textContent = 'ШЕСТАЯ ГЛАВА · ВИКА';
    hud.endingTitle.textContent = 'Одинаковый сигнал уже ждёт.';
    hud.endingCopy.textContent = 'Смотри на то, что система уже запомнила, а не на то, как выглядит вход.';
    document.querySelector('#continueGame').textContent = 'ВЕРНУТЬСЯ К ПАМЯТИ →';
  } else if (state.checkpoint === 'reward5') {
    hud.endingEyebrow.textContent = 'ПЯТЫЙ КОНТУР · КОМАНДА';
    hud.endingTitle.textContent = 'Ты связал события с устойчивыми приёмами.';
    hud.endingCopy.textContent = 'Шесть игровых событий пришли как входной поток. Q-Bot держал указатель event, а ты выбирал одну из трёх AI-ролей. После победы тот же приём раскрылся как знакомая связка FOR → DEF → IF.';
    document.querySelector('#continueGame').textContent = 'ПОСМОТРЕТЬ, ЧТО ДАЛЬШЕ →';
  } else if (state.checkpoint === 'friends') {
    hud.endingEyebrow.textContent = 'ПЯТАЯ ГЛАВА · ТРЕНИРОВОЧНАЯ ЗАЩИТА';
    hud.endingTitle.textContent = 'Друзья ждут тебя в контуре.';
    hud.endingCopy.textContent = 'Шесть импульсов уже летят. Трое друзей и Q-Bot ждут, кого куда поставишь.';
    document.querySelector('#continueGame').textContent = 'ВЕРНУТЬСЯ В МАТЧ →';
  } else if (state.checkpoint === 'reward4') {
    hud.endingEyebrow.textContent = 'ЧЕТВЁРТЫЙ КОНТУР ВОССТАНОВЛЕН';
    hud.endingTitle.textContent = 'Ты превратил алгоритм в деталь.';
    hud.endingCopy.textContent = 'DEF дал уже знакомому маршруту имя. Параметр batch позволил применить один и тот же навык к двум разным линиям. Теперь исправление делается в одном месте — и обе машины получают новую версию поведения.';
    document.querySelector('#continueGame').textContent = 'ДОМОЙ · ДРУЗЬЯ УЖЕ ПИШУТ →';
  } else if (state.checkpoint === 'reward3') {
    hud.endingEyebrow.textContent = 'УТРО · НОЧНАЯ СМЕНА ЗАКОНЧЕНА';
    hud.endingTitle.textContent = 'Линия не остановилась, хотя число ящиков всё время менялось.';
    hud.endingCopy.textContent = 'Машина брала следующий груз и снова проверяла, осталась ли работа. В Python это очередь и цикл while. Главное ты уже видел в мире: повторять нужно не заданное число раз, а пока работа действительно есть.';
    document.querySelector('#continueGame').textContent = 'СДАТЬ СМЕНУ →';
  } else if (state.checkpoint === 'reward2') {
    hud.endingEyebrow.textContent = 'КАССА · КОНЕЦ ВТОРОЙ СМЕНЫ';
    hud.endingTitle.textContent = 'Теперь рука умеет не только двигаться, но и выбирать.';
    hud.endingCopy.textContent = 'Ты дал ей понятное правило: белый — бери, красный — оставь. В Python это слово if. Вечером приедет фура — ящиков будет много.';
    document.querySelector('#continueGame').textContent = 'ЗАКОНЧИТЬ СМЕНУ →';
  } else if (state.checkpoint === 'reward-for') {
    hud.endingEyebrow.textContent = 'ДЕНЬ 2 · ВЕЧЕР · ФУРА РАЗГРУЖЕНА';
    hud.endingTitle.textContent = 'Одно правило — для каждого ящика.';
    hud.endingCopy.textContent = `Фура разгружена: рука прошла по всей партии сама. За день на счету ${state.warehouse.wage.toLocaleString('ru-RU')} ₽. Ночью линия останется без тебя.`;
    document.querySelector('#continueGame').textContent = 'К НОЧНОЙ СМЕНЕ →';
  } else {
    hud.endingEyebrow.textContent = 'КАССА · КОНЕЦ СМЕНЫ';
    hud.endingTitle.textContent = 'Рука дотащила остаток участка.';
    hud.endingCopy.textContent = `За смену вышло ${state.warehouse.wage.toLocaleString('ru-RU')} ₽. Три ящика ты унёс сам. Остальное — машина. Завтра снова в 07:00.`;
    document.querySelector('#continueGame').textContent = 'ПОЛУЧИТЬ ДЕНЬГИ · ВЕЧЕР ДОМА →';
  }
  hud.printSkillMethod.textContent = codeInputMethod === 'pasted'
    ? 'СПОСОБ: ВСТАВЛЕНО С КЛАВИАТУРЫ'
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
    } else if (phase >= 2300 && state.scene === 'chip' && state.arm.chip === 'held') {
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
  if (firstPersonScene()) {
    walkingTarget = null;
    const forward = -(input.state.moveY ?? 0);
    const strafe = input.state.moveX ?? 0;
    movement = {
      moveX: Math.sin(warehouseYaw) * forward + Math.cos(warehouseYaw) * strafe,
      moveY: -Math.cos(warehouseYaw) * forward + Math.sin(warehouseYaw) * strafe,
    };
  } else {
    if (Math.abs(input.state.moveX) + Math.abs(input.state.moveY) > 0) walkingTarget = null;
    if (walkingTarget && !machineOpen && !storyActive && !exitOpen) {
      const target = getInteractionTarget(state);
      movement = navigateToTarget(state.player, target);
      if (movement.arrived || !target) {
        walkingTarget = null;
        if (target) useAction();
      }
    }
  }
  const frameDt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  // In first person the hall (factory-view.js) moves the player; model.js
  // gets no movement, or its own step would look like a teleport.
  state = stepGame(state, firstPersonScene() ? { moveX: 0, moveY: 0 } : movement, (now - lastTime) / 1000, { paused: !started || machineOpen || storyActive || exitOpen || isBlockingOverlayOpen() });
  lastTime = now;
  if (firstPersonScene()) {
    // The hall owns walking: walls, crates, jumping. model.js keeps the rules.
    const paused = !firstPersonActive();
    const tilt = (lookKeys.has('KeyR') || lookKeys.has('PageUp') ? 1 : 0) - (lookKeys.has('KeyF') || lookKeys.has('PageDown') ? 1 : 0);
    if (!paused && tilt) factoryView.tilt(tilt, frameDt);
    const pos = factoryView.step(state, frameDt, { forward: -(input.state.moveY ?? 0), strafe: input.state.moveX ?? 0, yaw: warehouseYaw, paused });
    state = { ...state, player: { ...state.player, x: pos.x, y: pos.y } };
  }
  if (state.scene !== lastScene) {
    if (!showcaseChip && (isWeekCheckpoint(state.checkpoint) || ['warehouse', 'chip', 'machine', 'red-crate', 'reward', 'shift2', 'red2', 'condition', 'reward2', 'forlesson', 'reward-for', 'queue', 'reward3', 'function', 'reward4'].includes(state.checkpoint))) persistence.save(state);
    lastScene = state.scene;
    if (['machine', 'condition', 'forlesson', 'queue', 'function'].includes(state.scene)) {
      const nextTarget = getInteractionTarget(state);
      if (nextTarget) faceTarget(nextTarget);
      audio.play('poster');
      hourBeat();
    } else if (state.scene === 'chip') {
      const nextTarget = getInteractionTarget(state);
      if (nextTarget) faceTarget(nextTarget);
    }
    if (state.scene === 'warehouse') {
      warehouseCueStage = 0;
    }
    if (state.scene === 'reward') hourBeat();
    if (state.scene === 'collapse') audio.play('collapse');
    if (state.scene === 'red-crate') audio.play('blocked');
    if (audio.created()) audio.setAmbient(ambientForScene());
    telemetry.mark(`scene-${state.scene}`);
  }
  if (state.scene === 'warehouse' && state.warehouse.bossEntrance && !state.warehouse.introComplete && state.sceneTime >= DOOR_SLAM_AT && warehouseCueStage < 1) {
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
    document.querySelector('#incomeSource').textContent = state.warehouse.incomeSource === 'robot'
      ? 'Рука заработала. Ты не таскал.'
      : getManualIncomeCopy(state.warehouse.manualDelivered);
    incomeToast.getAnimations().forEach(animation => animation.cancel());
    incomeToast.animate([{ opacity: 0, transform: 'translate(-50%, -50%) scale(.8)' }, { opacity: 1, transform: 'translate(-50%, -50%) scale(1.08)', offset: .2 }, { opacity: 1, transform: 'translate(-50%, -50%) scale(1)', offset: .85 }, { opacity: 0, transform: 'translate(-50%, -50%) scale(.96)' }], { duration: prefersReducedMotion ? 1 : 1850 });
  }
  if (state.prologue.threats > lastThreats) {
    if (started) { audio.play('cannon'); audio.play('impact'); }
    lastThreats = state.prologue.threats;
  }
  updateHud(now);
  companion.update(!weekOn() && state.scene === 'reward' && !storyActive && !exitOpen && !isBlockingOverlayOpen(), now);
  watchWeekWorld(now);
  const wakeProgress = state.otherMind.phase === 'waking' && otherMindWakingAt !== null
    ? Math.min(1, Math.max(0, (now - otherMindWakingAt) / 1200))
    : (state.otherMind.phase === 'awake' ? 1 : 0);
  // 17.3: the NPC subtitle keeps above the «E · …» action prompt.
  if (firstPersonScene()) factoryView.setPromptBox(hud.action.style.display === 'flex' ? { canvas: canvas.getBoundingClientRect(), prompt: hud.action.getBoundingClientRect() } : null);
  // 16.8: the professions screen covers the whole game and plays its own
  // live scenes; don't also redraw the warehouse underneath it.
  if (careerWorldsRoot.hidden && fpWorldRoot.hidden) renderGame(
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
      firstPersonWarehouse: firstPersonScene(),
      cameraYaw: warehouseYaw,
      fpView: factoryView,
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

for (const [selector] of [['#actionButton']]) {
  document.querySelector(selector).addEventListener('pointerdown', (event) => {
    event.preventDefault();
    recordFirstAction();
    unlockAudioForScene();
    if (firstPersonScene()) {
      useAction();
      return;
    }
    const target = getInteractionTarget(state);
    if (target) walkingTarget = target;
  });
}

// 18.0: «начать заново» resets everything (game, profile, engine, locks,
// labyrinth), after a confirmation that lives in the page, not window.confirm.
function wipeProgress(storage = localStorage) {
  const keys = [];
  for (let i = 0; i < storage.length; i++) { const k = storage.key(i); if (k && /^quequest/.test(k) && k !== 'quequest.vr.device') keys.push(k); }
  for (const k of keys) storage.removeItem(k);
  return keys;
}
document.querySelector('#restartGame').addEventListener('click', () => {
  confirmInPage(document.querySelector('#confirmDialog'), {
    title: 'Начать заново?',
    text: 'Вся игра начнётся с первого дня: деньги, навыки, движок и квесты обнулятся. Отменить это нельзя.',
    yes: 'ДА, С НУЛЯ',
    no: 'НЕТ, ИГРАЮ ДАЛЬШЕ',
  }, () => {
    try { wipeProgress(); } catch { /* private mode */ }
    persistence.reset();
    const url = new URL(location.href);
    url.searchParams.delete('checkpoint');
    location.replace(url.toString());
  });
});

document.querySelector('#closeMachine').addEventListener('click', () => {
  machineOpen = false;
});

hud.chip.addEventListener('click', () => {
  // 16.2: chip interaction happens in the world with WASD + E/Space.
});

hud.code.addEventListener('beforeinput', (event) => {
  if (event.inputType === 'insertFromPaste') codeInputMethod = 'pasted';
  else if (event.inputType?.startsWith('insert')) codeInputMethod = 'typed';
});

document.querySelector('#sorterBonus').addEventListener('click', () => {
  const maxDifficulty = state.learning.funcUnlocked ? 3 : ((state.learning.listUnlocked || state.learning.whileUnlocked) ? 2 : 1);
  sorterBay.open({ maxDifficulty, seed: 41 + state.learning.chapter * 17 });
  telemetry.mark(`sorter-open-d${maxDifficulty}`);
});

document.querySelector('#continueGame').addEventListener('click', () => {
  if (state.checkpoint === 'reward') {
    tellStory(
      'ДОМА · ДЕНЬ 1 · 22:16',
      'Сегодня машина таскала вместо тебя.',
      'В кармане деньги за смену. В голове — один вопрос: что именно было на том сервисном чипе, если железная рука вдруг поняла, куда нести ящики?',
      'СПАТЬ →',
      () => {
        tellStory(
          'ДЕНЬ 2 · УТРО · 07:02',
          'Тот же склад. У руки появилась кнопка.',
          'Электрик прикрутил к терминалу руки зелёную кнопку «ПУСК». Начальник на планёрке. Подойди к кнопке и нажми E.',
          'ВОЙТИ В СКЛАД →',
          () => {
            state = applyGameAction(state, { type: 'start-second-shift' });
            lastAutoDelivered = 0;
            const looseButton = getInteractionTarget(state);
            if (looseButton) faceTarget(looseButton);
            persistence.save(state);
          },
        );
      },
    );
    return;
  }
  if (state.checkpoint === 'reward2') {
    tellStory(
      'ДЕНЬ 2 · ВЕЧЕР · 18:40',
      'Пришла фура. Ящиков — гора.',
      'Начальник по рации: «Разгрузить партию до конца смены». Кнопка «один ящик» тут не спасёт: ящиков много, и в каждой партии их разное число. Нужно сказать руке: повтори для каждого.',
      'К ТЕРМИНАЛУ →',
      () => {
        state = applyGameAction(state, { type: 'start-for-shift' });
        lastAutoDelivered = 0;
        const terminal = getInteractionTarget(state);
        if (terminal) faceTarget(terminal);
        persistence.save(state);
      },
    );
    return;
  }
  if (state.checkpoint === 'reward-for') {
    tellStory(
      'ДЕНЬ 2 · НОЧЬ · 23:47',
      'Ты уходишь. Q-Bot остаётся.',
      'Днём ящики были заранее разложены перед тобой. Ночью поток живёт сам: новые грузы приходят, старые уезжают. Машина должна каждый раз проверять, осталась ли работа, и продолжать до пустой линии.',
      'ОТКРЫТЬ НОЧНУЮ ОЧЕРЕДЬ →',
      () => {
        state = applyGameAction(state, { type: 'start-third-shift' });
        lastAutoDelivered = 0;
        const terminal = getInteractionTarget(state);
        if (terminal) faceTarget(terminal);
        persistence.save(state);
      },
    );
    return;
  }
  if (state.checkpoint === 'reward3') {
    tellStory(
      'ДЕНЬ 3 · УТРО · 08:03',
      'На складе включили вторую линию.',
      'Начальник скопировал вчерашнее правило во второй терминал. Теперь одно и то же поведение существует в двух местах. Исправишь одно — второе останется старым. Значит, маршрут пора собрать в один именованный навык.',
      'СОБРАТЬ МОДУЛЬ ROUTE() →',
      () => {
        state = applyGameAction(state, { type: 'start-fourth-shift' });
        lastAutoDelivered = 0;
        const terminal = getInteractionTarget(state);
        if (terminal) faceTarget(terminal);
        persistence.save(state);
      },
    );
    return;
  }
  if (state.checkpoint === 'friends') {
    friendVisited = true;
    friendSandbox.open({ resume: true });
    return;
  }
  if (state.checkpoint === 'vika') {
    friendVisited = true;
    vikaMemory.open({ resume: true });
    return;
  }
  if (state.checkpoint === 'reward5') {
    friendVisited = true;
    vikaMemory.open();
    return;
  }
  if (state.checkpoint === 'virus') {
    friendVisited = true;
    virusFinale.open({ resume: true });
    return;
  }
  if (state.checkpoint === 'reward6') {
    friendVisited = true;
    virusFinale.open();
    return;
  }
  if (state.checkpoint === 'foundry') {
    friendVisited = true;
    automationFoundry.open({ resume: true });
    return;
  }
  if (state.checkpoint === 'reward7') {
    friendVisited = true;
    automationFoundry.open();
    return;
  }
  if (state.checkpoint === 'ai-lab') {
    friendVisited = true;
    aiLab.open({ resume: true });
    return;
  }
  if (state.checkpoint === 'llm-lab') {
    friendVisited = true;
    llmWorkshop.open({ resume: true });
    return;
  }
  if (['reward8', 'campus', 'reward9', 'reward10'].includes(state.checkpoint)) {
    friendVisited = true;
    campus.open();
    return;
  }
  if (!legacy) return; // 19.0: the friends chapter is legacy-only (?legacy=1)
  if (!friendVisited) {
    friendVisited = true;
    tellStory('ДОМА · СООБЩЕНИЕ ОТ ДРУГА', 'Ты освободил себе вечер.', '«Ты оживил ту руку? Тогда заходи в наш тренировочный контур. Нас трое, Q-Bot будет четвёртым. Шесть импульсов уже летят — распределишь защиту?»', 'ВОЙТИ В ТРЕНИРОВОЧНЫЙ КОНТУР →', () => friendSandbox.open());
  } else comic.show(0);
});

let traceHidden = false;
document.querySelector('#traceToggle').addEventListener('click', () => {
  traceHidden = !traceHidden;
  game.dataset.trace = traceHidden ? 'off' : 'on';
  const button = document.querySelector('#traceToggle');
  button.setAttribute('aria-pressed', String(traceHidden));
  button.setAttribute('aria-label', traceHidden ? 'Показать трассировку' : 'Скрыть трассировку');
  button.textContent = traceHidden ? 'ТРАССА: ВЫКЛ' : 'ТРАССА: ВКЛ';
});

document.querySelector('#soundToggle').addEventListener('click', async () => {
  await unlockAudioForScene();
  const muted = audio.toggle();
  const button = document.querySelector('#soundToggle');
  button.setAttribute('aria-pressed', String(muted));
  button.setAttribute('aria-label', muted ? 'Включить звук' : 'Выключить звук');
  button.textContent = muted ? 'ЗВУК: ВЫКЛ' : 'ЗВУК: ВКЛ';
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
    hall: { debug: (patch) => { const pos = factoryView.debug(patch); state = { ...state, player: { ...state.player, ...pos } }; return pos; }, body: () => factoryView.body(), engine: () => factoryView.engine(), speech: () => factoryView.speech(), setYaw: (yaw) => { warehouseYaw = yaw; } },
    ring: { open: (view = 'card', opts = {}) => openRing(view, opts), close: () => ring.close(), state: () => ring.state(), fast: (on = true) => ring.fast(on), start: (opts) => ring.start(opts), snapshot: () => profileSnapshot(campusProfile, { player: currentPlayer() }), store: () => profileStore.kind, account: () => profileStore.account?.status?.() ?? null, sync: () => syncAccountOnce() },
    world: { open: (level = 'garage', opts = {}) => fpWorld.open(level, opts), debug: (patch) => fpWorld.debug(patch), state: () => fpWorld.state(), surface: (r) => careerWorlds.surface(r), engine: () => engineStatus(engineNow()) },
    pythonio: { open: (opts) => pythonio.open(opts), close: () => pythonio.close(), active: () => pythonio.active, ready: () => pythonio.ready },
    blackice: { open: (opts) => blackice.open(opts), close: () => blackice.close(), enter: (n) => blackice.enter(n), lobby: () => blackice.lobby(), handle: (msg) => blackice.handle(msg), active: () => blackice.active, ready: () => blackice.ready, view: () => blackice.view, playing: () => blackice.playing, profile: () => ({ stats: campusProfile.stats, cleared: labyrinthCleared(campusProfile), xp: campusProfile.xp, wage: state.warehouse?.wage ?? 0 }) },
    hour: { openTerminal: () => openMachinePanel(), desk: () => hourDesk.step(), beat: () => hourBeat(), lesson: () => state.warehouse.lessonStage, state: () => ({ day2: state.warehouse.day2, button: state.warehouse.button, ruleStage: state.warehouse.ruleStage, scene: state.scene, storyActive }) },
    firstShift: { debug: (patch) => firstShift.debug(patch), state: () => firstShift.state(), body: () => firstShift.body(), speech: () => firstShift.speech(), chip: () => firstShift.chip() },
    // 19.0: the first week.
    week: {
      state: () => ({ checkpoint: state.checkpoint, scene: state.scene, week: state.warehouse.week, day: state.warehouse.day, wage: state.warehouse.wage, autoDelivered: state.warehouse.autoDelivered, autoTarget: state.warehouse.autoTarget, button: state.warehouse.button, card: payCard.visible(), story: storyActive, desk: hourDesk.step(), flags: loadFlags(), pin: document.querySelector('#questLineText')?.textContent ?? '', clock: clockText(), legacy }),
      terminal: () => openMachinePanel(),
      next: () => weekCardNext(),
      face: () => { const t = getInteractionTarget(state); if (t) { factoryView.place(state); faceTarget(t); } return t; },
      fast: (k = 6) => { state = { ...state, arm: { ...state.arm, wakeRevealRemaining: 0, active: state.arm.active ? { ...state.arm.active, progress: Math.max(state.arm.active.progress, 1 - 1 / k) } : null } }; },
    },
    // 18.2: §16 reflexes and §17 meaning layers.
    reflex: { record: () => JSON.parse(JSON.stringify(reflexRecord)), save: () => saveReflex(), talk: (who) => talkInHall(who), target: () => hallTalkTarget(), knows: () => [...knowsNow()], slip: (scene) => factoryView.pair(takeSlip(scene)) },
    otherMind: () => ({
      ...otherMindRuntime.snapshot(),
      phase: state.otherMind.phase,
      line: state.otherMind.line,
    }),
  };
}

applyBuildLabels(document);
// 18.0: phones — a stick, look-drag, E and jump; a rotate hint in portrait.
window.addEventListener('qq:look', (ev) => {
  if (!firstPersonActive()) return;
  warehouseYaw = wrapAngle(warehouseYaw + ev.detail.dx);
  factoryView.look(ev.detail.dx, ev.detail.dy);
});
const touchDevice = isTouchDevice() || query.has('touch');
game.dataset.touch = String(touchDevice);
const fpWorldEl = document.querySelector('#fpWorld');
const touchControls = createTouchControls(document.querySelector('#touchPad'), {
  isActive: () => {
    if (!touchDevice) return false;
    const fs = document.querySelector('#firstShift');
    if (!fs.hidden) return document.querySelector('#firstShiftDialogue').hidden && fs.dataset.dive !== 'enter' && !['confront', 'fight-result', 'payday', 'briefing'].includes(fs.dataset.phase);
    if (fpWorldEl && !fpWorldEl.hidden) return true;
    return firstPersonActive();
  },
});
let rotateDismissed = false;
document.querySelector('#rotateDismiss').addEventListener('click', () => { rotateDismissed = true; document.querySelector('#rotateHint').hidden = true; });
function updateTouch() {
  touchControls.update();
  const portrait = innerHeight > innerWidth;
  game.dataset.portrait = String(portrait);
  document.querySelector('#rotateHint').hidden = !(touchDevice && portrait && !rotateDismissed && (firstPersonActive() || !document.querySelector('#firstShift').hidden));
  requestAnimationFrame(updateTouch);
}
requestAnimationFrame(updateTouch);
window.addEventListener('resize', resizeCanvas);
window.addEventListener('keydown', unlockAudioForScene, { once: true });
canvas.addEventListener('pointerdown', unlockAudioForScene, { once: true });
canvas.addEventListener('click', (event) => {
  if (firstPersonActive()) {
    canvas.requestPointerLock?.();
    return;
  }
  openMachineFromCanvas(event);
});
window.addEventListener('mousemove', (event) => {
  if (document.pointerLockElement !== canvas || !firstPersonActive()) return;
  warehouseYaw = wrapAngle(warehouseYaw + event.movementX * .0026);
  factoryView.look(event.movementX * .0026, event.movementY * .0026);
});
resizeCanvas();
if (legacy && state.checkpoint === 'ai-lab') aiLab.open({ resume: true });
else if (legacy && state.checkpoint === 'llm-lab') llmWorkshop.open({ resume: true });
else if (legacy && ['campus', 'reward9', 'reward10'].includes(state.checkpoint)) campus.open();
updateHud();
requestAnimationFrame(frame);

// 17.3: ?world=garage|home walks straight into the garage or the apartment.
if (['garage', 'home'].includes(query.get('world'))) fpWorld.open(query.get('world'));

// 19.1 · ?open=card|ring|class|share (and ?duel=<code> for a friend's
// card) open the diver card straight away — for the demo link too.
{
  const ringOpen = query.get('open');
  const code = query.get('duel');
  if (code) openRing('share', { demo: true, code });
  else if (['card', 'ring', 'class', 'share', 'storm'].includes(ringOpen)) openRing(ringOpen === 'ring' ? 'ladder' : ringOpen, { demo: query.has('demo') });
}

// Admin panel (admin.html) deep links, local only:
// ?open=careers[&realm=<id>[&enter=1]] opens the professions screen on a
// profession (or straight inside it); ?open=campus / ?open=guild open those.
if (isLocal) {
  const open = query.get('open');
  if (open === 'careers') {
    careerWorlds.open();
    const pick = document.querySelector(`#careerRealmGrid [data-realm="${query.get('realm') ?? ''}"]`);
    if (pick && careerWorldsRoot.dataset.picked !== pick.dataset.realm) pick.click();
    if (pick && query.get('enter') === '1') document.querySelector('#careerEnter')?.click();
  } else if (legacy && open === 'campus') campus.open();
  else if (legacy && open === 'guild') questGuild.open();
}
