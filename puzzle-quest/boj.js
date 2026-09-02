// Бой как в Puzzle Quest: три-в-ряд кормит ману, действия стоят маны.
// Его слова: «по сюжету проходишь, заклинания стреляешь — если три раза
// красный взорвал, то огненный шар кинул» и из очереди замыслов:
// «слева ДЖРПГ, справа три в ряд, действия стоят маны».
// Модуль НЕ трогает DOM — та же логика гоняется в node проверками и ботом.

// Цвета совпадают с CVETA в igra.js по индексу:
// 0 красный, 1 синий, 2 зелёный, 3 жёлтый, 4 фиолетовый.
export const ZAKLINANIYA = [
  { imya: 'огненный шар', cvet: 0, cena: 14, opisanie: '12 урона врагу' },
  { imya: 'оковы',        cvet: 1, cena: 12, opisanie: 'враг замирает на 3 хода' },
  { imya: 'живица',       cvet: 2, cena: 12, opisanie: '+8 здоровья себе' },
  { imya: 'молния',       cvet: 3, cena: 8,  opisanie: '5 урона врагу' },
  { imya: 'хаос',         cvet: 4, cena: 10, opisanie: 'перемешать поле' },
];

export function boj_novy() {
  return {
    hp: 30, hp_max: 30,
    vrag: 45, vrag_max: 45,
    vrag_imya: 'СТРАЖ',
    mana: [0, 0, 0, 0, 0],
    // враг бьёт каждый третий ход игрока — давление вместо лимита ходов
    do_udara: 3, mezhdu_udarami: 3, udar: 5,
    zamorozhen: 0,
    ishod: null,          // null | 'pobeda' | 'porazhenie'
  };
}

// мана капает за КАЖДЫЙ убранный камень своего цвета — длинная цепь и каскад
// кормят сильнее сами собой, отдельного правила для них не нужно
export function nabrat_manu(b, cveta) {
  for (const c of cveta) {
    if (c == null || c < 0 || c >= b.mana.length) continue;
    const z = ZAKLINANIYA.find(z => z.cvet === c);
    b.mana[c] = Math.min(b.mana[c] + 1, z.cena);
  }
}

// вызывается ПОСЛЕ каждого сделанного хода игрока (обмена, давшего совпадение).
// Возвращает, что случилось: null или 'udar' — чтобы экран и звук знали.
export function hod_proshyol(b) {
  if (b.ishod) return null;
  if (b.zamorozhen > 0) { b.zamorozhen--; return null; }
  b.do_udara--;
  if (b.do_udara > 0) return null;
  b.do_udara = b.mezhdu_udarami;
  b.hp = Math.max(0, b.hp - b.udar);
  if (b.hp <= 0) b.ishod = 'porazhenie';
  return 'udar';
}

export const gotovo = (b, i) => b.mana[ZAKLINANIYA[i].cvet] >= ZAKLINANIYA[i].cena;

// каст: проверяет ману, тратит её, применяет действие.
// Возвращает null (нельзя) или что сделано: 'uron' | 'okovy' | 'lechenie' | 'peremeshat'
// — перемешивание поля исполняет вызывающий, у боя поля нет.
export function kast(b, i) {
  if (b.ishod || !gotovo(b, i)) return null;
  const z = ZAKLINANIYA[i];
  b.mana[z.cvet] -= z.cena;
  switch (z.imya) {
    case 'огненный шар':
      b.vrag = Math.max(0, b.vrag - 12);
      if (b.vrag <= 0) b.ishod = 'pobeda';
      return 'uron';
    case 'молния':
      b.vrag = Math.max(0, b.vrag - 5);
      if (b.vrag <= 0) b.ishod = 'pobeda';
      return 'uron';
    case 'оковы':
      b.zamorozhen = 3;
      return 'okovy';
    case 'живица':
      b.hp = Math.min(b.hp_max, b.hp + 8);
      return 'lechenie';
    case 'хаос':
      return 'peremeshat';
  }
}
