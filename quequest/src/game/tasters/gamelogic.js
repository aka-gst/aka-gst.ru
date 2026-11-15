// 20.x · ПРОБА «ЛОГИКА ИГР» (поведение героев и врагов; лесенка движков: готовое поведение →
// сборка из блоков → код). Тёма, 13 лет, делает арену для друзей; враг в ней тупой — то
// упирается в стену, то убивает сразу. «ТИСКИ» продают «ТИСКИ-Ассеты»: платного «умного врага»,
// которого нельзя победить без покупки ускорений. Враг — маленький автомат состояний:
// гуляет → увидел → догоняет → бьёт, а раненым убегает. Три этажа §13 на одной задаче:
//   ТЫК   — кто будет врагом;
//   РУЧКИ — как далеко видит, с какого расстояния бьёт, когда убегает, как быстро бегает;
//   КОД   — то же правило словами: видит, расстояние, здоровье → что делать.
// Модуль задаёт данные, судью ручек, судьбу случая в сцене и саму сцену; рама проб
// подключает его через src/game/tasters/index.js.
import { C, rgb, W, TOP, BOTTOM, lerp, ease, phaseOf, person, tag, wrongMark } from '../taster-art.js';

export const skill = { name: 'Поведение героев и врагов (логика игр)', guild: 'systems' };

// Шесть мгновений одного раунда. dist — шагов от врага до игрока, hp — здоровье врага,
// want — что честный враг должен сделать в этот миг.
export const GAME_MOMENTS = Object.freeze([
  { name: 'игрок далеко', dist: 12, hp: 100, want: 'patrol' },
  { name: 'игрок в пяти шагах', dist: 5, hp: 100, want: 'chase' },
  { name: 'игрок в двух шагах', dist: 2, hp: 100, want: 'chase' },
  { name: 'вплотную, враг поцарапан', dist: 1, hp: 70, want: 'attack' },
  { name: 'вплотную, враг ранен', dist: 1, hp: 20, want: 'retreat' },
  { name: 'ранен, игрок рядом', dist: 4, hp: 25, want: 'retreat' },
]);
const run = (fates, extra = {}) => ({
  actors: GAME_MOMENTS.map((m, i) => ({ name: m.name, kind: m.want, dist: m.dist, hp: m.hp, fate: fates[i], ok: fates[i] === m.want })),
  ...extra,
});

