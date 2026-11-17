// Trading, in the world rather than on a menu.
// Each family keeps a trading table beside its door, off the path, with a hide spread
// over it and its goods laid out for real. Face the doorway and press E: the camera
// glides to the table, the door swings open on the firelight and the keeper speaks
// from the doorway. Point at a good to lift it into the light; click (or Enter) to trade.
// Your shell beads are counted out onto the hide and the good leaves the table.
// Wares, prices, stock and lines are placeholders for Timothy to change.
import * as THREE from 'three';
import * as W from './world.js';
import { STATE, DOOR_LEAVES, U } from './shared.js';
import { makeGoods, suede } from './goods.js';

const TAU = Math.PI * 2;
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// ---------------------------------------------------------------- who sells what
const SHOPS = {
  hide: {
    keeper: 'Tamsa', house: 'The Hide House',
    lines: {
      greet: ['Mind the flies. They mind the hides, and I mind them.', 'Brok scraped every one of these. Feel how soft.', 'Greyhand’s new hands, are you? He wore through three of our knee pads.'],
      buy: ['Wear it well.', 'Brok! We sold one!', 'That’ll keep the cold out of your bones.'],
      poor: ['Not enough shell for that, knapper.', 'Come back with more beads. Or a scraper that stays sharp.'],
      gone: ['That’s the last of those till the next hunt.'],
      leave: ['Bring me a scraper that stays sharp.', 'Off with you, then. The flies are waiting.'],
    },
    wares: [
      { name: 'Cured deer hide', price: 6, stock: 2, make: 'hideRoll', at: [-0.4, -1], desc: 'Smoked over birch. Supple, and it sheds the rain.' },
      { name: 'Sinew bundle', price: 2, stock: 3, make: 'sinew', at: [-0.42, 1], desc: 'Wet it and wrap it; it shrinks tight as it dries. For binding a blade to its handle.' },
      { name: 'Rawhide cord', price: 1, stock: 3, make: 'cordCoil', at: [0.02, 1], desc: 'A long coil, cut in one spiral from a single hide.' },
      { name: 'Knee pad', price: 3, stock: 2, make: 'kneePad', at: [0.42, 1], desc: 'Thick hide for a knapper’s knee.' },
      { name: 'Fox pelt', price: 5, stock: 1, make: 'foxPelt', at: [0.3, -1], desc: 'Winter fur, stretched and dried.' },
    ],
  },
  hearth: {
    keeper: 'Oda', house: 'The Hearth House',
    lines: {
      greet: ['Sit. Eat. Then tell me what everyone’s saying.', 'Sefa’s bread is better than mine ever was. Don’t tell her.', 'The oven’s hot, and so is the news.'],
      buy: ['Eat it while it’s warm.', 'Mind your fingers with that tar.', 'Sefa! Wrap that for them.'],
      poor: ['Short a bead or two? Not today, child.', 'Beads first. Then bread.'],
      gone: ['That’s all of that till tomorrow’s baking.'],
      leave: ['Come back before the bread’s gone.', 'Tell Tamsa I said nothing.'],
    },
    wares: [
      { name: 'Flatbread', price: 1, stock: 3, make: 'flatbread', at: [-0.47, 1], desc: 'Emmer flour, baked on the oven floor this morning.' },
      { name: 'Basket of emmer', price: 4, stock: 2, make: 'emmerBasket', at: [-0.33, -1], desc: 'Threshed and winnowed. A family’s worth for a week.' },
      { name: 'Hazelnuts', price: 1, stock: 3, make: 'hazelnuts', at: [0.0, 1], desc: 'A pouchful, roasted in the embers.' },
      { name: 'Birch tar cake', price: 3, stock: 2, make: 'tarCake', at: [0.44, 1], desc: 'Boiled down from birch bark. Warm it, and it glues a blade into its handle.' },
      { name: 'Crab apples', price: 2, stock: 2, make: 'crabApples', at: [0.33, -1], desc: 'Small and sharp, picked at the edge of the woods.' },
    ],
  },
  workshop: {
    keeper: 'Old Greyhand used to say', house: 'Your workshop', own: true,
    lines: {
      greet: ['Every good blade starts out as a bad one.', 'Listen to the stone before you hit it.', 'Flint remembers every mistake you make.'],
      leave: ['The stone will wait. It always has.'],
    },
    wares: [],
  },
  clay: {
    keeper: 'Nee', house: 'The Clay House',
    lines: {
      greet: ['Ilo’s thumbprint is inside every one. Look underneath.', 'Careful. Some are still warm from the kiln.', 'Pick one up and tap it. Hear that? No cracks.'],
      buy: ['Ilo will be pleased. He won’t say so.', 'Use it well. Don’t drop it.', 'One more pot out into the world.'],
      poor: ['That’s more beads than you’ve got.', 'Ilo doesn’t haggle. Neither do I.'],
      gone: ['That was the last one. The next firing’s in a few days.'],
      leave: ['Bring it back if it cracks. It won’t.', 'Go gently.'],
    },
    wares: [
      { name: 'Drinking cup', price: 2, stock: 3, make: 'cup', at: [-0.5, 1], desc: 'Small enough for one hand, its rim pressed with cord.' },
      { name: 'Cooking pot', price: 5, stock: 2, make: 'cookingPot', at: [0.3, -1], desc: 'Round-bottomed, to sit down in the coals.' },
      { name: 'Storage jar', price: 7, stock: 1, make: 'storageJar', at: [-0.28, -1], desc: 'Tall, with a wooden lid. Keeps grain dry through winter.' },
      { name: 'Tar pot', price: 4, stock: 2, make: 'tarPot', at: [-0.08, 1], desc: 'Small and thick-walled, for heating birch tar.' },
      { name: 'Red ochre', price: 2, stock: 3, make: 'ochre', at: [0.4, 1], desc: 'Ground fine and mixed with fat. For marking what’s yours.' },
    ],
  },
};

