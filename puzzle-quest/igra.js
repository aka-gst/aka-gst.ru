// Три-в-ряд: сетка, падение, каскады, цель уровня, невозможность застрять.
// Поле НЕ обязано быть прямоугольным — форма задаётся текстом (см. FORMY ниже).
export const CVETA = ['#e8465e', '#3aa0ff', '#33cc77', '#ffcc3a', '#b06cff'];

// ТРИ разных значения в клетке, и путать их нельзя:
//   число 0..4 — камень такого цвета;
//   null       — клетка ЕСТЬ, но пуста: сюда камень упадёт;
//   NET        — клетки НЕТ вовсе: сквозь неё не падают, не меняются и не совпадают.
export const NET = -1;

// ФОРМА ПОЛЯ — данные, а не код. X — клетка есть, точка — клетки нет.
// Новый уровень заводится строкой в этом списке, логику трогать не надо.
export const FORMY = {
  // как в MysteryMatch (кадр ref/g150.png): тело 9×8, сверху выступ в 7 клеток
  mysterymatch: [
    '.XXXXXXX.',
    'XXXXXXXXX',
    'XXXXXXXXX',
    'XXXXXXXXX',
    'XXXXXXXXX',
    'XXXXXXXXX',
    'XXXXXXXXX',
    'XXXXXXXXX',
    'XXXXXXXXX',
  ],
  // прежнее поле — оставлено как отрицательный контроль: числа на нём обязаны
  // совпадать с теми, что сняты до появления формы (42% из 120 партий)
  kvadrat8: [
    'XXXXXXXX', 'XXXXXXXX', 'XXXXXXXX', 'XXXXXXXX',
    'XXXXXXXX', 'XXXXXXXX', 'XXXXXXXX', 'XXXXXXXX',
  ],
  // тот же размер, что у mysterymatch, но без дыр — чтобы отделить вклад
  // размера от вклада самой дырки
  kvadrat9: [
    'XXXXXXXXX', 'XXXXXXXXX', 'XXXXXXXXX', 'XXXXXXXXX', 'XXXXXXXXX',
    'XXXXXXXXX', 'XXXXXXXXX', 'XXXXXXXXX', 'XXXXXXXXX',
  ],
  // песочные часы: дыры ВНУТРИ столбцов, а не по краям. Здесь камень обязан
  // ложиться на отсутствующую клетку, как на пол
  chasy: [
    'XXXXXXXX',
    'XXXXXXXX',
    '.XXXXXX.',
    '..XXXX..',
    '..XXXX..',
    '.XXXXXX.',
    'XXXXXXXX',
    'XXXXXXXX',
  ],
  // крест: два столбца разрезаны дырой пополам
  krest: [
    '..XXXX..',
    '..XXXX..',
    'XXXXXXXX',
    'XXXXXXXX',
    'XXXXXXXX',
    'XXXXXXXX',
    '..XXXX..',
    '..XXXX..',
  ],
};

export const FORMA = FORMY.mysterymatch;

// --- геометрия. Размер живёт в самом поле, а не в константе рядом с ним:
// иначе форму меняют в одном месте, а ширину читают из другого.
export const shirina = p => p[0].length;
export const vysota  = p => p.length;
export const nomer = (p, x, y) => y * p[0].length + x;
export const koord = (p, i) => ({ x: i % p[0].length, y: Math.floor(i / p[0].length) });
export const est_kletka = (p, x, y) =>
  y >= 0 && y < p.length && x >= 0 && x < p[0].length && p[y][x] !== NET;

export function pole(rnd = Math.random, forma = FORMA) {
  // рождаем поле БЕЗ готовых троек — иначе игра начинается со взрыва не по воле игрока
  const V = forma.length, S = forma[0].length, p = [];
  for (let y = 0; y < V; y++) {
    p[y] = [];
    for (let x = 0; x < S; x++) {
      if (forma[y][x] !== 'X') { p[y][x] = NET; continue; }
      let c, popytok = 0;
      do {
        c = Math.floor(rnd() * CVETA.length);
        popytok++;
      } while (popytok < 30 && (
        (x >= 2 && p[y][x-1] === c && p[y][x-2] === c) ||
        (y >= 2 && p[y-1][x] === c && p[y-2][x] === c)));
      p[y][x] = c;
    }
  }
  return p;
}

