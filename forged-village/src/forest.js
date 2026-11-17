// The forest: conifers, broadleaves and birches built from code, plus ferns, bushes,
// fallen logs and rocks. Trees are built a few times each and then planted many times.
import * as THREE from 'three';
import * as W from './world.js';
import { fbm, rng } from './noise.js';
import { windAndGlow, bleach } from './shared.js';

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0), XAXIS = V(1, 0, 0);

// Collects triangles for one mesh.
export class Geo {
  constructor() { this.p = []; this.n = []; this.u = []; this.i = []; }
  // A round limb following a path of points, each with its own radius (.r).
  tube(pts, segs, uRep, vScale) {
    const base = this.p.length / 3; let vLen = 0;
    const t = V(), n1 = V(), n2 = V(), d = V();
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], c = pts[i];
      t.subVectors(b, a).normalize();
      n1.crossVectors(t, Math.abs(t.y) > 0.9 ? XAXIS : UP).normalize(); n2.crossVectors(t, n1);
      if (i > 0) vLen += c.distanceTo(pts[i - 1]);
      for (let k = 0; k <= segs; k++) {
        const ang = (k / segs) * Math.PI * 2;
        d.copy(n1).multiplyScalar(Math.cos(ang)).addScaledVector(n2, Math.sin(ang));
        this.p.push(c.x + d.x * c.r, c.y + d.y * c.r, c.z + d.z * c.r);
        this.n.push(d.x, d.y, d.z); this.u.push((k / segs) * uRep, vLen / vScale);
      }
    }
    for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < segs; k++) {
      const a = base + i * (segs + 1) + k, b = a + segs + 1;
      this.i.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  // A flat card. ax/ay are half-extents; nFn gives a soft shading normal per corner.
  card(c, ax, ay, nFn) {
    const base = this.p.length / 3, q = V();
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      q.copy(c).addScaledVector(ax, sx).addScaledVector(ay, sy);
      const n = nFn(q);
      this.p.push(q.x, q.y, q.z); this.n.push(n.x, n.y, n.z); this.u.push(sx * 0.5 + 0.5, sy * 0.5 + 0.5);
    }
    this.i.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }
  // A flat round cap (the sawn end of a log).
  disc(c, nrm, rad, segs = 9) {
    const base = this.p.length / 3, a = V().crossVectors(nrm, Math.abs(nrm.y) > 0.9 ? XAXIS : UP).normalize(), b = V().crossVectors(nrm, a);
    this.p.push(c.x, c.y, c.z); this.n.push(nrm.x, nrm.y, nrm.z); this.u.push(0.5, 0.5);
    for (let k = 0; k <= segs; k++) {
      const ang = (k / segs) * Math.PI * 2, x = Math.cos(ang), y = Math.sin(ang);
      this.p.push(c.x + (a.x * x + b.x * y) * rad, c.y + (a.y * x + b.y * y) * rad, c.z + (a.z * x + b.z * y) * rad);
      this.n.push(nrm.x, nrm.y, nrm.z); this.u.push(0.5 + x * 0.12, 0.5 + y * 0.12);
    }
    for (let k = 0; k < segs; k++) this.i.push(base, base + 1 + k, base + 2 + k);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.setIndex(this.i);
    return g;
  }
}

