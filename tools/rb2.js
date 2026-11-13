// <RB2> rules v2 of the rhythm battle (owner 13.11.2026 «продумай систему батлов, сложность элементов, подсчёт очков, сложные
// диджейские биты, рисование траектории»). SOURCE = tools/rb2.js; `python3 tools/rb2_sync.py` copies this block into rhythm.js
// and server/push-worker.js — the phone and the server must count a round exactly the same way. Do not edit the copies.
const RB2 = (() => {
  // the DJ's tracks: bpm, `up` (shifts how dense the notes are), score multiplier, hardness 1–7, note family
  const BEATS = { lofi: [84, -1, .8, 1, 'st'], boom: [100, 0, 1, 2, 'st'], funk: [114, 0, 1.25, 3, 'st'], raw: [128, 1, 1.55, 4, 'st'],
    cut: [104, 0, 1.75, 5, 'sync'], trip: [96, 0, 1.9, 6, 'trip'], dbl: [140, 0, 2.1, 7, 'dbl'] };
  // how hard a move is in real breaking, 1–10 (the owner corrects this table): it sets the score multiplier (×1.0 … ×1.9),
  // how dense the notes are (tier 1–3) and how long the trajectory to draw is
  const D = { toprock: 1, kickstep: 2, salsa: 2, indian: 3, sixstep: 2, ccs: 3,
    backspin: 2, swipe: 4, windmill: 5, headspin: 7, flare: 7, ninety: 8, airflare: 10,
    freeze: 2, headstand: 3, handstand: 4, airchair: 6, hollowback: 8 };
  const tier = d => d <= 2 ? 1 : d <= 5 ? 2 : 3;
  const mult = d => Math.round((1 + .1 * (d - 1)) * 100) / 100;
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
  const B_TOP = 4, B_FOOT = 12, B_POW = 20, B_DRAW = 24, B_DRAW_END = 27.5, B_FRZ = 28, B_BIG = 31;
  const W_DRAW = 5, W_BIG = 3; // a drawn trajectory counts as 5 taps, the freeze hit as 3
  function bar(fam, L, i, rnd) {
    let set;
    if (fam === 'trip') set = rnd() < .3 ? P.st[Math.min(L, 3)] : P.trip[L];
    else if (fam === 'dbl') set = i % 2 ? P.dblH[L] : P.dblD[L];
    else set = P[fam][L];
    return set[Math.floor(rnd() * set.length)];
  }
  // every note: b = its beat, ph = which move it belongs to (0 toprock … 3 freeze), w = weight; draw ⇒ a trajectory until `end`
  function notes(picks, seed, beat) {
    const B = BEATS[beat], fam = B[4], rnd = mul(seed || 1), out = [], L = m => cl(tier(D[m]) + B[1], 1, 4);
    let i = 0;
    const bars = (b0, n, ph) => { for (let k = 0; k < n; k++, i++) bar(fam, L(picks[ph]), i, rnd).forEach(x => out.push({ b: b0 + k * 4 + x, ph, w: 1 })); };
    bars(B_TOP, 2, 0); bars(B_FOOT, 2, 1); bars(B_POW, 1, 2);
    out.push({ b: B_DRAW, end: B_DRAW_END, ph: 2, w: W_DRAW, draw: true });
    PF[L(picks[3])].forEach(x => out.push({ b: B_FRZ + x, ph: 3, w: 1 }));
    out.push({ b: B_BIG, ph: 3, w: W_BIG, big: true });
    return out;
  }
  const base = (n, picks, kind, beat) => (kind === 1 ? 100 : 50) * n.w * mult(D[picks[n.ph]]) * BEATS[beat][2];
  const combo = c => 1 + Math.min(c, 30) * .02;
  // the score from one result per note (1 perfect, 2 good, 3 miss) + where a stray tap broke the combo. A clean round
  // (no miss, no stray tap) = FULL COMBO, +10 %
  function score(picks, seed, beat, hits, brk, level) {
    const br = new Set(brk || []); let s = 0, c = 0, clean = !(brk && brk.length);
    notes(picks, seed, beat).forEach((n, i) => { if (br.has(i)) c = 0; const k = +hits[i]; if (k !== 1 && k !== 2) { c = 0; clean = false; return; } c++; s += base(n, picks, k, beat) * combo(c); });
    return Math.round(s * (clean ? 1.1 : 1) * (1 + .01 * (level || 1)));
  }
  return { BEATS, D, tier, mult, notes, score, base, combo, lv: (m, beat) => cl(tier(D[m]) + BEATS[beat][1], 1, 4), B_DRAW, B_DRAW_END };
})();
// </RB2>
