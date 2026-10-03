/*
 * ТЕХНОМАГИЯ — объёмная сцена поверх того же мира.
 *
 * Мир (world.js) не знает, что его рисуют в объёме, и не должен: он
 * остаётся клеточным, расстояния в нём не врут. Здесь только перевод
 * «клетка → кубик»: одна клетка — одна единица, x мира → x, y мира → z,
 * высота — своя. Ни одного правила игры этот файл не трогает и ничего в
 * мир не пишет.
 *
 * Неподвижное (пол, стены, двери, предметы) печётся в один буфер и
 * перепекается только когда меняется сама сетка: сгорела солома, вскрыли
 * бочку, обесточили силовую дверь. Подвижное (маги, свечи, ядро, пожар,
 * снаряды) собирается узлами каждый кадр.
 */

import { TILE, TILE_SIZE } from '../level.js';
import { GROUND } from '../field.js';
import { colourOf } from '../magic.js';
import * as M from './math.js';
import { Builder, Geo, Node, SURF, STRIDE } from './engine.js';
import { WALL_H, cutAmount } from './camera.js';

export { WALL_H };
const T = TILE_SIZE;

/*
 * КЛЕТКИ ПО ИМЕНИ, А НЕ ПО НОМЕРУ
 * ---------------------------------------------------------
 * Номера живут в level.js (TILE) и растут вместе с игрой: 03.10 пришли
 * ров, пропасть, три состояния рва и нанос сажи. Отрисовка знает клетки
 * по имени — номер берётся из TILE при загрузке. Имени нет в TILE (ветка
 * без «Башни») — строка просто не участвует.
 *
 * Клетка с номером, которого отрисовка не знает, не пропадает молча: она
 * рисуется полом с лиловой меткой над ним и один раз на номер пишет
 * console.warn (свод, п.7р: молча для человека, громко для нас).
 */
const DRAWN = ['FLOOR', 'WALL', 'DOOR', 'GLASS', 'EXIT', 'TABLE', 'RUG', 'PANEL', 'BARREL', 'BOULDER',
  'CRYSTAL', 'HAY', 'METAL', 'FORCE', 'FORCE_OFF', 'WOOD', 'DEEP', 'PIT', 'FROZEN', 'MIRE', 'STONE', 'DRIFT'];
export const KNOWN_TILES = new Set(DRAWN.filter((name) => Number.isInteger(TILE[name])).map((name) => TILE[name]));
const warnedTiles = new Set();
export function unknownTilesWarned() { return [...warnedTiles]; }

/*
 * Утопленные клетки: ров и его состояния, пропасть. level — высота
 * поверхности (пол — 0). Откос рисуется там, где сосед выше.
 */
const SUNKEN_LOOK = {
  DEEP: { level: -0.26, color: [0.05, 0.17, 0.25], surf: SURF.MOAT },
  FROZEN: { level: -0.05, color: [0.4, 0.58, 0.68], surf: SURF.ICE },
  MIRE: { level: -0.09, color: [0.3, 0.24, 0.13], surf: SURF.MUD },
  STONE: { level: -0.015, color: [0.24, 0.2, 0.22], surf: SURF.BASALT },
  PIT: { level: -3.2, color: [0, 0, 0], surf: SURF.ABYSS, pit: true },
};
const SUNKEN = new Map(Object.entries(SUNKEN_LOOK).filter(([name]) => Number.isInteger(TILE[name]))
  .map(([name, look]) => [TILE[name], { name, ...look }]));
export const levelOf = (t) => (SUNKEN.has(t) ? SUNKEN.get(t).level : 0);

/*
 * Палитры по темам этажа. Цвета взяты из THEMES в render.js (кромка,
 * ворота, ковёр, выход), но не импортом: render.js тянет за собой
 * загрузку спрайтов, а объёмному виду они не нужны.
 */
const PALETTES = [
  { name: 'парк', yard: [0.15, 0.17, 0.13], slab: [0.17, 0.2, 0.2], wall: [0.24, 0.27, 0.25], cap: [0.08, 0.1, 0.09], lamp: '#3dffb4', gate: '#2de0ff', rug: '#10463f', exit: '#3dffb4' },
  { name: 'подстанция', yard: [0.24, 0.21, 0.17], slab: [0.27, 0.26, 0.31], wall: [0.44, 0.41, 0.42], cap: [0.17, 0.15, 0.19], lamp: '#c07bff', gate: '#c07bff', rug: '#2e2450', exit: '#7dffdc' },
];

/* Одежда магов — та же, что у плоского вида (ROBES в render.js). Игрок
   светлее всех: его надо находить в свалке мгновенно. */
const ROBES = {
  player: { robe: '#2b5f86', robeLit: '#59a8cf', trim: '#9df9ff', hood: '#0d1c28' },
  thug: { robe: '#3a2030', robeLit: '#6b3b53', trim: '#ff6a86', hood: '#1d0f18' },
  caster: { robe: '#2a2340', robeLit: '#4d4175', trim: '#b98cff', hood: '#150f22' },
  carrier: { robe: '#20323a', robeLit: '#3a5c6c', trim: '#8fe6ff', hood: '#101d22' },
  civil: { robe: '#4a463d', robeLit: '#817667', trim: '#d7c9a7', hood: '#29261f' },
  hostage: { robe: '#3c4b45', robeLit: '#678277', trim: '#b9ffe4', hood: '#202a26' },
  dead: { robe: '#22242a', robeLit: '#2c2f36', trim: '#4a4e57', hood: '#141519' },
};

const C = (hex) => M.rgb(hex);
const SKIN = [0.78, 0.62, 0.52];

/* Куб, разрезанный на верх и бока: у стены они разной фактуры. */
const CUBE = Geo.cube();
const CUBE_TOP = [], CUBE_SIDES = [];
for (let i = 0; i < CUBE.length; i += 18) {
  const ny = CUBE[i + 4];
  if (ny > 0.5) CUBE_TOP.push(...CUBE.slice(i, i + 18));
  else if (ny > -0.5) CUBE_SIDES.push(...CUBE.slice(i, i + 18));
}
const CYL = Geo.cylinder(1, 1, 1, 14);
const CYL8 = Geo.cylinder(1, 1, 1, 8);
const CONE = Geo.cylinder(0, 1, 1, 12);
const SPHERE = Geo.sphere(1, 8, 12);
const SHARD = Geo.shard();
const TORUS = Geo.torus(1, 0.09, 24, 6);
const DISC = Geo.ring(0, 1, Math.PI * 2, 20);

const at = (x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) => M.compose([x, y, z], [rx, ry, rz], [sx, sy, sz]);

function box(b, x0, y0, z0, x1, y1, z1, side, top = side, ry = 0) {
  const m = at((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, ry, x1 - x0, y1 - y0, z1 - z0);
  b.add(CUBE_SIDES, m, side);
  b.add(CUBE_TOP, m, top);
}

/* Затенение у пола: низ стены темнее — дешёвая замена настоящему AO. */
const baseShade = (p) => 0.42 + 0.58 * Math.min(1, Math.max(0, p[1] / 0.75));

export const isTall = (t) => t === TILE.WALL || t === TILE.WOOD || t === TILE.METAL || t === TILE.DOOR
  || t === TILE.FORCE || t === TILE.FORCE_OFF || t === TILE.GLASS;

/* Предмет между камерой и героем не плющится, а редеет (срез 3, см. VS):
   обёртка добавляет срез и якорь клетки к каждой фигуре предмета. */
const fading = (b, x, z) => ({ add: (geo, m, opts = {}) => b.add(geo, m, { ...opts, cut: 3, anchor: [x, z] }) });

function tileAt(world, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= world.w || ty >= world.h) return TILE.WALL;
  return world.tiles[ty * world.w + tx];
}

/*
 * Двор или помещение — по заливке от точки входа: всё, куда игрок
 * доходит, не открывая дверей, — двор (земля, трава); остальное — плиты.
 * Выводится из сетки, а не размечается руками: новый уровень получает
 * разметку сам.
 */
function regions(world) {
  const { w, h } = world;
  const yard = new Uint8Array(w * h);
  /* Преграда двора — стена и дверь, а не всё, что держит тело: ров и
     пропасть «Башни» лежат во дворе, и за ними тоже двор. */
  const barrier = (t) => isTall(t);
  const sx = world.level.spawn.x, sy = world.level.spawn.y;
  const stack = [[sx, sy]];
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const i = y * w + x;
    if (yard[i] || barrier(world.tiles[i])) continue;
    yard[i] = 1;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  /* Бочка или стол во дворе — тоже двор: смотрим на соседей. */
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const t = world.tiles[y * w + x];
      if (yard[y * w + x] || isTall(t) || t === TILE.CRYSTAL) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && yard[ny * w + nx] === 1) { yard[y * w + x] = 2; break; }
      }
    }
  }
  return yard;
}

/* Фонари на ограде — ровно там же, где у плоского вида (hasLamp). */
const hasLamp = (tx, ty) => ((tx * 7 + ty * 13) % 11) === 0;

/* ---------------------------------------------------------
   ПЕЧЬ ЭТАЖА
   --------------------------------------------------------- */

