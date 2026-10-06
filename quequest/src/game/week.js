// 19.0 · Первая неделя на заводе (канон §18): пять дней — пять способов
// сделать одно и то же, и пять подлостей начальника.
//
//   день 1  КНОПКА     жмёшь «ПУСК» — рука таскает.  «Всё делает автомат. Заплачу меньше.»
//   день 2  КОПИЯ      кнопки нет; строчка на листке — выдели, скопируй, вставь.  «Эх ты… ну ладно.»
//   день 3  СБОРКА     листок порван — расставь куски, одно слово допиши сам.  «Хм. Работает.»
//   день 4  РУКАМИ     ничего нет, пишешь сам, вставка выключена.  «Держи премию.»
//   день 5  АВТОМАТ    вся линия работает сама.  «Вот деньги… Дальше мы без тебя. Пока.»
//
// Потом увольнение, чип «это не совпадение» (§14) и звонок Вити: корпорация,
// которой принадлежит завод, по ночам вскрывает машины. Квест «Сходи в гараж
// к Вите» (q-garage-vitya) — мостик в профессии.
//
// Чистые данные и правила, без DOM: tools/week.test.mjs.

export const CRATE_PAY_WEEK = 20;

// The megacorp that owns the factory (canon §18, career-story.js MEGACORP).
// Invented, not a real company.
export const CORP = Object.freeze({
  name: 'ТИСКИ',
  full: 'холдинг «ТИСКИ»',
  motto: 'Мы держим всё',
  service: '«ТИСКИ-Авто»',
});

// Day → its work checkpoint, its pay checkpoint, how the hand does it.
export const WEEK = Object.freeze([
  Object.freeze({ day: 1, work: 'd1-button', pay: 'pay1', way: 'КНОПКА', verb: 'нажал кнопку' }),
  Object.freeze({ day: 2, work: 'd2-copy', pay: 'pay2', way: 'КОПИЯ', verb: 'скопировал строчку' }),
  Object.freeze({ day: 3, work: 'd3-assemble', pay: 'pay3', way: 'СБОРКА', verb: 'собрал строчку из кусков' }),
  Object.freeze({ day: 4, work: 'd4-hand', pay: 'pay4', way: 'РУКАМИ', verb: 'написал сам' }),
  Object.freeze({ day: 5, work: 'd5-auto', pay: 'fired', way: 'АВТОМАТ', verb: 'сделал, чтобы линия шла сама' }),
]);
export const WEEK_CHECKPOINTS = Object.freeze(WEEK.flatMap((d) => [d.work, d.pay]));
export const WEEK_PAY_CHECKPOINTS = Object.freeze(WEEK.map((d) => d.pay));
export const WEEK_WORK_CHECKPOINTS = Object.freeze(WEEK.map((d) => d.work));

export function isWeekCheckpoint(checkpoint) { return WEEK_CHECKPOINTS.includes(checkpoint); }
export function weekDayOf(checkpoint) {
  const d = WEEK.find((x) => x.work === checkpoint || x.pay === checkpoint);
  return d ? d.day : 0;
}
export function payOf(work) { return WEEK.find((d) => d.work === work)?.pay ?? null; }
export function nextWorkAfter(pay) {
  const i = WEEK.findIndex((d) => d.pay === pay);
  return i >= 0 && i + 1 < WEEK.length ? WEEK[i + 1].work : null;
}

// How many crates the arm moves each day, and the boss's money trick.
export const DAY_CRATES = Object.freeze({ 1: 6, 2: 6, 3: 3, 4: 3, 5: 6 });
export const MANUAL_DAY1 = 3;
export const PAY_RULES = Object.freeze({
  1: Object.freeze({ delta: -60, label: '«Всё делает автомат» — урезал', tone: 'cut' }),
  2: Object.freeze({ delta: 0, label: '', tone: '' }),
  3: Object.freeze({ delta: 0, label: '', tone: '' }),
  4: Object.freeze({ delta: 100, label: 'Премия — нехотя', tone: 'bonus' }),
  5: Object.freeze({ delta: 300, label: 'Расчёт при увольнении', tone: 'payoff' }),
});

