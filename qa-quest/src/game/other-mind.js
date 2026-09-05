const CAPABILITY_KEYS = Object.freeze(['capability', 'mission', 'type', 'version']);
const SAFE_FALLBACK = 'Разум сейчас молчит. Рука всё равно тебя услышала.';
const DEFAULT_REPLY = 'Я слышу машину. Теперь научи меня понимать её.';

const MACHINE_LISTENING_EVENT = Object.freeze({
  version: 1,
  type: 'capability.unlocked',
  capability: 'machine-listening',
  mission: 'warehouse-arm',
});

const SYSTEM_PROMPT = 'Ты — только что проснувшееся семя иного разума. Ответь одной короткой фразой без команд, файлов и личных данных.';

function reject(error = 'unknown-capability-event') {
  return { ok: false, event: null, error };
}

export function createMachineListeningEvent() {
  return { ...MACHINE_LISTENING_EVENT };
}

export function validateCapabilityEvent(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return reject();
  if (Object.getPrototypeOf(raw) !== Object.prototype) return reject();
  const keys = Object.keys(raw).sort();
  if (keys.length !== CAPABILITY_KEYS.length || keys.some((key, index) => key !== CAPABILITY_KEYS[index])) {
    return reject();
  }
  for (const [key, value] of Object.entries(MACHINE_LISTENING_EVENT)) {
    if (raw[key] !== value) return reject();
  }
  return { ok: true, event: createMachineListeningEvent(), error: null };
}

function createTulpaRequest(event) {
  return {
    model: 'local-fake-other-mind',
    stream: true,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Открыта способность ${event.capability} в миссии ${event.mission}.`,
      },
    ],
  };
}

function sameRequest(raw, expected) {
  return JSON.stringify(raw) === JSON.stringify(expected);
}

function splitReply(reply, chunks) {
  const count = Math.max(1, Math.min(String(reply).length || 1, Math.floor(chunks) || 1));
  const size = Math.ceil(String(reply).length / count);
  return Array.from({ length: count }, (_, index) => String(reply).slice(index * size, (index + 1) * size))
    .filter(Boolean);
}

export function createFakeGateway({
  fail = false,
  reply = DEFAULT_REPLY,
  chunks = 3,
  delay = 0,
} = {}) {
  let calls = 0;
  let lastRequest = null;
  return {
    async *stream(request) {
      const expected = createTulpaRequest(MACHINE_LISTENING_EVENT);
      if (!sameRequest(request, expected)) throw new Error('request-rejected');
      calls += 1;
      lastRequest = structuredClone(request);
      if (fail) throw new Error('gateway-unavailable');
      for (const chunk of splitReply(reply, chunks)) {
        if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
        yield chunk;
      }
    },
    snapshot() {
      return {
        calls,
        lastRequest: lastRequest ? structuredClone(lastRequest) : null,
      };
    },
  };
}

export function createOtherMindRuntime({ gateway, onTransition = () => {} }) {
  if (!gateway || typeof gateway.stream !== 'function') throw new TypeError('gateway.stream is required');
  let events = 0;
  let gatewayCalls = 0;
  let phase = 'sleeping';
  let line = '';
  let consumed = false;
  let inFlight = null;
  const transitions = ['sleeping'];

  function emit(nextPhase, nextLine = line) {
    phase = nextPhase;
    line = nextLine;
    if (transitions.at(-1) !== nextPhase) transitions.push(nextPhase);
    onTransition({ phase, line });
  }

  function snapshot() {
    return {
      events,
      gatewayCalls,
      transitions: [...transitions],
      phase,
      line,
    };
  }

  async function perform(event) {
    events += 1;
    gatewayCalls += 1;
    emit('waking', '');
    try {
      let response = '';
      for await (const chunk of gateway.stream(createTulpaRequest(event))) {
        response += String(chunk);
        emit('waking', response);
      }
      emit('awake', response || DEFAULT_REPLY);
      return { ok: true, duplicate: false, phase, line };
    } catch {
      emit('silent', SAFE_FALLBACK);
      return {
        ok: false,
        duplicate: false,
        phase,
        line,
        error: 'gateway-unavailable',
      };
    }
  }

  return {
    unlock(raw) {
      const validation = validateCapabilityEvent(raw);
      if (!validation.ok) {
        return Promise.resolve({
          ok: false,
          duplicate: false,
          phase,
          line,
          error: validation.error,
        });
      }
      if (inFlight) return inFlight.then((result) => ({ ...result, duplicate: true }));
      if (consumed) {
        return Promise.resolve({
          ok: phase === 'awake',
          duplicate: true,
          phase,
          line,
          ...(phase === 'awake' ? {} : { error: 'gateway-unavailable' }),
        });
      }
      consumed = true;
      inFlight = perform(validation.event).finally(() => { inFlight = null; });
      return inFlight;
    },
    snapshot,
  };
}
