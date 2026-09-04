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

test('первый экран держит Gateway и QA Quest двумя доступными доказательствами', () => {
  const html = build();
  const lead = html.match(/<section class="work-lead"[\s\S]*?<\/section>/)?.[0] || '';
  assert.match(lead, /Собираю AI-продукты, которыми можно управлять/);
  assert.match(lead, /Обсудить продукт/);
  assert.match(lead, /Открыть игры/);
  assert.match(lead, /Local Agent Gateway/);
  assert.match(lead, /QA Quest/);
  assert.match(lead, /print\("WAKE"\)/);
  assert.doesNotMatch(lead, /Dharma AI · Anigma/);
});

test('практикумы не называют QA Quest путём ко взлому', () => {
  const html = build();
  const practicum = html.match(/<section class="block practicum-switch"[\s\S]*?<\/section>/)?.[0] || '';
  assert.match(practicum, /practicum-card--quest/);
  assert.match(practicum, />QA Quest</);
  assert.match(practicum, /print\("WAKE"\)/);
  assert.doesNotMatch(practicum, /взлому/);
  assert.equal((practicum.match(/data-practicum-to=/g) || []).length, 3);
});

test('форма партнёрства не занимает витрину: связь переедет к помощнику', () => {
  const html = build();
  assert.doesNotMatch(html, /<form class="partner-form" data-contact-form/);
  assert.doesNotMatch(html, /action="\/api\/contact\/submit"/);
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
