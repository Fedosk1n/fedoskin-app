import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Vector3, Quaternion } from '../vendor/three/three.module.js';
import { BATTLE_ANSWERS, battleFootMoves, battleReplyPoints, battleTechnique, battleStyle, breakingOpening, clubCall,
  CLUB_PREVIEW_BEATS, clubExhibition, cypherSet, duelPlan, REPLY_PRECISION, setTimes, pickPower, pickHold,
  samplePhrase, spinTick, threadCatch, WHEEL_FOOTWORK } from '../city3d-breaking.js';

const load = file => JSON.parse(readFileSync(new URL('../anim/' + file, import.meta.url)));
const { rest, clips: source } = load('bboy.json');
const original = load('city-breaking.json');
const clips = { ...source, ...original };
function length(name) {
  const c = clips[name?.replace(/_M$/, '')];
  return c ? (c.n - 1) / c.fps : 0;
}
function random(seed) {
  return () => ((seed = Math.imul(seed, 1664525) + 1013904223 | 0) >>> 0) / 4294967296;
}

const styles = ['groove','ground','shapes','power'];
const districts = ['yard','center','park','prom','club'];
const retired = /City_Battle_(Check|Stop)/;
const baseClip = c => c?.replace(/_M$/, '');
const circle = 'City_Foot_Circle', thread = 'City_Foot_ThreadRise', catchClip = 'City_Foot_ThreadCatch';
const rear = 'City_Foot_RearStep', front = 'City_Foot_KickThrough';
assert(!Object.keys(original).some(clip => retired.test(clip)));
let turns = 0;
for (const district of districts) for (let seed = 1; seed <= 64; seed++) {
  const r = random(seed), memory = [{}, {}], lastForm = [null, null];
  let avoid;
  for (let round = 0; round < 6; round++) {
    const holder = Number(district === 'club' && round % 2 === 1);
    for (const i of [holder, 1 - holder]) {
      const lv = i === 0 ? 1 : round + 1, profile = styles[(i + round) % styles.length];
      const duel = duelPlan({ district, profile, memory: memory[i], r, duration: length, opening: i === holder, hero: i === 0 });
      const opening = breakingOpening({ memory: memory[i], r, bpm: 110 + round * 5, duration: length,
        duel, call: duel.motif, avoid, technical: i !== 0 && lv >= 5 });
      assert.notEqual(opening.shape, lastForm[i], `${district} immediate same dancer form`);
      assert.notEqual(opening.shape, avoid, `${district} immediate copy across the floor`);
      lastForm[i] = avoid = opening.shape;
      assert(opening.enter >= 1.25);
      assert.notEqual(opening.seq.length, 0);
      assert.equal(opening.seq.filter(s => s.kind === 'top').length, 1);
      assert.equal(opening.seq.filter(s => s.kind === 'foot').length, 1);
      assert.equal(opening.seq.filter(s => s.kind === 'motif').length, Number(Boolean(duel.motif)));
      if (i === 0) assert.match(duel.post, /City_Battle_(Square|Settle)/);
      const end = setTimes(opening.seq, 0, opening.enter);
      assert(Number.isFinite(end) && end > opening.enter);
      for (const [k, s] of opening.seq.entries()) {
        assert(length(s.c) && Number.isFinite(s.a) && s.b > s.a && (k === 0 || s.a === opening.seq[k - 1].b));
        assert(!retired.test(s.c) && !['hold','freeze'].includes(s.kind));
        assert(s.at + s.len * s.sp <= length(s.c) + .005, `${s.c} would hold its last frame`);
      }
      turns++;
    }
  }
}
const technicalForm = options => breakingOpening({ memory:{}, r:random(333), duration:length, force:'clubLift', ...options }).seq;
assert(!technicalForm({}).some(s => s.kind === 'technical'));
const technical = technicalForm({ technical:true });
const freezeIndex = technical.findIndex(s => s.kind === 'technical');
assert.equal(technical[freezeIndex].c.replace(/_M$/, ''), 'Breakdance_Freeze_Var_2');
assert.equal(technical[freezeIndex + 1].kind, 'down');
assert(!technical[freezeIndex].pts && !technical[freezeIndex].fail && !technical[freezeIndex].balance);

