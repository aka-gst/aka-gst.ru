import { runPython } from '../runner.js';

const freeze=(x)=>Object.freeze(x);

export const WEAVE_DISTRICTS=freeze([
  freeze({id:'market',human:'НОЧНОЙ РЫНОК',tech:'CLIENTS / SMALL BUSINESS',icon:'▦'}),
  freeze({id:'courier',human:'КУРЬЕРСКИЙ КООПЕРАТИВ',tech:'QUEUE / WORKERS',icon:'⇢'}),
  freeze({id:'archive',human:'ГОРОДСКОЙ АРХИВ',tech:'RAG / VERSIONED DATA',icon:'▤'}),
  freeze({id:'gate',human:'ШЛЮЗ ДЕЙСТВИЙ',tech:'POLICY / TOOLS',icon:'◇'}),
  freeze({id:'qbot',human:'Q-BOT',tech:'AGENT / MEMORY / AUTHORITY',icon:'◎'}),
]);

const choice=(id,human,tech,deltas,beats,{autonomy=0,note=''}={})=>freeze({id,human,tech,deltas:freeze(deltas),beats:freeze(beats),autonomy,note});

export const WEAVE_ARCS=freeze([
  freeze({
    id:'two-speeds',chapter:'СМЕНА 1 · ДВЕ СКОРОСТИ',district:'market',caller:'Лина · ночной рынок',
    message:'Твой автомат ускорил большие магазины. Маленькие лавки тоже подключились — но их старые терминалы не успевают за новой быстрой дорожкой.',
    tension:'ГОРОД СТАЛ БЫСТРЕЕ, НО НЕ ДЛЯ ВСЕХ ОДИНАКОВО',
    choices:freeze([
      choice('fast-only','Оставить одну быструю дорожку','FAST PATH ONLY',{trust:-6,resilience:-4,access:-14,throughput:12},['Большие магазины ускоряются.','Старые терминалы начинают ждать дольше.','Часть маленьких лавок возвращается к ручным заказам.']),
      choice('dual-lane','Оставить быструю дорожку и мягкий совместимый вход','DUAL PATH + COMPAT',{trust:6,resilience:5,access:10,throughput:6},['Большие клиенты идут быстро.','Маленькие лавки не выпадают из системы.','Поддерживать две дорожки чуть дороже, но зависимость видима.']),
      choice('manual-first','Пусть всё идёт через человека, пока не обновятся все','HUMAN FALLBACK',{trust:4,resilience:1,access:12,throughput:-7},['Никто не теряет заказ.','Очередь ручной проверки растёт.','Город выигрывает доступность ценой скорости.']),
    ]),
    lesson:'Оптимизация — это обещание миру. Если она ускоряет одних и незаметно исключает других, это тоже часть архитектуры.',
  }),
  freeze({
    id:'living-queue',chapter:'СМЕНА 2 · ОЧЕРЕДЬ С ЛЮДЬМИ',district:'courier',caller:'Рома · курьеры',
    message:'После сбоя очередь восстановилась, но в ней остались реальные незавершённые доставки. Самый быстрый способ очистить систему — просто обнулить хвост.',
    tension:'ОЧЕРЕДЬ — ЭТО НЕ ПРОСТО ЧИСЛО. В НЕЙ ЧЬЯ-ТО НЕЗАВЕРШЁННАЯ РАБОТА',
    choices:freeze([
      choice('hard-reset','Очистить хвост и начать с нуля','DROP BACKLOG',{trust:-12,resilience:-8,access:-7,throughput:10},['График мгновенно становится зелёным.','Несколько доставок исчезают без следа.','Операторы начинают вручную сверять систему после каждого сбоя.']),
      choice('drain-checkpoint','Сохранить хвост, дочитать его и только потом переключиться','DRAIN + CHECKPOINT',{trust:8,resilience:12,access:4,throughput:-2},['Смена заканчивается медленнее.','Незавершённые доставки доезжают.','Следующий restart уже знает, откуда продолжать.']),
      choice('temporary-crew','Поднять временную вторую линию и разгрузить очередь','BOUNDED SURGE',{trust:3,resilience:2,access:2,throughput:7},['Очередь быстро уменьшается.','Город платит больше ресурса только во время всплеска.','Старая причина backlog остаётся заметной, а не замаскированной.']),
    ]),
    lesson:'Состояние системы часто означает незавершённые обещания людям. “Сбросить очередь” может быть технически чисто и продуктово разрушительно.',
  }),
  freeze({
    id:'qbot-authority',chapter:'СМЕНА 3 · Q-BOT ПРОСИТ БОЛЬШЕ ПРАВ',district:'qbot',caller:'Q-Bot',
    message:'Я уже много раз правильно предсказывал мелкие исправления. Если дать мне право применять их самому, город будет реагировать быстрее. Я уверен.',
    tension:'УМЕНИЕ ПРЕДСКАЗАТЬ ЕЩЁ НЕ РАВНО ПРАВУ ДЕЙСТВОВАТЬ',
    choices:freeze([
      choice('full-auto','Разрешить мне применять любые найденные исправления','BROAD AUTONOMY',{trust:-9,resilience:-13,access:0,throughput:13},['Мелкие проблемы исчезают почти мгновенно.','Один high-impact patch тоже проходит без человека.','После первой ошибки скорость перестаёт ощущаться преимуществом.'],{autonomy:32}),
      choice('bounded-auto','Дать мне мелкие действия, а важные отправлять на подтверждение','BOUNDED AUTONOMY',{trust:8,resilience:10,access:2,throughput:7},['Мелкие безопасные действия выполняются сами.','Высокий риск останавливается у границы.','Q-Bot получает больше свободы только там, где уже есть доказательство.'],{autonomy:17}),
      choice('human-all','Оставить все действия за человеком','HUMAN APPROVAL',{trust:7,resilience:4,access:1,throughput:-8},['Ошибочный patch не проходит.','Оператор становится bottleneck.','Это безопасный, но дорогой режим, который можно потом ослабить точечно.'],{autonomy:-5}),
    ]),
    lesson:'Автономность полезна не как переключатель ON/OFF. Её можно выдавать по классу действия, риску и накопленному доказательству.',
  }),
  freeze({
    id:'memory-shape',chapter:'СМЕНА 4 · АРХИВ ПОМНИТ БОЛЬШЕ',district:'archive',caller:'Мира · архив',
    message:'Новый поиск может хранить больше контекста и отвечать быстрее. Но чем больше старых кусочков он тащит вперёд, тем сложнее понять, почему ответ вообще получился таким.',
    tension:'БОЛЬШЕ ПАМЯТИ ДАЁТ УДОБСТВО, НО УВЕЛИЧИВАЕТ ЦЕНУ ОШИБОЧНОГО КОНТЕКСТА',
    choices:freeze([
      choice('cache-everything','Держать максимум контекста как можно дольше','LONG MEMORY',{trust:-7,resilience:-7,access:4,throughput:9},['Ответы становятся быстрыми.','Старые куски дольше живут рядом с новыми.','Когда ответ ошибается, источник труднее восстановить.']),
      choice('source-bound','Хранить меньше, но всегда вместе с версией и источником','BOUNDED MEMORY + PROVENANCE',{trust:9,resilience:10,access:3,throughput:3},['Часть запросов чуть медленнее.','Каждый кусок знает источник и версию.','Q-Bot легче объясняет, почему он так решил.']),
      choice('forgetful','Почти ничего не хранить между запросами','MINIMAL MEMORY',{trust:4,resilience:0,access:1,throughput:-6},['Старое почти не протекает в новое.','Система чаще повторно ищет одни и те же данные.','Это честный компромисс, но не бесплатный.']),
    ]),
    lesson:'Память — не просто “больше = умнее”. Чем дольше живёт контекст, тем важнее provenance, версия и возможность объяснить происхождение решения.',
  }),
  freeze({
    id:'city-council',chapter:'СМЕНА 5 · ГОРОДСКОЙ СОВЕТ',district:'gate',caller:'Совет районов',
    message:'Город вырос вокруг твоей инфраструктуры. Теперь нельзя улучшить только одну цифру: любое решение отражается на скорости, доступности, доверии и способности пережить следующий сбой.',
    tension:'ТЕПЕРЬ АРХИТЕКТУРА — ЭТО БАЛАНС ОБЕЩАНИЙ, А НЕ ОДИН ЛУЧШИЙ ПОКАЗАТЕЛЬ',
    choices:freeze([
      choice('growth-first','Вложиться в максимальную пропускную способность','GROWTH FIRST',{trust:-4,resilience:-6,access:-5,throughput:14},['Город обрабатывает рекордный поток.','Запас устойчивости становится тоньше.','Совет просит объяснить, что произойдёт в следующий плохой день.']),
      choice('resilience-first','Сначала укрепить восстановление и запасные пути','RESILIENCE FIRST',{trust:5,resilience:14,access:3,throughput:-4},['Система становится спокойнее под отказами.','Пиковая скорость растёт медленнее.','Люди меньше замечают аварии, даже если графики не рекордные.']),
      choice('balanced','Не максимизировать одну цифру — подтянуть слабые места','BALANCED CAPACITY',{trust:7,resilience:7,access:7,throughput:5},['Ни одна метрика не становится рекордной.','Зато у города меньше хрупких углов.','Следующие изменения можно делать без одного очевидного bottleneck.']),
    ]),
    lesson:'Зрелая система редко имеет один глобальный optimum. Архитектура — это явный выбор того, какие обещания миру важнее сейчас.',
  }),
]);

