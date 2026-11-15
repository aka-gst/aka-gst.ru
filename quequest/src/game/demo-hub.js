// 20.0 · «Три профессии» — the demo entry for showing the vertical slice
// (ФИНИШ-СРЕЗ-20.md). aka-gst.ru/quequest/?demo=1 opens this screen; each
// level is a plain link that reloads the game straight into that level, in
// the demo's own storage (index.html prefixes keys with «qqdemo:»), so a real
// player's save is never touched. Inside a level «≡ ДЕМО» brings you back.
// The ordinary game (no ?demo) does not change.

export const DEMO_PROFESSIONS = Object.freeze([
  Object.freeze({
    id: 'warehouse', title: 'СКЛАД', sub: 'Python руками: код двигает ящики', glyph: '▤',
    media: 'sklad.mp4', poster: 'sklad.jpg',
    does: 'Ты грузчик на складе «ТИСКОВ» — 3D, как в старом Doom. Каждый день отдаёшь работу роборуке на шаг больше: кнопкой, строчкой с листка, собранной строчкой.',
    next: 'На пятый день — одна строка for, и вся линия идёт без тебя: «+20 ₽, рука заработала». А тебя увольняют.',
    levels: Object.freeze([
      Object.freeze({ id: 'w1', ways: ['tap'], title: 'День 2 · Копия', what: 'Код с листка электрика — в терминал руки. Ящики поехали сами.', href: '?demo=1&checkpoint=d2-copy' }),
      Object.freeze({ id: 'w2', ways: ['knobs'], title: 'День 3 · Сборка', what: 'Листок порван: собери куски, одно слово допиши сам.', href: '?demo=1&checkpoint=d3-assemble' }),
      Object.freeze({ id: 'w3', ways: ['code'], title: 'День 5 · Автомат', what: 'for + if: вся линия работает без тебя.', href: '?demo=1&checkpoint=d5-auto' }),
    ]),
  }),
  Object.freeze({
    id: 'pythonio', title: 'ПИТОНИО', sub: 'Автоматизация: заказы живых людей', glyph: '⚙',
    poster: 'pythonio.jpg',
    does: 'Мастерская автоматизации. Соседи шлют заказы: двенадцать фотографий Лиды, лавка Марка, ярмарка Аси. Сначала руками, потом правило из блоков.',
    next: 'Блоки превращаются в код на Python. Три заказа в показе, в игре — двадцать два; заработок копится в профиль.',
    levels: Object.freeze([
      Object.freeze({ id: 'p1', ways: ['tap', 'knobs'], title: 'Заказ 1 · Лида', what: 'Двенадцать фотографий: сначала руками, потом правилом.', href: '?demo=1&open=pythonio&demo-order=1' }),
      Object.freeze({ id: 'p2', ways: ['knobs'], title: 'Заказ 2 · Марк', what: 'Фото налево, текст направо: сортировка потока.', href: '?demo=1&open=pythonio&demo-order=2' }),
      Object.freeze({ id: 'p3', ways: ['knobs', 'code'], title: 'Заказ 3 · Ася', what: 'Слишком много фото: линия, которая не захлёбывается.', href: '?demo=1&open=pythonio&demo-order=3' }),
    ]),
  }),
  Object.freeze({
    id: 'reverse', title: 'РЕВЕРС', sub: 'Понять чужую систему и обратить её правило', glyph: '⌬',
    media: 'fpsre.mp4', poster: 'fpsre.jpg',
    does: 'Чужие системы: ночью в гараже ловишь, кто вскрывает машину Вити; на учебном сервере «ТИСКОВ» ищешь пять дыр; в 3D-мире обманываешь робота Q-Bot.',
    next: 'За каждую дыру — флаг, значок и честная карточка: как от этого защищаются по-настоящему.',
    levels: Object.freeze([
      Object.freeze({ id: 'r1', ways: ['code'], img: 'garage.jpg', title: 'Гараж · Ночь 1', what: 'Чужие открывают машину Вити. Найди, кто, и напиши правило сторожа.', href: '?demo=1&checkpoint=fired&open=careers&realm=vehicle&enter=1' }),
      Object.freeze({ id: 'r2', ways: ['tap', 'code'], img: 'polygon.jpg', title: 'Полигон · «Взломай меня»', what: 'Сайт верит браузеру. Найди дыру — и пойми, как её закрыть.', href: '?demo=1&open=hack' }),
      Object.freeze({ id: 'r3', ways: ['tap', 'knobs'], img: 'fpsre.jpg', title: 'Чужой мир · Q-Bot', what: 'FPS: робот не знает, где ты, — он помнит и слышит. Докажи и обмани.', href: '?demo=1&open=fpsre' }),
    ]),
  }),
  // 20.x · the tenth level (Сергей 21.10 «да»): the profession tasters, open in the demo without Витя's night
  // (?tasters → careerWorlds tastersOpen; the demo profile itself is not touched, so r1 is not won by it).
  Object.freeze({
    id: 'tasters', wide: true, title: 'ПРОБЫ ПРОФЕССИЙ', sub: 'Одиннадцать проб: ИИ-помощник, визуал, бит, Arduino, таблицы…', glyph: '◇',
    poster: 'vera.jpg',
    does: 'Одиннадцать профессий по паре минут: у каждой — человек в беде и три этажа: кнопка, настройки, код. В показе — Вера и её цветочная лавка.',
    next: 'Собираешь Вере помощника, который сам разбирает 200 сообщений. В конце — «это начало профессии, дальше: …» и настоящие инструменты.',
    levels: Object.freeze([
      Object.freeze({ id: 't1', ways: ['tap', 'knobs', 'code'], title: 'Вера · ИИ-помощник', what: 'У цветочной лавки 200 сообщений в день. Собери помощника, который разложит их сам: кнопкой, настройками, кодом.', href: '?demo=1&checkpoint=fired&open=careers&realm=agents&tasters=1' }),
    ]),
  }),
]);

