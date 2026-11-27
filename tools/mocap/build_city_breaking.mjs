// Bake original city choreography onto the existing skeleton at 30 fps.
// Run from the repo root: node tools/mocap/build_city_breaking.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { Euler, Matrix4, Quaternion, Vector3 } from '../../vendor/three/three.module.js';

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
  const q = Object.fromEntries(bones.map(n => [n, (options.previous?.[n] || sit.q[n]).clone()]));
  const pose = { hip: v(...hip), q };
  q.Hips = options.axial
    ? rotation(angles[0], angles[1], 0).multiply(yawRotation(angles[2]))
    : rotation(...angles);
  for (const n of ['Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'RightShoulder']) q[n].copy(neutral[n]);
  q.Spine1.multiply(rotation(options.spine || .05, options.twist || 0, 0));
  q.Head.multiply(rotation(options.head || .18, 0, 0));
  for (const [side, sign, foot, hand] of [['Left', 1, leftFoot, leftHand], ['Right', -1, rightFoot, rightHand]]) {
    const footTurn = yawRotation(sign * .22 + angles[1]).multiply(shoe[side]);
    const pole = (x, y, z) => options.axial
      ? v(sign*x, y, z).applyQuaternion(yawRotation(angles[1]*.75)).add(pose.hip)
      : v(sign*x, hip[1]+y, hip[2]+z);
    const plant = options.axial ? smooth(Math.min(1, Math.max(0, (.23-hand[1])/.15))) : 0;
    const palm = options.axial ? rotation(-.81-.76*plant, .24*angles[1]+sign*(.24+.37*(1-plant)), sign*.25*(1-plant))
      : hand[1]<.13 ? rotation(-Math.PI/2, sign*.24, 0) : null;
    poseLimb(pose, [side+'UpLeg',side+'Leg',side+'Foot'], v(...foot), pole(.48, .44, .28), footTurn);
    poseLimb(pose, [side+'Arm',side+'ForeArm',side+'Hand'], v(...hand), pole(.72, .05, -.23), palm);
  }
  return pose;
}

const own = (...key) => floor(...key);
const open = own([.02,.25,.02],[-1.24,.08,.26],[.43,.47,.49],[-.30,.19,.58],[.28,.08,-.22],[-.36,.09,-.19]);
const sweep = own([.06,.26,-.04],[-.92,.28,-.35],[.62,.13,.37],[-.22,.14,.27],[.36,.07,-.18],[-.28,.32,.21]);
const seated = own([-.08,.29,.02],[-.70,-.32,.34],[.18,.14,.55],[-.58,.17,.35],[.27,.19,-.15],[-.35,.075,-.19]);
const backspinWhip = own([-.025,.32,.075],[-1.68,-.20,.16],[.21,.33,.43],[-.46,.57,.76],
  [.27,.15,-.17],[-.29,.17,-.20], { spine: .19, head: .24 });
const backspinRelease = own([.01,.27,.045],[-1.27,.07,.17],[.24,.39,.45],[-.23,.15,.49],
  [.24,.12,-.15],[-.32,.088,-.14]);
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

function foldedLeg(pose, side, kneeTarget, shinDirection, anklePitch) {
  const thigh = side + 'UpLeg', shin = side + 'Leg', foot = side + 'Foot';
  const world = skeleton(pose);
  const upper = kneeTarget.sub(world[thigh].pos).normalize();
  const lower = shinDirection.normalize();
  // The kneecap follows the hinge of the fold instead of inheriting the pelvis roll.
  const hinge = lower.clone().cross(upper).normalize();
  const frame = along => new Quaternion().setFromRotationMatrix(new Matrix4()
    .makeBasis(hinge, along, hinge.clone().cross(along)));
  const thighRotation = frame(upper);
  pose.q[thigh] = world.Hips.q.clone().invert().multiply(thighRotation);
  pose.q[shin] = thighRotation.clone().invert().multiply(frame(lower));
  pose.q[foot].copy(neutral[foot]).multiply(rotation(anklePitch, 0, 0));
}

function backspinCoil() {
  const pose = { hip: v(0, .49, .13), q: Object.fromEntries(bones.map(n => [n, neutral[n].clone()])) };
  pose.q.Hips = rotation(-2.38, 0, .035);
  for (const [bone, curl] of [['Spine', .24], ['Spine1', .31], ['Spine2', .29], ['Neck', .39], ['Head', .29]]) {
    pose.q[bone].multiply(rotation(curl, 0, 0));
  }
  for (const [side, sign] of [['Left', 1], ['Right', -1]]) {
    // Cross near the ankles. Both feet stay up, with the nearer shin tucked behind its partner.
    const lead = sign > 0;
    foldedLeg(pose, side, v(sign * .134, lead ? .458 : .472, -.31),
      v(-sign * .154, lead ? .36 : .205, lead ? .194 : .359), -.22);
    poseLimb(pose, [side + 'Arm', side + 'ForeArm', side + 'Hand'], v(sign * .17, .48, -.22),
      v(sign * .35, .43, .11), rotation(-.61, sign * -.75, sign * .37));
  }
  pose.hip.y -= scapulaOf(pose).y - .014;
  return pose;
}

function scapulaOf(pose) {
  const { pos, q } = skeleton(pose).Spine2;
  return v(0, .055, -.108).applyQuaternion(q).add(pos);
}

const coil = backspinCoil();
const scapularPivot = scapulaOf(coil);
const shoulderHold = own([.02,.37,.03],[-2.15,.18,-.44],[.46,.87,.44],[-.34,.73,.19],
  [.31,.09,-.10],[-.32,.23,-.22], { spine: .16, head: .28 });

// Each floorrock key places the pelvis, pitch/heading/axial roll, both ankles and both wrists.
// The wrist targets repeat during a plant. The backrock crosses the shoulders, the sweep travels along the hip.
const backrock = [
  [0,  [0,.33,0],      [-.74,.13,.28], [.07,.12,.19],[.53,.12,.32],[-.07,.51,.32],[-.17,.06,-.03]],
  [.14,[-.11,.29,-.08],[-1.16,-.22,.62],[.12,.18,.29],[.43,.13,.37], [.12,.41,.36],[-.17,.06,-.03]],
  [.29,[-.25,.26,-.25],[-1.75,-.30,.71],[.32,.68,.27],[-.13,.46,.34],[.30,.30,.20],[-.38,.19,-.18]],
  [.43,[-.17,.33,-.31],[-2.01,-.12,.29],[.19,.41,.44],[-.35,.71,.22],[.25,.31,.06],[-.41,.22,-.19]],
  [.60,[.08,.32,-.23], [-2.02,.34,-.45],[.42,.69,.27],[-.15,.33,.42],[.43,.21,-.11],[-.21,.48,.19]],
  [.73,[.24,.26,-.12], [-1.57,.43,-.70],[.47,.34,.42],[-.04,.17,.38],[.51,.065,-.19],[-.07,.43,.36]],
  [.86,[.21,.31,-.03], [-1.02,.31,-.48],[.22,.12,.31],[.49,.15,.39],[.51,.065,-.19],[-.09,.34,.29]],
  [1,  [.12,.33,0],    [-.74,.13,.28], [.19,.12,.19],[.65,.12,.32],[.05,.51,.32],[-.05,.06,-.03]],
];
const hipSweep = [
  [0,  [0,.33,0],      [-.74,.13,.28], [.07,.12,.19],[.53,.12,.32],[-.07,.51,.32],[-.17,.06,-.03]],
  [.14,[-.07,.26,-.06],[-1.04,.37,.63],[.16,.13,.33],[.42,.19,.43],[.22,.28,.32],[-.17,.06,-.03]],
  [.32,[-.13,.21,-.13],[-1.29,.77,.94],[.24,.22,.48],[.58,.12,.17],[.40,.20,.07],[-.17,.06,-.03]],
  [.48,[-.02,.21,-.14],[-1.42,1.03,.95],[.60,.12,.36],[.51,.28,-.27],[.39,.07,-.32],[-.21,.13,-.05]],
  [.64,[.22,.22,-.09], [-1.31,1.13,.75],[.80,.14,-.04],[.61,.30,-.35],[.39,.07,-.32],[-.05,.22,-.23]],
  [.79,[.30,.25,-.02], [-1.08,.75,.66],[.59,.16,-.12],[.68,.13,.25],[.39,.07,-.32],[.12,.31,.14]],
  [.90,[.25,.31,.03],  [-.80,.35,.44],[.32,.12,.20],[.66,.12,.37],[.39,.26,-.16],[.03,.17,-.03]],
  [1,  [.19,.33,0],    [-.74,.13,.28], [.26,.12,.19],[.72,.12,.32],[.12,.51,.32],[.02,.06,-.03]],
];

function travelCurve(marks) {
  const values = marks.map(row => row.slice(1).flat());
  const times = marks.map(([time]) => time);
  const slope = (i, channel) => {
    if (!i || i === times.length - 1) return 0;
    const left = (values[i][channel] - values[i-1][channel]) / (times[i] - times[i-1]);
    const right = (values[i+1][channel] - values[i][channel]) / (times[i+1] - times[i]);
    return left * right <= 0 ? 0 : 2 * left * right / (left + right);
  };
  const tangents = values.map((row, i) => row.map((_, channel) => slope(i, channel)));
  return time => {
    const b = times.findIndex((at, i) => i && time <= at), a = b - 1;
    const len = times[b] - times[a], u = (time - times[a]) / len, u2 = u*u, u3 = u2*u;
    const p = values[a].map((start, i) => (2*u3 - 3*u2 + 1)*start + (u3 - 2*u2 + u)*len*tangents[a][i]
      + (-2*u3 + 3*u2)*values[b][i] + (u3 - u2)*len*tangents[b][i]);
    return Array.from({length:6}, (_, i) => p.slice(i*3, i*3+3));
  };
}

function floorrock(marks) {
  const sample = travelCurve(marks);
  const entrySign = {}, exitSign = {};
  let previous;
  return time => {
    const controls = sample(time), yaw = controls[1][1];
    // Carry each limb's twist forward so the IK solve changes direction without rolling the sleeve or wrist.
    const pose = floor(...controls, { axial: true, previous, spine: .12, twist: -.38*yaw, head: .28 });
    const transition = smooth(Math.min(1, time/.19, (1-time)/.24));
    const hip = pose.hip;
    hip.y = sit.hip.y + (hip.y - sit.hip.y) * transition;
    const source = {};
    for (const bone of bones) {
      const raw = pose.q[bone], joint = sit.q[bone];
      if (previous && raw.dot(previous[bone]) < 0) raw.set(-raw.x, -raw.y, -raw.z, -raw.w);
      source[bone] = raw.clone();
      if (transition < 1) {
        // Keep the same quaternion hemisphere for the join even if a hand rotates past 180 degrees.
        const signs = time < .5 ? entrySign : exitSign;
        const sign = signs[bone] ??= raw.dot(joint) < 0 ? -1 : 1;
        const weight = (1-transition)*sign;
        raw.set(raw.x*transition + joint.x*weight, raw.y*transition + joint.y*weight,
          raw.z*transition + joint.z*weight, raw.w*transition + joint.w*weight).normalize();
      }
    }
    previous = source;
    return pose;
  };
}

const authored = {
  City_Floorrock_Roll: { n: 70, poseAt: floorrock(backrock) },
  City_Floorrock_Sweep: { n: 64, poseAt: floorrock(hipSweep) },
  City_Flex_Reach: { n: 40, keys: [[0,sit],[.23,twist],[.46,flex],[.67,flex],[1,sit]] },
  City_Trick_Thread: { n: 37, keys: [[0,sit],[.25,tuck],[.48,thru],[.74,twist],[1,sit]] },
  City_Trick_KickSwitch: { n: 33, keys: [[0,sit],[.22,kick],[.38,sit],[.62,switchKick],[1,sit]] },
  City_Sweep_Drop: { n: 40, keys: [[0,stand],[.42,squat],[.70,sweep],[1,sit]] },
  City_Backspin: { n: 67, keys: [[0,sit],[.13,seated],[.203,backspinWhip],[.27,coil],[.75,coil],[.87,backspinRelease],[1,sit]], spin: true },
  City_Shoulder_Hold: { n: 62, keys: [[0,sit],[.17,open],[.35,shoulderHold],[1,shoulderHold]] },
};

const smooth = t => t*t*(3-2*t);
function angularProgress(t) {
  const ramp = .12;
  if (t < ramp) return t*t/(2*ramp*(1-ramp));
  if (t > 1-ramp) return 1-(1-t)**2/(2*ramp*(1-ramp));
  return (t-ramp/2)/(1-ramp);
}

function bake({ n, keys, spin, poseAt }) {
  const t = Object.fromEntries(['Hips.p', ...bones.map(b => b+'.q')].map(k => [k, []]));
  let next = 1;
  for (let i = 0; i < n; i++) {
    const u = i / (n-1);
    let pose;
    if (poseAt) pose = poseAt(u);
    else {
      while (u > keys[next][0]) next++;
      const [start, a] = keys[next-1], [end, b] = keys[next], k = smooth((u-start)/(end-start));
      pose = { hip: a.hip.clone().lerp(b.hip, k), q: Object.fromEntries(bones.map(bone => [bone, a.q[bone].clone().slerp(b.q[bone], k)])) };
    }
    const spinAngle = spin ? 4*Math.PI*angularProgress(Math.min(1, Math.max(0, (u-.27)/.45))) : 0;
    const turn = yawRotation(spinAngle);
    const { hip } = pose;
    if (spin) hip.sub(scapularPivot).applyQuaternion(turn).add(scapularPivot);
    t['Hips.p'].push(...hip.toArray().map(x => Math.round(x*100)));
    for (const bone of bones) {
      const q = pose.q[bone].normalize();
      if (bone==='Hips' && spin) q.premultiply(turn);
      t[bone+'.q'].push(...q.toArray().map(x => Math.round(x*1000)));
    }
  }
  return { n, fps: 30, t };
}

writeFileSync(new URL('../../anim/city-breaking.json', import.meta.url),
  JSON.stringify(Object.fromEntries(Object.entries(authored).map(([name, spec]) => [name,bake(spec)]))));
