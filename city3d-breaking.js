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
const KICK_THROUGH = 'City_Foot_KickThrough';
const REAR_STEP = 'City_Foot_RearStep';
const CIRCLE = 'City_Foot_Circle';
const THREAD_RISE = 'City_Foot_ThreadRise';
const THREAD_CATCH = 'City_Foot_ThreadCatch';
const MOTIF_CLIP = { switch:'City_Battle_Support', arc:'City_Battle_LegArc', thread:THREAD_RISE };
export const HOLDS = [
  { c: 'Breakdance_Footwork_To_Freeze', at: 1.3, len: 2.3, nm: 'CHAIR FREEZE' },
  { c: 'Crossleg_Freeze', at: 0, len: 2.0, nm: 'CROSSLEG FREEZE' },
  { c: 'Breakdance_Freeze_Var_2', at: 1.4, len: 1.75, nm: 'AIR FREEZE', lv: 2, risk: .03 },
  { c: 'Breakdance_Freeze_Var_1', at: 1.5, len: 1.3, nm: 'AIR FREEZE', lv: 2, risk: .03 },
  { c: 'Breakdance_Freeze_Var_4', at: 1.2, len: 1.8, nm: 'BABY FREEZE' },
  { c: 'Breakdance_Freeze_Var_3', at: 1.2, len: 2.3, nm: 'BABY FREEZE' },
  { c: 'City_Shoulder_Hold', at: 0, len: 2.0, nm: 'SHOULDER FREEZE', lv: 2, risk: .02 },
];
const FLOOR = [['City_Floorrock_Sweep', 'FLOORROCK']];
const TRICKS = [['City_Trick_Thread', 'LEG THREAD'], ['City_Trick_KickSwitch', 'KICK SWITCH']];
const DROPS = ['Breakdance_Uprock_To_Ground', 'City_Sweep_Drop'];
const ENTRIES = [
  { bend: 0, len: 1.25 }, { bend: 0, len: 1.76 },
  { bend: -.36, len: 1.42 }, { bend: .36, len: 1.42 }, { bend: -.76, len: 1.70 }, { bend: .76, len: 1.70 },
];
const patterns = {
  classic: ['top', 'down', 'longFoot', 'kick'],
  rock: ['top', 'extraTop', 'down', 'foot', 'kick'],
  drop: ['top', 'sweepDrop', 'foot', 'sweep'],
  powerFirst: ['top', 'down', 'quickFoot', 'kick'],
  floorStart: ['top', 'down', 'longFoot', 'rear', 'rise', 'extraTop', 'down'],
  rebound: ['top', 'down', 'quickFoot', 'kick', 'rise', 'extraTop', 'down'],
  sweepBreak: ['top', 'down', 'quickFoot', 'sweep', 'rear', 'quickFoot'],
  floorFlow: ['top', 'down', 'quickFoot', 'floor', 'foot', 'kick'],
  shapeHit: ['top', 'down', 'quickFoot', 'flex', 'trick', 'rear'],
  floorAnswer: ['top', 'down', 'quickFoot', 'trick', 'sweep', 'kick'],
  threadBreak: ['top', 'down', 'trick', 'foot', 'rear'],
  shapeStart: ['top', 'sweepDrop', 'flex', 'quickFoot', 'kick'],
};
// The street uses these older forms for ambient cyphers. Duels add grounded links, accents and changes of level.
const ambientShapes = Object.keys(patterns);
Object.assign(patterns, {
  crossArc: ['top', 'arc', 'down', 'foot', 'kick'],
  softDrop: ['top', 'compact', 'quickFoot', 'sweep', 'foot', 'kick'],
  supportLine: ['top', 'down', 'quickFoot', 'support', 'sweep', 'rear'],
  floorArc: ['top', 'down', 'sweep', 'foot', 'kick', 'rise', 'extraTop', 'down'],
  cutBack: ['top', 'arc', 'compact', 'reverse', 'foot', 'rear'],
  hinge: ['top', 'down', 'support', 'quickFoot', 'rear', 'rise', 'compact'],
  releaseLine: ['top', 'compact', 'sweep', 'foot', 'trick', 'kick'],
  clubArc: ['top', 'compact', 'kickFoot', 'rear', 'reverse'],
  clubLink: ['top', 'compact', 'support', 'kickFoot', 'quickRear'],
  clubPivot: ['top', 'down', 'reverse', 'rearFoot', 'quickKick'],
  clubSweep: ['top', 'compact', 'sweep', 'rearFoot', 'quickKick'],
  clubLift: ['top', 'sweepDrop', 'kickFoot', 'circle'],
  clubThread: ['top', 'down', 'rearFoot', 'quickKick', 'threadRise'],
  returnCircle: ['top', 'down', 'circle', 'kickFoot', 'quickRear'],
  threadAscent: ['top', 'compact', 'kickFoot', 'rear', 'threadRise'],
});
export const SHAPES = Object.keys(patterns);

