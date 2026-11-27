// An indoor breaking club with a lit battle floor, queue, DJ booth and results wall.
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

export function buildClub(TK) {
  const { THREE, scene, W, box, circ, can, tex, mocapPerson, bodyOf, HERO, rng } = TK;
  const floor = { x: 0, z: -2.4 };
  const dj = { x: -6.2, z: 1.25, r: 1.8 };
  const records = { x: 6.1, z: 1.35, r: 1.8 };
  const exit = { x: -.1, z: 8.4, r: 1.6 };
  const colors = { gold: '#e7a84f', turquoise: '#48d3ca', dark: '#191f22' };
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
  function sign(txt, w, h, x, y, z, color = '#f5d6a3') {
    const cv = can(768, 160), p = cv.getContext('2d');
    p.fillStyle = '#101b20'; p.fillRect(0, 0, cv.width, cv.height);
    p.strokeStyle = color; p.lineWidth = 5; p.strokeRect(5, 5, cv.width - 10, cv.height - 10);
    p.fillStyle = color; p.textAlign = 'center'; p.textBaseline = 'middle'; p.font = '700 72px Inter, sans-serif';
    p.fillText(txt, cv.width / 2, cv.height / 2 + 4, cv.width - 50);
    const o = panel(cv, w, h, x, y, z).mesh;
    o.rotation.x = -.65;
    return o;
  }
  function label(txt, x, y, z, color) {
    const cv = can(600, 128), p = cv.getContext('2d');
    p.fillStyle = '#101518'; p.beginPath(); p.roundRect(6, 14, 588, 98, 24); p.fill();
    p.strokeStyle = color; p.stroke();
    p.fillStyle = color; p.textAlign = 'center'; p.textBaseline = 'middle'; p.font = 'bold 52px Inter, sans-serif';
    p.fillText(txt, 300, 65, 540);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(cv), toneMapped: false }));
    sprite.position.set(x, y, z); sprite.scale.set(2.9, .62, 1); scene.add(sprite);
    return sprite;
  }

  scene.background.set('#0d151a');
  scene.fog.color.set('#0d151a');
  scene.fog.density = .012;
  const wall = mat('#2a3439'), dark = mat(colors.dark), steel = mat('#465658', .45, .65);
  const parquet = can(1024, 1024), p = parquet.getContext('2d'), random = rng(20307);
  for (let y = 0; y < 32; y++) {
    for (let x = -1; x < 8; x++) {
      const x0 = x * 128 + y % 3 * 42, y0 = y * 32;
      p.fillStyle = `hsl(${27 + random() * 14}, ${32 + random() * 12}%, ${31 + random() * 11}%)`;
      p.fillRect(x0, y0, 127, 31);
      p.strokeStyle = 'rgba(40,23,12,.17)'; p.lineWidth = 1;
      for (let n = 0; n < 4; n++) {
        const gy = y0 + random() * 30;
        p.beginPath(); p.moveTo(x0, gy); p.quadraticCurveTo(x0 + 70, gy + random() * 6, x0 + 126, gy + 2); p.stroke();
      }
    }
  }
  p.strokeStyle = '#ffcf85'; p.lineWidth = 4;
  p.strokeRect(34, 34, 956, 956);
  p.beginPath(); p.arc(512, 512, 326, 0, Math.PI * 2); p.stroke();
  p.strokeStyle = '#8b472e'; p.setLineDash([21, 13]); p.lineWidth = 10;
  p.beginPath(); p.arc(512, 512, 350, 0, Math.PI * 2); p.stroke();
  p.setLineDash([]);
  p.fillStyle = 'rgba(60,29,17,.24)'; p.font = '900 380px Anton, sans-serif'; p.textAlign = 'center';
  p.fillText('07', 512, 650);
  block(21, .18, 22, mat('#242d30'), 0, -.10, -.8);
  const wood = mesh(new THREE.PlaneGeometry(7.3, 7.3),
    new THREE.MeshStandardMaterial({ map: tex(parquet), roughness: .55 }), floor.x, .018, floor.z);
  wood.rotation.x = -Math.PI / 2;
  const lane = block(2.5, .014, 5.4, mat('#633631'), 0, .001, 5.68);
  lane.receiveShadow = false;
  [-1.23, 1.23].forEach(x => block(.035, .018, 5.4, flat('#be7545'), x, .009, 5.68));

  // Leave the near wall open so the overhead camera can see the room.
  block(19.6, 3.7, .44, wall, 0, 1.85, -8.9); box(0, -8.9, 19.6, .6);
  for (const x of [-9.3, 9.3]) {
    block(.42, 2.6, 18.4, wall, x, 1.3, -.5);
    block(.09, .045, 18, flat('#af724b'), x * .975, .2, -.6);
    box(x, -.5, .55, 18.4);
  }
  const slat = mat('#18272c'), railing = mat('#42362d');
  for (let i = -15; i <= 15; i++) block(.07, 2.2, .11, slat, i * .58, 1.66, -8.61);
  block(15.4, .12, .28, steel, 0, 3.47, -8.51);
  [-6.1, 6.1].forEach(x => {
    block(.95, 2.25, .38, dark, x, 1.25, -8.47);
    for (let j = 0; j < 3; j++) mesh(new THREE.CircleGeometry(j === 0 ? .22 : .31, 18), flat(j === 0 ? '#607575' : '#1a1818'), x, .65 + j * .62, -8.267);
    block(.085, 2.17, .16, flat(colors.turquoise), x - 1.05, 1.5, -8.49);
    block(2.25, .7, .8, mat('#673e39'), x, .35, -6.8); box(x, -6.8, 2.25, .8);
  });
  sign('7 TO SMOKE', 8.5, 1.25, 0, 2.82, -8.34, '#ffd68c');
  const scoreCv = can(1024, 256), ink = scoreCv.getContext('2d');
  const scorePanel = panel(scoreCv, 5.6, 1.4, 0, 1.32, -8.35);
  scorePanel.mesh.rotation.x = -.55;
  function board(leader = '7 TO SMOKE', points = null) {
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

  // Listening booth and crate shelves.
  block(3.2, 1.06, .92, dark, dj.x, .53, dj.z - 1.6); box(dj.x, dj.z - 1.6, 3.2, .96);
  block(3.34, .08, 1, mat('#704629'), dj.x, 1.09, dj.z - 1.6);
  const disks = [-.97, .97].map(offset => {
    const x = dj.x + offset, z = dj.z - 1.59;
    block(.86, .11, .72, steel, x, 1.17, z);
    const disk = mesh(new THREE.CylinderGeometry(.29, .29, .025, 24), dark, x, 1.24, z);
    const sticker = mesh(new THREE.CylinderGeometry(.095, .095, .012, 16), flat(colors.gold), x, 1.258, z);
    sticker.position.x += .11;
    return { disk, sticker, x };
  });
  for (let i = 0; i < 5; i++) block(.038, .014, .36, flat(i % 2 ? colors.gold : colors.turquoise), dj.x - .22 + i * .105, 1.172, dj.z - 1.59);
  block(.58, .095, .61, steel, dj.x, 1.13, dj.z - 1.59);
  const host = mocapPerson(HERO.topDown(4, ['girl', 'c:djGloves', 'c:owlPhones']), { body: bodyOf(87, { type: 'slim', girl: true }) });
  host.root.position.set(dj.x, 0, dj.z - 2.34); scene.add(host.root);
  host.play('Breakdance_Ready', { speed: .96 });
  circ(dj.x, dj.z - 2.34, .32);

  // Archive wall: printed results above a low bench.
  const rz = records.z - 1.35, poster = mat('#54332d');
  block(2.92, .58, .78, mat('#684439'), records.x, .29, rz + .22); box(records.x, rz + .22, 2.92, .78);
  block(3.1, 2.49, .22, poster, records.x, 1.48, rz - .36);
  [0, 1, 2].forEach((n) => sign(['07', '1 VS 1', '7 TO SMOKE'][n], .87, .61, records.x - .93 + n * .93, 1.72, rz - .18));
  block(3.12, .045, .05, flat(colors.gold), records.x, 2.54, rz - .18);

  // The line is visibly outside the floor. Two spot lights stay fixed over the dancers.
  const slots = Array.from({ length: 7 }, (_, i) => ({ x: -4.02, z: -5.6 + i * 1.25 }));
  for (const { x, z } of slots) block(.59, .009, .033, flat('#508480'), x, .019, z);
  for (const [color, strength, x, y, z] of [
    ['#ffc895', 47, 0, 5.1, -2.8], ['#70d6ea', 41, -5.4, 3.9, -4.7], ['#e29b8a', 29, 5.2, 3.6, -.15],
    ['#8edde2', 19, dj.x, 2.8, dj.z], ['#fbbb87', 20, records.x, 2.6, records.z],
  ]) {
    const light = new THREE.PointLight(color, strength * TK.FILL_K, 12, 1.6);
    light.position.set(x, y, z); scene.add(light);
  }

  const dancers = CLUB_BREAKERS.map((b, i) => {
    const J = mocapPerson(HERO.topDown(b.lv, b.gear), { body: bodyOf(602 + i * 31, { type: b.body, girl: b.gear.includes('girl') }) });
    J.clubRest = slots[i];
    J.root.position.set(slots[i].x, 0, slots[i].z); J.root.rotation.y = Math.PI / 2;
    J.play('Breakdance_Ready', { at: .15 * i, speed: .87 + .035 * i }); scene.add(J.root);
    return { ...b, name: t(b.name), J };
  });
  const judges = [-1.33, 0, 1.33].map((x, i) => {
    const gear = [['c:goldChain'], ['girl', 'c:owlHoodie'], ['c:goldCap']][i];
    const J = mocapPerson(HERO.topDown(5 + i, gear), { body: bodyOf(925 + i * 21, { girl: i === 1 }) });
    J.root.position.set(x, 0, -7.22);
    J.play('Breakdance_Ready', { at: i * .38, speed: .85 + i * .05 });
    scene.add(J.root); circ(x, -7.22, .3);
    return J;
  });
  block(4.65, .61, .5, dark, 0, .305, -6.65); box(0, -6.65, 4.65, .53);
  block(4.63, .04, .045, flat('#967653'), 0, .57, -6.377);
  sign(t('СУДЬИ'), 1.32, .31, 0, .46, -6.39);

  const signs = [
    label('←  ' + t('Пульт диджея'), -2.8, 1.4, 2.02, '#86e7e5'),
    label(t('Стена результатов') + '  →', 2.8, 1.4, 2.02, '#ffce8a'),
    label('7 TO SMOKE', floor.x, 2.3, floor.z + 3.5, '#ffce8a'),
    label(t('Пульт диджея'), dj.x, 2.05, dj.z - .55, '#86e7e5'),
    label(t('Стена результатов'), records.x, 2.2, records.z, '#ffce8a'),
    label(t('Выход в Промзону'), exit.x, 2.15, exit.z + .34, '#edb48b'),
  ];
  W.tickers.push((dt, now, beats) => {
    host.tick(dt);
    judges.forEach(J => J.tick(dt));
    for (const d of disks) {
      d.disk.rotation.y += dt * 2.9;
      d.sticker.position.x = d.x + Math.cos(now * 3) * .11;
      d.sticker.position.z = d.disk.position.z + Math.sin(now * 3) * .11;
    }
    steel.emissive.set('#357378'); steel.emissiveIntensity = .12 + .17 * Math.pow(1 - (beats % 1), 4);
  });
  W.club = { floor, dj, records, exit, slots, dancers, board, signs };
}
