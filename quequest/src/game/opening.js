// 19.5 · Новый старт (канон §22): рука не включается, наклейка-защита,
// удар током. Pure data and pure rules, no DOM: tools/opening.test.mjs.
//
// The owner's opening, in order:
//   1. Morning: the new robot arm (рука 07) was delivered, wired, configured
//      -- and it won't turn on. Nobody knows why. «Таскай руками».
//   2. You carry crates by hand (the fists, the crate in the hands, the anger
//      -- §21). The boss: «Медленно!» -- and he slams the table by the arm.
//   3. The slam knocks a leftover sticker loose on the arm's casing: a
//      CHILD-LOCK, like on a kitchen stove, nobody cut it off. He leaves angry.
//   4. You pry the child-lock off (hold E / press and slide on a phone):
//      under it -- the button print("wake"). Press it -> ELECTRIC SHOCK. After
//      it you SEE the deep program: code under the walls, seams, wires (§14).
//      That is why a loader suddenly gets good at this: «стал супергероем».
//   5. The arm wakes and works. The boss: «Всё делает автомат. Заплачу
//      меньше» (§18 day 1). You: «Я так не хочу. Хочу делать нормально.»
//   6. Day 2 the button is gone (torn off): «Мне уже всё равно -- я из
//      принципа разберусь и починю».
//
// first-shift.js keeps the state machine (stepFirstShift: 'slam', 'pry',
// 'press', 'arm-wakes'); this file holds the words, the numbers and the
// deeds the badges read.

// Phases of Shift 1 in which the arm is still dead (asking people for help,
// the status bar's «СТОИТ»).
export const ARM_DEAD_PHASES = Object.freeze(['briefing', 'manual', 'report', 'confront', 'fight', 'fight-result', 'payday', 'slam', 'lock', 'button']);
export const armDeadIn = (phase) => ARM_DEAD_PHASES.includes(phase);

// The pry: holding E fills it in PRY_MS; letting go early lets the lock
// spring back a little (it's plastic, it fights back).
export const PRY_MS = 1400;
export const PRY_SLIP = 0.35;
// One frame of prying. held: E is down (or the finger is sliding); dt in ms.
export function pryStep(pry = 0, { held = false, dt = 0 } = {}) {
  const p = Math.max(0, Math.min(1, Number(pry) || 0));
  if (held) return Math.min(1, p + Math.max(0, dt) / PRY_MS);
  return p;
}
// Let go before it came off: it clicks back.
export const pryRelease = (pry = 0) => (pry >= 1 ? 1 : Math.max(0, (Number(pry) || 0) - PRY_SLIP));
// A finger sliding along the pry track: how far along (0..1) is the progress.
export function pryFromSlide(startX, x, width) {
  if (!(width > 0)) return 0;
  return Math.max(0, Math.min(1, (x - startX) / width));
}

// The flags the opening raises (localStorage flags, read by the badges).
export const OPENING_FLAGS = Object.freeze({ childLock: 'childLock', shocked: 'shocked' });

// Old saves (18.x–19.4) went through the chip-behind-the-crate instead. If a
// save is past that moment, the shock counts as done (and so does the lock:
// you can't get to the button without it).
const BEFORE_THE_MOMENT = new Set(['start', 'warehouse']);
export function openingPast({ checkpoint = 'start', flags = {}, reflexes = {}, quests = [] } = {}) {
  if (flags?.[OPENING_FLAGS.shocked]) return true;
  if (reflexes?.crate) return true; // 18.2: looked behind the crate, found the chip
  const done = Array.isArray(quests) ? quests : Object.keys(quests ?? {}).filter((q) => quests[q]);
  if (done.includes('quest1')) return true; // Shift 1 was finished
  return Boolean(checkpoint) && !BEFORE_THE_MOMENT.has(checkpoint);
}
// What the badges read: { childLock, shocked }.
export function openingFacts(save = {}) {
  const past = openingPast(save);
  return {
    childLock: past || Boolean(save.flags?.[OPENING_FLAGS.childLock]),
    shocked: past,
  };
}

// ------------------------------------------------------------- the words

