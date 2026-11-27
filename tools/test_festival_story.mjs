import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { EPISODES, venueFor } from '../city3d-campaign-data.js';
import { pieceAt, recordPhrase } from '../city3d-campaign-engine.js';
import { ACT_ENDS, FESTIVAL_CAST, FESTIVAL_EPISODES, REVISED_TURNS, STORY_CHOICES, actAvailable,
  finalOrder, legacyMeeting, loadFestivalState, recordStoryDecision, storyCourse, storyDecision,
  storyLine, storyVenue, waitingDancer } from '../city3d-festival-story.js';
import { COMBOS, REPLY_LINES, STYLE_NAMES, comboEvents, comboInput, playablePhrase, playableVerdict } from '../city3d-festival-combos.js';
import { perfectPhrase } from './test_festival.mjs';

const prefix = n => Array.from({ length: n }, (_, i) => ({ clean: i * 5 + 1, variation: i * 2 + 3 }));
const roundTrip = data => loadFestivalState(JSON.parse(JSON.stringify(data)));
const releaseToken = event => 'pad:' + event.pad;
function perform(phrase, variant, slow = false, bad) {
  if (!phrase.spec) { perfectPhrase(phrase, phrase.branch.lastReply); return playableVerdict(phrase, slow); }
  if (phrase.alternate) comboInput(phrase, 0, variant, 'down', 'style', slow);
  for (const step of phrase.steps) {
    if (step.kind === 'style' || step === bad?.skip) continue;
    comboInput(phrase, step.at, step.pad, step.kind === 'release' ? 'up' : 'down',
      step === bad?.foreign ? 'wrong finger' : releaseToken(step), slow);
  }
  return playableVerdict(phrase, slow);
}

assert.deepEqual(ACT_ENDS.map((end,i) => end - (ACT_ENDS[i-1] || 0)), [6,7,7,8,10,10,11,1]);
assert.equal(FESTIVAL_EPISODES.slice(59).length, 1);

const legacyChoices = { venue:'prom', roster:'crew', sound:'relay' };
const oldEnds = [6,13,20,28,36,44,53,60];
let migrated = 0;
for (let episode=0; episode<=60; episode++) {
  const results = prefix(episode);
  const cases = episode >= 60 ? [{ piece: 0, beat: 0 }] : Array.from({ length: 4 }, (_, piece) => {
    const n = pieceAt(episode, piece, legacyChoices).beats;
    return [0,16,Math.floor((n-1)/16)*16].map(beat => ({ piece, beat }));
  }).flat();
  for (const location of cases) {
    const v1 = { v:1, episode, ...location, choices:legacyChoices, results, clean:4, variation:3, lastReply:2, prepared:true, tempo:'quick' };
    const v2 = roundTrip(v1);
    assert.equal(v2.episode,episode);
    assert.equal(v2.piece,location.piece);
    assert.equal(v2.beat,location.beat);
    assert.equal(v2.tempo,'quick');
    assert.deepEqual(v2.results,results);
    assert.deepEqual(v2.choices,legacyChoices);
    for (const [act, end] of oldEnds.entries()) if (episode >= end) assert.ok(actAvailable(v2,act));
    if (location.piece || location.beat) {
      assert.ok(legacyMeeting(v2));
      assert.deepEqual(storyCourse(episode,location.piece,v2),pieceAt(episode,location.piece,legacyChoices));
      assert.deepEqual(storyVenue(episode,v2.choices,true),venueFor(EPISODES[episode],legacyChoices));
      assert.equal(v2.clean,4);
      assert.equal(v2.variation,3);
    }
    assert.deepEqual(roundTrip(v2),v2);
    migrated++;
  }
}

let completed = 0;
for (const [ix, choices] of [
  { ...legacyChoices, slot:'stitch', access:'trace', format:'relay' },
  { venue:'park', roster:'open', sound:'vint', slot:'granite', access:'metro', format:'split' },
].entries()) {
  let state = loadFestivalState();
  let minutes = 0;
  for (const episode of FESTIVAL_EPISODES.keys()) {
    const decision = storyDecision(state);
    if (decision) {
      assert.ok(recordStoryDecision(state,choices[decision]));
      assert.equal(recordStoryDecision(state,choices[decision]),false);
      if (decision === 'slot') assert.equal(minutes,0);
    }
    for (let piece=0; piece<4; piece++) {
      const course = storyCourse(episode,piece,state);
      const previous = pieceAt(episode,piece,state.choices);
      assert.equal(course.bpm,previous.bpm);
      assert.equal(course.beats,previous.beats);
      assert.ok(course.act>=previous.act);
      minutes += course.beats/course.bpm;
      for (let beat=0; beat<course.beats;) {
        const phrase = playablePhrase(course,beat,{...state.choices,lastReply:state.lastReply});
        const verdict = perform(phrase,ix);
        assert.ok(verdict.passed,`${ix}/${episode}/${piece}/${beat} ${phrase.spec?.name}`);
        const key = {episode,piece,beat};
        beat += phrase.length;
        assert.ok(recordPhrase(state,verdict,beat,key));
        assert.equal(recordPhrase(state,verdict,beat,key),false);
        completed++;
      }
      state = roundTrip(state);
    }
  }
  assert.equal(minutes,720);
  assert.equal(state.results.length,60);
  assert.equal(storyDecision(state),undefined);
}

