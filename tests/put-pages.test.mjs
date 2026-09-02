import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const chapters = [
  'первые-проекты',
  'две-машины',
  'ошибки-стали-проверками',
  'игры',
  'dharma-и-anigma',
  'витрина-и-роль',
  'что-доделывается',
];

for (const page of ['put/index.html', 'put/comic/index.html']) {
  test(`${page}: одна история, семь проверяемых глав`, () => {
    assert.equal(existsSync(page), true, `${page} ещё не собрана`);
    const html = readFileSync(page, 'utf8');

    for (const id of chapters) {
      assert.match(html, new RegExp(`id="${id}"`), `нет главы ${id}`);
    }

    assert.match(html, /production-процесс Dharma/i);
    assert.match(html, /100[- ]траектор|100 траектор/i);
    assert.match(html, /20 отложенн/i);
    assert.match(html, /12 сценариев/i);
    assert.match(html, /data-put-chapter/);
    assert.doesNotMatch(html, /Production-процесс Dharma\.<\/b>\s*Production-процесс Dharma/i);
    assert.doesNotMatch(html, /\n[ \t]+\n/, 'сборщик оставил пробелы в пустых строках');

    const proofImages = [...html.matchAll(/<figure class="put-proof"><img\b([^>]+)>/g)];
    assert.equal(proofImages.length, 7, 'у каждой главы есть один снимок');
    for (const [, attrs] of proofImages) {
      assert.match(attrs, /\bwidth="\d+"/, 'снимок должен заранее резервировать ширину');
      assert.match(attrs, /\bheight="\d+"/, 'снимок должен заранее резервировать высоту');
    }
    assert.match(html, /<figure class="put-hero-art"><img\b[^>]*\bwidth="\d+"[^>]*\bheight="\d+"/, 'обложка должна заранее резервировать место');
  });
}

test('обе версии подключают общий сценарий навигации и свой стиль', () => {
  const documentary = readFileSync('put/index.html', 'utf8');
  const comic = readFileSync('put/comic/index.html', 'utf8');

  assert.match(documentary, /\/assets\/put\.css\?v=/);
  assert.match(comic, /\/assets\/put\.css\?v=/);
  assert.match(comic, /\/assets\/put-comic\.css\?v=/);
  assert.match(documentary, /\/assets\/put\.js\?v=/);
  assert.match(comic, /\/assets\/put\.js\?v=/);
});

test('страница остаётся доступной без движения и сохраняет историю глав', () => {
  const css = readFileSync('assets/put.css', 'utf8');
  const script = readFileSync('assets/put.js', 'utf8');

  assert.match(css, /prefers-reduced-motion/);
  assert.match(script, /history\.pushState/);
  assert.match(script, /popstate/);
  assert.match(script, /hashchange/);
});