// ---- tree builders: each returns { wood, leaves } geometries ---------------------
function conifer(seed) {
  const r = rng(seed), wood = new Geo(), leaves = new Geo();
  const H = 16 + r() * 10, R0 = 0.2 + H * 0.011;
  const lean = V((r() - 0.5) * 0.06, 0, (r() - 0.5) * 0.06);
  const axis = (y) => V(lean.x * y + Math.sin(y * 0.3 + seed) * 0.12, y, lean.z * y + Math.cos(y * 0.23 + seed) * 0.12);
  const trunk = [];
  for (let i = 0; i <= 9; i++) {
    const t = i / 9, y = -0.6 + t * (H + 0.6), p = axis(y);
    p.r = R0 * Math.pow(1 - t, 0.85) * (1 + 0.7 * Math.exp(-Math.max(y, 0) * 2.2)) + 0.025;
    trunk.push(p);
  }
  wood.tube(trunk, 9, 2, 1.6);

  const y0 = H * (0.2 + r() * 0.16), Lmax = 2.3 + H * 0.1;
  const soft = (o) => (q) => V().subVectors(q, o).normalize().addScaledVector(UP, 0.7).normalize();
  // a few bare snags below the green
  for (let y = 2; y < y0; y += 1.2 + r() * 1.6) {
    const a = r() * 6.28, o = axis(y), l = 0.5 + r() * 1.1;
    o.r = 0.045; const e = V(o.x + Math.cos(a) * l, y - 0.15 * l, o.z + Math.sin(a) * l); e.r = 0.012;
    wood.tube([o, e], 4, 1, 1);
  }
  let y = y0, turn = r() * 6.28;
  while (y < H - 0.9) {
    const t = (y - y0) / (H - y0), n = t < 0.75 ? 5 : 4;
    const L = (0.22 + 0.78 * Math.pow(1 - t, 0.8)) * Lmax * (0.85 + r() * 0.3);
    const droop = W.mix(0.6, 0.12, t) + (r() - 0.5) * 0.15;
    for (let k = 0; k < n; k++) {
      const a = turn + (k / n) * 6.283 + (r() - 0.5) * 0.5, o = axis(y + (r() - 0.5) * 0.3);
      const dir = V(Math.cos(a) * Math.cos(droop), -Math.sin(droop), Math.sin(a) * Math.cos(droop));
      const side = V(-Math.sin(a), 0, Math.cos(a)), hang = V().crossVectors(dir, side);
      const c = V().copy(o).addScaledVector(dir, L * 0.48), shade = soft(axis(y - 2));
      leaves.card(c, V().copy(side).multiplyScalar(L * 0.34), V().copy(dir).multiplyScalar(L * 0.52), shade);
      leaves.card(V().copy(c).addScaledVector(hang, -L * 0.1), V().copy(hang).multiplyScalar(L * 0.2), V().copy(dir).multiplyScalar(L * 0.52), shade);
    }
    turn += 0.9; y += W.mix(0.8, 0.42, t) * (0.85 + r() * 0.3);
  }
  const tip = axis(H - 0.6), s = soft(axis(H - 3));
  for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI; leaves.card(V(tip.x, H + 0.2, tip.z), V(Math.cos(a) * 0.75, 0, Math.sin(a) * 0.75), V(0, 1.5, 0), s); }
  return { wood: wood.build(), leaves: leaves.build(), H };
}

