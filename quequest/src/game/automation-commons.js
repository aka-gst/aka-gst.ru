import { runPython } from '../runner.js';

export const COMMONS_FAMILIES = Object.freeze({
  flow:Object.freeze({id:'flow', human:'СЛИШКОМ МНОГО СРАЗУ', term:'BACKPRESSURE', accepted:['queue','scale']}),
  effects:Object.freeze({id:'effects', human:'ЭТО УЖЕ ДЕЛАЛИ', term:'IDEMPOTENCY', accepted:['once','human']}),
  knowledge:Object.freeze({id:'knowledge', human:'ИНСТРУКЦИЯ УСТАРЕЛА', term:'FRESHNESS / PROVENANCE', accepted:['refresh','provenance']}),
  boundary:Object.freeze({id:'boundary', human:'ФОРМА ДАННЫХ СЛОМАНА', term:'SCHEMA BOUNDARY', accepted:['validate']}),
  authority:Object.freeze({id:'authority', human:'ОПАСНОЕ ДЕЙСТВИЕ', term:'POLICY / HUMAN APPROVAL', accepted:['policy','human']}),
  resilience:Object.freeze({id:'resilience', human:'ВЕТКА БОЛЬНА', term:'CIRCUIT BREAKER / DEGRADED MODE', accepted:['breaker','degraded']}),
  stream:Object.freeze({id:'stream', human:'ОТВЕТ УЖЕ ИДЁТ ПО ЧАСТЯМ', term:'STREAMING', accepted:['stream']}),
});

export const COMMONS_CONDITIONS = Object.freeze([
  Object.freeze({id:'flow', human:'КОГДА ПОТОК СТАЛ БОЛЬШЕ, ЧЕМ ЛИНИЯ УСПЕВАЕТ', term:'load > capacity', family:'flow'}),
  Object.freeze({id:'effects', human:'КОГДА ТАКОЙ ID УЖЕ ВСТРЕЧАЛСЯ', term:'event.id in seen', family:'effects'}),
  Object.freeze({id:'knowledge', human:'КОГДА НАЙДЕННАЯ ВЕРСИЯ СТАРЕЕ ТЕКУЩЕЙ', term:'doc.version < current', family:'knowledge'}),
  Object.freeze({id:'boundary', human:'КОГДА ОБЯЗАТЕЛЬНОГО ПОЛЯ НЕТ', term:'required keys missing', family:'boundary'}),
  Object.freeze({id:'authority', human:'КОГДА ДЕЙСТВИЕ ОПАСНОЕ', term:'tool not in allowlist', family:'authority'}),
  Object.freeze({id:'resilience', human:'КОГДА ГЛАВНАЯ ВЕТКА НЕЗДОРОВА', term:'primary_healthy is False', family:'resilience'}),
  Object.freeze({id:'stream', human:'КОГДА CHUNKS УЖЕ ПРИХОДЯТ, А ЭКРАН МОЛЧИТ', term:'chunks_ready and not rendered', family:'stream'}),
]);

