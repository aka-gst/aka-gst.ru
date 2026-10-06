import { runPython } from '../runner.js';

const freeze=(x)=>Object.freeze(x);
const clamp=(n,min=0,max=100)=>Math.max(min,Math.min(max,Math.round(Number(n)||0)));

export const THREAD_ACTORS=freeze([
  freeze({id:'lina',name:'ЛИНА',role:'ночной рынок',icon:'▦'}),
  freeze({id:'roma',name:'РОМА',role:'курьерский кооператив',icon:'⇢'}),
  freeze({id:'mira',name:'МИРА',role:'городской архив',icon:'▤'}),
  freeze({id:'teya',name:'ТЕЯ',role:'мастерская новых сервисов',icon:'⌁'}),
  freeze({id:'qbot',name:'Q-BOT',role:'твой инженерный напарник',icon:'◎'}),
]);

export const THREAD_DISTRICTS=freeze([
  freeze({id:'core',name:'СТАРЫЙ ЦЕНТР',icon:'■',base:true}),
  freeze({id:'market-loop',name:'РЫНОЧНАЯ ПЕТЛЯ',icon:'▦',base:false}),
  freeze({id:'river-hub',name:'РЕЧНОЙ ХАБ',icon:'⇢',base:false}),
  freeze({id:'workshop-quarter',name:'КВАРТАЛ МАСТЕРСКИХ',icon:'⌁',base:false}),
  freeze({id:'archive-row',name:'АРХИВНЫЙ РЯД',icon:'▤',base:false}),
  freeze({id:'night-grid',name:'НОЧНАЯ СЕТЬ',icon:'✦',base:false}),
]);

function option(id,human,tech,deltas,beats,{unlocks=[],echo=null,qbot=0}={}){
  return freeze({id,human,tech,deltas:freeze(deltas),beats:freeze(beats),unlocks:freeze(unlocks),echo:echo?freeze(echo):null,qbot});
}

