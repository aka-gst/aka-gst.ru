// 19.1 · The one place where accounts plug into the game (canon §19,
// docs/PROFILE-ADAPTER.md). Логин и пароль делает Сергей; the game never
// talks to a server itself. It talks to an ADAPTER with five methods:
//
//   getCurrentPlayer()            -> { id, nick, classId? } | null
//   loadSnapshot(id)              -> snapshot | null
//   saveSnapshot(id, snapshot)    -> { ok }
//   listPlayers({ classId })      -> [{ id, nick, snapshot? }]   (teacher view)
//   loadGhost(id)                 -> ghost | null                 (duel a classmate)
//
// Every method may return a value or a Promise. The local adapter (now)
// keeps snapshots in localStorage, serves the built-in ghosts and share
// codes. A remote adapter is set by the page BEFORE the game boots:
//
//   <script>window.QQ_PROFILE_ADAPTER = { getCurrentPlayer, loadSnapshot, … }</script>
//
// and is used when present (or forced with ?store=remote; ?store=local
// ignores it). Missing methods fall back to the local ones.
//
// Snapshot = versioned JSON from profileSnapshot(): the whole campus profile
// (mastery grid, XP ledger, duel record) plus the card view for lists.

import { createCampusProfile, mergeCampusProfile } from './campus-profile.js?v=campus-profile-7';
import { diverCard, powersOf, cleanNick } from './diver-card.js';
import { GHOSTS, ghostById, decodeShare, ghostFromShare, SHARE_PREFIX } from './duel.js';
import { sampleClass } from './class-mock.js';
import { mergeBadges, cardBadgeIds } from './achievements.js';

export const SNAPSHOT_KIND = 'quequest.diver';
export const SNAPSHOT_VERSION = 1;
export const ADAPTER_METHODS = Object.freeze(['getCurrentPlayer', 'loadSnapshot', 'saveSnapshot', 'listPlayers', 'loadGhost']);
// 19.2 · optional extras an account adapter may have (akkaunty-adapter.js):
// claimLocal(id) -> 'merge' | 'replace' (whose progress is in this browser),
// flush({ leaving }) (push a pending save now), account (the login controller).
export const OPTIONAL_METHODS = Object.freeze(['claimLocal', 'flush']);
const KEY = (id) => `quequest.snapshot.${String(id).replace(/[^\w.-]/g, '_').slice(0, 64)}`;

