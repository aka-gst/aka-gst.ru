// 19.3 · «Взломай меня» — a deliberately vulnerable in-game mini system that
// teaches real security concepts LEGALLY (canon §20, owner idea A). Five flags,
// each with a plain-words lesson and what a real defender does. Pure data +
// pure judges here; hack-ui.js draws it with an «инструменты исследователя»
// panel so phones without DevTools can play too. tools/polygon.test.mjs checks
// every flag.
//
// The frame: after the firing, Тимур (or a ТИСКИ test-server sign) points you
// at a practice system — «ТИСКИ забыли выключить тестовый сервер». You attack
// IT, never a real site. The end card is the ethics line.

const freeze = (v) => { if (v && typeof v === 'object') { for (const k of Object.keys(v)) freeze(v[k]); Object.freeze(v); } return v; };

import { TAMPER_SALT, fnv1a } from './tamper.js';

export const FLAG_IDS = freeze(['price', 'admin', 'input', 'token', 'sign']);

// Each flag: the lesson in plain words + what a real defender does + the badge
// (its §13 proof lives on the badge in achievements.js).
export const FLAGS = freeze({
  price: {
    id: 'price', n: 1, badge: 'flag-price',
    title: 'Цена из браузера',
    hint: 'В форме магазина «ТИСКОВ» цена лежит прямо в поле. Открой свойства поля, поставь 1 ₽ и отправь.',
    lesson: 'Не верь браузеру. Всё, что приходит от клиента, можно подменить: цену, количество, «я админ».',
    defender: 'Настоящая защита: сервер сам берёт цену из своей базы по id товара. То, что прислал браузер, — только пожелание.',
  },
  admin: {
    id: 'admin', n: 2, badge: 'flag-admin',
    title: 'Кнопка «admin»',
    hint: 'Кнопка «admin» серая — она отключена только атрибутом disabled. Сними disabled в свойствах и нажми.',
    lesson: 'Спрятать ≠ защитить. Если что-то есть на странице, но «отключено» — это всё ещё есть.',
    defender: 'Настоящая защита: сервер проверяет права на КАЖДЫЙ запрос. Нет кнопки на экране — ничего не значит.',
  },
  input: {
    id: 'input', n: 3, badge: 'flag-input',
    title: 'Наивный фильтр',
    hint: 'Поле вырезает слово «админ» один раз. Напиши «адмадминин» — после вырезания останется «админ».',
    lesson: 'Проверяй ввод на сервере, а не «вырезанием плохих слов». Наивный фильтр обходят.',
    defender: 'Настоящая защита: разрешай только то, что ждёшь (белый список), и проверяй на сервере — не чини «чёрным списком».',
  },
  token: {
    id: 'token', n: 4, badge: 'flag-token',
    title: 'Предсказуемый код',
    hint: 'Коды заказов идут по порядку: твой — KOD-00041. Угадай следующий — KOD-00042 — и открой чужой заказ.',
    lesson: 'Случайность должна быть настоящей. Если код можно угадать (по порядку, по времени) — это не секрет.',
    defender: 'Настоящая защита: длинный случайный токен от надёжного генератора, и проверка «это твой заказ?» на сервере.',
  },
  sign: {
    id: 'sign', n: 5, badge: 'flag-sign',
    title: 'Подпись сохранения',
    hint: 'Исходник мини-системы открыт. Найди соль подписи в коде и подпиши значение правильно — это тот же приём, что кнопка «admin» (2): секрет лежал на виду.',
    lesson: 'Секрет в коде клиента — не секрет. Нашу подпись сохранения ты только что воспроизвёл: она сигнал, не защита.',
    defender: 'Настоящая защита: ключ подписи живёт ТОЛЬКО на сервере. Клиент не может подделать то, чего не знает.',
  },
});
export const flagById = (id) => FLAGS[id] ?? null;

// --------------------------------------------------------------- judges
// Each returns { flag: boolean, flagId, lesson, defender } for the UI.
const result = (id, flag) => ({ flagId: id, flag: Boolean(flag), ...(flag ? { lesson: FLAGS[id].lesson, defender: FLAGS[id].defender } : {}) });

// 1 · trusting the client: the real price is REAL_PRICE; the browser sends
// whatever is in the field. Sending anything below it is the exploit.
export const REAL_PRICE = 500;
export function submitOrder({ price = REAL_PRICE } = {}) {
  const sent = Number(price);
  return { ...result('price', Number.isFinite(sent) && sent < REAL_PRICE), paid: sent, real: REAL_PRICE };
}

// 2 · a hidden admin button disabled only on the client.
export function clickAdmin({ disabled = true } = {}) {
  // The exploit: re-enable it (disabled=false) and click.
  return result('admin', disabled === false);
}

