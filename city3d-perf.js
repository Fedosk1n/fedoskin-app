// Keeping the 3D city light on phones (owner 17.11.2026: «на айфоне 17 про раз в 5 секунд притормаживает на 1-2 секунды (снижается фпс)…
// займись оптимизацией»). Measured headless before this file (yard): the picture itself ≈ 180 draw calls a frame, the SHADOWS ≈ 780 more —
// the moon and 3 lamp spots redrew every prop, every brick and every ear of every person into their shadow maps, every frame.
//
// SHADOW BATCHING. Everything that stands still casts its shadow as a few merged pieces (one per 8×8 m cell and shadow side) instead of
// hundreds of meshes. The pieces are depth-only geometry on layer 1: only the shadow cameras see that layer (they keep layer 0 too, for
// people and everything that moves), the main camera never draws them. The originals look and receive shadows exactly as before, they
// just stop casting. A watcher compares the originals with how they were: whatever moved, was hidden / shown, left the scene or changed its
// shape goes back to casting its own shadow, and its cell is rebuilt (one cell per frame). So nothing has to be marked by hand — a prop
// that starts moving later (a gate chain, a boat) fixes itself within a few frames.
import * as THREE from 'three';

export const SHADOW_LAYER = 1;
const STATIC_SHADOW_LAYER = 2;
const SHADOW_SIDE = { [THREE.FrontSide]: THREE.BackSide, [THREE.BackSide]: THREE.FrontSide, [THREE.DoubleSide]: THREE.DoubleSide };

// the depth-only stand-ins share one invisible material per shadow side (only the shadow pass draws them: they are on layer 1)
const _mats = new Map();
export function shadowMat(side) { let m = _mats.get(side); if (!m) { m = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }); m.shadowSide = side; _mats.set(side, m); } return m; }
export const shadowSideOf = mat => { if (Array.isArray(mat)) mat = mat[0]; return mat.shadowSide ?? SHADOW_SIDE[mat.side]; };
// one geometry (positions only) from many: list = [{ geo, e: 16 numbers (matrix into the target space) }]
export function mergePositions(list) {
  let nv = 0, ni = 0;
  for (const { geo } of list) { const n = geo.attributes.position.count; nv += n; ni += geo.index ? geo.index.count : n; }
  const P = new Float32Array(nv * 3), I = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  let vo = 0, io = 0;
  for (const { geo, e } of list) {
    const pa = geo.attributes.position, n = pa.count;
    const det = e[0] * (e[5] * e[10] - e[9] * e[6]) - e[4] * (e[1] * e[10] - e[9] * e[2]) + e[8] * (e[1] * e[6] - e[5] * e[2]);
    for (let i = 0; i < n; i++) {
      const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i), w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]), j = (vo + i) * 3;
      P[j] = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w; P[j + 1] = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w; P[j + 2] = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w;
    }
    const ix = geo.index, cnt = ix ? ix.count : n, at = k => ix ? ix.getX(k) : k;
    // a mirrored object (negative scale) is drawn with its faces flipped — baked, its winding has to be flipped too
    for (let k = 0; k < cnt; k += 3) { const a = at(k), b = at(k + 1), d = at(k + 2); I[io++] = vo + a; if (det < 0) { I[io++] = vo + d; I[io++] = vo + b; } else { I[io++] = vo + b; I[io++] = vo + d; } }
    vo += n;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setIndex(new THREE.BufferAttribute(I, 1)); g.computeBoundingSphere();
  return g;
}
export function shadowPiece(geo, side, name) {
  const m = new THREE.Mesh(geo, shadowMat(side)); m.name = name; m.userData.shadowBatch = true;
  m.layers.set(SHADOW_LAYER); m.castShadow = true; m.receiveShadow = false; return m;
}
// can this mesh's shadow be drawn by a merged stand-in (plain material, plain geometry)?
export function mergeable(ob) {
  const m = ob.material, g = ob.geometry;
  if (!ob.isMesh || ob.isSkinnedMesh || ob.isInstancedMesh || ob.isBatchedMesh || ob.customDepthMaterial) return false;
  // a box with a material per side (the yard's buildings) is fine too (22.11.2026): for a shadow only the shape counts — it used to cast
  // as 6 draws (one per material) in every shadow map, 48 draws a frame for the three buildings
  const ms = Array.isArray(m) ? m : [m];
  if (!ms.length || ms.some(x => !x || x.visible === false || x.isShaderMaterial || x.alphaTest > 0 || x.alphaToCoverage || x.alphaMap || x.displacementMap || x.wireframe)) return false;
  if (ms.some(x => shadowSideOf(x) !== shadowSideOf(ms[0]))) return false;
  if (!g || !g.attributes.position || Object.keys(g.morphAttributes || {}).length || g.drawRange.start !== 0 || g.drawRange.count !== Infinity) return false;
  return (g.index ? g.index.count : g.attributes.position.count) % 3 === 0;
}

