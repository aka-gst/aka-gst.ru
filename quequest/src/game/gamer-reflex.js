// 18.2 · Канон §16 и §17 в первом часе. Pure data and pure rules (no DOM):
// tools/gamer-reflex.test.mjs.
//
// §16 «Герой — геймер, который забыл, что он геймер»: three reflexes the hand
// still remembers (save, look behind the crate, a boss has a pattern), and a
// few one-line gamer slips in dialogue that people in the hall don't get.
// §17 «Знание меняет старое»: a phrase has layers of meaning,
// `meaning[id] = [слой0, слой1, …]`, picked by what the player knows; and home
// is a little different after the first quest.
//
// Everything the player has "remembered" lives in one small record in
// localStorage (REFLEX_KEY); the restart wipes it with the other quequest.* keys.

export const REFLEX_KEY = 'quequest.reflex.v1';

// ------------------------------------------------------------------ reflexes
// Each reflex goes the §13 way: the hand does it (ТЫК), the hero gets what it
// means (РУЧКИ, words), later it can be written down (КОД).
export const REFLEXES = Object.freeze({
  save: Object.freeze({
    id: 'save', sound: 'reflex-save', kicker: 'РЕФЛЕКС · СОХРАНИТЬСЯ',
    thought: 'Рука сама потянулась… будто я так делал тысячу раз.',
    unlock: 'Сохранение открыто: F5 или долгое касание часов.',
    words: 'сохранить мир = записать, что сейчас есть, чтобы вернуться',
    code: 'save(state)',
  }),
  crate: Object.freeze({
    id: 'crate', sound: 'reflex-peek', kicker: 'РЕФЛЕКС · ЗАГЛЯНУТЬ ЗА ЯЩИК',
    thought: 'Руки сами заглянули за ящик. За ящиками всегда что-то лежит…',
    found: 'ЛЕЖИТ. ПРАВДА ЛЕЖИТ.',
    words: 'проверь углы: самое нужное прячут за привычным',
  }),
  pattern: Object.freeze({
    id: 'pattern', sound: 'reflex-pattern', kicker: 'РЕФЛЕКС · ПАТТЕРН БОССА',
    thought: 'У всех боссов есть паттерн. …Откуда я это знаю?',
    hint: 'СЧИТАЙ: 1 · 2 · 3 · БАМ — ТОЛКАЙ СРАЗУ ПОСЛЕ БАМ',
    words: 'удар по столу повторяется каждые 4 такта',
    code: 'if beat % 4 == 0: push()',
  }),
});

// ----------------------------------------------------------- the boss beat
// The fight in Shift 1: a bar of 4 beats; on the 4th the boss slams his desk
// and is open for a moment right after — that is when a push lands.
export const BEAT_MS = 450;
export const BAR_BEATS = 4;
export function fightBeat(ms) {
  const t = ((ms % (BEAT_MS * BAR_BEATS)) + BEAT_MS * BAR_BEATS) % (BEAT_MS * BAR_BEATS);
  const beat = Math.floor(t / BEAT_MS); // 0..3
  const slam = beat === BAR_BEATS - 1;
  return { beat, slam, hot: slam, bar: Math.floor(ms / (BEAT_MS * BAR_BEATS)), k: (t % BEAT_MS) / BEAT_MS };
}

// ------------------------------------------------------- gamer slips (§16)
// One line from the hero, one puzzled reply. At most one per scene, each once.
export const GAMER_LINES = Object.freeze([
  Object.freeze({ id: 'where-save', scene: 'shift1-manual', me: 'Где тут сохраниться?', who: 'lunch', reply: 'Чего? (жуёт) Сохраняют огурцы. В банке.' }),
  Object.freeze({ id: 'exclamation', scene: 'shift1-report', me: 'У него над головой… восклицательный знак? А, показалось.', who: 'fitter', reply: 'Над головой у него лысина. Блестит.' }),
  Object.freeze({ id: 'tutorial', scene: 'day2-morning', me: 'Кнопка, стрелка, табличка… Это что, туториал?', who: 'welder', reply: 'Это вторник.' }),
  Object.freeze({ id: 'checkpoint', scene: 'hall-fail', me: 'Ещё раз. С чекпойнта.', who: 'fitter', reply: 'С какого пойнта? Тут смена, а не кино.' }),
  Object.freeze({ id: 'bunny-hop', scene: 'hall-jump', me: 'Зачем я прыгаю, пока жду?..', who: 'lunch', reply: 'Физкультура. Уважаю. (жуёт)' }),
]);

