// City 3D — the game on top of the scene (owner 14.11.2026: «понятная система прогресса, ограниченная энергия, батлы на авто,
// но красиво — случайные комбинации, случайные исходы, падения»). Tapping stays in the real-people battles tab.
// Crews stand around the yard; walk up → «Батл» → an automatic dance-off on motion capture: each dancer's turn is a random
// set toprock → down → footwork → power → freeze; power and freeze can fail (crash / lost freeze). 3 judges decide.
// Strength = hero level from lessons; energy = 20 per battle, refilled by lesson minutes (+5/min) and a small free daily top-up.
import * as THREE from 'three';
import { mocapPerson, clipLen } from './city3d-mocap.js?v=3';

const KEY = 'fedoskin-city3d';
export const BAL = {
  enMax: 100, enStart: 60, battle: 20, perMin: 5, daily: 40,
  rep: [0, 30, 90, 200, 400, 700],
  ranks: ['Новичок двора', 'Свой', 'Уважаемый', 'Авторитет', 'Хозяин двора', 'Легенда района'],
  repWin: 12, repClean: 6,
};
// the crews of the yard; gear = HERO.GEAR pieces (1st win → 1st piece, 3rd win → 2nd piece)
export const CREWS = [
  { id: 'rusty', name: 'Ржавые', lv: 1, col: '#E07A45', at: [-7.2, -9.4], looks: [['c:rustyBandana'], ['c:rustyTrack'], []], gear: ['rustyBandana', 'rustyTrack'] },
  { id: 'acid', name: 'Кислотные', lv: 2, col: '#7CFF4F', at: [8.6, -6.2], looks: [['c:acidBucket'], ['c:acidKicks'], ['c:acidBucket', 'girl']], gear: ['acidKicks', 'acidBucket'] },
  { id: 'owls', name: 'Ночные совы', lv: 3, col: '#A98BFF', at: [-8.6, -2.4], looks: [['c:owlHoodie'], ['c:owlPhones'], ['c:owlHoodie', 'girl']], gear: ['owlPhones', 'owlHoodie'] },
  { id: 'gold', name: 'Золотые зубы', lv: 4, col: '#FFD23F', at: [4.6, 9.2], looks: [['c:goldChain'], ['c:goldCap'], ['c:goldChain', 'girl'], []], gear: ['goldChain', 'goldCap'] },
];
const TOP = ['Breakdance_Uprock', 'Breakdance_Uprock_Var_1', 'Bboy_Uprock', 'Brooklyn_Uprock', 'Breakdance_Uprock_Var_2'];
const FOOT = ['Breakdance_Footwork_1', 'Breakdance_Footwork_2', 'Breakdance_Footwork_3'];
// power: level needed, points, how risky (adds to the fall chance), display name
const POWER = [
  { c: 'Breakdance_Swipes', lv: 1, pts: 2, risk: 0, nm: 'SWIPES' },
  { c: 'Head_Spinning', lv: 2, pts: 3, risk: .05, nm: 'HEADSPIN', pre: 'Headspin_Start', post: 'Headspin_End' },
  { c: 'Flair', lv: 3, pts: 3.5, risk: .08, nm: 'FLARE' },
  { c: 'Breakdance_1990', lv: 4, pts: 4, risk: .1, nm: '1990' },
];
const FREEZE = [
  { c: 'Breakdance_Footwork_To_Freeze', at: 1.3, len: 2.3, nm: 'CHAIR FREEZE' },
  { c: 'Crossleg_Freeze', at: 0, len: 2.0, nm: 'CROSSLEG FREEZE' },
];
const TOPNM = { Breakdance_Uprock: 'CROSS STEP', Breakdance_Uprock_Var_1: 'KICK STEP', Bboy_Uprock: 'TOPROCK', Brooklyn_Uprock: 'BROOKLYN ROCK', Breakdance_Uprock_Var_2: 'INDIAN STEP' };

