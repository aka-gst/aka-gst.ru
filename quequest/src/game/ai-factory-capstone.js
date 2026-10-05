export const FACTORY_MODULES = Object.freeze([
  Object.freeze({id:'model',label:'MODEL',cost:3,hint:'noisy classifier'}),
  Object.freeze({id:'human',label:'HUMAN REVIEW',cost:2,hint:'fallback for low confidence'}),
  Object.freeze({id:'retrieval',label:'RETRIEVAL',cost:2,hint:'fetch context'}),
  Object.freeze({id:'provenance',label:'PROVENANCE',cost:1,hint:'keep sources'}),
  Object.freeze({id:'tools',label:'TOOLS',cost:2,hint:'perform actions'}),
  Object.freeze({id:'policy',label:'POLICY',cost:1,hint:'allowlist authority'}),
  Object.freeze({id:'guard',label:'DATA GUARD',cost:1,hint:'untrusted context stays data'}),
  Object.freeze({id:'idempotency',label:'IDEMPOTENCY',cost:1,hint:'duplicate-safe effects'}),
  Object.freeze({id:'retry',label:'RETRY',cost:1,hint:'bounded transient recovery'}),
  Object.freeze({id:'queue',label:'QUEUE',cost:2,hint:'absorb bursts'}),
  Object.freeze({id:'parallel',label:'2 WORKERS',cost:2,hint:'increase throughput'}),
  Object.freeze({id:'lock',label:'LOCK',cost:1,hint:'protect shared writer'}),
  Object.freeze({id:'checkpoint',label:'CHECKPOINT',cost:1,hint:'resume long run'}),
  Object.freeze({id:'trace',label:'TRACE',cost:1,hint:'debug decisions'}),
  Object.freeze({id:'budget',label:'BUDGET',cost:1,hint:'stop runaway plans'}),
]);

export const FACTORY_EVALS = Object.freeze([
  Object.freeze({id:'noisy-image',label:'NOISY IMAGE',test:s=>s.has('model')||s.has('human'),why:'Нужен classifier или честный human fallback.'}),
  Object.freeze({id:'knowledge',label:'UNKNOWN FACT',test:s=>s.has('retrieval')&&s.has('provenance'),why:'Контекст без provenance нельзя проверить.'}),
  Object.freeze({id:'tool',label:'ACTION REQUEST',test:s=>s.has('tools')&&s.has('policy'),why:'Tool без policy получает слишком много authority.'}),
  Object.freeze({id:'hostile',label:'HOSTILE DATA',test:s=>s.has('guard')&&s.has('policy'),why:'Инструкция внутри DATA не должна менять policy.'}),
  Object.freeze({id:'duplicate',label:'DUPLICATE EVENT',test:s=>s.has('idempotency'),why:'Повтор может создать второй побочный эффект.'}),
  Object.freeze({id:'timeout',label:'TRANSIENT TIMEOUT',test:s=>s.has('retry')&&s.has('budget'),why:'Retry должен быть bounded.'}),
  Object.freeze({id:'burst',label:'TRAFFIC BURST',test:s=>s.has('queue')&&s.has('parallel'),why:'Нужны и буфер, и throughput.'}),
  Object.freeze({id:'race',label:'SHARED LEDGER',test:s=>!s.has('parallel')||s.has('lock'),why:'Два worker-а пишут в общий ledger — нужен Lock.'}),
  Object.freeze({id:'resume',label:'MID-RUN CRASH',test:s=>s.has('checkpoint'),why:'Длинная фабрика должна продолжаться с checkpoint.'}),
  Object.freeze({id:'debug',label:'WRONG RESULT',test:s=>s.has('trace'),why:'Без trace нельзя объяснить, где сломался pipeline.'}),
]);

export function factoryCost(modules) { const set=new Set(modules??[]); return FACTORY_MODULES.reduce((sum,module)=>sum+(set.has(module.id)?module.cost:0),0); }

export function evaluateFactoryArchitecture(modules,{capacity=21,evalIds=null}={}) {
  const selected=new Set(modules??[]);
  const active = evalIds ? FACTORY_EVALS.filter(test=>evalIds.includes(test.id)) : FACTORY_EVALS;
  const rows=active.map(test=>({id:test.id,label:test.label,ok:Boolean(test.test(selected)),why:test.why}));
  const cost=factoryCost(selected);
  const passed=rows.filter(row=>row.ok).length;
  const overBudget=cost>capacity;
  const score=Math.max(0,Math.round((passed/rows.length)*100 - Math.max(0,cost-18)*2));
  return {rows,cost,capacity,passed,total:rows.length,overBudget,ok:passed===rows.length&&!overBudget,score};
}


