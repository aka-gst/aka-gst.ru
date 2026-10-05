// 17.4 · The polygon renderer (WebGL2, no libraries). It draws what
// mesh-builder.js and props-meshes.js build, with exactly the features the
// engine ladder (engine-ladder.js) has turned on -- each flag below switches
// a real piece of the pipeline, not a filter:
//
//   polys        triangles instead of rays; painter's sort while there is no z-buffer
//   zbuffer      depth test on (gl.DEPTH_TEST) instead of sorting
//   trueLook     view matrix pitch/roll (before it: a sheared projection, like Build)
//   polyLightmap baked per-face lightmap atlas, sampled per pixel (before: per-vertex light)
//   bilinear     LINEAR sampler instead of NEAREST
//   mipmaps      LINEAR_MIPMAP_LINEAR sampler (mip chain generated at upload)
//   dynLights    per-pixel point lights in colour (before: monochrome, like Quake 1)
//   skybox       a cube map behind everything; SKY ceilings become holes
//   glass        a transparent pass: windows, car glass, water, sorted back to front
//   normalMaps   per-texel normals from a height map, cotangent frame from derivatives
//   detail       a high-frequency detail texture blended in near the camera
//   decals       alpha-blended quads with polygon offset
//   fog          exponential distance fog plus a height fog layer
//   shadows      a shadow map rendered from the main lamp, 3x3 PCF
//   bloom        HDR scene, bright pass, separable blur, composite, gamma
//
// The finished frame is read back into the caller's Uint32 buffer, so the
// HUD, the speech bubbles and the dive effects keep drawing on it as before.
import { STRIDE, OFF, MAT } from './mesh-builder.js';
import { mul, invert, reflection } from './mat4.js';

const WORLD_VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec2 aUV; layout(location=2) in vec3 aNrm;
layout(location=3) in vec2 aLM; layout(location=4) in vec3 aVL; layout(location=5) in vec3 aAlb;
layout(location=6) in float aMat; layout(location=7) in vec2 aScroll;
uniform mat4 uVP; uniform float uTime;
out vec3 vPos; out vec2 vUV; out vec3 vNrm; out vec2 vLM; out vec3 vVL; out vec3 vAlb; flat out float vMat;
void main() {
  vPos = aPos; vUV = aUV + aScroll * uTime; vNrm = aNrm; vLM = aLM; vVL = aVL; vAlb = aAlb; vMat = aMat;
  gl_Position = uVP * vec4(aPos, 1.0);
}`;

const WORLD_FS = `#version 300 es
precision highp float; precision highp int;
in vec3 vPos; in vec2 vUV; in vec3 vNrm; in vec2 vLM; in vec3 vVL; in vec3 vAlb; flat in float vMat;
uniform sampler2D uTex; uniform sampler2D uLM; uniform sampler2D uNM; uniform sampler2D uDetail; uniform highp sampler2D uShadow;
uniform samplerCube uSky;
uniform vec3 uCam; uniform float uTime;
uniform int uUseLM, uUseNM, uUseDetail, uUseShadow, uDynColor, uUseSky, uUseFog, uOverride, uClipOn;
uniform int uNL; uniform vec4 uLP[8]; uniform vec4 uLC[8];
uniform vec4 uSL; uniform vec4 uSLC; uniform mat4 uSVP; uniform float uShadowTexel;
uniform vec4 uFog; uniform vec3 uFogH; uniform vec4 uClip;
uniform int uRtx; uniform highp sampler2D uGrid; uniform sampler2D uGridF; uniform sampler2D uGridW; uniform sampler2D uGridC;
uniform vec2 uGridSize; uniform float uFrame;
out vec4 oColor;

// RTX rung: a real ray walked through the level's cell grid (2D DDA in x/z,
// floor and ceiling heights per cell) -- the same data the raycaster uses,
// traced per pixel in any direction. Returns the colour hit (rgb) and the
// distance (a), or a < 0 for a miss.
vec4 gridCell(ivec2 c) {
  if (c.x < 0 || c.y < 0 || c.x >= int(uGridSize.x) || c.y >= int(uGridSize.y)) return vec4(0.0, 0.0, 1.0, 0.0);
  return texelFetch(uGrid, c, 0);
}
vec4 traceGrid(vec3 ro, vec3 rd, float maxT) {
  ivec2 cell = ivec2(floor(ro.xz));
  vec2 dir = rd.xz;
  vec2 delta = vec2(abs(dir.x) < 1e-5 ? 1e5 : abs(1.0 / dir.x), abs(dir.y) < 1e-5 ? 1e5 : abs(1.0 / dir.y));
  ivec2 stp = ivec2(dir.x < 0.0 ? -1 : 1, dir.y < 0.0 ? -1 : 1);
  vec2 side = vec2(dir.x < 0.0 ? (ro.x - float(cell.x)) * delta.x : (float(cell.x) + 1.0 - ro.x) * delta.x,
                   dir.y < 0.0 ? (ro.z - float(cell.y)) * delta.y : (float(cell.y) + 1.0 - ro.z) * delta.y);
  float t0 = 0.0;
  for (int i = 0; i < 40; i++) {
    vec4 c = gridCell(cell);
    float t1 = min(side.x, side.y);
    if (rd.y < 0.0) { float tf = (c.r * 10.0 - ro.y) / rd.y; if (tf >= t0 && tf <= t1 && tf <= maxT) return vec4(texelFetch(uGridF, cell, 0).rgb * 2.0, tf); }
    if (rd.y > 0.0) { float tc = (c.g * 10.0 - ro.y) / rd.y; if (tc >= t0 && tc <= t1 && tc <= maxT) return vec4(texelFetch(uGridC, cell, 0).rgb * 2.0, tc); }
    if (t1 > maxT) break;
    ivec2 nc = cell; float shade = 1.0;
    if (side.x < side.y) { side.x += delta.x; nc.x += stp.x; } else { side.y += delta.y; nc.y += stp.y; shade = 0.82; }
    vec4 n = gridCell(nc);
    float y = ro.y + rd.y * t1;
    if (n.b > 0.5 || y < n.r * 10.0 || y > n.g * 10.0) return vec4(texelFetch(uGridW, nc, 0).rgb * 2.0 * shade, t1);
    cell = nc; t0 = t1;
  }
  return vec4(0.0, 0.0, 0.0, -1.0);
}
float hash1(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + uFrame * 0.618) * 43758.5453); }

