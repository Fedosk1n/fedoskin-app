const KEY = 'fedoskin-city3d-graphics';
const DEFAULT = { resolution: 'fhd', fps: 60 };
const RESOLUTIONS = {
  hd: [1280, 720],
  fhd: [1920, 1080],
  ultra: [2560, 1440],
};
const LIMITS = [30, 60, 90, 120];

function preferences(value) {
  return {
    resolution: Object.hasOwn(RESOLUTIONS, value?.resolution) ? value.resolution : DEFAULT.resolution,
    fps: LIMITS.includes(value?.fps) ? value.fps : DEFAULT.fps,
  };
}

// Cap the physical framebuffer in both orientations without stretching or upscaling the viewport.
export function cityPixelRatio(resolution, width, height, native, maxWidth, maxHeight) {
  const [long, short] = RESOLUTIONS[resolution];
  return Math.min(native, long / Math.max(width, height), short / Math.min(width, height), maxWidth / width, maxHeight / height);
}

export function cityFramePacer() {
  let next;
  return {
    reset() { next = undefined; },
    shouldDraw(now, fps) {
      const period = 1000 / fps;
      // Keep the fractional remainder across refresh ticks, including when fps doesn't divide the panel's Hz.
      if (next !== undefined && now + .5 < next) return false;
      next = next === undefined || now - next >= period ? now + period : next + period;
      return true;
    },
  };
}

export function supportedCityFPS(intervals) {
  if (intervals.length < 6) return 30;
  const average = intervals.reduce((sum, time) => sum + time, 0) / intervals.length;
  const sorted = [...intervals].sort((a, b) => a - b);
  const slowFrame = sorted[Math.ceil(sorted.length * .8) - 1];
  const sustained = 1000 / Math.max(average, slowFrame);
  for (let i = LIMITS.length - 1; i > 0; i--) if (sustained >= LIMITS[i] * .94) return LIMITS[i];
  return 30;
}

export async function recommendCitySettings(sample, sameSize, signal) {
  const fps = await sample('fhd', signal);
  if (signal.aborted) return;
  if (fps < 60 && !sameSize('hd', 'fhd')) {
    const lighter = await sample('hd', signal);
    if (!signal.aborted) return { resolution: 'hd', fps: lighter };
    return;
  }
  if (fps >= 60 && !sameSize('fhd', 'ultra')) {
    const sharper = await sample('ultra', signal);
    if (signal.aborted) return;
    if (sharper >= fps) return { resolution: 'ultra', fps: sharper };
  }
  return { resolution: 'fhd', fps };
}

let menu;
export function cityGraphicsMenu() {
  if (menu) return menu;

  const dialog = document.querySelector('#graphicsDialog');
  const button = document.querySelector('#graphicsOpen');
  const form = dialog.querySelector('form');
  const primary = form.querySelector('[value=save]');
  const recommend = form.querySelector('#graphicsRecommend');
  const report = form.querySelector('#graphicsReport');
  const t = window._t;
  dialog.querySelectorAll('[data-copy]').forEach(el => { el.textContent = t(el.dataset.copy); });
  button.title = t('Настройки графики');
  button.setAttribute('aria-label', button.title);

  let saved, fromDistrict;
  try { saved = JSON.parse(localStorage.getItem(KEY)); } catch (_) {}
  try { fromDistrict = sessionStorage.getItem('fedoskin-city3d-from'); } catch (_) {}
  let settings = preferences(saved);
  let entering = !fromDistrict, finishEntry, canOpen, onApply, registerCheck, check;
  const ready = entering ? new Promise(resolve => { finishEntry = resolve; }) : Promise.resolve();
  const checkReady = new Promise(resolve => { registerCheck = resolve; });

  function show(entry) {
    dialog.dataset.entry = String(entry);
    form.elements.resolution.value = settings.resolution;
    form.elements.fps.value = String(settings.fps);
    primary.textContent = t(entry ? 'Войти в город' : 'Применить');
    report.textContent = '';
    dialog.showModal();
    form.querySelector('[name=resolution]:checked').focus({ preventScroll: true });
  }

  function stopCheck() {
    if (!check) return;
    check.abort();
    check = null;
    recommend.disabled = false;
    report.textContent = '';
  }

  recommend.addEventListener('click', async () => {
    const controller = check = new AbortController();
    recommend.disabled = true;
    report.textContent = t('Проверяем производительность…');
    // Start loading the real scene while the player stays on the entry menu.
    finishEntry?.();
    try {
      const run = await checkReady;
      if (controller.signal.aborted) return;
      const choice = await run(controller.signal);
      if (controller.signal.aborted) return;
      form.elements.resolution.value = choice.resolution;
      form.elements.fps.value = String(choice.fps);
      const name = { hd: 'HD', fhd: 'FHD', ultra: 'Ultra' }[choice.resolution];
      report.textContent = t('Рекомендуется {quality} · {fps} FPS', { quality: name, fps: choice.fps });
    } catch (_) {
      if (!controller.signal.aborted) report.textContent = t('Не удалось подобрать режим.');
    } finally {
      if (check === controller) { check = null; recommend.disabled = false; }
    }
  });
  form.addEventListener('change', stopCheck);
  dialog.addEventListener('close', stopCheck);
  window.addEventListener('resize', stopCheck);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopCheck(); });

  dialog.addEventListener('cancel', event => {
    if (entering) event.preventDefault();
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    stopCheck();
    if (event.submitter?.value !== 'cancel') {
      const before = settings;
      settings = preferences({ resolution: form.elements.resolution.value, fps: Number(form.elements.fps.value) });
      try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (_) {}
      if (before.resolution !== settings.resolution || before.fps !== settings.fps) onApply?.(settings, before);
    }
    dialog.close();
    if (entering) {
      entering = false;
      finishEntry();
    }
  });
  button.addEventListener('click', () => {
    if (canOpen?.()) show(false);
  });

  menu = {
    ready,
    get settings() { return settings; },
    get open() { return dialog.open; },
    enable(available, apply, runCheck) {
      canOpen = available;
      onApply = apply;
      registerCheck(runCheck);
      button.disabled = false;
    },
  };
  if (entering && document.querySelector('#err').style.display !== 'flex') show(true);
  return menu;
}
