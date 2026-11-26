// Lesson-based unlocks shared by the rhythm battle and 3D city.
(() => {
  const levels = { windmill: 3, handstand: 3, airchair: 3, headspin: 5, flare: 5, airflare: 5, ninety: 5, hollowback: 5, babylove: 2, rninety: 6 };
  const names = {
    windmill: /windmill/i, handstand: /handstand/i, airchair: /air\s*-?\s*chair/i, headspin: /head\s*-?\s*spin/i,
    flare: /(^|[^a-z])flare/i, airflare: /air\s*-?\s*flare|airtwist/i, ninety: /^(?!.*reverse).*1990/i,
    hollowback: /hollow\s*-?\s*back/i, babylove: /baby\s*-?\s*love/i, rninety: /reverse.*1990/i, swipe: /swipe/i,
  };
  const sections = { airchair: ['Freezes', 2], hollowback: ['Freezes', 3] };
  const catalog = data => (data || []).filter(l => !l.hidden && !/^course:/.test(l.sec || ''));
  const matches = (move, l) => !!names[move]?.test(l.name || '');
  const matching = (lessons, move) => lessons.filter(l => matches(move, l));
  const seconds = l => Math.max(1, Math.ceil(l.dur || 1));
  function bits(l, coverage) {
    const a = new Uint8Array(Math.ceil(seconds(l) / 8)), s = coverage?.[l.id];
    if (s) try {
      const b = atob(s);
      for (let i = 0; i < Math.min(b.length, a.length); i++) a[i] = b.charCodeAt(i);
    } catch (_) {}
    return a;
  }
  function coverageFraction(l, a) {
    const n = seconds(l);
    let seen = 0;
    for (let i = 0; i < n; i++) if (a[i >> 3] & (1 << (i & 7))) seen++;
    return seen / n;
  }
  const full = (l, fraction) => fraction >= .97 || (l.dur > 0 && seconds(l) - Math.round(fraction * seconds(l)) <= 2);
  const views = (l, stats) => Math.min(3, (stats.ulw?.[l.id] || 0) / Math.max(1, l.dur || 1));
  const studied = (whole, count) => whole && count >= 2.98;
  function legacy(level) {
    try {
      const stored = JSON.parse(localStorage.getItem('fedoskin-ul-old') || 'null');
      if (Array.isArray(stored)) return stored;
    } catch (_) {}
    let old = [];
    try {
      const known = JSON.parse(localStorage.getItem('fedoskin-ul') || '[]');
      if (Array.isArray(known)) old = known.filter(m => levels[m]);
    } catch (_) {}
    old = Object.keys(levels).filter(m => levels[m] <= level).concat(old);
    try { localStorage.setItem('fedoskin-ul-old', JSON.stringify(old)); } catch (_) {}
    return old;
  }
  function starterMode() {
    try {
      const saved = localStorage.getItem('fedoskin-starter');
      if (saved) return saved;
      const old = ['fedoskin-bt-rest', 'fedoskin-rb-beat', 'fedoskin-ul-tip', 'fedoskin-rb-mute', 'fedoskin-eq']
        .some(key => localStorage.getItem(key) != null);
      if (old) return 'old';
    } catch (_) {}
    return 'new';
  }
  function state(lessons, level, inherited, progress) {
    const allow = [], have = [], hint = {};
    for (const [move, lv] of Object.entries(levels)) {
      const lvOk = level >= lv;
      if (inherited.includes(move)) { allow.push(move); if (!lvOk) have.push(move); continue; }
      const list = matching(lessons, move), section = sections[move];
      if (list.length) {
        const ordered = list.map(l => ({ l, ...progress(l) }));
        const complete = ordered.find(p => studied(p.full, p.views));
        if (complete && lvOk) { allow.push(move); continue; }
        const { l, full, views } = complete || ordered.sort((a, b) => b.views - a.views || (a.l.dur || 0) - (b.l.dur || 0))[0];
        hint[move] = { id: l.id, name: l.name, p: Math.floor(views * 10) / 10, full, st: !!complete, lvOk, lv };
        continue;
      }
      const sectionLessons = section ? lessons.filter(l => l.sec === section[0]) : [];
      if (!section || sectionLessons.length < section[1]) { if (lvOk) allow.push(move); continue; }
      const need = section[1], n = sectionLessons.filter(l => progress(l).full).length;
      if (n >= need && lvOk) { allow.push(move); continue; }
      hint[move] = { sec: section[0], n: Math.min(n, need), need, st: n >= need, lvOk, lv };
    }
    return { allow, have, hint, keys: Object.keys(levels), v2: true };
  }
  window.BattleStudy = { levels, sections, catalog, matches, matching, bits, coverageFraction, full, views, studied, legacy, starterMode, state };
})();
