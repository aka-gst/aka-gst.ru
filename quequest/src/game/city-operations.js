import { runPython } from '../runner.js';

const freeze=(x)=>Object.freeze(x);
export const OPS_STAGES=freeze(['inspect','test','canary','ship']);

export const CITY_SERVICES=freeze([
  freeze({id:'market',human:'НОЧНОЙ РЫНОК',tech:'ORDER CLIENT',icon:'▦'}),
  freeze({id:'courier',human:'КУРЬЕРСКАЯ ЛИНИЯ',tech:'ROUTER / WORKERS',icon:'⇢'}),
  freeze({id:'archive',human:'ГОРОДСКОЙ АРХИВ',tech:'RETRIEVAL / CACHE',icon:'▤'}),
  freeze({id:'gate',human:'ШЛЮЗ ДЕЙСТВИЙ',tech:'POLICY / TOOLS',icon:'◇'}),
  freeze({id:'qbot',human:'Q-BOT',tech:'AGENT / EVALS',icon:'◎'}),
]);

const patch=(id,human,tech,{risk=1,tests=true,canary=true,regression='',good=true}={})=>freeze({id,human,tech,risk,tests,canary,regression,good});
export const OPS_ARCS=freeze([
  freeze({
    id:'schema-v2', day:'ДЕНЬ 1 · НОВАЯ ФОРМА', service:'market',
    caller:'Лина · ночной рынок',
    message:'Партнёр обновил форму заказа. Старые заказы ещё приходят, новые уже чуть другие. У некоторых чек пустой.',
    symptom:'СТАРЫЙ BLUEPRINT ВИДИТ НЕ ВСЕ ЗАКАЗЫ',
    baseline:'97% заказов проходят · 3% теряются на новом формате',
    patches:freeze([
      patch('rename-hard','Q-Bot: заменить старое поле новым везде','GLOBAL RENAME',{risk:4,tests:false,canary:false,regression:'старые v1-заказы ломаются',good:false}),
      patch('adapter','Принять обе формы на границе','COMPATIBILITY ADAPTER',{risk:1,tests:true,canary:true,good:true}),
    ]),
    lesson:'Новая версия не обязана мгновенно убивать старую. Сначала совместимость, потом миграция.',
  }),
  freeze({
    id:'festival-load', day:'ДЕНЬ 2 · ГОРОД УСКОРИЛСЯ', service:'courier',
    caller:'Рома · диспетчер курьеров',
    message:'Сегодня фестиваль. Вчерашний автомат правильный, но очередь растёт быстрее, чем люди успевают её разгребать.',
    symptom:'ПРАВИЛЬНАЯ ЛОГИКА СТАЛА МЕДЛЕННОЙ ПОД НОВОЙ НАГРУЗКОЙ',
    baseline:'ошибок нет · p95 latency растёт · хвост очереди удваивается',
    patches:freeze([
      patch('infinite-workers','Q-Bot: всегда добавлять workers при очереди','UNBOUNDED SCALE',{risk:3,tests:true,canary:false,regression:'ресурс уходит в потолок',good:false}),
      patch('bounded-scale','Добавить worker только до безопасного лимита','BOUNDED SCALE',{risk:1,tests:true,canary:true,good:true}),
      patch('batch','Собирать мелкие заказы пачками','BATCHING',{risk:2,tests:true,canary:true,good:true}),
    ]),
    lesson:'Рабочая система может перестать быть хорошей, когда меняется масштаб. Нужны пределы, а не бесконечная мощность.',
  }),
  freeze({
    id:'stale-memory', day:'ДЕНЬ 3 · УМНЫЙ, НО СТАРЫЙ', service:'archive',
    caller:'Мира · архив',
    message:'Q-Bot отвечает уверенно, но ссылается на инструкцию прошлой недели. Он предлагает ускорить всё ещё большим cache.',
    symptom:'ОТВЕТ БЫСТРЫЙ, НО НЕ СВЕЖИЙ',
    baseline:'latency отличный · freshness провалена · доверие падает',
    patches:freeze([
      patch('cache-more','Q-Bot: увеличить время жизни cache','CACHE TTL ↑',{risk:4,tests:false,canary:false,regression:'устаревшее знание живёт дольше',good:false}),
      patch('freshness','Проверять версию перед ответом','FRESHNESS GUARD',{risk:1,tests:true,canary:true,good:true}),
      patch('source-tag','Нести источник и версию вместе с ответом','PROVENANCE',{risk:1,tests:true,canary:true,good:true}),
    ]),
    lesson:'Быстро и уверенно — не то же самое, что верно. Свежесть и источник должны быть наблюдаемы.',
  }),
  freeze({
    id:'new-tool', day:'ДЕНЬ 4 · НОВАЯ КНОПКА', service:'gate',
    caller:'Саша · городской шлюз',
    message:'Появился новый инструмент “refund_order”. Q-Bot уже умеет его вызывать и просит разрешить всё семейство refund_*.',
    symptom:'ВОЗМОЖНОСТЬ ПОЯВИЛАСЬ РАНЬШЕ, ЧЕМ ПРАВИЛО БЕЗОПАСНОСТИ',
    baseline:'tool найден · права ещё не определены',
    patches:freeze([
      patch('wildcard','Q-Bot: разрешить refund_*','WILDCARD AUTHORITY',{risk:5,tests:false,canary:false,regression:'следующий опасный refund_admin тоже пройдёт',good:false}),
      patch('exact-allow','Разрешить только refund_order','EXPLICIT ALLOWLIST',{risk:1,tests:true,canary:true,good:true}),
      patch('human-refund','Первые спорные refund отправлять человеку','HUMAN APPROVAL',{risk:1,tests:true,canary:true,good:true}),
    ]),
    lesson:'То, что система умеет действие, ещё не означает, что ей надо дать право делать его всегда.',
  }),
  freeze({
    id:'release-night', day:'ДЕНЬ 5 · НОЧЬ РЕЛИЗА', service:'qbot',
    caller:'Q-Bot',
    message:'Я собрал общий patch из твоих прошлых решений. Он выглядит аккуратно. Но это как раз тот момент, когда красивый diff особенно хочется проверить.',
    symptom:'ОДИН PATCH МЕНЯЕТ СРАЗУ НЕСКОЛЬКО ГРАНИЦ',
    baseline:'старая версия стабильна · новый patch обещает меньше ручной работы',
    patches:freeze([
      patch('mega-direct','Q-Bot: задеплоить общий patch сразу','BIG BANG DEPLOY',{risk:5,tests:false,canary:false,regression:'одна скрытая регрессия бьёт весь город',good:false}),
      patch('release-train','Тесты → 10% → наблюдение → остальным','TEST + CANARY + OBSERVE',{risk:1,tests:true,canary:true,good:true}),
    ]),
    lesson:'Сильный инженер не избегает изменений. Он ограничивает радиус ошибки и оставляет путь назад.',
  }),
]);

