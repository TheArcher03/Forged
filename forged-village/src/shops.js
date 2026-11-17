// Walk up to a doorway, press E, and that building's shop page opens.
// The three family houses sell their own goods for shell beads; the workshop page is yours:
// what's laid out for sale, the orders waiting, and what you're carrying.
// Prices and wares are placeholders for Timothy to change.
import * as THREE from 'three';
import * as W from './world.js';
import { STATE } from './shared.js';

const SHOPS = {
  hide: {
    kicker: 'The Hide House · tanners', title: 'Tamsa & Brok', tone: '#b9824e',
    lede: 'Hides scraped, smoked and soft enough to wear. Tamsa does the talking; Brok keeps scraping.',
    wares: [
      { name: 'Cured deer hide', price: 6, color: '#a87a4f', desc: 'Smoked over birch. Supple, and it sheds the rain.' },
      { name: 'Sinew bundle', price: 2, color: '#d8c7a4', desc: 'Dried deer sinew. Wet it and wrap it; it shrinks tight as it dries. Good for binding a blade to its handle.' },
      { name: 'Rawhide cord', price: 1, color: '#8a6a48', desc: 'A long coil, cut in one spiral from a single hide.' },
      { name: 'Knee pad', price: 3, color: '#6e5038', desc: 'Thick hide for a knapper’s knee. Old Greyhand wore through three of these.' },
      { name: 'Fox pelt', price: 5, color: '#c6743c', desc: 'Winter fur, stretched and dried.' },
    ],
  },
  hearth: {
    kicker: 'The Hearth House · grain and bread', title: 'Grandmother Oda & Sefa', tone: '#c9a35a',
    lede: 'Warm bread off the oven floor. Oda knows everyone’s business, and shares it with every loaf.',
    wares: [
      { name: 'Flatbread', price: 1, color: '#d6b072', desc: 'Emmer flour, baked on the oven floor this morning.' },
      { name: 'Basket of emmer', price: 4, color: '#c9a35a', desc: 'Threshed and winnowed. A family’s worth for a week.' },
      { name: 'Hazelnuts', price: 1, color: '#9a6a3a', desc: 'A pouchful, roasted in the embers.' },
      { name: 'Birch tar cake', price: 3, color: '#2c2420', desc: 'Boiled down from birch bark. Warm it, and it glues a blade into its handle.' },
      { name: 'Dried apples', price: 2, color: '#b5523a', desc: 'Small and sour, threaded on a string.' },
    ],
  },
  clay: {
    kicker: 'The Clay House · potter', title: 'Ilo & Nee', tone: '#c0643f',
    lede: 'Ilo makes them; Nee paints them and does the trading. Look for his thumbprint inside the base.',
    wares: [
      { name: 'Drinking cup', price: 2, color: '#c98760', desc: 'Small enough for one hand, its rim pressed with cord.' },
      { name: 'Cooking pot', price: 5, color: '#8e5a40', desc: 'Round-bottomed, to sit down in the coals.' },
      { name: 'Storage jar', price: 7, color: '#b06c48', desc: 'Tall, with a wooden lid. Keeps grain dry through the winter.' },
      { name: 'Tar pot', price: 4, color: '#5e4032', desc: 'Small and thick-walled, for heating birch tar.' },
      { name: 'Red ochre', price: 2, color: '#a8381f', desc: 'Ground fine and mixed with fat. For marking what’s yours.' },
    ],
  },
  workshop: {
    kicker: 'Your workshop · the knapping shelter', title: 'Old Greyhand’s shelter', tone: '#d9773c', own: true,
    lede: 'Forty winters of his flakes crunch underfoot. It’s yours now.',
  },
};
const NAMES = { hide: 'the Hide House', hearth: 'the Hearth House', clay: 'the Clay House', workshop: 'your workshop' };

