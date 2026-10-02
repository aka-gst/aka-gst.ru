export const CAMPUS_PROFILE_VERSION = 15;
export const CAMPUS_PROFILE_KEY = 'quequest.campus.v15';
export const LEGACY_CAMPUS_PROFILE_KEYS = Object.freeze(['quequest.campus.v14','quequest.campus.v13','quequest.campus.v12','quequest.campus.v11','quequest.campus.v10','quequest.campus.v9','quequest.campus.v8','quequest.campus.v7','quequest.campus.v6','quequest.campus.v5','quequest.campus.v4','quequest.campus.v3','quequest.campus.v2','quequest.campus.v1']);

export const RANKS = Object.freeze([
  { xp: 0, name: 'СБОРЩИК' },
  { xp: 120, name: 'ОПЕРАТОР' },
  { xp: 320, name: 'АВТОМАТИЗАТОР' },
  { xp: 650, name: 'ИНЖЕНЕР' },
  { xp: 1050, name: 'АРХИТЕКТОР' },
  { xp: 1600, name: 'AI-МЕХАНИК' },
  { xp: 2300, name: 'СИСТЕМНЫЙ МАСТЕР' },
  { xp: 3200, name: 'BOT-АРХИТЕКТОР' },
  { xp: 4500, name: 'AI FACTORY MASTER' },
  { xp: 6200, name: 'INTEGRATION ARCHITECT' },
  { xp: 8200, name: 'SYSTEM OPERATOR' },
  { xp: 10500, name: 'FACTORY ARCHITECT' },
  { xp: 14000, name: 'AUTONOMOUS SYSTEMS' },
  { xp: 18000, name: 'WORLD ARCHITECT' },
  { xp: 24000, name: 'AUTOMATION ARCHITECT' },
  { xp: 31000, name: 'RELEASE ARCHITECT' },
  { xp: 39000, name: 'SYSTEM STEWARD' },
  { xp: 48000, name: 'CIVIC ARCHITECT' },
  { xp: 59000, name: 'LIVING SYSTEMS ARCHITECT' },
  { xp: 72000, name: 'GUILD ARCHITECT' },
  { xp: 86000, name: 'CAREER ARCHITECT' },
]);