export function profileSnapshot(profile = {}, { player = null, at = Date.now() } = {}) {
  const p = createCampusProfile(profile);
  const card = diverCard(p);
  return {
    kind: SNAPSHOT_KIND, v: SNAPSHOT_VERSION, at,
    player: player ? { id: String(player.id), nick: cleanNick(player.nick ?? card.nick) } : null,
    card: { nick: player?.nick ? cleanNick(player.nick) : card.nick, avatar: card.avatar, rank: card.rank, rankIndex: card.rankIndex, xp: card.xp, powers: powersOf(card), proofs: card.proofs, badges: cardBadgeIds(p) },
    profile: { ...p, duel: profile.duel ?? p.duel ?? {}, badges: profile.badges ?? p.badges ?? {}, hack: profile.hack ?? p.hack ?? {} },
  };
}
// ------------------------------------------------------------ 19.2 · size
// The account service keeps at most 64 KB per game. A fresh diver is ~3 KB,
// a long school year of duels and city days is far more: the XP ledger
// (awards), the guild ledger and the seed lists only grow. compactSnapshot()
// keeps the snapshot under SNAPSHOT_BUDGET by dropping the OLDEST foldable
// entries (daily duel proofs of past days, random-seed shifts/incidents) and
// trimming histories; the totals (XP, guild points) travel in `totals`, and
// applySnapshot() tops the live profile up to them. Facts (stories, tasters,
// realm days, contracts) are never folded.
export const SNAPSHOT_BUDGET = 48 * 1024;
const SEED_AWARD = /^(worldshift|commons:day|operations:shift|chronicle:window|weave:season|threads:cycle|guild:job|deskincident|sandbox|factorytrial|simnetincident|nexustrial):/;
const DATED = /:(\d{4}-\d{2}-\d{2})$/;
const CARRY_KEY = 'carry:guild';
export function foldableKey(key, today = new Date()) {
  const k = String(key);
  if (SEED_AWARD.test(k)) return true;
  const m = DATED.exec(k);
  if (!m) return false;
  // Only days that can no longer recur (2+ days back: time zones differ).
  return Date.parse(`${m[1]}T00:00:00Z`) < today.getTime() - 2 * 86400000;
}
function ledgerTotals(ledger = {}) {
  const out = {};
  for (const gains of Object.values(ledger ?? {})) {
    if (!gains || typeof gains !== 'object') continue;
    for (const [k, v] of Object.entries(gains)) out[k] = (out[k] ?? 0) + Math.max(0, Number(v) || 0);
  }
  return out;
}
export const snapshotBytes = (s) => new TextEncoder().encode(JSON.stringify(s)).length;
function keepRecent(obj = {}, keep, today) {
  const entries = Object.entries(obj ?? {});
  let fold = entries.filter(([k]) => foldableKey(k, today)).length - keep;
  if (fold <= 0) return { ...obj };
  const out = {};
  for (const [k, v] of entries) { if (fold > 0 && foldableKey(k, today)) { fold -= 1; continue; } out[k] = v; }
  return out;
}
function trimSnapshot(snap, level, today) {
  const p = snap.profile;
  const keep = [Infinity, 800, 400, 200, 100, 40, 0][level] ?? 0;
  const proofs = [40, 40, 20, 12, 8, 4, 2][level] ?? 1;
  const seeds = [Infinity, 200, 100, 60, 30, 15, 5][level] ?? 5;
  const labs = {};
  for (const [id, lab] of Object.entries(p.labs ?? {})) {
    const l = { ...lab };
    for (const [k, v] of Object.entries(l)) if (Array.isArray(v) && /Seeds$/.test(k) && v.length > seeds) l[k] = v.slice(-seeds);
    labs[id] = l;
  }
  const { [CARRY_KEY]: _carry, ...ledger } = labs.guild?.skillLedger ?? {};
  if (labs.guild) labs.guild = { ...labs.guild, skillLedger: keepRecent(ledger, keep, today) };
  const mastery = {};
  for (const [k, e] of Object.entries(p.mastery ?? {})) mastery[k] = { ...e, proofs: (e?.proofs ?? []).slice(-proofs) };
  const duel = p.duel ? { ...p.duel, history: (p.duel.history ?? []).slice(level ? -8 : -20) } : p.duel;
  return { ...snap, profile: { ...p, legacyXp: 0, awards: keepRecent(p.awards, keep, today), labs, mastery, duel, ...(p.sandbox ? { sandbox: { ...p.sandbox, solvedSeeds: (p.sandbox.solvedSeeds ?? []).slice(-Math.min(100, seeds)) } } : {}) } };
}
// The account form of a snapshot: totals + as much detail as fits the budget.
export function compactSnapshot(snap, { budget = SNAPSHOT_BUDGET, today = new Date() } = {}) {
  if (!validSnapshot(snap)) return snap;
  const totals = { xp: Number(snap.profile.xp) || 0, guild: ledgerTotals(snap.profile.labs?.guild?.skillLedger) };
  let out = null;
  for (let level = 0; level <= 6; level += 1) {
    out = { ...trimSnapshot(snap, level, today), totals, trim: level };
    if (snapshotBytes(out) <= budget) return out;
  }
  // Last resort: the card and totals only (still restores XP, rank, powers).
  return { ...out, profile: { ...out.profile, mastery: {}, awards: {}, labs: { ...out.profile.labs, guild: { ...(out.profile.labs?.guild ?? {}), skillLedger: {} } } }, trim: 7 };
}

