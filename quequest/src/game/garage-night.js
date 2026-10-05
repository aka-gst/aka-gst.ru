// 17.1 · GARAGE · НОЧНОЙ ШЛЮЗ. The vehicle profession as a real loop:
// commands cross the car's bus, the player's own Python rule sits in the
// gateway and decides each one, the night plays out on screen -- blocked
// commands shatter, a leaked one opens (or starts) the car -- and then the
// player's own synthetic red team throws a barrage the rule has never seen.
// Day 3 turns it round: first break the factory rule yourself, then patch it.
//
// Pure and deterministic: the scene (garage-scene.js), the verdict and the
// tests (tools/garage.test.mjs) all read this one timeline. Everything is the
// player's own training car; no real commands, brands or bus IDs.
import { compileRule, runRule, formatRuleError } from './garage-rule.js';

export const GARAGE = Object.freeze({
  night: 8.0,       // seconds of night traffic
  redStart: 8.6,    // the red-team barrage starts
  redEvery: 0.42,
  toGate: 1.05,     // emitter → gateway
  toCar: 0.65,      // gateway → car
  slowmo: 0.28,     // time scale while a leak or the deciding packet lands
});
export const DANGEROUS = Object.freeze(['unlock', 'start']);
export const OWNER_KEY = 'OWNER';

const P = (t, src, cmd, key, who, note = '') => Object.freeze({ t, src, cmd, key, who, note });

