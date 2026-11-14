// «Город» в 3D — первая сцена (owner 14.11.2026: референс — объёмный вид сверху, тёплый свет фонарей, скупая палитра).
// Только картинка и прогулка: двор вечером, круг би-боев, фонари, ящики, разметка. Механики переносим потом, по одной.
// Всё строится кодом: модели из простых форм, текстуры рисуются на canvas. Одежда героя — из hero.js (HERO.topDown).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const OR = '#E2611A';
const Q = new URLSearchParams(location.search);
const TOUCH = matchMedia('(pointer: coarse)').matches;
const $ = s => document.querySelector(s);

// ---------- small helpers ----------
function rng(seed) { let a = seed >>> 0 || 1; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const can = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => t * t * (3 - 2 * t);
let renderer, maxAniso = 4;
function tex(c, o = {}) {
  const t = new THREE.CanvasTexture(c);
  if (o.color !== false) t.colorSpace = THREE.SRGBColorSpace;
  if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(o.repeat[0], o.repeat[1]); }
  t.anisotropy = maxAniso;
  return t;
}
// fine grain over a canvas (per pixel), amp in 0..255
function grain(c, amp, seed) {
  const x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height), p = d.data, r = rng(seed);
  for (let i = 0; i < p.length; i += 4) { const n = (r() - .5) * amp; p[i] += n; p[i + 1] += n; p[i + 2] += n; }
  x.putImageData(d, 0, 0);
}
// soft blotches = low-frequency variation
function blotch(x, w, h, n, col, rmin, rmax, a, r) {
  for (let i = 0; i < n; i++) {
    const cx = r() * w, cy = r() * h, rr = rmin + r() * (rmax - rmin), g = x.createRadialGradient(cx, cy, 0, cx, cy, rr);
    g.addColorStop(0, col.replace('A', (a * (.4 + r() * .6)).toFixed(3))); g.addColorStop(1, col.replace('A', '0'));
    x.fillStyle = g; x.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
  }
}
// worn paint: rubs holes into what is drawn
function wear(x, w, h, k, r) {
  x.save(); x.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 900 * k; i++) { x.globalAlpha = .25 + r() * .75; const s = 1 + r() * r() * 9 * Math.max(1, w / 900); x.beginPath(); x.ellipse(r() * w, r() * h, s * (1 + r() * 2), s, r() * 3, 0, 7); x.fill(); }
  x.lineCap = 'round';
  for (let i = 0; i < 70 * k; i++) { x.globalAlpha = .3 + r() * .5; x.lineWidth = 1 + r() * 3; const px = r() * w, py = r() * h, a = (r() - .5) * .5 + (r() < .5 ? 0 : Math.PI / 2), l = 20 + r() * 120; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke(); }
  x.restore();
}

// ---------- materials ----------
const matCache = new Map();
function M(color, rough = .8, metal = 0, ex) {
  const k = color + '|' + rough + '|' + metal + (ex ? JSON.stringify(Object.keys(ex)) + Math.random() : '');
  if (!ex && matCache.has(k)) return matCache.get(k);
  const m = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: rough, metalness: metal }, ex || {}));
  if (!ex) matCache.set(k, m);
  return m;
}
const glowMat = (col, k = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k), toneMapped: false });

// ---------- textures ----------
function concreteTex() {
  const S = 1024, c = can(S, S), x = c.getContext('2d'), r = rng(11);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { const l = 15 + r() * 3.5; x.fillStyle = `hsl(${212 + r() * 10},${9 + r() * 5}%,${l}%)`; x.fillRect(i * 512, j * 512, 512, 512); }
  blotch(x, S, S, 70, 'rgba(0,0,0,A)', 30, 160, .22, r);
  blotch(x, S, S, 40, 'rgba(120,130,150,A)', 20, 120, .07, r);
  blotch(x, S, S, 14, 'rgba(40,25,15,A)', 40, 140, .18, r);         // rusty / oily stains
  grain(c, 22, 5);
  // aggregate specks
  for (let i = 0; i < 2600; i++) { x.fillStyle = r() < .5 ? 'rgba(0,0,0,.35)' : 'rgba(200,205,215,.12)'; x.fillRect(r() * S, r() * S, 1 + r() * 2, 1 + r() * 2); }
  // cracks
  x.strokeStyle = 'rgba(5,6,9,.75)'; x.lineCap = 'round';
  for (let i = 0; i < 9; i++) { let px = r() * S, py = r() * S, a = r() * 7; x.lineWidth = .8 + r() * 1.4; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 14; k++) { a += (r() - .5) * 1.1; px += Math.cos(a) * 9; py += Math.sin(a) * 9; x.lineTo(px, py); } x.stroke(); }
  // slab seams
  [0, 512].forEach(p => {
    x.fillStyle = 'rgba(0,0,0,.75)'; x.fillRect(p - 3, 0, 5, S); x.fillRect(0, p - 3, S, 5);
    x.fillStyle = 'rgba(160,170,190,.13)'; x.fillRect(p + 2, 0, 1.5, S); x.fillRect(0, p + 2, S, 1.5);
  });
  const rc = can(256, 256), rx = rc.getContext('2d'), r2 = rng(12);
  rx.fillStyle = '#d0d0d0'; rx.fillRect(0, 0, 256, 256); blotch(rx, 256, 256, 20, 'rgba(60,60,60,A)', 10, 40, .5, r2);
  [0, 128].forEach(p => { rx.fillStyle = '#fff'; rx.fillRect(p - 1, 0, 2, 256); rx.fillRect(0, p - 1, 256, 2); });
  return { map: tex(c, { repeat: [1, 1] }), rough: tex(rc, { color: false, repeat: [1, 1] }), bump: tex(c, { color: false, repeat: [1, 1] }) };
}
function asphaltTex() {
  const S = 512, c = can(S, S), x = c.getContext('2d'), r = rng(31);
  x.fillStyle = '#16181d'; x.fillRect(0, 0, S, S); blotch(x, S, S, 40, 'rgba(0,0,0,A)', 20, 90, .3, r); grain(c, 28, 9);
  for (let i = 0; i < 3000; i++) { x.fillStyle = `rgba(${150 + r() * 60},${150 + r() * 60},${160 + r() * 60},${.05 + r() * .12})`; x.fillRect(r() * S, r() * S, 1.5, 1.5); }
  return tex(c, { repeat: [1, 1] });
}
function woodFaceTex(tone) {
  const S = 512, c = can(S, S), x = c.getContext('2d'), r = rng(tone === 'dark' ? 41 : 42);
  const base = tone === 'dark' ? [96, 70, 50] : [196, 104, 48];
  const col = (k, a = 1) => `rgba(${base[0] * k | 0},${base[1] * k | 0},${base[2] * k | 0},${a})`;
  x.fillStyle = col(1); x.fillRect(0, 0, S, S);
  // planks
  const n = 5;
  for (let i = 0; i < n; i++) {
    const y0 = i * S / n; x.fillStyle = col(.86 + r() * .22); x.fillRect(0, y0, S, S / n);
    for (let k = 0; k < 26; k++) { x.strokeStyle = col(.7 + r() * .2, .35); x.lineWidth = .6 + r() * 1.4; x.beginPath(); const yy = y0 + r() * S / n; x.moveTo(0, yy); x.bezierCurveTo(S * .3, yy + (r() - .5) * 8, S * .6, yy + (r() - .5) * 8, S, yy + (r() - .5) * 6); x.stroke(); }
    x.fillStyle = 'rgba(25,12,5,.75)'; x.fillRect(0, y0, S, 3);
  }
  grain(c, 16, tone === 'dark' ? 3 : 4);
  // frame
  const fw = 58; x.fillStyle = col(.78); x.fillRect(0, 0, S, fw); x.fillRect(0, S - fw, S, fw); x.fillRect(0, 0, fw, S); x.fillRect(S - fw, 0, fw, S);
  x.strokeStyle = 'rgba(20,10,4,.7)'; x.lineWidth = 4; x.strokeRect(fw, fw, S - fw * 2, S - fw * 2); x.strokeRect(2, 2, S - 4, S - 4);
  x.fillStyle = 'rgba(255,220,170,.18)'; x.fillRect(fw + 3, fw + 3, S - fw * 2 - 6, 3);
  // diagonal brace
  x.save(); x.translate(S / 2, S / 2); x.rotate(-Math.PI / 4); const bl = S * 1.1;
  x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(-bl / 2, -fw / 2 + 6, bl, fw); x.fillStyle = col(.95); x.fillRect(-bl / 2, -fw / 2, bl, fw);
  x.fillStyle = 'rgba(255,225,180,.2)'; x.fillRect(-bl / 2, -fw / 2, bl, 4); x.restore();
  x.fillStyle = col(.78); x.fillRect(0, 0, S, fw); x.fillRect(0, S - fw, S, fw);
  x.strokeStyle = 'rgba(20,10,4,.7)'; x.lineWidth = 4; x.beginPath(); x.moveTo(0, fw); x.lineTo(S, fw); x.moveTo(0, S - fw); x.lineTo(S, S - fw); x.stroke();
  // nails
  for (const [px, py] of [[fw / 2, fw / 2], [S - fw / 2, fw / 2], [fw / 2, S - fw / 2], [S - fw / 2, S - fw / 2], [S / 2, fw / 2], [S / 2, S - fw / 2]]) { x.fillStyle = '#2a2622'; x.beginPath(); x.arc(px, py, 5, 0, 7); x.fill(); x.fillStyle = 'rgba(255,255,255,.25)'; x.beginPath(); x.arc(px - 1.5, py - 1.5, 2, 0, 7); x.fill(); }
  // grime toward edges
  const g = x.createRadialGradient(S / 2, S / 2, S * .25, S / 2, S / 2, S * .75); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(20,10,5,.45)'); x.fillStyle = g; x.fillRect(0, 0, S, S);
  blotch(x, S, S, 10, 'rgba(30,18,10,A)', 20, 70, .3, r);
  return { map: tex(c), bump: tex(c, { color: false }) };
}
function barrelTex(kind) {
  const W = 512, H = 256, c = can(W, H), x = c.getContext('2d'), r = rng(kind === 'o' ? 51 : 52);
  x.fillStyle = kind === 'o' ? '#9a4a1e' : '#232a31'; x.fillRect(0, 0, W, H);
  grain(c, 14, 7);
  // rust patches
  blotch(x, W, H, kind === 'o' ? 26 : 34, 'rgba(150,70,28,A)', 6, 34, kind === 'o' ? .5 : .7, r);
  blotch(x, W, H, 16, 'rgba(60,25,10,A)', 4, 20, .6, r);
  // ribs
  [H * .3, H * .7].forEach(y => { x.fillStyle = 'rgba(0,0,0,.5)'; x.fillRect(0, y + 4, W, 3); x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(0, y - 4, W, 3); });
  // drips
  for (let i = 0; i < 14; i++) { const px = r() * W, l = 15 + r() * 70; const g = x.createLinearGradient(0, 0, 0, l); g.addColorStop(0, 'rgba(120,52,18,.75)'); g.addColorStop(1, 'rgba(120,52,18,0)'); x.fillStyle = g; x.fillRect(px, 0, 2 + r() * 4, l); }
  if (kind !== 'o') { x.fillStyle = 'rgba(226,97,26,.85)'; x.fillRect(0, H * .44, W, H * .12); wear(x, W, H, .15, r); x.fillStyle = 'rgba(35,42,49,0)'; }
  const lid = can(256, 256), l = lid.getContext('2d'); l.fillStyle = kind === 'o' ? '#8e4520' : '#2a3138'; l.beginPath(); l.arc(128, 128, 128, 0, 7); l.fill();
  blotch(l, 256, 256, 18, 'rgba(160,72,26,A)', 8, 40, .7, r);
  l.strokeStyle = 'rgba(0,0,0,.55)'; l.lineWidth = 6; l.beginPath(); l.arc(128, 128, 112, 0, 7); l.stroke(); l.strokeStyle = 'rgba(255,255,255,.12)'; l.lineWidth = 2; l.beginPath(); l.arc(128, 128, 104, 0, 7); l.stroke();
  l.fillStyle = '#15191d'; l.beginPath(); l.arc(80, 90, 11, 0, 7); l.fill();
  return { map: tex(c), lid: tex(lid) };
}
function stripeTex(w = 256, h = 64, a = OR, b = '#15161a') {
  const c = can(w, h), x = c.getContext('2d'), r = rng(61); x.fillStyle = b; x.fillRect(0, 0, w, h);
  x.fillStyle = a; for (let i = -h; i < w + h; i += 48) { x.beginPath(); x.moveTo(i, h); x.lineTo(i + 24, h); x.lineTo(i + 24 + h, 0); x.lineTo(i + h, 0); x.fill(); }
  grain(c, 18, 2); wear(x, w, h, .1, r);
  x.globalCompositeOperation = 'destination-over'; x.fillStyle = b; x.fillRect(0, 0, w, h);
  return tex(c);
}
function kraftTex() {
  const W = 256, H = 384, c = can(W, H), x = c.getContext('2d'), r = rng(71);
  x.fillStyle = '#a77b4b'; x.fillRect(0, 0, W, H); grain(c, 20, 3);
  blotch(x, W, H, 16, 'rgba(70,45,22,A)', 10, 60, .35, r);
  for (let i = 0; i < 18; i++) { x.fillStyle = 'rgba(60,40,20,.25)'; x.fillRect(0, r() * H, W, 1); }
  x.fillStyle = 'rgba(222,190,140,.65)'; x.fillRect(W / 2 - 18, 0, 36, H);     // tape
  x.fillStyle = 'rgba(20,20,20,.65)'; x.font = '900 26px Inter, sans-serif'; x.textAlign = 'center'; x.fillText('THIS SIDE UP', W / 2, H * .3);
  x.beginPath(); x.moveTo(W / 2, H * .36); x.lineTo(W / 2 - 22, H * .43); x.lineTo(W / 2 + 22, H * .43); x.fill(); x.fillRect(W / 2 - 7, H * .43, 14, 30);
  wear(x, W, H, .08, r); x.globalCompositeOperation = 'destination-over'; x.fillStyle = '#a07445'; x.fillRect(0, 0, W, H);
  return tex(c);
}
function chainTex() {
  const S = 128, c = can(S, S), x = c.getContext('2d');
  x.strokeStyle = 'rgba(190,198,210,1)'; x.lineWidth = 5;
  x.beginPath(); x.moveTo(0, S / 2); x.lineTo(S / 2, 0); x.lineTo(S, S / 2); x.lineTo(S / 2, S); x.closePath(); x.stroke();
  x.beginPath(); x.moveTo(-S / 2, 0); x.lineTo(0, -S / 2); x.stroke(); x.beginPath(); x.moveTo(S / 2, S); x.lineTo(S, S * 1.5); x.stroke();
  const t = tex(c, { repeat: [1, 1] }); return t;
}
function facadeTex(w, h, opt) {
  // w × h metres, 48 px per metre
  const P = 48, W = Math.round(w * P), H = Math.round(h * P), c = can(W, H), x = c.getContext('2d'), e = can(W, H), ex = e.getContext('2d'), r = rng(opt.seed);
  x.fillStyle = opt.col; x.fillRect(0, 0, W, H);
  // panels / bricks
  if (opt.brick) { for (let y = 0; y < H; y += 10) for (let xx = (y / 10 % 2) * 14; xx < W; xx += 28) { x.fillStyle = `rgba(0,0,0,${.05 + r() * .18})`; x.fillRect(xx, y, 26, 8); } x.fillStyle = 'rgba(0,0,0,.25)'; for (let y = 8; y < H; y += 10) x.fillRect(0, y, W, 2); }
  else { x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 2; for (let xx = 0; xx < W; xx += P * 3) { x.beginPath(); x.moveTo(xx, 0); x.lineTo(xx, H); x.stroke(); } for (let y = 0; y < H; y += P * 3) { x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke(); } }
  grain(c, 16, opt.seed);
  blotch(x, W, H, 30, 'rgba(0,0,0,A)', 20, 120, .3, r);
  // rain streaks
  for (let i = 0; i < 60; i++) { const px = r() * W, l = 30 + r() * 140, g = x.createLinearGradient(0, 0, 0, l); g.addColorStop(0, 'rgba(0,0,0,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(px, r() * H * .5, 2 + r() * 5, l); }
  ex.fillStyle = '#000'; ex.fillRect(0, 0, W, H);
  // windows: floors from the top, the ground floor is the wall for graffiti / doors
  const fl = opt.floors, fh = H / (fl + .9), ww = P * 1.25, wh = fh * .5, gap = P * 3;
  for (let f = 0; f < fl; f++) for (let xx = gap * .5; xx + ww < W; xx += gap) {
    const y = fh * .25 + f * fh, lit = r() < opt.lit, warm = r() < .75;
    x.fillStyle = '#0a0c10'; x.fillRect(xx - 4, y - 4, ww + 8, wh + 8);
    const gg = x.createLinearGradient(0, y, 0, y + wh); gg.addColorStop(0, '#1d232c'); gg.addColorStop(1, '#0f1318'); x.fillStyle = gg; x.fillRect(xx, y, ww, wh);
    x.fillStyle = 'rgba(160,175,195,.25)'; x.fillRect(xx + ww / 2 - 1, y, 2, wh);
    x.fillStyle = 'rgba(120,128,140,.6)'; x.fillRect(xx - 6, y + wh + 2, ww + 12, 5);     // sill
    if (lit) {
      const col = warm ? [255, 178, 96] : [150, 200, 255], k = .5 + r() * .5;
      const g2 = ex.createLinearGradient(0, y, 0, y + wh); g2.addColorStop(0, `rgba(${col.join(',')},${k})`); g2.addColorStop(1, `rgba(${col.map(v => v * .6 | 0).join(',')},${k})`);
      ex.fillStyle = g2; ex.fillRect(xx, y, ww, wh); ex.fillStyle = 'rgba(0,0,0,.85)'; ex.fillRect(xx + ww / 2 - 1, y, 2, wh);
      if (r() < .5) { ex.fillStyle = 'rgba(0,0,0,.6)'; ex.fillRect(xx, y, ww * (.3 + r() * .4), wh); }   // curtain
      x.fillStyle = `rgba(${col.join(',')},.5)`; x.fillRect(xx, y, ww, wh);
    }
  }
  return { map: tex(c), emi: tex(e) };
}
function roofTex(w, d, seed) {
  const P = 40, W = Math.round(w * P), H = Math.round(d * P), c = can(W, H), x = c.getContext('2d'), r = rng(seed);
  x.fillStyle = '#23262c'; x.fillRect(0, 0, W, H); grain(c, 26, seed);
  blotch(x, W, H, 50, 'rgba(0,0,0,A)', 20, 100, .35, r); blotch(x, W, H, 20, 'rgba(90,95,105,A)', 20, 80, .12, r);
  x.strokeStyle = 'rgba(0,0,0,.4)'; x.lineWidth = 2; for (let i = 0; i < W; i += P * 1.2) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, H); x.stroke(); }
  // parapet
  x.fillStyle = '#4a4d54'; x.fillRect(0, 0, W, 10); x.fillRect(0, H - 10, W, 10); x.fillRect(0, 0, 10, H); x.fillRect(W - 10, 0, 10, H);
  x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(10, 10, W - 20, 6); x.fillRect(10, 10, 6, H - 20);
  return tex(c);
}
function corrugTex(w, d) {
  const P = 40, W = Math.round(w * P), H = Math.round(d * P), c = can(W, H), x = c.getContext('2d'), r = rng(81);
  x.fillStyle = '#3d4249'; x.fillRect(0, 0, W, H);
  for (let i = 0; i < H; i += 8) { x.fillStyle = 'rgba(255,255,255,.08)'; x.fillRect(0, i, W, 3); x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, i + 4, W, 3); }
  blotch(x, W, H, 40, 'rgba(140,70,30,A)', 10, 60, .45, r); grain(c, 18, 8);
  for (let i = 0; i < W; i += P * 4) { x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect(i, 0, 4, H); }
  return tex(c);
}