export function shadowBatcher(scene, opt = {}) {
  const CELL = opt.cell || 8, SETTLE = opt.settle || 40, EVERY = opt.every || 4;
  const inScene = ob => { for (let q = ob; q; q = q.parent) { if (!q.visible) return false; if (q === scene) return true; } return false; };
  const person = ob => { for (let q = ob; q; q = q.parent) if (q.isBone || q.userData.person) return true; return false; };
  const fits = ob => ob.isMesh && ob.castShadow && !ob.userData.dyn && !ob.userData.shadowBatch && mergeable(ob) && !person(ob) && inScene(ob);
  let items = [], frame = 0, built = false, rr = 0, revision = 0;
  const cells = new Map(), dirty = new Set();
  const snap = it => { it.m.set(it.o.matrixWorld.elements); it.ver = it.o.geometry.attributes.position.version; it.geo = it.o.geometry; };
  const changed = it => {
    const o = it.o, e = o.matrixWorld.elements, s = it.m;
    for (let k = 0; k < 16; k++) if (e[k] !== s[k]) return true;
    return o.geometry !== it.geo || o.geometry.attributes.position.version !== it.ver || !inScene(o);
  };

  function init() {
    scene.updateMatrixWorld(true);
    items = []; scene.traverse(o => { if (fits(o)) { const it = { o, m: new Float64Array(16), dyn: false, cell: null }; snap(it); items.push(it); } });
  }
  const _b = new THREE.Box3(), _c = new THREE.Vector3();
  function place(it) {
    const g = it.o.geometry; if (!g.boundingBox) g.computeBoundingBox();
    _b.copy(g.boundingBox).applyMatrix4(it.o.matrixWorld); _b.getCenter(_c);
    const side = shadowSideOf(it.o.material);
    const key = Math.floor(_c.x / CELL) + ',' + Math.floor(_c.z / CELL) + ',' + side;
    let c = cells.get(key); if (!c) { c = { key, side, items: new Set(), mesh: null }; cells.set(key, c); }
    c.items.add(it); it.cell = c; dirty.add(c);   // it keeps casting its own shadow until its cell's merged piece exists (build)
  }
  function evict(it) {
    const c = it.cell; it.dyn = true; it.cell = null; it.o.castShadow = true;
    if (c) { c.items.delete(it); dirty.add(c); }
  }
  function build(c) {
    revision++;
    if (c.mesh) { scene.remove(c.mesh); c.mesh.geometry.dispose(); c.mesh = null; }
    if (!c.items.size) return;
    const m = shadowPiece(mergePositions([...c.items].map(it => ({ geo: it.o.geometry, e: it.m }))), c.side, 'shadow-batch ' + c.key);
    m.layers.set(STATIC_SHADOW_LAYER);
    m.matrixAutoUpdate = false; scene.add(m); c.mesh = m;
    for (const it of c.items) it.o.castShadow = false;
  }
  // call once per frame AFTER rendering (the renderer has just brought every matrixWorld up to date)
  function tick() {
    frame++;
    if (!built) {
      // settling: whatever moves in the first frames (dancers' props, records, boats, the runner) is dynamic for good
      for (const it of items) if (!it.dyn && changed(it)) it.dyn = true;
      // 22.11.2026: the first build is spread over frames (4 cells a frame; it was all ~26 cells in ONE frame — a 20 ms hitch on load)
      if (frame >= SETTLE) { for (const it of items) if (!it.dyn) place(it); built = true; }
      return;
    }
    const n = Math.ceil(items.length / EVERY);
    for (let k = 0; k < n && items.length; k++) { rr = (rr + 1) % items.length; const it = items[rr]; if (it.cell && changed(it)) evict(it); }
    for (let k = 0; k < (frame < SETTLE + 30 ? 4 : 1) && dirty.size; k++) { const c = dirty.values().next().value; dirty.delete(c); build(c); }
  }
  // the lights' shadow cameras see the merged pieces (layer 1) as well as everything else (layer 0)
  const staticLayers = new THREE.Layers();
  staticLayers.set(STATIC_SHADOW_LAYER);
  function useFor(light) { light.shadow.camera.layers.enable(SHADOW_LAYER); light.shadow.camera.layers.enable(STATIC_SHADOW_LAYER); }
  function cacheStatic(light, enabled) {
    const shadow = light.shadow;
    if (!enabled || !built || dirty.size || !cells.size) {
      if (shadow.staticDepthCache && !enabled) {
        shadow.staticDepthCache.target?.dispose();
        delete shadow.staticDepthCache;
      }
      if (shadow.staticDepthCache) shadow.staticDepthCache.active = false;
      return;
    }
    const cache = shadow.staticDepthCache ||= { layers: staticLayers };
    cache.active = true;
    cache.revision = revision;
  }
  init();
  return { tick, useFor, cacheStatic, stats: () => ({ items: items.length, batched: items.filter(i => i.cell).length, dyn: items.filter(i => i.dyn).length, cells: [...cells.values()].filter(c => c.mesh).length, built }) };
}

