/* FORGED: Strike test
 * A throwaway prototype of one moment: striking flint. Buy a stone, rough it out,
 * thin it as far as you dare, set it down. The question: do you feel "one more hit?"
 *
 * Plain JavaScript, no build step, no downloaded assets. Every sound is synthesized
 * with the Web Audio API and every sound has a visual cue, so it plays muted.
 * Press ` (backtick) for the debug panel.
 */
'use strict';

// =====================================================================================
// CONFIG — every number that shapes the game. The debug panel edits these live.
// =====================================================================================
const CONFIG = {
  startBeads: 10,             // shell beads at the start of a session
  stoneCost: 3,               // beads per flint nodule

  roughOutStrikes: 3,         // hammerstone strikes to turn a nodule into a blank
  maxThinStrikes: 6,          // antler-billet strikes allowed while thinning

  strengthStart: 25,          // Strength out of 25
  roughBadStrikePenalty: 1,   // Strength lost per bad rough-out strike
  thinMistimePenalty: 2,      // Strength lost per mistimed thinning strike

  // Index = thinning strikes already done.
  sharpnessCeiling: [10, 13, 16, 19, 21, 23, 25],   // out of 25
  snapChance: [0.02, 0.05, 0.10, 0.18, 0.30, 0.45], // chance the NEXT strike snaps it
  mistimeSnapMultiplier: 2,   // a mistimed thinning strike doubles its snap chance
  flawedStoneSnapBonus: 0.10, // a flawed stone adds this to every snap chance

  timingWindow: 0.13,         // seconds either side of the ring meeting the band (forgiving to start)
  ringCloseTime: 1.0,         // seconds from pressing to the ring reaching the band
  aimTolerance: 22,           // pixels beyond the band's edges that still count as on it
  bandHalfSpan: 0.36,         // how far the band runs along the edge, in radians either side

  beadsFloor: 30,             // beads earned = round((quality - beadsFloor) / beadsDivisor), min beadsMinimum
  beadsDivisor: 2,
  beadsMinimum: 1,
};

