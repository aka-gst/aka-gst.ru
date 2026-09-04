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
import { buildStoryChoices } from './onboarding-model.js';

const NEXT_ROUTES = {
  testing: {
    label: 'МАРШРУТ 1',
    title: 'ПРОВЕРИТЬ СИСТЕМУ',
    about: 'Найди место, где чужая система врёт, и докажи это тестом.',
  },
  llm: {
    label: 'МАРШРУТ 2',
    title: 'СОБРАТЬ АГЕНТА',
    about: 'Собери помощника, задай ему границы и проверь, что он их держит.',
  },
};

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
  const startLabel = theme.id === 'garage' ? 'Подключиться к блоку →' : 'Войти в сеть →';
  return el('section', { class: 'welcome' }, [
    storyChoice(),
    el('div', { class: 'welcome-text' }, [
      el('span', { class: 'continue-label', text: theme.welcome.label }),
      el('h2', { text: theme.welcome.title }),
      el('p', { class: 'welcome-story', text: theme.welcome.story }),
      el('p', { class: 'welcome-about', text: 'Это ночь, которую нужно пройти. Код здесь — твой инструмент: им ты заставляешь систему отвечать, находишь дыру и ставишь свой замок. Ничего устанавливать не нужно.' }),
      // Итог стоит прямо над кнопкой: человек должен видеть, ради чего нажимает,
      // а не узнавать это на шестнадцатом шаге.
      theme.welcome.outcome ? el('p', { class: 'welcome-outcome' }, [
        el('b', { text: 'К утру ' }),
        theme.welcome.outcome,
      ]) : null,
      upNext ? el('button', {
        class: 'welcome-start',
        onclick: () => onOpen(upNext),
      }, startLabel) : null,
      /*
       * Факты стоят под первым настоящим действием, а не рядом с игровым
       * терминалом: первая команда человека должна ждать Python в уроке.
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
        el('li', { text: 'Первый ход — три минуты, знать заранее ничего не надо' }),
        el('li', { text: 'Прогресс сохранится сам, вход нужен только для переноса на другой телефон' }),
        el('li', { text: 'Первый запуск скачает около 13 МБ — на мобильном лучше дождаться Wi-Fi' }),
      ]),
    ]),
    el('div', { class: 'welcome-side' }, [
      theme.welcome.selling ? el('ul', { class: 'welcome-selling' },
        theme.welcome.selling.map((line) => el('li', { text: line }))) : null,
    ]),
  ]);
}

/**
 * Две истории — два равноправных входа. В пользовательских проверках одному
 * человеку были ближе автомобили, другому серверы; маленький переключатель в
 * шапке второй человек не заметил. Поэтому выбор стоит до сюжетного текста и
 * показывает обе дороги одновременно.
 */
function storyChoice() {
  const current = activeTheme();
  const choices = buildStoryChoices(THEMES, current.id);
  return el('div', { class: 'story-choice' }, [
    el('div', { class: 'story-choice-head' }, [
      el('span', { text: 'ВЫБЕРИ СВОЮ ИСТОРИЮ' }),
      el('small', { text: 'Навык один — меняется мир, который ты берёшь под контроль' }),
    ]),
    el('div', { class: 'story-choice-grid', role: 'group', 'aria-label': 'Выбор истории курса' },
      choices.map((choice) => el('button', {
        type: 'button',
        class: `story-card story-card-${choice.id} ${choice.active ? 'active' : ''}`,
        'aria-pressed': String(choice.active),
        onclick: () => { if (!choice.active) setTheme(choice.id); },
      }, [
        el('strong', { text: choice.name }),
        el('span', { text: choice.hook }),
        el('small', { text: choice.active ? 'выбрано' : 'перейти →' }),
      ]))),
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
      el('small', { text: 'Все задания в открытых уроках сделаны.' }),
    ]));
  }

  // Первая ступень — вход в историю. Следующие маршруты растут из неё, а не
  // продаются как отдельные предметы: сначала научился влиять на систему,
  // потом выбираешь, проверять её или строить своего помощника.
  // Поездка стоит перед списком шагов, а не после: награда, до которой надо
  // домотать страницу, наградой не работает.
  const rig = rigButton();
  if (rig) root.append(rig);

  root.append(tierSection(TIERS[0], { onOpen }));

  root.append(nextCourses(onOpen));
  return store.state;
}

/** Два продолжения одной истории: проверка системы или свой агент. */
function nextCourses(onOpen) {
  const rest = TIERS.slice(1).map((tier) => {
    const state = tierState(tier.id);
    const open = state.unlocked;
    const route = NEXT_ROUTES[tier.id];
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
      el('span', { class: 'next-route-label', text: route.label }),
      el('strong', { text: route.title }),
      el('small', { text: route.about }),
      el('span', { class: 'next-course-go', text: open ? `${state.complete} / ${state.total} · открыть →` : 'открыть ступень →' }),
    ]);
  });

  return el('section', { class: 'next-courses' }, [
    el('h2', { text: 'Две дороги после первой ночи' }),
    el('p', { text: 'Ты уже умеешь заставить систему отвечать. Дальше выбираешь, что делать с этим правом: искать в чужой системе поломки или собрать себе помощника и научить его не выходить за границы.' }),
    el('div', { class: 'next-course-grid' }, rest),
  ]);
}
