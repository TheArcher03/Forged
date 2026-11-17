// The way into each building. Every family house gets a proper roundhouse entrance:
// a heavy timber frame holding a closed plank door (split boards, battens and a brace,
// leather strap hinges, a wooden pull), a low drystone footing either side, and a porch
// on two posts carrying a thatched hood that runs back into the main roof. The door
// swings open when you trade, letting out the firelight. The approach is kept clear;
// each family's sign of trade hangs against a porch post.
// The workshop gets Old Greyhand's red ochre handprint on its doorpost.
import * as THREE from 'three';
import * as W from './world.js';
import { rng, fbm } from './noise.js';
import { U, DOOR_LEAVES } from './shared.js';
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

// Firelight spilling out when a door swings open.
function doorGlowTexture() {
  const S = 128, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d');
  g.fillStyle = '#0a0604'; g.fillRect(0, 0, S, S);                                    // a dark room...
  const grad = g.createRadialGradient(S * 0.55, S * 1.02, 2, S * 0.55, S * 0.95, S * 0.62);   // ...lit low by its hearth
  grad.addColorStop(0, 'rgba(255,170,90,0.95)'); grad.addColorStop(0.35, 'rgba(170,70,25,0.6)'); grad.addColorStop(1, 'rgba(30,10,4,0)');
  g.fillStyle = grad; g.fillRect(0, 0, S, S);
  g.fillStyle = 'rgba(0,0,0,0.85)'; g.fillRect(S * 0.18, 0, 7, S); g.fillRect(S * 0.82, 0, 6, S * 0.8);   // posts in the gloom
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
  const stones = [];
  const plankMat = new THREE.MeshStandardMaterial({ map: T.wood.map, normalMap: T.wood.normalMap, roughness: 0.92, color: 0xd2c2ad, normalScale: new THREE.Vector2(1.6, 1.6) });
  const battenMat = new THREE.MeshStandardMaterial({ map: T.wood.map, normalMap: T.wood.normalMap, roughness: 0.95, color: 0x9a8670 });
  const leatherMat = new THREE.MeshStandardMaterial({ color: 0x3b2a1d, roughness: 0.75 });
  const glowTex = doorGlowTexture();

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

    // the door: split planks in the frame, hinged on one post, opening inward
    {
      const door = new THREE.Group();
      const hinge = P(-0.04, 0, 0.62);
      door.matrixAutoUpdate = true;
      door.position.copy(hinge);
      door.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -dir), new THREE.Vector3(0, 1, 0), new THREE.Vector3(dir, 0, 0)));
      const leaf = new THREE.Group(); door.add(leaf);
      const W2 = 1.24, H = 1.72;
      const boards = new THREE.Mesh(new THREE.BoxGeometry(W2, H, 0.05), plankMat); boards.position.set(W2 / 2, H / 2 + 0.02, 0); leaf.add(boards);
      for (const y of [0.32, 1.38]) { const bt = new THREE.Mesh(new THREE.BoxGeometry(W2 - 0.12, 0.13, 0.04), battenMat); bt.position.set(W2 / 2, y, 0.045); leaf.add(bt); }
      const brace = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.11, 0.035), battenMat); brace.position.set(W2 / 2, 0.85, 0.043);
      brace.rotation.z = Math.atan2(1.38 - 0.32, W2 - 0.24) * -1; leaf.add(brace);
      for (const y of [0.32, 1.38]) {                                            // leather strap hinges, nailed with wooden pegs
        const strap = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.07, 0.012), leatherMat); strap.position.set(0.2, y, 0.07); leaf.add(strap);
        for (const x of [0.08, 0.24, 0.38]) { const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.02, 6), battenMat); peg.rotation.x = Math.PI / 2; peg.position.set(x, y, 0.08); leaf.add(peg); }
      }
      const pull = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.016, 6, 12, Math.PI), battenMat);      // a bent-wood pull
      pull.position.set(W2 - 0.16, 0.95, 0.06); pull.rotation.z = -Math.PI / 2; leaf.add(pull);
      const thong = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.22, 4), leatherMat); thong.position.set(W2 - 0.16, 0.83, 0.075); leaf.add(thong);
      leaf.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
      scene.add(door);
      // firelight behind the door, only seen while it stands open
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.75), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0, depthWrite: false, color: 0x8a8a8a }));
      const gc = P(-0.5, 0.88, 0); glow.position.set(gc.x, gc.y, gc.z); glow.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2; glow.visible = false; scene.add(glow);
      DOOR_LEAVES[b.key] = { leaf, glow, open: 0, target: 0 };
    }

    // a low drystone footing round the foot of the wall, either side of the doorway
    for (const side of [-1, 1]) for (let course = 0; course < 3; course++) {
      for (let k = 0; k < 9; k++) {
        const along = 0.78 + k * 0.24 + (course % 2) * 0.12;                      // metres along the wall from the door's centre line
        const ang = (along / R) * side, rr = R + 0.16 - course * 0.03;
        const c = { x: b.x + dir * Math.cos(ang) * rr, z: b.z + Math.sin(ang) * rr * dir };
        stones.push([c.x, y + 0.07 + course * 0.13, c.z, 0.16 + r() * 0.05, 0.42, Math.atan2(c.x - b.x, c.z - b.z)]);
      }
    }

    // a sign of the trade, hung on the porch
    const beam = (t) => P(nF, postH - 0.06, t);
    if (b.key === 'hide') {
      const post = P(nF + 0.11, 1.05, tF);                                             // a fox pelt nailed to the post
      const pelt = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.72), new THREE.MeshStandardMaterial({ map: T.pelt, alphaTest: 0.5, color: 0xd08a52, roughness: 0.9, side: THREE.DoubleSide }));
      pelt.position.copy(post); pelt.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2; pelt.castShadow = true; scene.add(pelt);
      for (let k = 0; k < 5; k++) { const t = 0.42 + k * 0.08; pole(cord, beam(t), P(nF + (r() - 0.5) * 0.04, postH - 0.5 - r() * 0.35, t + (r() - 0.5) * 0.05), 0.008, 0.007, 4); }   // drying thongs
    } else if (b.key === 'hearth') {
      const top = beam(-0.76);                                                         // a sheaf of wheat, hung ears-down by the post
      for (let k = 0; k < 46; k++) {
        const a = r() * TAU, rr = Math.sqrt(r()) * 0.06, len = 0.55 + r() * 0.12;
        const s0 = V(top.x + Math.cos(a) * rr * 0.4, top.y - 0.08, top.z + Math.sin(a) * rr * 0.4), s1 = V(top.x + Math.cos(a) * rr * 2.2, top.y - 0.08 - len, top.z + Math.sin(a) * rr * 2.2);
        pole(straw, s0, s1, 0.006, 0.005, 3);
        pole(straw, s1, V(s1.x + Math.cos(a) * 0.01, s1.y - 0.07, s1.z + Math.sin(a) * 0.01), 0.014, 0.005, 4);   // the ear
      }
      pole(cord, beam(-0.76), V(top.x, top.y - 0.1, top.z), 0.01);
      for (let k = 0; k < 2; k++) { const pts = []; for (let a = 0; a <= 12; a++) { const ang = (a / 12) * TAU; pts.push(Object.assign(V(top.x + Math.cos(ang) * 0.05, top.y - 0.12 - k * 0.025, top.z + Math.sin(ang) * 0.05), { r: 0.008 })); } cord.tube(pts, 4, 1, 1); }
    } else if (b.key === 'clay') {
      const at = beam(0.7);                                                             // a pot slung from the beam by the post
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

  const stoneMat = new THREE.MeshStandardMaterial({ map: T.chalk.map, normalMap: T.rock.normalMap, roughness: 1, color: 0xc9c2b6 });
  const stoneMesh = new THREE.InstancedMesh(rockGeometry(55, 2), stoneMat, stones.length), m = new THREE.Object3D(), col = new THREE.Color();
  stones.forEach(([x, yy, z, s, fl, face], i) => {
    m.position.set(x, yy, z); m.rotation.set((r() - 0.5) * 0.15, face + (r() - 0.5) * 0.3, (r() - 0.5) * 0.15); m.scale.set(s * 1.5, s * fl, s * 0.9); m.updateMatrix();
    stoneMesh.setMatrixAt(i, m.matrix); const v = 0.7 + r() * 0.45; stoneMesh.setColorAt(i, col.setRGB(v, v * 0.98, v * 0.95));
  });
  stoneMesh.castShadow = stoneMesh.receiveShadow = true; scene.add(stoneMesh);

  return (dt) => {                                  // doors swing toward open or shut; the firelight follows
    const t = U.uTime.value;
    for (const d of Object.values(DOOR_LEAVES)) {
      d.open += (d.target - d.open) * Math.min(1, dt * (d.target > d.open ? 2.2 : 3.5));
      d.leaf.rotation.y = d.open * 1.15;
      d.glow.visible = d.open > 0.02;
      d.glow.material.opacity = Math.min(1, d.open * 2) * (0.9 + 0.1 * Math.sin(t * 9.1) * Math.sin(t * 3.7));
    }
  };
}