// =====================================================================================
// SOUND — short synthesized tones. Nothing is loaded from disk.
// =====================================================================================
const Sound = (() => {
  let ctx = null, out = null, noise = null, muted = false;
  const LEVEL = 0.75;

  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      out = ctx.createGain();
      out.gain.value = muted ? 0 : LEVEL;
      const comp = ctx.createDynamicsCompressor();
      out.connect(comp); comp.connect(ctx.destination);
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function envelope(g, t, peak, attack, decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }
  // A struck, ringing body: a few sine partials, the higher ones dying faster.
  function ring(freq, ratios, amps, decay, peak, delay = 0) {
    const c = ac(); if (!c) return;
    const t = c.currentTime + delay;
    ratios.forEach((r, i) => {
      const o = c.createOscillator(), g = c.createGain();
      o.frequency.value = freq * r;
      envelope(g, t, peak * amps[i], 0.003, decay / (1 + i * 0.7));
      o.connect(g); g.connect(out); o.start(t); o.stop(t + decay + 0.1);
    });
  }
  // A filtered burst of noise: clicks, thuds and cracks.
  function burst(dur, type, freq, q, peak, delay = 0) {
    const c = ac(); if (!c) return;
    const t = c.currentTime + delay;
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = noise; f.type = type; f.frequency.value = freq; f.Q.value = q;
    envelope(g, t, peak, 0.002, dur);
    s.connect(f); f.connect(g); g.connect(out);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  return {
    unlock: ac,
    get muted() { return muted; },
    toggle() { muted = !muted; if (out) out.gain.value = muted ? 0 : LEVEL; return muted; },
    // Tapping a nodule: sound flint rings on; flawed flint gives a short, dull knock.
    tap(pitch, flawed) {
      if (!flawed) {
        burst(0.015, 'highpass', 3000, 0.7, 0.35);
        ring(pitch, [1, 2.41, 4.53], [1, 0.45, 0.2], 0.55, 0.28);
      } else {
        burst(0.05, 'lowpass', 650, 0.9, 0.55);
        ring(pitch * 0.97, [1, 2.25, 4.1], [1, 0.35, 0.12], 0.17, 0.2);
      }
    },
    strike(good, pitch) {
      if (good) {
        burst(0.03, 'bandpass', 3200, 1.2, 0.6);
        ring(pitch, [1, 2.63, 5.1], [1, 0.4, 0.18], 0.7, 0.32);
        ring(pitch * 3.9, [1], [1], 0.08, 0.08, 0.01);
      } else {
        burst(0.09, 'lowpass', 420, 0.8, 0.8);
        ring(pitch * 0.62, [1, 2.08], [1, 0.3], 0.11, 0.14);
      }
    },
    snap() {
      burst(0.07, 'highpass', 1700, 0.6, 0.9);
      burst(0.3, 'lowpass', 260, 0.7, 0.6, 0.015);
      ring(2300, [1, 1.47], [0.6, 0.4], 0.06, 0.22);
      burst(0.05, 'highpass', 2200, 0.6, 0.5, 0.09);
    },
    clink(n) {
      for (let i = 0; i < Math.min(n, 8); i++) ring(2350 + Math.random() * 500, [1, 2.7], [1, 0.35], 0.2, 0.12, i * 0.075);
    },
  };
})();

// =====================================================================================
// SHAPES — every stone is a radius for each of N directions around its centre.
// Angle 0 points right, PI/2 points down the screen. A blank's long axis runs up and down.
// =====================================================================================
const TAU = Math.PI * 2, N = 144;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const ease = (t) => t * t * (3 - 2 * t);

function seeded(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function noduleShape(seed) {
  const r = seeded(seed), ph = [r() * TAU, r() * TAU, r() * TAU, r() * TAU];
  const k = [0.08 + r() * 0.07, 0.05 + r() * 0.05, 0.03 + r() * 0.03, 0.015 + r() * 0.015];
  const tall = 1.18 + r() * 0.22, out = new Float32Array(N);
  let max = 0;
  for (let i = 0; i < N; i++) {
    const t = (i / N) * TAU;
    let v = 1 + k[0] * Math.sin(2 * t + ph[0]) + k[1] * Math.sin(3 * t + ph[1]) + k[2] * Math.sin(5 * t + ph[2]) + k[3] * Math.sin(9 * t + ph[3]);
    v /= Math.sqrt(Math.cos(t) ** 2 + (Math.sin(t) / tall) ** 2); // a little taller than wide
    out[i] = v; max = Math.max(max, v);
  }
  for (let i = 0; i < N; i++) out[i] = (out[i] / max) * 1.08;
  return out;
}

// A rough leaf: pointed at the top, a little fuller toward the butt at the bottom.
function leafShape() {
  const L = 1.1, Wd = 0.5;
  const inside = (x, y) => {
    if (Math.abs(y) >= L) return false;
    const u = y / L;
    return Math.abs(x) < Wd * Math.pow(1 - u * u, 0.72) * (1 + 0.16 * u);
  };
  const out = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const t = (i / N) * TAU, c = Math.cos(t), s = Math.sin(t);
    let lo = 0, hi = 1.3;
    for (let k = 0; k < 22; k++) { const m = (lo + hi) / 2; if (inside(c * m, s * m)) lo = m; else hi = m; }
    out[i] = lo;
  }
  return out;
}
const LEAF = leafShape();

function radiusAt(shape, ang) {
  const f = ((((ang / TAU) * N) % N) + N) % N, i0 = Math.floor(f), i1 = (i0 + 1) % N;
  return lerp(shape[i0], shape[i1], f - i0);
}
function dent(shape, ang, width, depth) {
  for (let i = 0; i < N; i++) {
    const d = wrapAngle((i / N) * TAU - ang);
    shape[i] = Math.max(0.12, shape[i] - depth * Math.exp(-((d / width) ** 2)));
  }
}
function tracePath(ctx, shape, cx, cy, s) {
  ctx.beginPath();
  for (let i = 0; i < N; i++) {
    const t = (i / N) * TAU, r = shape[i] * s, x = cx + Math.cos(t) * r, y = cy + Math.sin(t) * r;
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.closePath();
}
function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (p, sh) => (p >> sh) & 255;
  const m = (sh) => Math.round(lerp(ch(pa, sh), ch(pb, sh), t));
  return `rgb(${m(16)},${m(8)},${m(0)})`;
}

// =====================================================================================
// GAME STATE
// =====================================================================================
const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
const $ = (id) => document.getElementById(id);
const ui = { beads: $('beads'), best: $('best'), title: $('phase-title'), help: $('phase-help'), panel: $('panel'), cardWrap: $('card-wrap'), card: $('card'), debug: $('debug'), mute: $('mute') };

let W = 0, H = 0, DPR = 1;
const now = () => performance.now() / 1000;

const game = {
  phase: 'buy',          // buy | rough | thin | snapping | result | snapped | summary
  beads: CONFIG.startBeads,
  best: 0,
  stones: [], selected: -1,
  cur: null,             // the stone being worked
  rejects: [],           // snapped blanks on the pile
  fx: [],                // things on screen that come and go
  hold: null,            // { t0 } while the button is held
  pointer: { x: -999, y: -999, seen: false },
  cooldownUntil: 0,
  result: null, snapInfo: null,
  session: { made: 0, snapped: 0, earned: 0, bought: 0 },
  stats: { made: 0, snapped: 0, strikes: 0, worked: 0, thinOnMade: 0 },   // debug: since the page loaded
};

// ---------- layout: where things sit for the current window size ----------
function layout() {
  const p = ui.panel.getBoundingClientRect();
  const panelTop = ui.panel.childElementCount ? p.top : H;
  const top = 88, bottom = panelTop - 14;
  const availH = Math.max(140, bottom - top);
  const s = Math.max(40, Math.min(W * 0.26, availH * 0.41));
  return { cx: W / 2, cy: top + availH / 2, s, bottom };
}

// =====================================================================================
// PHASES
// =====================================================================================
function newStones() {
  game.stones = [0, 1, 2].map(() => {
    const seed = (Math.random() * 1e9) | 0;
    return { seed, shape: noduleShape(seed), flawed: false, pitch: 1180 * (0.9 + Math.random() * 0.2), tone: Math.random() };
  });
  game.stones[(Math.random() * 3) | 0].flawed = true;   // exactly one is flawed
  game.selected = -1;
}

function goBuy() {
  game.cur = null; game.hold = null; game.result = null; game.snapInfo = null;
  if (game.beads < CONFIG.stoneCost) return goSummary();
  game.phase = 'buy';
  newStones();
  render();
}

function buy() {
  const st = game.stones[game.selected];
  if (!st || game.phase !== 'buy' || game.beads < CONFIG.stoneCost) return;
  game.beads -= CONFIG.stoneCost;
  game.session.bought++;
  Sound.clink(3);
  floatAt(ui.beads, `−${CONFIG.stoneCost}`, 'var(--bad)');
  game.cur = {
    flawed: st.flawed, tone: st.tone,
    shape: Float32Array.from(st.shape),
    strength: CONFIG.strengthStart,
    roughDone: 0, thinDone: 0, strikes: 0, mistimes: 0,
    scars: [], thinScars: [], stress: [],
    band: { ang: Math.random() * TAU },
    morph: null,
  };
  game.phase = 'rough';
  game.cooldownUntil = now() + 0.25;
  render();
}

function setDown() {
  const c = game.cur;
  if (!c || game.phase !== 'thin') return;
  const sharp = CONFIG.sharpnessCeiling[c.thinDone];
  const quality = c.strength + sharp;
  const earned = Math.max(CONFIG.beadsMinimum, Math.round((quality - CONFIG.beadsFloor) / CONFIG.beadsDivisor));
  const prevBest = game.best, isNew = prevBest > 0 && quality > prevBest;
  game.best = Math.max(game.best, quality);
  game.beads += earned;
  game.session.made++; game.session.earned += earned;
  Object.assign(game.stats, { made: game.stats.made + 1, worked: game.stats.worked + 1, strikes: game.stats.strikes + c.strikes, thinOnMade: game.stats.thinOnMade + c.thinDone });
  game.result = { strength: c.strength, sharp, quality, earned, isNew, first: prevBest === 0, flawed: c.flawed, thinDone: c.thinDone };
  Sound.clink(earned);
  floatAt(ui.beads, `+${earned}`, 'var(--good)');
  game.phase = 'result';
  render();
}

function goSummary() { game.phase = 'summary'; game.hold = null; render(); }

function restart() {
  game.beads = CONFIG.startBeads; game.best = 0; game.rejects = []; game.fx = [];
  game.session = { made: 0, snapped: 0, earned: 0, bought: 0 };
  goBuy();
}

// =====================================================================================
// STRIKING
// The pale band sits just inside the stone's edge. Holding the button raises the tool,
// and a ring centred on the stone closes in from outside; releasing as the ring crosses
// the band is good timing. The band's thickness IS the timing window.
// =====================================================================================
function bandGeometry(L = layout()) {
  const c = game.cur;
  const edge = radiusAt(c.shape, c.band.ang) * L.s;
  const T = CONFIG.ringCloseTime, w = Math.min(CONFIG.timingWindow, T * 0.6);
  const rStart = edge + L.s;                                   // the ring starts one stone-width outside the edge
  const halfT = (w * (rStart - edge + 3)) / (T - w);           // solved so that band thickness = timing window
  const rb = Math.max(halfT * 0.5 + 4, edge - halfT - 3);
  const speed = (rStart - rb) / T;
  return { L, edge, rb, halfT, rStart, speed, ang: c.band.ang };
}
const ringRadius = (g, held) => Math.max(3, g.rStart - g.speed * held);

function onBand(g, x, y) {
  const dx = x - g.L.cx, dy = y - g.L.cy, d = Math.hypot(dx, dy);
  const angTol = CONFIG.bandHalfSpan + CONFIG.aimTolerance / Math.max(g.rb, 20);
  return Math.abs(wrapAngle(Math.atan2(dy, dx) - g.ang)) <= angTol && Math.abs(d - g.rb) <= g.halfT + CONFIG.aimTolerance;
}

function canStrike() {
  const c = game.cur;
  if (!c || c.morph || now() < game.cooldownUntil) return false;
  if (game.phase === 'rough') return true;
  return game.phase === 'thin' && c.thinDone < CONFIG.maxThinStrikes;
}

function startHold(x, y) {
  if (!canStrike()) return;
  const L = layout(), d = Math.hypot(x - L.cx, y - L.cy);
  if (d > L.s * 1.9) return;                                    // presses far from the stone are ignored
  game.hold = { t0: now() };
}

function releaseHold(x, y) {
  const h = game.hold; game.hold = null;
  if (!h || !canStrike()) return;
  const g = bandGeometry(), held = now() - h.t0, r = ringRadius(g, held);
  const timed = Math.abs(r - g.rb) <= g.halfT;
  const aimed = onBand(g, x, y);
  const good = timed && aimed;
  const why = good ? '' : !aimed ? 'Off the band' : r > g.rb ? 'Too early' : 'Too late';
  const ang = aimed ? g.ang : Math.atan2(y - g.L.cy, x - g.L.cx);
  game.cur.strikes++;
  game.cooldownUntil = now() + 0.3;
  game.fx.push(swingFx(x, y, game.phase === 'rough' ? 'hammer' : 'billet'));
  if (game.phase === 'rough') roughStrike(good, ang, why, g);
  else thinStrike(good, ang, why, g);
}

function pickBand(prev) {
  const c = game.cur;
  for (let k = 0; k < 40; k++) {
    const a = game.phase === 'thin'
      ? (Math.random() < 0.5 ? 0 : Math.PI) + (Math.random() * 2 - 1) * 0.75   // along the long edges, not the tips
      : Math.random() * TAU;
    if (prev === undefined || Math.abs(wrapAngle(a - prev)) > (game.phase === 'thin' ? 0.55 : 1.1)) { c.band.ang = a; return; }
  }
  c.band.ang = wrapAngle((prev ?? 0) + Math.PI);
}

function roughStrike(good, ang, why, g) {
  const c = game.cur, L = g.L;
  c.roughDone++;
  if (good) {
    dent(c.shape, ang, 0.36, 0.13);
    c.scars.push({ ang, w: 0.36, depth: 0.13 });
    Sound.strike(true, 760 + c.roughDone * 45);
    flakeFx(ang, L, true);
    textFx('Clean flake', ang, L, '#f0e2b8');
  } else {
    dent(c.shape, ang, 0.15, 0.05);
    c.scars.push({ ang, w: 0.15, depth: 0.05 });
    c.strength = Math.max(0, c.strength - CONFIG.roughBadStrikePenalty);
    Sound.strike(false, 760);
    flakeFx(ang, L, false);
    textFx(`${why} · stubby chip · −${CONFIG.roughBadStrikePenalty} strength`, ang, L, '#e3a08f');
  }
  if (c.roughDone >= CONFIG.roughOutStrikes) {
    // the nodule becomes a blank: a rough leaf, keeping a little of the scarring
    const to = new Float32Array(N), scale = 0.97;
    const lost = new Float32Array(N);
    for (let i = 0; i < N; i++) lost[i] = 0;
    for (const s of c.scars) for (let i = 0; i < N; i++) {
      const d = wrapAngle((i / N) * TAU - s.ang);
      lost[i] += s.depth * 0.35 * Math.exp(-((d / s.w) ** 2));
    }
    for (let i = 0; i < N; i++) to[i] = Math.max(0.1, LEAF[i] * scale - lost[i] * 0.5);
    c.morph = { t0: now() + 0.35, from: Float32Array.from(c.shape), to };
  } else {
    pickBand(ang);
  }
  render();
}

function currentSnapChance(mistimed) {
  const c = game.cur;
  const base = CONFIG.snapChance[c.thinDone] ?? 1;
  const withFlaw = base + (c.flawed ? CONFIG.flawedStoneSnapBonus : 0);
  return clamp(withFlaw * (mistimed ? CONFIG.mistimeSnapMultiplier : 1), 0, 1);
}

function thinStrike(good, ang, why, g) {
  const c = game.cur, L = g.L;
  const chance = currentSnapChance(!good);
  if (Math.random() < chance) return startSnap(ang, chance, good, why);

  c.thinDone++;
  const pitch = 1050 * Math.pow(1.13, c.thinDone);           // a thinner blank rings higher
  for (let i = 0; i < N; i++) c.shape[i] *= 0.988;           // it narrows a little as it thins
  if (good) {
    for (const o of [-0.09, 0.09]) dent(c.shape, ang + o, 0.07, 0.012);
    c.thinScars.push({ ang, w: 0.3 });
    addStress(c, 2);
    Sound.strike(true, pitch);
    flakeFx(ang, L, true, true);
    textFx(`Thinner · sharpness ${CONFIG.sharpnessCeiling[c.thinDone]}`, ang, L, '#cfe2f0');
  } else {
    dent(c.shape, ang, 0.1, 0.022);
    c.thinScars.push({ ang, w: 0.14 });
    c.mistimes++;
    c.strength = Math.max(0, c.strength - CONFIG.thinMistimePenalty);
    addStress(c, 4);
    Sound.strike(false, pitch);
    flakeFx(ang, L, false, true);
    textFx(`${why} · −${CONFIG.thinMistimePenalty} strength · it held (${Math.round(chance * 100)}% risk)`, ang, L, '#e3a08f');
  }
  if (c.thinDone < CONFIG.maxThinStrikes) pickBand(ang);
  render();
}

function addStress(c, count) {
  for (let k = 0; k < count; k++) {
    let x = 0, y = 0;
    for (let tries = 0; tries < 40; tries++) {
      x = (Math.random() * 2 - 1) * 0.5; y = (Math.random() * 2 - 1) * 1.0;
      if (Math.hypot(x, y) < radiusAt(c.shape, Math.atan2(y, x)) * 0.82) break;
    }
    const pts = [[x, y]];
    let a = Math.random() * TAU;
    const segs = 3 + ((Math.random() * 3) | 0);
    for (let i = 0; i < segs; i++) { a += (Math.random() - 0.5) * 1.0; x += Math.cos(a) * 0.05; y += Math.sin(a) * 0.05; pts.push([x, y]); }
    c.stress.push(pts);
  }
}

// ---------- snapping ----------
// Cut the blank's outline along a line, keeping the points on one side (plus the crossings).
function clipHalf(pts, nx, ny, off, keepPositive) {
  const side = (p) => (p[0] * nx + p[1] * ny - off) * (keepPositive ? 1 : -1);
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], sa = side(a), sb = side(b);
    if (sa >= 0) out.push(a);
    if ((sa >= 0) !== (sb >= 0)) { const t = sa / (sa - sb); out.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t)]); }
  }
  return out;
}

