export const AUTOMATION_MODULES = Object.freeze([
  Object.freeze({ id:'scan', label:'SCAN', hint:'найти входные файлы/строки' }),
  Object.freeze({ id:'validate', label:'VALIDATE', hint:'проверить форму до действия' }),
  Object.freeze({ id:'dryrun', label:'DRY-RUN', hint:'сначала показать план без записи' }),
  Object.freeze({ id:'normalize', label:'NORMALIZE', hint:'привести поля к одной форме' }),
  Object.freeze({ id:'dedupe', label:'DEDUPE', hint:'не обработать дубль дважды' }),
  Object.freeze({ id:'checkpoint', label:'CHECKPOINT', hint:'уметь продолжить после остановки' }),
  Object.freeze({ id:'retry', label:'RETRY', hint:'повторить временный сбой ограниченно' }),
  Object.freeze({ id:'idempotency', label:'IDEMPOTENCY', hint:'повтор не создаёт второй эффект' }),
  Object.freeze({ id:'timeout', label:'TIMEOUT', hint:'ограничить ожидание внешнего шага' }),
  Object.freeze({ id:'log', label:'LOG', hint:'оставить объяснимый след' }),
  Object.freeze({ id:'adapter', label:'ADAPTER', hint:'провайдер за общим интерфейсом' }),
  Object.freeze({ id:'schema', label:'SCHEMA', hint:'структурированный ответ' }),
  Object.freeze({ id:'redact', label:'REDACT', hint:'секреты не попадают в trace' }),
  Object.freeze({ id:'budget', label:'BUDGET', hint:'лимит запросов/стоимости' }),
]);

export const AUTOMATION_MISSIONS = Object.freeze([
  Object.freeze({
    id:'inbox', title:'РАЗОБРАТЬ INBOX БЕЗ РИСКА',
    brief:'В папке лежат PDF, TXT и один повреждённый файл. Сначала покажи, что будет сделано, и не трогай мусор.',
    cargo:Object.freeze(['invoice-17.pdf','notes.txt','broken.bin','invoice-17-copy.pdf']),
    required:Object.freeze(['scan','validate','dryrun']),
    recommended:Object.freeze(['log']),
    hazard:'unsafe-write',
  }),
  Object.freeze({
    id:'csv', title:'СОБРАТЬ CSV ПОСЛЕ ПАДЕНИЯ',
    brief:'Две выгрузки содержат разные имена полей и повтор заказа. Процесс должен пережить остановку на середине.',
    cargo:Object.freeze(['orders-a.csv','orders-b.csv','checkpoint.json']),
    required:Object.freeze(['normalize','dedupe','checkpoint']),
    recommended:Object.freeze(['validate','log']),
    hazard:'duplicate-row',
  }),
  Object.freeze({
    id:'http', title:'ДОСТАВИТЬ ЗАПРОС РОВНО ОДИН РАЗ',
    brief:'Сервис отвечает timeout после того, как мог уже принять заказ. Простое “retry ещё раз” опасно.',
    cargo:Object.freeze(['POST /orders/42','timeout','unknown-result']),
    required:Object.freeze(['timeout','retry','idempotency']),
    recommended:Object.freeze(['log','checkpoint']),
    hazard:'duplicate-side-effect',
  }),
  Object.freeze({
    id:'provider', title:'ОБЕРНУТЬ МОДЕЛЬ, НЕ ПРИВЯЗЫВАЯ ИГРУ К ПРОВАЙДЕРУ',
    brief:'Локальная Q-Mini и совместимый внешний endpoint должны выглядеть одинаково для игры. Trace не должен раскрывать ключ.',
    cargo:Object.freeze(['instruction','context','model response','Authorization header']),
    required:Object.freeze(['adapter','schema','redact','budget']),
    recommended:Object.freeze(['timeout','retry','log']),
    hazard:'secret-leak',
  }),
]);