export function createCampusProfile(overrides = {}) {
  const base = {
    version: CAMPUS_PROFILE_VERSION,
    xp: 0,
    legacyXp: 0,
    awards: {},
    completedContracts: [],
    contractBest: {},
    labs: {
      ai: { completed: false, bestAccuracy: 0, feedbackRounds: 0 },
      model: { completedDatasets: [], bestAccuracy: 0, epochs: 0 },
      neural: { completed: false, bestAccuracy: 0, bestLoss: 999, epochs: 0 },
      llm: { completed: false, missions: 0 },
      retrieval: { completed: false, completedMissions: [], bestRecall: 0 },
      bot: { completed: false, completedMissions: [], feedbackRounds: 0 },
      automation: { completed: false, completedMissions: [], safeRuns: 0 },
      factory: { completed: false, bestScore: 0, bestCost: 999, trialSeeds: [], bestTrialScore: 0 },
      simnet: { completed: false, completedMissions: [], incidentSeeds: [], bestIncidentScore: 0 },
      desk: { completed: false, completedMissions: [], incidentSeeds: [], bestScore: 0, bestIncidentScore: 0 },
      world: { completed: false, completedStories: [], shiftSeeds: [], directPatchSeeds: [], blackBoxSeeds: [], masteredPatterns: [], discoveredNodes: [], playbooks: [], bestScore: 0 },
      commons: { completed: false, completedBriefs: [], daySeeds: [], codeDeployed: false, blueprints: [], bestScore: 0, bestEfficiency: 0 },
      operations: { completed: false, completedArcs: [], shiftSeeds: [], acceptedPatches: [], rollbackArcs: [], codeDeployed: false, bestTrust: 0, bestScore: 0 },
      chronicle: { completed: false, completedArcs: [], windowSeeds: [], decisions: [], postmortems: [], codeDeployed: false, bestDebt: 999, bestScore: 0 },
      weave: { completed: false, completedArcs: [], seasonSeeds: [], decisions: [], codeDeployed: false, bestBalance: 0, bestScore: 0 },
      threads: { completed: false, completedEpisodes: [], cycleSeeds: [], decisions: [], unlockedDistricts: ['core'], echoes: [], codeDeployed: false, qbotBond: 0, bestContinuity: 0, bestScore: 0 },
      guild: { completed: false, completedQuests: [], questChoices: [], jobSeeds: [], completedRaids: [], realmRuns: [], realmWins: [], realmBest: {}, skillLedger: {}, creditLedger: {}, bestRaidScore: 0 },
      nexus: { completed: false, research: [], completedMissions: [], remixMissions: [], trialSeeds: [], bestScore: 0, companionLessons: [], companionBuilds: [], blueprintLibrary: [] },
      python: { completed: [], bestChecks: {} },
    },
    sandbox: { solvedSeeds: [], bestScore: 0 },
    stats: {
      contractsSolved: 0,
      labsCompleted: 0,
      codeRuns: 0,
    },
  };
  const labs = overrides.labs ?? {};
  const awards = { ...(overrides.awards ?? {}) };
  const hasLedger = overrides.awards && typeof overrides.awards === 'object';
  const legacyXp = Math.max(0, Number(overrides.legacyXp ?? (hasLedger ? 0 : overrides.xp ?? 0)) || 0);
  const ledgerXp = Object.values(awards).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
  return {
    ...base,
    ...overrides,
    version: CAMPUS_PROFILE_VERSION,
    legacyXp,
    awards,
    xp: legacyXp + ledgerXp,
    completedContracts: [...new Set(Array.isArray(overrides.completedContracts) ? overrides.completedContracts : [])],
    contractBest: { ...base.contractBest, ...(overrides.contractBest ?? {}) },
    labs: {
      ai: { ...base.labs.ai, ...(labs.ai ?? {}) },
      model: {
        ...base.labs.model,
        ...(labs.model ?? {}),
        completedDatasets: [...new Set(Array.isArray(labs.model?.completedDatasets) ? labs.model.completedDatasets : [])],
      },
      neural: { ...base.labs.neural, ...(labs.neural ?? {}) },
      llm: { ...base.labs.llm, ...(labs.llm ?? {}) },
      retrieval: { ...base.labs.retrieval, ...(labs.retrieval ?? {}), completedMissions: [...new Set(Array.isArray(labs.retrieval?.completedMissions) ? labs.retrieval.completedMissions : [])] },
      bot: { ...base.labs.bot, ...(labs.bot ?? {}), completedMissions: [...new Set(Array.isArray(labs.bot?.completedMissions) ? labs.bot.completedMissions : [])] },
      automation: { ...base.labs.automation, ...(labs.automation ?? {}), completedMissions: [...new Set(Array.isArray(labs.automation?.completedMissions) ? labs.automation.completedMissions : [])] },
      factory: { ...base.labs.factory, ...(labs.factory ?? {}), trialSeeds: [...new Set(Array.isArray(labs.factory?.trialSeeds) ? labs.factory.trialSeeds : [])].slice(-100) },
      simnet: { ...base.labs.simnet, ...(labs.simnet ?? {}), completedMissions: [...new Set(Array.isArray(labs.simnet?.completedMissions) ? labs.simnet.completedMissions : [])], incidentSeeds: [...new Set(Array.isArray(labs.simnet?.incidentSeeds) ? labs.simnet.incidentSeeds : [])].slice(-100) },
      desk: { ...base.labs.desk, ...(labs.desk ?? {}), completedMissions: [...new Set(Array.isArray(labs.desk?.completedMissions) ? labs.desk.completedMissions : [])], incidentSeeds: [...new Set(Array.isArray(labs.desk?.incidentSeeds) ? labs.desk.incidentSeeds : [])].slice(-200) },
      world: {
        ...base.labs.world, ...(labs.world ?? {}),
        completedStories: [...new Set(Array.isArray(labs.world?.completedStories) ? labs.world.completedStories : [])],
        shiftSeeds: [...new Set(Array.isArray(labs.world?.shiftSeeds) ? labs.world.shiftSeeds : [])].slice(-300),
        directPatchSeeds: [...new Set(Array.isArray(labs.world?.directPatchSeeds) ? labs.world.directPatchSeeds : [])].slice(-300),
        blackBoxSeeds: [...new Set(Array.isArray(labs.world?.blackBoxSeeds) ? labs.world.blackBoxSeeds : [])].slice(-300),
        masteredPatterns: [...new Set(Array.isArray(labs.world?.masteredPatterns) ? labs.world.masteredPatterns : [])],
        discoveredNodes: [...new Set(Array.isArray(labs.world?.discoveredNodes) ? labs.world.discoveredNodes : [])],
        playbooks: [...new Set(Array.isArray(labs.world?.playbooks) ? labs.world.playbooks : [])].slice(-100),
      },
      commons: {
        ...base.labs.commons, ...(labs.commons ?? {}),
        completedBriefs: [...new Set(Array.isArray(labs.commons?.completedBriefs) ? labs.commons.completedBriefs : [])],
        daySeeds: [...new Set(Array.isArray(labs.commons?.daySeeds) ? labs.commons.daySeeds : [])].slice(-300),
        blueprints: [...new Set(Array.isArray(labs.commons?.blueprints) ? labs.commons.blueprints : [])].slice(-100),
      },
      operations: {
        ...base.labs.operations, ...(labs.operations ?? {}),
        completedArcs: [...new Set(Array.isArray(labs.operations?.completedArcs) ? labs.operations.completedArcs : [])],
        shiftSeeds: [...new Set(Array.isArray(labs.operations?.shiftSeeds) ? labs.operations.shiftSeeds : [])].slice(-300),
        acceptedPatches: [...new Set(Array.isArray(labs.operations?.acceptedPatches) ? labs.operations.acceptedPatches : [])].slice(-100),
        rollbackArcs: [...new Set(Array.isArray(labs.operations?.rollbackArcs) ? labs.operations.rollbackArcs : [])].slice(-100),
      },
      chronicle: {
        ...base.labs.chronicle, ...(labs.chronicle ?? {}),
        completedArcs: [...new Set(Array.isArray(labs.chronicle?.completedArcs) ? labs.chronicle.completedArcs : [])],
        windowSeeds: [...new Set(Array.isArray(labs.chronicle?.windowSeeds) ? labs.chronicle.windowSeeds : [])].slice(-300),
        decisions: [...new Set(Array.isArray(labs.chronicle?.decisions) ? labs.chronicle.decisions : [])].slice(-100),
        postmortems: [...new Set(Array.isArray(labs.chronicle?.postmortems) ? labs.chronicle.postmortems : [])].slice(-100),
      },
      weave: {
        ...base.labs.weave, ...(labs.weave ?? {}),
        completedArcs: [...new Set(Array.isArray(labs.weave?.completedArcs) ? labs.weave.completedArcs : [])],
        seasonSeeds: [...new Set(Array.isArray(labs.weave?.seasonSeeds) ? labs.weave.seasonSeeds : [])].slice(-300),
        decisions: [...new Set(Array.isArray(labs.weave?.decisions) ? labs.weave.decisions : [])].slice(-100),
      },
      threads: {
        ...base.labs.threads, ...(labs.threads ?? {}),
        completedEpisodes: [...new Set(Array.isArray(labs.threads?.completedEpisodes) ? labs.threads.completedEpisodes : [])],
        cycleSeeds: [...new Set(Array.isArray(labs.threads?.cycleSeeds) ? labs.threads.cycleSeeds : [])].slice(-300),
        decisions: [...new Set(Array.isArray(labs.threads?.decisions) ? labs.threads.decisions : [])].slice(-120),
        unlockedDistricts: [...new Set(['core', ...(Array.isArray(labs.threads?.unlockedDistricts) ? labs.threads.unlockedDistricts : [])])],
        echoes: [...new Set(Array.isArray(labs.threads?.echoes) ? labs.threads.echoes : [])].slice(-120),
      },
      guild: {
        ...base.labs.guild, ...(labs.guild ?? {}),
        completedQuests: [...new Set(Array.isArray(labs.guild?.completedQuests) ? labs.guild.completedQuests : [])],
        questChoices: [...new Set(Array.isArray(labs.guild?.questChoices) ? labs.guild.questChoices : [])].slice(-100),
        jobSeeds: [...new Set(Array.isArray(labs.guild?.jobSeeds) ? labs.guild.jobSeeds.map(Number).filter(Number.isFinite) : [])].slice(-400),
        completedRaids: [...new Set(Array.isArray(labs.guild?.completedRaids) ? labs.guild.completedRaids : [])],
        realmRuns: [...new Set(Array.isArray(labs.guild?.realmRuns) ? labs.guild.realmRuns : [])].slice(-100),
        realmWins: [...new Set(Array.isArray(labs.guild?.realmWins) ? labs.guild.realmWins : [])],
        realmBest: (labs.guild?.realmBest && typeof labs.guild.realmBest === 'object') ? {...labs.guild.realmBest} : {},
        skillLedger: (labs.guild?.skillLedger && typeof labs.guild.skillLedger === 'object') ? structuredClone(labs.guild.skillLedger) : {},
        creditLedger: (labs.guild?.creditLedger && typeof labs.guild.creditLedger === 'object') ? {...labs.guild.creditLedger} : {},
      },
      nexus: {
        ...base.labs.nexus, ...(labs.nexus ?? {}),
        research: [...new Set(Array.isArray(labs.nexus?.research) ? labs.nexus.research : [])],
        completedMissions: [...new Set(Array.isArray(labs.nexus?.completedMissions) ? labs.nexus.completedMissions : [])],
        remixMissions: [...new Set(Array.isArray(labs.nexus?.remixMissions) ? labs.nexus.remixMissions : [])],
        trialSeeds: [...new Set(Array.isArray(labs.nexus?.trialSeeds) ? labs.nexus.trialSeeds : [])].slice(-200),
        companionLessons: [...new Set(Array.isArray(labs.nexus?.companionLessons) ? labs.nexus.companionLessons : [])],
        companionBuilds: [...new Set(Array.isArray(labs.nexus?.companionBuilds) ? labs.nexus.companionBuilds : [])],
        blueprintLibrary: [...new Set(Array.isArray(labs.nexus?.blueprintLibrary) ? labs.nexus.blueprintLibrary : [])].slice(-50),
      },
      python: {
        ...base.labs.python,
        ...(labs.python ?? {}),
        completed: [...new Set(Array.isArray(labs.python?.completed) ? labs.python.completed : [])],
        bestChecks: { ...(labs.python?.bestChecks ?? {}) },
      },
    },
    sandbox: { ...base.sandbox, ...(overrides.sandbox ?? {}), solvedSeeds: [...new Set(Array.isArray(overrides.sandbox?.solvedSeeds) ? overrides.sandbox.solvedSeeds : [])].slice(-100) },
    stats: { ...base.stats, ...(overrides.stats ?? {}) },
  };
}

export function getCampusRank(xp = 0) {
  let current = RANKS[0];
  for (const rank of RANKS) if (xp >= rank.xp) current = rank;
  const index = RANKS.indexOf(current);
  const next = RANKS[index + 1] ?? null;
  return {
    ...current,
    index,
    next,
    progress: next ? Math.max(0, Math.min(1, (xp - current.xp) / (next.xp - current.xp))) : 1,
  };
}

export function awardCampusXp(profile, amount, reason = 'progress') {
  const safe = Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
  const key = String(reason || 'progress');
  if (Object.prototype.hasOwnProperty.call(profile.awards ?? {}, key)) return profile;
  const awards = { ...(profile.awards ?? {}), [key]:safe };
  const ledgerXp = Object.values(awards).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
  return {
    ...profile,
    awards,
    xp: Math.max(0, Number(profile.legacyXp ?? 0) || 0) + ledgerXp,
    lastAward: { amount: safe, reason },
  };
}

