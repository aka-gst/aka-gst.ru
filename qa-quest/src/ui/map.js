/*
 * Карта курса: три ступени, узлы уроков, прогресс и разблокировка.
 */

import { TIERS } from '../content/index.js';
import { store, tierState, lessonState, isLessonOpen, nextLesson, unlockTier } from '../store.js';
import { decorateGlossary } from '../glossary.js';
import { el, clear } from './dom.js';

function lessonNode(lesson, index, onOpen) {
  const progress = lessonState(lesson);
  const open = isLessonOpen(lesson);
  const upNext = nextLesson();
  const isNext = upNext && upNext.id === lesson.id;

  const classes = ['node'];
  if (progress.mastered) classes.push('mastered');
  else if (progress.complete) classes.push('done');
  if (!open) classes.push('locked');
  if (isNext) classes.push('next');

  const badge = progress.mastered ? '★' : progress.complete ? '✓' : open ? String(index + 1).padStart(2, '0') : '🔒';
  if (lesson.kind === 'lab') classes.push('lab');

  return el('button', {
    class: classes.join(' '),
    disabled: !open,
    onclick: () => open && onOpen(lesson),
    title: open ? lesson.subtitle : 'Сначала закончи предыдущий урок',
  }, [
    el('span', { class: 'node-badge', text: badge }),
    el('span', { class: 'node-copy' }, [
      el('strong', { text: lesson.title }),
      el('small', { text: lesson.skill }),
    ]),
    el('span', { class: 'node-progress' }, [
      // Время шага показывает, что ночь идёт: карта читается как журнал, а не
      // как оглавление. Есть только там, где есть сюжет.
      lesson.time ? el('i', { class: 'node-time', text: lesson.time }) : null,
      `${progress.requiredDone}/${progress.requiredTotal}`,
    ]),
  ]);
}

function tierSection(tier, { onOpen }) {
  const state = tierState(tier.id);
  const percent = Math.round(state.ratio * 100);

  const header = el('div', { class: 'tier-head' }, [
    el('div', { class: 'tier-mark', text: String(tier.number) }),
    el('div', { class: 'tier-title' }, [
      el('h2', { text: tier.title }),
      el('p', { text: tier.tagline }),
    ]),
    el('div', { class: 'tier-count', text: state.unlocked ? `${state.complete} / ${state.total}` : 'закрыто' }),
  ]);

  const bar = el('div', { class: 'tier-bar' }, el('i', { style: `width:${percent}%` }));

  if (!state.unlocked) {
    return el('section', { class: `tier locked accent-${tier.accent}` }, [
      header,
      bar,
      el('p', { class: 'tier-about', text: tier.about }),
      el('div', { class: 'tier-gate' }, [
        el('span', { text: 'Ступень откроется, когда пройдено 80% предыдущей.' }),
        el('button', {
          class: 'ghost-button',
          onclick: () => unlockTier(tier.id),
        }, 'Я уже это знаю — открыть'),
      ]),
    ]);
  }

  // Внутри ступени два слоя: тренажёр в браузере и практикум на своей машине.
  // Порядок не случайный — сначала попробовать без установки, потом сделать по-настоящему.
  const groups = [
    {
      lessons: state.lessons.filter((lesson) => lesson.kind !== 'lab'),
      title: 'Тренажёр в браузере',
      note: 'Код выполняется здесь, проверки автоматические.',
    },
    {
      lessons: state.lessons.filter((lesson) => lesson.kind === 'lab'),
      title: 'Практикум на своей машине',
      note: 'Настоящая работа: установка, запуск, прогон. Отмечаешь выполненное сам.',
    },
  ].filter((group) => group.lessons.length);

  let counter = -1;
  return el('section', { class: `tier accent-${tier.accent}` }, [
    header,
    bar,
    ...groups.flatMap((group) => [
      groups.length > 1 ? el('div', { class: 'group-head' }, [
        el('h3', { text: group.title }),
        el('span', { text: group.note }),
      ]) : null,
      el('div', { class: 'node-grid' }, group.lessons.map((lesson) => {
        counter += 1;
        return lessonNode(lesson, counter, onOpen);
      })),
    ]).filter(Boolean),
  ]);
}

/**
 * Экран для того, кто здесь впервые. Постоянному ученику он не нужен и не
 * показывается, а новичку карта уровней и XP сама по себе ничего не объясняет:
 * ему нужно знать, что это, сколько займёт и что ставить ничего не надо.
 */
