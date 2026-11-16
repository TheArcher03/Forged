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

  // ---- flames: flickering tongues drawn on upright cards, plus firelight
  const lights = [];
  for (const [x, y, z, size] of FLAMES) {
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uTime: U.uTime, uSeed: { value: r() * 10 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform float uTime; uniform float uSeed; varying vec2 vUv;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
        void main(){
          vec2 p = vUv; float t = uTime * 1.9 + uSeed;
          float n = noise(vec2(p.x * 4.0 + uSeed, p.y * 3.0 - t * 2.2)) * 0.6 + noise(vec2(p.x * 9.0, p.y * 7.0 - t * 3.6)) * 0.4;
          float shape = 1.0 - abs(p.x - 0.5 + (n - 0.5) * 0.35 * p.y) * (2.2 + p.y * 3.0);
          float f = clamp(shape - p.y * (0.55 + n * 0.9), 0.0, 1.0);
          vec3 col = mix(vec3(1.0, 0.18, 0.02), vec3(1.0, 0.72, 0.22), f) * f * 5.5 + vec3(1.0, 0.95, 0.8) * pow(f, 4.0) * 4.0;
          gl_FragColor = vec4(col, f);
        }`,
    });
    for (let k = 0; k < 3; k++) {
      const card = new THREE.Mesh(new THREE.PlaneGeometry(1.25 * size, 1.7 * size), mat);
      card.position.set(x, y + 0.8 * size, z); card.rotation.y = (k / 3) * Math.PI; card.renderOrder = 4; scene.add(card);
    }
    const light = new THREE.PointLight(0xff7a2a, 26 * size * size, 16 * Math.sqrt(size), 1.8);
    light.position.set(x, y + 0.9 * size, z); scene.add(light); lights.push([light, 26 * size * size, r() * 10]);
  }

  // ---- embers rising from the village fire
  {
    const f = W.FIRE, n = 60, pos = new Float32Array(n * 3), seed = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos.set([f.x, W.terrainHeight(f.x, f.z) + 0.5, f.z], i * 3); seed.set([r(), r(), r()], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
    const embers = new THREE.Points(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: U.uTime, uPx: { value: px } },
      vertexShader: `attribute vec3 aSeed; uniform float uTime; uniform float uPx; varying float vA;
        void main(){ float age = fract(uTime * (0.25 + aSeed.x * 0.2) + aSeed.y); vA = 1.0 - age;
          vec3 p = position + vec3(sin(age * 9.0 + aSeed.z * 40.0) * 0.35 + age * age * 1.2, age * 3.6, cos(age * 7.0 + aSeed.x * 40.0) * 0.35);
          vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = min(uPx * 34.0 / -mv.z, uPx * 5.0); }`,
      fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(vec3(1.0, 0.5, 0.15) * 7.0 * vA, vA); }`,
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

  return (dt, camera) => {
    camA.copy(camera.position); camB.copy(camera.position);
    const t = U.uTime.value;
    for (const [light, base, seed] of lights) light.intensity = base * (0.78 + 0.16 * Math.sin(t * 11 + seed) + 0.1 * Math.sin(t * 23.7 + seed * 2) + 0.06 * Math.sin(t * 5.1));
  };
}
