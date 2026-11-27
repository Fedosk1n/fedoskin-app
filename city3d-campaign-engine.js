import { DECISIONS, EPISODES } from './city3d-campaign-data.js?v=1';

export const TEMPOS = { training: .85, normal: 1, quick: 1.12 };
export const PHRASE_BEATS = 16;
export const DIRECTIONS = ['←', '↑', '↓', '→'];
export const MOVES = ['Топрок', 'Футворк', 'Пауэр', 'Фриз'];
export const RUNNERS = ['Трафареты', 'Шуруп', 'Клёпка', 'Маятник'];

// Four groups of eight beats. Each pocket has offbeats, accents and deliberate silence.
const pockets = [
  [0, '.', 1, 0, '.', 2, '.', 3], [1, 0, '.', '.', 2, '.', 3, 1],
  [0, 1, '.', 2, 0, '.', '.', 3], [2, '.', 2, 0, 1, 3, '.', '.'],
  [3, 1, '.', 0, '.', 2, '.', 1], [0, '.', 3, 2, '.', '.', 1, 0],
  [2, 1, '.', 3, 1, '.', 0, '.'], [3, '.', 2, '.', 1, 3, 0, '.'],
  [1, '.', 0, '.', 3, 2, '.', 1], [2, 3, 1, '.', 0, 1, '.', '.'],
  [0, 2, '.', 1, 3, '.', 2, '.'], [3, '.', 0, 1, '.', 3, '.', 2],
];

export function pieceAt(episodeIndex, pieceIndex, choices) {
  const ep = EPISODES[episodeIndex];
  if (!ep || !Number.isInteger(pieceIndex) || pieceIndex < 0 || pieceIndex >= ep.pieces.length) return null;
  const mode = ep.pieces[pieceIndex];
  let bpm = ep.bpm;
  if (ep.act >= 5 && choices.sound === 'relay') bpm += [0, 8, 4, -4][pieceIndex];
  const flavor = ep.act >= 5 && choices.sound === 'relay' ? pieceIndex + 1 : 0;
  return { mode, bpm, beats: bpm * 3, flavor, seed: ep.motif, act: ep.act };
}

export function freshCampaign() {
  return { v: 1, episode: 0, piece: 0, beat: 0, choices: {}, tempo: 'normal', results: [] };
}

export function loadCampaign(value) {
  const next = freshCampaign();
  if (value?.v !== 1) return next;
  const results = Array.isArray(value.results) ? value.results : [];
  for (const row of results.slice(0, EPISODES.length)) {
    if (!Number.isInteger(row?.clean) || row.clean < 0 || !Number.isInteger(row?.variation) || row.variation < 0) break;
    next.results.push({ clean: row.clean, variation: row.variation });
  }
  next.episode = next.results.length;
  for (const [id, decision] of Object.entries(DECISIONS)) {
    if (decision.options.some(option => option.tag === value.choices?.[id])) next.choices[id] = value.choices[id];
  }
  next.tempo = Object.hasOwn(TEMPOS, value.tempo) ? value.tempo : 'normal';
  if (Number.isInteger(value.lastReply) && value.lastReply >= 0 && value.lastReply < 4) next.lastReply = value.lastReply;
  const course = pieceAt(next.episode, value.piece, next.choices);
  if (course && value.episode === next.episode) {
    next.piece = value.piece;
    next.beat = Number.isInteger(value.beat) && value.beat >= 0 && value.beat < course.beats && value.beat % PHRASE_BEATS === 0 ? value.beat : 0;
    next.clean = Number.isInteger(value.clean) && value.clean >= 0 ? value.clean : 0;
    next.variation = Number.isInteger(value.variation) && value.variation >= 0 ? value.variation : 0;
    next.prepared = Boolean(value.prepared || value.piece || next.beat);
  }
  return next;
}

export function rosterFor(course, choices) {
  return course.act < 3 || choices.roster !== 'crew' ? [0, 1, 2, 3] : [2, 0, 3, 1];
}

function notePattern(seed, offset) {
  return pockets[(seed * 7 + offset * 5) % pockets.length];
}

export function createPhrase(course, start, choices) {
  const length = Math.min(PHRASE_BEATS, course.beats - start);
  const index = start / PHRASE_BEATS;
  const character = (course.seed + index + course.flavor) % 4;
  const rival = (character + index % 3 + 1) % 4;
  const desired = [character, (character + (course.seed % 2 ? 1 : 3)) % 4];
  const roster = rosterFor(course, choices);
  const rhythm = Array.from({ length }, (_, beat) =>
    notePattern(course.seed + course.flavor, 2 * index + Math.floor(beat / 8))[beat % 8]);
  const prompts = rhythm.map((note, beat) => {
    if (course.mode === 'r' && beat === 0) return { kind: 'reply', rival };
    if (course.mode === 'b' && beat < 2) return { kind: 'build', desired: desired[beat] };
    if (course.mode === 'c' && beat % 4 === 0) return { kind: 'cast', favored: roster[(character + Math.floor(beat / 4)) % 4] };
    if (note === '.') return { kind: 'rest' };
    if (course.mode === 'd') return { kind: 'deck', note: (note + Math.floor(beat / 4) * 2 + course.flavor) % 4 };
    return { kind: course.mode === 'g' ? 'groove' : 'perform', note };
  });
  return { course, length, start, prompts, selections: {}, hits: {}, errors: {}, latest: { source: '', result: '' }, branch: choices };
}