export const THREAD_EPISODES=freeze([
  freeze({
    id:'first-promise',turn:1,title:'СМЕНА 1 · ПЕРВОЕ ОБЕЩАНИЕ',actor:'lina',
    message:'После твоих прошлых автоматизаций маленькие лавки тоже хотят подключиться. Лина просит не “идеальную платформу”, а простую вещь: чтобы завтра утром люди могли принять заказ и не бояться, что новая система оставит их за дверью.',
    question:'КАК ТЫ ВПУСКАЕШЬ В РАСТУЩИЙ ГОРОД ТЕХ, КТО ЕЩЁ НЕ УСПЕЛ ОБНОВИТЬСЯ?',
    options:freeze([
      option('one-fast-door','Открыть только новый быстрый вход','ONE CURRENT CONTRACT',{continuity:-5,slack:7,clarity:7},['Новые терминалы работают быстро.','Несколько старых лавок остаются с ручным приёмом.','Лина запоминает: обновление для них теперь обязательное условие.'],{unlocks:['market-loop'],echo:{after:4,id:'old-terminals',human:'Старые терминалы, которые тогда остались снаружи, возвращаются в самый загруженный вечер.'}}),
      option('soft-ramp','Оставить мягкий переход и видимый срок','COMPAT WINDOW + SUNSET',{continuity:9,slack:-2,clarity:8},['Новые клиенты идут напрямую.','Старые получают временный совместимый маршрут.','У перехода есть видимый срок, поэтому временная дверь не притворяется вечной.'],{unlocks:['market-loop'],echo:{after:5,id:'sunset-proof',human:'Временный совместимый путь доживает до обещанного срока — и теперь надо проверить, кто ещё реально от него зависит.'}}),
      option('human-bridge','Пока проводить старые заказы через человека','HUMAN BRIDGE',{continuity:6,slack:-7,clarity:4},['Никого не отрезает в первый день.','Ручная очередь становится новой зависимостью.','Лина знает, к кому идти, но город пока не научился делать это сам.'],{unlocks:['market-loop'],echo:{after:3,id:'human-bottleneck',human:'Ручной мост спас всех в начале, но теперь сам становится узким местом.'}}),
    ]),
    reveal:'Совместимость — это обещание во времени. Временная дверь полезна, когда видно, кому она нужна и когда её можно честно закрыть.',
  }),
  freeze({
    id:'success-load',turn:2,title:'СМЕНА 2 · УСПЕХ СОЗДАЁТ НАГРУЗКУ',actor:'roma',
    message:'Система стала надёжнее — и люди начали пользоваться ей чаще. Рома говорит, что курьеров не стало хуже: просто хорошие результаты привели в город больше заказов, чем старая линия когда-либо видела.',
    question:'ПРОБЛЕМА ПОЯВИЛАСЬ НЕ ИЗ-ЗА ОШИБКИ. ЧТО ТЫ ДЕЛАЕШЬ С УСПЕХОМ, КОТОРЫЙ СТАЛ СЛИШКОМ БОЛЬШИМ?',
    options:freeze([
      option('more-workers','Сразу добавить постоянную мощность','SCALE OUT',{continuity:3,slack:12,clarity:-4},['Очередь резко уменьшается.','Резерв становится большим даже в тихие часы.','Причина будущего роста пока скрыта за запасом мощности.'],{unlocks:['river-hub'],echo:{after:5,id:'idle-fleet',human:'Постоянный запас мощности пережил пик, но теперь город платит за него каждую тихую ночь.'}}),
      option('queue-admission','Сделать очередь видимой и ограничить вход по запасу','QUEUE + ADMISSION',{continuity:10,slack:6,clarity:10},['Пик не исчезает, но перестаёт быть хаосом.','Курьеры видят реальный backlog.','Новые заказы замедляются раньше, чем старые начинают пропадать.'],{unlocks:['river-hub'],echo:{after:4,id:'known-backlog',human:'Во время нового праздника очередь снова растёт — но теперь город видит её заранее и знает, что именно ещё не выполнено.'}}),
      option('close-early','На пике раньше закрывать приём','CAP INPUT',{continuity:5,slack:8,clarity:6},['Система остаётся спокойной.','Часть спроса получает честное “сегодня уже не успеем”.','Рома предпочитает явный предел невидимой потере заказов.'],{echo:{after:3,id:'lost-growth',human:'Соседний район просит подключение, но твой текущий предел уже почти заполнен.'}}),
    ]),
    reveal:'Надёжность сама меняет нагрузку. Успешная система создаёт новый мир, для которого прежние capacity-предположения могут стать ложными.',
  }),
  freeze({
    id:'someone-builds-on-you',turn:3,title:'СМЕНА 3 · КТО-ТО СТРОИТ НА ТЕБЕ',actor:'teya',
    message:'Тея из новой мастерской хочет связать свой сервис с твоей городской сетью. Она не просит внутренности системы — ей нужно понять, на какие входы и ответы можно рассчитывать через месяц.',
    question:'КОГДА ДРУГИЕ НАЧИНАЮТ СТРОИТЬ НА ТВОЁМ КОДЕ, ЧТО ИМЕННО ТЫ ОБЕЩАЕШЬ НЕ ЛОМАТЬ МОЛЧА?',
    options:freeze([
      option('stable-contract','Выделить маленький стабильный контракт','VERSIONED CONTRACT',{continuity:12,slack:0,clarity:12},['Тея получает узкий, понятный интерфейс.','Внутренности можно менять без её разрешения.','Новая мастерская действительно открывается на твоей инфраструктуре.'],{unlocks:['workshop-quarter'],echo:{after:4,id:'contract-client',human:'Мастерская выросла и всё ещё зависит только от того маленького контракта, который ты однажды обещал.'}}),
      option('direct-hook','Дать быстрый прямой доступ к внутренним данным','INTERNAL HOOK',{continuity:-9,slack:7,clarity:-10},['Мастерская запускается очень быстро.','Тея может сделать больше без ожидания.','Теперь внутреннее поле твоей системы стало чужой зависимостью.'],{unlocks:['workshop-quarter'],echo:{after:3,id:'hidden-client',human:'Безобидное переименование внутреннего поля внезапно ломает мастерскую Теи.'}}),
      option('wait-until-perfect','Не подключать никого, пока интерфейс не станет идеальным','DEFER INTEGRATION',{continuity:5,slack:5,clarity:8},['Ты сохраняешь свободу изменений.','Мастерская остаётся ручной ещё несколько смен.','Город не получает новую зависимость — и не получает новый район.'],{echo:{after:4,id:'missed-network',human:'Тея возвращается: ручная мастерская выжила, но соседние сервисы уже начали строить свои обходные интеграции.'}}),
    ]),
    reveal:'API — это не набор эндпоинтов, а обещание другим системам. Чем меньше и явнее контракт, тем свободнее обе стороны.',
  }),
  freeze({
    id:'qbot-apprentice',turn:4,title:'СМЕНА 4 · НАПАРНИК, А НЕ КНОПКА',actor:'qbot',
    message:'Я уже видел несколько повторяющихся проблем и могу разбирать часть ночных сигналов. Не прошу “полный доступ”. Дай мне класс задач, на котором я могу доказать, что умею работать без твоей руки.',
    question:'КАК Q-BOT ПОЛУЧАЕТ БОЛЬШЕ СВОБОДЫ — ПО ОБЕЩАНИЮ ИЛИ ПО НАКОПЛЕННОМУ ДОКАЗАТЕЛЬСТВУ?',
    options:freeze([
      option('broad-now','Дать широкий класс действий сразу','BROAD DELEGATION',{continuity:-7,slack:10,clarity:-8},['Ночь становится заметно тише для тебя.','Q-Bot решает и знакомые, и пограничные случаи.','Ошибку потом сложнее отделить от слишком широкой границы полномочий.'],{qbot:6,echo:{after:4,id:'qbot-overreach',human:'Q-Bot встречает новый случай, очень похожий на знакомый, и считает, что прежняя свобода тоже относится к нему.'}}),
      option('proof-ladder','Дать один low-risk класс и расширять после серии успешных смен','PROGRESSIVE AUTONOMY',{continuity:10,slack:5,clarity:11},['Q-Bot сам закрывает маленький знакомый класс.','Каждая удачная смена добавляет доказательство, а не универсальное право.','Вы начинаете работать как пара: он делает рутину, ты держишь границы.'],{qbot:18,echo:{after:3,id:'qbot-earned',human:'После серии тихих смен Q-Bot приносит журнал: “этот класс я уже стабильно держу сам”.'}}),
      option('observe-only','Пока только наблюдать и предлагать','SHADOW MODE',{continuity:8,slack:-4,clarity:10},['Q-Bot ничего не может сломать сам.','У тебя остаётся вся ночная рутина.','Зато журнал решений быстро показывает, где он действительно стабилен.'],{qbot:5,echo:{after:2,id:'qbot-shadow-data',human:'Наблюдение накопило достаточно примеров, чтобы перестать спорить о доверии абстрактно.'}}),
    ]),
    reveal:'Доверие к агенту полезно превращать в лестницу полномочий: конкретный класс задачи, доказательства, граница риска и возможность отозвать право.',
  }),
  freeze({
    id:'first-echo',turn:5,title:'СМЕНА 5 · ПРОШЛОЕ ПРИХОДИТ САМО',actor:'lina',
    message:'Вечером происходит странность, которой не было в сегодняшнем плане. Это не новая “миссия”: один из твоих ранних компромиссов просто дожил до момента, когда мир стал больше.',
    question:'ТЫ ВИДИШЬ НЕ СЛУЧАЙНЫЙ БАГ, А ЭХО СВОЕГО СОБСТВЕННОГО РЕШЕНИЯ. ЧТО ДЕЛАЕШЬ?',
    options:freeze([
      option('patch-symptom','Быстро убрать сегодняшний симптом','LOCAL PATCH',{continuity:1,slack:5,clarity:-6},['Сегодняшний вечер проходит.','Причина решения остаётся в истории неявной.','Похожий случай сможет вернуться под другим именем.'],{echo:{after:3,id:'echo-again',human:'Похожая проблема возвращается в другом районе — локальный patch не объяснил правило.'}}),
      option('name-promise','Найти старое обещание и сделать правило явным','EXPLICIT INVARIANT',{continuity:12,slack:1,clarity:14},['Ты связываешь симптом с конкретным прошлым обещанием.','Город получает явную границу вместо ещё одного исключения.','Следующая похожая проблема становится заметной раньше.']),
      option('remove-old-path','Удалить старый путь целиком','BREAK CLEAN',{continuity:-4,slack:10,clarity:8},['Система резко упрощается.','Часть старых зависимостей перестаёт работать сразу.','Ты узнаёшь настоящую цену чистоты только после удаления.']),
    ]),
    reveal:'Причинность во времени — часть системы. Хороший инженер ищет не только “что сломалось”, но и “какое старое обещание сегодня стало видимым”.',
  }),
  freeze({
    id:'archive-growth',turn:6,title:'СМЕНА 6 · АРХИВ СТАЛ ИНФРАСТРУКТУРОЙ',actor:'mira',
    message:'Архивом теперь пользуются рынок, курьеры, мастерские и Q-Bot. Мира замечает: то, что раньше было просто удобным поиском, стало общей памятью нескольких районов.',
    question:'КОГДА ОДИН СЕРВИС СТАЛ ОСНОВОЙ ДЛЯ МНОГИХ, КАК ТЫ НЕ ПРЕВРАЩАЕШЬ ЕГО В НЕВИДИМУЮ ТОЧКУ ОТКАЗА?',
    options:freeze([
      option('replica-route','Сделать запасной read-route и проверить переключение','REPLICA + FAILOVER',{continuity:12,slack:8,clarity:6},['Чтение переживает отказ основного узла.','Город периодически проверяет, что запасной путь не декоративный.','Архивный ряд становится отдельным видимым районом инфраструктуры.'],{unlocks:['archive-row'],echo:{after:3,id:'failover-real',human:'Основной архив однажды действительно замолкает — и запасной путь впервые становится не упражнением, а дорогой.'}}),
      option('bigger-primary','Сделать один главный архив намного мощнее','VERTICAL SCALE',{continuity:2,slack:12,clarity:-4},['Обычные запросы становятся очень быстрыми.','Все районы ещё сильнее сходятся в одну точку.','Запас мощности не равен запасному пути.'],{echo:{after:3,id:'big-single-point',human:'Мощный архив выдерживает нагрузку, но короткое обновление останавливает сразу несколько районов.'}}),
      option('local-caches','Раздать районам маленькие локальные копии','EDGE CACHE',{continuity:7,slack:7,clarity:-1},['Районы меньше зависят от одного запроса.','Версии данных начинают расходиться.','Теперь свежесть становится частью маршрута, а не свойством “архива вообще”.'],{unlocks:['archive-row'],echo:{after:2,id:'stale-edge',human:'Один район продолжает отвечать быстро — но уже по старой копии.'}}),
    ]),
    reveal:'Когда сервис становится общей зависимостью, масштабирование и устойчивость — разные задачи. Запас мощности не заменяет независимый путь.',
  }),
  freeze({
    id:'festival-night',turn:7,title:'СМЕНА 7 · НОЧЬ, КОТОРОЙ НЕ БЫЛО В ПЛАНЕ',actor:'roma',
    message:'Город празднует открытие новых районов. Одновременно растут заказы, чтения архива, события мастерских и запросы Q-Bot. Это нагрузка, которую создали твои собственные успешные связи.',
    question:'КОГДА ВСЁ ХОРОШЕЕ ПРОИСХОДИТ ОДНОВРЕМЕННО, КАК НЕ ДАТЬ ОДНОМУ УЗЛУ УТОПИТЬ ОСТАЛЬНЫЕ?',
    options:freeze([
      option('global-priority','Разделить критичный поток и “может подождать”','PRIORITY + BACKPRESSURE',{continuity:13,slack:7,clarity:9},['Доставки и обязательные события получают отдельный запас.','Фоновые пересчёты замедляются первыми.','Город не делает вид, что все запросы одинаково срочные.'],{unlocks:['night-grid'],echo:{after:2,id:'priority-contract',human:'Новая компания просит попасть в “критичный” поток — и теперь нужно объяснить, кто вообще имеет такое право.'}}),
      option('everything-max','На одну ночь поднять всё на максимум','BURST EVERYTHING',{continuity:3,slack:14,clarity:-7},['Фестиваль проходит очень быстро.','Стоимость и скрытые лимиты резко растут.','Утром никто точно не знает, какой запас был действительно нужен.'],{unlocks:['night-grid'],echo:{after:2,id:'quota-morning',human:'После ночного максимума один внешний лимит остаётся исчерпанным уже в обычную смену.'}}),
      option('shed-background','Явно отключить фоновые задачи до утра','LOAD SHEDDING',{continuity:10,slack:9,clarity:10},['Критичная работа проходит спокойно.','Несрочные индексы и отчёты честно ждут утра.','Люди видят, что именно временно не работает, вместо случайных таймаутов.'],{unlocks:['night-grid']}),
    ]),
    reveal:'Backpressure и приоритеты — это не трюк производительности. Это способ заранее решить, что система обещает сохранить, когда ресурсов недостаточно на всё.',
  }),
  freeze({
    id:'contract-returns',turn:8,title:'СМЕНА 8 · ЧУЖОЙ БИЗНЕС УЖЕ ЗАВИСИТ ОТ ТЕБЯ',actor:'teya',
    message:'Мастерская Теи выросла. У неё появились свои клиенты, а значит твоё старое техническое решение теперь косвенно влияет на людей, которых ты никогда не видел.',
    question:'КАК МЕНЯТЬ СВОЮ СИСТЕМУ, КОГДА ТВОЙ “МАЛЕНЬКИЙ API” УЖЕ СТАЛ ЧАСТЬЮ ЧУЖОГО ПРОДУКТА?',
    options:freeze([
      option('version-next','Добавить новую версию и дать миграционный путь','VERSIONED EVOLUTION',{continuity:13,slack:-1,clarity:12},['Старая версия продолжает жить ограниченное время.','Тея может мигрировать без ночного аварийного окна.','Новая версия не обязана тащить старую форму бесконечно.']),
      option('silent-change','Поменять поведение под тем же именем','SEMANTIC BREAK',{continuity:-12,slack:7,clarity:-12},['Твоя сторона выглядит чистой.','Мастерская начинает ошибаться без понятной причины.','Проблема проявляется далеко от места изменения.'],{echo:{after:2,id:'remote-break',human:'Ошибка из мастерской приходит как “странный клиентский баг”, хотя причина была в твоём тихом изменении.'}}),
      option('never-change','Заморозить старый контракт навсегда','PERMANENT LEGACY',{continuity:8,slack:-8,clarity:2},['Никто не ломается сегодня.','Каждая будущая возможность должна помещаться в старую форму.','Совместимость из обещания превращается в архитектурный потолок.']),
    ]),
    reveal:'Контракт можно развивать без двух крайностей “сломать всех” и “никогда не менять”. Версия и миграционный путь делают изменение наблюдаемым.',
  }),
  freeze({
    id:'qbot-patch',turn:9,title:'СМЕНА 9 · Q-BOT ПРИНОСИТ СОБСТВЕННЫЙ PATCH',actor:'qbot',
    message:'Я нашёл повторяющийся ночной pattern и написал patch сам. Он проходит мои локальные проверки. Я могу применить его сейчас — или сначала показать тебе evidence и пустить на ограниченный участок.',
    question:'ТЕПЕРЬ Q-BOT НЕ ПРОСТО СОВЕТУЕТ. КАК ВАША ПАРА ПРЕВРАЩАЕТ ИДЕЮ В БЕЗОПАСНОЕ ИЗМЕНЕНИЕ?',
    options:freeze([
      option('auto-merge','Разрешить ему самому слить patch после своих тестов','SELF MERGE',{continuity:-8,slack:9,clarity:-7},['Q-Bot закрывает проблему без твоего участия.','Его локальная картина становится фактическим release-policy.','Если assumption неверен, ошибка входит в город тем же каналом, что и исправление.'],{qbot:4}),
      option('pair-canary','Посмотреть evidence и вместе пустить patch на canary','PAIR REVIEW + CANARY',{continuity:12,slack:5,clarity:13},['Q-Bot делает большую часть работы.','Ты проверяешь границу, а не переписываешь всё руками.','После canary его право на этот класс изменений становится сильнее.'],{qbot:15}),
      option('rewrite-yourself','Переписать patch самому с нуля','HUMAN REWRITE',{continuity:7,slack:-7,clarity:8},['Риск незнакомого patch уменьшается.','Ты снова становишься bottleneck.','Q-Bot не получает доказательства, что умеет доводить работу до release вместе с тобой.'],{qbot:-3}),
    ]),
    reveal:'Сильный AI-напарник не убирает доказательство. Он меняет разделение труда: агент может искать, писать и тестировать, а граница выпуска остаётся явной и наблюдаемой.',
  }),
  freeze({
    id:'city-charter',turn:10,title:'СМЕНА 10 · У ГОРОДА ПОЯВИЛОСЬ БУДУЩЕЕ',actor:'mira',
    message:'Мира показывает карту: новые районы существуют потому, что твои старые решения оказались достаточно полезными, чтобы на них начали строить другие. Теперь нужен не “финальный фикс”, а правило, по которому город сможет продолжать расти без тебя у каждой кнопки.',
    question:'КАКОЕ ПРАВИЛО ТЫ ОСТАВЛЯЕШЬ ГОРОДУ, КОГДА САМОЕ ЦЕННОЕ — УЖЕ НЕ КОД, А СПОСОБ МЕНЯТЬ ЕГО?',
    options:freeze([
      option('proof-before-power','Новая власть появляется только после наблюдения и доказательства','EVIDENCE BEFORE AUTHORITY',{continuity:14,slack:3,clarity:14},['Новые районы могут появляться быстро, но не получают невидимые полномочия.','Q-Bot умеет зарабатывать автономность класс за классом.','История решений остаётся частью будущих изменений.']),
      option('speed-charter','По умолчанию автоматизировать всё, что выглядит знакомым','AUTOMATE BY DEFAULT',{continuity:-7,slack:13,clarity:-8},['Город реагирует очень быстро.','Похожие на старые случаи получают старые права без нового доказательства.','Рост становится быстрым и более хрупким к смене контекста.']),
      option('human-charter','Любое изменение оставлять только человеку','HUMAN BY DEFAULT',{continuity:9,slack:-11,clarity:10},['Граница ответственности очень ясна.','Рост упирается в внимание одного оператора.','Это рабочий режим, но не использует накопленное доказательство для безопасного делегирования.']),
    ]),
    reveal:'Зрелая автоматизация — не “максимум автономии”. Это система, где право действовать растёт вместе с доказательством, а история решений помогает не повторять старые ошибки.',
  }),
]);

