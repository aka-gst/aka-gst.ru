// Isolated training match. No network, real messages, accounts, credentials or attack instructions.
// Role labels are deliberately functional placeholders, not canon names or biographies.

export const FRIEND_ROLES = Object.freeze([
  Object.freeze({
    id: 'observe',
    glyph: '◇',
    label: 'НАБЛЮДАТЕЛЬ',
    verb: 'ПРОВЕРИТЬ',
    code: 'observer.scan(event)',
  }),
  Object.freeze({
    id: 'filter',
    glyph: '⊘',
    label: 'ФИЛЬТР',
    verb: 'ОТСЕЧЬ',
    code: 'filter.block(event)',
  }),
  Object.freeze({
    id: 'restore',
    glyph: '↺',
    label: 'ВОССТАНОВЛЕНИЕ',
    verb: 'ВЕРНУТЬ',
    code: 'restorer.restore(event)',
  }),
]);

export const FRIEND_ROUNDS = Object.freeze([
  Object.freeze({ id: 'evt-01', kind: 'unknown', glyph: '◇', label: 'НЕИЗВЕСТНЫЙ ИМПУЛЬС', role: 'observe' }),
  Object.freeze({ id: 'evt-02', kind: 'noise', glyph: '⊘', label: 'ЛОЖНЫЙ ИМПУЛЬС', role: 'filter' }),
  Object.freeze({ id: 'evt-03', kind: 'break', glyph: '↺', label: 'СБОЙ ЯДРА', role: 'restore' }),
  Object.freeze({ id: 'evt-04', kind: 'noise', glyph: '⊘', label: 'ЛОЖНЫЙ ИМПУЛЬС', role: 'filter' }),
  Object.freeze({ id: 'evt-05', kind: 'unknown', glyph: '◇', label: 'НЕИЗВЕСТНЫЙ ИМПУЛЬС', role: 'observe' }),
  Object.freeze({ id: 'evt-06', kind: 'break', glyph: '↺', label: 'СБОЙ ЯДРА', role: 'restore' }),
]);

export const FRIEND_DEFENSE_SOURCE = `def defend(event):
    if event.kind == "unknown":
        observer.scan(event)
    if event.kind == "noise":
        filter.block(event)
    if event.kind == "break":
        restorer.restore(event)

for event in incoming:
    defend(event)`;

export function routePracticePacket(channel) {
  return channel === 'friends'
    ? { ok: true, text: 'ПАКЕТ ДОШЁЛ ДО ДРУЗЕЙ' }
    : { ok: false, text: 'Это общий канал. Тренировочная команда находится в другом игровом контуре.' };
}

export function resolveFriendDefense(roundIndex, roleId) {
  const round = FRIEND_ROUNDS[roundIndex];
  if (!round) return { ok: false, done: true, round: null, role: null };
  const role = FRIEND_ROLES.find((item) => item.id === roleId) ?? null;
  const ok = roleId === round.role;
  return {
    ok,
    done: ok && roundIndex === FRIEND_ROUNDS.length - 1,
    round,
    role,
    nextRound: ok ? Math.min(roundIndex + 1, FRIEND_ROUNDS.length) : roundIndex,
  };
}

function setText(root, selector, value) {
  const node = root.querySelector(selector);
  if (node) node.textContent = value;
}

