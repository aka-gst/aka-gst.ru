// 17.4 · ЛЕСТНИЦА УСТРОЙСТВ. Идея из «Лабиринта отражений» (Диптаун):
// виртуальность — это не только сидеть за компом. Первая ступень — шлем /
// очки на голове; дальше телефон (AR через камеру), имплант в кость,
// нейролинк / нейромаска. Чем лучше «костюм», тем сильнее и чище
// виртуальность: шире поле, твёрже якоря, богаче голограммы, быстрее нырок.
//
// Pure data + rules. In play only the headset (tier index 0) is obtainable
// now; ?device=0..3 forces a tier for testing. tools/ar-headset.test.mjs.

const freeze = Object.freeze;

// field: share of the screen the overlay may use (a visor frame outside it).
// jitter: px the holo-tags shake (cheap tracking). textScale: 1 = native,
// lowRes: holo text drawn at half resolution (blocky). stable: anchors lock
// to the world without lag. rich: extra readout lines, packet trails.
// boot: boot-transition time multiplier. dive: screen-dive time multiplier.
// frame: how the edge of the field looks ('visor', 'phone', 'none').
export const VR_DEVICES = freeze([
  freeze({ n: 0, id: 'headset', tier: 1, name: 'ШЛЕМ', long: 'Шлем / AR-очки', field: 0.72, jitter: 1.5, lowRes: true, stable: false, rich: false, boot: 1, dive: 1, frame: 'visor', tagLimit: 5, price: 0, obtainable: true,
    note: 'Узкое поле, голограммы подрагивают, текст крупными пикселями. Зато можно чинить прямо в комнате.' }),
  freeze({ n: 1, id: 'phone', tier: 2, name: 'ТЕЛЕФОН', long: 'Телефон · AR через камеру', field: 0.84, jitter: 0.6, lowRes: false, stable: false, rich: false, boot: 0.7, dive: 0.85, frame: 'phone', tagLimit: 7, price: 2500, obtainable: false,
    note: 'Камера телефона: поле шире, якоря держатся лучше, текст чёткий.' }),
  freeze({ n: 2, id: 'implant', tier: 3, name: 'ИМПЛАНТ', long: 'Костный имплант', field: 1, jitter: 0, lowRes: false, stable: true, rich: true, boot: 0.45, dive: 0.65, frame: 'none', tagLimit: 10, price: 9000, obtainable: false,
    note: 'Звук через кость, картинка на весь глаз: голограммы стоят как вкопанные, показывают больше.' }),
  freeze({ n: 3, id: 'neuro', tier: 4, name: 'НЕЙРОЛИНК', long: 'Нейролинк / нейромаска', field: 1, jitter: 0, lowRes: false, stable: true, rich: true, boot: 0.25, dive: 0.4, frame: 'none', tagLimit: 14, price: 30000, obtainable: false,
    note: 'Глубина без компьютера: мир и код — одно. Нырок почти мгновенный.' }),
]);
export const DEVICE_COUNT = VR_DEVICES.length;
export const DEVICE_KEY = 'quequest.vr.device';

export function clampDevice(n) {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.max(0, Math.min(DEVICE_COUNT - 1, v)) : 0;
}
export function deviceSettings(n) { return VR_DEVICES[clampDevice(n)]; }

// ?device=0..3 (or ?device=phone) forces a tier.
export function deviceFromQuery(search = '') {
  const params = new URLSearchParams(String(search).replace(/^\?/, ''));
  if (!params.has('device')) return null;
  const raw = params.get('device').trim().toLowerCase();
  const byId = VR_DEVICES.findIndex((d) => d.id === raw);
  if (byId >= 0) return byId;
  return /^\d+$/.test(raw) ? clampDevice(raw) : null;
}

// The next rung: what it costs and whether it can be had in play yet.
export function nextDevice(current = 0) {
  const n = clampDevice(current) + 1;
  return n < DEVICE_COUNT ? VR_DEVICES[n] : null;
}
// Upgrade hook (pure): only obtainable tiers can be bought.
export function upgradeDevice({ device = 0, wallet = 0 } = {}) {
  const next = nextDevice(device);
  if (!next) return { ok: false, reason: 'max', device, wallet };
  if (!next.obtainable) return { ok: false, reason: 'locked', device, wallet, next: next.id };
  if (wallet < next.price) return { ok: false, reason: 'money', price: next.price, device, wallet };
  return { ok: true, device: next.n, wallet: wallet - next.price, price: next.price };
}

// The overlay's field rectangle on a W x H view, centred.
export function deviceField(n, W, H) {
  const d = deviceSettings(n);
  const w = Math.round(W * d.field), h = Math.round(H * Math.min(1, d.field + 0.12));
  return { x0: Math.round((W - w) / 2), y0: Math.round((H - h) / 2), x1: Math.round((W + w) / 2), y1: Math.round((H + h) / 2) };
}

// Cheap tracking: a tag's shake at time t (seconds), deterministic per tag.
export function deviceJitter(n, t, seed = 0) {
  const j = deviceSettings(n).jitter;
  if (!j) return { dx: 0, dy: 0 };
  return { dx: Math.round(Math.sin(t * 23 + seed * 1.7) * j), dy: Math.round(Math.cos(t * 19 + seed * 2.3) * j) };
}
