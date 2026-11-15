// 20.0 · «ЧУЖОЙ МИР» — FPS-RE V14.02 (System Archaeology) as a portal.
//
// The author's FPS-RE build lies byte for byte in games/fpsre/ (games/fpsre/
// VERSION). QueQuest does not edit it: fpsre-bridge.js (the DOM half) opens it
// in a same-origin iframe and listens to the game's own EventBus
// (window.FPS_RE_DEBUG.ctx.events). This module is the pure half: which game
// events count, what they prove on the §13 grid (mastery.js) and what they pay.
//
// Floors, honestly (canon §13 — HOW you did it, not how far you got):
//   first observation of Q-Bot           → tap   («попробовал»)
//   the causal model restored (4 clues)  → knobs (you provoked the conditions by hand)
//   the bait used against Q-Bot          → knobs
//   A17: CREDENTIAL → tap · REROUTE → knobs · PATCH → code (you edited the field)
// The handoff plan said «EXPLOIT → КОД»; the bait is a button, so КОД is given
// only for PATCH. tools/fpsre-portal.test.mjs.

export const FPSRE_SRC = 'games/fpsre/index.html?v=qq201';
export const FPSRE_SKILL = 'archaeology';
export const FPSRE_SOURCE = 'fpsre';
export const FPSRE_NAME = 'ЧУЖОЙ МИР · FPS-RE';
export const FPSRE_STORE_KEY = 'quequest.fpsre.v1';

// The events the bridge subscribes to. Anything else is ignored.
export const FPSRE_EVENTS = Object.freeze([
  'SLICE_STAGE', 'ARCHAEOLOGY_OBSERVATION', 'ARCHAEOLOGY_MODEL_UNLOCKED', 'ARCHAEOLOGY_EXPLOIT', 'RE_SOLVED', 'FRAG',
]);

// One-time rewards (rubles + XP), paid once per profile.
export const FPSRE_MILESTONES = Object.freeze({
  model: Object.freeze({ id: 'model', pay: 400, xp: 150, line: 'Модель Q-Bot восстановлена: он не знает, где ты, — он помнит и слушает.' }),
  solved: Object.freeze({ id: 'solved', pay: 600, xp: 200, line: 'A17 открыт: ты дошёл до того, кто пишет поле.' }),
  complete: Object.freeze({ id: 'complete', pay: 1000, xp: 300, line: 'Маршрут пройден: угроза снята, A17 открыт, три материала доказаны.' }),
});
const SOLUTION_WAY = Object.freeze({ CREDENTIAL: 'tap', REROUTE: 'knobs', PATCH: 'code' });
const SOLUTION_RU = Object.freeze({ CREDENTIAL: 'картой', REROUTE: 'в обход питания', PATCH: 'правкой поля' });

const str = (v, n = 32) => (typeof v === 'string' ? v.slice(0, n) : '');

// A game event → what it means for QueQuest. Pure; null for anything else.
//   { proof: {skill, way, stage, source, key} | null, milestone: id | null, started: bool, line?: string, force?: bool }
export function readFpsreEvent(ev) {
  if (!ev || typeof ev !== 'object' || !FPSRE_EVENTS.includes(ev.type)) return null;
  const proof = (way, stage, key) => ({ type: 'deep:skill', skill: FPSRE_SKILL, way, stage, hints: 0, source: FPSRE_SOURCE, key });
  switch (ev.type) {
    case 'SLICE_STAGE': {
      const stage = str(ev.stage);
      if (stage === 'COMPLETE') return { proof: null, milestone: 'complete', started: true };
      return { proof: null, milestone: null, started: Boolean(stage) && stage !== 'ARRIVAL' };
    }
    case 'ARCHAEOLOGY_OBSERVATION':
      if (str(ev.target) !== 'Q-BOT') return null;
      return { proof: proof('tap', 1, 'qbot:observe'), milestone: null, started: true };
    case 'ARCHAEOLOGY_MODEL_UNLOCKED':
      if (str(ev.target) !== 'Q-BOT') return null;
      return { proof: proof('knobs', 2, 'qbot:model'), milestone: 'model', started: true };
    case 'ARCHAEOLOGY_EXPLOIT':
      if (str(ev.target) !== 'Q-BOT') return null;
      return { proof: proof('knobs', 2, 'qbot:exploit'), milestone: null, started: true };
    case 'RE_SOLVED': {
      const solution = str(ev.solution);
      const way = SOLUTION_WAY[solution];
      if (!way) return null;
      return { proof: proof(way, 2, `a17:${solution.toLowerCase()}`), milestone: 'solved', started: true, line: `A17 открыт ${SOLUTION_RU[solution]}.` };
    }
    case 'FRAG':
      return { proof: null, milestone: null, started: true, force: true };
    default:
      return null;
  }
}

const awardKey = (id) => `fpsre:${id}`;
export function fpsreDone(profile = {}) {
  return Object.keys(FPSRE_MILESTONES).filter((id) => Object.prototype.hasOwnProperty.call(profile.awards ?? {}, awardKey(id)));
}

// Pure, idempotent: the second call for the same milestone pays 0.
export function markFpsreMilestone(profile = {}, id, award) {
  const m = FPSRE_MILESTONES[id];
  if (!m) return { profile, first: false, pay: 0, xp: 0, milestone: null };
  const key = awardKey(id);
  if (Object.prototype.hasOwnProperty.call(profile.awards ?? {}, key)) return { profile, first: false, pay: 0, xp: 0, milestone: m };
  return { profile: award(profile, m.xp, key), first: true, pay: m.pay, xp: m.xp, milestone: m };
}

// The line the room shows when you surface. Knowledge is graded apart from
// force (V14.02): a Q-Bot killed before its model counts as «силой».
export function fpsreSurfaceLine({ observed = 0, model = false, forced = false, solved = null, complete = false } = {}) {
  if (complete) return FPSRE_MILESTONES.complete.line;
  if (solved) return `A17 открыт ${SOLUTION_RU[solved] ?? ''}. Дальше — баллистика.`.replace('  ', ' ');
  if (model) return FPSRE_MILESTONES.model.line;
  if (forced) return 'Q-Bot снят силой — как он думает, так и не доказано. Попробуй ещё раз: пусть увидит, спрячься, пошуми.';
  if (observed > 0) return `Улик о Q-Bot: ${Math.min(4, observed)} из 4. Видел ≠ предполагаю ≠ доказал.`;
  return 'Ты заглянул в чужой мир. Пройди коридор до зала с Q-Bot.';
}

// The desktop-only gate: the world needs a keyboard and a mouse.
export function fpsreNeedsDesktop({ fine = true, touch = false } = {}) {
  return !fine && Boolean(touch);
}