// ---------------------------------------------------------------- sound: a few small synthesized cues
const Sound = (() => {
  let ctx = null, out = null, noise = null;
  const ac = () => {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      ctx = new AC(); out = ctx.createGain(); out.gain.value = 0.5; out.connect(ctx.destination);
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };
  const env = (g, t, peak, a, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
  const burst = (delay, dur, type, f, q, peak) => { const c = ac(); if (!c) return; const t = c.currentTime + delay, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = noise; fl.type = type; fl.frequency.value = f; fl.Q.value = q; env(g, t, peak, 0.002, dur); s.connect(fl); fl.connect(g); g.connect(out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05); };
  const tone = (delay, f, dur, peak, type = 'sine', glide = 1) => { const c = ac(); if (!c) return; const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * glide, t + dur); env(g, t, peak, 0.004, dur); o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05); };
  return {
    unlock: ac,
    bead: (delay = 0) => { burst(delay, 0.025, 'bandpass', 3200 + Math.random() * 900, 4, 0.22); tone(delay, 2300 + Math.random() * 600, 0.07, 0.05); },
    thunk: (delay = 0) => { burst(delay, 0.09, 'lowpass', 420, 0.8, 0.45); tone(delay, 140, 0.12, 0.12, 'sine', 0.7); },
    creak: (open) => { const c = ac(); if (!c) return; const t = c.currentTime, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(open ? 70 : 95, t); o.frequency.linearRampToValueAtTime(open ? 105 : 62, t + 0.55);
      f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 6; env(g, t, 0.06, 0.05, 0.55); o.connect(f); f.connect(g); g.connect(out); o.start(t); o.stop(t + 0.7);
      if (!open) burst(0.5, 0.1, 'lowpass', 300, 0.7, 0.4); },
    deny: () => { burst(0, 0.06, 'lowpass', 260, 0.8, 0.3); },
  };
})();