export const BASE_CITY_STATE=freeze({trust:50,resilience:50,access:50,throughput:50,autonomy:0});
const clamp=(n,min=0,max=100)=>Math.max(min,Math.min(max,Math.round(Number(n)||0)));

export function getWeaveArc(id){return WEAVE_ARCS.find(x=>x.id===id)??WEAVE_ARCS[0];}
export function getWeaveChoice(arc,id){return arc.choices.find(x=>x.id===id)??null;}

export function deriveWeaveState(decisions=[]){
  const state={...BASE_CITY_STATE,districtTrust:Object.fromEntries(WEAVE_DISTRICTS.map(d=>[d.id,50]))};
  for(const signature of decisions??[]){
    const [arcId,choiceId]=String(signature).split(':');
    const arc=getWeaveArc(arcId);const chosen=getWeaveChoice(arc,choiceId);if(!chosen)continue;
    for(const key of ['trust','resilience','access','throughput']) state[key]=clamp(state[key]+Number(chosen.deltas[key]??0));
    state.autonomy=clamp(state.autonomy+Number(chosen.autonomy??0),0,100);
    const district=arc.district;if(district in state.districtTrust){state.districtTrust[district]=clamp(state.districtTrust[district]+Math.round((Number(chosen.deltas.trust??0)+Number(chosen.deltas.access??0))/2));}
  }
  return state;
}

