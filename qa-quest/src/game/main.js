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
import { CAREER_REALMS, createCareerWorlds, foundationStatus, characterSheet } from './career-worlds.js?v=career-6';
import { createFirstShift } from './first-shift.js?v=first-shift-4';
import { createSorterBay } from './sorter-bay.js?v=sorter-1';
import { createContractBoard } from './contract-board.js?v=contracts-1';
import { createSystemSandbox } from './system-sandbox.js?v=sandbox-1';
import { createPythonContracts } from './python-contracts.js?v=python-contracts-1';
import { createEngineerCampus } from './engineer-campus.js?v=campus-6';
import {
  loadCampusProfile, saveCampusProfile, markContractSolved, markPythonContractSolved, markSandboxSolved, markModelDatasetSolved, markCampusMission, markFactoryTrialSolved, markSimnetIncidentSolved, markNexusResearch, markNexusMission, markNexusRemix, markNexusTrialSolved, markNexusCompanionLesson, markNexusCompanionBuild, markDeskIncidentSolved, markWorldStorySolved, markWorldShiftSolved, markCommonsBlueprint, markCommonsDay, markCommonsCode, markOperationsArc, markOperationsRollback, markOperationsShift, markOperationsCode, markChronicleArc, markChronicleWindow, markChronicleCode, markWeaveArc, markWeaveSeason, markWeaveCode, markThreadsEpisode, markThreadsCycle, markThreadsCode, markGuildQuest, markGuildJob, markGuildRaid, markGuildRealm, markLabComplete,
} from './campus-profile.js?v=campus-profile-7';
import { prepareMachinePython, runConditionalAutomation, runFunctionAutomation, runQueueAutomation, runWake } from './machine.js?v=7';
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
} from './model.js?v=game-100';
import { renderGame } from './render.js?v=game-02';
import { getWakeFailureGuidance } from './wake-help.js?v=2';
import { EXPLAIN_MODE_KEY, getAdaptiveCoach, getConceptBridge, getManualIncomeCopy, getSkillRecorderBeat, normalizeExplainMode } from './engagement-director.js?v=4';
import { createCheckpointPersistence, loadCheckpoint } from './save.js?v=2';
import { createTelemetry } from './telemetry.js';
import { CHECKPOINTS, CRATE_PAY, OTHER_MIND_AWAKE_HOLD_DURATION, REWARD_REVEAL_DURATION } from './config.js?v=game-162';
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
const checkpoint = (isLocal && CHECKPOINTS.includes(requestedCheckpoint)) || requestedCheckpoint === 'start'
  ? { checkpoint: requestedCheckpoint }
  : (showcaseChip ? { checkpoint: 'chip' } : (showcaseManual ? { checkpoint: 'warehouse' } : loadCheckpoint()));
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
let machineRunning = false;
let gameGeneration = 0;
let wakeAttempts = 0;
const input = createInput(canvas);
const companion = createCompanion(game, document.querySelector('#cursorCompanion'), hud.ending, prefersReducedMotion);
const audio = createAudioBus();
const firstShift = createFirstShift(document.querySelector('#firstShift'), {
  onSound: name => audio.play(name),
  onComplete: ({ delivered = 3, extra = 0 } = {}) => {
    state = createCheckpointState('chip');
    state = { ...state, warehouse: { ...state.warehouse, wage: Math.max(state.warehouse.wage, (delivered + extra) * CRATE_PAY) } };
    lastScene = state.scene;
    warehouseYaw = -1.0;
    started = true;
    lastTime = performance.now();
    startPanel.hidden = true;
    persistence.save(state);
    audio.setAmbient('warehouse');
    telemetry.mark('first-shift-chip-found');
  },
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
let wakeSyntaxRevealed = false;
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
const BLOCKING_OVERLAY_IDS = ['firstShift','careerWorlds','questGuild','friendSandbox','vikaMemory','virusFinale','automationFoundry','futureComic','sorterBay','engineerCampus','contractBoard','systemSandbox','pythonContracts','aiLab','modelWorkbench','neuralFoundry','llmWorkshop','retrievalWarehouse','botForge','automationLab','aiFactoryCapstone','simnetLab','factoryNexus','opsDesk','worldGrid','automationCommons','cityOperations','cityChronicle','cityWeave','cityThreads'];
function isBlockingOverlayOpen() {
  return BLOCKING_OVERLAY_IDS.some((id) => !document.querySelector(`#${id}`)?.hidden);
}
const FIRST_PERSON_SCENES = new Set(['warehouse','chip','machine','automation','red-crate','condition','queue','function']);
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
function faceTarget(target) { warehouseYaw = yawTo(target); }
function lookingAt(target, tolerance = .52) {
  return Boolean(target) && Math.abs(wrapAngle(yawTo(target) - warehouseYaw)) <= tolerance;
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
});
document.querySelector('#guildWorldsOpen').addEventListener('click', () => { careerReturnToGuild = true; questGuild.close(); careerWorlds.open(); });
document.querySelector('#careerDoor').addEventListener('click', () => { careerReturnToGuild = false; careerWorlds.open(); audio.play('ui-click'); });
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

function resetMachinePanel() {
  const conditionMode = state.scene === 'condition';
  const queueMode = state.scene === 'queue';
  const functionMode = state.scene === 'function';
  wakeSyntaxRevealed = false;
  hud.feedback.textContent = functionMode
    ? 'Две линии требуют одного поведения. Собери один route(batch) и подключи его к обеим.'
    : queueMode
      ? 'Ночью количество ящиков меняется. Нужен цикл, который проверяет очередь заново после каждого действия.'
      : conditionMode
        ? 'Красный груз остановил линию. Нужно правило: каждый ящик проверить до движения.'
        : 'Кнопка на полу щёлкает, но ни к чему не подключена. Терминал ждёт короткую команду.';
  hud.feedback.dataset.status = 'idle';
  hud.machineTitle.textContent = functionMode ? 'Маршрут двух линий' : (queueMode ? 'Ночная очередь · узел 07' : (conditionMode ? 'Сортировка · узел 07' : 'Терминал руки 07'));
  hud.machineBrief.textContent = functionMode
    ? 'Линии A и B делают одно и то же. Вместо двух копий правила опиши одно действие с именем.'
    : queueMode
      ? 'Ящики приезжают и уезжают, поэтому заранее неизвестно, сколько повторов понадобится.'
      : conditionMode
        ? 'Белый груз можно нести на палету. Красный должен остаться на линии.'
        : 'Вчера рука стартовала готовым сигналом с чипа. Сегодня сигнал придётся отправить через терминал.';
  hud.code.value = '';
  wakeAttempts = 0;
  document.querySelector('#signalBuilder').hidden = conditionMode || queueMode || functionMode;
  document.querySelector('#conditionBuilder').hidden = !conditionMode;
  document.querySelector('#queueBuilder').hidden = !queueMode;
  document.querySelector('#functionBuilder').hidden = !functionMode;
  document.querySelector('#machineClue').hidden = true;
  document.querySelector('.code-label').textContent = functionMode ? 'ТВОЙ МОДУЛЬ · PYTHON' : (queueMode ? 'ТВОЙ ЦИКЛ · PYTHON' : (conditionMode ? 'ТВОЁ ПРАВИЛО · PYTHON' : 'КОМАНДА ДЛЯ РУКИ · PYTHON'));
  hud.programViz.hidden = !(conditionMode || queueMode || functionMode);
  hud.codeReality.textContent = functionMode
    ? 'Одно поведение можно назвать и вызывать в разных местах.'
    : queueMode
      ? 'Цикл каждый раз заново спрашивает: в очереди ещё есть работа?'
      : conditionMode
        ? 'Сначала берём очередной ящик, затем решаем — двигать его или оставить.'
        : 'Смысл простой: отправить машине слово wake. Синтаксис можно подсмотреть, но набрать команду нужно самому.';
  updateProgramViz();
  if (functionMode) updateFunctionBuilder();
  else if (queueMode) updateQueueBuilder();
  else if (conditionMode) updateConditionBuilder();
  else updateSignalBuilder();
}

function updateSignalBuilder() {
  const source = hud.code.value.trim();
  const reveal = document.querySelector('#fragmentPrint');
  const legacyWake = document.querySelector('#fragmentWake');
  reveal.hidden = wakeSyntaxRevealed;
  legacyWake.hidden = true;
  reveal.innerHTML = '<strong>НЕ ЗНАЮ, КАК ЭТО ПИШЕТСЯ</strong><span>Показать пример · без автоподстановки</span>';
  document.querySelector('#signalPrompt').textContent = source
    ? 'Команда набрана. Запусти её и смотри на руку.'
    : (wakeSyntaxRevealed ? 'Пример открыт выше. Теперь набери строку сам.' : 'Нужно отправить руке одно короткое сообщение: wake.');
  hud.codeReality.textContent = source
    ? 'Терминал выполнит ровно то, что ты набрал. Ничего не подставляется автоматически.'
    : (wakeSyntaxRevealed
      ? 'print(...) означает «отправить сообщение». В кавычках — само сообщение.'
      : 'Сначала понятен смысл: сказать машине «wake». Название Python-команды можно подсмотреть отдельно.');
  if (!machineRunning) hud.run.disabled = !source;
}

document.querySelector('#fragmentPrint').addEventListener('click', () => {
  wakeSyntaxRevealed = true;
  const clue = document.querySelector('#machineClue');
  clue.hidden = false;
  clue.querySelector('span').textContent = 'ПРИМЕР ИЗ ИНСТРУКЦИИ';
  clue.querySelector('code').textContent = 'print("wake")';
  updateSignalBuilder();
  hud.code.focus({ preventScroll: true });
  audio.play('poster');
});
document.querySelector('#fragmentWake').addEventListener('click', () => {
  wakeSyntaxRevealed = true;
  updateSignalBuilder();
  hud.code.focus({ preventScroll: true });
});
hud.code.addEventListener('input', updateSignalBuilder);

const CONDITION_LINES = Object.freeze([
  'for box in boxes:',
  '    if box.kind != "red":',
  '        arm.move(box, pallet)',
]);

function updateConditionBuilder() {
  if (state.scene !== 'condition') return;
  const lines = hud.code.value.split('\n').filter((line) => line.trim().length);
  const next = Math.min(lines.length, CONDITION_LINES.length);
  for (const [id, index] of [['fragmentFor', 0], ['fragmentIf', 1], ['fragmentMove', 2]]) {
    const button = document.querySelector(`#${id}`);
    button.hidden = next !== index;
    button.disabled = next !== index;
  }
  document.querySelector('#conditionPrompt').textContent = next === 0
    ? '1. Сначала возьми каждый ящик по очереди.'
    : next === 1
      ? '2. Перед движением спроси: это НЕ красный?'
      : next === 2
        ? '3. Только внутри условия дай руке команду двигаться.'
        : 'Правило собрано. Запусти и смотри: белые поедут, красные останутся.';
  hud.codeReality.textContent = next === 0
    ? 'МИР: ящиков много → FOR: повтори один блок для каждого ящика.'
    : next === 1
      ? 'for box in boxes: → Python по очереди подставит каждый физический ящик в имя box.'
      : next === 2
        ? 'IF: следующий отступ выполнится только когда условие истинно. Красный получит False и остановится.'
        : 'arm.move(...) → один разрешённый Python-событием перенос → одно реальное движение руки. Код больше не абстракция.';
  if (!machineRunning) hud.run.disabled = next < CONDITION_LINES.length;
}

for (const [id, index] of [['fragmentFor', 0], ['fragmentIf', 1], ['fragmentMove', 2]]) {
  document.querySelector(`#${id}`).addEventListener('click', () => {
    const lines = hud.code.value.split('\n').filter((line) => line.trim().length);
    if (lines.length !== index) return;
    const clue = document.querySelector('#machineClue');
    clue.hidden = false;
    clue.querySelector('span').textContent = `ПРИМЕР СТРОКИ ${index + 1} · НАБЕРИ САМ`;
    clue.querySelector('code').textContent = CONDITION_LINES[index];
    hud.code.focus({ preventScroll: true });
    audio.play('poster');
  });
}
hud.code.addEventListener('input', () => {
  if (state.scene === 'condition') updateConditionBuilder();
  if (state.scene === 'queue') updateQueueBuilder();
  if (state.scene === 'function') updateFunctionBuilder();
  updateProgramViz();
});

const QUEUE_LINES = Object.freeze([
  'while queue:',
  '    box = queue.pop(0)',
  '    if box.kind != "red":',
  '        arm.move(box, pallet)',
]);

function updateQueueBuilder() {
  if (state.scene !== 'queue') return;
  const lines = hud.code.value.split('\n').filter((line) => line.trim().length);
  const next = Math.min(lines.length, QUEUE_LINES.length);
  for (const [id, index] of [['fragmentWhile', 0], ['fragmentPop', 1], ['fragmentQueueIf', 2], ['fragmentQueueMove', 3]]) {
    const button = document.querySelector(`#${id}`);
    button.hidden = next !== index;
    button.disabled = next !== index;
  }
  document.querySelector('#queuePrompt').textContent = next === 0
    ? '1. Никто не знает число ящиков заранее. Спроси: очередь ещё не пуста?'
    : next === 1
      ? '2. Возьми первый элемент. После pop(0) список физически станет короче.'
      : next === 2
        ? '3. Старое знание не исчезло: красный по-прежнему нельзя нести.'
        : next === 3
          ? '4. Разрешённый ящик отправь руке. Потом WHILE вернётся наверх.'
          : 'Ночная программа готова. Запусти её и смотри, как указатель съедает очередь слева направо.';
  hud.codeReality.textContent = next === 0
    ? 'МИР: работа может приезжать неизвестно сколько времени → WHILE: продолжай, пока условие истинно.'
    : next === 1
      ? 'queue — обычный список. pop(0) одновременно возвращает первый объект и удаляет его из очереди.'
      : next === 2
        ? 'Имя box теперь указывает на один конкретный объект. IF решает его судьбу.'
        : next === 3
          ? 'Внутренние отступы — это дерево решения: WHILE → IF → действие.'
          : 'Каждый круг меняет данные: очередь становится короче. Когда len(queue) == 0, WHILE сам останавливается.';
  if (!machineRunning) hud.run.disabled = next < QUEUE_LINES.length;
  updateProgramViz();
}

for (const [id, index] of [['fragmentWhile', 0], ['fragmentPop', 1], ['fragmentQueueIf', 2], ['fragmentQueueMove', 3]]) {
  document.querySelector(`#${id}`).addEventListener('click', () => {
    const lines = hud.code.value.split('\n').filter((line) => line.trim().length);
    if (lines.length !== index) return;
    const clue = document.querySelector('#machineClue');
    clue.hidden = false;
    clue.querySelector('span').textContent = `ПРИМЕР СТРОКИ ${index + 1} · НАБЕРИ САМ`;
    clue.querySelector('code').textContent = QUEUE_LINES[index];
    hud.code.focus({ preventScroll: true });
    audio.play('poster');
  });
}

const FUNCTION_LINES = Object.freeze([
  'def route(batch):',
  '    for box in batch:',
  '        if box.kind != "red":',
  '            arm.move(box, pallet)',
  'route(line_a)',
  'route(line_b)',
]);

function updateFunctionBuilder() {
  if (state.scene !== 'function') return;
  const lines = hud.code.value.split('\n').filter((line) => line.trim().length);
  const next = Math.min(lines.length, FUNCTION_LINES.length);
  for (const [id, index] of [['fragmentDef', 0], ['fragmentFuncFor', 1], ['fragmentFuncIf', 2], ['fragmentFuncMove', 3], ['fragmentCallA', 4], ['fragmentCallB', 5]]) {
    const button = document.querySelector(`#${id}`);
    button.hidden = next !== index;
    button.disabled = next !== index;
  }
  const prompts = [
    '1. Вытащи повторяющееся поведение в отдельный модуль и дай ему имя route.',
    '2. Внутри route обработай любую переданную партию batch.',
    '3. Сохрани проверку безопасности: красный нельзя отправлять дальше.',
    '4. Внутри IF оставь реальное действие руки.',
    '5. Подключи готовый модуль к линии A.',
    '6. Не копируй код. Вызови тот же route для линии B.',
    'Модуль готов: одна функция управляет двумя физическими потоками.',
  ];
  document.querySelector('#functionPrompt').textContent = prompts[next];
  const reality = [
    'МИР: один и тот же маршрут нужен в двух местах → DEF: дай поведению имя.',
    'batch — параметр. Сегодня это линия A, через секунду та же функция получит линию B.',
    'FOR и IF не исчезли. Функция просто собирает уже знакомые действия в переносимый блок.',
    'Отступы показывают вложенность: DEF → FOR → IF → ARM.MOVE.',
    'route(line_a) — подключение одного и того же навыка к первому физическому потоку.',
    'route(line_b) — тот же модуль без копирования. Исправишь route один раз — изменятся обе линии.',
    'Функция — это не новая магия, а имя для уже понятного поведения. Ты сделал из алгоритма деталь машины.',
  ];
  hud.codeReality.textContent = reality[next];
  if (!machineRunning) hud.run.disabled = next < FUNCTION_LINES.length;
  updateProgramViz();
}

for (const [id, index] of [['fragmentDef', 0], ['fragmentFuncFor', 1], ['fragmentFuncIf', 2], ['fragmentFuncMove', 3], ['fragmentCallA', 4], ['fragmentCallB', 5]]) {
  document.querySelector(`#${id}`).addEventListener('click', () => {
    const lines = hud.code.value.split('\n').filter((line) => line.trim().length);
    if (lines.length !== index) return;
    const clue = document.querySelector('#machineClue');
    clue.hidden = false;
    clue.querySelector('span').textContent = `ПРИМЕР СТРОКИ ${index + 1} · НАБЕРИ САМ`;
    clue.querySelector('code').textContent = FUNCTION_LINES[index];
    hud.code.focus({ preventScroll: true });
    audio.play('poster');
  });
}

function updateProgramViz() {
  if (!hud.programViz || hud.programViz.hidden) return;
  const crates = state.warehouse.crates.filter((crate) => crate.status !== 'hidden');
  const isFunction = state.scene === 'function' || state.arm.startSource === 'function';
  const trace = isFunction
    ? (Array.isArray(state.learning.functionTrace) ? state.learning.functionTrace : [])
    : (Array.isArray(state.learning.queueTrace) ? state.learning.queueTrace : []);
  const traceIndex = trace.length ? Math.min(trace.length - 1, Math.max(0, Math.floor(state.sceneTime / .7))) : -1;
  const traceEntry = traceIndex >= 0 ? trace[traceIndex] : null;
  const activeId = traceEntry?.boxId ?? state.arm.active?.boxId ?? null;
  const delivered = new Set(state.warehouse.crates.filter((crate) => crate.status === 'pallet').map((crate) => crate.id));
  hud.programVizCells.replaceChildren(...crates.map((crate, index) => {
    const cell = document.createElement('span');
    cell.className = 'program-viz__cell';
    cell.dataset.kind = crate.kind;
    cell.dataset.index = String(index);
    cell.dataset.active = String(crate.id === activeId);
    cell.dataset.done = String(delivered.has(crate.id));
    cell.textContent = crate.kind === 'red' ? 'КРАСН.' : String(index);
    cell.title = `${crate.id} · ${crate.kind}`;
    return cell;
  }));
  const source = hud.code.value;
  const isQueue = state.scene === 'queue' || state.arm.startSource === 'queue';
  hud.programVizLoop.textContent = isFunction ? 'ФУНКЦИЯ' : (isQueue ? 'ПОКА ЕСТЬ' : 'ДЛЯ КАЖДОГО');
  hud.programVizLoop.dataset.hot = String(isFunction ? /def\s+route/.test(source) : (isQueue ? /while\s+queue/.test(source) : /for\s+box/.test(source)));
  hud.programVizGate.dataset.hot = String(/if\s+/.test(source));
  hud.programVizAction.dataset.hot = String(/arm\.move/.test(source));
  hud.programVizStep.textContent = traceEntry
    ? `${traceIndex + 1}/${trace.length} · ${traceEntry.kind === 'red' ? 'красный' : 'обычный'} → ${traceEntry.decision === 'move' ? 'нести' : 'оставить'}`
    : (isQueue ? `len(queue) = ${crates.filter((crate) => !delivered.has(crate.id)).length}` : `${crates.length} объектов`);
  hud.programVizGate.dataset.state = traceEntry ? (traceEntry.decision === 'move' ? 'pass' : 'block') : '';
}

function openMachinePanel() {
  if (document.pointerLockElement === canvas) document.exitPointerLock?.();
  machineOpen = true;
  prepareMachinePython();
  requestAnimationFrame(() => {
    if (!machineOpen) return;
    if (window.matchMedia('(pointer: coarse), (max-width: 760px), (max-height: 500px)').matches && !hud.code.value) {
      const firstFragment = state.scene === 'function' ? '#fragmentDef' : (state.scene === 'queue' ? '#fragmentWhile' : (state.scene === 'condition' ? '#fragmentFor' : '#fragmentPrint'));
      document.querySelector(firstFragment).focus({ preventScroll: true });
    } else hud.code.focus();
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
  const target = getInteractionTarget(state);
  if (!action) return;
  if (firstPersonScene() && target && action.type === target.type && !lookingAt(target)) return;
  recordFirstAction();
  if (action.type === 'open-machine') {
    openMachinePanel();
    return;
  }
  if (action.type === 'press-loose-button') {
    state = applyGameAction(state, action);
    audio.play('blocked');
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
    audio.play('blocked');
    if (state.scene === 'condition') {
      resetMachinePanel();
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
  if (!['machine', 'condition', 'queue', 'function'].includes(state.scene)) return;
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
    return;
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
  const inWarehouse = ['warehouse', 'chip', 'machine', 'automation', 'red-crate', 'condition', 'queue', 'function', 'reward'].includes(state.scene);
  const powers = document.querySelectorAll('.power');
  powers.forEach((button) => { button.disabled = !state.powers[button.id.replace('power', '').toLowerCase()]; });
  const target = getInteractionTarget(state);
  const transform = getViewportTransform({ width: canvas.clientWidth, height: canvas.clientHeight }, getSceneCameraTarget(state));
  const fpTargetReady = firstPersonScene() && target && nearby?.type === target.type && lookingAt(target);
  hud.action.style.display = (!machineOpen && !storyActive && target && (firstPersonScene() ? fpTargetReady : true)) ? 'flex' : 'none';
  hud.chip.hidden = true;
  hud.action.querySelector('.action-button__key').hidden = narrowViewport.matches;
  if (target) {
    if (firstPersonScene()) {
      hud.action.style.left = '50%';
      hud.action.style.top = '';
      hud.action.dataset.direction = 'here';
      hud.action.dataset.walking = 'false';
      hud.action.querySelector('b').textContent = target.label.toUpperCase();
      hud.action.querySelector('.action-button__key').textContent = fpTargetReady ? 'E / ПРОБЕЛ' : '';
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
  wallet.hidden = !started || ['prologue', 'collapse'].includes(state.scene) || machineOpen;
  document.querySelector('#walletTotal').textContent = `${state.warehouse.wage.toLocaleString('ru-RU')} ₽`;
  document.querySelector('#walletMode').textContent = state.arm.awake ? `РУКА ЗАРАБОТАЛА ${(state.warehouse.autoDelivered * CRATE_PAY).toLocaleString('ru-RU')} ₽` : `+${CRATE_PAY} ₽ за каждый ящик`;
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
      : state.learning.chapter >= 4 ? 'СМЕНА 4 · ДВЕ ЛИНИИ'
      : state.learning.chapter >= 3 ? 'НОЧНАЯ СМЕНА · СКЛАД 07'
      : state.learning.chapter >= 2 ? 'СМЕНА 2 · СКЛАД 07' : 'СМЕНА 1 · СКЛАД 07';
    if (state.scene === 'chip') {
      hud.mission.textContent = state.arm.chip === 'inserting' ? 'Чип защёлкивается в разъёме' : 'В руках — сервисный чип ARM 07';
      hud.message.textContent = state.arm.chip === 'inserting' ? 'СЛЫШЕН ЩЕЛЧОК · РУКА ПОЛУЧАЕТ ПИТАНИЕ' : 'ПОДОЙДИ К РУКЕ · НАЙДИ ПУСТОЙ РАЗЪЁМ';
    } else if (state.scene === 'machine') {
      const looseTried = Boolean(state.warehouse.looseButtonTried);
      hud.mission.textContent = looseTried ? 'Щёлк. Ничего.' : 'На полу лежит зелёная кнопка';
      hud.message.textContent = machineOpen
        ? 'НАБЕРИ КОМАНДУ САМ · ПРИМЕР МОЖНО ТОЛЬКО ПОДСМОТРЕТЬ'
        : (looseTried ? 'КНОПКА НИ К ЧЕМУ НЕ ПОДКЛЮЧЕНА · ОСМОТРИ ТЕРМИНАЛ' : 'ПОДОЙДИ · ПОПРОБУЙ НАЖАТЬ');
    } else if (state.scene === 'condition') {
      hud.mission.textContent = 'Красный груз остановил линию';
      hud.message.textContent = machineOpen ? 'СНАЧАЛА СМЫСЛ: КРАСНЫЙ ОСТАВИТЬ · ОСТАЛЬНЫЕ НЕСТИ' : 'ОСМОТРИ ГРУЗ · ЗАТЕМ ВЕРНИСЬ К ТЕРМИНАЛУ';
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
        reward2: ['Два правила стали системой', 'Q‑BOT 0.1 ЗАПОМНИЛ: СКАЗАТЬ → ПРОВЕРИТЬ → СДЕЛАТЬ'],
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
      hud.message.textContent = state.player.carrying ? 'ЯЩИК В РУКАХ · ДОЙДИ ДО ПАЛЕТЫ · E / ПРОБЕЛ' : `ДОСТАВЛЕНО ${state.warehouse.manualDelivered}/3 · ПОДОЙДИ К ЯЩИКУ · E / ПРОБЕЛ`;
    }
    const completed = state.warehouse.manualDelivered + state.warehouse.autoDelivered;
    hud.progress.style.width = `${Math.min(100, (completed / 9) * 100)}%`;
    hud.system.textContent = state.arm.blocked ? 'БЛОК' : (state.arm.awake ? 'АВТО' : (['machine', 'condition', 'queue', 'function'].includes(state.scene) ? 'ДОСТУП' : 'ОТКЛЮЧЕНА'));
    hud.sector.textContent = 'СКЛАД-07';
    hud.targets.textContent = state.arm.awake ? `${state.warehouse.autoDelivered}/${state.warehouse.autoTarget ?? 6}` : `${state.warehouse.manualDelivered}/3`;
  }

  hud.machine.hidden = !machineOpen;
  hud.ending.hidden = state.scene !== 'reward' || state.sceneTime < REWARD_REVEAL_DURATION || storyActive || isBlockingOverlayOpen();
  const sorterBonus = document.querySelector('#sorterBonus');
  const sorterUnlocked = ['reward2','reward3','reward4'].includes(state.checkpoint);
  sorterBonus.hidden = !sorterUnlocked;
  if (sorterUnlocked) sorterBonus.textContent = state.checkpoint === 'reward2'
    ? 'БОНУС · SORTER BAY · ПОИГРАТЬ С IF →'
    : state.checkpoint === 'reward3'
      ? 'БОНУС · SORTER BAY · ДВА ПРИЗНАКА →'
      : 'БОНУС · SORTER BAY · AND / OR / NOT →';
  const hasSkill = state.learning.printUnlocked || state.learning.forUnlocked || state.learning.ifUnlocked || state.learning.listUnlocked || state.learning.whileUnlocked || state.learning.funcUnlocked || state.learning.dictUnlocked || state.learning.reliabilityUnlocked || state.learning.asyncUnlocked || state.learning.aiUnlocked || state.learning.llmUnlocked || state.learning.botUnlocked;
  document.querySelector('#journalToggle').hidden = !hasSkill || machineOpen || storyActive || isBlockingOverlayOpen();
  const careerDoor = document.querySelector('#careerDoor');
  // 16.6: the door opens as soon as the chip wakes the arm (and stays from
  // chapter 2 / the first print on), not after chapter 8.
  const careerVisible = Boolean(state.arm?.awake || state.learning.printUnlocked || state.learning.chapter >= 2);
  careerDoor.hidden = !careerVisible || machineOpen || storyActive || isBlockingOverlayOpen();
  if (careerVisible) {
    const gates = ['vehicle','automation','security','web','ai','systems','lowlevel'];
    const unlocked = gates.filter(id => foundationStatus(state.learning, CAREER_REALMS.find(realm => realm.id === id)).ok).length;
    // 16.9.3: the door doubles as the always-visible character line.
    const me = characterSheet(campusProfile, state.learning, state.warehouse?.wage ?? 0);
    const line = `${me.rank} · ${me.money.toLocaleString('ru-RU')} ₽ · ${unlocked}/7 ОТКРЫТО`;
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
    hud.endingEyebrow.textContent = 'QUEQUEST 2.0 · АГЕНТНЫЙ ЦЕХ';
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
    hud.endingCopy.textContent = 'Финал не про HP: восстанови неверный тип, пропуск, таймаут и нарушенный порядок. Это локальные синтетические тесты, не реальные атаки.';
    document.querySelector('#continueGame').textContent = 'ВЕРНУТЬСЯ К СБОЮ →';
  } else if (state.checkpoint === 'reward6') {
    hud.endingEyebrow.textContent = 'ШЕСТОЙ КОНТУР · ПАМЯТЬ';
    hud.endingTitle.textContent = 'Одинаковый вход больше не означает одинаковое решение.';
    hud.endingCopy.textContent = 'Ты трижды увидел один и тот же сигнал. Решение менялось только потому, что система сохраняла seen и trusted. После победы физическая панель памяти раскрылась как DICT / STATE.';
    document.querySelector('#continueGame').textContent = 'ПОСМОТРЕТЬ, ЧТО ДАЛЬШЕ →';
  } else if (state.checkpoint === 'vika') {
    hud.endingEyebrow.textContent = 'ШЕСТАЯ ГЛАВА · ВИКА';
    hud.endingTitle.textContent = 'Одинаковый сигнал уже ждёт.';
    hud.endingCopy.textContent = 'Смотри на сохранённое состояние, а не на форму входа. Канон Вики здесь не расширяется: синее парящее лицо без тела и одна подтверждённая фраза.';
    document.querySelector('#continueGame').textContent = 'ВЕРНУТЬСЯ К ПАМЯТИ →';
  } else if (state.checkpoint === 'reward5') {
    hud.endingEyebrow.textContent = 'ПЯТЫЙ КОНТУР · КОМАНДА';
    hud.endingTitle.textContent = 'Ты связал события с устойчивыми приёмами.';
    hud.endingCopy.textContent = 'Шесть игровых событий пришли как входной поток. Q-Bot держал указатель event, а ты выбирал одну из трёх AI-ролей. После победы тот же приём раскрылся как знакомая связка FOR → DEF → IF.';
    document.querySelector('#continueGame').textContent = 'ПОСМОТРЕТЬ, ЧТО ДАЛЬШЕ →';
  } else if (state.checkpoint === 'friends') {
    hud.endingEyebrow.textContent = 'ПЯТАЯ ГЛАВА · ТРЕНИРОВОЧНАЯ ЗАЩИТА';
    hud.endingTitle.textContent = 'Друзья ждут тебя в контуре.';
    hud.endingCopy.textContent = 'Матч изолирован от настоящих сетей: шесть вымышленных импульсов, три временные AI-роли и знакомый Q-Bot.';
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
    hud.endingCopy.textContent = 'Ты дал ей два понятных правила: пройти по каждому ящику и двигать только подходящий. В Python эти две идеи называются for и if. На ночной смене появится новая проблема: заранее неизвестно, сколько работы приедет.';
    document.querySelector('#continueGame').textContent = 'ЗАКОНЧИТЬ СМЕНУ →';
  } else {
    hud.endingEyebrow.textContent = 'КАССА · КОНЕЦ СМЕНЫ';
    hud.endingTitle.textContent = 'Рука дотащила остаток участка.';
    hud.endingCopy.textContent = `За смену вышло ${state.warehouse.wage.toLocaleString('ru-RU')} ₽. Три ящика ты унёс сам. Остальное — машина. Завтра снова в 07:00.`;
    document.querySelector('#continueGame').textContent = 'ПОЛУЧИТЬ ДЕНЬГИ · ДОМОЙ →';
  }
  hud.printSkillMethod.textContent = codeInputMethod === 'pasted'
    ? 'СПОСОБ: ВСТАВЛЕНО С КЛАВИАТУРЫ'
    : 'СПОСОБ: НАБРАНО РУКАМИ';
  updateProgramViz();
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
  state = stepGame(state, movement, (now - lastTime) / 1000, { paused: !started || machineOpen || storyActive || exitOpen || isBlockingOverlayOpen() });
  lastTime = now;
  if (state.scene !== lastScene) {
    if (!showcaseChip && ['warehouse', 'chip', 'machine', 'red-crate', 'reward', 'shift2', 'red2', 'condition', 'reward2', 'queue', 'reward3', 'function', 'reward4'].includes(state.checkpoint)) persistence.save(state);
    lastScene = state.scene;
    if (['machine', 'condition', 'queue', 'function'].includes(state.scene)) {
      resetMachinePanel();
      prepareMachinePython();
      const nextTarget = getInteractionTarget(state);
      if (nextTarget) faceTarget(nextTarget);
      audio.play('poster');
    } else if (state.scene === 'chip') {
      const nextTarget = getInteractionTarget(state);
      if (nextTarget) faceTarget(nextTarget);
    }
    if (state.scene === 'warehouse') {
      warehouseCueStage = 0;
    }
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
  companion.update(state.scene === 'reward' && !storyActive && !exitOpen && !isBlockingOverlayOpen(), now);
  const wakeProgress = state.otherMind.phase === 'waking' && otherMindWakingAt !== null
    ? Math.min(1, Math.max(0, (now - otherMindWakingAt) / 1200))
    : (state.otherMind.phase === 'awake' ? 1 : 0);
  // 16.8: the professions screen covers the whole game and plays its own
  // live scenes; don't also redraw the warehouse underneath it.
  if (careerWorldsRoot.hidden) renderGame(
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

document.querySelector('#restartGame').addEventListener('click', () => {
  const progressed = state.checkpoint !== 'start';
  if (progressed && !window.confirm('Начать заново? Текущий прогресс этой игры исчезнет.')) return;
  persistence.reset();
  engagementProgressAt = performance.now();
  engagementProgressKey = '';
  gameGeneration += 1;
  machineRunning = false;
  state = createGameState({ scene: 'warehouse', checkpoint: 'start' });
  started = false;
  walkingTarget = null;
  storyActive = false;
  storyCallback = null;
  friendVisited = false;
  journalOpen = false;
  document.querySelector('#storyBeat').hidden = true;
  comic.reset();
  friendSandbox.reset();
  vikaMemory.reset();
  virusFinale.reset();
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
  // 16.2: chip interaction happens in the world with WASD + E/Space.
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
  const conditionMode = state.scene === 'condition';
  const queueMode = state.scene === 'queue';
  const functionMode = state.scene === 'function';
  const queuedCrates = state.warehouse.crates.filter((crate) => crate.status === 'queued');
  const result = functionMode
    ? await runFunctionAutomation(source, queuedCrates)
    : queueMode
    ? await runQueueAutomation(source, queuedCrates)
    : conditionMode
      ? await runConditionalAutomation(source, queuedCrates)
      : await runWake(source);
  if (runGeneration !== gameGeneration) return;
  telemetry.mark(functionMode ? 'python-function-ui-ms' : (queueMode ? 'python-while-ui-ms' : (conditionMode ? 'python-if-ui-ms' : 'python-wake-ui-ms')), Math.round(performance.now() - runStarted));
  telemetry.mark('python-exec-ms', result.ms);
  if (!result.ok) {
    wakeAttempts += 1;
    if (conditionMode || queueMode || functionMode) {
      const errorText = result.error?.text || result.checks?.find((check) => !check.ok)?.detail;
      const fallback = functionMode
        ? 'Модуль пока не управляет обеими линиями.'
        : (queueMode ? 'Цикл пока не обработал всю очередь.' : 'Правило пока не отделяет красный груз от обычного.');
      hud.feedback.textContent = formatPythonFailure({
        errorText,
        errorHint: result.error?.hint,
        fallback,
        mode: explainMode,
      });
    } else {
      const guidance = getWakeFailureGuidance(wakeAttempts, result, source);
      hud.feedback.textContent = guidance.message;
      if (guidance.prefill !== null) {
        hud.code.value = guidance.prefill;
        hud.code.setSelectionRange(hud.code.value.length, hud.code.value.length);
      }
    }
    hud.code.focus();
    hud.feedback.dataset.status = 'error';
    if (!conditionMode && !queueMode && !functionMode) {
      document.querySelector('#signalPrompt').textContent = 'Команда не сработала. Сверь её с примером и набери заново.';
      document.querySelector('#fragmentPrint').hidden = false;
    }
  } else {
    state = functionMode
      ? applyGameAction(state, { type: 'function-command-accepted', events: result.events, trace: result.trace })
      : queueMode
      ? applyGameAction(state, { type: 'queue-command-accepted', events: result.events, trace: result.trace })
      : conditionMode
        ? applyGameAction(state, { type: 'condition-command-accepted', events: result.events })
        : applyGameAction(state, { type: 'first-command-accepted' });
    automationAcceptedAt = performance.now();
    persistence.save(state);
    audio.play('power');
    hud.feedback.textContent = functionMode
      ? 'МОДУЛЬ ПРИНЯТ · ОДИН МАРШРУТ ПОДКЛЮЧЁН К ДВУМ ЛИНИЯМ'
      : queueMode
      ? 'ПРАВИЛО ПРИНЯТО · РУКА БУДЕТ РАБОТАТЬ, ПОКА ЕСТЬ ГРУЗ'
      : conditionMode
        ? 'ПРАВИЛО ПРИНЯТО · ОБЫЧНЫЙ ГРУЗ ЕДЕТ · КРАСНЫЙ ОСТАЁТСЯ'
        : 'КОМАНДА ПРИНЯТА · РУКА 07 ПРОСНУЛАСЬ · МАРШРУТ ЗАПУЩЕН';
    hud.feedback.dataset.status = 'success';
    machineOpen = false;
    if (!conditionMode && !queueMode && !functionMode) {
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
    }
    machineOpen = false;
  }
  machineRunning = false;
  hud.run.disabled = false;
  hud.run.innerHTML = functionMode ? '<span>▶</span> ПОДКЛЮЧИТЬ ROUTE()' : (queueMode ? '<span>▶</span> ЗАПУСТИТЬ НОЧНУЮ СМЕНУ' : (conditionMode ? '<span>▶</span> ПРОВЕРИТЬ ПРАВИЛО' : '<span>▶</span> РАЗБУДИТЬ РУКУ'));
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
      'ДОМА · 22:16',
      'Сегодня машина таскала вместо тебя.',
      'В кармане деньги за смену. В голове — один вопрос: что именно было на том сервисном чипе, если железная рука вдруг поняла, куда нести ящики?',
      'СПАТЬ →',
      () => {
        tellStory(
          'УТРО · СМЕНА 2 · 07:02',
          'Тот же склад. У руки что-то изменилось.',
          'Вчера здесь была зелёная кнопка запуска. Сегодня на панели — пустое отверстие, а сама кнопка валяется на полу.',
          'ВОЙТИ В СКЛАД →',
          () => {
            state = applyGameAction(state, { type: 'start-second-shift' });
            lastAutoDelivered = 0;
            resetMachinePanel();
            prepareMachinePython();
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
      'ТРЕТЬЯ СМЕНА · 23:47',
      'Ты уходишь. Q-Bot остаётся.',
      'Днём ящики были заранее разложены перед тобой. Ночью поток живёт сам: новые грузы приходят, старые уезжают. Машина должна каждый раз проверять, осталась ли работа, и продолжать до пустой линии.',
      'ОТКРЫТЬ НОЧНУЮ ОЧЕРЕДЬ →',
      () => {
        state = applyGameAction(state, { type: 'start-third-shift' });
        lastAutoDelivered = 0;
        resetMachinePanel();
        prepareMachinePython();
        const terminal = getInteractionTarget(state);
        if (terminal) faceTarget(terminal);
        persistence.save(state);
      },
    );
    return;
  }
  if (state.checkpoint === 'reward3') {
    tellStory(
      'ЧЕТВЁРТАЯ СМЕНА · 08:03',
      'На складе включили вторую линию.',
      'Начальник скопировал вчерашнее правило во второй терминал. Теперь одно и то же поведение существует в двух местах. Исправишь одно — второе останется старым. Значит, маршрут пора собрать в один именованный навык.',
      'СОБРАТЬ МОДУЛЬ ROUTE() →',
      () => {
        state = applyGameAction(state, { type: 'start-fourth-shift' });
        lastAutoDelivered = 0;
        resetMachinePanel();
        prepareMachinePython();
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
  if (!friendVisited) {
    friendVisited = true;
    tellStory('ДОМА · СООБЩЕНИЕ ОТ ДРУГА', 'Ты освободил себе вечер.', '«Ты оживил ту руку? Тогда заходи в наш тренировочный контур. Нас трое, Q-Bot будет четвёртым. Шесть импульсов уже летят — распределишь защиту?» Это только игровая копия: никаких настоящих аккаунтов или сетей.', 'ВОЙТИ В ТРЕНИРОВОЧНЫЙ КОНТУР →', () => friendSandbox.open());
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
});
resizeCanvas();
if (['machine', 'condition', 'queue', 'function'].includes(state.scene)) {
  resetMachinePanel();
  prepareMachinePython();
}
if (state.checkpoint === 'ai-lab') aiLab.open({ resume: true });
else if (state.checkpoint === 'llm-lab') llmWorkshop.open({ resume: true });
else if (['campus', 'reward9', 'reward10'].includes(state.checkpoint)) campus.open();
updateHud();
requestAnimationFrame(frame);

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
  } else if (open === 'campus') campus.open();
  else if (open === 'guild') questGuild.open();
}
