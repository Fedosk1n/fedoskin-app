import { ACTS, CAST, DECISIONS, EPISODES, MODE_GUIDES, MODE_NAMES, STORY_TURNS, VENUES, venueFor } from './city3d-campaign-data.js?v=1';
import { createPhrase, DIRECTIONS, displayNote, MOVES, pieceAt, postInput, phraseVerdict, recordDecision, recordPhrase, RUNNERS, TEMPOS } from './city3d-campaign-engine.js?v=1';
import { FESTIVAL_CSS } from './city3d-campaign-style.js?v=1';
import { examCourse, FESTIVAL_CHECKPOINTS, FESTIVAL_OFFICIAL, FESTIVAL_PRIZE, judgeFestivalExam } from './city3d-festival-exams.js?v=1';

const DIFFICULTY = { training: 'Медленный', normal: 'Обычный', quick: 'Быстрый' };
const REACTIONS = {
  clean: 'Чисто в музыку', variation: 'Своя вариация', lineup: 'Круг передан',
  copied: 'Нужна собственная связка', fit: 'Рисунок не подошёл', line: 'В очередь нужен другой танцор',
  miss: 'Сигнал пропущен', rest: 'Здесь оставь паузу', early: 'Дождись отметки',
};

const CLIPS = ['Breakdance_Uprock', 'Breakdance_Footwork_2', 'City_Backspin', 'Breakdance_Freeze_Var_4'];

function createPulse() {
  let audio, noise, nodes = new Set();
  function voice(context, source, when, duration, volume) {
    const gain = context.createGain();
    gain.gain.setValueAtTime(.001, when);
    gain.gain.exponentialRampToValueAtTime(volume, when + .007);
    gain.gain.exponentialRampToValueAtTime(.001, when + duration);
    source.connect(gain).connect(context.destination);
    source.start(when);
    source.stop(when + duration + .01);
    nodes.add(source);
    source.onended = () => nodes.delete(source);
  }
  function tone(context, when, type, start, end, duration, volume) {
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(start, when);
    osc.frequency.exponentialRampToValueAtTime(end, when + duration);
    voice(context, osc, when, duration, volume);
  }
  function percussion(context, when, cutoff, duration, volume) {
    if (!noise) {
      noise = context.createBuffer(1, Math.ceil(context.sampleRate * .22), context.sampleRate);
      const samples = noise.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    }
    const source = context.createBufferSource(), filter = context.createBiquadFilter();
    source.buffer = noise;
    filter.type = 'highpass'; filter.frequency.value = cutoff;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, when);
    gain.gain.exponentialRampToValueAtTime(.001, when + duration);
    source.connect(filter).connect(gain).connect(context.destination);
    source.start(when);
    source.stop(when + duration + .01);
    nodes.add(source);
    source.onended = () => nodes.delete(source);
  }
  return {
    async open() {
      if (localStorage.getItem('fedoskin-city-music') === '0') return null;
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return null;
      audio ||= new Audio();
      try { if (audio.state !== 'running') await audio.resume(); } catch (_) { return null; }
      return audio.state === 'running' ? audio : null;
    },
    beat(context, when, beat, period, course) {
      const slot = (beat % 4 + 4) % 4;
      const fill = beat >= 0 && beat % 32 >= 28;
      const pattern = (course.act + course.flavor) % 3;
      if (slot === 0 || (pattern !== 2 && slot === 2)) tone(context, when, 'sine', 145, 42, .16, .27);
      if (slot % 2 === 1) {
        percussion(context, when, 1100, .11, .135);
        tone(context, when, 'triangle', 177, 110, .07, .08);
      }
      percussion(context, when, 6300, .035, slot === 0 ? .069 : .047);
      if (!fill) {
        const pitches = [49, 55, 52, 65, 58, 46, 62, 73];
        const note = pitches[(course.flavor + pattern * 2 + Math.floor(beat / 4) + (slot === 2 ? 3 : 0) + 80) % pitches.length];
        if (slot % 2 === 0 || pattern === 2) tone(context, when + .026, 'triangle', note, note * .982, .22, .12);
        if (slot !== 3 || pattern === 1) percussion(context, when + period * .52, 6800, .042, .029);
      } else if (slot === 3) percussion(context, when + period * .5, 1800, .08, .09);
    },
    scratch(context, which) {
      if (!context) return;
      const when = context.currentTime + .003;
      tone(context, when, 'triangle', which % 2 ? 106 : 315, which % 2 ? 275 : 92, .095, .10);
      percussion(context, when, which < 2 ? 3200 : 1550, .065, .035);
    },
    stop() {
      for (const node of nodes) { try { node.stop(); } catch (_) {} }
      nodes = new Set();
    },
  };
}

