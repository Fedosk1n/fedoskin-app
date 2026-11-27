import * as THREE from 'three';

// This untextured Blender export is a small glTF subset. Using its original packed
// attributes keeps the mobile stage payload compact and avoids an additional addon.
export async function loadFestivalStage() {
  const response = await fetch('./anim/festival-stage.glb?v=1');
  if (!response.ok) throw new Error('Festival stage unavailable.');
  const binary = await response.arrayBuffer(), header = new DataView(binary);
  if (header.getUint32(0, true) !== 0x46546c67) throw new Error('Invalid stage model.');
  const jsonLength = header.getUint32(12, true);
  const gltf = JSON.parse(new TextDecoder().decode(new Uint8Array(binary, 20, jsonLength)));
  const base = 28 + jsonLength;
  const size = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  const read = index => {
    const a = gltf.accessors[index], b = gltf.bufferViews[a.bufferView];
    const types = { 5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
    const buffer = new types[a.componentType](binary, base + (b.byteOffset || 0) + (a.byteOffset || 0), a.count * size[a.type]);
    return new THREE.BufferAttribute(buffer, size[a.type], Boolean(a.normalized));
  };
  const mats = gltf.materials.map(m => {
    const pbr = m.pbrMetallicRoughness || {};
    const tint = new THREE.Color().fromArray(pbr.baseColorFactor || [1, 1, 1]);
    const glow = new THREE.Color().fromArray(m.emissiveFactor || [0, 0, 0]);
    return new THREE.MeshStandardMaterial({ color: tint, roughness: pbr.roughnessFactor ?? 1,
      metalness: pbr.metallicFactor ?? 0, emissive: glow,
      emissiveIntensity: m.extensions?.KHR_materials_emissive_strength?.emissiveStrength ?? 1 });
  });
  const primitive = p => {
    const geo = new THREE.BufferGeometry();
    for (const [tag, name] of Object.entries({ POSITION: 'position', NORMAL: 'normal', TEXCOORD_0: 'uv' })) {
      if (p.attributes[tag] !== undefined) geo.setAttribute(name, read(p.attributes[tag]));
    }
    if (p.indices !== undefined) geo.setIndex(read(p.indices));
    return new THREE.Mesh(geo, mats[p.material]);
  };
  const node = index => {
    const data = gltf.nodes[index], group = new THREE.Group();
    group.name = data.name || '';
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
