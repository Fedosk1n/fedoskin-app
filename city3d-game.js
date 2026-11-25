// City 3D — the game on top of the scene (owner 14.11.2026: «понятная система прогресса, ограниченная энергия, батлы на авто,
// но красиво — случайные комбинации, случайные исходы, падения»). Tapping stays in the real-people battles tab.
// Crews stand around the yard; walk up → «Батл» → an automatic dance-off on motion capture: each dancer's turn is a random
// set toprock → down → footwork → power → freeze; power and freeze can fail (crash / lost freeze). 3 judges decide.
// Strength = hero level from lessons; energy = 20 per battle, refilled to full every new day; lesson minutes (+5/min) and rewards stack above it.
// 17.11.2026 (owner «авто скучно, но и в бит тапать не надо»): the HERO's power move is DRAWN by the finger — city3d-power.js
// (he hangs in the air, the finger leads his legs round a circle, perfect / clean / fall; no touch = the old automatic outcome).
import * as THREE from 'three';
import { mocapPerson, clipLen, bodyOf } from './city3d-mocap.js?v=21';   // v=14 mocap: a person = one draw call, freeze clips mirrored (22.11); v=13 mocap: a sculpted human head, shoulders without a hinge (17.11); v=12 mocap: mirrored moves «_M», no glare on clothes (17.11); v=11 mocap: everyone as smooth as the hero, chain on the chest, bucket hat, hoodie (17.11); v=10 mocap: people culled, tiny parts cast no shadow (17.11); v=12: districts (Центр); v=9 mocap: standing loops
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { initPower } from './city3d-power.js?v=10';   // the hero's power move is DRAWN by the finger (17.11)
// TRANSLATION (18.11.2026, owner «переведи 3д город… на все языки»): every visible text goes through _t('русский текст', {vars});
// the dictionary is city3d-i18n.js (source: tools/i18n_city3d.py), the language is the app's (city3d.html sets window._t)
const _t = window._t || ((s, v) => (v ? s.replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? v[k] : m)) : s));

const KEY = 'fedoskin-city3d';
export const BAL = {
  // ENERGY (owner 22.11.2026 «ежедневное восстановление энергии до полного… уроки и другие вещи добавляют энергии сверх 100»):
  // every new day free up to enMax; lessons and every reward in the city stack ABOVE it up to enCap (the extra is never lost)
  enMax: 100, enCap: 300, enStart: 60, battle: 20, perMin: 5, daily: 100,
  rep: [0, 30, 90, 200, 400, 700, 1100, 1700],
  ranks: ['Новичок двора', 'Свой', 'Уважаемый', 'Авторитет', 'Хозяин двора', 'Легенда района', 'Голос улиц', 'Имя города'].map(s => _t(s)),
  repWin: 12, repClean: 6, paint: 10, repPaint: 8, turfRep: 3, hold: 3,
  dj: 5, train: 8, trainMax: 3, show: 0, repShow: 4, repShowClean: 3, gateRank: 2,
  // the Centre: a street show on the mall's tiles (the guard!), tea for those whose pieces are on the Centre's walls
  mall: 10, mallMax: 2, repMall: 6, repMallClean: 4, repMallCaught: 2, mallFloor: .04, tea: 5,
  // the Park: the daily jam on the stage (three opponents in a row), the old-timer who rewards lesson minutes, the warm-up at the bars
  jam: 25, jamLv: [5, 6, 7], jamRep: [10, 16, 24], jamChamp: 30, ogMin: 5, ogRep: 8, ogEn: 10, warm: .04,
  // the industrial zone: the underground ring (a one-round battle; a WIN STREAK that lives across days pays more and more), stashes
  ring: 15, ringMax: 2, ringLv: [6, 7, 8], ringRep: 14, streakRep: 4, streakMax: 5, stashN: 3, stashEn: 6, stashRep: 3,
  // the tailor «Игла» in the yard: custom details for the clothes, paid with energy (= lesson minutes); level 2 needs the rank «Свой»,
  // level 3 «Авторитет». Per level: toprock/footwork +.15 pts, style +.15, freezes −2% falls, power −2% falls (headspin another −2%)
  cusCost: [25, 50, 80], cusRank: [0, 1, 3], cusStep: .15, cusStyle: .15, cusFreeze: .02, cusPower: .02, cusSpin: .02,
  // the drawn power move (city3d-power.js): ИДЕАЛЬНО = the move's points ×1.5; the first perfect one of each move = +5 ★ once
  perfMul: 1.5, perfFirst: 5,
};
// ---------- CUSTOM (owner 16.11.2026 «добавь механику улучшения одежды (продумай что именно улучшать, может быть какие нашивки)») ----------
// Four parts of the hero's outfit, three details each. Every detail is SEEN on the hero (city3d-mocap.js look.cus) and gives a small
// permanent plus in the city's battles where it makes sense for breaking: sneakers → steps, patches → style, knees → freezes,
// a spin pad → power / headspins. Kept in the save as S.cus = { kicks, top, pants, head } (0…3).
export const CUS = [
  { id: 'kicks', ico: '👟', nm: _t('Кроссы'), lv: ['Толстые шнурки', 'Каучуковая подошва', 'Светящийся кант'].map(s => _t(s)), v: n => '+' + +(n * BAL.cusStep).toFixed(2), un: _t('{v} очка за топрок и футворк') },
  { id: 'top', ico: '🧥', nm: _t('Верх'), lv: ['Нашивка на грудь', 'Нашивки на рукава', 'Большой патч на спину'].map(s => _t(s)), v: n => '+' + +(n * BAL.cusStyle).toFixed(2), un: _t('{v} к стилю у судей') },
  { id: 'pants', ico: '👖', nm: _t('Штаны'), lv: ['Усиленные колени', 'Карманы-карго', 'Цепь на пояс'].map(s => _t(s)), v: n => '−' + Math.round(n * BAL.cusFreeze * 100) + '%', un: _t('{v} срывов во фризах') },
  { id: 'head', ico: '🧢', nm: _t('Голова'), lv: ['Значок на шапку или повязка', 'Спин-пад на макушку', 'Светящийся обод'].map(s => _t(s)), v: n => '−' + Math.round(n * BAL.cusPower * 100) + '%', un: _t('{v} срывов в пауэре, на хедспине вдвое') },
];
// a custom detail's effect in words: c.un is a translated template with {v} = the value (+0.15 / −2% / «+0.15 → +0.3»)
const cusFx = (c, v) => c.un.replace('{v}', v);
// the crews; d = district ('yard' when absent); gear = HERO.GEAR pieces (1st win → 1st piece, 3rd win → 2nd piece);
// wall = [x, z] where the crew's wall stands (the yard's walls find a free spot themselves); boss = the owners of the district
export const CREWS = [
  { id: 'rusty', bodies: ['stocky', 'slim', 'avg'], name: _t('Ржавые'), lv: 1, col: '#E07A45', at: [-7.2, -9.4], looks: [['c:rustyBandana'], ['c:rustyTrack'], []], gear: ['rustyBandana', 'rustyTrack'] },
  { id: 'acid', bodies: ['lanky', 'small', 'slim'], name: _t('Кислотные'), lv: 2, col: '#7CFF4F', at: [8.6, -6.2], looks: [['c:acidBucket'], ['c:acidKicks'], ['c:acidBucket', 'girl']], gear: ['acidKicks', 'acidBucket'] },
  { id: 'owls', bodies: ['athl', 'slim', 'small'], name: _t('Ночные совы'), lv: 3, col: '#A98BFF', at: [-8.6, -2.4], looks: [['c:owlHoodie'], ['c:owlPhones'], ['c:owlHoodie', 'girl']], gear: ['owlPhones', 'owlHoodie'] },
  { id: 'gold', bodies: ['heavy', 'big', 'avg', 'stocky'], name: _t('Золотые зубы'), lv: 4, col: '#FFD23F', at: [4.6, 9.2], looks: [['c:goldChain'], ['c:goldCap'], ['c:goldChain', 'girl'], []], gear: ['goldChain', 'goldCap'] },
  // ЦЕНТР (16.11.2026)
  { id: 'stencil', bodies: ['slim', 'athl', 'small'], d: 'center', name: _t('Трафареты'), lv: 3, col: '#FF6B5E', at: [-8, 10.2], wall: [-8, 7.3], base: 3, fix: l => { if (l.col.hat) l.col.hat = l.hat === 'bandana' ? l.col.hat : ['#18181B', '#C8202A']; if (l.top !== 'bomber') l.col.top = '#18181B'; l.col.pants = '#232327'; }, looks: [['c:stencilBandana'], ['c:stencilBomber'], ['c:stencilBandana', 'girl']], gear: ['stencilBandana', 'stencilBomber'] },
  { id: 'turn', bodies: ['avg', 'heavy', 'slim', 'lanky'], d: 'center', name: _t('Турникеты'), lv: 4, col: '#5FA4FF', at: [-8.2, 3.2], wall: [-8.2, .3], base: 4, fix: l => { if (l.col.hat && l.hat !== 'bucket') l.col.hat = ['#2F7BFF', '#F2EFE8']; l.col.top = '#1c2c4a'; if (l.col.sleeve) l.col.sleeve = '#1c2c4a'; }, looks: [['c:turnBucket'], ['c:turnKicks'], ['c:turnBucket', 'girl'], ['c:turnKicks']], gear: ['turnBucket', 'turnKicks'] },
  { id: 'chrome', bodies: ['athl', 'big', 'lanky', 'stocky'], d: 'center', name: _t('Хромированные'), lv: 5, col: '#DCE6F2', at: [7.6, 3.6], wall: [7.6, .7], boss: _t('Хромосома'), base: 6, fix: l => { if (l.col.hat) l.col.hat = ['#D9DEE6', '#3F8FD8']; l.col.gold = '#D9DEE6'; if (l.top !== 'track') { l.col.top = '#18181B'; if (l.col.sleeve) l.col.sleeve = '#18181B'; l.col.cuff = '#D9DEE6'; l.col.trim = '#D9DEE6'; } }, looks: [['c:chromeTrack', 'c:chromeKicks'], ['c:chromeKicks'], ['c:chromeTrack', 'girl'], ['c:chromeKicks']], gear: ['chromeKicks', 'chromeTrack'] },
];
// the Park's crews (16.11.2026): Фанк-бригада lv 5 (old-school funk, tracksuits), Корни lv 6 (dreads, green-gold-red), Волна lv 7 —
// the owners of the embankment, boss «Кюрасао» (a nickname from the owner's list). bodies = builds of the members (type or a full body)
CREWS.push(
  { id: 'funk', d: 'park', name: _t('Фанк-бригада'), lv: 5, col: '#FF7AD9', at: [-8.2, 8.4], wall: [-8.2, 5.5], base: 5, bodies: [{ type: 'stocky', style: 'afro' }, { type: 'heavy', style: 'top', beard: true }, { type: 'slim', style: 'afro' }],
    fix: l => { l.top = 'track'; Object.assign(l.col, { top: '#7A2FB8', yoke: '#FFD23F', sleeve: '#7A2FB8', cuff: '#FFD23F', trim: '#FFD23F', pants: '#7A2FB8', stripe: '#FFD23F' }); if (l.col.hat) l.col.hat = ['#FFD23F', '#7A2FB8']; }, looks: [['c:funkTrack'], [], ['girl']], gear: ['funkTrack'] },
  { id: 'roots', d: 'park', name: _t('Корни'), lv: 6, col: '#7CD957', at: [8.2, 2.4], wall: [8.2, -.5], base: 5, bodies: [{ type: 'lanky', style: 'dreads' }, { type: 'slim', style: 'braids' }, { type: 'athl', style: 'dreads', beard: true }, { type: 'small', style: 'dreads' }],
    fix: l => { if (l.top !== 'tee') { l.col.top = '#1f3d24'; if (l.col.sleeve) l.col.sleeve = '#1f3d24'; l.col.cuff = '#FFD23F'; l.col.trim = '#C8202A'; } else l.col.top = '#2F8F3A'; l.col.pants = '#3a3226'; l.col.stripe = null; if (l.col.hat) l.col.hat = ['#2F8F3A', '#FFD23F']; },
    looks: [['c:rootsBeanie'], ['c:rootsBeanie', 'girl'], [], ['c:rootsBeanie']], gear: ['rootsBeanie'] },
  { id: 'wave', d: 'park', name: _t('Волна'), lv: 7, col: '#3FD6E0', at: [4.2, -5.4], wall: [4.2, -8.3], boss: _t('Кюрасао'), base: 7, bodies: [{ type: 'athl', h: 1.12, style: 'mohawk', dye: '#3FD6E0' }, { type: 'slim', style: 'buns' }, { type: 'big', style: 'buzz', beard: true }, { type: 'lanky', style: 'curly' }],
    fix: l => { l.col.top = l.top === 'tee' ? '#F2EFE8' : '#0f3a44'; if (l.col.sleeve) l.col.sleeve = '#0f3a44'; l.col.cuff = '#3FD6E0'; l.col.trim = '#3FD6E0'; l.col.pants = '#12262c'; if (l.col.stripe) l.col.stripe = '#3FD6E0'; if (l.col.hat) l.col.hat = ['#19B8C4', '#F2EFE8']; l.col.gold = '#D9DEE6'; },
    looks: [['c:waveKicks'], ['c:waveKicks', 'girl'], [], ['c:waveKicks']], gear: ['waveKicks'] },
);
// the industrial zone's crews (16.11.2026): Арматура lv 6 (hi-vis orange, hard caps), Высоковольтные lv 7 (black and electric yellow),
// Литейка lv 8 — the owners of the zone, boss «Коготь» (a nickname from the owner's list)
CREWS.push(
  { id: 'rebar', d: 'prom', name: _t('Арматура'), lv: 6, col: '#FF7A1A', at: [6.6, 9.4], wall: [6.6, 6.5], base: 6, bodies: [{ type: 'big', style: 'buzz', beard: true }, { type: 'stocky', style: 'short' }, { type: 'athl', style: 'tail' }],
    fix: l => { l.top = 'bomber'; Object.assign(l.col, { top: '#FF7A1A', sleeve: '#2b2d33', cuff: '#D9DEE6', trim: '#D9DEE6', pants: '#23303f', stripe: null }); if (l.col.hat) l.col.hat = ['#18181B', '#FF7A1A']; }, looks: [['c:rebarCap'], [], ['girl', 'c:rebarCap']], gear: ['rebarCap'] },
  { id: 'volt', d: 'prom', name: _t('Высоковольтные'), lv: 7, col: '#FFE23F', at: [7.6, -3.6], wall: [7.6, -6.5], base: 7, bodies: [{ type: 'lanky', style: 'mohawk', dye: '#FFE23F' }, { type: 'slim', style: 'buns' }, { type: 'athl', style: 'top' }, { type: 'small', style: 'curly' }],
    fix: l => { if (l.top !== 'tee') { l.col.top = '#141518'; if (l.col.sleeve) l.col.sleeve = '#141518'; l.col.cuff = '#FFE23F'; l.col.trim = '#FFE23F'; } else l.col.top = '#FFE23F'; l.col.pants = '#141518'; l.col.stripe = '#FFE23F'; if (l.col.hat) l.col.hat = ['#141518', '#FFE23F']; },
    looks: [['c:voltKicks'], ['c:voltKicks', 'girl'], [], ['c:voltKicks']], gear: ['voltKicks'] },
  { id: 'forge', d: 'prom', name: _t('Литейка'), lv: 8, col: '#FF4A2A', at: [-5.6, 6.6], wall: [-5.6, 3.7], boss: _t('Коготь'), base: 7, bodies: [{ type: 'big', h: 1.16, style: 'bald', beard: true }, { type: 'athl', style: 'braids' }, { type: 'heavy', style: 'buzz', beard: true }, { type: 'stocky', style: 'mohawk', dye: '#FF4A2A' }],
    fix: l => { l.col.top = l.top === 'tee' ? '#2a1512' : '#3a1a14'; if (l.col.sleeve) l.col.sleeve = '#3a1a14'; l.col.cuff = '#FF7A1A'; l.col.trim = '#FF7A1A'; l.col.pants = '#1c1a1a'; if (l.col.stripe) l.col.stripe = '#FF4A2A'; if (l.col.hat) l.col.hat = ['#3a1a14', '#FF7A1A']; l.col.gold = '#8b9099'; },
    looks: [['c:forgeChain'], ['c:forgeChain', 'girl'], [], ['c:forgeChain']], gear: ['forgeChain'] },
);
// «the whole district is in your graffiti» — one sentence per district (Russian gender: «Весь двор», but «Вся Промзона»)
const ALLMINE = { yard: '👑 Весь двор в твоих граффити!', center: '👑 Весь Центр в твоих граффити!', park: '👑 Весь Парк в твоих граффити!', prom: '👑 Вся Промзона в твоих граффити!' };
// ---- OUTFITS OF CREW MEMBERS (owner 17.11.2026 «улучши визуал других человечков») ----
// Every member used to wear the hero's outfit of his level — the team's black and orange — so the yard was full of clones of one
// kit, told apart only by the one prize item. Now each member is dressed on his own: a top of his own cut (hoodie / tee / big tee /
// track top / bomber), trousers, a hat or none (a member with an afro, a mohawk, dreads… shows his hair), headphones, chain and
// wristband only on some. Yard crews get their own palettes (CSTY: Ржавые = rust and brown workwear, Кислотные = black with acid
// green and violet, Совы = night-blue hoodies, Золотые зубы = white and gold); the other districts keep their colours (c.fix).
// The crew's prize item (c:<gear>) is never touched: it shows exactly what you win.
const CSTY = {
  rusty: { acc: '#E07A45', tops: ['#8A3B22', '#4B3428', '#6E6A55', '#A0522D'], pants: ['#4A3B2E', '#2E3742', '#5C5546'], hat: ['#4B3428', '#E07A45'],
    shoes: [['#3a2a20', '#E07A45', '#d9cfbf'], ['#E9E4D8', '#8A3B22', '#E9E4D8'], ['#2a2420', '#2a2420', '#C8603A']], cuts: ['hoodie', 'tee', 'bomber'], legs: ['jeans', 'wind', 'jeans'] },
  acid: { acc: '#7CFF4F', tops: ['#141518', '#2a1f3d', '#5ED63A', '#22252b'], pants: ['#141518', '#22252b', '#2a1f3d'], hat: ['#141518', '#7CFF4F'],
    shoes: [['#141518', '#7CFF4F', '#141518'], ['#E9E4D8', '#9B5CFF', '#E9E4D8'], ['#2a1f3d', '#7CFF4F', '#E9E4D8']], cuts: ['track', 'hoodie', 'tee'], legs: ['trackp', 'wind', 'trackp'], trim: '#9B5CFF' },
  owls: { acc: '#A98BFF', tops: ['#2B2F4A', '#3A3D45', '#1d1f2e'], pants: ['#1d2030', '#2a2a33', '#3E4A66'], hat: ['#2B2F4A', '#A98BFF'],
    shoes: [['#2B2F4A', '#A98BFF', '#E9E4D8'], ['#E9E4D8', '#2B2F4A', '#E9E4D8'], ['#1d1f2e', '#1d1f2e', '#A98BFF']], cuts: ['hoodie', 'hoodie', 'teeBig'], legs: ['wind', 'jeans', 'trackp'] },
  gold: { acc: '#FFD23F', tops: ['#E9E4D8', '#18181B', '#6b4f1d', '#E9E4D8'], pants: ['#E6E1D6', '#18181B', '#2b2620', '#18181B'], hat: ['#18181B', '#E7B23C'],
    shoes: [['#F2EFE8', '#E7B23C', '#F2EFE8'], ['#18181B', '#E7B23C', '#E7B23C'], ['#E9E4D8', '#18181B', '#E9E4D8']], cuts: ['track', 'teeBig', 'bomber', 'tee'], legs: ['trackp', 'wind', 'trackp', 'jeans'], trim: '#E7B23C' },
};
const CUTS = ['hoodie', 'tee', 'track', 'bomber', 'teeBig'], HAIRY = /afro|mohawk|dreads|top|bun|curly|braids|long/;
const tint = (c, k) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString();
function dress(l, c, i, acc, body) {
  const slots = new Set(acc.map(k => HERO.itemOf && HERO.itemOf(k)).filter(Boolean).map(g => g.slot)), st = CSTY[c.id], r = rng((c.id.length * 131 + c.id.charCodeAt(0) * 17 + i * 7919) >>> 0), C = l.col;
  const at = (a, k = 0) => a[(i + k) % a.length], A = st ? st.acc : c.col;
  if (!slots.has('top')) {
    const t = st ? at(st.cuts) : at(CUTS, c.id.length); l.top = t;
    const long = !/^tee/.test(t), top = st ? at(st.tops) : C.top || '#18181B';
    C.top = top; C.sleeve = long ? (t === 'bomber' && st ? at(st.tops, 1) : top) : null; C.yoke = t === 'track' ? (st ? (top === '#18181B' || top === '#141518' ? A : '#18181B') : C.yoke || '#18181B') : null;
    C.cuff = t === 'hoodie' ? tint(top, .8) : t === 'track' ? (st ? '#18181B' : C.cuff || '#18181B') : t === 'bomber' ? (st ? A : C.cuff || A) : null;
    C.trim = t === 'track' ? (st && st.trim ? st.trim : '#F2EFE8') : t === 'bomber' ? (st ? A : C.trim || '#9A968E') : null;
  }
  if (st) { const lg = at(st.legs); l.pants = lg; C.pants = lg === 'jeans' ? at(['#3E5F8E', '#2E3742', '#55606e']) : at(st.pants); C.stripe = lg === 'trackp' ? (st.trim || A) : null; }
  if (!slots.has('head')) {
    if (body && HAIRY.test(body.style || '')) l.hat = null;
    else { l.hat = at([l.hat || 'cap', null, 'beanie', 'capBack', null], c.id.length); }
    C.hat = l.hat ? (st ? st.hat.slice() : C.hat || ['#18181B', A]) : null;
  }
  if (st && !slots.has('kicks')) { const [a, b, so] = at(st.shoes); C.shoe = a; C.shoe2 = b; C.sole = so; C.lace = a === '#F2EFE8' || a === '#E9E4D8' ? b : '#F2EFE8'; }
  if (!slots.has('ears')) l.phones = !!l.phones && i % 3 === 2;
  if (!slots.has('neck')) l.chain = i % 3 === 0 ? Math.min(1, l.chain || 0) : 0;
  l.wrist = r() < .5 ? A : null;
}
// member i of crew c (ci = its index among the district's crews): the body and the clothes (also used by the line-up test page)
export function crewLook(c, ci, i, D = c.d || 'yard') {
  const acc = c.looks[i], bd = (c.bodies || [])[i], body = bodyOf((D === 'park' ? 900 : D === 'prom' ? 1800 : 0) + ci * 31 + i * 7 + 11, Object.assign({ girl: acc.includes('girl') }, typeof bd === 'string' ? { type: bd } : bd));
  const lk = HERO.topDown(c.base ? c.base + (i % 2) : Math.min(8, c.lv + 2 + (i % 2)), acc);
  dress(lk, c, i, acc, body);
  if (c.fix) c.fix(lk);
  tidy(lk);
  // The crew palette is for their own clothes. Prizes use their inventory colours on everyone.
  for (const token of acc) {
    const gear = HERO.itemOf(token);
    if (!gear?.city) continue;
    Object.assign(lk, gear.f);
    Object.assign(lk.col, gear.col);
  }
  return { lk, body };
}
// after the district's own colours (c.fix): a hoodie is one colour with darker rib cuffs, whatever the fix did to the sleeves
function tidy(l) { if (l.top === 'hoodie') { l.col.sleeve = l.col.top; l.col.cuff = tint(l.col.top, .8); l.col.trim = null; l.col.yoke = null; } }
// the regulars of the underground ring in the industrial zone (nicknames from the reserve list)
const RING = [{ name: _t('Штопор'), col: '#FFB547' }, { name: _t('Гвоздь'), col: '#C9D4E6' }, { name: _t('Магнит'), col: '#FF5A4F' }, { name: _t('Вихрь'), col: '#7CC4FF' }, { name: _t('Пружина'), col: '#7CFF4F' }, { name: _t('Компас'), col: '#FFD23F' }];
// the three dancers of the daily jam on the Park's stage (nicknames from the reserve list)
const JAM = [{ name: _t('Шуруп'), col: '#7CFF4F' }, { name: _t('Ртуть'), col: '#C9D4E6' }, { name: _t('Кобра'), col: '#FFB547' }];
const ART = { rusty: { word: 'RUST', style: 'block', pal: 'rusty', extra: 'cog' }, acid: { word: 'ACID', style: 'bubble', pal: 'acid', extra: 'slime' },
  owls: { word: 'OWLS', style: 'wild', pal: 'owls', extra: 'owl' }, gold: { word: 'GOLD', style: 'd3', pal: 'gold', extra: 'tooth' },
  stencil: { word: 'STENCIL', style: 'stencil', pal: 'stencil', extra: 'can' }, turn: { word: 'METRO', style: 'tile', pal: 'metro', extra: 'token' }, chrome: { word: 'CHROME', style: 'chrome', pal: 'chrome', extra: 'chromo' },
  funk: { word: 'FUNK', style: 'bubble', pal: 'funk', extra: 'boom' }, roots: { word: 'ROOTS', style: 'wild', pal: 'roots', extra: 'leaf' }, wave: { word: 'WAVE', style: 'd3', pal: 'wave', extra: 'surf' },
  rebar: { word: 'REBAR', style: 'block', pal: 'rebar', extra: 'nut' }, volt: { word: 'VOLT', style: 'wild', pal: 'volt', extra: 'zap' }, forge: { word: 'FORGE', style: 'd3', pal: 'forge', extra: 'drop' } };
