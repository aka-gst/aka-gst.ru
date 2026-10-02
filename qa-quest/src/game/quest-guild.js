const freeze = value => Object.freeze(value);
const clamp = (value, min = 0, max = 999999) => Math.max(min, Math.min(max, Number(value) || 0));

export const GUILD_SKILLS = freeze([
  freeze({ id:'automation', glyph:'⟲', short:'AUTO', name:'АВТОМАТИЗАТОР', fantasy:'Заставляешь рутину работать без рук.', real:'scripts · workflows · queues · integrations' }),
  freeze({ id:'ai', glyph:'◇', short:'AI', name:'AI-МЕХАНИК', fantasy:'Учишь Q-Bot отвечать, искать и действовать по правилам.', real:'LLM · RAG · evals · agents' }),
  freeze({ id:'systems', glyph:'⌬', short:'SYS', name:'СИСТЕМЩИК', fantasy:'Видишь цепочку целиком и находишь, где она реально рвётся.', real:'reliability · APIs · observability · architecture' }),
  freeze({ id:'security', glyph:'⬡', short:'SEC', name:'ЗАЩИТНИК', fantasy:'Ищешь слабую границу раньше, чем она станет чужой дверью.', real:'threat modeling · auth · hardening · safe testing' }),
  freeze({ id:'vehicle', glyph:'▰', short:'VEH', name:'МАШИННЫЙ ШЕПТУН', fantasy:'Разбираешься, почему железо слушает сигнал — и кому оно вообще должно доверять.', real:'embedded · vehicle networks · firmware · diagnostics' }),
  freeze({ id:'web', glyph:'▦', short:'WEB', name:'СТРОИТЕЛЬ', fantasy:'Делаешь сайты, сервисы и полезные инструменты, за которые платят.', real:'web · APIs · backend · client/server contracts' }),
  freeze({ id:'lowlevel', glyph:'01', short:'LOW', name:'НИЗКИЙ УРОВЕНЬ', fantasy:'Спускаешься туда, где уже нет красивых кнопок — только байты, память и состояние.', real:'binary state · assembly thinking · firmware · parsers' }),
]);

export const GUILD_LEVELS = freeze([
  freeze({ level:0, min:0, name:'НЕ ПРОБОВАЛ' }),
  freeze({ level:1, min:2, name:'ПРАКТИК' }),
  freeze({ level:2, min:5, name:'СПЕЦ' }),
  freeze({ level:3, min:9, name:'МАСТЕР' }),
  freeze({ level:4, min:14, name:'ЛЕГЕНДА' }),
]);

const skill = id => GUILD_SKILLS.find(item => item.id === id);

function approach(id, human, tech, skills, beats, { note='', risk='low' } = {}) {
  return freeze({ id, human, tech, skills:freeze({...skills}), beats:freeze(beats), note, risk });
}

function quest({id,kind='story',title,hook,client,brief,skills,approaches,requires={},payout=180,xp=220,inspiration=null,art='grid'}) {
  return freeze({id,kind,title,hook,client,brief,skills:freeze(skills),approaches:freeze(approaches),requires:freeze(requires),payout,xp,inspiration:inspiration?freeze(inspiration):null,art});
}

