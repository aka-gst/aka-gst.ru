#!/usr/bin/env node
// Короткий интерфейсный текст на витрине заканчивается без точки: она делает
// карточки тяжелее и визуально превращает подписи в формальные абзацы.
// Авторские рассказы сюда намеренно не входят.
import { readFileSync } from 'node:fs';

const files = ['data/site.json', 'data/projects.json'];
const technicalKeys = new Set(['url', 'source', 'file', 'full', 'target', 'slug', 'event', 'version', 'run_url']);

const findTerminalDots = (value, path = []) => {
  if (Array.isArray(value)) return value.flatMap((item, index) => findTerminalDots(item, [...path, index]));
  if (!value || typeof value !== 'object') return [];

  return Object.entries(value).flatMap(([key, item]) => {
    const next = [...path, key];
    if (technicalKeys.has(key)) return [];
    if (typeof item === 'string') return item.endsWith('.') ? [next.join('.')] : [];
    return findTerminalDots(item, next);
  });
};

// Отрицательный контроль: проверка обязана ловить точку, иначе это украшение.
if (!findTerminalDots({ copy: 'Строка.' }).includes('copy')) throw new Error('negative control failed');
if (findTerminalDots({ url: 'https://example.test/.' }).length) throw new Error('technical exception failed');

const problems = files.flatMap((file) =>
  findTerminalDots(JSON.parse(readFileSync(file, 'utf8'))).map((path) => `${file}:${path}`),
);

if (problems.length) {
  console.error(`Точка в конце UI-копирайта (${problems.length}):\n${problems.join('\n')}`);
  process.exit(1);
}

console.log(`UI copy: ${files.length} sources, terminal dots 0`);