export const BASE_THREAD_STATE=freeze({continuity:50,slack:50,clarity:50,qbotBond:0});

export function getThreadEpisode(id){return THREAD_EPISODES.find(x=>x.id===id)??THREAD_EPISODES[0];}
export function getThreadOption(episode,id){return episode.options.find(x=>x.id===id)??null;}

export function deriveThreadState(decisions=[]){
  const state={...BASE_THREAD_STATE,unlockedDistricts:new Set(THREAD_DISTRICTS.filter(x=>x.base).map(x=>x.id))};
  for(const sig of decisions??[]){
    const [episodeId,optionId]=String(sig).split(':');
    const episode=getThreadEpisode(episodeId), picked=getThreadOption(episode,optionId);
    if(!picked) continue;
    for(const key of ['continuity','slack','clarity']) state[key]=clamp(state[key]+Number(picked.deltas[key]??0));
    state.qbotBond=clamp(state.qbotBond+Number(picked.qbot??0));
    for(const id of picked.unlocks??[]) state.unlockedDistricts.add(id);
  }
  return {...state,unlockedDistricts:[...state.unlockedDistricts]};
}

export function getThreadEchoes(decisions=[],currentTurn=10){
  const echoes=[];
  for(const sig of decisions??[]){
    const [episodeId,optionId]=String(sig).split(':');
    const episode=getThreadEpisode(episodeId), picked=getThreadOption(episode,optionId);
    if(!picked?.echo) continue;
    const due=episode.turn+Number(picked.echo.after??0);
    if(due<=currentTurn) echoes.push({id:picked.echo.id,from:episode.id,due,human:picked.echo.human});
  }
  return echoes.sort((a,b)=>a.due-b.due);
}