export const GUILD_QUESTS = freeze([
  quest({
    id:'garage-owned-rig', kind:'starter', title:'НОЧЬ В БОКСЕ · СВОЙ СТЕНД', client:'ТВОЙ ГАРАЖ', art:'garage',
    hook:'Машина твоя. Но после обновления один блок считает, что право на функцию всё ещё принадлежит кому-то снаружи.',
    brief:'На учебном стенде есть синтетическая машина: владелец, сервисный канал и несколько функций. Сначала пойми, кто кому доверяет. Потом верни владельцу контроль и проверь защиту на симуляторе похитителя. Никаких реальных автомобилей и реальных CAN-команд.',
    skills:['vehicle','security','systems'], payout:220, xp:260,
    approaches:[
      approach('owner-boundary','Сначала нарисовать: кто вообще имеет право отдавать эту команду','TRUST BOUNDARY',{vehicle:2,security:2},['Ты отделяешь владельца от сервисного канала.','Симулятор внешней команды перестаёт проходить.','Своя диагностика остаётся рабочей.'],{risk:'low'}),
      approach('signed-control','Сделать команду действительной только внутри своего стенда','SIGNED LOCAL COMMAND',{security:2,vehicle:2,lowlevel:1},['Каждая команда получает проверяемый источник.','Повтор чужого пакета не даёт новую власть.','Функция снова принадлежит владельцу стенда.'],{risk:'medium'}),
      approach('replay-lab','Записать нормальные сигналы и построить безопасный replay-тест','REPLAY HARNESS',{automation:2,vehicle:2,systems:1},['Стенд учится воспроизводить нормальную поездку.','Пограничные сигналы можно гонять без реальной машины.','Защита становится проверяемой после каждого изменения.'],{risk:'low'}),
    ],
    inspiration:{year:2023,label:'Kia/Hyundai anti-theft campaign + автомобильные security-исследования',summary:'Миллионы машин получили противоугонное ПО после волны краж; отдельные automotive contests показывают, что модемы, infotainment и зарядки реально являются программными системами.',lesson:'Автомобиль — это сеть контроллеров и политик доверия. В квесте оставлена только безопасная симуляция собственного стенда.'},
  }),
  quest({
    id:'practice-server', kind:'starter', title:'СВОЙ СЕРВЕР · СНАЧАЛА ПОСТРОЙ, ПОТОМ ЛОМАЙ', client:'ТРЕНИРОВОЧНАЯ АРЕНА', art:'ice',
    hook:'Турнирный сервер работает. Теперь хозяин просит доказать не то, что “свои входят”, а то, что чужая роль не пролезает через забытое условие.',
    brief:'Это полностью синтетический сервер QueQuest. Ты строишь правило доступа, затем запускаешь красную команду-симулятор против собственного правила и обязан оставить сервер рабочим для легитимного игрока.',
    skills:['security','systems','web'], payout:210, xp:250,
    approaches:[
      approach('deny-by-default','Сначала закрыть всё, потом явно открыть нужное','DENY BY DEFAULT',{security:2,systems:1},['Случайные роли перестают получать доступ.','Легитимный маршрут приходится описать явно.','Красная команда не проходит, а свой игрок остаётся внутри.']),
      approach('server-verdict','Перенести окончательное решение на сервер','SERVER-SIDE AUTHORITY',{web:2,security:2},['Клиент больше не может сам объявить себя победителем.','Сервер проверяет состояние перед изменением.','Логи показывают отклонённые попытки без раскрытия секретов.']),
      approach('negative-suite','Сначала написать набор “так не должно работать”','NEGATIVE TESTS',{systems:2,automation:1,security:2},['Плохие сценарии становятся повторяемыми.','Одна старая ошибка воспроизводится автоматически.','После patch-а тест доказывает, что дверь закрыта.']),
    ],
    inspiration:{year:2024,label:'Pwn2Own и defensive security labs',summary:'Современные соревнования по безопасности проходят на заранее определённых целях и стендах, где исследователь получает разрешённый scope.',lesson:'QueQuest копирует не exploit-технику, а loop: построить → атаковать собственный стенд → доказать исправление.'},
  }),
  quest({
    id:'paid-shop-automation', kind:'starter', title:'ПЕРВЫЙ ПЛАТНЫЙ ЗАКАЗ · ЛАВКА ЛИНЫ', client:'ЛИНА · НОЧНОЙ РЫНОК', art:'market',
    hook:'Каждое утро Лина вручную сводит заказы из трёх таблиц. Это скучно, повторяемо и почему-то уже стоит ей два часа жизни в день.',
    brief:'Сделай полезную автоматизацию: собрать записи, не потерять дубликаты, показать dry-run и оставить понятный отчёт. Здесь деньги — не награда за “урок”, а плата за то, что система реально экономит чужую рутину.',
    skills:['automation','web','systems'], payout:320, xp:240,
    approaches:[
      approach('small-script','Сделать маленький понятный скрипт и отчёт','SCRIPT + REPORT',{automation:3,systems:1},['Три источника превращаются в один список.','Повторный запуск не умножает один и тот же заказ.','Лина получает отчёт и платит за сэкономленное утро.']),
      approach('tiny-web-tool','Сделать маленькую страницу: кинул файл → получил результат','LOCAL WEB TOOL',{web:3,automation:2},['Лине не нужен терминал.','Ошибочные строки видны до сохранения.','Инструмент можно передать второй лавке без инструкции по Python.']),
      approach('workflow','Собрать поток из готовых деталей и явных проверок','WORKFLOW + IDEMPOTENCY',{automation:2,systems:2,web:1},['Каждый шаг виден отдельно.','Ошибка одной таблицы не уничтожает весь отчёт.','Следующий похожий заказ становится дешевле собирать.']),
    ],
    inspiration:{year:2025,label:'Фриланс-спрос на scripting & automation',summary:'В отчёте Upwork scripting & automation был самым быстрорастущим навыком категории Coding & Web Development за 2025 год.',lesson:'Не обещаем лёгкие деньги. Показываем конкретную ценность: меньше ручной работы, меньше ошибок, переносимый инструмент.'},
  }),
  quest({
    id:'truthful-bot', kind:'starter', title:'БОТ ПООБЕЩАЛ ЛИШНЕЕ', client:'ТЕЯ · СЕРВИСНАЯ СТОЙКА', art:'ai',
    hook:'Q-Bot красиво объяснил клиенту правило — только правило уже не такое. Клиент сохранил ответ и пришёл за обещанным.',
    brief:'Нужно не “сделать бота умнее”, а связать его ответ с источником истины, проверить опасные формулировки и оставить путь к человеку, когда данных недостаточно.',
    skills:['ai','systems','web'], payout:300, xp:250,
    approaches:[
      approach('source-first','Пусть бот сначала найдёт актуальное правило и покажет источник','RAG + PROVENANCE',{ai:3,systems:1},['Ответ привязан к текущему документу.','Старая версия больше не выглядит такой же убедительной.','Пользователь видит, откуда взялось правило.']),
      approach('eval-gate','Прогнать опасные обещания через набор проверок до публикации','EVAL GATE',{ai:2,automation:2,systems:1},['Известные плохие формулировки становятся тестами.','Новый prompt не может тихо вернуть старую ошибку.','Рискованный ответ блокируется до релиза.']),
      approach('human-fallback','Не угадывать там, где ответ создаёт обязательство','ESCALATION POLICY',{ai:2,web:1,systems:2},['Бот отвечает сам на безопасные вопросы.','Неопределённое обещание уходит человеку.','В журнале видно, где знаний модели недостаточно.']),
    ],
    inspiration:{year:2024,label:'Moffatt v. Air Canada',summary:'Канадский трибунал признал авиакомпанию ответственной за неверную информацию, которую её сайт-чатбот дал клиенту.',lesson:'AI-ответ — часть системы и продукта. Ответственность нельзя “делегировать модели”.'},
  }),
  quest({
    id:'bad-update', title:'ПЯТНИЦА · ОБНОВЛЕНИЕ УРОНИЛО ПОЛГОРОДА', client:'ГОРОДСКАЯ СМЕНА', art:'grid',
    hook:'Новая конфигурация прошла обычный путь и одновременно выключила слишком много одинаковых узлов.',
    brief:'Найди безопасный способ вернуть сервис и изменить release-процесс так, чтобы следующая ошибка имела маленький радиус. Здесь нельзя победить “ещё большим сервером”.',
    skills:['systems','automation'], requires:{anySkill:[['systems',1],['automation',1]]}, payout:430, xp:300,
    approaches:[
      approach('rollback-first','Сначала вернуть последнюю известную рабочую версию','ROLLBACK + PIN',{systems:3,automation:1},['Работа возвращается раньше полного расследования.','Плохая версия перестаёт распространяться.','Разбор причины идёт уже без горящего города.']),
      approach('rings','Разделить будущие обновления на маленькие кольца','STAGED ROLLOUT',{systems:2,automation:3},['Первое кольцо ловит проблему.','Остальной парк не получает плохую конфигурацию.','Откат становится маленькой операцией вместо массовой аварии.']),
      approach('contract-test','Добавить проверку именно того входа, который раньше не тестировали','INPUT CONTRACT TEST',{automation:3,systems:2},['Опасная конфигурация воспроизводится в тесте.','Следующий релиз падает до production.','Canary остаётся второй линией защиты, а не единственной.']),
    ],
    inspiration:{year:2024,label:'CrowdStrike Falcon content update incident',summary:'19 июля 2024 ошибочный content update для Windows-хостов вызвал массовые сбои; обновление было откатано, а компания публиковала post-incident review.',lesson:'Скорость доставки защитных обновлений требует blast-radius control, staged rollout и проверяемого отката.'},
  }),
  quest({
    id:'supply-chain-shadow', title:'ПАКЕТ ИЗ ТЕНИ', client:'МАСТЕРСКАЯ СБОРКИ', art:'low',
    hook:'Исходники выглядят нормально, но собранный архив ведёт себя иначе. Разница появляется где-то между source и artifact.',
    brief:'Твоя задача — не “взломать Linux”, а расследовать цепочку поставки: происхождение артефакта, воспроизводимая сборка, карантин и минимальный доверенный путь.',
    skills:['security','lowlevel','systems'], requires:{anySkill:[['security',1],['lowlevel',1],['systems',2]]}, payout:520, xp:340,
    approaches:[
      approach('rebuild','Собрать из известного source и сравнить результат','REPRODUCIBLE BUILD',{lowlevel:3,systems:2},['Два артефакта перестают считаться одинаковыми “по имени”.','Подозрительная разница становится видимой.','Город переходит на проверенную сборку.']),
      approach('provenance','Потребовать явную цепочку происхождения до deploy','PROVENANCE ATTESTATION',{security:3,systems:2},['Неизвестный артефакт не получает автоматическое доверие.','Сборка привязана к source и окружению.','Карантин становится обычным состоянием, а не паникой.']),
      approach('minimal-surface','Убрать ненужную зависимость из чувствительного пути','REDUCE TRUST SURFACE',{security:2,lowlevel:2,systems:3},['Критический сервис зависит от меньшего числа пакетов.','Проверять остаётся меньше.','Будущая проблема в этой библиотеке имеет меньший радиус.']),
    ],
    inspiration:{year:2024,label:'XZ Utils CVE-2024-3094',summary:'В release-архивы xz 5.6.0/5.6.1 попал вредоносный код; инцидент обнаружили до широкого попадания в стабильные дистрибутивы.',lesson:'Source, release artifact и build pipeline — разные объекты доверия.'},
  }),
  quest({
    id:'cloud-cascade', title:'ОДИН СКЛАД · ДЕСЯТЬ МОЛЧАЩИХ СЕРВИСОВ', client:'ГОРОДСКОЕ ОБЛАКО', art:'grid',
    hook:'Чат, картинки, доступ, AI и панель выглядят как разные продукты — но внезапно падают вместе.',
    brief:'Найди общую зависимость и реши, какие функции обязаны деградировать независимо, где нужен fallback, а где честный отказ лучше фальшивой зелёной лампы.',
    skills:['systems','automation','web'], requires:{anySkill:[['systems',1],['automation',1],['web',2]]}, payout:460, xp:310,
    approaches:[
      approach('dependency-map','Сначала сделать скрытую общую зависимость видимой','DEPENDENCY MAP',{systems:3,web:1},['У десяти симптомов появляется одна причина.','Приоритет восстановления становится очевиднее.','Будущая архитектура перестаёт считать этот storage “просто деталью”.']),
      approach('degraded-mode','Оставить жизненно важное без красивых вторичных функций','DEGRADED MODE',{systems:3,automation:2},['Основной путь продолжает работать.','Необязательные функции честно выключены.','Пользователь видит ограниченный режим, а не бесконечный spinner.']),
      approach('isolate','Развести критические данные по независимым путям','FAILURE DOMAIN SPLIT',{systems:3,web:2},['Следующий storage-сбой не валит всё сразу.','Некоторые данные дублируются дороже.','Blast radius становится частью архитектуры.']),
    ],
    inspiration:{year:2025,label:'Cloudflare service outage, June 12 2025',summary:'Сбой базовой storage-инфраструктуры Workers KV затронул множество разных Cloudflare-сервисов, которые зависели от неё.',lesson:'Десяток продуктов может быть одной системой отказа, если делит критическую зависимость.'},
  }),
  quest({
    id:'credential-ghost', title:'КЛЮЧ, КОТОРЫЙ НЕ УМЕР', client:'АРХИВНЫЙ КООПЕРАТИВ', art:'ice',
    hook:'Логин выглядит легитимным: правильный пользователь, правильный пароль. Только этот пароль украли несколько лет назад и никто его не отозвал.',
    brief:'Расследуй защиту аккаунта и уменьши ценность одной украденной пары логин/пароль. Квест полностью defensive: никаких credential-stealing техник и никаких реальных сервисов.',
    skills:['security','systems'], requires:{anySkill:[['security',1],['systems',2]]}, payout:470, xp:320,
    approaches:[
      approach('mfa','Одного старого секрета больше недостаточно','MFA',{security:3,systems:1},['Старый пароль перестаёт быть полным билетом.','Подозрительный вход просит второй фактор.','Команда видит, какие аккаунты ещё живут по старому правилу.']),
      approach('rotate','Отозвать долгоживущие секреты и ввести срок жизни','ROTATION',{security:2,automation:2},['Старые утечки постепенно теряют ценность.','Ротация становится процессом, а не ночной ручной операцией.','Сервисные аккаунты получают владельцев и срок.']),
      approach('allowlist-audit','Ограничить чувствительный контур и видеть необычный вход','ALLOWLIST + ANOMALY AUDIT',{security:3,systems:2},['Чувствительный архив принимает соединения только из ожидаемого контура.','Необычный вход становится событием, а не тихим фактом.','Журнал помогает понять масштаб до смены всех секретов.']),
    ],
    inspiration:{year:2024,label:'Mandiant UNC5537 / Snowflake customer instances',summary:'Mandiant связала исследованные компрометации с ранее украденными customer credentials; среди факторов назывались отсутствие MFA, долгоживущие пароли и отсутствие network allow lists.',lesson:'Иногда “взлом облака” — это старый действующий ключ и слишком широкая зона доверия.'},
  }),
  quest({
    id:'agent-patch', title:'Q-BOT ПРИНЁС PULL REQUEST', client:'ТЕЯ · НОВЫЙ СЕРВИС', art:'ai',
    hook:'Ты описал проблему словами. Q-Bot сам нашёл файлы, сделал patch и просит review. Быстро — не значит “можно не смотреть”.',
    brief:'Сделай из AI-агента нормального участника инженерного процесса: ограниченный scope, diff, тесты, review и право человека не принимать patch.',
    skills:['ai','web','systems'], requires:{anySkill:[['ai',1],['web',1],['systems',2]]}, payout:500, xp:330,
    approaches:[
      approach('review-first','Сначала посмотреть diff и доказательства, потом merge','DIFF + REVIEW',{ai:2,web:2,systems:2},['Q-Bot остаётся автором patch-а, а не владельцем production.','Человек видит изменение до применения.','Комментарий превращается в следующий revision.']),
      approach('tests-first','Попросить Q-Bot сначала доказать поведение тестом','TEST-FIRST AGENT',{ai:3,automation:2},['Проблема получает воспроизводимый пример.','Patch можно оценивать не по уверенности Q-Bot.','Регрессия останется в наборе проверок после merge.']),
      approach('bounded-task','Дать агенту только маленький issue и узкий набор файлов','BOUNDED AGENT SCOPE',{ai:3,systems:2},['Q-Bot быстрее заканчивает ограниченную задачу.','Случайный большой refactor не попадает в diff.','Успех на маленьком scope становится доказательством для следующего уровня.']),
    ],
    inspiration:{year:2025,label:'GitHub Copilot coding agent',summary:'GitHub описывает coding agent, который получает issue, работает в отдельной среде, открывает draft pull request и запрашивает review.',lesson:'Автономный агент полезнее, когда встроен в проверяемый workflow, а не заменяет сам workflow.'},
  }),
  quest({
    id:'firmware-lab', title:'БАЙТ НЕ ТАМ', client:'СТЕНД МИКРОКОНТРОЛЛЕРА', art:'garage',
    hook:'На красивом экране всё нормально. На уровне состояния один индекс иногда уходит за границу — и маленькая функция начинает менять совсем не тот блок.',
    brief:'Синтетическая прошивка QueQuest даёт маленькую таблицу памяти и несколько безопасных инструкций. Найди нарушенное правило границы, исправь parser и только потом включи скрытую функцию собственного стенда.',
    skills:['lowlevel','vehicle','security'], requires:{anySkill:[['lowlevel',1],['vehicle',1]]}, payout:480, xp:320,
    approaches:[
      approach('bounds','Сделать границы памяти явным правилом','BOUNDS CHECK',{lowlevel:3,security:1},['Некорректный индекс отклоняется до изменения состояния.','Нормальные команды продолжают работать.','Скрытая функция включается только через валидный путь.']),
      approach('state-machine','Описать допустимые переходы вместо “любая команда в любое время”','STATE MACHINE',{lowlevel:3,vehicle:2},['Команда имеет смысл только в правильном состоянии.','Переходы становятся видимыми на схеме.','Невозможная последовательность перестаёт портить память.']),
      approach('fuzz-sim','Нагнать много случайных безопасных входов на симулятор','FUZZ HARNESS',{automation:2,lowlevel:2,security:2},['Симулятор быстро находит редкую комбинацию.','Crash превращается в повторяемый seed.','После исправления тот же seed остаётся защитой от регрессии.']),
    ],
    inspiration:{year:2024,label:'Pwn2Own Automotive / embedded targets',summary:'Automotive security contests включают infotainment, модемы, Automotive Grade Linux и EV chargers — программируемые устройства с реальными state/boundary проблемами.',lesson:'Низкий уровень интересен не “магическим хаком”, а тем, что один байт и один неверный переход реально меняют физическое поведение.'},
  }),
]);

