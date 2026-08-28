#!/usr/bin/env node
// Генерирует index.html из data/site.json и data/projects.json.
// Запуск: node build.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const read = (name) => JSON.parse(readFileSync(join(root, 'data', name), 'utf8'));

const site = read('site.json');
const db = read('projects.json');
const qa = read('qa-metrics.json');

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
      { value: t.estimate_minutes ? `~${t.estimate_minutes} мин` : null, label: 'чтения' },
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

const card = (project, index) => `
        <article class="card" id="p-${esc(project.id)}">${metricBand(project)}
          <div class="card-head">
            <p class="kicker">${esc(project.kicker)}</p>
            <span class="card-marks">${evidenceMark(project)}${statusBadge(project)}</span>
          </div>
          <h3>${cardTitle(project)}</h3>
          <p class="tagline">${esc(project.tagline)}</p>
          <p class="summary">${esc(project.summary)}</p>
          ${stackRow(project)}
          ${linkRow(project)}
        </article>`;

const byGroup = (group) =>
  db.projects
    .filter((p) => p.groups.includes(group))
    .sort((a, b) => (a.feature?.work ?? 99) - (b.feature?.work ?? 99));

// ── Экран-отчёт: флагман ─────────────────────────────────────────────
// Цифры не живут в projects.json: они приходят из qa-metrics.json, который
// собирает CI гейтвея. Сборка вклеивает снимок, app.js поверх кладёт живой фид.
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