// The three floors of the same skill (canon §13): press a button, wire nodes, write code.
export const WAY_LABEL = Object.freeze({ tap: 'КНОПКА', knobs: 'НОДЫ', code: 'КОД' });
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function track(event, data) { try { if (typeof globalThis.umami?.track === 'function') globalThis.umami.track(event, data); } catch { /* never break the demo */ } }

// 20.0 · ФИНИШ-СРЕЗ-20 item 4: a won level says so. Facts come from the saved profile and the game
// state (main.js builds them), so a win is the same after a reload and never announced twice.
//   facts: { after(checkpoint) → bool, pythonio: [order ids], vehicleDay, flags: [polygon flag ids], awards: [award keys] }
export const DEMO_WINS = Object.freeze({
  w1: (f) => f.after('d2-copy'),
  w2: (f) => f.after('d3-assemble'),
  w3: (f) => f.after('d5-auto'),
  p1: (f) => f.pythonio.includes('order-01'),
  p2: (f) => f.pythonio.includes('order-02'),
  p3: (f) => f.pythonio.includes('order-03'),
  r1: (f) => f.vehicleDay >= 1,
  r2: (f) => f.flags.includes('price'),
  r3: (f) => f.awards.some((k) => k.includes('qbot:exploit')),
  t1: (f) => (f.tastersDone ?? []).length > 0,
});
export const DEMO_LEVELS = Object.freeze(DEMO_PROFESSIONS.flatMap((p) => p.levels.map((l) => ({ ...l, prof: p.title }))));
export function demoWonNow(facts) {
  return DEMO_LEVELS.filter((l) => { try { return Boolean(DEMO_WINS[l.id]?.(facts)); } catch { return false; } }).map((l) => l.id);
}
// The level after this one (the first one not yet won, in hub order, after it).
export function demoNext(id, won = []) {
  const i = DEMO_LEVELS.findIndex((l) => l.id === id);
  const rest = [...DEMO_LEVELS.slice(i + 1), ...DEMO_LEVELS.slice(0, Math.max(0, i))];
  return rest.find((l) => !won.includes(l.id)) ?? null;
}
const WINS_KEY = 'quequest.demo.wins';
export function loadDemoWins(storage = globalThis.localStorage) {
  try { const v = JSON.parse(storage?.getItem(WINS_KEY) ?? '[]'); return Array.isArray(v) ? v.filter((x) => DEMO_WINS[x]) : []; } catch { return []; }
}
function saveDemoWins(list, storage = globalThis.localStorage) { try { storage?.setItem(WINS_KEY, JSON.stringify(list)); } catch { /* the banner just shows again */ } }

