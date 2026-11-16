// FORGED — Stone Age village. Builds the scene and lets you walk it in first person.
import * as THREE from 'three';
import * as W from './world.js';
import { U } from './shared.js';
import { makeTextures } from './textures.js';
import { createAtmosphere } from './atmosphere.js';
import { createTerrain } from './terrain.js';
import { loadScans } from './assets.js';

const EYE_HEIGHT = 1.65, WALK_SPEED = 3.5, JOG_SPEED = 6.0;

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
// keep the pixel count sensible on big or high-density screens
const pixelRatio = () => Math.min(window.devicePixelRatio, 1.5, Math.sqrt(2.0e6 / (window.innerWidth * window.innerHeight)));
renderer.setPixelRatio(pixelRatio());
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.62;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(64, window.innerWidth / window.innerHeight, 0.12, 9000);
camera.rotation.order = 'YXZ';

const T = await loadScans(makeTextures());
const atmosphere = createAtmosphere(scene, renderer);
createTerrain(scene, T);
const updaters = [];
for (const mod of ['grass', 'forest', 'cliff', 'water', 'village', 'effects', 'people']) {
  try {
    const m = await import(`./${mod}.js`);
    const up = await m.default(scene, T, { camera, renderer, atmosphere });
    if (up) updaters.push(up);
  } catch (err) { console.warn(`[${mod}]`, err.message); }
}

// ---- Player -------------------------------------------------------------------
const overlay = document.getElementById('overlay');
const player = { x: 0, z: 0, yaw: 0, pitch: 0, bob: 0, vx: 0, vz: 0, started: false };
const keys = new Set();
function reset() { Object.assign(player, { x: W.START.x, z: W.START.z, yaw: W.START.yaw, pitch: 0.03, bob: 0, vx: 0, vz: 0 }); }
reset();

overlay.addEventListener('click', () => {
  player.started = true; overlay.classList.add('hidden');
  renderer.domElement.requestPointerLock?.()?.catch?.(() => {});
});
renderer.domElement.addEventListener('click', () => { if (player.started) renderer.domElement.requestPointerLock?.()?.catch?.(() => {}); });
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== renderer.domElement) return;
  player.yaw -= e.movementX * 0.0021;
  player.pitch = W.clamp(player.pitch - e.movementY * 0.0021, -1.45, 1.45);
});
window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'KeyR') reset();
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  renderer.setPixelRatio(pixelRatio());
  renderer.setSize(window.innerWidth, window.innerHeight);
  atmosphere.composer.setPixelRatio(pixelRatio());
  atmosphere.resize(window.innerWidth, window.innerHeight);
});
atmosphere.resize(window.innerWidth, window.innerHeight);

function step(dt) {
  if (keys.has('ArrowLeft')) player.yaw += 1.6 * dt;
  if (keys.has('ArrowRight')) player.yaw -= 1.6 * dt;
  if (keys.has('ArrowUp')) player.pitch = Math.min(1.45, player.pitch + 1.1 * dt);
  if (keys.has('ArrowDown')) player.pitch = Math.max(-1.45, player.pitch - 1.1 * dt);

  let f = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
  let s = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
  let tx = 0, tz = 0;
  if (player.started && (f || s)) {
    const len = Math.hypot(f, s), jog = keys.has('ShiftLeft') || keys.has('ShiftRight');
    let speed = jog ? JOG_SPEED : WALK_SPEED;
    if (W.surfaceAt(player.x, player.z) === 'water') speed *= 0.7; // wading is slower
    const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
    tx = ((-sin * f + cos * s) / len) * speed; tz = ((-cos * f - sin * s) / len) * speed;
  }
  const ease = 1 - Math.exp(-dt * 9); // a little weight when starting and stopping
  player.vx += (tx - player.vx) * ease; player.vz += (tz - player.vz) * ease;
  const before = { x: player.x, z: player.z };
  player.x += player.vx * dt; player.z += player.vz * dt;
  W.resolveCollisions(player);
  player.bob += Math.hypot(player.x - before.x, player.z - before.z) * 1.9;

  const y = W.groundHeight(player.x, player.z) + EYE_HEIGHT + Math.sin(player.bob) * 0.028;
  camera.position.y += (y - camera.position.y) * (1 - Math.exp(-dt * 14)); // smooth over bumps
  camera.position.x = player.x + Math.cos(player.bob * 0.5) * 0.012; camera.position.z = player.z;
  camera.rotation.set(player.pitch, player.yaw, Math.sin(player.bob * 0.5) * 0.0025);
}
camera.position.y = W.groundHeight(W.START.x, W.START.z) + EYE_HEIGHT;

// Nothing that casts a shadow moves, so the sun's shadows are drawn once and kept.
atmosphere.sun.shadow.autoUpdate = false;
let shadowFrames = 3;

let last = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  U.uTime.value += dt;
  step(dt);
  if (window.forged.fly) { const f = window.forged.fly; camera.position.set(f.x, f.y, f.z); camera.rotation.set(f.pitch, f.yaw, 0); }
  if (shadowFrames > 0) { shadowFrames--; atmosphere.sun.shadow.needsUpdate = true; }
  camera.updateMatrixWorld();
  for (const up of updaters) up(dt, camera, player);
  atmosphere.render(camera);
});

// For checking views from the browser console: forged.go(x, z, yawDegrees, pitchDegrees)
window.forged = {
  player, world: W, renderer, scene, camera, atmosphere, U,
  go(x, z, yawDeg = 180, pitchDeg = 0) {
    player.started = true; overlay.classList.add('hidden');
    Object.assign(player, { x, z, yaw: (yawDeg * Math.PI) / 180, pitch: (pitchDeg * Math.PI) / 180, vx: 0, vz: 0 });
    camera.position.y = W.groundHeight(x, z) + EYE_HEIGHT;
  },
};
