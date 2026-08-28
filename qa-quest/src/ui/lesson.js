/*
 * Рабочая область урока.
 *
 * Уроков два вида, и они устроены по-разному. Тренажёр («drill») — редактор,
 * терминал и автоматические проверки: код выполняется прямо здесь. Практикум
 * («lab») — команды для своей машины и чек-лист, который участник отмечает сам,
 * потому что установку Ollama и прогон pytest браузер проверить не может.
 */

import { lessonsOfTier } from '../content/index.js';
import {
  store, lessonState, isTaskDone, isLessonOpen, loadCode, saveCode,
  completeTask, requiredTasks, nextLesson, checkedItems, toggleCheck,
} from '../store.js';
import { runPython, runner, onRunnerChange } from '../runner.js';
import { decorateGlossary } from '../glossary.js';
import { track } from '../analytics.js';
import { el, clear } from './dom.js';

const view = {
  lesson: null,
  taskIndex: 0,
  attempted: false,
  hintLevel: 0,
  nodes: {},
  detachRunner: null,
  // Последний прогон каждой задачи: после перерисовки экрана
  // ученик должен видеть тот же результат, а не пустые проверки.
  results: new Map(),
};

const resultKey = () => `${view.lesson.id}:${currentTask().id}`;
const isLab = () => view.lesson.kind === 'lab';

function currentTask() {
  return view.lesson.tasks[view.taskIndex];
}

function visibleTasks() {
  return requiredTasks(view.lesson);
}

/* ---------- разбор ---------- */

function briefing() {
  const lesson = view.lesson;
  const mode = store.state.mode;
  const body = el('div', { class: 'brief-body' });

  if (mode === 'sprint') {
    body.append(el('div', { class: 'brief-idea', html: lesson.sprint.idea }));
    if (lesson.tasks.length > 1) {
      body.append(el('p', {
        class: 'brief-more',
        text: `В режиме «разобрать» здесь ещё ${lesson.tasks.length - 1} задачи и подробное объяснение.`,
      }));
    }
  } else {
    body.append(el('div', { class: 'brief-theory', html: lesson.deep.theory }));
    body.append(el('div', { class: 'brief-notes' }, [
      el('div', {}, [el('span', { text: isLab() ? 'ГДЕ ВЫПОЛНЯТЬ' : 'ГДЕ ПРИМЕНЯЕТСЯ' }), el('div', { html: lesson.deep.where })]),
      el('div', {}, [el('span', { text: 'ТИПИЧНАЯ ОШИБКА' }), el('div', { html: lesson.deep.pitfall })]),
    ]));
    if (lesson.deep.examples.length) {
      body.append(el('details', { class: 'brief-examples' }, [
        el('summary', { text: isLab() ? 'Фрагменты из практикума' : 'Примеры' }),
        ...lesson.deep.examples.map((example) => el('div', { class: 'example' }, [
          el('pre', { text: example.code }),
          example.note ? el('p', { html: example.note }) : null,
        ])),
      ]));
    }
  }

  decorateGlossary(body);
  return body;
}

/* ---------- вкладки задач ---------- */

function taskTabs(rerender) {
  const tasks = visibleTasks();
  if (tasks.length < 2) return null;
  return el('div', { class: 'task-tabs' }, tasks.map((task, index) => el('button', {
    class: `task-tab ${index === view.taskIndex ? 'active' : ''} ${isTaskDone(view.lesson.id, task.id) ? 'done' : ''}`,
    onclick: () => {
      view.taskIndex = index;
      view.hintLevel = 0;
      view.attempted = false;
      rerender();
    },
  }, [
    el('span', { text: `Задача ${index + 1}` }),
    isTaskDone(view.lesson.id, task.id) ? el('i', { text: '✓' }) : null,
  ])));
}

/* ---------- редактор тренажёра ---------- */

function syncLines() {
  const { editor, gutter } = view.nodes;
  if (!editor) return;
  const count = editor.value.split('\n').length;
  gutter.textContent = Array.from({ length: count }, (_, i) => i + 1).join('\n');
  gutter.scrollTop = editor.scrollTop;
}

