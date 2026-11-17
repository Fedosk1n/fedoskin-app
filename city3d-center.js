// City 3D — district «ЦЕНТР» (owner 16.11.2026 «продолжаем 3D-город, строим Центр»).
// A night city square: the mall «КРУГ» with a glossy tiled apron (the best floor in town — and a guard who walks along it),
// a fountain with a bronze b-boy, the metro pavilion, a tea kiosk, a bus stop, a street with a passing car, passers-by.
// Everything is built in code with the toolkit of city3d.js (TK). The game on top (crews, places, travel) is in city3d-game.js;
// what it needs from here is left in W.center: { show, guard, crowd(on), kiosk, metro, gateYard, gatePark }.
export async function buildCenter(TK) {
  const { THREE, RoundedBoxGeometry, scene, W, TOUCH, OR, PAINT_W, M, glowMat, tex, can, grain, blotch, rng, lerp, clamp, decal, paintCanvas, shadowAll, box, circ,
    lamp, lamps, dust, trashBag, car, asphaltTex, facadeTex, roofTex, stripeTex, mocapPerson, bodyOf, stride, standPose, HERO, GFX } = TK;
  const P = 48, PI = Math.PI;
  const mesh = (geo, mat, x, y, z, par = scene) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; par.add(m); return m; };
  const glowPlane = (c, w, h, x, y, z, ry = 0, k = 1) => { const t = tex(c), m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false, color: new THREE.Color(k, k, k) }));
    m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); return m; };
  const point = (col, power, x, y, z, dist = 9) => { const l = new THREE.PointLight(col, power * (TK.FILL_K || 1), dist, 1.6); l.position.set(x, y, z); scene.add(l); return l; };
  const text = (x, t, px, py, font, col, align = 'center') => { x.font = font; x.textAlign = align; x.textBaseline = 'middle'; x.fillStyle = col; x.fillText(t, px, py); };

  // a slightly lighter, bluer night than the yard: the centre is lit
  scene.background.set('#0b0e15'); scene.fog.color.set('#0b0e15'); scene.fog.density = .013;

  // ---------- ground: big pavers ----------
  { const S = 1024, c = can(S, S), x = c.getContext('2d'), b = can(S, S), bx = b.getContext('2d'), r = rng(5);
    bx.fillStyle = '#fff'; bx.fillRect(0, 0, S, S);
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { const l = 17 + r() * 5 + ((i + j) % 2) * 2.2; x.fillStyle = `hsl(${216 + r() * 8},${7 + r() * 4}%,${l}%)`; x.fillRect(i * 128, j * 128, 128, 128); }
    blotch(x, S, S, 60, 'rgba(0,0,0,A)', 30, 150, .2, r); blotch(x, S, S, 30, 'rgba(140,150,170,A)', 20, 110, .06, r);
    x.strokeStyle = 'rgba(0,0,0,.55)'; x.lineWidth = 3; bx.strokeStyle = '#555'; bx.lineWidth = 5;
    for (let i = 0; i <= 8; i++) { [x, bx].forEach(q => { q.beginPath(); q.moveTo(i * 128, 0); q.lineTo(i * 128, S); q.moveTo(0, i * 128); q.lineTo(S, i * 128); q.stroke(); }); }
    grain(c, 16, 3);
    const map = tex(c, { repeat: [70 / 8, 70 / 8] }), bump = tex(b, { repeat: [70 / 8, 70 / 8], color: false });
    const g = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 1.4, roughness: .82 })); g.rotation.x = -PI / 2; g.receiveShadow = true; scene.add(g); }
  // the mall's apron: glossy light tiles (lamps and signs reflect in them)
  { const S = 512, c = can(S, S), x = c.getContext('2d'), r = rng(8);
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.fillStyle = (i + j) % 2 ? `hsl(215,8%,${44 + r() * 4}%)` : `hsl(215,10%,${33 + r() * 4}%)`; x.fillRect(i * 64, j * 64, 64, 64); }
    x.strokeStyle = 'rgba(0,0,0,.45)'; x.lineWidth = 2; for (let i = 0; i <= 8; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, S); x.moveTo(0, i * 64); x.lineTo(S, i * 64); x.stroke(); } grain(c, 8, 4);
    const a = new THREE.Mesh(new THREE.PlaneGeometry(23, 6.4), new THREE.MeshStandardMaterial({ map: tex(c, { repeat: [23 / 4, 6.4 / 4] }), roughness: .42, metalness: .05 }));
    a.rotation.x = -PI / 2; a.position.set(0, .02, -12.8); a.receiveShadow = true; scene.add(a);
    const e = mesh(new THREE.BoxGeometry(23.2, .05, .16), M('#7d828a', .7), 0, .025, -9.55); e.castShadow = false; }
  // the round of the square around the fountain
  const FX = 0, FZ = -1;
  decal(scene, paintCanvas(1024, 1024, (x, w, h) => { const cx = w / 2; x.strokeStyle = 'rgba(120,126,138,.9)'; [488, 430, 372].forEach((rr, i) => { x.lineWidth = i ? 5 : 12; x.beginPath(); x.arc(cx, cx, rr, 0, 7); x.stroke(); });
    x.lineWidth = 4; for (let i = 0; i < 24; i++) { const a = i / 24 * PI * 2; x.beginPath(); x.moveTo(cx + Math.cos(a) * 372, cx + Math.sin(a) * 372); x.lineTo(cx + Math.cos(a) * 488, cx + Math.sin(a) * 488); x.stroke(); } }, .5, 12), 13.4, 13.4, FX, FZ, 0, { op: .42 });

  // ---------- the street on the east ----------
  { const asp = asphaltTex(); asp.repeat.set(2, 12);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(9, 70), new THREE.MeshStandardMaterial({ map: asp, roughness: .8 })); road.rotation.x = -PI / 2; road.position.set(18.5, .006, 0); road.receiveShadow = true; scene.add(road);
    mesh(new THREE.BoxGeometry(.25, .15, 70), M('#6a6e75', .9), 13.95, .075, 0);
    for (let z = -34; z < 34; z += 4.5) if (z < .5 || z > 5.5) decal(scene, paintCanvas(32, 256, (x, w, h) => { x.fillStyle = PAINT_W; x.fillRect(0, 0, w, h); }, .25, z * 3 | 0), .16, 2.2, 18.5, z);
    // zebra
    decal(scene, paintCanvas(1024, 384, (x, w, h) => { x.fillStyle = PAINT_W; for (let i = 0; i < 9; i++) x.fillRect(20 + i * 112, 10, 64, h - 20); }, .3, 71), 8.4, 3.2, 18.5, 3.2, 0, { op: .9 });
    // bollards with a lit ring along the curb
    for (let z = -13; z <= 14; z += 3) { if (Math.abs(z - 3.2) < 2.4) continue; const b = mesh(new THREE.CylinderGeometry(.09, .11, .8, 10), M('#2a2e35', .5, .5), 13.72, .4, z); mesh(new THREE.CylinderGeometry(.095, .095, .06, 10), glowMat('#ffb15c', 1.6), 0, .3, 0, b).castShadow = false; }
    // parked cars and one that drives by
    const c1 = car('#2c3440'); c1.position.set(15.6, 0, -9.5); scene.add(c1); const c2 = car('#6a6f78'); c2.position.set(15.6, 0, 10.6); scene.add(c2);
    const run = car('#8a1f1f'); run.rotation.y = 0; scene.add(run);
    [-.6, .6].forEach(x => { const l = new THREE.Mesh(new THREE.BoxGeometry(.34, .12, .05), glowMat('#fff4d6', 3)); l.position.set(x, .7, 2.07); run.add(l); });
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 5), new THREE.MeshBasicMaterial({ map: tex(paintCanvas(64, 128, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,240,200,.5)'); g.addColorStop(1, 'rgba(255,240,200,0)'); x.fillStyle = g; x.beginPath(); x.moveTo(w * .3, 0); x.lineTo(w * .7, 0); x.lineTo(w, h); x.lineTo(0, h); x.fill(); }, 0, 1)), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    beam.rotation.x = -PI / 2; beam.rotation.z = PI; beam.position.set(0, .03, 4.6); run.add(beam);
    let ct = 3; W.tickers.push(dt => { ct += dt; const u = (ct % 17) / 17; run.position.set(20.6, 0, -40 + u * 150); run.visible = u < .55; });
  }
  // houses across the street (only their lit fronts are seen)
  { const f = facadeTex(40, 9, { col: '#2c3037', brick: false, floors: 3, lit: .5, seed: 33 }), side = M('#22252b', .9);
    const m = new THREE.Mesh(new THREE.BoxGeometry(8, 9, 40), [side, new THREE.MeshStandardMaterial({ map: f.map, emissiveMap: f.emi, emissive: '#ffffff', emissiveIntensity: 1.5, roughness: .9 }), side, side, side, side]); m.position.set(27.2, 4.5, -2); scene.add(m); }

  // ---------- the mall «КРУГ» on the north ----------
  const MW = 26, MH = 8.6, MD = 9, MZ = -16;
  { const Wp = Math.round(MW * P), Hp = Math.round(MH * P), c = can(Wp, Hp), x = c.getContext('2d'), e = can(Wp, Hp), ex = e.getContext('2d'), r = rng(41);
    x.fillStyle = '#262b33'; x.fillRect(0, 0, Wp, Hp); grain(c, 10, 2); ex.fillStyle = '#000'; ex.fillRect(0, 0, Wp, Hp);
    // glass storeys
    const gy0 = P * .5, gh = Hp * .62 - gy0, cols = 20, rows = 3, pw = Wp / cols, ph = gh / rows;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { const X = i * pw + 3, Y = gy0 + j * ph + 3, w2 = pw - 6, h2 = ph - 6;
      const g = x.createLinearGradient(X, Y, X + w2, Y + h2); g.addColorStop(0, '#1b2a3a'); g.addColorStop(.5, '#0e1620'); g.addColorStop(1, '#16222f'); x.fillStyle = g; x.fillRect(X, Y, w2, h2);
      x.fillStyle = 'rgba(170,200,235,.07)'; x.beginPath(); x.moveTo(X + w2 * .15, Y); x.lineTo(X + w2 * .5, Y); x.lineTo(X + w2 * .2, Y + h2); x.lineTo(X, Y + h2); x.lineTo(X, Y + h2 * .5); x.fill();
      if (r() < .3) { const k = .18 + r() * .4, warm = r() < .35; ex.fillStyle = warm ? `rgba(255,190,120,${k})` : `rgba(150,200,255,${k})`; ex.fillRect(X, Y, w2, h2); x.fillStyle = warm ? 'rgba(255,190,120,.25)' : 'rgba(150,200,255,.2)'; x.fillRect(X, Y, w2, h2); } }
    x.fillStyle = '#3a404a'; x.fillRect(0, 0, Wp, P * .4); x.fillRect(0, Hp * .62, Wp, P * .34);
    ex.fillStyle = 'rgba(226,97,26,.9)'; ex.fillRect(0, Hp * .62 + P * .12, Wp, P * .07);   // a thin orange light line under the glass
    // ground floor: shop windows with dummies, the entrance in the middle
    const sy = Hp * .62 + P * .5, sh = Hp - sy - P * .28, names = ['КЕДЫ', 'ВИНИЛ', 'ШАПКИ', 'СКЕЙТ', 'ЛУК', 'БУМ'], cc = ['#ff5a4a', '#4fc0ff', '#ffd23f', '#7cff4f', '#ff4f9a', '#b03bff'];
    const bays = [[-12.2, 3.4], [-8.4, 3.4], [-4.6, 1.9], [2.7, 1.9], [5, 3.4], [8.8, 3.4]];
    bays.forEach(([mx, mw], i) => { const X = (mx + MW / 2) * P, w2 = mw * P, col = cc[i];
      x.fillStyle = '#0a0c10'; x.fillRect(X - 5, sy - 5, w2 + 10, sh + 10);
      const g = ex.createLinearGradient(0, sy, 0, sy + sh); g.addColorStop(0, 'rgba(255,236,205,.95)'); g.addColorStop(1, 'rgba(255,214,160,.7)'); ex.fillStyle = g; ex.fillRect(X, sy, w2, sh);
      x.fillStyle = '#e9d9bd'; x.fillRect(X, sy, w2, sh);
      const n = Math.max(1, Math.round(mw / 1.15)); for (let k = 0; k < n; k++) { const dx = X + w2 * (k + .5) / n, top = sy + sh * .2; [x, ex].forEach(q => { q.fillStyle = q === x ? '#15171c' : 'rgba(0,0,0,.92)'; q.beginPath(); q.arc(dx, top, sh * .075, 0, 7); q.fill();
          q.beginPath(); q.moveTo(dx - sh * .15, top + sh * .12); q.lineTo(dx + sh * .15, top + sh * .12); q.lineTo(dx + sh * .1, top + sh * .5); q.lineTo(dx + sh * .12, sy + sh); q.lineTo(dx - sh * .12, sy + sh); q.lineTo(dx - sh * .1, top + sh * .5); q.closePath(); q.fill(); }); }
      [x, ex].forEach(q => { q.fillStyle = q === x ? '#111' : 'rgba(0,0,0,.9)'; q.fillRect(X + w2 / 2 - 2, sy, 4, sh); });
      // the shop's little sign
      const ny = sy - P * .36; x.fillStyle = '#101216'; x.fillRect(X, ny - P * .17, w2, P * .34); text(x, names[i], X + w2 / 2, ny + 1, `400 ${P * .3 | 0}px Anton, sans-serif`, col); text(ex, names[i], X + w2 / 2, ny + 1, `400 ${P * .3 | 0}px Anton, sans-serif`, col); });
    // the entrance: bright glass doors
    { const X = (-2.2 + MW / 2) * P, w2 = 4.4 * P, y = Hp - 3 * P, h2 = 3 * P - P * .1; x.fillStyle = '#0a0c10'; x.fillRect(X - 6, y - 6, w2 + 12, h2 + 6);
      const g = ex.createLinearGradient(0, y, 0, y + h2); g.addColorStop(0, 'rgba(255,246,228,1)'); g.addColorStop(1, 'rgba(255,224,180,.85)'); ex.fillStyle = g; ex.fillRect(X, y, w2, h2); x.fillStyle = '#f4ead6'; x.fillRect(X, y, w2, h2);
      [x, ex].forEach(q => { q.fillStyle = q === x ? '#15171c' : 'rgba(0,0,0,.95)'; for (let i = 0; i <= 4; i++) q.fillRect(X + w2 * i / 4 - 3, y, 6, h2); q.fillRect(X, y + h2 * .22, w2, 5); }); }
    blotch(x, Wp, Hp, 16, 'rgba(0,0,0,A)', 30, 120, .2, r);
    const side = M('#22262d', .9), roof = roofTex(MW, MD, 51);
    const m = new THREE.Mesh(new THREE.BoxGeometry(MW, MH, MD), [side, side, new THREE.MeshStandardMaterial({ map: roof, roughness: .95 }), side, new THREE.MeshStandardMaterial({ map: tex(c), emissiveMap: tex(e), emissive: '#ffffff', emissiveIntensity: 1.0, roughness: .55, metalness: .2 }), side]);
    m.position.set(0, MH / 2, MZ - MD / 2); m.castShadow = m.receiveShadow = true; scene.add(m); box(0, MZ - MD / 2, MW, MD);
    // roof clutter
    for (let i = 0; i < 5; i++) { const ac = mesh(new RoundedBoxGeometry(1.2 + r() * .8, .6, .9, 2, .04), M('#6b7078', .55, .4), -11 + r() * 22, MH + .3, MZ - 3 - r() * 4); ac.rotation.y = r() < .5 ? 0 : PI / 2; }
    // the canopy over the entrance with a light strip under it
    mesh(new RoundedBoxGeometry(6, .22, 2.1, 2, .05), M('#1a1d23', .5, .4), 0, 3.25, MZ + 1.05);
    mesh(new THREE.BoxGeometry(5.6, .03, 1.7), glowMat('#fff0d4', 1.5), 0, 3.13, MZ + 1.05).castShadow = false;
    // the name on the canopy's edge, leaning back so that it reads from above
    { const nc = can(1024, 128), nx = nc.getContext('2d'); nx.fillStyle = '#14161b'; nx.fillRect(0, 0, 1024, 128); nx.shadowColor = OR; nx.shadowBlur = 16; nx.strokeStyle = '#ffb27a'; nx.lineWidth = 9; nx.beginPath(); nx.arc(250, 64, 38, 0, 7); nx.stroke(); text(nx, 'ТЦ  КРУГ', 560, 68, '400 96px Anton, sans-serif', '#ffb27a');
      const n = glowPlane(nc, 5.8, .72, 0, 3.62, MZ + 2.0, 0, 1.15); n.rotation.x = -.62; }
    [-2.8, 2.8].forEach(px => { mesh(new THREE.CylinderGeometry(.07, .07, 3.2, 10), M('#8a8f96', .3, .8), px, 1.6, MZ + 1.95); circ(px, MZ + 1.95, .12); });
    // the big sign on the roof edge: a ring (the cypher) and the name
    const sc = can(1400, 300), sx = sc.getContext('2d');
    sx.shadowColor = OR; sx.shadowBlur = 26; sx.strokeStyle = '#ffb27a'; sx.lineWidth = 20; sx.beginPath(); sx.arc(150, 150, 96, 0, 7); sx.stroke(); sx.lineWidth = 9; sx.setLineDash([24, 16]); sx.beginPath(); sx.arc(150, 150, 60, 0, 7); sx.stroke(); sx.setLineDash([]);
    text(sx, 'КРУГ', 300, 150, '400 250px Anton, sans-serif', '#ffb27a', 'left'); sx.shadowBlur = 8; text(sx, 'ТОРГОВЫЙ ЦЕНТР', 900, 240, '700 54px Inter, sans-serif', '#fff3e4', 'left'); text(sx, 'открыто для своих', 902, 170, '500 44px Inter, sans-serif', '#9fd2ff', 'left');
    mesh(new THREE.BoxGeometry(9.8, .1, .12), M('#15171b', .6, .5), 0, MH + .12, MZ - .3); [-4.4, 0, 4.4].forEach(px => mesh(new THREE.BoxGeometry(.08, 2, .08), M('#15171b', .6, .5), px, MH + 1, MZ - .42));
    glowPlane(sc, 9.4, 2.02, 0, MH + 1.15, MZ - .3, 0, 1.25);
    // the screen on the right wing: three adverts in turn
    const ad = can(1536, 256), ax = ad.getContext('2d'), frames = [['#12203a', '#4fc0ff', 'BREAK BATTLE', 'каждую субботу · 19:00'], ['#2a0e06', '#ff8a3a', 'FEDOSKIN TEAM', 'онлайн-ведение · уроки'], ['#1a0a24', '#ff4f9a', 'КРУГ', 'всё для улицы · 2 этаж']];
    frames.forEach(([bg, col, a, b], i) => { const X = i * 512; ax.fillStyle = bg; ax.fillRect(X, 0, 512, 256); ax.fillStyle = col; ax.globalAlpha = .18; for (let k = 0; k < 9; k++) ax.fillRect(X + k * 64 - 20, 0, 26, 256); ax.globalAlpha = 1;
      text(ax, a, X + 256, 104, '400 92px Anton, sans-serif', col); text(ax, b, X + 256, 196, '700 30px Inter, sans-serif', '#f2efe8'); });
    mesh(new THREE.BoxGeometry(5.5, 2.9, .2), M('#101216', .5, .4), 8.6, 5.6, MZ + .08);
    const scr = glowPlane(ad, 5.2, 2.6, 8.6, 5.6, MZ + .2, 0, 1.1); scr.material.map.repeat.set(1 / 3, 1); scr.material.map.wrapS = THREE.RepeatWrapping;
    let st = 0; W.tickers.push(dt => { st += dt; scr.material.map.offset.x = Math.floor(st / 4.5) % 3 / 3; });
    // planters by the entrance
    [-3.9, 3.9].forEach(px => { mesh(new RoundedBoxGeometry(1, .6, 1, 2, .06), M('#3a3e46', .8), px, .3, MZ + 1.1); const b = mesh(new THREE.IcosahedronGeometry(.55, 1), M('#1f4a30', .95, 0, { flatShading: true }), px, .95, MZ + 1.1); b.scale.y = .8; box(px, MZ + 1.1, 1, 1); });
  }

  // ---------- houses on the west ----------
  { const side = M('#20242a', .9);
    const f1 = facadeTex(13, 15, { col: '#2f3640', brick: false, floors: 5, lit: .55, seed: 21 }), f2 = facadeTex(15, 7, { col: '#3a322c', brick: true, floors: 2, lit: .5, seed: 22 });
    const fm = f => new THREE.MeshStandardMaterial({ map: f.map, emissiveMap: f.emi, emissive: '#ffffff', emissiveIntensity: 1.5, roughness: .9 });
    const a = new THREE.Mesh(new THREE.BoxGeometry(9, 15, 13), [fm(f1), side, new THREE.MeshStandardMaterial({ map: roofTex(9, 13, 61), roughness: .95 }), side, side, side]); a.position.set(-18.3, 7.5, -8.6); a.castShadow = a.receiveShadow = true; scene.add(a);
    const b = new THREE.Mesh(new THREE.BoxGeometry(9, 7, 15), [fm(f2), side, new THREE.MeshStandardMaterial({ map: roofTex(9, 15, 62), roughness: .95 }), side, side, side]); b.position.set(-18.3, 3.5, 7.4); b.castShadow = b.receiveShadow = true; scene.add(b);
    box(-18.3, -8.6, 9, 13); box(-18.3, 7.4, 9, 15);
    // an awning and a lit door on the brick house, bags in the alley between the houses
    mesh(new THREE.BoxGeometry(.08, 2.2, 1.2), M('#1d2228', .6, .3), -13.76, 1.1, 5.2); mesh(new THREE.BoxGeometry(.15, .12, .5), glowMat('#ffd29a', 2.5), -13.7, 2.5, 5.2).castShadow = false;
    [[-13.6, -1.6, 1], [-13.4, -.8, .8]].forEach(([x, z, s]) => { const t = trashBag(s); t.position.set(x, t.position.y, z); scene.add(t); });
  }

  // ---------- low wall with a hedge on the south ----------
  [[-7.7, 11.6], [7.7, 11.6]].forEach(([x, len]) => { mesh(new THREE.BoxGeometry(len, .7, .5), M('#4a4e56', .9), x, .35, 14.95); const h = mesh(new RoundedBoxGeometry(len - .2, .5, .6, 2, .12), M('#1c3d29', .95), x, .93, 14.95); h.castShadow = false; });

  // ---------- the fountain with a bronze b-boy ----------
  { const stone = M('#6a6e76', .75), g = new THREE.Group(); g.position.set(FX, 0, FZ); scene.add(g);
    mesh(new THREE.CylinderGeometry(3.05, 3.15, .55, 48, 1, true), stone, 0, .275, 0, g);
    const rim = mesh(new THREE.RingGeometry(2.72, 3.05, 48), M('#868b94', .6), 0, .55, 0, g); rim.rotation.x = -PI / 2;
    const wc = can(512, 512), wx = wc.getContext('2d'), r = rng(9); wx.fillStyle = '#0a2c44'; wx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 46; i++) { wx.strokeStyle = `rgba(150,230,255,${.08 + r() * .2})`; wx.lineWidth = 1 + r() * 3; wx.beginPath(); wx.arc(256, 256, 20 + r() * 230, r() * 7, r() * 7); wx.stroke(); }
    const wt = tex(wc); wt.center.set(.5, .5);
    const water = mesh(new THREE.CircleGeometry(2.74, 48), new THREE.MeshStandardMaterial({ color: '#0c3048', emissive: '#49c8f0', emissiveMap: wt, emissiveIntensity: .9, roughness: .06, metalness: .4 }), 0, .4, 0, g); water.rotation.x = -PI / 2; water.castShadow = false;
    mesh(new THREE.CylinderGeometry(.8, .95, 1.25, 24), stone, 0, .62, 0, g); mesh(new THREE.CylinderGeometry(.9, .9, .1, 24), M('#868b94', .6), 0, 1.3, 0, g);
    circ(FX, FZ, 3.15);
    // the statue: a real freeze from motion capture, cast in bronze
    const J = mocapPerson(HERO.topDown(6, []), { scale: 1.35 }), bronze = new THREE.MeshStandardMaterial({ color: '#c08a3e', roughness: .45, metalness: .45, emissive: '#5a3410', emissiveIntensity: .6 });
    J.root.traverse(o => { if (o.isMesh) o.material = bronze; }); J.root.position.set(FX, 1.35, FZ); J.root.rotation.y = .35; scene.add(J.root);
    J.play('Breakdance_Freeze_Var_2', { at: 2.0, travel: false, fade: .01 }); if (J.act) J.act.timeScale = 0; J.tick(.5); J.tick(.5); W.statue = J;
    // water jets: drops fly along arcs from the rim to the middle
    const N = 150, pos = new Float32Array(N * 3), seed = Array.from({ length: N }, (_, i) => [i % 6, Math.random(), .8 + Math.random() * .4]);
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(pg, new THREE.PointsMaterial({ color: '#bfeeff', size: .07, transparent: true, opacity: .85, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true })); pts.frustumCulled = false; scene.add(pts);
    let ft = 0; W.tickers.push(dt => { ft += dt; wt.rotation = ft * .12; for (let i = 0; i < N; i++) { const [jet, ph, k] = seed[i], t = (ft * .75 * k + ph) % 1, a = jet / 6 * PI * 2 + .3, rr = 2.45 - t * 1.35;
        pos[i * 3] = FX + Math.cos(a) * rr + (ph - .5) * .08; pos[i * 3 + 1] = .45 + 4 * t * (1 - t) * 1.5 * k; pos[i * 3 + 2] = FZ + Math.sin(a) * rr + (k - 1) * .1; } pg.attributes.position.needsUpdate = true; });
    point('#59d4ff', 22, FX, 1.1, FZ + 1.6, 8);
  }

  // ---------- benches, bins, trees ----------
  const bench = (x, z, ry) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g); const wood = M('#6b4a2f', .8), iron = M('#1c1f24', .5, .6);
    mesh(new THREE.BoxGeometry(1.7, .07, .45), wood, 0, .45, 0, g); mesh(new THREE.BoxGeometry(1.7, .4, .06), wood, 0, .78, -.22, g); [-.7, .7].forEach(px => mesh(new THREE.BoxGeometry(.07, .45, .42), iron, px, .22, 0, g));
    const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry)); box(x, z, 1.7 * c + .5 * s, 1.7 * s + .5 * c); };
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => bench(FX + a * 3.55, FZ + b * 3.55, Math.atan2(-a, -b)));
  [-9.4, -5, 5, 9.4].forEach(x => bench(x, 13.9, PI));
  const bin = (x, z) => { mesh(new THREE.CylinderGeometry(.24, .2, .7, 12), M('#2c3038', .5, .5), x, .35, z); mesh(new THREE.CylinderGeometry(.25, .25, .05, 12), M(OR, .5, .3), x, .72, z); circ(x, z, .28); };
  bin(-7.2, 13.9); bin(7.2, 13.9); bin(4.9, -9.2); bin(-12.2, -.4);
  const tree = (x, z, s = 1) => { const r = rng((x * 31 + z * 17) | 0), g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    mesh(new THREE.CylinderGeometry(.09 * s, .14 * s, 2.3 * s, 8), M('#3a2c22', .9), 0, 1.15 * s, 0, g);
    [[0, 2.9, 0, 1.05], [.5, 2.5, .3, .7], [-.45, 2.6, -.25, .75], [.1, 3.5, -.1, .7]].forEach(([dx, y, dz, rr]) => { const c = mesh(new THREE.IcosahedronGeometry(rr * s, 1), M(r() < .5 ? '#1d4530' : '#235238', .95, 0, { flatShading: true }), dx * s, y * s, dz * s, g); c.rotation.set(r() * 3, r() * 3, 0); });
    const gr = mesh(new THREE.RingGeometry(.2, .75, 20), M('#1a1c20', .6, .5), 0, .012, 0, g); gr.rotation.x = -PI / 2; gr.castShadow = false; circ(x, z, .3); };
  tree(12.7, -10.2); tree(12.7, -4.4, 1.1); tree(12.7, 11.4); tree(-12.4, 12.6, .9);

  // ---------- the metro pavilion (north-west), open to the south ----------
  const MX = -10.6, MZ2 = -5.2;
  { const g = new THREE.Group(); g.position.set(MX, 0, MZ2); scene.add(g); const wallM = M('#27323c', .35, .3), steel = M('#8a9098', .3, .8);
    mesh(new THREE.BoxGeometry(4.2, 2.7, .2), wallM, 0, 1.35, -1.8, g); [-2, 2].forEach(px => mesh(new THREE.BoxGeometry(.2, 2.7, 3.6), wallM, px, 1.35, 0, g));
    mesh(new RoundedBoxGeometry(4.8, .28, 4.4, 2, .06), M('#1a1d23', .5, .4), 0, 2.86, .1, g);
    // the lit stairwell inside: steps going down and a bright back wall
    const stc = can(256, 256), sx = stc.getContext('2d'); for (let i = 0; i < 12; i++) { sx.fillStyle = `hsl(205,25%,${62 - i * 4.4}%)`; sx.fillRect(0, 256 - (i + 1) * 21.4, 256, 21.4); sx.fillStyle = 'rgba(255,220,90,.9)'; sx.fillRect(0, 256 - (i + 1) * 21.4, 256, 3); }
    const steps = mesh(new THREE.PlaneGeometry(3.7, 3.3), new THREE.MeshBasicMaterial({ map: tex(stc), toneMapped: false }), 0, .03, -.1, g); steps.rotation.x = -PI / 2; steps.castShadow = false;
    const bw = can(256, 128), bx2 = bw.getContext('2d'); const gg = bx2.createLinearGradient(0, 0, 0, 128); gg.addColorStop(0, '#e9f6ff'); gg.addColorStop(1, '#7fb5d8'); bx2.fillStyle = gg; bx2.fillRect(0, 0, 256, 128); bx2.fillStyle = 'rgba(20,40,70,.5)'; for (let i = 0; i < 8; i++) bx2.fillRect(i * 32, 0, 2, 128); for (let i = 0; i < 4; i++) bx2.fillRect(0, i * 32, 256, 2);
    const back = mesh(new THREE.PlaneGeometry(3.8, 2.5), new THREE.MeshBasicMaterial({ map: tex(bw), toneMapped: false }), 0, 1.3, -1.69, g); back.castShadow = false;
    [-1.85, 1.85].forEach(px => { const h = mesh(new THREE.CylinderGeometry(.035, .035, 3.2, 8), steel, px * .92, .95, 0, g); h.rotation.x = PI / 2; });
    // the sign on the roof edge
    const sc = can(1024, 200), cx = sc.getContext('2d'); cx.fillStyle = '#123a8f'; cx.beginPath(); cx.roundRect(0, 0, 1024, 200, 26); cx.fill(); cx.strokeStyle = '#cfe6ff'; cx.lineWidth = 8; cx.beginPath(); cx.roundRect(10, 10, 1004, 180, 20); cx.stroke();
    // pictogram: steps going down with an arrow
    cx.strokeStyle = '#fff'; cx.lineWidth = 14; cx.lineJoin = 'miter'; cx.beginPath(); cx.moveTo(70, 60); cx.lineTo(110, 60); cx.lineTo(110, 95); cx.lineTo(150, 95); cx.lineTo(150, 130); cx.lineTo(190, 130); cx.lineTo(190, 160); cx.stroke();
    text(cx, 'МЕТРО', 590, 106, '400 150px Anton, sans-serif', '#ffffff');
    { const n = glowPlane(sc, 4.4, .86, MX, 3.42, MZ2 + 2.3, 0, 1.15); n.rotation.x = -.5; const b = mesh(new THREE.BoxGeometry(4.6, 1, .1), M('#0d1524', .5, .4), MX, 3.4, MZ2 + 2.25); b.rotation.x = -.5; }
    box(MX, MZ2 - 1.8, 4.2, .3); box(MX - 2, MZ2, .3, 3.6); box(MX + 2, MZ2, .3, 3.6); box(MX, MZ2 - .4, 3.6, 2.6);
    point('#bfe4ff', 26, MX, 2.2, MZ2 + 1.2, 8);
  }

  // ---------- the tea kiosk (south-east) ----------
  const KX = 7.4, KZ = 9.4;
  { const g = new THREE.Group(); g.position.set(KX, 0, KZ); scene.add(g);
    mesh(new RoundedBoxGeometry(2.6, 2.2, 2.1, 2, .06), M('#20382c', .7, .1), 0, 1.1, 0, g); mesh(new THREE.BoxGeometry(2.8, .12, 2.3), M('#15171b', .6, .4), 0, 2.26, 0, g);
    const wc = can(256, 128), x = wc.getContext('2d'); const gr = x.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#fff1d0'); gr.addColorStop(1, '#ffc880'); x.fillStyle = gr; x.fillRect(0, 0, 256, 128);
    x.fillStyle = '#2a1a10'; [[40, 70, 26], [92, 76, 20], [150, 66, 30], [205, 74, 22]].forEach(([px, py, s]) => { x.fillRect(px - s / 2, py, s, 128 - py); x.beginPath(); x.arc(px, py, s / 2, PI, 0); x.fill(); });
    const win = mesh(new THREE.PlaneGeometry(1.9, .85), new THREE.MeshBasicMaterial({ map: tex(wc), toneMapped: false }), 0, 1.35, 1.06, g); win.castShadow = false;
    mesh(new THREE.BoxGeometry(2.1, .06, .35), M('#c9c4b8', .4, .5), 0, .9, 1.2, g);
    const aw = mesh(new THREE.BoxGeometry(2.7, .05, 1), new THREE.MeshStandardMaterial({ map: stripeTex(256, 64, OR, '#d8d1c3'), roughness: .8 }), 0, 2.05, 1.45, g); aw.rotation.x = .32;
    const sc = can(512, 120), sx = sc.getContext('2d'); sx.shadowColor = '#ffd23f'; sx.shadowBlur = 14; text(sx, 'ЧАЙ · КОФЕ', 256, 64, '400 86px Anton, sans-serif', '#ffe08a');
    { const n = glowPlane(sc, 2.5, .6, KX, 2.56, KZ + .95, 0, 1.2); n.rotation.x = -.7; const b = mesh(new THREE.BoxGeometry(2.7, .68, .06), M('#15171b', .6, .4), KX, 2.54, KZ + .92); b.rotation.x = -.7; }
    // the warm light of the counter sits UNDER the awning (17.11.2026: at the awning's very edge it burnt a white blot into its stripes)
    box(KX, KZ, 2.7, 2.2); point('#ffc27a', 12, KX, 1.55, KZ + 1.45, 7);
    // a standing table
    mesh(new THREE.CylinderGeometry(.4, .4, .05, 16), M('#c9c4b8', .4, .5), KX - 2.1, 1.05, KZ + .9); mesh(new THREE.CylinderGeometry(.05, .05, 1.05, 8), M('#2c3038', .5, .6), KX - 2.1, .52, KZ + .9); circ(KX - 2.1, KZ + .9, .3);
  }

  // ---------- the bus stop on the east ----------
  { const X = 13.0, Z = 6.9, steel = M('#30353d', .4, .7);
    mesh(new RoundedBoxGeometry(1.5, .1, 3.6, 2, .04), steel, X - .2, 2.5, Z); [-1.7, 1.7].forEach(dz => mesh(new THREE.BoxGeometry(.08, 2.5, .08), steel, X + .45, 1.25, Z + dz));
    const gl = mesh(new THREE.BoxGeometry(.05, 1.7, 3.3), new THREE.MeshStandardMaterial({ color: '#8fb3cc', roughness: .1, metalness: .3, transparent: true, opacity: .28 }), X + .45, 1.35, Z); gl.castShadow = false;
    mesh(new THREE.BoxGeometry(.4, .06, 2.2), M('#6b4a2f', .8), X + .15, .5, Z); [-.9, .9].forEach(dz => mesh(new THREE.BoxGeometry(.3, .5, .06), steel, X + .15, .25, Z + dz));
    // the lit advert on the end wall (faces south — towards the camera)
    const ad = can(256, 384), x = ad.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 384); g.addColorStop(0, '#2a0e06'); g.addColorStop(1, '#0d0f14'); x.fillStyle = g; x.fillRect(0, 0, 256, 384);
    x.strokeStyle = OR; x.lineWidth = 12; x.beginPath(); x.arc(128, 120, 62, 0, 7); x.stroke(); text(x, 'FT', 128, 124, '400 70px Anton, sans-serif', '#f2efe8');
    text(x, 'FEDOSKIN', 128, 236, '400 54px Anton, sans-serif', OR); text(x, 'TEAM', 128, 290, '400 54px Anton, sans-serif', '#f2efe8'); text(x, 'онлайн-ведение', 128, 346, '700 24px Inter, sans-serif', '#c9c5bc');
    mesh(new THREE.BoxGeometry(1.3, 1.9, .1), steel, X - .2, 1.3, Z + 1.75); glowPlane(ad, 1.15, 1.72, X - .2, 1.3, Z + 1.81, 0, 1);
    box(X + .2, Z, 1, 3.7);
  }

  // ---------- gates: back to the yard (south) and on to the park (north-east, closed for now) ----------
  const arch = (x, z, ry, label, col) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
    [-1.4, 1.4].forEach(px => mesh(new THREE.BoxGeometry(.35, 3, .35), M('#3a3c42', .8), px, 1.5, 0, g)); mesh(new THREE.BoxGeometry(3.2, .45, .4), M('#2a2c31', .7), 0, 3.1, 0, g);
    const c = can(512, 64), cx = c.getContext('2d'); text(cx, label, 256, 34, '400 46px Anton, sans-serif', col);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(2.9, .36), new THREE.MeshBasicMaterial({ map: tex(c), transparent: true, toneMapped: false })); s.position.set(0, 3.1, .21); g.add(s);
    const chain = mesh(new THREE.BoxGeometry(2.5, .06, .06), M('#c9c4b8', .3, .9), 0, 1.1, 0, g);
    const cs = Math.abs(Math.cos(ry)), sn = Math.abs(Math.sin(ry)); [-1.4, 1.4].forEach(px => circ(x + px * Math.cos(ry), z - px * Math.sin(ry), .3)); box(x, z, 2.4 * cs + .2 * sn, 2.4 * sn + .2 * cs);
    return { g, chain }; };
  const gateYard = arch(0, 14.75, 0, '←  ДВОР', OR); gateYard.chain.visible = false;
  const gatePark = arch(13.05, -12.4, -PI / 2, 'ПАРК  →', '#7CFF4F');
  decal(scene, paintCanvas(512, 512, (x, w, h) => { x.fillStyle = PAINT_W; x.beginPath(); x.moveTo(w / 2, h - 30); x.lineTo(w - 90, h - 190); x.lineTo(w / 2 + 60, h - 190); x.lineTo(w / 2 + 60, 40); x.lineTo(w / 2 - 60, 40); x.lineTo(w / 2 - 60, h - 190); x.lineTo(90, h - 190); x.closePath(); x.fill(); }, .5, 77), 1.2, 1.2, 0, 13.2, 0, { op: .7 });

  // ---------- the show spot on the mall's tiles ----------
  const SHOW = { x: 0, z: -11.5 };
  { const c = paintCanvas(512, 512, (x, w) => { x.strokeStyle = OR; x.lineWidth = 16; x.setLineDash([44, 26]); x.beginPath(); x.arc(256, 256, 228, 0, 7); x.stroke(); x.setLineDash([]); x.lineWidth = 6; x.beginPath(); x.arc(256, 256, 180, 0, 7); x.stroke(); text(x, 'ШОУ', 256, 262, '400 120px Anton, sans-serif', OR); }, .25, 81);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), new THREE.MeshBasicMaterial({ map: tex(c), transparent: true, depthWrite: false, opacity: .8 })); m.rotation.x = -PI / 2; m.position.set(SHOW.x, .03, SHOW.z); m.renderOrder = 2; scene.add(m); }

  // ---------- lights ----------
  const COOL = '#d6e6ff';
  lamp(scene, -6.2, -8.9, PI, { double: true, shadow: true, power: 110, angle: .95, col: COOL });
  lamp(scene, 6.2, -8.9, PI, { shadow: true, power: 110, angle: .95, col: COOL });
  lamp(scene, 4.3, 2.7, -2.3, { shadow: true, power: 95, angle: 1.0, col: COOL });
  lamp(scene, -4.4, 4.6, 2.3, { power: 90, angle: 1.0, col: COOL });
  lamp(scene, -11.6, 9.2, 1.2, { power: 85, angle: 1.0, col: COOL });
  lamp(scene, 3.2, 13.6, PI, { power: 85, angle: 1.0, col: COOL });
  lamp(scene, 13.9, -7.2, -PI / 2, { power: 70 });
  lamp(scene, 13.9, 12.6, -PI / 2, { power: 65, flicker: true });
  point('#fff0d8', 26, 0, 3.6, -13.2, 12);        // the mall's entrance
  [[-8, 10.2, '#ff8a7a', 13], [-8.2, 3.2, '#8fb8ff', 14], [7.6, 3.6, '#e6f0ff', 13]].forEach(([x, z, c, p]) => point(c, p, x, 3.4, z));   // over the crews
  lamps.forEach((l, i) => i < 2 && dust(scene, l.head));

  // ---------- people: the guard, passers-by, two by the entrance ----------
  let pn = 0; const person = (lv, acc, fix, body) => { const look = HERO.topDown(lv, acc); if (fix) fix(look); const J = mocapPerson(look, { body: bodyOf(200 + (pn++) * 17, Object.assign({ girl: acc.includes('girl') }, body)) }); J.play('Breakdance_Ready', { at: Math.random() }); scene.add(J.root); J.st = { wk: 0, ph: Math.random() * 6 }; return J; };
  const turn = (J, a, dt, k = 8) => { let d = a - J.root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); J.root.rotation.y += d * (1 - Math.exp(-dt * k)); };
  const tag = (txt, col) => { const lc = can(512, 128), lx = lc.getContext('2d'); lx.font = '400 60px Anton, sans-serif'; const tw = lx.measureText(txt).width + 70; lx.fillStyle = 'rgba(10,11,15,.72)'; lx.beginPath(); lx.roundRect(256 - tw / 2, 18, tw, 92, 46); lx.fill(); text(lx, txt, 256, 66, '400 60px Anton, sans-serif', col);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(lc), depthTest: false, toneMapped: false })); sp.scale.set(2.4, .6, 1); sp.renderOrder = 10; scene.add(sp); return sp; };
  // walk a person: straight to (tx, tz) at speed v; returns true when there
  const go = (J, tx, tz, v, dt) => { const p = J.root.position, dx = tx - p.x, dz = tz - p.z, l = Math.hypot(dx, dz); if (l < .12) { standPose(J); J.tick(dt); stride(J, J.st, 0, false, 0, dt); return true; }
    const s = Math.min(l, v * dt); p.x += dx / l * s; p.z += dz / l * s; turn(J, Math.atan2(dx, dz), dt); standPose(J); J.tick(dt); stride(J, J.st, v, true, .55, dt); return false; };
  const stand = (J, dt, face) => { if (face !== undefined) turn(J, face, dt, 5); standPose(J); J.tick(dt); stride(J, J.st, 0, false, 0, dt); };

  // THE GUARD walks along the mall's front; the red ring on the tiles is how far he sees a street show
  const GZ = -13.5, GX = 11, SEE = 3.2, _qa = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -1.15);
  const guard = { J: person(2, [], l => { l.top = 'bomber'; l.hat = 'cap'; l.chain = 0; l.phones = false; Object.assign(l.col, { top: '#1b2536', sleeve: '#1b2536', cuff: '#FFD23F', trim: '#FFD23F', pants: '#14161b', stripe: null, shoe: '#101114', shoe2: '#101114', sole: '#2a2c31', hat: ['#14161b', '#14161b'] }); }, { type: 'big', beard: true, style: 'buzz', skin: '#C68A5E', hair: '#2e1e14' }),
    x: -GX + 3, z: GZ, dir: 1, wait: 0, alert: 0, see: SEE };
  { const bc = can(128, 48), x = bc.getContext('2d'); x.fillStyle = '#FFD23F'; x.fillRect(0, 0, 128, 48); text(x, 'ОХРАНА', 64, 26, '900 26px Inter, sans-serif', '#14161b');
    const b = new THREE.Mesh(new THREE.PlaneGeometry(.3, .11), new THREE.MeshBasicMaterial({ map: tex(bc) })); b.position.set(0, .12, -.128); b.rotation.y = PI; guard.J.B.Spine2.add(b);
    const zc = paintCanvas(512, 512, (x) => { const g = x.createRadialGradient(256, 256, 120, 256, 256, 250); g.addColorStop(0, 'rgba(255,60,50,0)'); g.addColorStop(1, 'rgba(255,60,50,.22)'); x.fillStyle = g; x.beginPath(); x.arc(256, 256, 250, 0, 7); x.fill(); x.strokeStyle = 'rgba(255,90,79,.95)'; x.lineWidth = 9; x.setLineDash([30, 20]); x.beginPath(); x.arc(256, 256, 244, 0, 7); x.stroke(); }, 0, 1);
    guard.ring = new THREE.Mesh(new THREE.PlaneGeometry(SEE * 2, SEE * 2), new THREE.MeshBasicMaterial({ map: tex(zc), transparent: true, depthWrite: false, toneMapped: false })); guard.ring.rotation.x = -PI / 2; guard.ring.renderOrder = 3; scene.add(guard.ring);
    guard.tag = tag('ОХРАНА', '#FF5A4F'); guard.J.setIdle('Stand_Calm'); guard.J.root.position.set(guard.x, 0, guard.z); guard.J.root.rotation.y = PI / 2; }
  W.tickers.push((dt, now) => { const G = guard, J = G.J, p = J.root.position;
    if (G.alert > 0) { G.alert -= dt; const h = W.hero.root.position; stand(J, dt, Math.atan2(h.x - p.x, h.z - p.z)); if (W.walkBase) J.B.RightArm.quaternion.copy(W.walkBase.q.RightArm).multiply(_qa); }
    else if (G.wait > 0) { G.wait -= dt; stand(J, dt, 0); }
    else { const tx = G.dir * GX; if (go(J, tx, GZ, 1.25, dt)) { G.dir *= -1; G.wait = 4.5; } }
    G.x = p.x; G.z = p.z; G.ring.position.set(p.x, .035, p.z); G.ring.rotation.z = now * .25; G.tag.position.set(p.x, 2.35, p.z); });

  // PASSERS-BY walk a loop around the square; when a show starts, those who are near come to watch
  const LOOP = [[-5.3, -8.5], [11, -8.5], [11, 11.5], [-5.3, 11.5]], LEN = LOOP.map((p, i) => { const q = LOOP[(i + 1) % 4]; return Math.hypot(q[0] - p[0], q[1] - p[1]); }), TOT = LEN.reduce((a, b) => a + b, 0);
  const at = (u, side) => { u = ((u % TOT) + TOT) % TOT; for (let i = 0; i < 4; i++) { if (u <= LEN[i]) { const p = LOOP[i], q = LOOP[(i + 1) % 4], k = u / LEN[i], nx = (q[1] - p[1]) / LEN[i], nz = -(q[0] - p[0]) / LEN[i]; return { x: lerp(p[0], q[0], k) + nx * side, z: lerp(p[1], q[1], k) + nz * side }; } u -= LEN[i]; } return { x: LOOP[0][0], z: LOOP[0][1] }; };
  // ordinary townsfolk, each of their own build: an old man in a coat, a schoolgirl with a backpack, a tall student, a lady in a coat, a big fellow
  const plain = (top, pants, shoe) => l => { l.hat = null; l.chain = 0; l.phones = false; l.wrist = null; l.top = 'bomber'; Object.assign(l.col, { top, sleeve: top, cuff: null, trim: null, pants, stripe: null, shoe, shoe2: shoe, sole: '#d8d4c8', hat: null }); };
  const walkers = [[1, [], plain('#5b4a3a', '#2b2d33', '#3a2c22'), { type: 'heavy', old: true, coat: true, style: 'short', beard: true, skin: '#E3B088' }], [3, ['girl'], null, { type: 'small', pack: '#E2611A', style: 'buns' }], [5, [], null, { type: 'lanky', pack: '#2f4f8a', style: 'curly' }],
    [2, ['girl'], plain('#7a2f3a', '#1f2126', '#e9e4d8'), { type: 'avg', coat: true, style: 'long' }], [4, [], plain('#39424e', '#3E5F8E', '#f2efe8'), { type: 'big', style: 'short' }]].map(([lv, acc, fix, body], i) => { const J = person(lv, acc, fix, body), w = { J, u: TOT * i / 5 + i, dir: i % 2 ? -1 : 1, v: 1.15 + (i % 3) * .12, mode: 'path', slot: null };
    const p = at(w.u, w.dir * .4); J.root.position.set(p.x, 0, p.z); J.setIdle('Stand_Calm'); return w; });
  // two people hanging about at the mall's doors
  const idlers = [[-4.9, -14.6, .5, 3, [], { type: 'stocky' }], [5.1, -14.5, -.6, 6, ['girl'], { type: 'slim', style: 'braids' }]].map(([x, z, ry, lv, acc, body]) => { const J = person(lv, acc, null, body); J.root.position.set(x, 0, z); J.root.rotation.y = ry; J.home = ry; J.setIdle('Stand_Calm'); circ(x, z, .3); return J; });
  let showOn = false;
  W.tickers.push(dt => {
    walkers.forEach(w => { const J = w.J, p = J.root.position;
      if (w.mode === 'path') { w.u += w.dir * w.v * dt; const t = at(w.u, w.dir * .4), dx = t.x - p.x, dz = t.z - p.z; if (Math.hypot(dx, dz) > 1e-4) turn(J, Math.atan2(dx, dz), dt, 6); p.x = t.x; p.z = t.z;
        standPose(J); J.tick(dt); stride(J, J.st, w.v, true, .5, dt); }
      else if (w.mode === 'watch') { if (go(J, w.slot.x, w.slot.z, 1.9, dt)) turn(J, Math.atan2(SHOW.x - p.x, SHOW.z - p.z), dt); }
      else if (w.mode === 'back') { const t = at(w.u, w.dir * .4); if (go(J, t.x, t.z, 1.5, dt)) w.mode = 'path'; } });
    idlers.forEach(J => { const p = J.root.position; turn(J, showOn ? Math.atan2(SHOW.x - p.x, SHOW.z - p.z) : J.home, dt, 3); J.tick(dt); });
  });
  // the crowd: called by the game when a show starts / ends
  const crowd = on => { showOn = on;
    if (on) { const near = walkers.filter(w => w.J.root.position.z < -4.5).sort((a, b) => Math.abs(a.J.root.position.x) - Math.abs(b.J.root.position.x)).slice(0, 3);
      near.forEach((w, i) => { const a = (i - (near.length - 1) / 2) * .62; w.slot = { x: SHOW.x + Math.sin(a) * 3.1, z: SHOW.z + Math.cos(a) * 3.1 }; w.mode = 'watch'; }); }
    else walkers.forEach(w => { if (w.mode === 'watch') w.mode = 'back'; }); };

  W.center = { show: SHOW, guard, crowd, walkers, kiosk: { x: KX, z: KZ + 1.9 }, metro: { x: MX, z: MZ2 + 2.9 }, gateYard: { x: 0, z: 13.7, chain: gateYard.chain }, gatePark: { x: 11.7, z: -12.4, chain: gatePark.chain }, fountain: { x: FX, z: FZ } };
}