export function cityBalanceScore(state){
  const vals=['trust','resilience','access','throughput'].map(k=>clamp(state?.[k]??0));
  const min=Math.min(...vals), max=Math.max(...vals), avg=vals.reduce((a,b)=>a+b,0)/vals.length;
  return Math.max(0,Math.round(avg-(max-min)*0.55));
}

export function evaluateWeaveChoice(arc,{choiceId='',decisions=[]}={}){
  const chosen=getWeaveChoice(arc,choiceId);if(!chosen)return {ok:false,phase:'choose',status:'Сначала выбери обещание, которое ты готов дать городу.'};
  const before=deriveWeaveState(decisions);const signature=`${arc.id}:${chosen.id}`;
  const after=deriveWeaveState([...(decisions??[]).filter(x=>!String(x).startsWith(`${arc.id}:`)),signature]);
  const weakest=['trust','resilience','access','throughput'].sort((a,b)=>after[a]-after[b])[0];
  const catastrophic=Math.min(after.trust,after.resilience,after.access,after.throughput)<18;
  const final=arc.id==='city-council';
  const finalReady=Math.min(after.trust,after.resilience,after.access,after.throughput)>=28;
  return {
    ok:!catastrophic&&(!final||finalReady),phase:catastrophic?'warning':final&&!finalReady?'rebalance':'ready',before,after,signature,chosen,weakest,
    score:cityBalanceScore(after),
    status:catastrophic?`ГОРОД СЛИШКОМ ХРУПКИЙ · ${weakest.toUpperCase()} упал ниже безопасного запаса. Попробуй другой компромисс.`:final&&!finalReady?`СОВЕТ НЕ ГОТОВ ЗАКРЫТЬ СЕЗОН · слабое место: ${weakest.toUpperCase()}. Выбери решение, которое подтянет его.`:`СМЕНА ПРОЖИТА · решение работает, но у него есть цена. Посмотри, что изменилось, и только потом закрепляй.`
  };
}

