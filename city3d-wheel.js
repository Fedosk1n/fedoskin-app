// The 3D battle move picker. Four directions keep the same size on every page.
const _t = window._t;
const ANGLES = [-Math.PI / 2, Math.PI, Math.PI / 2, 0];
const HALF = Math.PI * .225;
const INNER = .51;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const CSS = `
#g3wheel{position:fixed;inset:0;width:100%;height:100%;max-width:none;max-height:none;box-sizing:border-box;margin:0;border:0;padding:0;overflow:hidden;background:transparent;color:#fff4e3;touch-action:none;user-select:none}
#g3wheel::backdrop{background:rgba(5,6,10,.36)}
#g3wheel canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
#g3wheel h2,#g3wheel .wheel-footer{position:absolute;left:var(--cx);width:min(94vw,390px);margin:0;text-align:center;transform:translateX(-50%)}
#g3wheel h2{top:calc(var(--cy) - var(--r) - 12px);transform:translate(-50%,-100%);font:400 clamp(23px,6vw,32px)/1 Anton,Inter,sans-serif;letter-spacing:.035em;text-transform:uppercase;text-shadow:0 2px 9px #000}
#g3wheel button{color:inherit;border:0;background:none;cursor:pointer;-webkit-tap-highlight-color:transparent}
#g3wheel button:focus-visible{outline:2px solid #ffbe6b;outline-offset:2px;border-radius:9px}
#g3wheel .wheel-option{position:absolute;transform:translate(-50%,-50%);width:var(--label);min-height:44px;padding:2px 0;font:400 var(--move-font)/1.05 Anton,Inter,sans-serif;overflow-wrap:break-word;text-shadow:0 1px 5px #090604}
#g3wheel .wheel-option[hidden]{display:none}
#g3wheel .wheel-option[data-locked]{color:#dbd2c4}
#g3wheel .wheel-option[data-active]{color:#fff9eb}
#g3wheel .wheel-mark{display:block;width:4px;height:4px;margin:0 auto 7px;transform:rotate(45deg);background:#ffbe79;box-shadow:0 0 8px #ee8b42}
#g3wheel [data-locked] .wheel-mark{position:relative;width:8px;height:6px;margin-bottom:5px;transform:none;border-radius:1px;background:currentColor;box-shadow:none}
#g3wheel [data-locked] .wheel-mark:before{content:'';position:absolute;box-sizing:border-box;width:6px;height:5px;bottom:5px;left:1px;border:1px solid currentColor;border-radius:3px 3px 0 0}
#g3wheel .wheel-footer{top:calc(var(--cy) + var(--r) + 7px);font:600 13px/1.25 Inter,sans-serif;text-shadow:0 2px 6px #060609}
#g3wheel .wheel-help{min-height:2.5em;margin:0 auto;display:grid;place-items:center;max-width:min(90vw,360px)}
#g3wheel .wheel-pager{display:inline-flex;align-items:center;gap:8px;font-variant-numeric:tabular-nums}
#g3wheel .wheel-pager[hidden]{display:none}
#g3wheel .wheel-pager button,#g3wheel .wheel-auto{min-height:42px;padding:0 13px;border-radius:22px;border:1px solid #a692726f;background:#151315db}
#g3wheel .wheel-pager button{min-width:44px;font-size:24px;line-height:1}
#g3wheel .wheel-pager button:disabled{opacity:.45;cursor:default}
#g3wheel .wheel-auto{font:inherit}
#g3wheel .wheel-actions{display:flex;justify-content:center;align-items:center;gap:14px}
@media (max-height:530px){#g3wheel .wheel-footer{font-size:12px}#g3wheel h2{font-size:21px}}
`;