export function validSnapshot(s) {
  return Boolean(s && typeof s === 'object' && s.kind === SNAPSHOT_KIND && s.v === SNAPSHOT_VERSION && s.profile && typeof s.profile === 'object');
}
// Merge a saved snapshot into the live profile: proofs and XP only grow
// (mergeCampusProfile keeps the max of every ledger), the duel record and
// nick come from the snapshot when the account has them.
export function applySnapshot(profile = {}, snap) {
  if (!validSnapshot(snap)) return profile;
  // A compact (account) snapshot carries no legacy XP of its own: its
  // totals top the merge up instead, so nothing is ever counted twice.
  const incoming = snap.totals ? { ...snap.profile, legacyXp: 0 } : snap.profile;
  let merged = mergeCampusProfile(profile, incoming);
  const a = profile.duel ?? {}, b = incoming.duel ?? {};
  const stats = { ...(a.stats ?? {}) };
  for (const [m, v] of Object.entries(b.stats ?? {})) stats[m] = { played: Math.max(stats[m]?.played ?? 0, v?.played ?? 0), won: Math.max(stats[m]?.won ?? 0, v?.won ?? 0) };
  const seen = new Set();
  const history = [...(a.history ?? []), ...(b.history ?? [])].filter((h) => h && !seen.has(`${h.at}|${h.foe}`) && seen.add(`${h.at}|${h.foe}`)).sort((x, y) => (x.at ?? 0) - (y.at ?? 0)).slice(-20);
  const duel = { ...a, ...b, stats, history, beaten: [...new Set([...(a.beaten ?? []), ...(b.beaten ?? [])])] };
  if (a.daily && b.daily && a.daily.day === b.daily.day) duel.daily = { day: a.daily.day, n: Math.max(a.daily.n ?? 0, b.daily.n ?? 0) };
  if (snap.player?.nick && !b.nick) duel.nick = cleanNick(snap.player.nick);
  if (snap.totals) {
    const need = Math.max(0, (Number(snap.totals.xp) || 0) - merged.xp);
    if (need > 0) merged = { ...merged, legacyXp: merged.legacyXp + need, xp: merged.xp + need };
    const guild = merged.labs?.guild ?? {};
    const have = ledgerTotals(guild.skillLedger);
    const carry = { ...(guild.skillLedger?.[CARRY_KEY] ?? {}) };
    let topped = false;
    for (const [k, v] of Object.entries(snap.totals.guild ?? {})) { const d = (Number(v) || 0) - (have[k] ?? 0); if (d > 0) { carry[k] = (carry[k] ?? 0) + d; topped = true; } }
    if (topped) merged = { ...merged, labs: { ...merged.labs, guild: { ...guild, skillLedger: { ...(guild.skillLedger ?? {}), [CARRY_KEY]: carry } } } };
  }
  // Badges and hack flags are facts — union them, never lose one (canon §20).
  const badges = mergeBadges(profile.badges ?? {}, incoming.badges ?? {});
  const ha = profile.hack ?? {}, hb = incoming.hack ?? {};
  const hack = {
    ...ha, ...hb,
    flags: { ...(ha.flags ?? {}), ...(hb.flags ?? {}) },
    seam: ha.seam || hb.seam, tooGood: ha.tooGood || hb.tooGood, forger: ha.forger || hb.forger,
    autoclicker: ha.autoclicker || hb.autoclicker, underHood: ha.underHood || hb.underHood,
    speedrun: ha.speedrun || hb.speedrun, classBeat: ha.classBeat || hb.classBeat,
    hall: [...(Array.isArray(ha.hall) ? ha.hall : []), ...(Array.isArray(hb.hall) ? hb.hall : [])].slice(-30),
    reports: [...(Array.isArray(ha.reports) ? ha.reports : []), ...(Array.isArray(hb.reports) ? hb.reports : [])].slice(-20),
  };
  // mergeCampusProfile does not know about later top-level fields: keep both.
  const { legacyXp: _l, awards: _a, xp: _x, badges: _b, hack: _h, ...rest } = incoming;
  return { ...profile, ...rest, ...merged, duel, badges, hack };
}
// Two snapshots of one player (server + this browser's cache) -> one.
export function mergeSnapshots(a, b, { player = null } = {}) {
  if (!validSnapshot(a)) return validSnapshot(b) ? b : null;
  if (!validSnapshot(b)) return a;
  const base = applySnapshot(createCampusProfile(), a);
  return profileSnapshot(applySnapshot(base, b), { player: player ?? b.player ?? a.player });
}