export const COMMONS_ACTIONS = Object.freeze([
  Object.freeze({id:'queue', human:'ДАТЬ РАБОТЕ МЕСТО ПОДОЖДАТЬ', term:'QUEUE', cost:1, speed:1, trust:2}),
  Object.freeze({id:'scale', human:'ДОБАВИТЬ ЕЩЁ ОДНОГО РАБОТНИКА', term:'SCALE OUT', cost:3, speed:3, trust:1}),
  Object.freeze({id:'once', human:'НЕ ПОВТОРЯТЬ ЭФФЕКТ ДВАЖДЫ', term:'IDEMPOTENCY', cost:1, speed:2, trust:3, memory:'seen'}),
  Object.freeze({id:'human', human:'ОТПРАВИТЬ СПОРНЫЙ СЛУЧАЙ ЧЕЛОВЕКУ', term:'HUMAN REVIEW', cost:3, speed:-2, trust:4}),
  Object.freeze({id:'refresh', human:'ОБНОВИТЬ ИСТОЧНИК ПЕРЕД ОТВЕТОМ', term:'CACHE REFRESH', cost:2, speed:0, trust:3}),
  Object.freeze({id:'provenance', human:'НЕСТИ ИСТОЧНИК ВМЕСТЕ С ОТВЕТОМ', term:'PROVENANCE', cost:1, speed:1, trust:3}),
  Object.freeze({id:'validate', human:'ОСТАНОВИТЬ КРИВЫЕ ДАННЫЕ НА ГРАНИЦЕ', term:'SCHEMA VALIDATION', cost:1, speed:1, trust:3}),
  Object.freeze({id:'policy', human:'ПРОПУСКАТЬ ТОЛЬКО РАЗРЕШЁННЫЕ ДЕЙСТВИЯ', term:'POLICY ALLOWLIST', cost:1, speed:2, trust:4}),
  Object.freeze({id:'breaker', human:'ВРЕМЕННО ОТКЛЮЧИТЬ БОЛЬНУЮ ВЕТКУ', term:'CIRCUIT BREAKER', cost:1, speed:2, trust:3}),
  Object.freeze({id:'degraded', human:'ПЕРЕЙТИ НА ПРОСТОЙ БЕЗОПАСНЫЙ РЕЖИМ', term:'DEGRADED MODE', cost:1, speed:1, trust:4}),
  Object.freeze({id:'stream', human:'ПОКАЗЫВАТЬ ЧАСТИ ОТВЕТА СРАЗУ', term:'STREAMING', cost:1, speed:3, trust:2}),
]);

export const COMMONS_MEMORY = Object.freeze([
  Object.freeze({id:'none', human:'НИЧЕГО НЕ ЗАПОМИНАТЬ', term:'stateless'}),
  Object.freeze({id:'seen', human:'ПОМНИТЬ УЖЕ ВИДЕННЫЕ ID', term:'seen: set'}),
]);

const E=(family,id,label,severity=1)=>Object.freeze({family,id,label,severity});
export const AUTOMATION_BRIEFS = Object.freeze([
  Object.freeze({
    id:'rush-hour', chapter:'AUTOMATION 01 · УТРО БЕЗ ПАНИКИ', title:'Окно заказов захлебнулось в утреннем потоке.',
    brief:'Сейчас ты можешь чинить burst вручную. Построй правило, которое само замечает перегрузку и вмешивается только тогда, когда это нужно.',
    events:Object.freeze([E('flow','R1','обычный заказ'),E('flow','R2','вход выше мощности',3),E('flow','R3','ещё один burst',4)]),
    families:Object.freeze(['flow']), maxRules:1,
  }),
  Object.freeze({
    id:'receipt-guard', chapter:'AUTOMATION 02 · ПАМЯТЬ О ПОБОЧНОМ ЭФФЕКТЕ', title:'Retry снова прислал тот же order-id.',
    brief:'Здесь одной реакции мало: автомат должен помнить, что эффект уже был. Именно поэтому “помнить” становится игровой деталью, а потом — обычным set в Python.',
    events:Object.freeze([E('effects','A','первый A'),E('effects','A','повтор A',3),E('effects','B','новый B')]),
    families:Object.freeze(['effects']), maxRules:1,
  }),
  Object.freeze({
    id:'clean-context', chapter:'AUTOMATION 03 · ЧИСТЫЙ КОНТЕКСТ', title:'Город получает старые знания и кривые payload одновременно.',
    brief:'Теперь одного правила мало. Собери два независимых датчика: один следит за свежестью, второй — за формой данных.',
    events:Object.freeze([E('knowledge','K1','устаревший документ',3),E('boundary','B1','нет обязательного поля',3),E('knowledge','K2','ещё одна старая версия',2)]),
    families:Object.freeze(['knowledge','boundary']), maxRules:2,
  }),
  Object.freeze({
    id:'night-autopilot', chapter:'AUTOMATION 04 · НОЧНОЙ АВТОПИЛОТ', title:'Ночью система должна быть осторожнее тебя, а не смелее.',
    brief:'Собери три правила для опасного tool, больной ветки и ответа, который уже идёт кусками. Это первая маленькая автономная система.',
    events:Object.freeze([E('authority','T1','опасный tool',4),E('resilience','C1','главная ветка упала',4),E('stream','S1','chunks идут, UI молчит',2)]),
    families:Object.freeze(['authority','resilience','stream']), maxRules:3,
  }),
]);