function startSnap(ang, chance, good, why) {
  const c = game.cur;
  const pts = Array.from(c.shape, (r, i) => [Math.cos((i / N) * TAU) * r, Math.sin((i / N) * TAU) * r]);
  const tilt = (Math.random() - 0.5) * 0.9, nx = Math.sin(tilt), ny = Math.cos(tilt);   // a break roughly across the blank
  const off = (Math.random() - 0.5) * 0.5;
  const halves = [clipHalf(pts, nx, ny, off, false), clipHalf(pts, nx, ny, off, true)];
  game.snapInfo = { chance, strikeNo: c.thinDone + 1, flawed: c.flawed, good, why };
  game.anim = { kind: 'snap', t0: now(), halves, nx, ny, off, spin: [-(0.15 + Math.random() * 0.2), 0.15 + Math.random() * 0.25] };
  game.phase = 'snapping';
  game.hold = null;
  Sound.snap();
  game.fx.push(flashFx(layout().cx, layout().cy, 'crack'));
  game.session.snapped++;
  Object.assign(game.stats, { snapped: game.stats.snapped + 1, worked: game.stats.worked + 1, strikes: game.stats.strikes + c.strikes });
  render();
}

function finishSnap() {
  const a = game.anim;
  game.rejects.push({ halves: a.halves, rot: (Math.random() - 0.5) * 1.2, flip: Math.random() < 0.5 });
  game.anim = null;
  game.phase = 'snapped';
  render();
}