const streets = {
  yard: ['classic', 'rock', 'drop', 'crossArc', 'softDrop'],
  center: ['crossArc', 'cutBack', 'softDrop', 'rock', 'drop', 'floorAnswer'],
  park: ['supportLine', 'floorArc', 'cutBack', 'floorStart', 'floorFlow', 'threadBreak', 'returnCircle'],
  prom: ['hinge', 'releaseLine', 'floorArc', 'sweepBreak', 'powerFirst', 'shapeHit', 'returnCircle', 'threadAscent'],
  club: ['clubArc', 'clubLink', 'clubPivot', 'clubSweep', 'clubLift', 'clubThread', 'returnCircle', 'threadAscent'],
};
const profiles = {
  groove: { motif: 'arc', pre: ['Lift','Nod',null], post: ['Chest',null,'Yield'], shape: ['crossArc','floorArc','cutBack','rock','clubArc','clubSweep','threadAscent'] },
  ground: { motif: 'switch', pre: ['Nod','Offer',null], post: [null,'Yield','Nod'], shape: ['supportLine','cutBack','hinge','floorAnswer','floorStart','clubLink','clubPivot','returnCircle'] },
  shapes: { motif: 'thread', pre: ['Offer',null,'Nod'], post: ['Nod','Chest',null], shape: ['softDrop','releaseLine','shapeStart','sweepBreak','clubSweep','clubLift','threadAscent'] },
  power: { motif: 'switch', pre: ['Listen','Offer',null], post: ['Chest',null,'Nod'], shape: ['cutBack','supportLine','powerFirst','hinge','clubPivot','clubThread','returnCircle'] },
};
const clubStyles = { needle:'ground', echo:'groove', tape:'shapes', pulse:'power', pivot:'groove', mono:'ground', fader:'shapes' };
export const battleStyle = (id, fallback) => clubStyles[id] || fallback || 'groove';

const answer = (id, c, motif, name) => ({ id, c, motif, name, lv: 1, pts: 2, risk: 0 });
export const BATTLE_ANSWERS = [
  answer('replySwitch', 'City_Battle_Reverse', 'switch', 'Смена опоры'),
  answer('replyArc', 'City_Battle_LegArc', 'arc', 'Дуга ноги'),
  answer('replyThread', THREAD_RISE, 'thread', 'Продевание с подъёмом'),
];
export const advancedFootwork = district => district === 'prom' || district === 'club';
export const battleFootMoves = (district, duration) => BATTLE_ANSWERS
  .filter(move => (move.motif !== 'thread' || advancedFootwork(district)) && duration(move.c));
export const WHEEL_FOOTWORK = 'City_Battle_WheelFootwork';
export const REPLY_PRECISION = { park: 0, prom: .85, club: .90 };
export function battleTechnique(motif, leads, advanced = false) {
  if (leads) return motif;
  if (motif === 'switch') return 'arc';
  if (advanced && motif === 'arc') return 'thread';
  return 'switch';
}
export function clubCall(planned, previous, moves, r) {
  const advanced = moves.length === BATTLE_ANSWERS.length;
  if (battleTechnique(planned, false, advanced) !== previous) return planned;
  return pick(moves.filter(move => battleTechnique(move.motif, false, advanced) !== previous), r).motif;
}
export function battleReplyPoints({ district, call, leads, answer, eligible, clean, precision = 0,
  previous, advanced = advancedFootwork(district) }) {
  if (!call || answer !== battleTechnique(call, leads, advanced) || !eligible || !clean) return 0;
  if (precision < (REPLY_PRECISION[district] || 0) || (district === 'club' && !leads && answer === previous)) return 0;
  return .5;
}

