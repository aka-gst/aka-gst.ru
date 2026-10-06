import { runPython } from '../runner.js';

const freeze=(x)=>Object.freeze(x);

export const CHRONICLE_SERVICES=freeze([
  freeze({id:'market',human:'ОКНО ЗАКАЗОВ',tech:'CLIENT / SCHEMA',icon:'▦'}),
  freeze({id:'courier',human:'КУРЬЕРСКАЯ ЛИНИЯ',tech:'QUEUE / WORKERS',icon:'⇢'}),
  freeze({id:'archive',human:'ГОРОДСКОЙ АРХИВ',tech:'RAG / CACHE / VERSION',icon:'▤'}),
  freeze({id:'gate',human:'ШЛЮЗ ДЕЙСТВИЙ',tech:'POLICY / TOOLS',icon:'◇'}),
  freeze({id:'qbot',human:'Q-BOT',tech:'AGENT / MEMORY / EVAL',icon:'◎'}),
]);

const decision=(id,human,tech,{good=true,debt=0,trust=0,resilience=0,note=''}={})=>freeze({id,human,tech,good,debt,trust,resilience,note});
const clue=(id,label,body)=>freeze({id,label,body});

export const CHRONICLE_ARCS=freeze([
  freeze({
    id:'old-door', chapter:'ГЛАВА 1 · СТАРАЯ ДВЕРЬ', service:'market', caller:'Лина · ночной рынок',
    message:'Полгода назад ты спас рынок адаптером для старой формы заказа. Сегодня новый клиент уже умеет v3, но старая ветка всё ещё жива и иногда ведёт заказ по другому пути.',
    symptom:'РЕШЕНИЕ, КОТОРОЕ КОГДА-ТО СПАСЛО ГОРОД, ТЕПЕРЬ САМО СТАЛО РИСКОМ',
    startingDebt:3,
    clues:freeze([
      clue('why','ПОЧЕМУ ЭТО ПОЯВИЛОСЬ','Адаптер добавили в ночь релиза, чтобы старые v1/v2-клиенты не потеряли заказы.'),
      clue('now','ЧТО ИЗМЕНИЛОСЬ','99.2% клиентов уже говорят v3. Старый маршрут используется редко, но тестировать его всё равно приходится.'),
      clue('ghost','ЧТО БОЛИТ','Один заказ может пройти через legacy-route и получить другое поведение, чем тот же заказ через v3.'),
    ]),
    decisions:freeze([
      decision('delete-now','Снести старый путь прямо сейчас','HARD DELETE',{good:false,debt:-3,trust:-4,resilience:-2,note:'Редкий старый клиент внезапно теряет заказ.'}),
      decision('sunset','Пометить старый путь, измерить остаток и закрыть после окна','DEPRECATION + TELEMETRY',{good:true,debt:-2,trust:3,resilience:3,note:'Город видит, кто ещё зависит от старой двери, и получает безопасный срок миграции.'}),
      decision('forever','Оставить всё как есть: ведь пока работает','KEEP LEGACY FOREVER',{good:false,debt:2,trust:0,resilience:-2,note:'Сегодня тихо, но следующая версия должна помнить уже три разных поведения.'}),
    ]),
    memory:'Старый код — это не мусор. Сначала пойми, кого он ещё держит в живых; потом закрывай дверь с доказательством.',
  }),
  freeze({
    id:'magic-number', chapter:'ГЛАВА 2 · ЧИСЛО ИЗ ПРОШЛОГО', service:'courier', caller:'Рома · курьеры',
    message:'Во время фестиваля ты спас очередь порогом “32”. Прошло несколько недель, нагрузка стала другой, а никто уже не помнит, почему именно 32.',
    symptom:'КОД РАБОТАЕТ, НО ЕГО ПРИЧИНУ НИКТО БОЛЬШЕ НЕ ПОМНИТ',
    startingDebt:4,
    clues:freeze([
      clue('commit','СТАРАЯ ЗАПИСЬ','“festival hotfix: batch at 32” — без объяснения измерений и без срока пересмотра.'),
      clue('metric','СЕГОДНЯШНЯЯ МЕТРИКА','При обычной нагрузке batch ждёт слишком долго; при вечернем пике 32 всё ещё нормально.'),
      clue('people','ЧТО ВИДЯТ ЛЮДИ','Утром маленькие доставки приходят медленнее, хотя система “зелёная”.'),
    ]),
    decisions:freeze([
      decision('bigger','Сделать число 64 — сегодня нагрузка выше','MAGIC NUMBER 64',{good:false,debt:2,trust:-1,resilience:-1,note:'Ты перенёс вопрос в будущее и сделал его ещё менее понятным.'}),
      decision('config','Сделать порог настройкой и привязать его к наблюдаемой нагрузке','CONFIG + METRIC',{good:true,debt:-2,trust:2,resilience:3,note:'Причина становится видимой, а число можно менять без переписывания логики.'}),
      decision('comment','Просто подписать комментарий “32 = быстро”','COMMENT ONLY',{good:false,debt:0,trust:0,resilience:0,note:'Комментарий объясняет обещание, но не создаёт доказательства.'}),
    ]),
    memory:'Если число важно для поведения системы, его причина должна жить рядом с метрикой или конфигурацией, а не только в голове автора.',
  }),
  freeze({
    id:'qbot-echo', chapter:'ГЛАВА 3 · Q-BOT ПОМНИТ СЛИШКОМ ХОРОШО', service:'qbot', caller:'Q-Bot',
    message:'После истории с устаревшим архивом ты научил меня всегда подозревать cache. Теперь я предлагаю обходить cache даже там, где документ свежий.',
    symptom:'ПРАВИЛЬНЫЙ УРОК ПРЕВРАТИЛСЯ В СЛИШКОМ ОБЩЕЕ ПРАВИЛО',
    startingDebt:3,
    clues:freeze([
      clue('lesson','СТАРЫЙ УРОК Q-BOT','“Если ответ старый — проверяй источник и свежесть”. Это было правильно.'),
      clue('drift','НОВОЕ ПОВЕДЕНИЕ','Q-Bot сократил правило до “cache подозрителен” и применяет его к любому медленному ответу.'),
      clue('eval','СЛЕПОЕ МЕСТО','В eval есть stale-document, но нет свежего документа с полезным cache.'),
    ]),
    decisions:freeze([
      decision('erase','Стереть у Q-Bot весь урок про cache','FORGET LESSON',{good:false,debt:1,trust:-2,resilience:-2,note:'Он снова повторит старую ошибку с устаревшим источником.'}),
      decision('counterexample','Добавить контрпример и уточнить правило','COUNTEREXAMPLE + EVAL',{good:true,debt:-2,trust:3,resilience:3,note:'Q-Bot сохраняет полезный урок и учится различать свежесть и просто наличие cache.'}),
      decision('human-all','Всегда отправлять ответы Q-Bot человеку','HUMAN EVERYTHING',{good:true,debt:0,trust:2,resilience:1,note:'Безопасно, но город теряет часть автоматизации. Это рабочий, но дорогой путь.'}),
    ]),
    memory:'Обучение — это история примеров. Хороший прошлый урок может стать плохим правилом, если новый мир шире старого eval.',
  }),
  freeze({
    id:'ghost-client', chapter:'ГЛАВА 4 · КЛИЕНТ, КОТОРОГО ВСЕ ЗАБЫЛИ', service:'gate', caller:'Саша · шлюз',
    message:'После месяца тишины в сеть вернулся старый терминал склада. Он отправляет корректные, но давно неиспользуемые v2-события. Новый pipeline их уже не ждёт.',
    symptom:'ДЕПРЕКАЦИЯ БЫЛА “В ГОЛОВЕ”, НО НЕ В КОНТРАКТЕ',
    startingDebt:5,
    clues:freeze([
      clue('lastseen','ПОСЛЕДНИЙ СЛЕД','v2 не появлялся 31 день — поэтому его сочли мёртвым.'),
      clue('contract','ЧЕГО НЕТ','Нет опубликованного sunset-date и нет явного ответа для устаревшей версии.'),
      clue('owner','КТО ЗАВИСИТ','Складской терминал включается редко, но нужен во время аварийного режима.'),
    ]),
    decisions:freeze([
      decision('silent-drop','Молча игнорировать v2','SILENT DROP',{good:false,debt:2,trust:-4,resilience:-3,note:'Аварийный терминал выглядит “работающим”, но его команды исчезают.'}),
      decision('explicit','Вернуть явный upgrade-required и оставить короткое окно совместимости','EXPLICIT VERSION CONTRACT',{good:true,debt:-3,trust:3,resilience:3,note:'Старый клиент получает понятный путь, а город — измеримый срок завершения миграции.'}),
      decision('adapter-forever','Вернуть вечный адаптер v2','PERMANENT ADAPTER',{good:true,debt:1,trust:2,resilience:1,note:'Работает и сохраняет людей, но сознательно оставляет долг. Это допустимый компромисс, если его видят.'}),
    ]),
    memory:'Совместимость — продуктовая договорённость. “Давно не видел” не равно “никому не нужно”.',
  }),
  freeze({
    id:'postmortem-night', chapter:'ГЛАВА 5 · НОЧЬ, КОТОРАЯ ОСТАЛАСЬ В ИСТОРИИ', service:'archive', caller:'Мира · архив',
    message:'Во время ночного релиза город на семь минут потерял часть квитанций. Всё уже восстановлено. Теперь самое опасное — решить, что виноват один человек, и забыть цепочку причин.',
    symptom:'ИНЦИДЕНТ ЗАКОНЧИЛСЯ, НО СИСТЕМА ЕЩЁ НИЧЕМУ НЕ НАУЧИЛАСЬ',
    startingDebt:6,
    clues:freeze([
      clue('timeline','ТАЙМЛАЙН','22:04 patch → 22:06 canary OK → 22:11 provider начал задерживать ack → 22:13 retry создал двойной путь.'),
      clue('guardrail','ПОЧЕМУ НЕ ПОЙМАЛИ','Тест проверял timeout и retry отдельно, но не проверял “timeout после side-effect”.'),
      clue('human','ЧЕЛОВЕЧЕСКИЙ ФАКТ','Оператор сделал всё по существующему runbook. В runbook просто не было этого класса неопределённого результата.'),
    ]),
    decisions:freeze([
      decision('blame','Записать имя оператора и запретить ему релизы','BLAME PERSON',{good:false,debt:2,trust:-5,resilience:-2,note:'Страх растёт, а системная причина остаётся.'}),
      decision('guardrail','Добавить regression-сценарий, обновить runbook и ownership','POSTMORTEM + GUARDRAIL',{good:true,debt:-4,trust:4,resilience:4,note:'Прошлая ошибка превращается в новый автоматический датчик и понятный путь восстановления.'}),
      decision('forget','Ничего не менять: ведь всё уже восстановили','CLOSE INCIDENT',{good:false,debt:3,trust:-1,resilience:-3,note:'Следующая похожая ночь начинается с нуля.'}),
    ]),
    memory:'Постмортем нужен не для красивого документа и не для виноватого. Его продукт — новое ограничение, тест или путь восстановления.',
  }),
]);

