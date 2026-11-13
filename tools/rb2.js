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
