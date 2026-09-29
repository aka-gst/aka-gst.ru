import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const page = read('rasskazy/pulya-v-stakane/index.html');
const css = read('assets/read.css');
const script = read('assets/read.js');

test('saved reading progress does not create a visible resume control', () => {
  assert.doesNotMatch(script, /Вернуться на\s*\$\{/);
  assert.doesNotMatch(css, /\.reader-resume\b/);
});

test('story page exposes three collapsible collections and opens only the current one', () => {
  const groups = [...page.matchAll(/<details class="reader-side-group(?: is-current)?"(?: open)?[\s\S]*?<\/details>/g)]
    .map((match) => match[0]);

  assert.equal(groups.length, 3, 'должны быть три самостоятельных сворачиваемых сборника');
  assert.equal(groups.filter((group) => /<details[^>]* open/.test(group)).length, 1,
    'по умолчанию раскрыт только активный сборник');

  const current = groups.find((group) => /class="reader-side-group is-current"/.test(group));
  assert.ok(current, 'активный сборник не помечен');
  assert.match(current, /<details[^>]* open/);
  assert.match(current, /<summary[^>]*aria-expanded="true"[^>]*aria-controls="[^"]+"/);
  assert.match(current, /<a href="\/rasskazy\/pulya-v-stakane\/" aria-current="page">/,
    'текущий рассказ должен быть виден внутри раскрытого сборника');

  for (const group of groups.filter((item) => item !== current)) {
    assert.doesNotMatch(group, /<details[^>]* open/);
    assert.match(group, /<summary[^>]*aria-expanded="false"[^>]*aria-controls="[^"]+"/);
  }
});

test('collection headings are full-size controls and the page owns vertical scrolling', () => {
  assert.match(css, /\.reader-side-book\s*\{[^}]*min-height:\s*44px/s);
  const sidebar = css.match(/\.reader-side\s*\{([^}]+)\}/)?.[1] || '';
  assert.doesNotMatch(sidebar, /overflow(?:-y)?:\s*(?:auto|scroll)/);
  assert.doesNotMatch(sidebar, /max-height:\s*calc\(100vh/);
});
