// 19.3 · ТИСКИ-security hack awareness (canon §20, owner idea A). Playful,
// never punishing, never destructive: if a kid who learned from the game tries
// to hack the game itself, the game anticipates it, notices, and jokes — then
// restores and hands out a secret badge.
//
// This module is PURE rules + a tiny runtime seam. tools/tamper.test.mjs
// checks signing, tamper detection WITHOUT false positives for legit flows
// (upgrades, merges, migration), impossible-value rules, and context detection.
//
// NB: the save signature is a GAME SIGNAL, not security. The salt is in the
// code; anyone can read it. The point is to teach «швы» (§14) and to notice,
// warmly, that a learner reached into the code — not to lock anyone out.

const freeze = (v) => { if (v && typeof v === 'object') { for (const k of Object.keys(v)) freeze(v[k]); Object.freeze(v); } return v; };

export const TAMPER_SALT = 'ГЛУБИНА·ТИСКИ·19·3';

// FNV-1a 32-bit over the string + the in-code salt. Light on purpose.
export function fnv1a(str = '') {
  let h = 2166136261 >>> 0;
  const bytes = new TextEncoder().encode(String(str) + TAMPER_SALT);
  for (const b of bytes) { h ^= b; h = Math.imul(h, 16777619) >>> 0; }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// A signed envelope around any JSON value: { v, sig, data }.
export const SIGN_VERSION = 1;
export function sign(data) {
  const json = JSON.stringify(data);
  return { v: SIGN_VERSION, sig: fnv1a(json), data };
}
// Verify an envelope. { ok, data, reason }.
export function verify(env) {
  if (!env || typeof env !== 'object' || env.v !== SIGN_VERSION || typeof env.sig !== 'string') {
    return { ok: false, data: env?.data ?? null, reason: 'no-signature' };
  }
  const json = JSON.stringify(env.data);
  if (fnv1a(json) !== env.sig) return { ok: false, data: env.data, reason: 'bad-signature' };
  return { ok: true, data: env.data, reason: null };
}
export const isSigned = (env) => Boolean(env && typeof env === 'object' && env.v === SIGN_VERSION && typeof env.sig === 'string');

// --------------------------------------------------------- impossible values
// A profile that no sequence of events could have produced. Each hit names the
// deed, so the in-world line can be specific.
export const POWER_MAX = 100;
export function impossibleReasons(profile = {}, { now = Date.now() } = {}) {
  const out = [];
  // Negative money (passed in via facts.wage — checked by the caller too).
  if (Number.isFinite(profile.__wage) && profile.__wage < 0) out.push('money');
  // XP below the floor its ledger already earned (someone trimmed the ledger
  // but left a big xp), or an XP jump far beyond any ledger (self-granted).
  const ledger = Object.values(profile.awards ?? {}).reduce((s, v) => s + Math.max(0, Number(v) || 0), 0);
  const legacy = Math.max(0, Number(profile.legacyXp) || 0);
  const xp = Number(profile.xp) || 0;
  if (xp < 0) out.push('xp-negative');
  // Accept legacy top-ups (account totals), so only a gross mismatch counts.
  if (xp > legacy + ledger + 200000) out.push('xp-jump');
  // A mastery floor above the top stage, or a proof dated in the future.
  for (const [skill, entry] of Object.entries(profile.mastery ?? {})) {
    for (const w of ['tap', 'knobs', 'code', 'raw']) if ((Number(entry?.ways?.[w]) || 0) > 5) { out.push('stage'); break; }
    for (const pr of entry?.proofs ?? []) if (Number(pr?.at) > now + 86400000) { out.push('future-proof'); break; }
    void skill;
  }
  // A power over 100 anywhere a card snapshot kept one.
  for (const v of profile.card?.powers ?? []) if (Number(v) > POWER_MAX) { out.push('power'); break; }
  return [...new Set(out)];
}
export function isImpossible(profile, opts) { return impossibleReasons(profile, opts).length > 0; }

// --------------------------------------------------------------- in-world lines
// What «ТИСКИ»-security / the game's AI say. Warm, never scolding.
export const MESSAGES = freeze({
  seam: {
    kicker: 'ТИСКИ-SECURITY',
    title: 'Подпись не сошлась',
    text: 'Ого. Ты поправил себе сохранение руками. Подпись не сошлась — мы это предусмотрели. Вернули как было. Но респект: ты нашёл шов.',
    badge: 'seam-found',
  },
  impossible: {
    kicker: 'ТИСКИ-SECURITY',
    title: 'Слишком хорошо',
    text: 'Такого числа быть не может — ни одно событие игры столько не даёт. Вернули как было. Хочешь так уметь по-честному? Это профессия.',
    badge: 'too-good',
  },
  forger: {
    kicker: 'ТИСКИ-SECURITY',
    title: 'Код не сошёлся',
    text: 'Код друга подделан — контрольная сумма не сходится. Почти получилось! Но подпись мы считаем. Фальшивомонетчик (почти).',
    badge: 'forger',
  },
  autoclicker: {
    kicker: 'ТИСКИ-SECURITY',
    title: 'Автокликер? Мы видим',
    text: 'Ответы быстрее человека. Автокликер? Мы видим — этот бой не в зачёт. Хочешь написать бота честно? Это профессия «Тренер ИИ» / «Инженер».',
    badge: 'autoclicker',
  },
  underHood: {
    kicker: 'ТИСКИ-SECURITY',
    title: 'Смотрю под капот',
    text: 'Ты позвал отладку из консоли. Нормально — тут можно. Ты на этаже С НУЛЯ (§13). Смотри под капот сколько хочешь: это наш полигон.',
    badge: 'under-hood',
  },
  serverRejected: {
    kicker: 'ТИСКИ-SECURITY',
    title: 'Сервер тоже не дурак',
    text: 'Сервер отклонил карточку: он проверяет её сам. Спрятать на клиенте мало — настоящая проверка всегда на сервере.',
    badge: null,
  },
});
export const serverRejectText = (error) => {
  const base = MESSAGES.serverRejected.text;
  if (error === 'card_too_large') return 'Сервер отклонил карточку: слишком большая. Он считает размер сам — браузеру тут не верят.';
  if (error === 'bad_card' || error === 'card_too_complex') return base;
  return base;
};

// --------------------------------------------------------------- inhuman duel
// A human can't answer in <150 ms repeatedly, nor before the task rendered.
export const HUMAN_FLOOR_MS = 150;
export function inhumanAnswer({ ms = 999, renderedAt = 0, answeredAt = 0 } = {}) {
  if (renderedAt && answeredAt && answeredAt < renderedAt) return true; // before it drew
  return Number(ms) >= 0 && Number(ms) < HUMAN_FLOOR_MS;
}
// Repeatedly (3+ in a match) inhuman → the duel doesn't count for proofs.
export function duelLooksAutomated(perRound = []) {
  return perRound.filter((r) => inhumanAnswer(r)).length >= 3;
}
// A single very-fast-but-human answer that still earns the «speedrun» badge:
// fast (sub-second) but not inhuman.
export function isHonestSpeedrun({ ms = 9999, renderedAt = 0, answeredAt = 0 } = {}) {
  return Number(ms) >= HUMAN_FLOOR_MS && Number(ms) < 1000 && !(renderedAt && answeredAt && answeredAt < renderedAt);
}

// -------------------------------------------------------------- test context
// e2e and automation drive the game through debug hooks; stay silent there, so
// the existing suites keep working. A real console poke is still noticed.
export function isAutomationContext({ nav = globalThis.navigator, search = globalThis.location?.search ?? '' } = {}) {
  try {
    if (nav?.webdriver) return true;
    const q = new URLSearchParams(search);
    return q.has('e2e') || q.has('debug') || q.has('test') || q.has('automation');
  } catch { return false; }
}

// --------------------------------------------------------------- console greeting
export const GLUBINA_ASCII = [
  '  ╔═╗ ╦  ╦ ╦═╗ ╦ ╔╗╔ ╔═╗',
  '  ║ ╦ ║  ║ ╠╩╗ ║ ║║║ ╠═╣   ·  ГЛУБИНА',
  '  ╚═╝ ╩═╝╩ ╩═╝ ╩ ╝╚╝ ╩ ╩',
].join('\n');
export const GREETING = 'Привет, дайвер. Раз ты здесь — ты уже на этаже С НУЛЯ. Ломать можно только этот полигон. Чужие сайты — нельзя (это не шутка, это статья). Нашёл дыру у нас — жми «Сообщить о дыре».';

// Print the greeting once (styled). This one is friendly and always shows —
// it's the welcome, not a notice. The hack NOTICES (tamper, inhuman duel,
// under-the-hood) are the parts that stay silent in automation.
export function consoleGreeting({ console: c = globalThis.console, win = globalThis } = {}) {
  if (win.__QQ_GREETED__) return false;
  win.__QQ_GREETED__ = true;
  try {
    c.log(`%c${GLUBINA_ASCII}`, 'color:#64e9ff;font-family:monospace;font-weight:bold');
    c.log(`%c${GREETING}`, 'color:#ffc857;font-size:13px');
  } catch { return false; }
  return true;
}

// --------------------------------------------------------------- signed save
// Wrap the two localStorage reads/writes the game trusts (the campus profile
// and its snapshot). We keep a SHADOW copy of the last good signed value, so a
// tamper can be rolled back to exactly what was there before.
export const SHADOW_SUFFIX = '.sig';
export function readSigned(storage, key, { legacyValid = () => true } = {}) {
  let raw = null, shadow = null;
  try { raw = storage?.getItem(key); } catch { raw = null; }
  try { shadow = storage?.getItem(key + SHADOW_SUFFIX); } catch { shadow = null; }
  if (raw == null) return { ok: true, value: null, tampered: false, migrated: false };
  let parsed = null; try { parsed = JSON.parse(raw); } catch { parsed = null; }
  // A signed envelope: verify it.
  if (isSigned(parsed)) {
    const v = verify(parsed);
    if (v.ok) return { ok: true, value: v.data, tampered: false, migrated: false };
    // Bad signature: restore the shadow if we have a good one.
    let shadowData = null; try { shadowData = JSON.parse(shadow ?? 'null'); } catch { shadowData = null; }
    const sv = isSigned(shadowData) ? verify(shadowData) : { ok: false };
    return { ok: false, value: sv.ok ? sv.data : v.data, tampered: true, migrated: false, reason: v.reason };
  }
  // Unsigned (an older build's save, or a hand-import): accept once if it is
  // valid for its format, and re-sign on the next write (migration path). This
  // is why a legit upgrade NEVER false-positives.
  const okLegacy = (() => { try { return legacyValid(parsed); } catch { return true; } })();
  return { ok: true, value: parsed, tampered: false, migrated: okLegacy, legacyRaw: raw };
}
// A SIDE signature: the value at `key` stays plain JSON (the akkaunty adapter
// reads/writes it raw), and we keep its checksum and a shadow copy in two
// sibling keys. This is how the campus profile is watched without changing its
// format. sideCheck is the one the game calls on load.
export const SIG_KEY = (key) => `${key}.sig`;
export const SHADOW_KEY = (key) => `${key}.shadow`;
export function sideSign(storage, key, json) {
  try { storage?.setItem(SIG_KEY(key), fnv1a(json)); storage?.setItem(SHADOW_KEY(key), json); } catch { /* private mode */ }
}
// Returns { status: 'ok' | 'unsigned' | 'tampered', shadow }. 'unsigned' is the
// migration path: an older save with no signature yet — caller signs it once,
// so a legit upgrade never false-positives.
export function sideCheck(storage, key, json) {
  let sig = null, shadow = null;
  try { sig = storage?.getItem(SIG_KEY(key)); shadow = storage?.getItem(SHADOW_KEY(key)); } catch { /* private mode */ }
  if (sig == null) return { status: 'unsigned', shadow };
  if (json == null) return { status: 'ok', shadow };
  if (fnv1a(json) === sig) return { status: 'ok', shadow };
  // Only trust the shadow if its own checksum still matches the stored sig.
  const shadowOk = shadow != null && fnv1a(shadow) === sig;
  return { status: 'tampered', shadow: shadowOk ? shadow : null };
}

export function writeSigned(storage, key, data) {
  const env = sign(data);
  const json = JSON.stringify(env);
  try { storage?.setItem(key, json); } catch { /* private mode */ }
  try { storage?.setItem(key + SHADOW_SUFFIX, json); } catch { /* private mode */ }
  return env;
}
