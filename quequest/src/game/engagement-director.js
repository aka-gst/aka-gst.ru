export const EXPLAIN_MODE_KEY = 'quequest.explain.v1';

export function normalizeExplainMode(value) {
  return value === 'compact' ? 'compact' : 'guided';
}

export function getSkillRecorderBeat(delivered, required = 3) {
  const done = Math.max(0, Math.min(required, Number(delivered) || 0));
  const copy = [
    'МАШИНА ПОКА НЕ ПОНИМАЕТ ТВОЙ МАРШРУТ',
    'ПЕРВЫЙ ПОВТОР ЗАПИСАН · СИСТЕМА СРАВНИВАЕТ ДВИЖЕНИЕ',
    'МАРШРУТ ПОВТОРЯЕТСЯ · ЕЩЁ ОДИН ПРИМЕР',
    'ПАТТЕРН ПОЙМАН · ТЕПЕРЬ ЭТО МОЖНО ОТДАТЬ МАШИНЕ',
  ][done] ?? 'ПАТТЕРН ПОЙМАН';
  return {
    done,
    required,
    complete: done >= required,
    label: `НАВЫК РУК ${done}/${required}`,
    copy,
    cells: Array.from({ length: required }, (_, index) => index < done),
  };
}

export function getManualIncomeCopy(delivered) {
  if (delivered === 1) return 'Первый маршрут записан · машина смотрит';
  if (delivered === 2) return 'Тот же путь повторился · система сравнивает';
  if (delivered >= 3) return 'Паттерн собран · теперь работу можно отдать машине';
  return 'Ящик доставлен. Ты заработал!';
}

export function getConceptBridge(scene) {
  const bridges = {
    machine: {
      world: 'КНОПКИ НЕТ',
      meaning: 'нужно отправить машине сигнал',
      python: 'print("wake")',
      question: 'Как сказать машине одно короткое сообщение?',
    },
    condition: {
      world: 'ЕСТЬ КРАСНЫЙ ГРУЗ',
      meaning: 'повторять работу, но пропускать опасный случай',
      python: 'for + if',
      question: 'Как сделать одно правило для многих объектов и исключения?',
    },
    queue: {
      world: 'КОНЕЦ НЕИЗВЕСТЕН',
      meaning: 'брать работу, пока очередь не станет пустой',
      python: 'while + list.pop',
      question: 'Как работать, если заранее неизвестно количество задач?',
    },
    function: {
      world: 'ДВЕ ОДИНАКОВЫЕ ЛИНИИ',
      meaning: 'дать одному поведению имя и использовать повторно',
      python: 'def route(batch)',
      question: 'Как не копировать один и тот же алгоритм?',
    },
  };
  return bridges[scene] ?? null;
}

export function getAdaptiveCoach({
  scene,
  carrying = false,
  manualDelivered = 0,
  machineOpen = false,
  failedAttempts = 0,
  stalledMs = 0,
  mode = 'guided',
} = {}) {
  const explain = normalizeExplainMode(mode);
  const softAt = explain === 'guided' ? 6500 : 14000;
  const directAt = explain === 'guided' ? 11500 : 24000;
  if (stalledMs < softAt && failedAttempts < 2) return null;

  if (scene === 'warehouse') {
    if (manualDelivered >= 3) return null;
    if (carrying) return {
      id: 'warehouse-drop',
      level: stalledMs >= directAt ? 2 : 1,
      title: 'Груз уже у тебя',
      text: stalledMs >= directAt
        ? 'Иди к палете на WASD и нажми E рядом с ней.'
        : 'Палета справа. Донеси ящик сам.',
    };
    return {
      id: 'warehouse-pick',
      level: stalledMs >= directAt ? 2 : 1,
      title: 'Не нужно угадывать управление',
      text: stalledMs >= directAt
        ? 'Подойди к ящику на WASD и нажми E.'
        : 'Подойди к ящику. Прицел подсветит доступное действие.',
    };
  }

  if (machineOpen && scene === 'machine') return {
    id: 'machine-signal',
    level: failedAttempts >= 3 || stalledMs >= directAt ? 2 : 1,
    title: 'Передай машине сигнал',
    text: failedAttempts >= 3 || stalledMs >= directAt
      ? 'Пример: print("wake"). Набери эту строку сам — подсказка её не подставит.'
      : 'Нужно отправить машине короткий сигнал. Попробуй написать строку сам.',
  };

  if (machineOpen && scene === 'condition') return {
    id: 'condition-builder',
    level: failedAttempts >= 2 || stalledMs >= directAt ? 2 : 1,
    title: 'Смотри на мир, не на синтаксис',
    text: failedAttempts >= 2 || stalledMs >= directAt
      ? 'Собирай сверху вниз: ДЛЯ КАЖДОГО → ЕСЛИ НЕ КРАСНЫЙ → НЕСТИ. Кнопки сами дадут правильные отступы.'
      : 'Ты уже знаешь правило мира: белые едут, красные стоят. Теперь только переведи это правило в три строки.',
  };

  if (machineOpen && scene === 'queue') return {
    id: 'queue-builder',
    level: stalledMs >= directAt ? 2 : 1,
    title: 'Очередь — просто ряд ящиков',
    text: stalledMs >= directAt
      ? 'Собирай сверху вниз: ПОКА ЕСТЬ → ВЗЯТЬ ПЕРВЫЙ → ПРОВЕРИТЬ → НЕСТИ.'
      : 'Не думай о `while` как о слове. Это обещание: “продолжай, пока работа ещё есть”.',
  };

  if (machineOpen && scene === 'function') return {
    id: 'function-builder',
    level: stalledMs >= directAt ? 2 : 1,
    title: 'Функция — это деталь с именем',
    text: stalledMs >= directAt
      ? 'Сначала назови деталь `route`, потом положи внутрь старое правило и подключи её к A и B.'
      : 'Ты ничего нового не изобретаешь: упаковываешь уже рабочий маршрут, чтобы не копировать его.',
  };

  return null;
}

export function getInterestBeat({ scene, manualDelivered = 0, learning = {} } = {}) {
  if (scene === 'warehouse' && manualDelivered === 0) return 'ACTION';
  if (scene === 'warehouse' && manualDelivered > 0 && manualDelivered < 3) return 'PATTERN';
  if (scene === 'chip') return 'DISCOVERY';
  if (scene === 'automation') return 'PAYOFF';
  if (scene === 'red-crate') return 'SURPRISE';
  if (scene === 'condition') return 'CHOICE';
  if (scene === 'queue') return 'SYSTEM';
  if (scene === 'function') return 'MASTERY';
  if (learning?.asyncUnlocked) return 'EXPANSION';
  return 'STORY';
}

export function formatPythonFailure({ errorText = '', errorHint = '', fallback = '', mode = 'guided' } = {}) {
  const normalized = normalizeExplainMode(mode);
  const primary = String(errorText || fallback || '').trim();
  const hint = String(errorHint || '').trim();
  if (normalized === 'guided' && hint) return `${primary}${primary ? ' · ' : ''}${hint}`;
  return primary;
}
