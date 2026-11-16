import { WEEK, weekDayOf, nextWorkAfter } from './week.js';

export const HOME_KEY = 'quequest.home.life.v1';
export const HOME_PRICES = Object.freeze({ feed: 20, electricity: 40, room: 60, deskLamp: 240 });

export function homeAccess(checkpoint = 'start', flags = {}) {
  const day = weekDayOf(checkpoint);
  const firstDayDone = WEEK.some(d => d.pay === checkpoint) || day > 1;
  const later = !['start', 'warehouse', 'chip', 'd1-button'].includes(checkpoint) && !day;
  return { unlocked: Boolean(flags.shocked || firstDayDone || later), day: day || 1,
    garage: Boolean(flags.vityaCalled || flags.vityaGarage || later), nextWork: nextWorkAfter(checkpoint) };
}

export function homeTransaction(previous = {}, wallet = 0, day = 1, action) {
  const life = { ...previous, fedDays: [...new Set(Array.isArray(previous.fedDays) ? previous.fedDays : [])] };
  const balance = Number.isFinite(Number(wallet)) ? Math.max(0, Number(wallet)) : 0;
  const already = action === 'feed' ? life.fedDays.includes(day) : Boolean(life[action]);
  const cost = Object.hasOwn(HOME_PRICES, action) ? HOME_PRICES[action] : null;
  if (!cost) return { ok: false, life, wallet: balance, text: 'Такого улучшения нет.' };
  if (already) return { ok: false, life, wallet: balance, text: action === 'feed' ? 'Кот уже поел сегодня. Мрр.' : 'Уже оплачено — второй раз деньги не списываются.' };
  if (balance < cost) return { ok: false, life, wallet: balance, text: `Нужно ${cost} ₽. Сейчас ${balance} ₽ — можно вернуться после смены.` };
  if (action === 'feed') life.fedDays.push(day); else life[action] = true;
  const text = { feed: 'Кот поел и замурчал. −20 ₽.', electricity: 'Свет оплачен. Компьютер работает. −40 ₽.', room: 'Открыты остальные комнаты квартиры. −60 ₽.', deskLamp:'Лампа на столе установлена. Светлее работать дома. −240 ₽.' }[action];
  return { ok: true, life, wallet: balance - cost, text };
}

export function loadHomeLife(storage = globalThis.localStorage) {
  try { const v = JSON.parse(storage?.getItem(HOME_KEY) || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch { return {}; }
}
