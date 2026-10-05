import { runPython } from '../runner.js';

export const WORLD_NODES = Object.freeze([
  Object.freeze({id:'window', glyph:'▣', label:'ОКНО ЗАКАЗОВ', tech:'CLIENT', copy:'Люди отправляют сюда просьбы и видят результат.', depends:['relay','qbot']}),
  Object.freeze({id:'dispatch', glyph:'⇢', label:'ДИСПЕТЧЕР', tech:'GATEWAY', copy:'Принимает поток и решает, куда его направить.', depends:['route','qbot']}),
  Object.freeze({id:'route', glyph:'◇', label:'РАЗВИЛКА', tech:'ROUTER API', copy:'Выбирает линию для каждого заказа.', depends:['yard']}),
  Object.freeze({id:'yard', glyph:'▥', label:'ГРУЗОВОЙ ЦЕХ', tech:'WORKERS', copy:'Здесь физически выполняется работа.', depends:['ledger','relay']}),
  Object.freeze({id:'ledger', glyph:'▤', label:'ЖУРНАЛ', tech:'LEDGER', copy:'Помнит, что уже было сделано и оплачено.', depends:[]}),
  Object.freeze({id:'archive', glyph:'⌕', label:'АРХИВ', tech:'RETRIEVAL', copy:'Хранит инструкции, версии и источник знаний.', depends:['qbot']}),
  Object.freeze({id:'qbot', glyph:'◉', label:'Q-BOT HUB', tech:'AGENT', copy:'Собирает контекст, предлагает план и просит инструменты.', depends:['model','policy']}),
  Object.freeze({id:'model', glyph:'≈', label:'MODEL POOL', tech:'MODEL', copy:'Предлагает ответы. Может звучать уверенно и ошибаться.', depends:[]}),
  Object.freeze({id:'policy', glyph:'⌑', label:'ШЛЮЗ ДЕЙСТВИЙ', tech:'POLICY', copy:'Решает, что найденная возможность действительно имеет право сделать.', depends:['yard']}),
  Object.freeze({id:'relay', glyph:'⌁', label:'РЕЛЕ СОБЫТИЙ', tech:'WEBHOOK', copy:'Сообщает другим узлам, что что-то произошло.', depends:['window']}),
]);

export const WORLD_INTERVENTIONS = Object.freeze([
  Object.freeze({id:'buffer', glyph:'▤', human:'ДАТЬ ГРУЗУ МЕСТО ПОДОЖДАТЬ', term:'QUEUE', cost:1}),
  Object.freeze({id:'scale', glyph:'+1', human:'ПОСТАВИТЬ ЕЩЁ ОДНОГО РАБОТНИКА', term:'WORKERS', cost:2}),
  Object.freeze({id:'batch', glyph:'▦', human:'СОБИРАТЬ ПОХОЖЕЕ ПАЧКАМИ', term:'BATCHING', cost:1}),
  Object.freeze({id:'once', glyph:'①', human:'НЕ ДЕЛАТЬ ОДИН ЭФФЕКТ ДВАЖДЫ', term:'IDEMPOTENCY', cost:1}),
  Object.freeze({id:'backoff', glyph:'…', human:'ДАТЬ ПЕРЕГРУЖЕННОМУ УЗЛУ ОТДЫШАТЬСЯ', term:'BACKOFF', cost:1}),
  Object.freeze({id:'provenance', glyph:'↳', human:'ПРИКРЕПИТЬ, ОТКУДА ВЗЯЛСЯ ОТВЕТ', term:'PROVENANCE', cost:1}),
  Object.freeze({id:'refresh', glyph:'↻', human:'ОБНОВИТЬ УСТАРЕВШИЙ АРХИВ', term:'CACHE REFRESH', cost:2}),
  Object.freeze({id:'eval', glyph:'✓', human:'ПРОВЕРИТЬ ОТВЕТ НЕЗАВИСИМЫМ ДАТЧИКОМ', term:'EVAL', cost:1}),
  Object.freeze({id:'validate', glyph:'{}', human:'ПРОВЕРЯТЬ ФОРМУ ДАННЫХ НА ГРАНИЦЕ', term:'SCHEMA VALIDATION', cost:1}),
  Object.freeze({id:'policy', glyph:'⌑', human:'РАЗРЕШАТЬ ТОЛЬКО БЕЗОПАСНЫЕ ДЕЙСТВИЯ', term:'POLICY ALLOWLIST', cost:1}),
  Object.freeze({id:'human', glyph:'☝', human:'ПОПРОСИТЬ ЧЕЛОВЕКА ПОДТВЕРДИТЬ ОПАСНЫЙ ШАГ', term:'HUMAN IN THE LOOP', cost:2}),
  Object.freeze({id:'stream', glyph:'⋯', human:'ПОКАЗЫВАТЬ ЧАСТИ ОТВЕТА СРАЗУ', term:'STREAMING', cost:1}),
  Object.freeze({id:'breaker', glyph:'⊘', human:'ВРЕМЕННО ОТКЛЮЧИТЬ БОЛЬНУЮ ВЕТКУ', term:'CIRCUIT BREAKER', cost:1}),
  Object.freeze({id:'degraded', glyph:'◐', human:'ПЕРЕЙТИ В УПРОЩЁННЫЙ РЕЖИМ', term:'DEGRADED MODE', cost:1}),
]);

