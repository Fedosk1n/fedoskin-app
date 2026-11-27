// Timing and vocabulary shared by the matches, shows and the dancers at the Yard cypher.
export const TOP = [
  ['Breakdance_Uprock', 'CROSS STEP'], ['Breakdance_Uprock_Var_1', 'KICK STEP'],
  ['Bboy_Uprock', 'TOPROCK'], ['Brooklyn_Uprock', 'BROOKLYN ROCK'], ['Breakdance_Uprock_Var_2', 'INDIAN STEP'],
];
const FOOT = [
  ['Breakdance_Footwork_1', 0, 1.5], ['Breakdance_Footwork_1', 1.5, 1.67],
  ['Breakdance_Footwork_2', 0, 1.6], ['Breakdance_Footwork_3', 0, 2.3],
  ['Breakdance_Footwork_3', 2.3, 2.27], ['Breakdance_Footwork_To_Freeze', 0, 1.25],
];
export const HOLDS = [
  { c: 'Breakdance_Footwork_To_Freeze', at: 1.3, len: 2.3, nm: 'CHAIR FREEZE' },
  { c: 'Crossleg_Freeze', at: 0, len: 2.0, nm: 'CROSSLEG FREEZE' },
  { c: 'Breakdance_Freeze_Var_2', at: 1.4, len: 1.75, nm: 'AIR FREEZE', lv: 2, risk: .03 },
  { c: 'Breakdance_Freeze_Var_1', at: 1.5, len: 1.3, nm: 'AIR FREEZE', lv: 2, risk: .03 },
  { c: 'Breakdance_Freeze_Var_4', at: 1.2, len: 1.8, nm: 'BABY FREEZE' },
  { c: 'Breakdance_Freeze_Var_3', at: 1.2, len: 2.3, nm: 'BABY FREEZE' },
  { c: 'City_Shoulder_Hold', at: 0, len: 2.0, nm: 'SHOULDER FREEZE', lv: 2, risk: .02 },
];
const DROP_HOLDS = [
  { c: 'Breakdance_Freeze_Var_4', at: .8, len: 2.1, nm: 'BABY FREEZE' },
  { c: 'Breakdance_Freeze_Var_3', at: .8, len: 2.7, nm: 'BABY FREEZE' },
  { c: 'Breakdance_Freeze_Var_2', at: .9, len: 2.1, nm: 'AIR FREEZE', lv: 2 },
  { c: 'Breakdance_Freezes', at: 1.6, len: 2.25, nm: 'AIR FREEZE', lv: 2 },
];
const FLOOR = [['City_Floorrock_Sweep', 'FLOORROCK']];
const TRICKS = [['City_Trick_Thread', 'LEG THREAD'], ['City_Trick_KickSwitch', 'KICK SWITCH']];
const DROPS = ['Breakdance_Uprock_To_Ground', 'City_Sweep_Drop'];
const ENTRIES = [
  { bend: 0, len: 1.25 }, { bend: 0, len: 1.76 },
  { bend: -.36, len: 1.42 }, { bend: .36, len: 1.42 }, { bend: -.76, len: 1.70 }, { bend: .76, len: 1.70 },
];
const patterns = {
  classic: ['top', 'down', 'longFoot'],
  rock: ['top', 'extraTop', 'down', 'foot'],
  drop: ['top', 'dropHold', 'foot'],
  powerFirst: ['top', 'down', 'quickFoot'],
  floorStart: ['top', 'down', 'longFoot', 'rise', 'extraTop', 'down'],
  rebound: ['top', 'down', 'quickFoot', 'rise', 'extraTop', 'down'],
  freezeBreak: ['top', 'down', 'quickFoot', 'hold', 'quickFoot'],
  floorFlow: ['top', 'down', 'quickFoot', 'floor', 'foot'],
  shapeHit: ['top', 'down', 'quickFoot', 'flex', 'trick'],
  floorAnswer: ['top', 'down', 'quickFoot', 'trick', 'hold'],
  threadBreak: ['top', 'down', 'trick', 'foot'],
  shapeStart: ['top', 'dropHold', 'flex', 'quickFoot'],
};
export const SHAPES = Object.keys(patterns);
const accents = {
  groove: ['classic','rock','rebound','threadBreak'],
  ground: ['classic','floorStart','floorAnswer','threadBreak'],
  shapes: ['drop','shapeHit','freezeBreak','shapeStart'],
  power: ['powerFirst','classic','shapeHit','freezeBreak'],
};
const crewStyles = {
  rusty: 'groove', acid: 'power', owls: 'ground', gold: 'shapes',
  stencil: 'shapes', turn: 'groove', chrome: 'power', funk: 'groove', roots: 'ground', wave: 'shapes',
  rebar: 'ground', volt: 'power', forge: 'shapes',
};
export const crewStyle = id => crewStyles[id];