// What a day pays in total (crates + the boss's trick).
export function dayTotal(day) {
  const crates = (DAY_CRATES[day] ?? 0) + (day === 1 ? MANUAL_DAY1 : 0);
  return crates * CRATE_PAY_WEEK + (PAY_RULES[day]?.delta ?? 0);
}
// Money on the account at the start of a day (saves keep only the
// checkpoint, so this is how a reload gets the same wallet back).
export function wageBefore(day) {
  let w = 0;
  for (let d = 1; d < day; d++) w += dayTotal(d);
  return w;
}
// …and after the day's pay card.
export function wageAfter(day) { return wageBefore(day) + dayTotal(day); }

// The pay slip of a day: rows the card shows, all readable without code.
export function payLedger(day, { wage = wageAfter(day) } = {}) {
  const rows = [];
  if (day === 1) rows.push({ label: 'Ящики руками', count: MANUAL_DAY1, value: MANUAL_DAY1 * CRATE_PAY_WEEK });
  const n = DAY_CRATES[day] ?? 0;
  rows.push({ label: day === 1 ? 'Ящики кнопкой' : 'Ящики рукой 07', count: n, value: n * CRATE_PAY_WEEK });
  const rule = PAY_RULES[day];
  if (rule?.delta) rows.push({ label: rule.label, value: rule.delta, tone: rule.tone });
  return { day, rows, total: dayTotal(day), wage };
}

// The boss at the end of each day — the line canon §18 gives him — and what
// you think (once, on day 1, per canon: «Ах ты… ну ладно»).
export const BOSS_END = Object.freeze({
  1: Object.freeze({ title: 'Всё делает автомат. Заплачу меньше.', line: 'Кнопочку нажал — и стоишь? Ящики таскала рука, а не ты. Значит, и платить тебе не за что. Шестьдесят рублей урежу. Скажи спасибо, что не все.', me: 'Ах ты… ну ладно.' }),
  2: Object.freeze({ title: 'Эх ты… ну ладно.', line: 'Я кнопку оторвал, а ты бумажку с проводом переписал. Хитрый. Эх ты… ну ладно. Как есть заплачу.', me: '' }),
  3: Object.freeze({ title: 'Хм. Работает.', line: 'Красные стоят, белые уехали. Хм. Работает. Бумажки я твои всё равно выкину.', me: '' }),
  4: Object.freeze({ title: 'Держи премию.', line: 'Без бумажки, сам… (долго молчит) Ладно. Держи премию. Не привыкай.', me: '' }),
  5: Object.freeze({ title: 'Вот деньги. Дальше мы без тебя.', line: 'Вот деньги. Молодец, всё починил. Линия сама идёт, человек ей больше не нужен. Дальше мы без тебя. Пока.', me: 'Я сам написал то, что меня заменило.' }),
});

// Short evenings at home (honest: the card says you are home, no fake button).
export const EVENING = Object.freeze({
  1: Object.freeze({ when: 'ДОМА · ВЕЧЕР ДНЯ 1 · 21:40', title: 'Сегодня ящики таскала рука.', line: 'В кармане 120 ₽ вместо 180. На мониторе стикер моим почерком: F5. Я его не клеил… Чип лежит на столе и чуть светится. Спать.' }),
  2: Object.freeze({ when: 'ДОМА · ВЕЧЕР ДНЯ 2 · 21:15', title: 'Кнопку оторвали — а рука всё равно послушалась.', line: 'Значит, дело было не в кнопке, а в строчке за ней. Её можно переписать. Скопировать. Спать.' }),
  3: Object.freeze({ title: 'Из кусков сложилась фраза.', when: 'ДОМА · ВЕЧЕР ДНЯ 3 · 22:05', line: '«Если ящик белый — рука, возьми ящик». Почти по-русски, только английскими словами. Завтра бумажки не будет. Спать.' }),
  4: Object.freeze({ when: 'ДОМА · ВЕЧЕР ДНЯ 4 · 20:50', title: 'Премия. Первая за год.', line: 'Электрик сказал: «Ты ж теперь программируешь». Смешно. Я просто сказал руке, что делать. Завтра приезжает фура — целая линия. Спать.' }),
});

