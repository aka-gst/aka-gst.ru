import { bootRunner, runPython } from '../runner.js';
import { validateWorldEvents } from './events.js';

const LOCAL_PYODIDE = new URL('../../vendor/pyodide/', import.meta.url).href;

function asMachineResult(result, validation = null) {
  if (result.error) return { ok: false, ...result, events: [] };
  if (validation && !validation.ok) {
    return {
      ok: false,
      ...result,
      events: [],
      error: { type: 'WorldEventError', text: validation.error, hint: null, line: null },
    };
  }
  return {
    ok: result.checks.every((check) => check.ok),
    ...result,
    events: validation?.events ?? [],
  };
}

export function prepareMachinePython() {
  return bootRunner({ base: LOCAL_PYODIDE });
}

export function isWakeSignal(stdout) {
  return typeof stdout === 'string' && stdout.trim().toLowerCase() === 'wake';
}

export function normalizeWakeSource(source) {
  if (typeof source !== 'string') return source;
  return source
    .replace(/[“”„«»]/g, '"')
    .replace(/[‘’]/g, "'");
}

export async function runWake(source) {
  const result = await runPython({
    source: normalizeWakeSource(source),
    eventVar: '',
    checks: [],
  });
  if (result.error) return asMachineResult(result);
  return asMachineResult({
    ...result,
    checks: [{
      ok: isWakeSignal(result.stdout),
      detail: `в терминале: ${JSON.stringify(result.stdout.trim())}`,
    }],
  });
}

function automationPreamble(boxIds) {
  return `
from dataclasses import dataclass

@dataclass(frozen=True)
class Box:
    id: str

boxes = [${boxIds.map((id) => `Box(${JSON.stringify(id)})`).join(', ')}]
pallet = "pallet-a"
__quest_events__ = []

class Arm:
    def move(self, box, target):
        if not isinstance(box, Box):
            raise TypeError("arm.move ждёт ящик из boxes")
        __quest_events__.append({
            "type": "arm.move",
            "boxId": box.id,
            "targetId": target,
        })

arm = Arm()
`;
}

export async function runAutomation(source, boxIds) {
  const result = await runPython({
    source,
    preamble: automationPreamble(boxIds),
    eventVar: '__quest_events__',
    checks: [{
      kind: 'py',
      expr: 'len(__quest_events__) > 0',
      detail: 'рука не получила ни одной команды',
    }],
  });
  if (result.error) return asMachineResult(result);
  const validation = validateWorldEvents(result.events, {
    arm: { awake: true },
    warehouse: {
      crates: boxIds.map((id) => ({ id, kind: 'normal', status: 'queued' })),
    },
  });
  return asMachineResult(result, validation);
}

function conditionPreamble(crates) {
  return `
from dataclasses import dataclass

@dataclass(frozen=True)
class Box:
    id: str
    kind: str

boxes = [${crates.map((crate) => `Box(${JSON.stringify(crate.id)}, ${JSON.stringify(crate.kind)})`).join(', ')}]
pallet = "pallet-a"
__quest_events__ = []

class Arm:
    def move(self, box, target):
        if not isinstance(box, Box):
            raise TypeError("arm.move ждёт ящик из boxes")
        if box.kind == "red":
            raise ValueError("красный ящик нельзя отправлять на обычную палету")
        __quest_events__.append({
            "type": "arm.move",
            "boxId": box.id,
            "targetId": target,
        })

arm = Arm()
`;
}

export async function runConditionalAutomation(source, crates) {
  const normalIds = crates.filter((crate) => crate.kind === 'normal').map((crate) => crate.id);
  const result = await runPython({
    source,
    preamble: conditionPreamble(crates),
    eventVar: '__quest_events__',
    checks: [
      {
        kind: 'source',
        pattern: '^\\s*if\\s+',
        detail: 'нужно условие if, иначе машина не отличает красный груз',
      },
      {
        kind: 'py',
        expr: `len(__quest_events__) == ${normalIds.length}`,
        detail: 'обычные ящики должны получить команду, красные — остаться на месте',
      },
    ],
  });
  if (result.error) return asMachineResult(result);
  const validation = validateWorldEvents(result.events, {
    arm: { awake: true },
    warehouse: {
      crates: normalIds.map((id) => ({ id, kind: 'normal', status: 'queued' })),
    },
  });
  if (!validation.ok) return asMachineResult(result, validation);
  if (validation.events.length !== normalIds.length) {
    return asMachineResult({
      ...result,
      error: { type: 'RuleError', text: 'Правило пропустило обычный ящик.', hint: null, line: null },
      checks: result.checks,
    });
  }
  return asMachineResult(result, validation);
}


function queuePreamble(crates) {
  return `
from dataclasses import dataclass

@dataclass(frozen=True)
class Box:
    id: str
    kind: str

__quest_events__ = []
pallet = "pallet-a"

class TraceQueue(list):
    def pop(self, index=0):
        box = super().pop(index)
        __quest_events__.append({
            "type": "trace.visit",
            "boxId": box.id,
            "kind": box.kind,
        })
        return box

queue = TraceQueue([${crates.map((crate) => `Box(${JSON.stringify(crate.id)}, ${JSON.stringify(crate.kind)})`).join(', ')}])

class Arm:
    def move(self, box, target):
        if not isinstance(box, Box):
            raise TypeError("arm.move ждёт ящик из queue")
        if box.kind == "red":
            raise ValueError("красный ящик нельзя отправлять на обычную палету")
        __quest_events__.append({
            "type": "arm.move",
            "boxId": box.id,
            "targetId": target,
        })

arm = Arm()
`;
}

