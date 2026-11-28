// Dancers share a 22-bone skeleton and packed 30 fps tracks (quaternions ×1000, hips in cm).
// Licensed Mixamo capture is in anim/bboy.json. Original phrases use the same rig in anim/city-breaking.json.
// The low-poly body and clothes follow those bones. Look = HERO.topDown(level, acc).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { personShadows } from './city3d-perf.js?v=2';
import { addCityHead, cityLocs } from './city3d-head.js?v=10';
import { CITY_ANATOMY } from './city3d-anatomy.js?v=2';
import { FOLDED_HOOD } from './city3d-hood.js?v=1';
import { FINISH, characterFinish, loadCharacterFinish } from './city3d-character-finish.js?v=1';

let DATA = null;
const CLIPS = {};
// ROOT MOTION: the floor-plane travel of the hips is taken OUT of the tracks and moves the dancer instead (J.tick), so the
// next move starts where the last one ended — no snapping back to the centre (owner 14.11 «фигурка телепортируется за круг»).
// RM[name] = {xz: Float32Array (m), dur, fps, end: [x, z]}; looping plays use the detrended curve (travel removed) so loops stay in place.
const RM = {};
export async function loadMocap(url = 'anim/bboy.json?v=2') {
  if (DATA) return DATA;
  const [capture, authored] = await Promise.all([
    fetch(url).then(response => response.json()),
    fetch(new URL('./anim/city-breaking.json?v=7', import.meta.url))
      .then(response => response.ok ? response.json() : null).catch(() => null),
    loadCharacterFinish(),
  ]);
  DATA = capture;
  Object.assign(DATA.clips, authored);
  for (const n of [...MIRROR, ...Object.keys(authored || {})]) if (DATA.clips[n]) DATA.clips[n + '_M'] = mirrorClip(DATA.clips[n]);
  for (const [name, c] of Object.entries(DATA.clips)) {
    // how far the last frame is from the first: degrees of the most-turned bone (hips height: 1 cm ≈ .6°)
    const n = c.n, hp = c.t['Hips.p'], L = (n - 1) * 4;
    let seam = hp ? Math.abs(hp[(n - 1) * 3 + 1] - hp[1]) * .6 : 0;
    for (const [k, v] of Object.entries(c.t)) if (k.endsWith('.q')) { const d = Math.abs(v[0] * v[L] + v[1] * v[L + 1] + v[2] * v[L + 2] + v[3] * v[L + 3]) / (Math.hypot(v[0], v[1], v[2], v[3]) * Math.hypot(v[L], v[L + 1], v[L + 2], v[L + 3]) || 1);
      seam = Math.max(seam, 2 * Math.acos(Math.min(1, d)) * 180 / Math.PI); }
    // ALMOST-LOOPS (a toprock that ends a few degrees off its start, e.g. the Indian step 9.5°) are closed: the small difference is
    // spread over the whole clip (~0.1° a frame, invisible), so the loop no longer clicks once per round
    if (seam > .3 && seam <= 15) closeLoop(c);
    const times = Float32Array.from({ length: c.n }, (_, i) => i / c.fps), tracks = [];
    for (const [k, v] of Object.entries(c.t)) {
      const [bone, kind] = k.split('.');
      if (kind === 'p') {
        const xz = new Float32Array(c.n * 2), y = Float32Array.from(v, (x, i) => (i % 3 === 1 ? x / 100 : 0));
        for (let i = 0; i < c.n; i++) { xz[i * 2] = v[i * 3] / 100; xz[i * 2 + 1] = v[i * 3 + 2] / 100; }
        RM[name] = { xz, fps: c.fps, n: c.n, dur: (c.n - 1) / c.fps, end: [xz[(c.n - 1) * 2], xz[(c.n - 1) * 2 + 1]] };
        tracks.push(new THREE.VectorKeyframeTrack(bone + '.position', times, y));
      }
      else tracks.push(new THREE.QuaternionKeyframeTrack(bone + '.quaternion', times, Float32Array.from(v, x => x / 1000)));
    }
    CLIPS[name] = new THREE.AnimationClip(name, (c.n - 1) / c.fps, tracks);
    // ONE-SHOT clips: a recording whose last frame is far from its first (going down, a freeze, a transition) must never wrap
    // around — a frame late, it flashed back to its first pose for one frame (the cypher's dancer «jumped» up from the floor
    // between going down and footwork, 1 m in one frame). Played once, it holds its last frame until the next move fades in.
    CLIPS[name].userData = { seam, once: seam > 15 || name.startsWith('City_') };
  }
  gaitPrep();
  // Different standing loops share the same relaxed base. Keep the legs subtle so planted feet stay near their marks.
  makeStand('Stand', 'Bboy_Uprock', { a: .2, al: .07, sp: 1 });
  makeStand('Stand_Rock', 'Brooklyn_Uprock', { a: .32, al: .045, sp: .7 });
  makeStand('Stand_Bounce', 'Breakdance_Uprock_Var_1_M', { a: .27, al: .065, sp: .88 });
  makeStand('Stand_Calm', 'Walking', { a: .28, al: .07, sp: .45 });
  makeStand('Stand_Quiet', 'Bboy_Uprock_M', { a: .12, al: .035, sp: .52 });
  return DATA;
}
// MIRRORED MOVES «<name>_M» (owner 17.11.2026 «добавь вариаций футворка во время батлов (слишком однообразно начинают и делают всё)»):
// the same recording danced to the other side. The skeleton is symmetric (the rest pose of every Left bone = its Right bone reflected
// through the body's middle plane), so the reflection is exact: Left/Right tracks swap, each rotation (x, y, z, w) → (x, −y, −z, w), the
// hips go to −x. Checked in node: every joint of the copy = the original's joint on the other side reflected, error 0.0000 m.
// The names keep their stem, so TRAVEL / power / freeze tests and clipLen work as before.
const MIRROR = ['Breakdance_Footwork_1', 'Breakdance_Footwork_2', 'Breakdance_Footwork_3', 'Breakdance_Footwork_To_Freeze', 'Breakdance_Uprock_To_Ground',
  'Breakdance_Uprock', 'Breakdance_Uprock_Var_1', 'Breakdance_Uprock_Var_2', 'Bboy_Uprock', 'Brooklyn_Uprock', 'Crossleg_Freeze',
  // 22.11.2026: the freeze recordings too — the hero's new air / baby freezes (city3d-game.js HFREEZE, FDROP) to either side
  'Breakdance_Freeze_Var_1', 'Breakdance_Freeze_Var_2', 'Breakdance_Freeze_Var_3', 'Breakdance_Freeze_Var_4', 'Breakdance_Freezes'];
function mirrorClip(c) {
  const t = {};
  for (const [k, v] of Object.entries(c.t)) {
    const [bone, kind] = k.split('.'), to = bone.replace(/^(Left|Right)/, s => (s === 'Left' ? 'Right' : 'Left')) + '.' + kind;
    t[to] = kind === 'q' ? v.map((x, i) => (i % 4 === 1 || i % 4 === 2 ? -x : x)) : v.map((x, i) => (i % 3 === 0 ? -x : x));
  }
  return { n: c.n, fps: c.fps, t };
}
// spread the difference between the last and the first frame over the clip: q'(i) = slerp(1, q0·q_last⁻¹, i/(n-1)) · q(i); hips height likewise
function closeLoop(c) {
  const n = c.n, q0 = new THREE.Quaternion(), ql = new THREE.Quaternion(), d = new THREE.Quaternion(), di = new THREE.Quaternion(), q = new THREE.Quaternion(), I = new THREE.Quaternion();
  for (const [k, v] of Object.entries(c.t)) {
    if (k.endsWith('.q')) { const L = (n - 1) * 4, out = new Array(v.length);
      q0.fromArray(v, 0).normalize(); ql.fromArray(v, L).normalize(); if (q0.dot(ql) < 0) ql.set(-ql.x, -ql.y, -ql.z, -ql.w); d.copy(q0).multiply(ql.invert());
      for (let i = 0; i < n; i++) { q.fromArray(v, i * 4).normalize(); di.copy(I).slerp(d, i / (n - 1)); di.multiply(q); out[i * 4] = di.x * 1000; out[i * 4 + 1] = di.y * 1000; out[i * 4 + 2] = di.z * 1000; out[i * 4 + 3] = di.w * 1000; }
      c.t[k] = out; }
    else if (k === 'Hips.p') { const e = v[(n - 1) * 3 + 1] - v[1]; c.t[k] = v.map((x, j) => (j % 3 === 1 ? x - e * Math.floor(j / 3) / (n - 1) : x)); }
  }
}
// ---------- WALK / RUN from real motion capture (owner 16.11.2026 «улучши бег (выглядит не естественно)») ----------
// Mixamo «Walking» (1.78 m/s, 1.84 m per loop) and «Running» (5.92 m/s, 3.75 m per loop); one loop = two steps. The owner
// downloaded both from his Mixamo account (17.11.2026), converted by tools/mocap (same maths as FBXLoader, checked track by track).
// gaitPose(ph, wr): the whole body at gait phase ph (0…1, 0 = left foot furthest ahead) as a blend of the walk and the run
// (wr 0…1). The travel along the clip is removed (the caller moves the person and advances ph by the distance covered —
// no skating); the hips keep their bob, sway and surge.
const GAIT = { Walking: { ph0: 8 / 31 }, Running: { ph0: 4 / 19 } }, GP = { q: {}, x: 0, y: 1, z: 0 };
export const GAIT_BONES = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
  'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase'];
function gaitPrep() {
  for (const [name, g] of Object.entries(GAIT)) {
    const c = DATA.clips[name]; if (!c) return;
    const n = c.n, hp = c.t['Hips.p'], ex = hp[(n - 1) * 3] / 100, ez = hp[(n - 1) * 3 + 2] / 100;
    g.n = n; g.len = Math.hypot(ex, ez); g.v = g.len / ((n - 1) / c.fps); g.q = {}; g.x = new Float32Array(n); g.y = new Float32Array(n); g.z = new Float32Array(n);
    for (let i = 0; i < n; i++) { const u = i / (n - 1); g.x[i] = hp[i * 3] / 100 - ex * u; g.y[i] = hp[i * 3 + 1] / 100; g.z[i] = hp[i * 3 + 2] / 100 - ez * u; }
    for (const b of GAIT_BONES) { const v = c.t[b + '.q'], a = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) { const o = i * 4, l = Math.hypot(v[o], v[o + 1], v[o + 2], v[o + 3]) || 1; for (let j = 0; j < 4; j++) a[o + j] = v[o + j] / l; }
      g.q[b] = a; }
  }
  for (const b of GAIT_BONES) GP.q[b] = new THREE.Quaternion();
  GAIT.ok = true;
}
export const gaitInfo = () => (GAIT.ok ? { walk: GAIT.Walking, run: GAIT.Running } : null);
// ---------- STANDING (owner 17.11.2026 «улучши движения фигурок пока те находятся на месте (сейчас они глючат слегка)») ----------
// Everybody who stood still used to loop «Breakdance_Ready» — but that recording is not an idle: it is a one-second SIDESTEP into the
// ready stance (the hips travel 43 cm, the left hand turns 52°). Looped, every standing person jerked back by up to 38° once a second.
// Now a standing person plays a seamless loop made from a REAL looping recording, played softly on top of the calm start of «Ready»:
// q = slerp(start pose, recorded frame, a) — the timing, the weight shift and the rhythm stay recorded, only the size is smaller (no
// hand-posed angles). makeStand(name, src, { a, al, legs }) builds it as a normal clip (CLIPS[name], loops seamlessly because the source
// does) + a table for standAt() (the walking gait blends over it). a = upper body, al = hips and legs (small, or the feet would skate).
const STANDS = {}, LEG_B = /Hips|UpLeg|Leg$|Foot|ToeBase/;
export function makeStand(name, src, o = {}) {
  const c = DATA && DATA.clips[src], r = DATA && DATA.clips.Breakdance_Ready; if (!c || !r) return null;
  const n = c.n, base = poseOf('Breakdance_Ready', .05), hp = c.t['Hips.p'], a = o.a ?? .2, al = o.al ?? .06, S = { n, fps: c.fps, q: {}, x: new Float32Array(n), y: new Float32Array(n), z: new Float32Array(n) };
  const ex = hp[(n - 1) * 3] - hp[0], ez = hp[(n - 1) * 3 + 2] - hp[2]; let mx = 0, mz = 0;
  for (let i = 0; i < n; i++) { const u = i / (n - 1); S.x[i] = (hp[i * 3] - hp[0] - ex * u) / 100; S.z[i] = (hp[i * 3 + 2] - hp[2] - ez * u) / 100; mx += S.x[i] / n; mz += S.z[i] / n; }
  for (let i = 0; i < n; i++) { S.x[i] = (S.x[i] - mx) * al; S.z[i] = (S.z[i] - mz) * al; S.y[i] = base.y + (hp[i * 3 + 1] / 100 - base.y) * al; }
  const times = Float32Array.from({ length: n }, (_, i) => i / c.fps), tracks = [], q = new THREE.Quaternion(), b0 = new THREE.Quaternion();
  for (const bn of GAIT_BONES) { const v = c.t[bn + '.q']; if (!v || !base.q[bn]) continue; const k = LEG_B.test(bn) ? al : a, out = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { q.set(v[i * 4], v[i * 4 + 1], v[i * 4 + 2], v[i * 4 + 3]).normalize(); b0.copy(base.q[bn]); if (b0.dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w); b0.slerp(q, k).toArray(out, i * 4); }
    S.q[bn] = out; tracks.push(new THREE.QuaternionKeyframeTrack(bn + '.quaternion', times, out)); }
  // hips: the small sway stays IN the clip (no root motion — a standing person does not travel)
  tracks.push(new THREE.VectorKeyframeTrack('Hips.position', times, Float32Array.from({ length: n * 3 }, (_, j) => [S.x, S.y, S.z][j % 3][Math.floor(j / 3)])));
  S.sp = o.sp || 1; CLIPS[name] = new THREE.AnimationClip(name, (n - 1) / c.fps, tracks); STANDS[name] = S;
  return S;
}
export const isStand = n => !!STANDS[n];
// the standing pose of a stand clip at time t (seconds, loops): { q: {bone: Quaternion}, x, y, z } — the base under the walking gait
const SP = { q: {}, x: 0, y: 1, z: 0 }, _sa = new Float32Array(4);
export function standAt(name, t) {
  const S = STANDS[name]; if (!S) return null;
  const f = (((t * S.fps) % (S.n - 1)) + (S.n - 1)) % (S.n - 1), i = Math.min(S.n - 2, Math.floor(f)), k = f - i, lin = a => a[i] + (a[i + 1] - a[i]) * k;
  for (const bn in S.q) { THREE.Quaternion.slerpFlat(_sa, 0, S.q[bn], i * 4, S.q[bn], i * 4 + 4, k); (SP.q[bn] || (SP.q[bn] = new THREE.Quaternion())).fromArray(_sa); }
  SP.x = lin(S.x); SP.y = lin(S.y); SP.z = lin(S.z); return SP;
}
const _ga = new Float32Array(4), _gb = new Float32Array(4), _gc = new Float32Array(4), _gd = new Float32Array(4);
const gFrame = (g, ph) => { const f = ((ph + g.ph0) % 1 + 1) % 1 * (g.n - 1), i = Math.min(g.n - 2, Math.floor(f)); return [i, f - i]; };
export function gaitPose(ph, wr) {
  const W = GAIT.Walking, Rn = GAIT.Running, [iw, kw] = gFrame(W, ph), [ir, kr] = gFrame(Rn, ph), lin = (a, i, k) => a[i] + (a[i + 1] - a[i]) * k;
  for (const b of GAIT_BONES) {
    const qw = W.q[b], qr = Rn.q[b];
    THREE.Quaternion.slerpFlat(_ga, 0, qw, iw * 4, qw, iw * 4 + 4, kw);
    if (wr > 0) { THREE.Quaternion.slerpFlat(_gb, 0, qr, ir * 4, qr, ir * 4 + 4, kr); THREE.Quaternion.slerpFlat(_gc, 0, _ga, 0, _gb, 0, wr); GP.q[b].fromArray(_gc); }
    else GP.q[b].fromArray(_ga);
  }
  const m = (k1, k2) => k1 + (k2 - k1) * wr;
  GP.x = m(lin(W.x, iw, kw), lin(Rn.x, ir, kr)); GP.y = m(lin(W.y, iw, kw), lin(Rn.y, ir, kr)); GP.z = m(lin(W.z, iw, kw), lin(Rn.z, ir, kr));
  return GP;
}
export const getClip = n => CLIPS[n];
export const clipLen = n => (CLIPS[n] ? CLIPS[n].duration : 0);
export const hasClip = n => !!CLIPS[n];
// a still pose of a clip at time t: {bone: Quaternion}, hips height — used as the fixed base under the walking gait
export function poseOf(name, t) {
  const c = CLIPS[name], out = { q: {}, y: 1 }; if (!c) return out;
  for (const tr of c.tracks) { const [bn, pr] = tr.name.split('.'), v = tr.createInterpolant().evaluate(t);
    if (pr === 'quaternion') out.q[bn] = new THREE.Quaternion(v[0], v[1], v[2], v[3]).normalize(); else out.y = v[1]; }
  return out;
}
// floor position of the hips at time t (loop = travel removed so the loop closes)
function rmAt(r, t, loop, out) {
  t = Math.max(0, Math.min(r.dur, t)); const f = t * r.fps, i = Math.min(r.n - 2, Math.floor(f)), k = f - i;
  out[0] = r.xz[i * 2] + (r.xz[i * 2 + 2] - r.xz[i * 2]) * k; out[1] = r.xz[i * 2 + 1] + (r.xz[i * 2 + 3] - r.xz[i * 2 + 1]) * k;
  if (loop) { const u = t / r.dur; out[0] -= r.end[0] * u; out[1] -= r.end[1] * u; }
  return out;
}
const lerpTo = (a, b, dt, k) => a + (b - a) * (1 - Math.exp(-dt * k));
const _a = [0, 0], _b = [0, 0], TRAVEL = /To_Ground|Footwork|Freeze|Headspin_Start|Headspin_End|Ending|^City_/;

