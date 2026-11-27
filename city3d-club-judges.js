// Keep the pelvis on the cushion and the shoes on the floor while the judges watch and vote.
import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const FRONT = new THREE.Vector3(0, 0, 1);
const clamp = THREE.MathUtils.clamp;

function targets() {
  const origin = new THREE.Vector3(), axis = new THREE.Vector3(), pole = new THREE.Vector3();
  const elbow = new THREE.Vector3(), tip = new THREE.Vector3();
  const here = new THREE.Vector3(), direction = new THREE.Vector3(), current = new THREE.Vector3();
  const parent = new THREE.Quaternion(), rotation = new THREE.Quaternion();
  function aim(bone, at) {
    bone.getWorldPosition(here);
    bone.parent.getWorldQuaternion(parent).invert();
    direction.copy(at).sub(here).normalize().applyQuaternion(parent);
    current.copy(UP).applyQuaternion(bone.quaternion);
    bone.quaternion.premultiply(rotation.setFromUnitVectors(current, direction));
  }
  return (upper, lower, end, target, bend) => {
    upper.getWorldPosition(origin);
    const size = upper.getWorldScale(here).y, a = lower.position.length() * size, b = end.position.length() * size;
    axis.copy(target).sub(origin);
    const distance = clamp(axis.length(), Math.abs(a - b) + .005, a + b - .005);
    axis.normalize();
    pole.copy(bend).addScaledVector(axis, -bend.dot(axis)).normalize();
    const along = (a * a - b * b + distance * distance) / (2 * distance);
    elbow.copy(origin).addScaledVector(axis, along).addScaledVector(pole, Math.sqrt(Math.max(0, a * a - along * along)));
    tip.copy(origin).addScaledVector(axis, distance);
    aim(upper, elbow);
    aim(lower, tip);
  };
}

export function seatedJudge(person, index, scene, can, tex) {
  const { root, rig, B } = person;
  const solve = targets(), target = new THREE.Vector3(), bend = new THREE.Vector3();
  const parent = new THREE.Quaternion(), direction = new THREE.Quaternion();
  const chest = B.Spine1.quaternion.clone(), neck = B.Head.quaternion.clone();
  const world = bone => bone.getWorldQuaternion(new THREE.Quaternion());
  const feet = ['Right', 'Left'].map(side => ({
    side, angle: world(B[side + 'Foot']), height: B[side + 'Foot'].getWorldPosition(target).y,
  }));
  const hands = ['Right', 'Left'].map(side => {
    const hand = B[side + 'Hand'];
    const angle = world(hand);
    const back = UP.clone().applyQuaternion(angle.clone().invert());
    const tip = UP.clone().applyQuaternion(angle);
    const arm = B[side + 'Arm'], forearm = B[side + 'ForeArm'];
    return { arm, forearm, hand, angle, back, tip, base: [arm.quaternion.clone(), forearm.quaternion.clone()] };
  });

  function point(bone, rotation) {
    bone.parent.getWorldQuaternion(parent).invert();
    bone.quaternion.copy(parent).multiply(rotation);
  }
  B.Hips.position.y = (.55 + (index === 1 ? .01 : 0)) / rig.scale.y;
  B.Hips.position.z = -.051 / rig.scale.y;
  for (const [i, { side, angle, height }] of feet.entries()) {
    const sign = i ? 1 : -1;
    target.set(sign * (.22 + index * .012), height, .44 + .048 * ((index + i) % 3));
    root.localToWorld(target);
    solve(B[side + 'UpLeg'], B[side + 'Leg'], B[side + 'Foot'], target, FRONT);
    point(B[side + 'Foot'], angle);
  }

  const canvas = can(320, 134), pen = canvas.getContext('2d');
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(canvas), toneMapped: false, depthWrite: false }));
  sprite.name = 'Judge vote card';
  sprite.scale.set(.68, .285, 1);
  sprite.center.set(.5, .04);
  sprite.visible = false;
  scene.add(sprite);
  let amount = 0, ballot = false, elapsed = 0;
  const projected = new THREE.Vector3(), up = new THREE.Vector3(), handBack = new THREE.Vector3();
  function tick(dt) {
    elapsed += dt;
    amount += ((ballot ? 1 : 0) - amount) * (1 - Math.exp(-dt * 14));
    B.Spine1.quaternion.copy(chest);
    B.Spine1.rotateX(.087 + .036 * index + Math.sin(elapsed * 1.5 + index * 3) * .021 - amount * .053);
    B.Head.quaternion.copy(neck);
    B.Head.rotateY((1 - index) * -.07 + Math.sin(elapsed * 1.05 + index) * .033);
    B.Head.rotateX(.06 + .034 * Math.sin(elapsed * 1.7 + index * 2.2));

    for (const [i, h] of hands.entries()) {
      const sign = i ? 1 : -1, lift = i === 0 ? amount : 0;
      const { arm, forearm, hand } = h;
      arm.quaternion.copy(h.base[0]);
      forearm.quaternion.copy(h.base[1]);
      target.set(sign * (.21 + lift * .07), .585 + lift * .53, .245 + .07 * (index % 2) + lift * .10);
      root.localToWorld(target);
      bend.set(sign * .86, -.65, -.14);
      solve(arm, forearm, hand, target, bend);

      projected.set(sign * -.15, .88 * lift - .06, 1 - .55 * lift).normalize();
      up.set(0, 1 - .65 * lift, lift).projectOnPlane(projected).normalize();
      direction.setFromUnitVectors(h.tip, projected).multiply(h.angle);
      handBack.copy(h.back).applyQuaternion(direction).projectOnPlane(projected).normalize();
      parent.setFromUnitVectors(handBack, up);
      direction.premultiply(parent);
      point(hand, direction);
      if (i === 0) {
        hand.getWorldPosition(sprite.position);
        sprite.position.z += .03;
        sprite.visible = amount > .57;
      }
    }
  }
  function show(name, color) {
    pen.clearRect(0, 0, 320, 134);
    pen.fillStyle = '#f3e6cb';
    pen.beginPath(); pen.roundRect(3, 8, 314, 114, 14); pen.fill();
    pen.fillStyle = color; pen.fillRect(13, 99, 294, 8);
    pen.fillStyle = '#1c272a'; pen.font = '900 52px Inter, sans-serif';
    pen.textAlign = 'center'; pen.textBaseline = 'middle';
    pen.fillText(name.toUpperCase(), 160, 59, 282);
    sprite.material.map.needsUpdate = true;
    ballot = true;
  }
  function hide() { ballot = false; }
  tick(0);
  return { tick, show, hide };
}
