// Sculpted skulls and fitted headwear in Head bone space. Y is up, Z points towards the face.
import * as THREE from 'three';

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

function profileOf(girl, type) {
  const frame = /^(slim|lanky)$/.test(type) ? 'narrow' : /^(heavy|stocky|big)$/.test(type) ? 'broad' : 'middle';
  const temple = frame === 'narrow' ? .95 : frame === 'broad' ? 1.04 : 1;
  const jaw = (frame === 'narrow' ? .89 : frame === 'broad' ? 1.1 : 1) * (girl ? .93 : 1);
  return { key: (girl ? 'f-' : 'm-') + frame, girl, temple, jaw };
}

function skullSlice(y, profile) {
  if (y >= .244) {
    const t = smooth(.244, HEAD_TOP, y);
    return [y, -.009 - .016 * t, -.041 + .016 * t, .014 * (1 - t), -.025];
  }
  let i = 1;
  while (i < SKULL.length - 1 && SKULL[i][0] < y) i++;
  const a = SKULL[i - 1], b = SKULL[i], p = clamp((y - a[0]) / (b[0] - a[0]), 0, 1);
  const s = a.map((v, j) => v + (b[j] - v) * p);
  const upper = smooth(.004, .095, y);
  s[3] *= (1 - upper) * profile.jaw + upper * profile.temple;
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
  const nose = .018 * bell(y - .064, .020) * bell(x, .013) + .010 * bell(y - .084, .032) * bell(x, .0085);
  const brow = .005 * bell(y - .119, .010) * bell(Math.abs(x) - .035, .042);
  const eye = bell(Math.abs(x) - .035, .019) * bell(y - .102, .013);
  const cheek = .0037 * bell(Math.abs(x) - .055, .018) * bell(y - .074, .015);
  const lip = bell(y - .026, .0063) * bell(x, .025);
  p[2] += f2 * (nose * (profile.girl ? .85 : 1) + brow - .006 * eye + cheek + .005 * lip);
  const shadow = (1 - .15 * eye * front) * (1 - .2 * (1 - smooth(-.039, .029, y)));
  const mouth = lip * front ** 4;
  return [...p, [shadow * (1 - .16 * mouth), shadow * (1 - .39 * mouth), shadow * (1 - .32 * mouth)]];
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
  const ys = [...new Set([...SKULL.map(row => row[0]), -.025, -.004, .022, .028, .04, .047, .055, .072, .098, .103, .118])].sort((a, b) => a - b);
  return rings(ys.map(y => skullSlice(y, profile)), 40, (s, a) => facePoint(s, a, profile), [0, HEAD_TOP, -.025], [0, -.05, .068, .77]);
}

function faceZ(x, y, profile) {
  const s = skullSlice(y, profile);
  let lo = 0, hi = Math.PI / 2;
  for (let i = 0; i < 18; i++) {
    const a = (lo + hi) / 2;
    if (outline(s, a)[0] > Math.abs(x)) lo = a;
    else hi = a;
  }
  return facePoint(s, (lo + hi) / 2, profile)[2];
}

function eyeGeometry(x, y, width, height, offset, profile) {
  const geo = new THREE.CircleGeometry(1, 12);
  const vertices = geo.attributes.position;
  for (let i = 0; i < vertices.count; i++) {
    const rx = vertices.getX(i), ry = vertices.getY(i);
    const px = x + rx * width, py = y + ry * height + Math.sign(x) * rx * .0014;
    vertices.setXYZ(i, px, py, faceZ(px, py, profile) + offset + (i === 0 ? .0007 : 0));
  }
  geo.computeVertexNormals();
  return geo;
}

