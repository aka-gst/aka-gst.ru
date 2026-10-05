// 17.4 · ЛЕСТНИЦА ДВИЖКА. Сергей 02.10: «почему это не именно что движки?
// Движок же сам по себе улучшается — в этом прикол. … Ты программируешь, и
// мир у тебя вокруг улучшается со всех сторон.» And earlier: «за каждое
// выполненное чуть-чуть где-то становилось лучше, и ты это видел визуально».
//
// The engine is a ladder of real rendering techniques. Every step is one
// feature flag the renderers actually implement (raycaster.js for the column
// tiers, gl-renderer.js / soft-raster.js for the polygon tiers). Every
// completed thing in the game -- a learned Python move, a rank, a held
// profession day, a shift, a fixed machine, an ENGINE.EXE purchase -- turns on
// the next step. The era names (Wolfenstein … Half-Life) are milestones: an
// era is reached when every feature of its group is on.
//
// Pure: no DOM. tools/engine-ladder.test.mjs pins the order and the mapping.

const freeze = Object.freeze;

// era: 0 wolf, 1 doom, 2 duke, 3 quake, 4 unreal, 5 hl, 6 rtx (beyond HL).
// tier: 'ray' -- the column raycaster draws it; 'poly' -- the polygon
// renderer does. name: what the player sees; what: what changes in the
// picture; py: the idea in Python the player already knows.
const F = (id, era, tier, name, what, py) => freeze({ id, era, tier, name, what, py });
export const FEATURES = freeze([
  F('rays', 0, 'ray', 'ЛУЧИ ПО СТОЛБЦАМ',
    'Стены — вертикальные полоски. На каждый столбец экрана бросается один луч по сетке клеток; чем дальше стена, тем полоска ниже.',
    'for x in range(ширина): d = луч(x); высота = H / d'),
  F('flats', 1, 'ray', 'ТЕКСТУРЫ НА ПОЛУ И ПОТОЛКЕ',
    'Пол и потолок больше не заливка: для каждой строки ниже горизонта считаем, какая точка пола туда попала, и берём её пиксель из текстуры.',
    'for y in range(горизонт, низ): d = глаз / (y - горизонт); u, v = x0 + dx * d, z0 + dz * d'),
  F('distLight', 1, 'ray', 'СВЕТ ГАСНЕТ С РАССТОЯНИЕМ',
    'Дальнее темнее ближнего (diminished lighting в Doom). Глубина читается сама собой.',
    'яркость = 1 / (1 + d * k)'),
  F('palette', 1, 'ray', 'ПАЛИТРА VGA · 256 ЦВЕТОВ',
    'Было по 6 оттенков на канал, стало по 16 с подмешиванием (dither) — градиенты почти плавные.',
    'c = round(c / шаг) * шаг   # шаг = 255 / (уровней - 1)'),
  F('lightmap', 1, 'ray', 'КАРТА СВЕТА ОТ ЛАМП',
    'Каждая лампа заранее «запекается» в сетку яркостей: под лампой светло, в углах темно. Выключатель пересчитывает сетку.',
    'свет[i][j] = sum(сила * (1 - d / r) ** 2 for лампа in лампы)'),
  F('liquids', 1, 'ray', 'ЖИВАЯ ВОДА',
    'Лужи у ворот, масло на полу, вода в ванне текут и колышутся: координаты текстуры каждый кадр сдвигаются синусом.',
    'u += sin(v * 0.2 + t * 2) * 3; v += cos(u * 0.2 + t * 1.7) * 3'),
  F('res200', 1, 'ray', 'РАЗРЕШЕНИЕ 320×200',
    'Кадр в 1,7 раза выше: 200 строк вместо 120. Текстуры полного размера, не половинные.',
    'кадр = [[0] * 320 for _ in range(200)]'),
  F('yshear', 2, 'ray', 'ВЗГЛЯД ВВЕРХ-ВНИЗ (СДВИГ ГОРИЗОНТА)',
    'Build не умеет наклонять камеру — он сдвигает строку горизонта. Вертикали остаются вертикальными, но смотреть уже можно.',
    'горизонт = H // 2 + наклон   # всё остальное — тот же луч'),
  F('mirrors', 2, 'ray', 'ЗЕРКАЛА',
    'Луч, попавший в зеркало, разворачивается и летит дальше из отражённой камеры. В зеркале видно тебя.',
    "if клетка == 'зеркало': dx = -dx   # и цикл луча продолжается"),
  F('colorLamps', 2, 'ray', 'ЦВЕТНЫЕ ЛАМПЫ',
    'Свет теперь не одно число, а тройка (r, g, b): тёплая лампа над верстаком, холодная — под потолком.',
    'свет = (r * k, g * k, b * k)   # вместо одного k'),
  F('smoothLight', 2, 'ray', 'ПЛАВНЫЙ СВЕТ (ИНТЕРПОЛЯЦИЯ)',
    'Свет между соседними точками карты смешивается, ступеньки яркости исчезают.',
    'свет = a + (b - a) * t'),
  F('polys', 3, 'poly', 'ПОЛИГОНАЛЬНЫЙ МИР',
    'Из клеток уровня строятся настоящие треугольники: стены, пол, ступени. Их рисуют от дальних к ближним — алгоритм художника.',
    'for t in sorted(треугольники, key=дальность, reverse=True): нарисовать(t)'),
  F('zbuffer', 3, 'poly', 'Z-БУФЕР',
    'У каждого пикселя запоминается глубина. Ближнее всегда побеждает, даже если нарисовано раньше — без сортировки и без ошибок перекрытия.',
    'if z < глубина[i]: глубина[i] = z; кадр[i] = цвет'),
  F('trueLook', 3, 'poly', 'НАСТОЯЩИЙ НАКЛОН КАМЕРЫ',
    'Камера поворачивается матрицей: вверх-вниз и крен при шаге вбок. Вертикали сходятся, как в жизни.',
    'y2 = y * cos(a) - z * sin(a); z2 = y * sin(a) + z * cos(a)'),
  F('polyLightmap', 3, 'poly', 'LIGHTMAP НА ПОЛИГОНАХ',
    'Свет запекается в маленькую текстуру на каждой грани — с тенями от стен (луч к лампе проверяет, не мешает ли что-то).',
    'lm[грань][u][v] = свет(точка) if видно(точка, лампа) else тень'),
  F('truecolor', 3, 'poly', '16 МИЛЛИОНОВ ЦВЕТОВ',
    'Палитра больше не нужна: каждый пиксель — свои r, g, b от 0 до 255.',
    'пиксель = (r, g, b)'),
  F('props3d', 3, 'poly', 'НАСТОЯЩИЕ 3D-ПРЕДМЕТЫ',
    'Машина, ноутбук, лампы, кот — не плоские картинки, а модели из вершин и граней. Их можно обойти кругом.',
    'вершины = [(x, y, z), ...]; грани = [(0, 1, 2), ...]'),
  F('bilinear', 4, 'poly', 'БИЛИНЕЙНАЯ ФИЛЬТРАЦИЯ',
    'Вблизи текстура не рассыпается на квадраты: цвет смешивается из четырёх соседних текселей.',
    'c = смесь(смесь(c00, c10, fx), смесь(c01, c11, fx), fy)'),
  F('mipmaps', 4, 'poly', 'MIP-КАРТЫ',
    'Для дальних стен берётся заранее уменьшенная копия текстуры — рябь и мерцание вдали пропадают.',
    'мипы = [текстура]\nwhile мипы[-1].w > 1: мипы.append(уменьшить_вдвое(мипы[-1]))'),
  F('dynLights', 4, 'poly', 'ЦВЕТНОЙ ДИНАМИЧЕСКИЙ СВЕТ',
    'Мигалки, экран ноутбука, телевизор светят цветом на каждый пиксель стен — в шейдере, каждый кадр.',
    'for л in лампы: цвет += л.цвет * max(0, dot(n, к_лампе)) * (1 - d / л.r) ** 2'),
  F('skybox', 4, 'poly', 'НЕБО-КУБ',
    'Над улицей и за окнами — ночное небо и город на шести гранях куба. Оно бесконечно далеко и поворачивается вместе с взглядом.',
    'цвет = небо[направление_взгляда]   # позиция камеры не важна'),
  F('glass', 4, 'poly', 'СТЕКЛО И ВОДА',
    'Окна и стёкла машины прозрачные, в ванне вода. Полупрозрачное рисуется последним, от дальнего к ближнему, и смешивается с фоном.',
    'цвет = фон * (1 - a) + стекло * a'),
  F('hires', 4, 'poly', 'ВЫСОКОЕ РАЗРЕШЕНИЕ',
    'Кадр 540 строк и текстуры удвоенной детализации.',
    'w, h = 960, 540'),
  F('normalMaps', 5, 'poly', 'КАРТЫ НОРМАЛЕЙ',
    'У каждой точки текстуры своя нормаль: кирпич, плитка и швы получают объём от лампы, хотя стена плоская.',
    'n = нормаль(текстура, u, v); свет *= max(0, dot(n, к_лампе))'),
  F('detail', 5, 'poly', 'ДЕТАЛЬНЫЕ ТЕКСТУРЫ',
    'Вблизи поверх текстуры ложится мелкий шум — бетон и дерево не мылятся, когда подходишь в упор.',
    'цвет *= 2 * шум[(u * 8) % 1][(v * 8) % 1]'),
  F('decals', 5, 'poly', 'ДЕКАЛИ',
    'Пятна масла под машиной, трещины, следы шин, плакат — наклейки поверх геометрии.',
    "декали.append((точка, нормаль, 'масло'))"),
  F('fog', 5, 'poly', 'ТУМАН-ОБЪЁМ',
    'Воздух густеет с расстоянием и у пола: дальние стены тонут в дымке, по улице стелется морось.',
    'f = 1 - exp(-плотность * d); цвет = цвет * (1 - f) + туман * f'),
  F('shadows', 5, 'poly', 'ТЕНИ ОТ ЛАМПЫ (SHADOW MAP)',
    'Главная лампа смотрит вниз и запоминает глубину. Если точка дальше, чем то, что лампа видит, — она в тени. Тени от машины, мебели, кота.',
    'в_тени = расстояние(p, лампа) > глубина_из_лампы[проекция(p)]'),
  F('animProps', 5, 'poly', 'АНИМАЦИЯ ПРЕДМЕТОВ (КОСТИ)',
    'У предметов появились суставы: вентилятор крутится, дверь поворачивается на петлях, кот дышит и машет хвостом.',
    'for кость in скелет: кость.угол = sin(t) * размах; точка = родитель @ поворот(угол)'),
  F('bloom', 5, 'poly', 'СВЕЧЕНИЕ И ГАММА',
    'После кадра: яркое выделяется, размывается и добавляется обратно; затем гамма-коррекция. Лампы светятся, тёмное не проваливается.',
    'кадр += размыть([c if c > 1 else 0 for c in кадр]); c = c ** (1 / 2.2)'),
  F('rtx', 6, 'poly', 'ТРАССИРОВКА ЛУЧЕЙ (RTX)',
    'Для каждого пикселя видеокарта пускает настоящий луч по клеткам уровня: отражения в краске машины, в лужах и плитке, мягкие тени от лампы. Если кадр не успевает — честно выключается.',
    'for пиксель in кадр: луч = отразить(взгляд, n); цвет += 0.3 * трассировать(луч, сетка)'),
]);

