// Rhythm battle (owner 10.11.2026 «что-то похожее на настоящую игру»): the player builds a set (toprock + power move +
// freeze), then taps to a beat made right here with WebAudio (no music files, no copyrights). Accuracy drives the score,
// how clean the hero dances and what the judges say. Step 1 = a local round against the computer (`?battle=play`).
// index.html calls RB.init({ T, names, spin }) once and RB.open({ level, eq, nick, oppLevel }).
(function () {
  'use strict';
  // four beats (owner 11.11.2026 «ещё 3 разных бита, с разной сложностью»): tempo, how dense the notes are (`up` shifts the
  // move's pattern level) and a score multiplier so a harder beat pays more. The id goes into the result (server checks later).
  const BEATS = [
    { id: 'lofi', name: 'LO-FI', bpm: 84, up: -1, mult: .8, lv: 1 },
    { id: 'boom', name: 'BOOM BAP', bpm: 100, up: 0, mult: 1, lv: 2 },
    { id: 'funk', name: 'FUNK BREAK', bpm: 114, up: 0, mult: 1.25, lv: 3 },
    { id: 'raw', name: 'RAW BREAKS', bpm: 128, up: 1, mult: 1.55, lv: 4 },
    // rules v2 only (owner 13.11.2026 «добавь сложные диджейские биты для тапания»): the taps follow what the DJ does —
    // syncopation with the sound cut out, triplets, double time / half time. A wood block plays every tap, so it can be heard.
    { id: 'cut', name: 'DJ CUTS', bpm: 104, up: 0, mult: 1.75, lv: 5, g: 2 },
    { id: 'trip', name: 'TRIPLET FLIP', bpm: 96, up: 0, mult: 1.9, lv: 6, g: 2 },
    { id: 'dbl', name: 'DOUBLE TIME', bpm: 140, up: 0, mult: 2.1, lv: 7, g: 2 }];
  const beatOf = id => BEATS.find(b => b.id === id) || BEATS[1];
  // <RB2> rules v2 of the rhythm battle (owner 13.11.2026 «продумай систему батлов, сложность элементов, подсчёт очков, сложные
  // диджейские биты, рисование траектории»). SOURCE = tools/rb2.js; `python3 tools/rb2_sync.py` copies this block into rhythm.js
  // and server/push-worker.js — the phone and the server must count a round exactly the same way. Do not edit the copies.
  const RB2 = (() => {
    // the DJ's tracks: bpm, `up` (shifts how dense the notes are), score multiplier, hardness 1–7, note family
    const BEATS = { lofi: [84, -1, .8, 1, 'st'], boom: [100, 0, 1, 2, 'st'], funk: [114, 0, 1.25, 3, 'st'], raw: [128, 1, 1.55, 4, 'st'],
      cut: [104, 0, 1.75, 5, 'sync'], trip: [96, 0, 1.9, 6, 'trip'], dbl: [140, 0, 2.1, 7, 'dbl'] };
    // R = the revision of these tables: the phone and the server play by v2 only when both have the same one (bump it on ANY change
    // of M / ROWS / NEED / beats / patterns — otherwise a phone with old code sends rounds the server counts differently)
    const R = 3;
    // the score multiplier of every move = how hard it is in real breaking. THE OWNER'S NUMBERS (13.11.2026 «исправь: indian 1.3,
    // airflare 2.5, 1990 2, reverse 1990 2, 2000 2, airchair 1.8, flare 2.2, headspin 1.4…» + new footwork). It also sets how dense
    // the taps are (tier: ≤ ×1.1 sparse, ≤ ×1.4 medium, above — dense) and how narrow the trajectory's corridor is
    const M = { toprock: 1, kickstep: 1.1, salsa: 1.1, indian: 1.3,
      hook: 1, sixstep: 1.1, kickout: 1.1, ccs: 1.2, babylove: 1.3, onestep: 1.3, russian: 1.3,
      backspin: 1.1, swipe: 1.3, windmill: 1.4, headspin: 1.4, ninety: 2, rninety: 2, twok: 2, flare: 2.2, airflare: 2.5,
      freeze: 1.1, nike: 1.3, onehand: 1.4, hollowback: 1.7, airchair: 1.8,
      headstand: 1.2, handstand: 1.3 }; // the last two left the game (replaced by nike / onehand); kept for rounds already stored
    const ROWS = [['toprock', 'kickstep', 'salsa', 'indian'], ['hook', 'sixstep', 'kickout', 'ccs', 'babylove', 'onestep', 'russian'],
      ['backspin', 'swipe', 'windmill', 'headspin', 'ninety', 'rninety', 'twok', 'flare', 'airflare'],
      ['freeze', 'nike', 'onehand', 'hollowback', 'airchair']];
    const NEED = { babylove: 2, onestep: 2, russian: 2, windmill: 3, onehand: 3, airchair: 3, headspin: 5, flare: 5, airflare: 5, ninety: 5,
      hollowback: 5, rninety: 6, twok: 6 }; // the hero's level a move needs
    const mult = m => M[m] || 1;
    const tier = m => mult(m) <= 1.1 ? 1 : mult(m) <= 1.4 ? 2 : 3;
    const cl = (x, a, b) => Math.max(a, Math.min(b, x));
    const mul = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const th = a => a.map(x => x / 3); // triplets: thirds of a beat
    // one bar (4 beats) of taps per note family and density level 1–4
    const P = {
      st: [null, [[0, 1, 2, 3]],
        [[0, 1, 1.5, 2, 3], [0, .5, 1, 2, 3], [0, 1, 2, 2.5, 3], [0, 1, 2, 3, 3.5]],
        [[0, .5, 1, 1.5, 2, 3, 3.5], [0, .5, 1.5, 2, 2.5, 3], [0, 1, 1.5, 2, 2.5, 3, 3.5], [0, .5, 1, 2, 2.5, 3.5]],
        [[0, .5, 1, 1.5, 2, 2.5, 3, 3.5], [0, .5, 1, 1.5, 2, 2.75, 3, 3.5], [0, .75, 1, 1.5, 2, 2.5, 3, 3.5], [0, .5, 1, 1.75, 2, 2.5, 3.25, 3.5]]],
      // DJ CUTS: the taps sit between the beats (syncopation)
      sync: [null, [[0, 1.5, 2, 3], [0, 1, 2.5, 3]],
        [[0, .75, 1.5, 2, 3], [0, 1, 1.75, 2.5, 3], [.5, 1, 2, 2.5, 3.5]],
        [[0, .75, 1.5, 2, 2.75, 3.5], [0, .5, 1.25, 2, 2.5, 3.25], [0, .75, 1, 1.75, 2.5, 3, 3.5]],
        [[0, .25, .75, 1.5, 2, 2.25, 2.75, 3.5], [0, .75, 1, 1.5, 1.75, 2.5, 3, 3.25, 3.5], [0, .5, .75, 1.5, 2, 2.5, 2.75, 3.5]]],
      // TRIPLET FLIP: three taps a beat, and now and then a straight bar
      trip: [null, [th([0, 3, 6, 9]), th([0, 3, 6, 8, 9])],
        [th([0, 3, 4, 5, 6, 9]), th([0, 2, 3, 6, 8, 9]), th([0, 3, 6, 7, 8, 9])],
        [th([0, 2, 3, 5, 6, 8, 9]), th([0, 1, 2, 3, 6, 7, 8, 9]), th([0, 3, 4, 5, 6, 9, 10, 11])],
        [th([0, 1, 2, 3, 4, 5, 6, 9, 10, 11]), th([0, 2, 3, 4, 5, 6, 8, 9, 10, 11]), th([0, 1, 2, 3, 6, 7, 8, 9, 10, 11])]],
      // DOUBLE TIME: a fast bar, then a half-time bar
      dblD: [null, [[0, 1, 2, 3]], [[0, .5, 1, 2, 3], [0, 1, 2, 2.5, 3]],
        [[0, .5, 1, 1.5, 2, 3, 3.5], [0, 1, 1.5, 2, 2.5, 3, 3.5]],
        [[0, .5, 1, 1.5, 2, 2.5, 3, 3.5], [0, .5, 1, 1.5, 2, 3, 3.5]]],
      dblH: [null, [[0, 2]], [[0, 2, 3], [0, 1.5, 2]], [[0, 1.5, 2, 3], [0, 2, 2.5, 3]], [[0, 1.5, 2, 3, 3.5], [0, .5, 2, 2.5, 3]]] };
    const PF = [null, [0, 1, 2], [0, 1, 1.5, 2], [0, .5, 1, 1.5, 2, 2.5], [0, .5, 1, 1.5, 2, 2.5]];
    // the round in beats: count-in 4, toprock 8, footwork 8, power 4 of taps + the trajectory, freeze 4 (the big hit on its 4th)
    const B_TOP = 4, B_FOOT = 12, B_POW = 20, B_DRAW = 24, B_DRAW_END = 27.5, B_FRZ = 28, B_BIG = 31, B_HOLD_END = 33;
    const W_DRAW = 5, W_BIG = 4; // a drawn trajectory counts as 5 taps, the held freeze as 4
    const TWO = 2, FRESH = .02; // moves from ×2 get a second trajectory; a new set: +2 % per move that wasn't in the previous round
    function bar(fam, L, i, rnd) {
      let set;
      if (fam === 'trip') set = rnd() < .3 ? P.st[Math.min(L, 3)] : P.trip[L];
      else if (fam === 'dbl') set = i % 2 ? P.dblH[L] : P.dblD[L];
      else set = P[fam][L];
      return set[Math.floor(rnd() * set.length)];
    }
    // every note: b = its beat, ph = which move it belongs to (0 toprock … 3 freeze), w = weight; draw ⇒ a trajectory until `end`
    function notes(picks, seed, beat) {
      const B = BEATS[beat], fam = B[4], rnd = mul(seed || 1), out = [], L = m => cl(tier(m) + B[1], 1, 4);
      let i = 0;
      const bars = (b0, n, ph) => { for (let k = 0; k < n; k++, i++) bar(fam, L(picks[ph]), i, rnd).forEach(x => out.push({ b: b0 + k * 4 + x, ph, w: 1 })); };
      bars(B_TOP, 2, 0); bars(B_FOOT, 2, 1);
      // the hardest power moves (from ×2): no taps at all — two trajectories, the second one mirrored (owner 13.11.2026 «делай»)
      const two = mult(picks[2]) >= TWO;
      if (two) { i++; out.push({ b: B_POW, end: B_POW + 3.5, ph: 2, w: W_DRAW, draw: true }); } else bars(B_POW, 1, 2);
      out.push({ b: B_DRAW, end: B_DRAW_END, ph: 2, w: W_DRAW, draw: true, mir: two });
      PF[L(picks[3])].forEach(x => out.push({ b: B_FRZ + x, ph: 3, w: 1 }));
      out.push({ b: B_BIG, end: B_HOLD_END, ph: 3, w: W_BIG, big: true, hold: true }); // the freeze: hit it in time and HOLD the finger for 2 beats
      return out;
    }
    const base = (n, picks, kind, beat) => (kind === 1 ? 100 : 50) * n.w * mult(picks[n.ph]) * BEATS[beat][2];
    const combo = c => 1 + Math.min(c, 30) * .02;
    // the score from one result per note (1 perfect, 2 good, 3 miss) + where a stray tap broke the combo. A clean round
    // (no miss, no stray tap) = FULL COMBO, +10 %
    const fresh = (picks, prev) => Array.isArray(prev) && prev.length === 4 ? picks.filter((m, k) => m !== prev[k]).length : 0;
    function score(picks, seed, beat, hits, brk, level, prev) {
      const br = new Set(brk || []); let s = 0, c = 0, clean = !(brk && brk.length);
      notes(picks, seed, beat).forEach((n, i) => { if (br.has(i)) c = 0; const k = +hits[i]; if (k !== 1 && k !== 2) { c = 0; clean = false; return; } c++; s += base(n, picks, k, beat) * combo(c); });
      return Math.round(s * (clean ? 1.1 : 1) * (1 + FRESH * fresh(picks, prev)) * (1 + .01 * (level || 1)));
    }
    return { R, BEATS, M, ROWS, NEED, tier, mult, notes, score, fresh, base, combo, lv: (m, beat) => cl(tier(m) + BEATS[beat][1], 1, 4), B_DRAW, B_DRAW_END };
  })();
  // </RB2>
  // which rules this round is played by: 2 = RB2 (difficulty 1–10, hard beats, the trajectory to draw, FULL COMBO), 1 = the old ones
  // (a battle with a server or an opponent's challenge that doesn't know v2 yet)
  const V2 = () => !!G && G.g === 2;
  const prevKey = () => G.battle ? 'fedoskin-rb-prev' : 'fedoskin-rb-prev-t'; // the set of the previous round (battles: the same one the server remembers)
  const diffOf = m => V2() ? RB2.mult(m) : DIFF[m];
  const tierOf = m => V2() ? RB2.tier(m) : DIFF[m];
  const multOf = m => V2() ? RB2.mult(m) : MULT[DIFF[m]];
  const rowsOf = () => V2() ? RB2.ROWS.map((r, k) => [ROWS[k][0], r]) : ROWS; // v2 has its own moves (owner 13.11.2026: more footwork, 2000, reverse 1990…)
  const needOf = m => (V2() ? RB2.NEED[m] : NEED[m]) || 1;
  const lvOf = (m, beat) => V2() ? RB2.lv(m, beat) : clamp(DIFF[m] + beatOf(beat).up, 1, 3);
  const notes2 = (picks, seed, beat) => { const bt = 60 / beatOf(beat).bpm; return RB2.notes(picks, seed, beat).map(n => ({ t: n.b * bt, end: n.end ? n.end * bt : 0, ph: n.ph, w: n.w, big: !!n.big, draw: !!n.draw, hold: !!n.hold, mir: !!n.mir, st: 0 })); };
  const notesOf = (picks, seed, beat) => V2() ? notes2(picks, seed, beat) : notesFor(picks, seed, beat);
  const ptsOf = (n, kind, combo) => V2() ? RB2.base(n, G.picks, kind, G.beat) * RB2.combo(combo) : noteBase(n, G.picks, kind, G.beat) * comboMult(combo);
  const totalOf = (picks, seed, level, beat, hits, brk) => V2() ? RB2.score(picks, seed, beat, hits, brk, level, G.prevPk) : scoreOf(picks, seed, level, beat, hits, brk);
  const maxOf = (picks, seed, level, beat) => V2() ? RB2.score(picks, seed, beat, '1'.repeat(RB2.notes(picks, seed, beat).length), [], level, picks === G.picks ? G.prevPk : null) : maxScore(picks, seed, level, beat);
  // v2 (owner 13.11.2026): the app passes the exact list of usable moves (lesson studied 3× AND the hero's level); else as before
  const know = m => G.allow ? (G.ulKeys.has(m) ? G.allow.has(m) : needOf(m) <= G.level) : (needOf(m) <= G.level || G.ul.has(m));
  // the locked card's caption and the how-to text (v2: studied 3× AND level)
  const lockLbl = h => { const T = D.T; return !h.lv ? '🔒 🎬 ' + T('Урок') : h.st ? '🎬✓ · ' + T('Ур. {n}', { n: h.lv }) : '🔒 🎬 ' + T('Урок') + (h.lvOk ? '' : ' · ' + T('Ур. {n}', { n: h.lv })); };
  const ulText2 = (h, nm) => { const T = D.T; return h.st ? T('{move} изучено по уроку ✓ — откроется, когда твой герой дорастёт до уровня {n}.', { move: nm, n: h.lv })
    : (h.id ? T('Открой {move}: посмотри урок «{name}» 3 раза со звуком — хотя бы раз целиком, без перемотки вперёд. Сейчас: {p} из 3.', { move: nm, name: esc(h.name), p: h.pf || h.p })
      : T('Открой {move}: посмотри целиком уроки раздела {sec} — {n} из {need}.', { move: nm, sec: esc(h.sec), n: h.n, need: h.need })) +
      (h.lvOk ? '' : ' ' + T('И нужен уровень героя {n}.', { n: h.lv })); };
  const esc = x => String(x == null ? '' : x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  let BEAT = .6;
  // a set as in real breaking (owner 11.11.2026 «CC — это футворк»): toprock → footwork → power → freeze
  const COUNT = 4, TOP = 8, FOOT = 8, POW = 8, FRZ = 4, OUTRO = 3; // beats
  const B_TOP = COUNT, B_FOOT = B_TOP + TOP, B_POW = B_FOOT + FOOT, B_FRZ = B_POW + POW, B_BIG = B_FRZ + 3, B_END = B_FRZ + FRZ + OUTRO;
  let TRAVEL = 2 * BEAT;              // how long a note is on the track before the ring (set per beat in start())
  const W_PERF = .08, W_GOOD = .16;   // tap windows, seconds either side
  const DIFF = { toprock: 1, kickstep: 1, salsa: 2, indian: 2, sixstep: 1, ccs: 2, backspin: 1, swipe: 2, windmill: 2, backflip: 3, headspin: 3,
    flare: 3, airflare: 3, ninety: 3, freeze: 1, headstand: 2, handstand: 2, airchair: 3, hollowback: 3 };
  const NEED = { windmill: 3, backflip: 3, handstand: 3, airchair: 3, headspin: 5, flare: 5, airflare: 5, ninety: 5, hollowback: 5 }; // hero level
  const ROWS = [['TOPROCK', ['toprock', 'kickstep', 'salsa', 'indian']], ['FOOTWORK', ['sixstep', 'ccs']],
    ['POWER', ['backspin', 'swipe', 'windmill', 'headspin', 'flare', 'airflare', 'ninety']],
    ['FREEZE', ['freeze', 'headstand', 'handstand', 'airchair', 'hollowback']]];
  const MULT = [0, 1, 1.35, 1.7];
  const PAT = [null, [[0, 1, 2, 3]],
    [[0, 1, 1.5, 2, 3], [0, .5, 1, 2, 3], [0, 1, 2, 2.5, 3], [0, 1, 2, 3, 3.5]],
    [[0, .5, 1, 1.5, 2, 3, 3.5], [0, .5, 1.5, 2, 2.5, 3], [0, 1, 1.5, 2, 2.5, 3, 3.5], [0, .5, 1, 2, 2.5, 3.5]]];
  const PAT_F = [null, [0, 1, 2], [0, 1, 1.5, 2], [0, .5, 1, 1.5, 2, 2.5]];
  const JOINTS = ['torso', 'head', 'shL', 'elL', 'shR', 'elR', 'hipL', 'kneeL', 'ankL', 'hipR', 'kneeR', 'ankR'];
  const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const mix = (a, b, k) => {
    if (k >= 1 || !a) return b; if (k <= 0) return a;
    const o = {}, ra = a.root || {}, rb = b.root || {};
    JOINTS.forEach(j => { o[j] = (a[j] || 0) + ((b[j] || 0) - (a[j] || 0)) * k; });
    const L = (x, y, d) => { x = x == null ? d : x; y = y == null ? d : y; return x + (y - x) * k; };
    o.root = { x: L(ra.x, rb.x, 0), y: L(ra.y, rb.y, 0), r: L(ra.r, rb.r, 0), sx: L(ra.sx, rb.sx, 1), sy: L(ra.sy, rb.sy, 1), px: rb.px != null ? rb.px : ra.px, py: rb.py != null ? rb.py : ra.py };
    return o;
  };

  // ---- the notes of a round: the same picks + seed always give the same notes (the server can check a score later) ----
  function notesFor(picks, seed, beat) {
    const B = beatOf(beat), bt = 60 / B.bpm, lv = m => clamp(DIFF[m] + B.up, 1, 3);
    const rnd = mulberry(seed || 1), out = [];
    const bars = (b0, n, d, ph) => { for (let b = 0; b < n; b++) { const p = PAT[d][Math.floor(rnd() * PAT[d].length)]; p.forEach(x => out.push({ t: (b0 + b * 4 + x) * bt, ph, big: false, st: 0 })); } };
    bars(B_TOP, TOP / 4, lv(picks[0]), 0);
    bars(B_FOOT, FOOT / 4, lv(picks[1]), 1);
    bars(B_POW, POW / 4, lv(picks[2]), 2);
    PAT_F[lv(picks[3])].forEach(x => out.push({ t: (B_FRZ + x) * bt, ph: 3, big: false, st: 0 }));
    out.push({ t: B_BIG * bt, ph: 3, big: true, st: 0 });
    return out;
  }
  const noteBase = (n, picks, kind, beat) => (kind === 1 ? 100 : 50) * (n.big ? 3 : 1) * MULT[DIFF[picks[n.ph]]] * beatOf(beat).mult;
  const comboMult = c => 1 + Math.min(c, 30) * .02;
  function maxScore(picks, seed, level, beat) { let s = 0, c = 0; notesFor(picks, seed, beat).forEach(n => { c++; s += noteBase(n, picks, 1, beat) * comboMult(c); }); return Math.round(s * (1 + .01 * (level || 1))); }
  // the final score from one result per note (1 perfect, 2 good, 3 miss) + where a stray tap broke the combo (`brk` = index of
  // the note after it). The server (push-worker.js rbScore) counts it exactly the same way — keep them equal.
  function scoreOf(picks, seed, level, beat, hits, brk) {
    const br = new Set(brk || []); let s = 0, c = 0;
    notesFor(picks, seed, beat).forEach((n, i) => { if (br.has(i)) c = 0; const k = +hits[i]; if (k === 3) { c = 0; return; } c++; s += noteBase(n, picks, k, beat) * comboMult(c); });
    return Math.round(s * (1 + .01 * (level || 1)));
  }

  // ---- the beat ----
  let ctx = null, master = null, noise = null;
  function audioOn() {
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
        ctx = new AC(); master = ctx.createGain();
        const comp = ctx.createDynamicsCompressor(); master.connect(comp); comp.connect(ctx.destination);
        noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ctx.state !== 'running') ctx.resume();
      return true;
    } catch (_) { return false; }
  }
  const env = (g, t, a, d) => { g.gain.setValueAtTime(a, t); g.gain.exponentialRampToValueAtTime(.001, t + d); };
  function tone(out, t, type, f0, f1, a, d) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + d * .5); env(g, t, a, d); o.connect(g); g.connect(out); o.start(t); o.stop(t + d + .02); }
  function hiss(out, t, ftype, f, q, a, d) { const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noise; fl.type = ftype; fl.frequency.value = f; fl.Q.value = q; env(g, t, a, d); s.connect(fl); fl.connect(g); g.connect(out); s.start(t, Math.random() * .5, d + .02); }
  const kick = (o, t, a) => tone(o, t, 'sine', 160, 46, a || 1, .3);
  const snare = (o, t, a) => { a = a == null ? 1 : a; hiss(o, t, 'bandpass', 1900, .8, .7 * a, .17); tone(o, t, 'triangle', 200, 150, .35 * a, .1); };
  const rim = (o, t) => { tone(o, t, 'square', 1700, 0, .07, .03); hiss(o, t, 'bandpass', 2600, 2, .25, .05); };
  const hat = (o, t, a) => hiss(o, t, 'highpass', 7500, .5, a, .045);
  const ohat = (o, t, a) => hiss(o, t, 'highpass', 6500, .5, a, .22);
  const crash = (o, t) => hiss(o, t, 'highpass', 4500, .3, .45, .9);
  function bass(o, t, f, d, wave, lp, a) { const os = ctx.createOscillator(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); os.type = wave || 'sawtooth'; os.frequency.value = f; fl.type = 'lowpass'; fl.frequency.value = lp || 520; env(g, t, a || .34, d); os.connect(fl); fl.connect(g); g.connect(o); os.start(t); os.stop(t + d + .02); }
  function chord(o, t, f, iv, wave, lp, a, d) { iv.forEach(m => { const os = ctx.createOscillator(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); os.type = wave; os.frequency.value = f * m; fl.type = 'lowpass'; fl.frequency.value = lp; env(g, t, a, d); os.connect(fl); fl.connect(g); g.connect(o); os.start(t); os.stop(t + d + .04); }); }
  const stab = (o, t, f) => chord(o, t, f, [1, 1.189, 1.498], 'sawtooth', 1500, .06, .32);
  // the DJ's hand on the record: a short noise sweep up or down
  function scratch(o, t, up, a) { const sc = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); sc.buffer = noise; fl.type = 'bandpass'; fl.Q.value = 6; fl.frequency.setValueAtTime(up ? 500 : 2600, t); fl.frequency.exponentialRampToValueAtTime(up ? 2600 : 500, t + .09); g.gain.setValueAtTime(.001, t); g.gain.linearRampToValueAtTime(a || .5, t + .015); g.gain.exponentialRampToValueAtTime(.001, t + .11); sc.connect(fl); fl.connect(g); g.connect(o); sc.start(t, Math.random() * .5, .14); }
  const wood = (o, t) => { tone(o, t, 'triangle', 1250, 0, .2, .05); tone(o, t, 'square', 620, 0, .05, .04); }; // every tap of a hard beat is heard
  const tom = (o, t, f) => tone(o, t, 'sine', f, f * .6, .5, .16);
  // each beat's own sound: drum pattern per 16th, swing (share of a 16th), bass, chords
  const STY = {
    lofi: { sw: .3, kicks: [[0, 10], [0, 7, 10], [0, 9, 11]], sn: [4, 12], snA: .55, rim: [10], hats: 8, hatA: .11, ghostHat: .25, open: [],
      roots: [87.3, 82.4, 92.5], walk: [1, 1.335, 1.189, .891], bw: 'sine', blp: 300, ba: .5, bd: .5,
      ch: (o, t, f, bar, S) => { chord(o, t, f * 2, [1, 1.189, 1.498, 1.782], 'triangle', 1100, .045, 1.6); chord(o, t + 10 * S, f * 2 * 1.122, [1, 1.189, 1.498], 'triangle', 1000, .03, .7); }, crash: [], crackle: true },
    boom: { sw: .19, kicks: [[0, 7, 10], [0, 6, 10], [0, 3, 8, 10]], sn: [4, 12], hats: 8, hatA: .2, ghostHat: .6, open: [],
      roots: [98, 110, 87.3], walk: [1, 1, 1.189, 1.335], bw: 'sawtooth', blp: 520, ba: .34,
      ch: (o, t, f, bar) => { if (bar % 2 === 0) stab(o, t, f * 4); }, crash: [2, 4] },
    funk: { sw: .25, kicks: [[0, 3, 6, 10], [0, 6, 9, 11], [0, 2, 7, 10]], sn: [4, 12], ghost: [7, 9, 15], hats: 16, hatA: .16, open: [14],
      roots: [110, 123.5, 98], walk: [1, 1, 1.335, 1.122], bw: 'square', blp: 700, ba: .22, oct: true,
      ch: (o, t, f, bar, S) => { [6, 14].forEach(x => chord(o, t + x * S, f * 4, [1, 1.26, 1.498], 'sawtooth', 2600, .045, .11)); }, crash: [2, 4] },
    raw: { sw: .1, kicks: [[0, 2, 10, 11], [0, 2, 10], [0, 3, 10, 11]], sn: [4, 12], ghost: [7, 9, 15], ghostA: .45, hats: 16, hatA: .2, open: [6],
      roots: [82.4, 87.3, 73.4], walk: [1, 1.189, 1, 1.498], bw: 'sawtooth', blp: 950, ba: .3, bd: .14,
      ch: (o, t, f) => stab(o, t, f * 4), crash: [0, 2, 4] },
    // DJ CUTS: boom bap, but on every second bar the DJ cuts the sound for a beat and a half (scratch out, scratch back in)
    cut: { sw: .16, kicks: [[0, 3, 10], [0, 7, 10, 11], [0, 6, 10]], sn: [4, 12], ghost: [15], hats: 8, hatA: .18, ghostHat: .5, open: [],
      roots: [92.5, 82.4, 98], walk: [1, 1, 1.189, .891], bw: 'sawtooth', blp: 600, ba: .3,
      ch: (o, t, f, bar) => { if (bar % 2 === 0) stab(o, t, f * 4); }, crash: [0, 4],
      gap: (bar, x) => bar % 2 === 1 && x >= 8 && x < 14,
      fx: (o, tb, bar, bt) => { if (bar % 2 === 1) { scratch(o, tb + 2 * bt - .1, false); scratch(o, tb + 3.5 * bt - .12, true); } else { scratch(o, tb + 3.5 * bt, true, .3); scratch(o, tb + 3.75 * bt, false, .3); } } },
    // TRIPLET FLIP: slow and heavy, the hi-hat plays three to a beat, tom fills in triplets
    trip: { sw: 0, kicks: [[0, 8], [0, 8, 14], [0, 6, 8]], sn: [4, 12], snA: .9, hats: 0, hatA: .17, open: [],
      roots: [77.8, 87.3, 69.3], walk: [1, 1.189, 1.335, 1.189], bw: 'sine', blp: 400, ba: .5, bd: .4,
      ch: (o, t, f, bar) => { chord(o, t, f * 4, [1, 1.189, 1.498], 'triangle', 1400, .05, .9); if (bar % 2) chord(o, t + 2.667 * 60 / 96, f * 4 * 1.122, [1, 1.189, 1.498], 'triangle', 1400, .04, .5); }, crash: [0, 4],
      fx: (o, tb, bar, bt, last) => { for (let k = 0; k < (last ? 9 : 12); k++) hat(o, tb + k * bt / 3, k % 3 === 0 ? .17 : .09); if (bar % 2 === 1 && !last) [0, 1, 2].forEach(k => tom(o, tb + (3 + k / 3) * bt, 190 - k * 35)); } },
    // DOUBLE TIME: a fast break, and every second bar the drummer drops to half time
    dbl: { sw: .06, kicks: [[0, 2, 7, 10], [0, 3, 6, 10, 11], [0, 2, 10, 11]], sn: [4, 12], ghost: [7, 9, 14, 15], ghostA: .4, hats: 16, hatA: .2, open: [6, 14],
      roots: [73.4, 82.4, 77.8], walk: [1, 1, 1.189, 1.498], bw: 'sawtooth', blp: 1100, ba: .3, bd: .12,
      ch: (o, t, f) => stab(o, t, f * 4), crash: [0, 2, 4], half: { kicks: [0, 11], sn: [8], hats: 8 } } };
  // the whole round is scheduled at once (~300 short sounds): no timers to be throttled. preview = only `bars` bars, no count-in
  function schedule(t0, seed, beat, preview, cues) {
    const out = ctx.createGain(); out.connect(master);
    const Y = STY[beatOf(beat).id], bt = 60 / beatOf(beat).bpm, S = bt / 4;
    const rnd = mulberry(seed * 7 + 3), kp = Y.kicks[Math.floor(rnd() * Y.kicks.length)];
    const root = Y.roots[Math.floor(rnd() * Y.roots.length)];
    if (!preview) for (let b = 0; b < COUNT; b++) { tone(out, t0 + b * bt, 'square', 1100, 0, .12, .04); hat(out, t0 + b * bt + bt / 2, .12); }
    const bars = preview || (B_FRZ + FRZ - COUNT) / 4, tb0 = preview ? t0 : t0 + COUNT * bt;
    for (let bar = 0; bar < bars; bar++) {
      const tb = tb0 + bar * 4 * bt, last = !preview && bar === bars - 1, f = root * Y.walk[bar % 4];
      const hf = Y.half && bar % 2 === 1 ? Y.half : null, kpB = hf ? hf.kicks : kp, snB = hf ? hf.sn : Y.sn, hatsB = hf ? hf.hats : Y.hats;
      let kn = 0;
      for (let s = 0; s < 16; s++) {
        const t = tb + s * S + (s % 2 ? Y.sw * S : 0);
        if (last && s >= 12) break; // the freeze hit lands in silence
        if (Y.gap && Y.gap(bar, s)) continue; // the DJ cut the sound
        if (kpB.includes(s)) { kick(out, t); bass(out, t, Y.oct && kn % 2 ? f * 2 : f, s === 0 ? (Y.bd || .32) : Math.min(.18, Y.bd || .18), Y.bw, Y.blp, Y.ba); kn++; }
        if (snB.includes(s)) snare(out, t, Y.snA);
        if (!hf && Y.ghost && Y.ghost.includes(s) && rnd() < .7) snare(out, t, Y.ghostA || .22);
        if (Y.rim && Y.rim.includes(s) && bar % 2) rim(out, t);
        if (!hf && Y.open.includes(s)) ohat(out, t, .13);
        else if (!hatsB) { /* the style plays its own hi-hat (fx) */ }
        else if (hatsB === 16) hat(out, t, s % 4 === 0 ? Y.hatA : s % 2 === 0 ? Y.hatA * .75 : Y.hatA * .45);
        else if (s % 2 === 0) hat(out, t, s % 4 === 0 ? Y.hatA : Y.hatA * .65); else if (s === 15 && rnd() < Y.ghostHat) hat(out, t, Y.hatA * .5);
        if (Y.crackle && rnd() < .35) hiss(out, t + rnd() * S, 'highpass', 3000, .7, .025 + rnd() * .03, .012);
      }
      if (!last || Y === STY.raw) Y.ch(out, tb, f, bar, S);
      if (!preview && Y.crash.includes(bar)) crash(out, tb);
      if (Y.fx) Y.fx(out, tb, bar, bt, last);
    }
    if (cues) cues.forEach(c => wood(out, (preview ? tb0 : t0) + c));
    if (!preview) { const tBig = t0 + B_BIG * bt; kick(out, tBig); snare(out, tBig); crash(out, tBig); stab(out, tBig, root * 4); }
    return out;
  }
  function blip(kind) { // the tap itself is heard at once: a clap for a hit
    if (!ctx || ctx.state !== 'running') return;
    try { const t = ctx.currentTime; if (kind === 1) { hiss(master, t, 'bandpass', 1300, 1.2, .5, .09); tone(master, t, 'triangle', 880, 0, .12, .07); } else if (kind === 2) hiss(master, t, 'bandpass', 1100, 1.2, .28, .07); else tone(master, t, 'sine', 120, 70, .25, .12); } catch (_) {}
  }

  // ---- the screen ----
  let D = null, box = null, G = null, raf = 0, built = false;
  const $ = s => box.querySelector(s);
  const CSS = `
.sheet-bg.rb{background:#0B0B0C}
.rb .btlbox{position:relative;touch-action:none;user-select:none;-webkit-user-select:none}
#rbDraw{position:absolute;left:0;top:0;z-index:8;pointer-events:none}
.rbpad.dr{border-color:#F2CC55;background:rgba(242,204,85,.14);color:#F2CC55}
.rbend p.fc{color:#F2CC55;font-family:var(--display);font-size:18px;letter-spacing:1px;margin-top:6px}
.rbc i u{text-decoration:none;color:var(--fg)}
.rbcoach{margin-top:12px;padding:12px 14px;border:1px solid rgba(59,209,111,.28);background:rgba(59,209,111,.07);border-radius:14px;text-align:left}
.rbcoach p{margin:0 0 8px;font-size:13px;line-height:1.35;color:var(--fg)}
.rbcoach button{background:none;border:0;padding:0;color:#7BE3A0;font-weight:700;font-size:14px}
.rbhead{display:grid;grid-template-columns:1fr auto 1fr;align-items:end;gap:8px}
.rbhead small{display:block;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.6px}
.rbhead b{font-family:var(--display);font-size:28px;line-height:1;font-variant-numeric:tabular-nums}
.rbhead .c{text-align:center;font-family:var(--display);font-size:20px;letter-spacing:.6px;color:var(--accent)}
.rbhead .r{text-align:right} .rbhead .r b.hot{color:#F2CC55}
.rb .fighter{left:29%}
.rb .arena{min-height:150px}
.rbset{flex:0 1 auto;min-height:0;overflow-y:auto;touch-action:pan-y;-webkit-overflow-scrolling:touch}
.rbj{position:absolute;left:0;right:0;top:20%;text-align:center;font-family:var(--display);font-size:34px;letter-spacing:1px;opacity:0;z-index:4;pointer-events:none;text-shadow:0 2px 0 #000}
.rbj.p{color:#F2CC55} .rbj.g{color:#F2EFE8} .rbj.m{color:#77777F}
.rbj.show{animation:rbj .5s ease-out both}
@keyframes rbj{0%{opacity:0;transform:scale(.5)}25%{opacity:1;transform:scale(1.12)}100%{opacity:0;transform:translateY(-16px)}}
.rbtrack{position:relative;height:66px;margin-top:10px;border-radius:14px;background:#141416;border:1px solid #26262A;overflow:hidden}
.rbtrack canvas{display:block;width:100%;height:100%}
.rbpad{margin-top:10px;height:84px;border-radius:18px;border:2px solid var(--accent);background:rgba(226,97,26,.12);color:var(--accent);font-family:var(--display);font-size:30px;letter-spacing:2px;display:flex;align-items:center;justify-content:center;transition:transform .08s,background .08s}
.rbpad.hit{background:rgba(226,97,26,.45);transform:scale(.97)}
.rbset h3{font-family:var(--display);font-size:24px;letter-spacing:.5px;margin:12px 0 2px;font-weight:400}
.rbset p{font-size:12.5px;color:var(--soft);line-height:1.35}
.rbrow{margin-top:9px} .rbrow>small{display:block;font-size:10px;color:var(--muted);letter-spacing:1px;margin-bottom:5px}
.rbcards{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}
.rbc{position:relative;padding:9px 4px 7px;border-radius:12px;border:1.5px solid #2A2A2F;background:#17171A;color:var(--fg);text-align:center;min-height:58px}
.rbc b{display:block;font-family:var(--display);font-size:15px;font-weight:400;letter-spacing:.4px;line-height:1.05}
.rbc i{display:block;font-style:normal;font-size:10px;color:var(--muted);margin-top:4px;letter-spacing:1px}
.rbc i em{font-style:normal;color:#F2CC55}
.rbc.on{border-color:var(--accent);background:rgba(226,97,26,.16)}
.rbc.lock{opacity:.45}
.rbc.lock.ul{opacity:.8;border-style:dashed;border-color:#5A4A2A} .rbc.lock.ul i{color:#F2CC55}
.rbc.lock.ul.st{opacity:.95;border-style:solid;border-color:rgba(59,209,111,.5)} .rbc.lock.ul.st i{color:#7BE3A0}
.rbc.fr:after{content:"🎬";position:absolute;top:3px;right:5px;font-size:10px}
.rbcards.b4 .rbc{padding:9px 2px 7px} .rbcards.b4 .rbc b{font-size:11.5px;letter-spacing:0} .rbcards.b4 .rbc i{letter-spacing:.3px}
.rbul{margin-top:9px;padding:10px 12px;border-radius:12px;border:1px dashed #5A4A2A;background:rgba(242,204,85,.07);font-size:12.5px;line-height:1.4;color:var(--soft)}
.rbulnote{margin-top:6px;font-size:12.5px;color:#F2CC55;line-height:1.35}
.rbtip{position:relative;margin-top:10px;scroll-margin-bottom:150px;padding:10px 12px;border-radius:12px;background:#F2CC55;color:#17171A;font-size:13px;line-height:1.35;font-weight:600;display:flex;gap:10px;align-items:center;animation:rbtipin .3s ease-out}
.rbtip:before{content:"";position:absolute;top:-7px;left:var(--ax,85%);margin-left:-7px;border:7px solid transparent;border-top:0;border-bottom-color:#F2CC55}
.rbtip span{flex:1} .rbtip button{flex:0 0 auto;height:32px;padding:0 12px;border-radius:9px;background:#17171A;color:#fff;font-size:12.5px;font-weight:700}
@keyframes rbtipin{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
.rbc.lock.ul.pulse{animation:rbulp 1.1s ease-in-out infinite}
@keyframes rbulp{0%,100%{box-shadow:0 0 0 0 rgba(242,204,85,0)}50%{box-shadow:0 0 0 4px rgba(242,204,85,.45)}}
.rbul{scroll-margin-bottom:150px} .rbul b{display:inline;font-family:var(--display);font-weight:400;letter-spacing:.4px;font-size:14px;color:var(--fg)} .rbul button{margin-top:8px;height:38px;width:100%;font-size:13.5px}
.rbcards.b4{grid-template-columns:repeat(4,1fr);gap:6px} .rbc.bt{padding:8px 2px 6px;min-height:56px} .rbc.bt b{font-size:13px}
.rbc.bt small{display:block;font-size:9.5px;color:var(--muted);margin-top:3px;letter-spacing:.5px}
.rbc.bt.pl:after{content:"";position:absolute;top:6px;right:6px;width:6px;height:6px;border-radius:50%;background:#3BD16F;animation:rbpl .5s ease-in-out infinite alternate}
@keyframes rbpl{from{opacity:.25;transform:scale(.7)}to{opacity:1;transform:scale(1.2)}}
.rbgo{margin-top:12px;display:flex;gap:8px;position:sticky;bottom:0;background:#0B0B0C;box-shadow:0 -10px 14px 6px #0B0B0C}
.rbgo .btn{flex:1 1 0;width:auto;padding:0 8px;font-size:14px}
.rbpad.auto{border-color:#3A3A40;background:#17171A;color:var(--muted)}
.rbend{text-align:center;padding-top:10px}
.rbend>b{display:block;font-family:var(--display);font-size:40px;line-height:1;animation:vspop .5s cubic-bezier(.2,1.6,.4,1) both}
.rbend>b.win{color:var(--accent)} .rbend>b.lose{color:var(--muted)}
.rbvs{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px;margin-top:10px}
.rbvs small{display:block;font-size:11px;color:var(--muted)} .rbvs span b{font-family:var(--display);font-size:30px;font-weight:400;font-variant-numeric:tabular-nums}
.rbvs .me b{color:var(--accent)} .rbvs .op b{color:#5BB8FF}
.rbvs .judges{margin:0;gap:8px;min-height:0} .rbvs .judge{width:auto}
.rbend p{font-size:12.5px;color:var(--soft);margin-top:8px}
.rbend p.n{color:var(--muted);font-size:11.5px}
.rbbt{display:flex;gap:8px;margin-top:10px} .rbbt .btn{flex:1}
.rbsnd{position:absolute;right:10px;top:10px;z-index:6;width:36px;height:36px;border-radius:50%;border:1px solid #333338;background:rgba(11,11,12,.7);color:var(--fg);display:flex;align-items:center;justify-content:center}
.rbsnd.off{color:var(--accent)}
.rbcnt{position:absolute;left:0;right:0;top:30%;text-align:center;font-family:var(--display);font-size:72px;z-index:4;pointer-events:none;opacity:0}
.rbcnt.show{animation:rbj .55s ease-out both}
.rbvsr{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;margin-top:10px}
.rbvsr>span{display:flex;align-items:center;gap:8px;min-width:0} .rbvsr>span.op{flex-direction:row-reverse;text-align:right}
.rbvsr .hb{flex:none;width:44px;height:44px;border-radius:50%;overflow:hidden;background:#1B1B1F;border:2px solid var(--accent)} .rbvsr .op .hb{border-color:#5BB8FF}
.rbvsr .hb svg{width:100%;height:100%;display:block}
.rbvsr b{display:block;font-size:14px;line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap} .rbvsr small{display:block;font-size:11px;color:var(--muted)}
.rbvsr>span>span{min-width:0}
.rbvsr em{font-style:normal;font-family:var(--display);font-size:24px;color:var(--muted)}
.rbdj{display:flex;align-items:center;gap:10px;margin-top:10px;padding:9px 12px;border-radius:12px;background:#151518;border:1px solid #26262A;color:var(--fg);width:100%;font:inherit;text-align:left}
.rbdj i{font-style:normal;font-size:22px;line-height:1} .rbdj small{display:block;font-size:10.5px;color:var(--muted);letter-spacing:.4px}
.rbdj b{font-family:var(--display);font-size:17px;font-weight:400;letter-spacing:.5px} .rbdj span{flex:1;min-width:0}
.rbdj.pl{border-color:#3BD16F}
.rbmode{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:10px}
.rbmode button{padding:14px 10px 12px;border-radius:16px;border:2px solid var(--accent);background:rgba(226,97,26,.14);color:var(--fg);font:inherit;text-align:center;display:flex;flex-direction:column;align-items:center;gap:5px}
.rbmode button.au{border-color:#3A3A40;background:#17171A}
.rbmode svg{width:30px;height:30px;stroke:var(--accent);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round} .rbmode .au svg{stroke:var(--fg)}
.rbmode b{font-family:var(--display);font-size:21px;font-weight:400;letter-spacing:.6px}
.rbmode small{font-size:11.5px;line-height:1.3;color:var(--soft)}
.rbskip{display:block;margin:10px auto 0;padding:9px 18px;border-radius:12px;border:1px solid #333338;background:#151518;color:var(--fg);font:inherit;font-size:13px}
.rbend p.sent{font-size:14px;color:var(--fg);line-height:1.4;margin-top:12px}
.rbwait{display:flex;align-items:center;justify-content:center;gap:10px;margin-top:12px;color:var(--soft);font-size:13.5px}
.rbwait i{width:16px;height:16px;border-radius:50%;border:2px solid #333;border-top-color:var(--accent);animation:rbspin .8s linear infinite}
@keyframes rbspin{to{transform:rotate(360deg)}}`;
  const SND = on => '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/>' + (on ? '<path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>' : '<path d="m16 9 5 6m0-6-5 6"/>') + '</svg>';

  function build() {
    if (built) return; built = true;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const T = D.T;
    box.innerHTML =
      '<div class="rbhead"><span><small>' + T('Счёт') + '</small><b id="rbScore">0</b></span><span class="c" id="rbPhase"></span><span class="r"><small>' + T('Комбо') + '</small><b id="rbCombo">0</b></span></div>' +
      '<div class="arena" id="rbArena"><div class="spot l"></div><div class="spot r"></div><div class="spk l"></div><div class="spk r"></div>' +
      '<button class="rbsnd" id="rbSnd" type="button" data-nt aria-label="' + T('Звук') + '"></button>' +
      '<div class="rbj" id="rbJ"></div><div class="rbcnt" id="rbCnt"></div>' +
      '<div class="btcam"><div class="fighter" id="rbF"><span class="spinfx"></span><span class="shd"></span><div class="mv"></div></div><div class="btfx" id="rbFx"></div></div>' +
      '<div class="crowd" id="rbCrowd">' + '<i></i>'.repeat(13) + '</div><div class="confetti" id="rbConf"></div></div>' +
      '<div id="rbSet" class="rbset" data-nt></div>' +
      '<div id="rbPlay" hidden><div class="rbtrack"><canvas id="rbCan"></canvas></div><div class="rbpad" id="rbPad">' + T('Тапай!') + '</div><button type="button" class="rbskip" id="rbSkip" data-nt hidden>' + T('Пропустить') + '</button></div>' +
      '<div id="rbEnd" class="rbend" data-nt hidden></div><canvas id="rbDraw" hidden></canvas>' +
      '<div class="btbtns" data-nt><button class="btn btn-ghost" id="rbClose" type="button">' + T('Закрыть') + '</button></div>';
    box.querySelectorAll('#rbCrowd i').forEach((i, k) => { i.style.animationDelay = (-(k * 0.13) % 0.5).toFixed(2) + 's'; });
    $('#rbClose').addEventListener('click', close);
    $('#rbSkip').addEventListener('click', skip);
    $('#rbSnd').addEventListener('click', () => { G.mute = !G.mute; try { localStorage.setItem('fedoskin-rb-mute', G.mute ? '1' : ''); } catch (_) {} paintSnd(); });
    box.addEventListener('pointerdown', e => {
      if (!G || G.mode !== 'play') return;
      if (e.target.closest && e.target.closest('[data-nt]')) return;
      e.preventDefault();
      if (drawOpen(e.timeStamp)) { try { box.setPointerCapture(e.pointerId); } catch (_) {} drawDown(e); } else tap(e.timeStamp, e);
    });
    box.addEventListener('pointermove', e => { if (!G || G.mode !== 'play') return; if (G.hold && !G.hold.auto && e.pointerId === G.hold.id && Math.hypot(e.clientX - G.hold.x, e.clientY - G.hold.y) > 48) holdEnd(stampS(e.timeStamp)); if (G.dr && G.dr.on) { e.preventDefault(); drawMove(e); } });
    ['pointerup', 'pointercancel'].forEach(ev => box.addEventListener(ev, e => { if (G && G.mode === 'play' && G.hold && !G.hold.auto && e.pointerId === G.hold.id) holdEnd(stampS(e.timeStamp)); if (G && G.dr) { G.dr.on = false; G.dr.last = null; } }));
    box.addEventListener('touchstart', e => { if (G && G.mode === 'play' && !(e.target.closest && e.target.closest('[data-nt]'))) e.preventDefault(); }, { passive: false });
    document.addEventListener('visibilitychange', () => { if (document.hidden && G && G.mode === 'play') again(); });
    new MutationObserver(() => { if (D.el.hidden) stop(); }).observe(D.el, { attributes: true, attributeFilter: ['hidden'] });
    window.addEventListener('resize', () => { sizeCan(); if (G && G.mode === 'play' && G.dr) drawPlace(); });
  }
  function paintSnd() { const b = $('#rbSnd'); b.innerHTML = SND(!G.mute); b.classList.toggle('off', G.mute); if (master) master.gain.value = G.mute ? 0 : .85; }
  function sizeCan() { if (!box) return; const c = $('#rbCan'); if (!c) return; const r = c.getBoundingClientRect(), d = Math.min(3, window.devicePixelRatio || 1); if (r.width) { c.width = Math.round(r.width * d); c.height = Math.round(r.height * d); } }

  function open(o) {
    box = D.el.querySelector('.btlbox'); build();
    let mute = false; try { mute = localStorage.getItem('fedoskin-rb-mute') === '1'; } catch (_) {}
    G = { coach: !!(D.isCoach && o.opp && D.isCoach(o.opp)), g: o.g === 2 ? 2 : (o.onEnd || o.result) ? 1 : 2, level: o.level || 1, eq: o.eq || [], oppLevel: o.oppLevel || o.level || 1, onEnd: o.onEnd || null, onAuto: o.onAuto || null, mute, mode: '', picks: null, seed: 1,
      battle: !!(o.onEnd || o.result), answer: !!o.answer, ulOn: !!o.ul, ul: new Set(o.ul && o.ul.have || []), allow: o.ul && o.ul.v2 ? new Set(o.ul.allow || []) : null, ulKeys: new Set(o.ul && o.ul.keys || []), ulHint: o.ul && o.ul.hint || {}, opp: o.opp || null, me: o.me || '', beat: o.dj ? beatOf(o.dj).id : null };
    $('#rbF').querySelector('.mv').innerHTML = HERO.svg(G.level, { uid: 'rb', rig: true, acc: G.eq });
    G.J = HERO.rigJoints($('#rbF').querySelector('svg'));
    $('#rbF').className = 'fighter' + (G.eq.includes('fire') ? ' fire' : '') + (G.eq.includes('cardboard') ? ' cardb' : '');
    paintSnd();
    D.el.hidden = false;
    if (o.result) showResult(o.result); else if (G.battle) choose(); else setup();
    cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
  }
  function stop() { cancelAnimationFrame(raf); raf = 0; if (G) { killBeat(); G.mode = ''; drawOff(); } }
  function close() { stop(); D.el.hidden = true; }
  function killBeat() { if (G && G.out && ctx) { try { G.out.gain.setTargetAtTime(0, ctx.currentTime, .03); const o = G.out; setTimeout(() => { try { o.disconnect(); } catch (_) {} }, 400); } catch (_) {} } if (G) G.out = null; stopPreview(); }

  const again = () => { if (G.battle) choose(); else setup(); };
  // the DJ's track (battle): the player doesn't pick it; a tap on it plays 2 bars
  const djHtml = () => { const B = beatOf(G.beat); return '<button type="button" class="rbdj" id="rbDj"><i aria-hidden="true">🎧</i><span><small>' + D.T('Трек ставит диджей') + '</small><b>' + B.name + '</b></span><small>' + (B.lv > 4 ? '🔥 HARD · ' : '') + B.bpm + ' BPM · ×' + B.mult + '</small></button>'; };
  const djWire = () => { const d = $('#rbDj'); if (!d) return; d.addEventListener('click', () => { if (G.pv) stopPreview(); else { preview(G.beat); d.classList.add('pl'); } }); };
  // ---- 0 (battle): who against whom, which track, and how — by hand or on auto (owner 11.11.2026 «сразу выбрать авто или руками») ----
  function choose() {
    const T = D.T; killBeat();
    G.mode = 'choose'; G.prev = 'bounce'; G.prevAt = performance.now(); drawOff();
    $('#rbPlay').hidden = true; $('#rbEnd').hidden = true; $('#rbSet').hidden = false; $('#rbConf').innerHTML = '';
    $('#rbScore').textContent = '0'; $('#rbCombo').textContent = '0'; $('#rbCombo').classList.remove('hot'); $('#rbPhase').textContent = '';
    $('#rbCrowd').classList.remove('hype'); $('#rbF').classList.remove('spin', 'win', 'lose');
    const o = G.opp, esc = x => String(x == null ? '' : x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    const side = (cls, name, lvl, eq, uid) => '<span class="' + cls + '"><span class="hb">' + (lvl ? HERO.svg(lvl, { uid, bust: true, bg: false, acc: eq || [] }) : '') + '</span><span><b>' + esc(name) + '</b><small>' + (lvl ? T('Ур. {n}', { n: lvl }) : '?') + '</small></span></span>';
    const IC_HAND = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12M11 11.5v-2a1.5 1.5 0 0 1 3 0V12M14 10.5a1.5 1.5 0 0 1 3 0V12M17 11a1.5 1.5 0 0 1 3 0v3a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-2.7L4.3 15a1.6 1.6 0 0 1 2.6-1.8L8 14.5"/></svg>';
    const IC_AUTO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v3M8 8h8a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-5a3 3 0 0 1 3-3zM9.5 13h.01M14.5 13h.01M2 13v2M22 13v2"/></svg>';
    $('#rbSet').innerHTML = '<div class="rbvsr">' + side('me', G.me || T('Ты'), G.level, G.eq, 'rvm') + '<em>VS</em>' + side('op', o ? o.name : T('Соперник'), o && o.lvl, o && o.eq, 'rvo') + '</div>' +
      djHtml() + '<h3>' + (G.answer ? T('Ответь на вызов') : T('Как будешь танцевать?')) + '</h3>' +
      '<div class="rbmode"><button type="button" id="rbHand">' + IC_HAND + '<b>' + T('Сам') + '</b><small>' + (G.answer ? T('Тапай в бит — точность решает') : T('Тапай в бит. Соперник ответит в течение суток')) + '</small></button>' +
      '<button type="button" class="au" id="rbAutoGo">' + IC_AUTO + '<b>' + T('Авто') + '</b><small>' + (G.answer ? T((G.eq || []).includes('girl') ? 'Без тапов — би-гёрл станцует сама' : 'Без тапов — би-бой станцует сам') : T('Без тапов — сразу мультик-батл')) + '</small></button></div>';
    djWire();
    $('#rbHand').addEventListener('click', () => setup());
    // auto (owner 11.11.2026): no tapping to the music — index.html decides (the old cartoon battle, or an instant answer)
    $('#rbAutoGo').addEventListener('click', () => { if (!G.onAuto) { setup(); start(true); return; } wait(T('Судьи смотрят батл…'), '', () => G.onAuto()); });
  }

  // one-time tip under the first locked card that a lesson opens (owner 11.11.2026: explain «смотри урок — откроешь движение»)
  const UL_TIP = 'fedoskin-ul-tip';
  function ulTipOff() {
    const t = $('#rbTip'); if (t) t.remove();
    box && box.querySelectorAll('.rbc.lock.ul.pulse').forEach(x => x.classList.remove('pulse'));
  }
  function ulTip() {
    let seen = false; try { seen = localStorage.getItem(UL_TIP) === '1'; } catch (_) {}
    const card = $('#rbSet').querySelector('.rbc[data-ul]'); if (seen || !card) return;
    try { localStorage.setItem(UL_TIP, '1'); } catch (_) {}
    const row = card.closest('.rbrow'), tip = document.createElement('div');
    tip.className = 'rbtip'; tip.id = 'rbTip';
    tip.innerHTML = '<span>' + D.T('Это движение откроется, если посмотреть его урок. Нажми на карточку.') + '</span><button type="button">' + D.T('Понятно') + '</button>';
    row.after(tip);
    const rr = row.getBoundingClientRect(), cr = card.getBoundingClientRect();
    if (rr.width) tip.style.setProperty('--ax', Math.round((cr.left + cr.width / 2 - rr.left) / rr.width * 100) + '%');
    card.classList.add('pulse');
    tip.querySelector('button').addEventListener('click', ulTipOff);
    setTimeout(() => tip.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 250);
  }

  // ---- 1: build the set ----
  function setup() {
    const T = D.T; killBeat();
    G.mode = 'setup'; G.seed = Math.floor(Math.random() * 1e9) + 1; drawOff();
    G.prevPk = null; if (V2()) try { const pv = JSON.parse(localStorage.getItem(prevKey()) || 'null'); if (Array.isArray(pv) && pv.length === 4) G.prevPk = pv; } catch (_) {}
    const rnd = mulberry(G.seed);
    $('#rbPlay').hidden = true; $('#rbEnd').hidden = true; $('#rbSet').hidden = false; $('#rbConf').innerHTML = '';
    $('#rbScore').textContent = '0'; $('#rbCombo').textContent = '0'; $('#rbCombo').classList.remove('hot'); $('#rbPhase').textContent = '';
    $('#rbCrowd').classList.remove('hype'); $('#rbF').classList.remove('spin', 'win', 'lose');
    // three cards a row: the moves this hero knows (a shuffled three, easy to hard) + the next one still locked as a teaser.
    // Moves open by the hero's level OR by watching their lesson (owner 11.11.2026 «открывать движения в игре через уроки»):
    // up to two moves opened by lessons always get a card (🎬); a locked move that a lesson opens is always shown as a teaser.
    const rows = rowsOf().map(([title, all]) => {
      const have = all.filter(know), locked = all.filter(m => !know(m));
      const sh = have.map(m => [rnd(), m]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
      const take = sh.filter(m => G.ul.has(m) && needOf(m) > G.level).slice(0, 2), byD = d => sh.find(m => tierOf(m) === d && !take.includes(m));
      [1, 2, 3].forEach(d => { const m = take.length < 3 && byD(d); if (m) take.push(m); });
      sh.forEach(m => { if (take.length < 3 && !take.includes(m)) take.push(m); });
      take.sort((a, b) => diffOf(a) - diffOf(b));
      const hinted = locked.find(m => G.ulHint[m]), lock = hinted || (take.length < 3 && locked.length ? locked[0] : null);
      return { title, take, lock };
    });
    G.picks = rows.map(r => r.take[0]); G.prev = G.picks[0]; G.prevAt = performance.now();
    const dots = m => V2() ? '<em>×' + multOf(m) + '</em>' : '<em>' + '●'.repeat(DIFF[m]) + '</em>' + '○'.repeat(3 - DIFF[m]) + ' ×' + MULT[DIFF[m]];
    if (!V2() && beatOf(G.beat).g) G.beat = null;
    if (!G.beat) { let b = ''; try { b = localStorage.getItem('fedoskin-rb-beat') || ''; } catch (_) {} G.beat = beatOf(b).id; }
    const bdots = l => l > 4 ? '<em>🔥' + '●'.repeat(l - 4) + '</em>' : '<em>' + '●'.repeat(l) + '</em>' + '○'.repeat(4 - l);
    $('#rbSet').innerHTML = '<h3>' + T('Собери связку') + '</h3><p>' + T('Тапай в такт биту. Сложное движение даёт больше очков, но попасть труднее.') + (V2() ? ' ' + T('На пауэрмуве проведи пальцем по траектории ног — чем точнее, тем больше очков.') + ' ' + T('На фризе попади в бит и держи палец, пока не заполнится круг.') + (G.prevPk ? ' ' + T('Новая связка: +2 % за каждый элемент, которого не было в твоём прошлом раунде.') : '') : '') + '</p>' +
      (G.ulOn ? '<p class="rbulnote">' + (G.allow ? T('🎬 Новые движения открывают уроки: посмотри урок 3 раза и дорасти до нужного уровня героя') : T('🎬 Смотри уроки — открывай новые движения раньше уровня')) + '</p>' : '') +
      (G.battle ? djHtml() : '<div class="rbrow"><small>BEAT · ' + T('нажми, чтобы послушать') + '</small><div class="rbcards b4">' +
      BEATS.filter(b => V2() || !b.g).map(b => '<button type="button" class="rbc bt' + (b.id === G.beat ? ' on' : '') + '" data-b="' + b.id + '"><b>' + b.name + '</b><i>' + bdots(b.lv) + ' ×' + b.mult + '</i><small>' + b.bpm + ' BPM</small></button>').join('') + '</div></div>') +
      rows.map((r, k) => '<div class="rbrow"><small>' + r.title + '</small><div class="rbcards' + (r.take.length + (r.lock ? 1 : 0) > 3 ? ' b4' : '') + '">' +
        r.take.map((m, i) => '<button type="button" class="rbc' + (i === 0 ? ' on' : '') + (G.ul.has(m) && needOf(m) > G.level ? ' fr' : '') + '" data-r="' + k + '" data-m="' + m + '"><b>' + D.names[m] + '</b><i>' + dots(m) + '</i></button>').join('') +
        (r.lock ? (G.ulHint[r.lock] ? '<button type="button" class="rbc lock ul' + (G.ulHint[r.lock].st ? ' st' : '') + '" data-ul="' + r.lock + '" data-r="' + k + '"><b>' + D.names[r.lock] + '</b><i>' + lockLbl(G.ulHint[r.lock]) + '</i></button>'
          : '<button type="button" class="rbc lock" disabled><b>' + D.names[r.lock] + '</b><i>🔒 ' + T('Ур. {n}', { n: needOf(r.lock) }) + '</i></button>') : '') + '</div></div>').join('') +
      '<div class="rbul" id="rbUl" hidden></div>' +
      '<div class="rbgo"><button type="button" class="btn btn-accent" id="rbGo">' + T('Начать батл') + '</button>' + (G.battle ? '' : '<button type="button" class="btn btn-ghost" id="rbAuto">' + T('Играть на авто') + '</button>') + '</div>';
    djWire();
    $('#rbSet').querySelectorAll('.rbc[data-m]').forEach(b => b.addEventListener('click', () => {
      const k = +b.dataset.r; G.picks[k] = b.dataset.m; G.prev = b.dataset.m; G.prevAt = performance.now();
      $('#rbSet').querySelectorAll('.rbc[data-r="' + k + '"]').forEach(x => x.classList.toggle('on', x === b));
    }));
    // a locked move with a lesson: how to open it + a button to that lesson (or section)
    $('#rbSet').querySelectorAll('.rbc[data-ul]').forEach(b => b.addEventListener('click', () => {
      ulTipOff();
      const m = b.dataset.ul, h = G.ulHint[m], box2 = $('#rbUl'), nm = '<b>' + D.names[m] + '</b>';
      if (!h || !box2) return;
      if (!box2.hidden && box2.dataset.m === m) { box2.hidden = true; return; }
      box2.dataset.m = m; box2.hidden = false;
      box2.innerHTML = (h.lv ? ulText2(h, nm) : (h.id ? T('Открой {move}: посмотри урок «{name}» — хотя бы половину (до 2 минут).', { move: nm, name: esc(h.name) })
        : T('Открой {move}: посмотри уроки раздела {sec} — {n} из {need}.', { move: nm, sec: esc(h.sec), n: h.n, need: h.need })) +
        ' ' + T('Или дорасти до уровня {n}.', { n: needOf(m) })) +
        (D.onUl && !h.st ? '<button type="button" class="btn btn-accent" id="rbUlGo">' + (h.id ? T('Открыть урок') : T('Открыть раздел')) + '</button>' : '');
      const go = $('#rbUlGo'); if (go) go.addEventListener('click', () => D.onUl(h));
      box2.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }));
    ulTip();
    $('#rbSet').querySelectorAll('.rbc[data-b]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.b, again = id === G.beat && G.pv;
      G.beat = id; try { localStorage.setItem('fedoskin-rb-beat', id); } catch (_) {}
      $('#rbSet').querySelectorAll('.rbc[data-b]').forEach(x => x.classList.toggle('on', x === b));
      if (again) stopPreview(); else preview(id);
    }));
    $('#rbGo').addEventListener('click', () => start(false));
    if ($('#rbAuto')) $('#rbAuto').addEventListener('click', () => start(true));
  }

  // a tap on a beat card plays 2 bars of it (another tap on the same card stops it)
  function preview(id) {
    stopPreview();
    if (!audioOn()) return;
    try {
      master.gain.value = G.mute ? 0 : .85;
      const bars = 2, d = bars * 4 * 60 / beatOf(id).bpm;
      const sd = Math.floor(Math.random() * 1e9) + 1, B = beatOf(id), cues = B.g ? RB2.notes(['indian', 'ccs', 'swipe', 'handstand'], sd, id).filter(n => !n.draw && n.b >= 4 && n.b < 4 + bars * 4).map(n => (n.b - 4) * 60 / B.bpm) : null;
      G.pv = schedule(ctx.currentTime + .05, sd, id, bars, cues); G.pvId = id;
      const card = $('#rbSet').querySelector('.rbc[data-b="' + id + '"]'); if (card) card.classList.add('pl');
      const pv = G.pv; G.pvT = setTimeout(() => { if (G.pv === pv) stopPreview(); }, d * 1000 + 300);
    } catch (_) {}
  }
  function stopPreview() {
    if (!G) return; clearTimeout(G.pvT);
    if (G.pv && ctx) { const o = G.pv; try { o.gain.setTargetAtTime(0, ctx.currentTime, .03); } catch (_) {} setTimeout(() => { try { o.disconnect(); } catch (_) {} }, 400); }
    G.pv = null; if (box) box.querySelectorAll('.rbc.pl, .rbdj.pl').forEach(x => x.classList.remove('pl'));
  }

  // ---- 2: the round ----
  // auto = «на рандом» (owner 11.11.2026): random cards, the hero taps by himself — how clean depends on luck and his level
  function start(auto) {
    const T = D.T;
    G.auto = !!auto;
    if (G.auto) G.picks = rowsOf().map((_, k) => { const cs = $('#rbSet').querySelectorAll('.rbc[data-r="' + k + '"][data-m]'); return cs[Math.floor(Math.random() * cs.length)].dataset.m; });
    stopPreview();
    const BB = beatOf(G.beat); BEAT = 60 / BB.bpm; TRAVEL = 2 * BEAT;
    G.notes = notesOf(G.picks, G.seed, G.beat); G.dns = G.notes.filter(n => n.draw); G.dn = G.dns[0] || null; G.dr = null; G.hold = null; G.bigAt = 0;
    if (G.auto) { const pm = clamp(.2 - .015 * G.level + .05 * (BB.lv - 2), .04, .35) * (.5 + Math.random()); G.notes.forEach(n => { n.am = Math.random() < pm + .05 * (lvOf(G.picks[n.ph], G.beat) - 1); /* harder move = more misses (the server's stand-in dancer does the same) */ n.aj = clamp((Math.random() + Math.random() + Math.random() - 1.5) * .11, -.15, .15); }); }
    const pad = $('#rbPad'); pad.textContent = G.auto ? T('Авто') : T('Тапай!'); pad.classList.toggle('auto', G.auto);
    $('#rbSkip').hidden = !G.auto; G.brk = [];
    G.score = 0; G.combo = 0; G.best = 0; G.cnt = [0, 0, 0, 0]; G.missAt = -9; G.bigSt = 0; G.lastBeat = -1; G.shown = -1;
    const now = performance.now(); let lat = 0;
    G.audio = audioOn();
    if (G.audio) { try { lat = clamp((ctx.outputLatency || 0) + (ctx.baseLatency || 0), 0, .25); G.aud0 = ctx.currentTime + .15; master.gain.value = G.mute ? 0 : .85; G.out = schedule(G.aud0, G.seed, G.beat, 0, V2() && BB.g ? G.notes.filter(n => !n.draw && !n.big).map(n => n.t) : null); } catch (_) { G.audio = false; } }
    G.lat = lat; G.perf0 = now + 150; // song second 0 is heard at perf0 + lat
    G.mode = 'play';
    $('#rbSet').hidden = true; $('#rbEnd').hidden = true; $('#rbPlay').hidden = false; sizeCan();
    if (G.dn) drawInit();
    $('#rbPhase').textContent = T('Приготовься');
  }
  const song = p => (p - G.perf0) / 1000 - G.lat;
  function say(kind) { const j = $('#rbJ'); j.textContent = kind === 1 ? 'PERFECT' : kind === 2 ? 'GOOD' : 'MISS'; j.className = 'rbj ' + (kind === 1 ? 'p' : kind === 2 ? 'g' : 'm'); void j.offsetWidth; j.classList.add('show'); }
  function puff() { const fx = $('#rbFx'); for (let k = 0; k < 4; k++) { const d = document.createElement('i'); d.className = 'puff'; d.style.left = (50 + (k - 1.5) * 6) + '%'; d.style.animationDelay = (k * .03) + 's'; fx.appendChild(d); setTimeout(() => d.remove(), 900); } }
  function stars() { const fx = $('#rbFx'); for (let k = 0; k < 8; k++) { const d = document.createElement('i'), a = k / 8 * Math.PI * 2; d.className = 'star'; d.style.left = '50%'; d.style.setProperty('--dx', (Math.cos(a) * 70).toFixed(0) + 'px'); d.style.setProperty('--dy', (Math.sin(a) * 70 - 20).toFixed(0) + 'px'); fx.appendChild(d); setTimeout(() => d.remove(), 800); } }
  function judge(n, kind, s) {
    n.st = kind; n.jt = s; G.cnt[kind]++;
    if (kind === 3) { G.combo = 0; G.missAt = s; }
    else { G.combo++; G.best = Math.max(G.best, G.combo); G.score += ptsOf(n, kind, G.combo) * (1 + .01 * G.level); }
    if (n.big) {
      G.bigSt = kind; if (n.hold) G.bigAt = s;
      const ar = $('#rbArena');
      if (kind !== 3) { ar.classList.remove('shake', 'flash'); void ar.offsetWidth; ar.classList.add('shake', 'flash'); stars(); puff(); $('#rbCrowd').classList.add('hype'); if (navigator.vibrate) try { navigator.vibrate(22); } catch (_) {} }
    }
    say(kind);
    $('#rbScore').textContent = Math.round(G.score); $('#rbCombo').textContent = G.combo; $('#rbCombo').classList.toggle('hot', G.combo >= 8);
  }
  function tap(stamp, e) {
    if (G.auto) return;
    let p = performance.now(); if (stamp && Math.abs(stamp - p) < 500) p = stamp;
    const s = song(p), pad = $('#rbPad'); pad.classList.add('hit'); setTimeout(() => pad.classList.remove('hit'), 90);
    let bestN = null, bd = 9;
    for (const n of G.notes) { if (n.st || n.draw || n.hs) continue; const d = Math.abs(n.t - s); if (d < bd) { bd = d; bestN = n; } if (n.t - s > W_GOOD) break; }
    if (bestN && bd <= W_GOOD && bestN.hold) holdStart(bestN, bd <= W_PERF ? 1 : 2, s, e);
    else if (bestN && bd <= W_GOOD) { const kind = bd <= W_PERF ? 1 : 2; judge(bestN, kind, s); blip(kind); if (kind === 1 && G.combo % 4 === 0) puff(); }
    else if (G.hold) { /* a second finger while holding the freeze */ }
    else if (G.dns && G.dns.some(n => s > n.t - .1 && s < n.end + .15)) { /* fingers near the trajectory: not a stray tap */ }
    else if (s > B_TOP * BEAT - W_GOOD && s < (B_BIG * BEAT) + W_GOOD) { const nx = G.notes.findIndex(n => !n.st && n.t > s); G.brk.push(nx < 0 ? G.notes.length : nx); G.combo = 0; $('#rbCombo').textContent = '0'; $('#rbCombo').classList.remove('hot'); blip(3); } // a tap into nothing breaks the combo
  }
  // ---- the trajectory (rules v2, owner 13.11.2026 «тапаешь, тапаешь и затем нарисуй траекторию ноги в полёте на флаере») ----
  // After the bar of taps of the power move the legs' path appears over the dancer; the finger follows it from the yellow dot
  // before the time bar runs out. How much of the line is covered (in order) and how close the finger stayed give
  // PERFECT / GOOD / MISS, worth 5 taps. Each power move has its own shape; a harder move = a longer line and a thinner corridor.
  const TAU = Math.PI * 2;
  const SHAPES = { // u 0…1 → [x, y] in −1…1 (y down)
    backspin: u => { const a = Math.PI + u * TAU; return [Math.cos(a) * .85, Math.sin(a) * .45]; },                      // one flat circle on the floor
    swipe: u => { const a = Math.PI + u * TAU, y = Math.sin(a); return [Math.cos(a) * .9, (y < 0 ? y * .95 : y * .3) + .3]; }, // a high arc over, a low way back
    windmill: u => { const a = Math.PI + u * 3 * Math.PI, r = 1 - .4 * u; return [Math.cos(a) * r * .95, Math.sin(a) * r * .6]; }, // a circle and a half, winding in
    headspin: u => { const a = Math.PI + u * 4 * Math.PI; return [Math.cos(a) * (.75 - .3 * u), .8 - 1.6 * u + Math.sin(a) * .22]; }, // a spiral going up
    flare: u => { const a = Math.PI + u * 3 * Math.PI, r = 1 - .22 * u, c = Math.cos(a); return [c * r, (.5 * Math.sin(a) - .5 * c * c + .25) * r]; }, // the legs' saddle: high at the sides, low in front
    rninety: u => { const a = u * 5 * Math.PI; return [Math.cos(a) * .55 * (1 - .8 * u), .85 - 1.7 * u + Math.sin(a) * .16 * (1 - .5 * u)]; }, // the same spiral, the other way round
    twok: u => { const a = Math.PI + u * 6 * Math.PI; return [Math.cos(a) * (.7 - .15 * u), .85 - 1.7 * u + Math.sin(a) * .2]; }, // 2000: a wide fast spiral, three turns
    ninety: u => { const a = Math.PI + u * 5 * Math.PI; return [Math.cos(a) * .55 * (1 - .8 * u), .85 - 1.7 * u + Math.sin(a) * .16 * (1 - .5 * u)]; }, // a narrow spiral closing at the top
    airflare: u => { if (u < .6) { const v = u / .6; return [-1 + 2 * v, .1 - Math.abs(Math.sin(3 * Math.PI * v)) * .75]; } const a = (u - .6) / .4 * Math.PI; return [Math.cos(a), .1 + Math.sin(a) * .75]; } }; // three jumps hand to hand, and the way back under
  const drawCan = () => box && box.querySelector('#rbDraw');
  function drawInit() {
    G.dr = { n: G.dn, pts: [], idx: 0, on: false, last: null, good: 0, total: 0, tol: clamp(30 - (RB2.mult(G.picks[2]) - 1) * 8, 17, 30), lab: 0, doneAt: 0, x0: 0, y0: 0, W: 0, H: 0, d: 1 };
    drawCan().hidden = false; drawPlace();
  }
  function drawOff() { const c = drawCan(); if (c) c.hidden = true; if (G) G.dr = null; const pad = box && box.querySelector('#rbPad'); if (pad) pad.classList.remove('dr'); }
  // the drawing field = from the top of the arena to the bottom of the tap pad; the line is centred on it
  function drawPlace() {
    const R = G.dr, c = drawCan(), b = box.getBoundingClientRect(), a = $('#rbArena').getBoundingClientRect(), pd = $('#rbPad').getBoundingClientRect();
    if (!a.width || !pd.width) return;
    R.x0 = a.left; R.y0 = a.top; R.W = a.width; R.H = pd.bottom - a.top; R.d = Math.min(3, window.devicePixelRatio || 1);
    c.style.left = (a.left - b.left) + 'px'; c.style.top = (a.top - b.top) + 'px'; c.style.width = R.W + 'px'; c.style.height = R.H + 'px';
    c.width = Math.round(R.W * R.d); c.height = Math.round(R.H * R.d);
    const f = SHAPES[G.picks[2]] || SHAPES.backspin, S = Math.min(R.W * .4, R.H * .4, 135), cx = R.W / 2, cy = R.H * .5, raw = [];
    for (let k = 0; k <= 400; k++) { const q = f(k / 400); raw.push([cx + (G.dn.mir ? -q[0] : q[0]) * S, cy + q[1] * S]); }
    const keep = R.pts.length ? R.idx / (R.pts.length - 1) : 0, pts = [raw[0]], STEP = 7; let acc = 0; // points 7 px apart along the line
    for (let k = 1; k < raw.length; k++) {
      let ax = raw[k - 1][0], ay = raw[k - 1][1]; const bx = raw[k][0], by = raw[k][1]; let seg = Math.hypot(bx - ax, by - ay);
      while (acc + seg >= STEP) { const t = (STEP - acc) / seg; ax += (bx - ax) * t; ay += (by - ay) * t; pts.push([ax, ay]); seg = Math.hypot(bx - ax, by - ay); acc = 0; }
      acc += seg;
    }
    R.pts = pts; R.idx = Math.round(keep * (pts.length - 1));
  }
  const stampS = stamp => { let p = performance.now(); if (stamp && Math.abs(stamp - p) < 500) p = stamp; return song(p); };
  function drawOpen(stamp) { if (!G.dr || G.auto || G.dn.st) return false; const s = stampS(stamp); return s >= G.dn.t - .08 && s <= G.dn.end; }
  function drawDown(e) { const R = G.dr; R.on = true; R.last = null; drawMove(e); }
  function drawFeed(x, y) {
    const R = G.dr, P = R.pts, tol = R.idx === 0 ? R.tol * 1.4 : R.tol; R.total++;
    for (let j = Math.min(P.length - 1, R.idx + 5); j >= Math.max(0, R.idx - 3); j--) {
      if (Math.hypot(P[j][0] - x, P[j][1] - y) <= tol) { R.good++; if (j + 1 > R.idx) R.idx = Math.min(P.length - 1, j + 1); return; }
    }
  }
  function drawMove(e) {
    const R = G.dr; if (!R || G.dn.st) return;
    const x = e.clientX - R.x0, y = e.clientY - R.y0;
    if (R.last) { const n = Math.min(40, Math.ceil(Math.hypot(x - R.last[0], y - R.last[1]) / 5)); for (let k = 1; k <= n; k++) drawFeed(R.last[0] + (x - R.last[0]) * k / n, R.last[1] + (y - R.last[1]) * k / n); }
    else drawFeed(x, y);
    R.last = [x, y];
    if (R.idx >= R.pts.length - 1) drawEnd(stampS(e.timeStamp));
  }
  // how well it was drawn: the share of the line covered × (how close the finger stayed)
  const drawKind = R => { const cover = R.idx / Math.max(1, R.pts.length - 1), q = cover * (.6 + .4 * (R.total ? R.good / R.total : 0)); return q >= .85 ? 1 : q >= .5 ? 2 : 3; };
  function drawEnd(s, kind) {
    const R = G.dr, n = G.dn; if (!R || n.st) return;
    kind = kind || drawKind(R); R.on = false; R.doneAt = s; judge(n, kind, s); blip(kind);
    if (kind !== 3) { stars(); if (navigator.vibrate) try { navigator.vibrate(16); } catch (_) {} }
  }
  function drawTick(n, s) {
    if (n !== G.dn) { // the second trajectory takes over when the first one is done
      if (!n.st && G.dn.st && G.dns.indexOf(n) > G.dns.indexOf(G.dn) && (s - ((G.dr && G.dr.doneAt) || 0) > .35 || s >= n.t - .15)) { G.dn = n; drawInit(); } else return;
    }
    const R = G.dr, pad = $('#rbPad'); if (!R) return;
    if (!n.st) {
      if (!R.lab && s >= n.t - BEAT) { R.lab = 1; pad.textContent = D.T('Рисуй!'); pad.classList.add('dr'); }
      if (G.auto) { const k = clamp((s - n.t) / ((n.end - n.t) * .8), 0, 1); R.idx = Math.floor((R.pts.length - 1) * k * (n.am ? .45 : 1)); if (k >= 1) drawEnd(s, n.am ? 3 : Math.abs(n.aj) <= W_PERF ? 1 : 2); }
      else if (s > n.end) drawEnd(s);
    }
    if (n.st && R.lab === 1) { R.lab = 2; pad.textContent = G.auto ? D.T('Авто') : D.T('Тапай!'); pad.classList.remove('dr'); }
  }
  function drawPaint(s) {
    const R = G.dr, n = G.dn, c = drawCan(), x = c.getContext('2d'), P = R.pts;
    x.setTransform(R.d, 0, 0, R.d, 0, 0); x.clearRect(0, 0, R.W, R.H);
    const t0 = n.t - 2 * BEAT; if (s < t0 || !P.length || (R.doneAt && s - R.doneAt > .5) || s > n.end + .6) return;
    const live = s >= n.t - .08 && !n.st, fade = R.doneAt ? clamp(1 - (s - R.doneAt) / .5, 0, 1) : 1, a = (live || n.st ? 1 : .25 + .45 * clamp((s - t0) / (2 * BEAT), 0, 1)) * fade;
    const line = (from, to, col, w) => { if (to - from < 1) return; x.strokeStyle = col; x.lineWidth = w; x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath(); x.moveTo(P[from][0], P[from][1]); for (let k = from + 1; k <= to; k++) x.lineTo(P[k][0], P[k][1]); x.stroke(); };
    const L = P.length - 1;
    x.globalAlpha = a;
    line(0, L, 'rgba(11,11,12,.6)', 26); line(0, L, 'rgba(242,239,232,.34)', 15);
    line(0, R.idx, n.st === 1 ? '#F2CC55' : n.st === 2 ? '#F2EFE8' : n.st === 3 ? '#6A6A72' : '#E2611A', 15);
    if (!n.st) {
      x.fillStyle = 'rgba(242,204,85,.9)'; // little arrows: which way to go
      for (let j = R.idx + 7; j < L - 1; j += 13) { const ang = Math.atan2(P[j + 1][1] - P[j - 1][1], P[j + 1][0] - P[j - 1][0]); x.save(); x.translate(P[j][0], P[j][1]); x.rotate(ang); x.beginPath(); x.moveTo(5, 0); x.lineTo(-4, -4.5); x.lineTo(-4, 4.5); x.closePath(); x.fill(); x.restore(); }
      const h = P[Math.min(R.idx, L)], ph = ((s / BEAT) % 1 + 1) % 1, r = 13 * (1 + .25 * Math.max(0, 1 - ph * 2.5));
      x.fillStyle = '#F2CC55'; x.beginPath(); x.arc(h[0], h[1], r, 0, 7); x.fill(); x.strokeStyle = '#0B0B0C'; x.lineWidth = 3; x.stroke();
      x.strokeStyle = '#F2CC55'; x.lineWidth = 2; x.beginPath(); x.arc(P[L][0], P[L][1], 9, 0, 7); x.stroke(); // where the line ends
      if (live) { const k = clamp((n.end - s) / (n.end - n.t), 0, 1); x.fillStyle = 'rgba(255,255,255,.14)'; x.fillRect(12, R.H - 7, R.W - 24, 4); x.fillStyle = k < .3 ? '#E2611A' : '#F2CC55'; x.fillRect(12, R.H - 7, (R.W - 24) * k, 4); }
    }
    x.globalAlpha = 1;
  }
  function draw(s) {
    const c = $('#rbCan'), x = c.getContext('2d'), W = c.width, H = c.height, d = W / (c.getBoundingClientRect().width || W), hx = W * .2, pps = (W * .8) / TRAVEL, cy = H / 2;
    x.clearRect(0, 0, W, H);
    x.strokeStyle = '#2A2A2F'; x.lineWidth = 2 * d; x.beginPath(); x.moveTo(0, cy); x.lineTo(W, cy); x.stroke();
    const b0 = Math.floor(s / BEAT) - 1; x.fillStyle = '#34343A';
    for (let b = b0; b < b0 + 6; b++) { const px = hx + (b * BEAT - s) * pps; if (px > 0 && px < W) x.fillRect(px - d, cy - 9 * d, 2 * d, 18 * d); }
    const ph = ((s / BEAT) % 1 + 1) % 1, pulse = 1 + .16 * Math.max(0, 1 - ph * 3);
    x.strokeStyle = '#F2EFE8'; x.lineWidth = 3 * d; x.beginPath(); x.arc(hx, cy, 19 * d * pulse, 0, 7); x.stroke();
    for (const n of G.notes) {
      const dt = n.t - s; if (dt > TRAVEL + .2) break;
      if (n.draw) { // the trajectory on the track: a long yellow bar
        const x0 = hx + dt * pps, x1 = hx + (n.end - s) * pps; if (x1 < 0) continue;
        x.globalAlpha = n.st === 3 ? .2 : n.st ? .35 : .9; x.fillStyle = n.st === 3 ? '#55555C' : '#F2CC55';
        const h2 = 13 * d; x.beginPath(); if (x.roundRect) x.roundRect(x0, cy - h2, x1 - x0, h2 * 2, h2); else x.rect(x0, cy - h2, x1 - x0, h2 * 2); x.fill();
        x.fillStyle = '#0B0B0C'; x.font = (12 * d) + 'px Anton, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('DRAW', (Math.max(x0, 0) + Math.min(x1, W)) / 2, cy + d); x.globalAlpha = 1;
        continue;
      }
      const px = hx + dt * pps, r = (n.big ? 20 : 13) * d;
      if (n.hold && n.st !== 3) { const x1 = hx + (n.end - s) * pps; if (x1 > 0) { x.globalAlpha = .45; x.fillStyle = '#F2CC55'; x.fillRect(Math.max(px, 0), cy - 7 * d, x1 - Math.max(px, 0), 14 * d); x.globalAlpha = 1; } }
      if (n.st === 1 || n.st === 2) { const k = Math.max(0, (s - n.jt) / .25); if (k < 1) { x.globalAlpha = 1 - k; x.strokeStyle = n.st === 1 ? '#F2CC55' : '#F2EFE8'; x.lineWidth = 3 * d; x.beginPath(); x.arc(hx, cy, r * (1 + k * 1.2), 0, 7); x.stroke(); x.globalAlpha = 1; } continue; }
      if (px < -r) continue;
      x.globalAlpha = n.st === 3 ? .3 : 1;
      x.fillStyle = n.st === 3 ? '#55555C' : n.big ? '#F2CC55' : '#E2611A';
      x.beginPath(); x.arc(px, cy, r, 0, 7); x.fill();
      if (n.big && !n.st) { x.fillStyle = '#0B0B0C'; x.font = (11 * d) + 'px Anton, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('FRZ', px, cy + d); }
      x.globalAlpha = 1;
    }
  }
  // ---- the held freeze (rules v2, owner 13.11.2026 «удержать палец в точке = зафиксировать фриз») ----
  // The last note: hit it in time, then keep the finger down and still (within 48 px) for two beats while the ring fills.
  // Held to the end = the grade of the hit; let go after half = GOOD; earlier = MISS.
  function holdStart(n, kind, s, e) {
    n.hs = true; G.hold = { n, kind, x: e ? e.clientX : 0, y: e ? e.clientY : 0, id: e ? e.pointerId : -1, auto: !e };
    const ar = $('#rbArena'); ar.classList.remove('shake', 'flash'); void ar.offsetWidth; ar.classList.add('shake', 'flash'); puff(); blip(kind);
    const j = $('#rbJ'); j.textContent = 'HOLD!'; j.className = 'rbj g'; void j.offsetWidth; j.classList.add('show');
    const pad = $('#rbPad'); pad.textContent = D.T('Держи!'); pad.classList.add('dr');
    if (navigator.vibrate) try { navigator.vibrate(18); } catch (_) {}
  }
  function holdEnd(s) {
    const H = G.hold; if (!H || H.n.st) return; G.hold = null;
    const n = H.n, k = clamp((s - n.t) / (n.end - n.t), 0, 1), kind = k >= .92 ? H.kind : k >= .5 ? 2 : 3;
    judge(n, kind, s); if (kind === 3) blip(3);
    const pad = $('#rbPad'); pad.classList.remove('dr'); pad.textContent = G.auto ? D.T('Авто') : D.T('Тапай!');
  }
  function holdPaint(s) {
    const n = G.notes[G.notes.length - 1], R = G.dr; if (!n || !n.hold || !R || !R.W) return;
    if (s < n.t - 2 * BEAT || s > n.end + .5 || (n.st && s - n.jt > .5)) return;
    const c = drawCan(), x = c.getContext('2d'), cx = R.W / 2, cy = Math.min(R.H * .3, 150), r0 = 34;
    x.setTransform(R.d, 0, 0, R.d, 0, 0);
    const fade = n.st ? clamp(1 - (s - n.jt) / .5, 0, 1) : 1; x.globalAlpha = fade;
    x.lineWidth = 6; x.strokeStyle = 'rgba(11,11,12,.6)'; x.beginPath(); x.arc(cx, cy, r0, 0, 7); x.stroke();
    x.lineWidth = 4; x.strokeStyle = n.st === 3 ? '#6A6A72' : 'rgba(242,239,232,.55)'; x.beginPath(); x.arc(cx, cy, r0, 0, 7); x.stroke();
    if (!n.hs && !n.st && s < n.t) { const k = clamp((n.t - s) / (2 * BEAT), 0, 1); x.strokeStyle = '#F2CC55'; x.lineWidth = 3; x.beginPath(); x.arc(cx, cy, r0 + 46 * k, 0, 7); x.stroke(); } // closes in on the beat
    const k = n.st && n.st !== 3 ? clamp((n.jt - n.t) / (n.end - n.t), 0, 1) : n.hs && !n.st ? clamp((s - n.t) / (n.end - n.t), 0, 1) : 0;
    if (k > 0) { x.strokeStyle = n.st === 2 ? '#F2EFE8' : '#F2CC55'; x.lineWidth = 7; x.lineCap = 'round'; x.beginPath(); x.arc(cx, cy, r0, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); x.stroke(); }
    x.fillStyle = n.st === 3 ? '#6A6A72' : '#F2CC55'; x.font = '15px Anton, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(n.hs || n.st ? 'HOLD' : 'FRZ', cx, cy + 1);
    x.globalAlpha = 1;
  }
  // which pose the hero is in at song second s
  function pose(s) {
    const M = HERO.MOVES, loop = (mv, t, k) => { const d = M[mv].dur * (k || 1); return M[mv].f((((t / d) % 1) + 1) % 1); };
    const tTop = B_TOP * BEAT, tFoot = B_FOOT * BEAT, tPow = B_POW * BEAT, tFrz = B_FRZ * BEAT, tBig = B_BIG * BEAT, fz = M[G.picks[3]], fStart = tBig - .23 * fz.dur;
    const span = (mv, t0, n) => { const d = n * BEAT, reps = Math.max(1, Math.round(d / M[mv].dur)); return M[mv].f((((s - t0) / (d / reps)) % 1 + 1) % 1); };
    let key, p;
    if (s < tTop) { key = 'in'; p = loop('bounce', s + 9); }
    else if (s < tFoot) { key = 'top'; p = loop(G.picks[0], s - tTop, .75); }
    else if (s < tPow) { key = 'foot'; p = span(G.picks[1], tFoot, FOOT); }
    else if (s < tFrz) { key = 'pow'; p = span(G.picks[2], tPow, POW); }
    else if (s < fStart) { key = 'pre'; p = loop(G.picks[0], s - tFrz, .75); }
    else if (G.bigSt === 3) { const t = s - (G.bigAt || (tBig + W_GOOD)); key = 'fail'; p = t < M.shock.dur ? M.shock.f(clamp(t / M.shock.dur, 0, 1)) : loop('lose2', t); }
    else { const u = (s - fStart) / fz.dur; if (u < 1) { key = 'frz'; p = fz.f(clamp(u, 0, 1)); } else { key = 'after'; p = loop('win', s - fStart - fz.dur); } }
    return [key, p];
  }
  const PS = { key: '', from: null, at: 0, pose: null, shd: 1 };
  function drive(key, p, t) {
    if (key !== PS.key) { PS.from = PS.key ? PS.pose : null; PS.at = t; PS.key = key; }
    const k = PS.from ? Math.min(1, (t - PS.at) / .16) : 1, out = mix(PS.from, p, k * k * (3 - 2 * k));
    PS.pose = out; return out;
  }
  function setHero(p) {
    HERO.setPose(G.J, p);
    const y = (p.root && p.root.y) || 0, sh = y < 0 ? Math.max(.45, 1 + y / 150) : y > 30 ? 1.25 : 1;
    if (Math.abs(sh - PS.shd) > .03) { PS.shd = sh; $('#rbF').querySelector('.shd').style.transform = 'scaleX(' + sh.toFixed(2) + ')'; }
  }
  function frame(now) {
    if (!G || D.el.hidden) return;
    raf = requestAnimationFrame(frame);
    const M = HERO.MOVES;
    if (G.mode === 'setup' || G.mode === 'choose') { const t = (now - G.prevAt) / 1000, mv = G.prev, d = M[mv].dur; setHero(drive('s' + mv + G.prevAt, M[mv].f(((t / d) % 1 + 1) % 1), now / 1000)); return; }
    if (G.mode === 'end') { const mv = G.won ? 'win2' : 'lose3', d = M[mv].dur; setHero(drive('e' + mv, M[mv].f((((now - G.endAt) / 1000 / d) % 1 + 1) % 1), now / 1000)); return; }
    if (G.mode !== 'play') return;
    // keep the clock on the sound (the audio clock is the truth; small corrections only)
    if (G.audio && ctx.state === 'running') { const diff = (ctx.currentTime - G.aud0 - G.lat) - song(now); if (Math.abs(diff) > .04) G.perf0 -= diff * 1000 * .15; }
    const s = song(now), T = D.T;
    if (G.auto) for (const n of G.notes) { if (n.t - s > .2) break; if (!n.draw && !n.st && !n.hs && !n.am && s >= n.t + n.aj) { const kind = Math.abs(n.aj) <= W_PERF ? 1 : 2; if (n.hold) { holdStart(n, kind, s); continue; } judge(n, kind, s); blip(kind); const pad = $('#rbPad'); pad.classList.add('hit'); setTimeout(() => pad.classList.remove('hit'), 90); } }
    for (const n of G.notes) { if (n.draw) { drawTick(n, s); continue; } if (!n.st && !n.hs && s - n.t > W_GOOD) judge(n, 3, s); if (n.t - s > W_GOOD) break; }
    const beat = Math.floor(s / BEAT);
    if (beat !== G.lastBeat) {
      G.lastBeat = beat;
      if (beat >= 0 && beat < COUNT) { const c = $('#rbCnt'); c.textContent = beat === COUNT - 1 ? 'GO!' : String(COUNT - 1 - beat); c.classList.remove('show'); void c.offsetWidth; c.classList.add('show'); }
      const ph = beat < B_TOP ? -1 : beat < B_FOOT ? 0 : beat < B_POW ? 1 : beat < B_FRZ ? 2 : 3;
      if (ph !== G.shown) { G.shown = ph; if (ph >= 0) $('#rbPhase').textContent = D.names[G.picks[ph]]; $('#rbF').classList.toggle('spin', (ph === 1 || ph === 2) && D.spin.includes(G.picks[ph])); if (ph === 1 || ph === 2) puff(); }
      if (ph < 3) $('#rbCrowd').classList.toggle('hype', G.combo >= 8);
    }
    if (G.hold && s >= G.hold.n.end) holdEnd(s);
    draw(s); if (G.dr) { drawPaint(s); holdPaint(s); }
    let [key, p] = pose(s);
    p = drive(key, p, s);
    const w = 1 - (s - G.missAt) / .35; if (w > 0 && key !== 'fail') p = mix(p, M.shock.f(.5), w * .6); // a miss: the hero stumbles for a moment
    setHero(p);
    if (s >= B_END * BEAT) finish();
  }

  // auto round: «Пропустить» = the rest of the notes are danced at once (the same luck as if watched)
  function skip() {
    if (!G || G.mode !== 'play' || !G.auto) return;
    const s = B_END * BEAT;
    G.notes.forEach(n => { if (n.st) return; if (n.am) judge(n, 3, s); else judge(n, Math.abs(n.aj) <= W_PERF ? 1 : 2, s); });
    finish();
  }
  // ---- 3: the judges ----
  function finish() {
    const T = D.T, total = G.notes.length, max = maxOf(G.picks, G.seed, G.level, G.beat), hits = G.notes.map(n => n.st).join('');
    drawOff();
    const score = totalOf(G.picks, G.seed, G.level, G.beat, hits, G.brk); G.score = score; $('#rbScore').textContent = score;
    const res = { score, max, picks: G.picks.slice(), seed: G.seed, beat: G.beat, perfect: G.cnt[1], good: G.cnt[2], miss: G.cnt[3], combo: G.best, acc: (G.cnt[1] + G.cnt[2] * .5) / total, hits,
      round: { p: G.picks.slice(), s: G.seed, b: G.beat, h: hits, k: G.brk.slice(0, 300), au: G.auto ? 1 : 0 } };
    if (V2()) { res.round.g = 2; res.round.r = RB2.R; res.draw = G.dns.length ? Math.max(...G.dns.map(n => n.st)) : 0; res.full = !G.cnt[3] && !G.brk.length; res.fresh = RB2.fresh(G.picks, G.prevPk);
      try { localStorage.setItem(prevKey(), JSON.stringify(G.picks)); } catch (_) {} }
    const viaL = G.picks.filter(m => needOf(m) > G.level); if (viaL.length) res.round.u = viaL; // opened by lessons (server checks the rest)
    killBeat(); G.mode = 'end'; G.endAt = performance.now(); G.res = res;
    $('#rbPlay').hidden = true; $('#rbF').classList.remove('spin'); $('#rbPhase').textContent = '';
    if (G.onEnd) { G.won = res.acc >= .6; sendRound(); return; }
    // the trial: the computer dances for the opponent — its picks and accuracy depend on its level
    const ol = G.oppLevel, pk = rowsOf().map(([, all]) => { const have = all.filter(m => needOf(m) <= ol); return have[Math.floor(Math.random() * have.length)]; });
    const opp = Math.round(maxOf(pk, G.seed, ol, G.beat) * clamp(.5 + .04 * ol - .04 * (beatOf(G.beat).lv - 2) + (Math.random() - .5) * .3, .2, .95));
    const pMe = 1 / (1 + Math.exp(-(score - opp) / (.1 * Math.max(score, opp, 1))));
    const votes = [0, 1, 2].map(() => Math.random() < pMe ? 'l' : 'r'), mine = votes.filter(v => v === 'l').length, won = mine >= 2;
    G.won = won;
    const jd = '<div class="judge"><span class="card"></span></div>';
    const end = $('#rbEnd');
    end.innerHTML = '<b id="rbResT" style="visibility:hidden">&nbsp;</b>' +
      '<div class="rbvs"><span class="me"><small>' + T('Ты') + '</small><b>' + score + '</b></span><div class="judges">' + jd + jd + jd + '</div><span class="op"><small>' + T('Соперник') + '</small><b>' + opp + '</b></span></div>' +
      '<p>PERFECT ' + res.perfect + ' · GOOD ' + res.good + ' · MISS ' + res.miss + ' · ' + T('Комбо') + ' ' + res.combo + (res.draw ? ' · ' + T('Траектория') + ' ' + ['', 'PERFECT', 'GOOD', 'MISS'][res.draw] : '') + '</p>' + (res.full ? '<p class="fc">FULL COMBO +10%</p>' : '') + (res.fresh ? '<p class="fc">' + T('Новая связка +{n} %', { n: res.fresh * 2 }) + '</p>' : '') +
      '<p class="n">' + T('Это пробная версия игры: соперник здесь — компьютер.') + '</p>' +
      '<div class="rbbt"><button type="button" class="btn btn-ghost" id="rbAgain">' + T('Ещё раз') + '</button></div>';
    end.hidden = false;
    $('#rbAgain').addEventListener('click', setup);
    const cards = end.querySelectorAll('.card'), g = G;
    votes.forEach((v, k) => setTimeout(() => { if (G !== g || g.mode !== 'end') return; cards[k].className = 'card ' + v; if (navigator.vibrate) try { navigator.vibrate(12); } catch (_) {} }, 400 + k * 550));
    setTimeout(() => {
      if (G !== g || g.mode !== 'end') return;
      const t = $('#rbResT'); t.textContent = won ? T('Победа!') : T('Поражение'); t.className = won ? 'win' : 'lose'; t.style.visibility = '';
      $('#rbCrowd').classList.toggle('hype', won);
      if (won) { const c = $('#rbConf'); for (let k = 0; k < 36; k++) { const i = document.createElement('i'); i.style.left = (Math.random() * 100).toFixed(1) + '%'; i.style.background = ['#E2611A', '#F2CC55', '#F2EFE8', '#3BD16F'][k % 4]; i.style.animationDelay = (Math.random() * .8).toFixed(2) + 's'; c.appendChild(i); } if (navigator.vibrate) try { navigator.vibrate([30, 60, 30, 60, 80]); } catch (_) {} }
    }, 400 + 3 * 550 + 250);
  }

  // battle: after a round by hand the round goes to the server (index.html onEnd → promise). A challenge ⇒ «sent, the other one
  // answers within a day»; an answer ⇒ the judges' result at once. On failure «send again».
  function sendRound() {
    const T = D.T, r = G.res;
    const head = '<b class="win" style="font-size:30px">' + T('Твой раунд') + '</b>' +
      '<div class="rbvs" style="grid-template-columns:1fr"><span class="me"><small>' + T('Счёт') + '</small><b>' + r.score + '</b></span></div>' +
      '<p>PERFECT ' + r.perfect + ' · GOOD ' + r.good + ' · MISS ' + r.miss + ' · ' + T('Комбо') + ' ' + r.combo + (r.draw ? ' · ' + T('Траектория') + ' ' + ['', 'PERFECT', 'GOOD', 'MISS'][r.draw] : '') + '</p>' + (r.full ? '<p class="fc">FULL COMBO +10%</p>' : '') + (r.fresh ? '<p class="fc">' + T('Новая связка +{n} %', { n: r.fresh * 2 }) + '</p>' : '');
    $('#rbCrowd').classList.toggle('hype', r.acc >= .6);
    wait(G.answer ? T('Судьи смотрят батл…') : T('Отправляем раунд…'), head, () => G.onEnd(r));
  }
  // after a battle with the coach himself: a calm offer of his online coaching (owner 13.11.2026 «делай»; at most once a day)
  function coachCard() {
    const end = $('#rbEnd'); if (!G || !G.coach || !D.onCoach || end.querySelector('.rbcoach')) return;
    const day = new Date().toISOString().slice(0, 10); try { if (localStorage.getItem('fedoskin-bt-coach') === day) return; localStorage.setItem('fedoskin-bt-coach', day); } catch (_) {}
    const d = document.createElement('div'); d.className = 'rbcoach'; d.setAttribute('data-nt', '');
    d.innerHTML = '<p>' + D.T('Ты батлил с Федоскиным — тренером и автором этих уроков. Он ведёт учеников онлайн.') + '</p><button type="button">' + D.T('Онлайн-ведение →') + '</button>';
    d.querySelector('button').addEventListener('click', () => D.onCoach());
    const bt = end.querySelector('.rbbt'); if (bt) end.insertBefore(d, bt); else end.appendChild(d);
  }
  function wait(text, head, job) {
    const T = D.T, end = $('#rbEnd'), g = G;
    killBeat(); if (G.mode !== 'end') { G.mode = 'end'; G.endAt = performance.now(); G.won = true; }
    $('#rbSet').hidden = true; $('#rbPlay').hidden = true;
    end.innerHTML = (head || '') + '<div class="rbwait" id="rbWait"><i></i><span>' + text + '</span></div>';
    end.hidden = false;
    Promise.resolve().then(job).then(x => {
      if (G !== g || D.el.hidden || !x) return;
      if (x.result) return showResult(x.result);
      const w = $('#rbWait'); if (!w) return;
      w.outerHTML = '<p class="sent">' + (x.text || '') + '</p><div class="rbbt"><button type="button" class="btn btn-accent" id="rbDone">' + T('Готово') + '</button></div>';
      $('#rbDone').addEventListener('click', close); coachCard();
    }).catch(e => {
      if (G !== g || D.el.hidden) return;
      const w = $('#rbWait'); if (!w) return;
      w.outerHTML = '<p>' + ((e && e.message) || T('Не получилось отправить раунд. Проверь интернет.')) + '</p>' + (e && e.final ? '' : '<div class="rbbt"><button type="button" class="btn btn-accent" id="rbRetry">' + T('Отправить ещё раз') + '</button></div>');
      const b = $('#rbRetry'); if (b) b.addEventListener('click', () => wait(text, head, job));
    });
  }
  // the judges' result of a battle by hand (no cartoon — owner 11.11.2026): both scores, three cards one by one, the verdict
  // r = { my: {sc, pf, gd, ms}, their: {sc}, votes: ['l' (for me) | 'r', ×3], won, note }
  function showResult(r) {
    const T = D.T, end = $('#rbEnd'), g = G, my = r.my || {}, th = r.their || {};
    killBeat(); G.mode = 'end'; G.endAt = performance.now(); G.won = !!r.won;
    $('#rbSet').hidden = true; $('#rbPlay').hidden = true; $('#rbPhase').textContent = ''; $('#rbConf').innerHTML = '';
    $('#rbScore').textContent = my.sc || 0; $('#rbCombo').textContent = '0';
    const jd = '<div class="judge"><span class="card"></span></div>', esc = x => String(x == null ? '' : x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    end.innerHTML = '<b id="rbResT" style="visibility:hidden">&nbsp;</b>' +
      '<div class="rbvs"><span class="me"><small>' + T('Ты') + '</small><b>' + (my.sc || 0) + '</b></span><div class="judges">' + jd + jd + jd + '</div><span class="op"><small>' + esc(G.opp ? G.opp.name : T('Соперник')) + '</small><b>' + (th.sc || 0) + '</b></span></div>' +
      (my.pf != null ? '<p>PERFECT ' + my.pf + ' · GOOD ' + my.gd + ' · MISS ' + my.ms + (my.dr ? ' · ' + T('Траектория') + ' ' + ['', 'PERFECT', 'GOOD', 'MISS'][my.dr] : '') + '</p>' + (my.g === 2 && my.ms === 0 && my.fc ? '<p class="fc">FULL COMBO +10%</p>' : '') + (my.nv ? '<p class="fc">' + T('Новая связка +{n} %', { n: my.nv * 2 }) + '</p>' : '') : '') +
      (r.note ? '<p class="n">' + esc(r.note) + '</p>' : '');
    end.hidden = false; setTimeout(() => { if (G === g && g.mode === 'end') coachCard(); }, 500 + ((r.votes || []).length) * 600 + 900);
    const cards = end.querySelectorAll('.card'), votes = r.votes || [];
    votes.forEach((v, k) => setTimeout(() => { if (G !== g || g.mode !== 'end') return; cards[k].className = 'card ' + v; if (navigator.vibrate) try { navigator.vibrate(12); } catch (_) {} }, 500 + k * 600));
    setTimeout(() => {
      if (G !== g || g.mode !== 'end') return;
      const t = $('#rbResT'); t.textContent = r.won ? T('Победа!') : T('Поражение'); t.className = r.won ? 'win' : 'lose'; t.style.visibility = '';
      $('#rbCrowd').classList.toggle('hype', !!r.won);
      if (r.won) { const c = $('#rbConf'); for (let k = 0; k < 36; k++) { const i = document.createElement('i'); i.style.left = (Math.random() * 100).toFixed(1) + '%'; i.style.background = ['#E2611A', '#F2CC55', '#F2EFE8', '#3BD16F'][k % 4]; i.style.animationDelay = (Math.random() * .8).toFixed(2) + 's'; c.appendChild(i); } if (navigator.vibrate) try { navigator.vibrate([30, 60, 30, 60, 80]); } catch (_) {} }
    }, 500 + votes.length * 600 + 250);
  }
  // for checks: render a beat offline and return its loudness per second (window.RB._render('funk'))
  async function render(beat, preview) {
    const dur = preview ? preview * 4 * 60 / beatOf(beat).bpm + 1 : (B_END + 1) * 60 / beatOf(beat).bpm, sr = 22050;
    const oc = new OfflineAudioContext(1, Math.ceil(sr * dur), sr), keep = [ctx, master, noise];
    ctx = oc; master = oc.createGain(); master.connect(oc.destination);
    noise = oc.createBuffer(1, sr, sr); const nd = noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    try { schedule(.05, 1, beat, preview); } finally { [ctx, master, noise] = keep; }
    const d = (await oc.startRendering()).getChannelData(0), per = [];
    let peak = 0; for (let k = 0; k < d.length; k += sr) { let q = 0; const e = Math.min(d.length, k + sr); for (let i = k; i < e; i++) { q += d[i] * d[i]; peak = Math.max(peak, Math.abs(d[i])); } per.push(+Math.sqrt(q / (e - k)).toFixed(3)); }
    return { dur: +dur.toFixed(1), peak: +peak.toFixed(2), rms: per };
  }
  window.RB = { init: d => { D = d; }, open, close, result: (o, r) => open(Object.assign({}, o, { result: r })), notesFor, maxScore, scoreOf, BEATS: BEATS.filter(b => !b.g), RB2, _shapes: SHAPES, _render: render, state: () => G };
})();
