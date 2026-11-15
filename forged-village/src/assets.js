// Photo-scanned textures and models (CC0, from polyhaven.com), loaded from the assets folder.
// If a file is missing the scene falls back to the code-made version of that thing.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const TEX = 'assets/tex/', MODELS = 'assets/models/';
const loader = new THREE.TextureLoader();

function tex(name, kind, rotate) {
  return loader.loadAsync(`${TEX}${name}_${kind}.jpg`).then((t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    t.colorSpace = kind === 'diff' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    if (rotate) { t.center.set(0.5, 0.5); t.rotation = Math.PI / 2; }
    return t;
  });
}
const pair = async (name, rotate = false) => ({ map: await tex(name, 'diff', rotate), normalMap: await tex(name, 'nor', rotate) });

// Returns { material, parts: { nodeName: geometry } } with each part centred on the ground at the origin.
async function model(name) {
  const gltf = await new GLTFLoader().loadAsync(`${MODELS}${name}/${name}.gltf`);
  const parts = {}; let material = null;
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    material = o.material;
    const g = o.geometry; g.computeBoundingBox();
    const b = g.boundingBox, c = b.getCenter(new THREE.Vector3());
    g.translate(-c.x, 0, -c.z);
    g.userData.size = b.getSize(new THREE.Vector3()); g.userData.minY = b.min.y;
    parts[o.name] = g;
  });
  material.side = material.alphaTest > 0 ? THREE.DoubleSide : THREE.FrontSide;
  return { material, parts, list: Object.values(parts) };
}

export async function loadScans(T) {
  const want = {
    grass: pair('leafy_grass'), dirt: pair('brown_mud_dry'), forest: pair('forest_ground_04'), gravel: pair('river_small_rocks'),
    bark: pair('pine_bark'), barkBroad: pair('bark_willow'), thatch: pair('thatch_roof_angled'), chalk: pair('rock_face_03'),
    wood: pair('weathered_brown_planks', true), rock: pair('mossy_rock'),
  };
  const names = ['fern_02', 'shrub_03', 'weed_plant_02', 'rock_moss_set_01', 'rock_moss_set_02', 'rock_face_01', 'rock_face_02', 'tree_stump_01', 'dead_tree_trunk', 'wicker_basket_01', 'boulder_01'];
  T.scan = {}; T.scanned = {};
  await Promise.all([
    ...Object.entries(want).map(([k, p]) => p.then((v) => { T[k] = v; T.scanned[k] = true; }).catch((e) => console.warn('[scan texture]', k, e.message || e))),
    ...names.map((n) => model(n).then((m) => { T.scan[n] = m; }).catch((e) => console.warn('[scan model]', n, e.message || e))),
  ]);
  return T;
}
