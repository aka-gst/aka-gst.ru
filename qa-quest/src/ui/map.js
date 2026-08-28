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
    el('span', { class: 'node-progress', text: `${progress.doneCount}/${progress.total}` }),
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
    el('p', { class: 'tier-about', text: tier.about }),
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

export function renderMap(root, { onOpen }) {
  clear(root);
  const upNext = nextLesson();

  if (upNext) {
    const progress = lessonState(upNext);
    root.append(el('button', {
      class: 'continue-card',
      onclick: () => onOpen(upNext),
    }, [
      el('span', { class: 'continue-label', text: progress.doneCount ? 'Продолжить' : 'Следующий урок' }),
      el('strong', { text: upNext.title }),
      el('small', { text: upNext.subtitle }),
      el('span', { class: 'continue-go', text: 'Открыть →' }),
    ]));
  } else {
    root.append(el('div', { class: 'continue-card done' }, [
      el('span', { class: 'continue-label', text: 'Курс пройден' }),
      el('strong', { text: 'Все открытые уроки закрыты' }),
      el('small', { text: 'Переключись в режим «разобрать», чтобы добить оставшиеся задачи уроков.' }),
    ]));
  }

  TIERS.forEach((tier) => root.append(tierSection(tier, { onOpen })));
  root.append(el('p', {
    class: 'map-footnote',
    html: 'Python работает прямо в браузере через <b>Pyodide</b>. Устанавливать ничего не нужно, код никуда не отправляется.',
  }));
  decorateGlossary(root.querySelector('.map-footnote'));
  return store.state;
}