export function bakeLevel(world, options = {}) {
  const pal0 = PALETTES[world.level.theme] || PALETTES[0];
  /*
   * readable (игра, igra.js; пилот vid.html — без него): ночной этаж на
   * телефоне читается. Пол и стены светлее, масса стен не чёрная, вода
   * рва темнее пола и с бледной кромкой — ров отличим от пола и без цвета
   * (проверка серым, свод п.17). Приёмка Глаз 03.10, числа — в
   * pilot-vid/zamer-chitaemost.mjs.
   */
  const readable = Boolean(options.readable);
  const gain = (c, k) => c.map((x) => Math.min(1, x * k));
  const pal = readable ? { ...pal0, yard: gain(pal0.yard, 1.4), slab: gain(pal0.slab, 1.3), wall: gain(pal0.wall, 1.45) } : pal0;
  const b = new Builder();
  const shadows = new Builder();
  const glass = new Builder();
  const yard = regions(world);
  const fixtures = { lights: [], forces: [], exits: [], crystals: [], panels: [], lamps: [], unknown: [] };

  /*
   * Масса стен (с 03.10, по задаче «Башни»): клетка стены, у которой все
   * восемь соседей тоже стены, — не стена, а пустота между зонами. Кубом
   * в 1,6 клетки она превращала поле в гигантские глухие блоки. Теперь
   * она — тёмная плоская «крыша» на уровне верха стен, а стеной стоит
   * только край массы, который граничит с полом. massRoof: false — старый
   * вид, для кадра «до» (?massa=0).
   */
  const massRoof = options.massRoof !== false;
  /* readable: клетка у края карты — всегда стена с гранями, а не «масса»:
     крыша массы висит на высоте стены без боков, и с повёрнутой камеры
     (игрок крутит её кнопкой или клавишей) под ней у края карты зияла
     чёрная щель. */
  const solid = (tx, ty) => (readable ? tx >= 0 && ty >= 0 && tx < world.w && ty < world.h : true)
    && tileAt(world, tx, ty) === TILE.WALL;
  const interior = (tx, ty) => {
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) if (!solid(tx + dx, ty + dy)) return false;
    return true;
  };
  let massCells = 0;

  const occluder = (tx, ty) => isTall(tileAt(world, tx, ty));

  for (let ty = 0; ty < world.h; ty += 1) {
    for (let tx = 0; tx < world.w; tx += 1) {
      const t = tileAt(world, tx, ty);
      const h = M.hash2(tx, ty);
      const anchor = [tx + 0.5, ty + 0.5];
      const sunk = SUNKEN.get(t);

      /* ПОЛ — под всем, кроме сплошной стены и утопленных клеток. Углы темнеют у стен. */
      if (t !== TILE.WALL && !sunk) {
        const isYard = yard[ty * world.w + tx] > 0;
        const base = isYard ? pal.yard : pal.slab;
        const v = 0.92 + h * 0.16;
        const corner = (cx, cz) => {
          let n = 0;
          if (occluder(cx - 1, cz - 1)) n += 1;
          if (occluder(cx, cz - 1)) n += 1;
          if (occluder(cx - 1, cz)) n += 1;
          if (occluder(cx, cz)) n += 1;
          const k = v * (1 - Math.min(0.62, n * 0.24));
          return [base[0] * k, base[1] * k, base[2] * k];
        };
        b.floorQuad(tx, ty, 0, [corner(tx, ty), corner(tx, ty + 1), corner(tx + 1, ty + 1), corner(tx + 1, ty)],
          { surf: isYard ? SURF.YARD : SURF.SLAB });
      }

      if (!KNOWN_TILES.has(t)) {
        unknownTile(b, tx, ty, t, fixtures);
        continue;
      }

      if (t === TILE.WALL) {
        if (massRoof && interior(tx, ty)) {
          const roof = pal.cap.map((c) => c * ((readable ? 1.85 : 0.44) + h * 0.06));
          b.floorQuad(tx, ty, WALL_H, [roof, roof, roof, roof], { surf: SURF.ROOF });
          /* floorQuad не знает среза — допишем вершинам массы срез и
             якорь, иначе крыша висела бы над срезанной кромкой. */
          markCut(b, 6, anchor);
          massCells += 1;
          continue;
        }
        const shade = 0.9 + h * 0.18;
        const col = pal.wall.map((c) => c * shade);
        box(b, tx, 0, ty, tx + 1, WALL_H, ty + 1,
          { color: col, surf: SURF.BRICK, cut: 1, anchor, shade: baseShade },
          { color: pal.cap, surf: SURF.CAP, cut: 1, anchor });
        /* Фонарь — только на стене, у которой есть пол рядом: иначе он
           светил бы в толщу ограды. */
        const open = [[0, 1], [1, 0], [-1, 0], [0, -1]].find(([dx, dy]) => {
          const n = tileAt(world, tx + dx, ty + dy);
          return !isTall(n) && !SUNKEN.has(n);
        });
        /* В игре на этаже с настоящим светом (world.lights, «Башня»)
           украшений нет (decorLamps: false из igra.js): фонарь, который
           горит и никого не освещает, врал бы о правиле. Лампы этажа
           рисует игра (igra.js, слой «б»). Пилот vid.html — как был. */
        if (hasLamp(tx, ty) && open && options.decorLamps !== false) lamp(b, tx, ty, open, pal, anchor, fixtures);
        continue;
      }

      if (sunk) sunkenCell(b, world, tx, ty, sunk, pal, readable);

      if (t === TILE.RUG) {
        const rug = C(pal.rug).map((c) => c * 1.25 + 0.03);
        b.floorQuad(tx, ty, 0.012, [rug, rug, rug, rug], { surf: SURF.RUG });
      }

      if (t === TILE.EXIT) exitHatch(b, tx, ty, pal, fixtures);

      if (isTall(t)) door(b, glass, world, tx, ty, t, pal, anchor, fixtures);

      const pb = fading(b, tx + 0.5, ty + 0.5);
      if (t === TILE.BARREL) barrel(pb, shadows, tx + 0.5, ty + 0.5, h);
      if (t === TILE.HAY) hay(pb, shadows, tx + 0.5, ty + 0.5, h);
      if (t === TILE.BOULDER) boulder(pb, shadows, tx + 0.5, ty + 0.5, h);
      if (t === TILE.TABLE) table(pb, shadows, world, tx, ty, h);
      if (t === TILE.CRYSTAL) crystal(pb, shadows, tx + 0.5, ty + 0.5, h, fixtures);
      if (t === TILE.PANEL) panel(pb, shadows, world, tx, ty, fixtures);
      if (t === TILE.DRIFT) drift(pb, shadows, tx + 0.5, ty + 0.5, h);
    }
  }

  /*
   * За оградой — та же ночная земля, только темнее. Без неё край карты
   * в изометрии читается чёрной дырой, и кадр выглядит обрезанным.
   */
  const outside = pal.yard.map((c) => c * (readable ? 0.9 : 0.55));
  const far = 40;
  /* voidMask — щуп замера пустоты (igra.js, probe): за краем чистый пурпур. */
  const outsideLook = options.voidMask ? { color: [1, 0, 1], emissive: 6, surf: SURF.PLAIN } : { color: outside, surf: SURF.YARD };
  for (const [x0, z0, x1, z1] of [[-far, -far, world.w + far, 0], [-far, world.h, world.w + far, world.h + far], [-far, 0, 0, world.h], [world.w, 0, world.w + far, world.h]]) {
    b.add(Geo.quad(), at((x0 + x1) / 2, -0.01, (z0 + z1) / 2, 0, x1 - x0, 1, z1 - z0), outsideLook);
  }

  return { opaque: b.data, shadows: shadows.data, glass: glass.data, fixtures, vertices: b.count + shadows.count + glass.count, massCells };
}

/* Последним n вершинам — срез 1 и якорь клетки. */
function markCut(b, n, anchor) {
  for (let i = b.data.length - n * STRIDE; i < b.data.length; i += STRIDE) {
    b.data[i + 11] = 1;
    b.data[i + 13] = anchor[0];
    b.data[i + 14] = anchor[1];
  }
}

/*
 * Ров, его состояния и пропасть: поверхность на своей высоте и откосы
 * там, где сосед выше. У пропасти откос уходит в черноту (SURF.ABYSS
 * темнит по глубине), а по кромке горит тонкая лиловая линия — та же,
 * что у плоского вида: глубину видно, дна нет.
 */
function sunkenCell(b, world, tx, ty, sunk, pal, readable = false) {
  const y = sunk.level;
  const v = 0.9 + 0.15 * M.hash2(tx * 3, ty * 5);
  /* Вода рва в читаемом виде темнее: серым она была вровень с полом
     (разница медиан 0.1 уровня из 255 — жила только цветом). */
  const deep = readable && sunk.name === 'DEEP' ? 0.6 : 1;
  const col = sunk.color.map((x) => x * v * deep);
  b.floorQuad(tx, ty, y, [col, col, col, col], { surf: sunk.surf });
  const edges = [
    /* сосед, две точки ребра, нормаль внутрь клетки */
    [[0, -1], [tx, ty], [tx + 1, ty], [0, 0, 1]],
    [[1, 0], [tx + 1, ty], [tx + 1, ty + 1], [-1, 0, 0]],
    [[0, 1], [tx + 1, ty + 1], [tx, ty + 1], [0, 0, -1]],
    [[-1, 0], [tx, ty + 1], [tx, ty], [1, 0, 0]],
  ];
  for (const [[dx, dy], a, e, n] of edges) {
    const top = levelOf(tileAt(world, tx + dx, ty + dy));
    if (top <= y + 0.001) continue;
    const stone = pal.wall.map((x) => x * (sunk.pit ? 0.5 : 0.75));
    const bottom = sunk.pit ? [0, 0, 0] : stone.map((x) => x * 0.45);
    b.quad4([[a[0], top, a[1]], [e[0], top, e[1]], [e[0], y, e[1]], [a[0], y, a[1]]], n,
      [stone, stone, bottom, bottom], { surf: sunk.pit ? SURF.ABYSS : SURF.BRICK });
    if (readable && !sunk.pit && top > -0.01) {
      /* Кромка рва: бледный камень на краю берега, 0.14 клетки. Серым она
         светлее и пола, и воды — граница рва видна без цвета. */
      const curb = [0.62, 0.6, 0.56];
      const ox = -n[0] * 0.14, oz = -n[2] * 0.14;
      b.quad4([[a[0], 0.012, a[1]], [e[0], 0.012, e[1]], [e[0] + ox, 0.012, e[1] + oz], [a[0] + ox, 0.012, a[1] + oz]], [0, 1, 0],
        [curb, curb, curb, curb], { surf: SURF.CAP });
    }
    if (sunk.pit && top > -0.01) {
      /* Кромка: тонкая полоса на краю соседнего пола. */
      const rim = [0.5, 0.32, 0.78];
      const ox = -n[0] * 0.07, oz = -n[2] * 0.07;
      b.quad4([[a[0], 0.004, a[1]], [e[0], 0.004, e[1]], [e[0] + ox, 0.004, e[1] + oz], [a[0] + ox, 0.004, a[1] + oz]], [0, 1, 0],
        [rim, rim, rim, rim], { emissive: 0.7 });
    }
  }
}