export const MAX_LEVEL = FEATURES.length - 1;
export const FEATURE_IDS = freeze(FEATURES.map((f) => f.id));
export const ERA_IDS = freeze(['wolf', 'doom', 'duke', 'quake', 'unreal', 'hl', 'rtx']);
export const ERA_NAMES = freeze(['WOLFENSTEIN 3D', 'DOOM', 'DUKE NUKEM 3D', 'QUAKE', 'QUAKE II / UNREAL', 'HALF-LIFE', 'RTX']);
// The last feature of each era group: the era is reached when it is on.
export const ERA_END = freeze(ERA_IDS.map((_, e) => FEATURES.reduce((last, f, i) => (f.era === e ? i : last), -1)));
// The first feature of each era group.
export const ERA_START = freeze(ERA_IDS.map((_, e) => FEATURES.findIndex((f) => f.era === e)));
export const POLY_LEVEL = FEATURES.findIndex((f) => f.tier === 'poly');

export function clampLevel(n) {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.max(0, Math.min(MAX_LEVEL, v)) : 0;
}

// Features 0..level are on.
export function featureFlags(level = 0) {
  const L = clampLevel(level);
  const flags = {};
  FEATURES.forEach((f, i) => { flags[f.id] = i <= L; });
  flags.level = L;
  flags.era = eraOfLevel(L);
  flags.poly = L >= POLY_LEVEL;
  return freeze(flags);
}