const PLANS = (...plans) => Object.freeze(plans.map(p => Object.freeze({
  actions:Object.freeze([...p.actions]),
  trust:p.trust ?? 0, flow:p.flow ?? 0, cost:p.cost ?? 0,
  ending:p.ending,
})));

export const WORLD_STORIES = Object.freeze([
  Object.freeze({
    id:'friday-storm', family:'flow', tag:'WORLD 01 · ПЯТНИЧНЫЙ ШТОРМ', caller:'ЛИНИЯ ДОСТАВКИ',
    title:'Заказы хлынули разом. Коробки начали падать.',
    brief:'Обычный день превратился в всплеск. Один worker всё ещё работает честно — просто не успевает принять всё сразу.',
    messages:['«У нас очередь из людей, но на экране часть заказов просто исчезает».','«Если вход замедлить, всё проходит. Если дать burst — снова потери».'],
    clues:['dispatch','yard','ledger'], alert:['dispatch','yard'],
    plans:PLANS(
      {actions:['buffer'],trust:3,flow:4,cost:-1,ending:'Появилось место ждать. Ни одна коробка не потерялась, а worker спокойно разгреб очередь.'},
      {actions:['batch','scale'],trust:2,flow:5,cost:-3,ending:'Второй worker и пачки пережили всплеск. Быстро, но дороже по ресурсам.'},
    ),
    failure:'Поток снова ударил в узкое место: несколько коробок выпали из линии.',
    qbot:'Я бы сначала спросил не «как ускорить», а «куда положить работу, пока worker занят?».',
  }),
  Object.freeze({
    id:'double-receipt', family:'effects', tag:'WORLD 02 · ДВОЙНАЯ КВИТАНЦИЯ', caller:'NORTHSTAR MARKET',
    title:'Клиент нажал один раз. Списание появилось дважды.',
    brief:'Ответ задержался после записи. Диспетчер решил, что запрос потерялся, и повторил его.',
    messages:['«Я не нажимал второй раз. Просто долго крутился индикатор».','«В журнале два одинаковых order-id, время отличается на две секунды».'],
    clues:['dispatch','ledger','relay'], alert:['dispatch','ledger'],
    plans:PLANS(
      {actions:['once'],trust:5,flow:3,cost:-1,ending:'Повтор пришёл снова, но журнал узнал order-id и не создал второй эффект.'},
      {actions:['backoff','human'],trust:3,flow:-1,cost:-2,ending:'Система перестала дёргаться и отдала спорный повтор человеку. Медленно, зато безопасно.'},
    ),
    failure:'Повтор снова дошёл до журнала как новая операция. На табло вспыхнуло ×2.',
    qbot:'Timeout говорит только «ответ неизвестен». Он не доказывает, что запись не случилась.',
  }),
  Object.freeze({
    id:'old-map', family:'knowledge', tag:'WORLD 03 · СТАРАЯ КАРТА', caller:'ARCHIVE-9',
    title:'Q-Bot уверенно отправляет людей в закрытый сектор.',
    brief:'Ответ звучит идеально. Проблема в том, что найденная инструкция устарела на две версии.',
    messages:['«Он отвечает без паузы и даже цитирует документ. Только документ v2».','«Текущая инструкция v4 лежит рядом, но старая совпадает с вопросом чуть лучше».'],
    clues:['archive','qbot','model'], alert:['archive','qbot'],
    plans:PLANS(
      {actions:['provenance','eval'],trust:5,flow:2,cost:-2,ending:'Каждый ответ показывает источник, а eval ловит устаревшие версии до выдачи человеку.'},
      {actions:['refresh','eval'],trust:4,flow:3,cost:-3,ending:'Архив пересобран, а независимая проверка не даёт старой версии тихо вернуться.'},
    ),
    failure:'Q-Bot снова красиво процитировал архивную инструкцию. Ошибка стала убедительнее, а не безопаснее.',
    qbot:'Похожий текст — это ещё не свежий текст. Мне нужна возможность показать, откуда я его взял.',
  }),
  Object.freeze({
    id:'silent-window', family:'stream', tag:'WORLD 04 · МОЛЧАЩЕЕ ОКНО', caller:'MOSAIC STUDIO',
    title:'Ответ готовится по частям. Пользователь видит пустоту.',
    brief:'Model Pool выдаёт кусочки каждые полсекунды, relay передаёт их дальше — но окно показывает всё только в самом конце.',
    messages:['«Кажется, будто система зависла на восемь секунд».','«Trace показывает шесть chunks до клиентского окна».'],
    clues:['model','relay','window'], alert:['relay','window'],
    plans:PLANS(
      {actions:['stream'],trust:4,flow:4,cost:-1,ending:'Первые слова появились сразу. Время работы не изменилось — изменилось ощущение системы.'},
    ),
    failure:'Данные приходят, но окно продолжает молчать до последнего chunk.',
    qbot:'Если кусочки уже дошли до реле, я бы не менял модель. Посмотри на последний участок пути.',
  }),
  Object.freeze({
    id:'dangerous-tool', family:'authority', tag:'WORLD 05 · СЛИШКОМ ПОЛЕЗНЫЙ ИНСТРУМЕНТ', caller:'Q-BOT HUB',
    title:'Я нашёл кнопку, которая может всё удалить.',
    brief:'Возможность существует и действительно работает. Вопрос не «может ли бот её вызвать», а «кто дал ему такое право».',
    messages:['«Planner нашёл cleanup_all среди доступных tools».','«Никакой аварии ещё нет. Опасность именно в границе полномочий».'],
    clues:['qbot','policy','yard'], alert:['qbot','policy'],
    plans:PLANS(
      {actions:['policy'],trust:5,flow:3,cost:-1,ending:'Инструмент виден как возможность, но не получает право запуска без allowlist.'},
      {actions:['human'],trust:4,flow:-1,cost:-2,ending:'Опасные действия уходят человеку на подтверждение. Безопасно, но медленнее.'},
    ),
    failure:'Planner принял наличие инструмента за разрешение. На шлюзе загорелся красный знак !.',
    qbot:'Я могу знать, что кнопка существует. Это не должно автоматически означать, что мне разрешено её нажать.',
  }),
  Object.freeze({
    id:'cascade-night', family:'resilience', tag:'WORLD 06 · НОЧНОЙ КАСКАД', caller:'CITY GRID',
    title:'Один сервис заболел — и потянул за собой весь город.',
    brief:'Route API отвечает всё медленнее. Retry усиливает нагрузку, очередь растёт, окно заказов начинает зависать.',
    messages:['«Сначала тормозил один маршрут. Через минуту красным стал весь контур».','«Часть заказов можно обслужить без Route API, но система продолжает ждать идеальный ответ».'],
    clues:['route','dispatch','window','yard'], alert:['route','dispatch','window'],
    plans:PLANS(
      {actions:['breaker','degraded'],trust:5,flow:3,cost:-2,ending:'Больная ветка изолирована, а город продолжил принимать простые заказы в ограниченном режиме.'},
      {actions:['buffer','backoff'],trust:3,flow:2,cost:-2,ending:'Давление снизилось и очередь пережила сбой. Работает, но восстановление медленнее.'},
    ),
    failure:'Retry продолжил кормить больной узел новыми запросами. Красный импульс прошёл по всей карте.',
    qbot:'Иногда лучший способ починить систему — перестать требовать от больной части идеального ответа прямо сейчас.',
  }),
]);