// Morning briefings, before you walk into the hall.
export const MORNING = Object.freeze({
  2: Object.freeze({ when: 'ДЕНЬ 2 · УТРО · 07:55', title: 'Тот же склад. Начальник уже у руки.', line: 'Он стоит у зелёной кнопки и смотрит на неё, как на врага.' }),
  3: Object.freeze({ when: 'ДЕНЬ 3 · УТРО · 07:50', title: 'На ленте — красные ящики.', line: 'Сегодня привезли вперемешку: белые и красные. А листок у терминала кто-то порвал.' }),
  4: Object.freeze({ when: 'ДЕНЬ 4 · УТРО · 07:45', title: 'Листка нет совсем.', line: 'Стена у терминала пустая. Даже клея не осталось. Ящики снова вперемешку.' }),
  5: Object.freeze({ when: 'ДЕНЬ 5 · УТРО · 07:40', title: 'Пришла фура. Целая линия ящиков.', line: 'Вечером проверка из главного офиса холдинга «ТИСКИ». Начальник хочет, чтобы линия шла сама, без людей.' }),
});

// What the people in the hall say when a day starts (who, text).
export const HALL_MORNING = Object.freeze({
  1: Object.freeze([['electrician', 'О, ожила! Я ей вчера кнопку «ПУСК» прикрутил — зелёная, у руки. Жми.']]),
  2: Object.freeze([['electrician', 'Кнопка — это ж просто одна строчка. Я её на листок переписал, вон висит у терминала. Скопируй — и всё.']]),
  3: Object.freeze([['lunch', 'Мне жена так и говорит: если хлеб белый — бери, если нет — не трогай. (жуёт)']]),
  4: Object.freeze([['electrician', 'Бумажки нет? А ты вспомни, что вчера собирал. Руки помнят.']]),
  5: Object.freeze([['fitter', 'Фура до потолка. Если рука сама всё не растащит — ночевать тут будем.']]),
});

// The boss's story card when a day starts in the hall.
export const BOSS_MORNING = Object.freeze({
  2: Object.freeze({ title: 'Кнопочки он жмёт…', line: '«Я тебя таскать нанимал, а не кнопочки жать!» (хрясь — кнопка с проводом у него в кулаке, потом на полу) «Нет кнопки — нет руки. Работай!»', button: 'ПОСМОТРЕТЬ НА ТЕРМИНАЛ' }),
  3: Object.freeze({ title: 'Красные — не трогать.', line: '«Таскай ТОЛЬКО БЕЛЫЕ. Тронет рука красный — штраф из твоих. И бумажку твою я порвал: нечего на стенах писать».', button: 'ЧТО ЖЕ ДЕЛАТЬ…' }),
  4: Object.freeze({ title: 'Бумажки кончились.', line: '«Обрывки я выкинул. Без бумажки-то слабо?»', button: 'НЕ СЛАБО' }),
  5: Object.freeze({ title: 'Чтобы линия шла сама.', line: '«Вечером приедут из главного офиса. Линия должна работать без людей — вся, от первого ящика до последнего. Сделаешь — получишь расчёт». Слово «расчёт» он сказал как-то странно.', button: 'К ТЕРМИНАЛУ' }),
});

// After the firing: the chip in your pocket, and Витя's call.
export const FIRED = Object.freeze({
  chip: 'В кармане теплеет чип. Тот самый, с первого дня. — это не совпадение.',
  callWho: 'ВИТЯ · ЗВОНИТ',
  callTitle: 'Слушай, это они. «ТИСКИ».',
  callLine: 'Твой завод — один из цехов холдинга «ТИСКИ». «Мы держим всё», ага. У них ещё «ТИСКИ-Авто»: ночью вскрывают чужие машины, утром «находят» и возвращают за деньги. У меня в гараже машина — её сейчас вскрывают. Приходи, а? Через дверь из квартиры — прямо в гараж.',
  callButton: 'ИДУ К ВИТЕ →',
  questId: 'q-garage-vitya',
  questTitle: 'Сходи в гараж к Вите',
});

