// 16.8 · The seven professions as tiny deterministic simulations. The same
// function draws the showcase demo, the live scene inside a profession, and
// decides whether the day was held -- so what you see is what counts
// (tools/career-sims.test.mjs checks it against evaluateCareerRealm).

import { simGarage, GARAGE_DAYS } from './garage-night.js';

export const SIM_DAY = 8; // seconds in one "прожить решение" day

const picked = (cfg, id) => (cfg?.selected ?? []).includes(id);

// ------------------------------------------------------------ AUTO · line
// Friday: crates come in bursts of five. One station takes 0.5 s a crate.
// Without a buffer the belt holds two before crates fall off; a second
// worker helps but can't absorb a burst; "drop the extra" throws work away.
export const AUTO = Object.freeze({ bursts: [0.3, 2.8, 5.3], burst: 5, gap: 0.1, service: 0.5, belt: 2, buffer: 10 });
// 17.0 · day 2 "sale": waves of twelve. Buffer and a second worker are no
// longer enough -- it takes the robot packer (a third station) as well.
export const AUTO_DAY2 = Object.freeze({ ...AUTO, bursts: [0.3, 2.6, 4.9], burst: 12, gap: 0.08 });

function autoRun(cfg) {
  const buffer = picked(cfg, 'buffer'), worker = picked(cfg, 'worker'), robot = picked(cfg, 'robot'), drop = picked(cfg, 'drop');
  const day = cfg?.day === 2 ? 2 : 1, P = day === 2 ? AUTO_DAY2 : AUTO;
  const cap = buffer ? P.buffer : P.belt, stations = 1 + (worker ? 1 : 0) + (robot ? 1 : 0);
  const crates = [];
  for (const b of P.bursts) for (let i = 0; i < P.burst; i++) crates.push({ id: crates.length, arrive: +(b + i * P.gap).toFixed(3) });
  const busy = new Array(stations).fill(0);
  const queue = [];
  const freest = () => busy.reduce((best, v, i) => (v < busy[best] ? i : best), 0);
  const drain = (until) => {
    while (queue.length) {
      const idx = freest(), s = Math.max(busy[idx], queue[0].queued);
      if (s > until) return;
      const c = queue.shift(); c.start = s; c.end = s + P.service; c.station = idx; busy[idx] = c.end;
    }
  };
  for (const c of crates) {
    drain(c.arrive);
    const idx = busy.findIndex((b) => b <= c.arrive + 1e-9);
    if (idx >= 0 && !queue.length) { c.start = c.arrive; c.end = c.arrive + P.service; c.station = idx; busy[idx] = c.end; }
    else if (drop) c.dropped = c.arrive;
    else if (queue.length < cap) { c.queued = c.arrive; queue.push(c); }
    else c.lost = c.arrive;
  }
  drain(Infinity);
  return { crates, cap, stations, buffer, worker, robot, drop, day };
}

export function simAutomation(cfg, t) {
  const run = autoRun(cfg);
  const at = (v) => v !== undefined && v <= t;
  const served = run.crates.filter((c) => at(c.end)).length;
  const lost = run.crates.filter((c) => at(c.lost)).length;
  const dropped = run.crates.filter((c) => at(c.dropped)).length;
  const lostDay = run.crates.filter((c) => c.lost !== undefined).length;
  const droppedDay = run.crates.filter((c) => c.dropped !== undefined).length;
  const servedDay = run.crates.filter((c) => c.end !== undefined && c.end <= SIM_DAY).length;
  return { ...run, t, served, lost, dropped, ok: lostDay === 0 && droppedDay === 0 && servedDay === run.crates.length };
}

// ---------------------------------------------------------- VEH · garage
// 17.1 · The garage is driven by code: commands cross the bus, the player's
// Python rule in the gateway decides each one, then a red-team barrage tests
// the rule on commands it has never seen. cfg.rule is the source, cfg.day
// the garage day. See garage-night.js.
export function simVehicle(cfg, t) {
  return simGarage({ ...cfg, rule: cfg?.rule ?? GARAGE_DAYS[0].starter, day: cfg?.day ?? 1 }, t);
}