// =====================================================================================
// EFFECTS — every sound has one of these as its visual twin
// =====================================================================================
function rippleFx(x, y, maxR, broken, clipStone) {
  const seed = Math.random() * TAU, jit = Array.from({ length: 18 }, () => Math.random());
  return { t0: now(), life: broken ? 0.7 : 1.0, draw(t) {
    ctx.save();
    if (clipStone) { tracePath(ctx, clipStone.shape, clipStone.x, clipStone.y, clipStone.s); ctx.clip(); }
    for (let k = 0; k < 3; k++) {
      const tk = t - k * 0.13; if (tk <= 0 || tk >= 1) continue;
      const r = 6 + tk * maxR, a = (1 - tk) * 0.85;
      ctx.strokeStyle = `rgba(238,232,215,${a})`; ctx.lineWidth = 2.4 * (1 - tk) + 0.6;
      if (!broken) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); continue; }
      for (let j = 0; j < 6; j++) {                       // a broken ripple: gaps and wobble
        const a0 = seed + k * 0.7 + (j * TAU) / 6, rr = r + (jit[(j + k * 6) % 18] - 0.5) * 4 * tk;
        ctx.beginPath(); ctx.arc(x, y, rr, a0, a0 + (TAU / 6) * 0.86); ctx.stroke();
      }
    }
    ctx.restore();
  } };
}

function flashFx(x, y, kind) {
  return { t0: now(), life: kind === 'crack' ? 0.35 : kind === 'good' ? 0.2 : 0.4, draw(t) {
    const r = kind === 'good' ? 46 : kind === 'crack' ? 220 : 34;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * (0.6 + t * 0.6));
    const col = kind === 'bad' ? '150,120,90' : '255,244,214';
    const a = (1 - t) * (kind === 'crack' ? 0.55 : kind === 'good' ? 0.9 : 0.6);
    g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 1.2, 0, TAU); ctx.fill();
  } };
}

function flakeFx(ang, L, good, thin = false) {
  const c = game.cur, edge = radiusAt(c.shape, ang) * L.s;
  const ex = L.cx + Math.cos(ang) * edge, ey = L.cy + Math.sin(ang) * edge;
  game.fx.push(flashFx(ex, ey, good ? 'good' : 'bad'));
  const pieces = thin ? (good ? 3 : 1) : 1;
  for (let k = 0; k < pieces; k++) {
    const len = thin ? (good ? 0.12 : 0.08) * L.s : (good ? 0.5 : 0.13) * L.s, wid = len * (good ? 0.42 : 0.7);
    const shard = [[-len / 2, 0], [-len * 0.2, -wid / 2], [len / 2, -wid * 0.15], [len * 0.3, wid / 2]];
    const dir = ang + (Math.random() - 0.5) * 0.5, sp = good ? 260 + Math.random() * 120 : 150 + Math.random() * 60;
    const p = { x: ex, y: ey, vx: Math.cos(dir) * sp, vy: Math.sin(dir) * sp - 160, rot: dir, vr: (Math.random() - 0.5) * 9 };
    game.fx.push({ t0: now(), life: 1.3, draw(t, dt) {
      p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = 1 - ease(clamp((t - 0.6) / 0.4, 0, 1));
      ctx.beginPath(); shard.forEach(([sx, sy], i) => (i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy))); ctx.closePath();
      ctx.fillStyle = good ? '#7d8189' : '#6b6359'; ctx.fill();
      ctx.strokeStyle = good ? '#e8e4d8' : '#8f8677'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();
    } });
  }
  if (!good) for (let k = 0; k < 7; k++) {                          // a puff of grit for a bad strike
    const dir = ang + (Math.random() - 0.5) * 1.6, sp = 40 + Math.random() * 90, p = { x: ex, y: ey };
    game.fx.push({ t0: now(), life: 0.6, draw(t, dt) {
      p.x += Math.cos(dir) * sp * dt; p.y += Math.sin(dir) * sp * dt + 30 * dt;
      ctx.fillStyle = `rgba(150,130,105,${0.7 * (1 - t)})`; ctx.beginPath(); ctx.arc(p.x, p.y, 2 + t * 3, 0, TAU); ctx.fill();
    } });
  }
}