function seeded(seed){let x=(Math.max(1,Math.round(Number(seed)||1))*2654435761)>>>0;return()=>{x=(1664525*x+1013904223)>>>0;return x/4294967296;};}
function getAction(id){return COMMONS_ACTIONS.find(x=>x.id===id);}
function getCondition(id){return COMMONS_CONDITIONS.find(x=>x.id===id);}
function getMemory(id){return COMMONS_MEMORY.find(x=>x.id===id);}

const COMMONS_DISTRACTORS = Object.freeze({
  flow:Object.freeze(['once']),
  effects:Object.freeze(['scale']),
  knowledge:Object.freeze(['stream']),
  boundary:Object.freeze(['refresh']),
  authority:Object.freeze(['scale']),
  resilience:Object.freeze(['scale']),
  stream:Object.freeze(['scale']),
});

export function commonsActionChoices(familyId){
  const family=COMMONS_FAMILIES[familyId];
  if(!family)return [];
  const ids=[...family.accepted,...(COMMONS_DISTRACTORS[familyId]??[])];
  return [...new Set(ids)].map(getAction).filter(Boolean);
}
export function createEmptyProgram(size=3){return Array.from({length:size},()=>({when:'',action:'',memory:'none'}));}
export function normalizeProgram(program=[]){return program.map(rule=>({when:String(rule?.when??''),action:String(rule?.action??''),memory:String(rule?.memory??'none')}));}
export function programSignature(program=[]){return normalizeProgram(program).filter(r=>r.when&&r.action).map(r=>`${r.when}:${r.action}:${r.memory||'none'}`).sort().join(';');}
export function parseProgramSignature(signature=''){return String(signature).split(';').filter(Boolean).map(token=>{const [when='',action='',memory='none']=token.split(':');return {when,action,memory};});}

function accepted(event, rule){
  const family=COMMONS_FAMILIES[event.family];
  if(!family || rule.when!==event.family || !family.accepted.includes(rule.action)) return false;
  const action=getAction(rule.action);
  if(action?.memory && rule.memory!==action.memory) return false;
  return true;
}

export function evaluateAutomation(brief,{program=[]}={}){
  const rules=normalizeProgram(program).filter(r=>r.when&&r.action);
  const trace=[];let handled=0;let cost=0;let speed=0;let trust=0;
  const seen=new Set();
  for(const event of brief.events){
    let match=null;
    for(const rule of rules){if(accepted(event,rule)){match=rule;break;}}
    if(match){
      const action=getAction(match.action);handled+=1;cost+=action?.cost??1;speed+=action?.speed??0;trust+=action?.trust??0;
      if(match.memory==='seen')seen.add(event.id);
      trace.push({event,ok:true,rule:match,message:`${event.label} → ${action?.human??match.action}`});
    }else trace.push({event,ok:false,rule:null,message:`${event.label} → НИКТО НЕ ПОДХВАТИЛ`});
  }
  const familiesCovered=new Set(rules.filter(r=>accepted({family:r.when},r)).map(r=>r.when));
  const allFamilies=brief.families.every(f=>familiesCovered.has(f));
  const coverage=brief.events.length?handled/brief.events.length:0;
  const complexity=rules.length+rules.filter(r=>r.memory&&r.memory!=='none').length;
  const ok=coverage===1&&allFamilies&&rules.length<=brief.maxRules;
  const efficiency=Math.max(0,100-Math.max(0,cost-brief.events.length)*8-complexity*4+Math.max(0,speed)*2);
  const score=ok?Math.round(coverage*100+efficiency+trust*2):Math.round(coverage*100);
  return {ok,handled,total:brief.events.length,coverage,complexity,cost,speed,trust,efficiency,score,trace,rules};
}

