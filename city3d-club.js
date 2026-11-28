// An indoor breaking club with a lit battle floor, queue, DJ booth and results wall.
import { mountSign, plaqueInk } from './city3d-wayfinding.js?v=1';
import { buildClubAudience } from './city3d-club-audience.js?v=1';
import { buildClubLighting } from './city3d-club-lighting.js?v=1';
import { performDJ } from './city3d-dj.js?v=4';
import { seatedJudge } from './city3d-club-judges.js?v=2';
const t = window._t;
export const CLUB_TRACKS = ['club', 'club_floor'];
export const CLUB_BREAKERS = [
  { id: 'needle', name: 'Игла', lv: 5, col: '#ffdb91', gear: ['c:goldCap'], body: 'slim' },
  { id: 'echo', name: 'Эхо', lv: 6, col: '#83ded7', gear: ['girl', 'c:owlPhones'], body: 'small' },
  { id: 'tape', name: 'Кассета', lv: 6, col: '#e498d5', gear: ['c:rustyTrack'], body: 'stocky' },
  { id: 'pulse', name: 'Пульс', lv: 7, col: '#b7ed7b', gear: ['girl', 'c:acidBucket'], body: 'athl' },
  { id: 'pivot', name: 'Ось', lv: 7, col: '#83bbff', gear: ['c:owlHoodie'], body: 'lanky' },
  { id: 'mono', name: 'Моно', lv: 8, col: '#ffc184', gear: ['c:rustyBandana'], body: 'heavy' },
  { id: 'fader', name: 'Фейдер', lv: 8, col: '#dbc8ff', gear: ['girl', 'c:goldChain'], body: 'avg' },
];

const SURFACES = [
  ['oak', '#865333', .024, 0, .49],
  ['brick', '#354649', .036, 0, .82],
  ['terrazzo', '#293134', .018, 0, .72],
  ['velvet', '#67383f', .009, 0, .85],
  ['steel', '#464f4f', .009, .50, .50],
  ['vinyl', '#252b2d', .004, .15, .40],
];

export async function loadClubSurfaces(THREE, load) {
  const entries = await Promise.all(SURFACES.map(async ([key, color, bumpScale, metalness, roughness]) => {
    const [map, packed] = await Promise.all([
      load(`club-${key}-color.webp?v=1`, true, true),
      load(`club-${key}-surface.webp?v=1`, false, true),
    ]);
    return [key, { map, packed, color, bumpScale, metalness, roughness }];
  }));
  const textures = Object.fromEntries(entries);
  return (key, { repeat = [1, 1], tint = '#ffffff' } = {}) => {
    const { map, packed, color, bumpScale, metalness, roughness } = textures[key];
    const tile = texture => {
      if (!texture || (repeat[0] === 1 && repeat[1] === 1)) return texture;
      const copy = texture.clone();
      copy.repeat.set(...repeat);
      return copy;
    };
    const profile = tile(packed);
    return new THREE.MeshStandardMaterial({
      name: 'Club ' + key,
      color: map ? tint : color,
      map: tile(map),
      // The bake stores relief in red and roughness in green.
      bumpMap: profile, bumpScale,
      roughnessMap: profile, roughness: profile ? 1 : roughness,
      metalness,
    });
  };
}

