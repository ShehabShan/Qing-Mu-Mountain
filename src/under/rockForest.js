import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { registerBuilder } from '../core/builders.js';

registerBuilder('cave_pillar_forest', (feature, ctx) => {
  const { THREE, rng: makeRng, registry } = ctx;
  const group = new THREE.Group();
  group.name = feature.id;

  const seed = 1 + registry.findIndex((f) => f.id === feature.id);
  const rand = makeRng(seed > 0 ? seed : 26);

  const [cx, cz] = feature.pos;
  const [w, d, h] = feature.size;
  const baseY = Number(feature.elevation);
  const ceilY = baseY + h;

  // Inverted box shell + floor pad
  const shell = new THREE.BoxGeometry(w, h, d, 6, 4, 6);
  shell.translate(cx, baseY + h * 0.5, cz);
  const shellMat = ctx.mats('red_earth', { emissive: 0.15, roughness: 0.9 });
  shellMat.side = THREE.BackSide;
  group.add(new THREE.Mesh(shell, shellMat));

  const floorPad = new THREE.BoxGeometry(w, 0.5, d);
  floorPad.translate(cx, baseY + 0.25, cz);
  group.add(new THREE.Mesh(floorPad, ctx.mats('red_earth', { emissive: 0.12 })));

  // 40 inverted pillars hanging from ceiling (growing toward the centre)
  // Central pillar is r=4m and ends 0.5m above the floor
  const pillarGeoms = [];

  for (let i = 0; i < 40; i++) {
    let px;
    let pz;
    let rad;
    let pLen;
    if (i === 0) {
      px = cx;
      pz = cz;
      rad = 4.0;
      pLen = h - 0.5;
    } else {
      const ang = (i / 39) * Math.PI * 2 + rand() * 0.3;
      const distNorm = 0.22 + rand() * 0.72;
      px = cx + Math.cos(ang) * distNorm * (w * 0.45);
      pz = cz + Math.sin(ang) * distNorm * (d * 0.45);
      rad = 1.0 + (1 - distNorm) * 2.0;
      const floorGap = 2.0 + distNorm * 7.5;
      pLen = h - floorGap;
    }

    const cone = new THREE.ConeGeometry(rad, pLen, 8, 3);
    cone.rotateX(Math.PI); // Point downward from ceiling
    const pos = cone.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      // Pitted surface jitter
      const j = 0.88 + rand() * 0.24;
      pos.setX(k, pos.getX(k) * j);
      pos.setZ(k, pos.getZ(k) * j);
    }
    cone.translate(px, ceilY - pLen * 0.5, pz);
    cone.computeVertexNormals();
    pillarGeoms.push(cone);
  }

  const pillarMesh = new THREE.Mesh(
    mergeGeometries(pillarGeoms, false),
    ctx.mats('red_pillar', { emissive: 0.18, roughness: 0.85, alwaysEmissive: true })
  );
  group.add(pillarMesh);

  // Crude stair beneath central pillar descending west toward the Spirit Spring's crystal wall
  const stairGeoms = [];
  for (let s = 0; s < 12; s++) {
    const step = new THREE.BoxGeometry(2.2, 0.45, 2.6);
    step.translate(cx - s * 2.2, baseY + 0.5 - s * 0.5, cz + s * 1.5);
    stairGeoms.push(step);
  }
  group.add(
    new THREE.Mesh(mergeGeometries(stairGeoms, false), ctx.mats('cave_rock', { emissive: 0.12 }))
  );

  return {
    object: group,
    layer: 'underground',
    stats: { instances: 40 },
  };
});