export const GUILD_RAIDS = freeze([
  freeze({
    id:'arcade-tower', title:'RAID · АРКАДНАЯ БАШНЯ', scope:'РАЗРЕШЁННЫЙ ТЕСТОВЫЙ СЕРВЕР', payout:900, xp:520,
    brief:'Владелец игровой башни дал вашей группе специальный турнирный shard. Красная цель: доказать, что score нельзя доверять клиенту. Синяя цель: починить серверную проверку и пережить повторный тест. Никаких реальных сайтов, аккаунтов или сетевых команд.',
    required:['security','systems'], flex:['web','automation','lowlevel'],
  }),
  freeze({
    id:'night-convoy', title:'RAID · НОЧНОЙ КОНВОЙ', scope:'СИНТЕТИЧЕСКИЙ VEHICLE LAB', payout:950, xp:540,
    brief:'Три виртуальных машины должны доехать до хаба, пока симулятор подбрасывает дубликаты сигналов, потерю связи и чужую команду без доверенного источника. Команда должна разделить диагностику, hardening и автоматическое восстановление.',
    required:['vehicle','systems'], flex:['security','automation','lowlevel'],
  }),
]);

export const GUILD_JOB_TYPES = freeze([
  freeze({id:'orders',client:'маленькая лавка',problem:'каждое утро вручную сводит заказы',skills:['automation','web'],pay:[140,260]}),
  freeze({id:'support',client:'небольшой сервис',problem:'бот отвечает уверенно, но без ссылки на правило',skills:['ai','systems'],pay:[170,300]}),
  freeze({id:'dashboard',client:'мастерская',problem:'данные есть, но никто не видит, где теряется время',skills:['systems','web'],pay:[150,280]}),
  freeze({id:'files',client:'студия',problem:'сотни файлов каждый вечер надо раскладывать руками',skills:['automation','systems'],pay:[130,240]}),
  freeze({id:'api',client:'новый городской сервис',problem:'два приложения говорят на чуть разных контрактах',skills:['web','systems'],pay:[180,320]}),
  freeze({id:'eval',client:'AI-команда',problem:'модель обновляют по ощущениям и не замечают редкие провалы',skills:['ai','automation'],pay:[190,340]}),
  freeze({id:'rig',client:'гаражный кооператив',problem:'нужен безопасный стенд для повторяемой диагностики',skills:['vehicle','automation'],pay:[190,330]}),
]);

