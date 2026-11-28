// Add the independent stage's practical lights to the city's existing direct-light pass.
// An inactive stage has one uniform branch and does no per-fragment light work.
// Changing the uniforms preserves the renderer's light count, program keys and material hooks.
import * as THREE from 'three';

const afterPointLights = '#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )';
const stageLighting = `
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
  if ( cityStageEnergy[ 0 ].w > 0.0 ) {
    for ( int stageIndex = 0; stageIndex < 3; stageIndex ++ ) {
      vec4 energy = cityStageEnergy[ stageIndex ];
      if ( energy.w <= 0.0 ) break;
      vec4 emitter = cityStagePosition[ stageIndex ];
      PointLight stageLight = PointLight( emitter.xyz, energy.xyz, emitter.w, energy.w );
      getPointLightInfo( stageLight, geometryPosition, directLight );
      RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
    }
  }
#endif
`;

export function festivalLightRig(camera) {
  const positions = new Float32Array(12);
  const energy = new Float32Array(12);
  const viewPoint = new THREE.Vector3();
  let lights = [];
  // ShaderLib is used by this city page. Keep each material's onBeforeCompile and cache key intact.
  const lightsFragment = THREE.ShaderChunk.lights_fragment_begin.replace(afterPointLights, stageLighting + afterPointLights);
  for (const shader of Object.values(THREE.ShaderLib)) {
    if (!shader.fragmentShader.includes('#include <lights_fragment_begin>')) continue;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <lights_pars_begin>', `#include <lights_pars_begin>
  uniform vec4 cityStagePosition[ 3 ];
  uniform vec4 cityStageEnergy[ 3 ];`)
      .replace('#include <lights_fragment_begin>', lightsFragment);
    // Packed typed arrays remain shared when Three clones a material's uniforms.
    shader.uniforms.cityStagePosition = { value: positions };
    shader.uniforms.cityStageEnergy = { value: energy };
  }
  return {
    set(sources) {
      lights = sources;
      energy.fill(0);
      for (const [i, source] of sources.entries()) {
        energy.set([source.color.r, source.color.g, source.color.b, source.decay], i * 4);
      }
    },
    view() {
      for (let i = 0; i < lights.length; i++) {
        const source = lights[i];
        viewPoint.copy(source.position).applyMatrix4(camera.matrixWorldInverse);
        const offset = i * 4;
        positions[offset] = viewPoint.x;
        positions[offset + 1] = viewPoint.y;
        positions[offset + 2] = viewPoint.z;
        positions[offset + 3] = source.distance;
      }
    },
  };
}

export function festivalLight(parent, offset, color, intensity, distance) {
  return {
    position: new THREE.Vector3(...offset).add(parent.position),
    color: new THREE.Color(color).multiplyScalar(intensity),
    decay: 2,
    distance,
  };
}
