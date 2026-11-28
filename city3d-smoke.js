// Seven to Smoke: eight breakers, winner stays, loser goes to the back.
import { beatEntry, samplePhrase } from './city3d-breaking.js?v=6';
const t = window._t;
export const SMOKE_TARGET = 7;
export const SMOKE_TIME = 4 * 60;
const SIGNAL = .36, APPROACH = 1.22, WALK_BACK = .85;
const READY = 'Breakdance_Ready';
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

export function exhibitionClock(show, beat) {
  const halfBeat = 30 / show.bpm;
  const approach = beatEntry(APPROACH, show.bpm, beat);
  const half = Math.ceil((APPROACH + halfBeat + show.time + SIGNAL + WALK_BACK) / halfBeat) * halfBeat;
  return { half, approach, danceEnd: approach + show.time, time: half * 2 };
}

export function smokeStandings(state) {
  return Object.entries(state.points).sort((a, b) => b[1] - a[1] || Number(b[0] === state.champion) - Number(a[0] === state.champion));
}

export function scoreSmoke(state, winner, timedOut) {
  const [holder, challenger, ...waiting] = state.line;
  if (winner !== holder && winner !== challenger) throw new Error('Winner must be on the floor');
  const loser = winner === holder ? challenger : holder;
  if (state.overtime) {
    state.line = [winner, ...waiting];
    if (!waiting.length) state.champion = winner;
    return;
  }

  state.points[winner]++;
  state.line = [winner, ...waiting, loser];
  if (state.points[winner] === SMOKE_TARGET) {
    state.champion = winner;
  } else if (timedOut) {
    const high = Math.max(...Object.values(state.points));
    const leaders = state.line.filter(id => state.points[id] === high);
    if (leaders.length === 1) state.champion = leaders[0];
    else { state.line = leaders; state.overtime = true; }
  }
}

const CSS = `
#g3smoke{position:fixed;left:50%;transform:translateX(-50%);top:calc(max(10px,env(safe-area-inset-top)) + 46px);z-index:7;pointer-events:none;width:min(364px,calc(100% - 22px));color:#f4e7cc;font:700 13px/1.24 Inter,sans-serif}
#g3smokeClock,#g3smokeMatch{background:#121c21ed;border:1px solid #96826678;border-radius:14px;text-align:center;padding:7px 12px}
#g3smokeClock{display:flex;align-items:center;justify-content:space-between;gap:10px;color:#ffdfa4;font-variant-numeric:tabular-nums}
#g3smokeClock b{font:400 20px Anton,Inter,sans-serif;white-space:nowrap}
#g3smokeMatch{margin-top:5px;min-height:34px;display:grid;place-items:center}
#g3smokeMatch[hidden]{display:none}
#g3smokeLine{position:fixed;z-index:7;pointer-events:none;bottom:calc(69px + env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);width:min(364px,calc(100% - 30px));background:#121c21ed;color:#e8d5b3;padding:9px 12px;border:1px solid #96826678;border-radius:13px;box-sizing:border-box;text-align:center;font:600 12px/1.38 Inter,sans-serif}
#g3smoke[data-player]{top:calc(max(10px,env(safe-area-inset-top)) + 128px);width:min(230px,80%)}
#g3smoke[data-player] #g3smokeClock{padding:4px 8px;font-size:11px}
#g3smoke[data-player] #g3smokeClock b{font-size:13px}
body:has(#g3wheel[open]) #g3smoke,body.g3rep #g3smoke,body.g3draw #g3smoke,#g3smoke[hidden]{display:none}
#g3smokeActions{position:fixed;z-index:8;left:12px;right:12px;bottom:calc(16px + env(safe-area-inset-bottom));display:flex;justify-content:space-between;gap:8px;pointer-events:none}
#g3smokeActions button{pointer-events:auto;min-height:43px;border:1px solid #998060a8;background:#151e22f5;color:#f4e7cc;border-radius:22px;padding:7px 13px;font:700 12px/1.2 Inter,sans-serif}
#g3smokeActions #g3smokeSkip{color:#181e1c;background:#f1c478;border-color:#f1c478}
#g3smokeActions[hidden],body:has(#g3wheel[open]) #g3smokeActions,body.g3rep #g3smokeActions{display:none}
#g3res .smoke-table{display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;margin:12px 0 8px;text-align:left;font:600 13px/1.3 Inter,sans-serif}
#g3res .smoke-table div{display:flex;justify-content:space-between;gap:5px;padding:4px 0;border-bottom:1px solid #fff2}
#g3res .smoke-table .champ{color:#ffd383}
#g3res.smoke-result{box-sizing:border-box;max-height:84dvh;overflow:auto;touch-action:pan-y}
`;