// ---------- decals on the ground ----------
let decalN = 0;
function decal(scene, c, w, h, x, z, rot = 0, o = {}) {
  const m = new THREE.MeshStandardMaterial({ map: tex(c), transparent: true, depthWrite: false, roughness: o.rough ?? .9, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2 - (decalN % 6), polygonOffsetUnits: -2, opacity: o.op ?? 1 });
  if (o.dark) m.color.setScalar(o.dark);
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  p.rotation.x = -Math.PI / 2; p.rotation.z = rot; p.position.set(x, .004 + (decalN++ % 6) * .0015, z); p.receiveShadow = true; p.renderOrder = 1;
  scene.add(p); return p;
}
function paintCanvas(w, h, fn, k, seed) { const c = can(w, h), x = c.getContext('2d'), r = rng(seed); fn(x, w, h, r); if (k) wear(x, w, h, k, r); return c; }
const PAINT_Y = '#D9A43A', PAINT_W = '#C9CDD2';

// ---------- props ----------
let WOOD, WOOD_D, BARREL_K, BARREL_O, STRIPES, KRAFT, CHAIN;
const shadowAll = o => { o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };
const colliders = [];   // {x0,x1,z0,z1} or {x,z,r}
const box = (x, z, w, d) => colliders.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
const circ = (x, z, r) => colliders.push({ x, z, r });

