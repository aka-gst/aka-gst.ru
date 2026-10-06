// 19.2 · QueQuest ↔ the site's shared accounts service (/akkaunty, game
// `quequest`). The game has NO login of its own: this file only talks to the
// owner's service through its SDK (client/akkaunty.js) and plugs it into the
// one seam the game has for accounts — window.QQ_PROFILE_ADAPTER, read by
// profile-store.js (docs/PROFILE-ADAPTER.md, canon §19).
//
// Rules (owner, 2026-10-06):
//   · the account is an OPTIONAL layer. A guest plays on localStorage, and
//     with no network / no service the game silently stays a guest;
//   · the adapter is active only on aka-gst.ru (or ?akk=1, or
//     window.QQ_AKK_BASE). Anywhere else (claude.ai artifact, file://) it is
//     not installed at all;
//   · the service may not be deployed yet: nothing is shown (no «ВОЙТИ»)
//     until GET <base>/me answers JSON {ok…}/{gost…}; we re-probe slowly
//     (every 10 min, on focus after 3 min) and light up by ourselves;
//   · localStorage first (the campus profile + a per-account cache), then
//     A.save('quequest', snapshot, ver) keeping `ver`; on 409 load, merge
//     (grows only), save once more;
//   · the first login MERGES the guest progress into the account; logout
//     gives the browser back to the guest it was before.
//
// Everything here is plain functions over an injected SDK / storage / timers,
// so tools/akkaunty-adapter.test.mjs drives it with a fake SDK.

import { profileSnapshot, applySnapshot, validSnapshot, compactSnapshot, mergeSnapshots, snapshotBytes, SNAPSHOT_BUDGET } from './profile-store.js';
import { createCampusProfile, CAMPUS_PROFILE_KEY } from './campus-profile.js?v=campus-profile-7';
import { cleanNick } from './diver-card.js';
import { sideSign } from './tamper.js';

export const IGRA = 'quequest';
export const SAVE_LIMIT = 65536;
export const OWNER_KEY = 'quequest.akk.owner';          // whose progress is in this browser (account id)
export const GUEST_KEY = 'quequest.akk.guest';          // the guest profile from before the first login
export const CACHE_KEY = (id) => `quequest.akk.cache.${String(id).replace(/[^\w.-]/g, '_').slice(0, 64)}`;
export const SHOW_CARD_KEY = 'quequest.akk.showCard';   // opt-in: my public card for my class
const PROBE_EVERY = 10 * 60 * 1000;
const PROBE_ON_FOCUS = 3 * 60 * 1000;

// Where is the service? null = not here (the adapter stays out).
export function akkauntyBase({ location = globalThis.location, win = globalThis } = {}) {
  try {
    if (typeof win?.QQ_AKK_BASE === 'string' && win.QQ_AKK_BASE) return win.QQ_AKK_BASE.replace(/\/$/, '');
    const q = new URLSearchParams(location?.search ?? '');
    if (q.get('akk') === '0' || q.get('store') === 'local') return null;
    if (q.get('akk') === '1') return '/akkaunty';
    const host = String(location?.hostname ?? '');
    if (host === 'aka-gst.ru' || host.endsWith('.aka-gst.ru')) return '/akkaunty';
  } catch { /* no location: not a page */ }
  return null;
}

// Default in-game nick for a new account: «Дайвер-<4 знака anon>».
export function defaultNick(anon = '') {
  const tail = String(anon).replace(/[^A-Za-z0-9]/g, '').slice(0, 4) || '0000';
  return cleanNick(`Дайвер-${tail}`);
}