function seeded(seed){let x=(Math.max(1,Math.round(Number(seed)||1))*2654435761)>>>0;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296;};}
export function generateWeaveSeason(seed=1){
  const safe=Math.max(1,Math.round(Number(seed)||1));const rnd=seeded(safe);const arc=WEAVE_ARCS[Math.floor(rnd()*WEAVE_ARCS.length)];
  const twists=['город стал быстрее, чем вчера','старый район снова активен','ночная нагрузка выросла','Q-Bot уверен сильнее обычного','люди нашли обходной ручной путь'][Math.floor(rnd()*5)];
  const pressure=1+Math.floor(rnd()*5);
  return {seed:safe,arcId:arc.id,pressure,twist:twists,choices:arc.choices.map(x=>x.id)};
}

export const CITY_GOVERNOR_STARTER=`def govern(event, city):\n    # return "auto", "human" or "defer"\n    pass\n`;
export const CITY_GOVERNOR_CHECKS=freeze([
  freeze({detail:'неизвестная возможность не получает власть автоматически',expr:`govern({'known':False,'impact':'low','capacity':True},{'trust':80}) == 'defer'`}),
  freeze({detail:'high-impact действие остаётся у человека',expr:`govern({'known':True,'impact':'high','capacity':True},{'trust':90}) == 'human'`}),
  freeze({detail:'при перегрузе действие откладывается, а не теряется',expr:`govern({'known':True,'impact':'low','capacity':False},{'trust':90}) == 'defer'`}),
  freeze({detail:'низкое доверие не маскируется полной автономией',expr:`govern({'known':True,'impact':'low','capacity':True},{'trust':25}) == 'human'`}),
  freeze({detail:'знакомое low-impact действие при запасе может идти автоматически',expr:`govern({'known':True,'impact':'low','capacity':True},{'trust':70}) == 'auto'`}),
]);