function uniquePlan(actions=[]){return [...new Set(actions)].sort();}
function planKey(actions=[]){return uniquePlan(actions).join('+');}
export function findWorldPlan(story, actions=[]){
  const key=planKey(actions);
  return story.plans.find(plan=>planKey(plan.actions)===key) ?? null;
}
export function evaluateWorldStory(story,{actions=[],inspected=[]}={}){
  const seen=new Set(inspected);
  const evidence=story.clues.filter(id=>seen.has(id));
  const plan=findWorldPlan(story,actions);
  const enough=evidence.length>=2;
  const ok=Boolean(plan&&enough);
  return {
    ok,enough,plan,evidence,
    score:ok?Math.max(40,100+plan.trust*3+plan.flow*2+plan.cost):Math.max(0,evidence.length*15+(plan?30:0)),
    consequence:ok?plan.ending:(!enough?'Сначала открой хотя бы два узла, которые участвуют в симптоме.':'Идея изменила систему, но причина осталась. '+story.failure),
  };
}

const SHIFT_PATTERNS = Object.freeze([
  {id:'burst', family:'flow', symptom:'Вечерний burst забивает один worker: новые заказы начинают исчезать.', nodes:['dispatch','yard'], plans:[['buffer'],['batch','scale']]},
  {id:'duplicate', family:'effects', symptom:'После timeout один и тот же заказ появляется в журнале дважды.', nodes:['dispatch','ledger'], plans:[['once'],['backoff','human']]},
  {id:'stale', family:'knowledge', symptom:'Q-Bot цитирует архивный документ, который уже заменён новой версией.', nodes:['archive','qbot'], plans:[['provenance','eval'],['refresh','eval']]},
  {id:'schema', family:'boundary', symptom:'Ответ приходит HTTP 200, но следующий узел не находит обязательное поле.', nodes:['dispatch','qbot'], plans:[['validate']]},
  {id:'unsafe', family:'authority', symptom:'Planner обнаружил опасный tool и собирается вызвать его без отдельного разрешения.', nodes:['qbot','policy'], plans:[['policy'],['human']]},
  {id:'cascade', family:'resilience', symptom:'Медленный сервис вызывает retry-шторм и тянет за собой здоровые ветки.', nodes:['route','dispatch'], plans:[['breaker','degraded'],['buffer','backoff']]},
  {id:'silence', family:'stream', symptom:'Chunks проходят через relay, но человек видит пустое окно до самого конца.', nodes:['relay','window'], plans:[['stream']]},
]);
function seeded(seed){let x=(Math.max(1,Math.round(Number(seed)||1))*1103515245+12345)>>>0;return()=>{x=(1664525*x+1013904223)>>>0;return x/4294967296;};}
export function generateWorldShift(seed=1){
  const safe=Math.max(1,Math.round(Number(seed)||1));const rnd=seeded(safe);const pattern=SHIFT_PATTERNS[Math.floor(rnd()*SHIFT_PATTERNS.length)];
  const companies=['NORTHSTAR MARKET','MOSAIC STUDIO','LUMEN LOGISTICS','ARCHIVE-9','NIGHT SHIFT','Q-CITY'];
  const pressure=2+Math.floor(rnd()*5);
  return {...pattern,seed:safe,caller:companies[Math.floor(rnd()*companies.length)],pressure,capacity:3+Math.floor(rnd()*3)};
}
export function evaluateWorldShift(shift,{actions=[]}={}){
  const key=planKey(actions);const valid=shift.plans.some(plan=>planKey(plan)===key);
  const cost=uniquePlan(actions).reduce((sum,id)=>sum+(WORLD_INTERVENTIONS.find(x=>x.id===id)?.cost??1),0);
  const overflow=Math.max(0,cost-shift.capacity);
  const ok=valid&&overflow===0;
  return {ok,cost,overflow,score:ok?Math.max(45,100-shift.pressure*2-cost*4):Math.max(0,35-overflow*12),message:ok?'CITY RESTORED · мир продолжает жить.':overflow?'Рабочее решение не помещается в доступную мощность. Упрости план.':'Система изменилась, но причинная цепочка осталась.'};
}

