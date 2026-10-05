// Chapter 7: synthetic reliability failures only. The finale breaks assumptions in a local
// fictional pipeline; it contains no real network targets, accounts, payloads or attack steps.

export const VIRUS_FAILURES = Object.freeze([
  Object.freeze({ id: 'case-type', glyph: 'T?', label: 'НЕОЖИДАННЫЙ ТИП', detail: 'Вместо ожидаемого текста пришло число.', recovery: 'validate', recoveryLabel: 'ПРОВЕРИТЬ ТИП' }),
  Object.freeze({ id: 'case-missing', glyph: '∅', label: 'ПРОПУЩЕНО ЗНАЧЕНИЕ', detail: 'Нужного поля нет вообще.', recovery: 'fallback', recoveryLabel: 'ДАТЬ ЗАПАСНОЕ' }),
  Object.freeze({ id: 'case-timeout', glyph: '…', label: 'ТАЙМАУТ', detail: 'Шаг не ответил вовремя.', recovery: 'retry', recoveryLabel: 'ПОВТОРИТЬ ШАГ' }),
  Object.freeze({ id: 'case-order', glyph: '3↔2', label: 'НЕВЕРНЫЙ ПОРЯДОК', detail: 'Событие 3 пришло раньше события 2.', recovery: 'reorder', recoveryLabel: 'ВОССТАНОВИТЬ ПОРЯДОК' }),
]);

export const VIRUS_RESILIENCE_SOURCE = `log = []

def safe_process(event):
    try:
        validate(event)
        return process(event)
    except (TypeError, KeyError, TimeoutError, ValueError) as error:
        log.append({
            "case": event["id"],
            "error": type(error).__name__,
        })
        return recover(event, error)

for case in tests:
    safe_process(case)`;

export function resolveVirusFailure(caseIndex, recoveryId) {
  const failure = VIRUS_FAILURES[caseIndex];
  if (!failure) return { ok: false, done: true, failure: null, nextCase: caseIndex };
  const ok = recoveryId === failure.recovery;
  return {
    ok,
    done: ok && caseIndex === VIRUS_FAILURES.length - 1,
    failure,
    nextCase: ok ? Math.min(caseIndex + 1, VIRUS_FAILURES.length) : caseIndex,
  };
}

function setText(root, selector, value) {
  const node = root.querySelector(selector);
  if (node) node.textContent = value;
}

export function createVirusFinale(root, { onComplete, onSound = () => {}, onCheckpoint = () => {} }) {
  const stage = root.querySelector('#virusStage');
  const output = root.querySelector('#virusOutput');
  const startButton = root.querySelector('#virusStart');
  const continueButton = root.querySelector('#virusContinue');
  const codeReveal = root.querySelector('#virusCodeReveal');
  const logList = root.querySelector('#virusLog');
  let caseIndex = 0;
  let finished = false;

  function paintCases() {
    for (const [index, node] of [...root.querySelectorAll('[data-virus-case]')].entries()) {
      node.dataset.state = index < caseIndex ? 'recovered' : (index === caseIndex && !finished ? 'broken' : 'waiting');
      node.setAttribute('aria-current', index === caseIndex && !finished ? 'step' : 'false');
    }
  }

  function paintCase(message = 'Процесс оборвался. Не бей вирус — восстанови сломанное предположение.') {
    const failure = VIRUS_FAILURES[caseIndex];
    if (!failure || finished) return;
    stage.dataset.step = 'failure';
    setText(root, '#virusCaseLabel', `СБОЙ ${caseIndex + 1}/${VIRUS_FAILURES.length}`);
    setText(root, '#virusFailureGlyph', failure.glyph);
    setText(root, '#virusFailureName', failure.label);
    setText(root, '#virusFailureDetail', failure.detail);
    output.textContent = message;
    paintCases();
  }

  function addLog(failure) {
    const item = document.createElement('li');
    item.innerHTML = `<b>${failure.id}</b><span>${failure.label}</span><em>ВОССТАНОВЛЕНО</em>`;
    logList.append(item);
  }

  function reset() {
    root.hidden = true;
    caseIndex = 0;
    finished = false;
    stage.dataset.step = 'briefing';
    delete stage.dataset.result;
    startButton.hidden = false;
    continueButton.hidden = true;
    codeReveal.hidden = true;
    logList.replaceChildren();
    setText(root, '#virusCaseLabel', '4 СБОЯ · 0 HP · ЛОМАЮТСЯ ПРЕДПОЛОЖЕНИЯ');
    setText(root, '#virusFailureGlyph', '⚠');
    setText(root, '#virusFailureName', 'СИНТЕТИЧЕСКИЙ ПРОЦЕСС');
    setText(root, '#virusFailureDetail', 'Q-Bot запускает четыре заранее подготовленных аварийных случая.');
    output.textContent = 'Финал не про силу атаки. Он проверяет, умеет ли программа пережить вход, которого она не ожидала.';
    for (const node of root.querySelectorAll('[data-virus-case]')) node.dataset.state = 'waiting';
    for (const button of root.querySelectorAll('[data-virus-recovery]')) button.disabled = true;
  }

  startButton.addEventListener('click', () => {
    startButton.hidden = true;
    for (const button of root.querySelectorAll('[data-virus-recovery]')) button.disabled = false;
    onCheckpoint('started');
    onSound('blocked');
    paintCase();
  });

  for (const button of root.querySelectorAll('[data-virus-recovery]')) {
    button.addEventListener('click', () => {
      if (finished) return;
      const result = resolveVirusFailure(caseIndex, button.dataset.virusRecovery);
      if (!result.failure) return;
      if (!result.ok) {
        stage.dataset.result = 'retry';
        output.textContent = `${button.querySelector('strong')?.textContent ?? 'Этот приём'} не восстанавливает сбой «${result.failure.label}». Процесс остаётся остановлен, но прогресс не теряется.`;
        onSound('pickup');
        return;
      }

      stage.dataset.result = 'success';
      addLog(result.failure);
      output.textContent = `✓ ${result.failure.recoveryLabel}. Сбой записан в журнал, процесс снова продолжает работу.`;
      onSound('wake');
      caseIndex = result.nextCase;
      paintCases();

      if (result.done) {
        finished = true;
        stage.dataset.step = 'won';
        setText(root, '#virusCaseLabel', '4/4 · ПРОЦЕСС ПЕРЕЖИЛ ВСЕ СБОИ');
        setText(root, '#virusFailureGlyph', '✓');
        setText(root, '#virusFailureName', 'ПРЕДПОЛОЖЕНИЯ БОЛЬШЕ НЕ ХРУПКИЕ');
        setText(root, '#virusFailureDetail', 'Каждая поломка воспроизведена, восстановлена и записана.');
        for (const node of root.querySelectorAll('[data-virus-case]')) node.dataset.state = 'recovered';
        for (const recoveryButton of root.querySelectorAll('[data-virus-recovery]')) recoveryButton.disabled = true;
        codeReveal.hidden = false;
        root.querySelector('#virusResilienceCode').textContent = VIRUS_RESILIENCE_SOURCE;
        continueButton.hidden = false;
        output.textContent = 'Сначала ты пережил четыре аварии как игру. Теперь Q-Bot показывает их как tests → try/except → log.';
        onCheckpoint('complete');
        onSound('reward');
        return;
      }
      paintCase('✓ Предыдущий разрыв восстановлен. Следующий тест ломает уже другое предположение.');
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