// The gamer line for a scene, unless this scene already had one this run or
// the line was heard before (record.lines).
export function gamerLine(scene, record = emptyRecord(), saidInScene = new Set()) {
  if (saidInScene.has(scene)) return null;
  const line = GAMER_LINES.find((l) => l.scene === scene);
  if (!line || record.lines?.[line.id]) return null;
  if (line.id === 'where-save' && record.reflexes?.save) return null; // he already knows
  return line;
}

// ---------------------------------------------------- meaning layers (§17)
// meaning[id] = [слой0, слой1, …]. A layer opens when the player knows every
// word in `needs`. `seam` is the code under the words, flickered once when
// the line is heard in a new layer.
export const MEANING = Object.freeze({
  'loader.bread': Object.freeze({
    who: 'lunch',
    layers: Object.freeze([
      Object.freeze({ text: 'Мне жена так и говорит: если хлеб белый — бери, если нет — не трогай. (жуёт)' }),
      Object.freeze({ needs: Object.freeze(['if']), text: 'Если белый — бери, если нет — не трогай. (жуёт) Ты чего? Это про хлеб.', seam: 'if хлеб == "белый": взять()' }),
    ]),
  }),
  'boss.button': Object.freeze({
    who: 'radio',
    layers: Object.freeze([
      Object.freeze({ text: 'Чего тебе? Нет кнопки — нет руки. Таскай руками!' }),
      Object.freeze({ needs: Object.freeze(['if']), text: 'Нет кнопки — нет руки… (пауза) А она ездит. Ладно. Работай.', seam: 'if not кнопка: рука = None   # условие не сбылось' }),
    ]),
  }),
  'vitya.gate': Object.freeze({
    who: 'neighbor',
    layers: Object.freeze([
      Object.freeze({ text: 'О, сосед! Опять ночью со своим шлюзом?' }),
      Object.freeze({ needs: Object.freeze(['if']), text: 'О, сосед! Опять со своим шлюзом? Своих пускать, чужих нет — как в подъезде.', seam: 'if машина == "своя": открыть()' }),
    ]),
  }),
});

// What the player knows, as words: from the game state's learning flags and
// the reflexes the hand remembered.
export function knowledgeFrom({ learning = {}, record = emptyRecord() } = {}) {
  const k = new Set();
  if (learning.printUnlocked) k.add('print');
  if (learning.ifUnlocked) k.add('if');
  if (learning.forUnlocked) k.add('for');
  if (learning.whileUnlocked) k.add('while');
  if (learning.funcUnlocked) k.add('def');
  for (const [id, on] of Object.entries(record.reflexes ?? {})) if (on) k.add(`reflex:${id}`);
  return k;
}

export function meaningLayer(id, knows = new Set()) {
  const def = MEANING[id];
  if (!def) return -1;
  let best = 0;
  def.layers.forEach((layer, i) => { if ((layer.needs ?? []).every((w) => knows.has(w))) best = i; });
  return best;
}

// Hear a phrase: which layer, its text, and whether it now means more than
// the last time this player heard it (then the seam flickers). Returns the
// line and the updated record (pure).
export function hearMeaning(id, knows = new Set(), record = emptyRecord()) {
  const def = MEANING[id];
  if (!def) return { line: null, record };
  const layer = meaningLayer(id, knows);
  const before = record.heard?.[id];
  const changed = before !== undefined && layer > before;
  const L = def.layers[layer];
  const next = { ...record, heard: { ...(record.heard ?? {}), [id]: Math.max(layer, before ?? -1) } };
  return { line: { id, who: def.who, layer, text: L.text, seam: changed ? (L.seam ?? null) : null, changed }, record: next };
}

