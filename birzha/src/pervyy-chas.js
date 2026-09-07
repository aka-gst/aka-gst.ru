/* Первый час торговой учебной игры — чистая механика без экрана.
   Спецификация Сергея (голосовая постановка 6 сентября 2026): «одна новая причина думать каждые
   10–15 минут», пять фаз, ровно три траты за час, богатство видно вокруг терминала, а не только в числе.
   Настоящих денег, ключей и автоторговли здесь нет и быть не может: это симулятор с выдуманными
   ценами и выдуманными советниками.

   Отдельно от разметки нарочно: во-первых, механику так можно проверить тестами, во-вторых, у Сергея
   веб — прототип, а движок — продукт, и логика должна переноситься без переписывания. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PervyyChas = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const ЧАС = 60;
  // Пять фаз ровно из таблицы, утверждённой Сергеем. Каждая приносит ОДНУ новую причину думать.
  const ФАЗЫ = [
    { от: 0, до: 10, ключ: 'sovet', имя: 'Совет не равен истине', новое: 'Советник даёт совет, и его можно проверить только исходом' },
    { от: 10, до: 20, ключ: 'lenta', имя: 'У события есть дата', новое: 'Новостная лента и календарь: у события есть дата и горизонт' },
    { от: 20, до: 35, ключ: 'spor', имя: 'Доверие проверяется исходом', новое: 'Своя трактовка новости против совета — и журнал решения' },
    { от: 35, до: 50, ключ: 'prosadka', имя: 'Риск важнее одной победы', новое: 'Просадка и подушка возврата: игра не заканчивается на разорении' },
    { от: 50, до: 60, ключ: 'pravilo', имя: 'Ошибка становится капиталом', новое: 'Исправленное правило и первое улучшение комнаты' },
  ];
  // Ровно три траты в первый час — это ограничение спецификации, а не баланс. Больше не появляется.
  const TRATY = {
    lenta: { tsena: 12, imya: 'Новостная лента', chto: 'Показывает новости и календарь событий с датами' },
    podushka: { tsena: 15, imya: 'Подушка возврата', chto: 'Один раз поднимает со дна после разорения' },
    komnata: { tsena: 25, imya: 'Съёмная комната', chto: 'Общага сменяется комнатой: видно, что дело идёт' },
  };
  const KOMNATY = ['Дешёвая общага', 'Съёмная комната'];

  // Свой генератор случайного: игра обязана повторяться по номеру, иначе ни проверить, ни разобрать жалобу.
  function sluchay(seed) {
    // Семя перемешивается и генератор прогревается НАРОЧНО. Без этого у соседних номеров (1, 2, 3…)
    // первые выданные числа почти совпадают — свойство xorshift, — и сто разных партий давали один и тот же
    // исход до десятой доли процента. Поймано замером разброса по ста семенам, а не рассуждением.
    let s = Math.imul(((seed >>> 0) || 1), 2654435761) >>> 0;
    const shag = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    for (let i = 0; i < 12; i++) shag();
    return shag;
  }

  function faza(minuta) {
    const f = ФАЗЫ.find(f => minuta >= f.от && minuta < f.до);
    return f || ФАЗЫ[ФАЗЫ.length - 1];
  }

  const AKTIVY = [
    { id: 'ttwo', imya: 'Take-Two', e: '🎮', chto: 'делает GTA', tsena: 100 },
    { id: 'nvda', imya: 'Nvidia', e: '🖥', chto: 'делает видеокарты', tsena: 100 },
    { id: 'umg', imya: 'Universal Music', e: '🎧', chto: 'крупный музыкальный лейбл', tsena: 100 },
    { id: 'a24', imya: 'A24', e: '🎬', chto: 'киностудия', tsena: 100 },
  ];

  // Советники говорят разное про одно и то же — в этом вся первая фаза. Точность скрыта от игрока.
  const SOVETNIKI = [
    { id: 'gromkiy', imya: 'Громкий с форума', tochnost: 0.35, golos: 'Бери не думая, все берут!' },
    { id: 'tihiy', imya: 'Тихий сосед по общаге', tochnost: 0.62, golos: 'Я бы подождал даты. Событие уже в цене.' },
    { id: 'analitik', imya: 'Аналитик из телевизора', tochnost: 0.5, golos: 'Фундаментально всё хорошо.' },
  ];

  function sobytiya(rnd) {
    // У каждого события есть дата (игровая минута) и горизонт — сколько минут оно действует.
    // Календарь виден только с купленной лентой; до того игрок видит лишь итог и не понимает, почему.
    const spisok = [
      { aktiv: 'ttwo', minuta: 22, gorizont: 6, zagolovok: 'Показ геймплея GTA 6', ozhidanie: 'вверх', sdvig: -0.12, pochemu: 'Все ждали роста и купили заранее — на самом показе продавали в эйфорию.' },
      { aktiv: 'nvda', minuta: 14, gorizont: 5, zagolovok: 'Отчёт Nvidia о прибыли', ozhidanie: 'вверх', sdvig: 0.14, pochemu: 'Отчёт вышел лучше даже завышенных ожиданий — редкий случай, когда событие отработало прямо.' },
      { aktiv: 'umg', minuta: 38, gorizont: 8, zagolovok: 'Суд по правам на каталог', ozhidanie: 'вниз', sdvig: -0.16, pochemu: 'Суд затянулся, а неопределённость дороже плохой новости.' },
      { aktiv: 'a24', minuta: 44, gorizont: 7, zagolovok: 'Премьера фильма A24', ozhidanie: 'вверх', sdvig: 0.16, pochemu: 'Сборы выше прогноза: событие, которого никто громко не ждал, и потому оно не было в цене.' },
    ];
    // Шум небольшой, но заметный: без него сто прогонов дают одно и то же число, и переигрывать незачем.
    // Больше делать нельзя — тогда исход решает жребий, а не выбор игрока, и урок пропадает.
    return spisok.map(s => ({ ...s, shum: (rnd() - 0.5) * 0.06 }));
  }

  function novaya(seed = 1, dengi = 100) {
    const rnd = sluchay(seed);
    // Мелкий ход цены поминутно. Без него первые четырнадцать минут все четыре бумаги стоят ровно 100.00
    // и не шевелятся — терминал читается как сломанный, а первая ставка перестаёт быть выбором.
    // Замечено не рассуждением, а на живом экране: посмотрел первые пять минут игры глазами.
    // Ход намеренно слабее событий: жребий не должен решать за игрока.
    const drozh = {};
    for (const a of AKTIVY) { let k = 1; drozh[a.id] = [1]; for (let m = 1; m <= ЧАС; m++) { k *= 1 + (rnd() - 0.5) * 0.012; drozh[a.id].push(k); } }
    return {
      drozh,
      seed, minuta: 0, dengi, nachalo: dengi, pik: dengi,
      aktivy: AKTIVY.map(a => ({ ...a })),
      sobytiya: sobytiya(rnd),
      pozitsiya: null,            // {aktiv, summa, tsena_vhoda, minuta, doverilsya}
      kupleno: [],                // не больше трёх за час
      komnata: 0,
      podushka_ispolzovana: false,
      razoren: false,
      zhurnal: [],                // решения игрока: во что верил и чем кончилось
      pravilo: null,              // исправленное правило, которое он записал сам
      vstrecheno: [],             // какие новые причины думать он уже увидел — по ним меряется «каждые 10–15 минут»
      konchilos: false,
    };
  }

  function tsena(s, id) {
    const a = s.aktivy.find(x => x.id === id);
    if (!a) throw new Error(`!! нет актива ${id}`);
    let k = (s.drozh && s.drozh[id]) ? s.drozh[id][Math.min(s.minuta, ЧАС)] : 1;
    for (const e of s.sobytiya) {
      if (e.aktiv !== id) continue;
      if (s.minuta < e.minuta) continue;
      const proshlo = Math.min(1, (s.minuta - e.minuta) / e.gorizont);
      k *= 1 + (e.sdvig + e.shum) * proshlo; // событие отрабатывает не мгновенно, а за свой горизонт
    }
    return +(a.tsena * k).toFixed(2);
  }

  const kupleno = (s, chto) => s.kupleno.includes(chto);

  function otmetit(s, klyuch) { // «новая причина думать» засчитывается один раз и по факту, а не по времени
    if (!s.vstrecheno.includes(klyuch)) s.vstrecheno = [...s.vstrecheno, klyuch];
    return s;
  }

  /* Одно действие игрока. Чистая функция: старое состояние не меняется — так игру можно отматывать,
     а проверку писать без побочных эффектов. Неизвестное действие — громкая ошибка, а не тихий пропуск. */
  function deystvie(sostoyanie, d) {
    const s = JSON.parse(JSON.stringify(sostoyanie));
    if (!d || typeof d.tip !== 'string') throw new Error('!! действие без вида');
    if (s.konchilos && d.tip !== 'pravilo') throw new Error('!! час кончился: осталось только записать правило');

    if (d.tip === 'stavka') {
      if (s.pozitsiya) throw new Error('!! ставка уже сделана — сначала промотай время и закрой её');
      const summa = Number(d.summa);
      if (!(summa > 0)) throw new Error('!! ставка должна быть больше нуля');
      if (summa > s.dengi) throw new Error('!! на это не хватает денег');
      const t = tsena(s, d.aktiv);
      s.dengi = +(s.dengi - summa).toFixed(2);
      s.pozitsiya = { aktiv: d.aktiv, summa, tsena_vhoda: t, minuta: s.minuta, doverilsya: d.sovetnik || null, svoya_traktovka: !!d.svoya_traktovka };
      otmetit(s, 'stavka');
      if (d.sovetnik) otmetit(s, 'sovet');
      if (d.svoya_traktovka) otmetit(s, 'spor');
      return s;
    }

    if (d.tip === 'kupit') {
      const chto = d.chto;
      if (!TRATY[chto]) throw new Error(`!! такой траты нет: ${chto}`);
      if (kupleno(s, chto)) throw new Error(`!! уже куплено: ${TRATY[chto].imya}`);
      if (s.kupleno.length >= 3) throw new Error('!! в первый час доступны только три траты');
      if (TRATY[chto].tsena > s.dengi) throw new Error('!! не хватает денег');
      s.dengi = +(s.dengi - TRATY[chto].tsena).toFixed(2);
      s.kupleno = [...s.kupleno, chto];
      if (chto === 'komnata') s.komnata = 1;
      otmetit(s, chto === 'lenta' ? 'lenta' : chto === 'komnata' ? 'komnata' : 'podushka');
      return s;
    }

    if (d.tip === 'promotat') {
      const na = Number(d.minut);
      if (!(na > 0)) throw new Error('!! проматывать можно только вперёд');
      s.minuta = Math.min(ЧАС, s.minuta + na);
      if (s.pozitsiya) { // позиция закрывается сама: первый час учит последствию, а не управлению позицией
        const t = tsena(s, s.pozitsiya.aktiv);
        const dohod = +(s.pozitsiya.summa * (t / s.pozitsiya.tsena_vhoda - 1)).toFixed(2);
        s.dengi = +(s.dengi + s.pozitsiya.summa + dohod).toFixed(2);
        const sob = s.sobytiya.find(e => e.aktiv === s.pozitsiya.aktiv && e.minuta <= s.minuta);
        s.zhurnal = [...s.zhurnal, {
          minuta: s.minuta, aktiv: s.pozitsiya.aktiv, summa: s.pozitsiya.summa, dohod,
          doverilsya: s.pozitsiya.doverilsya, svoya_traktovka: s.pozitsiya.svoya_traktovka,
          pochemu: sob ? sob.pochemu : 'Событий по этой бумаге не было — двигал только шум.',
        }];
        s.pozitsiya = null;
        otmetit(s, 'posledstvie');
      }
      // Фаза 35–50 учит риску и восстановлению. Урок этой фазы — ПРОСАДКА, а не обязательно разорение:
      // если засчитывать только разорение (ниже 20% от старта), большинство игроков урок не увидит вовсе,
      // и обещание «одна новая причина думать каждые 10–15 минут» окажется невыполненным. Проверено тестом:
      // на честном прогоне часа разорения не случилось, а просадка случилась.
      s.pik = Math.max(s.pik, s.dengi);
      if (s.dengi <= s.pik * 0.75 && !s.vstrecheno.includes('prosadka')) otmetit(s, 'prosadka');
      if (s.dengi < s.nachalo * 0.2 && !s.razoren) s.razoren = true;
      if (s.minuta >= ЧАС) s.konchilos = true;
      return s;
    }

    if (d.tip === 'podnyatsya') { // подушка: один раз и только когда действительно разорён
      if (!kupleno(s, 'podushka')) throw new Error('!! подушка не куплена');
      if (!s.razoren) throw new Error('!! подниматься не с чего: разорения не было');
      if (s.podushka_ispolzovana) throw new Error('!! подушка одноразовая');
      s.dengi = +(s.dengi + s.nachalo * 0.5).toFixed(2);
      s.podushka_ispolzovana = true; s.razoren = false;
      otmetit(s, 'podushka_srabotala');
      return s;
    }

    if (d.tip === 'pravilo') {
      const t = String(d.text || '').trim();
      if (t.length < 8) throw new Error('!! правило должно быть словами, а не пустой строкой');
      s.pravilo = t;
      otmetit(s, 'pravilo');
      return s;
    }

    throw new Error(`!! неизвестное действие: ${d.tip}`);
  }

  /* Мерка спецификации, а не «функция вернула ожидаемое»: сколько новых причин думать человек встретил
     и в каких фазах. Пусто — значит игра не выполнила то, ради чего сделана. */
  function ocenka(s) {
    const nuzhno = ['sovet', 'lenta', 'spor', 'prosadka', 'pravilo'];
    const est = nuzhno.filter(k => s.vstrecheno.includes(k));
    return {
      prichin: est.length, iz: nuzhno.length, ne_vstrecheno: nuzhno.filter(k => !est.includes(k)),
      trat: s.kupleno.length, resheniy: s.zhurnal.length,
      dengi: s.dengi, minuta: s.minuta,
      itog: +(s.dengi / s.nachalo - 1).toFixed(4),
    };
  }

  return { novaya, deystvie, tsena, ocenka, faza, ФАЗЫ, TRATY, AKTIVY, SOVETNIKI, KOMNATY, ЧАС };
});
