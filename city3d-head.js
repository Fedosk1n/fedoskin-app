// Sculpted skulls and fitted headwear in Head bone space. Y is up, Z points towards the face.
import * as THREE from 'three';
import { mergePositions } from './city3d-perf.js?v=2';
import { CITY_ANATOMY } from './city3d-anatomy.js?v=2';
import { FINISH } from './city3d-character-finish.js?v=1';

const TAU = 2 * Math.PI;
const UP = new THREE.Vector3(0, 1, 0);
const HAT_SIDES = 32;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const smooth = (lo, hi, x) => {
  const t = clamp((x - lo) / (hi - lo), 0, 1);
  return t * t * (3 - 2 * t);
};
const bell = (x, w) => Math.exp(-((x / w) ** 2));

// Height, brow/nose side, nape side, half-width, position of the widest part.
const SKULL = [
  [-.048, .083, .054, .026, .069],
  [-.035, .108, .018, .048, .050],
  [-.015, .115, -.032, .066, .016],
  [.008, .117, -.066, .076, -.007],
  [.034, .123, -.095, .081, -.021],
  [.061, .127, -.116, .086, -.030],
  [.085, .125, -.125, .086, -.034],
  [.112, .123, -.131, .085, -.037],
  [.138, .124, -.132, .088, -.037],
  [.164, .118, -.129, .089, -.041],
  [.188, .098, -.119, .083, -.047],
  [.209, .071, -.103, .069, -.049],
  [.226, .040, -.084, .052, -.044],
  [.238, .012, -.063, .031, -.033],
  [.244, -.009, -.041, .014, -.025],
];
const HEAD_TOP = .246;
const HEADS = new Map(), HAIR = new Map(), CONTACTS = new WeakMap();

const FEATURES = [
  { jaw: .96, cheek: 1.04, chin: .003, noseWidth: .92, noseHeight: -.001, noseDepth: 1.09,
    eyeWidth: 1.01, eyeHeight: 0, eyeOpen: 1, eyeTilt: .0015, browArch: .0048,
    mouthWidth: 1, mouthHeight: 0, lipDepth: 1, iris: '#694630' },
  { jaw: 1.06, cheek: 1.10, chin: -.006, noseWidth: 1.18, noseHeight: .003, noseDepth: .81,
    eyeWidth: 1.06, eyeHeight: -.0015, eyeOpen: 1.14, eyeTilt: .0005, browArch: .0055,
    mouthWidth: .94, mouthHeight: .0015, lipDepth: 1.24, iris: '#56412A' },
  { jaw: 1.14, cheek: .97, chin: .009, noseWidth: 1.05, noseHeight: -.003, noseDepth: 1.18,
    eyeWidth: .96, eyeHeight: .001, eyeOpen: .84, eyeTilt: .0023, browArch: .0027,
    mouthWidth: 1.16, mouthHeight: -.0015, lipDepth: .90, iris: '#626354' },
  { jaw: .87, cheek: 1.03, chin: -.002, noseWidth: .88, noseHeight: .002, noseDepth: .94,
    eyeWidth: 1.10, eyeHeight: .002, eyeOpen: .92, eyeTilt: .0027, browArch: .0064,
    mouthWidth: 1.07, mouthHeight: -.001, lipDepth: 1.12, iris: '#725241' },
];

function profileOf(girl, type, faceId, old) {
  const frame = /^(slim|lanky)$/.test(type) ? 'narrow' : /^(heavy|stocky|big)$/.test(type) ? 'broad' : 'middle';
  const temple = frame === 'narrow' ? .95 : frame === 'broad' ? 1.04 : 1;
  const jaw = (frame === 'narrow' ? .89 : frame === 'broad' ? 1.1 : 1) * (girl ? .93 : 1);
  const nose = (frame === 'narrow' ? .92 : frame === 'broad' ? 1.12 : 1) * (girl ? .95 : 1);
  const frameKey = (girl ? 'f-' : 'm-') + frame;
  const identity = Number.isInteger(faceId) && faceId >= 0 && faceId < FEATURES.length ? faceId : 0;
  return { key: frameKey + identity + (old ? '-old' : ''), frameKey, girl, temple, jaw, nose, features: FEATURES[identity], old };
}

function skullSlice(y, profile) {
  if (y >= .244) {
    const t = smooth(.244, HEAD_TOP, y);
    return [y, -.009 - .016 * t, -.041 + .016 * t, .014 * (1 - t), -.025];
  }
  let i = 1;
  while (i < SKULL.length - 1 && SKULL[i][0] < y) i++;
  const a = SKULL[i - 1], b = SKULL[i], prev = SKULL[Math.max(0, i - 2)], next = SKULL[Math.min(i + 1, SKULL.length - 1)];
  const span = b[0] - a[0], t = clamp((y - a[0]) / span, 0, 1), mix = t*t*(3 - 2*t);
  const s = a.map((v, j) => {
    if (j === 0) return y;
    const entering = (b[j] - prev[j]) / (b[0] - prev[0]), leaving = (next[j] - v) / (next[0] - a[0]);
    return THREE.MathUtils.lerp(v, b[j], mix) + span*t*(1-t)*(entering*(1-t) - leaving*t);
  });
  const upper = smooth(.004, .095, y);
  s[3] *= (1 - upper) * profile.jaw + upper * profile.temple;
  if (profile.features) {
    const {jaw, cheek, chin} = profile.features;
    s[3] *= 1 + (jaw - 1) * bell(y-.012,.042) + (cheek - 1) * bell(y-.072,.030);
    s[1] += chin * bell(y+.007,.028);
  }
  return s;
}

function outline(slice, angle, frontPower = .89, sidePower = .91) {
  const [y, front, back, width, mid] = slice;
  const c = Math.cos(angle), s = Math.sin(angle);
  const x = Math.sign(c) * Math.abs(c) ** sidePower * width;
  const z = s >= 0 ? mid + (front - mid) * s ** frontPower : mid - (mid - back) * (-s) ** .87;
  return [x, y, z];
}