// The in-game clock: never jumps back within a day.
export function weekClock({ checkpoint = 'start', scene = 'warehouse', arm = {} } = {}) {
  const day = weekDayOf(checkpoint);
  if (!day) return null;
  if (checkpoint === 'fired') return '17:40';
  if (WEEK_PAY_CHECKPOINTS.includes(checkpoint)) return '17:00';
  const working = scene === 'automation';
  const start = { 1: '11:40', 2: '08:05', 3: '08:00', 4: '07:55', 5: '07:50' }[day];
  const busy = { 1: '11:45', 2: '08:30', 3: '08:40', 4: '08:35', 5: '09:10' }[day];
  if (day === 1 && scene === 'chip') return '11:35';
  return working || arm.active ? busy : start;
}

// The one-line pinned quest: what to do right now.
export function weekPin({ checkpoint = 'start', scene = 'warehouse', arm = {}, warehouse = {} } = {}, flags = {}) {
  if (checkpoint === 'fired') return flags.vityaGarage ? 'Гараж Вити: что там с машиной?' : FIRED.questTitle;
  if (WEEK_PAY_CHECKPOINTS.includes(checkpoint)) return 'Получи расчёт за день';
  const day = weekDayOf(checkpoint);
  if (!day) return '';
  if (scene === 'chip') return 'Чип защёлкивается в руке 07…';
  if (scene === 'automation' || arm.active || (arm.queue?.length ?? 0) > 0) return 'Смотри: рука таскает сама';
  if (scene === 'red-crate') return 'Рука застыла — подойди к ящику';
  return {
    1: 'Нажми зелёную кнопку «ПУСК» у руки 07',
    2: 'Скопируй строчку с листка в терминал руки',
    3: 'Собери порванную строчку в терминале руки',
    4: 'Напиши правило руке сам — в терминале',
    5: 'Сделай, чтобы вся линия шла сама',
  }[day];
}

// ----------------------------------------------------------- day 2: copy
export const SHEET_LINE = 'print("wake")';

// ------------------------------------------------------- day 3: assemble
// The torn sheet: the rule in two lines, every piece with its Russian word.
// One piece (the word inside the quotes) is torn off: you type it yourself
// (the white crates are stamped WHITE).
export const ASSEMBLE = Object.freeze({
  slots: Object.freeze([
    Object.freeze({ id: 's1', line: 1, want: 'if', gloss: 'ЕСЛИ' }),
    Object.freeze({ id: 's2', line: 1, want: 'box', gloss: 'ЯЩИК' }),
    Object.freeze({ id: 's3', line: 1, want: '==', gloss: 'РАВЕН' }),
    Object.freeze({ id: 'typed', line: 1, typed: true, gloss: 'БЕЛОМУ' }),
    Object.freeze({ id: 's4', line: 1, want: ':', gloss: 'ТО' }),
    Object.freeze({ id: 's5', line: 2, want: 'arm.take(box)', gloss: 'РУКА, ВОЗЬМИ ЯЩИК' }),
  ]),
  // The tray, in a fixed shuffled order (no randomness: same for everyone).
  pieces: Object.freeze([
    Object.freeze({ id: 'p-take', text: 'arm.take(box)', gloss: 'рука, возьми ящик' }),
    Object.freeze({ id: 'p-colon', text: ':', gloss: 'то' }),
    Object.freeze({ id: 'p-if', text: 'if', gloss: 'если' }),
    Object.freeze({ id: 'p-eq', text: '==', gloss: 'равен' }),
    Object.freeze({ id: 'p-box', text: 'box', gloss: 'ящик' }),
  ]),
  typedWant: 'white',
});