/* Неизвестная клетка: пол уже лёг, сверху — лиловая метка и запись в консоль. */
function unknownTile(b, tx, ty, t, fixtures) {
  const x = tx + 0.5, z = ty + 0.5;
  const mark = [1, 0.2, 0.85];
  b.add(SHARD, at(x, 0.62, z, 0.4, 0.22, 0.36, 0.22), { color: mark, emissive: 1.2 });
  b.add(Geo.ring(0.34, 0.44, Math.PI * 2, 24), at(x, 0.02, z), { color: mark, emissive: 0.9 });
  fixtures.unknown.push({ x: tx, y: ty, tile: t });
  if (!warnedTiles.has(t)) {
    warnedTiles.add(t);
    console.warn(`[vid] клетка с номером ${t} отрисовке неизвестна (первая — ${tx},${ty}): нарисована полом с лиловой меткой. Допиши её в DRAWN в src/view3d/scene.js.`);
  }
}

function blob(shadows, x, z, r, strength = 1) {
  const m = at(x, 0.006, z, 0, r, 1, r);
  const data = [];
  const seg = 18;
  for (let i = 0; i < seg; i += 1) {
    const a = i / seg * Math.PI * 2, c = (i + 1) / seg * Math.PI * 2;
    const p = (rr, t) => [Math.sin(t) * rr, 0, Math.cos(t) * rr];
    data.push([p(0, 0), 0.55], [p(0.6, a), 0.38], [p(0.6, c), 0.38],
      [p(0.6, a), 0.38], [p(1, a), 0], [p(1, c), 0],
      [p(0.6, a), 0.38], [p(1, c), 0], [p(0.6, c), 0.38]);
  }
  for (const [pt, alpha] of data) {
    const w = M.transform(m, pt);
    shadows.data.push(w[0], w[1], w[2], 0, 1, 0, 0.01, 0.01, 0.02, 0, SURF.SHADOW, 0, alpha * strength, 0, 0);
  }
}

function lamp(b, tx, ty, [dx, dy], pal, anchor, fixtures) {
  const x = tx + 0.5 + dx * 0.3, z = ty + 0.5 + dy * 0.3;
  const metal = [0.08, 0.08, 0.1];
  b.add(CYL8, at(x, WALL_H + 0.14, z, 0, 0.07, 0.28, 0.07), { color: metal, surf: SURF.METAL, cut: 2, anchor });
  box(b, x - 0.15, WALL_H + 0.28, z - 0.15, x + 0.15, WALL_H + 0.32, z + 0.15, { color: metal, surf: SURF.METAL, cut: 2, anchor });
  const glow = C(pal.lamp);
  /* Без крыши: сверху камера должна видеть сам огонь, а не жесть. */
  b.add(SPHERE, at(x, WALL_H + 0.46, z, 0, 0.13, 0.17, 0.13), { color: glow, emissive: 0.6, cut: 2, anchor });
  for (const [ox, oz] of [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]]) {
    b.add(CYL8, at(x + ox, WALL_H + 0.46, z + oz, 0, 0.015, 0.3, 0.015), { color: metal, surf: SURF.METAL, cut: 2, anchor });
  }
  fixtures.lamps.push({ pos: [x + dx * 0.25, WALL_H + 0.3, z + dy * 0.25], color: glow, anchor });
}

function exitHatch(b, tx, ty, pal, fixtures) {
  const x = tx + 0.5, z = ty + 0.5;
  const steel = [0.2, 0.22, 0.24];
  b.add(CYL, at(x, 0.025, z, 0, 0.42, 0.05, 0.42), { color: steel, surf: SURF.METAL });
  for (let i = 0; i < 3; i += 1) box(b, x - 0.3, 0.05, z - 0.2 + i * 0.2, x + 0.3, 0.07, z - 0.16 + i * 0.2, { color: [0.07, 0.08, 0.09], surf: SURF.METAL });
  fixtures.exits.push({ x, z, color: C(pal.exit) });
}

/* Двери, стекло, силовые: рама из того же камня, что стена, створка своя. */
function door(b, glass, world, tx, ty, t, pal, anchor, fixtures) {
  const spanX = isTall(tileAt(world, tx - 1, ty)) || isTall(tileAt(world, tx + 1, ty));
  const ry = spanX ? 0 : Math.PI / 2;
  const cx = tx + 0.5, cz = ty + 0.5;
  /* Всё строится в своих координатах (вдоль x) и поворачивается. */
  const put = (geo, lx, ly, lz, sx, sy, sz, opts) => {
    const m = M.multiply(at(cx, 0, cz, ry), at(lx, ly, lz, 0, sx, sy, sz));
    b.add(geo, m, { cut: 1, anchor, ...opts });
  };
  const stone = { color: pal.wall.map((c) => c * 0.92), surf: SURF.BRICK, shade: baseShade };
  const capOpts = { color: pal.cap, surf: SURF.CAP };
  put(CUBE_SIDES, -0.41, WALL_H / 2, 0, 0.18, WALL_H, 0.6, stone);
  put(CUBE_TOP, -0.41, WALL_H / 2, 0, 0.18, WALL_H, 0.6, capOpts);
  put(CUBE_SIDES, 0.41, WALL_H / 2, 0, 0.18, WALL_H, 0.6, stone);
  put(CUBE_TOP, 0.41, WALL_H / 2, 0, 0.18, WALL_H, 0.6, capOpts);
  put(CUBE_SIDES, 0, WALL_H - 0.15, 0, 0.64, 0.3, 0.6, stone);
  put(CUBE_TOP, 0, WALL_H - 0.15, 0, 0.64, 0.3, 0.6, capOpts);

  if (t === TILE.WOOD || t === TILE.DOOR) {
    const wood = t === TILE.WOOD ? [0.34, 0.2, 0.11] : [0.42, 0.28, 0.15];
    put(CUBE, 0, 0.66, 0, 0.64, 1.3, 0.14, { color: wood, surf: SURF.WOOD });
    for (const y of [0.3, 1.0]) put(CUBE, 0, y, 0, 0.64, 0.07, 0.17, { color: [0.07, 0.07, 0.08], surf: SURF.METAL });
    put(TORUS, 0.2, 0.68, 0.1, 0.06, 0.06, 0.06, { color: [0.5, 0.42, 0.25], surf: SURF.METAL });
    put(TORUS, 0.2, 0.68, -0.1, 0.06, 0.06, 0.06, { color: [0.5, 0.42, 0.25], surf: SURF.METAL });
  } else if (t === TILE.METAL) {
    put(CUBE, 0, 0.66, 0, 0.64, 1.3, 0.2, { color: [0.3, 0.33, 0.37], surf: SURF.METAL });
    for (const y of [0.25, 0.66, 1.07]) put(CUBE, 0, y, 0, 0.66, 0.08, 0.24, { color: [0.16, 0.17, 0.2], surf: SURF.METAL });
    for (const lx of [-0.25, 0.25]) for (const y of [0.15, 1.17]) {
      put(SPHERE, lx, y, 0.11, 0.025, 0.025, 0.025, { color: [0.55, 0.58, 0.62], surf: SURF.METAL });
      put(SPHERE, lx, y, -0.11, 0.025, 0.025, 0.025, { color: [0.55, 0.58, 0.62], surf: SURF.METAL });
    }
  } else if (t === TILE.FORCE || t === TILE.FORCE_OFF) {
    const on = t === TILE.FORCE;
    const gate = C(pal.gate);
    for (const lx of [-0.3, 0.3]) {
      put(CUBE, lx, 0.08, 0, 0.1, 0.16, 0.2, { color: [0.12, 0.12, 0.15], surf: SURF.METAL });
      put(CUBE, lx, WALL_H - 0.36, 0, 0.1, 0.12, 0.2, { color: [0.12, 0.12, 0.15], surf: SURF.METAL });
      put(SPHERE, lx, 0.2, 0, 0.05, 0.05, 0.05, { color: on ? gate : [0.15, 0.13, 0.18], emissive: on ? 1.8 : 0 });
      put(SPHERE, lx, WALL_H - 0.44, 0, 0.05, 0.05, 0.05, { color: on ? gate : [0.15, 0.13, 0.18], emissive: on ? 1.8 : 0 });
    }
    if (on) {
      fixtures.forces.push({ x: cx, z: cz, ry, color: gate });
      fixtures.lights.push({ pos: [cx, 0.8, cz], color: gate, power: 0.9, range: 3.6, flicker: 0.15 });
    }
  } else if (t === TILE.GLASS) {
    put(CUBE, 0, 0.06, 0, 0.64, 0.12, 0.16, { color: [0.12, 0.12, 0.15], surf: SURF.METAL });
    const m = M.multiply(at(cx, 0, cz, ry), at(0, 0.7, 0, 0, 0.64, 1.15, 0.04));
    glass.add(CUBE, m, { color: C('#8ff5ff').map((c) => c * 0.5), alpha: 0.28, surf: SURF.METAL, emissive: 0.15, cut: 1, anchor });
  }
}

function barrel(b, shadows, x, z, h) {
  const wood = [0.36 + h * 0.06, 0.22, 0.12];
  b.add(Geo.cylinder(0.27, 0.27, 0.78, 14, false), at(x, 0.39, z, h * 3), { color: wood, surf: SURF.WOOD });
  b.add(CYL, at(x, 0.39, z, 0, 0.3, 0.5, 0.3), { color: wood, surf: SURF.WOOD });
  for (const y of [0.1, 0.39, 0.68]) b.add(TORUS, at(x, y, z, 0, 0.29, 0.5, 0.29), { color: [0.1, 0.1, 0.11], surf: SURF.METAL });
  /* Бочка с водой: вода видна сверху — это подсказка, чем она станет. */
  b.add(DISC, at(x, 0.775, z, 0, 0.25, 1, 0.25), { color: [0.06, 0.18, 0.26], surf: SURF.WATER, emissive: 0.05 });
  blob(shadows, x, z, 0.52);
}

