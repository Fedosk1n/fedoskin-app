// «Город» — мини-игра с видом сверху (owner 13.11.2026). Движок: карта из клеток, камера, туман, путь по тапу, часы, места,
// би-бои. Данные — city-data.js, цифры — city-balance.js. Батлы и шоу идут через rhythm.js (RB.open({ city, onCity })) — без сервера.
// Сохранение — на телефоне (`fedoskin-city`, версия CITY_BAL.save). На уровень героя и общий рейтинг город не влияет.
(function () {
  'use strict';
  const B = window.CITY_BAL, DATA = window.CITY_DATA, KEY = 'fedoskin-city';
  const GFX = window.CITY_GFX, BLOCK = 'F#bGTKSXctDCLBhuPkM', TS = GFX.TS, SPEED = 5.5, SEE = 4.6;
  let D, S, el, can, cx, hud, dlgEl, W = 0, H = 0, dpr = 1, shown = false, timer = 0, raf = 0, last = 0, path = [], goal = null, pend = null;
  let gLook = {}, gangCool = 0, duEl = null, duApi = null, npLook = {}, spEl = null, spApi = null;
  let FREE = [], pkDay = -1, pkList = [], floats = [], walkLook = [];
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
      bruise: 0, fog: {}, npc: {}, spot: {}, got: {}, marks: [], day: {}, intro: 0, tags: {}, pk: { day: -1, got: [] }, goals: { day: -1, list: [] }, dl: { day: -1, n: 0 }, job: null, gear: { own: [], on: {} }, gang: { day: -1, beat: [] }, gw: 0, gwon: {}, buff: {}, tut: 0, word: '', gt: {}, tcap: {}, tall: 0, inc: -1, lastSt: '', lastPal: '' };
  }
  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.v === B.save && DATA.districts[s.d]) return Object.assign(fresh(), s); } catch (_) {}   // older saves get the new fields
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
    hero.x = S.x; hero.y = S.y; cam.x = hero.x; cam.y = hero.y; path = []; npcLook = {}; GFX.setMap(DIST, dpr); freeCells(); pkDay = -1; walkLook = []; gLook = {}; npLook = {}; reveal();
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

  // ---- things to do in the yard (owner 13.11.2026 «добавь активностей… затягивающий») ----
  // free ground cells the hero can reach: the daily finds lie there
  function freeCells() {
    const st = DIST.start, key = (x, y) => y * MW + x, seenC = new Set([key(st[0], st[1])]), q = [st], busyC = new Set();
    DIST.places.forEach(p => busyC.add(key(p.at[0], p.at[1]))); DIST.npcs.forEach(n => busyC.add(key(n.at[0], n.at[1]))); (DIST.drops || []).forEach(p => busyC.add(key(p[0], p[1]))); (DIST.gangs || []).forEach(g => g.spots.forEach(p => busyC.add(key(p[0], p[1]))));
    FREE = [];
    for (let i = 0; i < q.length; i++) { const [x, y] = q[i]; if ('.='.includes(tile(x, y)) && !busyC.has(key(x, y)) && Math.hypot(x - st[0], y - st[1]) > 2) FREE.push([x, y]);
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const k = key(x + dx, y + dy); if (!seenC.has(k) && walk(x + dx, y + dy)) { seenC.add(k); q.push([x + dx, y + dy]); } }); }
  }
  // what lies on the ground today (the same for the whole game day): coins, spray cans, apples
  function picks() {
    const d = dayN(); if (pkDay === d) return pkList;
    pkDay = d; pkList = []; if (S.pk.day !== d) S.pk = { day: d, got: [] };
    const used = new Set(), P = B.pick;
    for (let i = 0; i < P.n && FREE.length; i++) {
      let k = Math.floor(hash(d * 31 + i * 7 + 3, i * 13 + d) * FREE.length), g = 0; while (used.has(k) && g++ < 20) k = (k + 7) % FREE.length; used.add(k);
      const r = hash(d + i * 5, 77 + i), kind = r < P.can ? 'can' : r < P.can + P.snackP ? 'snack' : 'coin';
      pkList.push({ i, x: FREE[k][0], y: FREE[k][1], kind, val: P.coin[0] + Math.floor(hash(i, d + 5) * (P.coin[1] - P.coin[0] + 1)) });
    }
    return pkList;
  }
  const pop = (txt, col) => { floats.push({ x: hero.x, y: hero.y, txt, col: col || '#F2CC55', t: performance.now() }); if (floats.length > 6) floats.shift(); };
  function collect() {
    picks().forEach(k => {
      if (S.pk.got.includes(k.i) || Math.hypot(k.x - hero.x, k.y - hero.y) > .62) return;
      S.pk.got.push(k.i);
      if (k.kind === 'coin') { const v = k.val + perk('coin'); S.cash += v; pop('+' + v + ' 💵'); bump('coins'); }
      else if (k.kind === 'can') { give('can'); pop('+1 🎨', '#7CE0FF'); }
      else { S.en = Math.min(emax(), S.en + B.pick.snack); pop('+' + B.pick.snack + ' ⚡', '#7BE3A0'); }
      hudKey = '';
    });
  }
  // three things to do for every game day: a small prize for each, a better one for all three
  const GOALS = { coins: 'Собери монеты', win: 'Выиграй батл', show: 'Выступи с шоу', deliver: 'Доставь заказ из ларька', stretch: 'Разомнись на площадке', tag: 'Нарисуй граффити', gang: 'Разгони банды' };
  function goals() {
    const d = dayN(); if (S.goals.day === d) return S.goals;
    const pool = ['coins', 'win', 'show', 'deliver', 'stretch'].concat(wallsLeft() || turfs().some(t => !mine(t)) ? ['tag'] : []), list = [{ k: 'gang', a: 0, n: B.goals.gang, done: 0 }];   // one of the three is always about the crews
    for (let i = 0; i < 2; i++) { const k = pool.splice(Math.floor(hash(d * 17 + i, i * 29 + 5) * pool.length), 1)[0]; list.push({ k, a: 0, n: B.goals[k] || 1, done: 0 }); }
    return (S.goals = { day: d, list, all: 0 });
  }
  function bump(k) {
    const G = goals(), g = G.list.find(q => q.k === k && !q.done); if (!g) return;
    g.a++; hudKey = ''; if (g.a < g.n) return;
    g.done = 1; S.cash += B.goals.cash; D.toast('✓ ' + T('Дело сделано: {x}', { x: T(GOALS[k]) }) + ' · +' + B.goals.cash + ' 💵');
    if (!G.all && G.list.every(q => q.done)) { G.all = 1; S.rep += B.goals.rep; const it = ['tape', 'thermos', 'can'][Math.floor(Math.random() * 3)]; give(it);
      setTimeout(() => D.toast('🎁 ' + T('Все дела дня сделаны!') + ' +' + B.goals.rep + ' ★ · ' + T(item(it).name)), 1800); }
    save();
  }
  function goalsDlg() {
    const G = goals();
    dlg(T('Дела на сегодня'), '<ul class="cyls">' + G.list.map(g => '<li>' + (g.done ? '✅ ' : '⬜ ') + '<b>' + T(GOALS[g.k]) + (g.n > 1 ? ' · ' + Math.min(g.a, g.n) + ' / ' + g.n : '') + '</b></li>').join('') + '</ul>' +
      p('<small>' + T('За каждое дело — {n} кэша, за все три — {r} респекта и находка. Завтра будут новые.', { n: B.goals.cash, r: B.goals.rep }) + '</small>'), []);
  }
  // ---- graffiti and the crews' walls (owner 14.11.2026 «граффити по районам… большие классные граффити в разных стилях»; «территории») ----
  // Every crew holds a wall with its own big piece. Beat the crew — the wall stands without guard for a while: paint your piece over theirs
  // (with your own finger) and the point is yours: it brings cash every game day. The crew comes back; not beaten for too long — it takes the wall back.
  // A crew's style opens for the player with the first win over that crew. Small free walls: any open style, respect only.
  const walls = () => DIST.places.filter(p => p.wall), turfs = () => DIST.places.filter(p => p.type === 'turf');
  const gangOf = pl => (DIST.gangs || []).find(g => g.id === pl.gang);
  const mine = pl => !!S.tags[pl.id];
  const wallsLeft = () => DIST.places.filter(p => p.type === 'wall' && !S.tags[p.id]).length;
  const myWord = () => S.word || (D.me() === T('Ты') ? '' : GFX.grafWord(D.me(), 8)) || 'FT';
  const seedOf = pl => pl.at[0] * 7 + pl.at[1] * 13 + 1;
  // what is on the wall now: my piece, the crew's piece, or nothing
  function artOf(pl) {
    const m = S.tags[pl.id];
    if (m) return { word: myWord(), style: m.s || 'tag', pal: m.p || 'fire', extra: 'crown', seed: seedOf(pl) };
    return pl.art ? Object.assign({ seed: seedOf(pl) }, pl.art) : null;
  }
  const STYLE = { tag: 'Тег', bubble: 'Бабл', block: 'Блокбастер', wild: 'Вайлдстайл', d3: '3D' }, PALN = ['fire', 'ice', 'candy', 'chrome', 'toxic', 'sunset'];
  const styleFrom = st => turfs().find(t => t.art.style === st);
  const styleOpen = st => { if (st === 'tag') return true; const t = styleFrom(st); return !t || (S.gwon[t.gang] || 0) > 0; };
  // a wall you can paint right now (owner 14.11.2026 «непонятно, как рисовать и куда подойти»): a crew wall left without guard, or a clean wall
  const paintable = pl => !!pl.wall && !S.tags[pl.id] && (pl.type === 'wall' || (pl.type === 'turf' && openLeft(pl) > 0));
  let wallNear = '', tapFx = null;
  // where to stand to paint a wall: its own cell if you can walk there, else the walkable cell next to it (below first — the wall faces south)
  const standOf = pl => walk(pl.at[0], pl.at[1]) ? pl.at : ([[pl.at[0], pl.at[1] + 1], [pl.at[0] - 1, pl.at[1]], [pl.at[0] + 1, pl.at[1]], [pl.at[0], pl.at[1] - 1]].find(c => walk(c[0], c[1])) || pl.at);
  const openLeft = pl => { const t = S.gt[pl.gang]; return t == null ? 0 : Math.max(0, B.turf.open * 60 - (S.t - t)); };                                   // game minutes the wall stays without guard
  const holdLeft = pl => { const m = S.tags[pl.id]; return m ? Math.max(0, B.turf.hold * 1440 - (S.t - Math.max(m.t || 0, S.gt[pl.gang] || 0))) : 0; };   // game minutes till the crew takes it back
  const incomeOf = pl => { const g = gangOf(pl); return B.turf.income + B.turf.incomeLvl * (g ? g.lvl : 1); };
  const hrs = m => Math.max(1, Math.ceil(m / 60));
  const wallPic = (pl, a) => { const r = GFX.wallRect(pl.id); a = a || artOf(pl); return r && a ? '<div class="cygr"><img alt="" src="' + GFX.graf(Object.assign({ w: r.w, h: r.h, scale: 2 }, a)).toDataURL() + '" style="aspect-ratio:' + r.w + '/' + r.h + '"></div>' : ''; };
  function goPlace(pl) { const way = route([pl.wall ? standOf(pl) : pl.at]); if (!way) return; path = way; goal = () => openPlace(pl); if (!way.length) { goal = null; openPlace(pl); } kick(); }
  let turfMin = -1;
  function turfTick() {
    const m = Math.floor(S.t); if (m === turfMin) return; turfMin = m;
    turfs().forEach(pl => { if (!mine(pl) || holdLeft(pl) > 0) return; delete S.tags[pl.id]; hudKey = ''; D.toast('🏴 ' + T('Банда «{x}» закрасила твоё граффити: {w}. Разгони её и верни точку.', { x: T(gangOf(pl).name), w: T(pl.name) })); save(); });
    const d = dayN(); if (S.inc == null || S.inc < 0) S.inc = d;
    if (d > S.inc) { S.inc = d; const sum = turfs().filter(mine).reduce((a, pl) => a + incomeOf(pl), 0); if (sum) { S.cash += sum; hudKey = ''; pop('+' + sum + ' 💵'); D.toast('👑 ' + T('Твои точки принесли кэш') + ': +' + sum + ' 💵'); save(); } }
  }
  function wallSpot(pl) {
    const turf = pl.type === 'turf', g = turf ? gangOf(pl) : null, m = S.tags[pl.id];
    if (turf && !m) {
      const left = openLeft(pl);
      if (!left) return dlg(T(pl.name), wallPic(pl) + p(T('Это точка банды «{x}». Пока банда на районе, стену не тронуть.', { x: T(g.name) })) +
        p('<small>' + T('Разгони банду в танце — и закрась их граффити своим. Точка станет твоей и будет приносить {n} кэша в день.', { n: incomeOf(pl) }) + '</small>'), []);
      return paintDlg(pl, '🔥 ' + T('Банда разогнана — стена без охраны ещё {h} ч. Закрась их граффити своим!', { h: hrs(left) }));
    }
    if (turf) return dlg(T(pl.name), wallPic(pl) + p('👑 ' + T('Твоя точка: приносит {n} кэша в день.', { n: incomeOf(pl) })) +
      p((holdLeft(pl) < 1440 ? '⚠️ ' : '') + T('Банда «{x}» вернёт стену через {h} ч, если её не разогнать.', { x: T(g.name), h: hrs(holdLeft(pl)) })), [{ t: '🎨 ' + T('Перекрасить'), fn: () => paintDlg(pl) }]);
    if (m) return dlg(T(pl.name), wallPic(pl) + p('👑 ' + T('Твоё граффити. Двор его видит.')), [{ t: '🎨 ' + T('Перекрасить'), fn: () => paintDlg(pl) }]);
    paintDlg(pl);
  }
  // choose what to paint: the word, the style (a crew's style opens when the crew is beaten), the colours — and see it before painting
  function paintDlg(pl, note) {
    path = []; goal = null;
    const r = GFX.wallRect(pl.id), m = S.tags[pl.id], turf = pl.type === 'turf';
    const need = Math.max(1, (m ? B.turf.again : turf ? B.turf.cans : B.tag.cans) - perk('can')), have = S.inv.can || 0, open = GFX.GRAF_STYLES.filter(styleOpen);
    let st = (m && m.s) || S.lastSt || open[open.length - 1]; if (!styleOpen(st)) st = open[open.length - 1]; let pal = (m && m.p) || S.lastPal || 'fire';
    const art = () => ({ word: myWord(), style: st, pal, extra: 'crown', seed: seedOf(pl) });
    const pic = () => GFX.graf(Object.assign({ w: r.w, h: r.h, scale: 2 }, art())).toDataURL();
    const paint = () => {
      dlgEl.innerHTML = '<div class="cyd"><h3>' + esc(T(pl.name)) + '</h3><div class="cydb">' + (note ? p(note) : '') +
        '<div class="cygr"><img alt="" id="cyGrP" src="' + pic() + '" style="aspect-ratio:' + r.w + '/' + r.h + '"></div>' +
        '<label class="cywd"><span>' + T('Что пишем') + '</span><input id="cyWord" maxlength="8" autocomplete="off" autocapitalize="characters" spellcheck="false" value="' + esc(myWord()) + '"></label>' +
        '<div class="cych">' + GFX.GRAF_STYLES.map(k => '<button type="button" class="cychip' + (k === st ? ' on' : '') + (styleOpen(k) ? '' : ' lock') + '" data-st="' + k + '">' + (styleOpen(k) ? '' : '🔒 ') + T(STYLE[k]) + '</button>').join('') + '</div>' +
        '<div class="cych">' + PALN.map(k => { const P = GFX.GRAF_PALS[k]; return '<button type="button" class="cysw' + (k === pal ? ' on' : '') + '" data-pal="' + k + '" aria-label="' + k + '" style="background:linear-gradient(135deg,' + P.b + ' 0 34%,' + P.a + ' 34% 67%,' + P.bg + ' 67%)"></button>'; }).join('') + '</div>' +
        '<p class="cyln" id="cyStN">' + (have < need ? T('Баллончики лежат по двору, падают с банд и продаются в палатке.') : '&nbsp;') + '</p></div><div class="cybt">' +
        '<button type="button" class="btn btn-accent" id="cyPaint"' + (have < need ? ' disabled' : '') + '>🎨 ' + T('Рисовать') + ' · ' + T('баллончиков: {n}, у тебя {a}', { n: need, a: have }) + '</button>' +
        '<button type="button" class="btn btn-ghost" id="cyPClose">' + T('Закрыть') + '</button></div></div>';
      dlgEl.hidden = false;
      const inp = dlgEl.querySelector('#cyWord');
      inp.addEventListener('input', () => { S.word = GFX.grafWord(inp.value, 8); dlgEl.querySelector('#cyGrP').src = pic(); });
      inp.addEventListener('change', () => { inp.value = myWord(); save(); });
      dlgEl.querySelectorAll('[data-st]').forEach(b => b.addEventListener('click', () => { const k = b.dataset.st;
        if (!styleOpen(k)) { dlgEl.querySelector('#cyStN').textContent = '🔒 ' + T('Стиль «{s}» откроется, когда разгонишь банду «{x}».', { s: T(STYLE[k]), x: T(gangOf(styleFrom(k)).name) }); return; } st = k; paint(); }));
      dlgEl.querySelectorAll('[data-pal]').forEach(b => b.addEventListener('click', () => { pal = b.dataset.pal; paint(); }));
      dlgEl.querySelector('#cyPClose').addEventListener('click', () => { dlgEl.hidden = true; paintHud(); save(); });
      dlgEl.querySelector('#cyPaint').addEventListener('click', () => { dlgEl.hidden = true; S.lastSt = st; S.lastPal = pal; save(); sprayGame(pl, art(), stars => painted(pl, st, pal, need, stars)); });
    };
    paint();
  }
  function painted(pl, st, pal, need, stars) {
    const turf = pl.type === 'turf', g = turf ? gangOf(pl) : null, m = S.tags[pl.id], first = !m, lines = []; let rep = 0, drop = null;
    S.inv.can = Math.max(0, (S.inv.can || 0) - need); S.tags[pl.id] = { s: st, p: pal, t: m && m.t ? m.t : S.t }; bump('tag');
    if (turf && first) { rep = S.tcap[pl.id] ? B.turf.repAgain : B.turf.rep + B.turf.repLvl * g.lvl; S.tcap[pl.id] = 1;
      lines.push('👑 ' + T('Точка твоя: приносит {n} кэша в день.', { n: incomeOf(pl) })); lines.push(T('Банда «{x}» вернёт стену через {h} ч, если её не разогнать.', { x: T(g.name), h: hrs(holdLeft(pl)) })); }
    else if (first) { rep = B.tag.rep; if (!wallsLeft()) { rep += B.tag.all; lines.push('👑 ' + T('Все чистые стены двора — твои!')); } }
    if (stars === 3) { rep += B.turf.clean; lines.unshift('✨ ' + T('Чистая работа: ровно и без потёков')); }
    if (turf && !S.tall && turfs().every(mine)) { S.tall = 1; rep += B.turf.all; lines.push('🏆 ' + T('Весь двор в твоих граффити!')); if (GEAR.writerKicks && !S.gear.own.includes('writerKicks')) { drop = 'writerKicks'; S.gear.own.push(drop); } }
    S.rep += rep; hudKey = ''; save();
    dlg(T('Граффити готово!'), wallPic(pl) + res(0, rep, lines) + (drop ? p('🎁 ' + T('Новая шмотка!')) + gearCard(drop) : ''), drop ? [{ t: T('Надеть'), cls: 'btn-accent', fn: () => wear(drop) }] : []);
  }
  // painting with your own finger: the piece shows up where you spray; fill it all. Standing still makes the paint run.
  function sprayGame(pl, art, done) {
    path = []; goal = null; joy = null;
    const r = GFX.wallRect(pl.id), Q = B.turf, box = el.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
    const cw = Math.floor(Math.min(box.width - 20, 560, Math.max(120, box.height - padB - 250) * r.w / r.h)), ch = Math.round(cw * r.h / r.w), sc = cw / r.w * d;
    spEl.innerHTML = '<div class="cysp-top"><b>' + esc(T(pl.name)) + '</b><small>' + T('Води пальцем по бледному рисунку, пока он не проявится целиком. Не задерживай палец на месте — краска потечёт.') + '</small></div>' +
      '<div class="cysp-wall"><canvas id="cySpC" style="width:' + cw + 'px;height:' + ch + 'px"></canvas><div class="cysp-hint" id="cySpH"><i>👆</i><span>' + T('Води пальцем здесь') + '</span></div></div>' +
      '<div class="cysp-row"><span class="cysp-l">' + T('Закрашено') + '</span><div class="cysp-bar cov"><i id="cySpC2" style="width:0"></i></div><b id="cySpN">0 %</b></div>' +
      '<div class="cysp-row"><span class="cysp-l">' + T('Краска') + '</span><div class="cysp-bar"><i id="cySpP"></i></div><b></b></div>' +
      '<div class="cybt"><button type="button" class="btn btn-accent" id="cySpOk" style="visibility:hidden">' + T('Готово') + '</button><button type="button" class="btn btn-ghost" id="cySpNo">' + T('Отмена') + '</button></div>';
    spEl.hidden = false;
    const cv = spEl.querySelector('#cySpC'), c = cv.getContext('2d'); cv.width = Math.round(cw * d); cv.height = Math.round(ch * d);
    const big = a => GFX.graf(Object.assign({}, a, { w: r.w, h: r.h, scale: sc })), P = big(art), old = artOf(pl), O = old ? big(old) : null, PAL = GFX.GRAF_PALS[art.pal] || GFX.GRAF_PALS.fire;
    const M = document.createElement('canvas'), TM = document.createElement('canvas'); M.width = TM.width = cv.width; M.height = TM.height = cv.height; const mc = M.getContext('2d'), tc = TM.getContext('2d');
    // which parts of the wall the piece covers — a coarse grid; the brush marks the cells it has passed
    const GS = 5, gw = Math.ceil(cw / GS), gh = Math.ceil(ch / GS), sm = document.createElement('canvas'); sm.width = gw; sm.height = gh; const sq = sm.getContext('2d'); sq.drawImage(P, 0, 0, gw, gh);
    const al = sq.getImageData(0, 0, gw, gh).data, need = new Uint8Array(gw * gh), got = new Uint8Array(gw * gh); let total = 0, hit = 0;
    for (let i = 0; i < gw * gh; i++) if (al[i * 4 + 3] > 60) { need[i] = 1; total++; }
    const R0 = Math.max(15, Math.min(30, ch * .17)), budget = cw * ch / (R0 * 1.6) * Q.paint, runs = [];   // paint: Q.paint times what one neat pass over the whole wall takes
    let used = 0, on = false, lx = 0, ly = 0, still = 0, over = false, fin = 0, dirty = true, t0 = performance.now();
    const cov = () => total ? hit / total : 1;
    const dot = (x, y) => {
      const g = mc.createRadialGradient(x * d, y * d, 0, x * d, y * d, R0 * d); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.62, 'rgba(255,255,255,.95)'); g.addColorStop(1, 'rgba(255,255,255,0)'); mc.fillStyle = g; mc.beginPath(); mc.arc(x * d, y * d, R0 * d, 0, 7); mc.fill();
      const rr = R0 * .8, x0 = Math.max(0, Math.floor((x - rr) / GS)), x1 = Math.min(gw - 1, Math.floor((x + rr) / GS)), y0 = Math.max(0, Math.floor((y - rr) / GS)), y1 = Math.min(gh - 1, Math.floor((y + rr) / GS));
      for (let b = y0; b <= y1; b++) for (let a = x0; a <= x1; a++) { const i = b * gw + a; if (need[i] && !got[i] && Math.hypot((a + .5) * GS - x, (b + .5) * GS - y) <= rr) { got[i] = 1; hit++; } }
      dirty = true;
    };
    const hud2 = () => { spEl.querySelector('#cySpP').style.width = cl(100 - used / budget * 100, 0, 100) + '%'; const pc = Math.min(100, Math.round(cov() * 100 / .97)); spEl.querySelector('#cySpN').textContent = pc + ' %'; spEl.querySelector('#cySpC2').style.width = pc + '%'; spEl.querySelector('#cySpOk').style.visibility = cov() < Q.min || over ? 'hidden' : 'visible'; };   // (keeps its room: the wall must not jump under the finger)
    const close = () => { on = false; if (D.RB.hiss) D.RB.hiss(false); spEl.hidden = true; spEl.innerHTML = ''; spApi = null; paintHud(); kick(); };
    const finish = () => { if (over) return; over = true; on = false; if (D.RB.hiss) D.RB.hiss(false); fin = performance.now(); hud2();
      if (cov() < Q.min) { setTimeout(() => { close(); D.toast('🎨 ' + T('Краска кончилась раньше, чем рисунок. Попробуй ещё раз — баллончики целы.')); }, 500); return; }
      const stars = cov() >= Q.full && runs.length <= Q.drips ? 3 : cov() >= .8 ? 2 : 1; if (navigator.vibrate) try { navigator.vibrate(30); } catch (_) {}
      setTimeout(() => { close(); done(stars); }, 1150); };
    const at = e => { const q = cv.getBoundingClientRect(); return [cl(e.clientX - q.left, 0, cw), cl(e.clientY - q.top, 0, ch)]; };
    const spray = (x, y) => { if (over) return; const dist = Math.hypot(x - lx, y - ly), n = Math.max(1, Math.ceil(dist / (R0 * .3))); for (let i = 1; i <= n; i++) dot(lx + (x - lx) * i / n, ly + (y - ly) * i / n); used += dist; if (dist > 2) still = performance.now(); lx = x; ly = y; hud2(); if (used >= budget || cov() >= .97) finish(); };
    cv.onpointerdown = e => { if (over) return; e.preventDefault(); const hh = spEl.querySelector('#cySpH'); if (hh) hh.remove(); on = true; [lx, ly] = at(e); still = performance.now(); dot(lx, ly); used += R0 * .5; if (D.RB.hiss) D.RB.hiss(true); try { cv.setPointerCapture(e.pointerId); } catch (_) {} hud2(); };
    cv.onpointermove = e => { if (!on) return; let ev = []; try { ev = e.getCoalescedEvents ? e.getCoalescedEvents() : []; } catch (_) {} if (!ev.length) ev = [e]; ev.forEach(q => { const [x, y] = at(q); spray(x, y); }); };   // every point of the finger's way, not only the last one of a frame
    cv.onpointerup = cv.onpointercancel = () => { on = false; if (D.RB.hiss) D.RB.hiss(false); };
    spEl.querySelector('#cySpNo').addEventListener('click', () => { over = true; close(); });
    spEl.querySelector('#cySpOk').addEventListener('click', finish);
    const loop = now => {
      if (spEl.hidden || !cv.isConnected) return;
      if (on && !over && now - still > 600) { runs.push({ x: lx, y: ly, len: 26 + Math.random() * 40, t: now }); still = now + 500; used += budget * .03; hud2(); if (navigator.vibrate) try { navigator.vibrate(15); } catch (_) {} if (used >= budget) finish(); }   // stood still: the paint runs
      if (dirty || on || over || runs.some(q => now - q.t < 900)) {
        dirty = false; c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#8F8E8A'; c.fillRect(0, 0, cv.width, cv.height);
        c.fillStyle = 'rgba(0,0,0,.1)'; for (let y = 7 * d; y < cv.height; y += 7 * d) c.fillRect(0, y, cv.width, d); for (let y = 0, j = 0; y < cv.height; y += 7 * d, j++) for (let x = (j % 2) * 9 * d; x < cv.width; x += 18 * d) c.fillRect(x, y, d, 7 * d);
        if (O) { c.globalAlpha = .8; c.drawImage(O, 0, 0); c.globalAlpha = 1; }
        c.globalAlpha = .2 + .06 * Math.sin((now - t0) / 300); c.drawImage(P, 0, 0); c.globalAlpha = 1;                                                              // a faint sketch: where to paint
        tc.globalCompositeOperation = 'source-over'; tc.clearRect(0, 0, TM.width, TM.height); tc.drawImage(M, 0, 0); tc.globalCompositeOperation = 'source-in'; tc.drawImage(P, 0, 0); c.drawImage(TM, 0, 0);
        runs.forEach(q => { const u = Math.min(1, (now - q.t) / 900); c.strokeStyle = PAL.a; c.lineCap = 'round'; c.lineWidth = 4 * d; c.beginPath(); c.moveTo(q.x * d, q.y * d); c.lineTo(q.x * d, (q.y + q.len * u) * d); c.stroke(); c.fillStyle = PAL.a; c.beginPath(); c.arc(q.x * d, (q.y + q.len * u) * d, 3.2 * d, 0, 7); c.fill(); });
        if (over && cov() >= Q.min) { const u = Math.min(1, (now - fin) / 450); c.fillStyle = '#8F8E8A'; c.globalAlpha = u; c.fillRect(0, 0, cv.width, cv.height); c.drawImage(P, 0, 0); c.globalAlpha = Math.max(0, .7 * (1 - (now - fin) / 380)); c.fillStyle = '#fff'; c.fillRect(0, 0, cv.width, cv.height); c.globalAlpha = 1; }
        else if (on) { c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 1.5 * d; c.beginPath(); c.arc(lx * d, ly * d, R0 * .8 * d, 0, 7); c.stroke(); for (let i = 0; i < 6; i++) { const a = Math.random() * 7, q = R0 * (.8 + Math.random() * .5); c.fillStyle = PAL.a; c.fillRect((lx + Math.cos(a) * q) * d, (ly + Math.sin(a) * q) * d, 1.6 * d, 1.6 * d); } }
      }
      requestAnimationFrame(loop);
    };
    spApi = { rect: () => { const q = cv.getBoundingClientRect(); return { x: q.left, y: q.top, w: q.width, h: q.height }; }, cov, used: () => used / budget, runs: () => runs.length, miss: () => { const o = []; for (let i = 0; i < gw * gh; i++) if (need[i] && !got[i]) o.push([i % gw, Math.floor(i / gw)]); return { gw, gh, cw, ch, R0, o }; } };
    hud2(); requestAnimationFrame(loop);
  }
  // a delivery from the kiosk: run to the door before the food gets cold (the timer runs in real seconds)
  function jobsLeft() { if (S.dl.day !== dayN()) S.dl = { day: dayN(), n: 0 }; return B.job.perDay - S.dl.n; }
  function takeJob() {
    const J = B.job, drops = (DIST.drops || []).map(to => ({ to, way: route([to]) })).filter(q => q.way && q.way.length > 8); if (!drops.length) return;
    const pick = drops[Math.floor(Math.random() * drops.length)], len = pick.way.length, sec = Math.round(J.secBase + J.secCell * len);
    jobsLeft(); S.dl.n++; S.en = Math.max(0, S.en - J.energy);
    S.job = { to: pick.to, left: sec, all: sec, pay: Math.round(J.base + J.perCell * len) };
    D.toast('🌯 ' + T('Отнеси заказ, пока не остыл: {s} с. Смотри на стрелку.', { s: sec }));
  }
  function jobTick(dt) {
    const j = S.job; if (!j) return;
    if (Math.hypot(j.to[0] - hero.x, j.to[1] - hero.y) < .7) {
      const tip = j.left / j.all > B.job.tipLeft ? B.job.tip : 0; S.cash += j.pay + tip; S.job = null; hudKey = '';
      pop('+' + (j.pay + tip) + ' 💵'); D.toast('🌯 ' + T('Заказ доставлен') + ': +' + j.pay + ' 💵' + (tip ? ' · ' + T('Чаевые за скорость') + ' +' + tip : '')); bump('deliver'); save(); return;
    }
    if (!dlgEl.hidden) return;   // the timer waits while a window is open
    j.left -= dt; if (j.left <= 0) { S.job = null; hudKey = ''; D.toast('🥶 ' + T('Заказ остыл — клиент не заплатил')); save(); }
  }
  // residents walk along the pavements there and back (only a picture)
  function walkerAt(w, now) {
    const P = w.path; let len = 0; const segs = []; for (let i = 1; i < P.length; i++) { const l = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); segs.push(l); len += l; }
    let u = (now / 1000 * w.speed + w.path[0][0] * 3) % (2 * len); const back = u > len; if (back) u = 2 * len - u;
    for (let i = 0; i < segs.length; i++) { if (u <= segs[i] || i === segs.length - 1) { const k = Math.min(1, u / segs[i]), a = P[i], b = P[i + 1], dx = (b[0] - a[0]) * (back ? -1 : 1), dy = (b[1] - a[1]) * (back ? -1 : 1);
      return { x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k, dir: dirOf(dx, dy), d: now / 1000 * w.speed }; } u -= segs[i]; }
  }

  // ---- crews on the streets (owner 13.11.2026 «как крипы, но без убийств: победил в танце — банда исчезает и тебе что-то достаётся») ----
  // gear: unique clothes that only drop in the city; each has a look (seen on the hero) and one small perk
  const GEAR = DATA.gear || {}, RAR = ['обычная', 'редкая', 'эпическая', 'легендарная'], RARC = ['#C9CCD2', '#4FC0FF', '#C58CFF', '#FFD23F'];
  const PERK = { time: '+{n} % времени в стычках', life: '+{n} жизнь в стычках', cash: '+{n} % кэша со стычек', rep: '+{n} респекта за разогнанную банду', show: '+{n} % в шляпу на шоу', en: 'Стычка стоит на {n} энергии меньше', coin: 'Монеты на земле: +{n}', can: 'Граффити стоит на {n} баллончик меньше' };
  const gearOn = () => Object.keys(S.gear.on).map(k => GEAR[S.gear.on[k]]).filter(Boolean);
  const perk = k => gearOn().reduce((a, g) => a + (g.perk && g.perk[0] === k ? g.perk[1] : 0), 0);
  const perkTxt = g => g.perk ? T(PERK[g.perk[0]], { n: g.perk[1] }) : '';
  const gearCard = id => { const g = GEAR[id]; return '<div class="cygear" style="--rc:' + RARC[g.rar] + '"><b>' + g.ico + ' ' + T(g.name) + '</b><small>' + T(RAR[g.rar]) + ' · ' + perkTxt(g) + '</small></div>'; };
  const wear = id => { const g = GEAR[id]; if (S.gear.on[g.slot] === id) delete S.gear.on[g.slot]; else S.gear.on[g.slot] = id; lookKey = ''; };
  const djOn = () => S.buff.dj === dayN();
  // which crews are out now: every game day they come back, at one of their spots; they grow as you win
  function gangsNow() {
    const d = dayN(), h = hour(); if (S.gang.day !== d) S.gang = { day: d, beat: [] };
    return (DIST.gangs || []).filter(g => !S.gang.beat.includes(g.id) && inH(h, g.hours)).map(g => {
      const sp = !S.tut && g.tut ? g.spots[0] : g.spots[Math.floor(hash(d * 7 + g.lvl, g.lvl * 13 + 1) * g.spots.length)];
      return { g, x: sp[0], y: sp[1], lvl: Math.min(10, g.lvl + Math.floor(S.gw / B.duel.grow)), size: Math.min(5, 2 + Math.floor(g.lvl / 2) + Math.floor(S.gw / (B.duel.grow * 2))) };
    });
  }
  function gangLook(g, k) {
    const key = g.id + k; if (gLook[key]) return gLook[key];
    const f = window.HERO.topDown(1 + (k + g.lvl) % 5, k % 3 === 1 ? ['girl'] : []); f.col = Object.assign({}, f.col, { top: g.col, sleeve: k % 2 ? g.col : null, hat: [g.col2 || '#18181B', g.col], shoe: g.col, shoe2: '#F2EFE8' }); if (!f.hat) f.hat = k % 2 ? 'cap' : 'beanie';
    return (gLook[key] = { key: 'g:' + key, f, big: .96 });
  }
  function openGang(G) {
    gangCool = performance.now() + 7000;
    const cost = Math.max(1, B.duel.energy - perk('en'));
    dlg(T(G.g.name), say(T(G.g.name), G.g.taunt) + p('<small>' + T('Уровень {n}', { n: G.lvl }) + ' · ' + '🕺'.repeat(G.size) + ' · ' + T('батл −{n} ⚡', { n: cost }) + '</small>') +
      p('<small>' + T('Чем выше уровень героя из уроков, тем больше времени на каждое движение.') + '</small>'), [
      { t: '🔥 ' + T('В круг!'), cls: 'btn-accent', off: S.en < cost, fn: () => fight(G, cost) },
      S.en < cost ? { t: T('Мало энергии — поешь или выспись'), off: true } : null].filter(Boolean));
  }
  function fight(G, cost) {
    const tut = !S.tut && !!G.g.tut; S.en = Math.max(0, S.en - cost);
    duel({ name: T(G.g.name), col: G.g.col, lvl: G.lvl, size: tut ? 2 : G.size, tut, onEnd: (won, perf, total) => {
      gangCool = performance.now() + 5000;
      if (!won) { dlg(T(G.g.name), p('😤 ' + T('Банда устояла. Попробуй ещё раз.')) + p('<small>' + T('Чем выше уровень героя из уроков, тем больше времени на каждое движение.') + '</small>'), [{ t: '🔥 ' + T('В круг!'), cls: 'btn-accent', off: S.en < cost, fn: () => fight(G, cost) }, D.home && { t: T('К урокам'), fn: () => D.home() }].filter(Boolean)); return; }
      const Q = B.duel, q = perf / total, cash = Math.round((Q.cash + Q.cashLvl * G.lvl) * (1 + q * .5) * (1 + perk('cash') / 100)), rep = Q.rep + Math.floor(G.lvl / 2) + perk('rep'), lines = [];
      const tw = turfs().find(t => t.gang === G.g.id), newSt = tw && !S.gwon[G.g.id] ? tw.art.style : '';
      S.tut = 1; S.cash += cash; S.rep += rep; S.gang.beat.push(G.g.id); S.gw++; S.gt[G.g.id] = S.t; pop('💨', '#F2EFE8');
      const left = (G.g.gear || []).filter(id => !S.gear.own.includes(id)), drop = left.length && (!S.gwon[G.g.id] || Math.random() < Q.drop) ? left[0] : null;
      S.gwon[G.g.id] = (S.gwon[G.g.id] || 0) + 1; if (drop) S.gear.own.push(drop);
      if (Math.random() < Q.can) { give('can'); lines.push(found('can')); }
      if (q >= .8) lines.unshift('✨ ' + T('Чистая работа: бонус к кэшу'));
      if (tut) { for (let i = 0; i < B.turf.start; i++) give('can'); lines.push('🎨 ' + T('Банда бросила баллончики') + ': +' + B.turf.start); }
      if (newSt) { S.lastSt = newSt; lines.push('🎨 ' + T('Новый стиль граффити: {x}', { x: T(STYLE[newSt]) })); }   // the new style is the one offered first at the wall
      if (tw) lines.push(mine(tw) ? '👑 ' + T('Точка «{w}» остаётся твоей.', { w: T(tw.name) }) : '🔥 ' + T('Их стена теперь без охраны — закрась её своим граффити.'));
      bump('gang'); save();
      dlg(T('Банда «{x}» разогнана!', { x: T(G.g.name) }), res(cash, rep, lines) + (drop ? p('🎁 ' + T('Новая шмотка!')) + gearCard(drop) : ''), [drop && { t: T('Надеть'), cls: 'btn-accent', fn: () => wear(drop) }, tw && !mine(tw) && { t: '🎨 ' + T('К стене банды'), cls: drop ? '' : 'btn-accent', fn: () => goPlace(tw) }].filter(Boolean));
    } });
  }
  // the quick dance-off: swipe where the arrow points before the ring closes; the last move is a freeze — press and hold
  function duel(o) {
    path = []; goal = null; joy = null;
    const Q = B.duel, hl = D.level(), per = o.tut ? Q.tutMs : Math.max(Q.msMin, Q.ms - Q.msLvl * (o.lvl - 1)) * cl(1 + Q.lvlK * (hl - o.lvl), .8, 1.4) * (1 + perk('time') / 100) * (djOn() ? 1 + Q.dj : 1);
    const nPer = o.tut ? 3 : Math.min(6, 3 + Math.floor(o.lvl / 2)), seq = [];
    for (let m = 0; m < o.size; m++) for (let i = 0; i < nPer; i++) { let d = 'urdl'[Math.floor(Math.random() * 4)]; if (seq.length && seq[seq.length - 1].d === d) d = 'urdl'['urdl'.indexOf(d) + 1 & 3]; seq.push({ m, d: m === o.size - 1 && i === nPer - 1 ? 'h' : d }); }
    let i = -1, lives = (o.tut ? 5 : Q.lives) + perk('life'), combo = 0, perf = 0, t0 = 0, live = false, hold = 0, sx = 0, sy = 0, used = false, over = false;
    const HR = window.HERO, MV = HR.MOVES, opL = cl(o.lvl + 1, 1, 8);
    duEl.innerHTML = '<div class="cydu-top"><b style="color:' + o.col + '">' + esc(o.name) + '</b><span id="cyDuP"></span></div>' +
      '<div class="cydu-st"><div class="cydu-f me">' + HR.svg(cl(hl, 1, 8), { rig: true, acc: D.look(), uid: 'cdA', size: 150 }) + '</div><div class="cydu-vs">VS</div><div class="cydu-f op">' + HR.svg(opL, { rig: true, acc: o.lvl > 2 ? ['bandana'] : [], uid: 'cdB', size: 150 }) + '</div></div><div class="cydu-mid"><div class="cydu-ring" id="cyDuR"><div class="cydu-in" id="cyDuI"><span id="cyDuA"></span></div></div><div class="cydu-msg" id="cyDuM">&nbsp;</div><div class="cydu-hint" id="cyDuH"></div></div><div class="cydu-bot"><span id="cyDuL"></span><span id="cyDuC"></span></div>';
    duEl.hidden = false; duEl.style.setProperty('--gc', o.col);
    // the two dancers on the stage: mine does a move for every swipe, theirs taunts, loses, the next one steps in
    const fig = (sel, base) => { const el = duEl.querySelector(sel + ' svg'); let J = null; try { J = el && HR.rigJoints(el); } catch (_) {} return { J, mv: base, base, t0: performance.now(), loop: true }; };
    const FA = fig('.cydu-f.me', 'bounce'), FB = fig('.cydu-f.op', 'toprock');
    const mv = (F, name, loop) => { if (!MV[name]) name = F.base; F.mv = name; F.loop = !!loop; F.t0 = performance.now(); };
    const pose = (F, now) => { if (!F.J) return; let M = MV[F.mv] || MV.idle, u = (now - F.t0) / 1000 / M.dur; if (u >= 1 && !F.loop) { F.mv = F.base; F.loop = true; F.t0 = now; M = MV[F.mv] || MV.idle; u = 0; }
      if (F.loop && F.mv === F.base) { const nb = Math.max(1, Math.round(M.dur * 1000 / spb)); u = (((now - b0) / spb / nb) % 1 + 1) % 1; }   // the steps a dancer repeats go in time with the beat
      try { HR.setPose(F.J, M.f(u % 1)); } catch (_) {} };
    const BEATS = (D.RB.BEATS || []), beat = BEATS.length ? BEATS[Math.min(BEATS.length - 1, Math.floor((o.lvl - 1) / 2))] : null, stopJam = (D.RB.bgm && D.RB.bgm(false), D.RB.jam && beat ? D.RB.jam(beat.id, 32) : null);
    // in time with the beat (owner 14.11.2026): every arrow jumps out exactly on a beat or half a beat, the dancers and the stage move to it.
    // No sound (muted phone) — the same grid runs silently.
    const spb = stopJam && stopJam.spb ? stopJam.spb : 60000 / ((beat && beat.bpm) || 100), b0 = stopJam && stopJam.t0 ? stopJam.t0 : performance.now() + 60;
    const onGrid = t => b0 + Math.ceil((t - b0) / (spb / 2) - 1e-6) * spb / 2;
    let wait = 0;
    const $d = q => duEl.querySelector(q), ring = $d('#cyDuR'), inn = $d('#cyDuI'), arr = $d('#cyDuA'), msg = $d('#cyDuM'), SH = ['YEAH!', 'OOOH!', 'FIRE!', 'CLEAN!', 'FRESH!'];
    const paint = () => { const m = i < 0 ? 0 : seq[Math.min(i, seq.length - 1)].m; $d('#cyDuP').textContent = '✓'.repeat(m) + '🕺'.repeat(o.size - m); $d('#cyDuL').textContent = '🔥'.repeat(Math.max(0, lives)); $d('#cyDuC').textContent = combo > 1 ? 'COMBO ×' + combo : ''; };
    const end = won => { over = true; duApi = null; window.removeEventListener('keydown', key); mv(FA, won ? 'win' : 'lose', true); mv(FB, won ? 'lose' : 'win', true); const t9 = performance.now(), fin = now => { pose(FA, now); pose(FB, now); if (now - t9 < 1100 && !duEl.hidden) requestAnimationFrame(fin); }; requestAnimationFrame(fin); if (stopJam) setTimeout(stopJam, 700); setTimeout(() => { duEl.hidden = true; duEl.innerHTML = ''; paintHud(); o.onEnd(won, perf, seq.length); kick(); }, won ? 1150 : 900); };
    const next = () => { if (over) return; i++; if (i >= seq.length) { msg.textContent = 'FREEZE!'; msg.className = 'cydu-msg ok big'; return end(true); }
      const n = seq[i]; arr.textContent = { u: '↑', r: '→', d: '↓', l: '←', h: '✊' }[n.d]; arr.className = 'd' + n.d; inn.style.setProperty('--h', 0); ring.style.setProperty('--u', 0);
      $d('#cyDuH').textContent = n.d === 'h' ? T('Нажми и держи — фриз!') : (o.tut || i < 2 ? T('Свайпай в сторону стрелки, пока кольцо не сомкнулось') : ''); hold = 0; paint();
      t0 = onGrid(performance.now() + 40); wait = t0; arr.style.opacity = 0; };   // the arrow waits for the beat
    const hit = ok => { if (!live || over) return; live = false; const n = seq[i];
      if (ok) { const fast = performance.now() - t0 < per * .55; combo++; if (fast || n.d === 'h') perf++; msg.textContent = n.d === 'h' ? 'FREEZE!' : fast ? (combo > 2 ? SH[Math.floor(Math.random() * SH.length)] : 'PERFECT') : 'GOOD'; msg.className = 'cydu-msg ok' + (fast ? ' big' : ''); arr.className += ' hit'; mv(FA, { u: 'toprock', d: 'sixstep', l: 'windmill', r: 'swipe', h: 'freeze' }[n.d], n.d === 'h'); if (seq[i + 1] && seq[i + 1].m !== n.m) { mv(FB, 'lose'); setTimeout(() => { if (!over) mv(FB, ['toprock', 'kickstep', 'salsa', 'indian'][seq[i + 1].m % 4], true); FB.base = FB.mv; }, 560); } }
      else { lives--; combo = 0; msg.textContent = 'MISS'; msg.className = 'cydu-msg bad'; mv(FA, 'shock'); mv(FB, 'burn'); duEl.classList.remove('shake'); void duEl.offsetWidth; duEl.classList.add('shake'); if (navigator.vibrate) try { navigator.vibrate(40); } catch (_) {} if (lives <= 0) { paint(); return end(false); } }
      paint(); setTimeout(next, seq[i + 1] && seq[i + 1].m !== n.m ? 480 : 110); };
    const tick = now => { if (over) return; pose(FA, now); pose(FB, now); { const ph = (((now - b0) / spb) % 1 + 1) % 1; duEl.style.setProperty('--bp', ((1 - ph) * (1 - ph)).toFixed(3)); }
      if (wait && now >= wait) { wait = 0; live = true; arr.style.opacity = 1; arr.classList.remove('pop'); void arr.offsetWidth; arr.classList.add('pop'); }
      if (live) { const n = seq[i], u = (now - t0) / (n.d === 'h' ? per * 1.7 : per); ring.style.setProperty('--u', Math.min(1, u)); if (n.d === 'h' && hold) { const hu = (now - hold) / Q.holdMs; inn.style.setProperty('--h', Math.min(1, hu)); if (hu >= 1) hit(true); } if (live && u >= 1) hit(false); } requestAnimationFrame(tick); };
    const key = e => { const d = { ArrowUp: 'u', ArrowRight: 'r', ArrowDown: 'd', ArrowLeft: 'l' }[e.key]; if (d && live && seq[i].d !== 'h') hit(d === seq[i].d); if (e.key === ' ' && live && seq[i].d === 'h' && !hold) hold = performance.now(); };
    duEl.style.setProperty('--bp', 0);
    duEl.onpointerdown = e => { sx = e.clientX; sy = e.clientY; used = false; if (live && seq[i].d === 'h') { hold = performance.now(); mv(FA, 'freeze', true); } try { duEl.setPointerCapture(e.pointerId); } catch (_) {} };
    duEl.onpointermove = e => { if (used || !live || seq[i].d === 'h') return; const dx = e.clientX - sx, dy = e.clientY - sy; if (Math.hypot(dx, dy) < 26) return; used = true; hit((Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : (dy > 0 ? 'd' : 'u')) === seq[i].d); };
    duEl.onpointerup = duEl.onpointercancel = () => { if (live && seq[i] && seq[i].d === 'h') { hold = 0; inn.style.setProperty('--h', 0); mv(FA, FA.base, true); } };
    window.addEventListener('keydown', key);
    duApi = { need: () => live ? seq[i].d : '', hit: d => hit(d === seq[i].d), left: () => seq.length - i, grid: () => ({ spb, b0, t0 }) };
    paint(); setTimeout(next, 500); requestAnimationFrame(tick);
  }
  // the MC runs the cypher: crews come out one after another, no rest; the prize is his
  function mcSpot(pl) {
    if (daily('mc')) return dlg(T(pl.name), p(T('Сегодня сайфер уже был. Приходи завтра.')), []);
    const cost = B.duel.cypher.energy, lvl = Math.max(1, ...gangsNow().map(G => G.lvl), 1 + Math.floor(S.gw / B.duel.grow));
    dlg(T(pl.name), say(T(pl.name), 'Сайфер! Банды выходят одна за другой, без передышки. Выстоишь — приз твой.') + p('<small>' + T('Уровень {n}', { n: lvl }) + ' · ' + '🕺'.repeat(5) + ' · ' + T('батл −{n} ⚡', { n: cost }) + '</small>'), [
      { t: '🎤 ' + T('Войти в сайфер'), cls: 'btn-accent', off: S.en < cost, fn: () => { S.en -= cost; mark('mc');
        duel({ name: T(pl.name), col: '#FFD23F', lvl, size: 5, onEnd: (won, perf, total) => {
          if (!won) return dlg(T(pl.name), p('😤 ' + T('Банда устояла. Попробуй ещё раз.')), []);
          const C = B.duel.cypher, cash = Math.round((C.cash + C.cashLvl * lvl) * (1 + perk('cash') / 100)); S.cash += cash; S.rep += C.rep;
          const left = (pl.gear || []).filter(id => !S.gear.own.includes(id)), drop = left[0] || null; if (drop) S.gear.own.push(drop); save();
          dlg('🎤 ' + T('Сайфер пройден!'), res(cash, C.rep, []) + (drop ? gearCard(drop) : ''), drop ? [{ t: T('Надеть'), cls: 'btn-accent', fn: () => wear(drop) }] : []);
        } }); } }]);
  }
  // a runner on a bar: press when it is in the green zone, N tries, faster each time (the warm-up and the DJ's mix use it)
  function barGame(title, btn, done) {
    path = []; goal = null; const N = B.stretch.tries; let n = 0, hits = 0, z = .5, t0 = performance.now(), on = true;
    dlgEl.innerHTML = '<div class="cyd"><h3>' + esc(title) + '</h3><div class="cybar"><i></i><b></b></div><p class="cyln" id="cySt">&nbsp;</p><div class="cybt"><button type="button" class="btn btn-accent" id="cyGo">' + btn + '</button></div></div>';
    dlgEl.hidden = false; const zone = dlgEl.querySelector('.cybar i'), mk = dlgEl.querySelector('.cybar b'), st = dlgEl.querySelector('#cySt');
    const posAt = now => { const u = ((now - t0) / (1050 - n * 110)) % 2; return u < 1 ? u : 2 - u; };
    const place = () => { z = .18 + Math.random() * .64; zone.style.left = (z - .11) * 100 + '%'; };
    const loop = now => { if (!on || dlgEl.hidden || !mk.isConnected) return; mk.style.left = posAt(now) * 100 + '%'; requestAnimationFrame(loop); };
    place(); requestAnimationFrame(loop);
    dlgEl.querySelector('#cyGo').addEventListener('click', () => {
      const ok = Math.abs(posAt(performance.now()) - z) <= .11; if (ok) hits++; n++; t0 = performance.now() - Math.random() * 600;
      st.textContent = (ok ? '✓ ' : '✗ ') + T('Попаданий: {a} из {n}', { a: hits, n: N }); zone.style.background = ok ? '#3BD16F' : '#E2483A'; setTimeout(() => { zone.style.background = ''; }, 160);
      if (n < N) return place(); on = false; done(hits, N); paintHud(); save();
    });
  }
  function stretch(pl) {
    if (daily('gym')) return dlg(T(pl.name), p(T('Сегодня ты уже разминался. Приходи завтра.')), []);
    dlg(T(pl.name), p(T('Жми «Тянись», когда бегунок в зелёной зоне. Четыре попытки — чем точнее, тем больше энергии.')), [{ t: T('Размяться'), cls: 'btn-accent', fn: () => barGame(T(pl.name), T('Тянись!'), (hits, N) => {
      mark('gym'); const gain = hits * B.stretch.per; S.en = Math.min(emax(), S.en + gain); let extra = '';
      if (hits === N && S.bruise) { S.bruise = 0; extra = p('💪 ' + T('Чисто размялся — ушиб прошёл.')); }
      bump('stretch'); dlg(T(pl.name), p(T('Попаданий: {a} из {n}', { a: hits, n: N }) + ' · +' + gain + ' ⚡') + extra, []);
    }) }]);
  }
  // the DJ: mix two beats — and the whole yard moves to your beat till the end of the day
  function djSpot(pl) {
    if (djOn()) return dlg(T(pl.name), p('🎧 ' + T('Бит качает до конца дня: больше времени в стычках и больше денег в шляпе.')), []);
    if (daily('dj')) return dlg(T(pl.name), p(T('Биты разъехались. Попробуй завтра.')), []);
    dlg(T(pl.name), say(T(pl.name), 'Сведи два бита: жми, когда бегунок в зелёной зоне. Получится — качну весь двор.'), [{ t: '🎧 ' + T('Свести биты') + ' · 💵 ' + B.dj.price, cls: 'btn-accent', off: S.cash < B.dj.price, fn: () => { S.cash -= B.dj.price; barGame(T(pl.name), T('Сводим!'), (hits, N) => {
      mark('dj'); if (hits < B.dj.need) return dlg(T(pl.name), p(T('Попаданий: {a} из {n}', { a: hits, n: N })) + p(T('Биты разъехались. Попробуй завтра.')), []);
      S.buff.dj = dayN(); const left = hits === N ? (pl.gear || []).filter(id => !S.gear.own.includes(id)) : [], drop = left[0] || null; if (drop) S.gear.own.push(drop);
      dlg(T(pl.name), p('🎧 ' + T('Бит качает до конца дня: больше времени в стычках и больше денег в шляпе.')) + (drop ? gearCard(drop) : ''), drop ? [{ t: T('Надеть'), cls: 'btn-accent', fn: () => wear(drop) }] : []);
    }); } }]);
  }
  // the very first seconds: no reading — a crew dances at your door
  function hook() {
    S.intro = 1; const G = gangsNow().find(q => q.g.tut); if (!G) return intro();
    dlg(T('Твой двор заняли'), p(T('Банда «Ржавые» танцует у твоего подъезда. Покажи, чей это двор!')), [{ t: '🔥 ' + T('В круг!'), cls: 'btn-accent', fn: () => fight(G, 0) }]);
  }

  // ---- drawing: the picture itself lives in city-gfx.js (cached map pieces and sprites); here — only what goes where ----
  function size() {
    const r = can.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1); W = r.width; H = r.height;
    if (d !== dpr) { dpr = d; GFX.setMap(DIST, dpr); }
    can.width = Math.round(W * dpr); can.height = Math.round(H * dpr);
  }
  const R = (x, y, w, h, c) => { cx.fillStyle = c; cx.fillRect(x, y, w, h); };
  // the hero's clothes come from hero.js (level look + wardrobe + shop accessories) plus the things bought or found in the city
  function heroLook() {
    const lv = D.level(), eq = D.look() || [], k = lv + '|' + eq.join(',') + '|' + ['hat', 'kicks', 'pads'].map(i => +S.own.includes(i)).join('') + (S.card > 0 ? 'c' : '') + '|' + Object.keys(S.gear.on).map(s => S.gear.on[s]).join(',');
    if (k === lookKey) return lookNow;
    const f = window.HERO.topDown(lv, eq); f.col = Object.assign({}, f.col);
    if (S.own.includes('hat')) { f.hat = 'spin'; f.col.hat = ['#2A6FA8', '#E2611A']; }
    if (S.own.includes('kicks')) { f.col.shoe = '#19B5A5'; f.col.shoe2 = '#F2EFE8'; f.col.sole = '#F2EFE8'; }
    if (S.own.includes('pads')) f.knee = true;
    if (S.card > 0) f.carry = true;
    gearOn().forEach(g => { Object.assign(f, g.f || {}); Object.assign(f.col, g.col || {}); });   // unique clothes from the streets
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
    cam.x = cl(hero.x + .5, Math.min(vw / 2, MW / 2), Math.max(MW - vw / 2, MW / 2)); cam.y = cl(hero.y + .5, Math.min(vh / 2 - 112 / TS, MH / 2), Math.max(MH - vh / 2, MH / 2));   // the map may slide down from under the top panel: the far wall (tags!) stays visible
    const ox = Math.round(W / 2 - cam.x * TS), oy = Math.round((H - padB) / 2 - cam.y * TS), ng = night(), h = hour();
    const vis = (x, y, m) => { const px = ox + x * TS, py = oy + y * TS; return px > -m && py > -m && px < W + m && py < H + m; };
    GFX.drawMap(cx, ox, oy, W, H);
    DIST.places.forEach(p => { if (p.type === 'stash' && !S.got[p.id] && seen(p.at[0], p.at[1]) && vis(p.at[0], p.at[1], TS)) GFX.crate(cx, ox + p.at[0] * TS, oy + p.at[1] * TS); });
    walls().forEach(pl => { const r = GFX.wallRect(pl.id), a = r && artOf(pl); if (!a) return; const px = ox + r.x, py = oy + r.y; if (px > W || py > H || px + r.w < 0 || py + r.h < 0) return;
      cx.imageSmoothingEnabled = true; cx.drawImage(GFX.graf(Object.assign({ w: r.w, h: r.h }, a)), px, py, r.w, r.h); cx.imageSmoothingEnabled = false; });
    picks().forEach(k => { if (!S.pk.got.includes(k.i) && seen(k.x, k.y) && vis(k.x, k.y, TS)) GFX.pickup(cx, ox + k.x * TS + TS / 2, oy + k.y * TS + TS / 2, k.kind, now, k.i * 3 + k.x); });
    if (path.length) { const g = path[path.length - 1]; cx.strokeStyle = '#E2611A'; cx.lineWidth = 2; cx.beginPath(); cx.arc(ox + g[0] * TS + TS / 2, oy + g[1] * TS + TS / 2, 10 + 2 * Math.sin(now / 150), 0, 7); cx.stroke(); }
    (DIST.birds || []).forEach((b, i) => {
      if (Math.hypot(b[0] - hero.x - .5, b[1] - hero.y - .5) < 1.3) birdAway[i] = S.t + 90;
      if (birdAway[i] > S.t || !seen(Math.floor(b[0]), Math.floor(b[1])) || !vis(b[0], b[1], 20)) return;
      GFX.bird(cx, ox + b[0] * TS, oy + b[1] * TS, i * 2.1 + Math.floor(now / 2600 + i) % 3, Math.floor(now / 480 + i) % 3 === 0);
    });
    // people: the b-boys sway, warm up now and then (and when you come up to them), and turn to the hero when he is near
    const mv = moved > now - 120, me = heroLook();
    if (tapFx) { const u = (now - tapFx.t) / 450; if (u >= 1) tapFx = null; else { cx.save(); cx.strokeStyle = 'rgba(255,255,255,' + (.85 * (1 - u)).toFixed(2) + ')'; cx.lineWidth = 3; cx.beginPath(); cx.arc(ox + tapFx.x, oy + tapFx.y, 8 + 22 * u, 0, 7); cx.stroke(); cx.restore(); } }   // where the finger touched the map
    npcsNow().forEach(n => {
      if (!seen(n.at[0], n.at[1]) || !vis(n.at[0], n.at[1], 2 * TS)) return;
      const px = ox + n.at[0] * TS + TS / 2, py = oy + n.at[1] * TS + TS / 2, dx = hero.x - n.at[0], dy = hero.y - n.at[1], near = Math.hypot(dx, dy) < 3.2;
      const hot = warmUp[n.id] > now || (!daily('b:' + n.id) && (now + n.lvl * 2300) % 9000 < 1600);
      GFX.person(cx, px, py, lookOf(n), near ? dirOf(dx, dy) : 0, hot ? 't' + Math.floor(now / 200) % 4 : 'i' + Math.floor(now / 700 + n.lvl) % 2);
    });
    DIST.places.forEach(pl => { if (!pl.look || !seen(pl.at[0], pl.at[1]) || !vis(pl.at[0], pl.at[1], 2 * TS)) return;
      if (!npLook[pl.id]) { const f = window.HERO.topDown(pl.look.base || 3, []); f.col = Object.assign({}, f.col, pl.look.col || {}); if (pl.type === 'dj') f.phones = true; npLook[pl.id] = { key: 'p:' + pl.id, f, big: 1.05 }; }
      const px = ox + pl.at[0] * TS + TS / 2, py = oy + pl.at[1] * TS + TS / 2;
      if (pl.type === 'dj') GFX.deck(cx, px, py + 30, now, djOn());
      GFX.person(cx, px, py, npLook[pl.id], 0, pl.type === 'mc' ? 't' + Math.floor(now / 230) % 4 : 'i' + Math.floor(now / 500) % 2); });
    gangsNow().forEach(G => { if (!seen(G.x, G.y) || !vis(G.x, G.y, 3 * TS)) return;
      const gx = ox + G.x * TS + TS / 2, gy = oy + G.y * TS + TS / 2, near = Math.hypot(G.x - hero.x, G.y - hero.y) < 2.6;
      cx.strokeStyle = G.g.col; cx.globalAlpha = .5; cx.lineWidth = 2; cx.setLineDash([5, 6]); cx.beginPath(); cx.ellipse(gx, gy, 40, 32, 0, 0, 7); cx.stroke(); cx.setLineDash([]); cx.globalAlpha = 1;
      for (let k = 0; k < G.size; k++) { const a = k / G.size * Math.PI * 2 + now / 5200, ax = Math.cos(a), ay = Math.sin(a); GFX.person(cx, gx + ax * 27, gy + ay * 21, gangLook(G.g, k), dirOf(-ax, -ay), 't' + Math.floor(now / 190 + k * 2) % 4); }
      label(gx, gy - 52, T(G.g.name) + ' · ' + G.lvl, G.g.col);
      if (near) { cx.font = '900 20px Inter, sans-serif'; cx.textAlign = 'center'; cx.lineWidth = 4; cx.strokeStyle = '#0B0B0C'; cx.strokeText('!', gx, gy - 70 - 3 * Math.abs(Math.sin(now / 160))); cx.fillStyle = '#FFD23F'; cx.fillText('!', gx, gy - 70 - 3 * Math.abs(Math.sin(now / 160))); } });
    if (h >= 7 && h < 22) (DIST.walkers || []).forEach((w, i) => {
      const q = walkerAt(w, now); if (!q || !seen(Math.round(q.x), Math.round(q.y)) || !vis(q.x, q.y, 2 * TS)) return;
      if (!walkLook[i]) { const L = w.look || {}, f = window.HERO.topDown(L.base || 1, L.girl ? ['girl'] : []); f.col = Object.assign({}, f.col, L.col || {}); walkLook[i] = { key: 'w:' + i, f, big: .94 }; }
      GFX.person(cx, ox + q.x * TS + TS / 2, oy + q.y * TS + TS / 2, walkLook[i], q.dir, 'w' + Math.floor(q.d * 4.3) % 6);
    });
    const hx = ox + hero.x * TS + TS / 2, hy = oy + hero.y * TS + TS / 2;
    if (me.f.fire) GFX.aura(cx, hx, hy, now);
    GFX.person(cx, hx, hy, me, hdir, mv ? 'w' + Math.floor(hdist * 4.3) % 6 : (now % 14000 < 1800 ? 't' + Math.floor(now / 200) % 4 : 'i' + Math.floor(now / 700) % 2));
    GFX.trees().forEach(t => { if (seen(t[0], t[1]) && vis(t[0], t[1], 2 * TS)) GFX.crown(cx, ox + t[0] * TS, oy + t[1] * TS, t[0], t[1]); });
    // life: a car passes along the road, the kiosk smokes while it works
    const TR = DIST.traffic, kiosk = DIST.places.find(p => p.type === 'kiosk');
    if (TR) { const u = (now / 1000) % TR.period; if (u < TR.dur) { const carX = ox + (MW + 2 - u / TR.dur * (MW + 5)) * TS, carY = oy + TR.row * TS + TS / 2; if (carX > -100 && carX < W + 140 && seen(cl(Math.round((carX - ox) / TS), 0, MW - 1), TR.row)) GFX.carAt(cx, carX, carY, Math.floor(now / 1000 / TR.period), ng > .2); } }
    if (kiosk && inH(h, kiosk.open) && seen(kiosk.at[0], kiosk.at[1]) && vis(kiosk.at[0], kiosk.at[1], 3 * TS)) GFX.smoke(cx, ox + kiosk.at[0] * TS + 30, oy + (kiosk.at[1] - 1) * TS + 22, now);
    // the light of the day: pink at dawn, orange at sunset
    { const hf = (S.t / 60) % 24, dusk = Math.max(0, 1 - Math.abs(hf - 19) / 1.7), dawn = Math.max(0, 1 - Math.abs(hf - 6.3) / 1.2);
      if (dusk > 0) R(0, 0, W, H, 'rgba(255,120,50,' + (.17 * dusk).toFixed(3) + ')'); if (dawn > 0) R(0, 0, W, H, 'rgba(255,150,175,' + (.13 * dawn).toFixed(3) + ')'); }
    // night: darkness, pools of light under the lamps, the kiosk and some windows glow
    if (ng > 0) {
      const ki = DIST.places.find(p => p.type === 'kiosk'), L = GFX.lightsNow(ox, oy, W, H, dayN(), !!ki && inH(h, ki.open));
      L.push(me.f.fire ? { px: hx, py: hy, r: 1.6 * TS, a: .8 } : { px: hx, py: hy, r: 1.25 * TS, a: .42 });   // the hero is always readable in the dark
      GFX.night(cx, W, H, ng, L); GFX.glow(cx, ox, oy, L, ng, W, H); cx.imageSmoothingEnabled = false;
    }
    GFX.fog(cx, S.fog[S.d], ox, oy);
    DIST.places.forEach(p => {
      if (!seen(p.at[0], p.at[1]) || !vis(p.at[0], p.at[1], 4 * TS)) return; if (p.type === 'stash' && S.got[p.id]) return;
      if (p.wall) {   // a wall: the mark stands over the piece — whose it is, and whether it can be painted now
        const r = GFX.wallRect(p.id); if (!r) return; const sx = ox + r.x + r.w / 2, sy = oy + r.y - 13;
        if (S.tags[p.id]) { if (p.type === 'turf' && holdLeft(p) < 1440) label(sx, sy + 4, '⚠ ' + T('{h} ч', { h: hrs(holdLeft(p)) }), '#FF8A6A'); return; }
        if (paintable(p)) {   // the wall glows, and a ring on the ground shows where to stand
          const st = standOf(p), k = .5 + .5 * Math.sin(now / 260), gx = ox + st[0] * TS + TS / 2, gy = oy + st[1] * TS + TS / 2, here = wallNear === p.id;
          cx.save(); cx.strokeStyle = 'rgba(59,209,111,' + (.55 + .45 * k).toFixed(2) + ')'; cx.lineWidth = 3; cx.setLineDash([10, 6]); cx.lineDashOffset = -now / 40;
          cx.beginPath(); cx.roundRect(ox + r.x - 4, oy + r.y - 4, r.w + 8, r.h + 8, 6); cx.stroke(); cx.setLineDash([]);
          cx.fillStyle = 'rgba(59,209,111,' + (.08 + .1 * k).toFixed(2) + ')'; cx.fillRect(ox + r.x, oy + r.y, r.w, r.h);
          cx.strokeStyle = 'rgba(59,209,111,.9)'; cx.lineWidth = 2.5; cx.beginPath(); cx.ellipse(gx, gy + 6, 15 + 6 * k, 8 + 3 * k, 0, 0, 7); cx.stroke();
          cx.fillStyle = 'rgba(59,209,111,.25)'; cx.beginPath(); cx.ellipse(gx, gy + 6, 13, 7, 0, 0, 7); cx.fill();
          if (!here) { cx.font = '20px system-ui, sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('🎨', gx, gy - 14 - 4 * k); label(gx, gy + 26, T('Рисовать здесь'), '#7BE3A0'); }
          cx.restore();
        }
        if (p.type === 'turf') { const free = openLeft(p) > 0; GFX.sign(cx, sx, sy - (free ? Math.round(4 * Math.abs(Math.sin(now / 220))) : 0), 'turf', free ? '#3BD16F' : gangOf(p).col); if (free) label(sx, sy + 22, T('Закрась!'), '#7BE3A0'); return; }
        GFX.sign(cx, sx, sy + Math.round(2 * Math.sin(now / 400 + p.at[0])), 'wall'); return;
      }
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
    // the delivery: a mark at the door, or an arrow at the edge of the screen while the door is out of sight
    if (S.job) {
      const tx = ox + S.job.to[0] * TS + TS / 2, ty = oy + S.job.to[1] * TS + TS / 2, top = 118, bot = H - padB - 26, pulse = 4 * Math.abs(Math.sin(now / 220));
      if (tx > 20 && tx < W - 20 && ty > top && ty < bot) { cx.strokeStyle = '#3BD16F'; cx.lineWidth = 3; cx.beginPath(); cx.arc(tx, ty, 17 + pulse, 0, 7); cx.stroke(); GFX.sign(cx, tx, ty - 34 - pulse, 'job'); }
      else { const ax = cl(tx, 26, W - 26), ay = cl(ty, top, bot), an = Math.atan2(ty - hy, tx - hx);
        cx.save(); cx.translate(ax, ay); cx.rotate(an); cx.fillStyle = '#0B0B0C'; cx.beginPath(); cx.arc(0, 0, 19, 0, 7); cx.fill(); cx.fillStyle = '#3BD16F'; cx.beginPath(); cx.moveTo(13 + pulse / 2, 0); cx.lineTo(-5, -9); cx.lineTo(-1, 0); cx.lineTo(-5, 9); cx.fill(); cx.restore(); }
    }
    // little numbers that fly up when you pick something up
    floats = floats.filter(f => now - f.t < 1100);
    floats.forEach(f => { const a = (now - f.t) / 1100; cx.globalAlpha = 1 - a * a; cx.font = '800 15px Inter, system-ui, sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.lineWidth = 3.5; cx.strokeStyle = 'rgba(11,11,12,.85)';
      const fx = ox + f.x * TS + TS / 2, fy = oy + f.y * TS - 6 - a * 46; cx.strokeText(f.txt, fx, fy); cx.fillStyle = f.col; cx.fillText(f.txt, fx, fy); cx.globalAlpha = 1; });
    if (joy && joy.on) { const r = can.getBoundingClientRect(), jx = joy.x0 - r.left, jy = joy.y0 - r.top;
      cx.strokeStyle = 'rgba(242,239,232,.35)'; cx.lineWidth = 2; cx.beginPath(); cx.arc(jx, jy, 46, 0, 7); cx.stroke();
      cx.fillStyle = 'rgba(226,97,26,.7)'; cx.beginPath(); cx.arc(jx + joy.dx * 46, jy + joy.dy * 46, 18, 0, 7); cx.fill(); }
  }

  // ---- HUD + dialogs (DOM) ----
  const floorName = () => S.card > 0 ? T('Картон') + ' ×' + S.card : S.own.includes('lino') ? T('Линолеум') : T('Асфальт');
  const floorId = () => S.own.includes('lino') ? 'lino' : S.card > 0 ? 'card' : 'asphalt';
  function paintHud() {
    const G = goals(), gd = G.list.filter(g => g.done).length, k = [clock(), dayN(), Math.round(S.en), S.cash, S.rep, S.card, S.bruise, S.own.length, warm(), gd, G.list.map(g => g.a).join(), S.job ? Math.ceil(S.job.left) : '', S.inv.can || 0, djOn(), turfs().filter(mine).length].join('|'); if (k === hudKey) return; hudKey = k;
    hud.innerHTML = '<div class="cyh1"><b>' + clock() + '</b><small>' + T('День {n}', { n: dayN() + 1 }) + ' · ' + T(DIST.name) + '</small></div>' +
      '<div class="cyen" title="' + T('Энергия') + '"><i style="width:' + cl(S.en / emax() * 100, 0, 100) + '%"></i><span>⚡ ' + Math.round(S.en) + '</span></div>' +
      '<div class="cyst"><span>💵 ' + S.cash + '</span><span>★ ' + S.rep + '</span></div>' +
      '<button type="button" class="cybag" id="cyBag" aria-label="' + T('Рюкзак') + '">🎒</button>' +
      '<div class="cyrow2"><div class="cyfl">' + T('Пол') + ': ' + floorName() + (S.bruise ? ' · 🤕 ' + T('Ушиб') : '') + (warm() ? ' · 🔥 ' + T('Разогрет') : '') + '</div>' +
      '<button type="button" class="cygl" id="cyMus" aria-label="' + T('Музыка') + '" aria-pressed="' + musOn + '">' + (musOn ? '🎵' : '🔇') + '</button>' +
      '<button type="button" class="cygl' + (gd === 3 ? ' ok' : '') + '" id="cyGoals" aria-label="' + T('Дела на сегодня') + '">📋 ' + gd + ' / 3</button>' +
      (turfs().length && S.tut ? '<div class="cyfl">👑 ' + turfs().filter(mine).length + ' / ' + turfs().length + '</div>' : '') + (S.inv.can ? '<div class="cyfl">🎨 ' + S.inv.can + '</div>' : '') + (djOn() ? '<div class="cyfl">🎧 ' + T('Бит качает') + '</div>' : '') +
      (S.job ? '<div class="cyjob' + (S.job.left < 6 ? ' hot' : '') + '">🌯 ' + Math.max(0, Math.ceil(S.job.left)) + '</div>' : '') + '</div>';
    hud.querySelector('#cyBag').addEventListener('click', bag); hud.querySelector('#cyGoals').addEventListener('click', goalsDlg); hud.querySelector('#cyMus').addEventListener('click', musToggle);
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
      (S.gear.own.length ? '<p><b>' + T('Шмотки') + '</b></p>' + S.gear.own.map(gearCard).join('') : '') +
      (rows.length ? '<ul class="cyls">' + rows.join('') + '</ul>' : p(T('Пока пусто. Вещи можно купить в палатке или найти в городе.'))) +
      warmTip() + p('<small>' + T('Уровень героя и новые движения дают только настоящие уроки. Город даёт кэш, респект и вещи.') + '</small>'), [
      !warm() && D.home && { t: T('К урокам'), cls: 'btn-accent', fn: () => D.home() },
      ...S.gear.own.map(id => ({ t: (S.gear.on[GEAR[id].slot] === id ? '✓ ' + T('Снять') : T('Надеть')) + ': ' + GEAR[id].ico + ' ' + T(GEAR[id].name), fn: () => { wear(id); bag(); } })),
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
      p('🔥 ' + T('По двору ходят банды: победи в танце — банда уйдёт и что-нибудь оставит. Шмотки надеваются в рюкзаке.')) +
      p('🎨 ' + T('У каждой банды своя стена с граффити. Разогнал банду — закрась их рисунок своим: точка твоя и приносит кэш каждый день. Банда вернётся — держи точку.')) +
      p('📋 ' + T('Собирай монеты и баллончики, бери заказы в ларьке, разминайся на площадке — дела дня открываются кнопкой 📋.')) +
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
      const left = jobsLeft();
      return dlg(T(pl.name), p(T('Горячее и сытное. Еда возвращает энергию.')), [buy('shawarma', 'Шаурма'), buy('tea', 'Чай'),
        S.job ? null : left > 0 ? { t: '🌯 ' + T('Взять заказ на доставку') + ' (−' + B.job.energy + ' ⚡) · ' + left + ' / ' + B.job.perDay, off: S.en < B.job.energy, fn: takeJob } : { t: T('Сегодня заказов больше нет'), off: true }].filter(Boolean));
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
    if (pl.wall) return wallSpot(pl);
    if (pl.type === 'gym') return stretch(pl);
    if (pl.type === 'mc') return mcSpot(pl);
    if (pl.type === 'dj') return djSpot(pl);
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
    if (D.RB.bgm) D.RB.bgm(false);
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
          k *= 1 + perk('show') / 100; if (djOn()) { k *= 1 + B.dj.show; lines.push('🎧 ' + T('Бит качает') + ': +' + Math.round(B.dj.show * 100) + ' %'); }
          const cash = Math.min(B.show.cap, Math.max(2, Math.round((B.show.min + B.show.span * r.acc) * k)));
          S.cash += cash; S.t += 30;
          if (S.own.includes('chalk') && !daily('chalk')) { mark('chalk'); lines.push('✏️ ' + T('Меловой круг: толпа не устала.')); } else sp.n++;
          sp.t = S.t;
          if (sp.n > 1) lines.push(T('Толпа устаёт — в следующий раз заплатит меньше. Дай месту отдохнуть.'));
          wearFloor(fl, lines); bruiseRoll(fl, r.picks, lines);
          if (Math.random() < B.drop.tapeHat) { give('tape'); lines.push(found('tape')); }
          bump('show');
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
        st.w++; bump('win');
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
  function down(e) { if (!dlgEl.hidden || !duEl.hidden) return; joy = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, on: false }; try { can.setPointerCapture(e.pointerId); } catch (_) {} }
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
    tapFx = { x: e.clientX - r.left - ox, y: e.clientY - r.top - oy, t: performance.now() };
    if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) { kick(); return; }
    {   // a tap on the wall picture itself (it sits on a building you can't walk on) ⇒ go to the spot in front of it
      const mx = e.clientX - r.left - ox, my = e.clientY - r.top - oy;
      const wp = walls().find(q => { const w = GFX.wallRect(q.id); return w && seen(q.at[0], q.at[1]) && mx >= w.x - 8 && mx <= w.x + w.w + 8 && my >= w.y - 8 && my <= w.y + w.h + 8; });
      if (wp) { const way = route([standOf(wp)]); if (way) { path = way; goal = () => { wallNear = wp.id; openPlace(wp); }; if (!way.length) { goal = null; wallNear = wp.id; openPlace(wp); } kick(); return; } }
    }
    const n = npcsNow().find(q => seen(q.at[0], q.at[1]) && q.at[0] === tx && (q.at[1] === ty || q.at[1] - 1 === ty)); // the b-boy or the name above him
    const pl = seen(tx, ty) ? placeAt(tx, ty) : null;
    const gg = seen(tx, ty) ? gangsNow().find(G => Math.abs(G.x - tx) <= 1 && Math.abs(G.y - ty) <= 1) : null;
    let goals, then = null;
    if (gg) { goals = around(gg.x, gg.y).concat(walk(gg.x, gg.y) ? [[gg.x, gg.y]] : []); then = () => { if (dlgEl.hidden) openGang(gg); }; }
    else if (n) { goals = around(n.at[0], n.at[1]); then = () => openNpc(n); }
    else if (pl) { goals = walk(pl.at[0], pl.at[1]) && !pl.look ? [pl.at] : around(tx, ty).concat(around(pl.at[0], pl.at[1])); then = () => openPlace(pl); }
    else if (walk(tx, ty)) goals = [[tx, ty]];
    else goals = around(tx, ty);
    if (!goals.length) return;
    const way = route(goals); if (!way) return;
    path = way; goal = then; if (!way.length && then) { goal = null; then(); }
    kick();
  }
  function step(dt) {
    S.t += dt * 1440 / (B.dayMin * 60); jobTick(dt); collect(); turfTick();
    if (wallNear) { const q = DIST.places.find(x => x.id === wallNear); if (!q || Math.hypot(standOf(q)[0] - hero.x, standOf(q)[1] - hero.y) > 1.4) wallNear = ''; }
    if (dlgEl.hidden && duEl.hidden && spEl.hidden && !path.length) { const q = walls().find(x => paintable(x) && x.id !== wallNear && Math.hypot(standOf(x)[0] - hero.x, standOf(x)[1] - hero.y) < .6); if (q) { wallNear = q.id; joy = null; openPlace(q); } }   // stepped onto the ring ⇒ the paint dialog opens
    if (dlgEl.hidden && duEl.hidden && !S.job && performance.now() > gangCool) { const G = gangsNow().find(q => Math.hypot(q.x - hero.x, q.y - hero.y) < 1.15); if (G) { path = []; goal = null; joy = null; openGang(G); } }
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
    if (now - musT > 400) { musT = now; music(); }
    const dt = Math.min(.25, (now - last) / 1000 || 0); last = now;
    if (D.rbEl.hidden && duEl.hidden && spEl.hidden) step(dt);            // the clock stands still during a round
    draw(now); paintHud();
    // battery: 60 fps only while the hero walks; otherwise a slow tick (the clock, small idle motion)
    if (path.length || (joy && joy.on)) raf = requestAnimationFrame(frame); else if (S.job || floats.length) raf = requestAnimationFrame(frame); else timer = setTimeout(() => { raf = requestAnimationFrame(frame); }, 66);   // ~15 frames a second: residents, the car, coins move
  }
  // background beat (owner 14.11.2026): only while the city is on screen, not during a dance-off / round / spray, not when folded.
  // Off switch `fedoskin-city-music` = '0' (HUD button 🎵 / 🔇).
  let musOn = true; try { musOn = localStorage.getItem('fedoskin-city-music') !== '0'; } catch (_) {}
  let musT = 0;
  function music() {
    if (!D || !D.RB || !D.RB.bgm) return;
    const want = musOn && shown && !document.hidden && D.rbEl.hidden && duEl.hidden && spEl.hidden;
    D.RB.bgm(want);
  }
  function musToggle() { musOn = !musOn; try { localStorage.setItem('fedoskin-city-music', musOn ? '1' : '0'); } catch (_) {} const b = hud.querySelector('#cyMus'); if (b) { b.textContent = musOn ? '🎵' : '🔇'; b.setAttribute('aria-pressed', musOn); } music(); }   // in place: the button keeps its tap animation
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
    '.cyhud>.cyrow2{grid-column:1/-1;background:none;border:0;padding:0;backdrop-filter:none;-webkit-backdrop-filter:none;display:flex;gap:6px;flex-wrap:wrap;align-items:center}' +
    '.cyrow2>*{background:rgba(11,11,12,.8);border:1px solid rgba(255,255,255,.08);border-radius:12px;font:600 11px/1.2 Inter,sans-serif;color:#C9C5BC;padding:6px 10px;white-space:nowrap}' +
    '.cygl{pointer-events:auto;cursor:pointer;color:#F2EFE8!important;border-color:rgba(226,97,26,.6)!important;min-height:30px}.cygl.ok{border-color:#3BD16F!important;color:#7BE3A0!important}' +
    '.cyjob{color:#7BE3A0!important;border-color:#3BD16F!important;font-weight:800!important}.cyjob.hot{color:#FF8A6A!important;border-color:#E2483A!important}' +
    '.cybar{position:relative;height:34px;border-radius:17px;background:#26262B;margin:6px 0 10px;overflow:hidden}.cybar i{position:absolute;top:0;bottom:0;width:22%;background:rgba(59,209,111,.55);border-radius:8px}.cybar b{position:absolute;top:3px;bottom:3px;width:6px;margin-left:-3px;border-radius:3px;background:#F2EFE8;box-shadow:0 0 8px #fff}' +
    '.cydlg{position:absolute;inset:0;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.45);padding:10px 10px calc(10px + var(--cyb,0px))}' +
    '.cyd{width:100%;max-width:480px;max-height:78%;overflow-y:auto;background:#151517;border:1px solid rgba(255,255,255,.1);border-radius:18px;padding:16px;color:#F2EFE8;font-family:Inter,system-ui,sans-serif}' +
    '.cyd h3{font:400 24px/1.1 Anton,Inter,sans-serif;letter-spacing:.5px;margin:0 0 8px;text-transform:uppercase}.cyd p{margin:0 0 8px;font-size:14px;line-height:1.4;color:#D8D4CB}' +
    '.cysay{background:rgba(226,97,26,.1);border-left:3px solid #E2611A;border-radius:8px;padding:8px 10px}.cygot{background:rgba(59,209,111,.08);border:1px solid rgba(59,209,111,.3);border-radius:10px;padding:8px 10px;color:#7BE3A0!important}' +
    '.cyls{list-style:none;margin:0 0 8px;padding:0}.cyls li{padding:7px 0;border-top:1px solid rgba(255,255,255,.07);font-size:14px}.cyls small,.cygot small{display:block;color:#9A968E;font-size:12px}' +
    '.cybt{display:flex;flex-direction:column;gap:8px;margin-top:10px}.cybt .btn{width:100%}.cybt .btn[disabled]{opacity:.4}' +
    '.cygear{border:1px solid var(--rc);border-left-width:4px;border-radius:10px;padding:8px 10px;margin:0 0 8px;background:rgba(255,255,255,.04)}.cygear b{display:block;font-size:14px;color:var(--rc)}.cygear small{font-size:12px;color:#C9C5BC}' +
    '.cydu{position:absolute;inset:0;z-index:3;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:calc(18px + env(safe-area-inset-top,0px)) 16px calc(26px + var(--cyb,0px));background:radial-gradient(circle at 50% 46%,rgba(20,20,24,.72),rgba(8,8,10,.94));color:#F2EFE8;font-family:Inter,system-ui,sans-serif;touch-action:none}' +
    '.cydu.shake{animation:cyShake .28s}@keyframes cyShake{20%{transform:translateX(-9px)}50%{transform:translateX(8px)}80%{transform:translateX(-4px)}}' +
    '.cydu-top{display:flex;flex-direction:column;align-items:center;gap:6px}.cydu-top b{font:400 30px/1 Anton,Inter,sans-serif;letter-spacing:1px;text-transform:uppercase;text-shadow:0 2px 0 #000}.cydu-top span{font-size:20px;letter-spacing:4px}' +
    '.cydu-mid{display:flex;flex-direction:column;align-items:center;gap:8px}' +
    '.cydu-st{display:flex;align-items:flex-end;justify-content:center;gap:4px;height:150px;width:100%;max-width:360px;border-bottom:3px solid color-mix(in srgb,var(--gc) 60%,transparent);background:radial-gradient(ellipse at 50% 100%,color-mix(in srgb,var(--gc) 22%,transparent),transparent 70%)}' +
    '.cydu{--bp:0}.cydu-st{position:relative}.cydu-st::after{content:"";position:absolute;left:8%;right:8%;bottom:-3px;height:5px;border-radius:3px;background:var(--gc);opacity:calc(.15 + .85*var(--bp));box-shadow:0 0 calc(6px + 22px*var(--bp)) var(--gc)}.cydu-ring{transform:scale(calc(1 + .04*var(--bp)))}.cydu-in span.pop{animation:cyPop .16s ease-out}@keyframes cyPop{0%{transform:scale(.4)}70%{transform:scale(1.18)}100%{transform:scale(1)}}' +
    '.cydu-f{width:132px;height:150px;flex:none}.cydu-f svg{width:100%;height:100%;overflow:visible;display:block}.cydu-f.op{transform:scaleX(-1);filter:drop-shadow(0 0 9px var(--gc))}.cydu-vs{font:400 22px/1 Anton,Inter,sans-serif;color:#F2EFE8;opacity:.5;align-self:center}' +
    '@media (max-height:720px){.cydu-st{height:118px}.cydu-f{width:104px;height:118px}.cydu-top b{font-size:24px!important}}' +
    '.cydu-ring{--u:0;width:168px;height:168px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(var(--gc) calc((1 - var(--u))*360deg),rgba(255,255,255,.09) 0);box-shadow:0 0 44px color-mix(in srgb,var(--gc) 45%,transparent)}' +
    '.cydu-in{--h:0;width:140px;height:140px;border-radius:50%;background:#131316;display:grid;place-items:center;box-shadow:inset 0 0 0 calc(var(--h)*70px) #3BD16F}' +
    '.cydu-in span{font:900 84px/1 Inter,system-ui,sans-serif;display:block;transition:transform .12s}.cydu-in span.du{color:#FFD23F}.cydu-in span.dr{color:#4FC0FF}.cydu-in span.dd{color:#FF4F9A}.cydu-in span.dl{color:#7CFF4F}.cydu-in span.dh{font-size:66px}.cydu-in span.hit{transform:scale(1.35)}' +
    '.cydu-msg{font:400 34px/1 Anton,Inter,sans-serif;letter-spacing:1px;min-height:36px}.cydu-msg.ok{color:#3BD16F}.cydu-msg.big{color:#FFD23F;font-size:42px}.cydu-msg.bad{color:#FF5A4A}' +
    '.cydu-hint{font-size:13px;color:#C9C5BC;text-align:center;min-height:34px;max-width:280px}' +
    '.cydu-bot{display:flex;flex-direction:column;align-items:center;gap:6px;min-height:56px}.cydu-bot span:first-child{font-size:24px;letter-spacing:3px}.cydu-bot span:last-child{font:400 20px/1 Anton,Inter,sans-serif;color:#E2611A;letter-spacing:1px}' +
    '.cygr{background:#8F8E8A linear-gradient(rgba(0,0,0,.12) 1px,transparent 1px) 0 0/100% 7px;border-radius:10px;padding:8px;margin:0 0 10px;border:1px solid rgba(255,255,255,.1)}.cygr img{display:block;width:100%;height:auto}' +
    '.cywd{display:flex;align-items:center;gap:10px;margin:0 0 10px;font-size:13px;color:#C9C5BC}.cywd input{flex:1;min-width:0;background:#0B0B0C;border:1px solid rgba(255,255,255,.18);border-radius:10px;padding:10px 12px;color:#F2EFE8;font:400 20px/1 Anton,Inter,sans-serif;letter-spacing:2px;text-transform:uppercase}' +
    '.cych{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 10px}.cychip{background:#26262B;border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:8px 12px;color:#F2EFE8;font:600 13px/1 Inter,sans-serif;cursor:pointer}.cychip.on{background:#E2611A;border-color:#E2611A;color:#0B0B0C}.cychip.lock{opacity:.55}' +
    '.cysw{width:40px;height:40px;border-radius:50%;border:2px solid rgba(255,255,255,.18);padding:0;cursor:pointer}.cysw.on{border-color:#F2EFE8;box-shadow:0 0 0 3px #E2611A}' +
    '.cysp{position:absolute;inset:0;z-index:3;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:calc(18px + env(safe-area-inset-top,0px)) 10px calc(18px + var(--cyb,0px));background:rgba(8,8,10,.95);color:#F2EFE8;font-family:Inter,system-ui,sans-serif;touch-action:none}' +
    '.cysp-top{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center}.cysp-top b{font:400 28px/1 Anton,Inter,sans-serif;letter-spacing:1px;text-transform:uppercase}.cysp-top small{font-size:13px;color:#C9C5BC;max-width:320px}' +
    '.cysp-wall{position:relative;border-radius:8px;overflow:hidden;box-shadow:0 0 0 3px #26262B,0 12px 40px rgba(0,0,0,.6)}.cysp-wall canvas{display:block;touch-action:none;cursor:crosshair}' +
    '.cysp-row{display:flex;align-items:center;gap:10px;width:100%;max-width:340px}.cysp-row b{font:400 22px/1 Anton,Inter,sans-serif;min-width:58px;text-align:right}.cysp-bar{flex:1;height:14px;border-radius:7px;background:#26262B;overflow:hidden}.cysp-bar i{display:block;height:100%;width:100%;background:linear-gradient(90deg,#E2611A,#FFD23F)}' +
    '.cysp .cybt{width:100%;max-width:340px}' +
    '.cysp-hint{position:absolute;inset:0;pointer-events:none;display:flex;align-items:flex-end;justify-content:center;padding-bottom:8px}.cysp-hint span{font:700 13px/1 Inter,sans-serif;background:rgba(11,11,12,.8);color:#7BE3A0;padding:6px 10px;border-radius:12px}' +
    '.cysp-hint i{position:absolute;left:8%;top:22%;font-size:34px;font-style:normal;filter:drop-shadow(0 2px 4px rgba(0,0,0,.7));animation:cyswipe 2s ease-in-out infinite}' +
    '@keyframes cyswipe{0%{left:6%;top:18%}25%{left:40%;top:34%}50%{left:74%;top:16%}75%{left:40%;top:38%}100%{left:6%;top:18%}}' +
    '.cysp-l{font-size:12px;color:#C9C5BC;min-width:72px}.cysp-bar.cov i{background:linear-gradient(90deg,#2E9E58,#3BD16F)}' +
    '.rbcity{margin-top:10px}.cyres{display:flex;gap:14px;justify-content:center;font:400 26px/1 Anton,Inter,sans-serif;margin:4px 0 8px}.cyres .up{color:#3BD16F}.cyres .dn{color:#E2611A}.cyln{font-size:13px;color:#C9C5BC;margin:0 0 6px;text-align:center}';

  function init(deps) {
    D = deps; el = D.el; S = load();
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    el.innerHTML = '<canvas id="cyCan"></canvas><div class="cyhud" id="cyHud"></div><div class="cydlg" id="cyDlg" hidden></div><div class="cydu" id="cyDu" hidden></div><div class="cysp" id="cySp" hidden></div>';
    can = $('#cyCan'); cx = can.getContext('2d'); if (!cx.roundRect) cx.roundRect = function (x, y, w, h) { this.rect(x, y, w, h); }; hud = $('#cyHud'); dlgEl = $('#cyDlg'); duEl = $('#cyDu'); spEl = $('#cySp');
    setMap();
    can.addEventListener('pointerdown', down); can.addEventListener('pointermove', move); can.addEventListener('pointerup', up); can.addEventListener('pointercancel', () => { joy = null; });
    window.addEventListener('resize', () => { W = 0; kick(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { halt(); if (shown) save(); } else kick(); music(); });   // pause when the app is folded
    window.addEventListener('pagehide', () => { if (shown) save(); });
    // the round was left before its end (back / swipe): the stake and the energy stay spent
    new MutationObserver(() => { if (!D.rbEl.hidden) return; if (pend) { const k = pend.kind; pend = null; if (shown) D.toast(k === 'battle' ? T('Ты ушёл из круга — ставка сгорела') : T('Шоу сорвалось — энергия потрачена')); save(); } hudKey = ''; kick(); })
      .observe(D.rbEl, { attributes: true, attributeFilter: ['hidden'] });
  }
  function show() { if (!el) return; shown = true; W = 0; const tb = document.getElementById('tabs'); el.style.setProperty('--cyb', (tb ? tb.offsetHeight : 0) + 'px'); padB = tb ? tb.offsetHeight : 0; hudKey = ''; warmCheck(); S.en = Math.min(S.en, emax()); music(); kick(); if (!S.intro) setTimeout(() => { if (shown && dlgEl.hidden) hook(); }, 400); }
  function hide() { if (!shown) return; shown = false; halt(); save(); music(); }
  window.CITY = { init, show, hide, _duel: () => duApi, _spray: () => spApi, _walls: () => walls().map(p => ({ id: p.id, at: p.at, mine: mine(p), open: p.type === 'turf' ? openLeft(p) : -1, hold: holdLeft(p), rect: GFX.wallRect(p.id) })), _gangs: () => gangsNow().map(G => ({ id: G.g.id, x: G.x, y: G.y, lvl: G.lvl, size: G.size })), _picks: () => picks().map(k => ({ x: k.x, y: k.y, kind: k.kind })), _pos: () => [+hero.x.toFixed(2), +hero.y.toFixed(2)], _cam: () => ({ ox: Math.round(W / 2 - cam.x * TS), oy: Math.round((H - padB) / 2 - cam.y * TS) }), _s: () => S, _reset: () => { S = fresh(); setMap(); save(); hudKey = ''; kick(); }, _go: (x, y) => { hero.x = x; hero.y = y; reveal(); kick(); }, _t: h => { S.t = Math.floor(S.t / 1440) * 1440 + h * 60; kick(); } };
})();
