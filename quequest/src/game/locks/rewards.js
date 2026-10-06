// Награды доски Сани: как pythonio-bridge.js — по своей таблице, один раз на
// id. Ключ `locks:<id>` в skillLedger гильдии (ветка ЗАЩИТНИК / SEC) и в
// awards профиля (XP). Деньги — в кошелёк (state.warehouse.wage) в main.js.
import { awardCampusXp } from '../campus-profile.js';
import { MECHANISMS } from './core.js';
import { CABINET_ROUTES } from './cabinet.js';

export const LOCKS_SKILL = 'security';
const freeze = Object.freeze;
export const LOCK_REWARDS = freeze([
  ...MECHANISMS.map((m) => freeze({ id: m.id, kind: 'mechanism', title: m.brand, xp: 60 + m.tier * 30, pay: m.tier * 80, skill: LOCKS_SKILL, skillGain: m.tier === 6 ? 2 : 1 })),
  ...CABINET_ROUTES.map((r) => freeze({ id: `cabinet-${r}`, kind: 'cabinet', title: `Шкаф Сани · ${r}`, xp: 50, pay: 60, skill: LOCKS_SKILL, skillGain: r === 'lamp' ? 1 : 0 })),
  freeze({ id: 'py-otklik', kind: 'python', title: 'Python · модель отклика', xp: 110, pay: 150, skill: 'automation', skillGain: 1 }),
  freeze({ id: 'py-shkaf', kind: 'python', title: 'Python · пути шкафа', xp: 110, pay: 150, skill: 'automation', skillGain: 1 }),
]);
export const lockRewardById = (id) => LOCK_REWARDS.find((r) => r.id === id) ?? null;
const ledgerKey = (id) => `locks:${id}`;

export function locksDone(profile = {}) {
  const ledger = profile.labs?.guild?.skillLedger ?? {};
  return LOCK_REWARDS.filter((r) => ledger[ledgerKey(r.id)]).map((r) => r.id);
}

// Pure, idempotent: the second call for the same id changes nothing and pays 0.
export function markLockReward(profile = {}, id) {
  const reward = lockRewardById(id);
  const none = { profile, first: false, pay: 0, xp: 0, skillGain: 0, reward };
  if (!reward) return { ...none, reward: null };
  const guild = profile.labs?.guild ?? {};
  const key = ledgerKey(reward.id);
  if (guild.skillLedger?.[key] || Object.prototype.hasOwnProperty.call(profile.awards ?? {}, key)) return none;
  let next = { ...profile, labs: { ...(profile.labs ?? {}), guild: { ...guild, skillLedger: { ...(guild.skillLedger ?? {}), [key]: { [reward.skill]: reward.skillGain } } } } };
  next = awardCampusXp(next, reward.xp, key);
  return { profile: next, first: true, pay: reward.pay, xp: reward.xp, skillGain: reward.skillGain, reward };
}

// X-ray of the fictional mechanism. 0 — only feel and sound; 1 «КОНТУР» —
// pins, set marks, strain and tempo (Витин AR-шлем или первое открытое
// устройство); 2 «ГЛУБИНА» — ещё и полоса натяжения следующего штифта
// (телефон и выше на лестнице устройств, или четыре открытых устройства).
export function xrayTier({ headset = false, device = 0, opened = 0 } = {}) {
  if (device >= 1 || opened >= 4) return 2;
  if (headset || opened >= 1) return 1;
  return 0;
}