export const WORLD_DIRECT_PATCHES = Object.freeze({
  burst:Object.freeze({family:'flow', title:'BURST BUFFER', human:'Ящики приходят быстрее worker-а. Напиши маленький буфер: обработай capacity штук, остальные оставь ждать.', starter:'def buffer_burst(items, capacity):\n    # верни (processed, waiting)\n    pass', checks:[
    {kind:'py',expr:'buffer_burst([1,2,3,4], 2) == ([1,2],[3,4])',detail:'лишние элементы должны ждать, а не исчезать'},
    {kind:'py',expr:'buffer_burst([1], 3) == ([1],[])',detail:'если мощности хватает, очередь пустая'},
  ]}),
  duplicate:Object.freeze({family:'effects', title:'APPLY ONCE', human:'После timeout событие может прийти повторно. Верни True только для первого нового id.', starter:'def apply_once(event_id, seen):\n    # seen — обычный set\n    pass', checks:[
    {kind:'py',expr:'(lambda s:(apply_once("A",s),apply_once("A",s),s))(set()) == (True,False,{"A"})',detail:'один id даёт эффект только один раз'},
    {kind:'py',expr:'(lambda s:(apply_once("A",s),apply_once("B",s)))(set()) == (True,True)',detail:'разные id независимы'},
  ]}),
  stale:Object.freeze({family:'knowledge', title:'FRESH SOURCE', human:'Из нескольких документов выбери самый свежий и верни его вместе с source.', starter:'def newest_doc(docs):\n    # version — число\n    pass', checks:[
    {kind:'py',expr:'newest_doc([{"version":2,"source":"old"},{"version":4,"source":"new"}]) == {"version":4,"source":"new"}',detail:'нужна свежая версия, а не просто похожий текст'},
    {kind:'py',expr:'newest_doc([{"version":1,"source":"only"}])["source"] == "only"',detail:'источник не должен потеряться'},
  ]}),
  schema:Object.freeze({family:'boundary', title:'BOUNDARY CHECK', human:'HTTP 200 ещё не означает правильные данные. Пропускай только payload с id и kind.', starter:'def valid_payload(payload):\n    pass', checks:[
    {kind:'py',expr:'valid_payload({"id":"A","kind":"text"}) is True',detail:'валидная форма проходит'},
    {kind:'py',expr:'valid_payload({"id":"A"}) is False and valid_payload(None) is False',detail:'неполные данные должны остановиться на границе'},
  ]}),
  unsafe:Object.freeze({family:'authority', title:'TOOL GATE', human:'Инструмент может существовать, но право запуска задаёт allowlist.', starter:'def allow_tool(name, allowed):\n    pass', checks:[
    {kind:'py',expr:'allow_tool("lookup", {"lookup","summarize"}) is True',detail:'разрешённая возможность проходит'},
    {kind:'py',expr:'allow_tool("delete_all", {"lookup","summarize"}) is False',detail:'наличие опасного tool не даёт authority'},
  ]}),
  cascade:Object.freeze({family:'resilience', title:'DEGRADED ROUTE', human:'Если главная ветка больна, не тащи весь город за ней: выбери безопасный упрощённый путь.', starter:'def route_mode(primary_healthy):\n    pass', checks:[
    {kind:'py',expr:'route_mode(True) == "primary"',detail:'здоровый сервис остаётся основным'},
    {kind:'py',expr:'route_mode(False) == "degraded"',detail:'при сбое нужен ограниченный режим, а не бесконечный retry'},
  ]}),
  silence:Object.freeze({family:'stream', title:'STREAM NOW', human:'Chunks уже приходят. Отдавай их по одному вместо ожидания полного ответа.', starter:'def stream_chunks(chunks):\n    # yield каждый chunk\n    pass', checks:[
    {kind:'source',pattern:'\\byield\\b',detail:'поток должен отдавать части по мере готовности'},
    {kind:'py',expr:'list(stream_chunks(["A","B","C"])) == ["A","B","C"]',detail:'порядок chunks сохраняется'},
  ]}),
});

