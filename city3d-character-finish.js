import * as THREE from 'three';

// Rest-space material weights travel with the original mesh through skinning and batching.
export const FINISH = { clean: -1, cloth: 0, skin: 1, hair: 2, rubber: 3 };
const neutral = new THREE.DataTexture(new Uint8Array([128,128,128,255]),1,1);
neutral.needsUpdate = true;
const surface = {value:neutral};
let loading;

export function loadCharacterFinish() {
  loading ??= new THREE.TextureLoader().loadAsync(new URL('./img/city-character-finish.png?v=1',import.meta.url).href).then(texture => {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.NoColorSpace;
    texture.anisotropy = 2;
    surface.value = texture;
  }).catch(() => {});
  return loading;
}

export function characterFinish(shader) {
  shader.uniforms.cityFinish = surface;
  shader.vertexShader = shader.vertexShader.replace('void main() {', `
    attribute vec4 finishMix;
    varying vec4 vFinishMix;
    varying vec3 vFinishPosition, vFinishNormal;
    void main() {
      vFinishMix = finishMix;
      vFinishPosition = position;
      vFinishNormal = normal;
  `);
  shader.fragmentShader = shader.fragmentShader
    .replace('void main() {', `
      uniform sampler2D cityFinish;
      varying vec4 vFinishMix;
      varying vec3 vFinishPosition, vFinishNormal;
      void main() {
    `)
    .replace('#include <color_fragment>', `
      #include <color_fragment>
      vec4 fabricMix = vFinishMix;
      vec3 weights = abs(normalize(vFinishNormal + vec3(.000001)));
      weights *= weights;
      weights *= weights;
      weights /= weights.x + weights.y + weights.z;
      vec3 uvw = vFinishPosition * 4.3;
      vec3 dx = dFdx(uvw), dy = dFdy(uvw);
      vec3 finishGrain = vec3(0.);
      float detail = (1. - smoothstep(3.5, 10., length(vViewPosition))) * min(1., dot(fabricMix, vec4(1.)));
      if (detail > .005) {
        finishGrain = weights.x * textureGrad(cityFinish, uvw.zy, dx.zy, dy.zy).rgb
          + weights.y * textureGrad(cityFinish, uvw.xz, dx.xz, dy.xz).rgb
          + weights.z * textureGrad(cityFinish, uvw.xy, dx.xy, dy.xy).rgb - vec3(128. / 255.);
      }
      float fabricGrain = dot(finishGrain, vec3(fabricMix.x + .62 * fabricMix.w, fabricMix.y, fabricMix.z));
      float pigment = dot(finishGrain, vec3(.47 * fabricMix.x + .26 * fabricMix.w, .23 * fabricMix.y, .70 * fabricMix.z));
      diffuseColor.rgb *= (1. + detail * pigment);
      diffuseColor.rgb += detail * finishGrain.g * fabricMix.y * diffuseColor.rgb * vec3(.11, -.044, -.037);
    `)
    .replace('#include <normal_fragment_maps>', `
      #include <normal_fragment_maps>
      float weave = mix(.64,1.12,smoothstep(.72,.96,roughnessFactor));
      float relief = detail * fabricGrain * (.00064 * weave * fabricMix.x + .00034 * fabricMix.y + .00056 * fabricMix.z + .00039 * fabricMix.w);
      vec3 tangentX = dFdx(-vViewPosition), tangentY = dFdy(-vViewPosition);
      vec3 r1 = cross(tangentY, normal), r2 = cross(normal, tangentX);
      float plane = dot(tangentX,r1);
      vec3 gradient = (dFdx(relief) * r1 + dFdy(relief) * r2) * sign(plane) / max(abs(plane), .00000001);
      float gradientLength = length(gradient);
      normal = normalize(normal - gradient * min(1., .22 / max(gradientLength, .00001)));
      roughnessFactor = clamp(roughnessFactor + detail * fabricGrain * .37, 0., 1.);
    `);
}
