// City 3D — the game on top of the scene (owner 14.11.2026: «понятная система прогресса, ограниченная энергия, батлы на авто,
// но красиво — случайные комбинации, случайные исходы, падения»). Tapping stays in the real-people battles tab.
// Crews stand around the yard. The player chooses a power move before the dance-off and balances their final freeze.
// Strength = hero level from lessons; energy = 20 per battle, refilled to full every new day; lesson minutes (+5/min) and rewards stack above it.
// 17.11.2026 (owner «авто скучно, но и в бит тапать не надо»): the HERO's power move is DRAWN by the finger — city3d-power.js
// (he hangs in the air, the finger leads his legs round a circle, perfect / clean / fall; no touch = the old automatic outcome).
import * as THREE from 'three';
import { mocapPerson, clipLen, bodyOf } from './city3d-mocap.js?v=42';   // v=14 mocap: a person = one draw call, freeze clips mirrored (22.11); v=13 mocap: a sculpted human head, shoulders without a hinge (17.11); v=12 mocap: mirrored moves «_M», no glare on clothes (17.11); v=11 mocap: everyone as smooth as the hero, chain on the chest, bucket hat, hoodie (17.11); v=10 mocap: people culled, tiny parts cast no shadow (17.11); v=12: districts (Центр); v=9 mocap: standing loops
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { loadFestivalStage } from './city3d-festival-art.js?v=3';
import { initPower } from './city3d-power.js?v=32';   // the hero's power move is DRAWN by the finger (17.11)
import { initFreeze } from './city3d-freeze.js?v=3';
import { initWheel } from './city3d-wheel.js?v=4';
import { initPowerModes } from './city3d-power-modes.js?v=1';
import { mountSign, plaqueInk } from './city3d-wayfinding.js?v=1';
import { onClubFloor } from './city3d-club-audience.js?v=1';
import { CLUB_TRACKS } from './city3d-club.js?v=12';
import { initSmoke, SMOKE_TIME } from './city3d-smoke.js?v=8';
import { TOP, SHAPES, CORE_POWER as POWER, crewStyle, breakingOpening, pickPower, pickHold, setTimes, side, spinTick, beatEntry,
  duelPlan, battleStyle, BATTLE_ANSWERS, WHEEL_FOOTWORK, battleTechnique, battleFootMoves, battleReplyPoints, clubCall, threadCatch,
  REPLY_PRECISION, clubExhibition } from './city3d-breaking.js?v=7';
import { performDJ } from './city3d-dj.js?v=4';
import { makeGraffitiWall, revealGraffiti } from './city3d-graffiti.js?v=3';
import { CHAPTERS, INVITATION_COUNT, WATCH_TIME, loadStory, advanceStory, storyJournal, STORY_CSS } from './city3d-story.js?v=2';
import { initFestival } from './city3d-campaign.js?v=5';
import { loadFestivalState } from './city3d-festival-story.js?v=1';
import { CHAPTER_ART, LANDMARKS, inWatchArea, placeLandmark } from './city3d-guide-data.js?v=1';
import { initCityGuide, initLandmarkView } from './city3d-guide.js?v=3';
// TRANSLATION (18.11.2026, owner «переведи 3д город… на все языки»): every visible text goes through _t('русский текст', {vars});
// the dictionary is city3d-i18n.js (source: tools/i18n_city3d.py), the language is the app's (city3d.html sets window._t)
const _t = window._t || ((s, v) => (v ? s.replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? v[k] : m)) : s));

