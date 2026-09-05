#!/usr/bin/env node
// Генерирует index.html из data/site.json и data/projects.json.
// Запуск: node build.mjs
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const read = (name) => JSON.parse(readFileSync(join(root, 'data', name), 'utf8'));

const site = read('site.json');
const db = read('projects.json');
const qa = read('qa-metrics.json');
const put = read('put.json');
const utro = read('utro.json');

// Версия ассета — от его содержимого. Раньше в ссылке стояло ?v=1 вручную:
// Caddy отдаёт /assets/* с кэшем на неделю, поэтому вернувшийся посетитель
// получал новую разметку со старыми стилями, пока кто-нибудь не вспомнит
// поднять число.
const assetVersion = (relative) =>
  createHash('sha256').update(readFileSync(join(root, relative))).digest('hex').slice(0, 8);

const cssVersion = assetVersion('assets/site.css');
const jsVersion = assetVersion('assets/app.js');

// Практикумы отдают свои числа так же, как гейтвей: карточка не хранит их у себя.
const readCourse = (relative) => {
  try {
    return JSON.parse(readFileSync(join(root, relative), 'utf8'));
  } catch (e) {
    console.warn(`  ! курс не прочитан: ${relative} — карточка соберётся без его чисел`);
    return null;
  }
};

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const ICONS = {
  github:
    'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12',
  x: 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z',
  telegram:
    'M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z',
};

const TRACK_ICONS = {
  // Работа — приглашение командной строки: сдержанный, «скучный» символ.
  work: '<path d="M4 17l5-5-5-5" /><path d="M12 19h8" />',
  // Игры — геймпад: узнаётся без подписи, за него и цепляется глаз.
  games:
    '<path d="M7 12h4M9 10v4" />' +
    '<circle cx="16" cy="11" r=".6" fill="currentColor" stroke="none" />' +
    '<circle cx="18" cy="13.5" r=".6" fill="currentColor" stroke="none" />' +
    '<path d="M17.5 5.5h-11A4.5 4.5 0 0 0 2 10v5a4 4 0 0 0 7 2.6h6A4 4 0 0 0 22 15v-5a4.5 4.5 0 0 0-4.5-4.5z" />',
  stories: '<path d="M4 20V6h6v14H4Zm6-2V4h7v14h-7Zm7 0V6h3v14h-3Z" /><path d="M12 15V9c0-2 3-2 3 0v6" />',
};

const trackIcon = (key) =>
  `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
     stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TRACK_ICONS[key]}</svg>`;

// У разделов один язык — крупные лаймово-фиолетовые плоскости, — но разные
// силуэты: работа — ворота, игры — искра в портале, рассказы — раскрытая книга.
// SVG, а не растровая эмблема: на высоте 28 px знак остаётся знаком.
const brand = (kind = 'work', { switchable = false } = {}) => {
  const src = (name) => `/assets/mark-${name}.svg?v=${assetVersion(`assets/mark-${name}.svg`)}`;
  const data = switchable
    ? ` data-brand-mark data-mark-work="${src('work')}" data-mark-play="${src('games')}" data-mark-stories="${src('stories')}"`
    : '';
  return `<a class="brand" href="/"><img class="brand-znak"${data} src="${src(kind)}" alt="" width="64" height="64" decoding="async">aka<span>-</span>gst</a>`;
};

const socials = site.socials.filter((item) => item.enabled && ICONS[item.id]);

const socialLinks = (place) =>
  socials
    .map(
      (item) => `<a class="social" href="${esc(item.url)}" target="_blank" rel="noopener me"
          data-umami-event="social-open" data-umami-event-network="${esc(item.id)}"
          data-umami-event-place="${esc(place)}" title="${esc(item.label)}">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="${ICONS[item.id]}"/></svg>
          <span class="sr-only">${esc(item.label)}</span></a>`
    )
    .join('\n');

const contactChannels = () =>
  (site.contact.channels || [])
    .map((id) => socials.find((item) => item.id === id))
    .filter(Boolean)
    .map(
      (item) => `
          <a class="channel" href="${esc(item.url)}" target="_blank" rel="noopener me"
             data-umami-event="contact-open" data-umami-event-network="${esc(item.id)}">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="${ICONS[item.id]}"/></svg>
            <span><b>${esc(item.label)}</b><i>${esc(item.url.replace(/^https:\/\//, ''))}</i></span>
            <b class="go">↗</b>
          </a>`
    )
    .join('');

const analytics = (project) =>
  project.analytics
    ? ` data-umami-event="${esc(project.analytics.event)}" data-umami-event-${
        project.analytics.event === 'game-open' ? 'game' : 'project'
      }="${esc(project.analytics.slug)}"`
    : '';

const primaryLink = (project) =>
  project.links.find((l) => l.type === 'course') ||
  project.links.find((l) => l.type === 'site') ||
  project.links.find((l) => l.type === 'play') ||
  project.links.find((l) => l.type === 'demo') ||
  project.links.find((l) => l.type === 'telegram') ||
  project.links.find((l) => l.type === 'repo') ||
  null;

const linkRow = (project) =>
  project.links.length
    ? `<p class="card-links">${project.links
        .map(
          (l) =>
            `<a class="link link-${esc(l.type)}" href="${esc(l.url)}"${
              l.url.startsWith('http') ? ' target="_blank" rel="noopener"' : ''
            }${l === primaryLink(project) ? analytics(project) : ''}>${esc(l.label)} <b>${
              l.url.startsWith('http') ? '↗' : '→'
            }</b></a>`
        )
        .join('')}</p>`
    : '<p class="card-links"><span class="link muted">Скоро</span></p>';

const statusBadge = (project) =>
  `<span class="status status-${esc(project.status.state)}">${esc(project.status.label)}</span>`;

const stackRow = (project) =>
  project.stack?.length
    ? `<ul class="stack">${project.stack.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>`
    : '';

const courseChips = (project) => {
  const course = readCourse(project.courseFeed.path);
  if (!course) return '';
  const t = course.totals || {};
  const items = [
    [t.units, 'разделов'],
    [t.experiments, project.id === 'ai-agent-service-lab' ? 'лабораторных' : 'экспериментов'],
    [t.estimate_minutes ? `~${t.estimate_minutes} мин` : null, 'чтения'],
  ].filter(([value]) => value);
  return `<ul class="chips">${items
    .map(([value, label]) => `<li><b>${esc(value)}</b> <span>${esc(label)}</span></li>`)
    .join('')}</ul>`;
};

const metricChips = (project) => {
  // Курс и проект — разные источники; если есть оба, показываем оба, а не вместо.
  const fromCourse = project.courseFeed ? courseChips(project) : '';
  // Подписи чипов идут строчными, чтобы карточки из разных источников читались одинаково.
  const lower = (text) => text.charAt(0).toLowerCase() + text.slice(1);
  const fromProject = project.metrics?.length
    ? `<ul class="chips">${project.metrics
        .map((m) => `<li><b>${esc(m.value)}</b> <span>${esc(lower(m.label))}</span></li>`)
        .join('')}</ul>`
    : '';
  return fromCourse + fromProject;
};

// Заголовок ведёт туда же, куда основная ссылка карточки: по названию
// кликают раньше, чем ищут строку со ссылками внизу.
const cardTitle = (project) => {
  const link = primaryLink(project);
  if (!link) return esc(project.title);
  const external = link.url.startsWith('http');
  return `<a class="card-title" href="${esc(link.url)}"${
    external ? ' target="_blank" rel="noopener"' : ''
  }${analytics(project)}>${esc(project.title)}</a>`;
};

// Числа для верхней полосы карточки. У практикумов их даёт course.json,
// у остальных — projects.json. Больше трёх в строку не помещается.
const cardMetrics = (project) => {
  if (project.courseFeed) {
    const t = readCourse(project.courseFeed.path)?.totals || {};
    return [
      { value: t.units, label: 'разделов' },
      { value: t.experiments, label: project.id === 'ai-agent-service-lab' ? 'лабораторных' : 'экспериментов' },
      // Единицу держим в подписи, иначе «мин» переносится на вторую строку
      // тем же крупным шрифтом и читается как часть числа.
      { value: t.estimate_minutes ? `~${t.estimate_minutes}` : null, label: 'мин чтения' },
    ].filter((m) => m.value);
  }
  return (project.metrics || []).slice(0, 3);
};

const metricBand = (project) => {
  const items = cardMetrics(project);
  if (!items.length) return '';
  return `
          <dl class="band" data-count="${items.length}">${items
    .map(
      (m) => `
            <div${m.note ? ` title="${esc(m.note)}"` : ''}>
              <dt>${esc(m.value)}</dt>
              <dd>${esc(m.label)}</dd>
            </div>`
    )
    .join('')}
          </dl>`;
};

// Значок «чем покрыто» ставится только там, где прогон подтверждён.
// Раскрывается по наведению и по касанию: :focus-within срабатывает на тап.
const evidenceMark = (project) => {
  const e = project.evidence;
  if (!e) return '';
  return `<span class="evidence">
              <button type="button" class="evidence-btn" aria-expanded="false"
                aria-label="Чем покрыто тестами: ${esc(project.title)}">✓</button>
              <span class="evidence-panel" role="tooltip">
                <b>${esc(e.title)}</b>
                <code>${esc(e.run)}</code>
                <ul>${e.points.map((point) => `<li>${esc(point)}</li>`).join('')}</ul>
                <p>${esc(e.why)}</p>
              </span>
            </span>`;
};

// Снимки экрана лежат в assets/shots и версионируются так же, как css и js:
// Caddy держит /assets/* неделю, без ?v= обновлённая картинка не доедет
// до вернувшегося посетителя.
const shotSrc = (file) => `/assets/shots/${file}?v=${assetVersion(`assets/shots/${file}`)}`;

// Размер картинки без внешних зависимостей: у PNG он в IHDR, у JPEG — в
// маркере SOFn. Нужен в разметке, чтобы браузер занял место под снимок до
// загрузки: иначе текст под ним прыгает, а прокрутка по блокам промахивается.
const imageSize = (relative) => {
  const bytes = readFileSync(join(root, relative));
  if (bytes.readUInt32BE(0) === 0x89504e47) {
    return { w: bytes.readUInt32BE(16), h: bytes.readUInt32BE(20) };
  }
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') {
    const kind = bytes.toString('ascii', 12, 16);
    const data = 20;
    if (kind === 'VP8 ') {
      return { w: bytes.readUInt16LE(data + 6) & 0x3fff, h: bytes.readUInt16LE(data + 8) & 0x3fff };
    }
    if (kind === 'VP8L') {
      const bits = bytes.readUInt32LE(data + 1);
      return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (kind === 'VP8X') {
      return { w: bytes.readUIntLE(data + 4, 3) + 1, h: bytes.readUIntLE(data + 7, 3) + 1 };
    }
  }
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) { i += 1; continue; }
    const marker = bytes[i + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { h: bytes.readUInt16BE(i + 5), w: bytes.readUInt16BE(i + 7) };
    }
    i += 2 + bytes.readUInt16BE(i + 2);
  }
  throw new Error(`не прочитан размер: ${relative}`);
};

// fetchpriority="low" у снимков карточек. Они и так ленивые, но браузер
// тянет их заранее своей эвристикой: на медленной сети запас доходит до
// трёх тысяч пикселей, и два снимка флагмана — 117 КБ из 188 — уезжали на
// критический путь, хотя лежат на 1700 пикселей ниже сгиба. Самое крупное
// на первом экране при этом абзац текста, и он их ждал. Низкий приоритет
// загрузку не отменяет, а пропускает вперёд то, что рисуется.
const shotImg = (shot) => {
  const { w, h } = imageSize(`assets/shots/${shot.file}`);
  return `<img src="${esc(shotSrc(shot.file))}" alt="${esc(shot.alt)}"
                width="${w}" height="${h}" decoding="async" loading="lazy" fetchpriority="low">`;
};