// -------------------------------------------------------- home changes (§17)
// After a quest, one thing at home is a little different. The first time
// the hero notices it with one quiet line.
export const HOME_CHANGES = Object.freeze([
  Object.freeze({
    id: 'monitor-note', after: 'quest1',
    // A sticky note on the monitor (seen in every engine era) and a faint
    // cyan by the PC, the colour of the chip (seen once the engine has light).
    sprite: 'note', at: Object.freeze({ x: 5.84, z: 1.47, y: 1.5 }),
    lamp: Object.freeze({ group: 'chip-light', x: 5.6, z: 1.9, radius: 2.8, intensity: 0.75, color: Object.freeze([0.35, 0.95, 1.15]) }),
    hint: 'Стикер на мониторе. Моим почерком: F5. Я его не клеил…',
  }),
]);

// Which home changes are on: a quest counts once its flag is in the record
// (quest1 = the first shift ended with the chip; old saves past it count too).
export function homeChanges(record = emptyRecord(), { checkpoint = 'start' } = {}) {
  const done = new Set(Object.keys(record.quests ?? {}).filter((q) => record.quests[q]));
  if (checkpoint && checkpoint !== 'start' && checkpoint !== 'prologue') done.add('quest1');
  return HOME_CHANGES.filter((c) => done.has(c.after));
}

// ---------------------------------------------------------- save (F5)
// What a save keeps, shown to the player: words first; once the player
// writes code, the same thing as a line of Python (§13: button → words → code).
export function saveSnapshot({ checkpoint = 'start', learning = {}, warehouse = {} } = {}) {
  const day = checkpoint === 'start' || checkpoint === 'warehouse' || checkpoint === 'chip' ? 1
    : (learning.chapter >= 4 ? 3 : 2);
  const knows = ['print', 'if', 'for', 'while', 'def'].filter((w) => knowledgeFrom({ learning }).has(w));
  return { day, place: 'склад 07', wage: Math.max(0, Number(warehouse.wage) || 0), knows, checkpoint };
}
export function saveWords(snap) {
  const parts = [`день ${snap.day}`, snap.place, `${snap.wage} ₽`];
  if (snap.knows.length) parts.push(`знаешь: ${snap.knows.join(', ')}`);
  if (snap.checkpoint === 'start') parts.push('смена — с начала');
  return parts.join(' · ');
}
export function saveCode(snap) {
  const knows = snap.knows.map((w) => `"${w}"`).join(', ');
  return `save({"день": ${snap.day}, "₽": ${snap.wage}, "знаю": [${knows}]})`;
}
// Words until the player has written code (print), then code.
export function saveReport(snap) {
  return snap.knows.length ? { mode: 'code', text: saveCode(snap) } : { mode: 'words', text: saveWords(snap) };
}

// -------------------------------------------------------------- the record
export function emptyRecord() { return { reflexes: {}, lines: {}, heard: {}, quests: {}, homeSeen: {} }; }

function normalize(raw) {
  const r = emptyRecord();
  if (!raw || typeof raw !== 'object') return r;
  for (const key of Object.keys(r)) {
    const v = raw[key];
    if (v && typeof v === 'object' && !Array.isArray(v)) r[key] = { ...v };
  }
  return r;
}

export function loadRecord(storage = globalThis.localStorage) {
  try { return normalize(JSON.parse(storage?.getItem(REFLEX_KEY) ?? 'null')); } catch { return emptyRecord(); }
}
export function saveRecord(storage = globalThis.localStorage, record = emptyRecord()) {
  try { storage?.setItem(REFLEX_KEY, JSON.stringify(normalize(record))); return true; } catch { return false; }
}

// Mark something in the record: { first, record }.
export function mark(record, bucket, id, value = true) {
  const r = normalize(record);
  const first = !r[bucket][id];
  r[bucket] = { ...r[bucket], [id]: value };
  return { first, record: r };
}
