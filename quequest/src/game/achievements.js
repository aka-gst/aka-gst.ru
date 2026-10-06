// 19.3 · ЗНАЧКИ — achievements for deeds, not points (canon §20, owner idea B).
// Pure data + pure rules, no DOM: achievements-ui draws, main.js wires, and
// tools/achievements.test.mjs checks every badge has a test path.
//
// A badge: { id, title (short, witty, Russian), how (one line), glyph (a simple
// QueQuest glyph, no emoji), rarity, secret, proof? }. Earned badges live in
// the profile snapshot (so they sync via akkaunty) as
//   profile.badges = { [id]: earnedAtMs }
// and the hacker/polygon deeds that can't be read from the mastery grid live
// as flags the game sets:
//   profile.hack = { seam, tooGood, forger, autoclicker, underHood,
//                    flags: { [flagId]: true }, reports: [...], hall: [...] }
//
// A badge that PROVES a skill carries a `proof` (canon: hacker badges →
// «Защита» on floor С НУЛЯ / raw; polygon flags → «Защита» on КОД/С НУЛЯ).
// main.js runs it through masteryEvent (idempotent by key) when the badge is
// first earned, so a badge is also a §13 proof.

const freeze = (v) => { if (v && typeof v === 'object') { for (const k of Object.keys(v)) freeze(v[k]); Object.freeze(v); } return v; };

export const RARITY = freeze({
  common: { id: 'common', name: 'обычный', order: 0 },
  rare: { id: 'rare', name: 'редкий', order: 1 },
  epic: { id: 'epic', name: 'легендарный', order: 2 },
  secret: { id: 'secret', name: 'секретный', order: 3 },
});

// A proof helper: «Защита» is skill `guard` on the card (diver-card AREAS).
const guardProof = (way, stage, key) => ({ skill: 'guard', way, stage, key: `badge:${key}`, source: 'badge' });

