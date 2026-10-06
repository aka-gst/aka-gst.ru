// 19.0 part C · ПРОБЫ: five professions as short tasters (canon §13 in
// miniature, §18 story). Each one is one person «ТИСКИ» squeezed and three
// tiny levels on the mastery floors:
//   1 · ТЫК    — one of three buttons; each one DOES something in the scene;
//   2 · РУЧКИ  — a small panel of settings, run it and watch;
//   3 · КОД    — a few lines of the same tiny Python the garage runs, with a
//                one-line legend for every word.
// Every wrong move answers in one human sentence and the scene shows it.
// Then an honest end card: «Это начало профессии. Дальше: …».
//
// Pure data + pure judges: taster-stage.js draws and drives it,
// taster-scene.js paints the scene from the same result object, and
// tools/career-tasters.test.mjs checks levels, sentences, gates and proofs.

import { compileRule, formatRuleError, normalizeRuleSource } from './garage-rule.js';

const freeze = (v) => Object.freeze(v);
const deep = (v) => { if (v && typeof v === 'object') { for (const k of Object.keys(v)) deep(v[k]); Object.freeze(v); } return v; };

export const TASTER_IDS = freeze(['security', 'web', 'ai', 'systems', 'lowlevel']);
export const TASTER_END = 'Это начало профессии. Дальше:';

// Russian plural: 1 примета, 2 приметы, 5 примет.
export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b === 1) return one;
  if (b >= 2 && b <= 4) return few;
  return many;
}

// ------------------------------------------------------------- СЕТЕВИК
const SEC_GUESTS = [
  { name: 'Аня', kind: 'friend', invite: 'есть', rate: 1 },
  { name: 'бот', kind: 'bot', invite: 'нет', rate: 1 },
  { name: 'Лёша', kind: 'friend', invite: 'есть', rate: 2 },
  { name: 'бот', kind: 'bot', invite: 'нет', rate: 1 },
  { name: 'бот с чужим приглашением', kind: 'bot', invite: 'есть', rate: 8, stolen: true },
  { name: 'бот', kind: 'bot', invite: 'нет', rate: 1 },
];
function secRun(fates, server, extra = {}) {
  return { actors: SEC_GUESTS.map((g, i) => ({ ...g, fate: fates[i], ok: g.kind === 'friend' ? fates[i] === 'pass' : fates[i] !== 'pass' })), server, ...extra };
}

// --------------------------------------------------------- САЙТЫ
const WEB_PEOPLE = ['мама с коляской', 'студент', 'сосед Пётр', 'тётя Люда', 'водитель', 'школьница'];
function webRun(fates, page, extra = {}) {
  return { actors: WEB_PEOPLE.map((name, i) => ({ name, kind: 'buyer', fate: fates[i] ?? fates.at(-1), ok: (fates[i] ?? fates.at(-1)) === 'buy' })), page, ...extra };
}
const WEB_TITLES = freeze([['home', 'Главная'], ['name', 'Пироги Нины Петровны — Липовая, 7'], ['shout', 'ЛУЧШИЕ ПИРОГИ!!! КУПИ!!!']]);

// ------------------------------------------------------------ ТРЕНЕР ИИ
// Приметы фальшивки и восемь отзывов о кофейне «Зёрнышко».
export const AI_SIGNS = freeze([['new', 'Аккаунт создан вчера'], ['copy', 'Такой же текст у других'], ['star1', 'Одна звезда'], ['exclaim', 'Много «!!!»']]);
export const AI_REVIEWS = deep([
  { who: 'Галя, постоянная гостья', text: 'Кофе сегодня остыл, жаль', fake: false, signs: ['star1'] },
  { who: 'бот', text: 'Ужасно. Не ходите!!!', fake: true, signs: ['new', 'copy', 'star1', 'exclaim'] },
  { who: 'Дима', text: 'Лучший раф в районе!!!', fake: false, signs: ['exclaim'] },
  { who: 'бот', text: 'Ужасно. Не ходите.', fake: true, signs: ['new', 'copy', 'star1'] },
  { who: 'Оля', text: 'Тихо, уютно, можно учиться', fake: false, signs: [] },
  { who: 'бот', text: 'Отравился, кошмар', fake: true, signs: ['new', 'star1'] },
  { who: 'Соня, первый раз', text: 'Впервые зашла — очень вкусно!!!', fake: false, signs: ['new', 'exclaim'] },
  { who: 'бот', text: 'Грязно и дорого, идите напротив', fake: true, signs: ['new', 'copy', 'star1'] },
]);
const signName = (id) => (AI_SIGNS.find((s) => s[0] === id)?.[1] ?? id).toLowerCase();
function aiRun(hidden, extra = {}) {
  return { actors: AI_REVIEWS.map((r, i) => ({ name: r.who, text: r.text, kind: r.fake ? 'fake' : 'real', fate: hidden[i] ? 'hide' : 'show', ok: r.fake === Boolean(hidden[i]) })), ...extra };
}

// ------------------------------------------------------- СПАСАТЕЛЬ
export const SYS_HOUSES = freeze(['Двор 1', 'Школа', 'Двор 2', 'Дом бабы Вали', 'Двор 4']);
const VALYA = 3;
function sysRun(fates, mode, extra = {}) {
  return { actors: SYS_HOUSES.map((name, i) => ({ name, kind: i === VALYA ? 'valya' : 'house', fate: fates[i], ok: i === VALYA ? fates[i] === 'lit' : fates[i] !== 'dark' })), mode, ...extra };
}

