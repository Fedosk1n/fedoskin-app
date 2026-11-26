// World props for the four districts and the five dedicated performance spaces.
import * as THREE from 'three';

const models = {
  tape: [.98, .59, .42], street: [.83, .90, .46], chrome: [.50, 1.10, .40],
  crate: [.75, .80, .52], stage: [.82, 1.44, .62], foundry: [.80, 1.02, .61],
};
const crewStyle = {
  rusty: ['tape', -1], acid: ['street', 1], owls: ['chrome', -1], gold: ['crate', 1],
  stencil: ['tape', -1], turn: ['street', 1], chrome: ['chrome', 1],
  funk: ['tape', -1], roots: ['crate', 1], wave: ['chrome', -1],
  rebar: ['crate', -1], volt: ['foundry', 1], forge: ['foundry', -1],
};

function simpleCabinet(kind) {
  const [w, h, d] = models[kind], radio = kind === 'tape', g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h * .91, d),
    new THREE.MeshStandardMaterial({ color: '#292d37', roughness: .8 }));
  body.name = 'matte';
  body.position.y = h * .455;
  g.add(body);
  const r = Math.min(radio ? w * .17 : w * .30, h * .29);
  const cone = new THREE.MeshStandardMaterial({ color: '#13151d', roughness: .62 });
  for (const x of radio ? [-w * .27, w * .27] : [0]) {
    const driver = new THREE.Mesh(new THREE.CircleGeometry(r, 16), cone);
    driver.position.set(x, h * .39, d * .5 + .003);
    g.add(driver);
  }
  const trim = new THREE.Mesh(new THREE.BoxGeometry(w * .65, .045, .017),
    new THREE.MeshStandardMaterial({ color: '#fff' }));
  trim.name = 'signal';
  trim.position.set(0, h * .77, d * .5 + .003);
  g.add(trim);
  return g;
}

const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function roomAt(x, z, r, bounds, colliders) {
  if (x - r < bounds.x0 || x + r > bounds.x1 || z - r < bounds.z0 || z + r > bounds.z1) return false;
  return colliders.every(c => {
    const nx = c.r === undefined ? THREE.MathUtils.clamp(x, c.x0, c.x1) : c.x;
    const nz = c.r === undefined ? THREE.MathUtils.clamp(z, c.z0, c.z1) : c.z;
    return Math.hypot(x - nx, z - nz) > r + (c.r || 0) + .06;
  });
}

export function addCitySound({ scene, W, game, library, colliders }) {
  const emitters = [], bass = [];
  const places = game._places();
  const arena = places.find(p => p.id === 'powerContest');
  const shows = [
    ['cypher', W.cyph, 2.8], ['contest', arena, 1.69], ['mall', W.center?.show, 1.75],
    ['jam', W.park?.stage, 2.95], ['ring', W.prom?.ring, 2.55],
  ].filter(([, at]) => at);
  const protectedSpots = [
    ...game.crews.map(g => [g.c.id, g, 1.98]), ...shows,
    ...places.filter(p => ['dj', 'mat', 'gate', 'pcenter', 'park', 'rp', 'atelier'].includes(p.id))
      .map(p => [p.id, p, .65]),
  ];

  function add(site, anchor, kind, tone, scale, placements, y = 0) {
    const template = library?.getObjectByName(kind) || simpleCabinet(kind);
    const [w, , d] = models[kind];
    const r = Math.hypot(w, d) * scale * .51 + .035;
    let at;
    for (const [dx, dz] of placements) {
      const x = anchor.x + dx, z = anchor.z + dz;
      if (roomAt(x, z, r, W.bounds, colliders) && protectedSpots.every(([name, center, clear]) =>
        name === site || distance({ x, z }, center) >= clear + r)) {
        at = { x, z }; break;
      }
    }
    if (!at) return;
    const prop = template.clone();
    prop.name = 'Sound system: ' + site;
    prop.userData.citySound = { site, kind, tone, radius: r };
    prop.position.set(at.x, y, at.z);
    prop.rotation.y = Math.atan2(anchor.x - at.x, anchor.z - at.z);
    prop.scale.setScalar(scale);
    prop.traverse(node => {
      if (!node.isMesh) return;
      node.receiveShadow = true;
      node.castShadow = node.name === 'matte';
      if (node.name === 'accent' || node.name === 'signal') {
        node.material = node.material.clone();
        node.material.color.set(tone);
        if (node.name === 'signal') {
          node.material.emissive.set(tone);
          emitters.push(node.material);
        }
      }
      if (node.name === 'bass') bass.push(node);
    });
    scene.add(prop);
    colliders.push({ x: at.x, z: at.z, r });
  }

  for (const g of game.crews) {
    const [kind, side] = crewStyle[g.c.id] || ['street', 1];
    const offsets = [[1.64 * side, -2.12], [-1.64 * side, -2.12], [2.1 * side, -1.57], [-2.1 * side, -1.57],
      [2.6 * side, -.95], [-2.6 * side, -.95], [2.61 * side, .95], [-2.61 * side, .95]];
    // Extra spots for narrow yards and walls. Stay outside the entrance along the north-south axis.
    for (const r of [2.45, 2.85, 3.25, 3.65]) for (const a of [-.68, -.32, 0, .31, .55]) {
      offsets.push([side * Math.cos(a) * r, Math.sin(a) * r], [-side * Math.cos(a) * r, Math.sin(a) * r]);
    }
    add(g.c.id, g, kind, g.c.col, .92, offsets);
  }
  if (W.cyph) {
    for (const side of [-1, 1]) add('cypher', W.cyph, 'stage', '#e77542', .99,
      [[side * 2.44, -2.92], [side * 2.35, -3.06], [side * 3.15, -2.32], [side * 3.9, -1.65]]);
  }
  if (arena) add('contest', arena, 'street', '#ecad56', .96,
    [[2.19, -.55], [-2.19, -.55], [1.9, -1.45], [-1.9, -1.45],
      [2.56, .52], [-2.56, .52], [2.76, -.84], [-2.76, -.84]]);
  if (W.center?.show) add('mall', W.center.show, 'chrome', '#88d6ef', .90,
    [[2.15, -.7], [-2.15, -.7], [2.45, .45], [-2.45, .45]], .021);
  if (W.park?.stage) {
    for (const side of [-1, 1]) add('jam', W.park.stage, 'stage', '#d198ee', .80,
      [[side * 2.69, -.79], [side * 2.75, -.48], [side * 2.74, .09]], .073);
  }
  if (W.prom?.ring) {
    for (const side of [-1, 1]) add('ring', W.prom.ring, 'foundry', '#edaa3e', 1.09,
      [[side * 1.68, -3.22], [side * 2.18, -3.18], [side * 3.12, -1.32], [side * 1.82, -3.5]]);
  }

  return {
    tick(beat) {
      const pulse = Math.min(1, beat);
      for (const material of emitters) material.emissiveIntensity = .12 + .38 * pulse;
      for (const driver of bass) driver.position.z = .012 * pulse;
    },
  };
}