export const CORE_POWER = [
  { id: 'swipe', c: 'Breakdance_Swipes', lv: 1, pts: 2, risk: 0, nm: 'SWIPES' },
  { id: 'headspin', c: 'Head_Spinning', lv: 2, pts: 3, risk: .05, nm: 'HEADSPIN', pre: 'Headspin_Start', post: 'Headspin_End' },
  { id: 'flare', c: 'Flair', lv: 3, pts: 3.5, risk: .08, nm: 'FLARE' },
  { id: 'ninety', c: 'Breakdance_1990', lv: 4, pts: 4, risk: .1, nm: '1990' },
];
const BACKSPIN = { id: 'backspin', c: 'City_Backspin', lv: 3, pts: 3, risk: .05, nm: 'BACKSPIN' };
export const side = (c, mirrored) => mirrored ? c + '_M' : c;
const pick = (options, r) => options[Math.floor(r()*options.length)];
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

function variety(memory, key, options, r, forget = 1, weight = () => 1, identify = item => item) {
  const recent = memory[key] || [];
  const pool = options.filter(item => !recent.includes(identify(item)));
  const available = pool.length ? pool : options;
  let draw = r() * available.reduce((sum, item) => sum + weight(item), 0);
  const item = available.find(candidate => (draw -= weight(candidate)) < 0) || available.at(-1);
  memory[key] = [identify(item), ...recent].slice(0, forget);
  return item;
}

export function pickPower(memory, r, level, duration, profile) {
  const choices = [...CORE_POWER, BACKSPIN].filter(p => p.lv <= level && duration(p.c));
  return variety(memory, 'power', choices, r, 1, p =>
    profile === 'power' ? 1 + .30 * p.lv
      : profile === 'ground' && p.id === 'backspin' ? 2.4 : 1, p => p.id);
}

export function pickHold(memory, level, r, exclude, duration) {
  const choices = HOLDS.filter(f => (f.lv || 1) <= level && f.nm !== exclude && duration(f.c));
  return variety(memory, 'finish', choices, r, 1, undefined, f => f.nm);
}

// Complete intervals that are compatible with the original capture, near a whole or half beat.
function phraseTime(native, bpm) {
  const halfBeat = 30 / bpm;
  return clamp(Math.round(native / halfBeat) * halfBeat, native * .83, native * 1.19);
}

