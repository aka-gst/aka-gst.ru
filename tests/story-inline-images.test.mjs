import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const book = JSON.parse(read('data/stories.json'));
const homepage = read(process.env.STORY_INLINE_INDEX || 'index.html');

const attr = (tag, name) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] ?? null;

const inlineSource = (collectionId, slug) => {
  const marker = `<article data-story-source="${collectionId}--${slug}"`;
  const start = homepage.indexOf(marker);
  assert.notEqual(start, -1, `нет inline-source ${collectionId}--${slug}`);
  const end = homepage.indexOf('</article>', start);
  assert.notEqual(end, -1, `не закрыт inline-source ${collectionId}--${slug}`);
  return homepage.slice(start, end + '</article>'.length);
};

const stories = book.сборники.flatMap((collection) =>
  collection.stories.map((story) => ({ collection, story }))
);

test('inline reader reuses the effective image and accessible alt from every standalone story page', () => {
  assert.equal(stories.length, 23, 'проверка должна охватывать все рассказы');

  for (const { collection, story } of stories) {
    const inline = inlineSource(collection.id, story.slug);
    const standalone = read(`rasskazy/${story.slug}/index.html`);
    const inlineImage = inline.match(/<img\b[^>]*>/)?.[0];
    const standaloneImage = standalone.match(/<figure class="story-cover(?: story-cover--book)?"[^>]*>\s*(<img\b[^>]*>)/)?.[1];

    assert.ok(standaloneImage, `${story.slug}: на отдельной странице нет effective image`);
    assert.ok(inlineImage, `${story.slug}: в раскрытии общей страницы нет effective image`);
    assert.equal(attr(inlineImage, 'src'), attr(standaloneImage, 'src'), `${story.slug}: показана другая картинка`);
    assert.equal(attr(inlineImage, 'alt'), attr(standaloneImage, 'alt'), `${story.slug}: alt расходится с отдельной страницей`);
    assert.equal(attr(inlineImage, 'loading'), 'lazy', `${story.slug}: скрытая картинка не должна грузиться заранее`);
  }
});
