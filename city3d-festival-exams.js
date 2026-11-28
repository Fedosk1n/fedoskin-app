import { createPhrase, displayNote, PHRASE_BEATS, postInput, TEMPOS } from './city3d-campaign-engine.js?v=2';

export const FESTIVAL_EXAMS = [
  { id: 'pulse', name: 'Три паузы Маятника', rival: 'Маятник', bpm: 116, modes: 'ggb', precision: .88, clean: 2, variety: 2, rivalMarks: [.90, 2, 1] },
  { id: 'answer', name: 'Ответ Клёпке', rival: 'Клёпка', bpm: 120, modes: 'rrb', precision: .87, clean: 2, variety: 4, rivalMarks: [.89, 2, 3] },
  { id: 'decks', name: 'Смена пульта Винта', rival: 'Винт', bpm: 124, modes: 'ddc', precision: .90, clean: 2, variety: 3, rivalMarks: [.90, 1, 3] },
  { id: 'final', name: 'Судимый финал · Грань круга', rival: 'Волна', bpm: 132, modes: 'grbdcr', precision: .92, clean: 4, variety: 8, rivalMarks: [.94, 4, 6] },
];
export const FESTIVAL_CHECKPOINTS = [
  { id: 'act1', name: 'Проверка открытого входа', rival: 'Винт', bpm: 88, modes: 'gb', precision: .70, clean: 0, variety: 2, rivalMarks: [.61, 0, 1] },
  { id: 'act2', name: 'Площадка в Центре', rival: 'Трафареты', bpm: 100, modes: 'cg', precision: .74, clean: 0, variety: 3, rivalMarks: [.67, 0, 2] },
  { id: 'act3', name: 'Ответ двух составов', rival: 'Шуруп', bpm: 108, modes: 'rc', precision: .77, clean: 1, variety: 4, rivalMarks: [.70, 0, 3] },
  { id: 'act4', name: 'Проверка звука', rival: 'Винт', bpm: 112, modes: 'dg', precision: .79, clean: 1, variety: 0, rivalMarks: [.72, 0, 0] },
  { id: 'act5', name: 'Последний отбор', rival: 'Клёпка', bpm: 116, modes: 'rb', precision: .80, clean: 1, variety: 3, rivalMarks: [.76, 0, 2] },
  { id: 'act6', name: 'Репетиция новой афиши', rival: 'Литейка', bpm: 120, modes: 'dc', precision: .81, clean: 1, variety: 3, rivalMarks: [.76, 0, 2] },
  { id: 'act7', name: 'Двери фестиваля', rival: 'Волна', bpm: 124, modes: 'cbr', precision: .83, clean: 1, variety: 6, rivalMarks: [.79, 0, 5] },
  { id: 'act8', name: 'Встреча спустя годы', rival: 'Маятник', bpm: 120, modes: 'rgc', precision: .82, clean: 1, variety: 4, rivalMarks: [.78, 0, 3] },
];
export const FESTIVAL_OFFICIAL = [...FESTIVAL_CHECKPOINTS, ...FESTIVAL_EXAMS];
export const FESTIVAL_PRIZE = ['c:prismCypherKicks', 'c:prismCypherLaces'];

export function examPeriod(spec, tempo) { return 60000 / (spec.bpm * TEMPOS[tempo]); }
export function examCourse(spec, seed, phase) {
  return { mode: spec.modes[phase], bpm: spec.bpm, beats: PHRASE_BEATS, act: 7, flavor: phase % 3,
    seed: (seed % 999983 + phase * 13) % 999983 };
}

export function judgeFestivalExam(spec, seed, tempo, inputs) {
  if (!spec || !Object.hasOwn(TEMPOS, tempo) || !Array.isArray(inputs) || inputs.length > 220) return null;
  const period = examPeriod(spec, tempo), beats = spec.modes.length * PHRASE_BEATS;
  let previousAt = -500, lastReply, clean = 0, placed = 0, needed = 0, variety = 0, excess = 0;
  const planned = FESTIVAL_OFFICIAL.includes(spec) && Array.from({ length: spec.modes.length }, () => []);
  if (!planned) return null;
  for (const entry of inputs) {
    if (!Array.isArray(entry) || entry.length !== 2) return null;
    const [ms, value] = entry;
    if (!Number.isInteger(ms) || ms < previousAt || ms < -500 || ms >= Math.ceil(period * beats) ||
        !Number.isInteger(value) || value < 0 || value > 3) return null;
    previousAt = ms;
    const beat = Math.round(ms / period), phase = Math.floor(beat / PHRASE_BEATS);
    if (planned[phase]) planned[phase].push(entry); else excess++;
  }
  for (let phase = 0; phase < planned.length; phase++) {
    const course = examCourse(spec, seed, phase);
    const phrase = createPhrase(course, 0, { lastReply });
    for (const [ms, value] of planned[phase]) {
      const offset = ms / period - phase * PHRASE_BEATS;
      const note = displayNote(phrase, Math.round(offset));
      if (!note) { excess++; continue; }
      const family = ['reply','build','cast'].includes(note.kind) ? 'choice' : course.mode === 'd' ? 'deck' : 'move';
      const outcome = postInput(phrase, offset, { family, value }, .31);
      if (outcome === 'repeat' || outcome === 'early') excess++;
    }
    placed += Object.keys(phrase.hits).length;
    needed += phrase.prompts.filter(note => note.kind !== 'rest').length;
    const misses = phrase.prompts.reduce((n, note, i) => n + Number(note.kind !== 'rest' && !phrase.hits[i]), 0);
    if (!misses && !Object.keys(phrase.errors).length) clean++;
    const chosen = Object.values(phrase.selections);
    if (course.mode === 'r') { lastReply = chosen[0]; if (lastReply != null) variety++; }
    if (course.mode === 'b' || course.mode === 'c') variety += new Set(chosen).size;
  }
  const precision = Math.max(0, (placed - excess) / Math.max(1, needed));
  const [rivalPrecision, rivalClean, rivalVariety] = spec.rivalMarks;
  const votes = [precision > rivalPrecision, clean > rivalClean, variety > rivalVariety].map(Number);
  const passed = precision >= spec.precision && clean >= spec.clean && variety >= spec.variety &&
    votes.reduce((sum, vote) => sum + vote, 0) >= 2;
  return { passed, precision, clean, variety, votes };
}
