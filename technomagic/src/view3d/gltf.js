/*
 * ТЕХНОМАГИЯ — чтение glTF 2.0 / GLB для своего движка (engine.js).
 *
 * Почему свой разборщик, а не библиотека (решение 05.10): готовые
 * загрузчики либо часть three.js (GLTFLoader тянет за собой ~600 КБ
 * three.js и отдаёт его же объекты), либо отдельные пакеты на десятки
 * килобайт с собственной моделью сцены — а нашему движку нужен не граф
 * объектов, а голые массивы: вершины в его 15-числовой формат (engine.js,
 * STRIDE), кости и ключи клипов. Разбор GLB, аксессоров, узлов, кожи и
 * клипов — это ~350 строк без зависимостей; ровно то, что нужно, и
 * проверяется тестом в node (tests/gltf.mjs) без браузера.
 *
 * Что умеет:
 *   GLB (контейнер с JSON и BIN) и буферы data:-URI; аксессоры любых
 *   типов, нормированные и нет (KHR_mesh_quantization — так ужаты наши
 *   файлы, tools/modeli/sobrat.mjs); треугольники с индексами и без;
 *   POSITION, NORMAL, TEXCOORD_0 (+ KHR_texture_transform), COLOR_0,
 *   JOINTS_0, WEIGHTS_0; цвет материала и картинку базового цвета;
 *   узлы (TRS или матрица), кожу (скелет, обратные матрицы привязки),
 *   клипы (LINEAR, STEP; CUBICSPLINE — по опорным точкам без касательных).
 * Чего не умеет — и говорит это ошибкой GltfError, а не пустой моделью:
 *   внешние .bin, разреженные аксессоры, не-треугольники, морфы,
 *   EXT_meshopt_compression / Draco и любые другие обязательные расширения.
 *
 * Ничего не знает ни о WebGL, ни о сцене игры — только массивы. Сборка
 * вершин в формат движка и отрисовка — engine.js и modeli.js.
 */

export class GltfError extends Error {
  constructor(message) { super(message); this.name = 'GltfError'; }
}

const SUPPORTED = new Set(['KHR_mesh_quantization', 'KHR_materials_unlit', 'KHR_texture_transform',
  'KHR_materials_emissive_strength', 'KHR_materials_specular', 'KHR_materials_ior']);
const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
const ARRAY = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const NORM = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 };

/* ---------------------------------------------------------
   КОНТЕЙНЕР
   --------------------------------------------------------- */

export function parseGLB(data) {
  const u8 = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  if (u8.byteLength < 20) throw new GltfError(`файл короче заголовка GLB (${u8.byteLength} байт)`);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  if (dv.getUint32(0, true) !== 0x46546C67) throw new GltfError('нет подписи glTF в начале файла');
  const version = dv.getUint32(4, true);
  if (version !== 2) throw new GltfError(`версия GLB ${version}, нужна 2`);
  const length = dv.getUint32(8, true);
  if (length > u8.byteLength) throw new GltfError(`файл обрезан: заголовок обещает ${length} байт, есть ${u8.byteLength}`);
  let json = null, bin = null, at = 12;
  while (at + 8 <= length) {
    const size = dv.getUint32(at, true), type = dv.getUint32(at + 4, true);
    if (at + 8 + size > length) throw new GltfError('кусок GLB выходит за конец файла');
    const body = u8.subarray(at + 8, at + 8 + size);
    if (type === 0x4E4F534A) {
      try { json = JSON.parse(new TextDecoder().decode(body)); } catch (e) { throw new GltfError(`JSON модели не читается: ${e.message}`); }
    } else if (type === 0x004E4942 && !bin) bin = body;
    at += 8 + size;
  }
  if (!json) throw new GltfError('в GLB нет куска JSON');
  return readGltf(json, bin ? [bin] : []);
}

function base64(s) {
  if (typeof atob === 'function') {
    const raw = atob(s), out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(s, 'base64'));
}

/* ---------------------------------------------------------
   РАЗБОР
   --------------------------------------------------------- */