function beardGeometry(skin) {
  const geo = skin.clone(), pos = geo.attributes.position, n = geo.attributes.normal, weights = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const line = .042 + .034 * smooth(.026, .073, Math.abs(x));
    const lips = (1 - smooth(.017, .03, Math.abs(x))) * bell(y - .025, .010);
    const w = (1 - smooth(line - .006, line + .005, y)) * smooth(-.06, -.041, z) * (1 - lips);
    const rise = -.0035 + .012 * w;
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
  const eyes = [-1, 1].map(side => {
    const x = .034 * side, y = .1025;
    const brow = [-1, 0, 1].map((k, i) => {
      const bx = x + k * .016, by = .121 + (i === 1 ? .003 : 0) - .0018 * side * k;
      return new THREE.Vector3(bx, by, faceZ(bx, by, profile) + .0025);
    });
    return {
      lid: eyeGeometry(x, y, .0143, .0063, .0018, profile),
      white: eyeGeometry(x, y, .0122, .0045, .0031, profile),
      iris: eyeGeometry(x + .0006 * side, y, .0045, .0043, .0044, profile),
      brow: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(brow), 7, profile.girl ? .002 : .0026, 5),
    };
  });
  const face = { skin, beard: profile.girl ? null : beardGeometry(skin), eyes };
  HEADS.set(profile.key, face);
  return face;
}