function editorPanel() {
  const task = currentTask();
  const gutter = el('pre', { class: 'gutter', 'aria-hidden': 'true' });
  const editor = el('textarea', {
    class: 'code-editor',
    spellcheck: 'false',
    // Без переноса: иначе длинная строка занимает две визуальные и номера
    // перестают соответствовать коду. В обучении это не косметика — ошибки
    // Python указывают на номер строки, и он должен показывать на неё.
    wrap: 'off',
    'aria-label': 'Редактор Python',
    oninput: () => {
      syncLines();
      saveCode(view.lesson.id, task.id, editor.value);
    },
    onscroll: () => { gutter.scrollTop = editor.scrollTop; },
    onkeydown: (event) => {
      if (event.key === 'Tab') {
        event.preventDefault();
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        editor.value = `${editor.value.slice(0, start)}    ${editor.value.slice(end)}`;
        editor.selectionStart = editor.selectionEnd = start + 4;
        syncLines();
        saveCode(view.lesson.id, task.id, editor.value);
      }
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        run();
      }
    },
  });
  editor.value = loadCode(view.lesson.id, task.id, task.starter);
  view.nodes.editor = editor;
  view.nodes.gutter = gutter;

  const runButton = el('button', { class: 'run-button', onclick: run }, [
    el('span', { text: '▶' }), ' Запустить ', el('kbd', { text: '⌘↵' }),
  ]);
  view.nodes.runButton = runButton;

  return el('section', { class: 'editor-panel panel' }, [
    el('div', { class: 'editor-toolbar' }, [
      el('div', { class: 'file-tab' }, [el('span', { class: 'status-dot' }), el('span', { text: task.file })]),
      el('div', { class: 'editor-actions' }, [
        el('button', {
          class: 'ghost-button',
          onclick: () => {
            editor.value = task.starter;
            syncLines();
            saveCode(view.lesson.id, task.id, editor.value);
          },
        }, 'Вернуть код'),
        runButton,
      ]),
    ]),
    el('div', { class: 'editor-wrap' }, [gutter, editor]),
  ]);
}

/* ---------- команды практикума ---------- */

function copyButton(text) {
  const button = el('button', { class: 'ghost-button copy-button' }, 'Скопировать');
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = 'Скопировано';
    } catch (_) {
      button.textContent = 'Выдели и скопируй вручную';
    }
    setTimeout(() => { button.textContent = 'Скопировать'; }, 2000);
  });
  return button;
}

function commandsPanel() {
  const task = currentTask();
  const blocks = [];

  task.commands.forEach((command, index) => {
    blocks.push(el('div', { class: 'command-block' }, [
      el('div', { class: 'command-head' }, [
        el('span', { text: command.language || 'shell' }),
        copyButton(command.text),
      ]),
      el('pre', { text: command.text }),
    ]));
    if (index === 0 && task.commands.length > 1) blocks.push(el('div', { class: 'command-more', text: 'Дальше по шагам:' }));
  });

  if (task.expected.length) {
    blocks.push(el('div', { class: 'command-expected' }, [
      el('span', { text: 'ЧТО ДОЛЖНО ПОЛУЧИТЬСЯ' }),
      el('ul', {}, task.expected.map((item) => el('li', { text: item }))),
    ]));
  }

  if (!blocks.length) {
    blocks.push(el('p', {
      class: 'command-empty',
      text: 'Команды и разбор — на полной странице эксперимента, ссылка справа.',
    }));
  }

  return el('section', { class: 'commands-panel panel' }, [
    el('div', { class: 'panel-heading' }, [
      el('span', { text: 'НА СВОЕЙ МАШИНЕ' }),
      el('span', { class: 'run-state', text: view.lesson.course.title }),
    ]),
    el('div', { class: 'commands-body' }, blocks),
  ]);
}

/* ---------- терминал и проверки тренажёра ---------- */

function renderChecks(results) {
  const task = currentTask();
  const list = view.nodes.checkList;
  clear(list);
  task.checks.forEach((check, index) => {
    const outcome = results ? results[index] : null;
    const state = !outcome ? '' : outcome.ok ? 'pass' : 'fail';
    list.append(el('div', { class: `check-row ${state}` }, [
      el('span', { class: 'check-icon', text: outcome ? (outcome.ok ? '✓' : '×') : '·' }),
      el('span', {}, [
        el('b', { text: check.label }),
        outcome && !outcome.ok && outcome.detail ? el('small', { text: outcome.detail }) : null,
      ]),
    ]));
  });
}

function writeConsole(text, tone = '') {
  const output = view.nodes.console;
  output.className = `console-output ${tone}`;
  output.textContent = text;
}

/**
 * Прямая обратная связь от ученика. Кнопка ничего не чинит — она отмечает
 * место, где человек застрял, чтобы потом было видно, какой именно урок
 * переписывать. Без неё остаётся гадать по числу брошенных попыток.
 */
function stuckButton(task) {
  const button = el('button', { class: 'text-button stuck-button' }, 'Здесь непонятно');
  button.addEventListener('click', () => {
    track.stuck(view.lesson, task);
    button.textContent = 'Спасибо, отмечено';
    button.disabled = true;
  });
  return button;
}