export function readGltf(json, binChunks = []) {
  if (!json.asset || !String(json.asset.version || '').startsWith('2')) throw new GltfError('не glTF 2.0');
  const missing = (json.extensionsRequired || []).filter((e) => !SUPPORTED.has(e));
  if (missing.length) throw new GltfError(`обязательные расширения не поддерживаются: ${missing.join(', ')}`);

  const buffers = (json.buffers || []).map((b, i) => {
    if (b.uri === undefined) {
      if (!binChunks[i]) throw new GltfError(`нет BIN-куска для буфера ${i}`);
      return binChunks[i];
    }
    const m = /^data:[^;]*;base64,(.*)$/.exec(b.uri);
    if (!m) throw new GltfError(`внешний буфер «${b.uri}» не поддерживается — собирайте .glb`);
    return base64(m[1]);
  });

  const view = (i) => {
    const v = json.bufferViews && json.bufferViews[i];
    if (!v) throw new GltfError(`нет bufferView ${i}`);
    const buf = buffers[v.buffer];
    if (!buf) throw new GltfError(`bufferView ${i} ссылается на несуществующий буфер`);
    const off = v.byteOffset || 0;
    if (off + v.byteLength > buf.byteLength) throw new GltfError(`bufferView ${i} выходит за буфер`);
    return { bytes: buf.subarray(off, off + v.byteLength), stride: v.byteStride || 0 };
  };

  /* Аксессор → плоский массив. float: true — в числа с плавающей точкой
     с учётом нормировки (KHR_mesh_quantization), иначе как лежит. */
  const cache = new Map();
  const accessor = (i, float = true) => {
    const key = `${i}:${float}`;
    if (cache.has(key)) return cache.get(key);
    const a = json.accessors && json.accessors[i];
    if (!a) throw new GltfError(`нет аксессора ${i}`);
    if (a.sparse) throw new GltfError(`разреженный аксессор ${i} не поддерживается`);
    const Type = ARRAY[a.componentType], n = SIZE[a.type];
    if (!Type || !n) throw new GltfError(`аксессор ${i}: тип ${a.componentType}/${a.type} неизвестен`);
    const count = a.count, out = float ? new Float32Array(count * n) : new Type(count * n);
    if (a.bufferView !== undefined) {
      const { bytes, stride } = view(a.bufferView);
      const elem = Type.BYTES_PER_ELEMENT, step = stride || elem * n, base = a.byteOffset || 0;
      if (base + step * (count - 1) + elem * n > bytes.byteLength) throw new GltfError(`аксессор ${i} выходит за bufferView`);
      const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const get = {
        5120: (o) => dv.getInt8(o), 5121: (o) => dv.getUint8(o), 5122: (o) => dv.getInt16(o, true),
        5123: (o) => dv.getUint16(o, true), 5125: (o) => dv.getUint32(o, true), 5126: (o) => dv.getFloat32(o, true),
      }[a.componentType];
      const norm = float && a.normalized ? NORM[a.componentType] : 0;
      for (let k = 0; k < count; k += 1) {
        for (let c = 0; c < n; c += 1) {
          const v = get(base + k * step + c * elem);
          out[k * n + c] = norm ? Math.max(v / norm, -1) : v;
        }
      }
    }
    const result = { array: out, count, size: n, min: a.min, max: a.max };
    cache.set(key, result);
    return result;
  };

  const materials = (json.materials || []).map((m) => {
    const pbr = m.pbrMetallicRoughness || {};
    const tex = pbr.baseColorTexture;
    let texture = null;
    if (tex && json.textures && json.textures[tex.index] && json.textures[tex.index].source !== undefined) {
      const tr = tex.extensions && tex.extensions.KHR_texture_transform;
      texture = { image: json.textures[tex.index].source, transform: tr || null };
    }
    return {
      name: m.name || '', color: pbr.baseColorFactor ? pbr.baseColorFactor.slice() : [1, 1, 1, 1], texture,
      unlit: Boolean(m.extensions && m.extensions.KHR_materials_unlit), doubleSided: Boolean(m.doubleSided),
      emissive: m.emissiveFactor ? Math.max(...m.emissiveFactor) : 0,
    };
  });

  const images = (json.images || []).map((img, i) => {
    if (img.bufferView !== undefined) return { name: img.name || `image${i}`, mime: img.mimeType || 'image/png', bytes: view(img.bufferView).bytes };
    const m = img.uri && /^data:([^;]*);base64,(.*)$/.exec(img.uri);
    if (m) return { name: img.name || `image${i}`, mime: m[1], bytes: base64(m[2]) };
    throw new GltfError(`картинка «${img.uri}» лежит снаружи — собирайте .glb`);
  });

  const meshes = (json.meshes || []).map((mesh, mi) => ({
    name: mesh.name || `mesh${mi}`,
    primitives: mesh.primitives.map((p, pi) => {
      if (p.mode !== undefined && p.mode !== 4) throw new GltfError(`сетка ${mi}/${pi}: режим ${p.mode}, нужны треугольники`);
      if (p.targets && p.targets.length) throw new GltfError(`сетка ${mi}/${pi}: морфы не поддерживаются`);
      const at = p.attributes || {};
      if (at.POSITION === undefined) throw new GltfError(`сетка ${mi}/${pi} без POSITION`);
      const get = (name, float = true) => (at[name] !== undefined ? accessor(at[name], float) : null);
      return {
        material: p.material ?? -1,
        position: get('POSITION'), normal: get('NORMAL'), uv: get('TEXCOORD_0'), color: get('COLOR_0'),
        joints: get('JOINTS_0', false), weights: get('WEIGHTS_0'),
        indices: p.indices !== undefined ? accessor(p.indices, false).array : null,
      };
    }),
  }));

  const nodes = (json.nodes || []).map((n, i) => ({
    index: i, name: n.name || `node${i}`, mesh: n.mesh ?? -1, skin: n.skin ?? -1, children: n.children || [],
    matrix: n.matrix ? new Float32Array(n.matrix) : null,
    t: n.translation || [0, 0, 0], r: n.rotation || [0, 0, 0, 1], s: n.scale || [1, 1, 1],
  }));
  const parent = new Int32Array(nodes.length).fill(-1);
  for (const n of nodes) for (const c of n.children) {
    if (!nodes[c]) throw new GltfError(`узел ${n.index}: нет ребёнка ${c}`);
    parent[c] = n.index;
  }

  const skins = (json.skins || []).map((s) => {
    const ibm = s.inverseBindMatrices !== undefined ? accessor(s.inverseBindMatrices).array : null;
    const inverseBind = new Float32Array(s.joints.length * 16);
    for (let j = 0; j < s.joints.length; j += 1) {
      if (ibm) inverseBind.set(ibm.subarray(j * 16, j * 16 + 16), j * 16);
      else inverseBind.set(IDENTITY, j * 16);
    }
    return { joints: s.joints.slice(), inverseBind, skeleton: s.skeleton ?? -1 };
  });

  const animations = (json.animations || []).map((a, ai) => {
    let duration = 0;
    const channels = [];
    for (const ch of a.channels) {
      const path = ch.target && ch.target.path;
      if (path === 'weights' || ch.target.node === undefined) continue;
      const s = a.samplers[ch.sampler];
      if (!s) throw new GltfError(`клип ${ai}: нет сэмплера ${ch.sampler}`);
      const times = accessor(s.input).array, values = accessor(s.output).array;
      const n = path === 'rotation' ? 4 : 3;
      const interp = s.interpolation || 'LINEAR';
      /* CUBICSPLINE: на ключ три значения (касательная, точка, касательная) —
         берём опорные точки и ведём между ними прямой. */
      let vals = values;
      if (interp === 'CUBICSPLINE') {
        vals = new Float32Array(times.length * n);
        for (let k = 0; k < times.length; k += 1) vals.set(values.subarray((k * 3 + 1) * n, (k * 3 + 2) * n), k * n);
      }
      if (vals.length < times.length * n) throw new GltfError(`клип ${ai}: значений меньше, чем ключей`);
      duration = Math.max(duration, times[times.length - 1] || 0);
      channels.push({ node: ch.target.node, path, times, values: vals, n, step: interp === 'STEP' });
    }
    return { name: a.name || `clip${ai}`, duration, channels };
  });

  const sceneIndex = json.scene ?? 0;
  const roots = json.scenes && json.scenes[sceneIndex] ? json.scenes[sceneIndex].nodes : nodes.filter((n) => parent[n.index] < 0).map((n) => n.index);
  return { materials, images, meshes, nodes, parent, skins, animations, roots };
}

