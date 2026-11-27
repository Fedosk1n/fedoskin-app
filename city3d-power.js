// City 3D — DRAWN POWER MOVES in the battles (owner 17.11.2026: «добавь вырисовывание powermove элемента во время батла с бандой
// (подумал, что авто скучно, но и в бит тапать не надо). Интерес будет подогревать возможность идеально сделать какой-то элемент его
// нарисовав. Продумай механику так, чтобы человек и нарисовал и увидел, не отвлекаясь на рисовку, как он сделает элемент, или параллельно»).
//
// How it works. When the hero comes to his power move the battle's clock STOPS — he hangs in the air — and a line appears AROUND him:
// the way his legs will go. The finger LEADS THE LEGS: the recording runs exactly as far as the finger has gone along the line, so the
// legs are always on the finger's side of the circle and the eyes never leave the dancer — drawing the flare IS doing the flare.
// A slow finger slows the move. Lift on the lane after a full turn to land, or ride the guide to its ten-turn limit.
// How close the finger stayed → PERFECT (×1.5 points, gold) / CLEAN / FALL. Nothing touched → after a few seconds he spins by himself,
// as before (the old random outcome). After the set a short replay at the REAL tempo from a lower camera shows how it came out
// (a light trail from the feet: gold = perfect) — the «see it without drawing» half.
// The line is not invented: it is MEASURED from the same motion capture (the angle of the legs round the hips, frame by frame), and
// every point of the line is mapped back to the moment of the recording when the legs are at that angle.
import * as THREE from 'three';
import { mocapPerson, getClip } from './city3d-mocap.js?v=34';
const _t = window._t || ((s, v) => (v ? s.replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? v[k] : m)) : s));   // the city's translation (city3d.html)

// the moves you draw: whose path leads (`sig`: a foot, the middle between the feet, or the turn of the hips), which part of the
// recording is drawn (`a…b`, or `loops` whole loops), the corridor (px on a 390-px-wide phone; harder moves — narrower)
export const DRAW = {
  Breakdance_Swipes: { sig: 'yaw', a: 1.9, b: 2.8, tol: 30, pre: .45 }, // wind-up, then one measured loop
  Head_Spinning: { sig: 'RightFoot', tol: 26 },
  Flair: { sig: 'mid', tol: 24 },
  Breakdance_1990: { sig: 'RightFoot', tol: 13, radius: .8, strict: true },
};
const PERF = .42;         // within ~0.4 of the corridor = «perfect» for that bit of the line (~10 px on a flare)
const PERF_ACC = .82;     // the average needed for ИДЕАЛЬНО (a shaky ±half-corridor finger is CLEAN, not perfect)
const SLOW = .5;          // the time you get = the real tempo ÷ SLOW (+ .7 s)
const RATE = 2.4;         // the legs never go faster than 2.4× the real tempo, even if the finger flies ahead
const STALL = .6;         // no progress for this long = he lost momentum
const WAIT = 2.6, WAIT_NEW = 7;   // how long the hero hangs waiting for the finger (the first two times — longer, with a hint)
// the replay camera: lower than the normal one (0, 15.5, 8.6 = ~61° down) — ~54° down, ~7 m away, slowly going round the dancer
const REP_EL = .95, REP_DIST = 6.3, REP_A0 = .55, REP_A1 = -.25;
const TAU = Math.PI * 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const MAX_TURNS = 10;
const GOLD = '#FFD23F', RED = '#FF5A4F', GREEN = '#3BD16F';

const TR = {}; let probe = null;
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _f = new THREE.Vector3(), _q = new THREE.Quaternion();

export const canDraw = name => !!DRAW[name] && !!getClip(name);