// Normalise the typed word: quotes, spaces and capitals do not matter.
export function cleanTyped(word = '') {
  return String(word).trim().replace(/^["'«“]+|["'»”]+$/g, '').trim().toLowerCase();
}

// placed: { slotId: pieceText }, typed: string. Returns what is wrong in
// plain words, slot by slot, or ok with the assembled source.
export function judgeAssemble(placed = {}, typed = '') {
  const wrong = [];
  const empty = [];
  for (const s of ASSEMBLE.slots) {
    if (s.typed) continue;
    const got = placed[s.id];
    if (!got) empty.push(s.id);
    else if (got !== s.want) wrong.push(s.id);
  }
  const word = cleanTyped(typed);
  if (empty.length) return { ok: false, code: 'empty', wrong, empty, text: 'Не все куски на месте. Нажми на кусок внизу — он встанет в первую пустую клетку.' };
  if (wrong.length) {
    return { ok: false, code: 'order', wrong, empty, text: 'Порядок не тот. Читай русские слова над клетками: ЕСЛИ · ЯЩИК · РАВЕН · БЕЛОМУ · ТО — и внизу: РУКА, ВОЗЬМИ ЯЩИК. Каждый кусок подписан, какое у него слово.' };
  }
  if (!word) return { ok: false, code: 'typed-empty', wrong: ['typed'], empty, text: 'Одно слово оторвано — его впиши сам. На белых ящиках штамп: WHITE.' };
  if (/[Ѐ-ӿ]/.test(word)) return { ok: false, code: 'typed-ru', wrong: ['typed'], empty, text: 'Рука понимает только слово со штампа на ящике — английскими буквами: white.' };
  if (word !== ASSEMBLE.typedWant) {
    return { ok: false, code: word === 'red' ? 'typed-red' : 'typed-wrong', wrong: ['typed'], empty, text: word === 'red' ? 'Так рука возьмёт КРАСНЫЕ — штраф. Нам нужны белые: white.' : `Рука не знает слова «${word}». На белых ящиках штамп: WHITE.` };
  }
  return { ok: true, code: 'ok', wrong: [], empty: [], text: 'Строчка собрана. Рука прочитает её для каждого ящика.', source: assembleSource(placed, word) };
}

export function assembleSource(placed = {}, typed = ASSEMBLE.typedWant) {
  const line1 = ASSEMBLE.slots.filter((s) => s.line === 1).map((s) => (s.typed ? `"${cleanTyped(typed)}"` : placed[s.id] ?? '')).join(' ').replace(/ :$/, ':');
  const line2 = `    ${placed.s5 ?? ''}`;
  return `${line1}\n${line2}`;
}

// --------------------------------------------------- day 4 / 5: by hand
export const HAND_RULE = 'if box == "white":\n    arm.take(box)';
export const AUTO_RULE = 'for box in boxes:\n    if box == "white":\n        arm.take(box)';

// ---------------------------------------------------------------- flags
// The old chapters (friends, Вика, вирус, цех, кампус) stay in the code but
// only open with ?legacy=1.
export function legacyFromQuery(search = '') {
  try { return new URLSearchParams(search).get('legacy') === '1'; } catch { return false; }
}

// An 18.x save (old checkpoints) lands on the matching day of the new week.
export function weekFromLegacy(checkpoint) {
  if (isWeekCheckpoint(checkpoint) || ['start', 'warehouse'].includes(checkpoint)) return checkpoint;
  if (['chip', 'machine', 'red-crate'].includes(checkpoint)) return 'd1-button';
  if (checkpoint === 'reward') return 'pay1';
  if (['shift2', 'red2'].includes(checkpoint)) return 'd2-copy';
  if (checkpoint === 'condition') return 'd3-assemble';
  if (['reward2', 'forlesson', 'reward-for'].includes(checkpoint)) return 'd4-hand';
  if (['shift3', 'queue', 'reward3', 'function'].includes(checkpoint)) return 'd5-auto';
  return 'fired';
}
