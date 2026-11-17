// The village's fires, built the way they would really burn:
//  - the village fire: a "star fire" of split logs pushed into a bed of coals, inside a ring
//    of soot-blackened stones, with flames rising from where the logs meet;
//  - the Clay House's pit kiln: pots buried in a shallow pit and smothered under a mound of
//    sticks and bark that smoulders, glows through its gaps and smokes;
//  - the Hearth House oven: a clay dome with a fire glowing inside its mouth.
import * as THREE from 'three';
import * as W from './world.js';
import { rng, fbm } from './noise.js';
import { U } from './shared.js';
import { Geo, V, rockGeometry } from './forest.js';
import { SMOKE, FLAMES } from './village.js';

const TAU = Math.PI * 2;

// Ash: pale grey at the edges where it has cooled, black char toward the middle.
function ashTextures() {
  const S = 256, r = rng(515);
  const make = () => { const c = document.createElement('canvas'); c.width = c.height = S; return [c, c.getContext('2d')]; };
  const [cv, g] = make();
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0, '#120e0b'); grad.addColorStop(0.45, '#1f1a16'); grad.addColorStop(0.75, '#5d5751'); grad.addColorStop(1, '#3b3631');
  g.fillStyle = grad; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 2600; i++) {                        // flecks of white ash and black char
    const a = r() * TAU, d = Math.sqrt(r()) * S * 0.5, x = S / 2 + Math.cos(a) * d, y = S / 2 + Math.sin(a) * d;
    const pale = r() < d / (S * 0.5);
    g.fillStyle = pale ? `rgba(${180 + r() * 60},${175 + r() * 55},${168 + r() * 50},${0.2 + r() * 0.35})` : `rgba(8,6,5,${0.3 + r() * 0.5})`;
    g.fillRect(x, y, 1 + r() * 3, 1 + r() * 2);
  }
  const [cv2, e] = make();                                  // where the coals still glow
  e.fillStyle = '#000'; e.fillRect(0, 0, S, S);
  for (let i = 0; i < 900; i++) {
    const a = r() * TAU, d = Math.pow(r(), 1.6) * S * 0.32, x = S / 2 + Math.cos(a) * d, y = S / 2 + Math.sin(a) * d;
    const k = 1 - d / (S * 0.32);
    e.fillStyle = `rgba(255,${90 + r() * 90},${20 + r() * 30},${(0.15 + r() * 0.6) * k})`;
    e.beginPath(); e.arc(x, y, 1 + r() * 3.5, 0, TAU); e.fill();
  }
  const tex = (c, srgb) => { const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 4; return t; };
  return { map: tex(cv, true), emissive: tex(cv2, true) };
}