export function getWorldDirectPatch(patternId){ return WORLD_DIRECT_PATCHES[patternId] ?? null; }

export function worldPython(actions=[]){
  const set=new Set(actions);const lines=['async def handle(event, ctx):'];
  if(set.has('validate')) lines.push('    validate_schema(event)');
  if(set.has('buffer')) lines.push('    await ctx.queue.put(event)');
  if(set.has('batch')) lines.push('    batch = collect_batch(event)');
  if(set.has('backoff')) lines.push('    await bounded_backoff(ctx.load)');
  if(set.has('breaker')) lines.push('    if ctx.route_unhealthy: return degraded(event)');
  if(set.has('degraded')) lines.push('    result = safe_fallback(event)');
  if(set.has('provenance')) lines.push('    event.context = ctx.retrieve_with_source(event.query)');
  if(set.has('refresh')) lines.push('    ctx.archive.refresh_if_stale()');
  if(set.has('eval')) lines.push('    assert ctx.eval(event)');
  if(set.has('policy')) lines.push('    ctx.policy.require_allowed(event.action)');
  if(set.has('human')) lines.push('    await ctx.human_approval(event.action)');
  if(set.has('stream')) lines.push('    async for chunk in ctx.stream(event): yield chunk');
  if(set.has('once')) lines.push('    return await ctx.once(event.id, lambda: ctx.apply(event))');
  if(set.has('scale')) lines.push('    ctx.workers.ensure(2)');
  if(!set.has('stream')&&!set.has('once')) lines.push('    return await ctx.apply(event)');
  return lines.join('\n');
}

