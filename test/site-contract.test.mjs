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

test('первый экран показывает две рабочие системы, а не учебную игру', () => {
  const html = build();
  const lead = html.match(/<section class="work-lead"[\s\S]*?<\/section>/)?.[0] || '';
  assert.match(lead, /Local Agent Gateway/);
  assert.match(lead, /без передачи данных наружу/);
  assert.match(lead, /Dharma AI · Anigma/);
  assert.doesNotMatch(lead, /QA Quest/);
});

test('практикумы показывают QA Quest главным и два компактных маршрута рядом', () => {
  const html = build();
  const practicum = html.match(/<section class="block practicum-switch"[\s\S]*?<\/section>/)?.[0] || '';
  assert.match(practicum, /class="practicum-quest"/);
  assert.match(practicum, />QA Quest</);
  assert.equal((practicum.match(/practicum-card--compact/g) || []).length, 2);
  assert.doesNotMatch(practicum, /data-practicum-to=/);
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
