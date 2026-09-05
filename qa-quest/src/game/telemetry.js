export function createTelemetry({ enabled = false, now = () => performance.now() } = {}) {
  const events = [];
  const started = enabled ? now() : 0;
  return {
    events,
    mark(name, value) {
      if (!enabled) return null;
      const event = {
        name: String(name),
        at: Math.max(0, Math.round(now() - started)),
      };
      if (typeof value === 'number' && Number.isFinite(value)) event.value = value;
      events.push(event);
      return event;
    },
  };
}