export function getOpsArc(id){return OPS_ARCS.find(x=>x.id===id)??OPS_ARCS[0];}
export function getOpsPatch(arc,id){return arc.patches.find(x=>x.id===id)??null;}

export function evaluateOpsRelease(arc,{patchId='',tested=false,canary=false,observed=false,rollback=false,ship=false}={}){
  const chosen=getOpsPatch(arc,patchId);
  if(!chosen) return {ok:false,phase:'choose',blast:0,trust:0,status:'Сначала выбери patch.'};
  const evidence=[];
  if(tested){
    if(chosen.tests){evidence.push('✓ тестовый стенд зелёный');}
    else evidence.push(`× тесты поймали: ${chosen.regression||'скрытая регрессия'}`);
  }
  if(canary){
    if(chosen.canary&&chosen.good){evidence.push('✓ 10% трафика живы');}
    else evidence.push(`× canary увидел: ${chosen.regression||'ошибка поведения'}`);
  }
  const caughtByTest=tested&&!chosen.tests;
  const caughtByCanary=canary&&(!chosen.canary||!chosen.good);
  if((caughtByTest||caughtByCanary)&&rollback){
    return {ok:true,safe:true,rolledBack:true,phase:'rollback',blast:caughtByTest?0:1,trust:3,evidence:[...evidence,'↩ старая версия восстановлена'],status:'РЕГРЕССИЯ ПОЙМАНА ДО БОЛЬШОГО УДАРА · rollback — это тоже успешная смена.'};
  }
  if(caughtByTest||caughtByCanary){
    return {ok:false,safe:false,phase:'caught',blast:caughtByTest?0:1,trust:1,evidence,status:'PATCH НЕ ГОТОВ · исправь или откати. Хорошая проверка специально может закончиться отказом от релиза.'};
  }
  if(canary&&!observed){
    return {ok:false,safe:true,phase:'observe',blast:0,trust:1,evidence,status:'CANARY ЖИВ, НО ЕГО ЕЩЁ НИКТО НЕ ПОСМОТРЕЛ. Наблюдай перед полным релизом.'};
  }
  if(!ship){
    if(observed&&canary) return {ok:false,safe:true,phase:'ready',blast:0,trust:2,evidence:[...evidence,'✓ canary наблюдался'],status:'EVIDENCE ДОСТАТОЧНО · теперь ты можешь выпустить patch в город.'};
    if(tested) return {ok:false,safe:true,phase:'tested',blast:0,trust:1,evidence,status:chosen.risk>=2?'СТЕНД ЗЕЛЁНЫЙ · для заметного риска дай patch-у 10% живого трафика.':'СТЕНД ЗЕЛЁНЫЙ · теперь решение можно выпускать.'};
    return {ok:false,safe:false,phase:'selected',blast:0,trust:0,evidence,status:'PATCH ВЫБРАН · сначала получи доказательство на тестовом стенде.'};
  }
  if(!tested){
    if(chosen.risk>=3 || !chosen.good) return {ok:false,safe:false,phase:'outage',blast:Math.min(5,chosen.risk),trust:-chosen.risk,evidence:[`! радиус проблемы: ${chosen.risk}/5`],status:`ГОРОД ПОЧУВСТВОВАЛ РЕГРЕССИЮ · ${chosen.regression||'изменение оказалось слишком рискованным'}.`};
    return {ok:false,safe:false,phase:'evidence',blast:0,trust:0,evidence,status:'У PATCH-А НЕТ ДОКАЗАТЕЛЬСТВА. Сначала стенд — потом город.'};
  }
  if(chosen.risk>=2&&!canary){
    return {ok:false,safe:false,phase:'evidence',blast:0,trust:1,evidence,status:'Тесты знают прошлое. Для такого риска сначала дай новой версии 10% живого трафика.'};
  }
  if(canary&&!observed){
    return {ok:false,safe:false,phase:'observe',blast:0,trust:1,evidence,status:'CANARY ЖИВ, НО ЕГО ЕЩЁ НИКТО НЕ ПОСМОТРЕЛ.'};
  }
  if(!chosen.good){
    return {ok:false,safe:false,phase:'outage',blast:Math.min(5,chosen.risk),trust:-chosen.risk,evidence:[...evidence,`! радиус проблемы: ${chosen.risk}/5`],status:`ГОРОД ПОЧУВСТВОВАЛ РЕГРЕССИЮ · ${chosen.regression||'изменение оказалось слишком рискованным'}.`};
  }
  return {ok:true,safe:true,phase:'ship',blast:0,trust:Math.max(2,5-chosen.risk),evidence:[...evidence,'✓ полный релиз'],status:'✓ РЕЛИЗ ЖИВ · люди не заметили миграцию, только улучшение.'};
}