function textFx(text, ang, L, color) {
  const y = clamp(L.cy + Math.sin(ang) * L.s * 1.0, 110, L.bottom - 20);
  game.fx.push({ t0: now(), life: 1.9, draw(t) {
    ctx.save(); ctx.globalAlpha = 1 - ease(clamp((t - 0.55) / 0.45, 0, 1));
    ctx.font = '600 16px -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(20,17,15,0.75)'; const w = ctx.measureText(text).width + 18;
    const x = clamp(L.cx + Math.cos(ang) * L.s * 1.25, w / 2 + 8, W - w / 2 - 8);   // keep the whole label on screen
    ctx.fillRect(x - w / 2, y - 18 - t * 26, w, 26);
    ctx.fillStyle = color; ctx.fillText(text, x, y - t * 26);
    ctx.restore();
  } });
}

function swingFx(x, y, tool) {
  return { t0: now(), life: 0.12, draw(t) { drawTool(x, y, 1 - t, tool); } };
}

// floating "+6" / "−3" by a DOM element, for the bead counter
function floatAt(el, text, color) {
  const r = el.getBoundingClientRect(), f = document.createElement('div');
  f.className = 'float'; f.textContent = text; f.style.color = color; f.style.left = `${r.right + 6}px`; f.style.top = `${r.top}px`;
  document.body.appendChild(f); setTimeout(() => f.remove(), 1300);
  el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse');
}

// =====================================================================================
// DRAWING
// =====================================================================================
const COLORS = { bench: '#2d2824', pad: '#3a322b', cortex: '#cfc8b6', cortexEdge: '#8d8676', flint: '#3f4147', flintThin: '#8f97a2', scar: '#45474e' };

function drawTool(x, y, lift, tool) {
  ctx.save();
  ctx.translate(x, y - lift * 34);
  ctx.scale(1 + lift * 0.25, 1 + lift * 0.25);
  if (tool === 'hammer') {
    ctx.rotate(-0.5);
    ctx.beginPath(); ctx.ellipse(16, -10, 22, 16, 0, 0, TAU);
    ctx.fillStyle = '#9c958a'; ctx.fill(); ctx.strokeStyle = '#6e685e'; ctx.lineWidth = 2; ctx.stroke();
  } else {
    ctx.rotate(-0.75);
    ctx.fillStyle = '#c8b48c'; ctx.strokeStyle = '#8c7a58'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-7, -64, 14, 66, 6) : ctx.rect(-7, -64, 14, 66); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 7.5, 0, TAU); ctx.fillStyle = '#ddd0b0'; ctx.fill(); ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, TAU); ctx.fill();
}

function drawNodule(shape, x, y, s, tone, scars) {
  tracePath(ctx, shape, x, y, s);
  ctx.fillStyle = mixHex('#c9c2af', '#d8d1bf', tone); ctx.fill();
  if (scars && scars.length) {                                    // flake scars expose the dark flint inside
    ctx.save(); tracePath(ctx, shape, x, y, s); ctx.clip();
    for (const sc of scars) {
      const e = radiusAt(shape, sc.ang) * s, rr = sc.w * s * 1.15;
      const px = x + Math.cos(sc.ang) * (e + rr * 0.35), py = y + Math.sin(sc.ang) * (e + rr * 0.35);
      ctx.fillStyle = COLORS.scar; ctx.beginPath(); ctx.arc(px, py, rr, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(160,165,175,0.35)'; ctx.lineWidth = 1.2;     // ripple marks on the scar
      for (const f of [0.55, 0.75, 0.92]) { ctx.beginPath(); ctx.arc(px, py, rr * f, sc.ang + Math.PI - 0.9, sc.ang + Math.PI + 0.9); ctx.stroke(); }
    }
    ctx.restore();
  }
  tracePath(ctx, shape, x, y, s);
  ctx.strokeStyle = COLORS.cortexEdge; ctx.lineWidth = 2; ctx.stroke();
}

function drawBlank(c, x, y, s, shape = c.shape) {
  const th = c.thinDone / CONFIG.maxThinStrikes;
  tracePath(ctx, shape, x, y, s);
  ctx.fillStyle = mixHex(COLORS.flint, COLORS.flintThin, th * 0.85); ctx.fill();
  ctx.save(); tracePath(ctx, shape, x, y, s); ctx.clip();
  // a thinner blank shows a wider, lighter, see-through margin
  tracePath(ctx, shape, x, y, s);
  ctx.lineWidth = 8 + th * 30; ctx.strokeStyle = `rgba(200,212,226,${0.1 + th * 0.28})`; ctx.stroke();
  for (const sc of c.thinScars) {                                // small flake facets along the edge
    const e = radiusAt(shape, sc.ang) * s;
    ctx.strokeStyle = 'rgba(220,226,235,0.35)'; ctx.lineWidth = 1.3;
    for (let k = -2; k <= 2; k++) {
      const a = sc.ang + k * sc.w * 0.25, r0 = radiusAt(shape, a) * s;
      ctx.beginPath(); ctx.arc(x + Math.cos(a) * (r0 + 4), y + Math.sin(a) * (r0 + 4), 9 + th * 4, a + Math.PI - 0.8, a + Math.PI + 0.8); ctx.stroke();
    }
    void e;
  }
  ctx.strokeStyle = 'rgba(18,20,24,0.65)'; ctx.lineWidth = 1.1;   // stress lines
  for (const line of c.stress) {
    ctx.beginPath(); line.forEach(([px, py], i) => (i ? ctx.lineTo(x + px * s, y + py * s) : ctx.moveTo(x + px * s, y + py * s))); ctx.stroke();
  }
  ctx.restore();
  tracePath(ctx, shape, x, y, s);
  ctx.strokeStyle = '#25272c'; ctx.lineWidth = 2; ctx.stroke();
}

// side-on view, so the thinning is easy to read
function drawProfile(c, L) {
  const th = c.thinDone / CONFIG.maxThinStrikes;
  let px = L.cx + L.s * 0.62 + 80;
  if (px > W - 50) px = L.cx - L.s * 0.62 - 80;
  if (px < 50) return;
  const ry = L.s * 1.0, rx = Math.max(2.5, L.s * (0.15 - th * 0.115));
  ctx.beginPath(); ctx.ellipse(px, L.cy, rx, ry, 0, 0, TAU);
  ctx.fillStyle = mixHex(COLORS.flint, COLORS.flintThin, th * 0.85); ctx.fill();
  ctx.strokeStyle = '#25272c'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#8a8073'; ctx.font = '12px -apple-system, Helvetica, Arial, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('side view', px, L.cy + ry + 18);
}

function drawRejects(L) {
  if (!game.rejects.length) return;
  const x0 = 34, y0 = L.bottom - 18, sz = 13;
  ctx.fillStyle = '#8a8073'; ctx.font = '12px -apple-system, Helvetica, Arial, sans-serif'; ctx.textAlign = 'left';
  game.rejects.forEach((rj, k) => {
    const col = k % 6, row = Math.floor(k / 6);
    const x = x0 + col * 30 + (row % 2) * 15, y = y0 - row * 15;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rj.rot); if (rj.flip) ctx.scale(-1, 1);
    rj.halves.forEach((h, j) => {
      ctx.save(); ctx.translate(j ? 3 : -3, j ? 2 : -2); ctx.rotate(j ? 0.5 : -0.4);
      ctx.beginPath(); h.forEach(([hx, hy], i) => (i ? ctx.lineTo(hx * sz, hy * sz) : ctx.moveTo(hx * sz, hy * sz))); ctx.closePath();
      ctx.fillStyle = '#4b4d53'; ctx.fill(); ctx.strokeStyle = '#25272c'; ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    });
    ctx.restore();
  });
  const rows = Math.ceil(game.rejects.length / 6);
  ctx.fillText(`Reject pile · ${game.rejects.length}`, x0 - 14, y0 - rows * 15 - 14);
}