export function markContractSolved(profile, contractId, score = 1, xp = 40) {
  const first = !profile.completedContracts.includes(contractId);
  const previous = Number(profile.contractBest[contractId] ?? 0);
  let next = {
    ...profile,
    completedContracts: first ? [...profile.completedContracts, contractId] : [...profile.completedContracts],
    contractBest: { ...profile.contractBest, [contractId]: Math.max(previous, score) },
    stats: {
      ...profile.stats,
      contractsSolved: first ? profile.stats.contractsSolved + 1 : profile.stats.contractsSolved,
    },
  };
  if (first) next = awardCampusXp(next, xp, `contract:${contractId}`);
  return next;
}

export function markPythonContractSolved(profile, contractId, checks = 1, xp = 60) {
  const first = !profile.labs.python.completed.includes(contractId);
  let next = {
    ...profile,
    labs: {
      ...profile.labs,
      python: {
        ...profile.labs.python,
        completed: first ? [...profile.labs.python.completed, contractId] : [...profile.labs.python.completed],
        bestChecks: { ...profile.labs.python.bestChecks, [contractId]: Math.max(Number(profile.labs.python.bestChecks[contractId] ?? 0), Number(checks ?? 0)) },
      },
    },
  };
  if (first) next = awardCampusXp(next, xp, `python:${contractId}`);
  return next;
}

export function markSandboxSolved(profile, seed, score = 0, xp = 20) {
  const safeSeed = Math.max(1, Math.round(Number(seed) || 1));
  const first = !profile.sandbox.solvedSeeds.includes(safeSeed);
  let next = {
    ...profile,
    sandbox: {
      solvedSeeds: first ? [...profile.sandbox.solvedSeeds, safeSeed].slice(-100) : [...profile.sandbox.solvedSeeds],
      bestScore: Math.max(Number(profile.sandbox.bestScore ?? 0), Number(score ?? 0)),
    },
  };
  if (first) next = awardCampusXp(next, xp, `sandbox:${safeSeed}`);
  return next;
}

export function markModelDatasetSolved(profile, datasetId, accuracy = 0, epochs = 0, xp = 110) {
  const current = profile.labs.model ?? { completedDatasets:[], bestAccuracy:0, epochs:0 };
  const first = !current.completedDatasets.includes(datasetId);
  let next = {
    ...profile,
    labs: {
      ...profile.labs,
      model: {
        ...current,
        completedDatasets: first ? [...current.completedDatasets, datasetId] : [...current.completedDatasets],
        bestAccuracy: Math.max(Number(current.bestAccuracy ?? 0), Number(accuracy ?? 0)),
        epochs: Math.max(Number(current.epochs ?? 0), Number(epochs ?? 0)),
      },
    },
  };
  if (first) next = awardCampusXp(next, xp, `model:${datasetId}`);
  return next;
}

export function markCampusMission(profile, lab, missionId, patch = {}, xp = 90) {
  const previous = profile.labs?.[lab] ?? { completed:false, completedMissions:[] };
  const completedMissions = Array.isArray(previous.completedMissions) ? previous.completedMissions : [];
  const first = !completedMissions.includes(missionId);
  let next = {
    ...profile,
    labs: {
      ...profile.labs,
      [lab]: {
        ...previous,
        ...patch,
        completedMissions: first ? [...completedMissions, missionId] : [...completedMissions],
      },
    },
  };
  if (first) next = awardCampusXp(next, xp, `labmission:${lab}:${missionId}`);
  return next;
}

export function markFactoryTrialSolved(profile, seed, score = 0, xp = 80) {
  const safeSeed = Math.max(1, Math.round(Number(seed) || 1));
  const current = profile.labs.factory ?? { trialSeeds:[], bestTrialScore:0 };
  const first = !current.trialSeeds.includes(safeSeed);
  let next = {
    ...profile,
    labs: {
      ...profile.labs,
      factory: {
        ...current,
        trialSeeds: first ? [...current.trialSeeds, safeSeed].slice(-100) : [...current.trialSeeds],
        bestTrialScore: Math.max(Number(current.bestTrialScore ?? 0), Number(score ?? 0)),
      },
    },
  };
  if (first) next = awardCampusXp(next, xp, `factorytrial:${safeSeed}`);
  return next;
}

export function markSimnetIncidentSolved(profile, seed, score = 0, xp = 90) {
  const safeSeed = Math.max(1, Math.round(Number(seed) || 1));
  const current = profile.labs.simnet ?? { incidentSeeds:[], bestIncidentScore:0 };
  const first = !current.incidentSeeds.includes(safeSeed);
  let next = {
    ...profile,
    labs: {
      ...profile.labs,
      simnet: {
        ...current,
        incidentSeeds: first ? [...current.incidentSeeds, safeSeed].slice(-100) : [...current.incidentSeeds],
        bestIncidentScore: Math.max(Number(current.bestIncidentScore ?? 0), Number(score ?? 0)),
      },
    },
  };
  if (first) next = awardCampusXp(next, xp, `simnetincident:${safeSeed}`);
  return next;
}

export function markNexusResearch(profile, researchId, xp = 55) {
  const current = profile.labs?.nexus ?? { research:[] };
  const first = !current.research.includes(researchId);
  let next = { ...profile, labs:{ ...profile.labs, nexus:{ ...current, research:first ? [...current.research,researchId] : [...current.research] } } };
  if (first) next = awardCampusXp(next, xp, `nexusresearch:${researchId}`);
  return next;
}

export function markNexusMission(profile, missionId, score = 0, lesson = '', xp = 150, blueprint = []) {
  const current = profile.labs?.nexus ?? { completedMissions:[], companionLessons:[], bestScore:0 };
  const first = !current.completedMissions.includes(missionId);
  const lessons = lesson ? [...new Set([...(current.companionLessons ?? []), lesson])] : [...(current.companionLessons ?? [])];
  const signature = Array.isArray(blueprint) && blueprint.length ? `${missionId}:${[...new Set(blueprint)].sort().join('+')}` : '';
  const library = signature ? [...new Set([...(current.blueprintLibrary ?? []), signature])].slice(-50) : [...(current.blueprintLibrary ?? [])];
  let next = { ...profile, labs:{ ...profile.labs, nexus:{ ...current, completedMissions:first ? [...current.completedMissions,missionId] : [...current.completedMissions], companionLessons:lessons, blueprintLibrary:library, bestScore:Math.max(Number(current.bestScore??0),Number(score??0)) } } };
  if (first) next = awardCampusXp(next, xp, `nexusmission:${missionId}`);
  return next;
}

export function markNexusRemix(profile, missionId, xp = 70) {
  const current=profile.labs?.nexus ?? {remixMissions:[]};
  const first=!(current.remixMissions??[]).includes(missionId);
  let next={...profile,labs:{...profile.labs,nexus:{...current,remixMissions:first?[...(current.remixMissions??[]),missionId]:[...(current.remixMissions??[])]}}};
  if(first) next=awardCampusXp(next,xp,`nexusremix:${missionId}`);
  return next;
}

export function markNexusTrialSolved(profile, seed, score = 0, xp = 65, blueprint = []) {
  const safeSeed=Math.max(1,Math.round(Number(seed)||1));
  const current=profile.labs?.nexus ?? {trialSeeds:[],bestScore:0};
  const first=!current.trialSeeds.includes(safeSeed);
  const signature=Array.isArray(blueprint)&&blueprint.length?`trial-${safeSeed}:${[...new Set(blueprint)].sort().join('+')}`:'';
  const library=signature?[...new Set([...(current.blueprintLibrary??[]),signature])].slice(-50):[...(current.blueprintLibrary??[])];
  let next={...profile,labs:{...profile.labs,nexus:{...current,trialSeeds:first?[...current.trialSeeds,safeSeed].slice(-200):[...current.trialSeeds],blueprintLibrary:library,bestScore:Math.max(Number(current.bestScore??0),Number(score??0))}}};
  if(first) next=awardCampusXp(next,xp,`nexustrial:${safeSeed}`);
  return next;
}

