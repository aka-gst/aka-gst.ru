import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';

execFileSync(process.execPath, ['build.mjs'], { stdio: 'pipe' });

const put = JSON.parse(readFileSync('data/put.json', 'utf8'));
const home = readFileSync('index.html', 'utf8');

test('главная показывает одну полноширинную сцену Пути перед двумя проектами', () => {
  const sceneStart = home.indexOf('<article class="work-path"');
  const duetStart = home.indexOf('<div class="work-duet">');

  assert.ok(sceneStart >= 0, 'на главной нет самостоятельной сцены Пути');
  assert.ok(sceneStart < duetStart, 'сцена Пути должна идти перед duet проектов');
  assert.equal((home.match(/class="work-path"/g) || []).length, 1, 'сцена Пути должна быть одна');
  assert.doesNotMatch(home, /class="work-put\b/, 'старая вложенная карточка Пути осталась в duet');
});

test('семь точек маршрута приходят из data/put.json в исходном порядке', () => {
  assert.equal(put.chapters.length, 7, 'каноническая история должна содержать семь глав');

  const ids = [...home.matchAll(/data-work-path-chapter="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(ids, put.chapters.map((chapter) => chapter.id));
  for (const chapter of put.chapters) {
    assert.match(home, new RegExp(`<span class="sr-only">${chapter.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</span>`));
  }
});

test('сцена использует утверждённый тезис, один CTA и размеренный реальный кадр', () => {
  const visibleThesis = put.subtitle.replace(/\.$/, '');
  assert.match(home, new RegExp(`<p class="work-path-thesis">${visibleThesis.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</p>`));
  assert.match(home, /<a class="work-path-cta" href="\/put\/comic\/">Комикс: как я дошёл до жизни такой/);
  assert.equal((home.match(/class="work-path-cta"/g) || []).length, 1);
  assert.match(home, /src="\/assets\/put\/put-documentary-pilot\.webp\?v=[0-9a-f]+"[^>]*width="1672"[^>]*height="941"/);
  assert.match(home, /<span>желание<\/span><span>ошибка<\/span><span>проверка<\/span><span>следующая вещь<\/span>/);
});

test('homepage-only стиль не меняет generated страницы рассказов', () => {
  assert.match(home, /<link rel="stylesheet" href="\/assets\/work-path\.css\?v=[0-9a-f]+">/);
  assert.doesNotMatch(readFileSync('rasskazy/index.html', 'utf8'), /work-path\.css/);
});
