// City 3D — district «ПРОМЗОНА» (owner 16.11.2026 «продолжи работу над городом»).
// A night industrial zone: the foundry hall on the north with a glowing gate and a welder at work, a chimney with red lamps
// and smoke, a rail line with a trolley of hot metal, shipping containers on the edges, a transformer yard that hums blue,
// fire barrels — and in the middle of it the underground battle floor «РИНГ» (plywood on pallets, chains, work lamps).
// Built in code with the toolkit of city3d.js (TK). The game on top is in city3d-game.js; what it needs is left in
// W.prom: { ring, fighters[2], stash[] (spots with a crate each), crowd(on), gatePark, gateClub }.
export async function buildProm(TK) {
  const { THREE, RoundedBoxGeometry, scene, W, OR, M, glowMat, tex, can, grain, blotch, rng, lerp, decal, paintCanvas, box, circ,
    lamp, lamps, dust, crate, barrel, pallet, tires, jersey, concreteTex, mocapPerson, bodyOf, stride, standPose, HERO } = TK;
  const PI = Math.PI, K = TK.FILL_K || 1;
  const mesh = (geo, mat, x, y, z, par = scene) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; par.add(m); return m; };
  const glowPlane = (c, w, h, x, y, z, ry = 0, k = 1) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex(c), transparent: true, toneMapped: false, color: new THREE.Color(k, k, k) }));
    m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); return m; };
  const point = (col, power, x, y, z, dist = 9) => { const l = new THREE.PointLight(col, power * K, dist, 1.6); l.position.set(x, y, z); scene.add(l); return l; };
  const text = (x, t, px, py, font, col, align = 'center') => { x.font = font; x.textAlign = align; x.textBaseline = 'middle'; x.fillStyle = col; x.fillText(t, px, py); };
  const flat = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.rotation.x = -PI / 2; m.position.set(x, y, z); m.receiveShadow = true; scene.add(m); return m; };
  const put = (o, x, z, ry = 0) => { o.position.set(x, o.position.y, z); o.rotation.y = ry; scene.add(o); return o; };

  // a rusty brown night: darker and dirtier than the Park, lit by sodium lamps and fire
  scene.background.set('#0d0a09'); scene.fog.color.set('#0d0a09'); scene.fog.density = .017;

  // ---------- ground: old concrete slabs, oil, hazard paint ----------
  { const con = concreteTex(); [con.map, con.rough, con.bump].forEach(t => t.repeat.set(70 / 6, 70 / 6));
    flat(new THREE.PlaneGeometry(70, 70), new THREE.MeshStandardMaterial({ map: con.map, roughnessMap: con.rough, bumpMap: con.bump, bumpScale: 1.3, roughness: .94, color: '#c9b8a8' }), 0, 0, 0);
    for (let i = 0; i < 12; i++) { const r = rng(300 + i); decal(scene, paintCanvas(128, 128, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(0,0,0,.7)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }, 0, i), 1.2 + r() * 2.6, 1 + r() * 1.8, -11 + r() * 22, -9 + r() * 21, r() * 3, { op: .75 }); }
    // rainbow-dark oil puddles
    const puddle = (x, z, s, rot) => decal(scene, paintCanvas(256, 256, (c, w, h, r) => { c.fillStyle = 'rgba(10,8,12,.9)'; c.beginPath(); for (let i = 0; i < 18; i++) { const a = i / 18 * 6.283, rr = w * (.3 + r() * .15); c.lineTo(w / 2 + Math.cos(a) * rr, h / 2 + Math.sin(a) * rr * .7); } c.closePath(); c.filter = 'blur(6px)'; c.fill(); }, 0, (x * 7) | 0), s, s, x, z, rot, { rough: .04 });
    puddle(2.6, 3.4, 2.6, .4); puddle(-9.2, 10.6, 2, 1.1); puddle(9.4, 3.2, 2.2, 2.2); puddle(-1.4, -8.2, 1.8, .2);
    // yellow walkway arrows and a big stencil
    const band = (x, z, w, d, rot = 0) => decal(scene, paintCanvas(512, 64, (c, cw, ch) => { for (let i = -2; i < 20; i++) { c.fillStyle = i % 2 ? '#D9A43A' : '#15161a'; c.beginPath(); c.moveTo(i * 40, 0); c.lineTo(i * 40 + 40, 0); c.lineTo(i * 40 + 10, ch); c.lineTo(i * 40 - 30, ch); c.fill(); } }, .5, (x * 3 + z) | 0), w, d, x, z, rot, { op: .85 });
    band(0, -10.25, 26.4, .42); band(-12.2, 9.5, .42, 3.4);
    decal(scene, paintCanvas(1024, 200, (c, w, h) => { text(c, 'ПРОМЗОНА · ЦЕХ 5', w / 2, h / 2 + 6, '400 130px Anton, sans-serif', '#D9A43A'); }, .7, 77), 6.4, 1.25, 1.2, 11.2, 0, { op: .75 });
    decal(scene, paintCanvas(512, 128, (c, w, h) => { text(c, 'FEDOSKIN TEAM', w / 2, h / 2 + 4, '400 78px Anton, sans-serif', OR); }, .75, 31), 3.6, .9, -8.6, 12.6, 0, { op: .75 });
  }

  // ---------- the foundry hall (north): brick, a grid of dirty windows, the big gate glowing from inside ----------
  const FZ = -13.4, GX = -3.2;   // the facade line and the gate
  { const S = 2048, H = 512, c = can(S, H), x = c.getContext('2d'), r = rng(21);
    x.fillStyle = '#3d2a22'; x.fillRect(0, 0, S, H);
    for (let row = 0; row < 40; row++) for (let i = 0; i < 70; i++) { x.fillStyle = `hsl(${12 + r() * 10},${28 + r() * 14}%,${14 + r() * 9}%)`; x.fillRect(i * 30 + (row % 2) * 15, row * 13, 28, 11); }
    blotch(x, S, H, 60, 'rgba(0,0,0,A)', 30, 160, .3, r); blotch(x, S, H, 26, 'rgba(160,120,90,A)', 20, 90, .08, r);
    // windows: tall steel frames with small panes, some lit warm, some broken dark
    for (let i = 0; i < 9; i++) { const wx = 70 + i * 222; if (Math.abs(wx + 80 - (GX + 17) / 34 * S) < 250) continue;
      x.fillStyle = '#17110e'; x.fillRect(wx - 6, 70, 172, 252);
      for (let a = 0; a < 5; a++) for (let b = 0; b < 7; b++) { const lit = r() < .55; x.fillStyle = lit ? `hsla(${28 + r() * 14},${70 + r() * 20}%,${38 + r() * 26}%,${.75 + r() * .25})` : (r() < .3 ? '#07090c' : '#1d242b'); x.fillRect(wx + a * 32, 78 + b * 34, 28, 30); } }
    // soot above the gate, a painted number
    const gx = (GX + 17) / 34 * S; { const g = x.createRadialGradient(gx, 300, 20, gx, 300, 300); g.addColorStop(0, 'rgba(0,0,0,.75)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(gx - 320, 0, 640, H); }
    text(x, 'ЦЕХ  5', gx, 96, '400 86px Anton, sans-serif', 'rgba(233,228,216,.82)');
    grain(c, 16, 4);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(34, 7.2, 6), [M('#2a1d18', .9), M('#2a1d18', .9), M('#1c1512', .9), M('#1c1512', .9), new THREE.MeshStandardMaterial({ map: tex(c), roughness: .9, emissive: '#ffffff', emissiveMap: tex(c), emissiveIntensity: .22 }), M('#2a1d18', .9)]);
    wall.position.set(0, 3.6, FZ - 3); wall.castShadow = wall.receiveShadow = true; scene.add(wall); box(0, FZ - 3, 34, 6.2);
    // saw-tooth roof lights
    for (let i = -3; i <= 3; i++) { const s = mesh(new THREE.BoxGeometry(4.2, 1.1, 5.6), M('#231a16', .9), i * 4.7, 7.6, FZ - 3); s.rotation.z = .16; s.castShadow = false; }
    // the gate: a dark opening with the furnace's glow deep inside, half-raised shutter, rails going in
    mesh(new THREE.BoxGeometry(4.4, 4.2, .2), M('#050404', 1), GX, 2.1, FZ + .02).castShadow = false;
    const gc = can(256, 256), gg = gc.getContext('2d'), g2 = gg.createRadialGradient(128, 200, 6, 128, 190, 150); g2.addColorStop(0, 'rgba(255,225,150,1)'); g2.addColorStop(.3, 'rgba(255,120,40,.85)'); g2.addColorStop(1, 'rgba(120,20,0,0)'); gg.fillStyle = g2; gg.fillRect(0, 0, 256, 256);
    const glow = glowPlane(gc, 4.2, 4, GX, 2, FZ + .14, 0, 1.25);
    mesh(new THREE.BoxGeometry(4.5, 1.25, .12), new THREE.MeshStandardMaterial({ map: tex(paintCanvas(256, 64, (c2, w, h) => { c2.fillStyle = '#4d5056'; c2.fillRect(0, 0, w, h); for (let i = 0; i < 8; i++) { c2.fillStyle = 'rgba(0,0,0,.35)'; c2.fillRect(0, i * 8, w, 2); } }, .3, 5)), roughness: .5, metalness: .6 }), GX, 3.62, FZ + .2);
    [-1, 1].forEach(k => mesh(new THREE.BoxGeometry(.3, 4.4, .3), M('#D9A43A', .7), GX + k * 2.35, 2.2, FZ + .2));
    const forge = point('#ff8a3a', 34, GX, 2.2, FZ + 1.6, 12);
    // the welder by the gate: a crouching man, a blue-white arc that flashes, sparks
    const AX = GX + 3.3, AZ = FZ + .5;   // he repairs the pipe support right of the gate
    const arc = mesh(new THREE.SphereGeometry(.09, 8, 6), glowMat('#cfe6ff', 6), AX, .45, AZ); arc.castShadow = false;
    const arcL = point('#9cc8ff', 0, AX, .8, AZ + .4, 7);
    const N = 26, sp = new Float32Array(N * 3), sv = Array.from({ length: N }, () => [0, 0, 0, 9]), pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const sparks = new THREE.Points(pg, new THREE.PointsMaterial({ color: '#ffd9a0', size: .07, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); sparks.frustumCulled = false; scene.add(sparks);
    let t = 0, on = 0;
    W.tickers.push(dt => { t += dt; glow.material.color.setScalar(1.15 + Math.sin(t * 2.3) * .12 + Math.sin(t * 7.1) * .05); forge.intensity = (34 + Math.sin(t * 2.3) * 5 + Math.sin(t * 9) * 2) * K;
      // he welds in bursts: ~2 s of arc, ~3 s of rest
      const burst = (t % 5.2) < 2.1; on = burst ? (Math.sin(t * 61) + Math.sin(t * 37) > -.4 ? 1 : .15) : 0; arc.visible = on > 0; arcL.intensity = on * 26 * K;
      for (let i = 0; i < N; i++) { const v = sv[i]; v[3] += dt; if (v[3] > .55 && burst && Math.random() < .5) { v[0] = (Math.random() - .5) * 2.4; v[1] = 1.4 + Math.random() * 2.2; v[2] = .6 + Math.random() * 2; v[3] = 0; sp[i * 3] = AX; sp[i * 3 + 1] = .45; sp[i * 3 + 2] = AZ; }
        if (v[3] < .55) { v[1] -= 9 * dt; sp[i * 3] += v[0] * dt; sp[i * 3 + 1] = Math.max(.03, sp[i * 3 + 1] + v[1] * dt); sp[i * 3 + 2] += v[2] * dt; } else sp[i * 3 + 1] = -5; }
      pg.attributes.position.needsUpdate = true; });
    // the name of the plant on the roof, leaning back so that it reads from the camera
    const nc = can(2048, 160), nx = nc.getContext('2d'); nx.shadowColor = '#ff6a2a'; nx.shadowBlur = 16; text(nx, 'ЛИТЕЙНО-МЕХАНИЧЕСКИЙ ЗАВОД', 1024, 84, '400 112px Anton, sans-serif', '#ff9a5a');
    const n = glowPlane(nc, 15, 1.17, 4.4, 7.95, FZ - .2, 0, 1.1); n.rotation.x = -.6;
  }
  // the chimney with red lamps and slow smoke, pipes along the wall
  { const CX = 10.6, CZ = FZ - 4.2; mesh(new THREE.CylinderGeometry(.75, 1.15, 14, 16), M('#4a3128', .9), CX, 7, CZ);
    [[13.6, .78], [9.6, .9]].forEach(([y, rr]) => mesh(new THREE.CylinderGeometry(rr + .04, rr + .04, .5, 16), M('#e9e4d8', .8), CX, y, CZ).castShadow = false);
    const reds = [13.9, 9.9].map(y => { const m = mesh(new THREE.SphereGeometry(.14, 8, 6), glowMat('#ff2a1a', 4), CX, y, CZ + .95); m.castShadow = false; return m; });
    const sc = can(64, 64), sx = sc.getContext('2d'), sg = sx.createRadialGradient(32, 32, 2, 32, 32, 32); sg.addColorStop(0, 'rgba(150,140,135,.5)'); sg.addColorStop(1, 'rgba(150,140,135,0)'); sx.fillStyle = sg; sx.fillRect(0, 0, 64, 64);
    const st = tex(sc), puffs = Array.from({ length: 7 }, (_, i) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: st, transparent: true, depthWrite: false, opacity: .5 })); scene.add(s); return { s, u: i / 7 }; });
    let t = 0; W.tickers.push(dt => { t += dt; puffs.forEach(p => { p.u = (p.u + dt * .055) % 1; p.s.position.set(CX + p.u * 5 + Math.sin(t * .5 + p.u * 9) * .3, 14.3 + p.u * 4.5, CZ - p.u * 1.5); const k = 1.6 + p.u * 4.4; p.s.scale.set(k, k, 1); p.s.material.opacity = .5 * (1 - p.u) * Math.min(1, p.u * 8); });
      const b = Math.sin(t * 2.6) > .2 ? 4 : .6; reds.forEach(m => m.material.color.set('#ff2a1a').multiplyScalar(b)); });
    // fat pipes on supports along the east part of the wall, a valve wheel
    const pipe = M('#6b6f76', .5, .6); [[1.5, FZ + .55, .26], [2.2, FZ + .45, .18]].forEach(([y, z, rr]) => { const p = mesh(new THREE.CylinderGeometry(rr, rr, 11.5, 12), pipe, 6.6, y, z); p.rotation.z = PI / 2; });
    for (let px = 1.6; px <= 11.6; px += 2.5) mesh(new THREE.BoxGeometry(.14, 2.3, .3), M('#3a3c42', .7, .4), px, 1.15, FZ + .5);
    const wh = mesh(new THREE.TorusGeometry(.22, .035, 6, 16), M('#C8202A', .5, .3), 4.1, 1.5, FZ + .95); wh.castShadow = false;
    box(6.6, FZ + .5, 11.6, .7);
  }

  // ---------- the rail line with a trolley of hot metal (north, behind the hazard band) ----------
  { const RZ = -11.5, rail = M('#8b9099', .35, .8), tie = M('#3a2c22', .95);
    for (let px = -16.5; px <= 16.5; px += .75) { const s = mesh(new THREE.BoxGeometry(.22, .07, 1.7), tie, px, .035, RZ); s.castShadow = false; }
    [-.55, .55].forEach(k => mesh(new THREE.BoxGeometry(34, .1, .08), rail, 0, .11, RZ + k).castShadow = false);
    const tr = new THREE.Group(); scene.add(tr);
    mesh(new THREE.BoxGeometry(1.9, .22, 1.3), M('#2c2f36', .6, .5), 0, .42, 0, tr); [-.6, .6].forEach(px => [-.55, .55].forEach(pz => { const w = mesh(new THREE.CylinderGeometry(.2, .2, .1, 12), M('#17181b', .5, .6), px, .25, pz, tr); w.rotation.x = PI / 2; }));
    const lad = mesh(new THREE.CylinderGeometry(.62, .46, .95, 14, 1, true), M('#3d4046', .6, .5, { side: THREE.DoubleSide }), 0, 1.02, 0, tr);
    const melt = mesh(new THREE.CircleGeometry(.56, 14), glowMat('#ff9a3a', 2), 0, 1.36, 0, tr); melt.rotation.x = -PI / 2; melt.castShadow = false; lad.castShadow = true;
    const ml = new THREE.PointLight('#ff8a3a', 11 * K, 7, 1.6); ml.position.set(0, 1.9, 0); tr.add(ml);
    let t = 12; W.tickers.push(dt => { t += dt; const u = (t % 38) / 38; tr.position.set(-19 + u * 38, 0, RZ); melt.material.color.set('#ff9a3a').multiplyScalar(1.8 + Math.sin(t * 5) * .3); });
    // low concrete barriers keep people off the track
    [-10.4, -3.4, 3.6, 10.6].forEach(px => put(jersey(5.6), px, -10.62)); box(0, -10.62, 27, .62);
  }

  // ---------- shipping containers on the edges (tall things only on the edges and the north) ----------
  const cont = (x, z, ry, col, y = 0, word) => { const S = 512, c = can(S, 256), cx = c.getContext('2d'), r = rng((x * 11 + z * 5 + y * 3) | 0); cx.fillStyle = col; cx.fillRect(0, 0, S, 256);
    for (let i = 0; i < 32; i++) { cx.fillStyle = i % 2 ? 'rgba(0,0,0,.2)' : 'rgba(255,255,255,.07)'; cx.fillRect(i * 16, 0, 8, 256); }
    blotch(cx, S, 256, 30, 'rgba(90,40,15,A)', 8, 46, .5, r); blotch(cx, S, 256, 16, 'rgba(0,0,0,A)', 20, 80, .25, r);
    if (word) text(cx, word, S / 2, 132, '400 96px Anton, sans-serif', 'rgba(242,239,232,.82)'); grain(c, 12, 2);
    const side = new THREE.MeshStandardMaterial({ map: tex(c), roughness: .6, metalness: .35 }), end = M(col, .6, .35);
    const m = new THREE.Mesh(new THREE.BoxGeometry(6, 2.5, 2.4), [end, end, end, end, side, side]); m.position.set(x, 1.25 + y * 2.52, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; scene.add(m);
    if (!y) { const cs = Math.abs(Math.cos(ry)), sn = Math.abs(Math.sin(ry)); box(x, z, 6 * cs + 2.4 * sn, 6 * sn + 2.4 * cs); } };
  cont(-14.4, -6.6, PI / 2, '#2f5d8a', 0, 'FT CARGO'); cont(-14.4, -6.6, PI / 2, '#8a3a2a', 1); cont(-14.4, -.2, PI / 2, '#3b6b4a', 0); cont(-14.5, 3.4, PI / 2 + .06, '#b0842a', 0);
  cont(14.9, -6.2, PI / 2, '#8a3a2a', 0, 'B-BOY LINE'); cont(14.9, -6.2, PI / 2 - .05, '#2f5d8a', 1); cont(14.9, 8.6, PI / 2, '#5d626b', 0); cont(14.9, 8.6, PI / 2, '#b0842a', 1);

  // ---------- the transformer yard (east): it hums blue, the high-voltage crew hangs out next to it ----------
  const TX = 11.3, TZ = -1.9;
  { [-.8, .8].forEach(k => { mesh(new THREE.BoxGeometry(1.3, 1.5, 1.1), M('#59606a', .5, .5), TX + k, .95, TZ); mesh(new THREE.BoxGeometry(1.5, .2, 1.3), M('#3a3c42', .7), TX + k, .1, TZ).castShadow = false;
      for (let i = -2; i <= 2; i++) mesh(new THREE.BoxGeometry(.05, 1.1, 1.24), M('#4a5058', .5, .5), TX + k + i * .26, .95, TZ).castShadow = false;
      [-.3, .3].forEach(q => { mesh(new THREE.CylinderGeometry(.05, .08, .5, 8), M('#b9b2a2', .5), TX + k + q, 1.95, TZ); mesh(new THREE.SphereGeometry(.07, 8, 6), glowMat('#8fd0ff', 2.2), TX + k + q, 2.24, TZ).castShadow = false; }); });
    const sc = paintCanvas(128, 128, (c, w, h) => { c.fillStyle = '#FFD23F'; c.beginPath(); c.moveTo(w / 2, 8); c.lineTo(w - 8, h - 12); c.lineTo(8, h - 12); c.closePath(); c.fill(); c.strokeStyle = '#15161a'; c.lineWidth = 8; c.stroke(); c.fillStyle = '#15161a'; c.beginPath(); c.moveTo(70, 40); c.lineTo(50, 76); c.lineTo(64, 76); c.lineTo(54, 106); c.lineTo(82, 66); c.lineTo(66, 66); c.closePath(); c.fill(); }, .15, 3);
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(.6, .6), new THREE.MeshBasicMaterial({ map: tex(sc), transparent: true })); sg.position.set(TX, .95, TZ + .58); scene.add(sg);
    box(TX, TZ, 3.2, 1.4); const bl = point('#6fb8ff', 13, TX, 2.5, TZ + .8, 8);
    let t = 0; W.tickers.push(dt => { t += dt; bl.intensity = (12 + Math.sin(t * 50) * 1.5 + (Math.sin(t * 1.7) > .93 ? 14 : 0)) * K; });
  }

  // ---------- THE RING (centre-west): the underground battle floor ----------
  const RX = -5.4, RZ0 = -4.6, RS = 2.5;   // centre and half-size
  { const fc = paintCanvas(1024, 1024, (x, w, h, r) => { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.fillStyle = `hsl(${30 + r() * 6},${30 + r() * 10}%,${32 + r() * 9}%)`; x.fillRect(i * 256, j * 256, 256, 256); x.strokeStyle = 'rgba(0,0,0,.45)'; x.lineWidth = 4; x.strokeRect(i * 256, j * 256, 256, 256);
        for (let k = 0; k < 14; k++) { x.strokeStyle = `rgba(60,35,15,${.08 + r() * .12})`; x.lineWidth = 1 + r() * 2; x.beginPath(); const yy = j * 256 + r() * 256; x.moveTo(i * 256, yy); x.bezierCurveTo(i * 256 + 80, yy + r() * 20 - 10, i * 256 + 170, yy + r() * 20 - 10, i * 256 + 256, yy); x.stroke(); } }
      x.strokeStyle = OR; x.lineWidth = 18; x.strokeRect(40, 40, w - 80, h - 80); x.strokeStyle = 'rgba(242,239,232,.75)'; x.lineWidth = 6; x.beginPath(); x.arc(w / 2, h / 2, 250, 0, 7); x.stroke();
      x.globalAlpha = .55; text(x, 'РИНГ', w / 2, h / 2 + 8, '400 190px Anton, sans-serif', '#f2efe8'); x.globalAlpha = 1; }, .3, 61);
    // plywood sheets straight on the concrete (flush with the ground: dancers walk on and off it), spare pallets behind
    mesh(new THREE.BoxGeometry(RS * 2 + .1, .05, RS * 2 + .1), M('#5a4630', .85), RX, .025, RZ0).castShadow = false;
    flat(new THREE.PlaneGeometry(RS * 2, RS * 2), new THREE.MeshStandardMaterial({ map: tex(fc), roughness: .7 }), RX, .052, RZ0);
    [0, .15, .3].forEach((y, i) => { const p = pallet(); p.position.y = y; put(p, RX + RS + 1.5, RZ0 - RS + .4, .1 * i); }); box(RX + RS + 1.5, RZ0 - RS + .4, 1.4, 1.2);
    // corner posts and sagging chains on three sides (the south side is open — the camera and the hero come from there)
    const post = M('#D9A43A', .6, .3), ch = M('#b9bcc4', .35, .85);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { mesh(new THREE.CylinderGeometry(.07, .08, 1.25, 10), post, RX + a * (RS + .12), .625, RZ0 + b * (RS + .12)); circ(RX + a * (RS + .12), RZ0 + b * (RS + .12), .16); });
    const chain = (x0, z0, x1, z1) => { for (let i = 0; i < 9; i++) { const u = (i + .5) / 9, m = mesh(new THREE.BoxGeometry(Math.hypot(x1 - x0, z1 - z0) / 9 + .02, .05, .05), ch, lerp(x0, x1, u), 1.05 - Math.sin(u * PI) * .22, lerp(z0, z1, u)); m.rotation.y = Math.atan2(-(z1 - z0), x1 - x0); m.castShadow = false; } };
    const e = RS + .12; chain(RX - e, RZ0 - e, RX + e, RZ0 - e); chain(RX - e, RZ0 - e, RX - e, RZ0 + e); chain(RX + e, RZ0 - e, RX + e, RZ0 + e);
    box(RX, RZ0 - e, e * 2, .12); box(RX - e, RZ0, .12, e * 2); box(RX + e, RZ0, .12, e * 2);
    // a truss with two work lamps over the back, a banner, speakers made of barrels
    [-1, 1].forEach(k => mesh(new THREE.BoxGeometry(.1, 3.4, .1), M('#2e333a', .5, .6), RX + k * (RS + .5), 1.7, RZ0 - RS - .5)); mesh(new THREE.BoxGeometry(RS * 2 + 1.2, .1, .1), M('#2e333a', .5, .6), RX, 3.4, RZ0 - RS - .5).castShadow = false;
    [-1.3, 1.3].forEach(k => { mesh(new THREE.CylinderGeometry(.16, .24, .26, 12), M('#25292f', .5, .5), RX + k, 3.22, RZ0 - RS - .4); mesh(new THREE.CircleGeometry(.2, 12), glowMat('#ffd9a0', 2.2), RX + k, 3.08, RZ0 - RS - .4).rotation.x = PI / 2; });
    point('#ffc27a', 22, RX, 3, RZ0 - .6, 9); circ(RX - RS - .5, RZ0 - RS - .5, .12); circ(RX + RS + .5, RZ0 - RS - .5, .12);
    const bc = can(1024, 128), bx = bc.getContext('2d'); bx.fillStyle = '#15161a'; bx.fillRect(0, 0, 1024, 128); bx.strokeStyle = OR; bx.lineWidth = 8; bx.strokeRect(6, 6, 1012, 116); text(bx, 'ПОДПОЛЬНЫЙ РИНГ · СЕРИЯ ПОБЕД', 512, 68, '400 68px Anton, sans-serif', '#ffb27a');
    const bn = glowPlane(bc, 5, .62, RX, 3.05, RZ0 - RS - .46, 0, .95); bn.rotation.x = -.5;
    // fire barrels by the corners: flame and a flickering warm light
    const fires = [[RX - RS - 1.1, RZ0 + RS + .4], [RX + RS + 1.2, RZ0 + RS + .2]].map(([x, z], i) => { put(barrel(), x, z); circ(x, z, .42);
      const fl = mesh(new THREE.ConeGeometry(.26, .7, 8), glowMat('#ff9a3a', 2.6), x, 1.25, z); fl.castShadow = false; const f2 = mesh(new THREE.ConeGeometry(.15, .45, 8), glowMat('#ffe2a0', 3), x, 1.15, z); f2.castShadow = false;
      return { fl, f2, l: point('#ff8a3a', 13, x, 1.6, z, 7), p: i * 2.1 }; });
    let t = 0; W.tickers.push(dt => { t += dt; fires.forEach(f => { const k = 1 + Math.sin(t * 11 + f.p) * .16 + Math.sin(t * 23 + f.p * 3) * .1; f.fl.scale.set(1, k, 1); f.fl.position.y = 1.02 + .35 * k; f.f2.scale.set(1, 2 - k, 1); f.fl.rotation.y = t * 2; f.l.intensity = 13 * k * K; }); });
  }

  // ---------- yard clutter: rebar, pallets, drums, tyres, crates ----------
  { // bundles of rebar where the «Арматура» crew stands
    const rb = M('#7a4a2e', .7, .5); [[9.9, 9.9, .2], [10.4, 10.5, .1], [9.6, 10.9, .32]].forEach(([x, z, ry], i) => { for (let k = 0; k < 6; k++) { const m = mesh(new THREE.CylinderGeometry(.03, .03, 3.4, 5), rb, x + (k % 3 - 1) * .07, .06 + Math.floor(k / 3) * .065 + i * .0, z + (k % 2) * .03); m.rotation.set(0, ry, PI / 2); } });
    box(10, 10.4, 3.5, 1.5);
    put(pallet(), 2.4, 12.9, .2); { const p = pallet(); p.position.y = .15; put(p, 2.45, 12.85, .32); } box(2.4, 12.9, 1.4, 1.2);
    [[-11.6, -9.3, 0], [-10.8, -9.5, 1], [-11.3, -8.6, 0], [3.4, -9.4, 1], [12.2, 12.6, 0], [12.4, 11.8, 1]].forEach(([x, z, k]) => { put(barrel(), x, z, x); circ(x, z, .4); });
    put(tires(3), -2.4, 12.6); circ(-2.4, 12.6, .46); put(tires(2), 12.3, 4.6); circ(12.3, 4.6, .46);
    [[-.6, 7.4, .8, .3], [-1.4, 7.7, .6, 1.1], [5.2, -8.9, .9, .1]].forEach(([x, z, s, ry]) => { const c = crate(s); c.position.y = s / 2; put(c, x, z, ry); box(x, z, s + .1, s + .1); });
    // a parked forklift
    const f = new THREE.Group(); f.position.set(1.6, 0, -8.6); f.rotation.y = -.5; scene.add(f); const ye = M('#D9A43A', .5, .3), dk = M('#1c1f24', .6, .4);
    mesh(new RoundedBoxGeometry(1.2, .7, 1.9, 2, .08), ye, 0, .55, 0, f); mesh(new THREE.BoxGeometry(1.1, .5, .7), dk, 0, .95, -.5, f); [[-.5, .55], [.5, .55], [-.5, -.6], [.5, -.6]].forEach(([x, z]) => { const w = mesh(new THREE.CylinderGeometry(.26, .26, .2, 12), M('#111', .8), x, .26, z, f); w.rotation.z = PI / 2; });
    [-.42, .42].forEach(x => { mesh(new THREE.BoxGeometry(.08, 2.1, .1), dk, x, 1.05, 1.0, f); mesh(new THREE.BoxGeometry(.1, .05, 1.1), M('#8b9099', .4, .8), x, .16, 1.55, f); });
    [[-.5, -.9], [.5, -.9], [-.5, .1], [.5, .1]].forEach(([x, z]) => mesh(new THREE.BoxGeometry(.06, 1.1, .06), dk, x, 1.45, z, f)); mesh(new THREE.BoxGeometry(1.14, .06, 1.1), dk, 0, 2.02, -.4, f);
    box(1.6, -8.5, 1.9, 2.4);
  }

  // ---------- gates: back to the Park (west) and on to the Club (east, closed for now) ----------
  const arch = (x, z, ry, label, col) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
    [-1.4, 1.4].forEach(px => mesh(new THREE.BoxGeometry(.35, 3, .35), M('#3a3c42', .8), px, 1.5, 0, g)); mesh(new THREE.BoxGeometry(3.2, .45, .4), M('#2a2c31', .7), 0, 3.1, 0, g);
    const c = can(512, 64), cx = c.getContext('2d'); text(cx, label, 256, 34, '400 46px Anton, sans-serif', col);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(2.9, .36), new THREE.MeshBasicMaterial({ map: tex(c), transparent: true, toneMapped: false })); s.position.set(0, 3.1, .21); g.add(s);
    const chain = mesh(new THREE.BoxGeometry(2.5, .06, .06), M('#c9c4b8', .3, .9), 0, 1.1, 0, g);
    const cs = Math.abs(Math.cos(ry)), sn = Math.abs(Math.sin(ry)); [-1.4, 1.4].forEach(px => circ(x + px * Math.cos(ry), z - px * Math.sin(ry), .3)); box(x, z, 2.4 * cs + .2 * sn, 2.4 * sn + .2 * cs);
    return { g, chain }; };
  const gatePark = arch(-13.0, 9.5, PI / 2, '←  ПАРК', OR); gatePark.chain.visible = false;
  const gateClub = arch(13.3, 1.4, -PI / 2, 'КЛУБ  →', '#FF7AD9');

  // ---------- light: sodium lamps (fewer and dimmer than in the Centre — the fire and the forge do the rest) ----------
  const SOD = '#ffb062';
  lamp(scene, -9.6, 5.9, 1.9, { shadow: true, power: 95, angle: 1.0, col: SOD });
  lamp(scene, 5.2, 4.6, -2.4, { shadow: true, power: 100, angle: 1.0, col: SOD, double: true });
  lamp(scene, -1.2, -9.6, 0, { power: 80, angle: 1.0, col: SOD });
  lamp(scene, 8.9, -9.6, 0, { power: 80, angle: 1.0, col: SOD, flicker: true });
  lamp(scene, -12.4, -2.6, PI / 2, { power: 75, angle: 1.0, col: SOD });
  lamp(scene, 12.6, 11.2, -2.2, { power: 75, angle: 1.0, col: SOD });
  lamp(scene, -4.6, 13.6, PI, { power: 70, angle: 1.0, col: SOD });
  lamps.forEach((l, i) => i < 2 && dust(scene, l.head));

  // ---------- people ----------
  let pn = 0;
  const person = (lv, acc, fix, body) => { const look = HERO.topDown(lv, acc); if (fix) fix(look); const J = mocapPerson(look, { body: bodyOf(1300 + (pn++) * 29, Object.assign({ girl: acc.includes('girl') }, body)) });
    J.play('Breakdance_Ready', { at: Math.random() }); scene.add(J.root); J.st = { wk: 0, ph: Math.random() * 6 }; return J; };
  const turn = (J, a, dt, k = 8) => { let d = a - J.root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); J.root.rotation.y += d * (1 - Math.exp(-dt * k)); };
  const go = (J, tx, tz, v, dt) => { const p = J.root.position, dx = tx - p.x, dz = tz - p.z, l = Math.hypot(dx, dz); if (l < .12) { standPose(J); J.tick(dt); stride(J, J.st, 0, false, 0, dt); return true; }
    const s = Math.min(l, v * dt); p.x += dx / l * s; p.z += dz / l * s; turn(J, Math.atan2(dx, dz), dt); standPose(J); J.tick(dt); stride(J, J.st, v, true, .55, dt); return false; };
  // work clothes: a hi-vis vest look (bright top, dark sleeves), heavy boots, a helmet-coloured cap
  const work = (vest, hat) => l => { l.hat = hat ? 'cap' : 'beanie'; l.chain = 0; l.phones = false; l.wrist = null; l.top = 'bomber'; l.gloves = true;
    Object.assign(l.col, { top: vest, sleeve: '#2b2d33', cuff: '#D9DEE6', trim: '#D9DEE6', pants: '#23303f', stripe: null, shoe: '#3a2c22', shoe2: '#3a2c22', sole: '#15161a', hat: hat ? [hat, hat] : ['#2b2d33', '#2b2d33'] }); };

  // the two regulars of the ring wait at its back (the game takes one of them out for an underground battle)
  const fighters = [[7, [], { type: 'athl', style: 'buzz', beard: true }], [8, ['girl'], { type: 'slim', style: 'tail', dye: '#ff5a4a' }]].map(([lv, acc, body], i) => { const J = person(lv, acc, l => { l.top = 'tee'; l.chain = 0; Object.assign(l.col, { top: i ? '#C8202A' : '#18181B', pants: '#2b2d33', stripe: i ? '#F2EFE8' : OR }); }, body);
    J.home = { x: RX + (i ? 1.1 : -1.1), z: RZ0 - RS + .55 }; J.root.position.set(J.home.x, 0, J.home.z); J.root.rotation.y = 0; return J; });
  // the welder (crouched by the gate, back to us) and the workers of the night shift who walk their round
  const welder = person(4, [], work('#3d4046', '#D9A43A'), { type: 'stocky', style: 'bald' }); welder.root.position.set(GX + 3.3, 0, FZ + 1.15); welder.root.rotation.y = PI;
  welder.play('Breakdance_Footwork_3', { at: .5 }); if (welder.act) welder.act.timeScale = 0;   // kneeling on all fours over the seam
  const LOOP = [[-10.6, -9.2], [10.4, -9.2], [10.4, 12.4], [-10.6, 12.4]], LEN = LOOP.map((p, i) => { const q = LOOP[(i + 1) % 4]; return Math.hypot(q[0] - p[0], q[1] - p[1]); }), TOT = LEN.reduce((a, b) => a + b, 0);
  const at = (u, side) => { u = ((u % TOT) + TOT) % TOT; for (let i = 0; i < 4; i++) { if (u <= LEN[i]) { const p = LOOP[i], q = LOOP[(i + 1) % 4], k = u / LEN[i], nx = (q[1] - p[1]) / LEN[i], nz = -(q[0] - p[0]) / LEN[i]; return { x: lerp(p[0], q[0], k) + nx * side, z: lerp(p[1], q[1], k) + nz * side }; } u -= LEN[i]; } return { x: LOOP[0][0], z: LOOP[0][1] }; };
  const walkers = [
    [5, [], work('#FF7A1A', '#F2EFE8'), { type: 'big', style: 'short', beard: true }, 1.2, .5, 1],
    [3, [], work('#C8E03A', '#D9A43A'), { type: 'lanky', style: 'short' }, 1.35, .55, 1],
    [4, ['girl'], work('#FF7A1A', '#D9A43A'), { type: 'avg', style: 'bun' }, 1.3, .55, -1],
    [2, [], work('#3d4046', null), { type: 'heavy', style: 'bald', beard: true, pack: '#3a2c22' }, 1.05, .5, -1],
  ].map(([lv, acc, fix, body, v, k, dir], i) => { const J = person(lv, acc, fix, body), w = { J, u: TOT * i / 4 + i * 5, dir, v, k, mode: 'path', slot: null };
    const p = at(w.u, w.dir * .5); J.root.position.set(p.x, 0, p.z); return w; });
  W.tickers.push(dt => {
    walkers.forEach(w => { const J = w.J, p = J.root.position;
      if (w.mode === 'path') { w.u += w.dir * w.v * dt; const t = at(w.u, w.dir * .5), dx = t.x - p.x, dz = t.z - p.z; if (Math.hypot(dx, dz) > 1e-4) turn(J, Math.atan2(dx, dz), dt, 6); p.x = t.x; p.z = t.z; standPose(J); J.tick(dt); stride(J, J.st, w.v, true, w.k, dt); }
      else if (w.mode === 'watch') { if (go(J, w.slot.x, w.slot.z, 1.9, dt)) turn(J, Math.atan2(RX - p.x, RZ0 - p.z), dt); }
      else if (w.mode === 'back') { const t = at(w.u, w.dir * .5); if (go(J, t.x, t.z, 1.6, dt)) w.mode = 'path'; } });
    fighters.forEach(J => { if (!J.busy) J.tick(dt); }); welder.tick(dt);
  });
  // the ring's crowd: the workers come to its open south side (called by the game)
  const crowd = on => { if (on) walkers.slice(0, 3).forEach((w, i) => { w.slot = { x: RX + (i - 1) * 1.5, z: RZ0 + RS + 1.5 + Math.abs(i - 1) * .3 }; w.mode = 'watch'; }); else walkers.forEach(w => { if (w.mode === 'watch') w.mode = 'back'; }); };

  // ---------- stashes: seven hiding places; the game shows a crate in three of them every day ----------
  const stash = [[-11.2, -7.6], [3.2, -8.2], [12.1, -8.9], [12.0, 6.4], [11.6, 13.0], [.6, 13.2], [-11.6, 13.2]].map(([x, z], i) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = i * 1.3; g.visible = false; scene.add(g);
    const c = crate(.55, undefined); c.position.y = .275; g.add(c); mesh(new THREE.BoxGeometry(.58, .07, .58), glowMat(OR, 1.5), 0, .3, 0, g).castShadow = false; mesh(new THREE.BoxGeometry(.2, .16, .04), M('#D9A43A', .4, .7), 0, .34, .29, g);
    return { x, z, g }; });

  W.prom = { ring: { x: RX, z: RZ0, r: RS }, fighters, stash, crowd, gatePark: { x: -11.9, z: 9.5, chain: gatePark.chain }, gateClub: { x: 12.2, z: 1.4, chain: gateClub.chain } };
}