function facePoint(slice, angle, profile) {
  const p = outline(slice, angle, .69 + .24 * smooth(.102, .163, slice[0]));
  const [x, y] = p, front = Math.max(0, Math.sin(angle)), f2 = front ** 3;
  const shadow = .81 + .19 * smooth(-.039, .029, y);
  const { cols, rows, xStep, yStep, yStart, samples } = CITY_ANATOMY.face;
  const center = 1 - smooth(.020, .041, Math.abs(x));
  const nose = smooth(.034, .046, y) * (1 - smooth(.094, .112, y));
  const lip = smooth(.007, .015, y) * (1 - smooth(.033, .041, y));
  const eye = smooth(.083,.094,y) * (1 - smooth(.126,.142,y)) * smooth(.019,.028,Math.abs(x));
  const features = profile.features;
  const width = 1 + center * ((profile.nose * features.noseWidth - 1) * nose + (features.mouthWidth - 1) * lip);
  const height = y - center*(nose*features.noseHeight + lip*features.mouthHeight) - eye*features.eyeHeight;
  const u = Math.abs(x) / (xStep * width), v = (height - yStart) / yStep;
  if (f2 === 0 || u >= cols - 1 || v < 0 || v >= rows - 1) return [...p, [shadow, shadow, shadow]];
  const i = Math.floor(u), j = Math.floor(v), sx = u - i, sy = v - j;
  const k = (j * cols + i) * 4, stride = cols * 4;
  const sample = channel => {
    const a = k + channel;
    const top = THREE.MathUtils.lerp(samples[a], samples[a+4], sx);
    const bottom = THREE.MathUtils.lerp(samples[a+stride], samples[a+stride+4], sx);
    return THREE.MathUtils.lerp(top, bottom, sy) * f2 / 10000;
  };
  const depth = 1 + center * (nose * (features.noseDepth - 1) + lip * (features.lipDepth - 1));
  p[2] += sample(0) * depth * (profile.girl ? .94 : 1);
  const fold = profile.old ? bell(Math.abs(x) - (.024 + (.049-y)*.43),.0029)*bell(y-.035,.013) : 0;
  const eyeCrease = profile.old ? bell(Math.abs(x)-.047,.012)*bell(y-.091,.0019) : 0;
  p[2] -= f2 * (.0011*fold + .0007*eyeCrease);
  return [...p, [1, 2, 3].map(channel => shadow * (1 + sample(channel) - f2*(.095*fold + .081*eyeCrease)))];
}

function rings(rows, segments, sample, capTop = null, capBottom = null) {
  const pos = [], rgb = [], faces = [];
  const point = ([x, y, z, tone = 1]) => {
    pos.push(x, y, z);
    if (Array.isArray(tone)) rgb.push(...tone);
    else rgb.push(tone, tone, tone);
  };
  for (const row of rows) {
    for (let i = 0; i < segments; i++) point(sample(row, i * TAU / segments));
  }
  for (let row = 0; row < rows.length - 1; row++) {
    for (let i = 0; i < segments; i++) {
      const a = row * segments + i, b = row * segments + (i + 1) % segments;
      faces.push(a, a + segments, b, b, a + segments, b + segments);
    }
  }
  if (capTop) {
    const pole = pos.length / 3, last = (rows.length - 1) * segments;
    point(capTop);
    for (let i = 0; i < segments; i++) faces.push(pole, last + (i + 1) % segments, last + i);
  }
  if (capBottom) {
    const pole = pos.length / 3;
    point(capBottom);
    for (let i = 0; i < segments; i++) faces.push(pole, i, (i + 1) % segments);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(rgb, 3));
  geo.setIndex(faces);
  geo.computeVertexNormals();
  return geo;
}

function skinGeometry(profile) {
  const ys = [...new Set([...SKULL.map(row => row[0]), -.025, -.004, .004, .012, .016, .018, .020, .0215,
    .023, .0245, .026, .028, .031, .035, .040, .043, .0455, .0475, .0495, .052, .056, .060, .067, .073, .079,
    .090, .094, .098, .102, .106, .110, .116, .123, .130])].sort((a, b) => a - b);
  // Give the central face more samples without adding vertices at the nape.
  const faceAngle = angle => angle + .55 * Math.cos(angle);
  const columns = 72;
  const skin = rings(ys.map(y => skullSlice(y, profile)), columns,
    (s, a) => facePoint(s, faceAngle(a), profile), [0, HEAD_TOP, -.025], [0, -.05, .068, .77]);
  // The small rows around the lips and nostrils shouldn't make creases on the sides of the head.
  const {position, normal} = skin.attributes;
  const center = new THREE.Vector3(), up = new THREE.Vector3(), around = new THREE.Vector3(), next = new THREE.Vector3();
  for (let row = 1; row < ys.length - 1; row++) {
    for (let i = 0; i < columns; i++) {
      const offset = row * columns, index = offset + i;
      center.fromBufferAttribute(position,index);
      up.fromBufferAttribute(position,index-columns).sub(center).negate().normalize();
      up.add(next.fromBufferAttribute(position,index+columns).sub(center).normalize());
      around.fromBufferAttribute(position,offset+(i+1)%columns)
        .sub(next.fromBufferAttribute(position,offset+(i+columns-1)%columns));
      up.cross(around).normalize();
      normal.setXYZ(index,up.x,up.y,up.z);
    }
  }
  return skin;
}

function faceZ(x, y, profile) {
  const s = skullSlice(y, profile);
  const a = Math.acos(clamp(Math.abs(x) / s[3], 0, 1) ** (1 / .91));
  return facePoint(s, a, profile)[2];
}

function colouredSurface(positions, colors, indices) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function facePatch(columns, rows, point, flip = false) {
  const positions = [], colors = [], indices = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < columns; i++) {
      const [x, y, z, color] = point(i / (columns-1), j / (rows-1));
      positions.push(x, y, z);
      colors.push(...color);
      if (i < columns-1 && j < rows-1) {
        const a = j * columns + i, b = a + columns;
        if (flip) indices.push(a, b, a+1, a+1, b, b+1);
        else indices.push(a, a+1, b, a+1, b+1, b);
      }
    }
  }
  return colouredSurface(positions, colors, indices);
}

function eyeGeometry(side, profile) {
  const { features } = profile;
  const cx = side * .035 * profile.temple, cy = .102 + features.eyeHeight;
  const width = (profile.girl ? .0156 : .0150) * features.eyeWidth;
  const aperture = features.eyeOpen * (profile.old ? .87 : 1);
  const shape = u => {
    const taper = Math.sqrt(Math.max(.0002, 1 - u*u));
    const center = cy + side * u * features.eyeTilt;
    const upper = taper * (profile.girl ? .00555 : .0050) * aperture * (1 - .16 * side * u);
    const lower = taper * .00415 * aperture * (1 + .20 * side * u);
    return { taper, center, upper, lower };
  };
  const surface = (x, y) => {
    const { taper, center, upper, lower } = shape(clamp((x - cx) / width, -1, 1));
    const v = clamp((y - center) / (y >= center ? upper : lower), -1, 1);
    return faceZ(x, y, profile) + .0011 + .0034 * taper * Math.sqrt(1 - v*v);
  };
  const white = facePatch(21, 7, (s, t) => {
    const u = 2*s-1, { center, upper, lower } = shape(u);
    const x = cx + u*width, y = center - lower + t*(upper + lower);
    const inner = smooth(.40, 1, -side*u), top = smooth(.76, 1, t);
    const tone = 1 - .13*top - .16*inner;
    return [x, y, surface(x, y), [tone, tone - .07*inner, tone - .06*inner]];
  });
  const iris = rings([.006,.37,.44,.49,.62,.80,.93,1], 24, (r, a) => {
    const x = cx + .0003 + .00565*r*Math.cos(a);
    const { center, upper, lower } = shape((x-cx)/width);
    const py = cy + .00035 + .00565*r*Math.sin(a);
    const y = clamp(py, center - lower + .00018, center + upper - .00018);
    const grain = Math.sin(11*a + .7) * .13 + Math.cos(17*a) * .12;
    const pupil = r < .45;
    const tone = pupil ? .075 : (1.13 - .64*smooth(.79, 1, r) + grain) * (1 - .24*smooth(.4, 1, Math.sin(a)));
    return [x, y, surface(x,y) + .00064, pupil ? [tone, tone, tone] : [tone*1.13, tone, tone*.90]];
  }, null, [cx+.0003, cy+.00035, surface(cx+.0003,cy+.00035)+.00064, .075]);
  const glint = new THREE.CircleGeometry(.0010, 10)
    .translate(cx - .00125, cy + .00172, surface(cx-.00125, cy+.00172) + .00118);
  const lids = [1, -1].map(sign => facePatch(21, 4, (s, t) => {
    const u = 2*s-1, { taper, center, upper, lower } = shape(u);
    const x = cx + width*u;
    const y = center + sign*((sign > 0 ? upper : lower) + t*taper*(sign > 0 ? .0036 : .0027));
    const tone = 1 - taper*(sign > 0 ? .41 : .23)*(1 - t)**2;
    const lift = .0010*(1-t) + Math.sin(t*Math.PI)*taper*(sign > 0 ? .0021 : .0014) - .00055*t;
    return [x, y, faceZ(x,y,profile) + lift, [tone, tone*.985, tone*.973]];
  }, sign < 0));
  const brow = facePatch(19, 3, (s, t) => {
    const x = cx + side*.034*(s-.48);
    const arch = Math.sin(s * Math.PI) ** 1.1;
    const center = cy + .0185 + (features.browArch + (profile.girl ? .0012 : 0))*arch + .0023*s - .0048*s**4;
    const half = (.00025 + (.66 + .34*arch)*Math.sin(s*Math.PI)**.64*(profile.girl ? .00175 : .0024))*(1-.74*s**2.5);
    const y = center + (2*t-1)*half;
    const strands = .90 + .10*t + .08*Math.cos(s*81 - t*1.42);
    return [x, y, faceZ(x,y,profile)+.0018+.00058*Math.sin(t*Math.PI), [strands,strands,strands]];
  }, side < 0);
  return {white, iris, glint, lids, brow};
}

