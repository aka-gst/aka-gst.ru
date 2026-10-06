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

// 19.0 · the player-facing words are plain Russian (canon §18: a friend who
// has never programmed must follow it). The rule sees three variables with
// everyday names -- откуда, что, ключ -- and everyday values; inside, packets
// keep their short ids (src / cmd / key) that the scene and the AR overlay
// draw from. RU / FROM_RU translate at the boundary, in one place.
export const SRC_RU = Object.freeze({ app: 'телефон', air: 'эфир', radio: 'радио' });
export const CMD_RU = Object.freeze({ unlock: 'открыть', start: 'завести', lights: 'фары', volume: 'громкость' });
const FROM_RU = (map) => Object.freeze(Object.fromEntries(Object.entries(map).map(([k, v]) => [v, k])));
export const SRC_FROM_RU = FROM_RU(SRC_RU);
export const CMD_FROM_RU = FROM_RU(CMD_RU);
// One line of meaning for each variable, shown next to the code.
export const RULE_VARS = Object.freeze([
  Object.freeze({ name: 'откуда', means: 'откуда пришла команда', values: ['телефон', 'эфир', 'радио'] }),
  Object.freeze({ name: 'что', means: 'что она просит сделать', values: ['открыть', 'завести', 'фары', 'громкость'] }),
  Object.freeze({ name: 'ключ', means: 'чей ключ приложен', values: ['ИМЯ ХОЗЯИНА', '""'] }),
]);

