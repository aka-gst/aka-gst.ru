export const SYSTEM_CONTRACTS = Object.freeze([
  { id:'flow-01', tier:1, xp:40, icon:'⇢', title:'Очередь растёт', metric:'INPUT 4/s · WORKER 2/s', problem:'Вход быстрее обработки. Что реально поднимет throughput?', correct:'worker', options:[['buffer','БУФЕР +20','Больше места ждать'],['source','УСКОРИТЬ INPUT','Ещё больше входа'],['worker','+1 WORKER','Разделить очередь']], reveal:'worker = ещё один потребитель очереди; throughput растёт, а не только место ожидания.' },
  { id:'flow-02', tier:1, xp:40, icon:'▤', title:'Редкие всплески', metric:'Обычно 1/s · всплеск 8/s', problem:'Средняя мощность достаточна, но короткий burst теряет задачи.', correct:'buffer', options:[['worker','+4 WORKER','Держать всегда'],['buffer','QUEUE / BUFFER','Пережить краткий burst'],['sleep','SLEEP','Замедлить всех']], reveal:'буфер полезен, когда проблема — краткий burst, а не постоянное узкое место.' },
  { id:'safe-01', tier:1, xp:45, icon:'↻', title:'API иногда падает', metric:'HTTP · временный сбой', problem:'Запрос безопасно повторить. Как пережить временную ошибку?', correct:'retry', options:[['ignore','IGNORE','Потерять заказ'],['retry','RETRY + BACKOFF','Повторить позже'],['loop','WHILE TRUE','Молотить без паузы']], reveal:'retry ограничен числом попыток, а backoff не превращает временный сбой в шторм запросов.' },
  { id:'safe-02', tier:1, xp:45, icon:'≠', title:'Дубликаты webhook', metric:'event id = A17 приходит дважды', problem:'Повтор доставки не должен создать два заказа.', correct:'idempotency', options:[['lock','LOCK','Запретить параллельность'],['idempotency','IDEMPOTENCY KEY','Один id → один эффект'],['cache','CACHE','Запомнить ответ']], reveal:'idempotency отвечает на вопрос «если повторить операцию, изменится ли результат второй раз?».' },
  { id:'state-01', tier:2, xp:55, icon:'⌗', title:'Общий ledger', metric:'3 worker → 1 shared list', problem:'Несколько задач меняют одну критическую секцию.', correct:'lock', options:[['lock','LOCK','Один внутри'],['worker','ЕЩЁ WORKER','Больше конкуренции'],['sleep','SLEEP','Надеяться на тайминг']], reveal:'Lock гарантирует эксклюзивный доступ; sleep только меняет вероятность столкновения.' },
  { id:'flow-03', tier:2, xp:55, icon:'⋯', title:'50 независимых API', metric:'I/O waits · CPU почти свободен', problem:'Большую часть времени задачи ждут сеть.', correct:'async', options:[['async','ASYNCIO','Перекрыть ожидания'],['process','PROCESS POOL','Размножить CPU'],['single','ОДИН ЗА ОДНИМ','Не перекрывать ожидание']], reveal:'для I/O-bound работы конкурентность позволяет другой задаче двигаться, пока первая ждёт.' },
  { id:'flow-04', tier:2, xp:55, icon:'⚙', title:'Тяжёлая обработка CPU', metric:'100% CPU · сеть не ждём', problem:'Каждый job долго считает и блокирует ядро.', correct:'process', options:[['async','ASYNCIO','Переключать ожидания'],['process','PROCESS POOL','Разнести вычисления'],['buffer','QUEUE x100','Складировать ожидание']], reveal:'CPU-bound и I/O-bound — разные нагрузки: asyncio не делает тяжёлое вычисление быстрее само по себе.' },
  { id:'data-01', tier:2, xp:55, icon:'⌕', title:'Повторный дорогой READ', metric:'один справочник читается 200 раз', problem:'Данные почти не меняются, чтение дорогое.', correct:'cache', options:[['cache','CACHE','Переиспользовать результат'],['retry','RETRY','Читать ещё раз'],['lock','LOCK','Читать строго по одному']], reveal:'кэш меняет повторное вычисление/чтение на lookup, но требует правила актуальности.' },
  { id:'safe-03', tier:3, xp:70, icon:'☠', title:'Poison message', metric:'1 плохой job блокирует очередь', problem:'Одна задача стабильно падает после всех retry.', correct:'dead', options:[['retry','RETRY ∞','Никогда не двигаться дальше'],['dead','DEAD LETTER','Изолировать и продолжить'],['ignore','DELETE','Потерять без следа']], reveal:'dead-letter очередь сохраняет проблемный job отдельно и не блокирует здоровый поток.' },
  { id:'flow-05', tier:3, xp:70, icon:'║', title:'Rate limit 5', metric:'API разрешает 5 одновременных запросов', problem:'20 worker готовы стартовать одновременно.', correct:'semaphore', options:[['semaphore','SEMAPHORE(5)','Ограничить вход'],['lock','LOCK','Оставить только 1'],['buffer','BUFFER','Не ограничивать concurrency']], reveal:'Semaphore разрешает до N одновременных входов — это ограничитель, а не полный mutex.' },
  { id:'state-02', tier:3, xp:70, icon:'⇅', title:'Порядок важен', metric:'seq 41 → 42 → 43', problem:'События пришли конкурентно, но применение должно идти строго по seq.', correct:'order', options:[['order','ORDER KEY / SORT','Восстановить последовательность'],['worker','+ WORKER','Ещё сильнее перемешать'],['cache','CACHE','Сохранить копию']], reveal:'конкурентная доставка не гарантирует порядок; sequence/key делает порядок явной частью протокола.' },
  { id:'safe-04', tier:3, xp:70, icon:'⏱', title:'Вечный запрос', metric:'один вызов завис', problem:'Worker ждёт бесконечно и удерживает слот.', correct:'timeout', options:[['timeout','TIMEOUT','Ограничить ожидание'],['retry','RETRY СРАЗУ','Не остановить первый вызов'],['buffer','QUEUE','Спрятать зависание']], reveal:'timeout превращает бесконечное ожидание в контролируемый исход, который уже можно retry/log.' },
  { id:'data-02', tier:4, xp:90, icon:'▦', title:'10 000 мелких записей', metric:'DB write overhead > payload', problem:'Каждый item отдельно тратит больше времени на накладные расходы.', correct:'batch', options:[['batch','BATCH','Писать пачками'],['worker','100 WORKER','Усилить давление'],['sleep','SLEEP','Просто медленнее']], reveal:'batching амортизирует фиксированную стоимость операции, но увеличивает latency отдельных элементов.' },
  { id:'arch-01', tier:4, xp:90, icon:'◇', title:'Нельзя терять прогресс', metric:'процесс 40 минут · возможен restart', problem:'Перезапуск не должен начинать весь pipeline с нуля.', correct:'checkpoint', options:[['checkpoint','CHECKPOINT','Сохранить состояние этапа'],['log','ТОЛЬКО LOG','Знать, где упало'],['buffer','BUFFER','Хранить в памяти']], reveal:'checkpoint — это восстановимое состояние, а log — объяснение. Для recovery часто нужны оба.' },
  { id:'arch-02', tier:4, xp:90, icon:'◎', title:'Система медленная «иногда»', metric:'среднее скрывает пики', problem:'Нужно найти, где растёт задержка и очередь.', correct:'metrics', options:[['metrics','METRICS + TRACE','Измерить этапы'],['print','PRINT EVERYTHING','Шум без структуры'],['worker','+ WORKER','Лечить вслепую']], reveal:'latency, queue depth, errors и trace превращают «кажется медленно» в наблюдаемую систему.' },
  { id:'arch-03', tier:4, xp:95, icon:'↗', title:'10 независимых веток', metric:'результат нужен после всех', problem:'Ветки не зависят друг от друга, но потом нужно собрать ответы.', correct:'gather', options:[['gather','TASKGROUP / GATHER','Запустить вместе и дождаться'],['loop','FOR + AWAIT EACH','Последовательно'],['lock','LOCK','Сериализовать']], reveal:'структурированная конкурентность запускает независимые ветки вместе и даёт одну точку ожидания/ошибки.' },
  { id:'arch-04', tier:5, xp:110, icon:'⚖', title:'Две правды', metric:'cache и source расходятся', problem:'Быстрый кэш иногда показывает устаревшее состояние.', correct:'ttl', options:[['ttl','TTL / INVALIDATION','Правило свежести'],['worker','+ WORKER','Не про свежесть'],['retry','RETRY','Повторить тот же stale read']], reveal:'кэш без стратегии инвалидирования — новая копия состояния, а значит новый источник рассинхронизации.' },
  { id:'arch-05', tier:5, xp:110, icon:'⎇', title:'Один pipeline стал монолитом', metric:'любая правка ломает всё', problem:'READ, ROUTE и SAVE невозможно тестировать независимо.', correct:'interfaces', options:[['interfaces','ЯВНЫЕ ИНТЕРФЕЙСЫ','Разделить контракты'],['copy','СКОПИРОВАТЬ PIPELINE','Удвоить расхождение'],['global','GLOBAL STATE','Связать ещё сильнее']], reveal:'границы и интерфейсы позволяют менять одну часть, сохраняя контракт остальных.' },
]);