function beardGeometry(skin, profile) {
  const geo = skin.clone(), pos = geo.attributes.position, n = geo.attributes.normal, weights = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const line = .042 + .031 * smooth(.028, .072, Math.abs(x));
    const lips = (1 - smooth(.021, .034, Math.abs(x)/profile.features.mouthWidth))
      * bell(y - .024 - profile.features.mouthHeight, .0115);
    const w = (1 - smooth(line - .006, line + .005, y)) * smooth(-.06, -.041, z) * (1 - lips);
    const grain = Math.sin(x*806 + y*363) * Math.cos(y*732);
    const rise = -.0026 + (.0083 + .0011*grain) * w;
    weights.push(w);
    pos.setXYZ(i, x + n.getX(i) * rise, y + n.getY(i) * rise, z + n.getZ(i) * rise);
  }
  const faces = [];
  const idx = geo.index.array;
  for (let i = 0; i < idx.length; i += 3) {
    if (Math.max(weights[idx[i]], weights[idx[i + 1]], weights[idx[i + 2]]) > .2) faces.push(idx[i], idx[i + 1], idx[i + 2]);
  }
  geo.setIndex(faces);
  geo.deleteAttribute('color');
  geo.computeVertexNormals();
  return geo;
}

function faceGeometry(profile) {
  if (HEADS.has(profile.key)) return HEADS.get(profile.key);
  const skin = skinGeometry(profile);
  const face = { skin, eyes: [-1, 1].map(side => eyeGeometry(side, profile)) };
  HEADS.set(profile.key, face);
  return face;
}

function scalp(profile, style, openBandana = false) {
  const key = profile.frameKey + style + (openBandana ? '-bandana' : '');
  if (HAIR.has(key)) return HAIR.get(key);
  const shell = {...profile, features: FEATURES[0], old: false};
  const covered = style === 'underHat';
  const shear = style === 'buzz' || covered;
  const wave = style === 'curly' || style === 'afro' || /Locs$/.test(style);
  const volume = { buzz: .003, underHat: .002, short: .018, curly: .027, afro: .045, top: .039, longLocs: .016, tiedLocs: .022 };
  const height = volume[style] || .013;
  const sections = covered ? [0,.035,.09,.17,.27,.4] : [0,.028,.068,.12,.18,.26,.35,.44,.53,.63,.72,.81,.89,.95,.98,.994];
  const g = rings(sections, covered ? 32 : 48, (t, a) => {
    const sn = Math.sin(a), front = Math.max(0, sn), back = Math.max(0, -sn);
    let y = .102 + .052 * front ** 1.5 - .057 * back ** 1.45;
    if (!shear) y += .011 * front * Math.cos(a * 2 - .6) + .005 * Math.sin(a * 3 + .5);
    if (!covered) {
      const temples = Math.exp(-(((front-.43)/.29)**2));
      y += .0065*temples + (.0017*Math.cos(11*a) + .0013*Math.sin(15*a+.9))*(.44+.56*front);
    }
    const p = facePoint(skullSlice(y + (HEAD_TOP - y) * t, shell), a, shell);
    const crest = smooth(.03, .56, t);
    const phase = a + .55*t + .21*Math.sin(2*a+3*t);
    const strand = Math.cos((wave ? 13 : 9)*phase + .28*Math.cos(15*t));
    const ripple = Math.sin(Math.PI*t)*(wave ? .0039 : .0026)*(strand + .43*Math.cos(2.0*a - t*15));
    const lobe = wave ? (.0045 + .0047*Math.cos(a*9 + 11*t)) * Math.sin(Math.PI*t) : 0;
    const side = covered ? .0038 : shear ? .0026 : style === 'afro' ? .019 : .007;
    const lift = side + lobe + (shear ? 0 : .006*crest+ripple);
    p[0] += Math.cos(a) * lift * Math.sqrt(1 - t) + (style === 'short' ? .008 * smooth(.72, .99, t) : 0);
    p[2] += sn * lift * Math.sqrt(1 - t);
    p[1] += height * crest + lobe + (shear ? 0 : ripple*.86);
    if (openBandana) {
      const [edge, width] = locsBandFit(a);
      const fit = (p[1] - edge) / width;
      if (fit > -.15 && fit < 1.18) {
        const [x,,z] = locsBandPoint(clamp(fit,0,1),a,shell);
        const c = Math.cos(a);
        const tuck = Math.max(0, (p[0]-x)*c + (p[2]-z)*sn + .003)
          * smooth(-.15,.06,fit) * (1-smooth(.98,1.18,fit));
        p[0] -= c * tuck;
        p[2] -= sn * tuck;
      }
    }
    const rootShade = shear ? .92 : .73 + .19*smooth(.0,.15,t);
    return [p[0],p[1],p[2],rootShade + .08*crest + (shear ? .025 : .115)*strand*Math.sin(Math.PI*t)];
  }, covered ? null : [style === 'short' ? .008 : 0, HEAD_TOP + height, -.025, .97]);
  HAIR.set(key, g);
  return g;
}

