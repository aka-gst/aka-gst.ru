import { test } from 'node:test';
import assert from 'node:assert/strict';
import { storyMarkup, storyIllustration } from './reader-content.mjs';

test('reader preserves every paragraph and scene break, escaping author text', () => {
  assert.equal(storyMarkup(' Первый абзац.\n\n***\n<Не разметка> & «реплика»\n'), '<p>Первый абзац.</p>\n<hr class="story-break">\n<p>&lt;Не разметка&gt; &amp; «реплика»</p>');
  assert.equal(storyMarkup(' * * * \n'), '<hr class="story-break">');
  assert.equal(storyMarkup(''), '');
});
test('individual illustration takes priority; collection is an explicit fallback', () => {
  assert.deepEqual(storyIllustration({ cover:'own.jpg', title:'История' }, {cover:'book.jpg',title:'Сборник'}), {file:'own.jpg', alt:'Обложка рассказа «История»', own:true});
  assert.deepEqual(storyIllustration({ title:'История' }, {cover:'book.jpg',title:'Сборник'}), {file:'book.jpg', alt:'Обложка сборника «Сборник»', own:false});
  assert.equal(storyIllustration({},{}), null);
});