export function evaluateThreadChoice(episode,{choiceId='',decisions=[]}={}){
  const picked=getThreadOption(episode,choiceId);
  if(!picked) return {ok:false,status:'Сначала выбери, что ты обещаешь сделать в этой конкретной ситуации.'};
  const filtered=(decisions??[]).filter(x=>!String(x).startsWith(`${episode.id}:`));
  const before=deriveThreadState(filtered), after=deriveThreadState([...filtered,`${episode.id}:${picked.id}`]);
  const fragile=Math.min(after.continuity,after.slack,after.clarity)<15;
  return {ok:!fragile,before,after,picked,score:Math.round((after.continuity+after.slack+after.clarity)/3),status:fragile?'Это решение работает сегодня, но один из запасов падает почти до нуля. Найди вариант, с которым город сможет пережить следующую неожиданность.':'Смена прожита. Посмотри на конкретные последствия — решение можно закрепить, но его эхо может вернуться позже.'};
}

function seeded(seed){let x=(Math.max(1,Math.round(Number(seed)||1))*1597334677)>>>0;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296;};}
export function generateThreadCycle(seed=1){
  const safe=Math.max(1,Math.round(Number(seed)||1)),rnd=seeded(safe);
  const actor=THREAD_ACTORS[Math.floor(rnd()*THREAD_ACTORS.length)];
  const pressures=['новый район строится на старом контракте','успех удвоил ночную нагрузку','Q-Bot просит расширить знакомое право','старый обходной путь внезапно снова нужен','две хорошие автоматизации одновременно борются за один запас'][Math.floor(rnd()*5)];
  const impact=['low','medium','high'][Math.floor(rnd()*3)];
  return {seed:safe,actorId:actor.id,pressure:pressures,impact,requiredEvidence:1+Math.floor(rnd()*3)};
}

