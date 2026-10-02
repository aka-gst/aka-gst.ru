// Chapter 6: a local state/memory puzzle. Vika's only canonical presentation here is
// a blue floating half-human/female computer face without a body and the line «А вот и ты».
// No extra biography, personality, network, account or backend facts are introduced.

export const VIKA_MEMORY_STEPS = Object.freeze([
  Object.freeze({
    id: 'signal-01',
    signal: '◎',
    signalLabel: 'ОДИНАКОВЫЙ СИГНАЛ',
    expectedAction: 'remember',
    actionLabel: 'ЗАПОМНИТЬ',
    before: Object.freeze({ seen: 0, trusted: false }),
    after: Object.freeze({ seen: 1, trusted: false }),
  }),
  Object.freeze({
    id: 'signal-02',
    signal: '◎',
    signalLabel: 'ОДИНАКОВЫЙ СИГНАЛ',
    expectedAction: 'verify',
    actionLabel: 'ПРОВЕРИТЬ',
    before: Object.freeze({ seen: 1, trusted: false }),
    after: Object.freeze({ seen: 2, trusted: true }),
  }),
  Object.freeze({
    id: 'signal-03',
    signal: '◎',
    signalLabel: 'ОДИНАКОВЫЙ СИГНАЛ',
    expectedAction: 'respond',
    actionLabel: 'ОТВЕТИТЬ',
    before: Object.freeze({ seen: 2, trusted: true }),
    after: Object.freeze({ seen: 3, trusted: true }),
  }),
]);

export const VIKA_STATE_SOURCE = `memory = {
    "seen": 0,
    "trusted": False,
}

def react(signal):
    if memory["seen"] == 0:
        memory["seen"] += 1
        return "remember"
    if not memory["trusted"]:
        memory["trusted"] = True
        memory["seen"] += 1
        return "verify"
    memory["seen"] += 1
    return "respond"

for signal in same_signal:
    react(signal)`;

export function resolveVikaMemory(stepIndex, actionId) {
  const step = VIKA_MEMORY_STEPS[stepIndex];
  if (!step) return { ok: false, done: true, step: null, nextStep: stepIndex };
  const ok = actionId === step.expectedAction;
  return {
    ok,
    done: ok && stepIndex === VIKA_MEMORY_STEPS.length - 1,
    step,
    nextStep: ok ? Math.min(stepIndex + 1, VIKA_MEMORY_STEPS.length) : stepIndex,
    memory: ok ? { ...step.after } : { ...step.before },
  };
}

function setText(root, selector, value) {
  const node = root.querySelector(selector);
  if (node) node.textContent = value;
}

function paintMemory(root, memory) {
  setText(root, '#vikaMemorySeen', String(memory.seen));
  setText(root, '#vikaMemoryTrusted', memory.trusted ? 'TRUE' : 'FALSE');
  const trusted = root.querySelector('#vikaMemoryTrustedRow');
  if (trusted) trusted.dataset.value = memory.trusted ? 'true' : 'false';
}

