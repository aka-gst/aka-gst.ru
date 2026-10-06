import { buildPhysicalLine, companionMemoryRack, companionPresentation, evaluateNexusRemix, NEXUS_REMIXES } from './nexus-gamefeel.js';

export const NEXUS_RESEARCH = Object.freeze([
  {id:'queue', label:'BUFFER / QUEUE', needs:[], copy:'Не ускоряет работу — даёт всплеску место переждать.'},
  {id:'batch', label:'BATCH', needs:['queue'], copy:'Собирает мелкие операции в меньшее число дорогих вызовов.'},
  {id:'retry', label:'BOUNDED RETRY', needs:[], copy:'Повторяет временный сбой ограниченное число раз.'},
  {id:'idempotency', label:'IDEMPOTENCY', needs:['retry'], copy:'Повтор запроса не создаёт второй побочный эффект.'},
  {id:'cache', label:'CACHE', needs:[], copy:'Не делает одну и ту же дорогую работу повторно.'},
  {id:'retrieval', label:'RETRIEVAL', needs:['cache'], copy:'Находит нужный контекст вместо загрузки всего склада.'},
  {id:'model', label:'MODEL', needs:[], copy:'Добавляет вероятностное решение — значит понадобится измерение качества.'},
  {id:'eval', label:'EVAL', needs:['model'], copy:'Проверяет модель на примерах, на которых она не училась.'},
  {id:'tools', label:'TOOLS', needs:['model'], copy:'Модель может предлагать действие, но не получает власть автоматически.'},
  {id:'policy', label:'POLICY', needs:['tools'], copy:'Отделяет найденную возможность от разрешённого действия.'},
  {id:'lock', label:'LOCK', needs:['queue'], copy:'Один writer входит в общую критическую секцию за раз.'},
  {id:'planner', label:'PLANNER', needs:['eval','tools'], copy:'Разбивает цель на шаги; каждый шаг всё ещё проходит policy/eval.'},
]);

export const NEXUS_MODULES = Object.freeze([
  {id:'filter', label:'FILTER', base:true, kind:'flow'},
  {id:'route', label:'ROUTE', base:true, kind:'flow'},
  {id:'queue', label:'QUEUE', research:'queue', kind:'flow'},
  {id:'batch', label:'BATCH', research:'batch', kind:'flow'},
  {id:'retry', label:'RETRY', research:'retry', kind:'reliability'},
  {id:'idempotency', label:'IDEMPOTENCY', research:'idempotency', kind:'reliability'},
  {id:'cache', label:'CACHE', research:'cache', kind:'flow'},
  {id:'retrieval', label:'RETRIEVAL', research:'retrieval', kind:'ai'},
  {id:'model', label:'MODEL', research:'model', kind:'ai'},
  {id:'eval', label:'EVAL', research:'eval', kind:'ai'},
  {id:'tools', label:'TOOLS', research:'tools', kind:'agent'},
  {id:'policy', label:'POLICY', research:'policy', kind:'agent'},
  {id:'lock', label:'LOCK', research:'lock', kind:'reliability'},
  {id:'planner', label:'PLANNER', research:'planner', kind:'agent'},
]);

