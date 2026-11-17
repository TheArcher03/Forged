// Wildlife: a few creatures, chosen and placed with care, that make the valley feel alive.
//  - a grey heron fishing in the shallows past the western boulders: it stands, stalks,
//    strikes at fish, watches you if you come close and flies off if you come closer;
//  - two red kites soaring in slow circles high over the valley;
//  - swallows skimming the meadow and the creek;
//  - butterflies working the flowers, resting with their wings closed;
//  - dragonflies hovering and darting over the water, perching on reed tips;
//  - fish rising in the pools.
// Everything is built in code. Wings are textured cards hinged at the body.
import * as THREE from 'three';
import * as W from './world.js';
import { rng } from './noise.js';
import { U } from './shared.js';
import { FLOWERS, REEDS } from './grass.js';

const TAU = Math.PI * 2;
const WATER = W.WATER_LEVEL;
const clamp = W.clamp, mix = W.mix;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// ---------- textures, painted on canvas ----------
function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
// Path for one butterfly's right wings, root at the left edge, front at the top.
function wingOutline(g, w, h, kind) {
  g.beginPath();
  if (kind === 'brimstone') {               // leaf-shaped, pointed tips
    g.moveTo(0, h * 0.42); g.quadraticCurveTo(w * 0.5, h * 0.02, w * 0.97, h * 0.1); g.quadraticCurveTo(w * 0.9, h * 0.38, w * 0.7, h * 0.5);
    g.quadraticCurveTo(w * 0.86, h * 0.74, w * 0.55, h * 0.95); g.quadraticCurveTo(w * 0.25, h * 0.9, 0, h * 0.6);
  } else {                                  // forewing with a scalloped edge, rounded hindwing
    g.moveTo(0, h * 0.42); g.quadraticCurveTo(w * 0.45, h * 0.0, w * 0.95, h * 0.06); g.quadraticCurveTo(w * 0.86, h * 0.22, w * 0.88, h * 0.34);
    g.quadraticCurveTo(w * 0.78, h * 0.46, w * 0.64, h * 0.5); g.quadraticCurveTo(w * 0.86, h * 0.66, w * 0.72, h * 0.84);
    g.quadraticCurveTo(w * 0.48, h * 0.99, w * 0.22, h * 0.86); g.quadraticCurveTo(w * 0.06, h * 0.74, 0, h * 0.58);
  }
  g.closePath();
}
const BUTTERFLIES = {
  tortoiseshell: (g, w, h) => {
    wingOutline(g, w, h); g.save(); g.clip();
    g.fillStyle = '#d4581c'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#3a2416'; g.fillRect(0, 0, w * 0.22, h);                                     // dark wing bases
    for (const [x, y, rx, ry] of [[0.45, 0.13, 0.08, 0.05], [0.63, 0.12, 0.06, 0.05], [0.44, 0.32, 0.06, 0.05], [0.8, 0.12, 0.05, 0.035]]) { g.fillStyle = '#1b1310'; g.beginPath(); g.ellipse(x * w, y * h, rx * w, ry * h, 0, 0, TAU); g.fill(); }
    g.fillStyle = '#f0d27a'; for (const [x, y] of [[0.55, 0.1], [0.72, 0.13]]) { g.beginPath(); g.ellipse(x * w, y * h, 0.045 * w, 0.03 * h, 0, 0, TAU); g.fill(); }
    g.fillStyle = '#ece6dc'; g.beginPath(); g.ellipse(0.88 * w, 0.1 * h, 0.03 * w, 0.025 * h, 0, 0, TAU); g.fill();
    g.strokeStyle = '#1b1310'; g.lineWidth = w * 0.07; wingOutline(g, w, h); g.stroke();       // dark border
    g.fillStyle = '#4c79c9'; for (let i = 0; i < 9; i++) { const t = i / 8; g.beginPath(); g.arc(mix(0.85, 0.3, t) * w, mix(0.3, 0.9, t) * h, w * 0.016, 0, TAU); g.fill(); }
    g.restore();
  },
  brimstone: (g, w, h) => {
    wingOutline(g, w, h, 'brimstone'); g.save(); g.clip();
    const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#d8d06a'); gr.addColorStop(1, '#f1ea8c');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e07a1e'; for (const [x, y] of [[0.5, 0.22], [0.42, 0.72]]) { g.beginPath(); g.arc(x * w, y * h, w * 0.025, 0, TAU); g.fill(); }
    g.strokeStyle = 'rgba(150,140,60,0.5)'; g.lineWidth = 1; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(0, h * 0.5); g.lineTo(w * (0.5 + i * 0.08), h * (0.05 + i * 0.16)); g.stroke(); }
    g.restore();
  },
  peacock: (g, w, h) => {
    wingOutline(g, w, h); g.save(); g.clip();
    g.fillStyle = '#7d1f1a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#3a1512'; g.fillRect(0, 0, w * 0.2, h);
    const eye = (x, y, rr) => { for (const [c, k] of [['#e9d36a', 1], ['#1a1a26', 0.78], ['#5b7fbf', 0.6], ['#0c0c12', 0.32]]) { g.fillStyle = c; g.beginPath(); g.ellipse(x * w, y * h, rr * w * k, rr * h * 0.8 * k, 0, 0, TAU); g.fill(); } };
    eye(0.78, 0.17, 0.13); eye(0.6, 0.78, 0.14);
    g.strokeStyle = '#2a1410'; g.lineWidth = w * 0.05; wingOutline(g, w, h); g.stroke();
    g.restore();
  },
  blue: (g, w, h) => {
    wingOutline(g, w, h); g.save(); g.clip();
    const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#5b6fcf'); gr.addColorStop(1, '#8aa4ee');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#2b2f4a'; g.lineWidth = w * 0.035; wingOutline(g, w, h); g.stroke();
    g.strokeStyle = '#f2f2f2'; g.lineWidth = w * 0.02; wingOutline(g, w, h); g.stroke();
    g.restore();
  },
};