export function displayNote(phrase, ordinal) {
  const entry = phrase.prompts[ordinal];
  if (!entry) return null;
  if (entry.kind !== 'perform') return entry;
  if (phrase.course.mode === 'r') {
    const style = phrase.selections[0];
    return { ...entry, note: style == null ? entry.note : (entry.note + style + 1) % 4 };
  }
  if (phrase.course.mode === 'b') {
    const style = phrase.selections[ordinal >= Math.ceil(phrase.length / 2) ? 1 : 0];
    return { ...entry, note: style == null ? entry.note : (entry.note + style) % 4 };
  }
  const section = ordinal - ordinal % 4;
  return { ...entry, note: (entry.note + (phrase.selections[section] ?? 0)) % 4 };
}

export function postInput(phrase, beatPosition, code, tolerance) {
  const ordinal = Math.round(beatPosition);
  if (ordinal < 0 || ordinal >= phrase.length || Math.abs(beatPosition - ordinal) > tolerance) return 'early';
  const event = displayNote(phrase, ordinal);
  if (phrase.hits[ordinal] || phrase.errors[ordinal]) return 'repeat';
  let valid = false;
  let feedback = 'miss';
  if (event.kind === 'reply' && code.family === 'choice') {
    valid = code.value !== event.rival &&
      (phrase.course.act < 4 || code.value !== phrase.branch.lastReply);
    feedback = valid ? 'variation' : 'copied';
  } else if (event.kind === 'build' && code.family === 'choice') {
    valid = code.value === event.desired && code.value !== phrase.selections[0];
    feedback = valid ? 'variation' : 'fit';
  } else if (event.kind === 'cast' && code.family === 'choice') {
    valid = code.value === event.favored && code.value !== phrase.selections[ordinal - 4];
    feedback = valid ? 'lineup' : 'line';
  } else if ((event.kind === 'groove' || event.kind === 'perform') && code.family === 'move') {
    valid = code.value === event.note;
    feedback = valid ? 'clean' : 'miss';
  } else if (event.kind === 'deck' && code.family === 'deck') {
    valid = code.value === event.note;
    feedback = valid ? 'clean' : 'miss';
  } else if (event.kind === 'rest') feedback = 'rest';
  if (valid) {
    phrase.hits[ordinal] = true;
    if (code.family === 'choice') phrase.selections[ordinal] = code.value;
  } else phrase.errors[ordinal] = true;
  return feedback;
}

export function phraseVerdict(phrase, easy) {
  const required = phrase.prompts.reduce((count, prompt) => count + Number(prompt.kind !== 'rest'), 0);
  const choices = phrase.prompts.flatMap((prompt, i) => ['reply', 'build', 'cast'].includes(prompt.kind) ? [i] : []);
  const hits = Object.keys(phrase.hits).length;
  const errors = Object.keys(phrase.errors).length;
  const silenceErrors = phrase.prompts.reduce((n, prompt, i) => n + Number(prompt.kind === 'rest' && Boolean(phrase.errors[i])), 0);
  const score = Math.max(0, hits - silenceErrors * .5);
  const threshold = (easy ? [.48, .50, .54, .56, .60, .63, .65, .68] : [.55, .58, .62, .66, .69, .72, .76, .78])[phrase.course.act] ?? .62;
  const allChoices = choices.every(i => phrase.hits[i]);
  const passed = allChoices && score >= Math.ceil(required * threshold);
  return { passed, hits, required, errors, clean: Number(hits === required && !errors),
    variation: choices.filter(i => phrase.hits[i]).length,
    reply: phrase.course.mode === 'r' ? phrase.selections[0] : undefined };
}

export function recordPhrase(state, verdict, endingBeat, key) {
  const { episode, piece } = state;
  if (!verdict.passed || key.episode !== episode || key.piece !== piece || key.beat !== state.beat) return false;
  const course = pieceAt(episode, piece, state.choices);
  const expected = Math.min(course.beats, state.beat + PHRASE_BEATS);
  if (endingBeat !== expected) return false;
  state.clean = (state.clean || 0) + verdict.clean;
  state.variation = (state.variation || 0) + verdict.variation;
  if (verdict.reply != null) state.lastReply = verdict.reply;
  if (endingBeat < course.beats) {
    state.beat = endingBeat;
    return true;
  }
  state.beat = 0;
  if (piece + 1 < EPISODES[episode].pieces.length) {
    state.piece++;
    return true;
  }
  state.results.push({ clean: state.clean, variation: state.variation });
  state.episode++;
  state.piece = state.clean = state.variation = 0;
  state.prepared = false;
  return true;
}

export function recordDecision(state, tag) {
  const decisionId = EPISODES[state.episode]?.decision;
  if (!decisionId || state.choices[decisionId] || !DECISIONS[decisionId].options.some(option => option.tag === tag)) return false;
  state.choices[decisionId] = tag;
  return true;
}
