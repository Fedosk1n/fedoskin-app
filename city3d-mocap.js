// Dancers driven by real motion capture (Mixamo, licensed for use in this app; converted to anim/bboy.json:
// 22 bones, rest pose + 30 fps tracks, quats ×1000, hips cm). Our own low-poly body and clothes hang on the bones,
// so the moves play exactly as recorded — no hand-posed angles. Look = HERO.topDown(level, acc).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

let DATA = null;
const CLIPS = {};
// ROOT MOTION: the floor-plane travel of the hips is taken OUT of the tracks and moves the dancer instead (J.tick), so the
// next move starts where the last one ended — no snapping back to the centre (owner 14.11 «фигурка телепортируется за круг»).
// RM[name] = {xz: Float32Array (m), dur, fps, end: [x, z]}; looping plays use the detrended curve (travel removed) so loops stay in place.
const RM = {};
export async function loadMocap(url = 'anim/bboy.json?v=1') {
  if (DATA) return DATA;
  DATA = await (await fetch(url)).json();
  for (const [name, c] of Object.entries(DATA.clips)) {
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
  }
  return DATA;
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
const M = (c, r = .8, m = 0) => { const k = c + r + m; if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m })); return mats.get(k); };
const UP = new THREE.Vector3(0, 1, 0);
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
const _p = new THREE.Vector3(), _c1 = new THREE.Color();
const SKIN_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8 });
function skinGeo() {
  const pos = [], col = [], si = [], sw = [], idx = [], seams = [], G = { n: 0 };
  const vert = (p, c, w) => { pos.push(p.x, p.y, p.z); _c1.set(c); col.push(_c1.r, _c1.g, _c1.b); const a = w[0], b = w[1] || [0, 0], t = a[1] + b[1]; si.push(a[0], b[0], 0, 0); sw.push(a[1] / t, b[1] / t, 0, 0); return G.n++; };
  // n points of a (super)ellipse around c in the plane (u, v); u × v must point along the limb
  G.ring = (c, u, v, ru, rv, color, w, n, e = 1) => { const i0 = G.n; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, cs = Math.cos(a), sn = Math.sin(a);
    vert(_p.copy(c).addScaledVector(u, Math.sign(cs) * Math.pow(Math.abs(cs), e) * ru).addScaledVector(v, Math.sign(sn) * Math.pow(Math.abs(sn), e) * rv), color, w); } return { i0, n }; };
  G.join = (A, B) => { for (let i = 0, n = A.n; i < n; i++) { const j = (i + 1) % n; idx.push(A.i0 + i, A.i0 + j, B.i0 + i, A.i0 + j, B.i0 + j, B.i0 + i); } };
  G.pole = (R, p, color, w, start) => { const k = vert(p, color, w); for (let i = 0; i < R.n; i++) { const j = (i + 1) % R.n; if (start) idx.push(k, R.i0 + j, R.i0 + i); else idx.push(R.i0 + i, R.i0 + j, k); } };
  G.seam = (A, B) => seams.push([A, B]);
  G.quad = (a, b, c, d, color, wa, wc) => { const i = vert(a, color, wa); vert(b, color, wa); vert(c, color, wc); vert(d, color, wc); idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2); };
  const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
  G.ball = (c, r, color, w, n = 8) => { let prev = null; const m = 5; for (let k = 1; k < m; k++) { const a = -Math.PI / 2 + k / m * Math.PI, R = G.ring(_p.copy(c).addScaledVector(Y, Math.sin(a) * r).clone(), Z, X, Math.cos(a) * r, Math.cos(a) * r, color, w, n);
      if (prev) G.join(prev, R); else G.pole(R, c.clone().addScaledVector(Y, -r), color, w, true); prev = R; } G.pole(prev, c.clone().addScaledVector(Y, r), color, w, false); };
  // a limb along the joints P[0..m]: bones[k] drives the piece P[k]→P[k+1], `pre` drives what lies before P[0]; near joint k the
  // two neighbours are blended over ±bz[k] metres. st = stations [s (m along the limb from P[0]), ru (forward), rv (sideways), colour, seam?];
  // returns the rings (for stripes). fwd = the body's forward; e = superellipse power (1 = round)
  G.limb = (P, bones, pre, bz, st, n, fwd, e = 1, s0, s1) => {
    const L = [0]; for (let k = 1; k < P.length; k++) L.push(L[k - 1] + P[k].distanceTo(P[k - 1]));
    const d = P[P.length - 1].clone().sub(P[0]).normalize(), u = fwd.clone().addScaledVector(d, -fwd.dot(d)).normalize(), v = d.clone().cross(u);
    const at = s => { if (s <= 0) return P[0].clone().addScaledVector(d, s); for (let k = 1; k < P.length; k++) if (s <= L[k]) return P[k - 1].clone().lerp(P[k], (s - L[k - 1]) / (L[k] - L[k - 1])); return P[P.length - 1].clone().addScaledVector(d, s - L[L.length - 1]); };
    const wt = s => { for (let k = 0; k < P.length - 1; k++) { const b = bz[k] || 0; if (b && Math.abs(s - L[k]) < b) { let t = .5 + (s - L[k]) / (2 * b); t = t * t * (3 - 2 * t); const a = k ? bones[k - 1] : pre; return [[a, 1 - t], [bones[k], t]]; } }
      let k = 0; while (k < bones.length - 1 && s > L[k + 1]) k++; return [[s < 0 ? pre : bones[k], 1]]; };
    const rings = []; let prev = null;
    st.forEach(([s, ru, rv, color, seam]) => { const R = G.ring(at(s), u, v, ru, rv, color, wt(s), n, e); R.s = s; R.c = at(s); R.ru = ru; R.rv = rv; R.w = wt(s);
      if (prev) { if (seam) G.seam(prev, R); else G.join(prev, R); } else G.pole(R, at(s0), color, wt(s0), true); prev = R; rings.push(R); });
    G.pole(prev, at(s1), st[st.length - 1][3], wt(s1), false); rings.u = u; rings.v = v; return rings; };
  G.build = () => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4)); g.setIndex(idx); g.computeVertexNormals();
    const N = g.attributes.normal; seams.forEach(([A, B]) => { for (let i = 0; i < A.n; i++) { _p.set(N.getX(A.i0 + i) + N.getX(B.i0 + i), N.getY(A.i0 + i) + N.getY(B.i0 + i), N.getZ(A.i0 + i) + N.getZ(B.i0 + i)).normalize(); N.setXYZ(A.i0 + i, _p.x, _p.y, _p.z); N.setXYZ(B.i0 + i, _p.x, _p.y, _p.z); } });
    return g; };
  return G;
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
  const sleeveLong = !/^tee/.test(look.top || 'tee'), sleeve = M(C.sleeve || C.top, .78), baggy = /Big|bomber|track/.test(look.top || '') ? 1.06 : 1;
  const cw = bd.chest * gW * baggy, ww = bd.waist * baggy, dp = 1 + (bd.chest - 1) * .7 + bd.belly * .12, add = (bone, geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); bone.add(m); return m; };
  // ---- the smooth body: torso + arms + legs as one skinned mesh (see skinGeo) ----
  rig.updateMatrixWorld(true);
  const names = Object.keys(R), BI = {}; names.forEach((n, i) => { BI[n] = i; });
  const JP = n => new THREE.Vector3().setFromMatrixPosition(B[n].matrixWorld), FWD = new THREE.Vector3(0, 0, 1), G = skinGeo();
  const hd = 1 + (bd.hip - 1) * .8, wd = 1 + (ww - 1) * .5, topC = C.top, slC = C.sleeve || C.top;
  { // torso: trousers up to the waist, then the top from its hem to the collar; sloped shoulders instead of a box
    const P = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck'].map(JP), y0 = P[0].y, S = n => JP(n).y - y0, shW = Math.abs(JP('LeftArm').x) + .028, bl = bd.belly * .03;
    const hemW = .152 * (bd.hip * .55 + ww * .45), hemD = .102 * (hd * .55 + wd * .45);
    const tr = G.limb(P, [BI.Hips, BI.Spine, BI.Spine1, BI.Spine2], BI.Hips, [0, .04, .04, .04], [
      [-.105, .068 * hd, .09 * bd.hip, C.pants], [-.07, .094 * hd, .138 * bd.hip, C.pants], [-.02, .102 * hd, .152 * bd.hip, C.pants], [.04, hemD, hemW, C.pants],
      [.04, hemD + .007 * baggy, hemW + .008 * baggy, topC, 1], [S('Spine') + .02, .1 * dp * wd + bl, .155 * ww, topC], [S('Spine1'), .105 * dp + bl * .6, .175 * (cw * .6 + ww * .4), topC],
      [S('Spine2'), .115 * dp, .195 * cw, topC], [S('Spine2') + .065, .1175 * dp, .206 * cw, topC], [S('Spine2') + .112, .108 * dp, shW, topC],
      [S('Neck') - .016, .086 * dp, shW * .62, topC], [S('Neck') + .012, .066, .074, topC]], 16, FWD, .78, -.125, S('Neck') + .03);
    // the zip / button line of a jacket follows the chest
    if (C.trim) for (let i = 5; i < tr.length - 2; i++) { const a = tr[i], b = tr[i + 1], f = R => R.c.clone().addScaledVector(tr.u, R.ru + .005);
      G.quad(f(a).addScaledVector(tr.v, .01), f(a).addScaledVector(tr.v, -.01), f(b).addScaledVector(tr.v, .01), f(b).addScaledVector(tr.v, -.01), C.trim, a.w, b.w); } }
  for (const s of ['Left', 'Right']) {
    // arm: shoulder cap → upper arm → elbow → forearm → wrist
    { const P = [s + 'Arm', s + 'ForeArm', s + 'Hand'].map(JP), E = P[0].distanceTo(P[1]), Wd = E + P[1].distanceTo(P[2]), fa = A * .7 + .3, low = sleeveLong ? slC : C.skin, st = [
        [-.06, .046 * A, .05 * A, topC], [-.03, .06 * A, .064 * A, topC], [0, .066 * A, .068 * A, topC], [.05, .064 * A, .065 * A, slC]];
      if (sleeveLong) st.push([.14, .059 * A, .059 * A, slC]);
      else st.push([E * .46, .064 * A, .066 * A, topC], [E * .46, .052 * A, .053 * A, C.skin, 1]);
      st.push([E - .07, .053 * A, .053 * A, low], [E - .035, .051 * A, .051 * A, low], [E, .05 * A, .05 * A, low], [E + .035, .05 * fa, .051 * fa, low], [E + .09, .051 * fa, .052 * fa, low],
        [E + .17, .046 * fa, .046 * fa, low], [Wd - .035, .04 * fa, .04 * fa, low], [Wd, .037 * fa, .037 * fa, low]);
      G.limb(P, [BI[s + 'Arm'], BI[s + 'ForeArm']], BI[s + 'Shoulder'], [.04, .05], st, 10, FWD, 1, -.085, Wd + .012);
      G.ball(P[1], .038 * A, low, [[BI[s + 'ForeArm'], 1]]); G.ball(P[0], .062 * A, topC, [[BI[s + 'Shoulder'], 1]]); }
    // leg: hip → thigh → knee → shin → trouser hem
    { const P = [s + 'UpLeg', s + 'Leg', s + 'Foot'].map(JP), K = P[0].distanceTo(P[1]), F = K + P[1].distanceTo(P[2]), Ls = L * .75 + .25, Lk = (L + Ls) / 2, pc = C.pants;
      const lg = G.limb(P, [BI[s + 'UpLeg'], BI[s + 'Leg']], BI.Hips, [.05, .06], [
        [-.04, .074 * L, .07 * L, pc], [0, .092 * L, .088 * L, pc], [.06, .095 * L, .09 * L, pc], [.2, .089 * L, .085 * L, pc], [K - .1, .079 * L, .076 * L, pc], [K - .045, .072 * Lk, .07 * Lk, pc],
        [K, .069 * Lk, .068 * Lk, pc], [K + .045, .068 * Ls, .067 * Ls, pc], [K + .12, .07 * Ls, .068 * Ls, pc], [K + .26, .063 * Ls, .062 * Ls, pc], [F - .05, .059 * Ls, .059 * Ls, pc], [F, .063 * Ls, .063 * Ls, pc]],
        12, FWD, 1, -.07, F + .004);
      G.ball(P[1], .051 * Lk, pc, [[BI[s + 'Leg'], 1]]);
      // the side stripe of track pants runs down the whole leg
      if (C.stripe) { const out = lg.v.clone().multiplyScalar(Math.sign(lg.v.x) * (s === 'Left' ? 1 : -1)), f = (R, k) => R.c.clone().addScaledVector(out, R.rv + .004).addScaledVector(lg.u, k * .016);
        for (let i = 2; i < lg.length - 1; i++) { const a = lg[i], b = lg[i + 1], fl = s === 'Left' ? 1 : -1; G.quad(f(a, fl), f(a, -fl), f(b, fl), f(b, -fl), C.stripe, a.w, b.w); } } }
  }
  const bones = names.map(n => B[n]), body = new THREE.SkinnedMesh(G.build(), SKIN_MAT); body.frustumCulled = false; rig.add(body); body.bind(new THREE.Skeleton(bones)); rig.scale.setScalar(scale);
  if (bd.belly > .12) { const s = add(B.Spine, new THREE.SphereGeometry(.15 + .035 * bd.belly, 16, 12), top, 0, .05, .015 + .04 * bd.belly); s.scale.set(1.08 * ww / (1 + bd.belly * .1), 1.2, 1); }
  if (bd.coat) { const c = add(B.Hips, new THREE.CylinderGeometry(.165 * bd.hip, .215 * bd.hip, .36, 12, 1, true), M(C.top, .8), 0, -.2, 0); c.scale.z = .78 * dp; c.material.side = THREE.DoubleSide; }
  if (look.top === 'teeTeam') add(B.Spine2, new THREE.CircleGeometry(.062, 16), M('#E2611A', .7), 0, .062, .119 * dp);
  if (look.chain) { const ch = add(B.Spine2, new THREE.TorusGeometry(.11, look.chain > 1 ? .02 : .012, 6, 18), M(C.gold, .25, 1), 0, .2, .07 * dp); ch.rotation.x = Math.PI / 2 - .35; }
  if (bd.pack) { add(B.Spine2, new RoundedBoxGeometry(.27, .34, .13, 2, .05), M(bd.pack, .8), 0, .04, -.18 * dp); }
  if (/hood|owl/i.test((look.top || '') + (bd.hood ? 'hood' : ''))) { const h = add(B.Spine2, new THREE.SphereGeometry(.105, 12, 8), top, 0, .2, -.1 * dp); h.scale.set(1.25, .7, .9); }
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
    else if (hat === 'bucket') { add(hg, new THREE.CylinderGeometry(.112, .132, .13, 16), M(H[0], .8), 0, .215, 0); add(hg, new THREE.CylinderGeometry(.14, .2, .035, 18), M(H[0], .8), 0, .15, 0); }
    else if (hat === 'bandana') add(hg, new THREE.SphereGeometry(.131, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.1), M(H[0], .8), 0, .12, 0);
    if (look.phones) { const ph = M('#18191c', .5, .3); [-1, 1].forEach(s => add(hg, new THREE.CylinderGeometry(.042, .042, .03, 12), ph, s * .128, .1, 0).rotation.z = Math.PI / 2);
      const band = add(hg, new THREE.TorusGeometry(.132, .011, 6, 16, Math.PI), ph, 0, .1, 0); band.scale.y = 1.2; } }
  // arms
  for (const s of ['Left', 'Right']) {
    if (sleeveLong && C.cuff) { const cf = new THREE.Mesh(new THREE.CylinderGeometry(.047 * A, .044 * A, .05, 10), M(C.cuff, .7)); cf.position.copy(P(s + 'Hand')).multiplyScalar(.92); B[s + 'ForeArm'].add(cf); }
    if (look.wrist && !sleeveLong) { const w = new THREE.Mesh(new THREE.CylinderGeometry(.044 * A, .042 * A, .035, 10), M(look.wrist, .6)); w.position.copy(P(s + 'Hand')).multiplyScalar(.9); if (s === 'Left') B[s + 'ForeArm'].add(w); }
    // hand: palm + thumb
    add(B[s + 'Hand'], new RoundedBoxGeometry(.074, .115, .042, 1, .02), look.gloves ? M('#18191c', .6) : skin, 0, .055, 0);
    add(B[s + 'Hand'], new THREE.CapsuleGeometry(.014, .03, 2, 6), look.gloves ? M('#18191c', .6) : skin, 0, .045, .034).rotation.x = .5;
    // legs
    if (look.knee) add(B[s + 'Leg'], new THREE.SphereGeometry(.075 * L, 10, 8), M('#18191c', .6), 0, .01, .03).scale.set(1, 1.1, .8);
    // shoe: from the ankle to the toes
    const toe = P(s + 'ToeBase'), sh = new THREE.Mesh(new RoundedBoxGeometry(.11, toe.length() + .1, .1, 2, .035), shoe);
    sh.quaternion.setFromUnitVectors(UP, toe.clone().normalize()); sh.position.copy(toe).multiplyScalar(.5); B[s + 'Foot'].add(sh);
    const tp = new THREE.Mesh(new RoundedBoxGeometry(.105, .1, .08, 1, .03), M(C.shoe2 || C.shoe, .5)); tp.position.set(0, .04, 0); B[s + 'ToeBase'].add(tp);
    const so = new THREE.Mesh(new THREE.BoxGeometry(.115, toe.length() + .12, .02), sole); so.quaternion.copy(sh.quaternion); so.position.copy(sh.position); so.translateZ(-.055); B[s + 'Foot'].add(so);
  }
  root.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  // ground contact points from the real shapes: capsule = its two end centres + radius, sphere = centre + radius, anything else = box corners
  const PTS = [];
  root.traverse(m => { if (!m.isMesh || m.isSkinnedMesh || m.geometry.type === 'CircleGeometry') return; const g = m.geometry, P = g.parameters || {}, sc = Math.max(m.scale.x, m.scale.y, m.scale.z) * scale;
    if (g.type === 'CapsuleGeometry') { const h = P.height / 2; PTS.push({ m, p: new THREE.Vector3(0, h, 0), r: P.radius * sc }, { m, p: new THREE.Vector3(0, -h, 0), r: P.radius * sc }); }
    else if (g.type === 'SphereGeometry' && P.thetaLength > 3) PTS.push({ m, p: new THREE.Vector3(), r: P.radius * sc });
    else { g.computeBoundingBox(); const b = g.boundingBox; for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) PTS.push({ m, p: new THREE.Vector3(x, y, z), r: 0 }); } });
  // the skinned body touches the ground with its joints: a ball of the limb's / chest's thickness around each bone
  { const O = new THREE.Vector3(), pt = (n, r) => PTS.push({ m: B[n], p: O, r: r * scale });
    pt('Hips', .1 * hd); pt('Spine', .1 * dp * wd + bd.belly * .05); pt('Spine1', .105 * dp); pt('Spine2', .116 * dp); pt('Neck', .07);
    for (const s of ['Left', 'Right']) { pt(s + 'Arm', .066 * A); pt(s + 'ForeArm', .05 * A); pt(s + 'Hand', .037 * A); pt(s + 'UpLeg', .092 * L); pt(s + 'Leg', .069 * L); pt(s + 'Foot', .06); } }
  const mixer = new THREE.AnimationMixer(rig);
  const J = { root, rig, B, body, dp, mixer, cur: null, act: null, dx: 0, dz: 0, pull: .55, maxR: .95 };
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
    J.rmLoop = !(o.travel ?? TRAVEL.test(name));   // loops stay in place; going down, footwork, freezes travel for real
    const c = CLIPS[name]; if (!c) return;
    const a = mixer.clipAction(c); a.reset(); a.setLoop(o.once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); a.clampWhenFinished = !!o.once;
    a.timeScale = o.speed || 1; if (o.at) a.time = o.at;
    a.play(); if (J.act && J.act !== a) J.act.crossFadeTo(a, o.fade ?? .25, false); else if (J.act === a) a.setEffectiveWeight(1);   // the same clip again: keep its full weight (a fade-in from 0 would mix in the T-pose)
    else a.fadeIn(o.fade ?? .2);
    J.act = a; J.cur = name;
  };
  J.hipsWorld = new THREE.Vector3();
  return J;
}
