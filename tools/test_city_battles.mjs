import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Vector3, Quaternion } from '../vendor/three/three.module.js';
import { BATTLE_ANSWERS, battleReplyPoints, battleTechnique, battleStyle, breakingOpening,
  CLUB_PREVIEW_BEATS, clubExhibition, duelPlan, REPLY_PRECISION, setTimes, pickPower, pickHold } from '../city3d-breaking.js';

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
let turns = 0;
for (const district of districts) for (let seed = 1; seed <= 64; seed++) {
  const r = random(seed), memory = [{}, {}], lastForm = [null, null];
  let avoid;
  for (let round = 0; round < 6; round++) {
    const holder = Number(district === 'club' && round % 2 === 1);
    for (const i of [holder, 1 - holder]) {
      const lv = i === 0 ? 1 : round + 1, profile = styles[(i + round) % styles.length];
      const duel = duelPlan({ district, profile, memory: memory[i], r, duration: length, opening: i === holder, hero: i === 0 });
      const opening = breakingOpening({ memory: memory[i], r, lv, bpm: 110 + round * 5, duration: length, duel, call: duel.motif, avoid });
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
      }
      turns++;
    }
  }
}

for (const district of ['park','prom','club']) for (const call of ['stop','switch']) for (const leads of [false,true]) {
  const answer = battleTechnique(call, leads);
  const other = battleTechnique(answer, false);
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

let previews = 0;
for (const id of ['needle','echo','tape','pulse','pivot','mono','fader']) {
  const memory = {}, r = random(74);
  let last, lastForm;
  for (let i = 0; i < 32; i++) {
    const show = clubExhibition({ memory, profile: battleStyle(id), duration: length, r, bpm: 116, avoid: lastForm });
    const signature = show.steps.map(s => [s.c.replace(/_M$/, ''), s.at]).flat().join('/');
    assert.notEqual(signature, last);
    assert(show.steps.length >= 2 && ['stop','switch'].includes(show.motif));
    assert(Math.abs(show.steps.at(-1).b - CLUB_PREVIEW_BEATS * 60 / 116) < 1e-9);
    assert.equal(show.steps.length, 3);
    assert(show.steps[0].b > 0 && show.steps[0].b < show.steps[1].b);
    last = signature;
    lastForm = show.form;
    previews++;
  }
}

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
  let reachable = Infinity;
  // Bound the active-clock cost of a clean champion route using normal forms and a basic answer.
  // The verdict sequence below exercises the real queue and target. This isn't a simulation of the judges' votes.
  for (let seed = 1; seed <= 64; seed++) {
    const r = random(seed), memory = [{}, {}];
    let cost = 0;
    for (let round = 0; round < SMOKE_TARGET; round++) {
      const lv = Math.min(8, 5 + round), profile = styles[round % styles.length];
      let avoid;
      for (let i = 0; i < 2; i++) {
        const duel = duelPlan({ district:'club', profile, memory:memory[i], r, duration:length, hero:i===0, opening:i===0 });
        const opening = breakingOpening({ memory:memory[i], r, duration:length, bpm, lv, duel, call:duel.motif, avoid });
        const move = i===0 ? BATTLE_ANSWERS[0] : pickPower(memory[i], r, lv, length, profile);
        const hold = pickHold(memory[i], lv, r, opening.held, length);
        const repeats = i===0 || move.id==='backspin' ? 1 : Math.max(1, Math.round(2.85 / length(move.c)));
        cost += setTimes(opening.seq, 0, opening.enter) + 30 / bpm + 2.3 + length(move.c) * repeats + hold.len
          + (move.pre ? 1.6 : 0) + (move.post ? 1.4 : 0) + (move.id==='ninety' ? 1.3 : 0)
          + (i===0 ? 4 * 60 / bpm + 1.45 : 0);
        avoid = opening.shape;
      }
    }
    reachable = Math.min(reachable, cost);
  }
  assert(reachable < SMOKE_TIME, `${bpm} BPM: projected clean route ${reachable.toFixed(1)} s`);
  const state = { points:{me:0,a:0,b:0,c:0,d:0,e:0,f:0,g:0}, line:['me','a','b','c','d','e','f','g'] };
  for (let win = 0; win < SMOKE_TARGET; win++) scoreSmoke(state, 'me', false);
  assert.equal(state.champion,'me');
  assert.equal(state.points.me,SMOKE_TARGET);
  console.log(`${bpm} BPM: eight-beat halves, timed watch ≈ ${budget.toFixed(2)} s, clean seven-win route budget ≈ ${reachable.toFixed(1)} s.`);
}
console.log(`${turns} seeded turns across five districts, ${previews} watched Club phrases, both roles, accuracy and wrist contact.`);
