// The overhead sprites share the platter pivot from tools/build_city_dj.py.
const lessons = [
  { name: 'BABY SCRATCH', guide: 'По очереди поверни пластинку по часовой и обратно. Здесь можно двигаться в своём темпе.', notes: [1, -1, 1, -1, 1, -1], pass: 6 },
  { name: 'ON BEAT', guide: 'Начни движение, когда кольцо вспыхнет. Делай один скретч на каждую вспышку.', notes: [1, -1, 1, -1, -1, 1, -1, 1], beat: 830, window: 325, pass: 6 },
  { name: 'TWO DECKS', guide: 'Следи за подсвеченной вертушкой. Когда активная сторона поменяется, коснись новой пластинки.', notes: [1, -1, 2, -2, -2, 2, -1, 1, 2, -2, 1, -1], beat: 680, window: 255, pass: 9 },
];

const TAU = Math.PI * 2;
const SWIPE = .32;
const angleBetween = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const asset = name => new URL('./img/scratch-' + name + '.webp?v=1', import.meta.url).href;
const arrow = note => note > 0 ? '↻' : '↺';
const deckOf = note => Math.abs(note) - 1;
const savedSound = () => {
  try { return localStorage.getItem('fedoskin-scratch-sound') !== '0'; } catch (_) { return true; }
};

let artReady;
export function loadScratchArt() {
  if (!artReady) artReady = Promise.all(['base', 'record', 'arm'].map(name => {
    const image = new Image();
    image.src = asset(name);
    return image.decode();
  })).catch(error => { artReady = null; throw error; });
  return artReady;
}

function scratchSound() {
  let ctx, bus, samples, lastGrain = -Infinity, position = .07;

  function play(which, at, pitch, duration, volume, offset = 0) {
    if (ctx?.state !== 'running') return;
    const source = ctx.createBufferSource(), envelope = ctx.createGain();
    source.buffer = samples[which];
    source.playbackRate.value = pitch;
    source.connect(envelope); envelope.connect(bus);
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(volume, at + .006);
    envelope.gain.exponentialRampToValueAtTime(.0004, at + duration);
    source.start(at, offset);
    source.stop(at + duration + .001);
    source.onended = () => { source.disconnect(); envelope.disconnect(); };
  }

  return {
    wake() {
      try {
        if (!ctx) {
          const Context = window.AudioContext || window.webkitAudioContext;
          if (!Context) return;
          ctx = new Context();
          bus = ctx.createGain();
          bus.gain.value = .60;
          bus.connect(ctx.destination);
          const sr = ctx.sampleRate;
          const make = (seconds, synth) => {
            const b = ctx.createBuffer(1, Math.round(seconds * sr), sr);
            const data = b.getChannelData(0);
            for (let i = 0; i < data.length; i++) data[i] = synth(i/sr, i);
            return b;
          };
          // Original vocal-like groove and its reversed waveform. Motion chooses the playback direction.
          const record = make(.48, (t, i) => {
            const wobble = Math.sin(2 * Math.PI * t * 5.4);
            const phase = TAU * (127 * t - 32 * t * t);
            const tone = .32 * Math.sin(phase) + .24 * Math.sin(phase*3 + wobble)
              + .18 * Math.sin(phase*7 - wobble*1.4) + .11 * Math.sin(phase*13 + wobble*.7);
            return (tone + .14 * Math.sin(i * 19.72 + Math.sin(i * 2.97) * 4)) * (.78 + .21 * wobble);
          });
          const rev = ctx.createBuffer(1, record.length, sr);
          rev.getChannelData(0).set(record.getChannelData(0).slice().reverse());
          const kick = make(.18, t => Math.sin(TAU * (51*t + .38*(1-Math.exp(-60*t)))) * Math.exp(-t*24));
          const click = make(.09, (t, i) => (Math.sin(TAU*850*t) * .58 + .42*Math.sin(i*23.91)) * Math.exp(-t*52));
          samples = [record, rev, kick, click];
        }
        if (ctx.state !== 'running') ctx.resume().catch(() => {});
      } catch (_) {}
    },
    drag(delta, elapsed, deck) {
      if (ctx?.state !== 'running') return;
      position = clamp(position + delta * .18, .044, .32);
      if (ctx.currentTime - lastGrain < .028) return;
      lastGrain = ctx.currentTime;
      const pitch = clamp(Math.abs(delta) * 140 / Math.max(8, elapsed), .48, 1.55) * (deck ? .87 : 1);
      play(delta > 0 ? 0 : 1, ctx.currentTime, pitch, .055, .34, delta > 0 ? position : .36 - position);
    },
    beat(accent) {
      if (ctx?.state !== 'running') return;
      play(accent ? 2 : 3, ctx.currentTime, 1, accent ? .15 : .08, accent ? .66 : .26);
    },
    mute(value) { if (bus) bus.gain.value = value ? 0 : .60; },
    close() { ctx?.close().catch(() => {}); },
  };
}