export function initWheel() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const panel = document.createElement('dialog');
  panel.id = 'g3wheel';
  panel.setAttribute('aria-labelledby', 'g3wheelTitle');
  panel.setAttribute('aria-describedby', 'g3wheelHelp');
  panel.innerHTML = `
    <canvas aria-hidden="true"></canvas>
    <h2 autofocus tabindex="-1" id="g3wheelTitle">${_t('Выбери элемент')}</h2>
    <div class="wheel-options"></div>
    <div class="wheel-footer">
      <p class="wheel-help" id="g3wheelHelp" aria-live="polite"></p>
      <div class="wheel-actions">
        <div class="wheel-pager" hidden>
          <button type="button" class="wheel-prev" aria-label="${_t('Предыдущие элементы')}">‹</button>
          <span class="wheel-count" aria-live="polite"></span>
          <button type="button" class="wheel-next" aria-label="${_t('Следующие элементы')}">›</button>
        </div>
        <button type="button" class="wheel-auto">${_t('Автовыбор')}</button>
        <button type="button" class="wheel-auto wheel-back" hidden>${_t('В город')}</button>
      </div>
    </div>`;
  document.body.appendChild(panel);
  const get = s => panel.querySelector(s);
  const canvas = get('canvas'), paint = canvas.getContext('2d');
  const help = get('.wheel-help'), pager = get('.wheel-pager'), count = get('.wheel-count');
  const prev = get('.wheel-prev'), next = get('.wheel-next');
  const auto = get('.wheel-auto'), back = get('.wheel-back');
  const instructions = _t('Веди палец к элементу и отпусти или нажми на сектор');
  const buttons = ANGLES.map((_, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'wheel-option';
    b.innerHTML = '<span class="wheel-mark" aria-hidden="true"></span><span></span>';
    b.onclick = () => select(i);
    get('.wheel-options').appendChild(b);
    return b;
  });

  let options, onChoose, onBack, preferred, page = 0, pageCount = 0, shown = [];
  let pointer, finger, active = -1, geometry;

  function paintWheel() {
    if (!geometry) return;
    const { x, y, r, w, h } = geometry;
    paint.clearRect(0, 0, w, h);
    shown.forEach((o, i) => {
      const a = ANGLES[i], start = a - HALF, end = a + HALF;
      const hot = i === active || buttons[i].matches(':focus-visible');
      const lit = hot && !o.locked;
      paint.beginPath();
      paint.arc(x, y, r, start, end);
      paint.arc(x, y, r * INNER, end, start, true);
      paint.closePath();
      const fill = paint.createLinearGradient(x, y, x + Math.cos(a) * r, y + Math.sin(a) * r);
      fill.addColorStop(0, lit ? 'rgba(96,32,7,.96)' : 'rgba(14,13,16,.92)');
      fill.addColorStop(1, lit ? 'rgba(216,97,23,.94)' : o.locked ? 'rgba(29,26,27,.85)' : 'rgba(45,34,29,.86)');
      paint.fillStyle = fill;
      paint.fill();
      paint.strokeStyle = lit ? '#ffd19b' : hot ? '#e6b58b' : 'rgba(227,198,162,.45)';
      paint.lineWidth = lit ? 2 : 1;
      paint.shadowColor = lit ? '#f48b3488' : 'transparent';
      paint.shadowBlur = lit ? 14 : 0;
      paint.stroke();
      paint.shadowBlur = 0;
    });
    if (finger) {
      const { x: fx, y: fy } = finger;
      paint.beginPath(); paint.moveTo(x, y); paint.lineTo(fx, fy);
      paint.setLineDash([2, 7]); paint.lineCap = 'round'; paint.lineWidth = 2.5;
      paint.strokeStyle = '#ffd2a6'; paint.stroke(); paint.setLineDash([]);
      paint.beginPath(); paint.arc(fx, fy, 5, 0, Math.PI * 2);
      paint.fillStyle = '#ffb96c'; paint.fill();
    }
  }
  function position(px, py) {
    if (!panel.open) return;
    const w = panel.clientWidth, h = panel.clientHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (pointer !== undefined && geometry?.w === w && geometry.h === h) return;
    const wide = w > h * 1.3;
    const r = Math.max(42, Math.floor(Math.min(175, (w - 24) / 2, (h - (wide ? 206 : 270)) / 2)));
    const x = Math.round(clamp(px * w, r + 12, w - r - 12));
    const y = Math.round(clamp(py * h, r + (wide ? 76 : 145), h - r - (wide ? 87 : 102)));
    if (geometry?.x === x && geometry.y === y && geometry.w === w && geometry.h === h && geometry.dpr === dpr) return;
    if (!geometry || geometry.w !== w || geometry.h !== h || geometry.dpr !== dpr) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      paint.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    geometry = { x, y, r, w, h, dpr };
    panel.style.setProperty('--cx', x + 'px');
    panel.style.setProperty('--cy', y + 'px');
    panel.style.setProperty('--r', r + 'px');
    panel.style.setProperty('--label', Math.max(45, r * .55) + 'px');
    panel.style.setProperty('--move-font', clamp(r * .12, 11, 16) + 'px');
    buttons.forEach((b, i) => {
      b.style.left = x + Math.cos(ANGLES[i]) * r * .755 + 'px';
      b.style.top = y + Math.sin(ANGLES[i]) * r * .755 + 'px';
    });
    paintWheel();
  }
  function updateHighlight(i) {
    if (i === active) return;
    active = i;
    buttons.forEach((b, j) => b.toggleAttribute('data-active', j === i));
    help.textContent = shown[i]?.locked ? shown[i].reason : instructions;
  }
  function showPage(i) {
    page = clamp(i, 0, pageCount - 1);
    shown = options.slice(page * ANGLES.length, (page + 1) * ANGLES.length);
    updateHighlight(-1);
    help.textContent = instructions;
    buttons.forEach((b, j) => {
      const option = shown[j];
      b.hidden = !option;
      if (!option) return;
      b.dataset.move = option.move.id;
      b.toggleAttribute('data-locked', option.locked);
      b.lastElementChild.textContent = option.name;
      b.setAttribute('aria-label', option.locked ? option.name + ' · ' + option.reason : option.name);
    });
    pager.hidden = pageCount === 1;
    count.textContent = (page + 1) + ' / ' + pageCount;
    prev.disabled = page === 0;
    next.disabled = page === pageCount - 1;
    paintWheel();
  }
  function close() {
    if (!panel.open) return;
    onChoose = onBack = null;
    pointer = finger = undefined;
    active = -1;
    buttons.forEach(b => b.removeAttribute('data-active'));
    panel.close();
  }
  function select(i) {
    const option = shown[i];
    if (!option || !panel.open) return;
    if (option.locked) { help.textContent = option.reason; return; }
    const choose = onChoose;
    close();
    choose(option.move);
  }
  function hit(x, y) {
    const dx = x - geometry.x, dy = y - geometry.y;
    const d = Math.hypot(dx, dy);
    if (d < geometry.r * INNER || d > geometry.r + 6) return -1;
    const a = Math.atan2(dy, dx);
    return shown.findIndex((_, i) => Math.cos(a - ANGLES[i]) >= Math.cos(HALF));
  }
  function release(e) {
    if (pointer !== e.pointerId) return;
    const i = e.type === 'pointerup' ? hit(e.clientX, e.clientY) : -1;
    pointer = finger = undefined;
    updateHighlight(-1);
    paintWheel();
    select(i);
  }
  panel.addEventListener('pointerdown', e => {
    if (!geometry || pointer !== undefined || e.button !== 0 || e.target.closest('.wheel-actions')) return;
    if (Math.hypot(e.clientX - geometry.x, e.clientY - geometry.y) > geometry.r + 8) return;
    e.preventDefault();
    pointer = e.pointerId;
    panel.setPointerCapture(pointer);
    finger = { x: e.clientX, y: e.clientY };
    updateHighlight(hit(finger.x, finger.y));
    paintWheel();
  });
  panel.addEventListener('pointermove', e => {
    if (pointer !== e.pointerId) return;
    finger = { x: e.clientX, y: e.clientY };
    updateHighlight(hit(finger.x, finger.y));
    paintWheel();
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => panel.addEventListener(type, release));
  panel.addEventListener('focusin', paintWheel);
  panel.addEventListener('focusout', () => requestAnimationFrame(paintWheel));
  panel.addEventListener('cancel', e => {
    e.preventDefault();
    back.click();
  });
  function changePage(i) {
    const wasPrev = document.activeElement === prev, wasNext = document.activeElement === next;
    showPage(i);
    if (wasPrev && prev.disabled) next.focus({ preventScroll: true });
    if (wasNext && next.disabled) prev.focus({ preventScroll: true });
  }
  prev.onclick = () => changePage(page - 1);
  next.onclick = () => changePage(page + 1);
  back.onclick = () => {
    if (!onBack) return;
    const leave = onBack;
    close();
    leave();
  };
  auto.onclick = () => {
    if (!onChoose) return;
    const choose = onChoose;
    close();
    choose(preferred);
  };
  return {
    open(choices, fallback, last, choose, leave) {
      options = choices; preferred = fallback; onChoose = choose; onBack = leave;
      back.hidden = !leave;
      auto.hidden = !!leave;
      pageCount = Math.ceil(options.length / ANGLES.length);
      const first = options.findIndex(o => o.move === last || (!last && !o.locked));
      panel.showModal();
      position(.5, .5);
      showPage(Math.floor(Math.max(0, first) / ANGLES.length));
    },
    close, position, active: () => panel.open,
  };
}
