// «Город» — мини-игра с видом сверху (owner 13.11.2026). Движок: карта из клеток, камера, туман, путь по тапу, часы, места,
// би-бои. Данные — city-data.js, цифры — city-balance.js. Батлы и шоу идут через rhythm.js (RB.open({ city, onCity })) — без сервера.
// Сохранение — на телефоне (`fedoskin-city`, версия CITY_BAL.save). На уровень героя и общий рейтинг город не влияет.
(function () {
  'use strict';
  const B = window.CITY_BAL, DATA = window.CITY_DATA, KEY = 'fedoskin-city';
  const BLOCK = 'F#bGTKSXctD', TS = 44, SPEED = 5.5, SEE = 4.6;
  let D, S, el, can, cx, hud, dlgEl, W = 0, H = 0, dpr = 1, shown = false, timer = 0, raf = 0, last = 0, path = [], goal = null, pend = null;
  let padB = 0, MAP, MW, MH, DIST, hero = { x: 0, y: 0 }, cam = { x: 0, y: 0 }, hudKey = '';
  const T = (s, v) => D.T(s, v);
  const $ = q => el.querySelector(q);
  const cl = (x, a, b) => Math.max(a, Math.min(b, x));
  const esc = x => String(x == null ? '' : x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

  // ---- save ----
  function fresh() {
    const d = DATA.districts.yard;
    return { v: B.save, d: 'yard', x: d.start[0], y: d.start[1], t: B.startHour * 60, en: B.energy.max, cash: B.start.cash, rep: B.start.rep, card: 0, own: [], inv: {},
      bruise: 0, fog: {}, npc: {}, spot: {}, got: {}, marks: [], day: {}, intro: 0 };
  }
  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.v === B.save && DATA.districts[s.d]) return s; } catch (_) {}
    return fresh();
  }
  const save = () => { try { S.x = Math.round(hero.x); S.y = Math.round(hero.y); localStorage.setItem(KEY, JSON.stringify(S)); } catch (_) {} };

  // ---- time ----
  const hour = () => Math.floor(S.t / 60) % 24, dayN = () => Math.floor(S.t / 1440);
  const inH = (h, r) => !r || (r[0] <= r[1] ? h >= r[0] && h < r[1] : h >= r[0] || h < r[1]);
  const clock = () => { const m = Math.floor(S.t) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
  const night = () => { const h = (S.t / 60) % 24; return h >= 22 || h < 5 ? .55 : h >= 19 ? .55 * (h - 19) / 3 : h < 7 ? .55 * (7 - h) / 2 : 0; };
  const daily = k => S.day[k] === dayN();           // already done this game day?
  const mark = k => { S.day[k] = dayN(); };

  // ---- map ----
  function setMap() {
    DIST = DATA.districts[S.d]; MAP = DIST.map; MH = MAP.length; MW = MAP[0].length;
    if (!S.fog[S.d] || S.fog[S.d].length !== MW * MH) S.fog[S.d] = '0'.repeat(MW * MH);
    hero.x = S.x; hero.y = S.y; cam.x = hero.x; cam.y = hero.y; path = []; reveal();
  }
  const tile = (x, y) => x < 0 || y < 0 || x >= MW || y >= MH ? 'F' : MAP[y][x];
  const walk = (x, y) => !BLOCK.includes(tile(x, y));
  const seen = (x, y) => S.fog[S.d][y * MW + x] === '1';
  function reveal() {
    const f = S.fog[S.d].split(''), hx = Math.round(hero.x), hy = Math.round(hero.y); let ch = false;
    for (let y = hy - 5; y <= hy + 5; y++) for (let x = hx - 5; x <= hx + 5; x++) {
      if (x < 0 || y < 0 || x >= MW || y >= MH) continue;
      if (Math.hypot(x - hero.x, y - hero.y) <= SEE && f[y * MW + x] !== '1') { f[y * MW + x] = '1'; ch = true; }
    }
    if (ch) S.fog[S.d] = f.join('');
  }
  const npcsNow = () => DIST.npcs.filter(n => inH(hour(), n.hours));
  const placeAt = (x, y) => DIST.places.find(p => { const c = tile(p.at[0], p.at[1]); return p.at[0] === x && p.at[1] === y || (c === tile(x, y) && 'TKS'.includes(c) && Math.abs(p.at[0] - x) <= 1 && Math.abs(p.at[1] - y) <= 1); });
  // shortest way (4 directions) from the hero to any of the goal cells
  function route(goals) {
    const sx = Math.round(hero.x), sy = Math.round(hero.y), key = (x, y) => y * MW + x, want = new Set(goals.map(g => key(g[0], g[1])));
    if (want.has(key(sx, sy))) return [];
    const prev = new Map([[key(sx, sy), -1]]), q = [[sx, sy]];
    for (let i = 0; i < q.length; i++) {
      const [x, y] = q[i];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = key(nx, ny);
        if (prev.has(k) || !walk(nx, ny)) continue;
        prev.set(k, key(x, y));
        if (want.has(k)) { const out = []; let c = k; while (c !== key(sx, sy)) { out.unshift([c % MW, Math.floor(c / MW)]); c = prev.get(c); } return out; }
        q.push([nx, ny]);
      }
    }
    return null;
  }
  const around = (x, y) => [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].filter(c => walk(c[0], c[1]));

  // ---- drawing (everything is drawn by code) ----
  function size() {
    const r = can.getBoundingClientRect(); dpr = Math.min(2, window.devicePixelRatio || 1); W = r.width; H = r.height;
    can.width = Math.round(W * dpr); can.height = Math.round(H * dpr);
  }
  const R = (x, y, w, h, c) => { cx.fillStyle = c; cx.fillRect(x, y, w, h); };
  function drawTile(c, x, y, px, py, ng) {
    const s = TS, h = hash(x, y);
    const ground = c === 'g' || c === 't' ? '#1E3A27' : c === 'p' ? '#6E5C3C' : c === '=' ? '#37373E' : c === 'r' ? '#1A1A1E' : '#28282D';
    R(px, py, s + 1, s + 1, ground);
    if (c === '.' || c === '*' || c === 'c') { if (h < .16) R(px + h * 200 % s, py + h * 911 % s, 3, 2, '#32323A'); if (h > .93) R(px + 8, py + 14, 14, 2, '#1F1F23'); }
    if (c === 'g' && h < .3) R(px + h * 120 % s, py + h * 613 % s, 2, 5, '#2C5A38');
    if (c === '=') { cx.strokeStyle = '#2B2B31'; cx.lineWidth = 1; cx.strokeRect(px + .5, py + .5, s, s); }
    if (c === 'r' && y === 21) for (let k = 0; k < 2; k++) R(px + 4 + k * 22, py + s - 2, 12, 3, '#C9B458');
    if (c === '#' || c === 'b') {
      R(px, py, s + 1, s + 1, c === '#' ? '#4A3B33' : '#353946'); R(px + 3, py + 3, s - 5, s - 5, c === '#' ? '#56453B' : '#3E4352');
      const lit = ng > .2 && hash(x * 3, y * 7 + dayN()) < .45; R(px + 10, py + 10, 10, 12, lit ? '#F2CC55' : '#22252E'); R(px + 26, py + 10, 10, 12, ng > .2 && h < .3 ? '#F2CC55' : '#22252E');
    }
    if (c === 'D') { R(px, py, s + 1, s + 1, '#4A3B33'); R(px + 9, py + 6, s - 18, s - 6, '#E2611A'); R(px + 13, py + 10, s - 26, 12, '#F2CC55'); R(px + s - 16, py + 26, 3, 3, '#0B0B0C'); }
    if (c === 'G') { R(px, py, s + 1, s + 1, '#4B4B54'); if (y === 18) { R(px + 5, py + 8, s - 9, s - 8, '#3A3A42'); for (let k = 0; k < 4; k++) R(px + 5, py + 12 + k * 8, s - 9, 1, '#2A2A30'); } else R(px + 2, py + 2, s - 3, s - 3, '#56565F'); }
    if (c === 'F') { R(px, py, s + 1, s + 1, '#131316'); R(px + 4, py + s / 2 - 2, s - 8, 4, '#24242A'); R(px + s / 2 - 2, py + 6, 4, s - 12, '#24242A'); }
    if (c === 't') { cx.fillStyle = '#17301F'; cx.beginPath(); cx.arc(px + s / 2 + 3, py + s / 2 + 4, 17, 0, 7); cx.fill(); cx.fillStyle = '#2F7A44'; cx.beginPath(); cx.arc(px + s / 2, py + s / 2, 17, 0, 7); cx.fill(); cx.fillStyle = '#3C9455'; cx.beginPath(); cx.arc(px + s / 2 - 5, py + s / 2 - 5, 8, 0, 7); cx.fill(); }
    if (c === 'T') { R(px + 6, py + 10, s - 12, s - 14, '#2F6B45'); R(px + 4, py + 7, s - 8, 6, '#3C8A58'); R(px + 12, py + 20, s - 24, 3, '#1E4630'); }
    if (c === 'K') { R(px, py, s + 1, s + 1, '#5A4630'); if (y === 13) { for (let k = 0; k < 4; k++) R(px + k * 11, py + s - 14, 11, 14, k % 2 ? '#F2EFE8' : '#E2611A'); } else R(px + 3, py + 3, s - 5, s - 5, '#6B5338'); }
    if (c === 'S') { for (let k = 0; k < 4; k++) R(px + k * 11, py, 12, s + 1, k % 2 ? '#2A6FA8' : '#F2EFE8'); if (y === 15) R(px, py + s - 8, s + 1, 8, '#1B4A72'); }
    if (c === 'X') { R(px, py, s + 1, s + 1, '#1A1A1E'); R(px + 4, py + 4, 6, s - 8, '#E2611A'); R(px + 4, py + 4, s - 8, 5, '#E2611A'); R(px + 4, py + s - 9, s - 8, 5, '#E2611A'); }
    if (c === '*') { cx.strokeStyle = 'rgba(242,239,232,.55)'; cx.lineWidth = 2; cx.setLineDash([5, 5]); cx.beginPath(); cx.arc(px + s / 2, py + s / 2, 16, 0, 7); cx.stroke(); cx.setLineDash([]); }
    if (c === 'c') { const p = placeAt(x, y); if (p && !S.got[p.id]) { R(px + 9, py + 12, s - 18, s - 20, '#7A5A34'); R(px + 9, py + 20, s - 18, 3, '#55401F'); R(px + s / 2 - 2, py + 12, 4, s - 20, '#55401F'); } }
  }
  function person(px, py, col, me, bob) {
    cx.fillStyle = 'rgba(0,0,0,.35)'; cx.beginPath(); cx.ellipse(px, py + 13, 12, 5, 0, 0, 7); cx.fill();
    cx.fillStyle = '#17171A'; cx.fillRect(px - 8, py + 4 + bob, 6, 9); cx.fillRect(px + 2, py + 4 - bob, 6, 9);     // legs
    cx.fillStyle = col; cx.beginPath(); cx.roundRect(px - 11, py - 9, 22, 17, 6); cx.fill();                        // jacket
    cx.fillStyle = '#E8B48A'; cx.beginPath(); cx.arc(px, py - 12, 8, 0, 7); cx.fill();                               // head
    cx.fillStyle = me ? '#0B0B0C' : '#2A2A30'; cx.beginPath(); cx.arc(px, py - 14, 8, Math.PI, 0); cx.fill(); cx.fillRect(px - 2, py - 15, 12, 3); // cap
  }
  function label(px, py, txt, col) {
    cx.font = '700 11px Inter, system-ui, sans-serif'; const w = cx.measureText(txt).width + 12;
    cx.fillStyle = 'rgba(11,11,12,.82)'; cx.beginPath(); cx.roundRect(px - w / 2, py - 9, w, 18, 9); cx.fill();
    cx.fillStyle = col || '#F2EFE8'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(txt, px, py + .5);
  }
  function draw(now) {
    if (!W) size(); if (!W) return;
    cx.setTransform(dpr, 0, 0, dpr, 0, 0); R(0, 0, W, H, '#0B0B0C');
    const vw = W / TS, vh = (H - padB) / TS;
    cam.x = cl(hero.x + .5, Math.min(vw / 2, MW / 2), Math.max(MW - vw / 2, MW / 2)); cam.y = cl(hero.y + .5, Math.min(vh / 2, MH / 2), Math.max(MH - vh / 2, MH / 2));
    const ox = Math.round(W / 2 - cam.x * TS), oy = Math.round((H - padB) / 2 - cam.y * TS), ng = night();
    const x0 = Math.max(0, Math.floor(-ox / TS)), x1 = Math.min(MW - 1, Math.ceil((W - ox) / TS)), y0 = Math.max(0, Math.floor(-oy / TS)), y1 = Math.min(MH - 1, Math.ceil((H - oy) / TS));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (seen(x, y)) drawTile(MAP[y][x], x, y, ox + x * TS, oy + y * TS, ng);
    if (path.length) { const g = path[path.length - 1]; cx.strokeStyle = '#E2611A'; cx.lineWidth = 2; cx.beginPath(); cx.arc(ox + g[0] * TS + TS / 2, oy + g[1] * TS + TS / 2, 9 + 2 * Math.sin(now / 150), 0, 7); cx.stroke(); }
    DIST.places.forEach(p => {
      if (!seen(p.at[0], p.at[1])) return; if (p.type === 'stash' && S.got[p.id]) return;
      const ic = { home: '🏠', trash: '📦', kiosk: '🌯', shop: '🛍️', show: '🎩', gate: '➡️', stash: '❔' }[p.type];
      cx.font = '18px system-ui'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(ic, ox + p.at[0] * TS + TS / 2, oy + p.at[1] * TS - 6 + 2 * Math.sin(now / 400 + p.at[0]));
    });
    npcsNow().forEach(n => {
      if (!seen(n.at[0], n.at[1])) return;
      const px = ox + n.at[0] * TS + TS / 2, py = oy + n.at[1] * TS + TS / 2;
      person(px, py, n.col, false, Math.sin(now / 260 + n.lvl) * 1.5);
      label(px, py - 40, nm(n).split(' ')[0] + ' · ' + n.lvl, n.boss ? '#F2CC55' : '#F2EFE8');
      if (!daily('b:' + n.id)) { cx.font = '900 16px Inter, sans-serif'; cx.fillStyle = '#E2611A'; cx.fillText('!', px + 15, py - 16); }
    });
    const mv = path.length ? Math.sin(now / 70) * 3 : 0;
    person(ox + hero.x * TS + TS / 2, oy + hero.y * TS + TS / 2, '#E2611A', true, mv);
    if (ng > 0) { R(0, 0, W, H, 'rgba(8,10,34,' + ng.toFixed(3) + ')'); }
    // fog: unexplored cells stay black; a soft edge on explored cells next to them
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (seen(x, y)) continue; R(ox + x * TS - 6, oy + y * TS - 6, TS + 12, TS + 12, 'rgba(11,11,12,.55)'); R(ox + x * TS, oy + y * TS, TS + 1, TS + 1, '#0B0B0C');
    }
    S.marks.forEach(id => { const p = DIST.places.find(q => q.id === id); if (!p || S.got[id]) return; label(ox + p.at[0] * TS + TS / 2, oy + p.at[1] * TS + TS / 2 - 4 * Math.abs(Math.sin(now / 300)), '📍 ' + T('Слух'), '#E2611A'); });
  }

  // ---- HUD + dialogs (DOM) ----
  const floorName = () => S.card > 0 ? T('Картон') + ' ×' + S.card : S.own.includes('lino') ? T('Линолеум') : T('Асфальт');
  const floorId = () => S.own.includes('lino') ? 'lino' : S.card > 0 ? 'card' : 'asphalt';
  function paintHud() {
    const k = [clock(), dayN(), Math.round(S.en), S.cash, S.rep, S.card, S.bruise, S.own.length].join('|'); if (k === hudKey) return; hudKey = k;
    hud.innerHTML = '<div class="cyh1"><b>' + clock() + '</b><small>' + T('День {n}', { n: dayN() + 1 }) + ' · ' + T(DIST.name) + '</small></div>' +
      '<div class="cyen" title="' + T('Энергия') + '"><i style="width:' + cl(S.en, 0, 100) + '%"></i><span>⚡ ' + Math.round(S.en) + '</span></div>' +
      '<div class="cyst"><span>💵 ' + S.cash + '</span><span>★ ' + S.rep + '</span></div>' +
      '<button type="button" class="cybag" id="cyBag" aria-label="' + T('Рюкзак') + '">🎒</button>' +
      '<div class="cyfl">' + T('Пол') + ': ' + floorName() + (S.bruise ? ' · 🤕 ' + T('Ушиб') : '') + '</div>';
    hud.querySelector('#cyBag').addEventListener('click', bag);
  }
  // buttons: [{ t: text, fn, cls, off }] — a button without fn just closes
  function dlg(title, html, btns) {
    path = []; goal = null;
    dlgEl.innerHTML = '<div class="cyd"><h3>' + esc(title) + '</h3><div class="cydb">' + html + '</div><div class="cybt">' +
      (btns || []).map((b, i) => '<button type="button" class="btn ' + (b.cls || 'btn-line') + '" data-i="' + i + '"' + (b.off ? ' disabled' : '') + '>' + b.t + '</button>').join('') +
      '<button type="button" class="btn btn-ghost" data-i="-1">' + T('Закрыть') + '</button></div></div>';
    dlgEl.hidden = false;
    dlgEl.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { const x = (btns || [])[+b.dataset.i]; dlgEl.hidden = true; if (x && x.fn) x.fn(); paintHud(); save(); }));
  }
  const p = s => '<p>' + s + '</p>';
  const say = (who, s) => '<p class="cysay"><b>' + esc(who) + ':</b> ' + esc(T(s)) + '</p>';
  const nm = n => T(n.name);   // names are translated too (the audience is mostly not Russian)
  const item = id => DATA.items[id];
  const give = id => { if (item(id).use) S.inv[id] = (S.inv[id] || 0) + 1; else if (!S.own.includes(id)) S.own.push(id); };
  const found = id => '<p class="cygot">' + item(id).ico + ' ' + T('Находка: {x}', { x: T(item(id).name) }) + '<br><small>' + T(item(id).info) + '</small></p>';

  function bag() {
    const rows = S.own.map(id => '<li>' + item(id).ico + ' <b>' + T(item(id).name) + '</b><small>' + T(item(id).info) + '</small></li>')
      .concat(Object.keys(S.inv).filter(id => S.inv[id] > 0).map(id => '<li>' + item(id).ico + ' <b>' + T(item(id).name) + ' ×' + S.inv[id] + '</b><small>' + T(item(id).info) + '</small></li>'));
    dlg(T('Рюкзак'), p(T('Пол') + ': <b>' + floorName() + '</b>' + (S.bruise ? '<br>🤕 ' + T('Ушиб: из пауэра доступен только backspin, пока не выспишься.') : '')) +
      (rows.length ? '<ul class="cyls">' + rows.join('') + '</ul>' : p(T('Пока пусто. Вещи можно купить в палатке или найти в городе.'))) +
      p('<small>' + T('Уровень героя и новые движения дают только настоящие уроки. Город даёт кэш, респект и вещи.') + '</small>'), [
      S.inv.thermos > 0 && { t: T('Выпить чай из термоса') + ' (+' + B.food.thermos + ' ⚡)', fn: () => { S.inv.thermos--; S.en = Math.min(B.energy.max, S.en + B.food.thermos); } },
      S.inv.tape > 0 && S.card > 0 && { t: T('Починить картон изолентой') + ' (+' + B.item.tapeUses + ')', fn: () => { S.inv.tape--; S.card += B.item.tapeUses; } },
      { t: T('Как играть'), fn: intro }
    ].filter(Boolean));
  }
  function intro() {
    S.intro = 1;
    dlg(T('Город'), p(T('Тапни по карте — герой пойдёт туда сам. Заходи в места, знакомься с би-боями, зарабатывай кэш и респект.')) +
      p(T('Батл стоит 20 энергии, шоу — 10. Энергию возвращают сон дома и еда.')) +
      p(T('На асфальте пауэрмув бьёт по очкам и телу — найди картон у мусорки.')) +
      p('<b>' + T('Сила — только из уроков: новые движения и уровень героя город не даёт.') + '</b>'), []);
  }

  // ---- places ----
  function openPlace(pl) {
    const h = hour(), closed = pl.open && !inH(h, pl.open);
    if (closed) return dlg(T(pl.name), p(T('Закрыто. Работает с {a}:00 до {b}:00.', { a: pl.open[0], b: pl.open[1] })), []);
    if (pl.type === 'home') {
      const late = h >= 21 || h < 6;
      return dlg(T('Дом'), p(T('Здесь можно выспаться. Игра сохраняется сама.')) + (S.bruise ? p('🤕 ' + T('Сон вылечит ушиб.')) : ''), [
        { t: late ? T('Спать до утра') : T('Спать до утра') + ' — ' + T('ещё не вечер (после 21:00)'), cls: 'btn-accent', off: !late, fn: () => { S.t = (Math.floor((S.t - 6 * 60) / 1440) + 1) * 1440 + B.startHour * 60; S.en = B.energy.max; S.bruise = 0; D.toast(T('Доброе утро! Энергия восстановлена')); } },
        { t: T('Вздремнуть часок') + ' (+' + B.energy.stretch + ' ⚡)', off: daily('nap') || S.en >= B.energy.max, fn: () => { mark('nap'); S.t += 60; S.en = Math.min(B.energy.max, S.en + B.energy.stretch); } }
      ]);
    }
    if (pl.type === 'trash') {
      if (daily('trash')) return dlg(T(pl.name), p(T('Сегодня тут уже пусто. Загляни завтра.')), []);
      return dlg(T(pl.name), p(T('Среди коробок есть большой целый лист картона. На нём можно крутить пауэр без штрафа.')), [
        { t: T('Взять картон'), cls: 'btn-accent', fn: () => {
          mark('trash'); S.card = Math.max(S.card, B.floor.card.uses); let extra = '';
          if (Math.random() < B.drop.tapeTrash) { give('tape'); extra += found('tape'); }
          if ((hour() >= 21 || hour() < 6) && Math.random() < B.drop.thermosNight) { give('thermos'); extra += found('thermos'); }
          dlg(T(pl.name), p(T('Картон у тебя. Его хватит на {n} выступлений.', { n: S.card })) + extra, []);
        } }]);
    }
    if (pl.type === 'kiosk') {
      const buy = (k, name) => ({ t: T(name) + ' · 💵 ' + B.price[k] + ' (+' + B.food[k] + ' ⚡)', off: S.cash < B.price[k] || S.en >= B.energy.max, fn: () => { S.cash -= B.price[k]; S.en = Math.min(B.energy.max, S.en + B.food[k]); openPlace(pl); } });
      return dlg(T(pl.name), p(T('Горячее и сытное. Еда возвращает энергию.')), [buy('shawarma', 'Шаурма'), buy('tea', 'Чай')]);
    }
    if (pl.type === 'shop') {
      return dlg(T(pl.name), p(T('Вещи дают маленький бонус. Навык важнее.')) + '<ul class="cyls">' + pl.sell.map(id => '<li>' + item(id).ico + ' <b>' + T(item(id).name) + '</b><small>' + T(item(id).info) + '</small></li>').join('') + '</ul>',
        pl.sell.map(id => { const has = !item(id).use && S.own.includes(id); return { t: has ? T(item(id).name) + ' — ' + T('куплено') : T(item(id).name) + ' · 💵 ' + B.price[id], off: has || S.cash < B.price[id], fn: () => { S.cash -= B.price[id]; give(id); D.toast(T('Куплено: {x}', { x: T(item(id).name) })); openPlace(pl); } }; }));
    }
    if (pl.type === 'stash') {
      if (S.got[pl.id]) return;
      S.got[pl.id] = 1; give(pl.item); S.marks = S.marks.filter(m => m !== pl.id);
      return dlg(T(pl.name), found(pl.item), []);
    }
    if (pl.type === 'gate') {
      const boss = DIST.npcs.find(n => n.boss), won = boss && S.npc[boss.id] && S.npc[boss.id].w > 0;
      if (S.rep < B.district[pl.to] || !won) return dlg(T(pl.name), p(T('В Центр пускают своих: нужно {n} респекта и победа над хозяином двора.', { n: B.district[pl.to] })) + p('★ ' + S.rep + ' / ' + B.district[pl.to] + ' · ' + (won ? '✓ ' : '✗ ') + esc(nm(boss))), []);
      return dlg(T(pl.name), p(T('Двор твой! Центр скоро откроется — район уже строится.')), []);
    }
    if (pl.type === 'show') return showSpot(pl);
  }

  // ---- moves: only what the lessons opened (the same rule as in the battles) ----
  function movesState() {
    const ul = D.ul(), lvl = D.level(), R2 = D.RB.RB2, allow = new Set(ul.allow || []), keys = new Set(ul.keys || []);
    const know = m => keys.has(m) ? allow.has(m) : (R2.NEED[m] || 1) <= lvl;
    const ban = S.bruise ? R2.ROWS[2].filter(m => m !== 'backspin') : [];
    const rows = R2.ROWS.map(r => r.filter(m => know(m) && !ban.includes(m)));
    const hole = rows.findIndex(r => !r.length);
    return { ul, lvl, ban, rows, hole, hint: hole < 0 ? null : R2.ROWS[hole].map(m => ul.hint && ul.hint[m]).find(Boolean) };
  }
  // no move for a part of the round yet ⇒ to the lesson (the game leads to the lessons, it does not replace them)
  function needBase(ms) {
    const names = ['TOPROCK', 'FOOTWORK', 'POWER', 'FREEZE'], h = ms.hint;
    dlg(T('Сначала — база'), p(T('Чтобы выйти в круг, нужно хотя бы одно движение в каждой части раунда. У тебя пока нет: {row}.', { row: names[ms.hole] })) +
      p(T('Движения открывают уроки — так же, как в батлах.')), h && (h.id || h.sec) ? [{ t: h.id ? T('Открыть урок') : T('Открыть раздел'), cls: 'btn-accent', fn: () => D.openLesson(h) }] : []);
  }
  const res = (cash, rep, lines) => '<div class="cyres">' + (cash ? '<b class="' + (cash > 0 ? 'up' : 'dn') + '">' + (cash > 0 ? '+' : '−') + Math.abs(cash) + ' 💵</b>' : '') + (rep ? '<b class="up">+' + rep + ' ★</b>' : '') + '</div>' + lines.map(l => '<p class="cyln">' + l + '</p>').join('');
  function wearFloor(fl, lines) { if (fl === 'card') { S.card--; if (S.card <= 0) lines.push('📦 ' + T('Картон порвался. Новый — у мусорки.')); } }
  function bruiseRoll(fl, picks, lines) {
    const F = B.floor[fl]; if (!F.bruise || D.RB.RB2.mult(picks[2]) < B.powerFrom) return;
    if (Math.random() < (S.own.includes('pads') ? B.padsBruise : F.bruise)) { S.bruise = 1; lines.push('🤕 ' + T('Ушиб на асфальте! Пауэр отдыхает, пока не выспишься.')); }
  }
  function openRound(opt, onCity) {
    if (D.gate && D.gate()) return false;   // a new phone: battles are closed until the basic lessons are studied — the app's own sheet leads to them
    const ms = movesState(); if (ms.hole >= 0) { needBase(ms); return false; }
    pend = opt.pend; save();
    D.RB.open({ level: ms.lvl, eq: D.look(), me: D.me(), opp: opt.opp || null, dj: opt.beat, ul: ms.ul,
      city: { ban: ms.ban, fw: S.own.includes('kicks') ? B.item.kicksMs / 1000 : 0, cor: S.own.includes('hat') ? B.item.hatPx : 0 },
      onCity: r => { pend = null; const out = onCity(r, ms); out.btn = T('В город'); out.done = () => { paintHud(); save(); kick(); }; save(); return out; } });
    return true;
  }

  // ---- street show ----
  function showSpot(pl) {
    const sp = S.spot[pl.id] || (S.spot[pl.id] = { n: 0, t: -1e9 });
    if (S.t - sp.t > B.show.rest) sp.n = 0;
    const tired = Math.pow(B.show.tired, sp.n), fl = floorId();
    dlg(T(pl.name), p(T('Стелешь пол, танцуешь раунд — в шляпу падают деньги. Чем чище раунд, тем больше.')) +
      p(T('Пол') + ': <b>' + floorName() + '</b> · ' + (sp.n ? T('Толпа устала: платит {n} %', { n: Math.round(tired * 100) }) : T('Толпа свежая'))) +
      (fl === 'asphalt' ? p('⚠️ ' + T('На асфальте пауэрмув даёт штраф и может закончиться ушибом.')) : ''), [
      { t: T('Выступить') + ' (−' + B.energy.show + ' ⚡)', cls: 'btn-accent', off: S.en < B.energy.show, fn: () => {
        const beats = B.showBeats, beat = beats[Math.floor(Math.random() * beats.length)];
        if (!openRound({ beat, pend: { kind: 'show' } }, (r, ms) => {
          const F = B.floor[fl], lines = [], hard = D.RB.RB2.mult(r.picks[2]) >= B.powerFrom;
          let k = F.mult * tired; if (F.pen && hard) { k *= 1 - F.pen; lines.push('⚠️ ' + T('Асфальт: −{n} % за пауэрмув', { n: Math.round(F.pen * 100) })); }
          if (S.own.includes('cassette')) k *= B.show.cassette;
          const cash = Math.min(B.show.cap, Math.max(2, Math.round((B.show.min + B.show.span * r.acc) * k)));
          S.cash += cash; S.t += 30;
          if (S.own.includes('chalk') && !daily('chalk')) { mark('chalk'); lines.push('✏️ ' + T('Меловой круг: толпа не устала.')); } else sp.n++;
          sp.t = S.t;
          if (sp.n > 1) lines.push(T('Толпа устаёт — в следующий раз заплатит меньше. Дай месту отдохнуть.'));
          wearFloor(fl, lines); bruiseRoll(fl, r.picks, lines);
          if (Math.random() < B.drop.tapeHat) { give('tape'); lines.push(found('tape')); }
          return { title: T('Шляпа собрана'), extra: res(cash, 0, lines) };
        })) return;
        S.en -= B.energy.show;
      } }]);
  }

  // ---- street battle ----
  function npcPicks(n) {
    const R2 = D.RB.RB2, cap = Math.max(1, Math.ceil(n.lvl * .8));
    return R2.ROWS.map((row, k) => { const have = row.filter(m => (R2.NEED[m] || 1) <= cap).sort((a, b) => R2.mult(a) - R2.mult(b)); return k === n.style ? have[have.length - 1] : have[Math.floor(Math.random() * Math.ceil(have.length * .6))]; });
  }
  function openNpc(n) {
    const st = S.npc[n.id] || (S.npc[n.id] = { w: 0, l: 0, last: null, met: 0 });
    let html = say(nm(n), n.boss && S.rep < (n.needRep || 0) ? n.early : n.hi);
    if (!st.met && n.rumor) { const pl = DIST.places.find(q => q.id === n.rumor.mark); if (pl && !S.got[pl.id] && !S.marks.includes(pl.id)) { S.marks.push(pl.id); html += say(nm(n), n.rumor.text) + p('📍 ' + T('На карте появилась метка.')); } }
    st.met = 1;
    const styles = ['Топрокер', 'Футворкер', 'Пауэрмувер', 'Фризер'];
    html += p('<small>' + T('Уровень {n}', { n: n.lvl }) + ' · ' + T(styles[n.style]) + ' · ' + T('побед {w}, поражений {l}', { w: st.w, l: st.l }) + '</small>');
    if (n.boss && S.rep < (n.needRep || 0)) return dlg(nm(n), html + p('★ ' + S.rep + ' / ' + n.needRep), []);
    if (daily('b:' + n.id)) return dlg(nm(n), html + p(T('Сегодня вы уже батлили. Приходи завтра.')), []);
    html += p(T('Пол') + ': <b>' + floorName() + '</b> · ' + T('батл −{n} ⚡', { n: B.energy.battle })) + (st.last ? p('<small>' + T('Он помнит твою прошлую связку — повторишь, и судьи срежут очки.') + '</small>') : '');
    const stakes = [n.stake[0], Math.round((n.stake[0] + n.stake[1]) / 2 / 5) * 5, n.stake[1]].filter((v, i, a) => a.indexOf(v) === i);
    dlg(nm(n), html, stakes.map((v, i) => ({ t: T('Ставка') + ' 💵 ' + v, cls: i ? 'btn-line' : 'btn-accent', off: S.cash < v || S.en < B.energy.battle, fn: () => battle(n, st, v) }))
      .concat(S.en < B.energy.battle ? [{ t: T('Мало энергии — поешь или выспись'), off: true }] : S.cash < stakes[0] ? [{ t: T('Не хватает кэша на ставку — выступи на улице'), off: true }] : []));
  }
  function battle(n, st, stake) {
    const fl = floorId(), pool = B.beats.find(b => n.lvl <= b[0])[1], beat = pool[Math.floor(Math.random() * pool.length)];
    if (!openRound({ beat, opp: { name: nm(n) }, pend: { kind: 'battle', name: nm(n) } }, (r, ms) => {
      const R2 = D.RB.RB2, F = B.floor[fl], lines = [], hard = R2.mult(r.picks[2]) >= B.powerFrom;
      let k = F.mult; if (F.pen && hard) { k *= 1 - F.pen; lines.push('⚠️ ' + T('Асфальт: −{n} % за пауэрмув', { n: Math.round(F.pen * 100) })); }
      const same = st.last ? r.picks.filter((m, i) => m === st.last[i]).length : 0, rd = Math.min(B.read.max, same * B.read.per);
      if (rd) { k *= 1 - rd; lines.push('👀 ' + T('{name} прочитал твою связку: −{n} %', { name: nm(n).split(' ')[0], n: Math.round(rd * 100) })); }
      const my = Math.round(r.score * k), pk = npcPicks(n), N = B.npc;
      const acc = cl(N.acc0 + N.accLvl * n.lvl + (Math.random() * 2 - 1) * N.spread + N.style, .2, .97), their = Math.round(r.maxFor(pk, Math.max(1, Math.ceil(n.lvl * .8))) * acc);
      const pMe = 1 / (1 + Math.exp(-(my - their) / (N.judge * Math.max(my, their, 1))));
      const votes = [0, 1, 2].map(() => Math.random() < pMe ? 'l' : 'r');
      if (S.own.includes('lace') && Math.abs(my - their) < B.lace * Math.max(my, their, 1) && votes.includes('r')) { votes[votes.indexOf('r')] = 'l'; lines.push('🍀 ' + T('Счастливый шнурок: один судья передумал.')); }
      const won = votes.filter(v => v === 'l').length >= 2; let rep = 0;
      if (won) {
        rep = (B.rep.base + B.rep.perLvl * n.lvl) * (st.w ? 1 : B.rep.first); S.cash += stake * 2; S.rep += rep;
        if (!st.w && n.drop) n.drop.forEach(id => { if (!S.own.includes(id)) { give(id); lines.push(found(id)); } });
        if (Math.random() < B.drop.tapeWin) { give('tape'); lines.push(found('tape')); }
        st.w++;
      } else { st.l++; S.en = Math.max(0, S.en - B.energy.lose); }
      st.last = r.picks.slice(); S.t += 20;
      wearFloor(fl, lines); bruiseRoll(fl, r.picks, lines);
      lines.unshift('<i>' + esc(nm(n)) + ': ' + esc(T(won ? n.win : n.lose)) + '</i>');
      return { my: { sc: my, pf: r.perfect, gd: r.good, ms: r.miss, dr: r.draw, g: 2, fc: r.full, nv: r.fresh }, their: { sc: their }, votes, won, extra: res(won ? stake : -stake, rep, lines) };
    })) return;
    S.en -= B.energy.battle; S.cash -= stake; mark('b:' + n.id);
  }

  // ---- input + loop ----
  function tapAt(e) {
    if (!dlgEl.hidden) return;
    const r = can.getBoundingClientRect(), ox = Math.round(W / 2 - cam.x * TS), oy = Math.round((H - padB) / 2 - cam.y * TS);
    const tx = Math.floor((e.clientX - r.left - ox) / TS), ty = Math.floor((e.clientY - r.top - oy) / TS);
    if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) return;
    const n = npcsNow().find(q => seen(q.at[0], q.at[1]) && q.at[0] === tx && (q.at[1] === ty || q.at[1] - 1 === ty)); // the b-boy or the name above him
    const pl = seen(tx, ty) ? placeAt(tx, ty) : null;
    let goals, then = null;
    if (n) { goals = around(n.at[0], n.at[1]); then = () => openNpc(n); }
    else if (pl) { goals = walk(pl.at[0], pl.at[1]) ? [pl.at] : around(tx, ty).concat(around(pl.at[0], pl.at[1])); then = () => openPlace(pl); }
    else if (walk(tx, ty)) goals = [[tx, ty]];
    else goals = around(tx, ty);
    if (!goals.length) return;
    const way = route(goals); if (!way) return;
    path = way; goal = then; if (!way.length && then) { goal = null; then(); }
    kick();
  }
  function step(dt) {
    S.t += dt * 1440 / (B.dayMin * 60);
    let left = SPEED * dt;
    while (path.length && left > 0) {
      const [tx, ty] = path[0], dx = tx - hero.x, dy = ty - hero.y, d = Math.hypot(dx, dy);
      if (d <= left) { hero.x = tx; hero.y = ty; left -= d; path.shift(); reveal(); if (!path.length) { save(); if (goal) { const g = goal; goal = null; g(); } } }
      else { hero.x += dx / d * left; hero.y += dy / d * left; left = 0; }
    }
  }
  function frame(now) {
    raf = 0; timer = 0; if (!shown || document.hidden) return;
    const dt = Math.min(.25, (now - last) / 1000 || 0); last = now;
    if (D.rbEl.hidden) step(dt);            // the clock stands still during a round
    draw(now); paintHud();
    // battery: 60 fps only while the hero walks; otherwise a slow tick (the clock, small idle motion)
    if (path.length) raf = requestAnimationFrame(frame); else timer = setTimeout(() => { raf = requestAnimationFrame(frame); }, 240);
  }
  function kick() { if (!shown || document.hidden) return; clearTimeout(timer); timer = 0; if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function halt() { cancelAnimationFrame(raf); clearTimeout(timer); raf = 0; timer = 0; }

  const CSS = '#city{padding:0!important;overflow:hidden;position:relative;background:#0B0B0C;touch-action:none;user-select:none;-webkit-user-select:none}' +
    '#cyCan{position:absolute;inset:0;width:100%;height:100%;display:block}' +
    '.cyhud{position:absolute;left:10px;right:10px;top:calc(8px + env(safe-area-inset-top,0px));display:grid;grid-template-columns:auto 1fr auto auto;gap:6px 8px;align-items:center;pointer-events:none;font-family:Inter,system-ui,sans-serif;color:#F2EFE8}' +
    '.cyhud>*{background:rgba(11,11,12,.8);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:6px 10px;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}' +
    '.cyh1 b{font:400 20px/1 Anton,Inter,sans-serif;letter-spacing:.5px;display:block}.cyh1 small{font-size:10px;color:#9A968E;white-space:nowrap}' +
    '.cyen{position:relative;height:34px;padding:0;overflow:hidden}.cyen i{position:absolute;inset:0 auto 0 0;background:linear-gradient(90deg,#B84A10,#E2611A)}.cyen span{position:relative;display:block;text-align:center;font:700 13px/34px Inter,sans-serif}' +
    '.cyst{display:flex;flex-direction:column;font:700 12px/1.25 Inter,sans-serif;white-space:nowrap}' +
    '.cybag{pointer-events:auto;font-size:18px;width:44px;height:44px;padding:0;color:inherit;cursor:pointer}' +
    '.cyfl{grid-column:1/-1;justify-self:start;font-size:11px;color:#C9C5BC;padding:4px 10px}' +
    '.cydlg{position:absolute;inset:0;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.45);padding:10px 10px calc(10px + var(--cyb,0px))}' +
    '.cyd{width:100%;max-width:480px;max-height:78%;overflow-y:auto;background:#151517;border:1px solid rgba(255,255,255,.1);border-radius:18px;padding:16px;color:#F2EFE8;font-family:Inter,system-ui,sans-serif}' +
    '.cyd h3{font:400 24px/1.1 Anton,Inter,sans-serif;letter-spacing:.5px;margin:0 0 8px;text-transform:uppercase}.cyd p{margin:0 0 8px;font-size:14px;line-height:1.4;color:#D8D4CB}' +
    '.cysay{background:rgba(226,97,26,.1);border-left:3px solid #E2611A;border-radius:8px;padding:8px 10px}.cygot{background:rgba(59,209,111,.08);border:1px solid rgba(59,209,111,.3);border-radius:10px;padding:8px 10px;color:#7BE3A0!important}' +
    '.cyls{list-style:none;margin:0 0 8px;padding:0}.cyls li{padding:7px 0;border-top:1px solid rgba(255,255,255,.07);font-size:14px}.cyls small,.cygot small{display:block;color:#9A968E;font-size:12px}' +
    '.cybt{display:flex;flex-direction:column;gap:8px;margin-top:10px}.cybt .btn{width:100%}.cybt .btn[disabled]{opacity:.4}' +
    '.rbcity{margin-top:10px}.cyres{display:flex;gap:14px;justify-content:center;font:400 26px/1 Anton,Inter,sans-serif;margin:4px 0 8px}.cyres .up{color:#3BD16F}.cyres .dn{color:#E2611A}.cyln{font-size:13px;color:#C9C5BC;margin:0 0 6px;text-align:center}';

  function init(deps) {
    D = deps; el = D.el; S = load();
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    el.innerHTML = '<canvas id="cyCan"></canvas><div class="cyhud" id="cyHud"></div><div class="cydlg" id="cyDlg" hidden></div>';
    can = $('#cyCan'); cx = can.getContext('2d'); if (!cx.roundRect) cx.roundRect = function (x, y, w, h) { this.rect(x, y, w, h); }; hud = $('#cyHud'); dlgEl = $('#cyDlg');
    setMap();
    can.addEventListener('pointerdown', tapAt);
    window.addEventListener('resize', () => { W = 0; kick(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { halt(); if (shown) save(); } else kick(); });   // pause when the app is folded
    window.addEventListener('pagehide', () => { if (shown) save(); });
    // the round was left before its end (back / swipe): the stake and the energy stay spent
    new MutationObserver(() => { if (!D.rbEl.hidden) return; if (pend) { const k = pend.kind; pend = null; if (shown) D.toast(k === 'battle' ? T('Ты ушёл из круга — ставка сгорела') : T('Шоу сорвалось — энергия потрачена')); save(); } hudKey = ''; kick(); })
      .observe(D.rbEl, { attributes: true, attributeFilter: ['hidden'] });
  }
  function show() { if (!el) return; shown = true; W = 0; const tb = document.getElementById('tabs'); el.style.setProperty('--cyb', (tb ? tb.offsetHeight : 0) + 'px'); padB = tb ? tb.offsetHeight : 0; hudKey = ''; kick(); if (!S.intro) setTimeout(() => { if (shown && dlgEl.hidden) intro(); }, 400); }
  function hide() { if (!shown) return; shown = false; halt(); save(); }
  window.CITY = { init, show, hide, _cam: () => ({ ox: Math.round(W / 2 - cam.x * TS), oy: Math.round((H - padB) / 2 - cam.y * TS) }), _s: () => S, _reset: () => { S = fresh(); setMap(); save(); hudKey = ''; kick(); }, _go: (x, y) => { hero.x = x; hero.y = y; reveal(); kick(); }, _t: h => { S.t = Math.floor(S.t / 1440) * 1440 + h * 60; kick(); } };
})();
