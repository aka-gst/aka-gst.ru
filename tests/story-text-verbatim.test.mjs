// Текст рассказа на сайте — побуквенно его файл из stories/ (свод, правило 35а:
// авторский текст не редактируется молча ни на одно слово). Сторож заведён
// 02.10.2026 вместе с переездом читалки на новую главную: вёрстку меняли
// целиком, а текст обязан был остаться байт в байт.
//
// Сверяется не «есть ли абзацы», а сама последовательность: абзац за абзацем,
// разделитель сцены за разделителем, после снятия экранирования HTML.
// Отрицательный контроль: STORY_TEXT_NEGATIVE=1 подменяет одну кириллическую
// «о» на латинскую в одном рассказе — тест обязан покраснеть.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const book = JSON.parse(read('data/stories.json'));
const stories = book.сборники.flatMap((c) => c.stories.map((st) => ({ id: `${c.id}--${st.slug}`, slug: st.slug })));

const РАЗРЫВ = '***';
// Так же, как build.mjs: строка — абзац, пустые выброшены, «***» — разрыв сцены.
const изФайла = (id) => read(`stories/${id}.txt`).split('\n').map((p) => p.trim()).filter(Boolean)
  .map((p) => (/^\*\*\*$|^\*\s*\*\s*\*$/.test(p) ? РАЗРЫВ : p));
const снятьЭкранирование = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const изРазметки = (html) => [...html.matchAll(/<p>([\s\S]*?)<\/p>|<hr class="story-break">/g)]
  .map((m) => (m[1] === undefined ? РАЗРЫВ : снятьЭкранирование(m[1])));
const блокРассказа = (html, slug) => {
  const начало = html.indexOf('<article class="story"');
  const конец = html.indexOf('</article>', начало);
  assert.ok(начало >= 0 && конец > начало, `${slug}: нет блока рассказа`);
  assert.equal(html.indexOf('<article class="story"', начало + 1), -1, `${slug}: блок рассказа не один`);
  return html.slice(начало, конец);
};
const сверить = (было, стало, где) => {
  const i = было.findIndex((p, n) => p !== стало[n]);
  assert.ok(i === -1 && было.length === стало.length,
    `${где}: расхождение с файлом в абзаце ${i === -1 ? было.length : i + 1}: «${(было[i] ?? '').slice(0, 60)}» ≠ «${(стало[i] ?? '').slice(0, 60)}»`);
};

test('текст каждого рассказа на странице и в подгружаемом куске — побуквенно его файл', () => {
  assert.equal(stories.length, 23, 'сверка должна охватывать все рассказы');
  for (const { id, slug } of stories) {
    let page = read(`rasskazy/${slug}/index.html`);
    if (process.env.STORY_TEXT_NEGATIVE && slug === 'blizorukiy-toropyga') page = page.replace(/(<p>[^<]*?)о/, '$1o');
    const ожидаем = изФайла(id);
    assert.ok(ожидаем.length >= 2, `${id}: в файле нет текста`);
    сверить(ожидаем, изРазметки(блокРассказа(page, slug)), `rasskazy/${slug}/index.html`);
    сверить(ожидаем, изРазметки(read(`rasskazy/${slug}/tekst.html`)), `rasskazy/${slug}/tekst.html`);
  }
});

test('канон «Близорукого торопыги»: ангел Мефодий (правило 35б, «обратно не чинить»)', () => {
  const page = read('rasskazy/blizorukiy-toropyga/index.html');
  assert.equal((page.match(/Мефодий/g) || []).length, (read('stories/solyanochka--blizorukiy-toropyga.txt').match(/Мефодий/g) || []).length);
  assert.ok((page.match(/Мефодий/g) || []).length > 0, 'имени ангела нет на странице');
  assert.doesNotMatch(page, /Мефедрон/);
});