export const taster = {
  id: 'gamelogic', name: 'Создатель игр', glyph: '▶', skill: 'behave',
  title: 'ЛОГИКА ИГР · АРЕНА ТЁМЫ',
  line: 'Учишь врага в игре вести себя честно: гулять, замечать, догонять, бить и убегать раненым.',
  victim: 'Тёма', who: 'школьник, 13 лет, делает свою игру-арену для друзей',
  story: 'Тёма собрал арену, чтобы рубиться с друзьями после школы. Но враг в ней тупой: то идёт в стену, то убивает с порога. «ТИСКИ» продают «ТИСКИ-Ассеты» — «умного врага» за 490 ₽, которого нельзя победить, пока не купишь ускорения. Друзья уже зевают.',
  pay: [100, 150, 250],
  pitch: {
    fantasy: 'Враг, с которым интересно драться, — и сделал его ты.',
    verbs: ['выбрать, кто будет врагом', 'настроить врага: как видит, когда бьёт, когда убегает', 'записать поведение врага словами Python'],
    life: 'В жизни это логика игр: так собирают врагов и героев в игровых движках — от школьных проектов до больших студий.',
  },
  levels: [
    {
      way: 'tap', title: 'Кто будет врагом',
      goal: 'Чтобы друзьям Тёмы было и страшно, и честно — и хотелось ещё раунд.',
      choices: [
        { id: 'tiski', label: 'Купить «умного врага» в «ТИСКИ-Ассеты»', note: '490 ₽ и ускорения', ok: false,
          why: 'Враг «ТИСКОВ» видит через всю арену и бьёт с любого расстояния: друзья проигрывали за три секунды, а игра предлагала купить ускорение. Через десять минут все ушли.',
          run: run(['attack', 'attack', 'attack', 'attack', 'attack', 'attack'], { mode: 'tiski' }) },
        { id: 'states', label: 'Дать врагу простые состояния: гуляет → увидел → догоняет → бьёт', note: 'собрать из блоков', ok: true,
          why: 'Враг гуляет по своему кругу, замечает игрока, догоняет и бьёт вблизи — друзья визжат и прячутся. Одного он пока не умеет: убегать раненым — это в следующем уровне.',
          run: run(['patrol', 'chase', 'chase', 'attack', 'attack', 'chase'], { mode: 'states' }) },
        { id: 'stand', label: 'Пусть враг просто стоит на месте', note: 'бесплатно и без ошибок', ok: false,
          why: 'Враг стоит столбом, его обходят и забывают. Друзья зевнули: «А где тут играть?» — и включили мультики.',
          run: run(['stand', 'stand', 'stand', 'stand', 'stand', 'stand'], { mode: 'stand' }) },
      ],
    },
    {
      way: 'knobs', title: 'Настрой врага',
      goal: 'Враг — это несколько состояний и правила перехода между ними. Подкрути их так, чтобы бой был честным и друзья просили ещё раунд.',
      knobs: [
        { id: 'sight', label: 'Как далеко враг видит', options: [[3, 'на три шага'], [6, 'на шесть шагов'], [99, 'через всю арену']], start: 99 },
        { id: 'reach', label: 'С какого расстояния бьёт', options: [[1, 'только вплотную'], [3, 'за три шага'], [10, 'с другого конца арены']], start: 10 },
        { id: 'flee', label: 'Когда убегает', options: [[0, 'никогда'], [30, 'когда здоровья меньше 30'], [90, 'от первой царапины']], start: 0 },
        { id: 'speed', label: 'Как быстро бегает', options: [['slow', 'чуть медленнее игрока'], ['same', 'как игрок'], ['fast', 'вдвое быстрее игрока']], start: 'fast' },
      ],
      knobsWin: { sight: 6, reach: 1, flee: 30, speed: 'slow' },
    },
    {
      way: 'code', title: 'Враг — словами',
      goal: 'Сейчас враг знает только «вижу — бью». Добавь: раненым (здоровье меньше 30) — убегать, а бить только вплотную, иначе — догонять.',
      legend: [['видит', 'видит ли враг игрока: "да" или "нет" (за стеной — "нет")'], ['расстояние', 'сколько шагов до игрока'], ['здоровье', 'сколько здоровья у врага, от 0 до 100'], ['elif', '«иначе, если»: следующая проверка, когда первая не подошла'], ['<=', '«не больше»']],
      starter: 'if видит == "да":\n    print("АТАКА")\nelse:\n    print("ПАТРУЛЬ")',
      solution: 'if здоровье < 30:\n    print("ОТСТУПИТЬ")\nelif видит == "нет":\n    print("ПАТРУЛЬ")\nelif расстояние <= 1:\n    print("АТАКА")\nelse:\n    print("ДОГНАТЬ")',
      chips: ['if здоровье < 30:', 'elif расстояние <= 1:', 'print("ОТСТУПИТЬ")', 'print("ДОГНАТЬ")'],
      words: ['ПАТРУЛЬ', 'ДОГНАТЬ', 'АТАКА', 'ОТСТУПИТЬ'],
      cases: [
        { label: 'игрок далеко', kind: 'patrol', vars: { видит: 'нет', расстояние: 12, здоровье: 100 }, expect: 'ПАТРУЛЬ', why: 'Враг бросил свой круг и побежал за игроком, которого не видел, — друзья решили, что он читает их мысли.' },
        { label: 'игрок в пяти шагах', kind: 'chase', vars: { видит: 'да', расстояние: 5, здоровье: 100 }, expect: 'ДОГНАТЬ', why: 'Враг бил с другого конца арены — друзья сказали: нечестно, так не бывает.' },
        { label: 'вплотную', kind: 'attack', vars: { видит: 'да', расстояние: 1, здоровье: 70 }, expect: 'АТАКА', why: 'Игрок стоит прямо перед врагом, а тот не бьёт — друзья хохочут, но играть уже неинтересно.' },
        { label: 'вплотную, враг ранен', kind: 'retreat', vars: { видит: 'да', расстояние: 1, здоровье: 20 }, expect: 'ОТСТУПИТЬ', why: 'Раненый враг дрался до последнего, и бой кончился как всегда — ни одного «он убегает, добей его!».' },
        { label: 'игрок за стеной', kind: 'patrol', vars: { видит: 'нет', расстояние: 2, здоровье: 100 }, expect: 'ПАТРУЛЬ', why: 'Игрок спрятался за стеной, а враг всё равно его нашёл — прятаться в этой игре бесполезно.' },
        { label: 'ранен, игрок рядом', kind: 'retreat', vars: { видит: 'да', расстояние: 4, здоровье: 25 }, expect: 'ОТСТУПИТЬ', why: 'Враг еле живой, а всё равно бежит на игрока — глупо, друзья перестали его бояться.' },
      ],
    },
  ],
  thanks: 'Тёма: «Друзья третий вечер подряд просят ещё раунд — враг то гонится, то удирает, и его можно перехитрить. А «ТИСКИ-Ассеты» пусть продают кому-нибудь другому».',
  next: [
    'движок, где игры собирают из блоков и кода: тот же враг из состояний, только в настоящей игре, которую можно дать друзьям',
    'враги, которые работают вместе: один отвлекает, другой обходит сзади — и как проверить, что бой честный',
  ],
};