// Russian words for the service's error codes (README_RU / src/app.js).
export const NICK_RULE = 'Ник для входа: 3–32 знака — буквы, цифры, _ . - (большие буквы станут маленькими).';
export const PASSWORD_RULE = 'Пароль: от 10 до 128 знаков и не такой же, как ник.';
const SERVICE_NICK = /^[\p{L}\p{N}_.-]{3,32}$/u;
export function checkLogin(nick, password) {
  const n = String(nick ?? '').normalize('NFKC').trim().toLowerCase();
  if (!SERVICE_NICK.test(n)) return NICK_RULE;
  const pw = String(password ?? '');
  if (pw.length < 10 || pw.length > 128 || pw.toLowerCase() === n) return PASSWORD_RULE;
  return null;
}
export function errorText(code) {
  return ({
    offline: 'Нет связи с сервисом входа. Играй дальше — прогресс сохраняется в браузере.',
    bad_response: 'Сервис входа ответил что-то непонятное. Попробуй позже — игра сохраняет в браузер.',
    bad_credentials: 'Неверный ник или пароль.',
    nick_taken: 'Такой ник для входа уже занят — придумай другой.',
    weak_password: PASSWORD_RULE,
    bad_nick: NICK_RULE,
    already_logged_in: 'Ты уже вошёл. Чтобы войти другим аккаунтом, сначала выйди.',
    too_many_attempts: 'Слишком много неудачных попыток. Подожди 15 минут.',
    too_many_requests: 'Слишком много запросов. Подожди немного и попробуй снова.',
    passkey_unsupported: 'Этот браузер не умеет passkey. Войди через Google или по нику и паролю.',
    cancelled: 'Вход отменён.',
    verify_failed: 'Ключ не прошёл проверку. Попробуй ещё раз.',
    bad_challenge: 'Время на вход вышло. Попробуй ещё раз.',
    credential_exists: 'Этот ключ уже привязан.',
    google_disabled: 'Вход через Google на сайте пока выключен.',
    bad_token: 'Google не подтвердил вход. Попробуй ещё раз.',
    bad_nonce: 'Google-вход устарел. Обнови страницу и попробуй снова.',
    bad_origin: 'Вход работает только на сайте aka-gst.ru.',
    not_logged_in: 'Сессия закончилась — войди снова.',
    reauth_required: 'Для этого войди заново (вход старше 15 минут).',
    save_too_large: 'Сохранение слишком большое для аккаунта — осталось в браузере.',
    conflict: 'С другого устройства пришло новее — объединяю.',
    internal: 'У сервиса входа сбой. Игра сохраняет в браузер.',
  })[code] ?? `Не получилось (${String(code ?? 'ошибка').slice(0, 40)}).`;
}

// Load the SDK script with a timeout. Resolves to window.Akkaunty or null.
export function loadSdkScript(src, { doc = globalThis.document, win = globalThis, timeout = 6000 } = {}) {
  if (win?.Akkaunty?.create) return Promise.resolve(win.Akkaunty);
  if (!doc?.createElement) return Promise.resolve(null);
  return new Promise((resolve) => {
    const s = doc.createElement('script');
    let done = false;
    const end = (v) => { if (done) return; done = true; clearTimeout(t); resolve(v); };
    const t = setTimeout(() => end(null), timeout);
    s.src = src; s.async = true; s.dataset.akkaunty = '';
    s.onload = () => end(win.Akkaunty?.create ? win.Akkaunty : null);
    s.onerror = () => { s.remove(); end(null); };
    doc.head.append(s);
  });
}

// Does <base>/me answer like the service? (Not the site's 404 page or SPA html.)
export async function probeService(base, { fetchImpl = globalThis.fetch, timeout = 4000 } = {}) {
  if (typeof fetchImpl !== 'function') return false;
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const t = setTimeout(() => ctl?.abort(), timeout);
  try {
    const r = await fetchImpl(`${base}/me`, { credentials: 'include', signal: ctl?.signal, headers: { accept: 'application/json' } });
    if (!/json/i.test(r.headers?.get?.('content-type') ?? '')) return false;
    const j = await r.json();
    return Boolean(j && typeof j === 'object' && !Array.isArray(j) && ('gost' in j || ('ok' in j && 'error' in j)));
  } catch { return false; } finally { clearTimeout(t); }
}