/* ---------------------------------------------------------
   МАТЕМАТИКА (столбцы, как в math.js)
   --------------------------------------------------------- */

const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

export function fromTRS(t, q, s, out = new Float32Array(16)) {
  const [x, y, z, w] = q;
  const xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
  out[0] = (1 - 2 * (yy + zz)) * s[0]; out[1] = 2 * (xy + wz) * s[0]; out[2] = 2 * (xz - wy) * s[0]; out[3] = 0;
  out[4] = 2 * (xy - wz) * s[1]; out[5] = (1 - 2 * (xx + zz)) * s[1]; out[6] = 2 * (yz + wx) * s[1]; out[7] = 0;
  out[8] = 2 * (xz + wy) * s[2]; out[9] = 2 * (yz - wx) * s[2]; out[10] = (1 - 2 * (xx + yy)) * s[2]; out[11] = 0;
  out[12] = t[0]; out[13] = t[1]; out[14] = t[2]; out[15] = 1;
  return out;
}

export function mul(a, b, out = new Float32Array(16), ao = 0, bo = 0, oo = 0) {
  for (let c = 0; c < 4; c += 1) {
    const b0 = b[bo + c * 4], b1 = b[bo + c * 4 + 1], b2 = b[bo + c * 4 + 2], b3 = b[bo + c * 4 + 3];
    for (let r = 0; r < 4; r += 1) {
      out[oo + c * 4 + r] = a[ao + r] * b0 + a[ao + 4 + r] * b1 + a[ao + 8 + r] * b2 + a[ao + 12 + r] * b3;
    }
  }
  return out;
}