export function initSmoke({ W, clipLen, currentBeat, playPlayer, cancelPlayer, preview, playMusic, record, end, sfx }) {
  const club = W.club;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const ui = document.createElement('div');
  ui.innerHTML = `<div id="g3smoke" hidden><div id="g3smokeClock"><span>7 TO SMOKE</span><b></b><span></span></div><div id="g3smokeMatch"></div></div>
    <div id="g3smokeLine" hidden></div><div id="g3smokeActions" hidden>
      <button type="button" id="g3smokeExit">${t('В город')}</button><button type="button" id="g3smokeSkip" hidden>${t('До моего выхода')}</button></div>`;
  document.body.appendChild(ui);
  const get = id => document.getElementById(id);
  const hud = get('g3smoke'), clock = get('g3smokeClock'), match = get('g3smokeMatch'), queue = get('g3smokeLine');
  const [ , time, count] = clock.children;
  const actions = get('g3smokeActions'), skip = get('g3smokeSkip');
  const scoreboard = get('g3res');
  let run, guestDancer;

  function camera() {
    W.camT = { x: club.floor.x, z: club.floor.z + .4, zoom: 1.15 };
    W.camSnap = true;
  }
  function start(track) {
    const J = W.hero;
    const hero = { id: 'me', J, name: t('ТЫ'), col: '#ffcb7a' };
    const entries = new Map([hero, ...club.dancers].map(p => [p.id, p]));
    const [first, ...others] = club.dancers;
    // An immediate first duel teaches the rotation, then the actual queue takes over.
    const line = [first.id, hero.id, ...others.map(p => p.id)];
    run = { entries, line, track, points: Object.fromEntries(line.map(id => [id, 0])), left: SMOKE_TIME, walks: [], phase: 'entry',
      home: { x: J.root.position.x, z: J.root.position.z, yaw: J.root.rotation.y } };
    W.lock = true;
    document.body.classList.add('g3fight');
    hud.hidden = actions.hidden = false;
    playMusic(track);
    club.board(first.name, 0);
    arrange();
    paint();
  }
  function move(J, at) {
    W.walk.start(J);
    run.walks.push({ J, at });
  }
  function arrange() {
    club.hideVotes();
    run.phase = 'entry';
    run.delay = .78;
    run.walks = [];
    camera();
    const [holder, challenger, ...waiting] = run.line;
    const hero = run.entries.get('me').J;
    const heroInside = holder === 'me' || challenger === 'me';
    const active = heroInside ? [holder === 'me' ? challenger : holder, 'me'] : [holder, challenger];
    active.forEach((id, i) => move(run.entries.get(id).J, club.duelSpots[i]));
    const standby = [...waiting, ...[...run.entries.keys()].filter(id => !run.line.includes(id))];
    standby.forEach((id, i) => move(run.entries.get(id).J, club.slots[i]));
    if (!heroInside && !standby.includes('me')) move(hero, run.home);
  }
  function playerInside() {
    return run.line[0] === 'me' || run.line[1] === 'me';
  }
  const label = id => run.entries.get(id).name;
  function paint() {
    const player = run.phase === 'player';
    const seconds = Math.ceil(run.left);
    time.textContent = run.overtime ? t('Тай-брейк') : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    count.textContent = t('Ты · {n}/7', { n: run.points.me });
    hud.toggleAttribute('data-player', player);
    match.hidden = queue.hidden = player;
    if (!player) {
      const [leader, next, ...waiting] = run.line;
      match.textContent = run.phase === 'decision'
        ? t('{x} берёт дуэль', { x: label(run.winner) }) + ' · ' + run.voteCount + ':' + (3 - run.voteCount)
        : `${label(leader)} ${run.points[leader]}  /  ${run.points[next]} ${label(next)}`;
      queue.textContent = t('Очередь: {x}', { x: waiting.map(label).join(' · ') || '—' });
      queue.hidden = !waiting.length;
    }
    skip.hidden = run.phase !== 'watch' || !run.line.includes('me');
  }
  function openDuel() {
    if (playerInside()) {
      run.phase = 'player';
      const opponent = run.entries.get(run.line[0] === 'me' ? run.line[1] : run.line[0]);
      opponent.J.home = club.duelSpots[0];
      playPlayer(opponent, run.track, run.line[0] === 'me');
    } else {
      run.phase = 'watch';
      run.duel = createBotDuel();
      run.delay = run.duel.time;
      W.camT.zoom = .84;
    }
    paint();
  }
  function createBotDuel() {
    const [a, b] = run.line, first = preview(run.entries.get(a), run.track, run.lastExhibition);
    const second = preview(run.entries.get(b), run.track, first);
    run.lastExhibition = second;
    const quality = id => run.entries.get(id).lv * .2 + Math.random() * 1.8;
    const margin = quality(a) - quality(b);
    const [winner, loser] = margin >= 0 ? [a, b] : [b, a];
    const votes = [winner, winner, winner];
    if (Math.abs(margin) < .88) votes[Math.floor(Math.random() * 3)] = loser;
    // The phase changes the pickup. Viewing and skipping spend the same fixed budget.
    const clock = exhibitionClock(first, currentBeat());
    return { ids: [a, b], shows: [first, second], winner, votes, ...clock, slot: -1, step: -1, stage: null };
  }
  function finishPreview(dt) {
    const { ids, slot } = run.duel;
    if (slot < 0) return;
    const J = run.entries.get(ids[slot]).J, home = club.duelSpots[slot];
    if (J.ws) W.walk.move(J, dt, home.x, home.z, 1, home.yaw);
    J.ws = null;
    J.play(J.idle, { fade: .20 });
  }
  function dancePreview(dt) {
    const duel = run.duel, used = duel.time - run.delay;
    const { half, approach, danceEnd } = duel;
    const side = Math.min(1, Math.floor(used / half)), now = used - side * half;
    const J = run.entries.get(duel.ids[side]).J, home = club.duelSpots[side], show = duel.shows[side];
    if (side !== duel.slot) {
      finishPreview(dt);
      duel.slot = side;
      duel.step = -1;
      duel.stage = null;
    }
    const start = show.pre ? SIGNAL : 0, leave = show.post ? danceEnd + SIGNAL : danceEnd;
    const stage = now < start ? 'before' : now < approach ? 'approach' : now < danceEnd ? 'dance' : now < leave ? 'after' : 'leave';
    if (stage !== duel.stage) {
      const before = duel.stage;
      duel.stage = stage;
      if (stage === 'before') J.play(show.pre, { fade: .13, speed: clipLen(show.pre) / SIGNAL });
      if (stage === 'approach' || stage === 'leave') W.walk.start(J);
      if (before === 'approach') J.ws = null;
      if (stage === 'after') J.play(show.post, { fade: .14, speed: clipLen(show.post) / SIGNAL });
    }
    const weight = (from, to) => clamp((now - from) / (to - from), 0, 1);
    if (stage === 'approach') {
      const x = club.floor.x + (home.x - club.floor.x) * .13, z = club.floor.z + (home.z - club.floor.z) * .13;
      W.walk.move(J, dt, x, z, weight(start, approach), home.yaw);
    } else if (stage === 'leave') W.walk.move(J, dt, home.x, home.z, weight(leave, half), home.yaw);
    else if (stage === 'dance') {
      const i = show.steps.findIndex(step => now - approach < step.b);
      const step = show.steps[i];
      if (step) {
        if (i !== duel.step) J.play(step.c, { at: step.at, speed: step.sp, fade: .18 });
        samplePhrase(J, step, now - approach - (show.steps[i-1]?.b || 0));
      }
      duel.step = i;
      guestDancer = step ? J : null;
    }
  }
  function verdict(winner, votes) {
    if (run.phase === 'watch') finishPreview(0);
    run.winner = winner;
    run.voteCount = votes.filter(vote => vote === winner).length;
    run.phase = 'decision';
    run.delay = 1.65;
    W.camT = { x: club.floor.x, z: club.floor.z - 1.75, zoom: .73 };
    W.camSnap = true;
    club.showVotes(votes.map(id => run.entries.get(id)));
    paint();
  }
  function settle(winner) {
    scoreSmoke(run, winner, run.left <= 0);
    const leader = run.champion || run.line[0];
    club.board(label(leader), run.points[leader]);
    if (run.champion) result();
    else { arrange(); paint(); }
  }
  function result() {
    club.hideVotes();
    run.phase = 'result';
    hud.hidden = queue.hidden = actions.hidden = true;
    const won = run.champion === 'me';
    const bonus = record(run.points.me, won);
    sfx(won ? 'win' : 'lose');
    const standings = smokeStandings(run);
    const rows = standings.map(([id, points]) => `<div${id === run.champion ? ' class="champ"' : ''}><span>${label(id)}</span><b>${points}</b></div>`).join('');
    scoreboard.innerHTML = `<h3 class="${won ? 'w' : ''}">${won ? t('ПОБЕДА!') : t('7 TO SMOKE')}</h3>
      <p>${t('Чемпион · {x}', { x: label(run.champion) })}</p>
      ${run.overtime ? `<p>${t('Решено в тай-брейке')}</p>` : ''}
      <div class="smoke-table">${rows}</div>
      ${bonus ? `<p class="rw">${t('+{n} ★ уважения', { n: bonus })}</p>` : ''}
      <button type="button" id="g3smokeDone">${t('В город')}</button>`;
    scoreboard.classList.add('on', 'smoke-result');
    get('g3smokeDone').onclick = exit;
  }
  function exit() {
    if (!run) return;
    cancelPlayer();
    club.hideVotes();
    const H = W.hero, { x, z, yaw } = run.home;
    H.root.position.set(x, 0, z); H.root.rotation.y = H.st.face = yaw;
    H.play(READY, { fade: .3 }); H.ws = null;
    club.dancers.forEach(({ J }) => {
      J.ws = null;
      J.root.position.set(J.clubRest.x, 0, J.clubRest.z);
      J.root.rotation.y = J.clubRest.yaw;
      J.play(READY, { fade: .3 });
    });
    if (!run.champion) club.board();
    run = null;
    scoreboard.classList.remove('on', 'smoke-result');
    hud.hidden = queue.hidden = actions.hidden = true;
    playMusic(null);
    end();
  }
  function tick(dt, battle, paused) {
    if (!run) {
      club.dancers.forEach(({ J }) => W.tickAmbient(J, dt));
      return;
    }
    guestDancer = null;
    const activeDt = run.phase === 'watch' ? Math.min(dt, run.delay) : dt;
    if (!run.overtime && !paused && (run.phase === 'watch' || run.phase === 'player')) run.left = Math.max(0, run.left - activeDt);
    if (run.phase === 'entry') {
      run.delay -= dt;
      const f = clamp(1 - run.delay / .78, 0, 1), k = f * f * (3 - 2 * f);
      run.walks.forEach(({ J, at }) => W.walk.move(J, dt, at.x, at.z, k, at.yaw));
      if (run.delay <= 0) {
        run.walks.forEach(({ J }) => { J.ws = null; });
        run.walks = [];
        openDuel();
      }
    } else if (run.phase === 'watch') {
      if (!paused) {
        run.delay -= activeDt;
        if (run.delay <= 0) verdict(run.duel.winner, run.duel.votes);
        else dancePreview(dt);
      }
    } else if (run.phase === 'decision') {
      run.delay -= dt;
      if (run.delay <= 0) settle(run.winner);
    }
    for (const { id, J } of run.entries.values()) {
      if (J === battle?.opp || (J === W.hero && run.phase === 'player')) continue;
      if (J === W.hero || J.ws || id === run.line[0] || id === run.line[1]) {
        J.tick(dt);
        if (J.ws) W.walk.pose(J, dt);
      } else W.tickAmbient(J, dt);
    }
    if (run.phase === 'player' || run.phase === 'watch') {
      const seconds = Math.ceil(run.left);
      if (run.seconds !== seconds) { run.seconds = seconds; paint(); }
    }
  }
  skip.onclick = () => {
    if (run?.phase !== 'watch') return;
    // The explicit fast-forward still completes the running actor's transition before rearranging the queue.
    finishPreview(0);
    while (!playerInside() && run.line.includes('me') && !run.champion) {
      if (!run.overtime) run.left = Math.max(0, run.left - run.delay);
      scoreSmoke(run, run.duel.winner, run.left <= 0);
      if (run.champion || playerInside()) break;
      run.duel = createBotDuel();
      run.delay = run.duel.time;
    }
    const leader = run.champion || run.line[0];
    club.board(label(leader), run.points[leader]);
    if (run.champion) result();
    else { arrange(); paint(); }
  };
  get('g3smokeExit').onclick = exit;
  return { start, tick, active: () => !!run, performer: () => run?.phase === 'watch' ? guestDancer : null, playerVerdict(votes) {
    const opponent = run.line[0] === 'me' ? run.line[1] : run.line[0];
    const choices = votes.map(vote => vote === 'me' ? 'me' : opponent);
    verdict(choices.filter(id => id === 'me').length >= 2 ? 'me' : opponent, choices);
  },
    probe: () => run && ({ phase: run.phase, left: run.left, line: [...run.line], points: { ...run.points }, overtime: run.overtime, exhibition: run.phase === 'watch' ? run.duel.stage : null }) };
}
