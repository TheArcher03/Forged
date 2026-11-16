// The ground: one detailed mesh for the valley, one coarse mesh for the country beyond.
import * as THREE from 'three';
import * as W from './world.js';
import { fbm } from './noise.js';
import { U } from './shared.js';

export function createTerrain(scene, T) {
  const X0 = -90, X1 = 90, Z0 = -70, Z1 = 140, STEP = 0.5;
  const nx = (X1 - X0) / STEP, nz = (Z1 - Z0) / STEP;
  const geo = new THREE.PlaneGeometry(X1 - X0, Z1 - Z0, nx, nz);
  geo.rotateX(-Math.PI / 2);
  geo.translate((X0 + X1) / 2, 0, (Z0 + Z1) / 2);
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  const splat = new Float32Array(pos.count * 4), aoWet = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = W.terrainHeight(x, z);
    pos.setY(i, h);
    uv.setXY(i, x / 4, z / 4);
    const e = W.cliffEdge(x), cz = Math.abs(z - W.creekZ(x));
    const nearValley = Math.abs(x) < 26 && z > -9 && z < e + 1;
    const dirt = nearValley ? W.dirtAmount(x, z) : 0;
    const chalk = W.smoothstep(e - 0.5, e + 0.3, z) * W.smoothstep(e + 4.2, e + 2.4, z);
    const gravel = cz < 9 ? W.smoothstep(0.22, -0.02, h) * W.smoothstep(9, 5, cz) : 0;
    const woods = Math.max(W.smoothstep(20, 26, Math.abs(x)), W.smoothstep(-5, -10, z), W.smoothstep(e + 2, e + 6, z));
    const forest = woods * (1 - 0.8 * W.sunGap(x, z)) * (0.55 + 0.6 * fbm(x * 0.15, z * 0.15, 2));
    splat.set([dirt, chalk, gravel, W.clamp(forest, 0, 1)], i * 4);

    let ao = 1; // soft contact shadow where walls meet the ground
    for (const b of [...W.HOUSES, W.WORKSHOP]) {
      const d = Math.hypot(x - b.x, z - b.z) - b.r;
      if (d > -1 && d < 1.6) ao *= W.mix(0.5, 1, W.smoothstep(0, 1.6, Math.abs(d)));
    }
    const wet = cz < 9 ? W.smoothstep(0.28, 0.0, h) : 0;
    aoWet.set([ao, wet], i * 2);
  }
  geo.setAttribute('aSplat', new THREE.BufferAttribute(splat, 4));
  geo.setAttribute('aAoWet', new THREE.BufferAttribute(aoWet, 2));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({ map: T.grass.map, normalMap: T.grass.normalMap, roughness: 0.96, metalness: 0, normalScale: new THREE.Vector2(1.2, 1.2) });
  mat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, {
      tDirt: { value: T.dirt.map }, tDirtN: { value: T.dirt.normalMap }, tGravel: { value: T.gravel.map }, tGravelN: { value: T.gravel.normalMap },
      tForest: { value: T.forest.map }, tForestN: { value: T.forest.normalMap }, tChalk: { value: T.chalk.map }, tMacro: { value: T.macro }, tNpcShadow: U.tNpcShadow, uNpcShadowMat: U.uNpcShadowMat,
    });
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aSplat; attribute vec2 aAoWet; varying vec4 vSplat; varying vec2 vAoWet; varying vec3 vWPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSplat = aSplat; vAoWet = aAoWet; vWPos = position;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D tDirt, tDirtN, tGravel, tGravelN, tForest, tForestN, tChalk, tMacro;
        uniform sampler2D tNpcShadow; uniform mat4 uNpcShadowMat;
        varying vec4 vSplat; varying vec2 vAoWet; varying vec3 vWPos;`)
      .replace('#include <map_fragment>', `
        vec2 gUv = vWPos.xz;
        vec3 mac = texture2D(tMacro, gUv / 70.0).rgb;
        float det = texture2D(tMacro, gUv / 7.0).b;
        vec4 w = clamp((vSplat - 0.5) * 2.4 + 0.5 + (det - 0.5) * 1.1 * step(vec4(0.02), vSplat) * step(vSplat, vec4(0.98)), 0.0, 1.0);
        vec3 cGrass = texture2D(map, gUv / 2.6).rgb * (0.4 + mac.r * 0.4) * vec3(0.72, 1.0, 0.55);
        cGrass = mix(cGrass, cGrass * vec3(1.5, 1.25, 0.7), smoothstep(0.45, 0.8, mac.g));
        vec3 cDirt = texture2D(tDirt, gUv / 2.4).rgb * (0.95 + mac.g * 0.5) * vec3(1.08, 1.0, 0.9);
        vec3 cGravel = texture2D(tGravel, gUv / 1.8).rgb * 1.15;
        vec3 cForest = texture2D(tForest, gUv / 2.8).rgb * (0.6 + mac.r * 0.6);
        vec3 cChalk = texture2D(tChalk, vec2(vWPos.x + vWPos.z * 0.4, vWPos.y) / 4.0).rgb;
        cChalk = mix(vec3(dot(cChalk, vec3(0.33))), cChalk, 0.4) * vec3(2.3, 2.2, 1.95) * (0.8 + mac.g * 0.3);
        vec3 gcol = mix(cGrass, cForest, w.w);
        gcol = mix(gcol, cDirt, w.x);
        gcol = mix(gcol, cGravel, w.z);
        gcol = mix(gcol, cChalk, w.y);
        gcol *= vAoWet.x * mix(1.0, 0.36, vAoWet.y);
        // soft shadows cast by the villagers
        vec2 ns = (uNpcShadowMat * vec4(vWPos, 1.0)).xy; float e = 1.2 / 2048.0;
        float npc = (texture2D(tNpcShadow, ns + vec2(e, e)).r + texture2D(tNpcShadow, ns + vec2(-e, e)).r + texture2D(tNpcShadow, ns + vec2(e, -e)).r + texture2D(tNpcShadow, ns + vec2(-e, -e)).r + texture2D(tNpcShadow, ns).r) * 0.2;
        gcol *= 1.0 - 0.55 * npc;
        diffuseColor.rgb *= gcol;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.28, vAoWet.y * 0.9);')
      .replace('texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0',
        `mix(mix(mix(texture2D(normalMap, gUv / 2.6).xyz, texture2D(tForestN, gUv / 2.8).xyz, w.w), texture2D(tDirtN, gUv / 2.4).xyz, w.x), texture2D(tGravelN, gUv / 1.8).xyz, w.z) * 2.0 - 1.0;
         mapN.xy *= (1.0 - w.y * 0.8)`);
  };
  const ground = new THREE.Mesh(geo, mat);
  ground.receiveShadow = true;
  scene.add(ground);

  // --- the country beyond: coarse, forested hills fading into haze
  const S = 1500, N = 150;
  const far = new THREE.PlaneGeometry(S, S, N, N);
  far.rotateX(-Math.PI / 2); far.translate(0, 0, 35);
  const fp = far.attributes.position, col = new Float32Array(fp.count * 3);
  for (let i = 0; i < fp.count; i++) {
    const x = fp.getX(i), z = fp.getZ(i);
    const inside = x > X0 + 6 && x < X1 - 6 && z > Z0 + 6 && z < Z1 - 6;
    fp.setY(i, W.terrainHeight(x, z) - (inside ? 14 : 0.6));
    const n = fbm(x * 0.02, z * 0.02, 3);
    col.set([0.07 + n * 0.06, 0.11 + n * 0.08, 0.05 + n * 0.03], i * 3);
  }
  far.setAttribute('color', new THREE.BufferAttribute(col, 3));
  far.computeVertexNormals();
  scene.add(new THREE.Mesh(far, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })));
  return ground;
}