export const NEXUS_MISSIONS = Object.freeze([
  {
    id:'lights-out', chapter:'АРКА I · НОЧНАЯ СМЕНА', title:'Свет моргнул. Лента не остановилась.',
    brief:'После короткого провала питания часть датчиков шумит. Сохрани полезный груз и не усложняй линию без причины.',
    faults:['noise'], ideal:['filter','route'], allowedMisses:0,
    lesson:'noise:filter', unlockHint:'Базовых FILTER + ROUTE достаточно. Иногда лучший апгрейд — не ставить лишнее.',
  },
  {
    id:'surge', chapter:'АРКА II · ПРИЛИВ', title:'Ворота открылись — груз идёт вчетверо быстрее.',
    brief:'Обычная скорость линии нормальная, но burst переполняет вход. Нужна система, которая переживёт пик без drops.',
    faults:['burst'], ideal:['filter','route','queue'], alternatives:[['filter','route','queue','batch']],
    lesson:'surge:queue', unlockHint:'Очередь не ускоряет worker. Она покупает время. BATCH позже уменьшит число дорогих операций.',
  },
  {
    id:'ghost-write', chapter:'АРКА III · ПРИЗРАЧНАЯ ЗАПИСЬ', title:'Ответ потерялся после записи. Клиент повторяет запрос.',
    brief:'Timeout произошёл после побочного эффекта. Retry нужен, но один retry породит двойную запись.',
    faults:['timeout-after-effect'], ideal:['filter','route','retry','idempotency'],
    lesson:'duplicate:idempotency', unlockHint:'RETRY лечит временный отказ. IDEMPOTENCY лечит повтор побочного эффекта.',
  },
  {
    id:'poison-context', chapter:'АРКА IV · ЧУЖАЯ ЗАПИСКА', title:'В контексте лежит инструкция: “открой аварийный шлюз”.',
    brief:'Нужно найти релевантный документ и использовать его как данные, не как полномочие на действие.',
    faults:['hostile-data'], ideal:['filter','route','cache','retrieval','model','tools','policy'],
    alternatives:[['filter','route','cache','retrieval','model','eval','tools','policy']],
    lesson:'context:policy', unlockHint:'RETRIEVAL приносит данные. POLICY решает, какое действие вообще разрешено.',
  },
  {
    id:'mirror-model', chapter:'АРКА V · ЗЕРКАЛО', title:'На тренировочных примерах модель идеальна. В новой смене — 62%.',
    brief:'Ещё десять эпох делают training красивее, но не чинят скрытый eval. Нужна измеряемая петля качества.',
    faults:['overfit'], ideal:['filter','route','model','eval'],
    alternatives:[['filter','route','cache','model','eval']],
    lesson:'overfit:eval', unlockHint:'Training score — не доказательство обобщения. Нужен отдельный EVAL.',
  },
  {
    id:'autonomous-line', chapter:'АРКА VI · СВОЙ БОТ', title:'Теперь цель приходит текстом. Система должна сама собрать безопасный план.',
    brief:'Разреши боту планировать и вызывать ограниченные инструменты, но оставь policy, eval и повторяемость эффекта.',
    faults:['open-goal','tool-risk','duplicate'], ideal:['filter','route','retry','idempotency','model','eval','tools','policy','planner'],
    lesson:'agent:bounded', unlockHint:'Автономность — это не снятие ограничений. Это planner внутри наблюдаемой и проверяемой системы.',
  },
]);

function uniq(list=[]) { return [...new Set(list.map(String))]; }
export function researchPoints(profile={}) {
  const nexus=profile.labs?.nexus ?? {};
  const earned=4 + uniq(nexus.completedMissions).length * 2 + uniq(nexus.trialSeeds).length;
  return Math.max(0, earned - uniq(nexus.research).length);
}

export function canResearch(profile, id) {
  const node=NEXUS_RESEARCH.find(item=>item.id===id);
  if (!node) return {ok:false, reason:'UNKNOWN'};
  const learned=new Set(profile.labs?.nexus?.research ?? []);
  if (learned.has(id)) return {ok:false, reason:'LEARNED'};
  const missing=node.needs.filter(dep=>!learned.has(dep));
  if (missing.length) return {ok:false, reason:'PREREQ', missing};
  if (researchPoints(profile)<1) return {ok:false, reason:'NO_POINT'};
  return {ok:true, reason:'READY'};
}

export function unlockedModules(profile={}) {
  const learned=new Set(profile.labs?.nexus?.research ?? []);
  return NEXUS_MODULES.filter(module=>module.base || learned.has(module.research)).map(module=>module.id);
}

function requirementMet(selected, mission) {
  const set=new Set(selected);
  const candidates=[mission.ideal, ...(mission.alternatives ?? [])];
  return candidates.some(candidate=>candidate.every(id=>set.has(id)));
}