function hashSeed(seed) {
  let x = Math.max(1, Math.round(Number(seed) || 1)) >>> 0;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  return x >>> 0;
}

export function guildLevel(points) {
  const value = Math.max(0, Number(points) || 0);
  return [...GUILD_LEVELS].reverse().find(item => value >= item.min) ?? GUILD_LEVELS[0];
}

export function guildHistoryPoints(profile = {}) {
  const labs = profile.labs ?? {};
  return {
    automation: (labs.automation?.completed ? 2 : 0) + (labs.commons?.codeDeployed ? 2 : 0) + ((labs.nexus?.completedMissions?.length ?? 0) >= 3 ? 1 : 0),
    ai: (labs.ai?.completed ? 1 : 0) + (labs.llm?.completed ? 2 : 0) + (labs.retrieval?.completed ? 1 : 0) + (labs.bot?.completed ? 2 : 0),
    systems: ((profile.completedContracts?.length ?? 0) >= 18 ? 1 : 0) + (labs.operations?.codeDeployed ? 2 : 0) + (labs.threads?.codeDeployed ? 2 : 0),
    security: ((labs.desk?.completedMissions?.length ?? 0) >= 5 ? 2 : 0) + (labs.simnet?.completed ? 2 : 0),
    vehicle: 0,
    web: (labs.automation?.completed ? 1 : 0) + ((labs.world?.completedStories?.length ?? 0) >= 6 ? 1 : 0),
    lowlevel: ((labs.python?.completed?.length ?? 0) >= 24 ? 1 : 0) + (labs.neural?.completed ? 1 : 0),
  };
}

