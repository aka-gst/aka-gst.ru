import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { запуститьChrome, подключиться, sleep } from '../tools/igrat.mjs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const page = read('rasskazy/pulya-v-stakane/index.html');
const siteCss = read('assets/site.css');
const css = process.env.STORY_VISUAL_NEGATIVE === 'transparent-summary'
  ? read('assets/read.css').replace('background: var(--group-summary);', 'background: transparent;')
  : read('assets/read.css');
const sidebar = page.match(/<nav class="reader-side"[\s\S]*?<\/nav>/)?.[0];

assert.ok(sidebar, 'в собранной странице нет бокового оглавления');

const documentUrl = `data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>${siteCss}\n${css}</style>${sidebar}`)}`;

test('сборники читаются как три отдельные секции на desktop и mobile', { timeout: 20_000 }, async () => {
  const port = 9495;
  const chrome = запуститьChrome(port, '1440,900');

  try {
    const send = await подключиться(port);
    await send('Page.enable');

    for (const [width, height, mobile] of [[1440, 900, false], [390, 844, true]]) {
      await send('Emulation.setDeviceMetricsOverride', {
        width, height, mobile, deviceScaleFactor: 1,
      });
      await send('Page.navigate', { url: documentUrl });
      await sleep(300);

      const result = await send('Runtime.evaluate', {
        returnByValue: true,
        expression: `(() => {
          const groups = [...document.querySelectorAll('.reader-side-group')];
          return {
            xOverflow: document.documentElement.scrollWidth - innerWidth,
            groups: groups.map((group, index) => {
              const summary = group.querySelector('.reader-side-book');
              const groupStyle = getComputedStyle(group);
              const summaryStyle = getComputedStyle(summary);
              const chevronStyle = getComputedStyle(summary, '::after');
              const marker = group.querySelector('.reader-side-current');
              const previous = groups[index - 1];
              return {
                title: summary.querySelector('span')?.textContent,
                open: group.open,
                height: summary.getBoundingClientRect().height,
                gap: previous ? group.getBoundingClientRect().top - previous.getBoundingClientRect().bottom : null,
                borderTop: groupStyle.borderTopColor,
                borderLeft: groupStyle.borderLeftColor,
                summaryBackground: summaryStyle.backgroundColor,
                chevron: chevronStyle.content,
                chevronTransform: chevronStyle.transform,
                marker: marker?.textContent.trim() || '',
                markerVisible: marker ? getComputedStyle(marker).display !== 'none' : false,
              };
            }),
          };
        })()`,
      });
      const measured = result.result.value;

      assert.equal(measured.xOverflow, 0, `${width}px: не должно быть горизонтального overflow`);
      assert.deepEqual(measured.groups.map((group) => group.title), [
        'А потом наступит счастье', 'Три изнутри', 'Соляночка',
      ]);
      assert.equal(measured.groups.filter((group) => group.markerVisible).length, 1,
        `${width}px: только активный сборник помечен`);
      assert.equal(measured.groups[0].marker, 'текущий сборник');

      for (const group of measured.groups) {
        assert.equal(group.borderTop, group.borderLeft,
          `${width}px: рамка всей секции должна иметь цвет её сборника`);
        assert.notEqual(group.summaryBackground, 'rgba(0, 0, 0, 0)',
          `${width}px: summary должен читаться отдельной цветной плашкой`);
        assert.match(group.chevron, /›/,
          `${width}px: нужен chevron, а не малозаметный плюс/минус`);
        assert.ok(group.height >= 44 && group.height <= 46,
          `${width}px: цветная плашка не должна расти по высоте`);
        if (group.gap !== null) assert.ok(group.gap >= 18, `${width}px: секции не слипаются`);
      }

      assert.notEqual(measured.groups[0].chevronTransform, measured.groups[1].chevronTransform,
        `${width}px: chevron должен показывать раскрытое состояние`);
    }

    send.закрыть();
  } finally {
    chrome.kill();
  }
});
