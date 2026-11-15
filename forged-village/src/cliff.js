// The chalk bank behind the workshop: a real rock face with beds, ledges and joints,
// and dark flint weathering out of it in bands.
import * as THREE from 'three';
import * as W from './world.js';
import { fbm, rng } from './noise.js';
import { rockGeometry } from './forest.js';

export default function createCliff(scene, T) {
  const X0 = -64, X1 = 64, STEP = 0.32, ROWS = 44;
  const cols = Math.round((X1 - X0) / STEP);
  const pos = [], uv = [], col = [], idx = [];
  const face = (x, v) => {
    const e = W.cliffEdge(x), base = W.terrainHeight(x, e - 0.4) - 0.6, top = W.terrainHeight(x, e + 3.4) + 0.35;
    const y = W.mix(base, top, v);
    const big = fbm(x * 0.11, y * 0.13, 3) * 1.3;
    const bed = (y / 1.5 + fbm(x * 0.07, 0.5, 2) * 1.6) % 1, lip = (1 - bed) * (1 - bed) * 0.42;      // each bed juts out over the one below
    const joint = Math.pow(1 - Math.abs(2 * fbm(x * 0.55, y * 0.07 + 7, 3) - 1), 6);                  // vertical cracks
    const out = (0.12 + big + lip - joint * 0.5) * W.mix(0.45, 1, W.smoothstep(0, 0.3, v));
    const shade = (0.72 + 0.28 * W.smoothstep(0, 0.35, bed)) * (1 - joint * 0.55);
    return { x, y, z: e - 0.1 + 2.0 * v - Math.max(out, 0.1), shade, bed };
  };
  for (let j = 0; j <= ROWS; j++) for (let i = 0; i <= cols; i++) {
    const x = X0 + i * STEP, f = face(x, (j / ROWS) * 1.04);
    pos.push(f.x, f.y, f.z); uv.push(x / 4.5, f.y / 4.5);
    const stain = 0.75 + 0.35 * fbm(x * 0.5, f.y * 0.05, 3), damp = W.smoothstep(0.25, 0, j / ROWS) * 0.3;   // rain streaks, damp foot
    col.push(f.shade * stain * (1 - damp) * 1.0, f.shade * stain * (1 - damp * 0.8) * 0.985, f.shade * stain * (1 - damp * 0.6) * 0.93);
  }
  for (let j = 0; j < ROWS; j++) for (let i = 0; i < cols; i++) {
    const a = j * (cols + 1) + i, b = a + cols + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  const cliff = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: T.chalk.map, normalMap: T.chalk.normalMap, vertexColors: true, roughness: 0.95, side: THREE.DoubleSide, normalScale: new THREE.Vector2(1.3, 1.3) }));
  // the scan is brown rock; chalk is the same stone bleached pale
  const bleach = (mat) => { mat.onBeforeCompile = (s) => { s.fragmentShader = s.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
    diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.33))), diffuseColor.rgb, 0.4) * vec3(2.3, 2.2, 1.95);`); }; return mat; };
  bleach(cliff.material);
  cliff.castShadow = cliff.receiveShadow = true;
  scene.add(cliff);

  // scanned rock faces, set into the bank so its outline is real stone
  const rs = rng(606), dummy = new THREE.Object3D();
  for (const name of ['rock_face_01', 'rock_face_02']) {
    const scan = T.scan?.[name]; if (!scan) continue;
    const g = scan.list[0], count = name === 'rock_face_01' ? 9 : 8;
    const mesh = new THREE.InstancedMesh(g, bleach(scan.material.clone()), count);
    for (let i = 0; i < count; i++) {
      let x = -38 + rs() * 76; if (Math.abs(x) < 9 && rs() > 0.3) x += Math.sign(x || 1) * 12;
      const s = 1.6 + rs() * 1.4, v = rs() * 0.55, f = face(x, v);
      dummy.position.set(x, f.y - 0.6 * s - g.userData.minY * s, f.z + 1.0 * s); dummy.rotation.set((rs() - 0.5) * 0.2, (rs() - 0.5) * 1.2 + (i % 2 ? Math.PI : 0), (rs() - 0.5) * 0.2);
      dummy.scale.set(s, s * (0.9 + rs() * 0.5), s); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false; scene.add(mesh);
  }

  // flint nodules, sitting in lines along the bedding
  const r = rng(505), m = new THREE.Object3D(), c = new THREE.Color();
  const N = 110, flint = new THREE.InstancedMesh(rockGeometry(6, 2), new THREE.MeshStandardMaterial({ color: 0x2b2a2a, roughness: 0.45 }), N);
  for (let i = 0; i < N; i++) {
    let f; for (let k = 0; k < 12; k++) { f = face(-34 + r() * 68, 0.05 + r() * 0.9); if (f.bed < 0.16) break; }
    const s = 0.035 + r() * 0.07;
    m.position.set(f.x, f.y, f.z - 0.02); m.rotation.set(r() * 6, r() * 6, r() * 6); m.scale.set(s * 1.5, s, s); m.updateMatrix();
    flint.setMatrixAt(i, m.matrix); const v = 0.7 + r() * 0.6; flint.setColorAt(i, c.setRGB(v, v, v * 1.05));
  }
  flint.castShadow = true; scene.add(flint);
}
