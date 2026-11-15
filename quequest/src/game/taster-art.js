// 20.0 · the pixel kit every taster scene draws with (split out of taster-scene.js so a new
// taster can live in its own module, src/game/tasters/<id>.js, without an import cycle).
import { rgb } from './raycaster.js';
import { PREVIEW_W as W, PREVIEW_H as H } from './career-previews.js';
export { W, H, rgb };

export const C = {
  white: rgb(236, 236, 228), dim: rgb(150, 150, 146), dark: rgb(8, 9, 12), bar: rgb(14, 15, 19),
  gold: rgb(255, 200, 70), red: rgb(232, 60, 44), green: rgb(96, 224, 124), cyan: rgb(110, 240, 255),
  skin: rgb(226, 188, 150), wood: rgb(120, 78, 42), night: rgb(10, 14, 30),
};
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, k) => a + (b - a) * k;
export const ease = (k) => 1 - (1 - clamp(k, 0, 1)) ** 2;
export const TOP = 14, BOTTOM = 160;

// --------------------------------------------------------------- timeline
// Actors come one after another: GAP apart, WALK to the decision point,
// then FATE seconds to show what happened. The banner comes after.
export const GAP = 0.6, WALK = 1.3, FATE = 0.9;
// Where actor i is: phase 'wait' (not yet), 'walk' k∈[0,1], 'fate' k∈[0,1], 'done'.
export function phaseOf(i, t) {
  const s = i * GAP;
  if (t < s) return ['wait', 0];
  if (t < s + WALK) return ['walk', (t - s) / WALK];
  if (t < s + WALK + FATE) return ['fate', (t - s - WALK) / FATE];
  return ['done', 1];
}

// ------------------------------------------------------------ small art
export function person(P, x, y, body, { head = C.skin, frame = 0, scale = 1 } = {}) {
  x = Math.round(x); y = Math.round(y);
  const s = scale;
  P.rect(x + s, y, 3 * s, 3 * s, head); P.rect(x, y + 3 * s, 5 * s, 4 * s, body);
  const leg = rgb(40, 40, 46);
  if (frame) { P.rect(x, y + 7 * s, 2 * s, 2 * s, leg); P.rect(x + 3 * s, y + 7 * s, 2 * s, s, leg); }
  else { P.rect(x + s, y + 7 * s, s, 2 * s, leg); P.rect(x + 3 * s, y + 7 * s, s, 2 * s, leg); }
}
export function bot(P, x, y, frame = 0, scale = 1) {
  const s = scale; x = Math.round(x); y = Math.round(y);
  P.rect(x, y, 6 * s, 5 * s, rgb(170, 30, 30)); P.rect(x + s, y + s, s, s, C.gold); P.rect(x + 4 * s, y + s, s, s, C.gold);
  P.rect(x + 2 * s, y - 2 * s, s, 2 * s, rgb(120, 20, 20));
  P.rect(x + s, y + 5 * s, 4 * s, 3 * s, rgb(110, 24, 24));
  P.rect(x + (frame ? 0 : s), y + 8 * s, s, s, rgb(60, 10, 10)); P.rect(x + (frame ? 5 : 4) * s, y + 8 * s, s, s, rgb(60, 10, 10));
}
export function shards(P, x, y, k, c = C.red) {
  for (let i = 0; i < 8; i++) { const a = i * 0.785 + 0.3, r = 3 + k * 16; P.rect(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.7, 2, 2, c); }
}
export function ring(P, x, y, r, c) { for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; P.put(x + Math.cos(a) * r, y + Math.sin(a) * r, c); } }
export function sky(P, time, h = 112) {
  for (let y = TOP; y < h; y++) P.rect(0, y, W, 1, rgb(8 + ((y - TOP) / 7) | 0, 10 + ((y - TOP) / 6) | 0, 26 + ((y - TOP) / 3) | 0));
  for (let i = 0; i < 34; i++) { const x = (i * 97 + 13) % W, y = TOP + ((i * 53 + 7) % (h - TOP - 30)); const tw = 0.5 + 0.5 * Math.sin(time * 1.3 + i * 2.1); P.put(x, y, rgb(220 * tw | 0, 230 * tw | 0, 255 * tw | 0)); }
}
export function tag(P, x, y, s, c) { P.ctext(y, s, c, 1, x); }
// The case on show: sweeps through the cases and stops on the first wrong
// one — the one the sentence under the scene talks about.
export function caseAt(cases, k) {
  const wrong = cases.findIndex((c) => !c.ok), last = wrong >= 0 ? wrong : cases.length - 1;
  return clamp(Math.floor(k), 0, last);
}
export function wrongMark(P, x, y, time) { if (Math.floor(time * 6) % 2) ring(P, x, y, 9, C.red); P.text(x - 2, y - 18, '!', C.red); }

