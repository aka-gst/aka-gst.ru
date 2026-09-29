/* Отрицательные контроли для измерителя. Измеритель — такой же код, принимающий решения,
   и у него должны быть свои тесты: на пустом, на заведомо сломанном, на случайном. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./sim.js'));
  else root.Kontrol = factory(root.Sim);
})(typeof self !== 'undefined' ? self : this, function (Sim) {
  'use strict';

  // детерминированный генератор (mulberry32): одно зерно — один и тот же ряд
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Испорченные свечи: каждая порча — то, что измеритель ОБЯЗАН заметить и упасть.
  const PORCHI = {
    'NaN в закрытии': c => { c[40].c = NaN; },
    'нулевая цена': c => { c[41].o = 0; },
    'время идёт назад': c => { c[42].t = c[41].t - 1; },
    'дубль времени': c => { c[43].t = c[42].t; },
    'high меньше low': c => { const s = c[44]; s.h = s.l - 1; },
    'close выше high': c => { c[45].c = c[45].h * 1.5; },
    'строка вместо числа': c => { c[46].c = String(c[46].c); },
    'пустой массив': c => { c.length = 0; },
  };
  function isportit(candles, vid) {
    if (!PORCHI[vid]) throw new Error(`!! неизвестная порча: ${vid}`);
    const kopiya = candles.map(s => Object.assign({}, s));
    PORCHI[vid](kopiya);
    return kopiya;
  }

  // Случайный рынок: те же доходности, что у настоящего ряда, но перетасованные.
  // Распределение то же, памяти нет — правило про «тренд продолжится» тут не должно зарабатывать.
  function sluchaynyeSvechi(candles, seed) {
    const r = rng(seed);
    const dohodnosti = [];
    for (let i = 1; i < candles.length; i++) dohodnosti.push(candles[i].c / candles[i - 1].c);
    for (let i = dohodnosti.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [dohodnosti[i], dohodnosti[j]] = [dohodnosti[j], dohodnosti[i]]; }
    const out = [{ t: candles[0].t, o: candles[0].o, h: candles[0].h, l: candles[0].l, c: candles[0].c, v: candles[0].v }];
    const shag = candles[1].t - candles[0].t;
    for (let i = 0; i < dohodnosti.length; i++) {
      const prev = out[i].c;
      const c = prev * dohodnosti[i];
      const o = prev;
      const h = Math.max(o, c) * (1 + r() * 0.001);
      const l = Math.min(o, c) * (1 - r() * 0.001);
      out.push({ t: out[i].t + shag, o, h, l, c, v: 1 });
    }
    return out;
  }

  // Подсматривает ли симулятор будущее: обрезаем хвост — решения до обрезки обязаны совпасть.
  function proverkaBudushchego(candles, pravilo, izderzhki) {
    const polnyy = Sim.progon({ candles, pravilo, izderzhki });
    const k = Math.floor(candles.length * 0.7);
    const kusok = Sim.progon({ candles: candles.slice(0, k), pravilo, izderzhki });
    const z = izderzhki && izderzhki.zaderzhka != null ? izderzhki.zaderzhka : Sim.IZDERZHKI_PO_UMOLCHANIYU.zaderzhka;
    // сравниваем только решения (исполнения зависят от задержки) строго раньше обрезки
    const klyuch = e => `${e.i}|${e.faza}|${e.deystvie}|${e.tsena_modeli}`;
    const a = polnyy.zhurnal.filter(e => e.faza === 'решение' && e.i < k - 1 - z).map(klyuch);
    const b = kusok.zhurnal.filter(e => e.faza === 'решение' && e.i < k - 1 - z).map(klyuch);
    const rashozhdeniy = a.filter((x, i) => x !== b[i]).length + Math.abs(a.length - b.length);
    return { sovpali: rashozhdeniy === 0, resheniy: a.length, rashozhdeniy };
  }

  // Медиана по N случайных рынков: один прогон ловит вариант, а не правило.
  function mediana(arr) { const s = arr.slice().sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
  function naSluchaynom(candles, pravilo, izderzhki, n) {
    const netto = [], sdelok = [];
    for (let seed = 1; seed <= n; seed++) {
      const r = Sim.progon({ candles: sluchaynyeSvechi(candles, seed), pravilo, izderzhki });
      netto.push(r.itog.netto_pct); sdelok.push(r.itog.sdelok);
    }
    return { progonov: n, mediana_netto_pct: mediana(netto), min_netto_pct: Math.min(...netto), max_netto_pct: Math.max(...netto), mediana_sdelok: mediana(sdelok), v_plyuse: netto.filter(x => x > 0).length };
  }

  // Контроль нужен и тогда, когда ворота никого не пропустили: берём лучших
  // только по прошлому отрезку, но не называем их кандидатами на деньги.
  function kandidatyDlyaKontrolya(proshedshie, poStaromu, limit) {
    if (!Array.isArray(proshedshie) || !Array.isArray(poStaromu)) throw new Error('!! кандидаты контроля должны быть массивами');
    const n = limit == null ? 5 : limit;
    if (!Number.isInteger(n) || n < 1) throw new Error('!! лимит контроля — целое число от 1');
    return (proshedshie.length ? proshedshie : poStaromu).slice(0, n);
  }

  return { rng, PORCHI, isportit, sluchaynyeSvechi, proverkaBudushchego, naSluchaynom, kandidatyDlyaKontrolya, mediana };
});