function crate(s, wood = WOOD) {
  const mat = new THREE.MeshStandardMaterial({ map: wood.map, bumpMap: wood.bump, bumpScale: 2.2, roughness: .82 });
  return shadowAll(new THREE.Mesh(new RoundedBoxGeometry(s, s, s, 2, s * .035), mat));
}
function barrel(k = BARREL_K) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(.36, .36, .95, 22, 1, true), new THREE.MeshStandardMaterial({ map: k.map, roughness: .55, metalness: .55 }));
  body.position.y = .475; g.add(body);
  const lid = new THREE.Mesh(new THREE.CircleGeometry(.36, 22), new THREE.MeshStandardMaterial({ map: k.lid, roughness: .5, metalness: .5 })); lid.rotation.x = -Math.PI / 2; lid.position.y = .95; g.add(lid);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(.355, .022, 6, 24), M('#2c3136', .45, .7)); rim.rotation.x = Math.PI / 2; rim.position.y = .95; g.add(rim);
  [.3, .64].forEach(y => { const t = new THREE.Mesh(new THREE.TorusGeometry(.362, .016, 5, 24), M('#2a2f34', .5, .6)); t.rotation.x = Math.PI / 2; t.position.y = y; g.add(t); });
  return shadowAll(g);
}
function pallet() {
  const g = new THREE.Group(), m = M('#7a6047', .9);
  for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.2, .025, .14), m); b.position.set(0, .13, -.4 + i * .2); g.add(b); }
  for (let i = -1; i <= 1; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(.1, .1, 1), M('#6a523c', .9)); b.position.set(i * .52, .06, 0); g.add(b); }
  return shadowAll(g);
}
function tires(n) {
  const g = new THREE.Group(), m = M('#141518', .75);
  for (let i = 0; i < n; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(.32, .13, 8, 18), m); t.rotation.x = Math.PI / 2; t.position.set((Math.random() - .5) * .06, .13 + i * .25, (Math.random() - .5) * .06); g.add(t); }
  return shadowAll(g);
}
function woodFence(len) {
  const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ map: WOOD_D.map, roughness: .9 }), r = rng(len * 7);
  [-len / 2 + .1, len / 2 - .1].forEach(x => { const p = new THREE.Mesh(new THREE.BoxGeometry(.14, 1.3, .14), m); p.position.set(x, .65, 0); g.add(p); });
  [.35, 1.0].forEach(y => { const b = new THREE.Mesh(new THREE.BoxGeometry(len, .12, .07), m); b.position.set(0, y, .08); g.add(b); });
  for (let x = -len / 2 + .3; x < len / 2 - .2; x += .26) {
    if (r() < .1) continue;
    const h = 1.05 + r() * .25, s = new THREE.Mesh(new THREE.BoxGeometry(.19, h, .04), m);
    s.position.set(x, h / 2 + .05, .13); s.rotation.z = (r() - .5) * .08; g.add(s);
  }
  return shadowAll(g);
}
function jersey(len) {
  const sh = new THREE.Shape(); sh.moveTo(-.3, 0); sh.lineTo(.3, 0); sh.lineTo(.3, .08); sh.lineTo(.13, .28); sh.lineTo(.1, .8); sh.lineTo(-.1, .8); sh.lineTo(-.13, .28); sh.lineTo(-.3, .08); sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: len, bevelEnabled: true, bevelThickness: .02, bevelSize: .02, bevelSegments: 1 }); geo.translate(0, 0, -len / 2); geo.rotateY(Math.PI / 2);
  const g = new THREE.Group(); g.add(new THREE.Mesh(geo, M('#6f7275', .92)));
  const band = new THREE.Mesh(new THREE.BoxGeometry(len * .9, .16, .23), new THREE.MeshStandardMaterial({ map: STRIPES, roughness: .7 })); band.position.y = .62; g.add(band);
  return shadowAll(g);
}
function dumpster() {
  const g = new THREE.Group(), r = rng(91);
  const c = can(256, 128), x = c.getContext('2d'); x.fillStyle = '#26443a'; x.fillRect(0, 0, 256, 128); grain(c, 16, 3); blotch(x, 256, 128, 26, 'rgba(140,70,30,A)', 6, 30, .6, r); x.fillStyle = 'rgba(0,0,0,.3)'; for (let i = 16; i < 256; i += 32) x.fillRect(i, 0, 4, 128);
  const m = new THREE.MeshStandardMaterial({ map: tex(c), roughness: .6, metalness: .35 });
  const b = new THREE.Mesh(new RoundedBoxGeometry(1.9, 1.15, 1.15, 2, .05), m); b.position.y = .68; g.add(b);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.95, .05, 1.2), M('#1b2c26', .5, .3)); lid.position.set(0, 1.29, -.05); lid.rotation.x = -.18; g.add(lid);
  [-.8, .8].forEach(xx => [-.45, .45].forEach(zz => { const w = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, .06, 10), M('#111', .7)); w.rotation.z = Math.PI / 2; w.position.set(xx, .08, zz); g.add(w); }));
  return shadowAll(g);
}
function trashBag(s) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(.32 * s, 1), M('#0f1114', .3, .1)); m.scale.set(1, .75, 1.1); m.position.y = .2 * s; m.rotation.y = Math.random() * 6; return shadowAll(m); }
function cardboard(w = 1.1, d = 1.6) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, .02, d), new THREE.MeshStandardMaterial({ map: KRAFT, roughness: .95 })); m.position.y = .011; m.receiveShadow = true; return m; }
function chainFence(len, h = 2.2) {
  const g = new THREE.Group(), post = M('#5b626b', .45, .7);
  const t = CHAIN.clone(); t.needsUpdate = true; t.repeat.set(len / .16, h / .16);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(len, h), new THREE.MeshStandardMaterial({ map: t, alphaMap: t, transparent: false, alphaTest: .45, side: THREE.DoubleSide, roughness: .45, metalness: .6, color: '#9aa3ad' }));
  mesh.position.y = h / 2 + .05; g.add(mesh);
  for (let x = -len / 2; x <= len / 2 + .01; x += 2.5) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, h + .15, 8), post); p.position.set(x, (h + .15) / 2, 0); g.add(p); }
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, len, 6), post); rail.rotation.z = Math.PI / 2; rail.position.y = h + .1; g.add(rail);
  return shadowAll(g);
}
function car(col) {
  const g = new THREE.Group(), body = M(col, .35, .5), dark = M('#0c0e12', .3, .2), glass = M('#1a2230', .12, .6);
  const b = new THREE.Mesh(new RoundedBoxGeometry(1.8, .6, 4.1, 3, .18), body); b.position.y = .55; g.add(b);
  const cab = new THREE.Mesh(new RoundedBoxGeometry(1.55, .5, 2.1, 3, .16), glass); cab.position.set(0, 1.03, -.15); g.add(cab);
  const roof = new THREE.Mesh(new RoundedBoxGeometry(1.5, .08, 1.7, 2, .04), body); roof.position.set(0, 1.29, -.2); g.add(roof);
  [[-.85, 1.3], [.85, 1.3], [-.85, -1.3], [.85, -1.3]].forEach(([x, z]) => { const w = new THREE.Mesh(new THREE.CylinderGeometry(.34, .34, .25, 16), dark); w.rotation.z = Math.PI / 2; w.position.set(x, .34, z); g.add(w); });
  [-.6, .6].forEach(x => { const l = new THREE.Mesh(new THREE.BoxGeometry(.32, .1, .04), glowMat('#ff2a1a', 1.4)); l.position.set(x, .7, -2.06); g.add(l); });
  [-.6, .6].forEach(x => { const l = new THREE.Mesh(new THREE.BoxGeometry(.32, .1, .04), M('#cfd6dd', .2, .3)); l.position.set(x, .7, 2.06); g.add(l); });
  return shadowAll(g);
}
function hoop() {
  const g = new THREE.Group(), pm = M('#3a3f46', .5, .6);
  const p = new THREE.Mesh(new THREE.CylinderGeometry(.07, .09, 3.2, 10), pm); p.position.y = 1.6; g.add(p);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(.08, .08, .7), pm); arm.position.set(0, 3.0, .35); g.add(arm);
  const c = can(256, 160), x = c.getContext('2d'); x.fillStyle = '#d8d8d4'; x.fillRect(0, 0, 256, 160); x.strokeStyle = OR; x.lineWidth = 10; x.strokeRect(10, 10, 236, 140); x.strokeRect(88, 70, 80, 60); wear(x, 256, 160, .2, rng(3)); x.globalCompositeOperation = 'destination-over'; x.fillStyle = '#9a9a96'; x.fillRect(0, 0, 256, 160);
  const bb = new THREE.Mesh(new THREE.BoxGeometry(1.5, .95, .05), new THREE.MeshStandardMaterial({ map: tex(c), roughness: .6 })); bb.position.set(0, 3.25, .72); g.add(bb);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.23, .02, 6, 20), M(OR, .4, .5)); ring.rotation.x = Math.PI / 2; ring.position.set(0, 2.95, .98); g.add(ring);
  return shadowAll(g);
}
function speakers() {
  const g = new THREE.Group(), cab = M('#141519', .7), cones = [];
  [[0, .45, .9], [0, 1.15, .5]].forEach(([y, h0, w]) => {
    const b = new THREE.Mesh(new RoundedBoxGeometry(w, h0 * 1.0 + .2, .5, 2, .03), cab); b.position.y = y + (y ? .12 : 0); g.add(b);
  });
  const mk = (y, r) => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(r * .78, r, 24), glowMat(OR, 1.6)); ring.position.set(0, y, .252); g.add(ring);
    const cone = new THREE.Mesh(new THREE.CircleGeometry(r * .78, 24), M('#08090b', .4, .2)); cone.position.set(0, y, .251); g.add(cone);
    const dust = new THREE.Mesh(new THREE.CircleGeometry(r * .2, 16), M('#202227', .3, .4)); dust.position.set(0, y, .256); g.add(dust);
    cones.push({ ring, cone, base: y });
  };
  mk(.42, .3); mk(1.26, .16);
  g.userData.cones = cones;
  return shadowAll(g);
}
function boombox() {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new RoundedBoxGeometry(.7, .36, .2, 2, .03), M('#1d1f24', .45, .3)); b.position.y = .18; g.add(b);
  [-.2, .2].forEach(x => { const c = new THREE.Mesh(new THREE.CircleGeometry(.11, 18), M('#0a0b0d', .3, .3)); c.position.set(x, .18, .101); g.add(c); const r = new THREE.Mesh(new THREE.RingGeometry(.1, .12, 18), M('#c9ced6', .25, .8)); r.position.set(x, .18, .102); g.add(r); });
  const h = new THREE.Mesh(new THREE.TorusGeometry(.2, .018, 5, 14, Math.PI), M('#c9ced6', .25, .8)); h.position.y = .36; g.add(h);
  const led = new THREE.Mesh(new THREE.BoxGeometry(.12, .04, .01), glowMat('#47ff9a', 1.2)); led.position.set(0, .26, .102); g.add(led);
  return shadowAll(g);
}

// ---------- lamps ----------
const lamps = [];
function lamp(scene, x, z, rotY, o = {}) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY;
  const base = new THREE.Mesh(new RoundedBoxGeometry(.55, .28, .55, 2, .03), new THREE.MeshStandardMaterial({ map: STRIPES, roughness: .7 })); base.position.y = .14; g.add(base);
  const pm = M('#2e333a', .45, .7);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.06, .08, 3.9, 10), pm); pole.position.y = 2.1; g.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(.06, .06, 1.1), pm); arm.position.set(0, 3.95, .45); g.add(arm);
  const heads = o.double ? [[-.0, .0], [0, .9]] : [[0, .9]];
  heads.forEach(([hx, hz], i) => {
    const hd = new THREE.Mesh(new RoundedBoxGeometry(.5, .14, .3, 2, .03), M('#25292f', .5, .5)); hd.position.set(hx, 3.92 + (o.double && !i ? .02 : 0), hz); g.add(hd);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(.42, .02, .2), glowMat('#ffb15c', 3.2)); strip.position.set(hx, 3.84, hz); g.add(strip);
  });
  shadowAll(g); scene.add(g);
  const head = new THREE.Vector3(0, 3.82, .9).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY).add(g.position);
  const s = new THREE.SpotLight('#ffb36b', (o.power ?? 95) * 2.6, 0, o.angle ?? .95, .75, 2);
  s.position.copy(head); s.target.position.set(head.x, 0, head.z + (o.lean ?? 0)); scene.add(s, s.target);
  if (o.shadow) { s.castShadow = true; s.shadow.mapSize.set(TOUCH ? 1024 : 2048, TOUCH ? 1024 : 2048); s.shadow.bias = -.0004; s.shadow.normalBias = .02; s.shadow.radius = 3; s.shadow.camera.near = .5; s.shadow.camera.far = 9; }
  // visible light cone (cheap fake volume)
  const h = head.y, rad = Math.tan((o.angle ?? .95) * .78) * h;
  const cg = new THREE.ConeGeometry(rad, h, 28, 1, true); cg.translate(0, -h / 2, 0);
  const cone = new THREE.Mesh(cg, coneMat()); cone.position.copy(head); cone.renderOrder = 5; scene.add(cone);
  lamps.push({ head, light: s, cone, flick: o.flicker ? 1 : 0, base: s.intensity });
  box(x, z, .6, .6);
  return g;
}
function coneMat() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
    uniforms: { uCol: { value: new THREE.Color('#ffae5e') }, uK: { value: .085 } },
    vertexShader: 'varying float vH; varying vec3 vN; varying vec3 vV; void main(){ vH = -position.y; vec4 wp = modelMatrix * vec4(position,1.); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }',
    fragmentShader: 'uniform vec3 uCol; uniform float uK; varying float vH; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(abs(dot(vN, vV)), 2.2); float h = clamp(vH / 3.8, 0., 1.); float a = uK * f * (1. - h * .75) * smoothstep(0., .12, h) * smoothstep(1.02, .7, h); gl_FragColor = vec4(uCol * a, a); }',
  });
}
// floating dust in the light
const motes = [];
function dust(scene, head, n = 70) {
  const pos = new Float32Array(n * 3), seed = [];
  for (let i = 0; i < n; i++) { const a = Math.random() * 7, rr = Math.sqrt(Math.random()) * 1.6, y = .3 + Math.random() * 3.2; pos.set([head.x + Math.cos(a) * rr * (y / 3.5 + .2), y, head.z + Math.sin(a) * rr * (y / 3.5 + .2)], i * 3); seed.push(Math.random() * 100); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ map: dotTex(), color: '#ffcf98', size: .045, transparent: true, opacity: .8, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
  scene.add(p); motes.push({ p, head, seed, base: pos.slice() });
}
let _dot;
function dotTex() { if (_dot) return _dot; const c = can(32, 32), x = c.getContext('2d'), g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.4, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); return (_dot = tex(c)); }