export const OPENING_LINES = Object.freeze({
  briefing: 'Руку 07 с утра привезли. Подключили, настроили — не включается. Никто не знает почему. Вася не пришёл, так что сегодня рука — это ты. Вон гора ящиков: три — на ленту за ней. Таскай руками. Потом ко мне.',
  // He yells while you carry (once, after the first crate).
  slow: 'МЕДЛЕННО! Ты ящик несёшь или он тебя?!',
  // The payday line: «Медленно!» -- then he storms to the table by the arm.
  payday: {
    talk: 'МЕДЛЕННО! Три ящика за полдня! Двести тысяч за железку — а она стоит. И ты стоишь. Ну я вам сейчас…',
    won: 'Дерёшься ты быстро. А таскаешь МЕДЛЕННО! Двести тысяч за железку — а она стоит… Ну я вам сейчас…',
    lost: 'Слабак. И таскаешь МЕДЛЕННО! Двести тысяч за железку — а она стоит. Ну я вам сейчас…',
  },
  slam: 'БАМ! — кулаком по столу у руки',
  slamSay: 'Хлам! Двести тысяч за памятник! Всё, я на погрузку!',
  lockPop: 'ЧТО-ТО ОТСКОЧИЛО С КОРПУСА РУКИ',
  lockSeen: 'Наклейку забыли отрезать… «ЗАЩИТА ОТ ДЕТЕЙ». Как на плите.',
  lockLoader: 'Защита от детей? На руке?! Ха. Ну вы и дети. (жуёт)',
  pryHint: 'ДЕРЖИ E — ОТЖИМАЙ',
  pryTouch: 'ПОДДЕНЬ И ТЯНИ ВПРАВО',
  pryDone: 'ЩЁЛК! ЗАЩИТА ОТЖАТА',
  buttonSeen: 'Под ней кнопка. На ней написано: print("wake").',
  press: 'E · НАЖАТЬ print("wake")',
});

// How long the shock itself lasts (the white flashes, the crackle, the fists
// jittering) before the view goes «inside» -- the dive's first stage.
export const SHOCK_MS = 1600;

export const SHOCK_WORDS = Object.freeze({
  hit: 'ТРРРЩ!',
  hitSub: 'УДАР ТОКОМ',
});

// What you see after the shock: the deep program under the hall.
export const DEEP_CODE = Object.freeze([
  'print("wake")',
  'arm.take(box)',
  'if box == "white":',
  'for box in boxes:',
  'while shift:',
  'wall.solid = True',
  'lamp.light = 0.7',
  'boss.mood = "злой"',
  'door.open()',
  'save(state)',
  'def wake():',
  'belt.speed = 0.55',
]);

// The hero's own thought once he is back from the shock: [speaker, line, button].
export const SHOCK_THOUGHT = Object.freeze([
  'ТЫ · ШИБАНУЛО',
  'Ай!.. ТОКОМ. Двести двадцать — через кнопку, через меня. Пальцы гудят. И я вижу… строчки. Под стенами — код, по проводам бегут слова, а рука 07 только что прочитала одно: print("wake"). Грузчика шибануло — и он стал супергероем? Смешно. Но я ВИЖУ.',
  'РУКА 07 ПРОСНУЛАСЬ →',
]);

// In the hall right after: people saw it.
export const AFTER_SHOCK_HALL = Object.freeze([
  ['electrician', 'Живой?! Тебя ж шибануло — аж искры! …А рука-то пошла. Ты что сделал?'],
  ['lunch', 'Током шибануло — и рука поехала. Супергерой, блин. (жуёт)'],
]);

// Day 1 end: the last straw (canon §22.6), after the boss's «заплачу меньше».
export const LAST_STRAW = 'Я так не хочу. Хочу делать нормально.';
// Day 2 morning: the button is gone (torn off).
export const DAY2_PRINCIPLE = Object.freeze({
  who: 'ТЫ · ПРО СЕБЯ',
  title: 'Кнопки нет. Он её оторвал.',
  line: '«Мне уже всё равно — я из принципа разберусь и починю. Мне понравилось, как было вчера.»',
  button: 'РАЗБЕРУСЬ →',
});
