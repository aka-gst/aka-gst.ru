// 19.0 · the hand-off from the first week to the professions.
//
// After the firing Витя calls: «у меня в гараже машина, её вскрывают». The
// pinned quest is FIRED.questId = 'q-garage-vitya' («Сходи в гараж к Вите»).
// When the player walks into the garage (through the apartment's door, or
// any other way) main.js calls firedHandoff() once. The garage / hacker
// profession code subscribes here and takes over:
//
//   import { onFiredHandoff } from './week-hooks.js';
//   onFiredHandoff(({ questId, corp }) => { /* start the first hacker quest */ });
//
// The same moment is also a DOM event: window 'qq:fired-handoff' with the
// same detail, for code that does not import modules.

const listeners = new Set();
let fired = null;

export function onFiredHandoff(fn) {
  if (typeof fn !== 'function') return () => {};
  listeners.add(fn);
  // Subscribed late (the hand-off already happened in this page): call now.
  if (fired) { try { fn(fired); } catch (err) { console.error(err); } }
  return () => listeners.delete(fn);
}

export function firedHandoff(detail = {}) {
  fired = { ...detail };
  for (const fn of listeners) { try { fn(fired); } catch (err) { console.error(err); } }
  try { globalThis.dispatchEvent?.(new CustomEvent('qq:fired-handoff', { detail: fired })); } catch { /* no DOM (tests) */ }
  return fired;
}

export function handoffDone() { return Boolean(fired); }