// На первом экране снимок подписан: там он читается как часть отчёта.
const figure = (shot) => `
            <figure class="shot">
              ${shotImg(shot)}
              <figcaption>${esc(shot.caption)}</figcaption>
            </figure>`;

// На карточке — только первый снимок и без подписи. Подпись встала бы между
// картинкой и названием: читатель увидел бы снимок раньше, чем узнал, чей он.
// Смысл подписи там несёт alt, а рядом уже стоит строка описания.
// Петля на карточке работы — тем же механизмом, что у игр. Ставится
// только если ролик правда снят: пустой <video> хуже статичного снимка,
// и заводить слой под шесть карточек, когда снят один клип, незачем.
// Имя выводится из id проекта: qa-quest → clip-qa-quest.mp4.
const cardClip = (project) => {
  // Имя ролика выводим из снимка, а не из id проекта: снимок и петля —
  // одна и та же сцена, и называются они одинаково. У Psy AI Admin id
  // `psy-ai-admin`, а снимок и клип — `psy-admin`, и по id петля не нашлась
  // бы вовсе. Игровые карточки считают имя так же.
  // Имя ролика ищем двумя способами, потому что ни один не покрывает оба
  // случая: у Psy AI Admin id `psy-ai-admin`, а снимок и клип `psy-admin`;
  // у QA Quest наоборот — id `qa-quest`, снимок `qa-quest-lesson`. Правило
  // «выводить из снимка» чинило одно и ломало другое, проверено на обоих.
  const снимок = project.shots?.[0]?.file;
  if (!снимок) return '';
  const файл = [
    `clip-${снимок.replace(/\.(jpe?g|png|webp)$/i, '')}.mp4`,
    `clip-${project.id}.mp4`,
  ].find((n) => existsSync(join(root, 'assets/clips', n)));
  if (!файл) return '';
  return `<video class="gclip" muted loop playsinline preload="none" tabindex="-1"
                  data-src="/assets/clips/${esc(файл)}?v=${assetVersion(`assets/clips/${файл}`)}"></video>`;
};

const cardShot = (project) => {
  if (!project.shots?.length) return '';
  const visual = `<figure class="shot">${shotImg(project.shots[0])}${cardClip(project)}</figure>`;
  const link = primaryLink(project);
  if (!link) return visual;
  return `
          <a class="card-shot-link" href="${esc(link.url)}"${
            link.url.startsWith('http') ? ' target="_blank" rel="noopener"' : ''
          }${analytics(project)} aria-label="Открыть: ${esc(project.title)}">${visual}</a>`;
};

// Карточка в два слоя. Сверху — что сделано, словами, понятными человеку,
// который не знает слов «шлюз» и «покрытие». Ниже, под «подробнее», — вся
// техника: длинное описание, стек и числа.
//
// Просьба владельца, 1 сентября 2026: «тут просто должна быть короткая
// карточка, продающая меня обычному человеку… потом уже профессионал
// заинтересуется, подробнее узнает сам». И про числа отдельно: «как будто
// карточка здоровая штука, бессмысленно здоровая».
//
// Разметка приходит РАСКРЫТОЙ и сворачивается скриптом — тот же уговор,
// что у навыков и у сборников: без скриптов и для поисковика видно всё.
const card = (project, index) => `
        <article class="card" id="p-${esc(project.id)}">${cardShot(project)}
          <div class="card-head">
            <p class="kicker">${esc(project.kicker)}</p>
            <span class="card-marks">${evidenceMark(project)}${statusBadge(project)}</span>
          </div>
          <h3>${cardTitle(project)}</h3>
          <p class="tagline">${esc(project.tagline)}</p>
          ${linkRow(project)}
          <div class="card-more">
            ${metricBand(project)}
            <p class="summary">${esc(project.summary)}</p>
            ${stackRow(project)}
          </div>
        </article>`;

const byGroup = (group) =>
  db.projects
    .filter((p) => p.groups.includes(group))
    .sort((a, b) => (a.feature?.work ?? 99) - (b.feature?.work ?? 99));

// ── Экран-отчёт: флагман ─────────────────────────────────────────────
// Цифры не живут в projects.json: они приходят из qa-metrics.json, который
// собирает CI гейтвея. Сборка вклеивает снимок, app.js поверх кладёт живой фид.
// Повторный id — это две карточки одной игры и два одинаковых id в
// разметке: якоря начинают вести не туда, а страница перестаёт быть
// валидной. Один раз так и вышло, когда игру добавили заново, не убрав
// старую запись «в сборке». Ошибка должна ронять сборку, а не всплывать
// на боевом.
const ids = db.projects.map((p) => p.id);
const dup = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
if (dup.length) {
  throw new Error(`в projects.json повторяются id: ${dup.join(', ')}`);
}

const flagship = db.projects.find((p) => p.feature?.work === 1);

if (flagship.status.label !== `v${qa.project.version}`) {
  console.warn(
    `  ! projects.json обещает ${flagship.status.label}, а фид отдаёт v${qa.project.version} — беру фид.`
  );
}

const num = (value) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

const headlineCards = qa.headline
  .map(
    (m) => `
            <div class="metric" data-metric="${esc(m.key)}" data-status="${esc(m.status)}">
              <b class="value">${esc(m.display)}</b>
              <span class="label">${esc(m.label.ru)}</span>
              <span class="note">${esc(m.note.ru)}</span>
            </div>`
  )
  .join('');

const suiteRows = qa.tests.suites
  .map(
    (s) =>
      `<li data-status="${esc(s.status ?? (s.failed ? 'failed' : 'passed'))}">${esc(
        s.name
      )} <b>${esc(s.passed)}/${esc(s.total)}</b></li>`
  )
  .join('');

const live = qa.evaluation.live;
const det = qa.evaluation.deterministic;

// Доказательство к числам выше: сам отчёт и консоль, которой их снимали.
const reportProof = flagship.shots?.length
  ? `
        <div class="report-proof">${flagship.shots.map(figure).join('')}
        </div>`
  : '';

const reportScreen = `
      <section class="report" aria-labelledby="flagship-title">
        <div class="report-brief">
          <p class="kicker">AI/LLM QA · <span data-metric-version>v${esc(qa.project.version)}</span></p>
          <h1 id="flagship-title">Локальный ИИ без передачи данных</h1>
          <p class="report-name">${esc(flagship.title)}</p>
          <div class="report-benefits">
            <p>Рабочая программа получает помощь ИИ прямо на вашем компьютере.</p>
            <p>Данные и секреты не уходят наружу.</p>
          </div>
          <p class="report-live"><b>Живой прогон LLM — отдельное измерение.</b> Его не подменяют зелёным тестом и не запускают на каждом push.</p>
        </div>

        <details class="report-more">
          <summary>Подробнее для специалистов <span>тесты, покрытие, evaluation и доказательства</span></summary>
          <div class="report-more-content">
            <div class="report-bar">
              <span class="dot" data-status="${esc(qa.status)}" aria-hidden="true"></span>
              <code>${esc(qa.commit.branch)} @ ${esc(qa.commit.short)} · uv run pytest --cov</code>
              <span class="verdict" data-metric-verdict data-status="${esc(qa.status)}">${esc(
  qa.tests.passed
)} passed · ${esc(qa.tests.failed)} failed · ${esc(qa.tests.duration_ms)} ms</span>
            </div>

            <div class="report-grid">
              <div class="report-lede">
                <p class="detail-head">Как устроено</p>
                <p class="summary">${esc(flagship.summary)}</p>
                ${stackRow(flagship)}
                <p class="card-links">
                  <a class="link link-repo" href="${esc(qa.project.repository)}" target="_blank" rel="noopener">Исходный код <b>↗</b></a>
                  <a class="link link-report" href="${esc(qa.project.report)}" target="_blank" rel="noopener">Allure-отчёт <b>↗</b></a>
                  <a class="link link-run" data-metric-run href="${esc(qa.commit.run_url)}" target="_blank" rel="noopener">Смотреть прогон <b>↗</b></a>
                </p>
              </div>
              <div class="report-metrics" aria-label="Результаты последнего прогона">${headlineCards}</div>
            </div>

            <div class="report-detail">
              <div class="detail">
                <p class="detail-head">Слои тестов</p>
                <ul class="suites">${suiteRows}</ul>
              </div>
              <div class="detail">
                <p class="detail-head">Покрытие</p>
                <p class="detail-body"><b>${esc(qa.coverage.percent)}%</b> при пороге CI ${esc(
  qa.coverage.threshold
)}% · ${esc(num(qa.coverage.covered_lines))} из ${esc(num(qa.coverage.total_lines))} строк, не покрыто ${esc(qa.coverage.missing_lines)}.</p>
              </div>
              <div class="detail">
                <p class="detail-head">LLM-evaluation</p>
                <p class="detail-body">Детерминированный набор «${esc(det.suite)}»: ${esc(det.passed)}/${esc(det.cases)}, mean score ${esc(det.mean_score)}. Живой прогон ${esc(live.model)} через ${esc(live.provider)}: ${esc(live.passed)}/${esc(live.runs)}, mean ${esc(live.mean_score)}, median ${esc(num(live.latency_ms.median))} мс, p95 ${esc(num(live.latency_ms.p95))} мс, stability ${esc(live.stability.min.toFixed(3))}.</p>
              </div>
            </div>
${reportProof}
            <p class="report-context">
              <span><b>Живой прогон</b>: записан один раз ${esc(live.recorded_at)} на машине ${esc(live.environment.machine)} (${esc(live.environment.os)}, ${esc(live.environment.runtime)}, ${esc(live.environment.quantization)}, ${esc(live.environment.parameters)}), профиль ${esc(live.profile.cases)}×${esc(live.profile.repetitions)}, temperature ${esc(live.profile.temperature)}, seed ${esc(live.profile.seed)}. Это не проверяется каждым push — в отличие от тестов и покрытия.</span>
              <span>Прогон от <time data-metric-updated datetime="${esc(qa.generated_at)}">${esc(qa.generated_at)}</time></span>
            </p>
          </div>
        </details>
      </section>`;

// ── Опыт и навыки ────────────────────────────────────────────────────
const profile = site.profile;

const skillsBlock = profile.skills
  .map(
    (s) => `
          <div class="skill">
            <dt>${esc(s.group)}</dt>
            <dd>${s.items.map((i) => `<span>${esc(i)}</span>`).join('')}</dd>
          </div>`
  )
  .join('');