export function guildLedgerPoints(profile = {}) {
  const ledger = profile.labs?.guild?.skillLedger ?? {};
  const totals = Object.fromEntries(GUILD_SKILLS.map(item => [item.id, 0]));
  for (const gains of Object.values(ledger)) {
    if (!gains || typeof gains !== 'object') continue;
    for (const item of GUILD_SKILLS) totals[item.id] += Math.max(0, Number(gains[item.id]) || 0);
  }
  return totals;
}

export function deriveGuildPortfolio(profile = {}) {
  const history = guildHistoryPoints(profile);
  const earned = guildLedgerPoints(profile);
  const result = {};
  for (const item of GUILD_SKILLS) {
    const points = (history[item.id] ?? 0) + (earned[item.id] ?? 0);
    const level = guildLevel(points);
    result[item.id] = { ...item, points, history:history[item.id] ?? 0, earned:earned[item.id] ?? 0, level:level.level, levelName:level.name };
  }
  return result;
}

export function guildCredits(profile = {}) {
  return Object.values(profile.labs?.guild?.creditLedger ?? {}).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
}

export function isGuildQuestUnlocked(profile, item) {
  if (!item?.requires || Object.keys(item.requires).length === 0) return {ok:true,reason:''};
  const portfolio = deriveGuildPortfolio(profile);
  const completed = new Set(profile.labs?.guild?.completedQuests ?? []);
  if (item.requires.completed && !item.requires.completed.every(id => completed.has(id))) return {ok:false,reason:'Сначала закончи связанный контракт.'};
  if (item.requires.credits && guildCredits(profile) < item.requires.credits) return {ok:false,reason:`Нужно заработать ${item.requires.credits} CR на заказах.`};
  if (item.requires.anySkill) {
    const ok = item.requires.anySkill.some(([id,level]) => (portfolio[id]?.level ?? 0) >= level);
    if (!ok) {
      const names = item.requires.anySkill.map(([id,level]) => `${skill(id)?.short ?? id} ${level}`).join(' ИЛИ ');
      return {ok:false,reason:`Нужен ${names}. Можно прокачать только одну подходящую специализацию.`};
    }
  }
  return {ok:true,reason:''};
}

