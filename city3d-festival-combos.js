import { createPhrase, phraseVerdict } from './city3d-campaign-engine.js?v=2';

const rock = 'Breakdance_Uprock', foot = 'Breakdance_Footwork_2', idle = 'Breakdance_Ready';
const drop = 'Festival_CrossDrop', rise = 'Festival_StandThrough', reset = 'Festival_FootReset';
const kick = 'City_Trick_KickSwitch', thread = 'City_Trick_Thread', spin = 'City_Backspin';
const freeze = 'City_Shoulder_Hold', sweep = 'City_Floorrock_Sweep';
const step = (at, pad, clip, essential = false) => ({ at, pad, clip, essential, kind: 'tap' });
const hold = (at, pad) => ({ at, pad, clip: freeze, essential: true, kind: 'hold' });
const release = (at, pad) => ({ at, pad, clip: rise, essential: true, kind: 'release' });
const hand = (at, pad) => ({ at, pad, clip: rock, essential: true, kind: 'hand' });
const accent = (at, pad) => step(at, pad, foot);

const chop = [
  step(2,0,rock), step(3,2,drop,true), step(4.5,3,kick,true), hold(6,1), release(8,1),
  step(9.5,0,thread,true), step(11,2,reset), accent(12,3), step(14,1,rise), step(15,0,rock),
];
const space = [
  step(2,3,rock), step(3,0,drop,true), step(4.5,2,thread,true), hold(6,3), release(8,3),
  step(9.5,1,kick,true), step(11,0,sweep), accent(12,2), step(14,3,rise), step(15,1,rock),
];
export const STYLE_NAMES = ['Срезать через кик', 'Пропустить и продеть'];
export const REPLY_LINES = [
  'Соперник дёрнул носком на твой встречный кик.',
  'Соперник отступил, оставляя место твоему продеванию.',
];
export const SIGNATURES = {
  stitch: [rock, kick, 'Festival_StitchSignal'],
  granite: [foot, freeze, 'Festival_GraniteSignal'],
};