// ------------------------------------------------------ SEC · own server
// Night. Players and a synthetic red team walk to the server. Explicit roles
// stop the red team at the gate, but some of them take the side way round --
// only negative tests find and close it. Switching the server off stops the
// raid and every normal player too.
export const SEC = Object.freeze({
  actors: ['player', 'raid', 'player', 'raid', 'bypass', 'player', 'raid', 'bypass'],
  every: 0.8, first: 0.3, toGate: 1.2, gateToServer: 0.8, bypassToServer: 2.0,
});

export function simSecurity(cfg, t) {
  const roles = picked(cfg, 'roles'), negative = picked(cfg, 'negative'), shutdown = picked(cfg, 'shutdown');
  const actors = SEC.actors.map((kind, id) => {
    const t0 = SEC.first + id * SEC.every;
    const a = { id, kind, t0, path: kind === 'bypass' ? 'bypass' : 'main' };
    if (kind === 'bypass') {
      if (negative) { a.stoppedAt = t0 + SEC.bypassToServer * 0.55; a.stop = 'test'; }
      else a.atServer = t0 + SEC.bypassToServer;
    } else if (kind === 'raid' && roles) { a.stoppedAt = t0 + SEC.toGate; a.stop = 'gate'; }
    else a.atServer = t0 + SEC.toGate + SEC.gateToServer;
    if (a.atServer !== undefined && shutdown) { a.stoppedAt = a.atServer; a.stop = 'offline'; a.bounced = true; }
    return a;
  });
  const hostile = (a) => a.kind !== 'player';
  const reached = (a, when) => a.atServer !== undefined && !a.bounced && a.atServer <= when;
  const breaches = actors.filter((a) => hostile(a) && reached(a, t)).length;
  const refused = actors.filter((a) => a.kind === 'player' && a.bounced && a.stoppedAt <= t).length;
  const served = actors.filter((a) => a.kind === 'player' && reached(a, t)).length;
  const breachesDay = actors.filter((a) => hostile(a) && reached(a, Infinity)).length;
  const refusedDay = actors.filter((a) => a.kind === 'player' && a.bounced).length;
  return { t, actors, roles, negative, shutdown, breaches, refused, served, ok: breachesDay === 0 && refusedDay === 0 };
}

// ---------------------------------------------------- WEB · micro-service
// A sales day with a rush from 2 s to 5 s. Readers are served by the read
// path (3/s, 8/s with a cache) and leave after a second in line. Orders go to
// one order worker (1 s each); without a queue an order that finds it busy is
// lost. The banner costs a token and changes nothing.
export const WEB = Object.freeze({ rush: [2, 5], calm: 2, peak: 8, until: 7, read: 3, readCached: 8, patience: 1.0, order: 1.0, price: 450 });

function webUsers() {
  const users = [];
  let t = 0.2;
  while (t < WEB.until) {
    const i = users.length;
    users.push({ id: i, arrive: +t.toFixed(3), kind: [2, 5, 8].includes(i % 10) ? 'order' : 'read' });
    t += 1 / (t >= WEB.rush[0] && t < WEB.rush[1] ? WEB.peak : WEB.calm);
  }
  return users;
}

export function simWeb(cfg, t) {
  const cache = picked(cfg, 'cache'), queue = picked(cfg, 'queue'), banner = picked(cfg, 'banner');
  const users = webUsers();
  const readService = 1 / (cache ? WEB.readCached : WEB.read);
  let readFree = 0, orderFree = 0;
  for (const u of users) {
    if (u.kind === 'read') {
      const start = Math.max(readFree, u.arrive);
      if (start - u.arrive > WEB.patience) { u.left = u.arrive + WEB.patience; continue; }
      u.start = start; u.done = start + readService; readFree = u.done;
    } else {
      if (!queue && orderFree > u.arrive) { u.dropped = u.arrive; continue; }
      const start = Math.max(orderFree, u.arrive);
      u.start = start; u.done = start + WEB.order; orderFree = u.done;
    }
  }
  const at = (v) => v !== undefined && v <= t;
  const left = users.filter((u) => at(u.left)).length;
  const dropped = users.filter((u) => at(u.dropped)).length;
  const sold = users.filter((u) => u.kind === 'order' && at(u.done)).length;
  const leftDay = users.filter((u) => u.left !== undefined).length;
  const droppedDay = users.filter((u) => u.dropped !== undefined).length;
  return { t, users, cache, queue, banner, left, dropped, sold, revenue: sold * WEB.price, ok: leftDay === 0 && droppedDay === 0 };
}