function seeded(seed){let x=(Math.max(1,Math.round(Number(seed)||1))>>>0)||1;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;};}
export function generateFactoryTrial(seed=1){
  const safeSeed=Math.max(1,Math.round(Number(seed)||1)); const rand=seeded(safeSeed);
  const base=FACTORY_EVALS.filter(test=>test.id!=='race');
  const count=5+Math.floor(rand()*3);
  const pool=[...base];
  for(let i=pool.length-1;i>0;i-=1){const j=Math.floor(rand()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
  const chosen=pool.slice(0,count).map(test=>test.id);
  if(chosen.includes('burst')&&!chosen.includes('race')) chosen.push('race');
  const canonical=new Set();
  for(const id of chosen){
    if(id==='noisy-image') canonical.add('human');
    if(id==='knowledge'){canonical.add('retrieval');canonical.add('provenance');}
    if(id==='tool'){canonical.add('tools');canonical.add('policy');}
    if(id==='hostile'){canonical.add('guard');canonical.add('policy');}
    if(id==='duplicate')canonical.add('idempotency');
    if(id==='timeout'){canonical.add('retry');canonical.add('budget');}
    if(id==='burst'){canonical.add('queue');canonical.add('parallel');canonical.add('lock');}
    if(id==='resume')canonical.add('checkpoint');
    if(id==='debug')canonical.add('trace');
  }
  const capacity=factoryCost(canonical)+Math.floor(rand()*2);
  return {seed:safeSeed,evalIds:chosen,capacity,caseCount:chosen.length};
}
export function buildFactorySkeleton(modules) {
  const selected=new Set(modules??[]);
  const enabled=[...selected].sort().join(', ');
  return `from dataclasses import dataclass\nfrom typing import Protocol, Any\n\n# QueQuest blueprint modules: ${enabled}\nclass ModelClient(Protocol):\n    def complete(self, messages: list[dict], *, timeout: float) -> dict: ...\n\nclass Tool(Protocol):\n    name: str\n    def run(self, args: dict) -> Any: ...\n\n@dataclass\nclass Task:\n    id: str\n    kind: str\n    payload: dict\n\ndef process(task: Task, *, model: ModelClient, tools: dict[str, Tool], seen: set[str]):\n    if task.id in seen:                 # idempotency boundary\n        return {\"status\": \"duplicate\"}\n    # retrieve only when needed; retrieved text remains DATA, not authority\n    # validate structured actions against policy/allowlist before tool.run(...)\n    # bounded retry + timeout + budget wrap external effects\n    # checkpoint after durable steps and append a redacted trace\n    seen.add(task.id)\n    return {\"status\": \"ok\"}\n\n# Runtime shape: ingest -> classify -> retrieve? -> plan -> policy -> tool? -> eval/log\n# Keep API keys outside saves/exports; provider adapters implement ModelClient.`;
}

function setText(root,selector,value){const node=root.querySelector(selector);if(node)node.textContent=value;}

export function createAiFactoryCapstone(root,{getProfile,onProfile=()=>{},onSound=()=>{},onClose=()=>{}}={}){
  let selected=new Set(); let last=null; let mode='master'; let trial=null;
  function profile(){return getProfile()?.labs?.factory??{};}
  function currentConfig(){return mode==='trial'?{capacity:trial.capacity,evalIds:trial.evalIds}:{capacity:21,evalIds:null};}
  function paintModules(){
    for(const button of root.querySelectorAll('[data-factory-module]')) button.dataset.on=String(selected.has(button.dataset.factoryModule));
    const cost=factoryCost(selected); const cfg=currentConfig(); setText(root,'#factoryCost',`${cost}/${cfg.capacity} UNITS`); root.querySelector('#factoryBudgetBar').style.width=`${Math.min(100,Math.round(cost/cfg.capacity*100))}%`; root.dataset.over=String(cost>cfg.capacity);
    const pipe=root.querySelector('#factoryPipeline');pipe.replaceChildren();
    if(!selected.size){pipe.textContent='INGEST → ? → RESULT';return;}
    ['model','human','retrieval','provenance','tools','policy','guard','idempotency','retry','queue','parallel','lock','checkpoint','trace','budget'].forEach(id=>{if(!selected.has(id))return;const chip=document.createElement('span');chip.textContent=FACTORY_MODULES.find(m=>m.id===id)?.label??id;pipe.append(chip);});
  }
  function paintResult(){
    const list=root.querySelector('#factoryEvals');list.replaceChildren();
    if(!last){setText(root,'#factoryStatus',mode==='trial'?'Скрытая смена выбрала новый набор отказов. Собери минимальную архитектуру под capacity.':'Собери архитектуру. Скрытый набор проверит не термины, а поведение на 10 разных сбоях.');root.querySelector('#factoryExport').hidden=true;return;}
    last.rows.forEach(row=>{const item=document.createElement('div');item.dataset.ok=String(row.ok);item.innerHTML=`<b>${row.ok?'✓':'×'} ${row.label}</b><small>${row.ok?'устойчиво':row.why}</small>`;list.append(item);});
    setText(root,'#factoryScore',`${last.passed}/${last.total} · SCORE ${last.score}`);
    setText(root,'#factoryStatus',last.ok?(mode==='trial'?`✓ TRIAL #${trial.seed} закрыт. Новый seed даст другой набор ограничений.`:'✓ AI FACTORY выдержала весь hidden eval. Можно экспортировать читаемый Python skeleton.'):(last.overBudget?'Все лишние модули тоже стоят ресурсов. Уложи архитектуру в capacity.':'Красные сценарии показывают границу, которой системе пока не хватает.'));
    root.querySelector('#factoryExport').hidden=!last.ok;
    root.querySelector('#factorySkeletonWrap').hidden=!last.ok;
    root.querySelector('#factoryNextTrial').hidden=!(last.ok || profile().completed);
    if(last.ok){
      root.querySelector('#factorySkeleton').textContent=buildFactorySkeleton(selected);
      if(mode==='master'){const p=profile();if(!p.completed||last.score>(p.bestScore??0))onProfile({type:'factory-complete',score:last.score,cost:last.cost});}
      else if(!(profile().trialSeeds??[]).includes(trial.seed)) onProfile({type:'factory-trial',seed:trial.seed,score:last.score,xp:80});
    }
  }
  function paint(){const p=profile();setText(root,'#factoryBest',p.completed?`BEST ${p.bestScore??0} · COST ${p.bestCost??'—'} · TRIALS ${(p.trialSeeds??[]).length}`:'НЕ ПРОЙДЕНО');setText(root,'#factoryTrialLabel',mode==='trial'?`FACTORY TRIAL #${String(trial.seed).padStart(3,'0')} · ${trial.caseCount} HIDDEN CASES`:'MASTER EVAL · 10 HIDDEN CASES');paintModules();paintResult();}
  function nextTrial(){const solved=profile().trialSeeds??[];const seed=(solved.length?Math.max(...solved):0)+1;trial=generateFactoryTrial(seed);mode='trial';selected=new Set();last=null;paint();}
  root.querySelectorAll('[data-factory-module]').forEach(button=>button.addEventListener('click',()=>{const id=button.dataset.factoryModule;selected.has(id)?selected.delete(id):selected.add(id);last=null;onSound('wire');paint();}));
  root.querySelector('#factoryRun').addEventListener('click',()=>{last=evaluateFactoryArchitecture(selected,currentConfig());onSound(last.ok?'reward':'blocked');paint();});
  root.querySelector('#factoryExport').addEventListener('click',async()=>{const text=buildFactorySkeleton(selected);try{await navigator.clipboard.writeText(text);setText(root,'#factoryStatus','PYTHON SKELETON СКОПИРОВАН · это blueprint, а не спрятанный секрет/ключ.');onSound('reward');}catch{root.querySelector('#factorySkeleton').textContent=text;setText(root,'#factoryStatus','Clipboard недоступен · skeleton оставлен в панели ниже.');}});
  root.querySelector('#factoryNextTrial').addEventListener('click',()=>{nextTrial();onSound('wire');});
  root.querySelector('#factoryReset').addEventListener('click',()=>{selected=new Set();last=null;paint();});
  root.querySelector('#factoryClose').addEventListener('click',()=>{root.hidden=true;onClose();});
  return {open(){mode=profile().completed?'trial':'master';trial=mode==='trial'?generateFactoryTrial(((profile().trialSeeds??[]).length?Math.max(...profile().trialSeeds):0)+1):null;selected=new Set();last=null;paint();root.hidden=false;root.querySelector('[data-factory-module]').focus({preventScroll:true});},close(){root.hidden=true;},snapshot(){return {mode,trial,selected:[...selected],last};}};
}