for (let seed = 1; seed <= 128; seed++) {
  const whole = cypherSet({ memory:{}, r:random(seed), lv:6, duration:length, bpm:104, profile:styles[seed % styles.length] });
  assert(!whole.list.slice(0,-1).some(s => ['hold','freeze'].includes(s.kind) || retired.test(s.c)));
  assert.equal(whole.list.at(-1).kind, 'freeze');
  for (const s of whole.list.filter(s => s.sp || ['pre','post'].includes(s.kind))) {
    assert(s.at + s.len * (s.sp || 1) <= length(s.c) + .005, `${s.c} would hold in the middle of the cypher`);
  }
}

for (const district of districts) {
  const available = battleFootMoves(district,length);
  assert.equal(available.length, ['prom','club'].includes(district) ? 3 : 2);
}
for (const district of ['park','prom','club']) for (const {motif:call} of battleFootMoves(district,length)) for (const leads of [false,true]) {
  const answer = battleTechnique(call, leads, district !== 'park');
  const other = battleTechnique(answer, false, district !== 'park');
  assert(BATTLE_ANSWERS.some(move => move.motif === answer && move.lv === 1 && length(move.c)));
  const state = { district, call, leads, answer, eligible: true, clean: true, precision: 1, previous: other };
  assert.equal(battleReplyPoints(state), .5);
  assert.equal(battleReplyPoints({...state, answer: other}), 0);
  assert.equal(battleReplyPoints({...state, eligible: false}), 0);
  assert.equal(battleReplyPoints({...state, clean: false}), 0);
  assert.equal(battleReplyPoints({...state, call: null}), 0);
  if (REPLY_PRECISION[district]) assert.equal(battleReplyPoints({...state, precision: REPLY_PRECISION[district] - .0001}), 0);
  assert.equal(battleReplyPoints({...state, precision: REPLY_PRECISION[district]}), .5);
  if (district === 'club' && !leads) {
    assert.equal(battleReplyPoints({...state, previous: answer}), 0);
    assert.notEqual(battleTechnique(answer, false), answer);
  }
}
const clubMoves = battleFootMoves('club',length);
for (const plan of clubMoves) for (const previous of clubMoves) for (const seed of [1,200]) {
  const call = clubCall(plan.motif,previous.motif,clubMoves,random(seed));
  assert.notEqual(battleTechnique(call,false,true), previous.motif);
}
for (const [shape, clip] of [['returnCircle',circle], ['threadAscent',thread]]) {
  for (const call of [null,...clubMoves.map(move => move.motif)]) for (const response of [undefined,...clubMoves]) {
    const { seq } = breakingOpening({ memory:{}, r:random(71), duration:length, force:shape, duel:{district:'club'}, call, response });
    assert.equal(seq.filter(s => baseClip(s.c) === clip).length,1,`${shape} must play its core form for ${call}/${response?.motif}`);
    assert.equal(seq.filter(s => s.answer).length,Number(Boolean(response)));
    if (response) assert(seq.some(s => s.answer === response.motif));
    for (let i = 1; i < seq.length; i++) assert.notEqual(baseClip(seq[i].c),baseClip(seq[i-1].c));
  }
}

