// The villagers of Greyford: eight people who run their own households, visit each
// other, fetch water, sit by the fire, and come up to the workshop as customers.
//
// Bodies: one rigged human (a Ready Player Me avatar, non-commercial licence) re-dressed
// in hide and fur and varied per person. Movement: motion-captured idle / walk / run
// (Mixamo, via the Three.js example "Xbot"), plus small code-driven poses for work and sitting.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import * as W from './world.js';
import { rng } from './noise.js';
import { U } from './shared.js';

const TAU = Math.PI * 2;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// ---- who lives here -------------------------------------------------------------
// h = height scale, wide = build, head = 'cap' | 'hair' | 'bun', stoop in radians.
const VILLAGERS = [
  { name: 'Tamsa',    home: 'hide',   h: 0.95, wide: 0.90, skin: 0xd9a98a, top: 0x9a6a3e, legs: 0x4a3524, head: 'bun',  hair: 0x1c130d, speed: 1.45 },
  { name: 'Brok',     home: 'hide',   h: 1.08, wide: 1.12, skin: 0xc9977a, top: 0x4f3a2a, legs: 0x33261c, head: 'cap',  hair: 0x2a1c12, tash: true, beard: true, mantle: 0x3a2d24, speed: 1.25 },
  { name: 'Pell',     home: 'hide',   h: 0.62, wide: 0.95, skin: 0xe0b596, top: 0xa9824f, legs: 0x5a4330, head: 'hair', hair: 0x3a2616, speed: 2.9, child: true },
  { name: 'Oda',      home: 'hearth', h: 0.90, wide: 0.94, skin: 0xcfa58c, top: 0x7a6650, legs: 0x4d3f33, head: 'bun',  hair: 0xb9b4ab, mantle: 0x8d8478, stoop: 0.34, speed: 0.85 },
  { name: 'Sefa',     home: 'hearth', h: 0.96, wide: 0.88, skin: 0xdcae90, top: 0xb08a58, legs: 0x5e4a36, head: 'bun',  hair: 0x4a2f1a, speed: 1.5 },
  { name: 'Ilo',      home: 'clay',   h: 1.00, wide: 0.98, skin: 0xc79274, top: 0x6e5038, legs: 0x3d2e22, head: 'hair', hair: 0x150f0b, tash: true, speed: 1.3 },
  { name: 'Nee',      home: 'clay',   h: 0.97, wide: 0.90, skin: 0xd6a586, top: 0x8a4b33, legs: 0x4a3524, head: 'bun',  hair: 0x5a2c16, speed: 1.4 },
  { name: 'Greyhand', home: null,     h: 0.98, wide: 1.00, skin: 0xc49a80, top: 0x5a4a3c, legs: 0x3a3028, head: 'cap',  hair: 0xb5aa9c, tash: true, beard: true, mantle: 0x7a6f62, stoop: 0.26, speed: 0.9 },
];

// ---- places people stand, sit and work --------------------------------------------
// face: the point they look toward once there. pose: how they hold themselves.
function buildSpots() {
  const S = {}, f = W.FIRE;
  const add = (key, x, z, fx, fz, pose, extra = {}) => { S[key] = { key, x, z, face: { x: fx, z: fz }, pose, ...extra }; };
  // the Hide House: three stretched hides, the smoke tent, the woodpile
  for (const [i, [x, z, ang]] of [[6.2, 12.4, 0.5], [5.6, 19.6, -0.35], [8.3, 21.6, 0.9]].entries()) {
    const nx = -Math.sin(ang), nz = Math.cos(ang);
    add(`hide${i}`, x - nx * 0.95, z - nz * 0.95, x, z, 'scrape');
  }
  add('smokeTent', 14.9, 19.6, 16.2, 20.6, 'tend');
  add('hideWood', 12.6, 11.9, 13.6, 11.2, 'tend');
  // the Hearth House: oven, grinding by the grain jars, the bench
  add('oven', 4.75, 43.6, 6.6, 43.6, 'tend');
  add('grind', 5.9, 41.7, 5.0, 42.0, 'scrape');
  add('benchA', 6.0, 39.45, f.x, f.z, 'sit', { drop: 0.41 });
  add('benchB', 7.05, 39.8, f.x, f.z, 'sit', { drop: 0.41 });
  add('hearthWood', 15.8, 37.9, 17.0, 37.2, 'tend');
  // the Clay House: kiln, pots
  add('kiln', -3.9, 21.0, -5.6, 21.4, 'tend');
  add('potsA', -6.0, 27.6, -7.4, 26.6, 'scrape');
  add('potsB', -9.6, 26.4, -8.0, 26.8, 'tend');
  // the village fire: three log seats, three places to stand
  for (const [i, [a, d]] of [[0.5, 2.6], [2.5, 2.7], [4.4, 2.5]].entries())
    add(`fireSit${i}`, f.x + Math.cos(a) * (d - 0.12), f.z + Math.sin(a) * (d - 0.12), f.x, f.z, 'sit', { drop: 0.5, social: true });
  for (const [i, a] of [1.5, 3.45, 5.5].entries())
    add(`fireStand${i}`, f.x + Math.cos(a) * 2.25, f.z + Math.sin(a) * 2.25, f.x, f.z, 'stand', { social: true, warm: true });
  // the ford: fetching water
  add('fordA', 1.9, 2.9, 1.9, 0, 'crouch');
  add('fordB', -3.4, 3.1, -3.4, 0, 'crouch');
  // our workshop: where a customer stands, where one waits, Old Greyhand's corner
  add('shop', 2.55, 56.0, 3.6, 56.6, 'shop');
  add('shopWait', -2.2, 52.4, 0, 58, 'stand');
  add('greyBench', -1.75, 61.2, -2.9, 61.6, 'scrape');
  add('greyWatch', 3.4, 52.2, 0, 44, 'stand');
  // doors
  for (const b of W.HOUSES) { const d = W.doorOf(b); add(`door_${b.key}`, d.x + d.dir * 0.95, d.z, b.x, b.z, 'inside'); }
  return S;
}

