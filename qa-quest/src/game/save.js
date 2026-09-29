import { CHECKPOINTS, GAME_VERSION, STORAGE_KEY } from './config.js';

const FALLBACK = Object.freeze({ checkpoint: 'start' });

export function loadCheckpoint(storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem(STORAGE_KEY));
    if (
      parsed?.version === GAME_VERSION
      && CHECKPOINTS.includes(parsed.checkpoint)
    ) {
      return { checkpoint: parsed.checkpoint };
    }
  } catch {
    // A broken save must never stop a new run.
  }
  return { ...FALLBACK };
}

export function saveCheckpoint(storage = globalThis.localStorage, state) {
  const checkpoint = CHECKPOINTS.includes(state?.checkpoint)
    ? state.checkpoint
    : FALLBACK.checkpoint;
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify({
      version: GAME_VERSION,
      checkpoint,
    }));
    return { ok: true, operation: 'save' };
  } catch {
    return { ok: false, operation: 'save' };
  }
}

export function resetCheckpoint(storage = globalThis.localStorage) {
  try {
    storage?.removeItem(STORAGE_KEY);
    return { ok: true, operation: 'reset' };
  } catch {
    return { ok: false, operation: 'reset' };
  }
}

export function createCheckpointPersistence({
  storage = globalThis.localStorage,
  onFailure = () => {},
} = {}) {
  let warned = false;

  function report(result) {
    if (!result.ok && !warned) {
      warned = true;
      onFailure(result);
    }
    return result;
  }

  return {
    save: (state) => report(saveCheckpoint(storage, state)),
    reset: () => report(resetCheckpoint(storage)),
  };
}
