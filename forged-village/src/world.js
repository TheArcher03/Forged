// FORGED — Stone Age village. The shape of the land: heights, surfaces, building
// spots and collisions. No rendering in here.
// Units: 1 unit = 1 metre. The road runs along +Z from the ford (z = 0) to the
// workshop (z = 60). Facing up the street, LEFT is +X and RIGHT is -X.
import { fbm, clamp, smoothstep, mix, rng } from './noise.js';
export { clamp, smoothstep, mix, rng };

export const WATER_LEVEL = -0.1;
export const PLAYER_RADIUS = 0.35;
export const BOUNDS = { minX: -21, maxX: 21, minZ: -4.6 };
export const START = { x: 0.9, z: -0.2, yaw: Math.PI };

// Low golden sun. It shines up the creek opening behind the player's right shoulder.
const sl = Math.hypot(-0.6, 0.42, -0.68);
export const SUN_DIR = { x: -0.6 / sl, y: 0.42 / sl, z: -0.68 / sl };

export const WORKSHOP = { key: 'workshop', x: 0, z: 60, r: 5.25, wallH: 2.4, peak: 7.2, openHalfAngle: Math.PI / 3 };
export const HOUSES = [
  { key: 'hide',   x:  11,   z: 16, r: 3.5, wallH: 1.7, peak: 6.0 },
  { key: 'clay',   x: -11,   z: 26, r: 4.0, wallH: 1.7, peak: 6.4 },
  { key: 'hearth', x:  12.5, z: 42, r: 4.5, wallH: 1.8, peak: 6.9 },
];
export const FIRE = { x: 0, z: 32, ringR: 1.1, plazaR: 5.0 };
export const STANDING_STONE = { x: -3.6, z: 33.4, w: 0.9, d: 0.5, h: 3.2 };
export const TEST_YARD = { x: 0, z: 72.5, half: 6 };
export const KILN = { x: -6.1, z: 20.3 };   // the Clay House's pit kiln
export const OVEN = { x: 5.3, z: 46.9 };    // the Hearth House's clay oven, set back from its doorway
// Ground kept bare around fires, so grass doesn't grow through them.
export const CLEARINGS = [{ x: KILN.x, z: KILN.z, r: 2.0 }, { x: OVEN.x, z: OVEN.z, r: 1.9 }];

export const STEPPING_STONES = [
  { x: -1.3, z: -2.0, r: 0.45 }, { x: -1.0, z: -1.1, r: 0.5 }, { x: -1.4, z: -0.2, r: 0.42 },
  { x: -0.9, z:  0.7, r: 0.5 },  { x: -1.3, z:  1.6, r: 0.45 }, { x: -0.9, z: 2.4, r: 0.4 },
].map((s) => ({ ...s, top: WATER_LEVEL + 0.13 }));

export const BOULDERS = [
  { x: -22.3, z: -3.4, r: 1.5 }, { x: -22.6, z: -1.6, r: 1.7 }, { x: -22.2, z: 0.2, r: 1.4 },
  { x:  22.4, z:  0.4, r: 1.6 }, { x:  22.7, z: 2.2, r: 1.8 }, { x: 22.2, z: 3.9, r: 1.4 },
];

export const roadX = (z) => 0.8 * Math.sin(z * 0.11) + 0.35 * Math.sin(z * 0.31 + 1.3);
export const roadHalfWidth = (z) => 1.6 + 0.22 * Math.sin(z * 0.9) + 0.12 * Math.sin(z * 2.3);
export const creekZ = (x) => 0.9 * Math.sin(x * 0.12) + 0.5 * Math.sin(x * 0.045 + 2);
export const creekHalfWidth = (x) => 2.3 + 0.9 * Math.sin(x * 0.19 + 1) + 0.4 * Math.sin(x * 0.53);
export const cliffEdge = (x) => 80.5 + 1.4 * Math.sin(x * 0.21) + 0.6 * Math.sin(x * 0.67) + 0.5 * Math.sin(x * 1.9);
export const CLIFF_H = 10;

const streetRise = (z) => 2 * smoothstep(4, 58, z);

// How much a spot lies in the "sun gap": the open side of the valley the low sun shines through.
export function sunGap(x, z) {
  const dx = x, dz = z - 30, d = Math.hypot(dx, dz) || 1;
  const hl = Math.hypot(SUN_DIR.x, SUN_DIR.z);
  return smoothstep(0.78, 0.96, (dx * SUN_DIR.x + dz * SUN_DIR.z) / (d * hl));
}

