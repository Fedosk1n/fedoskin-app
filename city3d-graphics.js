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

let menu;
export function cityGraphicsMenu() {
  if (menu) return menu;

  const dialog = document.querySelector('#graphicsDialog');
  const button = document.querySelector('#graphicsOpen');
  const form = dialog.querySelector('form');
  const primary = form.querySelector('[value=save]');
  const t = window._t;
  dialog.querySelectorAll('[data-copy]').forEach(el => { el.textContent = t(el.dataset.copy); });
  button.title = t('Настройки графики');
  button.setAttribute('aria-label', button.title);

  let saved, fromDistrict;
  try { saved = JSON.parse(localStorage.getItem(KEY)); } catch (_) {}
  try { fromDistrict = sessionStorage.getItem('fedoskin-city3d-from'); } catch (_) {}
  let settings = preferences(saved);
  let entering = !fromDistrict, finishEntry, canOpen, onApply;
  const ready = entering ? new Promise(resolve => { finishEntry = resolve; }) : Promise.resolve();

  function show(entry) {
    dialog.dataset.entry = String(entry);
    form.elements.resolution.value = settings.resolution;
    form.elements.fps.value = String(settings.fps);
    primary.textContent = t(entry ? 'Войти в город' : 'Применить');
    dialog.showModal();
    form.querySelector('[name=resolution]:checked').focus({ preventScroll: true });
  }

  dialog.addEventListener('cancel', event => {
    if (entering) event.preventDefault();
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
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
    enable(available, apply) {
      canOpen = available;
      onApply = apply;
      button.disabled = false;
    },
  };
  if (entering && document.querySelector('#err').style.display !== 'flex') show(true);
  return menu;
}