// ---------------------------------------------------------------- on-screen type, kept quiet and cinematic
const CSS = `
  #prompt { position: fixed; left: 50%; bottom: 46px; transform: translate(-50%, 8px); opacity: 0; transition: opacity .25s, transform .25s; z-index: 8; pointer-events: none;
    color: #f4e8d2; font: 500 16px/1 "Iowan Old Style", Georgia, serif; letter-spacing: .02em; text-shadow: 0 1px 2px #000, 0 0 18px rgba(0,0,0,.65); display: flex; gap: 10px; align-items: center; }
  #prompt.on { opacity: 1; transform: translate(-50%, 0); pointer-events: auto; cursor: pointer; }
  .kb { display: inline-grid; place-items: center; min-width: 22px; height: 22px; padding: 0 6px; border-radius: 5px; border: 1px solid rgba(244,232,210,.7);
    font: 700 12px/1 -apple-system, "Helvetica Neue", sans-serif; color: #f4e8d2; background: rgba(20,14,10,.35); text-shadow: none; }
  #trade { position: fixed; inset: 0; z-index: 9; pointer-events: none; opacity: 0; transition: opacity .5s; color: #f4e8d2; }
  #trade.on { opacity: 1; }
  #trade .vignette { position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(8,5,3,.55)); }
  #trade .house { position: absolute; left: 34px; top: 26px; font: 600 12px/1.2 -apple-system, sans-serif; letter-spacing: .22em; text-transform: uppercase; color: #e2b77a; text-shadow: 0 1px 3px #000; }
  #trade .leave { position: absolute; right: 30px; top: 22px; font: 13px/1 -apple-system, sans-serif; display: flex; gap: 8px; align-items: center; text-shadow: 0 1px 3px #000; pointer-events: auto; cursor: pointer; opacity: .85; }
  #trade .tag { position: absolute; transform: translate(-50%, -100%); width: 270px; text-align: center; pointer-events: none; transition: opacity .2s; text-shadow: 0 1px 2px #000, 0 0 22px rgba(0,0,0,.9); }
  #trade .tag .name { font: 600 23px/1.15 "Iowan Old Style", Georgia, serif; }
  #trade .tag .rule { width: 44px; height: 1px; background: #e2b77a; margin: 7px auto 7px; opacity: .8; }
  #trade .tag .price { display: inline-flex; gap: 8px; align-items: center; font: 600 14px/1 -apple-system, sans-serif; color: #f1dcb4; }
  #trade .tag .desc { font: 13.5px/1.4 -apple-system, sans-serif; color: #e6d8c0; margin-top: 7px; }
  #trade .tag .left { font: 12px/1 -apple-system, sans-serif; color: #c9b48f; margin-top: 7px; letter-spacing: .04em; }
  #trade .tag .act { margin-top: 10px; font: 13px/1 -apple-system, sans-serif; display: inline-flex; gap: 8px; align-items: center; }
  #trade .tag.poor .act { color: #e09a7f; }
  .beads { display: inline-flex; gap: 3px; } .beads i { width: 7px; height: 7px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #fffaf0, #d9cdb6 70%); box-shadow: 0 1px 1px rgba(0,0,0,.5); }
  #trade .line { position: absolute; left: 50%; bottom: 74px; transform: translateX(-50%); width: min(720px, 90vw); text-align: center; transition: opacity .4s; text-shadow: 0 1px 2px #000, 0 0 20px rgba(0,0,0,.9); }
  #trade .line .who { font: 600 11px/1 -apple-system, sans-serif; letter-spacing: .24em; text-transform: uppercase; color: #e2b77a; margin-bottom: 8px; }
  #trade .line .say { font: italic 19px/1.4 "Iowan Old Style", Georgia, serif; }
  #trade .purse { position: absolute; right: 30px; bottom: 26px; text-align: right; text-shadow: 0 1px 3px #000; }
  #trade .purse .n { font: 600 28px/1 "Iowan Old Style", Georgia, serif; } #trade .purse .lbl { font: 11px/1 -apple-system, sans-serif; letter-spacing: .2em; text-transform: uppercase; color: #cdb995; margin-top: 6px; }
  #trade .purse .sat { font: 12px/1.4 -apple-system, sans-serif; color: #cdb995; margin-top: 8px; max-width: 260px; }
  #trade .purse.bump .n { animation: bump .5s ease-out; } @keyframes bump { 0% { color: #ffd38c; transform: scale(1.2); } 100% { transform: none; } }
  #trade .help { position: absolute; left: 34px; bottom: 28px; font: 12.5px/1.6 -apple-system, sans-serif; color: #e0d2b8; text-shadow: 0 1px 3px #000; display: flex; flex-direction: column; gap: 4px; }
  #trade .help span { display: flex; gap: 8px; align-items: center; }
  .fly { position: fixed; z-index: 10; width: 8px; height: 8px; margin: -4px; border-radius: 50%; pointer-events: none; background: radial-gradient(circle at 35% 35%, #fffaf0, #d9cdb6 70%); box-shadow: 0 1px 2px rgba(0,0,0,.6); transition: transform .45s cubic-bezier(.3,.1,.3,1), opacity .2s .4s; }
  @media (max-width: 640px) { #trade .help { display: none; } #trade .tag { width: 220px; } }
`;