// РУЧКИ: первое, что заметит человек, — одной фразой.
export function knobs(v) {
  const sight = Number(v.sight), reach = Number(v.reach), flee = Number(v.flee), speed = v.speed;
  const fates = GAME_MOMENTS.map((m) => {
    if (m.hp < flee) return 'retreat';
    if (m.dist > sight) return 'patrol';
    if (m.dist <= reach) return 'attack';
    return speed === 'slow' ? 'chase' : 'caught';
  });
  const r = run(fates, { mode: 'states', speed });
  if (reach >= 10) return { ok: false, why: 'Враг бил с другого конца арены — друзья сказали: нечестно, так не бывает.', run: r };
  if (sight >= 99) return { ok: false, why: 'Враг видел игрока через всю арену и сразу бежал к нему — спрятаться негде, играть не во что.', run: r };
  if (speed === 'fast') return { ok: false, why: 'Враг вдвое быстрее игрока — догнал за секунду, друзья даже не поняли, откуда он взялся.', run: r };
  if (speed === 'same') return { ok: false, why: 'Враг бежит ровно как игрок — оторваться нельзя, и каждый раунд кончается одинаково.', run: r };
  if (sight <= 3) return { ok: false, why: 'Враг не замечал игрока даже в пяти шагах — друзья ходили мимо него, как мимо фонарного столба. Скучно.', run: r };
  if (reach >= 3) return { ok: false, why: 'Враг бил за три шага, не дотягиваясь мечом, — а здоровье у друзей всё равно таяло. Нечестно.', run: r };
  if (flee <= 0) return { ok: false, why: 'Раненый враг дрался до последнего, и бой кончался как всегда — ни одного «он убегает, добей его!».', run: r };
  if (flee >= 90) return { ok: false, why: 'Враг убегал от первой же царапины — друзья гонялись за ним по всей арене и заскучали.', run: r };
  return { ok: true, why: 'Враг гуляет, замечает за шесть шагов, догоняет чуть медленнее игрока, бьёт вплотную и удирает раненым — друзья кричат «добей его!» и просят ещё раунд.', run: r };
}

// КОД: что сказало правило → что враг делает в сцене.
export function fate(c) {
  return { 'ПАТРУЛЬ': 'patrol', 'ДОГНАТЬ': 'chase', 'АТАКА': 'attack', 'ОТСТУПИТЬ': 'retreat' }[c.got] ?? 'lost';
}

export const label = 'ЛОГИКА ИГР';

