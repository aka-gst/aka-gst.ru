export const OPS_DESK_CASES = Object.freeze([
  Object.freeze({
    id:'receipt-loop', tag:'CASE 01 · ПРИЗРАЧНАЯ КВИТАНЦИЯ', caller:'SHIFT LEAD',
    title:'Заказ один. Квитанции две.',
    message:'Клиент говорит, что всё оплатил один раз. В журнале внезапно две записи. Не угадывай — собери доказательства.',
    evidence:Object.freeze({
      inbox:'Клиент: «квитанция пришла, но окно ответа зависло на несколько секунд».',
      logs:'LEDGER · order=42 · WRITE OK · 02:14:07',
      trace:'GATEWAY · timeout 02:14:09 → retry scheduled',
      files:'WORKER POLICY · retry timeout up to 2 times',
    }),
    graph:Object.freeze([
      ['CLIENT','ok'],['GATEWAY','warn'],['WORKER','warn'],['LEDGER','ok'],['RETRY','danger'],
    ]),
    diagnoses:['СЕРВЕР НЕ ЗАПИСАЛ','РЕЗУЛЬТАТ НЕИЗВЕСТЕН ПОСЛЕ ЭФФЕКТА','КЛИЕНТ ОТПРАВИЛ ДВА ЗАКАЗА'],
    diagnosis:'РЕЗУЛЬТАТ НЕИЗВЕСТЕН ПОСЛЕ ЭФФЕКТА',
    fixes:['БЕСКОНЕЧНЫЙ RETRY','IDEMPOTENCY KEY','ЕЩЁ ОДИН WORKER'],
    fix:'IDEMPOTENCY KEY',
    lesson:'Если side effect уже мог произойти, повтор должен быть безопасным.',
    qbot:'Я вижу timeout, но timeout сам по себе не говорит, выполнилась ли запись.',
  }),
  Object.freeze({
    id:'stale-answer', tag:'CASE 02 · СТАРАЯ ПАМЯТЬ', caller:'Q-BOT',
    title:'Я отвечаю уверенно. Но старой версией.',
    message:'Q-Bot ссылается на инструкцию v2, хотя смена уже работает по v4. Найди, где застряло прошлое.',
    evidence:Object.freeze({
      inbox:'Оператор: «ответ Q-Bot звучит убедительно, но шаги из старого runbook».',
      logs:'EVAL · current_version · FAIL · expected=v4 got=v2',
      trace:'RETRIEVAL → chunk runbook-v2 · score 0.91',
      files:'RUNBOOK INDEX · v4 current · v2 archived',
    }),
    graph:Object.freeze([
      ['QUESTION','ok'],['RETRIEVAL','warn'],['MODEL','ok'],['ANSWER','danger'],['EVAL','warn'],
    ]),
    diagnoses:['МОДЕЛЬ СЛИШКОМ МАЛЕНЬКАЯ','УСТАРЕВШИЙ КОНТЕКСТ','НЕ ХВАТАЕТ WORKERS'],
    diagnosis:'УСТАРЕВШИЙ КОНТЕКСТ',
    fixes:['ЕЩЁ ЭПОХИ','PROVENANCE + EVAL','ОТКЛЮЧИТЬ LOGS'],
    fix:'PROVENANCE + EVAL',
    lesson:'Хороший ответ без происхождения и eval может быть красиво устаревшим.',
    qbot:'Я уверен, потому что нашёл похожий текст. Это ещё не значит, что текст актуальный.',
  }),
  Object.freeze({
    id:'green-but-dead', tag:'CASE 03 · ЗЕЛЁНЫЙ, НО НЕ ГОТОВ', caller:'OPS SIGNAL',
    title:'Лампочка зелёная. Заказы стоят.',
    message:'Дашборд показывает HEALTH 200. Но новые задания не проходят. Раздели «процесс жив» и «система готова».',
    evidence:Object.freeze({
      inbox:'Смена: «панель зелёная, но поиск документов не отвечает».',
      logs:'RETRIEVAL STORE · connection refused',
      trace:'/health 200 · /ready 503 · retrieval=false',
      files:'RUNBOOK · health = process alive · ready = required dependencies usable',
    }),
    graph:Object.freeze([
      ['PROCESS','ok'],['HEALTH','ok'],['READY','danger'],['RETRIEVAL','danger'],['ORDERS','warn'],
    ]),
    diagnoses:['СЕРВИС УМЕР','СЕРВИС ЖИВ, НО НЕ ГОТОВ','МОДЕЛЬ ПЕРЕОБУЧИЛАСЬ'],
    diagnosis:'СЕРВИС ЖИВ, НО НЕ ГОТОВ',
    fixes:['ПЕРЕОБУЧИТЬ MODEL','FIX DEPENDENCY','СКРЫТЬ READY CHECK'],
    fix:'FIX DEPENDENCY',
    lesson:'Liveness и readiness отвечают на разные вопросы.',
    qbot:'Зелёный health доказывает только, что процесс отвечает. Я бы посмотрел на зависимости.',
  }),
  Object.freeze({
    id:'silent-stream', tag:'CASE 04 · МОЛЧАЩИЙ ПОТОК', caller:'DESK CLIENT',
    title:'Ответ идёт девять секунд. Потом падает целиком.',
    message:'Provider выдаёт части ответа сразу. Пользователь всё равно ждёт до конца. Найди, на каком участке поток перестал быть потоком.',
    evidence:Object.freeze({
      inbox:'Пользователь: «курсор мигает девять секунд, затем весь ответ появляется сразу».',
      logs:'PROVIDER · chunk 1..6 delivered every 0.7s',
      trace:'GATEWAY forwards chunks ✓ · CLIENT flush=end',
      files:'CLIENT RENDER MODE · buffer_all=true',
    }),
    graph:Object.freeze([
      ['PROVIDER','ok'],['GATEWAY','ok'],['CLIENT','danger'],['SCREEN','warn'],
    ]),
    diagnoses:['PROVIDER НЕ STREAMИТ','CLIENT БУФЕРИЗУЕТ ПОТОК','НУЖЕН БОЛЬШЕ TIMEOUT'],
    diagnosis:'CLIENT БУФЕРИЗУЕТ ПОТОК',
    fixes:['RENDER CHUNKS AS THEY ARRIVE','УВЕЛИЧИТЬ RETRY','СМЕНИТЬ MODEL'],
    fix:'RENDER CHUNKS AS THEY ARRIVE',
    lesson:'Streaming — контракт через все участки пути, а не свойство одной модели.',
    qbot:'Я вижу chunks до клиента. Значит, молчание начинается после gateway.',
  }),
  Object.freeze({
    id:'claim-only', tag:'CASE 05 · «ТЕСТЫ ПРОШЛИ»', caller:'BUILD BOT',
    title:'Агент говорит PASS. Доказательств нет.',
    message:'Новый patch выглядит аккуратно. Агент уверяет, что всё зелёное. Но ни одной команды в trace нет.',
    evidence:Object.freeze({
      inbox:'BUILD BOT: «готово, tests passed».',
      logs:'COMMAND HISTORY · no test command recorded',
      trace:'PATCH → CLAIM PASS → DRAFT PR · evidence gap',
      files:'RUNBOOK · proof = command + exit code + output',
    }),
    graph:Object.freeze([
      ['PATCH','ok'],['CLAIM','warn'],['TEST','danger'],['EVIDENCE','danger'],['PR','warn'],
    ]),
    diagnoses:['PATCH ПЛОХОЙ','ЗАЯВЛЕНИЕ БЕЗ ДОКАЗАТЕЛЬСТВА','CI СЛИШКОМ МЕДЛЕННЫЙ'],
    diagnosis:'ЗАЯВЛЕНИЕ БЕЗ ДОКАЗАТЕЛЬСТВА',
    fixes:['RUN TEST + CAPTURE EXIT/OUTPUT','ПОВЕРИТЬ АГЕНТУ','СРАЗУ MERGE'],
    fix:'RUN TEST + CAPTURE EXIT/OUTPUT',
    lesson:'Уверенность агента не заменяет наблюдаемое evidence.',
    qbot:'Я тоже могу звучать уверенно. Лучше спроси: «какая команда это доказала?»',
  }),
]);

