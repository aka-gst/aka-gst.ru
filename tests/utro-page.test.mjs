import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

test('утренняя страница показывает восемь пилотов без выдачи их за результаты', () => {
  assert.equal(existsSync('utro/index.html'), true, 'страница /utro/ ещё не собрана');
  const html = readFileSync('utro/index.html', 'utf8');

  assert.match(html, /69/);
  assert.match(html, /52 внешних/);
  assert.match(html, /17 наших/);
  assert.match(html, /49f948fa/);
  assert.match(html, /6a8fa297/);
  assert.equal((html.match(/data-utro-pilot/g) || []).length, 8, 'нужны все восемь пилотов');
  assert.equal((html.match(/Найдено, ещё не исправлено/g) || []).length, 4, 'четыре разрыва должны быть названы честно');
  assert.match(html, /предложение пилота/i);
  assert.match(html, /OneRedOak/i);
  assert.match(html, /не устанавливаем/i);
  assert.match(html, /<details>/);
  assert.match(html, /\/assets\/utro\/hero\.png\?v=/);
  assert.match(html, /width="1672" height="941"/);
  assert.doesNotMatch(html, /\/Users\/gst\//, 'в страницу не должны попасть локальные пути');
});

test('утренняя страница учитывает мобильную доступность и снижение движения', () => {
  const css = readFileSync('assets/utro.css', 'utf8');
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /object-fit: contain/);
});
