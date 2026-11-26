// Bake original city choreography onto the existing skeleton at 30 fps.
// Run from the repo root: node tools/mocap/build_city_breaking.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { Euler, Quaternion, Vector3 } from '../../vendor/three/three.module.js';

const { rest, clips } = JSON.parse(readFileSync(new URL('../../anim/bboy.json', import.meta.url)));
const bones = Object.keys(rest);
const positions = Object.fromEntries(bones.map(n => [n, new Vector3().fromArray(rest[n].pos)]));
const neutral = Object.fromEntries(bones.map(n => [n, new Quaternion().fromArray(rest[n].q).normalize()]));
const UP = new Vector3(0, 1, 0);
const v = (x, y, z) => new Vector3(x, y, z);
const rotation = (x, y, z) => new Quaternion().setFromEuler(new Euler(x, y, z, 'YXZ'));
const yawRotation = a => new Quaternion().setFromAxisAngle(UP, a);

function capture(name) {
  const c = clips[name];
  return {
    hip: new Vector3().fromArray(c.t['Hips.p'].slice(0, 3).map(x => x / 100)),
    q: Object.fromEntries(bones.map(n => [n, new Quaternion().fromArray(c.t[n + '.q'].slice(0, 4).map(x => x / 1000)).normalize()])),
  };
}

const sit = capture('Breakdance_Footwork_2');
const stand = capture('Breakdance_Ready');

function skeleton(pose) {
  const world = {};
  for (const n of bones) {
    const p = world[rest[n].p];
    world[n] = p ? {
      pos: positions[n].clone().applyQuaternion(p.q).add(p.pos),
      q: p.q.clone().multiply(pose.q[n]),
    } : { pos: pose.hip.clone(), q: pose.q[n].clone() };
  }
  return world;
}

const shoe = Object.fromEntries(['Left', 'Right'].map(side => [side, skeleton(stand)[side+'Foot'].q]));

function aim(pose, bone, direction) {
  const world = skeleton(pose), parent = world[rest[bone].p];
  const current = world[bone].q;
  const change = new Quaternion().setFromUnitVectors(UP.clone().applyQuaternion(current), direction.normalize());
  pose.q[bone] = parent.q.clone().invert().multiply(change).multiply(current);
}

// Two-bone solve. The knee or elbow stays on its pole's side throughout the phrase.
function poseLimb(pose, names, target, pole, endRotation) {
  const [upper, lower, end] = names;
  const first = skeleton(pose)[upper].pos;
  const span = target.clone().sub(first);
  const a = positions[lower].length(), b = positions[end].length();
  const reach = Math.min(a+b-.006, Math.max(Math.abs(a-b)+.006, span.length()));
  span.normalize();
  const along = (a*a + reach*reach - b*b) / (2*reach);
  const bent = pole.clone().sub(first);
  bent.addScaledVector(span, -bent.dot(span)).normalize();
  const elbow = first.clone().addScaledVector(span, along).addScaledVector(bent, Math.sqrt(Math.max(0, a*a-along*along)));
  const terminal = first.clone().addScaledVector(span, reach);
  aim(pose, upper, elbow.clone().sub(first));
  aim(pose, lower, terminal.sub(elbow));
  if (endRotation) pose.q[end] = skeleton(pose)[lower].q.clone().invert().multiply(endRotation);
}