// --------------------------------------------------------- AI · Q-Bot
// Two similar cats and Q-Bot "knows everything". A counterexample and the
// right to say "don't know" calibrate it; more authority only makes it louder.
// Confidence follows stepCareerSession exactly.
export const AI = Object.freeze({ base: 92, examplesAt: 2.2, abstainAt: 3.2, unknownAt: 5.0, answerAt: 5.8, abstainBelow: 75 });

export function aiConfidence(cfg) {
  let c = AI.base;
  if (picked(cfg, 'examples')) c = Math.max(55, c - 18);
  if (picked(cfg, 'abstain')) c = Math.max(45, c - 12);
  if (picked(cfg, 'authority')) c = Math.min(99, c + 6);
  return c;
}

export function simAi(cfg, t) {
  const examples = picked(cfg, 'examples'), abstain = picked(cfg, 'abstain'), authority = picked(cfg, 'authority');
  const final = aiConfidence(cfg);
  // Confidence over the day: starts at base, moves as the lessons land.
  let confidence = AI.base;
  if (examples && t >= AI.examplesAt) confidence = Math.max(55, confidence - 18);
  if (abstain && t >= AI.abstainAt) confidence = Math.max(45, confidence - 12);
  if (authority && t >= AI.examplesAt) confidence = Math.min(99, confidence + 6);
  const saysDontKnow = abstain && final < AI.abstainBelow && !authority;
  const answer = saysDontKnow ? 'dontknow' : authority ? 'acts' : 'guess';
  return {
    t, examples, abstain, authority, confidence, final,
    unknownShown: t >= AI.unknownAt, answered: t >= AI.answerAt ? answer : null,
    ok: answer === 'dontknow',
  };
}

// ------------------------------------------------------ SYS · city graph
// One shared node wobbles. Service A really needs it; B–E only share its
// pool. Without bulkheads the failure spreads to all five; a fallback path
// alone gets dragged down too; a retry storm kills the node early and floods
// even isolated pools.
export const SYS = Object.freeze({ services: ['A', 'B', 'C', 'D', 'E'], fail: 2.5, failStorm: 1.2 });

export function simSystems(cfg, t) {
  const isolate = picked(cfg, 'isolate'), fallback = picked(cfg, 'fallback'), retry = picked(cfg, 'retry');
  const tFail = retry ? SYS.failStorm : SYS.fail;
  const services = SYS.services.map((name, i) => {
    const s = { name, i };
    if (retry) { s.redAt = tFail + (i === 0 ? 0.5 : 1.3 + 0.4 * i); }
    else if (isolate) { if (i === 0) { if (fallback) s.yellowAt = tFail + 0.4; else s.redAt = tFail + 0.5; } }
    else if (fallback) { s.yellowAt = tFail + 0.3 * i; s.redAt = tFail + 1.5 + 0.5 * i; }
    else s.redAt = tFail + 0.5 * (i + 1);
    return s;
  });
  const state = (s, when) => (s.redAt !== undefined && s.redAt <= when ? 'red' : s.yellowAt !== undefined && s.yellowAt <= when ? 'yellow' : 'green');
  const now = services.map((s) => state(s, t));
  const day = services.map((s) => state(s, SIM_DAY));
  return {
    t, isolate, fallback, retry, tFail, services, states: now,
    nodeDown: t >= tFail, red: now.filter((x) => x === 'red').length,
    ok: day.filter((x) => x === 'red').length <= 1,
  };
}

