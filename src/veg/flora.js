import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { registerBuilder } from '../core/builders.js';
import { heightAt, isNearRoadOrWater } from '../core/height.js';
import { FLOWER_COLORS, PALETTE } from '../core/palette.js';

function makeCrossedQuad(THREE, size) {
  const q1 = new THREE.PlaneGeometry(size, size);
  q1.translate(0, size * 0.5, 0);
  const q2 = new THREE.PlaneGeometry(size, size);
  q2.rotateY(Math.PI / 2);
  q2.translate(0, size * 0.5, 0);
  const g = mergeGeometries([q1, q2], false);
  g.computeVertexNormals();
  return g;
}

registerBuilder('meadow', (feature, ctx) => {
  const { THREE, rng: makeRng, registry } = ctx;
  const seed = 1 + registry.findIndex((f) => f.id === feature.id);
  const rand = makeRng(seed > 0 ? seed : 41);

  const count = 4000;
  const geom = makeCrossedQuad(THREE, 0.42);
  const mat = ctx.mats('white_flower', { doubleSide: true, roughness: 0.75 });
  const inst = new THREE.InstancedMesh(geom, mat, count);
  inst.name = feature.id;

  const [cx, cz] = feature.pos;
  const [fw, fd] = feature.size;
  const dummy = new THREE.Object3D();
  const paletteCols = FLOWER_COLORS.map((hex) => new THREE.Color(hex));

  let idx = 0;
  for (let i = 0; i < count * 2 && idx < count; i++) {
    const x = cx + (rand() - 0.5) * fw;
    const z = cz + (rand() - 0.5) * fd;
    if (isNearRoadOrWater(x, z, 2.0, 3.0)) continue;
    const y = heightAt(x, z);
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, rand() * Math.PI, 0);
    const sc = 0.8 + rand() * 0.6;
    dummy.scale.set(sc, sc, sc);
    dummy.updateMatrix();
    inst.setMatrixAt(idx, dummy.matrix);
    inst.setColorAt(idx, paletteCols[idx % paletteCols.length]);
    idx++;
  }
  inst.count = idx;
  inst.instanceMatrix.needsUpdate = true;
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  inst.computeBoundingSphere();

  return {
    object: inst,
    layer: 'surface',
    stats: { instances: idx },
  };
});

registerBuilder('summit_rocks', (feature, ctx) => {
  const { THREE, rng: makeRng, registry } = ctx;
  const group = new THREE.Group();
  group.name = feature.id;

  const seed = 1 + registry.findIndex((f) => f.id === feature.id);
  const rand = makeRng(seed > 0 ? seed : 33);
  const [cx, cz] = feature.pos;

  const rockGeoms = [];
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2 + rand() * 0.3;
    const dist = i === 0 ? 0 : 4 + rand() * 10;
    const rx = cx + Math.cos(ang) * dist;
    const rz = cz + Math.sin(ang) * dist;
    const ry = heightAt(rx, rz);
    const sz = i === 0 ? 7.5 : 3 + rand() * 4.5;

    const ico = new THREE.IcosahedronGeometry(1, 1);
    const pos = ico.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const j = 0.82 + rand() * 0.36;
      pos.setXYZ(
        k,
        pos.getX(k) * sz * 0.55 * j,
        (pos.getY(k) + 0.7) * sz * 0.75 * j,
        pos.getZ(k) * sz * 0.55 * j
      );
    }
    ico.translate(rx, ry - 0.5, rz);
    ico.computeVertexNormals();
    rockGeoms.push(ico);
  }

  const mesh = new THREE.Mesh(
    mergeGeometries(rockGeoms, false),
    ctx.mats('rock_dark', { roughness: 0.9 })
  );
  mesh.castShadow = true;
  group.add(mesh);

  return {
    object: group,
    layer: 'surface',
    stats: { instances: 12 },
  };
});

registerBuilder('valley_dens', (feature, ctx) => {
  const { THREE, rng: makeRng, registry } = ctx;
  const group = new THREE.Group();
  group.name = feature.id;

  const seed = 1 + registry.findIndex((f) => f.id === feature.id);
  const rand = makeRng(seed > 0 ? seed : 36);
  const [cx, cz] = feature.pos;
  const [fw, fd] = feature.size;

  const archGeoms = [];
  const darkGeoms = [];

  for (let i = 0; i < 8; i++) {
    const dx = cx + ((i % 4) - 1.5) * (fw * 0.22) + (rand() - 0.5) * 4;
    const dz = cz + (Math.floor(i / 4) - 0.5) * (fd * 0.45) + (rand() - 0.5) * 4;
    const dy = heightAt(dx, dz);
    const yaw = rand() * Math.PI * 2;

    const torus = new THREE.TorusGeometry(1.6, 0.65, 6, 10, Math.PI);
    torus.rotateY(yaw);
    torus.translate(dx, dy + 0.2, dz);
    archGeoms.push(torus);

    const hole = new THREE.CircleGeometry(1.5, 10, 0, Math.PI);
    hole.rotateY(yaw);
    hole.translate(dx, dy + 0.2, dz);
    darkGeoms.push(hole);
  }

  group.add(
    new THREE.Mesh(mergeGeometries(archGeoms, false), ctx.mats('rock_dark', { roughness: 0.92 })),
    new THREE.Mesh(
      mergeGeometries(darkGeoms, false),
      ctx.mats('soil_blue_black', { doubleSide: true, roughness: 0.98 })
    )
  );

  return {
    object: group,
    layer: 'surface',
    stats: { instances: 8 },
  };
});

registerBuilder('beach', (feature, ctx) => {
  const { THREE, rng: makeRng, registry } = ctx;
  const group = new THREE.Group();
  group.name = feature.id;

  const seed = 1 + registry.findIndex((f) => f.id === feature.id);
  const rand = makeRng(seed > 0 ? seed : 32);
  const [cx, cz] = feature.pos;
  const [w, d] = feature.size;
  const baseY = heightAt(cx, cz);

  // Sand pad
  const pad = new THREE.BoxGeometry(w, 0.35, d);
  pad.translate(cx, baseY + 0.1, cz);
  group.add(new THREE.Mesh(pad, ctx.mats('sand', { roughness: 0.92 })));

  // 300 instanced pebbles 0.2-0.6m
  const count = 300;
  const pebGeom = new THREE.DodecahedronGeometry(0.5, 0);
  const pebMat = ctx.mats('rock', { roughness: 0.88 });
  const inst = new THREE.InstancedMesh(pebGeom, pebMat, count);
  const dummy = new THREE.Object3D();
  const cRock = new THREE.Color(PALETTE.rock);
  const cSand = new THREE.Color(PALETTE.sand);
  const tmp = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const px = cx + (rand() - 0.5) * w * 0.92;
    const pz = cz + (rand() - 0.5) * d * 0.92;
    const py = heightAt(px, pz) + 0.18;
    const sc = 0.2 + rand() * 0.4;
    dummy.position.set(px, py, pz);
    dummy.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    dummy.scale.set(sc * 1.2, sc * 0.65, sc);
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
    tmp.copy(cRock).lerp(cSand, rand() * 0.45);
    inst.setColorAt(i, tmp);
  }
  inst.instanceMatrix.needsUpdate = true;
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  inst.computeBoundingSphere();
  group.add(inst);

  return {
    object: group,
    layer: 'surface',
    stats: { instances: count },
  };
});
