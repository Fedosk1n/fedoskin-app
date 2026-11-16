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
  const root = new THREE.Group(), rig = new THREE.Group(); rig.scale.setScalar(scale); root.add(rig);
  const B = {};
  for (const [n, b] of Object.entries(R)) { const bo = new THREE.Bone(); bo.name = n; bo.position.fromArray(b.pos); bo.quaternion.fromArray(b.q); B[n] = bo; }
  for (const [n, b] of Object.entries(R)) (b.p ? B[b.p] : rig).add(B[n]);
  // wider or narrower frame: clavicles and hip joints move with the chest and the hips
  for (const s of ['Left', 'Right']) { B[s + 'Shoulder'].position.x *= bd.chest * gW; B[s + 'Arm'].position.multiplyScalar(bd.chest * gW); B[s + 'UpLeg'].position.x *= Math.max(1, bd.hip * (1 + (L - 1) * .5)); }
  const P = n => B[n].position.clone();
  const skin = M(C.skin, .7), top = M(C.top, .78), pants = M(C.pants, .85), shoe = M(C.shoe, .5), sole = M(C.sole || '#eee', .6), hair = M(C.hair, .9);
  const sleeveLong = !/^tee/.test(look.top || 'tee'), sleeve = M(C.sleeve || C.top, .78), baggy = /Big|bomber|track/.test(look.top || '') ? 1.06 : 1;
  const cw = bd.chest * gW * baggy, ww = bd.waist * baggy, dp = 1 + (bd.chest - 1) * .7 + bd.belly * .12, add = (bone, geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); bone.add(m); return m; };
  // torso: hips in the trousers, then the top from its hem up to the shoulders (tapered: waist → chest → shoulders)
  add(B.Hips, new RoundedBoxGeometry(.3 * bd.hip, .19, .2 * (1 + (bd.hip - 1) * .8), 2, .07), pants, 0, -.005, 0);
  add(B.Spine, new RoundedBoxGeometry(.31 * ww, .17, .2 * dp * (1 + (ww - 1) * .5), 2, .07), top, 0, .02, .004);
  add(B.Spine1, new RoundedBoxGeometry(.35 * (cw * .6 + ww * .4), .2, .21 * dp, 2, .08), top, 0, .06, .006);
  add(B.Spine2, new RoundedBoxGeometry(.41 * cw, .23, .235 * dp, 2, .095), top, 0, .095, -.004);
  if (bd.belly > .12) { const s = add(B.Spine, new THREE.SphereGeometry(.15 + .035 * bd.belly, 16, 12), top, 0, .05, .015 + .04 * bd.belly); s.scale.set(1.08 * ww / (1 + bd.belly * .1), 1.2, 1); }
  if (bd.coat) { const c = add(B.Hips, new THREE.CylinderGeometry(.165 * bd.hip, .215 * bd.hip, .36, 12, 1, true), M(C.top, .8), 0, -.2, 0); c.scale.z = .78 * dp; c.material.side = THREE.DoubleSide; }
  if (C.trim) add(B.Spine2, new THREE.BoxGeometry(.025, .4, .02), M(C.trim, .6), 0, .05, .122 * dp);
  if (look.top === 'teeTeam') add(B.Spine2, new THREE.CircleGeometry(.07, 16), M('#E2611A', .7), 0, .12, .1195 * dp);
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
    seg(B[s + 'Shoulder'], P(s + 'Arm'), .06 * A, top);
    if (sleeveLong) seg(B[s + 'Arm'], P(s + 'ForeArm'), .062 * A, sleeve);
    else { seg(B[s + 'Arm'], P(s + 'ForeArm'), .055 * A, skin); seg(B[s + 'Arm'], P(s + 'ForeArm').multiplyScalar(.48), .066 * A, top); }
    seg(B[s + 'ForeArm'], P(s + 'Hand'), .05 * (A * .7 + .3), sleeveLong ? sleeve : skin);
    if (sleeveLong && C.cuff) { const cf = new THREE.Mesh(new THREE.CylinderGeometry(.055 * A, .055 * A, .05, 10), M(C.cuff, .7)); cf.position.copy(P(s + 'Hand')).multiplyScalar(.92); B[s + 'ForeArm'].add(cf); }
    if (look.wrist && !sleeveLong) { const w = new THREE.Mesh(new THREE.CylinderGeometry(.054 * A, .054 * A, .035, 10), M(look.wrist, .6)); w.position.copy(P(s + 'Hand')).multiplyScalar(.9); if (s === 'Left') B[s + 'ForeArm'].add(w); }
    // hand: palm + thumb
    add(B[s + 'Hand'], new RoundedBoxGeometry(.074, .115, .042, 1, .02), look.gloves ? M('#18191c', .6) : skin, 0, .055, 0);
    add(B[s + 'Hand'], new THREE.CapsuleGeometry(.014, .03, 2, 6), look.gloves ? M('#18191c', .6) : skin, 0, .045, .034).rotation.x = .5;
    // legs
    seg(B[s + 'UpLeg'], P(s + 'Leg'), .085 * L, pants, .09 * L);
    seg(B[s + 'Leg'], P(s + 'Foot'), .068 * (L * .75 + .25), pants);
    if (look.knee) add(B[s + 'Leg'], new THREE.SphereGeometry(.075 * L, 10, 8), M('#18191c', .6), 0, .01, .03).scale.set(1, 1.1, .8);
    if (C.stripe) { const st = new THREE.Mesh(new THREE.BoxGeometry(.012, P(s + 'Leg').length() * .9, .03), M(C.stripe, .6)); st.position.copy(P(s + 'Leg')).multiplyScalar(.5); st.position.x += (s === 'Left' ? .085 : -.085) * L; B[s + 'UpLeg'].add(st); }
    // shoe: from the ankle to the toes
    const toe = P(s + 'ToeBase'), sh = new THREE.Mesh(new RoundedBoxGeometry(.11, toe.length() + .1, .1, 2, .035), shoe);
    sh.quaternion.setFromUnitVectors(UP, toe.clone().normalize()); sh.position.copy(toe).multiplyScalar(.5); B[s + 'Foot'].add(sh);
    const tp = new THREE.Mesh(new RoundedBoxGeometry(.105, .1, .08, 1, .03), M(C.shoe2 || C.shoe, .5)); tp.position.set(0, .04, 0); B[s + 'ToeBase'].add(tp);
    const so = new THREE.Mesh(new THREE.BoxGeometry(.115, toe.length() + .12, .02), sole); so.quaternion.copy(sh.quaternion); so.position.copy(sh.position); so.translateZ(-.055); B[s + 'Foot'].add(so);
  }
  root.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  // ground contact points from the real shapes: capsule = its two end centres + radius, sphere = centre + radius, anything else = box corners
  const PTS = [];
  root.traverse(m => { if (!m.isMesh || m.geometry.type === 'CircleGeometry') return; const g = m.geometry, P = g.parameters || {}, sc = Math.max(m.scale.x, m.scale.y, m.scale.z) * scale;
    if (g.type === 'CapsuleGeometry') { const h = P.height / 2; PTS.push({ m, p: new THREE.Vector3(0, h, 0), r: P.radius * sc }, { m, p: new THREE.Vector3(0, -h, 0), r: P.radius * sc }); }
    else if (g.type === 'SphereGeometry' && P.thetaLength > 3) PTS.push({ m, p: new THREE.Vector3(), r: P.radius * sc });
    else { g.computeBoundingBox(); const b = g.boundingBox; for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) PTS.push({ m, p: new THREE.Vector3(x, y, z), r: 0 }); } });
  const mixer = new THREE.AnimationMixer(rig);
  const J = { root, rig, B, mixer, cur: null, act: null, dx: 0, dz: 0, pull: .55, maxR: .95 };
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
    a.play(); if (J.act && J.act !== a) J.act.crossFadeTo(a, o.fade ?? .25, false); else a.fadeIn(o.fade ?? .2);
    J.act = a; J.cur = name;
  };
  J.hipsWorld = new THREE.Vector3();
  return J;
}