// Лента идёт от свежего к старому, и образование стоит в её конце — но не
// в самом: публикация 2008 года старше университета 2010–2017 и должна
// стоять под ним. Владелец сказал прямо: «она вообще выше универских
// данных! это хронологически тупо». Помечаем такие записи в данных, а не
// правим собранный index.html: он собирается заново, и ручная правка в нём
// живёт до первой сборки — так уже потерялась одна.
const строкаОпыта = (e) => e.compact
  ? `<article class="job job--publication">
      <p class="job-period">${esc(e.period)}</p>
      <h3>${esc(e.org)}</h3>
      <p class="job-role">${esc(e.role)}</p>
      <a class="job-publication-shot shot-link" href="/assets/shots/${esc(e.shot.full)}" aria-label="Открыть полосу журнала целиком">
        ${shotImg(e.shot)}
      </a>
    </article>`
  : `
          <article class="job${e.shot ? ' job--with-shot' : ''}">
            <p class="job-period">${esc(e.period)}${
              // Собственный проект помечается прямо в ленте: без пометки он
              // читается как место работы, а это единственная строчка в
              // разделе с проверяемыми числами — всё остальное слова.
              e.свой ? '<span class="job-own">свой проект</span>' : ''
            }</p>
            <h3>${
              e.site
                ? `<a class="job-site" href="${esc(e.site)}" target="_blank" rel="noopener">${esc(
                    e.org
                  )} <b>↗</b></a>`
                : esc(e.org)
            }</h3>
            ${e.role ? `<p class="job-role">${esc(e.role)}</p>` : ''}${
              e.points.length ? `<ul>${e.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''
            }${
              // Скан кликается: показан он маркой в 160 пикселей, и журнальный
              // кегль там не читается — но не читается он и в натуральную
              // величину, проверено. Полная версия открывается отдельной
              // вкладкой, обычной ссылкой: работает и без скриптов.
              e.shot
                ? (e.shot.full
                    ? `<a class="shot-link" href="/assets/shots/${esc(e.shot.full)}" target="_blank" rel="noopener"
                         aria-label="Открыть полосу журнала целиком">${figure(e.shot)}</a>`
                    : figure(e.shot))
                : ''
            }
          </article>`;

const послеУчёбы = profile.experience.filter((e) => e.show && e.после_учёбы).map(строкаОпыта).join('');

const experienceBlock = profile.experience
  .filter((e) => e.show && !e.после_учёбы)
  .map(строкаОпыта)
  .join('');

// ── Списки ───────────────────────────────────────────────────────────
const listRow = (project) => {
  const link = primaryLink(project);
  const label = link
    ? `<a href="${esc(link.url)}"${
        link.url.startsWith('http') ? ' target="_blank" rel="noopener"' : ''
      }${analytics(project)}>${esc(project.title)}</a>`
    : `<span>${esc(project.title)}</span>`;
  return `
            <li>
              <span class="list-title">${label}</span>
              <span class="list-note">${esc(project.tagline)}</span>
              ${statusBadge(project)}
            </li>`;
};

const allWork = db.projects.filter((p) => p.tracks.includes('work'));
const allPlay = db.projects.filter((p) => p.tracks.includes('play') && p.kind === 'game');
const playable = db.projects.filter((p) => p.groups.includes('playable'));
const otherGames = allPlay.filter((p) => !p.groups.includes('playable'));
const projectById = (id) => db.projects.find((project) => project.id === id);
const qaQuest = projectById('qa-quest');
const dharmaAi = projectById('dharma-ai');
const practicumProjects = ['praktikum-testing', 'ai-agent-service-lab'].map(projectById);

if (!qaQuest || !dharmaAi || practicumProjects.some((project) => !project)) {
  throw new Error('не найдены QueQuest, Dharma AI или один из двух практикумов');
}

const practicumImage = (shot) => {
  const { w, h } = imageSize(`assets/shots/${shot.file}`);
  return `<img src="${shotSrc(shot.file)}" alt="${esc(shot.alt)}" width="${w}" height="${h}" loading="lazy" decoding="async">`;
};

const practicumRouteIntro = {
  'praktikum-testing': 'Поднимаешь локальную модель, подключаешь к приложению и проверяешь ответ, границы, устойчивость и приватность.',
  'ai-agent-service-lab': 'Собираешь агента с памятью и инструментами, а потом ловишь его ошибки: схема ответа, allowlist и источники.',
};

const practicumCard = (project, active, extra = '') => `
          <article class="practicum-detail" id="practicum-panel-${esc(project.id)}"
            data-practicum-panel="${esc(project.id)}">
            <div class="practicum-detail-shot">${practicumImage(project.shots[0])}</div>
            <div class="practicum-detail-copy">
              <div class="card-head">
                <p class="kicker">${esc(project.kicker)}</p>
                ${statusBadge(project)}
              </div>
              <h3>${cardTitle(project)}</h3>
              <p class="tagline">${extra || esc(practicumRouteIntro[project.id] || project.tagline)}</p>
              ${metricChips(project)}
              ${linkRow(project)}
            </div>
          </article>`;

const practicumSwitch = `
      <section class="block practicum-switch" aria-labelledby="practicums-title">
        <div class="block-head">
          <p class="kicker">03</p>
          <h2 id="practicums-title">Практикумы</h2>
          <p>Главный маршрут — QueQuest. Два следующих помогают проверить локальную модель и собрать агента.</p>
        </div>
        <div class="practicum-pilot-grid">
          <article class="quequest-card" aria-labelledby="quequest-title">
            <button class="quequest-visual" type="button" data-quequest-play aria-label="Показать путь QueQuest: от ручной работы к автоматике">
              <img class="quequest-poster" loading="lazy" src="/assets/shots/quequest-automation.jpg?v=${assetVersion('assets/shots/quequest-automation.jpg')}" alt="Механическая рука QueQuest переносит ящик на заполненную паллету" width="1280" height="720" decoding="async">
              <video class="quequest-video" muted playsinline preload="none" data-src="/assets/clips/clip-quequest-manual-to-ai.webm?v=${assetVersion('assets/clips/clip-quequest-manual-to-ai.webm')}" aria-hidden="true"></video>
              <span class="quequest-play-label" aria-hidden="true">Показать переход <b>→</b></span>
            </button>
            <div class="quequest-copy">
              <div class="quequest-heading"><img src="/assets/qa-quest-server-core.png?v=${assetVersion('assets/qa-quest-server-core.png')}" alt="Знак QueQuest" width="128" height="128" loading="lazy" decoding="async"><p class="kicker">Квест · Python</p></div>
              <h3 id="quequest-title">QueQuest</h3>
              <p class="tagline">Сначала герой тащит груз сам. Потом пишет настоящее Python-правило — и механическая рука продолжает разрешённую работу.</p>
            </div>
          </article>
          <aside class="practicum-side" aria-label="Дополнительные практикумы">
            
            <div class="practicum-detail-stage">
              ${practicumProjects.map((project) => practicumCard(project, true)).join('').trim()}
            </div>
          </aside>
        </div>
      </section>`;

// Первый экран отвечает не «чем я интересуюсь», а что уже собрал: приватный
// AI-шлюз и магазин с агентами. Обучающая игра живёт в практикумах ниже.
const leadImage = (file, alt) => {
  const { w, h } = imageSize(`assets/shots/${file}`);
  return `<img src="${shotSrc(file)}" alt="${esc(alt)}" width="${w}" height="${h}" decoding="async">`;
};

const workLead = `
      <section class="work-lead" aria-labelledby="work-lead-title">
        <div class="work-duet">
          <article class="work-system work-gateway">
            <div class="work-gateway-copy">
              <p class="kicker">01 / рабочая система</p>
              <h1 id="work-lead-title">Local Agent Gateway</h1>
              <p>Связывает AI-агентов с приложениями, держит работу стабильной и защищает данные — без передачи наружу.</p>
            </div>
            <a class="work-gateway-proof" href="https://aka-gst.github.io/local-agent-gateway/" target="_blank" rel="noopener">
              ${leadImage('allure-gateway.png', 'Allure-отчёт Local Agent Gateway: 66 тестов и 100% пройдено')}
              <span><b data-metric="tests">66</b> проверок · живой LLM и браузер ↗</span>
            </a>
            <a class="work-system-link" href="https://github.com/aka-gst/local-agent-gateway" target="_blank" rel="noopener">Открыть исходный код <b>↗</b></a>
          </article>
          <a class="work-system work-dharma" href="${esc(dharmaAi.links[0].url)}" target="_blank" rel="noopener"${analytics(dharmaAi)}>
            <div class="work-dharma-shot">
              ${leadImage(dharmaAi.shots[0].file, dharmaAi.shots[0].alt)}
              <span class="dharma-journey" aria-hidden="true"><b>выбор</b><i></i><b>агент</b><i></i><b>заказ</b></span>
            </div>
            <div class="work-dharma-copy">
              <p class="kicker">02 / продукт заказчика</p>
              <h2>Dharma AI · Anigma</h2>
              <p>Магазин 2.0: AI-агенты встречают покупателя, помогают выбрать, оформляют заказ и передают его на отправку.</p>
            </div>
            <span class="work-system-link">Открыть сайт <b>↗</b></span>
          </a>
        </div>
        <p class="work-put">
          <a class="work-put-main" href="/put/comic/">Комикс: как я дошёл до жизни такой</a>
          <a class="work-put-alt" href="/put/">та же история текстом →</a>
        </p>
        <p class="work-duet-note"><b>Один AI остаётся на машине и проверяет себя.</b> Другой ведёт покупателя к заказу. Это две разные рабочие системы, а не концепты.</p>
      </section>`;

// На главной показываем один вход в обучение. Второй маршрут остаётся
// отдельной страницей, а не растягивает витрину двумя почти одинаковыми
// карточками.
const practicumTeaser = `
      <section class="block practicum-teaser" aria-labelledby="practicum-title">
        <div class="block-head">
          <p class="kicker">Практикум</p>
          <h2 id="practicum-title">Проверка локального AI-агента</h2>
          <p>Один маршрут с заданиями и экспериментами. <a href="/praktikum/llm/">Второй: настройка LLM и агентов →</a></p>
        </div>
${practicumCard(practicumProjects[0], true).trim()}
      </section>`;

// Первый экран не повторяет ни отчёт, ни карточки ниже: за несколько секунд
// он объясняет, что именно лежит на сайте, и даёт три настоящих пути дальше.
// Изображение — не логотип: у разделов уже есть три чётких SVG-знака в шапке,
// а здесь ему нужна живая фактура, чтобы страница не начиналась пустотой.
const siteHero = `
      <section class="site-hero" aria-labelledby="site-hero-title">
        <img class="site-hero-art" src="/assets/hero-signal.jpg?v=${assetVersion('assets/hero-signal.jpg')}" alt="" width="1672" height="941" fetchpriority="high" decoding="async">
        <div class="site-hero-copy">
          <p class="kicker">aka-gst / 2026</p>
          <h1 id="site-hero-title">ИИ-инструменты, игры и рассказы — сделанные до результата.</h1>
          <p>Здесь можно открыть работающие вещи, сыграть в браузере и прочитать тексты Сергея Гостова.</p>
          <nav class="site-hero-routes" aria-label="Что есть на сайте">
            <a href="#work"><span>Работа</span><b>ИИ и проверка</b></a>
            <a href="#games"><span>Игры</span><b>прямо в браузере</b></a>
            <a href="/rasskazy/"><span>Рассказы</span><b>23 текста</b></a>
          </nav>
        </div>
      </section>`;

const partnerForm = `
          <form class="partner-form" data-contact-form action="/api/contact/submit" method="post">
            <label>Как к вам обращаться
              <input name="name" maxlength="80" autocomplete="name" required>
            </label>
            <label>Как ответить
              <input name="reply" maxlength="120" autocomplete="email" placeholder="Telegram, e-mail или другой удобный способ" required>
            </label>
            <label class="partner-message">Что хотите сделать вместе
              <textarea name="message" maxlength="2000" rows="5" required></textarea>
            </label>
            <label class="partner-honeypot" aria-hidden="true">Компания
              <input name="company" tabindex="-1" autocomplete="off">
            </label>
            <button type="submit">Отправить запрос</button>
            <p class="partner-status" data-contact-status aria-live="polite"></p>
          </form>`;

// ── Панель «Работа» ──────────────────────────────────────────────────
const workPanel = `
      ${workLead}