// Each crown has its own cut. The short fronts and longer backs fit the skull in profile.
const cap = [
  [.116,.132,-.142,.098,-.021], [.128,.135,-.145,.100,-.021], [.169,.138,-.145,.101,-.023],
  [.204,.129,-.139,.099,-.028], [.231,.104,-.123,.089,-.033], [.249,.064,-.093,.071,-.035],
  [.255,.028,-.071,.045,-.029], [.257,-.002,-.046,.022,-.025],
];
const beanie = [
  [.137,.134,-.148,.102,-.025], [.155,.134,-.15,.103,-.030], [.187,.121,-.145,.103,-.036],
  [.220,.094,-.132,.096,-.039], [.247,.052,-.105,.080,-.039], [.260,.019,-.072,.056,-.035],
  [.264,-.008,-.052,.029,-.031],
];
const knitCuff = [
  [.104,.131,-.143,.098,-.022], [.109,.136,-.149,.103,-.022], [.131,.139,-.152,.105,-.023],
  [.148,.137,-.153,.104,-.025], [.153,.133,-.148,.101,-.027],
];
// The round bucket profile follows a single axis from the underside of its brim to its crown.
const BUCKET_Z = -.006, BUCKET_TOP = .262, BUCKET_X = .94;
const bucketProfile = [
  [.14, .13], [.168, .114], [.2, .096], [.206, .102], [.196, .111], [.166, .131], [.139, .148],
  [.137, .17], [.133, .2], [.123, .23], [.104, .249], [.07, .259],
];
const bucketBand = [[.1405, .149], [.141, .153], [.140, .167], [.1395, .171]];
const roundBucket = ([radius, y], a) => [radius * Math.cos(a) * BUCKET_X,
  y + .004 * smooth(.141, .205, radius) * Math.sin(3*a+.35), BUCKET_Z + radius * Math.sin(a)];

function threadGeometry(paths, radius, density = 1) {
  const identity = new THREE.Matrix4().elements;
  const threads = paths.map(path => new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(path.map(([x,y,z]) => new THREE.Vector3(x,y,z))), Math.max(4,path.length*density), radius, 4));
  const geometry = mergePositions(threads.map(geo => ({geo,e:identity})));
  for (const thread of threads) thread.dispose();
  geometry.computeVertexNormals();
  return geometry;
}

const angles = n => Array.from({ length: n+1 }, (_, i) => i * TAU / n);

function capPoint(row, a, backwards = false) {
  const p = outline(row, a, .74, .9);
  const front = Math.max(0, Math.sin(a));
  const edge = 1 - smooth(.155, .243, row[0]);
  const panel = Math.sin((a - Math.PI/2) * 3) ** 2;
  const loft = .0022 * panel * smooth(.12, .169, row[0]) * (1 - smooth(.23,.257,row[0]));
  p[0] += Math.cos(a) * loft;
  p[2] += Math.sin(a) * loft;
  p[1] += .021 * front * edge;
  if (backwards) p[1] += .028 * front**21 * (1 - smooth(.116,.176,row[0]));
  return [...p, .87 + .15*panel];
}

function cloth(rows, type, top) {
  const fine = type === 'cuff';
  return rings(rows, fine ? 84 : HAT_SIDES, (row, a) => {
    const c = Math.cos(a), s = Math.sin(a);
    const p = outline(row, a, .74, .9);
    const edge = 1 - smooth(.155, .243, row[0]);
    p[1] += .017 * s * edge + .006 * Math.sin(2 * a + .65) * edge;
    const rib = Math.cos((fine ? 28 : 7) * a);
    const fold = 1 + .11*Math.sin(2*a + row[0]*95);
    const depth = (fine ? .0018 : .00145) * rib * fold;
    p[0] += c * depth;
    p[2] += s * depth;
    const hem = fine ? smooth(.11,.122,row[0]) * (1-smooth(.143,.155,row[0])) : 1;
    return [...p, .76 + .19*hem + .105*rib];
  }, top);
}

function capParts() {
  const crown = rings(cap, HAT_SIDES, capPoint, [0, .257, -.024]);
  const back = rings(cap, HAT_SIDES, (row,a) => capPoint(row,a,true), [0, .257, -.024]);
  const solids = [[], []], idx = crown.index.array;
  const wallLength = (cap.length - 1) * HAT_SIDES * 6;
  for (let i = 0; i < idx.length; i += 3) {
    const segment = i < wallLength ? Math.floor(i / 6) % HAT_SIDES : (i - wallLength) / 3;
    const front = Math.abs(segment + .5 - HAT_SIDES / 4) < 3.6;
    solids[Number(front)].push(idx[i], idx[i + 1], idx[i + 2]);
  }
  const stitch = reversed => threadGeometry(
    Array.from({length:6}, (_,i) => Math.PI/2+i*TAU/6).flatMap(a => [-.022,.022].map(delta => cap.map(row => {
      const p = capPoint(row,a+delta,reversed);
      return [p[0]+.001*Math.cos(a), p[1]+.00085, p[2]+.001*Math.sin(a)];
    }))), .00078);
  return { crown, back, stitch: stitch(false), backStitch: stitch(true),
    panels: solids.map(index => crown.clone().setIndex(index)) };
}

const BRIMS = {
  cap: capParts(),
  beanie: [cloth(beanie, 'knit', [0, .266, -.03]), cloth(knitCuff, 'cuff')],
  bucket: [rings(bucketProfile, 40, roundBucket, [0, BUCKET_TOP, BUCKET_Z]), rings(bucketBand, 40, roundBucket)],
};
const BUCKET_STITCH = threadGeometry([[.174,.1265],[.186,.119],[.197,.112],[.142,.155],[.141,.165]]
  .map(row => angles(36).map(a => roundBucket(row,a))), .00105);
const BUCKET_BINDING = threadGeometry([angles(42).map(a => roundBucket([.204,.102],a))], .0026);
const billCurve = (x, z) => -.011 * (Math.abs(x)/.10)**2 - .005*smooth(.13,.228,z);
const BILL = (() => {
  const shape = new THREE.Shape();
  shape.moveTo(-.075, .088);
  shape.quadraticCurveTo(0, .122, .075, .088);
  shape.quadraticCurveTo(.110, .179, .076, .216);
  shape.quadraticCurveTo(0, .248, -.076, .216);
  shape.quadraticCurveTo(-.110, .179, -.075, .088);
  const g = new THREE.ExtrudeGeometry(shape, { depth: .007, bevelSize: .003, bevelThickness: .002, bevelSegments: 1, curveSegments: 5 });
  g.rotateX(Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i,p.getY(i)+billCurve(p.getX(i),p.getZ(i)));
  g.computeVertexNormals();
  return g;
})();
const BILL_STITCH = threadGeometry([1,.87].map(r => [
  [-.075,.124],[-.080,.166],[-.061,.205],[0,.221],[.061,.205],[.080,.166],[.075,.124],
].map(([x,z]) => [x*r,.0019+billCurve(x*r,.09+(z-.09)*r),.09+(z-.09)*r])), .00085);
const CAP_HOLE = new THREE.CircleGeometry(.0019, 10);
const EYELET = new THREE.TorusGeometry(.00255, .00074, 4, 10);
const ADJUSTER = new THREE.BoxGeometry(.061,.013,.007,3,2,1);
const ADJUSTER_LOOP = threadGeometry([[[-.008,-.006,0],[-.008,.006,0],[.008,.006,0],[.008,-.006,0],[-.008,-.006,0]]],.0014);

