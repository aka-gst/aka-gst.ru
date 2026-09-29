#!/usr/bin/env node
// На всё, что лежит на сайте, должен быть путь с самого сайта (правило 30д).
// Повод: NEON CLAW лежал на /claw/ и отвечал 200, а карточки на витрине не
// было — попасть можно было только по прямому адресу.
//
// Проверка сверяет ДВА списка и краснеет на расхождении в любую сторону:
//   * вещи на сервере: ssh на бой, верхние каталоги веб-корня, из них
//     вещами считаются те, чей адрес /имя/ отвечает 200 страницей;
//   * пути с витрины: обход живого сайта от «/» по ссылкам <a href>,
//     только свой хост. Ссылка ищется отрицанием — любой видимый <a>,
//     ведущий на путь вещи, — а не по словарю названий.
// «Лежит и не видно» → НЕТ ПУТИ. «Видно и не лежит» → БИТАЯ ссылка.
//
//   node tools/put-s-vitriny.mjs                 весь сайт
//   node tools/put-s-vitriny.mjs --path /claw/   одна вещь (контроль)
//   node tools/put-s-vitriny.mjs --samoproverka  тест самого измерителя
//
// Выходы: 0 — зелено, 1 — есть расхождения, 2 — измеритель не смог мерить
// (сеть, ssh, пустая витрина). 2 — это «не проверено», а не «сломано».
//
// Ловушки, зашитые нарочно:
//   * /psy-admin/ не покрывает /psy-admin-v2/ — сравнение по сегментам
//     с косой чертой, а не по подстроке (омоним, правило 7л.8);
//   * ссылка на старый адрес (/worm/ → /naotmash/) засчитывается вещи,
//     куда редирект ведёт: берётся и буква ссылки, и её конечный адрес;
//   * пустой список вещей или пустая витрина — провал измерителя, а не
//     «всё отвязано»: у отрицательного ответа спрашиваем, сколько он
//     осмотрел (правило 47а).

import { execFileSync } from 'node:child_process';

const SITE = process.env.SITE || 'https://aka-gst.ru';
const HOST_SSH = process.env.DEPLOY_HOST || 'bonita';
const ROOT = process.env.DEPLOY_ROOT || '/opt/zakriva/caddy/site';
const MAX_PAGES = 200;

const args = process.argv.slice(2);
const onlyPath = args.includes('--path') ? args[args.indexOf('--path') + 1] : null;

// ---------- чистая логика покрытия (её и тестирует самопроверка) ----------

// Вещь /x/ покрыта, если какая-то ссылка равна /x или лежит под /x/.
// Именно так /psy-admin/ НЕ покрывает /psy-admin-v2/ и наоборот.
function pokryta(thing, links) {
  const bez = thing.replace(/\/$/, '');
  for (const l of links) if (l === bez || l === thing || l.startsWith(thing)) return l;
  return null;
}

function samoproverka() {
  let bad = 0;
  const t = (name, cond) => {
    console.log(`  ${cond ? 'ok   ' : 'FAIL '} ${name}`);
    if (!cond) bad++;
  };
  const links = ['/claw/', '/psy-admin/', '/worm/'];
  // зелёный исход существует
  t('вещь со ссылкой зелёная', pokryta('/claw/', links) !== null);
  // красный исход существует
  t('вещь без ссылки красная', pokryta('/zoo/', links) === null);
  // омоним: подстрока не считается путём
  t('/psy-admin/ не покрывает /psy-admin-v2/', pokryta('/psy-admin-v2/', links) === null);
  t('/psy-admin-v2/foo не покрывает /psy-admin/', pokryta('/psy-admin/', ['/psy-admin-v2/foo']) === null);
  // глубокая ссылка покрывает вещь
  t('ссылка вглубь покрывает вещь', pokryta('/claw/', ['/claw/help.html']) !== null);
  console.log(bad ? `самопроверка: ${bad} провалов` : 'самопроверка: измеритель цел');
  process.exit(bad ? 1 : 0);
}
if (args.includes('--samoproverka')) samoproverka();

