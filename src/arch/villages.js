import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { registerBuilder } from '../core/builders.js';
import { heightAt } from '../core/height.js';
import { scatterVillageHouses } from './bambooHouse.js';

function buildPerimeterWall(THREE, ctx, cx, cz, w, d, height, matKey, gateDir) {
  const halfW = w * 0.5;
  const halfD = d * 0.5;
  const minX = cx - halfW;
  const maxX = cx + halfW;
  const minZ = cz - halfD;
  const maxZ = cz + halfD;

  const segs = [];
  const step = 4.0;

  function addWallRun(x0, z0, x1, z1, skipGateFn) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.ceil(len / step));
    const yaw = Math.atan2(x1 - x0, z1 - z0);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const x = x0 + (x1 - x0) * t;
      const z = z0 + (z1 - z0) * t;
      if (skipGateFn && skipGateFn(x, z)) continue;
      const y = heightAt(x, z);
      const box = new THREE.BoxGeometry(0.9, height, len / n + 0.15);
      box.rotateY(yaw);
      box.translate(x, y + height * 0.5, z);
      segs.push(box);
    }
  }

  // North edge (z = minZ)
  addWallRun(minX, minZ, maxX, minZ, (x) => gateDir === 'NE' && x > maxX - 24 && x < maxX - 12);
  // South edge (z = maxZ)
  addWallRun(minX, maxZ, maxX, maxZ, null);
  // West edge (x = minX)
  addWallRun(minX, minZ, minX, maxZ, (_x, z) => gateDir === 'W' && Math.abs(z - cz) < 5);
  // East edge (x = maxX)
  addWallRun(maxX, minZ, maxX, maxZ, (_x, z) => gateDir === 'NE' && z < minZ + 22 && z > minZ + 10);

  const merged = mergeGeometries(segs, false);
  merged.computeVertexNormals();
  return new THREE.Mesh(merged, ctx.mats(matKey, { roughness: 0.86 }));
}

registerBuilder('house_cluster', (feature, ctx) => {
  const { group, instances } = scatterVillageHouses(ctx, feature, 240, {
    stiltKey: 'timber',
    bodyKey: 'bamboo_green',
    highlightKey: 'bamboo_jade',
    roofKey: 'roof_bamboo',
    minSpacing: 8.2,
    wallMargin: 4,
    recordLanterns: true,
  });

  return {
    object: group,
    layer: 'surface',
    stats: { instances },
  };
});

registerBuilder('village', (feature, ctx) => {
  const { THREE } = ctx;
  const root = new THREE.Group();
  root.name = feature.id;

  const isXiong = feature.id === 'xiong_village';
  const targetCount = isXiong ? 70 : 60;

  const { group: housesGroup, instances } = scatterVillageHouses(
    ctx,
    feature,
    targetCount,
    isXiong
      ? {
          stiltKey: 'timber_dark',
          bodyKey: 'xiong_timber',
          highlightKey: 'timber',
          roofKey: 'hide_awning',
          minSpacing: 8.5,
          wallMargin: 6,
          recordLanterns: true,
        }
      : {
          stiltKey: 'timber',
          bodyKey: 'bai_timber',
          highlightKey: 'white_flower',
          roofKey: 'roof_bai',
          minSpacing: 8.0,
          wallMargin: 6,
          recordLanterns: true,
        }
  );
  root.add(housesGroup);

  const [cx, cz] = feature.pos;
  const [w, d] = feature.size;
  const wallMesh = buildPerimeterWall(
    THREE,
    ctx,
    cx,
    cz,
    w,
    d,
    4.0,
    isXiong ? 'timber_dark' : 'stone_paving',
    isXiong ? 'NE' : 'W'
  );
  root.add(wallMesh);

  return {
    object: root,
    layer: 'surface',
    stats: { instances },
  };
});
