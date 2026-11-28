import { initFestival } from '../city3d-campaign.js';
import { MODE_NAMES, VENUES } from '../city3d-campaign-data.js';
import { createPhrase, displayNote, pieceAt, postInput, TEMPOS } from '../city3d-campaign-engine.js';
import { examCourse, FESTIVAL_OFFICIAL } from '../city3d-festival-exams.js';
import { comboInput, playablePhrase } from '../city3d-festival-combos.js';
import {
  FESTIVAL_EPISODES, loadFestivalState, REVISED_TURNS, storyCourse, storyDecision,
  storyVenue,
} from '../city3d-festival-story.js';

const $ = selector => document.querySelector(selector);
const click = selector => {
  const button = $(selector);
  if (!button || button.disabled) throw Error('Unavailable ' + selector);
  button.click();
};
const check = (condition, message) => { if (!condition) throw Error(message); };
const interval = 1000 / 30;
const nativeNow = performance.now.bind(performance);
let clock = 0, rafId = 0, queue = new Map();
Object.defineProperty(performance, 'now', { value: () => clock });
window.requestAnimationFrame = callback => { queue.set(++rafId, callback); return rafId; };
window.cancelAnimationFrame = id => queue.delete(id);
window.cityMusic = { pause() {} };
const storage = 'story-stage-audit:save';
localStorage.setItem('fedoskin-city-music', '0');
localStorage.removeItem(storage);
const city = { v: 1, day: 20261128, rep: 60, en: 120, wins: {}, beat: {}, turf: {}, last: {}, own: [],
  story: [{ en: 10, rep: 9 }], festival: null };