function hay(b, shadows, x, z, h) {
  const straw = [0.6, 0.47, 0.2];
  b.add(SPHERE, at(x, 0.26, z, h * 6, 0.5, 0.36, 0.46), { color: straw, surf: SURF.STRAW });
  b.add(SPHERE, at(x + 0.08, 0.5, z - 0.05, h * 4, 0.34, 0.26, 0.32), { color: straw.map((c) => c * 1.08), surf: SURF.STRAW });
  for (let i = 0; i < 5; i += 1) {
    const a = h * 10 + i * 1.3;
    b.add(CYL8, at(x + Math.cos(a) * 0.4, 0.06, z + Math.sin(a) * 0.36, a, 0.012, 0.25, 0.012, 1.3, 0.3), { color: straw, surf: SURF.STRAW });
  }
  blob(shadows, x, z, 0.62);
}

function boulder(b, shadows, x, z, h) {
  const rock = [0.3, 0.28, 0.26];
  const geo = SPHERE.slice();
  for (let i = 0; i < geo.length; i += 6) {
    const k = 0.85 + 0.3 * M.hash2(Math.round(geo[i] * 10) + 50, Math.round(geo[i + 2] * 10) + Math.round(geo[i + 1] * 10) * 7);
    geo[i] *= k; geo[i + 1] *= k; geo[i + 2] *= k;
  }
  b.add(geo, at(x, 0.32, z, h * 6, 0.46, 0.38, 0.42), { color: rock, surf: SURF.SLAB });
  blob(shadows, x, z, 0.6);
}

function table(b, shadows, world, tx, ty, h) {
  const x = tx + 0.5, z = ty + 0.5;
  const wood = [0.33, 0.21, 0.12];
  box(b, x - 0.46, 0.5, z - 0.32, x + 0.46, 0.58, z + 0.32, { color: wood, surf: SURF.WOOD });
  for (const [lx, lz] of [[-0.38, -0.24], [0.38, -0.24], [-0.38, 0.24], [0.38, 0.24]]) {
    box(b, x + lx - 0.04, 0, z + lz - 0.04, x + lx + 0.04, 0.5, z + lz + 0.04, { color: wood.map((c) => c * 0.8), surf: SURF.WOOD });
  }
  /* На столе — кружка и свиток: предмет читается как стол, а не ящик. */
  b.add(CYL, at(x - 0.2, 0.64, z + 0.05, 0, 0.06, 0.12, 0.06), { color: [0.45, 0.42, 0.38], surf: SURF.METAL });
  b.add(CYL, at(x + 0.15, 0.61, z - 0.08, h, 0.04, 0.32, 0.04, 0, Math.PI / 2), { color: [0.75, 0.68, 0.52] });
  blob(shadows, x, z, 0.7, 0.8);
}

/*
 * Кристалл — в цвет молнии, как у плоского вида (render.js): берёт его
 * только разряд, и цвет здесь — инструкция, а не украшение. В задании на
 * пилот стоял голубой; оставлен игровой, иначе вид спорит с правилом.
 */
function crystal(b, shadows, x, z, h, fixtures) {
  const bolt = C('#ffd84a');
  box(b, x - 0.36, 0, z - 0.36, x + 0.36, 0.22, z + 0.36, { color: [0.2, 0.19, 0.23], surf: SURF.BRICK, shade: baseShade }, { color: [0.12, 0.12, 0.15], surf: SURF.CAP });
  /* Кристалл выше стены: он стоит в проёме ограды, и сбоку его иначе не видно. */
  b.add(SHARD, at(x, 1.0, z, h * 4 + 0.6, 0.44, 0.8, 0.44), { color: bolt, emissive: 0.9 });
  b.add(SHARD, at(x + 0.2, 0.45, z + 0.12, 1 + h, 0.14, 0.24, 0.14, 0.4, -0.5), { color: bolt, emissive: 0.8 });
  b.add(SHARD, at(x - 0.18, 0.42, z - 0.1, 2 + h, 0.12, 0.2, 0.12, -0.3, 0.45), { color: bolt, emissive: 0.8 });
  fixtures.crystals.push({ x, z });
  fixtures.lights.push({ pos: [x, 1.0, z], color: [1, 0.78, 0.32], power: 2.2, range: 5.8, flicker: 0.08 });
  blob(shadows, x, z, 0.6);
}

/* Нанос сажи: рыхлый тёмный холм с серым гребнем — «сдует», а не «разобьёт». */
function drift(b, shadows, x, z, h) {
  const soot = [0.2, 0.19, 0.23];
  const geo = SPHERE.slice();
  for (let i = 0; i < geo.length; i += 6) {
    const k = 0.88 + 0.24 * M.hash2(Math.round(geo[i] * 9) + 11, Math.round(geo[i + 2] * 9) + 3);
    geo[i] *= k; geo[i + 2] *= k;
  }
  b.add(geo, at(x, 0.05, z, h * 5, 0.5, 0.42, 0.46), { color: soot, surf: SURF.SOOT });
  b.add(SPHERE, at(x - 0.08, 0.3, z + 0.04, h * 3, 0.3, 0.16, 0.26), { color: [0.42, 0.41, 0.46], surf: SURF.SOOT });
  blob(shadows, x, z, 0.6);
}

function panel(b, shadows, world, tx, ty, fixtures) {
  const x = tx + 0.5, z = ty + 0.5;
  /* Лицом туда, где пол: к щитку подходят, а не упираются в его спину. */
  const dirs = [[0, 1], [1, 0], [-1, 0], [0, -1]];
  const [dx, dz] = dirs.find(([ddx, ddz]) => { const n = tileAt(world, tx + ddx, ty + ddz); return !isTall(n) && !SUNKEN.has(n); }) || [0, 1];
  const ry = Math.atan2(dx, dz);
  const put = (geo, lx, ly, lz, sx, sy, sz, opts) => b.add(geo, M.multiply(at(x, 0, z, ry), at(lx, ly, lz, 0, sx, sy, sz)), opts);
  const steel = [0.24, 0.25, 0.28];
  put(CUBE, 0, 0.6, -0.05, 0.72, 1.2, 0.38, { color: steel, surf: SURF.METAL, shade: baseShade });
  put(CUBE, 0, 1.22, -0.05, 0.78, 0.05, 0.44, { color: [0.12, 0.12, 0.14], surf: SURF.METAL });
  /* Как у плоского вида: серая коробка, жёлтая и зелёная лампы,
     рубильник вниз — щиток под напряжением. */
  const yellow = C('#ffe24d');
  put(CUBE, 0, 0.72, 0.15, 0.56, 0.6, 0.02, { color: [0.17, 0.2, 0.25], surf: SURF.METAL });
  put(SPHERE, -0.14, 0.9, 0.17, 0.07, 0.07, 0.04, { color: yellow, emissive: 1.6 });
  put(SPHERE, 0.14, 0.9, 0.17, 0.07, 0.07, 0.04, { color: [0.43, 0.94, 0.7], emissive: 1.2 });
  put(CUBE, 0, 0.58, 0.19, 0.06, 0.24, 0.05, { color: [0.79, 0.84, 0.89], surf: SURF.METAL });
  /* Жгут кабелей к полу: щиток — часть сети, а не тумба. */
  put(CYL8, 0.26, 0.2, 0.16, 0.035, 0.4, 0.035, { color: [0.05, 0.05, 0.06] });
  fixtures.panels.push({ x, z });
  fixtures.lights.push({ pos: [x + dx * 0.5, 0.9, z + dz * 0.5], color: yellow, power: 1.0, range: 3.4, flicker: 0.04 });
  blob(shadows, x, z, 0.6);
}

/* ---------------------------------------------------------
   ФИГУРЫ
   --------------------------------------------------------- */

function part(parent, geo, color, pos, scale, extra = {}) {
  const n = new Node(geo, { color, ...extra });
  n.position = pos;
  n.scale = scale;
  if (extra.rot) n.rotation = extra.rot;
  parent.add(n);
  return n;
}

/*
 * Маг читается сверху по силуэту: широкий низ балахона, плечи, голова.
 * У героя — остроконечная шляпа и посох со светящимся навершием: это
 * то, что глаз находит первым, даже в свалке.
 */