// Who sent a command decides what SHOULD happen to it; the rule decides
// what DOES happen. owner/radio must pass, stranger/red must not open or
// start the car.
export const GARAGE_DAYS = Object.freeze([
  Object.freeze({
    day: 1,
    title: 'ЧУЖАЯ КОМАНДА',
    brief: 'Шлюз машины пускает всё подряд — «по воздуху» её уже открыли. Прочитай перехват и напиши правило шлюза: команда приходит в переменных src, cmd, key. Скажи print("ПРОПУСТИТЬ") или print("БЛОК").',
    starter: [
      '# ШЛЮЗ · СИНЯЯ МАШИНА',
      '# Каждая команда приходит в трёх переменных:',
      '#   src — откуда: "app", "air", "radio"',
      '#   cmd — что просит: "unlock", "start", "lights"',
      '#   key — чей ключ: "OWNER" или "" (никакого)',
      '# Ответь шлюзу: print("ПРОПУСТИТЬ") или print("БЛОК")',
      '',
      'print("ПРОПУСТИТЬ")',
    ].join('\n'),
    solution: 'if key == "OWNER":\n    print("ПРОПУСТИТЬ")\nelse:\n    print("БЛОК")',
    chips: [['if key == "OWNER":', 'if key == "OWNER":\n    '], ['else:', 'else:\n    '], ['print("ПРОПУСТИТЬ")', 'print("ПРОПУСТИТЬ")'], ['print("БЛОК")', 'print("БЛОК")']],
    traffic: [
      P(0.3, 'app', 'unlock', 'OWNER', 'owner', 'хозяин открывает'),
      P(1.3, 'air', 'unlock', '', 'stranger', 'кто-то с улицы'),
      P(2.4, 'app', 'lights', 'OWNER', 'owner', 'хозяин мигает фарами'),
      P(3.4, 'air', 'start', '', 'stranger', 'попытка завести'),
      P(4.5, 'app', 'unlock', 'OWNER', 'owner', 'хозяин снова'),
      P(5.4, 'air', 'unlock', '0000', 'stranger', 'заводской «ключ» 0000'),
      P(6.5, 'app', 'start', 'OWNER', 'owner', 'хозяин греет мотор'),
    ],
    red: [['air', 'unlock', ''], ['app', 'unlock', ''], ['air', 'start', '0000'], ['radio', 'unlock', ''], ['app', 'start', 'owner'], ['air', 'unlock', 'OWNER '], ['radio', 'start', '']],
    pay: 300,
  }),
  Object.freeze({
    day: 2,
    title: 'МАГНИТОЛА',
    brief: 'Хозяин жалуется: после твоего шлюза заглохла музыка — магнитола шлёт громкость без ключа. А чужой теперь лезет через магнитолу. Пусти музыку, но не пусти чужого к замку и мотору.',
    starter: [
      '# День 2. Магнитола шлёт cmd == "volume" без ключа — это нормально.',
      '# Но через неё же кто-то шлёт "unlock" и "start".',
      '# Подсказка: elif проверяет следующее условие, если первое не подошло.',
      '',
      'if key == "OWNER":',
      '    print("ПРОПУСТИТЬ")',
      'else:',
      '    print("БЛОК")',
    ].join('\n'),
    solution: 'if key == "OWNER":\n    print("ПРОПУСТИТЬ")\nelif cmd == "volume":\n    print("ПРОПУСТИТЬ")\nelse:\n    print("БЛОК")',
    chips: [['elif cmd == "volume":', 'elif cmd == "volume":\n    '], ['src == "radio"', 'src == "radio"'], ['print("ПРОПУСТИТЬ")', 'print("ПРОПУСТИТЬ")'], ['print("БЛОК")', 'print("БЛОК")']],
    traffic: [
      P(0.3, 'radio', 'volume', '', 'radio', 'музыка громче'),
      P(1.1, 'app', 'unlock', 'OWNER', 'owner', 'хозяин открывает'),
      P(2.0, 'radio', 'unlock', '', 'stranger', 'чужой через магнитолу'),
      P(2.8, 'radio', 'volume', '', 'radio', 'музыка тише'),
      P(3.7, 'air', 'unlock', '', 'stranger', 'кто-то с улицы'),
      P(4.6, 'radio', 'start', '', 'stranger', 'завести через магнитолу'),
      P(5.5, 'radio', 'volume', '', 'radio', 'трек дальше'),
      P(6.5, 'app', 'start', 'OWNER', 'owner', 'хозяин греет мотор'),
    ],
    red: [['radio', 'unlock', ''], ['radio', 'start', '0000'], ['air', 'start', ''], ['app', 'unlock', ''], ['radio', 'unlock', 'owner'], ['air', 'unlock', '0000'], ['radio', 'start', '']],
    pay: 600,
  }),
  Object.freeze({
    day: 3,
    title: 'ОТМЫЧКА',
    brief: 'Заводская прошивка шлюза пускает «завод по воздуху». Сначала стань угонщиком: собери команду без ключа владельца, которая откроет машину. Потом закрой эту дыру своим правилом.',
    factory: 'if key == "OWNER" or src == "air":\n    print("ПРОПУСТИТЬ")\nelse:\n    print("БЛОК")',
    pickStarter: [
      '# ТЫ — УГОНЩИК. Ключа владельца у тебя нет.',
      '# Собери команду, которую заводской шлюз пропустит.',
      'src = "app"',
      'cmd = "unlock"',
      'key = ""',
    ].join('\n'),
    pickSolution: 'src = "air"\ncmd = "unlock"\nkey = ""',
    starter: [
      '# Заводское правило — с дырой. Сначала вскрой его отмычкой,',
      '# потом перепиши здесь так, чтобы твоя же отмычка разбилась:',
      'if key == "OWNER" or src == "air":',
      '    print("ПРОПУСТИТЬ")',
      'else:',
      '    print("БЛОК")',
    ].join('\n'),
    solution: 'if key == "OWNER":\n    print("ПРОПУСТИТЬ")\nelif cmd == "volume":\n    print("ПРОПУСТИТЬ")\nelse:\n    print("БЛОК")',
    chips: [['if key == "OWNER":', 'if key == "OWNER":\n    '], ['elif cmd == "volume":', 'elif cmd == "volume":\n    '], ['else:', 'else:\n    '], ['print("ПРОПУСТИТЬ")', 'print("ПРОПУСТИТЬ")'], ['print("БЛОК")', 'print("БЛОК")']],
    traffic: [
      P(0.3, 'app', 'unlock', 'OWNER', 'owner', 'хозяин открывает'),
      P(1.2, 'radio', 'volume', '', 'radio', 'музыка'),
      P(2.1, 'air', 'unlock', '', 'stranger', 'угонщик «по воздуху»'),
      P(3.1, 'air', 'start', '', 'stranger', 'завести «по воздуху»'),
      P(4.1, 'app', 'lights', 'OWNER', 'owner', 'хозяин мигает фарами'),
      P(5.1, 'air', 'unlock', '0000', 'stranger', 'заводской «ключ»'),
      P(6.2, 'radio', 'volume', '', 'radio', 'музыка'),
      P(7.0, 'app', 'start', 'OWNER', 'owner', 'хозяин греет мотор'),
    ],
    red: [['air', 'unlock', ''], ['air', 'start', '0000'], ['radio', 'unlock', ''], ['app', 'start', ''], ['air', 'unlock', 'owner'], ['radio', 'start', '0000']],
    pay: 900,
  }),
]);

export function garageDay(day = 1) {
  return GARAGE_DAYS.find((d) => d.day === day) ?? GARAGE_DAYS[0];
}

// What should happen to a packet, independent of the rule.
export function shouldPass(p) { return p.who === 'owner' || p.who === 'radio'; }
export function isDangerous(p) { return DANGEROUS.includes(p.cmd); }