export function breakingOpening({ memory, r, lv, duration, bpm = 112, profile, force, distance = 2.12, step = 0 }) {
  const shape = Object.hasOwn(patterns, force) ? force : variety(memory, 'shape', SHAPES, r, 4, s => {
    if (s === 'floorFlow') return profile === 'ground' ? .55 : .20;
    return accents[profile]?.includes(s) ? 3 : 1;
  });
  const { bend, len } = variety(memory, 'entry', ENTRIES, r, 2);
  const seq = [];
  let mirror = r() < .5, dir = mirror ? -1 : 1, topScored = false, footScored = false, held;
  const push = (c, len, at = 0, details = {}) => seq.push({ c, len, at, ...details });
  const source = (c, at, span, details = {}) => {
    const len = phraseTime(span, bpm);
    push(side(c, mirror), len, at, { sp: span / len, ...details });
    return len;
  };
  const top = () => {
    const [c,nm] = variety(memory, 'top', TOP, r, 2, undefined, x => x[0]);
    const raw = duration(c);
    const at = pick([0, .11, .21], r) * Math.min(raw, 2.1);
    const available = raw - at - .05;
    const beats = Math.min(topScored ? (r() < .55 ? 2 : 3) : (r() < .65 ? 4 : 5), Math.floor(available * bpm / 51));
    const len = beats * 60 / bpm;
    const sp = Math.min(.91 + r()*.17, available / len);
    push(side(c, mirror), len, at, { nm, sp, kind: topScored ? 'top2' : 'top', pts: topScored ? 0 : 1 + step, fade: .32 });
    topScored = true;
  };
  const down = () => {
    const c = variety(memory, 'drop', DROPS.filter(c => duration(c) > 0), r);
    const span = duration(c) - .045;
    const time = phraseTime(span, bpm);
    source(c, 0, span, { kind: 'down', fade: .29, yaw: dir * (.22 + r()*.31), yt: time });
  };
  const rise = () => source('Crossleg_Freeze', .76, 1.24, { kind: 'rise', fade: .34, yaw: -dir * .32, yt: .85 });
  const addFoot = (out, count, scored) => {
    for (let i=0; i<count; i++) {
      const [c, at, span] = variety(memory, 'feet', FOOT, r, 1, undefined, f => f[0]);
      if (i ? r() < .42 : r() < .28) mirror = !mirror;
      if (r() < .28) dir = -dir;
      const len = phraseTime(span, bpm);
      out.push({ c: side(c, mirror), len, at, sp: span / len, fade: i ? .32 : .38,
        nm: 'FOOTWORK', kind: !i && scored ? 'foot' : 'foot2', pts: !i && scored ? 1.5 + step : 0,
        yaw: dir * (.16 + r()*.35), yt: Math.min(.72, len) });
    }
  };
  const foot = count => { addFoot(seq, count, !footScored); footScored = true; };
  const accent = (pool, key, kind) => {
    const supported = pool.filter(([c]) => duration(c) > 0);
    if (!supported.length) return;
    const [c, nm] = variety(memory, key, supported, r, 1);
    source(c, 0, duration(c) - .018, { kind, nm, fade: .3 });
  };
  const hold = drop => {
    const choice = drop ? DROP_HOLDS : HOLDS.filter(h => h.nm === 'BABY FREEZE' || h.nm === 'CHAIR FREEZE');
    const actual = variety(memory, 'accentHold', choice.filter(f => (f.lv || 1) <= lv), r, 1, undefined, f => f.c);
    held = actual.nm;
    source(actual.c, actual.at, drop ? actual.len : actual.len - .55, { kind: 'hold', nm: held, fade: .4 });
  };
  const phases = {
    top, extraTop: () => { mirror = !mirror; top(); }, down, rise, foot: () => foot(2),
    quickFoot: () => foot(1), longFoot: () => foot(r() < .7 ? 2 : 3),
    floor: () => accent(FLOOR, 'floor', 'floor'), trick: () => accent(TRICKS, 'trick', 'trick'),
    flex: () => accent([['City_Flex_Reach', 'FLEX']], 'flex', 'flex'),
    hold: () => hold(false), dropHold: () => hold(true),
  };
  for (const phase of patterns[shape]) phases[phase]();
  return { seq, shape, held, enter: Math.max(len, .36 + distance / 2), bend,
    afterPower: out => { if (shape === 'powerFirst') addFoot(out, 1, false); }, rise };
}

export function setTimes(seq, from, time) {
  for (let i = from; i < seq.length; i++) {
    seq[i].a = time;
    time += seq[i].len;
    seq[i].b = time;
  }
  return time;
}

// Preserve the dancer's world-space travel when the next phrase changes direction.
export function spinTick(dancer, seq, time) {
  for (const step of seq) {
    if (!step.yaw || time < step.a || step.turned === 1) continue;
    const t = clamp((time - step.a) / step.yt, 0, 1), ease = t*t*(3-2*t);
    const d = step.yaw * (ease - (step.turned || 0));
    step.turned = ease;
    if (!d) continue;
    const c = Math.cos(d), s = Math.sin(d), { dx, dz } = dancer;
    dancer.root.rotation.y += d;
    dancer.dx = c*dx - s*dz;
    dancer.dz = s*dx + c*dz;
  }
}

export function beatEntry(time, bpm, beat) {
  if (!Number.isFinite(beat) || beat < 0) return time;
  const current = beat + time*bpm/60;
  return time + (Math.ceil(current*2 - .0001)/2 - current)*60/bpm;
}

export function cypherSet({ memory, r, lv, duration, bpm, profile }) {
  const opening = breakingOpening({ memory, r, lv, duration, bpm, profile });
  const { seq } = opening, P = pickPower(memory, r, lv, duration, profile);
  if (P.pre) seq.push({ c: P.pre, at: 1, len: 1.8, kind: 'pre' });
  if (P.id === 'ninety') opening.rise();
  const native = duration(P.c);
  const steps = P.id === 'backspin' ? 1 : Math.max(1, Math.round((2.15 + r()*.6) / native));
  seq.push({ c: side(P.c, P.id === 'backspin' && r() < .5), at: 0, len: native * steps, kind: 'power' });
  if (P.post) seq.push({ c: P.post, at: 0, len: 1.8, kind: 'post' });
  opening.afterPower(seq);
  const F = pickHold(memory, lv, r, opening.held, duration);
  seq.push({ ...F, c: side(F.c, r() < .5), kind: 'hold', fade: .4 });
  return { ...opening, list: seq, len: setTimes(seq, 0, 0) };
}
