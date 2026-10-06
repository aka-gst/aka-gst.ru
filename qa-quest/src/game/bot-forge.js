export const BOT_MODULES = Object.freeze([
  Object.freeze({id:'planner',label:'PLANNER',hint:'разбить задачу на шаги'}),
  Object.freeze({id:'memory',label:'MEMORY',hint:'помнить состояние между шагами'}),
  Object.freeze({id:'retrieval',label:'RETRIEVAL',hint:'доставать проверяемый контекст'}),
  Object.freeze({id:'tools',label:'TOOLS',hint:'выполнять только разрешённые действия'}),
  Object.freeze({id:'policy',label:'POLICY',hint:'разделять полномочия и данные'}),
  Object.freeze({id:'tests',label:'EVALS',hint:'проверять результат до принятия'}),
  Object.freeze({id:'retry',label:'RETRY',hint:'переживать временные сбои'}),
  Object.freeze({id:'budget',label:'BUDGET',hint:'останавливать бесконечную работу'}),
  Object.freeze({id:'trace',label:'TRACE',hint:'оставлять объяснимый след'}),
]);

export const BOT_FORGE_MISSIONS = Object.freeze([
  Object.freeze({id:'program',title:'СОБРАТЬ МАЛЕНЬКУЮ ПРОГРАММУ',brief:'Создай функцию, которая нормализует имена файлов, и не принимай результат без eval.',required:['planner','tools','tests'],preferred:'safe',kind:'python'}),
  Object.freeze({id:'repair',title:'ПОЧИНИТЬ СБОЙНУЮ АВТОМАТИЗАЦИЮ',brief:'SAVE иногда отвечает timeout. Бот должен починить pipeline без бесконечного повтора.',required:['planner','tools','retry','tests','trace'],preferred:'modular',kind:'repair'}),
  Object.freeze({id:'game',title:'СОЗДАТЬ ПРАВИЛА МИНИ-ИГРЫ',brief:'Собери компактный rule-set, помни состояние и не превышай лимит шагов.',required:['planner','memory','tests','budget'],preferred:'modular',kind:'game'}),
  Object.freeze({id:'swarm',title:'СКООРДИНИРОВАТЬ ДВУХ БОТОВ',brief:'Один бот сортирует поток, второй проверяет результат. Общие инструменты ограничены policy.',required:['planner','memory','retrieval','tools','policy','tests','budget','trace'],preferred:'safe',kind:'bots'}),
]);

export function createForgePolicy() {
  return { feedbackRounds:0, values:Object.fromEntries(BOT_FORGE_MISSIONS.map(m=>[m.id,{fast:0,safe:0,modular:0}])) };
}
export function chooseForgeStrategy(policy, missionId) {
  const values=policy.values?.[missionId] ?? {fast:0,safe:0,modular:0}; const order=['fast','safe','modular'];
  return order.reduce((best,key)=>values[key]>values[best]?key:best,order[0]);
}
export function updateForgePolicy(policy, missionId, strategy, reward) {
  const next=structuredClone(policy); const old=Number(next.values[missionId][strategy]??0); next.values[missionId][strategy]=old+.5*(Number(reward)-old); next.feedbackRounds+=1; return next;
}

function artifactFor(mission,strategy){
  if(mission.kind==='python')return `def normalize_files(names):\n    cleaned = [name.strip().lower() for name in names if name.strip()]\n    return sorted(dict.fromkeys(cleaned))\n\n# generated plan strategy: ${strategy}`;
  if(mission.kind==='repair')return `PIPELINE PATCH\nREAD → ROUTE → SAVE\nretry: bounded(3)\nidempotency_key: item.id\ntrace: attempt/result\nstrategy: ${strategy}`;
  if(mission.kind==='game')return JSON.stringify({title:'Signal Yard',state:['score','turn'],rules:['move one signal','score only valid route','stop after 8 turns'],strategy},null,2);
  return JSON.stringify({bots:[{id:'sorter',role:'classify + enqueue',tools:['route_item']},{id:'checker',role:'retrieve + verify',tools:['lookup_rule']}],shared:{policy:'allowlist',budget:12,trace:true},strategy},null,2);
}

export function simulateBotForge(mission,modules,policy=createForgePolicy()){
  const installed=new Set(modules); const strategy=chooseForgeStrategy(policy,mission.id);
  const moduleChecks=mission.required.map(id=>({id:`module:${id}`,ok:installed.has(id),text:`${id.toUpperCase()} установлен`}));
  const strategyCheck={id:'strategy',ok:strategy===mission.preferred,text:`стратегия ${strategy} подходит задаче (${mission.preferred})`};
  const authorityCheck={id:'authority',ok:!installed.has('tools')||installed.has('policy')||mission.kind!=='bots',text:mission.kind==='bots'?'общие tools имеют POLICY':'граница полномочий допустима'};
  const checks=[...moduleChecks,strategyCheck,authorityCheck];
  return {strategy,checks,ok:checks.every(check=>check.ok),artifact:artifactFor(mission,strategy)};
}