const MYSTYLE = { rusty: 'block', acid: 'bubble', owls: 'wild', gold: 'd3', stencil: 'stencil', turn: 'tile', chrome: 'chrome', funk: 'bubble', roots: 'wild', wave: 'd3', rebar: 'block', volt: 'wild', forge: 'd3' };
// daily to-do list: 3 a day from this pool; each +5 ★, all three = +15 ⚡
const GOALS = [
  { id: 'win', t: 'Выиграй батл', n: 1 }, { id: 'win2', t: 'Выиграй 2 батла', n: 2, k: 'win' }, { id: 'clean', t: 'Выиграй батл без срывов', n: 1 },
  { id: 'paint', t: 'Закрась стену банды своим граффити', n: 1 }, { id: 'lesson', t: 'Посмотри урок 3 минуты (энергия)', n: 3 },
  { id: 'cypher', t: 'Посмотри выход в сайфере (постой у круга)', n: 1 }, { id: 'strong', t: 'Победи банду 2 уровня или выше', n: 1 },
  { id: 'show', t: 'Выйди сам в круг сайфера', n: 1 }, { id: 'perf', t: 'Нарисуй пауэрмув в батле идеально', n: 1 }, { id: 'train', t: 'Потренируйся на мате 2 раза', n: 2 }, { id: 'dj', t: 'Закажи бит у диджея', n: 1 },
  // only after the Centre has been visited
  { id: 'mall', t: 'Станцуй шоу у ТЦ и не попадись охраннику', n: 1, c: 1 }, { id: 'cwin', t: 'Победи банду Центра', n: 1, c: 1 },
  // only after the Park has been visited
  // only after the industrial zone has been visited
  { id: 'zwin', t: 'Победи банду Промзоны', n: 1, z: 1 }, { id: 'ring', t: 'Выиграй батл на подпольном ринге', n: 1, z: 1 }, { id: 'stash', t: 'Найди 2 тайника в Промзоне', n: 2, z: 1 },
  { id: 'pwin', t: 'Победи банду Парка', n: 1, p: 1 }, { id: 'jam', t: 'Выиграй хотя бы один раунд джема на эстраде', n: 1, p: 1 }, { id: 'og', t: 'Покажи Маятнику, что учился сегодня', n: 1, p: 1 },
];
GOALS.forEach(g => (g.t = _t(g.t)));
const TOP = ['Breakdance_Uprock', 'Breakdance_Uprock_Var_1', 'Bboy_Uprock', 'Brooklyn_Uprock', 'Breakdance_Uprock_Var_2'];
// FOOTWORK VARIETY (owner 17.11.2026 «добавь вариаций футворка во время батлов (слишком однообразно начинают и делают всё)»).
// Was: everyone went down with the same drop and played one of three whole recordings. Now a dancer's footwork is a COMBO of
// phrases cut from the real capture, each danced to the left or to the right (mirrored copies «_M», city3d-mocap.js), at his own
// speed, and the body turns as footwork does — the drop lands facing a new way, every phrase change turns him further round.
// All three recordings start and end in the same crouch (the end of the drop); Footwork_1 passes it again at 1.5 s — those are the
// clean joints. The other cuts (Footwork_3 in two halves, the first steps of the chair-freeze recording) are covered by the cross-fade.
const FW = [
  { c: 'Breakdance_Footwork_1', a: 0, b: 1.5 }, { c: 'Breakdance_Footwork_1', a: 1.5, b: 3.17 }, { c: 'Breakdance_Footwork_2', a: 0, b: 1.6 },
  { c: 'Breakdance_Footwork_3', a: 0, b: 2.3 }, { c: 'Breakdance_Footwork_3', a: 2.3, b: 4.57 }, { c: 'Breakdance_Footwork_To_Freeze', a: 0, b: 1.25 },
];
const side = (c, m) => (m ? c + '_M' : c);
// power: level needed, points, how risky (adds to the fall chance), display name
const POWER = [
  { c: 'Breakdance_Swipes', lv: 1, pts: 2, risk: 0, nm: 'SWIPES' },
  { c: 'Head_Spinning', lv: 2, pts: 3, risk: .05, nm: 'HEADSPIN', pre: 'Headspin_Start', post: 'Headspin_End' },
  { c: 'Flair', lv: 3, pts: 3.5, risk: .08, nm: 'FLARE' },
  { c: 'Breakdance_1990', lv: 4, pts: 4, risk: .1, nm: '1990' },
];
const TOPNM = { Breakdance_Uprock: 'CROSS STEP', Breakdance_Uprock_Var_1: 'KICK STEP', Bboy_Uprock: 'TOPROCK', Brooklyn_Uprock: 'BROOKLYN ROCK', Breakdance_Uprock_Var_2: 'INDIAN STEP' };
// Final holds come from captured freezes. A = entry after a floor or power phrase, len = through the end of the hold.
const FREEZE = [
  { c: 'Breakdance_Footwork_To_Freeze', at: 1.3, len: 2.3, nm: 'CHAIR FREEZE' },
  { c: 'Crossleg_Freeze', at: 0, len: 2.0, nm: 'CROSSLEG FREEZE' },
  { c: 'Breakdance_Freeze_Var_2', at: 1.4, len: 1.75, nm: 'AIR FREEZE', lv: 2, risk: .03 },
  { c: 'Breakdance_Freeze_Var_1', at: 1.5, len: 1.3, nm: 'AIR FREEZE', lv: 2, risk: .03 },
  { c: 'Breakdance_Freeze_Var_4', at: 1.2, len: 1.8, nm: 'BABY FREEZE' },
  { c: 'Breakdance_Freeze_Var_3', at: 1.2, len: 2.3, nm: 'BABY FREEZE' },
];
// straight down from the toprock into a held freeze (the «drop» shape): a = the last standing beat before the clip goes down, b = end of the hold
const FDROP = [
  { c: 'Breakdance_Freeze_Var_4', a: .8, b: 2.9, nm: 'BABY FREEZE' },
  { c: 'Breakdance_Freeze_Var_3', a: .8, b: 3.5, nm: 'BABY FREEZE' },
  { c: 'Breakdance_Freeze_Var_2', a: .9, b: 3.0, nm: 'AIR FREEZE', lv: 2 },
  { c: 'Breakdance_Freezes', a: 1.6, b: 3.85, nm: 'AIR FREEZE', lv: 2 },
];
// floorStart opens on the floor and rises into toprock; rebound goes back up for a second toprock;
// freezeBreak holds a short freeze between two floor phrases.
const SHAPES = ['classic', 'rock', 'drop', 'powerFirst', 'floorStart', 'rebound', 'freezeBreak'];
const ENTRIES = [{ bend: 0, len: 1.28 }, { bend: -.68, len: 1.62 }, { bend: .68, len: 1.62 }];
// turn a dancer by d (rad) round his HIPS: the body turns in place instead of swinging round the middle of the circle
const _yv = new THREE.Vector3(), _UP = new THREE.Vector3(0, 1, 0);
function turnBy(J, d) { if (!d) return; J.root.rotation.y += d; _yv.set(J.dx || 0, 0, J.dz || 0).applyAxisAngle(_UP, -d); J.dx = _yv.x; J.dz = _yv.z; }
// the turns written into a set (s.yaw rad over s.yt s from the start of the step), applied bit by bit every frame
function spinTick(J, T, t) { for (const s of T.seq) if (s.yaw && t >= s.a && (s.yk || 0) < 1) { const k = ease(clamp((t - s.a) / s.yt, 0, 1)); turnBy(J, s.yaw * (k - (s.yk || 0))); s.yk = k; } }

const $ = s => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t * t * (3 - 2 * t);
const today = () => { const d = new Date(); return d.getFullYear() * 1e4 + (d.getMonth() + 1) * 100 + d.getDate(); };
const pick = (a, r) => a[Math.floor(r() * a.length) % a.length];
// Use every option before refilling the pool, including across rounds. Avoid a repeat at the refill boundary.
function rotation(memory, key, options, r) {
  const last = memory[key];
  const pending = memory[key + 'Pending']?.length ? memory[key + 'Pending'] : options.slice();
  const next = pick(pending.length > 1 ? pending.filter(x => x !== last) : pending, r);
  pending.splice(pending.indexOf(next), 1);
  memory[key] = next;
  memory[key + 'Pending'] = pending;
  return next;
}
function rng(seed) { let a = seed >>> 0 || 1; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const sfx = k => { try { window.RB && RB.sfx && RB.sfx(k); } catch (_) {} };
const lessonSec = () => { try { return +(JSON.parse(localStorage.getItem('fedoskin-stats') || '{}').sec || 0); } catch (_) { return 0; } };

// ---------- save ----------
let S;
function load() {
  let s = null; try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) {}
  if (!s || s.v !== 1) s = { v: 1, en: BAL.enStart, day: today(), lsec: lessonSec(), rep: 0, wins: {}, beat: {}, own: [], fights: 0 };
  s.form = s.form || { day: 0, n: 0 }; s.djDay = s.djDay || 0; s.showDay = s.showDay || 0;
  s.turf = s.turf || {}; s.last = s.last || {}; s.goals = s.goals || null; s.word = s.word || '';
  s.seen = s.seen || {}; s.mallDay = s.mallDay || { day: 0, n: 0 }; s.teaDay = s.teaDay || 0; s.where = s.where || 'yard'; s.jamDay = s.jamDay || 0; s.ogDay = s.ogDay || 0; s.warmDay = s.warmDay || 0;
  s.ringDay = s.ringDay || { day: 0, n: 0 }; s.streak = s.streak || 0; s.best = s.best || 0; s.stash = s.stash || { day: 0, got: [] };
  s.cus = Object.assign({ kicks: 0, top: 0, pants: 0, head: 0 }, s.cus || {});
  s.gearProgress = s.gearProgress || {
    dj: Number(Boolean(s.djDay)),
    og: Number(Boolean(s.ogDay)),
    stash: s.stash.got.length,
  };
  s.gearProgress.ringWins ??= s.best;
  s.paintedWalls = s.paintedWalls || Object.keys(s.turf);
  return s;
}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (_) {} };
const gearRewards = Object.entries(HERO.GEAR).filter(([, item]) => item.reward);
function collectGear(activity, wall) {
  if (activity === 'paint') {
    if (!S.paintedWalls.includes(wall)) S.paintedWalls.push(wall);
  } else if (activity) {
    S.gearProgress[activity] = (S.gearProgress[activity] || 0) + 1;
  }
  const rewards = [];
  for (const [id, item] of gearRewards) {
    if (S.own.includes(id) || !item.reward.every(([key, need]) => HERO.cityRewardValue(S, key) >= need)) continue;
    S.own.push(id);
    rewards.push(item.ico + ' ' + _t('Вещь в гардеробе: {x}', { x: _t(item.name) }));
  }
  return rewards;
}
// energy: every new day free up to full (enMax); lessons and rewards stack above it up to enCap
function refill() {
  const notes = [];
  const sec = lessonSec(), d = sec - (S.lsec || 0);
  if (S.day !== today()) {
    const days = dayDiff(S.day, today()); S.day = today(); S.goals = null;
    S.beat = Object.fromEntries(Object.entries(S.beat).filter(([, day]) => day === S.day));
    if (S.en < BAL.daily) { notes.push(_t('☀️ Новый день: энергия до {n} ⚡', { n: BAL.daily })); S.en = BAL.daily; }
    // walls: each of my walls gives respect every new day; a crew not beaten for 3 days paints its wall back
    let rep = 0, lost = [];
    for (const id of Object.keys(S.turf)) { if (dayDiff(S.last[id] || S.turf[id], today()) > BAL.hold) { delete S.turf[id]; lost.push(CREWS.find(c => c.id === id).name); } else rep += BAL.turfRep * Math.min(days, 3); }
    if (rep) { S.rep += rep; notes.push(_t('🎨 Твои стены: +{n} ★', { n: rep })); }
    if (lost.length) notes.push(_t('⚠️ {x} закрасили свою стену обратно', { x: lost.join(', ') }));
  }
  // lessons AFTER the new-day top-up, so minutes watched before a new day are not swallowed by it
  if (d >= 60) { const add = Math.max(0, Math.min(BAL.enCap - S.en, Math.floor(d / 60) * BAL.perMin)); S.lsec += Math.floor(d / 60) * 60; if (add > 0) { S.en += add; notes.push(_t('🎬 Уроки: +{n} ⚡', { n: add })); } }
  else if (d < 0) S.lsec = sec;
  if (!S.goals) { const r = rng(today()); const pool = GOALS.filter(g => (!g.c || S.seen.center) && (!g.p || S.seen.park) && (!g.z || S.seen.prom)); S.goals = [];
    while (S.goals.length < 3) { const g = pool.splice(Math.floor(r() * pool.length), 1)[0]; if (S.goals.some(x => (x.k || x.id) === (g.k || g.id))) continue; S.goals.push({ id: g.id, n: 0, done: false }); }
    S.goalsDay = today(); S.goalsPaid = false; S.lday = sec; }
  if (S.goals) bumpGoal('lesson', Math.floor((sec - (S.lday || sec)) / 60), true);
  save(); return notes;
}
function dayDiff(a, b) { const d = x => new Date(Math.floor(x / 1e4), Math.floor(x / 100) % 100 - 1, x % 100); return Math.round((d(b) - d(a)) / 864e5); }
let onGoal = () => {};
function bumpGoal(id, by = 1, abs = false) {
  if (!S.goals) return; let changed = false;
  for (const g of S.goals) { const G = GOALS.find(x => x.id === g.id); if ((G.k || G.id) !== id || g.done) continue;
    g.n = abs ? Math.max(g.n, by) : g.n + by; if (g.n >= G.n) { g.n = G.n; g.done = true; S.rep += 5; onGoal('✅ ' + G.t + ' · +5 ★'); } changed = true; }
  if (changed && !S.goalsPaid && S.goals.every(g => g.done)) { S.goalsPaid = true; S.en = Math.max(S.en, Math.min(BAL.enCap, S.en + 15)); onGoal(_t('🎉 Все задания дня! +15 ⚡')); }
  if (changed) save();
}
const rankOf = rep => { let i = 0; while (i + 1 < BAL.rep.length && rep >= BAL.rep[i + 1]) i++; return i; };