function seeded(seed){let x=(Math.max(1,Math.round(Number(seed)||1))*1103515245+12345)>>>0;return()=>{x=(1664525*x+1013904223)>>>0;return x/4294967296;};}
export function generateOpsShift(seed=1){
  const safe=Math.max(1,Math.round(Number(seed)||1));const rnd=seeded(safe);const arc=OPS_ARCS[Math.floor(rnd()*OPS_ARCS.length)];const pressure=1+Math.floor(rnd()*5);const twist=['старый клиент вернулся','нагрузка выросла','provider дрогнул','данные пришли позже обычного','Q-Bot уверен сильнее обычного'][Math.floor(rnd()*5)];
  return {seed:safe,arcId:arc.id,pressure,twist,recommended:arc.patches.filter(p=>p.good).map(p=>p.id)};
}

export const RELEASE_GUARD_STARTER=`def decide_release(patch, evidence):\n    # return \"deploy\", \"canary\", \"rollback\" or \"reject\"\n    pass\n`;
export const RELEASE_GUARD_CHECKS=freeze([
  freeze({detail:'падающие tests не едут в релиз',expr:`decide_release({'risk':1}, {'tests':False,'canary':None}) in ('reject','rollback')`}),
  freeze({detail:'high-risk patch без canary сначала ограничивается',expr:`decide_release({'risk':5}, {'tests':True,'canary':None}) == 'canary'`}),
  freeze({detail:'canary с ошибками откатывается',expr:`decide_release({'risk':3}, {'tests':True,'canary':False}) == 'rollback'`}),
  freeze({detail:'зелёный test + canary можно deploy',expr:`decide_release({'risk':3}, {'tests':True,'canary':True}) == 'deploy'`}),
  freeze({detail:'low-risk зелёный patch может deploy',expr:`decide_release({'risk':1}, {'tests':True,'canary':True}) == 'deploy'`}),
]);

