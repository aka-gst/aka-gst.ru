import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const verify = readFileSync(resolve(root, 'verify.sh'), 'utf8');
const testRoutes = JSON.parse(readFileSync(resolve(root, 'data/test-routes.json'), 'utf8'));

const testOnlyPaths = new Set(['/leela/', '/zoo/', '/puzzle-quest/']);
const routePaths = new Set(
  testRoutes.groups.flatMap((group) => group.items.map((item) => item.url)),
);

test('test-only сборки достижимы через /test/, а не исключаются из проверки сирот', () => {
  for (const path of testOnlyPaths) {
    assert.ok(routePaths.has(path), `${path} исчез из test-routes.json`);
  }

  assert.match(verify, /"\$BASE\/test\/"/, 'verify.sh не читает /test/');
  assert.match(verify, /"\$BASE\/"/, 'verify.sh не читает главную');
  assert.doesNotMatch(
    verify,
    /case\s+"\$d"\s+in[\s\S]*?(leela|zoo|puzzle-quest)/i,
    'пути test-only нельзя пропускать белым списком',
  );
});

test('проверка главной смотрит на видимый текущий факт, а не на мёртвую метку старого экрана', () => {
  assert.match(verify, /66 проверок прошли/);
  assert.doesNotMatch(verify, /data-metric="tests"/);
});
