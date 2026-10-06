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
  }
  return out;
}
