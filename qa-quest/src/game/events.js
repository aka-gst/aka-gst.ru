const EVENT_KEYS = Object.freeze(['boxId', 'targetId', 'type']);
const MAX_EVENTS = 32;

function rejection(error) {
  return { ok: false, events: [], error };
}

export function validateWorldEvents(raw, state) {
  if (!Array.isArray(raw)) return rejection('Python должен вернуть список команд.');
  if (!state?.arm?.awake) return rejection('Рука ещё не включена.');

  const available = new Set(
    (state?.warehouse?.crates ?? [])
      .filter((crate) => crate.kind === 'normal' && crate.status === 'queued')
      .map((crate) => crate.id),
  );
  if (raw.length > MAX_EVENTS || raw.length > available.size) {
    return rejection('Команд больше, чем доступных ящиков.');
  }

  const used = new Set();
  const events = [];
  for (const event of raw) {
    if (!event || typeof event !== 'object' || Array.isArray(event)) {
      return rejection('Каждая команда должна быть объектом.');
    }
    const keys = Object.keys(event).sort();
    if (keys.length !== EVENT_KEYS.length || keys.some((key, index) => key !== EVENT_KEYS[index])) {
      return rejection('В команде есть неизвестные поля.');
    }
    if (event.type !== 'arm.move') return rejection('Машина не знает такую команду.');
    if (typeof event.boxId !== 'string' || !available.has(event.boxId)) {
      return rejection('Такого ящика сейчас нет на линии.');
    }
    if (used.has(event.boxId)) return rejection('Один ящик нельзя перенести дважды.');
    if (event.targetId !== 'pallet-a') return rejection('Такой точки назначения нет.');
    used.add(event.boxId);
    events.push({ type: 'arm.move', boxId: event.boxId, targetId: 'pallet-a' });
  }

  return { ok: true, events, error: null };
}