export function getChronicleArc(id){return CHRONICLE_ARCS.find(x=>x.id===id)??CHRONICLE_ARCS[0];}
export function getChronicleDecision(arc,id){return arc.decisions.find(x=>x.id===id)??null;}

export function buildHistoryEcho(profile={},arcId=''){
  const accepted=new Set(profile?.labs?.operations?.acceptedPatches??[]);
  const rollbacks=new Set(profile?.labs?.operations?.rollbackArcs??[]);
  const map={
    'old-door':[['schema-v2:adapter','АРХИВ · этот compatibility-adapter когда-то выпустил именно ты. Тогда он сохранил старые заказы.']],
    'magic-number':[['festival-load:batch','АРХИВ · в фестивальную ночь ты выбрал batching. Сегодня город живёт уже при другой нагрузке.'],['festival-load:bounded-scale','АРХИВ · ты ограничил масштабирование безопасным потолком. Но старый порог нагрузки всё ещё остался в истории.']],
    'qbot-echo':[['stale-memory:freshness','ПАМЯТЬ Q-BOT · правило freshness появилось после твоего прошлого решения. Я запомнил его слишком широко.'],['stale-memory:source-tag','ПАМЯТЬ Q-BOT · ты научил меня нести provenance. Теперь надо расширить eval, а не стирать этот урок.']],
    'ghost-client':[['new-tool:exact-allow','АРХИВ · ты уже однажды выбрал явный allowlist вместо wildcard. Теперь тот же принцип нужен для версий клиента.'],['new-tool:human-refund','АРХИВ · раньше ты сохранил human approval для спорного действия. Редкий legacy-клиент — похожая зависимость, но другого типа.']],
    'postmortem-night':[['release-night:release-train','АРХИВ · общий release-train ты уже выпускал через test → canary → observe. Этот инцидент показывает, какой сценарий тогда отсутствовал в проверках.']],
  };
  for(const [key,text] of map[arcId]??[]) if(accepted.has(key)) return text;
  if(rollbacks.size) return `АРХИВ · у тебя уже ${rollbacks.size} сохранённый rollback. Город помнит не только релизы, но и моменты, когда ты вовремя остановился.`;
  return 'АРХИВ · эта запись пережила прошлый релиз. Теперь ты видишь не только код, но и причину, по которой он появился.';
}

