// The b-boy hero (owner 10.11.2026): our own flat cartoon character drawn as SVG; his outfit gets fresher with every
// level of training minutes. 8 levels, wide gaps. HERO.svg(level, {uid, bust, bg, size}) → SVG text. No brands, no logos.
// v2 (owner 10.11.2026 «детальнее… в мире брейкинга люди очень сильно заморачиваются над шмотками»): sneakers with
// outsole tread, midsole, toe box, overlays, eyelets and laces; caps with panels, eyelets, button, flat brim + sticker;
// beanie with rib cuff; bucket hat with stitch rows; tees with rib collar and folds; track jacket with stand collar,
// zip + pull, yoke, piping, rib cuffs; bomber with striped rib trims, patches and sleeve pocket; jeans with pockets,
// fly and stacked hem; track pants with piping and gathered cuffs; rope chain, wristbands, watch, earring, rings.
(function(){
  'use strict';
  // minutes needed for each level (0, 1 h, 4 h, 10 h, 20 h, 35 h, 60 h, 100 h)
  const LEVELS = [0, 60, 240, 600, 1200, 2100, 3600, 6000];
  // level names are Russian keys for T() in index.html (tools/i18n_src.py)
  const NAMES = ['Новичок', 'С района', 'Свой в кругу', 'Стайлер', 'Баттлер', 'Мастер круга', 'Звезда джема', 'Легенда'];
  // what the next look brings (shown under the progress bar)
  const PERKS = ['', 'кепка и свежие кроссы', 'чёрная футболка и треники', 'олимпийка, шапка и наушники', 'панама, цепь и очки',
    'бомбер и хайтопы', 'золото и бумбокс', 'пояс чемпиона'];
  // background ring colour per level
  const RING = ['#3A3A3F', '#5A4636', '#7A4A26', '#B4541C', '#E2611A', '#E58A2A', '#E7B23C', '#F2CC55'];

  const SKIN = '#C68A5E', SKIN_D = '#A86F47', SKIN_L = '#D9A27A', HAIR = '#1E1714', INK = '#0E0E10';
  const OR = '#E2611A', OR_D = '#B44812', BLK = '#18181B', BLK2 = '#232328', WH = '#F2EFE8', WH_D = '#D6D1C6';
  function levelFor(mins){ let l = 1; for (let i = 0; i < LEVELS.length; i++) if (mins >= LEVELS[i]) l = i + 1; return l; }

  function svg(level, opt){
    const L = Math.max(1, Math.min(8, level | 0)); opt = opt || {};
    const id = 'h' + L + (opt.uid || '');
    const GOLD = 'url(#' + id + 'gold)';
    const o = [];
    const P = (d, fill, ex) => o.push('<path d="' + d + '" fill="' + (fill || 'none') + '"' + (ex || '') + '/>');
    const S = (w) => ' stroke="' + INK + '" stroke-width="' + (w || 2.2) + '" stroke-linejoin="round" stroke-linecap="round"';
    const LN = (d, col, w, ex) => o.push('<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round"' + (ex || '') + '/>');
    const MIR = (fn) => { o.push('<g transform="translate(200 0) scale(-1 1)">'); fn(); o.push('</g>'); };

    // ---- the outfit of this level ----
    const fit = {
      hat: [null, null, 'cap', 'cap', 'beanie', 'bucket', 'capBack', 'capGold', 'capGold'][L],
      top: [null, 'tee', 'tee', 'teeBig', 'track', 'track', 'bomber', 'trackGold', 'trackGold'][L],
      pants: [null, 'jeans', 'jeans', 'trackp', 'trackp', 'trackp', 'wind', 'trackpGold', 'trackpGold'][L],
      shoe: [null, 'canvas', 'leather', 'leather', 'runner', 'runner', 'high', 'highGold', 'highGold'][L],
    };
    const W = 200, H = 240;
    const vb = opt.bust ? [50, 16, 100, 100] : [0, 0, W, H]; // bust = head and shoulders (small icons)
    o.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb.join(' ') + '"' + (opt.size ? ' width="' + opt.size + '" height="' + Math.round(opt.size * vb[3] / vb[2]) + '"' : '') + '>');
    o.push('<defs><radialGradient id="' + id + 'g" cx="50%" cy="45%" r="55%"><stop offset="0" stop-color="' + RING[L - 1] + '" stop-opacity=".55"/><stop offset="1" stop-color="' + RING[L - 1] + '" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="' + id + 'gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE9A0"/><stop offset=".45" stop-color="#E7B23C"/><stop offset="1" stop-color="#A8741A"/></linearGradient>' +
      '<linearGradient id="' + id + 'sh" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".22"/><stop offset=".35" stop-color="#000" stop-opacity="0"/><stop offset=".7" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".08"/></linearGradient>' +
      '<linearGradient id="' + id + 'lens" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3A3A44"/><stop offset="1" stop-color="#08080A"/></linearGradient></defs>');

    // ---- background ----
    if (opt.bg !== false) {
      if (L >= 8) {
        let r = '';
        for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; r += '<path d="M100 118 L' + (100 + 98 * Math.cos(a - .09)).toFixed(1) + ' ' + (118 + 98 * Math.sin(a - .09)).toFixed(1) + ' L' + (100 + 98 * Math.cos(a + .09)).toFixed(1) + ' ' + (118 + 98 * Math.sin(a + .09)).toFixed(1) + 'Z"/>'; }
        o.push('<g fill="#F2CC55" opacity=".16">' + r + '</g>');
      }
      o.push('<circle cx="100" cy="118" r="100" fill="url(#' + id + 'g)"/>');
      o.push('<ellipse cx="100" cy="231" rx="62" ry="6.5" fill="#000" opacity=".5"/>');
    }

    // ---- boombox (7+), behind the right leg ----
    if (L >= 7) {
      o.push('<g transform="translate(146 194)">');
      P('M6 0 V-7 Q6 -10 9 -10 H39 Q42 -10 42 -7 V0', 'none', ' stroke="' + INK + '" stroke-width="3.2"');
      P('M0 3 Q0 0 3 0 H45 Q48 0 48 3 V30 Q48 33 45 33 H3 Q0 33 0 30 Z', '#2B2B31', S(2));
      P('M0 3 Q0 0 3 0 H45 Q48 0 48 3 V8 H0 Z', '#3A3A42');
      [12, 36].forEach(cx => { o.push('<circle cx="' + cx + '" cy="21" r="9" fill="#111114" stroke="' + GOLD + '" stroke-width="2.6"/><circle cx="' + cx + '" cy="21" r="3.2" fill="#2E2E34"/>'); });
      P('M19 4 H29 V7 H19 Z', OR); o.push('<circle cx="40" cy="4.5" r="1.4" fill="#3BD16F"/><circle cx="6" cy="4.5" r="1.4" fill="' + WH_D + '"/>');
      o.push('</g>');
    }

    // ---- sneakers (profile, toes out) ----
    const shoe = () => {
      const t = fit.shoe, hi = t === 'high' || t === 'highGold';
      const up = { canvas: WH, leather: WH, runner: BLK2, high: OR, highGold: BLK }[t];
      const ov = { canvas: WH_D, leather: OR, runner: OR, high: WH, highGold: GOLD }[t];
      const mid = { canvas: '#E9E4D8', leather: WH, runner: WH, high: WH, highGold: GOLD }[t];
      const out = { canvas: '#CFC8B8', leather: '#B98A4E', runner: BLK, high: '#B98A4E', highGold: BLK }[t];
      const lace = { canvas: WH, leather: WH, runner: WH, high: WH, highGold: '#E7B23C' }[t];
      o.push('<g transform="translate(103 230) scale(1.18)">');
      // outsole + tread
      P('M-1 0 H40 Q46 0 46 -4 V-6 H-1 Z', out, S(2));
      LN('M4 -1.5 v-3 M10 -1.5 v-3 M16 -1.5 v-3 M22 -1.5 v-3 M28 -1.5 v-3 M34 -1.5 v-3 M40 -1.5 v-3', 'rgba(0,0,0,.35)', 1.2);
      // midsole
      P('M-1 -6 H46 Q46 -10 42 -12 H-1 Z', mid, S(2));
      if (t !== 'canvas') LN('M3 -9 H38', 'rgba(0,0,0,.22)', 1, ' stroke-dasharray="2 2"');
      // upper
      if (hi) P('M0 -12 L-1 -37 Q0 -42 7 -42 L15 -41 Q17 -32 20 -26 Q28 -21 36 -18 Q44 -16 44 -12 Z', up, S(2));
      else P('M0 -12 L0 -25 Q1 -29 7 -29 L14 -28 Q22 -23 30 -19 Q42 -16 44 -12 Z', up, S(2));
      // toe box + toe cap
      P('M31 -12 Q32 -19 38 -18 Q44 -16 44 -12 Z', t === 'canvas' ? WH_D : ov, S(1.6));
      if (t === 'canvas') LN('M33 -14 H43', 'rgba(0,0,0,.25)', 1);
      // heel counter + side overlay
      if (t !== 'canvas') {
        P(hi ? 'M0 -12 L-.5 -30 Q6 -28 10 -21 Q12 -15 16 -12 Z' : 'M0 -12 L0 -24 Q6 -22 9 -17 Q11 -13 15 -12 Z', ov, S(1.6));
        P(hi ? 'M14 -14 Q21 -24 31 -21 Q25 -18 22 -14 Z' : 'M14 -13 Q20 -21 29 -19 Q24 -16 21 -13 Z', t === 'high' ? BLK : t === 'runner' ? WH : ov, S(1.4));
      } else {
        P('M0 -12 L0 -24 Q4 -24 6 -21 L6 -12 Z', WH_D, S(1.2));
      }
      // eyestay + eyelets + laces
      const ey = hi ? [[9, -39], [12, -34], [15, -29], [19, -25], [24, -22]] : [[9, -27], [14, -25], [19, -22], [24, -20]];
      LN('M' + ey.map(p => p.join(' ')).join(' L'), 'rgba(0,0,0,.35)', 4.2);
      ey.forEach(p => o.push('<circle cx="' + p[0] + '" cy="' + p[1] + '" r="1.1" fill="' + (t === 'highGold' ? '#E7B23C' : '#9A968E') + '"/>'));
      for (let i = 0; i < ey.length - 1; i++) LN('M' + (ey[i][0] - 2) + ' ' + (ey[i][1] + 2.5) + ' L' + (ey[i + 1][0] + 2) + ' ' + (ey[i + 1][1] - 2.5), lace, 1.6);
      // collar padding + tongue + pull tab
      P(hi ? 'M-1 -37 Q3 -44 10 -42 L9 -38 Q4 -39 1 -35 Z' : 'M0 -25 Q3 -30 9 -28 L8 -25 Q4 -26 1 -23 Z', BLK2, S(1.2));
      P(hi ? 'M8 -42 L11 -47 Q15 -47 15 -43 L13 -39 Z' : 'M8 -28 L10 -32 Q14 -32 14 -29 L13 -26 Z', ov === GOLD ? GOLD : (t === 'canvas' ? WH : ov), S(1.2));
      if (hi) { P('M1 -31 L14 -33 L15 -29 L2 -27 Z', t === 'highGold' ? '#E7B23C' : BLK, S(1.2)); o.push('<circle cx="12" cy="-31" r=".9" fill="#9A968E"/>'); }
      // stitch line along the upper
      LN(hi ? 'M2 -14 Q16 -15 28 -15' : 'M2 -14 Q16 -15 28 -15', 'rgba(0,0,0,.25)', .9, ' stroke-dasharray="1.6 1.6"');
      o.push('</g>');
    };
    shoe(); MIR(shoe);

    // ---- pants ----
    const pants = () => {
      const t = fit.pants, track = t !== 'jeans', hem = t === 'jeans' ? 207 : t === 'wind' ? 193 : 197;
      const col = { jeans: '#3E5F8E', trackp: BLK, wind: '#232327', trackpGold: BLK }[t];
      // left leg (viewer's left) — the right one is mirrored
      const leg = 'M70 146 L100 146 L100 158 Q100 186 99 ' + hem + ' L73 ' + hem + ' Q67 178 70 146 Z';
      P(leg, col, S()); P(leg, 'url(#' + id + 'sh)');
      if (t === 'jeans') {
        LN('M73 151 Q81 158 89 150', '#2D4A72', 1.6);                               // front pocket
        LN('M73 153 Q81 160 89 152', '#C9A25A', .8, ' stroke-dasharray="1.4 1.4"');   // pocket stitch
        LN('M79 176 Q85 180 92 176', 'rgba(255,255,255,.22)', 4);                       // knee fade
        LN('M72 ' + (hem - 3) + ' Q85 ' + (hem - 6) + ' 98 ' + (hem - 3) + ' M71 ' + (hem - 8) + ' Q84 ' + (hem - 11) + ' 98 ' + (hem - 8), '#2D4A72', 1.4); // stacked hem
        LN('M74 ' + (hem - 1) + ' H97', '#C9A25A', .8, ' stroke-dasharray="1.4 1.4"');
        LN('M71 148 Q69 180 72 ' + (hem - 2), '#C9A25A', .8, ' stroke-dasharray="1.4 1.4"'); // outseam
      } else {
        const pipe = t === 'trackpGold' ? GOLD : OR;
        LN('M71.5 149 Q68.5 178 72 ' + (hem - 9), pipe, 2.6);                            // side piping
        P('M71 ' + (hem - 9) + ' L99 ' + (hem - 9) + ' L99 ' + hem + ' L72 ' + hem + ' Z', t === 'wind' ? '#1A1A1E' : '#121214', S(1.6)); // gathered cuff
        LN('M76 ' + (hem - 8) + ' v7 M81 ' + (hem - 8) + ' v7 M86 ' + (hem - 8) + ' v7 M91 ' + (hem - 8) + ' v7 M96 ' + (hem - 8) + ' v7', 'rgba(255,255,255,.12)', 1);
        LN('M74 ' + (hem - 12) + ' Q80 ' + (hem - 16) + ' 86 ' + (hem - 11) + ' M88 ' + (hem - 13) + ' Q93 ' + (hem - 17) + ' 97 ' + (hem - 12), 'rgba(255,255,255,.13)', 1.4); // bunching folds
        LN('M78 170 Q84 168 92 172', 'rgba(255,255,255,.1)', 1.4);
        if (t === 'wind') { LN('M80 156 Q83 172 81 180', 'rgba(255,255,255,.14)', 2.2); LN('M74 ' + (hem - 9) + ' L74 ' + (hem - 20), '#9A968E', 1.4); }
      }
    };
    pants(); MIR(pants);
    if (fit.pants === 'jeans') { LN('M100 147 V168 Q101 172 104 170', '#2D4A72', 1.6); LN('M103 147 V166', '#C9A25A', .8, ' stroke-dasharray="1.4 1.4"'); }

    // ---- belt of the champion (8) sits on the waist later ----

    // ---- arms (behind the torso) ----
    const longSleeve = /track|bomber/.test(fit.top);
    const sleeveCol = { tee: '#8E8E95', teeBig: BLK, track: OR, bomber: BLK, trackGold: BLK }[fit.top];
    const cuffCol = { track: BLK, bomber: OR, trackGold: '#E7B23C' }[fit.top];
    const arm = (side) => {
      // side 0 = viewer's left (drawn), right is mirrored unless raised
      if (longSleeve) {
        P('M71 92 Q58 96 55 118 L52 147 L65 148 L67 121 L73 104 Z', sleeveCol, S());
        P('M71 92 Q58 96 55 118 L52 147 L65 148 L67 121 L73 104 Z', 'url(#' + id + 'sh)');
        if (fit.top === 'track') { P('M71 92 Q61 95 58 108 L65 110 Q67 100 73 98 Z', BLK); LN('M57 112 L54 146', WH, 1.6); }
        if (fit.top === 'trackGold') LN('M57 106 L53 146', GOLD, 2.2);
        if (fit.top === 'bomber') { P('M54 122 L64 123 L63 132 L53 131 Z', BLK2, S(1.2)); LN('M55 125 H63', '#9A968E', .9); LN('M60 104 Q63 116 62 126', 'rgba(255,255,255,.1)', 1.4); }
        P('M52 145 L65 146 L65 154 L52 153 Z', cuffCol, S(1.6));
        if (fit.top === 'bomber') LN('M52.5 148.5 L64.5 149.5', BLK, 1.6);
        LN('M55 146.5 v6 M58 146.8 v6 M61 147 v6', 'rgba(0,0,0,.25)', .8);
      } else {
        const big = fit.top === 'teeBig';
        P(big ? 'M68 92 Q56 98 53 124 L68 127 L70 108 Z' : 'M71 92 Q60 96 56 116 L68 120 L71 106 Z', sleeveCol, S());
        LN(big ? 'M54 120 L68 123' : 'M57 112 L68 116', 'rgba(0,0,0,.3)', 1.2);
        P(big ? 'M56 126 L54 148 L64 149 L66 127 Z' : 'M58 119 L54 148 L64 149 L67 121 Z', SKIN, S());
        LN(big ? 'M63 128 L62 146' : 'M64 123 L62 146', SKIN_D, 1.4);
      }
      // wristband (3+), watch (7+) on the left wrist only
      if (L >= 3 && !side) {
        P('M51.5 140 L64.5 141 L64.5 146 L51.5 145 Z', L >= 7 ? GOLD : OR, S(1.4));
        LN('M54 140.5 v4.5 M57 140.7 v4.5 M60 140.9 v4.5 M63 141 v4.5', 'rgba(0,0,0,.18)', .7);
      }
      // hand
      P('M51 151 Q50 160 55 163 Q61 165 65 160 Q67 154 65 150 Z', SKIN, S());
      LN('M54 157 Q57 159 61 158', SKIN_D, 1.2);
      if (L >= 7 && !side) o.push('<rect x="55" y="155" width="5" height="3.2" rx="1" fill="' + GOLD + '" stroke="' + INK + '" stroke-width=".9"/>');
    };
    arm(0);
    if (L >= 8) {
      // right arm up — fist in the air (sleeve, cuff, fist)
      P('M129 92 Q143 88 148 72 L151 48 L139 46 L137 70 L127 98 Z', sleeveCol, S());
      LN('M146 72 L149 49', GOLD, 2.2);
      P('M138 44 L152 46 L151 54 L137 52 Z', cuffCol, S(1.6));
      P('M137 44 Q135 30 142 27 Q152 25 155 31 Q157 38 152 45 Z', SKIN, S());
      LN('M140 33 Q146 31 152 33 M140 38 Q146 36 152 38', SKIN_D, 1.2);
      o.push('<rect x="139" y="28" width="6" height="3.6" rx="1" fill="' + GOLD + '" stroke="' + INK + '" stroke-width=".9"/>');
    } else MIR(() => arm(1));

    // ---- torso ----
    const top = fit.top;
    if (top === 'tee' || top === 'teeBig') {
      const big = top === 'teeBig', col = big ? BLK : '#8E8E95';
      const body = big ? 'M66 94 Q70 87 82 85 L118 85 Q130 87 134 94 L133 156 Q100 160 67 156 Z' : 'M70 93 Q74 87 84 85 L116 85 Q126 87 130 93 L129 150 Q100 153 71 150 Z';
      P(body, col, S()); P(body, 'url(#' + id + 'sh)');
      // rib collar
      P('M86 86 Q100 97 114 86 L111 85 Q100 93 89 85 Z', big ? '#2A2A2F' : '#7A7A80', S(1.4));
      // folds
      LN(big ? 'M78 120 Q82 134 79 150 M121 118 Q117 134 121 151 M92 150 Q100 146 108 151' : 'M80 118 Q83 130 80 146 M120 116 Q117 130 120 146', big ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.15)', 1.4);
      // hem stitch
      LN(big ? 'M68 152 Q100 156 132 152' : 'M72 146 Q100 149 128 146', big ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.2)', .9, ' stroke-dasharray="1.6 1.6"');
      if (L === 2) o.push('<rect x="108" y="98" width="9" height="6" rx="1.2" fill="' + OR + '" stroke="' + INK + '" stroke-width="1"/>'); // small chest patch
      if (big) { // spray piece on the chest: outlined orange letters-like shapes + drips + star
        P('M79 112 Q84 104 92 108 Q96 101 104 106 Q110 100 118 105 Q123 110 119 117 Q122 124 113 125 Q104 130 96 125 Q86 129 81 122 Q75 118 79 112 Z', OR, S(1.8));
        LN('M86 113 Q89 109 92 114 Q95 119 98 113 M101 112 Q104 108 107 113 Q110 118 113 112', BLK, 2.2);
        LN('M90 126 v7 M104 128 v9 M114 124 v5', OR, 2.4); o.push('<circle cx="104" cy="139" r="1.7" fill="' + OR + '"/>');
        P('M123 98 l1.6 3.4 3.6 .5 -2.6 2.5 .6 3.6 -3.2 -1.7 -3.2 1.7 .6 -3.6 -2.6 -2.5 3.6 -.5Z', WH);
      }
    } else if (top === 'track' || top === 'trackGold') {
      const gold = top === 'trackGold', col = gold ? BLK : OR, trim = gold ? GOLD : WH;
      const body = 'M70 93 Q74 87 84 85 L116 85 Q126 87 130 93 L129 148 L71 148 Z';
      P(body, col, S()); P(body, 'url(#' + id + 'sh)');
      if (!gold) P('M70 93 Q74 87 84 85 L116 85 Q126 87 130 93 L130 106 Q100 112 70 106 Z', BLK); // contrast yoke
      LN('M70 106 Q100 112 130 106', trim, 1.6);
      // stand collar
      P('M85 84 L86 76 Q100 80 114 76 L115 84 Q100 90 85 84 Z', gold ? BLK2 : BLK, S(1.6));
      LN('M86.5 80 Q100 84 113.5 80', trim, 1.2);
      // zip with teeth and pull
      LN('M100 86 V146', '#0A0A0C', 2.6); LN('M100 86 V146', gold ? '#E7B23C' : '#9A968E', 1, ' stroke-dasharray="1 1.2"');
      P('M98 96 h4 v8 q0 2 -2 2 q-2 0 -2 -2 Z', gold ? GOLD : '#C9C5BD', S(1));
      // slash pockets
      LN('M80 128 L86 140 M120 128 L114 140', 'rgba(0,0,0,.45)', 1.6);
      // rib hem
      P('M71 141 L129 141 L129 149 Q100 152 71 149 Z', gold ? BLK2 : BLK, S(1.6));
      LN('M76 142 v6 M82 142 v6.5 M88 142 v7 M94 142 v7 M106 142 v7 M112 142 v7 M118 142 v6.5 M124 142 v6', 'rgba(255,255,255,.1)', .8);
      if (gold) { // embroidered laurel badge (no brand)
        o.push('<circle cx="114" cy="100" r="5.5" fill="none" stroke="' + GOLD + '" stroke-width="1.4"/>');
        LN('M110.5 102 Q111 97 114 95.5 M117.5 102 Q117 97 114 95.5', '#E7B23C', 1);
        o.push('<circle cx="114" cy="100.5" r="1.4" fill="#E7B23C"/>');
        LN('M71 112 Q72 130 71 140 M129 112 Q128 130 129 140', GOLD, 1.6);
      }
    } else if (top === 'bomber') {
      const body = 'M68 93 Q73 87 84 85 L116 85 Q127 87 132 93 L131 146 Q100 151 69 146 Z';
      P(body, BLK, S()); P(body, 'url(#' + id + 'sh)');
      // satin shine
      LN('M80 98 Q78 118 82 138', 'rgba(255,255,255,.1)', 3); LN('M122 98 Q124 118 120 138', 'rgba(255,255,255,.06)', 3);
      // striped rib collar
      P('M84 85 Q100 98 116 85 L114 82 Q100 92 86 82 Z', BLK2, S(1.6));
      LN('M85 84.2 Q100 95 115 84.2', OR, 1.4);
      // zip + rib hem with stripes
      LN('M100 92 V140', '#0A0A0C', 2.4); LN('M100 92 V140', '#9A968E', .9, ' stroke-dasharray="1 1.2"');
      P('M69 139 L131 139 L131 148 Q100 153 69 148 Z', BLK2, S(1.6));
      LN('M70 142.5 Q100 146.5 130 142.5', OR, 1.4); LN('M70 145.5 Q100 149.5 130 145.5', WH, 1);
      // patches: round star patch, flag-like patch, name tape
      o.push('<circle cx="86" cy="106" r="7" fill="' + OR + '" stroke="' + INK + '" stroke-width="1.4"/><circle cx="86" cy="106" r="5.4" fill="none" stroke="' + WH + '" stroke-width=".8" stroke-dasharray="1 1"/>');
      P('M86 101.5 l1.3 2.8 3 .4 -2.2 2.1 .5 3 -2.6 -1.4 -2.6 1.4 .5 -3 -2.2 -2.1 3 -.4Z', BLK);
      P('M108 100 h14 v9 h-14 Z', WH, S(1.2)); P('M108 100 h14 v3 h-14 Z', OR); P('M108 106 h14 v3 h-14 Z', BLK);
      P('M105 120 h18 v5 h-18 Z', '#2E2E34', S(1)); LN('M107 122.5 h14', OR, 1.2, ' stroke-dasharray="2 1.2"');
      // slash pockets
      LN('M78 124 L82 136 M122 124 L118 136', 'rgba(255,255,255,.15)', 1.6);
    }

    // ---- champion belt (8) ----
    if (L >= 8) {
      P('M68 140 L132 140 L132 151 L68 151 Z', '#1C1C20', S(1.8));
      LN('M70 142.5 H130 M70 148.5 H130', GOLD, .9, ' stroke-dasharray="1.6 1.4"');
      o.push('<ellipse cx="100" cy="145.5" rx="18" ry="12" fill="' + GOLD + '" stroke="' + INK + '" stroke-width="1.8"/><ellipse cx="100" cy="145.5" rx="13" ry="8" fill="none" stroke="#8A5E12" stroke-width="1"/>');
      P('M100 139 l1.9 4 4.4 .5 -3.2 3 .9 4.3 -4 -2.2 -4 2.2 .9 -4.3 -3.2 -3 4.4 -.5Z', '#8A5E12');
      [[76, 145.5], [124, 145.5]].forEach(p => o.push('<rect x="' + (p[0] - 5) + '" y="' + (p[1] - 4.5) + '" width="10" height="9" rx="2" fill="' + GOLD + '" stroke="' + INK + '" stroke-width="1.2"/><circle cx="' + p[0] + '" cy="' + p[1] + '" r="1.8" fill="#C0392B"/>'));
    }

    // ---- neck ----
    P('M92 72 L108 72 L108 86 Q100 90 92 86 Z', SKIN_D, S(1.6));

    // ---- headphones round the neck (4, 5) ----
    if (L === 4 || L === 5) {
      LN('M84 90 Q100 106 116 90', '#2A2A2F', 4.5);
      [[78, 84], [114, 84]].forEach(p => { P('M' + p[0] + ' ' + p[1] + ' h8 q3 0 3 3 v10 q0 3 -3 3 h-8 q-3 0 -3 -3 v-10 q0 -3 3 -3 Z', '#26262B', S(1.6)); o.push('<rect x="' + (p[0] + 1.5) + '" y="' + (p[1] + 3) + '" width="5" height="10" rx="2" fill="' + OR + '"/>'); });
      LN('M117 100 Q121 116 112 128', '#2A2A2F', 1.4);
    }

    // ---- chain (5+) ----
    if (L >= 5) {
      const big = L >= 7, pts = [];
      for (let i = 0; i <= 14; i++) { const t = i / 14, x = 88 + 24 * t, y = 88 + (big ? 30 : 22) * Math.sin(Math.PI * t); pts.push([x, y]); }
      pts.forEach((p, i) => o.push('<ellipse cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" rx="' + (big ? 2.2 : 1.6) + '" ry="' + (big ? 1.5 : 1.1) + '" transform="rotate(' + (i % 2 ? 40 : -40) + ' ' + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + ')" fill="' + GOLD + '" stroke="#7A5512" stroke-width=".5"/>'));
      if (big) {
        P('M100 116 L108 124 L100 134 L92 124 Z', GOLD, S(1.4));
        P('M100 119 L104.5 124 L100 130 L95.5 124 Z', '#FFF2C4', ' opacity=".55"');
        LN('M92 124 H108 M100 116 V134', '#8A5E12', .7);
      } else o.push('<circle cx="100" cy="111.5" r="3" fill="' + GOLD + '" stroke="#7A5512" stroke-width=".8"/>');
    }

    // ---- head ----
    o.push('<circle cx="77" cy="56" r="6" fill="' + SKIN + '" stroke="' + INK + '" stroke-width="2"/><circle cx="123" cy="56" r="6" fill="' + SKIN + '" stroke="' + INK + '" stroke-width="2"/>');
    LN('M76 54 Q78 57 76 59 M124 54 Q122 57 124 59', SKIN_D, 1.2);
    if (L >= 6) o.push('<circle cx="76" cy="61" r="1.7" fill="' + GOLD + '" stroke="#7A5512" stroke-width=".5"/>'); // stud earring
    P('M100 28 Q123 28 123 54 Q123 80 100 81 Q77 80 77 54 Q77 28 100 28 Z', SKIN, S());
    P('M80 64 Q86 78 100 80 Q90 76 84 64 Z', SKIN_D, ' opacity=".35"');
    // hair: short fade, visible under hats as sideburns
    if (!fit.hat) {
      P('M77 52 Q74 26 100 25 Q127 26 123 52 Q120 41 112 38 Q104 34 96 37 Q86 36 80 44 Z', HAIR, S(1.8));
      LN('M86 33 Q92 30 98 32 M102 31 Q110 30 116 34', '#3A2E28', 1.4);
    } else {
      P('M77.5 50 Q77 58 79 62 L80.5 62 Q80 56 80.5 50 Z M122.5 50 Q123 58 121 62 L119.5 62 Q120 56 119.5 50 Z', HAIR);
    }
    // ---- hats ----
    const hat = fit.hat;
    if (hat === 'cap' || hat === 'capGold' || hat === 'capBack') {
      const crown = hat === 'capGold' ? GOLD : hat === 'capBack' ? BLK : (L >= 3 ? BLK : BLK);
      const front = hat === 'capGold' ? GOLD : hat === 'capBack' ? OR : (L >= 3 ? OR : BLK);
      // crown (6 panels: front pair + sides)
      P('M75 50 Q74 22 100 21 Q126 22 125 50 Z', crown, S());
      if (hat !== 'capBack') P('M86 49 Q86 26 100 22 Q114 26 114 49 Z', front, S(1.4));
      LN('M100 22 V49', 'rgba(0,0,0,.35)', 1);
      LN('M80 46 Q80 31 88 25 M120 46 Q120 31 112 25', 'rgba(0,0,0,.3)', 1);
      o.push('<circle cx="100" cy="21.5" r="2.6" fill="' + (hat === 'capGold' ? BLK : OR) + '" stroke="' + INK + '" stroke-width="1.2"/>');
      [[82, 33], [118, 33]].forEach(p => o.push('<circle cx="' + p[0] + '" cy="' + p[1] + '" r="1.1" fill="#0A0A0C"/>'));
      if (hat === 'capBack') {
        // worn backwards: snap strap + opening on the forehead, no brim in front
        P('M90 50 Q90 40 100 39 Q110 40 110 50 Z', SKIN, S(1.4));
        P('M88 44 L112 44 L112 48 L88 48 Z', BLK2, S(1.2));
        [92, 96, 100, 104, 108].forEach(x => o.push('<circle cx="' + x + '" cy="46" r=".9" fill="#9A968E"/>'));
        P('M75 50 Q100 54 125 50 L125 52 Q100 56 75 52 Z', '#0A0A0C');
        // a little hair at the opening
        P('M91 44 Q100 38 109 44 L109 40 Q100 36 91 40 Z', HAIR);
      } else {
        // flat brim seen from the front, under-brim and the gold size sticker
        P('M66 52 Q100 42 134 52 Q138 54 136 57 Q100 49 64 57 Q62 54 66 52 Z', hat === 'capGold' ? BLK : (L >= 3 ? BLK : BLK), S(1.8));
        P('M64 57 Q100 49 136 57 Q100 53 64 57 Z', hat === 'capGold' ? '#3A2A0E' : '#2C3B2E');
        LN('M68 53.6 Q100 45 132 53.6', 'rgba(255,255,255,.18)', .8, ' stroke-dasharray="1.6 1.4"');
        o.push('<ellipse cx="118" cy="51.5" rx="4.2" ry="2.4" fill="' + GOLD + '" stroke="#7A5512" stroke-width=".6" transform="rotate(8 118 51.5)"/>');
        if (hat === 'cap' && L >= 3) LN('M92 34 Q100 30 108 34', BLK, 1.6); // a little front stitch arc
      }
    } else if (hat === 'beanie') {
      P('M76 50 Q74 20 100 19 Q126 20 124 50 Z', '#2A2A2F', S());
      LN('M86 46 Q86 28 94 22 M100 46 V20 M114 46 Q114 28 106 22 M80 46 Q79 32 86 24 M120 46 Q121 32 114 24', 'rgba(255,255,255,.1)', 1.2);
      P('M74 40 Q100 34 126 40 L126 52 Q100 47 74 52 Z', OR, S(1.8));
      for (let x = 78; x <= 122; x += 4) LN('M' + x + ' ' + (41 - Math.abs(100 - x) * -0.05) + ' v9', OR_D, 1.2);
      P('M105 42 h9 v6 h-9 Z', BLK, S(.8)); LN('M107 45 h5', WH, .8);
    } else if (hat === 'bucket') {
      P('M80 46 Q79 22 100 21 Q121 22 120 46 Z', BLK, S());
      LN('M80 40 Q100 36 120 40', OR, 1.2, ' stroke-dasharray="1.6 1.4"');
      LN('M100 22 V44', 'rgba(255,255,255,.12)', 1);
      P('M80 45 Q100 41 120 45 L134 58 Q100 50 66 58 Z', BLK, S(1.8));
      LN('M74 52 Q100 45 126 52 M70 55.5 Q100 48 130 55.5', OR, 1, ' stroke-dasharray="1.6 1.4"');
      o.push('<circle cx="86" cy="34" r="1" fill="#9A968E"/><circle cx="114" cy="34" r="1" fill="#9A968E"/>');
    }
    // ---- face ----
    const capped = hat === 'cap' || hat === 'capGold' || hat === 'bucket';
    if (capped) P('M80 57 Q100 51 120 57 Q100 55 80 60 Z', SKIN_D, ' opacity=".45"'); // brim shadow
    if (L >= 5) {
      const gold = L >= 7, fr = gold ? GOLD : '#111114';
      LN('M78 60 L122 60', gold ? '#B9831E' : INK, 2.2);
      [[80, 57], [102, 57]].forEach(p => {
        P('M' + p[0] + ' ' + p[1] + ' h18 q2 0 2 2 v5 q0 5 -6 5 h-8 q-6 0 -6 -6 v-4 q0 -2 2 -2 Z', 'url(#' + id + 'lens)', ' stroke="' + fr + '" stroke-width="2.2"');
        LN('M' + (p[0] + 4) + ' ' + (p[1] + 3) + ' l6 -1', '#fff', 1.6, ' opacity=".5"');
        LN('M' + (p[0] + 12) + ' ' + (p[1] + 7) + ' l3 -1', OR, 1.2, ' opacity=".6"');
      });
    } else {
      const lift = L >= 3 ? -1 : 0;
      LN('M85 ' + (52 + lift) + ' Q90 ' + (49 + lift) + ' 95 ' + (51 + lift) + ' M105 ' + (51 + lift) + ' Q110 ' + (49 + lift * 2) + ' 115 ' + (52 + lift), HAIR, 2.6);
      [[90, 58], [110, 58]].forEach(p => { o.push('<ellipse cx="' + p[0] + '" cy="' + p[1] + '" rx="3.6" ry="4" fill="#fff" stroke="' + INK + '" stroke-width="1.2"/><circle cx="' + (p[0] + .6) + '" cy="' + (p[1] + .6) + '" r="2.3" fill="' + INK + '"/><circle cx="' + (p[0] + 1.4) + '" cy="' + (p[1] - .6) + '" r=".8" fill="#fff"/>'); });
    }
    LN('M100 61 Q97 67 100 69 Q102 69 103 68', SKIN_D, 1.8);
    if (L >= 6) { P('M90 72 Q100 80 111 71 Q101 75 90 72 Z', '#fff', S(1.6)); }
    else if (L >= 3) LN('M92 73 Q101 77 110 71', INK, 2.2);
    else LN('M93 74 Q100 75 107 73', INK, 2.2);
    if (L >= 4) LN('M88 66 h0 M112 66 h0', SKIN_L, 0); // (cheek highlight placeholder kept tiny)

    // ---- sparkles (8) ----
    if (L >= 8) o.push('<g fill="#FFE38A"><path d="M40 40 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3Z"/><path d="M170 100 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2Z"/><path d="M34 120 l2 4 4 2 -4 2 -2 4 -2 -4 -4 -2 4 -2Z"/><path d="M168 30 l1.6 3.6 3.6 1.6 -3.6 1.6 -1.6 3.6 -1.6 -3.6 -3.6 -1.6 3.6 -1.6Z"/></g>');
    o.push('</svg>');
    return o.join('');
  }
  window.HERO = { LEVELS, NAMES, PERKS, RING, levelFor, svg };
})();