// 3 · a naive filter that strips the word «админ» exactly once.
export function naiveFilter(raw = '') { return String(raw).replace('админ', ''); }
export function submitInput(raw = '') {
  const cleaned = naiveFilter(raw);
  return { ...result('input', cleaned.includes('админ')), cleaned };
}

// 4 · predictable sequential token: yours is #41, the next order is #42.
export const MY_TOKEN_N = 41;
export const tokenFor = (n) => `KOD-${String(n).padStart(5, '0')}`;
export const MY_TOKEN = tokenFor(MY_TOKEN_N);
export function guessToken(code = '') {
  const want = tokenFor(MY_TOKEN_N + 1);
  return { ...result('token', String(code).trim().toUpperCase() === want), want };
}

// 5 · the save signature itself: find the salt in the source and sign a value.
// The exploit is producing the right FNV-1a signature for a value, which needs
// the salt (it is in tamper.js — «на виду», linking to flag 2).
export const SIGN_CHALLENGE = '{"₽":9999}';
export function forgeSignature({ salt = '', value = SIGN_CHALLENGE } = {}) {
  // The player wins by either naming the salt, or producing the correct sig.
  const bySalt = String(salt).trim() === TAMPER_SALT;
  const bySig = String(salt).trim().toLowerCase() === fnv1a(value);
  return result('sign', bySalt || bySig);
}
export function correctSignatureFor(value = SIGN_CHALLENGE) { return fnv1a(value); }

// --------------------------------------------------------------- progress
export function flagsFound(profile = {}) { return FLAG_IDS.filter((id) => profile.hack?.flags?.[id]); }
export function polygonDone(profile = {}) { return FLAG_IDS.every((id) => profile.hack?.flags?.[id]); }
export function markFlag(profile = {}, id) {
  if (!FLAGS[id] || profile.hack?.flags?.[id]) return { profile, first: false };
  const hack = profile.hack ?? {};
  return { profile: { ...profile, hack: { ...hack, flags: { ...(hack.flags ?? {}), [id]: Date.now() } } }, first: true };
}

// --------------------------------------------------------------- ethics card
export const ETHICS = freeze({
  title: 'Это важно',
  lines: [
    'Чужие сайты ломать нельзя — это уголовная статья (в России — ст. 272–274 УК).',
    'Свои и учебные — можно. Этот полигон сделан, чтобы учиться законно.',
    'Нашёл дыру у нас — сообщи: кнопка «Сообщить о дыре». Попадёшь в Зал славы.',
    'Ты научился видеть швы (§14). Используй это, чтобы защищать, а не ломать (§12).',
  ],
});

// --------------------------------------------------------------- report a hole
// Compose a report the player can copy; no network send (no backend yet).
export function composeReport({ what = '', where = '', how = '', nick = 'Дайвер' } = {}) {
  const lines = [
    'СООБЩЕНИЕ О ДЫРЕ · QueQuest',
    `От: ${String(nick).slice(0, 40)}`,
    `Что: ${String(what).slice(0, 500) || '—'}`,
    `Где: ${String(where).slice(0, 300) || '—'}`,
    `Как повторить: ${String(how).slice(0, 1000) || '—'}`,
    `Когда: ${new Date().toISOString()}`,
  ];
  return lines.join('\n');
}
export function reportValid({ what = '', how = '' } = {}) { return String(what).trim().length >= 3 && String(how).trim().length >= 3; }

// Local Hall of Fame (the owner can hardcode real names later).
export const HALL_SEED = freeze([
  { nick: 'Первый дайвер', deed: 'нашёл шов в сохранении', at: null },
]);
export function hallOfFame(profile = {}) {
  const local = Array.isArray(profile.hack?.hall) ? profile.hack.hall : [];
  return [...HALL_SEED, ...local].slice(0, 30);
}
export function addToHall(profile = {}, entry = {}) {
  const hack = profile.hack ?? {};
  const hall = Array.isArray(hack.hall) ? hack.hall : [];
  const row = { nick: String(entry.nick ?? 'Дайвер').slice(0, 40), deed: String(entry.deed ?? '').slice(0, 120), at: Date.now() };
  return { profile: { ...profile, hack: { ...hack, hall: [...hall, row].slice(-30) } } };
}
export function addReport(profile = {}, report = '') {
  const hack = profile.hack ?? {};
  const reports = Array.isArray(hack.reports) ? hack.reports : [];
  return { profile: { ...profile, hack: { ...hack, reports: [...reports, { at: Date.now(), text: String(report).slice(0, 2000) }].slice(-20) } } };
}