const DAY_EVENT_TEMPLATES=Object.freeze([
  {family:'flow',label:'burst у окна заказов'},{family:'effects',label:'повторный order-id'},{family:'knowledge',label:'архив вернул старую версию'},
  {family:'boundary',label:'payload без обязательного поля'},{family:'authority',label:'опасный tool появился в planner'},{family:'resilience',label:'главная ветка перестала отвечать'},{family:'stream',label:'chunks уже идут, экран пуст'},
]);
export function generateCommonsDay(seed=1){
  const safe=Math.max(1,Math.round(Number(seed)||1));const rnd=seeded(safe);const count=10+Math.floor(rnd()*5);const events=[];
  for(let i=0;i<count;i++){const base=DAY_EVENT_TEMPLATES[Math.floor(rnd()*DAY_EVENT_TEMPLATES.length)];events.push({family:base.family,id:`${safe}-${i}-${Math.floor(rnd()*99)}`,label:base.label,severity:1+Math.floor(rnd()*4)});}
  return {seed:safe,events,capacity:5+Math.floor(rnd()*5),weather:['СПОКОЙНО','НАПЛЫВ','НОЧНАЯ СМЕНА','ШУМНЫЙ ДЕНЬ'][Math.floor(rnd()*4)]};
}

export function evaluateCommonsDay(day,{blueprints=[]}={}){
  const programs=blueprints.flatMap(item=>Array.isArray(item)?item:parseProgramSignature(String(item).includes('|')?String(item).split('|').slice(1).join('|'):item));
  let handled=0,cost=0,trust=0,speed=0;const trace=[];
  for(const event of day.events){
    const rule=programs.find(r=>accepted(event,r));
    if(rule){const action=getAction(rule.action);handled++;cost+=action?.cost??1;trust+=action?.trust??0;speed+=action?.speed??0;trace.push({event,ok:true,action:rule.action});}
    else trace.push({event,ok:false,action:''});
  }
  const coverage=handled/day.events.length;const uniqueRules=new Set(programs.map(r=>`${r.when}:${r.action}:${r.memory}`)).size;const overflow=Math.max(0,uniqueRules-day.capacity);
  const ok=coverage===1&&overflow===0;
  const score=Math.max(0,Math.round(coverage*120+trust*1.5+speed-Math.max(0,cost-day.events.length)*2-overflow*25-uniqueRules*2));
  return {ok,handled,total:day.events.length,coverage,uniqueRules,overflow,cost,trust,speed,score,trace};
}

export function automationPython(program=[]){
  const rules=normalizeProgram(program).filter(r=>r.when&&r.action);const lines=['def automation(event, state):','    family = event.get("family")'];
  if(!rules.length){lines.push('    return "observe"');return lines.join('\n');}
  for(const rule of rules){
    const prefix=lines.length===2?'    if':'    elif';
    lines.push(`${prefix} family == ${JSON.stringify(rule.when)}:`);
    if(rule.action==='once'){
      lines.push('        seen = state.setdefault("seen", set())','        event_id = event.get("id")','        if event_id in seen: return "ignore"','        seen.add(event_id)','        return "once"');
    }else lines.push(`        return ${JSON.stringify(rule.action)}`);
  }
  lines.push('    return "observe"');return lines.join('\n');
}

export const COMMONS_CODE_STARTER=`def autopilot(event, state):
    """Верни действие для события. state — обычный dict между вызовами."""
    family = event.get("family")
    # Ты уже знаешь семь паттернов из WORLD GRID.
    # Сделай один маленький автопилот, а не семь отдельных экранов.
    return "observe"`;

