// Every texture in the scene is made here, in code. Nothing is downloaded.
import * as THREE from 'three';
import { fbm, vnoise, worley, rng, clamp, smoothstep, mix } from './noise.js';

const ANISO = 8;
const lerp3 = (a, b, t, o) => { o[0] = a[0] + (b[0] - a[0]) * t; o[1] = a[1] + (b[1] - a[1]) * t; o[2] = a[2] + (b[2] - a[2]) * t; };

function dataTex(data, w, h, srgb) {
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.anisotropy = ANISO; t.needsUpdate = true;
  return t;
}

function normalFromHeight(H, w, h, strength) {
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const l = H[y * w + ((x - 1 + w) % w)], r = H[y * w + ((x + 1) % w)];
    const d = H[((y - 1 + h) % h) * w + x], u = H[((y + 1) % h) * w + x];
    let nx = (l - r) * strength, ny = (d - u) * strength, nz = 1;
    const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
    const i = (y * w + x) * 4;
    out[i] = (nx * 0.5 + 0.5) * 255; out[i + 1] = (ny * 0.5 + 0.5) * 255; out[i + 2] = (nz * 0.5 + 0.5) * 255; out[i + 3] = 255;
  }
  return dataTex(out, w, h, false);
}

// fn(u, v, o) fills o = [r, g, b, height]; colours are in sRGB 0..1.
function procedural(size, fn, strength = 3) {
  const data = new Uint8Array(size * size * 4), H = new Float32Array(size * size), o = [0, 0, 0, 0];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    fn(x / size, y / size, o);
    const i = (y * size + x) * 4;
    data[i] = clamp(o[0], 0, 1) * 255; data[i + 1] = clamp(o[1], 0, 1) * 255; data[i + 2] = clamp(o[2], 0, 1) * 255; data[i + 3] = 255;
    H[y * size + x] = o[3];
  }
  return { map: dataTex(data, size, size, true), normalMap: normalFromHeight(H, size, size, strength) };
}

// Draw with canvas 2D. For cut-out textures, colour is bled into the transparent
// pixels so distant foliage doesn't get dark fringes.
function drawn(w, h, draw, { alpha = false, normal = 0 } = {}) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d', { willReadFrequently: true });
  draw(g, w, h);
  const src = g.getImageData(0, 0, w, h).data, data = new Uint8Array(w * h * 4);
  let ar = 0, ag = 0, ab = 0, n = 0;
  if (alpha) for (let i = 0; i < src.length; i += 4) if (src[i + 3] > 200) { ar += src[i]; ag += src[i + 1]; ab += src[i + 2]; n++; }
  if (n) { ar /= n; ag /= n; ab /= n; }
  const H = normal ? new Float32Array(w * h) : null;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = ((h - 1 - y) * w + x) * 4, d = (y * w + x) * 4; // flip so canvas-top is v = 1
    const a = src[s + 3];
    if (alpha && a < 250) {
      const t = a / 255;
      data[d] = mix(ar, src[s], t); data[d + 1] = mix(ag, src[s + 1], t); data[d + 2] = mix(ab, src[s + 2], t);
    } else { data[d] = src[s]; data[d + 1] = src[s + 1]; data[d + 2] = src[s + 2]; }
    data[d + 3] = alpha ? a : 255;
    if (H) H[y * w + x] = (src[s] + src[s + 1] + src[s + 2]) / 765;
  }
  const map = dataTex(data, w, h, true);
  if (alpha) { map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping; }
  return normal ? { map, normalMap: normalFromHeight(H, w, h, normal) } : map;
}

