// Лента цеха приходит извне. Пока блок временно снят с витрины, источник
// сохраняем и продолжаем проверять на личное, но в публичную главную не
// вставляем вовсе.
//
// Повод: 6 сентября Руки нашли у себя утечку — сторона ПК шла мимо белого
// списка и несла настоящие тексты задач, а в странице сидел адрес стенда.
// Они починили и написали машинную проверку; здесь она поставлена воротами
// на нашей стороне, потому что публикует ленту сайт, а не они.
//
// Две калитки, и обе нужны:
//   1. лента на входе чиста по девяти группам образцов;
//   2. сборка не вернула временно скрытый блок в index.html.
//
// Гонять проверку по всей странице нельзя: на index.html она краснеет на
// законном — «Орион» в описании работы, имя владельца на его же портфолио,
// «клетки» из игрового текста, координаты SVG-иконки как «адреса машин».
// Проверка, которая краснеет всегда, живёт до первого раза, когда её сочтут
// помехой.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, mkdtempSync, copyFileSync, appendFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const корень = join(dirname(fileURLToPath(import.meta.url)), '..');
const лентаПапка = join(корень, 'data/tseh');
const лентаHtml = join(лентаПапка, 'zhivoy-tseh.html');
const проверка = '/Users/gst/dev/live-ai-workshop/proverka_obezlichivaniya.py';

const прогнать = (путь) => {
  try {
    execFileSync('python3', [проверка, путь], { encoding: 'utf8' });
    return { код: 0 };
  } catch (e) {
    return { код: e.status ?? -1, вывод: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
};

test('лента цеха обезличена', { skip: !existsSync(лентаHtml) && 'ленты в дереве нет' }, () => {
  assert.ok(
    existsSync(проверка),
    `лента есть, а проверки обезличивания нет: ${проверка}\n` +
      'Без неё ленту публиковать нельзя — она приходит извне. Спросить Руки, куда переехала.',
  );
  const { код, вывод } = прогнать(лентаПапка);
  assert.equal(код, 0, `проверка обезличивания красная:\n${вывод ?? ''}`);
});

test('проверка краснеет на подсаженном личном', { skip: !existsSync(проверка) && 'проверки нет' }, () => {
  const вр = mkdtempSync(join(tmpdir(), 'tseh-'));
  for (const и of readdirSync(лентаПапка)) copyFileSync(join(лентаПапка, и), join(вр, и));
  appendFileSync(join(вр, 'zhivoy-tseh.html'), '<div>/Users/gst/dev/aka-gst.ru</div>');
  const { код } = прогнать(вр);
  assert.notEqual(код, 0, 'подсаженный домашний путь не покраснел — проверке верить нельзя');
});

test('сборка не вернула временно скрытый цех на витрину', { skip: !existsSync(лентаHtml) && 'ленты в дереве нет' }, () => {
  const лента = readFileSync(лентаHtml, 'utf8').trim();
  const страница = readFileSync(join(корень, 'index.html'), 'utf8');
  assert.ok(лента.length > 500, `лента подозрительно короткая: ${лента.length} символов`);
  const скрыт = (html) => !html.includes(лента) && !html.includes('data-tseh-panel');
  assert.ok(скрыт(страница), 'Живой цех снова попал в публичный index.html');
  assert.equal(скрыт(`${страница}\n${лента}`), false, 'подсаженная лента не покраснила проверку скрытия');
});
