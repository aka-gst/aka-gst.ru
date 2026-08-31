import assert from 'node:assert/strict';
import { readFileSync, statSync, existsSync } from 'node:fs';
import test from 'node:test';

// Проверки живут в репозитории сайта, потому что репозиторий у них должен
// быть хоть какой-то: до этого они лежали просто в папке, вне гита и без
// удалённого адреса, — а соседний README при этом уверял, что репозиторий у
// них отдельный. Набор охватывает и игры, поэтому пути ведут наружу.
//   тут()   — сам сайт
//   рядом() — соседние репозитории в dev/
//   внутри()— то, что лежит не отдельной папкой, а внутри общей
const тут = (path) => new URL(`../${path}`, import.meta.url);
const рядом = (path) => new URL(`../../${path}`, import.meta.url);
// Неон Линии, Тетколор и сервер лидерборда лежат внутри одной общей папки со
// старым именем проекта. Имя владельцу давно не нужно и упомянуто здесь
// ровно один раз: переименует папку — правится одна строка.
const ОБЩАЯ = 'Zakriva';
const site = (path) => readFileSync(тут(path), 'utf8');
const read = (path) => readFileSync(рядом(path), 'utf8');
// Игры переезжают из общей папки в dev/ по одной: neon-lines уехал
// 31 августа, и пять проверок разом покраснели на несуществующем пути.
// Поэтому ищем в обоих местах, а не в одном: тест должен падать, когда
// сломана игра, а не когда её перенесли.
const внутри = (path) => {
  for (const где of [рядом(path), рядом(`${ОБЩАЯ}/${path}`)]) {
    try {
      return readFileSync(где, 'utf8');
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
  }
  throw new Error(`не найдено ни в dev/, ни в ${ОБЩАЯ}/: ${path}`);
};
const json = (path) => JSON.parse(site(path));

// ── Сайт-портфолио ───────────────────────────────────────────────────
// Прежние проверки читали zakriva-site/styles.css и ждали раскладку старой
// главной-аркады. Файла больше нет, а страница собирается из JSON, поэтому
// проверяем то, что новая версия действительно обещает.

test('портфолио адаптируется под узкий экран и уважает reduced-motion', () => {
  const css = site('assets/site.css');
  assert.match(css, /@media \(max-width: 900px\)/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  // Ширина задана переменной и применяется к шапке, main и подвалу разом.
  assert.match(css, /--maxw:\s*\d+px/);
  assert.equal((css.match(/max-width: var\(--maxw\)/g) || []).length, 3);
});

test('две оболочки переключаются одним атрибутом и не показываются вместе', () => {
  const css = site('assets/site.css');
  const html = site('index.html');
  assert.match(css, /\.panel \{ display: none; \}/);
  assert.match(css, /html\[data-track="work"\] \.panel\[data-panel="work"\]/);
  assert.match(css, /html\[data-track="play"\] \.panel\[data-panel="play"\]/);
  assert.match(html, /<html lang="ru" data-track="work">/);
  assert.match(html, /data-panel="work"/);
  assert.match(html, /data-panel="play"/);
  // Выбор восстанавливается до первой отрисовки, иначе экран мигает.
  assert.match(html, /localStorage\.getItem\('aka-gst:track'\)/);
});

test('каждый проект из базы попадает на страницу', () => {
  const html = site('index.html');
  const { projects } = json('data/projects.json');
  assert.ok(projects.length >= 14, `проектов в базе: ${projects.length}`);
  for (const project of projects) {
    assert.ok(
      html.includes(project.title),
      `проект "${project.title}" описан в projects.json, но не попал в index.html`
    );
  }
});

test('название карточки открывает страницу проекта', () => {
  const html = site('index.html');
  const { projects } = json('data/projects.json');
  // Кликают по названию раньше, чем ищут строку со ссылками внизу.
  for (const project of projects) {
    if (!project.groups.some(g => ['practicums', 'client-products'].includes(g))) continue;
    const card = html.match(new RegExp(`id="p-${project.id}"[\\s\\S]*?</article>`));
    assert.ok(card, `карточка ${project.id} не найдена`);
    const title = card[0].match(/<h3>([\s\S]*?)<\/h3>/)[1];
    const link = project.links.find(l => ['course', 'site', 'play', 'demo', 'telegram', 'repo'].includes(l.type));
    if (!link) continue;
    assert.match(title, /<a class="card-title" href="/, `название ${project.id} не ссылка`);
    assert.ok(title.includes(`href="${link.url}"`), `название ${project.id} ведёт не на ${link.url}`);
  }
});

test('числа первого экрана приходят из фида CI, а не вписаны руками', () => {
  const html = site('index.html');
  const feed = json('data/qa-metrics.json');
  assert.equal(feed.schema, 'aka-gst.qa-metrics/1');
  for (const card of feed.headline) {
    assert.match(html, new RegExp(`data-metric="${card.key}"`));
    assert.ok(
      html.includes(card.display),
      `в фиде ${card.key} = ${card.display}, а на странице этого значения нет`
    );
  }
  // Версия и ссылка на прогон тоже из фида: иначе витрина разойдётся с CI.
  assert.ok(html.includes(`v${feed.project.version}`));
  assert.ok(html.includes(feed.commit.run_url));
});

test('на страницах сайта нет почты, телефона и настоящего имени', () => {
  // Проверяем только то, что генерирует сайт: у psy-admin есть законные
  // публичные контакты чужого центра, и они не должны ронять проверку.
  for (const page of ['index.html', 'praktikum/index.html', '404.html', '503.html']) {
    const html = site(page);
    assert.doesNotMatch(html, /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, `почта в ${page}`);
    assert.doesNotMatch(html, /(\+7|\b8)[ -]?\(?9\d{2}\)?[ -]?\d{3}[ -]?\d{2}[ -]?\d{2}/, `телефон в ${page}`);
  }
});

// Размер картинки без внешних зависимостей: у PNG он лежит в IHDR,
// у JPEG — в маркере SOFn, который приходится искать по цепочке сегментов.
const imageSize = bytes => {
  if (bytes.readUInt32BE(0) === 0x89504e47) {
    return { w: bytes.readUInt32BE(16), h: bytes.readUInt32BE(20) };
  }
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) { i += 1; continue; }
    const marker = bytes[i + 1];
    // Маркеры без длины: их нельзя пропускать по полю размера.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { h: bytes.readUInt16BE(i + 5), w: bytes.readUInt16BE(i + 7) };
    }
    i += 2 + bytes.readUInt16BE(i + 2);
  }
  throw new Error('размер картинки не прочитан');
};

