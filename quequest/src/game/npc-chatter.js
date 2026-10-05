// People in the hall comment on what you do: jumping on crates, staring at the
// ceiling, standing around, earning, the arm waking up, code that worked or
// didn't. Сергей 02.10: "а НПС пусть комментируют".
//
// Pure selection logic (tools/npc-chatter.test.mjs): which line, from whom,
// and when to keep quiet. Each event has its own cooldown, there is a global
// gap so lines don't pile on each other, and a line is not repeated until the
// rest of that event's pool has been heard. Only people who are actually in
// the scene (`present`) can speak; the boss on the radio is "radio".

export const SPEAKERS = Object.freeze({
  boss: 'НАЧАЛЬНИК',
  radio: 'РАЦИЯ · НАЧАЛЬНИК',
  welder: 'СВАРЩИК',
  fitter: 'СЛЕСАРЬ',
  electrician: 'ЭЛЕКТРИК',
  lunch: 'ГРУЗЧИК',
});

// [speaker, line]. Short, in-world, no morals.
export const CHATTER = Object.freeze({
  jump: { cooldown: 9, lines: [
    ['welder', 'Ты чего скачешь? Пол не казённый, что ли?'],
    ['fitter', 'Попрыгай ещё. Глядишь, ящики сами пойдут.'],
    ['lunch', 'Мм. Физкультура. Уважаю. (жуёт)'],
    ['electrician', 'Только не на щиток. На щиток не прыгай.'],
    ['boss', 'Прыгать будешь в обед. Работай.'],
    ['radio', 'Это кто там топает? Склад, приём?'],
  ] },
  'jump-spam': { cooldown: 20, priority: 1, lines: [
    ['fitter', 'Кенгуру. Вася хоть ящики носил.'],
    ['welder', 'Сейчас допрыгаешься — шов мне собьёшь.'],
    ['lunch', 'Ты так весь обед мне растрясёшь.'],
    ['radio', 'Склад, у вас там землетрясение или стажёр?'],
  ] },
  'land-crates': { cooldown: 14, priority: 1, lines: [
    ['boss', 'С груза слезь! Это ящики, а не трибуна.'],
    ['fitter', 'О, король горы. Слезай, корону помнёшь.'],
    ['welder', 'Сверху видно, где Вася? Вот и я не вижу.'],
    ['lunch', 'Мой бутерброд оттуда видно? Не трогай.'],
    ['electrician', 'Ящики — двадцать кило. Ты — больше. Думай.'],
    ['radio', 'Если ящик треснет — из твоих двадцати вычту.'],
  ] },
  'land-belt': { cooldown: 16, priority: 2, lines: [
    ['electrician', 'С ленты слезь! Её на людей не рассчитывали.'],
    ['fitter', 'Хочешь уехать на погрузку? Там не кормят.'],
    ['boss', 'Ты груз? Нет? Тогда слезь с ленты.'],
    ['radio', 'Кто на ленте катается? Я всё слышу.'],
  ] },
  'land-high': { cooldown: 18, priority: 1, lines: [
    ['welder', 'Высоко забрался. Слезать сам будешь.'],
    ['electrician', 'Там провода под потолком. Голову береги.'],
    ['fitter', 'Альпинист. Каски нет — значит, падай мягко.'],
    ['lunch', 'Оттуда хорошо видно столовую? Завидую.'],
  ] },
  'hard-fall': { cooldown: 12, priority: 2, lines: [
    ['lunch', 'Ох. Колени не казённые, между прочим.'],
    ['fitter', 'Бум. Живой? Живой. Работай.'],
    ['welder', 'Громко упал. Красиво. Ещё раз не надо.'],
    ['boss', 'Разобьёшься — кто ящики таскать будет?'],
  ] },
  bonk: { cooldown: 12, lines: [
    ['welder', 'Балку головой не трогай, она старше тебя.'],
    ['electrician', 'Потолок крепкий. Проверено тобой.'],
  ] },
  'look-up': { cooldown: 25, lines: [
    ['lunch', 'Чего там на потолке? Лампу Вася в мае разбил.'],
    ['electrician', 'Там проводка. Не смотри так, она стесняется.'],
    ['welder', 'Небо ищешь? Нет его тут. Цех.'],
    ['boss', 'Ворон не считай. Ящики считай.'],
  ] },
  'look-down': { cooldown: 25, lines: [
    ['fitter', 'Монетку потерял? Тут до тебя всё подобрали.'],
    ['lunch', 'Крошки мои не трогай.'],
    ['welder', 'Ботинки на месте. Можно работать.'],
  ] },
  idle: { cooldown: 22, lines: [
    ['fitter', 'Стоишь? Стой. Ящики подождут. Начальник — нет.'],
    ['lunch', 'О, коллега. Тоже обед?'],
    ['welder', 'Заснул? Могу разбудить. Горелкой.'],
    ['electrician', 'Не стой под рукой. Мало ли что.'],
    ['radio', 'Склад, почему тихо? Работаем, работаем.'],
  ] },
  pick: { cooldown: 18, lines: [
    ['fitter', 'Ногами поднимай, не спиной. Спина одна.'],
    ['lunch', 'Тяжёлый? Это ещё лёгкие пошли.'],
    ['welder', 'Не урони на ногу. Мне потом отписываться.'],
  ] },
  'carry-jump': { cooldown: 16, priority: 1, lines: [
    ['boss', 'С ящиком прыгать — это смело. И глупо.'],
    ['fitter', 'Уронишь — вычтут. Прыгай дальше.'],
    ['lunch', 'Ящик с тобой прыгать не подписывался.'],
  ] },
  deliver: { cooldown: 8, lines: [
    ['welder', 'Плюс двадцать. Богатеешь.'],
    ['fitter', 'Один есть. Вася бы уже курил.'],
    ['lunch', 'Двадцать рублей. Это пол бутерброда.'],
    ['electrician', 'Лента едет. Значит, жить можно.'],
  ] },
  money: { cooldown: 4, priority: 2, lines: [
    ['lunch', 'Ого, уже при деньгах. С тебя чай.'],
    ['welder', 'Не трать всё сразу. Хотя тут не на что.'],
    ['fitter', 'Деньги считаешь? Правильно. Тут считать надо.'],
    ['radio', 'Счёт смены растёт. Это я одобряю.'],
  ] },
  'task-done': { cooldown: 6, priority: 3, lines: [
    ['boss', 'Глянь-ка. Справился. Не ожидал.'],
    ['fitter', 'Готово? Ну и славно. Я ничего не видел.'],
    ['welder', 'Сделал — молодец. Не сделал — тоже бывает.'],
    ['radio', 'Принял. Работает — не трогай.'],
  ] },
  'arm-awake': { cooldown: 30, priority: 3, lines: [
    ['electrician', 'Ожила! Я ж говорил — прошивка, не питание.'],
    ['welder', 'Смотри-ка, шевелится. А я её приварить хотел.'],
    ['fitter', 'Рука работает, а ты нет? Непорядок. Хотя...'],
    ['radio', 'Это что, рука 07 поехала? Кто трогал? Молодец.'],
  ] },
  'task-fail': { cooldown: 8, priority: 3, lines: [
    ['electrician', 'Встала. Не паникуй, глянь, что ей не нравится.'],
    ['fitter', 'Стоп машина. Бывает. У меня труба так с утра.'],
    ['welder', 'Затык. Ищи, где, а не кто.'],
    ['radio', 'Почему лента стоит? Разберись, я подожду.'],
  ] },
  clock: { cooldown: 30, priority: 2, lines: [
    ['lunch', 'Чего на часы смотришь? Одиннадцать. Обед.'],
    ['welder', 'Часы у нас точные. Обед — нет.'],
  ] },
  // 18.0 (Сергей 03.10, «каждый день сотрудники комментируют, что ты делаешь
  // и как умнеешь»): lines that react to progress, not to jumping around.
  'code-ok': { cooldown: 6, priority: 3, lines: [
    ['electrician', 'Ты ей что, написал? Словами? И она поняла?'],
    ['welder', 'Вася тыкал кнопку год. А ты — пишешь. Растёшь.'],
    ['fitter', 'Буквы набрал — ящики поехали. Я так с трубой не умею.'],
    ['lunch', 'Так можно было? (перестал жевать)'],
  ] },
  'day2-morning': { cooldown: 60, priority: 3, lines: [
    ['welder', 'О, вчерашний. Говорят, ты руку оживил. Не верю.'],
    ['fitter', 'Явился. Рука тебя ждёт, как родного.'],
    ['electrician', 'Кнопку не дёргай без дела. Хотя... дёргай.'],
    ['lunch', 'Доброе. Я тут с семи. Обед в одиннадцать.'],
  ] },
  'button-torn': { cooldown: 20, priority: 4, lines: [
    ['welder', 'Кнопку оторвал. Руку — нет. Логика начальства.'],
    ['electrician', 'Провода вырвал. А рука-то слушает терминал...'],
    ['fitter', 'Видел его лицо? Сейчас увидит ещё раз.'],
    ['lunch', 'Он так чайник «запретил». Чайник работает.'],
  ] },
  'rules-done': { cooldown: 20, priority: 3, lines: [
    ['electrician', 'Белые — да, красные — нет. Логика! Уважаю.'],
    ['welder', 'Правило придумал. Голова у тебя варит, не только руки.'],
    ['fitter', 'Красный стоит, белые едут. Вася бы перепутал.'],
  ] },
  'if-done': { cooldown: 20, priority: 4, lines: [
    ['electrician', 'Если белый — бери. Это ж как у меня в щитке.'],
    ['welder', 'Вчера кнопку жал, сегодня правила пишешь. Расту, да?'],
    ['lunch', 'Если бутерброд — ешь. Видишь, я тоже программист.'],
    ['radio', 'Красных на ленте нет. Хм. Штраф отменяется. Пока.'],
  ] },
  'day3-morning': { cooldown: 60, priority: 3, lines: [
    ['welder', 'Ночью без тебя рука скучала. Я слышал.'],
    ['fitter', 'Говорят, ты «если-то» умеешь. Почини трубу «если-то».'],
    ['electrician', 'Ты её не перегружай. Она у нас одна.'],
  ] },
});

