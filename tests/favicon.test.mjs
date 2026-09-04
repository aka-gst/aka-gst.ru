import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const sha256 = (relative) => createHash('sha256')
  .update(readFileSync(join(root, relative)))
  .digest('hex');

test('на сайте лежит принятая версия нового знака во всех рабочих размерах', () => {
  assert.equal(sha256('assets/znak-polnyy.png'), 'fec8ab8293412d04ca0c6efa672d7aec9b9f504caf23659ae137892a5f59ce74');
  assert.equal(sha256('assets/znak.png'), '6ab9624f0cec88dbed966e30dcfcbe500714026d26b8103d0b31f9e1406b6dde');
  assert.equal(sha256('assets/favicon-64.png'), '7ac7cb25cc82e866f4646fc15ab89f82f0fe3743a116f2870758d9a607bf2487');
  assert.equal(sha256('assets/favicon-32.png'), '9643b0c306c11655cb02de1dd08af2b3549cbded91deb936435b765f248e465d');
});

const indexPagesBelow = (relative) => {
  const pages = [];
  const visit = (dir) => {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) visit(path);
      if (entry.isFile() && entry.name === 'index.html') pages.push(path);
    }
  };
  visit(relative);
  return pages;
};

test('сборка ставит новый растровый знак на каждую страницу сайта', () => {
  execFileSync(process.execPath, ['build.mjs'], { cwd: root, stdio: 'pipe' });

  const pages = [
    'index.html',
    'praktikum/index.html',
    'en/index.html',
    '404.html',
    '503.html',
    ...indexPagesBelow('rasskazy'),
  ];

  for (const page of pages) {
    const html = readFileSync(join(root, page), 'utf8');
    assert.doesNotMatch(html, /href="\/favicon\.svg"/, `${page}: остался старый SVG`);
    assert.match(
      html,
      /href="\/assets\/favicon-32\.png\?v=[0-9a-f]{8}"[^>]*sizes="32x32"/,
      `${page}: нет нового favicon 32x32 с версией по содержимому`,
    );
    assert.match(
      html,
      /href="\/assets\/favicon-64\.png\?v=[0-9a-f]{8}"[^>]*sizes="64x64"/,
      `${page}: нет нового favicon 64x64 с версией по содержимому`,
    );
  }
});
