// Rhythm battle (owner 10.11.2026 «что-то похожее на настоящую игру»): the player builds a set (toprock + power move +
// freeze), then taps to a beat made right here with WebAudio (no music files, no copyrights). Accuracy drives the score,
// how clean the hero dances and what the judges say. Step 1 = a local round against the computer (`?battle=play`).
// index.html calls RB.init({ T, names, spin }) once and RB.open({ level, eq, nick, oppLevel }).
(function () {
  'use strict';
  const BPM = 100, BEAT = 60 / BPM;
  const COUNT = 4, TOP = 8, POW = 12, FRZ = 4, OUTRO = 3; // beats
  const B_TOP = COUNT, B_POW = B_TOP + TOP, B_FRZ = B_POW + POW, B_BIG = B_FRZ + 3, B_END = B_FRZ + FRZ + OUTRO;
  const TRAVEL = 2 * BEAT;            // how long a note is on the track before the ring
  const W_PERF = .08, W_GOOD = .16;   // tap windows, seconds either side
  const DIFF = { toprock: 1, kickstep: 1, salsa: 2, indian: 2, sixstep: 1, ccs: 1, backspin: 2, swipe: 2, windmill: 2, backflip: 3, headspin: 3,
    flare: 3, airflare: 3, ninety: 3, freeze: 1, headstand: 2, handstand: 2, airchair: 3, hollowback: 3 };
  const NEED = { windmill: 3, backflip: 3, handstand: 3, airchair: 3, headspin: 5, flare: 5, airflare: 5, ninety: 5, hollowback: 5 }; // hero level
  const ROWS = [['TOPROCK', ['toprock', 'kickstep', 'salsa', 'indian']],
    ['POWER', ['sixstep', 'ccs', 'backspin', 'swipe', 'windmill', 'backflip', 'headspin', 'flare', 'airflare', 'ninety']],
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
  function notesFor(picks, seed) {
    const rnd = mulberry(seed || 1), out = [];
    const bars = (b0, n, d, ph) => { for (let b = 0; b < n; b++) { const p = PAT[d][Math.floor(rnd() * PAT[d].length)]; p.forEach(x => out.push({ t: (b0 + b * 4 + x) * BEAT, ph, big: false, st: 0 })); } };
    bars(B_TOP, TOP / 4, DIFF[picks[0]], 0);
    bars(B_POW, POW / 4, DIFF[picks[1]], 1);
    PAT_F[DIFF[picks[2]]].forEach(x => out.push({ t: (B_FRZ + x) * BEAT, ph: 2, big: false, st: 0 }));
    out.push({ t: B_BIG * BEAT, ph: 2, big: true, st: 0 });
    return out;
  }
  const noteBase = (n, picks, kind) => (kind === 1 ? 100 : 50) * (n.big ? 3 : 1) * MULT[DIFF[picks[n.ph]]];
  const comboMult = c => 1 + Math.min(c, 30) * .02;
  function maxScore(picks, seed, level) { let s = 0, c = 0; notesFor(picks, seed).forEach(n => { c++; s += noteBase(n, picks, 1) * comboMult(c); }); return Math.round(s * (1 + .01 * (level || 1))); }

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
  const kick = (o, t) => tone(o, t, 'sine', 160, 46, 1, .3);
  const snare = (o, t) => { hiss(o, t, 'bandpass', 1900, .8, .7, .17); tone(o, t, 'triangle', 200, 150, .35, .1); };
  const hat = (o, t, a) => hiss(o, t, 'highpass', 7500, .5, a, .045);
  const crash = (o, t) => hiss(o, t, 'highpass', 4500, .3, .45, .9);
  function bass(o, t, f, d) { const os = ctx.createOscillator(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); os.type = 'sawtooth'; os.frequency.value = f; fl.type = 'lowpass'; fl.frequency.value = 520; env(g, t, .34, d); os.connect(fl); fl.connect(g); g.connect(o); os.start(t); os.stop(t + d + .02); }
  function stab(o, t, f) { [1, 1.189, 1.498].forEach(m => { const os = ctx.createOscillator(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); os.type = 'sawtooth'; os.frequency.value = f * m; fl.type = 'lowpass'; fl.frequency.value = 1500; env(g, t, .06, .32); os.connect(fl); fl.connect(g); g.connect(o); os.start(t); os.stop(t + .36); }); }
  // the whole round is scheduled at once (20 s, ~300 short sounds): no timers to be throttled
  function schedule(t0, seed) {
    const out = ctx.createGain(); out.connect(master);
    const rnd = mulberry(seed * 7 + 3), S = BEAT / 4;
    const KICKS = [[0, 7, 10], [0, 6, 10], [0, 3, 8, 10]], kp = KICKS[Math.floor(rnd() * KICKS.length)];
    const root = [98, 110, 87.3][Math.floor(rnd() * 3)], walk = [1, 1, 1.189, 1.335];
    for (let b = 0; b < COUNT; b++) { tone(out, t0 + b * BEAT, 'square', 1100, 0, .12, .04); hat(out, t0 + b * BEAT + BEAT / 2, .12); }
    const bars = (B_FRZ + FRZ - COUNT) / 4;
    for (let bar = 0; bar < bars; bar++) {
      const tb = t0 + (COUNT + bar * 4) * BEAT, last = bar === bars - 1;
      for (let s = 0; s < 16; s++) {
        const t = tb + s * S + (s % 2 ? .028 : 0);
        if (last && s >= 12) break; // the freeze hit lands in silence
        if (kp.includes(s)) { kick(out, t); bass(out, t, root * walk[bar % 4], s === 0 ? .32 : .18); }
        if (s === 4 || s === 12) snare(out, t);
        if (s % 2 === 0) hat(out, t, s % 4 === 0 ? .22 : .14); else if (s === 15 && rnd() < .6) hat(out, t, .1);
      }
      if (bar % 2 === 0) stab(out, tb, root * 4 * walk[bar % 4]);
      if (bar === 2 || bar === 4) crash(out, tb);
    }
    const tBig = t0 + B_BIG * BEAT; kick(out, tBig); snare(out, tBig); crash(out, tBig); stab(out, tBig, root * 4);
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
.rb .btlbox{touch-action:none;user-select:none;-webkit-user-select:none}
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
.rbgo{margin-top:12px;width:100%;position:sticky;bottom:0;box-shadow:0 -10px 14px 6px #0B0B0C}
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
.rbcnt.show{animation:rbj .55s ease-out both}`;
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
      '<div id="rbPlay" hidden><div class="rbtrack"><canvas id="rbCan"></canvas></div><div class="rbpad" id="rbPad">' + T('Тапай!') + '</div></div>' +
      '<div id="rbEnd" class="rbend" data-nt hidden></div>' +
      '<div class="btbtns" data-nt><button class="btn btn-ghost" id="rbClose" type="button">' + T('Закрыть') + '</button></div>';
    box.querySelectorAll('#rbCrowd i').forEach((i, k) => { i.style.animationDelay = (-(k * 0.13) % 0.5).toFixed(2) + 's'; });
    $('#rbClose').addEventListener('click', close);
    $('#rbSnd').addEventListener('click', () => { G.mute = !G.mute; try { localStorage.setItem('fedoskin-rb-mute', G.mute ? '1' : ''); } catch (_) {} paintSnd(); });
    box.addEventListener('pointerdown', e => {
      if (!G || G.mode !== 'play') return;
      if (e.target.closest && e.target.closest('[data-nt]')) return;
      e.preventDefault(); tap(e.timeStamp);
    });
    box.addEventListener('touchstart', e => { if (G && G.mode === 'play' && !(e.target.closest && e.target.closest('[data-nt]'))) e.preventDefault(); }, { passive: false });
    document.addEventListener('visibilitychange', () => { if (document.hidden && G && G.mode === 'play') setup(); });
    new MutationObserver(() => { if (D.el.hidden) stop(); }).observe(D.el, { attributes: true, attributeFilter: ['hidden'] });
    window.addEventListener('resize', sizeCan);
  }
  function paintSnd() { const b = $('#rbSnd'); b.innerHTML = SND(!G.mute); b.classList.toggle('off', G.mute); if (master) master.gain.value = G.mute ? 0 : .85; }
  function sizeCan() { if (!box) return; const c = $('#rbCan'); if (!c) return; const r = c.getBoundingClientRect(), d = Math.min(3, window.devicePixelRatio || 1); if (r.width) { c.width = Math.round(r.width * d); c.height = Math.round(r.height * d); } }

  function open(o) {
    box = D.el.querySelector('.btlbox'); build();
    let mute = false; try { mute = localStorage.getItem('fedoskin-rb-mute') === '1'; } catch (_) {}
    G = { level: o.level || 1, eq: o.eq || [], oppLevel: o.oppLevel || o.level || 1, onEnd: o.onEnd || null, mute, mode: '', picks: null, seed: 1 };
    $('#rbF').querySelector('.mv').innerHTML = HERO.svg(G.level, { uid: 'rb', rig: true, acc: G.eq });
    G.J = HERO.rigJoints($('#rbF').querySelector('svg'));
    $('#rbF').className = 'fighter' + (G.eq.includes('fire') ? ' fire' : '') + (G.eq.includes('cardboard') ? ' cardb' : '');
    paintSnd();
    D.el.hidden = false;
    setup();
    cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
  }
  function stop() { cancelAnimationFrame(raf); raf = 0; if (G) { killBeat(); G.mode = ''; } }
  function close() { stop(); D.el.hidden = true; }
  function killBeat() { if (G && G.out && ctx) { try { G.out.gain.setTargetAtTime(0, ctx.currentTime, .03); const o = G.out; setTimeout(() => { try { o.disconnect(); } catch (_) {} }, 400); } catch (_) {} } if (G) G.out = null; }

  // ---- 1: build the set ----
  function setup() {
    const T = D.T; killBeat();
    G.mode = 'setup'; G.seed = Math.floor(Math.random() * 1e9) + 1;
    const rnd = mulberry(G.seed);
    $('#rbPlay').hidden = true; $('#rbEnd').hidden = true; $('#rbSet').hidden = false; $('#rbConf').innerHTML = '';
    $('#rbScore').textContent = '0'; $('#rbCombo').textContent = '0'; $('#rbCombo').classList.remove('hot'); $('#rbPhase').textContent = '';
    $('#rbCrowd').classList.remove('hype'); $('#rbF').classList.remove('spin', 'win', 'lose');
    // three cards a row: the moves this hero knows (a shuffled three, easy to hard) + the next one still locked as a teaser
    const rows = ROWS.map(([title, all]) => {
      const have = all.filter(m => (NEED[m] || 1) <= G.level), locked = all.filter(m => (NEED[m] || 1) > G.level);
      const sh = have.map(m => [rnd(), m]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
      const take = [], byD = d => sh.find(m => DIFF[m] === d && !take.includes(m));
      [1, 2, 3].forEach(d => { const m = byD(d); if (m) take.push(m); });
      sh.forEach(m => { if (take.length < 3 && !take.includes(m)) take.push(m); });
      take.sort((a, b) => DIFF[a] - DIFF[b]);
      const lock = take.length < 3 && locked.length ? locked[0] : null;
      return { title, take, lock };
    });
    G.picks = rows.map(r => r.take[0]); G.prev = G.picks[0]; G.prevAt = performance.now();
    const dots = d => '<em>' + '●'.repeat(d) + '</em>' + '○'.repeat(3 - d) + ' ×' + MULT[d];
    $('#rbSet').innerHTML = '<h3>' + T('Собери связку') + '</h3><p>' + T('Тапай в такт биту. Сложное движение даёт больше очков, но попасть труднее.') + '</p>' +
      rows.map((r, k) => '<div class="rbrow"><small>' + r.title + '</small><div class="rbcards">' +
        r.take.map((m, i) => '<button type="button" class="rbc' + (i === 0 ? ' on' : '') + '" data-r="' + k + '" data-m="' + m + '"><b>' + D.names[m] + '</b><i>' + dots(DIFF[m]) + '</i></button>').join('') +
        (r.lock ? '<button type="button" class="rbc lock" disabled><b>' + D.names[r.lock] + '</b><i>🔒 ' + T('Ур. {n}', { n: NEED[r.lock] }) + '</i></button>' : '') + '</div></div>').join('') +
      '<button type="button" class="btn btn-accent rbgo" id="rbGo">' + T('Начать батл') + '</button>';
    $('#rbSet').querySelectorAll('.rbc[data-m]').forEach(b => b.addEventListener('click', () => {
      const k = +b.dataset.r; G.picks[k] = b.dataset.m; G.prev = b.dataset.m; G.prevAt = performance.now();
      $('#rbSet').querySelectorAll('.rbc[data-r="' + k + '"]').forEach(x => x.classList.toggle('on', x === b));
    }));
    $('#rbGo').addEventListener('click', start);
  }

  // ---- 2: the round ----
  function start() {
    const T = D.T;
    G.notes = notesFor(G.picks, G.seed);
    G.score = 0; G.combo = 0; G.best = 0; G.cnt = [0, 0, 0, 0]; G.missAt = -9; G.bigSt = 0; G.lastBeat = -1; G.shown = -1;
    const now = performance.now(); let lat = 0;
    G.audio = audioOn();
    if (G.audio) { try { lat = clamp((ctx.outputLatency || 0) + (ctx.baseLatency || 0), 0, .25); G.aud0 = ctx.currentTime + .15; master.gain.value = G.mute ? 0 : .85; G.out = schedule(G.aud0, G.seed); } catch (_) { G.audio = false; } }
    G.lat = lat; G.perf0 = now + 150; // song second 0 is heard at perf0 + lat
    G.mode = 'play';
    $('#rbSet').hidden = true; $('#rbEnd').hidden = true; $('#rbPlay').hidden = false; sizeCan();
    $('#rbPhase').textContent = T('Приготовься');
  }
  const song = p => (p - G.perf0) / 1000 - G.lat;
  function say(kind) { const j = $('#rbJ'); j.textContent = kind === 1 ? 'PERFECT' : kind === 2 ? 'GOOD' : 'MISS'; j.className = 'rbj ' + (kind === 1 ? 'p' : kind === 2 ? 'g' : 'm'); void j.offsetWidth; j.classList.add('show'); }
  function puff() { const fx = $('#rbFx'); for (let k = 0; k < 4; k++) { const d = document.createElement('i'); d.className = 'puff'; d.style.left = (50 + (k - 1.5) * 6) + '%'; d.style.animationDelay = (k * .03) + 's'; fx.appendChild(d); setTimeout(() => d.remove(), 900); } }
  function stars() { const fx = $('#rbFx'); for (let k = 0; k < 8; k++) { const d = document.createElement('i'), a = k / 8 * Math.PI * 2; d.className = 'star'; d.style.left = '50%'; d.style.setProperty('--dx', (Math.cos(a) * 70).toFixed(0) + 'px'); d.style.setProperty('--dy', (Math.sin(a) * 70 - 20).toFixed(0) + 'px'); fx.appendChild(d); setTimeout(() => d.remove(), 800); } }
  function judge(n, kind, s) {
    n.st = kind; n.jt = s; G.cnt[kind]++;
    if (kind === 3) { G.combo = 0; G.missAt = s; }
    else { G.combo++; G.best = Math.max(G.best, G.combo); G.score += noteBase(n, G.picks, kind) * comboMult(G.combo) * (1 + .01 * G.level); }
    if (n.big) {
      G.bigSt = kind;
      const ar = $('#rbArena');
      if (kind !== 3) { ar.classList.remove('shake', 'flash'); void ar.offsetWidth; ar.classList.add('shake', 'flash'); stars(); puff(); $('#rbCrowd').classList.add('hype'); if (navigator.vibrate) try { navigator.vibrate(22); } catch (_) {} }
    }
    say(kind);
    $('#rbScore').textContent = Math.round(G.score); $('#rbCombo').textContent = G.combo; $('#rbCombo').classList.toggle('hot', G.combo >= 8);
  }
  function tap(stamp) {
    let p = performance.now(); if (stamp && Math.abs(stamp - p) < 500) p = stamp;
    const s = song(p), pad = $('#rbPad'); pad.classList.add('hit'); setTimeout(() => pad.classList.remove('hit'), 90);
    let bestN = null, bd = 9;
    for (const n of G.notes) { if (n.st) continue; const d = Math.abs(n.t - s); if (d < bd) { bd = d; bestN = n; } if (n.t - s > W_GOOD) break; }
    if (bestN && bd <= W_GOOD) { const kind = bd <= W_PERF ? 1 : 2; judge(bestN, kind, s); blip(kind); if (kind === 1 && G.combo % 4 === 0) puff(); }
    else if (s > B_TOP * BEAT - W_GOOD && s < (B_BIG * BEAT) + W_GOOD) { G.combo = 0; $('#rbCombo').textContent = '0'; $('#rbCombo').classList.remove('hot'); blip(3); } // a tap into nothing breaks the combo
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
      const px = hx + dt * pps, r = (n.big ? 20 : 13) * d;
      if (n.st === 1 || n.st === 2) { const k = (s - n.jt) / .25; if (k < 1) { x.globalAlpha = 1 - k; x.strokeStyle = n.st === 1 ? '#F2CC55' : '#F2EFE8'; x.lineWidth = 3 * d; x.beginPath(); x.arc(hx, cy, r * (1 + k * 1.2), 0, 7); x.stroke(); x.globalAlpha = 1; } continue; }
      if (px < -r) continue;
      x.globalAlpha = n.st === 3 ? .3 : 1;
      x.fillStyle = n.st === 3 ? '#55555C' : n.big ? '#F2CC55' : '#E2611A';
      x.beginPath(); x.arc(px, cy, r, 0, 7); x.fill();
      if (n.big && !n.st) { x.fillStyle = '#0B0B0C'; x.font = (11 * d) + 'px Anton, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('FRZ', px, cy + d); }
      x.globalAlpha = 1;
    }
  }
  // which pose the hero is in at song second s
  function pose(s) {
    const M = HERO.MOVES, loop = (mv, t, k) => { const d = M[mv].dur * (k || 1); return M[mv].f((((t / d) % 1) + 1) % 1); };
    const tTop = B_TOP * BEAT, tPow = B_POW * BEAT, tFrz = B_FRZ * BEAT, tBig = B_BIG * BEAT, fz = M[G.picks[2]], fStart = tBig - .23 * fz.dur;
    let key, p;
    if (s < tTop) { key = 'in'; p = loop('bounce', s + 9); }
    else if (s < tPow) { key = 'top'; p = loop(G.picks[0], s - tTop, .75); }
    else if (s < tFrz) { const span = POW * BEAT, reps = Math.max(1, Math.round(span / M[G.picks[1]].dur)); key = 'pow'; p = M[G.picks[1]].f((((s - tPow) / (span / reps)) % 1 + 1) % 1); }
    else if (s < fStart) { key = 'pre'; p = loop(G.picks[0], s - tFrz, .75); }
    else if (G.bigSt === 3) { const t = s - (tBig + W_GOOD); key = 'fail'; p = t < M.shock.dur ? M.shock.f(clamp(t / M.shock.dur, 0, 1)) : loop('lose2', t); }
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
    if (G.mode === 'setup') { const t = (now - G.prevAt) / 1000, mv = G.prev, d = M[mv].dur; setHero(drive('s' + mv + G.prevAt, M[mv].f(((t / d) % 1 + 1) % 1), now / 1000)); return; }
    if (G.mode === 'end') { const mv = G.won ? 'win2' : 'lose3', d = M[mv].dur; setHero(drive('e' + mv, M[mv].f((((now - G.endAt) / 1000 / d) % 1 + 1) % 1), now / 1000)); return; }
    if (G.mode !== 'play') return;
    // keep the clock on the sound (the audio clock is the truth; small corrections only)
    if (G.audio && ctx.state === 'running') { const diff = (ctx.currentTime - G.aud0 - G.lat) - song(now); if (Math.abs(diff) > .04) G.perf0 -= diff * 1000 * .15; }
    const s = song(now), T = D.T;
    for (const n of G.notes) { if (!n.st && s - n.t > W_GOOD) judge(n, 3, s); if (n.t - s > W_GOOD) break; }
    const beat = Math.floor(s / BEAT);
    if (beat !== G.lastBeat) {
      G.lastBeat = beat;
      if (beat >= 0 && beat < COUNT) { const c = $('#rbCnt'); c.textContent = beat === COUNT - 1 ? 'GO!' : String(COUNT - 1 - beat); c.classList.remove('show'); void c.offsetWidth; c.classList.add('show'); }
      const ph = beat < B_TOP ? -1 : beat < B_POW ? 0 : beat < B_FRZ ? 1 : 2;
      if (ph !== G.shown) { G.shown = ph; if (ph >= 0) $('#rbPhase').textContent = D.names[G.picks[ph]]; $('#rbF').classList.toggle('spin', ph === 1 && D.spin.includes(G.picks[1])); if (ph === 1) puff(); }
      if (ph < 2) $('#rbCrowd').classList.toggle('hype', G.combo >= 8);
    }
    draw(s);
    let [key, p] = pose(s);
    p = drive(key, p, s);
    const w = 1 - (s - G.missAt) / .35; if (w > 0 && key !== 'fail') p = mix(p, M.shock.f(.5), w * .6); // a miss: the hero stumbles for a moment
    setHero(p);
    if (s >= B_END * BEAT) finish();
  }

  // ---- 3: the judges ----
  function finish() {
    const T = D.T, total = G.notes.length, max = maxScore(G.picks, G.seed, G.level), score = Math.round(G.score);
    const res = { score, max, picks: G.picks.slice(), seed: G.seed, perfect: G.cnt[1], good: G.cnt[2], miss: G.cnt[3], combo: G.best, acc: (G.cnt[1] + G.cnt[2] * .5) / total, hits: G.notes.map(n => n.st).join('') };
    killBeat(); G.mode = 'end'; G.endAt = performance.now(); G.res = res;
    $('#rbPlay').hidden = true; $('#rbF').classList.remove('spin'); $('#rbPhase').textContent = '';
    if (G.onEnd) { G.won = res.acc >= .5; G.onEnd(res); return; }
    // the trial: the computer dances for the opponent — its picks and accuracy depend on its level
    const ol = G.oppLevel, pk = ROWS.map(([, all]) => { const have = all.filter(m => (NEED[m] || 1) <= ol); return have[Math.floor(Math.random() * have.length)]; });
    const opp = Math.round(maxScore(pk, G.seed, ol) * clamp(.5 + .04 * ol + (Math.random() - .5) * .3, .2, .95));
    const pMe = 1 / (1 + Math.exp(-(score - opp) / (.1 * Math.max(score, opp, 1))));
    const votes = [0, 1, 2].map(() => Math.random() < pMe ? 'l' : 'r'), mine = votes.filter(v => v === 'l').length, won = mine >= 2;
    G.won = won;
    const jd = '<div class="judge"><span class="card"></span></div>';
    const end = $('#rbEnd');
    end.innerHTML = '<b id="rbResT" style="visibility:hidden">&nbsp;</b>' +
      '<div class="rbvs"><span class="me"><small>' + T('Ты') + '</small><b>' + score + '</b></span><div class="judges">' + jd + jd + jd + '</div><span class="op"><small>' + T('Соперник') + '</small><b>' + opp + '</b></span></div>' +
      '<p>PERFECT ' + res.perfect + ' · GOOD ' + res.good + ' · MISS ' + res.miss + ' · ' + T('Комбо') + ' ' + res.combo + '</p>' +
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

  window.RB = { init: d => { D = d; }, open, close, notesFor, maxScore, BEAT, state: () => G };
})();