// Who sent a command decides what SHOULD happen to it; the rule decides
// what DOES happen. owner/radio must pass, stranger/red («ТИСКИ») must not
// open or start the car. Each day is one hacker quest (career-story.js):
// its own car owner, whose name is the key.
export const GARAGE_DAYS = Object.freeze([
  Object.freeze({
    day: 1,
    quest: 'q-garage-vitya',
    owner: 'ВИТЯ', ownerName: 'Витя', locked: 'ВИТЯ НЕ ПОПАЛ В МАШИНУ',
    title: 'МАШИНА ВИТИ',
    brief: 'Сторож в машине Вити пускает всё подряд — ночью «ТИСКИ-Авто» открывают её командой из эфира. Напиши правило: пускать только Витю по его ключу, остальных — в блок.',
    starter: [
      '# СТОРОЖ МАШИНЫ ВИТИ',
      '# Каждая команда приходит в трёх словах:',
      '#   откуда — "телефон" (приложение Вити), "эфир" (по воздуху), "радио"',
      '#   что    — "открыть", "завести", "фары"',
      '#   ключ   — чей ключ: "ВИТЯ" или "" (никакого)',
      '# Сторож отвечает: print("ПРОПУСТИТЬ") или print("БЛОК")',
      '',
      'print("ПРОПУСТИТЬ")',
    ].join('\n'),
    solution: 'if ключ == "ВИТЯ":\n    print("ПРОПУСТИТЬ")\nelse:\n    print("БЛОК")',
    chips: [['if ключ == "ВИТЯ":', 'if ключ == "ВИТЯ":\n    '], ['else:', 'else:\n    '], ['print("ПРОПУСТИТЬ")', 'print("ПРОПУСТИТЬ")'], ['print("БЛОК")', 'print("БЛОК")']],
    traffic: [
      P(0.3, 'app', 'unlock', 'OWNER', 'owner', 'Витя открывает'),
      P(1.3, 'air', 'unlock', '', 'stranger', '«ТИСКИ» из эфира'),
      P(2.4, 'app', 'lights', 'OWNER', 'owner', 'Витя мигает фарами'),
      P(3.4, 'air', 'start', '', 'stranger', '«ТИСКИ» пробуют завести'),
      P(4.5, 'app', 'unlock', 'OWNER', 'owner', 'Витя снова'),
      P(5.4, 'air', 'unlock', '0000', 'stranger', 'заводской код 0000'),
      P(6.5, 'app', 'start', 'OWNER', 'owner', 'Витя греет мотор'),
    ],
    red: [['air', 'unlock', ''], ['app', 'unlock', ''], ['air', 'start', '0000'], ['radio', 'unlock', ''], ['app', 'start', 'owner'], ['air', 'unlock', 'OWNER '], ['radio', 'start', '']],
    pay: 300,
  }),
  Object.freeze({
    day: 2,
    quest: 'q-garage-dina',
    owner: 'ДИНА', ownerName: 'Дина', locked: 'ДИНА НЕ ПОПАЛА В МАШИНУ',
    title: 'МАГНИТОЛА ДИНЫ',
    brief: '«ТИСКИ» «обновили» Дине магнитолу и теперь шлют через неё «открыть» и «завести». А громкость магнитола шлёт без ключа — и музыку выключать нельзя. Пусти музыку, но не пускай «ТИСКИ» к замку и мотору.',
    starter: [
      '# МАГНИТОЛА ДИНЫ',
      '# Радио шлёт что == "громкость" без ключа — это нормально.',
      '# Но через него же «ТИСКИ» шлют "открыть" и "завести".',
      '# elif — «а иначе, если…»: проверяется, когда первое условие не подошло.',
      '',
      'if ключ == "ДИНА":',
      '    print("ПРОПУСТИТЬ")',
      'else:',
      '    print("БЛОК")',
    ].join('\n'),
    solution: 'if ключ == "ДИНА":\n    print("ПРОПУСТИТЬ")\nelif что == "громкость":\n    print("ПРОПУСТИТЬ")\nelse:\n    print("БЛОК")',
    chips: [['elif что == "громкость":', 'elif что == "громкость":\n    '], ['откуда == "радио"', 'откуда == "радио"'], ['print("ПРОПУСТИТЬ")', 'print("ПРОПУСТИТЬ")'], ['print("БЛОК")', 'print("БЛОК")']],
    traffic: [
      P(0.3, 'radio', 'volume', '', 'radio', 'музыка громче'),
      P(1.1, 'app', 'unlock', 'OWNER', 'owner', 'Дина открывает'),
      P(2.0, 'radio', 'unlock', '', 'stranger', '«ТИСКИ» через магнитолу'),
      P(2.8, 'radio', 'volume', '', 'radio', 'музыка тише'),
      P(3.7, 'air', 'unlock', '', 'stranger', '«ТИСКИ» из эфира'),
      P(4.6, 'radio', 'start', '', 'stranger', 'завести через магнитолу'),
      P(5.5, 'radio', 'volume', '', 'radio', 'трек дальше'),
      P(6.5, 'app', 'start', 'OWNER', 'owner', 'Дина греет мотор'),
    ],
    red: [['radio', 'unlock', ''], ['radio', 'start', '0000'], ['air', 'start', ''], ['app', 'unlock', ''], ['radio', 'unlock', 'owner'], ['air', 'unlock', '0000'], ['radio', 'start', '']],
    pay: 600,
  }),
  Object.freeze({
    day: 3,
    quest: 'q-garage-master',
    owner: 'САНЯ', ownerName: 'Саня', locked: 'САНЯ НЕ ПОПАЛ В МАШИНУ',
    title: 'МАСТЕР-КЛЮЧ «ТИСКОВ»',
    brief: 'Прошивка замка от «ТИСКОВ» пускает всё, что пришло «из эфира», — это их мастер-ключ. Сначала докажи Сане, что дыра есть: собери команду без его ключа, которая откроет машину. Потом залатай замок своим правилом.',
    factory: 'if ключ == "САНЯ" or откуда == "эфир":\n    print("ПРОПУСТИТЬ")\nelse:\n    print("БЛОК")',
    pickStarter: [
      '# Ты сейчас действуешь как «ТИСКИ»: ключа Сани у тебя нет.',
      '# Собери команду, которую их прошивка пропустит.',
      'откуда = "телефон"',
      'что = "открыть"',
      'ключ = ""',
    ].join('\n'),
    pickSolution: 'откуда = "эфир"\nчто = "открыть"\nключ = ""',
    starter: [
      '# Прошивка «ТИСКОВ» — с дырой. Сначала вскрой её их приёмом (вверху),',
      '# потом перепиши здесь так, чтобы этот приём больше не сработал:',
      'if ключ == "САНЯ" or откуда == "эфир":',
      '    print("ПРОПУСТИТЬ")',
      'else:',
      '    print("БЛОК")',
    ].join('\n'),
    solution: 'if ключ == "САНЯ":\n    print("ПРОПУСТИТЬ")\nelif что == "громкость":\n    print("ПРОПУСТИТЬ")\nelse:\n    print("БЛОК")',
    chips: [['if ключ == "САНЯ":', 'if ключ == "САНЯ":\n    '], ['elif что == "громкость":', 'elif что == "громкость":\n    '], ['else:', 'else:\n    '], ['print("ПРОПУСТИТЬ")', 'print("ПРОПУСТИТЬ")'], ['print("БЛОК")', 'print("БЛОК")']],
    traffic: [
      P(0.3, 'app', 'unlock', 'OWNER', 'owner', 'Саня открывает'),
      P(1.2, 'radio', 'volume', '', 'radio', 'музыка'),
      P(2.1, 'air', 'unlock', '', 'stranger', 'мастер-ключ «ТИСКОВ»'),
      P(3.1, 'air', 'start', '', 'stranger', 'завести «из эфира»'),
      P(4.1, 'app', 'lights', 'OWNER', 'owner', 'Саня мигает фарами'),
      P(5.1, 'air', 'unlock', '0000', 'stranger', 'заводской код'),
      P(6.2, 'radio', 'volume', '', 'radio', 'музыка'),
      P(7.0, 'app', 'start', 'OWNER', 'owner', 'Саня греет мотор'),
    ],
    red: [['air', 'unlock', ''], ['air', 'start', '0000'], ['radio', 'unlock', ''], ['app', 'start', ''], ['air', 'unlock', 'owner'], ['radio', 'start', '0000']],
    pay: 900,
  }),
]);