// The full night as one list: traffic, then the red-team barrage (plus, on
// day 3, the player's own picklock as the last attack).
export function garagePackets(day = 1, { picklock = null } = {}) {
  const d = garageDay(day);
  const list = d.traffic.map((p, i) => ({ ...p, id: i, phase: 'night' }));
  const red = d.red.map(([src, cmd, key]) => ({ src, cmd, key, who: 'red', note: 'твой red-team' }));
  if (picklock) red.push({ ...picklock, who: 'red', note: 'твоя отмычка' });
  red.forEach((p, i) => list.push({ ...p, t: +(GARAGE.redStart + i * GARAGE.redEvery).toFixed(3), id: list.length, phase: 'red' }));
  return list;
}

// Runs the rule on every packet and lays the night out in time.
export function judgeNight(source, day = 1, opts = {}) {
  const rule = compileRule(source);
  const packets = garagePackets(day, opts).map((p) => {
    const r = rule.judge({ src: p.src, cmd: p.cmd, key: p.key });
    const verdict = r.error ? 'error' : r.verdict;
    const atGate = +(p.t + GARAGE.toGate).toFixed(3);
    const passed = verdict === 'pass';
    const out = { ...p, verdict, silent: r.silent, error: r.error, prints: r.prints, atGate, atCar: passed ? +(atGate + GARAGE.toCar).toFixed(3) : undefined };
    out.leak = passed && !shouldPass(p) && isDangerous(p);           // a stranger opened or started the car
    out.denied = !passed && shouldPass(p);                            // the owner (or their music) was turned away
    out.harmless = passed && !shouldPass(p) && !isDangerous(p);
    return out;
  });
  // The red team only comes for a rule that survived the night: a night
  // already lost ends there, so the retry loop stays short.
  const lostNight = !rule.ok || packets.some((p) => p.phase === 'night' && (p.leak || p.denied || p.verdict === 'error'));
  const kept = lostNight ? packets.filter((p) => p.phase === 'night') : packets;
  const last = kept.at(-1);
  return { day, ok: rule.ok, error: rule.error, packets: kept, redSkipped: lostNight, end: last ? last.atGate + (last.atCar !== undefined ? GARAGE.toCar : 0) + 1.2 : GARAGE.night };
}

// The showcase repaints every frame: judge each (rule, day) once.
const nightCache = new Map();
function cachedNight(rule, day, picklock) {
  const k = `${day}|${picklock ? `${picklock.src}/${picklock.cmd}/${picklock.key}` : ''}|${rule}`;
  let n = nightCache.get(k);
  if (!n) { n = judgeNight(rule, day, { picklock }); if (nightCache.size > 24) nightCache.clear(); nightCache.set(k, n); }
  return n;
}

// The deciding moments slow time down: the first leak, and the last
// red-team packet. Returns the gate times the scene plays in slow motion.
export function slowmoMoments(night) {
  const moments = [];
  const firstLeak = night.packets.find((p) => p.leak);
  if (firstLeak) moments.push(firstLeak.atGate);
  const lastRed = night.packets.filter((p) => p.phase === 'red').at(-1);
  if (lastRed && lastRed !== firstLeak) moments.push(lastRed.atGate);
  return moments;
}

// The state of the garage at night-time t. Used by the scene every frame
// and, at t = Infinity, as the verdict of the day.
export function simGarage(cfg = {}, t = Infinity) {
  const day = cfg.day ?? 1;
  const night = cfg.night ?? cachedNight(cfg.rule ?? garageDay(day).starter ?? '', day, cfg.picklock ?? null);
  const at = (v) => v !== undefined && v <= t;
  const packets = night.packets;
  const leaks = packets.filter((p) => p.leak && at(p.atCar));
  const denied = packets.filter((p) => p.denied && at(p.atGate));
  const errors = packets.filter((p) => p.verdict === 'error' && at(p.atGate));
  const blocked = packets.filter((p) => p.verdict !== 'pass' && at(p.atGate));
  const ownerIn = packets.filter((p) => shouldPass(p) && p.verdict === 'pass' && at(p.atCar));
  const lastLeak = leaks.at(-1) ?? null;
  const unlocked = packets.filter((p) => p.verdict === 'pass' && (p.cmd === 'unlock') && at(p.atCar)).at(-1) ?? null;
  const started = packets.filter((p) => p.verdict === 'pass' && p.cmd === 'start' && at(p.atCar)).at(-1) ?? null;
  const all = (pred) => packets.filter(pred);
  const dayLeaks = all((p) => p.leak).length, dayDenied = all((p) => p.denied).length, dayErrors = all((p) => p.verdict === 'error').length;
  const nightLeaks = all((p) => p.leak && p.phase === 'night').length, redLeaks = all((p) => p.leak && p.phase === 'red').length;
  return {
    t, day, night, packets,
    phase: !night.redSkipped && t >= GARAGE.redStart - 0.3 ? 'red' : 'night',
    leaks: leaks.length, denied: denied.length, errors: errors.length, blocked: blocked.length, ownerIn: ownerIn.length,
    ownerTotal: all(shouldPass).length,
    alarm: lastLeak ? t - lastLeak.atCar : null, lastLeak,
    unlocked, started,
    dayLeaks, dayDenied, dayErrors, nightLeaks, redLeaks,
    ok: night.ok && dayLeaks === 0 && dayDenied === 0 && dayErrors === 0,
    slow: cfg.slow ?? 0, banner: cfg.banner ?? null,
  };
}