function broadleaf(seed, { birch = false } = {}) {
  const r = rng(seed), wood = new Geo(), leaves = new Geo();
  const H = birch ? 11 + r() * 5 : 10 + r() * 6, R0 = birch ? 0.13 + r() * 0.05 : 0.3 + r() * 0.16;
  const forkY = H * (birch ? 0.5 : 0.36), anchors = [];
  const trunk = [];
  const bend = V((r() - 0.5) * 0.9, 0, (r() - 0.5) * 0.9);
  for (let i = 0; i <= 6; i++) {
    const t = i / 6, y = -0.6 + t * (forkY + 0.6), p = V(bend.x * t * t, y, bend.z * t * t);
    p.r = R0 * (1 - t * 0.3) * (1 + 0.8 * Math.exp(-Math.max(y, 0) * 2)); trunk.push(p);
  }
  wood.tube(trunk, 9, birch ? 1 : 2, birch ? 1.2 : 1.8);
  const top = trunk[trunk.length - 1];

  const limb = (start, dir, len, rad, depth) => {
    const pts = []; const p = V().copy(start), d = V().copy(dir);
    for (let i = 0; i <= 3; i++) {
      const q = V().copy(p); q.r = rad * (1 - i * 0.2); pts.push(q);
      p.addScaledVector(d, len / 3);
      d.addScaledVector(UP, 0.16).add(V((r() - 0.5) * 0.3, 0, (r() - 0.5) * 0.3)).normalize();
    }
    wood.tube(pts, depth > 0 ? 6 : 4, 1, birch ? 1.2 : 1.8);
    const end = pts[3];
    anchors.push(end, V().lerpVectors(pts[1], pts[2], 0.5));
    if (depth > 0) for (let k = 0, n = 2 + (r() > 0.5 ? 1 : 0); k < n; k++) {
      const nd = V().copy(d).add(V((r() - 0.5) * 1.5, (r() - 0.2) * 0.7, (r() - 0.5) * 1.5)).normalize();
      limb(end, nd, len * (0.62 + r() * 0.2), rad * 0.55, depth - 1);
    }
  };
  const limbs = birch ? 5 : 4, reach = H - forkY;
  for (let k = 0; k < limbs; k++) {
    const a = (k / limbs) * 6.283 + r(), out = birch ? 0.35 + r() * 0.3 : 0.6 + r() * 0.5;
    limb(top, V(Math.cos(a) * out, 1, Math.sin(a) * out).normalize(), reach * (birch ? 0.6 : 0.55), R0 * 0.55, birch ? 1 : 2);
  }
  limb(top, V((r() - 0.5) * 0.3, 1, (r() - 0.5) * 0.3).normalize(), reach * 0.7, R0 * 0.6, 1);

  const centre = V(top.x, forkY + reach * 0.55, top.z), rad = birch ? V(H * 0.2, reach * 0.52, H * 0.2) : V(H * 0.42, reach * 0.55, H * 0.42);
  for (let k = 0; k < (birch ? 14 : 30); k++) { // fill out the silhouette
    const a = r() * 6.283, e = Math.acos(1 - r() * 1.6) - 0.3;
    anchors.push(V(centre.x + Math.cos(a) * Math.sin(e) * rad.x * 0.92, centre.y + Math.cos(e) * rad.y * 0.92, centre.z + Math.sin(a) * Math.sin(e) * rad.z * 0.92));
  }
  const soft = (q) => V().subVectors(q, centre).normalize().addScaledVector(UP, 0.35).normalize();
  for (const a of anchors) {
    const s = (birch ? 1.25 : 1.9) * (0.75 + r() * 0.6);
    for (let k = 0; k < 3; k++) {
      const ax = V(r() - 0.5, r() - 0.5, r() - 0.5).normalize(), ay = V(r() - 0.5, r() - 0.5, r() - 0.5).cross(ax).normalize();
      leaves.card(V(a.x + (r() - 0.5) * 0.6, a.y + (r() - 0.5) * 0.6, a.z + (r() - 0.5) * 0.6), ax.multiplyScalar(s), ay.multiplyScalar(s), soft);
    }
  }
  return { wood: wood.build(), leaves: leaves.build(), H };
}

function fernGeometry() {
  const g = new Geo(), r = rng(77);
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * 6.283 + r() * 0.5, tilt = 0.5 + r() * 0.45, L = 0.55 + r() * 0.3;
    const dir = V(Math.cos(a) * Math.cos(tilt), Math.sin(tilt), Math.sin(a) * Math.cos(tilt)), side = V(-Math.sin(a), 0, Math.cos(a));
    g.card(V().copy(dir).multiplyScalar(L * 0.5), side.multiplyScalar(L * 0.27), V().copy(dir).multiplyScalar(L * 0.5), () => V(dir.x * 0.4, 1, dir.z * 0.4).normalize());
  }
  return g.build();
}
function bushGeometry(seed) {
  const g = new Geo(), r = rng(seed);
  for (let k = 0; k < 7; k++) {
    const c = V((r() - 0.5) * 1.1, 0.45 + r() * 0.7, (r() - 0.5) * 1.1), s = 0.55 + r() * 0.35;
    for (let j = 0; j < 2; j++) {
      const ax = V(r() - 0.5, (r() - 0.5) * 0.4, r() - 0.5).normalize(), ay = V(r() - 0.5, 1, r() - 0.5).cross(ax).normalize();
      g.card(c, ax.multiplyScalar(s), ay.multiplyScalar(s), (q) => V(q.x, q.y + 0.3, q.z).normalize());
    }
  }
  return g.build();
}
// A lumpy boulder: a sphere pushed around by noise, flattened a little.
export function rockGeometry(seed, detail = 3) {
  const g = new THREE.IcosahedronGeometry(1, detail), p = g.attributes.position, v = V();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = fbm(v.x * 1.3 + seed, v.y * 1.3 + v.z * 1.7 + seed * 3, 3), big = fbm(v.x * 0.5 + seed * 5, v.z * 0.5 + v.y, 2);
    v.multiplyScalar(0.62 + n * 0.5 + big * 0.35); v.y *= 0.72;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

const foliage = (map, opts = {}) => {
  const m = windAndGlow(new THREE.MeshStandardMaterial({ map, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.82, metalness: 0, alphaToCoverage: true }),
    { sway: 0.16, flutter: 0.012, heightExpr: 'clamp(position.y / 16.0, 0.0, 1.0)', glow: 0.55, softSides: true, ...opts });
  return m;
};
const depthFor = (map) => new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.42 });

