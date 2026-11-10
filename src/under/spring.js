import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { registerBuilder } from '../core/builders.js';
import { PALETTE } from '../core/palette.js';

function makeOrchidGeometry(THREE) {
  // 3 crossed quads, 0.5m
  const sz = 0.5;
  const q1 = new THREE.PlaneGeometry(sz, sz);
  q1.translate(0, sz * 0.5, 0);
  const q2 = new THREE.PlaneGeometry(sz, sz);
  q2.rotateY(Math.PI / 3);
  q2.translate(0, sz * 0.5, 0);
  const q3 = new THREE.PlaneGeometry(sz, sz);
  q3.rotateY((Math.PI * 2) / 3);
  q3.translate(0, sz * 0.5, 0);
  const g = mergeGeometries([q1, q2, q3], false);
  g.computeVertexNormals();
  return g;
}

registerBuilder('cave_spring', (feature, ctx) => {
  const { THREE, rng: makeRng, registry } = ctx;
  const group = new THREE.Group();
  group.name = feature.id;

  const seed = 1 + registry.findIndex((f) => f.id === feature.id);
  const rand = makeRng(seed > 0 ? seed : 15);

  const [cx, cz] = feature.pos;
  const baseY = Number(feature.elevation);

  // Sand bed rim
  const sandRim = new THREE.CylinderGeometry(6.4, 6.8, 0.5, 24);
  sandRim.translate(cx, baseY + 0.25, cz);
  group.add(new THREE.Mesh(sandRim, ctx.mats('sand', { emissive: 0.15 })));

  // 12m pool disc (r=6m) of clear water_spring with starry glow
  const poolDisc = new THREE.CircleGeometry(5.8, 24);
  poolDisc.rotateX(-Math.PI / 2);
  poolDisc.translate(cx, baseY + 0.55, cz);
  group.add(
    new THREE.Mesh(
      poolDisc,
      ctx.mats('water_spring', {
        emissive: 0.65,
        emissiveKey: 'spring_glow',
        opacity: 0.9,
        alwaysEmissive: true,
      })
    )
  );

  // 400 additive point sprites (spring_glow)
  const ptCount = 400;
  const ptPos = new Float32Array(ptCount * 3);
  for (let i = 0; i < ptCount; i++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * 5.5;
    ptPos[i * 3] = cx + Math.cos(a) * r;
    ptPos[i * 3 + 1] = baseY + 0.6 + rand() * 2.4;
    ptPos[i * 3 + 2] = cz + Math.sin(a) * r;
  }
  const ptGeom = new THREE.BufferGeometry();
  ptGeom.setAttribute('position', new THREE.BufferAttribute(ptPos, 3));
  const ptMat = new THREE.PointsMaterial({
    color: PALETTE.spring_glow,
    size: 0.35,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const glowPts = new THREE.Points(ptGeom, ptMat);
  group.add(glowPts);

  // Crystal wall arc on its east side (14m arc -> r=7m, 4m high, opacity 0.35, double-sided)
  const arcGeom = new THREE.CylinderGeometry(
    6.2,
    6.2,
    3.0,
    18,
    1,
    true,
    0,
    Math.PI * 0.85
  );
  arcGeom.translate(cx, baseY + 1.5, cz);
  const crystalMat = ctx.mats('crystal_wall', {
    emissive: 0.45,
    opacity: 0.35,
    doubleSide: true,
    roughness: 0.12,
    metalness: 0.2,
    depthWrite: false,
    alwaysEmissive: true,
  });
  group.add(new THREE.Mesh(arcGeom, crystalMat));

  return {
    object: group,
    layer: 'underground',
    stats: { instances: ptCount },
  };
});

registerBuilder('cave_flower_sea', (feature, ctx) => {
  const { THREE, rng: makeRng, registry } = ctx;
  const group = new THREE.Group();
  group.name = feature.id;

  const seed = 1 + registry.findIndex((f) => f.id === feature.id);
  const rand = makeRng(seed > 0 ? seed : 27);

  const [cx, cz] = feature.pos;
  const [w, d, h] = feature.size;
  const baseY = Number(feature.elevation);

  // Dark cave floor pad
  const floorGeom = new THREE.BoxGeometry(w, 0.4, d);
  floorGeom.translate(cx, baseY + 0.2, cz);
  group.add(new THREE.Mesh(floorGeom, ctx.mats('soil_blue_black', { emissive: 0.12 })));

  // 1,200 instanced moon_orchid flowers (emissive 0.3)
  const count = 1200;
  const orchidGeom = makeOrchidGeometry(THREE);
  const orchidMat = ctx.mats('moon_orchid', {
    emissive: 0.3,
    doubleSide: true,
    roughness: 0.55,
    alwaysEmissive: true,
  });

  const inst = new THREE.InstancedMesh(orchidGeom, orchidMat, count);
  const dummy = new THREE.Object3D();
  const cOrchid = new THREE.Color(PALETTE.moon_orchid);
  const cGlow = new THREE.Color(PALETTE.spring_glow);
  const tmp = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const ox = cx + (rand() - 0.5) * (w - 2);
    const oz = cz + (rand() - 0.5) * (d - 2);
    dummy.position.set(ox, baseY + 0.4, oz);
    dummy.rotation.set(0, rand() * Math.PI, 0);
    const sc = 0.8 + rand() * 0.5;
    dummy.scale.set(sc, sc, sc);
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
    tmp.copy(cOrchid).lerp(cGlow, rand() * 0.35);
    inst.setColorAt(i, tmp);
  }
  inst.instanceMatrix.needsUpdate = true;
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  inst.computeBoundingSphere();
  group.add(inst);

  // 150 rising Hope-light sprites
  const hopeCount = 150;
  const hopePos = new Float32Array(hopeCount * 3);
  for (let i = 0; i < hopeCount; i++) {
    hopePos[i * 3] = cx + (rand() - 0.5) * (w - 3);
    hopePos[i * 3 + 1] = baseY + 0.8 + rand() * (h - 1.5);
    hopePos[i * 3 + 2] = cz + (rand() - 0.5) * (d - 3);
  }
  const hopeGeom = new THREE.BufferGeometry();
  hopeGeom.setAttribute('position', new THREE.BufferAttribute(hopePos, 3));
  const hopeMat = new THREE.PointsMaterial({
    color: PALETTE.spring_glow,
    size: 0.45,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const hopePts = new THREE.Points(hopeGeom, hopeMat);
  group.add(hopePts);

  return {
    object: group,
    layer: 'underground',
    stats: { instances: count + hopeCount },
    update(dt) {
      const attr = hopeGeom.attributes.position;
      for (let i = 0; i < hopeCount; i++) {
        let y = attr.getY(i) + dt * 0.6;
        if (y > baseY + h - 0.5) y = baseY + 0.8;
        attr.setY(i, y);
      }
      attr.needsUpdate = true;
    },
  };
});