export default function createHearths(scene, T) {
  const r = rng(616), m = new THREE.Object3D(), col = new THREE.Color();
  const bark = new Geo(), charred = new Geo(), glowing = new Geo();
  const stick = (geo, a, b, ra, rb = ra * 0.9, segs = 7) => { const p = V().copy(a), q = V().copy(b); p.r = ra; q.r = rb; geo.tube([p, q], segs, 1, 1.4); };
  // A log in three parts: bark at the cool end, charcoal toward the fire, a glowing tip in the coals.
  const burningLog = (outer, inner, rad, charFrom = 0.45, glowFrom = 0.88) => {
    const at = (t) => V().lerpVectors(outer, inner, t);
    stick(bark, outer, at(charFrom + 0.02), rad, rad * 0.97, 8);
    stick(charred, at(charFrom), at(glowFrom + 0.02), rad * 0.97, rad * 0.86, 8);
    stick(glowing, at(glowFrom), inner, rad * 0.86, rad * 0.62, 8);
    charred.disc(outer, V().subVectors(outer, inner).normalize(), rad * 0.96, 9);   // sawn end, darkened
  };

  const ash = ashTextures();
  const ashMat = new THREE.MeshStandardMaterial({ map: ash.map, emissiveMap: ash.emissive, emissive: 0xffffff, emissiveIntensity: 1.6, roughness: 1 });
  const bed = (x, z, rad, y) => {                           // a shallow mound of ash and coals
    const g = new THREE.CircleGeometry(rad, 40, 0, TAU); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const d = Math.hypot(p.getX(i), p.getZ(i)) / rad; p.setY(i, (1 - d * d) * 0.06 + (fbm(p.getX(i) * 5 + x, p.getZ(i) * 5, 2) - 0.5) * 0.03); }
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, ashMat); mesh.position.set(x, y, z); mesh.receiveShadow = true; scene.add(mesh);
  };

  const sootMat = new THREE.MeshStandardMaterial({ map: T.rock.map, normalMap: T.rock.normalMap, color: 0x8f8a84, roughness: 1 });
  const stones = [];
  const coalsGlow = [], coalsDark = [];

  // ---------------- the village fire ----------------
  const f = W.FIRE, fy = W.terrainHeight(f.x, f.z);
  bed(f.x, f.z, 1.02, fy + 0.005);
  for (let i = 0; i < 15; i++) {                            // a ring of stones, blackened by years of fires
    const a = (i / 15) * TAU + (r() - 0.5) * 0.12, d = f.ringR + (r() - 0.5) * 0.08;
    stones.push([f.x + Math.cos(a) * d, fy + 0.07, f.z + Math.sin(a) * d, 0.19 + r() * 0.09, 0.72]);
  }
  for (let i = 0; i < 6; i++) {                             // split logs pushed in toward the middle
    const a = (i / 6) * TAU + 0.4 + (r() - 0.5) * 0.35, len = 0.95 + r() * 0.3, rad = 0.075 + r() * 0.035;
    const inner = V(f.x + Math.cos(a) * 0.1, fy + 0.2 + r() * 0.06, f.z + Math.sin(a) * 0.1);
    const outer = V(f.x + Math.cos(a) * (0.1 + len), fy + 0.07 + rad, f.z + Math.sin(a) * (0.1 + len));
    burningLog(outer, inner, rad);
  }
  for (let i = 0; i < 9; i++) {                             // half-burnt sticks fallen into the coals
    const a = r() * TAU, d = 0.15 + r() * 0.45, b2 = a + (r() - 0.5) * 2.5, l = 0.25 + r() * 0.3;
    const p = V(f.x + Math.cos(a) * d, fy + 0.07, f.z + Math.sin(a) * d), q = V(p.x + Math.cos(b2) * l, fy + 0.05, p.z + Math.sin(b2) * l);
    stick(r() < 0.5 ? glowing : charred, p, q, 0.018 + r() * 0.015);
  }
  for (let i = 0; i < 70; i++) {                            // the bed of coals under the flames
    const a = r() * TAU, d = Math.pow(r(), 0.8) * 0.55, s = 0.025 + r() * 0.045;
    (d < 0.38 && r() < 0.75 ? coalsGlow : coalsDark).push([f.x + Math.cos(a) * d, fy + 0.06 + (0.55 - d) * 0.06, f.z + Math.sin(a) * d, s]);
  }
  FLAMES.push({ x: f.x, y: fy + 0.12, z: f.z, size: 1.0, light: 26 });
  FLAMES.push({ x: f.x + 0.22, y: fy + 0.1, z: f.z - 0.12, size: 0.55 });
  FLAMES.push({ x: f.x - 0.2, y: fy + 0.1, z: f.z + 0.16, size: 0.62 });
  SMOKE.push([f.x, fy + 1.1, f.z, 1.4]);

  // ---------------- the Clay House pit kiln ----------------
  const k = W.KILN, ky = W.terrainHeight(k.x, k.z);
  bed(k.x, k.z, 1.05, ky - 0.02);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU + (r() - 0.5) * 0.1, d = 1.18 + (r() - 0.5) * 0.08;
    stones.push([k.x + Math.cos(a) * d, ky + 0.06, k.z + Math.sin(a) * d, 0.17 + r() * 0.08, 0.7]);
  }
  // pots buried in the fire, their rims showing through the fuel
  const potProfile = [[0.001, 0], [0.16, 0.0], [0.27, 0.12], [0.31, 0.3], [0.26, 0.46], [0.17, 0.55], [0.2, 0.62], [0.17, 0.62], [0.14, 0.55]].map(([x, y]) => new THREE.Vector2(x, y));
  const potMat = new THREE.MeshStandardMaterial({ map: T.clay.map, normalMap: T.clay.normalMap, color: 0x7a5442, roughness: 0.9, emissive: 0x501a08, emissiveIntensity: 0.6 });
  const buried = [[0.0, 0.0, 1.1], [0.42, 0.18, 0.9], [-0.3, 0.36, 0.85], [-0.2, -0.4, 0.95]];
  const pots = new THREE.InstancedMesh(new THREE.LatheGeometry(potProfile, 16), potMat, buried.length);
  buried.forEach(([dx, dz, s], i) => {
    m.position.set(k.x + dx, ky - 0.22 * s, k.z + dz); m.rotation.set((r() - 0.5) * 0.5, r() * TAU, (r() - 0.5) * 0.5); m.scale.set(s, s, s); m.updateMatrix(); pots.setMatrixAt(i, m.matrix);
  });
  pots.castShadow = pots.receiveShadow = true; scene.add(pots);
  // the fuel mound: sticks and bark leaned over the pots in a low dome, gaps glowing between them
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * TAU * 3.0 + r() * 0.6, ring = i % 3;
    const rOut = 0.98 - ring * 0.22, rIn = 0.18 + r() * 0.12, hIn = 0.3 + (2 - ring) * 0.06 + r() * 0.06;
    const outer = V(k.x + Math.cos(a) * rOut, ky + 0.04 + ring * 0.09, k.z + Math.sin(a) * rOut);
    const inner = V(k.x + Math.cos(a + (r() - 0.5) * 0.5) * rIn, ky + hIn, k.z + Math.sin(a + (r() - 0.5) * 0.5) * rIn);
    const rad = 0.025 + r() * 0.03;
    if (r() < 0.3) stick(bark, outer, inner, rad); else if (r() < 0.82) stick(charred, outer, inner, rad); else stick(glowing, outer, inner, rad * 0.9);
  }
  for (let i = 0; i < 9; i++) {                             // slabs of bark laid over the top
    const a = r() * TAU, d = 0.25 + r() * 0.5, len = 0.4 + r() * 0.25;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(len, 0.03, 0.16 + r() * 0.08), new THREE.MeshStandardMaterial({ map: T.bark.map, color: r() < 0.5 ? 0x3a2c22 : 0x231a14, roughness: 1 }));
    slab.position.set(k.x + Math.cos(a) * d, ky + 0.32 - d * 0.28, k.z + Math.sin(a) * d);
    slab.rotation.set(0, -a, 0.35 + d * 0.4); slab.rotateZ(0); slab.castShadow = slab.receiveShadow = true; scene.add(slab);
  }
  for (let i = 0; i < 40; i++) {
    const a = r() * TAU, d = 0.2 + Math.pow(r(), 0.7) * 0.75, s = 0.025 + r() * 0.04;
    (r() < 0.6 ? coalsGlow : coalsDark).push([k.x + Math.cos(a) * d, ky + 0.03, k.z + Math.sin(a) * d, s]);
  }
  FLAMES.push({ x: k.x + 0.35, y: ky + 0.12, z: k.z - 0.25, size: 0.42, light: 10 });
  FLAMES.push({ x: k.x - 0.4, y: ky + 0.1, z: k.z + 0.2, size: 0.34 });
  FLAMES.push({ x: k.x + 0.05, y: ky + 0.3, z: k.z + 0.35, size: 0.28 });
  SMOKE.push([k.x, ky + 0.5, k.z, 1.15]);

  // ---------------- the Hearth House oven: a glowing mouth ----------------
  {
    const o = W.OVEN, oy = W.terrainHeight(o.x, o.z);
    const mouthX = o.x - 0.935, tilt = new THREE.Vector3(0, 0, 1);   // the dome leans back, so the mouth does too
    // the opening: a dark arch, a raised clay lip round it, and the fire glowing inside
    const arch = new THREE.Shape();
    arch.moveTo(-0.26, 0); arch.lineTo(0.26, 0); arch.lineTo(0.26, 0.12); arch.absarc(0, 0.12, 0.26, 0, Math.PI, false); arch.lineTo(-0.26, 0);
    const inside = new THREE.Mesh(new THREE.ShapeGeometry(arch, 16), new THREE.MeshBasicMaterial({ color: 0x070403 }));
    inside.position.set(mouthX - 0.005, oy + 0.0, o.z); inside.rotation.y = -Math.PI / 2; inside.rotateOnWorldAxis(tilt, -0.2); scene.add(inside);
    const glowCv = document.createElement('canvas'); glowCv.width = glowCv.height = 128;
    const gg = glowCv.getContext('2d'), rad = gg.createRadialGradient(64, 118, 4, 64, 100, 80);
    rad.addColorStop(0, 'rgba(255,190,90,1)'); rad.addColorStop(0.35, 'rgba(255,110,30,0.75)'); rad.addColorStop(1, 'rgba(120,20,0,0)');
    gg.fillStyle = rad; gg.fillRect(0, 0, 128, 128);
    const glowTex = new THREE.CanvasTexture(glowCv); glowTex.colorSpace = THREE.SRGBColorSpace;
    const glow = new THREE.Mesh(new THREE.ShapeGeometry(arch, 16), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    const uv = glow.geometry.attributes.uv, gp = glow.geometry.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, gp.getX(i) / 0.52 + 0.5, gp.getY(i) / 0.4);
    glow.position.set(mouthX - 0.012, oy + 0.0, o.z); glow.rotation.y = -Math.PI / 2; glow.rotateOnWorldAxis(tilt, -0.2); glow.renderOrder = 3; scene.add(glow);
    hearthGlows.push(glow.material);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.055, 8, 20, Math.PI), new THREE.MeshStandardMaterial({ map: T.dirt.map, normalMap: T.dirt.normalMap, color: 0xb98a68, roughness: 0.95 }));
    lip.position.set(mouthX - 0.02, oy + 0.12, o.z); lip.rotation.y = -Math.PI / 2; lip.rotateOnWorldAxis(tilt, -0.2); lip.castShadow = true; scene.add(lip);
    for (let i = 0; i < 6; i++) coalsGlow.push([mouthX - 0.08 - r() * 0.15, oy + 0.02, o.z + (r() - 0.5) * 0.4, 0.02 + r() * 0.025]);   // a few raked out
    FLAMES.push({ x: mouthX - 0.4, y: oy + 0.4, z: o.z, size: 0, light: 5 });   // light only: the fire itself is inside
  }

  // ---------------- hand it all to the renderer ----------------
  const barkMat = new THREE.MeshStandardMaterial({ map: T.bark.map, normalMap: T.bark.normalMap, roughness: 0.95, normalScale: new THREE.Vector2(1.4, 1.4) });
  const charMat = new THREE.MeshStandardMaterial({ map: T.bark.map, normalMap: T.bark.normalMap, color: 0x1c1714, roughness: 1, normalScale: new THREE.Vector2(2, 2) });
  const glowMat = new THREE.MeshStandardMaterial({ map: T.bark.map, color: 0x2a140a, emissive: 0xff5a14, emissiveMap: T.bark.map, emissiveIntensity: 2.2, roughness: 1 });
  for (const [geo, mat] of [[bark, barkMat], [charred, charMat], [glowing, glowMat]]) {
    const mesh = new THREE.Mesh(geo.build(), mat); mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh);
  }
  const stoneMesh = new THREE.InstancedMesh(rockGeometry(21, 2), sootMat, stones.length);
  stones.forEach(([x, y, z, s, fl], i) => {
    m.position.set(x, y, z); m.rotation.set(r() * 0.4, r() * TAU, r() * 0.4); m.scale.set(s * (0.85 + r() * 0.4), s * fl, s * (0.85 + r() * 0.4)); m.updateMatrix();
    stoneMesh.setMatrixAt(i, m.matrix); const v = 0.55 + r() * 0.35; stoneMesh.setColorAt(i, col.setRGB(v, v * 0.97, v * 0.94));
  });
  stoneMesh.castShadow = stoneMesh.receiveShadow = true; scene.add(stoneMesh);
  const coalGeo = new THREE.DodecahedronGeometry(1, 0);
  const coalGlowMat = new THREE.MeshStandardMaterial({ color: 0x1a0d08, emissive: 0xff4a10, emissiveIntensity: 2.6, roughness: 1, flatShading: true });
  const coalDarkMat = new THREE.MeshStandardMaterial({ color: 0x17120f, roughness: 1, flatShading: true });
  for (const [list, mat] of [[coalsGlow, coalGlowMat], [coalsDark, coalDarkMat]]) {
    const mesh = new THREE.InstancedMesh(coalGeo, mat, list.length);
    list.forEach(([x, y, z, s], i) => { m.position.set(x, y, z); m.rotation.set(r() * 3, r() * 3, r() * 3); m.scale.set(s, s * 0.7, s); m.updateMatrix(); mesh.setMatrixAt(i, m.matrix); });
    mesh.receiveShadow = true; scene.add(mesh);
  }
  W.CIRCLES.push({ x: k.x, z: k.z, r: 1.3 });

  // coals breathe: the glow swells and fades unevenly
  const glowMats = [glowMat, coalGlowMat, ashMat, potMat];
  const base = glowMats.map((g) => g.emissiveIntensity);
  return () => {
    const t = U.uTime.value;
    const breathe = 0.82 + 0.12 * Math.sin(t * 1.7) + 0.07 * Math.sin(t * 4.3 + 1) + 0.05 * Math.sin(t * 9.1);
    glowMats.forEach((g, i) => { g.emissiveIntensity = base[i] * breathe; });
    for (const g of hearthGlows) g.opacity = 0.8 + 0.2 * Math.sin(t * 6.1) * Math.sin(t * 2.3);
  };
}
const hearthGlows = [];
