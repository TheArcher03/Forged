// The creek: moving ripples, sky and tree-line reflections, sun glitter, clear shallows and foam.
import * as THREE from 'three';
import * as W from './world.js';
import { U } from './shared.js';

export default function createWater(scene, T) {
  const pos = [], depth = [], idx = [];
  const X0 = -95, X1 = 95, STEP = 0.5, ACROSS = 22;
  const cols = Math.round((X1 - X0) / STEP);
  for (let i = 0; i <= cols; i++) {
    const x = X0 + i * STEP, cz = W.creekZ(x), hw = W.creekHalfWidth(x) * 1.3 + 0.6;
    for (let j = 0; j <= ACROSS; j++) {
      const z = cz + (j / ACROSS - 0.5) * 2 * hw;
      pos.push(x, W.WATER_LEVEL, z); depth.push(W.WATER_LEVEL - W.terrainHeight(x, z));
    }
  }
  for (let i = 0; i < cols; i++) for (let j = 0; j < ACROSS; j++) {
    const a = i * (ACROSS + 1) + j, b = a + ACROSS + 1;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aDepth', new THREE.Float32BufferAttribute(depth, 1));
  geo.setIndex(idx);

  const stones = W.STEPPING_STONES.map((s) => new THREE.Vector3(s.x, s.z, s.r));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      tN: { value: null }, uTime: { value: 0 }, uSunDir: { value: new THREE.Vector3() }, uSunColor: { value: new THREE.Color() }, uStones: { value: stones },
    }]),
    vertexShader: `
      attribute float aDepth; varying float vDepth; varying vec3 vW;
      #include <fog_pars_vertex>
      void main(){
        vDepth = aDepth; vW = position;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform sampler2D tN; uniform float uTime; uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uStones[${stones.length}];
      varying float vDepth; varying vec3 vW;
      #include <fog_pars_fragment>
      void main(){
        if (vDepth < -0.03) discard;
        vec2 uv = vW.xz; float t = uTime;
        float d = clamp(vDepth / 0.5, 0.0, 1.0);
        // three layers of ripples sliding downstream at different speeds
        vec3 a = texture2D(tN, uv * 0.30 + vec2(-t * 0.10, t * 0.015)).xyz * 2.0 - 1.0;
        vec3 b = texture2D(tN, uv * 0.85 + vec2(-t * 0.30, -t * 0.04)).xyz * 2.0 - 1.0;
        vec3 c = texture2D(tN, uv * 2.60 + vec2(-t * 0.65, t * 0.09)).xyz * 2.0 - 1.0;
        float chop = mix(0.6, 0.22, d);                       // shallows run faster and rougher
        vec3 N = normalize(vec3((a.x * 0.5 + b.x * 0.8 + c.x * 0.7) * chop, 1.0, (a.y * 0.5 + b.y * 0.8 + c.y * 0.7) * chop));
        vec3 Vd = normalize(cameraPosition - vW);
        float fres = 0.07 + 0.93 * pow(1.0 - max(dot(N, Vd), 0.0), 4.0);
        vec3 R = reflect(-Vd, N); R.y = abs(R.y);

        // what the water mirrors: glowing sky, with a dark band of forest along the horizon
        float sunSide = pow(max(dot(normalize(vec3(R.x, 0.0, R.z)), normalize(vec3(uSunDir.x, 0.0, uSunDir.z))), 0.0), 3.0);
        vec3 sky = mix(mix(vec3(0.62, 0.70, 0.80), vec3(1.5, 1.05, 0.7), sunSide), vec3(0.22, 0.36, 0.66), smoothstep(0.0, 0.75, R.y));
        float trees = smoothstep(0.52, 0.30, R.y + (a.x + b.y) * 0.22) * (1.0 - sunSide * 0.8);
        sky = mix(sky, vec3(0.02, 0.035, 0.018), trees);
        float sd = max(dot(R, uSunDir), 0.0);
        vec3 sun = uSunColor * (pow(sd, 900.0) * 90.0 + pow(sd, 60.0) * 1.2);

        vec3 body = mix(vec3(0.07, 0.09, 0.05), vec3(0.015, 0.06, 0.05), d);     // clear over the stones, green in the pools
        // wavering lines of light on the bed where the water is shallow
        vec3 g1 = texture2D(tN, uv * 0.55 + vec2(-t * 0.16, t * 0.05)).xyz, g2 = texture2D(tN, uv * 0.62 + vec2(-t * 0.11, -t * 0.07) + 0.37).xyz;
        float caustic = smoothstep(0.035, 0.0, abs(g1.x - g2.y)) + smoothstep(0.03, 0.0, abs(g1.y - g2.x)) * 0.7;
        body += vec3(1.0, 0.9, 0.66) * caustic * (1.0 - d * 0.8) * 0.3;
        float alpha = mix(0.3, 0.93, d) + caustic * 0.2;
        vec3 col = mix(body, sky, fres) + sun;
        alpha = mix(alpha, 1.0, clamp(fres + dot(sun, vec3(0.3)), 0.0, 1.0));

        // foam: along the banks, in the riffles, and curling round the stepping stones
        float n = b.z * 0.5 + 0.5, streak = texture2D(tN, uv * vec2(0.5, 2.2) + vec2(-t * 0.5, 0.0)).x;
        float foam = smoothstep(0.075, 0.01, vDepth) * smoothstep(0.35, 0.75, streak + c.x * 0.3);
        foam += smoothstep(0.24, 0.1, vDepth) * smoothstep(0.62, 0.9, streak) * 0.5;
        for (int i = 0; i < ${stones.length}; i++) {
          vec2 q = uv - uStones[i].xy; float r = length(q) - uStones[i].z;
          foam += smoothstep(0.32, 0.02, r) * smoothstep(-0.05, 0.02, r) * smoothstep(0.2, 0.7, streak + q.x * 0.9) * 0.9;
        }
        foam = clamp(foam, 0.0, 1.0);
        col = mix(col, vec3(1.15, 1.05, 0.92), foam * 0.75);
        alpha = max(alpha, foam * 0.85) * smoothstep(-0.03, 0.015, vDepth);
        gl_FragColor = vec4(col, alpha);
        #include <fog_fragment>
      }`,
  });
  mat.uniforms.tN.value = T.waterNormal;
  mat.uniforms.uSunDir.value.copy(U.uSunDir.value);
  mat.uniforms.uSunColor.value.copy(U.uSunColor.value);
  const water = new THREE.Mesh(geo, mat);
  water.renderOrder = 2; water.frustumCulled = false;
  scene.add(water);
  return () => { mat.uniforms.uTime.value = U.uTime.value; };
}