export function markNexusCompanionLesson(profile, lesson, xp = 20) {
  const current=profile.labs?.nexus ?? {companionLessons:[]};
  const first=!current.companionLessons.includes(lesson);
  let next={...profile,labs:{...profile.labs,nexus:{...current,companionLessons:first?[...current.companionLessons,lesson]:[...current.companionLessons]}}};
  if(first) next=awardCampusXp(next,xp,`nexuslesson:${lesson}`);
  return next;
}

export function markNexusCompanionBuild(profile, buildId, xp = 90) {
  const current=profile.labs?.nexus ?? {companionBuilds:[]};
  const first=!(current.companionBuilds??[]).includes(buildId);
  let next={...profile,labs:{...profile.labs,nexus:{...current,companionBuilds:first?[...(current.companionBuilds??[]),buildId]:[...(current.companionBuilds??[])]}}};
  if(first) next=awardCampusXp(next,xp,`nexusbuild:${buildId}`);
  return next;
}

export function markDeskIncidentSolved(profile, seed, score = 0, xp = 85) {
  const safeSeed=Math.max(1,Math.round(Number(seed)||1));
  const current=profile.labs?.desk ?? {incidentSeeds:[],bestIncidentScore:0};
  const first=!(current.incidentSeeds??[]).includes(safeSeed);
  let next={...profile,labs:{...profile.labs,desk:{...current,incidentSeeds:first?[...(current.incidentSeeds??[]),safeSeed].slice(-200):[...(current.incidentSeeds??[])],bestIncidentScore:Math.max(Number(current.bestIncidentScore??0),Number(score??0))}}};
  if(first) next=awardCampusXp(next,xp,`deskincident:${safeSeed}`);
  return next;
}


export function markWorldStorySolved(profile, storyId, score = 0, discovered = [], playbook = '', xp = 170, mastery = '') {
  const current=profile.labs?.world ?? {completedStories:[],shiftSeeds:[],discoveredNodes:[],playbooks:[],bestScore:0};
  const first=!(current.completedStories??[]).includes(storyId);
  const completedStories=first?[...(current.completedStories??[]),storyId]:[...(current.completedStories??[])];
  const complete=completedStories.length>=6;
  let next={...profile,labs:{...profile.labs,world:{...current,completed:current.completed||complete,completedStories,masteredPatterns:mastery?[...new Set([...(current.masteredPatterns??[]),mastery])]:[...(current.masteredPatterns??[])],discoveredNodes:[...new Set([...(current.discoveredNodes??[]),...discovered])],playbooks:playbook?[...new Set([...(current.playbooks??[]),playbook])].slice(-100):[...(current.playbooks??[])],bestScore:Math.max(Number(current.bestScore??0),Number(score??0))}}};
  if(first) next=awardCampusXp(next,xp,`worldstory:${storyId}`);
  return next;
}

export function markWorldShiftSolved(profile, seed, score = 0, discovered = [], playbook = '', xp = 95, mastery = '', direct = false, blackBox = false) {
  const safeSeed=Math.max(1,Math.round(Number(seed)||1));
  const current=profile.labs?.world ?? {completedStories:[],shiftSeeds:[],discoveredNodes:[],playbooks:[],bestScore:0};
  const first=!(current.shiftSeeds??[]).includes(safeSeed);
  let next={...profile,labs:{...profile.labs,world:{...current,shiftSeeds:first?[...(current.shiftSeeds??[]),safeSeed].slice(-300):[...(current.shiftSeeds??[])],directPatchSeeds:direct?[...new Set([...(current.directPatchSeeds??[]),safeSeed])].slice(-300):[...(current.directPatchSeeds??[])],blackBoxSeeds:blackBox?[...new Set([...(current.blackBoxSeeds??[]),safeSeed])].slice(-300):[...(current.blackBoxSeeds??[])],masteredPatterns:mastery?[...new Set([...(current.masteredPatterns??[]),mastery])]:[...(current.masteredPatterns??[])],discoveredNodes:[...new Set([...(current.discoveredNodes??[]),...discovered])],playbooks:playbook?[...new Set([...(current.playbooks??[]),`shift-${safeSeed}:${playbook}`])].slice(-100):[...(current.playbooks??[])],bestScore:Math.max(Number(current.bestScore??0),Number(score??0))}}};
  if(first) next=awardCampusXp(next,xp,`worldshift:${safeSeed}`);
  return next;
}

export function markCommonsBlueprint(profile, briefId, blueprint = '', score = 0, efficiency = 0, xp = 180) {
  const current=profile.labs?.commons ?? {completedBriefs:[],daySeeds:[],blueprints:[],bestScore:0,bestEfficiency:0};
  const first=!(current.completedBriefs??[]).includes(briefId);
  const completedBriefs=first?[...(current.completedBriefs??[]),briefId]:[...(current.completedBriefs??[])];
  let next={...profile,labs:{...profile.labs,commons:{...current,completed:current.completed||completedBriefs.length>=4,completedBriefs,blueprints:blueprint?[...new Set([...(current.blueprints??[]),blueprint])].slice(-100):[...(current.blueprints??[])],bestScore:Math.max(Number(current.bestScore??0),Number(score??0)),bestEfficiency:Math.max(Number(current.bestEfficiency??0),Number(efficiency??0))}}};
  if(first) next=awardCampusXp(next,xp,`commons:brief:${briefId}`);
  return next;
}

export function markCommonsDay(profile, seed, score = 0, xp = 115) {
  const safeSeed=Math.max(1,Math.round(Number(seed)||1));
  const current=profile.labs?.commons ?? {completedBriefs:[],daySeeds:[],blueprints:[],bestScore:0,bestEfficiency:0};
  const first=!(current.daySeeds??[]).includes(safeSeed);
  let next={...profile,labs:{...profile.labs,commons:{...current,daySeeds:first?[...(current.daySeeds??[]),safeSeed].slice(-300):[...(current.daySeeds??[])],bestScore:Math.max(Number(current.bestScore??0),Number(score??0))}}};
  if(first) next=awardCampusXp(next,xp,`commons:day:${safeSeed}`);
  return next;
}

export function markCommonsCode(profile, xp = 420) {
  const current=profile.labs?.commons ?? {codeDeployed:false};
  if(current.codeDeployed) return profile;
  return awardCampusXp({...profile,labs:{...profile.labs,commons:{...current,codeDeployed:true}}},xp,'commons:code-autopilot');
}


export function markOperationsArc(profile, arcId, patchId = '', trust = 0, xp = 190) {
  const current=profile.labs?.operations ?? {completedArcs:[],shiftSeeds:[],acceptedPatches:[],rollbackArcs:[],bestTrust:0,bestScore:0};
  const first=!(current.completedArcs??[]).includes(arcId);
  const completedArcs=first?[...(current.completedArcs??[]),arcId]:[...(current.completedArcs??[])];
  let next={...profile,labs:{...profile.labs,operations:{...current,completed:current.completed||completedArcs.length>=5,completedArcs,acceptedPatches:patchId?[...new Set([...(current.acceptedPatches??[]),`${arcId}:${patchId}`])].slice(-100):[...(current.acceptedPatches??[])],bestTrust:Math.max(Number(current.bestTrust??0),Number(trust??0))}}};
  if(first) next=awardCampusXp(next,xp,`operations:arc:${arcId}`);
  return next;
}

export function markOperationsRollback(profile, arcId, xp = 55) {
  const current=profile.labs?.operations ?? {rollbackArcs:[]};
  const first=!(current.rollbackArcs??[]).includes(arcId);
  let next={...profile,labs:{...profile.labs,operations:{...current,rollbackArcs:first?[...(current.rollbackArcs??[]),arcId]:[...(current.rollbackArcs??[])]}}};
  if(first) next=awardCampusXp(next,xp,`operations:rollback:${arcId}`);
  return next;
}