// The key as the rule sees it: OWNER is the day's owner name; the forged
// keys of the night tricks («ВИТЯ » with a space, «витя» small) stay forged.
export function keyRu(key, day = 1) {
  const owner = garageDay(day).owner;
  if (key === OWNER_KEY) return owner;
  if (key === `${OWNER_KEY} `) return `${owner} `;
  if (key === OWNER_KEY.toLowerCase()) return owner.toLowerCase();
  return String(key ?? '');
}
// The three variables the player's rule receives for one packet.
export function packetVars(p, day = 1) {
  return { откуда: SRC_RU[p.src] ?? String(p.src), что: CMD_RU[p.cmd] ?? String(p.cmd), ключ: keyRu(p.key, day) };
}
// One packet as a line of the log, in the player's words.
export function packetLine(p, day = 1) {
  const v = packetVars(p, day);
  return `откуда="${v.откуда}" что="${v.что}" ключ="${v.ключ}"`;
}
// Rules saved before 19.0 speak the old English names (src, cmd, key,
// "OWNER"); the night would answer them with a NameError. They are dropped
// and the player gets the new starter.
export function staleRule(source) {
  const s = String(source ?? '');
  return /\b(src|cmd|key)\b|"OWNER"/.test(s) && !/откуда|что|ключ/.test(s);
}

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
  const red = d.red.map(([src, cmd, key]) => ({ src, cmd, key, who: 'red', note: 'запасной трюк «ТИСКОВ»' }));
  if (picklock) red.push({ ...picklock, who: 'red', note: 'их мастер-ключ (твоя проверка)' });
  red.forEach((p, i) => list.push({ ...p, t: +(GARAGE.redStart + i * GARAGE.redEvery).toFixed(3), id: list.length, phase: 'red' }));
  return list;
}

