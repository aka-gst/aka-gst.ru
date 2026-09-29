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