export function makeFigure(kind, element = null) {
  const robe = ROBES[kind] || ROBES.civil;
  const root = new Node();
  const body = root.add(new Node());
  root.body = body;
  const skin = { surf: SURF.SKIN };
  const kneel = kind === 'hostage';
  const h = kneel ? 0.55 : 0.74;
  part(body, 'taper', C(robe.robe), [0, h / 2, 0], [0.27, h, 0.27], skin);
  part(body, 'torus', C(robe.trim), [0, 0.05, 0], [0.27, 0.35, 0.27], { emissive: kind === 'player' ? 0.9 : 0.35 });
  part(body, 'sphere', C(robe.robeLit), [0, h - 0.02, 0], [0.21, 0.15, 0.17], skin);
  /* Руки — рукава балахона: без них фигура читается пешкой, а не человеком. */
  for (const side of [-1, 1]) {
    part(body, 'cylinder', C(robe.robeLit), [side * 0.2, h - 0.2, 0.06], [0.055, 0.34, 0.055], { ...skin, rot: [0.45, 0, side * 0.18] });
    part(body, 'sphere', SKIN, [side * 0.22, h - 0.36, 0.15], [0.045, 0.045, 0.045], skin);
  }
  part(body, 'sphere', SKIN, [0, h + 0.17, 0.02], [0.115, 0.125, 0.115], skin);

  if (kind === 'player') {
    const hat = C('#173a63');
    part(body, 'cylinder', hat, [0, h + 0.27, 0], [0.27, 0.025, 0.27], skin);
    part(body, 'cone', hat, [0, h + 0.53, -0.03], [0.17, 0.52, 0.17], { ...skin, rot: [-0.22, 0, 0] });
    part(body, 'torus', C(robe.trim), [0, h + 0.31, 0], [0.165, 0.3, 0.165], { emissive: 1.4 });
    part(body, 'cylinder', [0.3, 0.2, 0.12], [0.3, 0.62, 0.1], [0.025, 1.24, 0.025], skin);
    part(body, 'sphere', C(robe.trim), [0.3, 1.27, 0.1], [0.065, 0.065, 0.065], { emissive: 1.6 });
    root.tip = part(body, 'sphere', C('#4fe8ff'), [0.3, 1.27, 0.1], [0.15, 0.15, 0.15], { emissive: 0.6, alpha: 0.3, additive: true, unlit: 1 });
  } else if (kind === 'hostage') {
    part(body, 'torus', [0.45, 0.33, 0.18], [0, h - 0.1, 0], [0.2, 0.5, 0.18]);
    part(body, 'torus', [0.45, 0.33, 0.18], [0, h - 0.22, 0], [0.22, 0.5, 0.2]);
  } else {
    part(body, 'sphere', C(robe.hood), [0, h + 0.2, -0.01], [0.145, 0.15, 0.15], skin);
    part(body, 'cone', C(robe.hood), [0, h + 0.34, -0.04], [0.1, 0.12, 0.1], skin);
  }

  if (kind === 'thug' || kind === 'carrier') {
    part(body, 'cylinder', [0.32, 0.22, 0.14], [0.27, 0.5, 0.16], [0.045, 0.62, 0.045], { ...skin, rot: [0.55, 0, 0] });
  }
  if (kind === 'caster' && element) {
    const c = C(colourOf(element));
    part(body, 'sphere', c, [0.22, 0.62, 0.26], [0.07, 0.07, 0.07], { emissive: 1.8 });
  }
  if (kind === 'carrier' && element) {
    /* Щит в цвете стихии: чем светится, тем его не убить. */
    const c = C(colourOf(element));
    /* Щит крупнее руки (0.33, а не 0.27): на телефоне со спины его
       оставалось 6 точек (замер «до»), а цвет щита — правило «этим не бей». */
    root.shield = [
      part(body, 'cylinder', [0.14, 0.15, 0.17], [-0.06, 0.52, 0.28], [0.33, 0.05, 0.33], { surf: SURF.METAL, rot: [Math.PI / 2, 0, 0] }),
      part(body, 'torus', c, [-0.06, 0.52, 0.31], [0.33, 0.7, 0.33], { emissive: 1.5, rot: [Math.PI / 2, 0, 0] }),
      part(body, 'sphere', c, [-0.06, 0.52, 0.31], [0.08, 0.08, 0.03], { emissive: 1.6 }),
    ];
    root.scale = [1.12, 1.12, 1.12];
  }
  const shadow = new Node('blob', { shadow: true });
  shadow.scale = [0.5, 1, 0.5];
  shadow.position = [0, 0.008, 0];
  root.shadow = shadow;
  return root;
}

/* Лежащий: тот же маг, опрокинутый на спину. */
function lay(node, angle, down) {
  node.body.rotation = down ? [-Math.PI / 2, 0, 0] : [0, 0, 0];
  node.body.position = down ? [0, 0.16, -0.4] : [0, 0, 0];
  node.rotation = [0, Math.PI / 2 - angle, 0];
}


/* ---------------------------------------------------------
   ЖИВАЯ ЧАСТЬ КАДРА
   --------------------------------------------------------- */

