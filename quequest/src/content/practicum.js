/*
 * Импорт готовых практикумов в ступени 2 и 3.
 *
 * Тексты этих ступеней здесь не пишутся. Источник — DOCX в agent-lab и
 * Markdown в ai-agent-service-lab; сборка кладёт рядом с опубликованными
 * страницами course.json по схеме aka-gst.course/1, и QA Quest читает его
 * напрямую. Правка текста в QA Quest исчезла бы при следующей пересборке,
 * поэтому её здесь нет — только проекция готовых полей на урок.
 *
 * Ступени 2 и 3 — работа на своей машине: поставить Ollama, поднять шлюз,
 * прогнать pytest. Автоматически проверить это в браузере нельзя, поэтому
 * критерий завершения — чек-лист done_when, который участник отмечает сам.
 */

const SCHEMA = 'aka-gst.course/1';

export const PRACTICUM_SOURCES = [
  { tier: 'testing', slug: 'testirovanie', stage: 2 },
  { tier: 'llm', slug: 'llm', stage: 3 },
];

/** Поля task приходят обычным текстом, поэтому в разметку они попадают экранированными. */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const asList = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

function paragraphs(items) {
  return asList(items).map((item) => `<p>${escapeHtml(item)}</p>`).join('');
}

/**
 * Первая содержательная фраза summary. Короткий зачин вроде «Атомарная цель.»
 * пропускается: в подзаголовке урока от него нет пользы.
 */
function firstSentence(text) {
  let rest = String(text || '').replace(/\s+/g, ' ').trim();
  for (let guard = 0; guard < 3; guard += 1) {
    const stop = rest.search(/[.!?]\s/);
    const head = stop > 0 ? rest.slice(0, stop + 1) : rest;
    if (head.length >= 25 || stop < 0) {
      return head.length > 120 ? `${head.slice(0, 117)}…` : head;
    }
    rest = rest.slice(stop + 2);
  }
  return rest.slice(0, 120);
}

/** Кандидаты пути: на домене практикум лежит соседней папкой, локально — своей копией. */
function candidates(slug) {
  const configured = window.QA_QUEST_PRACTICUM;
  const paths = configured ? [`${String(configured).replace(/\/$/, '')}/${slug}/course.json`] : [];
  return paths.concat([
    `../praktikum/${slug}/course.json`,
    `practicum/${slug}/course.json`,
  ]);
}

async function fetchCourse(slug) {
  for (const path of candidates(slug)) {
    try {
      const response = await fetch(path, { cache: 'no-cache' });
      if (!response.ok) continue;
      const course = await response.json();
      // Правило схемы: сначала читаем версию и отказываемся от незнакомой.
      if (course.schema !== SCHEMA) {
        console.warn(`практикум ${slug}: неизвестная схема ${course.schema}`);
        continue;
      }
      return { course, base: path.replace(/course\.json$/, '') };
    } catch (_) { /* пробуем следующий путь */ }
  }
  return null;
}

function toLesson(unit, { course, base, tier }) {
  const task = unit.task || {};
  const commands = asList(task.commands).filter((command) => command && command.text);
  const snippets = asList(task.snippets).slice(0, 3);
  const done = asList(task.done_when);

  return {
    id: `lab-${course.id}-${unit.id}`,
    tier,
    kind: 'lab',
    title: unit.title,
    subtitle: firstSentence(unit.summary),
    skill: unit.number ? `эксперимент ${unit.number}` : 'практикум',
    page: `${base}${unit.id}.html`,
    course: { id: course.id, title: course.title, repository: course.source?.repository },
    sprint: {
      idea: paragraphs(asList(task.objective).slice(0, 1)) || `<p>${escapeHtml(unit.summary || '')}</p>`,
    },
    deep: {
      theory: paragraphs(task.objective) || `<p>${escapeHtml(unit.summary || '')}</p>`,
      where: paragraphs(asList(task.where).length ? task.where : task.prerequisites) || '<p>На своей машине по инструкции практикума.</p>',
      pitfall: paragraphs(asList(task.pitfalls).slice(0, 3)) || '<p>Разбор типовых ошибок — на полной странице эксперимента.</p>',
      examples: snippets.map((snippet) => ({ code: snippet.text, note: snippet.section || '' })),
    },
    tasks: [{
      id: 'do',
      kind: 'checklist',
      xp: Math.max(30, Math.round((unit.estimate_minutes || 3) * 10)),
      brief: paragraphs(task.scope) || `<p>${escapeHtml(unit.summary || '')}</p>`,
      items: done.length ? done : ['Эксперимент выполнен и результат зафиксирован.'],
      commands,
      expected: asList(task.expected),
      artifacts: asList(task.artifacts),
      hint: asList(task.pitfalls).join('\n') || 'Полный разбор со всеми командами — на странице эксперимента.',
    }],
  };
}

/** Возвращает уроки одной ступени или пустой список, если практикум недоступен. */
export async function loadPracticum(source) {
  const found = await fetchCourse(source.slug);
  if (!found) return [];
  const { course, base } = found;
  const context = { course, base, tier: source.tier };
  return course.units
    .filter((unit) => unit.kind === 'experiment' && unit.task)
    .map((unit) => toLesson(unit, context));
}

export async function loadAllPracticums() {
  const loaded = await Promise.all(PRACTICUM_SOURCES.map(async (source) => {
    try {
      return await loadPracticum(source);
    } catch (_) {
      return [];
    }
  }));
  return loaded.flat();
}