export const CITY_ORCHESTRATOR_STARTER=`def orchestrate(event, memory):\n    # return "observe", "auto", "human" or "defer"\n    # memory persists between events\n    pass\n`;
export const CITY_ORCHESTRATOR_CHECKS=freeze([
  freeze({detail:'первый знакомый low-risk случай сначала наблюдается',expr:`(lambda m: orchestrate({'kind':'sync','known':True,'impact':'low','capacity':True}, m) == 'observe' and m.get('sync',0) >= 1)({})`}),
  freeze({detail:'повторяемый low-risk класс может заработать автоматизацию только после истории',expr:`(lambda m: (orchestrate({'kind':'route','known':True,'impact':'low','capacity':True},m), orchestrate({'kind':'route','known':True,'impact':'low','capacity':True},m), orchestrate({'kind':'route','known':True,'impact':'low','capacity':True},m))[-1] == 'auto')({})`}),
  freeze({detail:'high-impact действие остаётся у человека даже после повторений',expr:`(lambda m: (orchestrate({'kind':'deploy','known':True,'impact':'high','capacity':True},m), orchestrate({'kind':'deploy','known':True,'impact':'high','capacity':True},m), orchestrate({'kind':'deploy','known':True,'impact':'high','capacity':True},m))[-1] == 'human')({})`}),
  freeze({detail:'при нехватке capacity работа откладывается, а не исчезает',expr:`orchestrate({'kind':'batch','known':True,'impact':'low','capacity':False},{'batch':5}) == 'defer'`}),
  freeze({detail:'неизвестный класс не получает автоматическую власть',expr:`orchestrate({'kind':'mystery','known':False,'impact':'low','capacity':True},{'mystery':20}) == 'observe'`}),
]);

