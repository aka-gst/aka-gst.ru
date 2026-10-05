// Доска Сани и его шкаф в гараже: вещи под E (добавляются в fp-world.js
// thingsNow(), fp-levels.js не трогаем), их спрайты, реплики Сани и Вити,
// и учебные карточки — только в общих словах: как замок держит закрытым и
// как сильные конструкции защищают себя. Никаких «слабых мест» реальных замков.
import { rgb } from '../raycaster.js';

const freeze = Object.freeze;
const T = (id, kind, x, z, y, label, extra = {}) => freeze({ id, kind, x, z, y, label, reach: 1.8, ...extra });

export const BENCH_THINGS = freeze([
  T('lockboard', 'lockboard', 1.62, 3.35, 1.15, 'ДОСКА САНИ · ПРАКТИКА ЗАМКОВ', { reach: 1.9 }),
  T('cabinet', 'cabinet', 7.6, 1.3, 1.1, 'ШКАФ САНИ · ОТКРЫТЬ', { reach: 1.9, radius: 0.5 }),
]);
export const isBenchThing = (t) => Boolean(t && BENCH_THINGS.some((b) => b.id === t.id));

function sheet(rows, palette, ppm) {
  const h = rows.length, w = rows[0].length;
  const data = new Uint32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = palette[rows[y][x]];
    data[y * w + x] = c ? rgb(c[0], c[1], c[2]) : 0;
  }
  return { w, h, data, ppm };
}

// A pegboard with practice devices on it; a tall steel cabinet with a dial.
const BOARD = sheet([
  'WWWWWWWWWWWWWWWW', 'WbbbbbbbbbbbbbbW', 'WbGGbbYYbbGGbbbW', 'WbGOGbYOYbGOGbbW', 'WbGGbbYYbbGGbbbW', 'WbbbbbbbbbbbbbbW',
  'WbbYYbbGGbbYYbbW', 'WbYOYbGOGbYOYbbW', 'WbbYYbbGGbbYYbbW', 'WbbbbbbbbbbbbbbW', 'WbbKKKKKKKKKbbbW', 'WbbKCCCCCCCKbbbW', 'WWWWWWWWWWWWWWWW',
], { W: [120, 84, 48], b: [176, 140, 92], G: [150, 156, 166], Y: [220, 170, 60], O: [40, 40, 44], K: [30, 32, 36], C: [110, 240, 200] }, 26);
const CABINET = sheet([
  'KKKKKKKKKKKKKK', 'KSSSSSSSSSSSSK', 'KSssssssssssSK', 'KSsLLLLLLLLsSK', 'KSssssssssssSK', 'KSsssYYYYsssSK', 'KSssYOOOOYssSK', 'KSssYOROOYssSK',
  'KSssYOOOOYssSK', 'KSsssYYYYsssSK', 'KSssssssssssSK', 'KSssssssssHsSK', 'KSssssssssHsSK', 'KSssssssssssSK', 'KSsLLLLLLLLsSK',
  'KSssssssssssSK', 'KSssssssssssSK', 'KSssssssssssSK', 'KSsLLLLLLLLsSK', 'KSssssssssssSK', 'KSSSSSSSSSSSSK', 'KK..........KK',
], { K: [24, 26, 30], S: [70, 92, 96], s: [96, 122, 126], L: [60, 78, 82], Y: [214, 170, 80], O: [20, 30, 32], R: [232, 70, 50], H: [200, 200, 190] }, 15);
const CABINET_OPEN = sheet(CABINET_ROWS_OPEN(), { K: [24, 26, 30], S: [70, 92, 96], d: [16, 18, 20], g: [120, 240, 160], Y: [214, 170, 80] }, 15);
function CABINET_ROWS_OPEN() {
  const rows = [];
  for (let y = 0; y < 22; y++) {
    if (y === 0) rows.push('KKKKKKKKKKKKKK');
    else if (y === 21) rows.push('KK..........KK');
    else if (y === 20) rows.push('KSSSSSSSSSSSSK');
    else rows.push(`KS${y === 6 || y === 12 ? 'YYYYYYYYYY' : y === 5 ? 'ddggddddgg' : 'dddddddddd'}SK`);
  }
  return rows;
}
export const BENCH_SPRITES = freeze({ board: BOARD, cabinet: CABINET, cabinetOpen: CABINET_OPEN });

// [img, x, z, y, extra] for fp-world.js sprites(); the cabinet stands open
// while its overlay says so.
export function benchSprites({ cabinetOpen = false } = {}) {
  return [
    [BOARD, 1.3, 3.35, 1.05, { fullbright: false }],
    [cabinetOpen ? CABINET_OPEN : CABINET, 7.6, 1.3, 0, { fullbright: false }],
  ];
}