// The era milestone the engine has reached (every feature of it is on).
export function eraOfLevel(level = 0) {
  const L = clampLevel(level);
  let era = 0;
  for (let e = 0; e < ERA_END.length; e++) if (L >= ERA_END[e]) era = e;
  return era;
}
// ?era=N means "all features up to that era".
export function levelForEra(era = 0) {
  const e = Math.max(0, Math.min(ERA_END.length - 1, Math.round(Number(era)) || 0));
  return ERA_END[e];
}

// ------------------------------------------------------------ unlocks
// Every completed thing is one step up the ladder.
const MOVE_KEYS = freeze(['printUnlocked', 'forUnlocked', 'ifUnlocked', 'listUnlocked', 'whileUnlocked', 'funcUnlocked', 'dictUnlocked',
  'reliabilityUnlocked', 'asyncUnlocked', 'aiUnlocked', 'llmUnlocked', 'botUnlocked']);
export const UNLOCK_SOURCES = freeze([
  freeze({ id: 'moves', name: 'выученная команда Python', per: 1 }),
  freeze({ id: 'shifts', name: 'отработанная смена на складе', per: 1 }),
  freeze({ id: 'fixes', name: 'починенная машина', per: 1 }),
  freeze({ id: 'rank', name: 'новый ранг', per: 1 }),
  freeze({ id: 'days', name: 'выдержанный день профессии', per: 1 }),
  freeze({ id: 'upgrades', name: 'апгрейд ДВИЖОК.EXE', per: 1 }),
]);