const state = { choices: { slot:'stitch', access:'trace', format:'relay' } };
assert.equal(waitingDancer(state.choices),'granite');
assert.equal(storyVerse(0,'stitch').combo,'openingStitch');
assert.equal(storyVerse(0,'granite').combo,'openingGranite');
function storyVerse(episode, slot) { return storyCourse(episode,0,{ choices:{ ...state.choices, slot } }); }
assert.notDeepEqual(comboEvents(playablePhrase(storyVerse(0,'stitch'),0,{})),comboEvents(playablePhrase(storyVerse(0,'granite'),0,{})));
assert.equal(storyVerse(14,'stitch').combo,'granite');
assert.equal(storyVerse(14,'granite').combo,'stitch');
assert.notEqual(storyLine(14,{slot:'stitch'}),storyLine(14,{slot:'granite'}));
assert.equal(storyVenue(44,{access:'trace',slot:'stitch'})[0],'prom');
assert.equal(storyVenue(44,{access:'trace',slot:'granite'})[0],'park');
assert.equal(storyVenue(44,{access:'metro',slot:'stitch'})[0],'center');
assert.equal(storyCourse(44,0,{...state,cueSheet:'lead'}).combo,'switch');
assert.equal(storyCourse(44,0,{...state,cueSheet:'answer'}).combo,'afterbreak');
assert.equal(storyCourse(50,0,state).combo,'handoff');
assert.equal(storyCourse(50,0,{choices:{format:'split'}}).combo,'rematch');
assert.deepEqual(finalOrder({format:'relay'}),['stitch','granite']);
assert.deepEqual(finalOrder({format:'split'}),['granite','stitch']);

const rivalCourse = storyCourse(51,0,state);
const fresh = () => playablePhrase(rivalCourse,0,{});
assert.equal(playableVerdict(fresh(),false).passed,false);
const a=fresh(), b=fresh();
assert.ok(perform(a,0).clean && perform(b,1).clean);
assert.deepEqual(a.steps.map(s=>[s.at,s.kind,s.essential]),b.steps.map(s=>[s.at,s.kind,s.essential]));
assert.notDeepEqual(a.steps,b.steps);
const under = fresh();
comboInput(under,0,0,'down','style',false);
const release = under.steps.find(e=>e.kind==='release'), hit = under.steps.find(e=>e.kind==='tap'&&e.essential);
assert.equal(perform(under,0,false,{skip:release}).passed,false);
const foreign = fresh(); comboInput(foreign,0,0,'down','style',false);
assert.equal(perform(foreign,0,false,{foreign:foreign.steps.find(e=>e.kind==='release')}).passed,false);
const mixed = fresh();
comboInput(mixed,0,0,'down','style',false);
comboInput(mixed,hit.at,(hit.pad+1)%4,'down','wrong',false);
assert.equal(perform(mixed,0).passed,false);
const spam = fresh();
comboInput(spam,0,0,'down','style',false);
const moves = [...spam.steps];
for (const step of moves) for (const pad of [step.pad??0,0,1,2,3]) {
  comboInput(spam,step.at,pad,'down','spam',false);
  comboInput(spam,step.at,pad,'up','spam',false);
}
assert.equal(playableVerdict(spam,false).passed,false);
assert.ok(new Set([0,64,128,192,256].map(beat=>playablePhrase(rivalCourse,beat,{}).spec?.name)).size>=3);

const asset = name => readFileSync(new URL('../'+name,import.meta.url),'utf8');
const scope={window:{}};
runInNewContext(asset('city3d-i18n.js'),scope);
const keys=[
  ...Object.values(FESTIVAL_CAST),...FESTIVAL_EPISODES.map(ep=>ep.title),
  ...Object.values(STORY_CHOICES).flatMap(rule=>[rule.question,...rule.options.flatMap(op=>[op.label,op.consequence])]),
  ...Object.values(REVISED_TURNS).flatMap(turn=>[turn.before,turn.after]),
  ...Object.values(COMBOS).flatMap(spec=>[spec.name,spec.guide]),...REPLY_LINES,...STYLE_NAMES,
];
for (const [ep, name, tags] of [[0,'slot',['stitch','granite']],[14,'slot',['stitch','granite']],
  [44,'access',['trace','metro']],[50,'format',['relay','split']]]) {
  keys.push(...tags.map(tag=>storyLine(ep,{[name]:tag})));
}
for (const m of asset('city3d-campaign.js').matchAll(/\bt\('([А-Яа-яЁё][^'\n]*)'/g)) keys.push(m[1]);
for (const [language, dict] of Object.entries(scope.window.I18N3)) for (const key of keys) assert.ok(dict[key],language+' '+key);
console.log(`${migrated} legacy checkpoints, ${completed} mastered phrases, 2×720 min, early/late branch effects, equivalent styles, same-control release, AFK/spam rejection, 9 locales.`);
