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

function capture(name, time = 0) {
  const c = clips[name];
  const frame = Math.min(c.n - 1, time * c.fps);
  const a = Math.floor(frame), b = Math.min(c.n - 1, a + 1), weight = frame - a;
  const hip = i => new Vector3(...c.t['Hips.p'].slice(i * 3, i * 3 + 3).map(x => x / 100));
  const joint = (n, i) => new Quaternion().fromArray(c.t[n + '.q'].slice(i * 4, i * 4 + 4).map(x => x / 1000)).normalize();
  return {
    hip: hip(a).lerp(hip(b), weight),
    q: Object.fromEntries(bones.map(n => [n, joint(n, a).slerp(joint(n, b), weight)])),
  };
}

const smooth = t => t*t*(3-2*t);
const unit = t => Math.min(1, Math.max(0, t));

function blend(a, b, weight) {
  return { hip: a.hip.clone().lerp(b.hip, weight),
    q: Object.fromEntries(bones.map(n => [n, a.q[n].clone().slerp(b.q[n], weight)])) };
}

function keyed(keys, time) {
  const end = keys.findIndex(([at], i) => i && time <= at);
  if (end < 0) return blend(keys.at(-1)[1], keys.at(-1)[1], 0);
  const [start, a] = keys[end - 1], [finish, b] = keys[end];
  return blend(a, b, smooth((time - start) / (finish - start)));
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

const backspinLeadFrames = 18;
const backspinFrames = 82 + backspinLeadFrames;
const coilIn = .594 + backspinLeadFrames / 30;
const swipeStart = 62 / 30;
const swipeLength = 17 / 30;
const swipeHeading = yawRotation(.72);
const leftArm = ['LeftArm', 'LeftForeArm', 'LeftHand'];
const rightArm = ['RightArm', 'RightForeArm', 'RightHand'];
const leftLeg = ['LeftUpLeg', 'LeftLeg', 'LeftFoot'];
const rightLeg = ['RightUpLeg', 'RightLeg', 'RightFoot'];
const launchPalm = v(.169, .046, -.058);
const turnPalm = v(-.103, .043, -.092);
const braceElbow = v(.025, .30, .21);
const launchPalmRotation = rotation(0, 1.54, -Math.PI/2);
const turnPalmRotation = rotation(0, -2.72, Math.PI/2);

function swipeFromCapture(time) {
  const source = capture('Breakdance_Swipes', swipeStart + time);
  // Reflect the recorded half-turn to match the direction of the following backspin.
  const q = Object.fromEntries(bones.map(bone => {
    const other = bone.replace(/^(Left|Right)/, side => side === 'Left' ? 'Right' : 'Left');
    const { x, y, z, w } = source.q[other];
    return [bone, new Quaternion(x, -y, -z, w)];
  }));
  source.hip.x *= -1;
  q.Hips.premultiply(swipeHeading);
  return { hip: source.hip.applyQuaternion(swipeHeading), q };
}

const swipeEnd = swipeFromCapture(swipeLength);
const swipeOffset = v(-swipeEnd.hip.x, 0, .20 - swipeEnd.hip.z);
swipeEnd.hip.add(swipeOffset);
const landing = skeleton(swipeEnd);
const folded = skeleton(coil);
const whipMarks = [
  [swipeLength, swipeEnd.hip.toArray(), landing.LeftFoot.pos.toArray(), landing.RightFoot.pos.toArray()],
  [.72, [.068,.57,.16], [.58,.61,.68], [.19,1.13,.73]],
  [.87, [.096,.35,.14], [.51,.68,.24], [.31,.91,.51]],
  [1.00, [.054,.326,.134], [.26,.69,.04], [.18,.66,.29]],
  [coilIn, coil.hip.toArray(), folded.LeftFoot.pos.toArray(), folded.RightFoot.pos.toArray()],
];
const whipPath = travelCurve(whipMarks);

function swipeRollKey(mark, angles, leftWrist, rightWrist, spine, head) {
  const [time, hip, leftFoot, rightFoot] = whipMarks[mark];
  const pose = own(hip, angles, leftFoot, rightFoot, leftWrist, rightWrist, { spine, head });
  const palm = skeleton(pose).LeftHand;
  pinHand(pose, leftArm, palm.pos, palm.q, 1, braceElbow);
  return [time, pose];
}

// The last palm carries the body as the kicking leg turns the chest from down to sideways.
// The near shoulder takes over while both shoes are still off the ground.
const entryKeys = [
  [swipeLength,swipeEnd],
  swipeRollKey(1, [-.074,1.73,-1.875], [-.103,.05,-.092], [.28,.36,-.16], .15, .29),
  swipeRollKey(2, [-.812,2.411,-2.245], [.025,.175,-.18], [.26,.36,-.13], .29, .32),
  swipeRollKey(3, [-.871,2.73,-2.767], [.14,.285,-.23], [-.15,.34,-.14], .37, .32),
  [coilIn,coil],
];

function backspinEntry(time) {
  let pose;
  if (time <= swipeLength) {
    pose = swipeFromCapture(time);
    pose.hip.add(swipeOffset);
  } else {
    pose = keyed(entryKeys, time);
    // Keep the kicking foot high and carry both shoes around the supporting arm.
    const [hip, ...feet] = whipPath(time);
    pose.hip.set(...hip);
    const weight = smooth(unit((time - swipeLength) / .055)) * (1 - smooth(unit((time - 1.10) / .094)));
    const world = skeleton(pose);
    for (const [i, leg] of [leftLeg, rightLeg].entries()) {
      const [, knee, foot] = leg;
      poseLimb(pose, leg, world[foot].pos.lerp(v(...feet[i]), weight), world[knee].pos);
    }
  }
  const firstPlant = smooth(unit((time - .18) / .062)) * (1 - smooth(unit((time - .46) / .09)));
  const secondPlant = smooth(unit((time - .42) / .095)) * (1 - smooth(unit((time - .77) / .09)));
  pinHand(pose, rightArm, launchPalm, launchPalmRotation, firstPlant);
  pinHand(pose, leftArm, turnPalm, turnPalmRotation, secondPlant, braceElbow);
  return pose;
}

const footworkIn = 1.92;
// After the second turn, the outside palm catches the floor while the first shoe drops.
// The other knee stays tucked until it can sweep into the first travelling step.
const roll = own([.026,.309,.105],[-1.93,-.08,.42], [.00,.58,.06],[.25,.28,.30],
  [.12,.34,-.19],[-.23,.142,-.14], { spine: .19, head: .29 });
const catchStep = own([.038,.319,.036],[-1.27,-.13,.65],[.18,.24,.14],[.48,.118,.29],
  [.005,.43,.26],[-.175,.069,-.043], { spine: .17, head: .23 });
const pushStep = own([-.018,.398,-.045],[-.73,-.09,.79],[.205,.175,.004],[.57,.117,.295],
  [-.038,.53,.31],[-.175,.083,-.058], { spine: .12, head: .13 });
const backspinExit = [[1.54,coil],[1.67,roll],[1.81,catchStep],[footworkIn,pushStep]];
const catchPalm = v(.04, .043, .065);
const catchPalmRotation = rotation(0, 1.12, -Math.PI/2);

function pinHand(pose, arm, position, orientation, weight, bend) {
  if (!weight) return;
  const world = skeleton(pose);
  const wrist = world[arm[2]];
  const elbow = world[arm[1]].pos;
  if (bend) elbow.lerp(bend, weight);
  poseLimb(pose, arm, wrist.pos.lerp(position, weight), elbow,
    wrist.q.slerp(orientation, weight));
}

function backspin(time) {
  const frame = Math.round(time * (backspinFrames - 1));
  if (frame / 30 < coilIn) return backspinEntry(frame / 30);
  const t = (frame - backspinLeadFrames) / 30;
  const p = unit((t - .594) / .99);
  const ramp = .12, brake = 1 - ramp;
  const turnSpeed = 4 * Math.PI / (1 - ramp);
  const brakeStart = .594 + brake * .99;
  const exitTurn = .31;
  let angle;
  if (t < brakeStart) {
    angle = turnSpeed * (p < ramp ? p*p / (2*ramp) : p - ramp/2);
  } else {
    // Spend the remaining angular momentum on a turn into the hand plant.
    const u = unit((t - brakeStart) / exitTurn);
    angle = turnSpeed * (brake - ramp/2 + exitTurn/.99 * (u - u*u*.5));
  }
  let pose;
  if (t < footworkIn) pose = keyed(backspinExit, Math.max(t, backspinExit[0][0]));
  else pose = blend(pushStep, capture('Breakdance_Footwork_2', t - footworkIn), smooth(unit((t - footworkIn)/.17)));

  const heading = yawRotation(angle);
  pose.hip.sub(scapularPivot).applyQuaternion(heading).add(scapularPivot);
  pose.q.Hips.premultiply(heading);
  // Pin in the stage plane so the slowing turn carries the torso around the supporting palm.
  const catchWeight = smooth(unit((t - 1.68) / .115)) * (1 - smooth(unit((t - 2.06) / .20)));
  pinHand(pose, rightArm, catchPalm, catchPalmRotation, catchWeight);
  return pose;
}
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

function travelCurve(marks, closed = false) {
  const values = marks.map(row => row.slice(1).flat());
  const times = marks.map(([time]) => time);
  const slope = (i, channel) => {
    if (!i || i === times.length - 1) {
      if (!closed) return 0;
      const end = times.length - 1;
      const left = (values[0][channel] - values[end-1][channel]) / (1 - times[end-1]);
      const right = (values[1][channel] - values[0][channel]) / times[1];
      return left * right <= 0 ? 0 : 2 * left * right / (left + right);
    }
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
    return marks[a].slice(1).map((_, i) => p.slice(i*3, i*3+3));
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

// The hands leave and return to a standing capture. These signals do not move the feet.
const edge = capture('Breakdance_Ready', .20);
function signal(left, right, pitch, twist = 0) {
  const pose = blend(edge, edge, 0);
  pose.q.Spine1.multiply(rotation(pitch * .34, twist, 0));
  pose.q.Head.multiply(rotation(pitch, twist * .32, 0));
  const chest = skeleton(pose).Spine2.pos;
  for (const [side, sign, offset] of [['Left', 1, left], ['Right', -1, right]]) {
    if (!offset) continue;
    const hand = chest.clone().add(v(sign * offset[0], offset[1], offset[2]));
    const elbow = chest.clone().add(v(sign * (.48 + offset[0] * .28), -.24, -.07));
    poseLimb(pose, [side+'Arm', side+'ForeArm', side+'Hand'], hand, elbow);
  }
  return pose;
}

const nod = signal(null, null, .39, .09);
const offer = signal([.48,-.04,.40], null, -.04, .14);
const raisedHand = signal([.27,.57,.20], null, -.07, .12);
const listen = signal(null, [.29,.21,.18], -.10, -.18);
const touchChest = signal(null, [.09,-.08,.31], .09, -.10);
const yieldFloor = signal([.42,-.33,.38], null, .14, .18);
const quietSquare = signal(null, null, -.16, -.11);
const quietSettle = signal(null, null, -.10, .15);
const drawWide = signal([.56,.15,.28], [.38,-.19,.20], -.12, .19);
const edgeCross = capture('Breakdance_Uprock', .48);
const edgeRock = capture('Brooklyn_Uprock', .58);

// The support-side switch crosses two grounded palms. The leg arc carries the pelvis around the same palm
// before the far foot picks up the next step.
const changeLeft = own([.14,.29,.025],[-.92,-.22,-.70], [-.05,.12,.58],[-.53,.14,.32],
  [.52,.064,.18],[-.21,.63,.34], {spine:.12,twist:-.19});
const gatherFloor = own([.005,.27,.035],[-1.11,.00,.02], [.24,.12,.42],[-.20,.12,.42],
  [.37,.064,.025],[-.37,.064,.025], {spine:.08,twist:.03});
const changeRight = own([-.15,.285,.035],[-.90,.25,.76], [.54,.14,.48],[.06,.12,.39],
  [.23,.65,.32],[-.52,.064,.18], {spine:.10,twist:.22});
const lowKick = own([-.12,.27,.025],[-1.08,.24,.72], [.65,.39,.27],[.16,.12,.49],
  [.29,.55,.37],[-.52,.064,.18], {spine:.08,twist:.17});

const legArc = [
  [0,   [-.035,.33,.025],[-.74,.12,.27],[.04,.12,.19],[.43,.12,.32],[-.07,.51,.32],[-.37,.12,.08]],
  [.14, [-.15,.32,.02],  [-.91,.08,.50],[.01,.22,.32],[-.11,.12,.37],[.22,.41,.42],[-.50,.064,.13]],
  [.28, [-.23,.29,.01],  [-1.07,.18,.65],[.19,.31,.65],[-.11,.12,.37],[.29,.36,.35],[-.50,.064,.13]],
  [.44, [-.20,.28,-.04], [-1.21,.47,.67],[.48,.23,.52],[-.11,.12,.37],[.36,.32,.25],[-.50,.064,.13]],
  [.60, [-.11,.30,-.04], [-1.10,.75,.51],[.56,.13,.17],[-.09,.17,.33],[.39,.32,.09],[-.50,.064,.13]],
  [.76, [-.02,.34,.005], [-.89,.48,.30],[.51,.12,.12],[.09,.22,.43],[.38,.38,.09],[-.43,.14,.15]],
  [.89, [.06,.31,.04],   [-.77,.25,.16],[.48,.15,.17],[.07,.12,.29],[.22,.45,.27],[-.29,.26,.17]],
  [1,   [.015,.34,.02],  [-.70,.10,.15],[.30,.12,.25],[-.10,.12,.24],[.06,.48,.38],[-.29,.34,.31]],
];

// Small alternating steps under the wheel. The continuous pose and velocity across the seam are intentional.
const wheelFootwork = [
  [0,   [.018,.48,.12], [.15,.10,-.035],[.26,.098,.22],[-.27,.18,.27],[.25,.55,.37],[-.37,.53,.29]],
  [.13, [.04,.46,.14],  [.18,.19,-.09], [.26,.098,.22],[-.36,.11,.07],[.20,.52,.45],[-.40,.48,.32]],
  [.28, [-.035,.45,.12],[.21,.11,.07],  [.26,.14,.31],[-.36,.098,.07],[.31,.51,.45],[-.43,.49,.35]],
  [.42, [-.08,.46,.115],[.20,-.08,.12], [.34,.19,.34],[-.36,.098,.07],[.45,.54,.36],[-.32,.51,.45]],
  [.56, [-.005,.48,.12],[.13,-.20,.035],[.39,.098,.15],[-.36,.098,.07],[.49,.53,.29],[-.24,.54,.46]],
  [.70, [.06,.47,.13],  [.14,-.14,-.10],[.39,.098,.15],[-.36,.13,.21],[.45,.53,.28],[-.25,.54,.48]],
  [.84, [.045,.45,.14], [.20,-.04,-.03],[.30,.15,.16],[-.28,.10,.36],[.32,.54,.27],[-.31,.52,.46]],
  [1,   [.018,.48,.12], [.15,.10,-.035],[.26,.098,.22],[-.27,.18,.27],[.25,.55,.37],[-.37,.53,.29]],
];

function footworkPath(marks, loop = false) {
  const sample = travelCurve(marks, loop);
  return time => {
    const controls = sample(time);
    return floor(...controls, { spine: .15, twist: -.32 * controls[1][1] });
  };
}

// Right palm and front foot catch the turn. The second palm lands before the back step;
// the far foot lands, reverses and returns while the hips unwind in the opposite direction.
const returnCircle = [
  [0,   [-.02,.38,.07],[-.47,-.22,.18],[.19,.11,.27],[-.27,.11,.14],[.21,.47,.28],[-.25,.34,.23]],
  [.12, [-.19,.37,.08],[-.89,-.14,.56],[.38,.23,.46],[-.31,.11,.39],[.27,.42,.28],[-.48,.065,.11]],
  [.24, [-.18,.36,.02],[-.99,.32,.50],[.62,.14,.31],[-.31,.11,.39],[.36,.23,.32],[-.48,.065,.11]],
  [.30, [-.15,.24,-.06],[.45,.45,.91],[.62,.14,.31],[-.06,.20,-.11],[.34,.16,.22],[-.48,.065,.11]],
  [.39, [.03,.36,-.14],[1.51,.54,.10],[.60,.16,.20],[.12,.18,-.49],[.43,.066,.24],[-.115,.067,.26]],
  [.49, [.10,.39,-.19],[1.70,.63,-.09],[.49,.24,-.46],[.15,.105,-.58],[.43,.066,.24],[-.115,.067,.26]],
  [.61, [.09,.39,-.20],[1.65,.57,-.14],[.49,.10,-.46],[.11,.24,-.65],[.43,.066,.24],[-.115,.067,.26]],
  [.70, [.08,.34,-.14],[1.47,.19,-.36],[.49,.10,-.46],[-.19,.16,.03],[.43,.066,.24],[-.115,.067,.26]],
  [.77, [.15,.26,-.075],[.38,-.11,-.94],[.48,.17,-.18],[-.44,.16,.18],[.43,.066,.24],[-.19,.25,.28]],
  [.84, [.16,.31,-.02],[-.76,-.29,-.61],[.54,.11,.14],[-.53,.15,.35],[.43,.066,.24],[-.28,.44,.34]],
  [.93, [.10,.36,.025],[-.57,-.48,-.37],[.52,.105,.21],[-.25,.20,.48],[.33,.15,.28],[-.25,.48,.36]],
  [1,   [.04,.40,.08],[-.33,-.28,-.14],[.26,.11,.29],[-.24,.11,.26],[.22,.44,.33],[-.24,.42,.38]],
];

// The free foot passes in front of the supporting thigh. Its landing leads the rise instead of cutting to a standing clip.
const frontThread = [
  [0,   [.065,.37,.09],[-.51,.08,-.25],[.36,.11,.22],[-.25,.13,.26],[.49,.12,.15],[-.30,.42,.34]],
  [.14, [.17,.30,.15],[-.68,.25,-.63],[.40,.106,.18],[-.10,.22,.42],[.53,.065,.14],[-.25,.38,.45]],
  [.29, [.19,.30,.18],[-.77,.42,-.66],[.40,.106,.18],[.16,.19,.56],[.53,.065,.14],[-.06,.36,.48]],
  [.42, [.25,.32,.25],[-.64,.56,-.57],[.40,.13,.12],[.39,.101,.54],[.53,.065,.14],[.01,.36,.58]],
  [.56, [.29,.43,.36],[-.14,.47,-.22],[.28,.18,.0],[.39,.101,.54],[.52,.23,.28],[-.02,.47,.59]],
  [.69, [.26,.67,.37],[.22,.39,-.24],[.13,.12,.22],[.38,.101,.54],[.55,.53,.39],[.09,.72,.57]],
  [.82, [.28,.85,.42],[.15,.20,-.09],[.13,.16,.36],[.38,.106,.54],[.56,.70,.38],[.08,.87,.60]],
  [.92, [.23,.88,.45],[.05,.03,.09],[.06,.098,.51],[.37,.15,.58],[.58,.80,.51],[-.10,.93,.49]],
  [1,   [.17,.87,.49],[.08,-.12,.08],[.07,.098,.52],[.31,.105,.64],[.46,.87,.59],[-.17,.86,.51]],
];
const threadCatch = [
  [0, ...frontThread.at(-1).slice(1)],
  [.18,[.14,.81,.52],[.25,-.19,.10],[.07,.098,.52],[.29,.18,.69],[.45,.70,.66],[-.20,.72,.64]],
  [.39,[.12,.63,.56],[.53,-.23,.19],[.17,.15,.65],[.29,.104,.69],[.43,.46,.70],[-.31,.52,.73]],
  [.60,[.11,.47,.53],[.41,-.14,.33],[.17,.105,.70],[.29,.104,.69],[.52,.25,.75],[-.39,.34,.68]],
  [.81,[.045,.33,.48],[-.45,.09,.48],[.24,.11,.74],[-.23,.17,.66],[.43,.31,.76],[-.41,.072,.60]],
  [1,[.01,.39,.45],[-.49,.08,.13],[.24,.11,.68],[-.24,.11,.63],[.32,.40,.74],[-.27,.29,.66]],
];

// Short links for regular sets: a forward kick off a side plant, or a two-handed rear step with the opposite foot return.
const kickThrough = [
  [0,   [0,.38,.09],[-.49,.08,.04],[.24,.11,.22],[-.27,.13,.17],[.26,.43,.34],[-.27,.31,.29]],
  [.20, [-.19,.36,.12],[-.85,-.18,.53],[.09,.20,.37],[-.26,.107,.33],[.21,.48,.30],[-.48,.065,.18]],
  [.34, [-.14,.36,.13],[-.78,-.15,.48],[.30,.22,.69],[-.26,.107,.33],[.27,.43,.33],[-.48,.065,.18]],
  [.55, [.07,.42,.10],[-.44,.09,-.15],[.36,.11,.34],[-.20,.15,.18],[.41,.20,.28],[-.35,.37,.26]],
  [.71, [.19,.31,.12],[-.80,.26,-.72],[.36,.106,.34],[-.54,.24,.60],[.51,.065,.13],[-.28,.42,.31]],
  [.87, [.14,.32,.12],[-.69,.12,-.48],[.30,.19,.26],[-.49,.13,.33],[.51,.079,.13],[-.31,.36,.29]],
  [1,   [.05,.41,.09],[-.39,-.02,-.08],[.23,.11,.24],[-.27,.11,.25],[.29,.42,.36],[-.24,.38,.35]],
];
const rearStep = [
  [0,   [-.04,.41,.09],[-.33,.07,.15],[.27,.107,.27],[-.24,.11,.21],[.27,.35,.35],[-.29,.32,.33]],
  [.18, [-.035,.42,-.04],[1.43,.12,.095],[.29,.13,.30],[-.38,.20,-.15],[.32,.073,.33],[-.34,.073,.31]],
  [.34, [-.035,.46,-.10],[1.70,.08,.075],[.31,.26,-.08],[-.38,.107,-.54],[.32,.065,.33],[-.34,.065,.31]],
  [.52, [.02,.44,-.12],[1.66,-.10,-.12],[.41,.106,-.41],[-.37,.13,-.50],[.32,.065,.33],[-.34,.065,.31]],
  [.69, [.02,.41,.03],[1.57,-.23,-.21],[.36,.20,-.18],[-.21,.113,.24],[.32,.065,.33],[-.34,.083,.31]],
  [.84, [-.035,.37,.10],[.34,-.11,.34],[.15,.18,.25],[-.21,.106,.24],[.33,.24,.34],[-.34,.21,.34]],
  [1,   [-.06,.41,.14],[-.27,.15,.19],[.26,.11,.32],[-.23,.11,.25],[.31,.39,.32],[-.31,.45,.38]],
];

const authored = {
  City_Floorrock_Roll: { n: 70, poseAt: floorrock(backrock) },
  City_Floorrock_Sweep: { n: 64, poseAt: floorrock(hipSweep) },
  City_Flex_Reach: { n: 40, keys: [[0,sit],[.23,twist],[.46,flex],[.72,tuck],[1,sit]] },
  City_Trick_Thread: { n: 37, keys: [[0,sit],[.25,tuck],[.48,thru],[.74,twist],[1,sit]] },
  City_Trick_KickSwitch: { n: 33, keys: [[0,sit],[.22,kick],[.38,sit],[.62,switchKick],[1,sit]] },
  City_Sweep_Drop: { n: 40, keys: [[0,stand],[.42,squat],[.70,sweep],[1,sit]] },
  City_Backspin: { n: backspinFrames, poseAt: backspin },
  City_Shoulder_Hold: { n: 62, keys: [[0,sit],[.17,open],[.35,shoulderHold],[1,shoulderHold]] },
  // Festival joins share grounded endpoints with the existing clips. The two rivals
  // carry different weight changes, a fast cross-step and a late shoulder reveal.
  Festival_CrossDrop: { n: 38, keys: [[0,stand],[.18,capture('Breakdance_Uprock',.34)],[.42,squat],[.70,sweep],[1,sit]] },
  Festival_StandThrough: { n: 34, keys: [[0,sit],[.22,tuck],[.52,squat],[.84,capture('Breakdance_Uprock',.2)],[1,stand]] },
  Festival_FootReset: { n: 30, keys: [[0,sit],[.22,twist],[.48,tuck],[.72,open],[1,sit]] },
  Festival_StitchSignal: { n: 51, keys: [[0,stand],[.14,capture('Breakdance_Uprock',.31)],[.27,squat],[.45,kick],
    [.56,tuck],[.64,switchKick],[.83,twist],[1,sit]] },
  Festival_GraniteSignal: { n: 62, keys: [[0,sit],[.15,open],[.39,shoulderHold],[.75,shoulderHold],[.90,tuck],[1,sit]] },
  Festival_AnswerCut: { n: 32, keys: [[0,stand],[.25,squat],[.54,kick],[.73,switchKick],[1,sit]] },
  Festival_AnswerThread: { n: 32, keys: [[0,stand],[.24,squat],[.53,tuck],[.75,thru],[1,sit]] },
  City_Battle_Square: { n: 18, keys: [[0,edge],[.52,quietSquare],[1,quietSquare]] },
  City_Battle_Settle: { n: 18, keys: [[0,edge],[.50,quietSettle],[1,quietSettle]] },
  City_Battle_Nod: { n: 18, keys: [[0,edge],[.42,nod],[.63,nod],[1,edge]] },
  City_Battle_Offer: { n: 19, keys: [[0,edge],[.43,offer],[.68,offer],[1,edge]] },
  City_Battle_Lift: { n: 20, keys: [[0,edge],[.43,raisedHand],[.73,raisedHand],[1,edge]] },
  City_Battle_Listen: { n: 19, keys: [[0,edge],[.43,listen],[.65,listen],[1,edge]] },
  City_Battle_Chest: { n: 18, keys: [[0,edge],[.45,touchChest],[.65,touchChest],[1,edge]] },
  City_Battle_Yield: { n: 18, keys: [[0,edge],[.50,yieldFloor],[.70,yieldFloor],[1,edge]] },
  City_Battle_Arc: { n: 32, keys: [[0,edge],[.27,edgeCross],[.54,drawWide],[.77,edgeRock],[1,edge]] },
  City_Battle_Support: { n: 61, keys: [[0,sit],[.18,changeLeft],[.39,gatherFloor],[.62,changeRight],[.79,lowKick],[1,sit]] },
  City_Battle_Reverse: { n: 45, keys: [[0,sit],[.22,changeRight],[.48,gatherFloor],[.76,changeLeft],[1,sit]] },
  City_Battle_LegArc: { n: 45, poseAt: footworkPath(legArc) },
  City_Battle_WheelFootwork: { n: 49, poseAt: footworkPath(wheelFootwork, true) },
  City_Battle_Compact: { n: 44, keys: [[0,edge],[.17,edgeCross],[.38,squat],[.62,changeLeft],[.83,open],[1,sit]] },
  City_Foot_Circle: { n: 65, poseAt: footworkPath(returnCircle) },
  City_Foot_ThreadRise: { n: 63, poseAt: footworkPath(frontThread) },
  City_Foot_ThreadCatch: { n: 27, poseAt: footworkPath(threadCatch) },
  City_Foot_KickThrough: { n: 41, poseAt: footworkPath(kickThrough) },
  City_Foot_RearStep: { n: 46, poseAt: footworkPath(rearStep) },
};

function bake({ n, keys, poseAt }) {
  const t = Object.fromEntries(['Hips.p', ...bones.map(b => b+'.q')].map(k => [k, []]));
  for (let i = 0; i < n; i++) {
    const u = i / (n-1);
    const pose = poseAt ? poseAt(u) : keyed(keys, u);
    const { hip } = pose;
    t['Hips.p'].push(...hip.toArray().map(x => Math.round(x*100)));
    for (const bone of bones) {
      const q = pose.q[bone].normalize();
      t[bone+'.q'].push(...q.toArray().map(x => Math.round(x*1000)));
    }
  }
  return { n, fps: 30, t };
}

writeFileSync(new URL('../../anim/city-breaking.json', import.meta.url),
  JSON.stringify(Object.fromEntries(Object.entries(authored).map(([name, spec]) => [name,bake(spec)]))));