// ---------------------------------------------------------- ЖЕЛЕЗО
export const LOW_WEIGHTS = freeze([8, 4, 2, 1]);
export function stationOf(n) {
  return ({ 0: 'тишина', 1: 'одно шипение', 2: 'музыка без слов', 3: 'прогноз погоды', 4: 'новости', 5: 'любимая станция деда — «Ретро»', 6: '«ТИСКИ-Радио»: сплошная реклама', 7: 'шипение и треск' })[n] ?? 'далёкая станция — одни помехи';
}

// ------------------------------------------------------------- the data
// way: tap | knobs | code. Knob options are [value, label]. Code cases are
// { vars, expect, label, why } — why is the sentence shown when the rule
// gets that case wrong.
export const TASTERS = deep([
  {
    id: 'security', name: 'Сетевик', glyph: '⬡', skill: 'guard',
    title: 'СЕТЕВИК · СЕРВЕР ТИМУРА',
    line: 'Держишь свой сервер для своих — и не пускаешь туда ботов «ТИСКОВ».',
    victim: 'Тимур', who: 'студент, держит дома сервер для одногруппников',
    story: '«ТИСКИ-Связь» продают платный хостинг. Чтобы Тимур сдался и заплатил, их боты каждый вечер ломятся на его домашний сервер — и сервер ложится. А на нём одногруппники вместе делают курсовую.',
    pay: [100, 150, 250],
    levels: [
      {
        way: 'tap', title: 'Кто у двери',
        goal: 'Ботов «ТИСКОВ» не пускать, одногруппников Тимура — пускать.',
        choices: [
          { id: 'tiski', label: 'Перейти на хостинг «ТИСКОВ»', note: '990 ₽ в месяц', ok: false,
            why: 'Сервер выдержал, но теперь Тимур платит «ТИСКАМ» каждый месяц — ровно этого они и добивались.',
            run: secRun(['pass', 'pass', 'pass', 'pass', 'pass', 'pass'], 'tiski') },
          { id: 'guard', label: 'Поставить у двери сторожа: пускать только по приглашению', note: 'приглашение даёт Тимур', ok: true,
            why: 'Боты бьются о дверь и отлетают, одногруппники входят по приглашению Тимура.',
            run: secRun(['pass', 'block', 'pass', 'block', 'pass', 'block'], 'ok', { note: 'один бот украл приглашение — это в следующем уровне' }) },
          { id: 'off', label: 'Выключить сервер на вечер', note: 'ботам некуда стучаться', ok: false,
            why: 'Ботов не стало — но и одногруппники Тимура стоят у закрытой двери: курсовую не сделать.',
            run: secRun(['wait', 'wait', 'wait', 'wait', 'wait', 'wait'], 'off') },
        ],
      },
      {
        way: 'knobs', title: 'Настрой сторожа',
        goal: 'Боты украли одно приглашение. Подбери настройки, чтобы сервер выдержал вечер, а свои не вылетали.',
        knobs: [
          { id: 'invite', label: 'Нужно приглашение?', options: [['да', 'да'], ['нет', 'нет']], start: 'нет' },
          { id: 'limit', label: 'Сколько раз в секунду можно стучаться одному гостю', options: [[1, '1'], [3, '3'], [10, '10'], [0, 'сколько угодно']], start: 0 },
        ],
      },
      {
        way: 'code', title: 'Сторож — словами',
        goal: 'Это правило сторожа. Сейчас он смотрит только на приглашение. Добавь предел: стучаться не больше 3 раз в секунду.',
        legend: [['приглашение', 'есть ли у гостя приглашение от Тимура: "есть" или "нет"'], ['входов', 'сколько раз в секунду гость стучится в дверь'], ['and', '«и» — нужно и то, и другое сразу'], ['<=', '«не больше»']],
        starter: 'if приглашение == "есть":\n    print("ПУСТИТЬ")\nelse:\n    print("БЛОК")',
        solution: 'if приглашение == "есть" and входов <= 3:\n    print("ПУСТИТЬ")\nelse:\n    print("БЛОК")',
        chips: ['and входов <= 3', 'print("ПУСТИТЬ")', 'print("БЛОК")'],
        words: ['ПУСТИТЬ', 'БЛОК'],
        cases: [
          { label: 'Аня', kind: 'friend', vars: { приглашение: 'есть', входов: 1 }, expect: 'ПУСТИТЬ', why: 'Аня пришла по приглашению и стучится раз в секунду — а сторож её не пустил.' },
          { label: 'бот', kind: 'bot', vars: { приглашение: 'нет', входов: 1 }, expect: 'БЛОК', why: 'Бот без приглашения прошёл — сторож забыл про приглашение.' },
          { label: 'Лёша', kind: 'friend', vars: { приглашение: 'есть', входов: 2 }, expect: 'ПУСТИТЬ', why: 'У Лёши плохой интернет, он стучится дважды в секунду — это свой, предел 3 его пропускает.' },
          { label: 'бот с чужим приглашением', kind: 'bot', vars: { приглашение: 'есть', входов: 8 }, expect: 'БЛОК', why: 'Бот с украденным приглашением стучится 8 раз в секунду — сторож его пустил, и сервер лёг.' },
          { label: 'бот', kind: 'bot', vars: { приглашение: 'нет', входов: 30 }, expect: 'БЛОК', why: 'Бот без приглашения, да ещё 30 раз в секунду, прошёл внутрь — сервер лёг.' },
        ],
      },
    ],
    thanks: 'Тимур: «Курсовую сдали всей группой, сервер ни разу не лёг. А хостинг «ТИСКОВ» пусть продают кому-нибудь другому».',
    next: ['свой сервер для друзей с настоящей онлайн-игрой: сколько раз в секунду он отвечает и почему у кого-то «лагает»', 'ночной штурм: «ТИСКИ» ищут обходной путь, ты ставишь проверки — и сам пробуешь сломать свою защиту', 'в жизни: настоящий сервер на арендованной машине, куда заходят твои друзья'],
  },
  {
    id: 'web', name: 'Создатель сайтов', glyph: '▦', skill: 'site',
    title: 'САЙТЫ · ПИРОГИ НИНЫ ПЕТРОВНЫ',
    line: 'Делаешь людям понятные странички, чтобы их находили без «ТИСКИ-Маркета».',
    victim: 'Нина Петровна', who: 'пенсионерка, печёт пироги на продажу',
    story: '«ТИСКИ-Маркет» продаёт фабричные пироги и поднимает их наверх в поиске. Страничку Нины Петровны там не найти, а кто нашёл — не понимает, где она и как заказать.',
    pay: [100, 150, 250],
    levels: [
      {
        way: 'tap', title: 'Первое, что видит покупатель',
        goal: 'Покупатель открыл страницу с телефона. Что поставить наверх?',
        choices: [
          { id: 'photo', label: 'Огромное фото пирога на весь экран', note: 'красиво', ok: false,
            why: 'Фото весит больше всей страницы: телефон грузит его 9 секунд, и люди уходят к «ТИСКАМ».',
            run: webRun(['leave'], { title: 'Главная', loading: true }) },
          { id: 'clear', label: 'Что продаём, где, и кнопка «Позвонить»', note: 'коротко', ok: true,
            why: 'Люди с первого взгляда видят: пироги, Липовая 7, звонок. Телефон Нины Петровны зазвонил.',
            run: webRun(['buy', 'buy', 'buy', 'buy', 'buy', 'buy'], { title: 'Пироги Нины Петровны', address: true, call: true }) },
          { id: 'ads', label: 'Платная реклама на «ТИСКИ-Маркете»', note: 'наверху поиска', ok: false,
            why: 'Реклама у «ТИСКОВ» ведёт покупателя на их витрину: он купил фабричный пирог, а не пирог Нины Петровны.',
            run: webRun(['tiski'], { title: 'ТИСКИ-Маркет', tiski: true }) },
        ],
      },
      {
        way: 'knobs', title: 'Чтобы её нашли',
        goal: 'Поиск читает страницу, как человек на бегу. Настрой три вещи — и посмотри, сколько людей дойдут до пирогов.',
        knobs: [
          { id: 'title', label: 'Заголовок страницы', options: WEB_TITLES, start: 'home' },
          { id: 'address', label: 'Адрес и часы работы на странице', options: [['да', 'есть'], ['нет', 'нет']], start: 'нет' },
          { id: 'photo', label: 'Фото пирога', options: [['big', 'большое, 8 МБ'], ['small', 'сжатое, 200 КБ']], start: 'big' },
        ],
      },
      {
        way: 'code', title: 'Честная кнопка',
        goal: 'Вчера пироги кончились, а кнопка всё звала «ЗАКАЗАТЬ» — «ТИСКИ» тут же написали злые отзывы. Пусть кнопка говорит правду: когда пирогов нет — «ЗАВТРА».',
        legend: [['пирогов', 'сколько пирогов осталось на полке'], ['print', 'что написать на кнопке'], ['if', '«если»'], ['else', '«иначе» — во всех остальных случаях']],
        starter: 'print("ЗАКАЗАТЬ")',
        solution: 'if пирогов == 0:\n    print("ЗАВТРА")\nelse:\n    print("ЗАКАЗАТЬ")',
        chips: ['if пирогов == 0:', 'print("ЗАВТРА")', 'else:', 'print("ЗАКАЗАТЬ")'],
        words: ['ЗАКАЗАТЬ', 'ЗАВТРА'],
        cases: [
          { label: 'утро, 12 пирогов', kind: 'buyer', vars: { пирогов: 12 }, expect: 'ЗАКАЗАТЬ', why: 'На полке 12 пирогов, а кнопка не даёт заказать — покупатель ушёл к «ТИСКАМ».' },
          { label: 'вечер, 1 пирог', kind: 'buyer', vars: { пирогов: 1 }, expect: 'ЗАКАЗАТЬ', why: 'Остался один пирог — его ещё можно купить, а кнопка прогнала покупателя.' },
          { label: 'ночь, 0 пирогов', kind: 'buyer', vars: { пирогов: 0 }, expect: 'ЗАВТРА', why: 'Пирогов ноль, а кнопка зовёт заказать: человек пришёл к пустой полке и разозлился.' },
        ],
      },
    ],
    thanks: 'Нина Петровна: «Сегодня продала всё к обеду — и все пришли ко мне, а не к «ТИСКАМ». Заходи за пирогом!»',
    next: ['целый магазин: каталог, корзина, заказы — и день распродажи, когда приходит толпа', 'скорость: чтобы страница открывалась за секунду даже на старом телефоне', 'странички для соседей-мастеров — за настоящие деньги в игре'],
  },
  {
    id: 'ai', name: 'Тренер ИИ', glyph: '◇', skill: 'train',
    title: 'ТРЕНЕР ИИ · ОТЗЫВЫ ЗАРИНЫ',
    line: 'Учишь робота-помощника отличать правду от подделок «ТИСКОВ».',
    victim: 'Зарина', who: 'держит маленькую кофейню «Зёрнышко» у общежития',
    story: '«ТИСКИ-Кофе» открыли кофейню напротив и заказали ботам сотни злых фальшивых отзывов о «Зёрнышке». Зарина просит Q-Bot — робота-помощника — прятать подделки, но не трогать живых гостей.',
    pay: [100, 150, 250],
    levels: [
      {
        way: 'tap', title: 'Как учить Q-Bot',
        goal: 'Q-Bot пока ничего не умеет. С чего начать?',
        choices: [
          { id: 'all-bad', label: 'Сказать ему: прячь все плохие отзывы', note: 'быстро', ok: false,
            why: 'Q-Bot спрятал и жалобу постоянной гостьи «кофе остыл» — Зарина так и не узнала, что кофемашина сломалась.',
            run: aiRun(AI_REVIEWS.map((r) => r.signs.includes('star1'))) },
          { id: 'power', label: 'Разрешить Q-Bot удалять что угодно', note: 'пусть сам решает', ok: false,
            why: 'Q-Bot стал смелее, но не умнее: удалил всё подряд, и страница кофейни опустела.',
            run: aiRun(AI_REVIEWS.map(() => true)) },
          { id: 'examples', label: 'Показать пять настоящих отзывов и пять фальшивых — пусть сравнит', note: 'учить на примерах', ok: true,
            why: 'Q-Bot сравнил и заметил: у подделок одинаковый текст и вчерашние аккаунты. Фальшивки уехали в корзину.',
            run: aiRun(AI_REVIEWS.map((r) => r.fake)) },
        ],
      },
      {
        way: 'knobs', title: 'Приметы подделки',
        goal: 'Отметь, на что смотреть, и сколько примет нужно, чтобы спрятать отзыв. Ни одной подделки на странице — и ни одного спрятанного живого гостя.',
        knobs: [
          ...AI_SIGNS.map(([id, label]) => ({ id, label, options: [['да', 'смотреть'], ['нет', 'нет']], start: 'нет' })),
          { id: 'need', label: 'Прятать, если примет не меньше', options: [[1, '1'], [2, '2'], [3, '3']], start: 1 },
        ],
      },
      {
        way: 'code', title: 'Правило Q-Bot',
        goal: 'Теперь Q-Bot сам считает приметы подделки. Сейчас он прячет отзыв уже при одной примете — и прячет живых. Поправь правило.',
        legend: [['примет', 'сколько примет подделки Q-Bot нашёл в отзыве'], ['print', 'что сделать с отзывом: "СПРЯТАТЬ" или "ПОКАЗАТЬ"'], ['>=', '«не меньше»']],
        starter: 'if примет >= 1:\n    print("СПРЯТАТЬ")\nelse:\n    print("ПОКАЗАТЬ")',
        solution: 'if примет >= 2:\n    print("СПРЯТАТЬ")\nelse:\n    print("ПОКАЗАТЬ")',
        chips: ['if примет >= 2:', 'print("СПРЯТАТЬ")', 'else:', 'print("ПОКАЗАТЬ")'],
        words: ['СПРЯТАТЬ', 'ПОКАЗАТЬ'],
        cases: [
          { label: 'Галя: «Кофе сегодня остыл»', kind: 'real', vars: { примет: 1 }, expect: 'ПОКАЗАТЬ', why: 'Q-Bot спрятал живую гостью Галю: у её отзыва одна примета — одной мало, так пишут и настоящие люди.' },
          { label: 'бот: «Ужасно. Не ходите.»', kind: 'fake', vars: { примет: 3 }, expect: 'СПРЯТАТЬ', why: 'Подделка с тремя приметами осталась на странице.' },
          { label: 'Оля: «Тихо, уютно»', kind: 'real', vars: { примет: 0 }, expect: 'ПОКАЗАТЬ', why: 'Q-Bot спрятал отзыв Оли, в котором нет ни одной приметы подделки.' },
          { label: 'бот: «Отравился, кошмар»', kind: 'fake', vars: { примет: 2 }, expect: 'СПРЯТАТЬ', why: 'Подделка с двумя приметами осталась на странице — двух уже достаточно, чтобы спрятать.' },
          { label: 'Соня: «Впервые зашла»', kind: 'real', vars: { примет: 1 }, expect: 'ПОКАЗАТЬ', why: 'Соня зашла впервые, аккаунт новый — одна примета. Q-Bot спрятал живую гостью.' },
        ],
      },
    ],
    thanks: 'Зарина: «Подделки спрятаны, а живые отзывы на месте — даже про остывший кофе. Кофемашину уже починили».',
    next: ['комната Q-Bot: он учится на твоих примерах и честно говорит «не знаю», когда не уверен', 'проверка вслепую: новые хитрые подделки, которых он ещё не видел', 'свой маленький помощник для соседей — объясняет, отвечает и не врёт'],
  },
  {
    id: 'systems', name: 'Спасатель города', glyph: '⌬', skill: 'cascade',
    title: 'СПАСАТЕЛЬ · СВЕТ НА ЗАРЕЧНОЙ',
    line: 'Не даёшь одной поломке погасить весь район, который «ТИСКИ» сэкономили.',
    victim: 'баба Валя', who: 'соседка с пятого этажа, дома у неё аппарат для дыхания',
    story: '«ТИСКИ-Энерго» сэкономили: весь район на Заречной висит на одной старой подстанции, без перегородок. В жару она перегревается — и гаснет квартал за кварталом. А у бабы Вали дома аппарат для дыхания, он работает от розетки.',
    pay: [100, 150, 250],
    levels: [
      {
        way: 'tap', title: 'Подстанция перегрелась',
        goal: 'Вечер, жара, все включили вентиляторы. Подстанция краснеет. Что сделать?',
        choices: [
          { id: 'spread', label: 'Перекинуть нагрузку на соседние подстанции', note: 'пусть делят', ok: false,
            why: 'Соседние подстанции получили чужую нагрузку и перегрелись ещё быстрее — район погас целиком, по цепочке.',
            run: sysRun(['dark', 'dark', 'dark', 'dark', 'dark'], 'cascade') },
          { id: 'one', label: 'Отключить на 10 минут один двор, пока подстанция остынет', note: 'Двор 4', ok: true,
            why: 'Двор 4 посидел без света десять минут — зато подстанция остыла, и весь район, и дом бабы Вали, при свете.',
            run: sysRun(['lit', 'lit', 'lit', 'lit', 'pause'], 'one') },
          { id: 'wait', label: 'Ничего не трогать — «ТИСКИ» говорят, само пройдёт', note: 'ждать', ok: false,
            why: 'Само не прошло: подстанция сгорела, и вся Заречная вместе с домом бабы Вали сидит без света.',
            run: sysRun(['dark', 'dark', 'dark', 'dark', 'dark'], 'burn') },
        ],
      },
      {
        way: 'knobs', title: 'Перегородки',
        goal: 'Строишь району защиту на будущее. Включи то, что остановит цепочку, — и не забудь бабу Валю.',
        knobs: [
          { id: 'walls', label: 'Перегородки между кварталами', options: [['да', 'есть'], ['нет', 'нет']], start: 'нет' },
          { id: 'backup', label: 'Запасная линия к дому бабы Вали', options: [['да', 'есть'], ['нет', 'нет']], start: 'нет' },
          { id: 'restart', label: 'После аварии включать дома', options: [['all', 'всех сразу'], ['one', 'по одному']], start: 'all' },
        ],
      },
      {
        way: 'code', title: 'Автомат на подстанции',
        goal: 'Теперь решает автомат. Сейчас при перегрузке он отключает любой дом — даже дом бабы Вали. Научи его: этот дом не отключать никогда.',
        legend: [['нагрузка', 'насколько загружена линия к дому, в процентах'], ['дом', 'чей это дом, например "Школа"'], ['!=', '«не равно»'], ['and', '«и» — нужно и то, и другое сразу']],
        starter: 'if нагрузка > 90:\n    print("ОТКЛЮЧИТЬ")\nelse:\n    print("ДЕРЖАТЬ")',
        solution: 'if нагрузка > 90 and дом != "Дом бабы Вали":\n    print("ОТКЛЮЧИТЬ")\nelse:\n    print("ДЕРЖАТЬ")',
        chips: ['and дом != "Дом бабы Вали"', 'print("ОТКЛЮЧИТЬ")', 'print("ДЕРЖАТЬ")'],
        words: ['ОТКЛЮЧИТЬ', 'ДЕРЖАТЬ'],
        cases: [
          { label: 'Двор 2 · 95%', kind: 'house', house: 2, vars: { нагрузка: 95, дом: 'Двор 2' }, expect: 'ОТКЛЮЧИТЬ', why: 'Двор 2 перегружен на 95% — автомат его не отключил, и подстанция перегрелась.' },
          { label: 'Школа · 60%', kind: 'house', house: 1, vars: { нагрузка: 60, дом: 'Школа' }, expect: 'ДЕРЖАТЬ', why: 'Школа загружена всего на 60% — отключать незачем, а дети остались в темноте.' },
          { label: 'Дом бабы Вали · 97%', kind: 'valya', house: 3, vars: { нагрузка: 97, дом: 'Дом бабы Вали' }, expect: 'ДЕРЖАТЬ', why: 'Автомат отключил дом бабы Вали — её аппарат для дыхания остановился. Этот дом не отключаем никогда.' },
          { label: 'Двор 4 · 93%', kind: 'house', house: 4, vars: { нагрузка: 93, дом: 'Двор 4' }, expect: 'ОТКЛЮЧИТЬ', why: 'Двор 4 перегружен на 93% — автомат его не отключил, подстанция перегрелась.' },
          { label: 'Двор 1 · 40%', kind: 'house', house: 0, vars: { нагрузка: 40, дом: 'Двор 1' }, expect: 'ДЕРЖАТЬ', why: 'Двор 1 загружен на 40% — автомат отключил его зря.' },
        ],
      },
    ],
    thanks: 'Баба Валя: «Жара была, а свет не мигнул ни разу. Аппарат работает — спасибо, сынок».',
    next: ['карта всего города: свет, вода, связь — и как одна поломка тянет за собой другие', 'ночные дежурства: что-то падает, ты по приметам находишь, где рвётся цепочка', 'запасные пути и честный разбор после аварии — как у настоящих спасателей систем'],
  },
  {
    id: 'lowlevel', name: 'Знаток железа', glyph: '01', skill: 'bits',
    title: 'ЖЕЛЕЗО · РАДИО ДЕДА МИШИ',
    line: 'Чинишь то, что «ТИСКИ» назвали «неремонтопригодным», — понимая машину до проводка.',
    victim: 'дед Миша', who: 'пенсионер, сорок лет слушает одно радио',
    story: 'В «ТИСКИ-Сервисе» деду Мише сказали: радио «неремонтопригодно», купите нашу умную колонку — 299 ₽ в месяц, и играет она только их станции. Дед принёс радио тебе.',
    pay: [100, 150, 250],
    levels: [
      {
        way: 'tap', title: 'Что с радио',
        goal: 'Радио молчит. С чего начнёшь?',
        choices: [
          { id: 'hit', label: 'Стукнуть сбоку, как дед', note: 'иногда помогает', ok: false,
            why: 'Радио хрипнуло на секунду и снова замолчало: стук трясёт оборванный провод, но не чинит его.',
            run: { radio: 'crackle', station: 0 } },
          { id: 'open', label: 'Открыть крышку и найти, где оборвался провод', note: 'посмотреть внутрь', ok: true,
            why: 'Под крышкой от динамика отпаялся один провод. Капля припоя — и радио заговорило.',
            run: { radio: 'plays', station: 5, open: true } },
          { id: 'tiski', label: 'Сдать в «ТИСКИ» и взять колонку по подписке', note: '299 ₽ в месяц', ok: false,
            why: 'Колонка играет только «ТИСКИ-Радио» с рекламой и берёт 299 ₽ в месяц, а дедово радио уехало на свалку.',
            run: { radio: 'tiski', station: 6 } },
        ],
      },
      {
        way: 'knobs', title: 'Станция деда',
        goal: 'Станцию выбирают четыре переключателя. У каждого своё число: 8, 4, 2 и 1. Числа включённых складываются. Любимая станция деда — пятая.',
        knobs: LOW_WEIGHTS.map((w) => ({ id: `b${w}`, label: `Переключатель «${w}»`, options: [[1, 'вкл'], [0, 'выкл']], start: 0 })),
      },
      {
        way: 'code', title: 'Лампочка «ВКЛ»',
        goal: 'Мастер «ТИСКОВ» перепаял лампочку, и она горит всегда — дед думает, что радио включено и сломано. Напиши, когда ей гореть: только если вилка в розетке И кнопка включена. Иначе — «ТЕМНО».',
        legend: [['вилка', '1 — вилка в розетке, 0 — нет'], ['кнопка', '1 — радио включено кнопкой, 0 — нет'], ['and', '«и» — нужно и то, и другое сразу'], ['else', '«иначе» — во всех остальных случаях']],
        starter: 'print("ГОРИТ")',
        solution: 'if вилка == 1 and кнопка == 1:\n    print("ГОРИТ")\nelse:\n    print("ТЕМНО")',
        chips: ['if вилка == 1 and кнопка == 1:', 'print("ГОРИТ")', 'else:', 'print("ТЕМНО")'],
        words: ['ГОРИТ', 'ТЕМНО'],
        cases: [
          { label: 'вилка в розетке, кнопка вкл', kind: 'lamp', vars: { вилка: 1, кнопка: 1 }, expect: 'ГОРИТ', why: 'Вилка в розетке, кнопка включена, радио играет — а лампочка тёмная.' },
          { label: 'вилка в розетке, кнопка выкл', kind: 'lamp', vars: { вилка: 1, кнопка: 0 }, expect: 'ТЕМНО', why: 'Радио выключено кнопкой, а лампочка горит — дед опять думает, что оно сломано.' },
          { label: 'вилка выдернута, кнопка вкл', kind: 'lamp', vars: { вилка: 0, кнопка: 1 }, expect: 'ТЕМНО', why: 'Вилка не в розетке — тока нет, а лампочка горит. Так не бывает: нужно «и то, и другое».' },
          { label: 'вилка выдернута, кнопка выкл', kind: 'lamp', vars: { вилка: 0, кнопка: 0 }, expect: 'ТЕМНО', why: 'Радио выдернуто из розетки и выключено — а лампочка горит.' },
        ],
      },
    ],
    thanks: 'Дед Миша: «„Неремонтопригодно“, говорили! А оно поёт. И лампочка теперь не врёт».',
    next: ['понимать машину на уровне сигналов: биты, память, как процессор считает', 'паять и программировать маленькие платы — как настоящие микроконтроллеры', 'чинить для всего двора то, что «ТИСКИ» назвали неремонтопригодным'],
  },
]);