const REQUIRED_MESSAGES = Object.freeze({
  scan:'input discovered', validate:'shape checked', dryrun:'planned without write', normalize:'fields normalized',
  dedupe:'duplicate suppressed', checkpoint:'resume marker saved', retry:'retry bounded', idempotency:'idempotency key attached',
  timeout:'deadline enforced', log:'trace appended', adapter:'ModelClient selected', schema:'response validated',
  redact:'Authorization: Bearer ***', budget:'request budget reserved',
});

export function evaluateAutomationMission(mission, selectedModules) {
  const selected = new Set(selectedModules ?? []);
  const checks = mission.required.map(id => ({ id, ok:selected.has(id), text:`${id.toUpperCase()} ${selected.has(id)?'подключён':'нужен'}` }));
  const recommended = mission.recommended.map(id => ({ id:`bonus:${id}`, ok:selected.has(id), optional:true, text:`${id.toUpperCase()} ${selected.has(id)?'усиливает линию':'не обязателен'}` }));
  const trace = [...selected].filter(id => REQUIRED_MESSAGES[id]).map(id => REQUIRED_MESSAGES[id]);
  if (mission.id === 'provider' && !selected.has('redact')) trace.push('Authorization: Bearer sk-demo-not-a-real-key');
  if (mission.id === 'http' && selected.has('retry') && !selected.has('idempotency')) trace.push('DANGER: second POST may duplicate side effect');
  if (mission.id === 'inbox' && selected.has('scan') && !selected.has('dryrun')) trace.push('DANGER: write starts before preview');
  const hazards = {
    'unsafe-write': selected.has('scan') && !selected.has('dryrun'),
    'duplicate-row': !selected.has('dedupe'),
    'duplicate-side-effect': selected.has('retry') && !selected.has('idempotency'),
    'secret-leak': !selected.has('redact'),
  };
  const hazard = Boolean(hazards[mission.hazard]);
  const ok = checks.every(check => check.ok) && !hazard;
  return { ok, checks:[...checks,...recommended], trace, hazard, selected:[...selected] };
}

export const AUTOMATION_PYTHON_SOURCE = `from pathlib import Path\nfrom typing import Protocol, Any\nimport csv\n\nclass ModelClient(Protocol):\n    def complete(self, *, messages: list[dict], timeout: float) -> dict: ...\n\ndef load_rows(path: Path) -> list[dict]:\n    with path.open(newline=\"\", encoding=\"utf-8\") as f:\n        return list(csv.DictReader(f))\n\ndef safe_request(send, payload, *, key: str, retries: int = 2):\n    # timeout + bounded retry + idempotency belong together\n    for attempt in range(retries + 1):\n        try:\n            return send(payload, idempotency_key=key, timeout=8)\n        except TimeoutError:\n            if attempt == retries:\n                raise\n\ndef redact(headers: dict[str, str]) -> dict[str, str]:\n    # Authorization must never appear unredacted in logs/exports\n    return {k: (\"***\" if k.casefold() == \"authorization\" else v) for k, v in headers.items()}\n\n# Game rule: DRY-RUN first, validate before effects, checkpoint long jobs,\n# and keep provider/API secrets outside progress/export.`;

function setText(root, selector, value) { const node=root.querySelector(selector); if (node) node.textContent=value; }

