// The goods on the trading tables, made to be looked at closely.
// Each one has its own geometry and its own painted texture with surface relief.
// Scanned props (CC0, polyhaven.com) are used for the carved bowls, the plate, the wicker
// basket and the apples; everything else is built here.
import * as THREE from 'three';
import { fbm, rng } from './noise.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { Geo, V, rockGeometry } from './forest.js';

const TAU = Math.PI * 2;

// ---------------------------------------------------------------- texture helpers
// A tileable fbm noise canvas, made once and reused for mottling and grain.
let NOISE = null;
function noiseCanvas() {
  if (NOISE) return NOISE;
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d'), img = g.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const v = fbm((x / S) * 8, (y / S) * 8, 4, 8) * 255, i = (y * S + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0); NOISE = cv;
  return cv;
}
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function toTex(cv, srgb = true, repeat = [1, 1]) {
  const t = new THREE.CanvasTexture(cv); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = 8; return t;
}
// Normal map from a grey height canvas (lighter = higher).
function normalFrom(hc, strength = 2) {
  const w = hc.width, h = hc.height, src = hc.getContext('2d').getImageData(0, 0, w, h).data;
  const [cv, g] = canvas(w, h), out = g.createImageData(w, h);
  const H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let nx = (H(x - 1, y) - H(x + 1, y)) * strength, ny = (H(x, y + 1) - H(x, y - 1)) * strength, nz = 1;
    const l = Math.hypot(nx, ny, nz); const i = (y * w + x) * 4;
    out.data[i] = (nx / l * 0.5 + 0.5) * 255; out.data[i + 1] = (ny / l * 0.5 + 0.5) * 255; out.data[i + 2] = (nz / l * 0.5 + 0.5) * 255; out.data[i + 3] = 255;
  }
  g.putImageData(out, 0, 0);
  return toTex(cv, false);
}
// Lay the noise canvas over a canvas, scaled, with a blend mode and strength.
function mottle(g, w, h, scale, mode, alpha, tint) {
  const n = noiseCanvas();
  g.save(); g.globalCompositeOperation = mode; g.globalAlpha = alpha;
  for (let y = 0; y < h; y += 256 * scale) for (let x = 0; x < w; x += 256 * scale) g.drawImage(n, x, y, 256 * scale, 256 * scale);
  if (tint) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = tint; g.fillRect(0, 0, w, h); }
  g.restore();
}
// Make a canvas wrap seamlessly left-to-right (for textures wrapped round a lathe):
// fade a mirrored copy of its left edge in over the right edge, so the last column meets the first.
function wrapSeam(cv, band = 48) {
  const w = cv.width, h = cv.height, g = cv.getContext('2d'), [tc, tg] = canvas(band, h);
  tg.save(); tg.translate(band, 0); tg.scale(-1, 1); tg.drawImage(cv, 0, 0, band, h, 0, 0, band, h); tg.restore();
  tg.globalCompositeOperation = 'destination-in';
  const m = tg.createLinearGradient(0, 0, band, 0); m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(1, 'rgba(0,0,0,1)');
  tg.fillStyle = m; tg.fillRect(0, 0, band, h);
  g.drawImage(tc, w - band, 0);
}
function specks(g, w, h, n, colors, rmin, rmax, seed) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) { g.fillStyle = colors[Math.floor(r() * colors.length)]; g.beginPath(); g.arc(r() * w, r() * h, rmin + r() * (rmax - rmin), 0, TAU); g.fill(); }
}