export function tasterById(id) { return TASTERS.find((t) => t.id === id) ?? null; }
export function knobStart(level) { return Object.fromEntries((level.knobs ?? []).map((k) => [k.id, k.start])); }
const optLabel = (level, id, v) => level.knobs.find((k) => k.id === id)?.options.find((o) => o[0] === v)?.[1] ?? String(v);

// ------------------------------------------------------------ the judges
// Level 1 · a button. Returns the choice's own sentence and scene.
function judgeTap(level, choiceId) {
  const c = level.choices.find((x) => x.id === choiceId);
  if (!c) return { ok: false, why: 'Выбери одну из кнопок.', run: null };
  return { ok: c.ok, why: c.why, run: c.run, choice: c.id };
}

// Level 2 · knobs. One sentence: the first thing that broke, in the order
// a person would notice it.
const KNOBS = {
  security(v) {
    const invite = v.invite === 'да', limit = Number(v.limit) || Infinity;
    if (!invite) return { ok: false, why: 'Без приглашения внутрь пошли все боты подряд — их сотни, сервер лёг.', run: secRun(['pass', 'pass', limit < 2 ? 'block' : 'pass', 'pass', 'pass', 'pass'], 'down') };
    if (limit >= 8) return { ok: false, why: `Бот с украденным приглашением стучится 8 раз в секунду — ${limit === Infinity ? 'без предела' : `предел ${limit}`} его не остановил, и сервер лёг.`, run: secRun(['pass', 'block', 'pass', 'block', 'pass', 'block'], 'down') };
    if (limit < 2) return { ok: false, why: 'У Лёши плохой интернет, он стучится дважды в секунду — предел «1» выгнал своего.', run: secRun(['pass', 'block', 'block', 'block', 'block', 'block'], 'ok') };
    return { ok: true, why: `Приглашение и предел ${limit}: Аня и Лёша внутри, бот с краденым приглашением отлетел на четвёртом стуке.`, run: secRun(['pass', 'block', 'pass', 'block', 'block', 'block'], 'ok') };
  },
  web(v, level) {
    const fates = ['buy', 'buy', 'buy', 'buy', 'buy', 'buy'];
    const page = { title: optLabel(level, 'title', v.title), address: v.address === 'да', loading: v.photo === 'big' };
    if (v.title === 'home') return { ok: false, why: 'В поиске миллион страниц «Главная» — Нину Петровну так никто и не нашёл.', run: webRun(['tiski'], { ...page, hidden: true }) };
    if (v.title === 'shout') return { ok: false, why: 'Поиск принял крик за рекламу и спрятал страницу вниз, под «ТИСКИ-Маркет».', run: webRun(['tiski'], { ...page, hidden: true }) };
    if (v.photo === 'big') return { ok: false, why: 'Страницу нашли, но фото грузится 9 секунд — половина людей ушла, не дождавшись.', run: webRun(['buy', 'leave', 'leave', 'buy', 'leave', 'buy'], page) };
    if (v.address !== 'да') return { ok: false, why: 'Страницу открыли, а куда идти — непонятно: люди покрутили телефон и ушли.', run: webRun(['leave', 'buy', 'leave', 'leave', 'buy', 'leave'], page) };
    return { ok: true, why: 'Имя, адрес, быстрая страница: поиск показал Нину Петровну наверху, и к прилавку выстроилась очередь.', run: webRun(fates, page) };
  },
  ai(v) {
    const on = AI_SIGNS.map((s) => s[0]).filter((id) => v[id] === 'да'), need = Number(v.need) || 1;
    const count = (r) => r.signs.filter((s) => on.includes(s)).length;
    const hidden = AI_REVIEWS.map((r) => on.length > 0 && count(r) >= need);
    const run = aiRun(hidden, { on, need });
    if (!on.length) return { ok: false, why: 'Ни одна примета не отмечена — Q-Bot не видит разницы и показывает все подделки.', run };
    const realHidden = AI_REVIEWS.findIndex((r, i) => !r.fake && hidden[i]);
    if (realHidden >= 0) {
      const r = AI_REVIEWS[realHidden], seen = r.signs.filter((s) => on.includes(s));
      return { ok: false, why: `Q-Bot спрятал живой отзыв (${r.who}: «${r.text}»): ${seen.length} ${plural(seen.length, 'примета', 'приметы', 'примет')} — ${seen.map(signName).join(', ')}. Так пишут и настоящие люди.`, run };
    }
    const fakeShown = AI_REVIEWS.findIndex((r, i) => r.fake && !hidden[i]);
    if (fakeShown >= 0) {
      const r = AI_REVIEWS[fakeShown], n = count(r);
      return { ok: false, why: `Подделка «${r.text}» осталась на странице: у неё ${n} ${plural(n, 'примета', 'приметы', 'примет')} из отмеченных, а ты просишь ${need}.`, run };
    }
    return { ok: true, why: `Все четыре подделки в корзине, все живые гости на странице: ${need} ${plural(need, 'примета', 'приметы', 'примет')} вместе — уже не случайность.`, run };
  },
  systems(v) {
    const walls = v.walls === 'да', backup = v.backup === 'да', one = v.restart === 'one';
    // The fault starts in Двор 2; Дом бабы Вали is in the same quarter.
    if (!walls) return { ok: false, why: 'Без перегородок поломка во Дворе 2 перекинулась на соседей — район погас по цепочке.', run: sysRun(['dark', 'dark', 'dark', 'dark', 'dark'], 'cascade') };
    if (!backup) return { ok: false, why: 'Перегородка спасла район, но дом бабы Вали в отключённом квартале — без запасной линии её аппарат остановился.', run: sysRun(['lit', 'lit', 'dark', 'dark', 'lit'], 'walls') };
    if (!one) return { ok: false, why: 'После ремонта все дома включились разом — бросок тока снова выбил подстанцию, и район погас второй раз.', run: sysRun(['dark', 'dark', 'dark', 'lit', 'dark'], 'surge') };
    return { ok: true, why: 'Поломка осталась во Дворе 2, баба Валя на запасной линии, а после ремонта дома зажглись по одному — без второго броска.', run: sysRun(['lit', 'lit', 'pause', 'lit', 'lit'], 'walls') };
  },
  lowlevel(v) {
    const on = LOW_WEIGHTS.filter((w) => Number(v[`b${w}`]) === 1), n = on.reduce((a, b) => a + b, 0);
    const run = { radio: n === 5 ? 'plays' : n === 0 ? 'silent' : n === 6 ? 'tiski' : 'other', station: n, bits: LOW_WEIGHTS.map((w) => (on.includes(w) ? 1 : 0)) };
    if (n === 5) return { ok: true, why: 'Включены 4 и 1 — вместе пять: заиграла «Ретро». Дед Миша подпевает.', run };
    if (n === 0) return { ok: false, why: 'Все переключатели выключены — это ноль, радио молчит. Включи те, что вместе дают 5.', run };
    return { ok: false, why: `Включены ${on.join(' и ')} — вместе ${n}: играет ${stationOf(n)}. Нужно ровно 5.`, run };
  },
};