vec3 perturb(vec3 N, vec3 p, vec2 uv) {
  vec3 dp1 = dFdx(p), dp2 = dFdy(p); vec2 duv1 = dFdx(uv), duv2 = dFdy(uv);
  vec3 dp2perp = cross(dp2, N), dp1perp = cross(N, dp1);
  vec3 T = dp2perp * duv1.x + dp1perp * duv2.x;
  vec3 B = dp2perp * duv1.y + dp1perp * duv2.y;
  float m = max(dot(T, T), dot(B, B));
  if (m < 1e-12) return N;
  float invmax = inversesqrt(m);
  vec3 t = texture(uNM, uv).xyz * 2.0 - 1.0;
  return normalize(mat3(T * invmax, B * invmax, N) * t);
}
vec3 env(vec3 d) { return uUseSky == 1 ? texture(uSky, d).rgb : vec3(0.22, 0.25, 0.3); }

void main() {
  if (uClipOn == 1 && dot(vec4(vPos, 1.0), uClip) < 0.0) discard;
  if (uOverride == 1) { oColor = vec4(0.62, 0.72, 0.82, 0.13); return; }
  int mat = int(vMat + 0.5);
  vec2 uv = vUV;
  if (mat == 10 || mat == 4) uv += vec2(sin(vPos.z * 3.1 + uTime * 2.2), cos(vPos.x * 2.7 + uTime * 1.8)) * 0.03;
  vec4 t = texture(uTex, uv);
  bool trans = mat == 3 || mat == 4 || mat == 6 || mat == 9;
  if (!trans && t.a < 0.5) discard;
  vec3 alb = t.rgb * vAlb;
  if (mat == 2) alb = vec3(0.0);
  vec3 V = normalize(uCam - vPos);
  vec3 Ng = normalize(vNrm);
  if (dot(Ng, V) < 0.0) Ng = -Ng;
  vec3 N = Ng;
  if (uUseNM == 1 && mat == 0) N = perturb(Ng, vPos, vUV);
  if (mat == 4) N = normalize(Ng + vec3(sin(vPos.x * 11.0 + uTime * 1.7) + sin(vPos.z * 7.0 - uTime), 0.0, cos(vPos.z * 9.0 + uTime * 1.3)) * 0.06);
  float dist = length(uCam - vPos);
  if (uUseDetail == 1 && mat != 1 && mat != 7) {
    vec2 dUV = abs(Ng.y) > 0.5 ? vPos.xz : (abs(Ng.x) > 0.5 ? vPos.zy : vPos.xy);
    float det = texture(uDetail, dUV * 2.5).r * 2.0;
    alb *= mix(det, 1.0, smoothstep(1.2, 5.0, dist));
  }
  vec3 L;
  if (mat == 1) L = vVL;
  else if (mat == 7) L = vec3(1.55);
  else {
    L = (uUseLM == 1 && vLM.x >= 0.0) ? texture(uLM, vLM).rgb * 2.0 : vVL;
    if (uUseNM == 1 && mat == 0) { vec3 H = normalize(Ng + vec3(0.3, 0.8, 0.2)); L *= clamp(1.0 + 2.2 * (dot(N, H) - dot(Ng, H)), 0.4, 1.7); }
    for (int i = 0; i < 8; i++) {
      if (i >= uNL) break;
      vec3 d = uLP[i].xyz - vPos; float dl = length(d); float r = uLP[i].w;
      if (dl < r) {
        float k = pow(1.0 - dl / r, 2.0) * uLC[i].w * (0.35 + 0.65 * max(0.0, dot(N, d / max(dl, 1e-3))));
        vec3 c = uLC[i].rgb; if (uDynColor == 0) c = vec3(dot(c, vec3(0.3, 0.59, 0.11)));
        L += k * c;
      }
    }
    if (uUseShadow == 1) {
      vec3 d = uSL.xyz - vPos; float dl = length(vec3(d.x, d.y * 0.45, d.z)); float r = uSL.w;
      if (dl < r) {
        float k = pow(1.0 - dl / r, 2.0) * uSLC.w * (0.4 + 0.6 * max(0.0, dot(N, normalize(d))));
        float vis = 1.0;
        vec4 sp = uSVP * vec4(vPos + Ng * 0.035, 1.0);
        if (sp.w > 0.0) {
          vec3 s = sp.xyz / sp.w * 0.5 + 0.5;
          if (s.x > 0.0 && s.y > 0.0 && s.x < 1.0 && s.y < 1.0 && s.z < 1.0) {
            float sum = 0.0;
            for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) sum += (s.z - 0.0009 > texture(uShadow, s.xy + vec2(x, y) * uShadowTexel).r) ? 0.0 : 1.0;
            vis = sum / 9.0;
          }
        }
        if (uRtx == 1) {
          // soft shadows: two rays toward random points on the lamp
          float sv = 0.0;
          for (int j = 0; j < 2; j++) {
            float h = hash1(gl_FragCoord.xy + float(j) * 17.0);
            vec3 lp = uSL.xyz + (vec3(h, fract(h * 7.31), fract(h * 3.17)) - 0.5) * 0.6;
            vec3 ro = vPos + Ng * 0.03; vec3 dd = lp - ro; float len = length(dd);
            vec4 hit = traceGrid(ro, dd / len, len);
            sv += (hit.a > 0.0 && hit.a < len - 0.1) ? 0.0 : 0.5;
          }
          vis = min(vis, mix(0.25, 1.0, sv));
        }
        L += k * mix(0.1, 1.0, vis) * uSLC.rgb;
      }
    }
  }
  vec3 rtxRefl = vec3(0.0); float rtxK = 0.0;
  if (uRtx == 1 && mat != 1 && mat != 7 && mat != 2 && mat != 8) {
    float rk = (mat == 4 || mat == 10) ? 0.55 : mat == 11 ? 0.32 : (mat == 0 && Ng.y > 0.5) ? 0.1 : 0.0;
    if (rk > 0.0) {
      vec3 rd = reflect(-V, N);
      vec4 hit = traceGrid(vPos + Ng * 0.02, rd, 16.0);
      rtxRefl = hit.a > 0.0 ? hit.rgb : env(rd);
      rtxK = clamp(rk + (1.0 - rk) * pow(1.0 - max(0.0, dot(N, V)), 5.0) * rk * 1.5, 0.0, 0.85);
    }
    // one bounce of indirect light: a jittered ray along the normal picks
    // up the colour of what it hits
    float h = hash1(gl_FragCoord.xy * 1.37);
    vec3 gd = normalize(N + (vec3(h, fract(h * 7.13), fract(h * 3.71)) - 0.5) * 1.3);
    vec4 g = traceGrid(vPos + Ng * 0.02, gd, 6.0);
    if (g.a > 0.0) L += g.rgb * 0.2 * exp(-g.a * 0.35);
  }
  vec3 col = alb * L;
  if (rtxK > 0.0) col = mix(col, rtxRefl, rtxK);
  float a = 1.0;
  if (trans) {
    float fres = pow(1.0 - max(0.0, dot(N, V)), 3.0);
    vec3 refl = env(reflect(-V, N));
    if (mat == 3) { a = t.a; col = mix(col, col + refl * 0.35, 1.0 - a); }
    else if (mat == 4) { a = 0.5 + 0.4 * fres; col = mix(alb * L * 0.55, refl * 0.7 + vec3(0.05, 0.1, 0.12), 0.35 + 0.5 * fres); }
    else if (mat == 6) { a = 0.42 + 0.4 * fres; col = col * 0.7 + refl * (0.25 + fres * 0.5); }
    else { a = t.a; }
  }
  if (uUseFog == 1) {
    float f = 1.0 - exp(-uFog.w * dist);
    float low = min(vPos.y, uCam.y);
    float hy = clamp((uFogH.x - low) / max(0.001, uFogH.x), 0.0, 1.0);
    f = clamp(f + (1.0 - exp(-uFogH.y * dist)) * hy * hy, 0.0, 0.92);
    col = mix(col, uFog.rgb, f);
  }
  oColor = vec4(col, a);
}`;

const SKY_VS = `#version 300 es
const vec2 P[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
out vec2 vNdc; uniform float uZ;
void main() { vNdc = P[gl_VertexID]; gl_Position = vec4(vNdc, uZ, 1.0); }`;
const SKY_FS = `#version 300 es
precision highp float;
in vec2 vNdc; uniform mat4 uInvVP; uniform vec3 uCam; uniform samplerCube uSky; uniform vec4 uFog; uniform int uUseFog;
out vec4 o;
void main() {
  vec4 p = uInvVP * vec4(vNdc, 1.0, 1.0);
  vec3 d = normalize(p.xyz / p.w - uCam);
  vec3 c = texture(uSky, d).rgb;
  if (uUseFog == 1) c = mix(c, uFog.rgb, clamp(0.55 - d.y * 1.6, 0.0, 0.7));
  o = vec4(c, 1.0);
}`;
const FILL_FS = `#version 300 es
precision mediump float; out vec4 o; void main() { o = vec4(0.0); }`;

const PT_VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec4 aCol; layout(location=2) in float aSize;
uniform mat4 uVP; uniform float uF;
out vec4 vCol;
void main() { vec4 c = uVP * vec4(aPos, 1.0); gl_Position = c; gl_PointSize = clamp(aSize * uF / max(c.w, 0.05), 1.0, 24.0); vCol = aCol; }`;
const PT_FS = `#version 300 es
precision mediump float; in vec4 vCol; out vec4 o; void main() { o = vCol; }`;

const SH_VS = `#version 300 es
layout(location=0) in vec3 aPos; uniform mat4 uVP; void main() { gl_Position = uVP * vec4(aPos, 1.0); }`;
const SH_FS = `#version 300 es
precision mediump float; out vec4 o; void main() { o = vec4(1.0); }`;

const POST_VS = `#version 300 es
const vec2 P[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
out vec2 vUV; void main() { vUV = P[gl_VertexID] * 0.5 + 0.5; gl_Position = vec4(P[gl_VertexID], 0.0, 1.0); }`;
const BRIGHT_FS = `#version 300 es
precision highp float; in vec2 vUV; uniform sampler2D uSrc; uniform float uThr; out vec4 o;
void main() { vec3 c = texture(uSrc, vUV).rgb; float l = max(c.r, max(c.g, c.b)); o = vec4(c * max(0.0, l - uThr) / max(l, 1e-4), 1.0); }`;
const BLUR_FS = `#version 300 es
precision highp float; in vec2 vUV; uniform sampler2D uSrc; uniform vec2 uDir; out vec4 o;
void main() {
  vec3 c = texture(uSrc, vUV).rgb * 0.227;
  c += (texture(uSrc, vUV + uDir * 1.385).rgb + texture(uSrc, vUV - uDir * 1.385).rgb) * 0.316;
  c += (texture(uSrc, vUV + uDir * 3.231).rgb + texture(uSrc, vUV - uDir * 3.231).rgb) * 0.070;
  o = vec4(c, 1.0);
}`;
const FINAL_FS = `#version 300 es
precision highp float; in vec2 vUV; uniform sampler2D uSrc; uniform sampler2D uBloom;
uniform float uBloomK; uniform int uGamma; uniform float uVig; uniform float uGrain; uniform float uTime; out vec4 o;
uniform highp sampler2D uDepth; uniform vec2 uNF;
float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime) * 43758.5453); }
void main() {
  vec2 uv = vec2(vUV.x, 1.0 - vUV.y);
  vec3 c = texture(uSrc, uv).rgb;
  if (uBloomK > 0.0) c += texture(uBloom, uv).rgb * uBloomK;
  if (uGamma == 1) { c = c / (1.0 + c * 0.18); c = pow(max(c, 0.0), vec3(0.86)) * 1.12; }
  if (uVig > 0.0) { vec2 d = uv - 0.5; c *= 1.0 - uVig * dot(d, d) * 2.0; }
  if (uGrain > 0.0) c += (h(uv * 731.0) - 0.5) * uGrain;
  // alpha carries the distance along the view axis (sqrt-encoded, 0..30 m)
  // so the caller gets a depth buffer for the headset and speech bubbles
  float zn = texture(uDepth, uv).r * 2.0 - 1.0;
  float lin = 2.0 * uNF.x * uNF.y / (uNF.y + uNF.x - zn * (uNF.y - uNF.x));
  o = vec4(clamp(c, 0.0, 1.0), sqrt(clamp(lin / 30.0, 0.0, 1.0)));
}`;

function compile(gl, vs, fs) {
  const mk = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader');
    return s;
  };
  const p = gl.createProgram();
  gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link');
  const loc = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const u = gl.getActiveUniform(p, i); const name = u.name.replace(/\[0\]$/, ''); loc[name] = gl.getUniformLocation(p, u.name); }
  return { p, loc };
}