const CSS = `
  #prompt { position: fixed; left: 50%; bottom: 44px; transform: translate(-50%, 8px); opacity: 0; transition: opacity .2s, transform .2s;
    background: rgba(24, 19, 15, 0.78); color: #f3e6cf; border: 1px solid rgba(217, 160, 100, 0.35); border-radius: 999px;
    padding: 9px 18px 9px 10px; font: 600 15px/1 -apple-system, "Helvetica Neue", sans-serif; z-index: 8; cursor: pointer;
    display: flex; align-items: center; gap: 10px; backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); pointer-events: none; }
  #prompt.on { opacity: 1; transform: translate(-50%, 0); pointer-events: auto; }
  #prompt kbd, .shop kbd { background: #f3e6cf; color: #2a2119; border: 0; border-radius: 6px; padding: 4px 8px; font: 700 13px/1 -apple-system, sans-serif; }
  .shop { position: fixed; inset: 0; z-index: 20; display: flex; align-items: center; justify-content: center; padding: 18px;
    background: radial-gradient(ellipse at center, rgba(20, 15, 11, 0.55), rgba(10, 7, 5, 0.86));
    backdrop-filter: blur(5px) saturate(0.85); -webkit-backdrop-filter: blur(5px) saturate(0.85); color: #efe2cb;
    font: 15px/1.45 -apple-system, "Helvetica Neue", sans-serif; animation: shopIn .22s ease-out; }
  .shop[hidden] { display: none; }
  @keyframes shopIn { from { opacity: 0; } to { opacity: 1; } }
  .shop-panel { width: min(680px, 100%); max-height: calc(100vh - 36px); overflow: auto; border-radius: 16px;
    background: linear-gradient(180deg, #2c241d, #221b16); border: 1px solid #4a3c30; box-shadow: 0 24px 80px rgba(0, 0, 0, 0.55);
    animation: panelIn .25s cubic-bezier(.2, .8, .2, 1); }
  @keyframes panelIn { from { transform: translateY(14px) scale(.985); } to { transform: none; } }
  .shop-head { position: relative; padding: 22px 26px 18px; border-bottom: 1px solid #3c3128; }
  .shop-head::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 5px; background: var(--tone); border-radius: 16px 0 0 0; }
  .shop-kicker { color: var(--tone); font-size: 12px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
  .shop h2 { margin: 4px 0 6px; font: 600 30px/1.15 "Iowan Old Style", Georgia, "Times New Roman", serif; color: #f6ead4; }
  .shop-lede { margin: 0; color: #c2b39c; max-width: 52ch; }
  .shop-leave { position: absolute; right: 18px; top: 18px; background: transparent; color: #cdbda4; border: 1px solid #4d3f33;
    border-radius: 10px; padding: 7px 10px; font: 600 13px/1 -apple-system, sans-serif; cursor: pointer; display: flex; gap: 8px; align-items: center; }
  .shop-leave:hover { background: #352b23; color: #fff; }
  .wares { list-style: none; margin: 0; padding: 8px 14px; }
  .ware { display: grid; grid-template-columns: 34px 1fr auto auto; gap: 14px; align-items: center; padding: 12px; border-radius: 12px; }
  .ware + .ware { border-top: 1px solid rgba(255, 255, 255, 0.04); }
  .ware:hover { background: rgba(255, 255, 255, 0.03); }
  .swatch { width: 34px; height: 34px; border-radius: 9px; background: var(--c); box-shadow: inset 0 -6px 12px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15); }
  .ware-name { font-weight: 650; color: #f3e6cf; }
  .ware-desc { color: #a99a84; font-size: 13.5px; }
  .price { display: flex; align-items: center; gap: 6px; font-variant-numeric: tabular-nums; color: #e9d8b8; font-weight: 650; white-space: nowrap; }
  .beads { display: inline-flex; gap: 2px; }
  .beads i { width: 6px; height: 6px; border-radius: 50%; background: #efe4cf; box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.35); }
  .trade { background: var(--tone); color: #1f1812; border: 0; border-radius: 10px; padding: 9px 14px; font: 700 13.5px/1 -apple-system, sans-serif; cursor: pointer; min-width: 74px; }
  .trade:hover { filter: brightness(1.08); }
  .trade:disabled { background: #3a3029; color: #8d7e6b; cursor: default; filter: none; }
  .trade.done { background: #7fae6e; color: #14200f; }
  .shop-foot { display: flex; flex-wrap: wrap; gap: 10px 18px; align-items: center; padding: 14px 26px 20px; border-top: 1px solid #3c3128; color: #b8a890; font-size: 13.5px; }
  .purse { display: flex; align-items: center; gap: 8px; color: #f3e6cf; font-weight: 700; }
  .purse b { font-size: 18px; font-variant-numeric: tabular-nums; }
  .purse.bump b { animation: bump .45s ease-out; }
  @keyframes bump { 0% { color: #ffd38c; transform: scale(1.25); } 100% { transform: none; } }
  .satchel { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { background: #362c24; border: 1px solid #4a3c30; border-radius: 999px; padding: 3px 10px; color: #e2d3ba; font-size: 12.5px; }
  .section { padding: 16px 26px 4px; }
  .section h3 { margin: 0 0 8px; font-size: 12px; letter-spacing: .12em; text-transform: uppercase; color: #a3927b; }
  .empty { border: 1px dashed #4a3c30; border-radius: 12px; padding: 18px; color: #a99a84; text-align: center; }
  @media (max-width: 560px) { .ware { grid-template-columns: 28px 1fr; } .ware .price, .ware .trade { grid-column: 2; justify-self: start; } .shop h2 { font-size: 24px; } }
`;