export function markOperationsShift(profile, seed, score = 0, xp = 105) {
  const safeSeed=Math.max(1,Math.round(Number(seed)||1));
  const current=profile.labs?.operations ?? {shiftSeeds:[],bestScore:0};
  const first=!(current.shiftSeeds??[]).includes(safeSeed);
  let next={...profile,labs:{...profile.labs,operations:{...current,shiftSeeds:first?[...(current.shiftSeeds??[]),safeSeed].slice(-300):[...(current.shiftSeeds??[])],bestScore:Math.max(Number(current.bestScore??0),Number(score??0))}}};
  if(first) next=awardCampusXp(next,xp,`operations:shift:${safeSeed}`);
  return next;
}

export function markOperationsCode(profile, xp = 430) {
  const current=profile.labs?.operations ?? {codeDeployed:false};
  if(current.codeDeployed) return profile;
  return awardCampusXp({...profile,labs:{...profile.labs,operations:{...current,codeDeployed:true}}},xp,'operations:code-release-guard');
}

export function markChronicleArc(profile, arcId, decisionId = '', debt = 999, postmortem = '', xp = 220) {
  const current=profile.labs?.chronicle ?? {completedArcs:[],decisions:[],postmortems:[],bestDebt:999};
  const first=!(current.completedArcs??[]).includes(arcId);
  const completedArcs=first?[...(current.completedArcs??[]),arcId]:[...(current.completedArcs??[])];
  let next={...profile,labs:{...profile.labs,chronicle:{...current,completed:current.completed||completedArcs.length>=5,completedArcs,decisions:decisionId?[...new Set([...(current.decisions??[]),`${arcId}:${decisionId}`])].slice(-100):[...(current.decisions??[])],postmortems:postmortem?[...new Set([...(current.postmortems??[]),postmortem])].slice(-100):[...(current.postmortems??[])],bestDebt:Math.min(Number(current.bestDebt??999),Number(debt??999))}}};
  if(first) next=awardCampusXp(next,xp,`chronicle:arc:${arcId}`);
  return next;
}

export function markChronicleWindow(profile, seed, score = 0, xp = 120) {
  const safeSeed=Math.max(1,Math.round(Number(seed)||1));
  const current=profile.labs?.chronicle ?? {windowSeeds:[],bestScore:0};
  const first=!(current.windowSeeds??[]).includes(safeSeed);
  let next={...profile,labs:{...profile.labs,chronicle:{...current,windowSeeds:first?[...(current.windowSeeds??[]),safeSeed].slice(-300):[...(current.windowSeeds??[])],bestScore:Math.max(Number(current.bestScore??0),Number(score??0))}}};
  if(first) next=awardCampusXp(next,xp,`chronicle:window:${safeSeed}`);
  return next;
}

export function markChronicleCode(profile, xp = 480) {
  const current=profile.labs?.chronicle ?? {codeDeployed:false};
  if(current.codeDeployed) return profile;
  return awardCampusXp({...profile,labs:{...profile.labs,chronicle:{...current,codeDeployed:true}}},xp,'chronicle:code-migration-policy');
}

export function markWeaveArc(profile, arcId, choiceId = '', score = 0, xp = 240) {
  const current=profile.labs?.weave ?? {completedArcs:[],decisions:[],bestBalance:0};
  const first=!(current.completedArcs??[]).includes(arcId);
  const completedArcs=first?[...(current.completedArcs??[]),arcId]:[...(current.completedArcs??[])];
  const filtered=(current.decisions??[]).filter(x=>!String(x).startsWith(`${arcId}:`));
  const decisions=choiceId?[...filtered,`${arcId}:${choiceId}`].slice(-100):filtered;
  let next={...profile,labs:{...profile.labs,weave:{...current,completed:current.completed||completedArcs.length>=5,completedArcs,decisions,bestBalance:Math.max(Number(current.bestBalance??0),Number(score??0)),bestScore:Math.max(Number(current.bestScore??0),Number(score??0))}}};
  if(first) next=awardCampusXp(next,xp,`weave:arc:${arcId}`);
  return next;
}

export function markWeaveSeason(profile, seed, score = 0, xp = 130) {
  const safeSeed=Math.max(1,Math.round(Number(seed)||1));
  const current=profile.labs?.weave ?? {seasonSeeds:[],bestBalance:0,bestScore:0};
  const first=!(current.seasonSeeds??[]).includes(safeSeed);
  let next={...profile,labs:{...profile.labs,weave:{...current,seasonSeeds:first?[...(current.seasonSeeds??[]),safeSeed].slice(-300):[...(current.seasonSeeds??[])],bestBalance:Math.max(Number(current.bestBalance??0),Number(score??0)),bestScore:Math.max(Number(current.bestScore??0),Number(score??0))}}};
  if(first) next=awardCampusXp(next,xp,`weave:season:${safeSeed}`);
  return next;
}

export function markWeaveCode(profile, xp = 520) {
  const current=profile.labs?.weave ?? {codeDeployed:false};
  if(current.codeDeployed) return profile;
  return awardCampusXp({...profile,labs:{...profile.labs,weave:{...current,codeDeployed:true}}},xp,'weave:code-city-governor');
}

export function markThreadsEpisode(profile, episodeId, choiceId = '', unlocks = [], echo = '', qbotDelta = 0, score = 0, xp = 260) {
  const current=profile.labs?.threads ?? {completedEpisodes:[],decisions:[],unlockedDistricts:['core'],echoes:[],qbotBond:0,bestContinuity:0,bestScore:0};
  const first=!(current.completedEpisodes??[]).includes(episodeId);
  const completedEpisodes=first?[...(current.completedEpisodes??[]),episodeId]:[...(current.completedEpisodes??[])];
  const filtered=(current.decisions??[]).filter(x=>!String(x).startsWith(`${episodeId}:`));
  const decisions=choiceId?[...filtered,`${episodeId}:${choiceId}`].slice(-120):filtered;
  const unlockedDistricts=[...new Set(['core',...(current.unlockedDistricts??[]),...(Array.isArray(unlocks)?unlocks:[])])];
  const echoes=echo?[...new Set([...(current.echoes??[]),String(echo)])].slice(-120):[...(current.echoes??[])];
  let next={...profile,labs:{...profile.labs,threads:{...current,completed:current.completed||completedEpisodes.length>=10,completedEpisodes,decisions,unlockedDistricts,echoes,qbotBond:Math.max(0,Math.min(100,Number(current.qbotBond??0)+Number(qbotDelta??0))),bestContinuity:Math.max(Number(current.bestContinuity??0),Number(score??0)),bestScore:Math.max(Number(current.bestScore??0),Number(score??0))}}};
  if(first) next=awardCampusXp(next,xp,`threads:episode:${episodeId}`);
  return next;
}

export function markThreadsCycle(profile, seed, score = 0, xp = 150) {
  const safeSeed=Math.max(1,Math.round(Number(seed)||1));
  const current=profile.labs?.threads ?? {cycleSeeds:[],bestContinuity:0,bestScore:0};
  const first=!(current.cycleSeeds??[]).includes(safeSeed);
  let next={...profile,labs:{...profile.labs,threads:{...current,cycleSeeds:first?[...(current.cycleSeeds??[]),safeSeed].slice(-300):[...(current.cycleSeeds??[])],bestContinuity:Math.max(Number(current.bestContinuity??0),Number(score??0)),bestScore:Math.max(Number(current.bestScore??0),Number(score??0))}}};
  if(first) next=awardCampusXp(next,xp,`threads:cycle:${safeSeed}`);
  return next;
}

export function markThreadsCode(profile, xp = 600) {
  const current=profile.labs?.threads ?? {codeDeployed:false};
  if(current.codeDeployed) return profile;
  return awardCampusXp({...profile,labs:{...profile.labs,threads:{...current,codeDeployed:true}}},xp,'threads:code-city-orchestrator');
}