export function ambientPoseScheduler(scene) {
  const pending = new WeakMap(), frustum = new THREE.Frustum();
  const projection = new THREE.Matrix4(), envelope = new THREE.Sphere(new THREE.Vector3(), 2.4);
  let cameraReady = false;
  return {
    view(camera, cut) {
      cameraReady = !cut;
      if (cameraReady) frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    },
    elapsed(J, dt) {
      const p = J.root.position;
      envelope.center.set(p.x, p.y + .9, p.z);
      const elapsed = (pending.get(J) || 0) + dt;
      if (cameraReady && J.root.parent === scene && J.act && !frustum.intersectsSphere(envelope) && elapsed < .12) {
        pending.set(J, elapsed);
        return null;
      }
      pending.delete(J);
      return elapsed;
    },
    reset(J) { pending.delete(J); },
  };
}

// Cluster the rendered garment in bind space for its depth-only draw. Keep actual vertex
// positions and weights, and separate vertices that bend with different joints.
export function skinShadow(source, cell) {
  const geometry = source.geometry, material = source.material;
  const { position, skinIndex, skinWeight } = geometry.attributes;
  if (!geometry.index || !skinIndex || !skinWeight || material.alphaTest || material.alphaMap || material.displacementMap) return;
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox;
  const nx = 1 + Math.floor((max.x - min.x) / cell), ny = 1 + Math.floor((max.y - min.y) / cell);
  const offset = new Uint32Array(position.count), clusters = new Map(), reps = [], distances = [];
  const indices = skinIndex.array, weights = skinWeight.array;
  for (let i = 0; i < position.count; i++) {
    const x = (position.getX(i) - min.x) / cell, y = (position.getY(i) - min.y) / cell, z = (position.getZ(i) - min.z) / cell;
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    const spatial = ix + nx * (iy + ny * iz), j = i * 4;
    const second = weights[j + 1] >= .13 ? indices[j + 1] + 1 : 0;
    const key = ((spatial * 128 + indices[j]) * 128 + second) * 8 + Math.round(weights[j] * 6);
    let k = clusters.get(key);
    const low = position.getY(i) < .14;
    const distance = low ? position.getY(i) : (x - ix - .5) ** 2 + (y - iy - .5) ** 2 + (z - iz - .5) ** 2;
    if (k === undefined) {
      k = reps.length;
      clusters.set(key, k);
      reps.push(i); distances.push(distance);
    } else if (distance < distances[k]) {
      reps[k] = i; distances[k] = distance;
    }
    offset[i] = k;
  }
  const triangles = [], faces = geometry.index.array;
  for (let i = 0; i < faces.length; i += 3) {
    const a = offset[faces[i]], b = offset[faces[i + 1]], c = offset[faces[i + 2]];
    if (a !== b && b !== c && c !== a) triangles.push(a, b, c);
  }
  if (!triangles.length || triangles.length >= faces.length * .85) return;
  const proxy = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries({ position, skinIndex, skinWeight })) {
    const { array, itemSize, normalized } = attribute;
    const reduced = new array.constructor(reps.length * itemSize);
    reps.forEach((sourceVertex, vertex) => {
      for (let j = 0; j < itemSize; j++) reduced[vertex * itemSize + j] = array[sourceVertex * itemSize + j];
    });
    proxy.setAttribute(name, new THREE.BufferAttribute(reduced, itemSize, normalized));
  }
  proxy.setIndex(new THREE.BufferAttribute(reps.length > 65535 ? Uint32Array.from(triangles) : Uint16Array.from(triangles), 1));
  const caster = new THREE.SkinnedMesh(proxy, material);
  caster.name = 'Body shadow silhouette';
  caster.layers.set(SHADOW_LAYER);
  caster.castShadow = true;
  caster.customDepthMaterial = source.customDepthMaterial;
  caster.boundingSphere = source.boundingSphere.clone();
  source.parent.add(caster);
  caster.bind(source.skeleton, source.bindMatrix);
  source.castShadow = false;
}

