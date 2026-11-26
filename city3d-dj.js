// A standing DJ uses the same skinned body as the rest of the city. The two-bone
// reach targets live in booth space, so the hands stay over the controls at any angle.
import * as THREE from 'three';

const clamp = THREE.MathUtils.clamp;
const smooth = THREE.MathUtils.smoothstep;
const UP = new THREE.Vector3(0, 1, 0);
const TAU = Math.PI * 2;
const envelope = (t, start, end) => smooth(t, start, start + .32) * (1 - smooth(t, end - .32, end));

export function performDJ(person, booth, decks, meter, faders = []) {
  const { root, B } = person;
  root.name = 'Yard DJ';
  root.position.set(0, 0, -.62);
  const height = Math.max(...decks.map(deck => deck.position.y));
  // Capture the textured back of the palm in bone space before a standing clip is applied.
  const palms = ['RightHand', 'LeftHand'].map(name => UP.clone().applyQuaternion(B[name].getWorldQuaternion(new THREE.Quaternion()).invert()));
  person.play('Stand_Quiet', { speed: .6 });
  person.tick(0);
  const arms = [0, 1].map((i) => {
    const side = i ? 'Left' : 'Right';
    const upper = B[side + 'Arm'], fore = B[side + 'ForeArm'], hand = B[side + 'Hand'];
    const joints = [upper, fore, hand];
    return { upper, fore, hand, joints, base: joints.map(j => j.quaternion.clone()), palm: palms[i], sign: i ? 1 : -1,
      length1: fore.position.length() * person.rig.scale.x, length2: hand.position.length() * person.rig.scale.x };
  });
  const chest = B.Spine2.quaternion.clone(), mid = B.Spine1.quaternion.clone(), head = B.Head.quaternion.clone();
  const firstFader = faders.map(fader => fader?.position.z);
  const origin = new THREE.Vector3(), elbow = new THREE.Vector3(), reach = new THREE.Vector3();
  const axis = new THREE.Vector3(), pole = new THREE.Vector3(), active = new THREE.Vector3();
  const handDir = new THREE.Vector3(), handUp = new THREE.Vector3(), headPos = new THREE.Vector3();
  const aimDir = new THREE.Vector3(), currentDir = new THREE.Vector3(), twistUp = new THREE.Vector3();
  const parent = new THREE.Quaternion(), rot = new THREE.Quaternion(), world = new THREE.Quaternion();
  const change = new THREE.Quaternion(), poseEuler = new THREE.Euler();
  let elapsed = 0, cue = -10;

  function aim(bone, to) {
    bone.getWorldPosition(origin);
    bone.parent.getWorldQuaternion(parent).invert();
    aimDir.copy(to).sub(origin).normalize().applyQuaternion(parent);
    currentDir.copy(UP).applyQuaternion(bone.quaternion);
    bone.quaternion.premultiply(rot.setFromUnitVectors(currentDir, aimDir));
  }

  function reachTo(arm, target, listen) {
    arm.joints.forEach((j, i) => j.quaternion.copy(arm.base[i]));
    booth.localToWorld(target);
    arm.upper.getWorldPosition(origin);
    axis.copy(target).sub(origin);
    const distance = clamp(axis.length(), .05, arm.length1 + arm.length2 - .005);
    axis.normalize();
    const along = (arm.length1 ** 2 - arm.length2 ** 2 + distance ** 2) / (2 * distance);
    const bent = Math.sqrt(Math.max(0, arm.length1 ** 2 - along ** 2));
    pole.set(arm.sign * .86, -.53, -.27).transformDirection(booth.matrixWorld);
    pole.addScaledVector(axis, -pole.dot(axis)).normalize();
    reach.copy(origin).addScaledVector(axis, distance);
    elbow.copy(origin).addScaledVector(axis, along).addScaledVector(pole, bent);
    aim(arm.upper, elbow);
    aim(arm.fore, reach);

    handDir.set(-arm.sign * .60 * listen, -.08 + .96 * listen, .98 - .77 * listen).transformDirection(booth.matrixWorld);
    handUp.set(-arm.sign * listen, 1 - listen, .12 * listen).transformDirection(booth.matrixWorld);
    arm.hand.getWorldQuaternion(world);
    world.premultiply(rot.setFromUnitVectors(currentDir.copy(UP).applyQuaternion(world), handDir));
    twistUp.copy(arm.palm).applyQuaternion(world).projectOnPlane(handDir).normalize();
    handUp.projectOnPlane(handDir).normalize();
    world.premultiply(rot.setFromUnitVectors(twistUp, handUp));
    arm.hand.parent.getWorldQuaternion(parent).invert();
    arm.hand.quaternion.copy(parent).multiply(world);
  }

  return {
    cue() { cue = elapsed; },
    tick(dt) {
      elapsed += dt;
      const t = elapsed % 11.6;
      const phase = TAU * (window.RB?.bgmBeat?.() ?? elapsed * 88 / 60);
      const punch = .5 - .5 * Math.cos(phase), sample = envelope(elapsed - cue, 0, 2.6);
      const leftScratch = envelope(t, .02, 3.65) * (1 - sample);
      const rightScratch = Math.max(envelope(t, 4.65, 8.30), sample);
      const listen = envelope(t, 8.55, 11.45) * (1 - sample);
      const shift = .058 * (rightScratch - leftScratch) + .021 * Math.sin(phase * .5);
      root.position.x = shift;
      root.position.z = -.61 + .017 * punch;
      person.tick(dt);
      B.Spine1.quaternion.copy(mid).multiply(change.setFromEuler(poseEuler.set(.28 + .035 * punch, -.095 * shift / .06, -.07 * shift / .06)));
      B.Spine2.quaternion.copy(chest).multiply(change.setFromEuler(poseEuler.set(.27 + .03 * punch, -.12 * shift / .06, 0)));
      B.Head.quaternion.copy(head).multiply(change.setFromEuler(poseEuler.set(-.115 + .16 * punch, -shift * 2, -.11 * listen)));
      B.Head.getWorldPosition(headPos);
      booth.worldToLocal(headPos);

      for (const [i, arm] of arms.entries()) {
        const deck = decks[i], scratch = i ? rightScratch : leftScratch, ear = i ? listen : 0;
        const drag = Math.sin(phase * (sample > .1 ? 2 : 1.5) + i * .68);
        const slide = Math.sin(phase * .5 + arm.sign * .95);
        const controls = faders[i];
        if (controls) controls.position.z = firstFader[i] + slide * .038 * (1 - scratch) * (1 - ear);
        const nearKnob = smooth(Math.sin(phase * .22 + i), .25, .72) * (1 - sample);
        // Mix down the fader and return to the near row of EQ knobs.
        const mixZ = THREE.MathUtils.lerp((controls?.position.z ?? .065) - .097, -.241, nearKnob);
        const mixY = height + .055 + .024 * nearKnob;
        active.set(arm.sign * (.143 + .021 * nearKnob), mixY, mixZ);
        const recordX = deck.position.x - arm.sign * .159 + drag * .025;
        const recordZ = deck.position.z - .203 + drag * .064;
        active.lerp(pole.set(recordX, deck.position.y + .051 + .012 * punch, recordZ), scratch);
        if (ear) active.lerp(pole.set(headPos.x + .152, headPos.y + .069, headPos.z + .028), ear);
        reachTo(arm, active, ear);
        // Cue scratches move the deck both ways. Outside a cue, the platter runs freely.
        deck.rotation.y += dt * (2.55 * (1 - scratch) + drag * 6.1 * scratch);
      }
      meter.material.emissiveIntensity = .53 + .52 * punch + .24 * sample;
    },
  };
}