const PADS = [
  ...HOUSES.map((b) => ({ x: b.x, z: b.z, r: b.r + 1.2 })),
  { x: WORKSHOP.x, z: WORKSHOP.z, r: WORKSHOP.r + 1.5 },
  { x: TEST_YARD.x, z: TEST_YARD.z, r: TEST_YARD.half * 1.3 },
  { x: FIRE.x, z: FIRE.z, r: 3 },
].map((p) => ({ ...p, h: streetRise(p.z) }));

export function terrainHeight(x, z) {
  let h = streetRise(z) + (fbm(x * 0.07, z * 0.07, 3) - 0.5) * 0.7;
  h -= 0.08 * smoothstep(1.2, 0, Math.abs(x - roadX(z)) - roadHalfWidth(z)) * smoothstep(0, 3, z) * smoothstep(58, 55, z);

  for (const p of PADS) {
    const d = Math.hypot(x - p.x, z - p.z);
    if (d < p.r + 4) h = mix(h, p.h, smoothstep(p.r + 4, p.r, d));
  }

  const gap = sunGap(x, z), open = 1 - 0.72 * gap;
  const rough = fbm(x * 0.045 + 40, z * 0.045, 3) - 0.5;

  const side = Math.abs(x) - 19.5 - rough * 2.5;
  if (side > 0) h += (9 * (1 - Math.exp(-side / 6)) + side * 0.12) * open;

  const south = -3.8 - z - rough * 2;
  if (south > 0) h += (8 * (1 - Math.exp(-south / 7)) + south * 0.1) * open;

  const e = cliffEdge(x);
  h += CLIFF_H * smoothstep(e - 0.2, e + 2.6, z) * (0.85 + 0.3 * fbm(x * 0.1, 3, 2));
  if (z > e + 2.6) h += (z - e - 2.6) * 0.08;

  // Bigger hills far from the street, so the valley sits inside real country.
  const far = Math.max(Math.abs(x) - 45, -30 - z, z - 105, 0);
  if (far > 0) h += smoothstep(0, 130, far) * (18 + 70 * fbm(x * 0.009 + 5, z * 0.009, 4)) * (1 - 0.85 * gap);

  const dz = (z - creekZ(x)) / creekHalfWidth(x);
  const depth = 0.42 + 0.22 * Math.sin(x * 0.31) * Math.sin(x * 0.13 + 1);
  h = Math.min(h, -depth + depth * dz * dz);
  return h;
}

export function groundHeight(x, z) {
  let h = terrainHeight(x, z);
  for (const s of STEPPING_STONES) if (Math.hypot(x - s.x, z - s.z) < s.r) h = Math.max(h, s.top);
  return h;
}

