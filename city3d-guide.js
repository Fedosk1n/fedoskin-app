import * as THREE from 'three';
import { loadUntexturedModel } from './city3d-festival-art.js?v=2';

import { LANDMARKS, landmarkImage } from './city3d-guide-data.js?v=1';

const KEY = 'fedoskin-city-guide';
function readGuide() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY));
    return {
      line: ['story','festival'].includes(data?.line) ? data.line : null,
      invite: data?.invite === true,
      seen: new Set(Array.isArray(data?.seen) ? data.seen.filter(item => typeof item === 'string') : []),
    };
  } catch (_) { return { line: null, invite: false, seen: new Set() }; }
}

const CSS = `
#g3guide,#g3guideOpen{position:fixed;z-index:6;top:calc(max(10px,env(safe-area-inset-top)) + 150px);left:max(10px,env(safe-area-inset-left));box-sizing:border-box}
#g3guide[hidden],#g3guideOpen[hidden],#g3landmarkLabel[hidden],#g3guide [hidden]{display:none}
#g3guide{width:min(342px,calc(100vw - max(10px,env(safe-area-inset-left)) - max(10px,env(safe-area-inset-right))));color:#fcf0d8;
 background:linear-gradient(125deg,#26201bfa,#11171dee 78%);border:1px solid #9b784a;border-inline-start:3px solid #f2be7e;border-radius:14px;
 box-shadow:0 7px 24px #0a0a0ba8;pointer-events:none;padding:10px 11px 8px;font:600 13px/1.35 Inter,system-ui,sans-serif}
#g3guide.festival{border-inline-start-color:#82d9c6}
#g3guide.first-watch,#g3guideOpen.first-watch{top:auto;bottom:max(10px,env(safe-area-inset-bottom))}
body.city-guide-intro :is(#hint,#ztip){display:none}
#g3guide header{display:flex;align-items:center;justify-content:space-between;gap:6px}
#g3guide h2{font:800 17px/1.16 Inter,system-ui,sans-serif;margin:0;overflow-wrap:anywhere}
#g3guide .guide-content{display:grid;grid-template-columns:minmax(0,1fr) min(97px,31%);gap:8px;align-items:start}
#g3guide .guide-copy p{margin:3px 0 0}
#g3guide .guide-where{color:#ffe0a5;font:800 11px/1.25 Inter,system-ui,sans-serif}
#g3guide.festival .guide-where{color:#9ce5d4}
#g3guide img{width:100%;display:block;aspect-ratio:1.56;object-fit:cover;border:1px solid #6b6561;border-radius:7px;box-sizing:border-box}
#g3guide .guide-actions{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-top:6px}
#g3guide button,#g3guideOpen{font:800 12px/1.2 Inter,system-ui,sans-serif;min-height:44px;cursor:pointer;color:#fdf0db;background:#30323a;
 border:1px solid #82715d;border-radius:8px;padding:6px 9px;pointer-events:auto}
#g3guide button:focus-visible,#g3guideOpen:focus-visible{outline:2px solid white;outline-offset:2px}
#g3guide .guide-first{background:#ffc782;color:#19151c;border-color:#ffc782}
#g3guide .guide-close{background:transparent;flex:none;font-size:22px;line-height:1;padding:0;min-width:44px;border-color:transparent}
#g3guideOpen{width:max-content;background:#1c2029ed;color:#ffdeb0;box-shadow:0 3px 9px #121217aa}
#g3guide-status{position:fixed;width:1px;height:1px;clip-path:inset(50%);overflow:hidden;white-space:nowrap;pointer-events:none}
#g3landmarkLabel{position:fixed;z-index:4;transform:translate(-50%,-100%);pointer-events:none;max-width:min(205px,42vw);
 padding:4px 9px;border-radius:7px;border:1px solid #a48864;background:#191712ee;color:#fff1d0;
 font:800 12px/1.2 Inter,system-ui,sans-serif;text-align:center;box-sizing:border-box}
#g3landmarkLabel.watch{transform:translateY(-100%)}
#g3landmarkLabel.festival{background:#152522ee;border-color:#76a99e;color:#b4eddd}
body.g3fight :is(#g3guide,#g3guideOpen,#g3landmarkLabel),
body.festival-playing :is(#g3guide,#g3guideOpen,#g3landmarkLabel){display:none}
@media (max-height:490px) and (orientation:landscape){
 #g3guide,#g3guideOpen{left:auto;right:max(10px,env(safe-area-inset-right));top:calc(max(8px,env(safe-area-inset-top)) + 89px)}
 #g3guide{width:min(315px,48vw);padding:6px 8px}
 #g3guide h2{font-size:15px}
 #g3guide .guide-content{grid-template-columns:minmax(0,1fr) min(73px,26%);gap:5px}
 #g3guide .guide-actions{margin-top:4px;gap:3px}
 #g3guide .guide-content p{font-size:11px}
 #g3guide.first-watch,#g3guideOpen.first-watch{top:auto;bottom:max(8px,env(safe-area-inset-bottom))}
 #g3guide.first-watch{width:min(254px,40vw)}
}
`;