function setText(root,selector,value){const node=root.querySelector(selector);if(node)node.textContent=value;}
export function createBotForge(root,{getProfile,onProfile=()=>{},onSound=()=>{},onClose=()=>{}}={}){
  let missionIndex=0; let modules=new Set(); let policy=createForgePolicy(); let last=null;
  function current(){return BOT_FORGE_MISSIONS[missionIndex];}
  function paintPolicy(){const values=policy.values[current().id];for(const key of ['fast','safe','modular']){const row=root.querySelector(`[data-forge-strategy="${key}"]`);const value=values[key];row.querySelector('b').textContent=value.toFixed(2);row.querySelector('i').style.width=`${Math.round((value+1)/2*100)}%`;row.dataset.chosen=String(last?.strategy===key);}}
  function paintModules(){for(const button of root.querySelectorAll('[data-bot-module]'))button.dataset.on=String(modules.has(button.dataset.botModule));const pipe=root.querySelector('#forgePipeline');pipe.replaceChildren();if(!modules.size){pipe.textContent='ПУСТО · выбери модули снизу';return;}for(const id of modules){const chip=document.createElement('span');chip.textContent=BOT_MODULES.find(m=>m.id===id)?.label??id;pipe.append(chip);}}
  function paintResult(){const evalNode=root.querySelector('#forgeEval');evalNode.replaceChildren();if(!last){setText(root,'#forgeArtifact','—');setText(root,'#forgeStatus','Собери архитектуру и запусти локального bounded planner.');root.querySelector('#forgeApprove').hidden=true;root.querySelector('#forgeReject').hidden=true;return;}for(const check of last.checks){const row=document.createElement('span');row.dataset.ok=String(check.ok);row.textContent=`${check.ok?'✓':'×'} ${check.text}`;evalNode.append(row);}setText(root,'#forgeArtifact',last.artifact);setText(root,'#forgeStatus',last.ok?'Все evals зелёные. Одобри результат, чтобы закрепить этот паттерн.':'Результат не проходит evals. Можно изменить архитектуру; если стратегия плоха — дай отрицательный feedback.');root.querySelector('#forgeApprove').hidden=!last.ok;root.querySelector('#forgeReject').hidden=false;}
  function paint(){const m=current();setText(root,'#forgeMissionNo',`${missionIndex+1}/${BOT_FORGE_MISSIONS.length}`);setText(root,'#forgeMissionTitle',m.title);setText(root,'#forgeMissionBrief',m.brief);const done=getProfile()?.labs?.bot?.completedMissions??[];setText(root,'#forgeProgress',`${done.length}/${BOT_FORGE_MISSIONS.length} BUILDS · ${policy.feedbackRounds} feedback`);paintModules();paintPolicy();paintResult();}
  root.querySelectorAll('[data-bot-module]').forEach(button=>button.addEventListener('click',()=>{const id=button.dataset.botModule;modules.has(id)?modules.delete(id):modules.add(id);last=null;onSound('wire');paint();}));
  root.querySelector('#forgeRun').addEventListener('click',()=>{last=simulateBotForge(current(),modules,policy);onSound(last.ok?'power':'blocked');paint();});
  root.querySelector('#forgeReject').addEventListener('click',()=>{if(!last)return;policy=updateForgePolicy(policy,current().id,last.strategy,-1);last=null;onSound('blocked');paint();});
  root.querySelector('#forgeApprove').addEventListener('click',()=>{if(!last?.ok)return;policy=updateForgePolicy(policy,current().id,last.strategy,1);const m=current();onProfile({type:'lab-mission',lab:'bot',id:m.id,patch:{feedbackRounds:policy.feedbackRounds},xp:140});onSound('reward');if(missionIndex<BOT_FORGE_MISSIONS.length-1){missionIndex+=1;modules=new Set();last=null;paint();}else{onProfile({type:'bot-complete',missions:BOT_FORGE_MISSIONS.length,feedbackRounds:policy.feedbackRounds});paint();}});
  root.querySelector('#forgeClose').addEventListener('click',()=>{root.hidden=true;onClose();});
  return {open(){const done=new Set(getProfile()?.labs?.bot?.completedMissions??[]);const index=BOT_FORGE_MISSIONS.findIndex(m=>!done.has(m.id));missionIndex=index<0?BOT_FORGE_MISSIONS.length-1:index;modules=new Set();policy=createForgePolicy();last=null;paint();root.hidden=false;root.querySelector('[data-bot-module="planner"]').focus({preventScroll:true});},close(){root.hidden=true;},snapshot(){return {mission:current(),modules:[...modules],policy:structuredClone(policy),last};}};
}
