// The first-shift atlas (Freedoom textures + our sprites), decoded once and
// shared by the shift and the professions showcase (career-previews.js).
let atlasPromise = null;
export function loadAtlas() {
  atlasPromise ??= decodeAtlas();
  atlasPromise.catch(() => { atlasPromise = null; });
  return atlasPromise;
}
async function decodeAtlas() {
  const base = new URL('../../assets/first-shift/', import.meta.url);
  const [manifest, image] = await Promise.all([
    fetch(new URL('atlas.json', base)).then((r) => r.json()),
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = new URL('atlas.png', base).href;
    }),
  ]);
  const c = document.createElement('canvas');
  c.width = image.width; c.height = image.height;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(image, 0, 0);
  const out = {};
  for (const [name, r] of Object.entries(manifest)) {
    const data = new Uint32Array(g.getImageData(r.x, r.y, r.w, r.h).data.buffer);
    out[name] = { w: r.w, h: r.h, data, ppm: r.ppm, ppmx: r.ppmx ?? r.ppm ?? 32, ppmy: r.ppmy ?? r.ppm ?? 32 };
    const swap = OUTFITS[name.split('_')[0]];
    if (swap) recolor(data, swap);
  }
  return out;
}

// 18.0: every person in the hall in their own clothes (Сергей: «каждому
// персонажу уникальное лицо и одежду»). The loader and the fitter were
// rendered in the same navy overalls and orange vest; the loader now wears
// green overalls and a white apron. Colours are exact atlas values.
const rgbKey = (r, g, b) => ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
export const OUTFITS = Object.freeze({
  lunch: [
    [[48, 61, 93], [64, 92, 52]], [[39, 50, 76], [52, 76, 42]], [[30, 38, 58], [40, 58, 32]], [[56, 70, 108], [74, 104, 60]], [[20, 25, 39], [26, 38, 22]], [[12, 15, 24], [16, 24, 14]],
    [[216, 111, 27], [226, 224, 214]], [[177, 91, 22], [190, 188, 178]], [[249, 128, 31], [244, 242, 232]], [[134, 69, 16], [150, 148, 140]], [[104, 53, 13], [118, 116, 110]],
  ],
  electrician: [
    // maroon work suit, so nobody in the room shares a colour (boss yellow,
    // welder brown leather, fitter navy + orange, loader green + white apron).
    [[118, 122, 124], [128, 52, 58]], [[97, 100, 102], [106, 42, 48]], [[137, 141, 143], [150, 66, 72]], [[73, 76, 77], [78, 30, 36]],
  ],
});
export function recolor(data, pairs) {
  const map = new Map(pairs.map(([from, to]) => [rgbKey(...from), rgbKey(...to)]));
  for (let i = 0; i < data.length; i++) {
    const to = map.get(data[i] >>> 0);
    if (to !== undefined) data[i] = to;
  }
  return data;
}