export function duelPlan({ district, profile, memory, r, duration, opening = false, hero = false }) {
  if (!duration(BATTLE_ANSWERS[0].c) || !duration(BATTLE_ANSWERS[1].c)) return {};
  const style = profiles[profile] || profiles.groove;
  const moves = battleFootMoves(district, duration);
  const label = (key, names) => {
    const choice = variety(memory, key, names, r);
    return choice ? 'City_Battle_' + choice : null;
  };
  const post = label('afterFloor', hero ? ['Settle','Square'] : style.post);
  const before = hero ? [post === 'City_Battle_Square' ? 'Settle' : 'Square', null] : style.pre;
  return {
    district, forms: style.shape, post, pre: label('beforeFloor', before),
    motif: opening && Object.hasOwn(REPLY_PRECISION, district)
      ? variety(memory, 'call', moves.map(move => move.motif), r, 1, value => value === style.motif ? 2.4 : 1)
      : null,
  };
}
const accents = {
  groove: ['classic','rock','rebound','threadBreak'],
  ground: ['classic','floorStart','floorAnswer','threadBreak'],
  shapes: ['drop','shapeHit','sweepBreak','shapeStart'],
  power: ['powerFirst','classic','shapeHit','sweepBreak'],
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
const BACKSPIN = { id: 'backspin', c: 'City_Backspin', lv: 3, pts: 3, risk: .05, nm: 'BACKSPIN', fade: .24 };
export const side = (c, mirrored) => mirrored ? c + '_M' : c;
const pick = (options, r) => options[Math.floor(r()*options.length)];
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

function variety(memory, key, options, r, forget = 1, weight = () => 1, identify = item => item) {
  const recent = memory[key] || [];
  const pool = options.filter(item => !recent.includes(identify(item)));
  const different = options.filter(item => identify(item) !== recent[0]);
  const available = pool.length ? pool : different.length ? different : options;
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

export function pickHold(memory, level, r, duration) {
  const choices = HOLDS.filter(f => (f.lv || 1) <= level && duration(f.c));
  return variety(memory, 'finish', choices, r, 1, undefined, f => f.nm);
}

// Complete intervals that are compatible with the original capture, near a whole or half beat.
function phraseTime(native, bpm) {
  const halfBeat = 30 / bpm;
  return clamp(Math.round(native / halfBeat) * halfBeat, native * .83, native * 1.19);
}

export function threadCatch(duration, bpm, mirrored) {
  const span = duration(THREAD_CATCH) - .012;
  if (span <= 0) return null;
  const len = phraseTime(span, bpm);
  return { c:side(THREAD_CATCH, mirrored), len, at:0, sp:span / len, kind:'down', fade:.21 };
}

export function breakingOpening({ memory, r, duration, bpm = 112, profile, force, distance = 2.12, step = 0, duel, call, response, avoid, technical = false }) {
  const districtForms = streets[duel?.district] || ambientShapes;
  const forms = districtForms.filter(shape => shape !== avoid);
  const shape = Object.hasOwn(patterns, force) ? force : variety(memory, 'shape', forms, r, 4, s => {
    if (duel?.forms?.includes(s)) return 4;
    if (s === 'floorFlow') return profile === 'ground' ? .55 : .20;
    return accents[profile]?.includes(s) ? 3 : 1;
  });
  const { bend, len } = variety(memory, 'entry', ENTRIES, r, 2);
  const seq = [];
  const club = duel?.district === 'club';
  // The experienced Club dancer can hit a one-hand air freeze before taking the next drop.
  const form = shape === 'clubLift' && technical && duration('Breakdance_Freeze_Var_2') >= 3.63
    ? ['top','airAccent','sweepDrop','kickFoot'] : patterns[shape];
  const responseInMotif = response && MOTIF_CLIP[call] === response.c;
  const responseInThread = response?.motif === 'thread' && form.includes('threadRise');
  const fixedFeet = { kick:KICK_THROUGH, kickFoot:KICK_THROUGH, quickKick:KICK_THROUGH, rear:REAR_STEP, rearFoot:REAR_STEP, quickRear:REAR_STEP };
  const reserved = new Set(form.map(phase => fixedFeet[phase]));
  const links = [KICK_THROUGH, ...(duel?.district === 'yard' ? [] : [REAR_STEP])]
    .filter(c => duration(c) > 0 && !reserved.has(c)).map(c => [c, 0, duration(c) - .012]);
  const feet = [...FOOT, ...links];
  let mirror = r() < .5, dir = mirror ? -1 : 1, topScored = false, footScored = false, shown = false;
  let standingReply = false;
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
    const compact = topScored || club;
    const beats = Math.min(compact ? (r() < (club ? .90 : .55) ? 2 : 3) : (r() < .65 ? 4 : 5), Math.floor(available * bpm / 51));
    const len = beats * 60 / bpm;
    const sp = Math.min(.91 + r()*.17, available / len);
    push(side(c, mirror), len, at, { nm, sp, kind: topScored ? 'top2' : 'top', pts: topScored ? 0 : 1 + step, fade: .32 });
    topScored = true;
  };
  const descend = c => {
    const span = duration(c) - .045;
    if (club) {
      const len = phraseTime(span * .75, bpm);
      push(side(c, mirror), len, 0, { kind:'down', sp:span / len, fade:.23, yaw:dir * .22, yt:len });
      return;
    }
    const time = phraseTime(span, bpm);
    source(c, 0, span, { kind: 'down', fade: .29, yaw: dir * (.22 + r()*.31), yt: time });
  };
  const down = () => descend(variety(memory, 'drop', DROPS.filter(c => duration(c) > 0), r));
  const catchThread = () => {
    const step = threadCatch(duration, bpm, mirror);
    if (step) seq.push(step);
    else down();
    standingReply = false;
  };
  const rise = () => {
    const riseMove = { kind: 'rise', fade: .30, yaw: -dir * .32, yt: .85 };
    const authored = duration('Festival_StandThrough');
    if (authored) source('Festival_StandThrough', 0, authored - .02, riseMove);
    else source('Crossleg_Freeze', .85, .95, riseMove);
  };
  const addFoot = (out, count, scored, preferred) => {
    for (let i=0; i<count; i++) {
      if (standingReply) catchThread();
      const forced = preferred && duration(preferred) && [preferred, 0, duration(preferred) - .012];
      const [c, at, span] = forced || variety(memory, 'feet', feet, r, 1, undefined, f => f[0]);
      if (forced) memory.feet = [c];
      if (i ? r() < .42 : r() < .28) mirror = !mirror;
      if (r() < .28) dir = -dir;
      const alternative = scored && !i && !responseInMotif && !responseInThread ? response : null;
      const material = alternative ? duration(alternative.c) - .012 : span;
      const len = phraseTime(material, bpm);
      out.push({ c: side(alternative?.c || c, mirror), len, at: alternative ? 0 : at,
        sp: material / len, fade: alternative ? .20 : i ? .32 : .38,
        nm: 'FOOTWORK', answer: alternative?.motif, kind: !i && scored ? 'foot' : 'foot2', pts: !i && scored ? 1.5 + step : 0,
        yaw: dir * (.16 + r()*.35), yt: Math.min(.72, len) });
      standingReply = alternative?.motif === 'thread';
    }
  };
  const foot = (count, preferred) => { addFoot(seq, count, !footScored, preferred); footScored = true; };
  const accent = (pool, key, kind) => {
    const supported = pool.filter(([c]) => duration(c) > 0);
    if (!supported.length) return;
    const [c, nm] = variety(memory, key, supported, r, 1);
    source(c, 0, duration(c) - .018, { kind, nm, fade: .3 });
  };
  const part = (c, kind, extra = {}) => { if (duration(c) > 0) source(c, 0, duration(c) - .02, { kind, fade: .27, ...extra }); };
  const phases = {
    top, extraTop: () => { mirror = !mirror; top(); }, down, rise, foot: () => foot(2),
    quickFoot: () => foot(1), longFoot: () => foot(r() < .7 ? 2 : 3),
    floor: () => accent(FLOOR, 'floor', 'floor'), trick: () => accent(TRICKS, 'trick', 'trick'),
    flex: () => accent([['City_Flex_Reach', 'FLEX']], 'flex', 'flex'),
    sweepDrop: () => duration('City_Sweep_Drop') ? descend('City_Sweep_Drop') : down(),
    airAccent: () => source('Breakdance_Freeze_Var_2', 1.51, 2.12, { kind: 'technical', fade: .23, nm: 'AIR FREEZE' }),
    arc: () => part('City_Battle_Arc', 'top2', { yaw: dir * .39, yt: .76 }),
    compact: () => duel && duration('City_Battle_Compact') ? descend('City_Battle_Compact') : down(),
    support: () => part('City_Battle_Support', 'floor'),
    reverse: () => part(response?.motif === 'switch' ? 'City_Trick_Thread' : 'City_Battle_Reverse', 'trick', { yaw: -dir * .51, yt: .88 }),
    sweep: () => response?.motif === 'arc' ? accent(FLOOR, 'floor', 'floor')
      : part('City_Battle_LegArc', 'floor'),
    kick: () => part(KICK_THROUGH, 'floor'),
    rear: () => part(REAR_STEP, 'floor'),
    quickKick: () => { if (duration(KICK_THROUGH) > 1.18) source(KICK_THROUGH, .13, 1.02, { kind:'floor', fade:.23 }); },
    quickRear: () => { if (duration(REAR_STEP) > 1.28) source(REAR_STEP, .18, 1.09, { kind:'floor', fade:.23 }); },
    circle: () => part(CIRCLE, 'floor', { nm:'Круг с разворотом' }),
    threadRise: () => part(THREAD_RISE, 'rise', { nm:'Продевание с подъёмом', answer:responseInThread ? 'thread' : undefined }),
    kickFoot: () => foot(1, KICK_THROUGH),
    rearFoot: () => foot(1, REAR_STEP),
  };
  const motifPhase = { switch:'support', arc:'sweep', thread:'threadRise' }[call];
  // A display of the elevated motif sits at the end. The other motifs can read as the next grounded step.
  const inForm = form.includes(motifPhase);
  const showMotif = () => {
    part(MOTIF_CLIP[call], 'motif', { motif:call, answer:responseInMotif ? call : undefined, yaw:-dir * .31, yt:.82 });
    shown = true;
  };
  for (const phase of form) {
    if (standingReply) {
      standingReply = false;
      if (phase === 'rise') continue;
      if (!['top','extraTop','arc','down','compact','sweepDrop'].includes(phase)) catchThread();
    }
    if (call && !shown && phase === motifPhase) {
      showMotif();
      continue;
    }
    phases[phase]();
    if (call && call !== 'thread' && !shown && !inForm && ['down','compact','sweepDrop'].includes(phase)) showMotif();
  }
  if (call === 'thread' && !shown) showMotif();
  if (seq.at(-1).c.startsWith(THREAD_RISE)) catchThread();
  if (club) {
    // Fit the longer Club links to a compact musical phrase. All source frames still play.
    const phrase = 12.5 * 60 / bpm;
    const pace = Math.min(1.22, seq.reduce((time, step) => time + step.len, 0) / phrase);
    if (pace > 1) for (const step of seq) {
      step.len /= pace;
      step.sp *= pace;
      if (step.yaw) step.yt /= pace;
    }
  }
  return { seq, shape, enter: Math.max(len, .36 + distance / 2), bend,
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

// Sample a timed link on the phrase clock even when a long frame caps the mixer's delta.
export function samplePhrase(dancer, step, elapsed) {
  if (step.c !== dancer.cur) return;
  if (step.c?.startsWith('City_Backspin')) dancer.phraseTime = elapsed;
  else if (step.sp) dancer.phraseTime = step.at + elapsed * step.sp;
}

// Preserve the dancer's world-space travel when the next phrase changes direction.
export function spinTick(dancer, seq, time) {
  for (const step of seq) {
    if (time >= step.a && time < step.b) samplePhrase(dancer, step, time - step.a);
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
  const opening = breakingOpening({ memory, r, duration, bpm, profile });
  const { seq } = opening, P = pickPower(memory, r, lv, duration, profile);
  if (P.pre) seq.push({ c: P.pre, at: 1, len: 1.6, kind: 'pre' });
  if (P.id === 'ninety') opening.rise();
  const native = duration(P.c);
  const steps = P.id === 'backspin' ? 1 : Math.max(1, Math.round((2.15 + r()*.6) / native));
  seq.push({ c: side(P.c, P.id === 'backspin' && r() < .5), at: 0, len: native * steps, kind: 'power', fade: P.fade });
  if (P.post) seq.push({ c: P.post, at: 0, len: 1.8, kind: 'post' });
  opening.afterPower(seq);
  const F = pickHold(memory, lv, r, duration);
  seq.push({ ...F, c: side(F.c, r() < .5), kind: 'freeze', fade: .4 });
  return { ...opening, list: seq, len: setTimes(seq, 0, 0) };
}

// Each exhibition gets an eight-beat phrase with four beats reserved for the middle link. The end uses a held low shape or a clear rise before the walk.
export const CLUB_PREVIEW_BEATS = 8;
const exhibitions = [
  { id:'circleReturn', profiles:['ground','power'], motif:'switch',
    parts:[['City_Battle_Compact', .01, 1.40], [CIRCLE, .017, 2.10], [KICK_THROUGH, .014, 1.30]] },
  { id:'frontThread', profiles:['groove','shapes'], motif:'thread', standing:true,
    parts:[['City_Sweep_Drop', .03, 1.20], [THREAD_RISE, .015, 2.02], ['City_Battle_Arc', .01, .97]] },
  { id:'arcDown', profiles:['groove','shapes'], motif:'arc',
    parts:[['City_Battle_Arc', 0, 1.0], ['City_Battle_Compact', .01, 1.41], ['City_Battle_LegArc', .02, 1.42]] },
  { id:'lowCross', profiles:['ground','power'], motif:'switch',
    parts:[['City_Battle_Compact', .03, 1.29], ['City_Battle_Support', .02, 1.96], ['City_Trick_Thread', .09, 1.10]] },
  { id:'closeFloor', profiles:['shapes','ground'], motif:'arc',
    parts:[['City_Sweep_Drop', .05, 1.17], ['City_Battle_LegArc', 0, 1.43], ['Festival_StandThrough', 0, 1.03]] },
  { id:'wideSwitch', profiles:['power','groove'], motif:'switch',
    parts:[['Breakdance_Uprock_To_Ground', .02, .92], ['City_Battle_Reverse', 0, 1.43], ['Breakdance_Footwork_To_Freeze', 1.04, 1.03]] },
  { id:'crossFloor', profiles:['ground','power'], motif:'switch',
    parts:[['City_Battle_Compact', .10, 1.21], ['City_Battle_Reverse', .02, 1.41], ['Festival_StandThrough', .08, .99]] },
];
export function clubExhibition({ memory, profile, duration, bpm, r, heard, avoid }) {
  const beat = 60 / bpm, time = CLUB_PREVIEW_BEATS * beat, cuts = [0, 2, 6, CLUB_PREVIEW_BEATS];
  const pool = exhibitions.filter(show => show.id !== avoid && show.parts.every(([clip, at, span]) => duration(clip) >= at + span));
  if (!pool.length) {
    return { time, steps: [
      { c: 'Breakdance_Uprock', at: 0, b: 3 * beat, sp: 1 },
      { c: 'Breakdance_Uprock_To_Ground', at: 0, b: 5 * beat, sp: (duration('Breakdance_Uprock_To_Ground') - .035) / (2 * beat) },
      { c: 'Breakdance_Footwork_2', at: 0, b: time, sp: duration('Breakdance_Footwork_2') / (3 * beat) },
    ] };
  }
  const choice = variety(memory, 'exhibition', pool, r, 2, show =>
    (show.profiles.includes(profile) ? 3 : 1) * (heard && show.motif !== heard ? 1.6 : 1), show => show.id);
  const mirrored = r() < .5;
  return { time, form: choice.id, motif: choice.motif, standing: choice.standing, steps: choice.parts.map(([c, at, span], i) => ({
    c: side(c, mirrored), at, sp: span / ((cuts[i + 1] - cuts[i]) * beat), b: cuts[i + 1] * beat,
  })) };
}