const COMMAND_ALIASES = Object.freeze({
  inbox:'inbox', mail:'inbox', messages:'inbox',
  logs:'logs', log:'logs', journal:'logs',
  trace:'trace', map:'trace', route:'trace',
  files:'files', file:'files', docs:'files',
  help:'help', '?':'help', notes:'notes',
});
export const OPS_DESK_COMMANDS = Object.freeze(['inbox','logs','trace','files','notes','help']);

export function normalizeDeskCommand(value='') {
  const raw=String(value).trim().toLowerCase().replace(/\s+/g,' ');
  return COMMAND_ALIASES[raw] ?? '';
}

export function completeDeskCommand(prefix='') {
  const p=String(prefix).trim().toLowerCase();
  if(!p) return '';
  const matches=OPS_DESK_COMMANDS.filter(command=>command.startsWith(p));
  return matches.length===1 ? matches[0] : '';
}

export function evaluateOpsCase(caseDef,{evidence=[],diagnosis='',fix=''}={}) {
  const found=[...new Set(evidence)].filter(id=>Object.hasOwn(caseDef.evidence,id));
  const enough=found.length>=3;
  const diagnosisOk=diagnosis===caseDef.diagnosis;
  const fixOk=fix===caseDef.fix;
  const ok=enough&&diagnosisOk&&fixOk;
  return {
    ok,enough,diagnosisOk,fixOk,found,
    score:(enough?30:found.length*8)+(diagnosisOk?30:0)+(fixOk?40:0),
    message: ok
      ? `CASE CLOSED · ${caseDef.lesson}`
      : !enough
        ? `Нужно ещё evidence: ${found.length}/3. Не угадывай по одному симптому.`
        : !diagnosisOk
          ? 'Evidence собрано, но диагноз не объясняет всю цепочку. Сопоставь время и границы.'
          : 'Причина найдена. Выбранное действие лечит не её.',
  };
}

