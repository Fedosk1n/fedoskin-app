// City 3D — district «ПАРК И НАБЕРЕЖНАЯ» (owner 16.11.2026 «продолжи работу над городом»).
// A night park by the river: lawns and gravel alleys, the granite embankment with globe lamps and a boat passing by,
// the open-air stage «ЭСТРАДА» (a shell with a round wooden floor — the daily jam is danced here), the old-timer's chess
// tables, a street-workout corner (warm-up), joggers and people out for a walk — all of different builds.
// Built in code with the toolkit of city3d.js (TK). The game on top is in city3d-game.js; what it needs is left in
// W.park: { stage, dancers, og, bars, gateCenter, gateProm, crowd(on) }.
const _t = window._t || ((s, v) => (v ? s.replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? v[k] : m)) : s));   // the city's translation (city3d.html)
export async function buildPark(TK) {
  const { THREE, RoundedBoxGeometry, scene, W, OR, M, glowMat, tex, can, grain, blotch, rng, lerp, decal, paintCanvas, box, circ,
    lamps, dust, mocapPerson, bodyOf, stride, standPose, HERO } = TK;
  const PI = Math.PI;
  const mesh = (geo, mat, x, y, z, par = scene) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; par.add(m); return m; };
  const glowPlane = (c, w, h, x, y, z, ry = 0, k = 1) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex(c), transparent: true, toneMapped: false, color: new THREE.Color(k, k, k) }));
    m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); return m; };
  const point = (col, power, x, y, z, dist = 9) => { const l = new THREE.PointLight(col, power * (TK.FILL_K || 1), dist, 1.6); l.position.set(x, y, z); scene.add(l); return l; };
  // signs are translated (_t) and shrunk to fit: maxW = the room the sign has (default: what is left of the canvas around px)
  const text = (x, t, px, py, font, col, align = 'center', maxW) => { t = _t(t); x.font = font; x.textAlign = align; x.textBaseline = 'middle'; x.fillStyle = col;
    const room = (maxW || (align === 'center' ? 2 * Math.min(px, x.canvas.width - px) : align === 'left' ? x.canvas.width - px : px)) - 8, w = x.measureText(t).width;
    if (w > room) x.font = font.replace(/(\d+(?:\.\d+)?)px/, (m, n) => (n * room / w).toFixed(1) + 'px');
    x.fillText(t, px, py); };
  const flat = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.rotation.x = -PI / 2; m.position.set(x, y, z); m.receiveShadow = true; scene.add(m); return m; };

  // a deep green-blue night: the park is darker than the Centre, lit by warm globes
  scene.background.set('#090d10'); scene.fog.color.set('#090d10'); scene.fog.density = .014;

  // ---------- ground: grass ----------
  { const S = 512, c = can(S, S), x = c.getContext('2d'), r = rng(3);
    x.fillStyle = '#1f3524'; x.fillRect(0, 0, S, S);
    blotch(x, S, S, 70, 'rgba(10,25,12,A)', 20, 110, .3, r); blotch(x, S, S, 50, 'rgba(70,110,50,A)', 14, 80, .12, r);
    for (let i = 0; i < 2600; i++) { const px = r() * S, py = r() * S, l = 3 + r() * 5; x.strokeStyle = `hsla(${105 + r() * 30},${30 + r() * 20}%,${16 + r() * 16}%,.7)`; x.lineWidth = 1; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (r() - .5) * 3, py - l); x.stroke(); }
    grain(c, 14, 5);
    flat(new THREE.PlaneGeometry(80, 60), new THREE.MeshStandardMaterial({ map: tex(c, { repeat: [16, 12] }), roughness: .97 }), 0, 0, 17.8); }
  const loadSurface = (file, mesh) => mesh
    ? new THREE.TextureLoader().loadAsync(new URL('./img/' + file + '.webp?v=1', import.meta.url).href).catch(() => null)
    : null;
  // Start both surface loads together. The textures decorate the baked geometry at their original scale.
  const paths = TK.pathModel, gravel = paths?.getObjectByName('park gravel');
  const playground = TK.playgroundModel, rubber = playground?.getObjectByName('playground rubber');
  const [gravelMap, rubberMap] = await Promise.all([loadSurface('park-gravel', gravel), loadSurface('playground-rubber', rubber)]);
  // Blender exported a single surface across all crossings, plus one batched border.
  if (gravel?.material) {
    if (gravelMap) {
      gravelMap.colorSpace = THREE.SRGBColorSpace;
      gravelMap.wrapS = gravelMap.wrapT = THREE.RepeatWrapping;
      gravelMap.anisotropy = TK.maxAniso;
      gravel.material.map = gravelMap;
    } else gravel.material.color.set('#817567');
    scene.add(paths);
  } else {
    // Flat fallback sections meet edge-to-edge, without overlaps at the junctions.
    const material = M('#817567', .94);
    for (const [x0, x1, z0, z1] of [
      [-15, 15, -11.9, -9.3], [-1.38, 1.38, -9.3, 14.66],
      [-12.3, -10.1, -9.3, 11.2], [10.2, 12.4, -9.3, 11.2],
      [-12.3, -1.38, 11.2, 13.45], [1.38, 12.4, 11.2, 13.45],
      [-13.14, -12.3, .45, 2.35], [-10.1, -1.38, .45, 2.35], [1.38, 10.2, -3.35, -1.45],
    ]) flat(new THREE.PlaneGeometry(x1 - x0, z1 - z0), material, (x0 + x1) / 2, .015, (z0 + z1) / 2);
  }

  // ---------- the embankment and the river (north) ----------
  const QZ = -12;   // the parapet line
  { const granite = M('#5d626b', .7), dark = M('#3d4148', .8);
    mesh(new THREE.BoxGeometry(34, .95, .5), granite, 0, .475, QZ); mesh(new THREE.BoxGeometry(34.2, .1, .66), M('#7b808a', .55), 0, .98, QZ).castShadow = false;
    mesh(new THREE.BoxGeometry(34, 2.4, .3), dark, 0, -1.2, QZ - .3); box(0, QZ, 34, .7);
    // pedestals with globe lamps — the embankment's string of lights
    for (let px = -12; px <= 12; px += 4.8) { mesh(new THREE.BoxGeometry(.6, 1.25, .62), granite, px, .62, QZ); mesh(new THREE.CylinderGeometry(.04, .05, 1.1, 8), M('#1c1f24', .5, .6), px, 1.8, QZ);
      const gl = mesh(new THREE.SphereGeometry(.2, 14, 10), glowMat('#ffd9a0', 1.25), px, 2.45, QZ); gl.castShadow = false; }
    [-9.6, 0, 9.6].forEach(px => point('#ffc98a', 20, px, 2.5, QZ + .9, 10));
    // the water: dark, glossy, with long streaks of the lights of the other bank that drift slowly
    const S = 512, c = can(S, S), x = c.getContext('2d'), r = rng(12); x.fillStyle = '#000'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 18; i++) { const px = r() * S, col = ['255,190,110', '120,190,255', '255,120,90', '255,240,200'][i % 4], w = 6 + r() * 10, f = .05 + r() * .05, len = .45 + r() * .5;
      for (let y = 0; y < S * len; y += 2) { const k = 1 - y / (S * len), wob = Math.sin(y * f + i) * (2 + y * .012); for (let q = 0; q < 3; q++) { x.fillStyle = `rgba(${col},${k * (.16 + q * .16)})`; x.fillRect(px + wob - w * (1.5 - q * .5) / 2, y, w * (1.5 - q * .5), 2); } } }
    const wt = tex(c, { repeat: [2, 1] });
    const water = flat(new THREE.PlaneGeometry(90, 26), new THREE.MeshStandardMaterial({ color: '#07131c', emissive: '#ffffff', emissiveMap: wt, emissiveIntensity: 1.5, roughness: .12, metalness: .55 }), 0, -1.1, QZ - 13.3);
    // the far bank: a dark quay with a row of windows and lamps
    const fc = can(2048, 128), fx = fc.getContext('2d'); for (let i = 0; i < 420; i++) { fx.fillStyle = ['#ffd29a', '#9fd2ff', '#ffb27a', '#fff3d6'][i % 4]; fx.globalAlpha = .35 + r() * .65; fx.fillRect(r() * 2048, 20 + r() * 96, 3 + r() * 5, 4 + r() * 6); } fx.globalAlpha = 1;
    mesh(new THREE.BoxGeometry(90, 7, 1), M('#0c0f14', .9), 0, 2.2, QZ - 26.4).castShadow = false; glowPlane(fc, 90, 5.6, 0, 2.8, QZ - 25.85, 0, 1.2);
    // a pleasure boat with a string of lamps goes down the river
    const boat = new THREE.Group(); scene.add(boat); mesh(new RoundedBoxGeometry(5.4, .7, 1.7, 2, .2), M('#e9e4d8', .5), 0, -.7, 0, boat); mesh(new RoundedBoxGeometry(3.2, .6, 1.3, 2, .1), M('#23323f', .4, .3), -.3, -.1, 0, boat);
    mesh(new THREE.BoxGeometry(3, .32, .04), glowMat('#ffe2a8', 2), -.3, -.1, .66, boat).castShadow = false;
    for (let i = 0; i < 8; i++) mesh(new THREE.SphereGeometry(.07, 8, 6), glowMat(['#ff5a4a', '#ffd23f', '#7cff4f', '#4fc0ff'][i % 4], 3), -2.4 + i * .68, .5 - Math.abs(i - 3.5) * .06, 0, boat).castShadow = false;
    let bt = 6; W.tickers.push(dt => { bt += dt; const u = (bt % 46) / 46; boat.position.set(-30 + u * 60, 0, QZ - 6.5); boat.rotation.z = Math.sin(bt * 1.3) * .015; wt.offset.y = bt * .012; wt.offset.x = Math.sin(bt * .2) * .01; water.material.emissiveIntensity = 1.5 + Math.sin(bt * .9) * .15; });
  }

  // ---------- trees, bushes, flower beds ----------
  const tree = (x, z, s = 1, kind = 0) => { const r = rng((x * 31 + z * 17 + 7) | 0), g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    mesh(new THREE.CylinderGeometry(.1 * s, .17 * s, 2.5 * s, 8), M('#3a2c22', .9), 0, 1.25 * s, 0, g);
    const cols = kind ? ['#5a4a1c', '#6b3f1a', '#4d5a20'] : ['#1d4530', '#235238', '#1a3d2a'];
    [[0, 3.1, 0, 1.15], [.6, 2.6, .3, .8], [-.55, 2.7, -.3, .85], [.1, 3.8, -.1, .75], [-.2, 2.5, .5, .7]].forEach(([dx, y, dz, rr]) => { const c = mesh(new THREE.IcosahedronGeometry(rr * s, 1), M(cols[Math.floor(r() * 3)], .95, 0, { flatShading: true }), dx * s, y * s, dz * s, g); c.rotation.set(r() * 3, r() * 3, 0); });
    circ(x, z, .32); };
  // tall things stay on the edges and the north half: anything tall south of the walking area would hide the hero from the camera
  [[-12.6, -8.2, 1.1], [-12.7, -3.2, 1], [-12.6, 7.4, 1.15, 1], [12.8, -8.4, 1.1, 1], [12.9, 2.2, 1], [12.8, 7.8, 1.1], [4.6, 6.2, .95, 1], [-3.6, 9.6, .8]].forEach(a => tree(...a));
  const bush = (x, z, w, d) => { const b = mesh(new RoundedBoxGeometry(w, .6, d, 3, .22), M('#1c3d29', .95), x, .3, z); b.castShadow = false; box(x, z, w, d); };
  bush(-6.4, 13.9, 9.4, .7); bush(6.4, 13.9, 9.4, .7); bush(-13.2, -7, .7, 6); bush(13.3, 9.6, .7, 5);
  const bed = (x, z, rr, cols) => { const r = rng((x * 13 + z * 7) | 0); mesh(new THREE.CylinderGeometry(rr, rr + .08, .22, 20), M('#4d5158', .9), x, .11, z); mesh(new THREE.CylinderGeometry(rr - .1, rr - .1, .24, 20), M('#2a2018', 1), x, .12, z).castShadow = false;
    for (let i = 0; i < 16; i++) { const a = r() * 7, d = Math.sqrt(r()) * (rr - .2); mesh(new THREE.IcosahedronGeometry(.1 + r() * .07, 0), M(cols[i % cols.length], .8, 0, { flatShading: true }), x + Math.cos(a) * d, .3, z + Math.sin(a) * d).castShadow = false; } circ(x, z, rr + .1); };
  bed(-3.2, 4.6, .9, ['#ff5a7a', '#ffd23f', '#ffffff']); bed(3.3, 9.6, .8, ['#b03bff', '#ff8a3a', '#ffffff']);

  // ---------- benches, bins, park lamps ----------
  const bench = (x, z, ry) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g); const wood = M('#7a5532', .8), iron = M('#1c1f24', .5, .6);
    for (let i = 0; i < 3; i++) mesh(new THREE.BoxGeometry(1.7, .05, .13), wood, 0, .45, -.15 + i * .15, g); for (let i = 0; i < 2; i++) mesh(new THREE.BoxGeometry(1.7, .13, .04), wood, 0, .66 + i * .17, -.25, g);
    [-.7, .7].forEach(px => { mesh(new THREE.BoxGeometry(.06, .45, .42), iron, px, .22, 0, g); mesh(new THREE.BoxGeometry(.06, .5, .05), iron, px, .68, -.26, g); });
    const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry)); box(x, z, 1.7 * c + .5 * s, 1.7 * s + .5 * c); };
  [[-1.95, 7.2, PI / 2], [1.95, 7.2, -PI / 2], [-1.95, -3.4, PI / 2], [-11.4, -9.2, 0], [9.8, -9, 0]].forEach(a => bench(...a));
  const bin = (x, z) => { mesh(new THREE.CylinderGeometry(.22, .18, .66, 12), M('#22382c', .6, .3), x, .33, z); mesh(new THREE.CylinderGeometry(.23, .23, .05, 12), M(OR, .5, .3), x, .68, z); circ(x, z, .26); };
  bin(-1.95, 8.6); bin(7.4, -9); bin(-1.9, -1.9);
  // an old-style park lamp: a dark post with a warm globe (only some of them carry a real light — phones)
  const plamp = (x, z, lit) => { mesh(new THREE.CylinderGeometry(.05, .09, 2.9, 8), M('#1c1f24', .5, .6), x, 1.45, z); mesh(new THREE.CylinderGeometry(.14, .1, .12, 10), M('#1c1f24', .5, .6), x, 2.92, z);
    mesh(new THREE.SphereGeometry(.23, 14, 10), glowMat('#ffd49a', 1.25), x, 3.16, z).castShadow = false; circ(x, z, .14); if (lit) point('#ffc27a', lit, x, 3, z, 11); };
  [[-1.75, 10.6, 30], [1.75, 4, 0], [-1.75, -.8, 30], [1.75, -6.4, 0], [-10, 9.9, 0], [10.1, 11, 26], [-10, -2.6, 22], [10.1, -1.2, 0], [-6.2, 2.6, 0], [5.4, -1.2, 24]].forEach(a => plamp(...a));

  // ---------- the stage «ЭСТРАДА» (north-west): a shell and a round wooden floor ----------
  const SX = -6.6, SZ = -5.9, SR = 3.1;
  { // the floor: planks, an orange ring, the FT mark in the middle
    const c = paintCanvas(1024, 1024, (x, w, h, r) => { x.save(); x.beginPath(); x.arc(w / 2, h / 2, w / 2 - 4, 0, 7); x.clip();
      for (let i = 0; i < 16; i++) { x.fillStyle = `hsl(${28 + r() * 6},${38 + r() * 10}%,${30 + r() * 9}%)`; x.fillRect(i * 64, 0, 64, h); x.fillStyle = 'rgba(0,0,0,.4)'; x.fillRect(i * 64, 0, 2, h);
        for (let k = 0; k < 5; k++) { x.fillStyle = 'rgba(0,0,0,.28)'; x.fillRect(i * 64, r() * h, 64, 2); } }
      x.restore(); x.strokeStyle = OR; x.lineWidth = 16; x.beginPath(); x.arc(w / 2, h / 2, w / 2 - 34, 0, 7); x.stroke(); x.strokeStyle = 'rgba(242,239,232,.8)'; x.lineWidth = 5; x.setLineDash([36, 24]); x.beginPath(); x.arc(w / 2, h / 2, w / 2 - 70, 0, 7); x.stroke(); x.setLineDash([]);
      x.globalAlpha = .5; x.strokeStyle = '#f2efe8'; x.lineWidth = 10; x.beginPath(); x.arc(w / 2, h / 2, 90, 0, 7); x.stroke(); text(x, 'FT', w / 2, h / 2 + 6, '400 110px Anton, sans-serif', '#f2efe8'); x.globalAlpha = 1; }, .25, 44);
    mesh(new THREE.CylinderGeometry(SR, SR + .06, .07, 48), M('#3a2a1c', .8), SX, .035, SZ).castShadow = false;
    flat(new THREE.CircleGeometry(SR, 48), new THREE.MeshStandardMaterial({ map: tex(c), roughness: .78 }), SX, .072, SZ);
    // the shell behind it: a quarter-dome, warm inside
    const sh = new THREE.Mesh(new THREE.SphereGeometry(3.7, 28, 12, 0, PI, 0, PI / 2), new THREE.MeshStandardMaterial({ color: '#d9cdb8', emissive: '#ff9a4a', emissiveIntensity: .12, roughness: .8, side: THREE.DoubleSide }));
    sh.rotation.y = PI; sh.scale.set(1, .78, .5); sh.position.set(SX, 0, SZ - 2.1); sh.castShadow = true; scene.add(sh);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(3.7, .09, 8, 36, PI), glowMat('#ffb15c', 1.7)); rim.scale.set(1, .78, 1); rim.position.set(SX, 0, SZ - 2.1); scene.add(rim);
    for (let i = -3; i <= 3; i++) box(SX + i * 1.05, SZ - 2.1 - Math.sqrt(Math.max(0, 1 - (i / 3.55) ** 2)) * 1.85 + .5, 1.1, .5);
    // the name over the shell, leaning back so that it reads from the camera
    const nc = can(1024, 160), nx = nc.getContext('2d'); nx.shadowColor = OR; nx.shadowBlur = 18; text(nx, 'ЭСТРАДА · JAM', 512, 84, '400 120px Anton, sans-serif', '#ffb27a');
    const n = glowPlane(nc, 5.4, .84, SX, 3.5, SZ - 2.2, 0, 1.2); n.rotation.x = -.55;
    // two poles with a garland of bulbs over the floor
    [-1, 1].forEach(k => { mesh(new THREE.CylinderGeometry(.05, .06, 3.3, 8), M('#1c1f24', .5, .6), SX + k * 3.6, 1.65, SZ + 1.2); circ(SX + k * 3.6, SZ + 1.2, .14);
      for (let i = 0; i <= 8; i++) { const u = i / 8, px = SX + k * 3.6 - k * u * 3.6, pz = SZ + 1.2 - u * 3.3, py = 3.25 - Math.sin(u * PI) * .55 + u * (-.35); mesh(new THREE.SphereGeometry(.06, 8, 6), glowMat(['#ffd23f', '#ff5a4a', '#7cff4f', '#4fc0ff'][i % 4], 3), px, py, pz).castShadow = false; } });
    point('#ffb46a', 11, SX, 3.1, SZ + .6, 9); point('#ff8a4a', 4, SX, 1.6, SZ - 1.6, 6);
  }

  // ---------- the old-timer's chess tables (north-east) ----------
  const OX = 9.2, OZ = -6.2;
  { const table = (x, z) => { mesh(new THREE.CylinderGeometry(.09, .12, .7, 10), M('#4d5158', .8), x, .35, z); const tc = paintCanvas(128, 128, (c) => { for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { c.fillStyle = (i + j) % 2 ? '#e9e4d8' : '#2a2c31'; c.fillRect(i * 16, j * 16, 16, 16); } }, 0, 1);
      const top = new THREE.Mesh(new THREE.BoxGeometry(.8, .06, .8), [M('#5d626b', .7), M('#5d626b', .7), new THREE.MeshStandardMaterial({ map: tex(tc), roughness: .6 }), M('#5d626b', .7), M('#5d626b', .7), M('#5d626b', .7)]); top.position.set(x, .73, z); top.castShadow = true; scene.add(top);
      [[-.14, -.1], [.12, .14], [.2, -.2], [-.2, .2]].forEach(([dx, dz], i) => mesh(new THREE.CylinderGeometry(.03, .04, .1, 8), M(i % 2 ? '#f2efe8' : '#15161a', .5), x + dx, .81, z + dz));
      [-.75, .75].forEach(k => { mesh(new THREE.CylinderGeometry(.19, .16, .42, 12), M('#4d5158', .8), x + k, .21, z); circ(x + k, z, .2); }); circ(x, z, .42); };
    table(OX - .9, OZ - 1.1); table(OX + 1.6, OZ - .9);
    // his old boombox on a crate
    mesh(new THREE.BoxGeometry(.6, .5, .5), M('#6b4a2f', .85), OX + 1.5, .25, OZ + .6); mesh(new RoundedBoxGeometry(.66, .3, .2, 2, .04), M('#22252b', .5, .3), OX + 1.5, .65, OZ + .6);
    [-.2, .2].forEach(k => mesh(new THREE.CylinderGeometry(.09, .09, .02, 14), glowMat(OR, 1.6), OX + 1.5 + k, .65, OZ + .705).rotation.set(PI / 2, 0, 0)); box(OX + 1.5, OZ + .6, .7, .6);
    point('#ffd49a', 18, OX + .3, 2.6, OZ + .2, 7);
  }

  // ---------- play and workout corner (south-east) ----------
  const BX = 7.4, BZ = 8.00, bars = { x: BX + .12, z: BZ + .70 };
  if (rubber?.material) {
    if (rubberMap) {
      rubberMap.colorSpace = THREE.SRGBColorSpace;
      rubberMap.anisotropy = TK.maxAniso;
      rubber.material.map = rubberMap;
    } else rubber.material.color.set('#38574f');
    playground.position.set(BX, 0, BZ);
    playground.traverse(node => {
      if (node.isMesh) node.castShadow = node !== rubber;
    });
    scene.add(playground);
    // Match the equipment footprint while keeping both entrances and the footwork circle open.
    for (const [x, z, w, d] of [[-1.355, -1.72, 1.25, 1.07], [-.50, -1.90, .68, .55],
      [-1.36, -.22, .84, 2.12], [1.79, .15, .66, 1.77], [1.40, -2.25, 1.76, .46]]) {
      box(BX + x, BZ + z, w, d);
    }
    for (const [x, z, r] of [[.40, -1.38, .115], [1.41, -1.38, .115], [2.16, -1.38, .115],
      [-2.01, 1.44, .21], [-1.55, 1.85, .21], [-1.10, 2.11, .21]]) circ(BX + x, BZ + z, r);
  } else {
    const c = paintCanvas(256, 256, (x, w, h, r) => { x.fillStyle = '#25413a'; x.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${r() < .5 ? '255,255,255' : '0,0,0'},${.05 + r() * .12})`; x.fillRect(r() * w, r() * h, 2, 2); } x.strokeStyle = 'rgba(242,239,232,.6)'; x.lineWidth = 5; x.strokeRect(8, 8, w - 16, h - 16); }, .2, 9);
    flat(new THREE.PlaneGeometry(5.2, 4), new THREE.MeshStandardMaterial({ map: tex(c), roughness: .9 }), BX, .016, BZ);
    const st = M('#c9a52e', .4, .6), bar = (x, z, h, len) => { [-len / 2, len / 2].forEach(k => { mesh(new THREE.CylinderGeometry(.055, .055, h, 10), st, x + k, h / 2, z); circ(x + k, z, .12); }); const b = mesh(new THREE.CylinderGeometry(.035, .035, len, 10), M('#d8dce2', .25, .9), x, h - .06, z); b.rotation.z = PI / 2; };
    bar(BX - 1.1, BZ - 1.5, 2.5, 1.5); bar(BX + .9, BZ - 1.5, 2.1, 1.5);
    // parallel bars
    [-.28, .28].forEach(k => { [-.7, .7].forEach(e => mesh(new THREE.CylinderGeometry(.045, .045, 1.15, 8), st, BX + 1.95 + k, .575, BZ + .7 + e)); const b = mesh(new THREE.CylinderGeometry(.03, .03, 1.7, 8), M('#d8dce2', .25, .9), BX + 1.95 + k, 1.15, BZ + .7); b.rotation.x = PI / 2; }); box(BX + 1.95, BZ + .7, .7, 1.6);
    // two rolled mats
    [[-2.1, 1.2, '#E2611A'], [-2.1, 1.55, '#3BD16F']].forEach(([dx, dz, col]) => { const m = mesh(new THREE.CylinderGeometry(.12, .12, .7, 12), M(col, .8), BX + dx, .12, BZ + dz); m.rotation.z = PI / 2; });
  }

  // ---------- gates: back to the Centre (west) and on to the industrial zone (south, closed for now) ----------
  const arch = (x, z, ry, label, col) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
    [-1.4, 1.4].forEach(px => mesh(new THREE.BoxGeometry(.35, 3, .35), M('#3a3c42', .8), px, 1.5, 0, g)); mesh(new THREE.BoxGeometry(3.2, .45, .4), M('#2a2c31', .7), 0, 3.1, 0, g);
    const c = can(512, 64), cx = c.getContext('2d'); text(cx, label, 256, 34, '400 46px Anton, sans-serif', col);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(2.9, .36), new THREE.MeshBasicMaterial({ map: tex(c), transparent: true, toneMapped: false })); s.position.set(0, 3.1, .21); g.add(s);
    const chain = mesh(new THREE.BoxGeometry(2.5, .06, .06), M('#c9c4b8', .3, .9), 0, 1.1, 0, g);
    const cs = Math.abs(Math.cos(ry)), sn = Math.abs(Math.sin(ry)); [-1.4, 1.4].forEach(px => circ(x + px * Math.cos(ry), z - px * Math.sin(ry), .3)); box(x, z, 2.4 * cs + .2 * sn, 2.4 * sn + .2 * cs);
    return { g, chain }; };
  const gateCenter = arch(-13.0, 1.4, PI / 2, '←  ЦЕНТР', OR); gateCenter.chain.visible = false;
  const gateProm = arch(0, 14.75, 0, 'ПРОМЗОНА  →', '#FFB547');

  lamps.forEach((l, i) => i < 2 && dust(scene, l.head));
  // fireflies over the lawns
  { const N = 46, pos = new Float32Array(N * 3), sd = Array.from({ length: N }, (_, i) => [(Math.random() - .5) * 24, .4 + Math.random() * 1.6, -8 + Math.random() * 20, Math.random() * 6]);
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(pg, new THREE.PointsMaterial({ color: '#d8ff7a', size: .09, transparent: true, opacity: .9, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true })); pts.frustumCulled = false; scene.add(pts);
    let t = 0; W.tickers.push(dt => { t += dt; for (let i = 0; i < N; i++) { const [x, y, z, p] = sd[i]; pos[i * 3] = x + Math.sin(t * .4 + p) * 1.1; pos[i * 3 + 1] = y + Math.sin(t * .9 + p * 2) * .3; pos[i * 3 + 2] = z + Math.cos(t * .33 + p) * 1.1; } pg.attributes.position.needsUpdate = true; pts.material.opacity = .55 + Math.sin(t * 2.1) * .3; }); }

  // ---------- people ----------
  let pn = 0;
  const person = (lv, acc, fix, body) => { const look = HERO.topDown(lv, acc); if (fix) fix(look); const J = mocapPerson(look, { body: bodyOf(500 + (pn++) * 23, Object.assign({ girl: acc.includes('girl') }, body)) });
    J.play('Breakdance_Ready', { at: Math.random() }); scene.add(J.root); J.st = { wk: 0, ph: Math.random() * 6 }; return J; };
  const turn = (J, a, dt, k = 8) => { let d = a - J.root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); J.root.rotation.y += d * (1 - Math.exp(-dt * k)); };
  const go = (J, tx, tz, v, dt) => { const p = J.root.position, dx = tx - p.x, dz = tz - p.z, l = Math.hypot(dx, dz); if (l < .12) { standPose(J); J.tick(dt); stride(J, J.st, 0, false, 0, dt); return true; }
    const s = Math.min(l, v * dt); p.x += dx / l * s; p.z += dz / l * s; turn(J, Math.atan2(dx, dz), dt); standPose(J); J.tick(dt); stride(J, J.st, v, true, .55, dt); return false; };
  const plain = (top, pants, shoe, long = true) => l => { l.hat = null; l.chain = 0; l.phones = false; l.wrist = null; l.top = long ? 'bomber' : 'tee'; Object.assign(l.col, { top, sleeve: long ? top : null, cuff: null, trim: null, pants, stripe: null, shoe, shoe2: shoe, sole: '#e9e4d8', hat: null }); };

  // the three dancers of the jam wait at the back of the stage (the game takes them out one by one)
  const dancers = [[5, [], { type: 'slim', style: 'mohawk', dye: '#7CFF4F' }], [6, ['girl'], { type: 'athl', style: 'braids' }], [7, [], { type: 'stocky', style: 'bald', beard: true }]].map(([lv, acc, body], i) => { const J = person(lv, acc, null, body);
    J.home = { x: SX + (i - 1) * 1.25, z: SZ - 1.75 + Math.abs(i - 1) * .35 }; J.root.position.set(J.home.x, 0, J.home.z); J.root.rotation.y = 0; circ(J.home.x, J.home.z, .3); return J; });
  // the old-timer by his chess tables: a b-boy of the first wave — grey beard, beanie, an old tracksuit
  const og = person(8, [], l => { l.hat = 'beanie'; l.top = 'track'; l.chain = 0; l.phones = false; Object.assign(l.col, { hat: ['#7a1f1f', '#FFD23F'], top: '#1f4f7a', sleeve: '#1f4f7a', yoke: '#F2EFE8', cuff: '#F2EFE8', trim: '#F2EFE8', pants: '#1f4f7a', stripe: '#F2EFE8', shoe: '#F2EFE8', shoe2: '#7a1f1f', sole: '#F2EFE8' }); },
    { type: 'stocky', old: true, beard: true, style: 'short', hair: '#c9ccd2', skin: '#C68A5E' });
  og.root.position.set(OX + .3, 0, OZ + .4); og.home = PI * 1.05; og.root.rotation.y = og.home; circ(OX + .3, OZ + .4, .32);

  // people out for a walk go round the ring of alleys; two joggers run it the other way
  const LOOP = [[-11.2, -10.6], [11.3, -10.6], [11.3, 12.3], [-11.2, 12.3]], LEN = LOOP.map((p, i) => { const q = LOOP[(i + 1) % 4]; return Math.hypot(q[0] - p[0], q[1] - p[1]); }), TOT = LEN.reduce((a, b) => a + b, 0);
  const at = (u, side) => { u = ((u % TOT) + TOT) % TOT; for (let i = 0; i < 4; i++) { if (u <= LEN[i]) { const p = LOOP[i], q = LOOP[(i + 1) % 4], k = u / LEN[i], nx = (q[1] - p[1]) / LEN[i], nz = -(q[0] - p[0]) / LEN[i]; return { x: lerp(p[0], q[0], k) + nx * side, z: lerp(p[1], q[1], k) + nz * side }; } u -= LEN[i]; } return { x: LOOP[0][0], z: LOOP[0][1] }; };
  const walkers = [
    [2, ['girl'], plain('#b9bcc4', '#3a3d45', '#3a2c22'), { type: 'stocky', old: true, coat: true, style: 'bun' }, 1.0, .5, 0],                       // a granny in a coat
    [3, [], plain('#3b5a3a', '#2b2d33', '#101114'), { type: 'heavy', coat: false, style: 'short', beard: true, pack: '#4d5158' }, 1.15, .5, 0],     // a heavy man with a backpack
    [4, ['girl'], plain('#d9488a', '#1f2126', '#f2efe8', false), { type: 'slim', style: 'tail' }, 2.7, .95, 1],                                    // a jogger
    [6, [], plain('#E2611A', '#1b1d22', '#7cff4f', false), { type: 'athl', style: 'buzz' }, 3.0, .95, 1],                                           // another one, faster
    [1, [], plain('#ffd23f', '#3E5F8E', '#C8102E'), { type: 'small', style: 'curly', pack: '#2f7bff' }, 1.3, .55, 0],                              // a kid
  ].map(([lv, acc, fix, body, v, k, run], i) => { const J = person(lv, acc, fix, body), w = { J, u: TOT * i / 5 + i * 3, dir: run ? -1 : 1, v, k, mode: 'path', slot: null };
    const p = at(w.u, w.dir * .45); J.root.position.set(p.x, 0, p.z); J.setIdle('Stand_Calm'); return w; });
  let jam = false;
  W.tickers.push(dt => {
    walkers.forEach(w => { const J = w.J, p = J.root.position;
      if (w.mode === 'path') { w.u += w.dir * w.v * dt; const t = at(w.u, w.dir * .45), dx = t.x - p.x, dz = t.z - p.z; if (Math.hypot(dx, dz) > 1e-4) turn(J, Math.atan2(dx, dz), dt, 6); p.x = t.x; p.z = t.z; standPose(J); J.tick(dt); stride(J, J.st, w.v, true, w.k, dt); }
      else if (w.mode === 'watch') { if (go(J, w.slot.x, w.slot.z, 1.9, dt)) turn(J, Math.atan2(SX - p.x, SZ - p.z), dt); }
      else if (w.mode === 'back') { const t = at(w.u, w.dir * .45); if (go(J, t.x, t.z, 1.6, dt)) w.mode = 'path'; } });
    // the old-timer nods to the beat of his boombox and looks at the hero when he is near
    { const p = og.root.position, h = W.hero && W.hero.root.position, nearMe = h && Math.hypot(h.x - p.x, h.z - p.z) < 3.4; turn(og, nearMe ? Math.atan2(h.x - p.x, h.z - p.z) : og.home, dt, 3); og.tick(dt); }
    dancers.forEach(J => { if (!J.busy) J.tick(dt); });
  });
  // the crowd of the jam: people who are not far come to the stage's edge (called by the game)
  const crowd = on => { jam = on;
    if (on) { const near = walkers.filter(w => w.v < 2).slice(0, 3); near.forEach((w, i) => { const a = (i - 1) * .55; w.slot = { x: SX + Math.sin(a) * (SR + 1.1), z: SZ + Math.cos(a) * (SR + 1.1) }; w.mode = 'watch'; }); }
    else walkers.forEach(w => { if (w.mode === 'watch') w.mode = 'back'; }); };

  W.park = { stage: { x: SX, z: SZ, r: SR }, dancers, og: { x: OX + .3, z: OZ + 1.6, J: og }, bars, crowd,
    gateCenter: { x: -11.9, z: 1.4, chain: gateCenter.chain }, gateProm: { x: 0, z: 13.7, chain: gateProm.chain } };
}