function kiteWing() {           // a red kite's wing from below: rufous coverts, pale window, black fingers
  return canvasTex(256, 128, (g, w, h) => {
    g.beginPath(); g.moveTo(0, h * 0.18); g.quadraticCurveTo(w * 0.42, h * 0.04, w * 0.62, h * 0.12);
    const fingers = 5;
    for (let i = 0; i < fingers; i++) {
      const y0 = mix(0.14, 0.62, i / fingers), y1 = mix(0.14, 0.62, (i + 1) / fingers), tip = mix(0.99, 0.84, i / fingers);
      g.lineTo(w * tip, h * (y0 + 0.035)); g.lineTo(w * (tip - 0.02), h * (y0 + 0.075)); g.lineTo(w * 0.66, h * (y1 + 0.01));
    }
    g.quadraticCurveTo(w * 0.5, h * 0.92, w * 0.2, h * 0.96); g.lineTo(0, h * 0.82); g.closePath();
    g.save(); g.clip();
    g.fillStyle = '#7c4527'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#4a2a1a'; g.fillRect(0, h * 0.6, w, h * 0.4);                                   // darker secondaries
    g.fillStyle = '#e2ddd2'; g.beginPath(); g.ellipse(w * 0.6, h * 0.36, w * 0.09, h * 0.2, 0.2, 0, TAU); g.fill();   // the pale window
    g.fillStyle = '#16120f'; g.fillRect(w * 0.68, 0, w * 0.32, h);                                 // black hand
    g.strokeStyle = 'rgba(40,20,10,0.5)'; g.lineWidth = 1.2;
    for (let i = 0; i < 24; i++) { const x = (i / 24) * w * 0.66; g.beginPath(); g.moveTo(x, h * 0.25); g.lineTo(x + 6, h * 0.95); g.stroke(); }
    g.restore();
  });
}
function kiteTail() {
  return canvasTex(128, 128, (g, w, h) => {
    g.beginPath(); g.moveTo(w * 0.38, 0); g.lineTo(w * 0.62, 0); g.lineTo(w * 0.88, h * 0.98); g.lineTo(w * 0.5, h * 0.72); g.lineTo(w * 0.12, h * 0.98); g.closePath();
    g.fillStyle = '#b5552a'; g.fill(); g.strokeStyle = '#5c2a14'; g.lineWidth = 3; g.stroke();
  });
}
function swallowWing() {
  return canvasTex(128, 32, (g, w, h) => {
    g.beginPath(); g.moveTo(0, h * 0.25); g.quadraticCurveTo(w * 0.55, h * 0.05, w, h * 0.55); g.quadraticCurveTo(w * 0.5, h * 0.6, 0, h * 0.95); g.closePath();
    g.fillStyle = '#141a2a'; g.fill();
  });
}
function swallowTail() {
  return canvasTex(64, 64, (g, w, h) => {
    g.beginPath(); g.moveTo(w * 0.4, 0); g.lineTo(w * 0.6, 0); g.lineTo(w * 0.78, h * 0.99); g.lineTo(w * 0.52, h * 0.42); g.lineTo(w * 0.48, h * 0.42); g.lineTo(w * 0.22, h * 0.99); g.closePath();
    g.fillStyle = '#141a2a'; g.fill();
  });
}
function heronWing() {          // broad and rounded: grey above, black flight feathers
  return canvasTex(256, 128, (g, w, h) => {
    g.beginPath(); g.moveTo(0, h * 0.12); g.quadraticCurveTo(w * 0.6, h * 0.0, w * 0.86, h * 0.14);
    for (let i = 0; i < 6; i++) { const y = mix(0.18, 0.78, i / 6); g.quadraticCurveTo(w * 1.0, h * (y + 0.04), w * 0.9, h * (y + 0.1)); }
    g.quadraticCurveTo(w * 0.5, h * 1.0, 0, h * 0.92); g.closePath();
    g.save(); g.clip();
    g.fillStyle = '#7e848c'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#25272c'; g.fillRect(0, h * 0.55, w, h); g.fillRect(w * 0.62, 0, w, h);
    g.fillStyle = '#9aa0a8'; g.fillRect(0, 0, w * 0.5, h * 0.18);
    g.strokeStyle = 'rgba(10,10,12,0.5)'; g.lineWidth = 1;
    for (let i = 0; i < 30; i++) { const x = (i / 30) * w; g.beginPath(); g.moveTo(x, h * 0.55); g.lineTo(x + 4, h); g.stroke(); }
    g.restore();
  });
}
function dragonflyWing() {      // a clear membrane: fine veins, an amber flush at the root, a dark spot near the tip
  return canvasTex(128, 32, (g, w, h) => {
    g.beginPath(); g.moveTo(0, h * 0.35); g.quadraticCurveTo(w * 0.5, h * 0.08, w * 0.98, h * 0.45); g.quadraticCurveTo(w * 0.5, h * 0.9, 0, h * 0.65); g.closePath();
    g.save(); g.clip();
    g.fillStyle = 'rgba(225,238,248,0.38)'; g.fillRect(0, 0, w, h);
    const gr = g.createLinearGradient(0, 0, w * 0.3, 0); gr.addColorStop(0, 'rgba(200,140,50,0.45)'); gr.addColorStop(1, 'rgba(200,140,50,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(30,34,40,0.75)'; g.lineWidth = 0.9;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(0, h * (0.4 + i * 0.07)); g.lineTo(w, h * (0.42 + i * 0.03)); g.stroke(); }
    for (let i = 0; i < 26; i++) { const x = (i / 26) * w; g.beginPath(); g.moveTo(x, h * 0.2); g.lineTo(x + 2, h * 0.8); g.stroke(); }
    g.fillStyle = 'rgba(30,25,20,0.85)'; g.fillRect(w * 0.8, h * 0.38, w * 0.07, h * 0.1);
    g.restore();
  });
}

