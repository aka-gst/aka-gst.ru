// 19.1 · КАРТОЧКА ДАЙВЕРА (canon §19). One pure view of the §13 mastery grid
// as nine areas a person understands — «насколько ты мощный» per area, the
// way VitalSchool showed a student per subject. Power comes from PROOFS on
// floors (way × stage), never from raw XP: XP stays the rank.
//
//   diverCard(profile) -> { nick, avatar, rank, areas[9], strongest, weakest, suggest, proofs }
//
// Power of one skill = floor base (ТЫК 0 · РУЧКИ 15 · КОД 30 · С НУЛЯ 50)
// + 8 × stage on that floor (1..5), + 1 per extra proof (max +10), cap 100.
// That is the honest proof layer; the live % of every topic starts from it
// and moves with play (see TOPICS below).

import { WAYS, SKILLS } from './mastery.js';
import { getCampusRank } from './campus-profile.js?v=campus-profile-7';
import { plainRank } from './career-worlds.js?v=career-11';

const freeze = (v) => Object.freeze(v);

// buff: what a right answer on this area gives in a duel (duel.js BUFFS).
export const AREAS = freeze([
  freeze({ id: 'say', name: 'Сказать машине', short: 'СКАЗ', glyph: '›_', skills: freeze(['print']), buff: 'attack' }),
  freeze({ id: 'if', name: 'Условия', short: 'УСЛ', glyph: '⑂', skills: freeze(['if', 'route']), buff: 'attack' }),
  freeze({ id: 'loop', name: 'Циклы', short: 'ЦИКЛ', glyph: '↻', skills: freeze(['for', 'while']), buff: 'double' }),
  freeze({ id: 'auto', name: 'Автоматизация', short: 'АВТО', glyph: '⚙', skills: freeze(['def', 'dict', 'class']), buff: 'auto' }),
  freeze({ id: 'guard', name: 'Защита', short: 'ЗАЩ', glyph: '⬡', skills: freeze(['guard', 'lock']), buff: 'shield' }),
  freeze({ id: 'web', name: 'Сайты', short: 'САЙТ', glyph: '▦', skills: freeze(['site']), buff: 'heal' }),
  freeze({ id: 'ai', name: 'ИИ', short: 'ИИ', glyph: '◉', skills: freeze(['train', 'light']), buff: 'aura' }),
  freeze({ id: 'city', name: 'Город и надёжность', short: 'ГОРОД', glyph: '▲', skills: freeze(['cascade', 'try']), buff: 'heal' }),
  freeze({ id: 'hw', name: 'Железо', short: 'ЖЕЛ', glyph: '⏚', skills: freeze(['bits']), buff: 'attack' }),
]);
export const AREA_IDS = freeze(AREAS.map((a) => a.id));
export const areaById = (id) => AREAS.find((a) => a.id === id) ?? null;
export function areaOfSkill(skill) { return AREAS.find((a) => a.skills.includes(skill))?.id ?? null; }

// Every mastery skill belongs to exactly one area (tests hold this).
export const UNMAPPED = freeze(Object.keys(SKILLS).filter((s) => !areaOfSkill(s)));

const FLOOR_BASE = freeze({ tap: 0, knobs: 15, code: 30, raw: 50 });
export const FLOOR_WORDS = freeze({ tap: 'кнопкой', knobs: 'настройками', code: 'кодом', raw: 'с нуля' });

export function skillPower(entry) {
  if (!entry) return 0;
  let best = 0;
  for (const w of WAYS) {
    const s = Math.max(0, Math.min(5, Number(entry.ways?.[w]) || 0));
    if (s > 0) best = Math.max(best, FLOOR_BASE[w] + 8 * s);
  }
  if (!best) return 0;
  const extra = Math.max(0, Math.min(10, (entry.proofs?.length ?? 0) - 1));
  return Math.min(100, best + extra);
}

// «Насколько ты мощный» — five plain words.
export const POWER_WORDS = freeze([[0, 'не пробовал'], [1, 'искра'], [25, 'в деле'], [50, 'сильный'], [75, 'мощный'], [90, 'легенда']]);
export function powerWord(p = 0) { let w = POWER_WORDS[0][1]; for (const [min, word] of POWER_WORDS) if (p >= min) w = word; return w; }