export const COMBOS = {
  openingStitch: { name: 'Дробный вход Стежка', guide: 'Сначала посмотри раунд. В музыкальной фразе два отдельных удара приходятся на долю и «и».',
    steps: [step(0,0,rock),step(1,2,drop,true),step(3,0,kick,true),step(3.5,3,kick,true),accent(5,2),accent(6,0),
      step(7,1,rise,true),step(8,3,rock),step(10,2,drop,true),accent(12,0),step(15,1,rise,true)] },
  openingGranite: { name: 'Долгая пауза Гранита', guide: 'Сначала посмотри раунд. После первого акцента оставь две пустые доли, затем войди и поднимись в музыку.',
    steps: [step(0,3,rock),step(3,2,drop,true),step(4,3,thread,true),step(5,0,reset,true),accent(6,2),accent(7,3),
      step(8,1,rise,true),step(9,0,rock),step(11,2,drop,true),accent(13,3),step(15,1,rise,true)] },
  drop: { name: 'Крест и смена уровня', guide: 'Две верхние доли, затем спуск. Пройди футворк и поднимись на стрелке вверх.',
    steps: [step(0,0,rock),step(1,3,rock),step(2,2,drop,true),accent(4,0),accent(5,2),accent(6,3),step(7,1,rise,true),
      step(8,0,rock),step(10,2,drop,true),accent(12,3),accent(13,0),step(14,1,rise,true)] },
  afterbreak: { name: 'Подхват на слабой доле', guide: 'Дай брейку прозвучать. После пустой доли войди на знаке «и», затем собери футворк.',
    steps: [step(0,0,rock),step(2,2,drop,true),step(4.5,3,foot,true),accent(5,0),accent(6,2),step(7,1,rise),
      step(8,3,rock),step(10,2,drop,true),step(12.5,0,foot,true),accent(13,3),step(15,1,rise)] },
  switch: { name: 'Встречный кик', guide: 'Ударь в первую сторону, затем смени направление на «и» той же доли. Два отдельных касания.',
    steps: [step(0,1,rock),step(1,2,drop,true),step(3,0,kick,true),step(3.5,3,kick,true),accent(5,1),step(7,0,reset),
      step(8,3,foot),step(11,3,kick,true),step(11.5,0,kick,true),accent(13,2),step(15,1,rise)] },
  thread: { name: 'Продевание наружу', guide: 'Войди по центру, протяни ногу на боковом акценте. Смени опорную сторону на следующем заходе.',
    steps: [step(0,2,drop,true),accent(1,1),step(3,0,thread,true),step(4.5,3,reset,true),accent(6,2),accent(7,0),
      step(8,1,foot),step(10,3,thread,true),step(11.5,0,reset,true),accent(13,2),step(15,1,rise)] },
  anchor: { name: 'Плечо и выход', guide: 'На «держи» прижми палец или клавишу. На «отпусти» выпусти ту же кнопку, затем уводи шаг наружу.',
    steps: [step(0,2,drop,true),accent(1,3),hold(3,0),release(5,0),step(6,3,rise,true),step(7,1,rock),
      step(8,2,drop),accent(9,0),hold(11,3),release(13,3),step(14,1,rise,true),step(15,0,rock)] },
  coil: { name: 'Вращение, фриз, выход', guide: 'После вращения подхвати фриз удержанием, отпусти на доле и закончи двумя направленными шагами.',
    steps: [step(0,2,spin,true),hold(4,1),release(6,1),step(7,3,rock,true),step(8,0,rock),
      step(9,2,drop),step(10,3,spin,true),hold(13,0),release(14,0),step(15,1,rise,true)] },
  handoff: { name: 'Передача на пустом ударе', guide: 'Перед передачей оставь пустую долю. Знак передачи вызывает следующего из выбранного состава.',
    steps: [step(0,0,rock),step(2,2,drop,true),accent(3,0),hand(4.5,3),accent(6,1),step(7,2,reset),
      step(8,0,thread),accent(9,2),hand(12.5,0),step(14,3,rise,true),step(15,1,rock)] },
  rematch: { name: 'Два рисунка на один акцент', guide: 'Выбери встречный кик или продевание. Затем сыграй свою дорожку: число акцентов, удержания и окно точности совпадают.',
    styles: [chop,space] },
  stitch: { name: 'Дробный акцент Стежка', guide: 'Стежок подбирает второй удар между долями. Ответь одним из двух рисунков и удержи фриз.',
    styles: [chop,space], rival: 'stitch' },
  granite: { name: 'Длинная доля Гранита', guide: 'Гранит держит место перед вторым ударом. Оставь эту паузу и ответь киком или продеванием.',
    styles: [chop,space], rival: 'granite' },
};

const arcs = {
  openingStitch: ['openingStitch','drop','afterbreak','openingStitch'],
  openingGranite: ['openingGranite','drop','thread','openingGranite'],
  drop:       ['drop', 'afterbreak', 'thread', 'drop'],
  afterbreak: ['afterbreak', 'drop', 'switch', 'afterbreak'],
  switch:     ['switch', 'thread', 'afterbreak', 'switch'],
  thread:     ['thread', 'switch', 'drop', 'thread'],
  anchor:     ['anchor', 'drop', 'coil', 'anchor'],
  coil:       ['coil', 'anchor', 'switch', 'coil'],
  handoff:    ['handoff', 'afterbreak', 'thread', 'handoff'],
  rematch:   ['rematch', 'thread', 'handoff', 'rematch'],
  stitch:    ['stitch', 'switch', 'afterbreak', 'stitch'],
  granite:   ['granite', 'anchor', 'thread', 'granite'],
};

function track(steps, length, mirrored) {
  return steps.filter((item, index) => item.at < length && (item.kind !== 'hold' ||
    steps[index + 1]?.kind === 'release' && steps[index + 1].at < length))
    .map(item => ({ ...item, pad: mirrored ? [3,1,2,0][item.pad] : item.pad,
      clip: mirrored && /^(City|Festival)_/.test(item.clip) ? item.clip + '_M' : item.clip }));
}