export function evaluateGuildApproach(item, approachId, profile = {}) {
  const unlock = isGuildQuestUnlocked(profile, item);
  if (!unlock.ok) return {ok:false,reason:unlock.reason};
  const selected = item?.approaches?.find(a => a.id === approachId);
  if (!selected) return {ok:false,reason:'Выбери подход.'};
  const portfolio = deriveGuildPortfolio(profile);
  const familiar = Object.entries(selected.skills).filter(([id]) => (portfolio[id]?.level ?? 0) > 0).map(([id]) => id);
  return {
    ok:true,
    questId:item.id,
    approach:selected,
    payout:item.payout,
    xp:item.xp,
    familiar,
    reveal:item.inspiration,
    resultLabel:familiar.length ? 'ТЫ УЗНАЛ ЗНАКОМУЮ СИЛУ В НОВОМ МИРЕ' : 'ТЫ ТОЛЬКО ЧТО ОТКРЫЛ НОВУЮ ПРОФЕССИЮ',
  };
}

export function generateGuildJob(seed = 1) {
  const x = hashSeed(seed);
  const type = GUILD_JOB_TYPES[x % GUILD_JOB_TYPES.length];
  const difficulty = 1 + ((x >>> 5) % 4);
  const pay = Math.round(type.pay[0] + ((type.pay[1] - type.pay[0]) * difficulty / 4));
  const primary = type.skills[x % type.skills.length];
  const secondary = type.skills[(x + 1) % type.skills.length];
  return freeze({
    seed:Math.max(1,Math.round(Number(seed)||1)),
    id:`job-${Math.max(1,Math.round(Number(seed)||1))}`,
    title:`ЗАКАЗ #${String(Math.max(1,Math.round(Number(seed)||1))).padStart(3,'0')}`,
    client:type.client,
    problem:type.problem,
    difficulty,
    pay,
    skills:freeze([...new Set([primary,secondary])]),
  });
}

export function evaluateGuildJob(job, skillId, profile = {}) {
  if (!job?.skills?.includes(skillId)) return {ok:false,reason:'Этот подход не соответствует проблеме заказа.'};
  const p = deriveGuildPortfolio(profile)[skillId];
  const level = p?.level ?? 0;
  const success = Math.max(45, Math.min(100, 58 + level * 12 - job.difficulty * 5));
  return {ok:true,skillId,success,payout:job.pay,skillGain:level >= 3 ? 1 : 2,xp:90 + job.difficulty * 15};
}