// Proof layer: what the §13 grid honestly shows for an area.
export function areaProofs(profile = {}, area) {
  const a = typeof area === 'string' ? areaById(area) : area;
  const mastery = profile.mastery ?? {};
  const skills = a.skills.map((id) => ({ id, power: skillPower(mastery[id]), entry: mastery[id] ?? null }));
  const sorted = [...skills].sort((x, y) => y.power - x.power);
  const top = sorted[0]?.power ?? 0;
  const breadth = sorted.slice(1).filter((s) => s.power > 0).length * 3;
  const proofs = skills.flatMap((s) => s.entry?.proofs ?? []);
  let best = null;
  for (const s of skills) for (const w of WAYS) if ((s.entry?.ways?.[w] ?? 0) > 0 && WAYS.indexOf(w) > WAYS.indexOf(best ?? 'none')) best = w;
  // «подтверждено»: a proof without hints at stage 3+, or three separate proofs.
  const confirmed = proofs.some((p) => (p.stage ?? 1) >= 3 && !(p.hints > 0)) || proofs.length >= 3;
  return { power: Math.min(100, top ? top + breadth : 0), proofs: proofs.length, confirmed, best };
}

// ---------------------------------------------------------- topics
// What the quick tasks are about, area by area. Every topic names a thing
// you do in Глубина and the §13 skill a right answer proves. `task: false`
// topics have no quick task yet (their proofs come from the big games).
export const TOPICS = freeze([
  ['say.print', 'say', 'Сказать машине: print', 'print'], ['say.text', 'say', 'Слово в кавычках', 'print'], ['say.bug', 'say', 'Найди опечатку', 'print'],
  ['if.ifelse', 'if', 'Если… то… иначе', 'if'], ['if.elif', 'if', 'Лесенка условий', 'if'], ['if.andor', 'if', 'Два условия: и / или', 'route'], ['if.bug', 'if', 'Двоеточие и ==', 'if'],
  ['loop.for', 'loop', 'Повтори N раз', 'for'], ['loop.list', 'loop', 'Для каждого ящика', 'for'], ['loop.while', 'loop', 'Пока есть работа', 'while'], ['loop.bug', 'loop', 'Ошибка в цикле', 'for'],
  ['auto.def', 'auto', 'Свой навык с именем', 'def'], ['auto.return', 'auto', 'Вернуть ответ', 'def'], ['auto.dict', 'auto', 'Свойства вещей', 'dict', false], ['auto.class', 'auto', 'Вещи с методами', 'class', false],
  ['guard.door', 'guard', 'Сторож у двери', 'guard'], ['guard.lock', 'guard', 'Замки и отмычки', 'lock', false],
  ['web.title', 'web', 'Что видно первым', 'site'], ['web.honest', 'web', 'Честная кнопка', 'site'],
  ['ai.fake', 'ai', 'Приметы подделки', 'train'], ['ai.light', 'ai', 'Свет и картинка', 'light', false],
  ['city.walls', 'city', 'Перегородки от поломок', 'cascade'], ['city.try', 'city', 'Пережить ошибку', 'try', false],
  ['hw.read', 'hw', 'Биты 8-4-2-1', 'bits'], ['hw.make', 'hw', 'Набрать число битами', 'bits'],
].map(([id, area, name, skill, task = true]) => freeze({ id, area, name, skill, task })));
export const topicById = (id) => TOPICS.find((t) => t.id === id) ?? null;

// One area of the card: power from proofs, the four floors reached (best
// stage on each, across the area's skills), and its topics.
export function areaRating(profile = {}, area) {
  const a = typeof area === 'string' ? areaById(area) : area;
  const pr = areaProofs(profile, a);
  const mastery = profile.mastery ?? {};
  const floors = WAYS.map((w) => Math.max(0, ...a.skills.map((sk) => Number(mastery[sk]?.ways?.[w]) || 0)));
  const topics = TOPICS.filter((t) => t.area === a.id).map((t) => ({ id: t.id, name: t.name, task: t.task, proofs: mastery[t.skill]?.proofs?.length ?? 0 }));
  return { id: a.id, name: a.name, short: a.short, glyph: a.glyph, buff: a.buff, power: pr.power, word: powerWord(pr.power), floors, topics, proofs: pr.proofs, confirmed: pr.confirmed, best: pr.best, bestWord: pr.best ? FLOOR_WORDS[pr.best] : '' };
}