// ---------------------------------------------------------------- material textures
export function suede(base, smoke, seed) {            // brain-tanned, smoked hide: soft nap, smoky patches, faint creases
  const S = 512, [c, g] = canvas(S, S), [hc, hg] = canvas(S, S), r = rng(seed);
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  mottle(g, S, S, 1.0, 'multiply', 0.55); mottle(g, S, S, 0.35, 'soft-light', 0.5);
  g.globalAlpha = 0.18; g.fillStyle = smoke; for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse(r() * S, r() * S, 40 + r() * 110, 25 + r() * 70, r() * 3, 0, TAU); g.fill(); } g.globalAlpha = 1;
  specks(g, S, S, 4000, ['rgba(255,240,210,0.05)', 'rgba(40,20,10,0.06)'], 0.5, 1.4, seed + 1);
  hg.fillStyle = '#808080'; hg.fillRect(0, 0, S, S); mottle(hg, S, S, 0.25, 'overlay', 0.6);
  hg.strokeStyle = 'rgba(40,40,40,0.35)'; hg.lineWidth = 1.5;
  for (let i = 0; i < 26; i++) { hg.beginPath(); let x = r() * S, y = r() * S; hg.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 60; y += (r() - 0.3) * 40; hg.lineTo(x, y); } hg.stroke(); }
  return { map: toTex(c), normalMap: normalFrom(hc, 2.2) };
}
function rollEnds() {                            // the end of a rolled hide: a tight spiral of layers
  const S = 256, [c, g] = canvas(S, S);
  g.fillStyle = '#8a6646'; g.fillRect(0, 0, S, S);
  g.strokeStyle = '#d6b48a'; g.lineWidth = 3.2; g.beginPath();
  for (let a = 0; a < TAU * 9; a += 0.05) { const rr = 6 + a * 2.05; g.lineTo(S / 2 + Math.cos(a) * rr, S / 2 + Math.sin(a) * rr); }
  g.stroke(); g.strokeStyle = 'rgba(50,30,15,0.6)'; g.lineWidth = 1; g.stroke();
  return toTex(c);
}
function crust(seed) {                           // flatbread: golden, blistered and charred, dusted with flour
  const S = 512, [c, g] = canvas(S, S), [hc, hg] = canvas(S, S), r = rng(seed);
  const grad = g.createRadialGradient(S / 2, S / 2, 20, S / 2, S / 2, S / 2); grad.addColorStop(0, '#d9a55c'); grad.addColorStop(0.8, '#c88b45'); grad.addColorStop(1, '#a06a35');
  g.fillStyle = grad; g.fillRect(0, 0, S, S); mottle(g, S, S, 0.6, 'multiply', 0.35);
  hg.fillStyle = '#707070'; hg.fillRect(0, 0, S, S);
  for (let i = 0; i < 70; i++) {                 // blisters: risen bubbles, browned on top, some charred
    const x = r() * S, y = r() * S, rad = 6 + r() * 22, burnt = r() < 0.35;
    const bg = g.createRadialGradient(x, y, 0, x, y, rad); bg.addColorStop(0, burnt ? 'rgba(40,22,10,0.9)' : 'rgba(150,85,35,0.75)'); bg.addColorStop(1, 'rgba(150,85,35,0)');
    g.fillStyle = bg; g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill();
    const hb = hg.createRadialGradient(x, y, 0, x, y, rad); hb.addColorStop(0, 'rgba(255,255,255,0.8)'); hb.addColorStop(1, 'rgba(255,255,255,0)');
    hg.fillStyle = hb; hg.beginPath(); hg.arc(x, y, rad, 0, TAU); hg.fill();
  }
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(250,245,232,${0.15 + r() * 0.35})`; g.beginPath(); g.ellipse(r() * S, r() * S, 2 + r() * 9, 1 + r() * 4, r() * 3, 0, TAU); g.fill(); }   // flour
  specks(g, S, S, 600, ['rgba(60,30,10,0.5)'], 0.6, 1.6, seed + 3);   // bran
  return { map: toTex(c), normalMap: normalFrom(hc, 4) };
}
// Pottery: coarse clay with grit, fire-clouding and a decoration band, unwrapped around a lathe.
// rows: the height (0..1 of the outer wall) of each decoration; vOuter: where the outer wall ends in v.
function pottery({ base, dark, soot = 0, deco = [], vOuter, seed, runs = 0 }) {
  const W2 = 512, H2 = 256, [c, g] = canvas(W2, H2), [hc, hg] = canvas(W2, H2), r = rng(seed);
  const yOf = (h) => H2 * (1 - h * vOuter);        // canvas row for a height on the outer wall
  g.fillStyle = base; g.fillRect(0, 0, W2, H2);
  mottle(g, W2, H2, 0.9, 'multiply', 0.45); mottle(g, W2, H2, 0.3, 'soft-light', 0.45);
  g.globalAlpha = 0.5;                             // fire-clouding: dark smudges where fuel touched the pot in the firing
  for (let i = 0; i < 7; i++) { const x = r() * W2, y = yOf(r() * 0.8), rad = 30 + r() * 70; const fg = g.createRadialGradient(x, y, 0, x, y, rad); fg.addColorStop(0, dark); fg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = fg; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
  g.globalAlpha = 1;
  if (soot) { const sg = g.createLinearGradient(0, yOf(0), 0, yOf(0.55)); sg.addColorStop(0, `rgba(12,10,9,${soot})`); sg.addColorStop(1, 'rgba(12,10,9,0)'); g.fillStyle = sg; g.fillRect(0, yOf(0.55), W2, yOf(0) - yOf(0.55)); }
  specks(g, W2, H2, 900, ['rgba(235,220,190,0.28)', 'rgba(30,25,20,0.22)', 'rgba(180,170,150,0.25)'], 0.35, 0.8, seed + 5);   // grit
  // the inside: darker and smoother
  g.fillStyle = 'rgba(20,12,8,0.55)'; g.fillRect(0, 0, W2, H2 * (1 - vOuter));
  hg.fillStyle = '#808080'; hg.fillRect(0, 0, W2, H2); mottle(hg, W2, H2, 0.2, 'overlay', 0.35);
  specks(hg, W2, H2, 1200, ['rgba(255,255,255,0.35)', 'rgba(0,0,0,0.3)'], 0.35, 0.8, seed + 9);
  wrapSeam(c, 64); wrapSeam(hc, 64);              // no seam where the lathe closes
  for (let k = 0; k < runs; k++) {                 // tar that ran over the lip: glossy black runs, each ending in a bead
    const x = 60 + k * 150 + r() * 40, len = 18 + r() * 34, top = yOf(1) - 2;
    g.fillStyle = 'rgba(10,7,5,0.95)'; g.beginPath(); g.moveTo(x - 7, top); g.quadraticCurveTo(x - 3, top + len * 0.5, x - 2, top + len); g.arc(x, top + len, 3.4, Math.PI, 0, true); g.quadraticCurveTo(x + 3, top + len * 0.5, x + 7, top); g.fill();
    g.fillRect(x - 16, top - 4, 32, 6);
  }
  const press = (draw) => { g.save(); g.fillStyle = g.strokeStyle = 'rgba(40,25,15,0.55)'; draw(g, 0); g.restore(); hg.save(); hg.fillStyle = hg.strokeStyle = 'rgba(0,0,0,0.85)'; draw(hg, 1); hg.restore(); };
  for (const d of deco) {
    const y = yOf(d.at);
    if (d.kind === 'cord') {                       // twisted cord pressed into the wet clay: rows of slanted dashes
      press((x) => { x.lineWidth = 1.8; for (let row = 0; row < d.rows; row++) for (let i = 0; i < W2; i += 5) { const yy = y + row * 6; x.beginPath(); x.moveTo(i, yy - 2); x.lineTo(i + 3.5, yy + 2); x.stroke(); } });
    } else if (d.kind === 'zigzag') {              // an incised zigzag between two lines
      press((x) => { x.lineWidth = 1.6; x.beginPath(); x.moveTo(0, y - 8); x.lineTo(W2, y - 8); x.moveTo(0, y + 8); x.lineTo(W2, y + 8); x.stroke();
        x.beginPath(); for (let i = 0; i <= W2; i += 16) x.lineTo(i, y + ((i / 16) % 2 ? 7 : -7)); x.stroke(); });
    } else if (d.kind === 'finger') {              // a row of fingertip impressions under the rim
      press((x) => { const n = 28, step = W2 / n; for (let k = 0; k < n; k++) { x.beginPath(); x.ellipse(k * step + step / 2, y + Math.sin(k * 2.1) * 1.2, 5, 3.4, 0.3, 0, TAU); x.fill(); } });
    }
  }
  return { map: toTex(c), normalMap: normalFrom(hc, 3.2) };
}
function fur(seed) {                             // fox: rufous back darkening along the spine, pale belly edges, black-tipped legs
  const S = 512, [c, g] = canvas(S, S), r = rng(seed);
  const grad = g.createLinearGradient(0, 0, S, 0); grad.addColorStop(0, '#efe3d0'); grad.addColorStop(0.17, '#c96b2c'); grad.addColorStop(0.5, '#a5501f'); grad.addColorStop(0.83, '#c96b2c'); grad.addColorStop(1, '#efe3d0');
  g.fillStyle = grad; g.fillRect(0, 0, S, S); mottle(g, S, S, 0.5, 'multiply', 0.3);
  g.strokeStyle = 'rgba(60,25,10,0.35)'; g.lineWidth = 1.2;                  // guard hairs lying back toward the tail
  for (let i = 0; i < 2500; i++) { const x = r() * S, y = r() * S, l = 6 + r() * 10; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y + l); g.stroke(); }
  // (canvas positions match the pelt's UVs in foxPelt: legs out at the sides, the head at the top)
  const blot = (x, y, rad, col) => { const lg = g.createRadialGradient(x * S, y * S, 0, x * S, y * S, rad); lg.addColorStop(0, col); lg.addColorStop(1, col.replace(/[\d.]+\)$/, '0)')); g.fillStyle = lg; g.fillRect(x * S - rad, y * S - rad, rad * 2, rad * 2); };
  for (const [x, y] of [[0.03, 0.38], [0.97, 0.38], [0.03, 0.86], [0.97, 0.86]]) blot(x, y, 52, 'rgba(32,18,12,0.85)');   // black stockings
  blot(0.5, 0.0, 40, 'rgba(240,232,220,0.9)'); blot(0.44, 0.07, 26, 'rgba(240,232,220,0.75)'); blot(0.56, 0.07, 26, 'rgba(240,232,220,0.75)');   // white muzzle and cheeks
  blot(0.34, 0.05, 22, 'rgba(30,18,12,0.9)'); blot(0.66, 0.05, 22, 'rgba(30,18,12,0.9)');                                                      // black-backed ears
  g.fillStyle = 'rgba(15,8,5,0.95)'; for (const x of [0.46, 0.54]) { g.beginPath(); g.ellipse(x * S, 0.12 * S, 4, 2.4, 0, 0, TAU); g.fill(); }   // the eye-holes
  const [ac, ag] = canvas(S, S); ag.fillStyle = '#000'; ag.fillRect(0, 0, S, S);   // hair strands, for the fur shells
  for (let i = 0; i < 52000; i++) { const v = 90 + r() * 165; ag.fillStyle = `rgb(${v},${v},${v})`; ag.fillRect(r() * S, r() * S, 1.5, 1.5); }
  const [tc, tg] = canvas(128, 256), tgr = tg.createLinearGradient(0, 256, 0, 0);   // the brush: rufous, darkening, then a white tip
  tgr.addColorStop(0, '#b4561f'); tgr.addColorStop(0.62, '#8e4420'); tgr.addColorStop(0.74, '#3a2418'); tgr.addColorStop(0.8, '#e9e1d4'); tgr.addColorStop(1, '#f4efe6');
  tg.fillStyle = tgr; tg.fillRect(0, 0, 128, 256); mottle(tg, 128, 256, 0.3, 'multiply', 0.25);
  return { map: toTex(c), alpha: toTex(ac, false), tail: toTex(tc) };
}
// Ground ochre: an earthy rust red, uneven where the muller has worked it, with grit and paler dust.
// The alpha fades out at a ragged edge so the powder sits *on* the stone rather than as a decal.
function ochrePowder(seed, edge = false) {
  const S = 256, [c, g] = canvas(S, S), r = rng(seed); g.fillStyle = '#7a3420'; g.fillRect(0, 0, S, S);
  mottle(g, S, S, 0.4, 'multiply', 0.45); mottle(g, S, S, 0.15, 'soft-light', 0.5);
  g.globalAlpha = 0.25; for (let i = 0; i < 14; i++) { g.strokeStyle = r() < 0.5 ? '#a4523a' : '#4e1e12'; g.lineWidth = 6 + r() * 14; g.beginPath(); const cx = S / 2 + (r() - 0.5) * 60, cy = S / 2 + (r() - 0.5) * 60, rad = 20 + r() * 70; g.arc(cx, cy, rad, r() * 6, r() * 6 + 1.5 + r() * 2); g.stroke(); } g.globalAlpha = 1;   // the muller's arcs
  specks(g, S, S, 2200, ['rgba(160,70,40,0.55)', 'rgba(45,15,8,0.55)', 'rgba(190,120,90,0.35)', 'rgba(20,10,6,0.4)'], 0.4, 1.3, seed);
  if (!edge) return toTex(c);
  const [ac, ag] = canvas(S, S), img = ag.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = x / S - 0.5, dy = y / S - 0.5, d = Math.hypot(dx, dy) * 2, a = Math.atan2(dy, dx);
    const lim = 0.78 + (fbm(Math.cos(a) * 2 + 9, Math.sin(a) * 2 + seed, 3) - 0.5) * 0.45, grain = fbm(x * 0.25, y * 0.25, 2);
    const v = Math.max(0, Math.min(1, (lim - d) / 0.22 + (grain - 0.5) * 0.8)) * 255, i = (y * S + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  ag.putImageData(img, 0, 0);
  return { map: toTex(c), alpha: toTex(ac, false) };
}
// Hazelnut shell, unwrapped round a sphere: glossy chestnut brown with fine darker stripes running
// base to tip, a pale rough scar at the base and a furry darker tip.
function hazelShell(seed) {
  const W = 256, H = 128, [c, g] = canvas(W, H), [hc, hg] = canvas(W, H), r = rng(seed);
  const grad = g.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, '#4a2a14'); grad.addColorStop(0.25, '#7b4a24'); grad.addColorStop(0.65, '#8a5529'); grad.addColorStop(0.8, '#6e4220'); grad.addColorStop(1, '#d8c39e');
  g.fillStyle = grad; g.fillRect(0, 0, W, H); mottle(g, W, H, 0.35, 'multiply', 0.3);
  hg.fillStyle = '#808080'; hg.fillRect(0, 0, W, H);
  for (let i = 0; i < 70; i++) {                    // the stripes
    const x = r() * W, a = 0.12 + r() * 0.2; g.strokeStyle = `rgba(40,20,8,${a})`; g.lineWidth = 1 + r() * 2.5; g.beginPath(); g.moveTo(x, H * 0.08); g.bezierCurveTo(x + (r() - 0.5) * 8, H * 0.4, x + (r() - 0.5) * 8, H * 0.6, x + (r() - 0.5) * 6, H * 0.84); g.stroke();
    hg.strokeStyle = 'rgba(0,0,0,0.12)'; hg.lineWidth = 1.2; hg.stroke();
  }
  // the base scar (bottom of the sphere: v near 0, which is the bottom of the canvas)
  const sg = g.createLinearGradient(0, H * 0.78, 0, H); sg.addColorStop(0, 'rgba(210,190,150,0)'); sg.addColorStop(0.35, 'rgba(205,184,145,0.95)'); sg.addColorStop(1, 'rgba(190,170,135,1)');
  g.fillStyle = sg; g.fillRect(0, H * 0.78, W, H * 0.22);
  specks(g, W, H * 0.2, 300, ['rgba(120,90,60,0.5)', 'rgba(240,225,195,0.5)'], 0.5, 1.2, seed + 1);   // (top band: the fuzzy tip)
  specks(hg, W, H, 900, ['rgba(255,255,255,0.18)', 'rgba(0,0,0,0.18)'], 0.4, 1, seed + 2);
  for (let i = 0; i < 400; i++) { hg.fillStyle = `rgba(${r() < 0.5 ? 255 : 0},0,0,0.35)`; hg.fillRect(r() * W, H * (0.84 + r() * 0.16), 1.5, 1.5); }   // the scar's rough pitting
  wrapSeam(c, 24); wrapSeam(hc, 24);
  return { map: toTex(c), normalMap: normalFrom(hc, 2.5) };
}
function grainBed(seed) {                        // a heap of emmer kernels, seen from above
  const S = 512, [c, g] = canvas(S, S), [hc, hg] = canvas(S, S), r = rng(seed);
  g.fillStyle = '#6b4a22'; g.fillRect(0, 0, S, S); hg.fillStyle = '#202020'; hg.fillRect(0, 0, S, S);
  for (let i = 0; i < 5200; i++) {
    const x = r() * S, y = r() * S, a = r() * 3.2, l = 5 + r() * 2.5, w = 2.6 + r() * 1.2, t = r();
    g.fillStyle = `rgb(${190 + t * 50},${130 + t * 45},${60 + t * 30})`; g.beginPath(); g.ellipse(x, y, l, w, a, 0, TAU); g.fill();
    g.fillStyle = 'rgba(80,45,15,0.5)'; g.beginPath(); g.ellipse(x + Math.cos(a) * 0.5, y + Math.sin(a) * 0.5, l * 0.8, 0.6, a, 0, TAU); g.fill();   // the crease
    const hgr = hg.createRadialGradient(x, y, 0, x, y, l); hgr.addColorStop(0, 'rgba(255,255,255,0.9)'); hgr.addColorStop(1, 'rgba(255,255,255,0)'); hg.fillStyle = hgr; hg.beginPath(); hg.ellipse(x, y, l, w, a, 0, TAU); hg.fill();
  }
  return { map: toTex(c, true, [2, 2]), normalMap: normalFrom(hc, 3) };
}

// ---------------------------------------------------------------- geometry helpers
const mesh = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; return m; };
const group = (...o) => { const g = new THREE.Group(); o.forEach((x) => x && g.add(x)); return g; };
function tubeMesh(paths, r, mat, segs = 6) { const geo = new Geo(); for (const pts of paths) geo.tube(pts.map((p) => Object.assign(V(p[0], p[1], p[2]), { r: p[3] ?? r })), segs, 1, 0.2); return mesh(geo.build(), mat); }
// A rope of `ply` strands twisted around a path (list of [x,y,z]).
function rope(path, radius, mat, { ply = 2, twist = 0.012, segs = 5 } = {}) {
  const curve = new THREE.CatmullRomCurve3(path.map((p) => new THREE.Vector3(...p)));
  const n = Math.max(20, Math.round(curve.getLength() / 0.003)), frames = curve.computeFrenetFrames(n, false), geo = new Geo();
  for (let k = 0; k < ply; k++) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const p = curve.getPointAt(i / n), a = (i / n) * curve.getLength() / twist + (k / ply) * TAU;
      const o = new THREE.Vector3().addScaledVector(frames.normals[i], Math.cos(a) * radius * 0.55).addScaledVector(frames.binormals[i], Math.sin(a) * radius * 0.55);
      pts.push(Object.assign(p.clone().add(o), { r: radius * 0.6 }));
    }
    geo.tube(pts, segs, 1, 0.1);
  }
  return mesh(geo.build(), mat);
}
// A pot turned on a lathe: outer wall from the base up to the rim, over the rim, down the inside.
function potGeometry(radiusAt, H, thick, N = 44, M = 22) {
  const prof = [new THREE.Vector2(0.0005, 0)];
  for (let i = 1; i <= N; i++) { const h = i / N; prof.push(new THREE.Vector2(radiusAt(h) * H, h * H)); }
  const rimR = radiusAt(1) * H;
  prof.push(new THREE.Vector2(rimR - thick * 0.5, H + thick * 0.35));
  for (let j = 0; j <= M; j++) { const h = 1 - j / M * 0.94; prof.push(new THREE.Vector2(Math.max(0.0005, radiusAt(h) * H - thick), h * H + (j === M ? thick * 1.4 : 0))); }
  prof.push(new THREE.Vector2(0.0005, thick * 1.4 + 0.06 * H * 0));
  return { geo: new THREE.LatheGeometry(prof, 56), vOuter: N / (prof.length - 1) };
}
function scanned(T, name, scale = 1) {
  const s = T.scan?.[name]; if (!s) return null;
  const m = mesh(s.list[0], s.material); m.scale.setScalar(scale); m.position.y = -s.list[0].userData.minY * scale; return m;
}

// ---------------------------------------------------------------- the goods
export function makeGoods(T) {
  const r = rng(1234);
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, ...o });
  // Birch tar. Phong rather than PBR: under r169 the scene's sky environment can't be turned down per
  // material, and a flat black gloss mirrors it white. Phong takes its glints from the lamp and the sun only.
  const TAR = (shininess = 70) => new THREE.MeshPhongMaterial({ color: 0x0b0806, specular: 0x5a4a3a, shininess, emissive: 0x000000 });
  const tan = suede('#bf9567', '#4a3020', 11), dark = suede('#7a5638', '#2a1a10', 12);
  const rawhide = std({ color: 0xc49a68, roughness: 0.62 }), thong = std({ color: 0x6e4c30, roughness: 0.75 });

  return {
    // ---------------- the Hide House
    hideRoll() {
      const mat = std({ map: tan.map, normalMap: tan.normalMap, normalScale: new THREE.Vector2(0.9, 0.9) });
      const L = 0.4, R = 0.068;
      const body = mesh(new THREE.CylinderGeometry(R, R, L, 48, 1, true), mat); body.rotation.z = Math.PI / 2; body.position.y = R;
      const endMat = std({ map: rollEnds(), roughness: 0.9 });
      const ends = [-1, 1].map((s) => { const e = mesh(new THREE.CircleGeometry(R, 40), endMat); e.rotation.y = s * Math.PI / 2; e.position.set(s * L / 2, R, 0); return e; });
      // the free edge of the hide, unrolled a little onto the table, its margin ragged
      const flapG = new THREE.PlaneGeometry(L * 0.96, 0.14, 30, 8); flapG.rotateX(-Math.PI / 2);
      const fp = flapG.attributes.position;
      for (let i = 0; i < fp.count; i++) { const x = fp.getX(i), z = fp.getZ(i) + 0.07, rag = (fbm(x * 30, 3, 2) - 0.5) * 0.03;
        const zz = Math.max(0, z + rag * (z / 0.14)); fp.setZ(i, R * 0.2 + zz); fp.setY(i, 0.003 + Math.max(0, R * 0.9 - zz * 6) * 0.15 + Math.sin(x * 40) * 0.0015); }
      flapG.computeVertexNormals();
      const flap = mesh(flapG, std({ map: tan.map, normalMap: tan.normalMap, side: THREE.DoubleSide }));
      const ties = [-0.12, 0.13].map((x) => {          // rawhide thongs wound twice and knotted, ends left loose
        const pts = []; for (let a = 0; a <= TAU * 2; a += 0.15) pts.push([x + a * 0.0025, R + Math.sin(a) * (R + 0.004), Math.cos(a) * (R + 0.004)]);
        const tie = rope(pts, 0.0045, thong, { ply: 2, twist: 0.006 });
        const knot = mesh(new THREE.IcosahedronGeometry(0.009, 1), thong); knot.position.set(x + 0.032, R + 0.002, R + 0.003);
        const ends2 = rope([[x + 0.032, R, R + 0.006], [x + 0.045, R * 0.6, R + 0.02], [x + 0.06, 0.004, R + 0.05]], 0.0035, thong, { ply: 2, twist: 0.006 });
        return group(tie, knot, ends2);
      });
      return group(body, ...ends, flap, ...ties);
    },
    sinew() {
      // dried sinew: horn-coloured, faintly translucent amber, a little glossy
      const mats = [0xbfa678, 0xab8e5e, 0x987a4c].map((c) => std({ color: c, roughness: 0.5 }));
      const groups = [[], [], []];
      for (let i = 0; i < 70; i++) {                   // long fibres, gathered at the waist and fanning out at both ends
        const a = r() * TAU, d = Math.sqrt(r()), spread = 0.022 + r() * 0.012, wobble = (r() - 0.5) * 0.01;
        const pts = [];
        for (let k = 0; k <= 8; k++) {
          const t = k / 8, x = -0.16 + t * 0.32, pinch = 0.18 + 0.82 * Math.pow(Math.abs(t - 0.5) * 2, 1.3);
          pts.push([x, 0.012 + Math.sin(a) * d * spread * pinch * 0.5 + 0.004, Math.cos(a) * d * spread * pinch + wobble * Math.sin(t * 6), 0.0013 + r() * 0.0008]);
        }
        groups[i % 3].push(pts);
      }
      const bundle = group(...groups.map((p, i) => tubeMesh(p, 0.0016, mats[i], 4)));
      const wrap = []; for (let a = 0; a <= TAU * 4; a += 0.2) wrap.push([-0.012 + a * 0.0012, 0.016 + Math.sin(a) * 0.009, Math.cos(a) * 0.011]);
      return group(bundle, tubeMesh([wrap], 0.0016, mats[0], 4));
    },
    cordCoil() {
      const pts = []; for (let a = 0; a < TAU * 4.3; a += 0.12) { const rr = 0.026 + a * 0.0019; pts.push([Math.cos(a) * rr, 0.004 + (a > TAU * 3.6 ? 0.004 : 0), Math.sin(a) * rr]); }
      const last = pts[pts.length - 1]; pts.push([last[0] + 0.03, 0.004, last[2] + 0.04], [last[0] + 0.07, 0.004, last[2] + 0.05]);   // the loose end
      return group(rope(pts, 0.0058, rawhide, { ply: 2, twist: 0.011 }));
    },
    kneePad() {
      const w = 0.2, d = 0.15, rr = 0.035, sh = new THREE.Shape();
      sh.moveTo(-w / 2 + rr, -d / 2); sh.lineTo(w / 2 - rr, -d / 2); sh.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + rr); sh.lineTo(w / 2, d / 2 - rr); sh.quadraticCurveTo(w / 2, d / 2, w / 2 - rr, d / 2);
      sh.lineTo(-w / 2 + rr, d / 2); sh.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - rr); sh.lineTo(-w / 2, -d / 2 + rr); sh.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + rr, -d / 2);
      const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.007, bevelSize: 0.007, bevelSegments: 3, curveSegments: 10 });
      geo.rotateX(-Math.PI / 2); geo.translate(0, 0.007, 0);
      const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + 0.012 * Math.cos(p.getX(i) / w * Math.PI) - 0.004);   // shaped to a knee
      geo.computeVertexNormals();
      const pad = mesh(geo, std({ map: dark.map, normalMap: dark.normalMap, roughness: 0.7 })); pad.material.map.repeat.set(4, 4); pad.material.normalMap.repeat.set(4, 4);
      const st = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0013, 0.0013, 0.007, 4), std({ color: 0xd9c7a2, roughness: 0.6 }), 64), m = new THREE.Object3D();
      for (let i = 0; i < 64; i++) {                   // a running stitch of sinew round the edge
        const t = i / 64, per = 2 * (w + d - 0.06), s = t * per; let x, z, ang;
        const a = w - 0.03, b = d - 0.03;
        if (s < a) { x = -a / 2 + s; z = -b / 2; ang = 0; } else if (s < a + b) { x = a / 2; z = -b / 2 + (s - a); ang = Math.PI / 2; } else if (s < 2 * a + b) { x = a / 2 - (s - a - b); z = b / 2; ang = 0; } else { x = -a / 2; z = b / 2 - (s - 2 * a - b); ang = Math.PI / 2; }
        m.position.set(x, 0.026 + 0.012 * Math.cos(x / w * Math.PI) - 0.004, z); m.rotation.set(0, ang, Math.PI / 2); m.updateMatrix(); st.setMatrixAt(i, m.matrix);
      }
      const ties = [-1, 1].map((s) => rope([[s * 0.1, 0.018, 0], [s * 0.14, 0.01, 0.02], [s * 0.2, 0.004, 0.05], [s * 0.24, 0.004, 0.04]], 0.0035, thong, { ply: 2, twist: 0.006 }));
      return group(pad, st, ...ties);
    },
    foxPelt() {
      const f = fur(21);
      // the pelt's outline, as cased and stretched flat: the head with its ears, forelegs, a waist,
      // hind legs tapering to the paws, and the tail root. One smooth spline, mirrored.
      const half = [[0, 0.305], [0.016, 0.288], [0.032, 0.255], [0.05, 0.262], [0.072, 0.29], [0.07, 0.24], [0.056, 0.2], [0.07, 0.165],
        [0.12, 0.15], [0.17, 0.128], [0.208, 0.112], [0.222, 0.098], [0.205, 0.088], [0.15, 0.09], [0.098, 0.075], [0.082, 0.02], [0.084, -0.05],
        [0.104, -0.095], [0.155, -0.118], [0.205, -0.148], [0.226, -0.168], [0.206, -0.178], [0.15, -0.168], [0.09, -0.178], [0.05, -0.21], [0.022, -0.232]];
      const loop = [...half, [0, -0.236], ...half.slice(1).reverse().map(([x, y]) => [-x, y])].map(([x, y]) => new THREE.Vector2(x, y));
      const sh = new THREE.Shape(); sh.moveTo(loop[0].x, loop[0].y); sh.splineThru(loop.slice(1).concat([loop[0]]));
      const geo = new THREE.ShapeGeometry(sh, 6); geo.rotateX(-Math.PI / 2);
      const uv = geo.attributes.uv, pp = geo.attributes.position;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, pp.getX(i) / 0.46 + 0.5, (-pp.getZ(i) - 0.03) / 0.56 + 0.5);
      const g = new THREE.Group();
      const LAYERS = 9;
      for (let k = 0; k < LAYERS; k++) {               // fur: stacked shells, each a little higher and sparser
        const t = k / (LAYERS - 1);
        const mat = std({ map: f.map, alphaMap: k ? f.alpha : null, alphaTest: k ? 0.2 + t * 0.6 : 0, transparent: false, roughness: 1, side: THREE.DoubleSide, color: new THREE.Color().setScalar(0.5 + t * 0.6) });
        // each shell drawn in a little from the outline, so the fur thins to a soft edge instead of a stepped wall
        const s = mesh(geo, mat); s.position.y = 0.004 + t * 0.022; s.scale.set(1 - t * 0.06, 1, 1 - t * 0.04); s.castShadow = k === 0; g.add(s);
      }
      // the brush: full and tapered, darkening before its white tip, in fur shells
      const spine = new THREE.CatmullRomCurve3([[0, 0.014, 0.2], [0.035, 0.022, 0.29], [0.02, 0.026, 0.38], [-0.02, 0.022, 0.46], [-0.05, 0.016, 0.51]].map((p) => new THREE.Vector3(...p)));
      for (let k = 0; k < 7; k++) {
        const t = k / 6, geo2 = new Geo(), pts = [];
        for (let i = 0; i <= 24; i++) { const u = i / 24, p = spine.getPointAt(u); p.r = (0.014 + 0.028 * Math.sin(Math.min(1, u * 1.15) * Math.PI) ** 0.7 + 0.002) * (1 + t * 0.45); pts.push(p); }
        geo2.tube(pts, 12, 1, spine.getLength());
        g.add(mesh(geo2.build(), std({ map: f.tail, alphaMap: k ? f.alpha : null, alphaTest: k ? 0.25 + t * 0.55 : 0, roughness: 1, color: new THREE.Color().setScalar(0.55 + t * 0.55) })));
      }
      g.rotation.y = 0.5; g.scale.setScalar(0.9);
      return g;
    },

    // ---------------- the Hearth House
    flatbread() {
      const plate = scanned(T, 'carved_wooden_plate', 1.05) || mesh(new THREE.CylinderGeometry(0.14, 0.13, 0.03, 32), std({ map: T.wood.map }));
      const breads = [0, 1, 2].map((k) => {
        const c = crust(31 + k), R = 0.095 - k * 0.006;
        const geo = new THREE.SphereGeometry(1, 48, 20), p = geo.attributes.position, uv = geo.attributes.uv;
        for (let i = 0; i < p.count; i++) {
          let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
          const edge = 1 + (fbm(Math.atan2(z, x) * 2 + k * 9, k, 2) - 0.5) * 0.18;     // a hand-patted, uneven edge
          const bump = y > 0 ? (fbm(x * 4 + k * 3, z * 4, 3) - 0.4) * 0.35 : 0;
          x *= R * edge; z *= R * edge; y = y > 0 ? y * (0.012 + bump * 0.012) : y * 0.004;
          p.setXYZ(i, x, y, z); uv.setXY(i, x / (R * 2.3) + 0.5, z / (R * 2.3) + 0.5);
        }
        geo.computeVertexNormals();
        const b = mesh(geo, std({ map: c.map, normalMap: c.normalMap, roughness: 0.8 }));
        b.position.set((k - 1) * 0.012, 0.022 + k * 0.016, (k - 1) * -0.01); b.rotation.set((k - 1) * 0.06, k * 1.3, (k - 1) * 0.05);
        return b;
      });
      return group(plate, ...breads);
    },
    emmerBasket() {
      const basket = scanned(T, 'wicker_basket_01', 1.0) || mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.12, 24, 1, true), std({ color: 0x8a6a42, side: THREE.DoubleSide }));
      const gb = grainBed(41);
      const heap = new THREE.CircleGeometry(1, 40, 0, TAU); heap.rotateX(-Math.PI / 2);
      const hp = heap.attributes.position; for (let i = 0; i < hp.count; i++) { const x = hp.getX(i), z = hp.getZ(i), d = Math.hypot(x, z); hp.setXYZ(i, x * 0.168, 0.085 + (1 - d * d) * 0.03 + (fbm(x * 6, z * 6, 2) - 0.5) * 0.008, z * 0.128); }
      heap.computeVertexNormals();
      const bed = mesh(heap, std({ map: gb.map, normalMap: gb.normalMap, roughness: 0.75 }));
      // loose kernels on the surface, and a few whole ears laid on top
      const kGeo = new THREE.SphereGeometry(1, 8, 6), kMat = std({ color: 0xd4a25c, roughness: 0.55 });
      const kernels = new THREE.InstancedMesh(kGeo, kMat, 520), m = new THREE.Object3D(), col = new THREE.Color();
      for (let i = 0; i < 520; i++) {
        const a = r() * TAU, d = Math.sqrt(r()) * 0.96, x = Math.cos(a) * d * 0.168, z = Math.sin(a) * d * 0.128;
        m.position.set(x, 0.087 + (1 - d * d) * 0.03, z); m.rotation.set(r() * 3, r() * 3, r() * 3); m.scale.set(0.0022, 0.0018, 0.0042); m.updateMatrix(); kernels.setMatrixAt(i, m.matrix);
        const v = 0.75 + r() * 0.4; kernels.setColorAt(i, col.setRGB(v, v * 0.9, v * 0.75));
      }
      kernels.castShadow = kernels.receiveShadow = true;
      const ears = [0, 1, 2].map((e) => {
        const g = new THREE.Group(), stalk = tubeMesh([[[-0.16, 0, 0], [-0.05, 0.002, 0]]], 0.0018, std({ color: 0xcaa463, roughness: 0.7 }), 4); g.add(stalk);
        const spik = new THREE.InstancedMesh(kGeo, std({ color: 0xc89a55, roughness: 0.6 }), 22), awns = [];
        for (let i = 0; i < 22; i++) {
          const x = -0.05 + i * 0.0045, s = i % 2 ? 1 : -1;
          m.position.set(x, 0.003, s * 0.003); m.rotation.set(0, 0, s * 0.35); m.scale.set(0.004, 0.0028, 0.0028); m.updateMatrix(); spik.setMatrixAt(i, m.matrix);
          awns.push([[x, 0.005, s * 0.004], [x + 0.035, 0.012, s * 0.012, 0.0002]]);
        }
        g.add(spik, tubeMesh(awns, 0.0004, std({ color: 0xe0c58a, roughness: 0.6 }), 3));
        g.position.set(-0.02 + e * 0.03, 0.118 + e * 0.004, -0.04 + e * 0.035); g.rotation.y = 0.4 + e * 0.5;
        return g;
      });
      return group(basket, bed, kernels, ...ears);
    },
    hazelnuts() {
      const bowl = scanned(T, 'wooden_bowl_02', 1.3);
      const hz = hazelShell(61);
      // a hazelnut: rounded, a little flattened, drawn up to a blunt point
      const shape = (geo) => { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { let x = p.getX(i), y = p.getY(i), z = p.getZ(i); const top = Math.max(0, y); x *= (1 - top * top * 0.32) * 1.04; z *= (1 - top * top * 0.32) * 0.94; y = y * 1.1 + top * top * 0.14; p.setXYZ(i, x, y, z); } geo.computeVertexNormals(); return geo; };
      const nGeo = shape(new THREE.SphereGeometry(1, 24, 18));
      const shellMat = std({ map: hz.map, normalMap: hz.normalMap, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.38 });
      // heaped in the bowl: placed in rings from the floor up so they rest on one another instead of floating
      const spots = [];
      for (const [n, rad, y] of [[9, 0.05, 0.026], [7, 0.032, 0.03], [3, 0.013, 0.033], [8, 0.042, 0.045], [5, 0.022, 0.05], [2, 0.006, 0.062]]) {
        const off = r() * TAU; for (let k = 0; k < n; k++) { const a = off + (k / n) * TAU + (r() - 0.5) * 0.3; spots.push([Math.cos(a) * rad, y + (r() - 0.5) * 0.003, Math.sin(a) * rad]); }
      }
      const nuts = new THREE.InstancedMesh(nGeo, shellMat, spots.length), m = new THREE.Object3D(), col = new THREE.Color();
      spots.forEach(([x, y, z], i) => {
        m.position.set(x, y, z); m.rotation.set((r() - 0.5) * 2.6, r() * 6, (r() - 0.5) * 2.6); m.scale.setScalar(0.0085 + r() * 0.0014); m.updateMatrix(); nuts.setMatrixAt(i, m.matrix);
        const v = 0.85 + r() * 0.25; nuts.setColorAt(i, col.setRGB(v, v * (0.95 + r() * 0.08), v * 0.92));
      });
      nuts.castShadow = nuts.receiveShadow = true;
      // two cracked open on the table: jagged shell halves, and the kernel in its papery skin
      const halfGeo = (k) => { const g = shape(new THREE.SphereGeometry(1, 22, 12, 0, TAU, Math.PI * 0.38, Math.PI * 0.62)), p = g.attributes.position;
        for (let i = 0; i < p.count; i++) if (p.getY(i) > 0.35) p.setY(i, p.getY(i) - Math.abs(Math.sin(Math.atan2(p.getZ(i), p.getX(i)) * 7 + k)) * 0.12); g.computeVertexNormals(); return g; };
      const cracked = [0, 1].map((k) => { const s = mesh(halfGeo(k), std({ map: hz.map, normalMap: hz.normalMap, roughness: 0.4, side: THREE.DoubleSide })); s.scale.setScalar(0.0088); s.position.set(0.1 + k * 0.024, k ? 0.0088 * 0.85 : 0.0088 * 0.3, 0.03 - k * 0.02); s.rotation.set(k ? Math.PI : 0.3, r() * 3, 0.25); return s; });
      const skin = suede('#a7703e', '#5a3418', 62);
      const kernel = mesh(shape(new THREE.SphereGeometry(1, 18, 12)), std({ map: skin.map, normalMap: skin.normalMap, roughness: 0.8 })); kernel.scale.set(0.0068, 0.006, 0.0062); kernel.rotation.z = 1.3; kernel.position.set(0.114, 0.0062, 0.002);
      return group(bowl, nuts, ...cracked, kernel);
    },
    tarCake() {
      // a sheet of birch bark curled into a shallow trough: papery white outside, orange-tan within
      const bg = new THREE.PlaneGeometry(0.2, 0.155, 40, 48); bg.rotateX(-Math.PI / 2);
      const bp = bg.attributes.position, z0 = 0.036, Rc = 0.012;
      for (let i = 0; i < bp.count; i++) {
        const x0 = bp.getX(i), z = bp.getZ(i), s = Math.sign(z) || 1, az = Math.abs(z);
        const x = x0 * (1 - (fbm(z * 25 + (x0 > 0 ? 3 : 7), 1, 2) - 0.5) * 0.16);   // torn, uneven ends
        let y = 0.003 + az * az * 1.4, zz = z;
        if (az > z0) { const th = (az - z0) / Rc; zz = s * (z0 + Rc * Math.sin(th)); y = 0.003 + z0 * z0 * 1.4 + Rc * (1 - Math.cos(th)); }   // the long edges roll up and over, inward
        bp.setXYZ(i, x, y + (fbm(x * 30, z * 30, 2) - 0.5) * 0.002 + Math.abs(x) * 0.025, zz);
      }
      bg.computeVertexNormals();
      const inner = suede('#b8794a', '#6a3a1e', 63);
      const barkIn = mesh(bg, std({ map: inner.map, normalMap: inner.normalMap, roughness: 0.85, side: THREE.FrontSide }));
      const barkOut = mesh(bg, std({ map: T.birch.map, normalMap: T.birch.normalMap, color: 0xd9d0c2, roughness: 0.75, side: THREE.BackSide }));
      // the tar: welded so it shades smooth, slumped flat on its underside, a thumb-dent in the top
      const tarMat = TAR();
      const lump = (k, dent) => {
        const geo = mergeVertices(new THREE.IcosahedronGeometry(1, 5)), p = geo.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = 1 + (fbm(x * 1.6 + k * 7, z * 1.6 + y * 0.8, 3) - 0.5) * 0.3;
          let yy = y >= 0 ? y * 0.5 : y * 0.22; yy -= dent * Math.exp(-((x - 0.35) ** 2 + (z + 0.15) ** 2) / 0.05) * 0.12 * Math.max(0, y);
          p.setXYZ(i, x * n * (1 + Math.max(0, -y) * 0.15), yy * n, z * n * (1 + Math.max(0, -y) * 0.15));
        }
        geo.computeVertexNormals();
        return mesh(geo, tarMat);
      };
      const cake = lump(0, 1); cake.scale.set(0.05, 0.05, 0.042); cake.position.set(-0.012, 0.018, 0);
      const crumb = lump(1, 0); crumb.scale.setScalar(0.017); crumb.position.set(0.07, 0.013, 0.022);
      // a stirring stick with tar dried on its end
      const stick = tubeMesh([[[0.12, 0.004, -0.085], [0.02, 0.007, -0.075], [-0.1, 0.012, -0.062]]], 0.0045, std({ map: T.bark.map, normalMap: T.bark.normalMap, color: 0x8a6a4a }), 7);
      const blob = lump(2, 0); blob.scale.set(0.022, 0.016, 0.011); blob.position.set(-0.092, 0.013, -0.063); blob.rotation.y = 0.1;
      return group(barkIn, barkOut, cake, crumb, stick, blob);
    },
    crabApples() {
      const bowl = scanned(T, 'wooden_bowl_01', 0.62);
      const apple = T.scan?.food_apple_01;
      const g = group(bowl);
      const spots = [[0, 0.026, 0], [0.032, 0.022, 0.02], [-0.03, 0.022, 0.024], [0.012, 0.024, -0.035], [-0.02, 0.05, -0.006], [0.018, 0.05, 0.008]];
      spots.forEach(([x, y, z], i) => {
        const a = apple ? mesh(apple.list[0], apple.material) : mesh(new THREE.SphereGeometry(0.045, 16, 12), std({ color: 0x9a3a20 }));
        const s = 0.5 + r() * 0.12; a.scale.setScalar(s); a.position.set(x * 1.4, y, z * 1.4); a.rotation.set((r() - 0.5) * 0.8, r() * 6, (r() - 0.5) * 0.8); g.add(a);
      });
      return g;
    },

    // ---------------- the Clay House
    cup() {         // a beaker with zones of cord impression
      const H = 0.11, prof = (h) => 0.36 + 0.07 * Math.sin(h * Math.PI * 0.9) - 0.12 * Math.max(0, h - 0.55) + 0.14 * Math.pow(Math.max(0, h - 0.7) / 0.3, 2);
      const { geo, vOuter } = potGeometry((h) => (h < 0.04 ? 0.26 + h * 2 : prof(h)), H, 0.005);
      const tx = pottery({ base: '#b9764e', dark: 'rgba(40,25,20,0.7)', deco: [{ kind: 'cord', at: 0.86, rows: 3 }, { kind: 'cord', at: 0.55, rows: 3 }, { kind: 'cord', at: 0.25, rows: 2 }], vOuter, seed: 51 });
      return group(mesh(geo, std({ map: tx.map, normalMap: tx.normalMap, roughness: 0.6 })));
    },
    cookingPot() {  // round-bottomed, sooty from the fire, sitting on a ring of twisted grass
      const H = 0.17, prof = (h) => 0.18 + 0.55 * Math.sin(Math.min(1, h * 1.35) * Math.PI * 0.5) - 0.1 * Math.max(0, h - 0.74) / 0.26 + 0.05 * Math.pow(Math.max(0, h - 0.9) / 0.1, 2);
      const { geo, vOuter } = potGeometry((h) => (h < 0.02 ? h * 6 : prof(h)) * 0.95, H, 0.007);
      const tx = pottery({ base: '#9b6646', dark: 'rgba(25,18,14,0.85)', soot: 0.92, deco: [{ kind: 'finger', at: 0.88 }], vOuter, seed: 52 });
      const pot = mesh(geo, std({ map: tx.map, normalMap: tx.normalMap, roughness: 0.72 })); pot.position.y = 0.02;
      const ringPts = []; for (let a = 0; a <= TAU + 0.05; a += 0.15) ringPts.push([Math.cos(a) * 0.055, 0.008, Math.sin(a) * 0.055]);
      const straw = suede('#8a7346', '#3e3018', 64);    // old, smoke-browned grass
      const ring = rope(ringPts, 0.012, std({ map: straw.map, normalMap: straw.normalMap, color: 0x9a8a72, roughness: 1 }), { ply: 3, twist: 0.03 });
      return group(ring, pot);
    },
    storageJar() {  // tall, with a row of fingertip impressions, its mouth covered with hide and tied
      const H = 0.3, prof = (h) => 0.12 + 0.27 * Math.sin(Math.min(1, h * 1.15) * Math.PI * 0.62) - 0.1 * Math.max(0, h - 0.78) / 0.22 + 0.03 * Math.pow(Math.max(0, h - 0.93) / 0.07, 2);
      const { geo, vOuter } = potGeometry((h) => (h < 0.03 ? 0.13 + h * 1 : prof(h) + Math.max(0, 0.04 - h * 0.4)), H, 0.008);
      const wallR = (y) => prof(Math.max(0.03, Math.min(1, y / H))) * H;   // outer radius at a height
      const tx = pottery({ base: '#b0704a', dark: 'rgba(35,22,16,0.75)', deco: [{ kind: 'finger', at: 0.74 }, { kind: 'zigzag', at: 0.6 }], vOuter, seed: 53 });
      const jar = mesh(geo, std({ map: tx.map, normalMap: tx.normalMap, roughness: 0.65 }));
      const rimR = prof(1) * H, neckR = prof(0.82) * H, rimY = H;
      const cover = new THREE.CircleGeometry(rimR + 0.05, 48, 0, TAU); cover.rotateX(-Math.PI / 2);
      const cp = cover.attributes.position;
      for (let i = 0; i < cp.count; i++) {
        const x = cp.getX(i), z = cp.getZ(i), d = Math.hypot(x, z), a = Math.atan2(z, x);
        if (d <= rimR) { cp.setY(i, rimY + 0.006 - (1 - d / rimR) * 0.004); continue; }
        // past the rim the hide falls down the neck, hugging the wall, its hem uneven and flaring a little
        const drop = (d - rimR) * (1.15 + (fbm(a * 3, 1, 2) - 0.5) * 0.6), y = rimY + 0.003 - drop;
        const flare = Math.max(0, drop - 0.03) * 0.25 + Math.max(0, Math.sin(a * 5 + 1)) * drop * 0.06;
        const rr = Math.max(wallR(y), rimR) + 0.0035 + flare;
        cp.setXYZ(i, Math.cos(a) * rr, y, Math.sin(a) * rr);
      }
      cover.computeVertexNormals();
      const hideCover = mesh(cover, std({ map: tan.map, normalMap: tan.normalMap, side: THREE.DoubleSide }));
      // the thong tied round the neck, binding the hide in, its ends hanging
      const tieY = rimY - 0.026, tr = Math.max(wallR(tieY), rimR) + 0.006, tie = []; for (let a = 0; a <= TAU * 2; a += 0.12) tie.push([Math.cos(a) * tr, tieY - a * 0.0009, Math.sin(a) * tr]);
      const tails = rope([[tr, tieY - 0.006, 0], [tr + 0.006, tieY - 0.03, 0.01], [wallR(tieY - 0.06) + 0.004, tieY - 0.065, 0.016]], 0.0032, thong, { ply: 2, twist: 0.006 });
      void neckR;
      return group(jar, hideCover, rope(tie, 0.0035, thong, { ply: 2, twist: 0.006 }), tails);
    },
    tarPot() {      // small and thick-walled, black tar inside and dripping over the lip
      const H = 0.075, prof = (h) => 0.62 + 0.15 * Math.sin(h * Math.PI) - 0.08 * h;
      const { geo, vOuter } = potGeometry((h) => (h < 0.05 ? 0.45 + h * 3 : prof(h)), H, 0.009);
      const tx = pottery({ base: '#7a5240', dark: 'rgba(15,10,8,0.9)', soot: 0.5, vOuter, seed: 54, runs: 3 });
      const pot = mesh(geo, std({ map: tx.map, normalMap: tx.normalMap, roughness: 0.7 }));
      // the tar inside: dark and only softly glossy (the pot walls shade it from the sky), wrinkled as it set,
      // climbing the wall at the edge, with the stick still standing in it
      const tarMat = TAR(40);
      const sy = H * 0.78, sr = prof(0.78) * H - 0.009;
      const sg = new THREE.CircleGeometry(sr, 40, 0, TAU); sg.rotateX(-Math.PI / 2);
      const spp = sg.attributes.position;
      for (let i = 0; i < spp.count; i++) { const x = spp.getX(i), z = spp.getZ(i), d = Math.hypot(x, z) / sr; spp.setY(i, Math.pow(d, 6) * 0.004 + (fbm(x * 90, z * 90, 3) - 0.5) * 0.0025); }
      sg.computeVertexNormals();
      const surface = mesh(sg, tarMat); surface.position.y = sy;
      const stick = tubeMesh([[[0.004, sy - 0.01, 0.002], [-0.02, H + 0.03, 0.01], [-0.045, H + 0.075, 0.02]]], 0.0035, std({ map: T.bark.map, color: 0x8a6a4a }), 6);
      return group(pot, surface, stick);
    },
    ochre() {       // red ochre ground on a flat stone palette, with its rubbing stone and a lump yet to grind
      const slab = mesh(rockGeometry(71, 3), std({ map: T.chalk.map, normalMap: T.rock.normalMap, color: 0xd1c4ae, roughness: 0.9 })); slab.scale.set(0.13, 0.025, 0.1); slab.position.y = 0.015;
      // the ground ochre: a thin layer worked across the stone, fading out raggedly at its edge
      const pw = ochrePowder(72, true);
      const smear = new THREE.PlaneGeometry(0.15, 0.12, 30, 24); smear.rotateX(-Math.PI / 2);
      const sp = smear.attributes.position;
      slab.updateMatrixWorld(true);
      const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0), o = new THREE.Vector3();
      for (let i = 0; i < sp.count; i++) {             // laid onto the stone's real surface, thickest in the middle
        const x = sp.getX(i) + 0.005, z = sp.getZ(i); ray.set(o.set(x, 0.2, z), down);
        const hit = ray.intersectObject(slab)[0], top = hit ? hit.point.y : 0.03;
        sp.setXYZ(i, x, top + 0.0007 + 0.0016 * (1 - Math.min(1, Math.hypot(x / 0.075, z / 0.06))) + (fbm(x * 60, z * 60, 2) - 0.5) * 0.0008, z);
      }
      smear.computeVertexNormals();
      const powderMat = std({ map: pw.map, alphaMap: pw.alpha, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 });
      const powder = mesh(smear, powderMat); powder.castShadow = false;
      // a little heap pushed to one side, its surface granular
      const mg = mergeVertices(new THREE.IcosahedronGeometry(1, 4)), mp = mg.attributes.position;
      for (let i = 0; i < mp.count; i++) { const x = mp.getX(i), y = mp.getY(i), z = mp.getZ(i); const n = 1 + (fbm(x * 3 + 4, z * 3 + y, 3) - 0.5) * 0.35; mp.setXYZ(i, x * n, Math.max(0, y) * 0.5 * n + (fbm(x * 18, z * 18, 2) - 0.5) * 0.04, z * n); }
      mg.computeVertexNormals();
      const mound = mesh(mg, std({ map: ochrePowder(75), roughness: 1, color: 0xd8c0b0 })); mound.scale.set(0.024, 0.024, 0.02);
      ray.set(o.set(0.035, 0.2, -0.02), down); mound.position.set(0.035, (ray.intersectObject(slab)[0]?.point.y ?? 0.038) - 0.002, -0.02);
      const lump = mesh(rockGeometry(73, 2), std({ map: ochrePowder(76), normalMap: T.rock.normalMap, color: 0xa08070, roughness: 0.9 })); lump.scale.set(0.02, 0.014, 0.018); lump.position.set(0.12, 0.012, 0.04);
      const muller = mesh(rockGeometry(74, 3), std({ map: T.chalk.map, normalMap: T.rock.normalMap, color: 0xa79d8e, roughness: 0.75 })); muller.scale.set(0.035, 0.026, 0.03); muller.position.set(-0.075, 0.055, 0.02);
      const stain = mesh(new THREE.PlaneGeometry(0.05, 0.05), std({ map: pw.map, alphaMap: pw.alpha, transparent: true, depthWrite: false, opacity: 0.7, polygonOffset: true, polygonOffsetFactor: -2 })); stain.rotation.x = -Math.PI / 2; stain.position.set(-0.09, 0.0015, 0.05); stain.castShadow = false;   // dust spilled on the table
      return group(slab, powder, mound, lump, muller, stain);
    },
  };
}