const $ = s => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t * t * (3 - 2 * t);
const today = () => { const d = new Date(); return d.getFullYear() * 1e4 + (d.getMonth() + 1) * 100 + d.getDate(); };
const pick = (a, r) => a[Math.floor(r() * a.length) % a.length];
function rng(seed) { let a = seed >>> 0 || 1; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const lessonSec = () => { try { return +(JSON.parse(localStorage.getItem('fedoskin-stats') || '{}').sec || 0); } catch (_) { return 0; } };

// ---------- save ----------
let S;
function load() {
  let s = null; try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) {}
  if (!s || s.v !== 1) s = { v: 1, en: BAL.enStart, day: today(), lsec: lessonSec(), rep: 0, wins: {}, beat: {}, own: [], fights: 0 };
  return s;
}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (_) {} };
// energy comes from lessons (and a little every new day)
function refill() {
  const notes = [];
  const sec = lessonSec(), d = sec - (S.lsec || 0);
  if (d >= 60) { const add = Math.min(BAL.enMax - S.en, Math.floor(d / 60) * BAL.perMin); S.lsec += Math.floor(d / 60) * 60; if (add > 0) { S.en += add; notes.push('🎬 Уроки: +' + add + ' ⚡'); } }
  else if (d < 0) S.lsec = sec;
  if (S.day !== today()) { S.day = today(); S.beat = {}; if (S.en < BAL.daily) { notes.push('☀️ Новый день: энергия до ' + BAL.daily + ' ⚡'); S.en = BAL.daily; } }
  save(); return notes;
}
const rankOf = rep => { let i = 0; while (i + 1 < BAL.rep.length && rep >= BAL.rep[i + 1]) i++; return i; };