export function buildClub(TK) {
  const { THREE, scene, W, box, circ, can, tex, mocapPerson, bodyOf, HERO, boothModel, judgeModel, surfaces: material } = TK;
  const floor = { x: 0, z: -2.4, r: 3.85 };
  const smokeEntry = { x: floor.x, z: floor.z + floor.r + .15, r: 2.12 };
  const duelSpots = [1, -1].map(side => {
    const dx = side * .3, dz = side * -2.1;
    return { x: floor.x + dx, z: floor.z + dz, yaw: Math.atan2(-dx, -dz) };
  });
  const records = { x: 6.1, z: 1.35, r: 1.8 };
  const exit = { x: -.1, z: 8.4, r: 1.6 };
  const mat = (color, roughness = .75, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const flat = color => new THREE.MeshBasicMaterial({ color, toneMapped: false });
  function mesh(geometry, material, x, y, z) {
    const o = new THREE.Mesh(geometry, material);
    o.position.set(x, y, z);
    o.receiveShadow = true;
    scene.add(o);
    return o;
  }
  const block = (w, h, d, material, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), material, x, y, z);
  function panel(canvas, w, h, x, y, z) {
    const map = tex(canvas);
    const m = mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map, transparent: true, toneMapped: false }), x, y, z);
    return { mesh: m, map };
  }

  scene.background.set('#0d151a');
  scene.fog.color.set('#0d151a');
  scene.fog.density = .012;
  const wall = material('brick', { repeat: [5, 2] });
  const steel = material('steel'), dark = material('steel', { tint: '#7c8282' });
  const velvet = material('velvet'), vinyl = material('vinyl');
  const inset = can(1024, 1024), p = inset.getContext('2d');
  p.lineWidth = 9; p.strokeStyle = 'rgba(62,29,20,.64)';
  p.beginPath(); p.arc(512, 512, 501, 0, Math.PI * 2); p.stroke();
  p.lineWidth = 4; p.strokeStyle = 'rgba(244,207,152,.90)';
  p.beginPath(); p.arc(512, 512, 489, 0, Math.PI * 2); p.stroke();
  p.lineWidth = 2; p.strokeStyle = 'rgba(223,182,119,.62)';
  p.beginPath(); p.arc(512, 512, 471, 0, Math.PI * 2); p.stroke();
  p.fillStyle = '#d9af72';
  for (let i = 0; i < 4; i++) {
    p.save();
    p.translate(512, 512);
    p.rotate(Math.PI / 4 + i * Math.PI / 2);
    p.beginPath(); p.moveTo(471, 0); p.lineTo(480, -11);
    p.lineTo(489, 0); p.lineTo(480, 11); p.closePath();
    p.fill();
    p.restore();
  }
  p.fillStyle = 'rgba(40,22,16,.33)'; p.font = '900 380px Anton, sans-serif'; p.textAlign = 'center';
  p.fillText('07', 512, 650);
  p.font = '800 65px Anton, system-ui, sans-serif';
  p.fillStyle = 'rgba(47,31,20,.78)'; p.fillText('7 TO SMOKE', 512, 809, 535);
  p.fillStyle = 'rgba(244,212,163,.93)'; p.fillText('7 TO SMOKE', 512, 805, 535);
  block(21, .18, 22, material('terrazzo', { repeat: [5, 5] }), 0, -.10, -.8);
  const disk = new THREE.CircleGeometry(floor.r, 96);
  const parquet = material('oak');
  parquet.roughnessMap = null;
  parquet.roughness = .71;
  const wood = mesh(disk, parquet, floor.x, .018, floor.z);
  wood.name = 'Club dance floor';
  wood.rotation.x = -Math.PI / 2;
  const marks = mesh(disk, new THREE.MeshStandardMaterial({
    map: tex(inset), transparent: true, depthWrite: false, roughness: .53,
  }), floor.x, .022, floor.z);
  marks.rotation.x = wood.rotation.x;
  block(2.5, .014, 5.4, material('velvet', { repeat: [1, 2] }), 0, .001, 5.68);

  // Leave the near wall open so the overhead camera can see the room.
  block(19.6, 3.7, .44, wall, 0, 1.85, -8.9); box(0, -8.9, 19.6, .6);
  for (const x of [-9.3, 9.3]) {
    block(.42, 2.6, 18.4, wall, x, 1.3, -.5);
    block(.09, .045, 18, flat('#af724b'), x * .975, .2, -.6);
    box(x, -.5, .55, 18.4);
  }
  const slat = mat('#18272c');
  for (let i = -15; i <= 15; i++) block(.07, 2.2, .11, slat, i * .58, 1.66, -8.61);
  block(15.4, .12, .28, steel, 0, 3.47, -8.51);
  [-6.1, 6.1].forEach(x => {
    block(2.25, .7, .8, velvet, x, .35, -6.8); box(x, -6.8, 2.25, .8);
  });
  const scoreCv = can(1024, 256), ink = scoreCv.getContext('2d');
  const scoreY = 2.47, scoreZ = -8.53;
  const scoreFrame = mountSign(TK.wayfinding, 'club-score-frame', scene, 0, scoreY, scoreZ);
  if (!scoreFrame) block(5.6, 1.17, .2, dark, 0, scoreY, scoreZ);
  const scorePanel = panel(scoreCv, 5.40, 1.05, 0, scoreY, scoreZ + .123);
  function board(leader = '', points = null) {
    ink.fillStyle = '#111a1d'; ink.fillRect(0, 0, 1024, 256);
    ink.strokeStyle = '#658483'; ink.lineWidth = 4; ink.strokeRect(5, 5, 1014, 246);
    ink.fillStyle = '#e8d9bc'; ink.textAlign = 'center'; ink.font = '700 64px Inter, sans-serif';
    ink.fillText(leader.toUpperCase(), 512, 96, 940);
    for (let i = 0; i < 7; i++) {
      ink.fillStyle = i < (points || 0) ? '#dfaa59' : '#3b4e4d';
      ink.fillRect(182 + i * 97, 147, 75, 37);
    }
    scorePanel.map.needsUpdate = true;
  }
  board();

  const booth = new THREE.Group();
  booth.name = 'Club DJ setup';
  // Sit outside the parquet, across from the contenders' queue, with a direct view of the circle.
  booth.position.set(5.75, 0, -4.62);
  booth.rotation.y = Math.atan2(floor.x - booth.position.x, floor.z - booth.position.z);
  scene.add(booth);
  const approach = booth.localToWorld(new THREE.Vector3(0, 0, 1.65));
  const dj = { x: approach.x, z: approach.z, r: 1.6 };
  const walnut = material('oak', { tint: '#9e8e7c' });
  function imported(model) {
    model.traverse(obj => {
      if (!obj.isMesh) return;
      const mapped = { 'club walnut': walnut, 'club upholstery': velvet, 'club vinyl': vinyl }[obj.name];
      if (mapped) obj.material = mapped;
      obj.castShadow = obj.name === 'matte' || obj.name === 'club upholstery' || obj.name === 'club walnut';
    });
  }
  function boothMesh(geo, finish, x, y, z) {
    const item = new THREE.Mesh(geo, finish);
    item.position.set(x, y, z); item.receiveShadow = true; booth.add(item);
    return item;
  }
  let decks = ['record-left', 'record-right'].map(name => boothModel?.getObjectByName(name));
  let level = boothModel?.getObjectByName('front meter'), faders = [];
  if (decks.every(Boolean) && level?.material) {
    imported(boothModel);
    booth.add(boothModel);
    faders = ['fader-left', 'fader-right'].map(name => boothModel.getObjectByName(name));
  } else {
    boothMesh(new THREE.BoxGeometry(2.17, 1, .89), walnut, 0, .50, 0);
    decks = [-.66, .66].map(x => {
      boothMesh(new THREE.BoxGeometry(.69, .08, .72), steel, x, 1.04, .02);
      return boothMesh(new THREE.CylinderGeometry(.25, .25, .021, 40), vinyl, x, 1.10, .055);
    });
    boothMesh(new THREE.BoxGeometry(.50, .12, .72), dark, 0, 1.06, .02);
    level = boothMesh(new THREE.BoxGeometry(1.22, .035, .015),
      new THREE.MeshStandardMaterial({ emissive: '#bf814b', color: '#c39562' }), 0, .89, .453);
  }
  const djLook = HERO.topDown(4, ['girl', 'c:djGloves']);
  djLook.phones = true;
  Object.assign(djLook.col, { phones: '#c79465', top: '#314851', sleeve: '#455761' });
  const host = mocapPerson(djLook, { body: bodyOf(87, { type: 'slim', girl: true }) });
  booth.add(host.root);
  const mix = performDJ(host, booth, decks, level, faders, { name: 'Club DJ', watchFloor: true });
  const recordBadge = mountSign(TK.wayfinding, 'decks-badge', booth, -.63, .56, .463);
  if (recordBadge) plaqueInk(recordBadge, 'DJ', { width:.23, height:.096, z:.088, color:'#272329' });
  // Along the rotated counter, keeping the floor-side approach open.
  for (const x of [-1.12, -.56, 0, .56, 1.12]) {
    const at = booth.localToWorld(new THREE.Vector3(x, 0, 0));
    circ(at.x, at.z, .47);
  }
  const operator = host.root.getWorldPosition(new THREE.Vector3());
  circ(operator.x, operator.z, .32);

  // Archive wall: printed results above a low bench.
  const rz = records.z - 1.35, poster = material('oak', { tint: '#9c8985' });
  block(2.92, .58, .78, velvet, records.x, .29, rz + .22); box(records.x, rz + .22, 2.92, .78);
  block(3.1, 2.49, .22, poster, records.x, 1.48, rz - .36);
  const archive = mountSign(TK.wayfinding, 'club-archive', scene, records.x, 1.62, rz - .246);
  if (archive) {
    plaqueInk(archive, t('Стена результатов'), { y:.42, z:.136, width:2.24, height:.30 });
    ['01', '02', '03'].forEach((round, i) => {
      const sheet = can(240, 240), p = sheet.getContext('2d');
      p.fillStyle = '#554941'; p.font = '900 41px Inter, sans-serif'; p.fillText(round, 21, 50);
      p.fillStyle = '#9a5547'; p.fillRect(91, 25, 124, 8); p.fillRect(91, 40, 93, 5);
      p.strokeStyle = '#76645a'; p.lineWidth = 2; p.beginPath(); p.rect(21, 69, 194, 134);
      for (let row = 1; row < 6; row++) { p.moveTo(21, 69 + row * 22); p.lineTo(215, 69 + row * 22); }
      for (const x of [115, 151, 185]) { p.moveTo(x, 69); p.lineTo(x, 203); }
      p.stroke();
      const print = panel(sheet, .51, .49, 0, 0, 0).mesh;
      archive.add(print); print.position.set((i - 1) * .85, -.20, .161);
    });
  }

  // The waiting breakers follow the left edge of the cypher with room for footwork.
  const queueRadius = floor.r + .87;
  const slots = CLUB_BREAKERS.map((_, i) => {
    const angle = (i - (CLUB_BREAKERS.length - 1) / 2) * .26;
    const x = floor.x - Math.cos(angle) * queueRadius, z = floor.z + Math.sin(angle) * queueRadius;
    return { x, z, yaw: Math.atan2(floor.x - x, floor.z - z) };
  });
  const queueMark = flat('#508480');
  for (const { x, z, yaw } of slots) block(.59, .009, .033, queueMark, x, .019, z).rotation.y = yaw;
  const dancers = CLUB_BREAKERS.map((b, i) => {
    const J = mocapPerson(HERO.topDown(b.lv, b.gear), { body: bodyOf(602 + i * 31, { type: b.body, girl: b.gear.includes('girl') }) });
    J.clubRest = slots[i];
    J.root.position.set(slots[i].x, 0, slots[i].z); J.root.rotation.y = slots[i].yaw;
    J.play('Breakdance_Ready', { at: .15 * i, speed: .87 + .035 * i }); scene.add(J.root);
    return { ...b, name: t(b.name), J };
  });
  const judgeZ = -7.24;
  const judgeXs = [-1.18, 0, 1.18];
  const chair = judgeModel?.getObjectByName('chair');
  if (chair) {
    imported(judgeModel);
    chair.removeFromParent();
    for (const x of judgeXs) {
      const seat = chair.clone();
      seat.name = 'Club chair';
      seat.position.x = x;
      judgeModel.add(seat);
    }
    judgeModel.position.z = judgeZ;
    scene.add(judgeModel);
  } else {
    for (const x of judgeXs) {
      block(.76, .25, .36, dark, x, .125, judgeZ - .15);
      block(.76, .116, .36, velvet, x, .283, judgeZ - .15);
      block(.80, .61, .09, velvet, x, .731, judgeZ - .37).rotation.x = .13;
      for (const side of [-1, 1]) {
        block(.048, .389, .052, dark, x + side * .37, .41, judgeZ - .40);
        block(.045, .402, .044, dark, x + side * .392, .425, judgeZ - .015);
        block(.044, .314, .043, dark, x + side * .392, .475, judgeZ - .32);
        block(.17, .081, .67, walnut, x + side * .342, .622, judgeZ - .035);
      }
    }
  }
  const judges = judgeXs.map((x, i) => {
    const gear = [['c:goldChain'], ['girl', 'c:owlHoodie'], ['c:goldCap']][i];
    const J = mocapPerson(HERO.topDown(5 + i, gear), { body: bodyOf(925 + i * 21, { girl: i === 1 }) });
    J.root.name = 'Club judge ' + (i + 1);
    J.root.position.set(x, 0, judgeZ);
    scene.add(J.root); box(x, judgeZ, .90, .82);
    return seatedJudge(J, i, scene, can, tex);
  });
  for (const x of [-1.91, 1.91]) box(x, judgeZ - .04, .40, .39);

  const entryZ = 8.70;
  const door = mountSign(TK.wayfinding, 'club-exit-frame', scene, exit.x, 0, entryZ);
  if (door) {
    for (const side of [-1, 1]) plaqueInk(door, t('Выход в Промзону'), { width:1.52, height:.22, y:2.29,
      z:side * .214, yaw:side < 0 ? Math.PI : 0, color:'#dcebc9', symbol:'exit' });
    for (const side of [-1, 1]) {
      box(exit.x + side * 1.17, entryZ, .29, .36);
      box(exit.x + side * 1.98, entryZ + .035, 1.58, .38);
    }
  }
  W.tickers.push(dt => {
    mix.tick(dt);
    judges.forEach(judge => judge.tick(dt));
  });
  const audience = buildClubAudience(TK, TK.audienceModel, floor);
  const lighting = buildClubLighting(TK, TK.lightingModel, floor);
  W.club = { audience, lighting, floor, smokeEntry, duelSpots, dj, records, exit, slots, dancers, board, mix,
    showVotes: entries => entries.forEach((entry, i) => judges[i].show(entry.name, entry.col)),
    hideVotes: () => judges.forEach(judge => judge.hide()),
  };
}