export function playablePhrase(course, start, choices) {
  const section = Math.min(3, Math.floor(start * 4 / course.beats));
  const spec = COMBOS[arcs[course.combo]?.[section]], length = Math.min(16, course.beats - start);
  if (!spec || length < 8) return createPhrase(course, start, choices);
  const mirrored = (course.seed + start / 16) % 2 === 1;
  const alternate = spec.styles?.map(items => track(items, length, mirrored));
  const choice = { at: 0, kind: 'style', essential: true };
  return { course, start, length, mirrored, spec, alternate, style: null, pending: null,
    hit: new Set(), attempted: new Map(), spoiled: new Set(), rejected: new Set(),
    steps: alternate ? [choice] : track(spec.steps, length, mirrored) };
}

export function comboEvents(phrase) {
  return phrase.alternate && phrase.style === null ? [...phrase.steps, ...phrase.alternate[0].map(item => ({ ...item, undecided: true }))] : phrase.steps;
}

export function comboRival(phrase, state) {
  if (state.choices.format === 'split' && [50, 55].includes(phrase.course.episode)) {
    return phrase.start * 2 < phrase.course.beats ? 'granite' : 'stitch';
  }
  return phrase.spec?.rival || (state.choices.slot === 'granite' ? 'stitch' : 'granite');
}

export function comboInput(phrase, beat, pad, edge, token, slow) {
  if (edge === 'cancel') {
    if (phrase.pending?.token === token) phrase.pending = null;
    return null;
  }
  const tolerance = slow ? .24 : .21;
  const event = phrase.steps.find(item => Math.abs(beat - item.at) <= tolerance);
  if (edge === 'up') {
    if (phrase.pending?.token !== token) return null;
    phrase.pending = null;
    if (event?.kind !== 'release' || event.pad !== pad) {
      phrase.rejected.add('hold:' + Math.round(beat * 2));
      return { reaction: 'release' };
    }
  } else if (!event) {
    if (beat >= -.15 && beat < phrase.length - .4) phrase.rejected.add(Math.round(beat * 4));
    return { reaction: 'rest' };
  }
  if (phrase.attempted.has(event.at)) {
    if (edge !== 'up' && phrase.attempted.get(event.at) !== pad) {
      if (event.essential) phrase.spoiled.add(event.at);
      phrase.rejected.add('extra:' + event.at);
      return { reaction: 'miss' };
    }
    return null;
  }
  phrase.attempted.set(event.at, pad);
  if (event.kind === 'style') {
    if (![0, 1].includes(pad)) {
      phrase.rejected.add('bad:' + event.at);
      return { reaction: 'style' };
    }
    phrase.style = pad;
    phrase.steps = [event, ...phrase.alternate[pad]];
  } else if (event.pad !== pad || event.kind === 'release' && edge !== 'up') {
    phrase.rejected.add('bad:' + event.at);
    return { reaction: event.kind === 'release' ? 'release' : 'miss' };
  }
  if (event.kind === 'hold') phrase.pending = { token };
  phrase.hit.add(event.at);
  const next = phrase.steps.find(item => item.at > event.at);
  return { reaction: event.kind === 'style' ? 'variation' : event.kind === 'hand' ? 'lineup' : 'clean',
    event, duration: next ? next.at - event.at : phrase.length - event.at };
}

export function playableVerdict(phrase, slow) {
  if (!phrase.spec) return phraseVerdict(phrase, slow);
  const planned = phrase.alternate && phrase.style === null ? comboEvents(phrase) : phrase.steps;
  const hits = {}, errors = {}, selections = {};
  const prompts = planned.map((item, i) => {
    if (phrase.hit.has(item.at)) hits[i] = true;
    if (item.kind === 'style' && phrase.style != null) selections[i] = phrase.style;
    return { kind: item.kind === 'style' ? 'reply' : 'perform' };
  });
  // Reuse the baseline numeric tier and deliberate-silence penalty. Every named transition
  // must also succeed, so a held pad, a missed handoff or a half-beat skip cannot pass.
  for (let i = 0; i < phrase.rejected.size; i++) {
    errors[prompts.length] = true;
    prompts.push({ kind: 'rest' });
  }
  const verdict = phraseVerdict({ ...phrase, prompts, hits, errors, selections }, slow);
  return { ...verdict, passed: verdict.passed && planned.every(item => !item.essential || phrase.hit.has(item.at) && !phrase.spoiled.has(item.at)),
    errors: phrase.rejected.size, style: phrase.style, reply: undefined };
}
