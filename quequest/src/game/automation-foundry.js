// Chapter 8: Automation Foundry. A local fictional data factory that turns familiar
// QueQuest concepts into a visible pipeline, then introduces concurrency only when
// a real bottleneck and a shared-state collision make it necessary.

export const FOUNDRY_ITEMS = Object.freeze([
  Object.freeze({ id: 'job-01', kind: 'FILE', glyph: '▤' }),
  Object.freeze({ id: 'job-02', kind: 'TEXT', glyph: '≡' }),
  Object.freeze({ id: 'job-03', kind: 'TABLE', glyph: '▦' }),
  Object.freeze({ id: 'job-04', kind: 'FILE', glyph: '▤' }),
  Object.freeze({ id: 'job-05', kind: 'TEXT', glyph: '≡' }),
  Object.freeze({ id: 'job-06', kind: 'TABLE', glyph: '▦' }),
]);

export const MANUAL_STATIONS = Object.freeze(['read', 'route', 'save']);
export const PIPELINE_MODULES = Object.freeze(['read', 'route', 'save']);

export const AUTOMATION_ASYNC_SOURCE = `import asyncio

queue = asyncio.Queue()
ledger = []
lock = asyncio.Lock()

async def worker(name):
    while True:
        item = await queue.get()
        if item is None:
            queue.task_done()
            return
        result = await transform(item)
        async with lock:
            ledger.append(result)
        queue.task_done()

async def run(items):
    workers = [
        asyncio.create_task(worker("A")),
        asyncio.create_task(worker("B")),
    ]
    for item in items:
        await queue.put(item)
    for _ in workers:
        await queue.put(None)
    await queue.join()
    await asyncio.gather(*workers)

asyncio.run(run(incoming))`;

export function resolveManualStation(step, station) {
  const expected = MANUAL_STATIONS[step % MANUAL_STATIONS.length];
  return {
    ok: station === expected,
    expected,
    nextStep: station === expected ? step + 1 : step,
    itemIndex: Math.floor(step / MANUAL_STATIONS.length),
    done: station === expected && step + 1 >= MANUAL_STATIONS.length * 2,
  };
}

export function resolvePipelineModule(selected, moduleId) {
  const expected = PIPELINE_MODULES[selected.length];
  const ok = moduleId === expected;
  const next = ok ? [...selected, moduleId] : [...selected];
  return { ok, expected, selected: next, done: next.length === PIPELINE_MODULES.length };
}

export function resolveScaleChoice(choice) {
  return {
    ok: choice === 'worker',
    choice,
    queueBefore: 6,
    queueAfter: choice === 'worker' ? 1 : (choice === 'buffer' ? 6 : 9),
    throughput: choice === 'worker' ? '2/s' : '1/s',
  };
}

export function resolveRaceChoice(choice) {
  return {
    ok: choice === 'lock',
    choice,
    ledgerSafe: choice === 'lock',
  };
}

function setText(root, selector, value) {
  const node = root.querySelector(selector);
  if (node) node.textContent = value;
}

