// Free tracing practice and three-round power-only contests on the yard floor.
const _t = window._t;
const ROUNDS = 3;
const READY = 'Breakdance_Ready';
const roundScore = n => Math.round(n * 10) / 10;

export function initPowerModes({ W, PM, wheel, playMusic, sfx, fallStart, fallTick, fallEnd, score, record, onEnd }) {
  const find = id => document.getElementById(id);
  const hud = find('g3bt'), header = find('g3turn'), result = find('g3res'), leave = find('g3modeExit');
  let run;

  function frame(spot) {
    W.camT = { x: spot.x, z: spot.z + .3, zoom: .42 };
    W.camSnap = true;
  }

  function start(spot, options, opponent = null, practice = null) {
    const H = W.hero, home = { x: H.root.position.x, z: H.root.position.z, facing: H.root.rotation.y };
    run = { spot, home, options, opponent, practice, form: practice?.form, move: practice?.move, rounds: [] };
    W.lock = true;
    document.body.classList.add('g3fight');
    hud.classList.add('on');
    find('g3skip').style.display = 'none';
    find('g3sc').style.display = opponent ? '' : 'none';
    find('g3mv').textContent = '';
    result.style.setProperty('--oc', '#FFAE5D');
    leave.hidden = false;
    frame(spot);
    if (opponent) {
      opponent.root.visible = true;
      opponent.root.position.set(spot.x, 0, spot.z - 1.9);
      opponent.play(READY, { fade: .18 });
      find('g3on').textContent = _t('Вихрь').toUpperCase();
      hud.style.setProperty('--oc', '#FFAE5D');
      playMusic?.('ring');
    }
    begin();
  }

  function wait(seconds, next) {
    run.delay = seconds;
    run.next = next;
  }

  function walkTo(J, x, z, facing) {
    W.walk.start(J);
    J.powerWalk = { x, z, facing, time: 0 };
  }

  function walkTick(J, dt) {
    const move = J.powerWalk;
    if (!move) return;
    move.time += dt;
    const k = Math.min(1, move.time / .75);
    W.walk.move(J, dt, move.x, move.z, k * k * (3 - 2 * k), move.facing);
    if (k === 1) { J.ws = null; J.powerWalk = null; }
  }

  function totals() {
    const sum = key => roundScore(run.rounds.reduce((n, r) => n + (r[key]?.points || 0), 0));
    return { me: sum('me'), them: sum('them') };
  }

  function showScore() {
    const { me, them } = totals();
    find('g3a').textContent = me;
    find('g3b').textContent = them;
  }

  function begin() {
    result.classList.remove('on');
    const { spot, opponent } = run;
    const H = W.hero;
    header.textContent = opponent
      ? _t('Пауэрмув-контест · раунд {n}/{x}', { n: run.rounds.length + 1, x: ROUNDS })
      : _t(run.form ? 'Тренировка формы' : 'Тренировка пауэрмувов');
    find('g3mv').textContent = '';
    frame(spot);
    walkTo(H, spot.x, spot.z, 0);
    if (opponent) {
      if (opponent.fall) fallEnd(opponent);
      walkTo(opponent, spot.x, spot.z - 1.9, 0);
    }
    showScore();
    wait(.8, run.practice ? () => trace(run.move) : chooseMove);
  }

  function chooseMove() {
    const { options, move } = run;
    W.hero.play(READY, { fade: .2 });
    wheel.open(options, null, move, trace, exit);
  }

  function prepare(J, move, next) {
    if (!move.pre) { next(); return; }
    J.play(move.pre, { at: 1, fade: .22 });
    wait(1.35, next);
  }

  function trace(move) {
    const H = W.hero;
    run.move = move;
    result.classList.remove('on');
    find('g3mv').textContent = '';
    leave.hidden = false;
    prepare(H, move, () => {
      if (H.fall) fallEnd(H);
      H.play(move.c, { fade: .22 });
      PM.arm(H, move, { wait: run.opponent ? 10 : Infinity, required: true, practice: Boolean(run.practice), onEnd: finishTrace });
    });
  }

  function grade(res) {
    if (res.reason === 'cancel') return _t('Попытка отменена');
    if (res.reason === 'no-start' || res.grade === 'auto') return _t('Попытка не начата');
    if (res.grade === 'perfect') return _t('ИДЕАЛЬНО');
    if (res.grade === 'good') return _t('ЧИСТО');
    return _t('СРЫВ');
  }

  function detail(res) {
    if (res.reason === 'cancel') return _t('Энергия не списана');
    if (res.reason === 'off-track') return _t('Выход за линию');
    if (res.reason === 'stall') return _t('Веди палец без остановки');
    if (res.reason === 'time') return _t('Время вышло');
    if (res.reason === 'release') return _t(run.opponent ? 'Сначала сделай полный оборот' : 'Обведи контур до конца, не отрывая палец');
    if (res.grade === 'auto' || res.reason === 'no-start') return _t('Начни с жёлтой точки и веди по стрелкам');
    return _t('Точность {n}%', { n: Math.round((res.acc || 0) * 100) });
  }

  function finishTrace(res) {
    const H = W.hero, missed = res.grade === 'miss';
    const award = run.practice && res.turns === 1 && (res.grade === 'good' || res.grade === 'perfect')
      ? run.practice.finish(run.move, res, run.form) : null;
    if (missed && res.reason !== 'no-start' && res.reason !== 'cancel') { fallStart(H); sfx('crash'); }
    else if (!missed && res.grade !== 'auto') sfx(res.grade === 'perfect' ? 'perfect' : 'hit');
    wait(H.fall ? 1.7 : .65, () => {
      if (H.fall) fallEnd(H);
      H.play(READY, { fade: .25 });
      if (!run.opponent) { practiceResult(res, award); return; }
      const round = { move: run.move, me: { ...res, points: score(run.move, res) } };
      run.rounds.push(round);
      showScore();
      opponentTurn(round);
    });
  }

  function opponentTurn(round) {
    const { opponent, spot } = run;
    const H = W.hero;
    header.textContent = _t('Вихрь · раунд {n}/{x}', { n: run.rounds.length, x: ROUNDS });
    const roll = Math.random();
    const res = { grade: roll < .13 ? 'miss' : roll < .43 ? 'perfect' : 'good', turns: 1 + Math.floor(Math.random() * 3) };
    if (res.grade === 'miss') res.turns = 0;
    round.them = { ...res, points: score(round.move, res) };
    frame(spot);
    walkTo(H, spot.x, spot.z + 1.9, Math.PI);
    walkTo(opponent, spot.x, spot.z, 0);
    wait(.8, () => prepare(opponent, round.move, () => {
      run.animate = PM.demonstration(opponent, round.move, res.turns || .58);
    }));
  }

  function finishOpponent() {
    run.animate = null;
    const opponent = run.opponent;
    const round = run.rounds.at(-1);
    if (round.them.grade === 'miss') { fallStart(opponent); sfx('crash'); }
    else { opponent.play(READY, { fade: .3 }); sfx('hit'); }
    showScore();
    find('g3mv').textContent = round.move.nm + ' · +' + round.them.points;
    wait(opponent.fall ? 1.75 : .9, run.rounds.length === ROUNDS ? contestResult : begin);
  }

  function showResult(title, body, actions) {
    leave.hidden = true;
    result.innerHTML = `<h3>${title}</h3>${body}
      ${actions.map(([label], i) => `<button type="button" data-mode-action="${i}" class="${i ? 'sec' : ''}">${label}</button>`).join('')}`;
    for (const [i, [, handler]] of actions.entries()) result.querySelector(`[data-mode-action="${i}"]`).onclick = handler;
    result.classList.add('on');
  }

  function practiceResult(res, award) {
    const form = award?.form ? `<p>${award.form} · −${award.cost} ⚡</p>` : award?.unavailable ? `<p>${_t('Форма недоступна. Энергия не списана.')}</p>` : '';
    const best = award ? `<p>${_t('Рекорд {n}%', { n: award.best })}</p>` : '';
    const paidResult = run.form && award;
    showResult(grade(res), `<p>${run.move.nm}</p><p>${detail(res)}</p>${best}${form}`, [
      [_t(paidResult ? 'Повторить бесплатно' : 'Повторить'), () => {
        if (paidResult) run.form = false;
        header.textContent = _t(run.form ? 'Тренировка формы' : 'Тренировка пауэрмувов');
        trace(run.move);
      }],
      [_t('Другой элемент'), () => { const choose = run.practice.choose; exit(); choose(); }], [_t('В город'), exit],
    ]);
  }

  function contestResult() {
    const { me, them } = totals(), won = me > them;
    const best = record(me, won);
    if (won) sfx('win'); else if (me < them) sfx('lose');
    const rounds = run.rounds.map((r, i) => `<p>${i + 1}. ${r.move.nm} · ${r.me.points} : ${r.them.points}</p>`).join('');
    showResult(_t(won ? 'ПОБЕДА!' : me === them ? 'НИЧЬЯ' : 'ПОРАЖЕНИЕ'),
      `<p>${_t('Ты {a} : {b} Вихрь', { a: me, b: them })}</p>${rounds}<p>${_t('Твой рекорд: {n} очк.', { n: best })}</p>`,
      [[_t('Новый контест'), () => { run.rounds = []; leave.hidden = false; begin(); }], [_t('В город'), exit]]);
  }

  function exit() {
    if (!run) return;
    PM.cancel();
    wheel.close();
    const H = W.hero;
    for (const J of [H, run.opponent].filter(Boolean)) {
      J.powerWalk = J.ws = null;
      if (J.fall) fallEnd(J);
      J.play(READY, { fade: .25 });
    }
    if (run.opponent) { run.opponent.root.visible = false; playMusic?.(null); }
    const { x, z, facing } = run.home;
    H.root.position.set(x, 0, z);
    H.root.rotation.y = H.st.face = facing;
    H.st.tgt = null;
    H.st.vx = H.st.vz = H.st.wk = 0;
    leave.hidden = true;
    hud.classList.remove('on');
    result.classList.remove('on');
    find('g3sc').style.display = '';
    find('g3mv').textContent = '';
    run = null;
    onEnd();
  }

  function tick(dt) {
    const H = W.hero, opponent = run.opponent;
    if (run.next) {
      run.delay -= dt;
      if (run.delay <= 0) {
        const next = run.next; run.next = null;
        next();
      }
    }
    if (run.animate?.(dt)) finishOpponent();
    PM.tick(dt);
    for (const J of [H, opponent].filter(Boolean)) {
      walkTick(J, dt);
      if (J.fall) fallTick(J, dt, false);
      J.tick(dt);
      if (J.ws) W.walk.pose(J, dt);
    }
  }

  leave.onclick = exit;
  addEventListener('keydown', event => { if (event.key === 'Escape' && run?.practice) exit(); });
  return { start, tick };
}
