// Values every shader shares: time, where the sun is, what colour it is.
import * as THREE from 'three';
import { SUN_DIR } from './world.js';

export const STATE = { paused: false, view: null, viewMix: 0, lastView: null };   // paused while trading; view = where the camera goes
export const DOOR_LEAVES = {};                // each family's door, so the trading code can swing it open

export const U = {
  uTime: { value: 0 },
  uSunDir: { value: new THREE.Vector3(SUN_DIR.x, SUN_DIR.y, SUN_DIR.z) },
  uSunDirView: { value: new THREE.Vector3() },
  uSunColor: { value: new THREE.Color(1.0, 0.74, 0.46) },
};

// Turns the brown scanned rock into pale chalk: the same stone, bleached.
export function bleach(material) {
  material.onBeforeCompile = (s) => {
    s.fragmentShader = s.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.33))), diffuseColor.rgb, 0.4) * vec3(2.3, 2.2, 1.95);`);
  };
  return material;
}

// Adds a gentle wind sway and a warm back-lit glow to a standard material (grass, leaves).
// opts.sway: metres of movement at full height; opts.heightExpr: GLSL giving 0..1 "how far up the plant".
export function windAndGlow(material, { sway = 0.1, flutter = 0.02, heightExpr = 'uv.y', glow = 0.5, upNormal = 0, rootDark = 1, softSides = true } = {}) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, { uTime: U.uTime, uSunDirView: U.uSunDirView, uSunColor: U.uSunColor });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying float vHeight;')
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        ${upNormal ? `objectNormal = normalize(mix(objectNormal, vec3(0.0, 1.0, 0.0), ${upNormal.toFixed(2)}));` : ''}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float hgt = ${heightExpr};
        vHeight = hgt;
        #ifdef USE_INSTANCING
          vec3 wp = (instanceMatrix * vec4(transformed, 1.0)).xyz;
        #else
          vec3 wp = transformed;
        #endif
        float gust = sin(uTime * 0.6 + wp.x * 0.07 + wp.z * 0.05) * 0.5 + 0.5;
        float w1 = sin(uTime * 1.7 + wp.x * 0.45 + wp.z * 0.3) * (0.35 + 0.65 * gust);
        float w2 = sin(uTime * 4.3 + wp.x * 2.1 + wp.z * 1.7 + wp.y * 1.3);
        vec3 push = vec3(w1 * ${sway.toFixed(3)} + w2 * ${flutter.toFixed(3)}, 0.0, w1 * ${(sway * 0.6).toFixed(3)} + w2 * ${(flutter * 0.7).toFixed(3)}) * hgt * hgt;
        #ifdef USE_INSTANCING
          mat3 windM = mat3(instanceMatrix);            // keep the wind blowing one way, whatever way the plant faces
          push = (push * windM) / dot(windM[0], windM[0]);
        #endif
        transformed += push;`);
    // light both sides of a leaf the same way, so foliage reads as a soft volume
    if (softSides) shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>',
      '#include <normal_fragment_begin>\n#ifdef DOUBLE_SIDED\n normal *= faceDirection;\n#endif');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uSunDirView;\nuniform vec3 uSunColor;\nvarying float vHeight;')
      .replace('#include <color_fragment>', `#include <color_fragment>\n diffuseColor.rgb *= mix(${rootDark.toFixed(2)}, 1.0, clamp(vHeight, 0.0, 1.0));`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        // light shining through thin leaves when you look toward the sun
        float back = pow(clamp(dot(normalize(vViewPosition), -uSunDirView), 0.0, 1.0), 3.0);
        totalEmissiveRadiance += diffuseColor.rgb * uSunColor * back * ${glow.toFixed(2)} * (0.3 + 0.7 * vHeight);`);
    material.userData.shader = shader;
  };
  return material;
}