export function createAutomationLab(root,{getProfile,onProfile=()=>{},onSound=()=>{},onClose=()=>{}}={}) {
  let missionIndex=0;
  let selected=new Set();
  let last=null;
  const mission=()=>AUTOMATION_MISSIONS[missionIndex];

  function paintModules() {
    for (const button of root.querySelectorAll('[data-auto-module]')) button.dataset.on=String(selected.has(button.dataset.autoModule));
    const pipe=root.querySelector('#automationLabPipeline'); pipe.replaceChildren();
    const ids=[...selected];
    if (!ids.length) { pipe.textContent='ПУСТО · собери безопасную линию'; return; }
    ids.forEach((id,index)=>{ const span=document.createElement('span'); span.textContent=AUTOMATION_MODULES.find(item=>item.id===id)?.label??id; pipe.append(span); if(index<ids.length-1) pipe.append(document.createTextNode('→')); });
  }
  function paintResult() {
    const checks=root.querySelector('#automationLabChecks'); checks.replaceChildren();
    const trace=root.querySelector('#automationLabTrace'); trace.replaceChildren();
    if (!last) { setText(root,'#automationLabStatus','Подключи модули и запусти dry simulation. Никаких реальных файлов или API игра не трогает.'); root.querySelector('#automationLabCommit').disabled=true; return; }
    last.checks.forEach(check=>{const row=document.createElement('span');row.dataset.ok=String(check.ok);row.dataset.optional=String(Boolean(check.optional));row.textContent=`${check.ok?'✓':'×'} ${check.text}`;checks.append(row);});
    last.trace.forEach(line=>{const row=document.createElement('code');row.textContent=line;trace.append(row);});
    root.querySelector('#automationLabCommit').disabled=!last.ok;
    setText(root,'#automationLabStatus',last.ok?'✓ Линия безопасна для этой задачи. Сохрани blueprint.':(last.hazard?'Система формально работает, но создаёт опасный побочный эффект. Убери hazard.':'Не хватает обязательной границы. Смотри на провал, а не на название модуля.'));
  }
  function paint() {
    const current=mission();
    setText(root,'#automationLabMissionNo',`${missionIndex+1}/${AUTOMATION_MISSIONS.length}`);
    setText(root,'#automationLabTitle',current.title);
    setText(root,'#automationLabBrief',current.brief);
    const cargo=root.querySelector('#automationLabCargo'); cargo.replaceChildren(); current.cargo.forEach(item=>{const span=document.createElement('span');span.textContent=item;cargo.append(span);});
    const completed=getProfile()?.labs?.automation?.completedMissions??[];
    setText(root,'#automationLabProgress',`${completed.length}/${AUTOMATION_MISSIONS.length} BLUEPRINTS`);
    root.querySelector('#automationLabCode').hidden=completed.length<AUTOMATION_MISSIONS.length;
    paintModules(); paintResult();
  }

  root.querySelectorAll('[data-auto-module]').forEach(button=>button.addEventListener('click',()=>{const id=button.dataset.autoModule;selected.has(id)?selected.delete(id):selected.add(id);last=null;onSound('wire');paint();}));
  root.querySelector('#automationLabRun').addEventListener('click',()=>{last=evaluateAutomationMission(mission(),selected);onSound(last.ok?'power':'blocked');paint();});
  root.querySelector('#automationLabCommit').addEventListener('click',()=>{if(!last?.ok)return;const current=mission();onProfile({type:'lab-mission',lab:'automation',id:current.id,patch:{safeRuns:(getProfile()?.labs?.automation?.safeRuns??0)+1},xp:110});onSound('reward');if(missionIndex<AUTOMATION_MISSIONS.length-1){missionIndex+=1;selected=new Set();last=null;paint();}else{onProfile({type:'automation-complete',missions:AUTOMATION_MISSIONS.length});paint();}});
  root.querySelector('#automationLabClose').addEventListener('click',()=>{root.hidden=true;onClose();});
  root.querySelector('#automationLabPython').textContent=AUTOMATION_PYTHON_SOURCE;

  return {open(){const done=new Set(getProfile()?.labs?.automation?.completedMissions??[]);const next=AUTOMATION_MISSIONS.findIndex(m=>!done.has(m.id));missionIndex=next<0?AUTOMATION_MISSIONS.length-1:next;selected=new Set();last=null;paint();root.hidden=false;root.querySelector('[data-auto-module]').focus({preventScroll:true});},close(){root.hidden=true;},snapshot(){return {mission:mission(),selected:[...selected],last};}};
}
