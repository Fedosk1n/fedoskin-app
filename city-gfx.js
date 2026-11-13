// «Город» — графика (owner 13.11.2026 «надо улучшать» → выбрал вариант 2: чёткая графика, строго сверху, дух ранних top-down игр).
// Всё рисуется кодом, своё: без чужих спрайтов, брендов и логотипов. Логики игры здесь нет — только картинка.
// Карта рисуется один раз кусками (chunks) в скрытые холсты, люди — в кэш спрайтов (образ × направление × кадр); на экран — копирование.
// Одежда героя берётся из hero.js (HERO.topDown) — второй таблицы одежды здесь нет.
(function () {
  'use strict';
  const TS = 52, CH = 6, SP = 100, KEEP = 12;
  const OR = '#E2611A', WH = '#F2EFE8', INK = '#0E0E10';
  let MAP, MW, MH, dpr = 1, chunks = new Map(), sprites = new Map(), fogCan = null, fogKey = '', darkCan = null, trees = [], lightsStatic = [], use = 0;
  const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const tile = (x, y) => x < 0 || y < 0 || x >= MW || y >= MH ? 'F' : MAP[y][x];
  const TALL = '#bGKSD';
  const roofOf = t => t === 'D' ? '#' : t;
  // the ground under a thing
  function groundOf(x, y) {
    const t = tile(x, y);
    if ('.=rgp'.includes(t)) return t;
    if (t === 't') return 'g';
    if (t === 'F') return 'F';
    if (t === 'C') { for (const dx of [-1, 1, -2, 2]) { const n = tile(x + dx, y); if (n === 'r') return 'r'; if (n !== 'C') break; } return '.'; }
    return '.';
  }
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * dpr)); c.height = Math.max(1, Math.round(h * dpr)); const q = c.getContext('2d'); q.scale(dpr, dpr); if (!q.roundRect) q.roundRect = function (x, y, a, b) { this.rect(x, y, a, b); }; return [c, q]; };

  // ================= map =================
  function setMap(dist, ratio) {
    MAP = dist.map; MH = MAP.length; MW = MAP[0].length; dpr = ratio || 1; chunks.clear(); sprites.clear(); fogKey = ''; trees = []; lightsStatic = [];
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      const t = MAP[y][x];
      if (t === 't') trees.push([x, y]);
      if (t === 'L') lightsStatic.push({ x: x + .22, y: y + .68, r: 2.9, a: 1 });
      if (t === 'D') lightsStatic.push({ x: x + .5, y: y + 1.25, r: 1.5, a: .8 });
      if (t === 'K' && tile(x - 1, y) !== 'K' && tile(x, y - 1) !== 'K') lightsStatic.push({ x: x + 1, y: y + 2.1, r: 2.1, a: .9, kiosk: 1 });
      if ((t === '#' || t === 'b') && skylight(x, y)) lightsStatic.push({ x: x + .5, y: y + .5, r: .9, a: .55, sky: 1, sx: x, sy: y });
      // light from the windows falls on the ground by the south wall
      if ((t === '#' || t === 'b') && !TALL.includes(tile(x, y + 1)) && tile(x, y + 1) !== 'F') lightsStatic.push({ x: x + .5, y: y + 1.2, r: 1.05, a: .5, win: 1, sx: x, sy: y });
    }
  }
  const inner = (x, y) => { const t = roofOf(tile(x, y)); return roofOf(tile(x - 1, y)) === t && roofOf(tile(x + 1, y)) === t && roofOf(tile(x, y - 1)) === t && roofOf(tile(x, y + 1)) === t; };
  const skylight = (x, y) => inner(x, y) && hash(x + 50, y + 9) > .34 && hash(x + 50, y + 9) < .42;

  function ground(c, x, y, px, py) {
    const g = groundOf(x, y), h = hash(x, y), R = (a, b, w, hh, col) => { c.fillStyle = col; c.fillRect(a, b, w, hh); };
    if (g === 'F') { R(px, py, TS, TS, '#101012'); return; }
    if (g === '.') {
      R(px, py, TS, TS, '#3C3D44');
      for (let i = 0; i < 14; i++) { const v = hash(x * 31 + i, y * 17 + i); R(px + Math.floor(hash(x + i * 7, y) * TS), py + Math.floor(hash(x, y + i * 13) * TS), v > .8 ? 2 : 1, 1, v < .5 ? 'rgba(0,0,0,.22)' : 'rgba(255,255,255,.07)'); }
      if (tile(x, y) !== '.') return;
      if (h < .05) { c.strokeStyle = '#26272C'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(px + 4, py + 10 + h * 300); for (let i = 1; i < 6; i++) c.lineTo(px + 4 + i * 9, py + 12 + h * 300 + (hash(x + i, y + 5) - .5) * 16); c.stroke(); }
      else if (h < .065) { const pw = 22 + Math.floor(hash(y, x) * 20), ph = 16 + Math.floor(hash(y + 3, x) * 18); R(px + 5, py + 8, pw, ph, 'rgba(20,20,24,.2)'); c.strokeStyle = 'rgba(0,0,0,.22)'; c.lineWidth = 1; c.strokeRect(px + 5.5, py + 8.5, pw, ph); }
      else if (h < .075) { const mx = px + 26, my = py + 26; c.fillStyle = '#27272B'; c.beginPath(); c.arc(mx, my, 12, 0, 7); c.fill(); c.fillStyle = '#4E4F56'; c.beginPath(); c.arc(mx, my, 10, 0, 7); c.fill(); c.fillStyle = '#33343A'; c.beginPath(); c.arc(mx, my, 8, 0, 7); c.fill(); c.strokeStyle = '#4E4F56'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(mx - 7, my); c.lineTo(mx + 7, my); c.moveTo(mx, my - 7); c.lineTo(mx, my + 7); c.stroke(); }
      else if (h < .09) { c.fillStyle = '#33475C'; c.beginPath(); c.ellipse(px + 24, py + 28, 19, 9, .15, 0, 7); c.ellipse(px + 36, py + 22, 10, 6, -.3, 0, 7); c.fill(); c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = 1; c.beginPath(); c.ellipse(px + 21, py + 26, 9, 3, .15, 3.4, 5.2); c.stroke(); }
      else if (h < .16) { c.save(); c.translate(px + 10 + h * 150, py + 14 + hash(y, x) * 26); c.rotate(h * 40); R(-2, -1.5, 5, 3, ['#D9D4C7', '#C9B458', '#7FB0D8', '#C96B5A'][Math.floor(h * 1000) % 4]); c.restore(); }
      else if (h < .18) { c.fillStyle = 'rgba(12,12,16,.3)'; c.beginPath(); c.ellipse(px + 26, py + 24, 12, 8, h * 9, 0, 7); c.fill(); }
      return;
    }
    if (g === '=') {
      R(px, py, TS, TS, '#6C6B68'); c.strokeStyle = '#5A5956'; c.lineWidth = 1;
      for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(px + i * 13 + .5, py); c.lineTo(px + i * 13 + .5, py + TS); c.moveTo(px, py + i * 13 + .5); c.lineTo(px + TS, py + i * 13 + .5); c.stroke(); }
      for (let i = 0; i < 3; i++) R(px + Math.floor(hash(x + i, y * 3) * 4) * 13 + 1, py + Math.floor(hash(x * 3, y + i) * 4) * 13 + 1, 12, 12, 'rgba(0,0,0,.07)');
      const lo = (dx, dy) => '.r*cCLBTX'.includes(tile(x + dx, y + dy));
      if (lo(0, 1)) { R(px, py + TS - 4, TS, 3, '#93928D'); R(px, py + TS - 1, TS, 1, 'rgba(0,0,0,.45)'); }
      if (lo(0, -1)) { R(px, py + 1, TS, 3, '#93928D'); R(px, py, TS, 1, 'rgba(0,0,0,.45)'); }
      if (lo(1, 0)) { R(px + TS - 4, py, 3, TS, '#93928D'); R(px + TS - 1, py, 1, TS, 'rgba(0,0,0,.45)'); }
      if (lo(-1, 0)) { R(px + 1, py, 3, TS, '#93928D'); R(px, py, 1, TS, 'rgba(0,0,0,.45)'); }
      return;
    }
    if (g === 'r') {
      R(px, py, TS, TS, '#2D2E34');
      for (let i = 0; i < 12; i++) R(px + Math.floor(hash(x + i * 5, y) * TS), py + Math.floor(hash(x, y + i * 11) * TS), 1, 1, hash(x + i, y + i) < .5 ? 'rgba(0,0,0,.25)' : 'rgba(255,255,255,.06)');
      if (tile(x, y - 1) !== 'r' && groundOf(x, y - 1) !== 'r') { R(px, py, TS, 3, '#93928D'); R(px, py + 3, TS, 1.5, 'rgba(0,0,0,.45)'); }
      if (groundOf(x, y + 1) === 'r') { R(px + 6, py + TS - 2, 22, 3, '#C9B458'); }
      if (h < .1) { c.fillStyle = 'rgba(12,12,16,.35)'; c.beginPath(); c.ellipse(px + 26, py + 20, 13, 6, h * 30, 0, 7); c.fill(); }
      return;
    }
    if (g === 'g') {
      R(px, py, TS, TS, '#2E4A2C');
      for (let i = 0; i < 9; i++) R(px + Math.floor(hash(x + i * 3, y + 1) * (TS - 2)), py + Math.floor(hash(x + 2, y + i * 7) * (TS - 4)), 1.5, 3.5, hash(x + i, y - i) > .5 ? '#3F6A3A' : '#24391F');
      [[0, -1, 0, 0, TS, 2], [0, 1, 0, TS - 2, TS, 2], [-1, 0, 0, 0, 2, TS], [1, 0, TS - 2, 0, 2, TS]].forEach(([dx, dy, a, b, w, hh]) => { const n = groundOf(x + dx, y + dy); if (n !== 'g' && n !== 'p') R(px + a, py + b, w, hh, '#22331F'); });
      return;
    }
    if (g === 'p') {
      R(px, py, TS, TS, '#8A7650');
      for (let i = 0; i < 16; i++) R(px + Math.floor(hash(x + i * 5, y + 3) * TS), py + Math.floor(hash(x + 1, y + i * 9) * TS), 1, 1, hash(x - i, y + i) > .5 ? '#A08A60' : '#6E5C3C');
      [[0, -1, 0, 0, TS, 4], [0, 1, 0, TS - 4, TS, 4], [-1, 0, 0, 0, 4, TS], [1, 0, TS - 4, 0, 4, TS]].forEach(([dx, dy, a, b, w, hh]) => { if (groundOf(x + dx, y + dy) !== 'p') { R(px + a, py + b, w, hh, '#5E4A30'); } });
      if (h < .2) { c.strokeStyle = '#6E5C3C'; c.lineWidth = 1; c.beginPath(); c.arc(px + 26, py + 26, 8, 0, 7); c.stroke(); }   // a footprint circle of somebody's spin
    }
  }
  function shade(c, x, y, px, py) {
    if (TALL.includes(tile(x, y)) || tile(x, y) === 'F') return;
    const up = TALL.includes(tile(x, y - 1)), lf = TALL.includes(tile(x - 1, y)), dg = TALL.includes(tile(x - 1, y - 1));
    if (up) { const g = c.createLinearGradient(0, py, 0, py + 18); g.addColorStop(0, 'rgba(0,0,0,.42)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(px, py, TS, 18); }
    if (lf) { const g = c.createLinearGradient(px, 0, px + 12, 0); g.addColorStop(0, 'rgba(0,0,0,.36)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(px, py, 12, TS); }
    if (dg && !up && !lf) { const g = c.createRadialGradient(px, py, 0, px, py, 16); g.addColorStop(0, 'rgba(0,0,0,.36)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(px, py, 16, 16); }
  }
  function car(c, cx0, cy0, col) {
    const R = (a, b, w, hh, k) => { c.fillStyle = k; c.fillRect(a, b, w, hh); };
    c.save(); c.translate(cx0, cy0); R(-40, -15, 88, 40, 'rgba(0,0,0,.38)');
    c.fillStyle = '#16161A'; c.beginPath(); c.roundRect(-44, -20, 88, 40, 10); c.fill(); c.fillStyle = col[0]; c.beginPath(); c.roundRect(-42.5, -18.5, 85, 37, 9); c.fill();
    c.fillStyle = col[1]; c.beginPath(); c.roundRect(-14, -15, 34, 30, 5); c.fill();
    c.fillStyle = '#1F2B3A'; c.beginPath(); c.moveTo(-24, -15); c.lineTo(-14, -13); c.lineTo(-14, 13); c.lineTo(-24, 15); c.fill(); c.beginPath(); c.moveTo(27, -15); c.lineTo(20, -13); c.lineTo(20, 13); c.lineTo(27, 15); c.fill();
    R(-12, -17, 30, 2.4, '#1F2B3A'); R(-12, 14.6, 30, 2.4, '#1F2B3A'); R(-42, -15, 3, 8, '#E9E2B8'); R(-42, 7, 3, 8, '#E9E2B8'); R(39.5, -15, 3, 7, '#C8102E'); R(39.5, 8, 3, 7, '#C8102E'); R(-19, -22, 4, 3, '#16161A'); R(-19, 19, 4, 3, '#16161A');
    c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-32, -15); c.lineTo(-32, 15); c.stroke(); R(-8, -10, 20, 2, 'rgba(255,255,255,.18)'); c.fillStyle = 'rgba(255,255,255,.1)'; c.fillRect(-30, -17, 14, 3);
    c.restore();
  }
  const CARS = [['#8E2B2B', '#A83A36'], ['#2B5C8E', '#3A70A8'], ['#B9B4A8', '#D2CDC0'], ['#2E2E34', '#3D3D45'], ['#3D6B4A', '#4C8059'], ['#C77B1E', '#DB9030']];
  const TAGS = [[[0, 14], [6, 0], [12, 14], [18, 2], [24, 14]], [[0, 2], [0, 14], [10, 14]], [[0, 2], [12, 2], [0, 14], [14, 14]], [[0, 14], [0, 2], [12, 8], [0, 10]], [[12, 2], [0, 4], [12, 12], [0, 14]], [[0, 2], [6, 14], [12, 2]]];
  const SPRAY = ['#E2611A', '#3BD16F', '#58B7FF', '#FF4F9A', '#F2CC55', '#B58CFF'];
  function tag(c, x, y, seed, sc, lw) {
    c.save(); c.translate(x, y); c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round';
    for (let i = 0; i < 3; i++) { const k = Math.floor(hash(seed * 13 + i * 7, seed + i * 31) * 6), pts = TAGS[k]; c.strokeStyle = SPRAY[Math.floor(hash(seed + i * 5, seed * 7 + i) * 6)]; c.beginPath(); pts.forEach((p, j) => j ? c.lineTo(i * 17 + p[0], p[1] * sc) : c.moveTo(i * 17 + p[0], p[1] * sc)); c.stroke(); }
    c.restore();
  }
  function thing(c, x, y, px, py) {
    const t = tile(x, y), h = hash(x, y), s = TS, R = (a, b, w, hh, col) => { c.fillStyle = col; c.fillRect(a, b, w, hh); }, E = (a, b, rx, ry, col) => { c.fillStyle = col; c.beginPath(); c.ellipse(a, b, rx, ry, 0, 0, 7); c.fill(); };
    if (t === '#' || t === 'b' || t === 'D') {
      const me = roofOf(t), P = me === '#' ? ['#4B4744', '#6B655E', '#2A2725', '#3F3B38'] : ['#434853', '#626876', '#23262D', '#383C46'];
      R(px, py, s, s, P[0]);
      for (let i = 0; i < 7; i++) R(px + Math.floor(hash(x + i, y * 5) * (s - 10)), py + Math.floor(hash(x * 5, y + i) * s), 3 + hash(x - i, y) * 8, 1, 'rgba(0,0,0,.14)');
      if (x % 3 === 0) R(px, py, 1, s, 'rgba(0,0,0,.22)');
      if (h > .8) R(px + 8, py + 12, 26, 18, 'rgba(0,0,0,.08)');
      const diff = (dx, dy) => roofOf(tile(x + dx, y + dy)) !== me;
      if (diff(0, -1)) { R(px, py, s, 6, P[1]); R(px, py, s, 1.5, P[2]); }
      if (diff(0, 1)) { R(px, py + s - 6, s, 6, P[1]); R(px, py + s - 1.5, s, 1.5, P[2]); }
      if (diff(-1, 0)) { R(px, py, 6, s, P[1]); R(px, py, 1.5, s, P[2]); }
      if (diff(1, 0)) { R(px + s - 6, py, 6, s, P[1]); R(px + s - 1.5, py, 1.5, s, P[2]); }
      if (inner(x, y)) {
        const k = hash(x + 50, y + 9);
        if (k < .14) { R(px + 17, py + 19, 20, 17, 'rgba(0,0,0,.35)'); R(px + 14, py + 15, 20, 17, '#8A8884'); R(px + 16, py + 17, 16, 13, '#5E5C59'); for (let i = 0; i < 4; i++) R(px + 17, py + 18.5 + i * 3, 14, 1.2, '#2B2A29'); }
        else if (k < .2) { R(px + 15, py + 15, 22, 22, P[2]); R(px + 17, py + 17, 18, 18, '#7A766F'); R(px + 24, py + 24, 4, 4, '#2B2A29'); }
        else if (k < .26) { c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(px + 24, py + 36); c.lineTo(px + 40, py + 44); c.stroke(); c.strokeStyle = '#B9B6AE'; c.beginPath(); c.moveTo(px + 24, py + 10); c.lineTo(px + 24, py + 36); c.moveTo(px + 15, py + 16); c.lineTo(px + 33, py + 16); c.moveTo(px + 17, py + 23); c.lineTo(px + 31, py + 23); c.stroke(); }
        else if (k < .34) { c.strokeStyle = P[3]; c.lineWidth = 4; c.beginPath(); c.moveTo(px, py + 20); c.lineTo(px + 34, py + 20); c.lineTo(px + 34, py + s); c.stroke(); c.strokeStyle = 'rgba(255,255,255,.08)'; c.lineWidth = 1; c.beginPath(); c.moveTo(px, py + 19); c.lineTo(px + 35, py + 19); c.stroke(); }
        else if (k < .42) { R(px + 12, py + 14, 28, 22, P[2]); R(px + 14, py + 16, 24, 18, '#2E3A4A'); R(px + 25.5, py + 16, 1.5, 18, P[2]); R(px + 15, py + 17, 8, 3, 'rgba(255,255,255,.14)'); }
      }
      if (t === 'D') { R(px + 9, py + s - 10, s - 14, 26, 'rgba(0,0,0,.35)'); R(px + 6, py + s - 14, s - 12, 26, '#B44812'); R(px + 6, py + s - 14, s - 12, 22, OR); for (let i = 0; i < 4; i++) R(px + 10 + i * 10, py + s - 14, 4, 22, 'rgba(255,255,255,.16)'); R(px + 15, py + s + 14, 22, 9, '#3A2E28'); R(px + 17, py + s + 16, 18, 5, '#4A3B33'); }
      return;
    }
    if (t === 'G') {
      let x0 = x; while (tile(x0 - 1, y) === 'G') x0--; let y0 = y; while (tile(x, y0 - 1) === 'G') y0--;
      const unit = Math.floor((x - x0) / 2), col = ['#5C5F69', '#666058', '#59616A', '#6A5F5F'][Math.floor(hash(unit + x0, y0) * 4)];
      R(px, py, s, s, col); for (let i = 0; i < 9; i++) R(px + i * 6, py, 3, s, 'rgba(0,0,0,.16)');
      if ((x - x0) % 2 === 0) R(px, py, 2.5, s, '#26262A');
      if (h < .45) E(px + 14 + h * 50, py + 16 + hash(y, x) * 22, 6 + h * 8, 4 + h * 5, 'rgba(140,74,40,.5)');
      if (tile(x, y - 1) !== 'G') R(px, py, s, 3, '#26262A');
      if (tile(x - 1, y) !== 'G') R(px, py, 3, s, '#26262A');
      if (tile(x + 1, y) !== 'G') R(px + s - 3, py, 3, s, '#26262A');
      if (tile(x, y + 1) !== 'G') { R(px, py + s - 9, s, 9, '#3F4047'); R(px, py + s - 1.5, s, 1.5, '#1C1C1F'); if ((x - x0) % 2 === 1) { tag(c, px - s + 26, py + s - 26, unit * 7 + x0, 1.1, 3.2); R(px - 3, py + s - 7, 6, 5, '#C9B458'); } }
      return;
    }
    if (t === 'F') {
      const hz = tile(x - 1, y) === 'F' || tile(x + 1, y) === 'F', vt = tile(x, y - 1) === 'F' || tile(x, y + 1) === 'F';
      const edgeIn = (dx, dy) => { const n = tile(x + dx, y + dy); return n !== 'F' && !(x + dx < 0 || y + dy < 0 || x + dx >= MW || y + dy >= MH); };
      // the slab runs along the side that faces the yard
      if (edgeIn(0, 1)) { R(px, py + s - 12, s, 12, '#55565E'); R(px, py + s - 12, s, 2, '#73747C'); R(px, py + s - 1.5, s, 1.5, '#1C1C1F'); R(px + s - 5, py + s - 13, 5, 13, '#3E3F46'); if (h < .22) tag(c, px + 4, py + s - 10, x * 3 + y, .5, 2.2); }
      if (edgeIn(0, -1)) { R(px, py, s, 12, '#55565E'); R(px, py + 10, s, 2, '#3A3B41'); R(px + s - 5, py, 5, 13, '#3E3F46'); }
      if (edgeIn(1, 0)) { R(px + s - 12, py, 12, s, '#55565E'); R(px + s - 12, py, 2, s, '#73747C'); R(px + s - 13, py + s - 5, 13, 5, '#3E3F46'); }
      if (edgeIn(-1, 0)) { R(px, py, 12, s, '#55565E'); R(px + 10, py, 2, s, '#3A3B41'); R(px, py + s - 5, 13, 5, '#3E3F46'); }
      void hz; void vt; return;
    }
    if (t === 'X') {
      R(px + 6, py - 4, 12, 10, '#3E3F46'); R(px + 6, py + s - 6, 12, 10, '#3E3F46');
      R(px + 12, py + 4, 9, s - 8, 'rgba(0,0,0,.35)'); for (let i = 0; i < 6; i++) R(px + 8, py + 4 + i * 7.4, 8, 7.4, i % 2 ? WH : OR); c.strokeStyle = INK; c.lineWidth = 1; c.strokeRect(px + 8.5, py + 4.5, 8, s - 9);
      c.fillStyle = 'rgba(242,239,232,.5)'; c.beginPath(); c.moveTo(px + 24, py + 21); c.lineTo(px + 38, py + 21); c.lineTo(px + 38, py + 15); c.lineTo(px + 48, py + 26); c.lineTo(px + 38, py + 37); c.lineTo(px + 38, py + 31); c.lineTo(px + 24, py + 31); c.fill();
      return;
    }
    if (t === 'T') {
      R(px + 8, py + 13, 42, 32, 'rgba(0,0,0,.4)'); R(px + 4, py + 8, 44, 34, '#1D3A2A'); R(px + 6, py + 10, 40, 30, h > .5 ? '#2F6B45' : '#2A5F6B'); R(px + 6, py + 24, 40, 2, '#1D3A2A'); R(px + 12, py + 13, 12, 3, 'rgba(255,255,255,.18)'); R(px + 3, py + 14, 3, 8, '#16161A'); R(px + 46, py + 14, 3, 8, '#16161A');
      if (tile(x - 1, y) !== 'T') { c.save(); c.translate(px + 2, py + 46); c.rotate(-.2); R(-4, -6, 22, 14, '#8A6A40'); R(-3, -5, 20, 12, '#A47E4C'); R(-3, 0, 20, 1.2, '#7A5A34'); c.restore(); } else { R(px + 30, py + 27, 12, 9, '#9A7444'); R(px + 32, py + 25, 10, 3, '#B58A52'); }
      return;
    }
    if (t === 'K') {
      if (tile(x - 1, y) === 'K' || tile(x, y - 1) === 'K') return;
      const w = s * 2, hh = s * 2; R(px + 7, py + 9, w, hh, 'rgba(0,0,0,.4)'); R(px, py, w, hh, '#2B241B'); R(px + 2, py + 2, w - 4, hh - 4, '#6B5338'); R(px + 6, py + 6, w - 12, hh - 30, '#7A6042');
      for (let i = 0; i < 6; i++) R(px + 8 + i * 15, py + 8, 1, hh - 34, 'rgba(0,0,0,.14)');
      R(px + 60, py + 14, 22, 17, 'rgba(0,0,0,.3)'); R(px + 58, py + 12, 22, 17, '#8A8884'); R(px + 60, py + 14, 18, 13, '#4E4C49'); for (let i = 0; i < 4; i++) R(px + 61, py + 15.5 + i * 3, 16, 1.2, '#2B2A29');
      R(px + 12, py + 12, 36, 24, '#16161A'); R(px + 14, py + 14, 32, 20, '#D9892B'); c.fillStyle = '#F2E2B8'; c.beginPath(); c.moveTo(px + 20, py + 18); c.lineTo(px + 40, py + 24); c.lineTo(px + 23, py + 31); c.fill(); R(px + 25, py + 21, 8, 2.4, '#3BD16F'); R(px + 26, py + 25, 7, 2, '#C8102E');
      for (let i = 0; i < 8; i++) R(px + i * 13, py + hh - 20, 13, 20, i % 2 ? WH : OR); R(px, py + hh - 2, w, 2, 'rgba(0,0,0,.35)'); R(px, py + hh - 20, w, 1.5, 'rgba(0,0,0,.3)');
      return;
    }
    if (t === 'S') {
      if (tile(x - 1, y) === 'S' || tile(x, y - 1) === 'S') return;
      const mx = px + s, my = py + s, r = s - 3; E(mx + 6, my + 8, r, r, 'rgba(0,0,0,.38)');
      for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#2A6FA8' : WH; c.beginPath(); c.moveTo(mx, my); const a = i * Math.PI / 4 + Math.PI / 8, b = a + Math.PI / 4; c.lineTo(mx + Math.cos(a) * r, my + Math.sin(a) * r); c.quadraticCurveTo(mx + Math.cos((a + b) / 2) * r * .9, my + Math.sin((a + b) / 2) * r * .9, mx + Math.cos(b) * r, my + Math.sin(b) * r); c.fill(); }
      c.strokeStyle = 'rgba(0,0,0,.28)'; c.lineWidth = 1; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + Math.PI / 8; c.beginPath(); c.moveTo(mx, my); c.lineTo(mx + Math.cos(a) * r, my + Math.sin(a) * r); c.stroke(); }
      const g = c.createRadialGradient(mx - 8, my - 10, 2, mx, my, r); g.addColorStop(0, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(0,0,0,.2)'); c.fillStyle = g; c.beginPath(); c.arc(mx, my, r, 0, 7); c.fill(); E(mx, my, 4, 4, '#16161A'); E(mx, my, 2.4, 2.4, OR);
      // a little table with goods peeks out on the south side
      R(px + 18, py + s * 2 - 8, 68, 12, '#16161A'); R(px + 20, py + s * 2 - 6, 64, 8, '#7A6042'); [['#E2611A', 0], [WH, 13], ['#2B2B31', 26], ['#C8102E', 39], ['#3BD16F', 52]].forEach(([col, o]) => R(px + 23 + o, py + s * 2 - 5, 9, 6, col));
      return;
    }
    if (t === 't') { E(px + 31, py + 32, 9, 7, 'rgba(0,0,0,.35)'); E(px + 26, py + 26, 6, 6, '#3A2A1E'); E(px + 25, py + 25, 3.5, 3.5, '#5A4230'); return; }
    if (t === '*') { c.strokeStyle = 'rgba(242,239,232,.55)'; c.lineWidth = 2; c.setLineDash([6, 5]); c.beginPath(); c.arc(px + 26, py + 26, 21, 0, 7); c.stroke(); c.setLineDash([]); c.strokeStyle = 'rgba(242,239,232,.3)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(px + 21, py + 21); c.lineTo(px + 31, py + 31); c.moveTo(px + 31, py + 21); c.lineTo(px + 21, py + 31); c.stroke(); return; }
    if (t === 'C') { if (tile(x - 1, y) === 'C') return; car(c, px + s, py + s / 2 + 1, CARS[Math.floor(h * 6)]); return; }
    if (t === 'L') { c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 3; c.beginPath(); c.moveTo(px + 28, py + 28); c.lineTo(px + 46, py + 38); c.stroke(); E(px + 26, py + 26, 5, 5, '#1C1C1F'); E(px + 26, py + 26, 2.4, 2.4, '#55565C'); c.strokeStyle = '#7A7C84'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(px + 26, py + 26); c.lineTo(px + 12, py + 35); c.stroke(); E(px + 11, py + 36, 5.4, 3.8, '#16161A'); E(px + 11, py + 36, 4.4, 2.8, '#C9CCD2'); return; }
    if (t === 'B') { R(px + 20, py + 9, 18, 40, 'rgba(0,0,0,.32)'); for (let i = 0; i < 4; i++) R(px + 16 + i * 4.5, py + 6, 4, 40, i % 2 ? '#6E4A2C' : '#8A5E38'); R(px + 15, py + 6, 20, 2.5, '#2B2B2F'); R(px + 15, py + 43.5, 20, 2.5, '#2B2B2F'); E(px + 43, py + 12, 5.5, 5.5, '#2B2B2F'); E(px + 43, py + 12, 3.8, 3.8, '#55565C'); E(px + 43, py + 12, 2.2, 2.2, '#1C1C1F'); }
  }
  function chunk(cx0, cy0) {
    const k = cx0 + ',' + cy0; let e = chunks.get(k);
    if (e) { e.use = ++use; return e.can; }
    const [can, c] = mk(CH * TS, CH * TS); c.translate(-cx0 * CH * TS, -cy0 * CH * TS);
    const x0 = cx0 * CH - 2, y0 = cy0 * CH - 2, x1 = cx0 * CH + CH + 1, y1 = cy0 * CH + CH + 1;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && y >= 0 && x < MW && y < MH) ground(c, x, y, x * TS, y * TS);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && y >= 0 && x < MW && y < MH) shade(c, x, y, x * TS, y * TS);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && y >= 0 && x < MW && y < MH) thing(c, x, y, x * TS, y * TS);
    chunks.set(k, { can, use: ++use });
    if (chunks.size > KEEP) { let old = null, ou = 1e18; chunks.forEach((v, kk) => { if (v.use < ou) { ou = v.use; old = kk; } }); const o = chunks.get(old); o.can.width = o.can.height = 0; chunks.delete(old); }   // free the graphics memory (iPhone)
    return can;
  }
  // the map on the screen: only copying
  function drawMap(c, ox, oy, W, H) {
    const s = CH * TS, a0 = Math.max(0, Math.floor(-ox / s)), a1 = Math.min(Math.ceil(MW / CH) - 1, Math.floor((W - ox) / s)), b0 = Math.max(0, Math.floor(-oy / s)), b1 = Math.min(Math.ceil(MH / CH) - 1, Math.floor((H - oy) / s));
    for (let b = b0; b <= b1; b++) for (let a = a0; a <= a1; a++) c.drawImage(chunk(a, b), ox + a * s, oy + b * s, s, s);
  }
  function crate(c, px, py) { const R = (a, b, w, h, col) => { c.fillStyle = col; c.fillRect(a, b, w, h); }; R(px + 14, py + 16, 30, 26, 'rgba(0,0,0,.4)'); R(px + 10, py + 11, 30, 26, '#3A2A16'); R(px + 12, py + 13, 26, 22, '#8A6A40'); R(px + 12, py + 23, 26, 2, '#5E4424'); R(px + 24, py + 13, 2, 22, '#5E4424'); R(px + 14, py + 15, 8, 2, 'rgba(255,255,255,.2)'); }
  function crown(c, px, py, x, y) {
    const k = 'tree' + (Math.floor(hash(x, y) * 3)); let sp = sprites.get(k);
    if (!sp) { const [can, q] = mk(96, 96), v = +k.slice(4), E = (a, b, rx, ry, col) => { q.fillStyle = col; q.beginPath(); q.ellipse(a, b, rx, ry, 0, 0, 7); q.fill(); };
      E(54, 56, 34, 30, 'rgba(0,0,0,.3)'); E(48, 48, 33, 29, '#1E4628'); E(48, 48, 31, 27, '#234F2D'); E(42 + v * 3, 42, 22, 19, '#2F7A44'); E(58 - v * 4, 56, 14, 12, '#2A6A3C'); E(36 + v * 2, 36, 10, 8, '#3C9455');
      for (let i = 0; i < 18; i++) E(24 + hash(i, v + 61) * 48, 24 + hash(i, v + 62) * 48, 3, 2.4, hash(i, v + 63) > .5 ? '#3C9455' : '#1E4628'); sp = can; sprites.set(k, sp); }
    c.drawImage(sp, px + TS / 2 - 48, py + TS / 2 - 48, 96, 96);
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

  // ================= signs instead of emoji =================
  function sign(c, x, y, type, dim) {
    const col = dim ? '#6C6F78' : WH, ac = dim ? '#6C6F78' : OR;
    c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.arc(x + 1.5, y + 2.5, 13, 0, 7); c.fill();
    c.fillStyle = '#151517'; c.beginPath(); c.arc(x, y, 13, 0, 7); c.fill(); c.strokeStyle = ac; c.lineWidth = 1.6; c.beginPath(); c.arc(x, y, 12.2, 0, 7); c.stroke();
    c.fillStyle = col; c.strokeStyle = col; c.lineWidth = 1.6; c.lineJoin = 'round'; c.lineCap = 'round';
    if (type === 'home') { c.beginPath(); c.moveTo(x - 7, y); c.lineTo(x, y - 7); c.lineTo(x + 7, y); c.lineTo(x + 5, y); c.lineTo(x + 5, y + 6); c.lineTo(x - 5, y + 6); c.lineTo(x - 5, y); c.fill(); c.fillStyle = ac; c.fillRect(x - 1.6, y + 1, 3.2, 5); }
    else if (type === 'trash') { c.fillStyle = '#A47E4C'; c.fillRect(x - 6, y - 3, 12, 9); c.fillStyle = col; c.beginPath(); c.moveTo(x - 6, y - 3); c.lineTo(x - 9, y - 7); c.lineTo(x - 2, y - 6); c.lineTo(x, y - 3); c.lineTo(x + 2, y - 6); c.lineTo(x + 9, y - 7); c.lineTo(x + 6, y - 3); c.fill(); c.fillStyle = '#7A5A34'; c.fillRect(x - 1, y - 3, 2, 9); }
    else if (type === 'kiosk') { c.fillStyle = '#F2E2B8'; c.beginPath(); c.moveTo(x - 6, y - 6); c.lineTo(x + 7, y - 3); c.lineTo(x - 2, y + 8); c.fill(); c.fillStyle = '#3BD16F'; c.fillRect(x - 3, y - 4, 7, 2); c.fillStyle = '#C8102E'; c.fillRect(x - 3, y - 1, 5, 2); }
    else if (type === 'shop') { c.fillRect(x - 6, y - 2, 12, 9); c.beginPath(); c.arc(x, y - 2, 3.6, Math.PI, 0); c.stroke(); c.fillStyle = ac; c.fillRect(x - 6, y + 1, 12, 2); }
    else if (type === 'show') { c.beginPath(); c.ellipse(x, y - 3, 8, 2.6, 0, 0, 7); c.fill(); c.beginPath(); c.moveTo(x - 5, y - 2.4); c.lineTo(x - 4, y + 6); c.lineTo(x + 4, y + 6); c.lineTo(x + 5, y - 2.4); c.fill(); c.fillStyle = '#C9B458'; c.beginPath(); c.arc(x - 1, y - 7.4, 1.8, 0, 7); c.arc(x + 3.4, y - 8.6, 1.5, 0, 7); c.fill(); }
    else if (type === 'gate') { c.beginPath(); c.moveTo(x - 7, y - 2); c.lineTo(x + 1, y - 2); c.lineTo(x + 1, y - 6); c.lineTo(x + 8, y); c.lineTo(x + 1, y + 6); c.lineTo(x + 1, y + 2); c.lineTo(x - 7, y + 2); c.fill(); }
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
    const out = [];
    lightsStatic.forEach(l => {
      if (l.kiosk && !kioskOpen) return;
      if ((l.win || l.sky) && hash(l.sx * 3 + day, l.sy * 7) > (l.win ? .45 : .6)) return;
      const px = ox + l.x * TS, py = oy + l.y * TS, r = l.r * TS; if (px < -r || py < -r || px > W + r || py > H + r) return;
      out.push({ px, py, r, a: l.a, lamp: !l.win && !l.sky && !l.kiosk && l.r > 2, sky: l.sky, sx: l.sx, sy: l.sy });
    });
    return out;
  }
  // bright things that glow through the dark (lamp heads, skylights, the kiosk sign)
  function glow(c, ox, oy, lights, ng) {
    if (ng <= .05) return; const a = Math.min(1, ng / .4);
    lights.forEach(l => {
      if (l.lamp) { c.fillStyle = 'rgba(255,246,200,' + a + ')'; c.beginPath(); c.ellipse(l.px - .01 * TS, l.py + .01 * TS, 4.4, 2.8, 0, 0, 7); c.fill(); }
      if (l.sky) { c.fillStyle = 'rgba(242,204,85,' + (.85 * a) + ')'; c.fillRect(ox + l.sx * TS + 14, oy + l.sy * TS + 16, 11.5, 18); c.fillRect(ox + l.sx * TS + 27, oy + l.sy * TS + 16, 11, 18); }
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

  window.CITY_GFX = { TS, setMap, drawMap, crate, crown, person, aura, bird, sign, night, lightsNow, glow, fog, trees: () => trees, _chunks: () => chunks.size, _sprites: () => sprites.size };
})();