const DEFAULT_GAP = 4.5;

// rng() -> [0, 1). now is in seconds.
export function createChatter({ rng = Math.random, gap = DEFAULT_GAP, table = CHATTER } = {}) {
  const lastByEvent = {};
  const used = {};
  let lastAt = -Infinity;
  let lastPriority = 0;
  let lastWho = null;

  function pick(event, present) {
    const def = table[event];
    if (!def) return null;
    const pool = def.lines.map((line, i) => ({ line, i })).filter(({ line }) => !present || present.has(line[0]));
    if (!pool.length) return null;
    const heard = (used[event] ??= new Set());
    let fresh = pool.filter(({ i }) => !heard.has(i));
    if (!fresh.length) { for (const { i } of pool) heard.delete(i); fresh = pool; }
    // Prefer someone other than whoever spoke last.
    const other = fresh.filter(({ line }) => line[0] !== lastWho);
    const from = other.length ? other : fresh;
    const choice = from[Math.min(from.length - 1, Math.floor(rng() * from.length))];
    heard.add(choice.i);
    return choice.line;
  }

  // Ask for a comment. Returns { who, name, text, event } or null (stay quiet).
  function say(event, now, { present = null, force = false } = {}) {
    const def = table[event];
    if (!def) return null;
    const priority = def.priority ?? 0;
    if (!force) {
      if (now - (lastByEvent[event] ?? -Infinity) < (def.cooldown ?? 10)) return null;
      // A more important line may cut in; equal or lower waits for the gap.
      if (now - lastAt < gap && priority <= lastPriority) return null;
    }
    const line = pick(event, present);
    if (!line) return null;
    lastByEvent[event] = now; lastAt = now; lastPriority = priority; lastWho = line[0];
    return { who: line[0], name: SPEAKERS[line[0]] ?? line[0], text: line[1], event };
  }

  return { say, reset() { for (const k of Object.keys(lastByEvent)) delete lastByEvent[k]; for (const k of Object.keys(used)) delete used[k]; lastAt = -Infinity; lastPriority = 0; lastWho = null; } };
}