export function evaluateChronicleDecision(arc,{decisionId='',clues=[]}={}){
  const choice=getChronicleDecision(arc,decisionId);
  const seen=new Set(clues);
  if(seen.size<2) return {ok:false,phase:'investigate',debt:arc.startingDebt,trust:0,resilience:0,status:'Сначала открой хотя бы две записи прошлого. Сейчас любое решение — догадка без контекста.'};
  if(!choice) return {ok:false,phase:'choose',debt:arc.startingDebt,trust:0,resilience:0,status:'Контекст уже виден. Теперь выбери, что делать с прошлым решением.'};
  const debt=Math.max(0,arc.startingDebt+choice.debt);
  if(!choice.good) return {ok:false,phase:'consequence',debt,trust:choice.trust,resilience:choice.resilience,status:`ПОСЛЕДСТВИЕ ВИДНО В ГОРОДЕ · ${choice.note}`,note:choice.note};
  return {ok:true,phase:'memory',debt,trust:choice.trust,resilience:choice.resilience,status:`✓ ГОРОД ЗАПОМНИЛ ЭТО ПРАВИЛЬНО · ${choice.note}`,note:choice.note,postmortem:`${arc.id}:${choice.id}`};
}

function seeded(seed){let x=(Math.max(1,Math.round(Number(seed)||1))*2654435761)>>>0;return()=>{x=(1664525*x+1013904223)>>>0;return x/4294967296;};}
export function generateMaintenanceWindow(seed=1){
  const safe=Math.max(1,Math.round(Number(seed)||1));const rnd=seeded(safe);const arc=CHRONICLE_ARCS[Math.floor(rnd()*CHRONICLE_ARCS.length)];
  const twist=['старый blueprint вернулся','новая версия встретила редкого клиента','Q-Bot повторил старый урок','нагрузка изменила смысл старого порога','ночной инцидент напомнил о забытом guardrail'][Math.floor(rnd()*5)];
  return {seed:safe,arcId:arc.id,twist,recommended:arc.decisions.filter(x=>x.good).map(x=>x.id)};
}

