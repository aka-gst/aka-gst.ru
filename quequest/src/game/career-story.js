// 19.0 · Месть «ТИСКАМ» (canon §18). After the five factory days the hero is
// fired; the main line is revenge on the megacorp that fired him -- not by
// breaking things, but with what he can do now. Each profession is 2-3
// quests about one named person the corporation squeezed, each with a plain
// goal: «вернуть своё». Written for someone who has never programmed.
//
// This module is pure data + pure status functions: career-worlds.js draws
// it, garage-stage.js frames the nights with it, pythonio-bridge.js sends the
// engineer frames into Pythonio, and tools/career-story.test.mjs checks it.

import { TASTERS } from './career-tasters.js';

const freeze = (v) => Object.freeze(v);

// The one name. Change it here and everything follows.
export const MEGACORP = freeze({
  name: 'ТИСКИ',
  quoted: '«ТИСКИ»',
  of: '«ТИСКОВ»',       // у «ТИСКОВ», против «ТИСКОВ»
  motto: 'Мы держим всё',
  line: 'Холдинг «ТИСКИ» держит город: завод, где тебя уволили, автосервис, который ночью открывает чужие машины, и рынок, который забирает у мастеров заказы.',
});

// ---------------------------------------------------------------- ХАКЕР
// The garage: three nights in the laptop on the bench. Each quest is one
// garage day (garage-night.js) with its own owner, story and goal.
export const HACKER_QUESTS = freeze([
  freeze({
    id: 'q-garage-vitya', day: 1, victim: 'Витя', who: 'сосед по гаражу',
    title: 'Машина Вити',
    story: 'Витя опоздал с платежом за кредит, и «ТИСКИ-Авто» решили забрать машину. Ночью их люди открывают её «по воздуху» — командой из эфира, без ключа.',
    goal: 'Научи сторожа машины пускать только Витю — по его ключу. Всех остальных — в блок.',
    win: 'Ночью машина Вити не открылась ни разу. Люди «ТИСКОВ» ушли ни с чем.',
    next: 'Витя: «Спасибо, сосед! Слушай, Лиду из фотоателье „ТИСКИ-Маркет“ душит заказами. Ты же с компом на ты — загляни к ней». Открыта профессия ИНЖЕНЕР.',
    pay: 300,
  }),
  freeze({
    id: 'q-garage-dina', day: 2, victim: 'Дина', who: 'студентка, соседка Вити',
    title: 'Магнитола Дины',
    story: '«ТИСКИ» бесплатно «обновили» Дине магнитолу. Теперь через неё они подслушивают и пробуют открыть машину. А музыку Дина любит — её выключать нельзя.',
    goal: 'Пусть магнитола меняет громкость, но не открывает и не заводит машину. Хозяйка — Дина, её ключ проходит всегда.',
    win: 'Музыка играет, а «обновление» от «ТИСКОВ» больше ничего не открывает.',
    next: 'Дина рассказала Сане из соседнего бокса. Саня зовёт: у него беда похуже.',
    pay: 600,
  }),
  freeze({
    id: 'q-garage-master', day: 3, victim: 'Саня', who: 'механик из соседнего бокса',
    title: 'Мастер-ключ «ТИСКОВ»',
    story: '«ТИСКИ» заставили Саню ставить всем клиентам свою прошивку замка. В ней спрятан мастер-ключ: всё, что приходит «из эфира», проходит без ключа.',
    goal: 'Сначала докажи Сане, что дыра есть: открой машину их приёмом, без ключа. Потом залатай замок так, чтобы этот приём больше не сработал.',
    win: 'Мастер-ключ «ТИСКОВ» больше не работает. Саня ставит клиентам твой замок.',
    next: 'Три человека вернули своё. «ТИСКИ» заметили: в гараже завёлся кто-то, кто умеет.',
    pay: 900,
  }),
]);
export const HACKER_ENTRY = HACKER_QUESTS[0].id;

