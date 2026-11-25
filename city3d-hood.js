// A lowered hood with a continuous outer shell, rolled binding and recessed lining.
// Dimensions are in the upper back bone's space. Positive Z faces the neck.
import * as THREE from 'three';

const SECTIONS = [
  // height, center Z, half width, depth, amount of drape, fabric shading
  [.044, -.143, .022, .023, .12, .82],
  [.055, -.153, .056, .042, .23, .91],
  [.078, -.161, .086, .057, .38, .96],
  [.111, -.164, .107, .069, .63, 1],
  [.144, -.163, .118, .068, .85, 1],
  [.172, -.156, .116, .072, .94, 1],
  [.185, -.151, .109, .073, 1, .97],
  [.190, -.149, .106, .072, 1, .72],
  [.192, -.149, .103, .069, 1, 1.04],
  [.188, -.150, .096, .063, 1, .85],
  [.180, -.152, .092, .059, 1, .51],
  [.165, -.153, .086, .054, .88, .42],
  [.138, -.155, .072, .047, .63, .37],
  [.112, -.155, .053, .037, .46, .33],
  [.093, -.156, .024, .021, .18, .34],
];

function foldedHood() {
  const n = 40, pos = [], colors = [], index = [];
  const add = (x, y, z, tone) => {
    pos.push(x, y, z);
    colors.push(tone, tone, tone);
  };
  for (const [row, [h, z0, width, depth, drape, shade]] of SECTIONS.entries()) {
    for (let i = 0; i < n; i++) {
      const a = i * Math.PI * 2 / n;
      const x = Math.cos(a), z = Math.sin(a);
      const front = Math.max(0, z), back = Math.max(0, -z);
      const leftPleat = Math.max(0, Math.cos(a - 3.64)) ** 22;
      const rightPleat = Math.max(0, Math.cos(a + .19)) ** 30;
      const pleat = .19 * leftPleat + .12 * rightPleat;
      const gather = .006 * Math.sin(3 * a + .65) + .0035 * Math.sin(5 * a + 1.1);
      const seam = back ** 34 * drape;
      const w = width * (1 - .26 * front + .095 * back - pleat * drape);
      const y = h + drape * (.027 * (1 - z * z) - .024 * front - .039 * back - .065 * pleat + gather);
      // Turn the lining back toward the hood instead of letting it pass through the shoulders.
      const fold = .028 - .044 * Math.min(1, Math.max(0, (row - 8) / 3));
      const zp = z0 + depth * z + fold * drape * front ** 2 + .0032 * seam + gather * z * drape;
      add(Math.sign(x) * Math.abs(x) ** .89 * w + drape * (.0052 + .0038 * Math.cos(2 * a)), y, zp,
        shade * (1 - .14 * seam + (.06 * Math.sin(3 * a + .3) - .55 * pleat) * drape));
    }
  }
  for (let j = 0; j < SECTIONS.length - 1; j++) {
    for (let i = 0; i < n; i++) {
      const a = j * n + i, b = j * n + (i + 1) % n;
      index.push(a, a + n, b, b, a + n, b + n);
    }
  }
  const last = pos.length / 3;
  add(0, .089, -.156, .32);
  add(0, .042, -.145, .81);
  const inner = (SECTIONS.length - 1) * n;
  for (let i = 0; i < n; i++) {
    index.push(last, inner + (i + 1) % n, inner + i, last + 1, i, (i + 1) % n);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  geo.userData.sharedCityGeometry = true;
  return geo;
}

export const FOLDED_HOOD = foldedHood();