function mergeSkillGrant(current = {}, grant = {}) {
  const next = {...current};
  for (const [skillId, amount] of Object.entries(grant ?? {})) {
    next[skillId] = Math.max(Number(next[skillId] ?? 0), Math.max(0, Number(amount) || 0));
  }
  return next;
}

export function markGuildQuest(profile, questId, approachId = '', skills = {}, credits = 0, xp = 220) {
  const current = profile.labs?.guild ?? {completedQuests:[],questChoices:[],skillLedger:{},creditLedger:{},completedRaids:[]};
  const first = !(current.completedQuests ?? []).includes(questId);
  const completedQuests = first ? [...(current.completedQuests ?? []), questId] : [...(current.completedQuests ?? [])];
  const questChoices = [ ...(current.questChoices ?? []).filter(entry => !String(entry).startsWith(`${questId}:`)), ...(approachId ? [`${questId}:${approachId}`] : []) ].slice(-100);
  const key = `quest:${questId}`;
  let next = {...profile, labs:{...profile.labs, guild:{
    ...current,
    completed: Boolean(current.completed || (completedQuests.length >= 6 && (current.completedRaids?.length ?? 0) >= 1)),
    completedQuests,
    questChoices,
    skillLedger: first ? {...(current.skillLedger ?? {}), [key]: mergeSkillGrant({}, skills)} : {...(current.skillLedger ?? {})},
    creditLedger: first ? {...(current.creditLedger ?? {}), [key]: Math.max(0, Number(credits) || 0)} : {...(current.creditLedger ?? {})},
  }}};
  if (first) next = awardCampusXp(next, xp, `guild:quest:${questId}`);
  return next;
}

export function markGuildJob(profile, seed, skillId, skillGain = 1, credits = 0, xp = 100) {
  const safeSeed = Math.max(1, Math.round(Number(seed) || 1));
  const current = profile.labs?.guild ?? {jobSeeds:[],skillLedger:{},creditLedger:{}};
  const first = !(current.jobSeeds ?? []).includes(safeSeed);
  const key = `job:${safeSeed}`;
  let next = {...profile, labs:{...profile.labs, guild:{
    ...current,
    jobSeeds: first ? [...(current.jobSeeds ?? []), safeSeed].slice(-400) : [...(current.jobSeeds ?? [])],
    skillLedger: first ? {...(current.skillLedger ?? {}), [key]: {[skillId]:Math.max(0, Number(skillGain) || 0)}} : {...(current.skillLedger ?? {})},
    creditLedger: first ? {...(current.creditLedger ?? {}), [key]: Math.max(0, Number(credits) || 0)} : {...(current.creditLedger ?? {})},
  }}};
  if (first) next = awardCampusXp(next, xp, `guild:job:${safeSeed}`);
  return next;
}

export function markGuildRaid(profile, raidId, skills = {}, credits = 0, score = 0, xp = 500) {
  const current = profile.labs?.guild ?? {completedQuests:[],completedRaids:[],skillLedger:{},creditLedger:{},bestRaidScore:0};
  const first = !(current.completedRaids ?? []).includes(raidId);
  const completedRaids = first ? [...(current.completedRaids ?? []), raidId] : [...(current.completedRaids ?? [])];
  const key = `raid:${raidId}`;
  let next = {...profile, labs:{...profile.labs, guild:{
    ...current,
    completed: Boolean(current.completed || ((current.completedQuests?.length ?? 0) >= 6 && completedRaids.length >= 1)),
    completedRaids,
    skillLedger: first ? {...(current.skillLedger ?? {}), [key]: mergeSkillGrant({}, skills)} : {...(current.skillLedger ?? {})},
    creditLedger: first ? {...(current.creditLedger ?? {}), [key]: Math.max(0, Number(credits) || 0)} : {...(current.creditLedger ?? {})},
    bestRaidScore: Math.max(Number(current.bestRaidScore ?? 0), Number(score ?? 0)),
  }}};
  if (first) next = awardCampusXp(next, xp, `guild:raid:${raidId}`);
  return next;
}

// day > 1 (17.0): a later day of the profession, recorded as its own ledger
// key realm:<id>:d<day> so it merges like every other grant.
export function markGuildRealm(profile, realmId, score = 0, skillId = '', skillGain = 2, xp = 170, day = 1) {
  const current = profile.labs?.guild ?? {realmRuns:[],realmWins:[],realmBest:{},skillLedger:{}};
  const later = Number(day) > 1 && (current.realmWins ?? []).includes(realmId);
  const ledgerKey = later ? `realm:${realmId}:d${Number(day)}` : `realm:${realmId}`;
  const first = later ? !current.skillLedger?.[ledgerKey] : !(current.realmWins ?? []).includes(realmId);
  const runKey = `${realmId}:${Math.max(0, Number(score) || 0)}`;
  let next = {...profile, labs:{...profile.labs, guild:{
    ...current,
    realmRuns:[...new Set([...(current.realmRuns ?? []), runKey])].slice(-100),
    realmWins:first&&!later?[...(current.realmWins ?? []),realmId]:[...(current.realmWins ?? [])],
    realmBest:{...(current.realmBest ?? {}),[realmId]:Math.max(Number(current.realmBest?.[realmId] ?? 0),Number(score ?? 0))},
    skillLedger:first&&skillId?{...(current.skillLedger ?? {}),[ledgerKey]:{[skillId]:Math.max(0,Number(skillGain)||0)}}:{...(current.skillLedger ?? {})},
  }}};
  if(first) next=awardCampusXp(next,xp,later?`guild:realm:${realmId}:d${Number(day)}`:`guild:realm:${realmId}`);
  return next;
}

export function markLabComplete(profile, lab, patch = {}, xp = 180) {
  const previous = profile.labs?.[lab] ?? {};
  const first = !previous.completed;
  let next = {
    ...profile,
    labs: { ...profile.labs, [lab]: { ...previous, ...patch, completed: true } },
    stats: {
      ...profile.stats,
      labsCompleted: first ? profile.stats.labsCompleted + 1 : profile.stats.labsCompleted,
    },
  };
  if (first) next = awardCampusXp(next, xp, `lab:${lab}`);
  return next;
}

export function loadCampusProfile(storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem(CAMPUS_PROFILE_KEY));
    if (parsed?.version === CAMPUS_PROFILE_VERSION) return createCampusProfile(parsed);
  } catch {
    // Corrupt optional meta-progress must never block the campaign.
  }
  for (const key of LEGACY_CAMPUS_PROFILE_KEYS) {
    try {
      const legacy = JSON.parse(storage?.getItem(key));
      if ([14,13,12,11,10,9,8,7,6,5,4,3,2,1].includes(legacy?.version)) return createCampusProfile(legacy);
    } catch {
      // Legacy migration is best effort; campaign state remains independent.
    }
  }
  return createCampusProfile();
}

