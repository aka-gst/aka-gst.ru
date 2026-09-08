import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

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

test('opening another collection closes the previous one while zero open remains allowed', () => {
  const group = (open = false) => {
    const listeners = new Map();
    const attrs = new Map();
    const summary = { setAttribute: (name, value) => attrs.set(name, value) };
    return {
      open,
      attrs,
      addEventListener: (name, listener) => listeners.set(name, listener),
      querySelector: (selector) => selector === '.reader-side-book' ? summary : null,
      toggle(value) {
        this.open = value;
        listeners.get('toggle')?.();
      },
    };
  };
  const groups = [group(true), group(false), group(false)];
  const context = {
    document: {
      documentElement: { dataset: {} },
      querySelector: () => null,
      querySelectorAll: (selector) => selector === '.reader-side-group' ? groups : [],
    },
    localStorage: { getItem: () => null, setItem: () => {} },
  };

  vm.runInNewContext(script, context);
  groups[1].toggle(true);
  assert.deepEqual(groups.map(({ open }) => open), [false, true, false]);
  assert.deepEqual(groups.map(({ attrs }) => attrs.get('aria-expanded')), ['false', 'true', 'false']);

  groups[1].toggle(false);
  assert.deepEqual(groups.map(({ open }) => open), [false, false, false]);
  assert.deepEqual(groups.map(({ attrs }) => attrs.get('aria-expanded')), ['false', 'false', 'false']);
});

test('story detail uses a compact toolbar and its content heading contains only the title', () => {
  assert.match(page, /<div class="reader-story-toolbar">[\s\S]*?<a class="site-home"[\s\S]*?<div class="reader-bar"/);
  assert.doesNotMatch(page, /<header class="reader-top">/);

  const storyHeader = page.match(/<header class="story-heading">([\s\S]*?)<\/header>/)?.[1] || '';
  assert.match(storyHeader, /^\s*<h1>Пуля в стакане<\/h1>\s*$/);
  assert.doesNotMatch(page, /class="story-book"/);
  assert.doesNotMatch(page, /class="story-meta"/);
  assert.match(page, /<title>Пуля в стакане — Сергей Гостов<\/title>/,
    'автор остаётся в SEO title');

  const detailControls = css.match(/\.reader-story-toolbar \.reader-bar button\s*\{([^}]+)\}/)?.[1] || '';
  assert.match(detailControls, /min-width:\s*44px/);
  assert.match(detailControls, /height:\s*44px/);
});

test('collection title and year do not join in the accessible summary text', () => {
  const summary = page.match(/<summary class="reader-side-book"[^>]*>([\s\S]*?)<\/summary>/)?.[1] || '';
  const textContent = summary.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  assert.match(textContent, /счастье 2020/);
});