// What each person tends to do. [kind, spots, weight, min seconds, max seconds]
const HABITS = {
  Tamsa:    [['work', ['hide0', 'hide1', 'hide2'], 5, 22, 45], ['social', null, 1.5, 18, 35], ['water', null, 1, 7, 11], ['home', null, 1, 10, 22]],
  Brok:     [['work', ['hide0', 'hide1', 'hide2', 'smokeTent', 'hideWood'], 5, 20, 40], ['social', null, 1.5, 20, 40], ['water', null, 1.5, 7, 11], ['home', null, 0.7, 10, 20]],
  Pell:     [['roam', null, 6, 2, 6], ['social', null, 1.2, 8, 16], ['water', null, 1.2, 5, 9], ['home', null, 0.6, 6, 12]],
  Oda:      [['work', ['benchA', 'benchB'], 6, 40, 80], ['work', ['oven'], 1, 15, 25], ['social', null, 1.2, 30, 55], ['home', null, 1, 15, 30]],
  Sefa:     [['work', ['oven', 'grind', 'hearthWood'], 6, 20, 40], ['water', null, 2, 7, 11], ['social', null, 1.2, 15, 30], ['home', null, 0.8, 10, 20]],
  Ilo:      [['work', ['kiln', 'potsA', 'potsB'], 7, 25, 50], ['social', null, 0.8, 15, 30], ['home', null, 1, 12, 25]],
  Nee:      [['work', ['potsA', 'potsB', 'kiln'], 4, 18, 35], ['social', null, 2.2, 18, 35], ['water', null, 1.2, 7, 11], ['home', null, 0.8, 10, 20]],
  Greyhand: [['work', ['greyBench'], 3, 30, 60], ['work', ['greyWatch'], 2, 20, 40], ['social', null, 3.5, 35, 70]],
};

// Code-driven poses, layered on top of the motion-captured idle. Each entry:
// [bone, axis, angle, sway amount, sway speed, sway phase]
export const POSES = {
  sit:    [['Spine', 'x', 0.1, 0.02, 0.6, 0], ['LeftUpLeg', 'x', -1.45, 0, 0, 0], ['RightUpLeg', 'x', -1.45, 0, 0, 0], ['LeftLeg', 'x', 1.5, 0, 0, 0], ['RightLeg', 'x', 1.5, 0, 0, 0],
           ['LeftArm', 'x', -0.45, 0, 0, 0], ['RightArm', 'x', -0.45, 0, 0, 0], ['LeftForeArm', 'x', -0.7, 0, 0, 0], ['RightForeArm', 'x', -0.7, 0, 0, 0]],
  scrape: [['Spine', 'x', 0.3, 0.05, 2.2, 0], ['Spine1', 'x', 0.14, 0.04, 2.2, 0.4], ['Neck', 'x', 0.2, 0, 0, 0], ['LeftArm', 'x', -0.9, 0.2, 2.2, 0], ['RightArm', 'x', -0.9, 0.2, 2.2, 0.5],
           ['LeftForeArm', 'x', -0.7, 0.2, 2.2, 1.0], ['RightForeArm', 'x', -0.7, 0.2, 2.2, 1.5]],
  tend:   [['Spine', 'x', 0.2, 0.05, 1.1, 0], ['Neck', 'x', 0.18, 0, 0, 0], ['RightArm', 'x', -1.0, 0.3, 1.1, 0.3], ['RightForeArm', 'x', -0.6, 0.3, 1.1, 1.2], ['LeftArm', 'x', -0.3, 0.1, 1.1, 2.0]],
  warm:   [['LeftArm', 'x', -0.85, 0.04, 0.9, 0], ['RightArm', 'x', -0.85, 0.04, 0.9, 1], ['LeftForeArm', 'x', -0.5, 0.05, 1.3, 0], ['RightForeArm', 'x', -0.5, 0.05, 1.3, 1]],
};
const AXES = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };

