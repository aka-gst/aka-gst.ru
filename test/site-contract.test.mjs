import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (file) => readFileSync(join(root, file), 'utf8');

const build = () => {
  execFileSync(process.execPath, ['build.mjs'], { cwd: root, stdio: 'pipe' });
  return read('index.html');
};

test('первый экран объясняет Gateway человеческим языком, а технику прячет', () => {
  const html = build();
  assert.match(html, /Локальный ИИ без передачи данных/);
  assert.match(html, /Рабочая программа получает помощь ИИ прямо на вашем компьютере/);
  assert.match(html, /Живой прогон LLM — отдельное измерение/);
  assert.match(html, /<details class="report-more">/);
  assert.match(html, /Подробнее для специалистов/);
});

test('QA Quest идёт вторым, а практикумы остаются двумя отдельными вкладками', () => {
  const html = build();
  const qa = html.indexOf('id="p-qa-quest"');
  const compact = html.indexOf('data-practicum-switch');
  assert.ok(qa >= 0, 'нет отдельной карточки QA Quest');
  assert.ok(compact > qa, 'практикумы должны идти после QA Quest');
  assert.match(html, /data-practicum-to="praktikum-testing"/);
  assert.match(html, /data-practicum-to="ai-agent-service-lab"/);
});

test('форма партнёрства не раскрывает личный контакт и ведёт в защищённый API', () => {
  const html = build();
  const caddy = read('Caddyfile');
  assert.match(html, /<form class="partner-form" data-contact-form/);
  assert.match(html, /name="company" tabindex="-1" autocomplete="off"/);
  assert.match(html, /action="\/api\/contact\/submit"/);
  assert.match(caddy, /handle_path \/api\/contact\/\* \{\s*reverse_proxy contact:8080\s*\}/);
});

test('Psy Admin показывает существующий кадр текущей демо-страницы', () => {
  const html = build();
  assert.match(html, /\/assets\/shots\/psy-admin\.jpg\?v=/);
  assert.doesNotMatch(html, /psy-admin-dark/);
});

test('у работы, игр и рассказов разные векторные знаки', () => {
  const html = build();
  const stories = read('rasskazy/index.html');
  for (const mark of ['mark-work.svg', 'mark-games.svg', 'mark-stories.svg']) {
    assert.match(read(`assets/${mark}`), /viewBox="0 0 64 64"/);
  }
  assert.match(html, /data-brand-mark/);
  assert.match(html, /data-mark-work="\/assets\/mark-work\.svg\?v=/);
  assert.match(html, /data-mark-play="\/assets\/mark-games\.svg\?v=/);
  assert.match(stories, /\/assets\/mark-stories\.svg\?v=/);
  assert.doesNotMatch(html, /\/assets\/znak\.png/);
});