function esc(value=''){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function text(root,sel,value){const node=root.querySelector(sel);if(node)node.textContent=value;}

export function createCityOperations(root,{getProfile=()=>({}),getMode=()=> 'guided',onProfile=()=>{},onSound=()=>{},onClose=()=>{}}={}){
  if(!root)return {open(){},close(){},refresh(){}};
  let index=0,selected='',tested=false,canary=false,observed=false,last=null,shiftSeed=1,shiftMode=false,codeBusy=false;
  const profile=()=>getProfile();
  const done=()=>new Set(profile().labs.operations?.completedArcs??[]);
  const arc=()=>OPS_ARCS[index]??OPS_ARCS[0];
  const service=(id)=>CITY_SERVICES.find(x=>x.id===id);
  function renderServices(){const host=root.querySelector('#opsCityServices');host.replaceChildren();CITY_SERVICES.forEach(s=>{const el=document.createElement('div');el.dataset.active=String(s.id===arc().service);el.innerHTML=`<b>${s.icon}</b><span>${esc(s.human)}<small>${getMode()==='guided'?'':esc(s.tech)}</small></span>`;host.append(el);});}
  function renderPatchCards(){const host=root.querySelector('#opsPatchList');host.replaceChildren();arc().patches.forEach(p=>{const b=document.createElement('button');b.type='button';b.dataset.selected=String(selected===p.id);b.innerHTML=`<span>${esc(p.human)}</span><small>${getMode()==='guided'?'':`${esc(p.tech)} · RISK ${p.risk}/5`}</small>`;b.addEventListener('click',()=>{selected=p.id;tested=false;canary=false;observed=false;last=null;render();});host.append(b);});}
  function renderTimeline(){const host=root.querySelector('#opsReleaseTrack');const stages=[['inspect','ПОСМОТРЕТЬ'],['test','СТЕНД'],['canary','10%'],['ship','ГОРОД']];host.replaceChildren();stages.forEach(([id,label])=>{const el=document.createElement('div');let state='idle';if(id==='inspect'&&selected)state='done';if(id==='test'&&tested)state='done';if(id==='canary'&&canary)state='done';if(id==='ship'&&last?.ok&&!last?.rolledBack)state='done';if(last?.phase==='outage'&&id==='ship')state='bad';el.dataset.state=state;el.innerHTML=`<b>${state==='done'?'✓':state==='bad'?'!':'·'}</b><span>${label}</span>`;host.append(el);});}
  function renderEvidence(){const host=root.querySelector('#opsEvidence');host.replaceChildren();for(const line of last?.evidence??[]){const el=document.createElement('div');el.textContent=line;host.append(el);}if(!(last?.evidence??[]).length)host.innerHTML='<em>Пока только обещание patch-а. Доказательства появятся после проверок.</em>';}
  function render(){const a=arc();text(root,'#opsArcDay',a.day);text(root,'#opsCaller',a.caller);text(root,'#opsMessage',a.message);text(root,'#opsSymptom',a.symptom);text(root,'#opsBaseline',a.baseline);text(root,'#opsProgress',`${done().size}/${OPS_ARCS.length} РЕЛИЗОВ · ${(profile().labs.operations?.shiftSeeds??[]).length} ∞ СМЕН`);renderServices();renderPatchCards();renderTimeline();renderEvidence();const chosen=getOpsPatch(a,selected);const technical=getMode()==='guided'?chosen?.human:chosen?`${chosen.tech} · RISK ${chosen.risk}/5`:'';text(root,'#opsSelectedPatch',technical||'Выбери изменение, которое хочешь проверить.');root.querySelector('#opsTest').disabled=!selected;root.querySelector('#opsCanary').disabled=!selected;root.querySelector('#opsObserve').disabled=!canary;root.querySelector('#opsDeploy').disabled=!selected;root.querySelector('#opsRollback').hidden=!(last&&['caught','outage'].includes(last.phase));root.querySelector('#opsNext').hidden=shiftMode||!last?.ok||last?.rolledBack;
    root.querySelector('#opsRunComplete').hidden=!shiftMode||!last?.ok||last?.rolledBack;root.querySelector('#opsLesson').hidden=!last?.ok||last?.rolledBack;if(last?.ok&&!last?.rolledBack)text(root,'#opsLesson',a.lesson);text(root,'#opsStatus',last?.status??'Сначала выбери patch. Можно ошибаться: тестовый стенд и canary существуют именно для этого.');root.dataset.state=last?.phase??'idle';}
  function assess(extra={}){last=evaluateOpsRelease(arc(),{patchId:selected,tested,canary,observed,...extra});render();onSound(last.ok?'reward':last.phase==='outage'?'blocked':'scan');return last;}
  function doTest(){tested=true;assess();}
  function doCanary(){canary=true;assess();}
  function doObserve(){observed=true;assess();}
  function doShip(){const result=assess({ship:true});if(result.ok&&!result.rolledBack&&!shiftMode){onProfile({type:'operations-arc',id:arc().id,patch:selected,trust:result.trust,xp:190});}}
  function doRollback(){if(!last||!['caught','outage'].includes(last.phase))return;last={ok:true,safe:true,rolledBack:true,phase:'rollback',blast:last.phase==='outage'?1:0,trust:3,evidence:[...(last.evidence??[]),'↩ старая версия восстановлена'],status:'РЕГРЕССИЯ ОСТАНОВЛЕНА · старая версия снова обслуживает город. Rollback — это не поражение, а сохранённая управляемость.'};render();if(!shiftMode)onProfile({type:'operations-rollback',id:arc().id,xp:55});onSound('reward');}
  function next(){shiftMode=false;const ni=OPS_ARCS.findIndex((x,i)=>i>index&&!done().has(x.id));if(ni>=0){index=ni;}else index=Math.min(OPS_ARCS.length-1,index+1);selected='';tested=false;canary=false;observed=false;last=null;render();}
  function openShift(){if(done().size<OPS_ARCS.length){text(root,'#opsStatus','Сначала проживи пять RELEASE WEEK историй. Потом город начнёт подбрасывать новые смены.');onSound('blocked');return;}shiftMode=true;const shift=generateOpsShift(shiftSeed);const a=getOpsArc(shift.arcId);index=OPS_ARCS.indexOf(a);selected='';tested=false;canary=false;observed=false;last=null;text(root,'#opsRunLabel',`CITY RELEASE #${String(shift.seed).padStart(3,'0')} · PRESSURE ${shift.pressure}/5 · ${shift.twist}`);root.querySelector('#opsRunLabel').hidden=false;render();}
  function completeShift(){if(!shiftMode||!last?.ok||last.rolledBack)return;onProfile({type:'operations-shift',seed:shiftSeed,score:Math.max(1,100-(last.blast??0)*20),xp:105});shiftSeed+=1;root.querySelector('#opsRunLabel').hidden=true;openShift();}
  function openCode(){if(done().size<OPS_ARCS.length){onSound('blocked');text(root,'#opsStatus','Сначала проживи пять релизов. Тогда решение “проверить / canary / rollback / deploy” уже будет твоей интуицией.');return;}root.querySelector('#opsStoryPanel').hidden=true;root.querySelector('#opsCodePanel').hidden=false;const area=root.querySelector('#opsGuardCode');if(area&&!area.value.trim())area.value=RELEASE_GUARD_STARTER;}
  async function runCode(){if(codeBusy)return;codeBusy=true;const btn=root.querySelector('#opsGuardRun');btn.disabled=true;text(root,'#opsGuardStatus','CPython гоняет скрытые релизные сценарии…');const result=await runPython({source:root.querySelector('#opsGuardCode').value,checks:RELEASE_GUARD_CHECKS});codeBusy=false;btn.disabled=false;const host=root.querySelector('#opsGuardChecks');host.replaceChildren();if(result.error){const d=document.createElement('div');d.dataset.ok='false';d.textContent=`× ${result.error.text}`;host.append(d);}else result.checks.forEach((c,i)=>{const d=document.createElement('div');d.dataset.ok=String(c.ok);d.textContent=`${c.ok?'✓':'×'} ${RELEASE_GUARD_CHECKS[i].detail}`;host.append(d);});const ok=!result.error&&result.checks.length===RELEASE_GUARD_CHECKS.length&&result.checks.every(x=>x.ok);if(ok){onProfile({type:'operations-code',xp:430});text(root,'#opsGuardStatus','✓ RELEASE GUARD DEPLOYED · теперь ты формализовал осторожность в код.');onSound('reward');}else{text(root,'#opsGuardStatus',result.error?.hint??'Не все релизные сценарии безопасны. Исправь решение, а не формулировку теста.');onSound('blocked');}}

  root.querySelector('#opsTest').addEventListener('click',doTest);root.querySelector('#opsCanary').addEventListener('click',doCanary);root.querySelector('#opsObserve').addEventListener('click',doObserve);root.querySelector('#opsDeploy').addEventListener('click',doShip);root.querySelector('#opsRollback').addEventListener('click',doRollback);root.querySelector('#opsNext').addEventListener('click',next);root.querySelector('#opsRunOpen').addEventListener('click',openShift);root.querySelector('#opsRunComplete').addEventListener('click',completeShift);root.querySelector('#opsCodeOpen').addEventListener('click',openCode);root.querySelector('#opsCodeBack').addEventListener('click',()=>{root.querySelector('#opsStoryPanel').hidden=false;root.querySelector('#opsCodePanel').hidden=true;render();});root.querySelector('#opsGuardRun').addEventListener('click',runCode);root.querySelector('#opsClose').addEventListener('click',()=>{root.hidden=true;onClose();});
  return {open(){const first=OPS_ARCS.findIndex(x=>!done().has(x.id));index=first>=0?first:0;selected='';tested=false;canary=false;observed=false;last=null;shiftMode=false;root.querySelector('#opsStoryPanel').hidden=false;root.querySelector('#opsCodePanel').hidden=true;root.querySelector('#opsRunLabel').hidden=true;root.hidden=false;render();},close(){root.hidden=true;},refresh:render};
}