// ------------------------------------------------------------- the badges
// check(profile, facts) → true when the deed is done. facts carries what the
// profile can't say on its own (week flags, reflexes, class). Hacker/polygon
// deeds read profile.hack, set by tamper.js / polygon.js.
export const BADGES = freeze([
  // ---- the five-day week (§18) ----
  { id: 'fired-honor', title: 'Уволен с честью', how: 'Доработать до пятого дня — тебя рассчитали и выгнали.', glyph: '⌁', rarity: 'rare',
    check: (p, f) => Boolean(f.fired || f.weekDay >= 5) },
  { id: 'no-button', title: 'Без кнопки', how: 'День 2: кнопку оторвали — ты скопировал строчку.', glyph: '⧉', rarity: 'common',
    check: (p, f) => (f.weekDay ?? 0) >= 2 || Boolean(f.fired) },
  { id: 'no-paste', title: 'Вставка не нужна', how: 'День 4: вставка выключена — ты написал руками.', glyph: '✍', rarity: 'rare',
    check: (p, f) => (f.weekDay ?? 0) >= 4 || Boolean(f.fired) },
  { id: 'self-automaton', title: 'Сам себе автомат', how: 'День 5: линия пошла сама. Ты сам написал то, что тебя заменило.', glyph: '⚙', rarity: 'epic',
    check: (p, f) => Boolean(f.fired || f.weekDay >= 5) },

  // ---- professions: each person helped, the full profession, all tasters ----
  { id: 'vitya-car', title: 'Машина Вити цела', how: 'Первая ночь в гараже: машину Вити ни разу не открыли.', glyph: '⬡', rarity: 'common',
    check: (p, f) => (f.heldDay ?? 0) >= 1 },
  { id: 'dina-radio', title: 'Магнитола Дины молчит', how: 'Вторая ночь: «обновление» «ТИСКОВ» больше ничего не открывает.', glyph: '♪', rarity: 'common',
    check: (p, f) => (f.heldDay ?? 0) >= 2 },
  { id: 'sanya-lock', title: 'Замок Сани залатан', how: 'Третья ночь: мастер-ключ «ТИСКОВ» больше не работает.', glyph: '⚿', rarity: 'rare',
    check: (p, f) => (f.heldDay ?? 0) >= 3 },
  { id: 'hacker-pro', title: 'Хакер', how: 'Три ночи в гараже — профессия Хакера пройдена.', glyph: '◆', rarity: 'epic',
    check: (p, f) => (f.heldDay ?? 0) >= 3 },
  { id: 'eng-lida', title: 'Фото Лиды к утру', how: 'Инженер: линия доделала каталог Лиды без штрафа «ТИСКАМ».', glyph: '▤', rarity: 'common',
    check: (p, f) => (f.ordersDone ?? []).includes('order-01') },
  { id: 'engineer-pro', title: 'Инженер', how: 'Три заказа — профессия Инженера пройдена.', glyph: '◆', rarity: 'epic',
    check: (p, f) => ['order-01', 'order-02', 'order-03'].every((o) => (f.ordersDone ?? []).includes(o)) },
  { id: 'taster-security', title: 'Сервер Тимура устоял', how: 'Проба «Сетевик»: боты «ТИСКОВ» не прошли.', glyph: '⬡', rarity: 'common',
    check: (p, f) => Boolean(f.tasters?.security) },
  { id: 'taster-web', title: 'Пироги нашлись', how: 'Проба «Создатель сайтов»: страничку Нины Петровны находят.', glyph: '▦', rarity: 'common',
    check: (p, f) => Boolean(f.tasters?.web) },
  { id: 'taster-ai', title: 'Подделку видно', how: 'Проба «Тренер ИИ»: робот Зарины отличает правду от фальшивки.', glyph: '◉', rarity: 'common',
    check: (p, f) => Boolean(f.tasters?.ai) },
  { id: 'taster-systems', title: 'Свет у бабы Вали', how: 'Проба «Спасатель»: аппарат бабы Вали не погас.', glyph: '▲', rarity: 'common',
    check: (p, f) => Boolean(f.tasters?.systems) },
  { id: 'taster-lowlevel', title: 'Радио деда Миши поёт', how: 'Проба «Знаток железа»: собрал станцию битами 8·4·2·1.', glyph: '⏚', rarity: 'common',
    check: (p, f) => Boolean(f.tasters?.lowlevel) },
  { id: 'all-tasters', title: 'Все пять проб', how: 'Пройти все пять профессий-проб.', glyph: '★', rarity: 'epic',
    check: (p, f) => ['security', 'web', 'ai', 'systems', 'lowlevel'].every((id) => f.tasters?.[id]) },

  // ---- duels (§19) ----
  { id: 'duel-first', title: 'Первая кровь на ринге', how: 'Выиграть первую дуэль задачками.', glyph: '⚔', rarity: 'common',
    check: (p) => (p.duel?.stats?.duel?.won ?? 0) >= 1 },
  { id: 'beat-spec', title: 'Специалист повержен', how: 'Победить Специалиста «ТИСКОВ» на ринге.', glyph: '✦', rarity: 'epic',
    check: (p) => (p.duel?.beaten ?? []).includes('spec') },
  { id: 'ladder-clear', title: 'Вся лестница', how: 'Победить всех шестерых призраков ринга.', glyph: '♛', rarity: 'epic',
    check: (p) => ['intern', 'vitya', 'dina', 'sanya', 'timur', 'spec'].every((g) => (p.duel?.beaten ?? []).includes(g)) },
  { id: 'duel-clean', title: 'Семь из семи', how: 'Дуэль без единой ошибки: все семь раундов верно.', glyph: '✓', rarity: 'rare',
    check: (p) => (p.duel?.history ?? []).some((h) => h.mode === 'duel' && h.total >= 7 && h.right >= h.total) },
  { id: 'duel-speed', title: 'Молниеносный ответ', how: 'Ответить верно меньше чем за секунду (но по-честному).', glyph: '⚡', rarity: 'rare',
    check: (p) => Boolean(p.hack?.speedrun) },

  // ---- class ----
  { id: 'class-joined', title: 'В классе', how: 'Вступить в класс по коду учителя.', glyph: '▦', rarity: 'common',
    check: (p, f) => Boolean(f.classJoined) },
  { id: 'class-card', title: 'Карточка открыта', how: 'Открыть свою карточку классу.', glyph: '⎙', rarity: 'common',
    check: (p, f) => Boolean(f.cardPublished) },
  { id: 'class-beat', title: 'Одноклассник повержен', how: 'Победить призрак одноклассника.', glyph: '⚔', rarity: 'rare',
    check: (p) => (p.duel?.history ?? []).some((h) => /одноклассник|класс/i.test(String(h.foe ?? ''))) || Boolean(p.hack?.classBeat) },

  // ---- gamer reflexes (§16) ----
  { id: 'reflex-save', title: 'Рука помнит F5', how: 'Сохраниться рефлексом — рука потянулась сама.', glyph: '⟳', rarity: 'common',
    check: (p, f) => Boolean(f.reflexes?.save) },
  { id: 'reflex-crate', title: 'За ящиком', how: 'Заглянуть за одинокий ящик — там чип.', glyph: '▢', rarity: 'rare',
    check: (p, f) => Boolean(f.reflexes?.crate) },
  { id: 'reflex-pattern', title: 'Паттерн босса', how: 'Увидеть такт босса 1·2·3·БАМ и толкнуть вовремя.', glyph: '⦿', rarity: 'rare',
    check: (p, f) => Boolean(f.reflexes?.pattern) },

  // ---- §21 the hands on the factory (19.4) ----
  { id: 'beaten-hall', title: 'Огрёб от всего цеха', how: 'Полезть с кулаками на каждого в цеху: сварщик, слесарь, электрик, грузчик — все тебя отделали.', glyph: '✕', rarity: 'rare',
    check: (p, f) => Boolean(f.fists?.beatenAll) },
  { id: 'anger-fuel', title: 'Злость — топливо', how: 'Три ящика — полная злость — и начальник на полу.', glyph: '✷', rarity: 'epic',
    check: (p, f) => Boolean(f.fists?.angerWin) },
  { id: 'hands-for-work', title: 'Руки для дела', how: 'Перенести три ящика и ни разу ни на кого не замахнуться.', glyph: '▣', rarity: 'common',
    check: (p, f) => Boolean(f.fists?.cleanHands) },

  // ---- §17 meaning layers ----
  { id: 'meaning-seam', title: 'Старое звучит иначе', how: 'Услышать знакомую фразу в новом слое — мигнул шов.', glyph: '⌇', rarity: 'rare',
    check: (p, f) => Boolean(f.meaningHeard) },

  // ---- SECRET: «Взломай меня» (hidden until earned) ----
  { id: 'seam-found', title: 'Нашёл шов', how: 'Поправил сохранение руками. Подпись не сошлась — мы это предусмотрели.', glyph: '⟊', rarity: 'secret', secret: true,
    proof: guardProof('raw', 2, 'seam-found'), check: (p) => Boolean(p.hack?.seam) },
  { id: 'too-good', title: 'Слишком хорошо, чтобы быть правдой', how: 'Выставил себе невозможное число. Вернули как было.', glyph: '∞', rarity: 'secret', secret: true,
    proof: guardProof('raw', 2, 'too-good'), check: (p) => Boolean(p.hack?.tooGood) },
  { id: 'forger', title: 'Фальшивомонетчик (почти)', how: 'Подсунул поддельный код друга. Контрольная сумма не сошлась.', glyph: '✗', rarity: 'secret', secret: true,
    proof: guardProof('raw', 1, 'forger'), check: (p) => Boolean(p.hack?.forger) },
  { id: 'autoclicker', title: 'Автокликер? Мы видим', how: 'Ответы быстрее человека. Хочешь — напиши бота честно: это профессия.', glyph: '⏱', rarity: 'secret', secret: true,
    proof: guardProof('raw', 1, 'autoclicker'), check: (p) => Boolean(p.hack?.autoclicker) },
  { id: 'under-hood', title: 'Смотрю под капот', how: 'Позвал отладочный хук игры из консоли.', glyph: '⚒', rarity: 'secret', secret: true,
    proof: guardProof('raw', 1, 'under-hood'), check: (p) => Boolean(p.hack?.underHood) },

  // ---- polygon flags (§20) — each a «Защита» proof ----
  { id: 'flag-price', title: 'Не верь браузеру', how: 'Полигон: подменил цену в форме — «сервер» ей поверил.', glyph: '₽', rarity: 'rare',
    proof: guardProof('code', 2, 'flag-price'), check: (p) => Boolean(p.hack?.flags?.price) },
  { id: 'flag-admin', title: 'Спрятать ≠ защитить', how: 'Полигон: нажал «admin», отключённую только внешне.', glyph: '⊘', rarity: 'rare',
    proof: guardProof('code', 2, 'flag-admin'), check: (p) => Boolean(p.hack?.flags?.admin) },
  { id: 'flag-input', title: 'Проверяй ввод', how: 'Полигон: обошёл наивный фильтр ввода.', glyph: '⌨', rarity: 'rare',
    proof: guardProof('code', 2, 'flag-input'), check: (p) => Boolean(p.hack?.flags?.input) },
  { id: 'flag-token', title: 'Случайность настоящая', how: 'Полигон: угадал следующий предсказуемый код.', glyph: '⚂', rarity: 'rare',
    proof: guardProof('code', 2, 'flag-token'), check: (p) => Boolean(p.hack?.flags?.token) },
  { id: 'flag-sign', title: 'Подпись решает', how: 'Полигон: разобрался, как подписано сохранение.', glyph: '⟊', rarity: 'epic',
    proof: guardProof('raw', 3, 'flag-sign'), check: (p) => Boolean(p.hack?.flags?.sign) },
  { id: 'polygon-clear', title: 'Полигон пройден', how: 'Найти все пять флагов «Взломай меня».', glyph: '✸', rarity: 'epic',
    proof: guardProof('raw', 3, 'polygon-clear'), check: (p) => ['price', 'admin', 'input', 'token', 'sign'].every((fl) => p.hack?.flags?.[fl]) },
].map((b) => freeze({ secret: false, ...b })));