// Watches the body and the view for comment-worthy moments: repeated jumps,
// long looks up/down, standing still. Feed it every frame; it returns event
// names to pass to chatter.say().
export function createMomentWatcher() {
  const jumps = [];
  let lookUp = 0; let lookDown = 0; let still = 0;
  return {
    jumped(now) {
      jumps.push(now);
      while (jumps.length && now - jumps[0] > 4) jumps.shift();
      return jumps.length >= 3 ? 'jump-spam' : 'jump';
    },
    // pitch: radians (+ up). moving: did the player move this frame.
    frame(dt, { pitch = 0, moving = false, busy = false } = {}) {
      const out = [];
      lookUp = pitch > 0.75 ? lookUp + dt : 0;
      lookDown = pitch < -0.75 ? lookDown + dt : 0;
      still = moving || busy ? 0 : still + dt;
      if (lookUp > 1.2) { out.push('look-up'); lookUp = -4; }
      if (lookDown > 1.2) { out.push('look-down'); lookDown = -4; }
      if (still > 14) { out.push('idle'); still = 0; }
      return out;
    },
    landed({ impact = 0, fall = 0, surface = 'floor' } = {}) {
      if (surface === 'belt') return 'land-belt';
      if (surface === 'crates') return 'land-crates';
      if (impact > 9.5 || fall > 1.7) return 'hard-fall';
      if (surface === 'high') return 'land-high';
      return null;
    },
  };
}

// Word-wrap for the pixel font speech bubble (no Ё in the font).
export function wrapBubble(text, max = 30) {
  const words = String(text).replace(/Ё/g, 'Е').replace(/ё/g, 'е').replace(/…/g, '...').split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (!cur) cur = w;
    else if ((cur + ' ' + w).length <= max) cur += ' ' + w;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}
