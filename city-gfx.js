// «Город» — графика (owner 13.11.2026 «надо улучшать» → выбрал вариант 2: чёткая графика, строго сверху, дух ранних top-down игр).
// 13.11.2026, позже: «слишком плоско, уныло» → объём (видны стены), дома разной высоты, граффити на стенах, плотная застройка, цвет.
// Всё рисуется кодом, своё: без чужих спрайтов, брендов и логотипов. Логики игры здесь нет — только картинка.
// Карта рисуется один раз кусками (chunks) в скрытые холсты, люди — в кэш спрайтов (образ × направление × кадр); на экран — копирование.
// Одежда героя берётся из hero.js (HERO.topDown) — второй таблицы одежды здесь нет.
(function () {
  'use strict';
  const TS = 52, CH = 6, SP = 100, KEEP = 12;
  const OR = '#E2611A', WH = '#F2EFE8', INK = '#0E0E10';
  let MAP, MW, MH, dpr = 1, chunks = new Map(), sprites = new Map(), fogCan = null, fogKey = '', darkCan = null, trees = [], lightsStatic = [], comps = [], use = 0, dayNow = 0, wallRects = {}, blanks = [], fenceBlank = new Set();
  const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const tile = (x, y) => x < 0 || y < 0 || x >= MW || y >= MH ? 'F' : MAP[y][x];
  // v2 (owner 13.11.2026 «слишком плоская картинка… добавь объёма… дома разной высоты… граффити на стены… плотнее… добавь красок»):
  // the world is drawn like old strategy maps — you see the roof AND the south wall of everything that has height. A building keeps its
  // cells: the top part of them is the roof, the bottom part (the taller the house, the more) is the wall with windows, doors and graffiti.
  const TALL = '#bGKSDhM';
  const cls = t => t === 'D' ? '#' : t;
  // the ground under a thing
  function groundOf(x, y) {
    const t = tile(x, y);
    if ('.=rgpfa'.includes(t)) return t;
    if (t === 't' || t === 'u') return 'g';
    if (t === 'P') return 'p';
    if (t === 'F') return 'F';
    if (t === 'C') { for (const dx of [-1, 1, -2, 2]) { const n = tile(x + dx, y); if (n === 'r') return 'r'; if (n !== 'C') break; } return '.'; }
    return '.';
  }
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * dpr)); c.height = Math.max(1, Math.round(h * dpr)); const q = c.getContext('2d'); q.scale(dpr, dpr); if (!q.roundRect) q.roundRect = function (x, y, a, b) { this.rect(x, y, a, b); }; return [c, q]; };

  // ================= map =================
  // [wall, wall dark, wall light]
  const WALLS = [['#B8563E', '#8F3F2C', '#DB8D72'], ['#DDA945', '#B5822B', '#F3CE82'], ['#3F9590', '#2C6E6A', '#79C7C1'], ['#CF7592', '#A2526D', '#EDAABF'], ['#5E86C9', '#4264A0', '#97B8EC'], ['#D8D0BC', '#A9A08B', '#F1EBDC'], ['#84A552', '#617C39', '#B3D184'], ['#9A6FC0', '#74509A', '#C4A3E3']];
  // [kind, base, dark, light]
  const ROOFS = [['flat', '#5F5A54', '#2E2B28', '#857E74'], ['tile', '#BF4A2F', '#8F3421', '#E07355'], ['tile', '#3F8261', '#2C5E45', '#66AD8A'], ['metal', '#4E73B0', '#385688', '#7FA2DC'], ['tile', '#6B4E9A', '#4E3774', '#9379C4'], ['flat', '#4F5560', '#262A31', '#737A88'], ['metal', '#B0803A', '#86602A', '#D7A862']];
  const DOORS = ['#6E4A2C', '#2F6B45', '#2B5C8E', '#8E2B2B', '#3A3D45'];
  function setMap(dist, ratio) {
    MAP = dist.map; MH = MAP.length; MW = MAP[0].length; dpr = ratio || 1; chunks.clear(); sprites.clear(); fogKey = ''; trees = []; lightsStatic = []; comps = [];
    // walls for the big graffiti (places with `wall: { x0, x1, row, hmax }`): windows, doors and the random scribbles keep away from them;
    // the piece itself is drawn by the game on top of the map (it changes hands). wallRects[id] = where it goes, in map pixels
    wallRects = {}; fenceBlank = new Set(); blanks = (dist.places || []).filter(p => p.wall).map(p => ({ id: p.id, x0: p.wall.x0, x1: p.wall.x1, row: p.wall.row, hmax: p.wall.hmax || 0 }));
    blanks.forEach(b => { if (MAP[b.row][b.x0] !== 'F') return; for (let x = b.x0; x <= b.x1; x++) fenceBlank.add(b.row * MW + x); wallRects[b.id] = { x: b.x0 * TS + 3, y: (b.row + 1) * TS - 28, w: (b.x1 - b.x0 + 1) * TS - 6, h: 26 }; });
    const done = new Set();
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      const t = MAP[y][x];
      if (t === 't') trees.push([x, y]);
      if (t === 'L') lightsStatic.push({ x: x + .22, y: y + .68, r: 2.9, a: 1 });
      if (t === 'D') lightsStatic.push({ x: x + .5, y: y + 1.25, r: 1.5, a: .8 });
      if (!'#bDhGaKSC'.includes(t) || done.has(y * MW + x)) continue;
      // one thing = the cells of one kind that touch each other (all of them are rectangles on our maps)
      const k = cls(t), q = [[x, y]]; let x0 = x, x1 = x, y0 = y, y1 = y; done.add(y * MW + x);
      for (let i = 0; i < q.length; i++) { const [a, b] = q[i]; x0 = Math.min(x0, a); x1 = Math.max(x1, a); y0 = Math.min(y0, b); y1 = Math.max(y1, b);
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const u = a + dx, v = b + dy; if (u < 0 || v < 0 || u >= MW || v >= MH || done.has(v * MW + u) || cls(MAP[v][u]) !== k) return; if (k === 'C' && dy) return; done.add(v * MW + u); q.push([u, v]); }); }
      const B = { t: k, x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1, seed: x0 * 7 + y0 * 13 + 1 };
      B.blank = blanks.filter(b => b.row >= y0 && b.row <= y1 && b.x0 >= x0 && b.x0 <= x1);
      if ('#bh'.includes(k)) house(B);
      if (k === 'G') B.blank.forEach(b => { const H = B.h * TS, wh = Math.min(64, H - 30); wallRects[b.id] = { x: b.x0 * TS + 8, y: y0 * TS + H - wh + 9, w: (b.x1 - b.x0 + 1) * TS - 16, h: wh - 12 }; });
      if (k === 'K') lightsStatic.push({ x: x0 + 1, y: y0 + 2.1, r: 2.1, a: .9, kiosk: 1, kx: x0, ky: y0 });
      comps.push(B);
    }
    comps.sort((a, b) => (a.y0 + a.h) - (b.y0 + b.h));
  }
  // how a house looks: wall colour, roof, height, windows, doors — everything follows from where it stands
  function house(B) {
    const s = B.seed, H = B.h * TS, W = B.w * TS, X = B.x0 * TS, Y = B.y0 * TS;
    if (B.t === '#') { B.wall = WALLS[0]; B.roof = ROOFS[0]; B.wh = 88; B.brick = 1; }
    else if (B.t === 'b') { B.wall = WALLS[1]; B.roof = ROOFS[5]; B.wh = 136; B.panel = 1; }
    else { B.wall = WALLS[1 + Math.floor(hash(s, 3) * 7)]; B.roof = ROOFS[1 + Math.floor(hash(s, 5) * 6)]; B.wh = [36, 50, 64][Math.floor(hash(s, 7) * 3)]; B.brick = hash(s, 9) < .3; }
    B.wh = Math.min(B.wh, H - 40); B.floors = Math.max(1, Math.round((B.wh - 10) / 26));
    B.doors = []; for (let x = B.x0; x < B.x0 + B.w; x++) if (MAP[B.y0 + B.h - 1][x] === 'D') B.doors.push({ x: X + (x - B.x0 + .5) * TS, home: 1 });
    if (!B.doors.length) { B.doors.push({ x: X + 16 + Math.floor(hash(s, 11) * (W - 32)), col: DOORS[Math.floor(hash(s, 13) * 5)] }); if (B.w > 6) B.doors.push({ x: X + W - 30 - Math.floor(hash(s, 15) * 60), col: DOORS[Math.floor(hash(s, 17) * 5)] }); }
    B.blank.forEach(b => { const hh = Math.min(b.hmax || 1e3, B.wh - 21); b.rect = wallRects[b.id] = { x: b.x0 * TS + 6, y: Y + H - 11 - hh, w: (b.x1 - b.x0 + 1) * TS - 12 - (b.x1 === B.x0 + B.w - 1 ? 8 : 0), h: hh }; });
    const inBlank = (a, b2, yb) => B.blank.some(b => b2 > b.rect.x - 3 && a < b.rect.x + b.rect.w + 3 && (yb === undefined || yb > b.rect.y - 2));
    if (B.blank.length) { B.doors = B.doors.filter(d => d.home || !inBlank(d.x - 13, d.x + 13)); if (!B.doors.length) for (let i = 0; i < B.w; i++) { const dx = X + (i + .5) * TS; if (!inBlank(dx - 13, dx + 13)) { B.doors.push({ x: dx, col: DOORS[Math.floor(hash(s, 13) * 5)] }); break; } } }
    B.shop = B.floors === 1 && hash(s, 19) < .6 && !B.blank.length;
    // graffiti at street level: the ground-floor windows give way to the big pieces
    B.graf = []; const gsc = B.floors > 1 ? .8 : Math.min(1.25, (B.wh - 18) / 15);
    for (let i = 0, n = Math.max(1, Math.round(B.w / 2.2)); i < n; i++) { const big = hash(s + i, 53) < .75, k = 2 + Math.floor(hash(s + i, 55) * 2), gx = X + 8 + (i + hash(s + i, 51) * .6) * (W - 60) / n; B.graf.push({ x: gx, big, k, w: (k * 17 + 2) * (big ? gsc : .7), sc: gsc, seed: s * 3 + i * 11 }); }
    B.graf = B.graf.filter(g => !inBlank(g.x, g.x + g.w));
    B.wins = []; const fp = (B.wh - 16) / B.floors, wh = Math.min(15, fp - 9), n = Math.max(1, Math.floor((W - 12) / 25)), gap = (W - 12 - n * 11) / n, top = Y + H - B.wh + 9;
    for (let f = 0; f < B.floors; f++) for (let i = 0; i < n; i++) {
      const wx = X + 6 + gap / 2 + i * (11 + gap), wy = top + f * fp + (fp - wh) / 2 - 2, gr = f === B.floors - 1;
      if (gr && (B.shop || B.doors.some(d => Math.abs(d.x - wx - 5.5) < 17) || B.graf.some(g => wx + 13 > g.x && wx - 2 < g.x + g.w))) continue;
      if (inBlank(wx - 2, wx + 13, wy + wh)) continue;
      B.wins.push({ x: Math.round(wx), y: Math.round(wy), w: 11, h: Math.round(wh), i, f, gr });
    }
    for (let x = B.x0; x < B.x0 + B.w; x += 2) lightsStatic.push({ x: x + .9, y: B.y0 + B.h + .25, r: 1.15, a: .5, win: 1, sx: x, sy: B.y0 });
  }

  function ground(c, x, y, px, py) {
    const g = groundOf(x, y), h = hash(x, y), R = (a, b, w, hh, col) => { c.fillStyle = col; c.fillRect(a, b, w, hh); }, E = (a, b, rx, ry, col) => { c.fillStyle = col; c.beginPath(); c.ellipse(a, b, rx, ry, 0, 0, 7); c.fill(); };
    if (g === 'F') { R(px, py, TS, TS, '#17181C'); return; }
    if (g === '.') {
      R(px, py, TS, TS, '#4E505B');
      for (let i = 0; i < 14; i++) { const v = hash(x * 31 + i, y * 17 + i); R(px + Math.floor(hash(x + i * 7, y) * TS), py + Math.floor(hash(x, y + i * 13) * TS), v > .8 ? 2 : 1, 1, v < .5 ? 'rgba(0,0,0,.2)' : 'rgba(255,255,255,.09)'); }
      if (tile(x, y) !== '.') return;
      if (h < .05) { c.strokeStyle = '#33343C'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(px + 4, py + 10 + h * 300); for (let i = 1; i < 6; i++) c.lineTo(px + 4 + i * 9, py + 12 + h * 300 + (hash(x + i, y + 5) - .5) * 16); c.stroke(); }
      else if (h < .065) { const pw = 22 + Math.floor(hash(y, x) * 20), ph = 16 + Math.floor(hash(y + 3, x) * 18); R(px + 5, py + 8, pw, ph, 'rgba(20,20,24,.2)'); c.strokeStyle = 'rgba(0,0,0,.22)'; c.lineWidth = 1; c.strokeRect(px + 5.5, py + 8.5, pw, ph); }
      else if (h < .08) { const mx = px + 26, my = py + 26; E(mx, my, 12, 12, '#2B2B30'); E(mx, my, 10, 10, '#676973'); E(mx, my, 8, 8, '#44464F'); c.strokeStyle = '#676973'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(mx - 7, my); c.lineTo(mx + 7, my); c.moveTo(mx, my - 7); c.lineTo(mx, my + 7); c.stroke(); }
      else if (h < .1) { c.fillStyle = '#4C7FB0'; c.beginPath(); c.ellipse(px + 24, py + 28, 19, 9, .15, 0, 7); c.ellipse(px + 36, py + 22, 10, 6, -.3, 0, 7); c.fill(); c.fillStyle = '#6FA3D2'; c.beginPath(); c.ellipse(px + 22, py + 27, 11, 4, .15, 0, 7); c.fill(); c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 1; c.beginPath(); c.ellipse(px + 21, py + 26, 9, 3, .15, 3.4, 5.2); c.stroke(); }
      else if (h < .17) { c.save(); c.translate(px + 10 + h * 150, py + 14 + hash(y, x) * 26); c.rotate(h * 40); R(-2, -1.5, 5, 3, ['#F2EFE8', '#F2CC55', '#7FC4F0', '#F07A62'][Math.floor(h * 1000) % 4]); c.restore(); }
      else if (h < .19) { c.fillStyle = 'rgba(12,12,16,.25)'; c.beginPath(); c.ellipse(px + 26, py + 24, 12, 8, h * 9, 0, 7); c.fill(); }
      else if (h < .225) {   // chalk on the asphalt: hopscotch, a sun, a heart
        const k = Math.floor(h * 1000) % 3, col = ['#FFE27A', '#FF9EC4', '#8FD8FF', '#B5F0A0'][Math.floor(h * 4000) % 4]; c.strokeStyle = col; c.lineWidth = 1.6; c.lineCap = 'round'; c.globalAlpha = .85;
        if (k === 0) { for (let i = 0; i < 4; i++) c.strokeRect(px + 18 + (i === 2 ? -8 : 0), py + 6 + i * 10, i === 2 ? 32 : 16, 10); c.beginPath(); c.moveTo(px + 26, py + 26); c.lineTo(px + 26, py + 36); c.stroke(); }
        else if (k === 1) { c.beginPath(); c.arc(px + 26, py + 26, 8, 0, 7); c.stroke(); for (let i = 0; i < 8; i++) { c.beginPath(); c.moveTo(px + 26 + Math.cos(i * .785) * 11, py + 26 + Math.sin(i * .785) * 11); c.lineTo(px + 26 + Math.cos(i * .785) * 16, py + 26 + Math.sin(i * .785) * 16); c.stroke(); } }
        else { c.beginPath(); c.moveTo(px + 26, py + 36); c.bezierCurveTo(px + 6, py + 22, px + 18, py + 10, px + 26, py + 20); c.bezierCurveTo(px + 34, py + 10, px + 46, py + 22, px + 26, py + 36); c.stroke(); }
        c.globalAlpha = 1;
      }
      else if (h < .26) { for (let i = 0; i < 5; i++) { c.save(); c.translate(px + 8 + hash(x + i, y * 3) * 36, py + 8 + hash(x * 3, y + i) * 36); c.rotate(i * 1.3 + h * 9); E(0, 0, 3.4, 1.8, ['#E8A23A', '#D9622B', '#C9B03A', '#9C5A2A'][i % 4]); c.restore(); } }   // fallen leaves
      return;
    }
    if (g === '=') {
      R(px, py, TS, TS, '#A39C8E'); c.strokeStyle = '#8A8376'; c.lineWidth = 1;
      for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(px + i * 13 + .5, py); c.lineTo(px + i * 13 + .5, py + TS); c.moveTo(px, py + i * 13 + .5); c.lineTo(px + TS, py + i * 13 + .5); c.stroke(); }
      for (let i = 0; i < 4; i++) R(px + Math.floor(hash(x + i, y * 3) * 4) * 13 + 1, py + Math.floor(hash(x * 3, y + i) * 4) * 13 + 1, 12, 12, i % 2 ? 'rgba(190,120,90,.22)' : 'rgba(0,0,0,.08)');
      const lo = (dx, dy) => '.r*cCLBTXak'.includes(tile(x + dx, y + dy));
      if (lo(0, 1)) { R(px, py + TS - 5, TS, 3, '#D2CCBE'); R(px, py + TS - 2, TS, 2, '#6E685D'); }
      if (lo(0, -1)) { R(px, py + 1, TS, 3, '#D2CCBE'); R(px, py, TS, 1, 'rgba(0,0,0,.4)'); }
      if (lo(1, 0)) { R(px + TS - 5, py, 3, TS, '#D2CCBE'); R(px + TS - 2, py, 2, TS, '#6E685D'); }
      if (lo(-1, 0)) { R(px + 1, py, 3, TS, '#D2CCBE'); R(px, py, 1, TS, 'rgba(0,0,0,.4)'); }
      return;
    }
    if (g === 'r') {
      R(px, py, TS, TS, '#383A44');
      for (let i = 0; i < 12; i++) R(px + Math.floor(hash(x + i * 5, y) * TS), py + Math.floor(hash(x, y + i * 11) * TS), 1, 1, hash(x + i, y + i) < .5 ? 'rgba(0,0,0,.25)' : 'rgba(255,255,255,.07)');
      if (tile(x, y - 1) !== 'r' && groundOf(x, y - 1) !== 'r') { R(px, py, TS, 4, '#D2CCBE'); R(px, py + 4, TS, 2, '#6E685D'); if (x % 7 === 3) for (let i = 0; i < 5; i++) R(px + 2 + i * 10, py + 10, 6, TS - 12, 'rgba(242,239,232,.75)'); }
      if (groundOf(x, y + 1) === 'r') { R(px + 6, py + TS - 2, 22, 3, '#F2CC55'); }
      else if (x % 7 === 3) for (let i = 0; i < 5; i++) R(px + 2 + i * 10, py, 6, TS - 12, 'rgba(242,239,232,.75)');   // a zebra crossing
      if (h < .1) { c.fillStyle = 'rgba(12,12,16,.35)'; c.beginPath(); c.ellipse(px + 26, py + 20, 13, 6, h * 30, 0, 7); c.fill(); }
      return;
    }
    if (g === 'g' || g === 'f') {
      R(px, py, TS, TS, '#479A42');
      for (let i = 0; i < 6; i++) E(px + hash(x + i * 3, y + 1) * TS, py + hash(x + 2, y + i * 7) * TS, 7, 5, i % 2 ? 'rgba(110,190,90,.35)' : 'rgba(30,90,40,.25)');
      for (let i = 0; i < 9; i++) R(px + Math.floor(hash(x + i * 3, y + 1) * (TS - 2)), py + Math.floor(hash(x + 2, y + i * 7) * (TS - 4)), 1.5, 3.5, hash(x + i, y - i) > .5 ? '#6DC25F' : '#2F7030');
      for (let i = 0; i < 3; i++) if (hash(x * 5 + i, y * 3) < .5) { const fx = px + 5 + hash(x + i, y * 11) * 42, fy = py + 5 + hash(x * 11, y + i) * 42; E(fx, fy, 1.8, 1.8, ['#FFFFFF', '#FFE27A', '#FF9EC4'][i]); }
      [[0, -1, 0, 0, TS, 3], [0, 1, 0, TS - 3, TS, 3], [-1, 0, 0, 0, 3, TS], [1, 0, TS - 3, 0, 3, TS]].forEach(([dx, dy, a, b, w, hh]) => { const n = groundOf(x + dx, y + dy); if (!'gpf'.includes(n)) R(px + a, py + b, w, hh, dy > 0 || dx > 0 ? '#2B6A2C' : '#7BCB6A'); });
      if (g === 'f') {   // a flower bed
        c.fillStyle = '#C9C2B0'; c.beginPath(); c.roundRect(px + 4, py + 6, TS - 8, TS - 12, 12); c.fill(); c.fillStyle = '#5A3B25'; c.beginPath(); c.roundRect(px + 7, py + 9, TS - 14, TS - 18, 10); c.fill();
        const pal = [['#FF4F6A', '#FFD23F'], ['#FFD23F', '#F58A1F'], ['#B58CFF', '#FFFFFF'], ['#FF8FC2', '#FFF3A0']][Math.floor(h * 4)];
        for (let i = 0; i < 12; i++) { const fx = px + 12 + hash(x + i * 3, y + 7) * (TS - 24), fy = py + 13 + hash(x + 7, y + i * 5) * (TS - 28); E(fx, fy + 2, 3, 2.2, '#2F7A34'); E(fx, fy, 3.2, 3.2, pal[i % 2]); E(fx, fy, 1.2, 1.2, i % 2 ? '#7A3A12' : '#FFF6C8'); }
      }
      return;
    }
    if (g === 'p') {
      R(px, py, TS, TS, '#E0BE6E');
      for (let i = 0; i < 16; i++) R(px + Math.floor(hash(x + i * 5, y + 3) * TS), py + Math.floor(hash(x + 1, y + i * 9) * TS), 1, 1, hash(x - i, y + i) > .5 ? '#F4D991' : '#B9954A');
      [[0, -1, 0, 0, TS, 5], [0, 1, 0, TS - 5, TS, 5], [-1, 0, 0, 0, 5, TS], [1, 0, TS - 5, 0, 5, TS]].forEach(([dx, dy, a, b, w, hh], i) => { if (groundOf(x + dx, y + dy) !== 'p') { R(px + a, py + b, w, hh, ['#D9622B', '#3F8FD8', '#F2CC55', '#3BB86A'][i]); R(px + a, py + b, dx ? 1.5 : w, dx ? hh : 1.5, 'rgba(255,255,255,.3)'); } });   // a painted wooden border
      if (h < .25) { c.strokeStyle = '#B9954A'; c.lineWidth = 1; c.beginPath(); c.arc(px + 26, py + 26, 8, 0, 7); c.stroke(); }   // a footprint circle of somebody's spin
      else if (h < .4) { E(px + 30, py + 30, 6, 4, 'rgba(0,0,0,.2)'); R(px + 22, py + 20, 9, 8, '#E2483A'); R(px + 22, py + 20, 9, 2.5, '#F47A6A'); c.strokeStyle = '#F2CC55'; c.lineWidth = 1.6; c.beginPath(); c.arc(px + 26.5, py + 20, 4, Math.PI, 0); c.stroke(); }   // a toy bucket
      return;
    }
    if (g === 'a') {   // the sports court: painted, the cypher spot of the yard
      R(px, py, TS, TS, '#2F78B8');
      for (let i = 0; i < 10; i++) R(px + Math.floor(hash(x + i * 5, y + 3) * TS), py + Math.floor(hash(x + 1, y + i * 9) * TS), 2, 1, hash(x - i, y + i) > .5 ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.12)');
    }
  }
  const CARS = [['#D0352F', '#E85A4E'], ['#2F7BD0', '#56A0EC'], ['#F2EFE8', '#FFFFFF'], ['#F2B31F', '#FFD35A'], ['#2FA860', '#55CC84'], ['#7B4FC4', '#A07BE0']];
  function car(c, cx0, cy0, col) {
    const R = (a, b, w, hh, k) => { c.fillStyle = k; c.fillRect(a, b, w, hh); };
    c.save(); c.translate(cx0, cy0); c.fillStyle = 'rgba(0,0,0,.34)'; c.beginPath(); c.roundRect(-38, -12, 92, 42, 10); c.fill();
    c.fillStyle = '#16161A'; c.beginPath(); c.roundRect(-44, -20, 88, 42, 10); c.fill();
    c.fillStyle = col[0]; c.beginPath(); c.roundRect(-42.5, -14, 85, 34.5, 8); c.fill();                                   // the side you see
    c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.roundRect(-42.5, 10, 85, 10.5, [0, 0, 8, 8]); c.fill(); R(-30, 13, 10, 8, '#16161A'); R(20, 13, 10, 8, '#16161A'); R(-28, 15, 6, 4, '#8A8D95'); R(22, 15, 6, 4, '#8A8D95');
    c.fillStyle = col[0]; c.beginPath(); c.roundRect(-42.5, -18.5, 85, 30, 9); c.fill(); c.fillStyle = 'rgba(255,255,255,.14)'; c.beginPath(); c.roundRect(-42.5, -18.5, 85, 10, [9, 9, 0, 0]); c.fill();
    c.fillStyle = col[1]; c.beginPath(); c.roundRect(-14, -15, 34, 23, 5); c.fill();
    c.fillStyle = '#243A52'; c.beginPath(); c.moveTo(-24, -15); c.lineTo(-14, -13); c.lineTo(-14, 6); c.lineTo(-24, 8); c.fill(); c.beginPath(); c.moveTo(27, -15); c.lineTo(20, -13); c.lineTo(20, 6); c.lineTo(27, 8); c.fill();
    R(-12, -17, 30, 2.4, '#243A52'); R(-12, 8, 30, 2.4, '#243A52'); R(-42, -15, 3, 8, '#FFF3B8'); R(-42, 1, 3, 8, '#FFF3B8'); R(39.5, -15, 3, 7, '#FF3B4A'); R(39.5, 2, 3, 7, '#FF3B4A'); R(-19, -22, 4, 3, '#16161A');
    R(-8, -10, 20, 2, 'rgba(255,255,255,.3)'); c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(-22, -12, 4, 10);
    c.restore();
  }
  const TAGS = [[[0, 14], [6, 0], [12, 14], [18, 2], [24, 14]], [[0, 2], [0, 14], [10, 14]], [[0, 2], [12, 2], [0, 14], [14, 14]], [[0, 14], [0, 2], [12, 8], [0, 10]], [[12, 2], [0, 4], [12, 12], [0, 14]], [[0, 2], [6, 14], [12, 2]], [[0, 14], [0, 2], [10, 2], [10, 14], [0, 14]], [[0, 2], [0, 14], [8, 8], [12, 14], [12, 2]]];
  const SPRAY = ['#FF6A1F', '#3BE07A', '#4FC0FF', '#FF4F9A', '#FFD93B', '#B58CFF', '#FF3B4A', '#3BE0D0'];
  function tag(c, x, y, seed, sc, lw) {
    c.save(); c.translate(x, y); c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round';
    for (let i = 0; i < 3; i++) { const pts = TAGS[Math.floor(hash(seed * 13 + i * 7, seed + i * 31) * 8)]; c.strokeStyle = SPRAY[Math.floor(hash(seed + i * 5, seed * 7 + i) * 8)]; c.beginPath(); pts.forEach((p, j) => j ? c.lineTo(i * 17 + p[0], p[1] * sc) : c.moveTo(i * 17 + p[0], p[1] * sc)); c.stroke(); }
    c.restore();
  }
  // a big graffiti piece: fat letters with an outline, a colour cloud behind, a shine on top (our own made-up letters)
  function piece(c, x, y, seed, sc, n) {
    const col = SPRAY[Math.floor(hash(seed, 3) * 8)], col2 = SPRAY[Math.floor(hash(seed, 9) * 8)], col3 = SPRAY[Math.floor(hash(seed, 21) * 8)];
    c.save(); c.translate(x, y); c.lineCap = 'round'; c.lineJoin = 'round';
    c.globalAlpha = .6; c.fillStyle = col2 === col ? '#F2EFE8' : col2; c.beginPath(); c.ellipse(n * 8 * sc, 8 * sc, (n * 9 + 5) * sc, 11 * sc, 0, 0, 7); c.fill(); c.globalAlpha = 1;
    for (let i = 0; i < 5; i++) { c.fillStyle = col3; c.beginPath(); c.arc(hash(seed + i, 4) * n * 17 * sc, hash(seed, i + 6) * 18 * sc - 2, 1.4 * sc, 0, 7); c.fill(); }
    [[INK, 6.4], [col, 3.8], ['rgba(255,255,255,.6)', .9]].forEach(([k, w], ps) => { c.strokeStyle = k; c.lineWidth = w * sc;
      for (let i = 0; i < n; i++) { const pts = TAGS[Math.floor(hash(seed * 13 + i * 7, seed + i * 31) * 8)]; c.beginPath(); pts.forEach((p, j) => { const a = (i * 17 + p[0]) * sc - (ps === 2 ? sc : 0), b = p[1] * sc - (ps === 2 ? sc : 0); j ? c.lineTo(a, b) : c.moveTo(a, b); }); c.stroke(); } });
    c.restore();
  }
  // the shadow of a box that stands on the ground: falls to the right and a little down
  function boxShadow(c, X, Y, W, H, wh) { const s = wh * .42; c.fillStyle = 'rgba(8,10,24,.3)'; c.beginPath(); c.moveTo(X + W, Y + H - wh * .2 - 4); c.lineTo(X + W + s, Y + H - wh * .2 + s * .5); c.lineTo(X + W + s, Y + H + s * .5); c.lineTo(X + s, Y + H + s * .5); c.lineTo(X, Y + H); c.lineTo(X + W, Y + H); c.fill(); }
  function contact(c, X, Y, W) { const g = c.createLinearGradient(0, Y, 0, Y + 8); g.addColorStop(0, 'rgba(0,0,0,.34)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(X, Y, W, 8); }

  function drawHouse(c, B) {
    const X = B.x0 * TS, Y = B.y0 * TS, W = B.w * TS, H = B.h * TS, wh = B.wh, ry = H - wh, s = B.seed, rf = B.roof, wc = B.wall;
    const R = (a, b, w, hh, col) => { c.fillStyle = col; c.fillRect(a, b, w, hh); }, E = (a, b, rx, r2, col) => { c.fillStyle = col; c.beginPath(); c.ellipse(a, b, rx, r2, 0, 0, 7); c.fill(); };
    // ---- roof ----
    R(X, Y, W, ry, rf[1]);
    if (rf[0] === 'flat') {
      for (let i = 0; i < B.w * 6; i++) R(X + 6 + hash(s + i, 41) * (W - 20), Y + 4 + hash(s + i, 42) * (ry - 10), 3 + hash(s + i, 43) * 9, 1, 'rgba(0,0,0,.14)');
      for (let x = 1; x < B.w; x += 2) R(X + x * TS, Y, 1, ry, 'rgba(0,0,0,.2)');
      for (let j = 0; (j + 1) * TS <= ry + 14; j++) for (let i = 0; i < B.w; i++) {
        const k = hash(s + i * 5, j * 9 + 2), a = X + i * TS, b = Y + j * TS + (ry < TS ? (ry - TS) / 2 : 0);
        if (k < .12) { R(a + 17, b + 19, 20, 17, 'rgba(0,0,0,.35)'); R(a + 14, b + 15, 20, 17, '#A8A6A0'); R(a + 16, b + 17, 16, 13, '#6E6C68'); for (let q = 0; q < 4; q++) R(a + 17, b + 18.5 + q * 3, 14, 1.2, '#2B2A29'); }
        else if (k < .2) { E(a + 30, b + 30, 13, 11, 'rgba(0,0,0,.3)'); E(a + 26, b + 26, 13, 13, '#2E6FA8'); E(a + 26, b + 26, 10.5, 10.5, '#4F9AD8'); E(a + 23, b + 22, 4, 3, 'rgba(255,255,255,.5)'); }                 // a water tank
        else if (k < .27) { c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(a + 24, b + 36); c.lineTo(a + 40, b + 44); c.stroke(); c.strokeStyle = '#E6E3DA'; c.beginPath(); c.moveTo(a + 24, b + 10); c.lineTo(a + 24, b + 36); c.moveTo(a + 15, b + 16); c.lineTo(a + 33, b + 16); c.moveTo(a + 17, b + 23); c.lineTo(a + 31, b + 23); c.stroke(); }
        else if (k < .35) { E(a + 29, b + 30, 9, 7, 'rgba(0,0,0,.3)'); E(a + 26, b + 26, 9, 9, '#F2EFE8'); E(a + 26, b + 26, 6.5, 6.5, '#C9CCD2'); E(a + 26, b + 26, 1.6, 1.6, '#3A3D45'); c.strokeStyle = '#3A3D45'; c.lineWidth = 1; c.beginPath(); c.moveTo(a + 26, b + 26); c.lineTo(a + 32, b + 20); c.stroke(); }   // a dish
        else if (k < .43) { R(a + 12, b + 14, 28, 22, rf[2]); R(a + 14, b + 16, 24, 18, '#3F6A94'); R(a + 25.5, b + 16, 1.5, 18, rf[2]); R(a + 15, b + 17, 8, 3, 'rgba(255,255,255,.3)'); }
        else if (k < .52) { for (let q = 0; q < 3; q++) { E(a + 14 + q * 12, b + 30, 5, 4, 'rgba(0,0,0,.25)'); E(a + 12 + q * 12, b + 27, 5, 5, '#B5533C'); E(a + 12 + q * 12, b + 26, 4.4, 4.4, '#3FA845'); E(a + 11 + q * 12, b + 25, 1.6, 1.6, ['#FF4F6A', '#FFD23F', '#FFFFFF'][q]); } }      // pots with flowers
        else if (k < .58) { R(a + 12, b + 14, 13, 26, 'rgba(0,0,0,.25)'); for (let q = 0; q < 6; q++) R(a + 10, b + 11 + q * 4.2, 13, 4.2, q % 2 ? '#F2EFE8' : '#E2483A'); R(a + 30, b + 16, 10, 10, '#F2CC55'); R(a + 30, b + 16, 10, 2, '#FFE9A0'); }   // a deck chair and a crate
        else if (k < .64) { c.strokeStyle = '#D9D4C7'; c.lineWidth = 1; c.beginPath(); c.moveTo(a + 4, b + 16); c.lineTo(a + 48, b + 20); c.stroke(); ['#FF4F6A', '#F2EFE8', '#4FC0FF', '#FFD23F'].forEach((col, q) => R(a + 8 + q * 10, b + 17 + q * .9, 7, 10 + (q % 2) * 3, col)); }             // laundry
      }
      R(X, Y, W, 5, rf[3]); R(X, Y, 5, ry, rf[3]); R(X + W - 5, Y, 5, ry, rf[3]); R(X, Y + ry - 5, W, 5, rf[3]); R(X, Y, W, 1.5, rf[2]); R(X, Y, 1.5, ry, rf[2]); R(X + W - 1.5, Y, 1.5, ry, rf[2]); R(X + 5, Y + 5, W - 10, 2, 'rgba(0,0,0,.25)');
    } else {
      const rg = Math.round(ry * .42);
      R(X, Y, W, rg, rf[2]); R(X, Y + rg, W, ry - rg, rf[1]);
      if (rf[0] === 'tile') { for (let b = 2; b < ry; b += 5) R(X, Y + b, W, 1, 'rgba(0,0,0,.2)'); for (let b = 0; b < ry; b += 5) for (let a = (b / 5 % 2) * 4; a < W; a += 8) R(X + a, Y + b, 1, 5, 'rgba(0,0,0,.13)'); for (let i = 0; i < B.w * 5; i++) R(X + hash(s + i, 71) * (W - 8), Y + Math.floor(hash(s + i, 72) * ry / 5) * 5 + 3, 7, 4, hash(s + i, 73) > .5 ? 'rgba(255,255,255,.14)' : 'rgba(0,0,0,.12)'); }
      else { for (let a = 0; a < W; a += 7) R(X + a, Y, 3, ry, 'rgba(0,0,0,.14)'); for (let i = 0; i < B.w; i++) E(X + 12 + hash(s + i, 81) * (W - 24), Y + 8 + hash(s + i, 82) * (ry - 16), 6, 4, 'rgba(150,80,40,.4)'); }
      R(X, Y + rg - 2, W, 3, rf[3]); R(X, Y + rg + 1, W, 1.5, 'rgba(0,0,0,.3)'); R(X, Y, 3, ry, rf[2]); R(X + W - 3, Y, 3, ry, rf[2]); R(X, Y, W, 2, rf[2]); R(X, Y + ry - 3, W, 3, rf[2]);
      const chx = X + 14 + Math.floor(hash(s, 91) * (W - 40)); R(chx + 4, Y + 6, 14, 14, 'rgba(0,0,0,.3)'); R(chx, Y + 3, 13, 14, '#8F3F2C'); R(chx, Y + 3, 13, 4, '#C9C2B0'); R(chx + 3, Y + 4, 7, 2, '#2B2A29');     // a chimney
      if (B.w > 2) { const dx = X + W - 34 - Math.floor(hash(s, 93) * 20); R(dx, Y + rg + 5, 20, ry - rg - 8, rf[2]); R(dx + 2, Y + rg + 8, 16, ry - rg - 13, wc[2]); R(dx + 5, Y + rg + 10, 10, ry - rg - 17, '#3F6A94'); }   // a dormer window
    }
    // ---- wall ----
    const WY = Y + ry;
    R(X, WY, W, wh, wc[0]);
    if (B.brick) { for (let b = 5; b < wh; b += 5) R(X, WY + b, W, 1, 'rgba(0,0,0,.14)'); for (let b = 0; b < wh; b += 5) for (let a = (b / 5 % 2) * 5; a < W; a += 10) R(X + a, WY + b, 1, 5, 'rgba(0,0,0,.1)'); }
    else if (B.panel) { for (let a = TS; a < W; a += TS) R(X + a, WY, 1.5, wh, 'rgba(0,0,0,.16)'); for (let f = 1; f < B.floors; f++) R(X, WY + 9 + f * (wh - 16) / B.floors - 2, W, 1.5, 'rgba(0,0,0,.14)'); }
    else for (let i = 0; i < B.w * 3; i++) E(X + hash(s + i, 31) * W, WY + hash(s + i, 32) * wh, 9, 5, i % 2 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.06)');
    R(X, WY, W, 3, wc[2]); { const g = c.createLinearGradient(0, WY + 3, 0, WY + 11); g.addColorStop(0, 'rgba(0,0,0,.32)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(X, WY + 3, W, 8); }
    { const g = c.createLinearGradient(X + W - 14, 0, X + W, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.26)'); c.fillStyle = g; c.fillRect(X + W - 14, WY, 14, wh); } R(X, WY, 2, wh, 'rgba(255,255,255,.14)');
    R(X, Y + H - 8, W, 8, wc[1]); R(X, Y + H - 8, W, 1, 'rgba(255,255,255,.16)'); R(X, Y + H - 1.5, W, 1.5, 'rgba(0,0,0,.5)');
    R(X + W - 9, WY + 3, 3, wh - 4, '#8A8D95'); R(X + W - 9, WY + 3, 1, wh - 4, '#C9CCD2');                                // a drainpipe
    // graffiti on the wall, at street level (drawn before the windows and doors: they stay on top)
    const gy = Y + H - 9 - (B.floors > 1 ? 15 : Math.min(26, wh - 16));
    B.graf.forEach(g => { if (B.doors.some(d => d.x + 12 > g.x && d.x - 12 < g.x + g.w)) return; if (g.big) piece(c, g.x, gy, g.seed, g.sc, g.k); else tag(c, g.x, gy + 2, g.seed, .7, 2.4); });
    // ---- windows ----
    B.wins.forEach(w => {
      const k = hash(w.i * 7 + s, w.f * 5 + 3);
      if (B.floors >= 3 && !w.gr && w.f > 0 && w.i % 3 === 1) {                                                                // a balcony with laundry
        R(w.x - 6, w.y + w.h - 1, w.w + 12, 10, 'rgba(0,0,0,.25)'); R(w.x - 7, w.y + w.h - 3, w.w + 14, 9, '#3A3D45'); for (let q = 0; q < 6; q++) R(w.x - 6 + q * 4.2, w.y + w.h - 2, 1.4, 7, '#9A9DA6'); R(w.x - 7, w.y + w.h - 3, w.w + 14, 1.5, '#C9CCD2');
        if (k < .6) [SPRAY[Math.floor(k * 13) % 8], '#F2EFE8', SPRAY[Math.floor(k * 29) % 8]].forEach((col, q) => R(w.x - 5 + q * 7, w.y + w.h - 9, 5, 7 + q % 2 * 2, col));
      }
      R(w.x - 2, w.y - 2, w.w + 4, w.h + 4, wc[2]); R(w.x, w.y, w.w, w.h, '#2C4866'); R(w.x, w.y, w.w, Math.round(w.h * .45), '#4F86B8'); R(w.x + w.w / 2 - .5, w.y, 1.2, w.h, wc[2]); R(w.x, w.y + Math.round(w.h * .45), w.w, 1, wc[2]);
      if (k < .3) { const cc = ['#FF8FA8', '#FFE08A', '#F2EFE8', '#9AD9B0'][Math.floor(k * 13)]; R(w.x, w.y, 3, w.h, cc); R(w.x + w.w - 3, w.y, 3, w.h, cc); }
      R(w.x - 3, w.y + w.h + 2, w.w + 6, 2, wc[1]);
      if (k > .82) { R(w.x - 2, w.y + w.h, w.w + 4, 4, '#5A3A22'); for (let q = 0; q < 4; q++) { E(w.x + q * 3.6, w.y + w.h - .5, 2.2, 2.2, '#3FA845'); E(w.x + q * 3.6, w.y + w.h - 1.5, 1.1, 1.1, ['#FF4F6A', '#FFD23F', '#FFFFFF', '#FF8FC2'][q]); } }
      else if (k > .72 && !w.gr) { R(w.x + 1, w.y + w.h + 4, 10, 6, '#E3E5EA'); R(w.x + 2, w.y + w.h + 5, 8, 4, '#8A8D95'); }
    });
    // ---- doors ----
    B.doors.forEach(d => {
      const top = Y + H - Math.min(30, wh - 6);
      if (B.shop && !d.home) {   // a little shop front: a wide window, a striped awning
        const a = Math.max(X + 4, Math.min(d.x - 8, X + W - 50)), sc = [['#E2483A', '#F2EFE8'], ['#3F8FD8', '#F2EFE8'], ['#3BB86A', '#FFE08A'], ['#F2B31F', '#7B4FC4']][Math.floor(hash(s, 61) * 4)];
        R(a, top + 6, 46, Y + H - top - 8, '#2B2A29'); R(a + 2, top + 8, 26, Y + H - top - 14, '#4F86B8'); R(a + 2, top + 8, 26, 5, '#8FC0E8'); R(a + 30, top + 8, 14, Y + H - top - 10, d.col); R(a + 40, top + 18, 2, 2, '#F2CC55');
        ['#FF4F6A', '#FFD23F', '#3BE07A'].forEach((col, q) => R(a + 5 + q * 8, Y + H - 14, 6, 6, col));
        for (let q = 0; q < 7; q++) { c.fillStyle = sc[q % 2]; c.beginPath(); c.moveTo(a - 3 + q * 7.4, top - 2); c.lineTo(a - 3 + q * 7.4 + 7.4, top - 2); c.lineTo(a - 5 + q * 7.8 + 7.8, top + 9); c.lineTo(a - 5 + q * 7.8, top + 9); c.fill(); } R(a - 5, top + 9, 55, 2, 'rgba(0,0,0,.3)');
        return;
      }
      R(d.x - 11, top - 1, 22, Y + H - top, wc[1]); R(d.x - 9, top + 1, 18, Y + H - top - 1, d.home ? '#8E3A12' : d.col); R(d.x - 9, top + 1, 18, 2, 'rgba(255,255,255,.2)'); R(d.x - 6, top + 4, 5, 8, d.home ? '#FFD35A' : '#4F86B8'); R(d.x + 1, top + 4, 5, 8, d.home ? '#FFD35A' : '#4F86B8'); R(d.x + 5, top + 16, 2, 2.4, '#F2CC55');
      if (d.home) { R(d.x - 17, top - 8, 38, 9, 'rgba(0,0,0,.3)'); R(d.x - 19, top - 11, 38, 9, '#B44812'); R(d.x - 19, top - 11, 38, 7, OR); for (let q = 0; q < 4; q++) R(d.x - 16 + q * 10, top - 11, 4, 7, 'rgba(255,255,255,.22)'); R(d.x - 13, Y + H - 2, 26, 7, '#3A2E28'); R(d.x - 11, Y + H, 22, 4, '#5A4638'); }
      else { R(d.x - 13, top - 5, 26, 4, wc[2]); R(d.x - 13, top - 1, 26, 2, 'rgba(0,0,0,.3)'); }
    });
    contact(c, X, Y + H, W);
  }
  const GAR = [['#8E4B3A', '#D9622B'], ['#3F6E7A', '#3FB8C4'], ['#8A7434', '#F2B31F'], ['#5C5F69', '#3F8FD8'], ['#6B4A6E', '#C96FD0'], ['#4A6E4F', '#3BB86A']];
  function drawGarages(c, B) {
    const X = B.x0 * TS, Y = B.y0 * TS, W = B.w * TS, H = B.h * TS, wh = Math.min(64, H - 30), ry = H - wh, R = (a, b, w, hh, col) => { c.fillStyle = col; c.fillRect(a, b, w, hh); }, E = (a, b, rx, r2, col) => { c.fillStyle = col; c.beginPath(); c.ellipse(a, b, rx, r2, 0, 0, 7); c.fill(); };
    R(X, Y + ry, W, wh, '#7A7B84'); for (let b = 6; b < wh; b += 6) R(X, Y + ry + b, W, 1, 'rgba(0,0,0,.1)');
    for (let u = 0; u * 2 < B.w; u++) {
      const a = X + u * 2 * TS, uw = Math.min(2, B.w - u * 2) * TS, g = GAR[Math.floor(hash(u + B.x0, B.y0) * 6)];
      R(a, Y, uw, ry, g[0]); for (let i = 0; i * 6 < uw; i++) R(a + i * 6, Y, 3, ry, 'rgba(0,0,0,.16)'); R(a, Y, uw, ry * .4, 'rgba(255,255,255,.07)');
      for (let i = 0; i < 3; i++) if (hash(u * 3 + i, B.x0) < .6) E(a + 10 + hash(u + i, 5) * (uw - 20), Y + 8 + hash(u, i + 7) * (ry - 16), 5 + hash(i, u) * 8, 3 + hash(u, i) * 5, 'rgba(150,80,40,.5)');
      R(a, Y, 2.5, ry, '#26262A'); R(a, Y, uw, 2.5, '#26262A'); R(a, Y + ry - 3, uw, 3, '#26262A'); R(a + uw - 2, Y, 2, ry, 'rgba(0,0,0,.3)');
      // the door you see from the yard: faded paint, a piece of graffiti across it, a number plate
      R(a + 5, Y + ry + 6, uw - 10, wh - 7, '#26262A'); R(a + 7, Y + ry + 8, uw - 14, wh - 9, g[1]); for (let b = 0; b < wh - 12; b += 6) R(a + 7, Y + ry + 12 + b, uw - 14, 1.2, 'rgba(0,0,0,.25)'); R(a + 7, Y + ry + 8, uw - 14, 3, 'rgba(255,255,255,.2)'); R(a + uw / 2 - .75, Y + ry + 8, 1.5, wh - 9, 'rgba(0,0,0,.35)');
      for (let i = 0; i < 3; i++) E(a + 14 + hash(u + i, 9) * (uw - 28), Y + ry + 14 + hash(u, i + 11) * (wh - 22), 8, 5, 'rgba(120,70,40,.28)');
      if (uw > TS && !(B.blank || []).some(b => b.x0 <= B.x0 + u * 2 + 1 && b.x1 >= B.x0 + u * 2)) { if (hash(u, B.x0 + 3) < .8) piece(c, a + 14, Y + ry + 14, u * 7 + B.x0 + 2, 1.35, 3); else tag(c, a + 20, Y + ry + 18, u * 7 + B.x0, 1.2, 3.4); }
      R(a + uw / 2 - 8, Y + ry + 1, 16, 7, '#F2EFE8'); R(a + uw / 2 - 5, Y + ry + 3, 10, 3, '#26262A'); R(a + uw / 2 + 3, Y + H - 16, 5, 4, '#F2CC55');
    }
    { const g = c.createLinearGradient(0, Y + ry, 0, Y + ry + 9); g.addColorStop(0, 'rgba(0,0,0,.4)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(X, Y + ry, W, 9); }
    R(X, Y + H - 1.5, W, 1.5, 'rgba(0,0,0,.5)'); contact(c, X, Y + H, W);
  }
  function drawKiosk(c, B) {
    const X = B.x0 * TS, Y = B.y0 * TS, W = B.w * TS, H = B.h * TS, wh = 56, ry = H - wh, R = (a, b, w, hh, col) => { c.fillStyle = col; c.fillRect(a, b, w, hh); }, E = (a, b, rx, r2, col) => { c.fillStyle = col; c.beginPath(); c.ellipse(a, b, rx, r2, 0, 0, 7); c.fill(); };
    R(X, Y, W, ry, '#C8402E'); for (let i = 0; i * 7 < W; i++) R(X + i * 7, Y, 3, ry, 'rgba(0,0,0,.14)'); R(X, Y, W, 3, '#7A2418'); R(X, Y, 3, ry, '#7A2418'); R(X + W - 3, Y, 3, ry, '#7A2418'); R(X, Y, W, ry * .4, 'rgba(255,255,255,.08)');
    R(X + 64, Y + 12, 22, 17, 'rgba(0,0,0,.3)'); R(X + 61, Y + 9, 22, 17, '#C9CCD2'); R(X + 63, Y + 11, 18, 13, '#6E6C68'); for (let i = 0; i < 4; i++) R(X + 64, Y + 12.5 + i * 3, 16, 1.2, '#2B2A29');
    E(X + 30, Y + 24, 5, 5, '#3A3D45'); E(X + 30, Y + 24, 3, 3, '#16161A'); c.fillStyle = 'rgba(255,255,255,.25)'; c.beginPath(); c.ellipse(X + 26, Y + 14, 7, 5, .4, 0, 7); c.ellipse(X + 20, Y + 6, 5, 4, .2, 0, 7); c.fill();    // the chimney smokes
    R(X, Y + ry, W, wh, '#EFE3C4'); for (let b = 7; b < wh; b += 7) R(X, Y + ry + b, W, 1, 'rgba(0,0,0,.07)'); R(X, Y + H - 8, W, 8, '#B5533C'); R(X + W - 12, Y + ry, 12, wh, 'rgba(0,0,0,.12)');
    R(X + 8, Y + ry + 16, 62, 26, '#2B241B'); R(X + 10, Y + ry + 18, 58, 22, '#4A2F1C'); R(X + 10, Y + ry + 18, 58, 8, '#FFB13B');                                                           // the serving window
    c.fillStyle = '#8E4A1F'; c.beginPath(); c.moveTo(X + 20, Y + ry + 22); c.lineTo(X + 30, Y + ry + 22); c.lineTo(X + 27, Y + ry + 38); c.lineTo(X + 23, Y + ry + 38); c.fill(); R(X + 24.4, Y + ry + 19, 1.2, 21, '#C9CCD2');           // the spit
    ['#3BE07A', '#FF4F6A', '#FFD23F', '#F2EFE8'].forEach((col, i) => R(X + 38 + i * 7.4, Y + ry + 30, 6, 8, col)); R(X + 6, Y + ry + 42, 66, 4, '#8A6A40'); R(X + 6, Y + ry + 42, 66, 1.2, '#C8A066');
    R(X + 78, Y + ry + 14, 18, wh - 15, '#2B241B'); R(X + 80, Y + ry + 16, 14, wh - 17, '#3F8FD8'); R(X + 82, Y + ry + 19, 10, 9, '#8FC0E8'); R(X + 90, Y + ry + 34, 2, 2.4, '#F2CC55');
    for (let i = 0; i < 9; i++) { c.fillStyle = i % 2 ? WH : OR; c.beginPath(); c.moveTo(X - 2 + i * 12, Y + ry - 2); c.lineTo(X - 2 + i * 12 + 12, Y + ry - 2); c.lineTo(X - 5 + i * 12.6 + 12.6, Y + ry + 13); c.lineTo(X - 5 + i * 12.6, Y + ry + 13); c.fill(); }
    R(X - 5, Y + ry + 13, W + 9, 2.4, 'rgba(0,0,0,.32)');
    R(X + 22, Y + ry - 20, 60, 17, '#16161A'); R(X + 24, Y + ry - 18, 56, 13, '#FFD23F'); c.fillStyle = '#F2E2B8'; c.beginPath(); c.moveTo(X + 30, Y + ry - 16); c.lineTo(X + 48, Y + ry - 12); c.lineTo(X + 33, Y + ry - 7); c.fill(); R(X + 35, Y + ry - 14, 7, 2, '#3BB86A'); R(X + 35, Y + ry - 11, 6, 1.8, '#E2483A'); R(X + 54, Y + ry - 15, 20, 2.4, '#16161A'); R(X + 54, Y + ry - 10.5, 14, 2.4, '#16161A');   // the sign: a drawn wrap
    contact(c, X, Y + H, W);
  }
  function drawTent(c, B) {
    const px = B.x0 * TS, py = B.y0 * TS, s = TS, mx = px + s, my = py + s - 8, r = s - 3, R = (a, b, w, hh, col) => { c.fillStyle = col; c.fillRect(a, b, w, hh); }, E = (a, b, rx, r2, col) => { c.fillStyle = col; c.beginPath(); c.ellipse(a, b, rx, r2, 0, 0, 7); c.fill(); };
    R(px + 16, py + s * 2 - 24, 72, 22, '#16161A'); R(px + 18, py + s * 2 - 22, 68, 8, '#A47E4C'); R(px + 18, py + s * 2 - 14, 68, 10, '#6E4A2C'); R(px + 18, py + s * 2 - 14, 68, 1.5, 'rgba(0,0,0,.3)');
    [[OR, 0], [WH, 13], ['#3F8FD8', 26], ['#E2483A', 39], ['#3BE07A', 52]].forEach(([col, o]) => { R(px + 22 + o, py + s * 2 - 21, 10, 6, col); R(px + 22 + o, py + s * 2 - 21, 10, 1.5, 'rgba(255,255,255,.35)'); });
    R(mx - 1.5, my, 3, s - 8, '#C9CCD2');
    for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#2F8FD8' : WH; c.beginPath(); c.moveTo(mx, my); const a = i * Math.PI / 4 + Math.PI / 8, b = a + Math.PI / 4; c.lineTo(mx + Math.cos(a) * r, my + Math.sin(a) * r * .82); c.quadraticCurveTo(mx + Math.cos((a + b) / 2) * r * .9, my + Math.sin((a + b) / 2) * r * .74, mx + Math.cos(b) * r, my + Math.sin(b) * r * .82); c.fill(); }
    c.strokeStyle = 'rgba(0,0,0,.28)'; c.lineWidth = 1; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + Math.PI / 8; c.beginPath(); c.moveTo(mx, my); c.lineTo(mx + Math.cos(a) * r, my + Math.sin(a) * r * .82); c.stroke(); }
    const g = c.createRadialGradient(mx - 8, my - 12, 2, mx, my, r); g.addColorStop(0, 'rgba(255,255,255,.3)'); g.addColorStop(1, 'rgba(0,0,0,.22)'); c.fillStyle = g; c.beginPath(); c.ellipse(mx, my, r, r * .82, 0, 0, 7); c.fill(); E(mx, my, 4, 3.4, '#16161A'); E(mx, my, 2.4, 2, OR);
  }
  function drawCourt(c, B) {
    const X = B.x0 * TS, Y = B.y0 * TS, W = B.w * TS, H = B.h * TS, R = (a, b, w, hh, col) => { c.fillStyle = col; c.fillRect(a, b, w, hh); };
    R(X + 5, Y + 5, 40, H - 10, '#D9523A'); R(X + W - 45, Y + 5, 40, H - 10, '#D9523A');
    c.strokeStyle = 'rgba(242,239,232,.9)'; c.lineWidth = 2.4; c.strokeRect(X + 5, Y + 5, W - 10, H - 10); c.beginPath(); c.moveTo(X + W / 2, Y + 5); c.lineTo(X + W / 2, Y + H - 5); c.moveTo(X + 45, Y + 5); c.lineTo(X + 45, Y + H - 5); c.moveTo(X + W - 45, Y + 5); c.lineTo(X + W - 45, Y + H - 5); c.stroke();
    c.beginPath(); c.arc(X + W / 2, Y + H / 2, 24, 0, 7); c.stroke(); c.fillStyle = 'rgba(255,217,59,.9)'; c.beginPath(); c.arc(X + W / 2, Y + H / 2, 21, 0, 7); c.fill(); c.strokeStyle = '#D9523A'; c.lineWidth = 3; c.beginPath(); c.arc(X + W / 2, Y + H / 2, 12, 0, 7); c.stroke();
    [[X + 9, 1], [X + W - 9, -1]].forEach(([a, d]) => { R(a - 2 + (d < 0 ? -1 : 0), Y + H / 2 - 13, 3, 26, '#F2EFE8'); c.strokeStyle = OR; c.lineWidth = 2.4; c.beginPath(); c.arc(a + d * 9, Y + H / 2, 6.5, 0, 7); c.stroke(); });
  }

  function thing(c, x, y, px, py) {
    const t = tile(x, y), h = hash(x, y), s = TS, R = (a, b, w, hh, col) => { c.fillStyle = col; c.fillRect(a, b, w, hh); }, E = (a, b, rx, ry, col) => { c.fillStyle = col; c.beginPath(); c.ellipse(a, b, rx, ry, 0, 0, 7); c.fill(); };
    if (t === 'F') {
      const edgeIn = (dx, dy) => { const n = tile(x + dx, y + dy); return n !== 'F' && !(x + dx < 0 || y + dy < 0 || x + dx >= MW || y + dy >= MH); };
      // concrete slabs: you look at the wall's south side, so the far wall shows its face to the yard (the place for graffiti)
      if (edgeIn(0, 1)) {
        R(px, py + s - 40, s, 10, '#B9B6AE'); R(px, py + s - 40, s, 2, '#DAD7CE'); R(px, py + s - 30, s, 30, '#8D8C88'); R(px, py + s - 30, s, 4, 'rgba(0,0,0,.2)'); R(px, py + s - 5, s, 5, '#6B6A67'); R(px + s - 1.5, py + s - 40, 1.5, 40, 'rgba(0,0,0,.3)'); for (let i = 0; i < 3; i++) c.strokeStyle = 'rgba(0,0,0,.14)', c.lineWidth = 1, c.strokeRect(px + 5.5, py + s - 25.5, s - 12, 16);
        if (fenceBlank.has(y * MW + x)) { /* kept clean for the player's piece */ } else if (h < .42) piece(c, px + 3, py + s - 25, x * 3 + y + 40, 1.02, 2 + (h < .2 ? 1 : 0)); else if (h < .6) tag(c, px + 4, py + s - 23, x * 3 + y, .9, 2.6);
        else if (h < .72) { R(px + 12, py + s - 27, 13, 17, '#F2EFE8'); R(px + 14, py + s - 25, 9, 6, SPRAY[Math.floor(h * 80) % 8]); R(px + 14, py + s - 17, 9, 1.4, '#3A3D45'); R(px + 14, py + s - 14, 6, 1.4, '#3A3D45'); R(px + 28, py + s - 25, 12, 15, '#FFD93B'); R(px + 30, py + s - 22, 8, 2, '#16161A'); R(px + 30, py + s - 18, 8, 2, '#16161A'); }   // posters
        contact(c, px, py + s, s);
      }
      if (edgeIn(0, -1)) { R(px, py, s, 9, '#B9B6AE'); R(px, py, s, 2, '#DAD7CE'); R(px, py + 9, s, 22, '#7C7B78'); R(px, py + 9, s, 3, 'rgba(0,0,0,.2)'); R(px + s - 1.5, py, 1.5, 31, 'rgba(0,0,0,.3)'); R(px, py + 31, s, 3, 'rgba(0,0,0,.4)'); }
      if (edgeIn(1, 0)) { R(px + s - 12, py, 12, s, '#B9B6AE'); R(px + s - 12, py, 2, s, '#DAD7CE'); R(px + s - 3, py, 3, s, '#7C7B78'); R(px + s - 12, py + s - 1.5, 12, 1.5, 'rgba(0,0,0,.25)'); }
      if (edgeIn(-1, 0)) { R(px, py, 12, s, '#B9B6AE'); R(px, py, 2, s, '#DAD7CE'); R(px + 9, py, 3, s, '#7C7B78'); R(px + 12, py, 4, s, 'rgba(0,0,0,.22)'); R(px, py + s - 1.5, 12, 1.5, 'rgba(0,0,0,.25)'); }
      return;
    }
    if (t === 'X') {
      R(px + 4, py - 14, 14, 22, '#8D8C88'); R(px + 4, py - 14, 14, 8, '#B9B6AE'); R(px + 4, py + s - 12, 14, 22, '#8D8C88'); R(px + 4, py + s - 12, 14, 8, '#B9B6AE');
      R(px + 12, py + 4, 9, s - 8, 'rgba(0,0,0,.35)'); for (let i = 0; i < 6; i++) R(px + 8, py + 4 + i * 7.4, 8, 7.4, i % 2 ? WH : '#E2483A'); c.strokeStyle = INK; c.lineWidth = 1; c.strokeRect(px + 8.5, py + 4.5, 8, s - 9);
      c.fillStyle = 'rgba(255,217,59,.85)'; c.beginPath(); c.moveTo(px + 24, py + 21); c.lineTo(px + 38, py + 21); c.lineTo(px + 38, py + 15); c.lineTo(px + 48, py + 26); c.lineTo(px + 38, py + 37); c.lineTo(px + 38, py + 31); c.lineTo(px + 24, py + 31); c.fill();
      return;
    }
    if (t === 'T') {
      const col = h > .5 ? ['#2F9A55', '#1F6B3A', '#54C27C'] : ['#2F7FC4', '#1F5788', '#5AA6E6'];
      boxShadow(c, px + 4, py + 6, 44, 38, 26); R(px + 3, py + 4, 46, 40, '#16161A'); R(px + 5, py + 6, 42, 16, col[2]); R(px + 5, py + 13, 42, 1.5, col[1]); R(px + 10, py + 8, 12, 3, 'rgba(255,255,255,.35)'); R(px + 5, py + 22, 42, 20, col[0]); R(px + 5, py + 22, 42, 3, 'rgba(0,0,0,.25)'); for (let i = 0; i < 4; i++) R(px + 10 + i * 10, py + 27, 2, 13, col[1]); R(px + 8, py + 42, 6, 5, '#16161A'); R(px + 38, py + 42, 6, 5, '#16161A');
      if (tile(x - 1, y) !== 'T') { c.save(); c.translate(px + 2, py + 46); c.rotate(-.2); R(-4, -6, 22, 14, '#8A6A40'); R(-3, -5, 20, 12, '#C8A066'); R(-3, 0, 20, 1.2, '#8A6A40'); c.restore(); } else { R(px + 30, py + 9, 12, 9, '#A47E4C'); R(px + 32, py + 7, 10, 3, '#C8A066'); R(px + 12, py + 44, 9, 6, '#3A3D45'); E(px + 16, py + 43, 5, 3, '#55585F'); }
      return;
    }
    if (t === 'M') {   // a market stall: a striped awning, crates of fruit in front
      const sc = [['#E2483A', '#F2EFE8'], ['#3BB86A', '#F2EFE8'], ['#F2B31F', '#3F8FD8'], ['#C96FD0', '#FFE08A']][Math.floor(h * 4)];
      boxShadow(c, px + 2, py + 4, 48, 44, 30); R(px + 3, py + 26, 46, 22, '#16161A'); R(px + 5, py + 28, 42, 18, '#8A5E38'); R(px + 5, py + 28, 42, 2, '#C8A066');
      [['#E2483A', '#FF7A6A'], ['#F58A1F', '#FFB45A'], ['#3FA845', '#7BD06A'], ['#FFD23F', '#FFF0A0']].forEach(([a, b], i) => { R(px + 7 + i * 10, py + 31, 9, 9, '#5A3A22'); for (let q = 0; q < 4; q++) { E(px + 9.5 + i * 10 + (q % 2) * 4, py + 33.5 + (q >> 1) * 4, 2.2, 2.2, a); E(px + 9 + i * 10 + (q % 2) * 4, py + 33 + (q >> 1) * 4, .9, .9, b); } });
      R(px + 6, py + 6, 2, 24, '#C9CCD2'); R(px + 44, py + 6, 2, 24, '#C9CCD2');
      for (let i = 0; i < 6; i++) { R(px + 1 + i * 8.4, py + 2, 8.4, 18, sc[i % 2]); c.fillStyle = sc[i % 2]; c.beginPath(); c.arc(px + 5.2 + i * 8.4, py + 20, 4.2, 0, Math.PI); c.fill(); } R(px + 1, py + 2, 50, 4, 'rgba(255,255,255,.25)'); R(px + 1, py + 15, 50, 5, 'rgba(0,0,0,.12)');
      return;
    }
    if (t === 'u') {   // a bush in bloom
      const fc = ['#FF8FC2', '#FFE27A', '#FFFFFF', '#C9A3FF'][Math.floor(h * 4)];
      E(px + 31, py + 36, 20, 12, 'rgba(8,10,24,.3)'); E(px + 26, py + 30, 21, 16, '#236B2C'); E(px + 20, py + 26, 13, 12, '#2F8A38'); E(px + 33, py + 24, 13, 12, '#37993F'); E(px + 26, py + 18, 12, 10, '#4BB552'); E(px + 22, py + 16, 5, 3.5, 'rgba(255,255,255,.18)');
      for (let i = 0; i < 9; i++) { const a = px + 11 + hash(x + i, y * 3 + 1) * 30, b = py + 12 + hash(x * 3 + 2, y + i) * 22; E(a, b, 2.4, 2.4, fc); E(a, b, .9, .9, '#F58A1F'); }
      return;
    }
    if (t === 'P') {   // the playground: a swing, a slide, a carousel, a spring horse — painted bright
      const k = (x * 3 + y) % 4;
      if (k === 0) { E(px + 30, py + 44, 22, 5, 'rgba(8,10,24,.28)'); c.lineCap = 'round'; c.strokeStyle = '#E2483A'; c.lineWidth = 3.4; c.beginPath(); c.moveTo(px + 6, py + 46); c.lineTo(px + 11, py + 8); c.lineTo(px + 16, py + 46); c.moveTo(px + 36, py + 46); c.lineTo(px + 41, py + 8); c.lineTo(px + 46, py + 46); c.stroke(); c.strokeStyle = '#FFD23F'; c.beginPath(); c.moveTo(px + 9, py + 8); c.lineTo(px + 43, py + 8); c.stroke(); c.strokeStyle = '#C9CCD2'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(px + 20, py + 9); c.lineTo(px + 19, py + 32); c.moveTo(px + 32, py + 9); c.lineTo(px + 31, py + 32); c.stroke(); R(px + 16, py + 31, 18, 5, '#16161A'); R(px + 17, py + 31, 16, 3.4, '#3F8FD8'); }
      else if (k === 1) { E(px + 30, py + 44, 22, 5, 'rgba(8,10,24,.28)'); c.lineCap = 'round'; c.strokeStyle = '#FFD23F'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(px + 8, py + 46); c.lineTo(px + 8, py + 10); c.moveTo(px + 18, py + 46); c.lineTo(px + 18, py + 10); c.stroke(); for (let i = 0; i < 5; i++) R(px + 8, py + 16 + i * 6.4, 10, 2, '#FFD23F'); c.fillStyle = '#16161A'; c.beginPath(); c.moveTo(px + 6, py + 6); c.lineTo(px + 22, py + 6); c.lineTo(px + 49, py + 40); c.lineTo(px + 49, py + 47); c.lineTo(px + 34, py + 47); c.lineTo(px + 6, py + 16); c.fill(); c.fillStyle = '#3F8FD8'; c.beginPath(); c.moveTo(px + 8, py + 8); c.lineTo(px + 21, py + 8); c.lineTo(px + 47, py + 41); c.lineTo(px + 47, py + 45); c.lineTo(px + 35, py + 45); c.lineTo(px + 8, py + 15); c.fill(); c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(px + 14, py + 11); c.lineTo(px + 41, py + 43); c.stroke(); R(px + 6, py + 4, 16, 4, '#E2483A'); }
      else if (k === 2) { E(px + 29, py + 34, 22, 14, 'rgba(8,10,24,.3)'); E(px + 26, py + 30, 21, 14, '#16161A'); ['#E2483A', '#FFD23F', '#3BB86A', '#3F8FD8', '#C96FD0', '#F58A1F'].forEach((col, i) => { c.fillStyle = col; c.beginPath(); c.moveTo(px + 26, py + 27); c.ellipse(px + 26, py + 27, 19.5, 12.5, 0, i * 1.047, (i + 1) * 1.047); c.fill(); }); c.strokeStyle = '#C9CCD2'; c.lineWidth = 1.6; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(px + 26 + Math.cos(i * 2.09) * 15, py + 27 + Math.sin(i * 2.09) * 9); c.lineTo(px + 26 + Math.cos(i * 2.09) * 15, py + 15 + Math.sin(i * 2.09) * 9); c.lineTo(px + 26, py + 12); c.stroke(); } E(px + 26, py + 12, 3, 3, '#F2EFE8'); }
      else { E(px + 30, py + 42, 14, 5, 'rgba(8,10,24,.28)'); c.strokeStyle = '#8A8D95'; c.lineWidth = 2.4; c.beginPath(); for (let i = 0; i < 5; i++) { c.moveTo(px + 20, py + 40 - i * 3); c.lineTo(px + 32, py + 38.5 - i * 3); } c.stroke(); c.fillStyle = '#16161A'; c.beginPath(); c.roundRect(px + 10, py + 14, 34, 16, 7); c.fill(); c.fillStyle = '#FF6A1F'; c.beginPath(); c.roundRect(px + 11.5, py + 15.5, 31, 13, 6); c.fill(); E(px + 41, py + 13, 7, 6, '#16161A'); E(px + 41, py + 13, 5.6, 4.6, '#FF6A1F'); E(px + 43, py + 12, 1.2, 1.2, '#16161A'); R(px + 34, py + 8, 2, 8, '#FFD23F'); R(px + 30, py + 8, 10, 2, '#FFD23F'); }
      return;
    }
    if (t === 'k') {   // stuff of the yard: crates, barrels, painted tyres
      const k = Math.floor(h * 3);
      if (k === 0) { boxShadow(c, px + 6, py + 12, 36, 34, 26); R(px + 5, py + 18, 30, 30, '#3A2A16'); R(px + 7, py + 20, 26, 10, '#C8A066'); R(px + 7, py + 30, 26, 16, '#9A7444'); R(px + 7, py + 37, 26, 1.5, '#6E4A2C'); R(px + 19, py + 30, 2, 16, '#6E4A2C'); R(px + 22, py + 4, 24, 26, '#3A2A16'); R(px + 24, py + 6, 20, 8, '#D9B47A'); R(px + 24, py + 14, 20, 14, '#B58A52'); R(px + 24, py + 20, 20, 1.5, '#6E4A2C'); R(px + 28, py + 8, 8, 2, 'rgba(255,255,255,.3)'); }
      else if (k === 1) { [[14, 26, '#3F8FD8', '#2B6FA8'], [34, 22, '#E2483A', '#A8322A'], [24, 36, '#FFD23F', '#C9A12A']].forEach(([a, b, col, dk2]) => { E(px + a + 5, py + b + 11, 11, 5, 'rgba(8,10,24,.3)'); R(px + a - 9, py + b - 4, 18, 14, dk2); E(px + a, py + b + 10, 9, 4, dk2); R(px + a - 9, py + b + 2, 18, 1.5, 'rgba(0,0,0,.3)'); E(px + a, py + b - 4, 9, 4.4, '#16161A'); E(px + a, py + b - 4, 8, 3.6, col); E(px + a - 3, py + b - 5, 2, 1, 'rgba(255,255,255,.45)'); }); }
      else { E(px + 29, py + 40, 20, 8, 'rgba(8,10,24,.3)'); [['#F2EFE8', 0], ['#FFD23F', 1], ['#E2483A', 2]].forEach(([col, i]) => { E(px + 24, py + 36 - i * 8, 17, 9, '#16161A'); E(px + 24, py + 34 - i * 8, 17, 9, '#2B2B31'); E(px + 24, py + 34 - i * 8, 17, 9, 'rgba(0,0,0,0)'); c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.ellipse(px + 24, py + 34 - i * 8, 13, 6.4, 0, 0, 7); c.stroke(); E(px + 24, py + 34 - i * 8, 8, 3.6, '#16161A'); }); E(px + 24, py + 18, 6, 2.6, '#5A3B25'); for (let i = 0; i < 3; i++) { E(px + 20 + i * 4, py + 14 - (i % 2) * 2, 2.6, 2.6, '#3FA845'); E(px + 20 + i * 4, py + 12 - (i % 2) * 2, 1.4, 1.4, ['#FF4F6A', '#FFD23F', '#FFFFFF'][i]); } }
      return;
    }
    if (t === 't') { E(px + 36, py + 40, 20, 9, 'rgba(8,10,24,.26)'); R(px + 21, py + 14, 10, 26, '#3A2A1E'); R(px + 23, py + 14, 4, 26, '#6E4E36'); E(px + 26, py + 40, 6.5, 3, '#3A2A1E'); return; }
    if (t === '*') { c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 2.2; c.setLineDash([6, 5]); c.beginPath(); c.arc(px + 26, py + 26, 21, 0, 7); c.stroke(); c.setLineDash([]); c.strokeStyle = 'rgba(255,217,59,.7)'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(px + 21, py + 21); c.lineTo(px + 31, py + 31); c.moveTo(px + 31, py + 21); c.lineTo(px + 21, py + 31); c.stroke(); return; }
    if (t === 'L') { c.strokeStyle = 'rgba(8,10,24,.3)'; c.lineWidth = 3; c.beginPath(); c.moveTo(px + 28, py + 40); c.lineTo(px + 50, py + 50); c.stroke(); E(px + 26, py + 40, 5.5, 3, '#16161A'); R(px + 24, py + 6, 4, 34, '#3A3D45'); R(px + 24, py + 6, 1.4, 34, '#8A8D95'); c.strokeStyle = '#3A3D45'; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(px + 26, py + 7); c.quadraticCurveTo(px + 20, py + 2, px + 12, py + 6); c.stroke(); E(px + 11, py + 8, 6, 4, '#16161A'); E(px + 11, py + 9, 4.8, 2.8, '#FFF3B8'); return; }
    if (t === 'B') { R(px + 19, py + 12, 20, 40, 'rgba(8,10,24,.28)'); for (let i = 0; i < 4; i++) R(px + 14 + i * 4.5, py + 4, 4, 40, i % 2 ? '#B5533C' : '#DDA945'); R(px + 13, py + 4, 20, 2.5, '#2B2B2F'); R(px + 13, py + 41.5, 20, 2.5, '#2B2B2F'); R(px + 13, py + 44, 3, 5, '#2B2B2F'); R(px + 30, py + 44, 3, 5, '#2B2B2F'); R(px + 37, py + 8, 12, 12, '#16161A'); R(px + 38, py + 9, 10, 4, '#54C27C'); R(px + 38, py + 13, 10, 6, '#2F9A55'); }
  }
  function drawComp(c, B) {
    if ('#bh'.includes(B.t)) drawHouse(c, B); else if (B.t === 'G') drawGarages(c, B); else if (B.t === 'K') drawKiosk(c, B); else if (B.t === 'S') drawTent(c, B);
    else if (B.t === 'C') car(c, B.x0 * TS + TS, B.y0 * TS + TS / 2 - 1, CARS[Math.floor(hash(B.x0 * 3 + 1, B.y0 * 5 + 2) * 6)]);
  }
  function compShadow(c, B) {
    const X = B.x0 * TS, Y = B.y0 * TS, W = B.w * TS, H = B.h * TS;
    if ('#bh'.includes(B.t)) boxShadow(c, X, Y, W, H, B.wh + 30); else if (B.t === 'G') boxShadow(c, X, Y, W, H, 70); else if (B.t === 'K') boxShadow(c, X, Y, W, H, 80);
    else if (B.t === 'S') { c.fillStyle = 'rgba(8,10,24,.3)'; c.beginPath(); c.ellipse(X + TS + 14, Y + TS + 26, TS - 2, TS * .6, 0, 0, 7); c.fill(); }
  }
  function chunk(cx0, cy0) {
    const k = cx0 + ',' + cy0; let e = chunks.get(k);
    if (e) { e.use = ++use; return e.can; }
    const [can, c] = mk(CH * TS, CH * TS); c.translate(-cx0 * CH * TS, -cy0 * CH * TS);
    const x0 = cx0 * CH - 2, y0 = cy0 * CH - 2, x1 = cx0 * CH + CH + 1, y1 = cy0 * CH + CH + 1;
    const mine = comps.filter(B => B.x0 <= x1 + 2 && B.x0 + B.w >= x0 - 2 && B.y0 <= y1 + 2 && B.y0 + B.h >= y0 - 2);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && y >= 0 && x < MW && y < MH) ground(c, x, y, x * TS, y * TS);
    mine.forEach(B => { if (B.t === 'a') drawCourt(c, B); });
    mine.forEach(B => compShadow(c, B));
    // things from the far ones to the near ones, so that the near ones cover the far ones
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) if (x >= 0 && y >= 0 && x < MW && y < MH) thing(c, x, y, x * TS, y * TS);
      mine.forEach(B => { if (B.y0 + B.h - 1 === y) drawComp(c, B); });
    }
    mine.forEach(B => { if (B.y0 + B.h - 1 > y1 || B.y0 + B.h - 1 < y0) drawComp(c, B); });
    chunks.set(k, { can, use: ++use });
    if (chunks.size > KEEP) { let old = null, ou = 1e18; chunks.forEach((v, kk) => { if (v.use < ou) { ou = v.use; old = kk; } }); const o = chunks.get(old); o.can.width = o.can.height = 0; chunks.delete(old); }   // free the graphics memory (iPhone)
    return can;
  }
  // the map on the screen: only copying
  function drawMap(c, ox, oy, W, H) {
    const s = CH * TS, a0 = Math.max(0, Math.floor(-ox / s)), a1 = Math.min(Math.ceil(MW / CH) - 1, Math.floor((W - ox) / s)), b0 = Math.max(0, Math.floor(-oy / s)), b1 = Math.min(Math.ceil(MH / CH) - 1, Math.floor((H - oy) / s));
    for (let b = b0; b <= b1; b++) for (let a = a0; a <= a1; a++) c.drawImage(chunk(a, b), ox + a * s, oy + b * s, s, s);
  }
  function crate(c, px, py) { const R = (a, b, w, h, col) => { c.fillStyle = col; c.fillRect(a, b, w, h); }; R(px + 14, py + 20, 32, 26, 'rgba(8,10,24,.34)'); R(px + 10, py + 9, 30, 34, '#3A2A16'); R(px + 12, py + 11, 26, 11, '#D9B47A'); R(px + 12, py + 22, 26, 19, '#A47E4C'); R(px + 12, py + 30, 26, 2, '#5E4424'); R(px + 24, py + 22, 2, 19, '#5E4424'); R(px + 14, py + 13, 8, 2, 'rgba(255,255,255,.3)'); R(px + 22, py + 26, 6, 6, '#F2CC55'); }
  // tree crowns hang over everything (people walk under them): green, light green, in pink bloom, golden
  const CROWN = [['#1E5A2C', '#2A7A3A', '#3F9F4E', '#62C06C'], ['#2C6A1E', '#4A9A2A', '#72BF3F', '#A3DC62'], ['#8E3F6A', '#C45F92', '#EC8FBC', '#FFC4DE'], ['#9A5A14', '#D98A1F', '#F2B13B', '#FFD97A']];
  function crown(c, px, py, x, y) {
    const v = Math.floor(hash(x, y) * 4), k = 'tree' + v; let sp = sprites.get(k);
    if (!sp) { const [can, q] = mk(104, 104), P = CROWN[v], E = (a, b, rx, ry, col) => { q.fillStyle = col; q.beginPath(); q.ellipse(a, b, rx, ry, 0, 0, 7); q.fill(); };
      E(52, 54, 36, 32, '#12301A'); E(52, 52, 34, 30, P[0]); E(46, 46, 26, 23, P[1]); E(62, 60, 15, 13, P[1]); E(42, 40, 16, 13, P[2]); E(64, 44, 11, 9, P[2]); E(38, 36, 8, 6, P[3]);
      for (let i = 0; i < 26; i++) E(24 + hash(i, v + 61) * 56, 26 + hash(i, v + 62) * 52, 3.2, 2.6, hash(i, v + 63) > .5 ? P[3] : P[0]);
      if (v === 0) for (let i = 0; i < 7; i++) E(30 + hash(i, 91) * 44, 34 + hash(i, 92) * 40, 2.6, 2.6, '#E2483A');   // apples
      sp = can; sprites.set(k, sp); }
    c.drawImage(sp, px + TS / 2 - 52, py + TS / 2 - 52 - 22, 104, 104);
  }

  // ================= people (strictly from above; local space: forward = +y) =================
  const dk = col => (col === '#18181B' || col === '#232327' || col === '#232328' || col === '#141416') ? '#2B2B31' : col;   // pure black melts into the asphalt
  function body(c, f, pose) {
    const C = f.col, st = pose.st || 0, ar = pose.arm == null ? -st : pose.arm, out = pose.out || 0, crs = pose.cross || 0;
    const E = (a, b, rx, ry, col) => { c.fillStyle = col; c.beginPath(); c.ellipse(a, b, rx, ry, 0, 0, 7); c.fill(); };
    const LN = (x1, y1, x2, y2, col, w) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); };
    c.lineJoin = 'round'; c.lineCap = 'round';
    const pants = dk(C.pants), top = dk(C.top), sleeve = C.sleeve ? dk(C.sleeve) : null, shoe = dk(C.shoe), shoe2 = dk(C.shoe2);
    if (f.carry) { c.fillStyle = INK; c.fillRect(-12, -15, 24, 12); c.fillStyle = '#A47E4C'; c.fillRect(-11, -14, 22, 10); c.fillStyle = '#7A5A34'; c.fillRect(-11, -9.5, 22, 1); }
    // legs + sneakers
    [[-5.2, st], [5.2, -st]].forEach(([lx, s]) => {
      const fy = 4 + s * 8.5, fx = lx - crs * s * Math.sign(lx) * 3.5;
      LN(lx, 0, fx, fy, INK, 8.4); LN(lx, 0, fx, fy, pants, 6.4);
      if (C.stripe) LN(lx + Math.sign(lx) * 2.4, 0, fx + Math.sign(lx) * 2.4, fy, C.stripe, 1.2);
      if (f.knee) { E((lx + fx) / 2, fy * .55 + 1, 3.6, 3, INK); E((lx + fx) / 2, fy * .55 + 1, 2.3, 1.9, '#6C6F78'); }
      E(fx, fy + 4.6, 4.4, 6.4, INK); E(fx, fy + 4.6, 3.5, 5.5, C.sole); E(fx, fy + 4, 3, 4.2, shoe); E(fx, fy + 8.1, 2.4, 1.6, shoe2);
      if (/high/.test(f.shoe)) E(fx, fy + 1.2, 3, 1.6, shoe2);
      LN(fx - 1.6, fy + 3, fx + 1.6, fy + 3, C.lace, .9); LN(fx - 1.6, fy + 5, fx + 1.6, fy + 5, C.lace, .9);
    });
    // arms
    [[-1, ar], [1, -ar]].forEach(([sd, s]) => {
      const sx = sd * 12.5, hx = sd * (15.5 + out * 5), hy = 3 + s * 7 - out * 2;
      LN(sx, 0, hx, hy, INK, 7.4);
      if (sleeve) { LN(sx, 0, hx, hy, sleeve, 5.4); if (C.trim && f.top !== 'bomber') LN(sx + sd * 1.6, 0, hx + sd * 1.6, hy, C.trim, f.top === 'trackGold' ? 1.6 : 1.2); if (C.cuff) E(hx - sd * .5, hy - .8, 3.1, 2.1, C.cuff); }
      else { LN(sx, 0, hx, hy, C.skin, 5.4); LN(sx, 0, sx + (hx - sx) * .4, hy * .4, top, 5.4); }
      if (f.wrist && sd === -1 && !sleeve) E(hx - sd * .4, hy - .6, 2.9, 1.7, f.wrist);
      E(hx, hy + 1.6, 3.3, 3.3, INK); E(hx, hy + 1.6, 2.5, 2.5, f.gloves ? '#2A2A30' : C.skin); if (f.gloves) { E(hx, hy + 2.9, 1.5, 1.1, C.skin); LN(hx - 1.6, hy + .6, hx + 1.6, hy + .6, OR, .8); }
      if (f.box && sd === 1) { c.fillStyle = INK; c.fillRect(hx - 1, hy - 1, 15, 10.5); c.fillStyle = '#3B3B44'; c.fillRect(hx, hy, 13, 8.5); E(hx + 3.4, hy + 4.6, 2.5, 2.5, '#111'); E(hx + 9.6, hy + 4.6, 2.5, 2.5, '#111'); E(hx + 3.4, hy + 4.6, 1, 1, OR); E(hx + 9.6, hy + 4.6, 1, 1, OR); c.fillStyle = '#9A9AA2'; c.fillRect(hx + 2, hy + .6, 9, 1); }
    });
    // shoulders
    const rx = f.top === 'teeBig' ? 14.3 : 13.5;
    E(0, 0, rx + 1.1, 9, INK); E(0, 0, rx, 7.9, top);
    if (C.yoke) { c.fillStyle = dk(C.yoke); c.beginPath(); c.ellipse(0, -1.5, rx, 6.4, 0, Math.PI, 0); c.fill(); }
    if (f.top === 'track' || f.top === 'trackGold' || f.top === 'bomber') LN(0, 2, 0, 7.6, C.trim || WH, 1);
    if (f.top === 'trackGold') { LN(-8, -5, -8, 6, C.gold, 1.4); LN(8, -5, 8, 6, C.gold, 1.4); }
    if (f.top === 'bomber') { c.strokeStyle = OR; c.lineWidth = 1.5; c.beginPath(); c.ellipse(0, 0, 12, 6.6, 0, .25, Math.PI - .25); c.stroke(); }
    if (f.top === 'teeTeam') { E(0, 5, 3, 2, OR); c.fillStyle = INK; c.fillRect(-4, 6.4, 8, 1); }
    if (f.top === 'tee' || f.top === 'teeBig') { c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1; c.beginPath(); c.arc(0, 1, 9.6, .5, Math.PI - .5); c.stroke(); }
    if (f.belt) { c.fillStyle = INK; c.fillRect(-4.6, 6.6, 9.2, 3); c.fillStyle = C.gold; c.fillRect(-3.8, 7.2, 7.6, 1.8); }
    if (f.phones) { c.strokeStyle = '#2A2A2F'; c.lineWidth = 2.6; c.beginPath(); c.arc(0, 0, 9.6, Math.PI + .5, -.5); c.stroke(); E(-9.2, 2.6, 2.6, 3.6, INK); E(9.2, 2.6, 2.6, 3.6, INK); E(-9.2, 2.6, 1.6, 2.6, OR); E(9.2, 2.6, 1.6, 2.6, OR); }
    if (f.chain) { c.strokeStyle = C.gold; c.lineWidth = f.chain > 1 ? 2 : 1.4; c.setLineDash([1.4, 1.2]); c.beginPath(); c.arc(0, 2, 8.6, .55, Math.PI - .55); c.stroke(); c.setLineDash([]); E(0, 10.4, f.chain > 1 ? 2.1 : 1.5, f.chain > 1 ? 2.1 : 1.5, C.gold); }
    // b-girl: long hair behind + a braid over the shoulder
    if (f.girl) { E(0, -5, 9.4, 8.6, C.hair); for (let i = 0; i < 5; i++) E(6.5 + i * .9, -6 - i * 3, 2.6 - i * .2, 2.4, C.hair); E(9.6, -17, 1.7, 1.7, OR); }
    // head + hat
    E(0, 1, 9.5, 9.5, INK); E(0, 1, 8.5, 8.5, C.skin);
    const h = f.hat, hc = C.hat ? [dk(C.hat[0]), dk(C.hat[1])] : null;
    if (!h) { E(0, .2, 8.5, 7.8, C.hair); c.fillStyle = C.skin; c.beginPath(); c.ellipse(0, 4.6, 6.4, 4.6, 0, 0, Math.PI); c.fill(); if (f.girl) { E(0, -3, 4, 4, '#2B211C'); LN(0, 0, 0, 7, '#3A2E28', .8); } E(-3, 7.6, 1, .8, INK); E(3, 7.6, 1, .8, INK); }
    if (h === 'cap' || h === 'capGold' || h === 'capBack') {
      const d = h === 'capBack' ? -1 : 1;
      c.fillStyle = INK; c.beginPath(); c.roundRect(-7.4, d > 0 ? 3 : -15, 14.8, 12, 5); c.fill(); c.fillStyle = hc[1]; c.beginPath(); c.roundRect(-6.4, d > 0 ? 4 : -14, 12.8, 10, 4.4); c.fill();
      E(0, .6, 8.6, 8.2, hc[0]); LN(0, -7.4, 0, 8.4, 'rgba(0,0,0,.35)', .7); LN(-7.5, 0, 7.5, 1, 'rgba(0,0,0,.35)', .7); E(0, .6, 1.5, 1.5, hc[1]);
      if (h === 'capBack') { c.fillStyle = C.skin; c.beginPath(); c.ellipse(0, 6.6, 5.4, 3, 0, 0, Math.PI); c.fill(); }
    }
    if (h === 'beanie' || h === 'spin') { E(0, .6, 8.8, 8.6, hc[0]); c.strokeStyle = hc[1]; c.lineWidth = 2; c.beginPath(); c.arc(0, .6, 7.4, 0, 7); c.stroke(); for (let i = 0; i < 8; i++) LN(0, .6, Math.cos(i * .785) * 5.6, .6 + Math.sin(i * .785) * 5.6, 'rgba(255,255,255,.14)', .7); if (h === 'spin') { E(0, .6, 4.6, 4.6, INK); E(0, .6, 3.8, 3.8, WH); E(0, .6, 1.4, 1.4, hc[1]); } else E(0, .6, 1.6, 1.6, hc[1]); }
    if (h === 'bucket') { E(0, 1, 11, 10.6, INK); E(0, 1, 10.1, 9.7, hc[0]); c.strokeStyle = hc[1]; c.lineWidth = .9; c.setLineDash([1.6, 1.4]); c.beginPath(); c.arc(0, 1, 8.6, 0, 7); c.stroke(); c.setLineDash([]); E(0, .4, 6.6, 6.4, 'rgba(0,0,0,.35)'); E(0, .4, 5.8, 5.6, hc[0]); c.strokeStyle = 'rgba(255,255,255,.14)'; c.lineWidth = .8; c.beginPath(); c.arc(0, .4, 4, 3.4, 5); c.stroke(); }
    if (h === 'bandana') { E(0, .4, 8.7, 8.3, hc[0]); c.fillStyle = hc[0]; c.strokeStyle = INK; c.lineWidth = .8; c.beginPath(); c.moveTo(-2, -7); c.lineTo(-7, -14); c.lineTo(-1, -11); c.lineTo(3, -15); c.lineTo(2, -7); c.fill(); c.stroke(); for (let i = 0; i < 6; i++) E(Math.cos(i * 1.05) * 5, .4 + Math.sin(i * 1.05) * 4.8, .8, .8, hc[1]); c.fillStyle = C.skin; c.beginPath(); c.ellipse(0, 6.4, 5.6, 3.2, 0, 0, Math.PI); c.fill(); }
    if (f.girl) { c.strokeStyle = f.L >= 5 ? C.gold : '#C9CCD2'; c.lineWidth = .9; c.beginPath(); c.arc(-8.6, 4.6, 1.7, 0, 7); c.moveTo(10.3, 4.6); c.arc(8.6, 4.6, 1.7, 0, 7); c.stroke(); }
  }
  // poses: w0…w5 walk, i0 i1 idle sway, t0…t3 toprock on the spot
  function poseOf(fr) {
    const n = +fr.slice(1);
    if (fr[0] === 'w') { const s = Math.sin(n / 6 * Math.PI * 2); return { st: s, arm: -s }; }
    if (fr[0] === 't') return [{ st: .75, arm: .9, out: 1, cross: 1 }, { st: 0, arm: 0, out: .2 }, { st: -.75, arm: -.9, out: 1, cross: 1 }, { st: 0, arm: 0, out: .2 }][n];
    return n ? { st: 0, arm: .12, sc: 1.025 } : { st: 0, arm: 0 };
  }
  // look = { key, f (descriptor from HERO.topDown + city things), big }
  function person(c, px, py, look, dir, fr) {
    const k = look.key + '|' + dir + '|' + fr; let sp = sprites.get(k);
    if (!sp) {
      if (sprites.size > 420) sprites.clear();
      const [can, q] = mk(SP, SP), sc = 1.3 * (look.big || 1), p = poseOf(fr);
      q.translate(SP / 2, SP / 2);
      q.fillStyle = 'rgba(0,0,0,.36)'; q.beginPath(); q.ellipse(4 * sc, 5 * sc, 15 * sc, 11 * sc, 0, 0, 7); q.fill();
      q.rotate(dir * Math.PI / 4); q.scale(sc * (p.sc || 1), sc * (p.sc || 1)); body(q, look.f, p); sp = can; sprites.set(k, sp);
    }
    c.drawImage(sp, Math.round(px - SP / 2), Math.round(py - SP / 2), SP, SP);
  }
  // fire aura (shop accessory): alive, so it is drawn every frame under the hero
  function aura(c, px, py, now) {
    const g = c.createRadialGradient(px, py, 6, px, py, 34); g.addColorStop(0, 'rgba(255,170,40,.6)'); g.addColorStop(.6, 'rgba(226,60,26,.28)'); g.addColorStop(1, 'rgba(226,60,26,0)'); c.fillStyle = g; c.beginPath(); c.arc(px, py, 34, 0, 7); c.fill();
    for (let i = 0; i < 9; i++) { const a = i * .7 + now / 300, r = 23 + 2 * Math.sin(now / 130 + i * 2); c.fillStyle = i % 2 ? '#FFD35A' : '#FF8A1F'; c.beginPath(); c.ellipse(px + Math.cos(a) * r, py + Math.sin(a) * r, 3.4, 5.6, a, 0, 7); c.fill(); }
  }
  function bird(c, px, py, a, peck) { c.save(); c.translate(px, py); c.rotate(a); const E = (x, y, rx, ry, col) => { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 7); c.fill(); }; E(1, 1.5, 4.4, 2.8, 'rgba(0,0,0,.3)'); E(0, 0, 4, 2.6, '#8D919B'); E(-1, 0, 2, 1.6, '#A9ADB6'); E(3.4 + (peck ? 1 : 0), 0, 1.7, 1.5, '#5E626B'); E(-3.8, 0, 1.8, 1.1, '#5E626B'); c.restore(); }

  // ================= v3: things to pick up, the player's own tag, smoke, traffic (owner 13.11.2026 «ещё улучшай графику и добавь активностей») =================
  function pickup(c, px, py, kind, now, seed) {
    const bob = Math.sin(now / 260 + seed) * 2.5, E = (a, b, rx, ry, col) => { c.fillStyle = col; c.beginPath(); c.ellipse(a, b, rx, ry, 0, 0, 7); c.fill(); }, R = (a, b, w, h, col) => { c.fillStyle = col; c.fillRect(a, b, w, h); };
    E(px + 2, py + 10, 8, 3.4, 'rgba(8,10,24,.3)'); const y = py - 4 + bob;
    if (kind === 'coin') { const w = Math.abs(Math.cos(now / 300 + seed)) * 7 + 1.5; E(px, y, w + 1.4, 8.8, '#7A5410'); E(px, y, w, 7.4, '#F2B31F'); E(px, y, w * .62, 4.8, '#FFD95A'); if (w > 5) R(px - 1, y - 3.6, 2, 7.2, '#B8860F'); E(px - w * .4, y - 3, w * .22, 1.6, 'rgba(255,255,255,.8)'); }
    else if (kind === 'can') { const col = SPRAY[seed % 8]; R(px - 5.5, y - 7, 11, 16, INK); R(px - 4.5, y - 6, 9, 14, col); R(px - 4.5, y - 1, 9, 4, WH); R(px - 4.5, y - 6, 2.4, 14, 'rgba(255,255,255,.35)'); R(px - 3.5, y - 10, 7, 4, INK); R(px - 2.5, y - 9.4, 5, 3, '#C9CCD2'); R(px - 1, y - 12, 3.4, 3, '#E2483A'); }
    else { E(px, y, 8, 8, INK); E(px, y, 6.8, 6.8, '#E2483A'); E(px - 2.4, y - 2.4, 2.2, 1.8, 'rgba(255,255,255,.55)'); R(px - .8, y - 10.5, 1.8, 4.4, '#5A3B25'); E(px + 3.4, y - 8.6, 3.4, 1.8, '#3FA845'); }
    const tw = (now / 900 + seed * .37) % 1; if (tw < .35) { const a = Math.sin(tw / .35 * Math.PI), sx = px + 7, sy = y - 8; c.strokeStyle = 'rgba(255,255,255,' + a.toFixed(2) + ')'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(sx - 4 * a, sy); c.lineTo(sx + 4 * a, sy); c.moveTo(sx, sy - 4 * a); c.lineTo(sx, sy + 4 * a); c.stroke(); }
  }
  // ================= graffiti: big pieces in different styles (owner 14.11.2026 «большие классные граффити в разных стилях») =================
  // Our own letters: every letter is a few strokes on a 4 × 6 grid; the style decides how fat, how round, how tilted they are,
  // what is behind them and what grows out of them. Nothing is copied — no fonts, no pictures.
  // A stroke that starts with 'c' is closed.
  const GLY = (() => {
    const O = ['c', [1, 0], [3, 0], [4, 1], [4, 5], [3, 6], [1, 6], [0, 5], [0, 1]], P = [[0, 6], [0, 0], [3, 0], [4, 1], [4, 2.5], [3, 3.5], [0, 3.5]], E = [[4, 0], [0, 0], [0, 6], [4, 6]], SH = [[0, 0], [0, 6], [4, 6], [4, 0]];
    const G = {
      A: [[[0, 6], [0, 2], [2, 0], [4, 2], [4, 6]], [[0, 4], [4, 4]]], B: [[[0, 3], [3, 3], [4, 4], [4, 5], [3, 6], [0, 6], [0, 0], [3, 0], [4, 1], [4, 2], [3, 3]]],
      C: [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 5], [1, 6], [3, 6], [4, 5]]], D: [['c', [0, 0], [2.6, 0], [4, 1.5], [4, 4.5], [2.6, 6], [0, 6]]],
      E: [E, [[0, 3], [3, 3]]], F: [[[4, 0], [0, 0], [0, 6]], [[0, 3], [3, 3]]], G: [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 5], [1, 6], [3, 6], [4, 5], [4, 3.2], [2.2, 3.2]]],
      H: [[[0, 0], [0, 6]], [[4, 0], [4, 6]], [[0, 3], [4, 3]]], I: [[[2, 0], [2, 6]], [[.8, 0], [3.2, 0]], [[.8, 6], [3.2, 6]]], J: [[[1.4, 0], [4, 0], [4, 5], [3, 6], [1, 6], [0, 5], [0, 4]]],
      K: [[[0, 0], [0, 6]], [[4, 0], [0, 3.2], [4, 6]]], L: [[[0, 0], [0, 6], [4, 6]]], M: [[[0, 6], [0, 0], [2, 3], [4, 0], [4, 6]]], N: [[[0, 6], [0, 0], [4, 6], [4, 0]]],
      O: [O], P: [P], Q: [O, [[2.4, 4.2], [4.4, 6.4]]], R: [P, [[2, 3.5], [4, 6]]], S: [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 2], [1, 3], [3, 3], [4, 4], [4, 5], [3, 6], [1, 6], [0, 5]]],
      T: [[[0, 0], [4, 0]], [[2, 0], [2, 6]]], U: [[[0, 0], [0, 5], [1, 6], [3, 6], [4, 5], [4, 0]]], V: [[[0, 0], [2, 6], [4, 0]]], W: [[[0, 0], [.8, 6], [2, 2.4], [3.2, 6], [4, 0]]],
      X: [[[0, 0], [4, 6]], [[4, 0], [0, 6]]], Y: [[[0, 0], [2, 3], [4, 0]], [[2, 3], [2, 6]]], Z: [[[0, 0], [4, 0], [0, 6], [4, 6]]],
      0: [O, [[1.4, 4.2], [2.6, 1.8]]], 1: [[[.8, 1.4], [2.2, 0], [2.2, 6]], [[.8, 6], [3.6, 6]]], 2: [[[0, 1], [1, 0], [3, 0], [4, 1], [4, 2.2], [0, 6], [4, 6]]],
      3: [[[0, 0], [4, 0], [2, 2.6], [3, 2.6], [4, 3.6], [4, 5], [3, 6], [1, 6], [0, 5]]], 4: [[[3, 6], [3, 0], [0, 4], [4, 4]]], 5: [[[4, 0], [0, 0], [0, 2.6], [3, 2.6], [4, 3.6], [4, 5], [3, 6], [1, 6], [0, 5]]],
      6: [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 5], [1, 6], [3, 6], [4, 5], [4, 3.8], [3, 2.8], [0, 2.8]]], 7: [[[0, 0], [4, 0], [1.5, 6]]],
      8: [['c', [1, 0], [3, 0], [4, 1], [4, 2], [3, 3], [1, 3], [0, 2], [0, 1]], ['c', [1, 3], [3, 3], [4, 4], [4, 5], [3, 6], [1, 6], [0, 5], [0, 4]]], 9: [[[0, 5], [1, 6], [3, 6], [4, 5], [4, 1], [3, 0], [1, 0], [0, 1], [0, 2.2], [1, 3.2], [4, 3.2]]],
      '!': [[[2, 0], [2, 3.8]], [[2, 5.7], [2, 6]]], '-': [[[.6, 3], [3.4, 3]]], '.': [[[2, 5.7], [2, 6]]],
      // кириллица
      'Б': [[[4, 0], [0, 0], [0, 6], [3, 6], [4, 5], [4, 3.8], [3, 2.8], [0, 2.8]]], 'Г': [[[4, 0], [0, 0], [0, 6]]], 'Д': [[[0, 6.7], [0, 5.3], [4, 5.3], [4, 6.7]], [[.8, 5.3], [1.6, 0], [3.4, 0], [3.4, 5.3]]],
      'Ж': [[[2, 0], [2, 6]], [[0, 0], [2, 3], [0, 6]], [[4, 0], [2, 3], [4, 6]]], 'З': [[[0, 1], [1, 0], [3, 0], [4, 1], [4, 2], [3, 3], [1.6, 3]], [[3, 3], [4, 4], [4, 5], [3, 6], [1, 6], [0, 5]]],
      'И': [[[0, 0], [0, 6], [4, 0], [4, 6]]], 'Й': [[[0, 0], [0, 6], [4, 0], [4, 6]], [[1.2, -1.3], [2.8, -1.3]]], 'Л': [[[0, 6], [1, 5.3], [1.6, 0], [4, 0], [4, 6]]], 'П': [[[0, 6], [0, 0], [4, 0], [4, 6]]],
      'У': [[[0, 0], [2.2, 3.6]], [[4, 0], [1.4, 6], [.2, 6]]], 'Ф': [[[2, 0], [2, 6]], ['c', [1, 1], [3, 1], [4, 2], [4, 3.2], [3, 4.2], [1, 4.2], [0, 3.2], [0, 2]]],
      'Ц': [[[0, 0], [0, 5.3], [3.6, 5.3], [3.6, 0]], [[3.6, 5.3], [4.4, 5.3], [4.4, 6.7]]], 'Ч': [[[0, 0], [0, 2.2], [1, 3.2], [4, 3.2]], [[4, 0], [4, 6]]], 'Ш': [SH, [[2, 0], [2, 6]]],
      'Щ': [[[0, 0], [0, 5.3], [3.7, 5.3], [3.7, 0]], [[1.85, 0], [1.85, 5.3]], [[3.7, 5.3], [4.5, 5.3], [4.5, 6.7]]], 'Ъ': [[[0, 0], [1, 0], [1, 6], [3.2, 6], [4, 5], [4, 3.8], [3.2, 2.8], [1, 2.8]]],
      'Ы': [[[0, 0], [0, 6], [1.8, 6], [2.6, 5], [2.6, 3.8], [1.8, 2.8], [0, 2.8]], [[4, 0], [4, 6]]], 'Ь': [[[0, 0], [0, 6], [3, 6], [4, 5], [4, 3.8], [3, 2.8], [0, 2.8]]],
      'Э': [[[0, 1], [1, 0], [3, 0], [4, 1], [4, 5], [3, 6], [1, 6], [0, 5]], [[1.6, 3], [4, 3]]], 'Ю': [[[0, 0], [0, 6]], [[0, 3], [1.4, 3]], ['c', [2.2, 0], [3.3, 0], [4, 1], [4, 5], [3.3, 6], [2.2, 6], [1.4, 5], [1.4, 1]]],
      'Я': [[[4, 6], [4, 0], [1, 0], [0, 1], [0, 2.5], [1, 3.5], [4, 3.5]], [[2, 3.5], [0, 6]]]
    };
    const same = { 'А': 'A', 'В': 'B', 'Е': 'E', 'Ё': 'E', 'К': 'K', 'М': 'M', 'Н': 'H', 'О': 'O', 'Р': 'P', 'С': 'C', 'Т': 'T', 'Х': 'X' }; Object.keys(same).forEach(k => { G[k] = G[same[k]]; });
    return G;
  })();
  // what can be written: capitals of the two alphabets and digits; accents are dropped, everything else is skipped
  const grafWord = (s, max) => { let o = ''; try { s = String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (_) { s = String(s || ''); } for (const ch of s.toUpperCase()) { if (o.length >= (max || 8)) break; if (GLY[ch] || (ch === ' ' && o && o[o.length - 1] !== ' ')) o += ch; } return o.trim(); };
  // colours of a piece: a main · b light · c deep · o outline · k depth / shadow · bg what is behind · hi shine
  const GRAF_PALS = {
    fire: { a: '#FF7A1F', b: '#FFD23F', c: '#E2261A', o: '#141416', k: '#5A1E08', bg: '#2B3A8F', hi: '#FFF6D8' },
    ice: { a: '#4FC0FF', b: '#E8FBFF', c: '#2B5BD8', o: '#0E1430', k: '#14306B', bg: '#FF4F9A', hi: '#FFFFFF' },
    candy: { a: '#FF4F9A', b: '#FFD0E6', c: '#B03BFF', o: '#1A0A1E', k: '#5A1466', bg: '#3BE0D0', hi: '#FFFFFF' },
    chrome: { a: '#D9DEE6', b: '#FFFFFF', c: '#8C95A6', o: '#0B0B0C', k: '#2A2F3A', bg: '#3F8FD8', hi: '#FFFFFF' },
    toxic: { a: '#B8FF3B', b: '#F4FFB0', c: '#3BB86A', o: '#10140A', k: '#24451A', bg: '#7B2FD0', hi: '#FFFFFF' },
    sunset: { a: '#FF5A4A', b: '#FFD23F', c: '#B03BFF', o: '#180A1E', k: '#4A1466', bg: '#1FB8C4', hi: '#FFF6D8' },
    // банды
    rusty: { a: '#D9682E', b: '#F6B45C', c: '#8A3414', o: '#1A0E08', k: '#3E1A0C', bg: '#2F6F6C', hi: '#FFE9C4' },
    acid: { a: '#7CFF4F', b: '#EAFF6A', c: '#1FB84A', o: '#12051F', k: '#4A1A78', bg: '#A53BF0', hi: '#FFFFFF' },
    owls: { a: '#A77BD6', b: '#FFD23F', c: '#5A36A0', o: '#0D0A1E', k: '#251848', bg: '#1B2A6B', hi: '#FFF4B8' },
    gold: { a: '#FFC82E', b: '#FFF3B0', c: '#E08A1C', o: '#1A1206', k: '#7A4A0C', bg: '#8E1B2B', hi: '#FFFFFF' }
  };
  const GRAF_STYLES = ['tag', 'bubble', 'block', 'wild', 'd3'];
  const grafCache = new Map();
  function grafRnd(seed) { let a = (seed | 0) + 0x6D2B79F5; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  // the strokes of one letter go into the current path; r — how round the corners are (in grid units)
  function glyph(c, ch, x, y, sx, sy, r) {
    (GLY[ch] || []).forEach(s => {
      const closed = s[0] === 'c', P = (closed ? s.slice(1) : s).map(p => [x + p[0] * sx, y + p[1] * sy]), n = P.length, R = r * Math.min(sx, sy);
      if (!R || n < 3) { P.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); if (closed) c.closePath(); return; }
      const cut = (a, b, d) => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, k = Math.min(d, l / 2) / l; return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; };
      if (closed) { const s0 = cut(P[0], P[1], R); c.moveTo(s0[0], s0[1]); for (let i = 1; i <= n; i++) { const v = P[i % n], a = cut(v, P[(i - 1) % n], R), b = cut(v, P[(i + 1) % n], R); c.lineTo(a[0], a[1]); c.quadraticCurveTo(v[0], v[1], b[0], b[1]); } c.closePath(); }
      else { c.moveTo(P[0][0], P[0][1]); for (let i = 1; i < n - 1; i++) { const a = cut(P[i], P[i - 1], R), b = cut(P[i], P[i + 1], R); c.lineTo(a[0], a[1]); c.quadraticCurveTo(P[i][0], P[i][1], b[0], b[1]); } c.lineTo(P[n - 1][0], P[n - 1][1]); }
    });
  }
  const mixCol = (a, b, t) => { const p = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)], x = p(a), y = p(b); return 'rgb(' + x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',') + ')'; };
  // ---- what stands next to the letters: every crew has its own sign ----
  const GRAF_EXTRA = {
    crown(c, x, y, s, P) { const pts = [[-.5, .3], [-.58, -.3], [-.26, 0], [0, -.42], [.26, 0], [.58, -.3], [.5, .3]]; c.lineJoin = 'round'; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(x + p[0] * s, y + p[1] * s) : c.moveTo(x + p[0] * s, y + p[1] * s)); c.closePath(); c.lineWidth = s * .16; c.strokeStyle = P.o; c.stroke(); c.fillStyle = P.b; c.fill();
      [[-.58, -.3], [0, -.42], [.58, -.3]].forEach(p => { c.beginPath(); c.arc(x + p[0] * s, y + p[1] * s, s * .08, 0, 7); c.fillStyle = P.hi; c.fill(); c.lineWidth = s * .04; c.stroke(); }); c.fillStyle = P.c; c.fillRect(x - s * .4, y + s * .12, s * .8, s * .1); },
    // ржавая шестерня со злыми глазами
    cog(c, x, y, s, P) { c.lineJoin = 'round'; const tooth = () => { c.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2 + .2, r = s * (i % 2 ? .5 : .36); c.lineTo(x + Math.cos(a - .1) * r, y + Math.sin(a - .1) * r); c.lineTo(x + Math.cos(a + .1) * r, y + Math.sin(a + .1) * r); } c.closePath(); };
      tooth(); c.lineWidth = s * .12; c.strokeStyle = P.o; c.stroke(); const g = c.createLinearGradient(0, y - s * .5, 0, y + s * .5); g.addColorStop(0, P.b); g.addColorStop(.5, P.a); g.addColorStop(1, P.c); c.fillStyle = g; c.fill();
      for (let i = 0; i < 9; i++) { c.fillStyle = i % 2 ? 'rgba(90,30,10,.45)' : 'rgba(255,220,160,.35)'; c.beginPath(); c.arc(x + Math.cos(i * 2.4) * s * .27, y + Math.sin(i * 1.7) * s * .27, s * (.03 + (i % 3) * .015), 0, 7); c.fill(); }
      c.fillStyle = P.o; c.beginPath(); c.arc(x, y + s * .02, s * .25, 0, 7); c.fill();
      [-1, 1].forEach(d => { c.fillStyle = P.hi; c.beginPath(); c.ellipse(x + d * s * .1, y, s * .075, s * .09, 0, 0, 7); c.fill(); c.fillStyle = P.o; c.beginPath(); c.arc(x + d * s * .09, y + s * .02, s * .035, 0, 7); c.fill();
        c.strokeStyle = P.a; c.lineWidth = s * .05; c.lineCap = 'round'; c.beginPath(); c.moveTo(x + d * s * .19, y - s * .15); c.lineTo(x + d * s * .03, y - s * .07); c.stroke(); });
      c.strokeStyle = P.hi; c.lineWidth = s * .035; c.beginPath(); c.moveTo(x - s * .09, y + s * .16); c.lineTo(x - s * .03, y + s * .12); c.lineTo(x + s * .03, y + s * .16); c.lineTo(x + s * .09, y + s * .12); c.stroke(); },
    // кислотная клякса с одним глазом
    slime(c, x, y, s, P) { c.lineJoin = 'round'; c.lineCap = 'round'; const body = () => { c.beginPath(); c.moveTo(x - s * .42, y + s * .1); c.bezierCurveTo(x - s * .5, y - s * .5, x + s * .5, y - s * .5, x + s * .42, y + s * .1);
        c.lineTo(x + s * .42, y + s * .34); c.quadraticCurveTo(x + s * .34, y + s * .5, x + s * .26, y + s * .3); c.lineTo(x + s * .2, y + s * .2); c.quadraticCurveTo(x + s * .1, y + s * .62, x, y + s * .26); c.lineTo(x - s * .1, y + s * .2); c.quadraticCurveTo(x - s * .22, y + s * .48, x - s * .3, y + s * .22); c.closePath(); };
      body(); c.lineWidth = s * .12; c.strokeStyle = P.o; c.stroke(); const g = c.createLinearGradient(0, y - s * .4, 0, y + s * .5); g.addColorStop(0, P.b); g.addColorStop(.6, P.a); g.addColorStop(1, P.c); c.fillStyle = g; c.fill();
      c.fillStyle = P.hi; c.beginPath(); c.arc(x, y - s * .06, s * .19, 0, 7); c.fill(); c.lineWidth = s * .05; c.stroke(); c.fillStyle = P.bg; c.beginPath(); c.arc(x + s * .03, y - s * .04, s * .1, 0, 7); c.fill(); c.fillStyle = P.o; c.beginPath(); c.arc(x + s * .04, y - s * .03, s * .05, 0, 7); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(x - s * .03, y - s * .11, s * .03, 0, 7); c.fill();
      c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.ellipse(x - s * .24, y - s * .2, s * .05, s * .09, .5, 0, 7); c.fill();
      c.strokeStyle = P.o; c.lineWidth = s * .04; c.beginPath(); c.arc(x, y + s * .14, s * .1, .2, Math.PI - .2); c.stroke();
      [[-.36, .5, .05], [.34, .56, .04]].forEach(d => { c.fillStyle = P.a; c.strokeStyle = P.o; c.lineWidth = s * .035; c.beginPath(); c.arc(x + d[0] * s, y + d[1] * s, d[2] * s, 0, 7); c.fill(); c.stroke(); }); },
    // сова на фоне луны
    owl(c, x, y, s, P) { c.lineJoin = 'round'; c.fillStyle = P.b; c.globalAlpha = .9; c.beginPath(); c.arc(x + s * .12, y - s * .1, s * .46, 0, 7); c.fill(); c.globalAlpha = 1; c.fillStyle = 'rgba(0,0,0,.08)'; [[.3, -.22, .07], [.06, -.36, .05], [.36, .06, .04]].forEach(d => { c.beginPath(); c.arc(x + d[0] * s, y + d[1] * s, d[2] * s, 0, 7); c.fill(); });
      const body = () => { c.beginPath(); c.moveTo(x - s * .3, y - s * .34); c.lineTo(x - s * .16, y - s * .22); c.quadraticCurveTo(x, y - s * .3, x + s * .16, y - s * .22); c.lineTo(x + s * .3, y - s * .34); c.quadraticCurveTo(x + s * .4, y + s * .1, x + s * .26, y + s * .36); c.quadraticCurveTo(x, y + s * .5, x - s * .26, y + s * .36); c.quadraticCurveTo(x - s * .4, y + s * .1, x - s * .3, y - s * .34); c.closePath(); };
      body(); c.lineWidth = s * .12; c.strokeStyle = P.o; c.stroke(); const g = c.createLinearGradient(0, y - s * .3, 0, y + s * .45); g.addColorStop(0, P.a); g.addColorStop(1, P.c); c.fillStyle = g; c.fill();
      c.strokeStyle = P.k; c.lineWidth = s * .03; for (let i = 0; i < 3; i++) for (let j = -1; j <= 1; j++) { c.beginPath(); c.arc(x + j * s * .11 + (i % 2) * s * .055, y + s * .14 + i * s * .09, s * .05, .2, Math.PI - .2); c.stroke(); }
      [-1, 1].forEach(d => { c.fillStyle = P.o; c.beginPath(); c.arc(x + d * s * .13, y - s * .06, s * .15, 0, 7); c.fill(); c.fillStyle = P.b; c.beginPath(); c.arc(x + d * s * .13, y - s * .06, s * .12, 0, 7); c.fill(); c.fillStyle = P.o; c.beginPath(); c.arc(x + d * s * .12, y - s * .05, s * .06, 0, 7); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(x + d * s * .12 - s * .025, y - s * .08, s * .022, 0, 7); c.fill(); });
      c.fillStyle = '#FF8A2A'; c.strokeStyle = P.o; c.lineWidth = s * .03; c.beginPath(); c.moveTo(x - s * .05, y + s * .04); c.lineTo(x + s * .05, y + s * .04); c.lineTo(x, y + s * .14); c.closePath(); c.fill(); c.stroke(); },
    // золотой зуб с короной
    tooth(c, x, y, s, P) { c.lineJoin = 'round'; const body = () => { c.beginPath(); c.moveTo(x - s * .3, y - s * .2); c.quadraticCurveTo(x - s * .16, y - s * .34, x, y - s * .22); c.quadraticCurveTo(x + s * .16, y - s * .34, x + s * .3, y - s * .2); c.quadraticCurveTo(x + s * .38, y + s * .06, x + s * .24, y + s * .44); c.quadraticCurveTo(x + s * .16, y + s * .5, x + s * .1, y + s * .2); c.quadraticCurveTo(x, y + s * .08, x - s * .1, y + s * .2); c.quadraticCurveTo(x - s * .16, y + s * .5, x - s * .24, y + s * .44); c.quadraticCurveTo(x - s * .38, y + s * .06, x - s * .3, y - s * .2); c.closePath(); };
      body(); c.lineWidth = s * .12; c.strokeStyle = P.o; c.stroke(); const g = c.createLinearGradient(x - s * .3, 0, x + s * .3, 0); g.addColorStop(0, P.b); g.addColorStop(.45, P.a); g.addColorStop(1, P.c); c.fillStyle = g; c.fill();
      c.fillStyle = 'rgba(255,255,255,.8)'; c.beginPath(); c.ellipse(x - s * .17, y - s * .08, s * .045, s * .11, .25, 0, 7); c.fill();
      GRAF_EXTRA.crown(c, x, y - s * .42, s * .5, { o: P.o, b: P.hi, hi: P.a, c: P.c });
      [[.36, -.3, .09], [-.4, .2, .06], [.34, .36, .05]].forEach(d => { const X = x + d[0] * s, Y = y + d[1] * s, r = d[2] * s; c.fillStyle = P.hi; c.beginPath(); c.moveTo(X, Y - r * 2); c.quadraticCurveTo(X, Y, X + r * 2, Y); c.quadraticCurveTo(X, Y, X, Y + r * 2); c.quadraticCurveTo(X, Y, X - r * 2, Y); c.quadraticCurveTo(X, Y, X, Y - r * 2); c.fill(); }); }
  };
  const star4 = (c, X, Y, r, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(X, Y - r); c.quadraticCurveTo(X, Y, X + r, Y); c.quadraticCurveTo(X, Y, X, Y + r); c.quadraticCurveTo(X, Y, X - r, Y); c.quadraticCurveTo(X, Y, X, Y - r); c.fill(); };
  // spec: { word, style, pal, w, h, seed, extra } — draws into c inside the box 0…w × 0…h
  function grafDraw(c, S) {
    const P = typeof S.pal === 'string' ? (GRAF_PALS[S.pal] || GRAF_PALS.fire) : S.pal, st = S.style, w = S.w, h = S.h, rnd = grafRnd((S.seed || 1) * 97 + 13);
    const word = grafWord(S.word, 8) || 'FT', chars = [...word], n = chars.length, ex = S.extra && S.extra !== 'crown' && GRAF_EXTRA[S.extra] && st !== 'tag' ? S.extra : null;
    const exW = ex ? Math.min(h * .95, w * .26) : 0, lx0 = ex && S.exLeft ? exW : 0, lw = w - exW;
    // how the style holds the letters
    // wt — how fat (in grid units of height), f — but never fatter than this share of the letter's width; r — round corners; gap — between letters
    // (below zero = they lean on each other); ol — outline; hgt — how much of the wall's height the letters take; wide — how far a letter may stretch
    const K = { tag: { wt: .62, f: .16, r: 1.1, gap: .1, ol: .3, skew: -.3, rot: .03, hgt: .5, wide: 1 }, bubble: { wt: 2.25, f: .6, r: 1.5, gap: -.4, ol: .3, skew: 0, rot: .08, hgt: .56, wide: 1.1 }, block: { wt: 1.75, f: .47, r: 0, gap: .2, ol: .28, skew: 0, rot: 0, hgt: .66, wide: 1.5 },
      wild: { wt: 1.45, f: .4, r: .3, gap: -.3, ol: .28, skew: .26, rot: .11, hgt: .56, wide: 1.1 }, d3: { wt: 1.7, f: .44, r: .5, gap: .12, ol: 0, skew: -.12, rot: 0, hgt: .56, wide: 1.4 } }[st] || {};
    // the size: the height of the wall decides how tall the letters are; a long word makes them narrower (and thinner), a short one — wider
    let sy = h * K.hgt / (6 + K.wt), sx, wt;
    const room = lw * (st === 'wild' ? .8 : .9), q = 4 * n + 4 * K.f * ((n - 1) * (1 + K.gap) + 1);
    sx = Math.min(sy * K.wide, room / q); if (sx < sy * .36) { const k = Math.max(.6, sx / (sy * .36)); sy *= k; }
    wt = Math.min(sy * K.wt, 4 * sx * K.f);
    const ol = Math.max(1.2, wt * K.ol), tot = n * 4 * sx + (n - 1) * (wt * (1 + K.gap)) + wt, x0 = lx0 + (lw - tot) / 2 + wt / 2, y0 = (h - 6 * sy) / 2 + (st === 'block' ? 0 : -h * .02), adv = 4 * sx + wt * (1 + K.gap);
    const L = chars.map((ch, i) => ({ ch, cx: x0 + i * adv + 2 * sx, cy: y0 + 3 * sy + (st === 'bubble' || st === 'wild' ? (i % 2 ? 1 : -1) * h * .035 * (.5 + rnd()) : 0), rot: K.rot ? (rnd() - .5) * 2 * K.rot : 0, skew: st === 'wild' ? (i % 2 ? -1 : 1) * K.skew * (.6 + rnd() * .5) : K.skew, k: st === 'wild' ? .92 + rnd() * .2 : 1 }));
    const path = (l, dx, dy) => { c.save(); c.translate(l.cx + (dx || 0), l.cy + (dy || 0)); c.rotate(l.rot); c.transform(1, 0, l.skew, 1, 0, 0); c.scale(l.k, l.k); c.beginPath(); glyph(c, l.ch, -2 * sx, -3 * sy, sx, sy, K.r); };
    const stroke = (l, col, lwd, dx, dy) => { if (l.ch === ' ') return; path(l, dx, dy); c.strokeStyle = col; c.lineWidth = lwd; c.stroke(); c.restore(); };
    const all = (col, lwd, dx, dy) => L.forEach(l => stroke(l, col, lwd, dx, dy));
    const round = st !== 'block'; c.lineCap = round ? 'round' : 'square'; c.lineJoin = round ? 'round' : 'miter'; c.miterLimit = 3;
    const top = y0 - wt / 2, bot = y0 + 6 * sy + wt / 2, left = x0 - wt / 2, right = left + tot, mx = (left + right) / 2, my = (top + bot) / 2;
    const vgrad = (c1, c2, c3) => { const g = c.createLinearGradient(0, -3 * sy - wt / 2, 0, 3 * sy + wt / 2); g.addColorStop(0, c1); g.addColorStop(.5, c2); g.addColorStop(1, c3); return g; };
    const drips = (col, k, edge) => { for (let i = 0; i < k; i++) { const X = left + wt * .4 + rnd() * (tot - wt * .8), len = h * (.06 + rnd() * .16), dw = Math.max(1.6, wt * (.1 + rnd() * .08)); if (edge) { c.strokeStyle = P.o; c.lineWidth = dw + ol * 1.2; c.beginPath(); c.moveTo(X, bot - wt * .4); c.lineTo(X, bot + len); c.stroke(); } c.strokeStyle = col; c.lineWidth = dw; c.beginPath(); c.moveTo(X, bot - wt * .5); c.lineTo(X, bot + len); c.stroke(); } };
    const shine = (lwd, a) => { c.save(); c.globalAlpha = a; c.setLineDash([sy * 2.4, sy * 60]); c.lineCap = 'round'; L.forEach(l => stroke(l, P.hi, lwd, -wt * .2, -wt * .22)); c.restore(); c.lineCap = round ? 'round' : 'square'; };
    const stars = k => { for (let i = 0; i < k; i++) star4(c, left - wt * .2 + rnd() * (tot + wt * .4), top - h * .04 + rnd() * (bot - top) * .5, h * (.03 + rnd() * .04), P.hi); };

    if (st === 'tag') {
      // a quick one-line tag: slanted hand, an underline that ends in an arrow, a crown over it
      const under = lwd => { c.lineWidth = lwd; c.beginPath(); c.moveTo(left - wt, bot + sy * 1.1); c.quadraticCurveTo(mx, bot + sy * 2.4, right + wt * 1.2, bot + sy * .5); c.stroke();
        c.beginPath(); c.moveTo(right + wt * 1.2 - sy * 1.2, bot + sy * .1); c.lineTo(right + wt * 1.2, bot + sy * .5); c.lineTo(right + wt * 1.2 - sy * .7, bot + sy * 1.5); c.stroke(); };
      all(P.o, wt + ol * 2); c.strokeStyle = P.o; under(wt * .8 + ol * 2); all(P.b, wt); c.strokeStyle = P.a; under(wt * .8);
      drips(P.b, 2); GRAF_EXTRA.crown(c, left + sx * 1.2, top - sy * 1.5, sy * 2.6, P);
      star4(c, right + wt, top - sy * .6, sy * 1.1, P.hi); return;
    }
    if (st === 'bubble') {
      // throw-up: a soft cloud, puffy letters that lean on each other, shine, bubbles
      const cloud = (col, grow) => { c.fillStyle = col; c.beginPath(); const m = Math.max(5, Math.round(tot / (h * .22))); for (let i = 0; i <= m; i++) { const X = left + tot * i / m; c.moveTo(X, top); c.arc(X, top + h * .02, h * .15 + grow, 0, 7); c.moveTo(X, bot); c.arc(X, bot - h * .02, h * .15 + grow, 0, 7); } c.rect(left - h * .08 - grow, top, tot + h * .16 + grow * 2, bot - top); c.fill(); };
      cloud(P.o, ol * .9); cloud(P.bg, 0); c.fillStyle = 'rgba(255,255,255,.16)'; for (let i = 0; i < 7; i++) { c.beginPath(); c.arc(left + rnd() * tot, top - h * .06 + rnd() * h * .12, h * (.02 + rnd() * .03), 0, 7); c.fill(); }
      all(P.k, wt + ol * 2, ol * 1.5, ol * 1.7);
      L.forEach(l => { stroke(l, P.o, wt + ol * 2); stroke(l, vgrad(P.b, P.a, P.c), wt); });
      shine(wt * .16, .95); L.forEach(l => { if (l.ch === ' ') return; c.fillStyle = P.hi; c.beginPath(); c.ellipse(l.cx - sx * 1.5, l.cy - sy * 2.6, wt * .12, wt * .2, -.6, 0, 7); c.fill(); });
      for (let i = 0; i < 6; i++) { const X = left - h * .1 + rnd() * (tot + h * .2), Y = rnd() < .5 ? top - h * (.1 + rnd() * .08) : bot + h * (.06 + rnd() * .08), r = h * (.025 + rnd() * .035); c.strokeStyle = P.o; c.lineWidth = Math.max(1, ol * .5); c.fillStyle = P.a; c.beginPath(); c.arc(X, Y, r, 0, 7); c.fill(); c.stroke(); c.fillStyle = P.hi; c.beginPath(); c.arc(X - r * .3, Y - r * .3, r * .3, 0, 7); c.fill(); }
      drips(P.a, 3, true);
    } else if (st === 'block') {
      // blockbuster: a rolled-on band of paint, huge straight letters in two tones, a hard shadow
      const bx = left - h * .1, bw = tot + h * .2, by = top - h * .09, bh = bot - top + h * .18;
      c.fillStyle = P.bg; c.beginPath(); c.moveTo(bx, by + 3); for (let i = 0; i <= 12; i++) c.lineTo(bx + bw * i / 12, by + (rnd() - .5) * h * .035); for (let i = 12; i >= 0; i--) c.lineTo(bx + bw * i / 12, by + bh + (rnd() - .5) * h * .035); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,255,255,.1)'; c.fillRect(bx, by + bh * .08, bw, bh * .1); c.fillStyle = 'rgba(0,0,0,.14)'; c.fillRect(bx, by + bh * .8, bw, bh * .12);
      for (let i = 0; i < 4; i++) { const X = bx + bw * (.06 + rnd() * .88); c.strokeStyle = P.bg; c.lineWidth = Math.max(2, h * .018); c.lineCap = 'round'; c.beginPath(); c.moveTo(X, by + bh - 2); c.lineTo(X, by + bh + h * (.05 + rnd() * .1)); c.stroke(); } c.lineCap = 'square';
      const dp = Math.max(3, wt * .5); for (let i = Math.ceil(dp); i >= 1; i--) all(i === Math.ceil(dp) ? P.o : P.k, wt + ol * 2, i, i);
      all(P.o, wt + ol * 2);
      const g = c.createLinearGradient(0, -3 * sy - wt / 2, 0, 3 * sy + wt / 2); g.addColorStop(0, P.b); g.addColorStop(.47, P.b); g.addColorStop(.47, P.o); g.addColorStop(.5, P.o); g.addColorStop(.5, P.a); g.addColorStop(.84, P.a); g.addColorStop(.84, P.c); g.addColorStop(1, P.c); all(g, wt);
      c.fillStyle = P.hi; L.forEach(l => { if (l.ch === ' ') return; c.fillRect(l.cx - 2 * sx - wt * .32, l.cy - 3 * sy - wt * .32, wt * .2, sy * 1.6); c.fillRect(l.cx - 2 * sx - wt * .32, l.cy - 3 * sy - wt * .32, sx * 1.1, wt * .16); });
      for (let i = 0; i < 26; i++) { c.fillStyle = i % 2 ? 'rgba(0,0,0,.2)' : 'rgba(255,255,255,.2)'; c.fillRect(left + rnd() * tot, top + rnd() * (bot - top), 1.2 + rnd() * 2, 1.2 + rnd() * 2); }
      stars(2);
    } else if (st === 'wild') {
      // wildstyle: a burst behind, letters that lean and lock into each other, a light edge round everything, arrows
      c.fillStyle = P.bg; c.beginPath(); const m = 22; for (let i = 0; i < m; i++) { const a = i / m * Math.PI * 2, r = (i % 2 ? 1.02 : .8) + rnd() * .1; c.lineTo(mx + Math.cos(a) * (tot / 2 + h * .2) * r, my + Math.sin(a) * (bot - top) * .64 * r); } c.closePath(); c.fill();
      c.strokeStyle = P.o; c.lineWidth = Math.max(1.5, ol * .7); c.lineJoin = 'miter'; c.stroke(); c.lineJoin = 'round';
      for (let i = 0; i < 12; i++) { c.fillStyle = i % 3 ? P.hi : P.b; c.globalAlpha = .8; c.beginPath(); c.arc(left + rnd() * tot, (i % 2 ? top - h * .04 : bot + h * .04) + (rnd() - .5) * h * .1, h * (.008 + rnd() * .014), 0, 7); c.fill(); } c.globalAlpha = 1;
      // arrows grow out of the first and the last letter and from under the word
      const arrows = [[[left + sx, bot - sy], [left - h * .1, bot + h * .02], [left - h * .2, bot - h * .12]], [[right - sx, top + sy], [right + h * .1, top - h * .02], [right + h * .22, top + h * .1]], [[mx - sx, top + sy * .5], [mx, top - h * .1], [mx + h * .14, top - h * .15]]];
      const arrow = (pts, col, lwd, headK) => { c.strokeStyle = col; c.fillStyle = col; c.lineWidth = lwd; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke(); const a = pts[pts.length - 2], b = pts[pts.length - 1], an = Math.atan2(b[1] - a[1], b[0] - a[0]), hs = wt * headK; c.beginPath(); c.moveTo(b[0] + Math.cos(an) * hs, b[1] + Math.sin(an) * hs); c.lineTo(b[0] + Math.cos(an + 2.2) * hs, b[1] + Math.sin(an + 2.2) * hs); c.lineTo(b[0] + Math.cos(an - 2.2) * hs, b[1] + Math.sin(an - 2.2) * hs); c.closePath(); c.fill(); c.stroke(); };
      const bar = [[left - h * .04, bot + h * .05], [right + h * .06, bot + h * .01]];
      all(P.hi, wt + ol * 2 + ol * 1.6); arrows.forEach(a => arrow(a, P.hi, wt * .5 + ol * 2 + ol * 1.6, .9));
      all(P.k, wt + ol * 2, ol * 1.4, ol * 1.6);
      arrows.forEach(a => { arrow(a, P.o, wt * .5 + ol * 2, .9); arrow(a, P.c, wt * .5, .78); });
      c.lineCap = 'butt'; c.strokeStyle = P.o; c.lineWidth = wt * .34 + ol * 2; c.beginPath(); c.moveTo(bar[0][0], bar[0][1]); c.lineTo(bar[1][0], bar[1][1]); c.stroke(); c.strokeStyle = P.b; c.lineWidth = wt * .34; c.stroke(); c.lineCap = 'round';
      L.forEach(l => { stroke(l, P.o, wt + ol * 2); stroke(l, vgrad(P.b, P.a, P.c), wt); });
      // a thin dark line inside the letters and cuts across them: the «wild» look
      c.save(); c.globalAlpha = .4; L.forEach(l => stroke(l, P.o, wt * .1, wt * .18, wt * .22)); c.restore(); shine(wt * .13, .95); stars(4);
    } else if (st === 'd3') {
      // 3D: no outline — the letters stand out of the wall, the depth runs down to one point
      const g0 = c.createRadialGradient(mx, my, 0, mx, my, tot * .62); g0.addColorStop(0, P.bg); g0.addColorStop(.7, P.bg); g0.addColorStop(1, 'rgba(0,0,0,0)'); c.globalAlpha = .8; c.fillStyle = g0; c.beginPath(); c.ellipse(mx, my + h * .04, tot * .62, (bot - top) * .78, 0, 0, 7); c.fill(); c.globalAlpha = 1;
      const vx = mx, vy = bot + h * .9, N = Math.max(10, Math.round(wt * 1.1));
      for (let i = N; i >= 1; i--) { const t = i / N * .2, col = mixCol(P.k, P.c, 1 - i / N); L.forEach(l => { if (l.ch === ' ') return; c.save(); c.translate(vx, vy); c.scale(1 - t, 1 - t); c.translate(-vx, -vy); c.translate(l.cx, l.cy); c.rotate(l.rot); c.transform(1, 0, l.skew, 1, 0, 0); c.beginPath(); glyph(c, l.ch, -2 * sx, -3 * sy, sx, sy, K.r); c.strokeStyle = col; c.lineWidth = wt; c.stroke(); c.restore(); }); }
      all(vgrad(P.hi, P.b, P.a), wt); c.save(); c.globalAlpha = .5; all(P.c, wt * .1, wt * .2, wt * .24); c.restore(); shine(wt * .18, 1); stars(5);
    }
    if (ex) GRAF_EXTRA[ex](c, S.exLeft ? exW * .5 : w - exW * .52, h * .5, exW * .92, P);
    if (S.extra === 'crown') { const l = L[0], s = Math.min(h * .26, sx * 5 + wt); c.save(); c.translate(l.cx - sx * .6, top - s * .16); c.rotate(-.22); GRAF_EXTRA.crown(c, 0, 0, s, P); c.restore(); }
  }
  // a finished piece as a picture (kept: the same piece is drawn every frame)
  function graf(S) {
    const sc = S.scale || dpr || 1, key = [S.word, S.style, typeof S.pal === 'string' ? S.pal : JSON.stringify(S.pal), S.w, S.h, S.seed, S.extra, S.exLeft ? 1 : 0, sc].join('|');
    let cv = grafCache.get(key); if (cv) return cv;
    cv = document.createElement('canvas'); cv.width = Math.round(S.w * sc); cv.height = Math.round(S.h * sc); const c = cv.getContext('2d'); c.scale(sc, sc);
    try { grafDraw(c, S); } catch (_) {}
    if (grafCache.size > 40) grafCache.delete(grafCache.keys().next().value); grafCache.set(key, cv); return cv;
  }
  function smoke(c, px, py, now) { for (let i = 0; i < 4; i++) { const u = ((now / 2600) + i / 4) % 1; c.fillStyle = 'rgba(240,240,244,' + (.34 * (1 - u)).toFixed(3) + ')'; c.beginPath(); c.ellipse(px - u * 16 + Math.sin(u * 6 + i) * 3, py - u * 34, 4 + u * 9, 3 + u * 7, 0, 0, 7); c.fill(); } }
  // the DJ's table: two decks (they spin; faster and with a glow while his beat is on) and a mixer
  function deck(c, px, py, now, on) {
    const R = (a, b, w, h, col) => { c.fillStyle = col; c.fillRect(a, b, w, h); };
    R(px - 30, py - 4, 66, 30, 'rgba(8,10,24,.3)'); R(px - 34, py - 12, 68, 30, '#16161A'); R(px - 32, py - 10, 64, 20, '#3A3D45'); R(px - 32, py + 10, 64, 6, '#26262B');
    [-19, 19].forEach((dx, i) => { c.fillStyle = '#0E0E10'; c.beginPath(); c.ellipse(px + dx, py, 10.5, 8.4, 0, 0, 7); c.fill(); c.strokeStyle = '#3A3D45'; c.lineWidth = 1; c.beginPath(); c.ellipse(px + dx, py, 7, 5.6, 0, 0, 7); c.stroke();
      const a = now / (on ? 190 : 520) + i * 2; c.fillStyle = i ? '#4FC0FF' : OR; c.beginPath(); c.ellipse(px + dx, py, 3.6, 2.9, 0, 0, 7); c.fill(); c.strokeStyle = WH; c.lineWidth = 1.2; c.beginPath(); c.moveTo(px + dx, py); c.lineTo(px + dx + Math.cos(a) * 9.5, py + Math.sin(a) * 7.6); c.stroke(); });
    R(px - 5, py - 7, 10, 14, '#16161A'); R(px - 3, py - 5, 2, 10, '#7CFF4F'); R(px + 1, py - 5 + (Math.floor(now / 160) % 3) * 2, 2, 6, '#FF4F9A');
    if (on) for (let i = 0; i < 3; i++) { const u = ((now / 900) + i / 3) % 1; c.strokeStyle = 'rgba(79,192,255,' + (.5 * (1 - u)).toFixed(2) + ')'; c.lineWidth = 2; c.beginPath(); c.ellipse(px, py, 36 + u * 26, 20 + u * 16, 0, 0, 7); c.stroke(); }
  }
  function carAt(c, px, py, i, lights) { car(c, px, py, CARS[i % CARS.length]); if (lights) { const g = c.createLinearGradient(px - 44, 0, px - 120, 0); g.addColorStop(0, 'rgba(255,243,184,.5)'); g.addColorStop(1, 'rgba(255,243,184,0)'); c.fillStyle = g; c.beginPath(); c.moveTo(px - 44, py - 14); c.lineTo(px - 120, py - 30); c.lineTo(px - 120, py + 26); c.lineTo(px - 44, py + 10); c.fill(); } }

  // ================= signs instead of emoji =================
  function sign(c, x, y, type, dim) {
    const grey = dim === true, col = grey ? '#6C6F78' : WH, ac = grey ? '#6C6F78' : (typeof dim === 'string' ? dim : OR);   // dim: true = closed (grey); a colour = the ring's colour (a crew's wall)
    c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.arc(x + 1.5, y + 2.5, 13, 0, 7); c.fill();
    c.fillStyle = '#151517'; c.beginPath(); c.arc(x, y, 13, 0, 7); c.fill(); c.strokeStyle = ac; c.lineWidth = 1.6; c.beginPath(); c.arc(x, y, 12.2, 0, 7); c.stroke();
    c.fillStyle = col; c.strokeStyle = col; c.lineWidth = 1.6; c.lineJoin = 'round'; c.lineCap = 'round';
    if (type === 'home') { c.beginPath(); c.moveTo(x - 7, y); c.lineTo(x, y - 7); c.lineTo(x + 7, y); c.lineTo(x + 5, y); c.lineTo(x + 5, y + 6); c.lineTo(x - 5, y + 6); c.lineTo(x - 5, y); c.fill(); c.fillStyle = ac; c.fillRect(x - 1.6, y + 1, 3.2, 5); }
    else if (type === 'trash') { c.fillStyle = '#A47E4C'; c.fillRect(x - 6, y - 3, 12, 9); c.fillStyle = col; c.beginPath(); c.moveTo(x - 6, y - 3); c.lineTo(x - 9, y - 7); c.lineTo(x - 2, y - 6); c.lineTo(x, y - 3); c.lineTo(x + 2, y - 6); c.lineTo(x + 9, y - 7); c.lineTo(x + 6, y - 3); c.fill(); c.fillStyle = '#7A5A34'; c.fillRect(x - 1, y - 3, 2, 9); }
    else if (type === 'kiosk') { c.fillStyle = '#F2E2B8'; c.beginPath(); c.moveTo(x - 6, y - 6); c.lineTo(x + 7, y - 3); c.lineTo(x - 2, y + 8); c.fill(); c.fillStyle = '#3BD16F'; c.fillRect(x - 3, y - 4, 7, 2); c.fillStyle = '#C8102E'; c.fillRect(x - 3, y - 1, 5, 2); }
    else if (type === 'shop') { c.fillRect(x - 6, y - 2, 12, 9); c.beginPath(); c.arc(x, y - 2, 3.6, Math.PI, 0); c.stroke(); c.fillStyle = ac; c.fillRect(x - 6, y + 1, 12, 2); }
    else if (type === 'show') { c.beginPath(); c.ellipse(x, y - 3, 8, 2.6, 0, 0, 7); c.fill(); c.beginPath(); c.moveTo(x - 5, y - 2.4); c.lineTo(x - 4, y + 6); c.lineTo(x + 4, y + 6); c.lineTo(x + 5, y - 2.4); c.fill(); c.fillStyle = '#C9B458'; c.beginPath(); c.arc(x - 1, y - 7.4, 1.8, 0, 7); c.arc(x + 3.4, y - 8.6, 1.5, 0, 7); c.fill(); }
    else if (type === 'gate') { c.beginPath(); c.moveTo(x - 7, y - 2); c.lineTo(x + 1, y - 2); c.lineTo(x + 1, y - 6); c.lineTo(x + 8, y); c.lineTo(x + 1, y + 6); c.lineTo(x + 1, y + 2); c.lineTo(x - 7, y + 2); c.fill(); }
    else if (type === 'wall' || type === 'turf') { c.fillRect(x - 3.5, y - 3, 7, 10); c.fillStyle = ac; c.fillRect(x - 3.5, y + 1, 7, 3); c.fillStyle = col; c.fillRect(x - 2.5, y - 6, 5, 3); c.fillStyle = ac; c.beginPath(); c.arc(x + 6, y - 6, 1.4, 0, 7); c.arc(x + 8.4, y - 3, 1.1, 0, 7); c.arc(x + 8, y - 8.6, 1, 0, 7); c.fill(); }
    else if (type === 'gym') { c.fillRect(x - 6, y - 1.2, 12, 2.4); c.fillRect(x - 8.6, y - 5, 3, 10); c.fillRect(x + 5.6, y - 5, 3, 10); c.fillStyle = ac; c.fillRect(x - 10.4, y - 3, 2, 6); c.fillRect(x + 8.4, y - 3, 2, 6); }
    else if (type === 'mc') { c.beginPath(); c.roundRect(x - 3.4, y - 8, 6.8, 10, 3.4); c.fill(); c.strokeStyle = col; c.lineWidth = 1.6; c.beginPath(); c.arc(x, y, 6, .15, Math.PI - .15); c.stroke(); c.fillRect(x - .8, y + 5.6, 1.6, 3); c.fillStyle = ac; c.fillRect(x - 3.4, y - 3, 6.8, 1.6); }
    else if (type === 'dj') { c.beginPath(); c.arc(x, y, 8, 0, 7); c.fill(); c.fillStyle = '#151517'; c.beginPath(); c.arc(x, y, 5.4, 0, 7); c.fill(); c.fillStyle = ac; c.beginPath(); c.arc(x, y, 2.6, 0, 7); c.fill(); }
    else if (type === 'job') { c.fillStyle = '#F2E2B8'; c.beginPath(); c.moveTo(x - 6, y - 6); c.lineTo(x + 7, y - 3); c.lineTo(x - 2, y + 8); c.fill(); c.fillStyle = '#3BD16F'; c.fillRect(x - 3, y - 4, 7, 2); c.fillStyle = '#C8102E'; c.fillRect(x - 3, y - 1, 5, 2); }
    else { c.font = '400 17px Anton, Inter, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = ac; c.fillText('?', x, y + 1); }
  }

  // ================= night: darkness with pools of light =================
  // lights: [{ px, py (screen), r (px), a }]
  function night(c, W, H, ng, lights) {
    if (ng <= 0) return;
    const w = Math.ceil(W / 2), h = Math.ceil(H / 2);
    if (!darkCan || darkCan.width !== w || darkCan.height !== h) { darkCan = document.createElement('canvas'); darkCan.width = w; darkCan.height = h; }
    const q = darkCan.getContext('2d'), k = Math.min(1, ng / .55);
    q.globalCompositeOperation = 'source-over'; q.clearRect(0, 0, w, h); q.fillStyle = 'rgba(7,9,30,' + (.56 * k).toFixed(3) + ')'; q.fillRect(0, 0, w, h);
    q.globalCompositeOperation = 'destination-out';
    lights.forEach(l => { const x = l.px / 2, y = l.py / 2, r = l.r / 2, g = q.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(0,0,0,' + l.a + ')'); g.addColorStop(.55, 'rgba(0,0,0,' + l.a * .6 + ')'); g.addColorStop(1, 'rgba(0,0,0,0)'); q.fillStyle = g; q.beginPath(); q.arc(x, y, r, 0, 7); q.fill(); });
    c.imageSmoothingEnabled = true; c.drawImage(darkCan, 0, 0, W, H);
    c.globalCompositeOperation = 'lighter';
    lights.forEach(l => { const g = c.createRadialGradient(l.px, l.py, 0, l.px, l.py, l.r); g.addColorStop(0, 'rgba(255,190,90,' + (.2 * l.a * k).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,190,90,0)'); c.fillStyle = g; c.beginPath(); c.arc(l.px, l.py, l.r, 0, 7); c.fill(); });
    c.globalCompositeOperation = 'source-over';
  }
  // which lights are on now (lamps at night, the kiosk while it works, windows — some, new every game day)
  function lightsNow(ox, oy, W, H, day, kioskOpen) {
    const out = []; dayNow = day;
    lightsStatic.forEach(l => {
      if (l.kiosk && !kioskOpen) return;
      if (l.win && hash(l.sx * 3 + day, l.sy * 7) > .5) return;
      const px = ox + l.x * TS, py = oy + l.y * TS, r = l.r * TS; if (px < -r || py < -r || px > W + r || py > H + r) return;
      out.push({ px, py, r, a: l.a, lamp: !l.win && !l.kiosk && l.r > 2, kiosk: l.kiosk, kx: l.kx, ky: l.ky });
    });
    return out;
  }
  // bright things that glow through the dark: lamp heads, windows (some, new every game day), the kiosk
  function glow(c, ox, oy, lights, ng, W, H) {
    if (ng <= .05) return; const a = Math.min(1, ng / .4);
    lights.forEach(l => {
      if (l.lamp) { c.fillStyle = 'rgba(255,246,200,' + a + ')'; c.beginPath(); c.ellipse(l.px - .01 * TS, l.py - .51 * TS, 4.8, 2.8, 0, 0, 7); c.fill(); }
      if (l.kiosk) { c.fillStyle = 'rgba(255,190,80,' + (.8 * a) + ')'; c.fillRect(ox + l.kx * TS + 10, oy + l.ky * TS + 66, 58, 22); c.fillStyle = 'rgba(255,225,90,' + (.75 * a) + ')'; c.fillRect(ox + l.kx * TS + 24, oy + l.ky * TS + 30, 56, 13); }
    });
    comps.forEach(B => {
      if (!B.wins) return; const X = ox + B.x0 * TS, Y = oy + B.y0 * TS; if (X > (W || 1e4) || Y > (H || 1e4) || X + B.w * TS < 0 || Y + B.h * TS < 0) return;
      B.wins.forEach(w => { const k = hash(w.i * 5 + dayNow * 3 + B.seed, w.f * 11 + 1); if (k > .46) return; c.fillStyle = (k < .08 ? 'rgba(150,200,255,' : k < .16 ? 'rgba(255,170,120,' : 'rgba(255,214,110,') + (.92 * a) + ')'; c.fillRect(ox + w.x, oy + w.y, w.w, w.h); });
    });
  }

  // ================= fog: soft darkness instead of black squares =================
  function fog(c, fogStr, ox, oy) {
    if (fogKey !== fogStr) {
      fogKey = fogStr; if (!fogCan) fogCan = document.createElement('canvas'); fogCan.width = MW; fogCan.height = MH;
      const q = fogCan.getContext('2d'), im = q.createImageData(MW, MH), d = im.data, un = (x, y) => x < 0 || y < 0 || x >= MW || y >= MH || fogStr[y * MW + x] !== '1';
      for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
        let a = 0; if (un(x, y)) a = 255; else { let n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (un(x + dx, y + dy)) n++; a = n ? Math.min(150, 50 + n * 22) : 0; }
        const i = (y * MW + x) * 4; d[i] = 9; d[i + 1] = 9; d[i + 2] = 11; d[i + 3] = a;
      }
      q.putImageData(im, 0, 0);
    }
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; c.drawImage(fogCan, ox, oy, MW * TS, MH * TS); c.imageSmoothingEnabled = false;
  }

  window.CITY_GFX = { TS, setMap, drawMap, crate, crown, pickup, graf, grafWord, GRAF_STYLES, GRAF_PALS, wallRect: id => wallRects[id], smoke, carAt, deck, person, aura, bird, sign, night, lightsNow, glow, fog, trees: () => trees, _chunks: () => chunks.size, _sprites: () => sprites.size };
})();
