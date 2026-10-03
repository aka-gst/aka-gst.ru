/*
 * ТЕХНОМАГИЯ — объёмная отрисовка на голом WebGL 1.
 *
 * По образцу отрисовки Vanta, vanta-forge 4f5246b (Game/src/engine.js):
 * та же иерархия узлов (Node), те же процедурные фигуры (Geo), те же
 * материалы — цвет, свечение, прозрачность, «без света», сложение, — тот
 * же проход свечения (выжимка ярких, два размытия, сложение в конце) и те
 * же точки-искры. Ни three.js, ни других библиотек: это и есть «свой
 * движок», о котором просил Сергей.
 *
 * Что отличается от Vanta и почему:
 *
 * 1. ТОЧЕЧНЫЙ СВЕТ. У Vanta свет один — неподвижные «ключ» и «заливка»
 *    плюс свечение вокруг игрока. Для вида «как BG3» этого мало: свеча,
 *    пожар, кристалл и ядро должны светить сами и по-разному. Здесь до
 *    двенадцати точечных источников; каждый кадр берутся ближайшие к
 *    точке, куда смотрит камера (см. render → pickLights).
 *
 * 2. ЗАПЕЧЁННАЯ ВЕРШИНА ТОЛЩЕ. У Vanta вершина — положение и нормаль, а
 *    цвет живёт в материале, поэтому печь приходится по пачке на материал.
 *    Здесь цвет, свечение, номер поверхности и прозрачность лежат прямо в
 *    вершине — весь неподвижный этаж уходит в один буфер и рисуется одним
 *    вызовом. 15 чисел на вершину:
 *      положение 3 · нормаль 3 · цвет 3 · (свечение, поверхность, срез, альфа) 4 · якорь 2
 *
 * 3. СРЕЗ СТЕН. Стена между камерой и героем опускается до пенька прямо в
 *    вершинном шейдере — по «якорю», центру своей клетки. Буфер при этом
 *    не перепекается: срез — это униформа, а не геометрия.
 *
 * 4. ОРТОГРАФИЯ. Камера «как Ultima Online» перспективы не знает.
 */

import * as M from './math.js';
import { WALL_H } from './camera.js';

export const MAX_LIGHTS = 12;
export const STRIDE = 15;

/* Номера поверхностей: шейдер дорисовывает фактуру по ним. Нумерация
   общая для печи и шейдера — менять номер значит менять в обоих. */
export const SURF = {
  PLAIN: 0,
  YARD: 1,     /* двор: утоптанная земля и трава пятнами */
  SLAB: 2,     /* плиты внутри здания */
  BRICK: 3,    /* бока стены: кладка */
  CAP: 4,      /* верх стены */
  WOOD: 5,
  RUG: 6,
  METAL: 7,
  STRAW: 8,
  SHADOW: 9,   /* пятно тени: без света, только альфа */
  WATER: 10,
  FIRE: 11,
  ICE: 12,
  MUD: 13,
  SKIN: 14,    /* фигуры: подсветка по краю, чтобы читались на тёмном */
  /* С 03.10 — клетки «Башни» и масса стен. */
  MOAT: 15,    /* ров: глубокая вода, поверхность живая */
  ABYSS: 16,   /* пропасть: стенки уходят в черноту, дна нет */
  ROOF: 17,    /* внутренняя масса стен: тёмная плоская «крыша» */
  BASALT: 18,  /* ров, застывший камнем после лавы */
  SOOT: 19,    /* нанос сажи */
};

export class Node {
  constructor(geometry = null, material = {}) {
    this.geometry = geometry;
    this.material = { color: [1, 1, 1], emissive: 0, alpha: 1, unlit: 0, additive: false, ...material };
    this.position = [0, 0, 0];
    this.rotation = [0, 0, 0];
    this.scale = [1, 1, 1];
    this.children = [];
    this.visible = true;
    this.world = M.identity();
  }
  add(n) { this.children.push(n); return n; }
  set(x, y, z) { this.position = [x, y, z]; return this; }
  size(x, y = x, z = x) { this.scale = [x, y, z]; return this; }
  turn(x, y, z) { this.rotation = [x, y, z]; return this; }
}

/* ---------------------------------------------------------
   ФИГУРЫ — как у Vanta: массивы (положение, нормаль) по 6 чисел.
   --------------------------------------------------------- */

function tri(out, a, b, c, na, nb = na, nc = na) { out.push(...a, ...na, ...b, ...nb, ...c, ...nc); }
function face(out, a, b, c) {
  const n = M.normalize(M.cross(b.map((v, i) => v - a[i]), c.map((v, i) => v - a[i])));
  tri(out, a, b, c, n);
}