function drawBand(g, ringNow) {
  const inside = ringNow !== null && Math.abs(ringNow - g.rb) <= g.halfT;
  ctx.save();
  ctx.lineCap = 'butt';
  ctx.strokeStyle = inside ? 'rgba(255,236,190,0.5)' : 'rgba(255,240,205,0.26)';
  ctx.lineWidth = g.halfT * 2;
  ctx.beginPath(); ctx.arc(g.L.cx, g.L.cy, g.rb, g.ang - CONFIG.bandHalfSpan, g.ang + CONFIG.bandHalfSpan); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,240,205,0.55)'; ctx.lineWidth = 1.2;
  for (const r of [g.rb - g.halfT, g.rb + g.halfT]) { ctx.beginPath(); ctx.arc(g.L.cx, g.L.cy, Math.max(1, r), g.ang - CONFIG.bandHalfSpan, g.ang + CONFIG.bandHalfSpan); ctx.stroke(); }
  ctx.restore();
}

let lastFrame = now();
function frame() {
  const t = now(), dt = Math.min(0.05, t - lastFrame); lastFrame = t;
  const L = layout();
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#24211e'; ctx.fillRect(0, 0, W, H);
  // the workbench: a hide pad under the stone
  ctx.fillStyle = COLORS.bench; ctx.beginPath(); ctx.ellipse(L.cx, L.cy + L.s * 0.08, L.s * 2.4, L.s * 1.45, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = COLORS.pad; ctx.beginPath(); ctx.ellipse(L.cx, L.cy + L.s * 0.08, L.s * 1.55, L.s * 1.28, 0, 0, TAU); ctx.fill();

  drawRejects(L);

  if (game.phase === 'buy' || ((game.phase === 'summary') && !game.cur)) {
    const sp = Math.min(W * 0.3, L.s * 2.5), sc = L.s * 0.62;
    game.stones.forEach((st, i) => {
      const x = L.cx + (i - 1) * sp, y = L.cy;
      st.at = { x, y, s: sc };
      if (i === game.selected) {
        ctx.save(); tracePath(ctx, st.shape, x, y, sc * 1.12); ctx.strokeStyle = '#e8b860'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
      }
      drawNodule(st.shape, x, y, sc, st.tone);
    });
  }

  const c = game.cur;
  if (c && (game.phase === 'rough' || game.phase === 'thin' || game.phase === 'result')) {
    if (c.morph) {
      const m = clamp((t - c.morph.t0) / 0.7, 0, 1), e = ease(m);
      const shape = new Float32Array(N);
      for (let i = 0; i < N; i++) shape[i] = lerp(c.morph.from[i], c.morph.to[i], e);
      if (m < 0.5) drawNodule(shape, L.cx, L.cy, L.s, c.tone, c.scars);
      ctx.save(); ctx.globalAlpha = clamp((m - 0.25) / 0.5, 0, 1); drawBlank(c, L.cx, L.cy, L.s, shape); ctx.restore();
      if (m >= 1) {
        c.shape = c.morph.to; c.morph = null; c.scars = [];
        game.phase = 'thin'; pickBand(); render();
        textFx('A blank. Thin it, or set it down.', -Math.PI / 2, L, '#f0e2b8');
      }
    } else if (game.phase === 'rough') {
      drawNodule(c.shape, L.cx, L.cy, L.s, c.tone, c.scars);
    } else {
      drawBlank(c, L.cx, L.cy, L.s);
      drawProfile(c, L);
    }
    if (canStrike()) {
      const g = bandGeometry(L);
      const held = game.hold ? t - game.hold.t0 : null, ring = held !== null ? ringRadius(g, held) : null;
      drawBand(g, ring);
      if (ring !== null) {
        ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(L.cx, L.cy, ring, 0, TAU); ctx.stroke();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(L.cx, L.cy, ring, 0, TAU); ctx.stroke();
      }
      const pt = game.pointer;
      if (pt.seen) drawTool(pt.x, pt.y, held !== null ? clamp(held / CONFIG.ringCloseTime, 0, 1) : 0, game.phase === 'rough' ? 'hammer' : 'billet');
    }
  }

  if (game.anim && game.anim.kind === 'snap') {
    const a = game.anim, u = t - a.t0;
    if (u < 0.15) {
      drawBlank(c, L.cx, L.cy, L.s);
      // the crack line, flashing across the blank
      ctx.save(); tracePath(ctx, c.shape, L.cx, L.cy, L.s); ctx.clip();
      ctx.strokeStyle = '#fff6e0'; ctx.lineWidth = 3; ctx.beginPath();
      const px = -a.ny, py = a.nx;
      for (let k = -6; k <= 6; k++) {
        const along = k * 0.12, jag = (k % 2 ? 1 : -1) * 0.025;
        const qx = a.nx * (a.off + jag) + px * along, qy = a.ny * (a.off + jag) + py * along;
        if (k === -6) ctx.moveTo(L.cx + qx * L.s, L.cy + qy * L.s); else ctx.lineTo(L.cx + qx * L.s, L.cy + qy * L.s);
      }
      ctx.stroke(); ctx.restore();
    } else {
      const sep = ease(clamp((u - 0.15) / 0.55, 0, 1)), fall = ease(clamp((u - 0.85) / 0.55, 0, 1));
      a.halves.forEach((h, j) => {
        const sgn = j ? 1 : -1;
        const tx = L.cx + a.nx * sgn * 38 * sep, ty = L.cy + a.ny * sgn * 38 * sep;
        const gx = lerp(tx, 60, fall), gy = lerp(ty, L.bottom - 40, fall), sc = lerp(L.s, 13, fall);
        ctx.save(); ctx.translate(gx, gy); ctx.rotate(a.spin[j] * sep + fall * 0.6); ctx.globalAlpha = 1 - fall * 0.3;
        ctx.beginPath(); h.forEach(([hx, hy], i) => (i ? ctx.lineTo(hx * sc, hy * sc) : ctx.moveTo(hx * sc, hy * sc))); ctx.closePath();
        ctx.fillStyle = mixHex(COLORS.flint, COLORS.flintThin, (c.thinDone / CONFIG.maxThinStrikes) * 0.85); ctx.fill();
        ctx.strokeStyle = '#25272c'; ctx.lineWidth = 2; ctx.stroke();
        ctx.restore();
      });
      if (u > 1.45) finishSnap();
    }
  }

  // effects
  game.fx = game.fx.filter((f) => {
    const k = (t - f.t0) / f.life;
    if (k < 0) return true;
    if (k >= 1) return false;
    f.draw(k, dt);
    return true;
  });
  requestAnimationFrame(frame);
}

// =====================================================================================
// UI — the top bar, the bottom panel and the result cards
// =====================================================================================
const pct = (p) => `${Math.round(p * 100)}%`;
function meter(kind, frac, extra = '') {
  frac = clamp(frac, 0, 1);
  if (kind === 'risk') return `<div class="meter risk"><div class="cover" style="width:${(1 - frac) * 100}%"></div><div class="mark" style="left:${frac * 100}%"></div>${extra}</div>`;
  return `<div class="meter ${kind}"><div class="fill" style="width:${frac * 100}%"></div></div>`;
}

function render() {
  ui.beads.textContent = game.beads;
  ui.best.textContent = game.best ? `${game.best} / 50` : '–';
  const c = game.cur;
  let title = '', help = '', panel = '', card = '';

  if (game.phase === 'buy') {
    title = '1 · Buy a stone';
    help = 'Tap a nodule to hear it. One of the three has a hidden flaw. Pick one and pay.';
    panel = game.selected >= 0
      ? `<div class="actions" style="justify-content:center;margin-top:0"><button class="primary" data-act="buy">Buy this stone · ${CONFIG.stoneCost} beads</button></div>`
      : `<div class="note">Tap the stones to listen. Tap as often as you like.</div>`;
  } else if (game.phase === 'rough') {
    title = `2 · Rough out · strike ${Math.min(c.roughDone + 1, CONFIG.roughOutStrikes)} of ${CONFIG.roughOutStrikes}`;
    help = 'Point at the pale band. Hold to raise the hammerstone; release when the ring meets the band.';
    const dots = '●'.repeat(c.roughDone) + '○'.repeat(Math.max(0, CONFIG.roughOutStrikes - c.roughDone));
    panel = `<div class="row"><span class="label">Strikes</span><span class="dots">${dots}</span></div>
      <div class="row"><span class="label">Strength</span><span class="val">${c.strength} / 25</span></div>${meter('strength', c.strength / 25)}`;
  } else if (game.phase === 'thin' || game.phase === 'snapping') {
    title = `3 · Thin the blank · ${c.thinDone} of ${CONFIG.maxThinStrikes} strikes`;
    help = c.thinDone < CONFIG.maxThinStrikes
      ? 'Antler billet. Each strike sharpens it, and might snap it. Strike again, or set it down.'
      : 'It is as thin as it can go. Set it down.';
    const sharp = CONFIG.sharpnessCeiling[c.thinDone];
    const risk = c.thinDone < CONFIG.maxThinStrikes
      ? `<div class="row"><span class="label">Snap risk, next strike</span><span class="val risk">${pct(currentSnapChance(false))}</span></div>${meter('risk', currentSnapChance(false))}`
      : `<div class="row"><span class="label">Snap risk</span><span class="val">No more strikes</span></div>`;
    panel = `${risk}
      <div class="row"><span class="label">Sharpness ceiling</span><span class="val">${sharp} / 25</span></div>${meter('sharp', sharp / 25)}
      <div class="row small"><span>Strength ${c.strength} / 25</span><span>Mistimed strike: double the risk, −${CONFIG.thinMistimePenalty} strength</span></div>
      <div class="actions"><button class="primary" data-act="setdown" ${game.phase === 'snapping' ? 'disabled' : ''}>Set it down</button></div>`;
  } else if (game.phase === 'result') {
    const r = game.result;
    title = '4 · Result'; help = 'The blank is done.';
    const canAfford = game.beads >= CONFIG.stoneCost;
    card = `<h2>Blank set down</h2>
      <div class="line"><span>Strength</span><span class="val">${r.strength} / 25</span></div>${meter('strength', r.strength / 25)}
      <div class="line"><span>Sharpness ceiling</span><span class="val">${r.sharp} / 25</span></div>${meter('sharp', r.sharp / 25)}
      <div class="line total"><span>Blank quality</span><span class="val">${r.quality} / 50</span></div>
      <div class="line earned"><span>Beads earned</span><span class="val">+${r.earned}</span></div>
      <div class="line"><span>Best blank so far</span><span class="val">${game.best} / 50${r.isNew ? '<span class="newbest">NEW BEST</span>' : r.first ? '<span class="newbest">FIRST</span>' : ''}</span></div>
      <p class="fine">${r.thinDone} thinning strike${r.thinDone === 1 ? '' : 's'}. The stone was ${r.flawed ? '<span class="bad">flawed</span>' : 'sound'}. You have ${game.beads} beads.</p>
      <div class="actions"><button class="primary" data-act="next">${canAfford ? 'Next stone' : 'End of session'}</button></div>`;
  } else if (game.phase === 'snapped') {
    const s = game.snapInfo, canAfford = game.beads >= CONFIG.stoneCost;
    title = 'It snapped'; help = 'Onto the reject pile.';
    card = `<h2 class="bad">It snapped</h2>
      <p>On thinning strike ${s.strikeNo}${s.good ? '' : ` (${s.why.toLowerCase()})`}. The chance was ${pct(s.chance)}.</p>
      <p>The stone was ${s.flawed ? '<span class="bad">flawed</span>' : 'sound'}. It goes on the reject pile, and the ${CONFIG.stoneCost} beads are gone.</p>
      <p class="fine">You have ${game.beads} beads.</p>
      <div class="actions"><button class="primary" data-act="next">${canAfford ? 'Next stone' : 'End of session'}</button></div>`;
  } else if (game.phase === 'summary') {
    const s = game.session;
    title = 'Session over'; help = `A stone costs ${CONFIG.stoneCost} beads.`;
    card = `<h2>Out of beads</h2>
      <p>You have ${game.beads} shell bead${game.beads === 1 ? '' : 's'}, and a stone costs ${CONFIG.stoneCost}.</p>
      <div class="line"><span>Stones bought</span><span class="val">${s.bought}</span></div>
      <div class="line"><span>Blanks made</span><span class="val">${s.made}</span></div>
      <div class="line"><span>Blanks snapped</span><span class="val">${s.snapped}</span></div>
      <div class="line"><span>Beads earned</span><span class="val">${s.earned}</span></div>
      <div class="line total"><span>Best blank</span><span class="val">${game.best ? `${game.best} / 50` : '–'}</span></div>
      <div class="actions"><button class="primary" data-act="restart">Start a new session</button></div>`;
  }

  ui.title.textContent = title;
  ui.help.textContent = help;
  if (ui.panel.innerHTML !== panel) ui.panel.innerHTML = panel;
  ui.card.innerHTML = card;
  ui.cardWrap.hidden = !card;
  renderDebugStats();
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  Sound.unlock();
  const act = b.dataset.act;
  if (act === 'buy') buy();
  else if (act === 'setdown') setDown();
  else if (act === 'next') goBuy();
  else if (act === 'restart') restart();
  else if (act === 'mute') { const m = Sound.toggle(); ui.mute.textContent = m ? 'Sound off' : 'Sound on'; }
  else if (act === 'dbg-restart') restart();
});