export function engineDeeds({ learning = {}, rankIndex = 0, realmDays = 0, upgrades = 0, chapter = null, armFixed = false, fixes = null } = {}) {
  const moves = MOVE_KEYS.filter((k) => learning[k]).length;
  const ch = chapter ?? learning.chapter ?? 1;
  const shifts = Math.max(0, (Number(ch) | 0) - 1);
  const fixed = fixes ?? (armFixed ? 1 : 0);
  const d = {
    moves, shifts, fixes: Math.max(0, fixed | 0), rank: Math.max(0, rankIndex | 0),
    days: Math.max(0, realmDays | 0), upgrades: Math.max(0, upgrades | 0),
  };
  d.total = d.moves + d.shifts + d.fixes + d.rank + d.days + d.upgrades;
  return d;
}
export function levelFromDeeds(deeds = {}) { return clampLevel(deeds.total ?? 0); }

// Where the player stands on the ladder.
export function ladderStatus(deeds = {}) {
  const total = deeds.total ?? 0;
  const level = clampLevel(total);
  const era = eraOfLevel(level);
  const nextEra = era + 1 < ERA_END.length ? era + 1 : null;
  return {
    level, total, era, eraName: ERA_NAMES[era],
    feature: FEATURES[level], next: level < MAX_LEVEL ? FEATURES[level + 1] : null,
    nextEra, nextEraName: nextEra === null ? null : ERA_NAMES[nextEra],
    toNextEra: nextEra === null ? 0 : ERA_END[nextEra] - level,
    on: level + 1, of: FEATURES.length,
  };
}

// ?engine=N (feature level, 0..MAX) wins over ?era=N (0..5 or a name).
export function levelFromQuery(search = '') {
  const params = new URLSearchParams(String(search).replace(/^\?/, ''));
  if (params.has('engine')) {
    const raw = params.get('engine').trim().toLowerCase();
    const byId = FEATURE_IDS.indexOf(raw);
    if (byId >= 0) return byId;
    if (/^\d+$/.test(raw)) return clampLevel(raw);
  }
  if (params.has('era')) {
    const raw = params.get('era').trim().toLowerCase();
    const alias = { wolf3d: 'wolf', build: 'duke', goldsrc: 'hl', 'half-life': 'hl', q2: 'unreal' };
    const id = alias[raw] ?? raw;
    const e = ERA_IDS.indexOf(id);
    if (e >= 0) return levelForEra(e);
    if (/^\d+$/.test(raw)) return levelForEra(Number(raw));
  }
  return null;
}

// The in-world moment when the engine grows: which features just came on,
// and whether an era milestone was reached on the way.
export function featureMoment(seen, level) {
  const to = clampLevel(level);
  if (seen === null || seen === undefined || !(to > seen)) return null;
  const from = clampLevel(seen);
  const gained = FEATURES.slice(from + 1, to + 1);
  const eraFrom = eraOfLevel(from), eraTo = eraOfLevel(to);
  return {
    from, to, gained, feature: FEATURES[to],
    era: eraTo > eraFrom ? { id: ERA_IDS[eraTo], name: ERA_NAMES[eraTo], n: eraTo } : null,
  };
}

// Frame height (rows) the ladder affords: the resolution grows with it.
export function frameRows(flags) {
  if (flags.hires) return flags.rtx ? 480 : 540;
  if (flags.dynLights) return 400;
  if (flags.polys) return 300;
  if (flags.mirrors) return 240;
  if (flags.res200) return 200;
  return 120;
}
// Texture detail: half resolution first (Wolfenstein), double at the top.
export function textureScale(flags) { return flags.hires ? 2 : flags.res200 ? 1 : 0.5; }
// Colour levels per channel after quantising (0 = true colour).
export function colorLevels(flags) { return flags.truecolor ? 0 : flags.palette ? 16 : 6; }

// The raycaster's settings for the column tiers.
export function raySettings(flags) {
  return {
    flats: !flags.flats,
    fogK: flags.distLight ? 0.07 : 0,
    useLightmap: flags.lightmap,
    liquids: flags.liquids,
    bands: flags.smoothLight ? 0 : flags.lightmap ? 16 : 0,
    smoothLight: flags.smoothLight,
    mirrors: flags.mirrors,
    pitch: flags.yshear ? 1 : 0,
    colorK: flags.colorLamps ? (flags.dynLights ? 1 : 0.6) : 0,
  };
}
