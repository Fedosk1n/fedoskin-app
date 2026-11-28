// The city keeps the cosmetic model separate from the player's equipment and profile rank.
import { SKINS } from './city3d-mocap.js?v=38';

const KEY = 'fedoskin-city-appearance';
const saved = {};
try { Object.assign(saved, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (_) {}

const STYLES = {
  f: [
    ['tail','Хвост','#261816'], ['buns','Два пучка','#37231D'], ['short','Короткая стрижка','#261C17'],
    ['afro','Афро','#231713'], ['braids','Косы','#231B1C'], ['longLocs','Длинные локсы','#291B16'],
    ['tiedLocs','Собранные локсы','#36221A'], ['curly','Кудри','#513326'],
  ],
  m: [
    ['short','Короткая стрижка','#281B15'], ['buzz','Ёжик','#271B16'], ['afro','Афро','#231713'],
    ['curly','Кудри','#513326'], ['braids','Косы','#231B1C'], ['longLocs','Длинные локсы','#291B16'],
    ['tiedLocs','Собранные локсы','#36221A'],
  ],
};

export function cityAppearance(girl) {
  const key = girl ? 'f' : 'm', prefs = saved[key] || {};
  const hair = STYLES[key].find(([value]) => value === prefs.hair);
  const body = {};
  if (SKINS.includes(prefs.skin)) body.skin = prefs.skin;
  if (hair) {
    body.style = hair[0];
    body.hair = hair[2];
  }
  if (Number.isInteger(prefs.face) && prefs.face >= 0 && prefs.face < 4) body.face = prefs.face;
  return {body, layers: girl && prefs.layers === true};
}

export function initCityAppearance({button, dialog, isGirl, busy, rewear, t}) {
  const form = dialog.querySelector('form');
  const colors = form.querySelector('.skin-swatches');
  const hair = form.elements.hair, face = form.elements.face, layers = form.elements.layers;
  button.title = t('Внешность');
  button.setAttribute('aria-label',button.title);
  for (const el of dialog.querySelectorAll('[data-copy]')) el.textContent = t(el.dataset.copy);
  let key;
  button.disabled = false;
  button.addEventListener('click', () => {
    if (busy()) return;
    key = isGirl() ? 'f' : 'm';
    const prefs = saved[key] || {};
    hair.replaceChildren(new Option(t('По умолчанию'),''),
      ...STYLES[key].map(([value,label]) => new Option(t(label),value)));
    hair.value = prefs.hair || '';
    face.replaceChildren(...['Мягкие черты','Округлое','Выраженная челюсть','Узкое']
      .map((s,i) => new Option(t(s),String(i))));
    face.value = String(prefs.face ?? 0);
    if (!face.value) face.value = '0';
    colors.replaceChildren(...['',...SKINS].map((color,i) => {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio'; input.name = 'skin'; input.value = color;
      input.checked = color === (SKINS.includes(prefs.skin) ? prefs.skin : '');
      input.setAttribute('aria-label',color ? t('Тон кожи {n}',{n:i}) : t('По умолчанию'));
      const swatch = document.createElement('span');
      if (color) swatch.style.backgroundColor = color;
      else swatch.textContent = '↺';
      label.append(input,swatch);
      return label;
    }));
    layers.closest('label').hidden = key !== 'f';
    layers.checked = prefs.layers === true;
    dialog.showModal();
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (event.submitter?.value === 'save' && !busy()) {
      saved[key] = {skin: form.elements.skin.value, hair: hair.value, face: Number(face.value), layers: layers.checked};
      try { localStorage.setItem(KEY,JSON.stringify(saved)); } catch (_) {}
      rewear();
    }
    dialog.close();
  });
}
