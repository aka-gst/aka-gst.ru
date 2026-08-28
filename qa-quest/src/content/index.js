/*
 * Каталог курса.
 *
 * Ступень собирается из двух слоёв. Тренажёр — уроки, которые пишутся здесь и
 * выполняются прямо в браузере. Практикум — готовые эксперименты, которые
 * подтягиваются из course.json и выполняются на своей машине. Тренажёр идёт
 * первым: сначала человек пробует без установки чего-либо, потом садится за
 * настоящую работу.
 */

import { pythonLessons } from './python.js';
import { testingLessons } from './testing.js';
import { llmLessons } from './llm.js';
import { loadAllPracticums } from './practicum.js';

export const TIERS = [
  {
    id: 'python',
    number: 1,
    title: 'Питон с нуля',
    tagline: 'Ничего знать заранее не нужно',
    about: 'Пятнадцать уроков от первой команды до законченной программы. Код запускается прямо здесь, устанавливать ничего не надо.',
    accent: 'cyan',
  },
  {
    id: 'testing',
    number: 2,
    title: 'Тестирование',
    tagline: 'Проверять чужой код и доказывать результат',
    about: 'Сначала тренажёр в браузере: assert, границы, контракт API, негативные сценарии. Потом настоящий практикум на своей машине — шестнадцать экспериментов со шлюзом.',
    accent: 'mint',
  },
  {
    id: 'llm',
    number: 3,
    title: 'Работа и тесты с LLM',
    tagline: 'То, за что платят сейчас',
    about: 'Тренажёр: структурированный вывод, агент с инструментами, оценка ответа, prompt-инъекции. Дальше десять лабораторных на своей машине — от Ollama до готового сервиса.',
    accent: 'violet',
  },
];

const drills = [...pythonLessons, ...testingLessons, ...llmLessons].map((lesson) => ({ ...lesson, kind: 'drill' }));
const labs = [];

/** Порядок внутри ступени: сперва тренажёр, затем практикум. */
export const lessons = [];
let byId = new Map();

function reorder() {
  const ordered = TIERS.flatMap((tier) => [
    ...drills.filter((lesson) => lesson.tier === tier.id),
    ...labs.filter((lesson) => lesson.tier === tier.id),
  ]);
  lessons.length = 0;
  lessons.push(...ordered);
  byId = new Map(lessons.map((lesson) => [lesson.id, lesson]));
}

reorder();

/**
 * Подтягивает практикумы. Если course.json недоступен — например, сайт открыт
 * локально без соседней папки praktikum, — ступени остаются с одним тренажёром
 * и ничего не ломается.
 */
export async function loadPracticums() {
  const imported = await loadAllPracticums();
  if (!imported.length) return { imported: 0 };
  labs.length = 0;
  labs.push(...imported);
  reorder();
  return { imported: imported.length };
}

export function lessonById(id) {
  return byId.get(id) || null;
}

export function tierById(id) {
  return TIERS.find((tier) => tier.id === id) || null;
}

export function lessonsOfTier(tierId) {
  return lessons.filter((lesson) => lesson.tier === tierId);
}

export function findTask(lessonId, taskId) {
  const lesson = lessonById(lessonId);
  if (!lesson) return null;
  const task = lesson.tasks.find((item) => item.id === taskId);
  return task ? { lesson, task } : null;
}
