// Dancers driven by real motion capture (Mixamo, licensed for use in this app; converted to anim/bboy.json:
// 22 bones, rest pose + 30 fps tracks, quats ×1000, hips cm). Our own low-poly body and clothes hang on the bones,
// so the moves play exactly as recorded — no hand-posed angles. Look = HERO.topDown(level, acc).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { personShadows } from './city3d-perf.js?v=1';

let DATA = null;
const CLIPS = {};
// ROOT MOTION: the floor-plane travel of the hips is taken OUT of the tracks and moves the dancer instead (J.tick), so the
// next move starts where the last one ended — no snapping back to the centre (owner 14.11 «фигурка телепортируется за круг»).
// RM[name] = {xz: Float32Array (m), dur, fps, end: [x, z]}; looping plays use the detrended curve (travel removed) so loops stay in place.
const RM = {};
export async function loadMocap(url = 'anim/bboy.json?v=2') {
  if (DATA) return DATA;
  DATA = await (await fetch(url)).json();
  for (const n of MIRROR) if (DATA.clips[n]) DATA.clips[n + '_M'] = mirrorClip(DATA.clips[n]);
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
    CLIPS[name].userData = { seam, once: seam > 15 };
  }
  gaitPrep();
  // the two standing loops (see makeStand): «Stand» = a b-boy bobbing to the beat (from «Bboy_Uprock»), «Stand_Calm» = an ordinary
  // person shifting the weight from foot to foot (from «Walking», slowed down) — passers-by, the guard, workers, the tailor
  makeStand('Stand', 'Bboy_Uprock', { a: .2, al: .07, sp: 1 });
  makeStand('Stand_Calm', 'Walking', { a: .28, al: .07, sp: .45 });
  return DATA;
}
// MIRRORED MOVES «<name>_M» (owner 17.11.2026 «добавь вариаций футворка во время батлов (слишком однообразно начинают и делают всё)»):
// the same recording danced to the other side. The skeleton is symmetric (the rest pose of every Left bone = its Right bone reflected
// through the body's middle plane), so the reflection is exact: Left/Right tracks swap, each rotation (x, y, z, w) → (x, −y, −z, w), the
// hips go to −x. Checked in node: every joint of the copy = the original's joint on the other side reflected, error 0.0000 m.
// The names keep their stem, so TRAVEL / power / freeze tests and clipLen work as before.
const MIRROR = ['Breakdance_Footwork_1', 'Breakdance_Footwork_2', 'Breakdance_Footwork_3', 'Breakdance_Footwork_To_Freeze', 'Breakdance_Uprock_To_Ground',
  'Breakdance_Uprock', 'Breakdance_Uprock_Var_1', 'Breakdance_Uprock_Var_2', 'Bboy_Uprock', 'Brooklyn_Uprock', 'Crossleg_Freeze'];
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
const _v = new THREE.Vector3(), lerpTo = (a, b, dt, k) => a + (b - a) * (1 - Math.exp(-dt * k));
const _a = [0, 0], _b = [0, 0], TRAVEL = /To_Ground|Footwork|Freeze|Headspin_Start|Headspin_End|Ending/;

const mats = new Map();
// NO GLARE ON PEOPLE (owner 17.11.2026 «снизь отблик от фонарей… сильный пересвет, будто зеркало на кроссовках отражает полностью»).
// Under a lamp plus the crew's fill light a white tee / white sole came out at 1.2–1.6 (HDR) — burnt white after the tone curve, and over
// the bloom threshold (.84), so it grew a halo like a mirror catching the lamp. Now the brightness of everything a PERSON wears is
// rolled off softly above .5 and can never pass .8: mid and dark colours are untouched, light ones keep their folds and shading,
// nothing on a person blooms. The glowing custom details (glowOf) are left out on purpose — they are meant to glow.
const TAME_FN = 'vec3 tameHi(vec3 c){ float l = dot(c, vec3(.299, .587, .114)); if (l <= .5) return c; return c * ((.5 + (l - .5) / (1. + (l - .5) / .3)) / l); }\n';
const tameShader = sh => { sh.fragmentShader = sh.fragmentShader.replace('void main() {', TAME_FN + 'void main() {').replace('#include <opaque_fragment>', 'outgoingLight = tameHi(outgoingLight);\n  #include <opaque_fragment>'); };
const tame = m => { m.onBeforeCompile = tameShader; return m; };
const M = (c, r = .8, m = 0) => { const k = c + r + m; if (!mats.has(k)) mats.set(k, tame(new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m }))); return mats.get(k); };
const UP = new THREE.Vector3(0, 1, 0);
// two-sided cloth (a brim seen from below, an open band): its own cached material, the one-sided M() ones stay as they are
const M2 = (c, r = .8) => { const k = 'd' + c + r; if (!mats.has(k)) mats.set(k, tame(new THREE.MeshStandardMaterial({ color: c, roughness: r, side: THREE.DoubleSide }))); return mats.get(k); };
// a limb piece from the bone's origin to its child's rest position
function seg(bone, to, r, mat, r2) {
  const len = to.length(), m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(.01, len - r * 1.4), 3, 10), mat);
  m.scale.set(1, 1, (r2 || r) / r);
  m.quaternion.setFromUnitVectors(UP, to.clone().normalize()); m.position.copy(to).multiplyScalar(.5);
  bone.add(m); return m;
}
// ---------- ONE SMOOTH BODY (owner 16.11.2026 «улучши визуализацию человечков (меньше шарнирности)») ----------
// The torso, arms and legs used to be separate capsules and boxes hung on the bones — every elbow, knee, shoulder and the
// waist showed as a hinge. Now they are ONE skinned mesh: rings of vertices along the spine / arm / leg, each vertex follows
// one bone, or two bones near a joint (soft bend). Colours (top, sleeves, skin, trousers) are vertex colours ⇒ one draw call.
// Small balls inside the knees, elbows and shoulders keep the volume when a joint bends hard. Head, hands, shoes and
// accessories stay rigid pieces on their bones. The skeleton and the moves are untouched.
const _p = new THREE.Vector3(), _c1 = new THREE.Color(), _c2 = new THREE.Color();
const SKIN_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .82 });
// a soft rim of light on the edges of the body: a figure reads as one shape against the dark asphalt when seen from above.
// 17.11.2026: the rim is mostly for DARK clothes — on white (soles seen edge-on from above, a white tee) it only added glare,
// so it fades to 30 % on light colours; then the same soft roll-off as every other piece of clothing (tameHi above).
SKIN_MAT.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('void main() {', TAME_FN + 'void main() {').replace('#include <opaque_fragment>',
  'float rimK = pow(1. - clamp(dot(normalize(normal), normalize(vViewPosition)), 0., 1.), 2.4) * (1. - .7 * smoothstep(.15, .6, dot(diffuseColor.rgb, vec3(.299, .587, .114))));\n  outgoingLight += diffuseColor.rgb * rimK * vec3(.62, .68, .86) * .5;\n  outgoingLight = tameHi(outgoingLight);\n  #include <opaque_fragment>'); };