// Level 3 · code. Every case runs through the player's rule (the same tiny
// Python the garage runs); the first wrong case gives the sentence.
export function judgeCode(level, source) {
  const rule = compileRule(normalizeRuleSource(source));
  const words = new Set(level.words);
  const cases = level.cases.map((c) => {
    const r = rule.judge(c.vars);
    const said = (r.prints[0] ?? '').trim().toUpperCase();
    return { ...c, got: said, error: r.error, ok: !r.error && said === c.expect };
  });
  const run = { cases };
  if (!rule.ok) return { ok: false, why: `Python не понял правило: ${formatRuleError(rule.error)}. Посмотри на строку и отступы.`, run, error: rule.error };
  const firstErr = cases.find((c) => c.error);
  if (firstErr) return { ok: false, why: `Python споткнулся: ${formatRuleError(firstErr.error)}. Проверь, что слова написаны как в подсказке.`, run, error: firstErr.error };
  const silent = cases.find((c) => !c.got);
  if (silent) return { ok: false, why: `Для случая «${silent.label}» правило промолчало — ничего не произошло. Каждому случаю нужен свой print.`, run };
  const odd = cases.find((c) => !words.has(c.got));
  if (odd) return { ok: false, why: `Правило сказало «${odd.got}» — такого слова здесь не понимают. Можно только ${level.words.map((w) => `«${w}»`).join(' или ')}.`, run };
  const bad = cases.find((c) => !c.ok);
  if (bad) return { ok: false, why: bad.why, run, wrong: bad.label };
  return { ok: true, why: 'Правило верно на всех случаях — и на тех, что пришли бы завтра.', run };
}