${practicumSwitch.trim()}

      <section class="block" aria-labelledby="products-title">
        <div class="block-head">
          <p class="kicker">С заказчиками</p>
          <h2 id="products-title">Продукты, которые остаются у людей</h2>
          <p>Автоматизация, в которой виден путь: что делает система, где её границы и чем подтверждён результат.</p>
        </div>
        <div class="grid" data-shared-details>${byGroup('client-products').filter((project) => project.id !== 'dharma-ai').map(card).join('')}
        </div>
      </section>

      <section class="block" aria-labelledby="profile-title">
        <div class="block-head">
          <p class="kicker">06</p>
          <h2 id="profile-title">Опыт и навыки</h2>
          <p>${esc(profile.summary)}</p>
        </div>
        <dl class="skills">${skillsBlock}
        </dl>
        <div class="jobs">${experienceBlock}
          <article class="job">
            <p class="job-period">${esc(profile.education.period)}</p>
            <h3>${esc(profile.education.org)}</h3>
            <p class="job-role">${esc(profile.education.detail)}</p>
          </article>${послеУчёбы}
        </div>
      </section>

      <section class="block" aria-labelledby="all-work-title">
        <div class="block-head">
          <h2 id="all-work-title">Все проекты</h2>
        </div>
        <details class="project-index">
          <summary>Показать все ${allWork.length} проектов <b>↓</b></summary>
          <ul class="list">${allWork.map(listRow).join('')}
          </ul>
        </details>
      </section>

      `.trim();

// ── Панель «Игры» ────────────────────────────────────────────────────
const gameCard = (project) => {
  // Только ссылка на саму игру. Иначе карточка звала «ЗАПУСТИТЬ», а вела
  // в репозиторий с кодом — обещание, которого страница не выполняет.
  const link = project.links.find((l) => l.type === 'play') || null;
  const tag = link ? 'a' : 'article';
  const href = link ? ` href="${esc(link.url)}"` : '';
  // Графика собирается из пустых <i>: рисует её CSS, лишних файлов нет.
  const pips = { uno: 3, cubes: 3, rps: 3, orbs: 3, coin: 2, dice: 5 }[project.art] || 3;
  // Кадр из самой игры — фоном под анимацией. Он не заменяет её, а даёт
  // карточке настоящую палитру игры вместо абстрактного градиента.
  // alt пустой: родитель и так aria-hidden, картинка здесь декоративная.
  const back = project.shots?.length
    ? (({ file }, { w, h } = imageSize(`assets/shots/${file}`)) =>
        `<img class="gshot" src="${esc(shotSrc(file))}" alt=""
                width="${w}" height="${h}" decoding="async" loading="lazy">`)(project.shots[0])
    : '';
  // Абстрактная графика — замена кадру, а не добавка к нему. Пока кадра не
  // было, она и была картинкой карточки; поверх настоящего снимка игры она
  // говорит то же самое второй раз и грубее. Остаётся там, где снимать пока
  // нечего.
  const pipsHtml = back ? '' : '<i></i>'.repeat(pips);
  // Ролик подбирается по имени кадра: game-acid.jpg → clip-acid.mp4. Так
  // связь не надо дублировать в базе, и она не может разойтись.
  // src не проставлен: адрес лежит в data-src, и app.js подставляет его при
  // первом наведении. Иначе восемь роликов тянулись бы при загрузке страницы
  // ради того, что большинство посетителей не откроет.
  const clipFile = project.shots?.length
    ? project.shots[0].file.replace(/^game-(.+)\.jpe?g$/, 'clip-$1.mp4')
    : '';
  const clip =
    clipFile.endsWith('.mp4') && existsSync(join(root, 'assets/clips', clipFile))
      ? `<video class="gclip" muted loop playsinline preload="none" tabindex="-1"
                data-src="/assets/clips/${esc(clipFile)}?v=${assetVersion(
          `assets/clips/${clipFile}`
        )}"></video>`
      : '';
  return `
        <${tag} class="gcard"${
    project.art ? ` data-art="${esc(project.art)}"` : ''
  }${href}${link ? analytics(project) : ''}>
          <span class="gart" aria-hidden="true">${back}${clip}${pipsHtml}</span>
          <div class="gcard-body">
            <div class="gcard-top">${statusBadge(project)}</div>
            <h3 class="gcard-title">${esc(project.title)}${
    // Прежнее имя выводится, только если задано. Игровая карточка кикер не
    // показывает, поэтому переименование иначе стирает игру для тех, кто
    // знал её под старым названием: человек ищет «Один удар» и не находит.
    project.formerly
      ? `<span class="gcard-formerly">бывший «${esc(project.formerly)}»</span>`
      : ''
  }</h3>
            <p class="gcard-text">${esc(project.tagline)}</p>
            <span class="launch">${link ? 'ЗАПУСТИТЬ <b>↗</b>' : 'СКОРО'}</span>
          </div>
        </${tag}>`;
};

// Полоса над играми — ровня строке прогона на «Работе». Она держит верх
// обеих вкладок на одном уровне и говорит то же самое по сути: из чего
// собрано и в каком это состоянии. Числа считаются из базы, чтобы не
// разъехались с карточками при следующей игре.
const plural = (n, forms) => {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
};

const playCount = (state) => allPlay.filter((p) => p.status.state === state).length;
const playState = [
  [playCount('live'), 'готовых'],
  [playCount('alpha') + playCount('beta'), 'в альфе'],
  [playCount('wip'), 'в сборке'],
]
  .filter(([n]) => n)
  .map(([n, label]) => `${n} ${label}`)
  .join(' · ');

const playBar = `
        <div class="play-bar">
          <span class="dot" aria-hidden="true"></span>
          <code>${allPlay.length} ${plural(
  allPlay.length,
  ['игра', 'игры', 'игр']
)} · открываются по ссылке · без установки и аккаунта</code>
          <span class="verdict">${esc(playState)}</span>
        </div>`;

const book = JSON.parse(readFileSync(join(root, 'data', 'stories.json'), 'utf8'));

// Скорость чтения прозы по-русски — около 180 слов в минуту. Число берётся
// из самого текста, а не проставляется руками, как и всё остальное на сайте.
const minutes = (words) => Math.max(1, Math.round(words / 180));

// Сборники показываются от свежего к раннему — просьба владельца. В данных
// они лежат хронологически: это порядок, в котором книги написаны, и его
// трогать нельзя. Переворачиваем только на выводе.
const сборникиПоказ = [...book.сборники].reverse();

const storyList = book.сборники.flatMap((c) =>
  c.stories.map((st) => ({ ...st, book: c }))
);

const storyBodyInline = (slug) =>
  readFileSync(join(root, 'stories', `${slug}.txt`), 'utf8')
    .split('\n').map((p) => p.trim()).filter(Boolean)
    .map((p) => /^\*\*\*$|^\*\s*\*\s*\*$/.test(p) ? '<hr class="story-break">' : `<p>${esc(p)}</p>`)
    .join('\n');

const storyCollectionPanel = (collection) => {
  const intro = collection.stories.find((story) => /^(вступление|предисловие)$/i.test(story.title));
  const contents = collection.stories.filter((story) => story !== intro);
  return `          <section class="story-collection" id="story-collection-${esc(collection.id)}" data-story-collection-panel="${esc(collection.id)}" hidden>
            <img src="/assets/covers/${esc(collection.cover)}" alt="" width="600" height="900" loading="lazy">
            <div><p class="kicker">Сборник · ${esc(collection.year)}</p><h2>${esc(collection.title)}</h2>${intro ? `<div class="story-collection-intro"><p class="kicker">Вступительное слово</p>${storyBodyInline(`${collection.id}--${intro.slug}`)}</div>` : ''}<p class="story-collection-count">${esc(contents.length)} ${plural(contents.length, ['рассказ', 'рассказа', 'рассказов'])}. Выбери из оглавления — текст раскроется здесь же.</p><ol>${contents.map((story) => `<li><button type="button" data-story-open="${esc(collection.id)}--${esc(story.slug)}">${esc(story.title)}</button></li>`).join('')}</ol></div>
          </section>`;
};

// Полки рассказов на вкладке «Игры» больше нет. Стояла с 30 августа как
// перелинковка разделов: пришедший за играми не узнавал, что есть проза.
// Владелец спросил «почему в играх рассказы?», довод выслушал и сказал
// **убрать** (31 августа 2026, через Мозг). Обратная ссылка на игры в
// подвале рассказов остаётся — он говорил только про вкладку игр.
const playPanel = `
        <section class="block block--lead" aria-label="Играбельное">
${playBar}
          <div class="ggrid">${playable.map(gameCard).join('')}
          </div>
        </section>

        <section class="block" aria-labelledby="other-games-title">
          <div class="block-head">
            <h2 id="other-games-title">Остальное</h2>
          </div>
          <div class="ggrid">${otherGames.map(gameCard).join('')}
          </div>
        </section>

        <p class="story-cross story-cross--code">
          <a href="https://github.com/aka-gst?tab=repositories" target="_blank" rel="noopener"
             data-umami-event="code-open" data-umami-event-from="games">Код всех игр открыт <b>↗</b></a>
        </p>`;

// Рассказы — третий равный раздел главной: не отдельная «длинная страница»,
// а тот же экран, что работа и игры. Полное оглавление остаётся в читалке.
const storiesPanel = `
      <section class="story-lead" aria-labelledby="stories-lead-title">
        <div class="story-lead-copy">
          <p class="kicker">Рассказы Сергея Гостова</p>
          <h1 id="stories-lead-title">Три сборника, ${esc(storyList.length)} рассказов</h1>
          <p>Фантастика, люди, машины и странные правила мира. Нажми на обложку — откроется её список.</p>
        </div>
        <button type="button" class="story-all-link" data-story-all aria-expanded="false">Все рассказы <b>↓</b></button>
        <div class="story-shelves">
${сборникиПоказ.map((collection) => `
          <button type="button" class="story-lead-book" data-story-collection="${esc(collection.id)}" aria-expanded="false" aria-controls="story-collection-${esc(collection.id)}">
            <img src="/assets/covers/${esc(collection.cover)}" alt="Сборник «${esc(collection.title)}»" width="600" height="900" loading="lazy">
            <span>${esc(collection.title)}</span>
          </button>`).join('')}
        </div>
        <div class="story-collections">
${сборникиПоказ.map(storyCollectionPanel).join('\n')}
        </div>
        <article class="story-reader-inline" data-story-reader hidden><button type="button" data-story-back>← к оглавлению</button><p class="kicker" data-story-reader-meta></p><h2 data-story-reader-title></h2><div class="story-reader-copy" data-story-reader-copy></div><p class="story-cross"><a data-story-permalink href="/rasskazy/">Открыть отдельной страницей</a></p><button type="button" class="story-to-top" data-story-top aria-label="Перейти наверх">↑ <span>Наверх</span></button></article>
        <div class="story-source" hidden>${storyList.map((story) => `<article data-story-source="${esc(story.book.id)}--${esc(story.slug)}" data-story-book="${esc(story.book.title)}" data-story-title="${esc(story.title)}">${storyBodyInline(`${story.book.id}--${story.slug}`)}</article>`).join('')}</div>
      </section>`;

