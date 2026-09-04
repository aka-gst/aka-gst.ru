import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

test('stories heading dissolves only while the reader scrolls', () => {
  const build = readFileSync(resolve(root, 'build.mjs'), 'utf8');
  const css = readFileSync(resolve(root, 'assets/read.css'), 'utf8');
  const scriptPath = resolve(root, 'assets/afterimage-scroll.js');

  assert.match(build, /class="afterimage-title" data-afterimage="Рассказы"/);
  assert.match(build, /afterimage-scroll\.js\?v=/);
  assert.match(css, /@keyframes reader-afterimage-grain/);
  assert.match(css, /\.afterimage-title\s*\{[\s\S]*animation-play-state:\s*paused/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.afterimage-title/);
  assert.ok(existsSync(scriptPath), 'scroll controller is missing');
  const script = readFileSync(scriptPath, 'utf8');
  assert.match(script, /prefers-reduced-motion: reduce/);
  assert.match(script, /--afterimage-delay/);
});