// ------------------------------------------------------------------ core
// sdk: () => Promise<Akkaunty client | null> (the probe + script load).
export function createAkkaunty({
  getSdk, storage = globalThis.localStorage, debounceMs = 1500, budget = SNAPSHOT_BUDGET,
  setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = (t) => clearTimeout(t), beacon = null,
  onStatus = () => {}, reload = () => globalThis.location?.reload?.(),
} = {}) {
  const get = (k) => { try { return storage?.getItem(k) ?? null; } catch { return null; } };
  const set = (k, v) => { try { storage?.setItem(k, v); return true; } catch { return false; } };
  const del = (k) => { try { storage?.removeItem(k); } catch { /* ignore */ } };
  const readJson = (k) => { try { return JSON.parse(get(k)); } catch { return null; } };

  let A = null;              // SDK client once the service answered
  let me = null;             // {gost:false,id,anon,metody} | null
  let ver;                   // version of our save on the server (undefined until load)
  let pending = null;        // snapshot waiting to be pushed
  let lastPushed = '';       // JSON of the last compact snapshot that reached the server
  let timer = 0, pushing = null, readyP = null, lastCard = '';
  const listeners = new Set();
  const status = { service: 'unknown', user: false, sync: 'idle', error: null, bytes: 0, trim: 0, methods: [], classes: false };
  const emit = (type, extra = {}) => { const s = { ...status, type, ...extra }; try { onStatus(s); } catch { /* ui */ } for (const fn of listeners) { try { fn(s); } catch { /* ui */ } } };

  async function ready() {
    if (A) return A;
    if (!readyP) readyP = (async () => { try { return await getSdk(); } catch { return null; } })().then(async (sdk) => {
      readyP = null;
      if (!sdk) { status.service = 'off'; return null; }
      A = sdk; status.service = 'on';
      status.classes = typeof A.classCards === 'function';
      await refreshMe();
      emit('service');
      return A;
    });
    return readyP;
  }
  async function refreshMe() {
    if (!A) return null;
    const r = await A.me();
    if (r && r.gost === false && r.id) { me = r; status.user = true; status.methods = r.metody ?? []; }
    else if (r?.error === 'offline') { status.sync = me ? 'offline' : status.sync; }
    else { me = null; status.user = false; status.methods = []; }
    return me;
  }
  const isMine = (id) => Boolean(me && String(id) === String(me.id));
  const cacheGet = (id) => { const s = readJson(CACHE_KEY(id)); return validSnapshot(s) ? s : null; };

  // ----------------------------------------------------- adapter methods
  async function getCurrentPlayer() {
    await ready();
    if (!me) return null;
    const cached = cacheGet(me.id);
    const nick = cached?.profile?.duel?.nick ? cleanNick(cached.profile.duel.nick) : defaultNick(me.anon);
    return { id: String(me.id), nick, defaultNick: defaultNick(me.anon) };
  }
  // Whose progress is in this browser? First login: the guest's → merge it
  // into the account (and remember the guest profile for logout).
  function claimLocal(id) {
    const owner = get(OWNER_KEY);
    if (owner === String(id)) return 'merge';
    if (!owner) {
      const g = get(CAMPUS_PROFILE_KEY);
      if (g) set(GUEST_KEY, g); else del(GUEST_KEY);
      set(OWNER_KEY, String(id));
      return 'merge';
    }
    set(OWNER_KEY, String(id));      // another account played here: its cache keeps its progress
    return 'replace';
  }
  async function loadSnapshot(id) {
    if (!isMine(id)) return undefined;              // not the account: the local store answers
    const cached = cacheGet(id);
    const r = await A.load(IGRA);
    if (!r?.ok) { status.sync = r?.error === 'offline' ? 'offline' : 'error'; status.error = r?.error ?? null; emit('sync'); return cached; }
    ver = Number.isInteger(r.ver) ? r.ver : 0;
    const remote = validSnapshot(r.dannye) ? r.dannye : null;
    if (remote) lastPushed = JSON.stringify(stripAt(remote));
    status.sync = 'synced'; status.error = null; emit('sync');
    return mergeSnapshots(remote, cached);
  }
  function saveSnapshot(id, snapshot) {
    if (!isMine(id)) return undefined;              // a guest: the local store keeps it
    if (!validSnapshot(snapshot)) return { ok: false };
    set(CACHE_KEY(id), JSON.stringify(snapshot));   // browser first, always
    pending = snapshot;
    clearTimer(timer);
    timer = setTimer(() => { timer = 0; return push(); }, debounceMs);
    return { ok: true, queued: true };
  }
  const stripAt = (s) => ({ ...s, at: 0 });

  async function push({ retried = false } = {}) {
    if (pushing) { await pushing; if (!pending) return status; }
    if (!pending || !A || !me) return status;
    const snap = pending; pending = null;
    pushing = (async () => {
      const compact = compactSnapshot(snap, { budget });
      status.bytes = snapshotBytes(compact); status.trim = compact.trim ?? 0;
      const key = JSON.stringify(stripAt(compact));
      if (key === lastPushed && ver !== undefined) { status.sync = 'synced'; emit('sync'); return; }
      if (status.bytes > SAVE_LIMIT) { status.sync = 'error'; status.error = 'save_too_large'; emit('sync'); return; }
      if (ver === undefined) { const l = await A.load(IGRA); if (l?.ok) ver = l.ver ?? 0; }
      status.sync = 'saving'; emit('sync');
      const r = await A.save(IGRA, compact, ver);
      if (r?.ok) { ver = r.ver; lastPushed = key; status.sync = 'synced'; status.error = null; emit('sync'); return; }
      if (r?.error === 'conflict' && !retried) {
        // Another device saved newer: take theirs, merge (grows only), save once more.
        const l = await A.load(IGRA);
        if (l?.ok) {
          ver = l.ver ?? 0;
          const merged = mergeSnapshots(validSnapshot(l.dannye) ? l.dannye : null, snap, { player: snap.player });
          set(CACHE_KEY(me.id), JSON.stringify(merged));
          emit('remote', { snapshot: merged });           // the game merges it into the live profile
          pending = pending ? mergeSnapshots(merged, pending) : merged;
          pushing = null;
          await push({ retried: true });
          return;
        }
      }
      if (r?.error === 'not_logged_in') { me = null; status.user = false; status.sync = 'idle'; emit('logout'); return; }
      pending = pending ?? snap;                           // keep it for the next try
      status.sync = r?.error === 'offline' ? 'offline' : 'error'; status.error = r?.error ?? 'error';
      emit('sync');
      clearTimer(timer); timer = setTimer(() => { timer = 0; return push(); }, 60000);
    })();
    try { await pushing; } finally { pushing = null; }
    return status;
  }
  // Page hiding: push now. Page leaving: a keepalive POST (the SDK fetch could be cut).
  async function flush({ leaving = false } = {}) {
    clearTimer(timer); timer = 0;
    if (!pending || !A || !me) return status;
    if (leaving && beacon) {
      const compact = compactSnapshot(pending, { budget });
      const body = ver === undefined ? { igra: IGRA, dannye: compact } : { igra: IGRA, dannye: compact, ver };
      if (beacon(body)) { pending = null; return status; }
    }
    return push();
  }

  // ----------------------------------------------------- login controller
  async function afterLogin(r) {
    if (!r?.ok) { status.error = r?.error ?? 'error'; emit('error', { error: status.error }); return r; }
    ver = undefined; lastPushed = '';
    await refreshMe();
    emit('login');
    return r;
  }
  const account = {
    status: () => ({ ...status }),
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    ready,
    async reprobe() { if (A) { await refreshMe(); emit('service'); return true; } return Boolean(await ready()); },
    loginPassword: async (nick, pw) => { await ready(); return A ? afterLogin(await A.loginPassword(String(nick).trim(), pw)) : { ok: false, error: 'offline' }; },
    registerPassword: async (nick, pw) => { await ready(); const bad = checkLogin(nick, pw); if (bad) return { ok: false, error: bad === NICK_RULE ? 'bad_nick' : 'weak_password' }; return A ? afterLogin(await A.registerPassword(String(nick).trim(), pw)) : { ok: false, error: 'offline' }; },
    passkeyLogin: async () => { await ready(); return A ? afterLogin(await A.passkeyLogin()) : { ok: false, error: 'offline' }; },
    // Signed in: links a passkey to this account; guest: a new account with a passkey.
    passkeyRegister: async () => { await ready(); if (!A) return { ok: false, error: 'offline' }; const r = await A.passkeyRegister('QueQuest'); return me ? (r?.ok ? (await refreshMe(), emit('service'), r) : r) : afterLogin(r); },
    googleButton: async (el) => { await ready(); if (!A?.googleButton) return false; return A.googleButton(el, { mode: me ? 'link' : 'login', onDone: (r) => (me ? (r?.ok ? refreshMe().then(() => emit('service')) : emit('error', { error: r?.error })) : afterLogin(r)) }); },
    // Logout: push what we have, close the session, give the browser back to the guest.
    async logout() {
      if (pending) await push();
      if (A) await A.logout();
      me = null; status.user = false; ver = undefined; lastPushed = ''; pending = null;
      const g = get(GUEST_KEY);
      const restored = g || JSON.stringify(createCampusProfile());
      set(CAMPUS_PROFILE_KEY, restored);
      // 19.3 · keep the save signature in step with this direct write, so the
      // next load doesn't mistake a legit logout for tampering (canon §20).
      sideSign(storage, CAMPUS_PROFILE_KEY, restored);
      del(GUEST_KEY); del(OWNER_KEY);
      emit('logout');
      reload();
      return { ok: true };
    },
    // ---- class + opt-in public card (service branch, feature-detected)
    hasClasses: () => Boolean(A && typeof A.classCards === 'function' && typeof A.classJoin === 'function'),
    showCard: () => get(SHOW_CARD_KEY) === '1',
    async setShowCard(on, card) {
      set(SHOW_CARD_KEY, on ? '1' : '0'); lastCard = '';
      if (!A || !me) return { ok: false, error: 'offline' };
      if (on) return typeof A.cardSave === 'function' ? A.cardSave(IGRA, publicCard(card)) : { ok: false, error: 'no_classes' };
      return typeof A.cardDelete === 'function' ? A.cardDelete(IGRA) : { ok: false, error: 'no_classes' };
    },
    // Keep the opened card fresh (only when it changed; only if the player opted in).
    async publishCard(card) {
      if (!(A && me && account.showCard() && typeof A.cardSave === 'function')) return null;
      const c = publicCard(card), key = JSON.stringify(c);
      if (key === lastCard) return { ok: true, same: true };
      const r = await A.cardSave(IGRA, c);
      if (r?.ok) lastCard = key;
      return r;
    },
    // SDK (service branch claude/great-newton-f5bp2q): classMine() → {klassy:[{id,name,role:'uchitel'|'uchenik',my_nick,code?}]},
    // classJoin(code, nick) → {klass}, classCreate(name) → {klass:{id,name,code}}, classLeave(klass).
    classMine: async () => {
      if (!(A && me && typeof A.classMine === 'function')) return { ok: false, error: 'no_classes' };
      const r = await A.classMine();
      const list = Array.isArray(r?.klassy) ? r.klassy : [];
      return { ...r, klassy: list.map((k) => ({ id: String(k.id), name: String(k.name ?? k.id), teacher: k.role === 'uchitel', code: k.code ?? null, myNick: k.my_nick ?? null, members: k.members ?? null })) };
    },
    classJoin: async (code, nick) => (A && me && typeof A.classJoin === 'function' ? A.classJoin(String(code).trim(), String(nick ?? '').trim().slice(0, 24)) : { ok: false, error: 'no_classes' }),
    classCreate: async (name) => (A && me && typeof A.classCreate === 'function' ? A.classCreate(String(name).trim().slice(0, 40)) : { ok: false, error: 'no_classes' }),
    classLeave: async (klass) => (A && me && typeof A.classLeave === 'function' ? A.classLeave(klass) : { ok: false, error: 'no_classes' }),
  };

  // Class cards → rows for the КЛАСС view and duel ghosts.
  async function listPlayers({ classId } = {}) {
    if (!A || !me || typeof A.classCards !== 'function' || !classId || classId === 'example') return [];
    const r = await A.classCards(classId, IGRA);           // {kartochki:[{member, nick (class nick), card|null, updated, ya?}]}
    const rows = Array.isArray(r?.kartochki) ? r.kartochki : [];
    return rows.filter((x) => x && x.card && typeof x.card === 'object')
      .map((x) => ({ id: `class:${classId}:${x.member}`, nick: cleanNick(x.nick), card: publicCard(x.card), updated: x.updated ?? null, member: x.member, me: Boolean(x.ya) }))
      .filter((x) => x.card.powers.length === 9);
  }
  const ghosts = new Map();
  async function loadGhost(id) {
    const s = String(id ?? '');
    if (!s.startsWith('class:')) return null;
    if (ghosts.has(s)) return ghosts.get(s);
    const klass = s.slice(6, s.lastIndexOf(':'));
    for (const row of await listPlayers({ classId: klass })) ghosts.set(row.id, ghostFromCard(row));
    return ghosts.get(s) ?? null;
  }

  return {
    kind: 'akkaunty', account,
    getCurrentPlayer, loadSnapshot, saveSnapshot, claimLocal, flush, listPlayers,
    // loadGhost: class ghosts here; share codes and built-in ghosts stay local.
    loadGhost: async (id) => (String(id ?? '').startsWith('class:') ? loadGhost(id) : undefined),
    _debug: { status: () => ({ ...status, ver, pending: Boolean(pending) }), push },
  };
}

