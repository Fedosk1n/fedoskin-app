// The case opens on input. Only the owning dialog can supply a confirmed reward.
window.DailyGearReveal = function dailyGearReveal({ stage, canvas, poster, mechanism, art, onFinish, muted }) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const closedPath = 'img/loot-reveal-closed.webp?v=1', openPath = 'img/loot-reveal-open.webp?v=1';
  // Built-in six-frame strip from Blender frames 15, 18, 21, 24, 28 and 35 (188 × 128 each).
  const smallPath = 'data:image/webp;base64,' +
    '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';
  // Frame 15 is the first clearly separated lid in the Blender strip.
  const columns = 6, firstFrame = 15, lastFrame = 35, frameMs = 1000 / 30;
  const mechanicalMs = 400, smallLast = 5, liftMs = 330;
  const atlas = new Image(), small = new Image(), opened = new Image(), click = new Audio();
  let context, atlasReady = false, openReady = false, skipped = false;
  let frame = 0, lift = 0, began = 0, drawn = -1, smallDrawn = -1, item = null;

  function warm(image, path, ready) {
    if (image.hasAttribute('src')) return;
    image.decoding = 'async';
    if (typeof image.decode !== 'function') image.onload = ready;
    image.src = path;
    if (typeof image.decode === 'function') image.decode().then(ready).catch(() => {});
  }
  function preload() {
    if (!small.hasAttribute('src')) {
      // The fallback bytes travel with the script. Warm them when the dialog is opened.
      small.src = smallPath;
      small.decode?.().catch(() => {});
      mechanism.style.backgroundImage = `url("${smallPath}")`;
    }
    warm(opened, openPath, () => {
      openReady = true;
      if (['waiting', 'lift', 'result'].includes(stage.dataset.phase)) still(openPath);
    });
    if (reduced.matches) return;
    warm(atlas, 'img/loot-reveal-frames.webp?v=1', () => {
      atlasReady = atlas.naturalWidth === columns * canvas.width && atlas.naturalHeight === columns * canvas.height;
    });
    if (!muted() && !click.hasAttribute('src')) {
      click.preload = 'auto';
      click.src = 'audio/loot-reveal-latch.wav?v=1';
    }
  }
  function phase(name) { stage.dataset.phase = name; }
  function still(src) {
    if (poster.getAttribute('src') !== src) poster.src = src;
    mechanism.hidden = true;
    canvas.hidden = true;
  }
  function fallback(index) {
    if (smallDrawn !== index) {
      smallDrawn = index;
      mechanism.style.backgroundPosition = `${index % 3 * 50}% ${Math.floor(index / 3) * 100}%`;
    }
    mechanism.hidden = false;
    canvas.hidden = true;
  }
  function draw(index) {
    if (drawn === index) return;
    const { width, height } = canvas;
    context.drawImage(atlas, index % columns * width, Math.floor(index / columns) * height, width, height, 0, 0, width, height);
    drawn = index;
    canvas.hidden = false;
    mechanism.hidden = true;
  }
  function silence() {
    click.pause();
    try { click.currentTime = 0; } catch (_) {}
  }
  function stop() {
    cancelAnimationFrame(frame);
    clearTimeout(lift);
    frame = lift = 0;
    silence();
  }
  function reset() {
    stop();
    drawn = smallDrawn = -1;
    skipped = false;
    item = null;
    phase('closed');
    still(closedPath);
    art.replaceChildren();
    delete stage.dataset.rarity;
  }
  function place(reward) {
    stage.dataset.rarity = reward.rar;
    art.innerHTML = window.HERO.itemArt(reward.id, 'case-item');
    art.dataset.slot = reward.slot;
  }
  function showOpen() {
    if (openReady) still(openPath);
    else if (drawn >= 0) draw(lastFrame);
    else fallback(smallLast);
  }
  function restore(reward) {
    reset();
    if (!reward) return;
    place(reward);
    showOpen();
    phase('result');
  }
  function finish() {
    if (!item) return;
    const reward = item;
    item = null;
    stop();
    showOpen();
    phase('result');
    onFinish(reward);
  }
  function exposeItem() {
    if (!item) return;
    if (skipped || reduced.matches || document.hidden) { finish(); return; }
    phase('lift');
    lift = setTimeout(finish, liftMs);
  }
  function caseOpen() {
    cancelAnimationFrame(frame);
    frame = 0;
    showOpen();
    phase('waiting');
    exposeItem();
  }
  function paint(now) {
    const elapsed = Math.max(0, now - began);
    if (drawn >= 0) {
      draw(Math.min(lastFrame, firstFrame + Math.floor(elapsed / frameMs)));
      if (drawn === lastFrame) { caseOpen(); return; }
    } else {
      if (elapsed >= mechanicalMs) { caseOpen(); return; }
      fallback(Math.floor(elapsed / mechanicalMs * smallLast));
    }
    frame = requestAnimationFrame(paint);
  }
  function start() {
    reset();
    phase('latch');
    preload();
    // Choose a decoded strip or local mechanics once, with no mid-opening asset swap.
    if (!reduced.matches && atlasReady) {
      context ||= canvas.getContext('2d');
      if (context) draw(firstFrame);
    }
    if (drawn < 0 && !reduced.matches) fallback(0);
    if (reduced.matches || document.hidden) { caseOpen(); return; }
    if (!muted() && click.hasAttribute('src')) click.play().catch(() => {});
    began = performance.now();
    frame = requestAnimationFrame(paint);
  }
  function reveal(reward) {
    item = reward;
    place(reward);
    if (reduced.matches || document.hidden || !frame) exposeItem();
  }
  function settle() {
    if (item) finish();
    else if (frame) { silence(); caseOpen(); }
  }
  function skip() {
    skipped = true;
    settle();
  }
  reduced.addEventListener('change', () => { if (reduced.matches) settle(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) settle(); });
  return { preload, start, reveal, restore, reset, skip, canSkip: () => !skipped && !reduced.matches };
};