const point = (m, x, y, z, o = 0) => [
  m[o] * x + m[o + 4] * y + m[o + 8] * z + m[o + 12],
  m[o + 1] * x + m[o + 5] * y + m[o + 9] * z + m[o + 13],
  m[o + 2] * x + m[o + 6] * y + m[o + 10] * z + m[o + 14],
];

/* Нормаль переносится обратной транспонированной 3×3 — после quantize
   масштаб узла бывает неравным по осям, и простой поворот её искривил бы. */
function normalMatrix(m) {
  const a = m[0], b = m[1], c = m[2], d = m[4], e = m[5], f = m[6], g = m[8], h = m[9], k = m[10];
  const A = e * k - f * h, B = -(d * k - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C || 1;
  /* Строки обратной матрицы = столбцы транспонированной обратной. */
  return [A / det, B / det, C / det, (c * h - b * k) / det, (a * k - c * g) / det, (b * g - a * h) / det,
    (b * f - c * e) / det, (c * d - a * f) / det, (a * e - b * d) / det];
}

/* glTF хранит цвет линейным, движок — в гамме (как M.rgb из шестнадцатеричных). */
export const toGamma = (c) => Math.pow(Math.max(0, c), 1 / 2.2);

/* ---------------------------------------------------------
   НЕПОДВИЖНАЯ МОДЕЛЬ → треугольники по материалам
   --------------------------------------------------------- */

/*
 * Обходит сцену с мировыми матрицами узлов и раскладывает треугольники
 * (без индексов) по материалам. Цвет вершины — цвет материала × COLOR_0,
 * в гамме. Кожа здесь не применяется: для персонажей — prepareSkinned.
 * Возврат: { parts: [{ material, pos, nrm, uv|null, col }], min, max, triangles }.
 */
export function flattenStatic(doc) {
  const groups = new Map();
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  let triangles = 0;
  const visit = (ni, parentM) => {
    const n = doc.nodes[ni];
    const local = n.matrix || fromTRS(n.t, n.r, n.s);
    const world = mul(parentM, local);
    if (n.mesh >= 0) {
      const nm = normalMatrix(world);
      for (const p of doc.meshes[n.mesh].primitives) {
        const mat = doc.materials[p.material] || { color: [1, 1, 1, 1], texture: null };
        let g = groups.get(p.material);
        if (!g) { g = { material: p.material, pos: [], nrm: [], uv: mat.texture && p.uv ? [] : null, col: [] }; groups.set(p.material, g); }
        const P = p.position.array, N = p.normal && p.normal.array, U = p.uv && p.uv.array, C = p.color;
        const idx = p.indices || Array.from({ length: p.position.count }, (_, i) => i);
        const tr = mat.texture && mat.texture.transform;
        for (let k = 0; k + 2 < idx.length; k += 3) {
          triangles += 1;
          const tri = [idx[k], idx[k + 1], idx[k + 2]];
          const wp = tri.map((v) => point(world, P[v * 3], P[v * 3 + 1], P[v * 3 + 2]));
          let fn = null;
          if (!N) {
            const u = wp[1].map((x, i) => x - wp[0][i]), w = wp[2].map((x, i) => x - wp[0][i]);
            fn = unit([u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]);
          }
          tri.forEach((v, j) => {
            g.pos.push(...wp[j]);
            for (let a = 0; a < 3; a += 1) { min[a] = Math.min(min[a], wp[j][a]); max[a] = Math.max(max[a], wp[j][a]); }
            if (N) {
              const x = N[v * 3], y = N[v * 3 + 1], z = N[v * 3 + 2];
              g.nrm.push(...unit([nm[0] * x + nm[3] * y + nm[6] * z, nm[1] * x + nm[4] * y + nm[7] * z, nm[2] * x + nm[5] * y + nm[8] * z]));
            } else g.nrm.push(...fn);
            if (g.uv) {
              let u = U[v * 2], vv = U[v * 2 + 1];
              if (tr) [u, vv] = texTransform(tr, u, vv);
              g.uv.push(u, vv);
            }
            const vc = C ? [C.array[v * C.size], C.array[v * C.size + 1], C.array[v * C.size + 2]] : [1, 1, 1];
            g.col.push(toGamma(mat.color[0] * vc[0]), toGamma(mat.color[1] * vc[1]), toGamma(mat.color[2] * vc[2]));
          });
        }
      }
    }
    for (const c of n.children) visit(c, world);
  };
  for (const r of doc.roots) visit(r, IDENTITY);
  const parts = [...groups.values()].map((g) => ({
    material: g.material, pos: new Float32Array(g.pos), nrm: new Float32Array(g.nrm),
    uv: g.uv ? new Float32Array(g.uv) : null, col: new Float32Array(g.col),
  }));
  return { parts, min, max, triangles };
}

function unit(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }

function texTransform(tr, u, v) {
  const s = tr.scale || [1, 1], o = tr.offset || [0, 0], r = tr.rotation || 0;
  const x = u * s[0], y = v * s[1];
  const c = Math.cos(r), sn = Math.sin(r);
  return [c * x + sn * y + o[0], -sn * x + c * y + o[1]];
}

/* ---------------------------------------------------------
   ПЕРСОНАЖ: сетка с кожей, скелет, клипы
   --------------------------------------------------------- */

/*
 * Первая сетка с кожей сливается в один индексный буфер (один вызов на
 * персонажа): положение, нормаль, цвет материала в гамме, четыре кости и
 * четыре веса (веса пересобраны до суммы 1 — после quantize она плывёт).
 * Возврат: { pos, nrm, col, joints, weights, index, skel, clips, restMin, restMax }.
 */
export function prepareSkinned(doc) {
  const owner = doc.nodes.find((n) => n.mesh >= 0 && n.skin >= 0);
  if (!owner) throw new GltfError('в модели нет сетки с кожей');
  const skin = doc.skins[owner.skin];
  const prims = doc.meshes[owner.mesh].primitives;
  let vertices = 0, indices = 0;
  for (const p of prims) {
    if (!p.joints || !p.weights) throw new GltfError('сетка с кожей без JOINTS_0/WEIGHTS_0');
    vertices += p.position.count;
    indices += p.indices ? p.indices.length : p.position.count;
  }
  const pos = new Float32Array(vertices * 3), nrm = new Float32Array(vertices * 3), col = new Float32Array(vertices * 3);
  const joints = new Float32Array(vertices * 4), weights = new Float32Array(vertices * 4);
  const index = vertices > 65535 ? new Uint32Array(indices) : new Uint16Array(indices);
  let vo = 0, io = 0;
  /* Какие вершины какого материала — для краски по классу (modeli.js, KRASKI). */
  const parts = [];
  for (const p of prims) {
    const mat = doc.materials[p.material] || { color: [1, 1, 1, 1] };
    const n = p.position.count;
    parts.push({ material: mat.name || '', start: vo, count: n });
    pos.set(p.position.array, vo * 3);
    if (p.normal) for (let i = 0; i < n * 3; i += 3) nrm.set(unit([p.normal.array[i], p.normal.array[i + 1], p.normal.array[i + 2]]), vo * 3 + i);
    const c = [toGamma(mat.color[0]), toGamma(mat.color[1]), toGamma(mat.color[2])];
    for (let i = 0; i < n; i += 1) {
      col.set(c, (vo + i) * 3);
      let sum = 0;
      for (let k = 0; k < 4; k += 1) sum += p.weights.array[i * 4 + k];
      for (let k = 0; k < 4; k += 1) {
        joints[(vo + i) * 4 + k] = p.joints.array[i * 4 + k];
        weights[(vo + i) * 4 + k] = sum > 0 ? p.weights.array[i * 4 + k] / sum : (k === 0 ? 1 : 0);
      }
    }
    if (p.indices) for (let i = 0; i < p.indices.length; i += 1) index[io + i] = p.indices[i] + vo;
    else for (let i = 0; i < n; i += 1) index[io + i] = vo + i;
    io += p.indices ? p.indices.length : n;
    vo += n;
  }
  const maxJoint = joints.reduce((m, j) => Math.max(m, j), 0);
  if (maxJoint >= skin.joints.length) throw new GltfError(`вершина ссылается на кость ${maxJoint}, а их ${skin.joints.length}`);

  /* Порядок обхода: родитель раньше детей — глобальные матрицы за один проход. */
  const order = [];
  const visit = (i) => { order.push(i); for (const c of doc.nodes[i].children) visit(c); };
  for (const r of doc.roots) visit(r);
  const skel = {
    nodes: doc.nodes.map((n) => ({ name: n.name, t: n.t.slice(), r: n.r.slice(), s: n.s.slice(), matrix: n.matrix })),
    parent: doc.parent, order, joints: skin.joints, inverseBind: skin.inverseBind,
    byName: new Map(doc.nodes.map((n) => [n.name, n.index])),
  };
  const clips = new Map(doc.animations.map((a) => [a.name, a]));

  /* Границы в позе привязки (ступни, рост): кожа применяется один раз на CPU. */
  const pose = createPose(skel);
  finishPose(skel, pose);
  const restMin = [Infinity, Infinity, Infinity], restMax = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < vertices; i += 1) {
    const p = skinPoint(pose.joints, joints, weights, i, pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
    for (let a = 0; a < 3; a += 1) { restMin[a] = Math.min(restMin[a], p[a]); restMax[a] = Math.max(restMax[a], p[a]); }
  }
  return { pos, nrm, col, joints, weights, index, vertices, triangles: indices / 3, skel, clips, restMin, restMax, parts };
}

export function skinPoint(jm, joints, weights, i, x, y, z) {
  const out = [0, 0, 0];
  for (let k = 0; k < 4; k += 1) {
    const w = weights[i * 4 + k];
    if (!w) continue;
    const p = point(jm, x, y, z, joints[i * 4 + k] * 16);
    out[0] += p[0] * w; out[1] += p[1] * w; out[2] += p[2] * w;
  }
  return out;
}

export function createPose(skel) {
  const n = skel.nodes.length;
  const pose = { t: new Float32Array(n * 3), r: new Float32Array(n * 4), s: new Float32Array(n * 3),
    global: new Float32Array(n * 16), joints: new Float32Array(skel.joints.length * 16), local: new Float32Array(16) };
  resetPose(skel, pose);
  return pose;
}

export function resetPose(skel, pose) {
  skel.nodes.forEach((n, i) => { pose.t.set(n.t, i * 3); pose.r.set(n.r, i * 4); pose.s.set(n.s, i * 3); });
}

/* Клип в момент time (секунды, по кругу, если loop) с весом weight поверх
   того, что уже лежит в позе: вес 1 — заменить, меньше — смешать. */
export function sampleClip(clip, time, pose, weight = 1, loop = true) {
  if (!clip || weight <= 0) return;
  const d = clip.duration || 0;
  const t = d > 0 ? (loop ? ((time % d) + d) % d : Math.min(Math.max(time, 0), d)) : 0;
  const tmp = [0, 0, 0, 0];
  for (const ch of clip.channels) {
    const { times, values, n } = ch;
    let k = 0;
    if (t >= times[times.length - 1]) k = times.length - 1;
    else while (k + 1 < times.length && times[k + 1] <= t) k += 1;
    const k2 = Math.min(k + 1, times.length - 1);
    const span = times[k2] - times[k];
    const f = ch.step || span <= 0 ? 0 : (t - times[k]) / span;
    if (n === 4) {
      let dotq = 0;
      for (let c = 0; c < 4; c += 1) dotq += values[k * 4 + c] * values[k2 * 4 + c];
      const sgn = dotq < 0 ? -1 : 1;
      for (let c = 0; c < 4; c += 1) tmp[c] = values[k * 4 + c] * (1 - f) + values[k2 * 4 + c] * f * sgn;
    } else for (let c = 0; c < 3; c += 1) tmp[c] = values[k * 3 + c] * (1 - f) + values[k2 * 3 + c] * f;
    const arr = ch.path === 'translation' ? pose.t : ch.path === 'rotation' ? pose.r : pose.s;
    const o = ch.node * n;
    if (n === 4) {
      /* Смешивание поворотов — nlerp по короткой дуге. */
      let dotq = 0;
      for (let c = 0; c < 4; c += 1) dotq += arr[o + c] * tmp[c];
      const sgn = dotq < 0 ? -1 : 1;
      let len = 0;
      for (let c = 0; c < 4; c += 1) { arr[o + c] = arr[o + c] * (1 - weight) + tmp[c] * weight * sgn; len += arr[o + c] * arr[o + c]; }
      len = Math.sqrt(len) || 1;
      for (let c = 0; c < 4; c += 1) arr[o + c] /= len;
    } else for (let c = 0; c < 3; c += 1) arr[o + c] = arr[o + c] * (1 - weight) + tmp[c] * weight;
  }
}

/* Глобальные матрицы узлов и матрицы костей (глобальная × обратная привязки). */
export function finishPose(skel, pose) {
  for (const i of skel.order) {
    const node = skel.nodes[i];
    const local = node.matrix ? node.matrix
      : fromTRS(pose.t.subarray(i * 3, i * 3 + 3), pose.r.subarray(i * 4, i * 4 + 4), pose.s.subarray(i * 3, i * 3 + 3), pose.local);
    const p = skel.parent[i];
    if (p < 0) pose.global.set(local, i * 16);
    else mul(pose.global, local, pose.global, p * 16, 0, i * 16);
  }
  for (let j = 0; j < skel.joints.length; j += 1) mul(pose.global, skel.inverseBind, pose.joints, skel.joints[j] * 16, j * 16, j * 16);
  return pose;
}

/* Мировая точка узла (кисть, голова) в позе — для того, что держат в руке. */
export function nodePoint(skel, pose, name) {
  const i = skel.byName.get(name);
  if (i === undefined) return null;
  return [pose.global[i * 16 + 12], pose.global[i * 16 + 13], pose.global[i * 16 + 14]];
}