// ONLY what a classmate needs for a duel: avatar, rank, 9 powers. No progress
// internals — and no nick: one card is seen in ALL the player's classes, and
// the service shows the class nick instead (its README: «не кладём ник»).
export function publicCard(c = {}) {
  const powers = (Array.isArray(c.powers) ? c.powers : []).slice(0, 9).map((p) => Math.max(0, Math.min(100, Math.round(Number(p) || 0))));
  // 19.3 · опционально ids значков (только id, по согласию «показать карточку»).
  const badges = (Array.isArray(c.badges) ? c.badges : []).filter((id) => typeof id === 'string').slice(0, 50).map((id) => id.slice(0, 32));
  return { avatar: Math.max(0, Math.min(7, Number(c.avatar) || 0)), rank: String(c.rank ?? '').slice(0, 40), rankIndex: Math.max(0, Math.min(20, Math.round(Number(c.rankIndex) || 0))), powers, ...(badges.length ? { badges } : {}) };
}
export function ghostFromCard(row) {
  return { id: row.id, name: row.nick, avatar: row.card.avatar, powers: row.card.powers, classmate: true, hello: 'Я из твоего класса. Посмотрим, кто быстрее!', win: 'Ладно, сегодня ты сильнее.', lose: 'Класс! Подтянись и вызови снова.' };
}