// Where to go next for an area: a real place in the game, then a duel topic.
export const AREA_QUESTS = freeze({
  say: 'Неделя на складе: день 1–2 — сказать руке «wake»',
  if: 'Гараж Вити: ночь 1 — правило сторожа',
  loop: 'Склад, день 5 — вся линия сама (цикл)',
  auto: 'Инженер · Питонио: заказ Лиды — свой def route()',
  guard: 'Проба «Сетевик»: сервер Тимура',
  web: 'Проба «Создатель сайтов»: пироги Нины Петровны',
  ai: 'Проба «Тренер ИИ»: отзывы кофейни Зарины',
  city: 'Проба «Спасатель города»: свет на Заречной',
  hw: 'Проба «Знаток железа»: радио деда Миши',
});

export const AVATARS = freeze([
  freeze({ id: 0, name: 'Неон', suit: '#2ad4ff', visor: '#d9fbff', trim: '#0a6b85' }),
  freeze({ id: 1, name: 'Ржавчина', suit: '#ff8a3d', visor: '#ffe3c2', trim: '#8a3a0a' }),
  freeze({ id: 2, name: 'Мята', suit: '#4cffb0', visor: '#e4fff2', trim: '#0d7a4f' }),
  freeze({ id: 3, name: 'Сирень', suit: '#b28cff', visor: '#efe6ff', trim: '#4b2a99' }),
  freeze({ id: 4, name: 'Лимон', suit: '#ffe14d', visor: '#fffbe0', trim: '#8a7400' }),
  freeze({ id: 5, name: 'Коралл', suit: '#ff5c8a', visor: '#ffe0ea', trim: '#8a1a3a' }),
  freeze({ id: 6, name: 'Сталь', suit: '#9fb3c8', visor: '#f0f6ff', trim: '#3a4a5c' }),
  freeze({ id: 7, name: 'Хвоя', suit: '#7fc94a', visor: '#efffe0', trim: '#2f5d12' }),
]);

export const NICK_MAX = 12;
export function cleanNick(s = '') {
  const t = String(s).replace(/[^A-Za-zА-ЯЁа-яё0-9 ._-]/g, '').replace(/\s+/g, ' ').trim().slice(0, NICK_MAX);
  return t || 'Дайвер';
}

export function diverCard(profile = {}) {
  const xp = Math.max(0, Number(profile.xp) || 0);
  const r = getCampusRank(xp);
  const areas = AREAS.map((a) => areaRating(profile, a));
  const tried = areas.filter((a) => a.power > 0);
  const strongest = tried.length ? [...tried].sort((x, y) => y.power - x.power)[0] : null;
  // Weakest: the lowest area you already touched; if you touched under
  // three, the first area you never tried (that is what to pull up next).
  const untried = areas.filter((a) => a.power === 0);
  const weakest = tried.length >= 3 ? [...tried].sort((x, y) => x.power - y.power)[0] : (untried[0] ?? [...areas].sort((x, y) => x.power - y.power)[0]);
  const suggest = weakest ? { area: weakest.id, quest: AREA_QUESTS[weakest.id], duel: weakest.name, text: `Подтяни «${weakest.name}»: ${AREA_QUESTS[weakest.id]} — или дуэль на эту тему.` } : null;
  const d = profile.duel ?? {};
  return {
    nick: cleanNick(d.nick),
    avatar: Math.max(0, Math.min(AVATARS.length - 1, Number(d.avatar) || 0)),
    rank: plainRank(r.name), rankIndex: r.index, next: r.next ? plainRank(r.next.name) : null, toNext: r.next ? Math.max(0, r.next.xp - xp) : 0, progress: r.progress, xp,
    areas, strongest, weakest, suggest,
    proofs: areas.reduce((s, a) => s + a.proofs, 0),
    power: Math.round(areas.reduce((s, a) => s + a.power, 0) / areas.length),
    ring: ringRecord(d), history: [...(d.history ?? [])].slice(-8),
  };
}

export function ringRecord(d = {}) {
  const st = d.stats ?? {};
  const sum = (k) => ['duel', 'storm', 'hack'].reduce((n, m) => n + (Number(st[m]?.[k]) || 0), 0);
  return { played: sum('played'), won: sum('won'), beaten: [...(d.beaten ?? [])] };
}

// The nine powers as a plain array (share codes, ghosts, the class mock).
export function powersOf(card) { return AREA_IDS.map((id) => card.areas.find((a) => a.id === id)?.power ?? 0); }