function welcome(upNext, onOpen) {
  return el('section', { class: 'welcome' }, [
    el('div', { class: 'welcome-text' }, [
      el('span', { class: 'continue-label', text: '02:14 · доступ получен' }),
      el('h2', { text: 'Шестнадцать шагов одной ночи' }),
      el('p', { class: 'welcome-story', text: 'Ты внутри чужой сети, и экран пуст. К утру ты научишься разговаривать с системой, читать чужие записи, собрать свой инструмент — и на последнем шаге построишь защиту собственного сервера, а потом сам её сломаешь.' }),
      el('p', { text: 'Это курс питона с нуля. Код запускается прямо на этой странице — настоящий Python, а не имитация. Ни на компьютер, ни на телефон ставить ничего не нужно.' }),
      upNext ? el('button', {
        class: 'welcome-start',
        onclick: () => onOpen(upNext),
      }, 'Начать с первого урока →') : null,
    ]),
    // Пункты списка — обрывки, а не предложения, и точка в конце им не нужна.
    // Правило то же у GOV.UK («do not use a full stop at the end») и у
    // Microsoft («unless they're complete sentences»). Раньше здесь стояло по
    // два предложения на пункт — от этого список и выглядел тяжёлым.
    el('ul', { class: 'welcome-facts' }, [
      el('li', { text: 'Первый урок — три минуты, знать заранее ничего не надо' }),
      el('li', { text: 'Прогресс сохранится сам, вход нужен только для переноса на другой телефон' }),
      el('li', { text: 'Первый запуск скачает около 13 МБ — на мобильном лучше дождаться Wi-Fi' }),
    ]),
  ]);
}

export function renderMap(root, { onOpen }) {
  clear(root);
  const upNext = nextLesson();
  const firstVisit = Object.keys(store.state.tasks).length === 0;

  if (firstVisit) {
    root.append(welcome(upNext, onOpen));
  } else if (upNext) {
    const progress = lessonState(upNext);
    root.append(el('button', {
      class: 'continue-card',
      onclick: () => onOpen(upNext),
    }, [
      el('span', { class: 'continue-label', text: progress.doneCount ? 'Продолжить' : 'Начать' }),
      el('strong', { text: upNext.title }),
      el('small', { text: upNext.subtitle }),
      el('span', { class: 'continue-go', text: '→' }),
    ]));
  } else {
    root.append(el('div', { class: 'continue-card done' }, [
      el('span', { class: 'continue-label', text: 'Курс пройден' }),
      el('strong', { text: 'Все открытые уроки закрыты' }),
      el('small', { text: 'Переключись в режим «разобрать», чтобы добить оставшиеся задачи уроков.' }),
    ]));
  }

  // Первая ступень — это и есть продукт для того, кто пришёл учиться питону.
  // Ступени 2 и 3 обращены к другому человеку: он уже пишет код и ищет
  // профессиональный материал. Раньше обе аудитории встречались на одном
  // экране, и ни одной он не говорил ничего внятного.
  root.append(tierSection(TIERS[0], { onOpen }));

  root.append(nextCourses(onOpen));
  return store.state;
}

/** Вторая и третья ступени: отдельный разговор с другим человеком. */
function nextCourses(onOpen) {
  const rest = TIERS.slice(1).map((tier) => {
    const state = tierState(tier.id);
    const open = state.unlocked;
    return el('button', {
      class: `next-course accent-${tier.accent} ${open ? '' : 'locked'}`,
      onclick: () => {
        if (!open) {
          unlockTier(tier.id);
          return;
        }
        const first = state.lessons.find((lesson) => isLessonOpen(lesson)) || state.lessons[0];
        if (first) onOpen(first);
      },
    }, [
      el('strong', { text: tier.title }),
      el('small', { text: tier.about }),
      el('span', { class: 'next-course-go', text: open ? `${state.complete} / ${state.total} · открыть →` : 'открыть ступень →' }),
    ]);
  });

  return el('section', { class: 'next-courses' }, [
    el('h2', { text: 'Дальше, когда код уже пишется' }),
    el('p', { text: 'Продолжение для тех, кто программирует: как проверять чужой код и как работать с языковыми моделями. Отдельный материал и другой уровень — новичку сюда рано, и ничего страшного, если вы сюда не пойдёте.' }),
    el('div', { class: 'next-course-grid' }, rest),
  ]);
}