const reportScreen = `
      <section class="report" aria-labelledby="flagship-title">
        <div class="report-bar">
          <span class="dot" data-status="${esc(qa.status)}" aria-hidden="true"></span>
          <code>${esc(qa.commit.branch)} @ ${esc(qa.commit.short)} · uv run pytest --cov</code>
          <span class="verdict" data-metric-verdict data-status="${esc(qa.status)}">${esc(
  qa.tests.passed
)} passed · ${esc(qa.tests.failed)} failed · ${esc(qa.tests.duration_ms)} ms</span>
        </div>

        <div class="report-grid">
          <div class="report-lede">
            <p class="kicker">${esc(flagship.kicker)} · <span data-metric-version>v${esc(
  qa.project.version
)}</span></p>
            <h1 id="flagship-title">${esc(flagship.title)}</h1>
            <p class="tagline">${esc(flagship.tagline)}</p>
            <p class="summary">${esc(flagship.summary)}</p>
            ${stackRow(flagship)}
            <p class="card-links">
              <a class="link link-repo" href="${esc(
                qa.project.repository
              )}" target="_blank" rel="noopener">Исходный код <b>↗</b></a>
              <a class="link link-report" href="${esc(
                qa.project.report
              )}" target="_blank" rel="noopener">Allure-отчёт <b>↗</b></a>
              <a class="link link-run" data-metric-run href="${esc(
                qa.commit.run_url
              )}" target="_blank" rel="noopener">Смотреть прогон <b>↗</b></a>
            </p>
          </div>

          <div class="report-metrics" aria-label="Результаты последнего прогона">${headlineCards}
          </div>
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
)}% · ${esc(num(qa.coverage.covered_lines))} из ${esc(
  num(qa.coverage.total_lines)
)} строк, не покрыто ${esc(qa.coverage.missing_lines)}.</p>
          </div>
          <div class="detail">
            <p class="detail-head">LLM-evaluation</p>
            <p class="detail-body">Детерминированный набор «${esc(det.suite)}»: ${esc(
  det.passed
)}/${esc(det.cases)}, mean score ${esc(det.mean_score)}. Live-прогон ${esc(
  live.model
)} через ${esc(live.provider)}: ${esc(live.passed)}/${esc(live.runs)}, mean ${esc(
  live.mean_score
)}, median ${esc(num(live.latency_ms.median))} мс, p95 ${esc(
  num(live.latency_ms.p95)
)} мс, stability ${esc(live.stability.min.toFixed(3))}.</p>
          </div>
        </div>

        <p class="report-context">
          <span>Live-прогон — <b>${esc(
            live.source
          )}</b>: записан один раз ${esc(live.recorded_at)} на машине ${esc(
  live.environment.machine
)} (${esc(live.environment.os)}, ${esc(live.environment.runtime)}, ${esc(
  live.environment.quantization
)}, ${esc(live.environment.parameters)}), профиль ${esc(live.profile.cases)}×${esc(
  live.profile.repetitions
)}, temperature ${esc(live.profile.temperature)}, seed ${esc(
  live.profile.seed
)}. Это не проверяется каждым push — в отличие от тестов и покрытия.</span>
          <span>Прогон от <time data-metric-updated datetime="${esc(
            qa.generated_at
          )}">${esc(qa.generated_at)}</time></span>
        </p>
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

const experienceBlock = profile.experience
  .filter((e) => e.show)
  .map(
    (e) => `
          <article class="job">
            <p class="job-period">${esc(e.period)}</p>
            <h3>${esc(e.org)}</h3>
            <p class="job-role">${esc(e.role)}</p>
            <ul>${e.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
          </article>`
  )
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
const leaderboards = db.projects.filter((p) => p.leaderboard);

// ── Панель «Работа» ──────────────────────────────────────────────────
const workPanel = `
      ${reportScreen}

      <section class="block" aria-labelledby="practicums-title">
        <div class="block-head">
          <p class="kicker">02</p>
          <h2 id="practicums-title">Практикумы и обучение</h2>
          <p>Материалы, которые собраны из реальных прогонов: инструкция, автотесты и сохранённые артефакты.</p>
        </div>
        <div class="grid">${byGroup('practicums').map(card).join('')}
        </div>
      </section>

      <section class="block" aria-labelledby="products-title">
        <div class="block-head">
          <p class="kicker">03</p>
          <h2 id="products-title">Продукты с заказчиком</h2>
          <p>Работающие демо, где требования, границы безопасности и проверки описаны заранее.</p>
        </div>
        <div class="grid">${byGroup('client-products').map(card).join('')}
        </div>
      </section>

      <section class="block" aria-labelledby="profile-title">
        <div class="block-head">
          <p class="kicker">04</p>
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
          </article>
        </div>
      </section>

      <section class="block" aria-labelledby="all-work-title">
        <div class="block-head">
          <p class="kicker">05</p>
          <h2 id="all-work-title">Все проекты</h2>
        </div>
        <ul class="list">${allWork.map(listRow).join('')}
        </ul>
      </section>

      <section class="block contact" aria-labelledby="contact-title" id="contact">
        <div class="block-head">
          <p class="kicker">06</p>
          <h2 id="contact-title">${esc(site.contact.heading)}</h2>
          <p>${esc(site.contact.intro)}</p>
        </div>
        <div class="channels">${contactChannels()}
        </div>
      </section>`;

// ── Панель «Игры» ────────────────────────────────────────────────────
const gameCard = (project) => {
  const link = primaryLink(project);
  const tag = link ? 'a' : 'article';
  const href = link ? ` href="${esc(link.url)}"` : '';
  // Графика собирается из пустых <i>: рисует её CSS, лишних файлов нет.
  const pips = { uno: 3, cubes: 3, rps: 3, orbs: 3, coin: 2, dice: 5 }[project.art] || 3;
  return `
        <${tag} class="gcard"${
    project.art ? ` data-art="${esc(project.art)}"` : ''
  }${href}${link ? analytics(project) : ''}>
          <span class="gart" aria-hidden="true">${'<i></i>'.repeat(pips)}</span>
          <div class="gcard-body">
            <div class="gcard-top">${statusBadge(project)}</div>
            <h3 class="gcard-title">${esc(project.title)}</h3>
            <p class="gcard-text">${esc(project.tagline)}</p>
            <span class="launch">${link ? 'ЗАПУСТИТЬ <b>↗</b>' : 'СКОРО'}</span>
          </div>
        </${tag}>`;
};

const recordsBlock = `
        <section class="block" aria-labelledby="records-title">
          <div class="block-head">
            <p class="kicker">REC · СЕГОДНЯ · МСК</p>
            <h2 id="records-title">Рекорды</h2>
            <p>Обновляются в течение дня и обнуляются в полночь по Москве.</p>
          </div>
          <aside class="records-card">
            <h3>Орёл / решка</h3>
            <ol id="coin-today"><li><span>Рекордов пока нет</span><b>—</b></li></ol>
            <p class="other-title">Другие игры сегодня</p>
            <ul id="other-today">${leaderboards
              .filter((p) => p.leaderboard !== 'coin-flip')
              .map(
                (p) => `
              <li data-game="${esc(p.leaderboard)}"><span>${esc(p.title)}</span><b>—</b></li>`
              )
              .join('')}
            </ul>
          </aside>
        </section>`;

const playPanel = `
        <section class="block" aria-labelledby="playable-title">
          <div class="block-head">
            <p class="kicker">ВЫБЕРИ ИГРУ</p>
            <h2 id="playable-title">Топ</h2>
            <p>${esc(site.tracks.play.intro)}</p>
          </div>
          <div class="ggrid">${playable.map(gameCard).join('')}
          </div>
        </section>

        <section class="block" aria-labelledby="other-games-title">
          <div class="block-head">
            <p class="kicker">АРХИВ</p>
            <h2 id="other-games-title">Все игры</h2>
          </div>
          <div class="ggrid">${otherGames.map(gameCard).join('')}
          </div>
        </section>
${recordsBlock}`;

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
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">

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
              : location.hash === '#work' ? 'work'
              : localStorage.getItem('aka-gst:track');
        if (t === 'play' || t === 'work') document.documentElement.dataset.track = t;
      } catch (e) {}
    </script>
    <script defer src="/pulse/script.js" data-website-id="${esc(site.umamiId)}"></script>
  </head>
  <body>
    <a class="skip" href="#main">К содержимому</a>
    <header class="topbar">
      <a class="brand" href="/">aka<span>-</span>gst</a>
      <div class="track-switch" role="group" aria-label="Раздел сайта">
        <button type="button" data-track-to="work" data-umami-event="track-switch" data-umami-event-track="work">${esc(
          site.tracks.work.label
        )}</button>
        <button type="button" data-track-to="play" data-umami-event="track-switch" data-umami-event-track="play">${esc(
          site.tracks.play.label
        )}</button>
      </div>
      <nav class="socials" aria-label="Профили">
${socialLinks('header')}
      </nav>
    </header>

    <main id="main">
      <div class="panel" data-panel="work">${workPanel}
      </div>
      <div class="panel" data-panel="play">${playPanel}
      </div>
    </main>

    <footer class="sitefoot">
      <span>AKA-GST.RU</span>
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

const courseRows = courses
  .map((project) => {
    const course = readCourse(project.courseFeed.path);
    const t = course?.totals || {};
    return `
        <a class="card" href="${esc(project.courseFeed.mount)}">
          <p class="kicker">${esc(project.kicker)}</p>
          <h3>${esc(course?.title || project.title)}</h3>
          <p class="tagline">${esc(course?.subtitle || project.tagline)}</p>
          <ul class="chips">
            <li><b>${esc(t.units ?? '—')}</b> <span>разделов</span></li>
            <li><b>${esc(t.experiments ?? '—')}</b> <span>практических работ</span></li>
            <li><b>~${esc(t.estimate_minutes ?? '—')} мин</b> <span>чтения</span></li>
          </ul>
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
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="stylesheet" href="/assets/site.css?v=${cssVersion}">
    <script defer src="/pulse/script.js" data-website-id="${esc(site.umamiId)}"></script>
  </head>
  <body>
    <header class="topbar">
      <a class="brand" href="/">aka<span>-</span>gst</a>
    </header>
    <main id="main">
      <section class="block" style="margin-top:34px">
        <div class="block-head">
          <p class="kicker">Практикумы</p>
          <h2>Материалы, собранные из реальных прогонов</h2>
          <p>Каждый шаг доведён до проверяемого результата: команда, ожидаемый вывод и что делать, когда вывод другой.</p>
        </div>
        <div class="grid">${courseRows}
        </div>
      </section>
    </main>
    <footer class="sitefoot">
      <span><a href="/" style="text-decoration:none">← AKA-GST.RU</a></span>
    </footer>
  </body>
</html>
`;

writeFileSync(join(root, 'praktikum', 'index.html'), praktikumPage);

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
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="stylesheet" href="/assets/site.css?v=${cssVersion}">
  </head>
  <body>
    <header class="topbar">
      <a class="brand" href="/">aka<span>-</span>gst</a>
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
    <footer class="sitefoot"><span>AKA-GST.RU</span></footer>
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
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="stylesheet" href="/assets/site.css?v=${cssVersion}">
  </head>
  <body>
    <header class="topbar">
      <a class="brand" href="/">aka<span>-</span>gst</a>
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
    <footer class="sitefoot"><span>AKA-GST.RU</span></footer>
  </body>
</html>
`;

writeFileSync(join(root, '503.html'), unavailable);

// ── Карта собственных страниц ────────────────────────────────────────
const pageUrls = [
  '/',
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