// ---------- сеть с повторами (2–7% обрывов — свойство сети, не сайта) ----------

async function vzyat(url, redirect = 'follow') {
  for (let i = 1; i <= 3; i++) {
    try {
      return await fetch(url, { redirect, signal: AbortSignal.timeout(25000) });
    } catch {
      if (i < 3) await new Promise(r => setTimeout(r, 1000 * i));
    }
  }
  return null; // «ответа не было» — не то же, что 404
}

// ---------- ссылки со страницы ----------

// Дешёвое приближение видимости: шаблоны, hidden и display:none в самой
// разметке выбрасываются. Скрытое хитрее (CSS-класс, скрипт) — слепое пятно.
function ssylki(html, pageUrl) {
  const out = [];
  const chist = html.replace(/<template[\s\S]*?<\/template>/gi, '')
                    .replace(/<!--[\s\S]*?-->/g, '');
  for (const m of chist.matchAll(/<a\b([^>]*)>/gi)) {
    const attrs = m[1];
    if (/\bhidden\b/i.test(attrs) || /aria-hidden\s*=\s*"true"/i.test(attrs)) continue;
    if (/style\s*=\s*"[^"]*display\s*:\s*none/i.test(attrs)) continue;
    const h = attrs.match(/href\s*=\s*"([^"]+)"|href\s*=\s*'([^']+)'/i);
    if (!h) continue;
    const href = h[1] || h[2];
    if (/^(mailto:|tel:|javascript:|#)/i.test(href)) continue;
    let u;
    try { u = new URL(href, pageUrl); } catch { continue; }
    const svoy = new URL(SITE).host.replace(/^www\./, '');
    if (u.host.replace(/^www\./, '') !== svoy) continue;
    out.push(u.pathname);
  }
  return out;
}

// ---------- главный ход ----------

const itog = { net_puti: [], bitye: [], seti: 0 };