function scalp(profile, style) {
  const key = profile.key + style;
  if (HAIR.has(key)) return HAIR.get(key);
  const covered = style === 'underHat';
  const shear = style === 'buzz' || covered;
  const wave = style === 'curly' || style === 'afro';
  const volume = { buzz: .003, underHat: .002, short: .018, curly: .027, afro: .045, top: .039 };
  const height = volume[style] || .013;
  const sections = covered ? [0, .035, .09, .17, .27, .4] : [0, .035, .09, .17, .27, .4, .53, .65, .76, .86, .93, .975, .994];
  const g = rings(sections, 32, (t, a) => {
    const sn = Math.sin(a), front = Math.max(0, sn), back = Math.max(0, -sn);
    let y = .102 + .052 * front ** 1.5 - .057 * back ** 1.45;
    if (!shear) y += .011 * front * Math.cos(a * 2 - .6) + .005 * Math.sin(a * 3 + .5);
    const p = facePoint(skullSlice(y + (HEAD_TOP - y) * t, profile), a, profile);
    const crest = smooth(.03, .56, t);
    const lobe = wave ? .006 * (1 + Math.cos(a * 9 + 11 * t)) * Math.sin(Math.PI * t) : 0;
    const side = covered ? .0038 : shear ? .0026 : style === 'afro' ? .019 : .007;
    const lift = side + lobe + (shear ? 0 : .006 * crest);
    p[0] += Math.cos(a) * lift * Math.sqrt(1 - t) + (style === 'short' ? .008 * smooth(.72, .99, t) : 0);
    p[2] += sn * lift * Math.sqrt(1 - t);
    p[1] += height * crest + lobe;
    const strand = wave ? Math.cos(a * 13 + t * 10) : Math.cos(a * 5 + t * 9);
    return [p[0], p[1], p[2], (shear ? .9 : .83) + .12 * crest + .075 * strand * Math.sin(Math.PI * t)];
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
const bucket = [
  [.139,.138,-.151,.105,-.022], [.155,.139,-.152,.106,-.023], [.194,.130,-.146,.103,-.027],
  [.234,.110,-.134,.094,-.028], [.249,.082,-.106,.080,-.025], [.252,.054,-.080,.059,-.022],
  [.253,.020,-.048,.032,-.016],
];
const bucketBand = [
  [.144,.142,-.156,.108,-.022], [.151,.143,-.156,.109,-.022],
  [.164,.141,-.154,.108,-.024], [.169,.138,-.151,.106,-.025],
];
const bucketBrim = [
  [.138,.136,-.150,.104,-.022], [.126,.162,-.175,.126,-.022], [.105,.191,-.205,.154,-.022],
  [.103,.199,-.211,.159,-.022], [.109,.2,-.212,.16,-.022], [.117,.185,-.198,.146,-.022],
  [.132,.162,-.175,.127,-.022], [.145,.140,-.154,.108,-.022],
];

function cloth(rows, type, top) {
  const fine = type === 'cuff';
  const brim = type === 'brim';
  return rings(rows, fine ? 56 : HAT_SIDES, (row, a) => {
    const c = Math.cos(a), s = Math.sin(a);
    const p = outline(row, a, .74, .9);
    const seam = Math.abs(Math.sin(a * 3));
    const edge = 1 - smooth(.155, .243, row[0]);
    if (type === 'cap') { p[1] += .021 * Math.max(0, s) * edge; return [...p, .88 + .12 * smooth(.02, .26, seam)]; }
    if (fine || type === 'knit') {
      p[1] += .017 * s * edge + .006 * Math.sin(2 * a + .65) * edge;
      p[0] += c * (fine ? .0011 : .0019) * Math.cos((fine ? 28 : 7) * a);
      return [...p, .86 + .11 * Math.cos((fine ? 28 : 7) * a)];
    }
    const drape = (.0035 * Math.sin(a * 3 + .5) + .0038 * Math.sin(a - .7)) * edge;
    p[1] += drape * (brim ? 1.55 : 1);
    return [...p, brim ? .93 + .07 * Math.cos(a * 2 + .75) : .94 + .06 * seam];
  }, top);
}

function capParts() {
  const crown = cloth(cap, 'cap', [0, .257, -.024]);
  const solids = [[], []], idx = crown.index.array;
  const wallLength = (cap.length - 1) * HAT_SIDES * 6;
  for (let i = 0; i < idx.length; i += 3) {
    const segment = i < wallLength ? Math.floor(i / 6) % HAT_SIDES : (i - wallLength) / 3;
    const front = Math.abs(segment + .5 - HAT_SIDES / 4) < 3.6;
    solids[Number(front)].push(idx[i], idx[i + 1], idx[i + 2]);
  }
  return { crown, panels: solids.map(index => crown.clone().setIndex(index)) };
}

const BRIMS = {
  cap: capParts(),
  beanie: [cloth(beanie, 'knit', [0, .266, -.03]), cloth(knitCuff, 'cuff')],
  bucket: [cloth(bucket, 'bucket', [0, .254, -.014]), cloth(bucketBand, 'bucket'), cloth(bucketBrim, 'brim')],
};
const BILL = (() => {
  const shape = new THREE.Shape();
  shape.moveTo(-.075, .088);
  shape.quadraticCurveTo(0, .122, .075, .088);
  shape.quadraticCurveTo(.110, .179, .076, .216);
  shape.quadraticCurveTo(0, .248, -.076, .216);
  shape.quadraticCurveTo(-.110, .179, -.075, .088);
  const g = new THREE.ExtrudeGeometry(shape, { depth: .007, bevelSize: .003, bevelThickness: .002, bevelSegments: 1, curveSegments: 5 });
  g.rotateX(Math.PI / 2);
  return g;
})();

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

const EAR = new THREE.SphereGeometry(1, 12, 8).scale(.0125, .026, .015);
const KNOT = new THREE.SphereGeometry(1, 10, 8).scale(.023, .014, .014);
const LABEL = new THREE.BoxGeometry(.027, .014, .006);
const EARCUP = new THREE.CylinderGeometry(.032,.034,.024,14).rotateZ(Math.PI / 2);
const EARCUP_INLAY = new THREE.CylinderGeometry(.021,.023,.006,14).rotateZ(Math.PI / 2);
const ARC = new THREE.TorusGeometry(.114,.008,6,22,Math.PI).scale(.96, 1.47, 1);
const BUTTON = new THREE.SphereGeometry(1, 8, 5).scale(.008,.004,.008);
const SPIN_PAD = new THREE.CylinderGeometry(.031,.036,.007,20);
const SPIN_CENTER = new THREE.CylinderGeometry(.014,.014,.008,16);
const PIN = new THREE.CylinderGeometry(.012,.012,.006,12);
const HEADBAND = new THREE.TorusGeometry(1,.085,6,28).rotateX(Math.PI / 2).scale(.101,.079,.141);
const HAT_LIGHT = new THREE.TorusGeometry(1,.054,6,28).rotateX(Math.PI / 2);
const HAIR_PARTS = new Map();
function hairPart(style) {
  if (HAIR_PARTS.has(style)) return HAIR_PARTS.get(style);
  let part;
  if (style === 'mohawk') {
    part = rings([[.17,.104,-.122,.021,-.022],[.207,.079,-.113,.024,-.025],[.241,.053,-.087,.017,-.025],[.264,.022,-.061,.009,-.023]],
      14, (row, angle) => outline(row, angle), [0,.271,-.018]);
  } else if (style === 'long') {
    part = rings([[-.064,-.015,-.127,.090,-.087],[-.034,.000,-.147,.105,-.087],[.021,.016,-.149,.108,-.085],[.084,.018,-.149,.103,-.086],[.132,.006,-.133,.084,-.08]], 24,
      (row, a) => { const p = outline(row, a); p[1] += .014 * Math.cos(a * 5) * (1 - smooth(-.065, .07, row[0])); return p; });
  } else {
    const shapes = { tail:[.026,.077,.035], bun:[.040,.039,.038], dreads:[.015,.064,.016], braids:[.018,.082,.017], bandana:[.008,.022,.004] };
    const [x,y,z] = shapes[style];
    part = new THREE.CapsuleGeometry(x, Math.max(.003, 2 * (y - x)), 4, 10).scale(1, 1, z / x);
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
  const profile = profileOf(girl, body.type);
  const group = new THREE.Group();
  group.name = 'CityHead';
  group.scale.setScalar(body.head * .94);
  bone.add(group);
  const supportMeshes = [];
  const add = (g, material, x = 0, y = 0, z = 0, support = false) => {
    const mesh = new THREE.Mesh(g, material);
    mesh.position.set(x, y, z);
    g.userData.sharedCityHead = true;
    if (support) supportMeshes.push(mesh);
    else mesh.userData.clothDetail = true;
    group.add(mesh);
    return mesh;
  };
  const face = faceGeometry(profile), hair = M(C.hair, .88);
  add(face.skin, MV(C.skin, .83), 0, 0, 0, true);
  const earX = .085 * profile.temple;
  for (const side of [-1, 1]) {
    const ear = add(EAR, M(C.skin, .85), side * earX, .076, -.034);
    ear.rotation.x = -.23;
  }
  for (const eye of face.eyes) {
    add(eye.lid, M('#322521', .9));
    add(eye.white, M('#CFC5B6', .9));
    add(eye.iris, M('#2C211B', .82));
    add(eye.brow, hair);
  }
  if (body.beard && face.beard) add(face.beard, hair);

  const hat = C.hat ? look.hat : null;
  const style = body.style || (girl ? 'tail' : 'short');
  if (style !== 'bald') {
    if (hat !== 'bandana') {
      const color = !hat && style === 'buzz' ? '#' + new THREE.Color(C.hair).lerp(new THREE.Color(C.skin), .13).getHexString() : C.hair;
      add(scalp(profile, hat ? 'underHat' : style), MV(color, .94), 0, 0, 0, !hat);
    }
    if (!hat && style === 'mohawk') add(hairPart(style), M(body.dye || C.hair, .9), 0, 0, 0, true);
    if (!hat && (style === 'bun' || style === 'buns')) {
      const xs = style === 'buns' ? [-.065, .065] : [0];
      for (const x of xs) add(hairPart('bun'), hair, x, .205, -.105, true).rotation.x = .4;
    }
    if (style === 'tail' || (hat && /^(bun|buns)$/.test(style))) {
      add(hairPart('tail'), hair, 0, .047, -.115, true).rotation.x = .40;
    }
    if (style === 'long') add(hairPart(style), hair, 0, 0, 0, true);
    if (style === 'braids' || style === 'dreads') {
      const pairs = style === 'braids' ? [[-.078,-.045],[.078,-.045]] : [[-.073,-.067],[.073,-.067],[-.041,-.11],[.041,-.11],[0,-.125]];
      for (const [x, z] of pairs) add(hairPart(style), hair, x, .028 + Math.abs(x) * .31, z, true).rotation.set(.31, 0, Math.sign(x) * .15);
    }
  }

  const hairTop = { afro: .291, top: .285, curly: .273, mohawk: .271, short: .264, buzz: .249, bald: HEAD_TOP };
  let crown = hairTop[style] || .259;
  let crownZ = -.025, bandY = .135, bandX = .099, bandZ = .141;
  if (hat) {
    const [main, trim = main] = C.hat;
    const clothMat = color => MV(color, .93);
    if (hat.startsWith('cap')) {
      const back = hat === 'capBack', gold = hat === 'capGold';
      if (!back && !gold && main !== trim) BRIMS.cap.panels.forEach((p, i) => add(p, clothMat(i ? trim : main), 0, 0, 0, true));
      else add(BRIMS.cap.crown, clothMat(main), 0, 0, 0, true);
      const bill = add(BILL, M(gold || back ? trim : main, .86), 0, .145, back ? -.009 : 0, true);
      bill.rotation.y = back ? Math.PI : 0;
      bill.rotation.x = back ? -.09 : .1;
      add(BUTTON, M(trim, .9), 0, .258, -.024, true);
      if (back) add(LABEL, M(trim, .9), 0, .134, .135).scale.x = 2.05;
      crown = .262;
    } else if (hat === 'beanie') {
      add(BRIMS.beanie[0], clothMat(main), 0, 0, 0, true);
      add(BRIMS.beanie[1], clothMat(trim), 0, 0, 0, true);
      add(LABEL, M(main, .93), .033, .14, .126).rotation.y = .37;
      crown = .266; crownZ = -.031; bandY = .136; bandZ = .148; bandX = .106;
    } else if (hat === 'bucket') {
      add(BRIMS.bucket[0], clothMat(main), 0, 0, 0, true);
      add(BRIMS.bucket[1], clothMat(trim), 0, 0, 0, true);
      add(BRIMS.bucket[2], clothMat(main), 0, 0, 0, true);
      crown = .254; crownZ = -.014; bandY = .162; bandZ = .151; bandX = .109;
    } else if (hat === 'bandana') {
      add(WRAP, clothMat(main), 0, 0, 0, true);
      add(PRINT, M(trim, .92));
      add(KNOT, M(main, .93), .040,.102,-.133);
      for (const s of [-1, 1]) add(hairPart('bandana'), M(main, .93), .041 + .010 * s,.082,-.141).rotation.set(.35, 0, .36 + s * .29);
      crown = .255; bandY = .151; bandZ = .138; bandX = .102;
    }
  }
  if (look.phones) {
    const matte = M('#18191c', .69, .18);
    add(ARC, matte, 0, .088, -.044);
    for (const side of [-1, 1]) {
      add(EARCUP, matte, side * .096, .081, -.037);
      add(EARCUP_INLAY, M(C.phones || '#E2611A', .75), side * .109, .081, -.037);
    }
  }
  const tier = look.cus?.head || 0;
  if (tier) {
    const accent = look.acc || '#E2611A';
    if (hat) {
      const pin = add(PIN, M('#E7B23C', .39, .75), .063, hat === 'bucket' ? .177 : .171, .107);
      pin.quaternion.setFromUnitVectors(UP, new THREE.Vector3(.58,.2,.79).normalize());
    } else {
      const band = add(HEADBAND, tier >= 3 ? glowOf(accent) : M(accent,.8), 0,.147,-.014);
      band.rotation.x = -.13;
    }
    if (tier >= 2) {
      add(SPIN_PAD, M(accent, .75), 0, crown + .002, crownZ, true);
      add(SPIN_CENTER, M('#F2EFE8', .78), 0, crown + .003, crownZ);
    }
    if (tier >= 3 && hat) add(HAT_LIGHT, glowOf(accent), 0,bandY,-.015).scale.set(bandX,.09,bandZ);
  }
  const points = supportMeshes.flatMap(mesh => {
    mesh.updateMatrix();
    return contactPoints(mesh.geometry).map(p => p.clone().applyMatrix4(mesh.matrix));
  });
  group.userData.contactPoints = supportHull(points);
  return group;
}