export default function createForest(scene, T) {
  const r = rng(202);
  const barkMat = new THREE.MeshStandardMaterial({ map: T.bark.map, normalMap: T.bark.normalMap, roughness: 0.95, normalScale: new THREE.Vector2(1.6, 1.6) });
  const broadBark = T.barkBroad ? new THREE.MeshStandardMaterial({ map: T.barkBroad.map, normalMap: T.barkBroad.normalMap, roughness: 0.95, normalScale: new THREE.Vector2(1.6, 1.6) }) : barkMat;
  const birchMat = new THREE.MeshStandardMaterial({ map: T.birch.map, normalMap: T.birch.normalMap, roughness: 0.8 });
  const needles = foliage(T.bough.map ?? T.bough), green = foliage(T.leaves), gold = foliage(T.leavesGold, { glow: 0.8 });

  const kinds = [
    ...[11, 12, 13].map((s) => ({ ...conifer(s), bark: barkMat, leaf: needles, map: T.bough, type: 'conifer' })),
    ...[21, 22].map((s) => ({ ...broadleaf(s), bark: broadBark, leaf: green, map: T.leaves, type: 'broad' })),
    { ...broadleaf(23), bark: broadBark, leaf: gold, map: T.leavesGold, type: 'gold' },
    { ...broadleaf(31, { birch: true }), bark: birchMat, leaf: gold, map: T.leavesGold, type: 'birch' },
    { ...broadleaf(32, { birch: true }), bark: birchMat, leaf: green, map: T.leaves, type: 'birch' },
  ].map((k) => ({ ...k, spots: [] }));
  const pick = (type) => { const c = kinds.filter((k) => k.type === type); return c[Math.floor(r() * c.length)]; };

  // ---- where the trees go
  const nearCreek = (x, z) => Math.abs(z - W.creekZ(x)) < W.creekHalfWidth(x) + 1.6;
  const CELL = 4.4;
  for (let z = -68; z < 138; z += CELL) for (let x = -88; x < 88; x += CELL) {
    const px = x + r() * CELL, pz = z + r() * CELL, e = W.cliffEdge(px);
    const edgeNoise = (fbm(px * 0.06 + 9, pz * 0.06, 2) - 0.5) * 5;
    const inWoods = Math.abs(px) > 23.5 + edgeNoise || pz < -8 + edgeNoise * 0.5 || pz > e + 4.5;
    if (!inWoods || nearCreek(px, pz) || (pz > e - 2 && pz < e + 4.5)) continue;
    const gap = W.sunGap(px, pz);
    if (r() < gap * 0.93) continue;                                   // the sun's side of the valley stays open
    const dens = fbm(px * 0.04 + 31, pz * 0.04, 3);
    if (r() > 0.45 + dens * 0.75) continue;
    const depthIn = Math.max(Math.abs(px) - 24, -8 - pz, pz - e - 4, 0);
    const t = r(), edgeMix = depthIn < 9 ? 0.5 : 0.2;                  // lighter, leafier trees along the edge
    const kind = t < edgeMix * 0.45 ? pick('birch') : t < edgeMix * 0.8 ? pick('broad') : t < edgeMix ? pick('gold') : pick('conifer');
    kind.spots.push([px, pz, 0.8 + r() * 0.5]);
  }
  // trees standing in the village itself
  const heroes = [
    [7.5, 4.6, 'birch', 1], [-8, 5.4, 'birch', 0.9], [-16.5, 9, 'birch', 1.05], [17.5, 28.5, 'broad', 1.15], [-17.5, 41, 'gold', 1.1],
    [-15.5, 57, 'broad', 1.0], [16.5, 62, 'birch', 1.1], [18, 6.5, 'broad', 0.95], [-18.5, 21, 'conifer', 0.8], [19, 50.5, 'conifer', 0.85], [-13, 70, 'birch', 0.95],
  ];
  for (const [x, z, type, s] of heroes) { pick(type).spots.push([x, z, s]); W.CIRCLES.push({ x, z, r: type === 'broad' || type === 'gold' ? 0.5 : 0.3 }); }

  const m = new THREE.Object3D(), col = new THREE.Color();
  let total = 0;
  for (const k of kinds) {
    if (!k.spots.length) continue;
    const wood = new THREE.InstancedMesh(k.wood, k.bark, k.spots.length), leaf = new THREE.InstancedMesh(k.leaves, k.leaf, k.spots.length);
    k.spots.forEach(([x, z, s], i) => {
      m.position.set(x, W.terrainHeight(x, z) - 0.1, z); m.rotation.set(0, r() * 6.283, 0); m.scale.set(s, s * (0.9 + r() * 0.25), s); m.updateMatrix();
      wood.setMatrixAt(i, m.matrix); leaf.setMatrixAt(i, m.matrix);
      const v = 0.75 + r() * 0.5;
      leaf.setColorAt(i, k.type === 'conifer' ? col.setRGB(v * 0.9, v, v * 0.85) : col.setRGB(v * (0.9 + r() * 0.25), v, v * 0.8));
    });
    wood.castShadow = wood.receiveShadow = leaf.castShadow = leaf.receiveShadow = true;
    wood.frustumCulled = leaf.frustumCulled = false;
    leaf.customDepthMaterial = depthFor(k.map.map ?? k.map);
    scene.add(wood, leaf); total += k.spots.length;
  }

  // ---- the far forest: thousands of distant spruces as simple cards
  {
    const g = new Geo();
    for (let k = 0; k < 2; k++) { const a = (k * Math.PI) / 2; g.card(V(0, 0.5, 0), V(Math.cos(a) * 0.26, 0, Math.sin(a) * 0.26), V(0, 0.5, 0), () => V(0.2, 1, 0.2).normalize()); }
    const spots = [];
    for (let i = 0; i < 26000 && spots.length < 6000; i++) {
      const a = r() * 6.283, d = 92 + Math.pow(r(), 1.5) * 520, x = Math.cos(a) * d, z = 35 + Math.sin(a) * d * 1.05;
      if (x > -86 && x < 86 && z > -66 && z < 136) continue;
      if (r() < W.sunGap(x, z) * 0.9 || nearCreek(x, z)) continue;
      spots.push([x, z]);
    }
    const far = new THREE.InstancedMesh(g.build(), new THREE.MeshStandardMaterial({ map: T.farTree, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 1 }), spots.length);
    spots.forEach(([x, z], i) => {
      const s = 17 + r() * 12;
      m.position.set(x, W.terrainHeight(x, z) - 1.2, z); m.rotation.set(0, r() * 6.283, 0); m.scale.set(s, s, s); m.updateMatrix();
      far.setMatrixAt(i, m.matrix); const v = 0.6 + r() * 0.5; far.setColorAt(i, col.setRGB(v, v, v * 0.9));
    });
    far.frustumCulled = false; scene.add(far);
  }

  // ---- undergrowth along the forest edge and under the trees
  const scatter = (count, tries, test) => { const out = []; for (let i = 0; i < tries && out.length < count; i++) { const x = -40 + r() * 80, z = -20 + r() * 115; if (!W.heronView(x, z) && test(x, z)) out.push([x, z]); } return out; };
  const edge = (x, z) => { const e = W.cliffEdge(x); return Math.max(W.smoothstep(18.5, 23, Math.abs(x)), W.smoothstep(-3.5, -7, z), z > e + 4 ? 1 : 0); };
  const dry = (x, z) => W.terrainHeight(x, z) > 0.12 && !(z > W.cliffEdge(x) - 1 && z < W.cliffEdge(x) + 4.2);

  const scanFern = T.scan?.fern_02;
  const fernSpots = scatter(scanFern ? 1800 : 3200, 60000, (x, z) => dry(x, z) && (!scanFern || Math.abs(x) > 27 || z < -9) && r() < edge(x, z) * (0.35 + fbm(x * 0.2, z * 0.2 + 5, 2)) && W.dirtAmount(x, z) < 0.1);
  const ferns = new THREE.InstancedMesh(fernGeometry(), foliage(T.fern, { sway: 0.05, flutter: 0.02, heightExpr: 'clamp(position.y * 1.5, 0.0, 1.0)', glow: 0.9 }), fernSpots.length);
  fernSpots.forEach(([x, z], i) => {
    const s = 0.8 + r() * 1.1; m.position.set(x, W.terrainHeight(x, z) - 0.02, z); m.rotation.set(0, r() * 6.283, 0); m.scale.set(s, s, s); m.updateMatrix();
    ferns.setMatrixAt(i, m.matrix); const v = 0.7 + r() * 0.5; ferns.setColorAt(i, col.setRGB(v, v, v * 0.8));
  });
  ferns.receiveShadow = true; ferns.frustumCulled = false; scene.add(ferns);

  if (scanFern) {                                                   // real fern plants wherever you can walk up to them
    const spots = scatter(460, 60000, (x, z) => dry(x, z) && Math.abs(x) <= 27 && z >= -9 && r() < edge(x, z) * (0.3 + fbm(x * 0.2, z * 0.2 + 5, 2)) && W.dirtAmount(x, z) < 0.1);
    const mat = windAndGlow(Object.assign(scanFern.material.clone(), { alphaTest: 0.5, side: THREE.DoubleSide }), { sway: 0.05, flutter: 0.015, heightExpr: 'clamp(position.y * 3.0, 0.0, 1.0)', glow: 0.7 });
    const variants = [scanFern.parts.fern_02_a, scanFern.parts.fern_02_d, scanFern.parts.fern_02_c].filter(Boolean);
    variants.forEach((geo, gi) => {
      const mine = spots.filter((_, i) => i % variants.length === gi), mesh = new THREE.InstancedMesh(geo, mat, mine.length);
      mine.forEach(([x, z], i) => {
        const s = 1.3 + r() * 1.5; m.position.set(x, W.terrainHeight(x, z), z); m.rotation.set(0, r() * 6.283, 0); m.scale.set(s, s, s); m.updateMatrix();
        mesh.setMatrixAt(i, m.matrix); const v = 0.75 + r() * 0.4; mesh.setColorAt(i, col.setRGB(v, v, v * 0.85));
      });
      mesh.receiveShadow = true; mesh.frustumCulled = false; scene.add(mesh);
    });
  }

  const bushSpots = scatter(520, 30000, (x, z) => dry(x, z) && Math.abs(x) < 36 && edge(x, z) > 0.45 && r() < 0.5 + fbm(x * 0.1, z * 0.1 + 60, 2) * 0.6 - W.sunGap(x, z) * 0.5);
  [bushGeometry(5), bushGeometry(6)].forEach((geo, gi) => {
    const mine = bushSpots.filter((_, i) => i % 2 === gi), map = gi ? T.leavesGold : T.leaves;
    const bush = new THREE.InstancedMesh(geo, foliage(map, { sway: 0.04, flutter: 0.02, heightExpr: 'clamp(position.y / 1.6, 0.0, 1.0)' }), mine.length);
    mine.forEach(([x, z], i) => {
      const s = 0.8 + r() * 1.3; m.position.set(x, W.terrainHeight(x, z) - 0.1, z); m.rotation.set(0, r() * 6.283, 0); m.scale.set(s, s * (0.8 + r() * 0.4), s); m.updateMatrix();
      bush.setMatrixAt(i, m.matrix); const v = 0.6 + r() * 0.5; bush.setColorAt(i, col.setRGB(v, v, v * 0.85));
    });
    bush.castShadow = bush.receiveShadow = true; bush.frustumCulled = false; bush.customDepthMaterial = depthFor(map); scene.add(bush);
  });

  // ---- fallen logs and stumps
  {
    const logs = new Geo();
    const spots = scatter(16, 5000, (x, z) => dry(x, z) && edge(x, z) > 0.5 && edge(x, z) < 1 && Math.abs(x) < 27);
    for (const [x, z] of spots) {
      const a = r() * 6.283, L = 3 + r() * 5, rad = 0.16 + r() * 0.16, pts = [];
      for (let i = 0; i <= 5; i++) {
        const t = i / 5 - 0.5, px = x + Math.cos(a) * L * t, pz = z + Math.sin(a) * L * t;
        const p = V(px, W.terrainHeight(px, pz) + rad * 0.7, pz); p.r = rad * (1 - (i / 5) * 0.3); pts.push(p);
      }
      logs.tube(pts, 8, 2, 1.6);
      for (const p of pts) if (Math.abs(p.x) < 23) W.CIRCLES.push({ x: p.x, z: p.z, r: rad + 0.1 });
    }
    const stumpSpots = scatter(9, 5000, (x, z) => dry(x, z) && edge(x, z) > 0.3 && Math.abs(x) < 24 && W.dirtAmount(x, z) < 0.1);
    const scanStump = T.scan?.tree_stump_01, scanTrunk = T.scan?.dead_tree_trunk;
    if (scanStump) {
      const g = scanStump.list[0], mesh = new THREE.InstancedMesh(g, scanStump.material, stumpSpots.length);
      stumpSpots.forEach(([x, z], i) => {
        const s = 0.8 + r() * 0.6; m.position.set(x, W.terrainHeight(x, z) - g.userData.minY * s - 0.12, z); m.rotation.set(0, r() * 6.283, 0); m.scale.set(s, s, s); m.updateMatrix();
        mesh.setMatrixAt(i, m.matrix); W.CIRCLES.push({ x, z, r: 0.42 * s });
      });
      mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh);
    }
    if (scanTrunk) {
      const g = scanTrunk.list[0], spots = scatter(5, 8000, (x, z) => dry(x, z) && Math.abs(x) > 22.5 && Math.abs(x) < 27 && z > 4 && z < 76), mesh = new THREE.InstancedMesh(g, scanTrunk.material, spots.length);
      spots.forEach(([x, z], i) => {
        const s = 1.6 + r() * 1.0; m.position.set(x, W.terrainHeight(x, z) + 0.05, z); m.rotation.set(0, r() * 6.283, (r() - 0.5) * 0.15); m.scale.set(s, s, s); m.updateMatrix(); mesh.setMatrixAt(i, m.matrix);
      });
      mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh);
    }
    for (const [x, z] of scanStump ? [] : stumpSpots) {
      const y = W.terrainHeight(x, z), rad = 0.25 + r() * 0.2, a = V(x, y - 0.3, z), b = V(x + 0.05, y + 0.35 + r() * 0.4, z);
      a.r = rad * 1.35; b.r = rad; logs.tube([a, b], 9, 2, 1.6); W.CIRCLES.push({ x, z, r: rad * 1.2 });
    }
    const mesh = new THREE.Mesh(logs.build(), barkMat); mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh);
  }

  // ---- rocks: creek stones, forest boulders, chalk blocks fallen from the bank
  const rockMat = new THREE.MeshStandardMaterial({ map: T.rock.map, normalMap: T.rock.normalMap, roughness: 1.0, normalScale: new THREE.Vector2(1.4, 1.4) });
  const chalkMat = new THREE.MeshStandardMaterial({ map: T.chalk.map, normalMap: T.chalk.normalMap, roughness: 0.92 });
  if (T.scanned?.chalk) bleach(chalkMat); else chalkMat.color.set(0xfaf6ec);
  const wetMat = new THREE.MeshStandardMaterial({ map: T.rock.map, normalMap: T.rock.normalMap, roughness: 0.32, color: 0x9a9a9a });
  const place = (mat, list, geoSeed) => {
    if (!list.length) return;
    const mesh = new THREE.InstancedMesh(rockGeometry(geoSeed), mat, list.length);
    list.forEach(([x, y, z, s, flat = 1], i) => {
      m.position.set(x, y, z); m.rotation.set(r() * 0.5, r() * 6.283, r() * 0.5); m.scale.set(s * (0.8 + r() * 0.5), s * flat, s * (0.8 + r() * 0.5)); m.updateMatrix();
      mesh.setMatrixAt(i, m.matrix); const v = 0.75 + r() * 0.4; mesh.setColorAt(i, col.setRGB(v, v, v));
    });
    mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false; scene.add(mesh);
  };
  const creekStones = [[], []], forestRocks = [[], []], chalkBlocks = [];
  for (let i = 0; i < 520; i++) {                                     // stones in and beside the water
    const x = -60 + r() * 120, z = W.creekZ(x) + (r() - 0.5) * (W.creekHalfWidth(x) * 2 + 3), h = W.terrainHeight(x, z);
    if (h > 0.35 || (Math.abs(x) < 3.2 && Math.abs(z) < 3.2)) continue;
    const s = 0.1 + Math.pow(r(), 2.2) * 0.6;
    creekStones[i % 2].push([x, h + s * 0.15, z, s, 0.75]);
  }
  for (const s of W.STEPPING_STONES) creekStones[0].push([s.x, s.top - s.r * 0.42, s.z, s.r * 1.25, 0.55, true]);   // flat-topped, kept simple
  for (const b of W.BOULDERS) forestRocks[0].push([b.x, W.terrainHeight(b.x, b.z) + b.r * 0.3, b.z, b.r * 1.25]);
  for (const [x, z] of scatter(150, 20000, (x, z) => dry(x, z) && edge(x, z) > 0.35 && r() < 0.3))
  {
    const s = 0.2 + Math.pow(r(), 2) * 1.3;
    forestRocks[Math.floor(r() * 2)].push([x, W.terrainHeight(x, z) + 0.02, z, s]);
    if (s > 0.35 && Math.abs(x) < 23) W.CIRCLES.push({ x, z, r: s * 0.85 });
  }
  for (let i = 0; i < 46; i++) {                                      // blocks fallen from the chalk bank
    const x = -30 + r() * 60, e = W.cliffEdge(x), z = e - 2.2 + r() * 1.6, s = 0.15 + Math.pow(r(), 2) * 0.75;
    if (Math.abs(x) < 7.5 && z < 79.3) continue;
    chalkBlocks.push([x, W.terrainHeight(x, z) + s * 0.2, z, s, 0.8]);
    if (s > 0.3) W.CIRCLES.push({ x, z, r: s * 0.8 });
  }
  // bigger stones use scanned, moss-covered rocks; small ones stay simple
  const kit = ['rock_moss_set_01', 'rock_moss_set_02'].flatMap((n) => (T.scan?.[n] ? T.scan[n].list.map((g) => ({ g, mat: T.scan[n].material })) : []));
  const placeScanned = (list, wet) => {
    const groups = new Map();
    for (const item of list) { const k = kit[Math.floor(r() * kit.length)]; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(item); }
    for (const [k, items] of groups) {
      const mat = wet ? Object.assign(k.mat.clone(), { color: new THREE.Color(0x8c8c8c), roughness: 0.5 }) : k.mat;
      const mesh = new THREE.InstancedMesh(k.g, mat, items.length), half = Math.max(k.g.userData.size.x, k.g.userData.size.z) / 2;
      items.forEach(([x, , z, s], i) => {
        const sc = (s * 1.25) / half; m.position.set(x, W.terrainHeight(x, z) - k.g.userData.minY * sc - s * 0.3, z); m.rotation.set(0, r() * 6.283, 0); m.scale.set(sc, sc, sc); m.updateMatrix(); mesh.setMatrixAt(i, m.matrix);
      });
      mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false; scene.add(mesh);
    }
  };
  const split = (list, min) => (kit.length ? [list.filter((q) => q[3] >= min && !q[5]), list.filter((q) => q[3] < min || q[5])] : [[], list]);
  creekStones.forEach((list, i) => { const [big, small] = split(list, 0.5); placeScanned(big, true); place(wetMat, small, 1 + i); });
  forestRocks.forEach((list, i) => { const [big, small] = split(list, 0.6); placeScanned(big, false); place(rockMat, small, 3 + i); });
  place(chalkMat, chalkBlocks, 5);

  console.log(`[forest] ${total} trees`);
}
