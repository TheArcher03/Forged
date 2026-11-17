// Things that drift: smoke, flames, mist on the creek, dust in the sunlight, falling leaves.
import * as THREE from 'three';
import * as W from './world.js';
import { rng } from './noise.js';
import { U } from './shared.js';
import { SMOKE, FLAMES } from './village.js';

export default function createEffects(scene, T, { renderer }) {
  const r = rng(404);
  const px = renderer.getPixelRatio();

  // ---- smoke: soft puffs that rise, spread and lean with the wind
  {
    const PER = 46, n = SMOKE.length * PER;
    const origin = new Float32Array(n * 3), seed = new Float32Array(n * 4);
    SMOKE.forEach(([x, y, z, size], e) => {
      for (let i = 0; i < PER; i++) { const k = e * PER + i; origin.set([x, y, z], k * 3); seed.set([r(), r(), r(), size], k * 4); }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(origin, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    const smoke = new THREE.Points(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uTime: U.uTime, tPuff: { value: T.puff }, uSunDirView: U.uSunDirView, uScale: { value: renderer.domElement.height * 0.5 } },
      vertexShader: `
        attribute vec4 aSeed; uniform float uTime; uniform float uScale; varying float vAge; varying float vSeed; varying float vLit;
        uniform vec3 uSunDirView;
        void main(){
          float age = fract(uTime * (0.035 + aSeed.y * 0.015) + aSeed.x);
          vAge = age; vSeed = aSeed.z;
          float h = age * (9.0 + aSeed.y * 6.0) * aSeed.w;
          vec3 p = position + vec3(0.0, h, 0.0);
          p.x += age * age * 7.0 + sin(age * 9.0 + aSeed.z * 30.0) * 0.35 * age;     // wind carries it one way
          p.z += age * age * 3.0 + cos(age * 7.0 + aSeed.x * 30.0) * 0.35 * age;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vLit = 0.5 + 0.5 * dot(normalize(-mv.xyz), uSunDirView);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = min(uScale * (0.5 + age * 3.4) * aSeed.w / -mv.z, 900.0);
        }`,
      fragmentShader: `
        uniform sampler2D tPuff; varying float vAge; varying float vSeed; varying float vLit;
        void main(){
          vec2 uv = gl_PointCoord - 0.5; float a = vSeed * 6.283, c = cos(a), s = sin(a);
          float tex = texture2D(tPuff, vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y) + 0.5).a;
          float alpha = tex * smoothstep(0.0, 0.08, vAge) * pow(1.0 - vAge, 1.6) * 0.34;
          // back-lit smoke glows; smoke with the sun behind you is grey-blue
          vec3 col = mix(vec3(0.42, 0.44, 0.50), vec3(1.5, 1.05, 0.68), pow(1.0 - vLit, 2.0)) * mix(0.55, 1.0, vAge);
          gl_FragColor = vec4(col, alpha);
        }`,
    }));
    smoke.frustumCulled = false; smoke.renderOrder = 5; scene.add(smoke);
  }

  // ---- flames: ragged tongues on cards that turn to face you, plus firelight.
  // Each fire is several cards of different sizes and timings, so it never repeats.
  const lights = [], cards = [];
  const flameMat = (seed) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uSeed: { value: seed } }]),
    vertexShader: `varying vec2 vUv;
      #include <fog_pars_vertex>
      void main(){ vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform float uTime; uniform float uSeed; varying vec2 vUv;
      #include <fog_pars_fragment>
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
      float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * noise(p); p = p * 2.03 + 1.7; a *= 0.5; } return s; }
      void main(){
        vec2 p = vUv - vec2(0.5, 0.0); float t = uTime * 1.15 + uSeed * 7.0;
        float n  = fbm(vec2(p.x * 3.2 + uSeed, p.y * 2.4 - t * 2.4));
        float n2 = fbm(vec2(p.x * 7.0 - uSeed, p.y * 5.0 - t * 4.1));
        float x = p.x + (n - 0.5) * 0.42 * p.y + (n2 - 0.5) * 0.1;              // the flame sways and licks
        float width = mix(0.36, 0.03, pow(clamp(p.y, 0.0, 1.0), 0.75));
        float body = 1.0 - smoothstep(width * 0.35, width, abs(x));
        float top = smoothstep(0.98, 0.2 + 0.45 * n, p.y);                        // ragged, breaking tips
        float f = body * top * smoothstep(0.0, 0.07, p.y);
        f *= smoothstep(0.08, 0.5, n2 + 0.75 - p.y * 0.75);                       // tongues tear away near the top
        float core = pow(f, 2.5) * smoothstep(0.6, 0.05, p.y);
        vec3 col = vec3(0.9, 0.16, 0.02) * f * 1.6 + vec3(1.0, 0.5, 0.12) * pow(f, 1.5) * 2.6 + vec3(1.0, 0.86, 0.6) * core * 3.2;
        gl_FragColor = vec4(col, f);
        #include <fog_fragment>
      }`,
  });
  for (const fl of FLAMES) {
    if (fl.size > 0) for (let k = 0; k < 3; k++) {
      const s = fl.size * (k === 0 ? 1 : 0.62 + r() * 0.25), mat = flameMat(r() * 10);
      const g = new THREE.PlaneGeometry(1.0 * s, 1.55 * s); g.translate(0, 0.775 * s, 0);
      const card = new THREE.Mesh(g, mat);
      card.position.set(fl.x + (k ? (r() - 0.5) * 0.25 * fl.size : 0), fl.y - 0.02, fl.z + (k ? (r() - 0.5) * 0.25 * fl.size : 0));
      card.renderOrder = 4; card.frustumCulled = false; scene.add(card); cards.push(card);
    }
    if (fl.light) {
      const light = new THREE.PointLight(0xff7a2a, fl.light, 4 + Math.sqrt(fl.light) * 2.4, 1.8);
      light.position.set(fl.x, fl.y + 0.6 * Math.max(fl.size, 0.4), fl.z); scene.add(light); lights.push([light, fl.light, r() * 10]);
    }
  }

  // ---- sparks rising from the bigger fires
  {
    const sources = FLAMES.filter((fl) => fl.size >= 0.4), PER = 50, n = sources.length * PER;
    const pos = new Float32Array(n * 3), seed = new Float32Array(n * 4);
    sources.forEach((fl, e) => { for (let i = 0; i < PER; i++) { pos.set([fl.x, fl.y + 0.3 * fl.size, fl.z], (e * PER + i) * 3); seed.set([r(), r(), r(), fl.size], (e * PER + i) * 4); } });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    const embers = new THREE.Points(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: U.uTime, uPx: { value: px } },
      vertexShader: `attribute vec4 aSeed; uniform float uTime; uniform float uPx; varying float vA;
        void main(){ float age = fract(uTime * (0.22 + aSeed.x * 0.25) + aSeed.y); vA = (1.0 - age) * step(0.35, fract(aSeed.z * 7.0));
          float s = aSeed.w;
          vec3 p = position + vec3(sin(age * 9.0 + aSeed.z * 40.0) * 0.3 * s + age * age * 1.2 * s, age * 3.4 * s, cos(age * 7.0 + aSeed.x * 40.0) * 0.3 * s);
          vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = min(uPx * 30.0 / -mv.z, uPx * 4.0); }`,
      fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(vec3(1.0, 0.5, 0.15) * 6.0 * vA, vA); }`,
    }));
    embers.frustumCulled = false; scene.add(embers);
  }

  // ---- motes and seeds hanging in the light, and a few falling leaves; they follow the walker
  const follow = (count, box, size, color, fall, strength) => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) pos[i] = r() * box;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: fall ? THREE.NormalBlending : THREE.AdditiveBlending,
      uniforms: { uTime: U.uTime, uCam: { value: new THREE.Vector3() }, uSunDirView: U.uSunDirView, uPx: { value: px } },
      vertexShader: `
        uniform float uTime; uniform vec3 uCam; uniform vec3 uSunDirView; uniform float uPx; varying float vA;
        void main(){
          vec3 p = position;
          p.x += uTime * 0.22 + sin(uTime * 0.5 + position.y * 3.0) * 0.4;
          p.y += ${fall ? '-uTime * 0.7' : 'sin(uTime * 0.3 + position.x * 2.0) * 0.5'};
          p.z += uTime * 0.08 + cos(uTime * 0.4 + position.x * 3.0) * 0.4;
          p = mod(p - uCam, ${box.toFixed(1)}) - ${(box / 2).toFixed(1)} + uCam;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float toward = pow(clamp(dot(normalize(mv.xyz), uSunDirView), 0.0, 1.0), 2.0);   // brightest looking into the sun
          float d = -mv.z;
          vA = (${fall ? '0.9' : '0.10 + toward * 0.9'}) * smoothstep(${(box / 2).toFixed(1)}, ${(box / 2 - 3).toFixed(1)}, d) * smoothstep(0.3, 1.5, d);
          gl_Position = projectionMatrix * mv; gl_PointSize = clamp(uPx * ${size.toFixed(1)} / d, 1.0, 14.0 * uPx);
        }`,
      fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float s = smoothstep(0.5, ${fall ? '0.35' : '0.0'}, d);
        gl_FragColor = vec4(vec3(${color}) * ${strength.toFixed(2)}, s * vA); }`,
    }));
    pts.frustumCulled = false; pts.renderOrder = 6; scene.add(pts);
    return pts.material.uniforms.uCam.value;
  };
  const camA = follow(900, 22, 18, '1.0, 0.86, 0.6', false, 1.6);
  const camB = follow(70, 30, 60, '0.85, 0.55, 0.12', true, 0.9);

  // ---- mist lying on the creek and in the hollows
  {
    const spots = [];
    for (let i = 0; i < 70; i++) { const x = -70 + r() * 140; spots.push([x, 0.5 + r() * 0.9, W.creekZ(x) + (r() - 0.5) * 9, 7 + r() * 8]); }
    for (let i = 0; i < 50; i++) { const s = r() > 0.5 ? 1 : -1; spots.push([s * (24 + r() * 26), 0, 10 + r() * 80, 9 + r() * 10]); }
    const mist = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: T.puff, transparent: true, opacity: 0.085, depthWrite: false, color: 0xffd9b0, fog: false }), spots.length);
    const m = new THREE.Object3D();
    spots.forEach(([x, y, z, s], i) => {
      m.position.set(x, y > 0 ? y : W.terrainHeight(x, z) + 1.5 + r() * 3, z); m.rotation.set(-Math.PI / 2, 0, r() * 6.28); m.scale.set(s, s * 0.8, 1); m.updateMatrix(); mist.setMatrixAt(i, m.matrix);
    });
    mist.renderOrder = 3; mist.frustumCulled = false; scene.add(mist);
  }

  const _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);
  return (dt, camera) => {
    camA.copy(camera.position); camB.copy(camera.position);
    const t = U.uTime.value;
    for (const c of cards) {                                // turn each flame card to face the viewer, upright
      c.quaternion.setFromAxisAngle(_up, Math.atan2(camera.position.x - c.position.x, camera.position.z - c.position.z));
      c.material.uniforms.uTime.value = t;
    }
    for (const [light, base, seed] of lights) light.intensity = base * (0.78 + 0.16 * Math.sin(t * 11 + seed) + 0.1 * Math.sin(t * 23.7 + seed * 2) + 0.06 * Math.sin(t * 5.1));
  };
}