// ------------------------------------------------------------- сцена
// Слева экран Тёмы: арена сверху, со стенами; синяя точка — игрок, квадрат — враг, его цвет и
// подпись — состояние (гуляет / догоняет / бьёт / убегает). Под ареной — шесть мгновений раунда,
// неверные мигают. Справа — диван с друзьями: смеются, если бой честный, злятся или зевают,
// если нет. Враг «ТИСКОВ» — красный, с ценником.
const AX = 10, AY = 26, AW = 196, AH = 104;          // арена на экране
const EX = 96, EY = 76;                               // где враг стоит в начале мгновения
const STATE = {
  patrol: [rgb(120, 140, 170), 'ГУЛЯЕТ'],
  chase: [C.gold, 'ДОГОНЯЕТ'],
  attack: [C.red, 'БЬЁТ'],
  retreat: [C.green, 'УБЕГАЕТ'],
  stand: [C.dim, 'СТОИТ'],
  caught: [rgb(255, 120, 40), 'ДОГНАЛ СРАЗУ'],
  lost: [C.dim, 'ЗАВИС'],
};
const clampX = (x) => Math.max(AX + 4, Math.min(AX + AW - 8, x));
const clampY = (y) => Math.max(AY + 4, Math.min(AY + AH - 8, y));
function arena(P) {
  P.rect(AX, AY, AW, AH, rgb(26, 40, 30));
  for (let x = AX; x < AX + AW; x += 12) P.rect(x, AY, 1, AH, rgb(32, 48, 36));
  for (let y = AY; y < AY + AH; y += 12) P.rect(AX, y, AW, 1, rgb(32, 48, 36));
  P.box(AX, AY, AW, AH, rgb(120, 110, 90));
  P.rect(AX + 30, AY + 20, 6, 30, rgb(110, 100, 80)); P.rect(AX + 150, AY + 60, 30, 6, rgb(110, 100, 80));
}
function enemy(P, x, y, fateKey, mode, time) {
  const [col] = STATE[fateKey] ?? STATE.patrol;
  const body = mode === 'tiski' ? rgb(170, 30, 30) : col;
  x = Math.round(x); y = Math.round(y);
  P.rect(x, y, 8, 8, body); P.box(x, y, 8, 8, rgb(20, 20, 24));
  P.rect(x + 2, y + 2, 1, 2, C.dark); P.rect(x + 5, y + 2, 1, 2, C.dark);
  if (fateKey === 'attack' && Math.floor(time * 8) % 2) P.line(x + 8, y - 2, x + 14, y + 6, C.white);
}
function playerDot(P, x, y) { P.disc(Math.round(x), Math.round(y), 3, rgb(90, 160, 255)); P.put(Math.round(x), Math.round(y), C.white); }
function couch(P, mood, time) {
  P.rect(222, 126, 92, 14, rgb(110, 50, 60)); P.rect(222, 116, 92, 10, rgb(130, 60, 70)); P.rect(218, 118, 6, 22, rgb(90, 40, 50)); P.rect(312, 118, 6, 22, rgb(90, 40, 50));
  const bounce = mood === 'fun' ? (Math.floor(time * 6) % 2) : 0;
  const shirts = [rgb(60, 110, 200), rgb(200, 150, 60), rgb(80, 170, 110)];
  shirts.forEach((s, i) => person(P, 234 + i * 26, 104 - (i === 1 ? 0 : bounce) * 2, s, { scale: 2, frame: bounce && i === 1 ? 1 : 0 }));
  const say = { fun: ['ЕЩЁ РАУНД!', C.green], unfair: ['НЕЧЕСТНО!', C.red], bored: ['СКУЧНО', C.dim], wait: ['ДРУЗЬЯ ТЁМЫ', C.white] }[mood];
  tag(P, 266, 92, say[0], say[1]);
}
export function paint(P, view) {
  const { time, t, result, actors } = view;
  P.rect(0, TOP, W, BOTTOM - TOP, rgb(22, 20, 30));
  // экран Тёмы
  P.rect(AX - 4, AY - 8, AW + 8, AH + 32, rgb(16, 16, 20)); P.box(AX - 4, AY - 8, AW + 8, AH + 32, rgb(110, 110, 120));
  tag(P, AX + AW / 2, AY - 6, 'АРЕНА ТЁМЫ', C.gold);
  arena(P);
  person(P, 290, 140, rgb(70, 70, 160), { scale: 1 }); tag(P, 292, 150, 'ТЁМА', C.gold);
  const mode = result?.run?.mode ?? (view.level > 0 ? 'states' : 'idle');
  if (view.idle) {
    const a = time * 0.8;
    enemy(P, EX + Math.cos(a) * 40, EY + Math.sin(a) * 22, 'patrol', mode, time);
    playerDot(P, AX + 30 + ((time * 20) % (AW - 60)), AY + AH - 14);
    tag(P, EX + 4, AY + 4, 'ГУЛЯЕТ', STATE.patrol[0]);
    couch(P, 'wait', time);
    return;
  }
  // текущее мгновение: последнее, которое уже началось
  let cur = -1;
  actors.forEach((_, i) => { if (phaseOf(i, t)[0] !== 'wait') cur = i; });
  const a = actors[Math.max(0, cur)];
  if (a && cur >= 0) {
    const [ph, k] = phaseOf(cur, t);
    const dist = Number(a.dist ?? a.vars?.расстояние ?? 4), hp = Number(a.hp ?? a.vars?.здоровье ?? 100);
    const ang = cur * 1.1 + 0.4;
    const px = clampX(EX + 4 + Math.cos(ang) * dist * 8), py = clampY(EY + 4 + Math.sin(ang) * dist * 5);
    const behindWall = a.vars?.видит === 'нет' && dist < 5;
    if (behindWall) P.rect(Math.round((EX + 4 + px) / 2) - 1, Math.round((EY + 4 + py) / 2) - 8, 4, 16, rgb(110, 100, 80));
    let ex = EX, ey = EY;
    const go = ph === 'walk' ? 0 : ease(k);
    if (a.fate === 'chase') { ex = lerp(EX, px - 4, go * 0.6); ey = lerp(EY, py - 4, go * 0.6); }
    else if (a.fate === 'caught' || a.fate === 'attack') { ex = lerp(EX, px - 6, go); ey = lerp(EY, py - 4, go); }
    else if (a.fate === 'retreat') { ex = lerp(EX, EX - (px - EX) * 0.6, go); ey = lerp(EY, EY - (py - EY) * 0.6, go); }
    else if (a.fate === 'patrol') { ex = EX + Math.cos(time * 2) * 10; ey = EY + Math.sin(time * 2) * 6; }
    ex = clampX(ex); ey = clampY(ey);
    playerDot(P, px, py);
    const fk = ph === 'walk' ? 'patrol' : a.fate;
    enemy(P, ex, ey, fk, mode, time);
    // полоска здоровья врага
    P.rect(Math.round(ex), Math.round(ey) - 4, 8, 2, rgb(60, 20, 20)); P.rect(Math.round(ex), Math.round(ey) - 4, Math.max(1, Math.round(hp / 12.5)), 2, hp < 30 ? C.red : C.green);
    const [col, word] = STATE[fk] ?? STATE.lost;
    tag(P, AX + AW / 2, AY + 4, `${String(a.name).toUpperCase().slice(0, 26)}`, C.white);
    if (ph !== 'walk') tag(P, Math.round(ex) + 4, Math.round(ey) + 11, word, col);
    if (ph === 'fate' && !a.ok) wrongMark(P, Math.round(ex) + 4, Math.round(ey) + 4, time);
    if (mode === 'tiski') { P.rect(Math.round(ex) - 18, Math.round(ey) - 16, 44, 9, rgb(120, 20, 20)); tag(P, Math.round(ex) + 4, Math.round(ey) - 14, 'ТИСКИ 490 ₽', C.white); }
  }
  // шесть мгновений раунда под ареной
  actors.forEach((x, i) => {
    const [ph] = phaseOf(i, t), bx = AX + 6 + i * 32, by = AY + AH + 6;
    const col = ph === 'wait' || ph === 'walk' ? rgb(50, 50, 60) : (STATE[x.fate] ?? STATE.lost)[0];
    P.rect(bx, by, 26, 10, col); P.box(bx, by, 26, 10, i === cur ? C.white : rgb(80, 80, 90));
    if ((ph === 'fate' || ph === 'done') && !x.ok && Math.floor(time * 6) % 2) P.box(bx - 1, by - 1, 28, 12, C.red);
  });
  // друзья на диване
  const seen = actors.filter((_, i) => { const p = phaseOf(i, t)[0]; return p === 'fate' || p === 'done'; });
  const bad = seen.filter((x) => !x.ok);
  const mood = !seen.length ? 'wait' : !bad.length ? 'fun' : bad.some((x) => x.fate === 'stand' || x.fate === 'patrol' || x.fate === 'retreat') && !bad.some((x) => x.fate === 'attack' || x.fate === 'caught') ? 'bored' : 'unfair';
  couch(P, mood, time);
}