// ---- building the bodies ------------------------------------------------------------
// The motion capture was recorded on a different skeleton, whose bones rest at different
// angles. So each movement is re-recorded for our body: for every moment, work out how far
// each source bone has turned from its own rest, and turn our matching bone by the same amount.
const CHAIN = [['Hips', 'Spine'], ['Spine', 'Spine1'], ['Spine1', 'Spine2'], ['Spine2', 'Neck'], ['Neck', 'Head'],
  ...['Left', 'Right'].flatMap((s) => [[`${s}Shoulder`, `${s}Arm`], [`${s}Arm`, `${s}ForeArm`], [`${s}ForeArm`, `${s}Hand`], [`${s}Hand`, `${s}HandMiddle1`],
    [`${s}UpLeg`, `${s}Leg`], [`${s}Leg`, `${s}Foot`], [`${s}Foot`, `${s}ToeBase`]])];

function transferMotion(sourceScene, sourceClips, targetScene) {
  const src = {}, tgt = {}, order = [];
  sourceScene.traverse((o) => { if (o.isBone) src[o.name.replace('mixamorig', '')] = o; });
  targetScene.traverse((o) => { if (o.isBone) { tgt[o.name] = o; order.push(o); } });
  const wq = (o) => o.getWorldQuaternion(new THREE.Quaternion()), wp = (o) => o.getWorldPosition(new THREE.Vector3());
  sourceScene.updateMatrixWorld(true); targetScene.updateMatrixWorld(true);
  const srcRest = Object.fromEntries(Object.entries(src).map(([k, o]) => [k, wq(o)]));
  const srcHipY = wp(src.Hips).y, tgtHipY = tgt.Hips.position.y;
  const keep = order.map((o) => o.quaternion.clone());

  // stand our body in the same rest stance as the source (arms out), limb by limb
  for (const [a, b] of CHAIN) {
    if (!src[a] || !src[b] || !tgt[a] || !tgt[b]) continue;
    const want = wp(src[b]).sub(wp(src[a])).normalize(), have = wp(tgt[b]).sub(wp(tgt[a])).normalize();
    const fix = new THREE.Quaternion().setFromUnitVectors(have, want), parent = wq(tgt[a].parent);
    tgt[a].quaternion.copy(parent.clone().invert().multiply(fix).multiply(wq(tgt[a])));
    tgt[a].updateMatrixWorld(true);
  }
  const tgtRest = Object.fromEntries(order.map((o) => [o.name, wq(o)]));
  const armature = wq(tgt.Hips.parent);

  const mixer = new THREE.AnimationMixer(sourceScene), out = {};
  for (const clip of sourceClips) {
    const action = mixer.clipAction(clip); action.play();
    const frames = Math.max(2, Math.round(clip.duration * 30) + 1), times = new Float32Array(frames);
    const quats = Object.fromEntries(order.filter((o) => src[o.name]).map((o) => [o.name, new Float32Array(frames * 4)])), hip = new Float32Array(frames * 3);
    const world = {};
    for (let f = 0; f < frames; f++) {
      const t = Math.min(clip.duration, (f / (frames - 1)) * clip.duration); times[f] = t;
      mixer.setTime(t); sourceScene.updateMatrixWorld(true);
      for (const o of order) {
        const parent = o.parent?.isBone ? world[o.parent.name] : armature;
        if (!src[o.name]) { world[o.name] = parent.clone().multiply(o.quaternion); continue; }
        const w = wq(src[o.name]).multiply(srcRest[o.name].clone().invert()).multiply(tgtRest[o.name]);
        world[o.name] = w;
        parent.clone().invert().multiply(w).toArray(quats[o.name], f * 4);
      }
      hip[f * 3 + 1] = tgtHipY * (wp(src.Hips).y / srcHipY);        // keep the bob, drop the travel: the code moves them
    }
    action.stop(); mixer.uncacheClip(clip);
    const tracks = Object.entries(quats).map(([name, v]) => new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, times, v));
    tracks.push(new THREE.VectorKeyframeTrack('Hips.position', times, hip));
    out[clip.name] = new THREE.AnimationClip(clip.name, clip.duration, tracks);
  }
  order.forEach((o, i) => o.quaternion.copy(keep[i]));              // put our body back as it was
  targetScene.updateMatrixWorld(true);
  return out;
}