let previews = 0;
const previewsByForm = {};
for (const id of ['needle','echo','tape','pulse','pivot','mono','fader']) {
  const memory = {}, r = random(74);
  let last, lastForm;
  for (let i = 0; i < 32; i++) {
    const show = clubExhibition({ memory, profile: battleStyle(id), duration: length, r, bpm: 116, avoid: lastForm });
    const signature = show.steps.map(s => [s.c.replace(/_M$/, ''), s.at]).flat().join('/');
    assert.notEqual(signature, last);
    assert(show.steps.length >= 2 && ['arc','switch','thread'].includes(show.motif));
    assert(Math.abs(show.steps.at(-1).b - CLUB_PREVIEW_BEATS * 60 / 116) < 1e-9);
    assert.equal(show.steps.length, 3);
    assert(show.steps[0].b > 0 && show.steps[0].b < show.steps[1].b);
    let from = 0;
    for (const stage of show.steps) {
      assert(!retired.test(stage.c) && stage.at + (stage.b - from) * stage.sp <= length(stage.c) + 1e-7);
      from = stage.b;
    }
    last = signature;
    lastForm = show.form;
    previewsByForm[show.form] = (previewsByForm[show.form] || 0) + 1;
    previews++;
  }
}
assert(previewsByForm.circleReturn >= 10 && previewsByForm.frontThread >= 10,'the complete new phrases ship in watched rounds');
const fallback = clubExhibition({ memory:{}, duration:clip => source[clip] ? length(clip) : 0, bpm:122, r:random(5) });
assert.deepEqual(fallback.steps.map(s => s.c), ['Breakdance_Uprock','Breakdance_Uprock_To_Ground','Breakdance_Footwork_2']);
assert.equal(fallback.steps.at(-1).b, CLUB_PREVIEW_BEATS * 60 / 122);

