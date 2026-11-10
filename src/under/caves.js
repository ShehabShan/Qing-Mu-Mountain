import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { registerBuilder } from '../core/builders.js';
import { RAINBOW_COLORS } from '../core/palette.js';

function makeInvertedCaveShell(THREE, rand, w, h, d, jitter = 0.8) {
  const geom = new THREE.BoxGeometry(w, h, d, 8, 5, 8);
  const pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    // Keep floor flatter so walker & pools sit cleanly
    const isFloor = vy < -h * 0.42;
    const jx = (rand() - 0.5) * jitter * 2;
    const jy = isFloor ? (rand() - 0.5) * 0.15 : (rand() - 0.5) * jitter * 2;
    const jz = (rand() - 0.5) * jitter * 2;
    pos.setXYZ(i, vx + jx, vy + jy, vz + jz);
  }
  geom.computeVertexNormals();
  return geom;
}

registerBuilder('cave_room', (feature, ctx) => {
  const { THREE, rng: makeRng, registry } = ctx;
  const group = new THREE.Group();
  group.name = feature.id;

  const seed = 1 + registry.findIndex((f) => f.id === feature.id);
  const rand = makeRng(seed > 0 ? seed : 14);

  const [cx, cz] = feature.pos;
  const [w, d, h] = feature.size;
  const baseY = Number(feature.elevation);

  const isStalactite = feature.id === 'stalactite_cave';
  const wallKey = isStalactite ? 'cave_rock' : 'red_earth';
  const wallEmissive = isStalactite ? 0.12 : 0.25;

  // Inverted jittered cave shell (BackSide)
  const shellGeom = makeInvertedCaveShell(THREE, rand, w, h, d, isStalactite ? 0.8 : 0.35);
  shellGeom.translate(cx, baseY + h * 0.5, cz);
  const shellMat = ctx.mats(wallKey, {
    emissive: wallEmissive,
    roughness: 0.92,
  });
  shellMat.side = THREE.BackSide;
  group.add(new THREE.Mesh(shellGeom, shellMat));

  // Floor slab so cutaway view from above clearly grounds the chamber
  const floorGeom = new THREE.BoxGeometry(w, 0.5, d);
  floorGeom.translate(cx, baseY + 0.25, cz);
  group.add(
    new THREE.Mesh(floorGeom, ctx.mats(wallKey, { emissive: wallEmissive * 0.8, roughness: 0.9 }))
  );

  if (isStalactite) {
    // 60 stalactites emissive in the 7 rainbow colours
    const coneGeom = new THREE.ConeGeometry(0.45, 1.0, 6);
    coneGeom.rotateX(Math.PI); // Point downward
    coneGeom.translate(0, -0.5, 0);

    const stalMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.55,
      roughness: 0.35,
      metalness: 0.1,
      flatShading: true,
    });

    const count = 60;
    const inst = new THREE.InstancedMesh(coneGeom, stalMat, count);
    const dummy = new THREE.Object3D();
    const rainbowCols = RAINBOW_COLORS.map((hex) => new THREE.Color(hex));

    for (let i = 0; i < count; i++) {
      const sx = cx + (rand() - 0.5) * (w - 3);
      const sz = cz + (rand() - 0.5) * (d - 3);
      const len = 1.8 + rand() * 3.8;
      const rad = 0.6 + rand() * 0.9;
      dummy.position.set(sx, baseY + h - 0.2, sz);
      dummy.rotation.set(0, rand() * Math.PI * 2, 0);
      dummy.scale.set(rad, len, rad);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      inst.setColorAt(i, rainbowCols[i % rainbowCols.length]);
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.computeBoundingSphere();
    group.add(inst);

    // Shallow 3m-wide underground stream crossing its east end
    const streamGeom = new THREE.BoxGeometry(3.0, 0.25, d * 0.92);
    streamGeom.translate(cx + w * 0.32, baseY + 0.45, cz);
    group.add(
      new THREE.Mesh(
        streamGeom,
        ctx.mats('water_spring', { emissive: 0.35, opacity: 0.88 })
      )
    );

    // Stone stair descending from Portal P1 on north wall
    const stairGeoms = [];
    for (let s = 0; s < 10; s++) {
      const st = new THREE.BoxGeometry(2.8, 0.4, 0.8);
      st.translate(cx + 3, baseY + 0.5 + s * 0.45, cz - d * 0.45 + (9 - s) * 0.6);
      stairGeoms.push(st);
    }
    group.add(new THREE.Mesh(mergeGeometries(stairGeoms, false), ctx.mats('stone_paving')));
  } else {
    // Secret Cave: damp moss patches, withered vines, 0.9m high image wall on west wall
    const mossGeom = new THREE.BoxGeometry(3.5, 0.15, 3.5);
    mossGeom.translate(cx + 1.2, baseY + 0.55, cz - 1.2);
    group.add(new THREE.Mesh(mossGeom, ctx.mats('moss')));

    // Image screen wall (0.9m high glowing carving) on west wall
    const imgWall = new THREE.BoxGeometry(0.35, 0.9, 2.4);
    imgWall.translate(cx - w * 0.5 + 0.3, baseY + 1.4, cz);
    group.add(
      new THREE.Mesh(
        imgWall,
        ctx.mats('spring_glow', { emissive: 0.65, alwaysEmissive: true })
      )
    );
  }

  return {
    object: group,
    layer: 'underground',
    stats: { instances: isStalactite ? 60 : 1 },
  };
});
