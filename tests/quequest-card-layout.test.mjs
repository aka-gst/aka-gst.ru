import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');
const css = readFileSync(new URL('assets/site.css', root), 'utf8');

const sectionStart = html.indexOf('<section class="block practicum-switch"');
const sectionEnd = html.indexOf('</section>', sectionStart);
const section = html.slice(sectionStart, sectionEnd);

test('обе кнопки QueQuest живут в одной нижней зоне карточки', () => {
  assert.ok(sectionStart >= 0, 'не найден блок практикумов');
  const articleEnd = section.indexOf('</article>');
  const moreButton = section.indexOf('class="practicum-more-btn"');
  const openButton = section.indexOf('class="quequest-open"');

  assert.ok(moreButton > 0 && moreButton < articleEnd, '«Ещё практикумы» осталась отдельной под карточкой');
  assert.ok(openButton > 0 && openButton < articleEnd, '«Открыть игру» должна быть внутри карточки');
  assert.match(section, /class="quequest-copy quequest-actions"[\s\S]*class="practicum-more-btn"[\s\S]*class="quequest-cta"[\s\S]*class="quequest-open"/);
  assert.doesNotMatch(section, /practicum-more-teaser/);
});

test('QueQuest читается как отдельный фиолетовый продукт, а не зелёная карточка раздела', () => {
  const brand = section.match(/<h3 id="quequest-title">([\s\S]*?)<\/h3>/)?.[1] || '';

  assert.match(brand, /class="quequest-brand"/,
    'у названия нет собственного знака и оно снова выглядит голой надписью');
  assert.match(brand, /assets\/quequest-mark\.svg/,
    'знак QueQuest должен быть чётким вектором, а не мелкой картинкой возле кикера');
  assert.match(section, />Автоматизировать рутину <b aria-hidden="true">↗<\/b><\/a>/,
    'главная кнопка должна называть результат для человека');
  assert.match(css, /\.quequest-card\s*\{[^}]*--quequest-neon:\s*#9b5cff[^}]*border:[^;]*var\(--quequest-neon\)/s,
    'карточка не должна наследовать зелёный акцент раздела работы');
  assert.match(css, /\.quequest-brand img\s*\{[^}]*width:\s*72px/s,
    'знак снова стал незаметной иконкой');
  assert.match(css, /@media \(min-width:\s*901px\) \{\n\s*\.quequest-copy\s*\{/,
    'две колонки QueQuest включаются раньше 901px и режут название в горизонтальном телефоне');
  assert.match(css, /@media \(max-width:\s*900px\) \{[\s\S]*?\.quequest-copy h3\s*\{[^}]*48px\)/,
    'на ширинах до 900px название остаётся десктопным и режет правый край');
});

test('заголовок крупный, дополнительные карточки компактны и hidden не протекает', () => {
  assert.match(css, /\.quequest-copy h3\s*\{[^}]*font-size:\s*clamp\(48px,\s*6vw,\s*76px\)/s);
  assert.match(css, /\.practicum-more-body\[hidden\]\s*\{\s*display:\s*none/);
  assert.match(css, /\.practicum-more \.practicum-detail\s*\{[^}]*min-height:\s*76px/s);
  assert.match(css, /\.practicum-more \.practicum-detail-copy \.tagline\s*\{\s*display:\s*none/);
});

test('Живой цех скрыт с витрины, но его источник не удалён', () => {
  assert.doesNotMatch(html, /id="masterskaya"|>Живой цех</);
  assert.ok(readFileSync(new URL('data/tseh/zhivoy-tseh.html', root), 'utf8').includes('<h2>Живой цех</h2>'));
});