export const COMMONS_CODE_CHECKS=Object.freeze([
  {kind:'py',expr:'autopilot({"family":"flow","load":6},{}) in {"queue","scale"}',detail:'burst должен получить queue или scale'},
  {kind:'py',expr:'(lambda s:(autopilot({"family":"effects","id":"A"},s),autopilot({"family":"effects","id":"A"},s)))({}) in {("once","ignore"),("apply","ignore")}',detail:'повторный effect должен быть остановлен состоянием'},
  {kind:'py',expr:'autopilot({"family":"knowledge","version":2,"current":4},{}) in {"refresh","provenance"}',detail:'устаревшее знание должно получить freshness/provenance'},
  {kind:'py',expr:'autopilot({"family":"boundary","payload":{"id":"A"}},{}) == "validate"',detail:'кривая форма останавливается на boundary'},
  {kind:'py',expr:'autopilot({"family":"authority","tool":"delete_all"},{}) in {"policy","human"}',detail:'опасное действие проходит через authority boundary'},
  {kind:'py',expr:'autopilot({"family":"resilience","healthy":False},{}) in {"breaker","degraded"}',detail:'больная ветка не должна тянуть весь город'},
  {kind:'py',expr:'autopilot({"family":"stream","chunks":["A","B"]},{}) == "stream"',detail:'готовые chunks нужно показать сразу'},
]);

function setText(root,selector,value){const node=root.querySelector(selector);if(node)node.textContent=value;}
function esc(value){return String(value).replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));}