const mats = new Map();
// NO GLARE ON PEOPLE (owner 17.11.2026 «снизь отблик от фонарей… сильный пересвет, будто зеркало на кроссовках отражает полностью»).
// Under a lamp plus the crew's fill light a white tee / white sole came out at 1.2–1.6 (HDR) — burnt white after the tone curve, and over
// the bloom threshold (.84), so it grew a halo like a mirror catching the lamp. Now the brightness of everything a PERSON wears is
// rolled off softly above .5 and can never pass .8: mid and dark colours are untouched, light ones keep their folds and shading,
// nothing on a person blooms. The glowing custom details (glowOf) are left out on purpose — they are meant to glow.
const TAME_FN = 'vec3 tameHi(vec3 c){ float l = dot(c, vec3(.299, .587, .114)); if (l <= .5) return c; return c * ((.5 + (l - .5) / (1. + (l - .5) / .3)) / l); }\n';
const tameShader = sh => { sh.fragmentShader = sh.fragmentShader.replace('void main() {', TAME_FN + 'void main() {').replace('#include <opaque_fragment>', 'outgoingLight = tameHi(outgoingLight);\n  #include <opaque_fragment>'); };
const tame = m => { m.onBeforeCompile = tameShader; return m; };
function material(c, roughness, metalness, vertexColors, finish) {
  const key = [c,roughness,metalness,vertexColors,finish].join(':');
  if (!mats.has(key)) {
    const styled = tame(new THREE.MeshStandardMaterial({color:c,roughness,metalness,vertexColors}));
    styled.userData.finish = finish;
    mats.set(key,styled);
  }
  return mats.get(key);
}
const M = (c,r=.8,m=0,finish=FINISH.clean) => material(c,r,m,false,finish);
const UP = new THREE.Vector3(0, 1, 0);
// a limb piece from the bone's origin to its child's rest position
function seg(bone, to, r, mat, r2) {
  const len = to.length(), m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(.01, len - r * 1.4), 5, 16), mat);
  m.scale.set(1, 1, (r2 || r) / r);
  m.quaternion.setFromUnitVectors(UP, to.clone().normalize()); m.position.copy(to).multiplyScalar(.5);
  bone.add(m); return m;
}
// ---------- ONE SMOOTH BODY (owner 16.11.2026 «улучши визуализацию человечков (меньше шарнирности)») ----------
// The torso, arms and legs used to be separate capsules and boxes hung on the bones — every elbow, knee, shoulder and the
// waist showed as a hinge. Sleeve openings and the two trouser legs share vertices with their garment.
// Half-angle bend bones support elbows, knees and shoulders. Cloth and its details are skinned on the mocap rig.
const _p = new THREE.Vector3(), _c1 = new THREE.Color(), _c2 = new THREE.Color();
const SKIN_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .82 });
// a soft rim of light on the edges of the body: a figure reads as one shape against the dark asphalt when seen from above.
// 17.11.2026: the rim is mostly for DARK clothes — on white (soles seen edge-on from above, a white tee) it only added glare,
// so it fades to 30 % on light colours; then the same soft roll-off as every other piece of clothing (tameHi above).
// 22.11.2026: the body also carries the person's rigid pieces (mergeParts): per-vertex roughness / metalness (rm) and rim (1 = the body's
// cloth, 0 = a rigid piece, which never had the rim) — so the whole person is ONE draw call
SKIN_MAT.onBeforeCompile = sh => {
  sh.vertexShader = sh.vertexShader.replace('void main() {', 'attribute vec2 rm;\nattribute float rim;\nvarying vec2 vRM;\nvarying float vRim;\nvoid main() {\n  vRM = rm; vRim = rim;');
  sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'varying vec2 vRM;\nvarying float vRim;\n' + TAME_FN + 'void main() {')
    .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vRM.x;').replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vRM.y;')
    .replace('#include <opaque_fragment>',
  'float rimK = vRim * pow(1. - clamp(dot(normalize(normal), normalize(vViewPosition)), 0., 1.), 2.4) * (1. - .7 * smoothstep(.15, .6, dot(diffuseColor.rgb, vec3(.299, .587, .114))));\n  outgoingLight += diffuseColor.rgb * rimK * vec3(.62, .68, .86) * .5;\n  outgoingLight += vFinishMix.y * diffuseColor.rgb * vec3(.127, .080, .066);\n  outgoingLight = tameHi(outgoingLight);\n  #include <opaque_fragment>');
  characterFinish(sh);
};
SKIN_MAT.customProgramCacheKey = () => 'skin3';
const shadeOf = (c, k) => '#' + _c1.set(c).multiplyScalar(k).getHexString(), mixOf = (c, c2, k) => '#' + _c1.set(c).lerp(_c2.set(c2), k).getHexString();
// ---------- SPEED, 22.11.2026 (owner «проверь почему город притормаживает») ----------
// 1) ONE shadow-depth material for every skinned piece. three.js draws all shadow casters with ONE shared depth material; each time it
//    went from a skinned body to a rigid piece (head, cap, the merged shadow pieces on the bones) and back, it re-derived that material's
//    program (a big parameter object + a long key string): ~50 times a frame in the yard, every frame — CPU time and ~100 KB of garbage
//    a frame for the phone to collect. With their own depth material the skinned pieces never switch it.
export const DEPTH_SKIN = new THREE.MeshDepthMaterial();
// 2) A PERSON'S RIGID PIECES AS ONE SKINNED PIECE. Head, hair, cap, eyes, ears, brows, laces, chain… were ~14 separate meshes a person —
//    ~14 draw calls each frame (+ their shadows); 21 people in the yard ≈ 300 of the ~400 draw calls. Now all of them that use the plain
//    clothing materials (M / MV) are baked into one mesh on the SAME skeleton: every vertex follows the bone its piece hung on (weight
//    1, so it moves exactly as before), the piece's colour / roughness / metalness ride on the vertices (PARTS). The originals stay in the
//    tree (ground contact points use them) but are drawn nowhere (layers off). Glowing custom details and sewn patches stay separate.
const PARTS_SHADER = sh => {
  sh.vertexShader = sh.vertexShader.replace('void main() {', 'attribute vec2 rm;\nvarying vec2 vRM;\nvoid main() {\n  vRM = rm;');
  sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'varying vec2 vRM;\n' + TAME_FN + 'void main() {')
    .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vRM.x;').replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vRM.y;')
    .replace('#include <opaque_fragment>', 'outgoingLight = tameHi(outgoingLight);\n  #include <opaque_fragment>');
  characterFinish(sh);
};
const PARTS = [THREE.FrontSide, THREE.DoubleSide].map(side => { const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, side });
  m.onBeforeCompile = PARTS_SHADER; m.customProgramCacheKey = () => 'parts2'; return m; });