export async function runQueueAutomation(source, crates) {
  const normalIds = crates.filter((crate) => crate.kind === 'normal').map((crate) => crate.id);
  const result = await runPython({
    source,
    preamble: queuePreamble(crates),
    eventVar: '__quest_events__',
    checks: [
      {
        kind: 'source',
        pattern: '^\\s*while\\s+queue\\s*:',
        detail: 'нужен while queue: — работать, пока очередь не пуста',
      },
      {
        kind: 'source',
        pattern: 'queue\\.pop\\s*\\(\\s*0\\s*\\)',
        detail: 'возьми первый ящик из очереди через queue.pop(0)',
      },
      {
        kind: 'source',
        pattern: '^\\s*if\\s+',
        detail: 'старое правило if всё ещё нужно: красный груз нельзя нести на обычную палету',
      },
      {
        kind: 'py',
        expr: 'len(queue) == 0',
        detail: 'после ночной смены очередь должна закончиться',
      },
    ],
  });
  if (result.error) return asMachineResult(result);

  const visits = result.events.filter((event) => event.type === 'trace.visit');
  const worldEvents = result.events.filter((event) => event.type === 'arm.move');
  const moved = new Set(worldEvents.map((event) => event.boxId));
  const trace = visits.map((event, index) => ({
    index,
    boxId: event.boxId,
    kind: event.kind,
    decision: moved.has(event.boxId) ? 'move' : 'skip',
  }));
  const validation = validateWorldEvents(worldEvents, {
    arm: { awake: true },
    warehouse: {
      crates: normalIds.map((id) => ({ id, kind: 'normal', status: 'queued' })),
    },
  });
  if (!validation.ok) return { ...asMachineResult(result, validation), trace };
  if (validation.events.length !== normalIds.length || visits.length !== crates.length) {
    return {
      ...asMachineResult({
        ...result,
        error: { type: 'QueueRuleError', text: 'Очередь обработана не полностью.', hint: null, line: null },
        checks: result.checks,
      }),
      trace,
    };
  }
  return { ...asMachineResult({ ...result, events: worldEvents }, { ok: true, events: validation.events }), trace };
}


function functionPreamble(crates) {
  const lineA = crates.filter((crate) => crate.line === 'A');
  const lineB = crates.filter((crate) => crate.line === 'B');
  const pyBox = (crate) => `Box(${JSON.stringify(crate.id)}, ${JSON.stringify(crate.kind)}, ${JSON.stringify(crate.line)})`;
  return `
from dataclasses import dataclass

@dataclass(frozen=True)
class Box:
    id: str
    kind: str
    line: str

__quest_events__ = []
pallet = "pallet-a"

class TraceBatch(list):
    def __init__(self, line, items):
        super().__init__(items)
        self.line = line
    def __iter__(self):
        for box in super().__iter__():
            __quest_events__.append({
                "type": "trace.visit",
                "boxId": box.id,
                "kind": box.kind,
                "line": self.line,
            })
            yield box

line_a = TraceBatch("A", [${lineA.map(pyBox).join(', ')}])
line_b = TraceBatch("B", [${lineB.map(pyBox).join(', ')}])

class Arm:
    def move(self, box, target):
        if not isinstance(box, Box):
            raise TypeError("arm.move ждёт ящик из line_a/line_b")
        if box.kind == "red":
            raise ValueError("красный ящик нельзя отправлять на обычную палету")
        __quest_events__.append({
            "type": "arm.move",
            "boxId": box.id,
            "targetId": target,
        })

arm = Arm()
`;
}

export async function runFunctionAutomation(source, crates) {
  const normalIds = crates.filter((crate) => crate.kind === 'normal').map((crate) => crate.id);
  const result = await runPython({
    source,
    preamble: functionPreamble(crates),
    eventVar: '__quest_events__',
    checks: [
      { kind: 'source', pattern: '^\\s*def\\s+route\\s*\\(', detail: 'сохрани повторяющееся поведение в функции route(batch)' },
      { kind: 'source', pattern: '^\\s*for\\s+box\\s+in\\s+batch\\s*:', detail: 'функция должна пройти по переданному batch' },
      { kind: 'source', pattern: '^\\s*if\\s+', detail: 'старое правило IF остаётся внутри функции' },
      { kind: 'source', pattern: 'route\\s*\\(\\s*line_a\\s*\\)', detail: 'подключи функцию к линии A' },
      { kind: 'source', pattern: 'route\\s*\\(\\s*line_b\\s*\\)', detail: 'подключи ту же функцию к линии B' },
      { kind: 'py', expr: `len([e for e in __quest_events__ if e.get("type") == "arm.move"]) == ${normalIds.length}`, detail: 'обе линии должны обработать все обычные ящики' },
    ],
  });
  if (result.error) return asMachineResult(result);
  const visits = result.events.filter((event) => event.type === 'trace.visit');
  const worldEvents = result.events.filter((event) => event.type === 'arm.move');
  const moved = new Set(worldEvents.map((event) => event.boxId));
  const trace = visits.map((event, index) => ({
    index,
    boxId: event.boxId,
    kind: event.kind,
    line: event.line,
    decision: moved.has(event.boxId) ? 'move' : 'skip',
  }));
  const validation = validateWorldEvents(worldEvents, {
    arm: { awake: true },
    warehouse: { crates: normalIds.map((id) => ({ id, kind: 'normal', status: 'queued' })) },
  });
  if (!validation.ok) return { ...asMachineResult(result, validation), trace };
  if (validation.events.length !== normalIds.length || visits.length !== crates.length) {
    return {
      ...asMachineResult({
        ...result,
        error: { type: 'FunctionRuleError', text: 'Функция должна одинаково обработать обе линии.', hint: null, line: null },
        checks: result.checks,
      }),
      trace,
    };
  }
  return { ...asMachineResult({ ...result, events: worldEvents }, { ok: true, events: validation.events }), trace };
}