// Turn one bone about an axis of the whole body (x = side to side, y = up, z = front to back).
const _pw = new THREE.Quaternion(), _rw = new THREE.Quaternion(), _r = new THREE.Quaternion(), _ax = new THREE.Vector3();
function turn(root, bone, axis, angle) {
  if (!bone || Math.abs(angle) < 1e-4) return;
  bone.parent.getWorldQuaternion(_pw); root.getWorldQuaternion(_rw);
  _r.setFromAxisAngle(_ax.copy(AXES[axis]).applyQuaternion(_rw), angle);
  bone.quaternion.premultiply(_pw.clone().invert().multiply(_r).multiply(_pw));
  bone.updateMatrixWorld(true);
}

// A second skin over part of a body: the chosen triangles, pushed out a little, moving with the same bones.
function shell(geo, keep, push, squash) {
  const P = geo.attributes.position, N = geo.attributes.normal, map = new Map(), idx = [];
  const out = { position: [], normal: [], uv: [], skinIndex: [], skinWeight: [] };
  const ok = (i) => keep(P.getX(i), P.getY(i), P.getZ(i));
  const src = geo.index.array;
  for (let t = 0; t < src.length; t += 3) {
    const tri = [src[t], src[t + 1], src[t + 2]];
    if (!tri.every(ok)) continue;
    for (const i of tri) {
      if (!map.has(i)) {
        map.set(i, out.position.length / 3);
        let x = P.getX(i) + N.getX(i) * push, y = P.getY(i) + N.getY(i) * push, z = P.getZ(i) + N.getZ(i) * push;
        if (squash) [x, y, z] = squash(x, y, z);
        out.position.push(x, y, z); out.normal.push(N.getX(i), N.getY(i), N.getZ(i));
        out.uv.push(geo.attributes.uv.getX(i), geo.attributes.uv.getY(i));
        for (const k of ['skinIndex', 'skinWeight']) { const a = geo.attributes[k]; out[k].push(a.getX(i), a.getY(i), a.getZ(i), a.getW(i)); }
      }
      idx.push(map.get(i));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out.position, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(out.normal, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(out.uv, 2));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(out.skinIndex, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(out.skinWeight, 4));
  g.setIndex(idx);
  return g;
}

function furTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const g = cv.getContext('2d'), r = rng(909);
  g.fillStyle = '#6a6259'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5200; i++) {
    const x = r() * 256, y = r() * 256, l = 6 + r() * 12, v = 60 + r() * 150;
    g.strokeStyle = `rgb(${v},${v * 0.96},${v * 0.9})`; g.lineWidth = 0.8 + r() * 0.8;
    for (const o of [-256, 0, 256]) { g.beginPath(); g.moveTo(x + o, y); g.lineTo(x + o + (r() - 0.5) * 5, y + l); g.stroke(); g.beginPath(); g.moveTo(x, y + o); g.lineTo(x + (r() - 0.5) * 5, y + o + l); g.stroke(); }
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 5);
  return t;
}

