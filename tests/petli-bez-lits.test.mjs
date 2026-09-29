// Петля не попадает на бой, пока её не осмотрели на человеческие лица.
//
// Повод: 6 сентября 2026 в петле ФотоДата на живом сайте оказалось лицо
// постороннего человека — снимали окно приложения поверх папки с чужими
// фотографиями. Нашли случайно. Осмотр делает `sh tools/lica-v-petlyah.sh`
// (Vision, кадр раз в полсекунды) и пишет `data/petli-lica.json`; здесь —
// только сверка хешей, чтобы выкладка не ждала лишних секунд.
//
// Меряется наличие лица в кадре. Чужую комнату без лица, переписку или
// документ на экране это не ловит — на такое глаза, а не скрипт.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const корень = join(dirname(fileURLToPath(import.meta.url)), '..');
const хеш = (путь) =>
  createHash('sha256').update(readFileSync(путь)).digest('hex').slice(0, 16);

// Чистая проверка: список петель + реестр → список бед.
// Вынесена отдельно, чтобы её саму можно было завалить нарочно.
export const сверить = (петли, реестр) => {
  const по = new Map((реестр.petli ?? []).map((з) => [з.petlya, з]));
  const беды = [];
  for (const { имя, sha } of петли) {
    const з = по.get(имя);
    if (!з) {
      беды.push(`${имя}: нет в реестре — прогони sh tools/lica-v-petlyah.sh`);
    } else if (з.sha256 !== sha) {
      беды.push(`${имя}: петля изменилась после осмотра (${з.sha256} → ${sha})`);
    } else if (з.lic !== 0) {
      беды.push(`${имя}: в осмотре найдено лиц ${з.lic} — выкладывать нельзя`);
    } else if (!(з.kadrov > 0)) {
      беды.push(`${имя}: осмотрено ноль кадров — осмотр не состоялся`);
    }
  }
  return беды;
};

const петлиДерева = () =>
  readdirSync(join(корень, 'assets/clips'))
    .filter((и) => /\.(mp4|webm)$/i.test(и))
    .map((имя) => ({ имя, sha: хеш(join(корень, 'assets/clips', имя)) }));

test('все петли витрины осмотрены на лица, и лиц нет', () => {
  const петли = петлиДерева();
  assert.ok(петли.length >= 10, `петель нашлось ${петли.length} — искали не там`);
  const реестр = JSON.parse(readFileSync(join(корень, 'data/petli-lica.json'), 'utf8'));
  assert.deepEqual(сверить(петли, реестр), []);
});

test('проверка краснеет на подделанном реестре', () => {
  const петли = петлиДерева();
  const реестр = JSON.parse(readFileSync(join(корень, 'data/petli-lica.json'), 'utf8'));
  const копия = () => JSON.parse(JSON.stringify(реестр));

  const пропала = копия();
  пропала.petli.shift();
  assert.match(сверить(петли, пропала)[0] ?? '', /нет в реестре/);

  const подменена = копия();
  подменена.petli[0].sha256 = '0000000000000000';
  assert.match(сверить(петли, подменена)[0] ?? '', /изменилась после осмотра/);

  const слицом = копия();
  слицом.petli[0].lic = 1;
  assert.match(сверить(петли, слицом)[0] ?? '', /найдено лиц 1/);

  const пустой = копия();
  пустой.petli[0].kadrov = 0;
  assert.match(сверить(петли, пустой)[0] ?? '', /ноль кадров/);
});
