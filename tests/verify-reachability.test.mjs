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
  // Здесь стояла одна зашитая строка «66 проверок прошли». Слова на странице
  // поменяли на «66 автотестов», verify.sh поправили, а тест остался стеречь
  // прежнее написание и краснел на исправном сайте. Зашитая цитата и есть та
  // самая мёртвая метка, от которой этот тест должен был защищать.
  //
  // Теперь проверяется само свойство: каждая примета, которую verify.sh ищет
  // на главной, обязана в ней быть. Поменяли слова — тест скажет об этом, а
  // не о том, что кто-то забыл его переписать.
  const строка = verify.match(/for needle in ([\s\S]*?); do/);
  assert.ok(строка, 'в verify.sh не найден список примет главной');
  const приметы = [...строка[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.ok(приметы.length >= 4, `примет всего ${приметы.length} — проверять нечего`);
  const главная = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const пропали = приметы.filter((n) => !главная.includes(n));
  assert.deepEqual(пропали, [], `verify.sh ищет на главной то, чего там нет: ${пропали.join(', ')}`);
  assert.doesNotMatch(verify, /data-metric="tests"/);
});