export function openScratch({ t, best, onBest, onClose, onMotion }) {
  const dialog = document.createElement('dialog');
  const audio = scratchSound();
  dialog.className = 'scratch-dialog';
  dialog.setAttribute('aria-labelledby', 'scratchTitle');
  dialog.innerHTML = `
    <div class="scratch-top"><h2 id="scratchTitle">${t('Скретч с диджеем')}</h2><button type="button" data-sound aria-label="${t('Звук')}">♪</button>
      <button type="button" data-close aria-label="${t('Закрыть')}">×</button></div>
    <div class="scratch-lessons">${lessons.map((l,i) => `<button type="button" data-lesson="${i}"><span>${l.name}</span><small></small></button>`).join('')}</div>
    <p class="scratch-guide"></p>
    <div class="scratch-cues" aria-hidden="true"></div>
    <div class="scratch-decks">
      <button type="button" data-deck="0">${t('Левая')}</button>
      <button type="button" data-deck="1">${t('Правая')}</button>
    </div>
    <div class="scratch-consoles">${[0,1].map(i => `
      <div class="scratch-console" data-platter="${i}">
        <img class="scratch-base" src="${asset('base')}" alt="" draggable="false">
        <img class="scratch-disc" src="${asset('record')}" alt="" draggable="false">
        <img class="scratch-arm" src="${asset('arm')}" alt="" draggable="false">
        <button type="button" class="scratch-vinyl" aria-label="${t('Пластинка')} · ${t(i ? 'Правая' : 'Левая')}"><span></span></button>
        <i class="scratch-demo" aria-hidden="true"><b></b></i>
      </div>`).join('')}</div>
    <div class="scratch-status" aria-live="polite">
      <b class="scratch-arrow" aria-hidden="true"></b><p></p><output></output>
    </div>
    <button type="button" class="scratch-start"></button>
  `;
  const $ = s => dialog.querySelector(s);
  const selectors = [...dialog.querySelectorAll('[data-lesson]')], decks = [...dialog.querySelectorAll('[data-deck]')];
  const platters = [...dialog.querySelectorAll('.scratch-console')];
  const records = platters.map(plate => plate.querySelector('.scratch-disc'));
  const guide = $('.scratch-guide'), tips = $('.scratch-cues');
  const status = $('.scratch-status p'), symbol = $('.scratch-arrow'), score = $('.scratch-status output'), start = $('.scratch-start');
  const sound = $('[data-sound]');
  const spins = [0, 0], scores = lessons.map((_, i) => Number(best[i]) || 0);
  let muted = !savedSound(), stage = 0, deck = 0, run = null, pointer = null, frame = 0, flashUntil = 0, closed = false;
  let beatIndex = -4;

  const active = () => lessons[stage];
  const switchDeck = index => {
    if (pointer && index !== deck) release();
    deck = index;
    dialog.dataset.deck = String(index);
    decks.forEach((button, i) => {
      button.setAttribute('aria-pressed', String(i === index));
      platters[i].dataset.active = String(i === index);
    });
  };
  function showDirection(note) {
    symbol.textContent = note ? arrow(note) : '';
    return note > 0 ? t('По часовой') : t('Против часовой');
  }
  function clearFlash() {
    dialog.dataset.flash = '';
    flashUntil = 0;
  }
  function feedback(kind, text, now) {
    dialog.dataset.flash = kind;
    status.textContent = text;
    flashUntil = now + 430;
  }
  function paintCues() {
    const step = run?.step ?? 0;
    [...tips.children].forEach((dot, i) => {
      dot.dataset.state = run?.marks[i] || (i === step ? 'next' : '');
    });
    score.textContent = (run?.hits ?? scores[stage]) + ' / ' + active().notes.length;
  }
  function paintStages() {
    selectors.forEach((button, i) => {
      const locked = i > 0 && scores[i-1] < lessons[i-1].pass;
      button.disabled = locked;
      button.setAttribute('aria-pressed', String(stage === i));
      button.lastElementChild.textContent = locked ? '🔒' : scores[i] + ' / ' + lessons[i].notes.length;
    });
  }
  function paint() {
    dialog.dataset.mode = run ? (run.done ? 'done' : 'playing') : 'idle';
    dialog.dataset.stage = String(stage);
    guide.textContent = t(active().guide);
    start.textContent = run && !run.done ? t('Остановить') : run?.done ? t('Ещё раз') : t('Начать задание');
    decks.forEach(button => { button.disabled = Boolean(run && !run.done); });
    paintStages();
    tips.innerHTML = active().notes.map(note => `<span>${arrow(note)}</span>`).join('');
    paintCues();
    showDirection(0);
    if (!run) status.textContent = t('Прижми палец к дорожке и веди его по дуге.');
  }

  function release() {
    if (pointer?.wheel?.hasPointerCapture(pointer.id)) pointer.wheel.releasePointerCapture(pointer.id);
    pointer = null;
  }
  function reset() {
    cancelAnimationFrame(frame);
    release();
    run = null;
    clearFlash();
    dialog.dataset.hit = '';
    paint();
  }
  function finish() {
    run.done = true;
    if (run.hits > scores[stage]) {
      scores[stage] = run.hits;
      onBest(stage, run.hits);
    }
    dialog.dataset.hit = '';
    clearFlash();
    paint();
    status.textContent = run.hits >= active().pass ? t('Задание выполнено') : t('Попробуй ещё раз');
  }
  function advance(mark, now) {
    const step = run.step++;
    run.marks[step] = mark;
    if (pointer) pointer.travel = 0;
    if (mark === 'ok') run.hits++;
    if (run.step >= active().notes.length) { finish(); return; }
    const next = active().notes[run.step];
    switchDeck(deckOf(next));
    showDirection(next);
    paintCues();
    feedback(mark, mark === 'ok' ? t('В точку!') : t('Мимо бита'), now);
  }
  function tick(now) {
    if (!run || run.done) return;
    const {beat, window: tolerance, notes} = active();
    if (beat) {
      const position = (now - run.start) / beat;
      const clock = Math.floor(position + .005);
      if (clock > beatIndex) {
        beatIndex = clock;
        audio.beat(clock % 4 === 0 || clock < 0);
      }
      const before = Math.ceil(-position);
      const late = now - (run.start + run.step * beat);
      dialog.dataset.hit = before <= 0 && Math.abs(late) <= tolerance * .48 ? 'now' : '';
      if (before <= 0 && late > tolerance) advance('miss', now);
      if (run.done) return;
      if (before > 0) status.textContent = String(before);
    }
    if (flashUntil && now >= flashUntil) clearFlash();
    if (!flashUntil && (!beat || now >= run.start)) {
      const label = showDirection(notes[run.step]);
      status.textContent = label;
    }
    frame = requestAnimationFrame(tick);
  }
  function begin() {
    cancelAnimationFrame(frame);
    release();
    clearFlash();
    if (!muted) audio.wake();
    if (run && !run.done) { reset(); return; }
    const { notes, beat } = active();
    run = { step: 0, hits: 0, marks: [], start: performance.now() + (beat ? beat * 3 : 0) };
    beatIndex = -4;
    switchDeck(deckOf(notes[0]));
    paint();
    frame = requestAnimationFrame(tick);
  }
  function move(i, delta, elapsed, now) {
    spins[i] = (spins[i] + delta) % TAU;
    records[i].style.rotate = spins[i] + 'rad';
    onMotion(i, delta);
    if (!muted) audio.drag(delta, elapsed, i);
    if (!run || run.done) return;
    const {notes, beat, window: tolerance} = active(), note = notes[run.step];
    if (beat && now < run.start && run.start - now > tolerance) return;
    pointer.travel += delta;
    if (Math.abs(pointer.travel) < SWIPE) return;
    const direction = Math.sign(pointer.travel);
    pointer.travel = 0;
    if (i !== deckOf(note)) {
      feedback('miss', t('Другая вертушка'), now);
      return;
    }
    if (direction !== Math.sign(note)) {
      feedback('miss', t('В другую сторону'), now);
      return;
    }
    if (beat) {
      const error = now - (run.start + run.step * beat);
      if (Math.abs(error) > tolerance) {
        feedback('miss', error < 0 ? t('Рано — дождись вспышки') : t('Поздно'), now);
        return;
      }
    }
    advance('ok', now);
  }
  const read = (e, wheel) => {
    const box = wheel.getBoundingClientRect();
    const x = (e.clientX - box.left) / box.width - .5;
    const y = (e.clientY - box.top) / box.height - .5;
    return { angle: Math.atan2(y, x), radius: Math.hypot(x, y) };
  };
  platters.forEach((platter, i) => {
    const wheel = platter.querySelector('.scratch-vinyl');
    wheel.onpointerdown = e => {
      if (pointer || e.button !== 0) return;
      const {angle, radius} = read(e, wheel);
      if (radius < .13 || radius > .51) return;
      if (!muted) audio.wake();
      pointer = { wheel, id: e.pointerId, angle, travel: 0, now: performance.now() };
      wheel.setPointerCapture(e.pointerId);
      e.preventDefault();
      dialog.classList.add('has-touched');
    };
    wheel.onpointermove = e => {
      if (pointer?.id !== e.pointerId) return;
      const {angle, radius} = read(e, wheel), now = performance.now();
      const delta = angleBetween(pointer.angle, angle), elapsed = now - pointer.now;
      pointer.angle = angle;
      pointer.now = now;
      if (radius < .10 || radius > .68 || Math.abs(delta) > 1.18) {
        pointer.travel = 0;
        return;
      }
      if (Math.abs(delta) > .006) move(i, delta, elapsed, now);
    };
    wheel.onpointerup = wheel.onpointercancel = wheel.onlostpointercapture = e => {
      if (pointer?.id === e.pointerId) release();
    };
    wheel.onkeydown = e => {
      if (pointer || e.repeat || !['ArrowLeft','ArrowRight'].includes(e.key)) return;
      e.preventDefault();
      dialog.classList.add('has-touched');
      if (!muted) audio.wake();
      pointer = { travel: 0 };
      move(i, e.key === 'ArrowRight' ? SWIPE : -SWIPE, 26, performance.now());
      pointer = null;
    };
  });

  selectors.forEach((button, i) => { button.onclick = () => { stage = i; switchDeck(0); reset(); }; });
  decks.forEach((button, i) => { button.onclick = () => switchDeck(i); });
  function displaySound() {
    sound.setAttribute('aria-pressed', String(!muted));
    sound.textContent = muted ? '♪̸' : '♪';
  }
  sound.onclick = () => {
    muted = !muted;
    if (!muted) audio.wake();
    audio.mute(muted);
    try { localStorage.setItem('fedoskin-scratch-sound', muted ? '0' : '1'); } catch (_) {}
    displaySound();
  };
  start.onclick = begin;
  dialog.addEventListener('close', () => {
    if (closed) return;
    closed = true;
    cancelAnimationFrame(frame);
    release();
    audio.close();
    dialog.remove();
    onClose();
  });
  $('[data-close]').onclick = () => dialog.close();
  document.body.append(dialog);
  dialog.showModal();
  switchDeck(0);
  displaySound();
  paint();
}