export default async function createPeople(scene, T, { renderer }) {
  const loader = new GLTFLoader();
  const [bodyFile, moveFile] = await Promise.all([loader.loadAsync('assets/people/readyplayer.me.glb'), loader.loadAsync('assets/people/Xbot.glb')]);
  const base = bodyFile.scene, part = {};
  const clips = transferMotion(moveFile.scene, moveFile.animations, base);
  base.traverse((o) => { if (o.isMesh) part[o.name] = o; });

  const fur = furTexture();
  const hideTex = T.hide.map.clone(); hideTex.repeat.set(4, 4); hideTex.needsUpdate = true;
  const hideNor = T.hide.normalMap.clone(); hideNor.repeat.set(4, 4); hideNor.needsUpdate = true;
  const hide = (color) => new THREE.MeshStandardMaterial({ map: hideTex, normalMap: hideNor, color, roughness: 0.86 });
  const furMat = (color) => new THREE.MeshStandardMaterial({ map: fur, color, roughness: 1 });

  // garments and hair, made once from the base body and shared by everyone
  const HAT = 1.762, top = part.Wolf3D_Outfit_Top.geometry, head = part.Wolf3D_Head.geometry, wear = part.Wolf3D_Headwear.geometry;
  const garments = {
    mantle: shell(top, (x, y) => y > 1.36 && Math.abs(x) < 0.27, 0.024),                                   // fur over the shoulders
    wraps: shell(part.Wolf3D_Outfit_Bottom.geometry, (x, y) => y < 0.42, 0.014),                           // fur bound round the shins
    belt: shell(top, (x, y) => y > 0.98 && y < 1.07 && Math.abs(x) < 0.24, 0.012),
    hair: shell(head, (x, y, z) => (y > 1.772 && z < 0.1) || (y > 1.70 && z < 0.005) || (y > 1.735 && z < 0.06 && Math.abs(x) > 0.07), 0.011),
    beard: shell(head, (x, y, z) => y > 1.555 && y < 1.648 && z > -0.015, 0.012),
    bun: shell(wear, (x, y) => y < HAT, 0),                                                                // the hair, without the hat
    cap: shell(wear, () => true, 0, (x, y, z) => {                                                         // the hat, pulled down into a fur cap
      if (y < 1.70 || (z < -0.04 && y < HAT)) return [x, y, z];                                            // leave the hair at the back alone
      const cz = 0.02, r = Math.hypot(x, z - cz), lim = 0.12, k = r > lim ? (lim + (r - lim) * 0.04) / r : 1;
      return [x * k, y < HAT ? y : HAT + 0.012 + (y - HAT) * 0.8, cz + (z - cz) * k];
    }),
  };

  const SPOTS = buildSpots(), taken = new Map();
  const people = [], rand = rng(777);
  const pick = (list) => list[Math.floor(rand() * list.length)];

  for (const [i, spec] of VILLAGERS.entries()) {
    const root = cloneSkinned(base), bones = {}, meshes = {};
    root.traverse((o) => { if (o.isBone) bones[o.name] = o; if (o.isMesh) meshes[o.name] = o; });
    const skinTint = new THREE.Color(0xffffff).lerp(new THREE.Color(spec.skin), 0.5);
    const dress = (name, mat) => { meshes[name].material = mat; };
    for (const n of ['Wolf3D_Head', 'Wolf3D_Body']) { const m = meshes[n].material.clone(); m.color.copy(skinTint); m.roughness = 0.7; dress(n, m); }
    dress('Wolf3D_Outfit_Top', hide(spec.top));
    dress('Wolf3D_Outfit_Bottom', hide(spec.legs));
    dress('Wolf3D_Outfit_Footwear', hide(new THREE.Color(spec.legs).multiplyScalar(0.7)));
    const hairMat = furMat(spec.hair);
    meshes.Wolf3D_Beard.visible = !!spec.tash;
    if (spec.tash) { const m = meshes.Wolf3D_Beard.material.clone(); m.color.set(spec.hair).multiplyScalar(2.2); dress('Wolf3D_Beard', m); }
    // headwear: a fur cap, or bare-headed with hair
    const hw = meshes.Wolf3D_Headwear;
    hw.geometry = spec.head === 'cap' ? garments.cap : garments.bun;
    hw.material = spec.head === 'cap' ? furMat(new THREE.Color(spec.mantle ?? 0x4a3a2c)) : hairMat;
    if (spec.head === 'hair') hw.visible = false;
    const wearOver = (src, geo, mat) => { const s = new THREE.SkinnedMesh(geo, mat); s.bind(src.skeleton, src.bindMatrix); src.parent.add(s); return s; };
    if (spec.head !== 'cap') wearOver(meshes.Wolf3D_Head, garments.hair, hairMat);
    if (spec.beard) wearOver(meshes.Wolf3D_Head, garments.beard, hairMat);
    if (spec.mantle) wearOver(meshes.Wolf3D_Outfit_Top, garments.mantle, furMat(spec.mantle));
    wearOver(meshes.Wolf3D_Outfit_Bottom, garments.wraps, furMat(new THREE.Color(spec.mantle ?? 0x6b5a48).multiplyScalar(0.9)));
    wearOver(meshes.Wolf3D_Outfit_Top, garments.belt, hide(0x2a1d14));
    root.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.receiveShadow = true; o.layers.enable(2); } });
    root.scale.set(spec.h * spec.wide, spec.h, spec.h * spec.wide);
    if (spec.child) bones.Head.scale.setScalar(1.32);                 // a child's proportions: bigger head on a small body
    scene.add(root);

    const mixer = new THREE.AnimationMixer(root), actions = {};
    for (const [name, clip] of Object.entries(clips)) { actions[name] = mixer.clipAction(clip); actions[name].enabled = true; actions[name].setEffectiveWeight(0); actions[name].play(); }
    actions.idle.setEffectiveWeight(1); actions.idle.time = rand() * 2;
    people.push({
      spec, root, bones, mixer, actions, anim: 'idle', id: i,
      x: 0, z: 0, heading: 0, speed: 0, state: 'think', timer: rand() * 2, path: [], spot: null, pose: null, drop: 0, poseMix: 0,
      look: { yaw: 0, pitch: 0 }, need: 25 + rand() * 150, greet: 0, stuck: 0, lastX: 0, lastZ: 0, gesture: 0, lane: (rand() - 0.5) * 1.6, side: rand() > 0.5 ? 1 : -1, blocked: 0,
    });
  }

  // ---- finding a way --------------------------------------------------------------
  const bypass = (z, side) => side * 3.7 * W.smoothstep(26.0, 29.5, z) * W.smoothstep(38.0, 34.5, z);        // walk round the fire, not through it
  function route(from, to, p) {
    if (dist(from, to) < 8) return [{ x: to.x, z: to.z }];
    const za = W.clamp(from.z, 3.6, 53.4), zb = W.clamp(to.z, 3.6, 53.4), dir = Math.sign(zb - za) || 1, pts = [];
    const rx = (z) => W.roadX(z) + p.lane * W.smoothstep(55, 50, z) + bypass(z, p.side);
    let z = za + dir * Math.min(2.5, Math.abs(zb - za));
    while ((zb - z) * dir > 1.2) { pts.push({ x: rx(z), z }); z += dir * 3; }
    pts.push({ x: rx(zb), z: zb }, { x: to.x, z: to.z });
    return pts;
  }

  const free = (key) => !taken.has(key);
  const reserve = (p, key) => { release(p); taken.set(key, p); p.spot = SPOTS[key]; };
  const release = (p) => { if (p.spot && taken.get(p.spot.key) === p) taken.delete(p.spot.key); p.spot = null; };

  function setAnim(p, name) {
    if (p.anim === name) return;
    p.anim = name;
  }
  const goTo = (p, key, seconds, kind) => { reserve(p, key); p.path = route(p, SPOTS[key], p); p.state = 'walk'; p.kind = kind; p.stay = seconds; p.stuck = 0; };

  // Decide what to do next: weigh the person's habits, skip anything already occupied.
  function think(p, player) {
    const name = p.spec.name, options = [];
    // customers: once someone needs a blade and the workshop is free, they head up the street
    if (p.need <= 0 && name !== 'Pell' && name !== 'Greyhand') {
      if (free('shop')) { p.need = 90 + rand() * 160; return goTo(p, 'shop', 18 + rand() * 14, 'shop'); }
      if (free('shopWait') && rand() < 0.5) return goTo(p, 'shopWait', 8 + rand() * 8, 'wait');
    }
    for (const [kind, spots, weight, lo, hi] of HABITS[name]) {
      let keys = spots;
      if (kind === 'social') keys = Object.keys(SPOTS).filter((k) => SPOTS[k].social && (SPOTS[k].pose === 'sit') === (p.spec.stoop > 0 || rand() < 0.45));
      if (kind === 'water') keys = ['fordA', 'fordB'];
      if (kind === 'home') keys = p.spec.home ? [`door_${p.spec.home}`] : [];
      if (kind === 'roam') { options.push({ kind, weight }); continue; }
      keys = (keys || []).filter((k) => free(k) && (!p.lastKey || k !== p.lastKey));
      if (keys.length) options.push({ kind, weight: weight * (kind === 'social' && taken.size ? 1 + [...taken.keys()].filter((k) => SPOTS[k].social).length * 0.6 : 1), keys, lo, hi });
    }
    let total = options.reduce((s, o) => s + o.weight, 0), roll = rand() * total;
    const choice = options.find((o) => (roll -= o.weight) <= 0) ?? options[0];
    if (!choice) { p.timer = 2; return; }
    if (choice.kind === 'roam') {                                              // a child tearing about the paths
      for (let k = 0; k < 20; k++) {
        const x = -14 + rand() * 28, z = 5 + rand() * 46;
        if (W.dirtAmount(x, z) > 0.6 && dist({ x, z }, p) > 6) { release(p); p.path = route(p, { x, z }, p); p.state = 'walk'; p.kind = 'roam'; p.stay = 1 + rand() * 4; return; }
      }
      p.timer = 1; return;
    }
    const key = pick(choice.keys); p.lastKey = key;
    goTo(p, key, choice.lo + rand() * (choice.hi - choice.lo), choice.kind);
  }

  // ---- shadows: the villagers drawn from the sun's point of view ----------------------
  const mask = new THREE.WebGLRenderTarget(2048, 2048, { depthBuffer: false });
  const sunCam = new THREE.OrthographicCamera(-52, 52, 52, -52, 1, 400);
  const sunDir = U.uSunDir.value, centre = new THREE.Vector3(0, 2, 36);
  sunCam.position.copy(centre).addScaledVector(sunDir, 160); sunCam.lookAt(centre); sunCam.layers.set(2); sunCam.updateMatrixWorld();
  U.uNpcShadowMat.value.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(sunCam.projectionMatrix).multiply(sunCam.matrixWorldInverse);
  U.tNpcShadow.value = mask.texture;
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }), black = new THREE.Color(0);
  function drawShadows() {
    const rt = renderer.getRenderTarget(), bg = scene.background, col = renderer.getClearColor(new THREE.Color()), alpha = renderer.getClearAlpha();
    scene.overrideMaterial = white; scene.background = null;
    renderer.setRenderTarget(mask); renderer.setClearColor(black, 1); renderer.clear(); renderer.render(scene, sunCam);
    scene.overrideMaterial = null; scene.background = bg; renderer.setRenderTarget(rt); renderer.setClearColor(col, alpha);
  }

  // ---- starting places ---------------------------------------------------------------
  const starts = { Tamsa: 'hide0', Brok: 'hide2', Pell: 'fireStand1', Oda: 'benchA', Sefa: 'grind', Ilo: 'potsA', Nee: 'fireStand0', Greyhand: 'greyBench' };
  for (const p of people) {
    const s = SPOTS[starts[p.spec.name]];
    p.x = s.x; p.z = s.z; p.heading = Math.atan2(s.face.x - s.x, s.face.z - s.z);
    reserve(p, s.key); p.state = 'act'; p.kind = 'work'; p.timer = 6 + rand() * 25; p.pose = s.pose; p.drop = s.drop || 0;
  }
  W.PEOPLE.length = 0;
  for (const p of people) W.PEOPLE.push({ x: p.x, z: p.z, r: 0.3, p });

  const q = new THREE.Quaternion();
  let t = 0;

  function update(dt, camera, player) {
    t += dt;
    for (const p of people) {
      p.need -= dt; p.greet -= dt; p.gesture -= dt;
      const toPlayer = { x: player.x - p.x, z: player.z - p.z }, dPlayer = Math.hypot(toPlayer.x, toPlayer.z);
      let wantAnim = 'idle', lookAt = null, speed = 0;

      if (p.state === 'think') { p.timer -= dt; if (p.timer <= 0) think(p, player); }

      else if (p.state === 'walk') {
        const target = p.path[0], last = p.path.length === 1;
        const dx = target.x - p.x, dz = target.z - p.z, d = Math.hypot(dx, dz);
        if (d < (last ? 0.8 : 0.7)) {
          p.path.shift();
          if (!p.path.length) {
            if (p.spot?.pose === 'inside') { p.state = 'inside'; p.timer = p.stay; p.root.visible = false; }
            else { p.state = 'act'; p.timer = p.stay; p.pose = p.spot?.pose ?? 'stand'; p.drop = p.spot?.drop || 0; }
          }
        } else {
          let want = Math.atan2(dx, dz);
          // steer round other villagers and the player rather than walking into them
          for (const o of [...people.filter((o) => o !== p && o.root.visible), { x: player.x, z: player.z, isPlayer: true }]) {
            const ox = o.x - p.x, oz = o.z - p.z, od = Math.hypot(ox, oz);
            if (od > 1.7 || od < 1e-3) continue;
            const ahead = (ox * Math.sin(p.heading) + oz * Math.cos(p.heading)) / od;
            if (ahead < 0.25) continue;
            const sideOf = Math.sign(ox * Math.cos(p.heading) - oz * Math.sin(p.heading)) || 1;
            want -= sideOf * (1.7 - od) * 0.9 * ahead;
            if (o.isPlayer && od < 0.95 && ahead > 0.8) p.blocked = 0.35;                       // someone is in the way: pause a beat
          }
          p.blocked -= dt;
          const turn = wrap(want - p.heading);
          p.heading += W.clamp(turn, -4.5 * dt, 4.5 * dt);
          const full = p.spec.speed * (W.surfaceAt(p.x, p.z) === 'water' ? 0.6 : 1);
          speed = p.blocked > 0 ? 0 : full * W.clamp(1.15 - Math.abs(turn) * 0.9, 0.15, 1) * (last ? W.clamp(d / 1.2, 0.45, 1) : 1);
          p.x += Math.sin(p.heading) * speed * dt; p.z += Math.cos(p.heading) * speed * dt;
          const before = { x: p.x, z: p.z };
          W.resolveCollisions(p, 0.28, false);
          // if something keeps pushing them back, give up on that waypoint
          p.stuck += dt;
          if (p.stuck > 2.5) {
            if (Math.hypot(p.x - p.lastX, p.z - p.lastZ) < 0.5) { if (p.path.length > 1) p.path.shift(); else { release(p); p.state = 'think'; p.timer = 0.5; } }
            p.stuck = 0; p.lastX = p.x; p.lastZ = p.z;
          }
          wantAnim = speed < 0.08 ? 'idle' : p.spec.child ? 'run' : 'walk';
        }
        if (dPlayer < 5) lookAt = player;
      }

      else if (p.state === 'act') {
        p.timer -= dt;
        const s = p.spot;
        if (s) {                                                                                 // settle onto the spot and face the work
          p.x += (s.x - p.x) * Math.min(1, dt * 4); p.z += (s.z - p.z) * Math.min(1, dt * 4);
          let face = s.face;
          if (s.pose === 'shop' && dPlayer < 7 && W.insideWorkshop(player.x, player.z)) { face = player; lookAt = player; if (p.gesture <= 0) { p.gesture = 4 + rand() * 4; p.once = 'agree'; p.onceT = 1.8; } }
          p.heading += W.clamp(wrap(Math.atan2(face.x - p.x, face.z - p.z) - p.heading), -3 * dt, 3 * dt);
          if (s.social) {                                                                        // by the fire: look at whoever else is there, and talk
            const other = people.find((o) => o !== p && o.state === 'act' && o.spot?.social);
            if (other) { lookAt = other; if (p.gesture <= 0) { p.gesture = 3 + rand() * 6; p.once = rand() < 0.7 ? 'agree' : 'headShake'; p.onceT = p.once === 'agree' ? 1.8 : 2.5; } }
          }
          if (s.pose === 'crouch') wantAnim = 'sneak_pose';
        }
        if (dPlayer < 3.2 && !lookAt && p.pose !== 'scrape') lookAt = player;
        if (dPlayer < 2.4 && p.greet <= 0 && p.pose !== 'crouch') { p.greet = 25 + rand() * 20; p.once = 'agree'; p.onceT = 1.8; lookAt = player; }
        if (p.timer <= 0) { p.pose = null; p.drop = 0; p.state = 'think'; p.timer = 0.4 + rand() * 1.2; release(p); }
      }

      else if (p.state === 'inside') { p.timer -= dt; if (p.timer <= 0) { p.root.visible = true; p.state = 'think'; p.timer = 0.3; release(p); } }

      // one-off gestures (a nod, a shake of the head) play over whatever else is happening
      if (p.onceT > 0) { p.onceT -= dt; if (wantAnim === 'idle') wantAnim = p.once; }
      setAnim(p, wantAnim);
      for (const [name, a] of Object.entries(p.actions)) {
        const goal = name === p.anim ? 1 : 0, w = a.getEffectiveWeight();
        a.setEffectiveWeight(w + (goal - w) * Math.min(1, dt * 7));
      }
      p.actions.walk.timeScale = W.clamp(speed / (1.38 * p.spec.h), 0.5, 1.6);
      p.actions.run.timeScale = W.clamp(speed / (3.6 * p.spec.h), 0.6, 1.4);
      p.speed = speed;
      p.mixer.update(dt);

      // layer the code-driven pose on top of the motion capture
      const pose = p.state === 'act' && p.anim === 'idle' ? (p.pose === 'stand' && p.spot?.warm ? 'warm' : p.pose) : null;
      const mixTo = pose && POSES[pose] ? 1 : 0;
      if (mixTo) p.poseName = pose;
      p.poseMix += (mixTo - p.poseMix) * Math.min(1, dt * 3.5);
      const dropNow = p.poseMix * (p.poseName === 'sit' ? p.drop : 0) * p.spec.h;
      p.root.position.set(p.x, W.groundHeight(p.x, p.z) - dropNow, p.z);
      p.root.rotation.y = p.heading;
      p.root.updateMatrixWorld(true);
      if (p.spec.stoop) { turn(p.root, p.bones.Spine, 'x', p.spec.stoop * 0.6); turn(p.root, p.bones.Spine2, 'x', p.spec.stoop * 0.5); turn(p.root, p.bones.Neck, 'x', -p.spec.stoop * 0.5); }
      if (p.poseMix > 0.01 && POSES[p.poseName]) for (const [bone, axis, ang, sway, rate, phase] of POSES[p.poseName])
        turn(p.root, p.bones[bone], axis, (ang + sway * Math.sin(t * rate + phase + p.id)) * p.poseMix);

      // turn the head toward whatever has their attention
      let yaw = 0, pitch = 0;
      if (lookAt) {
        yaw = W.clamp(wrap(Math.atan2(lookAt.x - p.x, lookAt.z - p.z) - p.heading), -1.15, 1.15);
        if (lookAt === player) pitch = W.clamp((p.spec.h * 1.62 - 1.65) * 0.3 / Math.max(dPlayer, 0.8), -0.4, 0.4);
      }
      p.look.yaw += (yaw - p.look.yaw) * Math.min(1, dt * 5); p.look.pitch += (pitch - p.look.pitch) * Math.min(1, dt * 5);
      turn(p.root, p.bones.Neck, 'y', p.look.yaw * 0.4); turn(p.root, p.bones.Head, 'y', p.look.yaw * 0.6); turn(p.root, p.bones.Head, 'x', p.look.pitch);

      const c = W.PEOPLE[p.id]; c.x = p.x; c.z = p.z; c.r = p.root.visible ? 0.3 : -5;
    }
    // keep people from standing inside each other
    for (let i = 0; i < people.length; i++) for (let j = i + 1; j < people.length; j++) {
      const a = people[i], b = people[j]; if (!a.root.visible || !b.root.visible || a.state === 'act' && b.state === 'act') continue;
      const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
      if (d < 0.55 && d > 1e-4) { const push = (0.55 - d) / 2, ux = dx / d, uz = dz / d; if (a.state !== 'act') { a.x -= ux * push; a.z -= uz * push; } if (b.state !== 'act') { b.x += ux * push; b.z += uz * push; } }
    }
    drawShadows();
  }

  window.forgedPeople = { people, POSES, SPOTS };   // for checking poses from the browser console
  return update;
}