// ── Сборка страницы ──────────────────────────────────────────────────
const html = `<!doctype html>
<html lang="ru" data-track="work">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="${esc(site.description)}">
    <meta name="color-scheme" content="dark">
    <meta name="theme-color" content="${esc(site.themeColor)}">
    <title>${esc(site.title)}</title>
    <link rel="canonical" href="${esc(site.url)}/">
    <link rel="icon" href="/assets/favicon-32.png?v=${assetVersion('assets/favicon-32.png')}" type="image/png" sizes="32x32">
    <link rel="icon" href="/assets/favicon-64.png?v=${assetVersion('assets/favicon-64.png')}" type="image/png" sizes="64x64">

    <!-- Ссылку на портфолио чаще всего открывают из мессенджера или письма:
         без этих тегов превью разворачивается пустым. -->
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="${esc(site.handle)}">
    <meta property="og:locale" content="ru_RU">
    <meta property="og:url" content="${esc(site.url)}/">
    <meta property="og:title" content="${esc(site.title)}">
    <meta property="og:description" content="${esc(site.description)}">
    <meta property="og:image" content="${esc(site.url)}${esc(site.ogImage)}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="aka-gst — отчёт прогона Local Agent Gateway">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${esc(site.title)}">
    <meta name="twitter:description" content="${esc(site.description)}">
    <meta name="twitter:image" content="${esc(site.url)}${esc(site.ogImage)}">
    <link rel="stylesheet" href="/assets/site.css?v=${cssVersion}">
    <script>
      // Восстанавливаем выбранный раздел до первой отрисовки, чтобы не мигало.
      try {
        var t = location.hash === '#games' ? 'play'
              : location.hash === '#stories' ? 'stories'
              : location.hash === '#work' ? 'work'
              : localStorage.getItem('aka-gst:track');
        if (t === 'play' || t === 'work' || t === 'stories') document.documentElement.dataset.track = t;
      } catch (e) {}
    </script>
    <script defer src="/pulse/script.js" data-website-id="${esc(site.umamiId)}"></script>
  </head>
  <body>
    <a class="skip" href="#main">К содержимому</a>
    <header class="topbar">
      ${brand('work', { switchable: true })}
      <div class="track-switch" role="group" aria-label="Раздел сайта">
        <button type="button" data-track-to="work" data-umami-event="track-switch" data-umami-event-track="work">${trackIcon(
          'work'
        )}<span>${esc(site.tracks.work.label)}</span></button>
        <button type="button" data-track-to="play" data-umami-event="track-switch" data-umami-event-track="play">${trackIcon(
          'games'
        )}<span>${esc(site.tracks.play.label)}</span></button>
        <button type="button" data-track-to="stories" data-umami-event="track-switch" data-umami-event-track="stories">${trackIcon('stories')}<span>Рассказы</span></button>
      </div>
      <a class="topbar-link" href="/en/" hreflang="en" lang="en" data-umami-event="en-open">EN</a>
      <nav class="socials" aria-label="Профили">
${socialLinks('header')}
      </nav>
    </header>

    <main id="main">
      <div class="panel" data-panel="work">${workPanel}
      </div>
      <div class="panel" data-panel="play">${playPanel}
      </div>
      <div class="panel" data-panel="stories">${storiesPanel}
      </div>
    </main>

    <footer class="sitefoot">
      <span>aka-gst.ru</span>
      <nav class="socials" aria-label="Профили в подвале">
${socialLinks('footer')}
      </nav>
      <span class="foot-note">${esc(site.footerNote)}</span>
    </footer>

    <script src="/assets/app.js?v=${jsVersion}" defer></script>
  </body>
</html>
`;

writeFileSync(join(root, 'index.html'), html);

// ── Индекс раздела практикумов ───────────────────────────────────────
// Редирект /praktikum вёл в пустоту, пока этой страницы не было.
const courses = db.projects.filter((p) => p.courseFeed);

// Кадр для карточки практикума. Снят «Глазами» под ширину 353 — ровно ту, в
// которой карточка живёт на обеих ширинах экрана (353 на десктопе, 358 на
// телефоне). Показывает СОДЕРЖАНИЕ, а не верх страницы: заголовок, метки и
// кнопка на карточке уже есть, и снимок обложки повторил бы их слово в слово.
// Соответствие сверено по описанию проекта, а не по имени файла.
const kadrPraktikuma = {
  'praktikum-testing': 'praktikum-marshruty.png',
  'ai-agent-service-lab': 'praktikum-chto-rabotaet.png',
};

const courseRows = courses
  .map((project) => {
    const course = readCourse(project.courseFeed.path);
    const t = course?.totals || {};
    return `
        <a class="card" href="${esc(project.courseFeed.mount)}">
          ${
            kadrPraktikuma[project.id]
              ? `<img class="course-shot" src="/assets/shots/${kadrPraktikuma[project.id]}?v=${assetVersion(
                  `assets/shots/${kadrPraktikuma[project.id]}`
                )}" alt="" width="353" height="122" decoding="async" loading="lazy">`
              : ''
          }
          <p class="kicker">${esc(project.kicker)}</p>
          <h3>${esc(course?.title || project.title)}</h3>
          <p class="tagline">${esc(course?.subtitle || project.tagline)}</p>
          <ul class="chips">
            <li><b>${esc(t.units ?? '—')}</b> <span>разделов</span></li>
            <li><b>${esc(t.experiments ?? '—')}</b> <span>практических работ</span></li>
            <li><b>~${esc(t.estimate_minutes ?? '—')} мин</b> <span>чтения</span></li>
          </ul>
          ${
            Array.isArray(project.stack) && project.stack.length
              ? `<p class="course-stack">${project.stack.map((t) => esc(t)).join(' · ')}</p>`
              : ''
          }
          <span class="link">Открыть <b>→</b></span>
        </a>`;
  })
  .join('');

const praktikumPage = `<!doctype html>
<html lang="ru" data-track="work">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="Практикумы aka-gst: тестирование локального AI-агента и настройка LLM под задачу.">
    <meta name="color-scheme" content="dark">
    <meta name="theme-color" content="${esc(site.themeColor)}">
    <title>Практикумы — ${esc(site.handle)}</title>
    <link rel="canonical" href="${esc(site.url)}/praktikum/">
    <link rel="icon" href="/assets/favicon-32.png?v=${assetVersion('assets/favicon-32.png')}" type="image/png" sizes="32x32">
    <link rel="icon" href="/assets/favicon-64.png?v=${assetVersion('assets/favicon-64.png')}" type="image/png" sizes="64x64">
    <link rel="stylesheet" href="/assets/site.css?v=${cssVersion}">
    <script defer src="/pulse/script.js" data-website-id="${esc(site.umamiId)}"></script>
  </head>
  <body class="page-short">
    <header class="topbar">
      ${brand()}
    </header>
    <main id="main">
      <section class="block" style="margin-top:34px">
        <div class="block-head">
          <p class="kicker">Практикумы</p>
          <h2>Собрано из настоящей работы</h2>
          <p>Каждый шаг доведён до проверяемого результата: команда, ожидаемый вывод и что делать, когда вывод другой.</p>
        </div>
        <div class="grid">${courseRows}
        </div>
      </section>
    </main>
    <footer class="sitefoot">
      <span><a href="/" style="text-decoration:none">← aka-gst.ru</a></span>
    </footer>
  </body>
</html>
`;

writeFileSync(join(root, 'praktikum', 'index.html'), praktikumPage);

// ── Страница для иностранного работодателя ───────────────────────────
// Просьба Сергея: «я ориентируюсь на то, чтобы потом работать на
// иностранцев». Это не перевод сайта: рассказы, «Юрта» и хакасский текст
// работают на другую аудиторию, и переводить их незачем. Одна короткая
// страница — кто он, что умеет, чем это доказано.
//
// Все числа берутся ИЗ ТЕХ ЖЕ данных, что и русская страница. Если писать
// их руками, через месяц английская версия начнёт врать, и заметит это
// работодатель, а не мы.
//
// Место работы названо прямо. Для удалённой работы первое, что смотрят, —
// право на работу и часовой пояс; умолчание читается хуже прямого ответа.
const en = (id) => db.projects.find((p) => p.id === id);
const enProof = (items) =>
  `<ul class="chips">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;

const enCard = (title, url, lead, proof, repo) => `
        <article class="card">
          <h3><a class="card-title" href="${esc(url)}"${
  url.startsWith('http') ? ' target="_blank" rel="noopener"' : ''
}>${esc(title)}</a></h3>
          <p class="tagline">${esc(lead)}</p>
          ${enProof(proof)}
          <p class="card-links"><a class="link" href="${esc(url)}"${
  url.startsWith('http') ? ' target="_blank" rel="noopener"' : ''
}>Open <b>→</b></a>${
  repo
    ? ` <a class="link" href="${esc(repo)}" target="_blank" rel="noopener">Source <b>↗</b></a>`
    : ''
}</p>
        </article>`;

const enPage = `<!doctype html>
<html lang="en" data-track="work">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="Hands-on AI Product &amp; Agentic Systems Architect. I build AI products end to end — from scenario and model to secure remote delivery and verification.">
    <meta name="color-scheme" content="dark">
    <meta name="theme-color" content="${esc(site.themeColor)}">
    <title>${esc(site.handle)} — Hands-on AI Product &amp; Agentic Systems Architect</title>
    <link rel="canonical" href="${esc(site.url)}/en/">
    <link rel="alternate" hreflang="ru" href="${esc(site.url)}/">
    <link rel="alternate" hreflang="en" href="${esc(site.url)}/en/">
    <link rel="icon" href="/assets/favicon-32.png?v=${assetVersion('assets/favicon-32.png')}" type="image/png" sizes="32x32">
    <link rel="icon" href="/assets/favicon-64.png?v=${assetVersion('assets/favicon-64.png')}" type="image/png" sizes="64x64">
    <link rel="stylesheet" href="/assets/site.css?v=${cssVersion}">
    <script defer src="/pulse/script.js" data-website-id="${esc(site.umamiId)}"></script>
  </head>
  <body>
    <header class="topbar">
      ${brand()}
      <a class="link" href="/">По-русски <b>→</b></a>
    </header>
    <main id="main">
      <section class="block" style="margin-top:34px">
        <div class="block-head">
          <p class="kicker">Hands-on AI Product &amp; Agentic Systems Architect</p>
          <h1>I build AI products end to end — from scenario and model to secure remote delivery and verification.</h1>
          <p>I define safe boundaries for agent actions and prove the result with
             scenarios, evaluations and automated checks.
             Every claim below opens in one click.</p>
          <p class="muted">Saint Petersburg, Russia · UTC+3 · remote · Russian native, English working</p>
        </div>
      </section>

      <section class="block" aria-labelledby="en-work">
        <div class="block-head">
          <h2 id="en-work">Selected work</h2>
          <p>Four projects, each with the number that backs it. The numbers come
             from the same data the Russian pages use, so they cannot drift apart.</p>
        </div>
        <div class="grid">${[
          enCard(
            'Local Agent Gateway',
            '/#p-local-agent-gateway',
            'A loopback gateway between an OpenAI-compatible client and a local Ollama model, with the whole test rig around it.',
            [
              `${qa.headline[0].display} ${qa.headline[0].label.en.toLowerCase()}`,
              `${qa.coverage.percent}% coverage, CI threshold ${qa.coverage.threshold}%`,
              ...qa.tests.suites.map((x) => `${x.name} ${x.passed}/${x.total}`),
            ],
            'https://github.com/aka-gst/local-agent-gateway'
          ),
          enCard(
            'Psy AI Admin',
            '/psy-admin/',
            'A site assistant for a psychology centre that answers only from an approved knowledge base — and says so when a live person is needed.',
            ['8 safety tests', '38 scenarios', 'boundaries fixed before the build, not after'],
            'https://github.com/aka-gst/psy-ai-admin'
          ),
          enCard(
            'Photo Meta Editor',
            '/photodata/',
            'Batch-edits the capture date of photos and video in the browser. Files never leave the device.',
            ['19 automated tests', '0 network requests', "enforced by the page's own CSP, not by a promise"],
            'https://github.com/aka-gst/photo_meta_editer'
          ),
          enCard(
            'Agent-driven storefront',
            '/#p-dharma-ai',
            'An assistant takes a shopper from question to a finished cart; three service agents sit behind it. Built with a co-founder, in progress.',
            ['12 mechanical scenarios', '8/8 and 4/4 on the current run', 'checkable assertions, not model-judges-model'],
            null
          ),
        ].join('')}
        </div>
      </section>

      <section class="block" aria-labelledby="en-games">
        <div class="block-head">
          <h2 id="en-games">And eleven browser games</h2>
          <p>Not the main thing, but the proof that things reach real people:
             they are playable right now, on a phone, with no install. Source is
             open for all of them.</p>
        </div>
        <p class="card-links">
          <a class="link" href="/#games">Play <b>→</b></a>
          <a class="link" href="https://github.com/aka-gst?tab=repositories" target="_blank" rel="noopener">All repositories <b>↗</b></a>
        </p>
      </section>
    </main>
    <footer class="sitefoot">
      <span><a href="/" style="text-decoration:none">← aka-gst.ru</a></span>
    </footer>
  </body>
</html>
`;