// ---------- people ----------
const capsule = (r, l, m) => new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 3, 8), m);
function person(look) {
  const C = look.col, skin = M(C.skin, .7), topM = M(C.top, .78), pantsM = M(C.pants, .85), shoeM = M(C.shoe, .5), soleM = M(C.sole, .6), shoe2M = M(C.shoe2 || C.shoe, .5);
  const root = new THREE.Group(), tilt = new THREE.Group(); tilt.position.y = .92; root.add(tilt);
  const J = { root, tilt };
  const pel = new THREE.Mesh(new RoundedBoxGeometry(.38, .2, .24, 2, .06), pantsM); pel.position.y = .03; tilt.add(pel);
  const sp = new THREE.Group(); sp.position.y = .1; tilt.add(sp); J.sp = sp;
  const torso = new THREE.Mesh(new RoundedBoxGeometry(.46, .55, .27, 2, .09), topM); torso.position.y = .27; sp.add(torso);
  if (C.yoke) { const y = new THREE.Mesh(new RoundedBoxGeometry(.48, .2, .29, 2, .08), M(C.yoke, .78)); y.position.y = .45; sp.add(y); }
  if (C.trim) { const z = new THREE.Mesh(new THREE.BoxGeometry(.03, .5, .02), M(C.trim, .6)); z.position.set(0, .27, .137); sp.add(z); }
  if (look.top === 'teeTeam') { const d = new THREE.Mesh(new THREE.CircleGeometry(.09, 18), M(OR, .7)); d.position.set(0, .34, .137); sp.add(d); }
  if (look.chain) { const ch = new THREE.Mesh(new THREE.TorusGeometry(.13, look.chain > 1 ? .022 : .013, 6, 20), M(C.gold, .25, 1)); ch.rotation.x = Math.PI / 2 - .5; ch.position.set(0, .5, .06); sp.add(ch); }
  const neck = new THREE.Group(); neck.position.y = .56; sp.add(neck); J.hd = neck;
  const head = new THREE.Mesh(new THREE.SphereGeometry(.17, 18, 14), skin); head.scale.set(1, 1.08, 1); head.position.y = .16; neck.add(head);
  const hairM = M(C.hair, .9);
  const H = C.hat ? [M(C.hat[0], .7), M(C.hat[1], .7)] : null;
  if (look.hat === 'cap' || look.hat === 'capBack' || look.hat === 'capGold') {
    const cp = new THREE.Mesh(new THREE.SphereGeometry(.178, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), H[0]); cp.position.y = .19; neck.add(cp);
    const br = new THREE.Mesh(new RoundedBoxGeometry(.22, .025, .16, 1, .01), H[1]); br.position.set(0, .2, look.hat === 'capBack' ? -.2 : .2); neck.add(br);
  } else if (look.hat === 'beanie') {
    const cp = new THREE.Mesh(new THREE.SphereGeometry(.182, 18, 10, 0, Math.PI * 2, 0, Math.PI / 1.85), H[0]); cp.scale.y = 1.25; cp.position.y = .17; neck.add(cp);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(.185, .185, .06, 18, 1, true), H[1]); band.position.y = .18; neck.add(band);
  } else if (look.hat === 'bucket') {
    const cp = new THREE.Mesh(new THREE.CylinderGeometry(.15, .18, .14, 16), H[0]); cp.position.y = .3; neck.add(cp);
    const br = new THREE.Mesh(new THREE.CylinderGeometry(.19, .28, .05, 18), H[0]); br.position.y = .22; neck.add(br);
  } else if (look.hat === 'bandana') {
    const cp = new THREE.Mesh(new THREE.SphereGeometry(.18, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2.1), H[0]); cp.position.y = .18; neck.add(cp);
    const k = new THREE.Mesh(new THREE.BoxGeometry(.08, .05, .08), H[0]); k.position.set(0, .2, -.18); neck.add(k);
  } else {
    const hr = new THREE.Mesh(new THREE.SphereGeometry(.175, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2.4), hairM); hr.position.y = .18; neck.add(hr);
  }
  if (look.girl) {
    const back = new THREE.Mesh(new THREE.SphereGeometry(.17, 14, 10), hairM); back.scale.set(1, 1.15, .7); back.position.set(0, .11, -.08); neck.add(back);
    const braid = capsule(.045, .3, hairM); braid.position.set(.14, -.05, -.02); braid.rotation.z = .2; neck.add(braid);
    if (!look.hat) { const bun = new THREE.Mesh(new THREE.SphereGeometry(.07, 10, 8), hairM); bun.position.set(0, .34, -.04); neck.add(bun); }
  }
  if (look.phones) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(.19, .018, 5, 18, Math.PI), M('#1a1b1f', .5)); band.position.y = .16; band.rotation.z = 0; neck.add(band);
    [-1, 1].forEach(s => { const cup = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, .06, 14), M(OR, .5)); cup.rotation.z = Math.PI / 2; cup.position.set(s * .18, .15, 0); neck.add(cup); });
  }
  // nose → shows where the face is
  const nose = new THREE.Mesh(new THREE.SphereGeometry(.035, 8, 6), M(C.skin, .6)); nose.position.set(0, .14, .165); neck.add(nose);
  const sleeveM = C.sleeve ? M(C.sleeve, .78) : skin, handM = look.gloves ? M('#16171a', .6) : skin;
  const arm = s => {
    const sh = new THREE.Group(); sh.position.set(s * .29, .47, 0); sp.add(sh);
    const up = capsule(.068, .17, sleeveM); up.position.y = -.12; sh.add(up);
    if (!C.sleeve) { const st = new THREE.Mesh(new THREE.CylinderGeometry(.088, .082, .14, 10), topM); st.position.y = -.05; sh.add(st); }
    const el = new THREE.Group(); el.position.y = -.25; sh.add(el);
    const lo = capsule(.06, .15, sleeveM); lo.position.y = -.1; el.add(lo);
    if (C.cuff) { const cf = new THREE.Mesh(new THREE.CylinderGeometry(.066, .066, .05, 10), M(C.cuff, .7)); cf.position.y = -.2; el.add(cf); }
    if (look.wrist && s > 0) { const wb = new THREE.Mesh(new THREE.TorusGeometry(.058, .016, 5, 12), M(look.wrist, .3, .6)); wb.rotation.x = Math.PI / 2; wb.position.y = -.2; el.add(wb); }
    const hand = new THREE.Mesh(new THREE.SphereGeometry(.065, 10, 8), handM); hand.position.y = -.27; el.add(hand);
    return { sh, el, hand };
  };
  const leg = s => {
    const hp = new THREE.Group(); hp.position.set(s * .11, -.02, 0); tilt.add(hp);
    const th = capsule(.09, .26, pantsM); th.position.y = -.2; hp.add(th);
    const kn = new THREE.Group(); kn.position.y = -.42; hp.add(kn);
    const sh = capsule(.078, .26, pantsM); sh.position.y = -.19; kn.add(sh);
    if (C.stripe) [[th, -.2, hp], [sh, -.19, kn]].forEach(([_, y, par]) => { const st = new THREE.Mesh(new THREE.BoxGeometry(.012, .3, .04), M(C.stripe, .6)); st.position.set(s * .088, y, 0); par.add(st); });
    if (look.knee) { const kp = new THREE.Mesh(new RoundedBoxGeometry(.16, .14, .07, 1, .03), M('#18191c', .5)); kp.position.set(0, -.02, .08); kn.add(kp); }
    const an = new THREE.Group(); an.position.y = -.4; kn.add(an);
    const shoe = new THREE.Mesh(new RoundedBoxGeometry(.14, .11, .28, 2, .04), shoeM); shoe.position.set(0, -.03, .05); an.add(shoe);
    const toe = new THREE.Mesh(new RoundedBoxGeometry(.145, .06, .1, 1, .025), shoe2M); toe.position.set(0, -.05, .16); an.add(toe);
    const sole = new THREE.Mesh(new THREE.BoxGeometry(.15, .035, .29), soleM); sole.position.set(0, -.085, .05); an.add(sole);
    return { hp, kn, an };
  };
  J.L = arm(-1); J.R = arm(1); J.LL = leg(-1); J.RL = leg(1);
  shadowAll(root);
  // soft blob under the person (keeps them grounded even outside light)
  const blob = new THREE.Mesh(new THREE.CircleGeometry(.42, 20), new THREE.MeshBasicMaterial({ map: blobTex(), transparent: true, depthWrite: false, opacity: .55 }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = .012; blob.renderOrder = 2; root.add(blob); J.blob = blob;
  return J;
}
let _blob; function blobTex() { if (_blob) return _blob; const c = can(64, 64), x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 4, 32, 32, 32); g.addColorStop(0, 'rgba(0,0,0,.9)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return (_blob = tex(c)); }

// a pose = plain numbers, so two poses can be blended
const P0 = () => ({ y: 0, tx: 0, tz: 0, yaw: 0, sx: 0, sy: 0, sz: 0, hx: 0, hy: 0, hz: 0, Lf: 0, Lo: .08, Le: .2, Rf: 0, Ro: .08, Re: .2, LLf: 0, LLo: 0, LLk: 0, RLf: 0, RLo: 0, RLk: 0, La: 0, Ra: 0 });
function blend(a, b, t) { const o = {}; for (const k in a) o[k] = lerp(a[k], b[k], t); return o; }
function apply(J, p) {
  J.tilt.position.y = .92 + p.y; J.tilt.rotation.set(p.tx, p.yaw, p.tz, 'YXZ');
  J.sp.rotation.set(p.sx, p.sy, p.sz); J.hd.rotation.set(p.hx, p.hy, p.hz);
  J.L.sh.rotation.set(-p.Lf, 0, -p.Lo); J.L.el.rotation.x = -p.Le;
  J.R.sh.rotation.set(-p.Rf, 0, p.Ro); J.R.el.rotation.x = -p.Re;
  J.LL.hp.rotation.set(-p.LLf, 0, -p.LLo); J.LL.kn.rotation.x = p.LLk; J.LL.an.rotation.x = p.La;
  J.RL.hp.rotation.set(-p.RLf, 0, p.RLo); J.RL.kn.rotation.x = p.RLk; J.RL.an.rotation.x = p.Ra;
  J.blob.visible = p.y > -.5;
}
const S = Math.sin, Cc = Math.cos, PI = Math.PI;
const MOVES = {
  idle(t, ph = 0) { const b = (1 - Cc((t + ph) * PI * 2)) / 2, p = P0();
    p.y = -.05 * b; p.LLf = p.RLf = .1 + .08 * b; p.LLk = p.RLk = .18 + .18 * b; p.La = p.Ra = -.1 * b; p.sx = .08 + .05 * b; p.hx = .12 * b - .04;
    p.Lf = p.Rf = .95; p.Lo = p.Ro = -.35; p.Le = p.Re = 1.75; p.LLo = p.RLo = .06; return p; },
  bounce(t, ph = 0) { const b = (1 - Cc((t + ph) * PI * 2)) / 2, p = P0();
    p.y = -.06 * b; p.LLf = p.RLf = .12 + .1 * b; p.LLk = p.RLk = .2 + .2 * b; p.La = p.Ra = -.12 * b; p.sx = .1; p.hx = .18 * b - .05; p.Lf = .3; p.Rf = .3 + .2 * b; p.Le = p.Re = .9 + .2 * b; p.Lo = p.Ro = .25; p.LLo = p.RLo = .07; return p; },
  clap(t) { const p = MOVES.bounce(t), k = Math.pow(Math.abs(S(t * PI * 2)), .5); p.Lf = p.Rf = 1.25; p.Le = p.Re = .55; p.Lo = p.Ro = -.05 + .35 * k; return p; },
  cheer(t) { const p = MOVES.bounce(t * 2), k = .5 + .5 * S(t * PI * 4); p.Rf = 2.75 + .2 * k; p.Ro = .25; p.Re = .25; p.Lf = 1.9 + .5 * k; p.Lo = .5; p.Le = .8; p.hx = -.25; p.y -= .04; return p; },
  walk(ph, sp = 1) { const s = S(ph), p = P0(), a = .55 * sp;
    p.LLf = a * s; p.RLf = -a * s; p.LLk = .15 + .55 * Math.max(0, -s) * sp; p.RLk = .15 + .55 * Math.max(0, s) * sp; p.La = -.15 * s; p.Ra = .15 * s;
    p.Lf = -.45 * s * sp; p.Rf = .45 * s * sp; p.Le = p.Re = .35; p.Lo = p.Ro = .1; p.y = -.035 * Math.abs(Cc(ph)) * sp; p.sx = .06 * sp; p.sy = .12 * s * sp; return p; },
  // cross step: the legs cross in front on the beat, arms open wide
  toprock(t) { const ph = t * PI, s = S(ph), c2 = (1 - Cc(ph * 2)) / 2, p = P0(), side = s > 0 ? 1 : -1, k = Math.abs(s);
    p.y = -.07 * c2; p.yaw = .35 * s; p.sy = -.25 * s; p.sx = .12; p.hx = .1 * c2; p.hy = .2 * s;
    if (side > 0) { p.LLf = .55 * k; p.LLo = -.42 * k; p.LLk = .25 + .2 * k; p.RLf = -.12 * k; p.RLo = .12; p.RLk = .2; }
    else { p.RLf = .55 * k; p.RLo = -.42 * k; p.RLk = .25 + .2 * k; p.LLf = -.12 * k; p.LLo = .12; p.LLk = .2; }
    p.Lo = .9 + .35 * k; p.Ro = .9 + .35 * k; p.Lf = .5 + .4 * s; p.Rf = .5 - .4 * s; p.Le = .7 + .3 * k; p.Re = .7 + .3 * k; return p; },
  // indian step / kick out — second toprock flavour
  kick(t) { const ph = t * PI * 2, p = MOVES.toprock(t * .5), k = Math.max(0, S(ph)); if (Math.floor(t) % 2) { p.RLf = 1.1 * k; p.RLk = .2 * (1 - k); } else { p.LLf = 1.1 * k; p.LLk = .2 * (1 - k); } p.y -= .03 * k; return p; },
  windmill(t) { const sp = t * PI * 1.0, p = P0();
    p.yaw = sp; p.tx = -1.42 + .38 * S(sp * 2); p.tz = .3 * Cc(sp * 2); p.y = -.6;
    p.LLf = 1.45; p.RLf = 1.45; p.LLo = .85 + .25 * S(sp * 2); p.RLo = .85 - .25 * S(sp * 2); p.LLk = .05; p.RLk = .05; p.La = p.Ra = .5;
    p.Lf = .35; p.Lo = 1.25; p.Rf = .35; p.Ro = 1.25; p.Le = p.Re = .25; p.hx = .4; return p; },
  headspin(t) { const p = P0();
    p.yaw = t * PI * 3; p.tx = PI; p.y = .05; p.sx = -.05;
    p.LLo = .6; p.RLo = .6; p.LLk = .05; p.RLk = .05; p.LLf = .05; p.RLf = .05; p.La = p.Ra = .6;
    p.Lf = 2.5; p.Lo = .7; p.Le = 1.2; p.Rf = 2.5; p.Ro = .7; p.Re = 1.2; return p; },
  flare(t) { const sp = t * PI * 1.2, p = P0();
    p.yaw = sp; p.tx = -.55; p.y = -.38; p.sx = .3;
    p.Lf = 1.3; p.Rf = 1.3; p.Lo = .35; p.Ro = .35; p.Le = p.Re = 0;
    p.LLf = 1.3 + .35 * S(sp * 2); p.RLf = 1.3 - .35 * S(sp * 2); p.LLo = 1.2; p.RLo = 1.2; p.LLk = p.RLk = .05; p.La = p.Ra = .6; return p; },
  // chair freeze: side-on, one hand planted, the legs folded up
  freeze(t) { const br = .03 * S(t * PI), p = P0();
    p.tz = -1.2; p.tx = .15; p.y = -.42 + br; p.yaw = .3;
    p.Ro = -.35; p.Rf = .2; p.Re = .1; p.Lf = 1.6; p.Lo = 1.1; p.Le = .4;
    p.LLf = 1.6; p.LLk = 1.7; p.RLf = .9; p.RLk = 1.0; p.RLo = .3; p.La = p.Ra = .4; p.hz = .5; return p; },
};

// ---------- the world ----------
const W = { hero: null, crew: [], cyph: { x: 1.5, z: -7.2 }, t0: performance.now() };
async function build(scene) {
  try { await document.fonts.load('80px Anton'); await document.fonts.load('900 40px Inter'); } catch (_) {}
  WOOD = woodFaceTex(); WOOD_D = woodFaceTex('dark'); BARREL_K = barrelTex('k'); BARREL_O = barrelTex('o'); STRIPES = stripeTex(); KRAFT = kraftTex(); CHAIN = chainTex();

  // ground
  const con = concreteTex(); [con.map, con.rough, con.bump].forEach(t => t.repeat.set(70 / 6, 70 / 6));
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), new THREE.MeshStandardMaterial({ map: con.map, roughnessMap: con.rough, bumpMap: con.bump, bumpScale: 1.2, roughness: .92 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  // the street on the east
  const asp = asphaltTex(); asp.repeat.set(2, 12);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(9, 70), new THREE.MeshStandardMaterial({ map: asp, roughness: .85 })); road.rotation.x = -Math.PI / 2; road.position.set(18.5, .006, 0); road.receiveShadow = true; scene.add(road);
  const curb = new THREE.Mesh(new THREE.BoxGeometry(.25, .15, 70), M('#5d6066', .9)); curb.position.set(13.95, .075, 0); curb.receiveShadow = true; scene.add(curb);
  for (let z = -34; z < 34; z += 4.5) decal(scene, paintCanvas(32, 256, (x, w, h) => { x.fillStyle = PAINT_W; x.fillRect(0, 0, w, h); }, .25, z * 3 | 0), .16, 2.2, 18.5, z);

  // ---- buildings on the north ----
  const blds = [
    { x: -7.5, w: 15, h: 9.5, d: 7, col: '#3b352f', brick: true, floors: 3, lit: .5, seed: 3 },
    { x: 7.25, w: 14.5, h: 6.4, d: 7, col: '#4a4f57', brick: false, floors: 2, lit: .45, seed: 4 },
  ];
  blds.forEach(b => {
    const f = facadeTex(b.w, b.h, b), roof = roofTex(b.w, b.d, b.seed + 10), side = M('#2a2c31', .9);
    const mats = [side, side, new THREE.MeshStandardMaterial({ map: roof, roughness: .95 }), side, new THREE.MeshStandardMaterial({ map: f.map, emissiveMap: f.emi, emissive: '#ffffff', emissiveIntensity: 1.6, roughness: .9 }), side];
    const m = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), mats); m.position.set(b.x, b.h / 2, -16 - b.d / 2); m.castShadow = m.receiveShadow = true; scene.add(m);
    box(b.x, -16 - b.d / 2, b.w, b.d);
    // roof clutter
    const r = rng(b.seed * 9);
    for (let i = 0; i < 4; i++) { const ac = new THREE.Mesh(new RoundedBoxGeometry(1 + r() * .6, .6, .8, 2, .04), M('#6b7078', .55, .4)); ac.position.set(b.x - b.w / 2 + 1.5 + r() * (b.w - 3), b.h + .3, -16 - 1.2 - r() * (b.d - 2.4)); scene.add(shadowAll(ac));
      const fan = new THREE.Mesh(new THREE.CircleGeometry(.24, 16), M('#1b1d21', .5)); fan.rotation.x = -Math.PI / 2; fan.position.set(ac.position.x, b.h + .61, ac.position.z); scene.add(fan); }
    for (let i = 0; i < 3; i++) { const v = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, .7, 10), M('#8a8f96', .4, .7)); v.position.set(b.x - b.w / 2 + 1 + r() * (b.w - 2), b.h + .35, -16 - .8 - r() * (b.d - 1.6)); scene.add(shadowAll(v)); }
  });
  // water tank on the tall roof + antenna
  { const t = new THREE.Mesh(new THREE.CylinderGeometry(.9, .9, 1.6, 18), M('#4b3b30', .8)); t.position.set(-11, 9.5 + .8 + .5, -20); scene.add(shadowAll(t));
    [-.6, .6].forEach(dx => [-.6, .6].forEach(dz => { const l = new THREE.Mesh(new THREE.BoxGeometry(.08, .5, .08), M('#2a2c31', .6, .5)); l.position.set(-11 + dx, 9.75, -20 + dz); scene.add(l); }));
    const an = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 3, 6), M('#7c828a', .4, .8)); an.position.set(-3.5, 9.5 + 1.5, -21); scene.add(shadowAll(an)); }
  // doors in the facade
  const door = (x, w, h, col, lit) => {
    const d = new THREE.Mesh(new THREE.BoxGeometry(w, h, .08), M(col, .6, .3)); d.position.set(x, h / 2, -15.98); scene.add(shadowAll(d));
    if (lit) { const l = new THREE.Mesh(new THREE.BoxGeometry(.5, .12, .15), glowMat('#ffd29a', 2.5)); l.position.set(x, h + .35, -15.9); scene.add(l);
      const pl = new THREE.PointLight('#ffb875', 8, 7, 2); pl.position.set(x, h + .1, -15.3); scene.add(pl); }
  };
  door(-10.5, 1.2, 2.2, '#1d2228', true);
  // roller door of a shop in the lower building
  { const c = can(256, 220), x = c.getContext('2d'); x.fillStyle = '#5b6068'; x.fillRect(0, 0, 256, 220); for (let i = 0; i < 220; i += 9) { x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, i, 256, 2); x.fillStyle = 'rgba(255,255,255,.1)'; x.fillRect(0, i + 3, 256, 1); } grain(c, 18, 2); blotch(x, 256, 220, 14, 'rgba(120,60,25,A)', 8, 30, .5, rng(4));
    const d = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.7), new THREE.MeshStandardMaterial({ map: tex(c), roughness: .5, metalness: .5 })); d.position.set(9.5, 1.35, -15.96); d.receiveShadow = true; scene.add(d); }
  // big graffiti on the brick wall (same letters as the flat city)
  if (window.CITY_GFX && CITY_GFX.graf) {
    try {
      const g = CITY_GFX.graf({ word: 'FEDOSKIN', style: 'wild', pal: 'fire', w: 1100, h: 330, seed: 7 });
      const gm = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 2.5), new THREE.MeshStandardMaterial({ map: tex(g), transparent: true, roughness: .75, polygonOffset: true, polygonOffsetFactor: -2 }));
      gm.position.set(-4.6, 1.55, -15.94); gm.receiveShadow = true; scene.add(gm);
      const g2 = CITY_GFX.graf({ word: 'CYPHER', style: 'bubble', pal: 'ice', w: 700, h: 300, seed: 3 });
      const gm2 = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.55), new THREE.MeshStandardMaterial({ map: tex(g2), transparent: true, roughness: .75, polygonOffset: true, polygonOffsetFactor: -2 }));
      gm2.position.set(4.6, 1.3, -15.94); gm2.receiveShadow = true; scene.add(gm2);
    } catch (e) { console.warn(e); }
  }
  // pipes on the wall with yellow clamps
  [[-13.2, 9.5], [1.2, 6.4]].forEach(([x, h]) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, h, 10), M('#3c4048', .4, .7)); p.position.set(x, h / 2, -15.85); scene.add(shadowAll(p));
    for (let y = .6; y < h; y += 1.6) { const c = new THREE.Mesh(new THREE.CylinderGeometry(.085, .085, .08, 10), M(PAINT_Y, .5, .3)); c.position.set(x, y, -15.85); scene.add(c); } });
  // a horizontal pipe along the ground at the wall's foot
  { const p = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, 13, 10), M('#2f343b', .45, .6)); p.rotation.z = Math.PI / 2; p.position.set(7.2, .25, -15.7); scene.add(shadowAll(p)); box(7.2, -15.7, 13, .3); }

  // ---- garages on the west ----
  { const len = 24, x0 = -15, roofT = corrugTex(4, len); roofT.wrapS = roofT.wrapT = THREE.RepeatWrapping;
    const mats = [M('#4d4a46', .9), M('#4d4a46', .9), new THREE.MeshStandardMaterial({ map: roofT, roughness: .5, metalness: .4 }), M('#333', .9), M('#4d4a46', .9), M('#4d4a46', .9)];
    const gar = new THREE.Mesh(new THREE.BoxGeometry(4, 2.8, len), mats); gar.position.set(x0, 1.4, -2); scene.add(shadowAll(gar)); box(x0, -2, 4, len);
    const cols = ['#5a3a2c', '#2f4a5c', '#4b4f2f', '#5c2f2f', '#38393d', '#2f5c4a'];
    for (let i = 0; i < 6; i++) { const z = -12.5 + i * 3.8, c = can(128, 128), x = c.getContext('2d'); x.fillStyle = cols[i]; x.fillRect(0, 0, 128, 128); for (let k = 0; k < 128; k += 8) { x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(k, 0, 2, 128); } grain(c, 20, i); blotch(x, 128, 128, 10, 'rgba(140,70,30,A)', 4, 20, .6, rng(i));
      const d = new THREE.Mesh(new THREE.PlaneGeometry(3, 2.3), new THREE.MeshStandardMaterial({ map: tex(c), roughness: .55, metalness: .45 })); d.rotation.y = Math.PI / 2; d.position.set(-12.98, 1.15, z); d.receiveShadow = true; scene.add(d); }
    // stuff on the garage roofs
    const r = rng(5); for (let i = 0; i < 5; i++) { const t = tires(1 + (r() * 2 | 0)); t.position.set(x0 + (r() - .5) * 2.5, 2.8, -12 + r() * 20); scene.add(t); }
    for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(.25, .12, .12), M('#7a3a28', .9)); b.position.set(x0 + (r() - .5) * 3, 2.86, -12 + r() * 20); b.rotation.y = r() * 3; scene.add(shadowAll(b)); }
  }

  // ---- fences ----
  { const f = chainFence(30); f.rotation.y = Math.PI / 2; f.position.set(13.6, 0, -1); scene.add(f); box(13.6, -1, .3, 30); }
  { const f = chainFence(11); f.position.set(-7.5, 0, 14.6); scene.add(f); box(-7.5, 14.6, 11, .3); const f2 = chainFence(10.5); f2.position.set(8.4, 0, 14.6); scene.add(f2); box(8.4, 14.6, 10.5, .3);
    [-2, 3.15].forEach(x => { const p = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, 2.6, 10), M(OR, .5, .4)); p.position.set(x, 1.3, 14.6); scene.add(shadowAll(p)); }); }

  // ---- props ----
  const put = (o, x, z, ry = 0) => { o.position.set(x, o.position.y, z); o.rotation.y = ry; scene.add(o); return o; };
  // supply corner (south-west)
  [[-10.4, 9.6, 1.1, .2], [-9.2, 9.8, 1.1, -.1], [-9.9, 8.5, .9, .5]].forEach(([x, z, s, r]) => { const c = crate(s); c.position.set(x, s / 2, z); c.rotation.y = r; scene.add(c); box(x, z, s, s); });
  { const c = crate(.8); c.position.set(-9.8, 1.1 + .4, 9.7); c.rotation.y = .7; scene.add(c); }
  [[-11.4, 7.4, BARREL_K], [-10.6, 6.8, BARREL_O], [-11.5, 6.2, BARREL_K]].forEach(([x, z, k]) => { const b = barrel(k); put(b, x, z, Math.random() * 6); circ(x, z, .38); });
  put(pallet(), -7.6, 10.4, .3); box(-7.6, 10.4, 1.1, 1);
  put(tires(3), -11.3, 12.2); circ(-11.3, 12.2, .45);
  decal(scene, paintCanvas(1024, 384, (x, w, h) => { x.strokeStyle = PAINT_W; x.lineWidth = 10; x.setLineDash([60, 30]); x.strokeRect(14, 14, w - 28, h - 28); x.setLineDash([]); x.fillStyle = PAINT_W; x.font = '400 150px Anton'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('STORAGE', w / 2, h / 2 + 6); }, .5, 21), 5, 1.9, -8.6, 12.9, 0, { op: .8 });
  // the cypher (north middle)
  const cx = W.cyph.x, cz = W.cyph.z;
  [[0, 0, 0], [.9, .35, .5], [-.8, -.5, -.3], [.1, -1.1, 1.4]].forEach(([dx, dz, r]) => { const c = cardboard(1.2, 1.7); c.position.set(cx + dx, .011 + Math.abs(dx) * .003, cz + dz); c.rotation.y = r; scene.add(c); });
  decal(scene, paintCanvas(1024, 1024, (x, w, h) => { x.strokeStyle = OR; x.lineWidth = 26; x.beginPath(); x.arc(w / 2, h / 2, w / 2 - 30, 0, 7); x.stroke(); x.lineWidth = 8; x.setLineDash([40, 28]); x.beginPath(); x.arc(w / 2, h / 2, w / 2 - 78, 0, 7); x.stroke(); }, .9, 23), 6.4, 6.4, cx, cz, 0, { op: .9 });
  decal(scene, paintCanvas(1280, 300, (x, w, h) => { x.fillStyle = PAINT_Y; x.font = '400 190px Anton'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('CYPHER  ZONE', w / 2, h / 2 + 8); x.strokeStyle = PAINT_Y; x.lineWidth = 8; x.strokeRect(10, 10, w - 20, h - 20); }, .8, 24), 5.2, 1.22, cx, cz - 4.9, 0, { op: .85 });
  const spk = speakers(); put(spk, cx - 3.9, cz - 1.6, .6); box(cx - 3.9, cz - 1.6, 1, .7); W.speakers = [spk];
  const spk2 = speakers(); put(spk2, cx + 3.9, cz - 1.7, -.6); box(cx + 3.9, cz - 1.7, 1, .7); W.speakers.push(spk2);
  { const c = crate(.6); c.position.set(cx - 3.2, .3, cz + 1.9); scene.add(c); box(cx - 3.2, cz + 1.9, .6, .6); const bb = boombox(); bb.position.set(cx - 3.2, .6, cz + 1.9); bb.rotation.y = .5; scene.add(bb); }
  // wooden barrier (like the reference)
  { const f = woodFence(3.4); put(f, 6.6, 1.2, -.25); box(6.6, 1.2, 3.4, .5); const f2 = woodFence(2.2); put(f2, -4.8, -1.6, .15); box(-4.8, -1.6, 2.2, .4); }
  // court corner (south-east)
  { const h = hoop(); put(h, 10.4, 11.9, Math.PI); box(10.4, 11.9, .3, .3);
    decal(scene, paintCanvas(1024, 768, (x, w, h) => { x.strokeStyle = PAINT_W; x.lineWidth = 12; x.beginPath(); x.arc(w * .5, h, w * .42, Math.PI, 0); x.stroke(); x.strokeRect(w * .32, h * .38, w * .36, h * .62); x.beginPath(); x.arc(w * .5, h * .38, w * .18, Math.PI, 0); x.stroke(); }, .6, 25), 7, 5.25, 10.2, 9.7, 0, { op: .7 }); }
  // dumpster + bags (north-east corner)
  { const d = dumpster(); put(d, 10.8, -13.6, -.1); box(10.8, -13.6, 2, 1.3); [[9.3, -13.9, 1], [9.5, -13.2, .8], [12.1, -12.3, .9]].forEach(([x, z, s]) => { const b = trashBag(s); b.position.set(x, b.position.y, z); scene.add(b); circ(x, z, .3 * s); }); }
  // jersey barriers by the gate
  { const j = jersey(2.6); put(j, -4.1, 12.6, .05); box(-4.1, 12.6, 2.6, .6); const j2 = jersey(2.6); put(j2, 5.2, 12.8, -.08); box(5.2, 12.8, 2.6, .6); }
  // barrels at the barrier
  [[8.9, 2.4, BARREL_O], [9.5, 3.1, BARREL_K]].forEach(([x, z, k]) => { put(barrel(k), x, z, 1); circ(x, z, .38); });
  { const c = crate(1); c.position.set(-5.9, .5, 3.2); c.rotation.y = .3; scene.add(c); box(-5.9, 3.2, 1, 1); const b = barrel(BARREL_K); put(b, -5.6, 4.35); circ(-5.6, 4.35, .38);
    decal(scene, paintCanvas(512, 512, (x, w, h) => { x.strokeStyle = PAINT_Y; x.lineWidth = 9; const L = 46; [[0, 0, 1, 1], [w, 0, -1, 1], [0, h, 1, -1], [w, h, -1, -1]].forEach(([a, b, sx, sy]) => { x.beginPath(); x.moveTo(a + sx * 12, b + sy * (12 + L)); x.lineTo(a + sx * 12, b + sy * 12); x.lineTo(a + sx * (12 + L), b + sy * 12); x.stroke(); }); }, .4, 26), 2.6, 2.6, -5.8, 3.75, .3, { op: .8 }); }
  // parked car on the street
  { const c = car('#5b1f1f'); put(c, 16.3, -6, 0); const c2 = car('#24324a'); put(c2, 20.6, 8, Math.PI); }

  // ---- paint on the ground ----
  // hazard band across the west half
  decal(scene, paintCanvas(1600, 120, (x, w, h) => { x.fillStyle = PAINT_Y; for (let i = 0; i < w; i += 110) { x.beginPath(); x.moveTo(i, h); x.lineTo(i + 60, h); x.lineTo(i + 100, 0); x.lineTo(i + 40, 0); x.fill(); } }, .7, 27), 10, .75, -6.5, 6.1, 0, { op: .85 });
  // long L lines
  const line = (x0, z0, x1, z1) => { const l = Math.hypot(x1 - x0, z1 - z0); decal(scene, paintCanvas(Math.max(64, l * 64 | 0), 16, (x, w, h) => { x.fillStyle = PAINT_Y; x.fillRect(0, 0, w, h); }, .55, (x0 * 7 + z1 * 3) | 0), l, .13, (x0 + x1) / 2, (z0 + z1) / 2, -Math.atan2(z1 - z0, x1 - x0), { op: .85 }); };
  line(-3, -12.5, 6.2, -12.5); line(6.2, -12.5, 6.2, -9.5); line(-12, 2.6, -2, 2.6); line(-2, 2.6, -2, .4);
  // dashed walkway
  for (let z = 4; z < 14; z += 1.4) decal(scene, paintCanvas(16, 128, (x, w, h) => { x.fillStyle = PAINT_W; x.fillRect(0, 0, w, h); }, .35, z * 11 | 0), .12, .8, .6, z, 0, { op: .7 });
  // arrows
  const arrow = (x, z, rot) => decal(scene, paintCanvas(256, 256, (c, w, h) => { c.fillStyle = PAINT_W; c.beginPath(); c.moveTo(w / 2, 20); c.lineTo(w - 40, 120); c.lineTo(w / 2 + 34, 120); c.lineTo(w / 2 + 34, h - 20); c.lineTo(w / 2 - 34, h - 20); c.lineTo(w / 2 - 34, 120); c.lineTo(40, 120); c.closePath(); c.fill(); }, .5, x * 13 | 0), 1.1, 1.1, x, z, rot, { op: .75 });
  arrow(-1.1, 9, 0); arrow(-1.1, -.5, 0); arrow(8.2, -4, -Math.PI / 2);
  decal(scene, paintCanvas(512, 128, (x, w, h) => { x.fillStyle = PAINT_W; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(30 + i * 120, h - 10); x.lineTo(90 + i * 120, h - 10); x.lineTo(140 + i * 120, 10); x.lineTo(80 + i * 120, 10); x.fill(); } }, .45, 29), 2.4, .6, -5.1, -5.2, 0, { op: .75 });
  // brand stencil near the gate
  decal(scene, paintCanvas(1024, 256, (x, w, h) => { x.fillStyle = OR; x.font = '400 150px Anton'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('FEDOSKIN TEAM', w / 2, h / 2 + 6); }, .75, 30), 4.6, 1.15, .6, 13.6, 0, { op: .8 });
  // oil stains + puddles (shiny)
  const puddle = (x, z, s, rot) => decal(scene, paintCanvas(256, 256, (c, w, h, r) => { c.fillStyle = 'rgba(8,10,14,.85)'; c.beginPath(); for (let i = 0; i < 18; i++) { const a = i / 18 * 6.283, rr = w * (.32 + r() * .14); c.lineTo(w / 2 + Math.cos(a) * rr, h / 2 + Math.sin(a) * rr * .7); } c.closePath(); c.filter = 'blur(6px)'; c.fill(); }, 0, (x * 5) | 0), s, s, x, z, rot, { rough: .05 });
  puddle(3.4, 5.8, 2.4, .3); puddle(-7.3, -8.6, 2, 1.2); puddle(9.6, -6.5, 1.8, 2); puddle(-2.6, 11.4, 1.5, .4);
  for (let i = 0; i < 9; i++) { const r = rng(100 + i); decal(scene, paintCanvas(128, 128, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(0,0,0,.6)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }, 0, i), 1 + r() * 2, .8 + r() * 1.4, -11 + r() * 22, -13 + r() * 25, r() * 3, { op: .7 }); }

  // ---- lights ----
  lamp(scene, cx + 4.7, cz - 2.6, -2.2, { double: true, shadow: true, power: 120, angle: .9 });
  lamp(scene, -8.2, 4.2, 2.6, { shadow: true, power: 85 });
  lamp(scene, 7.9, 7.6, -.9, { shadow: true, power: 80 });
  lamp(scene, 13.9, -9, -Math.PI / 2, { power: 70, flicker: true });
  lamp(scene, 13.9, 10, -Math.PI / 2, { power: 60 });
  lamps.forEach((l, i) => i < 3 && dust(scene, l.head));

  // ---- people ----
  const look = myLook();
  W.hero = person(look); W.hero.root.position.set(1.2, 0, -2.6); W.hero.root.rotation.y = Math.PI; scene.add(W.hero.root);
  W.hero.st = { vx: 0, vz: 0, face: Math.PI, ph: 0, idle: 0, tgt: null };
  const crewLooks = [[3, ['c:rustyBandana']], [5, ['c:owlPhones', 'knee']], [6, ['girl', 'c:acidBucket']], [7, ['c:goldChain']], [4, ['c:djGloves']]];
  crewLooks.forEach(([lv, acc], i) => {
    const J = person(HERO.topDown(lv, acc)), a = -Math.PI / 2 + (i - (crewLooks.length - 1) / 2) * .78 + (i >= 3 ? Math.PI * .55 : 0);
    const slot = { x: cx + Math.cos(a) * 2.75, z: cz + Math.sin(a) * 2.75 };
    J.root.position.set(slot.x, 0, slot.z); scene.add(J.root);
    J.c = { slot, ph: Math.random(), mood: 'idle', x: slot.x, z: slot.z };
    W.crew.push(J); circ(slot.x, slot.z, .32);
  });
  W.turn = { who: 0, start: 0, plan: null };
}
function myLook() {
  const lv = +Q.get('lv') || (() => { try { const s = JSON.parse(localStorage.getItem('fedoskin-stats') || '{}'); return HERO.levelFor((s.sec || 0) / 60); } catch (_) { return 4; } })() || 4;
  let eq = []; try { eq = JSON.parse(localStorage.getItem('fedoskin-eq') || '[]') || []; } catch (_) {}
  try { const p = JSON.parse(localStorage.getItem('fedoskin-profile') || '{}'); if (p.g === 'f') eq.push('girl'); } catch (_) {}
  try { const l = +localStorage.getItem('fedoskin-look'); if (l) eq.push('lv' + l); } catch (_) {}
  return HERO.topDown(Math.max(lv, Q.get('lv') ? 1 : 4), eq);
}