// все совпадения на поле: горизонтали и вертикали от трёх.
// ЧЕРЕЗ ОТСУТСТВУЮЩУЮ КЛЕТКУ РЯД НЕ СКЛЕИВАЕТСЯ: NET не равен ни одному цвету,
// поэтому пробег обрывается на ней сам. А начать пробег С неё нельзя явно —
// иначе три дырки подряд посчитались бы «совпадением дырок».
export function najti(p) {
  const V = vysota(p), S = shirina(p), est = new Set();
  for (let y = 0; y < V; y++)
    for (let x = 0; x < S - 2; x++) {
      const c = p[y][x];
      if (c == null || c === NET) continue;
      let n = 1; while (x + n < S && p[y][x+n] === c) n++;
      if (n >= 3) { for (let i = 0; i < n; i++) est.add(y * S + x + i); x += n - 1; }
    }
  for (let x = 0; x < S; x++)
    for (let y = 0; y < V - 2; y++) {
      const c = p[y][x];
      if (c == null || c === NET) continue;
      let n = 1; while (y + n < V && p[y+n][x] === c) n++;
      if (n >= 3) { for (let i = 0; i < n; i++) est.add((y + i) * S + x); y += n - 1; }
    }
  return est;
}

export function menyat(p, a, b) {
  const t = p[a.y][a.x]; p[a.y][a.x] = p[b.y][b.x]; p[b.y][b.x] = t;
}

// даёт ли обмен совпадение — без этого игрок может двигать что угодно и ничего не происходит.
// Обмен с несуществующей клеткой запрещён здесь, а не в каждом вызывающем:
// иначе правило пришлось бы повторять в поле, в боте и в проверках — и где-то забыли бы.
export function hod_dayot(p, a, b) {
  if (!est_kletka(p, a.x, a.y) || !est_kletka(p, b.x, b.y)) return false;
  menyat(p, a, b);
  const est = najti(p).size > 0;
  menyat(p, a, b);
  return est;
}

// ЕСТЬ ЛИ ХОТЬ ОДИН ХОД. Это и есть «застрять невозможно» — главное, что он назвал
export function est_hod(p) {
  const V = vysota(p), S = shirina(p);
  for (let y = 0; y < V; y++)
    for (let x = 0; x < S; x++) {
      if (x < S - 1 && hod_dayot(p, {x,y}, {x:x+1,y})) return true;
      if (y < V - 1 && hod_dayot(p, {x,y}, {x,y:y+1})) return true;
    }
  return false;
}

// убрать совпавшие, сдвинуть вниз, досыпать сверху.
// возвращает, откуда каждый камень падал — это нужно звуку: высота меняет тон.
// ПАДЕНИЕ ОСТАНАВЛИВАЕТСЯ НА ГРАНИЦЕ ФОРМЫ: столбец делится дырами на отрезки,
// в каждом своя гравитация и свой досып сверху. Отсутствующая клетка — пол.
export function uronit(p, ubrat, rnd = Math.random) {
  const V = vysota(p), S = shirina(p);
  ubrat.forEach(i => { p[Math.floor(i / S)][i % S] = null; });
  const padeniya = [];
  for (let x = 0; x < S; x++) {
    let niz = V - 1;
    while (niz >= 0) {
      if (p[niz][x] === NET) { niz--; continue; }
      let verh = niz;
      while (verh - 1 >= 0 && p[verh - 1][x] !== NET) verh--;
      let pusto = 0;
      for (let y = niz; y >= verh; y--) {
        if (p[y][x] === null) pusto++;
        else if (pusto) {
          p[y + pusto][x] = p[y][x]; p[y][x] = null;
          padeniya.push({ x, y: y + pusto, s_vysoty: pusto });
        }
      }
      // досыпаем снизу вверх — тот же порядок, что был у прямоугольного поля,
      // иначе те же кости легли бы в другие клетки и прежние числа не сошлись бы
      for (let y = verh + pusto - 1; y >= verh; y--) {
        p[y][x] = Math.floor(rnd() * CVETA.length);
        padeniya.push({ x, y, s_vysoty: pusto - (y - verh) + 2 });
      }
      niz = verh - 1;
    }
  }
  return padeniya;
}

// тупик лечится перемешиванием, а не проигрышем — «застрять навсегда невозможно».
// Перемешиваются только существующие клетки: дырка обязана остаться дыркой.
export function peremeshat(p, rnd = Math.random) {
  const V = vysota(p), S = shirina(p), vse = [];
  for (let y = 0; y < V; y++) for (let x = 0; x < S; x++)
    if (p[y][x] !== NET) vse.push(p[y][x]);
  for (let popytka = 0; popytka < 60; popytka++) {
    for (let i = vse.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [vse[i], vse[j]] = [vse[j], vse[i]];
    }
    let k = 0;
    for (let y = 0; y < V; y++) for (let x = 0; x < S; x++)
      if (p[y][x] !== NET) p[y][x] = vse[k++];
    if (najti(p).size === 0 && est_hod(p)) return true;
  }
  return false;
}