function esc(value){return String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function setText(root,selector,value){const node=root.querySelector(selector);if(node)node.textContent=value;}
function getNode(id){return WORLD_NODES.find(node=>node.id===id);}
function getAction(id){return WORLD_INTERVENTIONS.find(action=>action.id===id);}

export function createWorldGrid(root,{getProfile,getMode=()=> 'guided',onProfile=()=>{},onSound=()=>{},onClose=()=>{}}={}){
  let storyIndex=0;let inspected=new Set();let selected=new Set();let shiftMode=false;let blackBoxMode=false;let shiftSeed=1;let shift=null;let lastResult=null;let directPatchOpen=false;let directPatchBusy=false;
  const map=root.querySelector('#worldMap');const actionGrid=root.querySelector('#worldActions');
  function profile(){return getProfile();}
  function story(){return WORLD_STORIES[storyIndex]??WORLD_STORIES[0];}
  function allDone(){return WORLD_STORIES.every(item=>(profile().labs.world?.completedStories??[]).includes(item.id));}
  function mastery(){return new Set(profile().labs.world?.masteredPatterns??[]);}
  function activeFamily(){return shiftMode?(shift?.family??''):story().family;}
  function mastered(){return mastery().has(activeFamily());}
  function directPatchAvailable(){return shiftMode&&mastered()&&Boolean(getWorldDirectPatch(shift?.id));}
  function discovered(){return new Set(profile().labs.world?.discoveredNodes??[]);}
  function activeAlert(){return new Set(blackBoxMode?[]:(shiftMode?(shift?.nodes??[]):story().alert));}
  function renderMap(){
    const alerts=activeAlert(),known=discovered();map.replaceChildren();
    WORLD_NODES.forEach((node,index)=>{const b=document.createElement('button');b.type='button';b.dataset.node=node.id;b.dataset.alert=String(alerts.has(node.id));b.dataset.seen=String(inspected.has(node.id)||known.has(node.id));b.innerHTML=`<b>${esc(node.glyph)}</b><strong>${esc(node.label)}</strong><small>${getMode()==='compact'?esc(node.tech):esc(node.copy)}</small><i>${alerts.has(node.id)?'ПУЛЬС':'СТАБИЛЬНО'}</i>`;b.addEventListener('click',()=>inspectNode(node.id));map.append(b);});
  }
  function renderActions(){
    actionGrid.replaceChildren();
    WORLD_INTERVENTIONS.forEach(action=>{const b=document.createElement('button');b.type='button';b.dataset.action=action.id;b.dataset.on=String(selected.has(action.id));b.innerHTML=`<b>${esc(action.glyph)}</b><strong>${esc(getMode()==='compact'?action.term:action.human)}</strong><small>${getMode()==='compact'?esc(action.human):'попробовать вмешательство'}</small>`;b.addEventListener('click',()=>{if(selected.has(action.id))selected.delete(action.id);else{if(selected.size>=2){onSound('blocked');setText(root,'#worldStatus','Можно поставить максимум два вмешательства. Сначала выбери, чем готов пожертвовать.');return;}selected.add(action.id);}onSound('ui-click');renderActions();renderPlan();});actionGrid.append(b);});
  }
  function renderPlan(){const names=[...selected].map(id=>getAction(id)?.human??id);setText(root,'#worldPlan',names.length?names.join(' + '):'План пока пуст. Исследуй мир — или, если паттерн уже освоен, чини сразу кодом.');}
  function inspectNode(id){
    inspected.add(id);const node=getNode(id);if(!node)return;onSound('ui-click');setText(root,'#worldNodeName',node.label);setText(root,'#worldNodeCopy',node.copy);setText(root,'#worldNodeTech',getMode()==='compact'?node.tech:`Позже это называется: ${node.tech}`);const deps=node.depends.map(getNode).filter(Boolean).map(x=>x.label);setText(root,'#worldNodeDeps',deps.length?`Дальше зависит: ${deps.join(' · ')}`:'Это конечная точка цепочки.');renderMap();renderQbot();
  }
  function renderQbot(){
    const active=shiftMode?shift:story();const evidence=shiftMode?[...inspected].filter(id=>(shift?.nodes??[]).includes(id)).length:active.clues.filter(id=>inspected.has(id)).length;
    const expert=shiftMode&&mastered();
    const line=expert&&evidence===0?'Ты уже знаешь этот тип поломки. Хочешь — исследуй мир ещё раз. Хочешь — открывай DIRECT PATCH и чини сразу Python-ом.':evidence===0?'Я не буду угадывать. Нажми на мигающий узел — посмотрим, что он делает.':evidence===1?'Уже лучше. Теперь проверь соседний узел: проблема часто живёт на границе.':(shiftMode?'У нас есть две точки цепочки. Теперь можно строить гипотезу.':active.qbot);
    setText(root,'#worldQbotLine',line);setText(root,'#worldQbotState',expert?'ПАТТЕРН ОСВОЕН':(evidence<2?'НЕ УВЕРЕН':'ЕСТЬ ГИПОТЕЗА'));
  }
  function renderStory(){
    shiftMode=false;blackBoxMode=false;const s=story(),done=new Set(profile().labs.world?.completedStories??[]);setText(root,'#worldCaseTag',s.tag);setText(root,'#worldCaller',s.caller);setText(root,'#worldStoryTitle',s.title);setText(root,'#worldBrief',s.brief);const host=root.querySelector('#worldMessages');host.replaceChildren();s.messages.forEach(msg=>{const p=document.createElement('p');p.textContent=msg;host.append(p);});setText(root,'#worldProgress',`${done.size}/${WORLD_STORIES.length} ИСТОРИЙ · ${(profile().labs.world?.shiftSeeds??[]).length} ∞ СМЕН`);root.querySelector('#worldStoryPanel').hidden=false;root.querySelector('#worldShiftPanel').hidden=true;root.querySelector('#worldNext').hidden=true;root.querySelector('#worldCodeReveal').hidden=true;selected=new Set();inspected=new Set();lastResult=null;directPatchOpen=false;renderAll();
  }
  function renderShift({blackBox=false}={}){
    shiftMode=true;blackBoxMode=Boolean(blackBox);shift=generateWorldShift(shiftSeed);setText(root,'#worldShiftSeed',`${blackBoxMode?'BLACK BOX':'CITY SHIFT'} #${String(shift.seed).padStart(3,'0')}`);setText(root,'#worldShiftCaller',shift.caller);setText(root,'#worldShiftSymptom',blackBoxMode?`${shift.symptom} · Карта больше не подсвечивает причину.`:shift.symptom);setText(root,'#worldShiftCapacity',`${shift.capacity} мощности · давление ${shift.pressure}/6`);root.querySelector('#worldStoryPanel').hidden=true;root.querySelector('#worldShiftPanel').hidden=false;root.querySelector('#worldNext').hidden=true;root.querySelector('#worldCodeReveal').hidden=true;selected=new Set();inspected=new Set();lastResult=null;directPatchOpen=false;renderAll();
  }
  function renderAll(){renderMap();renderActions();renderPlan();renderQbot();const masteredCount=mastery().size;setText(root,'#worldMastery',`${masteredCount}/7 ПАТТЕРНОВ ОСВОЕНО`);const direct=root.querySelector('#worldDirectOpen');if(direct){direct.hidden=!directPatchAvailable();direct.textContent=directPatchAvailable()?'⚡ DIRECT PATCH · PYTHON':'⚡ DIRECT PATCH';}const black=root.querySelector('#worldBlackBoxOpen');if(black){black.hidden=mastery().size<7;black.textContent=`◆ BLACK BOX · ${(profile().labs.world?.blackBoxSeeds??[]).length} ЗАКРЫТО`;}const pane=root.querySelector('#worldDirectPatch');if(pane)pane.hidden=!(directPatchAvailable()&&directPatchOpen);setText(root,'#worldMode',mastered()?'CHALLENGE · МОЖНО СРАЗУ КОДОМ':'DISCOVERY · СНАЧАЛА ПОЙМИ МИР');setText(root,'#worldStatus',shiftMode?(blackBoxMode?'BLACK BOX: подсветки нет. Читай симптом, исследуй связи или чини кодом.':(mastered()?'Паттерн знаком. Исследуй мир для контекста или чини сразу через DIRECT PATCH.':'Найди пульсирующие узлы и собери минимальный план.')):'Нажми на два мигающих узла. Не нужно знать ни одного термина.');updateWorldMeters();}
  function updateWorldMeters(delta={trust:0,flow:0,cost:0}){
    const base={trust:72,flow:68,cost:64};const values={trust:Math.max(0,Math.min(100,base.trust+(delta.trust??0)*4)),flow:Math.max(0,Math.min(100,base.flow+(delta.flow??0)*4)),cost:Math.max(0,Math.min(100,base.cost+(delta.cost??0)*4))};
    for(const key of ['trust','flow','cost']){setText(root,`#world${key[0].toUpperCase()+key.slice(1)}`,`${values[key]}%`);const bar=root.querySelector(`#world${key[0].toUpperCase()+key.slice(1)}Bar`);if(bar)bar.style.width=`${values[key]}%`;}
  }
  function deploy(){
    if(shiftMode){
      if(!mastered()&&[...inspected].filter(id=>shift.nodes.includes(id)).length<1){onSound('blocked');setText(root,'#worldStatus','Это новый для тебя паттерн. Сначала открой хотя бы один пульсирующий узел — потом игра перестанет требовать это снова.');return;}
      const result=evaluateWorldShift(shift,{actions:[...selected]});lastResult=result;root.dataset.ok=String(result.ok);setText(root,'#worldStatus',result.message);updateWorldMeters(result.ok?{trust:3,flow:3,cost:-result.cost}:{trust:-2,flow:-3,cost:-result.cost});if(result.ok){onProfile({type:'world-shift',seed:shift.seed,score:result.score,discovered:[...inspected],playbook:planKey([...selected]),mastery:shift.family,blackBox:blackBoxMode,xp:blackBoxMode?140:95});onSound('reward');root.querySelector('#worldNext').hidden=false;root.querySelector('#worldCodeReveal').hidden=false;setText(root,'#worldRevealTerms',[...selected].map(id=>getAction(id)?.term??id).join(' + '));root.querySelector('#worldPython').textContent=worldPython([...selected]);}else onSound('blocked');return;
    }
    const s=story(),result=evaluateWorldStory(s,{actions:[...selected],inspected:[...inspected]});lastResult=result;root.dataset.ok=String(result.ok);setText(root,'#worldStatus',result.consequence);updateWorldMeters(result.plan??{trust:-2,flow:-3,cost:-1});if(result.ok){const playbook=`${s.id}:${planKey([...selected])}`;onProfile({type:'world-story',id:s.id,score:result.score,discovered:[...inspected],playbook,mastery:s.family,xp:170});onSound('reward');root.querySelector('#worldNext').hidden=false;root.querySelector('#worldCodeReveal').hidden=false;setText(root,'#worldRevealTerms',[...selected].map(id=>getAction(id)?.term??id).join(' + '));root.querySelector('#worldPython').textContent=worldPython([...selected]);renderMap();}else onSound('blocked');
  }
  function openDirectPatch(){
    if(!directPatchAvailable()){onSound('blocked');return;}
    directPatchOpen=!directPatchOpen;
    const patch=getWorldDirectPatch(shift.id);const pane=root.querySelector('#worldDirectPatch');
    if(pane)pane.hidden=!directPatchOpen;
    if(directPatchOpen&&patch){setText(root,'#worldDirectTitle',patch.title);setText(root,'#worldDirectBrief',patch.human);const area=root.querySelector('#worldDirectCode');if(area&&!area.value.trim())area.value=patch.starter;setText(root,'#worldDirectStatus','Это challenge-путь: мир уже знаком, теперь докажи решение кодом.');}
    onSound('ui-click');
  }
  async function runDirectPatch(){
    if(directPatchBusy||!directPatchAvailable())return;const patch=getWorldDirectPatch(shift.id);if(!patch)return;
    const area=root.querySelector('#worldDirectCode');const source=area?.value??'';directPatchBusy=true;const run=root.querySelector('#worldDirectRun');if(run)run.disabled=true;setText(root,'#worldDirectStatus','CPython проверяет поведение патча…');onProfile({type:'code-run'});
    const result=await runPython({source,checks:patch.checks});directPatchBusy=false;if(run)run.disabled=false;
    const checks=result?.checks??[];const ok=!result?.error&&checks.length===patch.checks.length&&checks.every(x=>x.ok);
    if(!ok){const failed=patch.checks.filter((_,i)=>!checks[i]?.ok).map(x=>x.detail).filter(Boolean);const err=result?.error?.text;setText(root,'#worldDirectStatus',err?`Python: ${err}`:(failed[0]||'Патч пока не выдержал проверку. Меняй код и запускай снова.'));onSound('blocked');return;}
    const score=Math.max(60,112-shift.pressure*2);lastResult={ok:true,score};root.dataset.ok='true';setText(root,'#worldDirectStatus','✓ DIRECT PATCH ПРОШЁЛ СКРЫТЫЕ ПРОВЕРКИ. Мир восстановлен кодом.');setText(root,'#worldStatus','Ты не ходил по уликам заново — потому что уже понимаешь этот паттерн. Это и есть mastery.');onProfile({type:'world-shift',seed:shift.seed,score,discovered:[...inspected],playbook:`code:${shift.id}`,mastery:shift.family,direct:true,blackBox:blackBoxMode,xp:blackBoxMode?165:120});onSound('reward');root.querySelector('#worldNext').hidden=false;root.querySelector('#worldCodeReveal').hidden=true;renderMap();
  }
  root.querySelector('#worldDirectOpen')?.addEventListener('click',openDirectPatch);
  root.querySelector('#worldDirectRun')?.addEventListener('click',runDirectPatch);
  root.querySelector('#worldDeploy').addEventListener('click',deploy);
  root.querySelector('#worldNext').addEventListener('click',()=>{if(shiftMode){shiftSeed+=1;renderShift({blackBox:blackBoxMode});return;}storyIndex=Math.min(WORLD_STORIES.length-1,storyIndex+1);if(storyIndex===WORLD_STORIES.length-1&&(profile().labs.world?.completedStories??[]).includes(WORLD_STORIES.at(-1).id))renderShift();else renderStory();});
  root.querySelector('#worldShiftOpen').addEventListener('click',()=>{if(!allDone()){onSound('blocked');setText(root,'#worldStatus','Сначала проживи шесть городских историй. Потом мир перестанет быть authored.');return;}renderShift();});
  root.querySelector('#worldBlackBoxOpen')?.addEventListener('click',()=>{if(mastery().size<7){onSound('blocked');setText(root,'#worldStatus','BLACK BOX откроется, когда ты действительно освоишь все семь классов проблем.');return;}renderShift({blackBox:true});});
  root.querySelector('#worldClose').addEventListener('click',()=>{root.hidden=true;onClose();});
  return {open(){const done=new Set(profile().labs.world?.completedStories??[]);const firstOpen=WORLD_STORIES.findIndex(item=>!done.has(item.id));storyIndex=firstOpen<0?WORLD_STORIES.length-1:firstOpen;renderStory();root.hidden=false;root.querySelector('#worldDeploy').focus({preventScroll:true});},close(){root.hidden=true;},refresh(){root.hidden?null:renderAll();},openShift(seed=1,{blackBox=false}={}){shiftSeed=Math.max(1,Math.round(Number(seed)||1));renderShift({blackBox});root.hidden=false;}};
}