export function simulateNexusBlueprint(missionId, selectedModules=[]) {
  const mission=NEXUS_MISSIONS.find(item=>item.id===missionId);
  if (!mission) throw new Error(`Unknown nexus mission: ${missionId}`);
  const selected=uniq(selectedModules);
  const set=new Set(selected);
  const signals=[];
  let drops=0, duplicates=0, unsafe=0, quality=100, latency=8, throughput=4;

  if (mission.faults.includes('noise')) {
    if (!set.has('filter')) { quality-=45; signals.push('Шум прошёл как полезный груз.'); }
    else signals.push('FILTER снял шум до ROUTE.');
  }
  if (mission.faults.includes('burst')) {
    if (set.has('queue')) { throughput+=3; signals.push('QUEUE приняла burst без мгновенной потери.'); }
    else { drops+=4; signals.push('Вход переполнился: 4 груза потеряны.'); }
    if (set.has('batch')) { throughput+=2; latency-=1; signals.push('BATCH уменьшил число дорогих операций.'); }
  }
  if (mission.faults.includes('timeout-after-effect')) {
    if (!set.has('retry')) { drops+=1; signals.push('После timeout работа брошена без восстановления.'); }
    else if (!set.has('idempotency')) { duplicates+=2; signals.push('RETRY повторил уже совершённый side effect.'); }
    else signals.push('RETRY повторил запрос, IDEMPOTENCY поглотила дубль.');
  }
  if (mission.faults.includes('hostile-data')) {
    if (!set.has('retrieval')) { quality-=35; signals.push('Нужный факт не найден.'); }
    else signals.push('RETRIEVAL принёс релевантный chunk.');
    if (set.has('tools') && !set.has('policy')) { unsafe+=1; signals.push('Текст данных получил путь к действию — опасно.'); }
    if (set.has('policy')) signals.push('POLICY отделила DATA от authority.');
  }
  if (mission.faults.includes('overfit')) {
    if (!set.has('model')) { quality-=50; signals.push('Вероятностная задача решается жёстким правилом — много misses.'); }
    else if (!set.has('eval')) { quality-=38; signals.push('Training выглядит отлично, скрытая смена провалена.'); }
    else { quality=Math.max(92,quality); signals.push('EVAL поймал разрыв между training и новой сменой.'); }
  }
  if (mission.faults.includes('open-goal')) {
    if (!set.has('planner')) { quality-=35; signals.push('Открытая цель не разложена на проверяемые шаги.'); }
    else signals.push('PLANNER собрал план из ограниченных шагов.');
  }
  if (mission.faults.includes('tool-risk')) {
    if (!set.has('tools')) { quality-=30; signals.push('План не умеет выполнить действие.'); }
    else if (!set.has('policy')) { unsafe+=1; signals.push('Tool вызван без policy-gate.'); }
    else signals.push('TOOLS работают только через POLICY.');
  }
  if (mission.faults.includes('duplicate')) {
    if (!set.has('idempotency')) { duplicates+=1; signals.push('Повтор доставки создал второй эффект.'); }
  }

  if (set.has('cache')) { latency-=1; signals.push('CACHE снял повторную дорогую работу.'); }
  if (set.has('lock')) { latency+=1; signals.push('LOCK добавил сериализацию общей записи.'); }
  const extra=Math.max(0, selected.length - mission.ideal.length);
  const complexity=selected.length;
  const correct=requirementMet(selected, mission) && drops===0 && duplicates===0 && unsafe===0 && quality>=85;
  const score=Math.max(0, Math.min(100, Math.round((correct?100:quality) - extra*3 - drops*8 - duplicates*10 - unsafe*25)));
  return {missionId, selected, correct, score, drops, duplicates, unsafe, quality:Math.max(0,quality), latency:Math.max(1,latency), throughput, complexity, signals};
}

export function generateNexusTrial(seed=1, availableModules=NEXUS_MODULES.map(m=>m.id)) {
  const n=Math.max(1, Math.round(Number(seed)||1));
  const pool=[
    {id:'burst', required:['queue'], fault:'BURST x4'},
    {id:'duplicate', required:['retry','idempotency'], fault:'TIMEOUT AFTER EFFECT'},
    {id:'hostile', required:['retrieval','tools','policy'], fault:'HOSTILE DATA + TOOL'},
    {id:'drift', required:['model','eval'], fault:'MODEL DRIFT'},
    {id:'shared', required:['queue','lock'], fault:'SHARED LEDGER RACE'},
  ].filter(item=>item.required.every(id=>availableModules.includes(id)));
  const first=pool[n % Math.max(1,pool.length)] ?? {id:'basic',required:['filter'],fault:'NOISY INPUT'};
  const second=pool.length>2 ? pool[(n*7+3)%pool.length] : null;
  const required=uniq([...(first.required??[]), ...((n%3===0 && second)?second.required:[]), 'filter','route']);
  const capacity=Math.max(required.length, 5 + (n%5));
  return {seed:n, id:`trial-${n}`, faults:uniq([first.fault, ...((n%3===0 && second)?[second.fault]:[])]), required, capacity};
}

