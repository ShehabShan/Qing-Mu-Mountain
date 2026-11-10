import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { registerBuilder } from '../core/builders.js';
import { heightAt, isNearRoadOrWater } from '../core/height.js';
import { EXEMPT_OVERLAP_BUILDERS } from '../core/constants.js';
import { PALETTE } from '../core/palette.js';

function makeBambooStalkGeometry(THREE) {
  // Unit height = 1.0 (scaled per instance by 8..14m), radius = 0.12m
  // 6-sided prism stalk from y=0 to 0.92 + 0.08m spear-sharp pyramid tip + top leaf tufts
  const shaft = new THREE.CylinderGeometry(0.1, 0.13, 0.92, 6, 1, true);
  shaft.translate(0, 0.46, 0);

  const tip = new THREE.ConeGeometry(0.1, 0.08, 6, 1, true);
  tip.translate(0, 0.96, 0);

  // Small leaf tufts in top 15% of stalk only
  const tuft1 = new THREE.PlaneGeometry(0.9, 0.18);
  tuft1.rotateZ(0.35);
  tuft1.translate(0.35, 0.84, 0);

  const tuft2 = new THREE.PlaneGeometry(0.9, 0.18);
  tuft2.rotateY(Math.PI * 0.66);
  tuft2.rotateZ(-0.35);
  tuft2.translate(-0.2, 0.88, 0.3);

  const merged = mergeGeometries([shaft, tip, tuft1, tuft2], false);
  const pos = merged.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cGreen = new THREE.Color(PALETTE.bamboo_green);
  const cJade = new THREE.Color(PALETTE.bamboo_jade);
  const cNode = new THREE.Color(PALETTE.roof_bamboo);
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const vy = pos.getY(i);
    // Nodal band every ~0.11 of unit height (~1.2m on a 11m stalk)
    const isNode = Math.abs((vy * 9) - Math.round(vy * 9)) < 0.08;
    if (isNode) {
      tmp.copy(cNode);
    } else {
      tmp.copy(cGreen).lerp(cJade, Math.min(1, vy * 1.1));
    }
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  merged.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  merged.computeVertexNormals();
  return merged;
}

function makeGroundTuftGeometry(THREE) {
  const p1 = new THREE.PlaneGeometry(0.55, 0.45);
  p1.translate(0, 0.22, 0);
  const p2 = new THREE.PlaneGeometry(0.55, 0.45);
  p2.rotateY(Math.PI / 2);
  p2.translate(0, 0.22, 0);
  const g = mergeGeometries([p1, p2], false);
  g.computeVertexNormals();
  return g;
}