export const BADGE_IDS = freeze(BADGES.map((b) => b.id));
export const badgeById = (id) => BADGES.find((b) => b.id === id) ?? null;

// ------------------------------------------------------------- earn / merge
export function hasBadge(profile = {}, id) { return Boolean(profile.badges?.[id]); }
export function earnedBadges(profile = {}) { return BADGE_IDS.filter((id) => profile.badges?.[id]); }
export function badgeCount(profile = {}) { return earnedBadges(profile).length; }

// Give one badge (idempotent). Returns { profile, first, badge }.
export function earnBadge(profile = {}, id, at = Date.now()) {
  const badge = badgeById(id);
  if (!badge || profile.badges?.[id]) return { profile, first: false, badge };
  return { profile: { ...profile, badges: { ...(profile.badges ?? {}), [id]: at } }, first: true, badge };
}

// Check every badge against the profile + facts; earn any newly satisfied.
// Returns { profile, earned: [badge, …] } — earned carries proofs for main.js.
export function evaluateBadges(profile = {}, facts = {}, at = Date.now()) {
  let p = profile;
  const earned = [];
  for (const b of BADGES) {
    if (p.badges?.[b.id]) continue;
    let ok = false;
    try { ok = Boolean(b.check(p, facts)); } catch { ok = false; }
    if (!ok) continue;
    p = { ...p, badges: { ...(p.badges ?? {}), [b.id]: at } };
    earned.push(b);
  }
  return { profile: p, earned };
}

