import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { ACTS, EPISODES, MODE_NAMES, VENUES } from '../city3d-campaign-data.js';
import { loadCampaign, recordPhrase, TEMPOS } from '../city3d-campaign-engine.js';
import { FESTIVAL_OFFICIAL, judgeFestivalExam } from '../city3d-festival-exams.js';
import { COMBOS, comboInput, playablePhrase, playableVerdict } from '../city3d-festival-combos.js';
import {
  ACT_ENDS, FESTIVAL_CAST, FESTIVAL_EPISODES, REVISED_TURNS, STORY_CHOICES, actAvailable, finalOrder,
  loadFestivalState, recordStoryDecision, storyCourse, storyDecision, storyVenue,
} from '../city3d-festival-story.js';
import { CHAPTERS, WATCH_TIME, advanceStory, loadStory } from '../city3d-story.js';
import { perfectPhrase, perfectTrial } from './test_festival.mjs';

const clone = value => JSON.parse(JSON.stringify(value));
const decisionTags = Object.entries(STORY_CHOICES).map(([id, rule]) => [id, rule.options.map(option => option.tag)]);
const variants = decisionTags.reduce(
  (selections, [id, options]) => selections.flatMap(selected => options.map(tag => ({ ...selected, [id]: tag }))),
  [{}],
);
const episodes = FESTIVAL_EPISODES.map((episode, i) => ({
  episode: i + 1,
  act: episode.act + 1,
  title: episode.title,
  speaker: FESTIVAL_CAST[episode.speaker],
  preparations: REVISED_TURNS[i]?.preparatory ? [REVISED_TURNS[i].preparatory] : [],
  decision: episode.decision || null,
  cueChoices: i === 44 ? ['lead', 'answer'] : [],
  routes: new Set(),
  active: [],
  reward: { campaignReceipt: true, advancesTo: FESTIVAL_EPISODES[i + 1]?.title ?? 'Судимые испытания' },
  snapshots: 0,
}));
const prologue = { story: [], en: 60, rep: 0 };
for (const chapter of CHAPTERS) {
  assert.equal(advanceStory(prologue, 'unknown', 300), null);
  assert.deepEqual(advanceStory(prologue, chapter.id, 300), { en: chapter.en, rep: chapter.rep });
  assert.deepEqual(loadStory(clone(prologue.story)), prologue.story);
}
assert.equal(advanceStory(prologue, 'finale', 300), null);

function play(phrase, alternate = 0) {
  if (!phrase.spec) {
    perfectPhrase(phrase, phrase.branch.lastReply);
  } else {
    if (phrase.alternate) comboInput(phrase, 0, alternate, 'down', 'style', false);
    for (const step of phrase.steps) {
      if (step.kind === 'style') continue;
      const edge = step.kind === 'release' ? 'up' : 'down';
      comboInput(phrase, step.at, step.pad, edge, 'pad:' + step.pad, false);
    }
  }
  return playableVerdict(phrase, false);
}

const checkpoints = new Map();
const paths = variants.flatMap(choices => ['lead', 'answer'].map(cueSheet => ({ choices, cueSheet })));
let phrases = 0;
const begin = performance.now();
for (const [index, { choices, cueSheet }] of paths.entries()) {
  let state = loadFestivalState();
  let minutes = 0;
  for (const [i, episode] of FESTIVAL_EPISODES.entries()) {
    const map = episodes[i];
    const prep = REVISED_TURNS[i]?.preparatory;
    if (prep) {
      assert.ok(VENUES[prep]);
      assert.ok(!state.prepared);
      state.prepared = true;
      state = loadFestivalState(clone(state));
      assert.ok(state.prepared);
    }
    const decision = storyDecision(state);
    if (decision) {
      assert.equal(recordStoryDecision(state, choices[decision]), true);
      assert.equal(recordStoryDecision(state, choices[decision]), false);
    }
    if (i === 44) state.cueSheet = cueSheet;
    const route = storyVenue(i, state.choices);
    assert.ok(route && route.length === 4);
    map.routes.add(route.slice(0, 2).join(':'));
    assert.equal(actAvailable(state, episode.act), false);
    let clean = 0, variations = 0;
    for (let piece = 0; piece < 4; piece++) {
      const course = storyCourse(i, piece, state);
      let pieceMap = map.active[piece];
      if (!pieceMap) pieceMap = map.active[piece] = {
        piece: piece + 1, mode: MODE_NAMES[course.mode], bpms: new Set(), combos: new Set(), phrases: new Set(),
      };
      pieceMap.bpms.add(course.bpm);
      if (course.combo) pieceMap.combos.add(course.combo);
      pieceMap.phrases.add(Math.ceil(course.beats / 16));
      minutes += course.beats / course.bpm;
      for (let beat = 0; beat < course.beats;) {
        const phrase = playablePhrase(course, beat, { ...state.choices, lastReply: state.lastReply });
        assert.equal(playableVerdict(phrase, false).passed, false);
        const verdict = play(phrase, index % 2);
        const key = { episode: i, piece, beat };
        assert.ok(verdict.passed, [index, i, piece, beat, phrase.spec?.name].join('/'));
        assert.equal(recordPhrase(state, { ...verdict, passed: false }, beat + phrase.length, key), false);
        beat += phrase.length;
        assert.equal(recordPhrase(state, verdict, beat, key), true);
        assert.equal(recordPhrase(state, verdict, beat, key), false);
        clean += verdict.clean;
        variations += verdict.variation;
        phrases++;
      }
      const restored = loadFestivalState(clone(state));
      assert.equal(restored.episode, state.episode);
      assert.equal(restored.piece, state.piece);
      assert.equal(restored.beat, state.beat);
      assert.deepEqual(restored.results, state.results);
      assert.deepEqual(restored.choices, state.choices);
      if (restored.episode === 44) assert.equal(restored.cueSheet, state.cueSheet);
      state = restored;
      map.snapshots++;
    }
    assert.equal(state.episode, i + 1);
    assert.deepEqual(state.results[i], { clean, variation: variations });
    assert.equal(actAvailable(state, episode.act), i + 1 >= ACT_ENDS[episode.act]);
    if (index === 0 && [1, 30, 59, 60].includes(i + 1)) checkpoints.set(i + 1, clone(state));
  }
  assert.equal(state.results.length, 60);
  assert.equal(state.piece, 0);
  assert.equal(state.beat, 0);
  assert.equal(minutes, 720);
  assert.deepEqual(state.choices, choices);
  assert.equal(finalOrder(state.choices).length, 2);
}
const campaignMs = performance.now() - begin;
const exams = FESTIVAL_OFFICIAL.map(spec => {
  const tempos = Object.keys(TEMPOS).map(tempo => {
    const proof = perfectTrial(spec, 17, tempo);
    const outcome = judgeFestivalExam(spec, 17, tempo, proof);
    assert.ok(outcome.passed, spec.id + ' ' + tempo);
    assert.equal(judgeFestivalExam(spec, 17, tempo, []).passed, false);
    assert.equal(judgeFestivalExam(spec, 17, tempo, [...proof, proof[0]]), null);
    return { tempo, inputs: proof.length, precision: outcome.precision, clean: outcome.clean, variety: outcome.variety, votes: outcome.votes };
  });
  return { id: spec.id, title: spec.name, modes: spec.modes, tempos };
});