export const MIGRATION_POLICY_STARTER=`def compatibility_policy(client_version, supported, sunset=False):\n    # return "native", "adapter" or "reject"\n    pass\n`;
export const MIGRATION_POLICY_CHECKS=freeze([
  freeze({detail:'текущая версия идёт нативно',expr:`compatibility_policy(3, [2,3], False) == 'native'`}),
  freeze({detail:'поддерживаемая старая версия получает adapter',expr:`compatibility_policy(2, [2,3], False) == 'adapter'`}),
  freeze({detail:'неизвестная версия не притворяется поддерживаемой',expr:`compatibility_policy(9, [2,3], False) == 'reject'`}),
  freeze({detail:'после sunset старая версия закрывается явно',expr:`compatibility_policy(2, [2,3], True) == 'reject'`}),
  freeze({detail:'sunset не ломает текущую версию',expr:`compatibility_policy(3, [2,3], True) == 'native'`}),
]);

function esc(value=''){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function text(root,sel,value){const node=root.querySelector(sel);if(node)node.textContent=value;}

export function createCityChronicle(root,{getProfile=()=>({}),getMode=()=> 'guided',onProfile=()=>{},onSound=()=>{},onClose=()=>{}}={}){
  if(!root)return {open(){},close(){},refresh(){}};
  let index=0,seen=new Set(),selected='',last=null,windowMode=false,windowSeed=1,codeBusy=false;
  const profile=()=>getProfile();
  const done=()=>new Set(profile().labs.chronicle?.completedArcs??[]);
  const arc=()=>CHRONICLE_ARCS[index]??CHRONICLE_ARCS[0];
  const service=(id)=>CHRONICLE_SERVICES.find(x=>x.id===id);
  function renderServices(){const host=root.querySelector('#chronicleServices');host.replaceChildren();CHRONICLE_SERVICES.forEach(s=>{const el=document.createElement('div');el.dataset.active=String(s.id===arc().service);el.innerHTML=`<b>${s.icon}</b><span>${esc(s.human)}<small>${getMode()==='guided'?'':esc(s.tech)}</small></span>`;host.append(el);});}
  function renderClues(){const host=root.querySelector('#chronicleClues');host.replaceChildren();arc().clues.forEach(c=>{const b=document.createElement('button');b.type='button';b.dataset.seen=String(seen.has(c.id));b.innerHTML=`<b>${seen.has(c.id)?'✓':'?'}</b><span><strong>${esc(c.label)}</strong><small>${seen.has(c.id)?esc(c.body):'Открыть запись прошлого'}</small></span>`;b.addEventListener('click',()=>{seen.add(c.id);last=null;render();onSound('scan');});host.append(b);});}
  function renderChoices(){const host=root.querySelector('#chronicleDecisions');host.replaceChildren();arc().decisions.forEach(d=>{const b=document.createElement('button');b.type='button';b.dataset.selected=String(selected===d.id);b.innerHTML=`<span>${esc(d.human)}</span><small>${getMode()==='guided'?'':`${esc(d.tech)} · DEBT ${d.debt>0?'+':''}${d.debt}`}</small>`;b.addEventListener('click',()=>{selected=d.id;last=evaluateChronicleDecision(arc(),{decisionId:selected,clues:[...seen]});render();onSound(last.ok?'reward':'blocked');if(last.ok&&!windowMode){onProfile({type:'chronicle-arc',id:arc().id,decision:selected,debt:last.debt,postmortem:last.postmortem,xp:220});}});host.append(b);});}
  function renderDebt(){const debt=last?.debt??arc().startingDebt;const bar=root.querySelector('#chronicleDebtBar');bar.style.width=`${Math.min(100,debt/8*100)}%`;text(root,'#chronicleDebtValue',`${debt} LEGACY CABLES`);root.dataset.debt=debt>=6?'high':debt>=3?'mid':'low';}
  function render(){const a=arc();text(root,'#chronicleChapter',a.chapter);text(root,'#chronicleCaller',a.caller);text(root,'#chronicleMessage',a.message);text(root,'#chronicleEcho',buildHistoryEcho(profile(),a.id));text(root,'#chronicleSymptom',a.symptom);text(root,'#chronicleProgress',`${done().size}/${CHRONICLE_ARCS.length} ИСТОРИЙ · ${(profile().labs.chronicle?.windowSeeds??[]).length} ∞ WINDOWS`);renderServices();renderClues();renderChoices();renderDebt();text(root,'#chronicleStatus',last?.status??'Прошлое не мешает, пока мир не изменился. Открой записи и пойми, зачем старое решение вообще появилось.');const memory=root.querySelector('#chronicleMemory');memory.hidden=!last?.ok;if(last?.ok)memory.innerHTML=`<small>ГОРОДСКАЯ ПАМЯТЬ</small><b>${esc(a.memory)}</b>`;root.querySelector('#chronicleNext').hidden=windowMode||!last?.ok;root.querySelector('#chronicleWindowComplete').hidden=!windowMode||!last?.ok;}
  function next(){windowMode=false;const ni=CHRONICLE_ARCS.findIndex((x,i)=>i>index&&!done().has(x.id));if(ni>=0)index=ni;else index=Math.min(CHRONICLE_ARCS.length-1,index+1);seen=new Set();selected='';last=null;render();}
  function openWindow(){if(done().size<CHRONICLE_ARCS.length){text(root,'#chronicleStatus','Сначала проживи пять историй CITY CHRONICLE. Потом прошлое начнёт возвращаться в новых сочетаниях.');onSound('blocked');return;}windowMode=true;const w=generateMaintenanceWindow(windowSeed);index=CHRONICLE_ARCS.findIndex(x=>x.id===w.arcId);seen=new Set();selected='';last=null;const lab=root.querySelector('#chronicleWindowLabel');lab.hidden=false;lab.textContent=`MAINTENANCE #${String(w.seed).padStart(3,'0')} · ${w.twist}`;render();}
  function completeWindow(){if(!windowMode||!last?.ok)return;onProfile({type:'chronicle-window',seed:windowSeed,score:Math.max(1,120-last.debt*10),xp:120});windowSeed+=1;openWindow();}
  function openCode(){if(done().size<CHRONICLE_ARCS.length){text(root,'#chronicleStatus','Сначала проживи пять историй прошлого. Тогда compatibility перестанет быть термином и станет твоей собственной интуицией.');onSound('blocked');return;}root.querySelector('#chronicleStory').hidden=true;root.querySelector('#chronicleCodePanel').hidden=false;const area=root.querySelector('#chronicleCode');if(area&&!area.value.trim())area.value=MIGRATION_POLICY_STARTER;}
  async function runCode(){if(codeBusy)return;codeBusy=true;const btn=root.querySelector('#chronicleCodeRun');btn.disabled=true;text(root,'#chronicleCodeStatus','CPython прогоняет клиентов из разных эпох…');const result=await runPython({source:root.querySelector('#chronicleCode').value,checks:MIGRATION_POLICY_CHECKS});codeBusy=false;btn.disabled=false;const host=root.querySelector('#chronicleCodeChecks');host.replaceChildren();if(result.error){const d=document.createElement('div');d.dataset.ok='false';d.textContent=`× ${result.error.text}`;host.append(d);}else result.checks.forEach((c,i)=>{const d=document.createElement('div');d.dataset.ok=String(c.ok);d.textContent=`${c.ok?'✓':'×'} ${MIGRATION_POLICY_CHECKS[i].detail}`;host.append(d);});const ok=!result.error&&result.checks.length===MIGRATION_POLICY_CHECKS.length&&result.checks.every(x=>x.ok);if(ok){onProfile({type:'chronicle-code',xp:480});text(root,'#chronicleCodeStatus','✓ MIGRATION POLICY DEPLOYED · прошлое теперь обслуживается явным контрактом, а не случайностью.');onSound('reward');}else{text(root,'#chronicleCodeStatus',result.error?.hint??'Есть версия, для которой политика ведёт себя двусмысленно. Исправь поведение.');onSound('blocked');}}
  root.querySelector('#chronicleNext').addEventListener('click',next);root.querySelector('#chronicleWindowOpen').addEventListener('click',openWindow);root.querySelector('#chronicleWindowComplete').addEventListener('click',completeWindow);root.querySelector('#chronicleCodeOpen').addEventListener('click',openCode);root.querySelector('#chronicleCodeBack').addEventListener('click',()=>{root.querySelector('#chronicleStory').hidden=false;root.querySelector('#chronicleCodePanel').hidden=true;render();});root.querySelector('#chronicleCodeRun').addEventListener('click',runCode);root.querySelector('#chronicleClose').addEventListener('click',()=>{root.hidden=true;onClose();});
  return {open(){const first=CHRONICLE_ARCS.findIndex(x=>!done().has(x.id));index=first>=0?first:0;seen=new Set();selected='';last=null;windowMode=false;root.querySelector('#chronicleStory').hidden=false;root.querySelector('#chronicleCodePanel').hidden=true;root.querySelector('#chronicleWindowLabel').hidden=true;root.hidden=false;render();},close(){root.hidden=true;},refresh:render};
}
