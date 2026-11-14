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
// floor position of the hips at time t (loop = travel removed so the loop closes)
function rmAt(r, t, loop, out) {
  t = Math.max(0, Math.min(r.dur, t)); const f = t * r.fps, i = Math.min(r.n - 2, Math.floor(f)), k = f - i;
  out[0] = r.xz[i * 2] + (r.xz[i * 2 + 2] - r.xz[i * 2]) * k; out[1] = r.xz[i * 2 + 1] + (r.xz[i * 2 + 3] - r.xz[i * 2 + 1]) * k;
  if (loop) { const u = t / r.dur; out[0] -= r.end[0] * u; out[1] -= r.end[1] * u; }
  return out;
}
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
// body + clothes on a Mixamo skeleton
export function mocapPerson(look, opt = {}) {
  const R = DATA.rest, C = look.col, scale = opt.scale || .9;
  const root = new THREE.Group(), rig = new THREE.Group(); rig.scale.setScalar(scale); root.add(rig);
  const B = {};
  for (const [n, b] of Object.entries(R)) { const bo = new THREE.Bone(); bo.name = n; bo.position.fromArray(b.pos); bo.quaternion.fromArray(b.q); B[n] = bo; }
  for (const [n, b] of Object.entries(R)) (b.p ? B[b.p] : rig).add(B[n]);
  const P = n => new THREE.Vector3().fromArray(R[n].pos);
  const skin = M(C.skin, .7), top = M(C.top, .78), pants = M(C.pants, .85), shoe = M(C.shoe, .5), sole = M(C.sole || '#eee', .6), hair = M(C.hair, .9);
  const sleeveLong = !/^tee/.test(look.top || 'tee'), sleeve = M(C.sleeve || C.top, .78);
  // torso: hips block + chest
  { const h = new THREE.Mesh(new RoundedBoxGeometry(.34, .2, .22, 2, .06), pants); h.position.set(0, .02, 0); B.Hips.add(h); }
  { const t = new THREE.Mesh(new RoundedBoxGeometry(.38, .3, .22, 2, .08), top); t.position.set(0, .08, .005); B.Spine1.add(t);
    const t2 = new THREE.Mesh(new RoundedBoxGeometry(.42, .22, .24, 2, .09), top); t2.position.set(0, .1, -.005); B.Spine2.add(t2);
    if (C.trim) { const z = new THREE.Mesh(new THREE.BoxGeometry(.025, .4, .02), M(C.trim, .6)); z.position.set(0, .05, .125); B.Spine2.add(z); }
    if (look.top === 'teeTeam') { const d = new THREE.Mesh(new THREE.CircleGeometry(.07, 16), M('#E2611A', .7)); d.position.set(0, .12, .122); B.Spine2.add(d); }
    if (look.chain) { const ch = new THREE.Mesh(new THREE.TorusGeometry(.11, look.chain > 1 ? .02 : .012, 6, 18), M(C.gold, .25, 1)); ch.rotation.x = Math.PI / 2 - .35; ch.position.set(0, .2, .07); B.Spine2.add(ch); } }
  seg(B.Neck, P('Head'), .055, skin);
  // head, hair, hat
  { const hd = new THREE.Mesh(new THREE.SphereGeometry(.12, 18, 14), skin); hd.scale.set(1, 1.12, 1.05); hd.position.set(0, .1, .01); B.Head.add(hd);
    const hr = new THREE.Mesh(new THREE.SphereGeometry(.124, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2.1), hair); hr.position.set(0, .115, -.005); hr.scale.set(1, 1.05, 1.06); B.Head.add(hr);
    if (look.girl) { const tail = new THREE.Mesh(new THREE.CapsuleGeometry(.04, .16, 3, 8), hair); tail.position.set(0, .02, -.12); tail.rotation.x = .3; B.Head.add(tail); }
    const H = C.hat;
    if (H && /cap/i.test(look.hat || '')) { const cp = new THREE.Mesh(new THREE.SphereGeometry(.13, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(H[0], .7)); cp.position.set(0, .13, 0); B.Head.add(cp);
      const br = new THREE.Mesh(new RoundedBoxGeometry(.16, .02, .12, 1, .008), M(H[1], .7)); br.position.set(0, .14, look.hat === 'capBack' ? -.15 : .15); B.Head.add(br); }
    else if (H && look.hat === 'beanie') { const cp = new THREE.Mesh(new THREE.SphereGeometry(.132, 16, 10, 0, Math.PI * 2, 0, Math.PI / 1.9), M(H[0], .8)); cp.scale.y = 1.2; cp.position.set(0, .12, 0); B.Head.add(cp); }
    else if (H && look.hat === 'bucket') { const cp = new THREE.Mesh(new THREE.CylinderGeometry(.11, .13, .1, 16), M(H[0], .8)); cp.position.set(0, .2, 0); B.Head.add(cp);
      const br = new THREE.Mesh(new THREE.CylinderGeometry(.14, .2, .035, 18), M(H[0], .8)); br.position.set(0, .15, 0); B.Head.add(br); }
    else if (H && look.hat === 'bandana') { const cp = new THREE.Mesh(new THREE.SphereGeometry(.13, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.1), M(H[0], .8)); cp.position.set(0, .12, 0); B.Head.add(cp); } }
  // arms
  for (const s of ['Left', 'Right']) {
    seg(B[s + 'Shoulder'], P(s + 'Arm'), .06, top);
    seg(B[s + 'Arm'], P(s + 'ForeArm'), .062, sleeveLong ? sleeve : top);
    if (!sleeveLong) seg(B[s + 'Arm'], P(s + 'ForeArm').multiplyScalar(.35), .066, top);
    seg(B[s + 'ForeArm'], P(s + 'Hand'), .05, sleeveLong ? sleeve : skin);
    if (sleeveLong && C.cuff) { const cf = new THREE.Mesh(new THREE.CylinderGeometry(.055, .055, .05, 10), M(C.cuff, .7)); cf.position.copy(P(s + 'Hand')).multiplyScalar(.92); B[s + 'ForeArm'].add(cf); }
    const hand = new THREE.Mesh(new RoundedBoxGeometry(.07, .12, .04, 1, .018), look.gloves ? M('#18191c', .6) : skin); hand.position.set(0, .055, 0); B[s + 'Hand'].add(hand);
    // legs
    seg(B[s + 'UpLeg'], P(s + 'Leg'), .085, pants, .09);
    seg(B[s + 'Leg'], P(s + 'Foot'), .07, pants);
    if (C.stripe) { const st = new THREE.Mesh(new THREE.BoxGeometry(.012, P(s + 'Leg').length() * .9, .03), M(C.stripe, .6)); st.position.copy(P(s + 'Leg')).multiplyScalar(.5); st.position.x += s === 'Left' ? .085 : -.085; B[s + 'UpLeg'].add(st); }
    // shoe: from the ankle to the toes
    const toe = P(s + 'ToeBase'), sh = new THREE.Mesh(new RoundedBoxGeometry(.11, toe.length() + .1, .1, 2, .035), shoe);
    sh.quaternion.setFromUnitVectors(UP, toe.clone().normalize()); sh.position.copy(toe).multiplyScalar(.5); B[s + 'Foot'].add(sh);
    const tp = new THREE.Mesh(new RoundedBoxGeometry(.105, .1, .08, 1, .03), M(C.shoe2 || C.shoe, .5)); tp.position.set(0, .04, 0); B[s + 'ToeBase'].add(tp);
    const so = new THREE.Mesh(new THREE.BoxGeometry(.115, toe.length() + .12, .02), sole); so.quaternion.copy(sh.quaternion); so.position.copy(sh.position); so.translateZ(-.055); B[s + 'Foot'].add(so);
  }
  root.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
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
