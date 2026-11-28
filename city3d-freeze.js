// The city's freezes take four beats of the crew's music once the player presses.
const _t = window._t;
const grace = .5;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function initFreeze() {
  const meter = RB.freezeBalance;
  const style = document.createElement('style');
  style.textContent = meter.css + `
#g3freeze{position:absolute;left:50%;bottom:calc(18px + env(safe-area-inset-bottom));transform:translateX(-50%);
  width:min(390px,calc(100vw - 24px));box-sizing:border-box;padding:12px 14px;border:1px solid #52615A;border-radius:18px;
  background:#141B17;color:#F2EFE8;text-align:center;pointer-events:auto;touch-action:none;user-select:none;-webkit-user-select:none}
#g3freeze[hidden],#g3skip[hidden]{display:none}
#g3freeze h4{margin:0 0 9px;font:22px Anton,sans-serif}
#g3freeze .prompt{min-height:42px;margin:8px 0 0;display:grid;place-items:center;border-radius:10px;background:#F2CC55;
  color:#141B17;font:700 14px/1.3 Inter,sans-serif;padding:3px 6px;box-sizing:border-box}
#g3freeze.out .prompt{background:#FFA46E}
body.g3balance #g3mv{opacity:0}
#g3ftip{margin-top:12px;padding:10px 12px;border:1px solid #52615A;border-radius:12px;background:#141B17}
#g3ftip p{margin:4px 0 8px}
#g3ftip .rbrail{margin-bottom:21px}
`;
  document.head.append(style);
  const panel = document.createElement('section');
  panel.id = 'g3freeze';
  panel.hidden = true;
  panel.innerHTML = '<h4></h4>' + meter.rail(false) + meter.bar + '<p class="prompt" aria-live="polite"></p>';
  document.querySelector('#g3bt').append(panel);
  const rail = panel.querySelector('.rbrail'), prompt = panel.querySelector('.prompt'), skip = document.querySelector('#g3skip');
  const ready = _t('Нажми и держи здесь'), holding = _t('Держи и веди палец вбок'), recover = _t('Верни точку в зелёную зону');
  let active = null, demo = null;

  function guide() {
    return '<section id="g3ftip"><b>' + _t('Как удержать фриз') + '</b><p>' +
      _t('Когда появится зелёная шкала, нажми на панель и держи. Сдвигай палец вбок, чтобы точка оставалась в зоне.') +
      '</p>' + meter.rail(true) + meter.bar + '</section>';
  }
  function teach(panel) {
    demo = panel && { panel, rail: panel.querySelector('.rbrail'), t: 0, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches };
  }
  function arm(J, s, { duration, wait, tolerance, direction, onEnd }) {
    const action = J.act;
    active = { J, action, speed: action.timeScale, duration, wait, tolerance, direction, onEnd,
      pointer: null, offset: 0, t: 0, off: 0, good: 0, followed: false, outside: false };
    action.timeScale = 0;
    panel.querySelector('h4').textContent = s.nm;
    panel.style.setProperty('--progress', 0);
    panel.classList.remove('out');
    rail.classList.remove('out');
    meter.paint(rail, 0, 0, tolerance);
    prompt.textContent = ready;
    panel.hidden = false;
    skip.hidden = true;
    document.body.classList.add('g3balance');
  }
  function cancel() {
    const p = active;
    if (!p) return;
    active = null;
    p.action.timeScale = p.speed;
    p.J.rig.rotation.z = 0;
    if (p.pointer !== null && panel.hasPointerCapture(p.pointer)) panel.releasePointerCapture(p.pointer);
    panel.hidden = true;
    skip.hidden = false;
    document.body.classList.remove('g3balance');
  }
  function finish(ok) {
    const { onEnd, good, t } = active;
    cancel();
    onEnd(ok, ok && t > 0 ? good / t : 0);
  }
  panel.addEventListener('pointerdown', event => {
    const p = active;
    if (!p || p.pointer !== null || event.button !== 0) return;
    event.preventDefault();
    p.pointer = event.pointerId;
    p.x = event.clientX;
    const bounds = panel.getBoundingClientRect();
    if (p.x - bounds.left < 48) p.direction = 1;
    else if (bounds.right - p.x < 48) p.direction = -1;
    p.t = 0;
    prompt.textContent = holding;
    try { panel.setPointerCapture(event.pointerId); } catch (_) {}
  });
  panel.addEventListener('pointermove', event => {
    if (active?.pointer !== event.pointerId) return;
    active.offset = event.clientX - active.x;
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) panel.addEventListener(type, event => {
    if (active?.pointer === event.pointerId) finish(false);
  });

  function tick(dt) {
    if (demo) {
      demo.t = (demo.t + dt) % 3.6;
      const progress = demo.reduced ? .82 : clamp(demo.t / 2.6, 0, 1);
      const offset = 36 * meter.drift(progress);
      meter.paint(demo.rail, offset, offset, 19);
      demo.panel.style.setProperty('--progress', progress);
    }
    const p = active;
    if (!p) return;
    p.t += dt;
    if (p.pointer === null) { if (p.t >= p.wait) finish(false); return; }
    const progress = clamp(p.t / p.duration, 0, 1), target = p.direction * 36 * meter.drift(progress);
    const outside = Math.abs(p.offset - target) > p.tolerance;
    p.off = outside ? p.off + dt : 0;
    if (!outside) p.good += dt;
    if (!outside && Math.abs(target) > p.tolerance + 2) p.followed = true;
    if (p.outside !== outside) {
      p.outside = outside;
      rail.classList.toggle('out', outside);
      panel.classList.toggle('out', outside);
      prompt.textContent = outside ? recover : holding;
    }
    meter.paint(rail, p.offset, target, p.tolerance);
    panel.style.setProperty('--progress', progress);
    const lean = clamp((p.offset - target) / 140, -.09, .09);
    p.J.rig.rotation.z += (lean - p.J.rig.rotation.z) * (1 - Math.exp(-dt * 12));
    if (p.off >= grace) finish(false);
    else if (progress >= 1) finish(p.followed && !outside);
  }
  return { guide, teach, arm, tick, cancel, active: () => !!active, holding: () => active?.pointer != null };
}
