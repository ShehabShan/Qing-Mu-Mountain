import { registerBuilder } from '../core/builders.js';
import { heightAt, slopeAt, nearestOnPolyline } from '../core/height.js';
import { PALETTE } from '../core/palette.js';

function parseColor(THREE, hex) {
  return new THREE.Color(hex);
}

registerBuilder('terrain', (feature, ctx) => {
  const { THREE, terrain } = ctx;
  const group = new THREE.Group();
  group.name = 'terrain_root';

  const cGrassLush = parseColor(THREE, PALETTE.grass_lush);
  const cGrassDark = parseColor(THREE, PALETTE.grass_dark);
  const cRock = parseColor(THREE, PALETTE.rock);
  const cRockDark = parseColor(THREE, PALETTE.rock_dark);
  const cSoil = parseColor(THREE, PALETTE.soil_blue_black);
  const cSand = parseColor(THREE, PALETTE.sand);
  const tmpColor = new THREE.Color();

  const ydr = terrain.rivers.yellow_dragon_river;
  const wft = terrain.rivers.waterfall_tributary;

  function vertexColorAt(x, y, z) {
    // Check river sand band: within 2m above river water
    for (const r of [ydr, wft]) {
      const { dist, bed } = nearestOnPolyline(r.pts, x, z);
      const waterY = bed + r.water;
      if (dist <= r.halfWidth + 8 && y >= waterY - 1.5 && y <= waterY + 2.0) {
        return cSand;
      }
      if (dist <= r.halfWidth + r.bank * 0.65 && y > waterY + 2.0 && y < waterY + 5.5) {
        return cSoil;
      }
    }

    const { slope } = slopeAt(x, z, 2.5);
    if (slope < 0.45) {
      const hBlend = Math.max(0, Math.min(1, (y - 15) / 165));
      tmpColor.copy(cGrassLush).lerp(cGrassDark, hBlend * 0.78);
      return tmpColor;
    }
    if (slope <= 0.9) {
      const t = (slope - 0.45) / 0.45;
      tmpColor.copy(cGrassDark).lerp(cSoil, t * 0.35);
      return tmpColor;
    }
    const rockT = Math.min(1, (slope - 0.9) / 0.8);
    tmpColor.copy(cRock).lerp(cRockDark, rockT * 0.45);
    return tmpColor;
  }

  // 201x201 vertices (5m spacing) across [-500, 500] in 4x4 chunks (each 250m x 250m, 50x50 cells)
  const chunksPerSide = 4;
  const chunkSpan = 1000 / chunksPerSide; // 250m
  const cellsPerChunk = 50; // 50 * 5m = 250m

  const mat = ctx.mats('grass_lush', {
    vertexColors: true,
    flat: true,
    roughness: 0.88,
    metalness: 0.02,
  });

  for (let cz = 0; cz < chunksPerSide; cz++) {
    for (let cx = 0; cx < chunksPerSide; cx++) {
      const minX = -500 + cx * chunkSpan;
      const maxX = minX + chunkSpan;
      const minZ = -500 + cz * chunkSpan;
      const maxZ = minZ + chunkSpan;

      const geom = new THREE.PlaneGeometry(chunkSpan, chunkSpan, cellsPerChunk, cellsPerChunk);
      geom.rotateX(-Math.PI / 2);

      const posAttr = geom.attributes.position;
      const count = posAttr.count;
      const colors = new Float32Array(count * 3);

      const centerX = (minX + maxX) * 0.5;
      const centerZ = (minZ + maxZ) * 0.5;

      for (let i = 0; i < count; i++) {
        const vx = posAttr.getX(i) + centerX;
        const vz = posAttr.getZ(i) + centerZ;
        const vy = heightAt(vx, vz);
        posAttr.setXYZ(i, vx, vy, vz);

        const col = vertexColorAt(vx, vy, vz);
        colors[i * 3] = col.r;
        colors[i * 3 + 1] = col.g;
        colors[i * 3 + 2] = col.b;
      }

      geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geom.computeVertexNormals();
      geom.computeBoundingBox();
      geom.computeBoundingSphere();

      const mesh = new THREE.Mesh(geom, mat);
      mesh.receiveShadow = true;
      mesh.name = `terrain_chunk_${cx}_${cz}`;
      mesh.userData.chunkBounds = { minX, maxX, minZ, maxZ };
      group.add(mesh);
    }
  }

  return {
    object: group,
    layer: 'surface',
  };
});