// ---------- ui ----------
const CSS = `
#g3hud{position:fixed;left:10px;right:10px;top:calc(max(10px,env(safe-area-inset-top)) + 50px);display:flex;gap:8px;z-index:5;pointer-events:none;font:600 12px Inter,sans-serif;color:#F2EFE8;word-break:keep-all;overflow-wrap:anywhere}
#g3hud .chip{pointer-events:auto;background:rgba(12,14,19,.66);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:6px 10px;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);cursor:pointer}
#g3en{flex:1;max-width:190px}#g3en .bar{height:6px;border-radius:3px;background:rgba(255,255,255,.12);margin-top:4px;overflow:hidden}#g3en .bar i{display:block;height:100%;background:linear-gradient(90deg,#FFB547,#E2611A);border-radius:3px;transition:width .5s}#g3en.over #g3enN{color:#FFD24A;text-shadow:0 0 8px rgba(255,210,74,.6)}#g3en.over .bar i{background:linear-gradient(90deg,#FFE27A,#FFB547);box-shadow:0 0 6px #FFD24A}
#g3rk{flex:1}#g3rk b{color:#FFD23F}#g3rk .bar{height:6px;border-radius:3px;background:rgba(255,255,255,.12);margin-top:4px;overflow:hidden}#g3rk .bar i{display:block;height:100%;background:#FFD23F;border-radius:3px;transition:width .6s}
#g3hud2{position:fixed;left:10px;top:calc(max(10px,env(safe-area-inset-top)) + 104px);display:flex;gap:8px;z-index:5;font:600 12px Inter,sans-serif;color:#F2EFE8}
#g3hud2 .chip{background:rgba(12,14,19,.66);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:6px 10px;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);cursor:pointer}
#g3gl.all{border-color:#3BD16F;color:#3BD16F}body.g3fight #g3hud2{opacity:0;pointer-events:none}
#g3info .gl{display:flex;gap:10px;align-items:center;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.07)}#g3info .gl i{font-style:normal;font-size:18px}#g3info .gl .p{margin-left:auto;color:#9a968e;font-weight:700}
#g3info .gl.d{color:#3BD16F}#g3info .gl.d .p{color:#3BD16F}
#g3act{position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom));transform:translateX(-50%) translateY(20px);opacity:0;pointer-events:none;transition:.25s;z-index:6;border:0;border-radius:26px;padding:15px 22px;font:800 15px Inter,sans-serif;color:#0B0D12;background:#E2611A;box-shadow:0 8px 24px rgba(226,97,26,.45);width:max-content;max-width:calc(100vw - 24px);box-sizing:border-box;text-align:center;line-height:1.25}
#g3act.on{opacity:1;transform:translateX(-50%);pointer-events:auto}#g3act.low{background:#2a2d33;color:#F2EFE8;box-shadow:none;border:1px solid rgba(255,255,255,.18);font-weight:700}
#g3act small{display:block;font:600 11px Inter,sans-serif;opacity:.75}
#g3bt{position:fixed;inset:0;z-index:7;pointer-events:none;font-family:Inter,sans-serif;color:#F2EFE8;display:none}
#g3bt.on{display:block}
body.g3fight #g3hud,body.g3fight #hint,body.g3fight .hud .ttl{opacity:0;pointer-events:none}#g3hud,#hint{transition:opacity .3s}
#g3sc{position:absolute;left:50%;top:calc(max(10px,env(safe-area-inset-top)) + 54px);transform:translateX(-50%);display:flex;align-items:center;gap:10px;background:rgba(10,11,15,.78);border:1px solid rgba(255,255,255,.14);border-radius:18px;padding:8px 14px;font:400 18px Anton,sans-serif;letter-spacing:.04em;white-space:nowrap}
#g3sc .me{color:#E2611A}#g3sc .op{color:var(--oc,#7CFF4F)}#g3sc .n{font-size:24px;min-width:40px;text-align:center;color:#F2EFE8}
#g3turn{position:absolute;left:50%;top:calc(max(10px,env(safe-area-inset-top)) + 106px);transform:translateX(-50%);font:600 12px Inter,sans-serif;letter-spacing:.16em;color:#C9C5BC;text-transform:uppercase;width:max-content;max-width:calc(100vw - 32px);text-align:center}
#g3mv{position:absolute;left:50%;bottom:calc(120px + env(safe-area-inset-bottom));transform:translateX(-50%);font:400 30px Anton,sans-serif;letter-spacing:.05em;text-shadow:0 3px 14px #000;white-space:nowrap;transition:transform .2s}
#g3mv.pop{transform:translateX(-50%) scale(1.15)}
#g3mv small{display:block;text-align:center;font:700 14px Inter,sans-serif;letter-spacing:.04em}
#g3mv .ok{color:#3BD16F}#g3mv .bad{color:#FF5A4F}#g3mv .gold{color:#FFD23F}
#g3myth{position:absolute;left:50%;top:48%;width:min(38vw,220px);transform:translate(-50%,-50%);padding:12px;background:radial-gradient(ellipse,#66171f,#180a11 78%);border:1px solid #ee6971;border-radius:18px;pointer-events:none}
#g3myth svg{display:block;width:100%;height:auto;overflow:visible}
#g3skip{position:absolute;right:12px;bottom:calc(24px + env(safe-area-inset-bottom));pointer-events:auto;border:1px solid rgba(255,255,255,.2);background:rgba(12,14,19,.7);color:#F2EFE8;border-radius:18px;padding:9px 14px;font:600 13px Inter,sans-serif}
#g3res{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%) scale(.9);opacity:0;transition:.3s;z-index:8;width:min(340px,88vw);background:rgba(14,16,21,.94);border:1px solid rgba(255,255,255,.14);border-radius:22px;padding:18px;font-family:Inter,sans-serif;color:#F2EFE8;text-align:center;pointer-events:none}
#g3res.on{opacity:1;transform:translate(-50%,-50%);pointer-events:auto}
#g3res h3{margin:2px 0 4px;font:400 34px Anton,sans-serif;letter-spacing:.04em}#g3res h3.w{color:#3BD16F}#g3res h3.l{color:#FF5A4F}
#g3res .jd{display:flex;justify-content:center;gap:10px;margin:10px 0}#g3res .jd i{width:56px;height:70px;border-radius:10px;background:#22252c;display:flex;align-items:center;justify-content:center;font:400 13px Anton,sans-serif;font-style:normal;letter-spacing:.06em;transform:rotateY(90deg);transition:transform .35s}
#g3res .jd i.on{transform:none}#g3res .jd i.me{background:#E2611A;color:#0B0D12}#g3res .jd i.op{background:var(--oc);color:#0B0D12}
#g3res p{margin:6px 0;font-size:14px;line-height:1.4;color:#D9D4CA}#g3res .rw{color:#FFD23F;font-weight:700}
#g3res button{margin-top:10px;width:100%;border:0;border-radius:14px;padding:13px;font:800 15px Inter,sans-serif;background:#E2611A;color:#0B0D12}
#g3res button.sec{background:#2a2d33;color:#F2EFE8;font-weight:700}
#g3toast{position:fixed;left:50%;top:calc(max(10px,env(safe-area-inset-top)) + 104px);transform:translateX(-50%);background:rgba(12,14,19,.88);border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:9px 14px;font:600 13px Inter,sans-serif;color:#F2EFE8;z-index:9;opacity:0;transition:opacity .3s;pointer-events:none;width:max-content;max-width:calc(100vw - 24px);box-sizing:border-box;text-align:center;line-height:1.35}
#g3toast.on{opacity:1}
#g3info{position:fixed;inset:0;background:rgba(5,6,9,.6);z-index:9;display:none;align-items:flex-end;justify-content:center}#g3info.on{display:flex}
#g3info>div{width:min(460px,100%);background:#14161b;border-radius:22px 22px 0 0;padding:18px 18px calc(18px + env(safe-area-inset-bottom));font:500 14px/1.45 Inter,sans-serif;color:#D9D4CA;max-height:80vh;overflow:auto}
#g3info h4{margin:0 0 8px;font:400 22px Anton,sans-serif;letter-spacing:.04em;color:#F2EFE8}#g3info b{color:#F2EFE8}#g3info .row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.07)}
#g3info button{margin-top:12px;width:100%;border:0;border-radius:14px;padding:13px;font:800 15px Inter,sans-serif;background:#E2611A;color:#0B0D12}
#g3info button.sec{background:#262a33;color:#F2EFE8}
#g3info .cu{display:flex;gap:12px;align-items:center;padding:11px 0;border-bottom:1px solid rgba(255,255,255,.07)}#g3info .cu>i{font-style:normal;font-size:26px;width:34px;text-align:center}
#g3info .cu>div{flex:1;min-width:0}#g3info .cu small{display:block;color:#9a968e;font-size:12.5px;line-height:1.35}#g3info .cu small.n{color:#D9D4CA}#g3info .cu .dots{color:#E2611A;letter-spacing:2px;margin-left:6px;font-size:12px}
#g3info .cu button{margin:0;width:auto;flex:none;padding:10px 12px;font-size:13.5px;border-radius:12px;white-space:nowrap}#g3info .cu button:disabled{background:#262a33;color:#7d7a74}
#g3info .cu.max button{background:rgba(59,209,111,.14);color:#3BD16F}
#g3info.cum{background:linear-gradient(rgba(5,6,9,0) 30%,rgba(5,6,9,.55))}#g3info.cum>div{max-height:60vh;padding-top:14px}#g3info.cum p{margin:0 0 4px;font-size:13px}#g3info.cum .cu{padding:8px 0}
#g3info.cum button#g3cuL{margin-top:8px;padding:10px;font-size:13.5px}
`;
function ui() {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const h = document.createElement('div'); h.innerHTML = `
<div id="g3hud"><div class="chip" id="g3en"><span>⚡ <b id="g3enN"></b> ${_t('энергии')}</span><div class="bar"><i></i></div></div>
<div class="chip" id="g3rk"><span>★ <b id="g3rkN"></b> · <span id="g3rkC"></span></span><div class="bar"><i></i></div></div></div>
<div id="g3hud2"><div class="chip" id="g3gl">📋 <b id="g3glN"></b></div><div class="chip" id="g3tf">🎨 <b id="g3tfN"></b></div></div>
<button id="g3act" type="button"></button>
<div id="g3bt"><div id="g3sc"><span class="me">${_t('ТЫ')}</span><span class="n" id="g3a">0</span>:<span class="n" id="g3b">0</span><span class="op" id="g3on"></span></div><div id="g3turn"></div><div id="g3myth" aria-hidden="true" hidden></div><div id="g3mv"></div><button id="g3skip" type="button">${_t('Пропустить')} ⏭</button></div>
<div id="g3res"></div><div id="g3toast"></div><div id="g3info"><div></div></div>`;
  [...h.children].forEach(c => document.body.appendChild(c));
}
let toastT = 0;
function toast(t, rewards = []) { const e = $('#g3toast'); e.textContent = [t, ...rewards].join(' · '); e.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('on'), 2600); }
let NHERE = 4, IDS = [];
function paintHud() {
  $('#g3enN').textContent = S.en + ' / ' + BAL.enMax; $('#g3en .bar i').style.width = Math.min(100, S.en / BAL.enMax * 100) + '%'; $('#g3en').classList.toggle('over', S.en > BAL.enMax);
  const r = rankOf(S.rep), a = BAL.rep[r], b = BAL.rep[r + 1];
  $('#g3rkN').textContent = BAL.ranks[r]; $('#g3rkC').textContent = b ? _t('{a} / {b} уважения', { a: S.rep, b }) : _t('{a} уважения', { a: S.rep });
  $('#g3rk .bar i').style.width = (b ? (S.rep - a) / (b - a) * 100 : 100) + '%';
  const gd = S.goals ? S.goals.filter(g => g.done).length : 0; $('#g3glN').textContent = gd + ' / 3'; $('#g3gl').classList.toggle('all', gd === 3);
  $('#g3tfN').textContent = IDS.filter(id => S.turf[id]).length + ' / ' + NHERE;
}
function info(html) { const e = $('#g3info'); e.firstElementChild.innerHTML = html; e.classList.add('on'); }

