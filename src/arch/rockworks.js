import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { registerBuilder } from '../core/builders.js';
import { heightAt } from '../core/height.js';

registerBuilder('rock_terrace', (feature, ctx) => {
  const { THREE } = ctx;
  const group = new THREE.Group();
  group.name = feature.id;

  // alliance_rock_building: pos [-268, -60], elevation 46, size [12, 30, 18]
  // Carved into rock wall on the square's east side; balcony at y=60 with stone railing
  const [cx, cz] = feature.pos;
  const [w, d, h] = feature.size;
  const baseY = typeof feature.elevation === 'number' ? feature.elevation : heightAt(cx, cz);

  const rockGeoms = [];
  const MainFacade = new THREE.BoxGeometry(w, h, d);
  MainFacade.translate(cx, baseY + h * 0.5, cz);
  rockGeoms.push(MainFacade);

  // Balcony at y=60 (2m deep toward west -x overlooking Alliance Slope, stone railing 1.1m)
  const balcFloor = new THREE.BoxGeometry(3.2, 0.8, d * 0.88);
  balcFloor.translate(cx - w * 0.5 - 1.2, 59.6, cz);
  const railFront = new THREE.BoxGeometry(0.4, 1.1, d * 0.88);
  railFront.translate(cx - w * 0.5 - 2.6, 60.55, cz);
  const railN = new THREE.BoxGeometry(3.0, 1.1, 0.4);
  railN.translate(cx - w * 0.5 - 1.2, 60.55, cz - d * 0.44);
  const railS = new THREE.BoxGeometry(3.0, 1.1, 0.4);
  railS.translate(cx - w * 0.5 - 1.2, 60.55, cz + d * 0.44);

  const stoneGeoms = [balcFloor, railFront, railN, railS];

  // 3 dark carved portal openings above the balcony
  const openGeoms = [];
  for (const dz of [-8, 0, 8]) {
    const op = new THREE.BoxGeometry(0.6, 3.2, 2.6);
    op.translate(cx - w * 0.5 - 0.1, 61.6, cz + dz);
    openGeoms.push(op);
  }

  group.add(
    new THREE.Mesh(mergeGeometries(rockGeoms, false), ctx.mats('rock_dark', { roughness: 0.9 })),
    new THREE.Mesh(mergeGeometries(stoneGeoms, false), ctx.mats('stone_paving', { roughness: 0.85 })),
    new THREE.Mesh(mergeGeometries(openGeoms, false), ctx.mats('soil_blue_black', { roughness: 0.95 }))
  );

  return {
    object: group,
    layer: 'surface',
  };
});

registerBuilder('boulder_crack', (feature, ctx) => {
  const { THREE, rng: makeRng, registry } = ctx;
  const group = new THREE.Group();
  group.name = feature.id;

  const seed = 1 + registry.findIndex((f) => f.id === feature.id);
  const rand = makeRng(seed > 0 ? seed : 23);

  const [cx, cz] = feature.pos;
  const [w, d, h] = feature.size;
  const baseY = heightAt(cx, cz);

  // Jittered icosahedron boulder (detail 1) 8x8x7m split by a 0.8m x 4m vertical crevice
  const bGeoms = [];
  for (const half of [-1, 1]) {
    const ico = new THREE.IcosahedronGeometry(1, 1);
    const pos = ico.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);
      const j = 0.88 + rand() * 0.24;
      pos.setXYZ(i, vx * (w * 0.28) * j, (vy + 0.85) * (h * 0.52) * j, vz * (d * 0.48) * j);
    }
    ico.translate(cx, baseY, cz + half * 2.1);
    ico.computeVertexNormals();
    bGeoms.push(ico);
  }

  const boulderMesh = new THREE.Mesh(
    mergeGeometries(bGeoms, false),
    ctx.mats('rock', { roughness: 0.92 })
  );
  group.add(boulderMesh);

  // Dark 0.8m x 4m vertical crevice recess (Portal P2 into secret cave)
  const creviceGeom = new THREE.BoxGeometry(4.2, 4.2, 0.85);
  creviceGeom.translate(cx + 1.8, baseY + 2.1, cz);
  const creviceMesh = new THREE.Mesh(
    creviceGeom,
    ctx.mats('cave_rock', { roughness: 0.98 })
  );
  group.add(creviceMesh);

  // Moss streaks on the boulder
  const mossGeoms = [];
  for (const dz of [-1.8, 1.8]) {
    const m = new THREE.BoxGeometry(2.5, 4.5, 1.2);
    m.translate(cx + 1.6, baseY + 2.6, cz + dz);
    mossGeoms.push(m);
  }
  group.add(new THREE.Mesh(mergeGeometries(mossGeoms, false), ctx.mats('moss')));

  // 1.5m-wide branch waterfall sheet pouring over the boulder from the knob top
  const fallGeom = new THREE.PlaneGeometry(1.5, 16, 2, 4);
  fallGeom.rotateY(Math.PI / 2);
  fallGeom.translate(cx + 3.9, baseY + 6.5, cz);
  const fallMesh = new THREE.Mesh(
    fallGeom,
    ctx.mats('water_fall', { opacity: 0.85, doubleSide: true })
  );
  group.add(fallMesh);

  return {
    object: group,
    layer: 'surface',
  };
});