// ---------- ui ----------
const CSS = `
#g3hud{position:fixed;left:10px;right:10px;top:calc(max(10px,env(safe-area-inset-top)) + 50px);display:flex;gap:8px;z-index:5;pointer-events:none;font:600 12px Inter,sans-serif;color:#F2EFE8}
#g3hud .chip{pointer-events:auto;background:rgba(12,14,19,.66);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:6px 10px;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);cursor:pointer}
#g3en{flex:1;max-width:190px}#g3en .bar{height:6px;border-radius:3px;background:rgba(255,255,255,.12);margin-top:4px;overflow:hidden}#g3en .bar i{display:block;height:100%;background:linear-gradient(90deg,#FFB547,#E2611A);border-radius:3px;transition:width .5s}
#g3rk{flex:1}#g3rk b{color:#FFD23F}#g3rk .bar{height:6px;border-radius:3px;background:rgba(255,255,255,.12);margin-top:4px;overflow:hidden}#g3rk .bar i{display:block;height:100%;background:#FFD23F;border-radius:3px;transition:width .6s}
#g3act{position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom));transform:translateX(-50%) translateY(20px);opacity:0;pointer-events:none;transition:.25s;z-index:6;border:0;border-radius:26px;padding:15px 22px;font:800 15px Inter,sans-serif;color:#0B0D12;background:#E2611A;box-shadow:0 8px 24px rgba(226,97,26,.45);white-space:nowrap}
#g3act.on{opacity:1;transform:translateX(-50%);pointer-events:auto}#g3act.low{background:#2a2d33;color:#F2EFE8;box-shadow:none;border:1px solid rgba(255,255,255,.18);font-weight:700}
#g3act small{display:block;font:600 11px Inter,sans-serif;opacity:.75}
#g3bt{position:fixed;inset:0;z-index:7;pointer-events:none;font-family:Inter,sans-serif;color:#F2EFE8;display:none}
#g3bt.on{display:block}
body.g3fight #g3hud,body.g3fight #hint,body.g3fight .hud .ttl{opacity:0;pointer-events:none}#g3hud,#hint{transition:opacity .3s}
#g3sc{position:absolute;left:50%;top:calc(max(10px,env(safe-area-inset-top)) + 54px);transform:translateX(-50%);display:flex;align-items:center;gap:10px;background:rgba(10,11,15,.78);border:1px solid rgba(255,255,255,.14);border-radius:18px;padding:8px 14px;font:400 18px Anton,sans-serif;letter-spacing:.04em;white-space:nowrap}
#g3sc .me{color:#E2611A}#g3sc .op{color:var(--oc,#7CFF4F)}#g3sc .n{font-size:24px;min-width:40px;text-align:center;color:#F2EFE8}
#g3turn{position:absolute;left:50%;top:calc(max(10px,env(safe-area-inset-top)) + 106px);transform:translateX(-50%);font:600 12px Inter,sans-serif;letter-spacing:.16em;color:#C9C5BC;text-transform:uppercase}
#g3mv{position:absolute;left:50%;bottom:calc(120px + env(safe-area-inset-bottom));transform:translateX(-50%);font:400 30px Anton,sans-serif;letter-spacing:.05em;text-shadow:0 3px 14px #000;white-space:nowrap;transition:transform .2s}
#g3mv.pop{transform:translateX(-50%) scale(1.15)}
#g3mv small{display:block;text-align:center;font:700 14px Inter,sans-serif;letter-spacing:.04em}
#g3mv .ok{color:#3BD16F}#g3mv .bad{color:#FF5A4F}
#g3skip{position:absolute;right:12px;bottom:calc(24px + env(safe-area-inset-bottom));pointer-events:auto;border:1px solid rgba(255,255,255,.2);background:rgba(12,14,19,.7);color:#F2EFE8;border-radius:18px;padding:9px 14px;font:600 13px Inter,sans-serif}
#g3res{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%) scale(.9);opacity:0;transition:.3s;z-index:8;width:min(340px,88vw);background:rgba(14,16,21,.94);border:1px solid rgba(255,255,255,.14);border-radius:22px;padding:18px;font-family:Inter,sans-serif;color:#F2EFE8;text-align:center;pointer-events:none}
#g3res.on{opacity:1;transform:translate(-50%,-50%);pointer-events:auto}
#g3res h3{margin:2px 0 4px;font:400 34px Anton,sans-serif;letter-spacing:.04em}#g3res h3.w{color:#3BD16F}#g3res h3.l{color:#FF5A4F}
#g3res .jd{display:flex;justify-content:center;gap:10px;margin:10px 0}#g3res .jd i{width:56px;height:70px;border-radius:10px;background:#22252c;display:flex;align-items:center;justify-content:center;font:400 13px Anton,sans-serif;font-style:normal;letter-spacing:.06em;transform:rotateY(90deg);transition:transform .35s}
#g3res .jd i.on{transform:none}#g3res .jd i.me{background:#E2611A;color:#0B0D12}#g3res .jd i.op{background:var(--oc);color:#0B0D12}
#g3res p{margin:6px 0;font-size:14px;line-height:1.4;color:#D9D4CA}#g3res .rw{color:#FFD23F;font-weight:700}
#g3res button{margin-top:10px;width:100%;border:0;border-radius:14px;padding:13px;font:800 15px Inter,sans-serif;background:#E2611A;color:#0B0D12}
#g3res button.sec{background:#2a2d33;color:#F2EFE8;font-weight:700}
#g3toast{position:fixed;left:50%;top:calc(max(10px,env(safe-area-inset-top)) + 104px);transform:translateX(-50%);background:rgba(12,14,19,.88);border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:9px 14px;font:600 13px Inter,sans-serif;color:#F2EFE8;z-index:9;opacity:0;transition:opacity .3s;pointer-events:none;white-space:nowrap}
#g3toast.on{opacity:1}
#g3info{position:fixed;inset:0;background:rgba(5,6,9,.6);z-index:9;display:none;align-items:flex-end;justify-content:center}#g3info.on{display:flex}
#g3info>div{width:min(460px,100%);background:#14161b;border-radius:22px 22px 0 0;padding:18px 18px calc(18px + env(safe-area-inset-bottom));font:500 14px/1.45 Inter,sans-serif;color:#D9D4CA;max-height:80vh;overflow:auto}
#g3info h4{margin:0 0 8px;font:400 22px Anton,sans-serif;letter-spacing:.04em;color:#F2EFE8}#g3info b{color:#F2EFE8}#g3info .row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.07)}
#g3info button{margin-top:12px;width:100%;border:0;border-radius:14px;padding:13px;font:800 15px Inter,sans-serif;background:#E2611A;color:#0B0D12}
`;
function ui() {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const h = document.createElement('div'); h.innerHTML = `
<div id="g3hud"><div class="chip" id="g3en"><span>⚡ <b id="g3enN"></b> энергии</span><div class="bar"><i></i></div></div>
<div class="chip" id="g3rk"><span>★ <b id="g3rkN"></b> · <span id="g3rkC"></span></span><div class="bar"><i></i></div></div></div>
<button id="g3act" type="button"></button>
<div id="g3bt"><div id="g3sc"><span class="me">ТЫ</span><span class="n" id="g3a">0</span>:<span class="n" id="g3b">0</span><span class="op" id="g3on"></span></div><div id="g3turn"></div><div id="g3mv"></div><button id="g3skip" type="button">Пропустить ⏭</button></div>
<div id="g3res"></div><div id="g3toast"></div><div id="g3info"><div></div></div>`;
  [...h.children].forEach(c => document.body.appendChild(c));
}
let toastT = 0;
function toast(t) { const e = $('#g3toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('on'), 2600); }
function paintHud() {
  $('#g3enN').textContent = S.en + ' / ' + BAL.enMax; $('#g3en .bar i').style.width = (S.en / BAL.enMax * 100) + '%';
  const r = rankOf(S.rep), a = BAL.rep[r], b = BAL.rep[r + 1];
  $('#g3rkN').textContent = BAL.ranks[r]; $('#g3rkC').textContent = b ? S.rep + ' / ' + b + ' уважения' : S.rep + ' уважения';
  $('#g3rk .bar i').style.width = (b ? (S.rep - a) / (b - a) * 100 : 100) + '%';
}
function info(html) { const e = $('#g3info'); e.firstElementChild.innerHTML = html; e.classList.add('on'); }

// ---------- the game ----------
export function initGame(ctx) {
  // ctx: { scene, W, collide: (x,z,r)=>{x,z}, circ(x,z,r), heroLevel(), shake(k), home() }
  S = load(); ui();
  const W = ctx.W, scene = ctx.scene, notes = refill();
  paintHud(); if (notes.length) setTimeout(() => toast(notes.join(' · ')), 900);
  addEventListener('visibilitychange', () => { if (!document.hidden) { const n = refill(); paintHud(); if (n.length) toast(n.join(' · ')); } });
  $('#g3en').onclick = () => info(`<h4>⚡ Энергия</h4><p>Каждый батл с бандой стоит <b>${BAL.battle} ⚡</b>. Максимум ${BAL.enMax}.</p>
    <p>Энергия пополняется <b>уроками</b>: каждая минута урока = <b>+${BAL.perMin} ⚡</b>. Каждый новый день — бесплатно до ${BAL.daily} ⚡.</p>
    <p>Сила твоего би-боя тоже из уроков: чем выше уровень героя, тем сложнее пауэр он крутит и тем реже падает.</p><button onclick="location.href='./'">🎬 К урокам</button>`);
  $('#g3info').onclick = e => { if (e.target.id === 'g3info') e.currentTarget.classList.remove('on'); };
  $('#g3rk').onclick = () => { const r = rankOf(S.rep), lv = ctx.heroLevel();
    info(`<h4>★ Прогресс</h4>${BAL.ranks.map((n, i) => `<div class="row"><span>${i <= r ? '✅' : '🔒'} ${n}</span><span>${BAL.rep[i]} ★</span></div>`).join('')}
    <p style="margin-top:10px">Побеждай банды — получай уважение и их шмотки (они видны на тебе и помогают в батлах).</p>
    ${CREWS.map(c => `<div class="row"><span style="color:${c.col}">${c.name} · ур. ${c.lv}</span><span>${S.wins[c.id] ? '🏆 ' + S.wins[c.id] : (lv >= c.lv ? 'по силам' : 'сильнее тебя')}</span></div>`).join('')}
    <p>Твой уровень: <b>${lv}</b> — растёт от минут уроков.</p><button onclick="this.closest('#g3info').classList.remove('on')">Понятно</button>`); };

  // crews in the yard
  const crews = CREWS.map((c, ci) => {
    const g = { c, people: [], x: c.at[0], z: c.at[1] };
    const r = rng(ci * 77 + 3);
    c.looks.forEach((acc, i) => {
      const J = mocapPerson(HERO.topDown(Math.min(8, c.lv + 2 + (i % 2)), acc)), a = Math.PI * 2 * i / c.looks.length + ci;
      J.home = { x: g.x + Math.cos(a) * 1.35, z: g.z + Math.sin(a) * 1.35 }; J.root.position.set(J.home.x, 0, J.home.z);
      J.root.rotation.y = Math.atan2(g.x - J.home.x, g.z - J.home.z);
      J.play(i === 0 ? pick(TOP, r) : 'Breakdance_Ready', { at: r() * 2, speed: .9 + r() * .2 });
      scene.add(J.root); g.people.push(J); ctx.circ(J.home.x, J.home.z, .3);
    });
    // ground ring + floating name
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256; const x = cv.getContext('2d');
    x.strokeStyle = c.col; x.lineWidth = 10; x.setLineDash([26, 16]); x.beginPath(); x.arc(128, 128, 112, 0, 7); x.stroke();
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, opacity: .6, toneMapped: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(g.x, .02, g.z); scene.add(ring); g.ring = ring;
    const lc = document.createElement('canvas'); lc.width = 512; lc.height = 128; const lx = lc.getContext('2d');
    lx.font = '400 64px Anton, sans-serif'; lx.textAlign = 'center'; lx.fillStyle = 'rgba(10,11,15,.72)'; const tw = lx.measureText(c.name.toUpperCase()).width + 120;
    lx.beginPath(); lx.roundRect(256 - tw / 2, 14, tw, 100, 50); lx.fill(); lx.fillStyle = c.col; lx.fillText(c.name.toUpperCase(), 236, 88);
    lx.fillStyle = '#F2EFE8'; lx.font = '700 40px Inter, sans-serif'; lx.fillText(c.lv, 256 + tw / 2 - 52, 84);
    const lab = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(lc), depthTest: false, toneMapped: false }));
    lab.scale.set(2.6, .65, 1); lab.position.set(g.x, 2.7, g.z); lab.renderOrder = 10; scene.add(lab); g.label = lab;
    return g;
  });
  const shown = g => !S.beat[g.c.id];
  const setShown = g => { const v = shown(g); g.people.forEach(J => J.root.visible = v); g.ring.visible = g.label.visible = v; };
  crews.forEach(setShown);

  // ---------- proximity button ----------
  let near = null; const act = $('#g3act');
  act.onclick = () => {
    if (!near || B) return;
    if (S.en < BAL.battle) { location.href = './'; return; }
    startBattle(near);
  };
  function paintAct() {
    if (!near || B) { act.classList.remove('on'); return; }
    const low = S.en < BAL.battle, lv = ctx.heroLevel(), c = near.c;
    act.className = 'on' + (low ? ' low' : '');
    act.innerHTML = low ? `🎬 Мало энергии — посмотри урок<small>1 минута урока = +${BAL.perMin} ⚡</small>`
      : `⚔️ Батл с «${c.name}» · −${BAL.battle} ⚡<small>${lv > c.lv ? 'Ты сильнее — шансы хорошие' : lv === c.lv ? 'Равные силы' : 'Они сильнее — будет трудно'}</small>`;
  }

  // ---------- the battle ----------
  let B = null;
  function makeTurn(J, lv, r, who) {
    // a set: toprock → down → footwork → power → freeze, each step with an outcome
    const seq = [], push = (c, len, at, o = {}) => seq.push(Object.assign({ c, len, at: at || 0 }, o));
    const top = pick(TOP, r); push(top, 2.3, r() * .5, { nm: TOPNM[top], pts: 1, kind: 'top' });
    push('Breakdance_Uprock_To_Ground', clipLen('Breakdance_Uprock_To_Ground') - .05, 0, { kind: 'down' });
    push(pick(FOOT, r), 2.4, r() * .8, { nm: 'FOOTWORK', pts: 1.5, kind: 'foot' });
    const pw = POWER.filter(p => p.lv <= lv), P = pw[Math.min(pw.length - 1, Math.floor(r() * pw.length * 1.3))];
    const failP = clamp(.13 + P.risk - .06 * (lv - P.lv), .04, .32);
    const pFail = r() < failP;
    if (P.pre) push(P.pre, 1.6, 1.0, { kind: 'pre' });
    const reps = Math.max(1, Math.round(2.6 / clipLen(P.c)));
    push(P.c, reps * clipLen(P.c), 0, { nm: P.nm, pts: P.pts, kind: 'power', fail: pFail, failAt: .45 + r() * .35 });
    if (pFail) push(null, 2.2, 0, { kind: 'fall' });
    else {
      if (P.post) push(P.post, 1.4, 0, { kind: 'post' });
      const F = pick(FREEZE, r), fFail = r() < clamp(.14 - .03 * (lv - 1), .04, .2);
      push(F.c, F.len, F.at, { nm: F.nm, pts: 2, kind: 'freeze', fail: fFail, failAt: .55 });
      if (fFail) push(null, 1.6, 0, { kind: 'fall', soft: true });
    }
    let t = .9; seq.forEach(s => { s.a = t; t += s.len; s.b = t; });   // .9 s to step into the middle
    return { J, who, seq, len: t + 1.4, score: 0, style: Math.round((r() * .8 + .15 * lv) * 10) / 10 };
  }
  function startBattle(g) {
    S.en -= BAL.battle; S.fights++; save(); paintHud();
    const H = W.hero, lv = ctx.heroLevel(), c = g.c, r = rng((Date.now() ^ (c.lv * 911)) >>> 0);
    const opp = g.people[0], cx = g.x, cz = g.z;
    // positions: the middle of the crew's ring is the stage; me on the south side, the opponent on the north
    const meSpot = { x: cx - .3, z: cz + 2.1 }, opSpot = { x: cx + .3, z: cz - 2.1 };
    const turns = [], rounds = c.lv >= 3 ? 2 : 1;
    for (let i = 0; i < rounds; i++) { turns.push(makeTurn(opp, c.lv, r, 'op')); turns.push(makeTurn(H, lv, r, 'me')); }
    B = { g, opp, turns, i: -1, t0: 0, me: 0, op: 0, cx, cz, meSpot, opSpot, lv, phase: 'walk', pt: performance.now() / 1000, fromMe: { x: H.root.position.x, z: H.root.position.z }, fromOp: { x: opp.root.position.x, z: opp.root.position.z }, clean: true };
    W.lock = true; W.camT = { x: cx, z: cz + .4, zoom: .4 }; document.body.classList.add('g3fight'); g.label.visible = false; $('#g3skip').style.display = '';
    $('#g3bt').classList.add('on'); $('#g3bt').style.setProperty('--oc', c.col); $('#g3on').textContent = c.name.toUpperCase();
    $('#g3a').textContent = '0'; $('#g3b').textContent = '0'; $('#g3turn').textContent = 'Выход в круг'; $('#g3mv').innerHTML = '';
    H.play('Bboy_Uprock', { fade: .3 }); opp.play('Breakdance_Uprock', { fade: .3 });
    paintAct();
  }
  $('#g3skip').onclick = () => { if (!B || B.phase === 'end') return; B.skip = true; };

  const face = (J, x, z) => { J.root.rotation.y = Math.atan2(x - J.root.position.x, z - J.root.position.z); };
  function mvText(s, res) {
    const e = $('#g3mv'); e.innerHTML = (s.nm || '') + (res ? `<small class="${res[0]}">${res[1]}</small>` : '');
    e.classList.add('pop'); setTimeout(() => e.classList.remove('pop'), 180);
  }
  function fallStart(J) { J.fall = { t: 0, side: Math.random() < .5 ? -1 : 1 }; if (J.act) J.act.timeScale = .15; ctx.shake && ctx.shake(.6); }
  function fallTick(J, dt, soft) {
    const f = J.fall; if (!f) return; f.t += dt;
    const k = ease(clamp(f.t / .35, 0, 1)), up = ease(clamp((f.t - (soft ? .7 : 1.1)) / .5, 0, 1));
    J.rig.rotation.z = f.side * (soft ? .7 : 1.35) * k * (1 - up); J.rig.position.y = -(soft ? .05 : .25) * k * (1 - up);
    if (f.t > (soft ? .7 : 1.1) && !f.up) { f.up = true; J.play('Breakdance_Ready', { fade: .5 }); }
  }
  function fallEnd(J) { J.fall = null; J.rig.rotation.z = 0; J.rig.position.y = 0; }

  function battleTick(dt) {
    const H = W.hero, now = performance.now() / 1000;
    if (B.phase === 'walk') {   // both walk into place while toprocking
      const k = ease(clamp((now - B.pt) / 1.6, 0, 1));
      H.root.position.set(lerp(B.fromMe.x, B.meSpot.x, k), 0, lerp(B.fromMe.z, B.meSpot.z, k)); face(H, B.cx, B.cz);
      B.opp.root.position.set(lerp(B.fromOp.x, B.opSpot.x, k), 0, lerp(B.fromOp.z, B.opSpot.z, k)); face(B.opp, B.cx, B.cz);
      if (k >= 1) { B.phase = 'turn'; B.i = -1; nextTurn(); }
    } else if (B.phase === 'turn') {
      const T = B.turns[B.i], J = T.J, t = now - B.t0, home = T.who === 'me' ? B.meSpot : B.opSpot;
      if (B.skip) { finishSkip(); return; }
      // step into the middle, then the set, then back
      const kin = ease(clamp(t / .9, 0, 1)), kout = ease(clamp((t - (T.len - 1.4)) / 1.2, 0, 1));
      J.root.position.set(lerp(home.x, B.cx, kin * (1 - kout)), 0, lerp(home.z, B.cz, kin * (1 - kout)));
      const other = T.who === 'me' ? B.opp : H; face(other, J.root.position.x, J.root.position.z);
      if (t < .9) face(J, B.cx, B.cz); else if (kout > 0) face(J, home.x * 2 - B.cx, home.z * 2 - B.cz);
      let si = T.seq.findIndex(s => t < s.b);
      if (t >= .9 && si >= 0 && si !== T.si) {
        const s = T.seq[si]; T.si = si;
        if (s.c) { J.play(s.c, { fade: s.kind === 'down' ? .3 : s.kind === 'freeze' ? .45 : .4, at: s.at }); if (J.act) J.act.timeScale = 1; }
        if (s.kind === 'top' || s.kind === 'foot') { T.score += s.pts; mvText(s, ['ok', '+' + s.pts]); }
        else if (s.kind === 'power' || s.kind === 'freeze') mvText(s);
        paintScore(T);
      }
      const s = si >= 0 ? T.seq[si] : null;
      if (s && (s.kind === 'power' || s.kind === 'freeze') && !s.done && (t - s.a) / s.len >= (s.fail ? s.failAt : .7)) {
        s.done = true;
        if (s.fail) { const k = s.kind === 'power' ? .5 : 0; T.score += k; fallStart(J); mvText(s, ['bad', s.kind === 'power' ? 'Срыв! +0.5 за попытку' : 'Не удержал! 0']); if (T.who === 'me') B.clean = false; }
        else { T.score += s.pts; mvText(s, ['ok', 'Чисто! +' + s.pts]); ctx.flash && ctx.flash(s.kind === 'freeze'); }
        paintScore(T);
      }
      if (J.fall) fallTick(J, dt, s && s.soft);
      if (s && s.kind !== 'fall' && J.fall && J.fall.up) fallEnd(J);
      if (si < 0 && !T.back) { T.back = true; if (J.fall) fallEnd(J); J.play(T.who === 'me' ? 'Bboy_Uprock' : 'Breakdance_Uprock', { fade: .4 }); $('#g3mv').innerHTML = ''; }
      if (t >= T.len) { if (J.fall) fallEnd(J); T.score += T.style; paintScore(T); nextTurn(); }
      W.camT.x = lerp(W.camT.x, J.root.position.x, 1 - Math.exp(-dt * 2)); W.camT.z = lerp(W.camT.z, J.root.position.z + .3, 1 - Math.exp(-dt * 2));
    }
    H.tick(dt); B.opp.tick(dt);
  }
  function paintScore(T) {
    const me = B.turns.filter(x => x.who === 'me').reduce((a, x) => a + x.score, 0), op = B.turns.filter(x => x.who === 'op').reduce((a, x) => a + x.score, 0);
    B.me = me; B.op = op; $('#g3a').textContent = (Math.round(me * 10) / 10).toString(); $('#g3b').textContent = (Math.round(op * 10) / 10).toString();
  }
  function nextTurn() {
    B.i++; const H = W.hero;
    if (B.i >= B.turns.length) { judge(); return; }
    const T = B.turns[B.i]; B.t0 = performance.now() / 1000; T.si = -1;
    const other = T.who === 'me' ? B.opp : H; other.play('Breakdance_Ready', { fade: .4, speed: 1.05 });
    T.J.play(pick(TOP, Math.random), { fade: .3 });
    $('#g3turn').textContent = (T.who === 'me' ? 'Твой выход' : 'Выход: ' + B.g.c.name) + ' · раунд ' + (Math.floor(B.i / 2) + 1);
    $('#g3mv').innerHTML = '';
  }
  function finishSkip() {
    // play out the rest instantly: every remaining scoring step counts as decided by its outcome
    B.turns.forEach((T, i) => { if (i < B.i) return; T.seq.forEach(s => { if (s.done || (i === B.i && T.si >= 0 && T.seq.indexOf(s) <= T.si && s.kind !== 'power' && s.kind !== 'freeze')) return;
      if (s.kind === 'top' || s.kind === 'foot') { if (!(i === B.i && T.seq.indexOf(s) <= T.si)) T.score += s.pts; }
      else if (s.kind === 'power' || s.kind === 'freeze') { s.done = true; if (!s.fail) T.score += s.pts; else { if (s.kind === 'power') T.score += .5; if (T.who === 'me') B.clean = false; } } });
      if (!(i < B.i)) T.score += T.style; });
    [W.hero, B.opp].forEach(J => { if (J.fall) fallEnd(J); });
    paintScore(B.turns[0]); judge();
  }
  function judge() {
    B.phase = 'end'; $('#g3skip').style.display = 'none'; const H = W.hero, c = B.g.c, diff = B.me - B.op;
    H.root.position.set(B.meSpot.x, 0, B.meSpot.z); B.opp.root.position.set(B.opSpot.x, 0, B.opSpot.z); face(H, B.cx, B.cz); face(B.opp, B.cx, B.cz);
    const votes = [0, 1, 2].map(() => (diff + (Math.random() - .5) * 2.4 > 0 ? 'me' : 'op')), myV = votes.filter(v => v === 'me').length, win = myV >= 2;
    H.play(win ? 'Breakdance_Ending_1' : 'Breakdance_Ready', { fade: .4 }); B.opp.play(win ? 'Breakdance_Ready' : 'Bboy_Uprock', { fade: .4 });
    let lines = [];
    if (win) {
      const was = S.wins[c.id] || 0, rk0 = rankOf(S.rep), rep = BAL.repWin * c.lv + (B.clean ? BAL.repClean : 0);
      S.rep += rep; S.wins[c.id] = was + 1; S.beat[c.id] = today();
      lines.push(`<span class="rw">+${rep} ★ уважения</span>${B.clean ? ' (чистый батл без срывов)' : ''}`);
      const gi = was === 0 ? 0 : was === 2 ? 1 : -1, gid = gi >= 0 ? c.gear[gi] : null;
      if (gid && !S.own.includes(gid) && HERO.GEAR && HERO.GEAR[gid]) { S.own.push(gid); const G = HERO.GEAR[gid]; lines.push(`<span class="rw">${G.ico} Новая шмотка: ${G.name}</span>`); }
      else if (c.gear[1] && was < 2 && !S.own.includes(c.gear[1])) lines.push(`Победи их ещё ${2 - was} раз — получишь ${HERO.GEAR[c.gear[1]] ? HERO.GEAR[c.gear[1]].name : 'шмотку'}`);
      const rk = rankOf(S.rep); if (rk > rk0) lines.push(`<span class="rw">🏅 Новое звание: ${BAL.ranks[rk]}</span>`);
      lines.push('Банда ушла со двора до завтра.');
    } else {
      lines.push(B.lv < c.lv ? 'Они сильнее тебя. Уроки поднимают уровень героя — он реже падает и крутит сложнее.' : 'Не повезло со срывами. Попробуй ещё раз.');
    }
    save(); paintHud();
    const res = $('#g3res'); res.style.setProperty('--oc', c.col);
    res.innerHTML = `<div style="font:600 12px Inter;letter-spacing:.14em;color:#9a968e">СУДЬИ</div><div class="jd">${votes.map(v => `<i class="${v}">${v === 'me' ? 'ТЫ' : 'ОНИ'}</i>`).join('')}</div>
      <h3 class="${win ? 'w' : 'l'}">${win ? 'ПОБЕДА!' : 'ПОРАЖЕНИЕ'}</h3><p>Счёт ${Math.round(B.me * 10) / 10} : ${Math.round(B.op * 10) / 10} · судьи ${myV} : ${3 - myV}</p>
      ${lines.map(l => `<p>${l}</p>`).join('')}
      ${win ? '' : `<button class="sec" id="g3les">🎬 К урокам — стать сильнее</button>`}<button id="g3ok">Дальше</button>`;
    res.querySelectorAll('.jd i').forEach((e, i) => setTimeout(() => e.classList.add('on'), 500 + i * 450));
    res.classList.add('on');
    $('#g3ok').onclick = endBattle; const L = $('#g3les'); if (L) L.onclick = () => (location.href = './');
  }
  function endBattle() {
    $('#g3res').classList.remove('on'); $('#g3bt').classList.remove('on');
    const g = B.g; B.opp.root.position.set(B.opp.home.x, 0, B.opp.home.z); B.opp.play('Breakdance_Ready', { fade: .3 });
    B.opp.root.rotation.y = Math.atan2(g.x - B.opp.home.x, g.z - B.opp.home.z);
    W.hero.play('Breakdance_Ready', { fade: .3 });
    setShown(g); B = null; W.lock = false; W.camT = null; document.body.classList.remove('g3fight'); paintAct();
  }

  // ---------- per frame ----------
  function update(dt) {
    if (B) { if (B.phase !== 'end') battleTick(dt); else { W.hero.tick(dt); B.opp.tick(dt); } }
    crews.forEach(g => { if (!g.label.visible) return; g.people.forEach(J => { if (!B || J !== B.opp) J.tick(dt); }); });
    if (!B) {
      const p = W.hero.root.position; let best = null, bd = 3.1;
      crews.forEach(g => { if (!shown(g)) return; const d = Math.hypot(p.x - g.x, p.z - g.z); if (d < bd) { bd = d; best = g; } });
      if (best !== near) { near = best; paintAct(); }
    }
  }
  return { update, busy: () => !!B, state: () => S, crews, _start: id => startBattle(crews.find(g => g.c.id === id)), _skip: () => { if (B) B.skip = true; } };
}