// ---------- the cypher: one dancer at a time goes into the middle ----------
const SETS = [
  [['toprock', 8], ['windmill', 8], ['freeze', 4]],
  [['kick', 6], ['headspin', 6], ['freeze', 4]],
  [['toprock', 6], ['flare', 6], ['windmill', 4], ['freeze', 4]],
];
function planSet(n) { const s = SETS[n % SETS.length], out = []; let t = 0; s.forEach(([m, d]) => { out.push({ m, a: t, b: t + d }); t += d; }); return { list: out, len: t }; }
function dancerPose(plan, tb) {
  const L = plan.list; let i = L.findIndex(s => tb < s.b); if (i < 0) i = L.length - 1;
  const s = L[i], p = MOVES[s.m](tb - s.a), X = .35;
  if (i > 0 && tb - s.a < X) { const q = L[i - 1], pp = MOVES[q.m](q.b - q.a); pp.yaw = p.yaw; return { pose: blend(pp, p, ease((tb - s.a) / X)), m: s.m }; }
  return { pose: p, m: s.m };
}
function updateCrew(tb, dt) {
  const T = W.turn, cx = W.cyph.x, cz = W.cyph.z, n = W.crew.length;
  if (!T.plan) { T.plan = planSet(T.who); T.start = tb; }
  const rel = tb - T.start, walk = 2, total = walk + T.plan.len + walk;
  let freezeNow = false;
  W.crew.forEach((J, i) => {
    const c = J.c;
    if (i === T.who % n) {
      let x, z, face, pose;
      if (rel < walk) { const k = ease(rel / walk); x = lerp(c.slot.x, cx, k); z = lerp(c.slot.z, cz, k); face = Math.atan2(cx - c.slot.x, cz - c.slot.z); pose = MOVES.walk(rel * PI * 2, .8); }
      else if (rel < walk + T.plan.len) { x = cx; z = cz; face = Math.atan2(W.hero.root.position.x - cx, W.hero.root.position.z - cz) * .0 + Math.PI * .1; const d = dancerPose(T.plan, rel - walk); pose = d.pose; freezeNow = d.m === 'freeze'; }
      else { const k = ease(clamp((rel - walk - T.plan.len) / walk, 0, 1)); x = lerp(cx, c.slot.x, k); z = lerp(cz, c.slot.z, k); face = Math.atan2(c.slot.x - cx, c.slot.z - cz); pose = MOVES.walk(rel * PI * 2, .8); }
      J.root.position.set(x, 0, z); J.root.rotation.y = face; apply(J, pose);
    }
  });
  W.crew.forEach((J, i) => {
    if (i === T.who % n) return;
    const c = J.c, face = Math.atan2(cx - c.slot.x, cz - c.slot.z);
    J.root.position.set(c.slot.x, 0, c.slot.z); J.root.rotation.y = face;
    const mood = freezeNow ? (i % 2 ? 'cheer' : 'clap') : (i % 3 === 0 ? 'clap' : i % 3 === 1 ? 'bounce' : 'idle');
    apply(J, MOVES[mood](tb + c.ph * .3, c.ph));
  });
  if (rel > total) { T.who++; T.plan = null; }
}