// ---------- the game ----------
export function initGame(ctx) {
  // ctx: { scene, W, collide: (x,z,r)=>{x,z}, circ(x,z,r), heroLevel(), shake(k), home() }
  S = load(); ui(); onGoal = t => { toast(t); paintHud(); };
  const D = ctx.dist || 'yard', HERE = CREWS.filter(c => (c.d || 'yard') === D), Bd = ctx.W.bounds;
  if (S.where !== D) { S.where = D; save(); }
  NHERE = HERE.length; IDS = HERE.map(c => c.id);
  const W = ctx.W, scene = ctx.scene, notes = refill();
  const PM = initPower({ W, camera: ctx.camera, sfx });
  if (D === 'center' && !S.seen.center) { S.seen.center = today(); save(); notes.push(_t('🏙 Центр открыт! Банды здесь 3–5 уровня — сильнее дворовых')); }
  if (D === 'park' && !S.seen.park) { S.seen.park = today(); save(); notes.push(_t('🌳 Парк открыт! Банды 5–7 уровня, джем на эстраде и старый би-бой у шахматных столов')); }
  if (D === 'prom' && !S.seen.prom) { S.seen.prom = today(); save(); notes.push(_t('🏭 Промзона открыта! Банды 6–8 уровня, подпольный ринг и тайники')); }
  const previousRewards = collectGear();
  if (previousRewards.length) { notes.push(...previousRewards); save(); }
  paintHud(); if (notes.length) setTimeout(() => toast(notes.join(' · ')), 900);
  addEventListener('visibilitychange', () => { if (!document.hidden) { const n = refill(); paintHud(); if (n.length) toast(n.join(' · ')); } });
  $('#g3en').onclick = () => info(`<h4>${_t('⚡ Энергия')}</h4><p>${_t('Каждый батл с бандой стоит <b>{n} ⚡</b>. Каждый новый день энергия бесплатно восстанавливается до <b>{m} ⚡</b>.', { n: BAL.battle, m: BAL.daily })}</p>
    <p>${_t('<b>Уроки</b> и награды в городе добавляют энергию сверх {m}: каждая минута урока = <b>+{n} ⚡</b>. Запас копится до {c} ⚡ и не сгорает.', { n: BAL.perMin, m: BAL.enMax, c: BAL.enCap })}</p>
    <p>${_t('Сила твоего би-боя тоже из уроков: чем выше уровень героя, тем сложнее пауэр он крутит и тем реже падает.')}</p><button onclick="location.href='./'">${_t('🎬 К урокам')}</button>`);
  $('#g3info').onclick = e => { if (e.target.id === 'g3info') e.currentTarget.classList.remove('on'); };
  $('#g3rk').onclick = () => { const r = rankOf(S.rep), lv = ctx.heroLevel();
    info(`<h4>${_t('★ Прогресс')}</h4>${BAL.ranks.map((n, i) => `<div class="row"><span>${i <= r ? '✅' : '🔒'} ${n}</span><span>${BAL.rep[i]} ★</span></div>`).join('')}
    <p style="margin-top:10px">${_t('Побеждай банды — получай уважение и их шмотки (они видны на тебе и помогают в батлах).')}</p>
    ${HERE.map(c => `<div class="row"><span style="color:${c.col}">${c.name} · ${_t('ур. {n}', { n: c.lv })}${c.boss ? ' · ' + _t('хозяева района') : ''}</span><span>${S.wins[c.id] ? '🏆 ' + S.wins[c.id] : (lv >= c.lv ? _t('по силам') : _t('сильнее тебя'))}</span></div>`).join('')}
    <p>${_t('Твой уровень: <b>{n}</b> — растёт от минут уроков.', { n: lv })}</p><button onclick="this.closest('#g3info').classList.remove('on')">${_t('Понятно')}</button>`); };

  $('#g3gl').onclick = () => info(`<h4>${_t('📋 Задания на сегодня')}</h4>${S.goals.map(g => { const G = GOALS.find(x => x.id === g.id);
      return `<div class="gl ${g.done ? 'd' : ''}"><i>${g.done ? '✅' : '⬜'}</i><span>${G.t}</span><span class="p">${g.n} / ${G.n}</span></div>`; }).join('')}
    <p style="margin-top:10px">${_t('За каждое задание <b>+5 ★</b>. Все три — <b>+15 ⚡</b>{x}. Завтра будут новые.', { x: S.goalsPaid ? _t(' (уже получено ✓)') : '' })}</p><button onclick="this.closest('#g3info').classList.remove('on')">${_t('Понятно')}</button>`);
  $('#g3tf').onclick = () => info(`<h4>${_t('🎨 Стены района')}</h4><p>${_t('У каждой банды своя стена с граффити. <b>Победи банду</b> — и в тот же день можешь закрасить её стену своим куском (−{n} ⚡).', { n: BAL.paint })}</p>
    <p>${_t('Каждая твоя стена даёт <b>+{n} ★ каждый день</b>. Если банду не побеждать {d} дня, она закрасит стену обратно.', { n: BAL.turfRep, d: BAL.hold })}</p>
    ${HERE.map(c => `<div class="row"><span style="color:${c.col}">${c.name}</span><span>${S.turf[c.id] ? _t('🎨 твоя') : S.beat[c.id] === today() ? _t('🟢 можно закрасить') : '—'}</span></div>`).join('')}
    <button onclick="this.closest('#g3info').classList.remove('on')">${_t('Понятно')}</button>`);

  // crews of this district
  const crews = HERE.map((c, ci) => {
    const g = { c, people: [], x: c.at[0], z: c.at[1] };
    const r = rng(ci * 77 + 3);
    c.looks.forEach((acc, i) => {
      const { lk, body } = crewLook(c, ci, i, D), J = mocapPerson(lk, { body });
      // Spectators line the flanks, clear of the entrances from the north and south.
      const flank = (ci + i) % 2 ? -1 : 1;
      J.home = i === 0 ? { x: g.x + Math.cos(ci) * 1.35, z: g.z + Math.sin(ci) * 1.35 }
        : { x: g.x + flank * 1.92, z: g.z + (i < 3 ? flank * .35 : -flank * 1.02) };
      J.root.position.set(J.home.x, 0, J.home.z);
      J.root.rotation.y = Math.atan2(g.x - J.home.x, g.z - J.home.z);
      J.play(i === 0 ? pick(TOP, r) : 'Breakdance_Ready', { at: r() * 2, speed: .9 + r() * .2 });
      scene.add(J.root); g.people.push(J); ctx.circ(J.home.x, J.home.z, .3);
    });
    // ground ring + floating name
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256; const x = cv.getContext('2d');
    x.strokeStyle = c.col; x.lineWidth = 10; x.setLineDash([26, 16]); x.beginPath(); x.arc(128, 128, 112, 0, 7); x.stroke();
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, opacity: .6, toneMapped: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(g.x, .02, g.z); scene.add(ring); g.ring = ring;
    const lc = document.createElement('canvas'); lc.width = 512; lc.height = 128; const lx = lc.getContext('2d');
    lx.font = '400 64px Anton, sans-serif'; lx.textAlign = 'center'; { const m = lx.measureText(c.name.toUpperCase()).width; if (m > 370) lx.font = '400 ' + Math.floor(64 * 370 / m) + 'px Anton, sans-serif'; }
    lx.fillStyle = 'rgba(10,11,15,.72)'; const tw = lx.measureText(c.name.toUpperCase()).width + 120;
    lx.beginPath(); lx.roundRect(256 - tw / 2, 14, tw, 100, 50); lx.fill(); lx.fillStyle = c.col; lx.fillText(c.name.toUpperCase(), 236, 88);
    lx.fillStyle = '#F2EFE8'; lx.font = '700 40px Inter, sans-serif'; lx.fillText(c.lv, 256 + tw / 2 - 52, 84);
    const lab = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(lc), depthTest: false, toneMapped: false }));
    lab.scale.set(2.6, .65, 1); lab.position.set(g.x, 2.7, g.z); lab.renderOrder = 10; scene.add(lab); g.label = lab;
    return g;
  });
  // ---------- crew walls (graffiti turf) ----------
  const wallMat = new THREE.MeshStandardMaterial({ color: '#4d4f55', roughness: .95 }), capMat = new THREE.MeshStandardMaterial({ color: '#2f3136', roughness: .9 });
  const nick = () => { if (S.word) return S.word; try { const n = (JSON.parse(localStorage.getItem('fedoskin-profile') || '{}').nick || '').replace(/^b[-_ ]?(boy|girl)\s*/i, ''); return (n || 'FT').toUpperCase().slice(0, 8); } catch (_) { return 'FT'; } };
  function artCanvas(kind, c) {
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 480; const x = cv.getContext('2d');
    // worn concrete under the paint
    x.fillStyle = '#55575d'; x.fillRect(0, 0, 1024, 480);
    for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(${Math.random() < .5 ? '0,0,0' : '255,255,255'},${Math.random() * .06})`; x.fillRect(Math.random() * 1024, Math.random() * 480, 2 + Math.random() * 30, 2 + Math.random() * 30); }
    if (window.CITY_GFX && CITY_GFX.graf) {
      const a = kind === 'me' ? { word: nick(), style: MYSTYLE[c.id], pal: 'fire', extra: 'crown' } : ART[c.id];
      try { const g = CITY_GFX.graf(Object.assign({ w: 980, h: 420, seed: kind === 'me' ? 11 : 5 }, a)); x.drawImage(g, 22, 30, 980, 420); } catch (_) {}
    }
    return cv;
  }
  function placeWall(g) {
    if (g.c.wall) return { x: g.c.wall[0], z: g.c.wall[1] };
    // a free spot ~2.8 m from the crew, preferring the side away from the middle of the yard
    const out = Math.atan2(g.z, g.x), cands = [];
    for (let i = 0; i < 16; i++) { const a = out + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * Math.PI / 8, x = g.x + Math.cos(a) * 2.9, z = g.z + Math.sin(a) * 2.9;
      if (x < Bd.x0 + .8 || x > Bd.x1 - .8 || z < Bd.z0 + .8 || z > Bd.z1 - .8) continue;
      const free = (ctx.colliders || []).every(c => c.r !== undefined ? Math.hypot(x - c.x, z - c.z) > c.r + 1.8 : Math.hypot(x - clamp(x, c.x0, c.x1), z - clamp(z, c.z0, c.z1)) > 1.8);
      if (free) { cands.push({ x, z }); break; } }
    return cands[0] || { x: g.x + Math.cos(out) * 2.9, z: g.z + Math.sin(out) * 2.9 };
  }
  crews.forEach(g => {
    const at = placeWall(g), grp = new THREE.Group(); grp.position.set(at.x, 0, at.z); grp.rotation.y = Math.atan2(g.x - at.x, g.z - at.z); scene.add(grp);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.2, .28), wallMat); slab.position.y = 1.1; slab.castShadow = slab.receiveShadow = true; grp.add(slab);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(3.75, .12, .38), capMat); cap.position.y = 2.26; grp.add(cap);
    const cv = artCanvas(S.turf[g.c.id] ? 'me' : 'crew', g.c), tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const art = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.6), new THREE.MeshStandardMaterial({ map: tex, roughness: .85 })); art.position.set(0, 1.12, .145); grp.add(art);
    g.wall = { grp, at, cv, tex, x: at.x + Math.sin(grp.rotation.y) * 1.2, z: at.z + Math.cos(grp.rotation.y) * 1.2 };
    if (ctx.box) { const c = Math.cos(grp.rotation.y), sn = Math.abs(Math.sin(grp.rotation.y)); ctx.box(at.x, at.z, 3.6 * Math.abs(c) + .3 * sn + .1, 3.6 * sn + .3 * Math.abs(c) + .1); }
  });
  const canPaint = g => S.beat[g.c.id] === today() && !S.turf[g.c.id];
  let P = null;   // painting in progress
  function startPaint(g) {
    if (S.en < BAL.paint) { toast(_t('Нужно {n} ⚡ — посмотри урок', { n: BAL.paint })); return; }
    S.en -= BAL.paint; save(); paintHud();
    const H = W.hero, w = g.wall; P = { g, t: 0, from: { x: H.root.position.x, z: H.root.position.z }, old: artCanvas('crew', g.c), neu: artCanvas('me', g.c) };
    W.lock = true; W.camT = { x: w.at.x, z: w.at.z + .6, zoom: .5 }; document.body.classList.add('g3fight');
    H.play('Breakdance_Ready', { fade: .3 }); try { window.RB && RB.hiss && RB.hiss(true); } catch (_) {}
    paintAct();
  }
  function paintTick(dt) {
    const H = W.hero, w = P.g.wall; P.t += dt; const walk = ease(clamp(P.t / .9, 0, 1)), k = clamp((P.t - 1) / 3.2, 0, 1);
    H.root.position.set(lerp(P.from.x, w.x, walk), 0, lerp(P.from.z, w.z, walk)); H.root.rotation.y = Math.atan2(w.at.x - H.root.position.x, w.at.z - H.root.position.z);
    // the new piece is sprayed over the old one from left to right, with a soft wet edge
    const x = w.cv.getContext('2d'), W2 = 1024 * k; x.drawImage(P.old, 0, 0); x.save(); x.beginPath(); x.rect(0, 0, W2, 480); x.clip(); x.drawImage(P.neu, 0, 0); x.restore();
    if (k > 0 && k < 1) { x.fillStyle = 'rgba(255,255,255,.18)'; for (let i = 0; i < 26; i++) x.fillRect(W2 - 6 + Math.random() * 14, Math.random() * 480, 3, 3); }
    w.tex.needsUpdate = true;
    // a little arm movement while spraying
    H.tick(dt); if (P.t > 1) { const a = Math.sin(P.t * 9) * .35; H.B.RightArm.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -1.1 + a)); }
    if (P.t > 4.4) endPaint();
  }
  function endPaint() {
    const g = P.g; P = null; try { window.RB && RB.hiss && RB.hiss(false); } catch (_) {}
    S.turf[g.c.id] = today(); S.last[g.c.id] = today(); S.rep += BAL.repPaint;
    const rewards = collectGear('paint', g.c.id);
    bumpGoal('paint'); save(); paintHud();
    W.lock = false; W.camT = null; document.body.classList.remove('g3fight'); W.hero.play('Bboy_Uprock', { fade: .3 });
    toast(_t('🎨 Стена «{x}» теперь твоя! +{a} ★, и +{b} ★ каждый день', { x: g.c.name, a: BAL.repPaint, b: BAL.turfRep }), rewards);
    if (IDS.every(id => S.turf[id])) setTimeout(() => toast(_t(ALLMINE[D] || ALLMINE.yard)), 2800);
    near = null; paintAct();
  }
  // put the won piece of street gear on at once (shared wardrobe: fedoskin-eq, one item per slot)
  function wearGear(gid) {
    try { const k = 'c:' + gid, slot = HERO.itemOf(k).slot; let eq = JSON.parse(localStorage.getItem('fedoskin-eq') || '[]') || [];
      eq = eq.filter(x => x !== k && (!HERO.itemOf(x) || HERO.itemOf(x).slot !== slot)).concat(k); localStorage.setItem('fedoskin-eq', JSON.stringify(eq)); ctx.rewear && ctx.rewear(); } catch (_) {}
  }

  // ---------- places with actions (16.11.2026 «добавляй локации и действия») ----------
  const freeNear = (px, pz, clear) => { for (let ring = 0; ring < 6; ring++) for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, x = px + Math.cos(a) * ring * .8, z = pz + Math.sin(a) * ring * .8;
      if (x < Bd.x0 + .8 || x > Bd.x1 - .8 || z < Bd.z0 + .8 || z > Bd.z1 - .8) continue;
      if ((ctx.colliders || []).every(c => c.r !== undefined ? Math.hypot(x - c.x, z - c.z) > c.r + clear : Math.hypot(x - clamp(x, c.x0, c.x1), z - clamp(z, c.z0, c.z1)) > clear)) return { x, z }; }
    return { x: px, z: pz }; };
  const M = (c, r = .7, m = 0, e) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, emissive: e || '#000', emissiveIntensity: e ? 1.6 : 0 });
  const mk = (g, geo, mat, x, y, z) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
  const label = (txt, col, x, z, y = 2.5) => { txt = _t(txt); const lc = document.createElement('canvas'); lc.width = 512; lc.height = 128; const lx = lc.getContext('2d');
    lx.font = '400 60px Anton, sans-serif'; lx.textAlign = 'center'; { const m = lx.measureText(txt).width; if (m > 430) lx.font = '400 ' + Math.floor(60 * 430 / m) + 'px Anton, sans-serif'; } const tw = lx.measureText(txt).width + 70; lx.fillStyle = 'rgba(10,11,15,.72)'; lx.beginPath(); lx.roundRect(256 - tw / 2, 18, tw, 92, 46); lx.fill();
    lx.fillStyle = col; lx.fillText(txt, 256, 86); const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(lc), depthTest: false, toneMapped: false }));
    sp.scale.set(2.4, .6, 1); sp.position.set(x, y, z); sp.renderOrder = 10; scene.add(sp); return sp; };
  const C0 = W.cyph || { x: 1.5, z: -7.2 };
  const Y = D !== 'yard' ? null : (() => {
  // DJ booth by the cypher: a table, two decks with spinning records, a mixer, a laptop glow and a DJ
  const djAt = freeNear(C0.x + 4.2, C0.z + 2.6, 1.3), dj = new THREE.Group(); dj.position.set(djAt.x, 0, djAt.z); dj.rotation.y = Math.atan2(C0.x - djAt.x, C0.z - djAt.z); scene.add(dj);
  mk(dj, new THREE.BoxGeometry(1.7, .9, .7), M('#1b1d22', .6), 0, .45, 0); mk(dj, new THREE.BoxGeometry(1.75, .05, .75), M('#2c2f36', .4, .3), 0, .92, 0);
  const recs = [-.48, .48].map(x => { mk(dj, new THREE.CylinderGeometry(.27, .27, .04, 24), M('#3a3d44', .5, .4), x, .96, 0); const r = mk(dj, new THREE.CylinderGeometry(.24, .24, .02, 24), M('#0c0c0e', .3), x, .99, 0);
    mk(r, new THREE.CylinderGeometry(.07, .07, .021, 16), M('#E2611A', .5, 0, '#E2611A'), 0, .001, 0); return r; });
  mk(dj, new THREE.BoxGeometry(.3, .05, .4), M('#25282e', .5), 0, .97, 0);
  const strip = mk(dj, new THREE.BoxGeometry(1.6, .04, .02), M('#E2611A', .4, 0, '#E2611A'), 0, .2, .36);
  const djP = mocapPerson(HERO.topDown(6, ['c:djGloves'].filter(k => HERO.itemOf && HERO.itemOf(k))), { body: bodyOf(5, { type: 'heavy', style: 'dreads', beard: true }) }); djP.root.position.set(0, 0, -.75); dj.add(djP.root); djP.play('Breakdance_Ready', { speed: .8 });
  ctx.circ && ctx.circ(djAt.x, djAt.z, .95); const djLab = label('ДИДЖЕЙ', '#FFB547', djAt.x, djAt.z, 2.3);
  const djFront = { x: djAt.x + Math.sin(dj.rotation.y) * 1.1, z: djAt.z + Math.cos(dj.rotation.y) * 1.1 };
  // practice mat: a padded mat with taped lines and a pair of cones
  const matAt = freeNear(9.6, 3.6, 1.6), mat = new THREE.Group(); mat.position.set(matAt.x, 0, matAt.z); scene.add(mat);
  mk(mat, new RoundedBoxGeometry(2.6, .06, 2.6, 2, .02), M('#2b3f63', .9), 0, .03, 0);
  [-1, 1].forEach(k => { mk(mat, new THREE.BoxGeometry(2.4, .005, .05), M('#e9e4d8', .8), 0, .065, k * 1.1); mk(mat, new THREE.ConeGeometry(.12, .3, 10), M('#E2611A', .6), k * 1.45, .15, 1.45 * k); });
  const matLab = label('ТРЕНИРОВКА', '#7CC4FF', matAt.x, matAt.z, 2.2);
  // the tailor «Игла» (16.11.2026 custom): a stall with a sewing machine, a rack of jackets, a dummy with a back patch, a neon sign
  const atAt = freeNear(8.6, -2.2, 1.9), at = new THREE.Group(); at.position.set(atAt.x, 0, atAt.z); scene.add(at);   // faces +z: the camera sees the sign, the tailor and the rack
  mk(at, new RoundedBoxGeometry(3.4, .04, 2.2, 2, .015), M('#3a2a2a', .95), 0, .02, -.1);                              // a worn rug
  mk(at, new THREE.BoxGeometry(1.5, .06, .72), M('#6b4a32', .6), 0, .8, 0); [[-.68, -.3], [.68, -.3], [-.68, .3], [.68, .3]].forEach(([x, z]) => mk(at, new THREE.BoxGeometry(.06, .78, .06), M('#2a2c31', .6, .4), x, .39, z));
  { const sm = new THREE.Group(); sm.position.set(-.2, .83, 0); at.add(sm); const wm = M('#CFC9BC', .4, .1);   // the sewing machine
    mk(sm, new RoundedBoxGeometry(.5, .08, .22, 2, .02), wm, 0, .04, 0); mk(sm, new RoundedBoxGeometry(.1, .24, .16, 2, .03), wm, .2, .2, 0);
    mk(sm, new RoundedBoxGeometry(.46, .09, .15, 2, .03), wm, .02, .33, 0); mk(sm, new RoundedBoxGeometry(.07, .1, .1, 2, .02), wm, -.2, .25, 0);
    mk(sm, new THREE.CylinderGeometry(.06, .06, .03, 16), M('#2a2c31', .5, .5), .27, .26, .1).rotation.x = Math.PI / 2;
    mk(sm, new THREE.CylinderGeometry(.004, .004, .06, 6), M('#c9c4b8', .3, .9), -.2, .17, 0); mk(sm, new THREE.BoxGeometry(.18, .005, .16), M('#E2611A', .8), -.2, .085, 0); }
  [['#E2611A', .35, .2], ['#3BD16F', .5, -.15], ['#F2EFE8', .2, -.05]].forEach(([c, x, z]) => mk(at, new THREE.CylinderGeometry(.035, .035, .07, 12), M(c, .7), x, .865, z));   // spools
  const rack = new THREE.Group(); rack.position.set(.2, 0, -.9); at.add(rack);                                         // the rack with jackets
  [-.8, .8].forEach(x => mk(rack, new THREE.CylinderGeometry(.025, .025, 1.7, 8), M('#9a9da4', .35, .8), x, .85, 0)); mk(rack, new THREE.CylinderGeometry(.02, .02, 1.7, 8), M('#9a9da4', .35, .8), 0, 1.68, 0).rotation.z = Math.PI / 2;
  [['#18181B', -.5], ['#7A2FB8', -.12], ['#2F7BFF', .26], ['#C8202A', .6]].forEach(([c, x], i) => { const j = mk(rack, new RoundedBoxGeometry(.34, .55, .08, 2, .03), M(c, .85), x, 1.34, 0); j.rotation.y = .5 - i * .15;
    mk(j, new THREE.CircleGeometry(.05, 14), M(i % 2 ? '#FFD23F' : '#E2611A', .8), .06, .12, .042); mk(rack, new THREE.TorusGeometry(.05, .006, 4, 10, Math.PI), M('#9a9da4', .35, .8), x, 1.66, 0); });
  { const dm = new THREE.Group(); dm.position.set(1.25, 0, -.4); dm.rotation.y = -2.73; at.add(dm);                  // the dummy shows its back patch
    mk(dm, new THREE.CylinderGeometry(.02, .02, 1.1, 8), M('#2a2c31', .5, .5), 0, .55, 0); mk(dm, new THREE.CylinderGeometry(.18, .02, .04, 12), M('#2a2c31', .5, .5), 0, .02, 0);
    const tor = mk(dm, new RoundedBoxGeometry(.42, .55, .24, 3, .1), M('#18181B', .8), 0, 1.3, 0);
    const bp = new THREE.Mesh(new THREE.CircleGeometry(.14, 26), M('#F2EFE8', .8)); bp.position.set(0, .04, -.125); bp.rotation.y = Math.PI; tor.add(bp);
    const bp2 = new THREE.Mesh(new THREE.CircleGeometry(.12, 26), M('#E2611A', .8, 0, '#E2611A')); bp2.material.emissiveIntensity = .25; bp2.position.set(0, .04, -.127); bp2.rotation.y = Math.PI; tor.add(bp2); }
  const sg = document.createElement('canvas'); sg.width = 512; sg.height = 128; { const x = sg.getContext('2d'); x.font = '400 92px Anton, sans-serif'; x.textAlign = 'center'; x.shadowColor = '#FF4FD8'; x.shadowBlur = 18; x.fillStyle = '#FFB3F0'; const s = _t('КАСТОМ'), m = x.measureText(s).width; if (m > 490) x.font = '400 ' + Math.floor(92 * 490 / m) + 'px Anton, sans-serif'; x.fillText(s, 256, 102); }
  const atSign = mk(at, new THREE.PlaneGeometry(1.5, .37), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sg), transparent: true, toneMapped: false, color: new THREE.Color(.8, .8, .8) }), -.35, 2.5, -.9);   // 2.05 → 2.5: was hidden behind the place's name
  [-1.05, .35].forEach(x => mk(at, new THREE.CylinderGeometry(.02, .02, 2.55, 6), M('#2a2c31', .5, .5), x, 1.27, -.92));
  const atP = mocapPerson(HERO.topDown(5, []), { body: bodyOf(77, { girl: true, type: 'slim', style: 'bun' }), idle: 'Stand_Calm' }); atP.root.position.set(0, 0, -.55); at.add(atP.root); atP.play('Breakdance_Ready');
  ctx.circ && ctx.circ(atAt.x, atAt.z, .95); ctx.box && ctx.box(atAt.x + .2, atAt.z - .9, 1.8, .3); ctx.circ && ctx.circ(atAt.x + 1.25, atAt.z - .4, .3);
  { // a bare bulb on a wire over the table and its warm light on the stall (the corner was dark)
    mk(at, new THREE.CylinderGeometry(.006, .006, .7, 4), M('#111', .9), .05, 2.55, .1); const bulb = mk(at, new THREE.SphereGeometry(.07, 12, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.35, 1.1, .75), toneMapped: false }), .05, 2.17, .1); bulb.castShadow = false;
    const sp = new THREE.SpotLight('#ffcf9a', 20, 0, 1.05, .85, 2); /* 46 → 20 (17.11.2026): the table and the cloth burnt out white */ sp.position.set(atAt.x + .05, 2.12, atAt.z + .1); sp.target.position.set(atAt.x + .1, 0, atAt.z + .75); scene.add(sp, sp.target); }
  const atLab = label('АТЕЛЬЕ «ИГЛА»', '#FFB3F0', atAt.x, atAt.z, 2.7);
  const atFront = { x: atAt.x, z: atAt.z + 1.25 };
  // the gate to the next district: an arch with a lit sign, closed by a chain until the right rank
  const gAt = freeNear(-1.2, -14.2, 1.4), gate = new THREE.Group(); gate.position.set(gAt.x, 0, gAt.z); scene.add(gate);
  [-1.4, 1.4].forEach(x => mk(gate, new THREE.BoxGeometry(.35, 3, .35), M('#3a3c42', .8), x, 1.5, 0));
  mk(gate, new THREE.BoxGeometry(3.2, .45, .4), M('#2a2c31', .7), 0, 3.1, 0);
  const gSign = document.createElement('canvas'); gSign.width = 512; gSign.height = 64; const gx = gSign.getContext('2d'); gx.fillStyle = '#E2611A'; gx.font = '400 46px Anton, sans-serif'; gx.textAlign = 'center'; { const s = _t('ЦЕНТР  →'), m = gx.measureText(s).width; if (m > 496) gx.font = '400 ' + Math.floor(46 * 496 / m) + 'px Anton, sans-serif'; gx.fillText(s, 256, 50); }
  mk(gate, new THREE.PlaneGeometry(2.9, .36), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(gSign), transparent: true, toneMapped: false }), 0, 3.1, .21);
  const chain = mk(gate, new THREE.BoxGeometry(2.5, .06, .06), M('#c9c4b8', .3, .9), 0, 1.1, 0);
  ctx.circ && ctx.circ(gAt.x - 1.4, gAt.z, .3); ctx.circ && ctx.circ(gAt.x + 1.4, gAt.z, .3); ctx.box && ctx.box(gAt.x, gAt.z, 2.4, .2);
  const PLACES = [
    { id: 'show', x: C0.x, z: C0.z + 3.2, r: 1.5 }, { id: 'dj', x: djFront.x, z: djFront.z, r: 1.4 }, { id: 'mat', x: matAt.x, z: matAt.z, r: 1.7 }, { id: 'gate', x: gAt.x, z: gAt.z + 1.2, r: 1.7 },
    { id: 'atelier', x: atFront.x, z: atFront.z, r: 1.6 },
  ];
  return { recs, strip, djP, djLab, matAt, matLab, chain, atP, atLab, atSign, atFront, PLACES }; })();
  const { recs = [], strip = null, djP = null, djLab = null, matAt = null, matLab = null, chain = null, atP = null, atLab = null, atSign = null, atFront = null } = Y || {};
  // the Centre's places are built by city3d-center.js (W.center); here is only what they do
  const CN = W.center || null;
  const PLACES = Y ? Y.PLACES : !CN ? [] : [
    { id: 'mall', x: CN.show.x, z: CN.show.z, r: 1.9 }, { id: 'tea', x: CN.kiosk.x, z: CN.kiosk.z, r: 1.5 }, { id: 'metro', x: CN.metro.x, z: CN.metro.z, r: 1.7 },
    { id: 'yard', x: CN.gateYard.x, z: CN.gateYard.z, r: 1.4 }, { id: 'park', x: CN.gatePark.x, z: CN.gatePark.z, r: 1.7 },
  ];
  // the Park's places are built by city3d-park.js (W.park)
  const PK = W.park || null;
  if (PK) PLACES.push({ id: 'jam', x: PK.stage.x, z: PK.stage.z + 1.9, r: 2.1 }, { id: 'og', x: PK.og.x, z: PK.og.z, r: 1.6 }, { id: 'bars', x: PK.bars.x, z: PK.bars.z, r: 1.7 },
    { id: 'pcenter', x: PK.gateCenter.x, z: PK.gateCenter.z, r: 1.4 }, { id: 'prom', x: PK.gateProm.x, z: PK.gateProm.z, r: 1.5 });
  // the industrial zone's places are built by city3d-prom.js (W.prom): the ring, today's three stashes, the arches
  const PZ = W.prom || null;
  const stashToday = () => { const r = rng(today() * 7 + 5), idx = PZ.stash.map((_, i) => i), out = []; while (out.length < BAL.stashN) out.push(idx.splice(Math.floor(r() * idx.length), 1)[0]); return out; };
  if (PZ) { if (S.stash.day !== today()) { S.stash = { day: today(), got: [] }; save(); }
    PLACES.push({ id: 'ring', x: PZ.ring.x, z: PZ.ring.z + PZ.ring.r + .6, r: 2 }, { id: 'zpark', x: PZ.gatePark.x, z: PZ.gatePark.z, r: 1.4 }, { id: 'club', x: PZ.gateClub.x, z: PZ.gateClub.z, r: 1.6 });
    stashToday().forEach(i => { const s = PZ.stash[i]; s.g.visible = !S.stash.got.includes(i); if (s.g.visible) { ctx.circ && ctx.circ(s.x, s.z, .42); PLACES.push({ id: 'stash', i, x: s.x, z: s.z, r: 1.5 }); } }); }
  const lesMin = () => Math.max(0, Math.floor((lessonSec() - (S.lday || lessonSec())) / 60));
  const myWalls = () => IDS.filter(id => S.turf[id]).length;
  // moving between districts: the save remembers where I am, the page builds that district
  function travel(to) { S.where = to; save(); try { sessionStorage.setItem('fedoskin-city3d-from', D); } catch (_) {}
    const f = document.createElement('div'); f.style.cssText = 'position:fixed;inset:0;background:#0B0D12;opacity:0;transition:opacity .35s;z-index:20'; document.body.appendChild(f); requestAnimationFrame(() => (f.style.opacity = 1));
    setTimeout(() => { const u = new URL(location.href); u.searchParams.delete('d'); location.replace(u.toString()); }, 400); }
  function metroMap() { const boss = S.wins.chrome || S.seen.park;
    info(`<h4>${_t('🚇 Метро — карта города')}</h4>
      <div class="row"><span>${_t('🏠 Двор')}</span><span>${_t('открыт')}</span></div><div class="row"><span>${_t('🏙 <b>Центр</b>')}</span><span>${_t('ты здесь')}</span></div>
      <div class="row"><span>${_t('🌳 Парк и набережная')}</span><span>${boss ? _t('открыт') : _t('🔒 победи «Хромированных»')}</span></div>
      <div class="row"><span>${_t('🏭 Промзона')}</span><span>${S.wins.wave || S.seen.prom ? _t('открыта — вход из Парка') : _t('🔒 победи «Волну» в Парке')}</span></div><div class="row"><span>${_t('🪩 Клуб')}</span><span>${S.wins.forge ? _t('🚧 строится') : _t('🔒 победи «Литейку» в Промзоне')}</span></div>
      <p style="margin-top:10px">${_t('Новые районы открываются, когда побеждаешь хозяев предыдущего. Диджей, тренировочный мат и сайфер ждут во дворе — их бонусы действуют весь день и здесь.')}</p>
      ${boss ? `<button id="g3gp">${_t('🌳 Поехать в Парк')}</button>` : ''}<button id="g3go" class="sec">${_t('🏠 Поехать во двор')}</button>`); $('#g3go').onclick = () => travel('yard'); if ($('#g3gp')) $('#g3gp').onclick = () => travel('park'); }
  // what each place offers right now (button text) and what it does
  function placeBtn(pl) {
    const t = today();
    if (pl.id === 'show') return S.showDay === t ? { off: true, h: _t('🔥 Ты уже выходил в круг сегодня'), s: _t('Завтра снова — а пока батлы с бандами') } : { h: _t('🔥 Выйти в круг сайфера'), s: _t('Бесплатно раз в день · до +{n} ★', { n: BAL.repShow + BAL.repShowClean }) };
    if (pl.id === 'dj') return S.djDay === t ? { off: true, h: _t('🎧 Бит качает до конца дня'), s: _t('Меньше срывов и больше стиля в батлах') } : { h: _t('🎧 Заказать бит · −{n} ⚡', { n: BAL.dj }), s: _t('На весь день: меньше срывов, больше стиля'), low: S.en < BAL.dj };
    if (pl.id === 'mat') { const n = S.form.day === t ? S.form.n : 0; return n >= BAL.trainMax ? { off: true, h: _t('💪 Форма на максимуме сегодня'), s: _t('Срывов в батлах меньше на {n}%', { n: 3 * n }) } : { h: _t('💪 Тренировать пауэр · −{n} ⚡', { n: BAL.train }), s: _t('Форма {n} / {m} — каждая: −3% срывов сегодня', { n, m: BAL.trainMax }), low: S.en < BAL.train }; }
    if (pl.id === 'atelier') { const left = CUS.reduce((a, c) => a + 3 - (S.cus[c.id] || 0), 0);
      return { h: _t('🧵 Ателье «Игла» — кастом шмота'), s: left ? _t('Нашивки, шнурки, спин-пад: вещи становятся сильнее в батлах') : _t('Весь кастом сделан — зайди полюбоваться') }; }
    if (pl.id === 'gate') { const rk = rankOf(S.rep); return rk < BAL.gateRank ? { off: true, h: _t('🔒 Центр — со звания «{r}»', { r: BAL.ranks[BAL.gateRank] }), s: _t('Сейчас: {r} · {a} / {b} ★', { r: BAL.ranks[rk], a: S.rep, b: BAL.rep[BAL.gateRank] }) } : { h: _t('🚪 Войти в Центр'), s: _t('Банды 3–5 уровня · ТЦ · метро') }; }
    // ---- the Centre ----
    if (pl.id === 'yard') return { h: _t('🚪 Вернуться во двор'), s: _t('Диджей, мат и сайфер — там') };
    if (pl.id === 'metro') return { h: _t('🚇 Метро — карта города'), s: _t('Какие районы открыты и что дальше') };
    if (pl.id === 'park') return S.wins.chrome || S.seen.park ? { h: _t('🚪 Войти в Парк'), s: _t('Банды 5–7 уровня · джем на эстраде · набережная') } : { off: true, h: _t('🔒 Парк — победи «Хромированных»'), s: _t('Хозяева Центра · ур. 5 · главарь Хромосома') };
    if (pl.id === 'tea') { const n = myWalls(); return S.teaDay === t ? { off: true, h: _t('🥤 Чай на сегодня выпит'), s: _t('Завтра нальют ещё') } : !n ? { off: true, h: _t('🥤 Ларёк угощает только своих'), s: _t('Закрась стену банды в Центре: +{n} ⚡ за каждую в день', { n: BAL.tea }) } : { h: _t('🥤 Чай для своих · +{n} ⚡', { n: n * BAL.tea }), s: _t('Раз в день: +{n} ⚡ за каждую твою стену в Центре', { n: BAL.tea }) }; }
    // ---- the Park ----
    if (pl.id === 'pcenter') return { h: _t('🚪 Вернуться в Центр'), s: _t('ТЦ, метро и ларёк — там') };
    if (pl.id === 'prom') return S.wins.wave || S.seen.prom ? { h: _t('🚪 Войти в Промзону'), s: _t('Банды 6–8 уровня · подпольный ринг · тайники') } : { off: true, h: _t('🔒 Промзона — победи «Волну»'), s: _t('Хозяева набережной · ур. 7 · главарь Кюрасао') };
    // ---- the industrial zone ----
    if (pl.id === 'zpark') return { h: _t('🚪 Вернуться в Парк'), s: _t('Эстрада, Маятник и площадка — там') };
    if (pl.id === 'club') return S.wins.forge ? { off: true, h: _t('🚧 Клуб — скоро'), s: _t('Ты победил хозяев Промзоны. Район строится') } : { off: true, h: _t('🔒 Клуб — победи «Литейку»'), s: _t('Хозяева Промзоны · ур. 8 · главарь Коготь') };
    if (pl.id === 'stash') return S.stash.got.includes(pl.i) ? { off: true, h: _t('📦 Тайник уже пуст'), s: '' } : { h: _t('📦 Вскрыть тайник'), s: _t('Сегодня найдено {n} из {m} · внутри ⚡ или ★', { n: S.stash.got.length, m: BAL.stashN }) };
    if (pl.id === 'ring') { const n = S.ringDay.day === t ? S.ringDay.n : 0, next = BAL.ringRep + Math.min(S.streak, BAL.streakMax) * BAL.streakRep;
      return n >= BAL.ringMax ? { off: true, h: _t('🥊 Ринг закрыт до завтра'), s: _t('Серия побед: {n} · она не сгорает за ночь', { n: S.streak }) }
        : { h: _t('🥊 Подпольный ринг · −{n} ⚡', { n: BAL.ring }), s: _t('Серия побед: {n} · победа даст +{r} ★ · проиграл — серия с нуля', { n: S.streak, r: next }), low: S.en < BAL.ring }; }
    if (pl.id === 'bars') return S.warmDay === t ? { off: true, h: _t('🤸 Ты размят до конца дня'), s: _t('Срывов в батлах меньше на {n}%', { n: Math.round(BAL.warm * 100) }) } : { h: _t('🤸 Размяться на площадке'), s: _t('Бесплатно раз в день: −{n}% срывов сегодня', { n: Math.round(BAL.warm * 100) }) };
    if (pl.id === 'og') { const m = lesMin(); return S.ogDay === t ? { off: true, h: _t('🧓 Маятник: «На сегодня всё. Завтра приходи»'), s: _t('Старый би-бой проверяет тебя раз в день') }
      : m < BAL.ogMin ? { go: true, h: _t('🧓 Маятник: «Сначала поучись»'), s: _t('{n} мин уроков сегодня (сейчас {m}) → +{r} ★ и +{e} ⚡', { n: BAL.ogMin, m, r: BAL.ogRep, e: BAL.ogEn }) }
      : { h: _t('🧓 Показать Маятнику, чему научился'), s: _t('Ты учился сегодня {m} мин: +{r} ★ и +{e} ⚡', { m, r: BAL.ogRep, e: BAL.ogEn }) }; }
    if (pl.id === 'jam') return S.jamDay === t ? { off: true, h: _t('🏆 Джем на сегодня сыгран'), s: _t('Завтра эстрада ждёт снова') } : { h: _t('🏆 Джем на эстраде · −{n} ⚡', { n: BAL.jam }), s: _t('Три соперника подряд: ур. {l} · до +{r} ★', { l: BAL.jamLv.join(', '), r: BAL.jamRep.reduce((a, b) => a + b, 0) + BAL.jamChamp }), low: S.en < BAL.jam };
    if (pl.id === 'mall') { const n = S.mallDay.day === t ? S.mallDay.n : 0; return n >= BAL.mallMax ? { off: true, h: _t('🕺 Толпа устала — приходи завтра'), s: _t('Шоу у ТЦ: {n} раза в день', { n: BAL.mallMax }) } : { h: _t('🕺 Шоу у ТЦ · −{n} ⚡', { n: BAL.mall }), s: _t('Начинай, когда охранник далеко: красный круг — его зона'), low: S.en < BAL.mall }; }
  }
  function placeRun(pl) {
    const b = placeBtn(pl); if (b.off) { toast(b.h); return; } if (b.low || b.go) { location.href = './'; return; }
    if (pl.id === 'dj') {
      S.en -= BAL.dj; S.djDay = today();
      const rewards = collectGear('dj');
      save(); paintHud(); bumpGoal('dj'); sfx('win'); djP.play('Bboy_Uprock', { fade: .3 });
      toast(_t('🎧 Диджей поставил твой бит! Сегодня в батлах меньше срывов и больше стиля'), rewards); paintAct();
    }
    if (pl.id === 'mat') startTrain();
    if (pl.id === 'atelier') startAtelier();
    if (pl.id === 'show') startShow();
    if (pl.id === 'gate') travel('center');
    if (pl.id === 'yard') travel('yard');
    if (pl.id === 'metro') metroMap();
    if (pl.id === 'tea') { const add = Math.max(0, Math.min(BAL.enCap - S.en, myWalls() * BAL.tea)); S.en += add; S.teaDay = today(); save(); paintHud(); sfx('hit'); toast(_t('🥤 Горячий чай: +{n} ⚡. Твои стены в Центре кормят тебя каждый день', { n: add })); paintAct(); }
    if (pl.id === 'mall') startMall();
    if (pl.id === 'park') travel('park');
    if (pl.id === 'pcenter') travel('center');
    if (pl.id === 'og') {
      const add = Math.max(0, Math.min(BAL.enCap - S.en, BAL.ogEn));
      S.en += add; S.rep += BAL.ogRep; S.ogDay = today();
      const rewards = collectGear('og');
      save(); paintHud(); bumpGoal('og'); sfx('win'); PK.og.J.play('Bboy_Uprock', { fade: .3 });
      setTimeout(() => PK.og.J.play('Breakdance_Ready', { fade: .5 }), 4000);
      toast(_t('🧓 Маятник: «Вижу, работаешь. Так и растут» · +{r} ★ и +{e} ⚡', { r: BAL.ogRep, e: add }), rewards); paintAct();
    }
    if (pl.id === 'bars') { const H = W.hero; S.warmDay = today(); save(); A = { kind: 'warm', t: 0, from: { x: H.root.position.x, z: H.root.position.z }, to: { x: PK.bars.x, z: PK.bars.z } }; W.lock = true; W.camT = { x: PK.bars.x, z: PK.bars.z + .3, zoom: .5 }; document.body.classList.add('g3fight'); paintAct(); }
    if (pl.id === 'jam') startJam();
    if (pl.id === 'prom') travel('prom');
    if (pl.id === 'zpark') travel('park');
    if (pl.id === 'ring') startRing();
    if (pl.id === 'stash') { const s = PZ.stash[pl.i], big = rng(today() * 13 + pl.i)() < .34; S.stash.got.push(pl.i); s.g.visible = false; PLACES.splice(PLACES.indexOf(pl), 1);
      if (big) S.rep += BAL.stashRep * 2; else { S.en = Math.max(S.en, Math.min(BAL.enCap, S.en + BAL.stashEn)); S.rep += BAL.stashRep; }
      const rewards = collectGear('stash');
      save(); paintHud(); bumpGoal('stash'); sfx('hit');
      const reward = big ? _t('📦 Старая кассета с брейкбитами! +{n} ★', { n: BAL.stashRep * 2 }) : _t('📦 Термос и бутерброды: +{e} ⚡ и +{r} ★', { e: BAL.stashEn, r: BAL.stashRep });
      toast(reward, rewards);
      near = null; paintAct();
    }
  }
  // THE UNDERGROUND RING of the industrial zone: one battle of one round against a random regular (lv 6–8). Every win in a row makes the
  // next win pay more (the streak is kept across days, up to streakMax steps); a loss resets it. Same battle engine, flag c.ringB.
  function startRing() { const r = rng(Date.now() >>> 0), d = RING[Math.floor(r() * RING.length)], J = PZ.fighters[Math.floor(r() * PZ.fighters.length)], lv = BAL.ringLv[Math.floor(r() * BAL.ringLv.length)];
    S.en -= BAL.ring; if (S.ringDay.day !== today()) S.ringDay = { day: today(), n: 0 }; S.ringDay.n++; save(); paintHud(); J.busy = true; PZ.crowd(true);
    startBattle({ c: { id: 'ring', tour: true, ringB: true, name: d.name, lv, col: d.col, gear: [] }, people: [J], x: PZ.ring.x, z: PZ.ring.z, label: { visible: true }, ring: { visible: true } }); }
  function ringResult(win) { const lines = [], rk0 = rankOf(S.rep);
    if (win) { const rep = BAL.ringRep + Math.min(S.streak, BAL.streakMax) * BAL.streakRep; S.streak++; S.best = Math.max(S.best, S.streak); S.gearProgress.ringWins++; S.rep += rep; bumpGoal('ring'); bumpGoal('win'); if (B.clean) bumpGoal('clean'); bumpGoal('strong');
      lines.push(`<span class="rw">${_t('+{n} ★ уважения', { n: rep })}</span>`, _t('🔥 Серия побед на ринге: <b>{n}</b>', { n: S.streak }) + (S.streak > 1 ? _t(' — каждая следующая стоит дороже') : '')); }
    else { lines.push(S.streak ? _t('Серия из {n} побед оборвалась. Начинай новую.', { n: S.streak }) : _t('Ринг не прощает срывов. Уроки поднимают уровень героя — он реже падает и крутит сложнее.')); S.streak = 0; }
    const rk = rankOf(S.rep); if (rk > rk0) lines.push(`<span class="rw">${_t('🏅 Новое звание: {r}', { r: BAL.ranks[rk] })}</span>`);
    return lines; }
  // THE JAM on the Park's stage: three battles in a row against the stage's dancers (one round each); a lost battle ends it,
  // what was earned stays. Runs on the same battle engine as the crews — the «crew» is one dancer with the flag tour.
  let JM = null;
  function startJam() { S.en -= BAL.jam; S.jamDay = today(); save(); paintHud(); JM = { i: 0, rep: 0, over: false, clean: true }; PK.crowd(true); jamRound(); }
  function jamRound() { const J = PK.dancers[JM.i], d = JAM[JM.i]; J.busy = true;
    startBattle({ c: { id: 'jam' + JM.i, tour: true, name: d.name, lv: BAL.jamLv[JM.i], col: d.col, gear: [] }, people: [J], x: PK.stage.x, z: PK.stage.z + .2, label: { visible: true }, ring: { visible: true } }); }
  function jamResult(win) { const lines = [], i = JM.i, rk0 = rankOf(S.rep);
    if (win) { const rep = BAL.jamRep[i] + (i === 2 ? BAL.jamChamp : 0); S.rep += rep; JM.rep += rep; JM.i++; JM.clean &&= B.clean; bumpGoal('jam'); bumpGoal('win'); if (B.clean) bumpGoal('clean');
      lines.push(`<span class="rw">${_t('+{n} ★ уважения', { n: rep })}</span> · ${_t('раунд {i} из 3', { i: i + 1 })}`);
      if (JM.i >= 3) { JM.over = true; S.jamWon = (S.jamWon || 0) + 1;
        if (JM.clean) S.gearProgress.jamClean = (S.gearProgress.jamClean || 0) + 1;
        lines.unshift(`<span class="rw">${_t('🏆 Ты выиграл джем на эстраде! Всего +{n} ★', { n: JM.rep })}</span>`); }
      else lines.push(_t('Дальше — <b>{x}</b>, ур. {l}. Энергия уже оплачена', { x: JAM[JM.i].name, l: BAL.jamLv[JM.i] })); }
    else { JM.over = true; lines.push(i ? _t('Джем окончен на {i}-м раунде. За сегодня +{n} ★', { i: i + 1, n: JM.rep }) : _t('Вылет в первом раунде. Уроки поднимают уровень героя — он реже падает и крутит сложнее.')); }
    const rk = rankOf(S.rep); if (rk > rk0) lines.push(`<span class="rw">${_t('🏅 Новое звание: {r}', { r: BAL.ranks[rk] })}</span>`);
    return lines; }
  // practice: the hero runs one power move on the mat; the form point is given whatever happens
  function startTrain() {
    S.en -= BAL.train; if (S.form.day !== today()) S.form = { day: today(), n: 0 }; S.form.n++; save(); paintHud();
    const H = W.hero, lv = ctx.heroLevel(), pw = POWER.filter(p => p.lv <= lv), P = pw[pw.length - 1], fail = Math.random() < .3;
    A = { kind: 'train', t: 0, from: { x: H.root.position.x, z: H.root.position.z }, to: matAt, P, fail, said: false };
    W.lock = true; W.camT = { x: matAt.x, z: matAt.z + .3, zoom: .45 }; document.body.classList.add('g3fight'); paintAct();
    H.play('Breakdance_Uprock_To_Ground', { fade: .3 });
  }
  // a turn of my own in the cypher (free once a day): the same random set as in battles, the crew watches
  function startShow() {
    const H = W.hero, r = rng(Date.now() >>> 0), { x, z } = H.root.position;
    const T = makeTurn(H, ctx.heroLevel(), r, 'me', buff(), null, Math.hypot(C0.x - x, C0.z - z));
    W.walk.start(H);
    A = { kind: 'show', T, c: C0, t0: performance.now() / 1000, from: { x, z } };
    S.showDay = today(); save(); W.lock = true; W.cyBusy = true; W.camT = { x: C0.x, z: C0.z + .3, zoom: .42 }; document.body.classList.add('g3fight');
    $('#g3bt').classList.add('on'); $('#g3sc').style.display = 'none'; $('#g3skip').style.display = 'none'; $('#g3turn').textContent = _t('Твой выход в сайфере'); paintAct();
  }
  // a street show on the mall's tiles: my random set, passers-by come to watch — and the guard walks his round.
  // If he gets close while I dance (his red ring reaches me), the show is over and almost nothing is earned.
  function startMall() {
    const H = W.hero, r = rng(Date.now() >>> 0), bf = buff(), { x, z } = H.root.position;
    const T = makeTurn(H, ctx.heroLevel(), r, 'me', { ...bf, fall: bf.fall + BAL.mallFloor }, null, Math.hypot(CN.show.x - x, CN.show.z - z));
    S.en -= BAL.mall; if (S.mallDay.day !== today()) S.mallDay = { day: today(), n: 0 }; S.mallDay.n++; save(); paintHud();
    W.walk.start(H);
    A = { kind: 'show', mall: true, T, c: CN.show, t0: performance.now() / 1000, from: { x, z } };
    W.lock = true; W.camT = { x: CN.show.x, z: CN.show.z + .3, zoom: .5 }; document.body.classList.add('g3fight'); CN.crowd(true);
    $('#g3bt').classList.add('on'); $('#g3sc').style.display = 'none'; $('#g3skip').style.display = 'none'; $('#g3turn').textContent = _t('Шоу у ТЦ · следи за охранником'); paintAct();
  }
  let A = null;   // a place action in progress
  // ---- the tailor: the hero stands by the stall and turns slowly (front patch, then the back) while the sheet is open ----
  function startAtelier() {
    const H = W.hero; H.st.vx = H.st.vz = 0; H.st.wk = 0; H.st.tgt = null; H.play('Breakdance_Ready', { fade: .3 }); if (H.act) H.act.timeScale = 1;
    A = { kind: 'atelier', t: 0, from: { x: H.root.position.x, z: H.root.position.z }, to: { x: atFront.x + .45, z: atFront.z + .15 } };
    W.lock = true; W.camT = { x: atFront.x + .45, z: atFront.z + 1.6, zoom: .4 }; document.body.classList.add('g3fight'); paintAct(); sheetAtelier();
  }
  function sheetAtelier() {
    const rk = rankOf(S.rep), rows = CUS.map(c => { const n = S.cus[c.id] || 0, max = n >= 3, cost = BAL.cusCost[n], need = BAL.cusRank[n], lock = !max && rk < need;
      const btn = max ? `<button disabled>${_t('✓ Всё')}</button>` : lock ? `<button disabled>${_t('🔒 «{r}»', { r: BAL.ranks[need] })}</button>` : `<button data-cu="${c.id}"${S.en < cost ? ' class="sec"' : ''}>${_t('Пришить · {n} ⚡', { n: cost })}</button>`;
      const fx = max ? cusFx(c, c.v(3)) : n ? cusFx(c, c.v(n) + ' → ' + c.v(n + 1)) : _t('Даст {x}', { x: cusFx(c, c.v(1)) });
      return `<div class="cu${max ? ' max' : ''}"><i>${c.ico}</i><div><b>${c.nm}</b><span class="dots">${'●'.repeat(n)}${'○'.repeat(3 - n)}</span>
        <small class="n">${max ? _t('Готово: {x}', { x: c.lv[2] }) : '→ ' + c.lv[n]}</small><small>${fx}</small></div>${btn}</div>`; }).join('');
    info(`<h4>${_t('🧵 Ателье «Игла»')}</h4><p>${_t('Доработки видны на герое и <b>навсегда</b> усиливают тебя в батлах города. Платишь энергией — она из уроков.')}</p>${rows}
      <p style="margin-top:8px">${_t('У тебя <b>{n} ⚡</b> · 2-й уровень — со звания «{a}», 3-й — «{b}»', { n: S.en, a: BAL.ranks[BAL.cusRank[1]], b: BAL.ranks[BAL.cusRank[2]] })}</p>
      <button class="sec" id="g3cuL">${_t('🎬 К урокам — +{n} ⚡ за минуту', { n: BAL.perMin })}</button>`);
    $('#g3info').classList.add('cum');
    document.querySelectorAll('#g3info [data-cu]').forEach(b => { b.onclick = () => sew(b.dataset.cu); });
    $('#g3cuL').onclick = () => { location.href = './'; };
  }
  function sew(id) {
    const c = CUS.find(x => x.id === id), n = S.cus[id] || 0; if (!c || n >= 3) return;
    if (rankOf(S.rep) < BAL.cusRank[n]) { toast(_t('🔒 Игла шьёт это только для звания «{r}»', { r: BAL.ranks[BAL.cusRank[n]] })); return; }
    if (S.en < BAL.cusCost[n]) { toast(_t('⚡ Не хватает энергии: нужно {n}, у тебя {a}. Минута урока = +{m} ⚡', { n: BAL.cusCost[n], a: S.en, m: BAL.perMin })); return; }
    S.en -= BAL.cusCost[n]; S.cus[id] = n + 1; save(); paintHud(); ctx.rewear && ctx.rewear(); sfx('win');
    if (atP) { atP.play('Bboy_Uprock', { fade: .3 }); setTimeout(() => atP.play('Breakdance_Ready', { fade: .5 }), 2600); }
    if (A && A.kind === 'atelier') { A.spin = id === 'top' && n + 1 === 3 ? Math.PI : id === 'kicks' || id === 'pants' ? .6 : 0; A.ty = 0; }
    toast(_t('🧵 Игла пришила: {x}', { x: c.lv[n] + ' · ' + cusFx(c, c.v(n + 1)) })); sheetAtelier();
  }
  function actTick(dt) {
    const H = W.hero;
    if (A.kind === 'atelier') { A.t += dt; const k = ease(clamp(A.t / .7, 0, 1)); H.root.position.set(lerp(A.from.x, A.to.x, k), 0, lerp(A.from.z, A.to.z, k));
      // a slow turntable: front → back → front (a fresh back patch is shown from behind first)
      A.ty = (A.ty || 0) + dt; H.root.rotation.y = (A.spin || 0) + Math.sin(A.ty * .55) * 1.9;
      H.tick(dt); if (!$('#g3info').classList.contains('on')) { $('#g3info').classList.remove('cum'); endAct(); } return; }
    if (A.kind === 'warm') { A.t += dt; const k = ease(clamp(A.t / .8, 0, 1)); H.root.position.set(lerp(A.from.x, A.to.x, k), 0, lerp(A.from.z, A.to.z, k));
      if (A.t > .8 && !A.p) { A.p = true; H.play('Breakdance_Footwork_1', { fade: .3 }); toast(_t('🤸 Разминка…')); }
      if (A.t > 4.6) {
        const rewards = collectGear('warm');
        save(); H.play('Breakdance_Ready', { fade: .4 }); sfx('hit');
        toast(_t('🤸 Размялся! Сегодня срывов в батлах меньше на {n}%', { n: Math.round(BAL.warm * 100) }), rewards); endAct();
      }
      H.tick(dt); return; }
    if (A.kind === 'train') {
      A.t += dt; const k = ease(clamp(A.t / .8, 0, 1)); H.root.position.set(lerp(A.from.x, A.to.x, k), 0, lerp(A.from.z, A.to.z, k));
      if (A.t > .8 && !A.p) { A.p = true; H.play(A.P.c, { fade: .3 }); toast('💪 ' + A.P.nm + '…'); }
      if (A.fail && A.t > 2.6 && !A.f) { A.f = true; fallStart(H); sfx('crash'); }
      if (H.fall) fallTick(H, dt, false);
      if (A.t > 4.4) {
        if (H.fall) fallEnd(H);
        H.play('Breakdance_Ready', { fade: .4 });
        const rewards = collectGear('train');
        save(); bumpGoal('train');
        toast(_t(A.fail ? '💪 Сорвался, но форма растёт: {a} / {b} · −{c}% срывов сегодня' : '💪 Чисто! Форма {a} / {b} · −{c}% срывов сегодня', { a: S.form.n, b: BAL.trainMax, c: 3 * S.form.n }), rewards);
        if (!A.fail) sfx('hit'); endAct(); }
      H.tick(dt); return;
    }
    if (A.kind === 'show') {
      const T = A.T, t = performance.now() / 1000 - A.t0, C1 = A.c;
      // the guard has come up: the show is cut short
      if (A.mall && !A.caught && t > 1 && Math.hypot(CN.guard.x - H.root.position.x, CN.guard.z - H.root.position.z) < CN.guard.see) {
        A.caught = t; CN.guard.alert = 3.2; sfx('lose'); ctx.shake && ctx.shake(.4); if (H.fall) fallEnd(H); H.play('Breakdance_Ready', { fade: .3 });
        $('#g3mv').innerHTML = _t('ОХРАНА!') + `<small class="bad">${_t('«Здесь танцевать нельзя!»')}</small>`; }
      if (A.caught) { H.root.rotation.y = Math.atan2(CN.guard.x - H.root.position.x, CN.guard.z - H.root.position.z); H.tick(dt);
        if (t - A.caught > 2.2) { S.rep += BAL.repMallCaught; save(); CN.crowd(false); $('#g3bt').classList.remove('on'); $('#g3sc').style.display = ''; $('#g3mv').innerHTML = '';
          toast(_t('👮 Охранник прогнал: +{n} ★. Начинай, когда он уходит от тебя', { n: BAL.repMallCaught })); endAct(); }
        return; }
      moveTurn(T, t, dt, A.from, C1.x, C1.z, A.back);
      const si = T.seq.findIndex(s => t < s.b);
      if (t >= T.enter && si >= 0 && si !== T.si) { const s = T.seq[si]; T.si = si; if (s.c) H.play(s.c, { fade: s.fade ?? .35, at: s.at, speed: s.sp }); if (s.nm) mvText(s); }
      const s = si >= 0 ? T.seq[si] : null;
      if (si >= 0) spinTick(H, T, t);
      if (s && (s.kind === 'power' || s.kind === 'freeze') && !s.done && (t - s.a) / s.len >= (s.fail ? s.failAt : .7)) { s.done = true;
        if (s.fail) { fallStart(H); sfx('crash'); mvText(s, ['bad', _t('Срыв!')]); A.clean = false; } else { sfx('hit'); mvText(s, ['ok', _t('Чисто!')]); } }
      if (H.fall) fallTick(H, dt, s && s.soft); if (s && s.kind !== 'fall' && H.fall && H.fall.up) fallEnd(H);
      if (si < 0 && !A.back) { A.back = true; if (H.fall) fallEnd(H); W.walk.start(H); $('#g3mv').innerHTML = ''; }
      if (t >= T.len && A.mall) {
        const clean = A.clean !== false, rep = BAL.repMall + (clean ? BAL.repMallClean : 0);
        S.rep += rep;
        const rewards = clean ? collectGear('mallClean') : [];
        save(); bumpGoal('mall'); CN.crowd(false);
        sfx('win'); toast(_t('🕺 Толпа в восторге! +{n} ★{c} — и охранник не успел', { n: rep, c: clean ? _t(' (чисто)') : '' }), rewards); $('#g3bt').classList.remove('on'); $('#g3sc').style.display = ''; endAct(); }
      else if (t >= T.len) {
        const clean = A.clean !== false, rep = BAL.repShow + (clean ? BAL.repShowClean : 0);
        S.rep += rep;
        const rewards = collectGear('show');
        save(); bumpGoal('show');
        sfx('win'); toast(_t('🔥 Сайфер принял тебя! +{n} ★{c}', { n: rep, c: clean ? _t(' (чисто)') : '' }), rewards); $('#g3bt').classList.remove('on'); $('#g3sc').style.display = ''; endAct(); W.cyBusy = false; }
      H.tick(dt); if (!A) H.ws = null; else if (H.ws) W.walk.pose(H, dt); return;
    }
  }
  function endAct() { A = null; W.hero.ws = null; W.lock = false; W.camT = null; document.body.classList.remove('g3fight'); paintHud(); near = null; paintAct(); }

  const shown = g => !S.beat[g.c.id];
  const setShown = g => { const v = shown(g); g.people.forEach(J => J.root.visible = v); g.ring.visible = g.label.visible = v; };
  crews.forEach(setShown);

  // ---------- proximity button ----------
  let near = null; const act = $('#g3act');
  act.onclick = () => {
    if (!near || B || P || A) return;
    if (near.paint) { startPaint(near.g); return; }
    if (near.place) { placeRun(near.place); return; }
    if (S.en < BAL.battle) { location.href = './'; return; }
    startBattle(near);
  };
  function paintAct() {
    if (!near || B || P || A) { act.classList.remove('on'); return; }
    if (near.place) { const b = placeBtn(near.place); act.className = 'on' + (b.off || b.low ? ' low' : ''); act.innerHTML = (b.low ? _t('🎬 Мало энергии — посмотри урок') : b.h) + `<small>${b.low ? _t('1 минута урока = +{n} ⚡', { n: BAL.perMin }) : b.s}</small>`; return; }
    if (near.paint) { const low = S.en < BAL.paint; act.className = 'on' + (low ? ' low' : '');
      act.innerHTML = _t('🎨 Закрасить стену «{x}» · −{n} ⚡', { x: near.g.c.name, n: BAL.paint }) + `<small>${low ? _t('Мало энергии — посмотри урок') : _t('Твой кусок +{n} ★ каждый день', { n: BAL.turfRep })}</small>`; return; }
    const low = S.en < BAL.battle, lv = ctx.heroLevel(), c = near.c;
    act.className = 'on' + (low ? ' low' : '');
    act.innerHTML = low ? `${_t('🎬 Мало энергии — посмотри урок')}<small>${_t('1 минута урока = +{n} ⚡', { n: BAL.perMin })}</small>`
      : `${_t('⚔️ Батл с «{x}»{b} · −{n} ⚡', { x: c.name, b: c.boss ? ' 👑' : '', n: BAL.battle })}<small>${lv > c.lv ? _t('Ты сильнее — шансы хорошие') : lv === c.lv ? _t('Равные силы') : _t('Они сильнее — будет трудно')}</small>`;
  }

  // ---------- the battle ----------
  let B = null;
  const heroChoreo = {}, opponentChoreo = new WeakMap();
  // today's buffs from the DJ and the practice mat (only for me)
  const buff = () => { const c = S.cus || {};
    return { fall: (S.form.day === today() ? .03 * S.form.n : 0) + (S.djDay === today() ? .03 : 0) + (S.warmDay === today() ? BAL.warm : 0), style: (S.djDay === today() ? .4 : 0) + (S.form.day === today() ? .15 * S.form.n : 0) + (c.top || 0) * BAL.cusStyle,
      // custom (the tailor): sneakers → steps, knees → freezes, spin pad → power and headspins
      step: (c.kicks || 0) * BAL.cusStep, fz: (c.pants || 0) * BAL.cusFreeze, pw: (c.head || 0) * BAL.cusPower, spin: (c.head || 0) * BAL.cusSpin }; };
  // OUT = seconds after the set to WALK back to one's place and turn round (owner 16.11.2026 «уход с танцпола… просто шагами, не надо танцем»)
  const OUT = 2.3, OUTW = 1.7;
  function makeTurn(J, lv, r, who, bf = { fall: 0, style: 0 }, gear = null, distance = 2.12) {
    const seq = [], push = (c, len, at, o = {}) => seq.push(Object.assign({ c, len, at: at || 0 }, o));
    const me = who === 'me';
    let memory = me ? heroChoreo : opponentChoreo.get(J);
    if (!memory) { memory = {}; opponentChoreo.set(J, memory); }
    const shape = me && SHAPES.includes(W.forceSet) ? W.forceSet : rotation(memory, 'shape', SHAPES, r);
    const entry = rotation(memory, 'entry', ENTRIES, r), enter = Math.max(entry.len, .36 + distance / 2);
    const st = Math.round((bf.step || 0) * 100) / 100, top = rotation(memory, 'top', TOP, r), topMirror = r() < .5;
    const topStep = (c, mirror, len, scored) => push(side(c, mirror), len, r() * clipLen(c), {
      nm: TOPNM[c], pts: scored ? 1 + st : 0, kind: scored ? 'top' : 'top2', fade: .35,
    });
    const extraTop = () => topStep(pick(TOP.filter(c => c !== top), r), !topMirror, 1.3 + r() * .5, false);
    let m = r() < .5, held = '';
    const dir = m ? -1 : 1, DOWN = 'Breakdance_Uprock_To_Ground';
    const down = (speed, direction = dir) => {
      const len = clipLen(DOWN) / speed - .035;
      push(side(DOWN, m), len, 0, { kind: 'down', sp: speed, yaw: direction * (.26 + r() * .7), yt: len });
    };
    const rise = () => push(side('Crossleg_Freeze', m), 1.26, .75, { kind: 'rise', fade: .4, yaw: -dir * .44, yt: .9 });
    // the footwork combo: 2–3 phrases, ~2.7–3.5 s, never the same phrase twice in a row; the side switches now and then (a slower
    // cross-fade, the weight goes over); between phrases he keeps turning round (mostly the same way)
    let prev = '', turn = dir;
    const combo = (want, scored, out, fade0) => { let tot = 0, first = true;
      while (tot < want - .6 || first) {
        const P = pick(FW.filter(p => p.c !== prev), r), sw = !first && r() < .35;
        prev = P.c; if (sw) m = !m;
        // a phrase is cut to what is left of the combo, but never shorter than .9 s (no flicks) and not cut for the last half second
        const sp = fsp * (.95 + r() * .1), full = (P.b - P.a) / sp, rest = want - tot, len = full - rest < .5 ? full : Math.max(.9, rest);
        if (!first && r() < .25) turn = -turn;
        out.push(Object.assign({ c: side(P.c, m), len, at: P.a, sp, fade: first && fade0 ? fade0 : sw ? .45 : .32 }, first && scored ? { nm: 'FOOTWORK', pts: Math.round((1.5 + st) * 100) / 100, kind: 'foot' }
          : { kind: 'foot2', yaw: turn * (.2 + r() * .5), yt: .5 }));
        tot += len; first = false;
      } };
    const fsp = .92 + r() * .24;
    if (shape === 'floorStart') {
      down(1.2 + r() * .16);
      combo(1.9 + r() * .5, true, seq);
      rise();
      topStep(top, topMirror, 1.65 + r() * .55, true);
      m = !m;
      down(1.13 + r() * .16, -dir);
    } else {
      topStep(top, topMirror, (shape === 'classic' ? 1.9 : 1.5) + r() * .7, true);
      if (shape === 'rock') extraTop();
      if (shape === 'drop') {
        const F = pick(FDROP.filter(f => (f.lv || 1) <= lv), r); held = F.nm;
        push(side(F.c, m), F.b - F.a, F.a, { nm: F.nm, pts: .5, kind: me ? 'freeze' : 'hold', fail: false, fade: .4, yaw: dir * (.15 + r() * .35), yt: .9 });
      } else down(.95 + r() * .2);
      const fwWant = shape === 'classic' ? 2.7 : shape === 'powerFirst' || shape === 'freezeBreak' ? 1.25 : 1.9;
      combo(fwWant + r() * .6, true, seq, shape === 'drop' ? .5 : 0);
      if (shape === 'rebound') { rise(); extraTop(); m = !m; down(1.15 + r() * .16, -dir); }
      if (shape === 'freezeBreak') {
        const F = pick(FREEZE.filter(f => f.nm === 'BABY FREEZE' || f.nm === 'CHAIR FREEZE'), r); held = F.nm;
        push(side(F.c, m), F.len - .45, F.at, { nm: F.nm, kind: 'hold', fade: .42 });
        m = !m;
        combo(1.2 + r() * .4, false, seq, .48);
      }
    }
    const pw = POWER.filter(p => p.lv <= lv); let P = pw[Math.min(pw.length - 1, Math.floor(r() * pw.length * 1.3))];
    if (me && W.forcePM) P = POWER.find(p => p.nm === W.forcePM) || P;   // tests: ?pm=FLARE
    const failP = clamp(.13 + P.risk - .06 * (lv - P.lv) - bf.fall - (bf.pw || 0) - (P.c === 'Head_Spinning' ? bf.spin || 0 : 0), .03, .32);
    const pFail = r() < failP && !gear;
    if (P.pre && !gear?.move) push(P.pre, 1.6, 1.0, { kind: 'pre' });
    if (P.c === 'Breakdance_1990' && !gear?.move) rise();
    const reps = Math.max(1, Math.round(2.6 / clipLen(P.c)));
    const failAt = .45 + r() * .35;
    if (gear?.move) push(null, HERO.MOVES[gear.move].dur, 0, { nm: HERO.MYTHIC_MOVES[gear.move], pts: P.pts + 6, kind: 'power', gear });
    else push(P.c, reps * clipLen(P.c), 0, { nm: P.nm, pts: gear?.assist ? Math.round(P.pts * BAL.perfMul * 10) / 10 : P.pts, kind: 'power', fail: pFail, failAt, lv: P.lv, gear });
    // both endings are made: the hero's power move may be DRAWN (city3d-power.js) — then the finger, not the dice, picks one
    const pwS = seq[seq.length - 1], mk = (c, len, at, o = {}) => Object.assign({ c, len, at: at || 0 }, o), ok = [], bad = [mk(null, 2.2, 0, { kind: 'fall' })];
    if (P.post && !gear?.move) ok.push(mk(P.post, 1.4, 0, { kind: 'post' }));
    // «powerFirst»: after the power move he goes back down into footwork (no extra points), then the freeze
    if (shape === 'powerFirst') combo(1.6 + r() * .6, false, ok, .45);
    const F = pick(FREEZE.filter(f => (f.lv || 1) <= lv && f.nm !== memory.freeze && f.nm !== held), r);
    if (!pFail || me) memory.freeze = F.nm;
    const fFail = r() < clamp(.14 - .03 * (lv - 1) - bf.fall - (bf.fz || 0) + (me ? F.risk || 0 : 0), .03, .2);
    ok.push(mk(side(F.c, r() < .5), F.len, F.at, { nm: F.nm, pts: 2, kind: 'freeze', fail: fFail, failAt: .55 }));
    if (fFail) ok.push(mk(null, 1.6, 0, { kind: 'fall', soft: true }));
    seq.push(...(pFail ? bad : ok)); pwS.tails = { ok, bad };
    let t = enter; seq.forEach(s => { s.a = t; t += s.len; s.b = t; });
    return { J, who, seq, shape, enter, bend: entry.bend, len: t + OUT, score: 0, style: Math.round((r() * .8 + .15 * lv + bf.style) * 10) / 10 };
  }
  function startBattle(g) {
    if (!g.c.tour) S.en -= BAL.battle; S.fights++; save(); paintHud();
    // every crew battles to its own beat (rhythm.js LOOPS, owner 17.11.2026); the jam and the ring have theirs
    if (ctx.music) ctx.music(g.c.ringB ? 'ring' : g.c.tour ? 'jam' : g.c.id);
    const H = W.hero, lv = ctx.heroLevel(), c = g.c, r = rng((Date.now() ^ (c.lv * 911)) >>> 0);
    const opp = g.people[0], cx = g.x, cz = g.z;
    // positions: the middle of the crew's ring is the stage; me on the south side, the opponent on the north
    const meSpot = { x: cx - .3, z: cz + 2.1 }, opSpot = { x: cx + .3, z: cz - 2.1 };
    const turns = [], rounds = c.tour ? 1 : c.lv >= 3 ? 2 : 1;
    const eq = ctx.heroEq(), chance = HERO.gearChances(eq);
    for (let i = 0; i < rounds; i++) {
      const gear = HERO.gearEvent(chance, Math.floor(Math.random() * 10000), Math.floor(Math.random() * 3));
      turns.push(makeTurn(opp, c.lv, r, 'op')); turns.push(makeTurn(H, lv, r, 'me', buff(), gear));
    }
    W.walk.start(H); W.walk.start(opp);
    const walkIn = Math.max(1.45, .35 + Math.max(Math.hypot(H.ws.x0 - meSpot.x, H.ws.z0 - meSpot.z), Math.hypot(opp.ws.x0 - opSpot.x, opp.ws.z0 - opSpot.z)) / 2.2);
    B = { g, opp, turns, i: -1, t0: 0, me: 0, op: 0, cx, cz, meSpot, opSpot, lv, phase: 'walk', pt: performance.now() / 1000, walkIn, clean: true };
    W.lock = true; W.camT = { x: cx, z: cz + .4, zoom: .4 }; document.body.classList.add('g3fight'); g.label.visible = false; $('#g3skip').style.display = '';
    $('#g3bt').classList.add('on'); $('#g3bt').style.setProperty('--oc', c.col); $('#g3on').textContent = c.name.toUpperCase();
    $('#g3a').textContent = '0'; $('#g3b').textContent = '0'; $('#g3turn').textContent = _t('Выход в круг'); $('#g3mv').innerHTML = '';
    paintAct();
  }
  $('#g3skip').onclick = () => { if (!B || B.phase === 'end') return; B.skip = true; };

  const face = (J, x, z) => { J.root.rotation.y = Math.atan2(x - J.root.position.x, z - J.root.position.z); };
  function moveTurn(T, t, dt, home, cx, cz, back) {
    const J = T.J;
    if (!J.ws) return;
    const facing = Math.atan2(cx - home.x, cz - home.z);
    if (back) {
      const k = ease(clamp((t - (T.len - OUT)) / OUTW, 0, 1));
      W.walk.move(J, dt, home.x, home.z, k, facing);
    } else {
      const k = ease(clamp(t / T.enter, 0, 1));
      W.walk.move(J, dt, cx, cz, k, facing, T.bend);
      if (k >= 1) J.ws = null;
    }
  }
  function mvText(s, res) {
    const e = $('#g3mv'); e.innerHTML = (s.nm || '') + (res ? `<small class="${res[0]}">${res[1]}</small>` : '');
    e.classList.add('pop'); setTimeout(() => e.classList.remove('pop'), 180);
  }
  function mythCut(T, step, t) {
    const el = $('#g3myth');
    if (!step?.gear?.move) { if (!el.hidden) { el.hidden = true; el.replaceChildren(); } return; }
    const move = HERO.MOVES[step.gear.move];
    if (el.hidden) {
      el.innerHTML = HERO.svg(B.lv, { uid: 'city-myth', rig: true, acc: ctx.heroEq() });
      T.mythRig = HERO.rigJoints(el.querySelector('svg'));
      el.hidden = false;
    }
    HERO.setPose(T.mythRig, move.f(clamp((t - step.a) / step.len, 0, 1)));
  }
  // a fall: the pose freezes in slow motion, the body tips over sideways and lies ON the ground (city3d-mocap J.rest), then gets up
  function fallStart(J) { J.fall = { t: 0, side: Math.random() < .5 ? -1 : 1 }; J.rest = true; if (J.act) J.act.timeScale = .15; ctx.shake && ctx.shake(.6); }
  function fallTick(J, dt, soft) {
    const f = J.fall; if (!f) return; f.t += dt;
    const k = ease(clamp(f.t / .35, 0, 1)), up = ease(clamp((f.t - (soft ? .7 : 1.1)) / .5, 0, 1));
    J.rig.rotation.z = f.side * (soft ? .7 : 1.35) * k * (1 - up); if (up > .6) J.rest = false;
    if (f.t > (soft ? .7 : 1.1) && !f.up) { f.up = true; J.play('Breakdance_Ready', { fade: .5 }); }
  }
  function fallEnd(J) { J.fall = null; J.rest = false; J.rig.rotation.z = 0; }

  function battleTick(dt) {
    const H = W.hero, now = performance.now() / 1000;
    if (B.phase === 'walk') {
      const k = ease(clamp((now - B.pt) / B.walkIn, 0, 1));
      W.walk.move(H, dt, B.meSpot.x, B.meSpot.z, k, Math.atan2(B.cx - B.meSpot.x, B.cz - B.meSpot.z));
      W.walk.move(B.opp, dt, B.opSpot.x, B.opSpot.z, k, Math.atan2(B.cx - B.opSpot.x, B.cz - B.opSpot.z));
      if (k >= 1) { B.phase = 'turn'; B.i = -1; nextTurn(); }
    } else if (B.phase === 'turn') {
      if (B.skip) { PM.cancel(); finishSkip(); return; }
      // the battle's clock STANDS while the hero hangs in the air waiting for the finger, while it is drawn, and during the replay
      if (PM.holds()) B.t0 += now - (B.ln || now);
      // while the swipe winds up towards the drawn part the clock keeps the dancer's time (a slow frame doesn't cut the wind-up short)
      else if (PM.state() === 'arm') B.t0 += Math.max(0, now - (B.ln || now) - dt);
      B.ln = now;
      const T = B.turns[B.i], J = T.J, t = now - B.t0, home = T.who === 'me' ? B.meSpot : B.opSpot;
      moveTurn(T, t, dt, home, B.cx, B.cz, T.back);
      const other = T.who === 'me' ? B.opp : H; face(other, J.root.position.x, J.root.position.z);
      let si = T.seq.findIndex(s => t < s.b);
      if (si >= 0 && si < T.si) si = T.si;   // a set never steps back (the clock is moved around a drawn power move)
      if (t >= T.enter && si >= 0 && si !== T.si) {
        const s = T.seq[si]; T.si = si;
        if (s.c) J.play(s.c, { fade: s.fade ?? (s.kind === 'down' ? .3 : s.kind === 'freeze' ? .45 : .4), at: s.at, speed: s.sp });
        if (s.kind === 'top' || s.kind === 'foot') { T.score += s.pts; mvText(s, ['ok', '+' + s.pts]); }
        else if (s.nm) mvText(s);
        paintScore(T);
        // MY power move: drawn by the finger (the old random outcome only if nobody draws)
        if (s.kind === 'power' && T.who === 'me' && !s.done && !s.gear && PM.can(s.c)) { s.pm = true; armDraw(T, s); }
      }
      const s = si >= 0 ? T.seq[si] : null;
      mythCut(T, s, t);
      if (si >= 0) spinTick(J, T, t);
      if (s && (s.kind === 'power' || s.kind === 'freeze') && !s.done && !s.pm && (t - s.a) / s.len >= (s.fail ? s.failAt : .7)) {
        s.done = true;
        if (s.fail) { const k = s.kind === 'power' ? .5 : 0; T.score += k; fallStart(J); sfx('crash'); mvText(s, ['bad', s.kind === 'power' ? _t('Срыв! +0.5 за попытку') : _t('Не удержал! 0')]); if (T.who === 'me') B.clean = false; }
        else { T.score += s.pts; mvText(s, s.gear ? ['gold', _t('САМ КРУТИТ') + ' · +' + s.pts] : ['ok', _t('Чисто! +{n}', { n: s.pts })]); sfx('hit'); W.camT.zoom = .34; setTimeout(() => { if (W.camT) W.camT.zoom = .4; }, 450); }
        paintScore(T);
      }
      if (J.fall) fallTick(J, dt, s && s.soft);
      if (s && s.kind !== 'fall' && J.fall && J.fall.up) fallEnd(J);
      if (si < 0 && !T.back) {
        // a drawn move that came out clean: first a replay at the real tempo (city3d-power.js), then he walks back
        if (T.rec) { const rec = T.rec; T.rec = null; if (J.fall) fallEnd(J); PM.replay(J, rec); }
        else if (!PM.holds()) { T.back = true; if (J.fall) fallEnd(J); W.walk.start(J); $('#g3mv').innerHTML = ''; }
      }
      if (t >= T.len) { if (J.fall) fallEnd(J); T.score += T.style; paintScore(T); nextTurn(); }
      if (!PM.holds()) { W.camT.x = lerp(W.camT.x, J.root.position.x, 1 - Math.exp(-dt * 2)); W.camT.z = lerp(W.camT.z, J.root.position.z + .3, 1 - Math.exp(-dt * 2)); }
      PM.tick(dt);   // sets the speed of the drawn clip just before the dancer moves
    }
    H.tick(dt); B.opp.tick(dt); if (B) [H, B.opp].forEach(J => { if (J.ws) W.walk.pose(J, dt); });
  }
  // ---------- the drawn power move (city3d-power.js) ----------
  function armDraw(T, s) {
    const lv = ctx.heroLevel(), bf = buff(), up = Math.max(0, lv - (s.lv || 1));
    // the clock starts the step together with the clip (a long frame must not eat the wind-up)
    const nw = performance.now() / 1000; B.t0 = nw - (s.a + .002 + Math.max(0, T.J.act ? T.J.act.time - (s.at || 0) : 0)); B.ln = nw;
    PM.arm(T.J, s, {
      first: (S.drawN || 0) < 2,
      // what makes it easier: the levels from lessons above the move's own (+1 px, +.3 s each), the tailor's spin pad, the warm-up, the DJ, the mat
      tolAdd: Math.min(3, up) + Math.min(6, 30 * (bf.fall + (bf.pw || 0) + (s.c === 'Head_Spinning' ? bf.spin || 0 : 0))),
      timeAdd: Math.min(1.2, .3 * up),
      onEnd: res => drawn(T, s, res) });
  }
  function drawn(T, s, res) {
    if (!B) return;
    if (res.grade === 'auto') {   // nobody drew: the old random outcome goes on
      s.pm = false;
      if (res.late && !s.done) { s.done = true; T.score += s.fail ? .5 : s.pts; if (s.fail) B.clean = false; paintScore(T); }
      return;
    }
    const J = T.J, i = T.seq.indexOf(s), ok = res.grade !== 'miss', now = performance.now() / 1000;
    S.drawN = (S.drawN || 0) + 1; s.done = true; s.pm = false;
    // the finger picked the ending: the set is re-timed from where the power move ended
    T.seq = T.seq.slice(0, i + 1).concat(ok ? s.tails.ok : s.tails.bad);
    s.len = res.len; s.b = s.a + s.len; let tt = s.b; for (let k = i + 1; k < T.seq.length; k++) { const x = T.seq[k]; x.a = tt; tt += x.len; x.b = tt; }
    T.len = tt + OUT; B.t0 = now - (s.a + res.rel + .001); B.ln = now;
    const pts = res.grade === 'perfect' ? Math.round(s.pts * BAL.perfMul * 10) / 10 : ok ? s.pts : .5;
    T.score += pts; paintScore(T);
    B.pm = (B.pm || []).concat({ nm: s.nm, g: res.grade });
    if (!ok) { fallStart(J); sfx('crash'); mvText(s, ['bad', _t('Срыв! +0.5 за попытку')]); B.clean = false; }
    else {
      T.rec = res.rec;
      if (res.grade === 'perfect') {
        mvText(s, ['gold', _t('Идеально! +{n}', { n: pts })]); sfx('perfect');
        S.perf = S.perf || {}; if (!S.perf[s.nm]) B.perfFirst = (B.perfFirst || []).concat(s.nm); S.perf[s.nm] = (S.perf[s.nm] || 0) + 1;
        bumpGoal('perf');
      } else { mvText(s, ['ok', _t('Чисто! +{n}', { n: pts })]); sfx('hit'); }
    }
    save();
  }
  function paintScore(T) {
    const me = B.turns.filter(x => x.who === 'me').reduce((a, x) => a + x.score, 0), op = B.turns.filter(x => x.who === 'op').reduce((a, x) => a + x.score, 0);
    B.me = me; B.op = op; $('#g3a').textContent = (Math.round(me * 10) / 10).toString(); $('#g3b').textContent = (Math.round(op * 10) / 10).toString();
  }
  function nextTurn() {
    B.i++; const H = W.hero; H.ws = B.opp.ws = null;
    if (B.i >= B.turns.length) { judge(); return; }
    const T = B.turns[B.i]; B.t0 = performance.now() / 1000; T.si = -1;
    const other = T.who === 'me' ? B.opp : H; other.play('Breakdance_Ready', { fade: .4, speed: 1.05 });
    W.walk.start(T.J);
    $('#g3turn').textContent = (T.who === 'me' ? _t('Твой выход') : _t('Выход: {x}', { x: B.g.c.name })) + ' · ' + _t('раунд {n}', { n: Math.floor(B.i / 2) + 1 });
    $('#g3mv').innerHTML = '';
  }
  function finishSkip() {
    mythCut(null, null, 0);
    // play out the rest instantly: every remaining scoring step counts as decided by its outcome
    B.turns.forEach((T, i) => { if (i < B.i) return; T.seq.forEach(s => { if (s.done || (i === B.i && T.si >= 0 && T.seq.indexOf(s) <= T.si && s.kind !== 'power' && s.kind !== 'freeze')) return;
      if (s.kind === 'top' || s.kind === 'foot') { if (!(i === B.i && T.seq.indexOf(s) <= T.si)) T.score += s.pts; }
      else if (s.kind === 'power' || s.kind === 'freeze') { s.done = true; if (!s.fail) T.score += s.pts; else { if (s.kind === 'power') T.score += .5; if (T.who === 'me') B.clean = false; } } });
      if (!(i < B.i)) T.score += T.style; });
    [W.hero, B.opp].forEach(J => { if (J.fall) fallEnd(J); });
    paintScore(B.turns[0]); judge();
  }
  function judge() {
    B.phase = 'end'; $('#g3skip').style.display = 'none'; const H = W.hero, c = B.g.c, diff = B.me - B.op; H.ws = B.opp.ws = null;
    H.root.position.set(B.meSpot.x, 0, B.meSpot.z); B.opp.root.position.set(B.opSpot.x, 0, B.opSpot.z); face(H, B.cx, B.cz); face(B.opp, B.cx, B.cz);
    H.st.face = H.root.rotation.y;
    const votes = [0, 1, 2].map(() => (diff + (Math.random() - .5) * 2.4 > 0 ? 'me' : 'op')), myV = votes.filter(v => v === 'me').length, win = myV >= 2;
    H.play(win ? 'Breakdance_Ending_1' : 'Breakdance_Ready', { fade: .4 }); B.opp.play(win ? 'Breakdance_Ready' : 'Bboy_Uprock', { fade: .4 });
    let lines = [];
    const rkP = rankOf(S.rep), pf = B.perfFirst || [];
    if (pf.length) S.rep += pf.length * BAL.perfFirst;
    if (c.tour) lines = c.ringB ? ringResult(win) : jamResult(win);
    else if (win) {
      const was = S.wins[c.id] || 0, rk0 = rkP, rep = BAL.repWin * c.lv + (B.clean ? BAL.repClean : 0);
      S.rep += rep; S.wins[c.id] = was + 1; S.beat[c.id] = today();
      if (c.id === 'forge' && B.clean) {
        S.gearProgress['clean:forge'] = (S.gearProgress['clean:forge'] || 0) + 1;
      }
      if ((c.id === 'volt' || c.id === 'forge') && B.pm?.some(move => move.g === 'perfect')) {
        const key = 'perfect:' + c.id;
        S.gearProgress[key] = (S.gearProgress[key] || 0) + 1;
      }
      lines.push(`<span class="rw">${_t('+{n} ★ уважения', { n: rep })}</span>${B.clean ? _t(' (чистый батл без срывов)') : ''}`);
      const gi = was === 0 ? 0 : was === 2 ? 1 : -1, gid = gi >= 0 ? c.gear[gi] : null;
      const prize = gid && HERO.GEAR[gid], nextPrize = c.gear[1] && HERO.GEAR[c.gear[1]];
      if (prize && !prize.reward && !S.own.includes(gid)) {
        S.own.push(gid); B.wear = gid;
        lines.push(`<span class="rw">${prize.ico} ${_t('Новая шмотка: {x} — уже на тебе', { x: _t(prize.name) })}</span>`);
      }
      else if (nextPrize && !nextPrize.reward && was < 2 && !S.own.includes(c.gear[1])) lines.push(_t(2 - was === 1 ? 'Победи их ещё раз — получишь {x}' : 'Победи их ещё {n} раза — получишь {x}', { n: 2 - was, x: _t(nextPrize.name) }));
      const rk = rankOf(S.rep); if (rk > rk0) lines.push(`<span class="rw">${_t('🏅 Новое звание: {r}', { r: BAL.ranks[rk] })}</span>`);
      S.last[c.id] = today(); bumpGoal('win'); if (B.clean) bumpGoal('clean'); if (c.lv >= 2) bumpGoal('strong'); if (c.d === 'center') bumpGoal('cwin'); if (c.d === 'park') bumpGoal('pwin'); if (c.d === 'prom') bumpGoal('zwin');
      if (c.boss && was === 0) lines.unshift(`<span class="rw">${_t('👑 {b} и «{x}» признали тебя: {y}', { b: c.boss, x: c.name, y: c.d === 'prom' ? _t('ты хозяин Промзоны! Остался Клуб') : c.d === 'park' ? _t('ты хозяин Парка! Дорога в Промзону открыта') : _t('ты хозяин Центра! Дорога в Парк открыта') })}</span>`);
      lines.push(S.turf[c.id] ? _t('Банда ушла до завтра. Твоя стена под защитой ещё {n} дня.', { n: BAL.hold }) : _t('Банда ушла до завтра — <b>закрась их стену</b> рядом!'));
    } else {
      lines.push(B.lv < c.lv ? _t('Они сильнее тебя. Уроки поднимают уровень героя — он реже падает и крутит сложнее.') : _t('Не повезло со срывами. Попробуй ещё раз.'));
    }
    if (win) lines.push(...collectGear(B.clean ? 'clean' : undefined).map(reward => `<span class="rw">${reward}</span>`));
    // the drawn power moves of this battle
    pf.forEach(nm => lines.unshift(`<span class="rw">${_t('✨ Первый идеальный {x}! +{n} ★', { x: nm, n: BAL.perfFirst })}</span>`));
    (B.pm || []).filter(x => x.g === 'perfect' && !pf.includes(x.nm)).forEach(x => lines.push(`<span class="rw">${_t('✨ {x} — идеально (всего {n})', { x: x.nm, n: S.perf[x.nm] })}</span>`));
    if (!win && (B.pm || []).some(x => x.g === 'miss')) lines.push(_t('Пауэрмув: веди палец ровно по линии и не останавливайся — тогда герой не сорвётся.'));
    save(); paintHud();
    const res = $('#g3res'); res.style.setProperty('--oc', c.col);
    res.innerHTML = `<div style="font:600 12px Inter;letter-spacing:.14em;color:#9a968e">${_t('СУДЬИ')}</div><div class="jd">${votes.map(v => `<i class="${v}">${v === 'me' ? _t('ТЫ') : _t('ОНИ')}</i>`).join('')}</div>
      <h3 class="${win ? 'w' : 'l'}">${win ? _t('ПОБЕДА!') : _t('ПОРАЖЕНИЕ')}</h3><p>${_t('Счёт {a} : {b} · судьи {c} : {d}', { a: Math.round(B.me * 10) / 10, b: Math.round(B.op * 10) / 10, c: myV, d: 3 - myV })}</p>
      ${lines.map(l => `<p>${l}</p>`).join('')}
      ${win ? '' : `<button class="sec" id="g3les">${_t('🎬 К урокам — стать сильнее')}</button>`}<button id="g3ok">${_t('Дальше')}</button>`;
    res.querySelectorAll('.jd i').forEach((e, i) => setTimeout(() => e.classList.add('on'), 500 + i * 450));
    res.classList.add('on'); setTimeout(() => sfx(win ? 'win' : 'lose'), 500 + 3 * 450);
    $('#g3ok').onclick = endBattle; const L = $('#g3les'); if (L) L.onclick = () => (location.href = './');
  }
  function endBattle() {
    PM.cancel();
    if (ctx.music) ctx.music(null);   // the background comes back (the next jam round asks for its beat again at once — no double switch)
    $('#g3res').classList.remove('on'); $('#g3bt').classList.remove('on');
    const g = B.g; B.opp.root.position.set(B.opp.home.x, 0, B.opp.home.z); B.opp.play('Breakdance_Ready', { fade: .3 });
    B.opp.root.rotation.y = Math.atan2(g.x - B.opp.home.x, g.z - B.opp.home.z);
    W.hero.play('Breakdance_Ready', { fade: .3 });
    if (B.wear) wearGear(B.wear);
    setShown(g); B = null; W.lock = false; W.camT = null; document.body.classList.remove('g3fight'); paintAct();
    if (g.c.ringB) { g.people[0].busy = false; g.people[0].root.rotation.y = 0; PZ.crowd(false); }
    else if (g.c.tour) { g.people[0].busy = false; g.people[0].root.rotation.y = 0; if (JM && !JM.over) jamRound(); else { JM = null; PK.crowd(false); } }
  }

  let cyT = 0;
  // ---------- per frame ----------
  function update(dt) {
    if (P) paintTick(dt);
    if (A) actTick(dt);
    if (Y) { recs.forEach(r => r.rotation.y += dt * 3.5); strip.material.emissiveIntensity = 1 + Math.sin(performance.now() / 160) * .6; djP.tick(dt);
      chain.visible = rankOf(S.rep) < BAL.gateRank; matLab.visible = djLab.visible = atLab.visible = !A && !B && !P;
      atP.tick(dt); atSign.material.color.setScalar(.72 + .1 * Math.sin(performance.now() / 420) + (Math.random() < .004 ? -.35 : 0)); }
    if (PK) { PK.gateProm.chain.visible = !(S.wins.wave || S.seen.prom); }
    if (PZ) { PZ.gateClub.chain.visible = true; }
    if (CN) { CN.gatePark.chain.visible = !(S.wins.chrome || S.seen.park); CN.guard.tag.visible = !B && !P; }
    if (B) { if (B.phase !== 'end') battleTick(dt); else { W.hero.tick(dt); B.opp.tick(dt); } }
    crews.forEach(g => {
      if (!g.label.visible && B?.g !== g) return;
      g.people.forEach(J => { if (J !== B?.opp) J.tick(dt); });
    });
    if (!B && !P && !A) {
      const p = W.hero.root.position; let best = null, bd = 3.1;
      crews.forEach(g => { if (!shown(g)) return; const d = Math.hypot(p.x - g.x, p.z - g.z); if (d < bd) { bd = d; best = g; } });
      if (!A) PLACES.forEach(pl => { const d = Math.hypot(p.x - pl.x, p.z - pl.z); if (d < pl.r && d < bd) { bd = d; best = { place: pl }; } });
      crews.forEach(g => { if (!canPaint(g)) return; const d = Math.hypot(p.x - g.wall.x, p.z - g.wall.z); if (d < 2.4 && d < bd) { bd = d; best = { paint: true, g }; } });
      const key = o => !o ? null : o.paint ? 'p:' + o.g.c.id : o.place ? 'l:' + o.place.id : 'c:' + o.c.id;
      if (key(best) !== key(near)) { near = best; paintAct(); }
      // to-do «watch a turn in the cypher»: stand near the circle for 8 s
      if (W.cyph && Math.hypot(p.x - W.cyph.x, p.z - W.cyph.z) < 5.5) { cyT += dt; if (cyT > 8) { cyT = -1e9; bumpGoal('cypher'); } }
    }
  }
  return { update, post: dt => PM.post(dt), _pm: () => PM._probe(), _pmState: () => PM.state(), _pmLast: () => PM.last(), _b: () => B, _a: () => A && { kind: A.kind, t: A.t, p: A.p, f: A.f }, busy: () => !!B || !!P || !!A, _place: id => placeRun(PLACES.find(x => x.id === id)), _places: () => PLACES, _paint: id => startPaint(crews.find(g => g.c.id === id)), _walls: () => crews.map(g => g.wall.at), state: () => S, crews, _start: id => startBattle(crews.find(g => g.c.id === id)), _skip: () => { if (B) B.skip = true; } };
}
