import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const verify = readFileSync(resolve(root, 'verify.sh'), 'utf8');
const testOnlyPaths = new Set(['/leela/', '/zoo/', '/puzzle-quest/']);

test('публичного тестового пульта нет, экспериментальные сборки названы явно', () => {
  assert.equal(existsSync(resolve(root, 'test/index.html')), false, 'публичная /test/ снова собирается');
  assert.doesNotMatch(verify, /"\$BASE\/test\/"/, 'verify.sh снова читает удалённую /test/');
  for (const path of testOnlyPaths) {
    assert.match(verify, new RegExp(path.slice(1, -1)), `${path} потеряна из явного списка исключений`);
  }
  assert.match(verify, /"\$BASE\/"/, 'verify.sh не читает главную');
});

test('проверка главной смотрит на видимый текущий факт, а не на мёртвую метку старого экрана', () => {
  assert.match(verify, /66 проверок прошли/);
  assert.doesNotMatch(verify, /data-metric="tests"/);
});
