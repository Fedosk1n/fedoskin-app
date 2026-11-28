import { onClubFloor } from './city3d-club-audience.js?v=1';
import { loadUntexturedModel } from './city3d-festival-art.js?v=3';

// Each spot starts just clear of its Blender lens and points at the matching focus marker.
const fixtures = [
  { id: 'key-west', color: '#fff0d4', energy: 220, range: 14, angle: .64, lift: .07, fallback: [-3.45, 2.48, -8.12], aim: [-.44, .62, -1.40] },
  { id: 'key-east', color: '#ffddbc', energy: 109, range: 12, angle: .54, lift: .05, fallback: [3.43, 2.48, -8.12], aim: [.85, .83, -3.44] },
  { id: 'dj-wash', color: '#75dbcb', energy: 72, range: 7, angle: .66, lift: .15, fallback: [8.53, 2.08, -4.93], aim: [6.15, .68, -5.52] },
];

export function loadClubLighting() {
  return loadUntexturedModel('./anim/club-lighting.glb?v=1').catch(error => {
    console.warn('Club equipment model unavailable', error);
    return null;
  });
}

export function buildClubLighting({ THREE, scene, box, FILL_K }, model, floor) {
  if (model) {
    model.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
    scene.add(model);
    const serviceCase = model.getObjectByName('Service case footprint');
    if (serviceCase) {
      const { x, z } = serviceCase.getWorldPosition(new THREE.Vector3());
      box(x, z, .82, .54);
    }
  }
  const rig = fixtures.map(spec => {
    const light = new THREE.SpotLight(spec.color, spec.energy * FILL_K, spec.range, spec.angle, .55, 2);
    light.name = 'Club ' + spec.id;
    const lens = model?.getObjectByName(spec.id + '-lens');
    const aim = model?.getObjectByName(spec.id + '-aim');
    if (lens) lens.getWorldPosition(light.position);
    else light.position.fromArray(spec.fallback);
    if (aim) aim.getWorldPosition(light.target.position);
    else light.target.position.fromArray(spec.aim);
    scene.add(light, light.target);
    return { light, rest: light.intensity, lift: spec.lift };
  });
  // Indirect light reflected off the sprung floor keeps the faces, brick and scorecard legible.
  const bounce = new THREE.PointLight('#d0d0cc', 37 * FILL_K, 8.0, 1.65);
  bounce.name = 'Club reflected light';
  bounce.position.set(.35, 2.55, -5.86);
  scene.add(bounce);
  const world = new THREE.Vector3(), reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let lift = 0;

  function paint(value) {
    lift = value;
    for (const f of rig) f.light.intensity = f.rest * (1 + lift * f.lift);
  }
  const settle = () => paint(0);
  document.addEventListener('visibilitychange', settle);
  addEventListener('pagehide', settle);
  reduced.addEventListener('change', settle);

  function tick(dt, dancer, beat) {
    if (document.hidden || reduced.matches) {
      if (lift) settle();
      return;
    }
    // A soft rise and fall per bar, tied to the audible kick grid. Keep the same floor key and hue.
    const playing = Number.isFinite(beat) && beat >= 0 && onClubFloor(floor, dancer, world);
    if (!playing && !lift) return;
    const next = playing ? .5 + .5 * Math.cos((beat % 4) * Math.PI / 2) : 0;
    const smooth = THREE.MathUtils.damp(lift, next, 7, dt);
    paint(!playing && smooth < .001 ? 0 : smooth);
  }

  return { tick };
}
