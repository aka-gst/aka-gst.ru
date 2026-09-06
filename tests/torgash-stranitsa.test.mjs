// Страница «Тест на 1000 ₽» показывает настоящие сделки Сергея. Её собирает
// и обновляет Торгаш в своём репозитории, а выкладывает сайт — значит здесь
// нужен сторож на то, ЧТО именно уедет наружу, а не доверие к обещанию.
//
// Повод: страница живёт рядом с внутренними файлами теста (sdelki.jsonl,
// nastroyki-testa.json). Сегодня копируется только index.html, но копирование
// делает человек, а человек однажды скопирует папку целиком.
//
// Проверяется ровно то, что обещано в письме и подтверждено чтением файла:
// в папке нет ничего, кроме страницы; на странице есть noindex и счётчик;
// нет внешних адресов, полей ввода и похожего на ключи.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const корень = join(dirname(fileURLToPath(import.meta.url)), '..');
const папка = join(корень, 'torgash');
const естьПапка = existsSync(папка);

// Чистая проверка — чтобы её можно было завалить нарочно.
export const беды = (файлы, html) => {
  const б = [];
  const лишние = файлы.filter((и) => и !== 'index.html');
  if (лишние.length) б.push(`в папке лишнее: ${лишние.join(', ')}`);
  if (!/<meta\s+name="robots"\s+content="noindex"/i.test(html)) б.push('нет noindex');
  if (!/data-website-id="[0-9a-f-]{36}"/i.test(html)) б.push('нет счётчика событий');
  const внешние = [...html.matchAll(/https?:\/\/[^"'\s>]+/gi)].map((m) => m[0]);
  if (внешние.length) б.push(`внешние адреса: ${внешние.slice(0, 3).join(', ')}`);
  if (/<(input|textarea|form|select)\b/i.test(html)) б.push('поле ввода или форма');
  if (/\b(api[_-]?key|secret|token|apikey)\b\s*[:=]/i.test(html)) б.push('похоже на ключ');
  return б;
};

test('страница теста не тащит наружу лишнего', { skip: !естьПапка && 'папки torgash нет' }, () => {
  const файлы = readdirSync(папка);
  const html = readFileSync(join(папка, 'index.html'), 'utf8');
  assert.ok(html.length > 1000, `страница подозрительно короткая: ${html.length}`);
  assert.deepEqual(беды(файлы, html), []);
});

test('сторож краснеет на каждой из бед', () => {
  const хорошая = readFileSync(join(папка, 'index.html'), 'utf8');
  assert.match(беды(['index.html', 'sdelki.jsonl'], хорошая)[0] ?? '', /в папке лишнее/);
  assert.match(беды(['index.html'], хорошая.replace(/content="noindex"/, 'content="all"'))[0] ?? '', /нет noindex/);
  assert.match(беды(['index.html'], хорошая.replace(/data-website-id="[^"]*"/, ''))[0] ?? '', /нет счётчика/);
  assert.match(беды(['index.html'], хорошая + '<img src="https://example.com/x.png">')[0] ?? '', /внешние адреса/);
  assert.match(беды(['index.html'], хорошая + '<input name="x">')[0] ?? '', /поле ввода/);
  assert.match(беды(['index.html'], хорошая + 'api_key: abc')[0] ?? '', /похоже на ключ/);
});