export function createFriendSandbox(root, { onComplete, onSound, onCheckpoint = () => {} }) {
  const stage = root.querySelector('#chatStage');
  const output = root.querySelector('#chatOutput');
  const eventPointer = root.querySelector('#friendEventPointer');
  const roundLabel = root.querySelector('#friendRoundLabel');
  const codeReveal = root.querySelector('#friendCodeReveal');
  const continueButton = root.querySelector('#chatContinue');
  const startButton = root.querySelector('#friendStartMatch');
  let roundIndex = 0;
  let finished = false;

  function paintQueue() {
    for (const [index, node] of [...root.querySelectorAll('[data-friend-event]')].entries()) {
      node.dataset.state = index < roundIndex ? 'done' : (index === roundIndex && !finished ? 'current' : 'waiting');
      node.setAttribute('aria-current', index === roundIndex && !finished ? 'step' : 'false');
    }
  }

  function paintRound(message = 'Q-Bot держит указатель на входном событии. Выбери, какой AI-приём должен принять этот импульс.') {
    const round = FRIEND_ROUNDS[roundIndex];
    if (!round || finished) return;
    stage.dataset.step = 'match';
    setText(root, '#friendRoundLabel', `СОБЫТИЕ ${roundIndex + 1}/${FRIEND_ROUNDS.length}`);
    setText(root, '#friendEventGlyph', round.glyph);
    setText(root, '#friendEventName', round.label);
    setText(root, '#friendEventVar', `event → ${round.id}`);
    output.textContent = message;
    paintQueue();
  }

  function reset() {
    root.hidden = true;
    roundIndex = 0;
    finished = false;
    stage.dataset.step = 'briefing';
    delete stage.dataset.result;
    delete eventPointer.dataset.finished;
    codeReveal.hidden = true;
    continueButton.hidden = true;
    startButton.hidden = false;
    output.textContent = 'Три временные AI-роли уже держат тренировочный контур. Ты решаешь, кому отдать каждый входной импульс.';
    setText(root, '#friendRoundLabel', `6 ИГРОВЫХ СОБЫТИЙ · 3 AI-РОЛИ · 1 Q-BOT`);
    setText(root, '#friendEventGlyph', '◎');
    setText(root, '#friendEventName', 'ТРЕНИРОВОЧНЫЙ КОНТУР');
    setText(root, '#friendEventVar', 'event → ждёт вход');
    for (const node of root.querySelectorAll('[data-friend-event]')) node.dataset.state = 'waiting';
    for (const button of root.querySelectorAll('[data-defense-role]')) button.disabled = true;
  }

  startButton.addEventListener('click', () => {
    startButton.hidden = true;
    for (const button of root.querySelectorAll('[data-defense-role]')) button.disabled = false;
    onCheckpoint('started');
    onSound('wake');
    paintRound();
  });

  for (const button of root.querySelectorAll('[data-defense-role]')) {
    button.addEventListener('click', () => {
      if (finished) return;
      const result = resolveFriendDefense(roundIndex, button.dataset.defenseRole);
      if (!result.round) return;
      if (!result.ok) {
        output.textContent = `${result.role?.label ?? 'Этот приём'} не подходит к форме ${result.round.glyph}. Никакого штрафа — указатель остаётся на том же событии.`;
        stage.dataset.result = 'retry';
        onSound('pickup');
        return;
      }

      stage.dataset.result = 'success';
      output.textContent = `${result.round.glyph} → ${result.role.label}: ${result.role.verb}. Q-Bot передаёт указатель следующему событию.`;
      onSound(result.role.id === 'restore' ? 'wake' : 'pickup');
      roundIndex = result.nextRound;
      paintQueue();

      if (result.done) {
        finished = true;
        stage.dataset.step = 'won';
        roundLabel.textContent = 'КОНТУР УДЕРЖАН · 6/6';
        eventPointer.dataset.finished = 'true';
        setText(root, '#friendEventGlyph', '✓');
        setText(root, '#friendEventName', 'КОМАНДА СРАБОТАЛА');
        setText(root, '#friendEventVar', 'incoming → обработан');
        output.textContent = 'Победа. Сначала ты применил приёмы в мире. Теперь Q-Bot показывает программную форму того же решения.';
        codeReveal.hidden = false;
        root.querySelector('#friendDefenseCode').textContent = FRIEND_DEFENSE_SOURCE;
        continueButton.hidden = false;
        for (const roleButton of root.querySelectorAll('[data-defense-role]')) roleButton.disabled = true;
        onCheckpoint('complete');
        onSound('wake');
        return;
      }
      paintRound(`✓ ${result.round.glyph} → ${result.role.label}: ${result.role.verb}. Q-Bot передал указатель дальше.`);
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