// measure a move once: the angle of the leading point round the hips through the drawn part (on a hidden plain body)
function table(name) {
  if (name in TR) return TR[name];
  const cfg = DRAW[name], clip = getClip(name); if (!cfg || !clip) return (TR[name] = null);
  if (!probe) probe = mocapPerson(HERO.topDown(1, []), { noMerge: true });
  const L = clip.duration, a0 = cfg.a ?? 0, b0 = Math.min(L, cfg.b ?? L), n = Math.max(40, Math.round((b0 - a0) * 120));
  const mx = probe.mixer; mx.stopAllAction();
  const act = mx.clipAction(clip); act.reset(); act.setLoop(THREE.LoopRepeat, Infinity); act.setEffectiveWeight(1); act.play();
  const B = probe.B, ang = new Float64Array(n + 1); let h = 0, r = 0, prev = 0, acc = 0, off = 0;
  for (let i = 0; i <= n; i++) {
    act.time = Math.min(L - 1e-4, a0 + (b0 - a0) * i / n); mx.update(0); probe.root.updateMatrixWorld(true);
    B.Hips.getWorldPosition(_a);
    if (cfg.sig === 'RightFoot' || cfg.sig === 'LeftFoot') B[cfg.sig].getWorldPosition(_b);
    else { B.LeftFoot.getWorldPosition(_b); B.RightFoot.getWorldPosition(_c); _b.add(_c).multiplyScalar(.5); }
    const dx = _b.x - _a.x, dz = _b.z - _a.z; h += _b.y; r += Math.hypot(dx, dz);
    let a = Math.atan2(dz, dx);
    // swipes: the legs whip round with the whole body — follow the turn of the hips, started where the legs are
    if (cfg.sig === 'yaw') { B.Hips.getWorldQuaternion(_q); _f.set(0, 0, 1).applyQuaternion(_q); const y = Math.atan2(_f.z, _f.x); if (i === 0) off = a - y; a = y + off; }
    if (i) { let d = a - prev; d -= TAU * Math.round(d / TAU); acc += d; } else acc = a;
    prev = a; ang[i] = acc;
  }
  mx.stopAllAction();
  // the legs only go one way round: small back-swings are flattened, so every point of the line has exactly one moment of the recording
  const dir = Math.sign(ang[n] - ang[0]) || 1, m = new Float32Array(n + 1); let best = 0;
  for (let i = 0; i <= n; i++) { best = Math.max(best, dir * (ang[i] - ang[0])); m[i] = best + i * 1e-6; }
  const measuredLen = b0 - a0;
  const turn = cfg.b ? Math.min(TAU, m[n]) : m[n];
  const angle = TAU * Math.max(1, Math.round(turn / TAU));
  const seg = cfg.b ? measuredTime(m, measuredLen, turn) : measuredLen;
  const T = { name, cfg, a0, seg, measuredLen, m, dir, ang0: ang[0], turn, angle, tot: TAU * MAX_TURNS,
    h: h / (n + 1), r: r / (n + 1), tol: cfg.tol };
  T.len = timeAt(T, T.tot);
  return (TR[name] = T);
}
function measuredTime(m, duration, angle) {
  let lo = 0, hi = m.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (m[mid] < angle) lo = mid; else hi = mid;
  }
  const f = m[hi] > m[lo] ? clamp((angle - m[lo]) / (m[hi] - m[lo]), 0, 1) : 0;
  return (lo + f) / (m.length - 1) * duration;
}
// Match exact turns on the guide to their measured timing in each repeated recording.
function timeAt(T, psi) {
  const n = clamp(psi, 0, T.tot) / T.angle, loops = Math.floor(n + 1e-9);
  return loops * T.seg + measuredTime(T.m, T.measuredLen, Math.max(0, n - loops) * T.turn);
}
const turnsAt = p => Math.min(MAX_TURNS, Math.floor(p.idx / (p.N - 1) * MAX_TURNS + 1e-6));
const cutTime = (T, t) => T.a0 + t % T.seg;

// Animate a scored CPU attempt using the same measured clip loops as the trace.
function demonstration(J, move, turns) {
  const T = table(move.c);
  const duration = timeAt(T, turns * TAU);
  let elapsed = -T.a0;
  J.play(move.c, { fade: .22 });
  J.act.timeScale = 0;
  return dt => {
    elapsed += dt;
    const time = Math.min(elapsed, Math.max(0, duration - .002));
    J.act.time = time < 0 ? T.a0 + time : cutTime(T, time);
    return elapsed >= duration;
  };
}