function bandanaPoint(t, a, rise = 0) {
  const s = Math.sin(a), c = Math.cos(a);
  const edge = .113 + .035 * Math.max(0, s) - .017 * Math.max(0, -s) + .005 * Math.sin(a * 2 + .4);
  const y = edge + (.246 - edge) * t;
  const p = outline(skullSlice(y, { temple: 1.085, jaw: 1.09 }), a);
  const slack = (.007 + .003 * Math.sin(a * 3 + t * 6) * (1 - t)) * Math.sqrt(1 - t) + rise;
  p[0] += c * slack;
  p[2] += s * slack;
  p[1] += .009 * smooth(.05, 1, t) + rise * t;
  return [...p, t < .08 ? .77 + t * 2.4 : .94 + .052 * Math.sin(a * 3 + t * 5)];
}
const WRAP = rings([0,.035,.08,.17,.31,.46,.60,.74,.86,.95,.99], 40, (t, a) => bandanaPoint(t, a), [0,.255,-.025]);
const PRINT = (() => {
  const pos = [], faces = [];
  for (const [t, a] of [[.33,.25],[.39,1.21],[.30,2.26],[.38,3.22],[.44,4.33],[.30,5.35],[.69,.65],[.73,2.55],[.72,4.57]]) {
    const i = pos.length / 3;
    for (const [dt, da] of [[-.064,0],[0,.084],[.064,0],[0,-.084]]) pos.push(...bandanaPoint(t + dt, a + da, .0017).slice(0, 3));
    faces.push(i, i + 2, i + 1, i, i + 3, i + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(faces);
  g.computeVertexNormals();
  return g;
})();
const BANDANA_HEM = threadGeometry([.038,.092].map(t => angles(48).map(a => bandanaPoint(t,a,.0017))), .00095);
const BANDANA_PAISLEY = threadGeometry(
  [1.05,2.13,3.14,4.64,5.75].flatMap((angle,i) => {
    // Mirror the teardrops around the crown so the cloth reads from the back as well.
    const side = i % 2 === 0 ? 1 : -1;
    return [1,.63].map(r => [
      [.18,.02],[.14,.14],[.27,.25],[.52,.18],[.61,-.085],[.42,-.025],[.23,-.15],[.18,.02],
    ].map(([t,a]) => bandanaPoint(.38+(t-.38)*r,angle+a*r*side,.00235)));
  }), .00115, 2);

function hasLocs(style) {
  return style === 'dreads' || style === 'longLocs' || style === 'tiedLocs';
}

const LOCS_BANDANAS = new Map();
function locsBandFit(a) {
  const s = Math.sin(a), front = Math.max(0, s), back = Math.max(0, -s);
  return [.117 + .025 * front - .019 * back + .003 * Math.sin(2 * a + .45),
    .025 + .014 * front - .006 * back];
}

// Folded cloth runs along the hairline and tapers above the ears toward the knot.
function locsBandPoint(t, a, profile, lift = 0) {
  const s = Math.sin(a), c = Math.cos(a);
  const front = Math.max(0, s), back = Math.max(0, -s);
  const [edge, width] = locsBandFit(a);
  const p = outline(skullSlice(edge + width * t, profile), a, .73);
  const fold = Math.cos(12 * t + 3 * a) * Math.sin(Math.PI * t);
  const clearance = .010 + .006 * (2*t-.8) * front + .013 * back + .0016 * fold + lift;
  p[0] += c * clearance;
  p[2] += s * clearance;
  return [...p, .88 + .09 * fold];
}

function locsBandana(profile) {
  if (LOCS_BANDANAS.has(profile.frameKey)) return LOCS_BANDANAS.get(profile.frameKey);
  const shell = { ...profile, features: FEATURES[0], old: false };
  const point = (t,a,lift) => locsBandPoint(t,a,shell,lift);
  const band = rings([
    [.035,-.003],[0,-.001],[.012,.001],[.075,.002],[.22,0],[.42,0],
    [.64,0],[.85,0],[.956,.001],[1,-.001],[.965,-.004],
  ], 64, ([t,lift],a) => point(t,a,lift));
  const seam = threadGeometry([.095,.89].map(t => angles(64).map(a => point(t,a,.0021))), .00072);
  const print = threadGeometry(Array.from({length: 14}, (_,i) => {
    const a = i * TAU / 14 + .045, side = i % 2 ? -1 : 1;
    return [
      [[.27,-.015],[.28,.060],[.42,.101],[.68,.041],[.77,-.073],[.59,-.037],[.42,-.080],[.27,-.015]],
      [[.49,.155],[.55,.178],[.46,.204],[.40,.179],[.49,.155]],
    ].map(path => path.map(([t,da]) => point(t,a+da*side,.0019)));
  }).flat(), .00066, 2);

  const angle = 5.82;
  const origin = new THREE.Vector3(...point(.44,angle,.005).slice(0,3));
  const knot = new THREE.SphereGeometry(1, 16, 12).scale(.013,.010,.008).rotateZ(.40);
  knot.translate(...origin.toArray());
  const ties = [-1,1].map(side => {
    const path = new THREE.CatmullRomCurve3([
      [0,0,0], [.009+side*.008,-.012,-.002],
      [.020+side*.014,-.028,-.009], [.022+side*.023,-.047+side*.009,-.016],
    ].map(p => new THREE.Vector3(...p).add(origin)));
    return rings([.025,.11,.24,.39,.52,.66,.79,.89,.96], 10, (t,a) => {
      const p = path.getPoint(t), tangent = path.getTangent(t);
      const across = new THREE.Vector3(.81,.09,-.58).projectOnPlane(tangent).normalize();
      const normal = across.clone().cross(tangent);
      const taper = 1 - .80 * smooth(.57,1,t);
      p.addScaledVector(across, Math.cos(a) * (.005 + .003 * t) * taper);
      p.addScaledVector(normal, (Math.sin(a) * .0013 + Math.cos(a * 2 + 3 * t) * .001) * taper);
      return [...p.toArray(), .83 + .15 * Math.sin(a + t * 3) ** 2];
    }, [...path.getPoint(1).toArray(),.81], [...origin.toArray(),.85]);
  });
  const parts = { band, seam, print, knot, ties };
  LOCS_BANDANAS.set(profile.frameKey, parts);
  return parts;
}

function earGeometry(side) {
  // The rim encircles the concha. The inner ridge splits above the canal and
  // the tragus projects at the front, before the cartilage gives way to the lobe.
  const n = 28, pos = [], color = [], idx = [];
  const rows = [.16, .32, .46, .58, .69, .80, .89, .97, 1, .87, .57, .22];
  const point = (x, y, z, tone) => {
    pos.push(x * side, y, z);
    color.push(Math.min(1.11, tone * 1.09), tone * .96, tone * .92);
  };
  for (const [row, r] of rows.entries()) {
    for (let i = 0; i < n; i++) {
      const a = i * TAU / n;
      const up = Math.cos(a), f = Math.sin(a);
      const y = r * up * (up >= 0 ? .029 : .025);
      const z = r * (.018 * f * (1 + .10 * up) - .006 * up);
      const root = .010 - .006 * f;
      const rim = .0088 * bell(r - .84, .14) * (.63 + .37 * smooth(-.025, .006, y));
      const branch = .0055 * bell(z + .005 + y * .13, .0039) * bell(r - .58, .25) * smooth(-.016, .007, y);
      const fork = .0042 * bell(z - .003 - .42 * y, .0038) * bell(y - .012, .0085);
      const tragus = .0075 * bell(z - .011, .0035) * bell(y + .005, .0055);
      const concha = bell(y + .001, .0105) * bell(z - .002, .0075);
      const canal = bell(y + .004, .0042) * bell(z - .005, .0037);
      const lobe = .007 * bell(y + .021, .0075) * bell(z - .002, .011);
      const back = row > 8;
      point(back ? root - (.020 * (1 - r)) : root + rim + branch + fork + tragus + lobe - .007 * concha - .003 * canal,
        y, z, back ? .89 : .96 + 7*rim + 11*branch - .32*concha - .17*canal - .07*(1-r));
    }
  }
  const tri = (a, b, c) => side > 0 ? idx.push(a, b, c) : idx.push(a, c, b);
  for (let j = 0; j < rows.length - 1; j++) {
    for (let i = 0; i < n; i++) {
      const a = j * n + i, b = j * n + (i + 1) % n;
      tri(a, a + n, b);
      tri(b, a + n, b + n);
    }
  }
  const center = pos.length / 3, inner = (rows.length - 1) * n;
  point(.002, 0, 0, .51);
  point(-.013, 0, 0, .86);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    tri(center, i, j);
    tri(center + 1, inner + j, inner + i);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(color, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
const EARS = [-1, 1].map(earGeometry);
const KNOT = new THREE.SphereGeometry(1, 10, 8).scale(.023, .014, .014);
const GEAR_SPIN_PAD = new THREE.LatheGeometry([[0,-.011],[.050,-.011],[.058,-.007],[.057,-.001],
  [.051,.006],[.045,.0095],[.035,.011],[0,.011]].map(([x,y]) => new THREE.Vector2(x,y)), 36);
const PAD_BINDING = new THREE.TorusGeometry(.052, .00145, 4, 32).rotateX(Math.PI / 2);
const PAD_CONTACT = new THREE.CylinderGeometry(.034,.037,.005,24);
const LABEL = new THREE.BoxGeometry(.027, .014, .006);
const LABEL_THREAD = threadGeometry([[[-.008,-.0035,0],[.008,-.0035,0]],
  [[-.008,.0004,0],[-.004,.0037,0],[0,.0004,0],[.004,.0037,0],[.008,.0004,0]]], .00075);
const EARCUP = new THREE.CylinderGeometry(.032,.034,.024,14).rotateZ(Math.PI / 2);
const EARCUP_INLAY = new THREE.CylinderGeometry(.021,.023,.006,14).rotateZ(Math.PI / 2);
const EARPAD = new THREE.TorusGeometry(.028, .006, 6, 16).rotateY(Math.PI / 2);
const CUP_EDGE = new THREE.TorusGeometry(.022, .0019, 4, 16).rotateY(Math.PI / 2);
const ARC = new THREE.TorusGeometry(.114,.008,6,22,Math.PI).scale(.96, 1.47, 1);
const BUTTON = new THREE.SphereGeometry(1, 8, 5).scale(.008,.004,.008);
const SPIN_PAD = new THREE.CylinderGeometry(.031,.036,.007,20);
const SPIN_CENTER = new THREE.CylinderGeometry(.014,.014,.008,16);
const PIN = new THREE.CylinderGeometry(.012,.012,.006,12);
const HEADBAND = new THREE.TorusGeometry(1,.085,6,28).rotateX(Math.PI / 2).scale(.101,.079,.141);
const HAT_LIGHT = new THREE.TorusGeometry(1,.054,6,28).rotateX(Math.PI / 2);
const HAIR_PARTS = new Map();

export function cityLocs(style, offset, bandana) {
  const tied = style === 'tiedLocs';
  const key = style + '-' + offset + (bandana ? '-bandana' : '');
  if (HAIR_PARTS.has(key)) return HAIR_PARTS.get(key);
  const positions = [], colors = [], indices = [];
  const sections = [.037,.09,.151,.221,.296,.374,.455,.541,.628,.709,.787,.854,.912,.954,.988];
  for (let i = 0; i < 17; i++) {
    const outer = i >= 9;
    const slot = outer ? (i-9)/7 : i/8;
    const angle = Math.PI*(1.05 + .90*slot);
    const side = Math.cos(angle), rear = Math.sin(angle);
    const endX = side * (tied ? .11 : .144) + .012*Math.sin(i*3.7);
    const endY = -(outer ? .39 : .29) - .051*(.5+.5*Math.sin(i*2.2)) - (tied ? .018 : 0);
    const rootX = side * (tied ? .059 : bandana ? .076 : .086);
    const rootY = tied ? .209 : outer ? .156 : .207;
    const rootZ = -.024 + rear * (tied ? .099 : bandana ? .106 : .129);
    const endZ = -.235 - offset + .028*Math.cos(i*2.3);
    const path = new THREE.CatmullRomCurve3([
      [rootX,rootY,rootZ],
      [side*(tied?.085:.109),.104,-.137-offset*.69+.038*Math.abs(side)],
      [side*(tied?.093:.125),-.061,-.19-offset*1.53+.029*Math.abs(side)],
      [endX+.013*Math.sin(i),-.216,endZ+.019*Math.cos(i)], [endX,endY,endZ],
    ].map(([x,y,z])=>new THREE.Vector3(x,y,z)));
    const thick = .0095 + .0041*(.5+.5*Math.cos(i*2.83));
    const part = rings(sections,7,(t,a) => {
      const p = path.getPoint(t), tangent = path.getTangent(t);
      const u = new THREE.Vector3(1,0,0).projectOnPlane(tangent).normalize();
      const v = u.clone().cross(tangent);
      const groove = Math.cos(a*2 + t*28 + i*.9);
      const r = thick*(.82+.18*Math.sin(t*Math.PI))*(1-.69*smooth(.950,1,t))*(1+.075*groove);
      if (bandana) {
        const hold = smooth(.043,.101,p.y) * (1 - smooth(.143,.185,p.y));
        p.x *= 1 - .17 * hold;
        p.z += (.025 + .70 * offset) * hold;
      }
      p.addScaledVector(u,Math.cos(a)*r+.003*Math.sin(t*20+i)*Math.sin(t*Math.PI));
      p.addScaledVector(v,Math.sin(a)*r);
      const tone = .80+.115*groove+.12*(.5+.5*Math.cos(i*2.3))+.15*smooth(.67,1,t);
      return [p.x,p.y,p.z,tone];
    }, [...path.getPoint(1).toArray(),.94], [...path.getPoint(0).toArray(),.78]);
    const start = positions.length/3;
    positions.push(...part.attributes.position.array);
    colors.push(...part.attributes.color.array);
    for (const n of part.index.array) indices.push(start+n);
    part.dispose();
  }
  const built = colouredSurface(positions,colors,indices);
  HAIR_PARTS.set(key,built);
  return built;
}

function hairPart(style) {
  if (HAIR_PARTS.has(style)) return HAIR_PARTS.get(style);
  let part;
  if (style === 'mohawk') {
    part = rings([[.17,.104,-.122,.021,-.022],[.207,.079,-.113,.024,-.025],[.241,.053,-.087,.017,-.025],[.264,.022,-.061,.009,-.023]],
      14, (row, angle) => outline(row, angle), [0,.271,-.018]);
  } else if (style === 'long') {
    part = rings([[-.064,-.015,-.127,.090,-.087],[-.034,.000,-.147,.105,-.087],[.021,.016,-.149,.108,-.085],[.084,.018,-.149,.103,-.086],[.132,.006,-.133,.084,-.08]], 24,
      (row, a) => { const p = outline(row, a); p[1] += .014 * Math.cos(a * 5) * (1 - smooth(-.065, .07, row[0])); return p; });
  } else if (style === 'bandana') {
    part = new THREE.CapsuleGeometry(.008, .028, 4, 10).scale(1, 1, .5);
  } else {
    const shapes = { tail:[.026,.077,.035,5], bun:[.040,.039,.038,7], dreads:[.015,.064,.016,3], braids:[.018,.082,.017,3] };
    const [width,height,depth, strands] = shapes[style];
    const sections = Array.from({ length: 14 }, (_, i) => (i + 1) / 15);
    part = rings(sections, 15, (t, a) => {
      const twist = Math.cos(a * strands + (style === 'braids' ? t * 26 : t * 4));
      const swell = Math.sin(Math.PI * t) ** (style === 'bun' ? .58 : .36);
      const r = swell * (1 + (style === 'braids' ? .19 : .09) * twist);
      return [width * Math.cos(a) * r, (2 * t - 1) * height, depth * Math.sin(a) * r, .85 + .14 * twist];
    }, [0,height,0,.89], [0,-height,0,.79]);
  }
  HAIR_PARTS.set(style, part);
  return part;
}

// Precompute a small support hull per shared mesh. Ground contact uses those surface
// points during headspins instead of the corners of a box around the hat.
const contactDirections = Array.from({ length: 32 }, (_, i) => {
  const y = 1 - (i + .5) / 16, r = Math.sqrt(1 - y * y), a = i * 2.399963229728653;
  return new THREE.Vector3(r * Math.cos(a), y, r * Math.sin(a));
}).concat(UP, new THREE.Vector3(0, -1, 0));

function supportHull(points) {
  const extreme = new Set();
  for (const dir of contactDirections) {
    let max = -Infinity, best;
    for (const point of points) {
      const d = point.dot(dir);
      if (d > max) { max = d; best = point; }
    }
    extreme.add(best);
  }
  return [...extreme];
}

function contactPoints(geo) {
  if (CONTACTS.has(geo)) return CONTACTS.get(geo);
  const p = geo.attributes.position;
  const indices = geo.index ? [...new Set(geo.index.array)] : Array.from({ length: p.count }, (_, i) => i);
  const hull = supportHull(indices.map(i => new THREE.Vector3().fromBufferAttribute(p, i)));
  CONTACTS.set(geo, hull);
  return hull;
}

export function addCityHead(bone, look, body, { M, MV, glowOf }) {
  const C = look.col, girl = look.girl || body.girl;
  const profile = profileOf(girl, body.type, body.face, body.old);
  const group = new THREE.Group();
  group.name = 'CityHead';
  group.scale.setScalar(body.head * .94);
  bone.add(group);
  const supportMeshes = [];
  const add = (g, material, x = 0, y = 0, z = 0, support = false) => {
    const mesh = new THREE.Mesh(g, material);
    mesh.position.set(x, y, z);
    g.userData.sharedCityGeometry = true;
    if (support) supportMeshes.push(mesh);
    else mesh.userData.clothDetail = true;
    group.add(mesh);
    return mesh;
  };
  const face = faceGeometry(profile), hair = MV(C.hair,.84,0,FINISH.hair);
  add(face.skin, MV(C.skin,.73,0,FINISH.skin), 0, 0, 0, true);
  const earX = .086 * profile.temple;
  for (const [i, side] of [-1, 1].entries()) {
    const ear = add(EARS[i], MV(C.skin,.78,0,FINISH.skin), side * earX, .076, -.034, true);
    ear.name = 'CityEar';
    ear.rotation.x = -.23;
  }
  for (const eye of face.eyes) {
    for (const lid of eye.lids) add(lid, MV(C.skin,.76,0,FINISH.skin));
    add(eye.white, MV('#D5C9BE', .66));
    add(eye.iris, MV(body.old ? '#676558' : profile.features.iris, .54));
    add(eye.glint, M('#EEE0CE', .65));
    add(eye.brow, hair);
  }
  if (body.beard && !girl) {
    face.beard ??= beardGeometry(face.skin,profile);
    add(face.beard, M(C.hair,.90,0,FINISH.hair));
  }

  const style = body.style || (girl ? 'tail' : 'short');
  const locs = hasLocs(style);
  const hat = C.hat && (!locs || look.hat === 'bandana') ? look.hat : null;
  const openBandana = locs && hat === 'bandana';
  if (style !== 'bald') {
    if (hat !== 'bandana' || openBandana) {
      const color = !hat && style === 'buzz' ? '#' + new THREE.Color(C.hair).lerp(new THREE.Color(C.skin), .13).getHexString() : C.hair;
      add(scalp(profile, hat && !openBandana ? 'underHat' : style, openBandana), MV(color,.84,0,FINISH.hair), 0, 0, 0, !hat || openBandana);
    }
    if (!hat && style === 'mohawk') add(hairPart(style), M(body.dye || C.hair,.84,0,FINISH.hair), 0, 0, 0, true);
    if (!hat && (style === 'bun' || style === 'buns')) {
      const xs = style === 'buns' ? [-.065, .065] : [0];
      for (const x of xs) add(hairPart('bun'),hair,x,.205,-.105,true).rotation.x = .4;
    }
    if (style === 'tiedLocs') {
      const bun = add(hairPart('bun'),hair,0,openBandana ? .185 : .158,openBandana ? -.144 : -.123,true);
      if (openBandana) { bun.scale.set(.98,.89,1.05); bun.rotation.x = .46; }
      else bun.scale.set(.89,.67,.96);
    }
    if (style === 'tail' || (hat && /^(bun|buns)$/.test(style))) {
      add(hairPart('tail'),hair,0,.047,-.115,true).rotation.x = .40;
    }
    if (style === 'long') add(hairPart(style), M(C.hair,.84,0,FINISH.hair),0,0,0,true);
    if (style === 'braids' || style === 'dreads') {
      const pairs = style === 'braids' ? [[-.078,-.045],[.078,-.045]] : [[-.073,-.067],[.073,-.067],[-.041,-.11],[.041,-.11],[0,-.125]];
      for (const [x, z] of pairs) add(hairPart(style),hair,x,.028+Math.abs(x)*.31,z,true).rotation.set(.31,0,Math.sign(x)*.15);
    }
  }

  const hairTop = { afro: .291, top: .285, curly: .273, mohawk: .271, short: .264, buzz: .249, bald: HEAD_TOP };
  let crown = hairTop[style] || .259;
  let crownZ = -.025, bandY = .135, bandX = .099, bandZ = .141, bandCenter = -.015;
  if (hat) {
    const [main, trim = main] = C.hat;
    const clothMat = color => MV(color,.91,0,FINISH.cloth);
    const thread = (color, light = .36) => '#' + new THREE.Color(color)
      .lerp(new THREE.Color('#BCAEA1'), light).getHexString();
    const addEyelet = (point, angle, color) => {
      const normal = new THREE.Vector3(Math.cos(angle), .095, Math.sin(angle)).normalize();
      const p = new THREE.Vector3(...point.slice(0,3)).addScaledVector(normal,.0010);
      add(EYELET,M(color,.77),...p.toArray()).quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal);
      add(CAP_HOLE,M('#252020',.96),...p.toArray()).quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal);
    };
    if (hat.startsWith('cap')) {
      const back = hat === 'capBack', gold = hat === 'capGold';
      if (!back && !gold && main !== trim) BRIMS.cap.panels.forEach((p, i) => add(p, clothMat(i ? trim : main), 0, 0, 0, true));
      else add(back ? BRIMS.cap.back : BRIMS.cap.crown, clothMat(main), 0, 0, 0, true);
      add(back ? BRIMS.cap.backStitch : BRIMS.cap.stitch, M(thread(main,.24), .95));
      const billColor = gold || back ? trim : main;
      const bill = add(BILL, M(billColor,.87,0,FINISH.cloth), 0, back ? .145 : .152, back ? -.009 : 0, true);
      bill.rotation.y = back ? Math.PI : 0;
      bill.rotation.x = back ? -.09 : .1;
      add(BILL_STITCH, M(thread(billColor), .96), ...bill.position.toArray()).rotation.copy(bill.rotation);
      add(BUTTON, M(trim, .9), 0, .258, -.024, true);
      for (const a of [.52, 2.62, 3.74, 5.56]) addEyelet(capPoint(cap[3],a,back),a,thread(main,.49));
      if (back) {
        add(ADJUSTER,M(trim,.91),0,.142,.133).name = 'Cap adjuster';
        for (const x of [-.023,-.016,-.009,.00]) add(CAP_HOLE,M('#272427',.91),x,.142,.137);
        add(ADJUSTER_LOOP,M(thread(trim,.58),.48,.14),.019,.142,.138);
      } else if (gold) {
        add(LABEL,M(trim,.91),0,.191,.141);
        add(LABEL_THREAD,M(thread(main,.24),.91),0,.191,.1444);
      }
      crown = .262;
    } else if (hat === 'beanie') {
      add(BRIMS.beanie[0], clothMat(main), 0, 0, 0, true);
      add(BRIMS.beanie[1], clothMat(trim), 0, 0, 0, true);
      const label = add(LABEL, M(main, .93), .032, .143, .138);
      label.rotation.y = .28;
      add(LABEL_THREAD,M(thread(trim,.59),.92),.033,.143,.1412).rotation.y = .28;
      crown = .266; crownZ = -.031; bandY = .136; bandZ = .148; bandX = .106;
      if (C.spinPad) {
        add(GEAR_SPIN_PAD, M(C.spinPad, .65), 0, .267, crownZ, true).name = 'Headspin pad';
        add(PAD_BINDING, M(thread(trim,.34), .77), 0, .271, crownZ);
        add(PAD_CONTACT,M(thread(C.spinPad,.08),.58),0,.2755,crownZ);
        crown = .278;
      }
    } else if (hat === 'bucket') {
      add(BRIMS.bucket[0], clothMat(main), 0, 0, 0, true).name = 'BucketHat';
      add(BRIMS.bucket[1], clothMat(trim), 0, 0, 0, true);
      add(BUCKET_BINDING, M(trim, .93));
      add(BUCKET_STITCH, M(thread(main,.52), .96));
      for (const a of [.35,2.8,3.86,5.75]) addEyelet(roundBucket([.134,.20],a),a,thread(trim,.63));
      crown = BUCKET_TOP; crownZ = BUCKET_Z;
      bandY = .162; bandZ = .143; bandX = bandZ * BUCKET_X; bandCenter = BUCKET_Z;
    } else if (openBandana) {
      const {band,seam,print,knot,ties} = locsBandana(profile);
      add(band, clothMat(main), 0, 0, 0, true).name = 'OpenBandana';
      add(seam, M(thread(trim,.16),.93));
      add(print, M(trim,.96));
      add(knot, M(main,.93,0,FINISH.cloth)).name = 'BandanaKnot';
      for (const tie of ties) add(tie, clothMat(main));
    } else if (hat === 'bandana') {
      add(WRAP, clothMat(main), 0, 0, 0, true);
      add(PRINT, M(trim, .92));
      add(BANDANA_HEM,M(thread(trim,.16),.93));
      add(BANDANA_PAISLEY,M(trim,.96));
      add(KNOT, M(main, .93), .040,.102,-.133);
      for (const s of [-1, 1]) add(hairPart('bandana'), M(main, .93), .041 + .010 * s,.082,-.141).rotation.set(.35, 0, .36 + s * .29);
      crown = .255; bandY = .151; bandZ = .138; bandX = .102;
    }
  }
  if (look.phones) {
    const matte = M('#18191c', .69, .18);
    add(ARC, matte, 0, .088, -.044);
    for (const side of [-1, 1]) {
      add(EARPAD, M('#28272B', .95), side * .089, .081, -.037);
      add(EARCUP, matte, side * .096, .081, -.037);
      add(EARCUP_INLAY, M(C.phones || '#E2611A', .75), side * .109, .081, -.037);
      add(CUP_EDGE, M('#4E4B51', .73), side * .112, .081, -.037);
    }
  }
  const tier = look.cus?.head || 0;
  if (tier && !locs) {
    const accent = look.acc || '#E2611A';
    if (hat) {
      const pin = add(PIN, M('#E7B23C', .39, .75), .063, hat === 'bucket' ? .177 : .171, hat === 'bucket' ? .115 : .107);
      pin.quaternion.setFromUnitVectors(UP, new THREE.Vector3(.58,.2,.79).normalize());
    } else {
      const band = add(HEADBAND, tier >= 3 ? glowOf(accent) : M(accent,.8), 0,.147,-.014);
      band.rotation.x = -.13;
    }
    if (tier >= 2) {
      add(SPIN_PAD, M(accent, .75), 0, crown + .002, crownZ, true);
      add(SPIN_CENTER, M('#F2EFE8', .78), 0, crown + .003, crownZ);
    }
    if (tier >= 3 && hat) add(HAT_LIGHT, glowOf(accent), 0, bandY, bandCenter).scale.set(bandX,.09,bandZ);
  }
  const points = supportMeshes.flatMap(mesh => {
    mesh.updateMatrix();
    return contactPoints(mesh.geometry).map(p => p.clone().applyMatrix4(mesh.matrix));
  });
  group.userData.contactPoints = supportHull(points);
  return group;
}