export function saveCampusProfile(profile, storage = globalThis.localStorage) {
  try {
    storage?.setItem(CAMPUS_PROFILE_KEY, JSON.stringify(createCampusProfile(profile)));
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export function exportCampusProfile(profile) {
  return JSON.stringify(createCampusProfile(profile));
}

export function mergeCampusProfile(localProfile, incomingProfile) {
  const local = createCampusProfile(localProfile);
  const incoming = createCampusProfile(incomingProfile);
  const contractIds = [...new Set([...local.completedContracts, ...incoming.completedContracts])];
  const contractBest = { ...local.contractBest };
  for (const [id, value] of Object.entries(incoming.contractBest)) {
    contractBest[id] = Math.max(Number(contractBest[id] ?? 0), Number(value ?? 0));
  }
  const pythonCompleted = [...new Set([...local.labs.python.completed, ...incoming.labs.python.completed])];
  const pythonBest = { ...local.labs.python.bestChecks };
  for (const [id, value] of Object.entries(incoming.labs.python.bestChecks)) {
    pythonBest[id] = Math.max(Number(pythonBest[id] ?? 0), Number(value ?? 0));
  }
  const awards = { ...local.awards };
  for (const [reason, amount] of Object.entries(incoming.awards)) {
    awards[reason] = Math.max(Number(awards[reason] ?? 0), Number(amount ?? 0));
  }
  return createCampusProfile({
    legacyXp: Math.max(local.legacyXp, incoming.legacyXp),
    awards,
    completedContracts: contractIds,
    contractBest,
    sandbox: { solvedSeeds: [...new Set([...local.sandbox.solvedSeeds, ...incoming.sandbox.solvedSeeds])].slice(-100), bestScore: Math.max(local.sandbox.bestScore, incoming.sandbox.bestScore) },
    labs: {
      ai: {
        completed: local.labs.ai.completed || incoming.labs.ai.completed,
        bestAccuracy: Math.max(local.labs.ai.bestAccuracy, incoming.labs.ai.bestAccuracy),
        feedbackRounds: Math.max(local.labs.ai.feedbackRounds, incoming.labs.ai.feedbackRounds),
      },
      model: {
        completedDatasets: [...new Set([...local.labs.model.completedDatasets, ...incoming.labs.model.completedDatasets])],
        bestAccuracy: Math.max(local.labs.model.bestAccuracy, incoming.labs.model.bestAccuracy),
        epochs: Math.max(local.labs.model.epochs, incoming.labs.model.epochs),
      },
      neural: {
        completed: local.labs.neural.completed || incoming.labs.neural.completed,
        bestAccuracy: Math.max(local.labs.neural.bestAccuracy, incoming.labs.neural.bestAccuracy),
        bestLoss: Math.min(Number(local.labs.neural.bestLoss ?? 999), Number(incoming.labs.neural.bestLoss ?? 999)),
        epochs: Math.max(local.labs.neural.epochs, incoming.labs.neural.epochs),
      },
      llm: {
        completed: local.labs.llm.completed || incoming.labs.llm.completed,
        missions: Math.max(local.labs.llm.missions, incoming.labs.llm.missions),
      },
      retrieval: {
        completed: local.labs.retrieval.completed || incoming.labs.retrieval.completed,
        completedMissions: [...new Set([...local.labs.retrieval.completedMissions, ...incoming.labs.retrieval.completedMissions])],
        bestRecall: Math.max(local.labs.retrieval.bestRecall, incoming.labs.retrieval.bestRecall),
      },
      bot: {
        completed: local.labs.bot.completed || incoming.labs.bot.completed,
        completedMissions: [...new Set([...local.labs.bot.completedMissions, ...incoming.labs.bot.completedMissions])],
        feedbackRounds: Math.max(local.labs.bot.feedbackRounds, incoming.labs.bot.feedbackRounds),
      },
      automation: {
        completed: local.labs.automation.completed || incoming.labs.automation.completed,
        completedMissions: [...new Set([...local.labs.automation.completedMissions, ...incoming.labs.automation.completedMissions])],
        safeRuns: Math.max(local.labs.automation.safeRuns, incoming.labs.automation.safeRuns),
      },
      factory: {
        completed: local.labs.factory.completed || incoming.labs.factory.completed,
        bestScore: Math.max(local.labs.factory.bestScore, incoming.labs.factory.bestScore),
        bestCost: Math.min(Number(local.labs.factory.bestCost ?? 999), Number(incoming.labs.factory.bestCost ?? 999)),
        trialSeeds: [...new Set([...(local.labs.factory.trialSeeds ?? []), ...(incoming.labs.factory.trialSeeds ?? [])])].slice(-100),
        bestTrialScore: Math.max(Number(local.labs.factory.bestTrialScore ?? 0), Number(incoming.labs.factory.bestTrialScore ?? 0)),
      },
      simnet: {
        completed: local.labs.simnet.completed || incoming.labs.simnet.completed,
        completedMissions: [...new Set([...(local.labs.simnet.completedMissions ?? []), ...(incoming.labs.simnet.completedMissions ?? [])])],
        incidentSeeds: [...new Set([...(local.labs.simnet.incidentSeeds ?? []), ...(incoming.labs.simnet.incidentSeeds ?? [])])].slice(-100),
        bestIncidentScore: Math.max(Number(local.labs.simnet.bestIncidentScore ?? 0), Number(incoming.labs.simnet.bestIncidentScore ?? 0)),
      },
      desk: {
        completed: local.labs.desk.completed || incoming.labs.desk.completed,
        completedMissions: [...new Set([...(local.labs.desk.completedMissions ?? []), ...(incoming.labs.desk.completedMissions ?? [])])],
        incidentSeeds: [...new Set([...(local.labs.desk.incidentSeeds ?? []), ...(incoming.labs.desk.incidentSeeds ?? [])])].slice(-200),
        bestScore: Math.max(Number(local.labs.desk.bestScore ?? 0), Number(incoming.labs.desk.bestScore ?? 0)),
        bestIncidentScore: Math.max(Number(local.labs.desk.bestIncidentScore ?? 0), Number(incoming.labs.desk.bestIncidentScore ?? 0)),
      },
      world: {
        completed: local.labs.world.completed || incoming.labs.world.completed,
        completedStories: [...new Set([...(local.labs.world.completedStories ?? []), ...(incoming.labs.world.completedStories ?? [])])],
        shiftSeeds: [...new Set([...(local.labs.world.shiftSeeds ?? []), ...(incoming.labs.world.shiftSeeds ?? [])])].slice(-300),
        directPatchSeeds: [...new Set([...(local.labs.world.directPatchSeeds ?? []), ...(incoming.labs.world.directPatchSeeds ?? [])])].slice(-300),
        blackBoxSeeds: [...new Set([...(local.labs.world.blackBoxSeeds ?? []), ...(incoming.labs.world.blackBoxSeeds ?? [])])].slice(-300),
        masteredPatterns: [...new Set([...(local.labs.world.masteredPatterns ?? []), ...(incoming.labs.world.masteredPatterns ?? [])])],
        discoveredNodes: [...new Set([...(local.labs.world.discoveredNodes ?? []), ...(incoming.labs.world.discoveredNodes ?? [])])],
        playbooks: [...new Set([...(local.labs.world.playbooks ?? []), ...(incoming.labs.world.playbooks ?? [])])].slice(-100),
        bestScore: Math.max(Number(local.labs.world.bestScore ?? 0), Number(incoming.labs.world.bestScore ?? 0)),
      },
      commons: {
        completed: local.labs.commons.completed || incoming.labs.commons.completed,
        completedBriefs: [...new Set([...(local.labs.commons.completedBriefs ?? []), ...(incoming.labs.commons.completedBriefs ?? [])])],
        daySeeds: [...new Set([...(local.labs.commons.daySeeds ?? []), ...(incoming.labs.commons.daySeeds ?? [])])].slice(-300),
        codeDeployed: Boolean(local.labs.commons.codeDeployed || incoming.labs.commons.codeDeployed),
        blueprints: [...new Set([...(local.labs.commons.blueprints ?? []), ...(incoming.labs.commons.blueprints ?? [])])].slice(-100),
        bestScore: Math.max(Number(local.labs.commons.bestScore ?? 0), Number(incoming.labs.commons.bestScore ?? 0)),
        bestEfficiency: Math.max(Number(local.labs.commons.bestEfficiency ?? 0), Number(incoming.labs.commons.bestEfficiency ?? 0)),
      },
      operations: {
        completed: local.labs.operations.completed || incoming.labs.operations.completed,
        completedArcs: [...new Set([...(local.labs.operations.completedArcs ?? []), ...(incoming.labs.operations.completedArcs ?? [])])],
        shiftSeeds: [...new Set([...(local.labs.operations.shiftSeeds ?? []), ...(incoming.labs.operations.shiftSeeds ?? [])])].slice(-300),
        acceptedPatches: [...new Set([...(local.labs.operations.acceptedPatches ?? []), ...(incoming.labs.operations.acceptedPatches ?? [])])].slice(-100),
        rollbackArcs: [...new Set([...(local.labs.operations.rollbackArcs ?? []), ...(incoming.labs.operations.rollbackArcs ?? [])])].slice(-100),
        codeDeployed: Boolean(local.labs.operations.codeDeployed || incoming.labs.operations.codeDeployed),
        bestTrust: Math.max(Number(local.labs.operations.bestTrust ?? 0), Number(incoming.labs.operations.bestTrust ?? 0)),
        bestScore: Math.max(Number(local.labs.operations.bestScore ?? 0), Number(incoming.labs.operations.bestScore ?? 0)),
      },
      chronicle: {
        completed: local.labs.chronicle.completed || incoming.labs.chronicle.completed,
        completedArcs: [...new Set([...(local.labs.chronicle.completedArcs ?? []), ...(incoming.labs.chronicle.completedArcs ?? [])])],
        windowSeeds: [...new Set([...(local.labs.chronicle.windowSeeds ?? []), ...(incoming.labs.chronicle.windowSeeds ?? [])])].slice(-300),
        decisions: [...new Set([...(local.labs.chronicle.decisions ?? []), ...(incoming.labs.chronicle.decisions ?? [])])].slice(-100),
        postmortems: [...new Set([...(local.labs.chronicle.postmortems ?? []), ...(incoming.labs.chronicle.postmortems ?? [])])].slice(-100),
        codeDeployed: Boolean(local.labs.chronicle.codeDeployed || incoming.labs.chronicle.codeDeployed),
        bestDebt: Math.min(Number(local.labs.chronicle.bestDebt ?? 999), Number(incoming.labs.chronicle.bestDebt ?? 999)),
        bestScore: Math.max(Number(local.labs.chronicle.bestScore ?? 0), Number(incoming.labs.chronicle.bestScore ?? 0)),
      },
      weave: {
        completed: local.labs.weave.completed || incoming.labs.weave.completed,
        completedArcs: [...new Set([...(local.labs.weave.completedArcs ?? []), ...(incoming.labs.weave.completedArcs ?? [])])],
        seasonSeeds: [...new Set([...(local.labs.weave.seasonSeeds ?? []), ...(incoming.labs.weave.seasonSeeds ?? [])])].slice(-300),
        decisions: [...new Set([...(local.labs.weave.decisions ?? []), ...(incoming.labs.weave.decisions ?? [])])].slice(-100),
        codeDeployed: Boolean(local.labs.weave.codeDeployed || incoming.labs.weave.codeDeployed),
        bestBalance: Math.max(Number(local.labs.weave.bestBalance ?? 0), Number(incoming.labs.weave.bestBalance ?? 0)),
        bestScore: Math.max(Number(local.labs.weave.bestScore ?? 0), Number(incoming.labs.weave.bestScore ?? 0)),
      },
      threads: {
        completed: local.labs.threads.completed || incoming.labs.threads.completed,
        completedEpisodes: [...new Set([...(local.labs.threads.completedEpisodes ?? []), ...(incoming.labs.threads.completedEpisodes ?? [])])],
        cycleSeeds: [...new Set([...(local.labs.threads.cycleSeeds ?? []), ...(incoming.labs.threads.cycleSeeds ?? [])])].slice(-300),
        decisions: [...new Set([...(local.labs.threads.decisions ?? []), ...(incoming.labs.threads.decisions ?? [])])].slice(-120),
        unlockedDistricts: [...new Set(['core', ...(local.labs.threads.unlockedDistricts ?? []), ...(incoming.labs.threads.unlockedDistricts ?? [])])],
        echoes: [...new Set([...(local.labs.threads.echoes ?? []), ...(incoming.labs.threads.echoes ?? [])])].slice(-120),
        codeDeployed: Boolean(local.labs.threads.codeDeployed || incoming.labs.threads.codeDeployed),
        qbotBond: Math.max(Number(local.labs.threads.qbotBond ?? 0), Number(incoming.labs.threads.qbotBond ?? 0)),
        bestContinuity: Math.max(Number(local.labs.threads.bestContinuity ?? 0), Number(incoming.labs.threads.bestContinuity ?? 0)),
        bestScore: Math.max(Number(local.labs.threads.bestScore ?? 0), Number(incoming.labs.threads.bestScore ?? 0)),
      },
      guild: {
        completed: local.labs.guild.completed || incoming.labs.guild.completed,
        completedQuests: [...new Set([...(local.labs.guild.completedQuests ?? []), ...(incoming.labs.guild.completedQuests ?? [])])],
        questChoices: [...new Set([...(local.labs.guild.questChoices ?? []), ...(incoming.labs.guild.questChoices ?? [])])].slice(-100),
        jobSeeds: [...new Set([...(local.labs.guild.jobSeeds ?? []), ...(incoming.labs.guild.jobSeeds ?? [])])].slice(-400),
        completedRaids: [...new Set([...(local.labs.guild.completedRaids ?? []), ...(incoming.labs.guild.completedRaids ?? [])])],
        realmRuns: [...new Set([...(local.labs.guild.realmRuns ?? []), ...(incoming.labs.guild.realmRuns ?? [])])].slice(-100),
        realmWins: [...new Set([...(local.labs.guild.realmWins ?? []), ...(incoming.labs.guild.realmWins ?? [])])],
        realmBest: (() => { const out={...(local.labs.guild.realmBest ?? {})}; for(const [id,score] of Object.entries(incoming.labs.guild.realmBest ?? {})) out[id]=Math.max(Number(out[id]??0),Number(score??0)); return out; })(),
        skillLedger: (() => {
          const merged = {...(local.labs.guild.skillLedger ?? {})};
          for (const [key, grant] of Object.entries(incoming.labs.guild.skillLedger ?? {})) merged[key] = mergeSkillGrant(merged[key] ?? {}, grant);
          return merged;
        })(),
        creditLedger: (() => {
          const merged = {...(local.labs.guild.creditLedger ?? {})};
          for (const [key, amount] of Object.entries(incoming.labs.guild.creditLedger ?? {})) merged[key] = Math.max(Number(merged[key] ?? 0), Number(amount ?? 0));
          return merged;
        })(),
        bestRaidScore: Math.max(Number(local.labs.guild.bestRaidScore ?? 0), Number(incoming.labs.guild.bestRaidScore ?? 0)),
      },
      nexus: {
        completed: local.labs.nexus.completed || incoming.labs.nexus.completed,
        research: [...new Set([...(local.labs.nexus.research ?? []), ...(incoming.labs.nexus.research ?? [])])],
        completedMissions: [...new Set([...(local.labs.nexus.completedMissions ?? []), ...(incoming.labs.nexus.completedMissions ?? [])])],
        remixMissions: [...new Set([...(local.labs.nexus.remixMissions ?? []), ...(incoming.labs.nexus.remixMissions ?? [])])],
        trialSeeds: [...new Set([...(local.labs.nexus.trialSeeds ?? []), ...(incoming.labs.nexus.trialSeeds ?? [])])].slice(-200),
        bestScore: Math.max(Number(local.labs.nexus.bestScore ?? 0), Number(incoming.labs.nexus.bestScore ?? 0)),
        companionLessons: [...new Set([...(local.labs.nexus.companionLessons ?? []), ...(incoming.labs.nexus.companionLessons ?? [])])],
        companionBuilds: [...new Set([...(local.labs.nexus.companionBuilds ?? []), ...(incoming.labs.nexus.companionBuilds ?? [])])],
        blueprintLibrary: [...new Set([...(local.labs.nexus.blueprintLibrary ?? []), ...(incoming.labs.nexus.blueprintLibrary ?? [])])].slice(-50),
      },
      python: { completed: pythonCompleted, bestChecks: pythonBest },
    },
    stats: {
      contractsSolved: Math.max(local.stats.contractsSolved, incoming.stats.contractsSolved, contractIds.length),
      labsCompleted: Math.max(local.stats.labsCompleted, incoming.stats.labsCompleted),
      codeRuns: Math.max(local.stats.codeRuns, incoming.stats.codeRuns),
    },
  });
}
