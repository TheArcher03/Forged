// Meadow: real blades of grass that sway, plus wildflowers and reeds by the water.
import * as THREE from 'three';
import * as W from './world.js';
import { fbm, rng } from './noise.js';
import { windAndGlow } from './shared.js';

// One tuft = a few tapered, curved blades. Height is 1 so each plant can be scaled.
function tuftGeometry(blades, r) {
  const pos = [], uv = [], nor = [], idx = [];
  for (let b = 0; b < blades; b++) {
    const a = r() * Math.PI * 2, ox = (r() - 0.5) * 0.26, oz = (r() - 0.5) * 0.26;
    const lean = 0.15 + r() * 0.4, width = 0.016 + r() * 0.016, hgt = 0.65 + r() * 0.35;
    const ca = Math.cos(a), sa = Math.sin(a), la = r() * Math.PI * 2, lx = Math.cos(la), lz = Math.sin(la);
    const base = pos.length / 3, SEG = 2;
    for (let i = 0; i <= SEG; i++) {
      const t = i / SEG, wd = width * (1 - t * t * 0.92), bend = lean * t * t;
      for (const s of [-1, 1]) {
        pos.push(ox + ca * wd * s + lx * bend * hgt, t * hgt, oz + sa * wd * s + lz * bend * hgt);
        uv.push(s * 0.5 + 0.5, t * hgt);
        nor.push(-sa, 0.4, ca);
      }
    }
    for (let i = 0; i < SEG; i++) { const k = base + i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

// Two crossed upright cards, for flowers and reeds.
function crossGeometry(w, h) {
  const a = new THREE.PlaneGeometry(w, h); a.translate(0, h / 2, 0);
  const pos = [], uv = [], idx = [];
  for (let k = 0; k < 2; k++) {
    const c = Math.cos((k * Math.PI) / 2), s = Math.sin((k * Math.PI) / 2), base = pos.length / 3;
    for (let i = 0; i < 4; i++) {
      const x = a.attributes.position.getX(i), y = a.attributes.position.getY(i);
      pos.push(x * c, y, x * s); uv.push(a.attributes.uv.getX(i), a.attributes.uv.getY(i));
    }
    idx.push(base, base + 2, base + 1, base + 2, base + 3, base + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.setIndex(idx);
  return g;
}

const inBuilding = (x, z, pad) => [...W.HOUSES, W.WORKSHOP].some((b) => Math.hypot(x - b.x, z - b.z) < b.r + pad);

export default function createGrass(scene, T) {
  const r = rng(101);
  const m = new THREE.Object3D(), col = new THREE.Color(), dry = new THREE.Color(), lush = new THREE.Color();

  // ---- grass
  const spots = [];
  const CELL = 0.24;
  for (let z = -15; z < 90; z += CELL) for (let x = -33; x < 33; x += CELL) {
    const px = x + r() * CELL, pz = z + r() * CELL;
    const e = W.cliffEdge(px);
    if (pz > e - 0.4 && pz < e + 4.5) continue;
    const h = W.terrainHeight(px, pz);
    if (h < 0.05 && Math.abs(pz - W.creekZ(px)) < 6) continue;      // water and wet gravel
    const dirt = W.dirtAmount(px, pz);
    if (dirt > 0.25 + r() * 0.35) continue;                          // worn bare by feet
    if (inBuilding(px, pz, 0.25)) continue;
    const woods = Math.max(W.smoothstep(21, 28, Math.abs(px)), W.smoothstep(-6, -11, pz), W.smoothstep(e + 3, e + 7, pz)) * (1 - W.sunGap(px, pz));
    if (r() < woods * 0.8) continue;                                 // thins out under the trees
    const patch = fbm(px * 0.11 + 3, pz * 0.11, 3);                  // tall and short patches
    spots.push([px, h, pz, dirt, patch, woods]);
  }
  const grass = new THREE.InstancedMesh(
    tuftGeometry(6, rng(7)),
    windAndGlow(new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.78, metalness: 0 }),
      { sway: 0.16, flutter: 0.035, glow: 0.9, upNormal: 0.8, rootDark: 0.3, peopleShadow: true }),
    spots.length);
  spots.forEach(([x, h, z, dirt, patch, woods], i) => {
    const clump = fbm(x * 1.3, z * 1.3 + 40, 2);                      // grass grows in clumps, not as a lawn
    const tall = (0.22 + patch * 0.7 + W.smoothstep(0.55, 0.8, clump) * 0.45) * (1 - dirt * 1.6) * (0.6 + r() * 0.8) * (1 - woods * 0.3);
    m.position.set(x, h - 0.03, z); m.rotation.set(0, r() * 6.283, 0);
    const wide = 0.9 + r() * 0.7;
    m.scale.set(wide, Math.max(0.16, tall), wide); m.updateMatrix(); grass.setMatrixAt(i, m.matrix);
    const tone = fbm(x * 0.06 + 20, z * 0.06, 3), d = fbm(x * 0.35, z * 0.35 + 9, 2);
    lush.setRGB(0.10 + tone * 0.10, 0.22 + tone * 0.16, 0.03 + tone * 0.04);
    dry.setRGB(0.42, 0.36, 0.13);
    col.copy(lush).lerp(dry, W.smoothstep(0.5, 0.78, d) * 0.8 + (r() > 0.9 ? 0.5 : r() * 0.12)).multiplyScalar(0.7 + r() * 0.7);
    grass.setColorAt(i, col);
  });
  grass.receiveShadow = true; grass.frustumCulled = false;
  scene.add(grass);

  // ---- wildflowers, in drifts
  const fl = [];
  for (let i = 0; i < 26000 && fl.length < 2600; i++) {
    const x = -24 + r() * 48, z = -8 + r() * 88;
    if (fbm(x * 0.16 + 50, z * 0.16, 2) < 0.6) continue;
    const h = W.terrainHeight(x, z);
    if (h < 0.1 || W.dirtAmount(x, z) > 0.15 || inBuilding(x, z, 0.5) || z > W.cliffEdge(x) - 0.6) continue;
    fl.push([x, h, z]);
  }
  const flowers = new THREE.InstancedMesh(
    crossGeometry(0.3, 0.6),
    windAndGlow(new THREE.MeshStandardMaterial({ map: T.flower, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.7 }), { sway: 0.1, flutter: 0.02, glow: 0.5 }),
    fl.length);
  const TINTS = [0xffffff, 0xfff0a8, 0xd9c2ff, 0xffffff, 0xffd98a];
  fl.forEach(([x, h, z], i) => {
    const s = 0.7 + r() * 0.7;
    m.position.set(x, h, z); m.rotation.set(0, r() * 6.283, 0); m.scale.set(s, s, s); m.updateMatrix();
    flowers.setMatrixAt(i, m.matrix); flowers.setColorAt(i, col.setHex(TINTS[Math.floor(r() * TINTS.length)]));
  });
  flowers.receiveShadow = true; flowers.frustumCulled = false;
  scene.add(flowers);

  // ---- scanned ground plants: small shrubs in the meadow, weeds creeping onto the paths
  const clutter = (scan, count, scaleMin, scaleMax, test) => {
    if (!scan) return;
    const spots = [];
    for (let i = 0; i < 40000 && spots.length < count; i++) {
      const x = -22 + r() * 44, z = -4 + r() * 82, h = W.terrainHeight(x, z);
      if (h < 0.1 || inBuilding(x, z, 0.4) || z > W.cliffEdge(x) - 1 || !test(W.dirtAmount(x, z), x, z)) continue;
      spots.push([x, h, z]);
    }
    const mat = windAndGlow(Object.assign(scan.material.clone(), { alphaTest: 0.5, side: THREE.DoubleSide }), { sway: 0.04, flutter: 0.012, heightExpr: 'clamp(position.y * 3.0, 0.0, 1.0)', glow: 0.6 });
    scan.list.forEach((geo, gi) => {
      const mine = spots.filter((_, i) => i % scan.list.length === gi), mesh = new THREE.InstancedMesh(geo, mat, mine.length);
      mine.forEach(([x, h, z], i) => {
        const s = scaleMin + r() * (scaleMax - scaleMin);
        m.position.set(x, h - 0.01, z); m.rotation.set(0, r() * 6.283, 0); m.scale.set(s, s, s); m.updateMatrix();
        mesh.setMatrixAt(i, m.matrix); const v = 0.8 + r() * 0.4; mesh.setColorAt(i, col.setRGB(v, v, v * 0.9));
      });
      mesh.receiveShadow = true; mesh.frustumCulled = false; scene.add(mesh);
    });
  };
  clutter(T.scan?.shrub_03, 260, 1.6, 3.2, (dirt, x, z) => dirt < 0.2 && fbm(x * 0.2 + 80, z * 0.2, 2) > 0.5);
  clutter(T.scan?.weed_plant_02, 320, 1.5, 3.0, (dirt) => dirt > 0.12 && dirt < 0.75);

  // ---- reeds along the creek banks (kept clear of the ford)
  const rd = [];
  for (let i = 0; i < 40000 && rd.length < 1500; i++) {
    const x = -45 + r() * 90, z = W.creekZ(x) + (r() - 0.5) * 9;
    if (Math.abs(x + 0.5) < 4.5) continue;
    if (fbm(x * 0.3, z * 0.3 + 70, 2) < 0.48) continue;
    const h = W.terrainHeight(x, z);
    if (h < W.WATER_LEVEL - 0.08 || h > 0.2) continue;
    rd.push([x, h, z]);
  }
  const reeds = new THREE.InstancedMesh(
    crossGeometry(0.9, 1.8),
    windAndGlow(new THREE.MeshStandardMaterial({ map: T.reed, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8 }), { sway: 0.22, flutter: 0.03, glow: 0.7 }),
    rd.length);
  rd.forEach(([x, h, z], i) => {
    const s = 0.7 + r() * 0.8;
    m.position.set(x, h - 0.05, z); m.rotation.set(0, r() * 6.283, 0); m.scale.set(s, s, s); m.updateMatrix();
    reeds.setMatrixAt(i, m.matrix); reeds.setColorAt(i, col.setRGB(0.75 + r() * 0.25, 0.8 + r() * 0.2, 0.6 + r() * 0.3));
  });
  reeds.castShadow = true; reeds.receiveShadow = true; reeds.frustumCulled = false;
  reeds.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: T.reed, alphaTest: 0.45 });
  scene.add(reeds);
}
