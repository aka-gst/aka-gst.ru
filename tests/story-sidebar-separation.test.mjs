#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../assets/read.css', import.meta.url), 'utf8');
const build = readFileSync(new URL('../build.mjs', import.meta.url), 'utf8');

const checks = [
  ['каждый сборник остаётся отдельной секцией', () => {
    assert.match(build, /<details class="reader-side-group/);
    assert.match(build, /reader-side-book/);
  }],
  ['между сборниками есть заметный вертикальный разрыв', () => {
    assert.match(css, /\.reader-side\s*\{[^}]*gap:\s*(?:1[8-9]|[2-9]\d)px/s);
  }],
  ['секция отделена собственной цветной границей', () => {
    assert.match(css, /\.reader-side-group\s*\{[^}]*border-left:\s*4px solid var\(--group-accent\)/s);
  }],
  ['название сборника сильнее названий рассказов', () => {
    assert.match(css, /\.reader-side-book\s*\{[^}]*font-weight:\s*700/s);
  }],
];

let failed = 0;
for (const [name, check] of checks) {
  try { check(); console.log(`ok   ${name}`); }
  catch { failed += 1; console.error(`FAIL ${name}`); }
}
process.exitCode = failed ? 1 : 0;
