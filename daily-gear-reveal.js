// Presentation only. The owning dialog passes the confirmed item to the player.
window.DailyGearReveal = function dailyGearReveal({ stage, canvas, poster, art, onFinish, muted }) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const paths = { closed: 'img/loot-reveal-closed.webp?v=1', open: 'img/loot-reveal-open.webp?v=1',
    frames: 'img/loot-reveal-frames.webp?v=1', latch: 'audio/loot-reveal-latch.wav?v=1' };
  const columns = 6, lastFrame = 35, latchFrame = 10, itemFrame = 24, frameMs = 1000 / 30;
  const context = canvas.getContext('2d');
  const atlas = new Image();
  const click = new Audio();
  const opened = new Image();
  let id = 0, beginning = 0, openAt = null, item = null, drawn = -1;

  function preload() {
    if (!opened.getAttribute('src')) opened.src = paths.open;
    if (reduced.matches) return;
    if (!atlas.getAttribute('src')) atlas.src = paths.frames;
    if (!muted() && !click.getAttribute('src')) {
      click.preload = 'auto';
      click.src = paths.latch;
    }
  }
  function phase(name) { stage.dataset.phase = name; }
  function canDraw() { return context && atlas.complete && atlas.naturalWidth > 0; }
  function still(src) {
    if (poster.getAttribute('src') !== src) poster.src = src;
    canvas.hidden = true;
  }
  function draw(index) {
    if (!canDraw() || drawn === index) return;
    drawn = index;
    const { width, height } = canvas;
    context.drawImage(atlas, index % columns * width, Math.floor(index / columns) * height, width, height, 0, 0, width, height);
    canvas.hidden = false;
  }
  function silence() {
    click.pause();
    try { click.currentTime = 0; } catch (_) {}
  }
  function reset() {
    cancelAnimationFrame(id);
    id = 0; drawn = -1;
    silence();
    beginning = 0;
    openAt = item = null;
    phase('closed');
    still(paths.closed);
    art.replaceChildren();
    delete stage.dataset.rarity;
  }
  function place(reward) {
    stage.dataset.rarity = reward.rar;
    art.innerHTML = window.HERO.itemArt(reward.id, 'case-item');
    art.dataset.slot = reward.slot;
  }
  function restore(reward) {
    reset();
    if (!reward) return;
    place(reward);
    still(paths.open);
    phase('result');
  }
  function finish() {
    if (!item) return;
    const reward = item;
    item = null;
    cancelAnimationFrame(id);
    id = 0;
    silence();
    // Replacing a loaded strip with the open still leaves a picture even on a skipped opening.
    still(paths.open);
    phase('result');
    onFinish(reward);
  }
  function frame(now) {
    if (openAt === null) {
      // The clasp moves immediately, but the lid waits for a confirmed reward.
      const index = Math.min(latchFrame, Math.max(0, Math.floor((now - beginning) / frameMs)));
      draw(index);
      if (!item && index === latchFrame && drawn === latchFrame) { id = 0; return; }
      if (item && now - beginning >= (latchFrame + 1) * frameMs) {
        if (canDraw()) openAt = now;
        else if (atlas.complete || now - beginning >= 750) { finish(); return; }
      }
    } else {
      const index = Math.min(lastFrame, latchFrame + Math.floor((now - openAt) / frameMs));
      draw(index);
      if (index >= itemFrame && stage.dataset.phase !== 'lift') phase('lift');
      if (index === lastFrame && now - openAt >= (lastFrame - latchFrame + 5) * frameMs) { finish(); return; }
    }
    id = requestAnimationFrame(frame);
  }
  function start() {
    preload();
    reset();
    if (reduced.matches) return;
    phase('latch');
    if (!muted()) click.play().catch(() => {});
    beginning = performance.now();
    id = requestAnimationFrame(frame);
  }
  function reveal(reward) {
    item = reward;
    place(reward);
    if (reduced.matches || document.hidden || !beginning) finish();
    else if (!id) id = requestAnimationFrame(frame);
  }
  // A motion preference change or a hidden tab settles a confirmed reveal immediately.
  reduced.addEventListener('change', () => { if (reduced.matches) { if (item) finish(); else reset(); } });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (item) finish(); else if (beginning) reset(); } });
  return { preload, start, reveal, restore, reset, skip: finish };
};