function jointPositions(clip, fraction) {
  const { n, t } = clips[clip], i = Math.round(fraction * (n - 1)), world = {};
  for (const [joint, { pos, p }] of Object.entries(rest)) {
    const q = new Quaternion().fromArray(t[joint+'.q'].slice(i * 4, i * 4 + 4).map(v => v / 1000)).normalize();
    const parent = world[p];
    world[joint] = parent ? { q: parent.q.clone().multiply(q), xyz: new Vector3(...pos).applyQuaternion(parent.q).add(parent.xyz) }
      : { q, xyz: new Vector3(...t['Hips.p'].slice(i * 3, i * 3 + 3).map(v => v / 100)) };
  }
  return Object.fromEntries(Object.entries(world).map(([joint, { xyz }]) => [joint, xyz]));
}
for (const [fraction, side, opposite] of [[.18,'Left','Right'],[.62,'Right','Left']]) {
  const p = jointPositions('City_Battle_Support',fraction);
  assert(p[side+'Hand'].y <= .083 && p[opposite+'Hand'].y > .37);
  assert(Math.abs(p.Hips.x - p[side+'Hand'].x) > .31);
  assert(Math.abs(p.Head.x - p.Hips.x) > .30, 'visible weight shift');
}
const arc = 'City_Battle_LegArc';
const arcStart = jointPositions(arc,.14), arcFront = jointPositions(arc,.28), arcSide = jointPositions(arc,.60);
assert(arcFront.LeftFoot.z > .57 && arcSide.LeftFoot.x > .5 && arcSide.LeftFoot.z < .22);
assert(arcStart.LeftFoot.distanceTo(arcFront.LeftFoot) > .30 && arcFront.LeftFoot.distanceTo(arcSide.LeftFoot) > .50);
for (const phase of [.14,.28,.44,.60]) {
  const p = jointPositions(arc,phase);
  assert(p.RightHand.y < .08 && p.RightHand.distanceTo(arcStart.RightHand) < .025 && p.LeftHand.y > .28);
}
assert(jointPositions(arc,.89).RightFoot.distanceTo(arcSide.RightFoot) > .14, 'other foot picks up the next step');
assert(jointPositions(arc,.60).Head.distanceTo(arcFront.Head) > .12, 'torso follows the leg arc');
assert(jointPositions('Breakdance_Freeze_Var_2',2.5 / length('Breakdance_Freeze_Var_2')).LeftFoot.y > 1.4);
assert(jointPositions('Breakdance_Freeze_Var_2',3.63 / length('Breakdance_Freeze_Var_2')).RightFoot.y < .23);
const joints = ['Hips','LeftFoot','RightFoot','LeftHand','RightHand'];
for (const name of [arc, WHEEL_FOOTWORK, 'City_Flex_Reach','City_Backspin', circle, thread, catchClip, rear, front]) {
  const frames = original[name].n - 1;
  for (let i = 0; i <= frames - 4; i++) {
    const start = jointPositions(name,i / frames), end = jointPositions(name,(i + 4) / frames);
    assert(Math.max(...joints.map(j => start[j].distanceTo(end[j]))) > .016, `${name} stalls at frame ${i}`);
  }
}
for (const [name, side, from, to] of [[circle,'Right',.12,.29], [circle,'Right',.42,.65],
  [circle,'Left',.39,.85], [rear,'Left',.24,.70], [rear,'Right',.24,.63], [thread,'Left',.13,.40]]) {
  const hand = side + 'Hand', plant = jointPositions(name,from)[hand];
  for (let phase = from; phase <= to; phase += .025) {
    const p = jointPositions(name,phase)[hand];
    assert(p.y >= .051 && p.y <= .082 && p.distanceTo(plant) < .028, `${name} ${hand} slips at ${phase}`);
  }
}
const back = jointPositions(circle,.51), reversal = jointPositions(circle,.61), cross = jointPositions(circle,.84);
assert(reversal.RightFoot.z < back.RightFoot.z - .03 && cross.RightFoot.z > reversal.RightFoot.z + .6);
assert(back.Head.x - back.Hips.x > .29 && cross.Head.x - cross.Hips.x > .25);
assert(back.Head.z - back.Hips.z > .36 && cross.Head.z - cross.Hips.z < -.08, 'the pelvis and torso turn out of the rear phase');
const open = jointPositions(thread,.13), through = jointPositions(thread,.43), rising = jointPositions(thread,.70);
assert(open.RightFoot.x < open.Hips.x && through.RightFoot.x > through.Hips.x && through.RightFoot.z > through.LeftFoot.z + .35);
assert(through.Hips.y < .35 && rising.Hips.y > .64 && rising.RightFoot.distanceTo(through.RightFoot) < .028);
assert(joints.every(j => jointPositions(thread,1)[j].distanceTo(jointPositions(catchClip,0)[j]) < .003));
assert.equal(threadCatch(length,122,false).c,catchClip);
const first = jointPositions(WHEEL_FOOTWORK,0), last = jointPositions(WHEEL_FOOTWORK,1);
assert(joints.every(j => first[j].distanceTo(last[j]) < .004), 'waiting footwork closes its joint and root seam');
const late = { cur:arc };
spinTick(late, [{ c:arc, a:2, b:3.5, at:.02, sp:.96 }], 3.25);
assert.equal(late.phraseTime, 1.22, 'a slow frame samples the actual place in the arc');
samplePhrase(late, { c:'City_Battle_Support', at:0, sp:1 }, .4);
assert.equal(late.phraseTime, 1.22, 'a previous motion cannot seek the current clip');
const raised = jointPositions('City_Battle_Lift',.55);
assert(raised.LeftHand.y > raised.Head.y, 'the hand visibly rises above the head');
for (const name of ['City_Battle_Square','City_Battle_Settle']) {
  const close = jointPositions(name,1);
  assert(close.LeftHand.y < close.Spine2.y && close.RightHand.y < close.Spine2.y);
}
globalThis.window = { _t: key => key };
const { exhibitionClock, scoreSmoke, SMOKE_TIME, SMOKE_TARGET } = await import('../city3d-smoke.js');
for (const bpm of [122, 134]) {
  const show = { bpm, time: CLUB_PREVIEW_BEATS * 60 / bpm };
  const budget = exhibitionClock(show, null).time;
  for (let sample = 0; sample < 80; sample++) {
    const beat = 20 + sample / 80, clock = exhibitionClock(show, beat);
    assert.equal(clock.time, budget);
    assert(Math.abs((clock.danceEnd - clock.approach) * bpm / 60 - CLUB_PREVIEW_BEATS) < 1e-8);
    for (const offset of [0, clock.half]) {
      const entryBeat = (clock.approach + offset) * bpm / 60 + beat;
      assert(Math.abs(entryBeat * 2 - Math.round(entryBeat * 2)) < .0002);
    }
    assert(clock.half - clock.danceEnd > 1.1);
  }
  const costs = [];
  const queueProfiles = ['ground','groove','shapes','power','groove','ground','shapes'];
  const levels = [5,6,6,7,7,8,8];
  // Price a clean seven-win route with the normal order, three techniques and their actual joins.
  // Source timings use the scheduled clips; judging and the result of each duel are checked separately.
  for (let seed = 1; seed <= 1200; seed++) {
    const r = random(seed), hero = {};
    let cost = 0, lastReply;
    for (let round = 0; round < SMOKE_TARGET; round++) {
      const district = 'club', holder = round > 0, opponent = {}, profile = queueProfiles[round], lv = levels[round];
      const theirs = duelPlan({ district, profile, memory:opponent, r, duration:length, opening:!holder });
      const ours = duelPlan({ district, profile:'groove', memory:hero, r, duration:length, hero:true, opening:holder });
      const call = clubCall((holder ? ours : theirs).motif, holder ? undefined : lastReply, clubMoves, r);
      if (!holder) lastReply = battleTechnique(call,false,true);
      let avoid;
      for (const isHero of [holder,!holder]) {
        const duel = isHero ? ours : theirs, memory = isHero ? hero : opponent;
        const leads = isHero === holder, wanted = battleTechnique(call,leads,true);
        const responseMove = clubMoves.find(move => move.motif === wanted);
        let response;
        if (!isHero) {
          const other = clubMoves.filter(move => move.motif !== wanted);
          response = r() < .72 ? responseMove : other[Math.floor(r() * other.length)];
          r(); // opponent's independent freeze-precision sample
        }
        const opening = breakingOpening({ memory, r, duration:length, bpm, duel, call:leads ? call : null,
          response, technical:!isHero, avoid });
        avoid = opening.shape;
        const move = isHero ? responseMove : pickPower(memory,r,lv,length,profile);
        const hold = pickHold(memory,isHero ? 8 : lv,r,length);
        const repeats = isHero || move.id === 'backspin' ? 1 : Math.max(1,Math.round(2.85 / length(move.c)));
        cost += setTimes(opening.seq,0,opening.enter) + 30 / bpm + 2.3 + length(move.c) * repeats + hold.len
          + (move.pre ? 1.6 : 0) + (move.post ? 1.4 : 0) + (move.id === 'ninety' ? 1.3 : 0)
          + (move.motif === 'thread' ? threadCatch(length,bpm,false).len : 0)
          + (isHero ? 4 * 60 / bpm + 30 / bpm : 0);
      }
      cost += 1.45;
    }
    costs.push(cost);
  }
  costs.sort((a,b) => a-b);
  const withinBudget = costs.filter(cost => cost < SMOKE_TIME).length;
  assert(withinBudget >= costs.length / 2, `${bpm} BPM: only ${withinBudget}/${costs.length} clean routes could finish on time`);
  const state = { points:{me:0,a:0,b:0,c:0,d:0,e:0,f:0,g:0}, line:['me','a','b','c','d','e','f','g'] };
  for (let win = 0; win < SMOKE_TARGET; win++) scoreSmoke(state, 'me', false);
  assert.equal(state.champion,'me');
  assert.equal(state.points.me,SMOKE_TARGET);
  console.log(`${bpm} BPM: eight-beat halves, timed watch ≈ ${budget.toFixed(2)} s, ${withinBudget}/${costs.length} clean routes within 4:00, median ${costs[costs.length / 2].toFixed(2)} s.`);
}
console.log(`${turns} seeded turns across five districts, ${previews} watched Club phrases, 128 ambient cyphers, both roles, continuous links, technical freeze and a seamless wheel.`);