export function makeTextures() {
  const T = {};
  const c = [0, 0, 0];

  // --- ground under the grass: dark soil with green mottling
  T.grass = procedural(512, (u, v, o) => {
    const n = fbm(u * 6, v * 6, 5, 6), m = fbm(u * 40, v * 40, 3, 40);
    lerp3([0.13, 0.10, 0.06], [0.17, 0.23, 0.08], smoothstep(0.35, 0.7, n), c);
    const k = 0.65 + m * 0.7;
    o[0] = c[0] * k; o[1] = c[1] * k; o[2] = c[2] * k; o[3] = m * 0.7 + n * 0.3;
  }, 2.5);

  // --- packed earth with pebbles and fine cracks
  T.dirt = procedural(512, (u, v, o) => {
    const n = fbm(u * 5, v * 5, 5, 5), fine = fbm(u * 48, v * 48, 3, 48);
    lerp3([0.40, 0.31, 0.21], [0.56, 0.46, 0.33], n, c);
    let h = fine * 0.35 + n * 0.25, k = 0.86 + fine * 0.28;
    const crack = Math.abs(fbm(u * 9 + 3, v * 9, 4, 9) - 0.5);
    if (crack < 0.008) { k *= 0.78; h -= 0.2; }
    const w = worley(u * 26, v * 26, 26);
    const rad = 0.1 + w.id * 0.28;
    if (w.id > 0.62 && w.d1 < rad) {
      const t = 1 - w.d1 / rad, g = 0.38 + w.id * 0.2;
      lerp3(c, [g, g * 0.93, g * 0.82], smoothstep(0, 0.3, t) * 0.7, c);
      h += Math.sqrt(t) * 0.5; k = 0.92 + t * 0.12;
    }
    o[0] = c[0] * k; o[1] = c[1] * k; o[2] = c[2] * k; o[3] = h;
  }, 4);

  // --- creek bed and banks: rounded river pebbles
  const PEB = [[0.52, 0.5, 0.46], [0.4, 0.38, 0.36], [0.6, 0.55, 0.45], [0.45, 0.33, 0.26], [0.72, 0.7, 0.66], [0.3, 0.31, 0.33]];
  T.gravel = procedural(512, (u, v, o) => {
    const w = worley(u * 13, v * 13, 13), id = w.id, d1 = w.d1, edge = w.d2 - w.d1;
    const p = PEB[Math.floor(id * 5.999)];
    const s = worley(u * 44, v * 44, 44);
    const fine = fbm(u * 60, v * 60, 2, 60);
    const body = smoothstep(0.02, 0.2, edge);
    const sand = [0.34 + s.id * 0.14, 0.29 + s.id * 0.12, 0.2 + s.id * 0.1];
    lerp3(sand, p, body, c);
    const k = 0.75 + fine * 0.3 + body * (0.25 - d1 * 0.4);
    o[0] = c[0] * k; o[1] = c[1] * k; o[2] = c[2] * k;
    o[3] = body * (1 - d1 * d1) * 0.9 + (1 - body) * (1 - s.d1) * 0.25;
  }, 5);

  // --- chalk: pale stone in beds, with cracks, stains and thin bands of dark flint
  T.chalk = procedural(512, (u, v, o) => {
    const warp = fbm(u * 3, v * 3, 3, 3) * 0.08;
    const beds = fbm(u * 2, (v + warp) * 26, 3, 2, 26);
    const big = fbm(u * 3 + 9, v * 3, 4, 3), fine = fbm(u * 50, v * 50, 3, 50);
    lerp3([0.56, 0.52, 0.43], [0.8, 0.77, 0.68], beds * 0.6 + big * 0.4, c);
    let k = 0.86 + fine * 0.2, h = beds * 0.5 + fine * 0.2;
    lerp3(c, [0.46, 0.47, 0.38], smoothstep(0.55, 0.8, fbm(u * 4 + 20, v * 4, 4, 4)) * 0.55, c); // lichen and damp
    const crack = Math.abs(fbm(u * 7 + 5, v * 7, 4, 7) - 0.5);
    if (crack < 0.009) { k *= 0.74; h -= 0.5; }
    const bed = Math.abs(((v + warp * 0.6) * 5) % 1 - 0.5);
    if (bed < 0.014) { k *= 0.84; h -= 0.3; }
    const f = worley(u * 30, (v + warp * 0.6) * 30, 30);
    if (Math.abs(((v + warp * 0.6) * 5 + 0.3) % 1 - 0.5) < 0.05 && f.d1 < 0.2 && f.id > 0.6) { lerp3(c, [0.2, 0.2, 0.21], 0.7, c); h += 0.3; }
    o[0] = c[0] * k; o[1] = c[1] * k; o[2] = c[2] * k; o[3] = h;
  }, 4);

  // --- forest floor: needles, twigs and the first fallen leaves of autumn
  const LEAF = [[0.62, 0.42, 0.12], [0.55, 0.27, 0.1], [0.7, 0.55, 0.18], [0.36, 0.22, 0.1]];
  T.forest = procedural(512, (u, v, o) => {
    const n = fbm(u * 6, v * 6, 4, 6);
    const streak = fbm(u * 90 + fbm(u * 12, v * 12, 2, 12) * 6, v * 22, 2, 90, 22);
    lerp3([0.11, 0.075, 0.045], [0.25, 0.17, 0.1], n * 0.5 + streak * 0.5, c);
    lerp3(c, [0.14, 0.2, 0.07], smoothstep(0.6, 0.85, fbm(u * 5 + 7, v * 5, 4, 5)) * 0.8, c); // moss
    let h = streak * 0.6 + n * 0.3;
    const w = worley(u * 20, v * 20, 20);
    if (w.id > 0.62 && w.d1 < 0.3) { lerp3(c, LEAF[Math.floor(w.id * 97) % 4], 0.85, c); h += 0.35 * (1 - w.d1 / 0.3); }
    o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; o[3] = h;
  }, 3.5);

  // --- conifer bark: deep vertical furrows between scaly plates
  T.bark = procedural(512, (u, v, o) => {
    const warp = fbm(u * 4, v * 4, 2, 4) * 0.6;
    const f = fbm(u * 12 + warp, v * 2.2, 4, 12, 2);
    const ridge = 1 - Math.abs(2 * f - 1);
    const plates = smoothstep(0.45, 0.9, ridge);
    const scale = fbm(u * 30, v * 16, 3, 30, 16);
    lerp3([0.07, 0.055, 0.045], [0.33, 0.25, 0.19], plates * (0.6 + scale * 0.5), c);
    lerp3(c, [0.42, 0.27, 0.17], smoothstep(0.6, 0.9, scale) * plates * 0.5, c);
    lerp3(c, [0.2, 0.26, 0.12], smoothstep(0.7, 0.9, fbm(u * 3 + 11, v * 3, 3, 3)) * 0.5, c); // moss
    o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; o[3] = plates * 0.8 + scale * 0.2;
  }, 5);

  // --- birch bark: white, peeling, with dark lenticels
  T.birch = procedural(512, (u, v, o) => {
    const n = fbm(u * 3, v * 3, 4, 3), fine = fbm(u * 30, v * 60, 3, 30, 60);
    lerp3([0.74, 0.72, 0.66], [0.9, 0.88, 0.83], n * 0.5 + fine * 0.5, c);
    let h = 0.6 + fine * 0.2;
    const len = fbm(u * 5, v * 34, 3, 5, 34);
    if (len > 0.66) { lerp3(c, [0.1, 0.09, 0.08], smoothstep(0.66, 0.72, len), c); h -= 0.3; }
    const scar = fbm(u * 2 + 4, v * 5, 4, 2, 5);
    if (scar > 0.68) { lerp3(c, [0.08, 0.07, 0.06], smoothstep(0.68, 0.76, scar), c); h -= 0.4; }
    o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; o[3] = h;
  }, 3);

  // --- weathered split timber for the huts
  T.wood = procedural(512, (u, v, o) => {
    const warp = fbm(u * 3, v * 2, 3, 3, 2) * 0.5;
    const grain = fbm(u * 46 + warp * 6, v * 2 + warp, 4, 46, 2);
    const tone = fbm(u * 4 + 2, v * 1, 3, 4, 1);
    lerp3([0.2, 0.15, 0.1], [0.5, 0.4, 0.28], grain * 0.6 + tone * 0.4, c);
    lerp3(c, [0.42, 0.4, 0.37], smoothstep(0.5, 0.8, fbm(u * 6, v * 3 + 5, 3, 6, 3)) * 0.55, c); // silvered by weather
    let h = grain, k = 1;
    const crack = Math.abs(fbm(u * 14 + 1, v * 1.5, 3, 14, 1) - 0.5);
    if (crack < 0.01) { k = 0.35; h -= 0.6; }
    const w = worley(u * 5, v * 5, 5);
    if (w.id > 0.8 && w.d1 < 0.16) { k *= 0.5 + w.d1 * 3; h -= 0.2; }
    o[0] = c[0] * k; o[1] = c[1] * k; o[2] = c[2] * k; o[3] = h;
  }, 4);

  // --- stone: granite greys with cracks and lichen
  T.rock = procedural(512, (u, v, o) => {
    const n = fbm(u * 4, v * 4, 5, 4), fine = fbm(u * 50, v * 50, 3, 50);
    lerp3([0.25, 0.25, 0.25], [0.56, 0.54, 0.5], n * 0.65 + fine * 0.35, c);
    let h = n * 0.7 + fine * 0.3, k = 1;
    const crack = Math.abs(fbm(u * 6 + 8, v * 6, 4, 6) - 0.5);
    if (crack < 0.008) { k = 0.7; h -= 0.5; }
    const w = worley(u * 9, v * 9, 9);
    if (w.id > 0.7 && w.d1 < 0.33) lerp3(c, w.id > 0.88 ? [0.62, 0.5, 0.2] : [0.5, 0.55, 0.42], smoothstep(0.33, 0.2, w.d1) * 0.7, c);
    lerp3(c, [0.16, 0.24, 0.09], smoothstep(0.62, 0.8, fbm(u * 3 + 30, v * 3, 4, 3)), c); // moss
    o[0] = c[0] * k; o[1] = c[1] * k; o[2] = c[2] * k; o[3] = h;
  }, 4);

  // --- cured hide
  T.hide = procedural(256, (u, v, o) => {
    const n = fbm(u * 4, v * 4, 4, 4), fine = fbm(u * 40, v * 40, 2, 40);
    lerp3([0.42, 0.3, 0.2], [0.68, 0.55, 0.4], n * 0.7 + fine * 0.3, c);
    o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; o[3] = fine;
  }, 2);

  // --- fired clay
  T.clay = procedural(256, (u, v, o) => {
    const n = fbm(u * 3, v * 3, 4, 3), ring = fbm(u * 2, v * 40, 2, 2, 40);
    lerp3([0.42, 0.22, 0.14], [0.66, 0.4, 0.26], n * 0.6 + ring * 0.4, c);
    lerp3(c, [0.1, 0.08, 0.07], smoothstep(0.6, 0.9, fbm(u * 2 + 3, v * 2, 3, 2)) * 0.6, c); // soot
    o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; o[3] = ring;
  }, 2.5);

  // --- water ripples (normal only) and a large-scale variation map
  T.waterNormal = procedural(256, (u, v, o) => { o[0] = o[1] = o[2] = 0; o[3] = fbm(u * 5, v * 5, 4, 5); }, 6).normalMap;
  T.macro = procedural(256, (u, v, o) => { o[0] = fbm(u * 4, v * 4, 5, 4); o[1] = fbm(u * 4 + 9, v * 4 + 3, 5, 4); o[2] = fbm(u * 16, v * 16, 3, 16); o[3] = 0; }, 1).map;
  T.macro.colorSpace = THREE.NoColorSpace;

  // --- thatch: thousands of straw strands, laid in courses
  T.thatch = drawn(512, 512, (g, w, h) => {
    const r = rng(11);
    g.fillStyle = '#2c2416'; g.fillRect(0, 0, w, h);
    const cols = ['#b89a5a', '#cdb274', '#8e7848', '#a39878', '#6f5d38', '#d8c692', '#7d7361', '#94804f'];
    for (let i = 0; i < 9000; i++) {
      const x = r() * w, y = r() * h, len = 40 + r() * 110, lean = (r() - 0.5) * 9;
      g.strokeStyle = cols[Math.floor(r() * cols.length)]; g.globalAlpha = 0.5 + r() * 0.5; g.lineWidth = 0.7 + r() * 1.5;
      for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
        g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + lean, y + oy + len); g.stroke();
      }
    }
    g.globalAlpha = 1;
    for (let k = 0; k < 4; k++) { // each course is shaded where the one above overhangs it
      const y0 = (k * h) / 4, gr = g.createLinearGradient(0, y0, 0, y0 + h / 4);
      gr.addColorStop(0, 'rgba(10,7,3,0.78)'); gr.addColorStop(0.16, 'rgba(10,7,3,0.2)'); gr.addColorStop(0.5, 'rgba(0,0,0,0)');
      gr.addColorStop(0.97, 'rgba(255,240,200,0.10)'); gr.addColorStop(1, 'rgba(10,7,3,0.5)');
      g.fillStyle = gr; g.fillRect(0, y0, w, h / 4);
    }
  }, { normal: 5 });

  // --- cut-out foliage -------------------------------------------------------
  const hsl = (h, s, l) => `hsl(${h},${s}%,${l}%)`;

  // a spruce bough seen from above: twig, side twigs, needles
  T.bough = drawn(256, 512, (g, w, h) => {
    const r = rng(3);
    const needles = (x0, y0, x1, y1, len) => {
      const n = Math.floor(Math.hypot(x1 - x0, y1 - y0) / 1.6), ang = Math.atan2(y1 - y0, x1 - x0);
      for (let i = 0; i < n; i++) {
        const t = i / n, x = mix(x0, x1, t), y = mix(y0, y1, t);
        for (const s of [-1, 1]) {
          const a = ang + s * (0.75 + r() * 0.5), l = len * (0.6 + r() * 0.6);
          g.strokeStyle = hsl(98 + r() * 30, 26 + r() * 22, 9 + r() * 17); g.lineWidth = 1.2 + r();
          g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
        }
      }
    };
    const twig = (x0, y0, x1, y1, wd) => { g.strokeStyle = '#2a1d12'; g.lineWidth = wd; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
    const cx = w / 2;
    for (let y = h - 30; y > 30; y -= 20 + r() * 9) {
      const t = 1 - y / h, reach = (0.2 + 0.8 * Math.sin(Math.PI * clamp(t * 0.9 + 0.12, 0, 1))) * w * 0.47;
      for (const s of [-1, 1]) {
        const x1 = cx + s * reach * (0.75 + r() * 0.25), y1 = y - reach * (0.5 + r() * 0.3);
        needles(cx, y, x1, y1, 13); twig(cx, y, x1, y1, 2);
        const mx = mix(cx, x1, 0.5), my = mix(y, y1, 0.5);
        needles(mx, my, mx + s * reach * 0.18, my - reach * 0.4, 10);
        needles(mx, my, mx + s * reach * 0.35, my + reach * 0.08, 10);
      }
    }
    needles(cx, h, cx, 8, 15); twig(cx, h, cx, 14, 4);
  }, { alpha: true });

  // a spray of broad leaves
  const leaves = (seed, hue, hueSpread, light) => drawn(512, 512, (g, w, h) => {
    const r = rng(seed);
    g.strokeStyle = '#2b2015'; g.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const a = r() * Math.PI * 2, l = 90 + r() * 130;
      g.lineWidth = 2 + r() * 3; g.beginPath(); g.moveTo(w / 2, h / 2);
      g.quadraticCurveTo(w / 2 + Math.cos(a + 0.4) * l * 0.5, h / 2 + Math.sin(a + 0.4) * l * 0.5, w / 2 + Math.cos(a) * l, h / 2 + Math.sin(a) * l); g.stroke();
    }
    for (let i = 0; i < 520; i++) {
      const a = r() * Math.PI * 2, d = Math.pow(r(), 0.62) * 236 * (0.78 + 0.22 * Math.sin(a * 5 + seed));
      const x = w / 2 + Math.cos(a) * d, y = h / 2 + Math.sin(a) * d, len = 15 + r() * 15, wd = len * (0.36 + r() * 0.16);
      const depth = r();
      g.save(); g.translate(x, y); g.rotate(r() * Math.PI * 2);
      g.fillStyle = hsl(hue + (r() - 0.5) * hueSpread, 38 + r() * 26, light * (0.45 + depth * 0.85));
      g.beginPath(); g.moveTo(-len, 0); g.quadraticCurveTo(0, -wd * 1.25, len, 0); g.quadraticCurveTo(0, wd * 1.25, -len, 0); g.fill();
      g.strokeStyle = `rgba(230,240,170,${0.1 + depth * 0.16})`; g.lineWidth = 1; g.beginPath(); g.moveTo(-len, 0); g.lineTo(len, 0); g.stroke();
      g.restore();
    }
  }, { alpha: true });
  T.leaves = leaves(5, 92, 34, 26);        // deep summer green
  T.leavesGold = leaves(8, 52, 30, 40);    // turning: yellow and amber

  // fern frond
  T.fern = drawn(256, 512, (g, w, h) => {
    const r = rng(21), cx = w / 2;
    g.lineCap = 'round';
    for (let y = h - 10; y > 14; y -= 9) {
      const t = 1 - y / h, reach = Math.sin(Math.PI * clamp(t * 0.92 + 0.06, 0, 1)) * w * 0.46;
      for (const s of [-1, 1]) {
        g.strokeStyle = hsl(96 + r() * 20, 46 + r() * 16, 17 + r() * 15); g.lineWidth = 6.5;
        g.beginPath(); g.moveTo(cx, y); g.quadraticCurveTo(cx + s * reach * 0.6, y - reach * 0.32, cx + s * reach, y - reach * 0.18); g.stroke();
      }
    }
    g.strokeStyle = '#33401a'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, h); g.lineTo(cx, 10); g.stroke();
  }, { alpha: true });

  // waterside reeds
  T.reed = drawn(256, 512, (g, w, h) => {
    const r = rng(31);
    g.lineCap = 'round';
    for (let i = 0; i < 46; i++) {
      const x = 30 + r() * (w - 60), top = 20 + r() * 240, lean = (r() - 0.5) * 80;
      g.strokeStyle = hsl(62 + r() * 34, 26 + r() * 24, 20 + r() * 26); g.lineWidth = 1.6 + r() * 2.2;
      g.beginPath(); g.moveTo(x, h); g.quadraticCurveTo(x + lean * 0.2, (h + top) / 2, x + lean, top); g.stroke();
      if (r() > 0.86) { g.strokeStyle = '#4a2f1b'; g.lineWidth = 6; g.beginPath(); g.moveTo(x + lean, top + 6); g.lineTo(x + lean * 0.93, top + 52); g.stroke(); }
    }
  }, { alpha: true });

  // meadow flowers: three stems of daisies (tinted per plant)
  T.flower = drawn(128, 256, (g, w, h) => {
    const r = rng(41);
    for (const [x, top] of [[40, 40], [84, 26], [62, 80]]) {
      g.strokeStyle = '#3d5a22'; g.lineWidth = 3; g.beginPath(); g.moveTo(64, h); g.quadraticCurveTo(64, 150, x, top); g.stroke();
      for (let i = 0; i < 11; i++) {
        const a = (i / 11) * Math.PI * 2 + r();
        g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(x + Math.cos(a) * 11, top + Math.sin(a) * 11, 9, 4.2, a, 0, 7); g.fill();
      }
      g.fillStyle = '#e8b62c'; g.beginPath(); g.arc(x, top, 6, 0, 7); g.fill();
    }
  }, { alpha: true });

  // a whole spruce, for the far forest
  T.farTree = drawn(256, 512, (g, w, h) => {
    const r = rng(51), cx = w / 2;
    g.fillStyle = '#2a1d14'; g.fillRect(cx - 5, h * 0.55, 10, h * 0.45);
    for (let y = h * 0.93; y > 6; y -= 5) {
      const t = 1 - y / h, half = (1 - t) * w * 0.44 * (0.72 + 0.28 * Math.sin(y * 0.21)) + 3;
      for (let i = 0; i < 26; i++) {
        const x = cx + (r() * 2 - 1) * half, sunny = (cx - x) / half;
        g.strokeStyle = hsl(100 + r() * 24, 24 + r() * 18, 9 + r() * 9 + sunny * 6); g.lineWidth = 2.5;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + (x - cx) * 0.12, y + 9 + r() * 8); g.stroke();
      }
    }
  }, { alpha: true });

  // a stretched animal hide, cut out
  T.pelt = drawn(256, 256, (g, w, h) => {
    const r = rng(71);
    const o = new Path2D();
    const pts = [[128, 14], [158, 34], [228, 22], [236, 50], [196, 78], [204, 170], [240, 214], [222, 240], [170, 206], [128, 232], [86, 206], [34, 240], [16, 214], [52, 170], [60, 78], [20, 50], [28, 22], [98, 34]];
    pts.forEach(([x, y], i) => { const a = pts[(i + 1) % pts.length]; if (!i) o.moveTo((x + a[0]) / 2, (y + a[1]) / 2); o.quadraticCurveTo(a[0], a[1], (a[0] + pts[(i + 2) % pts.length][0]) / 2, (a[1] + pts[(i + 2) % pts.length][1]) / 2); });
    o.closePath(); g.save(); g.clip(o);
    const gr = g.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, '#b08a5e'); gr.addColorStop(0.5, '#7c5a3a'); gr.addColorStop(1, '#b08a5e');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${r() > 0.5 ? '60,40,24' : '215,185,140'},${0.03 + r() * 0.06})`; g.beginPath(); g.arc(r() * w, r() * h, 1 + r() * 5, 0, 7); g.fill(); }
    g.restore(); g.strokeStyle = 'rgba(50,34,20,0.7)'; g.lineWidth = 4; g.stroke(o);
  }, { alpha: true });

  // soft round puff for smoke, mist and motes
  T.puff = drawn(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const r = rng(61);
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 40; i++) { g.globalAlpha = 0.08; g.beginPath(); g.arc(r() * w, r() * h, 6 + r() * 16, 0, 7); g.fill(); }
  }, { alpha: true });

  return T;
}