// -------------------------------------------------- LOW · unknown machine
export function simLowlevel(cfg, t, since = 0) {
  const bits = (cfg?.bits ?? [0, 0, 0, 0]).map((b) => (b ? 1 : 0));
  const ok = bits.join('') === '0011';
  return { t, bits, ok, open: ok ? Math.min(1, Math.max(0, (t - since) / 1.2)) : 0 };
}

export const SIMS = Object.freeze({
  automation: simAutomation, vehicle: simVehicle, security: simSecurity, web: simWeb,
  ai: simAi, systems: simSystems, lowlevel: simLowlevel,
});

export function simulateRealm(id, cfg, t) {
  const sim = SIMS[id];
  return sim ? sim(cfg ?? {}, t) : null;
}

// ------------------------------------------------------------ the demos
// Each showcase demo is the profession's own choices: the tempting bad move
// and what it does, then the good move and the result.
const seg = (selected, ms, caption, tone, bits) => Object.freeze({ cfg: Object.freeze({ selected: Object.freeze(selected), ...(bits ? { bits: Object.freeze(bits) } : {}) }), ms, caption, tone });

export const PREVIEW_SCRIPTS = Object.freeze({
  automation: [
    seg([], 3600, 'ПЯТНИЦА. ПОТОК ВДВОЕ. ЯЩИКИ ПАДАЮТ.', 'bad'),
    seg(['drop'], 3000, 'СБРАСЫВАТЬ ЛИШНЕЕ? ЭТО РАБОТА В МУСОР.', 'bad'),
    seg(['buffer', 'worker'], 5200, 'БУФЕР + ВТОРОЙ РАБОЧИЙ: НОЛЬ ПОТЕРЬ.', 'good'),
  ],
  vehicle: [
    Object.freeze({ cfg: Object.freeze({ rule: 'print("ПРОПУСТИТЬ")' }), ms: 4600, caption: 'ШЛЮЗ ПУСКАЕТ ВСЁ: ЧУЖОЙ ОТКРЫЛ МАШИНУ.', tone: 'bad' }),
    Object.freeze({ cfg: Object.freeze({ rule: 'print("БЛОК")' }), ms: 3000, caption: 'ВСЁ В БЛОК? ХОЗЯИН ТОЖЕ НЕ ВОЙДЁТ.', tone: 'bad' }),
    Object.freeze({ cfg: Object.freeze({ rule: GARAGE_DAYS[0].solution }), ms: 6400, caption: 'IF KEY == "OWNER": ЧУЖИЕ РАЗЛЕТАЮТСЯ.', tone: 'good' }),
  ],
  security: [
    seg([], 4200, 'НОЧЬ. КРАСНАЯ КОМАНДА ИДЁТ НА СЕРВЕР.', 'bad'),
    seg(['shutdown'], 3400, 'ВЫКЛЮЧИЛ СЕРВЕР? СВОИ ТОЖЕ НЕ ВОЙДУТ.', 'bad'),
    seg(['roles', 'negative'], 6400, 'РОЛИ + ТЕСТЫ: ШТУРМ НЕ ПРОШЁЛ.', 'good'),
  ],
  web: [
    seg([], 5200, 'НАПЛЫВ. САЙТ ТОРМОЗИТ, ЛЮДИ УХОДЯТ.', 'bad'),
    seg(['banner'], 3000, 'КРАСИВЫЙ БАННЕР. ЛЮДИ ВСЁ РАВНО УХОДЯТ.', 'bad'),
    seg(['cache', 'queue'], 6400, 'КЭШ + ОЧЕРЕДЬ: ДЕНЬ ВЫДЕРЖАН.', 'good'),
  ],
  ai: [
    seg(['authority'], 6600, 'ДАЛ ПРАВА: УВЕРЕН НА 98% — И НЕ ПРАВ.', 'bad'),
    seg(['examples', 'abstain'], 6600, 'КОНТРПРИМЕР + «НЕ ЗНАЮ»: ЧЕСТНЫЙ ОТВЕТ.', 'good'),
  ],
  systems: [
    seg(['retry'], 5000, 'ВСЕ ПОВТОРЯЮТ БЫСТРЕЕ: ГОРОД ЛЁГ.', 'bad'),
    seg(['isolate', 'fallback'], 6400, 'ПЕРЕБОРКИ + РЕЗЕРВ: ДЕРЖИТСЯ ГОРОД.', 'good'),
  ],
  lowlevel: [
    seg([], 2400, 'ДВЕРЬ ЖДЁТ 0011.', 'neutral', [0, 0, 0, 0]),
    seg(['bit1'], 2000, 'НЕ ТОТ БИТ: 0010.', 'bad', [0, 0, 1, 0]),
    seg(['bit0', 'bit1'], 4200, 'ПОНЯЛ МАШИНУ: 0011. ДВЕРЬ ОТКРЫТА.', 'good', [0, 0, 1, 1]),
  ],
});