async function main() {
  // 1. Что лежит на сервере. Только каталоги: файлы корня — служебные.
  let dirs;
  try {
    dirs = execFileSync('ssh',
      ['-o', 'ConnectTimeout=15', '-o', 'BatchMode=yes', HOST_SSH,
       `find ${ROOT} -maxdepth 1 -mindepth 1 -type d -exec basename {} \\;`],
      { encoding: 'utf8', timeout: 30000 }).trim().split('\n').filter(Boolean).sort();
  } catch {
    console.log('ПРОВАЛ ИЗМЕРИТЕЛЯ: ssh до боя не прошёл — список вещей взять неоткуда');
    process.exit(2);
  }
  if (dirs.length < 3) {
    console.log(`ПРОВАЛ ИЗМЕРИТЕЛЯ: на сервере видно только ${dirs.length} каталогов — не похоже на веб-корень`);
    process.exit(2);
  }

  // 2. Из каталогов — вещи: адрес отвечает 200 страницей. Редирект — псевдоним:
  //    вещью становится его конечный адрес.
  const veshchi = new Map(); // путь → как узнали
  const zametki = [];
  for (const d of dirs) {
    const put = `/${d}/`;
    const r = await vzyat(SITE + put, 'manual');
    if (!r) { itog.seti++; zametki.push(`сеть молчит про ${put} — не проверено`); continue; }
    if (r.status === 200) {
      if ((r.headers.get('content-type') || '').includes('html')) veshchi.set(put, 'каталог на бою');
      else zametki.push(`${put} отвечает 200, но не страницей — пропущено`);
    } else if (r.status >= 300 && r.status < 400) {
      const cel = new URL(r.headers.get('location'), SITE);
      if (cel.host === new URL(SITE).host) {
        const cp = cel.pathname.endsWith('/') ? cel.pathname : cel.pathname + '/';
        const r2 = await vzyat(SITE + cp, 'manual');
        if (r2 && r2.status === 200) veshchi.set(cp, `псевдоним ${put}`);
        zametki.push(`${put} — псевдоним, ведёт на ${cp}`);
      }
    } else {
      zametki.push(`${put} лежит на диске, но отвечает ${r.status} — вещью не считается`);
    }
  }
  if (veshchi.size < 3) {
    console.log(`ПРОВАЛ ИЗМЕРИТЕЛЯ: вещей набралось ${veshchi.size} — либо сайт лежит, либо мерить нечего`);
    process.exit(2);
  }

  // 3. Обход витрины: от «/» по ссылкам, свой хост, страницы вглубь.
  const linkGde = new Map();   // путь ссылки → страница, где впервые увидена
  const ochered = ['/'];
  const probovano = new Set();
  let stranits = 0;
  while (ochered.length && stranits < MAX_PAGES) {
    const p = ochered.shift();
    if (probovano.has(p)) continue;
    probovano.add(p);
    const r = await vzyat(SITE + p, 'follow');
    if (!r) { itog.seti++; continue; }
    const konech = new URL(r.url).pathname; // куда редирект довёл
    if (r.status >= 400) {
      // видно и не лежит — вторая сторона беды
      if (linkGde.has(p)) itog.bitye.push(`${p} (со страницы ${linkGde.get(p)}) → ${r.status}`);
      continue;
    }
    if (konech !== p && !linkGde.has(konech)) linkGde.set(konech, linkGde.get(p) || p);
    if (!(r.headers.get('content-type') || '').includes('html')) continue;
    stranits++;
    const html = await r.text();
    for (const l of ssylki(html, SITE + p)) {
      if (!linkGde.has(l)) linkGde.set(l, p);
      if (!probovano.has(l) && !ochered.includes(l)) ochered.push(l);
    }
  }
  const vseSsylki = [...linkGde.keys()];
  if (stranits < 1 || vseSsylki.length < 5) {
    console.log(`ПРОВАЛ ИЗМЕРИТЕЛЯ: обойдено ${stranits} страниц, ссылок ${vseSsylki.length} — витрина не прочитана, «всё отвязано» из этого не следует`);
    process.exit(2);
  }

  // 4. Сверка.
  console.log(`чем мерили: ${SITE}, ssh ${HOST_SSH}:${ROOT}`);
  console.log(`на сервере каталогов: ${dirs.length}, из них вещей (200 страницей): ${veshchi.size}`);
  console.log(`обойдено страниц: ${stranits}, собрано внутренних ссылок: ${vseSsylki.length}${itog.seti ? `, не доехало по сети: ${itog.seti}` : ''}`);
  console.log('');

  const proverit = onlyPath
    ? [...veshchi.keys()].filter(v => v === onlyPath)
    : [...veshchi.keys()];
  if (onlyPath && proverit.length === 0) {
    console.log(`ПРОВАЛ: ${onlyPath} не найден среди вещей на сервере — контроль не о чем`);
    process.exit(2);
  }
  for (const v of proverit.sort()) {
    const l = pokryta(v, vseSsylki);
    if (l) console.log(`  ok        ${v}  ← ссылка ${l} на странице ${linkGde.get(l)}`);
    else {
      console.log(`  НЕТ ПУТИ  ${v}  (отвечает 200, ни одной ссылки с сайта; ${veshchi.get(v)})`);
      itog.net_puti.push(v);
    }
  }
  // Битые ссылки — беда всего сайта. В одиночном контроле (--path) они не
  // печатаются и в вердикт не входят: контроль отвечает за свою вещь, иначе
  // зелёного исхода у него не было бы никогда (правило 7и).
  if (!onlyPath) {
    for (const b of itog.bitye) console.log(`  БИТАЯ     ${b}`);
    if (zametki.length) {
      console.log('\nзаметки (не беда, но глазам полезно):');
      for (const z of zametki) console.log(`  ${z}`);
    }
  }

  const bed = itog.net_puti.length + (onlyPath ? 0 : itog.bitye.length);
  console.log(`\nитог: ${proverit.length - itog.net_puti.length} с путём, ${itog.net_puti.length} без пути${onlyPath ? '' : `, битых ссылок ${itog.bitye.length}`}`);
  process.exit(bed ? 1 : 0);
}

main();
