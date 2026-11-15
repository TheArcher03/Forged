// Small deterministic noise toolkit used for the land, the textures and scattering.
function h2(ix, iy) {
  let n = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
const wrap = (i, p) => (p ? ((i % p) + p) % p : i);
export const hash2 = h2;

// Value noise. px/py make it tile every px/py lattice cells (0 = no tiling).
export function vnoise(x, y, px = 0, py = px) {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = h2(wrap(x0, px), wrap(y0, py)), b = h2(wrap(x0 + 1, px), wrap(y0, py));
  const c = h2(wrap(x0, px), wrap(y0 + 1, py)), d = h2(wrap(x0 + 1, px), wrap(y0 + 1, py));
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
export function fbm(x, y, oct = 4, px = 0, py = px) {
  let amp = 0.5, sum = 0, norm = 0, f = 1;
  for (let i = 0; i < oct; i++) {
    sum += amp * vnoise(x * f + i * 17.3, y * f + i * 9.1, px * f, py * f);
    norm += amp; amp *= 0.5; f *= 2;
  }
  return sum / norm;
}
// Cellular noise: distance to nearest and second-nearest feature point, plus the cell's random id.
const wOut = { d1: 0, d2: 0, id: 0 };
export function worley(x, y, px = 0, py = px) {
  const xi = Math.floor(x), yi = Math.floor(y);
  let d1 = 9, d2 = 9, id = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = xi + i, cy = yi + j, wx = wrap(cx, px), wy = wrap(cy, py);
    const ox = cx + h2(wx, wy + 131), oy = cy + h2(wx + 71, wy);
    const d = Math.hypot(x - ox, y - oy);
    if (d < d1) { d2 = d1; d1 = d; id = h2(wx + 13, wy + 57); } else if (d < d2) d2 = d;
  }
  wOut.d1 = d1; wOut.d2 = d2; wOut.id = id;
  return wOut;
}
export function rng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const smoothstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const mix = (a, b, t) => a + (b - a) * t;