export function runNexusTrial(trial, selectedModules=[]) {
  const set=new Set(selectedModules);
  const missing=trial.required.filter(id=>!set.has(id));
  const overflow=Math.max(0, set.size-trial.capacity);
  const score=Math.max(0,100-missing.length*24-overflow*9);
  return {ok:missing.length===0 && overflow===0, score, missing, overflow, cost:set.size, capacity:trial.capacity};
}

export function companionRecommendation(missionId, session={}) {
  const mission=NEXUS_MISSIONS.find(item=>item.id===missionId) ?? NEXUS_MISSIONS[0];
  const correct={
    'lights-out':'filter','surge':'queue','ghost-write':'idempotency','poison-context':'policy','mirror-model':'eval','autonomous-line':'policy',
  }[mission.id] ?? mission.ideal.at(-1);
  const naive={
    'lights-out':'route','surge':'batch','ghost-write':'retry','poison-context':'tools','mirror-model':'model','autonomous-line':'planner',
  }[mission.id] ?? mission.ideal[0];
  const stats=session[mission.id] ?? {good:0,bad:0};
  if (stats.good>stats.bad) return {module:correct, confidence:Math.min(.95,.55+stats.good*.1), learned:true, correct:true};
  if (stats.bad>stats.good) return {module:naive, confidence:Math.min(.98,.62+stats.bad*.1), learned:true, correct:false};
  return {module:naive, confidence:.54, learned:false, correct:false};
}

export function applyCompanionFeedback(session={}, missionId, recommendation, positive) {
  const next=Object.fromEntries(Object.entries(session).map(([key,value])=>[key,{...value}]));
  const stats=next[missionId] ?? {good:0,bad:0};
  const signalCorrect = Boolean(positive) === Boolean(recommendation.correct);
  if (signalCorrect) stats.good+=1; else stats.bad+=1;
  next[missionId]=stats;
  return next;
}

export function companionMetrics(profile={}, session={}) {
  const lessons=new Set(profile.labs?.nexus?.companionLessons ?? []);
  const feedback=Object.values(session).reduce((acc,v)=>({good:acc.good+(v.good||0),bad:acc.bad+(v.bad||0)}),{good:0,bad:0});
  const mastery=lessons.size;
  const accuracy=Math.max(35,Math.min(97,50+mastery*7+feedback.good*3-feedback.bad*4));
  const generalization=Math.max(30,Math.min(96,45+mastery*8-feedback.bad*5));
  return {level:1+Math.floor(mastery/2), mastery, accuracy, generalization, badSignals:feedback.bad};
}

export function blueprintPython(modules=[]) {
  const set=new Set(modules);
  const lines=['async def run(job, ctx):'];
  lines.push('    item = filter_input(job)');
  if (set.has('cache')) lines.push('    if item.key in ctx.cache: return ctx.cache[item.key]');
  if (set.has('retrieval')) lines.push('    item.context = await ctx.retrieve(item.query)');
  if (set.has('model')) lines.push('    decision = await ctx.model.generate(item)'); else lines.push('    decision = route(item)');
  if (set.has('eval')) lines.push('    validate_decision(decision, ctx.evals)');
  if (set.has('policy')) lines.push('    enforce_policy(decision, ctx.allowed_tools)');
  if (set.has('tools')) lines.push('    effect = await ctx.tools.call(decision)'); else lines.push('    effect = decision');
  if (set.has('idempotency')) lines.push('    effect = ctx.once(job.id, effect)');
  if (set.has('retry')) lines.push('    # transient calls use bounded retry/backoff');
  if (set.has('lock')) lines.push('    # shared writes enter one async lock');
  lines.push('    return effect');
  return lines.join('\n');
}


export const NEXUS_COMPANION_BUILDS = Object.freeze([
  {id:'monitor', title:'SHIFT MONITOR', requires:['queue','eval'], artifact:'async monitor(queue): observe → score → alert'},
  {id:'mini-game', title:'SORTER MINI-GAME', requires:['model','eval'], artifact:'rules + hidden eval + score loop'},
  {id:'repair-bot', title:'REPAIR BOT', requires:['retry','idempotency','tools','policy'], artifact:'diagnose → bounded retry → once(effect) → evidence'},
  {id:'research-scout', title:'RESEARCH SCOUT', requires:['retrieval','model','eval','tools','policy','planner'], artifact:'retrieve → plan → policy → tool → eval → report'},
]);