export default function createShops(scene, T, { renderer, camera }) {
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const prompt = document.createElement('div'); prompt.id = 'prompt'; document.body.appendChild(prompt);
  const ui = document.createElement('div'); ui.id = 'trade';
  ui.innerHTML = `<div class="vignette"></div><div class="house"></div>
    <div class="leave" data-leave><span class="kb">E</span> Leave</div>
    <div class="tag"></div><div class="line"><div class="who"></div><div class="say"></div></div>
    <div class="purse"><div class="n"></div><div class="lbl">shell beads</div><div class="sat"></div></div>
    <div class="help"><span><span class="kb">←</span><span class="kb">→</span> or point to choose</span><span><span class="kb">Enter</span> or click to trade</span></div>`;
  document.body.appendChild(ui);
  const $ = (s) => ui.querySelector(s);
  const make = makeGoods(T);
  const purse = { beads: 20 }, satchel = [];

  // ---- build each trading table and lay out its goods
  const tables = {};
  const plank = new THREE.MeshStandardMaterial({ map: T.wood.map, normalMap: T.wood.normalMap, color: 0xb59c82, roughness: 0.9 });
  const barkM = new THREE.MeshStandardMaterial({ map: T.bark.map, normalMap: T.bark.normalMap, roughness: 0.95 });
  const clothTex = suede('#a98258', '#3a2414', 61); clothTex.map.repeat.set(2, 1.3); clothTex.normalMap.repeat.set(2, 1.3);
  const hideM = new THREE.MeshStandardMaterial({ map: clothTex.map, normalMap: clothTex.normalMap, color: 0xe8d6bc, roughness: 0.92, side: THREE.DoubleSide });
  for (const b of W.HOUSES) {
    const f = W.doorFrame(b), side = W.TRADE[b.key].side, c = f.at(2.1, 0, side * 2.05);
    const ground = W.terrainHeight(c.x, c.z);
    const g = new THREE.Group(); g.position.set(c.x, ground, c.z);
    const nV = new THREE.Vector3(f.dir, 0, 0), tV = new THREE.Vector3(0, 0, f.dir);
    g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(nV, new THREE.Vector3(0, 1, 0), tV));
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.07, 0.78), plank); top.position.y = 0.6; g.add(top);
    for (const x of [-0.5, 0.5]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.62, 10), barkM); leg.position.set(x, 0.28, 0); g.add(leg); }
    // a hide thrown over the top, its edges falling over the sides
    const cloth = new THREE.PlaneGeometry(1.75, 1.05, 24, 12); cloth.rotateX(-Math.PI / 2);
    const p = cloth.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), over = Math.max(0, Math.abs(z) - 0.39), overX = Math.max(0, Math.abs(x) - 0.775);
      p.setY(i, 0.642 - over * 1.6 - overX * 1.4 + Math.sin(x * 9 + z * 5) * 0.004);
      p.setZ(i, Math.sign(z) * Math.min(Math.abs(z), 0.39 + over * 0.25)); p.setX(i, Math.sign(x) * Math.min(Math.abs(x), 0.775 + overX * 0.3));
    }
    cloth.computeVertexNormals();
    g.add(new THREE.Mesh(cloth, hideM));
    g.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    const items = SHOPS[b.key].wares.map((w, i) => {
      const it = make[w.make](); it.traverse((o) => { if (o.isMesh) o.material = o.material.clone(); });
      it.position.set(w.at[0], 0.646, -side * w.at[1] * 0.17); it.rotation.y = (Math.random() - 0.5) * 0.5;
      g.add(it);
      return { w, obj: it, base: it.position.clone(), rot: it.rotation.y, lift: 0, stock: w.stock };
    });
    scene.add(g);
    for (const x of [-0.45, 0.45]) { const q = new THREE.Vector3(x, 0, 0).applyQuaternion(g.quaternion).add(g.position); W.CIRCLES.push({ x: q.x, z: q.z, r: 0.5 }); }
    // the view while trading: standing on the path, looking down at the goods with the doorway beyond
    g.updateMatrixWorld(true);
    const pos = new THREE.Vector3(0.48, 1.24, -side * 0.9).applyMatrix4(g.matrixWorld);
    const target = new THREE.Vector3(-0.1, 0.66, -side * 0.02).applyMatrix4(g.matrixWorld);
    const lamp = new THREE.Vector3(0.35, 1.7, -side * 0.75).applyMatrix4(g.matrixWorld), centre = new THREE.Vector3(0, 0.66, 0).applyMatrix4(g.matrixWorld);
    tables[b.key] = { g, items, view: { pos, target }, lamp, centre };
  }

  {                                                                       // your workshop: the display rack by the entrance, still empty
    const y = W.terrainHeight(W.WORKSHOP.x, W.WORKSHOP.z);
    tables.workshop = { g: null, items: [], own: true, view: { pos: new THREE.Vector3(1.3, y + 1.5, 53.4), target: new THREE.Vector3(3.4, y + 0.95, 56.5) } };
  }

  // ---- a soft, warm light over the table while you trade (always present, so turning it up costs nothing)
  const spot = new THREE.SpotLight(0xffd6a8, 0, 4.5, 0.62, 0.85, 1.4);
  scene.add(spot, spot.target);

  // ---- state
  let near = null, open = null, sel = 0, lineTimer = 0, busy = false;
  const raycaster = new THREE.Raycaster(), mouse = new THREE.Vector2(), tmp = new THREE.Vector3();

  function say(kind) {
    const s = SHOPS[open]; if (!s) return;
    $('.who').textContent = s.keeper; $('.say').textContent = `“${pick(s.lines[kind])}”`;
    $('.line').style.opacity = 1; lineTimer = 5.5;
  }
  function renderPurse() {
    $('.purse .n').textContent = purse.beads;
    $('.purse .sat').textContent = satchel.length ? `Satchel: ${satchel.join(', ')}` : 'Satchel: empty';
  }
  function available(t) { return t.items.filter((i) => i.stock > 0); }
  function renderTag() {
    const t = tables[open], it = t.items[sel], tag = $('.tag');
    if (t.own) {
      tag.className = 'tag own'; tag.style.left = '50%'; tag.style.top = '42%';
      tag.innerHTML = `<div class="name">The display hide</div><div class="rule"></div><div class="desc">Nothing laid out yet. The knives you make will hang here,
        and customers' orders will wait by the work stump.</div>`;
      tag.style.opacity = 1; return;
    }
    if (!it || it.stock <= 0) { tag.style.opacity = 0; return; }
    const poor = purse.beads < it.w.price;
    tag.className = `tag${poor ? ' poor' : ''}`;
    tag.innerHTML = `<div class="name">${it.w.name}</div><div class="rule"></div>
      <div class="price"><span class="beads">${'<i></i>'.repeat(Math.min(it.w.price, 8))}</span>${it.w.price} bead${it.w.price === 1 ? '' : 's'}</div>
      <div class="desc">${it.w.desc}</div><div class="left">${it.stock} left</div>
      <div class="act">${poor ? 'Not enough beads' : '<span class="kb">Enter</span> Trade'}</div>`;
    tag.style.opacity = 1;
  }
  function choose(i) {
    const t = tables[open], list = t.items;
    if (!list.some((x) => x.stock > 0)) return;
    let k = ((i % list.length) + list.length) % list.length, guard = 0;
    while (list[k].stock <= 0 && guard++ < list.length) k = (k + Math.sign(i - sel || 1) + list.length) % list.length;
    sel = k; renderTag();
  }

  function enter(key) {
    if (!tables[key]) return;
    Sound.unlock();
    open = key; STATE.paused = true; STATE.view = tables[key].view; busy = false;
    if (tables[key].lamp) { spot.position.copy(tables[key].lamp); spot.target.position.copy(tables[key].centre); spot.target.updateMatrixWorld(); }
    if (document.pointerLockElement) document.exitPointerLock();
    if (DOOR_LEAVES[key]) { DOOR_LEAVES[key].target = 1; Sound.creak(true); }
    $('.house').textContent = SHOPS[key].house;
    $('.help').style.display = tables[key].own ? 'none' : '';
    prompt.classList.remove('on'); ui.classList.add('on');
    sel = Math.max(0, tables[key].items.findIndex((i) => i.stock > 0));
    renderPurse(); renderTag();
    setTimeout(() => open === key && say('greet'), 600);
  }
  function leave(relock) {
    if (!open) return;
    const key = open; say('leave'); $('.tag').style.opacity = 0;
    open = null; STATE.view = null;
    setTimeout(() => { if (!open) { ui.classList.remove('on'); } }, 900);
    setTimeout(() => { if (DOOR_LEAVES[key]) { DOOR_LEAVES[key].target = 0; Sound.creak(false); } }, 500);
    setTimeout(() => { if (!open) STATE.paused = false; }, 700);
    if (relock) renderer.domElement.requestPointerLock?.()?.catch?.(() => {});
  }

  function screenOf(obj, up = 0) { obj.getWorldPosition(tmp); tmp.y += up; tmp.project(camera); return [(tmp.x * 0.5 + 0.5) * innerWidth, (-tmp.y * 0.5 + 0.5) * innerHeight]; }
  function trade() {
    if (!open || busy) return;
    const t = tables[open], it = t.items[sel];
    if (!it || it.stock <= 0) return;
    if (purse.beads < it.w.price) { say('poor'); Sound.deny(); return; }
    busy = true;
    // the beads: counted out of your purse onto the hide, one by one
    const from = $('.purse .n').getBoundingClientRect(), [tx, ty] = screenOf(it.obj, 0.02);
    for (let k = 0; k < it.w.price; k++) {
      setTimeout(() => {
        const b = document.createElement('div'); b.className = 'fly'; b.style.left = `${from.left + from.width / 2}px`; b.style.top = `${from.top + 6}px`; document.body.appendChild(b);
        requestAnimationFrame(() => { b.style.transform = `translate(${tx - from.left - from.width / 2 + (Math.random() - 0.5) * 40}px, ${ty - from.top - 6 + (Math.random() - 0.5) * 16}px)`; b.style.opacity = '0'; });
        setTimeout(() => b.remove(), 900); Sound.bead(0.42);
        purse.beads--; renderPurse();
      }, k * 110);
    }
    setTimeout(() => {
      // the good lifts off the hide and goes to your satchel
      const ghost = it.obj.clone(); it.obj.parent.add(ghost); ghost.position.copy(it.obj.position);
      const start = performance.now();
      const fly = () => {
        const k = Math.min(1, (performance.now() - start) / 650);
        ghost.position.y = it.base.y + 0.25 * Math.sin(k * Math.PI) + k * 0.5; ghost.position.x = it.base.x + k * 0.7; ghost.scale.setScalar(1 - k * 0.85);
        if (k < 1) requestAnimationFrame(fly); else ghost.removeFromParent();
      };
      fly(); Sound.thunk(0.15);
      it.stock--; satchel.push(it.w.name);
      if (it.stock <= 0) { it.obj.visible = false; say('gone'); } else say('buy');
      $('.purse').classList.remove('bump'); void $('.purse').offsetWidth; $('.purse').classList.add('bump');
      renderPurse();
      if (it.stock <= 0) choose(sel + 1); else renderTag();
      busy = false;
    }, it.w.price * 110 + 260);
  }

  // ---- input
  prompt.addEventListener('click', () => { if (near && !open) enter(near); });
  ui.addEventListener('click', (e) => { if (e.target.closest('[data-leave]')) leave(true); });
  window.forgedTrade = { tables, enter, leave, get open() { return open; } };   // for checking views from the console
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyE' && !e.repeat) { if (open) leave(true); else if (near) enter(near); return; }
    if (!open) return;
    if (e.code === 'Escape') leave(false);
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') choose(sel + 1);
    else if (e.code === 'ArrowLeft' || e.code === 'KeyA') choose(sel - 1);
    else if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); trade(); }
  });
  renderer.domElement.addEventListener('pointermove', (e) => {
    if (!open) return;
    mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    raycaster.setFromCamera(mouse, camera);
    const t = tables[open], hit = raycaster.intersectObjects(t.items.filter((i) => i.stock > 0).map((i) => i.obj), true)[0];
    if (!hit) return;
    const idx = t.items.findIndex((i) => { let o = hit.object; while (o) { if (o === i.obj) return true; o = o.parent; } return false; });
    if (idx >= 0 && idx !== sel) { sel = idx; renderTag(); }
  });
  renderer.domElement.addEventListener('click', () => { if (open && STATE.viewMix > 0.8) trade(); });

  // ---- every frame
  const fwd = new THREE.Vector3();
  return (dt, cam, player) => {
    const t = U.uTime.value;
    spot.intensity += ((open && tables[open].lamp ? 7 : 0) - spot.intensity) * Math.min(1, dt * 3);
    if (open) {
      const tb = tables[open];
      tb.items.forEach((it, i) => {                                       // the chosen good lifts into the light
        const on = i === sel && it.stock > 0;
        it.lift += ((on ? 1 : 0) - it.lift) * Math.min(1, dt * 8);
        it.obj.position.y = it.base.y + it.lift * (0.035 + Math.sin(t * 2.2) * 0.006);
        it.obj.rotation.y = it.rot + it.lift * Math.sin(t * 0.9) * 0.35;
        it.obj.traverse((o) => { if (o.isMesh && o.material.emissive) { o.material.emissive.setRGB(0.3, 0.2, 0.1); o.material.emissiveIntensity = it.lift * 0.22; } });
      });
      const it = tb.items[sel];
      if (it && it.stock > 0 && !tb.own) { const [x, y] = screenOf(it.obj, 0.16); const tag = $('.tag'); tag.style.left = `${x}px`; tag.style.top = `${y}px`; }
      lineTimer -= dt; if (lineTimer <= 0) $('.line').style.opacity = 0;
      return;
    }
    lineTimer -= dt; if (lineTimer <= 0) $('.line').style.opacity = 0;
    for (const tb of Object.values(tables)) tb.items.forEach((it) => {      // settle any good left lifted
      if (it.lift > 0.001) { it.lift *= 1 - Math.min(1, dt * 8); it.obj.position.y = it.base.y + it.lift * 0.035; it.obj.traverse((o) => { if (o.isMesh && o.material.emissive) o.material.emissiveIntensity = it.lift * 0.22; }); }
    });
    if (STATE.paused) return;
    cam.getWorldDirection(fwd);
    let best = null, bestD = Infinity;
    for (const d of W.DOORS) {
      const dist = Math.hypot(player.x - d.x, player.z - d.z);
      if (dist > d.reach + 0.4 || dist > bestD) continue;
      const tx = d.fx - player.x, tz = d.fz - player.z, tl = Math.hypot(tx, tz) || 1;
      if ((fwd.x * tx + fwd.z * tz) / (Math.hypot(fwd.x, fwd.z) || 1) / tl < 0.35) continue;
      best = d.key; bestD = dist;
    }
    if (best !== near) {
      near = best;
      if (near) prompt.innerHTML = near === 'workshop' ? '<span class="kb">E</span> Your workshop' : `<span class="kb">E</span> Trade with ${SHOPS[near].keeper} · ${SHOPS[near].house.replace('The ', 'the ')}`;
      prompt.classList.toggle('on', !!near);
    }
  };
}