function measure(fn, group = 200, samples = 80) {
  const durations = [];
  for (let i = -10; i < samples; i++) {
    const t0 = performance.now();
    for (let j = 0; j < group; j++) fn();
    if (i >= 0) durations.push((performance.now() - t0) / group);
  }
  durations.sort((a, b) => a - b);
  return { unit: 'ms/op', p50: durations[40], p95: durations[75], p99: durations[79] };
}
const state = loadFestivalState({ ...checkpoints.get(59), piece: 1, beat: 16, clean: 0, variation: 0 });
const course = storyCourse(59, 1, state);
const phrase = playablePhrase(course, 16, state.choices);
play(phrase);
const proof = perfectTrial(FESTIVAL_OFFICIAL.at(-1), 17, 'normal');
const benchmarks = {
  storyCourse: measure(() => storyCourse(59, 1, state)),
  playablePhrase: measure(() => playablePhrase(course, 16, state.choices)),
  playableVerdict: measure(() => playableVerdict(phrase, false)),
  normalizations: [...checkpoints].map(([history, snapshot]) => ({
    history,
    bytes: Buffer.byteLength(JSON.stringify(snapshot)),
    loadCampaign: measure(() => loadCampaign({ ...snapshot, v: 1 })),
    loadFestivalState: measure(() => loadFestivalState(snapshot)),
    parseNormalize: measure(() => loadFestivalState(clone(snapshot))),
    serialize: measure(() => JSON.stringify(snapshot)),
  })),
  finalExam: measure(() => judgeFestivalExam(FESTIVAL_OFFICIAL.at(-1), 17, 'normal', proof)),
};

const report = {
  coverage: 'pure modules; ideal inputs, all branches, offline',
  sourceTotals: {
    episodes: FESTIVAL_EPISODES.length, baseEpisodes: EPISODES.length, acts: ACTS.length, actEnds: ACT_ENDS,
    pieces: episodes.reduce((sum, episode) => sum + episode.active.length, 0),
    venues: Object.keys(VENUES), combinationTypes: Object.keys(COMBOS), decisions: decisionTags,
    preparatoryEpisodes: episodes.filter(episode => episode.preparations.length).length,
    choices: variants.length, paths: paths.length, phrases, officialExams: exams.length, minutesPerBranch: 720,
  },
  prologue: CHAPTERS.map((chapter, i) => ({ id: chapter.id, title: chapter.title, district: chapter.district,
    watchSeconds: chapter.id === 'cypher' ? WATCH_TIME : undefined, reward: prologue.story[i], coverage: 'pure save and ordered rewards' })),
  episodes,
  exams,
  benchmarks,
  campaignMs,
};
const json = JSON.stringify(report, (_, value) => value instanceof Set ? [...value] : value, 2) + '\n';
if (process.argv[2]) {
  writeFileSync(process.argv[2], json);
  console.log(JSON.stringify({ ...report.sourceTotals, campaignMs, benchmarks }, null, 2));
} else {
  process.stdout.write(json);
}