// --------------------------------------------------------------- ИНЖЕНЕР
// Pythonio's first three orders, reframed: people «ТИСКИ-Маркет» squeezes.
// The mechanics are Pythonio's own (photos → cards, two lanes, two machines);
// only the people and the reason change (sent in the bridge hello).
export const ENGINEER_QUESTS = freeze([
  freeze({
    id: 'q-eng-lida', order: 'order-01', index: 0, victim: 'Лида', place: 'Фотоателье «Лида»',
    title: 'Двенадцать фотографий Лиды',
    story: '«ТИСКИ-Маркет» берёт у Лиды каталог по копейке за фото и штрафует за каждый час опоздания. Руками она не успевает.',
    goal: 'Сделай три фото руками, потом собери линию, которая доделает остальное сама.',
    letter: 'Это Лида, из фотоателье. «ТИСКИ-Маркет» ждут 12 фотографий каталога к утру — иначе штраф и бан. Первые три сделай руками, чтобы понять работу. Потом собери линию, которая доделает остальные без тебя.',
    thanks: 'Каталог готов к утру — без штрафа «ТИСКАМ». А пока линия работала, я впервые за месяц погуляла с дочкой.',
  }),
  freeze({
    id: 'q-eng-mark', order: 'order-02', index: 1, victim: 'Марк', place: 'Лавка у станции',
    title: 'Лавка Марка',
    story: 'Марк продаёт через «ТИСКИ-Маркет», а их робот путает фото товаров с описаниями — и снимает с Марка деньги «за ошибки карточек».',
    goal: 'Раздели поток: фото — в одну машину, текст — в другую. Пусть карточки Марка делает его собственная линия.',
    letter: 'Это Марк, лавка у станции. Робот «ТИСКОВ» мешает фото товаров с описаниями и штрафует меня за их же ошибки. Хочу делать карточки сам: фото — в одну машину, текст — в другую. Две понятные дорожки.',
    thanks: 'Карточки ровные, штрафов нет. Я ушёл с «ТИСКИ-Маркета» на свой сайт — правило реально разделяет поток.',
  }),
  freeze({
    id: 'q-eng-asya', order: 'order-03', index: 2, victim: 'Ася', place: 'Рынок',
    title: 'Ярмарка Аси',
    story: 'На ярмарке «ТИСКИ» поставили свою фото-будку и берут половину выручки. Ася хочет делать фото товаров у себя — но одна машина не тянет поток.',
    goal: 'Поставь вторую фото-машину и подключи так, чтобы работа делилась.',
    letter: 'Это Ася, с рынка. Будка «ТИСКОВ» берёт половину выручки за фото товаров. Сделаю сама — но сегодня ярмарка, фото в несколько раз больше. Поставь вторую машину, чтобы работа делилась.',
    thanks: 'Очередь двигалась быстро, а будка «ТИСКОВ» стояла пустая. Половина выручки осталась у нас.',
  }),
]);

// The engineer frames as Pythonio understands them: index → story text.
export function pythonioStory() {
  return ENGINEER_QUESTS.map((q) => ({ index: q.index, client: q.victim, place: q.place, letter: q.letter, thanks: q.thanks }));
}

// ---------------------------------------------------------- professions
// Seven doors. Two are full professions (ХАКЕР, ИНЖЕНЕР); five are ПРОБЫ —
// three short levels each that show what the profession will be
// (career-tasters.js). No English labels, nothing smaller than the body text.
export const FULL_MARK = 'ПРОФЕССИЯ';
export const TASTER_MARK = 'ПРОБА';
export const PROFESSIONS = freeze([
  freeze({ id: 'vehicle', name: 'Хакер', title: 'ХАКЕР · ГАРАЖ', line: 'Вскрываешь то, чем «ТИСКИ» вскрывают людей, — и закрываешь им дорогу.', quests: HACKER_QUESTS, enter: 'ИДТИ В ГАРАЖ →', full: true }),
  freeze({ id: 'automation', name: 'Инженер', title: 'ИНЖЕНЕР · МАСТЕРСКАЯ', line: 'Собираешь людям свой цех — лучше, чем у «ТИСКОВ», и без их платформы.', quests: ENGINEER_QUESTS, enter: 'К ВЕРСТАКУ ПИТОНИО →', after: HACKER_ENTRY, full: true }),
  ...TASTERS.map((t) => freeze({ id: t.id, name: t.name, title: t.title, line: t.line, enter: 'НАЧАТЬ ПРОБУ →', after: HACKER_ENTRY, taster: true })),
]);
// The final seven names, in screen order.
export const PROFESSION_TITLES = freeze(Object.fromEntries(PROFESSIONS.map((p) => [p.id, p.name])));

// --------------------------------------------------------------- status
// heldDay: the highest held garage day (career-worlds heldRealmDay), and the
// Pythonio orders done (pythonio-bridge pythonioDone) -- passed in, so this
// stays pure and free of profile shapes.
export function hackerStatus(heldDay = 0) {
  let open = true;
  return HACKER_QUESTS.map((q) => {
    const done = heldDay >= q.day;
    const status = done ? 'done' : open ? 'active' : 'locked';
    if (!done) open = false;
    return { ...q, status };
  });
}
export function engineerOpen(heldDay = 0) { return heldDay >= 1; }
export function engineerStatus(heldDay = 0, ordersDone = [], payOf = () => 0) {
  const done = new Set(ordersDone);
  let open = engineerOpen(heldDay);
  return ENGINEER_QUESTS.map((q) => {
    const isDone = done.has(q.order);
    const status = isDone ? 'done' : open ? 'active' : 'locked';
    if (!isDone) open = false;
    return { ...q, status, pay: payOf(q.index) };
  });
}
export function questById(id) {
  return HACKER_QUESTS.find((q) => q.id === id) ?? ENGINEER_QUESTS.find((q) => q.id === id) ?? null;
}
export function hackerQuestForDay(day = 1) {
  return HACKER_QUESTS.find((q) => q.day === day) ?? HACKER_QUESTS[0];
}