// Union of two badge maps (sync merge: earliest date wins, nothing is lost).
export function mergeBadges(a = {}, b = {}) {
  const out = { ...a };
  for (const [id, at] of Object.entries(b ?? {})) {
    if (!badgeById(id)) continue;
    out[id] = out[id] ? Math.min(out[id], at) : at;
  }
  return out;
}

// --------------------------------------------------------------- the grid
// For the ЗНАЧКИ grid on the diver card. Locked non-secret badges show «???»
// with the how-to hint; secret badges are hidden entirely until earned.
export function badgeGrid(profile = {}) {
  const order = ['common', 'rare', 'epic', 'secret'];
  const rows = BADGES.map((b) => {
    const at = profile.badges?.[b.id] ?? null;
    const earned = Boolean(at);
    if (!earned && b.secret) return null; // secrets stay hidden
    return { id: b.id, title: earned ? b.title : '???', how: b.how, glyph: earned ? b.glyph : '?', rarity: b.rarity, secret: b.secret, earned, at };
  }).filter(Boolean);
  rows.sort((x, y) => (y.earned - x.earned) || (RARITY[x.rarity].order - RARITY[y.rarity].order));
  const hiddenSecrets = BADGES.filter((b) => b.secret && !profile.badges?.[b.id]).length;
  return { rows, earned: badgeCount(profile), total: BADGES.length, hiddenSecrets, _order: order };
}

// The badge ids that go INTO the opt-in class card (ids only). We keep the
// card tiny: non-secret badges plus any secret the player chose to show by
// earning it (a secret is a point of pride — «нашёл шов» — so it travels too).
export function cardBadgeIds(profile = {}) { return earnedBadges(profile); }