// Which screen ?demo=1 asks for: the hub itself, or a level inside the game.
export function demoRoute(search = '') {
  const q = new URLSearchParams(search);
  if (!q.has('demo')) return null;
  if (q.has('checkpoint') || q.has('open') || q.has('world')) return 'level';
  return 'hub';
}

export function createDemoHub(host = globalThis.document?.body, { onSound = () => {}, onNext = () => false, version = '' } = {}) {
  const doc = host.ownerDocument ?? host;
  if (!doc.querySelector('link[data-demo-css]')) {
    const link = doc.createElement('link'); link.rel = 'stylesheet'; link.href = new URL('./demo-hub.css?v=20.0.2', import.meta.url).href; link.dataset.demoCss = '';
    doc.head.append(link);
  }
  const root = doc.createElement('section');
  root.id = 'demoHub'; root.className = 'demo-hub'; root.hidden = true; root.setAttribute('aria-label', 'QueQuest — три профессии');
  // 20.x (Сергей 22.10: «красиво, а не техтаблицей. Со скриншотами, с объяснением, что делать, как будет. Разными
  // вариантами»): every profession is a card with a real frame from the game, «что делаешь» and «что дальше».
  // Three layouts of the same cards: ?hub=a «Афиша» (cards in a row), b «Кино» (one per row, big frame), c «Главная + три».
  // Сергей picked C on the choice page (22.10, claude.ai/artifact/DF219W2qF3wPqxfL1ap91n): it is the default; a and b stay reachable by ?hub=.
  const variant = (() => { try { const v = new URLSearchParams(doc.defaultView?.location?.search ?? '').get('hub'); return ['a', 'b', 'c'].includes(v) ? v : 'c'; } catch { return 'c'; } })();
  const art = (f) => new URL(`../../assets/demo-hub/${f}`, import.meta.url).href;
  const media = (p) => p.media
    ? `<video class="demo-hub__shot" src="${art(p.media)}" poster="${art(p.poster)}" muted autoplay loop playsinline preload="metadata" aria-label="${esc(p.title)}: кадр из игры"></video>`
    : `<img class="demo-hub__shot" src="${art(p.poster)}" alt="${esc(p.title)}: кадр из игры" loading="lazy" decoding="async">`;
  const won = loadDemoWins(doc.defaultView?.localStorage);
  // 23.10 rule: no full stop at the end of a caption or a button
  const nd = (t) => esc(String(t ?? '').replace(/\.\s*$/, ''));
  root.dataset.variant = variant;
  root.innerHTML = `<header class="demo-hub__head"><small>QueQuest — обучение реальным навыкам тёмных 20ых · ${esc(version)} · демо</small><h1>Три профессии <span>и пробы</span></h1>
      <p>Игра, где учатся программированию, автоматизации и реверс-инжинирингу — делом, а не лекцией. Одно и то же умение можно взять <b class="w-tap">кнопкой</b>, собрать <b class="w-knobs">нодами</b> или написать <b class="w-code">кодом</b>. Выбери уровень — он откроется сразу</p></header>
    <div class="demo-hub__cols">${DEMO_PROFESSIONS.map((p, n) => `<article class="demo-hub__col" data-prof="${p.id}"${p.wide ? ' data-wide="true"' : ''}>
      <figure class="demo-hub__media">${media(p)}<figcaption>${n + 1}</figcaption></figure>
      <div class="demo-hub__body">
        <header><b>${esc(p.glyph)} ${esc(p.title)}</b><small>${nd(p.sub)}</small></header>
        <p class="demo-hub__does"><i>ЧТО ДЕЛАЕШЬ</i>${nd(p.does)}</p>
        <p class="demo-hub__next"><i>ЧТО БУДЕТ</i>${nd(p.next)}</p>
        <ol>${p.levels.map((l, i) => `<li><a class="demo-hub__lvl" href="${esc(l.href)}" data-level="${l.id}" data-won="${won.includes(l.id)}">${l.img ? `<img class="demo-hub__thumb" src="${art(l.img)}" alt="" loading="lazy">` : `<kbd>${i + 1}</kbd>`}<span><b>${esc(l.title)}</b><small>${nd(l.what)}</small><i class="demo-hub__ways">${l.ways.map((w) => `<em class="w-${w}">${WAY_LABEL[w]}</em>`).join('')}</i></span><u aria-hidden="true">ИГРАТЬ →</u></a></li>`).join('')}</ol>
      </div>
    </article>`).join('')}</div>
    <p class="demo-hub__foot">Прогресс демо хранится отдельно и не трогает обычную игру. Обычная игра — <a href="./">с начала</a></p>`;
  host.append(root);
  root.addEventListener('click', (ev) => {
    const a = ev.target.closest?.('[data-level]');
    if (a) { onSound('ui-click'); if (!/^p[123]$/.test(a.dataset.level)) track('demo-level-start', { level: a.dataset.level }); }
  });
  // «≡ ДЕМО» inside a level: back to the hub.
  const back = doc.createElement('a');
  back.id = 'demoBack'; back.className = 'demo-back'; back.href = '?demo=1'; back.textContent = '≡ ДЕМО'; back.hidden = true;
  back.setAttribute('aria-label', 'Назад к выбору уровня демо');
  host.append(back);
  // «✓ ПРОЙДЕНО» — not a modal: a strip under the top bar, so a level's own window (Pythonio's letter
  // with its «next order» button, the polygon's flag card) stays clickable.
  const banner = doc.createElement('aside');
  banner.id = 'demoWin'; banner.className = 'demo-win'; banner.hidden = true; banner.setAttribute('role', 'status');
  host.append(banner);
  let bannerTimer = 0;
  let activePythonio = null;
  // The first place where the strip covers no control of the level: under the top bar, at the
  // bottom, a bit lower. (The garage laptop keeps «↑ ВЫНЫРНУТЬ В ГАРАЖ» right under the top bar.)
  const SPOTS = [{ top: '64px', bottom: 'auto' }, { top: 'auto', bottom: '16px' }, { top: '128px', bottom: 'auto' }, { top: '30%', bottom: 'auto' }];
  function covered() {
    const b = banner.getBoundingClientRect();
    return [...doc.querySelectorAll('button,a[href],input,textarea,select,[role="button"],[data-pyio-toast]:not([hidden])')].some((e) => {
      if (banner.contains(e) || e.id === 'demoBack' || !e.offsetParent) return false;
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top;
    });
  }
  function place() {
    for (const spot of SPOTS) { Object.assign(banner.style, spot); if (!covered()) return spot; }
    Object.assign(banner.style, SPOTS[0]); return SPOTS[0];
  }
  function win(id, got = '', here = globalThis.location?.search ?? '') {
    const won = loadDemoWins(doc.defaultView?.localStorage);
    if (won.includes(id) || !DEMO_WINS[id]) return false;
    const all = [...won, id]; saveDemoWins(all, doc.defaultView?.localStorage);
    const lvl = DEMO_LEVELS.find((l) => l.id === id); const next = demoNext(id, all);
    const sameScreen = next && ((/^p[123]$/.test(next.id) && new URLSearchParams(here.replace(/^\?/, '')).get('open') === 'pythonio') || new URLSearchParams(next.href).toString() === new URLSearchParams(here.replace(/^\?/, '')).toString().replace(/&?mute=1/, ''));
    const nextBtn = !next ? `<a class="demo-win__go" href="?demo=1">ВСЕ ${DEMO_LEVELS.length} ПРОЙДЕНЫ · К ВЫБОРУ →</a>`
      : sameScreen ? `<button type="button" class="demo-win__go" data-win-next>ДАЛЬШЕ ЗДЕСЬ: ${esc(next.title)} →</button>`
        : `<a class="demo-win__go" href="${esc(next.href)}" data-level="${next.id}">СЛЕДУЮЩИЙ: ${esc(next.title)} →</a>`;
    banner.innerHTML = `<b>✓ ПРОЙДЕНО</b><span><strong>${esc(lvl.prof)} · ${esc(lvl.title)}</strong>${got ? `<small>${esc(got)}</small>` : ''}</span>${nextBtn}<button type="button" class="demo-win__x" data-win-close aria-label="Скрыть">×</button>`;
    // An iframe has its own controls: parent-document collision checks cannot see them.
    // Reserve a real grid row rather than floating a win over Pythonio's next-order button.
    const workshop = doc.querySelector('#pythonioDive:not([hidden])');
    const garage = doc.querySelector('#careerWorlds:not([hidden]) #careerStage:not([hidden])');
    const reverse = doc.querySelector('#fpsreDive:not([hidden])');
    const polygon = doc.querySelector('#hackPolygon:not([hidden])');
    const pay = doc.querySelector('#payCard:not([hidden]) .pay__card');
    const inline = workshop || garage || reverse || polygon || pay;
    if (workshop) workshop.insertBefore(banner, workshop.querySelector('.pyio-dive__frame'));
    else if (garage) garage.append(banner);
    else if (reverse) reverse.insertBefore(banner, reverse.querySelector('.re-dive__frame,.re-dive__phone'));
    else if (polygon) polygon.insertBefore(banner, polygon.querySelector('.hk__body'));
    else if (pay) pay.prepend(banner);
    else host.append(banner);
    banner.dataset.level = id;
    const staleOrder = /^p[123]$/.test(id) && activePythonio !== null && activePythonio !== Number(id.slice(1))-1;
    banner.hidden = staleOrder; if (!inline && !staleOrder) place(); onSound('power');
    track('demo-level-win', { level: id, n: all.length });
    clearTimeout(bannerTimer); bannerTimer = setTimeout(() => { banner.hidden = true; }, 14000);
    return true;
  }
  banner.addEventListener('click', (ev) => {
    if (ev.target.closest?.('[data-win-next]')) { if (onNext()) banner.hidden = true; return; }
    if (ev.target.closest?.('[data-win-close]')) { banner.hidden = true; return; }
    const a = ev.target.closest?.('[data-level]'); if (a && !/^p[123]$/.test(a.dataset.level)) track('demo-level-start', { level: a.dataset.level, from: 'win' });
  });
  return {
    win,
    startPythonio(index) {
      if (Number.isInteger(index) && index >= 0) { activePythonio = index; if (/^p[123]$/.test(banner.dataset.level??'') && Number(banner.dataset.level.slice(1))-1 !== index) banner.hidden = true; }
      if (Number.isInteger(index) && index >= 0 && index < 3) track('demo-level-start', { level: `p${index + 1}` });
    },
    get banner() { return banner; },
    open() { root.hidden = false; track('demo-open', {}); },
    close() { root.hidden = true; },
    showBack() { back.hidden = false; },
    get root() { return root; },
  };
}