export default function createShops(scene, T, { renderer }) {
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const prompt = document.createElement('div'); prompt.id = 'prompt'; prompt.setAttribute('role', 'button'); document.body.appendChild(prompt);
  const page = document.createElement('div'); page.className = 'shop'; page.hidden = true; page.setAttribute('role', 'dialog'); page.setAttribute('aria-modal', 'true'); document.body.appendChild(page);

  const purse = { beads: 20 }, satchel = [];
  let near = null, open = null;
  const beadDots = (n) => `<span class="beads" aria-hidden="true">${'<i></i>'.repeat(Math.min(n, 7))}</span>`;
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

  function footer() {
    const chips = satchel.length ? satchel.map((n) => `<span class="chip">${esc(n)}</span>`).join('') : '<span class="chip" style="opacity:.6">empty</span>';
    return `<div class="shop-foot"><span class="purse">${beadDots(3)} <b id="purse-n">${purse.beads}</b> shell beads</span>
      <span>Satchel:</span><span class="satchel">${chips}</span></div>`;
  }
  function render(key) {
    const s = SHOPS[key];
    let body;
    if (s.own) {
      body = `<div class="section"><h3>On the display hide</h3><div class="empty">Nothing laid out yet. The knives you make will go here.</div></div>
        <div class="section"><h3>Orders</h3><div class="empty">No customers yet. When people want a blade, their orders will wait here.</div></div>`;
    } else {
      body = `<ul class="wares">${s.wares.map((w, i) => `<li class="ware">
          <span class="swatch" style="--c:${w.color}"></span>
          <span><div class="ware-name">${esc(w.name)}</div><div class="ware-desc">${esc(w.desc)}</div></span>
          <span class="price">${beadDots(w.price)} ${w.price}</span>
          <button class="trade" data-i="${i}" ${purse.beads < w.price ? 'disabled title="Not enough beads"' : ''}>Trade</button>
        </li>`).join('')}</ul>`;
    }
    page.innerHTML = `<div class="shop-panel" style="--tone:${s.tone}">
      <div class="shop-head"><div class="shop-kicker">${esc(s.kicker)}</div><h2>${esc(s.title)}</h2><p class="shop-lede">${esc(s.lede)}</p>
        <button class="shop-leave" data-leave>Leave <kbd>E</kbd></button></div>
      ${body}${footer()}</div>`;
  }

  function openShop(key) {
    open = key; STATE.paused = true;
    if (document.pointerLockElement) document.exitPointerLock();
    render(key); page.hidden = false; prompt.classList.remove('on');
    page.querySelector('[data-leave]').focus({ preventScroll: true });
  }
  function closeShop(relock) {
    open = null; page.hidden = true; STATE.paused = false;
    if (relock) renderer.domElement.requestPointerLock?.()?.catch?.(() => {});
  }

  page.addEventListener('click', (e) => {
    if (e.target === page || e.target.closest('[data-leave]')) return closeShop(true);
    const btn = e.target.closest('.trade');
    if (!btn || btn.disabled || !open) return;
    const w = SHOPS[open].wares[+btn.dataset.i];
    if (purse.beads < w.price) return;
    purse.beads -= w.price; satchel.push(w.name);
    render(open);
    const again = page.querySelector(`.trade[data-i="${btn.dataset.i}"]`);
    if (again) { again.classList.add('done'); again.textContent = 'Traded'; }
    page.querySelector('.purse')?.classList.add('bump');
  });
  prompt.addEventListener('click', () => { if (near && !open) openShop(near); });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyE' && !e.repeat) {
      if (open) closeShop(true); else if (near) openShop(near);
    } else if (e.code === 'Escape' && open) closeShop(false);
  });

  const fwd = new THREE.Vector3();
  function update(dt, camera, player) {
    if (open) return;
    camera.getWorldDirection(fwd);
    let best = null, bestD = Infinity;
    for (const d of W.DOORS) {
      const dist = Math.hypot(player.x - d.x, player.z - d.z);
      if (dist > d.reach || dist > bestD) continue;
      const tx = d.fx - player.x, tz = d.fz - player.z, tl = Math.hypot(tx, tz) || 1;
      if ((fwd.x * tx + fwd.z * tz) / (Math.hypot(fwd.x, fwd.z) || 1) / tl < 0.4) continue;   // must be facing the doorway
      best = d.key; bestD = dist;
    }
    if (best !== near) {
      near = best;
      if (near) prompt.innerHTML = `<kbd>E</kbd> ${near === 'workshop' ? 'Open your workshop' : `Enter ${NAMES[near]}`}`;
      prompt.classList.toggle('on', !!near);
    }
  }
  window.forgedShops = { open: openShop, close: closeShop, purse, satchel, get near() { return near; }, get isOpen() { return open; } };
  return update;
}