export function evaluateGuildRaidTeam(raid, team = []) {
  const unique = [...new Set(team.filter(id => GUILD_SKILLS.some(skillItem => skillItem.id === id)))];
  const missing = raid.required.filter(id => !unique.includes(id));
  const flexHit = raid.flex.some(id => unique.includes(id));
  const ok = unique.length >= 3 && missing.length === 0 && flexHit;
  const coverage = raid.required.filter(id => unique.includes(id)).length + (flexHit ? 1 : 0);
  return {ok,unique,missing,flexHit,coverage,reason:ok?'Команда покрывает разведку, границы и исполнение.':missing.length?`Не хватает обязательной роли: ${missing.map(id=>skill(id)?.short??id).join(', ')}.`:'Нужна третья специализация для исполнения или проверки.'};
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function setText(root, selector, value) { const node=root.querySelector(selector); if(node) node.textContent=value; }

export function createQuestGuild(root,{getProfile=()=>({}),getMode=()=> 'guided',onProfile=()=>{},onSound=()=>{},onClose=()=>{}}={}) {
  const skillGrid=root.querySelector('#guildSkills');
  const questGrid=root.querySelector('#guildQuestGrid');
  const detail=root.querySelector('#guildQuestDetail');
  const approaches=root.querySelector('#guildApproaches');
  const partyPicks=root.querySelector('#guildPartyPicks');
  let activeQuest=null;
  let activeApproach=null;
  let simulated=null;
  let currentJob=null;
  let party=[];
  let activeRaid=GUILD_RAIDS[0];

  function renderHeader(){
    const profile=getProfile();
    const g=profile.labs?.guild ?? {};
    setText(root,'#guildWallet',`${guildCredits(profile)} CR`);
    setText(root,'#guildProgress',`${g.completedQuests?.length ?? 0}/${GUILD_QUESTS.length} ИСТОРИЙ · ${g.jobSeeds?.length ?? 0} ЗАКАЗОВ · ${g.completedRaids?.length ?? 0}/${GUILD_RAIDS.length} RAID`);
  }

  function renderSkills(){
    const portfolio=deriveGuildPortfolio(getProfile());
    skillGrid.innerHTML='';
    for(const item of GUILD_SKILLS){
      const p=portfolio[item.id];
      const card=document.createElement('article');
      card.className='guild-skill-card';
      card.dataset.skill=item.id;
      card.innerHTML=`<b>${esc(item.glyph)}</b><div><small>${esc(item.short)} · ${esc(p.levelName)}</small><strong>${esc(item.name)}</strong><p>${esc(item.fantasy)}</p><i>${esc(getMode()==='compact'?item.real:`${p.points} очк. навыка · ${p.history ? `${p.history} признано из прошлых приключений` : 'можно начать с нуля'}`)}</i></div>`;
      skillGrid.append(card);
    }
  }

  function renderQuests(){
    const profile=getProfile();
    const done=new Set(profile.labs?.guild?.completedQuests ?? []);
    questGrid.innerHTML='';
    for(const item of GUILD_QUESTS){
      const unlock=isGuildQuestUnlocked(profile,item);
      const card=document.createElement('button'); card.type='button'; card.className='guild-quest-card'; card.dataset.quest=item.id; card.dataset.art=item.art; card.dataset.done=String(done.has(item.id)); card.disabled=!unlock.ok;
      const tags=item.skills.map(id=>`<span>${esc(skill(id)?.short ?? id)}</span>`).join('');
      card.innerHTML=`<small>${done.has(item.id)?'✓ ПРОЙДЕНО':item.kind==='starter'?'СТАРТОВЫЙ КВЕСТ':'REAL-ECHO КВЕСТ'} · ${item.payout} CR</small><strong>${esc(item.title)}</strong><p>${esc(item.hook)}</p><div>${tags}</div><i>${esc(unlock.ok?'МОЖНО БРАТЬ':unlock.reason)}</i>`;
      card.addEventListener('click',()=>openQuest(item.id)); questGrid.append(card);
    }
  }

  function openQuest(id){
    const item=GUILD_QUESTS.find(q=>q.id===id); if(!item)return;
    const unlock=isGuildQuestUnlocked(getProfile(),item); if(!unlock.ok){onSound('blocked');return;}
    activeQuest=item;activeApproach=null;simulated=null;
    setText(root,'#guildQuestKind',item.kind==='starter'?'СТАРТОВЫЙ КВЕСТ':'КОНТРАКТ ИЗ РЕАЛЬНОГО КЛАССА СОБЫТИЙ');
    setText(root,'#guildQuestTitle',item.title); setText(root,'#guildQuestClient',item.client); setText(root,'#guildQuestBrief',item.brief);
    approaches.innerHTML='';
    for(const a of item.approaches){
      const b=document.createElement('button');b.type='button';b.dataset.approach=a.id;
      const skillTags=Object.entries(a.skills).map(([id,pts])=>`${skill(id)?.short ?? id}+${pts}`).join(' · ');
      b.innerHTML=`<strong>${esc(a.human)}</strong><small>${esc(getMode()==='compact'?a.tech:skillTags)}</small><i>${esc(getMode()==='compact'?skillTags:'Сначала смысл. Техническое имя раскроется после результата.')}</i>`;
      b.addEventListener('click',()=>{activeApproach=a.id;for(const node of approaches.querySelectorAll('button'))node.dataset.on=String(node===b);root.querySelector('#guildSimulate').disabled=false;onSound('ui-click');});
      approaches.append(b);
    }
    root.querySelector('#guildSimulate').disabled=true;root.querySelector('#guildCommit').hidden=true;root.querySelector('#guildResult').innerHTML='<em>Выбери способ. Здесь нет одного “правильного класса”.</em>';
    root.querySelector('#guildRealEcho').hidden=true;detail.hidden=false;detail.scrollIntoView?.({block:'nearest'});
  }

  root.querySelector('#guildSimulate').addEventListener('click',()=>{
    if(!activeQuest||!activeApproach)return;
    simulated=evaluateGuildApproach(activeQuest,activeApproach,getProfile());if(!simulated.ok){setText(root,'#guildStatus',simulated.reason);onSound('blocked');return;}
    root.querySelector('#guildResult').innerHTML=simulated.approach.beats.map(beat=>`<p>→ ${esc(beat)}</p>`).join('');
    setText(root,'#guildStatus',`${simulated.resultLabel}. Выплата ${simulated.payout} CR станет твоей после фиксации результата.`);
    const echo=root.querySelector('#guildRealEcho');echo.hidden=false;echo.innerHTML=`<small>ПОСЛЕ ТОГО КАК ТЫ ПОНЯЛ МЕХАНИКУ · REAL WORLD ECHO ${esc(simulated.reveal?.year ?? '')}</small><strong>${esc(simulated.reveal?.label ?? 'Реальный инженерный класс')}</strong><p>${esc(simulated.reveal?.summary ?? '')}</p><i>${esc(simulated.reveal?.lesson ?? '')}</i>`;
    root.querySelector('#guildCommit').hidden=false;onSound('wake');
  });

  root.querySelector('#guildCommit').addEventListener('click',()=>{
    if(!simulated||!activeQuest)return;
    onProfile({type:'guild-quest',id:activeQuest.id,approach:simulated.approach.id,skills:simulated.approach.skills,credits:simulated.payout,xp:simulated.xp});
    onSound('reward');render();openQuest(activeQuest.id);setText(root,'#guildStatus','КВЕСТ ЗАКРЕПЛЁН. Навык остаётся твоим; можешь уйти в другую профессию прямо сейчас.');
  });

  function renderJob(){
    const box=root.querySelector('#guildJob');
    if(!currentJob){box.innerHTML='<em>Возьми случайный оплачиваемый заказ. Они не требуют проходить сюжет по порядку.</em>';return;}
    const p=deriveGuildPortfolio(getProfile());
    box.innerHTML=`<small>${esc(currentJob.title)} · СЛОЖНОСТЬ ${currentJob.difficulty}/4 · ${currentJob.pay} CR</small><strong>${esc(currentJob.client)}</strong><p>${esc(currentJob.problem)}</p><div class="guild-job-actions"></div><i id="guildJobResult">Выбери специализацию, которой хочешь решить заказ.</i>`;
    const actions=box.querySelector('.guild-job-actions');
    for(const id of currentJob.skills){const b=document.createElement('button');b.type='button';b.textContent=`${skill(id)?.glyph ?? ''} ${skill(id)?.name ?? id} · ${p[id]?.levelName ?? ''}`;b.addEventListener('click',()=>{const res=evaluateGuildJob(currentJob,id,getProfile());if(!res.ok)return;setText(root,'#guildJobResult',`Вероятность чистого выполнения: ${res.success}% · +${res.skillGain} к ${skill(id)?.short} · ${res.payout} CR. Заказ закрыт в локальной симуляции.`);onProfile({type:'guild-job',seed:currentJob.seed,skill:id,skillGain:res.skillGain,credits:res.payout,xp:res.xp});onSound('reward');renderHeader();renderSkills();});actions.append(b);}
  }

  root.querySelector('#guildNewJob').addEventListener('click',()=>{
    const seeds=getProfile().labs?.guild?.jobSeeds ?? [];
    const next=(seeds.length?Math.max(...seeds):0)+1;
    currentJob=generateGuildJob(next);renderJob();onSound('ui-click');
  });

  function renderRaid(){
    setText(root,'#guildRaidTitle',activeRaid.title);setText(root,'#guildRaidScope',activeRaid.scope);setText(root,'#guildRaidBrief',activeRaid.brief);
    partyPicks.innerHTML='';
    for(const item of GUILD_SKILLS){const b=document.createElement('button');b.type='button';b.dataset.skill=item.id;b.dataset.on=String(party.includes(item.id));b.innerHTML=`<b>${esc(item.glyph)}</b><span>${esc(item.short)}</span>`;b.addEventListener('click',()=>{if(party.includes(item.id))party=party.filter(x=>x!==item.id);else if(party.length<3)party=[...party,item.id];else{onSound('blocked');setText(root,'#guildRaidStatus','В группе три слота. Выбери, кто именно нужен этому рейду.');return;}renderRaid();onSound('ui-click');});partyPicks.append(b);}
    setText(root,'#guildPartyLine',party.length?party.map(id=>skill(id)?.name).join(' + '):'ПУСТАЯ ГРУППА');
  }

  root.querySelector('#guildRaidNext').addEventListener('click',()=>{const idx=GUILD_RAIDS.indexOf(activeRaid);activeRaid=GUILD_RAIDS[(idx+1)%GUILD_RAIDS.length];party=[];renderRaid();});
  root.querySelector('#guildRaidRun').addEventListener('click',()=>{const res=evaluateGuildRaidTeam(activeRaid,party);setText(root,'#guildRaidStatus',res.reason);if(!res.ok){onSound('blocked');return;}const gains=Object.fromEntries(res.unique.map(id=>[id,1]));onProfile({type:'guild-raid',id:activeRaid.id,skills:gains,credits:activeRaid.payout,xp:activeRaid.xp,score:80+res.coverage*5});onSound('reward');render();setText(root,'#guildRaidStatus','RAID УДЕРЖАН. Это локальная party-модель; позже те же роли можно отдать реальным игрокам.');});

  root.querySelector('#guildQuestBack').addEventListener('click',()=>{detail.hidden=true;activeQuest=null;});
  root.querySelector('#guildClose').addEventListener('click',()=>{root.hidden=true;onClose();});

  function render(){renderHeader();renderSkills();renderQuests();renderJob();renderRaid();}
  return {open(){render();detail.hidden=true;root.hidden=false;root.querySelector('#guildNewJob')?.focus({preventScroll:true});},close(){root.hidden=true;},refresh:render};
}