// Coordinates are metres in the rig's stage plane. The base crouch joins the existing footwork.
function floor(hip, angles, leftFoot, rightFoot, leftHand, rightHand, options = {}) {
  const q = Object.fromEntries(bones.map(n => [n, sit.q[n].clone()]));
  const pose = { hip: v(...hip), q };
  q.Hips = rotation(...angles);
  for (const n of ['Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'RightShoulder']) q[n].copy(neutral[n]);
  q.Spine1.multiply(rotation(options.spine || .05, options.twist || 0, 0));
  q.Head.multiply(rotation(options.head || .18, 0, 0));
  for (const [side, sign, foot, hand] of [['Left', 1, leftFoot, leftHand], ['Right', -1, rightFoot, rightHand]]) {
    const footTurn = yawRotation(sign * .22 + angles[1]).multiply(shoe[side]);
    poseLimb(pose, [side+'UpLeg',side+'Leg',side+'Foot'], v(...foot),
      v(sign*.48, hip[1]+.44, hip[2]+.28), footTurn);
    poseLimb(pose, [side+'Arm',side+'ForeArm',side+'Hand'], v(...hand),
      v(sign*.72, hip[1]+.05, hip[2]-.23), hand[1]<.13 ? rotation(-Math.PI/2, sign*.24, 0) : null);
  }
  return pose;
}

const own = (...key) => floor(...key);
const open = own([.02,.25,.02],[-1.24,.08,.26],[.43,.47,.49],[-.30,.19,.58],[.28,.08,-.22],[-.36,.09,-.19]);
const shoulder = own([.01,.22,.08],[-1.51,.05,-.20],[.22,.42,.57],[-.37,.39,.54],[.30,.21,-.10],[-.29,.15,-.18]);
const sweep = own([.06,.26,-.04],[-.92,.28,-.35],[.62,.13,.37],[-.22,.14,.27],[.36,.07,-.18],[-.28,.32,.21]);
const seated = own([-.08,.29,.02],[-.70,-.32,.34],[.18,.14,.55],[-.58,.17,.35],[.27,.19,-.15],[-.35,.075,-.19]);
const twist = own([.04,.32,.03],[-.77,.64,-.45],[.64,.17,.29],[-.27,.13,.42],[.36,.07,-.16],[-.17,.36,.37],
  { spine: -.18, twist: -.52, head: -.12 });
const flex = own([.04,.39,.01],[-.96,.26,-.51],[.61,.20,.35],[-.06,.56,.70],[.45,.08,-.12],[-.26,.49,.43],
  { spine: -.2, twist: -.52, head: -.07 });
const tuck = own([.04,.43,.04],[-.46,.32,-.20],[.26,.12,.25],[-.10,.34,.37],[.28,.43,.37],[-.28,.08,.02]);
const thru = own([.01,.38,.02],[-.48,-.28,.25],[.26,.19,.36],[.40,.26,.36],[.16,.41,.43],[-.27,.07,-.06]);
const kick = own([.02,.38,0],[-.69,.16,-.18],[.40,.44,.61],[-.43,.13,.36],[.31,.10,-.10],[-.31,.08,-.11]);
const switchKick = own([-.02,.42,0],[-.80,-.26,.22],[.39,.13,.34],[-.39,.40,.63],[.32,.09,-.14],[-.30,.09,-.12]);
const squat = own([.05,.57,.10],[-.48,.34,.16],[.37,.14,.34],[-.17,.12,.04],[.24,.43,.16],[-.30,.31,-.04],
  { spine: .55 });
const coil = own([0,.25,0],[-1.63,0,.08],[.25,.54,.36],[-.24,.50,.36],[.22,.37,.24],[-.23,.36,.21],
  { spine: .15, head: .27 });
const shoulderHold = own([.03,.29,.06],[-1.55,.08,-.44],[.34,.40,.50],[-.31,.62,.35],
  [.30,.09,-.12],[-.33,.23,-.18], { spine: .10, head: .25 });

const authored = {
  City_Floorrock_Roll: { n: 47, keys: [[0,sit],[.24,seated],[.51,shoulder],[.74,open],[1,sit]] },
  City_Floorrock_Sweep: { n: 39, keys: [[0,sit],[.24,open],[.52,sweep],[.77,seated],[1,sit]] },
  City_Flex_Reach: { n: 40, keys: [[0,sit],[.23,twist],[.46,flex],[.67,flex],[1,sit]] },
  City_Trick_Thread: { n: 37, keys: [[0,sit],[.25,tuck],[.48,thru],[.74,twist],[1,sit]] },
  City_Trick_KickSwitch: { n: 33, keys: [[0,sit],[.22,kick],[.38,sit],[.62,switchKick],[1,sit]] },
  City_Sweep_Drop: { n: 40, keys: [[0,stand],[.42,squat],[.70,sweep],[1,sit]] },
  City_Backspin: { n: 65, keys: [[0,sit],[.16,seated],[.31,coil],[.72,coil],[.86,open],[1,sit]], spin: true },
  City_Shoulder_Hold: { n: 62, keys: [[0,sit],[.17,open],[.35,shoulderHold],[1,shoulderHold]] },
};

const smooth = t => t*t*(3-2*t);
function bake({ n, keys, spin }) {
  const t = Object.fromEntries(['Hips.p', ...bones.map(b => b+'.q')].map(k => [k, []]));
  let next = 1;
  for (let i = 0; i < n; i++) {
    const u = i / (n-1);
    while (u > keys[next][0]) next++;
    const [start, a] = keys[next-1], [end, b] = keys[next];
    const k = smooth((u-start)/(end-start));
    const hip = a.hip.clone().lerp(b.hip, k);
    t['Hips.p'].push(...hip.toArray().map(x => Math.round(x*100)));
    const spinAngle = spin ? 2*Math.PI*smooth(Math.min(1, Math.max(0, (u-.30)/.43))) : 0;
    for (const bone of bones) {
      const q = a.q[bone].clone().slerp(b.q[bone], k).normalize();
      if (bone==='Hips' && spin) q.premultiply(yawRotation(spinAngle));
      t[bone+'.q'].push(...q.toArray().map(x => Math.round(x*1000)));
    }
  }
  return { n, fps: 30, t };
}

writeFileSync(new URL('../../anim/city-breaking.json', import.meta.url),
  JSON.stringify(Object.fromEntries(Object.entries(authored).map(([name, spec]) => [name,bake(spec)]))));