const INCIDENT_PATTERNS = Object.freeze([
  {id:'queue',symptom:'Входные события приходят рывком; один worker стабилен, но очередь исчезает и часть груза теряется.',diagnosis:'НЕТ БУФЕРА ДЛЯ BURST',fix:'QUEUE',layer:'FLOW'},
  {id:'duplicate',symptom:'После timeout система повторяет запрос, а ledger получает две одинаковые записи.',diagnosis:'ПОВТОР НЕ ИДЕМПОТЕНТЕН',fix:'IDEMPOTENCY',layer:'EFFECT'},
  {id:'stale',symptom:'Ответ уверенно цитирует архивный документ, хотя новый уже лежит в индексе.',diagnosis:'STALE RETRIEVAL',fix:'PROVENANCE + EVAL',layer:'CONTEXT'},
  {id:'rate',symptom:'Один запрос проходит. Восемь параллельных получают 429 и ещё сильнее увеличивают давление.',diagnosis:'RATE LIMIT PRESSURE',fix:'BACKOFF + QUEUE',layer:'PROVIDER'},
  {id:'ready',symptom:'Процесс отвечает 200, но зависимость хранения недоступна и задания не выполняются.',diagnosis:'NOT READY',fix:'FIX DEPENDENCY',layer:'SERVICE'},
  {id:'claim',symptom:'Агент обещает PASS, но в trace отсутствуют команда, exit code и output.',diagnosis:'CLAIM WITHOUT EVIDENCE',fix:'RUN + CAPTURE EVIDENCE',layer:'DEV LOOP'},
  {id:'schema',symptom:'HTTP 200, но downstream не находит обязательное поле action.',diagnosis:'APPLICATION CONTRACT BROKEN',fix:'VALIDATE SCHEMA',layer:'BOUNDARY'},
  {id:'policy',symptom:'Найденный инструмент может удалить данные и попадает planner без отдельного разрешения.',diagnosis:'CAPABILITY BECAME AUTHORITY',fix:'POLICY ALLOWLIST',layer:'TOOLS'},
]);
function seeded(seed){let x=(Math.max(1,Math.round(Number(seed)||1))*2654435761)>>>0;return()=>{x=(1664525*x+1013904223)>>>0;return x/4294967296;};}
export function generateOpsIncident(seed=1){
  const safe=Math.max(1,Math.round(Number(seed)||1));const rnd=seeded(safe);const base=INCIDENT_PATTERNS[Math.floor(rnd()*INCIDENT_PATTERNS.length)];
  const distractors=INCIDENT_PATTERNS.filter(x=>x.id!==base.id).sort(()=>rnd()-.5).slice(0,2);
  const diagnoses=[base.diagnosis,...distractors.map(x=>x.diagnosis)].sort(()=>rnd()-.5);
  const fixes=[base.fix,...distractors.map(x=>x.fix)].sort(()=>rnd()-.5);
  return {...base,seed:safe,diagnoses,fixes};
}
export function evaluateOpsIncident(incident,{diagnosis='',fix=''}={}){
  const diagnosisOk=diagnosis===incident.diagnosis,fixOk=fix===incident.fix;
  return {ok:diagnosisOk&&fixOk,diagnosisOk,fixOk,score:(diagnosisOk?45:0)+(fixOk?55:0),message:diagnosisOk&&fixOk?'RESTORED · причина и действие совпали.':(!diagnosisOk?'Симптомы ещё не сведены в одну причинную цепь.':'Диагноз верный, но действие лечит не эту причину.')};
}