const KEY = 'fedoskin-city3d';
const unlimitedEnergy = (() => {
  try {
    const profile = JSON.parse(localStorage.getItem('fedoskin-profile') || 'null');
    return profile?.id === '502629';
  } catch (_) {
    return false;
  }
})();
const energyCost = cost => unlimitedEnergy ? 0 : cost;
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
  perfMul: 1.5, perfFirst: 5, extraTurn: .3,
};
function powerPoints(move, res, failed = .5) {
  if (res.grade === 'miss' || res.grade === 'auto') return failed;
  const base = res.grade === 'perfect' ? move.pts * BAL.perfMul : move.pts;
  return Math.round((base + Math.max(0, res.turns - 1) * BAL.extraTurn) * 10) / 10;
}
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
  { id: 'rusty', bodies: ['stocky', 'slim', {type:'avg', skin:'#744632', style:'longLocs'}], name: _t('Ржавые'), lv: 1, col: '#E07A45', at: [-7.2, -9.4], looks: [['c:rustyBandana'], ['c:rustyTrack'], ['c:rustyBandana']], gear: ['rustyBandana', 'rustyTrack'] },
  { id: 'acid', bodies: ['lanky', 'small', {type:'slim',skin:'#D8AB7C',style:'short',face:3,layers:true}], name: _t('Кислотные'), lv: 2, col: '#7CFF4F', at: [8.6, -6.2], looks: [['c:acidBucket'], ['c:acidKicks'], ['c:acidBucket', 'girl']], gear: ['acidKicks', 'acidBucket'] },
  { id: 'owls', bodies: ['athl', 'slim', {type:'small',skin:'#88553B',style:'tiedLocs',face:1}], name: _t('Ночные совы'), lv: 3, col: '#A98BFF', at: [-8.6, -2.4], looks: [['c:owlHoodie'], ['c:owlPhones'], ['c:owlHoodie', 'girl']], gear: ['owlPhones', 'owlHoodie'] },
  { id: 'gold', bodies: ['heavy', 'big', 'avg', 'stocky'], name: _t('Золотые зубы'), lv: 4, col: '#FFD23F', at: [4.6, 9.2], looks: [['c:goldChain'], ['c:goldCap'], ['c:goldChain', 'girl'], []], gear: ['goldChain', 'goldCap'] },
  // ЦЕНТР (16.11.2026)
  { id: 'stencil', bodies: ['slim', 'athl', {type:'small', skin:'#88553B', style:'tiedLocs'}], d: 'center', name: _t('Трафареты'), lv: 3, col: '#FF6B5E', at: [-8, 10.2], wall: [-8, 7.3], base: 3, fix: l => { if (l.col.hat) l.col.hat = l.hat === 'bandana' ? l.col.hat : ['#18181B', '#C8202A']; if (l.top !== 'bomber') l.col.top = '#18181B'; l.col.pants = '#232327'; }, looks: [['c:stencilBandana'], ['c:stencilBomber'], ['c:stencilBandana', 'girl']], gear: ['stencilBandana', 'stencilBomber'] },
  { id: 'turn', bodies: ['avg', 'heavy', 'slim', 'lanky'], d: 'center', name: _t('Турникеты'), lv: 4, col: '#5FA4FF', at: [-8.2, 3.2], wall: [-8.2, .3], base: 4, fix: l => { if (l.col.hat && l.hat !== 'bucket') l.col.hat = ['#2F7BFF', '#F2EFE8']; l.col.top = '#1c2c4a'; if (l.col.sleeve) l.col.sleeve = '#1c2c4a'; }, looks: [['c:turnBucket'], ['c:turnKicks'], ['c:turnBucket', 'girl'], ['c:turnKicks']], gear: ['turnBucket', 'turnKicks'] },
  { id: 'chrome', bodies: ['athl', 'big', 'lanky', 'stocky'], d: 'center', name: _t('Хромированные'), lv: 5, col: '#DCE6F2', at: [7.6, 3.6], wall: [7.6, .7], boss: _t('Хромосома'), base: 6, fix: l => { if (l.col.hat) l.col.hat = ['#D9DEE6', '#3F8FD8']; l.col.gold = '#D9DEE6'; if (l.top !== 'track') { l.col.top = '#18181B'; if (l.col.sleeve) l.col.sleeve = '#18181B'; l.col.cuff = '#D9DEE6'; l.col.trim = '#D9DEE6'; } }, looks: [['c:chromeTrack', 'c:chromeKicks'], ['c:chromeKicks'], ['c:chromeTrack', 'girl'], ['c:chromeKicks']], gear: ['chromeKicks', 'chromeTrack'] },
];
// the Park's crews (16.11.2026): Фанк-бригада lv 5 (old-school funk, tracksuits), Корни lv 6 (dreads, green-gold-red), Волна lv 7 —
// the owners of the embankment, boss «Кюрасао» (a nickname from the owner's list). bodies = builds of the members (type or a full body)
CREWS.push(
  { id: 'funk', d: 'park', name: _t('Фанк-бригада'), lv: 5, col: '#FF7AD9', at: [-8.2, 8.4], wall: [-8.2, 5.5], base: 5, bodies: [{ type: 'stocky', style: 'afro' }, { type: 'heavy', style: 'top', beard: true }, { type: 'slim', style: 'afro' }],
    fix: l => { l.top = 'track'; Object.assign(l.col, { top: '#7A2FB8', yoke: '#FFD23F', sleeve: '#7A2FB8', cuff: '#FFD23F', trim: '#FFD23F', pants: '#7A2FB8', stripe: '#FFD23F' }); if (l.col.hat) l.col.hat = ['#FFD23F', '#7A2FB8']; }, looks: [['c:funkTrack'], [], ['girl']], gear: ['funkTrack'] },
  { id: 'roots', d: 'park', name: _t('Корни'), lv: 6, col: '#7CD957', at: [8.2, 2.4], wall: [8.2, -.5], base: 5, bodies: [{ type: 'lanky', style: 'longLocs', skin: '#613B2E' }, { type: 'slim', style: 'longLocs', skin: '#88553B', face: 2, layers: true }, { type: 'athl', style: 'dreads', beard: true }, { type: 'small', style: 'dreads' }],
    fix: l => { if (l.top !== 'tee') { l.col.top = '#1f3d24'; if (l.col.sleeve) l.col.sleeve = '#1f3d24'; l.col.cuff = '#FFD23F'; l.col.trim = '#C8202A'; } else l.col.top = '#2F8F3A'; l.col.pants = '#3a3226'; l.col.stripe = null; if (l.col.hat) l.col.hat = ['#2F8F3A', '#FFD23F']; },
    looks: [['c:rootsBeanie'], ['c:rootsBeanie', 'girl'], [], ['c:rootsBeanie']], gear: ['rootsBeanie'] },
  { id: 'wave', d: 'park', name: _t('Волна'), lv: 7, col: '#3FD6E0', at: [4.2, -5.4], wall: [4.2, -8.3], boss: _t('Кюрасао'), base: 7, bodies: [{ type: 'athl', h: 1.12, style: 'mohawk', dye: '#3FD6E0' }, { type: 'slim', style: 'buns', skin: '#AB744C', layers: true }, { type: 'big', style: 'buzz', beard: true }, { type: 'lanky', style: 'curly' }],
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
const CUTS = ['hoodie', 'tee', 'track', 'bomber', 'teeBig'], HAIRY = /afro|mohawk|dreads|top|bun|curly|braids|long|Locs/;
const tint = (c, k) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString();
function dress(l, c, i, acc, body) {
  const slots = new Set(acc.map(k => HERO.itemOf && HERO.itemOf(k)).filter(Boolean).map(g => g.slot)), st = CSTY[c.id], r = rng((c.id.length * 131 + c.id.charCodeAt(0) * 17 + i * 7919) >>> 0), C = l.col;
  const at = (a, k = 0) => a[(i + k) % a.length], A = st ? st.acc : c.col;
  if (!slots.has('top')) {
    const t = body.layers ? 'teeBig' : st ? at(st.cuts) : at(CUTS, c.id.length);
    l.top = t;
    l.layers = !!body.layers;
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
  if (body.layers && !slots.has('pants')) { l.pants = 'wind'; C.stripe = null; }
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
const WRITER_PALETTE = { yard: 'fire', center: 'ice', park: 'candy', prom: 'volt' };
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
const FOOT_OPTION = { id: 'footwork', c: 'Breakdance_Footwork_2', lv: 1, pts: 2, risk: 0, nm: 'FOOTWORK' };
const battleBpm = id => window.RB?.LOOPS.find(loop => loop.id === id)?.bpm || 112;
const activeBpm = () => battleBpm(window.RB?.bgmId() || 'yard');
const currentBeat = () => window.RB?.audioState() === 'running' ? RB.bgmBeat() : null;
const $ = s => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t * t * (3 - 2 * t);
const today = () => { const d = new Date(); return d.getFullYear() * 1e4 + (d.getMonth() + 1) * 100 + d.getDate(); };
const pick = (a, r) => a[Math.floor(r() * a.length) % a.length];
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
  s.powerContest = s.powerContest || { best: 0, wins: 0 };
  s.story = loadStory(s.story);
  s.festival = loadFestivalState(s.festival);
  s.smoke = s.smoke || { wins: 0, best: 0, played: 0, day: 0 };
  s.scratchBest = Array.isArray(s.scratchBest) ? s.scratchBest : [];
  s.clubTrack = s.clubTrack === 1 ? 1 : 0;
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
body:has(#g3wheel[open]) #g3turn{visibility:hidden}
body:has(#g3wheel[open]) #g3sc{top:calc(max(10px,env(safe-area-inset-top)) + 44px)}
@media (max-height:530px) and (orientation:landscape){body:has(#g3wheel[open]) #g3sc{top:max(8px,env(safe-area-inset-top));padding:5px 12px}}
#g3mv{position:absolute;left:50%;bottom:calc(120px + env(safe-area-inset-bottom));transform:translateX(-50%);font:400 30px Anton,sans-serif;letter-spacing:.05em;text-shadow:0 3px 14px #000;white-space:nowrap;transition:transform .2s}
#g3mv.pop{transform:translateX(-50%) scale(1.15)}
#g3mv small{display:block;text-align:center;font:700 14px Inter,sans-serif;letter-spacing:.04em}
#g3mv .ok{color:#3BD16F}#g3mv .bad{color:#FF5A4F}#g3mv .gold{color:#FFD23F}
#g3myth{position:absolute;left:50%;top:48%;width:min(38vw,220px);transform:translate(-50%,-50%);padding:12px;background:radial-gradient(ellipse,#66171f,#180a11 78%);border:1px solid #ee6971;border-radius:18px;pointer-events:none}
#g3myth svg{display:block;width:100%;height:auto;overflow:visible}
#g3skip,#g3modeExit{position:absolute;right:12px;bottom:calc(24px + env(safe-area-inset-bottom));pointer-events:auto;border:1px solid rgba(255,255,255,.2);background:rgba(12,14,19,.7);color:#F2EFE8;border-radius:18px;padding:9px 14px;font:600 13px Inter,sans-serif}
#g3modeExit{left:12px;right:auto}
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
#g3info>div{width:min(460px,100%);background:#14161b;border-radius:22px 22px 0 0;padding:18px 18px calc(18px + env(safe-area-inset-bottom));font:500 14px/1.45 Inter,sans-serif;color:#D9D4CA;max-height:80vh;overflow:auto;touch-action:pan-y}
#g3info h4{margin:0 0 8px;font:400 22px Anton,sans-serif;letter-spacing:.04em;color:#F2EFE8}#g3info b{color:#F2EFE8}#g3info .row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.07)}
#g3info button{margin-top:12px;width:100%;border:0;border-radius:14px;padding:13px;font:800 15px Inter,sans-serif;background:#E2611A;color:#0B0D12}
#g3info button.sec{background:#262a33;color:#F2EFE8}
#g3info button:disabled{opacity:.55}
#g3info .cu{display:flex;gap:12px;align-items:center;padding:11px 0;border-bottom:1px solid rgba(255,255,255,.07)}#g3info .cu>i{font-style:normal;font-size:26px;width:34px;text-align:center}
#g3info .cu>div{flex:1;min-width:0}#g3info .cu small{display:block;color:#9a968e;font-size:12.5px;line-height:1.35}#g3info .cu small.n{color:#D9D4CA}#g3info .cu .dots{color:#E2611A;letter-spacing:2px;margin-left:6px;font-size:12px}
#g3info .cu button{margin:0;width:auto;flex:none;padding:10px 12px;font-size:13.5px;border-radius:12px;white-space:nowrap}#g3info .cu button:disabled{background:#262a33;color:#7d7a74}
#g3info .cu.max button{background:rgba(59,209,111,.14);color:#3BD16F}
#g3info.cum{background:linear-gradient(rgba(5,6,9,0) 30%,rgba(5,6,9,.55))}#g3info.cum>div{max-height:60vh;padding-top:14px}#g3info.cum p{margin:0 0 4px;font-size:13px}#g3info.cum .cu{padding:8px 0}
#g3info.cum button#g3cuL{margin-top:8px;padding:10px;font-size:13.5px}
#g3choiceActions{display:grid;grid-template-columns:1fr 2fr;gap:8px}
`;
function ui() {
  const st = document.createElement('style'); st.textContent = CSS + STORY_CSS; document.head.appendChild(st);
  const h = document.createElement('div'); h.innerHTML = `
<div id="g3hud"><div class="chip" id="g3en"><span>⚡ <b id="g3enN"></b> ${_t('энергии')}</span><div class="bar"><i></i></div></div>
<div class="chip" id="g3rk"><span>★ <b id="g3rkN"></b> · <span id="g3rkC"></span></span><div class="bar"><i></i></div></div></div>
<div id="g3hud2"><button type="button" class="chip" id="g3story" aria-haspopup="dialog">${_t('Сюжет')} <b></b></button><button type="button" class="chip" id="g3festivalOpen" aria-haspopup="dialog" hidden>${_t('Фестиваль')}</button><div class="chip" id="g3gl">📋 <b id="g3glN"></b></div><div class="chip" id="g3tf">🎨 <b id="g3tfN"></b></div></div>
<div id="g3storyNear" role="timer" hidden></div>
<button id="g3act" type="button"></button>
<div id="g3bt"><div id="g3sc"><span class="me">${_t('ТЫ')}</span><span class="n" id="g3a">0</span>:<span class="n" id="g3b">0</span><span class="op" id="g3on"></span></div><div id="g3turn"></div><div id="g3myth" aria-hidden="true" hidden></div><div id="g3mv"></div><button id="g3skip" type="button">${_t('Пропустить')} ⏭</button><button id="g3modeExit" type="button" hidden>${_t('В город')}</button></div>
<div id="g3res"></div><div id="g3toast" role="status"></div><div id="g3info"><div></div></div>`;
  [...h.children].forEach(c => document.body.appendChild(c));
}
let toastT = 0;
function toast(t, rewards = []) { const e = $('#g3toast'); e.textContent = [t, ...rewards].join(' · '); e.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('on'), 2600); }
let NHERE = 4, IDS = [];
function paintHud() {
  $('#g3enN').textContent = unlimitedEnergy ? '∞' : S.en + ' / ' + BAL.enMax;
  $('#g3en .bar i').style.width = (unlimitedEnergy ? 100 : Math.min(100, S.en / BAL.enMax * 100)) + '%';
  $('#g3en').classList.toggle('over', unlimitedEnergy || S.en > BAL.enMax);
  const r = rankOf(S.rep), a = BAL.rep[r], b = BAL.rep[r + 1];
  $('#g3rkN').textContent = BAL.ranks[r]; $('#g3rkC').textContent = b ? _t('{a} / {b} уважения', { a: S.rep, b }) : _t('{a} уважения', { a: S.rep });
  $('#g3rk .bar i').style.width = (b ? (S.rep - a) / (b - a) * 100 : 100) + '%';
  const gd = S.goals ? S.goals.filter(g => g.done).length : 0; $('#g3glN').textContent = gd + ' / 3'; $('#g3gl').classList.toggle('all', gd === 3);
  $('#g3tfN').textContent = IDS.filter(id => S.turf[id]).length + ' / ' + NHERE;
  const complete = S.story.length === CHAPTERS.length;
  $('#g3story b').textContent = complete ? '✓' : S.story.length === INVITATION_COUNT ? _t('Финал') : `${S.story.length}/${INVITATION_COUNT}`;
  $('#g3story').classList.toggle('done', complete);
  $('#g3festivalOpen').hidden = S.story.length === 0;
}
function info(html) { const e = $('#g3info'); e.firstElementChild.innerHTML = html; e.classList.add('on'); }

// ---------- the game ----------
export function initGame(ctx) {
  // ctx: { scene, W, collide: (x,z,r)=>{x,z}, circ(x,z,r), heroLevel(), shake(k), home() }
  S = load(); ui(); onGoal = t => { toast(t); paintHud(); };
  const D = ctx.dist || 'yard', HERE = CREWS.filter(c => (c.d || 'yard') === D), Bd = ctx.W.bounds;
  const festivalVisit = Boolean(ctx.festivalVisit && S.story.length);
  const regularAccess = { yard: true, center: rankOf(S.rep) >= BAL.gateRank,
    park: Boolean(S.wins.chrome || S.seen.park), prom: Boolean(S.wins.wave || S.seen.prom), club: Boolean(S.wins.forge) };
  const festivalOnly = festivalVisit && !regularAccess[D];
  if (!festivalVisit && S.where !== D) { S.where = D; save(); }
  NHERE = HERE.length; IDS = HERE.map(c => c.id);
  const W = ctx.W, scene = ctx.scene, notes = refill();
  const PM = initPower({ W, camera: ctx.camera, sfx });
  const FZ = initFreeze(), wheel = initWheel(), wheelAnchor = new THREE.Vector3();
  let choosing = null;
  const powerModes = initPowerModes({ W, PM, wheel, playMusic: ctx.music, sfx, fallStart, fallTick, fallEnd,
    score: (move, res) => powerPoints(move, res, 0), record: recordContest, onEnd: endAct });
  if (!festivalVisit && D === 'center' && !S.seen.center) { S.seen.center = today(); save(); notes.push(_t('🏙 Центр открыт! Банды здесь 3–5 уровня — сильнее дворовых')); }
  if (!festivalVisit && D === 'park' && !S.seen.park) { S.seen.park = today(); save(); notes.push(_t('🌳 Парк открыт! Банды 5–7 уровня, джем на эстраде и старый би-бой у шахматных столов')); }
  if (!festivalVisit && D === 'prom' && !S.seen.prom) { S.seen.prom = today(); save(); notes.push(_t('🏭 Промзона открыта! Банды 6–8 уровня, подпольный ринг и тайники')); }
  const previousRewards = collectGear();
  if (previousRewards.length) { notes.push(...previousRewards); save(); }
  paintHud(); if (notes.length) setTimeout(() => toast(notes.join(' · ')), 900);
  addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    const notes = refill(); paintHud();
    if (notes.length) toast(notes.join(' · '));
    for (const g of crews) {
      const mine = Boolean(S.turf[g.c.id]);
      if (g.wall.mine === mine || P?.g === g) continue;
      revealGraffiti(g.wall, g.wall.cv, g.wall.artCanvas(wallArt(g.c, mine)), 1);
      g.wall.mine = mine;
    }
  });
  $('#g3en').onclick = () => {
    if (unlimitedEnergy) {
      info(`<h4>${_t('⚡ Энергия')} · ∞</h4><button onclick="this.closest('#g3info').classList.remove('on')">${_t('Понятно')}</button>`);
      return;
    }
    info(`<h4>${_t('⚡ Энергия')}</h4><p>${_t('Каждый батл с бандой стоит <b>{n} ⚡</b>. Каждый новый день энергия бесплатно восстанавливается до <b>{m} ⚡</b>.', { n: BAL.battle, m: BAL.daily })}</p>
    <p>${_t('<b>Уроки</b> и награды в городе добавляют энергию сверх {m}: каждая минута урока = <b>+{n} ⚡</b>. Запас копится до {c} ⚡ и не сгорает.', { n: BAL.perMin, m: BAL.enMax, c: BAL.enCap })}</p>
    <p>${_t('Сила твоего би-боя тоже из уроков: чем выше уровень героя, тем сложнее пауэр он крутит и тем реже падает.')}</p><button onclick="location.href='./'">${_t('🎬 К урокам')}</button>`);
  };
  $('#g3info').onclick = e => {
    if (e.target.id !== 'g3info') return;
    if (choosing) closeChoice(); else e.currentTarget.classList.remove('on');
  };
  addEventListener('keydown', e => { if (choosing && e.key === 'Escape') closeChoice(); });
  $('#g3story').onclick = openStory;
  $('#g3rk').onclick = () => { const r = rankOf(S.rep), lv = ctx.heroLevel();
    info(`<h4>${_t('★ Прогресс')}</h4>${BAL.ranks.map((n, i) => `<div class="row"><span>${i <= r ? '✅' : '🔒'} ${n}</span><span>${BAL.rep[i]} ★</span></div>`).join('')}
    <p style="margin-top:10px">${_t('Побеждай банды — получай уважение и их шмотки (они видны на тебе и помогают в батлах).')}</p>
    ${HERE.map(c => `<div class="row"><span style="color:${c.col}">${c.name} · ${_t('ур. {n}', { n: c.lv })}${c.boss ? ' · ' + _t('хозяева района') : ''}</span><span>${S.wins[c.id] ? '🏆 ' + S.wins[c.id] : (lv >= c.lv ? _t('по силам') : _t('сильнее тебя'))}</span></div>`).join('')}
    <p>${_t('Твой уровень: <b>{n}</b> — растёт от минут уроков.', { n: lv })}</p><button onclick="this.closest('#g3info').classList.remove('on')">${_t('Понятно')}</button>`); };

  $('#g3gl').onclick = () => info(`<h4>${_t('📋 Задания на сегодня')}</h4>${S.goals.map(g => { const G = GOALS.find(x => x.id === g.id);
      return `<div class="gl ${g.done ? 'd' : ''}"><i>${g.done ? '✅' : '⬜'}</i><span>${G.t}</span><span class="p">${g.n} / ${G.n}</span></div>`; }).join('')}
    <p style="margin-top:10px">${_t('За каждое задание <b>+5 ★</b>. Все три — <b>+15 ⚡</b>{x}. Завтра будут новые.', { x: S.goalsPaid ? _t(' (уже получено ✓)') : '' })}</p><button onclick="this.closest('#g3info').classList.remove('on')">${_t('Понятно')}</button>`);
  $('#g3tf').onclick = () => info(`<h4>${_t('🎨 Стены района')}</h4><p>${_t('У каждой банды своя стена с граффити. <b>Победи банду</b> — и в тот же день можешь закрасить её стену своим куском (−{n} ⚡).', { n: energyCost(BAL.paint) })}</p>
    <p>${_t('Каждая твоя стена даёт <b>+{n} ★ каждый день</b>. Если банду не побеждать {d} дня, она закрасит стену обратно.', { n: BAL.turfRep, d: BAL.hold })}</p>
    ${HERE.map(c => `<div class="row"><span style="color:${c.col}">${c.name}</span><span>${S.turf[c.id] ? _t('🎨 твоя') : S.beat[c.id] === today() ? _t('🟢 можно закрасить') : '—'}</span></div>`).join('')}
    <button onclick="this.closest('#g3info').classList.remove('on')">${_t('Понятно')}</button>`);

  // crews of this district
  const crews = HERE.map((c, ci) => {
    const g = { c, people: [], ambientEnabled: true, x: c.at[0], z: c.at[1] };
    const r = rng(ci * 77 + 3);
    c.looks.forEach((acc, i) => {
      const { lk, body } = crewLook(c, ci, i, D), J = mocapPerson(lk, { body });
      // Spectators line the flanks, clear of the entrances from the north and south.
      const flank = (ci + i) % 2 ? -1 : 1;
      J.home = i === 0 ? { x: g.x + Math.cos(ci) * 1.35, z: g.z + Math.sin(ci) * 1.35 }
        : { x: g.x + flank * 1.92, z: g.z + (i < 3 ? flank * .35 : -flank * 1.02) };
      J.root.position.set(J.home.x, 0, J.home.z);
      J.root.rotation.y = Math.atan2(g.x - J.home.x, g.z - J.home.z);
      J.play(i === 0 ? pick(TOP, r)[0] : 'Breakdance_Ready', { at: r() * 2, speed: .9 + r() * .2 });
      scene.add(J.root); g.people.push(J); ctx.circ(J.home.x, J.home.z, .3);
    });
    // The painted circle and crew wall locate the battle. The action button names the crew.
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256; const x = cv.getContext('2d');
    x.strokeStyle = c.col; x.lineWidth = 10; x.setLineDash([26, 16]); x.beginPath(); x.arc(128, 128, 112, 0, 7); x.stroke();
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, opacity: .6, toneMapped: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(g.x, .02, g.z); scene.add(ring); g.ring = ring;
    return g;
  });
  // ---------- crew walls (graffiti turf) ----------
  const nick = () => {
    if (S.word) return S.word;
    try {
      const { nick } = JSON.parse(localStorage.getItem('fedoskin-profile') || '{}');
      return (nick || '').replace(/^b[-_ ]?(?:boy|girl)(?:\s+|$)/i, '');
    } catch (_) { return ''; }
  };
  const wallArt = (c, mine) => mine
    ? { word: nick(), style: c.id === 'forge' ? 'stencil' : ART[c.id].style,
      pal: c.id === 'forge' ? 'ochre' : WRITER_PALETTE[D], extra: 'crown' }
    : { ...ART[c.id], piece: c.id };
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
  crews.forEach((g, i) => {
    const at = placeWall(g), mine = Boolean(S.turf[g.c.id]);
    const wall = makeGraffitiWall({ model: ctx.wallModel, surface: ctx.wallSurface, seed: i + 5, spec: wallArt(g.c, mine) });
    const grp = wall.group;
    grp.position.set(at.x, 0, at.z); grp.rotation.y = Math.atan2(g.x - at.x, g.z - at.z); scene.add(grp);
    g.wall = { ...wall, mine, at, x: at.x + Math.sin(grp.rotation.y) * 1.2, z: at.z + Math.cos(grp.rotation.y) * 1.2 };
    if (ctx.box) { const c = Math.cos(grp.rotation.y), sn = Math.abs(Math.sin(grp.rotation.y)); ctx.box(at.x, at.z, 3.6 * Math.abs(c) + .3 * sn + .1, 3.6 * sn + .3 * Math.abs(c) + .1); }
  });
  const canPaint = g => S.beat[g.c.id] === today() && !S.turf[g.c.id];
  let P = null;   // painting in progress
  function startPaint(g) {
    if (S.en < energyCost(BAL.paint)) { toast(_t('Нужно {n} ⚡ — посмотри урок', { n: energyCost(BAL.paint) })); return; }
    S.en -= energyCost(BAL.paint); save(); paintHud();
    const H = W.hero, w = g.wall;
    const yaw = w.group.rotation.y;
    const tangent = { x: Math.cos(yaw), z: -Math.sin(yaw) };
    const aside = [1.64, -1.64].map(d => ({ x: w.x + tangent.x * d, z: w.z + tangent.z * d })).find(p => {
      const clear = ctx.collide(p.x, p.z, .32);
      return Math.hypot(p.x - clear.x, p.z - clear.z) < .04;
    }) || w;
    P = { g, t: 0, from: { x: H.root.position.x, z: H.root.position.z }, aside,
      old: w.artCanvas(wallArt(g.c, false)), neu: w.artCanvas(wallArt(g.c, true)) };
    const dist = Math.max(4.6, 2.05 / (ctx.camera.aspect * Math.tan(THREE.MathUtils.degToRad(ctx.camera.fov / 2))));
    const off = new THREE.Vector3(Math.sin(yaw) * dist, dist * .52, Math.cos(yaw) * dist);
    W.lock = true; W.camT = { x: w.at.x, y: 1.10, z: w.at.z, zoom: 1, off }; W.zoom = 1; W.camSnap = true;
    document.body.classList.add('g3fight');
    for (const crew of crews) crew.ambientEnabled = false;
    H.play('Breakdance_Ready', { fade: .3 }); try { window.RB && RB.hiss && RB.hiss(true); } catch (_) {}
    paintAct();
  }
  function paintTick(dt) {
    const H = W.hero, w = P.g.wall, previous = P.t;
    P.t += dt;
    const step = clamp((P.t - 4.2) / .56, 0, 1), walk = ease(clamp(P.t / .9, 0, 1));
    const pos = H.root.position;
    pos.set(lerp(P.from.x, w.x, walk), 0, lerp(P.from.z, w.z, walk));
    if (step > 0 && P.aside !== w) {
      const clear = ctx.collide(lerp(w.x, P.aside.x, step), lerp(w.z, P.aside.z, step), .32);
      pos.set(clear.x, 0, clear.z);
      if (previous <= 4.2) H.play('Walking', { fade: .15 });
      if (P.t >= 4.76 && previous < 4.76) H.play('Breakdance_Ready', { fade: .2 });
    }
    H.root.rotation.y = step > 0 && step < 1 && P.aside !== w
      ? Math.atan2(P.aside.x - w.x, P.aside.z - w.z)
      : Math.atan2(w.at.x - pos.x, w.at.z - pos.z);
    if (P.t > 1 && previous < 4.2) revealGraffiti(w, P.old, P.neu, clamp((P.t - 1) / 3.2, 0, 1));
    if (P.t >= 4.2 && previous < 4.2) { try { window.RB?.hiss?.(false); } catch (_) {} }
    H.tick(dt);
    if (P.t > 1 && P.t < 4.2) {
      const a = Math.sin(P.t * 9) * .35;
      H.B.RightArm.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -1.1 + a));
    }
    if (P.t > 5.35) endPaint();
  }
  function endPaint() {
    const g = P.g; P = null; try { window.RB && RB.hiss && RB.hiss(false); } catch (_) {}
    S.turf[g.c.id] = today(); S.last[g.c.id] = today(); S.rep += BAL.repPaint; g.wall.mine = true;
    const rewards = collectGear('paint', g.c.id);
    bumpGoal('paint'); save(); paintHud();
    W.lock = false; W.camT = null; document.body.classList.remove('g3fight'); W.hero.play('Bboy_Uprock', { fade: .3 });
    for (const crew of crews) crew.ambientEnabled = shown(crew);
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
  const freeNear = (px, pz, clear, avoid = []) => { for (let ring = 0; ring < 6; ring++) for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, x = px + Math.cos(a) * ring * .8, z = pz + Math.sin(a) * ring * .8;
      if (x < Bd.x0 + .8 || x > Bd.x1 - .8 || z < Bd.z0 + .8 || z > Bd.z1 - .8) continue;
      if (avoid.some(o => Math.hypot(x - o.x, z - o.z) < o.r)) continue;
      if ((ctx.colliders || []).every(c => c.r !== undefined ? Math.hypot(x - c.x, z - c.z) > c.r + clear : Math.hypot(x - clamp(x, c.x0, c.x1), z - clamp(z, c.z0, c.z1)) > clear)) return { x, z }; }
    return { x: px, z: pz }; };
  const M = (c, r = .7, m = 0, e) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, emissive: e || '#000', emissiveIntensity: e ? 1.6 : 0 });
  const mk = (g, geo, mat, x, y, z) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
  const C0 = W.cyph || { x: 1.5, z: -7.2 };
  const Y = D !== 'yard' ? null : (() => {
  // DJ booth by the cypher: a table, two decks with spinning records, a mixer, a laptop glow and a DJ
  const djAt = freeNear(C0.x + 4.2, C0.z + 2.6, 1.3), dj = new THREE.Group(); dj.position.set(djAt.x, 0, djAt.z); dj.rotation.y = Math.atan2(C0.x - djAt.x, C0.z - djAt.z); scene.add(dj);
  const booth = ctx.djBooth;
  let recs = ['record-left', 'record-right'].map(name => booth?.getObjectByName(name));
  let strip = booth?.getObjectByName('front meter');
  let faders = [];
  if (strip?.material && recs.every(Boolean)) {
    dj.add(booth);
    faders = ['fader-left', 'fader-right'].map(name => booth.getObjectByName(name));
    booth.children.forEach(part => {
      if (part.name === 'matte' || part.name === 'brushed metal') part.castShadow = true;
    });
    // Three footprint circles follow the angle of the flight case and leave the front approach open.
    [-.74, 0, .74].forEach(x => ctx.circ(djAt.x + x * Math.cos(dj.rotation.y), djAt.z - x * Math.sin(dj.rotation.y), .49));
  } else {
    mk(dj, new THREE.BoxGeometry(1.7, .9, .7), M('#1b1d22', .6), 0, .45, 0);
    mk(dj, new THREE.BoxGeometry(1.75, .05, .75), M('#2c2f36', .4, .3), 0, .92, 0);
    recs = [-.48, .48].map(x => {
      mk(dj, new THREE.CylinderGeometry(.27, .27, .04, 24), M('#3a3d44', .5, .4), x, .96, 0);
      const r = mk(dj, new THREE.CylinderGeometry(.24, .24, .02, 24), M('#0c0c0e', .3), x, .99, 0);
      mk(r, new THREE.CylinderGeometry(.07, .07, .021, 16), M('#E2611A', .5, 0, '#E2611A'), 0, .001, 0);
      return r;
    });
    mk(dj, new THREE.BoxGeometry(.3, .05, .4), M('#25282e', .5), 0, .97, 0);
    strip = mk(dj, new THREE.BoxGeometry(1.6, .04, .02), M('#E2611A', .4, 0, '#E2611A'), 0, .2, .36);
    ctx.circ(djAt.x, djAt.z, .95);
  }
  const djLook = HERO.topDown(6, ['c:djGloves']);
  djLook.phones = true;
  Object.assign(djLook.col, { phones: '#d46732', top: '#292f43', sleeve: '#363b52', cuff: '#c7733e' });
  const djP = mocapPerson(djLook, { body: bodyOf(5, { type: 'heavy', style: 'longLocs', skin: '#613B2E', beard: true }) });
  dj.add(djP.root);
  const djMix = performDJ(djP, dj, recs, strip, faders);
  const djSign = mountSign(ctx.wayfinding, 'decks-badge', dj, -.49, .49, .448);
  if (djSign) plaqueInk(djSign, 'DJ', { width:.23, height:.095, z:.088, color:'#25222a' });
  const djFront = { x: djAt.x + Math.sin(dj.rotation.y) * 1.1, z: djAt.z + Math.cos(dj.rotation.y) * 1.1 };
  // practice mat: a padded mat with taped lines and a pair of cones
  const matAt = freeNear(9.6, 3.6, 1.6), mat = new THREE.Group(); mat.position.set(matAt.x, 0, matAt.z); scene.add(mat);
  mk(mat, new RoundedBoxGeometry(2.6, .06, 2.6, 2, .02), M('#2b3f63', .9), 0, .03, 0);
  [-1, 1].forEach(k => { mk(mat, new THREE.BoxGeometry(2.4, .005, .05), M('#e9e4d8', .8), 0, .065, k * 1.1); mk(mat, new THREE.ConeGeometry(.12, .3, 10), M('#E2611A', .6), k * 1.45, .15, 1.45 * k); });
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
  const atelierSign = mountSign(ctx.wayfinding, 'yard-sewing-plate', at, -.35, 2.33, -.89);
  if (atelierSign) plaqueInk(atelierSign, _t('АТЕЛЬЕ «ИГЛА»'), { width:1.43, height:.235, z:.06, color:'#f3d5bc' });
  [-1.10, .40].forEach(x => mk(at, new THREE.CylinderGeometry(.022, .022, 2.34, 6), M('#3a3d44', .5, .5), x, 1.167, -.94));
  const atP = mocapPerson(HERO.topDown(5, []), { body: bodyOf(77, { girl: true, type: 'slim', style: 'bun' }), idle: 'Stand_Calm' }); atP.root.position.set(0, 0, -.55); at.add(atP.root); atP.play('Breakdance_Ready');
  ctx.circ && ctx.circ(atAt.x, atAt.z, .95); ctx.box && ctx.box(atAt.x + .2, atAt.z - .9, 1.8, .3); ctx.circ && ctx.circ(atAt.x + 1.25, atAt.z - .4, .3);
  { // a bare bulb on a wire over the table and its warm light on the stall (the corner was dark)
    mk(at, new THREE.CylinderGeometry(.006, .006, .7, 4), M('#111', .9), .05, 2.55, .1); const bulb = mk(at, new THREE.SphereGeometry(.07, 12, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.35, 1.1, .75), toneMapped: false }), .05, 2.17, .1); bulb.castShadow = false;
    const sp = new THREE.SpotLight('#ffcf9a', 20, 0, 1.05, .85, 2); /* 46 → 20 (17.11.2026): the table and the cloth burnt out white */ sp.position.set(atAt.x + .05, 2.12, atAt.z + .1); sp.target.position.set(atAt.x + .1, 0, atAt.z + .75); scene.add(sp, sp.target); }
  const atFront = { x: atAt.x, z: atAt.z + 1.25 };
  // the gate to the next district: an arch with a lit sign, closed by a chain until the right rank
  const gAt = freeNear(-1.2, -14.2, 1.4), gate = new THREE.Group(); gate.position.set(gAt.x, 0, gAt.z); scene.add(gate);
  [-1.4, 1.4].forEach(x => mk(gate, new THREE.BoxGeometry(.35, 3, .35), M('#3a3c42', .8), x, 1.5, 0));
  mk(gate, new THREE.BoxGeometry(3.2, .45, .4), M('#2a2c31', .7), 0, 3.1, 0);
  const gSign = document.createElement('canvas'); gSign.width = 512; gSign.height = 64; const gx = gSign.getContext('2d'); gx.fillStyle = '#E2611A'; gx.font = '400 46px Anton, sans-serif'; gx.textAlign = 'center'; { const s = _t('ЦЕНТР  →'), m = gx.measureText(s).width; if (m > 496) gx.font = '400 ' + Math.floor(46 * 496 / m) + 'px Anton, sans-serif'; gx.fillText(s, 256, 50); }
  mk(gate, new THREE.PlaneGeometry(2.9, .36), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(gSign), transparent: true, toneMapped: false }), 0, 3.1, .21);
  const chain = mk(gate, new THREE.BoxGeometry(2.5, .06, .06), M('#c9c4b8', .3, .9), 0, 1.1, 0);
  ctx.circ && ctx.circ(gAt.x - 1.4, gAt.z, .3); ctx.circ && ctx.circ(gAt.x + 1.4, gAt.z, .3); ctx.box && ctx.box(gAt.x, gAt.z, 2.4, .2);
  const arena = freeNear(4.4, 2.8, 1.8, [
    ...crews.map(g => ({ x: g.x, z: g.z, r: 3.8 })),
    { ...C0, r: 4.2 }, { ...matAt, r: 4.6 },
  ]);
  const paintRing = new THREE.Mesh(new THREE.RingGeometry(1.58, 1.66, 64),
    new THREE.MeshBasicMaterial({ color: '#FFAA5A', transparent: true, opacity: .88, toneMapped: false, side: THREE.DoubleSide }));
  paintRing.rotation.x = -Math.PI / 2;
  paintRing.position.set(arena.x, .026, arena.z);
  scene.add(paintRing);
  const stencil = plaqueInk(scene, _t('ПАУЭРМУВ-КОНТЕСТ'), { width:2.15, height:.17, x:arena.x, y:.028, z:arena.z + 1.44, color:'#efba80' });
  stencil.rotation.x = -Math.PI / 2;
  const PLACES = [
    { id: 'powerContest', x: arena.x, z: arena.z, r: 2.15 },
    { id: 'show', x: C0.x, z: C0.z + 3.2, r: 1.5 }, { id: 'dj', x: djFront.x, z: djFront.z, r: 1.4 }, { id: 'mat', x: matAt.x, z: matAt.z, r: 1.7 }, { id: 'gate', x: gAt.x, z: gAt.z + 1.2, r: 1.7 },
    { id: 'storyFinale', x: C0.x + 1.4, z: C0.z + 2.8, r: 1.6 },
    { id: 'atelier', x: atFront.x, z: atFront.z, r: 1.6 },
  ];
  return { djMix, matAt, arena, chain, atP, atFront, PLACES }; })();
  const { djMix = null, matAt = null, chain = null, atP = null, atFront = null } = Y || {};
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
  const club = W.club;
  const smoke = club && initSmoke({ W, clipLen, currentBeat, playPlayer: smokeBattle, cancelPlayer: clearSmokeBattle, preview: smokePreview,
    playMusic: ctx.music, record: recordSmoke, end: endAct, sfx });
  if (club) {
    $('#g3tf').hidden = true;
    ctx.backgroundMusic?.(CLUB_TRACKS[S.clubTrack]);
    PLACES.push({ ...club.smokeEntry, id: 'smoke' },
      { ...club.dj, id: 'clubDJ' }, { ...club.records, id: 'clubRecords' }, { ...club.exit, id: 'backProm' });
  }
  const guide = initCityGuide(_t);
  const landmark = initLandmarkView({ scene, district:D });
  const guideColliders = ctx.colliders || [], placements = new Map();
  const groundArt = (id, point) => {
    const key = [id,point.x,point.z,guideColliders.length].join(':');
    if (!placements.has(key)) placements.set(key,placeLandmark(id,point,guideColliders,W.bounds));
    return placements.get(key);
  };
  let festivalGuest = null, festivalScene = null, festivalHome = null;
  let festivalPeople = [];
  let narrativeCast = null, festivalSpin = null, openingShow = null;
  let clubFestivalMove = null;
  const clubWorldPoint = club && new THREE.Vector3();
  function showFestivalMove(dancer, clip, cue, fade) {
    playFestivalMove(dancer, clip, cue, fade);
    // The briefing and practice examples can play the same clip with no live set.
    if (club && festival.performing() && onClubFloor(club.floor, dancer, clubWorldPoint)) {
      const seconds = clipLen(clip);
      clubFestivalMove = { dancer, clip, until: performance.now() + 1000 * Math.min(cue?.seconds || seconds, seconds) };
    }
  }
  function clearNarrativeCast() {
    if (!narrativeCast) return;
    narrativeCast.group.traverse(object => { if (object.isMesh) object.geometry.dispose(); });
    narrativeCast.group.removeFromParent();
    narrativeCast = null;
  }
  function setFestivalCast(point, order, lead) {
    const show = lead && W.cyph;
    if (show && !openingShow) {
      openingShow = { cyBusy: W.cyBusy, home: W.hero.root.position.clone(), yaw: W.hero.root.rotation.y };
      W.cyBusy = true;
      W.hero.root.position.set(show.x - 2.8, 0, show.z + .62);
      face(W.hero, show.x, show.z);
    }
    const centre = show || festivalScene?.position || W.hero.root.position;
    if (show) W.camT = { x:show.x, z: show.z + .6, zoom:.50 };
    const key = [point.x, point.z, centre.x, centre.z, lead, ...order].join(':');
    if (narrativeCast?.key === key) return;
    clearNarrativeCast();
    const group = new THREE.Group(), actors = {};
    group.name = 'FestivalNarrativeCast';
    scene.add(group);
    group.position.set(centre.x, .025, centre.z);
    if (show) {
      const light = new THREE.PointLight('#ffd09b', 10, 5);
      light.position.set(.35, 2.2, -.12);
      group.add(light);
    }
    order.forEach((actor, index) => {
      const stitch = actor === 'stitch';
      const outfit = HERO.topDown(stitch ? 3 : 5, stitch ? ['c:stencilBandana','c:cleanLaces'] : ['c:rebarCap','c:chromeTrack']);
      outfit.col.top = stitch ? '#eec477' : '#5379ae';
      outfit.col.sleeve = outfit.col.top;
      outfit.col.trim = stitch ? '#452e46' : '#d9e6ec';
      const dancer = mocapPerson(outfit, { body: bodyOf(stitch ? 410 : 611, { type: stitch ? 'slim' : 'athl' }) });
      dancer.root.name = 'FestivalDancer:' + actor;
      dancer.root.userData.role = actor === lead ? 'performs' : 'waits';
      const x = show ? actor === lead ? 0 : 2.75 : index ? 1.78 : -1.45;
      dancer.root.position.set(x, 0, show ? actor === lead ? 0 : -.72 : -2.05);
      if (show && actor === lead) dancer.root.rotation.y = .25;
      else face(dancer, 0, 0);
      dancer.play('Breakdance_Ready');
      group.add(dancer.root);
      actors[actor] = dancer;
    });
    narrativeCast = { key, group, actors };
  }
  function playFestivalMove(dancer, clip, cue, fade) {
    const length = clipLen(clip);
    const seconds = cue?.seconds;
    const spinClock = clip.startsWith('City_Backspin') && cue?.clock;
    const rate = seconds && length ? length / Math.max(.19, seconds) : 1;
    // A timed backspin includes its entry and exit; fit the whole phrase before the next cue.
    const speed = spinClock ? rate : clamp(rate, .45, 2.3);
    dancer.play(clip, { fade, once: cue ? true : undefined, speed });
    if (spinClock) {
      festivalSpin = { dancer, clip, length, clock: spinClock, at: spinClock(), speed };
    }
  }
  function createFestivalSet(point, act, decisions) {
    if (festivalScene) return;
    const layout = new THREE.Group();
    const centerZ = point.z - (D === 'park' ? 1.72 : D === 'prom' ? 2.8 : .85);
    layout.position.set(point.x - .32, .045, centerZ);
    layout.name = 'FestivalIndependentStage';
    scene.add(layout); festivalScene = layout;
    festivalHome ||= W.hero.root.position.clone();
    W.hero.root.position.set(layout.position.x, 0, centerZ);
    const industrial = decisions.venue === 'prom';
    const amber = new THREE.PointLight('#ff995c', industrial ? 18 : 10, 8);
    const side = new THREE.PointLight(decisions.sound === 'relay' ? '#c3a8ff' : '#72cadd', 14, 9);
    amber.position.set(-2.6, 2.5, .6); side.position.set(2.7, 2.9, -1.4);
    layout.add(amber, side);
    loadFestivalStage().then(props => {
      if (festivalScene !== layout) return;
      props.scale.setScalar(industrial ? .88 : .70);
      layout.add(props);
    }).catch(() => {});
    const clothes = [['c:stencilBandana'], ['c:waveKicks'], ['girl', 'c:rebarCap'], ['c:rootsBeanie']];
    const order = decisions.roster === 'crew' ? [2, 0, 3, 1] : [0, 1, 2, 3];
    for (const [i, n] of order.entries()) {
      const look = HERO.topDown(act === 7 ? 4 : 6, clothes[n]);
      const dancer = mocapPerson(look, { body: bodyOf(308 + n * 23, { type:['slim','athl','small','lanky'][n], girl: n === 2 }) });
      const angle = .27 + i * (Math.PI - .52) / (order.length - 1);
      dancer.root.position.set(Math.cos(angle) * 2.35, 0, -Math.sin(angle) * 1.95);
      face(dancer, 0, 0);
      dancer.play('Breakdance_Ready', { at: i / 4 });
      layout.add(dancer.root);
      festivalPeople[n] = dancer;
    }
  }
  const festival = initFestival({ t: _t, W, D, places: PLACES, colliders: ctx.colliders || [], state: S.festival,
    eligible: () => S.story.length > 0, landmarkPoint:groundArt, save, travel: to => travel(to, true), leaveVisit: festivalVisit ? () => travel(S.where) : null,
    openAllowed: () => !A && !B && !P && !choosing && $('#cityLoading').hidden && $('#alpha').hidden && !$('#lookDialog').open,
    lock(locked) {
      W.lock = locked;
      if (!locked) {
        if (openingShow) {
          W.hero.root.position.copy(openingShow.home);
          W.hero.root.rotation.y = openingShow.yaw;
          W.cyBusy = openingShow.cyBusy;
          openingShow = null;
        }
        clearNarrativeCast();
        festivalSpin = null;
        clubFestivalMove = null;
      }
      if (!locked && festivalScene) {
        if (festivalHome) W.hero.root.position.copy(festivalHome);
        festivalScene.traverse(mesh => { if (mesh.isMesh && !mesh.geometry.userData.sharedCityGeometry) mesh.geometry.dispose(); });
        festivalScene.removeFromParent(); festivalScene = festivalHome = null; festivalPeople = [];
      }
      paintAct();
    },
    prepareScene: createFestivalSet,
    setCast: setFestivalCast,
    tryPrize(items) {
      try {
        const profile = JSON.parse(localStorage.getItem('fedoskin-profile') || '{}');
        const own = JSON.parse(localStorage.getItem('fedoskin-wardrobe-owned:' + profile.id) || '[]');
        if (!items.every(item => own.includes(item))) return;
        const equipped = JSON.parse(localStorage.getItem('fedoskin-eq') || '[]');
        const itemSlots = new Set(items.map(item => HERO.itemOf(item).slot));
        const next = equipped.filter(id => !itemSlots.has(HERO.itemOf(id)?.slot)).concat(items);
        localStorage.setItem('fedoskin-eq', JSON.stringify(next));
        ctx.rewear?.();
        festival.close();
        toast(_t('Мифический комплект надет'));
      } catch (_) {}
    },
    displaySet(clip, rival, guestIndex, cue) {
      const named = narrativeCast?.actors[cue?.actor];
      if (named || !rival) {
        showFestivalMove(named || festivalPeople[guestIndex] || W.hero, clip, cue, .12);
        return;
      }
      if (!festivalGuest) {
        festivalGuest = mocapPerson(HERO.topDown(5, ['c:stencilBandana']), { body: bodyOf(412, { type: 'slim' }) });
        scene.add(festivalGuest.root);
      }
      const p = W.hero.root.position;
      festivalGuest.root.visible = true;
      festivalGuest.root.position.set(p.x - 1.25, 0, p.z - 1.25);
      face(festivalGuest, p.x, p.z);
      showFestivalMove(festivalGuest, clip, cue, .15);
    },
  });
  function openFestival(venue) {
    if (festival.open(venue)) guide.choose('festival');
  }
  $('#g3festivalOpen').onclick = () => openFestival(false);
  const lesMin = () => Math.max(0, Math.floor((lessonSec() - (S.lday || 0)) / 60));
  const myWalls = () => IDS.filter(id => S.turf[id]).length;
  const storyChapter = () => CHAPTERS[S.story.length];
  const storyPlaces = { cypher: 'show', mall: 'mall', jam: 'jam', ring: 'ring', finale: 'storyFinale' };
  const storyDistricts = ['yard', 'center', 'park', 'prom', 'club'];
  const finaleGuests = Y && storyChapter()?.id === 'finale' ? buildFinaleGuests() : [];
  const preferredMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const watchPoint = W.cyph && { x:W.cyph.x, z:W.cyph.z+3.72 };
  const courseStarted = () => S.festival.episode > 0 || S.festival.piece > 0 || S.festival.beat > 0 ||
    S.festival.prepared || Object.keys(S.festival.choices).length > 0;
  function guidingLine(chapter, festivalStep) {
    const selected = guide.line() || (festivalVisit || courseStarted() ? 'festival' : 'story');
    if (selected === 'festival' && festivalStep) return 'festival';
    if (chapter) return 'story';
    return festivalStep ? 'festival' : null;
  }
  function storyDestination(chapter) {
    if (!chapter || chapter.district !== D || festivalOnly) return null;
    if (chapter.id === 'cypher') return watchPoint;
    return PLACES.find(p => p.id === storyPlaces[chapter.id]);
  }
  function showLandmark(target) {
    if (!target) return;
    const snap = preferredMotion.matches;
    W.guideView = { x:target.x, z:target.z, zoom:Math.min(W.uZoom, .82), snap, until:performance.now()+2400 };
    if (snap) W.camSnap = true;
    $('#c3').focus({ preventScroll:true });
  }
  function guidanceEntry(chapter, line, object, festivalStep) {
    if (line !== 'festival' && S.story.length === 1 && festivalStep && !courseStarted() && !guide.inviteResolved()) {
      return { id:'festival-invite', line:'festival', art:'mat', title:_t('Винт зовёт на фестиваль'),
        where:_t('Двор · тренировочный коврик'),
        text:_t('Продолжи задание Винта у тренировочного мата во Дворе или собери общий сайфер.'),
        button:_t('К фестивалю'), action:() => { guide.choose('festival'); $('#c3').focus({preventScroll:true}); },
        alternate:{ button:_t('Продолжить сайфер'), action:() => { guide.choose('story'); $('#c3').focus({preventScroll:true}); } } };
    }
    if (line === 'festival' && festivalStep) {
      return { id:'festival:'+festivalStep.id+':'+D, line, art:festivalStep.art,
        title:festivalStep.title, where:festivalStep.where, text:festivalStep.text,
        button:_t(object ? 'Показать место' : 'Поехать к площадке'),
        action:object ? () => showLandmark(object.point) : () => travel(festivalStep.district,true) };
    }
    if (line !== 'story' || !chapter) return null;
    let text = _t(chapter.imageHint);
    if (chapter.id === 'cypher' && object) {
      text = _t(matchMedia('(pointer: coarse)').matches ?
        'Проведи пальцем по двору. Встань на следы у картона и смотри круг {n} секунд.' :
        'Подойди к следам у картона стрелками, клавишами WASD или кликом. Смотри круг {n} секунд.', { n:WATCH_TIME });
    }
    if (!object) text = festivalOnly ? _t('Выйди из сюжетного визита и продолжи общий сайфер.') : storyHint(chapter);
    return { id:'story:'+chapter.id+':'+D, line, art:CHAPTER_ART[chapter.id],
      title:_t(chapter.id === 'cypher' ? 'Винт · Смотреть круг' : chapter.title),
      where:_t(chapter.location), text, button:_t(object ? 'Показать место' : festivalOnly ? 'Вернуться в обычный город' : 'Открыть цель'),
      action:object ? () => showLandmark(object.point) : festivalOnly ? () => travel(S.where) : openStory };
  }

  function storyHint(chapter) {
    if (chapter.district === D) {
      if (chapter.id === 'cypher' || chapter.id === 'finale') return '';
      const place = PLACES.find(p => p.id === storyPlaces[chapter.id]);
      const button = placeBtn(place);
      if (button.off) return button.h;
      const cost = energyCost(BAL[chapter.id]);
      if (S.en < cost) return _t('Нужно {n} ⚡. Энергия пополняется бесплатно с новым днём.', { n: cost });
      return cost > 0 ? _t('Ориентир у места действия · −{n} ⚡', { n: cost }) : _t('Ориентир у места действия');
    }
    const ahead = storyDistricts.indexOf(chapter.district) > storyDistricts.indexOf(D);
    if (ahead && D === 'yard') {
      return rankOf(S.rep) < BAL.gateRank ? _t('Арка в Центр во Дворе откроется со званием «{r}» · {a} / {b} ★. Уважение дают батлы и задания дня.', { r: BAL.ranks[BAL.gateRank], a: S.rep, b: BAL.rep[BAL.gateRank] })
        : _t('Пройди через арку «Центр» у дальней стены Двора.');
    }
    if (ahead && D === 'center') {
      return S.wins.chrome || S.seen.park ? _t('Войди в Парк через арку в Центре или воспользуйся метро.') : _t('Чтобы открыть вход в Парк из Центра, победи «Хромированных».');
    }
    if (ahead && D === 'park') {
      return S.wins.wave || S.seen.prom ? _t('Пройди через арку «Промзона» в Парке.') : _t('Чтобы открыть вход в Промзону из Парка, победи «Волну».');
    }
    if (D === 'club') return _t('Выйди из Клуба в Промзону.');
    if (D === 'prom') return _t('Вернись через арку из Промзоны в Парк.');
    if (D === 'park') return _t('Вернись через арку из Парка в Центр.');
    return _t('Вернись во Двор через арку в Центре или на метро.');
  }
  function openStory() {
    if (B || A || P || choosing || festival.busy()) return;
    guide.choose('story', S.story.length > 0);
    const chapter = storyChapter();
    openModeInfo(storyJournal(_t, S.story, chapter ? storyHint(chapter) : '', BAL.enCap), false);
    const panel = $('#g3info').firstElementChild;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'g3storyTitle');
    panel.scrollTop = 0;
    $('#g3storyTitle').focus({ preventScroll: true });
  }
  function storyResult(id) {
    const result = advanceStory(S, id, BAL.enCap);
    if (!result) return '';
    const next = storyChapter();
    const reward = _t('+{r} ★ и +{e} ⚡ за сюжет', { r: result.rep, e: result.en });
    return next ? _t('Сюжет · {reward} · дальше «{next}»', { reward, next: _t(next.title) }) : _t('Общий сайфер состоялся · {reward}', { reward });
  }
  // moving between districts: the save remembers where I am, the page builds that district
  let traveling = false;
  function travel(to, forFestival = false) {
    if (traveling) return;
    traveling = true;
    if (!forFestival) S.where = to; save(); try { sessionStorage.setItem('fedoskin-city3d-from', D); } catch (_) {}
    const f = document.createElement('div'); f.style.cssText = 'position:fixed;inset:0;background:#0B0D12;opacity:0;transition:opacity .35s;z-index:20'; document.body.appendChild(f); requestAnimationFrame(() => (f.style.opacity = 1));
    setTimeout(() => { const u = new URL(location.href); u.searchParams.delete('d'); u.searchParams.delete('festival');
      if (forFestival) { u.searchParams.set('d', to); u.searchParams.set('festival','1'); }
      location.replace(u.toString()); }, 400); }
  function metroMap() { const boss = S.wins.chrome || S.seen.park;
    info(`<h4>${_t('🚇 Метро — карта города')}</h4>
      <div class="row"><span>${_t('🏠 Двор')}</span><span>${_t('открыт')}</span></div><div class="row"><span>${_t('🏙 <b>Центр</b>')}</span><span>${_t('ты здесь')}</span></div>
      <div class="row"><span>${_t('🌳 Парк и набережная')}</span><span>${boss ? _t('открыт') : _t('🔒 победи «Хромированных»')}</span></div>
      <div class="row"><span>${_t('🏭 Промзона')}</span><span>${S.wins.wave || S.seen.prom ? _t('открыта — вход из Парка') : _t('🔒 победи «Волну» в Парке')}</span></div><div class="row"><span>${_t('🪩 Клуб')}</span><span>${S.wins.forge ? _t('открыт') : _t('🔒 победи «Литейку» в Промзоне')}</span></div>
      <p style="margin-top:10px">${_t('Новые районы открываются, когда побеждаешь хозяев предыдущего. Диджей, тренировочный мат и сайфер ждут во дворе — их бонусы действуют весь день и здесь.')}</p>
      ${boss ? `<button id="g3gp">${_t('🌳 Поехать в Парк')}</button>` : ''}<button id="g3go" class="sec">${_t('🏠 Поехать во двор')}</button>`); $('#g3go').onclick = () => travel('yard'); if ($('#g3gp')) $('#g3gp').onclick = () => travel('park'); }
  // what each place offers right now (button text) and what it does
  function placeBtn(pl) {
    const t = today();
    if (pl.id === 'festival') return { h: _t('Открыть встречу фестиваля'), s: _t('Сюжетная встреча · бесплатно') };
    if (pl.id === 'show') return S.showDay === t ? { off: true, h: _t('🔥 Ты уже выходил в круг сегодня'), s: _t('Завтра снова — а пока батлы с бандами') } : { h: _t('🔥 Выйти в круг сайфера'), s: _t('Бесплатно раз в день · до +{n} ★', { n: BAL.repShow + BAL.repShowClean }) };
    if (pl.id === 'storyFinale') return { off: storyChapter()?.id !== 'finale', h: _t('Открыть общий сайфер'), s: _t('Финал сюжета · бесплатно') };
    if (pl.id === 'dj') return { h: _t('Пульт диджея'), s: _t('Скретч-тренировка и заказ бита') };
    if (pl.id === 'mat') return { h: _t('Тренировочный коврик'), s: _t('Траектории пауэрмувов · тренировка формы') };
    if (pl.id === 'powerContest') return { h: _t('Пауэрмув-контест'), s: _t('Три раунда против Вихря') };
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
    if (pl.id === 'club') return S.wins.forge ? { h: _t('🪩 Войти в Клуб'), s: _t('7 to Smoke · танцпол и пульт диджея') } : { off: true, h: _t('🔒 Клуб — победи «Литейку»'), s: _t('Хозяева Промзоны · ур. 8 · главарь Коготь') };
    if (pl.id === 'backProm') return { h: _t('Выход в Промзону'), s: '' };
    if (pl.id === 'smoke') return { h: '7 TO SMOKE', s: _t('8 танцоров · первый до 7 очков') };
    if (pl.id === 'clubDJ') return { h: _t('Пульт диджея'), s: _t('Скретч-тренировка и пластинки Клуба') };
    if (pl.id === 'clubRecords') return { h: _t('Стена результатов'), s: _t('Твои результаты в 7 to Smoke') };
    if (pl.id === 'stash') return S.stash.got.includes(pl.i) ? { off: true, h: _t('📦 Тайник уже пуст'), s: '' } : { h: _t('📦 Вскрыть тайник'), s: _t('Сегодня найдено {n} из {m} · внутри ⚡ или ★', { n: S.stash.got.length, m: BAL.stashN }) };
    if (pl.id === 'ring') { const n = S.ringDay.day === t ? S.ringDay.n : 0, next = BAL.ringRep + Math.min(S.streak, BAL.streakMax) * BAL.streakRep;
      return n >= BAL.ringMax ? { off: true, h: _t('🥊 Ринг закрыт до завтра'), s: _t('Серия побед: {n} · она не сгорает за ночь', { n: S.streak }) }
        : { h: _t('🥊 Подпольный ринг · −{n} ⚡', { n: energyCost(BAL.ring) }), s: _t('Серия побед: {n} · победа даст +{r} ★ · проиграл — серия с нуля', { n: S.streak, r: next }), low: S.en < energyCost(BAL.ring) }; }
    if (pl.id === 'bars') return S.warmDay === t ? { off: true, h: _t('🤸 Ты размят до конца дня'), s: _t('Срывов в батлах меньше на {n}%', { n: Math.round(BAL.warm * 100) }) } : { h: _t('🤸 Размяться на площадке'), s: _t('Бесплатно раз в день: −{n}% срывов сегодня', { n: Math.round(BAL.warm * 100) }) };
    if (pl.id === 'og') { const m = lesMin(); return S.ogDay === t ? { off: true, h: _t('🧓 Маятник: «На сегодня всё. Завтра приходи»'), s: _t('Старый би-бой проверяет тебя раз в день') }
      : m < BAL.ogMin ? { go: true, h: _t('🧓 Маятник: «Сначала поучись»'), s: _t('{n} мин уроков сегодня (сейчас {m}) → +{r} ★ и +{e} ⚡', { n: BAL.ogMin, m, r: BAL.ogRep, e: BAL.ogEn }) }
      : { h: _t('🧓 Показать Маятнику, чему научился'), s: _t('Ты учился сегодня {m} мин: +{r} ★ и +{e} ⚡', { m, r: BAL.ogRep, e: BAL.ogEn }) }; }
    if (pl.id === 'jam') return S.jamDay === t ? { off: true, h: _t('🏆 Джем на сегодня сыгран'), s: _t('Завтра эстрада ждёт снова') } : { h: _t('🏆 Джем на эстраде · −{n} ⚡', { n: energyCost(BAL.jam) }), s: _t('Три соперника подряд: ур. {l} · до +{r} ★', { l: BAL.jamLv.join(', '), r: BAL.jamRep.reduce((a, b) => a + b, 0) + BAL.jamChamp }), low: S.en < energyCost(BAL.jam) };
    if (pl.id === 'mall') { const n = S.mallDay.day === t ? S.mallDay.n : 0; return n >= BAL.mallMax ? { off: true, h: _t('🕺 Толпа устала — приходи завтра'), s: _t('Шоу у ТЦ: {n} раза в день', { n: BAL.mallMax }) } : { h: _t('🕺 Шоу у ТЦ · −{n} ⚡', { n: energyCost(BAL.mall) }), s: _t('Начинай, когда охранник далеко: красный круг — его зона'), low: S.en < energyCost(BAL.mall) }; }
  }
  function placeRun(pl) {
    if (pl.id === 'festival') { openFestival(true); return; }
    const b = placeBtn(pl); if (b.off) { toast(b.h); return; } if (b.low || b.go) { location.href = './'; return; }
    if (pl.id === 'club') { travel('club'); return; }
    if (pl.id === 'backProm') { travel('prom'); return; }
    if (pl.id === 'smoke') { openSmoke(); return; }
    if (pl.id === 'clubDJ') { openClubDJ(); return; }
    if (pl.id === 'clubRecords') { openClubRecords(); return; }
    if (pl.id === 'dj') { openYardDJ(); return; }
    if (pl.id === 'mat') openPractice();
    if (pl.id === 'powerContest') openContest();
    if (pl.id === 'atelier') startAtelier();
    if (pl.id === 'show') startShow();
    if (pl.id === 'storyFinale') startShow(true);
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
    if (pl.id === 'jam') confirmBattle(BAL.jam, () => !placeBtn(pl).off, startJam);
    if (pl.id === 'prom') travel('prom');
    if (pl.id === 'zpark') travel('park');
    if (pl.id === 'ring') confirmBattle(BAL.ring, () => !placeBtn(pl).off, startRing);
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
    S.en -= energyCost(BAL.ring); if (S.ringDay.day !== today()) S.ringDay = { day: today(), n: 0 }; S.ringDay.n++; save(); paintHud(); J.busy = true; PZ.crowd(true);
    startBattle({ c: { id: 'ring', tour: true, ringB: true, name: d.name, lv, col: d.col, gear: [] }, people: [J], x: PZ.ring.x, z: PZ.ring.z, ambientEnabled: true, ring: { visible: true } }); }
  function ringResult(win) { const lines = [], rk0 = rankOf(S.rep);
    if (win) { const rep = BAL.ringRep + Math.min(S.streak, BAL.streakMax) * BAL.streakRep; S.streak++; S.best = Math.max(S.best, S.streak); S.gearProgress.ringWins++; S.rep += rep; bumpGoal('ring'); bumpGoal('win'); if (B.clean) bumpGoal('clean'); bumpGoal('strong');
      lines.push(`<span class="rw">${_t('+{n} ★ уважения', { n: rep })}</span>`, _t('🔥 Серия побед на ринге: <b>{n}</b>', { n: S.streak }) + (S.streak > 1 ? _t(' — каждая следующая стоит дороже') : '')); }
    else { lines.push(S.streak ? _t('Серия из {n} побед оборвалась. Начинай новую.', { n: S.streak }) : _t('Ринг не прощает срывов. Уроки поднимают уровень героя — он реже падает и крутит сложнее.')); S.streak = 0; }
    const story = win && storyResult('ring');
    if (story) lines.push(`<span class="rw">${story}</span>`);
    const rk = rankOf(S.rep); if (rk > rk0) lines.push(`<span class="rw">${_t('🏅 Новое звание: {r}', { r: BAL.ranks[rk] })}</span>`);
    return lines; }
  // THE JAM on the Park's stage: three battles in a row against the stage's dancers (one round each); a lost battle ends it,
  // what was earned stays. Runs on the same battle engine as the crews — the «crew» is one dancer with the flag tour.
  let JM = null;
  function startJam() { S.en -= energyCost(BAL.jam); S.jamDay = today(); save(); paintHud(); JM = { i: 0, rep: 0, over: false, clean: true }; PK.crowd(true); jamRound(); }
  function jamRound() { const J = PK.dancers[JM.i], d = JAM[JM.i]; J.busy = true;
    startBattle({ c: { id: 'jam' + JM.i, tour: true, name: d.name, lv: BAL.jamLv[JM.i], col: d.col, gear: [] }, people: [J], x: PK.stage.x, z: PK.stage.z + .2, ambientEnabled: true, ring: { visible: true } }); }
  function jamResult(win) { const lines = [], i = JM.i, rk0 = rankOf(S.rep);
    if (win) { const rep = BAL.jamRep[i] + (i === 2 ? BAL.jamChamp : 0); S.rep += rep; JM.rep += rep; JM.i++; JM.clean &&= B.clean; bumpGoal('jam'); bumpGoal('win'); if (B.clean) bumpGoal('clean');
      lines.push(`<span class="rw">${_t('+{n} ★ уважения', { n: rep })}</span> · ${_t('раунд {i} из 3', { i: i + 1 })}`);
      if (JM.i >= 3) { JM.over = true; S.jamWon = (S.jamWon || 0) + 1;
        if (JM.clean) S.gearProgress.jamClean = (S.gearProgress.jamClean || 0) + 1;
        lines.unshift(`<span class="rw">${_t('🏆 Ты выиграл джем на эстраде! Всего +{n} ★', { n: JM.rep })}</span>`); }
      else lines.push(_t('Дальше — <b>{x}</b>, ур. {l}. Энергия уже оплачена', { x: JAM[JM.i].name, l: BAL.jamLv[JM.i] })); }
    else { JM.over = true; lines.push(i ? _t('Джем окончен на {i}-м раунде. За сегодня +{n} ★', { i: i + 1, n: JM.rep }) : _t('Вылет в первом раунде. Уроки поднимают уровень героя — он реже падает и крутит сложнее.')); }
    const story = win && storyResult('jam');
    if (story) lines.push(`<span class="rw">${story}</span>`);
    const rk = rankOf(S.rep); if (rk > rk0) lines.push(`<span class="rw">${_t('🏅 Новое звание: {r}', { r: BAL.ranks[rk] })}</span>`);
    return lines; }
  function openModeInfo(html, appendBack = true) {
    choosing = true; W.lock = true; paintAct();
    info(html + (appendBack ? `<button type="button" class="sec" id="g3choiceBack">${_t('Назад')}</button>` : ''));
    $('#g3choiceBack').onclick = closeChoice;
  }
  function openSmoke() {
    openModeInfo(`<h4>7 TO SMOKE</h4>
      <p>${_t('Восемь танцоров, дуэли 1 на 1. Судьи дают победителю очко. Он остаётся в кругу, проигравший встаёт в конец очереди.')}</p>
      <p>${_t('Первый до 7 побеждает. Лимит {n} мин. После последней дуэли выигрывает лидер, при равенстве лидеры танцуют тай-брейк.', { n: SMOKE_TIME / 60 })}</p>
      <p>${_t('Начни пауэрмув с жёлтой точки. На фризе держи палец на панели и веди точку за зелёной зоной.')}</p>
      <button type="button" id="g3enterSmoke">${_t('Выйти в круг')}</button>`);
    $('#g3enterSmoke').onclick = () => {
      closeChoice();
      A = { kind: 'smoke' };
      paintAct();
      smoke.start(CLUB_TRACKS[S.clubTrack]);
    };
  }
  function openClubDJ() {
    const records = [_t('Медный брейк'), _t('Ночной грув')];
    openModeInfo(`<h4>${_t('Пульт диджея')}</h4><button type="button" id="g3djScratch">${_t('Скретч с диджеем')}</button><p>${_t('Выбери пластинку для Клуба')}</p>
      ${CLUB_TRACKS.map((track, i) => `<button type="button" data-club-track="${i}" class="${S.clubTrack === i ? '' : 'sec'}" aria-pressed="${S.clubTrack === i}">${records[i]} · ${battleBpm(track)} BPM</button>`).join('')}`);
    $('#g3djScratch').onclick = () => startScratch(club.mix, openClubDJ);
    const buttons = [...document.querySelectorAll('[data-club-track]')];
    buttons.forEach((button, i) => {
      button.onclick = () => {
        S.clubTrack = i; save();
        ctx.backgroundMusic?.(CLUB_TRACKS[i]);
        club.mix.cue();
        buttons.forEach((b, index) => {
          b.classList.toggle('sec', index !== i);
          b.setAttribute('aria-pressed', String(index === i));
        });
      };
    });
  }
  function openYardDJ() {
    const hasBeat = S.djDay === today(), cost = energyCost(BAL.dj);
    openModeInfo(`<h4>${_t('Пульт диджея')}</h4><button type="button" id="g3djScratch">${_t('Скретч с диджеем')}</button>
      ${hasBeat ? `<p>${_t('🎧 Бит качает до конца дня')}</p>` : `<button type="button" class="sec" id="g3djBeat">${_t('🎧 Заказать бит · −{n} ⚡', { n: cost })}</button><p>${_t('На весь день: меньше срывов, больше стиля')}</p>`}`);
    $('#g3djScratch').onclick = () => startScratch(djMix, openYardDJ);
    const order = $('#g3djBeat');
    if (order) order.onclick = () => {
      if (S.djDay === today()) return;
      if (S.en < cost) { location.href = './'; return; }
      S.en -= cost; S.djDay = today();
      const rewards = collectGear('dj');
      save(); paintHud(); bumpGoal('dj'); sfx('win'); djMix.cue();
      closeChoice();
      toast(_t('🎧 Диджей поставил твой бит! Сегодня в батлах меньше срывов и больше стиля'), rewards);
    };
  }
  let scratchStyle;
  function loadScratchStyle() {
    if (scratchStyle) return scratchStyle;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('./city3d-scratch.css?v=1', import.meta.url).href;
    scratchStyle = new Promise((resolve, reject) => {
      link.onload = resolve;
      link.onerror = () => { scratchStyle = null; link.remove(); reject(); };
      document.head.append(link);
    });
    return scratchStyle;
  }
  async function startScratch(mix, retry) {
    const request = {};
    choosing = request;
    const button = $('#g3djScratch');
    button.disabled = true;
    button.textContent = _t('Открываем вертушки…');
    try {
      const [{ openScratch, loadScratchArt }] = await Promise.all([import('./city3d-scratch.js?v=1'), loadScratchStyle()]);
      await loadScratchArt();
      if (choosing !== request) return;
      closeChoice();
      A = { kind: 'scratch' };
      W.lock = true;
      window.cityMusic?.pause(true);
      openScratch({ t: _t, best: S.scratchBest, onMotion: mix.scratch,
        onBest(i, score) { S.scratchBest[i] = score; save(); },
        onClose() { window.cityMusic?.pause(false); endAct(); },
      });
    } catch (_) {
      if (choosing !== request && A?.kind !== 'scratch') return;
      if (A?.kind === 'scratch') { window.cityMusic?.pause(false); endAct(); }
      retry();
      toast(_t('Вертушки не загрузились. Попробуй ещё раз.'));
    }
  }
  function openClubRecords() {
    const { best, wins, played } = S.smoke;
    openModeInfo(`<h4>${_t('Стена результатов')}</h4><div class="row"><span>7 TO SMOKE</span><span>${_t('Личный рекорд · {n}/7', { n: best })}</span></div>
      <div class="row"><span>${_t('Побед: {n}', { n: wins })}</span><span>${_t('Турниров: {n}', { n: played })}</span></div>`);
  }
  function recordSmoke(points, won) {
    const record = S.smoke;
    record.played++;
    record.best = Math.max(points, record.best);
    const reward = won && record.day !== today() ? 30 : 0;
    if (won) { record.wins++; record.day = today(); }
    S.rep += reward;
    save();
    return reward;
  }
  function smokeBattle(opponent, track, holder) {
    startBattle({ c: { id: opponent.id, name: opponent.name, col: opponent.col, lv: opponent.lv }, smoke: { track, holder },
      people: [opponent.J], x: club.floor.x, z: club.floor.z, ambientEnabled: true, ring: { visible: true } });
  }
  function smokePreview(opponent, track, heard) {
    const r = rng(Math.floor(Math.random() * 0x100000000));
    const profile = battleStyle(opponent.id), memory = turnMemory(opponent.J, 'op');
    const { pre, post } = dancerPlan(opponent.J, 'op', profile, r, false);
    const bpm = battleBpm(track);
    const show = clubExhibition({ memory, profile, duration: clipLen, bpm, r, heard: heard?.motif, avoid: heard?.form });
    const standing = show.standing || show.steps.at(-1).c.startsWith(RISE_FROM_FREEZE);
    return { pre, post: standing ? post : null, bpm, ...show };
  }
  function clearSmokeBattle() {
    if (!B?.g.smoke) return;
    PM.cancel(); FZ.cancel(); wheel.close(); mythCut(null, null, 0);
    for (const J of [W.hero, B.opp]) {
      if (J.fall) fallEnd(J);
      J.ws = null;
    }
    $('#g3bt').classList.remove('on');
    $('#g3mv').textContent = '';
    B = null;
  }
  function openPractice() {
    const n = S.form.day === today() ? S.form.n : 0, cost = energyCost(BAL.train);
    openModeInfo(`<h4>${_t('Тренировочный коврик')}</h4>
      <p>${_t('Выбери пауэрмув и обведи траекторию. Начни с жёлтой точки. Можно повторять бесплатно.')}</p>
      <button type="button" id="g3tracePractice">${_t('Тренировать траектории')}</button>
      <button type="button" class="sec" id="g3formPractice" ${n >= BAL.trainMax ? 'disabled' : ''}>
        ${n >= BAL.trainMax ? _t('💪 Форма на максимуме сегодня') : _t('💪 Тренировать пауэр · −{n} ⚡', { n: cost })}</button>
      <p>${_t('Форма {n} / {m} — каждая: −3% срывов сегодня', { n, m: BAL.trainMax })}</p>`);
    $('#g3tracePractice').onclick = () => {
      closeChoice();
      A = { kind: 'powerPractice' };
      paintAct();
      powerModes.start(matAt, POWER.filter(p => PM.can(p.c)).map(move => ({ move, name: move.nm, locked: false })));
    };
    $('#g3formPractice').onclick = () => {
      closeChoice();
      if (S.en < cost) location.href = './';
      else if (S.form.day !== today() || S.form.n < BAL.trainMax) startTrain();
    };
  }
  let contestOpponent;
  function openContest() {
    const { options, fallback } = availablePower(false);
    openModeInfo(`<h4>${_t('Пауэрмув-контест')}</h4>
      <p>${_t('Три раунда против Вихря. В каждом ты выбираешь пауэрмув, и вы оба крутите его. Побеждает сумма очков за точность и обороты.')}</p>
      <p>${_t('Твой рекорд: {n} очк.', { n: S.powerContest.best })} · ${_t('Побед: {n}', { n: S.powerContest.wins })}</p>
      ${fallback ? `<button type="button" id="g3startContest">${_t('Начать контест')}</button>`
        : `<p>${_t('Открой SWIPES или другой пауэрмув на уроках, чтобы участвовать.')}</p>
          <button type="button" id="g3contestLessons">${_t('🎬 К урокам')}</button>`}`);
    if (!fallback) { $('#g3contestLessons').onclick = () => { location.href = './'; }; return; }
    $('#g3startContest').onclick = () => {
      closeChoice();
      if (!contestOpponent) {
        contestOpponent = mocapPerson(HERO.topDown(4, ['c:acidBucket']), { body: bodyOf(4, { type: 'athl' }) });
        scene.add(contestOpponent.root);
      }
      A = { kind: 'powerContest' };
      paintAct();
      powerModes.start(Y.arena, options, contestOpponent);
    };
  }
  function recordContest(points, won) {
    const result = S.powerContest;
    result.best = Math.max(result.best, points);
    if (won) result.wins++;
    save();
    return result.best;
  }
  // practice: the hero runs one power move on the mat; the form point is given whatever happens
  function startTrain() {
    S.en -= energyCost(BAL.train); if (S.form.day !== today()) S.form = { day: today(), n: 0 }; S.form.n++; save(); paintHud();
    const H = W.hero, lv = ctx.heroLevel(), pw = POWER.filter(p => p.lv <= lv), P = pw[pw.length - 1], fail = Math.random() < .3;
    A = { kind: 'train', t: 0, from: { x: H.root.position.x, z: H.root.position.z }, to: matAt, P, fail, said: false };
    W.lock = true; W.camT = { x: matAt.x, z: matAt.z + .3, zoom: .45 }; document.body.classList.add('g3fight'); paintAct();
    H.play('Breakdance_Uprock_To_Ground', { fade: .3 });
  }
  function buildFinaleGuests() {
    const stencil = crewLook(CREWS.find(c => c.id === 'stencil'), 0, 0);
    const looks = [
      { name: 'Трафареты', look: stencil.lk, body: stencil.body, angle: 2.53, clip: 'Breakdance_Uprock_Var_1' },
      { name: 'Шуруп', look: HERO.topDown(5, []), body: bodyOf(1337, { type: 'slim', style: 'mohawk', dye: '#7CFF4F' }), angle: 1.57, clip: 'Breakdance_Footwork_2' },
      { name: 'Клёпка', look: HERO.topDown(8, ['girl']), body: bodyOf(1838, { type: 'slim', girl: true, style: 'tail', dye: '#ff5a4a' }), angle: .18, clip: 'Breakdance_Uprock_Var_2' },
    ];
    return looks.map(({ name, look, body, angle, clip }) => {
      const dancer = mocapPerson(look, { body });
      const home = { x: C0.x + Math.cos(angle) * 2.6, z: C0.z + Math.sin(angle) * 2.6 };
      dancer.root.position.set(home.x, 0, home.z);
      face(dancer, C0.x, C0.z);
      dancer.play('Breakdance_Ready', { at: angle / 2 });
      dancer.root.visible = false;
      scene.add(dancer.root);
      return { name, dancer, home, clip };
    });
  }
  function finaleGuestTick(dt) {
    const guest = finaleGuests[A.guest];
    if (!guest) return false;
    const { dancer, home, clip, name } = guest;
    if (A.guestTime === 0) {
      W.walk.start(dancer);
      $('#g3turn').textContent = _t('Общий сайфер · {name}', { name: _t(name) });
    }
    A.guestTime += dt;
    const t = A.guestTime, intro = 1, outro = 1.1, danceEnd = intro + Math.min(2.6, clipLen(clip));
    const facing = Math.atan2(C0.x - home.x, C0.z - home.z);
    if (t < intro) W.walk.move(dancer, dt, C0.x, C0.z, ease(t / intro), facing);
    else if (t < danceEnd) {
      if (dancer.ws) {
        W.walk.move(dancer, dt, C0.x, C0.z, 1, facing);
        dancer.ws = null;
        dancer.play(clip, { fade: .2 });
      }
    } else {
      if (!dancer.ws) W.walk.start(dancer);
      W.walk.move(dancer, dt, home.x, home.z, ease(Math.min(1, (t - danceEnd) / outro)), facing);
    }
    finaleGuests.forEach(({ dancer: person }) => person.tick(dt));
    if (dancer.ws) W.walk.pose(dancer, dt);
    if (t >= danceEnd + outro) {
      dancer.ws = null;
      dancer.play('Breakdance_Ready', { fade: .3 });
      A.guest++;
      A.guestTime = 0;
      if (A.guest === finaleGuests.length) {
        A.t0 = performance.now() / 1000;
        W.walk.start(W.hero);
        $('#g3turn').textContent = _t('Общий сайфер · твой выход');
      }
    }
    return true;
  }
  // The regular and story performances share the same solo choreography.
  function startShow(story = false) {
    const H = W.hero, r = rng(Date.now() >>> 0), { x, z } = H.root.position;
    const T = makeTurn(H, ctx.heroLevel(), r, 'me', buff(), null, Math.hypot(C0.x - x, C0.z - z), false, activeBpm());
    alignEntry(T);
    A = { kind: 'show', story, T, c: C0, t0: performance.now() / 1000, from: { x, z }, guest: 0, guestTime: 0 };
    if (story) {
      H.play('Breakdance_Ready', { fade: .3 });
      djMix.cue();
      for (const { dancer } of finaleGuests) {
        dancer.root.visible = true;
        dancer.play('Breakdance_Ready', { fade: .3 });
      }
    } else {
      W.walk.start(H);
      S.showDay = today();
      save();
    }
    W.lock = true; W.cyBusy = true; W.camT = { x: C0.x, z: C0.z + .3, zoom: story ? .53 : .42 }; document.body.classList.add('g3fight');
    $('#g3bt').classList.add('on'); $('#g3sc').style.display = 'none'; $('#g3skip').style.display = 'none'; $('#g3turn').textContent = _t(story ? 'Общий сайфер' : 'Твой выход в сайфере'); paintAct();
  }
  // a street show on the mall's tiles: my random set, passers-by come to watch — and the guard walks his round.
  // If he gets close while I dance (his red ring reaches me), the show is over and almost nothing is earned.
  function startMall() {
    const H = W.hero, r = rng(Date.now() >>> 0), bf = buff(), { x, z } = H.root.position;
    const T = makeTurn(H, ctx.heroLevel(), r, 'me', { ...bf, fall: bf.fall + BAL.mallFloor }, null, Math.hypot(CN.show.x - x, CN.show.z - z), false, activeBpm());
    alignEntry(T);
    S.en -= energyCost(BAL.mall); if (S.mallDay.day !== today()) S.mallDay = { day: today(), n: 0 }; S.mallDay.n++; save(); paintHud();
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
    const rk = rankOf(S.rep), rows = CUS.map(c => { const n = S.cus[c.id] || 0, max = n >= 3, cost = energyCost(BAL.cusCost[n]), need = BAL.cusRank[n], lock = !max && rk < need;
      const btn = max ? `<button disabled>${_t('✓ Всё')}</button>` : lock ? `<button disabled>${_t('🔒 «{r}»', { r: BAL.ranks[need] })}</button>` : `<button data-cu="${c.id}"${S.en < cost ? ' class="sec"' : ''}>${_t('Пришить · {n} ⚡', { n: cost })}</button>`;
      const fx = max ? cusFx(c, c.v(3)) : n ? cusFx(c, c.v(n) + ' → ' + c.v(n + 1)) : _t('Даст {x}', { x: cusFx(c, c.v(1)) });
      return `<div class="cu${max ? ' max' : ''}"><i>${c.ico}</i><div><b>${c.nm}</b><span class="dots">${'●'.repeat(n)}${'○'.repeat(3 - n)}</span>
        <small class="n">${max ? _t('Готово: {x}', { x: c.lv[2] }) : '→ ' + c.lv[n]}</small><small>${fx}</small></div>${btn}</div>`; }).join('');
    info(`<h4>${_t('🧵 Ателье «Игла»')}</h4><p>${_t('Доработки видны на герое и <b>навсегда</b> усиливают тебя в батлах города. Платишь энергией — она из уроков.')}</p>${rows}
      <p style="margin-top:8px">${_t('У тебя <b>{n} ⚡</b> · 2-й уровень — со звания «{a}», 3-й — «{b}»', { n: unlimitedEnergy ? '∞' : S.en, a: BAL.ranks[BAL.cusRank[1]], b: BAL.ranks[BAL.cusRank[2]] })}</p>
      <button class="sec" id="g3cuL">${_t('🎬 К урокам — +{n} ⚡ за минуту', { n: BAL.perMin })}</button>`);
    $('#g3info').classList.add('cum');
    document.querySelectorAll('#g3info [data-cu]').forEach(b => { b.onclick = () => sew(b.dataset.cu); });
    $('#g3cuL').onclick = () => { location.href = './'; };
  }
  function sew(id) {
    const c = CUS.find(x => x.id === id), n = S.cus[id] || 0; if (!c || n >= 3) return;
    if (rankOf(S.rep) < BAL.cusRank[n]) { toast(_t('🔒 Игла шьёт это только для звания «{r}»', { r: BAL.ranks[BAL.cusRank[n]] })); return; }
    const cost = energyCost(BAL.cusCost[n]);
    if (S.en < cost) { toast(_t('⚡ Не хватает энергии: нужно {n}, у тебя {a}. Минута урока = +{m} ⚡', { n: cost, a: S.en, m: BAL.perMin })); return; }
    S.en -= cost; S.cus[id] = n + 1; save(); paintHud(); ctx.rewear && ctx.rewear(); sfx('win');
    if (atP) { atP.play('Bboy_Uprock', { fade: .3 }); setTimeout(() => atP.play('Breakdance_Ready', { fade: .5 }), 2600); }
    if (A && A.kind === 'atelier') { A.spin = id === 'top' && n + 1 === 3 ? Math.PI : id === 'kicks' || id === 'pants' ? .6 : 0; A.ty = 0; }
    toast(_t('🧵 Игла пришила: {x}', { x: c.lv[n] + ' · ' + cusFx(c, c.v(n + 1)) })); sheetAtelier();
  }
  function actTick(dt) {
    const H = W.hero;
    if (A.kind === 'powerPractice' || A.kind === 'powerContest') { powerModes.tick(dt); return; }
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
      if (A.story && finaleGuestTick(dt)) { H.tick(dt); return; }
      if (A.story) finaleGuests.forEach(({ dancer }) => dancer.tick(dt));
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
      if (si >= 0) spinTick(H, T.seq, t);
      if (s && (s.kind === 'power' || s.kind === 'freeze') && !s.done && (t - s.a) / s.len >= (s.fail ? s.failAt : .7)) { s.done = true;
        if (s.fail) { fallStart(H); sfx('crash'); mvText(s, ['bad', _t('Срыв!')]); A.clean = false; } else { sfx('hit'); mvText(s, ['ok', _t('Чисто!')]); } }
      if (H.fall) fallTick(H, dt, s && s.soft); if (s && s.kind !== 'fall' && H.fall && H.fall.up) fallEnd(H);
      if (si < 0 && !A.back) { A.back = true; if (H.fall) fallEnd(H); W.walk.start(H); $('#g3mv').innerHTML = ''; }
      if (t >= T.len && A.mall) {
        const clean = A.clean !== false, rep = BAL.repMall + (clean ? BAL.repMallClean : 0);
        S.rep += rep;
        const rewards = clean ? collectGear('mallClean') : [];
        bumpGoal('mall');
        const story = storyResult('mall');
        save(); CN.crowd(false);
        if (story) rewards.push(story);
        sfx('win'); toast(_t('🕺 Толпа в восторге! +{n} ★{c} — и охранник не успел', { n: rep, c: clean ? _t(' (чисто)') : '' }), rewards); $('#g3bt').classList.remove('on'); $('#g3sc').style.display = ''; endAct(); }
      else if (t >= T.len && A.story) {
        const story = storyResult('finale');
        save();
        finaleGuests.forEach(({ dancer }) => { dancer.root.visible = false; });
        $('#g3bt').classList.remove('on'); $('#g3sc').style.display = '';
        W.cyBusy = false;
        endAct();
        if (story) { sfx('win'); toast(story); openStory(); }
      }
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
  const setShown = g => { const v = shown(g); g.people.forEach(J => J.root.visible = v); g.ring.visible = v; g.ambientEnabled = v; };
  crews.forEach(setShown);

  // ---------- proximity button ----------
  let near = null; const act = $('#g3act');
  act.onclick = () => {
    if (!near || B || P || A || choosing || festival.busy()) return;
    if (near.paint) { startPaint(near.g); return; }
    if (near.place) { placeRun(near.place); return; }
    if (S.en < energyCost(BAL.battle)) { location.href = './'; return; }
    const crew = near;
    confirmBattle(BAL.battle, () => shown(crew), () => startBattle(crew));
  };
  function paintAct() {
    if (!near || B || P || A || choosing || festival.busy()) { act.classList.remove('on'); return; }
    if (near.place) { const b = placeBtn(near.place); act.className = 'on' + (b.off || b.low ? ' low' : ''); act.innerHTML = (b.low ? _t('🎬 Мало энергии — посмотри урок') : b.h) + `<small>${b.low ? _t('1 минута урока = +{n} ⚡', { n: BAL.perMin }) : b.s}</small>`; return; }
    if (near.paint) { const low = S.en < energyCost(BAL.paint); act.className = 'on' + (low ? ' low' : '');
      act.innerHTML = _t('🎨 Закрасить стену «{x}» · −{n} ⚡', { x: near.g.c.name, n: energyCost(BAL.paint) }) + `<small>${low ? _t('Мало энергии — посмотри урок') : _t('Твой кусок +{n} ★ каждый день', { n: BAL.turfRep })}</small>`; return; }
    const low = S.en < energyCost(BAL.battle), lv = ctx.heroLevel(), c = near.c;
    act.className = 'on' + (low ? ' low' : '');
    act.innerHTML = low ? `${_t('🎬 Мало энергии — посмотри урок')}<small>${_t('1 минута урока = +{n} ⚡', { n: BAL.perMin })}</small>`
      : `${_t('⚔️ Батл с «{x}»{b} · −{n} ⚡', { x: c.name, b: c.boss ? ' 👑' : '', n: energyCost(BAL.battle) })}<small>${lv > c.lv ? _t('Ты сильнее — шансы хорошие') : lv === c.lv ? _t('Равные силы') : _t('Они сильнее — будет трудно')}</small>`;
  }

  // ---------- the battle ----------
  let B = null, clubBattleDancer = null;
  const lessons = BattleStudy.catalog(window.LESSONS_DATA);
  function availablePower(footwork = true) {
    const read = key => { try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (_) { return {}; } };
    const stats = read('fedoskin-stats'), coverage = read('fedoskin-ulcov'), lv = ctx.heroLevel();
    const progress = l => ({ views: BattleStudy.views(l, stats), full: BattleStudy.full(l, BattleStudy.coverageFraction(l, BattleStudy.bits(l, coverage))) });
    const state = BattleStudy.state(lessons, lv, BattleStudy.legacy(HERO.levelFor((stats.sec || 0) / 60)), progress);
    const mode = BattleStudy.starterMode();
    const swipes = mode === 'new' || mode === 'open' ? BattleStudy.matching(lessons, 'swipe').map(progress) : [];
    if (!swipes.length || swipes.some(p => BattleStudy.studied(p.full, p.views))) state.allow.push('swipe');
    else {
      const best = swipes.sort((a, b) => b.views - a.views)[0];
      state.hint.swipe = { p: Math.floor(best.views * 10) / 10, full: best.full, lvOk: true };
    }
    const options = POWER.filter(move => footwork || PM.can(move.c)).map(move => {
      const lvNeed = BattleStudy.levels[move.id] || move.lv;
      const locked = move.id === 'swipe' || BattleStudy.levels[move.id]
        ? !state.allow.includes(move.id) : lv < lvNeed;
      const hint = state.hint[move.id], gates = [];
      if (lv < lvNeed && locked) gates.push(_t('ур. {n}', { n: lvNeed }));
      if (hint && !hint.st) {
        if (hint.sec) gates.push(_t('Уроки · {n}/{x}', { n: hint.n, x: hint.need }));
        else gates.push(hint.p === 3 && !hint.full ? _t('Нужен полный просмотр урока') : _t('Урок · {n}/3', { n: hint.p }));
      }
      return { move, locked, reason: gates.join(' · '), name: move.nm };
    });
    const unlocked = options.filter(o => !o.locked);
    if (footwork && !unlocked.length) {
      const starter = options[0];
      options[0] = { move: FOOT_OPTION, locked: false, name: _t('Футворк') };
      options.push(starter);
    }
    const fallback = unlocked.find(o => o.move.nm === W.forcePM)?.move || unlocked.at(-1)?.move || (footwork ? FOOT_OPTION : null);
    return { options, fallback };
  }
  function closeChoice() {
    choosing = null; FZ.teach(null); W.lock = false;
    const sheet = $('#g3info'), panel = sheet.firstElementChild;
    if (panel.hasAttribute('aria-labelledby')) {
      panel.removeAttribute('role');
      panel.removeAttribute('aria-modal');
      panel.removeAttribute('aria-labelledby');
      $('#g3story').focus({ preventScroll: true });
    }
    sheet.classList.remove('on'); paintAct();
  }
  function confirmBattle(baseCost, canStart, onStart) {
    if (B || P || A || choosing) return;
    const cost = energyCost(baseCost);
    choosing = onStart; W.lock = true; paintAct();
    info(`<h4>${_t('Батл')}</h4>
      ${S.freezeTip ? '' : FZ.guide()}
      <div id="g3choiceActions"><button type="button" class="sec" id="g3choiceBack">${_t('Назад')}</button>
      <button type="button" id="g3choiceGo">${cost ? _t('Начать батл · −{n} ⚡', { n: cost }) : _t('Начать батл')}</button></div>`);
    FZ.teach($('#g3ftip'));
    $('#g3choiceBack').onclick = closeChoice;
    $('#g3choiceGo').onclick = () => {
      if (choosing !== onStart) return;
      closeChoice();
      if (!canStart() || S.en < energyCost(baseCost)) return;
      S.freezeTip = true;
      onStart();
    };
  }
  const heroChoreo = {}, opponentChoreo = new WeakMap();
  function turnMemory(J, who) {
    if (who === 'me') return heroChoreo;
    if (!opponentChoreo.has(J)) opponentChoreo.set(J, {});
    return opponentChoreo.get(J);
  }
  function dancerPlan(J, who, profile, r, opening) {
    return duelPlan({ district: ctx.dist, profile, memory: turnMemory(J, who), r, duration: clipLen, opening, hero: who === 'me' });
  }
  const motifName = motif => _t({ switch:'смена опоры', arc:'дуга ноги', thread:'продевание с подъёмом' }[motif]);
  const callName = motif => _t({ switch:'Мотив · смена опоры', arc:'Мотив · дуга ноги', thread:'Мотив · продевание с подъёмом' }[motif]);
  const scoreNumber = new Intl.NumberFormat(window.CITY_LANG || 'ru', { maximumFractionDigits: 1 });
  const replyValue = scoreNumber.format(.5);
  function replyPrompt(T) {
    const { motif, moves, advanced } = T.reply.contract;
    const target = moves.find(move => move.motif === battleTechnique(motif, T.call, advanced));
    const copy = T.call ? 'Твой мотив · {motif}. Развей его: {answer}.'
      : 'Мотив соперника · {motif}. Контраст: {answer}.';
    const line = _t(copy, { motif: motifName(motif), answer: _t(target.name) });
    const needed = REPLY_PRECISION[ctx.dist] * 100;
    const tip = ctx.dist === 'club' && !T.call
      ? _t('Не повторяй прошлый ответ. Зелёная зона ≥ {n}% для +{points}.', { n: needed, points: replyValue })
      : needed ? _t('Зелёная зона ≥ {n}% для +{points}.', { n: needed, points: replyValue })
      : _t('Удержи фриз для +{points}.', { points: replyValue });
    return line + ' ' + tip;
  }
  function earnedReply(T, precision) {
    const { contract, eligible, played, previous } = T.reply;
    const pts = battleReplyPoints({ district: ctx.dist, call: contract?.shown && contract.motif, leads: T.call,
      answer: played, eligible, clean: T.clean, precision, previous, advanced: contract?.advanced });
    T.reply.earned = pts;
    T.score += pts;
    return pts;
  }
  const replyFeedback = T => _t(T.call ? 'Мотив доведён · +{n}' : 'Чистый контраст · +{n}', { n: replyValue });
  // today's buffs from the DJ and the practice mat (only for me)
  const buff = () => { const c = S.cus || {}, gear = HERO.gearBoost(ctx.heroEq());
    return { fall: (S.form.day === today() ? .03 * S.form.n : 0) + (S.djDay === today() ? .03 : 0) + (S.warmDay === today() ? BAL.warm : 0), style: (S.djDay === today() ? .4 : 0) + (S.form.day === today() ? .15 * S.form.n : 0) + (c.top || 0) * BAL.cusStyle,
      // custom (the tailor): sneakers → steps, knees → freezes, spin pad → power and headspins
      step: (c.kicks || 0) * BAL.cusStep, fz: (c.pants || 0) * BAL.cusFreeze, pw: (c.head || 0) * BAL.cusPower, spin: (c.head || 0) * BAL.cusSpin, spinTol: gear.spin, elbow: gear.elbow }; };
  // OUT = seconds after the set to WALK back to one's place and turn round (owner 16.11.2026 «уход с танцпола… просто шагами, не надо танцем»)
  const OUT = 2.3, OUTW = 1.7, PRE_SIGNAL = .45, POST_RISE = .52, POST_SIGNAL = .55;
  const RISE_FROM_FREEZE = 'Festival_StandThrough';
  const SMOKE_DANCE_ZOOM = .62;
  function alignEntry(T) {
    T.enter = beatEntry(T.enter, T.bpm, currentBeat());
    T.len = setTimes(T.seq, 0, T.enter) + OUT;
    if (T.pending) T.pending.at = T.seq.at(-1).b;
  }
  function makeTurn(J, lv, r, who, bf = { fall: 0, style: 0 }, gear = null, distance = 2.12, choosePower = false, bpm,
    profile, duel, contract, call, avoid) {
    const me = who === 'me';
    const memory = turnMemory(J, who);
    const reply = { contract, eligible: !me, played: null, previous: memory.lastClubReply };
    // The opponent can read the cue, choose a different technique or lose the freeze.
    const wanted = contract && battleTechnique(contract.motif, call, contract.advanced);
    let response;
    if (wanted && !me) {
      const alternatives = contract.moves.filter(move => move.motif !== wanted);
      response = r() < .72 ? contract.moves.find(move => move.motif === wanted)
        : alternatives[Math.floor(r() * alternatives.length)];
    }
    const precision = response ? clamp(.75 + lv * .019 + (r() - .5) * .21, .55, 1) : 0;
    const opening = breakingOpening({ memory, r, duration: clipLen, bpm, profile, distance, duel,
      call: call && contract?.motif, response, avoid, technical: !me && lv >= 5,
      force: me && SHAPES.includes(W.forceSet) ? W.forceSet : undefined, step: Math.round((bf.step || 0) * 100) / 100 });
    const { seq, shape, enter, bend } = opening;
    const step = (c, len, at = 0, options = {}) => ({ c, len, at, ...options });
    const push = (...args) => seq.push(step(...args));
    if (choosePower && gear?.move) {
      push(null, HERO.MOVES[gear.move].dur, 0, { nm: HERO.MYTHIC_MOVES[gear.move], pts: 6, kind: 'power', gear });
      gear = null;
    }
    function appendPower(selected) {
      const forced = me && W.forcePM && POWER.find(p => p.nm === W.forcePM);
      const P = selected || forced || pickPower(memory, r, lv, clipLen, profile);
      const need = selected ? BattleStudy.levels[P.id] || P.lv : P.lv;
      const failP = clamp(.13 + P.risk - .06 * (lv - need) - bf.fall - (bf.pw || 0) - (P.c === 'Head_Spinning' ? bf.spin || 0 : 0), .03, .32);
      const pFail = r() < failP && !gear && P !== FOOT_OPTION && !P.motif;
      if (P.pre && !gear?.move) push(P.pre, 1.6, 1.0, { kind: 'pre' });
      if (P.id === 'ninety' && !gear?.move) opening.rise();
      const reps = P.motif ? 1 : selected ? Math.max(1, Math.round(2.6 / clipLen(P.c)))
        : P.id === 'backspin' ? 1 : Math.max(1, Math.round((2.2 + r() * .8) / clipLen(P.c)));
      const failAt = P.id === 'backspin' ? 1 - (1.15 - r() * .17) / clipLen(P.c) : .45 + r() * .35;
      if (gear?.move) push(null, HERO.MOVES[gear.move].dur, 0, { nm: HERO.MYTHIC_MOVES[gear.move], pts: P.pts + 6, kind: 'power', gear });
      else push(side(P.c, (P.motif || P.id === 'backspin') && r() < .5), reps * clipLen(P.c), 0, {
        nm: P.motif ? _t(P.name) : P === FOOT_OPTION ? _t('Футворк') : P.nm,
        answer: P.motif, pts: gear?.assist && P !== FOOT_OPTION ? Math.round(P.pts * BAL.perfMul * 10) / 10 : P.pts,
        kind: 'power', sp: P.motif ? 1 : undefined, fade: P.motif ? .22 : P.fade, fail: pFail, failAt, lv: need, gear,
      });
      // both endings are made: the hero's power move may be DRAWN (city3d-power.js) — then the finger, not the dice, picks one
      const pwS = seq[seq.length - 1], ok = [], bad = [step(null, 2.2, 0, { kind: 'fall' })];
      const landing = P.motif === 'thread' && pwS.c && threadCatch(clipLen, bpm, pwS.c.endsWith('_M'));
      if (landing) ok.push(landing);
      if (P.post && !gear?.move) ok.push(step(P.post, 1.4, 0, { kind: 'post' }));
      opening.afterPower(ok);
      const F = pickHold(pFail && !me ? { ...memory } : memory, lv, r, clipLen);
      const fFail = r() < clamp(.14 - .03 * (lv - 1) - bf.fall - (bf.fz || 0) + (me ? F.risk || 0 : 0), .03, .2);
      const mirror = r() < .5;
      const armSupport = ['CHAIR FREEZE', 'BABY FREEZE', 'SHOULDER FREEZE'].includes(F.nm) ? bf.elbow || 0 : 0;
      const balance = selected ? {
        at: Math.min(.8, F.len * .5), direction: mirror ? -1 : 1,
        tolerance: Math.min(26, 20 - (F.risk ? 3 : 0) + Math.max(0, lv - 1) * .45 + (bf.fz || 0) * 40 + bf.fall * 12) + armSupport,
      } : null;
      ok.push(step(side(F.c, mirror), F.len, F.at, { nm: F.nm, pts: 2, kind: 'freeze', balance, fail: fFail, failAt: .55 }));
      if (fFail && !balance) ok.push(step(null, 1.6, 0, { kind: 'fall', soft: true }));
      seq.push(...(pFail ? bad : ok)); pwS.tails = { ok, bad };
    }
    if (!choosePower) appendPower(null);
    const T = { J, who, seq, shape, enter, bend, bpm, pre: duel?.pre, post: duel?.post, call,
      reply, precision, clean: true, len: setTimes(seq, 0, enter) + OUT, score: 0,
      style: Math.round((r() * .8 + .15 * lv + bf.style) * 10) / 10 };
    if (choosePower) {
      // The power suffix is built once the player picks. The entry and scored steps stay in place.
      const from = seq.length;
      T.pending = { at: seq.at(-1).b, resolve(move, manual = false) {
        if (!T.pending) return;
        const { at } = T.pending;
        T.pending = null;
        reply.eligible = manual;
        appendPower(move);
        T.len = setTimes(seq, from, at) + OUT;
      } };
    }
    return T;
  }
  function startBattle(g) {
    if (!g.smoke) {
      if (!g.c.tour) S.en -= energyCost(BAL.battle);
      S.fights++; save(); paintHud();
    }
    // every crew battles to its own beat (rhythm.js LOOPS, owner 17.11.2026); the jam and the ring have theirs
    const beatId = g.smoke?.track || (g.c.ringB ? 'ring' : g.c.tour ? 'jam' : g.c.id);
    const bpm = battleBpm(beatId);
    const profile = crewStyle(g.c.id) || (g.c.ringB ? 'power' : ['groove', 'ground', 'shapes'][JM?.i]);
    if (ctx.music) ctx.music(beatId);
    const H = W.hero, lv = ctx.heroLevel(), c = g.c, r = rng((Date.now() ^ (c.lv * 911)) >>> 0);
    const opp = g.people[0], cx = g.x, cz = g.z;
    // positions: the middle of the crew's ring is the stage; me on the south side, the opponent on the north
    const [opSpot, meSpot] = g.smoke ? club.duelSpots : [{ x: cx + .3, z: cz - 2.1 }, { x: cx - .3, z: cz + 2.1 }];
    const turns = [], rounds = g.smoke || c.tour ? 1 : c.lv >= 3 ? 2 : 1;
    const eq = ctx.heroEq(), chance = HERO.gearChances(eq), choices = availablePower();
    const footMoves = battleFootMoves(ctx.dist, clipLen);
    let lastForm;
    for (let i = 0; i < rounds; i++) {
      const gear = g.smoke ? null : HERO.gearEvent(chance, Math.floor(Math.random() * 10000), Math.floor(Math.random() * 3));
      const holder = Boolean(g.smoke?.holder), theirStyle = battleStyle(c.id, profile);
      const theirPlan = dancerPlan(opp, 'op', theirStyle, r, !holder);
      const myPlan = dancerPlan(H, 'me', i % 2 ? 'ground' : 'groove', r, holder);
      const planned = (holder ? myPlan : theirPlan).motif;
      const responderMemory = holder ? turnMemory(opp, 'op') : heroChoreo;
      const motif = planned && ctx.dist === 'club' ? clubCall(planned, responderMemory.lastClubReply, footMoves, r) : planned;
      const contract = motif ? { motif, advanced: footMoves.length === BATTLE_ANSWERS.length, moves: footMoves, shown: false } : null;
      const theirTurn = avoid => makeTurn(opp, c.lv, r, 'op', undefined, null, 2.12, false, bpm, theirStyle, theirPlan, contract, !holder, avoid);
      const myTurn = avoid => makeTurn(H, lv, r, 'me', buff(), gear, 2.12, true, bpm, undefined, myPlan, contract, holder, avoid);
      const first = holder ? myTurn(lastForm) : theirTurn(lastForm);
      const second = holder ? theirTurn(first.shape) : myTurn(first.shape);
      turns.push(first, second);
      lastForm = second.shape;
    }
    W.walk.start(H); W.walk.start(opp);
    const walkIn = Math.max(1.45, .35 + Math.max(Math.hypot(H.ws.x0 - meSpot.x, H.ws.z0 - meSpot.z), Math.hypot(opp.ws.x0 - opSpot.x, opp.ws.z0 - opSpot.z)) / 2.2);
    B = { g, opp, turns, choices, footMoves, i: -1, t0: 0, me: 0, op: 0, cx, cz, meSpot, opSpot, lv, phase: 'walk', pt: performance.now() / 1000, walkIn, clean: true, freezeDuration: 4 * 60 / bpm };
    W.lock = true; W.camT = { x: cx, z: cz + .4, zoom: g.smoke ? 1.15 : .4 }; document.body.classList.add('g3fight'); g.ambientEnabled = false; $('#g3skip').style.display = g.smoke ? 'none' : '';
    $('#g3bt').classList.add('on'); $('#g3bt').style.setProperty('--oc', c.col); $('#g3on').textContent = c.name.toUpperCase();
    $('#g3a').textContent = '0'; $('#g3b').textContent = '0'; $('#g3turn').textContent = _t('Выход в круг'); $('#g3mv').innerHTML = '';
    paintAct();
  }
  $('#g3skip').onclick = () => { if (!B || B.phase === 'end') return; B.skip = true; };

  function face(J, x, z) { J.root.rotation.y = Math.atan2(x - J.root.position.x, z - J.root.position.z); }
  function moveTurn(T, t, dt, home, cx, cz, back) {
    const J = T.J;
    const prep = T.pre ? PRE_SIGNAL : 0;
    if (!T.walking) {
      if (t < prep) return;
      T.walking = true;
      W.walk.start(J);
    }
    if (!J.ws) return;
    const facing = Math.atan2(cx - home.x, cz - home.z);
    if (back) {
      const lead = T.posted ? POST_RISE + POST_SIGNAL : 0;
      const progress = clamp((t - (T.len - OUT + lead)) / (lead ? OUT - lead : OUTW), 0, 1);
      W.walk.move(J, dt, home.x, home.z, lead ? progress : ease(progress), facing);
    } else {
      const k = ease(clamp((t - prep) / (T.enter - prep), 0, 1));
      W.walk.move(J, dt, cx, cz, k, facing, T.bend);
      if (k >= 1) J.ws = null;
    }
  }
  function mvText(s, res) {
    const e = $('#g3mv'); e.innerHTML = (s.nm ? _t(s.nm) : '') + (res ? `<small class="${res[0]}">${res[1]}</small>` : '');
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

  function openWheel(T) {
    const { options, fallback } = B.choices;
    const answering = T.reply.contract?.shown;
    const footMoves = answering || ctx.dist === 'center' ? B.footMoves : [];
    const offered = footMoves.length ? [
      ...footMoves.map(move => ({ move, name: _t(move.motif === 'thread' ? 'Продевание' : move.name), locked: false })),
      ...options.filter(option => option.move !== FOOT_OPTION),
    ] : options;
    const footwork = clipLen(WHEEL_FOOTWORK) ? WHEEL_FOOTWORK : FOOT_OPTION.c;
    const lastStep = T.seq.at(-1);
    T.J.play(side(footwork, lastStep.c?.endsWith('_M')), {
      fade: .24, speed: clipLen(footwork) * T.bpm / 240, once: false,
    });
    const { x, z } = T.J.root.position;
    Object.assign(W.camT, { x, z: z + .3 });
    W.camSnap = true;
    mythCut(null, null, 0);
    $('#g3mv').innerHTML = '';
    $('#g3skip').style.display = 'none';
    wheel.open(offered, fallback, answering ? null : B.lastMove, (move, manual) => {
      const now = performance.now() / 1000;
      const pickup = move?.motif ? beatEntry(0, T.bpm, currentBeat()) : 0;
      if (pickup > .015) T.pickup = now + pickup;
      B.t0 = now - T.pending.at + pickup;
      B.ln = now;
      B.lastMove = move;
      T.pending.resolve(move, manual);
      if (!B.g.smoke) $('#g3skip').style.display = '';
    }, null, answering ? replyPrompt(T) : footMoves.length ? _t('Попробуй один из двух рисунков футворка, затем удержи фриз.') : undefined);
  }
  function battleTick(dt) {
    const H = W.hero, now = performance.now() / 1000;
    if (B.phase === 'walk') {
      const k = ease(clamp((now - B.pt) / B.walkIn, 0, 1));
      W.walk.move(H, dt, B.meSpot.x, B.meSpot.z, k, Math.atan2(B.cx - B.meSpot.x, B.cz - B.meSpot.z));
      W.walk.move(B.opp, dt, B.opSpot.x, B.opSpot.z, k, Math.atan2(B.cx - B.opSpot.x, B.cz - B.opSpot.z));
      if (k >= 1) { B.phase = 'turn'; B.i = -1; if (B.g.smoke) W.camT.zoom = SMOKE_DANCE_ZOOM; nextTurn(); }
    } else if (B.phase === 'turn') {
      if (B.skip) { PM.cancel(); FZ.cancel(); finishSkip(); return; }
      // Pause the choreography clock during power drawing, replays and the manual freeze.
      if (PM.holds() || FZ.active()) B.t0 += now - (B.ln || now);
      // while the swipe winds up towards the drawn part the clock keeps the dancer's time (a slow frame doesn't cut the wind-up short)
      else if (PM.state() === 'arm') B.t0 += Math.max(0, now - (B.ln || now) - dt);
      B.ln = now;
      const T = B.turns[B.i], J = T.J, home = T.who === 'me' ? B.meSpot : B.opSpot;
      if (T.pickup) {
        if (now < T.pickup) { H.tick(dt); B.opp.tick(dt); return; }
        T.pickup = 0;
      }
      const final = T.seq[T.seq.length - 1], freezeAt = final.balance && !final.done ? final.a + final.balance.at : Infinity;
      const elapsed = now - B.t0, t = Math.min(elapsed, freezeAt, T.pending?.at ?? Infinity);
      moveTurn(T, t, dt, home, B.cx, B.cz, T.back);
      const other = T.who === 'me' ? B.opp : H; face(other, J.root.position.x, J.root.position.z);
      if (T.pending && (wheel.active() || elapsed >= T.pending.at)) {
        B.t0 = now - T.pending.at;
        if (!wheel.active()) openWheel(T);
        H.tick(dt); B.opp.tick(dt);
        return;
      }
      let si = T.seq.findIndex(s => t < s.b);
      if (si >= 0 && si < T.si) si = T.si;   // a set never steps back (the clock is moved around a drawn power move)
      if (t >= T.enter && si >= 0 && si !== T.si) {
        const s = T.seq[si]; T.si = si;
        if (s.c) J.play(s.c, { fade: s.fade ?? (s.kind === 'down' ? .3 : s.kind === 'freeze' ? .45 : .4), at: s.at, speed: s.sp });
        if (s.motif) {
          T.reply.contract.shown = true;
          mvText({ nm: callName(s.motif) });
        }
        if (s.answer) {
          T.reply.played = s.answer;
          if (ctx.dist === 'club' && !T.call && T.reply.eligible) turnMemory(J, T.who).lastClubReply = s.answer;
          s.nm = _t(BATTLE_ANSWERS.find(move => move.motif === s.answer).name);
        }
        if (s.kind === 'top' || s.kind === 'foot') { T.score += s.pts; mvText(s, ['ok', '+' + s.pts]); }
        else if (s.nm && !s.motif) mvText(s);
        paintScore(T);
        // MY power move: drawn by the finger (the old random outcome only if nobody draws)
        if (s.kind === 'power' && T.who === 'me' && !s.answer && !s.done && !s.gear && PM.can(s.c)) { s.pm = true; armDraw(T, s); }
      }
      const s = si >= 0 ? T.seq[si] : null;
      mythCut(T, s, t);
      if (si >= 0) spinTick(J, T.seq, t);
      if (s?.balance && elapsed >= freezeAt && !FZ.active()) {
        B.t0 = now - freezeAt;
        J.act.time = Math.min(s.at + s.balance.at, clipLen(s.c) - .01);
        FZ.arm(J, s, { duration: B.freezeDuration, wait: S.freezePlayed ? 3.5 : 5.5, tolerance: s.balance.tolerance,
          direction: s.balance.direction, onEnd: (ok, precision) => scoreFreeze(T, s, ok, precision) });
        S.freezePlayed = true; save();
      }
      if (s && (s.kind === 'power' || s.kind === 'freeze') && !s.balance && !s.done && !s.pm && (t - s.a) / s.len >= (s.fail ? s.failAt : .7)) {
        s.done = true;
        if (s.fail) { const k = s.kind === 'power' ? .5 : 0; T.score += k; fallStart(J); sfx('crash'); mvText(s, ['bad', s.kind === 'power' ? _t('Срыв! +0.5 за попытку') : _t('Не удержал! 0')]); T.clean = false; if (T.who === 'me') B.clean = false; }
        else {
          T.score += s.pts;
          const reply = s.kind === 'freeze' ? earnedReply(T, T.precision) : 0;
          mvText(s, reply ? ['ok', replyFeedback(T)]
            : s.gear ? ['gold', _t('САМ КРУТИТ') + ' · +' + s.pts] : ['ok', _t('Чисто! +{n}', { n: s.pts })]);
          sfx('hit');
          const camera = W.camT, zoom = B.g.smoke ? SMOKE_DANCE_ZOOM : .4;
          camera.zoom = .34;
          setTimeout(() => { if (W.camT === camera) camera.zoom = zoom; }, 450);
        }
        paintScore(T);
      }
      if (J.fall) fallTick(J, dt, s && s.soft);
      if (s && s.kind !== 'fall' && J.fall && J.fall.up) fallEnd(J);
      if (si < 0 && !T.back) {
        // a drawn move that came out clean: first a replay at the real tempo (city3d-power.js), then he walks back
        if (T.rec) { const rec = T.rec; T.rec = null; if (J.fall) fallEnd(J); PM.replay(J, rec); }
        else if (!PM.holds()) {
          if (J.fall) fallEnd(J);
          const ending = T.len - OUT, riseEnd = ending + POST_RISE;
          const postEnd = riseEnd + POST_SIGNAL;
          if (T.post && T.clean && t < postEnd) {
            if (t < riseEnd && !T.rising) {
              T.rising = true;
              J.play(RISE_FROM_FREEZE, { fade: .19, speed: clipLen(RISE_FROM_FREEZE) / POST_RISE });
            } else if (t >= riseEnd && !T.posted) {
              T.posted = true;
              J.play(T.post, { fade: .11, speed: clipLen(T.post) / POST_SIGNAL });
            }
          } else {
            T.back = true;
            W.walk.start(J);
            $('#g3mv').innerHTML = '';
          }
        }
      }
      if (t >= T.len) { if (J.fall) fallEnd(J); T.score += T.style; paintScore(T); nextTurn(); }
      if (!PM.holds()) { W.camT.x = lerp(W.camT.x, J.root.position.x, 1 - Math.exp(-dt * 2)); W.camT.z = lerp(W.camT.z, J.root.position.z + .3, 1 - Math.exp(-dt * 2)); }
      if (B.g.smoke && t >= T.enter && t < s?.b && s.c && !T.back) clubBattleDancer = J;
      PM.tick(dt);   // sets the speed of the drawn clip just before the dancer moves
    }
    H.tick(dt); B.opp.tick(dt); if (B) [H, B.opp].forEach(J => { if (J.ws) W.walk.pose(J, dt); });
  }
  function scoreFreeze(T, s, ok, precision) {
    s.done = true; s.fail = !ok;
    if (ok) {
      T.score += s.pts; sfx('hit');
      const reply = earnedReply(T, precision);
      const contract = T.reply.contract;
      const underTarget = contract && T.reply.eligible && T.reply.played === battleTechnique(contract.motif, T.call, contract.advanced)
        && precision < REPLY_PRECISION[ctx.dist];
      const feedback = underTarget ? _t('Зелёная зона {n}% · фриз +{points}', {
        n: Math.floor(precision * 100), points: scoreNumber.format(s.pts),
      }) : _t('Чисто! +{n}', { n: s.pts });
      mvText(s, ['ok', reply ? replyFeedback(T) : feedback]);
    } else {
      T.clean = B.clean = false;
      const fall = { a: s.b, b: s.b + 1.6, kind: 'fall', soft: true };
      T.seq.push(fall); T.len += 1.6;
      fallStart(T.J); sfx('crash'); mvText(s, ['bad', _t('Не удержал! 0')]);
    }
    paintScore(T);
  }
  // ---------- the drawn power move (city3d-power.js) ----------
  function armDraw(T, s) {
    const lv = ctx.heroLevel(), bf = buff(), up = Math.max(0, lv - (s.lv || 1));
    // the clock starts the step together with the clip (a long frame must not eat the wind-up)
    const nw = performance.now() / 1000; B.t0 = nw - (s.a + .002 + Math.max(0, T.J.act ? T.J.act.time - (s.at || 0) : 0)); B.ln = nw;
    PM.arm(T.J, s, {
      first: (S.drawN || 0) < 2,
      required: !!B.g.smoke, wait: B.g.smoke ? 8 : undefined,
      // what makes it easier: the levels from lessons above the move's own (+1 px, +.3 s each), the tailor's spin pad, the warm-up, the DJ, the mat
      tolAdd: Math.min(3, up) + Math.min(6, 30 * (bf.fall + (bf.pw || 0) + (s.c === 'Head_Spinning' ? bf.spin || 0 : 0))),
      spinTol: s.c === 'Head_Spinning' ? bf.spinTol : 0,
      timeAdd: Math.min(1.2, .3 * up),
      onEnd: res => drawn(T, s, res) });
  }
  function drawn(T, s, res) {
    if (!B) return;
    if (res.grade === 'auto') {   // nobody drew: the old random outcome goes on
      s.pm = false;
      if (res.late && !s.done) { s.done = true; T.score += s.fail ? .5 : s.pts; if (s.fail) T.clean = B.clean = false; paintScore(T); }
      return;
    }
    const J = T.J, i = T.seq.indexOf(s), ok = res.grade !== 'miss', now = performance.now() / 1000;
    S.drawN = (S.drawN || 0) + 1; s.done = true; s.pm = false;
    // the finger picked the ending: the set is re-timed from where the power move ended
    T.seq = T.seq.slice(0, i + 1).concat(ok ? s.tails.ok : s.tails.bad);
    s.len = res.len; s.b = s.a + s.len; let tt = s.b; for (let k = i + 1; k < T.seq.length; k++) { const x = T.seq[k]; x.a = tt; tt += x.len; x.b = tt; }
    T.len = tt + OUT; B.t0 = now - (s.a + res.rel + .001); B.ln = now;
    const pts = powerPoints(s, res, res.reason === 'no-start' ? 0 : .5);
    T.score += pts; paintScore(T);
    B.pm = (B.pm || []).concat({ nm: s.nm, g: res.grade, turns: res.turns, pts });
    if (!ok) {
      fallStart(J); sfx('crash');
      mvText(s, ['bad', res.reason === 'no-start' ? _t('Попытка не начата') : _t('Срыв! +0.5 за попытку')]);
      T.clean = B.clean = false;
    }
    else {
      T.rec = res.rec;
      if (res.grade === 'perfect') {
        mvText(s, ['gold', _t('Идеально! +{n}', { n: pts })]); sfx('perfect');
        if (!B.g.smoke) {
          S.perf = S.perf || {}; if (!S.perf[s.nm]) B.perfFirst = (B.perfFirst || []).concat(s.nm); S.perf[s.nm] = (S.perf[s.nm] || 0) + 1;
          bumpGoal('perf');
        }
      } else { mvText(s, ['ok', _t('Чисто! +{n}', { n: pts })]); sfx('hit'); }
    }
    save();
  }
  function paintScore(T) {
    const me = B.turns.filter(x => x.who === 'me').reduce((a, x) => a + x.score, 0), op = B.turns.filter(x => x.who === 'op').reduce((a, x) => a + x.score, 0);
    B.me = me; B.op = op; $('#g3a').textContent = scoreNumber.format(me); $('#g3b').textContent = scoreNumber.format(op);
  }
  function nextTurn() {
    B.i++; const H = W.hero; H.ws = B.opp.ws = null;
    if (B.i >= B.turns.length) { judge(); return; }
    const T = B.turns[B.i]; alignEntry(T); B.t0 = performance.now() / 1000; T.si = -1;
    const other = T.who === 'me' ? B.opp : H; other.play('Breakdance_Ready', { fade: .4, speed: 1.05 });
    if (T.pre) T.J.play(T.pre, { fade: .17, speed: clipLen(T.pre) / PRE_SIGNAL });
    else {
      T.walking = true;
      W.walk.start(T.J);
    }
    const turnTitle = T.who === 'me' ? _t('Твой выход') : _t('Выход: {x}', { x: B.g.c.name });
    $('#g3turn').textContent = B.g.smoke ? turnTitle : turnTitle + ' · ' + _t('раунд {n}', { n: Math.floor(B.i / 2) + 1 });
    $('#g3mv').innerHTML = '';
  }
  function finishSkip() {
    wheel.close(); mythCut(null, null, 0);
    // play out the rest instantly: every remaining scoring step counts as decided by its outcome
    B.turns.forEach((T, i) => { if (i < B.i) return; T.pending?.resolve(B.choices.fallback); T.seq.forEach(s => { if (s.done || (i === B.i && T.si >= 0 && T.seq.indexOf(s) <= T.si && s.kind !== 'power' && s.kind !== 'freeze')) return;
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
    H.play(H.idle, { fade: .32 });
    B.opp.play(B.opp.idle, { fade: .32 });
    if (B.g.smoke) { B.smokeVotes = votes; return; }
    let lines = [];
    const rkP = rankOf(S.rep), pf = B.perfFirst || [];
    if (pf.length) S.rep += pf.length * BAL.perfFirst;
    if (c.tour) lines = c.ringB ? ringResult(win) : jamResult(win);
    else if (win) {
      const was = S.wins[c.id] || 0, rk0 = rkP, rep = BAL.repWin * c.lv + (B.clean ? BAL.repClean : 0);
      S.rep += rep; S.wins[c.id] = was + 1; S.beat[c.id] = today();
      if (B.clean) {
        const key = 'clean:' + c.id;
        S.gearProgress[key] = (S.gearProgress[key] || 0) + 1;
      }
      if ((c.id === 'volt' || c.id === 'forge') && B.pm?.some(move => move.g === 'perfect')) {
        const key = 'perfect:' + c.id;
        S.gearProgress[key] = (S.gearProgress[key] || 0) + 1;
      }
      lines.push(`<span class="rw">${_t('+{n} ★ уважения', { n: rep })}</span>${B.clean ? _t(' (чистый батл без срывов)') : ''}`);
      const gi = was === 0 ? 0 : was === 2 ? 1 : -1, gid = gi >= 0 ? c.gear[gi] : null;
      const prize = gid && HERO.GEAR[gid];
      if (prize && !prize.reward && !S.own.includes(gid)) {
        S.own.push(gid); B.wear = gid;
        lines.push(`<span class="rw">${prize.ico} ${_t('Новая шмотка: {x} — уже на тебе', { x: _t(prize.name) })}</span>`);
      }
      const rk = rankOf(S.rep); if (rk > rk0) lines.push(`<span class="rw">${_t('🏅 Новое звание: {r}', { r: BAL.ranks[rk] })}</span>`);
      S.last[c.id] = today(); bumpGoal('win'); if (B.clean) bumpGoal('clean'); if (c.lv >= 2) bumpGoal('strong'); if (c.d === 'center') bumpGoal('cwin'); if (c.d === 'park') bumpGoal('pwin'); if (c.d === 'prom') bumpGoal('zwin');
      if (c.boss && was === 0) lines.unshift(`<span class="rw">${_t('👑 {b} и «{x}» признали тебя: {y}', { b: c.boss, x: c.name, y: c.d === 'prom' ? _t('ты хозяин Промзоны! Остался Клуб') : c.d === 'park' ? _t('ты хозяин Парка! Дорога в Промзону открыта') : _t('ты хозяин Центра! Дорога в Парк открыта') })}</span>`);
      lines.push(S.turf[c.id] ? _t('Банда ушла до завтра. Твоя стена под защитой ещё {n} дня.', { n: BAL.hold }) : _t('Банда ушла до завтра — <b>закрась их стену</b> рядом!'));
    } else {
      lines.push(B.lv < c.lv ? _t('Они сильнее тебя. Уроки поднимают уровень героя — он реже падает и крутит сложнее.') : _t('Не повезло со срывами. Попробуй ещё раз.'));
    }
    if (win) {
      if (B.pm?.some(move => move.nm === 'HEADSPIN' && move.g === 'perfect')) {
        S.gearProgress.headspinWin = (S.gearProgress.headspinWin || 0) + 1;
      }
      const rewards = collectGear(B.clean ? 'clean' : undefined);
      lines.push(...rewards.map(reward => `<span class="rw">${reward}</span>`));
    }
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
    PM.cancel(); FZ.cancel(); wheel.close();
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

  let cyT = 0, storyWatchStart = null;
  const storyOverlays = ['#cityLoading', '#alpha', '#g3info', '#lookDialog', '#graphicsDialog'].map($);
  const storyNear = $('#g3storyNear');
  const resetWatch = () => { storyWatchStart = null; };
  document.addEventListener('visibilitychange',resetWatch);
  addEventListener('pagehide',resetWatch);
  addEventListener('pageshow',resetWatch);
  // ---------- per frame ----------
  function update(dt) {
    const [loading, alpha, sheet, appearance, graphics] = storyOverlays;
    if (P) paintTick(dt);
    if (A) actTick(dt);
    if (Y) {
      djMix.tick(dt);
      chain.visible = rankOf(S.rep) < BAL.gateRank;
      W.tickAmbient(atP, dt);
    }
    if (PK) { PK.gateProm.chain.visible = !(S.wins.wave || S.seen.prom); }
    if (PZ) PZ.gateClub.chain.visible = !S.wins.forge;
    if (club) {
      clubBattleDancer = null;
      smoke.tick(dt, B, B?.phase === 'end' || wheel.active() || PM.state() === 'replay');
    }
    if (CN) CN.gatePark.chain.visible = !(S.wins.chrome || S.seen.park);
    if (B) {
      if (B.phase !== 'end') battleTick(dt);
      else if (B.g.smoke) { const votes = B.smokeVotes; clearSmokeBattle(); smoke.playerVerdict(votes); }
      else { W.hero.tick(dt); B.opp.tick(dt); }
    }
    FZ.tick(dt);
    crews.forEach(g => {
      if (!g.ambientEnabled && B?.g !== g) return;
      g.people.forEach(J => { if (J !== B?.opp) W.tickAmbient(J, dt); });
    });
    if (festival.busy()) {
      if (festivalSpin && festivalSpin.dancer.cur === festivalSpin.clip) {
        const { dancer, clock, at, speed, length } = festivalSpin;
        dancer.phraseTime = Math.min(length, (clock() - at) * speed);
      }
      W.hero.tick(dt);
      if (festivalGuest?.root.visible) festivalGuest.tick(dt);
      festivalPeople.forEach(person => person.tick(dt));
      if (narrativeCast) Object.values(narrativeCast.actors).forEach(person => person.tick(dt));
    } else if (festivalGuest) festivalGuest.root.visible = false;
    if (club) {
      if (!festival.performing()) clubFestivalMove = null;
      const set = clubFestivalMove;
      const festivalDancer = set && set.dancer.cur === set.clip && performance.now() < set.until ? set.dancer : null;
      const battleDancer = B?.phase === 'turn' && !wheel.active() && !PM.holds() && (!FZ.active() || FZ.holding()) && clubBattleDancer;
      const performer = battleDancer || smoke.performer() || festivalDancer;
      club.audience?.tick(dt, performer);
      const beat = performer && (performer === festivalDancer ? festival.beat() : window.cityMusic?.beat());
      club.lighting.tick(dt, performer, beat);
    }
    const chapter = storyChapter(), festivalStep = festival.guide(), line = guidingLine(chapter,festivalStep);
    const festivalTarget = line === 'festival' && festivalStep && festival.target();
    const storyTarget = line === 'story' && storyDestination(chapter);
    const storyArt = storyTarget && CHAPTER_ART[chapter.id];
    const storyObject = storyArt && groundArt(storyArt,storyTarget);
    if (!B && !P && !A && !choosing && !festival.busy()) {
      const p = W.hero.root.position; let best = null, bd = 3.1;
      if (!festivalOnly) crews.forEach(g => { if (!shown(g)) return; const d = Math.hypot(p.x - g.x, p.z - g.z); if (d < bd) { bd = d; best = g; } });
      const localPlaces = festivalOnly ? [] : PLACES;
      for (const pl of localPlaces) {
        if (pl.id === 'storyFinale' && (chapter?.id !== 'finale' || line !== 'story')) continue;
        if (pl.id === 'show' && chapter?.id === 'cypher' && line === 'story') continue;
        const d = Math.hypot(p.x - pl.x, p.z - pl.z);
        if (d < pl.r && d < bd) { bd = d; best = { place: pl }; }
      }
      if (!festivalOnly) crews.forEach(g => { if (!canPaint(g)) return; const d = Math.hypot(p.x - g.wall.x, p.z - g.wall.z); if (d < 2.4 && d < bd) { bd = d; best = { paint: true, g }; } });
      if (festivalTarget) {
        const distance = Math.hypot(p.x - festivalTarget.x, p.z - festivalTarget.z);
        if (distance < 1.15 || distance < festivalTarget.r && distance < bd) best = { place:festivalTarget };
      }
      if (storyObject && storyArt !== 'watch' && Math.hypot(p.x - storyObject.x,p.z - storyObject.z) < 1.08) {
        best = { place:storyTarget };
      }
      const key = o => !o ? null : o.paint ? 'p:' + o.g.c.id : o.place ? 'l:' + o.place.id : 'c:' + o.c.id;
      if (key(best) !== key(near)) { near = best; paintAct(); }
      // to-do «watch a turn in the cypher»: stand near the circle for 8 s
      if (!graphics.open && W.cyph && Math.hypot(p.x - W.cyph.x, p.z - W.cyph.z) < 5.5) { cyT += dt; if (cyT > 8) { cyT = -1e9; bumpGoal('cypher'); } }
    }
    const exploring = !traveling && !W.lock && !B && !A && !P && !choosing && !festival.busy() && !document.hidden &&
      loading.hidden && alpha.hidden && !sheet.classList.contains('on') && !appearance.open && !graphics.open && !$('#g3res').classList.contains('on');
    if (W.guideView && (!exploring || performance.now() >= W.guideView.until)) {
      if (W.guideView.snap) { W.camSnap = true; W.zoom = W.uZoom; }
      W.guideView = null;
    }
    const p = W.hero.root.position;
    let object = null;
    if (festivalTarget) object = { art:festivalStep.art, point:festivalTarget, line };
    if (storyObject) object = { art:storyArt, point:storyObject, line };
    const byCircle = exploring && object?.art === 'watch' && inWatchArea(watchPoint,p);
    const stopped = Math.hypot(W.hero.st.vx || 0,W.hero.st.vz || 0) < .22;
    let storyWatch = 0;
    if (byCircle && stopped) {
      const now = performance.now();
      if (storyWatchStart === null) {
        storyWatchStart = now;
        guide.announce(_t('Осталось у круга · {n} с',{n:WATCH_TIME}));
      }
      storyWatch = (now - storyWatchStart) / 1000;
      if (storyWatch >= WATCH_TIME) {
        const story = storyResult('cypher');
        save(); paintHud(); sfx('win'); toast(story);
        storyWatchStart = null;
        object = null;
      }
    } else storyWatchStart = null;
    storyNear.hidden = !byCircle || storyWatch >= WATCH_TIME;
    if (!storyNear.hidden) {
      const text = stopped ? _t('Осталось у круга · {n} с',{n:Math.ceil(WATCH_TIME-storyWatch)}) : _t('Остановись на следах, чтобы начать отсчёт');
      if (storyNear.textContent !== text) storyNear.textContent = text;
    }
    const entry = guidanceEntry(storyChapter(),line,object,festivalStep);
    document.body.classList.toggle('city-guide-intro',exploring && storyChapter()?.id === 'cypher' && line === 'story');
    guide.set(entry,exploring && !byCircle);
    landmark.set(exploring ? object : null);
  }
  function post(dt) {
    PM.post(dt);
    if (!wheel.active()) return;
    W.hero.B.Hips.getWorldPosition(wheelAnchor).project(ctx.camera);
    wheel.position(.5 + wheelAnchor.x / 2, .5 - wheelAnchor.y / 2);
  }
  return { update, post, scratchActive: () => A?.kind === 'scratch', shadowFocus: () => B ? B.g : smoke?.active() ? club.floor : null, _smoke: () => smoke?.probe(), _pm: () => PM._probe(), _pmState: () => PM.state(), _pmLast: () => PM.last(), _b: () => B, _a: () => A && { kind: A.kind, t: A.t, p: A.p, f: A.f }, busy: () => !!B || !!P || !!A || !!choosing || festival.busy(), _place: id => placeRun(PLACES.find(x => x.id === id)), _places: () => [...PLACES, festival.target()].filter(Boolean), _paint: id => startPaint(crews.find(g => g.c.id === id)), _walls: () => crews.map(g => g.wall.at), state: () => S, crews, _start: id => startBattle(crews.find(g => g.c.id === id)), _skip: () => { if (B) B.skip = true; } };
}