export function resolveSystemContract(contractId, choice) {
  const contract = SYSTEM_CONTRACTS.find((item) => item.id === contractId);
  if (!contract) return { ok:false, error:'unknown-contract' };
  return { ok: choice === contract.correct, contract };
}

function setText(root, selector, text) {
  const node = root.querySelector(selector);
  if (node) node.textContent = text;
}

export function createContractBoard(root, { getProfile, onProfile, onSound = () => {}, onClose = () => {}, onOpenSandbox = () => {} }) {
  const list = root.querySelector('#contractList');
  const detail = root.querySelector('#contractDetail');
  let selected = null;

  function renderList() {
    const profile = getProfile();
    list.replaceChildren();
    for (const contract of SYSTEM_CONTRACTS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'contract-card';
      button.dataset.contract = contract.id;
      button.dataset.done = String(profile.completedContracts.includes(contract.id));
      button.innerHTML = `<b>${contract.icon}</b><span><small>TIER ${contract.tier} · +${contract.xp} XP</small><strong>${contract.title}</strong><em>${contract.metric}</em></span><i>${profile.completedContracts.includes(contract.id) ? '✓' : '→'}</i>`;
      button.addEventListener('click', () => openContract(contract));
      list.append(button);
    }
    setText(root, '#contractProgress', `${profile.completedContracts.length}/${SYSTEM_CONTRACTS.length} закрыто`);
  }

  function openContract(contract) {
    selected = contract;
    detail.hidden = false;
    setText(root, '#contractTier', `TIER ${contract.tier} · ${contract.metric}`);
    setText(root, '#contractTitle', contract.title);
    setText(root, '#contractProblem', contract.problem);
    setText(root, '#contractFeedback', 'Выбери изменение системы. Ошибка не отнимет прогресс — метрика сразу покажет, почему решение не подходит.');
    const choices = detail.querySelector('#contractChoices');
    choices.replaceChildren();
    for (const [value, title, copy] of contract.options) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.contractChoice = value;
      button.innerHTML = `<strong>${title}</strong><small>${copy}</small>`;
      button.addEventListener('click', () => answer(value));
      choices.append(button);
    }
  }

  function answer(choice) {
    if (!selected) return;
    const result = resolveSystemContract(selected.id, choice);
    if (!result.ok) {
      detail.dataset.result = 'retry';
      setText(root, '#contractFeedback', `Не сходится с причиной сбоя. ${selected.problem} Посмотри на метрику ещё раз и меняй именно ограничивающий ресурс.`);
      onSound('blocked');
      return;
    }
    detail.dataset.result = 'success';
    const profile = getProfile();
    const already = profile.completedContracts.includes(selected.id);
    onProfile({ type:'contract', id:selected.id, score:1, xp:selected.xp });
    setText(root, '#contractFeedback', `✓ ${selected.reveal}${already ? ' Контракт уже был закрыт — XP повторно не начисляется.' : ` +${selected.xp} XP.`}`);
    onSound('reward');
    renderList();
  }

  root.querySelector('#contractBack').addEventListener('click', () => {
    detail.hidden = true;
    selected = null;
  });
  root.querySelector('#contractClose').addEventListener('click', () => { root.hidden = true; onClose(); });
  root.querySelector('#contractSandboxOpen')?.addEventListener('click', () => {
    root.hidden = true;
    onOpenSandbox();
  });

  return {
    open() { detail.hidden = true; selected = null; renderList(); root.hidden = false; root.querySelector('#contractClose').focus({preventScroll:true}); },
    close() { root.hidden = true; },
    count: SYSTEM_CONTRACTS.length,
  };
}
