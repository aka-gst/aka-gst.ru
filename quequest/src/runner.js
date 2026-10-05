/*
 * Мост между интерфейсом и воркером с Python.
 * Наружу отдаёт три вещи: состояние загрузки, запуск кода и аварийную остановку.
 */

const SOFT_LIMIT = 8;      // секунд на код ученика, следит трассировщик внутри Python
const HARD_LIMIT = 30000;  // мс до принудительного перезапуска воркера

export const runner = {
  status: 'idle',          // idle | loading | ready | failed
  version: null,
  message: '',
};

const listeners = new Set();
let worker = null;
let readyPromise = null;
let counter = 0;
const pending = new Map();

function unavailableResult(message, checks = []) {
  return {
    stdout: '',
    events: [],
    error: {
      type: 'PythonUnavailable',
      text: message || 'Python не загрузился.',
      hint: 'Проверь соединение и попробуй запустить ещё раз.',
      line: null,
    },
    checks: checks.map(() => ({ ok: false, detail: '' })),
    ms: 0,
  };
}

function failPending(message) {
  pending.forEach(({ resolve, timer, checks }) => {
    clearTimeout(timer);
    resolve(unavailableResult(message, checks));
  });
  pending.clear();
}

export function onRunnerChange(callback) {
  listeners.add(callback);
  callback(runner);
  return () => listeners.delete(callback);
}

function emit(patch) {
  Object.assign(runner, patch);
  listeners.forEach((callback) => callback(runner));
}

function createWorker() {
  const instance = new Worker(new URL('./pyworker.js', import.meta.url), { type: 'module' });
  instance.onmessage = (event) => {
    const message = event.data || {};
    if (message.type === 'progress') {
      emit({ status: 'loading', message: message.text });
      return;
    }
    if (message.type === 'ready') {
      emit({ status: 'ready', version: message.version, message: '' });
      return;
    }
    if (message.type === 'fatal') {
      emit({ status: 'failed', message: message.message });
      failPending(message.message);
      return;
    }
    if (message.type === 'result') {
      const entry = pending.get(message.id);
      if (!entry) return;
      clearTimeout(entry.timer);
      pending.delete(message.id);
      entry.resolve(message.result);
    }
  };
  instance.onerror = (event) => {
    const message = event.message || 'воркер не запустился';
    emit({ status: 'failed', message });
    failPending(message);
  };
  return instance;
}

export function bootRunner(config = {}) {
  if (readyPromise) return readyPromise;
  emit({ status: 'loading', message: 'Готовлю Python' });
  worker = createWorker();
  if (Object.keys(config).length) worker.postMessage({ type: 'configure', config });
  worker.postMessage({ type: 'init' });
  readyPromise = new Promise((resolve) => {
    const stop = onRunnerChange((state) => {
      if (state.status === 'ready' || state.status === 'failed') {
        queueMicrotask(stop);
        resolve(state.status === 'ready');
      }
    });
  });
  return readyPromise;
}

/** Жёсткий перезапуск: спасает от зависаний, которые трассировщик поймать не может. */
export function restartRunner() {
  if (worker) worker.terminate();
  worker = null;
  readyPromise = null;
  pending.clear();
  emit({ status: 'idle', message: '' });
  return bootRunner();
}

export async function runPython({ source, preamble = '', checks = [], stdin = [], eventVar = '__quest_events__' }) {
  const ready = await bootRunner();
  if (!ready) return unavailableResult(runner.message, checks);
  const id = ++counter;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      restartRunner();
      resolve({
        stdout: '',
        events: [],
        error: {
          type: 'Timeout',
          text: 'Python пришлось перезапустить: код не ответил вовремя.',
          hint: 'Проверь бесконечные циклы и слишком тяжёлые вычисления.',
          line: null,
        },
        checks: checks.map(() => ({ ok: false, detail: '' })),
        ms: HARD_LIMIT,
      });
    }, HARD_LIMIT);
    pending.set(id, { resolve, timer, checks });
    worker.postMessage({ type: 'run', id, source, preamble, checks, stdin, eventVar, timeLimit: SOFT_LIMIT });
  });
}