// A flat wing card hinged at its root. side +1 = right, -1 = left. Forward is +z.
function wingCard(map, len, chord, side, opts = {}) {
  const g = new THREE.PlaneGeometry(len, chord); g.rotateX(Math.PI / 2); g.translate(len / 2, 0, opts.offsetZ ?? 0);
  if (side < 0) { g.scale(-1, 1, 1); }
  const mat = new THREE.MeshStandardMaterial({ map, alphaTest: opts.transparent ? 0 : 0.45, transparent: !!opts.transparent, depthWrite: !opts.transparent,
    side: THREE.DoubleSide, roughness: opts.roughness ?? 0.85, metalness: 0, opacity: 1 });
  const m = new THREE.Mesh(g, mat);
  return m;
}
const ellipsoid = (rx, ry, rz, mat, segs = 12) => { const g = new THREE.SphereGeometry(1, segs, Math.max(6, segs * 0.6)); g.scale(rx, ry, rz); return new THREE.Mesh(g, mat); };

export default function createWildlife(scene) {
  const r = rng(818);
  const t0 = () => U.uTime.value;
  const all = [];

  // ---------- rings on the water (fish rising, the heron's footsteps and strikes) ----------
  const ringGeo = new THREE.RingGeometry(0.9, 1.0, 40); ringGeo.rotateX(-Math.PI / 2);
  const rings = [];
  for (let i = 0; i < 18; i++) {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xe8eef0, transparent: true, opacity: 0, depthWrite: false }));
    m.visible = false; m.renderOrder = 3; scene.add(m); rings.push({ m, born: -9, size: 1, life: 1 });
  }
  function ripple(x, z, size = 0.5, count = 2, life = 1.6) {
    for (let k = 0; k < count; k++) {
      const ring = rings.reduce((a, b) => (a.born < b.born ? a : b));
      Object.assign(ring, { born: t0() + k * 0.22, size: size * (1 + k * 0.3), life, x, z });
    }
  }
  function updateRings() {
    const t = t0();
    for (const g of rings) {
      const a = (t - g.born) / g.life;
      g.m.visible = a > 0 && a < 1;
      if (!g.m.visible) continue;
      const s = 0.04 + g.size * Math.sqrt(a);
      g.m.position.set(g.x, WATER + 0.012, g.z); g.m.scale.set(s, 1, s);
      g.m.material.opacity = 0.42 * (1 - a) * (1 - a);
    }
  }

  // ================= GREY HERON =================
  const heron = (() => {
    const home = { x: -30.2, z: 0 };
    home.z = W.creekZ(home.x) + W.creekHalfWidth(home.x) * 0.58;
    const grey = new THREE.MeshStandardMaterial({ color: 0x6f757d, roughness: 0.9 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x4c5158, roughness: 0.9 });
    const pale = new THREE.MeshStandardMaterial({ color: 0xb9bcbd, roughness: 0.85 });
    const black = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.7 });
    const leg = new THREE.MeshStandardMaterial({ color: 0x8e7a4e, roughness: 0.7 });
    const billMat = new THREE.MeshStandardMaterial({ color: 0xd6a03a, roughness: 0.45 });

    const root = new THREE.Group(); scene.add(root);
    const stand = new THREE.Group(); root.add(stand);
    // body: a long grey teardrop held at a slant, darker folded flight feathers along the back
    const body = ellipsoid(0.085, 0.1, 0.29, grey, 18); body.position.set(0, 0.62, -0.03); body.rotation.x = -0.5; stand.add(body);
    for (const s of [-1, 1]) {                                                       // folded wings, black primaries at the tail end
      const wing = ellipsoid(0.03, 0.085, 0.26, grey, 14); wing.position.set(s * 0.065, 0.63, -0.05); wing.rotation.set(-0.5, s * 0.05, 0); stand.add(wing);
      const prim = ellipsoid(0.022, 0.04, 0.12, new THREE.MeshStandardMaterial({ color: 0x1d1f23, roughness: 0.8 }), 10); prim.position.set(s * 0.05, 0.5, -0.24); prim.rotation.x = -0.75; stand.add(prim);
      const patch = ellipsoid(0.02, 0.03, 0.035, black, 8); patch.position.set(s * 0.07, 0.71, 0.1); stand.add(patch);   // black shoulder patch
    }
    const back = ellipsoid(0.06, 0.04, 0.22, dark, 14); back.position.set(0, 0.69, -0.08); back.rotation.x = -0.5; stand.add(back);
    for (let i = 0; i < 7; i++) {                                                    // long pale plumes trailing over the back
      const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.001, 0.2, 4), pale); pl.position.set((i - 3) * 0.012, 0.62, -0.2); pl.rotation.x = Math.PI / 2 + 0.8 + (i % 2) * 0.1; stand.add(pl);
    }
    const plumes = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.2, 8, 1, true), pale); plumes.position.set(0, 0.66, 0.16); plumes.rotation.x = Math.PI - 0.2; stand.add(plumes);
    // legs: long and thin, the joint that looks like a backward knee is really the ankle
    const legs = [];
    for (const s of [-1, 1]) {
      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.01, 0.22, 6), leg); const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.008, 0.3, 6), leg);
      const toes = new THREE.Group();
      for (const a of [-0.45, 0, 0.45, Math.PI]) { const toe = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.003, a === Math.PI ? 0.05 : 0.09, 4), leg); toe.rotation.set(Math.PI / 2, 0, 0); toe.position.set(Math.sin(a) * 0.04, 0, Math.cos(a) * 0.04); toe.rotation.y = a; toes.add(toe); }
      stand.add(thigh, shin, toes); legs.push({ s, thigh, shin, toes, lift: 0 });
    }
    // neck, rebuilt each frame from a curve so it can coil, stretch and strike
    const neckMesh = new THREE.Mesh(new THREE.BufferGeometry(), pale); stand.add(neckMesh);
    const stripe = new THREE.Mesh(new THREE.BufferGeometry(), black); stand.add(stripe);
    const head = new THREE.Group(); stand.add(head);
    const skull = ellipsoid(0.022, 0.024, 0.042, new THREE.MeshStandardMaterial({ color: 0xe8e8e4, roughness: 0.8 }), 12); head.add(skull);
    const cap = ellipsoid(0.023, 0.011, 0.04, black, 10); cap.position.set(0, 0.013, -0.01); head.add(cap);
    for (const s of [-1, 1]) { const crest = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.0015, 0.13, 4), black); crest.rotation.x = Math.PI / 2 + 0.35; crest.position.set(s * 0.004, 0.008, -0.08); head.add(crest);
      const eye = ellipsoid(0.005, 0.005, 0.005, billMat, 6); eye.position.set(s * 0.018, 0.006, 0.018); head.add(eye); }
    const bill = new THREE.Mesh(new THREE.ConeGeometry(0.011, 0.13, 8), billMat); bill.rotation.x = Math.PI / 2; bill.position.set(0, -0.004, 0.1); bill.scale.set(1, 1, 0.75); head.add(bill);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.32, 20), new THREE.MeshBasicMaterial({ color: 0x0a0a08, transparent: true, opacity: 0.32, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; scene.add(shadow);

    // in flight: the same bird, neck folded back, legs trailing, broad slow wings
    const fly = new THREE.Group(); root.add(fly); fly.visible = false;
    const fBody = ellipsoid(0.1, 0.11, 0.28, grey, 14); fly.add(fBody);
    const fNeck = ellipsoid(0.055, 0.06, 0.09, pale, 10); fNeck.position.set(0, 0.03, 0.22); fly.add(fNeck);
    const fHead = head.clone(); fHead.position.set(0, 0.06, 0.29); fly.add(fHead);
    for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.006, 0.5, 5), leg); l.rotation.x = Math.PI / 2 - 0.1; l.position.set(s * 0.03, -0.04, -0.47); fly.add(l); }
    const hw = heronWing(), fWings = [];
    for (const s of [-1, 1]) { const wg = wingCard(hw, 0.88, 0.52, s, { offsetZ: -0.06 }); wg.position.set(s * 0.06, 0.04, 0); fly.add(wg); fWings.push({ s, wg }); }

    // neck poses: points from the shoulder to the head, and where the bill points
    const POSES = {
      rest:  { pts: [[0, 0.74, 0.14], [0, 0.86, 0.08], [0, 0.96, 0.15], [0, 1.0, 0.22]], look: [0, -0.15, 1] },
      alert: { pts: [[0, 0.76, 0.15], [0, 0.96, 0.12], [0, 1.13, 0.16], [0, 1.22, 0.22]], look: [0, 0.0, 1] },
      watch: { pts: [[0, 0.74, 0.16], [0, 0.88, 0.24], [0, 0.86, 0.4], [0, 0.78, 0.52]], look: [0, -0.8, 0.6] },
      strike:{ pts: [[0, 0.7, 0.18], [0, 0.6, 0.4], [0, 0.38, 0.58], [0, 0.14, 0.68]], look: [0, -1, 0.15] },
    };
    const cur = { pts: POSES.rest.pts.map((p) => new THREE.Vector3(...p)), look: new THREE.Vector3(...POSES.rest.look) };
    const tmp = new THREE.Vector3();
    function buildNeck(dt, poseName, speed, headYaw) {
      const P = POSES[poseName], k = 1 - Math.exp(-dt * speed);
      cur.pts.forEach((p, i) => p.lerp(tmp.set(...P.pts[i]), k));
      cur.look.lerp(tmp.set(...P.look), k).normalize();
      const curve = new THREE.CatmullRomCurve3(cur.pts);
      neckMesh.geometry.dispose(); neckMesh.geometry = new THREE.TubeGeometry(curve, 16, 0.021, 8, false);
      const sp = curve.getSpacedPoints(10).slice(2, 10).map((p) => p.clone().add(tmp.set(0, -0.002, 0.016)));
      stripe.geometry.dispose(); stripe.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(sp), 8, 0.007, 4, false);
      head.position.copy(cur.pts[3]);
      const look = cur.look.clone().applyAxisAngle(tmp.set(0, 1, 0), headYaw);
      head.lookAt(head.position.clone().add(look).applyMatrix4(stand.matrixWorld));
    }

    const st = { mode: 'stand', x: home.x, z: home.z, heading: 2.8, pose: 'rest', timer: 4, act: null, walk: null, headYaw: 0, flyT: 0, away: 0, alertT: 0, seed: r() * 10 };
    function legPose(L, lift) {
      const hip = new THREE.Vector3(L.s * 0.04, 0.55, -0.02), foot = new THREE.Vector3(L.s * 0.05, lift * 0.12, lift * 0.06);
      const knee = new THREE.Vector3(L.s * 0.045, 0.3 + lift * 0.1, -0.06 - lift * 0.06);
      const place = (m, a, b) => { m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tmp.subVectors(b, a).normalize()); m.scale.y = a.distanceTo(b) / (m === L.thigh ? 0.22 : 0.3); };
      place(L.thigh, hip, knee); place(L.shin, knee, foot); L.toes.position.copy(foot); L.toes.rotation.x = -lift * 0.8;
    }

    st.root = root;
    return {
      st,
      update(dt, player) {
        const t = t0(), dPlayer = Math.hypot(player.x - st.x, player.z - st.z);
        if (st.mode === 'stand') {
          root.visible = true; fly.visible = false; stand.visible = true;
          const ground = W.terrainHeight(st.x, st.z);
          root.position.set(st.x, ground, st.z);
          // wary of people: watch you from 12 m, leave at 9.5 m (or if you linger close for too long)
          if (dPlayer < 12) { st.alertT += dt; st.pose = 'alert'; st.act = null; st.headYaw = clamp(wrap(Math.atan2(player.x - st.x, player.z - st.z) - st.heading), -1.3, 1.3); }
          else { st.alertT = Math.max(0, st.alertT - dt * 0.5); if (st.pose === 'alert') { st.pose = 'rest'; st.headYaw = 0; } }
          if (dPlayer < 9.5 || (dPlayer < 10.5 && st.alertT > 6)) { st.mode = 'takeoff'; st.flyT = 0; ripple(st.x, st.z, 0.6, 3, 1.4); }
          st.timer -= dt;
          if (st.pose !== 'alert' && !st.act && st.timer <= 0) {
            const roll = r();
            if (roll < 0.45) st.act = { kind: 'watch', t: 0, len: 4 + r() * 6, strike: r() < 0.6 };
            else if (roll < 0.8) {                                                   // a slow step or two through the shallows
              const a = st.heading + (r() - 0.5) * 1.6, d = 0.35 + r() * 0.3;
              let nx = st.x + Math.sin(a) * d, nz = st.z + Math.cos(a) * d;
              const dz = (nz - W.creekZ(nx)) / W.creekHalfWidth(nx);
              if (Math.abs(dz) > 0.85 || Math.abs(dz) < 0.3 || Math.hypot(nx - home.x, nz - home.z) > 2.5) { nx = st.x; nz = st.z; }
              st.act = { kind: 'step', t: 0, from: [st.x, st.z], to: [nx, nz], turn: a };
            } else st.act = { kind: 'preen', t: 0, len: 2 + r() * 2 };
            st.timer = 5 + r() * 10;
          }
          if (st.act) {
            const a = st.act; a.t += dt;
            if (a.kind === 'watch') {
              const striking = a.strike && a.t > a.len - 1.2 && a.t < a.len - 0.6;
              st.pose = striking ? 'strike' : 'watch';
              if (a.strike && !a.splashed && a.t > a.len - 1.05) { a.splashed = true; ripple(st.x + Math.sin(st.heading) * 0.55, st.z + Math.cos(st.heading) * 0.55, 0.35, 3, 1.3); }
              if (a.t > a.len) { st.act = null; st.pose = 'rest'; }
            } else if (a.kind === 'step') {
              const k = clamp(a.t / 1.6, 0, 1);
              st.heading += wrap(a.turn - st.heading) * Math.min(1, dt * 2);
              st.x = mix(a.from[0], a.to[0], W.smoothstep(0, 1, k)); st.z = mix(a.from[1], a.to[1], W.smoothstep(0, 1, k));
              legs[0].lift = Math.max(0, Math.sin(clamp(k * 2, 0, 1) * Math.PI)); legs[1].lift = Math.max(0, Math.sin(clamp(k * 2 - 1, 0, 1) * Math.PI));
              if (k > 0.25 && !a.r1) { a.r1 = true; ripple(st.x, st.z, 0.2, 1, 1.1); }
              if (k >= 1) { st.act = null; legs[0].lift = legs[1].lift = 0; ripple(st.x, st.z, 0.2, 1, 1.1); }
            } else if (a.kind === 'preen') {
              st.headYaw = Math.sin(a.t * 3) * 0.9; st.pose = 'rest';
              if (a.t > a.len) { st.act = null; st.headYaw = 0; }
            }
          }
          stand.rotation.y = st.heading;
          stand.position.y = Math.sin(t * 1.3 + st.seed) * 0.003;                  // breathing
          legs.forEach((L) => legPose(L, L.lift));
          stand.updateMatrixWorld(true);
          buildNeck(dt, st.pose, st.pose === 'strike' ? 22 : st.pose === 'alert' ? 4 : 2.5, st.headYaw);
          shadow.visible = true; shadow.position.set(st.x - 0.25, WATER + 0.008, st.z - 0.2);
        } else if (st.mode === 'takeoff' || st.mode === 'fly' || st.mode === 'return') {
          stand.visible = false; fly.visible = true; shadow.visible = false;
          st.flyT += dt;
          const away = st.mode !== 'return';
          const u = st.mode === 'return' ? 1 - clamp(st.flyT / 14, 0, 1) : clamp(st.flyT / 14, 0, 1);  // 0 at home, 1 far downstream
          const x = mix(home.x, -110, u), z = W.creekZ(x) + mix(home.z - W.creekZ(home.x), 0, u);
          const climb = Math.sin(clamp(u * 2.2, 0, 1) * Math.PI / 2);
          const y = W.terrainHeight(home.x, home.z) + 0.6 + climb * 7 + Math.sin(st.flyT * 0.7) * 0.2;
          root.position.set(x, y, z);
          fly.rotation.set(-0.08 * climb * (away ? 1 : -1), away ? -Math.PI / 2 : Math.PI / 2, 0);   // flying downstream, or back up it
          const beat = st.flyT * 2.3 * TAU, amp = u < 0.08 && away ? 1.25 : 0.95;
          fWings.forEach(({ s, wg }) => { wg.rotation.z = s * (Math.sin(beat) * 0.55 * amp - 0.12); });   // deep, slow beats on bowed wings
          if (away && u >= 1) { st.mode = 'gone'; st.away = 45 + r() * 35; root.visible = false; }
          if (!away && st.flyT > 14) { st.mode = 'stand'; st.x = home.x; st.z = home.z; st.heading = 2.8; st.pose = 'alert'; st.alertT = 0; st.timer = 6; ripple(home.x, home.z, 0.6, 3, 1.4); }
        } else if (st.mode === 'gone') {
          st.away -= dt;
          if (st.away <= 0 && Math.hypot(player.x - home.x, player.z - home.z) > 18) { st.mode = 'return'; st.flyT = 0; root.visible = true; }
        }
      },
    };
  })();
  all.push(heron);

  // ================= RED KITES =================
  const kites = (() => {
    const wingTex = kiteWing(), tailTex = kiteTail();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x5c3420, roughness: 0.95 }), headMat = new THREE.MeshStandardMaterial({ color: 0xc9c1b2, roughness: 0.9 });
    const list = [];
    for (let i = 0; i < 2; i++) {
      const g = new THREE.Group(); scene.add(g);
      g.add(ellipsoid(0.07, 0.07, 0.26, bodyMat, 12));
      const hd = ellipsoid(0.05, 0.05, 0.06, headMat, 10); hd.position.z = 0.26; g.add(hd);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.05, 6), new THREE.MeshStandardMaterial({ color: 0xd8b04a })); beak.rotation.x = Math.PI / 2; beak.position.set(0, -0.01, 0.32); g.add(beak);
      const wings = [];
      for (const s of [-1, 1]) { const wg = wingCard(wingTex, 0.78, 0.38, s, { offsetZ: 0.02 }); wg.position.x = s * 0.05; g.add(wg); wings.push({ s, wg }); }
      const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.34).rotateX(Math.PI / 2).translate(0, 0, -0.17), new THREE.MeshStandardMaterial({ map: tailTex, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9 }));
      tail.position.z = -0.2; g.add(tail);
      list.push({ g, wings, tail, ang: r() * TAU, cx: (r() - 0.5) * 20, cz: 30 + r() * 30, R: 30 + i * 9, alt: 34 + i * 10, dir: i ? -1 : 1, flapT: -1, nextFlap: 6 + r() * 12, seed: r() * 10 });
    }
    return list;
  })();
  all.push({ update(dt) {
    const t = t0();
    for (const k of kites) {
      const v = 8.5, R = k.R + Math.sin(t * 0.05 + k.seed) * 8;
      k.ang += k.dir * (v / R) * dt;
      const cx = k.cx + Math.sin(t * 0.02 + k.seed) * 25, cz = k.cz + Math.cos(t * 0.017 + k.seed) * 18;
      const x = cx + Math.cos(k.ang) * R, z = cz + Math.sin(k.ang) * R, y = W.terrainHeight(0, 30) + k.alt + Math.sin(t * 0.13 + k.seed) * 6;
      const heading = Math.atan2(-Math.sin(k.ang) * k.dir, Math.cos(k.ang) * k.dir);
      k.g.position.set(x, y, z);
      k.g.rotation.set(0, heading, 0); k.g.rotateZ(-k.dir * 0.32);                          // banked into the turn
      k.tail.rotation.y = -k.dir * 0.25 + Math.sin(t * 0.9 + k.seed) * 0.12;              // steering with the tail
      k.nextFlap -= dt; if (k.nextFlap <= 0) { k.flapT = 0; k.nextFlap = 10 + r() * 20; }
      let flap = 0;
      if (k.flapT >= 0) { k.flapT += dt; flap = Math.sin(k.flapT * 2.6 * TAU) * 0.5 * Math.sin(clamp(k.flapT / 1.8, 0, 1) * Math.PI); if (k.flapT > 1.8) k.flapT = -1; }
      for (const { s, wg } of k.wings) { wg.rotation.z = s * (0.1 + flap); wg.rotation.y = s * -0.1; }
    }
  } });

  // ================= SWALLOWS =================
  const swallows = (() => {
    const wTex = swallowWing(), tTex = swallowTail();
    const back = new THREE.MeshStandardMaterial({ color: 0x18213a, roughness: 0.55, metalness: 0.15 }), belly = new THREE.MeshStandardMaterial({ color: 0xe2d7c2, roughness: 0.85 });
    const throat = new THREE.MeshStandardMaterial({ color: 0x6a2616, roughness: 0.85 });
    const list = [];
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group(); scene.add(g);
      const b = ellipsoid(0.016, 0.015, 0.075, back, 10); g.add(b);
      const bl = ellipsoid(0.014, 0.012, 0.06, belly, 10); bl.position.set(0, -0.006, -0.005); g.add(bl);
      const th = ellipsoid(0.008, 0.007, 0.01, throat, 8); th.position.set(0, -0.006, 0.058); g.add(th);
      const wings = [];
      for (const s of [-1, 1]) { const wg = wingCard(wTex, 0.19, 0.055, s, { roughness: 0.95 }); wg.position.x = s * 0.01; g.add(wg); wings.push({ s, wg }); }
      const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.1).rotateX(Math.PI / 2).translate(0, 0, -0.05), new THREE.MeshStandardMaterial({ map: tTex, alphaTest: 0.4, side: THREE.DoubleSide })); tail.position.z = -0.05; g.add(tail);
      const f = [0.09 + r() * 0.05, 0.13 + r() * 0.05, 0.21 + r() * 0.06, 0.31 + r() * 0.08, 0.17 + r() * 0.05];
      list.push({ g, wings, f, ph: Array.from({ length: 6 }, () => r() * TAU), prev: new THREE.Vector3(), bank: 0, flapUntil: 0, nextFlap: 0 });
    }
    return list;
  })();
  const swPos = (s, t, out) => {
    const [a, b, c, d, e] = s.f, p = s.ph;
    let x = 15 * Math.sin(t * a + p[0]) + 5 * Math.sin(t * c + p[2]);
    let z = 26 + 26 * Math.sin(t * b + p[1]) + 4 * Math.sin(t * d + p[3]);
    let y = 3.4 + 2.6 * Math.sin(t * e + p[4]) + 1.2 * Math.sin(t * d * 1.3 + p[5]);
    const ground = W.terrainHeight(x, z);
    y = ground + Math.max(0.6, y);
    for (const h of [...W.HOUSES, W.WORKSHOP]) {                                     // lift over the roofs
      const dd = Math.hypot(x - h.x, z - h.z);
      if (dd < h.r + 3) y = Math.max(y, W.terrainHeight(h.x, h.z) + h.peak * (1 - Math.max(0, dd - h.r) / 3) + 1.2);
    }
    return out.set(x, y, z);
  };
  const _v = new THREE.Vector3(), _n = new THREE.Vector3();
  all.push({ update(dt) {
    const t = t0();
    for (const s of swallows) {
      swPos(s, t, _v); swPos(s, t + 0.05, _n);
      s.g.position.copy(_v); s.g.lookAt(_n);
      const turn = wrap(Math.atan2(_n.x - _v.x, _n.z - _v.z) - Math.atan2(_v.x - s.prev.x, _v.z - s.prev.z));
      s.bank += (clamp(-turn * 18, -1.2, 1.2) - s.bank) * Math.min(1, dt * 6);
      s.g.rotateZ(s.bank); s.prev.copy(_v);
      if (t > s.nextFlap) { s.flapUntil = t + 0.4 + r() * 0.6; s.nextFlap = s.flapUntil + 0.3 + r() * 1.2; }
      const flapping = t < s.flapUntil;
      for (const { s: side, wg } of s.wings) {
        wg.rotation.z = side * (flapping ? Math.sin(t * 13 * TAU) * 0.7 : -0.05);
        wg.rotation.y = side * (flapping ? 0.1 : 0.55);                                // swept back when gliding
      }
    }
  } });

  // ================= BUTTERFLIES =================
  const butterflies = (() => {
    const kinds = ['tortoiseshell', 'tortoiseshell', 'brimstone', 'peacock', 'blue', 'tortoiseshell', 'brimstone', 'blue'];
    const tex = {}; for (const k of new Set(kinds)) tex[k] = canvasTex(128, 128, BUTTERFLIES[k]);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1d1814, roughness: 0.8 });
    const flowers = FLOWERS.filter(([x, , z]) => z > 3 && z < 56 && Math.abs(x) < 19);
    const list = [];
    kinds.forEach((k, i) => {
      const size = k === 'blue' ? 0.03 : k === 'peacock' ? 0.05 : 0.045;               // half-wingspan, metres
      const g = new THREE.Group(); g.rotation.order = 'YXZ'; scene.add(g);
      const body = ellipsoid(0.004, 0.004, size * 0.45, bodyMat, 6); g.add(body);
      for (const s of [-1, 1]) { const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.0006, 0.0006, size * 0.5, 3), bodyMat); ant.rotation.x = Math.PI / 2 - 0.5; ant.rotation.z = s * 0.3; ant.position.set(s * 0.002, size * 0.1, size * 0.55); g.add(ant); }
      const wings = [];
      for (const s of [-1, 1]) { const wg = wingCard(tex[k], size, size * 1.15, s, { roughness: 0.7 }); g.add(wg); wings.push({ s, wg }); }
      const f = flowers[Math.floor(r() * flowers.length)] || [0, 1, 20];
      list.push({ g, wings, size, pos: new THREE.Vector3(f[0], f[1], f[2]), vel: new THREE.Vector3(), mode: 'perch', perch: f, timer: r() * 6, target: null, phase: r() * TAU, open: 0, heading: r() * TAU });
    });
    return { list, flowers };
  })();
  function pickFlower(b, near = 6) {
    const opts = butterflies.flowers.filter(([x, , z]) => Math.hypot(x - b.pos.x, z - b.pos.z) < near && Math.hypot(x - b.pos.x, z - b.pos.z) > 0.6);
    return opts.length ? opts[Math.floor(r() * opts.length)] : butterflies.flowers[Math.floor(r() * butterflies.flowers.length)];
  }
  all.push({ update(dt, player, camPos) {
    const t = t0();
    for (const b of butterflies.list) {
      const dP = Math.hypot(camPos.x - b.pos.x, camPos.y - b.pos.y, camPos.z - b.pos.z);
      if (b.mode === 'perch') {
        b.timer -= dt;
        b.pos.set(b.perch[0], b.perch[1], b.perch[2]);
        // resting: wings held closed above the back, now and then opened flat to bask
        const bask = Math.sin(t * 0.7 + b.phase) > 0.55;
        const target = bask ? 0.08 : 1.42 + Math.sin(t * 2.3 + b.phase) * 0.05;
        b.open += (target - b.open) * Math.min(1, dt * 3);
        if (b.timer <= 0 || dP < 1.4) {
          b.mode = 'fly'; b.target = dP < 1.4 ? null : pickFlower(b); b.timer = 3 + r() * 6;
          b.vel.set((b.pos.x - camPos.x), 1.5, (b.pos.z - camPos.z)).setLength(1.6);
        }
      } else {
        b.timer -= dt;
        const goal = b.target ? _v.set(b.target[0], b.target[1] + 0.15, b.target[2]) : _v.set(b.pos.x + Math.sin(t * 0.3 + b.phase) * 3, W.terrainHeight(b.pos.x, b.pos.z) + 1.0, b.pos.z + Math.cos(t * 0.27 + b.phase) * 3);
        const to = _n.subVectors(goal, b.pos), dist = to.length();
        // erratic, bobbing flight: steer toward the goal, jink sideways, lift on each downstroke
        const steer = to.normalize().multiplyScalar(2.2);
        steer.x += Math.sin(t * 5.3 + b.phase * 3) * 1.6; steer.z += Math.cos(t * 4.7 + b.phase * 2) * 1.6; steer.y += Math.sin(t * 9 + b.phase) * 1.4;
        b.vel.lerp(steer, Math.min(1, dt * 2.2));
        if (dist < 0.5 && b.target) b.vel.multiplyScalar(0.92);
        b.pos.addScaledVector(b.vel, dt);
        const ground = W.terrainHeight(b.pos.x, b.pos.z);
        b.pos.y = clamp(b.pos.y, ground + 0.25, ground + 2.5);
        b.open = 0.7 + Math.sin(t * 9.5 * TAU + b.phase) * 0.78;
        if (b.target && dist < 0.12) { b.mode = 'perch'; b.perch = b.target; b.timer = 4 + r() * 10; }
        if (!b.target && b.timer <= 0) b.target = pickFlower(b, 8);
      }
      const h = b.mode === 'perch' ? b.heading : Math.atan2(b.vel.x, b.vel.z);
      if (b.mode !== 'perch') b.heading = h;
      b.g.position.copy(b.pos);
      b.g.rotation.set(b.mode === 'perch' ? -0.15 : -0.35, h, 0);
      for (const { s, wg } of b.wings) wg.rotation.z = s * b.open;
    }
  } });

  // ================= DRAGONFLIES =================
  const dragonflies = (() => {
    const wTex = dragonflyWing();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3a8fd0, roughness: 0.35, metalness: 0.5 }), eyeMat = new THREE.MeshStandardMaterial({ color: 0x15403a, roughness: 0.15, metalness: 0.3 });
    const thoraxMat = new THREE.MeshStandardMaterial({ color: 0x1f3f52, roughness: 0.3, metalness: 0.6 }), ringMat = new THREE.MeshStandardMaterial({ color: 0x0d1418, roughness: 0.6 });
    const reeds = REEDS.filter(([x]) => Math.abs(x) < 26);
    const list = [];
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group(); g.rotation.order = 'YXZ'; scene.add(g);
      const thorax = ellipsoid(0.0055, 0.0065, 0.011, thoraxMat, 10); g.add(thorax);
      for (let k = 0; k < 9; k++) {                                                 // a long abdomen in segments, each with a dark ring
        const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.0024 - k * 0.0001, 0.0021 - k * 0.0001, 0.0062, 6), bodyMat);
        seg.rotation.x = Math.PI / 2; seg.position.z = -0.014 - k * 0.0064; g.add(seg);
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.0025 - k * 0.0001, 0.0025 - k * 0.0001, 0.0012, 6), ringMat); ring.rotation.x = Math.PI / 2; ring.position.z = -0.0175 - k * 0.0064; g.add(ring);
      }
      for (const s of [-1, 1]) { const e = ellipsoid(0.0042, 0.0042, 0.0042, eyeMat, 8); e.position.set(s * 0.0034, 0.0022, 0.0105); g.add(e); }
      const wings = [];
      for (const [s, z] of [[-1, 0.006], [1, 0.006], [-1, -0.006], [1, -0.006]]) { const wg = wingCard(wTex, 0.042, 0.011, s, { transparent: true, roughness: 0.2 }); wg.position.set(0, 0.004, z); g.add(wg); wings.push({ s, wg }); }
      const x = -12 + i * 10 + r() * 4;
      list.push({ g, wings, pos: new THREE.Vector3(x, WATER + 0.5, W.creekZ(x)), target: new THREE.Vector3(), mode: 'hover', timer: r(), heading: r() * TAU, reeds });
    }
    return list;
  })();
  function dfTarget(d, camPos) {
    for (let k = 0; k < 12; k++) {
      const x = clamp(d.pos.x + (r() - 0.5) * 5, -19, 19), z = W.creekZ(x) + (r() - 0.5) * W.creekHalfWidth(x) * 1.5;
      if (Math.hypot(x - camPos.x, z - camPos.z) < 1.2) continue;
      return d.target.set(x, WATER + 0.25 + r() * 0.8, z);
    }
    return d.target.copy(d.pos);
  }
  all.push({ update(dt, player, camPos) {
    const t = t0();
    for (const d of dragonflies) {
      d.timer -= dt;
      const dP = Math.hypot(camPos.x - d.pos.x, camPos.z - d.pos.z);
      if (d.mode === 'hover' || d.mode === 'perch') {
        if (d.mode === 'hover') d.pos.y += Math.sin(t * 7 + d.heading) * 0.0015;
        if (d.timer <= 0 || dP < 1.0) {
          const nearReeds = d.reeds.filter(([x, , z]) => Math.hypot(x - d.pos.x, z - d.pos.z) < 3.5);
          if (d.mode === 'hover' && dP >= 1.0 && nearReeds.length && r() < 0.3) { const rd = nearReeds[Math.floor(r() * nearReeds.length)]; d.target.set(rd[0], rd[1], rd[2]); d.perchNext = true; }
          else { dfTarget(d, camPos); d.perchNext = false; }
          d.mode = 'dart'; d.from = d.pos.clone(); d.dartT = 0; d.dartLen = 0.15 + d.from.distanceTo(d.target) / 8;
        }
      } else {
        d.dartT += dt;
        const k = clamp(d.dartT / d.dartLen, 0, 1), e = 1 - Math.pow(1 - k, 3);
        d.pos.lerpVectors(d.from, d.target, e);
        d.heading += wrap(Math.atan2(d.target.x - d.from.x, d.target.z - d.from.z) - d.heading) * Math.min(1, dt * 20);
        if (k >= 1) { d.mode = d.perchNext ? 'perch' : 'hover'; d.timer = d.perchNext ? 3 + r() * 6 : 0.5 + r() * 2.2; if (!d.perchNext) d.heading += (r() - 0.5) * 2; }
      }
      d.g.position.copy(d.pos); d.g.rotation.set(d.mode === 'perch' ? 0.25 : -0.05, d.heading, 0);
      const flying = d.mode !== 'perch';
      d.wings.forEach(({ s, wg }, i) => {
        wg.rotation.z = flying ? s * Math.sin(t * 31 * TAU + i * 1.7) * 0.5 : s * 0.02;
        wg.rotation.y = s * (i < 2 ? 0.12 : -0.12);
        wg.material.opacity = flying ? 0.7 : 1;
      });
    }
  } });

  // ================= FISH RISING =================
  let nextRise = 3;
  all.push({ update(dt) {
    nextRise -= dt;
    if (nextRise > 0) return;
    nextRise = 5 + r() * 9;
    for (let k = 0; k < 20; k++) {
      const x = -24 + r() * 48, z = W.creekZ(x) + (r() - 0.5) * W.creekHalfWidth(x);
      if (W.terrainHeight(x, z) > WATER - 0.22) continue;                          // only where it's deep enough
      ripple(x, z, 0.45 + r() * 0.25, 2 + (r() < 0.4 ? 1 : 0), 2.2);
      break;
    }
  } });

  window.forgedWildlife = { heron: heron.st, kites, swallows, butterflies: butterflies.list, dragonflies };
  const camPos = new THREE.Vector3();
  return (dt, camera, player) => {
    camPos.copy(camera.position);
    for (const a of all) a.update(dt, player, camPos);
    updateRings();
  };
}
