import { getCampusRank, exportCampusProfile, mergeCampusProfile } from './campus-profile.js?v=campus-profile-7';

function setText(root, selector, text) {
  const node = root.querySelector(selector);
  if (node) node.textContent = text;
}

export function createEngineerCampus(root, {
  getProfile,
  onProfile,
  onOpenContracts,
  onOpenPython,
  onOpenAi,
  onOpenModel,
  onOpenNeural,
  onOpenLlm,
  onOpenRetrieval,
  onOpenBot,
  onOpenAutomation,
  onOpenFactory,
  onOpenSimnet,
  onOpenNexus,
  onOpenDesk,
  onOpenWorld,
  onOpenCommons,
  onOpenOperations,
  onOpenChronicle,
  onOpenWeave,
  onOpenThreads,
  onOpenGuild,
  onSound = () => {},
} = {}) {
  const importBox = root.querySelector('#campusImportBox');

  function render() {
    const profile = getProfile();
    const rank = getCampusRank(profile.xp);
    setText(root, '#campusRank', rank.name);
    setText(root, '#campusXp', `${profile.xp} XP`);
    setText(root, '#campusNextRank', rank.next ? `${rank.next.name} · ${rank.next.xp - profile.xp} XP до ранга` : 'МАКСИМАЛЬНЫЙ РАНГ');
    root.querySelector('#campusRankBar').style.width = `${Math.round(rank.progress * 100)}%`;
    setText(root, '#campusContractCount', `${profile.completedContracts.length}/18`);
    setText(root, '#campusPythonCount', `${profile.labs.python.completed.length}/36`);
    setText(root, '#campusAiState', profile.labs.ai.completed ? `ГОТОВО · ${Math.round(profile.labs.ai.bestAccuracy * 100)}% eval` : 'ДОСТУПНО');
    setText(root, '#campusModelState', profile.labs.ai.completed ? `${profile.labs.model.completedDatasets.length}/3 DATASETS` : 'ПОСЛЕ AI-ПОЛИГОНА');
    setText(root, '#campusNeuralState', profile.labs.neural.completed ? `ГОТОВО · ${Math.round(profile.labs.neural.bestAccuracy * 100)}%` : 'ПОСЛЕ 3 DATASETS');
    setText(root, '#campusLlmState', profile.labs.llm.completed ? `ГОТОВО · ${profile.labs.llm.missions}/4 evals` : 'ДОСТУПНО');
    setText(root, '#campusRetrievalState', profile.labs.retrieval.completed ? `ГОТОВО · ${profile.labs.retrieval.completedMissions.length}/3` : 'ПОСЛЕ LLM WRAPPER');
    setText(root, '#campusBotState', profile.labs.bot.completed ? `ГОТОВО · ${profile.labs.bot.completedMissions.length}/4 builds` : 'ПОСЛЕ NEURAL + RAG');
    setText(root, '#campusAutomationState', profile.labs.automation.completed ? `ГОТОВО · ${profile.labs.automation.completedMissions.length}/4 blueprints` : `${profile.labs.python.completed.length}/12 PYTHON`);
    setText(root, '#campusFactoryState', profile.labs.factory.completed ? `MASTERED · SCORE ${profile.labs.factory.bestScore}` : 'ПОСЛЕ BOT FORGE + AUTOMATION LAB');
    setText(root, '#campusSimnetState', profile.labs.simnet.completed ? `MASTERED · ${profile.labs.simnet.incidentSeeds.length} INCIDENTS` : 'ПОСЛЕ MY AI FACTORY');
    setText(root, '#campusNexusState', `${profile.labs.nexus.completedMissions.length}/6 АРОК · ${profile.labs.nexus.trialSeeds.length} ∞ СМЕН`);
    setText(root, '#campusDeskState', `${profile.labs.desk.completedMissions.length}/5 CASES · ${profile.labs.desk.incidentSeeds.length} ∞ DESK SHIFTS`);
    setText(root, '#campusWorldState', `${profile.labs.world.completedStories.length}/6 ИСТОРИЙ · ${profile.labs.world.shiftSeeds.length} ∞ CITY SHIFTS`);
    setText(root, '#campusCommonsState', `${profile.labs.commons.completedBriefs.length}/4 BLUEPRINTS · ${profile.labs.commons.daySeeds.length} ∞ CITY DAYS${profile.labs.commons.codeDeployed?' · PY DEPLOYED':''}`);
    setText(root, '#campusOperationsState', `${profile.labs.operations.completedArcs.length}/5 RELEASES · ${profile.labs.operations.shiftSeeds.length} ∞ RELEASE SHIFTS${profile.labs.operations.codeDeployed?' · GUARD PY':''}`);
    setText(root, '#campusChronicleState', `${profile.labs.chronicle.completedArcs.length}/5 ИСТОРИЙ · ${profile.labs.chronicle.windowSeeds.length} ∞ WINDOWS${profile.labs.chronicle.codeDeployed?' · MIGRATION PY':''}`);
    setText(root, '#campusWeaveState', `${profile.labs.weave.completedArcs.length}/5 СМЕН · ${profile.labs.weave.seasonSeeds.length} ∞ СЕЗОНОВ${profile.labs.weave.codeDeployed?' · GOVERNOR PY':''}`);
    setText(root, '#campusThreadsState', `${profile.labs.threads.completedEpisodes.length}/10 СМЕН · ${profile.labs.threads.cycleSeeds.length} ∞ ЦИКЛОВ${profile.labs.threads.codeDeployed?' · ORCHESTRATOR PY':''}`);
    const guildCredits = Object.values(profile.labs.guild?.creditLedger ?? {}).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
    setText(root, '#campusGuildState', `${profile.labs.guild?.completedQuests?.length ?? 0}/10 QUESTS · ${profile.labs.guild?.realmWins?.length ?? 0}/7 WORLDS · ${profile.labs.guild?.jobSeeds?.length ?? 0} JOBS · ${guildCredits} CR`);
    root.querySelector('[data-campus-branch="ai"]').dataset.done = String(profile.labs.ai.completed);
    const modelButton = root.querySelector('[data-campus-branch="model"]');
    modelButton.dataset.done = String(profile.labs.model.completedDatasets.length >= 3);
    modelButton.disabled = !profile.labs.ai.completed;
    modelButton.title = profile.labs.ai.completed ? '' : 'Сначала пройди AI-полигон и разберись с dataset/eval.';
    const neuralButton = root.querySelector('[data-campus-branch="neural"]');
    neuralButton.dataset.done = String(profile.labs.neural.completed);
    neuralButton.disabled = profile.labs.model.completedDatasets.length < 3;
    neuralButton.title = neuralButton.disabled ? 'Сначала освой три набора в Model Workbench.' : '';
    const llmButton = root.querySelector('[data-campus-branch="llm"]');
    llmButton.dataset.done = String(profile.labs.llm.completed);
    llmButton.disabled = !profile.labs.ai.completed;
    llmButton.title = profile.labs.ai.completed ? '' : 'Сначала закончи AI-полигон: eval и feedback нужны в LLM-главе.';
    if (!profile.labs.ai.completed) setText(root, '#campusLlmState', 'ПОСЛЕ AI-ПОЛИГОНА');
    const retrievalButton = root.querySelector('[data-campus-branch="retrieval"]');
    retrievalButton.dataset.done = String(profile.labs.retrieval.completed);
    retrievalButton.disabled = !profile.labs.llm.completed;
    retrievalButton.title = retrievalButton.disabled ? 'Сначала собери безопасную LLM-обёртку.' : '';
    const botButton = root.querySelector('[data-campus-branch="bot"]');
    botButton.dataset.done = String(profile.labs.bot.completed);
    botButton.disabled = !(profile.labs.neural.completed && profile.labs.retrieval.completed && profile.labs.llm.completed);
    botButton.title = botButton.disabled ? 'Bot Forge требует Neural Foundry, Retrieval Warehouse и LLM wrapper.' : '';
    const automationButton = root.querySelector('[data-campus-branch="automation"]');
    automationButton.dataset.done = String(profile.labs.automation.completed);
    automationButton.disabled = profile.labs.python.completed.length < 12;
    automationButton.title = automationButton.disabled ? 'Сначала закрой хотя бы 12 Python-контрактов: реальные границы требуют кода.' : '';
    const factoryButton = root.querySelector('[data-campus-branch="factory"]');
    factoryButton.dataset.done = String(profile.labs.factory.completed);
    factoryButton.disabled = !(profile.labs.bot.completed && profile.labs.automation.completed);
    factoryButton.title = factoryButton.disabled ? 'My AI Factory требует Bot Forge и Automation Lab.' : '';
    const simnetButton = root.querySelector('[data-campus-branch="simnet"]');
    simnetButton.dataset.done = String(profile.labs.simnet.completed);
    simnetButton.disabled = !profile.labs.factory.completed;
    simnetButton.title = simnetButton.disabled ? 'SIMNET открывается после первого полного AI Factory master eval.' : '';
    root.querySelector('[data-campus-branch="systems"]').dataset.done = String(profile.completedContracts.length >= 18);
    root.querySelector('[data-campus-branch="python"]').dataset.done = String(profile.labs.python.completed.length >= 36);
    root.querySelector('[data-campus-branch="nexus"]').dataset.done = String(profile.labs.nexus.completedMissions.length >= 6);
    root.querySelector('[data-campus-branch="desk"]').dataset.done = String(profile.labs.desk.completedMissions.length >= 5);
    root.querySelector('[data-campus-branch="world"]').dataset.done = String(profile.labs.world.completedStories.length >= 6);
    const commonsButton = root.querySelector('[data-campus-branch="commons"]');
    commonsButton.dataset.done = String(profile.labs.commons.completedBriefs.length >= 4 && profile.labs.commons.codeDeployed);
    commonsButton.disabled = profile.labs.world.completedStories.length < 6;
    commonsButton.title = commonsButton.disabled ? 'Сначала проживи шесть историй WORLD GRID: автоматизировать имеет смысл то, что ты уже понимаешь.' : '';
    const operationsButton = root.querySelector('[data-campus-branch="operations"]');
    operationsButton.dataset.done = String(profile.labs.operations.completedArcs.length >= 5 && profile.labs.operations.codeDeployed);
    operationsButton.disabled = !profile.labs.commons.codeDeployed;
    operationsButton.title = operationsButton.disabled ? 'Сначала доведи Automation Commons до Python-autopilot: обслуживать в проде имеет смысл то, что уже живёт само.' : '';
    const chronicleButton = root.querySelector('[data-campus-branch="chronicle"]');
    chronicleButton.dataset.done = String(profile.labs.chronicle.completedArcs.length >= 5 && profile.labs.chronicle.codeDeployed);
    chronicleButton.disabled = !(profile.labs.operations.completedArcs.length >= 5 && profile.labs.operations.codeDeployed);
    chronicleButton.title = chronicleButton.disabled ? 'Сначала проживи RELEASE WEEK и формализуй release guard: историю стоит обслуживать после того, как система уже умеет безопасно меняться.' : '';
    const weaveButton = root.querySelector('[data-campus-branch="weave"]');
    weaveButton.dataset.done = String(profile.labs.weave.completedArcs.length >= 5 && profile.labs.weave.codeDeployed);
    weaveButton.disabled = !(profile.labs.chronicle.completedArcs.length >= 5 && profile.labs.chronicle.codeDeployed);
    weaveButton.title = weaveButton.disabled ? 'Сначала проживи CITY CHRONICLE и формализуй migration policy: живой город начинается после того, как ты уже умеешь понимать прошлое системы.' : '';
    const guildButton = root.querySelector('[data-campus-branch="guild"]');
    guildButton.dataset.done = String((profile.labs.guild?.completedQuests?.length ?? 0) >= 6 && (profile.labs.guild?.completedRaids?.length ?? 0) >= 1);
    guildButton.disabled = false;
    guildButton.title = 'Свободный хаб: выбери профессию и начни с любой стартовой работы.';
    const threadsButton = root.querySelector('[data-campus-branch="threads"]');
    threadsButton.dataset.done = String(profile.labs.threads.completedEpisodes.length >= 10 && profile.labs.threads.codeDeployed);
    threadsButton.disabled = !(profile.labs.weave.completedArcs.length >= 5 && profile.labs.weave.codeDeployed);
    threadsButton.title = threadsButton.disabled ? 'Сначала проживи CITY WEAVE и напиши governor: длинная история начинается после того, как город уже умеет жить на твоих компромиссах.' : '';
  }

  function openChild(fn) {
    root.hidden = true;
    fn?.();
  }

  root.querySelector('[data-campus-branch="systems"]').addEventListener('click', () => openChild(onOpenContracts));
  root.querySelector('[data-campus-branch="python"]').addEventListener('click', () => openChild(onOpenPython));
  root.querySelector('[data-campus-branch="ai"]').addEventListener('click', () => openChild(onOpenAi));
  root.querySelector('[data-campus-branch="model"]').addEventListener('click', () => openChild(onOpenModel));
  root.querySelector('[data-campus-branch="neural"]').addEventListener('click', () => openChild(onOpenNeural));
  root.querySelector('[data-campus-branch="llm"]').addEventListener('click', () => openChild(onOpenLlm));
  root.querySelector('[data-campus-branch="retrieval"]').addEventListener('click', () => openChild(onOpenRetrieval));
  root.querySelector('[data-campus-branch="bot"]').addEventListener('click', () => openChild(onOpenBot));
  root.querySelector('[data-campus-branch="automation"]').addEventListener('click', () => openChild(onOpenAutomation));
  root.querySelector('[data-campus-branch="factory"]').addEventListener('click', () => openChild(onOpenFactory));
  root.querySelector('[data-campus-branch="simnet"]').addEventListener('click', () => openChild(onOpenSimnet));
  root.querySelector('[data-campus-branch="nexus"]').addEventListener('click', () => openChild(onOpenNexus));
  root.querySelector('[data-campus-branch="desk"]').addEventListener('click', () => openChild(onOpenDesk));
  root.querySelector('[data-campus-branch="world"]').addEventListener('click', () => openChild(onOpenWorld));
  root.querySelector('[data-campus-branch="commons"]').addEventListener('click', () => openChild(onOpenCommons));
  root.querySelector('[data-campus-branch="operations"]').addEventListener('click', () => openChild(onOpenOperations));
  root.querySelector('[data-campus-branch="chronicle"]').addEventListener('click', () => openChild(onOpenChronicle));
  root.querySelector('[data-campus-branch="weave"]').addEventListener('click', () => openChild(onOpenWeave));
  root.querySelector('[data-campus-branch="threads"]').addEventListener('click', () => openChild(onOpenThreads));
  root.querySelector('[data-campus-branch="guild"]').addEventListener('click', () => openChild(onOpenGuild));

  root.querySelector('#campusExport').addEventListener('click', async () => {
    const code = exportCampusProfile(getProfile());
    try {
      await navigator.clipboard.writeText(code);
      setText(root, '#campusSyncStatus', 'КОД ПРОГРЕССА СКОПИРОВАН · этот же JSON позже сможет хранить аккаунт');
      onSound('reward');
    } catch {
      importBox.hidden = false;
      importBox.value = code;
      importBox.select();
      setText(root, '#campusSyncStatus', 'Clipboard недоступен · код прогресса показан в поле ниже');
    }
  });

  root.querySelector('#campusImportToggle').addEventListener('click', () => {
    importBox.hidden = !importBox.hidden;
    if (!importBox.hidden) importBox.focus();
  });

  root.querySelector('#campusImport').addEventListener('click', () => {
    try {
      const incoming = JSON.parse(importBox.value);
      const merged = mergeCampusProfile(getProfile(), incoming);
      onProfile({ type:'replace', profile:merged });
      render();
      setText(root, '#campusSyncStatus', 'ПРОГРЕСС ОБЪЕДИНЁН · закрытые задачи и лучшие результаты не потеряны');
      onSound('reward');
    } catch {
      setText(root, '#campusSyncStatus', 'Не удалось прочитать код прогресса. Нужен JSON, который создал QueQuest.');
      onSound('blocked');
    }
  });

  return {
    open() { render(); root.hidden = false; root.querySelector('[data-campus-branch="guild"]').focus({preventScroll:true}); },
    close() { root.hidden = true; },
    refresh: render,
  };
}