export const SANYA = 'САНЯ';
// Lines are < 90 chars (tools/fp-world.test.mjs checks the whole table).
export const LOCK_CHATTER = freeze({
  'locks-board': { cooldown: 6, priority: 2, lines: [['sanya', 'Моя доска. Всё выдуманное, всё честное: слушай, а не угадывай.'], ['sanya', 'Вороток — мягко. Замок не любит, когда на него давят.'], ['neighbor', 'Опять Санины железки? Только не ночью, он громко щёлкает.']] },
  'locks-open': { cooldown: 2, priority: 3, lines: [['sanya', 'Щёлк! Вот. Не силой — пониманием.'], ['sanya', 'Открыл. Теперь подумай, как бы ты его сделал крепче.'], ['neighbor', 'Щёлкнуло? Ну ты прям Саня-два.'], ['radio', 'Тут у слушателя что-то щёлкнуло. Надеемся, это успех.']] },
  'locks-echo': { cooldown: 6, priority: 1, lines: [['sanya', 'Заклинило. Отпусти вороток, не дёргай.'], ['sanya', 'Не тот штифт. Механизм сразу сказал — ты услышал?']] },
  'locks-false-set': { cooldown: 8, priority: 1, lines: [['sanya', 'Обманка! Села понарошку. Чуть ослабь — и ещё раз её.'], ['sanya', 'Ага, ЛИСА хитрит. Меньше натяжения, та же обманка.']] },
  'locks-seized': { cooldown: 6, priority: 2, lines: [['sanya', 'Видишь? Он сам всё сбросил. Хорошая конструкция себя бережёт.'], ['sanya', 'Витя, я его не ломал. Он так защищается.']] },
  'locks-relock': { cooldown: 8, priority: 1, lines: [['sanya', 'Штифт упал — время вышло. У МЕТРОНОМА свой темп.'], ['sanya', 'Поздно. Держи ритм.']] },
  'locks-noise': { cooldown: 5, priority: 2, lines: [['neighbor', 'Что за трактор?! Выключи генератор, полночь!'], ['radio', 'Слышим тарахтение в эфире. Кто-то любит быстро.'], ['sanya', 'Быстро, да. Зато весь двор знает, что ты у шкафа.']] },
  'locks-cabinet-look': { cooldown: 6, priority: 2, lines: [['sanya', 'Мой шкаф. Три пути внутрь — выбери свою цену.'], ['neighbor', 'Санин шкаф? Только генератор не заводи, умоляю.']] },
  'locks-cabinet': { cooldown: 2, priority: 3, lines: [['sanya', 'Шкаф открыт. Тихо или громко — ты выбирал сам.'], ['neighbor', 'О, Санин шкаф. А пиво там есть?'], ['sanya', 'Три пути — три цены. Так и в настоящей защите.']] },
  'locks-python': { cooldown: 2, priority: 3, lines: [['sanya', 'Ты описал мой механизм кодом. Теперь ты его понимаешь.'], ['me', 'if, elif, else — и железка стала понятной.']] },
});

// Educational cards. General principles only, unlocked as the board opens.
export const LOCK_CARDS = freeze([
  freeze({ id: 'zachem', after: 'sota', title: 'Как замок держит закрытым', text: 'Замок — это преграда, которая уступает только одному правильному набору условий: ключу, коду, карте. На всё остальное у неё один ответ — «нет». В мини-игре этот набор выдуман: полоса натяжения и порядок штифтов.' }),
  freeze({ id: 'dopusk', after: 'meduza', title: 'Чем точнее, тем молчаливее', text: 'Любая деталь сделана с допуском. Хорошая конструкция делает допуски маленькими и одинаковыми, чтобы снаружи было нечего «услышать». В коде то же: система не должна выдавать лишнего о своём устройстве.' }),
  freeze({ id: 'obmanka', after: 'obmanka', title: 'Ложный ответ — тоже защита', text: 'Стойкие устройства иногда отвечают «почти да», чтобы перебор стал долгим и утомительным. На сайтах так же: «неверный логин или пароль» — без уточнения, что именно не так.' }),
  freeze({ id: 'ritm', after: 'mayak', title: 'Время как часть ключа', text: 'Если правильный ответ меняется со временем, старый подсмотренный уже не подходит. Так работают одноразовые коды в приложении и ключи, которые живут минуты.' }),
  freeze({ id: 'samosbros', after: 'chasovoy', title: 'Самозащита и лимит попыток', text: 'После нескольких грубых ошибок ЧАСОВОЙ сбрасывает всё сам. В цифровом мире это лимит попыток и временная блокировка: перебор перестаёт окупаться.' }),
  freeze({ id: 'sloi', after: 'kit', title: 'Слои, а не одна дверь', text: 'Замок — только один слой. Рядом свет, соседи, сигнализация, журнал. Шлюз синей машины устроен так же: правило, подпись команды, проверка источника.' }),
  freeze({ id: 'puti', after: 'cabinet', title: 'Каждый путь внутрь — это дверь', text: 'У шкафа три пути, и у каждого цена: время, шум, расходник. Чем больше способов открыть, тем больше нужно охранять. Громкий путь заметен — поэтому полезны журналы и тревоги.' }),
]);