// ------------------------------------------------------------ the page
// Installs window.QQ_PROFILE_ADAPTER synchronously (before main.js resolves
// it). The probe and the SDK load happen in the background.
export function installAkkaunty({ win = globalThis, doc = globalThis.document, fetchImpl = globalThis.fetch } = {}) {
  const base = akkauntyBase({ location: win.location, win });
  if (!base || win.QQ_PROFILE_ADAPTER) return null;
  let lastProbe = 0;
  const getSdk = async () => {
    lastProbe = Date.now();
    if (!(await probeService(base, { fetchImpl }))) return null;
    const lib = await loadSdkScript(`${base}/client/akkaunty.js`, { doc, win });
    return lib ? lib.create({ base }) : null;
  };
  const beacon = (body) => {
    try { fetchImpl(`${base}/save`, { method: 'POST', credentials: 'include', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => {}); return true; } catch { return false; }
  };
  const acc = createAkkaunty({ getSdk, beacon, onStatus: (s) => { try { win.dispatchEvent(new win.CustomEvent('qq:account', { detail: s })); } catch { /* old browser */ } } });
  win.QQ_PROFILE_ADAPTER = acc;
  win.QQ_AKK = acc.account;
  // Not deployed yet? Look again slowly, and on focus — no spam, no noise.
  const again = () => { if (acc.account.status().service === 'on') return; if (Date.now() - lastProbe < PROBE_ON_FOCUS) return; acc.account.ready(); };
  setInterval(() => { if (acc.account.status().service !== 'on') acc.account.ready(); }, PROBE_EVERY);
  win.addEventListener?.('focus', again);
  win.addEventListener?.('online', () => { if (acc.account.status().service === 'on') acc._debug.push(); else again(); });
  acc.account.ready();
  return acc;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined' && !window.__QQ_AKK_NO_AUTO__) installAkkaunty();