test('снимки экрана лежат на месте, подписаны и не двигают вёрстку', () => {
  const db = json('data/projects.json');
  const html = site('index.html');
  // Снимки живут в двух базах: у проектов и в строках опыта (там лежит
  // скан журнальной полосы). Проверять надо оба набора — иначе картинка,
  // добавленная во второй, проходит мимо всех правил про alt, подпись,
  // ?v= и зарезервированное место.
  const shots = [
    ...db.projects.flatMap(p => (p.shots || []).map(s => ({ ...s, project: p }))),
    ...json('data/site.json').profile.experience
      .filter(e => e.shot)
      .map(e => ({ ...e.shot, project: { kind: 'скан' } })),
  ];
  assert.ok(shots.length >= 13, 'снимки пропали из базы проектов');

  const sizes = new Map();
  for (const shot of shots) {
    const bytes = readFileSync(тут(`assets/shots/${shot.file}`));
    // Расширение должно совпадать с содержимым: Content-Type сервер берёт
    // из имени файла, и .png с JPEG внутри — это заявка, которой файл не
    // соответствует. Три из первых пяти снимков приехали именно такими.
    const png = bytes.readUInt32BE(0) === 0x89504e47;
    assert.equal(png, shot.file.endsWith('.png'), `${shot.file}: формат не тот, что в имени`);

    const size = imageSize(bytes);
    sizes.set(shot.file, size);
    // Снимки-иллюстрации показываются целиком и сняты одним размером.
    // Игровые кадры обрезаны по полю, у каждого свои пропорции.
    // Скан журнальной полосы под общий размер не подгоняется: это чужая
    // бумага 2008 года, а не снимок нашей страницы.
    //
    // И снимок, у которого есть петля, тоже: он обязан совпадать с ПЕРВЫМ
    // КАДРОМ своей петли, иначе при наведении карточка перескакивает — у
    // QA Quest на снимке горели фары и стояли четыре строки в терминале, а
    // ролик начинался раньше, и карточка на глазах отматывалась назад.
    // Совпадение проверяется попиксельно отдельным инструментом: здесь
    // размеров файла для этого недостаточно.
    const сПетлёй = existsSync(тут(`assets/clips/clip-${shot.file.replace(/\.(jpe?g|png)$/i, '')}.mp4`))
      || existsSync(тут(`assets/clips/clip-${shot.project.id}.mp4`));
    if (shot.project.kind !== 'game' && shot.project.kind !== 'скан' && !сПетлёй) {
      assert.equal(size.w, 1200, `${shot.file}: ширина не 1200`);
      assert.equal(size.h, 750, `${shot.file}: высота не 750`);
    }
    assert.ok(shot.alt && shot.alt.length > 20, `${shot.file}: alt слишком короткий`);
    assert.ok(shot.caption, `${shot.file}: нет подписи`);
    // Caddy держит /assets/* неделю: без ?v= обновлённый снимок не доедет.
    assert.match(html, new RegExp(`/assets/shots/${shot.file}\\?v=[0-9a-f]{8}`));
  }

  // width/height резервируют место до загрузки — иначе при подгрузке
  // картинки текст под ней прыгает, а прокрутка по блокам промахивается
  // мимо секции. Значит, они должны совпадать с настоящим файлом.
  const tags = html.match(/<img[^>]*assets\/shots[^>]*>/g) || [];
  assert.equal(tags.length, shots.length, 'не все снимки попали в разметку');
  for (const tag of tags) {
    const file = tag.match(/assets\/shots\/([^?"]+)/)[1];
    const real = sizes.get(file);
    assert.ok(real, `${file}: в разметке есть, в базе нет`);
    assert.match(tag, new RegExp(`width="${real.w}"`), `${file}: ширина в разметке не та`);
    assert.match(tag, new RegExp(`height="${real.h}"`), `${file}: высота в разметке не та`);
    assert.match(tag, /loading="lazy"/, `${file}: грузится не лениво`);
  }
});

test('ролик не грузится при загрузке страницы, а только когда до него дошли', () => {
  const html = site('index.html');
  const tags = html.match(/<video[^>]*>/g) || [];
  // Ролик есть не у каждой игры — как и кадр у «Одного удара». Проверяем не
  // количество, а что каждый существующий подключён правильно.
  assert.ok(tags.length >= 1, 'ролики пропали с карточек');
  for (const tag of tags) {
    // Адрес лежит только в data-src. С обычным src браузер потянул бы все
    // ролики сразу при загрузке страницы — ради того, что большинство
    // посетителей не откроет.
    //
    // Обещание сузилось 31 августа и это надо назвать: раньше файл начинал
    // ехать только при наведении, теперь — когда карточка показалась на
    // экране. Причина в замере: первое наведение стоило 900 мс против
    // 120–230 на последующих, и всё это время человек смотрел на
    // неподвижный кадр. Прогрев идёт только там, где наведение вообще
    // существует, и только если человек не просил экономить трафик.
    // Что осталось неизменным и что стережёт эта проверка: при ЗАГРУЗКЕ
    // страницы не качается ни один ролик.
    assert.doesNotMatch(tag, /\ssrc=/, `${tag}: адрес не должен стоять в src`);
    assert.match(tag, /data-src="\/assets\/clips\/clip-[a-z-]+\.mp4\?v=[0-9a-f]{8}"/);
    assert.match(tag, /preload="none"/);
    // Без muted браузер откажется запускать автоматически, без playsinline
    // iPhone развернёт ролик на весь экран.
    for (const flag of ['muted', 'loop', 'playsinline']) {
      assert.match(tag, new RegExp(`\\b${flag}\\b`), `${tag}: нет ${flag}`);
    }
    const file = tag.match(/clips\/([^?"]+)/)[1];
    const bytes = readFileSync(тут(`assets/clips/${file}`));
    assert.ok(bytes.length < 400 * 1024, `${file}: ${Math.round(bytes.length / 1024)} КБ — слишком тяжёлый`);
  }
  const app = site('assets/app.js');
  // Запуск только вместе с подсветкой и только там, где движение разрешено.
  assert.match(app, /if \(!движениеРазрешено\) return;/);
  assert.match(app, /v\.dataset\.src/);
});

test('рассказы разбиты на абзацы и подписаны', () => {
  const book = json('data/stories.json');
  const рассказы = book.сборники.flatMap((c) => c.stories);
  assert.ok(рассказы.length >= 20, 'рассказы пропали из базы');

  for (const st of рассказы) {
    const page = site(`rasskazy/${st.slug}/index.html`);
    // Один абзац на весь рассказ — это склеенный текст. Так и было, пока
    // разбиение шло по пустым строкам: экспорт из .docx разделяет абзацы
    // одиночным переводом, и вся проза слипалась в стену.
    const абзацев = (page.match(/<p>/g) || []).length;
    // Порог по длине, а не общий: «Страшный суд» — двадцать одно слово, и
    // четыре абзаца для него не склейка, а весь рассказ.
    const нужно = Math.max(2, Math.round(st.words / 150));
    assert.ok(абзацев >= нужно, `${st.slug}: абзацев ${абзацев}, ждали хотя бы ${нужно} — текст слипся`);
    assert.match(page, /Сергей Гостов/);
    // Время чтения считается из числа слов, а не вписано руками.
    const минут = Math.max(1, Math.round(st.words / 180));
    assert.match(page, new RegExp(`${минут} мин`));
    // На страницах рассказов действует то же правило, что и на остальных.
    assert.doesNotMatch(page, /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, `почта в ${st.slug}`);
    assert.doesNotMatch(page, /(\+7|\b8)[ -]?\(?9\d{2}\)?[ -]?\d{3}[ -]?\d{2}[ -]?\d{2}/, `телефон в ${st.slug}`);
  }

  const оглавление = site('rasskazy/index.html');
  for (const st of рассказы) assert.match(оглавление, new RegExp(`/rasskazy/${st.slug}/`));

  // Читалка помнит выбор читателя, иначе на телефоне каждый заход
  // начинается с настройки заново.
  const js = site('assets/read.js');
  assert.match(js, /localStorage/);
  assert.match(js, /data-ground-toggle/);
  // Атрибут ставится на <html>, а переменные объявлены на .reader — если
  // селектор снова сойдётся на одном элементе, грунт молча перестанет
  // переключаться.
  assert.match(site('assets/read.css'), /html\[data-ground="paper"\] \.reader/);
});

test('выкладка идёт по белому списку и не тащит служебное', () => {
  const deploy = site('deploy.sh');
  const payload = deploy.match(/PAYLOAD="([\s\S]*?)"/)[1].trim().split('\n');
  for (const needed of ['index.html', 'assets', 'data', 'praktikum', 'qa-quest']) {
    assert.ok(payload.includes(needed), `${needed} должен выкладываться`);
  }
  for (const secret of ['.githooks', '.gitignore', 'README.md', 'build.mjs', 'Caddyfile', 'deploy.sh']) {
    assert.ok(!payload.includes(secret), `${secret} не должен уезжать на публичный сервер`);
  }
  // --delete снёс бы coin/, lines/ и knb/: они выкладываются из своих репозиториев.
  assert.doesNotMatch(deploy, /rsync[^\n]*--delete\b/);
});

test('ошибки отдают свои страницы, а неподнятый сервис — 503', () => {
  const caddy = site('Caddyfile');
  assert.match(caddy, /Cache-Control "no-cache, must-revalidate"/);
  assert.match(caddy, /rewrite \* \/404\.html/);
  assert.match(caddy, /rewrite \* \/503\.html/);
  assert.match(caddy, /status 503/);
  assert.match(caddy, /Retry-After/);
  // Собственная страница 404 не должна попадать в индекс.
  assert.match(site('404.html'), /name="robots" content="noindex"/);
  assert.match(site('503.html'), /name="robots" content="noindex"/);
});

test('ссылка на портфолио разворачивается превью в мессенджере', () => {
  const html = site('index.html');
  for (const tag of ['og:title', 'og:description', 'og:image', 'og:url', 'twitter:card']) {
    assert.match(html, new RegExp(`"${tag}"`), `нет ${tag}`);
  }
  assert.match(html, /<link rel="canonical" href="https:\/\/aka-gst\.ru\/">/);
});

// ── Игры ─────────────────────────────────────────────────────────────

test('тетрис не показывает игровую раскладку горизонтально на телефоне', () => {
  const css = внутри('tetcolor-columns/app/globals.css');
  assert.match(css, /max-width:\s*900px[^}]+orientation:\s*landscape/s);
  assert.match(css, /ПОВЕРНИ ТЕЛЕФОН ВЕРТИКАЛЬНО/);
  const page = внутри('tetcolor-columns/app/page.tsx');
  assert.doesNotMatch(page, /padStart\(/);
  assert.equal((page.match(/<a className="game-home-menu"/g) || []).length, 1);
  assert.match(page, /isDailyRecord/);
  assert.match(page, /Текущий результат будет потерян/);
  assert.match(page, /Math\.trunc\(dx \/ horizontalStep\)/);
  assert.match(page, /if \(dy > 0\) drop\(\); else cycle\(\)/);
  // Общий сид дня отменён владельцем: каждая партия раздаёт свою
  // последовательность, поэтому фигуры снова идут от Math.random.
  assert.match(page, /const horizontal = Math\.random\(\) < \.1/);
  assert.doesNotMatch(page, /hashSeed|mixSeed|pieceAt/);
  // moscowDay остаётся: им ключуется локальный «лучший за день», а он решает,
  // отправлять ли результат в дневную таблицу сервера.
  assert.match(page, /tetcolor-daily-best:\$\{moscowDay\(\)\}/);
  assert.match(page, /color-c/);
});

test('единое меню и форма имени используются во всех играх', () => {
  const files = [
    внутри('neon-lines/index.html'),
    внутри('tetcolor-columns/app/page.tsx'),
    read('orel-reshka/orel-reshka.html'),
    read('bitva-stihiy/index.html'),
  ];
  files.forEach(source => assert.match(source, /<a class(?:Name)?="game-home-menu"/));
  const menu = site('game-menu.css');
  assert.match(menu, /safe-area-inset-top/);
  assert.doesNotMatch(menu, /game-home-menu\[open\]/);
  assert.match(site('player-name.js'), /text-transform:none/);
  assert.match(read('orel-reshka/orel-reshka.html'), /player-name\.js\?v=3/);
});

test('игровые названия и анимации на месте', () => {
  // Карточка КНБ на сайте теперь называется полным именем прототипа,
  // а не «КНБ 2»: слаг лидерборда knb-2 при этом не менялся.
  const html = site('index.html');
  // Название игры остаётся заголовком, а не span: карточка целиком ссылка,
  // и без h3 программа чтения с экрана теряет структуру списка игр.
  // Игра переименована и переехала на /stihii/. Слаг лидерборда остался
  // knb-2: на нём держится история рекордов, переименование её обнулит.
  assert.match(html, /<h3[^>]*>Битва Стихий<\/h3>/);
  assert.match(html, /href="\/stihii\/"/);
  assert.match(html, /data-umami-event-game="knb-2"/);
  // Число выводим из базы, а не зашиваем: с каждой новой игрой жёсткая
  // цифра ломала бы тест, ничего не проверяя по существу.
  const игр = json('data/projects.json').projects
    .filter((p) => p.kind === 'game' && p.tracks.includes('play')).length;
  assert.equal((html.match(/<h3 class="gcard-title">/g) || []).length, игр);
  assert.match(html, /data-umami-event-game="knb-2"/);
  const tetcolor = внутри('tetcolor-columns/app/page.tsx');
  assert.match(tetcolor, /ACID COLUMNS · 1991/);
  assert.match(tetcolor, /тапом\/стрелками/);
  // Сид дня убран и отсюда: в оверлее снова только описание правил.
  assert.match(внутри('neon-lines/game.js'), /'Выстраивай пять шаров в линию','НАЧАТЬ'/);
  assert.doesNotMatch(внутри('neon-lines/game.js'), /dailyRandom|hashSeed|createRandom/);
  assert.match(внутри('neon-lines/game.js'), /'НАЧАТЬ',restart/);
  assert.match(внутри('neon-lines/styles.css'), /cell\.born\{z-index:3;overflow:visible\}/);
  assert.match(внутри('neon-lines/styles.css'), /scale\(1\.2\)/);
  // Игра переписана: раньше всё лежало в одном index.html, теперь есть
  // src/ и styles/. Суперудар не пропал — кнопка стала #btn-super.
  const knb = read('bitva-stihiy/index.html');
  assert.match(knb, /id="btn-super"/);
  assert.match(read('bitva-stihiy/src/main.js'), /superArmed|superPending/);
});

test('старый Android получает fallback высоты, цветов и Web Audio', () => {
  const android = внутри('neon-lines/android.css');
  assert.match(android, /height:\s*100vh/);
  assert.match(android, /@supports not[^}]+color-mix/s);
  assert.match(внутри('neon-lines/game.js'), /webkitAudioContext/);
  assert.match(внутри('tetcolor-columns/app/page.tsx'), /webkitAudioContext/);
  assert.match(внутри('neon-lines/index.html'), /sidebar-bottom \.records\{display:block/);
  assert.match(внутри('neon-lines/game.js'), /neon-lines-daily-best/);
  assert.match(внутри('neon-lines/game.js'), /visibilitychange/);
  assert.match(внутри('neon-lines/game.js'), /Текущий результат будет потерян/);
  assert.match(внутри('neon-lines/game.js'), /WISDOM/);
  assert.match(внутри('neon-lines/index.html'), /min-height:28px/);
});

test('игры масштабируются на больших мониторах', () => {
  assert.match(внутри('tetcolor-columns/app/globals.css'), /min-width:\s*1800px/);
  assert.match(внутри('neon-lines/index.html'), /min-width:1800px/);
});

test('КНБ укладывается в один экран в обеих ориентациях', () => {
  const css = read('bitva-stihiy/styles/game.css');
  const main = read('bitva-stihiy/src/main.js');
  assert.match(css, /max-width:\s*900px/);
  assert.match(css, /orientation:\s*landscape/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(main, /requestPlayerName/);
  // Слаг лидерборда обязан остаться knb-2 при любом переименовании игры:
  // под ним лежат уже записанные рекорды, смена слага их осиротит.
  assert.match(main, /GAME\s*=\s*'knb-2'/);
});

test('поддерживаемые телефоны получают тактильную отдачу во всех играх', () => {
  assert.match(внутри('tetcolor-columns/app/page.tsx'), /navigator\.vibrate/);
  assert.match(внутри('neon-lines/game.js'), /navigator\.vibrate/);
  assert.match(read('orel-reshka/orel-reshka.html'), /navigator\.vibrate/);
  assert.match(read('bitva-stihiy/src/audio.js'), /navigator\.vibrate/);
});

test('Орёл-решка подключена к сайту, аналитике и глобальному топу', () => {
  const home = site('index.html');
  const game = read('orel-reshka/orel-reshka.html');
  assert.match(home, /href="\/coin\/"/);
  assert.match(game, /\/pulse\/script\.js/);
  assert.match(game, /api\/leaderboard\/session/);
  assert.match(game, /game=coin-flip/);
  assert.match(game, /data-period="today"/);
  assert.match(game, /data-period="week"/);
  assert.match(game, /period=\$\{period\}&limit=9/);
  // Рекорд дня переехал из блока внизу вкладки «Игры» в бегущую строку
  // шапки. Проверяем то же самое по сути: сегодняшний счёт Деревни на
  // главной есть, и заполнять его будет тот же слаг лидерборда.
  assert.match(home, /class="rec-item" data-game="coin-flip"/);
  assert.match(внутри('ops/leaderboard/server.py'), /period_cutoff/);
  assert.match(game, /max-height:520px[^}]+orientation:landscape/s);
  assert.match(внутри('ops/leaderboard/server.py'), /"coin-flip"/);
  assert.match(внутри('ops/leaderboard/server.py'), /\{1,6\}/);
  assert.match(game, /requestPlayerName/);
  assert.match(game, /coin-flip-daily-best/);
  assert.match(site('player-name.js'), /maxlength="6"/);
});

// ── Вес оглавления рассказов ─────────────────────────────────────────
// Обложки владелец назвал половиной впечатления, поэтому вопрос не в
// экономии трафика, а в том, чтобы эта половина открывалась сразу. До
// правки /rasskazy/ тянуло 2.3 МБ картинок при разметке в 19 КБ: в списке
// показывались квадраты по 44 пикселя, а качались файлы по 900.

const обложкаБайт = (f) =>
  statSync(тут(`assets/covers/${f}`)).size;

// Свой разбор JPEG, а не доверие к тому, что записала сборка: смысл проверки
// в том, чтобы поймать расхождение между обещанным в разметке и настоящим.
const jpegРазмер = (f) => {
  const b = readFileSync(тут(`assets/covers/${f}`));
  for (let i = 2; i + 9 < b.length; ) {
    if (b[i] !== 0xff) { i += 1; continue; }
    const m = b[i + 1];
    if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
    if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) {
      return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
    }
    i += 2 + b.readUInt16BE(i + 2);
  }
  throw new Error(`не прочитан размер: ${f}`);
};

test('оглавление рассказов показывает уменьшенные обложки, а не оригиналы', () => {
  const html = site('rasskazy/index.html');
  const файлы = [...new Set([...html.matchAll(/\/assets\/covers\/([^"?]+)/g)].map((m) => m[1]))];
  assert.ok(файлы.length >= 13, `обложек в оглавлении всего ${файлы.length}`);

  // kusok/ — куски обложки сборника для рассказов без своей картинки.
  // Они такие же уменьшенные копии, как mini/, просто источник у них общий.
  const оригиналы = файлы.filter(
    (f) => !f.startsWith('mini/') && !f.startsWith('polka/') && !f.startsWith('kusok/')
  );
  assert.deepEqual(оригиналы, [], `в оглавлении полноразмерные: ${оригиналы.join(', ')}`);

  let всего = 0;
  for (const f of файлы) {
    const байт = обложкаБайт(f);
    всего += байт;
    if (f.startsWith('mini/') || f.startsWith('kusok/')) {
      assert.ok(байт < 20 * 1024, `${f} весит ${Math.round(байт / 1024)} КБ, а это миниатюра 44px`);
    }
  }
  assert.ok(всего < 600 * 1024, `обложки оглавления весят ${Math.round(всего / 1024)} КБ`);
});

test('обложки объявляют в разметке свой настоящий размер', () => {
  const html = site('rasskazy/index.html');
  const теги = [...html.matchAll(/<img[^>]*\/assets\/covers\/([^"?]+)[^>]*>/g)];
  assert.ok(теги.length >= 13, `тегов с обложками ${теги.length}`);
  for (const [тег, файл] of теги) {
    const { w, h } = jpegРазмер(файл);
    const вш = Number(тег.match(/width="(\d+)"/)?.[1]);
    const вы = Number(тег.match(/height="(\d+)"/)?.[1]);
    assert.equal(вш, w, `${файл}: в разметке ширина ${вш}, в файле ${w}`);
    assert.equal(вы, h, `${файл}: в разметке высота ${вы}, в файле ${h}`);
  }
});

test('первая обложка сборника грузится сразу, остальные лениво', () => {
  const html = site('rasskazy/index.html');
  const полка = [...html.matchAll(/<img[^>]*\/assets\/covers\/polka\/[^>]*>/g)].map((m) => m[0]);
  assert.equal(полка.length, 3, `обложек сборников ${полка.length}`);
  // Первая — самый крупный элемент первого экрана, по ней меряется LCP.
  assert.match(полка[0], /fetchpriority="high"/);
  assert.doesNotMatch(полка[0], /loading="lazy"/);
  for (const тег of полка.slice(1)) assert.match(тег, /loading="lazy"/);
  // Миниатюры ленивы все: до них надо доскроллить.
  for (const тег of [...html.matchAll(/<img[^>]*story-thumb[^>]*>/g)].map((m) => m[0])) {
    assert.match(тег, /loading="lazy"/);
  }
});

// ── Счётчик событий ──────────────────────────────────────────────────
// Правило 30: счётчик ставится при создании страницы, а не прикручивается
// потом. Три страницы — ФотоДата и оба практикума — прожили без него до
// 30 августа, и это ровно те страницы, которые открывает работодатель:
// девять игр были обвешаны до последней, а рабочие проекты не считались.
// Тег в разметке ничего не доказывает сам по себе (событие может не
// долетать), но его отсутствие доказывает, что не долетит наверняка.

test('каждая выкладываемая страница несёт счётчик событий', () => {
  // ФотоДаты здесь намеренно нет. У неё собственный строгий CSP прямо в
  // разметке: `script-src 'unsafe-inline'` без 'self' и `connect-src 'none'`.
  // То есть счётчик там не загрузился бы вовсе, а загрузившись — не смог бы
  // ничего отправить. Тег в такой странице был бы враньём в разметке: он
  // выглядит как «счётчик стоит», а событие не долетает никогда.
  // Обещание «обработка только на устройстве» — это и есть продукт, и
  // ослаблять политику ради статистики нельзя без слова владельца.
  const страницы = [
    'index.html',
    'praktikum/index.html',
    'praktikum/llm/index.html',
    'praktikum/testirovanie/index.html',
    'psy-admin/index.html',
    'rasskazy/index.html',
  ];
  const без = страницы.filter((f) => !site(f).includes('/pulse/script.js'));
  assert.deepEqual(без, [], `без счётчика: ${без.join(', ')}`);

  // Адрес именно от корня. stats.aka-gst.ru снаружи намеренно отдаёт 404,
  // и всё, что слали туда, ушло в никуда.
  for (const f of страницы) {
    assert.doesNotMatch(site(f), /stats\.aka-gst\.ru/, `${f}: шлёт на адрес, который отдаёт 404`);
  }
});

test('ФотоДата остаётся страницей, которая ничего никуда не отправляет', () => {
  const html = site('photodata/index.html');
  const csp = html.match(/<meta[^>]*Content-Security-Policy[^>]*content="([^"]+)"/i)?.[1];
  assert.ok(csp, 'у ФотоДаты пропал CSP — а на нём держится всё обещание');
  assert.match(csp, /connect-src 'none'/, 'ФотоДата снова может куда-то отправлять');
  assert.doesNotMatch(html, /pulse\/script\.js/, 'в ФотоДате счётчик: он всё равно не долетит, но выглядит как рабочий');
  // Внешние листы этой политикой запрещены, поэтому кнопка «на главную»
  // оформляется внутри страницы. Без этого она оставалась синей
  // подчёркнутой — единственной неоформленной ссылкой на сайте.
  assert.match(html, /\.site-home\{/, 'кнопка «на главную» снова без стиля');
  assert.doesNotMatch(html, /<link[^>]*game-menu\.css/, 'мёртвая ссылка на заблокированный лист');
});
