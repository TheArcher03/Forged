// The way into each building. Every family house gets a proper roundhouse porch:
// stout door posts and a lintel, two porch posts carrying a thatched hood that runs back
// into the main roof, a heavy hide curtain drawn aside and tied, a dim firelit room
// beyond, a threshold stone worn by feet, and a sign of the family's trade.
// The workshop gets Old Greyhand's red ochre handprint on its doorpost.
import * as THREE from 'three';
import * as W from './world.js';
import { rng, fbm } from './noise.js';
import { U, windAndGlow } from './shared.js';
import { Geo, V, rockGeometry } from './forest.js';

const TAU = Math.PI * 2;

// Builds triangle meshes from quads (for the porch thatch).
class Sheet {
  constructor() { this.p = []; this.u = []; }
  quad(a, b, c, d, ua, ub, uc, ud) {           // a-b-c-d counter-clockwise seen from the front
    for (const [v, uv] of [[a, ua], [b, ub], [c, uc], [a, ua], [c, uc], [d, ud]]) { this.p.push(v.x, v.y, v.z); this.u.push(uv[0], uv[1]); }
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.computeVertexNormals();
    return g;
  }
}

// The room beyond the doorway: dark, smoky, lit low by a hearth.
function interiorTexture(seed) {
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d'), r = rng(seed);
  g.fillStyle = '#0b0806'; g.fillRect(0, 0, S, S);
  const floor = g.createLinearGradient(0, S * 0.6, 0, S); floor.addColorStop(0, 'rgba(40,26,16,0)'); floor.addColorStop(1, 'rgba(64,42,26,0.9)');
  g.fillStyle = floor; g.fillRect(0, S * 0.6, S, S * 0.4);
  const hx = S * (0.4 + r() * 0.2), glow = g.createRadialGradient(hx, S * 0.95, 4, hx, S * 0.85, S * 0.55);
  glow.addColorStop(0, 'rgba(255,170,80,0.95)'); glow.addColorStop(0.25, 'rgba(210,90,30,0.55)'); glow.addColorStop(1, 'rgba(60,20,5,0)');
  g.fillStyle = glow; g.fillRect(0, 0, S, S);
  g.fillStyle = 'rgba(5,3,2,0.9)';                                     // roof posts and things hanging in the dark
  for (let i = 0; i < 2; i++) { const x = S * (0.15 + i * 0.68 + r() * 0.08); g.fillRect(x, 0, 9 + r() * 5, S); }
  for (let i = 0; i < 5; i++) { const x = S * (0.2 + r() * 0.6), l = 30 + r() * 50; g.fillRect(x, 0, 3, l); g.beginPath(); g.ellipse(x + 1.5, l + 10, 7 + r() * 6, 12 + r() * 8, 0, 0, TAU); g.fill(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function handprintTexture() {
  const S = 128, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d');
  g.fillStyle = 'rgba(150,40,22,0.85)';
  g.beginPath(); g.ellipse(64, 80, 24, 28, 0, 0, TAU); g.fill();                   // palm
  for (const [x, y, len, a] of [[38, 66, 26, -0.75], [50, 44, 34, -0.18], [64, 40, 38, 0], [78, 44, 34, 0.15], [90, 54, 26, 0.38]]) {
    g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.ellipse(0, -len / 2, 7, len / 2 + 4, 0, 0, TAU); g.fill(); g.restore();
  }
  const r = rng(77); g.globalCompositeOperation = 'destination-out';          // worn by forty winters
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(0,0,0,${0.15 + r() * 0.5})`; g.fillRect(r() * S, r() * S, 1 + r() * 4, 1 + r() * 3); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default function createEntrances(scene, T) {
  const r = rng(717);
  const bark = new Geo(), wood = new Geo(), cord = new Geo(), straw = new Geo();
  const thatch = new Sheet();
  const pole = (geo, a, b, ra, rb = ra, segs = 7, vScale = 1.4) => { const p = V().copy(a), q = V().copy(b); p.r = ra; q.r = rb; geo.tube([p, q], segs, 1, vScale); };
  const rockMat = new THREE.MeshStandardMaterial({ map: T.chalk.map, normalMap: T.rock.normalMap, roughness: 0.95, color: 0xb9b2a6 });
  const curtainMat = windAndGlow(new THREE.MeshStandardMaterial({ map: T.hide.map, normalMap: T.hide.normalMap, color: 0xe6c79c, roughness: 0.88, side: THREE.DoubleSide }),
    { sway: 0.035, flutter: 0.006, heightExpr: 'clamp(1.0 - uv.y, 0.0, 1.0)', glow: 0.25 });
  const interiors = [];

  for (const b of W.HOUSES) {
    const d = W.doorOf(b), dir = d.dir, y = W.terrainHeight(b.x, b.z), R = b.r;
    // local frame at the doorway: n points out of the house, t runs along the wall, h is height
    const P = (n, h, t) => V(b.x + dir * (R + n), y + h, b.z + t * dir);
    const eaveR = R + 0.85, eaveY = b.wallH - 0.32, apexY = b.peak;
    const roofH = (rho) => { const s = 1 - rho / eaveR; return eaveY + (apexY - eaveY) * s - 0.22 * Math.sin(Math.PI * s); };

    // door posts and lintel
    for (const t of [-0.67, 0.67]) pole(bark, P(0.02, -0.35, t), P(0.02, 1.86, t), 0.12, 0.105, 9);
    pole(bark, P(0.05, 1.79, -1.0), P(0.05, 1.8, 1.0), 0.105, 0.095, 9);

    // porch posts, side beams and front beam
    const nF = 1.3, tF = 0.92, postH = 2.08;           // tall enough to walk under
    for (const t of [-tF, tF]) {
      pole(bark, P(nF, -0.3, t), P(nF + 0.03, postH, t), 0.095, 0.085, 8);
      pole(bark, P(nF + 0.12, postH - 0.04, t), P(-0.1, postH + 0.02, t * 0.95), 0.06, 0.06, 6);
      W.CIRCLES.push({ x: b.x + dir * (R + nF), z: b.z + t * dir, r: 0.13 });
    }
    pole(bark, P(nF, postH - 0.02, -tF - 0.2), P(nF, postH - 0.02, tF + 0.2), 0.07, 0.07, 7);

    // the porch hood: a little gabled roof of thatch, its back buried in the main roof
    const nB = -1.1, nE = nF + 0.38, ridgeFront = 2.78, ridgeBack = roofH(R + nB) + 0.05, drop = 0.72, half = 1.22;
    const ridge = (n) => W.mix(ridgeBack, ridgeFront, (n - nB) / (nE - nB));
    pole(bark, P(nB, ridge(nB) - 0.08, 0), P(nE + 0.05, ridgeFront - 0.07, 0), 0.06, 0.055, 7);   // ridge pole
    for (const s of [-1, 1]) {                                                                       // rafters at the gable
      pole(wood, P(nF + 0.05, ridgeFront - 0.1, 0), P(nF + 0.05, ridgeFront - drop - 0.04, s * (half - 0.08)), 0.035, 0.03, 5);
    }
    const NN = 7, NS = 4, thick = 0.2;
    for (const s of [-1, 1]) {
      const surf = (i, j, off) => {                       // i along n, j from ridge (0) to eave (NS)
        const n = W.mix(nB, nE, i / NN), u = j / NS;
        const rag = j === NS ? (fbm(i * 1.7 + s * 5 + b.x, 3.3, 2) - 0.5) * 0.14 : 0;
        const front = i === NN ? (fbm(j * 1.9 + s * 3 + b.z, 7.1, 2) - 0.5) * 0.1 : 0;
        const h = ridge(n) - drop * u * (1 + rag * 0.4) + off;
        return P(n + front, h, s * (half * u + rag * 0.3 + 0.02));
      };
      const uvA = (i, j) => [(i / NN) * 2.0 + s * 0.31, (j / NS) * 1.15];
      for (let i = 0; i < NN; i++) for (let j = 0; j < NS; j++) {
        const [a, b2, c, e] = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]];
        const top = (q) => surf(q[0], q[1], thick * 0.55), bot = (q) => surf(q[0], q[1], -thick * 0.45);
        if (s > 0) { thatch.quad(top(a), top(e), top(c), top(b2), uvA(...a), uvA(...e), uvA(...c), uvA(...b2)); thatch.quad(bot(a), bot(b2), bot(c), bot(e), uvA(...a), uvA(...b2), uvA(...c), uvA(...e)); }
        else { thatch.quad(top(a), top(b2), top(c), top(e), uvA(...a), uvA(...b2), uvA(...c), uvA(...e)); thatch.quad(bot(a), bot(e), bot(c), bot(b2), uvA(...a), uvA(...e), uvA(...c), uvA(...b2)); }
      }
      for (let i = 0; i < NN; i++) {                      // the cut thickness along the eave
        const a = surf(i, NS, thick * 0.55), b2 = surf(i + 1, NS, thick * 0.55), c = surf(i + 1, NS, -thick * 0.45), e = surf(i, NS, -thick * 0.45);
        thatch.quad(a, b2, c, e, [i * 0.3, 0.9], [(i + 1) * 0.3, 0.9], [(i + 1) * 0.3, 1.0], [i * 0.3, 1.0]);
      }
      for (let j = 0; j < NS; j++) {                      // and across the front gable
        const a = surf(NN, j, thick * 0.55), b2 = surf(NN, j + 1, thick * 0.55), c = surf(NN, j + 1, -thick * 0.45), e = surf(NN, j, -thick * 0.45);
        thatch.quad(a, b2, c, e, [j * 0.3, 0.2], [(j + 1) * 0.3, 0.2], [(j + 1) * 0.3, 0.3], [j * 0.3, 0.3]);
      }
    }

    // the hide curtain, drawn aside and tied to the post
    {
      const side = r() < 0.5 ? -1 : 1, Wd = 1.3, top = 1.73, NU = 26, NV = 22;
      const span = (v) => (v > 0.47 ? W.mix(0.17, 0.8, W.smoothstep(0.47, 1, v)) : W.mix(0.34, 0.17, W.smoothstep(0, 0.47, v)));
      const pos = [], uv = [], idx = [];
      for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) {
        const u = i / NU, v = j / NV, sp = span(v);
        const gather = 1 - sp / 0.8;                                       // how bunched the hide is at this height
        const tt = side * (0.62 - u * sp * Wd);
        const pleat = Math.sin(u * Math.PI * (6 + gather * 6) + j * 0.15) * (0.012 + gather * 0.045);
        const bulge = Math.sin(Math.PI * u) * 0.05 * gather + (v < 0.47 ? (0.47 - v) * 0.12 : 0);
        const p = P(0.07 + pleat + bulge, 0.04 + v * (top - 0.04), tt);
        pos.push(p.x, p.y, p.z); uv.push(u * sp * 2.2, v * 1.6);
      }
      for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const a = j * (NU + 1) + i, c = a + NU + 1; idx.push(a, a + 1, c, c, a + 1, c + 1); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
      const curtain = new THREE.Mesh(g, curtainMat); curtain.castShadow = curtain.receiveShadow = true; scene.add(curtain);
      // the tie: a few turns of cord round the gathered hide
      const tieT = side * (0.62 - 0.09 * Wd), tieH = 0.04 + 0.47 * (top - 0.04);
      for (let k = 0; k < 3; k++) {
        const pts = [];
        for (let a = 0; a <= 14; a++) { const ang = (a / 14) * TAU; pts.push(Object.assign(P(0.12 + Math.cos(ang) * 0.11, tieH + k * 0.025 + Math.sin(ang) * 0.008, tieT + Math.sin(ang) * 0.13), { r: 0.009 })); }
        cord.tube(pts, 4, 1, 1);
      }
    }

    // the room inside: dim, smoky, a hearth glowing low
    {
      const tex = interiorTexture(31 + b.x * 7), mat = new THREE.MeshBasicMaterial({ map: tex, color: 0xb0b0b0 });
      const back = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.2), mat);
      const c = P(-1.5, 1.05, 0); back.position.copy(c); back.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2; scene.add(back);
      interiors.push([mat, r() * 10]);
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.4), new THREE.MeshBasicMaterial({ color: 0x3a281a }));
      floor.rotation.x = -Math.PI / 2; floor.position.copy(P(-0.75, 0.02, 0)); scene.add(floor);
    }

    // a threshold stone, and a second one stepping out onto the path
    for (const [n, s] of [[0.32, 0.5], [1.05, 0.42]]) {
      const stone = new THREE.Mesh(rockGeometry(40 + n * 10 + b.z, 3), rockMat);
      stone.scale.set(s * 1.25, 0.09, s * 0.8); const c = P(n, 0.0, (r() - 0.5) * 0.1); stone.position.set(c.x, W.terrainHeight(c.x, c.z) + 0.015, c.z);
      stone.rotation.y = (r() - 0.5) * 0.4 + (dir > 0 ? 0 : Math.PI); stone.receiveShadow = true; scene.add(stone);
    }

    // a sign of the trade, hung on the porch
    const beam = (t) => P(nF, postH - 0.06, t);
    if (b.key === 'hide') {
      const post = P(nF + 0.11, 1.05, tF);                                             // a fox pelt nailed to the post
      const pelt = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.72), new THREE.MeshStandardMaterial({ map: T.pelt, alphaTest: 0.5, color: 0xd08a52, roughness: 0.9, side: THREE.DoubleSide }));
      pelt.position.copy(post); pelt.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2; pelt.castShadow = true; scene.add(pelt);
      for (let k = 0; k < 6; k++) { const t = -0.3 + k * 0.1; pole(cord, beam(t), P(nF + (r() - 0.5) * 0.04, postH - 0.5 - r() * 0.35, t + (r() - 0.5) * 0.05), 0.008, 0.007, 4); }   // drying thongs
    } else if (b.key === 'hearth') {
      const top = beam(-0.35);                                                         // a sheaf of wheat, hung ears-down
      for (let k = 0; k < 46; k++) {
        const a = r() * TAU, rr = Math.sqrt(r()) * 0.06, len = 0.55 + r() * 0.12;
        const s0 = V(top.x + Math.cos(a) * rr * 0.4, top.y - 0.08, top.z + Math.sin(a) * rr * 0.4), s1 = V(top.x + Math.cos(a) * rr * 2.2, top.y - 0.08 - len, top.z + Math.sin(a) * rr * 2.2);
        pole(straw, s0, s1, 0.006, 0.005, 3);
        pole(straw, s1, V(s1.x + Math.cos(a) * 0.01, s1.y - 0.07, s1.z + Math.sin(a) * 0.01), 0.014, 0.005, 4);   // the ear
      }
      pole(cord, beam(-0.35), V(top.x, top.y - 0.1, top.z), 0.01);
      for (let k = 0; k < 2; k++) { const pts = []; for (let a = 0; a <= 12; a++) { const ang = (a / 12) * TAU; pts.push(Object.assign(V(top.x + Math.cos(ang) * 0.05, top.y - 0.12 - k * 0.025, top.z + Math.sin(ang) * 0.05), { r: 0.008 })); } cord.tube(pts, 4, 1, 1); }
    } else if (b.key === 'clay') {
      const at = beam(0.3);                                                            // a pot slung from the beam in a cord net
      const prof = [[0.001, 0], [0.12, 0.0], [0.2, 0.09], [0.23, 0.22], [0.19, 0.34], [0.12, 0.4], [0.14, 0.45], [0.12, 0.45], [0.1, 0.4]].map(([x, yy]) => new THREE.Vector2(x, yy));
      const pot = new THREE.Mesh(new THREE.LatheGeometry(prof, 18), new THREE.MeshStandardMaterial({ map: T.clay.map, normalMap: T.clay.normalMap, color: 0xd09a74, roughness: 0.8 }));
      pot.position.set(at.x, at.y - 0.95, at.z); pot.castShadow = pot.receiveShadow = true; scene.add(pot);
      for (let k = 0; k < 4; k++) { const a = (k / 4) * TAU; pole(cord, V(at.x, at.y, at.z), V(at.x + Math.cos(a) * 0.17, at.y - 0.62, at.z + Math.sin(a) * 0.17), 0.007); pole(cord, V(at.x + Math.cos(a) * 0.17, at.y - 0.62, at.z + Math.sin(a) * 0.17), V(at.x + Math.cos(a) * 0.2, at.y - 0.85, at.z + Math.sin(a) * 0.2), 0.007); }
    }
  }

  // Old Greyhand's red ochre handprint, on the workshop's left doorpost
  {
    const p = W.WORKSHOP_POSTS[0], c = W.WORKSHOP, y = W.terrainHeight(c.x, c.z);
    const out = new THREE.Vector3(p.x - c.x, 0, p.z - c.z).normalize();
    const face = new THREE.Vector3(0, 0, -1).lerp(out, 0.5).normalize();             // turned toward the street
    const hand = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshStandardMaterial({ map: handprintTexture(), transparent: true, roughness: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    hand.position.set(p.x + face.x * 0.205, y + 1.42, p.z + face.z * 0.205);
    hand.lookAt(hand.position.x + face.x, hand.position.y, hand.position.z + face.z); scene.add(hand);
  }

  // ---- hand it to the renderer
  const add = (geo, mat) => { const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh); return mesh; };
  add(bark.build(), new THREE.MeshStandardMaterial({ map: T.bark.map, normalMap: T.bark.normalMap, roughness: 0.95, normalScale: new THREE.Vector2(1.5, 1.5) }));
  add(wood.build(), new THREE.MeshStandardMaterial({ map: T.wood.map, normalMap: T.wood.normalMap, roughness: 0.9 }));
  add(cord.build(), new THREE.MeshStandardMaterial({ color: 0x5b4632, roughness: 1 }));
  add(straw.build(), new THREE.MeshStandardMaterial({ color: 0xd2b46e, roughness: 0.8 }));
  const thatchMat = new THREE.MeshStandardMaterial({ map: T.thatch.map, normalMap: T.thatch.normalMap, roughness: 1, side: THREE.DoubleSide, normalScale: new THREE.Vector2(2, 2) });
  thatchMat.color.setRGB(T.scanned?.thatch ? 1.75 : 0.9, T.scanned?.thatch ? 1.5 : 0.85, T.scanned?.thatch ? 1.06 : 0.75);
  add(thatch.build(), thatchMat);

  return () => {                                    // the hearths inside flicker
    const t = U.uTime.value;
    for (const [mat, seed] of interiors) { const k = 1.7 + 0.25 * Math.sin(t * 7.3 + seed) + 0.15 * Math.sin(t * 13.1 + seed * 2); mat.color.setRGB(k, k * 0.95, k * 0.9); }
  };
}