const selected = { slot: 'stitch', venue: 'prom', roster: 'crew', sound: 'relay', access: 'trace', format: 'relay' };
const stages = ['entry', 'prep', 'briefing', 'active', 'reward', 'resume', 'transition', 'save'];
const bucketLimits = [.01, .02, .05, .10, .25, .50, 1, 2, 4, 8, 16, 25, 50, 100];
const emptyMetrics = () => ({ calls: 0, frames: 0, domRecords: 0, domNodes: 0, maxMs: 0, totalMs: 0, buckets: Array(bucketLimits.length + 1).fill(0) });
let metrics, district, runtime, position, arrival, removeListeners, lock = false;
let state = loadFestivalState();
const observer = new MutationObserver(() => {});
observer.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
const inputKinds = new Set();
const allReports = [];
let measuredSaves = [], travelCount = 0, displayCount = 0, castCount = 0, sceneCount = 0;
function noteMetrics(stage, elapsed, frames = 0, records = []) {
  const summary = metrics[stage];
  summary.calls++;
  summary.frames += frames;
  summary.totalMs += elapsed;
  summary.maxMs = Math.max(summary.maxMs, elapsed);
  summary.domRecords += records.length;
  summary.domNodes += records.reduce((sum, record) => sum + record.addedNodes.length + record.removedNodes.length, 0);
  const bucket = bucketLimits.findIndex(value => elapsed <= value);
  summary.buckets[bucket < 0 ? bucketLimits.length : bucket]++;
}
function measure(stage, operation, frames = 0) {
  observer.takeRecords();
  const started = nativeNow();
  const value = operation();
  noteMetrics(stage, nativeNow() - started, frames, observer.takeRecords());
  return value;
}
function stepTo(time, stage = 'active') {
  check(time + .001 >= clock, 'Virtual time moved backwards');
  while (clock + .001 < time) {
    clock = Math.min(clock + interval, time);
    const callbacks = queue;
    queue = new Map();
    for (const callback of callbacks.values()) measure(stage, () => callback(clock), 1);
  }
}
function keyboard(pad, edge) {
  window.dispatchEvent(new KeyboardEvent(edge === 'up' ? 'keyup' : 'keydown', { key: String(pad + 1), code: 'Digit' + (pad + 1), bubbles: true }));
}
function recordSave() {
  const start = nativeNow();
  const raw = JSON.stringify({ ...city, where: district, festival: state });
  const encoded = nativeNow() - start;
  localStorage.setItem(storage, raw);
  const written = nativeNow() - start - encoded;
  noteMetrics('save', encoded + written);
  measuredSaves.push({ bytes: new TextEncoder().encode(raw).length, encodedMs: encoded, storageMs: written, episode: state.episode });
}
function mount(next) {
  if (runtime) {
    runtime.close();
    removeListeners();
    document.body.replaceChildren();
    for (const style of document.head.querySelectorAll('style')) style.remove();
    const raw = localStorage.getItem(storage);
    if (raw) state = loadFestivalState(JSON.parse(raw).festival);
  }
  district = next;
  arrival = null;
  lock = false;
  position = { x: 0, z: 0 };
  const W = { bounds: { x0: 0, x1: 70, z0: 0, z1: 30 }, hero: { root: { position } } };
  const places = Object.values(VENUES).filter(([d]) => d === district).map(([,id],i) => ({ id, x: 5 + i * 4, z: 8 + i, r: 1.5 }));
  const priorWindow = window.addEventListener, priorDocument = document.addEventListener, listeners = [];
  window.addEventListener = (event, handler, options) => { listeners.push([window,event,handler,options]); priorWindow.call(window,event,handler,options); };
  document.addEventListener = (event, handler, options) => { listeners.push([document,event,handler,options]); priorDocument.call(document,event,handler,options); };
  try {
    runtime = initFestival({
      t: (s, v) => v ? s.replace(/\{(\w+)\}/g, (_,k) => v[k]) : s, W, D: district, places,
      colliders: [{ x:29, z:15, r:2 }, { x0:31, z0:22, x1:33, z1:29 }],
      state, eligible: () => city.story.length > 0, save: recordSave,
      travel: district => { arrival = district; travelCount++; },
      openAllowed: () => !lock, lock: value => { lock = value; },
      displaySet: () => { displayCount++; }, prepareScene: () => { sceneCount++; },
      setCast: () => { castCount++; }, landmarkPoint: (_, anchor) => anchor,
    });
  } finally {
    window.addEventListener = priorWindow;
    document.addEventListener = priorDocument;
  }
  removeListeners = () => listeners.forEach(([target,event,handler,options]) => target.removeEventListener(event,handler,options));
}
function routeToPoint(stage) {
  measure(stage, () => {
    if ($('#g3festival').hidden) check(runtime.open(false), 'Journal failed');
    const target = runtime.guide();
    if (target.district !== district) {
      click('#fTravel');
      check(arrival === target.district, 'Travel target differs from guide');
      mount(arrival);
      check(runtime.open(false), 'Journal failed after district change');
    }
    click('#fGo');
    check(runtime.target(), 'Target missing at ' + district);
    Object.assign(position, runtime.target());
    check(runtime.open(true), 'Target failed at ' + district);
  });
}
function prepareEpisode() {
  routeToPoint('entry');
  if (!$('#fConfirmLandmark')) return false;
  measure('prep', () => click('#fConfirmLandmark'));
  check(state.prepared, 'Preparation did not persist');
  routeToPoint('transition');
  return true;
}
const microtasks = async () => { await Promise.resolve(); await Promise.resolve(); };
async function startPiece(course, stage = 'briefing') {
  const period = 60000 / (course.bpm * TEMPOS[state.tempo]);
  const epoch = clock + 2 * period;
  measure(stage, () => click('#fPlay'));
  await microtasks();
  check(runtime.performing(), 'Play button did not enter active view');
  return { period, epoch };
}
function queueInputs(phrase, phraseTime, period) {
  const send = (at, value, edge, kind) => {
    stepTo(phraseTime + at * period);
    inputKinds.add(kind);
    measure('active', () => keyboard(value, edge));
  };
  if (phrase.spec) {
    if (phrase.alternate) {
      send(0, 0, 'down', 'style');
      comboInput(phrase, 0, 0, 'down', 'style', false);
    }
    for (const event of phrase.steps) {
      if (event.kind === 'style') continue;
      send(event.at, event.pad, event.kind === 'release' ? 'up' : 'down', event.kind);
    }
  } else {
    for (let n = 0; n < phrase.length; n++) {
      const note = displayNote(phrase, n);
      if (note.kind === 'rest') { inputKinds.add('rest'); continue; }
      let family = note.kind === 'deck' ? 'deck' : 'move';
      let value = note.note;
      if (note.kind === 'reply') value = [0,1,2,3].find(x => x !== note.rival && x !== phrase.branch.lastReply);
      if (note.kind === 'build') value = note.desired;
      if (note.kind === 'cast') value = note.favored;
      if (['reply','build','cast'].includes(note.kind)) family = 'choice';
      send(n, value, 'down', note.kind);
      postInput(phrase, n, { family, value }, .31);
    }
  }
}
function stats() {
  const percentile = (summary, portion) => {
    let seen = 0;
    for (const [i,n] of summary.buckets.entries()) {
      seen += n;
      if (seen >= summary.calls * portion) return bucketLimits[i] ?? summary.maxMs;
    }
    return 0;
  };
  return Object.fromEntries(stages.map(stage => {
    const { buckets, ...summary } = metrics[stage];
    return [stage, { ...summary, p95BucketMs: summary.calls ? percentile(metrics[stage], .95) : 0 }];
  }));
}
async function runEpisode() {
  const episode = state.episode;
  metrics = Object.fromEntries(stages.map(stage => [stage, emptyMetrics()]));
  const checkpoint = measuredSaves.length, begin = clock;
  const startLocation = runtime.guide();
  const prepared = prepareEpisode();
  check(prepared === Boolean(REVISED_TURNS[episode]?.preparatory), 'Wrong preparation phase at ' + episode);
  const decision = storyDecision(state);
  if (decision) measure('briefing', () => click('[data-f-choice="' + selected[decision] + '"]'));
  if (episode === 44) measure('briefing', () => click('[data-sheet="lead"]'));
  const courses = [];
  for (let piece = 0; piece < 4; piece++) {
    const course = storyCourse(episode, piece, state);
    const begun = await startPiece(course);
    let { epoch } = begun;
    const { period } = begun;
    let offset = state.beat, paused = false, phrases = 0;
    for (let beat = state.beat; beat < course.beats;) {
      const phrase = playablePhrase(course, beat, { ...state.choices, lastReply: state.lastReply });
      const start = epoch + (beat - offset) * period;
      queueInputs(phrase, start, period);
      const nextBeat = beat + phrase.length;
      stepTo(start + (phrase.length - .35) * period, nextBeat === course.beats ? 'reward' : 'active');
      phrases++;
      if (nextBeat < course.beats) check(state.beat === nextBeat, 'Phrase progress did not save ' + [episode,piece,beat]);
      if (piece === 0 && !paused && nextBeat < course.beats) {
        measure('resume', () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
        check(!runtime.performing() && state.beat === nextBeat && Boolean($('#fPlay')), 'Pause lost checkpoint');
        const fromStorage = loadFestivalState(JSON.parse(localStorage.getItem(storage)).festival);
        check(fromStorage.episode === episode && fromStorage.piece === piece && fromStorage.beat === nextBeat, 'Checkpoint differs on disk');
        const resumed = await startPiece(course, 'resume');
        epoch = resumed.epoch;
        offset = nextBeat;
        paused = true;
      }
      beat = nextBeat;
    }
    check(!runtime.performing() && Boolean($('#fAgain')), 'No result sheet ' + [episode,piece]);
    check(state.episode === episode + Number(piece === 3), 'No episode reward ' + [episode,piece]);
    courses.push({ mode: course.mode, combo: course.combo || null, bpm: course.bpm, beatCount: course.beats, phrases });
    measure(piece === 3 ? 'transition' : 'reward', () => click('#fAgain'));
  }
  check(state.results.length === episode + 1 && state.results[episode].clean > 0, 'Missing episode receipt');
  const saved = measuredSaves.slice(checkpoint);
  const output = {
    episode: episode + 1, title: FESTIVAL_EPISODES[episode].title,
    act: FESTIVAL_EPISODES[episode].act + 1, prepared, entry: startLocation,
    route: storyVenue(episode, state.choices), decision, selected: decision && state.choices[decision],
    action: courses, result: state.results[episode], next: runtime.guide(),
    minutesInVirtualRun: (clock - begin) / 60000, stageMetrics: stats(),
    saveCount: saved.length, largestSaveBytes: Math.max(...saved.map(s => s.bytes)),
    worstStorageMs: Math.max(...saved.map(s => s.storageMs)),
  };
  allReports.push(output);
  return output;
}
async function runExams() {
  metrics = Object.fromEntries(stages.map(stage => [stage, emptyMetrics()]));
  check(state.episode === 60, 'Final poster before completion');
  check($('.festival-poster'), 'Epilogue did not open final poster');
  click('#fExams');
  await microtasks();
  if ($('#fTrialTravel')) {
    click('#fTrialTravel');
    mount(arrival);
    runtime.open(false);
    click('#fExams');
    await microtasks();
  }
  const reports = [];
  for (const spec of FESTIVAL_OFFICIAL) {
    click('[data-practice="1"][data-trial="' + spec.id + '"]');
    const first = examCourse(spec, 81497, 0);
    const { epoch, period } = await startPiece(first);
    let lastReply;
    for (let phase = 0; phase < spec.modes.length; phase++) {
      const course = examCourse(spec, 81497, phase);
      const phrase = createPhrase(course, 0, { lastReply });
      const start = epoch + 16 * phase * period;
      queueInputs(phrase, start, period);
      if (course.mode === 'r') lastReply = phrase.selections[0];
      stepTo(start + 15.65 * period, phase === spec.modes.length - 1 ? 'reward' : 'active');
    }
    check($('#fExamNotice')?.textContent.includes('В музыку 100%'), 'Incorrect local exam result ' + spec.id);
    reports.push({ id: spec.id, modes: spec.modes, output: $('#fExamNotice').textContent.trim() });
    click('#fBack');
    await microtasks();
  }
  return { reports, metrics: stats() };
}
function resetMetrics() {
  metrics = Object.fromEntries(stages.map(stage => [stage, emptyMetrics()]));
}
async function checkChoicePortraits() {
  resetMetrics();
  check(state.episode === 0, 'Portrait check requires fresh episode');
  const prepared = prepareEpisode();
  check(prepared, 'First choice before preparation');
  const buttons = [...document.querySelectorAll('.festival-slot [data-f-choice]')];
  check(buttons.length === 2, 'Expected two slot contenders');
  const entries = await Promise.all(buttons.map(async button => {
    const image = button.querySelector('img');
    check(image instanceof HTMLImageElement, 'Missing portrait for ' + button.dataset.fChoice);
    image.loading = 'eager';
    await image.decode();
    const rect = image.getBoundingClientRect();
    return { id: button.dataset.fChoice, asset: image.src.split('/').at(-1), natural: image.naturalWidth,
      x: rect.x, width: rect.width, right: rect.right, label: button.textContent.trim() };
  }));
  check(entries.every(image => image.natural === 320 && image.width >= 56 &&
    image.x >= 0 && image.right <= innerWidth && image.asset === image.id + '.webp'), 'Portrait dimensions');
  check(entries[0].right <= entries[1].x, 'Portraits overrun adjacent choice');
  check(entries.some(image => image.id === 'stitch') && entries.some(image => image.id === 'granite'), 'Wrong contenders');
  return { viewport: innerWidth, portraits: entries };
}
async function runLegacyClub() {
  resetMetrics();
  const episode = 24, piece = 1, beat = 16;
  const old = { v:1, episode, piece, beat, prepared:true, tempo:'normal',
    choices:{ venue:'park', roster:'crew', sound:'relay' },
    results:Array.from({ length:episode }, () => ({ clean: 12, variation: 7 })),
    clean:8, variation:4, lastReply:2 };
  localStorage.setItem(storage, JSON.stringify({ ...city, where:'club', festival:old }));
  mount('club');
  check(state.legacyEpisode === episode && state.legacyActs === 3 && state.beat === beat, 'Old club save did not migrate');
  const course = pieceAt(episode, piece, old.choices);
  check(JSON.stringify(storyCourse(episode, piece, state)) === JSON.stringify(course), 'Legacy course changed');
  routeToPoint('entry');
  const first = await startPiece(course);
  check($('#fMode').textContent === MODE_NAMES[course.mode], 'Legacy mode label changed');
  const phrase = playablePhrase(course, beat, { ...state.choices, lastReply:state.lastReply });
  queueInputs(phrase, first.epoch, first.period);
  stepTo(first.epoch + 15.65 * first.period);
  check(state.beat === beat + 16 && state.results.length === episode, 'Legacy beat did not save');
  measure('resume', () => window.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true })));
  mount('club');
  check(state.legacyEpisode === episode && state.beat === 32 && state.results.length === episode, 'Legacy reload changed checkpoint');
  routeToPoint('resume');
  const second = await startPiece(course, 'resume');
  queueInputs(playablePhrase(course, state.beat, { ...state.choices, lastReply:state.lastReply }), second.epoch, second.period);
  stepTo(second.epoch + 15.65 * second.period);
  check(state.beat === 48 && state.piece === piece && state.legacyEpisode === episode, 'Legacy continuation did not save');
  return { episode:state.episode + 1, piece:state.piece + 1, fromBeat:beat, savedBeat:state.beat, mode:course.mode,
    bpm:course.bpm, receipts:state.results.length, legacyActs:state.legacyActs, stageMetrics:stats() };
}
mount('yard');
window.storyStageAudit = { runEpisode, runExams, checkChoicePortraits, runLegacyClub, allReports, totals: () => ({
  clockMinutes: clock / 60000, inputKinds: [...inputKinds], travelCount, displayCount, castCount, sceneCount,
  saves: measuredSaves.length, storageBytes: Math.max(...measuredSaves.map(s => s.bytes)),
  worstStorageMs: Math.max(...measuredSaves.map(s => s.storageMs)),
}) };
