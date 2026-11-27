// Start the soundtrack independently of the time needed to build the 3D scene.
(() => {
  const button = document.querySelector('#mus'), rb = window.RB;
  let saved, wanted = true;
  try {
    saved = JSON.parse(localStorage.getItem('fedoskin-city3d') || 'null');
    wanted = localStorage.getItem('fedoskin-city-music') !== '0';
  } catch (_) {}
  const requested = new URLSearchParams(location.search).get('d');
  const district = ['yard', 'center', 'park', 'club', 'prom'].includes(requested) ? requested : saved?.where;
  let background = district === 'club' ? (saved?.clubTrack === 1 ? 'club_floor' : 'club') : 'yard';
  let track = background, timer, stale = false, gestureSeen = false, stopped = false;
  const paint = () => {
    button.textContent = wanted ? '🎵' : '🔇';
    button.setAttribute('aria-pressed', String(wanted));
  };
  function play() {
    if (wanted && !stale && !stopped && !document.hidden && rb?.audioState() === 'running') rb.bgm(true, track);
  }
  function wake(gesture = false) {
    if (!rb || !wanted || stopped || document.hidden) return;
    if (gesture) {
      const state = rb.audioState();
      if (stale || (!gestureSeen && state !== 'none' && state !== 'running')) rb.fresh();
      stale = false;
      gestureSeen = true;
    }
    if (!stale && rb.audioState() !== 'running') rb.unlock();
    play();
  }
  function setTrack(id) {
    track = id || background;
    clearTimeout(timer);
    // A round can hand off the soundtrack twice in the same turn.
    timer = setTimeout(play, 40);
  }
  button.addEventListener('click', event => {
    event.stopPropagation();
    if (!wanted || rb?.bgmId() == null) { wanted = true; wake(true); }
    else { wanted = false; rb.bgm(false); }
    try { localStorage.setItem('fedoskin-city-music', wanted ? '1' : '0'); } catch (_) {}
    paint();
  });
  for (const type of ['touchend', 'pointerup', 'click', 'keydown']) {
    document.addEventListener(type, e => {
      if (e.isTrusted && !button.contains(e.target)) wake(true);
    }, { capture: true, passive: true });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      rb?.bgm(false);
      stale = gestureSeen && matchMedia('(pointer: coarse)').matches;
    } else wake();
  });
  rb?.onAudioState?.(play);
  window.cityMusic = {
    setTrack,
    setBackground(id) { background = id; setTrack(null); },
    beat: () => rb?.audioState() === 'running' ? rb.bgmBeat() : null,
    state: () => ({ on: rb?.bgmId() != null, live: rb?.audioState() === 'running' && rb.bgmId() != null, stale, id: track, playing: rb?.bgmId() ?? null }),
    stop() { stopped = true; clearTimeout(timer); rb?.bgm(false); },
  };
  paint();
  wake();
})();
