/*
 * Клиент общего аккаунта aka-gst.
 *
 * Вход у сайта один и живёт на уровне сайта (Zakriva/ops/accounts), а не
 * внутри проекта: кука aka_auth выставлена с Path=/ и обслуживает и Лилу,
 * и QA Quest. Пока сервис недоступен, страница продолжает работать без входа
 * и хранит прогресс в браузере — ни один урок от этого не ломается.
 *
 * Логин — ник и пароль; почта необязательна, потому что почтовой доставки на
 * сервере нет. Запасной вход — коды восстановления, выданные при регистрации.
 */

import { store, mergeState, attachRemote } from './store.js';

const API = (window.QA_QUEST_API || '').replace(/\/$/, '');
const PROGRESS_SCOPE = 'qa-quest';

export const auth = {
  status: 'unknown',   // unknown | offline | guest | signed
  id: null,
  nickname: null,
  email: null,
  verified: false,
};

/** Общая часть ответа сервиса о вошедшем: одна форма на все три эндпоинта. */
function signedIn(payload) {
  return {
    status: 'signed',
    id: payload.id || null,
    nickname: payload.nickname || null,
    email: payload.email || null,
    verified: Boolean(payload.email_verified),
  };
}

const GUEST = { status: 'guest', id: null, nickname: null, email: null, verified: false };

const listeners = new Set();

export function onAuthChange(callback) {
  listeners.add(callback);
  callback(auth);
  return () => listeners.delete(callback);
}

function emit(patch) {
  Object.assign(auth, patch);
  listeners.forEach((callback) => callback(auth));
}

async function api(path, options = {}) {
  const response = await fetch(`${API}/api${path}`, {
    credentials: 'include',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    ...options,
  });
  let payload = {};
  try {
    payload = await response.json();
  } catch (_) { /* сервер ответил не-JSON */ }
  return { ok: response.ok, status: response.status, payload };
}

/** Один запрос решает, показывать ли вход вообще. */
export async function probeAuth() {
  try {
    const { ok, payload } = await api('/auth/me');
    if (!ok) throw new Error('нет сервиса аккаунтов');
    if (payload.authenticated) {
      emit(signedIn(payload));
      await pullProgress();
    } else {
      emit({ ...GUEST });
    }
  } catch (_) {
    emit({ ...GUEST, status: 'offline' });
  }
  return auth;
}

export async function login(nickname, password) {
  const { ok, status, payload } = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ nickname, password }),
  });
  if (!ok) {
    return { ok: false, error: status === 429 ? 'Слишком много попыток. Подожди немного.' : 'Неверный ник или пароль.' };
  }
  emit(signedIn(payload));
  await pullProgress();
  return { ok: true };
}

export async function register(nickname, password, email) {
  if (String(password).length < 12) {
    return { ok: false, error: 'Пароль должен быть не короче 12 символов.' };
  }
  const body = { nickname, password };
  if (email) body.email = email;
  const { ok, status, payload } = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!ok) {
    const errors = {
      409: 'Такой ник уже занят.',
      400: 'Ник должен быть от 3 до 24 символов: буквы, цифры, пробел, дефис.',
      429: 'Слишком много регистраций. Попробуй позже.',
    };
    return { ok: false, error: errors[status] || 'Не получилось создать аккаунт.' };
  }
  // Регистрация сразу открывает сессию, подтверждать нечего.
  emit(signedIn(payload));
  await pullProgress();
  return { ok: true, recoveryCodes: payload.recovery_codes || [] };
}

/** Единственный путь назад в аккаунт: почты для письма со ссылкой нет. */
export async function recover(nickname, code, newPassword) {
  if (String(newPassword).length < 12) {
    return { ok: false, error: 'Новый пароль должен быть не короче 12 символов.' };
  }
  const { ok, status, payload } = await api('/auth/recover', {
    method: 'POST',
    body: JSON.stringify({ nickname, recovery_code: code, new_password: newPassword }),
  });
  if (!ok) {
    return { ok: false, error: status === 429 ? 'Слишком много попыток. Подожди немного.' : 'Ник или код не подошли.' };
  }
  emit(signedIn(payload));
  await pullProgress();
  return { ok: true, codesLeft: payload.codes_left };
}

export async function verify(token) {
  const { ok } = await api('/auth/verify', { method: 'POST', body: JSON.stringify({ token }) });
  if (!ok) return { ok: false, error: 'Ссылка подтверждения не подошла.' };
  await probeAuth();
  return { ok: true };
}

export async function logout() {
  await api('/auth/logout', { method: 'POST' });
  emit({ ...GUEST });
}

/* ---------- прогресс на сервере ---------- */

/**
 * Эндпоинт общего сервиса аккаунтов, см. docs/shared-account.md.
 * До его появления pull/push тихо ничего не делают.
 */
async function pullProgress() {
  const { ok, payload } = await api(`/progress/${PROGRESS_SCOPE}`);
  if (ok && payload && payload.state) mergeState(payload.state);
}

let pushTimer = null;
function pushProgress(state) {
  if (auth.status !== 'signed') return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    api(`/progress/${PROGRESS_SCOPE}`, {
      method: 'PUT',
      body: JSON.stringify({ state, updatedAt: state.updatedAt }),
    }).catch(() => { /* сеть пропала — прогресс уже лежит в localStorage */ });
  }, 1500);
}

attachRemote({ push: pushProgress });

export function progressHint() {
  if (auth.status === 'signed') return `Прогресс сохраняется в аккаунте ${auth.nickname}`;
  if (auth.status === 'guest') return 'Войди, чтобы прогресс не терялся при смене устройства';
  return 'Прогресс сохраняется в этом браузере';
}

export { store };