export function initCityGuide(t) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);
  const holder = document.createElement('div');
  holder.innerHTML = `<aside id="g3guide" hidden aria-labelledby="g3guide-title">
 <header><h2 id="g3guide-title"></h2><button class="guide-close" type="button">×</button></header>
 <div class="guide-content"><div class="guide-copy"><div class="guide-where"></div><p></p></div><img decoding="async"></div>
 <div class="guide-actions"><button type="button" class="guide-first"></button><button type="button" class="guide-other" hidden></button></div>
 </aside><button id="g3guideOpen" type="button" hidden aria-controls="g3guide" aria-expanded="false"></button>
 <div id="g3guide-status" role="status"></div><div id="g3landmarkLabel" hidden></div>`;
  document.body.append(holder);
  const $ = selector => holder.querySelector(selector);
  const ui = $('#g3guide'), reopen = $('#g3guideOpen'), title = $('#g3guide-title');
  const first = $('.guide-first'), other = $('.guide-other'), text = $('.guide-copy p'), where = $('.guide-where');
  const close = $('.guide-close'), photo = $('img'), status = $('#g3guide-status');
  close.setAttribute('aria-label',t('Закрыть подсказку'));
  reopen.textContent = t('Подсказка');
  const state = readGuide();
  let current = null, key = '', wantOpen = false, allowed = false;

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ line:state.line, invite:state.invite, seen:[...state.seen].slice(-360) })); } catch (_) {}
  }
  function visibility() {
    const open = Boolean(allowed && current && wantOpen);
    ui.hidden = !open;
    reopen.hidden = !allowed || !current || open;
    reopen.setAttribute('aria-expanded',String(open));
    const label = current?.id === 'festival-invite' ? current.title : t('Подсказка');
    if (reopen.textContent !== label) reopen.textContent = label;
    if (open && !state.seen.has(key)) {
      state.seen.add(key);
      save();
      status.textContent = current.title;
    }
  }
  function set(entry, safe) {
    current = entry;
    allowed = safe;
    const intro = entry?.id === 'story:cypher:yard';
    ui.classList.toggle('first-watch',intro);
    reopen.classList.toggle('first-watch',intro);
    const next = entry?.id || '';
    if (next !== key) {
      key = next;
      wantOpen = Boolean(entry && !state.seen.has(key));
    }
    if (entry && allowed && wantOpen) {
      ui.classList.toggle('festival',entry.line === 'festival');
      for (const [node,value] of [[title,entry.title],[text,entry.text],[where,entry.where],
                                 [first,entry.button],[other,entry.alternate?.button || '']]) {
        if (node.textContent !== value) node.textContent = value;
      }
      other.hidden = !entry.alternate;
      if (photo.getAttribute('src') !== landmarkImage(entry.art)) photo.src = landmarkImage(entry.art);
      if (photo.alt !== t(LANDMARKS[entry.art][1])) photo.alt = t(LANDMARKS[entry.art][1]);
    }
    visibility();
  }
  function choose(line, resolveInvite = true) {
    state.line = line;
    if (resolveInvite) state.invite = true;
    save();
  }
  function dismiss(restoreFocus = false) {
    wantOpen = false;
    visibility();
    if (restoreFocus) reopen.focus({ preventScroll:true });
  }
  close.onclick = () => dismiss(true);
  reopen.onclick = () => {
    wantOpen = true;
    set(current,allowed);
    close.focus({ preventScroll:true });
  };
  first.onclick = () => { const action = current?.action; dismiss(); action?.(); };
  other.onclick = () => { const action = current?.alternate?.action; dismiss(); action?.(); };
  ui.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); dismiss(true); }
  });
  return { set, choose, line:()=>state.line, inviteResolved:()=>state.invite, label:$('#g3landmarkLabel'),
    announce(text) { status.textContent = text; } };
}

