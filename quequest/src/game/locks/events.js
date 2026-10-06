// Крошечная шина событий замков. Сейчас её слушает только сама игра;
// задел для будущей ленты друзей: `locks:open` — устройство или шкаф открыт.
//   locksBus.on('locks:open', ({ kind, id, first, ms, route }) => ...)
export function createEmitter({ onError = (err) => console.error(err) } = {}) {
  const map = new Map();
  return {
    on(name, fn) {
      if (typeof fn !== 'function') return () => {};
      if (!map.has(name)) map.set(name, new Set());
      map.get(name).add(fn);
      return () => map.get(name)?.delete(fn);
    },
    off(name, fn) { map.get(name)?.delete(fn); },
    emit(name, payload) {
      let n = 0;
      for (const fn of [...(map.get(name) ?? [])]) { try { fn(payload); n++; } catch (err) { onError(err); } }
      return n;
    },
    count(name) { return map.get(name)?.size ?? 0; },
  };
}
export const LOCKS_OPEN = 'locks:open';
export const locksBus = createEmitter();