export function createLocalAdapter(storage = globalThis.localStorage) {
  const get = (k) => { try { return storage?.getItem(k) ?? null; } catch { return null; } };
  const set = (k, v) => { try { storage?.setItem(k, v); return true; } catch { return false; } };
  return {
    kind: 'local',
    getCurrentPlayer: () => null,
    loadSnapshot: (id) => { try { const s = JSON.parse(get(KEY(id))); return validSnapshot(s) ? s : null; } catch { return null; } },
    saveSnapshot: (id, snapshot) => ({ ok: validSnapshot(snapshot) && set(KEY(id), JSON.stringify(snapshot)) }),
    listPlayers: ({ classId = 'example' } = {}) => (classId === 'example' ? sampleClass().map((s) => ({ id: s.id, nick: s.nick, example: true, card: s.card })) : []),
    loadGhost: (id) => {
      const s = String(id ?? '');
      if (s.startsWith(SHARE_PREFIX)) { const d = decodeShare(s); return d.ok ? ghostFromShare(d.card) : null; }
      return ghostById(s);
    },
  };
}

// Pick the adapter: window.QQ_PROFILE_ADAPTER (unless ?store=local), with
// any missing method taken from the local one. Always returns async methods.
export function resolveAdapter({ win = globalThis, search = globalThis.location?.search ?? '', storage = globalThis.localStorage } = {}) {
  const local = createLocalAdapter(storage);
  const want = new URLSearchParams(search).get('store');
  const remote = want === 'local' ? null : win?.QQ_PROFILE_ADAPTER;
  const useRemote = remote && typeof remote === 'object' && ADAPTER_METHODS.some((m) => typeof remote[m] === 'function');
  if (want === 'remote' && !useRemote) console.warn?.('QueQuest: ?store=remote, но window.QQ_PROFILE_ADAPTER не задан — работаю локально.');
  const src = useRemote ? remote : local;
  const out = { kind: useRemote ? 'remote' : 'local' };
  for (const m of OPTIONAL_METHODS) {
    const fn = useRemote && typeof remote[m] === 'function' ? remote[m].bind(remote) : null;
    out[m] = async (...args) => { if (!fn) return m === 'claimLocal' ? 'merge' : null; try { return await fn(...args); } catch (e) { console.warn?.(`QueQuest adapter ${m} failed`, e); return m === 'claimLocal' ? 'merge' : null; } };
  }
  out.account = useRemote ? remote.account ?? null : null;
  for (const m of ADAPTER_METHODS) {
    const fn = typeof src[m] === 'function' ? src[m].bind(src) : local[m];
    // A remote method may answer `undefined` = «not mine, ask the local one»
    // (a guest's save, a share-code ghost).
    out[m] = async (...args) => { try { const v = await fn(...args); return v === undefined && fn !== local[m] ? await local[m](...args) : v; } catch (e) { console.warn?.(`QueQuest adapter ${m} failed`, e); return m === 'listPlayers' ? [] : m === 'saveSnapshot' ? { ok: false } : null; } };
  }
  return out;
}

export { GHOSTS };