function hintButton(task) {
  const box = el('div', { class: 'hint-box', hidden: true });
  const button = el('button', {
    class: 'hint-button',
    onclick: () => {
      view.hintLevel += 1;
      if (view.hintLevel === 1) {
        box.hidden = false;
        box.replaceChildren(el('p', { text: task.hint }));
        if (task.solution) button.textContent = 'Показать решение';
        else button.disabled = true;
      } else {
        box.replaceChildren(
          el('p', { class: 'hint-note', text: 'Решение целиком. Лучше сначала перепиши его руками, а не вставляй.' }),
          el('pre', { text: task.solution }),
        );
        button.disabled = true;
      }
    },
  }, 'Подсказка');
  return [button, box];
}

function consolePanel() {
  const task = currentTask();
  const consoleOutput = el('pre', { class: 'console-output' });
  const checkList = el('div', { class: 'check-list' });
  view.nodes.console = consoleOutput;
  view.nodes.checkList = checkList;
  view.nodes.runState = el('span', { class: 'run-state', text: 'ожидает запуска' });
  const [button, box] = hintButton(task);

  const panel = el('aside', { class: 'lab-panel panel' }, [
    el('div', { class: 'panel-heading' }, [el('span', { text: 'ТЕРМИНАЛ' }), view.nodes.runState]),
    consoleOutput,
    el('div', { class: 'checks' }, [el('h2', { text: 'ПРОВЕРКИ' }), checkList]),
    button,
    box,
    stuckButton(task),
  ]);

  const previous = view.results.get(resultKey());
  if (previous) {
    showResult(previous);
  } else {
    renderChecks(null);
    writeConsole(runner.status === 'ready'
      ? '> Python готов. Жми «Запустить».'
      : '> Python загрузится при первом запуске.');
  }
  return panel;
}

/* ---------- чек-лист практикума ---------- */

function checklistPanel(rerender) {
  const lesson = view.lesson;
  const task = currentTask();
  const marks = checkedItems(lesson, task);
  const done = marks.filter(Boolean).length;

  const list = el('div', { class: 'check-list' }, task.items.map((item, index) => el('button', {
    class: `check-row tickable ${marks[index] ? 'pass' : ''}`,
    'aria-pressed': String(Boolean(marks[index])),
    onclick: () => {
      const outcome = toggleCheck(lesson, task, index);
      if (outcome && !outcome.already) view.onProgress(outcome, lesson, task);
      else rerender();
    },
  }, [
    el('span', { class: 'check-icon', text: marks[index] ? '✓' : '·' }),
    el('span', {}, el('b', { text: item })),
  ])));

  const [button, box] = hintButton(task);

  return el('aside', { class: 'lab-panel panel' }, [
    el('div', { class: 'panel-heading' }, [
      el('span', { text: 'КРИТЕРИЙ ЗАВЕРШЕНИЯ' }),
      el('span', { class: 'run-state', text: `${done} из ${task.items.length}` }),
    ]),
    el('p', { class: 'checklist-note', text: 'Отметь пункт, когда он действительно выполнен и есть чем это подтвердить. Проверяешь здесь только ты.' }),
    el('div', { class: 'checks' }, list),
    el('a', { class: 'page-link', href: lesson.page, target: '_blank', rel: 'noopener' }, 'Разобрать подробно →'),
    button,
    box,
    stuckButton(task),
  ]);
}

/** Показывает результат прогона: терминал, проверки и переход к следующему шагу. */
function showResult(result) {
  renderChecks(result.checks);
  if (result.error) {
    const parts = [result.error.text];
    if (result.error.hint) parts.push('', `Подсказка: ${result.error.hint}`);
    writeConsole(parts.join('\n'), 'error');
    view.nodes.runState.textContent = 'ошибка';
    return false;
  }
  const passed = result.checks.every((check) => check.ok);
  const output = result.stdout.trim() || '(программа ничего не вывела)';
  const score = `— ${result.checks.filter((c) => c.ok).length} из ${result.checks.length} проверок пройдено · ${result.ms} мс`;
  writeConsole(`${output}\n\n${score}`, passed ? 'ok' : '');
  view.nodes.runState.textContent = passed ? 'всё сошлось' : 'есть расхождения';
  if (passed) renderNextStep();
  return passed;
}

/** Куда идти дальше: следующая задача урока или следующий урок. */
function renderNextStep() {
  const tasks = visibleTasks();
  const nextTaskIndex = tasks.findIndex((task, index) => index > view.taskIndex && !isTaskDone(view.lesson.id, task.id));
  const target = nextTaskIndex >= 0 ? { kind: 'task', index: nextTaskIndex } : { kind: 'lesson', lesson: nextLesson() };
  if (target.kind === 'lesson' && !target.lesson) return;

  const label = target.kind === 'task'
    ? `Следующая задача №${target.index + 1} →`
    : `Следующий урок: ${target.lesson.title} →`;

  view.nodes.checkList.after(el('button', {
    class: 'next-step',
    onclick: () => {
      if (target.kind === 'task') {
        view.taskIndex = target.index;
        view.hintLevel = 0;
        view.attempted = false;
        view.rerender();
      } else {
        view.onOpen(target.lesson);
      }
    },
  }, label));
}