// ---------- controls ----------
const ctl = { down: false, sx: 0, sy: 0, x: 0, y: 0, joy: false, t: 0, id: null };
function setupInput(cv, camera) {
  const joy = $('#joy'), knob = joy.firstElementChild, ray = new THREE.Raycaster(), pl = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), v = new THREE.Vector3();
  cv.addEventListener('pointerdown', e => { if (ctl.down) return; ctl.down = true; ctl.id = e.pointerId; ctl.sx = ctl.x = e.clientX; ctl.sy = ctl.y = e.clientY; ctl.t = performance.now(); ctl.joy = false; try { cv.setPointerCapture(e.pointerId); } catch (_) {} startMusic(); });
  cv.addEventListener('pointermove', e => { if (!ctl.down || e.pointerId !== ctl.id) return; ctl.x = e.clientX; ctl.y = e.clientY;
    if (!ctl.joy && Math.hypot(ctl.x - ctl.sx, ctl.y - ctl.sy) > 14) { ctl.joy = true; joy.style.left = ctl.sx + 'px'; joy.style.top = ctl.sy + 'px'; joy.classList.add('on'); W.hero.st.tgt = null; hintOff(); }
    if (ctl.joy) { let dx = ctl.x - ctl.sx, dy = ctl.y - ctl.sy; const l = Math.hypot(dx, dy), m = 42; if (l > m) { dx *= m / l; dy *= m / l; } knob.style.transform = `translate(${dx}px,${dy}px)`; } });
  const up = e => { if (!ctl.down || e.pointerId !== ctl.id) return; ctl.down = false; joy.classList.remove('on'); knob.style.transform = '';
    if (!ctl.joy && performance.now() - ctl.t < 400) {   // a tap = walk there
      const r = cv.getBoundingClientRect(); ray.setFromCamera({ x: (e.clientX - r.left) / r.width * 2 - 1, y: -(e.clientY - r.top) / r.height * 2 + 1 }, camera);
      if (ray.ray.intersectPlane(pl, v)) { W.hero.st.tgt = { x: v.x, z: v.z }; tapMark(v); hintOff(); }
    }
    ctl.joy = false; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  const keys = {}; addEventListener('keydown', e => { keys[e.key] = 1; startMusic(); }); addEventListener('keyup', e => { keys[e.key] = 0; });
  ctl.keys = keys;
}
let hintGone = false; function hintOff() { if (hintGone) return; hintGone = true; $('#hint').classList.add('off'); }
let tapRing;
function tapMark(v) { if (!tapRing) return; tapRing.position.set(v.x, .03, v.z); tapRing.userData.t = 0; tapRing.visible = true; }
function collide(x, z, r) {
  for (const c of colliders) {
    if (c.r !== undefined) { const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), m = r + c.r; if (d < m && d > 1e-4) { x = c.x + dx / d * m; z = c.z + dz / d * m; } }
    else { const nx = clamp(x, c.x0, c.x1), nz = clamp(z, c.z0, c.z1), dx = x - nx, dz = z - nz, d = Math.hypot(dx, dz);
      if (d < r) { if (d > 1e-4) { x = nx + dx / d * r; z = nz + dz / d * r; } else { const o = [x - c.x0, c.x1 - x, z - c.z0, c.z1 - z], k = o.indexOf(Math.min(...o)); if (k === 0) x = c.x0 - r; else if (k === 1) x = c.x1 + r; else if (k === 2) z = c.z0 - r; else z = c.z1 + r; } } }
  }
  return { x: clamp(x, -12.6, 13.2), z: clamp(z, -15.4, 14.2) };
}
function updateHero(dt, tb) {
  const H = W.hero, s = H.st, p = H.root.position;
  let ix = 0, iz = 0;
  if (ctl.joy) { const dx = ctl.x - ctl.sx, dy = ctl.y - ctl.sy, l = Math.hypot(dx, dy); if (l > 6) { const k = Math.min(1, l / 42); ix = dx / l * k; iz = dy / l * k; } }
  const K = ctl.keys || {}; if (K.ArrowLeft || K.a) ix -= 1; if (K.ArrowRight || K.d) ix += 1; if (K.ArrowUp || K.w) iz -= 1; if (K.ArrowDown || K.s) iz += 1;
  if (!ix && !iz && s.tgt) { const dx = s.tgt.x - p.x, dz = s.tgt.z - p.z, l = Math.hypot(dx, dz); if (l < .15) s.tgt = null; else { ix = dx / l * Math.min(1, l / .6); iz = dz / l * Math.min(1, l / .6); } }
  const il = Math.hypot(ix, iz); if (il > 1) { ix /= il; iz /= il; }
  const SPD = 3.6; s.vx = lerp(s.vx, ix * SPD, 1 - Math.exp(-dt * 12)); s.vz = lerp(s.vz, iz * SPD, 1 - Math.exp(-dt * 12));
  const sp = Math.hypot(s.vx, s.vz);
  if (sp > .05) {
    const n = collide(p.x + s.vx * dt, p.z + s.vz * dt, .3); if (s.tgt && Math.hypot(n.x - p.x, n.z - p.z) < sp * dt * .25) s.tgt = null;
    p.x = n.x; p.z = n.z;
    const want = Math.atan2(s.vx, s.vz); let d = want - s.face; d = Math.atan2(S(d), Cc(d)); s.face += d * (1 - Math.exp(-dt * 14));
  }
  H.root.rotation.y = s.face;
  const k = clamp(sp / SPD, 0, 1);
  if (k > .08) { s.ph += dt * (4 + 7 * k); s.idle = 0; s.prev = blend(MOVES.bounce(tb), MOVES.walk(s.ph, k), clamp(k * 2, 0, 1)); }
  else { s.idle += dt; const near = Math.hypot(p.x - W.cyph.x, p.z - W.cyph.z) < 5.5;
    const tp = s.idle > 3 || near ? MOVES.toprock(tb) : MOVES.bounce(tb); const pose = s.prev ? blend(s.prev, tp, clamp(s.idle * 4, 0, 1)) : tp; if (s.idle > .3) s.prev = null; s.prevIdle = pose; apply(H, pose); return; }
  apply(H, s.prev);
}