export function createGlRenderer({ canvas = null } = {}) {
  const cv = canvas ?? (typeof document !== 'undefined' ? document.createElement('canvas') : null);
  if (!cv) return null;
  cv.width = 4; cv.height = 4;
  let gl = null;
  try { gl = cv.getContext('webgl2', { antialias: false, alpha: false, depth: true, stencil: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' }); } catch { gl = null; }
  if (!gl) return null;
  const hdr = Boolean(gl.getExtension('EXT_color_buffer_float'));
  let prog;
  try {
    prog = {
      world: compile(gl, WORLD_VS, WORLD_FS), sky: compile(gl, SKY_VS, SKY_FS), fill: compile(gl, SKY_VS, FILL_FS),
      pts: compile(gl, PT_VS, PT_FS), shadow: compile(gl, SH_VS, SH_FS),
      bright: compile(gl, POST_VS, BRIGHT_FS), blur: compile(gl, POST_VS, BLUR_FS), final: compile(gl, POST_VS, FINAL_FS),
    };
  } catch (err) {
    if (typeof console !== 'undefined') console.warn('gl-renderer: shaders failed', err);
    return null;
  }

  // ------------------------------------------------------------- samplers
  const sampler = (min, mag, wrap = gl.REPEAT) => {
    const s = gl.createSampler();
    gl.samplerParameteri(s, gl.TEXTURE_MIN_FILTER, min); gl.samplerParameteri(s, gl.TEXTURE_MAG_FILTER, mag);
    gl.samplerParameteri(s, gl.TEXTURE_WRAP_S, wrap); gl.samplerParameteri(s, gl.TEXTURE_WRAP_T, wrap);
    return s;
  };
  const SAMP = {
    nearest: sampler(gl.NEAREST, gl.NEAREST), linear: sampler(gl.LINEAR, gl.LINEAR), mip: sampler(gl.LINEAR_MIPMAP_LINEAR, gl.LINEAR),
    clampLinear: sampler(gl.LINEAR, gl.LINEAR, gl.CLAMP_TO_EDGE), clampNearest: sampler(gl.NEAREST, gl.NEAREST, gl.CLAMP_TO_EDGE),
  };

  // ------------------------------------------------------------- textures
  const texCache = new Map(); // src object -> { t, nm, frame, w, h }
  let frameNo = 0;
  function makeTex(w, h, bytes, mips = true) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
    if (mips) gl.generateMipmap(gl.TEXTURE_2D);
    return t;
  }
  const white = makeTex(1, 1, new Uint8Array([255, 255, 255, 255]));
  const flatNormal = makeTex(1, 1, new Uint8Array([128, 128, 255, 255]));
  function texFor(src, dirty = false) {
    if (!src || !src.data) return white;
    let e = texCache.get(src);
    if (!e) { e = { t: makeTex(src.w, src.h, new Uint8Array(src.data.buffer, src.data.byteOffset, src.w * src.h * 4)), nm: null, w: src.w, h: src.h }; texCache.set(src, e); }
    else if (dirty) {
      gl.bindTexture(gl.TEXTURE_2D, e.t);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, src.w, src.h, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(src.data.buffer, src.data.byteOffset, src.w * src.h * 4));
      gl.generateMipmap(gl.TEXTURE_2D);
    }
    e.frame = frameNo;
    return e.t;
  }
  // Normal map from the texture's own brightness (a height map): the slope
  // between neighbouring texels is the normal's tilt.
  function normalFor(src) {
    if (!src || !src.data) return flatNormal;
    const e = texCache.get(src);
    if (!e) return flatNormal;
    if (!e.nm) {
      const { w, h, data } = src;
      const H = new Float32Array(w * h);
      for (let i = 0; i < w * h; i++) { const c = data[i]; H[i] = ((c & 255) * 0.3 + ((c >>> 8) & 255) * 0.59 + ((c >>> 16) & 255) * 0.11) / 255; }
      const out = new Uint8Array(w * h * 4);
      const k = 2.2 * Math.max(1, w / 64);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const l = H[y * w + ((x - 1 + w) % w)], r = H[y * w + ((x + 1) % w)], u = H[((y - 1 + h) % h) * w + x], d = H[((y + 1) % h) * w + x];
        let nx = (l - r) * k, ny = (u - d) * k, nz = 1;
        const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
        const o = (y * w + x) * 4;
        out[o] = (nx * 0.5 + 0.5) * 255; out[o + 1] = (ny * 0.5 + 0.5) * 255; out[o + 2] = (nz * 0.5 + 0.5) * 255; out[o + 3] = 255;
      }
      e.nm = makeTex(w, h, out);
    }
    return e.nm;
  }
  function evict() {
    for (const [k, e] of texCache) if (frameNo - (e.frame ?? 0) > 240) { gl.deleteTexture(e.t); if (e.nm) gl.deleteTexture(e.nm); texCache.delete(k); }
  }
  // Detail texture: fine noise around 0.5.
  const detailTex = (() => {
    const N = 64, b = new Uint8Array(N * N * 4);
    let s = 1234567;
    const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    const base = new Float32Array(N * N).map(() => rnd());
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const v = (base[y * N + x] * 2 + base[y * N + ((x + 1) % N)] + base[((y + 1) % N) * N + x]) / 4;
      const g = Math.round((0.38 + v * 0.24) * 255);
      const o = (y * N + x) * 4; b[o] = b[o + 1] = b[o + 2] = g; b[o + 3] = 255;
    }
    return makeTex(N, N, b);
  })();
  let skyTex = null; let skyKey = null;
  function setSky(key, faces) {
    if (skyKey === key) return;
    skyKey = key;
    if (!skyTex) skyTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, skyTex);
    const targets = [gl.TEXTURE_CUBE_MAP_POSITIVE_X, gl.TEXTURE_CUBE_MAP_NEGATIVE_X, gl.TEXTURE_CUBE_MAP_POSITIVE_Y, gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, gl.TEXTURE_CUBE_MAP_POSITIVE_Z, gl.TEXTURE_CUBE_MAP_NEGATIVE_Z];
    faces.data.forEach((d, i) => gl.texImage2D(targets[i], 0, gl.RGBA8, faces.size, faces.size, 0, gl.RGBA, gl.UNSIGNED_BYTE, d));
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  // ------------------------------------------------------------- lightmap
  let lmTex = null; let lmKey = null;
  function setLightmap(lm) {
    if (!lm || lm.key === lmKey) return;
    lmKey = lm.key;
    if (lmTex) gl.deleteTexture(lmTex);
    lmTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, lmTex);
    // Pack the float lightmap as RGBA8 at half range (light goes up to ~2).
    const b = new Uint8Array(lm.w * lm.h * 4);
    for (let i = 0; i < lm.w * lm.h * 4; i++) b[i] = Math.max(0, Math.min(255, Math.round((i % 4 === 3 ? 0.5 : lm.data[i]) * 127.5)));
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, lm.w, lm.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, b);
  }

  // ------------------------------------------------------------- RTX grid
  const gridTex = { key: null, t: [] };
  function setGrid(g) {
    if (!g || g.key === gridTex.key) return;
    gridTex.key = g.key;
    for (const t of gridTex.t) gl.deleteTexture(t);
    gridTex.t = [g.cells, g.floor, g.wall, g.ceil].map((d) => {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, g.w, g.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, d);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      return t;
    });
    gridTex.w = g.w; gridTex.h = g.h;
  }

  // ------------------------------------------------------------- buffers
  const vao = gl.createVertexArray();
  const sbuf = gl.createBuffer(); // static level
  const dbuf = gl.createBuffer(); // props, sprites, decals (per frame)
  const ibuf = gl.createBuffer(); // painter's order
  const pbuf = gl.createBuffer(); // particles
  const pvao = gl.createVertexArray();
  let staticVersion = null; let staticCount = 0;
  function bindWorldAttribs(buf) {
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    const S = STRIDE * 4;
    const A = (loc, size, off) => { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, S, off * 4); };
    A(0, 3, OFF.pos); A(1, 2, OFF.uv); A(2, 3, OFF.nrm); A(3, 2, OFF.lm); A(4, 3, OFF.vl); A(5, 3, OFF.alb); A(6, 1, OFF.mat); A(7, 2, OFF.scroll);
  }

  // ------------------------------------------------------------- targets
  const T = { w: 0, h: 0 };
  let sceneFbo, sceneTex, sceneDepth, finalFbo, finalTex, bloomA, bloomB, shadowFbo, shadowTex;
  const colorFormat = hdr ? [gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT] : [gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE];
  function colorTarget(w, h, fmt = colorFormat) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, fmt[0], w, h, 0, fmt[1], fmt[2], null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    return { t, f, w, h };
  }
  function targets(w, h) {
    if (T.w === w && T.h === h) return;
    for (const o of [sceneFbo, finalFbo, bloomA, bloomB]) if (o) { gl.deleteTexture(o.t); gl.deleteFramebuffer(o.f); }
    if (sceneDepth) gl.deleteTexture(sceneDepth);
    T.w = w; T.h = h;
    sceneFbo = colorTarget(w, h); sceneTex = sceneFbo.t;
    sceneDepth = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, sceneDepth);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH24_STENCIL8, w, h, 0, gl.DEPTH_STENCIL, gl.UNSIGNED_INT_24_8, null);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFbo.f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.TEXTURE_2D, sceneDepth, 0);
    finalFbo = colorTarget(w, h, [gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE]); finalTex = finalFbo.t;
    const bw = Math.max(1, w >> 1), bh = Math.max(1, h >> 1);
    bloomA = colorTarget(bw, bh); bloomB = colorTarget(bw, bh);
    void sceneTex; void finalTex;
  }
  const SHADOW = 1024;
  function shadowTarget() {
    if (shadowFbo) return;
    shadowTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, shadowTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, SHADOW, SHADOW, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    shadowFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, shadowTex, 0);
  }

  // ------------------------------------------------------------- render
  // job: { W, H, out, flags, VP, cam:[x,y,z], F, time, stat, dyn, lightmap,
  //   lights, shadow:{ pos, radius, intensity, color, VP }, fog, sky,
  //   mirror:{ n, d, group, dyn } | null, particles }
  function render(job) {
    frameNo++;
    const { W, H, flags } = job;
    targets(W, H);
    if (job.stat.version !== staticVersion) {
      gl.bindBuffer(gl.ARRAY_BUFFER, sbuf);
      gl.bufferData(gl.ARRAY_BUFFER, job.stat.data, gl.STATIC_DRAW);
      staticVersion = job.stat.version; staticCount = job.stat.count;
    }
    setLightmap(job.lightmap);
    const rtx = Boolean(job.rtx && job.grid);
    if (rtx) setGrid(job.grid);
    if (job.sky) setSky(job.sky.key, job.sky);
    // Dynamic geometry: all parts in one buffer.
    let dynTotal = 0;
    for (const d of job.dyn) dynTotal += d.data.length;
    const mirrorDyn = job.mirror?.dyn ?? [];
    for (const d of mirrorDyn) dynTotal += d.data.length;
    const dynData = new Float32Array(Math.max(STRIDE, dynTotal));
    let off = 0;
    for (const d of [...job.dyn, ...mirrorDyn]) { dynData.set(d.data, off); d.first = off / STRIDE; d.count = d.data.length / STRIDE; off += d.data.length; }
    gl.bindBuffer(gl.ARRAY_BUFFER, dbuf);
    gl.bufferData(gl.ARRAY_BUFFER, dynData, gl.STREAM_DRAW);

    const texSamp = flags.mipmaps ? SAMP.mip : flags.bilinear ? SAMP.linear : SAMP.nearest;

    // Shadow map from the main lamp.
    const useShadow = Boolean(flags.shadows && job.shadow);
    if (useShadow) {
      shadowTarget();
      gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFbo);
      gl.viewport(0, 0, SHADOW, SHADOW);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.depthMask(true); gl.disable(gl.BLEND); gl.disable(gl.STENCIL_TEST);
      gl.colorMask(false, false, false, false);
      gl.useProgram(prog.shadow.p);
      gl.uniformMatrix4fv(prog.shadow.loc.uVP, false, job.shadow.VP);
      bindWorldAttribs(sbuf);
      for (const g of job.stat.groups) if (g.pass === 'opaque' && g.casts !== false) gl.drawArrays(gl.TRIANGLES, g.first, g.count);
      bindWorldAttribs(dbuf);
      for (const d of job.dyn) if (d.pass === 'opaque' && d.casts) gl.drawArrays(gl.TRIANGLES, d.first, d.count);
      gl.colorMask(true, true, true, true);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFbo.f);
    gl.viewport(0, 0, W, H);
    const fogC = job.fog?.color ?? [0, 0, 0];
    gl.clearColor(flags.fog ? fogC[0] : 0, flags.fog ? fogC[1] : 0, flags.fog ? fogC[2] : 0, 1);
    gl.clearDepth(1); gl.clearStencil(0);
    gl.depthMask(true); gl.stencilMask(0xff);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE); gl.disable(gl.POLYGON_OFFSET_FILL);

    const skyOn = Boolean(flags.skybox && job.sky);
    const drawSky = (VP, cam) => {
      if (!skyOn) return;
      gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
      gl.useProgram(prog.sky.p);
      const L = prog.sky.loc;
      gl.uniformMatrix4fv(L.uInvVP, false, invert(VP)); gl.uniform3fv(L.uCam, cam);
      gl.uniform1f(L.uZ, 0.999);
      gl.uniform4f(L.uFog, fogC[0], fogC[1], fogC[2], 1); gl.uniform1i(L.uUseFog, flags.fog ? 1 : 0);
      gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_CUBE_MAP, skyTex); gl.uniform1i(L.uSky, 5);
      gl.bindVertexArray(null);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.depthMask(true);
    };

    const useWorld = (VP, cam, clip = null) => {
      gl.useProgram(prog.world.p);
      const L = prog.world.loc;
      gl.uniformMatrix4fv(L.uVP, false, VP);
      gl.uniform3fv(L.uCam, cam);
      gl.uniform1f(L.uTime, job.time);
      gl.uniform1i(L.uUseLM, flags.polyLightmap ? 1 : 0);
      gl.uniform1i(L.uUseNM, flags.normalMaps ? 1 : 0);
      gl.uniform1i(L.uUseDetail, flags.detail ? 1 : 0);
      gl.uniform1i(L.uUseShadow, useShadow ? 1 : 0);
      gl.uniform1i(L.uDynColor, flags.dynLights ? 1 : 0);
      gl.uniform1i(L.uUseSky, skyOn ? 1 : 0);
      gl.uniform1i(L.uUseFog, flags.fog ? 1 : 0);
      gl.uniform1i(L.uOverride, 0);
      gl.uniform1i(L.uClipOn, clip ? 1 : 0);
      if (clip) gl.uniform4fv(L.uClip, clip);
      const lights = job.lights.slice(0, 8);
      gl.uniform1i(L.uNL, lights.length);
      if (lights.length) {
        const lp = new Float32Array(32), lc = new Float32Array(32);
        lights.forEach((l, i) => { lp.set([l.x, l.y, l.z, l.radius], i * 4); lc.set([l.color[0], l.color[1], l.color[2], l.intensity], i * 4); });
        gl.uniform4fv(L.uLP, lp); gl.uniform4fv(L.uLC, lc);
      }
      if (useShadow) {
        const s = job.shadow;
        gl.uniform4f(L.uSL, s.pos[0], s.pos[1], s.pos[2], s.radius);
        gl.uniform4f(L.uSLC, s.color[0], s.color[1], s.color[2], s.intensity);
        gl.uniformMatrix4fv(L.uSVP, false, s.VP);
        gl.uniform1f(L.uShadowTexel, 1 / SHADOW);
        gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, shadowTex); gl.bindSampler(4, SAMP.clampNearest); gl.uniform1i(L.uShadow, 4);
      }
      const f = job.fog ?? { color: [0, 0, 0], density: 0, height: 0, heightDensity: 0 };
      gl.uniform4f(L.uFog, f.color[0], f.color[1], f.color[2], f.density);
      gl.uniform3f(L.uFogH, f.height, f.heightDensity, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, lmTex ?? white); gl.bindSampler(1, SAMP.clampLinear); gl.uniform1i(L.uLM, 1);
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, detailTex); gl.bindSampler(3, SAMP.mip); gl.uniform1i(L.uDetail, 3);
      gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_CUBE_MAP, skyTex); gl.uniform1i(L.uSky, 5);
      gl.uniform1i(L.uTex, 0); gl.uniform1i(L.uNM, 2);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, flatNormal); gl.activeTexture(gl.TEXTURE4); if (!useShadow) gl.bindTexture(gl.TEXTURE_2D, white);
      gl.uniform1i(L.uRtx, rtx ? 1 : 0);
      if (rtx) {
        gl.uniform2f(L.uGridSize, gridTex.w, gridTex.h); gl.uniform1f(L.uFrame, frameNo % 64);
        ['uGrid', 'uGridF', 'uGridW', 'uGridC'].forEach((name, i) => { gl.activeTexture(gl.TEXTURE6 + i); gl.bindTexture(gl.TEXTURE_2D, gridTex.t[i]); gl.bindSampler(6 + i, null); gl.uniform1i(L[name], 6 + i); });
      }
    };
    const bindTex = (src, dirty) => {
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texFor(src, dirty)); gl.bindSampler(0, texSamp);
      if (flags.normalMaps) { gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, normalFor(src)); gl.bindSampler(2, texSamp); }
    };
    const dirty = job.dirty ?? new Set();
    const drawStaticGroup = (g) => { bindTex(g.tex, dirty.has(g.tex)); gl.drawArrays(gl.TRIANGLES, g.first, g.count); };
    const drawDyn = (d) => { bindTex(d.tex, d.dirty); gl.drawArrays(gl.TRIANGLES, d.first, d.count); };

    const mirror = flags.mirrors ? job.mirror : null;
    const stencilOn = Boolean(mirror);
    const opaquePass = (VP, cam, { painter, clip = null, dyn = job.dyn, skipMirror = false }) => {
      useWorld(VP, cam, clip);
      if (stencilOn && !clip) { gl.enable(gl.STENCIL_TEST); gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE); gl.stencilFunc(gl.ALWAYS, 0, 0xff); }
      if (!painter) {
        gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.depthMask(true);
        bindWorldAttribs(sbuf);
        for (const g of job.stat.groups) {
          if (g.pass !== 'opaque' || (skipMirror && g.mirror)) continue;
          if (g.mirror && stencilOn && !clip) gl.stencilFunc(gl.ALWAYS, 1, 0xff);
          drawStaticGroup(g);
          if (g.mirror && stencilOn && !clip) gl.stencilFunc(gl.ALWAYS, 0, 0xff);
        }
        bindWorldAttribs(dbuf);
        for (const d of dyn) if (d.pass === 'opaque') drawDyn(d);
        return;
      }
      // Painter's algorithm: every opaque triangle, far to near (depth is
      // written but never tested -- the last one drawn wins).
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.ALWAYS); gl.depthMask(true);
      const st = job.stat;
      const items = [];
      const nTri = st.count / 3;
      for (let t = 0; t < nTri; t++) {
        const g = st.groups[st.triGroup[t]];
        if (g.pass !== 'opaque' || (skipMirror && g.mirror)) continue;
        const dx = st.centroids[t * 3] - cam[0], dy = st.centroids[t * 3 + 1] - cam[1], dz = st.centroids[t * 3 + 2] - cam[2];
        items.push({ d: dx * dx + dy * dy + dz * dz, t, g: st.triGroup[t] });
      }
      for (const d of dyn) if (d.pass === 'opaque') { const c = d.center; const dx = c[0] - cam[0], dy = c[1] - cam[1], dz = c[2] - cam[2]; items.push({ d: dx * dx + dy * dy + dz * dz, dyn: d }); }
      items.sort((a, b) => b.d - a.d);
      const idx = new Uint32Array(nTri * 3);
      let n = 0;
      const runs = [];
      let run = null;
      for (const it of items) {
        if (it.dyn) { if (run) { runs.push(run); run = null; } runs.push({ dyn: it.dyn }); continue; }
        if (!run || run.g !== it.g) { if (run) runs.push(run); run = { g: it.g, start: n, count: 0 }; }
        idx[n++] = it.t * 3; idx[n++] = it.t * 3 + 1; idx[n++] = it.t * 3 + 2; run.count += 3;
      }
      if (run) runs.push(run);
      bindWorldAttribs(sbuf);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibuf);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx.subarray(0, n), gl.STREAM_DRAW);
      let bound = 's';
      for (const r of runs) {
        if (r.dyn) { if (bound !== 'd') { bindWorldAttribs(dbuf); bound = 'd'; } drawDyn(r.dyn); continue; }
        if (bound !== 's') { bindWorldAttribs(sbuf); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibuf); bound = 's'; }
        const g = st.groups[r.g];
        if (g.mirror && stencilOn && !clip) gl.stencilFunc(gl.ALWAYS, 1, 0xff);
        bindTex(g.tex, dirty.has(g.tex));
        gl.drawElements(gl.TRIANGLES, r.count, gl.UNSIGNED_INT, r.start * 4);
        if (g.mirror && stencilOn && !clip) gl.stencilFunc(gl.ALWAYS, 0, 0xff);
      }
      gl.depthMask(true); gl.depthFunc(gl.LESS);
    };

    const painter = !flags.zbuffer;
    drawSky(job.VP, job.cam);
    opaquePass(job.VP, job.cam, { painter });

    // Mirror: where the stencil says the glass is visible, clear depth and
    // draw the world reflected through the glass plane.
    if (mirror) {
      gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
      gl.stencilFunc(gl.EQUAL, 1, 0xff);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.ALWAYS); gl.depthMask(true); gl.colorMask(false, false, false, false);
      gl.useProgram(prog.fill.p); gl.uniform1f(prog.fill.loc.uZ, 1.0); gl.bindVertexArray(null); gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.colorMask(true, true, true, true);
      const R = reflection(mirror.n, mirror.d);
      const VPm = mul(job.VP, R);
      const camM = [job.cam[0], job.cam[1], job.cam[2]];
      gl.depthFunc(gl.LESS);
      opaquePass(VPm, camM, { painter: false, clip: [mirror.n[0], mirror.n[1], mirror.n[2], -mirror.d - 0.002], dyn: mirror.dyn, skipMirror: true });
      // A faint tint so the glass reads as glass.
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthFunc(gl.ALWAYS); gl.depthMask(false);
      useWorld(job.VP, job.cam); gl.uniform1i(prog.world.loc.uOverride, 1);
      bindWorldAttribs(sbuf);
      for (const g of job.stat.groups) if (g.mirror) gl.drawArrays(gl.TRIANGLES, g.first, g.count);
      gl.uniform1i(prog.world.loc.uOverride, 0);
      gl.disable(gl.BLEND); gl.disable(gl.STENCIL_TEST); gl.depthFunc(gl.LESS); gl.depthMask(true);
    }
    gl.disable(gl.STENCIL_TEST);

    // Decals and transparent surfaces.
    const blended = [];
    for (const g of job.stat.groups) if (g.pass === 'decal' || g.pass === 'trans') blended.push({ g, d: g.center ? dist2(g.center, job.cam) : 0 });
    for (const d of job.dyn) if (d.pass === 'decal' || d.pass === 'trans') blended.push({ dyn: d, d: d.center ? dist2(d.center, job.cam) : 0 });
    if (blended.length) {
      useWorld(job.VP, job.cam);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      if (painter) gl.disable(gl.DEPTH_TEST); else { gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); }
      // decals first (they lie on surfaces), then glass far to near
      blended.sort((a, b) => ((a.g ?? a.dyn).pass === 'decal' ? 0 : 1) - ((b.g ?? b.dyn).pass === 'decal' ? 0 : 1) || b.d - a.d);
      for (const b of blended) {
        const isDecal = (b.g ?? b.dyn).pass === 'decal';
        if (isDecal) { gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -4); } else gl.disable(gl.POLYGON_OFFSET_FILL);
        if (b.g) { bindWorldAttribs(sbuf); drawStaticGroup(b.g); } else { bindWorldAttribs(dbuf); drawDyn(b.dyn); }
      }
      gl.disable(gl.POLYGON_OFFSET_FILL); gl.disable(gl.BLEND); gl.depthMask(true); gl.depthFunc(gl.LESS);
    }

    // Particles: rain, sparks, the car's hazard lights.
    if (job.particles && job.particles.length) {
      const P = job.particles; const pd = new Float32Array(P.length * 8);
      P.forEach((p, i) => { const c = p.color >>> 0; pd.set([p.x, p.y, p.z, (c & 255) / 255, ((c >>> 8) & 255) / 255, ((c >>> 16) & 255) / 255, 1, p.size || 0.03], i * 8); });
      gl.bindVertexArray(pvao);
      gl.bindBuffer(gl.ARRAY_BUFFER, pbuf); gl.bufferData(gl.ARRAY_BUFFER, pd, gl.STREAM_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 12);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 32, 28);
      gl.useProgram(prog.pts.p);
      gl.uniformMatrix4fv(prog.pts.loc.uVP, false, job.VP); gl.uniform1f(prog.pts.loc.uF, job.F);
      if (painter) gl.disable(gl.DEPTH_TEST); else { gl.enable(gl.DEPTH_TEST); gl.depthMask(false); }
      gl.drawArrays(gl.POINTS, 0, P.length);
      gl.depthMask(true);
    }

    // Post: bloom and gamma.
    gl.disable(gl.DEPTH_TEST);
    let bloomK = 0;
    if (flags.bloom) {
      bloomK = 0.85;
      gl.bindFramebuffer(gl.FRAMEBUFFER, bloomA.f); gl.viewport(0, 0, bloomA.w, bloomA.h);
      gl.useProgram(prog.bright.p); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, sceneFbo.t); gl.bindSampler(0, SAMP.clampLinear);
      gl.uniform1i(prog.bright.loc.uSrc, 0); gl.uniform1f(prog.bright.loc.uThr, hdr ? 0.9 : 0.72);
      gl.bindVertexArray(null); gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.useProgram(prog.blur.p); gl.uniform1i(prog.blur.loc.uSrc, 0);
      for (let i = 0; i < 2; i++) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, bloomB.f); gl.bindTexture(gl.TEXTURE_2D, bloomA.t); gl.uniform2f(prog.blur.loc.uDir, (1 + i) / bloomA.w, 0); gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.bindFramebuffer(gl.FRAMEBUFFER, bloomA.f); gl.bindTexture(gl.TEXTURE_2D, bloomB.t); gl.uniform2f(prog.blur.loc.uDir, 0, (1 + i) / bloomA.h); gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, finalFbo.f); gl.viewport(0, 0, W, H);
    gl.useProgram(prog.final.p);
    const FL = prog.final.loc;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, sceneFbo.t); gl.bindSampler(0, SAMP.clampNearest); gl.uniform1i(FL.uSrc, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, bloomA.t); gl.bindSampler(1, SAMP.clampLinear); gl.uniform1i(FL.uBloom, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, sceneDepth); gl.bindSampler(2, SAMP.clampNearest); gl.uniform1i(FL.uDepth, 2);
    gl.uniform2f(FL.uNF, job.near ?? 0.04, job.far ?? 70);
    gl.uniform1f(FL.uBloomK, bloomK); gl.uniform1i(FL.uGamma, flags.bloom ? 1 : 0);
    gl.uniform1f(FL.uVig, flags.bloom ? 0.32 : flags.fog ? 0.2 : 0); gl.uniform1f(FL.uGrain, flags.bloom ? 0.025 : 0); gl.uniform1f(FL.uTime, job.time % 100);
    gl.bindVertexArray(null); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(job.out.buffer, job.out.byteOffset, W * H * 4));
    // unpack the depth from alpha, make the pixels opaque again
    const out = job.out, dep = job.depth;
    for (let i = 0; i < W * H; i++) {
      const c = out[i];
      if (dep) { const a = (c >>> 24) / 255; dep[i] = a >= 0.999 ? 1e9 : a * a * 30; }
      out[i] = (c | 0xff000000) >>> 0;
    }
    // leave no render target bound to a texture unit (feedback loops next frame)
    for (let i = 0; i < 10; i++) { gl.bindSampler(i, null); gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, null); }
    gl.activeTexture(gl.TEXTURE0);
    if (frameNo % 120 === 0) evict();
    return { staticCount };
  }

  return { gl, hdr, render, lost: () => gl.isContextLost() };
}

function dist2(a, b) { const x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2]; return x * x + y * y + z * z; }
export { MAT };