export function previewLength(id) {
  return (PREVIEW_SCRIPTS[id] ?? []).reduce((n, s) => n + s.ms, 0);
}

// Where the looping demo is at `ms`: the segment, its config and seconds into it.
export function previewAt(id, ms) {
  const script = PREVIEW_SCRIPTS[id];
  if (!script?.length) return null;
  const total = previewLength(id);
  let m = ((ms % total) + total) % total;
  for (let i = 0; i < script.length; i++) {
    if (m < script[i].ms) return { index: i, cfg: script[i].cfg, t: m / 1000, k: m / script[i].ms, caption: script[i].caption, tone: script[i].tone };
    m -= script[i].ms;
  }
  const last = script.at(-1);
  return { index: script.length - 1, cfg: last.cfg, t: last.ms / 1000, k: 1, caption: last.caption, tone: last.tone };
}

// What the profession looks like from the outside: one line of fantasy,
// what you will do, what it is in real life.
export const CAREER_PITCH = Object.freeze({
  automation: { fantasy: 'Цех работает, пока ты думаешь.', verbs: ['ставить буферы и рабочих', 'видеть, где копится затор', 'не выбрасывать работу'], life: 'Автоматизация: очереди, параллельная обработка, скрипты, которые делают рутину за людей.', deep: 'Дальше — Pythonio: граф машин, правила, файлы, таблицы, API.' },
  vehicle: { fantasy: 'Твой код стоит между машиной и улицей.', verbs: ['читать перехват команд на шине', 'писать правило шлюза на Python', 'штурмовать свою же машину red-team-ом'], life: 'Безопасность машин: кто и чем может командовать автомобилем — только своя учебная машина.', deep: 'Дни: чужая команда → магнитола → отмычка. Потом брелок, сервисный порт, прошивка.' },
  security: { fantasy: 'Ночью ломятся — и не проходят.', verbs: ['строить границы ролей', 'писать проверки на запретное', 'штурмовать свою же защиту'], life: 'Кибербезопасность своего сервиса: роли, тесты, red-team — только своё и учебное.', deep: 'Дальше — tower defense своего сервера.' },
  web: { fantasy: 'Магазин держит наплыв.', verbs: ['делить бюджет', 'ставить кэш и очереди', 'проживать день продаж'], life: 'Веб и бэкенд: нагрузка, кэш, очереди — и деньги, которые они приносят.', deep: 'Дальше — тайкун сервиса: дни, наплывы, отзывы.' },
  ai: { fantasy: 'Питомец, которого ты учишь.', verbs: ['давать контрпримеры', 'учить говорить «не знаю»', 'не путать права со знанием'], life: 'Машинное обучение: данные, уверенность, честные ошибки модели.', deep: 'Дальше — комната Q-Bot, Иной разум и Вика.' },
  systems: { fantasy: 'Один узел падает — город стоит.', verbs: ['видеть зависимости', 'ставить переборки и резерв', 'гасить шторм повторов'], life: 'Надёжность систем: каскады, резервы, отказоустойчивость.', deep: 'Дальше — карта города-сервисов.' },
  lowlevel: { fantasy: 'Понять машину без инструкции.', verbs: ['щёлкать биты', 'находить нужное состояние', 'открывать двери сигналом'], life: 'Низкий уровень: биты, память, устройства, микроконтроллеры.', deep: 'Дальше — сигналы, память и устройства.' },
});