export function initLandmarkView({ scene, camera, node, district, t }) {
  const root = new THREE.Group();
  root.name = 'CityQuestLandmarks';
  scene.add(root);
  const clip = new THREE.Vector3(), projectedCorner = new THREE.Vector3(), bounds = new THREE.Box3();
  const hud = document.querySelector('#g3hud2');
  let loading, asset = null, next = null, active = null, mount = null;
  let labelWidth = 0, labelViewport = 0, hudEdge = 0, viewport = '';
  function place() {
    if (!asset) return;
    for (const model of asset.children) model.visible = false;
    mount = next && asset.getObjectByName(next.art);
    if (!mount) return;
    mount.visible = true;
    mount.position.set(next.point.x, next.point.y || 0, next.point.z);
    mount.rotation.y = next.point.yaw || 0;
    mount.updateWorldMatrix(true,true);
    bounds.setFromObject(mount);
  }
  function set(entry) {
    const changed = entry?.art !== next?.art || entry?.point.x !== next?.point.x || entry?.point.z !== next?.point.z;
    next = entry;
    if (!next) { root.visible = false; node.hidden = true; return; }
    root.visible = true;
    if (!loading) {
      loading = loadUntexturedModel('./anim/city-guide-'+district+'.glb?v=1').then(model => {
        asset = model;
        root.add(asset);
        asset.getObjectByName('watch')?.traverse(object => {
          const material = object.material;
          if (!['Faded cream tread','Dusty ivory paint'].includes(material?.name)) return;
          object.material = material.clone();
          object.material.emissive.copy(material.color);
          object.material.emissiveIntensity = .13;
        });
        place();
      }).catch(() => {});
    }
    if (changed) place();
  }
  function post() {
    if (!next?.label || !asset || bounds.isEmpty()) { node.hidden = true; return; }
    const watch = next.art === 'watch';
    clip.set(next.point.x,(next.point.y || 0) + (watch ? .035 : 1.20),next.point.z).project(camera);
    const x = (clip.x+1)*.5, y = (1-clip.y)*.5;
    node.hidden = clip.z > 1 || x < .13 || x > .87 || y < .27 || y > .89;
    if (node.hidden) return;
    const key = next.line + ':' + next.art;
    if (key !== active) {
      active = key;
      node.classList.toggle('festival',next.line === 'festival');
      node.textContent = t(LANDMARKS[next.art][0]);
      node.classList.toggle('watch',watch);
      labelWidth = 0;
    }
    if (watch) {
      if (!labelWidth || labelViewport !== innerWidth) {
        labelViewport = innerWidth;
        labelWidth = node.offsetWidth;
      }
      const left = x*innerWidth - labelWidth - 31;
      node.style.left = Math.max(8,left).toFixed(1)+'px';
      node.style.top = (y*innerHeight - (left < 8 ? 37 : 4)).toFixed(1)+'px';
    } else {
      let top = Infinity;
      for (const px of [bounds.min.x,bounds.max.x]) for (const py of [bounds.min.y,bounds.max.y]) {
        for (const pz of [bounds.min.z,bounds.max.z]) {
          projectedCorner.set(px,py,pz).project(camera);
          top = Math.min(top,(1-projectedCorner.y)*.5*innerHeight);
        }
      }
      // The callout belongs above the full proportion of the visible prop, even close up.
      // Leave it offscreen if there is no room between the object and the city HUD.
      const screen = innerWidth + 'x' + innerHeight;
      if (screen !== viewport) { viewport = screen; hudEdge = hud.getBoundingClientRect().bottom; }
      if (top < hudEdge + 33) { node.hidden = true; return; }
      node.style.left = (x*100).toFixed(1)+'%';
      node.style.top = (top - 7).toFixed(1)+'px';
    }
  }
  return { set, post };
}