export function createLiveScene(renderer) {
  const nodes = new WeakMap();
  const corpseNodes = new WeakMap();
  const ring = new Node('ring', { color: C('#4fe8ff'), emissive: 0.7, alpha: 0.85, additive: true, unlit: 1 });
  const flames = new Map();
  spellRenderer = renderer;
  renderer.register('frame', frameGeometry());
  /*
   * Герой для замера «сколько его видно»: та же фигура, но ровного цвета
   * без света и свечения. По цвету героя мерить нельзя — синий балахон
   * путается с синим полом, а в тёмном углу живой герой отличается от
   * пола меньше порога. Ровный цвет отличается всегда, и мера считает
   * заслонённость, а не освещённость.
   */
  let flatHero = null;
  function makeFlatHero() {
    const n = makeFigure('player');
    const paint = (node) => {
      node.material = { color: [0.95, 0.1, 0.85], emissive: 0, alpha: 1, unlit: 1, additive: false };
      node.children.forEach(paint);
    };
    paint(n);
    if (n.tip) n.tip.visible = false;
    return n;
  }

  function figureFor(obj, kind, element) {
    let n = nodes.get(obj);
    if (!n || n.kind !== kind) {
      n = makeFigure(kind, element);
      n.kind = kind;
      nodes.set(obj, n);
    }
    return n;
  }

  function flameNode(key) {
    let f = flames.get(key);
    if (!f) {
      f = new Node();
      f.outer = f.add(new Node('sphere', { color: [1, 0.45, 0.12], emissive: 2.2, alpha: 0.55, additive: true }));
      f.inner = f.add(new Node('sphere', { color: [1, 0.85, 0.5], emissive: 2.6, alpha: 0.9, additive: true }));
      flames.set(key, f);
    }
    return f;
  }

  return {
    ring,
    /*
     * Собирает узлы и свет на этот кадр. Ничего не пишет в мир.
     * time — часы отрисовки (мерцание, парение), а не часы мира: кадр с
     * остановленным миром всё равно живой.
     */
    update(world, baked, time, options = {}) {
      const { hideHero = false, flatHero: flat = false } = options;
      const root = renderer.scene;
      root.children.length = 0;
      const lights = [];
      const particles = [];
      const soft = [];
      const fx = baked.fixtures;
      const flick = (seed, amount) => 1 - amount + amount * (0.55 + 0.45 * Math.sin(time * 9.1 + seed) * Math.sin(time * 5.3 + seed * 1.7));

      for (const l of fx.lights) lights.push({ ...l, power: l.power * flick(l.pos[0] * 3 + l.pos[2], l.flicker || 0) });
      /* Фонарь на срезанной стене гаснет вместе с ней — иначе свет
         висел бы в воздухе пятном на срезе. */
      for (const l of fx.lamps) {
        if (cutAmount(renderer.cut, l.anchor[0], l.anchor[1]) > 0.02) continue;
        lights.push({ pos: l.pos, color: l.color, power: 1.5, range: 5.6 });
      }

      /* Силовые двери: полотно мерцает, по нему бегут искры. */
      for (const f of fx.forces) {
        /* Поворот вкладывается узлом в узел: так он не зависит от порядка
           осей в compose. */
        const holder = new Node();
        holder.position = [f.x, 0.72, f.z];
        holder.rotation = [0, f.ry, 0];
        const n = holder.add(new Node('quad', { color: f.color, emissive: 1.1, alpha: 0.4 + 0.1 * Math.sin(time * 7 + f.x), additive: true, unlit: 1 }));
        n.rotation = [Math.PI / 2, 0, 0];
        n.scale = [0.56, 1, 1.3];
        root.add(holder);
        for (let i = 0; i < 6; i += 1) {
          const ph = (time * 0.7 + i / 6) % 1;
          const off = (M.hash2(i, Math.floor(time * 0.7 + i / 6)) - 0.5) * 0.5;
          const px = f.ry ? f.x : f.x + off, pz = f.ry ? f.z + off : f.z;
          particles.push(px, 0.1 + ph * 1.25, pz, f.color[0], f.color[1], f.color[2], 0.8 * (1 - ph), 0.09);
        }
      }

      /* Выход: светится, только когда открыт — свет и есть сообщение. */
      for (const e of fx.exits) {
        if (!world.exitOpen) continue;
        const n = new Node('ring', { color: e.color, emissive: 0, alpha: 0.55 + 0.2 * Math.sin(time * 3), additive: true, unlit: 1 });
        n.position = [e.x, 0.06, e.z];
        n.scale = [0.46, 1, 0.46];
        root.add(n);
        lights.push({ pos: [e.x, 0.5, e.z], color: e.color, power: 0.7, range: 3.2 });
        for (let i = 0; i < 4; i += 1) {
          const ph = (time * 0.5 + i / 4) % 1, a = i * 1.7 + Math.floor(time * 0.5 + i / 4);
          particles.push(e.x + Math.cos(a) * 0.3, 0.1 + ph * 1.1, e.z + Math.sin(a) * 0.3, e.color[0], e.color[1], e.color[2], 0.7 * (1 - ph), 0.07);
        }
      }

      /* Искры у кристаллов: подсказка «тут живёт разряд». */
      for (const c of fx.crystals) {
        for (let i = 0; i < 5; i += 1) {
          const a = time * (0.6 + i * 0.13) + i * 2.1;
          particles.push(c.x + Math.cos(a) * 0.45, 0.6 + 0.4 * Math.sin(a * 1.3 + i), c.z + Math.sin(a) * 0.45, 1, 0.88, 0.4, 0.75, 0.05);
        }
      }

      /* Предметы операции: ядро и свечи. */
      for (const prop of world.props || []) {
        const x = prop.x / T, z = prop.y / T;
        if (prop.kind === 'core') {
          const ped = new Node('cylinder', { color: [0.2, 0.19, 0.24], surf: SURF.SLAB });
          ped.position = [x, 0.22, z]; ped.scale = [0.34, 0.44, 0.34];
          root.add(ped);
          const cap = new Node('cylinder', { color: [0.12, 0.12, 0.15] });
          cap.position = [x, 0.46, z]; cap.scale = [0.4, 0.06, 0.4];
          root.add(cap);
          const sh = new Node('blob', { shadow: true }); sh.position = [x, 0.008, z]; sh.scale = [0.7, 1, 0.7]; root.add(sh);
          if (!prop.taken) {
            const y = 1.0 + Math.sin(time * 1.6) * 0.06;
            const orb = new Node('sphere', { color: C('#7ffcff'), emissive: 2.2 });
            orb.position = [x, y, z]; orb.scale = [0.2, 0.2, 0.2];
            root.add(orb);
            const halo = new Node('sphere', { color: C('#32dfff'), emissive: 1.4, alpha: 0.28, additive: true, unlit: 1 });
            halo.position = [x, y, z]; halo.scale = [0.42, 0.42, 0.42];
            root.add(halo);
            for (let i = 0; i < 2; i += 1) {
              const r = new Node('torus', { color: C('#9df9ff'), emissive: 1.6 });
              r.position = [x, y, z]; r.scale = [0.36 + i * 0.08, 0.4, 0.36 + i * 0.08];
              r.rotation = [time * (0.9 + i * 0.4) + i, time * 0.6, 0.6 * i];
              root.add(r);
            }
            lights.push({ pos: [x, y, z], color: C('#5ff0ff'), power: 2.1 * (0.92 + 0.08 * Math.sin(time * 2.3)), range: 6.5 });
            for (let i = 0; i < 8; i += 1) {
              const a = time * 0.9 + i * 0.785, rr = 0.5 + 0.12 * Math.sin(time * 2 + i);
              particles.push(x + Math.cos(a) * rr, y - 0.3 + ((time * 0.3 + i / 8) % 1) * 0.8, z + Math.sin(a) * rr, 0.5, 0.95, 1, 0.8, 0.06);
            }
          }
        }
        if (prop.kind === 'candle') {
          const base = new Node('cylinder', { color: [0.5, 0.38, 0.18], surf: SURF.METAL });
          base.position = [x, 0.03, z]; base.scale = [0.13, 0.06, 0.13]; root.add(base);
          const stem = new Node('cylinder', { color: [0.5, 0.38, 0.18], surf: SURF.METAL });
          stem.position = [x, 0.2, z]; stem.scale = [0.03, 0.32, 0.03]; root.add(stem);
          const cup = new Node('cylinder', { color: [0.5, 0.38, 0.18], surf: SURF.METAL });
          cup.position = [x, 0.37, z]; cup.scale = [0.08, 0.03, 0.08]; root.add(cup);
          const wax = new Node('cylinder', { color: [0.9, 0.86, 0.76] });
          wax.position = [x, 0.5, z]; wax.scale = [0.05, 0.24, 0.05]; root.add(wax);
          const sh = new Node('blob', { shadow: true }); sh.position = [x, 0.008, z]; sh.scale = [0.3, 1, 0.3]; root.add(sh);
          if (prop.lit) {
            const f = flameNode(prop);
            const k = flick(x * 7 + z, 0.35);
            f.position = [x, 0.7, z];
            f.outer.scale = [0.06, 0.12 * (0.85 + 0.3 * k), 0.06];
            f.inner.scale = [0.03, 0.06 * (0.9 + 0.2 * k), 0.03];
            f.inner.position = [0, -0.02, 0];
            root.add(f);
            lights.push({ pos: [x, 0.8, z], color: [1, 0.6, 0.28], power: 1.9 * k, range: 5.2 });
          }
        }
      }

      /* Вещество на полу: пожар светит сам и дымит искрами. */
      if (world.ground) {
        for (let i = 0; i < world.ground.length; i += 1) {
          if (world.ground[i] !== GROUND.FIRE) continue;
          const x = (i % world.w) + 0.5, z = Math.floor(i / world.w) + 0.5;
          const k = flick(i * 1.3, 0.4);
          lights.push({ pos: [x, 0.7, z], color: [1, 0.45, 0.14], power: 1.8 * k, range: 4.4 });
          /* Языки пламени: три конуса на клетку, каждый дышит своим темпом. */
          for (let j = 0; j < 3; j += 1) {
            const a = j * 2.1 + i, r = 0.18 + 0.1 * M.hash2(i, j);
            const hgt = 0.35 + 0.35 * M.hash2(j, i) + 0.12 * Math.sin(time * (7 + j) + i);
            const tongue = new Node('cone', { color: j ? [0.95, 0.32, 0.05] : [1, 0.62, 0.2], emissive: 0.15, alpha: 0.42, additive: true, unlit: 1 });
            tongue.position = [x + Math.cos(a) * r, hgt * 0.6, z + Math.sin(a) * r];
            tongue.scale = [0.08 + 0.04 * j, hgt * 1.2, 0.08 + 0.04 * j];
            root.add(tongue);
          }
          for (let j = 0; j < 4; j += 1) {
            const ph = (time * 0.9 + j / 4 + M.hash2(i, j)) % 1;
            const ox = (M.hash2(i, j + Math.floor(time * 0.9 + j / 4)) - 0.5) * 0.8;
            const oz = (M.hash2(j, i + Math.floor(time * 0.9 + j / 4)) - 0.5) * 0.8;
            particles.push(x + ox, 0.1 + ph * 1.4, z + oz, 1, 0.5 + 0.3 * (1 - ph), 0.15, 0.9 * (1 - ph), 0.16 * (1 - ph * 0.5));
          }
        }
      }

      /* Маги. Живые стоят, сбитые лежат, мёртвые — лежат и темнеют. */
      const actors = [];
      /* hideHero — только для замера «сколько героя видно»: фигура
         убирается, свет посоха остаётся, чтобы разница была одной фигурой. */
      if (world.player && world.player.alive && !hideHero && !flat) actors.push([world.player, 'player', null]);
      if (world.player && world.player.alive && flat && !hideHero) {
        if (!flatHero) flatHero = makeFlatHero();
        flatHero.position = [world.player.x / T, 0, world.player.y / T];
        lay(flatHero, world.player.angle || 0, false);
        root.add(flatHero);
      }
      /* noActors — только для замера заслонённости стенами: чужие фигуры
         заслоняют героя честно, но эта мера не про них. */
      const others = !options.noActors;
      if (others) for (const e of world.enemies) if (e.alive) actors.push([e, e.kind, e.element]);
      if (others) for (const c of world.civilians) if (c.alive) actors.push([c, 'civil', null]);
      if (others && world.hostage && world.hostage.alive && !world.hostage.rescued) actors.push([world.hostage, 'hostage', null]);
      for (const [obj, kind, element] of actors) {
        const n = figureFor(obj, kind, element);
        /* Щуп замера (igra.js, probe): щит без хозяина не рисуется. */
        if (n.shield) for (const s of n.shield) s.visible = !(options.hide && options.hide.has('shields'));
        n.position = [obj.x / T, 0, obj.y / T];
        lay(n, obj.angle || 0, (obj.downed || 0) > 0);
        /* Щуп замера: фигура героя не рисуется, кольцо и тень остаются. */
        if (!(kind === 'player' && options.hide && options.hide.has('hero'))) root.add(n);
        n.shadow.position = [obj.x / T, 0.008, obj.y / T];
        root.add(n.shadow);
      }
      for (const c of world.corpses) {
        let n = corpseNodes.get(c);
        if (!n) { n = makeFigure('dead'); corpseNodes.set(c, n); }
        n.position = [c.x / T, 0, c.y / T];
        lay(n, c.angle || 0, true);
        root.add(n);
      }

      /* Герой: кольцо под ногами и свет навершия посоха. */
      const p = world.player;
      if (p && p.alive) {
        const hx = p.x / T, hz = p.y / T;
        ring.position = [hx, 0.03, hz];
        const s = 0.5 + 0.03 * Math.sin(time * 4);
        ring.scale = [s, 1, s];
        ring.material.alpha = 0.6 + 0.2 * Math.sin(time * 4);
        if (!hideHero && !flat) root.add(ring);
        const tipA = Math.PI / 2 - p.angle;
        const tx = hx + Math.cos(tipA) * 0.3 + Math.sin(tipA) * 0.1;
        const tz = hz - Math.sin(tipA) * 0.3 + Math.cos(tipA) * 0.1;
        lights.push({ pos: [tx, 1.3, tz], color: C('#9df9ff'), power: 0.75, range: 3.2 });
      }

      spellLayer(world, root, lights, particles, soft, time);
      changeLayer(options.changes || [], root, lights, particles, soft);
      hintLayer(world, root, time);
      if (options.cursor) cursorLayer(options.cursor, root, time);

      return { lights, particles: new Float32Array(particles), soft: new Float32Array(soft) };
    },
  };
}

/* ---------------------------------------------------------
   ЧТО СДЕЛАЛО ЗАКЛИНАНИЕ
   ---------------------------------------------------------
   Всё ниже читается из настоящего состояния мира — того же, что рисует
   плоский вид (render.js: drawBullets, drawBlasts, drawPops, drawClouds):
   снаряды, вспышки форм (конус, луч, круг), кольца попаданий, искры, пар
   и пыль. Ничего не придумывается сверх мира: если мир не родил вспышку,
   её нет и здесь. Ничего и не пишется в мир.
   --------------------------------------------------------- */

const rgbOf = (c, fallback = '#ffffff') => M.rgb(c || fallback);

/* Клин конуса — кольцо от нуля с нужной дугой, кешируется по дуге. */
const wedgeCache = new Map();
function wedgeKey(renderer, arc) {
  const key = `wedge${arc.toFixed(3)}`;
  if (!wedgeCache.has(key)) {
    wedgeCache.set(key, true);
    renderer.register(key, new Builder().add(Geo.ring(0, 1, arc, 18), M.identity()).data);
  }
  return key;
}

let spellRenderer = null;