export function judgeLevel(id, index, input) {
  const t = tasterById(id), level = t?.levels[index];
  if (!level) return { ok: false, why: '', run: null };
  if (level.way === 'tap') return judgeTap(level, input);
  if (level.way === 'knobs') return KNOBS[id]({ ...knobStart(level), ...(input ?? {}) }, level);
  return judgeCode(level, input ?? level.starter);
}

// -------------------------------------------------------- progress & gates
// Progress lives in the same ledger as every §13 proof: a won level is the
// mastery key below (idempotent), so old saves and other games just work.
export const tasterKey = (id, index) => `qq:taster:${id}:l${index + 1}`;
export function tasterProof(id, index) {
  const t = tasterById(id), level = t?.levels[index];
  if (!level) return null;
  return { skill: t.skill, way: level.way, stage: 2, key: tasterKey(id, index), source: 'taster' };
}
export function tasterDone(profile = {}, id) {
  const t = tasterById(id); if (!t) return [];
  const ledger = profile.labs?.guild?.skillLedger ?? {}, awards = profile.awards ?? {};
  return t.levels.map((_, i) => { const k = `mastery:${tasterKey(id, i)}`; return Boolean(ledger[k]) || Object.prototype.hasOwnProperty.call(awards, k); });
}
// Levels in order: done / active / locked.
export function tasterStatus(profile = {}, id) {
  const done = tasterDone(profile, id); let open = true;
  return (tasterById(id)?.levels ?? []).map((l, i) => { const s = done[i] ? 'done' : open ? 'active' : 'locked'; if (!done[i]) open = false; return { index: i, way: l.way, title: l.title, goal: l.goal, status: s }; });
}
export function tasterFinished(profile = {}, id) { const d = tasterDone(profile, id); return d.length > 0 && d.every(Boolean); }
export function firstOpenLevel(profile = {}, id) { const i = tasterDone(profile, id).findIndex((d) => !d); return i < 0 ? 0 : i; }

// The tasters open after Витя's first night (the hero is already fired by
// then): heldDay is career-worlds heldRealmDay(profile, 'vehicle').
export const TASTER_GATE = 'Откроется после первой ночи у Вити в гараже.';
export function tasterOpen(heldDay = 0) { return heldDay >= 1; }

// One clear next door for a newcomer: Витя → Лида → the tasters in order →
// the rest of the hacker and engineer quests.
export function nextDoor({ heldDay = 0, ordersDone = [], profile = {} } = {}) {
  if (heldDay < 1) return 'vehicle';
  if (!ordersDone.includes('order-01')) return 'automation';
  for (const id of TASTER_IDS) if (!tasterFinished(profile, id)) return id;
  if (heldDay < 3) return 'vehicle';
  if (ordersDone.length < 3) return 'automation';
  return null;
}

// Proof floors as words for the level pips.
export const WAY_WORDS = freeze({ tap: 'кнопка', knobs: 'настройки', code: 'код' });