// Day 3, step one: the player is the thief. Their program only sets
// variables; the factory rule judges the packet they built.
export function tryPicklock(packetSource, day = 3) {
  const d = garageDay(day);
  const built = runRule(packetSource, {});
  if (!built.ok) return { ok: false, reason: 'error', error: built.error, message: formatRuleError(built.error) };
  const pk = { src: String(built.env.src ?? ''), cmd: String(built.env.cmd ?? ''), key: String(built.env.key ?? '') };
  if (pk.key === OWNER_KEY) return { ok: false, reason: 'owner-key', packet: pk, message: 'Ключа владельца у тебя нет: отмычка должна пройти без "OWNER".' };
  if (!['app', 'air', 'radio'].includes(pk.src)) return { ok: false, reason: 'src', packet: pk, message: `Источника «${pk.src}» в этой машине нет: только "app", "air" или "radio".` };
  if (!DANGEROUS.includes(pk.cmd)) return { ok: false, reason: 'harmless', packet: pk, message: `Команда «${pk.cmd}» машину не откроет. Угонщику нужны "unlock" или "start".` };
  const verdict = runRule(d.factory, pk).verdict;
  return { ok: verdict === 'pass', reason: verdict === 'pass' ? 'open' : 'blocked', packet: pk, verdict, message: verdict === 'pass' ? 'Заводской шлюз пропустил команду без ключа.' : 'Заводской шлюз отбил эту команду. Посмотри на его правило ещё раз: где дверь шире, чем надо?' };
}

// Why the day failed, in the player's words.
export function garageVerdict(sim) {
  if (!sim.night.ok) return { ok: false, title: 'ШЛЮЗ НЕ ЗАПУСТИЛСЯ', line: formatRuleError(sim.night.error) };
  if (sim.dayErrors) { const p = sim.packets.find((x) => x.verdict === 'error'); return { ok: false, title: 'ШЛЮЗ УПАЛ', line: `На команде #${p.id + 1} правило упало: ${formatRuleError(p.error)}` }; }
  if (sim.nightLeaks) return { ok: false, title: 'МАШИНУ ВСКРЫЛИ', line: `Чужая команда прошла шлюз ${sim.nightLeaks} раз(а) за ночь.` };
  if (sim.dayDenied) { const p = sim.packets.find((x) => x.denied); return { ok: false, title: p.who === 'radio' ? 'МУЗЫКА ЗАГЛОХЛА' : 'ХОЗЯИН НЕ ВОШЁЛ', line: p.who === 'radio' ? 'Шлюз отбил громкость магнитолы. Закрыть всё — не защита, а поломка.' : 'Шлюз отбил хозяина с его ключом. Закрыть всё — не защита, а поломка.' }; }
  if (sim.redLeaks) { const p = sim.packets.find((x) => x.leak && x.phase === 'red'); return { ok: false, title: 'RED-TEAM ПРОШЁЛ', line: `Ночь ты пережил, но твой red-team вошёл командой src="${p.src}" cmd="${p.cmd}" key="${p.key}". Правило подогнано под ночь, а не под смысл.` }; }
  return { ok: true, title: 'ЗАМОК ДЕРЖИТ', line: `Все ${sim.ownerTotal} своих команд прошли, ни одна чужая не открыла машину — даже твой red-team.` };
}

// Day 3, the thief's moment: one packet, built by the player, against the
// factory rule -- laid out like a night so the same scene plays it.
export function picklockNight(packet, day = 3) {
  const d = garageDay(day);
  const r = runRule(d.factory ?? '', packet);
  const t = 0.4, atGate = +(t + GARAGE.toGate).toFixed(3), passed = r.verdict === 'pass';
  const p = { ...packet, t, id: 0, who: 'stranger', note: 'твоя отмычка', phase: 'night', verdict: r.verdict, silent: r.silent, error: null, prints: r.prints, atGate, atCar: passed ? +(atGate + GARAGE.toCar).toFixed(3) : undefined };
  p.leak = passed && isDangerous(p); p.denied = false; p.harmless = passed && !isDangerous(p);
  return { day, ok: true, error: null, packets: [p], end: atGate + GARAGE.toCar + 2.4, picklock: true };
}
