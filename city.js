// «Город» — мини-игра с видом сверху (owner 13.11.2026). Движок: карта из клеток, камера, туман, путь по тапу, часы, места,
// би-бои. Данные — city-data.js, цифры — city-balance.js. Батлы и шоу идут через rhythm.js (RB.open({ city, onCity })) — без сервера.
// Сохранение — на телефоне (`fedoskin-city`, версия CITY_BAL.save). На уровень героя и общий рейтинг город не влияет.
(function () {
  'use strict';
  const B = window.CITY_BAL, DATA = window.CITY_DATA, KEY = 'fedoskin-city';
  const GFX = window.CITY_GFX, BLOCK = 'F#bGTKSXctDCLBhuPkM', TS = GFX.TS, SPEED = 5.5, SEE = 4.6;
  let D, S, el, can, cx, hud, dlgEl, W = 0, H = 0, dpr = 1, shown = false, timer = 0, raf = 0, last = 0, path = [], goal = null, pend = null;
  let joy = null, padB = 0, MAP, MW, MH, DIST, hero = { x: 0, y: 0 }, cam = { x: 0, y: 0 }, hudKey = '';
  let hdir = 0, hdist = 0, moved = 0, lookKey = '', lookNow = null, npcLook = {}, warmUp = {}, birdAway = {};
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
  // warmed up by a real lesson today: more energy and respect (the game leads to the lessons every day)
  const warm = () => !!D.todaySec && D.todaySec() >= B.warm.sec;
  const emax = () => B.energy.max + (warm() ? B.warm.energy : 0);
  const warmTxt = () => '🔥 ' + T('Разогрет уроком: +{e} энергии и +{r} % респекта до конца дня', { e: B.warm.energy, r: Math.round(B.warm.rep * 100) });
  function warmCheck() { if (!warm() || S.warmDay === D.day()) return; S.warmDay = D.day(); S.en = Math.min(emax(), S.en + B.warm.energy); hudKey = ''; D.toast(warmTxt()); save(); }
  const warmTip = () => '<p>' + (warm() ? warmTxt() : '🔥 ' + T('Позанимайся сегодня в уроках {m} минут — герой будет разогрет: +{e} энергии и +{r} % респекта.', { m: Math.round(B.warm.sec / 60), e: B.warm.energy, r: Math.round(B.warm.rep * 100) })) + '</p>';
  const daily = k => S.day[k] === dayN();           // already done this game day?
  const mark = k => { S.day[k] = dayN(); };

  // ---- map ----
  function setMap() {
    DIST = DATA.districts[S.d]; MAP = DIST.map; MH = MAP.length; MW = MAP[0].length;
    if (!S.fog[S.d] || S.fog[S.d].length !== MW * MH) S.fog[S.d] = '0'.repeat(MW * MH);
    hero.x = S.x; hero.y = S.y; cam.x = hero.x; cam.y = hero.y; path = []; npcLook = {}; GFX.setMap(DIST, dpr); reveal();
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

  // ---- drawing: the picture itself lives in city-gfx.js (cached map pieces and sprites); here — only what goes where ----
  function size() {
    const r = can.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1); W = r.width; H = r.height;
    if (d !== dpr) { dpr = d; GFX.setMap(DIST, dpr); }
    can.width = Math.round(W * dpr); can.height = Math.round(H * dpr);
  }
  const R = (x, y, w, h, c) => { cx.fillStyle = c; cx.fillRect(x, y, w, h); };
  // the hero's clothes come from hero.js (level look + wardrobe + shop accessories) plus the things bought or found in the city
  function heroLook() {
    const lv = D.level(), eq = D.look() || [], k = lv + '|' + eq.join(',') + '|' + ['hat', 'kicks', 'pads'].map(i => +S.own.includes(i)).join('') + (S.card > 0 ? 'c' : '');
    if (k === lookKey) return lookNow;
    const f = window.HERO.topDown(lv, eq); f.col = Object.assign({}, f.col);
    if (S.own.includes('hat')) { f.hat = 'spin'; f.col.hat = ['#2A6FA8', '#E2611A']; }
    if (S.own.includes('kicks')) { f.col.shoe = '#19B5A5'; f.col.shoe2 = '#F2EFE8'; f.col.sole = '#F2EFE8'; }
    if (S.own.includes('pads')) f.knee = true;
    if (S.card > 0) f.carry = true;
    lookKey = k; return (lookNow = { key: 'me:' + k, f });
  }
  function lookOf(n) {
    if (npcLook[n.id]) return npcLook[n.id];
    const L = n.look || {}, f = window.HERO.topDown(L.base || Math.min(8, n.lvl + 1), L.acc || []);
    f.col = Object.assign({}, f.col, L.col || {}); ['hat', 'chain', 'box', 'phones', 'wrist', 'girl'].forEach(k => { if (k in L) f[k] = L[k]; });
    return (npcLook[n.id] = { key: 'n:' + n.id, f, big: L.big || 1 });
  }
  const dirOf = (dx, dy) => ((Math.round(Math.atan2(-dx, dy) / (Math.PI / 4)) % 8) + 8) % 8;
  const busy = now => Object.keys(warmUp).some(k => warmUp[k] > now);
  function label(px, py, txt, col) {
    cx.font = '700 11px Inter, system-ui, sans-serif'; const w = cx.measureText(txt).width + 12;
    cx.fillStyle = 'rgba(11,11,12,.82)'; cx.beginPath(); cx.roundRect(px - w / 2, py - 9, w, 18, 9); cx.fill();
    cx.fillStyle = col || '#F2EFE8'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(txt, px, py + .5);
  }
  function draw(now) {
    if (!W) size(); if (!W) return;
    cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.imageSmoothingEnabled = false; R(0, 0, W, H, '#0B0B0C');
    const vw = W / TS, vh = (H - padB) / TS;
    cam.x = cl(hero.x + .5, Math.min(vw / 2, MW / 2), Math.max(MW - vw / 2, MW / 2)); cam.y = cl(hero.y + .5, Math.min(vh / 2, MH / 2), Math.max(MH - vh / 2, MH / 2));
    const ox = Math.round(W / 2 - cam.x * TS), oy = Math.round((H - padB) / 2 - cam.y * TS), ng = night(), h = hour();
    const vis = (x, y, m) => { const px = ox + x * TS, py = oy + y * TS; return px > -m && py > -m && px < W + m && py < H + m; };
    GFX.drawMap(cx, ox, oy, W, H);
    DIST.places.forEach(p => { if (p.type === 'stash' && !S.got[p.id] && seen(p.at[0], p.at[1]) && vis(p.at[0], p.at[1], TS)) GFX.crate(cx, ox + p.at[0] * TS, oy + p.at[1] * TS); });
    if (path.length) { const g = path[path.length - 1]; cx.strokeStyle = '#E2611A'; cx.lineWidth = 2; cx.beginPath(); cx.arc(ox + g[0] * TS + TS / 2, oy + g[1] * TS + TS / 2, 10 + 2 * Math.sin(now / 150), 0, 7); cx.stroke(); }
    (DIST.birds || []).forEach((b, i) => {
      if (Math.hypot(b[0] - hero.x - .5, b[1] - hero.y - .5) < 1.3) birdAway[i] = S.t + 90;
      if (birdAway[i] > S.t || !seen(Math.floor(b[0]), Math.floor(b[1])) || !vis(b[0], b[1], 20)) return;
      GFX.bird(cx, ox + b[0] * TS, oy + b[1] * TS, i * 2.1 + Math.floor(now / 2600 + i) % 3, Math.floor(now / 480 + i) % 3 === 0);
    });
    // people: the b-boys sway, warm up now and then (and when you come up to them), and turn to the hero when he is near
    const mv = moved > now - 120, me = heroLook();
    npcsNow().forEach(n => {
      if (!seen(n.at[0], n.at[1]) || !vis(n.at[0], n.at[1], 2 * TS)) return;
      const px = ox + n.at[0] * TS + TS / 2, py = oy + n.at[1] * TS + TS / 2, dx = hero.x - n.at[0], dy = hero.y - n.at[1], near = Math.hypot(dx, dy) < 3.2;
      const hot = warmUp[n.id] > now || (!daily('b:' + n.id) && (now + n.lvl * 2300) % 9000 < 1600);
      GFX.person(cx, px, py, lookOf(n), near ? dirOf(dx, dy) : 0, hot ? 't' + Math.floor(now / 200) % 4 : 'i' + Math.floor(now / 700 + n.lvl) % 2);
    });
    const hx = ox + hero.x * TS + TS / 2, hy = oy + hero.y * TS + TS / 2;
    if (me.f.fire) GFX.aura(cx, hx, hy, now);
    GFX.person(cx, hx, hy, me, hdir, mv ? 'w' + Math.floor(hdist * 4.3) % 6 : (now % 14000 < 1800 ? 't' + Math.floor(now / 200) % 4 : 'i' + Math.floor(now / 700) % 2));
    GFX.trees().forEach(t => { if (seen(t[0], t[1]) && vis(t[0], t[1], 2 * TS)) GFX.crown(cx, ox + t[0] * TS, oy + t[1] * TS, t[0], t[1]); });
    // night: darkness, pools of light under the lamps, the kiosk and some windows glow
    if (ng > 0) {
      const ki = DIST.places.find(p => p.type === 'kiosk'), L = GFX.lightsNow(ox, oy, W, H, dayN(), !!ki && inH(h, ki.open));
      L.push(me.f.fire ? { px: hx, py: hy, r: 1.6 * TS, a: .8 } : { px: hx, py: hy, r: 1.25 * TS, a: .42 });   // the hero is always readable in the dark
      GFX.night(cx, W, H, ng, L); GFX.glow(cx, ox, oy, L, ng, W, H); cx.imageSmoothingEnabled = false;
    }
    GFX.fog(cx, S.fog[S.d], ox, oy);
    DIST.places.forEach(p => {
      if (!seen(p.at[0], p.at[1]) || !vis(p.at[0], p.at[1], TS)) return; if (p.type === 'stash' && S.got[p.id]) return;
      const near = Math.hypot(p.at[0] - hero.x, p.at[1] - .7 - hero.y) < .9;   // do not cover the hero with the sign
      cx.globalAlpha = near ? .3 : 1; GFX.sign(cx, ox + p.at[0] * TS + TS / 2, oy + p.at[1] * TS - 10 + Math.round(2 * Math.sin(now / 400 + p.at[0])), p.type, !!p.open && !inH(h, p.open)); cx.globalAlpha = 1;
    });
    npcsNow().forEach(n => {
      if (!seen(n.at[0], n.at[1]) || !vis(n.at[0], n.at[1], 2 * TS)) return;
      const px = ox + n.at[0] * TS + TS / 2, py = oy + n.at[1] * TS + TS / 2;
      label(px, py - 42, nm(n).split(' ')[0] + ' · ' + n.lvl, n.boss ? '#F2CC55' : '#F2EFE8');
      if (!daily('b:' + n.id)) { cx.fillStyle = '#E2611A'; cx.beginPath(); cx.arc(px + 22, py - 24, 7, 0, 7); cx.fill(); cx.font = '900 11px Inter, sans-serif'; cx.fillStyle = '#0B0B0C'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('!', px + 22, py - 23.5); }
    });
    S.marks.forEach(id => { const p = DIST.places.find(q => q.id === id); if (!p || S.got[id]) return; label(ox + p.at[0] * TS + TS / 2, oy + p.at[1] * TS + TS + 2 - 4 * Math.abs(Math.sin(now / 300)), T('Слух'), '#E2611A'); });
    if (joy && joy.on) { const r = can.getBoundingClientRect(), jx = joy.x0 - r.left, jy = joy.y0 - r.top;
      cx.strokeStyle = 'rgba(242,239,232,.35)'; cx.lineWidth = 2; cx.beginPath(); cx.arc(jx, jy, 46, 0, 7); cx.stroke();
      cx.fillStyle = 'rgba(226,97,26,.7)'; cx.beginPath(); cx.arc(jx + joy.dx * 46, jy + joy.dy * 46, 18, 0, 7); cx.fill(); }
  }

  // ---- HUD + dialogs (DOM) ----
  const floorName = () => S.card > 0 ? T('Картон') + ' ×' + S.card : S.own.includes('lino') ? T('Линолеум') : T('Асфальт');
  const floorId = () => S.own.includes('lino') ? 'lino' : S.card > 0 ? 'card' : 'asphalt';
  function paintHud() {
    const k = [clock(), dayN(), Math.round(S.en), S.cash, S.rep, S.card, S.bruise, S.own.length, warm()].join('|'); if (k === hudKey) return; hudKey = k;
    hud.innerHTML = '<div class="cyh1"><b>' + clock() + '</b><small>' + T('День {n}', { n: dayN() + 1 }) + ' · ' + T(DIST.name) + '</small></div>' +
      '<div class="cyen" title="' + T('Энергия') + '"><i style="width:' + cl(S.en / emax() * 100, 0, 100) + '%"></i><span>⚡ ' + Math.round(S.en) + '</span></div>' +
      '<div class="cyst"><span>💵 ' + S.cash + '</span><span>★ ' + S.rep + '</span></div>' +
      '<button type="button" class="cybag" id="cyBag" aria-label="' + T('Рюкзак') + '">🎒</button>' +
      '<div class="cyfl">' + T('Пол') + ': ' + floorName() + (S.bruise ? ' · 🤕 ' + T('Ушиб') : '') + (warm() ? ' · 🔥 ' + T('Разогрет') : '') + '</div>';
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
      warmTip() + p('<small>' + T('Уровень героя и новые движения дают только настоящие уроки. Город даёт кэш, респект и вещи.') + '</small>'), [
      !warm() && D.home && { t: T('К урокам'), cls: 'btn-accent', fn: () => D.home() },
      S.inv.thermos > 0 && { t: T('Выпить чай из термоса') + ' (+' + B.food.thermos + ' ⚡)', fn: () => { S.inv.thermos--; S.en = Math.min(emax(), S.en + B.food.thermos); } },
      S.inv.tape > 0 && S.card > 0 && { t: T('Починить картон изолентой') + ' (+' + B.item.tapeUses + ')', fn: () => { S.inv.tape--; S.card += B.item.tapeUses; } },
      { t: T('Как играть'), fn: intro }
    ].filter(Boolean));
  }
  function intro() {
    S.intro = 1;
    dlg(T('Город'), p(T('Тапни по карте — герой пойдёт туда сам. Заходи в места, знакомься с би-боями, зарабатывай кэш и респект.')) +
      p(T('Батл стоит 20 энергии, шоу — 10. Энергию возвращают сон дома и еда.')) +
      p(T('На асфальте пауэрмув бьёт по очкам и телу — найди картон у мусорки.')) +
      p(T('Можно и джойстиком: поставь палец на карту и веди — герой идёт, пока держишь.')) +
      p('<b>' + T('Сила — только из уроков: новые движения и уровень героя город не даёт.') + '</b>') + warmTip(), []);
  }

  // ---- places ----
  function openPlace(pl) {
    const h = hour(), closed = pl.open && !inH(h, pl.open);
    if (closed) return dlg(T(pl.name), p(T('Закрыто. Работает с {a}:00 до {b}:00.', { a: pl.open[0], b: pl.open[1] })), []);
    if (pl.type === 'home') {
      const late = h >= 21 || h < 6;
      return dlg(T('Дом'), p(T('Здесь можно выспаться. Игра сохраняется сама.')) + (S.bruise ? p('🤕 ' + T('Сон вылечит ушиб.')) : ''), [
        { t: late ? T('Спать до утра') : T('Спать до утра') + ' — ' + T('ещё не вечер (после 21:00)'), cls: 'btn-accent', off: !late, fn: () => { S.t = (Math.floor((S.t - 6 * 60) / 1440) + 1) * 1440 + B.startHour * 60; S.en = emax(); S.bruise = 0; D.toast(T('Доброе утро! Энергия восстановлена')); } },
        { t: T('Вздремнуть часок') + ' (+' + B.energy.stretch + ' ⚡)', off: daily('nap') || S.en >= emax(), fn: () => { mark('nap'); S.t += 60; S.en = Math.min(emax(), S.en + B.energy.stretch); } }
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
      const buy = (k, name) => ({ t: T(name) + ' · 💵 ' + B.price[k] + ' (+' + B.food[k] + ' ⚡)', off: S.cash < B.price[k] || S.en >= emax(), fn: () => { S.cash -= B.price[k]; S.en = Math.min(emax(), S.en + B.food[k]); openPlace(pl); } });
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
    warmUp[n.id] = performance.now() + 2600; kick();
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
        rep = (B.rep.base + B.rep.perLvl * n.lvl) * (st.w ? 1 : B.rep.first);
        if (warm()) { rep = Math.round(rep * (1 + B.warm.rep)); lines.push('🔥 ' + T('Разогрет уроком: респект +{r} %', { r: Math.round(B.warm.rep * 100) })); }
        S.cash += stake * 2; S.rep += rep;
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
  // joystick (optional): put the finger down and drag — the hero walks that way while the finger is held; a short touch = a tap
  function down(e) { if (!dlgEl.hidden) return; joy = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, on: false }; try { can.setPointerCapture(e.pointerId); } catch (_) {} }
  function move(e) {
    if (!joy || e.pointerId !== joy.id) return;
    const dx = e.clientX - joy.x0, dy = e.clientY - joy.y0, d = Math.hypot(dx, dy);
    if (!joy.on && d > 16) { joy.on = true; path = []; goal = null; }
    if (joy.on) { const k = d > 8 ? Math.min(1, d / 46) / d : 0; joy.dx = dx * k; joy.dy = dy * k; kick(); }
  }
  function up(e) {
    if (!joy || e.pointerId !== joy.id) return;
    const j = joy; joy = null;
    if (!j.on) return tapAt(e);
    const tx = Math.round(hero.x), ty = Math.round(hero.y); path = walk(tx, ty) ? [[tx, ty]] : []; kick();   // settle on the cell
  }
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
    if (joy && joy.on) {
      const nx = hero.x + joy.dx * SPEED * dt, ny = hero.y + joy.dy * SPEED * dt, m = .32;
      const bx = hero.x, by = hero.y;
      if (walk(Math.round(nx + Math.sign(joy.dx) * m), Math.round(hero.y))) hero.x = nx;
      if (walk(Math.round(hero.x), Math.round(ny + Math.sign(joy.dy) * m))) hero.y = ny;
      if (Math.hypot(joy.dx, joy.dy) > .15) hdir = dirOf(joy.dx, joy.dy);
      const dd = Math.hypot(hero.x - bx, hero.y - by); if (dd > 0) { hdist += dd; moved = performance.now(); }
      reveal(); return;
    }
    let left = SPEED * dt;
    while (path.length && left > 0) {
      const [tx, ty] = path[0], dx = tx - hero.x, dy = ty - hero.y, d = Math.hypot(dx, dy);
      if (d > .01) { hdir = dirOf(dx, dy); hdist += Math.min(d, left); moved = performance.now(); }
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
    if (path.length || (joy && joy.on)) raf = requestAnimationFrame(frame); else timer = setTimeout(() => { raf = requestAnimationFrame(frame); }, busy(now) || now % 14000 < 1800 ? 100 : 220);
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
    can.addEventListener('pointerdown', down); can.addEventListener('pointermove', move); can.addEventListener('pointerup', up); can.addEventListener('pointercancel', () => { joy = null; });
    window.addEventListener('resize', () => { W = 0; kick(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { halt(); if (shown) save(); } else kick(); });   // pause when the app is folded
    window.addEventListener('pagehide', () => { if (shown) save(); });
    // the round was left before its end (back / swipe): the stake and the energy stay spent
    new MutationObserver(() => { if (!D.rbEl.hidden) return; if (pend) { const k = pend.kind; pend = null; if (shown) D.toast(k === 'battle' ? T('Ты ушёл из круга — ставка сгорела') : T('Шоу сорвалось — энергия потрачена')); save(); } hudKey = ''; kick(); })
      .observe(D.rbEl, { attributes: true, attributeFilter: ['hidden'] });
  }
  function show() { if (!el) return; shown = true; W = 0; const tb = document.getElementById('tabs'); el.style.setProperty('--cyb', (tb ? tb.offsetHeight : 0) + 'px'); padB = tb ? tb.offsetHeight : 0; hudKey = ''; warmCheck(); S.en = Math.min(S.en, emax()); kick(); if (!S.intro) setTimeout(() => { if (shown && dlgEl.hidden) intro(); }, 400); }
  function hide() { if (!shown) return; shown = false; halt(); save(); }
  window.CITY = { init, show, hide, _pos: () => [+hero.x.toFixed(2), +hero.y.toFixed(2)], _cam: () => ({ ox: Math.round(W / 2 - cam.x * TS), oy: Math.round((H - padB) / 2 - cam.y * TS) }), _s: () => S, _reset: () => { S = fresh(); setMap(); save(); hudKey = ''; kick(); }, _go: (x, y) => { hero.x = x; hero.y = y; reveal(); kick(); }, _t: h => { S.t = Math.floor(S.t / 1440) * 1440 + h * 60; kick(); } };
})();