writeFileSync(join(root, 'en', 'index.html'), enPage);

// ── Рассказы ─────────────────────────────────────────────────────────
// Тексты лежат в stories/ обычными файлами: абзац — строка, «***» —
// разделитель сцены. Разметки в них нет намеренно, прозе она не нужна, а
// разбирать markdown ради курсива не стоит того.
const storyBody = (slug) =>
  readFileSync(join(root, 'stories', `${slug}.txt`), 'utf8')
    .split('\n')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) =>
      /^\*\*\*$|^\*\s*\*\s*\*$/.test(p)
        ? '<hr class="story-break">'
        : `<p>${esc(p)}</p>`
    )
    .join('\n        ');

const readerHead = (title, description, canonical) => `
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="${esc(description)}">
    <meta name="color-scheme" content="dark light">
    <meta name="theme-color" content="${esc(site.themeColor)}">
    <title>${esc(title)}</title>
    <link rel="canonical" href="${esc(canonical)}">
    <link rel="icon" href="/assets/favicon-32.png?v=${assetVersion('assets/favicon-32.png')}" type="image/png" sizes="32x32">
    <link rel="icon" href="/assets/favicon-64.png?v=${assetVersion('assets/favicon-64.png')}" type="image/png" sizes="64x64">
    <link rel="stylesheet" href="/assets/site.css?v=${cssVersion}">
    <link rel="stylesheet" href="/assets/read.css?v=${assetVersion('assets/read.css')}">
    <script defer src="/assets/afterimage-scroll.js?v=${assetVersion('assets/afterimage-scroll.js')}"></script>
    <script defer src="/pulse/script.js" data-website-id="${esc(site.umamiId)}"></script>`;

// Шапка сайта на страницах рассказов. Владелец: «почему рассказы не в стиле
// сайта сделаны, хотя бы хэдер» — и он прав: без неё раздел читался как
// чужой сайт. Переключатель здесь — ссылки, а не кнопки: панелей на этой
// странице нет, переключать нечего, а увести на главную нужно.
const readerTopbar = `
      <header class="topbar">
        ${brand('stories')}
        <div class="track-switch" role="group" aria-label="Разделы сайта">
          <a href="/#work">${trackIcon('work')}<span>${esc(site.tracks.work.label)}</span></a>
          <a href="/#games">${trackIcon('games')}<span>${esc(site.tracks.play.label)}</span></a>
        </div>
        <a class="topbar-link topbar-link--here" href="/rasskazy/" aria-current="page">Рассказы</a>
        <nav class="socials" aria-label="Профили">
${socialLinks('reader')}
        </nav>
      </header>`;

// Боковой список на больших экранах: сборники и рассказы внутри. Нужен,
// чтобы переключаться между текстами не возвращаясь в оглавление. На узких
// экранах не выводится — там он занял бы весь первый экран.
const readerSide = (current) => `
      <nav class="reader-side" aria-label="Все рассказы">
${сборникиПоказ
  .map(
    (c) => `        <p class="reader-side-book">${esc(c.title)}</p>
        <ul>
${c.stories
  .map(
    (st) => `          <li><a href="/rasskazy/${esc(st.slug)}/"${
      st.slug === current ? ' aria-current="page"' : ''
    }>${esc(st.title)}</a></li>`
  )
  .join('\n')}
        </ul>`
  )
  .join('\n')}
      </nav>`;

// Панель читателя: грунт и размер. Ставится на обе страницы раздела.
const readerBar = `
      <div class="reader-bar" role="group" aria-label="Как читать">
        <button type="button" data-ground-toggle title="Фон: тёмный или бумажный">◐</button>
        <span class="reader-size">
          <button type="button" data-size="-1" aria-label="Мельче">А−</button>
          <button type="button" data-size="1" aria-label="Крупнее">А+</button>
        </span>
      </div>`;

// Уменьшенные копии обложек делает tools/oblozhki.mjs, а не сборка: пережимать
// тринадцать картинок при каждой сборке дорого и незачем. Но забыть их
// пересобрать легко — поэтому сборка сверяет хеш оригинала и падает, а не
// молча ставит вчерашнюю миниатюру.
const производные = JSON.parse(
  readFileSync(join(root, 'assets/covers/proizvodnye.json'), 'utf8')
);
const копияОбложки = (вид, file, исток = file) => {
  const ключ = `${вид}/${file}`;
  const relative = `assets/covers/${ключ}`;
  const свежесть = createHash('sha256')
    .update(readFileSync(join(root, `assets/covers/${исток}`)))
    .digest('hex')
    .slice(0, 12);
  if (производные[ключ] !== свежесть || !existsSync(join(root, relative))) {
    throw new Error(`копия обложки ${ключ} отстала от оригинала — node tools/oblozhki.mjs`);
  }
  const { w, h } = imageSize(relative);
  return { src: `/${relative}?v=${assetVersion(relative)}`, w, h };
};

// Миниатюра в оглавлении: 44 пикселя на экране, 132 в файле — под тройную
// плотность. Раньше сюда шёл оригинал в 900 пикселей, и оглавление весило
// 2.3 МБ при разметке в 19 КБ.
// Рассказ без своей обложки берёт обложку сборника — решение владельца
// 31 августа: «там где нет обложек — ставить обложку сборника». В список
// идёт КУСОК её, а не целая: у «А потом наступит счастье» своей обложки нет
// ни у одного из семи рассказов, и семь одинаковых квадратиков подряд
// перестают быть списком — различать в нём труднее, чем когда картинок нет
// вовсе (правило 17). На самой странице рассказа кусок незачем: там места
// хватает, и показывается обложка сборника целиком.
//
// Кто рисовал обложку, на сайте больше не пишется: «убери отсюда чьи
// обложки, я заплатил за все которые не из инета» — владелец, 31 августа
// 2026. Поле coverBy в data/stories.json остаётся, это его собственная
// запись; просто ничто её не выводит. Обложки рисовал
// человек, и права на чужую работу — не то место, где экономят.
const чемИллюстрирован = (st, c) => {
  if (st.cover) {
    return { файл: st.cover, свой: true, alt: `Обложка рассказа «${st.title}»` };
  }
  if (!c?.cover) return null;
  return {
    файл: c.cover, свой: false, сборник: c.title, кусок: st.slug,
    alt: `Фрагмент обложки сборника «${c.title}»`,
  };
};

const миниатюра = (и) => {
  const o = и.свой
    ? копияОбложки('mini', и.файл)
    : копияОбложки('kusok', `${и.кусок}.jpg`, и.файл);
  return `<img class="story-thumb" src="${o.src}" alt="${esc(и.свой ? '' : и.alt)}"
                       width="${o.w}" height="${o.h}" loading="lazy" decoding="async">`;
};

// Обложка сборника. Первая на странице грузится сразу и с высоким
// приоритетом: она же самый крупный элемент первого экрана, и ленивая
// загрузка откладывала ровно то, по чему меряется скорость показа.
// Обложки трёх сборников — трёх разных пропорций: квадрат, альбом и
// портрет. Обрезать их под общую полосу нельзя, у двух из трёх название
// стоит на самой картинке и уедет за край. Поэтому обложка вписывается
// целиком, а полосу заполняет её же размытая копия — тот же файл, второй
// загрузки нет.
const обложкаСборника = (c, первая, фоном = false) => {
  const o = копияОбложки('polka', c.cover);
  return `<img class="${фоном ? 'bart-fon' : 'bart-list'}" src="${o.src}" alt="${
    фоном ? '' : `Обложка сборника «${esc(c.title)}»`
  }" width="${o.w}" height="${o.h}" decoding="async"
               ${первая && !фоном ? 'fetchpriority="high"' : 'loading="lazy"'}>`;
};

const storiesIndex = `<!doctype html>
<html lang="ru" data-ground="dark">
  <head>${readerHead(
    `Рассказы — ${book.автор}`,
    `Три сборника: ${book.сборники.map((c) => c.title).join(', ')}. ${storyList.length} рассказов.`,
    `${site.url}/rasskazy/`
  )}
  </head>
  <body class="reader">
${readerTopbar}
    <header class="reader-top">
      <a class="site-home" href="/rasskazy/">← Все рассказы</a>${readerBar}
    </header>
    <main id="main" class="reader-main">
      <div class="reader-lede">
        <h1 class="afterimage-title" data-afterimage="Рассказы" data-afterimage-scroll>Рассказы</h1>
        <p>${esc(book.автор)} · ${storyList.length} ${plural(storyList.length, [
      'текст',
      'текста',
      'текстов',
    ])} · ${book.сборники.length} ${plural(book.сборники.length, [
      'сборник',
      'сборника',
      'сборников',
    ])}</p>
        ${
          // Строчка «меня печатали» — просьба владельца. Она стоит здесь, а
          // не среди наших чисел, потому что это единственное на странице,
          // что сказал не он и не мы: чужая редакция взяла текст в номер.
          // Проверено по самим страницам журнала: содержание номера
          // «ПРОЗА · Сергей Гостов … 71», страница 71 набрана не по-русски.
          book.напечатано
            ? `<p class="pub">${esc(book.напечатано.строка)}</p>`
            : ''
        }${
          // Площадки, где он выкладывает сам. Каждая проверена АНОНИМНЫМ
          // запросом: профиль, который открывается только у него, на витрине
          // бесполезен, а выглядит живой ссылкой. Две из пяти присланных так
          // и отсеялись — `proza.ru/login/` не отвечает вовсе, а Дзен отдаёт
          // снаружи заглушку в три килобайта.
          // Чисел прочтений тут нет намеренно: Author.Today их анонимно не
          // показывает, а ставить на витрину то, чего сам не видел, нельзя.
          book.площадки?.ссылки?.length
            ? `
          <p class="ploshchadki">Выкладываю тексты и здесь: ${book.площадки.ссылки
            .map(
              (л) =>
                `<a href="${esc(л.url)}" target="_blank" rel="noopener me">${esc(л.имя)}</a>`
            )
            .join(', ')}</p>`
            : ''
        }${
          // Числа с Прозы — из его личного кабинета, анонимно их не видно,
          // поэтому рядом стоит дата: через полгода подпись без неё станет
          // неверной. Показы Дзена сюда НЕ идут намеренно — это прокрутки
          // чужой ленты, а не читатели, и любой, кто работал с Дзеном, это
          // знает; выйдет неловко.
          book.площадки?.числа?.строка
            ? `
          <p class="ploshchadki ploshchadki--chisla">${esc(book.площадки.числа.строка)}</p>`
            : ''
        }
      </div>
      <div class="bgrid">
${сборникиПоказ
  .map(
    (c, ci) => `      <div class="book" id="book-${esc(c.id)}">
        <article class="bcard">
          ${
            c.cover
              ? `<span class="bart" aria-hidden="true">${обложкаСборника(c, ci === 0, true)}${обложкаСборника(
                  c,
                  ci === 0
                )}</span>`
              : ''
          }
          <div class="bcard-body">
            <div class="bcard-top"><span class="kicker">Сборник · ${esc(c.year)}</span></div>
            <h2>${esc(c.title)}</h2>
            <p class="bcard-text">${c.stories.length} ${plural(c.stories.length, [
      'рассказ',
      'рассказа',
      'рассказов',
    ])} · ${c.stories.reduce((s, st) => s + minutes(st.words), 0)} мин</p>
          </div>
        </article>
        <div class="book-body" id="book-body-${esc(c.id)}">
        <ol class="book-list">
