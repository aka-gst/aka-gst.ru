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

export const SNAPSHOT_KIND = 'quequest.diver';
export const SNAPSHOT_VERSION = 1;
export const ADAPTER_METHODS = Object.freeze(['getCurrentPlayer', 'loadSnapshot', 'saveSnapshot', 'listPlayers', 'loadGhost']);
const KEY = (id) => `quequest.snapshot.${String(id).replace(/[^\w.-]/g, '_').slice(0, 64)}`;

export function profileSnapshot(profile = {}, { player = null, at = Date.now() } = {}) {
  const p = createCampusProfile(profile);
  const card = diverCard(p);
  return {
    kind: SNAPSHOT_KIND, v: SNAPSHOT_VERSION, at,
    player: player ? { id: String(player.id), nick: cleanNick(player.nick ?? card.nick) } : null,
    card: { nick: player?.nick ? cleanNick(player.nick) : card.nick, avatar: card.avatar, rank: card.rank, rankIndex: card.rankIndex, xp: card.xp, powers: powersOf(card), proofs: card.proofs },
    profile: { ...p, duel: profile.duel ?? p.duel ?? {} },
  };
}
export function validSnapshot(s) {
  return Boolean(s && typeof s === 'object' && s.kind === SNAPSHOT_KIND && s.v === SNAPSHOT_VERSION && s.profile && typeof s.profile === 'object');
}
// Merge a saved snapshot into the live profile: proofs and XP only grow
// (mergeCampusProfile keeps the max of every ledger), the duel record and
// nick come from the snapshot when the account has them.
export function applySnapshot(profile = {}, snap) {
  if (!validSnapshot(snap)) return profile;
  const merged = mergeCampusProfile(profile, snap.profile);
  const a = profile.duel ?? {}, b = snap.profile.duel ?? {};
  const duel = { ...a, ...b, beaten: [...new Set([...(a.beaten ?? []), ...(b.beaten ?? [])])] };
  if (snap.player?.nick) duel.nick = cleanNick(snap.player.nick);
  // mergeCampusProfile does not know about later top-level fields: keep both.
  return { ...profile, ...snap.profile, ...merged, duel };
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
  for (const m of ADAPTER_METHODS) {
    const fn = typeof src[m] === 'function' ? src[m].bind(src) : local[m];
    out[m] = async (...args) => { try { return await fn(...args); } catch (e) { console.warn?.(`QueQuest adapter ${m} failed`, e); return m === 'listPlayers' ? [] : m === 'saveSnapshot' ? { ok: false } : null; } };
  }
  return out;
}

export { GHOSTS };
