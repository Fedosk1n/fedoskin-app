// The b-boy hero (owner 10.11.2026): our own flat cartoon character drawn as SVG; his outfit gets fresher with every
// level of training minutes. 8 levels, wide gaps. HERO.svg(level, {bg}) → SVG text. No brands, no logos.
(function(){
  'use strict';
  // minutes needed for each level (0, 1 h, 4 h, 10 h, 20 h, 35 h, 60 h, 100 h)
  const LEVELS = [0, 60, 240, 600, 1200, 2100, 3600, 6000];
  // level names are Russian keys for T() in index.html (tools/i18n_src.py)
  const NAMES = ['Новичок', 'С района', 'Свой в кругу', 'Стайлер', 'Баттлер', 'Мастер круга', 'Звезда джема', 'Легенда'];
  // what the next look brings (shown under the progress bar)
  const PERKS = ['', 'кепка и свежие кроссы', 'чёрная футболка и треники', 'олимпийка и наушники', 'цепь и очки',
    'бомбер и хайтопы', 'золото и бумбокс', 'пояс чемпиона'];
  // background ring colour per level
  const RING = ['#3A3A3F', '#5A4636', '#7A4A26', '#B4541C', '#E2611A', '#E58A2A', '#E7B23C', '#F2CC55'];

  const SKIN = '#C68A5E', SKIN_D = '#A86F47', HAIR = '#1E1714', INK = '#0E0E10';
  function levelFor(mins){ let l = 1; for (let i = 0; i < LEVELS.length; i++) if (mins >= LEVELS[i]) l = i + 1; return l; }

  function svg(level, opt){
    const L = Math.max(1, Math.min(8, level | 0)); opt = opt || {};
    const id = 'h' + L + (opt.uid || '');
    const p = [];
    // ---- outfit by level (each level keeps or upgrades the earlier things) ----
    const shirt = L >= 4 ? (L >= 6 ? '#16161A' : '#E2611A') : L >= 3 ? '#17171A' : '#8E8E95';
    const sleeveLong = L >= 4;
    const pants = L >= 3 ? '#1B1B1F' : '#3E5F8E';
    const pantsLine = L >= 3 ? (L >= 7 ? '#E7B23C' : '#E2611A') : null;
    const shoe = L >= 7 ? '#E7B23C' : L >= 6 ? '#E2611A' : '#F2EFE8';
    const sole = L >= 6 ? '#F2EFE8' : L >= 2 ? '#E2611A' : '#CFCBC3';
    const trim = L >= 7 ? '#E7B23C' : '#E2611A';
    const W = 200, H = 240;

    const vb = opt.bust ? [44, 8, 112, 112] : [0, 0, W, H]; // bust = head and shoulders (small icons)
    p.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb.join(' ') + '"' + (opt.size ? ' width="' + opt.size + '" height="' + Math.round(opt.size * vb[3] / vb[2]) + '"' : '') + '>');
    p.push('<defs><radialGradient id="' + id + 'g" cx="50%" cy="45%" r="55%"><stop offset="0" stop-color="' + RING[L - 1] + '" stop-opacity=".55"/><stop offset="1" stop-color="' + RING[L - 1] + '" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="' + id + 'gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE38A"/><stop offset=".5" stop-color="#E7B23C"/><stop offset="1" stop-color="#B9831E"/></linearGradient></defs>');
    // ---- background ----
    if (opt.bg !== false) {
      if (L >= 8) { // rays for the legend
        let r = '';
        for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; r += '<path d="M100 120 L' + (100 + 98 * Math.cos(a - .09)).toFixed(1) + ' ' + (120 + 98 * Math.sin(a - .09)).toFixed(1) + ' L' + (100 + 98 * Math.cos(a + .09)).toFixed(1) + ' ' + (120 + 98 * Math.sin(a + .09)).toFixed(1) + 'Z"/>'; }
        p.push('<g fill="#F2CC55" opacity=".16">' + r + '</g>');
      }
      p.push('<circle cx="100" cy="120" r="100" fill="url(#' + id + 'g)"/>');
      p.push('<ellipse cx="100" cy="226" rx="58" ry="7" fill="#000" opacity=".45"/>');
    }
    // ---- boombox at the feet (7+) ----
    if (L >= 7) {
      p.push('<g transform="translate(150 194) scale(.85)"><rect x="0" y="0" width="52" height="30" rx="5" fill="#26262B" stroke="' + INK + '" stroke-width="2"/>' +
        '<path d="M10 0 V-8 H42 V0" fill="none" stroke="' + INK + '" stroke-width="3"/>' +
        '<circle cx="13" cy="16" r="8" fill="#111" stroke="url(#' + id + 'gold)" stroke-width="3"/><circle cx="39" cy="16" r="8" fill="#111" stroke="url(#' + id + 'gold)" stroke-width="3"/>' +
        '<rect x="22" y="5" width="8" height="4" rx="1" fill="#E2611A"/></g>');
    }
    // ---- legs + pants ----
    p.push('<path d="M72 160 L70 214 Q70 218 74 218 L96 218 Q99 218 99 214 L101 172 L103 214 Q103 218 106 218 L126 218 Q130 218 130 214 L128 160 Z" fill="' + pants + '" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>');
    if (L <= 2) p.push('<path d="M101 172 V200" stroke="#2D4A72" stroke-width="2"/><path d="M76 200 h18 M108 200 h18" stroke="#2D4A72" stroke-width="2" opacity=".6"/>');
    if (pantsLine) p.push('<path d="M73 166 L72 214 M127 166 L128 214" stroke="' + pantsLine + '" stroke-width="3.5" stroke-linecap="round"/>');
    // ---- sneakers ----
    const shoeP = (x, flip) => {
      const s = flip ? -1 : 1, o = x;
      const hi = L >= 6; // high-tops
      const top = hi ? 206 : 213;
      return '<path d="M' + o + ' ' + top + ' L' + (o + s * 24) + ' ' + top + ' L' + (o + s * 26) + ' 222 Q' + (o + s * 38) + ' 222 ' + (o + s * 38) + ' 229 L' + (o - s * 2) + ' 229 Z" fill="' + shoe + '" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>' +
        '<path d="M' + (o - s * 2) + ' 229 L' + (o + s * 38) + ' 229" stroke="' + sole + '" stroke-width="5" stroke-linecap="round"/>' +
        (L >= 2 ? '<path d="M' + (o + s * 6) + ' ' + (top + 9) + ' L' + (o + s * 22) + ' ' + (top + 5) + '" stroke="' + (L >= 6 ? '#F2EFE8' : '#E2611A') + '" stroke-width="3" stroke-linecap="round"/>' : '') +
        (hi ? '<path d="M' + (o + s * 4) + ' 210 h' + (s * 14) + '" stroke="' + INK + '" stroke-width="1.6" opacity=".6"/>' : '');
    };
    p.push(shoeP(72, true)); p.push(shoeP(128, false));
    // ---- championship belt (8) under the top ----
    // ---- torso ----
    const torso = 'M66 106 Q70 98 84 96 L116 96 Q130 98 134 106 L134 120 L130 166 L70 166 L66 120 Z';
    p.push('<path d="' + torso + '" fill="' + shirt + '" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>');
    if (L === 3) { // spray print on the black tee
      p.push('<path d="M82 124 Q94 114 104 124 T124 122" fill="none" stroke="#E2611A" stroke-width="5" stroke-linecap="round"/><path d="M90 126 v8 M103 127 v11 M115 125 v6" stroke="#E2611A" stroke-width="3" stroke-linecap="round"/><circle cx="103" cy="141" r="2" fill="#E2611A"/>');
    }
    if (L >= 4) { // zip jacket: panels, zip, trims
      p.push('<path d="M100 98 V166" stroke="' + INK + '" stroke-width="2"/>');
      if (L <= 5) p.push('<path d="M66 120 L84 120 L82 166 L70 166 Z M134 120 L116 120 L118 166 L130 166 Z" fill="#17171A"/>');
      else p.push('<path d="M70 140 L130 140" stroke="' + trim + '" stroke-width="4"/><path d="M86 100 L84 112 L100 120 L116 112 L114 100" fill="none" stroke="' + trim + '" stroke-width="3" stroke-linejoin="round"/>' +
        '<circle cx="117" cy="128" r="5" fill="' + trim + '"/><rect x="78" y="124" width="12" height="8" rx="2" fill="#E2611A"/>');
      p.push('<path d="M70 162 H130" stroke="' + trim + '" stroke-width="4" stroke-linecap="round"/>');
    }
    // ---- arms ----
    const sleeve = shirt, raise = L >= 8;
    // left arm (viewer's left) hangs down
    p.push('<path d="M70 106 Q58 112 56 132 L54 ' + (sleeveLong ? 160 : 130) + '" fill="none" stroke="' + INK + '" stroke-width="19" stroke-linecap="round"/>');
    p.push('<path d="M70 106 Q58 112 56 132 L54 ' + (sleeveLong ? 160 : 130) + '" fill="none" stroke="' + sleeve + '" stroke-width="14" stroke-linecap="round"/>');
    if (!sleeveLong) p.push('<path d="M55 130 L53 160" stroke="' + INK + '" stroke-width="15" stroke-linecap="round"/><path d="M55 130 L53 160" stroke="' + SKIN + '" stroke-width="10.5" stroke-linecap="round"/>');
    if (L >= 4 && L <= 5) p.push('<path d="M57 120 L55 152" stroke="#17171A" stroke-width="5"/>');
    if (L >= 6) p.push('<path d="M47 154 L61 156" stroke="' + trim + '" stroke-width="5" stroke-linecap="round"/>');
    p.push('<circle cx="53" cy="166" r="8" fill="' + SKIN + '" stroke="' + INK + '" stroke-width="2.5"/>');
    if (raise) { // right arm up — fist in the air
      p.push('<path d="M130 106 Q146 96 150 76 L152 50" fill="none" stroke="' + INK + '" stroke-width="19" stroke-linecap="round"/><path d="M130 106 Q146 96 150 76 L152 50" fill="none" stroke="' + sleeve + '" stroke-width="14" stroke-linecap="round"/>');
      p.push('<path d="M144 62 L158 64" stroke="' + trim + '" stroke-width="5" stroke-linecap="round"/>');
      p.push('<rect x="143" y="30" width="19" height="20" rx="6" fill="' + SKIN + '" stroke="' + INK + '" stroke-width="2.5"/><path d="M147 36 h11 M147 42 h11" stroke="' + SKIN_D + '" stroke-width="1.6"/>');
    } else {
      p.push('<path d="M130 106 Q142 112 144 132 L146 ' + (sleeveLong ? 160 : 130) + '" fill="none" stroke="' + INK + '" stroke-width="19" stroke-linecap="round"/>');
      p.push('<path d="M130 106 Q142 112 144 132 L146 ' + (sleeveLong ? 160 : 130) + '" fill="none" stroke="' + sleeve + '" stroke-width="14" stroke-linecap="round"/>');
      if (!sleeveLong) p.push('<path d="M145 130 L147 160" stroke="' + INK + '" stroke-width="15" stroke-linecap="round"/><path d="M145 130 L147 160" stroke="' + SKIN + '" stroke-width="10.5" stroke-linecap="round"/>');
      if (L >= 4 && L <= 5) p.push('<path d="M143 120 L145 152" stroke="#17171A" stroke-width="5"/>');
      if (L >= 6) p.push('<path d="M139 156 L153 154" stroke="' + trim + '" stroke-width="5" stroke-linecap="round"/>');
      p.push('<circle cx="147" cy="166" r="8" fill="' + SKIN + '" stroke="' + INK + '" stroke-width="2.5"/>');
    }
    // ---- belt of the champion (8) ----
    if (L >= 8) {
      p.push('<rect x="68" y="154" width="64" height="12" rx="3" fill="#26262B" stroke="' + INK + '" stroke-width="2"/>' +
        '<ellipse cx="100" cy="160" rx="17" ry="12" fill="url(#' + id + 'gold)" stroke="' + INK + '" stroke-width="2"/>' +
        '<path d="M100 152 l2.4 5 5.4 .6 -4 3.7 1.1 5.3 -4.9 -2.7 -4.9 2.7 1.1 -5.3 -4 -3.7 5.4 -.6Z" fill="#B9831E"/>' +
        '<circle cx="77" cy="160" r="3" fill="url(#' + id + 'gold)"/><circle cx="123" cy="160" r="3" fill="url(#' + id + 'gold)"/>');
    }
    // ---- neck ----
    p.push('<rect x="92" y="84" width="16" height="16" rx="4" fill="' + SKIN_D + '"/>');
    if (L >= 3 && L <= 5 || L >= 6) p.push('<path d="M86 98 Q100 108 114 98" fill="none" stroke="' + (L >= 6 ? trim : '#2A2A2E') + '" stroke-width="3"/>');
    // ---- chain (5+) ----
    if (L >= 5) {
      const big = L >= 7;
      p.push('<path d="M88 98 Q100 ' + (big ? 126 : 118) + ' 112 98" fill="none" stroke="url(#' + id + 'gold)" stroke-width="' + (big ? 4.5 : 3) + '" stroke-dasharray="' + (big ? '3 1.5' : '2.5 1.5') + '"/>');
      if (big) p.push('<path d="M100 119 L107 127 L100 135 L93 127 Z" fill="url(#' + id + 'gold)" stroke="' + INK + '" stroke-width="1.6" stroke-linejoin="round"/><path d="M100 122 L103 127 L100 131" fill="none" stroke="#fff" stroke-width="1.2" opacity=".7"/>');
    }
    // ---- headphones round the neck (4+) ----
    if (L >= 4) p.push('<path d="M82 94 Q100 112 118 94" fill="none" stroke="#2A2A2E" stroke-width="5"/><rect x="74" y="88" width="12" height="16" rx="5" fill="#26262B" stroke="' + INK + '" stroke-width="2"/><rect x="114" y="88" width="12" height="16" rx="5" fill="#26262B" stroke="' + INK + '" stroke-width="2"/><rect x="77" y="92" width="6" height="8" rx="2" fill="' + trim + '"/><rect x="117" y="92" width="6" height="8" rx="2" fill="' + trim + '"/>');
    // ---- head ----
    p.push('<circle cx="70" cy="60" r="7" fill="' + SKIN + '" stroke="' + INK + '" stroke-width="2.5"/><circle cx="130" cy="60" r="7" fill="' + SKIN + '" stroke="' + INK + '" stroke-width="2.5"/>');
    p.push('<ellipse cx="100" cy="56" rx="30" ry="32" fill="' + SKIN + '" stroke="' + INK + '" stroke-width="2.5"/>');
    // hair / cap
    if (L === 1) {
      p.push('<path d="M70 52 Q70 22 100 22 Q130 22 130 52 Q122 40 112 42 Q104 34 92 40 Q80 36 70 52Z" fill="' + HAIR + '" stroke="' + INK + '" stroke-width="2"/>');
    } else {
      const crown = L >= 7 ? 'url(#' + id + 'gold)' : L >= 5 ? '#E2611A' : '#17171A';
      const brim = L >= 7 ? '#17171A' : L >= 5 ? '#17171A' : '#E2611A';
      p.push('<path d="M70 50 Q68 18 100 18 Q132 18 130 50 Z" fill="' + crown + '" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>');
      p.push('<path d="M100 18 V48" stroke="' + INK + '" stroke-width="1.5" opacity=".35"/><circle cx="100" cy="19" r="2.6" fill="' + brim + '" stroke="' + INK + '" stroke-width="1.5"/>');
      p.push('<path d="M66 50 Q100 42 140 48 Q150 50 152 55 Q118 54 66 56 Z" fill="' + brim + '" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>');
      p.push('<path d="M70 56 Q72 62 74 62 M130 56 Q128 62 126 62" stroke="' + HAIR + '" stroke-width="3"/>');
    }
    // face
    if (L >= 5) { // shades
      const lens = L >= 7 ? 'url(#' + id + 'gold)' : '#111';
      p.push('<path d="M78 62 H122" stroke="' + INK + '" stroke-width="3"/><rect x="78" y="58" width="19" height="12" rx="4" fill="' + lens + '" stroke="' + INK + '" stroke-width="2.5"/><rect x="103" y="58" width="19" height="12" rx="4" fill="' + lens + '" stroke="' + INK + '" stroke-width="2.5"/>' +
        '<path d="M82 61 l5 0" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".55"/><path d="M107 61 l5 0" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".55"/>');
    } else {
      p.push('<path d="M84 ' + (L >= 3 ? 56 : 57) + ' q6 ' + (L >= 3 ? -3 : -2) + ' 11 0 M105 ' + (L >= 3 ? 55 : 57) + ' q6 -2 11 ' + (L >= 3 ? 1 : 0) + '" fill="none" stroke="' + HAIR + '" stroke-width="3" stroke-linecap="round"/>');
      p.push('<circle cx="90" cy="64" r="3.4" fill="' + INK + '"/><circle cx="110" cy="64" r="3.4" fill="' + INK + '"/>');
    }
    p.push('<path d="M99 66 q-3 7 1 9" fill="none" stroke="' + SKIN_D + '" stroke-width="2.2" stroke-linecap="round"/>');
    if (L >= 6) p.push('<path d="M89 78 Q100 86 112 77" fill="none" stroke="' + INK + '" stroke-width="3" stroke-linecap="round"/>');
    else if (L >= 3) p.push('<path d="M92 79 Q101 83 110 78" fill="none" stroke="' + INK + '" stroke-width="2.6" stroke-linecap="round"/>');
    else p.push('<path d="M93 80 H107" stroke="' + INK + '" stroke-width="2.6" stroke-linecap="round"/>');
    if (L >= 8) p.push('<g fill="#FFE38A"><path d="M44 40 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3Z"/><path d="M168 96 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2Z"/><path d="M38 118 l2 4 4 2 -4 2 -2 4 -2 -4 -4 -2 4 -2Z"/></g>');
    p.push('</svg>');
    return p.join('');
  }
  window.HERO = { LEVELS, NAMES, PERKS, RING, levelFor, svg };
})();
