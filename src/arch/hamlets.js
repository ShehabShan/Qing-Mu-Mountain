import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { registerBuilder } from '../core/builders.js';
import { heightAt } from '../core/height.js';

registerBuilder('hamlet_cluster', (feature, ctx) => {
  const { THREE, rng: makeRng, registry } = ctx;
  const group = new THREE.Group();
  group.name = feature.id;

  const seed = 1 + registry.findIndex((f) => f.id === feature.id);
  const rand = makeRng(seed > 0 ? seed : 55);

  const [cx, cz] = feature.pos;
  // Determine cluster centers and hut count per cluster from notes
  let clusterXs = [cx];
  let hutsPerCluster = 12;
  if (feature.id === 'gy_hamlets') {
    clusterXs = [-60, 30, 105];
    hutsPerCluster = 12;
  } else if (feature.id === 'xiong_hamlets') {
    clusterXs = [cx];
    hutsPerCluster = 14;
  }

  const wallGeoms = [];
  const roofGeoms = [];
  const fieldGeoms = [];

  if (!ctx.hamletLanternAnchors) ctx.hamletLanternAnchors = [];

  for (const clX of clusterXs) {
    const clZ = cz;
    // Two 10x6m field_green plots per cluster
    for (const side of [-1, 1]) {
      const fx = clX + side * 21;
      const fz = clZ + 4;
      const fy = heightAt(fx, fz);
      const plot = new THREE.BoxGeometry(10, 0.25, 6);
      plot.translate(fx, fy + 0.12, fz);
      fieldGeoms.push(plot);
    }

    // Ring of huts (radius 14m, each 4x4x3.5m with thatch roof)
    for (let i = 0; i < hutsPerCluster; i++) {
      const angle = (i / hutsPerCluster) * Math.PI * 2 + rand() * 0.2;
      const r = 11 + rand() * 5;
      const hx = clX + Math.cos(angle) * r;
      const hz = clZ + Math.sin(angle) * r * 0.78;
      const hy = heightAt(hx, hz);
      const yaw = angle + Math.PI;

      const hutBody = new THREE.BoxGeometry(4, 2.2, 4);
      hutBody.rotateY(yaw);
      hutBody.translate(hx, hy + 1.1, hz);
      wallGeoms.push(hutBody);

      const hutRoof = new THREE.ConeGeometry(3.4, 1.5, 4);
      hutRoof.rotateY(yaw + Math.PI / 4);
      hutRoof.translate(hx, hy + 2.95, hz);
      roofGeoms.push(hutRoof);

      ctx.hamletLanternAnchors.push({
        x: hx + Math.cos(yaw) * 2.1,
        y: hy + 1.5,
        z: hz + Math.sin(yaw) * 2.1,
      });
    }
  }

  group.add(
    new THREE.Mesh(mergeGeometries(wallGeoms, false), ctx.mats('timber', { roughness: 0.88 })),
    new THREE.Mesh(mergeGeometries(roofGeoms, false), ctx.mats('thatch', { roughness: 0.92 })),
    new THREE.Mesh(mergeGeometries(fieldGeoms, false), ctx.mats('field_green', { roughness: 0.9 }))
  );

  return {
    object: group,
    layer: 'surface',
    stats: { instances: clusterXs.length * hutsPerCluster },
  };
});

registerBuilder('tree_house', (feature, ctx) => {
  const { THREE } = ctx;
  const group = new THREE.Group();
  group.name = feature.id;

  const [cx, cz] = feature.pos;
  const baseY = heightAt(cx, cz);

  const timberGeoms = [];
  // 4 support posts + central tree trunk up to 5m platform + upper trunk
  for (const dx of [-2.4, 2.4]) {
    for (const dz of [-2.4, 2.4]) {
      const post = new THREE.CylinderGeometry(0.18, 0.22, 5.2, 6);
      post.translate(cx + dx, baseY + 2.6, cz + dz);
      timberGeoms.push(post);
    }
  }
  const trunk = new THREE.CylinderGeometry(0.65, 0.95, 11, 8);
  trunk.translate(cx, baseY + 5.5, cz);
  timberGeoms.push(trunk);

  // Platform at 5m + 6x6m plank hut
  const plat = new THREE.BoxGeometry(6.6, 0.35, 6.6);
  plat.translate(cx, baseY + 5.0, cz);
  const hut = new THREE.BoxGeometry(5.2, 2.6, 5.2);
  hut.translate(cx, baseY + 6.4, cz);
  timberGeoms.push(plat, hut);

  const roof = new THREE.ConeGeometry(4.4, 1.8, 4);
  roof.rotateY(Math.PI / 4);
  roof.translate(cx, baseY + 8.6, cz);

  // Broad-leaf tree canopy (cone stack)
  const canopyGeoms = [];
  for (let c = 0; c < 3; c++) {
    const cone = new THREE.ConeGeometry(4.8 - c * 0.9, 3.2, 7);
    cone.translate(cx, baseY + 9.8 + c * 1.9, cz);
    canopyGeoms.push(cone);
  }

  group.add(
    new THREE.Mesh(mergeGeometries(timberGeoms, false), ctx.mats('timber', { roughness: 0.86 })),
    new THREE.Mesh(roof, ctx.mats('thatch', { roughness: 0.9 })),
    new THREE.Mesh(mergeGeometries(canopyGeoms, false), ctx.mats('grass_dark', { roughness: 0.85 }))
  );

  return {
    object: group,
    layer: 'surface',
  };
});
