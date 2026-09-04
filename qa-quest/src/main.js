/*
 * Сборка приложения: шапка, маршруты, режимы подачи и вход.
 */

import { lessonById, loadPracticums } from './content/index.js';
import { activeTheme, THEMES, setTheme } from './content/themes.js';
import {
  loadStore, subscribe, store, levelInfo, resetProgress, isLessonOpen,
} from './store.js';
import { bootRunner, onRunnerChange } from './runner.js';
import { auth, onAuthChange, probeAuth, login, register, recover, logout, progressHint } from './auth.js';
import { renderMap } from './ui/map.js';
import { renderLesson } from './ui/lesson.js';
import { el, clear, $ } from './ui/dom.js';

const screens = {
  map: $('mapScreen'),
  lesson: $('lessonScreen'),
};

/**
 * Откуда брать Pyodide. Если рядом с сайтом выложена локальная копия
 * (tools/fetch-pyodide.sh), берём её: это быстрее и не зависит от чужого CDN.
 * Иначе воркер сам сходит на jsDelivr.
 */
const runnerConfig = (async () => {
  if (window.QA_QUEST_PYODIDE) return { base: window.QA_QUEST_PYODIDE };
  try {
    const response = await fetch('vendor/pyodide/pyodide.mjs', { method: 'HEAD' });
    if (response.ok) return { base: new URL('vendor/pyodide/', location.href).href };
  } catch (_) { /* сеть или файла нет — разбираемся ниже */ }
  // Молчать здесь нельзя: неполная выкладка отправит браузеры всех посетителей
  // на чужой CDN, и следа об этом не останется. При разработке это норма,
  // на домене — повод пересобрать выкладку.
  console.warn(
    'QA Quest: локальная копия Pyodide не найдена, Python будет загружен с cdn.jsdelivr.net. '
    + 'Если это боевой сайт — выкладка неполная, нужен tools/fetch-pyodide.sh и повторный деплой.',
  );
  return {};
})();

/* ---------- маршруты ---------- */

function openLesson(lesson) {
  location.hash = `#/lesson/${lesson.id}`;
}

function openMap() {
  location.hash = '#/';
}

