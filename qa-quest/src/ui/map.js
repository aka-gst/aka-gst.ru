/*
 * Карта курса: три ступени, узлы уроков, прогресс и разблокировка.
 */

import { TIERS } from '../content/index.js';
import { stepIcon } from '../content/icons.js';
import { activeTheme, THEMES, setTheme } from '../content/themes.js';
import { store, tierState, lessonState, isLessonOpen, nextLesson, unlockTier } from '../store.js';
import { decorateGlossary } from '../glossary.js';
import { el, clear } from './dom.js';
import { rigButton } from './rig.js';
import { carConsole } from './pingcar.js';

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

  if (lesson.kind === 'lab') classes.push('lab');

  // Иконка стоит всегда, а состояние показывает цвет и рамка. Если подменять
  // её галочкой и замком, на карте новичка остаётся один значок из шестнадцати,
  // и смысл иконок пропадает ровно там, где он нужен больше всего.
  const icon = stepIcon(lesson.id);
  const badge = el('span', { class: 'node-badge' }, icon
    ? el('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', html: icon })
    : String(index + 1).padStart(2, '0'));
  if (progress.mastered) badge.append(el('i', { class: 'node-flag', text: '★' }));
  else if (progress.complete) badge.append(el('i', { class: 'node-flag', text: '✓' }));

  return el('button', {
    class: classes.join(' '),
    disabled: !open,
    onclick: () => open && onOpen(lesson),
    title: open ? lesson.subtitle : 'Сначала закончи предыдущий урок',
  }, [
    badge,
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
  const theme = activeTheme();
  return el('section', { class: 'welcome' }, [
    el('div', { class: 'welcome-text' }, [
      el('span', { class: 'continue-label', text: theme.welcome.label }),
      el('h2', { text: theme.welcome.title }),
      el('p', { class: 'welcome-story', text: theme.welcome.story }),
      el('p', { class: 'welcome-about', text: 'Это курс питона с нуля. Код запускается прямо на этой странице — настоящий Python, а не имитация. Ни на компьютер, ни на телефон ставить ничего не нужно.' }),
      // Итог стоит прямо над кнопкой: человек должен видеть, ради чего нажимает,
      // а не узнавать это на шестнадцатом шаге.
      theme.welcome.outcome ? el('p', { class: 'welcome-outcome' }, [
        el('b', { text: 'К утру ' }),
        theme.welcome.outcome,
      ]) : null,
      upNext ? el('button', {
        class: 'welcome-start',
        onclick: () => onOpen(upNext),
      }, 'Начать с первого урока →') : null,
      /*
       * Факты стоят в левой колонке под кнопкой. Правая с живой машиной выше,
       * и без них под кнопкой оставалась пустая треть карточки.
       *
       * Карточки второй истории здесь больше нет: тот же выбор стоит
       * переключателем в шапке, и повторять его внизу — значит спрашивать
       * дважды об одном. Заодно ушла разная ширина элементов в узкой колонке,
       * из-за которой она выглядела недоделанной.
       *
       * Пункты — обрывки, а не предложения, и точка в конце им не нужна:
       * то же правило у GOV.UK и у Microsoft.
       */
      el('ul', { class: 'welcome-facts' }, [
        el('li', { text: 'Первый урок — три минуты, знать заранее ничего не надо' }),
        el('li', { text: 'Прогресс сохранится сам, вход нужен только для переноса на другой телефон' }),
        el('li', { text: 'Первый запуск скачает около 13 МБ — на мобильном лучше дождаться Wi-Fi' }),
      ]),
    ]),
    el('div', { class: 'welcome-side' }, [
      // Живая машина стоит первой в правой колонке: обещание «код работает
      // прямо здесь» лучше показать, чем написать.
      carConsole(),
      theme.welcome.selling ? el('ul', { class: 'welcome-selling' },
        theme.welcome.selling.map((line) => el('li', { text: line }))) : null,
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
    if (activeTheme().art?.strip) {
      root.append(el('img', {
        class: 'continue-strip', src: activeTheme().art.strip, alt: '',
        loading: 'lazy', decoding: 'async', width: 1200, height: 300,
      }));
    }
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
      el('small', { text: 'Переключись в режим «Подробно», чтобы добить оставшиеся задачи уроков.' }),
    ]));
  }

  // Первая ступень — это и есть продукт для того, кто пришёл учиться питону.
  // Ступени 2 и 3 обращены к другому человеку: он уже пишет код и ищет
  // профессиональный материал. Раньше обе аудитории встречались на одном
  // экране, и ни одной он не говорил ничего внятного.
  // Поездка стоит перед списком шагов, а не после: награда, до которой надо
  // домотать страницу, наградой не работает.
  const rig = rigButton();
  if (rig) root.append(rig);

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
      // Обложка грузится лениво: она ниже первого экрана, и ради неё не стоит
      // задерживать то, что человек видит сразу.
      tier.cover ? el('img', {
        class: 'next-course-cover', src: tier.cover, alt: tier.coverAlt || '',
        loading: 'lazy', decoding: 'async', width: 1200, height: 600,
      }) : null,
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