// ---------- music ----------
let musicOn = false, musicT0 = 0;
function startMusic() { if (musicOn || localStorage.getItem('fedoskin-city-music') === '0') return; try { if (window.RB && RB.bgm) { RB.bgm(true); musicOn = true; musicT0 = performance.now() + 150; paintMus(); } } catch (_) {} }
function paintMus() { $('#mus').textContent = musicOn ? '🎵' : '🔇'; }
$('#mus').addEventListener('click', e => { e.stopPropagation(); if (musicOn) { RB.bgm(false); musicOn = false; localStorage.setItem('fedoskin-city-music', '0'); } else { localStorage.removeItem('fedoskin-city-music'); startMusic(); } paintMus(); });
document.addEventListener('visibilitychange', () => { if (!window.RB) return; if (document.hidden && musicOn) RB.bgm(false); else if (!document.hidden && musicOn) RB.bgm(true); });

// ---------- boot ----------
async function boot() {
  const cv = $('#c3');
  try { renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: false, powerPreference: 'high-performance' }); } catch (e) { $('#err').style.display = 'flex'; return; }
  maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  let PR = Math.min(devicePixelRatio || 1, TOUCH ? 2 : 1.5);
  renderer.setPixelRatio(PR); renderer.setSize(innerWidth, innerHeight, false);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.4;
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#0a0c11'); scene.fog = new THREE.FogExp2('#0a0c11', .016);
  const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 1, 120);

  // dusk light: cool sky + moon with long soft shadows
  scene.add(new THREE.HemisphereLight('#7d8fba', '#2a1e16', 1.1));
  const moon = new THREE.DirectionalLight('#9db4e6', 1.1); moon.position.set(-9, 22, -6); moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048); moon.shadow.camera.left = -16; moon.shadow.camera.right = 16; moon.shadow.camera.top = 16; moon.shadow.camera.bottom = -16; moon.shadow.camera.near = 1; moon.shadow.camera.far = 60; moon.shadow.bias = -.0005; moon.shadow.normalBias = .03; moon.shadow.radius = 4;
  scene.add(moon, moon.target);
  // a tiny environment so metal and puddles have something to reflect
  { const pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene(); es.background = new THREE.Color('#06080c');
    const add = (c, x, y, z, s) => { const m = new THREE.Mesh(new THREE.SphereGeometry(s, 8, 6), new THREE.MeshBasicMaterial({ color: c })); m.position.set(x, y, z); es.add(m); };
    add('#ffad60', 6, 6, 3, 1.6); add('#ffad60', -7, 5, -4, 1.2); add('#5872a8', 0, 14, 0, 6); add('#ff8a3a', 2, 3, -8, 1);
    scene.environment = pm.fromScene(es, .04).texture; scene.environmentIntensity = .45; }

  await build(scene);
  // ring where you tapped
  tapRing = new THREE.Mesh(new THREE.RingGeometry(.25, .32, 28), new THREE.MeshBasicMaterial({ color: OR, transparent: true, depthWrite: false, toneMapped: false })); tapRing.rotation.x = -Math.PI / 2; tapRing.visible = false; scene.add(tapRing);

  // post: bloom on the bright bits, then vignette + grade + grain
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const comp = new EffectComposer(renderer, rt);
  comp.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .55, .5, .82); comp.addPass(bloom);
  comp.addPass(new OutputPass());
  const fin = new ShaderPass({ uniforms: { tDiffuse: { value: null }, uT: { value: 0 }, uR: { value: new THREE.Vector2(1, 1) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'uniform sampler2D tDiffuse; uniform float uT; uniform vec2 uR; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); vec2 d = (vUv - .5) * vec2(uR.x / uR.y, 1.); float v = smoothstep(1.05, .32, length(d) * 1.25); c.rgb *= mix(.42, 1., v); float l = dot(c.rgb, vec3(.299,.587,.114)); c.rgb += vec3(-.01, .0, .03) * (1. - l) * (1. - l); float n = fract(sin(dot(vUv * uR + fract(uT) * 91.7, vec2(12.9898, 78.233))) * 43758.5453); c.rgb += (n - .5) * .03; gl_FragColor = c; }' });
  comp.addPass(fin);

  const resize = () => { const w = innerWidth, h = innerHeight; renderer.setPixelRatio(PR); renderer.setSize(w, h, false); comp.setPixelRatio(PR); comp.setSize(w, h); bloom.resolution.set(w / 2, h / 2);
    camera.aspect = w / h; const hw = 4.3, dist = 18; camera.fov = clamp(2 * Math.atan(hw / dist / camera.aspect) * 180 / Math.PI, 30, 52); camera.updateProjectionMatrix(); fin.uniforms.uR.value.set(w, h); };
  addEventListener('resize', resize); resize();
  setupInput(cv, camera);

  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), look = new THREE.Vector3();
  const off = new THREE.Vector3(0, 15.5, 8.6);   // ~61° down from the south: more volume
  const hp = W.hero.root.position; camLook.set(hp.x, 0, hp.z - 2.2); camPos.copy(camLook).add(off);
  let last = performance.now(), fpsN = 0, fpsT = 0, slow = 0, tier = 0;
  const showFps = Q.has('fps');
  const frame = now => {
    requestAnimationFrame(frame);
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    const tb = ((now - (musicOn ? musicT0 : W.t0)) / 1000) * 88 / 60;
    updateHero(dt, tb); updateCrew(tb, dt);
    // camera follows with a little lead in the walking direction
    const s = W.hero.st; look.set(hp.x + s.vx * .25, 0, hp.z - 2.1 + s.vz * .25);
    camLook.lerp(look, 1 - Math.exp(-dt * 4)); camPos.copy(camLook).add(off); camera.position.copy(camPos); camera.lookAt(camLook);
    moon.position.set(camLook.x - 9, 22, camLook.z - 6); moon.target.position.copy(camLook); moon.target.updateMatrixWorld();
    // speakers pump on the beat
    const beat = Math.pow(1 - (tb % 1), 3);
    (W.speakers || []).forEach(sp => sp.userData.cones.forEach(c => { c.cone.position.z = .251 + beat * .03; c.ring.material.color.setRGB(2.4 * (.6 + beat), .62 * (.6 + beat), .16 * (.6 + beat)); }));
    // lamp flicker, dust drift
    lamps.forEach(l => { if (l.flick) { const f = Math.sin(now * .013) + Math.sin(now * .031) > 1.55 ? .25 : 1; l.light.intensity = l.base * f; l.cone.visible = f > .5; } });
    motes.forEach(m => { const a = m.p.geometry.attributes.position, A = a.array, B = m.base; for (let i = 0; i < m.seed.length; i++) { const q = m.seed[i], t = now * .0002 + q; A[i * 3] = B[i * 3] + Math.sin(t * 1.3) * .25; A[i * 3 + 1] = B[i * 3 + 1] + Math.sin(t * .9 + q) * .2; A[i * 3 + 2] = B[i * 3 + 2] + Math.cos(t * 1.1) * .25; } a.needsUpdate = true; });
    if (tapRing.visible) { const t = (tapRing.userData.t += dt); tapRing.scale.setScalar(1 + t * 2.5); tapRing.material.opacity = Math.max(0, 1 - t * 2.2); if (t > .5) tapRing.visible = false; }
    fin.uniforms.uT.value = now * .001;
    comp.render(dt);
    // quality guard: a phone that can't keep up gets fewer pixels, then no bloom
    fpsN++; fpsT += dt; if (fpsT > 2) { const fps = fpsN / fpsT; if (showFps) $('#fps').textContent = fps.toFixed(0) + ' fps · ' + PR.toFixed(2);
      if (fps < 40 && now > 6000) { slow++; if (slow >= 2 && tier < 3) { tier++; slow = 0; if (tier === 1) PR = Math.max(1, PR * .8); else if (tier === 2) PR = Math.max(1, PR * .8); else bloom.enabled = false; resize(); } } else slow = 0;
      fpsN = 0; fpsT = 0; }
  };
  requestAnimationFrame(frame);
  window.CITY3D = { W, camera, scene, renderer, MOVES, apply, setPose: (i, m, t) => apply(W.crew[i], MOVES[m](t)) };
}
boot().catch(e => { console.error(e); const el = $('#err'); el.textContent = 'Ошибка: ' + e.message; el.style.display = 'flex'; });