export function initFestival({ t, W, D, places, colliders, state, eligible, save, travel, leaveVisit, openAllowed, lock, displaySet, tryPrize, prepareScene }) {
  const tag = document.createElement('style');
  tag.textContent = FESTIVAL_CSS;
  document.head.append(tag);
  const panel = document.createElement('section');
  panel.id = 'g3festival';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', t('Городской фестиваль'));
  document.body.append(panel);
  const pulse = createPulse();
  const ordinaryHud = ['#g3hud', '#g3hud2', '#g3act', '#g3storyNear', '#hint', '#ztip', '.hud']
    .map(selector => document.querySelector(selector)).filter(Boolean);
  let run = null, opening = false, atVenue = false, activeSheet = null, practice = null, frame = 0, frameView = -1;
  let previousDepth = null;
  let examRecord = null;
  const current = () => EPISODES[state.episode];
  const storyTurn = () => STORY_TURNS[state.episode];
  const needsArrival = () => Boolean(storyTurn()?.preparatory && !state.prepared);
  const location = () => needsArrival() ? VENUES[storyTurn().preparatory] : venueFor(current(), state.choices);
  const findAnchor = () => {
    const [district, id] = current() ? location() : venueFor(EPISODES.at(-1), state.choices);
    return district === D ? places.find(place => place.id === id) : null;
  };
  function getPoint() {
    if (!eligible()) return null;
    const spot = findAnchor();
    if (!spot) return null;
    const x = spot.x + (spot.x > 0 ? -.65 : .65), z = spot.z + .42;
    return { id: 'festival', x, z, r: 1.85 };
  }

  const $ = selector => panel.querySelector(selector);
  function button(id, label, secondary = false) {
    return `<button type="button" id="${id}"${secondary ? ' class="festival-secondary"' : ''}>${label}</button>`;
  }
  function setView(name, markup) {
    activeSheet = name;
    panel.hidden = false;
    panel.classList.toggle('playing', name === 'piece');
    for (const element of ordinaryHud) element.inert = name === 'piece';
    document.body.classList.toggle('festival-playing', name === 'piece');
    panel.innerHTML = `<div class="festival-inner">${markup}</div>`;
    panel.querySelector('.festival-inner').scrollTop = 0;
  }
  function close() {
    cancelAnimationFrame(frame);
    pulse.stop();
    window.cityMusic?.pause(false);
    opening = false;
    practice = run = activeSheet = null;
    panel.hidden = true;
    for (const element of ordinaryHud) element.inert = false;
    document.body.classList.remove('festival-playing');
    W.camT = previousDepth;
    previousDepth = null;
    lock(false);
  }
  const name = (episode, index) => `${index + 1}. ${t(episode.title)}`;
  function drawVenueMap(canvas) {
    const ctx = canvas.getContext('2d'), box = W.bounds, player = W.hero.root.position, point = getPoint();
    if (!point) return;
    const pad = 13, sx = x => pad + (x - box.x0) * (canvas.width - 2 * pad) / (box.x1 - box.x0);
    const sz = z => pad + (z - box.z0) * (canvas.height - 2 * pad) / (box.z1 - box.z0);
    ctx.fillStyle = '#141820';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#594e44';
    ctx.strokeRect(pad, pad, canvas.width - pad * 2, canvas.height - pad * 2);
    ctx.fillStyle = '#333b45';
    for (const p of colliders) {
      if (p.r != null) { ctx.beginPath(); ctx.arc(sx(p.x), sz(p.z), Math.max(2, sx(p.r) - sx(0)), 0, 2 * Math.PI); ctx.fill(); }
      else ctx.fillRect(sx(p.x0), sz(p.z0), sx(p.x1) - sx(p.x0), sz(p.z1) - sz(p.z0));
    }
    ctx.setLineDash([5, 5]); ctx.strokeStyle = '#d3ab78';
    ctx.beginPath(); ctx.moveTo(sx(player.x), sz(player.z)); ctx.lineTo(sx(point.x), sz(point.z)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#99dafa'; ctx.beginPath(); ctx.arc(sx(player.x), sz(player.z), 5, 0, 2 * Math.PI); ctx.fill();
    ctx.fillStyle = '#ffc679'; ctx.beginPath(); ctx.moveTo(sx(point.x) - 7, sz(point.z));
    ctx.lineTo(sx(point.x), sz(point.z) - 8); ctx.lineTo(sx(point.x) + 7, sz(point.z));
    ctx.lineTo(sx(point.x), sz(point.z) + 8); ctx.fill();
  }
  function chapterNotes() {
    const e = current(), act = ACTS[e.act];
    return `<h2>${t(act.title)}</h2><p>${t(act.intro)}</p>`;
  }
  function verdictPoster() {
    const results = Object.entries(DECISIONS).map(([id, rule]) => {
      const choice = rule.options.find(option => option.tag === state.choices[id]);
      return choice ? `<p><b>${t(choice.label)}</b><br>${t(choice.consequence)}</p>` : '';
    }).join('');
    return `<article class="festival-poster"><h3>${t('Афиша независимого фестиваля')}</h3>
      <img src="img/festival-main.webp?v=1" alt="${t('Открытые входы фестивального круга, настил и две вертушки.')}">
      ${results}
      <p>${t('В журнале остались сыгранные встречи, чистые фразы и собственные вариации. Районы снова собираются на площадке, которую подготовила команда.')}</p></article>`;
  }
  function route() {
    const e = current();
    const title = t('Городской фестиваль');
    const visits = `<p class="festival-counter">${t('Встречи · {n}/{all}', { n: state.episode, all: EPISODES.length })}</p>`;
    if (!e) {
      setView('route', `<header><h2>${title}</h2>${button('fClose', '×', true)}</header>${visits}${verdictPoster()}
        ${button('fExams', t('Судимые испытания и мифический комплект'))}
        ${leaveVisit ? button('fExit', t('Вернуться в обычный город'), true) : ''}${practiceView()}`);
    } else {
      const [district, , landmark, photo] = location();
      const ready = atVenue && district === D;
      const act = ACTS[e.act];
      const selected = Object.entries(DECISIONS).flatMap(([key, decision]) => {
        const earliest = { venue: 4, roster: 3, sound: 5 }[key];
        if (e.act < earliest) return [];
        const option = decision.options.find(item => item.tag === state.choices[key]);
        return option ? [`<p class="festival-payoff">${t(option.consequence)}</p>`] : [];
      }).join('');
      const navigation = district !== D ? button('fTravel', t('Поехать к площадке')) : ready ? button('fStart', t('Открыть встречу')) : button('fGo', t('Искать метку на карте'));
      setView('route', `<header><h2>${title}</h2>${button('fClose', '×', true)}</header>
        ${visits}<article class="festival-act" style="--act:${act.color}">${chapterNotes()}
        <h3>${name(e, state.episode)}</h3>
        <p class="festival-landmark">${t(landmark)} · ${t(CAST[e.speaker])}</p>
        ${needsArrival() ? `<p>${t(storyTurn().before)}</p>` : ''}
        <p>${t('Пьеса {n}/4 · пройдено {beat} из {all} ударов', { n: state.piece + 1, beat: state.beat, all: pieceAt(state.episode, state.piece, state.choices).beats })}</p>
        ${selected}
        <figure class="festival-tip"><img src="img/story-${photo}.webp?v=1" alt="${t('Ориентир района фестиваля')}">
          ${district === D ? `<canvas id="fMap" width="340" height="180" aria-label="${t('Карта · синяя точка — ты, золотой ромб — нужная встреча')}"></canvas>` : ''}
          <figcaption>${t(district === D ? 'Карта · синяя точка — ты, золотой ромб — нужная встреча' : 'Сюжетный маршрут ведёт к площадке встречи. Там ищи золотой ромб.')}</figcaption></figure>
        ${navigation}
        ${button('fExams', t('Подтверждение актов и судимые испытания'), true)}
        ${leaveVisit ? button('fExit', t('Вернуться в обычный город'), true) : ''}</article>${practiceView()}`);
      if ($('#fMap')) drawVenueMap($('#fMap'));
      if ($('#fTravel')) $('#fTravel').onclick = () => travel(district);
      if ($('#fGo')) $('#fGo').onclick = close;
      if ($('#fStart')) $('#fStart').onclick = enterVenue;
    }
    if ($('#fExit')) $('#fExit').onclick = leaveVisit;
    if ($('#fExams')) $('#fExams').onclick = () => examMenu(true);
    $('#fClose').setAttribute('aria-label', t('Закрыть журнал'));
    $('#fClose').onclick = close;
    if ($('#fPractice')) $('#fPractice').onclick = () => {
      practice = { episode: Number($('#fPracticeChoice').value), piece: Number($('#fPracticePiece').value) };
      briefing();
    };
  }
  async function examRequest(body) {
    const base = String(window.APP_CONFIG?.pushUrl || '').replace(/\/+$/, '');
    if (!base) throw new Error('unavailable');
    const check = await fetch(base + '/', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    const version = await check.json();
    if (!check.ok || version.service !== 'fedoskin-push' || version.version < 5) throw new Error('outdated');
    const profile = JSON.parse(localStorage.getItem('fedoskin-profile') || '{}');
    if (!/^\d{6,9}$/.test(profile.id || '')) {
      profile.id = String(100000 + crypto.getRandomValues(new Uint32Array(1))[0] % 900000);
      localStorage.setItem('fedoskin-profile', JSON.stringify(profile));
    }
    let secret = localStorage.getItem('fedoskin-lb-secret');
    if (!/^[a-f0-9]{32}$/.test(secret || '')) {
      secret = Array.from(crypto.getRandomValues(new Uint8Array(16)), x => x.toString(16).padStart(2, '0')).join('');
      localStorage.setItem('fedoskin-lb-secret', secret);
    }
    const answer = await fetch(base + '/hero/festival', { method: 'POST', headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ ...body, id: profile.id, secret }), signal: AbortSignal.timeout(10000) });
    const data = await answer.json();
    if (!answer.ok || !data.ok) throw new Error(data.error || 'unavailable');
    if (Array.isArray(data.owned)) localStorage.setItem('fedoskin-wardrobe-owned:' + profile.id, JSON.stringify(data.owned));
    return data;
  }
  function examError(error) { return t(error.message === 'outdated' ? 'Судимый зачёт откроется после обновления сервера.' : 'Судьи не получили результат. Попробуй ещё раз.'); }
  function examMenu(refresh = false) {
    const examined = examRecord?.passed || [], [district] = current() ? location() : venueFor(EPISODES.at(-1), state.choices);
    const routeCount = Array.from({ length: ACTS.length }, (_, act) => EPISODES.findLastIndex(ep => ep.act === act) + 1);
    setView('exams', `<header><h2>${t('Судимые испытания и мифический комплект')}</h2>${button('fBack', t('Назад'), true)}</header>
      <div class="festival-prizes"><img src="img/festival-prism.webp?v=1" alt="${t('Кроссовки «Грань круга» и шнурки «Световой рисунок»')}"></div>
      <p>${t('Кроссовки «Грань круга» и шнурки «Световой рисунок»')}</p>
      <p>${t('Для комплекта сыграй кампанию, подтверди восемь актов у судей, затем выиграй три отбора и финал. Офлайн-прогресс сохранится. Пропущенные контрольные можно сдать позже.')}</p>
      ${district !== D ? button('fTrialTravel', t('Поехать к площадке')) : ''}
      <div id="fExamNotice" role="status"></div>
      ${FESTIVAL_OFFICIAL.map((trial, index) => {
        const chapter = index < FESTIVAL_CHECKPOINTS.length ? index : ACTS.length - 1;
        const local = state.episode >= routeCount[chapter];
        const access = local && district === D && FESTIVAL_OFFICIAL.slice(0, index).every(prior => examined.includes(prior.id));
        return `<article class="festival-act"><h3>${examined.includes(trial.id) ? '✓ ' : ''}${t(trial.name)}</h3>
          <p>${t('Соперник · {x}', { x: t(trial.rival) })}</p>
          <p>${t('Минимум {p}% в музыку · чистых фраз {c} · вариаций и передач {v} · 2 из 3 голосов', { p: Math.round(trial.precision * 100), c: trial.clean, v: trial.variety })}</p>
          <button type="button" data-trial="${trial.id}" data-practice="1" class="festival-secondary"${district !== D || !local ? ' disabled' : ''}>${t('Тренировка')}</button>
          <button type="button" data-trial="${trial.id}"${!access ? ' disabled' : ''}>${t('Выступить перед судьями')}</button></article>`;
      }).join('')}`);
    $('#fBack').onclick = route;
    if ($('#fTrialTravel')) $('#fTrialTravel').onclick = () => travel(district);
    panel.querySelectorAll('[data-trial]').forEach(btn => { btn.onclick = () => examBrief(FESTIVAL_OFFICIAL.find(trial => trial.id === btn.dataset.trial), btn.dataset.practice === '1'); });
    if (refresh) examRequest({ action: 'status' }).then(data => {
      examRecord = data;
      if (activeSheet === 'exams') examMenu();
    }).catch(error => { if (activeSheet === 'exams') $('#fExamNotice').textContent = examError(error); });
  }
  function examBrief(spec, practiceOnly) {
    setView('examBrief', `<header><h2>${t(spec.name)}</h2>${button('fBack',t('Назад'),true)}</header>
      ${[...new Set(spec.modes)].map(mode => `<p><b>${t(MODE_NAMES[mode])}</b> · ${t(MODE_GUIDES[mode])}</p>`).join('')}
      <p>${t('Судьи сравнят с соперником попадание в музыку, чистые фразы и разные решения. Проход требует выполнить минимум и взять два голоса.')}</p>
      <label>${t('Темп')} <select id="fTempo">${Object.keys(TEMPOS).map(id =>
        `<option ${id === state.tempo ? 'selected' : ''} value="${id}">${t(DIFFICULTY[id])}</option>`).join('')}</select></label>
      <p id="fExamNotice" role="status"></p>${button('fPlay',t(practiceOnly ? 'Тренировка' : 'Выступить перед судьями'))}`);
    $('#fBack').onclick = () => examMenu();
    $('#fTempo').onchange = event => { state.tempo = event.target.value; save(); };
    $('#fPlay').onclick = async () => {
      if (opening) return;
      opening = true;
      try {
        const audio = await pulse.open();
        const trial = practiceOnly ? { seed: 81497, tempo: state.tempo } : await examRequest({ action: 'begin', exam: spec.id, tempo: state.tempo });
        if (activeSheet !== 'examBrief') return;
        const course = examCourse(spec, trial.seed, 0);
        startRun(course, audio, { beat: 0, beatAtStart: 0 }, { spec, practiceOnly, ...trial, inputs: [], phase: 0 });
      } catch (error) { if (activeSheet === 'examBrief') $('#fExamNotice').textContent = examError(error); }
      finally { opening = false; }
    };
  }
  function examResult(r) {
    pulse.stop(); window.cityMusic?.pause(false);
    const local = judgeFestivalExam(r.exam.spec, r.exam.seed, r.exam.tempo, r.exam.inputs);
    setView('examResult', `<header><h2>${t(r.exam.spec.name)}</h2>${button('fBack',t('Назад'),true)}</header><div id="fExamNotice" role="status"></div>`);
    $('#fBack').onclick = () => examMenu(true);
    const show = verdict => {
      if (activeSheet !== 'examResult') return;
      const votes = verdict?.votes.reduce((sum, vote) => sum + vote, 0) || 0;
      $('#fExamNotice').innerHTML = `<h3>${t(r.exam.practiceOnly ? 'Тренировка завершена' : verdict?.passed ? 'Судьи отдали тебе батл' : 'Судьи выбрали соперника')}</h3>
        <p>${t('В музыку {n}% · чистых фраз {c} · вариаций и передач {v} · судьи {votes}: {them}', { n: Math.round((verdict?.precision || 0) * 100), c: verdict?.clean || 0, v: verdict?.variety || 0, votes, them: 3 - votes })}</p>
        ${!r.exam.practiceOnly && !verdict?.passed ? `<p>${t('Соперник сохраняет место на афише. После тренировки можно встретиться с ним ещё раз.')}</p>` : ''}
        ${!r.exam.practiceOnly && verdict?.passed && r.exam.spec.id === 'final' ? button('fEquip', t('Примерить мифический комплект')) : ''}`;
      if ($('#fEquip')) $('#fEquip').onclick = () => tryPrize?.(FESTIVAL_PRIZE);
    };
    if (r.exam.practiceOnly) show(local);
    else {
      const submit = () => {
        $('#fSendProof')?.remove();
        examRequest({ action:'finish', exam:r.exam.spec.id, nonce:r.exam.nonce, inputs:r.exam.inputs })
          .then(data => { examRecord = data; show(data.verdict); })
          .catch(error => {
            if (activeSheet !== 'examResult') return;
            $('#fExamNotice').textContent = examError(error);
            if (error.message === 'restart') return;
            $('#fExamNotice').insertAdjacentHTML('afterend', button('fSendProof', t('Отправить результат ещё раз'), true));
            $('#fSendProof').onclick = submit;
          });
      };
      submit();
    }
  }
  function practiceView() {
    if (!state.piece && !state.beat && !state.episode) return '';
    const episodes = EPISODES.slice(0, Math.min(state.episode + 1, EPISODES.length)).map((e, index) =>
      `<option value="${index}"${index === Math.min(state.episode, EPISODES.length - 1) ? ' selected' : ''}>${name(e, index)}</option>`).join('');
    const pieces = [0, 1, 2, 3].map(n => `<option value="${n}">${t('Пьеса {n}', { n: n + 1 })}</option>`).join('');
    return `<details class="festival-practice"><summary>${t('Тренировка освоенной фразы')}</summary>
      <label>${t('Встреча')} <select id="fPracticeChoice">${episodes}</select></label>
      <label>${t('Пьеса')} <select id="fPracticePiece">${pieces}</select></label>
      ${button('fPractice',t('Выбрать фразу'),true)}</details>`;
  }
  function currentTarget() {
    const source = practice || state;
    return { episode: source.episode, piece: source.piece, beat: source.beat || 0 };
  }
  function enterVenue() {
    if (!needsArrival()) { briefing(); return; }
    setView('opening', `<header><h2>${name(current(), state.episode)}</h2>${button('fBack',t('Назад'),true)}</header>
      ${state.episode === 0 ? `<img class="festival-plate" src="img/festival-lost.webp?v=1" alt="${t('Ограда на подходе к площадке и свободный проход сбоку.')}">` : ''}
      ${state.episode === 24 ? `<img class="festival-plate" src="img/festival-rehearsal.webp?v=1" alt="${t('Две вертушки на рабочем пульте и проход для следующего танцора.')}">` : ''}
      <p><b>${t(CAST[current().speaker])}</b></p><p>${t(storyTurn().before)}</p>
      ${button('fConfirmLandmark',t('Сверить ориентир и продолжить'))}`);
    $('#fBack').onclick = route;
    $('#fConfirmLandmark').onclick = () => { state.prepared = true; save(); atVenue = false; route(); };
  }
  function briefing() {
    const key = currentTarget(), e = EPISODES[key.episode], course = pieceAt(key.episode, key.piece, state.choices);
    const decision = !practice && DECISIONS[e.decision];
    const pendingChoice = decision && !state.choices[e.decision];
    const liveUnlocked = key.episode < state.episode || key.episode === state.episode && key.piece <= state.piece;
    const maxPractice = key.episode < state.episode || key.piece < state.piece ? course.beats - 1 : state.beat;
    const practiceOptions = practice && liveUnlocked ? Array.from({ length: Math.floor(maxPractice / 16) + 1 }, (_, i) =>
      `<option value="${i * 16}">${t('Фраза {n}', { n: i + 1 })}</option>`).join('') : '';
    setView('briefing', `<header><h2>${name(e, key.episode)}</h2>${button('fBack',t('Назад'),true)}</header>
      ${!practice && key.piece === 0 && !key.beat && STORY_TURNS[key.episode] ? `<p class="festival-payoff">${t(STORY_TURNS[key.episode].before)}</p>` : ''}
      <p>${t(MODE_NAMES[course.mode])}</p><p>${t(MODE_GUIDES[course.mode])}</p>
      ${pendingChoice ? `<fieldset><legend>${t(decision.question)}</legend>
        ${decision.options.map(option => `<button type="button" data-f-choice="${option.tag}">${t(option.label)}</button>`).join('')}</fieldset>` : ''}
      <p>${t('Жёлтая рамка показывает текущий удар. Следующие знаки видны правее. На клавиатуре работают 1–4.')}</p>
      <label>${t('Темп')} <select id="fTempo">${Object.keys(TEMPOS).map(id =>
        `<option ${id === state.tempo ? 'selected' : ''} value="${id}">${t(DIFFICULTY[id])}</option>`).join('')}</select></label>
      ${practice ? practiceOptions ? `<label>${t('Фраза')} <select id="fPhrase">${practiceOptions}</select></label>`
        : `<p>${t('Сначала открой эту пьесу в сюжете.')}</p>` : ''}
      ${!pendingChoice && (!practice || practiceOptions) ? button('fPlay', t(practice ? 'Тренировать фразу' : 'Играть пьесу')) : ''}
      ${!practice && !pendingChoice && !key.beat ? button('fDemo', t('Попробовать одну фразу перед выступлением'), true) : ''}`);
    $('#fBack').onclick = () => { practice = null; route(); };
    $('#fTempo').onchange = event => { state.tempo = event.target.value; save(); };
    panel.querySelectorAll('[data-f-choice]').forEach(item => { item.onclick = () => {
      if (recordDecision(state, item.dataset.fChoice)) { save(); briefing(); }
    }; });
    if ($('#fDemo')) $('#fDemo').onclick = () => {
      practice = { ...key };
      start();
    };
    if ($('#fPlay')) $('#fPlay').onclick = () => {
      if (practice && $('#fPhrase')) practice.beat = Number($('#fPhrase').value);
      start();
    };
  }
  function courseView(course) {
    setView('piece', `<header><div><b>${t(MODE_NAMES[course.mode])}</b><small id="fLiveProgress"></small></div>
      ${button('fPause',t('Пауза'),true)}</header>
      <div id="fCues" aria-hidden="true"></div><div id="fPrompt"></div><div id="fPreview"></div>
      ${course.mode === 'd' ? `<div class="festival-decks" aria-hidden="true"><div data-deck="0"></div><div data-deck="1"></div></div>` : ''}
      <div id="fPads">${DIRECTIONS.map((label, index) => `<button type="button" data-pad="${index}">${label}</button>`).join('')}</div>
      <p id="fResponse" aria-live="polite"></p>`);
    $('#fPause').onclick = pause;
    panel.querySelectorAll('[data-pad]').forEach(item => {
      item.onpointerdown = event => { event.preventDefault(); press(Number(item.dataset.pad)); };
      item.onclick = event => { if (event.detail === 0) press(Number(item.dataset.pad)); };
    });
    panel.querySelectorAll('[data-deck]').forEach(disc => {
      let pointer = null, startAngle = 0;
      const angle = event => {
        const r = disc.getBoundingClientRect();
        return Math.atan2(event.clientY - r.y - r.height / 2, event.clientX - r.x - r.width / 2);
      };
      disc.onpointerdown = event => { pointer = event.pointerId; startAngle = angle(event); disc.setPointerCapture(pointer); };
      disc.onpointerup = () => { pointer = null; };
      disc.onpointercancel = () => { pointer = null; };
      disc.onpointermove = event => {
        if (pointer !== event.pointerId) return;
        const delta = angle(event) - startAngle, signed = Math.atan2(Math.sin(delta), Math.cos(delta));
        if (Math.abs(signed) < .5) return;
        pointer = null;
        press(Number(disc.dataset.deck) * 2 + Number(signed > 0));
      };
    });
  }
  function paintPiece(index, offset) {
    const r = run, phrase = r.phrase, event = displayNote(phrase, index);
    $('#fCues').style.setProperty('--beat-glow', String(Math.max(.14, 1 - Math.abs(offset) * 2)));
    if (index === frameView) return;
    frameView = index;
    const labels = event?.kind === 'cast' ? RUNNERS : event?.kind === 'build' || event?.kind === 'reply' ? MOVES : null;
    const decks = r.course.mode === 'd' ? [t('Левая') + ' ↶', t('Левая') + ' ↷', t('Правая') + ' ↶', t('Правая') + ' ↷'] : null;
    panel.querySelectorAll('[data-pad]').forEach((pad, i) => {
      pad.textContent = (labels ? t(labels[i]) : decks?.[i] || DIRECTIONS[i]);
    });
    panel.querySelectorAll('[data-deck]').forEach(disc => {
      disc.classList.toggle('active', event?.kind === 'deck' && Math.floor(event.note / 2) === Number(disc.dataset.deck));
    });
    const describe = item => item?.kind === 'reply' ? t('Соперник показывает {x}. Выбери другую связку.', { x: t(MOVES[item.rival]) })
      : item?.kind === 'build' ? t('Для этого выхода нужен {x}.', { x: t(MOVES[item.desired]) })
        : item?.kind === 'cast' ? t('Передай круг · {x}', { x: t(RUNNERS[item.favored]) }) : '';
    const text = describe(event) || (event?.kind === 'rest' ? t('Оставь паузу') : index < 0 ? t('Приготовься') : '');
    $('#fPrompt').textContent = text;
    const nextPhrase = r.nextPhrase;
    const future = Array.from({ length: 4 }, (_, i) => {
      const ordinal = index + i + 1;
      return ordinal < phrase.length ? displayNote(phrase, ordinal) : nextPhrase && displayNote(nextPhrase, ordinal - phrase.length);
    });
    const peek = future.find(item => describe(item));
    $('#fPreview').textContent = peek ? t('Далее · {x}', { x: describe(peek) }) : '';
    const rival = [event, ...future].find(item => item?.kind === 'reply');
    if (rival && rival !== r.rivalPreview) { r.rivalPreview = rival; displaySet?.(CLIPS[rival.rival], true); }
    const cue = i => {
      const item = displayNote(phrase, i);
      if (!item) return '·';
      if (item.kind === 'rest') return '—';
      if (item.kind === 'deck') return decks[item.note];
      if (item.kind === 'reply') return t(MOVES[item.rival]);
      if (item.kind === 'build') return t(MOVES[item.desired]);
      if (item.kind === 'cast') return t(RUNNERS[item.favored]);
      return DIRECTIONS[item.note];
    };
    $('#fCues').innerHTML = Array.from({ length: 5 }, (_, i) =>
      `<span class="${i === 1 ? 'now' : i === 0 ? 'past' : ''}">${cue(index + i - 1)}</span>`).join('');
    $('#fLiveProgress').textContent = t('Фраза {n} · {b}/{all}', { n: Math.floor(phrase.start / 16) + 1, b: Math.max(0, phrase.start + index + 1), all: r.course.beats });
  }
  function press(value) {
    if (!run) return;
    const relative = (run.now() - run.phraseStart) / run.period;
    const index = Math.round(relative);
    const item = displayNote(run.phrase, index);
    if (!item) return;
    if (run.exam && run.exam.inputs.length < 220) run.exam.inputs.push([Math.round((run.now() - run.epoch) * 1000), value]);
    const family = ['reply', 'build', 'cast'].includes(item.kind) ? 'choice' : run.course.mode === 'd' ? 'deck' : 'move';
    const reaction = postInput(run.phrase, relative, { family, value }, run.exam ? .31 : state.tempo === 'training' ? .43 : .34);
    if (reaction === 'repeat') return;
    $('#fResponse').textContent = t(REACTIONS[reaction]);
    if (reaction === 'clean' && run.course.mode === 'd') pulse.scratch(run.audio, value);
    if (reaction === 'clean' && index % 4 === 1) displaySet?.(CLIPS[value], false);
    if (reaction === 'variation' || reaction === 'lineup') displaySet?.(CLIPS[value], false, reaction === 'lineup' ? value : null);
  }
  function pause() {
    cancelAnimationFrame(frame);
    pulse.stop();
    window.cityMusic?.pause(false);
    const exam = run?.exam;
    run = null;
    if (exam) examBrief(exam.spec, exam.practiceOnly); else briefing();
  }
  function result(verdict, completed, previous) {
    pulse.stop();
    window.cityMusic?.pause(false);
    const trained = Boolean(practice);
    const advance = verdict.passed && !trained;
    setView('result', `<header><h2>${t(verdict.passed ? (completed ? 'Встреча сыграна' : 'Фраза сыграна') : 'Попробуй эту фразу ещё раз')}</h2>
      ${button('fClose', t('Закрыть журнал'), true)}</header>
      <p>${t('В музыку · {hits}/{total} · лишние сигналы {errors}', { hits: verdict.hits, total: verdict.required, errors: verdict.errors })}</p>
      ${verdict.variation ? `<p>${t('Свои вариации и передачи · {n}', { n: verdict.variation })}</p>` : ''}
      ${completed && STORY_TURNS[previous] ? `<p class="festival-payoff">${t(STORY_TURNS[previous].after)}</p>` : ''}
      ${button('fAgain',t(advance ? (completed ? 'Следующая встреча' : 'Продолжить') : 'К фразе'))}`);
    $('#fClose').onclick = close;
    $('#fAgain').onclick = () => {
      if (completed && advance) { atVenue = false; route(); }
      else briefing();
    };
  }
  function playFrame() {
    if (!run) return;
    const r = run, now = r.now();
    while (r.audio && r.epoch + r.cursor * r.period < now + .16) {
      const when = r.epoch + r.cursor * r.period;
      if (when >= now) pulse.beat(r.audio, when, r.cursor + r.key.beatAtStart, r.period, r.course);
      r.cursor++;
    }
    const offset = (now - r.phraseStart) / r.period;
    if (offset >= r.phrase.length - .45) {
      if (r.exam) {
        if (r.course.mode === 'r' && r.phrase.selections[0] != null) r.lastReply = r.phrase.selections[0];
        r.exam.phase++;
        if (r.exam.phase >= r.exam.spec.modes.length) { run = null; examResult(r); return; }
        r.phraseStart += r.period * r.phrase.length;
        r.course = examCourse(r.exam.spec, r.exam.seed, r.exam.phase);
        r.phrase = createPhrase(r.course, 0, { lastReply: r.lastReply });
        const following = r.exam.phase + 1;
        r.nextPhrase = following < r.exam.spec.modes.length ? createPhrase(examCourse(r.exam.spec,r.exam.seed,following),0,{}) : null;
        frameView = -2; courseView(r.course);
        frame = requestAnimationFrame(playFrame);
        return;
      }
      const verdict = phraseVerdict(r.phrase, state.tempo === 'training');
      const beat = r.phrase.start + r.phrase.length;
      const prior = state.episode;
      if (!practice && recordPhrase(state, verdict, beat, r.key)) save();
      const completed = state.episode !== prior;
      if (practice || !verdict.passed || beat >= r.course.beats) {
        run = null;
        result(verdict, completed, prior);
        return;
      }
      r.key.beat = beat;
      r.phraseStart += r.period * r.phrase.length;
      r.phrase = createPhrase(r.course, beat, { ...state.choices, lastReply: state.lastReply });
      const next = beat + r.phrase.length;
      r.nextPhrase = next < r.course.beats ? createPhrase(r.course, next, state.choices) : null;
      frameView = -2;
    }
    const adjusted = (now - r.phraseStart) / r.period;
    paintPiece(Math.round(adjusted), adjusted - Math.round(adjusted));
    frame = requestAnimationFrame(playFrame);
  }
  async function start() {
    if (opening || run) return;
    opening = true;
    const key = currentTarget(), course = pieceAt(key.episode, key.piece, state.choices);
    const audio = await pulse.open();
    if (!opening || panel.hidden) return;
    opening = false;
    startRun(course, audio, key);
  }
  function startRun(course, audio, key, exam = null) {
    window.cityMusic?.pause(true);
    const now = audio ? () => audio.currentTime : () => performance.now() / 1000;
    const period = 60 / (course.bpm * TEMPOS[exam?.tempo || state.tempo]);
    const epoch = now() + period * 2;
    key.beatAtStart = key.beat;
    run = { key, audio, now, course, period, epoch, phraseStart: epoch, cursor: -1, exam,
      phrase: createPhrase(course, key.beat, exam ? {} : { ...state.choices, lastReply: state.lastReply }) };
    const next = key.beat + run.phrase.length;
    run.nextPhrase = next < course.beats ? createPhrase(course, next, state.choices) : null;
    frameView = -3;
    const point = getPoint();
    if (point && (atVenue || exam)) {
      const act = EPISODES[key.episode]?.act ?? 7;
      W.camT = { x: point.x, z: point.z - .8, zoom: act >= 6 ? .79 : .52 };
      if (act >= 6 || exam) prepareScene?.(point, act, state.choices);
    }
    courseView(course);
    frame = requestAnimationFrame(playFrame);
  }
  function open(venue) {
    if (!eligible() || !openAllowed() || !panel.hidden) return;
    atVenue = venue;
    previousDepth = W.camT;
    lock(true);
    if (venue && current()) enterVenue(); else route();
  }
  addEventListener('keydown', event => {
    if (panel.hidden) return;
    if (event.key === 'Escape') { event.preventDefault(); if (run) pause(); else close(); }
    if (run && !event.repeat && /^[1-4]$/.test(event.key)) { event.preventDefault(); press(Number(event.key) - 1); }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && run) pause(); });
  return { open, close, target: getPoint, busy: () => !panel.hidden };
}
