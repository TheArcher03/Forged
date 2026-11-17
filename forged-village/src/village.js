// The village: timber-and-thatch roundhouses, our open-fronted workshop, the village
// fire and the things each family leaves outside its door.
import * as THREE from 'three';
import * as W from './world.js';
import { rng, fbm } from './noise.js';
import { Geo, V, rockGeometry } from './forest.js';

export const SMOKE = [];   // where smoke rises: [x, y, z, size]
export const FLAMES = [];  // where fires burn: [x, y, z, size]

const TAU = Math.PI * 2;

export default function createVillage(scene, T) {
  prepare(T);
  const r = rng(303), scanThatch = !!T.scanned?.thatch;
  const wood = new Geo(), bark = new Geo(), hide = new Geo(), char = new Geo(), pelt = new Geo();
  const th = { p: [], n: [], u: [], c: [], i: [] };          // thatch (carries its own weathering colours)
  const rocks = [], paleRocks = [];
  const solid = (x, z, rad) => W.CIRCLES.push({ x, z, r: rad });
  const flat = (n) => () => n;
  const pole = (geo, a, b, ra, rb = ra, segs = 6, vScale = 1.2) => { const p = V().copy(a), q = V().copy(b); p.r = ra; q.r = rb; geo.tube([p, q], segs, 1, vScale); };
  const log = (a, b, rad) => {                               // a sawn log with pale end grain
    pole(bark, a, b, rad, rad * 0.92, 8, 1.6);
    const d = V().subVectors(b, a).normalize();
    wood.disc(b, d, rad * 0.92); wood.disc(a, d.clone().negate(), rad);
  };
  const ring = (geo, cx, y, cz, rad, thick, from = 0, to = TAU, wob = 0.03) => {
    const pts = [], n = Math.max(8, Math.round(((to - from) * rad) / 0.35));
    for (let i = 0; i <= n; i++) { const a = from + ((to - from) * i) / n; const p = V(cx + Math.sin(a) * rad, y + (r() - 0.5) * wob, cz + Math.cos(a) * rad); p.r = thick; pts.push(p); }
    geo.tube(pts, 5, 1, 1.2);
  };

  // ---- a roundhouse ----------------------------------------------------------
  function roundhouse(b, gapAngle, gapHalf, { rafters = 14, open = false } = {}) {
    const y = W.terrainHeight(b.x, b.z), R = b.r;
    const inGap = (a) => Math.abs(Math.atan2(Math.sin(a - gapAngle), Math.cos(a - gapAngle))) < gapHalf;

    // wall of upright split timbers, lashed with withies
    const n = Math.round((TAU * R) / 0.25);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + (r() - 0.5) * 0.01;
      if (inGap(a)) continue;
      const rad = 0.085 + r() * 0.045, rr = R + (r() - 0.5) * 0.05, top = b.wallH + (r() - 0.5) * 0.22;
      pole(wood, V(b.x + Math.sin(a) * rr, y - 0.35, b.z + Math.cos(a) * rr), V(b.x + Math.sin(a) * (rr + (r() - 0.5) * 0.05), y + top, b.z + Math.cos(a) * (rr + (r() - 0.5) * 0.05)), rad * 1.1, rad, 6, 1.0);
    }
    const from = gapAngle + gapHalf, to = gapAngle - gapHalf + TAU;
    for (const hgt of [0.45, b.wallH - 0.35]) ring(wood, b.x, y + hgt, b.z, R + 0.13, 0.03, from, to, 0.05);
    ring(wood, b.x, y + b.wallH + 0.02, b.z, R, 0.085, 0, TAU, 0.02);        // ring beam under the rafters

    // daubed inner wall, seen through the gaps between timbers
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.1, R - 0.1, b.wallH + 0.5, 48, 1, true, from, to - from), daubMat);
    inner.position.set(b.x, y + b.wallH / 2 - 0.15, b.z); inner.castShadow = inner.receiveShadow = true; scene.add(inner);

    // stones packed round the foot of the wall
    for (let a = 0; a < TAU; a += 0.5 / R) if (!inGap(a) && r() > 0.25) rocks.push([b.x + Math.sin(a) * (R + 0.24), y + 0.04, b.z + Math.cos(a) * (R + 0.24), 0.11 + r() * 0.13, 0.7]);

    // roof: rafters, then overlapping courses of thatch with ragged edges
    const eaveR = R + 0.85, eaveY = y + b.wallH - 0.32, apexY = y + b.peak;
    const prof = (s) => ({ R: eaveR * (1 - s), Y: eaveY + (apexY - eaveY) * s - 0.22 * Math.sin(Math.PI * s) });
    for (let k = 0; k < rafters; k++) {
      const a = (k / rafters) * TAU + 0.1, e = prof(-0.04), t = prof(0.93);
      pole(wood, V(b.x + Math.sin(a) * e.R, e.Y - 0.1, b.z + Math.cos(a) * e.R), V(b.x + Math.sin(a) * t.R, t.Y - 0.1, b.z + Math.cos(a) * t.R), 0.06, 0.04, 5, 1.2);
    }
    for (let k = 0; k < 7; k++) {                                              // poles crossing at the smoke hole
      const a = (k / 7) * TAU + r(), lo = prof(0.86), out = 0.5 + r() * 0.35;
      pole(wood, V(b.x + Math.sin(a) * lo.R, lo.Y, b.z + Math.cos(a) * lo.R), V(b.x - Math.sin(a) * out * 0.5, apexY + out, b.z - Math.cos(a) * out * 0.5), 0.045, 0.028, 5);
    }
    const slope = Math.hypot(eaveR, apexY - eaveY), nr = (apexY - eaveY) / slope, ny = eaveR / slope;
    const COURSES = 7, SEG = 72, uRep = Math.max(3, Math.round((TAU * eaveR) / 3.2));
    const sunA = Math.atan2(W.SUN_DIR.x, W.SUN_DIR.z);
    for (let k = 0; k < COURSES; k++) {
      const s0 = k / COURSES - (k === 0 ? 0.035 : 0.02), s1 = Math.min(0.985, (k + 1.6) / COURSES), base = th.p.length / 3;
      for (let j = 0; j < 2; j++) for (let i = 0; i <= SEG; i++) {
        const a = (i / SEG) * TAU, wrapI = i % SEG;
        const rag = j === 0 ? (fbm(wrapI * 0.9 + k * 13, k * 7.3 + b.x, 2) - 0.5) : 0;
        const s = (j === 0 ? s0 : s1) + rag * 0.05, pr = prof(s), off = j === 0 ? 0.15 : 0.02;
        const rad = pr.R + nr * off + rag * 0.12;
        th.p.push(b.x + Math.sin(a) * rad, pr.Y + ny * off, b.z + Math.cos(a) * rad);
        th.n.push(Math.sin(a) * nr, ny, Math.cos(a) * nr);
        th.u.push((i / SEG) * uRep + k * 0.37, scanThatch ? k * 0.37 + (j === 0 ? 0.0 : 0.6) : (k % 4) * 0.25 + (j === 0 ? 0.0 : 0.4));
        const away = 0.5 - 0.5 * Math.cos(a - sunA);                           // the side the sun rarely dries
        const moss = W.smoothstep(0.45, 0.9, away) * W.smoothstep(0.75, 0.1, s) * (0.35 + 0.65 * fbm(wrapI * 0.3, k + b.z, 2));
        const soot = W.smoothstep(0.62, 1.0, s) * 0.6, v = (0.8 + 0.3 * fbm(wrapI * 0.5 + b.x, k * 3.1, 2)) * (1 - soot);
        th.c.push(v * W.mix(1.0, 0.6, moss), v * W.mix(0.96, 0.85, moss), v * W.mix(0.86, 0.45, moss));
      }
      for (let i = 0; i < SEG; i++) { const p = base + i, q = base + SEG + 1 + i; th.i.push(p, q, p + 1, q, q + 1, p + 1); }
    }
    SMOKE.push([b.x, apexY + 0.2, b.z, open ? 0.7 : 1]);
    return y;
  }

  const daubMat = new THREE.MeshStandardMaterial({ map: T.dirt.map, normalMap: T.dirt.normalMap, color: 0x8a6f55, roughness: 1, side: THREE.DoubleSide });

  // ---- the three family houses, each with a low hide-hung doorway facing the road
  for (const b of W.HOUSES) {
    const d = W.doorOf(b), ga = d.dir > 0 ? Math.PI / 2 : -Math.PI / 2, gh = 0.62 / b.r;
    const y = roundhouse(b, ga, gh);
    const px = (a, rad) => V(b.x + Math.sin(a) * rad, 0, b.z + Math.cos(a) * rad);
    void y; void px;   // the doorway itself (posts, porch, curtain) is built in entrances.js
  }

  // ---- our workshop: bigger, open to the street
  {
    const b = W.WORKSHOP, y = roundhouse(b, Math.PI, b.openHalfAngle, { rafters: 22, open: true });
    for (const p of W.WORKSHOP_POSTS) pole(wood, V(p.x, y - 0.4, p.z), V(p.x, y + b.wallH + 0.1, p.z), 0.2, 0.17, 9, 1.5);
    pole(wood, V(0, y - 0.4, b.z - b.r + 0.35), V(0, y + b.wallH + 0.1, b.z - b.r + 0.35), 0.17, 0.15, 9, 1.5); // centre post
    // the work stump, with its knee hide and a hammerstone
    const sx = -0.6, sz = b.z - 1.4;
    log(V(sx, y - 0.1, sz), V(sx, y + 0.46, sz), 0.34); solid(sx, sz, 0.36);
    pelt.card(V(sx, y + 0.475, sz), V(0.4, 0, 0.06), V(-0.06, 0, 0.4), flat(V(0, 1, 0)));
    rocks.push([sx + 0.55, y + 0.07, sz + 0.2, 0.11, 0.8], [sx + 0.7, y + 0.05, sz - 0.15, 0.07, 0.8]);
    // flint nodules heaped by the wall, and a hide laid out for the tools
    for (let i = 0; i < 26; i++) { const a = r() * TAU, d = Math.pow(r(), 0.7) * 0.75; paleRocks.push([2.9 + Math.cos(a) * d, y + 0.08 + (0.75 - d) * 0.4 * r(), b.z + 1.4 + Math.sin(a) * d, 0.1 + r() * 0.1, 0.8]); }
    solid(2.9, b.z + 1.4, 0.7);
    pelt.card(V(0.9, y + 0.03, b.z - 0.9), V(0.95, 0, 0.14), V(-0.12, 0, 0.8), flat(V(0, 1, 0)));
    // hafting bench: a split log on two stumps
    log(V(-3.3, y + 0.42, b.z + 0.4), V(-2.5, y + 0.42, b.z + 2.6), 0.2);
    log(V(-3.2, y - 0.1, b.z + 0.7), V(-3.2, y + 0.26, b.z + 0.7), 0.17); log(V(-2.62, y - 0.1, b.z + 2.3), V(-2.62, y + 0.26, b.z + 2.3), 0.17);
    solid(-3.1, b.z + 1.0, 0.45); solid(-2.7, b.z + 2.1, 0.45);
    // drying rack with a hide by the entrance: the "shop window"
    const rx = 3.6, rz = b.z - 3.4;
    pole(wood, V(rx - 0.8, y - 0.2, rz - 0.4), V(rx - 0.75, y + 1.7, rz - 0.38), 0.05); pole(wood, V(rx + 0.8, y - 0.2, rz + 0.4), V(rx + 0.75, y + 1.7, rz + 0.38), 0.05);
    pole(wood, V(rx - 0.9, y + 1.62, rz - 0.45), V(rx + 0.9, y + 1.62, rz + 0.45), 0.04);
    pelt.card(V(rx, y + 0.9, rz), V(0.66, 0, 0.33), V(0, 0.72, 0), flat(V(-0.45, 0.2, 0.9).normalize()));
    solid(rx - 0.75, rz - 0.38, 0.12); solid(rx + 0.75, rz + 0.38, 0.12);
  }

  // ---- village fire: ring of stones, burning logs, log seats, the standing stone
  {
    const f = W.FIRE, y = W.terrainHeight(f.x, f.z);
    // the fire itself (stones, logs, coals, flames) is built in hearths.js
    for (const [a, d, len] of [[0.5, 2.6, 2.0], [2.5, 2.7, 1.7], [4.4, 2.5, 2.2]]) {
      const cx = f.x + Math.cos(a) * d, cz = f.z + Math.sin(a) * d, tx = -Math.sin(a), tz = Math.cos(a);
      log(V(cx - tx * len / 2, y + 0.2, cz - tz * len / 2), V(cx + tx * len / 2, y + 0.2, cz + tz * len / 2), 0.24);
      for (const t of [-0.35, 0, 0.35]) solid(cx + tx * len * t, cz + tz * len * t, 0.3);
    }
    const st = W.STANDING_STONE, stone = new THREE.Mesh(rockGeometry(9, 4), rockMat);
    stone.scale.set(0.62, 2.7, 0.42); stone.rotation.y = 0.35;
    stone.position.set(st.x, W.terrainHeight(st.x, st.z) + 1.25, st.z); stone.castShadow = stone.receiveShadow = true; scene.add(stone);
  }

  // ---- stacked firewood beside every house
  const woodpile = (x, z, ang, rows, len) => {
    const y = W.terrainHeight(x, z), tx = Math.cos(ang), tz = Math.sin(ang), nx = -tz, nz = tx;
    for (let row = 0; row < rows; row++) for (let k = 0; k < rows + 3 - row; k++) {
      const rad = 0.09 + r() * 0.035, off = (k - (rows + 2 - row) / 2) * 0.23 + (r() - 0.5) * 0.03, l = len * (0.9 + r() * 0.2), j = (r() - 0.5) * 0.12;
      log(V(x + nx * off - tx * (l / 2 + j), y + 0.1 + row * 0.2, z + nz * off - tz * (l / 2 + j)), V(x + nx * off + tx * (l / 2 - j), y + 0.1 + row * 0.2, z + nz * off + tz * (l / 2 - j)), rad);
    }
    solid(x, z, 0.65);
  };
  woodpile(13.6, 11.2, 0.4, 3, 0.9); woodpile(-14.6, 22.2, 1.9, 3, 0.9); woodpile(17.0, 37.2, 2.6, 4, 1.0); woodpile(5.9, 63.6, 1.1, 4, 1.0);

  // ---- wattle fence: stakes with withies woven between them
  const fence = (pts, hgt = 0.95) => {
    for (let s = 0; s < pts.length - 1; s++) {
      const [x0, z0] = pts[s], [x1, z1] = pts[s + 1], L = Math.hypot(x1 - x0, z1 - z0), n = Math.round(L / 0.45);
      const nx = -(z1 - z0) / L, nz = (x1 - x0) / L;
      for (let i = 0; i <= n; i++) {
        const x = W.mix(x0, x1, i / n), z = W.mix(z0, z1, i / n), y = W.terrainHeight(x, z);
        pole(wood, V(x, y - 0.3, z), V(x + (r() - 0.5) * 0.06, y + hgt + r() * 0.15, z + (r() - 0.5) * 0.06), 0.035, 0.028, 5);
        if (i % 2 === 0) solid(x, z, 0.22);
      }
      for (let w = 0; w < 6; w++) {
        const line = [];
        for (let i = 0; i <= n * 2; i++) {
          const t = i / (n * 2), x = W.mix(x0, x1, t), z = W.mix(z0, z1, t), weave = Math.sin(t * n * Math.PI + (w % 2) * Math.PI) * 0.045;
          const p = V(x + nx * weave, W.terrainHeight(x, z) + 0.12 + w * (hgt - 0.15) / 6 + (r() - 0.5) * 0.02, z + nz * weave); p.r = 0.017; line.push(p);
        }
        wood.tube(line, 4, 1, 1);
      }
    }
  };

  // ---- Hide House: stretched hides on frames and a little smoke tent
  for (const [x, z, ang] of [[6.2, 12.4, 0.5], [5.6, 19.6, -0.35], [8.3, 21.6, 0.9]]) {
    const y = W.terrainHeight(x, z), tx = Math.cos(ang), tz = Math.sin(ang), lean = V(-tz * 0.22, 1, tx * 0.22).normalize();
    const foot = (s) => V(x + tx * s * 0.85, y - 0.25, z + tz * s * 0.85), head = (s) => foot(s).addScaledVector(lean, 2.25);
    for (const s of [-1, 1]) { pole(wood, foot(s), head(s), 0.05, 0.04); solid(x + tx * s * 0.85, z + tz * s * 0.85, 0.12); }
    pole(wood, foot(-1.15).addScaledVector(lean, 2.1), foot(1.15).addScaledVector(lean, 2.1), 0.035);
    pole(wood, foot(-1.15).addScaledVector(lean, 0.5), foot(1.15).addScaledVector(lean, 0.5), 0.035);
    pole(wood, foot(1).addScaledVector(lean, 1.6), V(x - tz * -1.0, y - 0.2, z + tx * -1.0), 0.04);   // prop
    pelt.card(V(x, y - 0.25, z).addScaledVector(lean, 1.3), V(tx * 0.8, 0, tz * 0.8), V().copy(lean).multiplyScalar(0.8), flat(V(-tz, 0.25, tx).normalize()));
  }
  {
    const x = 16.2, z = 20.6, y = W.terrainHeight(x, z);
    const tent = new THREE.Mesh(new THREE.ConeGeometry(1.0, 2.1, 9, 1, true), new THREE.MeshStandardMaterial({ map: T.hide.map, normalMap: T.hide.normalMap, roughness: 0.85, side: THREE.DoubleSide, color: 0xb9a48a }));
    tent.position.set(x, y + 1.0, z); tent.castShadow = tent.receiveShadow = true; scene.add(tent);
    for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU; pole(wood, V(x + Math.cos(a) * 1.0, y - 0.1, z + Math.sin(a) * 1.0), V(x - Math.cos(a) * 0.25, y + 2.55, z - Math.sin(a) * 0.25), 0.035, 0.025); }
    SMOKE.push([x, y + 2.2, z, 0.6]); solid(x, z, 1.0);
  }
  fence([[5.2, 9.6], [9.5, 8.6], [13.4, 9.4]]);

  // ---- Hearth House: clay oven, a bench, grain baskets and a wattle pen
  {
    const x = 6.6, z = 43.6, y = W.terrainHeight(x, z);
    const oven = new THREE.Mesh(new THREE.SphereGeometry(0.95, 28, 14, 0, TAU, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ map: T.dirt.map, normalMap: T.dirt.normalMap, color: 0xc49172, roughness: 0.95, normalScale: new THREE.Vector2(1.6, 1.6) }));
    oven.scale.set(1, 0.9, 1.15); oven.position.set(x, y - 0.05, z); oven.castShadow = oven.receiveShadow = true; scene.add(oven);
    for (let a = 0; a < TAU; a += 0.42) rocks.push([x + Math.cos(a) * 1.0, y + 0.05, z + Math.sin(a) * 1.2, 0.14 + r() * 0.08, 0.7]);
    SMOKE.push([x, y + 0.95, z, 0.6]); solid(x, z, 1.05);   // its glowing mouth is in hearths.js
    log(V(5.3, y + 0.36, 39.2), V(7.6, y + 0.36, 40.0), 0.2);                    // the bench everyone stops at
    log(V(5.6, y - 0.1, 39.3), V(5.6, y + 0.2, 39.3), 0.16); log(V(7.3, y - 0.1, 39.9), V(7.3, y + 0.2, 39.9), 0.16);
    solid(5.8, 39.4, 0.4); solid(7.1, 39.85, 0.4);
    const pen = [];
    for (let k = 0; k <= 16; k++) { const a = (k / 16) * TAU; pen.push([17.6 + Math.cos(a) * 2.3, 48.6 + Math.sin(a) * 2.3]); }
    fence(pen, 1.05);
  }
  // ---- Clay House: pit kiln and pots set out to dry
  {
    // the pit kiln itself is built in hearths.js
    fence([[-6.2, 29.6], [-9.0, 31.4], [-12.6, 31.9]], 0.85);
  }
  const potProfile = [[0.001, 0], [0.16, 0.0], [0.27, 0.12], [0.31, 0.3], [0.26, 0.46], [0.17, 0.55], [0.2, 0.62], [0.17, 0.62], [0.14, 0.55]].map(([x, y]) => new THREE.Vector2(x, y));
  const potSpots = [];
  for (let i = 0, tries = 0; i < 16 && tries < 400; tries++) {             // drying pots along the wall, clear of the porch
    const x = -5.6 - r() * 3.4, z = 27.3 + r() * 2.6, clay = W.HOUSES[1];
    if (Math.hypot(x - clay.x, z - clay.z) < clay.r + 0.55 || (z < 27.3 && x > -7.2)) continue;
    potSpots.push([x, z, 0.6 + r() * 0.9]); i++;
  }
  for (const [x, z] of [[4.9, 41.6], [5.3, 42.3], [8.9, 44.9]]) potSpots.push([x, z, 1.2]);              // grain jars by the oven
  for (const [x, z] of [[-3.2, 61.5], [-3.7, 62.2]]) potSpots.push([x, z, 0.9]);                            // birch tar and water in the workshop
  const pots = new THREE.InstancedMesh(new THREE.LatheGeometry(potProfile, 14), clayMat, potSpots.length);
  const m = new THREE.Object3D(), col = new THREE.Color();
  potSpots.forEach(([x, z, s], i) => {
    m.position.set(x, W.terrainHeight(x, z) - 0.01, z); m.rotation.set((r() - 0.5) * 0.08, r() * TAU, (r() - 0.5) * 0.08); m.scale.set(s, s * (0.85 + r() * 0.4), s); m.updateMatrix();
    pots.setMatrixAt(i, m.matrix); const v = 0.7 + r() * 0.5; pots.setColorAt(i, col.setRGB(v, v * (0.9 + r() * 0.1), v * 0.9)); solid(x, z, 0.26 * s);
  });
  pots.castShadow = pots.receiveShadow = true; scene.add(pots);

  // ---- test yard: a lashed-log frame with hanging vines, hinting at what's to come
  {
    const t = W.TEST_YARD, z = t.z + 3.4, y = W.terrainHeight(t.x, z);
    for (const s of [-1, 1]) { pole(bark, V(s * 2.6, y - 0.4, z), V(s * 2.5, y + 3.1, z), 0.12, 0.1, 8, 1.6); solid(s * 2.6, z, 0.2); }
    pole(bark, V(-3.0, y + 2.95, z), V(3.0, y + 3.0, z), 0.1, 0.09, 8, 1.6);
    for (let k = 0; k < 5; k++) { const x = -1.9 + k * 0.95 + (r() - 0.5) * 0.3, len = 1.0 + r() * 1.2; pole(wood, V(x, y + 2.95, z), V(x + (r() - 0.5) * 0.2, y + 2.95 - len, z + (r() - 0.5) * 0.1), 0.014, 0.01, 4); }
  }

  // ---- hand everything to the renderer
  const add = (geo, mat) => { const mesh = new THREE.Mesh(geo.build(), mat); mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh); return mesh; };
  add(wood, new THREE.MeshStandardMaterial({ map: T.wood.map, normalMap: T.wood.normalMap, roughness: 0.88, normalScale: new THREE.Vector2(1.5, 1.5) }));
  add(bark, new THREE.MeshStandardMaterial({ map: T.bark.map, normalMap: T.bark.normalMap, roughness: 0.95, normalScale: new THREE.Vector2(1.5, 1.5) }));
  add(hide, new THREE.MeshStandardMaterial({ map: T.hide.map, normalMap: T.hide.normalMap, roughness: 0.8, side: THREE.DoubleSide }));
  add(pelt, new THREE.MeshStandardMaterial({ map: T.pelt, alphaTest: 0.5, roughness: 0.8, side: THREE.DoubleSide })).customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: T.pelt, alphaTest: 0.5 });
  add(char, new THREE.MeshStandardMaterial({ map: T.bark.map, normalMap: T.bark.normalMap, color: 0x2a211b, roughness: 1 }));

  const tg = new THREE.BufferGeometry();
  tg.setAttribute('position', new THREE.Float32BufferAttribute(th.p, 3)); tg.setAttribute('normal', new THREE.Float32BufferAttribute(th.n, 3));
  tg.setAttribute('uv', new THREE.Float32BufferAttribute(th.u, 2)); tg.setAttribute('color', new THREE.Float32BufferAttribute(th.c, 3)); tg.setIndex(th.i);
  const roof = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ map: T.thatch.map, normalMap: T.thatch.normalMap, vertexColors: true, roughness: 1, side: THREE.DoubleSide, normalScale: new THREE.Vector2(2, 2) }));
  if (scanThatch) roof.material.color.setRGB(2.0, 1.7, 1.2);   // the scan is old grey thatch; warm it toward straw
  // seen from inside, thatch is dim and smoke-darkened
  roof.material.onBeforeCompile = (s) => {
    s.fragmentShader = s.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      if (dot(normalize(vNormal), normalize(vViewPosition)) < 0.0) diffuseColor.rgb *= vec3(0.2, 0.17, 0.13);`);
  };
  roof.castShadow = roof.receiveShadow = true; scene.add(roof);

  const scatterRocks = (list, mat, seed) => {
    const mesh = new THREE.InstancedMesh(rockGeometry(seed, 2), mat, list.length);
    list.forEach(([x, y, z, s, fl], i) => {
      m.position.set(x, y, z); m.rotation.set(r(), r() * TAU, r()); m.scale.set(s * (0.8 + r() * 0.5), s * fl, s * (0.8 + r() * 0.5)); m.updateMatrix();
      mesh.setMatrixAt(i, m.matrix); const v = 0.7 + r() * 0.45; mesh.setColorAt(i, col.setRGB(v, v, v));
    });
    mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh);
  };
  scatterRocks(rocks, rockMat, 12);
  scatterRocks(paleRocks, new THREE.MeshStandardMaterial({ map: T.chalk.map, color: 0xd9d6cc, roughness: 0.6 }), 14);

  // ---- wicker baskets (scanned) by the oven, the doors and the workshop
  if (T.scan?.wicker_basket_01) {
    const g = T.scan.wicker_basket_01.list[0], spots = [[5.0, 43.2], [8.2, 41.0], [-7.2, 24.4], [7.4, 14.6], [1.9, 63.2], [2.4, 63.9], [-1.6, 57.2]];
    const baskets = new THREE.InstancedMesh(g, T.scan.wicker_basket_01.material, spots.length);
    spots.forEach(([x, z], i) => {
      const s = 1.5 + r() * 0.6; m.position.set(x, W.terrainHeight(x, z), z); m.rotation.set(0, r() * TAU, 0); m.scale.set(s, s, s); m.updateMatrix();
      baskets.setMatrixAt(i, m.matrix); solid(x, z, 0.3 * s);
    });
    baskets.castShadow = baskets.receiveShadow = true; scene.add(baskets);
  }

  // ---- years of knapping underfoot: glittering flint flakes in and around the workshop
  {
    const N = 1700, b = W.WORKSHOP, y = W.terrainHeight(b.x, b.z);
    const flakes = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0xa9a59b, roughness: 0.18, metalness: 0.0, flatShading: true }), N);
    for (let i = 0; i < N; i++) {
      const a = r() * TAU, d = Math.pow(r(), 0.6) * (b.r + 2.2), x = b.x + Math.sin(a) * d, z = b.z + Math.cos(a) * d - (d > b.r ? 1.5 : 0);
      const s = 0.01 + Math.pow(r(), 2) * 0.03;
      m.position.set(x, (Math.hypot(x - b.x, z - b.z) < b.r + 1 ? y : W.terrainHeight(x, z)) + 0.008, z); m.rotation.set(r() * 0.4, r() * TAU, r() * 0.4); m.scale.set(s * 1.6, s * 0.22, s); m.updateMatrix();
      flakes.setMatrixAt(i, m.matrix); const v = 0.25 + r() * 0.45; flakes.setColorAt(i, col.setRGB(v, v, v * 1.03));
    }
    flakes.receiveShadow = true; scene.add(flakes);
  }
}

// shared materials (made once the textures exist)
let rockMat, clayMat;
export function prepare(T) {
  rockMat = new THREE.MeshStandardMaterial({ map: T.rock.map, normalMap: T.rock.normalMap, roughness: 1.0, normalScale: new THREE.Vector2(1.4, 1.4) });
  clayMat = new THREE.MeshStandardMaterial({ map: T.clay.map, normalMap: T.clay.normalMap, roughness: 0.75 });
}