// Runs the rule on every packet and lays the night out in time.
export function judgeNight(source, day = 1, opts = {}) {
  const rule = compileRule(source);
  const packets = garagePackets(day, opts).map((p) => {
    const r = rule.judge(packetVars(p, day));
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

// Day 3, step one: the player plays «ТИСКИ». Their program only sets the
// three variables; the corporation's firmware judges the packet they built.
export function tryPicklock(packetSource, day = 3) {
  const d = garageDay(day);
  const built = runRule(packetSource, {});
  if (!built.ok) return { ok: false, reason: 'error', error: built.error, message: formatRuleError(built.error) };
  const ru = { откуда: String(built.env['откуда'] ?? ''), что: String(built.env['что'] ?? ''), ключ: String(built.env['ключ'] ?? '') };
  const pk = { src: SRC_FROM_RU[ru.откуда] ?? ru.откуда, cmd: CMD_FROM_RU[ru.что] ?? ru.что, key: ru.ключ === d.owner ? OWNER_KEY : ru.ключ };
  if (pk.key === OWNER_KEY) return { ok: false, reason: 'owner-key', packet: pk, message: `Ключа «${d.owner}» у тебя нет: приём «ТИСКОВ» должен пройти без него.` };
  if (!SRC_RU[pk.src]) return { ok: false, reason: 'src', packet: pk, message: `«${ru.откуда}» — такого входа в машине нет. Есть только "телефон", "эфир" или "радио".` };
  if (!DANGEROUS.includes(pk.cmd)) return { ok: false, reason: 'harmless', packet: pk, message: `Команда «${ru.что}» машину не откроет. Нужно "открыть" или "завести".` };
  const verdict = runRule(d.factory, packetVars(pk, day)).verdict;
  return { ok: verdict === 'pass', reason: verdict === 'pass' ? 'open' : 'blocked', packet: pk, verdict, message: verdict === 'pass' ? 'Прошивка «ТИСКОВ» пропустила команду без ключа.' : 'Прошивка «ТИСКОВ» эту команду отбила. Перечитай её правило: какой вход она пускает без ключа?' };
}

// Why the day failed, in the player's words.
export function garageVerdict(sim) {
  const d = garageDay(sim.day ?? sim.night?.day ?? 1);
  if (!sim.night.ok) return { ok: false, title: 'СТОРОЖ НЕ ЗАПУСТИЛСЯ', line: formatRuleError(sim.night.error) };
  if (sim.dayErrors) { const p = sim.packets.find((x) => x.verdict === 'error'); return { ok: false, title: 'СТОРОЖ СЛОМАЛСЯ', line: `На команде №${p.id + 1} правило упало: ${formatRuleError(p.error)}` }; }
  if (sim.nightLeaks) return { ok: false, title: 'МАШИНУ ВСКРЫЛИ', line: `Команда «ТИСКОВ» прошла сторожа ${sim.nightLeaks} раз(а) за ночь.` };
  if (sim.dayDenied) { const p = sim.packets.find((x) => x.denied); return { ok: false, title: p.who === 'radio' ? 'МУЗЫКА ЗАГЛОХЛА' : d.locked, line: p.who === 'radio' ? 'Сторож отбил громкость магнитолы. Закрыть всё — не защита, а поломка.' : `Сторож не пустил ${d.ownerName === 'Дина' ? 'хозяйку' : 'хозяина'} с ключом. Закрыть всё — не защита, а поломка.` }; }
  if (sim.redLeaks) { const p = sim.packets.find((x) => x.leak && x.phase === 'red'); return { ok: false, title: 'ТИСКИ НАШЛИ ЛАЗЕЙКУ', line: `Ночь ты выдержал, но утром «ТИСКИ» попробовали трюк, которого ночью не было: ${packetLine(p, d.day)}. Правило подогнано под одну ночь, а не под смысл «пускать только хозяина».` }; }
  return { ok: true, title: 'ЗАМОК ДЕРЖИТ', line: `Все ${sim.ownerTotal} своих команд прошли, ни одна чужая не открыла машину — даже запасные трюки «ТИСКОВ».` };
}

// Day 3, the thief's moment: one packet, built by the player, against the
// factory rule -- laid out like a night so the same scene plays it.
export function picklockNight(packet, day = 3) {
  const d = garageDay(day);
  const r = runRule(d.factory ?? '', packetVars(packet, day));
  const t = 0.4, atGate = +(t + GARAGE.toGate).toFixed(3), passed = r.verdict === 'pass';
  const p = { ...packet, t, id: 0, who: 'stranger', note: 'приём «ТИСКОВ»', phase: 'night', verdict: r.verdict, silent: r.silent, error: null, prints: r.prints, atGate, atCar: passed ? +(atGate + GARAGE.toCar).toFixed(3) : undefined };
  p.leak = passed && isDangerous(p); p.denied = false; p.harmless = passed && !isDangerous(p);
  return { day, ok: true, error: null, packets: [p], end: atGate + GARAGE.toCar + 2.4, picklock: true };
}
