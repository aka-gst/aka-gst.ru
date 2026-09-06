import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { trustedQaRunUrl as buildTrustedQaRunUrl } from '../lib/qa-run-url.mjs';

const root = new URL('../', import.meta.url);
const text = (path) => readFileSync(new URL(path, root), 'utf8');

const runUrlPolicy = () => {
  const app = text('assets/app.js');
  const start = app.indexOf('// BEGIN_QA_RUN_URL_POLICY');
  const end = app.indexOf('// END_QA_RUN_URL_POLICY');
  assert.ok(start >= 0 && end > start, 'политика QA run URL должна быть явно выделена');
  const source = app.slice(start, end).replace(/^.*BEGIN_QA_RUN_URL_POLICY.*$/m, '');
  return Function(`"use strict"; ${source}; return { trustedQaRunUrl, applyTrustedQaRunUrl };`)();
};

const validRunUrls = [
  [
    'https://github.com/aka-gst/local-agent-gateway/actions/runs/33139799019',
    'https://github.com/aka-gst/local-agent-gateway/actions/runs/33139799019',
  ],
  [
    'https://github.com/aka-gst/local-agent-gateway/actions/runs/33139799019?check=1#log',
    'https://github.com/aka-gst/local-agent-gateway/actions/runs/33139799019',
  ],
];

const unsafeRunUrls = [
    'javascript:alert(1)',
    'http://github.com/aka-gst/local-agent-gateway/actions/runs/1',
    'https://evil.example/aka-gst/local-agent-gateway/actions/runs/1',
    'https://github.com.evil.example/aka-gst/local-agent-gateway/actions/runs/1',
    'https://github.com/other/local-agent-gateway/actions/runs/1',
    'https://github.com/aka-gst/other/actions/runs/1',
    'https://github.com/aka-gst/local-agent-gateway/issues/1',
    'https://github.com/aka-gst/local-agent-gateway/actions/runs/0',
    '/aka-gst/local-agent-gateway/actions/runs/1',
];

test('сборщик и браузер разрешают только Actions run нашего репозитория', () => {
  const { trustedQaRunUrl: browserTrustedQaRunUrl, applyTrustedQaRunUrl } = runUrlPolicy();
  for (const policy of [buildTrustedQaRunUrl, browserTrustedQaRunUrl]) {
    for (const [input, expected] of validRunUrls) assert.equal(policy(input), expected);
    for (const unsafe of unsafeRunUrls) {
      assert.equal(policy(unsafe), null, `должна быть отвергнута: ${unsafe}`);
    }
  }

  const build = text('build.mjs');
  assert.match(build, /const qaRunUrl = trustedQaRunUrl\(qa\.commit\.run_url\)/);
  assert.doesNotMatch(build, /href="\$\{esc\(qa\.commit\.run_url\)\}"/);

  const app = text('assets/app.js');
  assert.doesNotMatch(app, /\.href\s*=\s*report\.commit\.run_url/);
  assert.match(app, /applyTrustedQaRunUrl\(run, report\.commit\?\.run_url\)/);

  const anchor = (href) => ({
    href,
    getAttribute(name) { return name === 'href' ? this.href : null; },
    removeAttribute(name) { if (name === 'href') this.href = null; },
  });
  const safe = validRunUrls[0][0];
  const evil = unsafeRunUrls[2];

  const badInitial = anchor(evil);
  applyTrustedQaRunUrl(badInitial, evil);
  assert.equal(badInitial.href, null, 'плохая исходная и живая ссылки должны оставить элемент без href');

  const safeFallback = anchor(safe);
  applyTrustedQaRunUrl(safeFallback, evil);
  assert.equal(safeFallback.href, safe, 'плохой live feed не должен затереть проверенный снимок');

  const safeLive = anchor(evil);
  applyTrustedQaRunUrl(safeLive, safe);
  assert.equal(safeLive.href, safe, 'проверенный live run должен заменить плохой снимок');
});

const assertCommonDeployOnly = (sync) => {
  assert.match(sync, /exec sh "\$HERE\/deploy\.sh" --go/);
  assert.doesNotMatch(sync, /rsync[^\n]*"\$HERE\/data\//);
};

test('sync-portfolio не публикует data и использует общий белый список', () => {
  const sync = text('sync-portfolio.sh');
  assertCommonDeployOnly(sync);

  // Красный контроль: прежняя рекурсивная дорога с sentinel обязана падать.
  const broken = sync.replace(
    'exec sh "$HERE/deploy.sh" --go',
    'rsync -az "$HERE/data/" "$SSH_HOST:$SITE_ROOT/data/" # sentinel-private.json'
  );
  assert.throws(() => assertCommonDeployOnly(broken));

  const deploy = text('deploy.sh');
  const payload = deploy.match(/PAYLOAD="([\s\S]*?)"/)[1].trim().split('\n');
  assert.ok(!payload.includes('data'), 'общий публичный PAYLOAD не должен содержать data');

  const sandbox = mkdtempSync(join(tmpdir(), 'aka-deploy-'));
  const source = join(sandbox, 'source');
  const target = join(sandbox, 'target');
  mkdirSync(source);
  mkdirSync(target);
  try {
    // Воспроизводим форму PAYLOAD, но без копирования настоящего сайта.
    for (const item of payload) {
      const original = new URL(item, root);
      const candidate = join(source, item);
      if (existsSync(original) && statSync(original).isDirectory()) mkdirSync(candidate, { recursive: true });
      else {
        mkdirSync(join(candidate, '..'), { recursive: true });
        writeFileSync(candidate, `${item}\n`);
      }
    }
    mkdirSync(join(source, 'data'), { recursive: true });
    writeFileSync(join(source, 'data', 'sentinel-private.json'), '{"private":true}\n');

    const dryRun = (items) => spawnSync(
      'rsync', ['-anR', '--out-format=%n', ...items, `${target}/`],
      { cwd: source, encoding: 'utf8' }
    );
    const safe = dryRun(payload);
    assert.equal(safe.status, 0, safe.stderr);
    assert.doesNotMatch(safe.stdout, /sentinel-private\.json/);
    assert.match(safe.stdout, /index\.html/);

    // Красный контроль измерителя: добавленный data обязан показать sentinel.
    const brokenDryRun = dryRun([...payload, 'data']);
    assert.equal(brokenDryRun.status, 0, brokenDryRun.stderr);
    assert.match(brokenDryRun.stdout, /data\/sentinel-private\.json/);
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});