function distToSegment(px, pz, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az;
  const t = clamp(((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz), 0, 1);
  return Math.hypot(px - (ax + vx * t), pz - (az + vz * t));
}
export function doorOf(b) {
  const dir = Math.sign(roadX(b.z) - b.x);
  return { x: b.x + dir * b.r, z: b.z, dir };
}
// 0 = untouched ground, 1 = bare packed earth (road, plaza, door paths, aprons).
export function dirtAmount(x, z) {
  const wob = (fbm(x * 0.8, z * 0.8, 2) - 0.5) * 1.3;
  let a = 0;
  if (z > 1.0 && z < 57) a = Math.max(a, smoothstep(0.9, -0.3, Math.abs(x - roadX(z)) - roadHalfWidth(z) + wob));
  a = Math.max(a, smoothstep(1.0, -0.4, Math.hypot(x - FIRE.x, z - FIRE.z) - FIRE.plazaR + wob));
  for (const c of CLEARINGS) a = Math.max(a, smoothstep(0.7, -0.3, Math.hypot(x - c.x, z - c.z) - c.r + wob));
  for (const c of tableSpots()) a = Math.max(a, 0.85 * smoothstep(0.7, -0.3, Math.hypot(x - c.x, z - c.z) - c.r + wob));   // trodden ground round each trading table
  for (const b of HOUSES) {
    a = Math.max(a, smoothstep(0.8, -0.2, Math.hypot(x - b.x, z - b.z) - (b.r + 0.7) + wob));
    const d = doorOf(b);
    a = Math.max(a, smoothstep(0.7, -0.2, distToSegment(x, z, d.x, d.z, roadX(b.z), b.z) - 0.8 + wob));
  }
  a = Math.max(a, smoothstep(1.0, -0.4, Math.hypot(x - WORKSHOP.x, z - WORKSHOP.z) - (WORKSHOP.r + 1.8) + wob));
  const ty = Math.max(Math.abs(x - TEST_YARD.x), Math.abs(z - TEST_YARD.z)) - TEST_YARD.half;
  a = Math.max(a, 0.75 * smoothstep(0.8, -0.6, ty + wob));
  a = Math.max(a, smoothstep(0.7, -0.2, distToSegment(x, z, 7.6, 58, 4.5, 68) - 0.7 + wob));
  return a;
}

export function surfaceAt(x, z) {
  for (const s of STEPPING_STONES) if (Math.hypot(x - s.x, z - s.z) < s.r) return 'stone';
  if (terrainHeight(x, z) < WATER_LEVEL && Math.abs(z - creekZ(x)) < 4) return 'water';
  if (Math.hypot(x - WORKSHOP.x, z - WORKSHOP.z) < WORKSHOP.r - 0.2) return 'flakes';
  return dirtAmount(x, z) > 0.5 ? 'dirt' : 'grass';
}

const wsEdge = (sign) => {
  const a = Math.PI + sign * WORKSHOP.openHalfAngle;
  return { x: WORKSHOP.x + Math.sin(a) * WORKSHOP.r, z: WORKSHOP.z + Math.cos(a) * WORKSHOP.r, r: 0.3 };
};
export const WORKSHOP_POSTS = [wsEdge(-1), wsEdge(1)];

export const CIRCLES = [
  ...HOUSES.map((b) => ({ x: b.x, z: b.z, r: b.r + 0.25 })),
  { x: FIRE.x, z: FIRE.z, r: FIRE.ringR + 0.25 },
  { x: STANDING_STONE.x, z: STANDING_STONE.z, r: 0.6 },
  ...BOULDERS,
  ...WORKSHOP_POSTS,
];

const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export function resolveCollisions(pos) {
  for (let pass = 0; pass < 2; pass++) {
    for (const c of CIRCLES) {
      const dx = pos.x - c.x, dz = pos.z - c.z, d = Math.hypot(dx, dz), min = c.r + PLAYER_RADIUS;
      if (d < min && d > 1e-6) { pos.x = c.x + (dx / d) * min; pos.z = c.z + (dz / d) * min; }
    }
    const dx = pos.x - WORKSHOP.x, dz = pos.z - WORKSHOP.z, d = Math.hypot(dx, dz);
    const inGap = Math.abs(wrapAngle(Math.atan2(dx, dz) - Math.PI)) < WORKSHOP.openHalfAngle;
    const pad = PLAYER_RADIUS + 0.2;
    if (!inGap && d > 1e-6 && Math.abs(d - WORKSHOP.r) < pad) {
      const target = d < WORKSHOP.r ? WORKSHOP.r - pad : WORKSHOP.r + pad;
      pos.x = WORKSHOP.x + (dx / d) * target; pos.z = WORKSHOP.z + (dz / d) * target;
    }
    pos.x = clamp(pos.x, BOUNDS.minX, BOUNDS.maxX);
    pos.z = clamp(pos.z, BOUNDS.minZ, cliffEdge(pos.x) - 1.5);
  }
  return pos;
}
// Where each building can be entered: (x, z) is where you stand, (fx, fz) is the doorway itself.
export const DOORS = [
  ...HOUSES.map((b) => { const d = doorOf(b); return { key: b.key, x: b.x + d.dir * (b.r + 1.0), z: b.z, fx: b.x + d.dir * b.r, fz: b.z, reach: 2.4 }; }),
  { key: 'workshop', x: WORKSHOP.x, z: WORKSHOP.z - 3.6, fx: WORKSHOP.x, fz: WORKSHOP.z - 1.4, reach: 3.4 },
];

// A clear line of sight along the near (village-side) bank to the heron fishing past the
// western boulders. Nothing tall is planted here.
export const heronView = (x, z) => x > -36 && x < -11 && z > creekZ(x) + 0.5 && z < creekZ(x) + 7.5;

// Each family's trading table: beside its doorway, off the path. side = which side of the path.
export const TRADE = { hide: { side: -1 }, hearth: { side: 1 }, clay: { side: -1 } };
// The doorway's local frame: n = out from the wall, h = height, t = along the wall.
export function doorFrame(b) {
  const dir = doorOf(b).dir, y0 = terrainHeight(b.x, b.z);
  return { dir, y0, at: (n, h, t) => ({ x: b.x + dir * (b.r + n), y: y0 + h, z: b.z + t * dir }) };
}

// Bare, trodden ground round each trading table and on the path side where you stand to trade.
let _tables = null;
function tableSpots() {
  if (!_tables) _tables = HOUSES.map((b) => { const f = doorFrame(b), s = TRADE[b.key].side, c = f.at(2.1, 0, s * 1.75); return { x: c.x, z: c.z, r: 1.45 }; });
  return _tables;
}

export const insideWorkshop = (x, z) => Math.hypot(x - WORKSHOP.x, z - WORKSHOP.z) < WORKSHOP.r;