export function createAutomationCommons(root,{getProfile,getMode=()=> 'guided',onProfile=()=>{},onSound=()=>{},onClose=()=>{}}={}){
  let index=0,program=createEmptyProgram(3),last=null,daySeed=1,codeBusy=false,dayMode=false,activeBlueprints=new Set();
  const profile=()=>getProfile();
  const done=()=>new Set(profile().labs.commons?.completedBriefs??[]);
  const blueprints=()=>profile().labs.commons?.blueprints??[];
  const allDone=()=>AUTOMATION_BRIEFS.every(x=>done().has(x.id));
  const brief=()=>AUTOMATION_BRIEFS[index]??AUTOMATION_BRIEFS[0];
  const ruleHost=root.querySelector('#commonsRules');const tape=root.querySelector('#commonsEventTape');

  function optionLabel(item){return getMode()==='guided'?item.human:`${item.human} · ${item.term}`;}
  function fillSelect(select,items,empty){select.replaceChildren();const first=document.createElement('option');first.value='';first.textContent=empty;select.append(first);for(const item of items){const opt=document.createElement('option');opt.value=item.id;opt.textContent=optionLabel(item);select.append(opt);}}
  function renderRules(){
    ruleHost.replaceChildren();
    for(let i=0;i<3;i++){
      const row=document.createElement('div');row.className='commons-rule';row.dataset.active=String(i<brief().maxRules);
      const badge=document.createElement('b');badge.textContent=`RULE ${String.fromCharCode(65+i)}`;const when=document.createElement('select');const action=document.createElement('select');const memory=document.createElement('select');
      const active=i<brief().maxRules;
      const current=program[i]??{when:'',action:'',memory:'none'};
      const renderActionChoices=()=>{
        const choices=commonsActionChoices(when.value);
        fillSelect(action,choices,when.value?'ЧТО СДЕЛАТЬ…':'СНАЧАЛА ВЫБЕРИ «КОГДА»');
        action.disabled=!active||!when.value;
        if(choices.some(item=>item.id===current.action))action.value=current.action;
        else action.value='';
      };
      const renderMemoryChoice=()=>{
        const needsMemory=getAction(action.value)?.memory;
        fillSelect(memory,COMMONS_MEMORY,needsMemory?'ЧТО ЗАПОМНИТЬ…':'ПАМЯТЬ НЕ НУЖНА');
        if(needsMemory){memory.disabled=!active;memory.value=current.memory||'none';}
        else{memory.value='none';memory.disabled=true;}
      };
      fillSelect(when,COMMONS_CONDITIONS,'КОГДА…');when.value=current.when;when.disabled=!active;renderActionChoices();renderMemoryChoice();
      const persist=()=>{program[i]={when:when.value,action:action.value,memory:memory.value||'none'};last=null;renderStatus();};
      when.addEventListener('change',()=>{current.when=when.value;current.action='';current.memory='none';renderActionChoices();renderMemoryChoice();persist();});
      action.addEventListener('change',()=>{current.action=action.value;current.memory='none';renderMemoryChoice();persist();});
      memory.addEventListener('change',()=>{current.memory=memory.value||'none';persist();});
      row.append(badge,when,action,memory);ruleHost.append(row);
    }
  }
  function renderTape(events=brief().events,trace=[]){tape.replaceChildren();events.forEach((event,i)=>{const row=document.createElement('div');row.dataset.ok=trace[i]?String(trace[i].ok):'idle';row.innerHTML=`<b>${esc(event.label)}</b><small>${getMode()==='guided'?esc(COMMONS_FAMILIES[event.family]?.human??event.family):esc(COMMONS_FAMILIES[event.family]?.term??event.family)}</small><span>${trace[i]?(trace[i].ok?'✓':'×'):'·'}</span>`;tape.append(row);});}
  function renderStatus(){const result=last;if(!result){setText(root,'#commonsStatus','Собери правило и запусти день. Ошибка ничего не отнимает — она показывает, что автомат пропустил.');return;}setText(root,'#commonsStatus',result.ok?'✓ АВТОМАТ ПРОШЁЛ ВСЮ СМЕНУ. Можно сохранить и потом улучшать.':`Поймано ${result.handled}/${result.total}. Посмотри, какой тип события остался без правильного правила.`);}
  function renderBrief(seedProgram=null){
    const b=brief();dayMode=false;program=seedProgram?normalizeProgram(seedProgram):createEmptyProgram(3);while(program.length<3)program.push({when:'',action:'',memory:'none'});last=null;setText(root,'#commonsChapter',b.chapter);setText(root,'#commonsTitle',b.title);setText(root,'#commonsBrief',b.brief);setText(root,'#commonsProgress',`${done().size}/${AUTOMATION_BRIEFS.length} АВТОМАТА · ${(profile().labs.commons?.daySeeds??[]).length} ∞ ДНЕЙ`);root.querySelector('#commonsBriefPanel').hidden=false;root.querySelector('#commonsDayPanel').hidden=true;root.querySelector('#commonsBuilderPanel').hidden=false;root.querySelector('#commonsCodePanel').hidden=true;root.querySelector('#commonsSave').hidden=true;root.querySelector('#commonsNext').hidden=true;root.querySelector('#commonsPythonReveal').hidden=true;renderRules();renderTape();renderStatus();renderLibrary();
  }
  function renderLibrary(){const host=root.querySelector('#commonsLibrary');host.replaceChildren();const saved=blueprints();if(!saved.length){host.innerHTML='<em>Пока пусто. Первый рабочий автомат станет переиспользуемой деталью.</em>';return;}saved.slice(-12).forEach(sig=>{const item=document.createElement('button');item.type='button';const briefId=sig.split('|')[0]??'';item.dataset.on=String(dayMode&&activeBlueprints.has(sig));item.innerHTML=`<b>${dayMode?(activeBlueprints.has(sig)?'✓':'○'):'◈'}</b><span>${esc(briefId||'BLUEPRINT')}<small>${esc((sig.split('|')[1]??'').replaceAll(';',' · '))}</small></span>`;item.addEventListener('click',()=>{if(dayMode){if(activeBlueprints.has(sig))activeBlueprints.delete(sig);else activeBlueprints.add(sig);renderLibrary();setText(root,'#commonsStatus',`${activeBlueprints.size} BLUEPRINT АКТИВНО · оставь только то, что нужно этому дню.`);return;}const target=AUTOMATION_BRIEFS.findIndex(x=>x.id===briefId);if(target>=0){index=target;renderBrief(parseProgramSignature(sig.split('|')[1]??''));setText(root,'#commonsStatus','BLUEPRINT ОТКРЫТ ДЛЯ РЕМИКСА · схема загружена. Сделай другой рабочий вариант или улучши метрики.');}});host.append(item);});}
  function simulate(){last=evaluateAutomation(brief(),{program});renderTape(brief().events,last.trace);setText(root,'#commonsCoverage',`${Math.round(last.coverage*100)}%`);setText(root,'#commonsComplexity',String(last.complexity));setText(root,'#commonsEfficiency',String(last.efficiency));renderStatus();onSound(last.ok?'reward':'blocked');if(last.ok){root.querySelector('#commonsSave').hidden=false;root.querySelector('#commonsPythonReveal').hidden=false;root.querySelector('#commonsPython').textContent=automationPython(program);setText(root,'#commonsOptimization','Рабочее решение уже считается победой. Хочешь — теперь вернись и сделай его проще/дешевле.');}}
  function save(){if(!last?.ok)return;const sig=`${brief().id}|${programSignature(program)}`;onProfile({type:'commons-blueprint',id:brief().id,blueprint:sig,score:last.score,efficiency:last.efficiency,xp:180});onSound('reward');root.querySelector('#commonsSave').hidden=true;root.querySelector('#commonsNext').hidden=false;renderLibrary();setText(root,'#commonsStatus','BLUEPRINT СОХРАНЁН · теперь это не урок, а твоя переиспользуемая деталь.');}
  function next(){const nextIndex=AUTOMATION_BRIEFS.findIndex((b,i)=>i>index&&!done().has(b.id));if(nextIndex>=0){index=nextIndex;renderBrief();return;}if(allDone())renderDay(daySeed);else{index=Math.min(AUTOMATION_BRIEFS.length-1,index+1);renderBrief();}}
  function renderDay(seed){dayMode=true;daySeed=Math.max(1,Math.round(Number(seed)||1));const day=generateCommonsDay(daySeed);root._commonsDay=day;root.querySelector('#commonsBriefPanel').hidden=true;root.querySelector('#commonsDayPanel').hidden=false;root.querySelector('#commonsBuilderPanel').hidden=true;root.querySelector('#commonsCodePanel').hidden=true;root.querySelector('#commonsPythonReveal').hidden=true;setText(root,'#commonsDaySeed',`CITY AUTOPILOT #${String(day.seed).padStart(3,'0')}`);setText(root,'#commonsDayWeather',`${day.weather} · ${day.events.length} СОБЫТИЙ · CAPACITY ${day.capacity}`);activeBlueprints=new Set(blueprints());renderLibrary();renderTape(day.events,[]);setText(root,'#commonsStatus','BLUEPRINTS включены все. Для тесного capacity можешь отключить лишние прямо в библиотеке.');root.querySelector('#commonsDayNext').hidden=true;}
  function runDay(){const day=root._commonsDay??generateCommonsDay(daySeed);const result=evaluateCommonsDay(day,{blueprints:[...activeBlueprints]});last=result;renderTape(day.events,result.trace);setText(root,'#commonsCoverage',`${Math.round(result.coverage*100)}%`);setText(root,'#commonsComplexity',String(result.uniqueRules));setText(root,'#commonsEfficiency',String(result.score));setText(root,'#commonsStatus',result.ok?'✓ ГОРОД ПРОЖИЛ ДЕНЬ НА ТВОИХ АВТОМАТАХ. Теперь можно оптимизировать или перейти в код.':result.overflow?`Покрытие есть, но ${result.uniqueRules} правил не помещаются в capacity ${day.capacity}. Упрости систему.`:`Автопилот поймал ${result.handled}/${result.total}. Не хватает blueprint для одного из знакомых паттернов.`);onSound(result.ok?'reward':'blocked');if(result.ok){onProfile({type:'commons-day',seed:day.seed,score:result.score,xp:115});root.querySelector('#commonsDayNext').hidden=false;}}
  function openCode(){dayMode=false;if((profile().labs.commons?.daySeeds??[]).length<2){onSound('blocked');setText(root,'#commonsStatus','Сначала дай своим blueprint-ам прожить хотя бы два CITY AUTOPILOT дня. Потом забирай управление кодом.');return;}root.querySelector('#commonsBriefPanel').hidden=true;root.querySelector('#commonsDayPanel').hidden=true;root.querySelector('#commonsBuilderPanel').hidden=true;root.querySelector('#commonsCodePanel').hidden=false;const area=root.querySelector('#commonsCode');if(area&&!area.value.trim())area.value=COMMONS_CODE_STARTER;setText(root,'#commonsCodeStatus','Это уже не визуальный конструктор. Один Python-autopilot должен выдержать семь знакомых классов событий.');}
  async function runCode(){if(codeBusy)return;codeBusy=true;const btn=root.querySelector('#commonsCodeRun');btn.disabled=true;setText(root,'#commonsCodeStatus','CPython гоняет семь классов событий…');onProfile({type:'code-run'});const result=await runPython({source:root.querySelector('#commonsCode').value,checks:COMMONS_CODE_CHECKS});codeBusy=false;btn.disabled=false;const ok=!result.error&&result.checks.length===COMMONS_CODE_CHECKS.length&&result.checks.every(x=>x.ok);const host=root.querySelector('#commonsCodeChecks');host.replaceChildren();if(result.error){const row=document.createElement('div');row.dataset.ok='false';row.textContent=`× ${result.error.text}`;host.append(row);}else result.checks.forEach((check,i)=>{const row=document.createElement('div');row.dataset.ok=String(check.ok);row.textContent=`${check.ok?'✓':'×'} ${COMMONS_CODE_CHECKS[i].detail}`;host.append(row);});if(ok){onProfile({type:'commons-code',xp:420});setText(root,'#commonsCodeStatus','✓ CODE AUTOPILOT DEPLOYED · ты больше не обязан собирать эти семь правил мышкой.');onSound('reward');}else{setText(root,'#commonsCodeStatus',result.error?.hint??'Часть поведения ещё не доказана. Исправляй код, не текст задания.');onSound('blocked');}}

  root.querySelector('#commonsRun').addEventListener('click',simulate);root.querySelector('#commonsSave').addEventListener('click',save);root.querySelector('#commonsNext').addEventListener('click',next);root.querySelector('#commonsDayRun').addEventListener('click',runDay);root.querySelector('#commonsDayNext').addEventListener('click',()=>renderDay(daySeed+1));root.querySelector('#commonsDayOpen').addEventListener('click',()=>{if(!allDone()){onSound('blocked');setText(root,'#commonsStatus','Сначала собери четыре reusable blueprint-а.');return;}renderDay(Math.max(1,(profile().labs.commons?.daySeeds??[]).at(-1)+1||1));});root.querySelector('#commonsCodeOpen').addEventListener('click',openCode);root.querySelector('#commonsCodeRun').addEventListener('click',runCode);root.querySelector('#commonsClose').addEventListener('click',()=>{root.hidden=true;onClose();});
  return {open(){const first=AUTOMATION_BRIEFS.findIndex(b=>!done().has(b.id));index=first<0?AUTOMATION_BRIEFS.length-1:first;renderBrief();root.hidden=false;root.querySelector('#commonsRun').focus({preventScroll:true});},close(){root.hidden=true;},refresh(){if(!root.hidden){setText(root,'#commonsProgress',`${done().size}/${AUTOMATION_BRIEFS.length} АВТОМАТА · ${(profile().labs.commons?.daySeeds??[]).length} ∞ ДНЕЙ`);renderLibrary();}}};
}