function spellLayer(world, root, lights, particles, soft, time) {
  /* Снаряд: светящийся шар, за ним хвост искр по скорости, вокруг свет. */
  for (const bullet of world.bullets || []) {
    const c = rgbOf(bullet.colour);
    const x = bullet.x / T, z = bullet.y / T;
    const n = new Node('sphere', { color: c, emissive: 2.2, alpha: 0.9, additive: true });
    n.position = [x, 0.7, z]; n.scale = [0.14, 0.14, 0.14];
    root.add(n);
    const core = new Node('sphere', { color: [1, 1, 1], emissive: 1.5, alpha: 0.8, additive: true, unlit: 1 });
    core.position = [x, 0.7, z]; core.scale = [0.06, 0.06, 0.06];
    root.add(core);
    const vx = (bullet.vx || 0) / T, vz = (bullet.vy || 0) / T;
    for (let k = 1; k <= 6; k += 1) {
      const back = k * 0.014;
      particles.push(x - vx * back, 0.7, z - vz * back, c[0], c[1], c[2], 0.75 * (1 - k / 7), 0.11 * (1 - k / 9));
    }
    lights.push({ pos: [x, 0.8, z], color: c, power: 1.5, range: 3.8 });
  }

  for (const blast of world.blasts || []) {
    const t = M.clamp(1 - blast.life / (blast.span || 0.3), 0, 1);
    const fade = 1 - t;
    const c = rgbOf(blast.colour);
    if (blast.kind === 'cone' && spellRenderer) {
      /* Конус: клин на полу и такой же над ним, расходится и гаснет. */
      const arc = blast.arc || 1;
      const reach = (blast.reach || 124) / T * (0.6 + t * 0.4);
      const holder = new Node();
      holder.position = [blast.x / T, 0, blast.y / T];
      holder.rotation = [0, Math.PI / 2 - (blast.angle || 0) - arc / 2, 0];
      const key = wedgeKey(spellRenderer, arc);
      for (const [y, a] of [[0.05, 0.5], [0.55, 0.28]]) {
        const w = holder.add(new Node(key, { color: c, emissive: 1.2, alpha: a * fade, additive: true, unlit: 1 }));
        w.position = [0, y, 0]; w.scale = [reach, 1, reach];
      }
      root.add(holder);
      for (let i = 0; i < 10; i += 1) {
        const a = (blast.angle || 0) + (M.hash2(i, 7) - 0.5) * arc;
        const r = reach * (0.3 + 0.7 * M.hash2(i, 3));
        particles.push(blast.x / T + Math.cos(a) * r, 0.25 + 0.6 * M.hash2(3, i), blast.y / T + Math.sin(a) * r, c[0], c[1], c[2], 0.8 * fade, 0.12);
      }
      lights.push({ pos: [blast.x / T + Math.cos(blast.angle || 0) * reach * 0.5, 0.6, blast.y / T + Math.sin(blast.angle || 0) * reach * 0.5], color: c, power: 2.2 * fade, range: 4.5 });
    } else if (blast.kind === 'beam') {
      /* Луч: светящийся цилиндр от посоха до конца линии, белая сердцевина. */
      const x1 = blast.x / T, z1 = blast.y / T, x2 = blast.x2 / T, z2 = blast.y2 / T;
      const len = Math.hypot(x2 - x1, z2 - z1);
      const a = Math.atan2(z2 - z1, x2 - x1);
      const holder = new Node();
      holder.position = [(x1 + x2) / 2, 0.75, (z1 + z2) / 2];
      holder.rotation = [0, -a, 0];
      for (const [r, col, alpha] of [[0.16 * fade + 0.04, c, 0.55], [0.05 * fade + 0.02, [1, 1, 1], 0.9]]) {
        const n = holder.add(new Node('cylinder', { color: col, emissive: 1.6, alpha: alpha * fade, additive: true, unlit: 1 }));
        n.rotation = [0, 0, Math.PI / 2];
        n.scale = [r, len, r];
      }
      root.add(holder);
      for (let s = 0; s <= len; s += 1.5) {
        lights.push({ pos: [x1 + Math.cos(a) * s, 0.8, z1 + Math.sin(a) * s], color: c, power: 1.6 * fade, range: 3 });
      }
      for (let i = 0; i < 14; i += 1) {
        const s = M.hash2(i, 11) * len;
        particles.push(x1 + Math.cos(a) * s, 0.75 + (M.hash2(i, 5) - 0.5) * 0.3, z1 + Math.sin(a) * s, c[0], c[1], c[2], fade, 0.09);
      }
    } else if (blast.kind === 'nova') {
      /* Вспышка: кольцо по полу расходится до радиуса, шар света гаснет. */
      const tint = rgbOf(blast.tint || blast.colour);
      const R = (blast.radius || 104) / T;
      const ringN = new Node('ring', { color: tint, emissive: 1.5, alpha: 0.9 * fade, additive: true, unlit: 1 });
      ringN.position = [blast.x / T, 0.06, blast.y / T];
      const r = R * (0.3 + t * 0.8);
      ringN.scale = [r, 1, r];
      root.add(ringN);
      const flash = new Node('sphere', { color: tint, emissive: 1.2, alpha: 0.32 * fade, additive: true, unlit: 1 });
      flash.position = [blast.x / T, 0.5, blast.y / T];
      flash.scale = [r * 0.8, r * 0.55, r * 0.8];
      root.add(flash);
      lights.push({ pos: [blast.x / T, 0.9, blast.y / T], color: tint, power: 3 * fade, range: R + 2.5 });
    }
  }

  /*
   * Ток по воде: world.charged — лужа под разрядом прямо сейчас (полсекунды),
   * world.residual — остаточный ток (2,6 с, по нему ещё бьёт). Это то же,
   * что рисует плоский вид (render.js): без этого молния в лужу на кадре
   * была видна только упавшим стражем — вода, через которую ударило,
   * оставалась синей и немой.
   */
  for (const [field, strong] of [[world.charged, true], [world.residual, false]]) {
    if (!field || !field.tiles) continue;
    const k = M.clamp(field.life / (field.max || 0.5), 0, 1);
    for (const i of field.tiles) {
      const x = (i % world.w) + 0.5, z = Math.floor(i / world.w) + 0.5;
      const n = M.hash2(i, Math.floor(time * 24));
      if (strong) {
        const f = new Node('frame', { color: [1, 0.92, 0.45], emissive: 1.6, alpha: 0.7 * k, additive: true, unlit: 1 });
        f.position = [x, levelOf(world.tiles[i]) + 0.04, z]; f.scale = [0.9, 1, 0.9];
        root.add(f);
      }
      if (n < (strong ? 0.9 : 0.25)) {
        particles.push(x + (M.hash2(i, 3 + Math.floor(time * 30)) - 0.5) * 0.8, 0.06 + 0.1 * n, z + (M.hash2(5, i + Math.floor(time * 30)) - 0.5) * 0.8,
          1, 0.95, 0.55, (strong ? 1 : 0.5) * k, strong ? 0.16 : 0.08);
      }
    }
    if (strong) lights.push({ pos: [field.x / T, 0.6, field.y / T], color: [1, 0.9, 0.5], power: 2.4 * k, range: 5 });
  }
  /* Оглушённый разрядом трещит искрами (body.zap — таймер мира). */
  for (const body of [world.player, ...(world.enemies || []), ...(world.corpses || [])]) {
    if (!body || !(body.zap > 0)) continue;
    for (let j = 0; j < 5; j += 1) {
      const a = M.hash2(j, Math.floor(time * 20)) * Math.PI * 2;
      particles.push(body.x / T + Math.cos(a) * 0.3, 0.3 + 0.9 * M.hash2(Math.floor(time * 20), j), body.y / T + Math.sin(a) * 0.3,
        1, 0.92, 0.5, 0.9, 0.07);
    }
  }

  /* Кольцо попадания: там, где удар что-то нашёл, и только тогда. */
  for (const ring of world.pops || []) {
    const t = M.clamp(1 - ring.life / (ring.span || 0.22), 0, 1);
    const c = rgbOf(ring.colour);
    const n = new Node('ring', { color: c, emissive: 1.4, alpha: 0.95 * (1 - t), additive: true, unlit: 1 });
    const r = (ring.r + (ring.max - ring.r) * t) / T;
    n.position = [ring.x / T, 0.5, ring.y / T]; n.scale = [r, 1, r];
    root.add(n);
  }

  /* Искры мира (удары, брызги) — точками на высоте пояса. */
  for (const sp of world.particles || []) {
    const c = rgbOf(sp.color);
    const life = Math.max(0, Math.min(1, sp.life / (sp.max || 0.5)));
    particles.push(sp.x / T, 0.25 + 0.35 * life, sp.y / T, c[0], c[1], c[2], life, 0.05 * (sp.size || 1.5));
  }

  /*
   * Пар и пыль — объёмом, а не пятном: несколько мягких клубов на высоте
   * тела, обычным смешиванием, а не сложением — облако прячет то, что за
   * ним, как и в мире (cloudsBlock закрывает взгляд).
   */
  for (const cl of world.clouds || []) {
    const life = Math.max(0, Math.min(1, cl.life / (cl.span || 4)));
    const tone = cl.kind === 'dust' ? [0.58, 0.48, 0.34] : [0.8, 0.86, 0.92];
    const R = (cl.r || 40) / T * (1 + (1 - life) * 0.5);
    for (let i = 0; i < 7; i += 1) {
      const a = i * 2.4 + M.hash2(i, Math.round(cl.x)) * 2 + time * 0.15;
      const rr = i === 0 ? 0 : R * (0.35 + 0.35 * M.hash2(i, 9));
      const y = 0.35 + 0.9 * M.hash2(i, 4) + 0.06 * Math.sin(time * 0.8 + i);
      soft.push(cl.x / T + Math.cos(a) * rr, y, cl.y / T + Math.sin(a) * rr, tone[0], tone[1], tone[2], 0.42 * life, R * 1.25);
    }
  }
}

/*
 * Клетка изменилась (сгорела солома, вскрыта бочка, ров замёрз): короткий
 * след на месте — обломки цвета того, чем клетка была, пыль и рамка
 * клетки. Список изменений собирает main.js сравнением сетки; это ответ
 * на «что оно сделало», видный и на общем плане, и на крупном.
 */