${c.stories
  .map(
    (st, si, _, и = чемИллюстрирован(st, c)) => `          <li${и ? ' class="has-cover"' : ''}>
            <a href="/rasskazy/${esc(st.slug)}/" data-tekst="/rasskazy/${esc(st.slug)}/tekst.html">
              ${
                и ? миниатюра(и) : ''
              }
              <span class="story-name">${esc(st.title)}</span>
              <span class="story-time">${minutes(st.words)} мин</span>
              ${st.подпись
                ? `<span class="story-lead story-lead--avtor">${esc(st.подпись)}</span>`
                : `<span class="story-lead">${esc(st.lead)}…</span>`}
            </a>
          </li>`
  )
  .join('\n')}
        </ol>
        </div>
      </div>`
  )
  .join('\n')}
      </div>
      ${
        // «Напечатано» — страницы журнала. Владелец разрешил их выложить и
        // сказал про чужих на снимках: «замажь их о оставь меня». Поэтому на
        // обложках лица закрыты, а разворот «Наши авторы» обрезан до его
        // портрета: полутора десяткам чужих людей на его витрине делать нечего.
        // В сетке лежат превью по 440 пикселей, полный кадр открывается по
        // ссылке — иначе страница потянула бы полтора мегабайта картинок,
        // которых почти никто не откроет.
        book.напечатано?.кадры?.length
          ? `<section class="block pechat" aria-labelledby="pechat-title">
        <div class="block-head">
          <p class="kicker">Напечатано</p>
          <h2 id="pechat-title">Журнал «ЮРТА», Абакан</h2>
        </div>
        <div class="pgrid">
${book.напечатано.кадры
  .map((к) => {
    const м = imageSize(`assets/pechat/mini/${к.файл}`);
    return `          <figure class="pcard">
            <a href="/assets/pechat/${esc(к.файл)}?v=${assetVersion(`assets/pechat/${к.файл}`)}" target="_blank" rel="noopener">
              <img src="/assets/pechat/mini/${esc(к.файл)}?v=${assetVersion(
      `assets/pechat/mini/${к.файл}`
    )}" alt="${esc(к.подпись)}" width="${м.w}" height="${м.h}" loading="lazy" decoding="async">
            </a>
            <figcaption>${esc(к.подпись)}</figcaption>
          </figure>`;
  })
  .join('\n')}
        </div>
      </section>`
          : ''
      }
      <p class="story-cross">
        <a href="/#games" data-umami-event="games-open" data-umami-event-from="stories-index">Ещё у меня есть игры в браузере <b>→</b></a>
      </p>
    </main>
    <footer class="sitefoot">
      <span><a href="/" style="text-decoration:none">← aka-gst.ru</a></span>
    </footer>
    <script src="/assets/read.js?v=${assetVersion('assets/read.js')}"></script>
  </body>
</html>
`;

mkdirSync(join(root, 'rasskazy'), { recursive: true });
writeFileSync(join(root, 'rasskazy', 'index.html'), storiesIndex);

for (const [i, st] of storyList.entries()) {
  const prev = storyList[i - 1];
  const next = storyList[i + 1];
  const page = `<!doctype html>
<html lang="ru" data-ground="dark">
  <head>${readerHead(
    `${st.title} — ${book.автор}`,
    st.lead,
    `${site.url}/rasskazy/${st.slug}/`
  )}
  </head>
  <body class="reader">
    <div class="reader-progress" aria-hidden="true"><i></i></div>
${readerTopbar}
    <header class="reader-top">
      <a class="site-home" href="/rasskazy/">← Все рассказы</a>${readerBar}
    </header>
    <main id="main" class="reader-main reader-main--wide">
${readerSide(st.slug)}
      <div class="reader-col">
      <article class="story" data-story="${esc(st.slug)}">
        <p class="story-book">${esc(st.book.title)} · ${esc(st.book.year)}</p>
        <h1>${esc(st.title)}</h1>
        <p class="story-meta">${minutes(st.words)} мин · ${esc(book.автор)}</p>
        ${
          чемИллюстрирован(st, st.book)
            ? (() => {
                const и = чемИллюстрирован(st, st.book);
                const { w, h } = imageSize(`assets/covers/${и.файл}`);
                return `<figure class="story-cover${и.свой ? '' : ' story-cover--book'}">
          <img src="/assets/covers/${esc(и.файл)}?v=${assetVersion(`assets/covers/${и.файл}`)}"
               alt="${esc(и.свой ? `Обложка рассказа «${st.title}»` : `Обложка сборника «${и.сборник}»`)}"
               width="${w}" height="${h}" loading="eager" decoding="async">
        </figure>`;
              })()
            : ''
        }
        ${storyBody(`${st.book.id}--${st.slug}`)}
      </article>
      <p class="story-cross">
        <a href="/#games" data-umami-event="games-open" data-umami-event-from="story"
           data-umami-event-story="${esc(st.slug)}">Ещё у меня есть игры в браузере <b>→</b></a>
      </p>
      <nav class="story-nav">
        ${prev ? `<a href="/rasskazy/${esc(prev.slug)}/">← ${esc(prev.title)}</a>` : '<span></span>'}
        <a href="/rasskazy/">Оглавление</a>
        ${next ? `<a href="/rasskazy/${esc(next.slug)}/">${esc(next.title)} →</a>` : '<span></span>'}
      </nav>
      </div>
    </main>
    <footer class="sitefoot">
      <span><a href="/" style="text-decoration:none">← aka-gst.ru</a></span>
    </footer>
    <script src="/assets/read.js?v=${assetVersion('assets/read.js')}"></script>
  </body>
</html>
`;
  mkdirSync(join(root, 'rasskazy', st.slug), { recursive: true });
  writeFileSync(join(root, 'rasskazy', st.slug, 'index.html'), page);
  // Тот же текст отдельным куском: оглавление подгружает его по клику,
  // а не держит все двадцать три в разметке. Решение владельца —
  // «подгружать». Иначе страница вернулась бы к тем 2340 КБ, с которых
  // её спускали до четырёхсот.
  writeFileSync(
    join(root, 'rasskazy', st.slug, 'tekst.html'),
    `${storyBody(`${st.book.id}--${st.slug}`)}\n`
  );
}

console.log(`  рассказы: ${storyList.length} страниц + оглавление`);

// ── «Путь» ──────────────────────────────────────────────────────────
// Обе формы страницы используют один put.json. Поэтому комикс не получает
// свою версию биографии и не начинает незаметно спорить с документальной.
const putAsset = (relative) => `/assets/${relative}?v=${assetVersion(`assets/${relative}`)}`;
const putImage = (relative, { alt = '', lazy = false, priority = 'auto' } = {}) => {
  const { w, h } = imageSize(`assets/${relative}`);
  return `<img src="${putAsset(relative)}" alt="${esc(alt)}" width="${w}" height="${h}" decoding="async"${lazy ? ' loading="lazy"' : ''}${priority === 'high' ? ' fetchpriority="high"' : ''}>`;
};
const putHead = (title, description, comic) => `
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="dark">
    <meta name="theme-color" content="#0a0b0d">
    <meta name="description" content="${esc(description)}">
    <link rel="canonical" href="${esc(site.url)}${comic ? '/put/comic/' : '/put/'}">
    <title>${esc(title)} — ${esc(site.handle)}</title>
    <link rel="icon" href="/assets/favicon-32.png?v=${assetVersion('assets/favicon-32.png')}" type="image/png" sizes="32x32">
    <link rel="stylesheet" href="/assets/put.css?v=${assetVersion('assets/put.css')}">
    ${comic ? `<link rel="stylesheet" href="/assets/put-comic.css?v=${assetVersion('assets/put-comic.css')}">` : ''}
    <script defer src="/assets/put.js?v=${assetVersion('assets/put.js')}"></script>
  </head>`;

const putChapter = (chapter, { comic = false } = {}) => `
      <article class="put-chapter" id="${esc(chapter.id)}" data-put-chapter="${esc(chapter.id)}" tabindex="-1">
        <div class="put-chapter-head">
          <p class="put-number">${esc(chapter.number)}</p>
          <h2>${esc(chapter.title)}</h2>
          <p class="put-lead">${esc(chapter.lead)}</p>
          <blockquote class="put-quote">«${esc(chapter.quote)}»<cite>${esc(chapter.quoteSource)}</cite></blockquote>
        </div>
        <div>
          <dl class="put-facts">
            <div class="put-fact"><dt>Хотелось</dt><dd>${esc(chapter.desire)}</dd></div>
            <div class="put-fact"><dt>Решение</dt><dd>${esc(chapter.decision)}</dd></div>
            <div class="put-fact"><dt>Нашлось</dt><dd>${esc(chapter.discovery)}</dd></div>
          </dl>
          ${
            chapter.image
              ? `<figure class="put-proof">${putImage(comic && chapter.comicImage ? chapter.comicImage : chapter.image, { lazy: true })}<figcaption><p class="put-proof-kind">${esc(chapter.proofKind)}</p><p class="put-proof-label">${esc(chapter.proof)}</p></figcaption></figure>`
              : ''
          }
          ${chapter.dharma ? `<p class="put-dharma"><b>Production-процесс Dharma.</b> ${esc(chapter.dharma)}</p>` : ''}
          <details class="put-details"><summary>Как это устроено</summary><p>Факты обеих версий страницы берутся из одного источника. Технические детали спрятаны здесь, чтобы рассказ не становился стеной текста.</p></details>
        </div>
      </article>`;