function setText(root,selector,value){const node=root.querySelector(selector);if(node)node.textContent=value;}
function appTitle(id){return ({dispatch:'DISPATCH',notes:'NOTES',map:'TRACE MAP',terminal:'TERMINAL'})[id]??id.toUpperCase();}

export function createOpsDesk(root,{getProfile,onProfile=()=>{},onSound=()=>{},onClose=()=>{},getMode=()=> 'guided'}={}){
  let caseIndex=0,found=new Set(),diagnosis='',fix='',activeApp='dispatch',closed=false;
  let incidentSeed=1,currentIncident=null,incidentDiagnosis='',incidentFix='';
  const current=()=>OPS_DESK_CASES[caseIndex];
  const completed=()=>getProfile()?.labs?.desk?.completedMissions??[];

  function discover(source){
    const c=current(); if(!Object.hasOwn(c.evidence,source)) return;
    const first=!found.has(source);found.add(source);if(first)onSound('scan');renderNotes();renderObjective();tryResolve();
  }
  function renderGraph(){
    const c=current(),node=root.querySelector('#deskGraph');node.replaceChildren();
    c.graph.forEach(([label,status],index)=>{const wrap=document.createElement('span');wrap.className='ops-node';wrap.dataset.status=status;wrap.innerHTML=`<small>${index+1}</small><b></b>`;wrap.querySelector('b').textContent=label;node.append(wrap);if(index<c.graph.length-1){const arrow=document.createElement('i');arrow.textContent='→';node.append(arrow);}});
  }
  function renderNotes(){
    const notes=root.querySelector('#deskEvidence');notes.replaceChildren();
    const c=current();
    for(const id of ['inbox','logs','trace','files']){
      const item=document.createElement('article');item.dataset.found=String(found.has(id));
      const small=document.createElement('small');small.textContent=found.has(id)?id.toUpperCase():'НЕИЗВЕСТНО';
      const p=document.createElement('p');p.textContent=found.has(id)?c.evidence[id]:'Открой приложение или используй terminal, чтобы получить evidence.';
      item.append(small,p);notes.append(item);
    }
  }
  function renderChoices(){
    const c=current();
    const diagnoses=root.querySelector('#deskDiagnoses');diagnoses.replaceChildren();
    c.diagnoses.forEach(label=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.on=String(diagnosis===label);b.addEventListener('click',()=>{diagnosis=label;onSound('select');renderChoices();tryResolve();});diagnoses.append(b);});
    const fixes=root.querySelector('#deskFixes');fixes.replaceChildren();
    c.fixes.forEach(label=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.on=String(fix===label);b.addEventListener('click',()=>{fix=label;onSound('wire');renderChoices();tryResolve();});fixes.append(b);});
  }
  function renderObjective(){setText(root,'#deskObjective',`${found.size}/3 EVIDENCE · ${diagnosis?'ДИАГНОЗ ✓':'ДИАГНОЗ —'} · ${fix?'ДЕЙСТВИЕ ✓':'ДЕЙСТВИЕ —'}`);}
  function renderCase(){
    const c=current();closed=completed().includes(c.id);found=new Set();diagnosis='';fix='';activeApp='dispatch';
    setText(root,'#deskCaseNo',`${caseIndex+1}/${OPS_DESK_CASES.length}`);setText(root,'#deskCaseTag',c.tag);setText(root,'#deskCaller',c.caller);setText(root,'#deskCaseTitle',c.title);setText(root,'#deskMessage',c.message);setText(root,'#deskQbot',c.qbot);setText(root,'#deskProgress',`${completed().length}/${OPS_DESK_CASES.length} CASES`);
    root.querySelector('#deskCaseClosed').hidden=true;root.querySelector('#deskNextCase').hidden=true;renderGraph();renderNotes();renderChoices();renderObjective();switchApp('dispatch');
    const incidentsUnlocked=completed().length>=OPS_DESK_CASES.length;root.querySelector('#deskIncidentPanel').hidden=!incidentsUnlocked;if(incidentsUnlocked&&!currentIncident)loadIncident((getProfile()?.labs?.desk?.incidentSeeds?.at(-1)??0)+1);
  }
  function switchApp(id){activeApp=id;for(const b of root.querySelectorAll('[data-desk-app]'))b.dataset.on=String(b.dataset.deskApp===id);for(const panel of root.querySelectorAll('[data-desk-panel]'))panel.hidden=panel.dataset.deskPanel!==id;setText(root,'#deskWindowTitle',appTitle(id));if(id==='notes')renderNotes();if(id==='map'){discover('trace');renderGraph();}if(id==='dispatch')discover('inbox');if(id==='terminal')root.querySelector('#deskTerminalInput').focus({preventScroll:true});}
  function runCommand(value){
    const command=normalizeDeskCommand(value);const output=root.querySelector('#deskTerminalOutput');
    if(!command){output.textContent='Не узнал команду. Здесь нет штрафа за опечатку — выбери подсказку ниже.';onSound('blocked');return false;}
    if(command==='help'){output.textContent='inbox · logs · trace · files · notes — команды короткие. TAB дополняет уникальный префикс.';return true;}
    if(command==='notes'){switchApp('notes');output.textContent='Открыл NOTES. Всё найденное сохраняется автоматически.';return true;}
    discover(command);output.textContent=`${command.toUpperCase()} → evidence captured · ${current().evidence[command]}`;return true;
  }
  function tryResolve(){
    if(closed)return;const result=evaluateOpsCase(current(),{evidence:[...found],diagnosis,fix});setText(root,'#deskHypothesisStatus',result.message);root.querySelector('#deskHypothesis').dataset.ok=String(result.ok);
    if(result.ok){closed=true;onProfile({type:'lab-mission',lab:'desk',id:current().id,patch:{bestScore:Math.max(getProfile()?.labs?.desk?.bestScore??0,result.score)},xp:140});onSound('reward');root.querySelector('#deskCaseClosed').hidden=false;root.querySelector('#deskNextCase').hidden=false;setText(root,'#deskProgress',`${completed().length}/${OPS_DESK_CASES.length} CASES`);if(completed().length>=OPS_DESK_CASES.length){onProfile({type:'desk-complete'});root.querySelector('#deskIncidentPanel').hidden=false;if(!currentIncident)loadIncident((getProfile()?.labs?.desk?.incidentSeeds?.at(-1)??0)+1);}}
  }
  function loadIncident(seed){currentIncident=generateOpsIncident(seed);incidentSeed=currentIncident.seed;incidentDiagnosis='';incidentFix='';setText(root,'#deskIncidentSeed',`DESK SHIFT #${String(incidentSeed).padStart(3,'0')}`);setText(root,'#deskIncidentLayer',currentIncident.layer);setText(root,'#deskIncidentSymptom',currentIncident.symptom);setText(root,'#deskIncidentStatus','Собери причинную гипотезу. Никаких реальных сетей — это синтетическая фабрика.');root.querySelector('#deskIncidentNext').hidden=true;
    const d=root.querySelector('#deskIncidentDiagnoses');d.replaceChildren();currentIncident.diagnoses.forEach(label=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',()=>{incidentDiagnosis=label;for(const x of d.children)x.dataset.on=String(x===b);});d.append(b);});
    const f=root.querySelector('#deskIncidentFixes');f.replaceChildren();currentIncident.fixes.forEach(label=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',()=>{incidentFix=label;for(const x of f.children)x.dataset.on=String(x===b);});f.append(b);});
  }

  root.querySelectorAll('[data-desk-app]').forEach(b=>b.addEventListener('click',()=>switchApp(b.dataset.deskApp)));
  root.querySelectorAll('[data-desk-evidence]').forEach(b=>b.addEventListener('click',()=>{const source=b.dataset.deskEvidence;discover(source);if(source==='trace')switchApp('map');else if(source==='inbox')switchApp('dispatch');else switchApp('notes');}));
  const input=root.querySelector('#deskTerminalInput');
  input.addEventListener('keydown',event=>{if(event.key==='Tab'){const completed=completeDeskCommand(input.value);if(completed){event.preventDefault();input.value=completed;}}if(event.key==='Enter'){event.preventDefault();const ok=runCommand(input.value);if(ok)onSound('select');input.select();}});
  root.querySelector('#deskTerminalRun').addEventListener('click',()=>{const ok=runCommand(input.value);if(ok)onSound('select');input.focus();input.select();});
  root.querySelectorAll('[data-desk-command]').forEach(b=>b.addEventListener('click',()=>{input.value=b.dataset.deskCommand;runCommand(input.value);onSound('select');}));
  root.querySelector('#deskNextCase').addEventListener('click',()=>{caseIndex=Math.min(OPS_DESK_CASES.length-1,caseIndex+1);renderCase();});
  root.querySelector('#deskPrevCase').addEventListener('click',()=>{caseIndex=Math.max(0,caseIndex-1);renderCase();});
  root.querySelector('#deskIncidentRun').addEventListener('click',()=>{if(!currentIncident)return;const result=evaluateOpsIncident(currentIncident,{diagnosis:incidentDiagnosis,fix:incidentFix});setText(root,'#deskIncidentStatus',result.message);root.querySelector('#deskIncidentPanel').dataset.ok=String(result.ok);onSound(result.ok?'reward':'blocked');if(result.ok){onProfile({type:'desk-incident',seed:incidentSeed,score:result.score,xp:85});root.querySelector('#deskIncidentNext').hidden=false;}});
  root.querySelector('#deskIncidentNext').addEventListener('click',()=>loadIncident(incidentSeed+1));
  root.querySelector('#deskClose').addEventListener('click',()=>{root.hidden=true;onClose();});
  return {open(){const done=new Set(completed());const next=OPS_DESK_CASES.findIndex(c=>!done.has(c.id));caseIndex=next<0?OPS_DESK_CASES.length-1:next;root.hidden=false;renderCase();root.querySelector('[data-desk-app="dispatch"]').focus({preventScroll:true});},close(){root.hidden=true;},refresh:renderCase};
}