export function initPower({ W, camera, sfx = () => {} }) {
  // ---------- the layer the line is drawn on (over the 3D picture, under the battle panel) ----------
  const st = document.createElement('style');
  st.textContent = `#g3pm { position: fixed; inset: 0; width: 100%; height: 100%; z-index: 6; display: none; pointer-events: none; touch-action: none;
    -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
    #g3pm.vis { display: block; } #g3pm.on { pointer-events: auto; }
    body.g3rep #g3bt { opacity: 0; transition: opacity .15s; } body.g3draw #g3mv { opacity: 0; }
    #g3mv small.gold { color: ${GOLD}; text-shadow: 0 0 12px rgba(255,210,63,.55); }`;
  document.head.appendChild(st);
  const cv = document.createElement('canvas'); cv.id = 'g3pm'; document.body.appendChild(cv);
  const g = cv.getContext('2d'); let CW = 1, CH = 1, DPR = 1, dirty = false;
  const size = () => { DPR = Math.min(2, devicePixelRatio || 1); CW = innerWidth; CH = innerHeight; cv.width = Math.round(CW * DPR); cv.height = Math.round(CH * DPR); };
  size(); addEventListener('resize', size);
  const md = () => Math.min(CW, CH), scl = () => clamp(md() / 390, .9, 1.5);

  let P = null;    // the drawing: arm → hold (hangs, waits for the finger) → draw → finish (legs catch up) → done
  let R = null;    // the replay
  let FL = null;   // the big word after the move (ИДЕАЛЬНО / ЧИСТО / СРЫВ)
  let flash = 0;   // the white cut of the replay
  const sparks = [];
  let clock = 0, last = null;

  // ---------- finger ----------
  const fing = { id: null, down: false, x: 0, y: 0, lx: 0, ly: 0 };
  cv.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (R) { R.skip = true; return; }                      // a tap skips the replay
    if (!P || fing.down) return;
    fing.id = e.pointerId; fing.down = true; fing.x = fing.lx = e.clientX; fing.y = fing.ly = e.clientY;
    try { cv.setPointerCapture(e.pointerId); } catch (_) {}
    if (P.st === 'hold') tryStart(e.clientX, e.clientY);
    else if (P.st === 'draw') feed(e.clientX, e.clientY);   // the finger is back on the line in time — go on
  }, { passive: false });
  cv.addEventListener('pointermove', e => {
    if (!fing.down || e.pointerId !== fing.id) return; e.preventDefault();
    const list = (e.getCoalescedEvents && e.getCoalescedEvents()) || []; (list.length ? list : [e]).forEach(q => move(q.clientX, q.clientY));
  }, { passive: false });
  const up = e => {
    if (e.pointerId !== fing.id) return;
    fing.down = false; fing.id = null;
    if (P?.st !== 'draw') return;
    if (e.type === 'pointercancel') { end('cancel'); return; }
    move(e.clientX, e.clientY);
    if (P?.st !== 'draw') return;
    if (P.idx === P.N - 1) end('done');
    else if (turnsAt(P) && P.onTrack) end('exit');
    else end('release');
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('contextmenu', e => e.preventDefault());
  function move(x, y) {
    if (!P) return;
    if (P.st === 'hold') { fing.lx = fing.x = x; fing.ly = fing.y = y; tryStart(x, y); return; }
    if (P.st !== 'draw') return;
    // fill the gaps between finger samples every 5 px, so a fast swipe can't jump over the line
    const dx = x - fing.lx, dy = y - fing.ly, n = clamp(Math.ceil(Math.hypot(dx, dy) / 5), 1, 40);
    for (let i = 1; i <= n && P?.st === 'draw'; i++) feed(fing.lx + dx * i / n, fing.ly + dy * i / n);
    fing.lx = x; fing.ly = y;
  }

  // ---------- where the line is on the screen now ----------
  function geo() {
    const p = P; _a.copy(p.C).project(camera);
    p.cx = (_a.x + 1) / 2 * CW; p.cy = (1 - _a.y) / 2 * CH;
    _b.copy(p.C); _b.x += 1; _b.project(camera); const pxm = Math.max(1, Math.abs((_b.x + 1) / 2 * CW - p.cx));
    _c.copy(p.C); _c.z += 1; _c.project(camera); p.kz = clamp(Math.abs((1 - _c.y) / 2 * CH - p.cy) / pxm, .5, 1.1);
    p.rad = clamp(p.T.r * pxm * 1.35, .24 * md(), .35 * md()) * (p.T.cfg.radius || 1);
    const a = p.pts, unit = p.unit, height = p.kz * p.rad;
    for (let k = 0; k < a.length; k += 2) {
      a[k] = p.cx + p.rad * unit[k]; a[k + 1] = p.cy + height * unit[k + 1];
    }
  }

  // ---------- the battle asks ----------
  // arm(J, step, opt): the step's power clip has just started on J. opt = { first, tolAdd (px), timeAdd (s), wait (s), required, onEnd(res) }.
  // res.grade: 'auto' (nobody drew — the old outcome), 'perfect' | 'good' | 'miss'; res.rel = where the step's time goes on from,
  // res.len = the step's new length, res.rec = the replay.
  function arm(J, s, opt) {
    const T = table(s.c);
    if (!T || J.cur !== s.c || !J.act) { opt.onEnd({ grade: 'auto' }); return false; }
    P = { st: 'arm', J, s, T, opt, t: 0 };
    return true;
  }
  function enterHold() {
    const p = P, J = p.J, T = p.T;
    J.act.time = T.a0; J.act.timeScale = 0;                     // he hangs in the air — the battle's clock stands
    J.B.Hips.getWorldPosition(_a);
    p.C = new THREE.Vector3(_a.x, T.h + (J.lift || 0), _a.z);
    p.ry = J.root.rotation.y; p.dx = J.dx; p.dz = J.dz; p.rx = J.root.position.x; p.rz = J.root.position.z;
    p.phi0 = T.ang0 - p.ry;                                     // the legs' angle in the world (the hero may face any way)
    p.tol = (T.tol + clamp(p.opt.tolAdd || 0, 0, T.cfg.strict ? 4 : 9) + clamp(p.opt.spinTol || 0, 0, 7)) * scl();
    p.limit = T.len / SLOW + .7 + (p.opt.timeAdd || 0);
    p.wait = p.opt.wait ?? (p.opt.first ? WAIT_NEW : WAIT);
    p.camZ = W.camT && W.camT.zoom;
    if (W.camT) {
      W.camT.zoom = .34; W.camT.x = p.C.x; W.camT.z = p.C.z - .555 * p.C.y + .25;
      // Settle the tighter path before the player can start tracing it.
      if (T.cfg.strict) { W.zoom = W.camT.zoom; W.camSnap = true; }
    }
    p.rad = .3 * md() * (T.cfg.radius || 1);
    p.N = Math.max(60, Math.ceil(T.tot * p.rad * 1.06 / 6)); p.pts = new Float32Array(p.N * 2);
    p.unit = new Float32Array(p.pts.length);
    for (let k = 0; k < p.N; k++) {
      const u = k / (p.N - 1), a = p.phi0 + T.dir * u * T.tot, r = .94 + .12 * u;
      p.unit[k * 2] = r * Math.cos(a); p.unit[k * 2 + 1] = r * Math.sin(a);
    }
    Object.assign(p, { st: 'hold', h: 0, idx: 0, at: 0, n: 0, sum: 0, q: 1, wob: 0, lastIdx: 0, lastProg: 0, lap: 0, trail: [],
      bins: new Float32Array(40), binN: new Float32Array(40), pulse: 0, nudge: 0, onTrack: false });
    cv.classList.add('vis', 'on'); document.body.classList.add('g3draw'); dirty = true;
    if (fing.down) tryStart(fing.x, fing.y);
  }
  function tryStart(x, y) {
    const p = P; if (!p || p.st !== 'hold' || !p.pts) return;
    geo();
    const startRadius = p.T.cfg.strict ? p.tol : Math.max(60, p.tol * 2.6);
    if (Math.hypot(p.pts[0] - x, p.pts[1] - y) <= startRadius) {
      p.st = 'draw'; p.t = 0; p.lastProg = 0; fing.lx = x; fing.ly = y; feed(x, y);
    } else p.nudge = .8;   // «start at the yellow dot»
  }
  // one finger sample: how far from the line, and how far along it got
  function feed(x, y) {
    const p = P, a = p.pts, N = p.N; let best = Infinity, nearest = p.idx;
    const strict = p.T.cfg.strict;
    if (p.idx === N - 1) return;
    const tol = !strict && p.idx < 3 ? p.tol * 1.6 : p.tol;
    for (let j = Math.max(0, p.idx - 5), e = Math.min(N - 2, p.idx + 12); j <= e; j++) {
      const ax = a[j * 2], ay = a[j * 2 + 1];
      const dx = a[j * 2 + 2] - ax, dy = a[j * 2 + 3] - ay;
      const len2 = dx * dx + dy * dy;
      const u = len2 ? clamp(((x - ax) * dx + (y - ay) * dy) / len2, 0, 1) : 0;
      const d = Math.hypot(ax + u * dx - x, ay + u * dy - y);
      if (d < best) { best = d; nearest = j + u; }
    }
    if (strict && best > tol) { end('off-track'); return; }
    p.onTrack = best <= p.tol;
    const sc = best <= p.tol * PERF ? 1 : best <= tol ? .5 : 0;
    p.n++; p.sum += sc; p.q += (sc - p.q) * .25;
    const bin = Math.min(39, Math.floor(p.idx / N * 40)); p.bins[bin] += 1 - sc; p.binN[bin]++;
    if (best <= tol) p.idx = Math.max(p.idx, Math.round(nearest));
    p.trail.push({ x, y, t: clock, s: sc });
  }

  function tick(dt) {
    clock += dt;
    if (R) { replayTick(dt); return; }
    const p = P; if (!p) return;
    const J = p.J, T = p.T;
    if (!J.act || J.cur !== p.s.c) {
      // the clip was changed under us (a very slow phone): the old automatic outcome, nothing lost
      const cb = p.opt.onEnd; if (p.st !== 'arm') { J.rig.rotation.x = J.rig.rotation.z = 0; restoreCam(); }
      P = null; cv.classList.remove('on'); document.body.classList.remove('g3draw'); dirty = true; cb({ grade: 'auto', late: true });
      return;
    }
    if (p.st === 'arm') { if (J.act.time >= T.a0 - 1e-3 || T.a0 === 0) enterHold(); return; }
    // the circle's middle a bit above the middle of the screen, however high the legs go (1990: 1.4 m) — the words go under it.
    // The camera looks down at ~61° from the south (off 0, 15.5, 8.6): a point h up is seen where the ground .555·h further north is.
    // The zoom is set every frame: a zoom pulse left over from an earlier move can't pull it.
    if (W.camT) { W.camT.x = p.C.x; W.camT.z = p.C.z - .555 * p.C.y + .25; W.camT.zoom = .34; }
    if (p.st === 'hold') {
      p.h += dt; J.act.timeScale = 0;
      if (p.h > p.wait) {
        if (p.opt.required) { end('no-start'); return; }
        // In a regular battle, an untouched move keeps its automatic outcome.
        J.act.timeScale = p.s.sp || 1; restoreCam(); const cb = p.opt.onEnd; P = null; cv.classList.remove('on'); document.body.classList.remove('g3draw'); dirty = true;
        FL = { txt: _t('САМ КРУТИТ'), col: '#c9c4bb', t: 0, small: true };
        cb({ grade: 'auto' });
      }
      return;
    }
    if (p.st === 'draw') {
      p.t += dt;
      if (p.idx > p.lastIdx) { p.lastIdx = p.idx; p.lastProg = p.t; }
      const lap = turnsAt(p);
      if (lap > p.lap) { p.lap = lap; p.pulse = 1; sfx('whoosh'); try { navigator.vibrate && navigator.vibrate(8); } catch (_) {} }
      const cover = p.idx / (p.N - 1);
      if (p.idx >= p.N - 1) end('done');
      else if (p.t - p.lastProg > (p.idx < 4 ? STALL * 2 : STALL)) end('stall');
      else if (p.t > p.limit) end('time');
      if (!P) return;                                           // a fall ends it at once
      drive(dt, p.st === 'finish' ? p.stopAt : timeAt(T, cover * T.tot));
      // a sloppy finger = a shaky body (the eyes on the dancer see it at once)
      p.wob += ((1 - p.q) - p.wob) * (1 - Math.exp(-dt * 8));
      const w = p.st === 'draw' ? p.wob : 0;
      J.rig.rotation.x = w * .14 * Math.sin(clock * 17); J.rig.rotation.z = w * .14 * Math.cos(clock * 13);
      if (p.q > .8 && fing.down && p.st === 'draw') spark(J);
      return;
    }
    if (p.st === 'finish') {
      if (p.at >= p.stopAt - 1e-4) done();
      else drive(dt, p.stopAt, true);
    }
  }
  // the legs follow the finger: smooth, never back, never faster than RATE × the real tempo
  function drive(dt, want, fast) {
    const p = P, J = p.J; if (dt <= 0) { J.act.timeScale = 0; return; }
    const d = Math.max(0, want - p.at), step = Math.min(fast ? d : d * (1 - Math.exp(-dt * 14)), RATE * dt);
    p.at += step;
    if (p.T.cfg.b) { J.act.time = cutTime(p.T, p.at); J.act.timeScale = 0; }
    else J.act.timeScale = step / dt;
  }
  function end(why) {
    const p = P, cover = p.idx / (p.N - 1), acc = p.n ? p.sum / p.n : 0;
    const ok = why === 'done' || why === 'exit';
    p.grade = ok ? (acc >= PERF_ACC ? 'perfect' : 'good') : 'miss';
    p.stopAt = ok ? timeAt(p.T, cover * p.T.tot) : p.at;
    p.turns = ok ? turnsAt(p) : 0;
    p.reason = why;
    p.acc = acc; p.cover = cover; p.J.rig.rotation.x = p.J.rig.rotation.z = 0;
    if (p.grade === 'miss') done(); else p.st = 'finish';
  }
  function done() {
    const p = P, J = p.J, T = p.T, ok = p.grade !== 'miss';
    J.rig.rotation.x = J.rig.rotation.z = 0; J.act.timeScale = p.s.sp || 1;
    restoreCam(); cv.classList.remove('on'); document.body.classList.remove('g3draw'); dirty = true;
    const bins = new Float32Array(40); for (let i = 0; i < 40; i++) bins[i] = p.binN[i] ? p.bins[i] / p.binN[i] : 0;
    const rel = ok ? T.a0 + p.stopAt : T.a0;
    const res = { grade: p.grade, acc: p.acc, cover: p.cover, nm: p.s.nm, turns: p.turns, reason: p.reason, rel, len: ok ? rel : rel + .001,
      rec: ok ? { c: p.s.c, t0: T.a0, len: p.stopAt, pre: T.cfg.pre || 0, ry: p.ry, dx: p.dx, dz: p.dz, cx: p.C.x, cz: p.C.z, grade: p.grade, bins, cover: p.cover, nm: p.s.nm } : null };
    FL = p.grade === 'perfect' ? { txt: _t('ИДЕАЛЬНО!'), col: GOLD, t: 0 } : p.grade === 'good' ? { txt: _t('ЧИСТО'), col: GREEN, t: 0 } : { txt: _t('СРЫВ'), col: RED, t: 0 };
    if (p.reason === 'off-track') FL.detail = _t('Выход за линию');
    if (p.reason === 'no-start') FL.detail = _t('Попытка не начата');
    if (ok) FL.detail = _t('Обороты: {n}', { n: p.turns });
    last = { grade: res.grade, reason: p.reason, turns: p.turns, acc: +res.acc.toFixed(3), cover: +res.cover.toFixed(3), n: p.n, t: +p.t.toFixed(2), limit: p.limit };
    const cb = p.opt.onEnd; P = null; cb(res);
  }
  function restoreCam() { if (W.camT && P) W.camT.zoom = P.camZ || .4; }
  function cancel() {
    if (R) endReplay(true);
    if (P) { const J = P.J; J.rig.rotation.x = J.rig.rotation.z = 0; if (J.act && P.st !== 'arm') J.act.timeScale = P.s.sp || 1; restoreCam(); P = null; }
    fing.down = false; fing.id = null;
    FL = null; cv.classList.remove('on'); document.body.classList.remove('g3draw'); dirty = true;
  }
  function spark(J) {
    if (sparks.length > 60) return;
    for (const n of ['LeftFoot', 'RightFoot']) {
      J.B[n].getWorldPosition(_a).project(camera); if (_a.z > 1) continue;
      const x = (_a.x + 1) / 2 * CW, y = (1 - _a.y) / 2 * CH, an = Math.random() * TAU, v = 40 + Math.random() * 90;
      sparks.push({ x, y, vx: Math.cos(an) * v, vy: Math.sin(an) * v - 30, l: .35 + Math.random() * .2, t: 0 });
    }
  }

  // ---------- the replay: the drawn part again at the real tempo, from a lower camera ----------
  function replay(J, rec, onDone) {
    if (!rec || R) { onDone && onDone(); return; }
    const sv = { cur: J.cur, time: J.act ? J.act.time : 0, ts: J.act ? J.act.timeScale : 1, ry: J.root.rotation.y, dx: J.dx, dz: J.dz,
      camT: W.camT ? Object.assign({}, W.camT) : null, zoom: W.zoom };
    const t0 = Math.max(0, rec.t0 - rec.pre);
    J.root.rotation.y = rec.ry; J.dx = rec.dx; J.dz = rec.dz;
    J.play(rec.c, { fade: .01, at: t0 || .0001, raw: true }); if (J.act) J.act.timeScale = 1;
    // a cut: the camera jumps (W.camSnap) to a lower view at the side and slowly goes round him; the battle panel hides
    W.camT = { x: rec.cx, z: rec.cz, zoom: 1, off: new THREE.Vector3() }; W.zoom = 1; W.camSnap = true; orbit(0);
    R = { J, rec, T: table(rec.c), sv, t: 0, pre: rec.t0 - t0, len: rec.t0 - t0 + rec.len, onDone, feet: [[], []] };
    flash = 1; FL = null; cv.classList.add('vis', 'on'); document.body.classList.add('g3rep'); dirty = true;
  }
  function orbit(k) {
    const a = REP_A0 + (REP_A1 - REP_A0) * k, h = Math.cos(REP_EL) * REP_DIST;
    W.camT.off.set(Math.sin(a) * h, Math.sin(REP_EL) * REP_DIST, Math.cos(a) * h);
  }
  function replayTick(dt) {
    const r = R, J = r.J; r.t += dt; orbit(clamp(r.t / (r.len + .35), 0, 1)); if (W.camT) W.camT.zoom = 1;
    const u = clamp((r.t - r.pre) / r.rec.len, 0, 1), w = r.t > r.pre && r.t < r.len ? r.rec.bins[Math.min(39, Math.floor(u * r.rec.cover * 40))] : 0;
    J.rig.rotation.x = w * .14 * Math.sin(clock * 17); J.rig.rotation.z = w * .14 * Math.cos(clock * 13);
    if (J.act && r.T.cfg.b && r.t >= r.pre) {
      J.act.time = cutTime(r.T, u * r.rec.len); J.act.timeScale = 0;
    } else if (r.t >= r.len && J.act) J.act.timeScale = 0;
    if (r.skip || r.t >= r.len + .35) endReplay();
  }
  function endReplay(silent) {
    const r = R, J = r.J, sv = r.sv; R = null;
    J.root.rotation.y = sv.ry; J.dx = sv.dx; J.dz = sv.dz; J.rig.rotation.x = J.rig.rotation.z = 0;
    if (sv.cur) { const c = getClip(sv.cur), dur = c ? c.duration : 1; J.play(sv.cur, { fade: .01, at: clamp(sv.time, .0001, dur - .002), raw: true }); if (J.act) J.act.timeScale = sv.ts; }
    W.camT = sv.camT; W.zoom = sv.camT ? sv.camT.zoom : sv.zoom; W.camSnap = true;
    flash = silent ? 0 : 1; cv.classList.remove('on'); document.body.classList.remove('g3rep'); dirty = true;
    if (!silent && r.onDone) r.onDone();
  }

  // ---------- drawing the layer (after the camera has moved, so the line sits on the dancer) ----------
  function post(dt) {
    if (!P && !R && !FL && !flash && !sparks.length && !dirty) return;
    g.setTransform(DPR, 0, 0, DPR, 0, 0); g.clearRect(0, 0, CW, CH); dirty = false;
    let any = false;
    if (P && P.st !== 'arm' && P.pts) { geo(); guide(dt); any = true; }
    if (R) { replayLayer(dt); any = true; }
    if (sparks.length) { any = true; g.globalCompositeOperation = 'lighter';
      for (let i = sparks.length - 1; i >= 0; i--) { const s = sparks[i]; s.t += dt; if (s.t > s.l) { sparks.splice(i, 1); continue; }
        s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 160 * dt; const k = 1 - s.t / s.l;
        g.fillStyle = `rgba(255,${190 + 50 * k | 0},80,${k})`; g.beginPath(); g.arc(s.x, s.y, 1.5 + 2 * k, 0, TAU); g.fill(); }
      g.globalCompositeOperation = 'source-over'; }
    if (FL) { FL.t += dt; const L = FL.small ? 1.1 : 1.3; if (FL.t > L) FL = null; else { any = true; word(FL); } }
    if (flash > 0) { any = true; g.fillStyle = `rgba(255,255,255,${flash * .55})`; g.fillRect(0, 0, CW, CH); flash = Math.max(0, flash - dt / .18); }
    if (any) dirty = true; else cv.classList.remove('vis');
  }
  function text(s, x, y, size, col, font = 'Anton', w = 400, al = 'center') {
    g.font = `${w} ${size}px ${font}, Inter, sans-serif`; g.textAlign = al; g.textBaseline = 'middle';
    // longer languages (18.11.2026 translation): shrink a line that would not fit between the screen's edges
    const tr = g.getTransform(), sc = tr.a / DPR, ax = tr.e / DPR + x * sc, m = g.measureText(s).width;
    const room = ((al === 'center' ? 2 * Math.min(ax, CW - ax) : al === 'left' ? CW - ax : ax) - 12) / sc;
    if (m > room && room > 40) g.font = `${w} ${(size * room / m).toFixed(1)}px ${font}, Inter, sans-serif`;
    g.lineWidth = 4; g.strokeStyle = 'rgba(5,6,9,.75)'; g.lineJoin = 'round'; g.strokeText(s, x, y); g.fillStyle = col; g.fillText(s, x, y);
  }
  function word(f) {
    const k = f.t, pop = k < .12 ? .7 + 2.5 * k : 1, a = k > (f.small ? .8 : 1) ? clamp(1 - (k - (f.small ? .8 : 1)) / .3, 0, 1) : 1;
    g.save(); g.globalAlpha = a; g.translate(CW / 2, CH * .3); g.scale(pop, pop);
    if (!f.small) { g.shadowColor = f.col; g.shadowBlur = 18; }
    text(f.txt, 0, 0, f.small ? 22 : 44, f.col);
    if (f.detail) text(f.detail, 0, 36, 15, '#fff', 'Inter', 700);
    g.restore();
  }
  function guide(dt) {
    const p = P, a = p.pts, N = p.N, T = p.T, cx = p.cx, cy = p.cy;
    // a spotlight: the dancer and his circle stay bright, the rest of the yard goes darker
    const sp = g.createRadialGradient(cx, cy, p.rad * .95, cx, cy, Math.max(CW, CH) * .75);
    sp.addColorStop(0, 'rgba(5,6,9,0)'); sp.addColorStop(1, 'rgba(5,6,9,.5)'); g.fillStyle = sp; g.fillRect(0, 0, CW, CH);
    g.lineCap = g.lineJoin = 'round';
    // Show the active revolution only. Later laps follow the same guide.
    const lapN = (N - 1) / MAX_TURNS, i0 = p.idx, i1 = Math.min(N - 1, i0 + Math.round(lapN * .85));
    const lapEnd = Math.min(N - 1, i0 + Math.round(lapN));
    g.beginPath(); g.moveTo(a[i0 * 2], a[i0 * 2 + 1]);
    for (let k = i0 + 1; k <= lapEnd; k++) g.lineTo(a[k * 2], a[k * 2 + 1]);
    g.strokeStyle = 'rgba(255,255,255,.13)'; g.lineWidth = 2; g.stroke();
    // what's next: ~0.85 of a turn ahead, bright → fading, with arrows
    if (T.cfg.strict) {
      const lead = Math.max(0, i0 - 5);
      g.beginPath(); g.moveTo(a[lead * 2], a[lead * 2 + 1]);
      for (let k = lead + 1; k <= i1; k++) g.lineTo(a[k * 2], a[k * 2 + 1]);
      g.strokeStyle = 'rgba(255,210,63,.66)'; g.lineWidth = p.tol * 2 + 2; g.stroke();
      g.strokeStyle = '#302A1B'; g.lineWidth = p.tol * 2; g.stroke();
    }
    const wd = Math.max(7, p.tol * .55);
    for (let k = i0; k < i1; k++) {
      const f = 1 - (k - i0) / Math.max(1, i1 - i0);
      g.strokeStyle = `rgba(255,255,255,${(.2 + .7 * f).toFixed(3)})`; g.lineWidth = wd * (.55 + .45 * f);
      g.beginPath(); g.moveTo(a[k * 2], a[k * 2 + 1]); g.lineTo(a[k * 2 + 2], a[k * 2 + 3]); g.stroke();
    }
    const ch = Math.max(6, Math.round(44 / 6));
    for (let k = i0 + ch; k < i1 - 2; k += ch) {
      const x = a[k * 2], y = a[k * 2 + 1], an = Math.atan2(a[k * 2 + 3] - a[k * 2 - 1], a[k * 2 + 2] - a[k * 2 - 2]), f = 1 - (k - i0) / Math.max(1, i1 - i0);
      g.save(); g.translate(x, y); g.rotate(an); g.strokeStyle = `rgba(20,22,28,${(.55 * f + .15).toFixed(3)})`; g.lineWidth = 2.4;
      g.beginPath(); g.moveTo(-4, -5); g.lineTo(2, 0); g.lineTo(-4, 5); g.stroke(); g.restore();
    }
    // the finger's trail: gold = on the line, white = close, red = off
    const tr = p.trail; while (tr.length && clock - tr[0].t > .32) tr.shift();
    for (let i = 1; i < tr.length; i++) {
      const s = tr[i], k = 1 - (clock - s.t) / .32;
      g.strokeStyle = s.s === 1 ? `rgba(255,210,63,${k})` : s.s > 0 ? `rgba(255,255,255,${k * .9})` : `rgba(255,90,79,${k})`;
      g.lineWidth = 3 + 6 * k; g.beginPath(); g.moveTo(tr[i - 1].x, tr[i - 1].y); g.lineTo(s.x, s.y); g.stroke();
    }
    // the dot = where the legs are going now
    const dx = a[i0 * 2], dy = a[i0 * 2 + 1], beat = .5 + .5 * Math.sin(clock * 7);
    g.save(); g.shadowColor = GOLD; g.shadowBlur = 16; g.fillStyle = GOLD; g.beginPath(); g.arc(dx, dy, 9 + (p.st === 'hold' ? 3 * beat : 0), 0, TAU); g.fill(); g.restore();
    g.strokeStyle = 'rgba(20,22,28,.8)'; g.lineWidth = 2; g.beginPath(); g.arc(dx, dy, 9 + (p.st === 'hold' ? 3 * beat : 0), 0, TAU); g.stroke();
    // every word goes BELOW the circle: above it are the score and the battle's header (a headspin's circle sits high — the legs are up)
    const bot = Math.min(CH - 190, cy + p.kz * p.rad * 1.08 + 22);
    if (p.st === 'hold') {
      // waiting: a ring round the dot runs out → he spins by himself
      const left = 1 - p.h / p.wait;
      g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 3; g.beginPath(); g.arc(dx, dy, 19, -Math.PI / 2, -Math.PI / 2 + TAU * left); g.stroke();
      const ring = (clock * 1.4) % 1; g.strokeStyle = `rgba(255,210,63,${1 - ring})`; g.lineWidth = 2; g.beginPath(); g.arc(dx, dy, 12 + 26 * ring, 0, TAU); g.stroke();
      text(p.s.nm, cx, bot + 8, 28, '#fff');
      text(_t('Начни с жёлтой точки и веди по стрелкам'), cx, bot + 36, 14, '#e8e4dc', 'Inter', 600);
      text(_t('После первого оборота отпусти палец на дорожке для выхода'), cx, bot + 60, 13, '#e8e4dc', 'Inter', 600);
      if (T.cfg.strict) text(_t('Выход за линию — срыв'), cx, bot + 82, 15, GOLD, 'Inter', 700);
      if (p.nudge > 0) { p.nudge -= dt; text(_t('Начни с жёлтой точки'), dx, dy - 34, 14, GOLD, 'Inter', 700); }
    } else {
      // turns, time
      const left = clamp(1 - p.t / p.limit, 0, 1), bw = 150, bx = cx - bw / 2;
      g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(bx, bot, bw, 5);
      g.fillStyle = left < .3 ? RED : '#FFB547'; g.fillRect(bx, bot, bw * left, 5);
      text(`${p.lap} / ${MAX_TURNS}`, cx, bot + 28, 24 + 6 * p.pulse, p.pulse > 0 ? GOLD : '#fff');
      p.pulse = Math.max(0, p.pulse - dt * 3);
      if (p.st === 'draw') {
        if (p.t - p.lastProg > .28) text(_t('Не останавливайся!'), cx, bot + 58, 15, RED, 'Inter', 700);
        else if (!p.onTrack) text(_t('Держи линию!'), cx, bot + 58, 15, '#FFB547', 'Inter', 700);
        else if (p.lap) text(_t('Отпусти палец для выхода'), cx, bot + 58, 15, '#e8e4dc', 'Inter', 700);
      }
    }
  }
  function replayLayer(dt) {
    const r = R, J = r.J, gold = r.rec.grade === 'perfect';
    // the light trail of the feet
    r.feet.forEach((tr, i) => {
      J.B[i ? 'RightFoot' : 'LeftFoot'].getWorldPosition(_a).project(camera);
      if (r.t > r.pre * .6 && r.t < r.len) tr.push({ x: (_a.x + 1) / 2 * CW, y: (1 - _a.y) / 2 * CH, t: clock });
      while (tr.length && clock - tr[0].t > .45) tr.shift();
    });
    g.globalCompositeOperation = 'lighter'; g.lineCap = g.lineJoin = 'round';
    r.feet.forEach(tr => { for (let i = 1; i < tr.length; i++) { const k = 1 - (clock - tr[i].t) / .45;
      g.strokeStyle = gold ? `rgba(255,200,70,${k * .85})` : `rgba(150,210,255,${k * .6})`; g.lineWidth = 2 + 7 * k;
      g.beginPath(); g.moveTo(tr[i - 1].x, tr[i - 1].y); g.lineTo(tr[i].x, tr[i].y); g.stroke(); } });
    g.globalCompositeOperation = 'source-over';
    // a cinema frame
    const bar = Math.min(1, r.t / .25) * CH * .085;
    g.fillStyle = '#000'; g.fillRect(0, 0, CW, bar); g.fillRect(0, CH - bar, CW, bar);
    const y = bar + 26, blink = (clock * 2) % 1 < .6;
    if (blink) { g.fillStyle = RED; g.beginPath(); g.arc(22, y, 6, 0, TAU); g.fill(); }
    text(_t('ПОВТОР'), 36, y, 20, '#fff', 'Anton', 400, 'left');
    text(r.rec.nm + ' · ' + (gold ? _t('ИДЕАЛЬНО') : _t('ЧИСТО')), CW - 16, y, 16, gold ? GOLD : GREEN, 'Anton', 400, 'right');
    text(_t('нажми — дальше'), CW / 2, CH - bar - 18, 12, 'rgba(255,255,255,.6)', 'Inter', 600);
  }

  return {
    can: canDraw, arm, tick, post, cancel, replay, demonstration,
    holds: () => !!R || !!(P && P.st !== 'arm'),
    state: () => (R ? 'replay' : P ? P.st : null), last: () => last,
    // tests: where the line is now (screen px), the progress, the target
    _probe: () => P && P.pts ? { st: P.st, N: P.N, idx: P.idx, turns: turnsAt(P), tol: P.tol, cx: P.cx, cy: P.cy, rad: P.rad, kz: P.kz, pts: Array.from(P.pts), at: P.at, len: P.T.len, q: P.q, acc: P.n ? P.sum / P.n : 0, limit: P.limit } : null,
  };
}