const CHANGE_LIFE = 1.4;
function materialColour(tile) {
  if (tile === TILE.HAY) return [0.75, 0.6, 0.25];
  if (tile === TILE.BARREL || tile === TILE.WOOD || tile === TILE.DOOR || tile === TILE.TABLE) return [0.45, 0.28, 0.14];
  if (tile === TILE.BOULDER) return [0.42, 0.4, 0.38];
  if (tile === TILE.CRYSTAL) return [1, 0.85, 0.3];
  if (tile === TILE.GLASS) return [0.6, 0.95, 1];
  if (tile === TILE.DRIFT) return [0.32, 0.31, 0.36];
  if (tile === TILE.PANEL || tile === TILE.METAL) return [0.55, 0.58, 0.62];
  if (tile === TILE.FROZEN) return [0.8, 0.95, 1];
  if (tile === TILE.MIRE) return [0.5, 0.4, 0.22];
  if (tile === TILE.STONE) return [1, 0.45, 0.16];
  if (tile === TILE.DEEP) return [0.4, 0.75, 0.95];
  return [0.8, 0.8, 0.8];
}

function changeLayer(changes, root, lights, particles, soft) {
  for (const ch of changes) {
    const t = ch.age / CHANGE_LIFE;
    if (t < 0 || t >= 1) continue;
    const fade = 1 - t;
    const x = ch.x + 0.5, z = ch.y + 0.5;
    /* Что клетка значит теперь: для рва — её новое состояние, для
       предмета — то, чем он был (обломки летят его цветом). */
    const c = materialColour(SUNKEN.has(ch.to) ? ch.to : ch.from);
    const frame = new Node('frame', { color: c, emissive: 1.2, alpha: 0.85 * fade, additive: true, unlit: 1 });
    frame.position = [x, levelOf(ch.to) + 0.03, z];
    const s = 1 + 0.25 * t;
    frame.scale = [s, 1, s];
    root.add(frame);
    for (let i = 0; i < 12; i += 1) {
      const a = M.hash2(i, ch.x * 31 + ch.y) * Math.PI * 2;
      const v = 0.8 + 1.4 * M.hash2(ch.y, i);
      const up = 2.2 + 1.5 * M.hash2(i, ch.x);
      const tt = ch.age;
      const y = Math.max(0.04, 0.4 + up * tt - 4.9 * tt * tt);
      const chunk = new Node('cube', { color: c, emissive: 0.2 });
      chunk.position = [x + Math.cos(a) * v * tt, y, z + Math.sin(a) * v * tt];
      const k = 0.07 + 0.05 * M.hash2(i, 2);
      chunk.scale = [k, k, k];
      chunk.rotation = [tt * 7 + i, tt * 5, i];
      root.add(chunk);
    }
    soft.push(x, 0.4 + 0.5 * t, z, c[0] * 0.8 + 0.15, c[1] * 0.8 + 0.15, c[2] * 0.8 + 0.15, 0.35 * fade, 1.1 + 0.6 * t);
    if (t < 0.4) lights.push({ pos: [x, 0.8, z], color: c, power: 1.4 * (1 - t / 0.4), range: 3 });
  }
}

/*
 * Цель подсказки (место заложено 03.10): другой агент добавляет
 * world.hint.target. Формат ещё не назначен, поэтому читается любой из
 * трёх: { x, y } в точках мира, { tx, ty } в клетках или [tx, ty].
 * Нет цели — ничего не рисуется.
 */
export function hintCell(world) {
  const target = world && world.hint && world.hint.target;
  if (!target) return null;
  if (Array.isArray(target) && target.length >= 2) return { x: target[0] + 0.5, z: target[1] + 0.5 };
  if (Number.isFinite(target.tx) && Number.isFinite(target.ty)) return { x: target.tx + 0.5, z: target.ty + 0.5 };
  if (Number.isFinite(target.x) && Number.isFinite(target.y)) return { x: target.x / T, z: target.y / T };
  return null;
}

function hintLayer(world, root, time) {
  const cell = hintCell(world);
  if (!cell) return;
  const bob = 0.12 * Math.sin(time * 3);
  const arrow = new Node('cone', { color: [1, 0.85, 0.35], emissive: 1.4, unlit: 1 });
  arrow.position = [cell.x, 1.5 + bob, cell.z];
  arrow.scale = [0.16, 0.34, 0.16];
  arrow.rotation = [Math.PI, 0, 0];
  root.add(arrow);
  const ring = new Node('ring', { color: [1, 0.85, 0.35], emissive: 1, alpha: 0.6 + 0.2 * Math.sin(time * 3), additive: true, unlit: 1 });
  ring.position = [cell.x, 0.05, cell.z];
  ring.scale = [0.45, 1, 0.45];
  root.add(ring);
}

/* Клетка под указателем: рамка на полу — палец и мышь видят, куда целят. */
function cursorLayer(cursor, root, time) {
  const n = new Node('frame', { color: [0.62, 0.98, 1], emissive: 1, alpha: 0.55 + 0.15 * Math.sin(time * 5), additive: true, unlit: 1 });
  n.position = [cursor.tx + 0.5, (cursor.level || 0) + 0.025, cursor.ty + 0.5];
  root.add(n);
}

/* Рамка клетки: квадратный контур 1×1 в плоскости пола. */
export function frameGeometry(w = 0.07) {
  const b = new Builder();
  const c = [1, 1, 1];
  const strip = (x0, z0, x1, z1) => b.quad4([[x0, 0, z0], [x0, 0, z1], [x1, 0, z1], [x1, 0, z0]], [0, 1, 0], [c, c, c, c]);
  strip(-0.5, -0.5, 0.5, -0.5 + w);
  strip(-0.5, 0.5 - w, 0.5, 0.5);
  strip(-0.5, -0.5 + w, -0.5 + w, 0.5 - w);
  strip(0.5 - w, -0.5 + w, 0.5, 0.5 - w);
  return b.data;
}

/*
 * Вещество на полу — тонким слоем поверх пола, пересобирается каждый
 * кадр. Лужа, лёд и грязь — с мягким краем: клетка бьётся на четыре
 * четверти, и прозрачность в углу — доля соседей с тем же веществом.
 * Одиночная клетка выходит круглой кляксой, большая лужа — сплошной с
 * мягким берегом. Квадратные плитки читались ковриками, а не водой.
 * Пожар остаётся плиткой: свой край он рисует сам в шейдере (угли).
 */
const GROUND_LOOK = {
  [GROUND.WATER]: { color: [0.1, 0.26, 0.4], alpha: 0.78, surf: SURF.WATER, soft: true },
  [GROUND.FIRE]: { color: [1, 0.4, 0.1], alpha: 0.85, surf: SURF.FIRE },
  [GROUND.ICE]: { color: [0.62, 0.86, 0.96], alpha: 0.82, surf: SURF.ICE, soft: true },
  [GROUND.MUD]: { color: [0.24, 0.17, 0.08], alpha: 0.92, surf: SURF.MUD, soft: true },
};

export function bakeGround(world) {
  const b = new Builder();
  if (!world.ground) return b.data;
  const { w, h, ground } = world;
  const same = (tx, ty, g) => tx >= 0 && ty >= 0 && tx < w && ty < h && ground[ty * w + tx] === g;
  for (let i = 0; i < ground.length; i += 1) {
    const g = ground[i];
    const look = GROUND_LOOK[g];
    if (!look) continue;
    const tx = i % w, ty = Math.floor(i / w);
    const y = levelOf(world.tiles[i]) + 0.018;
    /* Высыхает — бледнеет: последние полторы секунды жизни лужа уходит. */
    const life = world.groundLife ? M.clamp(world.groundLife[i] / 1.5, 0.25, 1) : 1;
    const c = look.color;
    if (!look.soft) {
      b.floorQuad(tx, ty, y, [c, c, c, c], { surf: look.surf, alpha: look.alpha * life });
      continue;
    }
    /* f — доля соседей с тем же веществом: 1 внутри, 0 на голом краю. */
    const A = (f) => { const t = M.clamp((f - 0.3) / 0.7, 0, 1); return look.alpha * life * t * t * (3 - 2 * t); };
    const cornerF = (cx, cz) => ([[-1, -1], [0, -1], [-1, 0], [0, 0]].filter(([dx, dz]) => same(cx + dx, cz + dz, g)).length) / 4;
    const midF = (dx, dz) => (1 + (same(tx + dx, ty + dz, g) ? 1 : 0)) / 2;
    const P = (fx, fz) => [tx + fx, y, ty + fz];
    const cc = [c, c, c, c];
    const centre = A(1);
    const n = midF(0, -1), s = midF(0, 1), we = midF(-1, 0), e = midF(1, 0);
    const nw = cornerF(tx, ty), ne = cornerF(tx + 1, ty), se = cornerF(tx + 1, ty + 1), sw = cornerF(tx, ty + 1);
    const opts = (alphas) => ({ surf: look.surf, alphas });
    b.quad4([P(0, 0), P(0, 0.5), P(0.5, 0.5), P(0.5, 0)], [0, 1, 0], cc, opts([A(nw), A(we), centre, A(n)]));
    b.quad4([P(0.5, 0), P(0.5, 0.5), P(1, 0.5), P(1, 0)], [0, 1, 0], cc, opts([A(n), centre, A(e), A(ne)]));
    b.quad4([P(0, 0.5), P(0, 1), P(0.5, 1), P(0.5, 0.5)], [0, 1, 0], cc, opts([A(we), A(sw), A(s), centre]));
    b.quad4([P(0.5, 0.5), P(0.5, 1), P(1, 1), P(1, 0.5)], [0, 1, 0], cc, opts([centre, A(s), A(se), A(e)]));
  }
  /* Кровь — тёмными пятнами: по ней видно, где уже был бой. */
  for (const d of world.decals || []) {
    const r = (d.r || 8) / T;
    b.add(DISC, at(d.x / T, 0.014, d.y / T, 0, r, 1, r), { color: [0.32, 0.02, 0.06], alpha: (d.a || 0.6) * 0.85 });
  }
  return b.data;
}