export const Geo = {
  cube() {
    const o = [];
    const faces = [
      [[0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5], [0.5, -0.5, 0.5], [1, 0, 0]],
      [[-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5], [-0.5, -0.5, -0.5], [-1, 0, 0]],
      [[-0.5, 0.5, -0.5], [-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5], [0, 1, 0]],
      [[-0.5, -0.5, 0.5], [-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [0, -1, 0]],
      [[-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5], [0, 0, 1]],
      [[0.5, -0.5, -0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5], [0, 0, -1]],
    ];
    for (const [a, b, c, d, n] of faces) { tri(o, a, b, c, n); tri(o, a, c, d, n); }
    return o;
  },
  cylinder(top = 1, bottom = 1, height = 1, segments = 16, caps = true) {
    const o = [];
    for (let i = 0; i < segments; i += 1) {
      const a = i / segments * Math.PI * 2, b = (i + 1) / segments * Math.PI * 2;
      const A = [Math.sin(a) * bottom, -height / 2, Math.cos(a) * bottom], B = [Math.sin(b) * bottom, -height / 2, Math.cos(b) * bottom];
      const C = [Math.sin(b) * top, height / 2, Math.cos(b) * top], D = [Math.sin(a) * top, height / 2, Math.cos(a) * top];
      const na = M.normalize([Math.sin(a), (bottom - top) / height, Math.cos(a)]);
      const nb = M.normalize([Math.sin(b), (bottom - top) / height, Math.cos(b)]);
      tri(o, A, B, C, na, nb, nb); tri(o, A, C, D, na, nb, na);
      if (caps && top > 0) tri(o, [0, height / 2, 0], D, C, [0, 1, 0]);
      if (caps && bottom > 0) tri(o, [0, -height / 2, 0], B, A, [0, -1, 0]);
    }
    return o;
  },
  sphere(radius = 1, rings = 8, segments = 12) {
    const o = [];
    const p = (i, j) => {
      const a = i / rings * Math.PI, b = j / segments * Math.PI * 2;
      return [Math.sin(a) * Math.sin(b) * radius, Math.cos(a) * radius, Math.sin(a) * Math.cos(b) * radius];
    };
    for (let i = 0; i < rings; i += 1) {
      for (let j = 0; j < segments; j += 1) {
        const a = p(i, j), b = p(i + 1, j), c = p(i + 1, j + 1), d = p(i, j + 1);
        tri(o, a, b, c, M.normalize(a), M.normalize(b), M.normalize(c));
        tri(o, a, c, d, M.normalize(a), M.normalize(c), M.normalize(d));
      }
    }
    return o;
  },
  ring(inner = 0.95, outer = 1, arc = Math.PI * 2, segments = 48) {
    const o = [];
    for (let i = 0; i < segments; i += 1) {
      const a = i / segments * arc, b = (i + 1) / segments * arc;
      const p = (r, t) => [Math.sin(t) * r, 0, Math.cos(t) * r];
      tri(o, p(inner, a), p(outer, a), p(outer, b), [0, 1, 0]);
      tri(o, p(inner, a), p(outer, b), p(inner, b), [0, 1, 0]);
    }
    return o;
  },
  torus(radius = 1, tube = 0.04, segments = 32, sides = 6) {
    const o = [];
    const p = (i, j) => {
      const a = i / segments * Math.PI * 2, b = j / sides * Math.PI * 2;
      return [Math.sin(a) * (radius + Math.cos(b) * tube), Math.sin(b) * tube, Math.cos(a) * (radius + Math.cos(b) * tube)];
    };
    for (let i = 0; i < segments; i += 1) {
      for (let j = 0; j < sides; j += 1) {
        const a = p(i, j), b = p(i + 1, j), c = p(i + 1, j + 1), d = p(i, j + 1);
        face(o, a, c, b); face(o, a, d, c);
      }
    }
    return o;
  },
  shard() {
    const o = [], a = [0, 1, 0], b = [-0.5, 0, 0.3], c = [0.5, 0, 0.3], d = [0, 0, -0.45], e = [0, -1, 0];
    face(o, a, b, c); face(o, a, c, d); face(o, a, d, b); face(o, e, c, b); face(o, e, d, c); face(o, e, b, d);
    return o;
  },
  /* Плоский квадрат 1×1 в плоскости XZ, лицом вверх. */
  quad() {
    const o = [];
    tri(o, [-0.5, 0, -0.5], [-0.5, 0, 0.5], [0.5, 0, 0.5], [0, 1, 0]);
    tri(o, [-0.5, 0, -0.5], [0.5, 0, 0.5], [0.5, 0, -0.5], [0, 1, 0]);
    return o;
  },
};

/* ---------------------------------------------------------
   ПЕЧЬ: собирает вершины полного формата в один массив.
   --------------------------------------------------------- */

export class Builder {
  constructor() { this.data = []; }

  /*
   * geo — массив фигуры (по 6 чисел), m — матрица. opts:
   *   color, emissive, surf, alpha, cut (0/1), anchor [x,z],
   *   shade(p, n) → множитель цвета в вершине (для затенения у пола).
   */
  add(geo, m, opts = {}) {
    const color = opts.color || [1, 1, 1];
    const emissive = opts.emissive || 0, surf = opts.surf || 0, cut = opts.cut || 0;
    const alpha = opts.alpha ?? 1, anchor = opts.anchor || [0, 0], shade = opts.shade;
    const d = this.data;
    for (let i = 0; i < geo.length; i += 6) {
      const p = M.transform(m, [geo[i], geo[i + 1], geo[i + 2]]);
      const n = M.normalize(M.transform(m, [geo[i + 3], geo[i + 4], geo[i + 5], 0]).slice(0, 3));
      const k = shade ? shade(p, n) : 1;
      d.push(p[0], p[1], p[2], n[0], n[1], n[2], color[0] * k, color[1] * k, color[2] * k, emissive, surf, cut, alpha, anchor[0], anchor[1]);
    }
    return this;
  }

  /* Пол: четыре угла со своими цветами — так ложится затенение у стен. */
  floorQuad(x, z, y, corners, opts = {}) {
    const surf = opts.surf || 0, emissive = opts.emissive || 0, alpha = opts.alpha ?? 1;
    const P = [[x, y, z], [x, y, z + 1], [x + 1, y, z + 1], [x + 1, y, z]];
    const order = [0, 1, 2, 0, 2, 3];
    for (const i of order) {
      const c = corners[i];
      this.data.push(P[i][0], P[i][1], P[i][2], 0, 1, 0, c[0], c[1], c[2], emissive, surf, 0, alpha, x + 0.5, z + 0.5);
    }
    return this;
  }

  /*
   * Произвольный четырёхугольник: четыре точки по кругу, у каждой свой
   * цвет и своя прозрачность. Нужен откосам рва и стенкам пропасти —
   * их цвет темнеет книзу, и это градиент по вершинам, а не фактура.
   */
  quad4(points, normal, colors, opts = {}) {
    const surf = opts.surf || 0, emissive = opts.emissive || 0, cut = opts.cut || 0;
    const alphas = opts.alphas || [1, 1, 1, 1], anchor = opts.anchor || [0, 0];
    for (const i of [0, 1, 2, 0, 2, 3]) {
      const p = points[i], c = colors[i];
      this.data.push(p[0], p[1], p[2], normal[0], normal[1], normal[2], c[0], c[1], c[2], emissive, surf, cut, alphas[i], anchor[0], anchor[1]);
    }
    return this;
  }

  get count() { return this.data.length / STRIDE; }
}

/* ---------------------------------------------------------
   ШЕЙДЕРЫ
   --------------------------------------------------------- */

const VS = `
attribute vec3 a_position; attribute vec3 a_normal; attribute vec3 a_color; attribute vec4 a_extra; attribute vec2 a_anchor;
uniform mat4 u_model; uniform mat4 u_viewProjection;
uniform vec3 u_cutCenter; uniform vec2 u_cutDir; uniform vec4 u_cut; uniform vec2 u_cut2;
varying vec3 v_world; varying vec3 v_normal; varying vec3 v_color; varying vec4 v_extra; varying float v_cut; varying float v_fade;
void main(){
  vec4 w = u_model * vec4(a_position, 1.);
  float k = 0., fade = 0.;
  if (a_extra.z > .5 && u_cut.w > .5) {
    /*
     * Срез — та же формула, что cutAmount в camera.js (там же разбор);
     * менять обе разом, test-kamera.mjs сверяет их на сетке точек.
     *   lateral — клетка в полосе ±radius по ширине экрана вокруг героя;
     *   front   — впереди героя вдоль взгляда или его собственная клетка;
     *   need    — луч от ступней к камере над ней не проходит.
     */
    vec2 rel = a_anchor - u_cutCenter.xz;
    float along = dot(rel, u_cutDir);
    float side = abs(rel.x * u_cutDir.y - rel.y * u_cutDir.x);
    float dist = length(rel);
    float lateral = 1. - smoothstep(u_cut.y, u_cut.y + u_cut2.x, side);
    float front = max(smoothstep(-.15, .3, along), 1. - smoothstep(.6, .9, dist));
    float allowed = (along - u_cut2.y) * u_cut.x + .12;
    float need = 1. - smoothstep(${WALL_H.toFixed(2)} - .25, ${WALL_H.toFixed(2)} + .35, allowed);
    float amount = lateral * front * need;
    if (a_extra.z > 2.5) {
      /* Срез 3 — высокий предмет (кристалл, щиток, стог): не плющится,
         а редеет решёткой точек — сквозь него видно героя, а сам он
         остаётся узнаваемым. Полоса у предметов уже, чем у стен: стена
         режется пузырём вокруг героя, предмет — только если стоит прямо
         перед ним (кадр с сажей: нанос сбоку редел без причины). */
      fade = amount * (1. - smoothstep(.75, 1.15, side));
    } else if (a_extra.z > 1.5) {
      /* Срез 2 — украшение на стене (фонарь): исчезает целиком, все
         вершины разом, иначе от него остаются растянутые треугольники. */
      if (amount > .02) w.y = -4.;
    } else if (amount > 0.) {
      k = amount;
      w.y = min(w.y, mix(${WALL_H.toFixed(2)} + .02, u_cut.z, amount));
    }
  }
  v_cut = k; v_fade = fade;
  v_world = w.xyz;
  v_normal = normalize(mat3(u_model) * a_normal);
  v_color = a_color; v_extra = a_extra;
  gl_Position = u_viewProjection * w;
}`;

const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec3 v_world; varying vec3 v_normal; varying vec3 v_color; varying vec4 v_extra; varying float v_cut; varying float v_fade;
uniform vec3 u_tint; uniform float u_emissive; uniform float u_alpha; uniform float u_unlit; uniform float u_surf;
uniform vec3 u_eye; uniform vec3 u_viewDir; uniform float u_ortho; uniform vec3 u_focus;
uniform vec3 u_fog; uniform vec2 u_fogRange;
uniform vec3 u_sky; uniform vec3 u_ground; uniform vec3 u_moonDir; uniform vec3 u_moonColor;
uniform vec4 u_lightPos[${MAX_LIGHTS}]; uniform vec4 u_lightCol[${MAX_LIGHTS}];
uniform float u_time; uniform float u_grass;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y); }
float fbm(vec2 p){ return noise(p) * .55 + noise(p * 2.1 + 3.7) * .3 + noise(p * 4.3 + 9.1) * .15; }
void main(){
  /* Высокий предмет между камерой и героем редеет решёткой: каждая
     точка решает сама по шуму экрана, без сортировки прозрачного. */
  if (v_fade > .01) {
    float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(.06711056, .00583715))));
    if (ign < v_fade * .55) discard;
  }
  float surf = u_surf >= 0. ? u_surf : v_extra.y;
  vec3 base = v_color * u_tint;
  float alpha = v_extra.w * u_alpha;
  vec3 n = normalize(v_normal);
  float spec = 0.;
  float emissive = v_extra.x + u_emissive;
  float flatLit = 0.;
  vec2 xz = v_world.xz;

  if (surf > 8.5 && surf < 9.5) { gl_FragColor = vec4(base, alpha); return; }

  if (surf > .5 && surf < 1.5) {           /* двор */
    float g = fbm(xz * .55);
    float tuft = smoothstep(.48, .62, g);
    vec3 dirt = base * (.8 + .4 * noise(xz * 7.));
    vec3 grass = vec3(.10, .16, .085) * u_grass * (.75 + .5 * noise(xz * 11. + 2.));
    base = mix(dirt, grass, tuft * .85);
    base *= .94 + .1 * noise(xz * 23.);
  } else if (surf > 1.5 && surf < 2.5) {    /* плиты */
    vec2 e = abs(fract(xz) - .5);
    float seam = smoothstep(.465, .49, max(e.x, e.y));
    base *= .86 + .22 * hash(floor(xz)) + .08 * noise(xz * 6.);
    base = mix(base, base * .45, seam);
    spec = .25;
  } else if (surf > 2.5 && surf < 3.5) {    /* кладка */
    float u = abs(n.x) > .5 ? v_world.z : v_world.x;
    float row = floor(v_world.y / .3);
    float bu = u / .55 + mod(row, 2.) * .5;
    float mortar = max(1. - smoothstep(.0, .07, fract(v_world.y / .3)), 1. - smoothstep(.0, .06, fract(bu)));
    base *= .82 + .3 * hash(vec2(floor(bu), row)) + .06 * noise(vec2(u, v_world.y) * 8.);
    base = mix(base, base * .4, mortar * .85);
  } else if (surf > 3.5 && surf < 4.5) {    /* верх стены */
    base *= .85 + .2 * noise(xz * 5.);
    base = mix(base, vec3(.32, .30, .36), v_cut * .55);
  } else if (surf > 4.5 && surf < 5.5) {    /* дерево */
    float u = abs(n.y) > .5 ? xz.x + xz.y * .2 : (abs(n.x) > .5 ? v_world.z : v_world.x);
    float plank = fract(u * 4.);
    base *= .8 + .28 * noise(vec2(u * 3., v_world.y * 30. + xz.y * 30.)) ;
    base *= .75 + .25 * smoothstep(.0, .08, plank) * smoothstep(1., .92, plank);
  } else if (surf > 5.5 && surf < 6.5) {    /* ковёр */
    vec2 f = fract(xz) - .5;
    float d = abs(f.x) + abs(f.y);
    float band = step(.36, max(abs(f.x), abs(f.y))) * step(max(abs(f.x), abs(f.y)), .44);
    base *= .85 + .3 * step(.5, fract(d * 4.)) * (1. - band);
    base = mix(base, vec3(.85, .62, .25) * .6, band * .8);
  } else if (surf > 6.5 && surf < 7.5) {    /* металл */
    base *= .85 + .15 * noise(vec2(v_world.y * 40., xz.x + xz.y));
    spec = 1.;
  } else if (surf > 7.5 && surf < 8.5) {    /* солома */
    base *= .7 + .45 * noise(vec2((xz.x + xz.y) * 22., v_world.y * 5.));
  } else if (surf > 9.5 && surf < 10.5) {   /* лужа */
    /* Мелкая рябь наклоняет нормаль — блики бегут; край неба по
       Френелю — лужа отражает ночь, а не лежит синей плиткой. */
    vec2 p1 = xz * 4.2 + vec2(u_time * .5, u_time * .2);
    float h0 = noise(p1), hx = noise(p1 + vec2(.06, 0.)), hz = noise(p1 + vec2(0., .06));
    n = normalize(vec3((h0 - hx) * 3., 1., (h0 - hz) * 3.));
    base *= .75 + .4 * h0;
    vec3 Vw = u_ortho > .5 ? u_viewDir : normalize(u_eye - v_world);
    base += vec3(.10, .16, .24) * pow(1. - max(dot(n, Vw), 0.), 3.) * 1.6;
    spec = 2.4;
  } else if (surf > 10.5 && surf < 11.5) {  /* пожар на полу */
    /* Не заливка, а угли: тёмное с яркими прожилками и мягким краем,
       иначе пожар читается жёлтой плиткой. Пламя — узлами сверху. */
    float f = fbm(xz * 2.4 + vec2(0., -u_time * 1.2));
    float edge = 1. - smoothstep(.3, .72, length(fract(xz) - .5));
    base = mix(vec3(.18, .03, .0), base, f);
    emissive += .25 + 1.1 * f * f;
    alpha *= edge * (.35 + .65 * f);
  } else if (surf > 11.5 && surf < 12.5) {  /* лёд */
    /*
     * Трещины — прямые, по две на клетку: лёд узнаётся по ломаным
     * линиям, а не по цвету. Первая версия (разность двух шумов) давала
     * волнистые линии, и лёд на кадре читался бассейном с рябью.
     */
    vec2 cell = floor(xz), f = fract(xz) - .5;
    float cr = 1.;
    for (int i = 0; i < 2; i++) {
      float a = hash(cell + float(i) * 7.1) * 3.1416;
      vec2 o = (vec2(hash(cell + 3.3 + float(i)), hash(cell + 9.7 + float(i))) - .5) * .6;
      cr = min(cr, abs(dot(f - o, vec2(-sin(a), cos(a)))));
    }
    float crack = 1. - smoothstep(.0, .022, cr);
    base *= .88 + .2 * noise(xz * 9.);
    base = mix(base, vec3(.9, .97, 1.), crack * .6);
    spec = 1.2;
  } else if (surf > 12.5 && surf < 13.5) {  /* грязь */
    float lump = noise(xz * 6.);
    base *= .7 + .45 * lump;
    /* Мокрый блеск на буграх: грязь, а не земля. */
    spec = .35 * smoothstep(.6, .9, lump);
  } else if (surf > 14.5 && surf < 15.5) {  /* ров */
    /*
     * Живая вода: два слоя ряби бегут навстречу, нормаль наклоняется по
     * ним — блики от луны и огней бегут по поверхности. Ров — большое
     * поле, неподвижная заливка читалась бы полом другого цвета.
     */
    vec2 p1 = xz * 1.7 + vec2(u_time * .35, u_time * .12);
    vec2 p2 = xz * 2.9 - vec2(u_time * .21, -u_time * .27);
    float h0 = noise(p1) * .6 + noise(p2) * .4;
    float hx = noise(p1 + vec2(.08, 0.)) * .6 + noise(p2 + vec2(.08, 0.)) * .4;
    float hz = noise(p1 + vec2(0., .08)) * .6 + noise(p2 + vec2(0., .08)) * .4;
    n = normalize(vec3((h0 - hx) * 6., 1., (h0 - hz) * 6.));
    base *= .75 + .5 * h0;
    float crest = smoothstep(.62, .8, h0);
    emissive += crest * .18;
    spec = 2.6;
  } else if (surf > 15.5 && surf < 16.5) {  /* пропасть */
    /* Глубже — темнее, и свет туда не доходит: дна у пропасти нет.
       Первый кадр показал дальнюю стенку светлой полосой — без света
       и с множителем она читалась бежевой стеной, а не глубиной. */
    float depth = clamp(-v_world.y / 1.3, 0., 1.);
    float fall = (1. - depth) * (1. - depth);
    base *= fall * (.75 + .3 * noise(vec2(xz.x + xz.y, v_world.y) * 4.));
    gl_FragColor = vec4(pow(max(base * mix(vec3(1.), vec3(.6, .45, .9), depth), vec3(0.)), vec3(.92)), alpha);
    return;
  } else if (surf > 16.5 && surf < 17.5) {  /* масса стен */
    /* «Крыша» массы: тёмная и почти плоская — здесь ничего нет, и глаз
       не должен на ней задерживаться. Чуть светлее фона, чтобы край
       карты не сливался с массой. */
    base *= .85 + .2 * fbm(xz * .8);
    flatLit = 1.;
  } else if (surf > 17.5 && surf < 18.5) {  /* застывший камень */
    vec2 q = xz * 1.8;
    float seam = 1. - smoothstep(.0, .05, abs(noise(q) - noise(q + 3.1)));
    base *= .8 + .35 * noise(xz * 7.);
    base = mix(base, base * .35, seam);
    /* Остывающие прожилки: камень родился из лавы, и это видно. */
    emissive += seam * (.25 + .15 * sin(u_time * 1.3 + xz.x * 2.));
    base = mix(base, vec3(1., .42, .16), seam * .5);
  } else if (surf > 18.5 && surf < 19.5) {  /* сажа */
    base *= .65 + .5 * noise(vec2((xz.x - xz.y) * 9., v_world.y * 7.));
  }

  vec3 V = u_ortho > .5 ? u_viewDir : normalize(u_eye - v_world);
  vec3 light = mix(u_ground, u_sky, n.y * .5 + .5);
  float moon = max(dot(n, u_moonDir), 0.);
  light += u_moonColor * moon;
  vec3 hl = vec3(0.);
  for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    vec4 lp = u_lightPos[i];
    if (lp.w <= 0.) continue;
    vec3 L = lp.xyz - v_world;
    float d = length(L);
    vec3 l = L / max(d, .001);
    float att = clamp(1. - d / lp.w, 0., 1.);
    att *= att;
    float nd = max(dot(n, l), 0.) * .8 + .2;
    light += u_lightCol[i].rgb * att * nd;
    if (spec > 0.) hl += u_lightCol[i].rgb * att * pow(max(dot(reflect(-l, n), V), 0.), 18.) * spec;
  }
  if (spec > 0.) hl += u_moonColor * pow(max(dot(reflect(-u_moonDir, n), V), 0.), 24.) * spec * .5;
  vec3 col = base * light + hl * .6;
  if (surf > 13.5 && surf < 14.5) col += base * pow(1. - max(dot(n, V), 0.), 2.5) * vec3(.35, .45, .7) * .9;
  col = mix(col, base, max(u_unlit, flatLit)) + base * emissive;
  float fd = length(xz - u_focus.xz);
  float fog = smoothstep(u_fogRange.x, u_fogRange.y, fd);
  col = mix(col, u_fog, fog * (1. - u_unlit * .4));
  gl_FragColor = vec4(pow(max(col, vec3(0.)), vec3(.92)), alpha);
}`;

const QUADVS = 'attribute vec2 a_position;varying vec2 v_uv;void main(){v_uv=a_position*.5+.5;gl_Position=vec4(a_position,0.,1.);}';
/* Размытие свечения — как у Vanta: выжимка ярче порога и гаусс в две стороны. */
const BLURFS = `precision mediump float;varying vec2 v_uv;uniform sampler2D u_texture;uniform vec2 u_step;uniform float u_extract;
vec3 sampleBright(vec2 uv){vec3 c=texture2D(u_texture,uv).rgb;return mix(c,max(c-.62,0.)*1.4,u_extract);}
void main(){vec3 c=sampleBright(v_uv)*.227027;c+=sampleBright(v_uv+u_step*1.384615)*.316216;c+=sampleBright(v_uv-u_step*1.384615)*.316216;c+=sampleBright(v_uv+u_step*3.230769)*.070270;c+=sampleBright(v_uv-u_step*3.230769)*.070270;gl_FragColor=vec4(c,1.);}`;
/* Сведение: сглаживание по контрасту и виньетка — от Vanta; тон — свой,
   ночной: тени уходят в синеву, свет тёплый. */
const POSTFS = `precision mediump float;varying vec2 v_uv;uniform sampler2D u_texture;uniform sampler2D u_bloom;uniform float u_time;uniform float u_bloomPower;uniform vec2 u_pixel;uniform float u_vignette;
void main(){vec2 uv=v_uv;vec3 col=texture2D(u_texture,uv).rgb;
vec3 ns=texture2D(u_texture,uv+vec2(0.,u_pixel.y)).rgb+texture2D(u_texture,uv-vec2(0.,u_pixel.y)).rgb;
vec3 ew=texture2D(u_texture,uv+vec2(u_pixel.x,0.)).rgb+texture2D(u_texture,uv-vec2(u_pixel.x,0.)).rgb;
float contrast=length(ns+ew-col*4.);col=mix(col,(col*4.+ns+ew)/8.,smoothstep(.07,.30,contrast)*.5);
col+=texture2D(u_bloom,uv).rgb*u_bloomPower;
float l=dot(col,vec3(.299,.587,.114));col=mix(col*vec3(.92,.97,1.08),col*vec3(1.05,1.,.93),smoothstep(.15,.7,l));
float vig=smoothstep(.9,.25,length((uv-.5)*vec2(1.05,1.)));col*=1.-u_vignette*(1.-vig);
float grain=fract(sin(dot(uv+u_time*.01,vec2(12.9898,78.233)))*43758.5453);col+=(grain-.5)*.01;gl_FragColor=vec4(col,1.);}`;
/* Потолок размера точки поднят с 64 до 320: облако пара на крупном плане
   больше 64 точек, и упиралось в потолок квадратной кляксой. */
const POINTVS = 'attribute vec3 a_position;attribute vec4 a_color;attribute float a_size;uniform mat4 u_viewProjection;uniform float u_scale;uniform float u_ortho;varying vec4 v_color;void main(){gl_Position=u_viewProjection*vec4(a_position,1.);gl_PointSize=clamp(a_size*u_scale/max(.1,mix(gl_Position.w,1.,u_ortho)),1.,320.);v_color=a_color;}';
const POINTFS = 'precision mediump float;varying vec4 v_color;void main(){vec2 p=gl_PointCoord-.5;float d=length(p);float a=pow(max(0.,1.-d*2.),1.8);if(a<.02)discard;gl_FragColor=vec4(v_color.rgb,v_color.a*a);}';

/* ---------------------------------------------------------
   ОТРИСОВКА
   --------------------------------------------------------- */

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = this.gl = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false })
      || canvas.getContext('experimental-webgl');
    if (!gl) throw new Error('WebGL недоступен. Включи аппаратное ускорение в браузере и открой страницу снова.');
    this.program = this.makeProgram(VS, FS);
    this.blurProgram = this.makeProgram(QUADVS, BLURFS);
    this.postProgram = this.makeProgram(QUADVS, POSTFS);
    this.pointProgram = this.makeProgram(POINTVS, POINTFS);
    this.geometries = new Map();
    this.scene = new Node();
    this.statics = [];       /* запечённые буферы: { key, transparent, additive } */
    this.fog = [0.02, 0.025, 0.045];
    /* Ночь, но не чернота: небо холодное и светлее земли, луна сбоку —
       она и даёт стенам объём, когда рядом нет ни одного огня. */
    this.sky = [0.25, 0.28, 0.42];
    this.ground = [0.1, 0.09, 0.12];
    this.moonDir = M.normalize([-0.5, 0.75, 0.3]);
    this.moonColor = [0.46, 0.52, 0.72];
    /* Яркость травы двора (множитель): у пилота 1; игра на ночном этаже
       поднимает её вместе с полом (igra.js, nightFor) — иначе пятна травы
       оставались чёрными на посветлевшей земле. */
    this.grass = 1;
    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    this.pointBuffer = gl.createBuffer();
    this.targets = [];
    this.width = 0; this.height = 0;
    this.stats = { calls: 0, triangles: 0, lights: 0 };
    this.lightPos = new Float32Array(MAX_LIGHTS * 4);
    this.lightCol = new Float32Array(MAX_LIGHTS * 4);
    this.cut = { center: [0, 0, 0], dir: [0, 1], depth: 2, radius: 2.2, soft: 0.75, extent: 0.5, low: 0.28, on: false };

    for (const [name, geo] of Object.entries({
      cube: Geo.cube(), cylinder: Geo.cylinder(1, 1, 1, 12), cone: Geo.cylinder(0, 1, 1, 12), taper: Geo.cylinder(0.62, 1, 1, 10),
      sphere: Geo.sphere(1, 8, 12), ring: Geo.ring(0.82, 1), disc: Geo.ring(0, 1, Math.PI * 2, 24), torus: Geo.torus(1, 0.08, 24, 6),
      shard: Geo.shard(), quad: Geo.quad(),
    })) {
      this.register(name, new Builder().add(geo, M.identity()).data);
    }
    this.register('blob', blobGeometry());
  }

  makeProgram(vs, fs) {
    const gl = this.gl;
    const compile = (type, source) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, source);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('Шейдер: ' + gl.getShaderInfoLog(s));
      return s;
    };
    const v = compile(gl.VERTEX_SHADER, vs), f = compile(gl.FRAGMENT_SHADER, fs), p = gl.createProgram();
    gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Программа: ' + gl.getProgramInfoLog(p));
    gl.deleteShader(v); gl.deleteShader(f);
    return { p, u: {}, a: {} };
  }
  loc(p, name) { if (!(name in p.u)) p.u[name] = this.gl.getUniformLocation(p.p, name); return p.u[name]; }
  attr(p, name) { if (!(name in p.a)) p.a[name] = this.gl.getAttribLocation(p.p, name); return p.a[name]; }

  register(name, data) {
    const gl = this.gl;
    const old = this.geometries.get(name);
    const b = old ? old.buffer : gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, data instanceof Float32Array ? data : new Float32Array(data), gl.STATIC_DRAW);
    this.geometries.set(name, { buffer: b, count: data.length / STRIDE });
  }

  /* Запечённый слой: один буфер, один вызов. */
  setStatic(key, data, options = {}) {
    this.register(key, data);
    const existing = this.statics.find((s) => s.key === key);
    const entry = { key, transparent: Boolean(options.transparent || options.shadow), additive: Boolean(options.additive), shadow: Boolean(options.shadow) };
    if (existing) Object.assign(existing, entry); else this.statics.push(entry);
  }

  target(w, h, depth) {
    const gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    let r = null;
    if (depth) {
      r = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, r);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_STENCIL, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, r);
    }
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Не удалось создать буфер изображения WebGL.');
    return { texture: t, fbo: f, depth: r, w, h };
  }

  /* Размер задаётся явно: в скрытой вкладке спросить его не у кого. */
  resize(cssW, cssH, dpr = 1) {
    const gl = this.gl;
    const scale = Math.min(2, dpr);
    let width = Math.round(cssW * scale), height = Math.round(cssH * scale);
    const cap = 2400;
    if (Math.max(width, height) > cap) { const k = cap / Math.max(width, height); width = Math.round(width * k); height = Math.round(height * k); }
    if (width === this.width && height === this.height) return;
    this.width = width; this.height = height;
    this.canvas.width = width; this.canvas.height = height;
    for (const t of this.targets) { gl.deleteTexture(t.texture); gl.deleteFramebuffer(t.fbo); if (t.depth) gl.deleteRenderbuffer(t.depth); }
    const bw = Math.max(64, Math.floor(width / 4)), bh = Math.max(64, Math.floor(height / 4));
    this.targets = [this.target(width, height, true), this.target(bw, bh, false), this.target(bw, bh, false)];
  }

  project(p) {
    const v = M.transform(this.viewProjection, p);
    return { x: (v[0] / v[3] * 0.5 + 0.5), y: (-0.5 * v[1] / v[3] + 0.5), depth: v[3] };
  }

  /* Ближайшие к точке взгляда — с поправкой на радиус: крупный дальний
     пожар важнее мелкой ближней свечи у края кадра. */
  pickLights(lights, focus) {
    const scored = lights.map((l) => ({ l, s: Math.hypot(l.pos[0] - focus[0], l.pos[2] - focus[2]) - l.range * 0.6 }));
    scored.sort((a, b) => a.s - b.s);
    this.lightPos.fill(0); this.lightCol.fill(0);
    const n = Math.min(MAX_LIGHTS, scored.length);
    for (let i = 0; i < n; i += 1) {
      const { l } = scored[i];
      this.lightPos.set([l.pos[0], l.pos[1], l.pos[2], l.range], i * 4);
      this.lightCol.set([l.color[0] * l.power, l.color[1] * l.power, l.color[2] * l.power, 0], i * 4);
    }
    return n;
  }

  /*
   * camera: { view, proj, eye, focus, ortho, viewDir }
   * params: { time, lights, fogRange }
   */
  render(camera, params, particles, soft = null) {
    const gl = this.gl;
    this.eye = camera.eye;
    this.viewProjection = M.multiply(camera.proj, camera.view);
    const opaque = [], transparent = [];
    const walk = (node, parent) => {
      if (!node.visible) return;
      node.world = M.multiply(parent, node.localMatrix || M.compose(node.position, node.rotation, node.scale));
      if (node.geometry) {
        if (node.material.alpha < 0.999 || node.material.additive || node.material.shadow) transparent.push(node);
        else opaque.push(node);
      }
      for (const c of node.children) walk(c, node.world);
    };
    walk(this.scene, M.identity());
    this.stats.calls = 0; this.stats.triangles = 0;
    this.stats.lights = this.pickLights(params.lights || [], camera.focus);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.targets[0].fbo);
    gl.viewport(0, 0, this.width, this.height);
    gl.clearColor(...this.fog, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND); gl.depthMask(true);

    const p = this.program;
    gl.useProgram(p.p);
    gl.uniformMatrix4fv(this.loc(p, 'u_viewProjection'), false, this.viewProjection);
    gl.uniform3fv(this.loc(p, 'u_eye'), camera.eye);
    gl.uniform3fv(this.loc(p, 'u_viewDir'), camera.viewDir);
    gl.uniform1f(this.loc(p, 'u_ortho'), camera.ortho ? 1 : 0);
    gl.uniform3fv(this.loc(p, 'u_focus'), camera.focus);
    gl.uniform3fv(this.loc(p, 'u_fog'), this.fog);
    gl.uniform2fv(this.loc(p, 'u_fogRange'), params.fogRange || [9, 20]);
    gl.uniform3fv(this.loc(p, 'u_sky'), this.sky);
    gl.uniform3fv(this.loc(p, 'u_ground'), this.ground);
    gl.uniform3fv(this.loc(p, 'u_moonDir'), this.moonDir);
    gl.uniform3fv(this.loc(p, 'u_moonColor'), this.moonColor);
    gl.uniform4fv(this.loc(p, 'u_lightPos[0]'), this.lightPos);
    gl.uniform4fv(this.loc(p, 'u_lightCol[0]'), this.lightCol);
    gl.uniform1f(this.loc(p, 'u_time'), params.time || 0);
    gl.uniform1f(this.loc(p, 'u_grass'), this.grass);
    const c = this.cut;
    gl.uniform3fv(this.loc(p, 'u_cutCenter'), c.center);
    gl.uniform2fv(this.loc(p, 'u_cutDir'), c.dir);
    gl.uniform4f(this.loc(p, 'u_cut'), c.depth, c.radius, c.low, c.on ? 1 : 0);
    gl.uniform2f(this.loc(p, 'u_cut2'), c.soft ?? 0.75, c.extent ?? 0.5);

    const identity = M.identity();
    for (const s of this.statics) if (!s.transparent) this.drawBuffer(s.key, identity, NEUTRAL);
    for (const n of opaque) this.drawNode(n);

    /* Тени — до прозрачного, с отступом по глубине: иначе пятно мерцает
       на полу (та самая z-борьба). */
    gl.enable(gl.BLEND); gl.depthMask(false);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-2, -2);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    for (const s of this.statics) if (s.shadow) this.drawBuffer(s.key, identity, NEUTRAL);
    for (const n of transparent) if (n.material.shadow) this.drawNode(n);
    for (const s of this.statics) {
      if (!s.transparent || s.shadow) continue;
      gl.blendFunc(gl.SRC_ALPHA, s.additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
      this.drawBuffer(s.key, identity, NEUTRAL);
    }
    gl.disable(gl.POLYGON_OFFSET_FILL);
    const eye = camera.ortho ? camera.focus.map((v, i) => v + camera.viewDir[i] * 60) : camera.eye;
    const rest = transparent.filter((n) => !n.material.shadow);
    rest.sort((a, b) => Math.hypot(b.world[12] - eye[0], b.world[13] - eye[1], b.world[14] - eye[2])
      - Math.hypot(a.world[12] - eye[0], a.world[13] - eye[1], a.world[14] - eye[2]));
    for (const n of rest) {
      gl.blendFunc(gl.SRC_ALPHA, n.material.additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
      this.drawNode(n);
    }
    for (const a of ['a_position', 'a_normal', 'a_color', 'a_extra', 'a_anchor']) gl.disableVertexAttribArray(this.attr(p, a));
    /* Мягкие клубы (пар, пыль) — обычным смешиванием: облако прячет то,
       что за ним. Искры — сложением поверх: они светятся. */
    if (soft && soft.length) this.drawParticles(soft, camera, false);
    if (particles && particles.length) this.drawParticles(particles, camera);

    gl.depthMask(true); gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
    const bp = this.blurProgram;
    gl.useProgram(bp.p); this.bindQuad(bp);
    for (let pass = 0; pass < 2; pass += 1) {
      const t = this.targets[pass + 1], source = this.targets[pass];
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
      gl.viewport(0, 0, t.w, t.h);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, source.texture);
      gl.uniform1i(this.loc(bp, 'u_texture'), 0);
      gl.uniform2f(this.loc(bp, 'u_step'), pass === 0 ? 2.4 / t.w : 0, pass === 1 ? 2.4 / t.h : 0);
      gl.uniform1f(this.loc(bp, 'u_extract'), pass === 0 ? 1 : 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    gl.disableVertexAttribArray(this.attr(bp, 'a_position'));
    const pp = this.postProgram;
    gl.useProgram(pp.p); this.bindQuad(pp);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.width, this.height);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.targets[0].texture);
    gl.uniform1i(this.loc(pp, 'u_texture'), 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.targets[2].texture);
    gl.uniform1i(this.loc(pp, 'u_bloom'), 1);
    gl.uniform1f(this.loc(pp, 'u_time'), params.time || 0);
    gl.uniform1f(this.loc(pp, 'u_bloomPower'), params.bloom ?? 0.8);
    /* Виньетка — доля затемнения края (у пилота 0.2, как было). */
    gl.uniform1f(this.loc(pp, 'u_vignette'), params.vignette ?? 0.2);
    gl.uniform2f(this.loc(pp, 'u_pixel'), 1 / this.width, 1 / this.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disableVertexAttribArray(this.attr(pp, 'a_position'));
  }

  bindQuad(p) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    const a = this.attr(p, 'a_position');
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
  }

  drawNode(n) { this.drawBuffer(n.geometry, n.world, n.material); }

  drawBuffer(key, model, material) {
    const gl = this.gl, p = this.program, g = this.geometries.get(key);
    if (!g || !g.count) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, g.buffer);
    const bytes = STRIDE * 4;
    const attribute = (name, size, offset) => {
      const a = this.attr(p, name);
      if (a < 0) return;
      gl.enableVertexAttribArray(a);
      gl.vertexAttribPointer(a, size, gl.FLOAT, false, bytes, offset * 4);
    };
    attribute('a_position', 3, 0); attribute('a_normal', 3, 3); attribute('a_color', 3, 6);
    attribute('a_extra', 4, 9); attribute('a_anchor', 2, 13);
    gl.uniformMatrix4fv(this.loc(p, 'u_model'), false, model);
    gl.uniform3fv(this.loc(p, 'u_tint'), material.color);
    gl.uniform1f(this.loc(p, 'u_emissive'), material.emissive || 0);
    gl.uniform1f(this.loc(p, 'u_alpha'), material.alpha ?? 1);
    gl.uniform1f(this.loc(p, 'u_unlit'), material.unlit || 0);
    /* Номер поверхности у узла — из материала, у печи — из вершины. */
    gl.uniform1f(this.loc(p, 'u_surf'), material.surf ?? -1);
    gl.drawArrays(gl.TRIANGLES, 0, g.count);
    this.stats.calls += 1; this.stats.triangles += g.count / 3;
  }

  drawParticles(data, camera, additive = true) {
    const gl = this.gl, p = this.pointProgram;
    gl.useProgram(p.p);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.pointBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    const attrs = [['a_position', 3, 0], ['a_color', 4, 12], ['a_size', 1, 28]];
    for (const [name, size, offset] of attrs) {
      const a = this.attr(p, name);
      gl.enableVertexAttribArray(a);
      gl.vertexAttribPointer(a, size, gl.FLOAT, false, 32, offset);
    }
    gl.uniformMatrix4fv(this.loc(p, 'u_viewProjection'), false, this.viewProjection);
    /* Размер точки в пикселях: у перспективы делится на глубину, у
       ортографии — на масштаб кадра (camera.pointScale). */
    /* proj[5] — масштаб по вертикали у обеих проекций: у ортографии это
       1/halfH, у перспективы 1/tan(fov/2). Одна формула для обеих, и
       точка не меняет размер, когда крупный план уходит в перспективу. */
    gl.uniform1f(this.loc(p, 'u_scale'), camera.proj[5] * this.height / 2);
    gl.uniform1f(this.loc(p, 'u_ortho'), camera.ortho ? 1 : 0);
    gl.blendFunc(gl.SRC_ALPHA, additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.POINTS, 0, data.length / 8);
    for (const [name] of attrs) gl.disableVertexAttribArray(this.attr(p, name));
  }
}

const NEUTRAL = { color: [1, 1, 1], emissive: 0, alpha: 1, unlit: 0 };

/* Пятно тени: тёмный центр, прозрачный край — альфа в вершине. */
function blobGeometry() {
  const out = [], seg = 20;
  const v = (x, z, a) => out.push(x, 0, z, 0, 1, 0, 0.01, 0.01, 0.02, 0, SURF.SHADOW, 0, a, 0, 0);
  for (let i = 0; i < seg; i += 1) {
    const a = i / seg * Math.PI * 2, b = (i + 1) / seg * Math.PI * 2;
    v(0, 0, 0.62);
    v(Math.sin(a) * 0.55, Math.cos(a) * 0.55, 0.42); v(Math.sin(b) * 0.55, Math.cos(b) * 0.55, 0.42);
    v(Math.sin(a) * 0.55, Math.cos(a) * 0.55, 0.42); v(Math.sin(a), Math.cos(a), 0); v(Math.sin(b), Math.cos(b), 0);
    v(Math.sin(a) * 0.55, Math.cos(a) * 0.55, 0.42); v(Math.sin(b), Math.cos(b), 0); v(Math.sin(b) * 0.55, Math.cos(b) * 0.55, 0.42);
  }
  return out;
}