registerBuilder('bamboo_forest', (feature, ctx) => {
  const { THREE, rng: makeRng, registry } = ctx;
  const group = new THREE.Group();
  group.name = feature.id;

  const seed = 1 + registry.findIndex((f) => f.id === feature.id);
  const rand = makeRng(seed > 0 ? seed : 13);

  const obstacles = registry.filter(
    (f) =>
      f.id !== feature.id &&
      !f.builder.startsWith('cave_') &&
      !EXEMPT_OVERLAP_BUILDERS.has(f.builder)
  );

  function isValidPoint(x, z) {
    if (x < -480 || x > 480 || z < -480 || z > 480) return false;
    // Exclude inside Gu Yue wall rectangle + 3m buffer
    if (x > -119 && x < 119 && z > 16 && z < 239) return false;
    if (isNearRoadOrWater(x, z, 3.2, 4.5)) return false;
    for (const ob of obstacles) {
      if (
        Math.abs(x - ob.pos[0]) < ob.size[0] * 0.5 + 4 &&
        Math.abs(z - ob.pos[1]) < ob.size[1] * 0.5 + 4
      ) {
        return false;
      }
    }
    return true;
  }

  const targetStalks = 5000;
  const stalks = [];
  const [cx, cz] = feature.pos;
  const [fw, fd] = feature.size;

  // Clustered Poisson clumps (12-30 stalks within r=3m)
  let attempts = 0;
  while (stalks.length < targetStalks && attempts < 3500) {
    attempts++;
    // Bias 45% of clumps into the dense east grove strip x 125..245, z 60..150
    let clX;
    let clZ;
    if (rand() < 0.45) {
      clX = 125 + rand() * 120;
      clZ = 60 + rand() * 90;
    } else {
      clX = cx + (rand() * 2 - 1) * (fw * 0.5);
      clZ = cz + (rand() * 2 - 1) * (fd * 0.5);
      if (rand() > 0.35) continue;
    }

    if (!isValidPoint(clX, clZ)) continue;

    const clumpCount = 12 + Math.floor(rand() * 19);
    for (let k = 0; k < clumpCount && stalks.length < targetStalks; k++) {
      const ang = rand() * Math.PI * 2;
      const rad = Math.sqrt(rand()) * 3.2;
      const sx = clX + Math.cos(ang) * rad;
      const sz = clZ + Math.sin(ang) * rad;
      if (!isValidPoint(sx, sz)) continue;
      const sy = heightAt(sx, sz);
      const sh = 8 + rand() * 6; // 8-14m
      stalks.push({ x: sx, y: sy, z: sz, h: sh, yaw: rand() * Math.PI * 2, tint: rand() });
    }
  }

  const stalkGeom = makeBambooStalkGeometry(THREE);
  const stalkMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    flatShading: true,
    roughness: 0.68,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });

  // Wind vertex shader sway: offset = 0.15 * sin(t * 1.3 + x * 0.05) * (y/h)^2
  const windUniform = { value: 0 };
  stalkMat.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = windUniform;
    shader.vertexShader =
      `uniform float uWindTime;\n` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         float hNorm = clamp(position.y, 0.0, 1.0);
         float worldX = instanceMatrix[3][0];
         float sway = 0.15 * sin(uWindTime * 1.3 + worldX * 0.05) * (hNorm * hNorm);
         transformed.x += sway;`
      );
  };

  const stalkInst = new THREE.InstancedMesh(stalkGeom, stalkMat, stalks.length);
  const dummy = new THREE.Object3D();
  const cBase = new THREE.Color(0xffffff);
  const cJade = new THREE.Color(PALETTE.bamboo_jade);
  const tmpCol = new THREE.Color();

  for (let i = 0; i < stalks.length; i++) {
    const s = stalks[i];
    dummy.position.set(s.x, s.y, s.z);
    dummy.rotation.set(0, s.yaw, 0);
    const rScale = 0.85 + s.tint * 0.35;
    dummy.scale.set(rScale, s.h, rScale);
    dummy.updateMatrix();
    stalkInst.setMatrixAt(i, dummy.matrix);
    tmpCol.copy(cBase).lerp(cJade, s.tint * 0.25);
    stalkInst.setColorAt(i, tmpCol);
  }
  stalkInst.instanceMatrix.needsUpdate = true;
  if (stalkInst.instanceColor) stalkInst.instanceColor.needsUpdate = true;
  stalkInst.computeBoundingSphere();
  group.add(stalkInst);

  // 6,000 instanced white_flower and grass tufts under the bamboo
  const tuftCount = 6000;
  const tuftGeom = makeGroundTuftGeometry(THREE);
  const tuftMat = ctx.mats('white_flower', { doubleSide: true, roughness: 0.85 });
  const tuftInst = new THREE.InstancedMesh(tuftGeom, tuftMat, tuftCount);
  const cWhite = new THREE.Color(PALETTE.white_flower);
  const cGrass = new THREE.Color(PALETTE.grass_lush);

  for (let i = 0; i < tuftCount; i++) {
    const ref = stalks[i % stalks.length];
    const tx = ref.x + (rand() - 0.5) * 4.5;
    const tz = ref.z + (rand() - 0.5) * 4.5;
    const ty = heightAt(tx, tz);
    dummy.position.set(tx, ty, tz);
    dummy.rotation.set(0, rand() * Math.PI, 0);
    const sc = 0.7 + rand() * 0.6;
    dummy.scale.set(sc, sc, sc);
    dummy.updateMatrix();
    tuftInst.setMatrixAt(i, dummy.matrix);
    tuftInst.setColorAt(i, i % 3 === 0 ? cWhite : cGrass);
  }
  tuftInst.instanceMatrix.needsUpdate = true;
  if (tuftInst.instanceColor) tuftInst.instanceColor.needsUpdate = true;
  tuftInst.computeBoundingSphere();
  group.add(tuftInst);

  return {
    object: group,
    layer: 'surface',
    stats: { instances: stalks.length + tuftCount },
    update(dt) {
      windUniform.value += dt;
    },
  };
});