export function createVikaMemory(root, { onComplete, onSound = () => {}, onCheckpoint = () => {} }) {
  const stage = root.querySelector('#vikaStage');
  const output = root.querySelector('#vikaOutput');
  const startButton = root.querySelector('#vikaStartMemory');
  const continueButton = root.querySelector('#vikaContinue');
  const codeReveal = root.querySelector('#vikaCodeReveal');
  let stepIndex = 0;
  let finished = false;

  function paintStep(message = 'Сигнал тот же. Смотри не на вход, а на то, что система уже помнит.') {
    const step = VIKA_MEMORY_STEPS[stepIndex];
    if (!step || finished) return;
    stage.dataset.step = 'memory';
    setText(root, '#vikaRoundLabel', `ПОВТОР ${stepIndex + 1}/${VIKA_MEMORY_STEPS.length}`);
    setText(root, '#vikaSignalGlyph', step.signal);
    setText(root, '#vikaSignalName', step.signalLabel);
    setText(root, '#vikaSignalVar', `signal → ${step.id}`);
    paintMemory(root, step.before);
    output.textContent = message;
    for (const [index, node] of [...root.querySelectorAll('[data-vika-repeat]')].entries()) {
      node.dataset.state = index < stepIndex ? 'done' : (index === stepIndex ? 'current' : 'waiting');
      node.setAttribute('aria-current', index === stepIndex ? 'step' : 'false');
    }
  }

  function reset() {
    root.hidden = true;
    stepIndex = 0;
    finished = false;
    stage.dataset.step = 'briefing';
    delete stage.dataset.result;
    startButton.hidden = false;
    continueButton.hidden = true;
    codeReveal.hidden = true;
    setText(root, '#vikaRoundLabel', '3 ОДИНАКОВЫХ ВХОДА · ПАМЯТЬ МЕНЯЕТ РЕШЕНИЕ');
    setText(root, '#vikaSignalGlyph', '◎');
    setText(root, '#vikaSignalName', 'ОДИНАКОВЫЙ СИГНАЛ');
    setText(root, '#vikaSignalVar', 'signal → ждёт вход');
    output.textContent = 'Q-Bot видит три одинаковых сигнала. Без памяти он выбрал бы одно и то же действие три раза.';
    paintMemory(root, { seen: 0, trusted: false });
    for (const node of root.querySelectorAll('[data-vika-repeat]')) node.dataset.state = 'waiting';
    for (const button of root.querySelectorAll('[data-vika-action]')) button.disabled = true;
  }

  startButton.addEventListener('click', () => {
    startButton.hidden = true;
    for (const button of root.querySelectorAll('[data-vika-action]')) button.disabled = false;
    onCheckpoint('started');
    onSound('wake');
    paintStep();
  });

  for (const button of root.querySelectorAll('[data-vika-action]')) {
    button.addEventListener('click', () => {
      if (finished) return;
      const result = resolveVikaMemory(stepIndex, button.dataset.vikaAction);
      if (!result.step) return;
      if (!result.ok) {
        stage.dataset.result = 'retry';
        output.textContent = `Вход не изменился. Но память сейчас: seen=${result.step.before.seen}, trusted=${result.step.before.trusted ? 'TRUE' : 'FALSE'}. Попробуй выбрать действие по состоянию, а не по значку.`;
        onSound('pickup');
        return;
      }

      stage.dataset.result = 'success';
      paintMemory(root, result.memory);
      output.textContent = `✓ ${result.step.actionLabel}. Память изменилась: seen=${result.memory.seen}, trusted=${result.memory.trusted ? 'TRUE' : 'FALSE'}.`;
      onSound(result.step.expectedAction === 'respond' ? 'reward' : 'pickup');
      stepIndex = result.nextStep;

      if (result.done) {
        finished = true;
        stage.dataset.step = 'won';
        setText(root, '#vikaRoundLabel', 'ПАМЯТЬ УДЕРЖАНА · 3/3');
        setText(root, '#vikaSignalGlyph', '✓');
        setText(root, '#vikaSignalName', 'ОДИН ВХОД · ТРИ РЕШЕНИЯ');
        setText(root, '#vikaSignalVar', 'state → сохранён');
        for (const node of root.querySelectorAll('[data-vika-repeat]')) node.dataset.state = 'done';
        for (const actionButton of root.querySelectorAll('[data-vika-action]')) actionButton.disabled = true;
        codeReveal.hidden = false;
        root.querySelector('#vikaStateCode').textContent = VIKA_STATE_SOURCE;
        continueButton.hidden = false;
        output.textContent = 'Ты не менял вход. Менялась память. Теперь Q-Bot показывает ту же механику как словарь состояния.';
        onCheckpoint('complete');
        onSound('wake');
        return;
      }
      paintStep(`✓ Память изменилась. Следующий вход выглядит точно так же — решение теперь должно быть другим.`);
    });
  }

  continueButton.addEventListener('click', () => {
    root.hidden = true;
    onComplete();
  });

  reset();
  return {
    open({ resume = false } = {}) {
      reset();
      root.hidden = false;
      if (resume) startButton.click();
    },
    reset,
  };
}
