const PLAIN = Object.freeze({
  filter:'отсеять мусор до того, как он попадёт в линию',
  route:'развести груз по понятным дорогам',
  queue:'дать лишнему грузу подождать, а не пропасть',
  batch:'собирать мелкие операции пачками',
  retry:'повторить временный сбой, но не бесконечно',
  idempotency:'не сделать один и тот же эффект дважды',
  cache:'не делать заново уже готовую дорогую работу',
  retrieval:'сначала найти нужный кусок знания',
  model:'дать машине предположить, а не притворяться правилом',
  eval:'проверить решение на новой смене, а не на учебных примерах',
  tools:'дать боту ограниченный набор действий',
  policy:'отделить «я могу» от «мне разрешено»',
  lock:'пускать к общей записи только одного работника за раз',
  planner:'разбить большую цель на маленькие проверяемые шаги',
});

const MISSION_MEMORY = Object.freeze({
  'lights-out': {glyph:'◈', label:'ШУМ', learned:'сначала чистить вход'},
  surge: {glyph:'▥', label:'НАПЛЫВ', learned:'давать потоку место переждать'},
  'ghost-write': {glyph:'⟲', label:'ПОВТОР', learned:'повторять без двойного эффекта'},
  'poison-context': {glyph:'⌁', label:'ЧУЖИЕ ДАННЫЕ', learned:'данные не получают власть'},
  'mirror-model': {glyph:'◎', label:'НОВАЯ СМЕНА', learned:'проверять не на том, на чём учился'},
  'autonomous-line': {glyph:'◇', label:'ЦЕЛЬ', learned:'планировать внутри ограничений'},
});

export function plainModule(module){ return PLAIN[module] ?? String(module || 'проверить неизвестный узел'); }

export function companionPresentation({missionId, profile={}, session={}, recommendation, mode='guided', metricsVisible=false}={}) {
  const lessons=new Set(profile.labs?.nexus?.companionLessons ?? []);
  const missionMemory=MISSION_MEMORY[missionId] ?? {glyph:'·',label:'НОВАЯ АВАРИЯ',learned:'сравнить последствия'};
  const stats=session[missionId] ?? {good:0,bad:0};
  const knowsMission=[...lessons].some(item=>String(item).startsWith(`${missionId}:`));
  const compact=mode==='compact';
  let state='learning';
  let headline='Я ЕЩЁ УЧУСЬ';
  let line=`Я такого ещё не видел. Думаю: ${plainModule(recommendation?.module)}. Проверишь меня на линии?`;
  if (stats.bad>stats.good) {
    state='drift'; headline='Я СЛИШКОМ УВЕРЕН';
    line=`Я запомнил плохой сигнал и теперь упрямо советую: ${plainModule(recommendation?.module)}. Не верь уверенности — проверь результат.`;
  } else if (recommendation?.correct && (knowsMission || stats.good>0)) {
    state='good'; headline='Я ПОМНЮ ПОХОЖЕЕ';
    line=`Похоже на прошлый урок: ${missionMemory.learned}. Я бы сейчас попробовал ${plainModule(recommendation.module)}.`;
  } else if (knowsMission) {
    state='learning'; headline='Я ВСПОМИНАЮ';
    line=`Я помню принцип «${missionMemory.learned}», но не уверен, как применить его здесь. Моя гипотеза: ${plainModule(recommendation?.module)}.`;
  }
  return {
    state, headline, line,
    memory: missionMemory,
    showMetrics: compact || metricsVisible || lessons.size>=3,
    feedbackGood: compact ? '👍 ПОДКРЕПИТЬ' : '👍 ЭТО ПОМОГЛО',
    feedbackBad: compact ? '👎 ИСПРАВИТЬ' : '🛠 НЕ СРАБОТАЛО',
  };
}

export function companionMemoryRack(profile={}) {
  const done=new Set(profile.labs?.nexus?.completedMissions ?? []);
  return Object.entries(MISSION_MEMORY).map(([id,meta])=>({id,...meta,learned:done.has(id)}));
}

export function buildPhysicalLine({missionId,result={},selectedModules=[]}={}) {
  const selected=new Set(selectedModules);
  const crates=Array.from({length:8},(_,index)=>({id:String.fromCharCode(65+index),status:'ok'}));
  let cursor=crates.length-1;
  for(let i=0;i<Math.min(result.drops||0,crates.length);i++) crates[cursor--].status='drop';
  for(let i=0;i<Math.min(result.duplicates||0,Math.max(0,cursor+1));i++) crates[cursor--].status='duplicate';
  for(let i=0;i<Math.min(result.unsafe||0,Math.max(0,cursor+1));i++) crates[cursor--].status='unsafe';
  if((result.quality??100)<85){
    const misses=Math.min(3,Math.ceil((85-(result.quality??0))/12));
    for(let i=0;i<misses && cursor>=0;i++) crates[cursor--].status='miss';
  }
  const queueCount = selected.has('queue') && missionId==='surge' ? 4 : selected.has('queue') ? 2 : 0;
  const workers = selected.has('batch') ? 2 : 1;
  const danger = crates.some(item=>item.status!=='ok');
  return {
    crates,
    queueCount,
    workers,
    danger,
    label: danger ? 'СМОТРИ, ГДЕ ФИЗИЧЕСКИ ЛОМАЕТСЯ ПОТОК' : 'ПОТОК ПРОШЁЛ ЧИСТО — ТЕПЕРЬ МОЖНО СМОТРЕТЬ КОД',
  };
}

export const NEXUS_REMIXES = Object.freeze({
  'lights-out': {title:'ЧИСТАЯ ЛИНИЯ', copy:'Переживи аварию только базовыми FILTER + ROUTE. Никакой «архитектуры на всякий случай».', check:(r,s)=>r.correct && s.length===2},
  surge: {title:'БЫСТРЫЙ БУФЕР', copy:'Переживи burst и подними throughput до 9/t, не используя больше четырёх узлов.', check:(r,s)=>r.correct && r.throughput>=9 && s.length<=4},
  'ghost-write': {title:'РОВНО ОДИН ЭФФЕКТ', copy:'Ни drops, ни дублей — и не больше четырёх узлов.', check:(r,s)=>r.correct && r.drops===0 && r.duplicates===0 && s.length<=4},
  'poison-context': {title:'ДВОЙНАЯ ПРОВЕРКА', copy:'Останови hostile data и добавь EVAL: найденный контекст должен пройти и authority, и проверку качества.', check:(r,s)=>r.correct && s.includes('eval') && r.unsafe===0},
  'mirror-model': {title:'ЧЕСТНЫЙ ЭКЗАМЕН', copy:'Реши проблему ровно четырьмя узлами: FILTER + ROUTE + MODEL + EVAL.', check:(r,s)=>r.correct && s.length===4 && s.includes('model') && s.includes('eval')},
  'autonomous-line': {title:'МИНИМАЛЬНЫЙ АГЕНТ', copy:'Автономная линия должна пройти без лишних узлов: не больше девяти.', check:(r,s)=>r.correct && s.length<=9},
});

export function evaluateNexusRemix(missionId,result,selectedModules=[]){
  const spec=NEXUS_REMIXES[missionId];
  if(!spec) return {ok:false,title:'',copy:''};
  return {ok:Boolean(spec.check(result,[...selectedModules])),title:spec.title,copy:spec.copy};
}
