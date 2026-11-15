// Sky, sun, clouds and the film-style finishing passes.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { U } from './shared.js';

export const FOG_COLOR = new THREE.Color(0.62, 0.52, 0.42);

export function createAtmosphere(scene, renderer) {
  const sunDir = U.uSunDir.value;

  // --- sky
  const makeSky = () => {
    const s = new Sky(); s.scale.setScalar(6000);
    const u = s.material.uniforms;
    u.turbidity.value = 4.5; u.rayleigh.value = 2.3; u.mieCoefficient.value = 0.0035; u.mieDirectionalG.value = 0.86;
    u.sunPosition.value.copy(sunDir);
    return s;
  };
  const sky = makeSky();
  scene.add(sky);

  // image-based lighting from the same sky, so everything picks up its colours
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene(); envScene.add(makeSky());
  scene.environment = pmrem.fromScene(envScene, 0.02).texture;
  scene.environmentIntensity = 1.0;
  pmrem.dispose();

  scene.fog = new THREE.FogExp2(FOG_COLOR, 0.0042);

  // --- sun
  const sun = new THREE.DirectionalLight(U.uSunColor.value, 6.2);
  sun.target.position.set(0, 2, 36);
  sun.position.copy(sun.target.position).addScaledVector(sunDir, 170);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -78, right: 78, top: 58, bottom: -52, near: 10, far: 420 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.06; sun.shadow.radius = 2.5;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight(0xa9c4ec, 0x5a4a30, 0.75)); // cool sky fill in the shade

  // --- drifting clouds, lit warm on the sun side
  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(3000, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.BackSide, fog: false,
      uniforms: { uTime: U.uTime, uSunDir: U.uSunDir },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform float uTime; uniform vec3 uSunDir; varying vec3 vDir;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
        float fbm(vec2 p){ float a = 0.5, s = 0.0; for(int i=0;i<6;i++){ s += a*noise(p); p = p*2.03 + 7.1; a *= 0.5; } return s; }
        float dens(vec2 p){ return smoothstep(0.42, 0.74, fbm(p)); }
        void main(){
          vec3 d = normalize(vDir);
          vec2 p = d.xz / (d.y + 0.12) * 1.1 + vec2(uTime * 0.004, uTime * 0.0015);
          float c = dens(p);
          float toward = dens(p + normalize(uSunDir.xz) * 0.09);
          float lit = clamp(0.55 + (c - toward) * 2.2, 0.0, 1.0);
          float nearSun = pow(max(dot(d, normalize(uSunDir)), 0.0), 6.0);
          vec3 shade = vec3(0.34, 0.33, 0.40), warm = vec3(1.25, 0.86, 0.56);
          vec3 col = mix(shade, warm, lit) * (0.75 + nearSun * 1.8);
          float a = c * smoothstep(0.015, 0.22, d.y) * 0.92;
          gl_FragColor = vec4(col, a);
        }`,
    }));
  clouds.renderOrder = -1; clouds.frustumCulled = false;
  scene.add(clouds);

  // --- finishing passes
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  let camera = null;
  const renderPass = new RenderPass(scene, null);
  composer.addPass(renderPass);

  // shafts of light streaming from the sun through trees and smoke
  const rays = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uSun: { value: new THREE.Vector2(0.5, 0.5) }, uStrength: { value: 0 }, uAspect: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform vec2 uSun; uniform float uStrength; uniform float uAspect; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec3 col = texture2D(tDiffuse, vUv).rgb;
        if (uStrength > 0.001) {
          const int N = 48;
          vec2 stp = (uSun - vUv) / float(N) * 0.92;
          vec2 p = vUv + stp * hash(gl_FragCoord.xy);
          vec3 acc = vec3(0.0); float w = 1.0;
          for (int i = 0; i < N; i++) {
            vec3 s = texture2D(tDiffuse, clamp(p, 0.001, 0.999)).rgb;
            float l = dot(s, vec3(0.3, 0.6, 0.1));
            acc += min(s, vec3(8.0)) * smoothstep(1.6, 4.0, l) * w;
            w *= 0.972; p += stp;
          }
          float dist = length((uSun - vUv) * vec2(uAspect, 1.0));
          col += acc / float(N) * uStrength * smoothstep(1.5, 0.0, dist);
        }
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  composer.addPass(rays);

  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.32, 0.85, 1.25);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // colour grade: gentle contrast, warm highlights, cool shadows, vignette, film grain
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: U.uTime },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform float uTime; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec3 c = texture2D(tDiffuse, vUv).rgb;
        float l = dot(c, vec3(0.299, 0.587, 0.114));
        c = mix(vec3(l), c, 1.06);
        c = mix(c, c * c * (3.0 - 2.0 * c), 0.32);
        c += mix(vec3(-0.012, 0.004, 0.022), vec3(0.024, 0.008, -0.02), smoothstep(0.15, 0.75, l));
        vec2 q = vUv - 0.5;
        c *= 1.0 - dot(q, q) * 0.55;
        c += (hash(gl_FragCoord.xy + fract(uTime) * 91.7) - 0.5) * 0.022;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  composer.addPass(grade);

  const v = new THREE.Vector3();
  return {
    sun, composer,
    resize(w, h) { composer.setSize(w, h); rays.uniforms.uAspect.value = w / h; },
    render(cam) {
      camera = cam; renderPass.camera = cam;
      sky.position.copy(cam.position); clouds.position.copy(cam.position);
      U.uSunDirView.value.copy(sunDir).transformDirection(cam.matrixWorldInverse);
      // where the sun sits on screen, and how much we are facing it
      v.copy(cam.position).addScaledVector(sunDir, 1000).project(cam);
      const facing = cam.getWorldDirection(new THREE.Vector3()).dot(sunDir);
      rays.uniforms.uSun.value.set(v.x * 0.5 + 0.5, v.y * 0.5 + 0.5);
      rays.uniforms.uStrength.value = THREE.MathUtils.smoothstep(facing, 0.15, 0.6) * 0.17;
      composer.render();
    },
  };
}
