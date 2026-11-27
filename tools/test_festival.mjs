import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { EPISODES } from '../city3d-campaign-data.js';
import { createPhrase, displayNote, freshCampaign, pieceAt, postInput, phraseVerdict, recordDecision, recordPhrase, loadCampaign, TEMPOS } from '../city3d-campaign-engine.js';
import { examCourse, examPeriod, FESTIVAL_OFFICIAL, FESTIVAL_PRIZE, judgeFestivalExam } from '../city3d-festival-exams.js';

export function perfectPhrase(phrase, lastReply) {
  const accepted = [];
  for (let i = 0; i < phrase.length; i++) {
    const note = displayNote(phrase, i);
    if (note.kind === 'rest') continue;
    let family = 'move', value = note.note;
    if (note.kind === 'deck') family = 'deck';
    if (note.kind === 'reply') { family = 'choice'; value = [0,1,2,3].find(x => x !== note.rival && x !== lastReply); }
    if (note.kind === 'build') { family = 'choice'; value = note.desired; }
    if (note.kind === 'cast') { family = 'choice'; value = note.favored; }
    postInput(phrase, i, { family, value }, .31);
    accepted.push([i,value]);
  }
  return accepted;
}

export function perfectTrial(trial, seed, tempo) {
  const ms = examPeriod(trial, tempo);
  let last;
  return [...trial.modes].flatMap((_, phase) => {
    const phrase = createPhrase(examCourse(trial, seed, phase), 0, { lastReply:last });
    const taps = perfectPhrase(phrase,last);
    if (phrase.course.mode === 'r') last = phrase.selections[0];
    return taps.map(([beat,val]) => [Math.round((phase * 16 + beat) * ms), val]);
  });
}

function tests() {
  const course = pieceAt(0,0,{});
  const empty = createPhrase(course,0,{});
  assert.equal(phraseVerdict(empty,false).passed,false);
  const ideal = createPhrase(course,0,{});
  perfectPhrase(ideal);
  assert.equal(phraseVerdict(ideal,false).clean,1);
  assert.equal(phraseVerdict(ideal,false).passed,true);
  const rest = ideal.prompts.findIndex(note => note.kind === 'rest');
  assert.equal(postInput(ideal,rest,{ family:'move',value:0 },.35),'rest');
  assert.equal(phraseVerdict(ideal,false).clean,0);
  assert.equal(phraseVerdict(ideal,false).errors,1);
  let minutes;
  for (const branch of [['park','open','vint'],['prom','crew','relay']]) {
    let state=freshCampaign();
    minutes=0;
    for (const [episode, ep] of EPISODES.entries()) {
      if (ep.decision) {
        const ix = { venue:0, roster:1, sound:2 }[ep.decision];
        assert.equal(recordDecision(state,branch[ix]),true);
        assert.equal(recordDecision(state,branch[ix]),false);
      }
      for (let piece=0; piece<4; piece++) {
        const course=pieceAt(episode,piece,state.choices);
        minutes += course.beats / course.bpm;
        for (let beat=0; beat<course.beats;) {
          const phrase = createPhrase(course,beat,{ ...state.choices,lastReply: state.lastReply });
          perfectPhrase(phrase,state.lastReply);
          const verdict=phraseVerdict(phrase,false);
          assert.equal(verdict.passed,true,`${episode}/${piece}/${beat}`);
          const key={episode,piece,beat};
          beat+=phrase.length;
          assert.equal(recordPhrase(state, verdict, beat, key),true);
          assert.equal(recordPhrase(state, verdict, beat, key),false);
        }
        state=loadCampaign(JSON.parse(JSON.stringify(state)));
      }
    }
    assert.equal(state.results.length,60);
    assert.equal(minutes,720);
  }
  for (const trial of FESTIVAL_OFFICIAL) {
    assert.equal(judgeFestivalExam(trial,23,'normal',[]).passed,false);
    for (const tempo of Object.keys(TEMPOS)) {
      const proof=perfectTrial(trial,17,tempo);
      assert.equal(judgeFestivalExam(trial,17,tempo,proof).passed,true,trial.id+' '+tempo);
      const spam = proof.map(([ms])=>[ms,0]);
      assert.equal(judgeFestivalExam(trial,17,tempo,spam).passed,false);
    }
  }
  const ctx={window:{}};
  runInNewContext(readFileSync(new URL('../hero.js',import.meta.url),'utf8'),ctx);
  const H=ctx.window.HERO;
  assert.ok(FESTIVAL_PRIZE.every(id=>H.itemOf(id).rar===4));
  assert.deepEqual(FESTIVAL_PRIZE.map(id=>H.itemOf(id).slot),['kicks','laces']);
  assert.equal(H.gearChances(FESTIVAL_PRIZE).myth,0);
  for (const [look,sole,lace] of [[[],false,false],[[FESTIVAL_PRIZE[0]],true,false],[[FESTIVAL_PRIZE[1]],false,true],[FESTIVAL_PRIZE,true,true]]) {
    const worn = H.topDown(1, look);
    assert.equal(Boolean(worn.rgbSole), sole);
    assert.equal(Boolean(worn.rgbLace), lace);
    const svg=H.svg(1,{acc:look,wardrobe:true,uid:'test'});
    assert.equal(svg.includes('stroke="url(#h1testrgbSole)"'), sole);
    assert.equal(svg.includes('stroke="url(#h1testrgbLace)"'), lace);
  }
  console.log('Perfect phrases with rests, AFK, pause penalty, two full 720-minute paths, twelve skill checkpoints, exclusive color set passed.');
}
if (process.argv[1] && new URL('file://' + process.argv[1]).href === import.meta.url) tests();