function route() {
  const match = location.hash.match(/^#\/lesson\/([\w-]+)$/);
  const lesson = match ? lessonById(match[1]) : null;
  // Прямая ссылка не должна обходить порядок уроков: закрытый урок
  // возвращает на карту, где видно, что именно его открывает.
  if (lesson && !isLessonOpen(lesson)) {
    toast('Этот урок пока закрыт — сначала предыдущий');
    location.replace('#/');
    return;
  }
  if (lesson) {
    screens.map.hidden = true;
    screens.lesson.hidden = false;
    // Урок занимает ровно экран и прокручивается внутри своих панелей. Карта
    // длинная и прокручивается страницей. Разные режимы — разный класс.
    document.body.classList.add('lesson-open');
    // Практикуму Python не нужен: там работа идёт на своей машине.
    if (lesson.kind !== 'lab') runnerConfig.then(bootRunner);
    renderLesson(screens.lesson, lesson, {
      onBack: openMap,
      onOpen: openLesson,
      onProgress: celebrate,
    });
    // Отрисовка создаёт место под кадры пустым — возвращаем в него текущее
    // состояние, иначе перерисовка посреди загрузки стирает картинку.
    paintBoot(runnerStatus);
  } else {
    screens.lesson.hidden = true;
    screens.map.hidden = false;
    document.body.classList.remove('lesson-open');
    renderMap(screens.map, { onOpen: openLesson });
  }
}

/* ---------- шапка ---------- */

function renderHeader() {
  const { level, into, need } = levelInfo();
  $('profileLevel').textContent = level;
  $('xpLabel').textContent = `${into} / ${need} XP`;
  $('xpBar').style.width = `${Math.round((into / need) * 100)}%`;

  const streak = store.state.streak;
  const streakChip = $('streakChip');
  streakChip.hidden = streak.current === 0;
  streakChip.textContent = `🔥 ${streak.current}`;
  streakChip.title = streak.current > 0
    ? `Серия: ${streak.current} дн. подряд, рекорд ${streak.best}`
    : 'Реши задачу сегодня, чтобы начать серию';

}

/* ---------- события прогресса ---------- */

let toastTimer = null;
function toast(message, tone = '') {
  const node = $('toast');
  node.textContent = message;
  node.className = `toast show ${tone}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { node.className = 'toast'; }, 2600);
}

/**
 * Экран после последнего шага. До сих пор человек проходил финал и получал
 * всплывающую подпись на две секунды — а это единственный момент курса,
 * которым хочется похвастаться. И единственный, когда он готов позвать
 * друга: поэтому кнопка здесь одна и она про это.
 */
const QUEST_LINK = 'https://aka-gst.ru/qa-quest/';

function showFinale() {
  const dialog = $('finaleDialog');
  $('finaleText').textContent = activeTheme().finaleText;
  const share = $('finaleShare');
  share.textContent = 'Позвать друга';
  share.onclick = async () => {
    const payload = { title: 'QA Quest — питон с нуля', text: 'Питон прямо в браузере, ставить ничего не надо', url: QUEST_LINK };
    try {
      // На телефоне это открывает обычный лист «поделиться» с телеграмом —
      // самый короткий путь от «мне понравилось» до второго человека.
      if (navigator.share) await navigator.share(payload);
      else {
        await navigator.clipboard.writeText(QUEST_LINK);
        share.textContent = 'Ссылка скопирована';
      }
    } catch (_) { /* человек передумал делиться — это не ошибка */ }
  };
  dialog.showModal();
}

function celebrate(outcome, lesson, task) {
  const parts = [`Задача решена · +${outcome.xp} XP`];
  if (outcome.streakGrew && store.state.streak.current > 1) parts.push(`серия ${store.state.streak.current} дн.`);
  if (outcome.leveledUp) parts.push(`уровень ${levelInfo().level}`);
  if (outcome.tierUnlocked) parts.push('открыта новая ступень');
  toast(parts.join(' · '), 'ok');
  route();

  // Финальный урок у каждой истории свой. Пока здесь стоял 'py-ice', вторая
  // история доходила до конца и не получала ничего — а это единственный
  // момент курса, ради которого её проходят.
  if (lesson.id === activeTheme().finalLesson) showFinale();
}

/* ---------- вход ---------- */

function renderAccount() {
  const button = $('accountButton');
  // Почта необязательна, выводить имя из адреса больше нельзя — только ник.
  button.textContent = auth.status === 'signed' ? auth.nickname : 'Войти';
  button.classList.toggle('signed', auth.status === 'signed');
  const hint = $('progressHint');
  hint.hidden = auth.status !== 'signed';
  hint.textContent = progressHint();
}

/** Коды восстановления показываются один раз — без них дороги назад нет. */
function showRecoveryCodes(codes) {
  const body = clear($('accountBody'));
  body.append(
    el('p', { text: `Готово, ты вошёл как ${auth.nickname}.` }),
    el('p', { class: 'dialog-warn', text: 'Сохрани эти коды прямо сейчас. Они показываются один раз и это единственный способ вернуться в аккаунт, если забудешь пароль: письма сайт не отправляет.' }),
    el('div', { class: 'recovery-codes' }, codes.map((code) => el('code', { text: code }))),
    el('div', { class: 'dialog-actions' }, [
      el('button', {
        class: 'ghost-button',
        onclick: async (event) => {
          try {
            await navigator.clipboard.writeText(codes.join('\n'));
            event.currentTarget.textContent = 'Скопировано';
          } catch (_) {
            event.currentTarget.textContent = 'Выдели и скопируй вручную';
          }
        },
      }, 'Скопировать коды'),
      el('button', { class: 'run-button', onclick: () => { $('accountDialog').close(); route(); } }, 'Я сохранил'),
    ]),
  );
}

function accountDialog(mode = 'login') {
  const dialog = $('accountDialog');
  const body = clear($('accountBody'));

  if (auth.status === 'signed') {
    body.append(
      el('p', { text: `Вы вошли как ${auth.nickname}. Прогресс синхронизируется между устройствами.` }),
      el('button', {
        class: 'run-button',
        onclick: async () => { await logout(); accountDialog(); },
      }, 'Выйти'),
    );
    dialog.showModal();
    return;
  }

  if (auth.status === 'offline') {
    body.append(
      el('p', { text: 'Общий вход aka-gst сейчас недоступен: сервис аккаунтов не отвечает.' }),
      el('p', { class: 'dialog-note', text: 'Прогресс сохраняется в этом браузере и подтянется в аккаунт, когда вход появится.' }),
    );
    dialog.showModal();
    return;
  }

  const error = el('p', { class: 'dialog-error' });
  const nickname = el('input', { type: 'text', placeholder: 'ник', autocomplete: 'username' });
  const password = el('input', {
    type: 'password',
    placeholder: mode === 'recover' ? 'новый пароль, от 12 символов' : 'пароль',
    autocomplete: mode === 'login' ? 'current-password' : 'new-password',
  });

  const run = async (action) => {
    error.textContent = '';
    const result = await action();
    if (!result.ok) {
      error.textContent = result.error;
      return;
    }
    if (result.recoveryCodes && result.recoveryCodes.length) {
      showRecoveryCodes(result.recoveryCodes);
      return;
    }
    dialog.close();
    route();
  };

  if (mode === 'recover') {
    const code = el('input', { type: 'text', placeholder: 'код восстановления', autocomplete: 'off' });
    body.append(
      el('p', { text: 'Введи ник, один из кодов восстановления и новый пароль. Код сработает один раз, а все прежние сессии погаснут.' }),
      nickname, code, password, error,
      el('div', { class: 'dialog-actions' }, [
        el('button', { class: 'run-button', onclick: () => run(() => recover(nickname.value.trim(), code.value.trim(), password.value)) }, 'Восстановить'),
        el('button', { class: 'ghost-button', onclick: () => accountDialog('login') }, 'Назад'),
      ]),
    );
    dialog.showModal();
    return;
  }

  if (mode === 'register') {
    const email = el('input', { type: 'email', placeholder: 'почта — необязательно', autocomplete: 'email' });
    body.append(
      el('p', { text: 'Одна учётная запись на все проекты aka-gst: и на Лилу, и сюда, и на рекорды в играх.' }),
      nickname, password, email,
      el('p', { class: 'dialog-note', text: 'Почта не обязательна и никуда не отправляется — письма сайт пока не шлёт. Вместо них после регистрации выдаются коды восстановления.' }),
      error,
      el('div', { class: 'dialog-actions' }, [
        el('button', { class: 'run-button', onclick: () => run(() => register(nickname.value.trim(), password.value, email.value.trim())) }, 'Создать аккаунт'),
        el('button', { class: 'ghost-button', onclick: () => accountDialog('login') }, 'У меня есть аккаунт'),
      ]),
    );
    dialog.showModal();
    return;
  }

  body.append(
    el('p', { text: 'Одна учётная запись на все проекты aka-gst: и на Лилу, и сюда, и на рекорды в играх.' }),
    nickname, password, error,
    el('div', { class: 'dialog-actions' }, [
      el('button', { class: 'run-button', onclick: () => run(() => login(nickname.value.trim(), password.value)) }, 'Войти'),
      el('button', { class: 'ghost-button', onclick: () => accountDialog('register') }, 'Создать аккаунт'),
    ]),
    el('button', { class: 'text-button dialog-link', onclick: () => accountDialog('recover') }, 'Забыл пароль'),
  );
  dialog.showModal();
}

/* ---------- старт ---------- */

loadStore();
subscribe(renderHeader);

$('accountButton').addEventListener('click', () => accountDialog());
$('closeDialog').addEventListener('click', () => $('accountDialog').close());
$('finaleClose').addEventListener('click', () => $('finaleDialog').close());
$('rigClose').addEventListener('click', () => $('rigDialog').close());
// Тело помечается историей: фон и мелочи оформления у них разные, а держать
// это в CSS дешевле, чем подменять картинки из кода.
document.body.classList.add(`theme-${activeTheme().id}`);

// Экран победы принадлежит истории, а не сайту. Пока картинки для второй
// истории нет, остаётся общая — это лучше, чем битая ссылка на месте награды.
{
  const art = activeTheme().art;
  const image = $('finaleImage');
  if (art && art.finale) {
    image.addEventListener('error', () => { image.src = 'finale.jpg'; }, { once: true });
    image.src = art.finale;
    image.alt = art.finaleAlt || '';
  }
}

/*
 * Переключатель истории стоит рядом с переключателем режима и выглядит так же.
 * Раньше это была строчка в служебном ряду, и она читалась как настройка —
 * человек не понимал, что за ней стоит другой мир целиком. Выбор мира по весу
 * не меньше выбора режима, значит и на вид должен быть таким же.
 */
{
  const current = activeTheme();
  const group = $('storySwitch');
  THEMES.forEach((theme) => {
    const active = theme.id === current.id;
    const button = el('button', {
      type: 'button',
      class: active ? 'active' : '',
      'aria-pressed': String(active),
      title: active ? 'Сейчас ты здесь' : `${theme.hook}. Прогресс этой истории сохранится`,
      onclick: () => { if (!active) setTheme(theme.id); },
    }, theme.name);
    group.append(button);
  });
  $('brandStory').textContent = current.brandLine;
}

$('resetProgress').addEventListener('click', () => {
  if (confirm('Сбросить весь прогресс, XP и сохранённый код?')) {
    resetProgress();
    openMap();
    route();
  }
});

/*
 * Кадры загрузки. Тринадцать мегабайт Python качаются один раз, и это самое
 * опасное место курса: человек ждёт на пустом экране, ещё не увидев ни строчки
 * кода. Кадры превращают ожидание в начало истории — приборная панель
 * просыпается, лампа за лампой. Место выбрано так, чтобы ничего не заслонять:
 * терминал в это время всё равно пуст, а текст задачи читается рядом.
 */
let bootTimer = null;
let bootStep = 0;
/* Последнее состояние движка держим у себя. Экран урока перерисовывается не
   только при открытии: практикумы и проверка входа приходят с опозданием в
   секунду и вызывают route() заново. Кадры при этом создавались пустыми и
   больше не появлялись — картинка моргала и исчезала посреди загрузки, хотя
   Python ещё качался. Теперь после каждой отрисовки состояние применяется
   заново, а номер кадра переживает перерисовку. */
let runnerStatus = 'idle';

function paintBoot(status) {
  const frames = activeTheme().art?.boot || [];
  const holder = document.querySelector('.boot-visual');
  if (!holder) return;
  const image = holder.querySelector('img');
  // Показываем, пока Python не готов, а не только в состоянии «загружается».
  // Прежнее условие было точнее, чем нужно: любое промежуточное состояние
  // прятало кадры до конца закачки — картинка появлялась и пропадала, хотя
  // качать оставалось ещё десяток мегабайт.
  if (!frames.length || status === 'ready' || status === 'failed') {
    holder.hidden = true;
    clearInterval(bootTimer);
    bootTimer = null;
    return;
  }
  image.alt = activeTheme().art.bootAlt || '';
  image.src = frames[Math.min(bootStep, frames.length - 1)];
  holder.hidden = false;
  if (bootTimer) return;
  // Кадры сменяются по времени, а не по доле скачанного: доля приходит
  // рывками и на быстрой сети проскочила бы всю последовательность разом.
  // Тик не только меняет кадр, но и возвращает место на экран. Экран урока
  // перерисовывают четыре разных события, и каждое создаёт место пустым и
  // скрытым; вместо того чтобы ловить их поимённо, чиним состояние раз в
  // полторы секунды. Дешевле и надёжнее, чем помнить все точки перерисовки.
  bootTimer = setInterval(() => {
    bootStep = Math.min(bootStep + 1, frames.length - 1);
    const live = document.querySelector('.boot-visual');
    if (!live) return;
    live.hidden = false;
    const img = live.querySelector('img');
    if (img) img.src = frames[bootStep];
  }, 1400);
}

onRunnerChange((state) => {
  runnerStatus = state.status;
  paintBoot(runnerStatus);
  const chip = $('pythonChip');
  chip.dataset.status = state.status;
  chip.textContent = {
    idle: 'Python: не загружен',
    loading: state.message || 'Python: загружается',
    ready: `Python ${state.version || ''}`.trim(),
    failed: 'Python недоступен',
  }[state.status];
});

onAuthChange(renderAccount);
window.addEventListener('hashchange', route);
route();

// Практикумы ступеней 2 и 3 подтягиваются из course.json. Если их нет рядом,
// ступени остаются с одним тренажёром — страница от этого не ломается.
loadPracticums().then(({ imported }) => {
  if (imported) route();
});

// Вход подтянет серверный прогресс, и карту придётся перерисовать.
probeAuth().then((state) => {
  if (state.status === 'signed') route();
});
