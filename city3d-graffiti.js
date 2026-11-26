import * as THREE from 'three';

const WIDTH = 1024, HEIGHT = 624;
const surfaces = {
  yard: ['#79736b', '#845144'],
  center: ['#76777b', '#485876'],
  park: ['#717b6c', '#563d58'],
  prom: ['#6c645f', '#71472e'],
};
const slab = new THREE.BoxGeometry(3.6, 2.2, .28);
const lip = new THREE.BoxGeometry(3.67, .13, .35);
const plain = new THREE.MeshStandardMaterial({ color: '#676462', roughness: .94 });
const cap = new THREE.MeshStandardMaterial({ color: '#626267', roughness: .90 });
const front = new THREE.PlaneGeometry(3.52, 2.13);

function canvas(w = WIDTH, h = HEIGHT) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  return cv;
}

async function loadImage(name) {
  const image = new Image();
  image.src = new URL('./img/graffiti-' + name + '.webp?v=1', import.meta.url).href;
  try { await image.decode(); return image; } catch (_) { return null; }
}

function drawTile(x, image, index, flip, width, height) {
  const w = image.naturalWidth / 2, h = image.naturalHeight / 2;
  x.save();
  if (flip) { x.translate(width, 0); x.scale(-1, 1); }
  x.drawImage(image, (index % 2) * w, Math.floor(index / 2) * h, w, h, 0, 0, width, height);
  x.restore();
}

export async function loadGraffitiSurface(district) {
  const [color, wear] = await Promise.all([loadImage('concrete'), loadImage('wear')]);
  const index = Math.max(0, Object.keys(surfaces).indexOf(district));
  const masks = [];
  if (wear) {
    const w = wear.naturalWidth / 2, h = wear.naturalHeight / 2;
    for (const flip of [false, true]) {
      const mask = canvas(w, h), x = mask.getContext('2d');
      drawTile(x, wear, index, flip, w, h);
      const img = x.getImageData(0, 0, w, h);
      // Blender exports abrasion in grey. Keep that amount as the alpha of the exposed concrete.
      for (let i = 0; i < img.data.length; i += 4) img.data[i + 3] = img.data[i];
      x.putImageData(img, 0, 0);
      masks.push(mask);
    }
  }
  return { district, index, color, masks };
}

function wallBase(surface, seed, flip) {
  const cv = canvas(), x = cv.getContext('2d');
  const [concrete, fadedPaint] = surfaces[surface.district] || surfaces.yard;
  x.fillStyle = concrete; x.fillRect(0, 0, WIDTH, HEIGHT);
  if (surface.color) drawTile(x, surface.color, surface.index, flip, WIDTH, HEIGHT);
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
  // A few almost-scrubbed paint marks show through the gaps in the new piece.
  x.lineCap = 'round'; x.lineJoin = 'round';
  for (let i = 0; i < 4; i++) {
    const left = i % 2 ? WIDTH * .76 : WIDTH * .10;
    const y = HEIGHT * (.08 + rand() * .78);
    x.strokeStyle = i < 2 ? fadedPaint : concrete;
    x.globalAlpha = .15 + rand() * .16;
    x.lineWidth = 10 + rand() * 21;
    x.beginPath(); x.moveTo(left, y); x.lineTo(left + 74, y - 15); x.lineTo(left + 46, y + 27);
    x.lineTo(left + 132, y + 9); x.stroke();
  }
  return cv;
}

export function makeGraffitiWall({ model, surface, seed, spec }) {
  const group = model?.clone() || new THREE.Group();
  if (!model) {
    const body = new THREE.Mesh(slab, plain), top = new THREE.Mesh(lip, cap);
    body.position.y = 1.1; top.position.y = 2.22;
    group.add(body, top);
  }
  group.traverse(node => {
    if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; }
  });
  const flip = seed % 2 === 0;
  const base = wallBase(surface, seed, flip);
  const artCanvas = art => {
    const cv = canvas(), x = cv.getContext('2d');
    x.save();
    if (window.CITY_GFX) {
      const paint = CITY_GFX.graf({ ...art, w: WIDTH, h: HEIGHT, scale: 1, seed: seed + 17, mural: true });
      x.drawImage(paint, 0, 0);
      const wear = surface.masks[Number(flip)];
      if (wear) {
        x.globalCompositeOperation = 'destination-out';
        x.drawImage(wear, 0, 0, WIDTH, HEIGHT);
      }
    }
    x.globalCompositeOperation = 'destination-over';
    x.drawImage(base, 0, 0);
    x.restore();
    return cv;
  };
  const cv = artCanvas(spec), tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const face = new THREE.Mesh(front, new THREE.MeshStandardMaterial({
    map: tex, roughness: .90, emissiveMap: tex, emissive: '#b4b4b4', emissiveIntensity: .15,
  }));
  face.name = 'Painted concrete';
  face.position.set(0, 1.10, model ? .134 : .144);
  face.receiveShadow = true;
  group.add(face);
  return { group, cv, tex, artCanvas };
}

export function revealGraffiti({ cv, tex }, old, next, progress) {
  const x = cv.getContext('2d'), edge = cv.width * progress;
  if (progress >= 1) x.drawImage(next, 0, 0);
  else {
    x.drawImage(old, 0, 0);
    if (progress > 0) x.drawImage(next, 0, 0, edge, cv.height, 0, 0, edge, cv.height);
  }
  if (progress > 0 && progress < 1) {
    const spray = x.createLinearGradient(edge - 13, 0, edge + 13, 0);
    spray.addColorStop(0, 'rgba(255,196,143,0)');
    spray.addColorStop(.5, 'rgba(255,216,181,.24)');
    spray.addColorStop(1, 'rgba(255,196,143,0)');
    x.fillStyle = spray; x.fillRect(edge - 13, cv.height * .07, 26, cv.height * .86);
    x.fillStyle = 'rgba(255,224,193,.45)';
    for (let i = 0; i < 15; i++) {
      const dx = 13 * Math.sin(progress * 135 + i * 2.40);
      const y = cv.height * (.10 + ((i * .618 + progress * .96) % 1) * .80);
      x.fillRect(edge + dx, y, i % 3 + 1, i % 3 + 1);
    }
  }
  tex.needsUpdate = true;
}