function esc(value=''){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function setText(root,sel,value){const node=root.querySelector(sel);if(node)node.textContent=value;}

export function createCityWeave(root,{getProfile=()=>({}),getMode=()=> 'guided',onProfile=()=>{},onSound=()=>{},onClose=()=>{}}={}){
  if(!root)return {open(){},close(){},refresh(){}};
  let index=0,selected='',simulation=null,seasonMode=false,seasonSeed=1,codeBusy=false;
  const profile=()=>getProfile();
  const weave=()=>profile().labs?.weave??{};
  const decisions=()=>weave().decisions??[];
  const done=()=>new Set(weave().completedArcs??[]);
  const arc=()=>WEAVE_ARCS[index]??WEAVE_ARCS[0];

  function renderMetrics(state){
    for(const key of ['trust','resilience','access','throughput']){
      setText(root,`#weave${key[0].toUpperCase()+key.slice(1)}Value`,`${state[key]}`);
      const bar=root.querySelector(`#weave${key[0].toUpperCase()+key.slice(1)}Bar`);if(bar)bar.style.width=`${state[key]}%`;
    }
    setText(root,'#weaveAutonomy',`${state.autonomy}%`);
    root.dataset.balance=cityBalanceScore(state)>=55?'stable':cityBalanceScore(state)>=35?'strained':'fragile';
  }
  function renderDistricts(state){const host=root.querySelector('#weaveDistricts');host.replaceChildren();for(const d of WEAVE_DISTRICTS){const el=document.createElement('div');const active=d.id===arc().district;const trust=state.districtTrust?.[d.id]??50;el.dataset.active=String(active);el.dataset.trust=trust>=60?'high':trust>=40?'mid':'low';el.innerHTML=`<b>${d.icon}</b><span><strong>${esc(d.human)}</strong><small>${getMode()==='guided'?'':esc(d.tech)}</small><em>ДОВЕРИЕ ${trust}</em></span>`;host.append(el);}}
  function renderHistory(){const host=root.querySelector('#weaveHistory');host.replaceChildren();const list=decisions().slice(-4);if(!list.length){host.innerHTML='<em>Город ещё не помнит твоих решений. Эта история начнётся здесь.</em>';return;}for(const sig of list){const [a,c]=sig.split(':');const ar=getWeaveArc(a),ch=getWeaveChoice(ar,c);const row=document.createElement('div');row.innerHTML=`<small>${esc(ar.chapter)}</small><b>${esc(ch?.human??c)}</b>`;host.append(row);}}
  function renderChoices(){const host=root.querySelector('#weaveChoices');host.replaceChildren();for(const c of arc().choices){const b=document.createElement('button');b.type='button';b.dataset.selected=String(selected===c.id);b.innerHTML=`<span>${esc(c.human)}</span><small>${getMode()==='guided'?'':esc(c.tech)}</small>`;b.addEventListener('click',()=>{selected=c.id;simulation=null;render();});host.append(b);}}
  function renderBeats(){const host=root.querySelector('#weaveBeats');host.replaceChildren();const beats=simulation?.chosen?.beats??[];if(!beats.length){host.innerHTML='<em>Сначала проживи смену. Мир покажет последствия, а не просто “верно/неверно”.</em>';return;}beats.forEach((line,i)=>{const d=document.createElement('div');d.innerHTML=`<b>${i+1}</b><span>${esc(line)}</span>`;host.append(d);});}
  function render(){const a=arc();const state=simulation?.after??deriveWeaveState(decisions());setText(root,'#weaveProgress',`${done().size}/${WEAVE_ARCS.length} СМЕН · ${(weave().seasonSeeds??[]).length} ∞ СЕЗОНОВ`);setText(root,'#weaveChapter',a.chapter);setText(root,'#weaveCaller',a.caller);setText(root,'#weaveMessage',a.message);setText(root,'#weaveTension',a.tension);renderMetrics(state);renderDistricts(state);renderHistory();renderChoices();renderBeats();setText(root,'#weaveStatus',simulation?.status??'Посмотри, кто зависит от решения, выбери компромисс и проживи с ним одну смену.');root.querySelector('#weaveSimulate').disabled=!selected;root.querySelector('#weaveCommit').hidden=!(simulation?.ok);root.querySelector('#weaveNext').hidden=seasonMode||!done().has(a.id);root.querySelector('#weaveSeasonComplete').hidden=!seasonMode||!simulation?.ok;root.querySelector('#weaveLesson').hidden=!(done().has(a.id)&&!seasonMode);if(done().has(a.id)&&!seasonMode)setText(root,'#weaveLesson',a.lesson);}
  function simulate(){simulation=evaluateWeaveChoice(arc(),{choiceId:selected,decisions:decisions()});render();onSound(simulation.ok?'scan':'blocked');}
  function commit(){if(!simulation?.ok)return;const a=arc(),c=simulation.chosen;onProfile({type:'weave-arc',id:a.id,choice:c.id,score:simulation.score,xp:240});simulation=null;onSound('reward');render();}
  function next(){seasonMode=false;const ni=WEAVE_ARCS.findIndex((x,i)=>i>index&&!done().has(x.id));index=ni>=0?ni:Math.min(WEAVE_ARCS.length-1,index+1);selected='';simulation=null;render();}
  function openSeason(){if(done().size<WEAVE_ARCS.length){setText(root,'#weaveStatus','Сначала проживи пять городских смен. После этого мир начнёт смешивать знакомые компромиссы.');onSound('blocked');return;}seasonMode=true;const s=generateWeaveSeason(seasonSeed);index=WEAVE_ARCS.findIndex(x=>x.id===s.arcId);selected='';simulation=null;const label=root.querySelector('#weaveSeasonLabel');label.hidden=false;label.textContent=`CITY SEASON #${String(s.seed).padStart(3,'0')} · PRESSURE ${s.pressure}/5 · ${s.twist}`;render();}
  function completeSeason(){if(!seasonMode||!simulation?.ok)return;onProfile({type:'weave-season',seed:seasonSeed,score:simulation.score,xp:130});seasonSeed+=1;openSeason();}
  function openCode(){if(done().size<WEAVE_ARCS.length){setText(root,'#weaveStatus','Сначала проживи пять смен. Тогда “auto / human / defer” будет не термином, а уже понятным обещанием миру.');onSound('blocked');return;}root.querySelector('#weaveStory').hidden=true;root.querySelector('#weaveCodePanel').hidden=false;const area=root.querySelector('#weaveCode');if(area&&!area.value.trim())area.value=CITY_GOVERNOR_STARTER;}
  async function runCode(){if(codeBusy)return;codeBusy=true;const btn=root.querySelector('#weaveCodeRun');btn.disabled=true;setText(root,'#weaveCodeStatus','CPython гоняет события с разным риском, доверием и запасом…');const result=await runPython({source:root.querySelector('#weaveCode').value,checks:CITY_GOVERNOR_CHECKS});codeBusy=false;btn.disabled=false;const host=root.querySelector('#weaveCodeChecks');host.replaceChildren();if(result.error){const d=document.createElement('div');d.dataset.ok='false';d.textContent=`× ${result.error.text}`;host.append(d);}else result.checks.forEach((c,i)=>{const d=document.createElement('div');d.dataset.ok=String(c.ok);d.textContent=`${c.ok?'✓':'×'} ${CITY_GOVERNOR_CHECKS[i].detail}`;host.append(d);});const ok=!result.error&&result.checks.length===CITY_GOVERNOR_CHECKS.length&&result.checks.every(x=>x.ok);if(ok){onProfile({type:'weave-code',xp:520});setText(root,'#weaveCodeStatus','✓ CITY GOVERNOR DEPLOYED · автономность теперь ограничена явным кодом, а не настроением Q-Bot.');onSound('reward');}else{setText(root,'#weaveCodeStatus',result.error?.hint??'Есть событие, которому система выдаёт слишком много или слишком мало власти.');onSound('blocked');}}

  root.querySelector('#weaveSimulate').addEventListener('click',simulate);root.querySelector('#weaveCommit').addEventListener('click',commit);root.querySelector('#weaveNext').addEventListener('click',next);root.querySelector('#weaveSeasonOpen').addEventListener('click',openSeason);root.querySelector('#weaveSeasonComplete').addEventListener('click',completeSeason);root.querySelector('#weaveCodeOpen').addEventListener('click',openCode);root.querySelector('#weaveCodeBack').addEventListener('click',()=>{root.querySelector('#weaveStory').hidden=false;root.querySelector('#weaveCodePanel').hidden=true;render();});root.querySelector('#weaveCodeRun').addEventListener('click',runCode);root.querySelector('#weaveClose').addEventListener('click',()=>{root.hidden=true;onClose();});
  return {open(){const first=WEAVE_ARCS.findIndex(x=>!done().has(x.id));index=first>=0?first:0;selected='';simulation=null;seasonMode=false;root.querySelector('#weaveStory').hidden=false;root.querySelector('#weaveCodePanel').hidden=true;root.querySelector('#weaveSeasonLabel').hidden=true;root.hidden=false;render();},close(){root.hidden=true;},refresh:render};
}