// =====================================================================================
// INPUT — pointer events cover mouse, trackpad and touch alike
// =====================================================================================
function setPointer(e) { game.pointer.x = e.clientX; game.pointer.y = e.clientY; game.pointer.seen = true; }

canvas.addEventListener('pointerdown', (e) => {
  Sound.unlock();
  setPointer(e);
  try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* fine */ }
  if (game.phase === 'buy') {
    game.stones.forEach((st, i) => {
      if (!st.at) return;
      const dx = e.clientX - st.at.x, dy = e.clientY - st.at.y;
      if (Math.hypot(dx, dy) <= radiusAt(st.shape, Math.atan2(dy, dx)) * st.at.s * 1.06) {
        Sound.tap(st.pitch, st.flawed);
        game.fx.push(rippleFx(e.clientX, e.clientY, st.at.s * 1.1, st.flawed, { shape: st.shape, x: st.at.x, y: st.at.y, s: st.at.s }));
        if (game.selected !== i) { game.selected = i; render(); }
      }
    });
    return;
  }
  startHold(e.clientX, e.clientY);
});
canvas.addEventListener('pointermove', setPointer);
canvas.addEventListener('pointerup', (e) => { setPointer(e); releaseHold(e.clientX, e.clientY); if (e.pointerType !== 'mouse') game.pointer.seen = false; });
canvas.addEventListener('pointercancel', () => { game.hold = null; });
canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !game.hold) game.pointer.seen = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// =====================================================================================
// DEBUG PANEL — backtick toggles it
// =====================================================================================
function buildDebug() {
  const slider = (label, key, min, max, step, fmt, idx) => {
    const v = idx === undefined ? CONFIG[key] : CONFIG[key][idx];
    return `<label><span>${label}<output>${fmt(v)}</output></span>
      <input type="range" min="${min}" max="${max}" step="${step}" value="${v}" data-key="${key}" ${idx === undefined ? '' : `data-idx="${idx}"`}></label>`;
  };
  const sec = (v) => `±${v.toFixed(2)} s`, perc = (v) => `${Math.round(v * 100)}%`, int = (v) => `${v}`;
  ui.debug.innerHTML = `<h3>Debug</h3>
    <h4>Timing</h4>${slider('Timing window', 'timingWindow', 0.03, 0.4, 0.01, sec)}
    <h4>Snap chance (next strike, sound stone)</h4>
    ${CONFIG.snapChance.map((_, i) => slider(`After ${i} thinning strike${i === 1 ? '' : 's'}`, 'snapChance', 0, 1, 0.01, perc, i)).join('')}
    <h4>Economy</h4>
    ${slider('Stone cost', 'stoneCost', 1, 10, 1, int)}
    ${slider('Starting beads (next session)', 'startBeads', 1, 40, 1, int)}
    <button data-act="dbg-restart">Restart session now</button>
    <h4>Since the page opened</h4><div id="dbg-stats"></div>`;
  ui.debug.addEventListener('input', (e) => {
    const el = e.target; if (!el.dataset.key) return;
    const v = parseFloat(el.value);
    if (el.dataset.idx !== undefined) CONFIG[el.dataset.key][+el.dataset.idx] = v; else CONFIG[el.dataset.key] = v;
    const key = el.dataset.key;
    el.previousElementSibling.querySelector('output').textContent = key === 'timingWindow' ? sec(v) : key === 'snapChance' ? perc(v) : int(v);
    render();
  });
}
function renderDebugStats() {
  const el = document.getElementById('dbg-stats');
  if (!el) return;
  const s = game.stats, avg = s.worked ? (s.strikes / s.worked).toFixed(1) : '–', avgThin = s.made ? (s.thinOnMade / s.made).toFixed(1) : '–';
  el.innerHTML = `<div class="stat"><span>Blanks made</span><b>${s.made}</b></div>
    <div class="stat"><span>Blanks snapped</span><b>${s.snapped}</b></div>
    <div class="stat"><span>Average strikes per blank</span><b>${avg}</b></div>
    <div class="stat"><span>Average thinning strikes (made)</span><b>${avgThin}</b></div>
    <div class="stat"><span>Current stone</span><b>${game.cur ? (game.cur.flawed ? 'flawed' : 'sound') : '–'}</b></div>`;
}
window.addEventListener('keydown', (e) => {
  if (e.key === '`' || e.code === 'Backquote') { ui.debug.hidden = !ui.debug.hidden; renderDebugStats(); }
});

// =====================================================================================
// START
// =====================================================================================
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
}
window.addEventListener('resize', resize);
resize();
buildDebug();
goBuy();
requestAnimationFrame(frame);

// For testing from the console.
window.strikeTest = { CONFIG, game, buy, setDown, goBuy, restart, bandGeometry, layout, ringRadius, currentSnapChance };
