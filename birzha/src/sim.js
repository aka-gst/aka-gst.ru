/* Лаборатория решений — ядро симулятора.
   Чистая логика: свечи → сигнал → бумажная сделка → последствие → карточка «что сломалось».
   Сети здесь нет, ключей нет, клиента биржи нет: отправить настоящую заявку невозможно по устройству.
   Работает и в браузере (window.Sim), и в Node (module.exports). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Sim = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- правила (версии) ----------
  const PRAVILA = {
    v1: {
      id: 'v1',
      nazvanie: 'Пересечение средних 5/20',
      gipoteza: 'Если цена пошла вверх заметнее обычного — покупаю, вдруг рост продолжится. Если пошла вниз — продаю. Больше ничего не знаю и не смотрю.',
      params: { fast: 5, slow: 20, porog: 0 },
    },
    v2: {
      id: 'v2',
      nazvanie: 'Пересечение средних 5/20 с порогом',
      gipoteza: 'То же пересечение, но покупаем не в момент пересечения, а когда быстрая средняя ушла выше медленной на величину издержек сделки. Мелкие пересечения — шум, и на них издержки съедают всё.',
      params: { fast: 5, slow: 20, porog: 0.003 },
      proishozhdenie: 'выведено из карточки провала v1: издержки на сделку (0.30%) оказались больше среднего преимущества (0.04%); порог взят равным измеренным издержкам, не подбирался',
    },
  };

  const IZDERZHKI_PO_UMOLCHANIYU = { komissiya: 0.001, zaderzhka: 1, proskalzyvanie: 0.0005 };
  const BEZ_IZDERZHEK = { komissiya: 0, zaderzhka: 0, proskalzyvanie: 0 };

  // ---------- проверка входа: не сделал — упал ----------
  function proverit(candles) {
    if (!Array.isArray(candles)) throw new Error('!! свечи: ожидался массив');
    if (candles.length < 30) throw new Error(`!! свечи: слишком мало (${candles.length}), нужно хотя бы 30`);
    const polya = ['t', 'o', 'h', 'l', 'c'];
    for (let i = 0; i < candles.length; i++) {
      const s = candles[i];
      if (!s || typeof s !== 'object') throw new Error(`!! свеча ${i}: не объект`);
      for (const p of polya) {
        if (typeof s[p] !== 'number' || !Number.isFinite(s[p])) throw new Error(`!! свеча ${i}: поле ${p} не число (${s[p]})`);
      }
      if (s.o <= 0 || s.h <= 0 || s.l <= 0 || s.c <= 0) throw new Error(`!! свеча ${i}: цена ≤ 0`);
      if (s.h < s.l) throw new Error(`!! свеча ${i}: high (${s.h}) меньше low (${s.l})`);
      if (s.h < Math.max(s.o, s.c) || s.l > Math.min(s.o, s.c)) throw new Error(`!! свеча ${i}: open/close вне диапазона high/low`);
      if (i > 0 && s.t <= candles[i - 1].t) throw new Error(`!! свеча ${i}: время не растёт (${candles[i - 1].t} → ${s.t})`);
    }
    return candles;
  }

  function proveritIzderzhki(z) {
    for (const k of ['komissiya', 'zaderzhka', 'proskalzyvanie']) {
      if (typeof z[k] !== 'number' || !Number.isFinite(z[k]) || z[k] < 0) throw new Error(`!! издержки: ${k} должно быть числом ≥ 0, получено ${z[k]}`);
    }
    if (!Number.isInteger(z.zaderzhka)) throw new Error('!! издержки: задержка — целое число свечей');
    return z;
  }

  // ---------- скользящая средняя (по закрытиям) ----------
  function smaRyad(closes, n) {
    const out = new Array(closes.length).fill(null);
    let sum = 0;
    for (let i = 0; i < closes.length; i++) {
      sum += closes[i];
      if (i >= n) sum -= closes[i - n];
      if (i >= n - 1) out[i] = sum / n;
    }
    return out;
  }

  // сигнал правила на свече i — смотрит только на закрытия ≤ i
  function signal(pravilo, fast, slow, closes, i) {
    if (fast[i] == null || slow[i] == null || i === 0 || fast[i - 1] == null || slow[i - 1] == null) return null;
    const gap = (fast[i] - slow[i]) / slow[i];
    let cross = null;
    if (fast[i] > slow[i] && fast[i - 1] <= slow[i - 1]) cross = 'up';
    else if (fast[i] < slow[i] && fast[i - 1] >= slow[i - 1]) cross = 'down';
    return { close: closes[i], smaFast: fast[i], smaSlow: slow[i], gap, cross, vyshe: fast[i] > slow[i] };
  }

  // ---------- прогон ----------
  // Возвращает журнал решений, сделки и итог. Параллельно считает «идеальный» кошелёк
  // (те же решения, но без комиссии, задержки и проскальзывания) — чтобы издержки были
  // посчитаны, а не нарисованы рядом.
  function progon(opts) {
    const candles = proverit(opts.candles);
    const pravilo = typeof opts.pravilo === 'string' ? PRAVILA[opts.pravilo] : opts.pravilo;
    if (!pravilo) throw new Error(`!! неизвестное правило ${opts.pravilo}`);
    const z = proveritIzderzhki(Object.assign({}, IZDERZHKI_PO_UMOLCHANIYU, opts.izderzhki || {}));
    const startQuote = opts.koshelyok && opts.koshelyok.quote != null ? opts.koshelyok.quote : 1000;
    if (!(startQuote > 0)) throw new Error('!! кошелёк: стартовая сумма должна быть > 0');

    const closes = candles.map(s => s.c);
    const fast = smaRyad(closes, pravilo.params.fast);
    const slow = smaRyad(closes, pravilo.params.slow);

    const real = { quote: startQuote, base: 0 };   // настоящий бумажный кошелёк
    const ideal = { quote: startQuote, base: 0 };  // без издержек, те же решения
    const zhurnal = [];
    const sdelki = [];
    let otkrytaya = null;   // текущая позиция
    let ozhidaet = null;    // отложенное исполнение {deystvie, i_resheniya, ispolnit_na}
    let komissiiVsego = 0;
    let ispolnenieVsego = 0; // потери на цене исполнения (задержка + проскальзывание), в quote
    let signalov = 0;
    let podtverzhdenoNaVolne = false; // на одной волне «выше» входим не больше одного раза

    function ispolnit(i, zayavka) {
      const svecha = candles[i];
      const tsenaModeli = zayavka.tsena_modeli;
      // задержка 0 — исполняемся по цене решения (идеализация); иначе по open свечи исполнения
      const bazovaya = z.zaderzhka === 0 ? tsenaModeli : svecha.o;
      const zapis = {
        i, t: svecha.t, faza: 'исполнение', deystvie: zayavka.deystvie, pravilo: pravilo.id,
        reshenie_na: zayavka.i_resheniya, zaderzhka_svechey: z.zaderzhka, tsena_modeli: tsenaModeli,
      };
      if (zayavka.deystvie === 'купить') {
        const fill = bazovaya * (1 + z.proskalzyvanie);
        const notional = real.quote;
        const fee = notional * z.komissiya;
        real.base = (notional - fee) / fill; real.quote = 0;
        ideal.base = ideal.quote / tsenaModeli; ideal.quote = 0;
        komissiiVsego += fee;
        ispolnenieVsego += (fill - tsenaModeli) / fill * (notional - fee); // переплата за исполнение
        otkrytaya = { vhod: { i, t: svecha.t, tsena_modeli: tsenaModeli, tsena_ispolneniya: fill, komissiya: fee, reshenie_na: zayavka.i_resheniya }, quoteDo: notional, idealDo: ideal.base * tsenaModeli };
        Object.assign(zapis, { tsena_ispolneniya: fill, komissiya: fee, koshelyok: { quote: real.quote, base: real.base } });
      } else {
        const fill = bazovaya * (1 - z.proskalzyvanie);
        const proceeds = real.base * fill;
        const fee = proceeds * z.komissiya;
        const baseBylo = real.base;
        real.quote = proceeds - fee; real.base = 0;
        const idealProceeds = ideal.base * tsenaModeli;
        ideal.quote = idealProceeds; ideal.base = 0;
        komissiiVsego += fee;
        ispolnenieVsego += (tsenaModeli - fill) * baseBylo; // недополучено из-за исполнения
        const brutto_pct = tsenaModeli / otkrytaya.vhod.tsena_modeli - 1;
        const netto_pct = real.quote / otkrytaya.quoteDo - 1;
        const sdelka = {
          vhod: otkrytaya.vhod,
          vyhod: { i, t: svecha.t, tsena_modeli: tsenaModeli, tsena_ispolneniya: fill, komissiya: fee, reshenie_na: zayavka.i_resheniya, prichina: zayavka.prichina },
          brutto_pct, netto_pct, izderzhki_pct: brutto_pct - netto_pct,
          dlitelnost_svechey: i - otkrytaya.vhod.i,
        };
        sdelki.push(sdelka);
        otkrytaya = null;
        Object.assign(zapis, { tsena_ispolneniya: fill, komissiya: fee, koshelyok: { quote: real.quote, base: real.base }, sdelka: { brutto_pct, netto_pct } });
      }
      zhurnal.push(zapis);
    }

    const warm = pravilo.params.slow;
    for (let i = 0; i < candles.length; i++) {
      // сначала исполняем то, что решили раньше
      if (ozhidaet && ozhidaet.ispolnit_na === i) { ispolnit(i, ozhidaet); ozhidaet = null; }
      if (i < warm) continue;
      const s = signal(pravilo, fast, slow, closes, i);
      if (!s) continue;
      const porog = pravilo.params.porog;
      // событие: пересечение, либо (для правила с порогом) подтверждение — быстрая выше медленной на порог, а позиции нет
      const podtverzhdenie = porog > 0 && !s.cross && s.vyshe && s.gap >= porog && otkrytaya === null && ozhidaet === null && !podtverzhdenoNaVolne;
      if (!s.cross && !podtverzhdenie) continue;
      signalov++;
      const vPozitsii = otkrytaya !== null || (ozhidaet && ozhidaet.deystvie === 'купить');
      let deystvie = 'пропуск', prichina;
      if (podtverzhdenie) {
        deystvie = 'купить'; prichina = `подтверждение: быстрая средняя выше медленной на ${(s.gap * 100).toFixed(2)}% ≥ порога ${(porog * 100).toFixed(2)}%`;
        podtverzhdenoNaVolne = true;
      } else if (s.cross === 'up') {
        if (vPozitsii) { deystvie = 'держать'; prichina = 'уже в позиции'; }
        else if (ozhidaet) { deystvie = 'пропуск'; prichina = 'предыдущая заявка ещё не исполнена'; }
        else if (porog > 0) { deystvie = 'ждать'; prichina = `пересечение вверх, разрыв ${(s.gap * 100).toFixed(3)}% меньше порога ${(porog * 100).toFixed(2)}% — ждём подтверждения`; podtverzhdenoNaVolne = false; }
        else { deystvie = 'купить'; prichina = 'пересечение вверх: быстрая средняя выше медленной'; }
      } else {
        podtverzhdenoNaVolne = false;
        if (otkrytaya) { deystvie = 'продать'; prichina = 'пересечение вниз: быстрая средняя ниже медленной'; }
        else if (ozhidaet && ozhidaet.deystvie === 'купить') { ozhidaet = null; deystvie = 'отмена'; prichina = 'сигнал развернулся до исполнения покупки'; }
        else { deystvie = 'пропуск'; prichina = 'позиции нет, продавать нечего'; }
      }
      const zapis = { i, t: candles[i].t, faza: 'решение', pravilo: pravilo.id, gipoteza: pravilo.gipoteza, signal: s, deystvie, prichina, tsena_modeli: s.close, komissiya_stavka: z.komissiya, zaderzhka_svechey: z.zaderzhka };
      zhurnal.push(zapis);
      if (deystvie === 'купить' || deystvie === 'продать') {
        const ispolnit_na = i + z.zaderzhka;
        if (ispolnit_na >= candles.length) { zapis.deystvie = 'пропуск'; zapis.prichina = 'период кончился раньше исполнения'; continue; }
        ozhidaet = { deystvie, i_resheniya: i, ispolnit_na, tsena_modeli: s.close, prichina };
        if (z.zaderzhka === 0) { ispolnit(i, ozhidaet); ozhidaet = null; }
      }
    }
    // открытую позицию в конце периода закрываем принудительно по последнему закрытию — честно помечаем
    let prinuditelno = false;
    if (otkrytaya) {
      const i = candles.length - 1;
      const zayavka = { deystvie: 'продать', i_resheniya: i, tsena_modeli: closes[i], prichina: 'конец периода: принудительное закрытие' };
      const sohr = z.zaderzhka; z.zaderzhka = 0; ispolnit(i, zayavka); z.zaderzhka = sohr;
      prinuditelno = true;
    }

    const netto_pct = real.quote / startQuote - 1;
    const brutto_pct = ideal.quote / startQuote - 1;
    const pribylnyh = sdelki.filter(s => s.netto_pct > 0).length;
    const sr = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const itog = {
      pravilo: pravilo.id, sdelok: sdelki.length, signalov, prinuditelnoe_zakrytie: prinuditelno,
      brutto_pct, netto_pct, izderzhki_pct: brutto_pct - netto_pct,
      komissii_quote: komissiiVsego, ispolnenie_quote: ispolnenieVsego,
      koshelyok_konets: real.quote, koshelyok_start: startQuote,
      pribylnyh, dolya_pribylnyh: sdelki.length ? pribylnyh / sdelki.length : 0,
      srednyaya_brutto_pct: sr(sdelki.map(s => s.brutto_pct)),
      srednie_izderzhki_pct: sr(sdelki.map(s => s.izderzhki_pct)),
      kupil_i_derzhal_pct: closes[closes.length - 1] / closes[warm] - 1,
    };
    return {
      pravilo: { id: pravilo.id, nazvanie: pravilo.nazvanie, gipoteza: pravilo.gipoteza, params: pravilo.params },
      izderzhki: z,
      period: { ot: candles[0].t, do: candles[candles.length - 1].t, svechey: candles.length },
      zhurnal, sdelki, itog,
    };
  }

  // ---------- карточка «что сломалось» ----------
  // Сравнивает прогон без издержек и с издержками по одному правилу и называет причину словами.
  function karta(bez, s) {
    const b = bez.itog, r = s.itog;
    const izderzhkiNaSdelku = r.srednie_izderzhki_pct;
    const preimushchestvo = r.srednyaya_brutto_pct;
    let vyvod, prichina, novoe;
    if (b.netto_pct > 0 && r.netto_pct <= 0) {
      vyvod = 'провал';
      prichina = `Комиссия и исполнение съели маленькое преимущество: средняя сделка давала ${pct(preimushchestvo)} без издержек, а издержки на сделку — ${(izderzhkiNaSdelku * 100).toFixed(2)}%. При ${r.sdelok} сделках издержки съели ${(r.izderzhki_pct * 100).toFixed(2)}% капитала.`;
      novoe = (r.pravilo === 'v1' || !(s.pravilo.params && s.pravilo.params.porog > 0))
        ? 'Торговать только когда ожидаемый ход больше издержек: ввести порог разрыва средних (правило v2).'
        : `Порог не спас: сделок меньше и минус меньше, но причина найдена не вся — частичное улучшение это не починка. Следующая гипотеза должна быть про режим рынка (боковик против тренда), а не про порог.`;
    } else if (b.netto_pct <= 0) {
      vyvod = 'провал';
      prichina = `У правила нет преимущества даже без издержек: ${pct(b.netto_pct)} за период при ${b.sdelok} сделках. Издержки тут ни при чём — сломана сама гипотеза.`;
      novoe = 'Менять не порог, а идею: этот сигнал на этих данных не предсказывает движение.';
    } else {
      vyvod = 'пережило';
      prichina = `Правило осталось в плюсе и с издержками: ${pct(r.netto_pct)} против ${pct(b.netto_pct)} без них. Это ещё не доказательство — нужен новый период.`;
      novoe = 'Правило не менять; проверить на новом периоде, которого оно не видело.';
    }
    return {
      pravilo: r.pravilo, vyvod, prichina, novoe_pravilo: novoe,
      chisla: {
        sdelok: r.sdelok, brutto_pct: b.netto_pct, netto_pct: r.netto_pct,
        srednyaya_sdelka_brutto_pct: preimushchestvo, izderzhki_na_sdelku_pct: izderzhkiNaSdelku,
        komissii_quote: r.komissii_quote, ispolnenie_quote: r.ispolnenie_quote, kupil_i_derzhal_pct: r.kupil_i_derzhal_pct,
      },
    };
  }

  function pct(x) { return (x >= 0 ? '+' : '') + (x * 100).toFixed(2) + '%'; }

  // ---------- новый период: правило проверяется там, где его не подбирали ----------
  function razdelit(candles, dolya) {
    if (!(dolya > 0 && dolya < 1)) throw new Error('!! доля разбиения должна быть в (0,1)');
    const k = Math.floor(candles.length * dolya);
    return { staryy: candles.slice(0, k), novyy: candles.slice(k) };
  }

  // ---------- статус уверенности ----------
  function uverennost(staryyItog, novyyItog) {
    if (!novyyItog) return { status: 'не проверено', tekst: 'Правило видело только один период.' };
    if (staryyItog.netto_pct > 0 && novyyItog.netto_pct > 0) return { status: 'пережило новый период', tekst: `На новом периоде ${pct(novyyItog.netto_pct)} при ${novyyItog.sdelok} сделках.` };
    if (staryyItog.netto_pct > 0 && novyyItog.netto_pct <= 0) return { status: 'не пережило новый период', tekst: `На старом периоде ${pct(staryyItog.netto_pct)}, на новом ${pct(novyyItog.netto_pct)}: гипотеза не пережила проверку.` };
    if (novyyItog.netto_pct > 0) return { status: 'опровергнуто', tekst: `На старом периоде минус (${pct(staryyItog.netto_pct)}), на новом плюс (${pct(novyyItog.netto_pct)}) при ${novyyItog.sdelok} сделках. Один удачный кусок при проваленном старом — не доказательство, а случайность.` };
    return { status: 'опровергнуто', tekst: `Правило в минусе и на старом (${pct(staryyItog.netto_pct)}), и на новом (${pct(novyyItog.netto_pct)}) периоде.` };
  }

  return { PRAVILA, IZDERZHKI_PO_UMOLCHANIYU, BEZ_IZDERZHEK, proverit, smaRyad, signal, progon, karta, razdelit, uverennost, pct };
});