export function createAutomationFoundry(root, { onComplete, onSound = () => {}, onCheckpoint = () => {} }) {
  const stage = root.querySelector('#foundryStage');
  const output = root.querySelector('#foundryOutput');
  const startButton = root.querySelector('#foundryStart');
  const continueButton = root.querySelector('#foundryContinue');
  const codeReveal = root.querySelector('#foundryCodeReveal');
  const queue = root.querySelector('#foundryQueue');
  const workers = root.querySelector('#foundryWorkers');
  const ledger = root.querySelector('#foundryLedger');
  let manualStep = 0;
  let pipeline = [];
  let finished = false;

  function paintItems({ active = 0, done = 0, queued = FOUNDRY_ITEMS.length } = {}) {
    const nodes = [...root.querySelectorAll('[data-foundry-item]')];
    nodes.forEach((node, index) => {
      node.dataset.state = index < done ? 'done' : (index === active ? 'active' : (index < queued ? 'queued' : 'waiting'));
      node.setAttribute('aria-current', index === active ? 'step' : 'false');
    });
  }

  function paintPipeline() {
    for (const node of root.querySelectorAll('[data-pipeline-node]')) {
      const index = pipeline.indexOf(node.dataset.pipelineNode);
      node.dataset.state = index >= 0 ? 'wired' : 'idle';
      node.querySelector('small').textContent = index >= 0 ? `ШАГ ${index + 1}` : 'НЕ ПОДКЛЮЧЕН';
    }
  }

  function setPhase(phase, title, line) {
    stage.dataset.step = phase;
    setText(root, '#foundryPhase', title);
    output.textContent = line;
  }

  function reset() {
    root.hidden = true;
    manualStep = 0;
    pipeline = [];
    finished = false;
    stage.dataset.step = 'briefing';
    delete stage.dataset.result;
    startButton.hidden = false;
    continueButton.hidden = true;
    codeReveal.hidden = true;
    queue.dataset.level = '0';
    workers.dataset.count = '1';
    ledger.dataset.state = 'idle';
    root.querySelector('#foundryAsyncCode').textContent = '';
    for (const button of root.querySelectorAll('[data-manual-station],[data-pipeline-pick],[data-scale-choice],[data-race-choice]')) button.disabled = true;
    paintItems({ active: 0, done: 0 });
    paintPipeline();
    setText(root, '#foundryPhase', 'РУЧНОЙ PIPELINE → АВТОМАТИЗАЦИЯ → BOTTLENECK → CONCURRENCY');
    output.textContent = 'Файлы, текст и таблицы теперь ведут себя как знакомый груз: каждый заказ должен пройти READ → ROUTE → SAVE.';
  }

  function enable(selector, value = true) {
    for (const button of root.querySelectorAll(selector)) button.disabled = !value;
  }

  function beginManual() {
    startButton.hidden = true;
    onCheckpoint('started');
    enable('[data-manual-station]');
    paintItems({ active: 0, done: 0 });
    setPhase('manual', '1 · СНАЧАЛА РУКАМИ', 'Проведи два заказа через три станции. Ошибка ничего не отнимает — просто выбери следующий правильный узел.');
    onSound('power');
  }

  function finishManual() {
    enable('[data-manual-station]', false);
    enable('[data-pipeline-pick]');
    paintItems({ active: 2, done: 2 });
    setPhase('pipeline', '2 · СОБЕРИ ОДИН PIPELINE', 'Ты повторил READ → ROUTE → SAVE шесть раз. Теперь соедини те же три действия один раз и пропусти через них остальные заказы.');
    onSound('reward');
  }

  function runPipeline() {
    enable('[data-pipeline-pick]', false);
    stage.dataset.result = 'success';
    queue.dataset.level = '6';
    paintItems({ active: 2, done: 2, queued: 6 });
    setPhase('bottleneck', '3 · АВТОМАТИЗАЦИЯ УПЁРЛАСЬ В УЗКОЕ МЕСТО', 'Pipeline работает сам, но ROUTE медленнее входа. Очередь растёт. Ускорение источника сделает хуже; один worker не успевает.');
    enable('[data-scale-choice]');
    onSound('cash');
  }

  function showRace() {
    enable('[data-scale-choice]', false);
    workers.dataset.count = '2';
    queue.dataset.level = '1';
    ledger.dataset.state = 'race';
    setPhase('race', '4 · ДВА WORKER’А СТОЛКНУЛИСЬ В ОДНОЙ ЗАПИСИ', 'Пропускная способность выросла, но оба worker’а одновременно тянут один общий LEDGER. Нужен не третий worker, а правило доступа к общей памяти.');
    enable('[data-race-choice]');
    onSound('blocked');
  }

  function winFoundry() {
    enable('[data-race-choice]', false);
    finished = true;
    ledger.dataset.state = 'safe';
    queue.dataset.level = '0';
    paintItems({ active: -1, done: 6, queued: 6 });
    setPhase('won', '5 · ФАБРИКА РАБОТАЕТ БЕЗ ТВОИХ РУК', 'Два worker’а разгрузили узкое место, Queue удержала поток, а Lock защитил общую запись. Теперь покажем ту же систему настоящим Python.');
    codeReveal.hidden = false;
    root.querySelector('#foundryAsyncCode').textContent = AUTOMATION_ASYNC_SOURCE;
    continueButton.hidden = false;
    onCheckpoint('complete');
    onSound('reward');
  }

  startButton.addEventListener('click', beginManual);

  for (const button of root.querySelectorAll('[data-manual-station]')) {
    button.addEventListener('click', () => {
      const result = resolveManualStation(manualStep, button.dataset.manualStation);
      if (!result.ok) {
        stage.dataset.result = 'retry';
        output.textContent = `Сейчас нужен ${result.expected.toUpperCase()}. Заказ остаётся на месте — попробуй сразу ещё раз.`;
        onSound('pickup');
        return;
      }
      stage.dataset.result = 'success';
      manualStep = result.nextStep;
      const stationNumber = manualStep % 3;
      const itemDone = Math.floor(manualStep / 3);
      paintItems({ active: Math.min(2, itemDone), done: itemDone });
      output.textContent = stationNumber === 0
        ? `✓ Заказ ${itemDone}/2 готов. Снова те же три действия для следующего.`
        : `✓ ${button.querySelector('strong')?.textContent ?? button.dataset.manualStation}. Ещё ${3 - stationNumber} шаг(а) до готового заказа.`;
      onSound(stationNumber === 0 ? 'drop' : 'scan');
      if (result.done) finishManual();
    });
  }

  for (const button of root.querySelectorAll('[data-pipeline-pick]')) {
    button.addEventListener('click', () => {
      const result = resolvePipelineModule(pipeline, button.dataset.pipelinePick);
      if (!result.ok) {
        stage.dataset.result = 'retry';
        output.textContent = `Связь должна продолжать уже знакомый маршрут. Следующий модуль: ${result.expected.toUpperCase()}.`;
        onSound('pickup');
        return;
      }
      pipeline = result.selected;
      paintPipeline();
      onSound('wire');
      output.textContent = `✓ ${button.dataset.pipelinePick.toUpperCase()} подключён. ${pipeline.length}/3 узлов.`;
      if (result.done) runPipeline();
    });
  }

  for (const button of root.querySelectorAll('[data-scale-choice]')) {
    button.addEventListener('click', () => {
      const result = resolveScaleChoice(button.dataset.scaleChoice);
      if (!result.ok) {
        stage.dataset.result = 'retry';
        queue.dataset.level = String(result.queueAfter);
        output.textContent = result.choice === 'buffer'
          ? 'Буфер даёт место ожиданию, но не увеличивает скорость ROUTE. Очередь всё ещё не успевает исчезать.'
          : 'Ускорить вход — значит ещё быстрее кормить уже перегруженный ROUTE. Очередь выросла.';
        onSound('blocked');
        return;
      }
      stage.dataset.result = 'success';
      output.textContent = '✓ Второй worker делит очередь с первым. Throughput вырос с 1/s до 2/s.';
      onSound('power');
      showRace();
    });
  }

  for (const button of root.querySelectorAll('[data-race-choice]')) {
    button.addEventListener('click', () => {
      const result = resolveRaceChoice(button.dataset.raceChoice);
      if (!result.ok) {
        stage.dataset.result = 'retry';
        ledger.dataset.state = 'race';
        output.textContent = result.choice === 'worker'
          ? 'Третий worker усилит гонку: общая запись останется общей.'
          : 'Sleep только сдвинет столкновение во времени. Нужна гарантия, что в критическую секцию входит один worker.';
        onSound('blocked');
        return;
      }
      stage.dataset.result = 'success';
      output.textContent = '✓ LOCK: пока один worker пишет в ledger, второй ждёт за дверью критической секции.';
      onSound('lock');
      winFoundry();
    });
  }

  continueButton.addEventListener('click', () => {
    root.hidden = true;
    onComplete?.();
  });

  reset();
  return {
    open({ resume = false } = {}) {
      reset();
      root.hidden = false;
      if (resume) beginManual();
      startButton.focus({ preventScroll: true });
    },
    reset,
  };
}