const _rel = new THREE.Matrix4(), _inv = new THREE.Matrix4(), _nm = new THREE.Matrix3(), _pv = new THREE.Vector3(), _pc = new THREE.Color();
function mergeParts(rig, body) {
  rig.updateMatrixWorld(true); _inv.copy(rig.matrixWorld).invert();
  const bones = body.skeleton.bones, groups = [[], []];
  const shown = o => { for (let q = o; q && q !== rig; q = q.parent) if (!q.visible) return false; return true; };
  rig.traverse(o => {
    if (!o.isMesh || o.isSkinnedMesh || o.userData.shadowBatch || !shown(o)) return;
    const m = o.material, g = o.geometry;
    if (!m || Array.isArray(m) || !m.isMeshStandardMaterial || m.onBeforeCompile !== tameShader || m.map || m.alphaMap || m.transparent || m.opacity < 1 || m.polygonOffset
      || m.side === THREE.BackSide || (m.emissive && m.emissive.getHex())) return;
    if (!g || !g.attributes.position || !g.attributes.normal || g.morphAttributes.position) return;
    let b = o.parent; while (b && !b.isBone) b = b.parent; const bi = b ? bones.indexOf(b) : -1; if (bi < 0) return;
    groups[m.side === THREE.DoubleSide ? 1 : 0].push({ o, g, m, bi });
  });
  // bake a list of pieces into flat arrays, `base` = the first vertex number they will get
  const bake = (list, base) => {
    let nv = 0, ni = 0; for (const { g } of list) { const n = g.attributes.position.count; nv += n; ni += g.index ? g.index.count : n; }
    const A = { nv, ni, P: new Float32Array(nv * 3), N: new Float32Array(nv * 3), C: new Float32Array(nv * 3), RM: new Float32Array(nv * 2), RIM: new Float32Array(nv), FM: new Uint8Array(nv * 4), SI: new Uint16Array(nv * 4), SW: new Float32Array(nv * 4), I: new Uint32Array(ni) };
    let vo = 0, io = 0;
    for (const { o, g, m, bi } of list) {
      _rel.multiplyMatrices(_inv, o.matrixWorld); _nm.getNormalMatrix(_rel); const flip = _rel.determinant() < 0;
      const pa = g.attributes.position, na = g.attributes.normal, ca = m.vertexColors ? g.attributes.color : null, n = pa.count;
      const finish = m.userData.finish;
      for (let i = 0; i < n; i++) {
        const j = vo + i;
        _pv.fromBufferAttribute(pa, i).applyMatrix4(_rel); A.P[j * 3] = _pv.x; A.P[j * 3 + 1] = _pv.y; A.P[j * 3 + 2] = _pv.z;
        _pv.fromBufferAttribute(na, i).applyMatrix3(_nm).normalize(); A.N[j * 3] = _pv.x; A.N[j * 3 + 1] = _pv.y; A.N[j * 3 + 2] = _pv.z;
        _pc.copy(m.color); if (ca) { _pc.r *= ca.getX(i); _pc.g *= ca.getY(i); _pc.b *= ca.getZ(i); }
        A.C[j * 3] = _pc.r; A.C[j * 3 + 1] = _pc.g; A.C[j * 3 + 2] = _pc.b; A.RM[j * 2] = m.roughness; A.RM[j * 2 + 1] = m.metalness; A.SI[j * 4] = bi; A.SW[j * 4] = 1;
        if (finish >= 0) A.FM[j * 4 + finish] = 255;
      }
      const ix = g.index, cnt = ix ? ix.count : n;
      for (let k = 0; k < cnt; k += 3) { const a = ix ? ix.getX(k) : k, b = ix ? ix.getX(k + 1) : k + 1, c = ix ? ix.getX(k + 2) : k + 2;
        A.I[io++] = base + vo + a; if (flip) { A.I[io++] = base + vo + c; A.I[io++] = base + vo + b; } else { A.I[io++] = base + vo + b; A.I[io++] = base + vo + c; } }
      vo += n;
    }
    return A;
  };
  const geoOf = (A, idx) => { const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(A.P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(A.N, 3)); g.setAttribute('color', new THREE.BufferAttribute(A.C, 3));
    g.setAttribute('rm', new THREE.BufferAttribute(A.RM, 2)); g.setAttribute('rim', new THREE.BufferAttribute(A.RIM, 1)); g.setAttribute('skinIndex', new THREE.BufferAttribute(A.SI, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(A.SW, 4));
    g.setAttribute('finishMix', new THREE.BufferAttribute(A.FM,4,true));
    const nv = A.P.length / 3; g.setIndex(new THREE.BufferAttribute(nv > 65535 ? idx : Uint16Array.from(idx), 1)); return g; };
  const hide = list => { for (const { o } of list) { o.layers.disableAll(); o.castShadow = false; o.userData.merged = true; delete o.userData.tiny; } };
  const out = [];
  // one-sided pieces go INTO the body itself (one draw call for the whole person); the body's cloth keeps its rim (rim 1), the pieces don't
  if (groups[0].length) {
    const bg = body.geometry, nb = bg.attributes.position.count, A = bake(groups[0], nb), nv = nb + A.nv;
    const cat = (name, data) => {
      const {array,itemSize} = bg.attributes[name], out = new array.constructor(nv * itemSize);
      out.set(array); out.set(data, nb * itemSize);
      return out;
    };
    const M2 = {P:cat('position',A.P),N:cat('normal',A.N),C:cat('color',A.C),RM:cat('rm',A.RM),
      RIM:cat('rim',A.RIM),FM:cat('finishMix',A.FM),SI:cat('skinIndex',A.SI),SW:cat('skinWeight',A.SW)};
    const bi = bg.index.array, idx = new Uint32Array(bi.length + A.I.length); idx.set(bi); idx.set(A.I, bi.length);
    const g = geoOf(M2, idx); bg.dispose(); body.geometry = g; body.userData.parts = groups[0].length; hide(groups[0]);
  }
  // two-sided pieces (a brim seen from below, an open band) — their own skinned piece on the same bones (cull off both ways)
  if (groups[1].length >= 2) {
    const A = bake(groups[1], 0), sm = new THREE.SkinnedMesh(geoOf(A, A.I), PARTS[1]); sm.name = 'parts2'; sm.boundingSphere = body.boundingSphere.clone();
    sm.castShadow = sm.receiveShadow = true; sm.customDepthMaterial = DEPTH_SKIN; sm.userData.parts = groups[1].length;
    rig.add(sm); sm.bind(body.skeleton, body.bindMatrix); hide(groups[1]); out.push(sm);
  }
  // what is left (glowing trims, sewn patches — special materials) is merged PER MATERIAL: the ~20 glowing strips of a fully tailored hero are
  // one draw, the two sleeve patches one draw. Same material object, so they look exactly as before.
  const left = new Map();
  rig.traverse(o => {
    if (!o.isMesh || o.isSkinnedMesh || o.userData.shadowBatch || o.userData.merged || !shown(o)) return;
    const m = o.material, g = o.geometry; if (!m || Array.isArray(m) || m.transparent || m.polygonOffset || !g || !g.attributes.position || !g.attributes.normal || g.morphAttributes.position) return;
    if (m.map && !g.attributes.uv) return;
    let b = o.parent; while (b && !b.isBone) b = b.parent; const bi = b ? bones.indexOf(b) : -1; if (bi < 0) return;
    let L = left.get(m); if (!L) left.set(m, L = []); L.push({ o, g, m, bi });
  });
  for (const [m, list] of left) {
    if (list.length < 2) continue;
    let nv = 0, ni = 0; for (const { g } of list) { const n = g.attributes.position.count; nv += n; ni += g.index ? g.index.count : n; }
    const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), UV = m.map ? new Float32Array(nv * 2) : null, SI = new Uint16Array(nv * 4), SW = new Float32Array(nv * 4), I = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let vo = 0, io = 0;
    for (const { o, g, bi } of list) {
      _rel.multiplyMatrices(_inv, o.matrixWorld); _nm.getNormalMatrix(_rel); const flip = _rel.determinant() < 0, pa = g.attributes.position, na = g.attributes.normal, ua = g.attributes.uv, n = pa.count;
      for (let i = 0; i < n; i++) { const j = vo + i;
        _pv.fromBufferAttribute(pa, i).applyMatrix4(_rel); P[j * 3] = _pv.x; P[j * 3 + 1] = _pv.y; P[j * 3 + 2] = _pv.z;
        _pv.fromBufferAttribute(na, i).applyMatrix3(_nm).normalize(); N[j * 3] = _pv.x; N[j * 3 + 1] = _pv.y; N[j * 3 + 2] = _pv.z;
        if (UV) { UV[j * 2] = ua.getX(i); UV[j * 2 + 1] = ua.getY(i); } SI[j * 4] = bi; SW[j * 4] = 1; }
      const ix = g.index, cnt = ix ? ix.count : n;
      for (let k = 0; k < cnt; k += 3) { const a = ix ? ix.getX(k) : k, b = ix ? ix.getX(k + 1) : k + 1, c = ix ? ix.getX(k + 2) : k + 2;
        I[io++] = vo + a; if (flip) { I[io++] = vo + c; I[io++] = vo + b; } else { I[io++] = vo + b; I[io++] = vo + c; } }
      vo += n;
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    if (UV) geo.setAttribute('uv', new THREE.BufferAttribute(UV, 2)); geo.setAttribute('skinIndex', new THREE.BufferAttribute(SI, 4)); geo.setAttribute('skinWeight', new THREE.BufferAttribute(SW, 4)); geo.setIndex(new THREE.BufferAttribute(I, 1));
    const sm = new THREE.SkinnedMesh(geo, m); sm.name = 'parts-' + (m.name || m.type); sm.boundingSphere = body.boundingSphere.clone();
    sm.castShadow = list.some(x => x.o.castShadow); sm.receiveShadow = true; sm.customDepthMaterial = DEPTH_SKIN; sm.userData.parts = list.length;
    rig.add(sm); sm.bind(body.skeleton, body.bindMatrix); hide(list); out.push(sm);
  }
  return out;
}
// Blender loft sections: distance from pivot, forward radius, lateral radius (metres).
const ELBOW_PROFILE = [[-0.07, 0.057, 0.052], [-0.046, 0.053, 0.049], [-0.023, 0.048, 0.047], [0, 0.045, 0.045], [0.026, 0.048, 0.044], [0.055, 0.054, 0.047], [0.09, 0.055, 0.049], [0.135, 0.05, 0.045], [0.17, 0.043, 0.04]];
const KNEE_PROFILE = [[-0.045, 0.084, 0.08], [-0.022, 0.081, 0.077], [0, 0.079, 0.074], [0.022, 0.077, 0.072], [0.045, 0.073, 0.07]];

// Centre rings follow half of the joint rotation. Interpolating the rotation
// before skinning preserves thickness even when the dancer folds a limb tightly.
function bendBone(joint) {
  const helper = new THREE.Bone();
  const rest = joint.quaternion.clone().normalize();
  helper.position.copy(joint.position);
  helper.name = joint.name + 'Bend';
  helper.updateMatrix = function () {
    this.quaternion.copy(rest).slerp(joint.quaternion, .5);
    THREE.Bone.prototype.updateMatrix.call(this);
  };
  joint.parent.add(helper);
  return helper;
}
const BADGE_DISC = new THREE.CircleGeometry(1, 24);
function skinGeo(skinColor) {
  const pos = [], col = [], roughness = [], surfaces = [], si = [], sw = [], idx = [], seams = [], G = { n: 0 };
  const weights = (indices, strengths, vertex, influences) => {
    const total = influences.reduce((sum, [, value]) => sum + value, 0);
    for (let k = 0; k < 4; k++) {
      const [bone, value] = influences[k] || [0, 0];
      indices[vertex * 4 + k] = bone;
      strengths[vertex * 4 + k] = value / total;
    }
  };
  // sh = brightness of the vertex colour (painted shade: darker under the arms, between the legs, under a hem)
  const vert = (p,c,w,sh=1,rough,kind=c===skinColor ? FINISH.skin : FINISH.cloth) => {
    pos.push(p.x,p.y,p.z); _c1.set(c);
    col.push(_c1.r*sh,_c1.g*sh,_c1.b*sh);
    roughness.push(rough ?? (kind === FINISH.skin ? .72 : .89));
    surfaces.push(kind);
    weights(si,sw,G.n,w);
    return G.n++;
  };
  // n points of a (super)ellipse around c in the plane (u, v); u × v must point along the limb. ao = [brightness, darker towards +u, darker towards +v]
  G.ring = (c, u, v, ru, rv, color, w, n, e = 1, ao, fold, clothRoughness) => { const i0 = G.n; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, cs = Math.cos(a), sn = Math.sin(a);
    const drape = color === skinColor ? 0 : (fold?.(a) || 0);
    const shade = ao ? ao[0] * (1 - Math.max(0, cs * ao[1] + sn * ao[2])) : 1;
    vert(_p.copy(c).addScaledVector(u, Math.sign(cs) * Math.pow(Math.abs(cs), e) * (ru+drape))
      .addScaledVector(v, Math.sign(sn) * Math.pow(Math.abs(sn), e) * (rv+drape)), color, w, shade*(1+5*drape), color===skinColor ? undefined : clothRoughness); } return { i0, n }; };
  // a ring of any shape: points, a colour (or one per point), weights (or a list per point), brightness per point
  G.loop = (pts, cols, ws, shs, rough, kind) => { const i0 = G.n; pts.forEach((p, i) => vert(p, Array.isArray(cols) ? cols[i] : cols, Array.isArray(ws[0][0]) ? ws[i] : ws, shs ? shs[i] : 1, rough, kind)); return { i0, n: pts.length }; };
  G.fingers = (place, palette, bone, reverse) => {
    const { positions, indices, slots } = CITY_ANATOMY.hand;
    const cache = new Map();
    const vertex = (i, slot) => {
      const key = i * 3 + slot;
      if (!cache.has(key)) {
        const k = 3 * i;
        cache.set(key, vert(place(positions[k], positions[k+1], positions[k+2]), palette[slot], [[bone,1]], 1,
          slot === 2 ? .64 : undefined, slot === 0 ? undefined : FINISH.skin));
      }
      return cache.get(key);
    };
    slots.forEach((slot, i) => {
      const start = i * 3, color = palette[0] === palette[1] && slot === 0 ? 1 : slot;
      const a = vertex(indices[start], color), b = vertex(indices[start+1], color), c = vertex(indices[start+2], color);
      if (reverse) idx.push(a, c, b);
      else idx.push(a, b, c);
    });
  };
  G.locMesh = (geometry, matrix, color, weightsAt) => {
    const start = G.n, p = geometry.attributes.position, c = geometry.attributes.color, point = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      point.fromBufferAttribute(p,i).applyMatrix4(matrix);
      vert(point,color,weightsAt(p.getY(i)),c.getX(i),.87,FINISH.hair);
    }
    for (const i of geometry.index.array) idx.push(start+i);
  };
  const face = (a, b, c, d) => idx.push(a, b, c, b, d, c);
  G.join = (a, b, openings) => {
    for (let i = 0; i < a.n; i++) {
      if (openings?.some(start => i >= start && i < start + 4)) continue;
      const j = (i + 1) % a.n;
      face(a.i0 + i, a.i0 + j, b.i0 + i, b.i0 + j);
    }
  };
  // A sleeve or trouser leg continues the edge of the torso. Choose the cyclic offset
  // with the shortest links so that the two loops join without twisting.
  function stitchLoops(boundary, ring, offset) {
    const outer = i => boundary[i%boundary.length], inner = i => ring.i0+(i+offset)%ring.n;
    let i = 0, j = 0;
    while (i < boundary.length || j < ring.n) {
      const a = (i+1)*ring.n, b = (j+1)*boundary.length;
      if (a === b) {
        face(outer(i),outer(i+1),inner(j),inner(j+1));
        i++; j++;
      } else if (a < b) {
        idx.push(outer(i),outer(i+1),inner(j));
        i++;
      } else {
        idx.push(outer(i),inner(j+1),inner(j));
        j++;
      }
    }
  }
  G.bridge = (boundary, ring, borderColor, rounded = false) => {
    const sleeve = ring;
    if (borderColor) {
      const points = Array.from({ length: ring.n }, (_, i) => new THREE.Vector3().fromArray(pos, (ring.i0 + i) * 3));
      const border = G.loop(points, borderColor, ring.w);
      G.seam(border, ring);
      ring = border;
    }
    let offset = 0, best = Infinity;
    const p = new THREE.Vector3(), q = new THREE.Vector3();
    for (let shift = 0; shift < ring.n; shift++) {
      let cost = 0;
      for (let i = 0; i < boundary.length; i++) {
        p.fromArray(pos, boundary[i] * 3);
        const arc = Math.round(i*ring.n/boundary.length);
        q.fromArray(pos, (ring.i0 + (arc + shift) % ring.n) * 3);
        cost += p.distanceToSquared(q);
      }
      if (cost < best) { best = cost; offset = shift; }
    }
    if (rounded) {
      const points = [], ws = [], outward = new THREE.Vector3();
      for (let i = 0; i < ring.n; i++) {
        const arc = i*boundary.length/ring.n, j = Math.floor(arc), t = arc-j;
        const a = boundary[j], b = boundary[(j+1)%boundary.length], c = ring.i0+(i+offset)%ring.n;
        p.fromArray(pos,a*3).lerp(q.fromArray(pos,b*3),t);
        q.fromArray(pos,c*3);
        const lift = Math.min(.006,p.distanceTo(q)*.11);
        points.push(p.clone().lerp(q,.51).addScaledVector(outward.copy(q).sub(sleeve.c).normalize(),lift));
        ws.push(blendWeights([a,b,c],[.49*(1-t),.49*t,.51]));
      }
      const mid = G.loop(points,borderColor || sleeve.col,ws,undefined,roughness[ring.i0]);
      stitchLoops(boundary,mid,0);
      boundary = points.map((_,i) => mid.i0+i);
    }
    stitchLoops(boundary,ring,offset);
  };
  G.socket = (rows, start) => {
    const index = (row, column) => rows[row].i0 + start + column;
    const boundary = [];
    for (let i = 0; i < 4; i++) boundary.push(index(0, i));
    for (let i = 0; i < 4; i++) boundary.push(index(i, 4));
    for (let i = 4; i > 0; i--) boundary.push(index(4, i));
    for (let i = 4; i > 0; i--) boundary.push(index(i, 0));
    return boundary;
  };
  G.fork = (ring, crotch, color, w) => {
    const center = crotch.map(p => vert(p, color, w, .82));
    const arc = (start, end) => Array.from({ length: end - start + 1 }, (_, i) => ring.i0 + (i + start) % ring.n);
    const half = ring.n / 2;
    return [arc(0, half).concat(center.slice().reverse()).reverse(), arc(half, ring.n).concat(center).reverse()];
  };
  G.pole = (R, p, color, w, start, sh = 1) => { const k = vert(p,color,w,sh,roughness[R.i0],surfaces[R.i0]); for (let i = 0; i < R.n; i++) { const j = (i + 1) % R.n; if (start) idx.push(k, R.i0 + j, R.i0 + i); else idx.push(R.i0 + i, R.i0 + j, k); } };
  G.seam = (A, B) => seams.push([A, B]);
  G.rew = (ring, f) => {
    for (let i = ring.i0; i < ring.i0 + ring.n; i++) {
      const w = f(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
      if (w) weights(si, sw, i, w);
    }
  };
  const blendWeights = (vertices, blend) => {
    const influence = new Map();
    vertices.forEach((vertex, i) => {
      for (let j = vertex*4; j < vertex*4+4; j++) {
        if (sw[j] && blend[i]) influence.set(si[j], (influence.get(si[j]) || 0) + sw[j] * blend[i]);
      }
    });
    return [...influence].sort((a, b) => b[1] - a[1]).slice(0, 4);
  };
  G.hem = (rings, color) => {
    const outside = rings[0], points = [], ws = [];
    for (let i = outside.i0; i < outside.i0 + outside.n; i++) {
      points.push(new THREE.Vector3().fromArray(pos, i*3).lerp(outside.c, .115).addScaledVector(rings.d, .012));
      ws.push(blendWeights([i], [1]));
    }
    G.join(G.loop(points, color, ws), outside);
  };
  G.quad = (a, b, c, d, color, wa, wc) => { const i = vert(a, color, wa); vert(b, color, wa); vert(c, color, wc); vert(d, color, wc); idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2); };
  // a limb along the joints P[0..m]: bones[k] drives the piece P[k]→P[k+1], `pre` drives what lies before P[0]; near joint k the
  // two neighbours are blended over ±bz[k] metres. st = stations [s (m along the limb from P[0]), ru (forward), rv (sideways), colour, seam?, brightness?];
  // seam: 1 marks a colour break. Identical rings share normals, raised cuffs keep the faces that close the edge.
  // returns the rings (for stripes). fwd = the body's forward; e = superellipse power (1 = round); side = [towards +u, towards +v] = the shaded side
  G.limb = (P, bones, pre, bz, st, n, fwd, e = 1, s0, s1, side, { bends, openStart, cut, endBone, drape, clothRoughness } = {}) => {
    const L = [0]; for (let k = 1; k < P.length; k++) L.push(L[k - 1] + P[k].distanceTo(P[k - 1]));
    const d = P[P.length - 1].clone().sub(P[0]).normalize(), u = fwd.clone().addScaledVector(d, -fwd.dot(d)).normalize(), v = d.clone().cross(u);
    const at = s => { if (s <= 0) return P[0].clone().addScaledVector(d, s); for (let k = 1; k < P.length; k++) if (s <= L[k]) return P[k - 1].clone().lerp(P[k], (s - L[k - 1]) / (L[k] - L[k - 1])); return P[P.length - 1].clone().addScaledVector(d, s - L[L.length - 1]); };
    const end = L.at(-1);
    const wt = s => { for (let k = 0; k < P.length - 1; k++) { const b = bz[k] || 0; if (b && Math.abs(s - L[k]) < b) { let t = .5 + (s - L[k]) / (2 * b); t = t * t * (3 - 2 * t); const a = k ? bones[k - 1] : pre; const mid = bends?.[k];
        if (mid !== undefined) return t < .5 ? [[a, 1 - 2*t], [mid, 2*t]] : [[mid, 2 - 2*t], [bones[k], 2*t - 1]];
        return [[a, 1 - t], [bones[k], t]]; } }
      if (endBone !== undefined && s > end - .105) {
        const t = Math.max(0, Math.min(1, (s - end + .105) / .105));
        const follow = .84 * t*t*(3-2*t);
        return [[bones.at(-1), 1-follow], [endBone, follow]];
      }
      let k = 0; while (k < bones.length - 1 && s > L[k + 1]) k++; return [[s < 0 ? pre : bones[k], 1]]; };
    const rings = [], stations = []; let prev = null;
    const insert = ([s, ru, rv, color, seam, sh = 1]) => {
      const ao = side || sh !== 1 ? [sh, side?.[0] || 0, side?.[1] || 0] : null;
      const c = at(s), w = wt(s), fold = drape && (angle => drape(s,angle));
      const R = Object.assign(G.ring(c,u,v,ru,rv,color,w,n,e,ao,fold,clothRoughness),{s,c,ru,rv,w,col:color});
      if (prev) { if (seam === 1 && prev.ru === R.ru && prev.rv === R.rv) G.seam(prev, R); else G.join(prev, R, cut?.(prev, R)); }
      else if (!openStart) G.pole(R, at(s0), color, wt(s0), true, sh * .9);
      prev = R; rings.push(R);
      return R;
    };
    st.forEach((b,i) => {
      const a = st[i-1], ds = a ? b[0]-a[0] : 0;
      if (ds > .037 && !b[4] && !cut?.({s:a[0]},{s:b[0]})) {
        const lo = st[i-2], hi = st[i+1];
        const midpoint = j => {
          const slope = (b[j]-a[j])/ds;
          const left = lo && a[0]-lo[0] > .009 ? (b[j]-lo[j])/(b[0]-lo[0]) : slope;
          const right = hi && hi[0]-b[0] > .009 ? (hi[j]-a[j])/(hi[0]-a[0]) : slope;
          const radius = (a[j]+b[j])*.5+(left-right)*ds*.125;
          return THREE.MathUtils.clamp(radius,Math.min(a[j],b[j]),Math.max(a[j],b[j]));
        };
        const color = a[3] === b[3] ? a[3] : mixOf(a[3],b[3],.5);
        insert([(a[0]+b[0])*.5,midpoint(1),midpoint(2),color,0,((a[5]??1)+(b[5]??1))*.5]);
      }
      stations.push(insert(b));
    });
    G.pole(prev,at(s1),st.at(-1)[3],wt(s1),false,st.at(-1)[5] || 1);
    return Object.assign(rings,{u,v,d,at,wt,stations});
  };
  // Features sample both the surface triangle and its final vertex weights, including reweighted seams.
  function garmentPoint(rings, a, b, t, angle, lift) {
    const i = ((angle / (Math.PI * 2) * a.n) % a.n + a.n) % a.n, k = Math.floor(i), u = i-k, j = (k+1)%a.n;
    const [vertices, blend] = u+t <= 1
      ? [[a.i0+k, a.i0+j, b.i0+k], [1-u-t, u, t]]
      : [[a.i0+j, b.i0+k, b.i0+j], [1-t, 1-u, u+t-1]];
    const p = new THREE.Vector3(), sample = new THREE.Vector3();
    vertices.forEach((v, i) => p.addScaledVector(sample.fromArray(pos,v*3),blend[i]));
    p.addScaledVector(rings.u, Math.cos(angle)*lift).addScaledVector(rings.v, Math.sin(angle)*lift);
    return { p, w: blendWeights(vertices, blend) };
  }
  const onRing = (rings, ring, angle, lift) => {
    return garmentPoint(rings, ring, ring, 0, angle, lift);
  };
  const onSurface = (rings, station, angle, lift) => {
    const k = rings.findIndex(r => r.s > station);
    if (k <= 0) return onRing(rings, k === 0 ? rings[0] : rings.at(-1), angle, lift);
    const a = rings[k - 1], b = rings[k];
    const t = (station - a.s) / (b.s - a.s);
    return garmentPoint(rings, a, b, t, angle, lift);
  };
  const sewnLoop = (samples, color, shades) => G.loop(samples.map(s => s.p), color, samples.map(s => s.w), shades);
  G.strip = (rings, angle, width, color, start, end, rise = .003) => {
    const edge = (ring, side) => {
      const radius = Math.hypot(ring.ru * Math.sin(angle), ring.rv * Math.cos(angle));
      return onRing(rings, ring, angle + side * width * .5 / radius, rise);
    };
    for (let i = 1; i < rings.length; i++) {
      const a = rings[i - 1], b = rings[i];
      if (a.s < start - 1e-4 || b.s > end + 1e-4 || b.s - a.s < 1e-4) continue;
      const row = sewnLoop([edge(a, -1), edge(a, 1), edge(b, -1), edge(b, 1)], color);
      face(row.i0, row.i0 + 1, row.i0 + 2, row.i0 + 3);
    }
  };
  G.trace = (rings, path, color, width, rise = .004) => {
    let last;
    for (const [s, a] of path) {
      const row = sewnLoop([onSurface(rings, s, a - width / 2, rise), onSurface(rings, s, a + width / 2, rise)], color);
      if (last) face(last.i0, last.i0 + 1, row.i0, row.i0 + 1);
      last = row;
    }
  };
  G.cord = (rings, path, color, radius, lift) => {
    const curve = new THREE.SplineCurve(path.map(([s, a]) => new THREE.Vector2(s, a)));
    const from = path[0][0], to = path[path.length - 1][0];
    let last;
    for (let i = 0; i <= 9; i++) {
      const p = curve.getPoint(i / 9);
      const s = Math.max(from, Math.min(to, p.x)), a = p.y;
      const normal = rings.u.clone().multiplyScalar(Math.cos(a)).addScaledVector(rings.v, Math.sin(a));
      const across = rings.d.clone().cross(normal).normalize();
      const { p: point, w } = onSurface(rings, s, a, lift);
      const row = G.ring(point, normal, across, radius, radius, color, w, 6);
      if (last) G.join(last, row);
      last = row;
    }
  };
  G.panel = (rings, angle, sections, color) => {
    const columns = 8;
    let previous = null;
    for (const [s, width, depth] of sections) {
      const points = [], shades = [];
      for (let i = 0; i <= columns; i++) {
        const offset = i / columns * 2 - 1, theta = angle + offset * width;
        const lift = depth * (1 - .34 * offset ** 2);
        points.push(onSurface(rings, s, theta, lift));
        shades.push(1 - .09 * Math.abs(offset));
      }
      const row = sewnLoop(points, color, shades);
      if (previous) for (let i = 0; i < columns; i++) face(previous.i0 + i, previous.i0 + i + 1, row.i0 + i, row.i0 + i + 1);
      previous = row;
    }
  };
  G.badges = patches => {
    const { position, uv } = BADGE_DISC.attributes;
    const vertices = [], coords = [], indices = [], strengths = [], faces = [];
    for (const { rings, station, angle, arc, height } of patches) {
      const start = vertices.length / 3;
      for (let i = 0; i < position.count; i++) {
        const s = station + height * position.getY(i);
        const theta = angle + arc * position.getX(i);
        const { p, w } = onSurface(rings, s, theta, .004);
        vertices.push(p.x, p.y, p.z);
        coords.push(uv.getX(i), uv.getY(i));
        weights(indices, strengths, start + i, w);
      }
      for (const i of BADGE_DISC.index.array) faces.push(start + i);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(coords, 2));
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(strengths, 4));
    geometry.setIndex(faces);
    geometry.computeVertexNormals();
    return geometry;
  };
  G.build = () => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const rm = new Float32Array(G.n*2), rim = new Float32Array(G.n), mix = new Uint8Array(G.n*4);
    for (let i = 0; i < G.n; i++) {
      rm[i*2] = roughness[i];
      rim[i] = surfaces[i] === FINISH.skin ? .31 : .68;
      if (surfaces[i] >= 0) mix[i*4+surfaces[i]] = 255;
    }
    g.setAttribute('rm',new THREE.BufferAttribute(rm,2)); g.setAttribute('rim',new THREE.BufferAttribute(rim,1));
    g.setAttribute('finishMix',new THREE.BufferAttribute(mix,4,true));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4)); g.setIndex(idx); g.computeVertexNormals();
    const N = g.attributes.normal; seams.forEach(([A, B]) => { for (let i = 0; i < A.n; i++) { _p.set(N.getX(A.i0 + i) + N.getX(B.i0 + i), N.getY(A.i0 + i) + N.getY(B.i0 + i), N.getZ(A.i0 + i) + N.getZ(B.i0 + i)).normalize(); N.setXYZ(A.i0 + i, _p.x, _p.y, _p.z); N.setXYZ(B.i0 + i, _p.x, _p.y, _p.z); } });
    return g; };
  return G;
}
// small extras for the CUSTOM details of clothes: glowing trim and round sewn patches (drawn once per colour)
const festivalPhase = { value: 0 };
const reducedGlow = matchMedia('(prefers-reduced-motion: reduce)');
const FESTIVAL_RGB = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false });
FESTIVAL_RGB.onBeforeCompile = shader => {
  shader.uniforms.festivalPhase = festivalPhase;
  shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying float vFestivalLED;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFestivalLED = position.z * 3.3 + position.x * .55;');
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vFestivalLED;\nuniform float festivalPhase;')
    .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = .59 + .34 * cos(6.2831853 * (vec3(vFestivalLED + festivalPhase) + vec3(0.0, .33, .67)));');
};
const GLOW = new Map(), glowOf = c => { if (!GLOW.has(c)) GLOW.set(c, new THREE.MeshStandardMaterial({ color: '#16171b', roughness: .5, emissive: c, emissiveIntensity: 2.2 })); return GLOW.get(c); };
const PATCH = new Map();
function patchMat(kind, c) {
  const k = kind + c; if (PATCH.has(k)) return PATCH.get(k);
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d'), star = (cx, cy, r, n = 5) => { x.beginPath(); for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / n, q = i % 2 ? r * .45 : r; x.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q); } x.closePath(); x.fill(); };
  x.fillStyle = '#F2EFE8'; x.beginPath(); x.arc(64, 64, 63, 0, 7); x.fill();                    // stitched edge
  x.fillStyle = kind === 'back' ? '#15161a' : c; x.beginPath(); x.arc(64, 64, 55, 0, 7); x.fill();
  if (kind === 'back') { x.strokeStyle = c; x.lineWidth = 9; x.beginPath(); x.arc(64, 64, 44, 0, 7); x.stroke(); x.fillStyle = c; star(64, 66, 30);
    x.fillStyle = '#F2EFE8'; star(64, 66, 13); }
  else if (kind === 'arm') { x.strokeStyle = '#15161a'; x.lineWidth = 13; x.lineJoin = 'miter'; for (const y of [50, 78]) { x.beginPath(); x.moveTo(30, y + 16); x.lineTo(64, y - 12); x.lineTo(98, y + 16); x.stroke(); } }
  else { x.fillStyle = '#15161a'; star(64, 67, 38); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = tame(new THREE.MeshStandardMaterial({ map: t, roughness: .9 })); PATCH.set(k, m); return m;
}
const MV = (c,r=.7,m=0,finish=FINISH.clean) => material(c,r,m,true,finish);
// ---------- BODIES (owner 16.11.2026 «улучши визуал человечков, добавь разнообразия: разный вес, рост, типаж») ----------
// A body = numbers that reshape our own low-poly figure on the same mocap skeleton: h height (whole rig), limb / arm thickness,
// chest / waist / hip width, belly 0..1, head size; plus skin, hair colour and hair style, beard, backpack, coat.
// The moves are untouched (only the clavicle and hip offsets get wider), so every build dances the same real capture.
export const BODY_TYPES = {
  avg:    { h: 1,    limb: 1,    arm: 1,    chest: 1,    waist: 1,    hip: 1,    belly: 0,   head: 1 },
  slim:   { h: 1,    limb: .82,  arm: .84,  chest: .9,   waist: .86,  hip: .92,  belly: 0,   head: .98 },
  lanky:  { h: 1.1,  limb: .84,  arm: .84,  chest: .93,  waist: .88,  hip: .93,  belly: 0,   head: .93 },
  athl:   { h: 1.04, limb: 1.08, arm: 1.24, chest: 1.14, waist: .93,  hip: 1,    belly: 0,   head: .97 },
  stocky: { h: .9,   limb: 1.18, arm: 1.2,  chest: 1.15, waist: 1.14, hip: 1.1,  belly: .3,  head: 1.06 },
  heavy:  { h: .98,  limb: 1.3,  arm: 1.2,  chest: 1.22, waist: 1.36, hip: 1.26, belly: .9,  head: 1.03 },
  big:    { h: 1.13, limb: 1.24, arm: 1.36, chest: 1.3,  waist: 1.18, hip: 1.12, belly: .45, head: .96 },
  small:  { h: .83,  limb: .86,  arm: .86,  chest: .9,   waist: .92,  hip: .94,  belly: 0,   head: 1.13 },
};
export const SKINS = ['#F4D3BB', '#EDC2A4', '#E2B18C', '#D8AB7C', '#C99672', '#BC855F',
  '#AB744C', '#9C6448', '#88553B', '#744632', '#613B2E', '#4D3029'];
export const HAIRS = ['#1E1714', '#17120f', '#2e1e14', '#4d3120', '#7a4a22', '#b98d4e', '#dcc9a0', '#a23c1f', '#8d9096', '#e9e9ec'];
const MEN = ['short', 'short', 'buzz', 'bald', 'afro', 'top', 'mohawk', 'dreads', 'curly', 'long'], WOMEN = ['tail', 'bun', 'long', 'braids', 'afro', 'short', 'curly', 'buns'];
function mul(seed) { let a = seed >>> 0 || 1; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// a body made up from a number: the same seed always gives the same person. o = { type, girl, old, + any field to fix }
export function bodyOf(seed, o = {}) {
  const r = mul(seed * 2654435761), names = Object.keys(BODY_TYPES), pick = a => a[Math.floor(r() * a.length)];
  const type = o.type || pick(o.girl ? ['avg', 'slim', 'slim', 'small', 'lanky', 'athl', 'stocky', 'heavy'] : names), T = BODY_TYPES[type] || BODY_TYPES.avg, j = k => 1 + (r() - .5) * k;
  const b = { type, h: T.h * j(.05), limb: T.limb * j(.07), arm: T.arm * j(.07), chest: T.chest * j(.05), waist: T.waist * j(.06), hip: T.hip * j(.05), belly: T.belly * j(.3), head: T.head * j(.03),
    skin: pick(SKINS), hair: o.old ? pick(['#8d9096', '#e9e9ec', '#b9bcc2']) : HAIRS[Math.floor(Math.pow(r(), 1.6) * 8)], style: pick(o.girl ? WOMEN : MEN), beard: !o.girl && r() < (o.old ? .5 : .28), girl: !!o.girl,
    motion: r(), face: Math.floor(r()*4) };
  if (o.girl) { b.chest *= .9; b.arm *= .88; b.hip *= 1.07; b.waist *= .93; b.h *= .96; }
  return Object.assign(b, o);
}
const BASE = BODY_TYPES.avg;
const DANCER_IDLE = ['Stand', 'Stand_Rock', 'Stand_Bounce'];
// body + clothes on a Mixamo skeleton. opt.body = a body from bodyOf() or a type name; without it — the plain average figure
export function mocapPerson(look, opt = {}) {
  const R = DATA.rest, C = Object.assign({}, look.col);
  const bd = Object.assign({}, BASE, typeof (opt.body || look.body) === 'string' ? BODY_TYPES[opt.body || look.body] : (opt.body || look.body || {}));
  if (bd.skin) C.skin = bd.skin; if (bd.hair) C.hair = bd.hair;
  const girl = look.girl || bd.girl, scale = (opt.scale || .9) * bd.h, L = bd.limb, A = bd.arm, gW = girl && !opt.body ? .92 : 1;
  const root = new THREE.Group(), rig = new THREE.Group(); root.add(rig);   // rig.scale is set after the skin is bound (below)
  const B = {};
  for (const [n, b] of Object.entries(R)) { const bo = new THREE.Bone(); bo.name = n; bo.position.fromArray(b.pos); bo.quaternion.fromArray(b.q); B[n] = bo; }
  for (const [n, b] of Object.entries(R)) (b.p ? B[b.p] : rig).add(B[n]);
  // wider or narrower frame: clavicles and hip joints move with the chest and the hips
  for (const s of ['Left', 'Right']) { B[s + 'Shoulder'].position.x *= bd.chest * gW; B[s + 'Arm'].position.multiplyScalar(bd.chest * gW); B[s + 'UpLeg'].position.x *= Math.max(1, bd.hip * (1 + (L - 1) * .5)); }
  const P = n => B[n].position.clone();
  const skin = M(C.skin,.72,0,FINISH.skin);
  const tp = look.top || 'tee', hoodie = tp === 'hoodie', bomber = tp === 'bomber', track = /^track/.test(tp), coat = bomber && bd.coat;
  const topRoughness = hoodie ? .96 : track ? .78 : bomber ? .85 : .91;
  const sleeveLong = hoodie || bomber || track, baggy = hoodie ? 1.12 : /Big|bomber|track/.test(tp) ? 1.06 : 1;
  const cw = bd.chest * gW * baggy, ww = bd.waist * baggy, dp = 1 + (bd.chest - 1) * .7 + bd.belly * .12, add = (bone, geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); bone.add(m); return m; };
  // ---- the smooth body: torso + arms + HANDS + legs + SHOES as one skinned mesh (see skinGeo) ----
  // 16.11.2026 night (owner «улучши визуал главного персонажа, он всё ещё слишком шарнирный»): the hands and the shoes used to be
  // boxes hung on the wrist and the ankle — now they grow out of the same surface (palm, curled fingers, thumb; a sneaker that bends at
  // the toes and whose collar follows the shin). The top is its own layer of cloth over the trousers (hem, rib band, collar, yoke),
  // trouser legs are wide and stack on the shoe (or end in a cuff), and the cloth is shaded by paint (under the arms, between the legs).
  rig.updateMatrixWorld(true);
  const names = Object.keys(R), BI = {}; names.forEach((n, i) => { BI[n] = i; });
  const hoodBone = hoodie || bd.hood ? new THREE.Bone() : null;
  if (hoodBone) {
    hoodBone.name = 'HoodCompression';
    B.Spine2.add(hoodBone);
    names.push(hoodBone.name);
    B[hoodBone.name] = hoodBone;
  }
  for (const side of ['Left', 'Right']) {
    for (const segment of ['Arm', 'ForeArm', 'UpLeg', 'Leg', 'Foot']) {
      const helper = bendBone(B[side + segment]);
      BI[helper.name] = names.length;
      names.push(helper.name);
      B[helper.name] = helper;
    }
  }
  rig.updateMatrixWorld(true);
  const JP = n => new THREE.Vector3().setFromMatrixPosition(B[n].matrixWorld), FWD = new THREE.Vector3(0, 0, 1), DOWN = new THREE.Vector3(0, -1, 0), G = skinGeo(C.skin);
  const festivalLED = look.rgbSole || look.rgbLace ? skinGeo(C.skin) : null;
  const hi = !!opt.hero, NT = 24, NA = 20, NL = 20, cus = look.cus || {}, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (min, max, v) => {
    const t = clamp((v - min) / (max - min), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const foldAt = (s, center, width) => Math.exp(-(((s-center)/width)**2));
  const hd = 1 + (bd.hip - 1) * .8, wd = 1 + (ww - 1) * .5, topC = C.top, slC = C.sleeve || C.top, yk = track && C.yoke !== topC ? C.yoke : null, uc = yk || topC;
  // ground contact points given in rest-pose space (they ride on a bone): the body may never sink into the asphalt
  const PTS = [], lpt = (bone, wp, r = 0) => PTS.push({ m: B[bone], p: B[bone].worldToLocal(wp.clone()), r: r * scale });
  const _qi = new THREE.Quaternion(), addW = (bone, geo, mat, wp, wq) => { const m = new THREE.Mesh(geo, mat); m.position.copy(B[bone].worldToLocal(wp.clone())); B[bone].getWorldQuaternion(_qi).invert(); m.quaternion.copy(_qi); if (wq) m.quaternion.multiply(wq); B[bone].add(m); return m; };
  let sleeves, trousers;
  const patches = { chest: [], arm: [], back: [] };
  { const P = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck'].map(JP), y0 = P[0].y, S = n => JP(n).y - y0, bl = bd.belly * .03;
    const hemW = .152 * (bd.hip * .55 + ww * .45), hemD = .102 * (hd * .55 + wd * .45), TB = [BI.Hips, BI.Spine, BI.Spine1, BI.Spine2], TZ = [0, .04, .04, .04];
    // Both trouser legs attach to this seat and share the vertices between them.
    const waist = .014, seatLow = S('LeftUpLeg') - .008;
    const seat = G.limb(P, TB, BI.Hips, TZ, [
      [seatLow, .096 * hd, .155 * bd.hip, C.pants, 0, .9],
      [-.025, .099 * hd, .151 * bd.hip, C.pants, 0, .94],
      [waist, .098 * hd, .148 * bd.hip, C.pants], [.052, hemD, hemW, C.pants],
    ], NT, FWD, .78, seatLow, .06, null, { openStart: true });
    const waistWeights = (x, s) => {
      const side = smooth(.021, .133 * bd.hip, Math.abs(x));
      const thigh = .62 * side * (1 - smooth(seatLow, waist, s));
      return [[BI.Hips, 1 - thigh], [x > 0 ? BI.LeftUpLegBend : BI.RightUpLegBend, thigh]];
    };
    for (const ring of seat) G.rew(ring, x => waistWeights(x, ring.s));
    const crotch = [-1, 0, 1].map(z => seat[0].c.clone().addScaledVector(seat.u, .047 * hd * z).addScaledVector(DOWN, .047 - Math.abs(z) * .017));
    trousers = G.fork(seat[0], crotch, C.pants, [[BI.Hips, .56], [BI.LeftUpLegBend, .22], [BI.RightUpLegBend, .22]]);
    // the top: hem (a big tee hangs lower; jackets end in a rib band) → waist → chest → sloped shoulders → collar
    const rib = sleeveLong && !coat ? C.cuff : null;
    const drop = coat ? .216 : tp === 'teeBig' ? .14 : /^tee/.test(tp) ? .112 : hoodie ? .096 : .048, lo = .04 - drop;
    const ex = (coat ? .041 : tp === 'teeBig' || hoodie ? .021 : .014) * baggy;
    const layerD = hemD + ex + .020, layerW = hemW + ex * 1.15 + .006;
    const layered = !!look.layers && /^tee/.test(tp);
    const under = layered ? '#292632' : null;
    const st = [];
    if (layered) {
      const hem = S('Spine') + .028, d = .10*dp*wd + bl, w = .151*ww;
      st.push([.045,hemD+.006,hemW+.006,under], [.072,d,w,under], [hem,d,w,under],
        [hem,d+.014,w+.017,shadeOf(topC,.75),2], [hem+.014,d+.016,w+.019,topC]);
    } else {
      st.push([lo, layerD, layerW, rib || topC, 0, .8]);
      if (!rib) st.push([lo + .012, layerD + .003, layerW + .002, topC, 0, .94], [lo + .044, layerD - .004, layerW - .002, topC]);
      if (rib) st.push([lo + .032, layerD, layerW, rib, 0, .92], [lo + .032, layerD + .005, layerW + .006, topC, 1, .92]);
      // A fabric ring at the waistband keeps the trousers under the top when the torso bends.
      st.push([.055, hemD + ex + bl * .65, hemW + ex, topC], [S('Spine') + .02, .1 * dp * wd + bl, .155 * ww, topC, 0, .93]);
    }
    const nk = S('Neck'), jx = Math.abs(JP('LeftArm').x), js = S('LeftArm'), ak = .6 * A + .4;
    st.push([S('Spine1'), .105 * dp + bl * .6, .167 * (cw * .6 + ww * .4), topC, 0, .97], [S('Spine2'), .115 * dp, jx + .003 * ak, topC]);
    // Four rows of open faces on each side make room for the continuous sleeve.
    // The two openings sit a little towards the back, over the arm joints.
    const bottom = Math.max(S('Spine2') + .018, js - .089 * ak);
    const shoulder = Math.min(js + .049 * ak, nk - .012);
    const section = [[0, .117, .008], [.25, .118, .026], [.5, .115, .032], [.75, .108, .028], [1, .093, .004]];
    if (yk) st.push([bottom, .117 * dp, jx + .008 * ak, topC]);
    const socketFirst = st.length;
    for (const [f, depth, width] of section) {
      st.push([bottom + f * (shoulder - bottom), depth * dp, jx + width * ak, uc, f === 0 && yk ? 1 : 0]);
    }
    // Round the slope above the sleeve openings before the fabric reaches the collar.
    const shoulderCap = Math.min(nk - .007,shoulder+Math.max(.011,(nk-shoulder)*.64));
    if (shoulderCap > shoulder+.003) {
      st.push([shoulderCap,.086*dp,THREE.MathUtils.lerp(jx+.004*ak,.082,.48),uc]);
    }
    if (track) st.push([nk + .008, .073, .081, uc], [nk + .033, .070, .076, uc], [nk + .044, .066, .072, C.trim || uc]);
    else if (bomber) st.push([nk + .006, .076, .084, rib || uc], [nk + .020, .073, .079, rib || uc, 0, .87], [nk + .026, .069, .075, rib || uc]);
    else {
      const binding = shadeOf(topC, .70);
      st.push([nk - .006, .076, .087, topC], [nk + .002, .075, .084, binding], [nk + .015, .067, .077, binding, 0, 1.06], [nk + .020, .062, .069, binding]);
    }
    const openings = [5, 15];
    const tr = G.limb(P, TB, BI.Hips, TZ, st, NT, FWD, .89, st[0][0] - .012, st[st.length - 1][0] + .012, null, {
      openStart: true,
      clothRoughness: topRoughness,
      cut: (a, b) => a.s >= bottom - 1e-5 && b.s <= shoulder + 1e-5 ? openings : null,
      drape: (s,a) => {
        if (s > bottom-.038) return 0;
        const hem = st[0][0] + .027;
        const side = Math.sin(a)**2;
        return (hoodie || tp==='teeBig' ? .0064 : .0042) * Math.cos(a*7 + 3.1*s)
          * (.59*foldAt(s,hem,.065) + .41*side*foldAt(s,.139,.079));
      },
    });
    const rows = tr.stations.slice(socketFirst, socketFirst + section.length);
    sleeves = openings.map(start => G.socket(rows, start));
    for (const ring of tr) {
      if (ring.s < waist) G.rew(ring, x => waistWeights(x, ring.s));
      if (ring.s < S('Spine2') || ring.s > shoulder + 1e-5) continue;
      const lift = smooth(S('Spine2'), js - .005, ring.s);
      G.rew(ring, x => {
        const side = x > 0 ? 'Left' : 'Right';
        const outer = smooth(jx * .44, jx + .029 * ak, Math.abs(x));
        const arm = outer * (.16 + .33 * lift), collar = outer * .29 * lift;
        return [[BI.Spine2, 1 - arm - collar], [BI[side + 'ArmBend'], arm], [BI[side + 'Shoulder'], collar]];
      });
    }
    G.hem(tr, shadeOf(under || rib || topC, .65));
    if (track || bomber) {
      const zipStart = lo + (rib ? .032 : .012);
      const zipEnd = nk + (track ? .044 : .026);
      G.strip(tr, 0, .023, shadeOf(topC, .48), zipStart, zipEnd);
      G.strip(tr, 0, .007, C.trim || '#9A968E', zipStart, zipEnd, .004);
      const pull = [[nk - .037, 0], [nk - .014, 0], [nk + .004, 0]];
      G.trace(tr, pull, shadeOf(topC, .38), .16, .006);
      G.trace(tr, pull.slice(1), C.trim || '#A7A19B', .095, .009);
      for (const side of [-1, 1]) {
        const pocketY = lo + (coat ? .15 : .085);
        const pocket = [[pocketY, .39 * side], [pocketY + .052, .55 * side], [pocketY + .085, .62 * side]];
        G.trace(tr, pocket, shadeOf(topC, .39), .075);
        G.trace(tr, pocket.map(([s, angle]) => [s + .005, angle + .065 * side]), shadeOf(topC, 1.21), .038);
      }
    }
    if (hoodie) {
      G.panel(tr, 0, [[.025, .46, .003], [.041, .70, .009], [.097, .67, .010], [.143, .43, .003]], shadeOf(topC, .83));
      const thread = C.trim || shadeOf(topC, 1.43);
      for (const side of [-1, 1]) {
        G.trace(tr, [[.054, .61 * side], [.091, .60 * side], [.128, .48 * side]], shadeOf(topC, .46), .068, .012);
        const end = nk - (side < 0 ? .158 : .174);
        const cord = [[end, .28 * side], [end + .026, .24 * side], [nk - .061, .27 * side], [nk - .018, .31 * side]];
        G.cord(tr, cord, thread, .0029, .006);
        G.cord(tr, [[end - .012, .289 * side], cord[0], [end + .003, .276 * side]], shadeOf(thread, .72), .0034, .006);
        G.trace(tr, [[nk - .026, .31 * side], [nk - .015, .32 * side]], shadeOf(topC, .44), .11, .0033);
      }
    }
    if (bd.pack) {
      for (const side of [-1, 1]) G.trace(tr, [[.136, .83 * side], [.224, .54 * side], [.338, .60 * side], [nk + .010, .68 * side]], shadeOf(bd.pack, .62), .16, .007);
    }
    if (cus.top >= 1) patches.chest.push({ rings: tr, station: S('Spine2') + .045, angle: .43, arc: .185, height: .034 });
    if (cus.top >= 3) patches.back.push({ rings: tr, station: S('Spine2') + .008, angle: Math.PI, arc: .54, height: .088 });
  }
  for (const s of ['Left', 'Right']) { const sg = s === 'Left' ? 1 : -1, bn = k => BI[s + k];
    { // Shoulder, sleeve and palm share the same skin. The fingers curl from the knuckles in the bind pose.
      const Jt = [s + 'Arm', s + 'ForeArm', s + 'Hand'].map(JP), d = Jt[2].clone().sub(Jt[0]).normalize(), E = Jt[0].distanceTo(Jt[1]), Wd = E + Jt[1].distanceTo(Jt[2]), fa = A * .7 + .3, hs = (A * .3 + .7) * (hi ? 1.05 : 1);
      const low = sleeveLong ? slC : C.skin, hc = look.gloves ? (C.glove || '#18181B') : C.skin, tipC = C.skin;
      const Kn = Jt[2].clone().addScaledVector(d, .073 * hs).addScaledVector(DOWN, .006 * hs);
      const palmEnd = Kn.clone().addScaledVector(d, .012 * hs).addScaledVector(DOWN, .006 * hs);
      const HL = Wd + Jt[2].distanceTo(Kn), palmLength = HL + Kn.distanceTo(palmEnd);
      const ease = hoodie || bomber ? 1.09 : 1;
      const st = [[.055, .066 * A * ease, .065 * A * ease, slC], [.087, .065 * A * ease, .064 * A * ease, slC]];
      if (sleeveLong) {
        st.push([.115, .062 * A * ease, .062 * A * ease, slC], [.14, .059 * A * ease, .06 * A * ease, slC]);
      }
      else st.push([E * .41, .063 * A, .065 * A, topC], [E * .46, .064 * A, .067 * A, shadeOf(topC, .80)],
        [E * .46, .052 * A, .053 * A, C.skin, 2, .88]);
      for (const [offset, depth, width] of ELBOW_PROFILE) {
        const size = offset <= 0 ? A : fa;
        st.push([E + offset, depth * size, width * size, low]);
      }
      const cf = sleeveLong && C.cuff ? C.cuff : null, wb = !sleeveLong && look.wrist && s === 'Left' ? look.wrist : null;
      if (C.wristband) {
        st.push([Wd - .065, .043 * fa, .043 * fa, low], [Wd - .065, .049 * fa, .049 * fa, C.wristband, 1],
          [Wd - .030, .048 * fa, .048 * fa, C.wristband], [Wd - .030, .042 * fa, .042 * fa, cf || low, 1],
          [Wd - .014, .040 * fa, .040 * fa, cf || low]);
      }
      else if (cf) st.push([Wd - .062, .042 * fa, .042 * fa, low], [Wd - .062, .046 * fa, .046 * fa, cf, 1],
        [Wd - .053, .0465 * fa, .0465 * fa, cf, 0, 1.06], [Wd - .022, .0445 * fa, .0445 * fa, cf], [Wd - .014, .044 * fa, .044 * fa, cf, 0, .79]);
      else if (wb) st.push([Wd - .075, .041 * fa, .041 * fa, low], [Wd - .075, .0445 * fa, .0445 * fa, wb, 1], [Wd - .04, .0435 * fa, .0435 * fa, wb], [Wd - .04, .039 * fa, .039 * fa, low, 1], [Wd - .014, .037 * fa, .037 * fa, low]);   // wristband
      else st.push([Wd - .04, .041 * fa, .041 * fa, low], [Wd - .014, (sleeveLong ? .041 : .037) * fa, (sleeveLong ? .041 : .037) * fa, low]);
      if (sleeveLong || look.gloves) st.push([Wd - .014, .034 * hs, .033 * hs, C.gloveTrim || hc, 2, .85]);                                  // the sleeve's opening / the glove's edge
      st.push([Wd + .022 * hs, .037 * hs, .020 * hs, hc], [Wd + .048 * hs, .045 * hs, .019 * hs, hc],
        [HL - .005 * hs, .044 * hs, .0175 * hs, hc], [HL + .006 * hs, .032 * hs, .013 * hs, hc]);
      const arm = G.limb([Jt[0], Jt[1], Jt[2], Kn, palmEnd], [bn('Arm'), bn('ForeArm'), bn('Hand'), bn('Hand')], bn('Shoulder'), [.11, .084, .028, 0], st, NA, FWD, .93, .055, palmLength, [0, sg * .14], {
        bends: [bn('ArmBend'), bn('ForeArmBend')], openStart: true,
        clothRoughness: topRoughness,
        drape: sleeveLong ? (s,a) => .0035*Math.cos(a*4+s*31)*(.55*foldAt(s,E+.016,.070)+.45*foldAt(s,Wd-.077,.039)) : null,
      });
      G.bridge(sleeves[s === 'Left' ? 0 : 1], arm[0], uc !== slC ? uc : null,true);
      const outer = arm.v.y > 0 ? Math.PI / 2 : -Math.PI / 2;
      if (track && C.trim) G.strip(arm, outer, .017, C.trim, .115, cf ? Wd - .062 : Wd - .014);
      if (C.elbow) {
        G.panel(arm, outer, [[E - .048, .38, .005], [E - .027, .65, .011], [E, .72, .016],
          [E + .036, .60, .010], [E + .052, .30, .005]], C.elbow);
        G.trace(arm, [[E - .026, outer - .28], [E + .004, outer], [E + .026, outer + .28]], C.elbowTrim, .075, .018);
      }
      if (look.gloves) G.panel(arm, outer, [[Wd + .010 * hs,.33,.002],[Wd + .019 * hs,.68,.004],[Wd + .025 * hs,.67,.003]], C.gloveTrim || shadeOf(hc, 1.75));
      if (cus.top >= 2) patches.arm.push({ rings: arm, station: sleeveLong ? .143 : .095, angle: outer, arc: .48, height: sleeveLong ? .034 : .025 });
      const dorsal = arm.v.clone().multiplyScalar(Math.sign(arm.v.y)), unit = hs / 10000;
      const place = (x, y, z) => Jt[2].clone().addScaledVector(arm.u, x * unit)
        .addScaledVector(d, y * unit).addScaledVector(dorsal, z * unit);
      const reverse = arm.u.clone().cross(d).dot(dorsal) < 0;
      G.fingers(place, [hc, tipC, mixOf(tipC, '#F1C5A5', .29)], bn('Hand'), reverse);
      for (const [x, y, z, radius] of CITY_ANATOMY.hand.contacts) lpt(s + 'Hand', place(x,y,z), radius * unit);
      lpt(s + 'Hand', Kn.clone().addScaledVector(FWD, .039 * hs), .017 * hs);
      lpt(s + 'Hand', Kn.clone().addScaledVector(FWD, -.039 * hs), .017 * hs);
    }
    { // leg: hip → thigh → knee → shin → hem. Wide legs stack on the shoe; track pants end in a cuff
      const Jt = [s + 'UpLeg', s + 'Leg', s + 'Foot'].map(JP), K = Jt[0].distanceTo(Jt[1]), F = K + Jt[1].distanceTo(Jt[2]), Ls = L * .75 + .25, Lk = (L + Ls) / 2, pc = C.pants, pt = look.pants || 'jeans';
      const relaxed = pt === 'wind' && look.layers;
      const cuffed = /^trackp/.test(pt), Lb = Ls * (relaxed ? 1.33 : pt === 'wind' ? 1.16 : cuffed ? 1.08 : 1.1), kc = cus.pants >= 1 ? mixOf(pc, '#9aa0ab', .36) : pc;
      const ease = relaxed ? 1.12 : 1;
      const st = [[.046, .096 * L, Math.min(.088 * L, Math.abs(Jt[0].x) - .006), pc, 0, .95],
        [.11, .096 * L * ease, .089 * L, pc], [.2, .094 * L * ease, .089 * L * ease, pc], [K - .1, .086 * L * ease, .083 * L * ease, pc]];
      if (kc !== pc) st.push([K - .07, .083 * Lk, .08 * Lk, pc], [K - .07, .086 * Lk, .083 * Lk, kc, 1]);                    // custom: reinforced knees
      for (const [offset, depth, width] of KNEE_PROFILE) {
        const size = offset <= 0 ? Lk * ease : Lb;
        st.push([K + offset, depth * size, width * size, kc]);
      }
      if (kc !== pc) st.push([K + .09, .074 * Lb, .071 * Lb, kc], [K + .09, .072 * Lb, .069 * Lb, pc, 1]);
      st.push([K + .14, .072 * Lb, .07 * Lb, pc], [K + .26, .069 * Lb, .067 * Lb, pc, 0, .96]);
      if (cuffed) { const cc = mixOf(pc, '#8a8d94', .22); st.push([F - .13, .069 * Lb, .067 * Lb, pc, 0, .93], [F - .085, .072 * Lb, .07 * Lb, pc, 0, .9], [F - .062, .061 * Ls, .06 * Ls, pc, 0, .84], [F - .062, .0605 * Ls, .0595 * Ls, cc, 1], [F - .02, .059 * Ls, .058 * Ls, cc]); }
      else st.push([F - .13, .071 * Lb, .069 * Lb, pc, 0, .94], [F - .09, .077 * Lb, .075 * Lb, pc, 0, .9], [F - .064, .072 * Lb, .07 * Lb, pc, 0, .82], [F - .038, .079 * Lb, .077 * Lb, pc, 0, .9], [F - .01, .075 * Lb, .074 * Lb, pc, 0, .78]);
      const lg = G.limb(Jt, [bn('UpLeg'), bn('Leg')], BI.Hips, [.095, .095], st, NL, FWD, 1, .046, F - (cuffed ? .012 : .004), [0, sg * .2], {
        bends: [bn('UpLegBend'), bn('LegBend')], openStart: true, endBone: bn('FootBend'),
        clothRoughness: pt === 'jeans' ? .94 : .81,
        drape: (s,a) => {
          const knee = foldAt(s,K-.028,.066) + .52*foldAt(s,K+.073,.049);
          const ankle = foldAt(s,F-.099,.079);
          return .0041*Math.cos(5*a+15*s)*knee + .0065*Math.cos(4*a-33*s)*ankle;
        },
      });
      G.bridge(trousers[s === 'Left' ? 0 : 1], lg[0]);
      const outer = lg.v.x * sg > 0 ? Math.PI / 2 : -Math.PI / 2;
      const seam = C.stripe || mixOf(pc, pt === 'jeans' ? '#A88F67' : '#A4A4AD', .26);
      G.strip(lg, outer, C.stripe ? .026 : .008, seam, .06, cuffed ? F - .062 : F);
      const stitch = mixOf(pc, pt === 'jeans' ? '#B89D79' : '#92939B', .43);
      const pocketSide = Math.sign(outer);
      G.trace(lg, [[.085,.44*pocketSide],[.128,.57*pocketSide],[.179,.83*pocketSide],[.204,.93*pocketSide]], shadeOf(pc, .46), .084);
      G.trace(lg, [[.091,.49*pocketSide],[.132,.62*pocketSide],[.182,.88*pocketSide],[.206,.98*pocketSide]], stitch, .032);
      if (pt === 'jeans') {
        G.strip(lg, outer - .097 * pocketSide, .0045, stitch, .115, F - .036, .0037);
        G.panel(lg, Math.PI, [[.112,.50,.003],[.146,.57,.005],[.235,.49,.005],[.255,.28,.003]], shadeOf(pc, .79));
      }
      if (relaxed) {
        G.panel(lg, outer, [[.160,.48,.003],[.187,.62,.010],[.279,.55,.010],[.294,.40,.005]], shadeOf(pc,.84));
        G.trace(lg,[[.191,outer-.27],[.180,outer],[.191,outer+.27]],shadeOf(pc,1.23),.074,.012);
      }
      if (look.knee) {
        const pad = C.knee || '#353540';
        G.panel(lg, 0, [[K - .078, .42, .006], [K - .052, .76, .016], [K, .82, .024], [K + .052, .73, .017], [K + .074, .42, .006]], '#1F2027');
        G.panel(lg, 0, [[K - .061, .33, .013], [K - .038, .63, .022], [K, .67, .03], [K + .039, .60, .023], [K + .057, .33, .013]], pad);
        G.trace(lg, [[K - .032, -.43], [K - .042, 0], [K - .032, .43]], mixOf(pad, '#EBE7E1', .36), .038, .031);
      }
      if (cus.pants >= 2) {
        G.panel(lg, outer, [[.135, .5, .012], [.16, .65, .018], [.25, .65, .017], [.276, .47, .008]], mixOf(pc, '#9aa0ab', .17));
        G.panel(lg, outer, [[.125, .6, .013], [.151, .72, .023], [.169, .51, .018]], mixOf(pc, '#9aa0ab', .33));
      }
    }
    { // SNEAKER: a sole and an upper, both closed skinned shapes
      const A0 = JP(s + 'Foot'), T0 = JP(s + 'ToeBase'), x0 = A0.x, yB = -.04, bigS = hi ? 1.06 : 1, zH = A0.z - .078 * bigS, zT = T0.z + .108 * bigS, len = zT - zH, n = 16;
      const gum = cus.kicks >= 2, soleC = C.sole || '#eeeeee', yM = yB + .032, highT = /^high/.test(look.shoe) ? .045 : 0;
      const up = C.shoe, cap = C.shoe2 || up, laceC = C.lace || '#F2EFE8';
      const tread = gum ? '#C98A45' : shadeOf(soleC, .49), canvas = look.shoe === 'canvas', runner = look.shoe === 'runner';
      const soleEdge = shadeOf(soleC, .84);
      const xAt = (z, offset = 0) => x0 + offset + (Math.sign(x0) || sg) * .065 * smooth(.13, .95, (z - zH) / len);
      const wOf = (z, y) => {
        const toe = smooth(T0.z - .03, T0.z + .03, z);
        const ankle = (highT ? .8 : .44) * smooth(.045, .11 + highT * .35, y) * (1 - toe);
        return [[bn('Foot'), 1 - toe - ankle], [bn('ToeBase'), toe], [bn('Leg'), ankle]];
      };
      // sections along the foot: t (0 heel … 1 toe), half-width, height of the top
      const SEC = [[.03, .026, .059], [.11, .038, .093 + highT], [.23, .045, .110 + highT], [.36, runner ? .046 : .049, .102 + highT * .8], [.49, .053, .080], [.62, .056, .061], [.74, .055, .050], [.86, .051, .041], [.95, .035, .034]];
      const upper = [], outsole = [];
      const part = sole => {
        let prev = null;
        for (const [t, w, yT] of SEC) {
          const z = zH + t * len;
          const yb = yB + .015 * clamp((t - .62) / .38, 0, 1) ** 2 + .012 * clamp((.18 - t) / .18, 0, 1) ** 2;
          const stack = runner ? .008 * (1 - t) : 0;
          const top = sole ? yM + .004 + stack : yT - (canvas ? .008 : 0), bot = sole ? yb : yM - .008;
          const mid = sole ? (top + bot) / 2 : yM + .004, width = w * bigS * (sole ? 1.08 : 1);
          const c0 = sole ? soleC : t > .74 || t < .18 ? cap : up;
          const pts = [], cols = [], ws = [], shs = [];
          for (let i = 0; i < n; i++) {
            const a = i / n * Math.PI * 2, cs = Math.cos(a), sn = Math.sin(a);
            const x = xAt(z, Math.sign(cs) * Math.abs(cs) ** (sole ? .5 : .72) * width);
            const y = sn >= 0 ? mid + (top - mid) * sn ** (sole ? .45 : .8) : mid + (bot - mid) * (-sn) ** (sole ? .45 : .6);
            pts.push(new THREE.Vector3(x, y, z));
            ws.push(wOf(z, y));
            if (sole) cols.push(sn < -.35 ? tread : sn > .38 && sn < .69 ? soleEdge : soleC);
            else cols.push(!canvas && t >= .36 && t <= .62 && sn > .1 && sn < .45 ? cap : c0);
            shs.push(sole ? 1 : .84 + .16 * Math.max(0, sn));
          }
          const ring = G.loop(pts,cols,ws,shs,sole ? .91 : canvas ? .94 : runner ? .83 : .76,sole ? FINISH.rubber : FINISH.cloth);
          if (prev) G.join(prev, ring);
          else G.pole(ring, new THREE.Vector3(xAt(zH), (top + bot) / 2, zH), c0, wOf(zH, 0), true);
          (sole ? outsole : upper).push(pts);
          prev = ring;
        }
        G.pole(prev, new THREE.Vector3(xAt(zT), sole ? yB + .03 : yB + .045, zT), sole ? soleC : cap, [[bn('ToeBase'), 1]], false);
      };
      part(true); part(false);
      // Stitch the panels, laces and tread to the same deformed surface as the shoe.
      const surface = (rows, t, i, lift) => {
        const k = SEC.findIndex(section => section[0] >= t);
        const u = (t - SEC[k - 1][0]) / (SEC[k][0] - SEC[k - 1][0]);
        const j = Math.floor(i), a = i * 2 * Math.PI / n;
        const edge = row => rows[row][j].clone().lerp(rows[row][(j + 1) % n], i - j);
        const p = edge(k - 1).lerp(edge(k), u);
        p.x += Math.cos(a) * lift; p.y += Math.sin(a) * lift;
        return p;
      };
      const shoeBand = (rows, edge, start, end, c, lift, target = G) => {
        for (let i = start; i < end; i++) {
          const [u0, v0] = edge(i), [u1, v1] = edge(i + 1);
          const a = surface(rows, u0, i, lift), b = surface(rows, u1, i + 1, lift);
          const c0 = surface(rows, v0, i, lift), d = surface(rows, v1, i + 1, lift);
          target.quad(a, b, c0, d, c, wOf(a.z, a.y), wOf(c0.z, c0.y));
        }
      };
      for (const [t0, t1] of [[.245,.35],[.35,.47],[.47,.575],[.575,.647]]) shoeBand(upper, () => [t0,t1], 1, 7, '#24232A', .003);
      shoeBand(upper, i => {
        const edge = .700 + .046 * Math.sin(i * Math.PI / 8);
        return [edge, edge + .019];
      }, 0, 8, mixOf(shadeOf(up,.59), cap, .54), .0035);
      const layout = window.HERO.laceLayout(look.laceStyle);
      const laceWidth = look.laceStyle === 'zigzag' || cus.kicks >= 1 ? .022 : .018;
      const laceRow = row => .28 + row * .332;
      const tongueSide = side => (sg < 0 ? 1 - side : side);
      for (const [row, side] of layout.anchors) {
        const t = laceRow(row), edge = 1.5 + 4 * tongueSide(side);
        shoeBand(upper, () => [t - .021, t + .021], edge, edge + 1, '#777780', .005);
      }
      for (const [i, [from, to]] of layout.segments.entries()) {
        const [a, b] = tongueSide(from[1]) === 0 ? [from, to] : [to, from];
        shoeBand(upper, edge => {
          const center = laceRow(a[0] + (b[0] - a[0]) * (edge - 2) / 4);
          return [center - laceWidth, center + laceWidth];
        }, 2, 6, laceC, .009 + .0003 * i, look.rgbLace ? festivalLED : G);
      }
      for (const t of [.19,.32,.45,.62,.77,.89]) shoeBand(outsole, () => [t,t+.019], 10, 14, shadeOf(tread, 1.28), .001);
      [[0, yB, zH + .02], [-.05, yB, T0.z - .01], [.05, yB, T0.z - .01], [0, .11 + highT, A0.z - .04]].forEach(([dx, y, z]) => lpt(s + 'Foot', new THREE.Vector3(xAt(z, dx), y, z)));
      [[0, yB + .014, zT - .008], [0, .05, zT - .04], [-.045, yB + .01, T0.z + .04], [.045, yB + .01, T0.z + .04]].forEach(([dx, y, z]) => lpt(s + 'ToeBase', new THREE.Vector3(xAt(z, dx), y, z)));
      if (look.rgbSole) {
        for (const [from, to] of [[.12, .33], [.365, .63], [.665, .89]]) {
          const channel = () => [from, to];
          shoeBand(outsole, channel, .3, 1.3, '#ffffff', .0031, festivalLED);
          shoeBand(outsole, channel, 6.7, 7.7, '#ffffff', .0031, festivalLED);
        }
      }
      // Custom tier 3 adds glowing strips along the sole.
      if (cus.kicks >= 3) {
        const gm = glowOf(look.acc || '#E2611A'), z = zH + len * .4;
        const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(xAt(z + .05) - xAt(z - .05), .1));
        for (const k of [-1, 1]) {
          addW(s + 'Foot', new THREE.BoxGeometry(.007, .013, len * .34), gm, new THREE.Vector3(xAt(z, k * (.052 * bigS * 1.08 + .001)), yB + .022, z), turn);
        }
        addW(s + 'Foot', new THREE.BoxGeometry(.03, .03, .006), gm, new THREE.Vector3(xAt(zH), .075 + highT, zH + .004));
      }
    }
  }
  if (/Locs$/.test(bd.style || '')) {
    const headScale = bd.head * .94;
    const matrix = B.Head.matrixWorld.clone().scale(new THREE.Vector3(headScale,headScale,headScale));
    const locs = cityLocs(bd.style, bd.pack ? .098 : hoodie || bd.hood ? .065 : 0, look.hat === 'bandana' && !!C.hat);
    G.locMesh(locs,matrix,C.hair,y => {
      const head = smooth(-.115,.065,y), back = 1-smooth(-.31,-.09,y);
      return [[BI.Head,head],[BI.Neck,1-head-back],[BI.Spine2,back]];
    });
  }
  const bones = names.map(n => B[n]), body = new THREE.SkinnedMesh(G.build(), SKIN_MAT);
  // culled like everything else, with a sphere big enough for any pose (lying, handstand, arms out: the hips never leave the rig's centre,
  // root motion moves the rig). It was never culled: every body was skinned and drawn in every shadow map even far off screen (17.11.2026)
  body.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, .8, 0), 1.8);
  rig.add(body);
  body.bind(new THREE.Skeleton(bones));
  if (festivalLED) {
    const strip = new THREE.SkinnedMesh(festivalLED.build(), FESTIVAL_RGB);
    strip.name = 'FestivalSpectralStrips';
    strip.userData.clothDetail = true;
    strip.boundingSphere = body.boundingSphere.clone();
    rig.add(strip);
    strip.bind(body.skeleton, body.bindMatrix);
  }
  for (const [kind, pieces] of Object.entries(patches)) {
    if (!pieces.length) continue;
    const patch = new THREE.SkinnedMesh(G.badges(pieces), patchMat(kind, look.acc || '#E2611A'));
    patch.boundingSphere = body.boundingSphere.clone();
    patch.userData.clothDetail = true;
    rig.add(patch);
    patch.bind(body.skeleton, body.bindMatrix);
  }
  rig.scale.setScalar(scale);
  if (tp === 'teeTeam') {
    const badge = add(B.Spine2, new THREE.CircleGeometry(.061, 20), M('#E2611A', .82), 0, .044, .122 * dp);
    badge.rotation.x = .12;
    const ink = M('#18181B', .85);
    const shapes = [
      [[-.031, -.02], [-.031, .023], [-.004, .023], [-.004, .014], [-.021, .014], [-.021, .004], [-.008, .004], [-.008, -.005], [-.021, -.005], [-.021, -.02]],
      [[.002, .014], [.002, .023], [.031, .023], [.031, .014], [.022, .014], [.022, -.02], [.012, -.02], [.012, .014]],
    ].map(path => new THREE.Shape(path.map(([x, y]) => new THREE.Vector2(x, y))));
    const letters = add(B.Spine2, new THREE.ShapeGeometry(shapes), ink, 0, .044, .122 * dp + .001);
    letters.rotation.copy(badge.rotation); letters.userData.clothDetail = true;
    const label = add(B.Spine2, new THREE.PlaneGeometry(.134, .016), ink, 0, -.031, .122 * dp);
    label.userData.clothDetail = true;
  }
  // CHAIN (17.11.2026, owner «улучши визуал других человечков»): it was a flat ring around the neck (read as a collar from above).
  // Now a loop that lies on the shoulders just outside the collar and hangs down onto the chest; a heavy one (chain 2) is longer,
  // thicker and carries a medallion. Coordinates in Spine2's space; fz(y) = the front of the top at that height + the cord.
  if (look.chain) { const NK = P('Neck'), ny = NK.y, nz = NK.z, heavy = look.chain > 1, tb = heavy ? .012 : .0075, drop = heavy ? .2 : .155, gm = M(C.gold, .34, .72);
    const surf = y => y < .065 ? .115 + .0025 * y / .065 : y < .112 ? .1175 - .0095 * (y - .065) / .047 : .108 - .022 * clamp((y - .112) / Math.max(.01, ny - .128), 0, 1);
    const fz = y => nz * y / ny + surf(y) * dp + .014 * (baggy > 1 ? 1.4 : 1) + bd.belly * .045 * clamp((ny - y) / drop, 0, 1) + tb, yb = ny - drop;
    const pts = [[0, yb, fz(yb) + .002], [.046, yb + .022, fz(yb + .022)], [.074, ny - drop * .52, fz(ny - drop * .52)], [.09, ny - .012, nz + .045 * dp], [.092, ny + .006, nz - .02], [.062, ny + .012, nz - .07], [0, ny + .014, nz - .084]];
    const loop = pts.concat(pts.slice(1, -1).reverse().map(([x, y, z]) => [-x, y, z])).map(([x, y, z]) => new THREE.Vector3(x, y, z));
    const links = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(loop, true, 'centripetal'), 66, tb, 6, true);
    const linkColor = [];
    for (let i = 0; i < links.attributes.position.count; i++) {
      const ring = Math.floor(i / 7), angle = i % 7 * Math.PI / 3;
      const tone = .83 + .15 * Math.cos(ring * Math.PI * 2 / 3 + angle * 2);
      linkColor.push(tone, tone, tone);
    }
    links.setAttribute('color', new THREE.Float32BufferAttribute(linkColor, 3));
    add(B.Spine2, links, MV(C.gold, .34, .72), 0, 0, 0);
    if (heavy) { const my = yb - .028, md = add(B.Spine2, new RoundedBoxGeometry(.035, .035, .012, 1, .004), gm, 0, my, fz(my) + .004); md.rotation.set(.12, 0, Math.PI / 4);
      const inset = add(md, new RoundedBoxGeometry(.022, .022, .003, 1, .001), M(shadeOf(C.gold, .61), .5, .45), 0, 0, .006);
      inset.userData.clothDetail = true;
      add(B.Spine2, new THREE.TorusGeometry(.009, .003, 4, 10), gm, 0, yb - .004, fz(yb) + .002); } }
  if (bd.pack) {
    const pack = M(bd.pack, .9);
    add(B.Spine2, new RoundedBoxGeometry(.253, .313, .119, 2, .042), pack, 0, .026, -.178 * dp);
    add(B.Spine2, new RoundedBoxGeometry(.198, .128, .042, 2, .018), M(shadeOf(bd.pack, .81), .92), 0, -.033, -.236 * dp);
    add(B.Spine2, new RoundedBoxGeometry(.166, .012, .009, 1, .004), M(shadeOf(bd.pack, .46), .88), 0, .013, -.258 * dp);
  }
  if (hoodBone) {
    const hood = add(hoodBone, FOLDED_HOOD, MV(C.top,.94,0,FINISH.cloth), 0, 0, -.009 * dp);
    hood.name = 'FoldedHood';
    hood.scale.set(Math.sqrt(cw), 1, Math.sqrt(dp));
  }
  seg(B.Neck, P('Head'), .052 * Math.sqrt(A), skin);
  const head = addCityHead(B.Head, { ...look, col: C }, bd, { M, MV, glowOf });
  for (const p of head.userData.contactPoints) PTS.push({ m: head, p, r: 0 });
  // ---- CUSTOM details (owner 16.11.2026 «добавь механику улучшения одежды… нашивки»): look.cus = { head, top, pants, kicks }, each 0…3.
  if (cus.pants >= 3) { const ch = add(B.Hips, new THREE.TorusGeometry(.085, .0075, 6, 20, Math.PI), M('#C9CED6', .28, 1), -(.153 * bd.hip + .012), -.005, .005); ch.rotation.set(0, Math.PI / 2, Math.PI); ch.scale.y = 1.25; }
  // shadows: the body, the head, hair, hats, bags cast them; eyes, ears, laces, pins, patches don't (invisible from above, but each was one
  // more draw call in every shadow map every frame — owner 17.11.2026 «…притормаживает… займись оптимизацией»)
  root.userData.person = true;
  root.traverse(m => { if (!m.isMesh) return; m.receiveShadow = true; if (m.isSkinnedMesh) { m.castShadow = !m.userData.clothDetail; m.customDepthMaterial = DEPTH_SKIN; return; }
    const g = m.geometry; if (!g.boundingSphere) g.computeBoundingSphere(); const rr = g.boundingSphere.radius * Math.max(m.scale.x, m.scale.y, m.scale.z) * scale;
    m.castShadow = g.type !== 'CircleGeometry' && rr >= .05; if (rr < .045 && g.type !== 'CircleGeometry' && !(m.material.emissive && m.material.emissive.getHex())) m.userData.tiny = true; });   // tiny = hidden when the map is zoomed far out (city3d.js)
  // the rigid pieces in plain clothing materials → one skinned piece on the same bones (22.11.2026, see mergeParts); opt.noMerge keeps them apart
  const parts = opt.noMerge ? [] : mergeParts(rig, body);
  personShadows(root);   // the rest (glowing details, patches): one merged shadow piece per bone
  // ground contact points from the real shapes: capsule = its two end centres + radius, sphere = centre + radius, anything else = box corners
  root.traverse(m => { if (!m.isMesh || m.isSkinnedMesh || m.parent === head || m.userData.clothDetail || m.geometry.type === 'CircleGeometry') return; const g = m.geometry, P = g.parameters || {}, sc = Math.max(m.scale.x, m.scale.y, m.scale.z) * scale;
    if (g.type === 'CapsuleGeometry') { const h = P.height / 2; PTS.push({ m, p: new THREE.Vector3(0, h, 0), r: P.radius * sc }, { m, p: new THREE.Vector3(0, -h, 0), r: P.radius * sc }); }
    else if (g.type === 'SphereGeometry' && P.thetaLength > 3) PTS.push({ m, p: new THREE.Vector3(), r: P.radius * sc });
    else { g.computeBoundingBox(); const b = g.boundingBox; for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) PTS.push({ m, p: new THREE.Vector3(x, y, z), r: 0 }); } });
  // the skinned body touches the ground with its joints: a ball of the limb's / chest's thickness around each bone
  { const O = new THREE.Vector3(), pt = (n, r) => PTS.push({ m: B[n], p: O, r: r * scale });
    pt('Hips', .1 * hd); pt('Spine', .1 * dp * wd + bd.belly * .05); pt('Spine1', .105 * dp); pt('Spine2', .116 * dp); pt('Neck', .07);
    for (const s of ['Left', 'Right']) { pt(s + 'Arm', .066 * A); pt(s + 'ForeArm', .05 * A); pt(s + 'Hand', .037 * A); pt(s + 'UpLeg', .092 * L); pt(s + 'Leg', .069 * L); pt(s + 'Foot', .06); } }
  // Update only the contact points and their ancestors. The renderer updates the rest of the rig.
  const contactNodes = new Set([root]);
  function addContactNode(node) {
    if (contactNodes.has(node)) return;
    addContactNode(node.parent);
    contactNodes.add(node);
  }
  for (const { m } of PTS) addContactNode(m);
  const mixer = new THREE.AnimationMixer(rig);
  const motion = bd.motion ?? .5, quiet = bd.old || motion < .42;
  const J = { root, rig, B, body, parts, dp, mixer, cur: null, act: null, dx: 0, dz: 0, pull: .55, maxR: .95,
    idle: opt.idle || (bd.motion === undefined ? 'Stand' : DANCER_IDLE[Math.floor(motion * DANCER_IDLE.length)]),
    stepScale: scale * (bd.old ? .87 : .94 + motion * .12), armSwing: bd.old || bd.pack ? .6 + motion * .14 : .78 + motion * .22 };
  // advance the animation and move the dancer by the clip's own travel
  J.tick = dt => {
    if (festivalLED) festivalPhase.value = reducedGlow.matches ? 0 : performance.now() / 5700 % 1;
    const a = J.act, r = a && RM[J.cur], t0 = a ? a.time : 0;
    if (a && J.phraseTime != null) {
      if (!a.paused) a.time = J.phraseTime - dt * a.timeScale;
      J.phraseTime = null;
    }
    mixer.update(dt);
    if (r && a.timeScale > 0) {
      let t1 = a.time; const loop = J.rmLoop;
      rmAt(r, t0, loop, _a);
      if (t1 < t0 - 1e-4) { rmAt(r, r.dur, loop, _b); J.dx += (_b[0] - _a[0]) * scale; J.dz += (_b[1] - _a[1]) * scale; rmAt(r, 0, loop, _a); }   // wrapped around
      rmAt(r, t1, loop, _b); J.dx += (_b[0] - _a[0]) * scale; J.dz += (_b[1] - _a[1]) * scale;
    }
    // stay near the spot: a soft pull back and a hard edge
    const contactMove = /^City_(Floorrock_|Backspin)/.test(J.cur);
    const k = Math.exp(-dt * (contactMove ? .22 * J.pull : J.pull)); J.dx *= k; J.dz *= k;
    const d = Math.hypot(J.dx, J.dz); if (d > J.maxR) { J.dx *= J.maxR / d; J.dz *= J.maxR / d; }
    rig.position.x = J.dx; rig.position.z = J.dz;
    if (hoodBone) {
      // The folded fabric compresses under the shoulder load, using the same bone for the mesh and contact tests.
      const backspinTime = /^City_Backspin/.test(J.cur) ? a.time : 0;
      const flatten = .91 * smooth(.68, 1.06, backspinTime) * (1 - smooth(2.20, 2.51, backspinTime));
      hoodBone.scale.z = 1 - flatten;
      hoodBone.position.z = -.094 * dp * flatten;
    }
    // GROUND: nothing of the body may go under the asphalt (owner 14.11 «при падении… не проваливался под землю»).
    // The lowest point of head / hands / elbows / knees / feet / hips / chest is measured each frame; the body is lifted onto the
    // ground, and while lying after a fall (J.rest) it is laid exactly on it.
    rig.position.y = 0;
    for (const node of contactNodes) node.updateWorldMatrix(false, false, true);
    let low = Infinity;
    for (const { m, p, r } of PTS) {
      const e = m.matrixWorld.elements, y = e[1] * p.x + e[5] * p.y + e[9] * p.z + e[13] - r;
      if (y < low) low = y;
    }
    low -= root.position.y;
    const contact = contactMove ? a.getEffectiveWeight() : 0;
    const want = J.rest ? -low : low > 0 ? -Math.min(low, .065) * contact : -low;
    J.lift = want >= (J.lift || 0) ? want : lerpTo(J.lift || 0, want, dt, J.rest ? 14 : 10);   // up at once, down softly
    rig.position.y = J.lift;
  };
  J.home0 = () => { J.dx = J.dz = 0; rig.position.x = rig.position.z = 0; };
  J.play = (name, o = {}) => {
    // «Breakdance_Ready» used as «just stand there» = this person's standing loop (the raw recording is a sidestep, see makeStand)
    if (name === 'Breakdance_Ready' && !o.raw && CLIPS[J.idle]) name = J.idle;
    const c = CLIPS[name]; if (!c) return;
    // already standing in this loop: keep going (a restart from frame 0 was a visible jump), only take the new speed
    if (STANDS[name] && J.cur === name && J.act && J.act.enabled) { J.act.timeScale = (o.speed || 1) * STANDS[name].sp; return; }
    J.rmLoop = !(o.travel ?? TRAVEL.test(name));   // loops stay in place; going down, footwork, freezes travel for real
    const once = o.once ?? !!(c.userData && c.userData.once);
    const a = mixer.clipAction(c); a.reset(); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); a.clampWhenFinished = once;
    a.timeScale = (o.speed || 1) * (STANDS[name] ? STANDS[name].sp : 1); if (o.at) a.time = o.at % c.duration;
    J.phraseTime = null;
    // the very first clip starts at full weight: a fade-in from 0 showed the T-pose for a moment (new people, the hero after changing clothes)
    a.play(); if (J.act && J.act !== a) J.act.crossFadeTo(a, o.fade ?? .25, false); else if (J.act === a || !J.act) a.setEffectiveWeight(1);
    J.act = a; J.cur = name;
  };
  // a calmer (or another) standing loop for this person; switches at once if he is standing now
  J.setIdle = name => {
    if (name === 'Stand_Calm' && quiet) name = 'Stand_Quiet';
    if (!CLIPS[name] || J.idle === name) return;
    const was = J.cur === J.idle; J.idle = name;
    if (was) J.play(name, { at: motion * CLIPS[name].duration, fade: .25 });
  };
  J.hipsWorld = new THREE.Vector3();
  return J;
}