// A PERSON's rigid parts (head, hair, cap, bag, knee pads…) ride on bones and never move against them: the shadow of all the parts on
// one bone is drawn as one merged piece hung on that bone (city3d-mocap.js calls this at the end of mocapPerson). Returns the pieces.
export function personShadows(root) {
  root.updateMatrixWorld(true);
  const groups = new Map(), inv = new THREE.Matrix4(), rel = new THREE.Matrix4();
  root.traverse(o => { if (!o.castShadow || !mergeable(o)) return; let b = o.parent; while (b && !b.isBone) b = b.parent; if (!b) return;
    const side = shadowSideOf(o.material), k = b.uuid + side; let g = groups.get(k); if (!g) groups.set(k, g = { b, side, list: [] });
    inv.copy(b.matrixWorld).invert(); rel.multiplyMatrices(inv, o.matrixWorld); g.list.push({ o, geo: o.geometry, e: rel.elements.slice() }); });
  const out = [];
  for (const { b, side, list } of groups.values()) { if (list.length < 2) continue;
    const m = shadowPiece(mergePositions(list), side, 'shadow-parts ' + b.name); b.add(m); list.forEach(x => { x.o.castShadow = false; }); out.push(m); }
  return out;
}

// small and flat things don't need to cast shadows at all: a 4 cm bolt or a paint line on the asphalt shows no shadow from 15 m up,
// but each one was one more draw call in every shadow map. Returns how many were switched off.
export function trimCasters(scene, minR = .06) {
  const bb = new THREE.Box3(), sz = new THREE.Vector3(), ws = new THREE.Vector3(); let n = 0;
  scene.updateMatrixWorld(true);
  scene.traverse(o => {
    if (!o.isMesh || !o.castShadow || o.isSkinnedMesh || o.userData.shadowBatch) return;
    for (let q = o.parent; q; q = q.parent) if (q.isBone || q.userData.person) return;   // people trim their own parts (city3d-mocap.js)
    const g = o.geometry; if (!g.boundingSphere) g.computeBoundingSphere(); if (!g.boundingBox) g.computeBoundingBox();
    o.getWorldScale(ws); const r = g.boundingSphere.radius * Math.max(Math.abs(ws.x), Math.abs(ws.y), Math.abs(ws.z));
    bb.copy(g.boundingBox).applyMatrix4(o.matrixWorld); bb.getSize(sz);
    if (r < minR || (sz.y < .06 && bb.max.y < .1)) { o.castShadow = false; n++; }
  });
  return n;
}
