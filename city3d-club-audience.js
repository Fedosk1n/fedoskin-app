import { loadUntexturedModel } from './city3d-festival-art.js?v=3';

const ACTIVE_LIMIT = 3;
const floorMargin = .12;

export function onClubFloor(floor, dancer, world) {
  const root = dancer?.root;
  if (!root?.visible || dancer.ws || dancer.fall) return false;
  const { x, z } = root.getWorldPosition(world);
  return Math.hypot(x - floor.x, z - floor.z) < floor.r - floorMargin;
}

export function loadClubAudience() {
  return loadUntexturedModel('./anim/club-audience.glb?v=1').catch(error => {
    console.warn('Club audience model unavailable', error);
    return null;
  });
}

export function buildClubAudience({ THREE, scene, circ }, model, floor) {
  const body = model?.getObjectByName('crowd-body');
  const templates = ['sleeve', 'forearm', 'hand'].map(name => model?.getObjectByName('crowd-' + name)?.children[0]);
  const seats = model?.children.filter(child => child.name.startsWith('spectator-')) || [];
  if (!body || templates.some(mesh => !mesh?.isMesh) || !seats.length) return null;

  const group = new THREE.Group();
  group.name = 'Club audience';
  group.add(body);
  scene.add(group);
  const arms = templates.map((template, i) => {
    const mesh = new THREE.InstancedMesh(template.geometry, template.material, seats.length * 2);
    mesh.name = ['Crowd sleeves', 'Crowd forearms', 'Crowd hands'][i];
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    group.add(mesh);
    return mesh;
  });
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const ctx = canvas.getContext('2d'), paint = ctx.createRadialGradient(16, 16, 1, 16, 16, 15.7);
  paint.addColorStop(0, 'rgba(0,0,0,.45)');
  paint.addColorStop(.55, 'rgba(0,0,0,.26)');
  paint.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = paint;
  ctx.fillRect(0, 0, 32, 32);
  const contact = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false }), seats.length);
  contact.name = 'Crowd contact shadows';
  group.add(contact);

  const up = new THREE.Vector3(0, 1, 0), scale = new THREE.Vector3(), start = new THREE.Vector3(), end = new THREE.Vector3();
  const offset = new THREE.Vector3(), tip = new THREE.Vector3(), direction = new THREE.Vector3();
  const wristGoal = new THREE.Vector3(), elbowBias = new THREE.Vector3();
  const rotation = new THREE.Quaternion(), matrix = new THREE.Matrix4(), color = new THREE.Color();
  const active = [], world = new THREE.Vector3();
  let lap = 0, wait = 0, performer = null;

  function vec(values, index) { return new THREE.Vector3().fromArray(values, index); }
  const people = seats.map((seat, index) => {
    const { arms: local, top, skin, cut, side, seated, size } = seat.userData;
    const bones = [0, 1].map(arm => {
      const origin = arm * 9;
      const shoulder = vec(local, origin), elbow = vec(local, origin + 3), wrist = vec(local, origin + 6);
      const upper = elbow.clone().sub(shoulder), forearm = wrist.clone().sub(elbow);
      const id = 2 * index + arm;
      arms[0].setColorAt(id, color.set(top));
      arms[1].setColorAt(id, color.set(cut === 3 ? skin : top));
      arms[2].setColorAt(id, color.set(skin));
      return { id, shoulder, elbow, wrist, upper, forearm, upperLength: upper.length(), foreLength: forearm.length() };
    });
    const w = seated ? .99 : .76, d = seated ? 1.15 : .84;
    start.set(0, .008, seated ? .16 : .02).applyQuaternion(seat.quaternion).add(seat.position);
    matrix.compose(start, seat.quaternion, scale.set(w * size, 1, d * size));
    contact.setMatrixAt(index, matrix);
    // The low front row occupies the place under knees/hips; an aisle can pass behind either row.
    circ(start.x, start.z, (seated ? .32 : .245) * size);
    return { seat, bones, side, seated, size, cut, index };
  });

  function segment(batch, id, a, b, width, depth) {
    direction.subVectors(b, a);
    const length = direction.length();
    rotation.setFromUnitVectors(up, direction.multiplyScalar(1 / length));
    matrix.compose(a, rotation, scale.set(width, length, depth));
    batch.setMatrixAt(id, matrix);
  }
  function pose(person, side, amount, style = 0, clap = null) {
    const { seat, size, cut } = person, arm = person.bones[side], hand = side ? 1 : -1;
    start.copy(arm.shoulder);
    end.copy(arm.elbow);
    tip.copy(arm.wrist);
    if (clap !== null) {
      // Two wrists meet in front of the chest; the elbow bends outward in its natural plane.
      wristGoal.set(hand * (.047 + .115 * (1 - clap)), start.y - .16 * size, start.z + .24 * size);
      direction.subVectors(wristGoal, start);
      const distance = Math.min(arm.upperLength + arm.foreLength - .003,
        Math.max(Math.abs(arm.upperLength - arm.foreLength) + .003, direction.length()));
      direction.normalize();
      wristGoal.copy(start).addScaledVector(direction, distance);
      const along = (arm.upperLength ** 2 - arm.foreLength ** 2 + distance ** 2) / (2 * distance);
      const outward = Math.sqrt(Math.max(0, arm.upperLength ** 2 - along ** 2));
      elbowBias.set(hand * .8, -.56, -.04).addScaledVector(direction, -elbowBias.dot(direction)).normalize();
      offset.copy(start).addScaledVector(direction, along).addScaledVector(elbowBias, outward);
      end.copy(arm.upper).lerp(offset.sub(start), amount).setLength(arm.upperLength).add(start);
      tip.copy(arm.forearm).lerp(wristGoal.sub(offset.add(start)), amount).setLength(arm.foreLength).add(end);
    } else if (amount > 0) {
      // Blend joint directions and retain the Blender lengths instead of stretching the sleeves.
      offset.set(hand * (.48 - .15 * style), -.38 + .45 * style, .71).normalize();
      end.copy(arm.upper).normalize().lerp(offset, amount).setLength(arm.upperLength).add(start);
      offset.set(hand * (.31 - .20 * style), .87 - .24 * style, .39 + .39 * style).normalize();
      tip.copy(arm.forearm).normalize().lerp(offset, amount).setLength(arm.foreLength).add(end);
    }
    for (const point of [start, end, tip]) point.applyQuaternion(seat.quaternion).add(seat.position);
    const sleeve = (cut === 0 || cut === 2 ? .087 : .075) * size;
    segment(arms[0], arm.id, start, end, sleeve, sleeve);
    segment(arms[1], arm.id, end, tip, sleeve * .76, sleeve * .76);
    offset.subVectors(tip, end).setLength(.091 * size).add(tip);
    segment(arms[2], arm.id, tip, offset, .049 * size, .034 * size);
  }
  const touchArms = () => arms.forEach(batch => { batch.instanceMatrix.needsUpdate = true; });
  people.forEach(person => { pose(person, 0, 0); pose(person, 1, 0); });
  arms.forEach(batch => { batch.computeBoundingSphere(); batch.boundingSphere.radius += .65; });
  touchArms();
  contact.instanceMatrix.needsUpdate = true;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  function stop() {
    if (active.length) {
      for (const { person, side, clap } of active) {
        pose(person, side, 0);
        if (clap) pose(person, 1 - side, 0);
      }
      touchArms();
      active.length = 0;
    }
    performer = null;
  }
  document.addEventListener('visibilitychange', stop);
  addEventListener('pagehide', stop);
  addEventListener('pageshow', stop);

  function tick(dt, dancer) {
    if (document.hidden || reduced.matches || !onClubFloor(floor, dancer, world)) { stop(); return; }
    if (!performer) wait = .17;
    performer = dancer;
    wait -= dt;
    if (wait <= 0 && active.length < Math.min(ACTIVE_LIMIT, people.length)) {
      // The stride goes around all three groups and avoids replaying the same neighbor on every beat.
      const first = (3 + lap++ * 9) % people.length;
      let index = first;
      while (active.some(gesture => gesture.person === people[index])) index = (index + 1) % people.length;
      const person = people[index];
      const style = person.index % 3;
      const clap = person.seated && person.index % 4 !== 0;
      active.push({ person, side: person.side, style, clap, time: 0, duration: clap ? .94 : .54 + style * .09 });
      wait = .32 + (lap % 4) * .12;
    }
    if (!active.length) return;
    for (let i = active.length - 1; i >= 0; i--) {
      const gesture = active[i];
      gesture.time += dt;
      const progress = Math.min(1, gesture.time / gesture.duration);
      if (gesture.clap && progress < 1) {
        const rise = Math.min(1, progress / .22, (1 - progress) / .23);
        const peak = Math.min(Math.abs(progress - .36), Math.abs(progress - .62));
        const close = Math.exp(-((peak / .072) ** 2));
        const grip = rise * rise * (3 - 2 * rise);
        pose(gesture.person, 0, grip, 0, close);
        pose(gesture.person, 1, grip, 0, close);
      } else {
        const envelope = progress === 1 ? 0 : Math.sin(progress * Math.PI) ** 2;
        pose(gesture.person, gesture.side, (.67 + .12 * gesture.style) * envelope, gesture.style * .5);
        if (gesture.clap) pose(gesture.person, 1 - gesture.side, 0);
      }
      if (progress === 1) active.splice(i, 1);
    }
    touchArms();
  }
  return { tick, stop, probe: () => ({ count: people.length, seated: people.filter(person => person.seated).length,
    reacting: active.map(gesture => ({ index: gesture.person.index, gesture: gesture.clap ? 'clap' : 'lift' })) }) };
}