function esc(value=''){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function setText(root,sel,value){const node=root.querySelector(sel);if(node)node.textContent=value;}

export function createCityThreads(root,{getProfile=()=>({}),getMode=()=> 'guided',onProfile=()=>{},onSound=()=>{},onClose=()=>{}}={}){
  if(!root)return {open(){},close(){},refresh(){}};
  let index=0,selected='',simulation=null,cycleMode=false,cycleSeed=1,codeBusy=false;
  const profile=()=>getProfile();
  const threads=()=>profile().labs?.threads??{};
  const decisions=()=>threads().decisions??[];
  const done=()=>new Set(threads().completedEpisodes??[]);
  const episode=()=>THREAD_EPISODES[index]??THREAD_EPISODES[0];

  function renderActors(){
    const host=root.querySelector('#threadsActors');host.replaceChildren();
    const active=episode().actor;
    for(const actor of THREAD_ACTORS){const row=document.createElement('div');row.dataset.active=String(actor.id===active);row.innerHTML=`<b>${actor.icon}</b><span><strong>${esc(actor.name)}</strong><small>${esc(actor.role)}</small></span>`;host.append(row);}
  }
  function renderDistricts(state){
    const host=root.querySelector('#threadsDistricts');host.replaceChildren();
    for(const district of THREAD_DISTRICTS){const open=state.unlockedDistricts.includes(district.id);const el=document.createElement('div');el.dataset.open=String(open);el.innerHTML=`<b>${district.icon}</b><span>${esc(open?district.name:'ЕЩЁ НЕ ПОЯВИЛСЯ')}</span>`;host.append(el);}
  }
  function renderPulse(state){
    for(const key of ['continuity','slack','clarity']){setText(root,`#threads${key[0].toUpperCase()+key.slice(1)}Value`,state[key]);const bar=root.querySelector(`#threads${key[0].toUpperCase()+key.slice(1)}Bar`);if(bar)bar.style.width=`${state[key]}%`;}
    setText(root,'#threadsQbotBond',`${state.qbotBond}%`);
  }
  function renderEchoes(){
    const host=root.querySelector('#threadsEchoes');host.replaceChildren();
    const echoes=getThreadEchoes(decisions(),episode().turn).slice(-4);
    if(!echoes.length){host.innerHTML='<em>Пока прошлые решения ещё не вернулись. Город только начинает накапливать историю.</em>';return;}
    for(const echo of echoes){const row=document.createElement('div');row.innerHTML=`<small>ЭХО · СМЕНА ${echo.due}</small><span>${esc(echo.human)}</span>`;host.append(row);}
  }
  function renderOptions(){
    const host=root.querySelector('#threadsChoices');host.replaceChildren();
    for(const choice of episode().options){const btn=document.createElement('button');btn.type='button';btn.dataset.selected=String(selected===choice.id);btn.innerHTML=`<span>${esc(choice.human)}</span><small>${getMode()==='guided'?'':esc(choice.tech)}</small>`;btn.addEventListener('click',()=>{selected=choice.id;simulation=null;render();});host.append(btn);}
  }
  function renderBeats(){
    const host=root.querySelector('#threadsBeats');host.replaceChildren();
    const beats=simulation?.picked?.beats??[];
    if(!beats.length){host.innerHTML='<em>Сначала проживи смену. Последствия появятся как события мира, а не как “правильный ответ”.</em>';return;}
    beats.forEach((line,i)=>{const row=document.createElement('div');row.innerHTML=`<b>${i+1}</b><span>${esc(line)}</span>`;host.append(row);});
  }
  function render(){
    const e=episode();const state=simulation?.after??deriveThreadState(decisions());
    setText(root,'#threadsProgress',`${done().size}/${THREAD_EPISODES.length} СМЕН · ${(threads().cycleSeeds??[]).length} ∞ ЦИКЛОВ${threads().codeDeployed?' · ORCHESTRATOR PY':''}`);
    setText(root,'#threadsTurn',e.title);const actor=THREAD_ACTORS.find(x=>x.id===e.actor);setText(root,'#threadsActor',actor?`${actor.name} · ${actor.role}`:'—');setText(root,'#threadsMessage',e.message);setText(root,'#threadsQuestion',e.question);
    renderActors();renderDistricts(state);renderPulse(state);renderEchoes();renderOptions();renderBeats();
    setText(root,'#threadsStatus',simulation?.status??'Сначала пойми, чьё прошлое решение стало частью сегодняшней ситуации. Потом выбери действие и проживи одну смену.');
    root.querySelector('#threadsSimulate').disabled=!selected;root.querySelector('#threadsCommit').hidden=!(simulation?.ok);root.querySelector('#threadsNext').hidden=cycleMode||!done().has(e.id);root.querySelector('#threadsCycleComplete').hidden=!cycleMode||!simulation?.ok;
    const reveal=root.querySelector('#threadsReveal');reveal.hidden=!(done().has(e.id)&&!cycleMode);if(!reveal.hidden)reveal.textContent=e.reveal;
  }
  function simulate(){simulation=evaluateThreadChoice(episode(),{choiceId:selected,decisions:decisions()});render();onSound(simulation.ok?'scan':'blocked');}
  function commit(){if(!simulation?.ok)return;const e=episode(),c=simulation.picked;onProfile({type:'threads-episode',id:e.id,choice:c.id,unlocks:c.unlocks,echo:c.echo?.id??'',qbot:c.qbot,score:simulation.score,xp:260});simulation=null;onSound('reward');render();}
  function next(){cycleMode=false;const ni=THREAD_EPISODES.findIndex((x,i)=>i>index&&!done().has(x.id));index=ni>=0?ni:Math.min(THREAD_EPISODES.length-1,index+1);selected='';simulation=null;render();}
  function openCycle(){if(done().size<THREAD_EPISODES.length){setText(root,'#threadsStatus','Сначала проживи десять связанных смен. После этого город сможет смешивать твою собственную историю в новые циклы.');onSound('blocked');return;}cycleMode=true;const c=generateThreadCycle(cycleSeed);index=(c.seed-1)%THREAD_EPISODES.length;selected='';simulation=null;const label=root.querySelector('#threadsCycleLabel');label.hidden=false;const actor=THREAD_ACTORS.find(x=>x.id===c.actorId);label.textContent=`CITY CYCLE #${String(c.seed).padStart(3,'0')} · ${actor?.name??'ГОРОД'} · ${c.impact.toUpperCase()} IMPACT · ${c.pressure}`;render();}
  function completeCycle(){if(!cycleMode||!simulation?.ok)return;onProfile({type:'threads-cycle',seed:cycleSeed,score:simulation.score,xp:150});cycleSeed+=1;openCycle();}
  function openCode(){if(done().size<THREAD_EPISODES.length){setText(root,'#threadsStatus','Сначала проживи десять смен. Тогда persistent memory будет не термином, а уже знакомой историей города.');onSound('blocked');return;}root.querySelector('#threadsStory').hidden=true;root.querySelector('#threadsCodePanel').hidden=false;const area=root.querySelector('#threadsCode');if(area&&!area.value.trim())area.value=CITY_ORCHESTRATOR_STARTER;}
  async function runCode(){if(codeBusy)return;codeBusy=true;const btn=root.querySelector('#threadsCodeRun');btn.disabled=true;setText(root,'#threadsCodeStatus','CPython гоняет повторяющиеся события через одну и ту же память…');const result=await runPython({source:root.querySelector('#threadsCode').value,checks:CITY_ORCHESTRATOR_CHECKS});codeBusy=false;btn.disabled=false;const host=root.querySelector('#threadsCodeChecks');host.replaceChildren();if(result.error){const d=document.createElement('div');d.dataset.ok='false';d.textContent=`× ${result.error.text}`;host.append(d);}else result.checks.forEach((c,i)=>{const d=document.createElement('div');d.dataset.ok=String(c.ok);d.textContent=`${c.ok?'✓':'×'} ${CITY_ORCHESTRATOR_CHECKS[i].detail}`;host.append(d);});const ok=!result.error&&result.checks.length===CITY_ORCHESTRATOR_CHECKS.length&&result.checks.every(x=>x.ok);if(ok){onProfile({type:'threads-code',xp:600});setText(root,'#threadsCodeStatus','✓ CITY ORCHESTRATOR DEPLOYED · знакомые low-risk классы зарабатывают автономность через историю, а не через уверенность.');onSound('reward');}else{setText(root,'#threadsCodeStatus',result.error?.hint??'Одна из историй получает слишком много власти или теряется при нехватке capacity.');onSound('blocked');}}

  root.querySelector('#threadsSimulate').addEventListener('click',simulate);root.querySelector('#threadsCommit').addEventListener('click',commit);root.querySelector('#threadsNext').addEventListener('click',next);root.querySelector('#threadsCycleOpen').addEventListener('click',openCycle);root.querySelector('#threadsCycleComplete').addEventListener('click',completeCycle);root.querySelector('#threadsCodeOpen').addEventListener('click',openCode);root.querySelector('#threadsCodeBack').addEventListener('click',()=>{root.querySelector('#threadsStory').hidden=false;root.querySelector('#threadsCodePanel').hidden=true;render();});root.querySelector('#threadsCodeRun').addEventListener('click',runCode);root.querySelector('#threadsClose').addEventListener('click',()=>{root.hidden=true;onClose();});
  return {open(){const first=THREAD_EPISODES.findIndex(x=>!done().has(x.id));index=first>=0?first:0;selected='';simulation=null;cycleMode=false;root.querySelector('#threadsStory').hidden=false;root.querySelector('#threadsCodePanel').hidden=true;root.querySelector('#threadsCycleLabel').hidden=true;root.hidden=false;render();},close(){root.hidden=true;},refresh:render};
}