const putPage = ({ comic = false } = {}) => {
  const mode = comic ? 'Комиксная версия' : 'Документальная версия';
  const otherHref = comic ? '/put/' : '/put/comic/';
  const otherLabel = comic ? 'Документальная версия' : 'Комикс-версия';
  const heroImage = comic ? 'put/put-comic-team-pilot.webp' : put.hero.image;
  return `<!doctype html>
<html lang="ru">
${putHead(`${put.title}: ${mode}`, put.subtitle, comic)}
  <body class="put-page${comic ? ' put-comic' : ''}">
    <a class="put-skip" href="#первые-проекты">К истории</a>
    <header class="put-topbar"><div class="put-shell"><a class="put-home" href="/">aka<span>-</span>gst</a><a class="put-mode" href="${otherHref}">${otherLabel} ↗</a></div></header>
    <main>
      <section class="put-hero"><div class="put-shell">
        <div class="put-hero-grid"><div>
          <p class="put-eyebrow">${esc(comic ? 'aka-gst / комиксная версия' : put.hero.eyebrow)}</p>
          <h1>${esc(put.title)}</h1>
          <p class="put-statement">${esc(put.hero.statement)}</p>
          <nav class="put-hero-nav" aria-label="Путь"><a href="#первые-проекты">Начать путь</a><a href="${otherHref}">${otherLabel}</a></nav>
        </div><figure class="put-hero-art">${putImage(heroImage, { alt: put.hero.imageAlt, priority: 'high' })}</figure></div>
      </div></section>
      <nav class="put-index" aria-label="Главы пути" data-put-index><div class="put-shell"><ol class="put-index-list">${put.chapters
        .map((chapter) => `<li><a href="#${esc(chapter.id)}"><b>${esc(chapter.number)}</b>${esc(chapter.title)}</a></li>`)
        .join('')}</ol></div></nav>
      <section class="put-story"><div class="put-shell">${put.chapters.map((chapter) => putChapter(chapter, { comic })).join('')}<footer class="put-foot"><p>Страница собирается из подтверждённых фактов. Правила Dharma отделены от результатов Сергея; графика помечена как пилот, пока не утверждена.</p></footer></div></section>
    </main>
  </body>
</html>`.replace(/[ \t]+\n/g, '\n');
};

mkdirSync(join(root, 'put', 'comic'), { recursive: true });
writeFileSync(join(root, 'put', 'index.html'), putPage());
writeFileSync(join(root, 'put', 'comic', 'index.html'), putPage({ comic: true }));
console.log(`  путь: 2 версии, ${put.chapters.length} глав из одного источника`);

// ── «Утро команды» ──────────────────────────────────────────────────
// Это не витрина выполненных работ: данные намеренно разделяют найденный
// разрыв, предложение пилота и измеритель будущей приёмки.
const utroAsset = (relative) => `/assets/${relative}?v=${assetVersion(`assets/${relative}`)}`;
const utroPage = `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="dark">
    <meta name="theme-color" content="#080a0e">
    <meta name="description" content="Карта восьми коротких пилотов команды aka-gst: что найдено, что проверим и каким числом примем.">
    <link rel="canonical" href="${esc(site.url)}/utro/">
    <title>${esc(utro.title)} — ${esc(site.handle)}</title>
    <link rel="icon" href="/assets/favicon-32.png?v=${assetVersion('assets/favicon-32.png')}" type="image/png" sizes="32x32">
    <link rel="stylesheet" href="/assets/utro.css?v=${assetVersion('assets/utro.css')}">
  </head>
  <body>
    <header class="utro-top"><div class="utro-shell">${brand('work')}<a class="utro-back" href="/">На витрину ↗</a></div></header>
    <main>
      <section class="utro-hero"><div class="utro-shell utro-hero-grid">
        <div><p class="utro-kicker">${esc(utro.eyebrow)}</p><h1 class="utro-title">${esc(utro.title)}</h1><p class="utro-lede">${esc(utro.lede)}</p><div class="utro-equation" aria-label="69 навыков: 52 внешних и 17 наших"><b>69</b><span>52 внешних + ${utro.localCount} наших<br>без дублей</span></div></div>
        <figure class="utro-hero-art"><img src="${utroAsset(utro.hero.file)}" alt="${esc(utro.hero.alt)}" width="1672" height="941" fetchpriority="high" decoding="async"><figcaption>Черновой герой-кадр: восемь связанных станций, без лиц, брендов и текста.</figcaption></figure>
      </div></section>
      <section class="utro-section"><div class="utro-shell"><div class="utro-section-head"><h2>Не каталог навыков. Карта того, что ими можно проверить.</h2><p class="utro-section-intro">52 внешних навыка собраны из шести проверенных источников; ${utro.localCount} — наши локальные практики.</p></div><div class="utro-origin-grid"><ul class="utro-origin-list">${utro.origins.map((source) => `<li><b>${source.count}</b><span>${esc(source.name)}</span></li>`).join('')}</ul><div class="utro-local"><b>${utro.localCount}</b><p>локальных навыков: игры, звук, визуальная приёмка, прогоны, координация и другое.</p><details><summary>Источники и ревизии</summary><p>Количество проверено двумя независимыми именами: папками и полями name в инструкциях. Два Vercel-навыка переименованы, но не продублированы.</p><ul class="utro-revisions">${utro.origins.map((source) => `<li><a href="${esc(source.url)}" target="_blank" rel="noopener">${esc(source.name)}</a> <code>${esc(source.revision)}</code></li>`).join('')}</ul></details></div></div></div></section>
      <section class="utro-section"><div class="utro-shell"><div class="utro-section-head"><h2>8 пилотов на 1–3 часа</h2><p class="utro-section-intro">Каждая карточка — предложение следующей работы, не выданный за результат план.</p></div><div class="utro-pilots">${utro.pilots.map((pilot) => `<article class="utro-card" data-utro-pilot><p class="utro-card-state" data-found="${pilot.state.startsWith('Найдено')}">${esc(pilot.state)}</p><h3>${esc(pilot.title)}</h3><dl><div><dt>Что уже найдено</dt><dd>${esc(pilot.found)}</dd></div><div><dt>Пилот 1–3 часа</dt><dd>${esc(pilot.pilot)}</dd></div><div><dt>Метрика приёмки</dt><dd>${esc(pilot.metric)}</dd></div></dl><details><summary>Техническое доказательство</summary><p>${esc(pilot.proof)}</p></details></article>`).join('')}</div></div></section>
      <section class="utro-section"><div class="utro-shell"><div class="utro-bottom-grid"><article><p class="utro-label">границы</p><h3>5 вещей, которые сознательно не ставим</h3><ul>${utro.refusals.map((item) => `<li>${esc(item)}</li>`).join('')}</ul></article><article><p class="utro-label">OneRedOak</p><h3>Берём принципы, не чужой репозиторий</h3><ul>${utro.oneRedOak.map((item) => `<li>${esc(item)}</li>`).join('')}</ul><p class="utro-note">Готовые workflows, YAML, настройки прав и CLAUDE-вставки не устанавливаем.</p></article></div></div></section>
    </main>
    <footer class="utro-foot"><div class="utro-shell"><p>Страница отделяет проверенные факты от предложений. Ни один из восьми пилотов пока не выполнен и не опубликован.</p></div></footer>
  </body>
</html>`;

mkdirSync(join(root, 'utro'), { recursive: true });
writeFileSync(join(root, 'utro', 'index.html'), utroPage.replace(/[ \t]+\n/g, '\n'));
console.log(`  утро: ${utro.pilots.length} пилотов, ${utro.origins.length} источников`);

// ── Страница 404 ─────────────────────────────────────────────────────
const notFound = `<!doctype html>
<html lang="ru" data-track="work">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex">
    <meta name="color-scheme" content="dark">
    <meta name="theme-color" content="${esc(site.themeColor)}">
    <title>Страница не найдена — ${esc(site.handle)}</title>
    <link rel="icon" href="/assets/favicon-32.png?v=${assetVersion('assets/favicon-32.png')}" type="image/png" sizes="32x32">
    <link rel="icon" href="/assets/favicon-64.png?v=${assetVersion('assets/favicon-64.png')}" type="image/png" sizes="64x64">
    <link rel="stylesheet" href="/assets/site.css?v=${cssVersion}">
  </head>
  <body>
    <header class="topbar">
      ${brand()}
    </header>
    <main id="main">
      <section class="report" style="margin-top:34px">
        <div class="report-bar">
          <span class="dot" data-status="failed" aria-hidden="true"></span>
          <code>GET — 404 Not Found</code>
          <span class="verdict" data-status="failed">not found</span>
        </div>
        <div class="report-grid">
          <div class="report-lede">
            <p class="kicker">Такой страницы нет</p>
            <h1>404</h1>
            <p class="tagline">Ссылка устарела или в адресе опечатка.</p>
            <p class="card-links">
              <a class="link" href="/#work">На главную <b>→</b></a>
              <a class="link" href="/#games">К играм <b>→</b></a>
              <a class="link" href="/praktikum/">К практикумам <b>→</b></a>
            </p>
          </div>
        </div>
      </section>
    </main>
    <footer class="sitefoot"><span>aka-gst.ru</span></footer>
  </body>
</html>
`;

writeFileSync(join(root, '404.html'), notFound);

// ── Страница «сервис не отвечает» ────────────────────────────────────
// Часть маршрутов проксирует на контейнеры соседних проектов. Пока их
// не подняли, Caddy отдаёт голый 502, и это читается как сломанный сайт.
const unavailable = `<!doctype html>
<html lang="ru" data-track="work">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex">
    <meta name="color-scheme" content="dark">
    <meta name="theme-color" content="${esc(site.themeColor)}">
    <title>Сервис недоступен — ${esc(site.handle)}</title>
    <link rel="icon" href="/assets/favicon-32.png?v=${assetVersion('assets/favicon-32.png')}" type="image/png" sizes="32x32">
    <link rel="icon" href="/assets/favicon-64.png?v=${assetVersion('assets/favicon-64.png')}" type="image/png" sizes="64x64">
    <link rel="stylesheet" href="/assets/site.css?v=${cssVersion}">
  </head>
  <body>
    <header class="topbar">
      ${brand()}
    </header>
    <main id="main">
      <section class="report" style="margin-top:34px">
        <div class="report-bar">
          <span class="dot" data-status="failed" aria-hidden="true"></span>
          <code>upstream — no healthy backend</code>
          <span class="verdict" data-status="failed">unavailable</span>
        </div>
        <div class="report-grid">
          <div class="report-lede">
            <p class="kicker">Раздел ещё не запущен</p>
            <h1>Сервис не отвечает</h1>
            <p class="tagline">Этот раздел сейчас разворачивается. Остальной сайт работает.</p>
            <p class="card-links">
              <a class="link" href="/#work">На главную <b>→</b></a>
              <a class="link" href="/#games">К играм <b>→</b></a>
            </p>
          </div>
        </div>
      </section>
    </main>
    <footer class="sitefoot"><span>aka-gst.ru</span></footer>
  </body>
</html>
`;

writeFileSync(join(root, '503.html'), unavailable);

// ── Карта собственных страниц ────────────────────────────────────────
const pageUrls = [
  '/',
  '/put/',
  '/put/comic/',
  '/praktikum/',
  ...courses.map((p) => p.courseFeed.mount),
  ...db.projects
    .flatMap((p) => p.links.map((l) => l.url))
    .filter((url) => url.startsWith('/')),
];

const today = qa.generated_at.slice(0, 10);
const pagesSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...new Set(pageUrls)]
  .map(
    (url) => `  <url>
    <loc>${esc(site.url)}${esc(url)}</loc>
    <lastmod>${esc(today)}</lastmod>
  </url>`
  )
  .join('\n')}
</urlset>
`;

writeFileSync(join(root, 'sitemap-pages.xml'), pagesSitemap);

console.log(
  `собрано: index.html, praktikum/index.html, 404.html, 503.html, sitemap-pages.xml — ${db.projects.length} проектов, ${socials.length} соцсети, ${
    html.length
  } байт`
);