/* ---------- запуск ---------- */

async function run() {
  const lesson = view.lesson;
  const task = currentTask();
  const source = view.nodes.editor.value;
  view.nodes.runButton.disabled = true;
  view.nodes.runState.textContent = runner.status === 'ready' ? 'выполняю' : 'загружаю Python';
  writeConsole(runner.status === 'ready'
    ? '> Выполняю…'
    : '> Загружаю Python в браузер. Первый раз это около 13 МБ, дальше он берётся из кэша.');

  const result = await runPython({
    source,
    preamble: lesson.preamble || '',
    checks: task.checks,
    stdin: task.stdin || [],
  });

  view.nodes.runButton.disabled = false;
  view.results.set(`${lesson.id}:${task.id}`, result);
  const passed = showResult(result);

  if (!passed) {
    track.taskFailed(lesson, task, result);
    view.attempted = true;
    return;
  }

  const firstTry = !view.attempted && view.hintLevel === 0;
  track.taskSolved(lesson, task, { firstTry });
  const outcome = completeTask(lesson, task, { firstTry });
  view.attempted = false;
  if (!outcome.already) view.onProgress(outcome, lesson, task);
}

/* ---------- сборка экрана ---------- */

export function renderLesson(root, lesson, context) {
  if (view.detachRunner) view.detachRunner();
  const sameLesson = view.lesson && view.lesson.id === lesson.id;
  view.lesson = lesson;
  view.onProgress = context.onProgress;
  view.nodes = {};
  if (!sameLesson) {
    view.taskIndex = 0;
    view.hintLevel = 0;
    view.attempted = false;
    track.lessonOpened(lesson);
  }
  const tasks = visibleTasks();
  if (view.taskIndex >= tasks.length) view.taskIndex = tasks.length - 1;

  const rerender = () => renderLesson(root, lesson, context);
  view.rerender = rerender;
  view.onOpen = context.onOpen;

  const siblings = lessonsOfTier(lesson.tier);
  const progress = lessonState(lesson);
  const lab = isLab();

  clear(root);
  root.append(
    el('aside', { class: 'lesson-aside panel' }, [
      el('button', { class: 'back-button', onclick: context.onBack }, '← К карте'),
      el('div', { class: 'aside-list' }, siblings.map((item, index) => el('button', {
        class: `aside-item ${item.id === lesson.id ? 'active' : ''} ${lessonState(item).complete ? 'done' : ''}`,
        disabled: !isLessonOpen(item),
        onclick: () => context.onOpen(item),
      }, [
        el('span', { class: 'aside-index', text: String(index + 1).padStart(2, '0') }),
        el('span', {}, [el('strong', { text: item.title }), el('small', { text: item.skill })]),
      ]))),
    ]),

    el('div', { class: 'lesson-main' }, [
      el('article', { class: 'brief panel' }, [
        el('div', { class: 'brief-head' }, [
          el('div', {}, [
            el('div', { class: 'eyebrow' }, [
              lab ? el('b', { class: 'lab-badge', text: 'ПРАКТИКУМ' }) : null,
              `${lesson.skill.toUpperCase()} · ${progress.requiredDone}/${progress.requiredTotal}`,
            ]),
            el('h1', { text: lesson.title }),
            el('p', { class: 'brief-subtitle', text: lesson.subtitle }),
          ]),
          el('div', { class: 'reward', text: `+${currentTask().xp} XP` }),
        ]),
        briefing(),
      ]),
      // Задача живёт вне прокручиваемого разбора: в режиме «разобрать»
      // теория длинная, и условие не должно уезжать за край экрана.
      el('div', { class: 'task-block panel' }, [
        taskTabs(rerender),
        el('div', { class: 'task-card' }, [
          el('span', { text: lab ? 'ЧТО СДЕЛАТЬ' : 'ЗАДАЧА' }),
          el('div', { html: currentTask().brief }),
        ]),
      ]),
      lab ? commandsPanel() : editorPanel(),
    ]),

    lab ? checklistPanel(rerender) : consolePanel(),
  );

  decorateGlossary(root.querySelector('.task-card'));
  if (!lab) {
    syncLines();
    view.detachRunner = onRunnerChange((state) => {
      if (!view.nodes.runState) return;
      if (state.status === 'loading') view.nodes.runState.textContent = state.message || 'загружаю Python';
      if (state.status === 'failed') writeConsole(`Не удалось загрузить Python: ${state.message}`, 'error');
    });
  } else {
    view.detachRunner = null;
  }
}

export function activeLesson() {
  return view.lesson;
}