const shadeOf = (c, k) => '#' + _c1.set(c).multiplyScalar(k).getHexString(), mixOf = (c, c2, k) => '#' + _c1.set(c).lerp(_c2.set(c2), k).getHexString();
function skinGeo() {
  const pos = [], col = [], si = [], sw = [], idx = [], seams = [], G = { n: 0 };
  // sh = brightness of the vertex colour (painted shade: darker under the arms, between the legs, under a hem)
  const vert = (p, c, w, sh = 1) => { pos.push(p.x, p.y, p.z); _c1.set(c); col.push(_c1.r * sh, _c1.g * sh, _c1.b * sh); const a = w[0], b = w[1] || [0, 0], t = a[1] + b[1]; si.push(a[0], b[0], 0, 0); sw.push(a[1] / t, b[1] / t, 0, 0); return G.n++; };
  // n points of a (super)ellipse around c in the plane (u, v); u × v must point along the limb. ao = [brightness, darker towards +u, darker towards +v]
  G.ring = (c, u, v, ru, rv, color, w, n, e = 1, ao) => { const i0 = G.n; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, cs = Math.cos(a), sn = Math.sin(a);
    vert(_p.copy(c).addScaledVector(u, Math.sign(cs) * Math.pow(Math.abs(cs), e) * ru).addScaledVector(v, Math.sign(sn) * Math.pow(Math.abs(sn), e) * rv), color, w, ao ? ao[0] * (1 - Math.max(0, cs * ao[1] + sn * ao[2])) : 1); } return { i0, n }; };
  // a ring of any shape: points, a colour (or one per point), weights (or a list per point), brightness per point
  G.loop = (pts, cols, ws, shs) => { const i0 = G.n; pts.forEach((p, i) => vert(p, Array.isArray(cols) ? cols[i] : cols, Array.isArray(ws[0][0]) ? ws[i] : ws, shs ? shs[i] : 1)); return { i0, n: pts.length }; };
  G.join = (A, B) => { for (let i = 0, n = A.n; i < n; i++) { const j = (i + 1) % n; idx.push(A.i0 + i, A.i0 + j, B.i0 + i, A.i0 + j, B.i0 + j, B.i0 + i); } };
  G.pole = (R, p, color, w, start, sh = 1) => { const k = vert(p, color, w, sh); for (let i = 0; i < R.n; i++) { const j = (i + 1) % R.n; if (start) idx.push(k, R.i0 + j, R.i0 + i); else idx.push(R.i0 + i, R.i0 + j, k); } };
  G.seam = (A, B) => seams.push([A, B]);
  G.quad = (a, b, c, d, color, wa, wc) => { const i = vert(a, color, wa); vert(b, color, wa); vert(c, color, wc); vert(d, color, wc); idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2); };
  const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
  G.ball = (c, r, color, w, n = 8) => { let prev = null; const m = 5; for (let k = 1; k < m; k++) { const a = -Math.PI / 2 + k / m * Math.PI, R = G.ring(_p.copy(c).addScaledVector(Y, Math.sin(a) * r).clone(), Z, X, Math.cos(a) * r, Math.cos(a) * r, color, w, n);
      if (prev) G.join(prev, R); else G.pole(R, c.clone().addScaledVector(Y, -r), color, w, true); prev = R; } G.pole(prev, c.clone().addScaledVector(Y, r), color, w, false); };
  // a limb along the joints P[0..m]: bones[k] drives the piece P[k]→P[k+1], `pre` drives what lies before P[0]; near joint k the
  // two neighbours are blended over ±bz[k] metres. st = stations [s (m along the limb from P[0]), ru (forward), rv (sideways), colour, seam?, brightness?];
  // seam: 1 = a colour change (same place, no faces between, normals shared), 2 = a step with faces (a sleeve's opening);
  // returns the rings (for stripes). fwd = the body's forward; e = superellipse power (1 = round); side = [towards +u, towards +v] = the shaded side
  G.limb = (P, bones, pre, bz, st, n, fwd, e = 1, s0, s1, side) => {
    const L = [0]; for (let k = 1; k < P.length; k++) L.push(L[k - 1] + P[k].distanceTo(P[k - 1]));
    const d = P[P.length - 1].clone().sub(P[0]).normalize(), u = fwd.clone().addScaledVector(d, -fwd.dot(d)).normalize(), v = d.clone().cross(u);
    const at = s => { if (s <= 0) return P[0].clone().addScaledVector(d, s); for (let k = 1; k < P.length; k++) if (s <= L[k]) return P[k - 1].clone().lerp(P[k], (s - L[k - 1]) / (L[k] - L[k - 1])); return P[P.length - 1].clone().addScaledVector(d, s - L[L.length - 1]); };
    const wt = s => { for (let k = 0; k < P.length - 1; k++) { const b = bz[k] || 0; if (b && Math.abs(s - L[k]) < b) { let t = .5 + (s - L[k]) / (2 * b); t = t * t * (3 - 2 * t); const a = k ? bones[k - 1] : pre; return [[a, 1 - t], [bones[k], t]]; } }
      let k = 0; while (k < bones.length - 1 && s > L[k + 1]) k++; return [[s < 0 ? pre : bones[k], 1]]; };
    const rings = []; let prev = null;
    st.forEach(([s, ru, rv, color, seam, sh = 1]) => { const ao = side || sh !== 1 ? [sh, side ? side[0] : 0, side ? side[1] : 0] : null, R = G.ring(at(s), u, v, ru, rv, color, wt(s), n, e, ao); R.s = s; R.c = at(s); R.ru = ru; R.rv = rv; R.w = wt(s); R.col = color;
      if (prev) { if (seam === 1) G.seam(prev, R); else G.join(prev, R); } else G.pole(R, at(s0), color, wt(s0), true, sh * .9); prev = R; rings.push(R); });
    G.pole(prev, at(s1), st[st.length - 1][3], wt(s1), false, st[st.length - 1][5] || 1); rings.u = u; rings.v = v; rings.d = d; rings.at = at; rings.wt = wt; return rings; };
  G.build = () => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4)); g.setIndex(idx); g.computeVertexNormals();
    const N = g.attributes.normal; seams.forEach(([A, B]) => { for (let i = 0; i < A.n; i++) { _p.set(N.getX(A.i0 + i) + N.getX(B.i0 + i), N.getY(A.i0 + i) + N.getY(B.i0 + i), N.getZ(A.i0 + i) + N.getZ(B.i0 + i)).normalize(); N.setXYZ(A.i0 + i, _p.x, _p.y, _p.z); N.setXYZ(B.i0 + i, _p.x, _p.y, _p.z); } });
    return g; };
  return G;
}
// small extras for the CUSTOM details of clothes: glowing trim and round sewn patches (drawn once per colour)
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
export const SKINS = ['#F0C8A4', '#E3B088', '#C68A5E', '#A9713F', '#80502E', '#5C3820'];
export const HAIRS = ['#1E1714', '#17120f', '#2e1e14', '#4d3120', '#7a4a22', '#b98d4e', '#dcc9a0', '#a23c1f', '#8d9096', '#e9e9ec'];
const MEN = ['short', 'short', 'buzz', 'bald', 'afro', 'top', 'mohawk', 'dreads', 'curly', 'long'], WOMEN = ['tail', 'bun', 'long', 'braids', 'afro', 'short', 'curly', 'buns'];
function mul(seed) { let a = seed >>> 0 || 1; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// a body made up from a number: the same seed always gives the same person. o = { type, girl, old, + any field to fix }
export function bodyOf(seed, o = {}) {
  const r = mul(seed * 2654435761), names = Object.keys(BODY_TYPES), pick = a => a[Math.floor(r() * a.length)];
  const type = o.type || pick(o.girl ? ['avg', 'slim', 'slim', 'small', 'lanky', 'athl', 'stocky', 'heavy'] : names), T = BODY_TYPES[type] || BODY_TYPES.avg, j = k => 1 + (r() - .5) * k;
  const b = { type, h: T.h * j(.05), limb: T.limb * j(.07), arm: T.arm * j(.07), chest: T.chest * j(.05), waist: T.waist * j(.06), hip: T.hip * j(.05), belly: T.belly * j(.3), head: T.head * j(.03),
    skin: pick(SKINS), hair: o.old ? pick(['#8d9096', '#e9e9ec', '#b9bcc2']) : HAIRS[Math.floor(Math.pow(r(), 1.6) * 8)], style: pick(o.girl ? WOMEN : MEN), beard: !o.girl && r() < (o.old ? .5 : .28), girl: !!o.girl };
  if (o.girl) { b.chest *= .9; b.arm *= .88; b.hip *= 1.07; b.waist *= .93; b.h *= .96; }
  return Object.assign(b, o);
}
const BASE = BODY_TYPES.avg;
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
  const skin = M(C.skin, .7), top = M(C.top, .78), pants = M(C.pants, .85), shoe = M(C.shoe, .5), sole = M(C.sole || '#eee', .6), hair = M(C.hair, .9);
  const sleeveLong = !/^tee/.test(look.top || 'tee'), sleeve = M(C.sleeve || C.top, .78), baggy = /Big|bomber|track|hoodie/.test(look.top || '') ? 1.06 : 1;
  const cw = bd.chest * gW * baggy, ww = bd.waist * baggy, dp = 1 + (bd.chest - 1) * .7 + bd.belly * .12, add = (bone, geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); bone.add(m); return m; };
  // ---- the smooth body: torso + arms + HANDS + legs + SHOES as one skinned mesh (see skinGeo) ----
  // 16.11.2026 night (owner «улучши визуал главного персонажа, он всё ещё слишком шарнирный»): the hands and the shoes used to be
  // boxes hung on the wrist and the ankle — now they grow out of the same surface (palm, curled fingers, thumb; a sneaker that bends at
  // the toes and whose collar follows the shin). The top is its own layer of cloth over the trousers (hem, rib band, collar, yoke),
  // trouser legs are wide and stack on the shoe (or end in a cuff), and the cloth is shaded by paint (under the arms, between the legs).
  rig.updateMatrixWorld(true);
  const names = Object.keys(R), BI = {}; names.forEach((n, i) => { BI[n] = i; });
  const JP = n => new THREE.Vector3().setFromMatrixPosition(B[n].matrixWorld), FWD = new THREE.Vector3(0, 0, 1), DOWN = new THREE.Vector3(0, -1, 0), G = skinGeo();
  const hi = !!opt.hero, NT = 24, NA = 14, NL = 16, cus = look.cus || {}, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hd = 1 + (bd.hip - 1) * .8, wd = 1 + (ww - 1) * .5, topC = C.top, slC = C.sleeve || C.top, tp = look.top || 'tee', yk = C.yoke && C.yoke !== topC ? C.yoke : null, uc = yk || topC;
  // ground contact points given in rest-pose space (they ride on a bone): the body may never sink into the asphalt
  const PTS = [], lpt = (bone, wp, r = 0) => PTS.push({ m: B[bone], p: B[bone].worldToLocal(wp.clone()), r: r * scale });
  const _qi = new THREE.Quaternion(), addW = (bone, geo, mat, wp, wq) => { const m = new THREE.Mesh(geo, mat); m.position.copy(B[bone].worldToLocal(wp.clone())); B[bone].getWorldQuaternion(_qi).invert(); m.quaternion.copy(_qi); if (wq) m.quaternion.multiply(wq); B[bone].add(m); return m; };
  { const P = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck'].map(JP), y0 = P[0].y, S = n => JP(n).y - y0, shW = Math.abs(JP('LeftArm').x) + .03, bl = bd.belly * .03;
    const hemW = .152 * (bd.hip * .55 + ww * .45), hemD = .102 * (hd * .55 + wd * .45), TB = [BI.Hips, BI.Spine, BI.Spine1, BI.Spine2], TZ = [0, .04, .04, .04];
    // trousers: the seat up to the waistband (the top hangs over it)
    G.limb(P, TB, BI.Hips, TZ, [[-.105, .068 * hd, .09 * bd.hip, C.pants, 0, .78], [-.07, .094 * hd, .138 * bd.hip, C.pants, 0, .86], [-.02, .102 * hd, .152 * bd.hip, C.pants, 0, .95], [.055, hemD, hemW, C.pants]], NT, FWD, .78, -.125, .07);
    // the top: hem (a big tee hangs lower; jackets end in a rib band) → waist → chest → sloped shoulders → collar
    const rib = /track|bomber|hoodie/.test(tp) && C.cuff ? C.cuff : null, drop = tp === 'teeBig' ? .08 : /^tee/.test(tp) ? .045 : .015, lo = .04 - drop, ex = (tp === 'teeBig' ? .017 : .01) * baggy;
    const st = [[lo, hemD + ex, hemW + ex * 1.15, rib || topC, 0, .8]];
    if (rib) st.push([lo + .036, hemD + ex, hemW + ex * 1.15, rib, 0, .92], [lo + .036, hemD + ex + .005, hemW + ex + .006, topC, 1, .92]);
    const sy = S('Spine2') + .05, nk = S('Neck');
    st.push([S('Spine') + .02, .1 * dp * wd + bl, .155 * ww, topC, 0, .93], [S('Spine1'), .105 * dp + bl * .6, .175 * (cw * .6 + ww * .4), topC, 0, .97], [S('Spine2'), .115 * dp, .195 * cw, topC]);
    if (yk) st.push([sy, .117 * dp, .204 * cw, topC], [sy, .117 * dp, .204 * cw, yk, 1]);
    st.push([S('Spine2') + .065, .1175 * dp, .206 * cw, uc, 0, 1.03], [S('Spine2') + .112, .108 * dp, shW, uc, 0, 1.07], [nk - .016, .086 * dp, shW * .62, uc, 0, 1.07]);
    if (/track/.test(tp)) st.push([nk + .008, .073, .081, uc], [nk + .05, .067, .073, C.trim || uc]);                       // stand collar
    else if (tp === 'bomber') st.push([nk + .006, .076, .084, rib || uc], [nk + .03, .069, .075, rib || uc]);                 // rib collar
    else { const rc = shadeOf(topC, .72); st.push([nk + .002, .072, .082, topC], [nk + .002, .072, .082, rc, 1], [nk + .02, .063, .07, rc]); }   // crew neck
    const tr = G.limb(P, TB, BI.Hips, TZ, st, NT, FWD, .78, lo - .012, st[st.length - 1][0] + .012);
    // the zip / button line of a jacket follows the chest
    if (C.trim) { const zr = tr.filter(R => R.s >= lo + (rib ? .036 : 0) - 1e-4 && R.s <= nk + .01 && R.col !== rib), f = R => R.c.clone().addScaledVector(tr.u, R.ru + .005);
      for (let i = 0; i < zr.length - 1; i++) { const a = zr[i], b = zr[i + 1]; if (b.s - a.s < 1e-4) continue;
        G.quad(f(a).addScaledVector(tr.v, .01), f(a).addScaledVector(tr.v, -.01), f(b).addScaledVector(tr.v, .01), f(b).addScaledVector(tr.v, -.01), C.trim, a.w, b.w); } } }
  for (const s of ['Left', 'Right']) { const sg = s === 'Left' ? 1 : -1, bn = k => BI[s + k];
    { // arm: shoulder → upper arm → elbow → forearm → cuff → hand (palm, knuckles, fingers curled a little) + thumb
      const Jt = [s + 'Arm', s + 'ForeArm', s + 'Hand'].map(JP), d = Jt[2].clone().sub(Jt[0]).normalize(), E = Jt[0].distanceTo(Jt[1]), Wd = E + Jt[1].distanceTo(Jt[2]), fa = A * .7 + .3, hs = (A * .3 + .7) * (hi ? 1.05 : 1);
      const low = sleeveLong ? slC : C.skin, hc = look.gloves ? '#18181B' : C.skin, tipC = C.skin;
      const Kn = Jt[2].clone().addScaledVector(d, .074 * hs).addScaledVector(DOWN, .006), Tp = Jt[2].clone().addScaledVector(d, .128 * hs).addScaledVector(DOWN, .042 * hs), HL = Wd + Jt[2].distanceTo(Kn), TL = HL + Kn.distanceTo(Tp);
      const st = [[-.05, .061 * A, .065 * A, uc], [0, .067 * A, .07 * A, uc], [.045, .065 * A, .067 * A, uc], [.045, .065 * A, .067 * A, slC, 1]];
      if (sleeveLong) st.push([.14, .059 * A, .06 * A, slC]);
      else st.push([E * .46, .064 * A, .066 * A, topC], [E * .46, .052 * A, .053 * A, C.skin, 2, .88]);
      st.push([E - .07, .053 * A, .053 * A, low], [E - .035, .051 * A, .051 * A, low], [E, .05 * A, .05 * A, low], [E + .035, .05 * fa, .051 * fa, low], [E + .09, .051 * fa, .052 * fa, low], [E + .17, .046 * fa, .046 * fa, low]);
      const cf = sleeveLong && C.cuff ? C.cuff : null, wb = !sleeveLong && look.wrist && s === 'Left' ? look.wrist : null;
      if (cf) st.push([Wd - .062, .042 * fa, .042 * fa, low], [Wd - .062, .046 * fa, .046 * fa, cf, 1], [Wd - .014, .044 * fa, .044 * fa, cf]);                       // rib cuff
      else if (wb) st.push([Wd - .075, .041 * fa, .041 * fa, low], [Wd - .075, .0445 * fa, .0445 * fa, wb, 1], [Wd - .04, .0435 * fa, .0435 * fa, wb], [Wd - .04, .039 * fa, .039 * fa, low, 1], [Wd - .014, .037 * fa, .037 * fa, low]);   // wristband
      else st.push([Wd - .04, .041 * fa, .041 * fa, low], [Wd - .014, (sleeveLong ? .041 : .037) * fa, (sleeveLong ? .041 : .037) * fa, low]);
      if (sleeveLong || look.gloves) st.push([Wd - .014, .034 * hs, .033 * hs, hc, 2, .85]);                                  // the sleeve's opening / the glove's edge
      st.push([Wd + .022 * hs, .04 * hs, .0245 * hs, hc], [Wd + .05 * hs, .047 * hs, .0235 * hs, hc], [HL, .0465 * hs, .0215 * hs, hc]);
      if (look.gloves) st.push([HL + .012 * hs, .045 * hs, .021 * hs, hc], [HL + .012 * hs, .042 * hs, .019 * hs, tipC, 2]);   // fingerless gloves
      st.push([HL + .032 * hs, .041 * hs, .019 * hs, tipC], [TL - .01 * hs, .031 * hs, .0155 * hs, tipC]);
      G.limb([Jt[0], Jt[1], Jt[2], Kn, Tp], [bn('Arm'), bn('ForeArm'), bn('Hand'), bn('Hand')], bn('Shoulder'), [.045, .055, .028, 0], st, NA, FWD, 1, -.075, TL + .004, [0, sg * .2]);
      G.ball(Jt[1], .04 * A, low, [[bn('ForeArm'), 1]]); G.ball(Jt[0], .058 * A, uc, [[bn('Shoulder'), 1]]);
      const ta = Jt[2].clone().addScaledVector(d, .02 * hs).addScaledVector(FWD, .03 * hs).addScaledVector(DOWN, .004), tb = Jt[2].clone().addScaledVector(d, .072 * hs).addScaledVector(FWD, .062 * hs).addScaledVector(DOWN, .016), tl = ta.distanceTo(tb);
      G.limb([ta, tb], [bn('Hand')], bn('Hand'), [0], [[0, .0175 * hs, .0175 * hs, hc], [tl * .55, .016 * hs, .016 * hs, hc], [tl, .0125 * hs, .0125 * hs, tipC]], 6, new THREE.Vector3(0, 1, 0), 1, -.012, tl + .01);
      lpt(s + 'Hand', Tp, .016); lpt(s + 'Hand', tb, .013); lpt(s + 'Hand', Kn.clone().addScaledVector(FWD, .04 * hs), .02); lpt(s + 'Hand', Kn.clone().addScaledVector(FWD, -.04 * hs), .02); }
    { // leg: hip → thigh → knee → shin → hem. Wide legs stack on the shoe; track pants end in a cuff
      const Jt = [s + 'UpLeg', s + 'Leg', s + 'Foot'].map(JP), K = Jt[0].distanceTo(Jt[1]), F = K + Jt[1].distanceTo(Jt[2]), Ls = L * .75 + .25, Lk = (L + Ls) / 2, pc = C.pants, pt = look.pants || 'jeans';
      const cuffed = /^trackp/.test(pt), Lb = Ls * (pt === 'wind' ? 1.16 : cuffed ? 1.08 : 1.1), kc = cus.pants >= 1 ? mixOf(pc, '#9aa0ab', .36) : pc;
      const st = [[-.04, .074 * L, .07 * L, pc, 0, .8], [0, .093 * L, .088 * L, pc, 0, .9], [.06, .098 * L, .091 * L, pc], [.2, .094 * L, .089 * L, pc], [K - .1, .086 * L, .083 * L, pc]];
      if (kc !== pc) st.push([K - .07, .083 * Lk, .08 * Lk, pc], [K - .07, .086 * Lk, .083 * Lk, kc, 1]);                    // custom: reinforced knees
      st.push([K - .045, .081 * Lk, .078 * Lk, kc], [K, .078 * Lk, .076 * Lk, kc], [K + .045, .073 * Lb, .071 * Lb, kc]);
      if (kc !== pc) st.push([K + .09, .074 * Lb, .071 * Lb, kc], [K + .09, .072 * Lb, .069 * Lb, pc, 1]);
      st.push([K + .14, .072 * Lb, .07 * Lb, pc], [K + .26, .069 * Lb, .067 * Lb, pc, 0, .96]);
      if (cuffed) { const cc = mixOf(pc, '#8a8d94', .22); st.push([F - .13, .069 * Lb, .067 * Lb, pc, 0, .93], [F - .085, .072 * Lb, .07 * Lb, pc, 0, .9], [F - .062, .061 * Ls, .06 * Ls, pc, 0, .84], [F - .062, .0605 * Ls, .0595 * Ls, cc, 1], [F - .02, .059 * Ls, .058 * Ls, cc]); }
      else st.push([F - .13, .071 * Lb, .069 * Lb, pc, 0, .94], [F - .09, .077 * Lb, .075 * Lb, pc, 0, .9], [F - .064, .072 * Lb, .07 * Lb, pc, 0, .82], [F - .038, .079 * Lb, .077 * Lb, pc, 0, .9], [F - .01, .075 * Lb, .074 * Lb, pc, 0, .78]);
      const lg = G.limb(Jt, [bn('UpLeg'), bn('Leg')], BI.Hips, [.05, .065], st, NL, FWD, 1, -.07, F - (cuffed ? .012 : .004), [0, sg * .2]);
      G.ball(Jt[1], .061 * Lk, kc, [[bn('Leg'), 1]]);
      // the side stripe of track pants runs down the leg to the cuff
      if (C.stripe) { const out = lg.v.clone().multiplyScalar(Math.sign(lg.v.x) * sg), f = (R, k) => R.c.clone().addScaledVector(out, R.rv + .004).addScaledVector(lg.u, k * .016), end = cuffed ? F - .061 : F;
        for (let i = 2; i < lg.length - 1; i++) { const a = lg[i], b = lg[i + 1]; if (b.s - a.s < 1e-4 || b.s > end) continue; G.quad(f(a, sg), f(a, -sg), f(b, sg), f(b, -sg), C.stripe, a.w, b.w); } } }
    { // SNEAKER: a sole and an upper, both closed skinned shapes
      const A0 = JP(s + 'Foot'), T0 = JP(s + 'ToeBase'), x0 = A0.x, yB = -.04, bigS = hi ? 1.06 : 1, zH = A0.z - .078 * bigS, zT = T0.z + .108 * bigS, len = zT - zH, n = 16;
      const gum = cus.kicks >= 2, soleC = gum ? '#C98A45' : (C.sole || '#eeeeee'), yM = yB + (gum ? .042 : .032), highT = /high/.test(look.shoe || '') ? .045 : 0, up = C.shoe, cap = C.shoe2 || C.shoe, laceC = C.lace || '#F2EFE8';
      const wOf = (z, y) => { let t = clamp((z - (T0.z - .03)) / .06, 0, 1); t = t * t * (3 - 2 * t); return t <= 0 ? (y > .085 ? [[bn('Foot'), .6], [bn('Leg'), .4]] : [[bn('Foot'), 1]]) : t >= 1 ? [[bn('ToeBase'), 1]] : [[bn('Foot'), 1 - t], [bn('ToeBase'), t]]; };
      // sections along the foot: t (0 heel … 1 toe), half-width, height of the top
      const SEC = [[.03, .027, .06], [.11, .039, .1 + highT], [.23, .045, .108 + highT], [.36, .049, .102 + highT * .8], [.49, .053, .08], [.62, .056, .058], [.74, .056, .047], [.86, .051, .04], [.95, .037, .033]];
      const part = sole => { let prev = null; SEC.forEach(([t, w, yT]) => { const z = zH + t * len, yb = yB + .015 * Math.pow(clamp((t - .62) / .38, 0, 1), 2) + .012 * Math.pow(clamp((.18 - t) / .18, 0, 1), 2), pts = [], cols = [], ws = [], shs = [];
          const c0 = sole ? soleC : (t > .7 || t < .18 ? cap : up), top = sole ? yM + .004 : yT, bot = sole ? yb : yM - .008, mid = sole ? (top + bot) / 2 : yM + .004, w2 = w * bigS * (sole ? 1.08 : 1);
          for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, cs = Math.cos(a), sn = Math.sin(a), px = x0 + Math.sign(cs) * Math.pow(Math.abs(cs), sole ? .5 : .72) * w2;
            const py = sn >= 0 ? mid + (top - mid) * Math.pow(sn, sole ? .45 : .8) : mid + (bot - mid) * Math.pow(-sn, sole ? .45 : .6);
            pts.push(new THREE.Vector3(px, py, z)); ws.push(wOf(z, py)); cols.push(!sole && t > .3 && t < .66 && sn > .8 ? laceC : c0); shs.push(sole ? 1 : .84 + .16 * Math.max(0, sn)); }
          const Rg = G.loop(pts, cols, ws, shs); if (prev) G.join(prev, Rg); else G.pole(Rg, new THREE.Vector3(x0, (top + bot) / 2, zH), c0, wOf(zH, 0), true); prev = Rg; });
        G.pole(prev, new THREE.Vector3(x0, sole ? yB + .03 : yB + .045, zT), sole ? soleC : cap, [[bn('ToeBase'), 1]], false); };
      part(true); part(false);
      [[0, yB, zH + .02], [-.05, yB, T0.z - .01], [.05, yB, T0.z - .01], [0, .11 + highT, A0.z - .04]].forEach(([dx, y, z]) => lpt(s + 'Foot', new THREE.Vector3(x0 + dx, y, z)));
      [[0, yB + .014, zT - .008], [0, .05, zT - .04], [-.045, yB + .01, T0.z + .04], [.045, yB + .01, T0.z + .04]].forEach(([dx, y, z]) => lpt(s + 'ToeBase', new THREE.Vector3(x0 + dx, y, z)));
      // custom: fat laces across the instep, glowing strips along the sole
      if (cus.kicks >= 1) { const lum = c => { _c1.set(c); return _c1.r * .3 + _c1.g * .59 + _c1.b * .11; }, lc = Math.abs(lum(laceC) - lum(up)) < .25 ? (lum(up) > .4 ? '#18181B' : '#F2EFE8') : laceC, q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), .5);
        [[.39, .099], [.47, .086], [.55, .072]].forEach(([t, y]) => addW(s + 'Foot', new RoundedBoxGeometry(.074 * bigS, .014, .02, 1, .006), M(lc, .7), new THREE.Vector3(x0, y + highT * (t < .5 ? .6 : 0), zH + t * len), q)); }
      if (cus.kicks >= 3) { const gm = glowOf(look.acc || '#E2611A'); for (const k of [-1, 1]) addW(s + 'Foot', new THREE.BoxGeometry(.007, .013, len * .34), gm, new THREE.Vector3(x0 + k * (.052 * bigS * 1.08 + .001), yB + .022, zH + len * .4));
        addW(s + 'Foot', new THREE.BoxGeometry(.03, .03, .006), gm, new THREE.Vector3(x0, .075 + highT, zH + .004)); } }
  }
  const bones = names.map(n => B[n]), body = new THREE.SkinnedMesh(G.build(), SKIN_MAT);
  // culled like everything else, with a sphere big enough for any pose (lying, handstand, arms out: the hips never leave the rig's centre,
  // root motion moves the rig). It was never culled: every body was skinned and drawn in every shadow map even far off screen (17.11.2026)
  body.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, .8, 0), 1.8); rig.add(body); body.bind(new THREE.Skeleton(bones)); rig.scale.setScalar(scale);
  // belly: a flatter, taller oval that sits in the torso (17.11.2026: the round ball stuck out like a balloon); hoodies get their pocket on it
  if (bd.belly > .12) { const s = add(B.Spine, new THREE.SphereGeometry(.15 + .035 * bd.belly, 20, 14), top, 0, .035, .004 + .03 * bd.belly); s.scale.set(1.06 * ww / (1 + bd.belly * .1), 1.32, .8); }
  if (bd.coat) { const c = add(B.Hips, new THREE.CylinderGeometry(.165 * bd.hip, .215 * bd.hip, .36, 12, 1, true), M(C.top, .8), 0, -.2, 0); c.scale.z = .78 * dp; c.material.side = THREE.DoubleSide; }
  if (look.top === 'teeTeam') add(B.Spine2, new THREE.CircleGeometry(.062, 16), M('#E2611A', .7), 0, .062, .119 * dp);
  // CHAIN (17.11.2026, owner «улучши визуал других человечков»): it was a flat ring around the neck (read as a collar from above).
  // Now a loop that lies on the shoulders just outside the collar and hangs down onto the chest; a heavy one (chain 2) is longer,
  // thicker and carries a medallion. Coordinates in Spine2's space; fz(y) = the front of the top at that height + the cord.
  if (look.chain) { const NK = P('Neck'), ny = NK.y, nz = NK.z, heavy = look.chain > 1, tb = heavy ? .012 : .0075, drop = heavy ? .2 : .155, gm = M(C.gold, .25, 1);
    const surf = y => y < .065 ? .115 + .0025 * y / .065 : y < .112 ? .1175 - .0095 * (y - .065) / .047 : .108 - .022 * clamp((y - .112) / Math.max(.01, ny - .128), 0, 1);
    const fz = y => nz * y / ny + surf(y) * dp + .014 * (baggy > 1 ? 1.4 : 1) + bd.belly * .045 * clamp((ny - y) / drop, 0, 1) + tb, yb = ny - drop;
    const pts = [[0, yb, fz(yb) + .002], [.046, yb + .022, fz(yb + .022)], [.074, ny - drop * .52, fz(ny - drop * .52)], [.09, ny - .012, nz + .045 * dp], [.092, ny + .006, nz - .02], [.062, ny + .012, nz - .07], [0, ny + .014, nz - .084]];
    const loop = pts.concat(pts.slice(1, -1).reverse().map(([x, y, z]) => [-x, y, z])).map(([x, y, z]) => new THREE.Vector3(x, y, z));
    add(B.Spine2, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(loop, true, 'centripetal'), 44, tb, 6, true), gm, 0, 0, 0);
    if (heavy) { const my = yb - .028, md = add(B.Spine2, new THREE.CylinderGeometry(.03, .03, .009, 18), gm, 0, my, fz(my) + .004); md.rotation.x = Math.PI / 2 - .12;
      add(B.Spine2, new THREE.TorusGeometry(.009, .003, 4, 10), gm, 0, yb - .004, fz(yb) + .002); } }
  if (bd.pack) { add(B.Spine2, new RoundedBoxGeometry(.27, .34, .13, 2, .05), M(bd.pack, .8), 0, .04, -.18 * dp); }
  if (/hood|owl/i.test((look.top || '') + (bd.hood ? 'hood' : ''))) { const h = add(B.Spine2, new THREE.SphereGeometry(.105, 12, 8), top, 0, .2, -.1 * dp); h.scale.set(1.25, .7, .9); }
  // a HOODIE (17.11.2026): the hood on the back (above) + a kangaroo pocket on the belly and two drawstrings from the collar
  if (look.top === 'hoodie') { const pc = shadeOf(C.top, .86), sz = .1 * dp * wd + bd.belly * .03 + .006;
    if (bd.belly < .4) { const pk = add(B.Spine, new RoundedBoxGeometry(.19 * ww, .085, .014, 2, .006), M(pc, .85), 0, -.012, sz + bd.belly * .05); pk.rotation.x = -.08; }
    const NK = P('Neck'), sc = M(shadeOf(C.top, 1.25), .7); for (const k of [-1, 1]) { const st = add(B.Spine2, new THREE.CapsuleGeometry(.0055, .07, 2, 5), sc, k * .03, NK.y - .07, NK.z * .55 + .113 * dp + .006); st.rotation.x = .12; } }
  seg(B.Neck, P('Head'), .052 * Math.sqrt(A), skin);
  // head: face, ears, hair by style, beard, hat
  { const hg = new THREE.Group(); hg.scale.setScalar(bd.head); B.Head.add(hg); const eye = M('#17130f', .4), H = C.hat, hat = H ? (look.hat || '') : '';
    const hd = add(hg, new THREE.SphereGeometry(.12, 18, 14), skin, 0, .1, .01); hd.scale.set(1, 1.12, 1.05);
    for (const s of [-1, 1]) { const e = add(hg, new THREE.SphereGeometry(.0135, 8, 6), eye, s * .045, .112, .128); e.scale.set(1, 1.25, .5);
      const er = add(hg, new THREE.SphereGeometry(.03, 8, 6), skin, s * .118, .098, .005); er.scale.set(.45, 1, .75); }
    { const n = add(hg, new THREE.SphereGeometry(.018, 8, 6), skin, 0, .086, .136); n.scale.set(.9, 1.2, 1); }
    if (bd.beard) { const b = add(hg, new THREE.SphereGeometry(.122, 14, 8, Math.PI * .04, Math.PI * .92, Math.PI * .64, Math.PI * .36), hair, 0, .092, .012); b.scale.set(1.03, 1.2, 1.08); }
    let st = bd.style || (girl ? 'tail' : 'short'); if (hat && /afro|mohawk|top|bun|buns|curly/.test(st)) st = girl ? 'tail' : 'short';
    const cap = (r, th, sy = 1.05) => { const hr = add(hg, new THREE.SphereGeometry(r, 16, 10, 0, Math.PI * 2, 0, th), hair, 0, .115, -.006); hr.scale.set(1.01, sy, 1.07); hr.rotation.x = -.16; return hr; };
    if (st !== 'bald' && !(hat && st === 'buzz')) {
      if (st === 'buzz') cap(.1215, Math.PI / 2.25, 1.1); else if (hat) cap(.121, Math.PI / 2, 1.08); else if (st !== 'afro') cap(.126, Math.PI / 2.05);
      if (st === 'afro') { const a = add(hg, new THREE.SphereGeometry(.165, 14, 10), hair, 0, .15, -.02); a.scale.set(1.05, .95, 1); }
      else if (st === 'top') add(hg, new THREE.CylinderGeometry(.1, .092, .07, 14), hair, 0, .235, 0);
      else if (st === 'mohawk') add(hg, new RoundedBoxGeometry(.035, .075, .24, 1, .015), M(bd.dye || C.hair, .8), 0, .25, -.01).rotation.x = -.12;
      else if (st === 'curly') [[0, .225, .03, .06], [.06, .21, -.03, .055], [-.06, .21, -.03, .055], [0, .2, -.08, .05]].forEach(([x, y, z, r]) => add(hg, new THREE.IcosahedronGeometry(r, 1), hair, x, y, z));
      else if (st === 'bun') add(hg, new THREE.SphereGeometry(.052, 10, 8), hair, 0, .25, -.05);
      else if (st === 'buns') [-1, 1].forEach(s => add(hg, new THREE.SphereGeometry(.045, 10, 8), hair, s * .085, .225, -.02));
      else if (st === 'tail') { const t = add(hg, new THREE.CapsuleGeometry(.038, .17, 3, 8), hair, 0, .03, -.135); t.rotation.x = .3; }
      else if (st === 'long') add(hg, new RoundedBoxGeometry(.215, .25, .09, 2, .04), hair, 0, .03, -.085);
      else if (st === 'braids') [-1, 1].forEach(s => { const t = add(hg, new THREE.CapsuleGeometry(.026, .2, 3, 6), hair, s * .1, -.02, -.05); t.rotation.z = s * .12; });
      else if (st === 'dreads') [[-.1, -.05], [-.05, -.11], [.05, -.11], [.1, -.05], [0, -.125]].forEach(([x, z]) => { const t = add(hg, new THREE.CapsuleGeometry(.021, .15, 2, 6), hair, x, .03, z); t.rotation.x = .2; });
    }
    if (hat && /cap/i.test(hat)) { const cp = add(hg, new THREE.SphereGeometry(.132, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(H[0], .7), 0, .13, 0); cp.scale.y = 1.02;
      add(hg, new RoundedBoxGeometry(.16, .02, .12, 1, .008), M(H[1], .7), 0, .14, hat === 'capBack' ? -.15 : .15); }
    else if (hat === 'beanie') { const cp = add(hg, new THREE.SphereGeometry(.133, 16, 10, 0, Math.PI * 2, 0, Math.PI / 1.9), M(H[0], .8), 0, .12, 0); cp.scale.y = 1.2; }
    else if (hat === 'bucket') {   // a soft rounded crown, a band, a brim sloping down (17.11.2026: it was a cylinder and read as a top hat)
      const pr = [[0, .262], [.07, .259], [.104, .249], [.123, .23], [.133, .2], [.137, .17], [.139, .148], [.166, .131], [.196, .111], [.206, .102], [.2, .096], [.168, .114], [.14, .13]].map(([x, y]) => new THREE.Vector2(x, y));
      add(hg, new THREE.LatheGeometry(pr, 22), M2(H[0], .85), 0, 0, 0); add(hg, new THREE.CylinderGeometry(.1395, .1405, .022, 22, 1, true), M2(H[1] || H[0], .8), 0, .16, 0); }
    else if (hat === 'bandana') add(hg, new THREE.SphereGeometry(.131, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.1), M(H[0], .8), 0, .12, 0);
    if (look.phones) { const ph = M('#18191c', .5, .3); [-1, 1].forEach(s => add(hg, new THREE.CylinderGeometry(.042, .042, .03, 12), ph, s * .128, .1, 0).rotation.z = Math.PI / 2);
      const band = add(hg, new THREE.TorusGeometry(.132, .011, 6, 16, Math.PI), ph, 0, .1, 0); band.scale.y = 1.2; }
    // custom, head: a pin, a spin pad on the crown (the part you see best from above), a glowing band
    if (cus.head && !hat) { const ac = look.acc || '#E2611A', bandM = cus.head >= 3 ? glowOf(ac) : M(ac, .75);
      const sb = add(hg, new THREE.TorusGeometry(.129, .016, 8, 30), bandM, 0, .175, -.008); sb.rotation.x = Math.PI / 2 - .2;
      if (cus.head >= 2) { add(hg, new THREE.CylinderGeometry(.05, .06, .012, 20), M(ac, .55), 0, .262, -.01); add(hg, new THREE.CylinderGeometry(.024, .024, .014, 14), M('#F2EFE8', .5), 0, .264, -.01); } }
    if (cus.head && hat) { const ac = look.acc || '#E2611A', bk = hat === 'bucket', top = bk ? .263 : hat === 'beanie' ? .28 : hat === 'bandana' ? .251 : .266, by = bk ? .16 : hat === 'beanie' ? .14 : .152, br = bk ? .1415 : .136;
      { const d = new THREE.Vector3(.52, bk ? 0 : .5, .7).normalize(), pin = add(hg, new THREE.CylinderGeometry(.021, .021, .009, 14), M('#E7B23C', .3, 1), 0, 0, 0);
        pin.position.set(0, bk ? .2 : .13, 0).addScaledVector(d, bk ? .137 : hat === 'beanie' ? .145 : .135); pin.quaternion.setFromUnitVectors(UP, d); }
      if (cus.head >= 2) { add(hg, new THREE.CylinderGeometry(.05, .06, .012, 20), M(ac, .55), 0, top, 0); add(hg, new THREE.CylinderGeometry(.024, .024, .014, 14), M('#F2EFE8', .5), 0, top + .002, 0); }
      if (cus.head >= 3) add(hg, new THREE.TorusGeometry(br, .0075, 6, 28), glowOf(ac), 0, by, 0).rotation.x = Math.PI / 2; } }
  for (const s of ['Left', 'Right']) if (look.knee) add(B[s + 'Leg'], new THREE.SphereGeometry(.082 * L, 10, 8), M('#18181B', .6), 0, .01, .03).scale.set(1, 1.1, .8);
  // ---- CUSTOM details (owner 16.11.2026 «добавь механику улучшения одежды… нашивки»): look.cus = { head, top, pants, kicks }, each 0…3.
  // top: a patch on the chest → patches on the sleeves → a big patch on the back; pants: reinforced knees (in the skin above) → cargo
  // pockets → a wallet chain; kicks and head: see the sneaker and the head blocks. Rigid pieces on bones, the hero only.
  if (look.cus) { const ac = look.acc || '#E2611A';
    if (cus.top >= 1) add(B.Spine2, new THREE.CircleGeometry(.036, 18), patchMat('chest', ac), .072 * cw, .07, .124 * dp).rotation.y = .36;
    if (cus.top >= 2) for (const s of ['Left', 'Right']) add(B[s + 'Arm'], new THREE.CircleGeometry(.036 * A, 16), patchMat('arm', ac), 0, .105, -(.07 * A + .003)).rotation.x = Math.PI;
    if (cus.top >= 3) add(B.Spine2, new THREE.CircleGeometry(.094, 28), patchMat('back', ac), 0, .03, -(.118 * dp + .004)).rotation.y = Math.PI;
    if (cus.pants >= 2) for (const s of ['Left', 'Right']) { const k = s === 'Left' ? -1 : 1, pc = mixOf(C.pants, '#9aa0ab', .2);
      add(B[s + 'UpLeg'], new RoundedBoxGeometry(.03, .125, .1, 2, .012), M(pc, .85), k * (.086 * L + .008), .27, 0); add(B[s + 'UpLeg'], new RoundedBoxGeometry(.036, .036, .106, 2, .012), M(mixOf(C.pants, '#9aa0ab', .36), .85), k * (.086 * L + .009), .212, 0); }
    if (cus.pants >= 3) { const ch = add(B.Hips, new THREE.TorusGeometry(.085, .0075, 6, 20, Math.PI), M('#C9CED6', .28, 1), -(.153 * bd.hip + .012), -.005, .005); ch.rotation.set(0, Math.PI / 2, Math.PI); ch.scale.y = 1.25; }
  }
  // shadows: the body, the head, hair, hats, bags cast them; eyes, ears, laces, pins, patches don't (invisible from above, but each was one
  // more draw call in every shadow map every frame — owner 17.11.2026 «…притормаживает… займись оптимизацией»)
  root.userData.person = true;
  root.traverse(m => { if (!m.isMesh) return; m.receiveShadow = true; if (m.isSkinnedMesh) { m.castShadow = true; return; }
    const g = m.geometry; if (!g.boundingSphere) g.computeBoundingSphere(); const rr = g.boundingSphere.radius * Math.max(m.scale.x, m.scale.y, m.scale.z) * scale;
    m.castShadow = g.type !== 'CircleGeometry' && rr >= .05; if (rr < .045 && g.type !== 'CircleGeometry' && !(m.material.emissive && m.material.emissive.getHex())) m.userData.tiny = true; });   // tiny = hidden when the map is zoomed far out (city3d.js)
  personShadows(root);   // the rest: one merged shadow piece per bone (head + hair + cap = one draw instead of five)
  // ground contact points from the real shapes: capsule = its two end centres + radius, sphere = centre + radius, anything else = box corners
  root.traverse(m => { if (!m.isMesh || m.isSkinnedMesh || m.geometry.type === 'CircleGeometry') return; const g = m.geometry, P = g.parameters || {}, sc = Math.max(m.scale.x, m.scale.y, m.scale.z) * scale;
    if (g.type === 'CapsuleGeometry') { const h = P.height / 2; PTS.push({ m, p: new THREE.Vector3(0, h, 0), r: P.radius * sc }, { m, p: new THREE.Vector3(0, -h, 0), r: P.radius * sc }); }
    else if (g.type === 'SphereGeometry' && P.thetaLength > 3) PTS.push({ m, p: new THREE.Vector3(), r: P.radius * sc });
    else { g.computeBoundingBox(); const b = g.boundingBox; for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) PTS.push({ m, p: new THREE.Vector3(x, y, z), r: 0 }); } });
  // the skinned body touches the ground with its joints: a ball of the limb's / chest's thickness around each bone
  { const O = new THREE.Vector3(), pt = (n, r) => PTS.push({ m: B[n], p: O, r: r * scale });
    pt('Hips', .1 * hd); pt('Spine', .1 * dp * wd + bd.belly * .05); pt('Spine1', .105 * dp); pt('Spine2', .116 * dp); pt('Neck', .07);
    for (const s of ['Left', 'Right']) { pt(s + 'Arm', .066 * A); pt(s + 'ForeArm', .05 * A); pt(s + 'Hand', .037 * A); pt(s + 'UpLeg', .092 * L); pt(s + 'Leg', .069 * L); pt(s + 'Foot', .06); } }
  const mixer = new THREE.AnimationMixer(rig);
  const J = { root, rig, B, body, dp, mixer, cur: null, act: null, dx: 0, dz: 0, pull: .55, maxR: .95, idle: opt.idle || 'Stand' };
  // advance the animation and move the dancer by the clip's own travel
  J.tick = dt => {
    const a = J.act, r = a && RM[J.cur], t0 = a ? a.time : 0;
    mixer.update(dt);
    if (r && a.timeScale > 0) {
      let t1 = a.time; const loop = J.rmLoop;
      rmAt(r, t0, loop, _a);
      if (t1 < t0 - 1e-4) { rmAt(r, r.dur, loop, _b); J.dx += (_b[0] - _a[0]) * scale; J.dz += (_b[1] - _a[1]) * scale; rmAt(r, 0, loop, _a); }   // wrapped around
      rmAt(r, t1, loop, _b); J.dx += (_b[0] - _a[0]) * scale; J.dz += (_b[1] - _a[1]) * scale;
    }
    // stay near the spot: a soft pull back and a hard edge
    const k = Math.exp(-dt * J.pull); J.dx *= k; J.dz *= k;
    const d = Math.hypot(J.dx, J.dz); if (d > J.maxR) { J.dx *= J.maxR / d; J.dz *= J.maxR / d; }
    rig.position.x = J.dx; rig.position.z = J.dz;
    // GROUND: nothing of the body may go under the asphalt (owner 14.11 «при падении… не проваливался под землю»).
    // The lowest point of head / hands / elbows / knees / feet / hips / chest is measured each frame; the body is lifted onto the
    // ground, and while lying after a fall (J.rest) it is laid exactly on it.
    rig.position.y = 0; root.updateMatrixWorld(true);
    let low = Infinity; for (const q of PTS) { _v.copy(q.p).applyMatrix4(q.m.matrixWorld); const y = _v.y - q.r; if (y < low) low = y; }
    low -= root.position.y;
    const want = J.rest ? -low : Math.max(0, -low);
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
    // the very first clip starts at full weight: a fade-in from 0 showed the T-pose for a moment (new people, the hero after changing clothes)
    a.play(); if (J.act && J.act !== a) J.act.crossFadeTo(a, o.fade ?? .25, false); else if (J.act === a || !J.act) a.setEffectiveWeight(1);
    J.act = a; J.cur = name;
  };
  // a calmer (or another) standing loop for this person; switches at once if he is standing now
  J.setIdle = name => { if (!CLIPS[name] || J.idle === name) return; const was = J.cur === J.idle; J.idle = name; if (was) J.play(name, { at: Math.random() * 2, fade: .01 }); };
  J.hipsWorld = new THREE.Vector3();
  return J;
}