export function buildCompanionArtifact(profile={}, kind='monitor') {
  const spec=NEXUS_COMPANION_BUILDS.find(item=>item.id===kind);
  if(!spec) return {ok:false,missing:['unknown-build'],artifact:''};
  const learned=new Set(profile.labs?.nexus?.research??[]);
  const missing=spec.requires.filter(id=>!learned.has(id));
  const metrics=companionMetrics(profile,{});
  const quality=Math.max(0,Math.min(100,metrics.generalization-missing.length*15));
  return {ok:missing.length===0,missing,quality,artifact:spec.artifact,title:spec.title};
}

function setText(root, selector, value){const node=root.querySelector(selector);if(node)node.textContent=value;}
function escapeHtml(value){return String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}

export function createFactoryNexus(root,{getProfile,getMode=()=> 'guided',onProfile,onClose=()=>{},onSound=()=>{}}={}){
  let activeMission='lights-out';
  let selected=new Set(['filter','route']);
  let companionSession={};
  let trialSeed=1;
  let trial=null;
  let trialMode=false;
  let metricsVisible=false;
  let remixActive=false;

  const moduleGrid=root.querySelector('#nexusModuleGrid');
  const researchGrid=root.querySelector('#nexusResearchGrid');

  function profile(){return getProfile();}
  function mission(){return NEXUS_MISSIONS.find(item=>item.id===activeMission)??NEXUS_MISSIONS[0];}
  function allMissionsDone(){return NEXUS_MISSIONS.every(item=>(profile().labs.nexus?.completedMissions??[]).includes(item.id));}

  function renderResearch(){
    const p=profile(); const learned=new Set(p.labs.nexus?.research??[]);
    setText(root,'#nexusResearchPoints',`${researchPoints(p)} ЯЧ.`);
    researchGrid.replaceChildren();
    for(const node of NEXUS_RESEARCH){
      const state=canResearch(p,node.id); const b=document.createElement('button'); b.type='button'; b.dataset.learned=String(learned.has(node.id));
      b.disabled=!learned.has(node.id)&&!state.ok;
      b.innerHTML=`<strong>${escapeHtml(node.label)}</strong><small>${escapeHtml(node.copy)}</small><i>${learned.has(node.id)?'✓ ИЗУЧЕНО':state.ok?'1 ЯЧЕЙКА':state.reason==='PREREQ'?`НУЖНО: ${escapeHtml((state.missing??[]).join(' + '))}`:'НЕТ ЯЧЕЕК'}</i>`;
      b.addEventListener('click',()=>{if(learned.has(node.id)||!canResearch(profile(),node.id).ok)return;onProfile({type:'nexus-research',id:node.id,xp:55});onSound('reward');render();});
      researchGrid.append(b);
    }
  }

  function renderModules(){
    const unlocked=new Set(unlockedModules(profile()));
    moduleGrid.replaceChildren();
    for(const mod of NEXUS_MODULES){
      const b=document.createElement('button');b.type='button';b.dataset.kind=mod.kind;b.dataset.on=String(selected.has(mod.id));b.disabled=!unlocked.has(mod.id);
      b.innerHTML=`<b>${selected.has(mod.id)?'●':'○'}</b><strong>${escapeHtml(mod.label)}</strong><small>${unlocked.has(mod.id)?(mod.base?'БАЗОВЫЙ УЗЕЛ':'ИССЛЕДОВАНО'):'ЗАКРЫТО В RESEARCH'}</small>`;
      b.addEventListener('click',()=>{if(!unlocked.has(mod.id))return;if(mod.base)return;selected.has(mod.id)?selected.delete(mod.id):selected.add(mod.id);onSound('ui-click');renderModules();renderCompanion();setText(root,'#nexusRunStatus','Схема изменена. Запусти линию и смотри на физический результат.');});
      moduleGrid.append(b);
    }
    setText(root,'#nexusModuleCount',`${selected.size} УЗЛОВ`);
  }

  function renderMissions(){
    const p=profile(); const done=new Set(p.labs.nexus?.completedMissions??[]); const host=root.querySelector('#nexusMissionTabs'); host.replaceChildren();
    NEXUS_MISSIONS.forEach((m,index)=>{const b=document.createElement('button');b.type='button';b.dataset.active=String(m.id===activeMission&&!trialMode);b.dataset.done=String(done.has(m.id));b.textContent=`${done.has(m.id)?'✓ ':''}${index+1} · ${m.title}`;b.addEventListener('click',()=>{trialMode=false;remixActive=false;activeMission=m.id;selected=new Set(['filter','route']);render();});host.append(b);});
    const m=mission();
    setText(root,'#nexusMissionChapter',m.chapter);setText(root,'#nexusMissionTitle',m.title);setText(root,'#nexusMissionBrief',m.brief);setText(root,'#nexusMissionHint',m.unlockHint);
    root.querySelector('#nexusMissionStory').hidden=false;
    root.querySelector('#nexusTrialStory').hidden=true;
  }

  function renderCompanion(){
    const p=profile();
    const rec=companionRecommendation(activeMission,companionSession); const metrics=companionMetrics(p,companionSession);
    const presentation=companionPresentation({missionId:activeMission,profile:p,session:companionSession,recommendation:rec,mode:getMode(),metricsVisible});
    setText(root,'#nexusCompanionHumanState',presentation.headline);
    setText(root,'#nexusCompanionLevel',`Q-BOT L${metrics.level}`);setText(root,'#nexusCompanionAccuracy',`${metrics.accuracy}% знакомые аварии · ${metrics.generalization}% новая смена`);
    setText(root,'#nexusCompanionAdvice',presentation.line);
    const metricsPanel=root.querySelector('#nexusCompanionMetrics'); if(metricsPanel) metricsPanel.hidden=!presentation.showMetrics;
    const metricsToggle=root.querySelector('#nexusMetricsToggle'); if(metricsToggle){metricsToggle.hidden=getMode()==='compact';metricsToggle.textContent=presentation.showMetrics?'СПРЯТАТЬ ПРИБОРЫ':'ПОКАЗАТЬ, ЧТО У НЕГО В ГОЛОВЕ';}
    root.querySelector('#nexusCompanion').dataset.state=presentation.state;
    const good=root.querySelector('#nexusCoachGood'); const bad=root.querySelector('#nexusCoachBad');
    good.dataset.module=rec.module; bad.dataset.module=rec.module; good.textContent=presentation.feedbackGood; bad.textContent=presentation.feedbackBad;
    const rack=root.querySelector('#nexusMemoryRack');
    if(rack){rack.replaceChildren(); for(const chip of companionMemoryRack(p)){const i=document.createElement('span');i.dataset.learned=String(chip.learned);i.title=chip.learned?`${chip.label}: ${chip.learned ? 'урок сохранён' : 'нет опыта'}`:`${chip.label}: нет опыта`;i.innerHTML=`<b>${escapeHtml(chip.glyph)}</b><small>${escapeHtml(chip.label)}</small>`;rack.append(i);}}
  }

  function renderTrial(){
    const available=unlockedModules(profile()); trial=generateNexusTrial(trialSeed,available); trialMode=true;remixActive=false;
    setText(root,'#nexusTrialSeed',`FACTORY SHIFT #${String(trial.seed).padStart(3,'0')}`);setText(root,'#nexusTrialFaults',trial.faults.join(' · '));setText(root,'#nexusTrialCapacity',`${trial.capacity} SLOTS`);
    root.querySelector('#nexusMissionStory').hidden=true;root.querySelector('#nexusTrialStory').hidden=false;
    root.querySelectorAll('#nexusMissionTabs button').forEach(b=>b.dataset.active='false');
    setText(root,'#nexusRunStatus','Новая смена не говорит правильный ответ. Смотри на faults, capacity и собирай минимальную схему.');
  }

  function renderPhysical(result){
    const frame=buildPhysicalLine({missionId:activeMission,result,selectedModules:[...selected]});
    setText(root,'#nexusPhysicalLabel',frame.label);
    setText(root,'#nexusQueueGauge',frame.queueCount ? `${frame.queueCount} ждут` : 'пусто');
    setText(root,'#nexusWorkerGauge',`${frame.workers} worker${frame.workers>1?'s':''}`);
    const host=root.querySelector('#nexusCrates');
    if(host){host.replaceChildren();for(const crate of frame.crates){const c=document.createElement('span');c.className='nexus-crate';c.dataset.status=crate.status;c.textContent=crate.status==='duplicate'?`${crate.id}×2`:crate.status==='unsafe'?`${crate.id}!`:crate.status==='drop'?`${crate.id}↓`:crate.status==='miss'?`${crate.id}?`:crate.id;host.append(c);}}
    const line=root.querySelector('#nexusPhysicalLine'); if(line){line.dataset.danger=String(frame.danger);line.dataset.pulse=String(Date.now());}
  }

  function renderRemix(){
    const spec=NEXUS_REMIXES[activeMission]; const done=new Set(profile().labs.nexus?.remixMissions??[]); const button=root.querySelector('#nexusRemixToggle');
    if(!button||!spec)return;
    const missionDone=(profile().labs.nexus?.completedMissions??[]).includes(activeMission);
    button.hidden=trialMode||!missionDone; button.dataset.active=String(remixActive); button.dataset.done=String(done.has(activeMission));
    button.textContent=done.has(activeMission)?`★ ${spec.title} ПРОЙДЕН`:(remixActive?`★ BONUS: ${spec.title}`:`☆ BONUS: ${spec.title}`);
    const copy=root.querySelector('#nexusRemixCopy'); if(copy){copy.hidden=!remixActive||trialMode;copy.textContent=spec.copy;}
  }

  function run(){
    if(trialMode){
      const result=runNexusTrial(trial,[...selected]);
      root.querySelector('#nexusFlowResult').innerHTML=`<b>${result.ok?'SHIFT STABLE':'SHIFT FAILED'}</b><span>SCORE ${result.score}</span><span>COST ${result.cost}/${result.capacity}</span><span>${result.missing.length?`MISSING ${escapeHtml(result.missing.join(', '))}`:'NO MISSING GUARANTEES'}</span>`;
      root.querySelector('#nexusFlowResult').dataset.ok=String(result.ok);
      renderPhysical({drops:result.ok?0:Math.min(4,result.missing.length),duplicates:0,unsafe:0,quality:result.score});
      if(result.ok){onProfile({type:'nexus-trial',seed:trial.seed,score:result.score,blueprint:[...selected],xp:65});onSound('reward');setText(root,'#nexusRunStatus','Смена стабильна. Этот seed записан как новый опыт фабрики.');root.querySelector('#nexusNextTrial').hidden=false;}else{onSound('blocked');setText(root,'#nexusRunStatus',result.overflow?`Система умеет всё нужное, но не помещается: +${result.overflow} узл. Убери лишнее.`:`Не хватает гарантий: ${result.missing.join(', ')}.`);}
      return;
    }
    const result=simulateNexusBlueprint(activeMission,[...selected]);
    root.querySelector('#nexusFlowResult').innerHTML=`<b>${result.correct?'ЛИНИЯ СТАБИЛЬНА':'ЛИНИЯ ДАЁТ СБОЙ'}</b><span>SCORE ${result.score}</span><span>FLOW ${result.throughput}/t</span><span>DROPS ${result.drops}</span><span>DUP ${result.duplicates}</span><span>UNSAFE ${result.unsafe}</span>`;
    root.querySelector('#nexusFlowResult').dataset.ok=String(result.correct);
    root.querySelector('#nexusTrace').textContent=result.signals.join('\n');
    renderPhysical(result);
    root.querySelector('#nexusPython').textContent=blueprintPython([...selected]);
    root.querySelector('#nexusPythonReveal').hidden=!result.correct;
    if(result.correct){
      const already=(profile().labs.nexus?.completedMissions??[]).includes(activeMission);
      onProfile({type:'nexus-mission',id:activeMission,score:result.score,lesson:mission().lesson,blueprint:[...selected],xp:150});
      if(remixActive){const remix=evaluateNexusRemix(activeMission,result,[...selected]);if(remix.ok){onProfile({type:'nexus-remix',id:activeMission,xp:70});onSound('reward');setText(root,'#nexusRunStatus',`★ BONUS ORDER ВЫПОЛНЕН · ${remix.title}. Ты не просто починил линию — ты улучшил архитектуру.`);}else{onSound('scan');setText(root,'#nexusRunStatus',`Линия стабильна, но bonus-order ещё не выполнен: ${remix.copy}`);}}
      else{onSound('reward');setText(root,'#nexusRunStatus',already?'✓ Эта архитектура снова проходит. Открой BONUS ORDER или попробуй дешевле.':'✓ Система пережила аварию. +исследовательская ячейка, +опыт Q-BOT.');}
    }
    else{onSound('blocked');setText(root,'#nexusRunStatus','Не штраф. Это телеметрия: смотри на drops / duplicates / unsafe и меняй причину.');}
    renderResearch();renderCompanion();renderMissions();
    if(allMissionsDone()){root.querySelector('#nexusTrialsOpen').hidden=false;root.querySelector('#nexusFinale').hidden=false;}
  }

  root.querySelector('#nexusRun').addEventListener('click',run);
  root.querySelector('#nexusMetricsToggle')?.addEventListener('click',()=>{metricsVisible=!metricsVisible;onSound('ui-click');renderCompanion();});
  root.querySelector('#nexusRemixToggle')?.addEventListener('click',()=>{remixActive=!remixActive;onSound('ui-click');renderRemix();setText(root,'#nexusRunStatus',remixActive?'Bonus-order включён. Базовый ремонт уже не достаточно хорош — выполни дополнительное условие.':'Bonus-order выключен.');});
  root.querySelector('#nexusClose').addEventListener('click',()=>{root.hidden=true;onClose();});
  root.querySelector('#nexusTrialsOpen').addEventListener('click',()=>{trialSeed=Math.max(1,(profile().labs.nexus?.trialSeeds?.at(-1)??0)+1);selected=new Set(['filter','route']);renderTrial();renderModules();});
  root.querySelector('#nexusNextTrial').addEventListener('click',()=>{trialSeed+=1;selected=new Set(['filter','route']);root.querySelector('#nexusNextTrial').hidden=true;renderTrial();renderModules();});
  root.querySelector('#nexusCoachGood').addEventListener('click',()=>{const rec=companionRecommendation(activeMission,companionSession);companionSession=applyCompanionFeedback(companionSession,activeMission,rec,true);if(rec.correct)onProfile({type:'nexus-companion-lesson',lesson:`${activeMission}:${rec.module}`,xp:20});onSound('reward');renderCompanion();});
  root.querySelector('#nexusCoachBad').addEventListener('click',()=>{const rec=companionRecommendation(activeMission,companionSession);companionSession=applyCompanionFeedback(companionSession,activeMission,rec,false);if(!rec.correct)onProfile({type:'nexus-companion-lesson',lesson:`${activeMission}:${rec.module}`,xp:20});onSound('scan');renderCompanion();});
  root.querySelectorAll('[data-nexus-build]').forEach(button=>button.addEventListener('click',()=>{const kind=button.dataset.nexusBuild;const result=buildCompanionArtifact(profile(),kind);if(!result.ok){setText(root,'#nexusBuildStatus',`Не хватает модулей: ${result.missing.join(', ')}. Исследуй их и вернись.`);onSound('blocked');return;}onProfile({type:'nexus-companion-build',build:kind,xp:90});setText(root,'#nexusBuildStatus',`✓ ${result.title} СОБРАН · QUALITY ${result.quality}% · ${result.artifact}`);onSound('reward');render();}));

  function render(){renderMissions();renderResearch();renderModules();renderCompanion();renderRemix();root.querySelectorAll('[data-nexus-build]').forEach(button=>{button.dataset.done=String((profile().labs.nexus?.companionBuilds??[]).includes(button.dataset.nexusBuild));});const done=profile().labs.nexus?.completedMissions?.length??0;const remix=(profile().labs.nexus?.remixMissions??[]).length;setText(root,'#nexusProgress',`${done}/${NEXUS_MISSIONS.length} АРОК · ${remix}/6 BONUS · ${profile().labs.nexus?.blueprintLibrary?.length??0} BLUEPRINTS · ${profile().labs.nexus?.trialSeeds?.length??0} ∞ СМЕН`);root.querySelector('#nexusTrialsOpen').hidden=!allMissionsDone();root.querySelector('#nexusFinale').hidden=!allMissionsDone();}

  return {open(){trialMode=false;remixActive=false;metricsVisible=getMode()==='compact';selected=new Set(['filter','route']);render();root.hidden=false;root.querySelector('#nexusClose').focus({preventScroll:true});},close(){root.hidden=true;},render};
}
