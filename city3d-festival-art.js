import * as THREE from 'three';

// This untextured Blender export is a small glTF subset. Using its original packed
// attributes keeps the mobile stage payload compact and avoids an additional addon.
export function loadFestivalStage() { return loadUntexturedModel('./anim/festival-stage.glb?v=1'); }

export async function loadUntexturedModel(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error('City model unavailable.');
  const binary = await response.arrayBuffer(), header = new DataView(binary);
  if (header.getUint32(0, true) !== 0x46546c67) throw new Error('Invalid city model.');
  const jsonLength = header.getUint32(12, true);
  const gltf = JSON.parse(new TextDecoder().decode(new Uint8Array(binary, 20, jsonLength)));
  const base = 28 + jsonLength;
  const size = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  const read = index => {
    const a = gltf.accessors[index], b = gltf.bufferViews[a.bufferView];
    const types = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
    const Type = types[a.componentType], offset = base + (b.byteOffset || 0), width = size[a.type];
    if (b.byteStride) {
      const bytes = Type.BYTES_PER_ELEMENT;
      const data = new Type(binary, offset, b.byteLength / bytes);
      const interleaved = new THREE.InterleavedBuffer(data, b.byteStride / bytes);
      return new THREE.InterleavedBufferAttribute(interleaved, width, (a.byteOffset || 0) / bytes, Boolean(a.normalized));
    }
    const buffer = new Type(binary, offset + (a.byteOffset || 0), a.count * width);
    return new THREE.BufferAttribute(buffer, width, Boolean(a.normalized));
  };
  const mats = gltf.materials.map(m => {
    const pbr = m.pbrMetallicRoughness || {};
    const tint = new THREE.Color().fromArray(pbr.baseColorFactor || [1, 1, 1]);
    const glow = new THREE.Color().fromArray(m.emissiveFactor || [0, 0, 0]);
    return new THREE.MeshStandardMaterial({ name: m.name, color: tint, roughness: pbr.roughnessFactor ?? 1,
      metalness: pbr.metallicFactor ?? 0, emissive: glow,
      emissiveIntensity: m.extensions?.KHR_materials_emissive_strength?.emissiveStrength ?? 1 });
  });
  const primitive = p => {
    const geo = new THREE.BufferGeometry();
    for (const [tag, name] of Object.entries({ POSITION: 'position', NORMAL: 'normal', TEXCOORD_0: 'uv', COLOR_0: 'color' })) {
      if (p.attributes[tag] !== undefined) geo.setAttribute(name, read(p.attributes[tag]));
    }
    if (p.indices !== undefined) geo.setIndex(read(p.indices));
    const material = mats[p.material];
    if (!geo.hasAttribute('color')) return new THREE.Mesh(geo, material);
    const colored = material.clone();
    colored.vertexColors = true;
    return new THREE.Mesh(geo, colored);
  };
  const node = index => {
    const data = gltf.nodes[index], group = new THREE.Group();
    group.name = data.name || '';
    if (data.extras) group.userData = data.extras;
    if (data.translation) group.position.fromArray(data.translation);
    if (data.rotation) group.quaternion.fromArray(data.rotation);
    if (data.scale) group.scale.fromArray(data.scale);
    for (const p of gltf.meshes[data.mesh]?.primitives || []) group.add(primitive(p));
    for (const child of data.children || []) group.add(node(child));
    return group;
  };
  const model = new THREE.Group();
  for (const child of gltf.scenes[gltf.scene || 0].nodes) model.add(node(child));
  return model;
}
