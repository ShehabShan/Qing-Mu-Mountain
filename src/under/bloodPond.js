import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { registerBuilder } from '../core/builders.js';

registerBuilder('cave_blood_pond', (feature, ctx) => {
  const { THREE, rng: makeRng, registry } = ctx;
  const group = new THREE.Group();
  group.name = feature.id;

  const seed = 1 + registry.findIndex((f) => f.id === feature.id);
  const rand = makeRng(seed > 0 ? seed : 28);

  const [cx, cz] = feature.pos;
  const [w, , h] = feature.size; // 90x90x40, elevation -12 (top at +28)
  const baseY = Number(feature.elevation); // -12
  const pondY = -6;
  const r = w * 0.5; // 45m

  // Hemisphere dome (r=45m, scaled so apex is at baseY + h = +28)
  const domeGeom = new THREE.SphereGeometry(r, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.55);
  domeGeom.scale(1, h / r, 1);
  domeGeom.translate(cx, baseY, cz);
  const domeMat = ctx.mats('red_earth', {
    emissive: 0.3,
    roughness: 0.88,
    alwaysEmissive: true,
  });
  domeMat.side = THREE.BackSide;
  group.add(new THREE.Mesh(domeGeom, domeMat));

  // Cavern floor ring at y = -7
  const floorDisc = new THREE.CircleGeometry(r, 28);
  floorDisc.rotateX(-Math.PI / 2);
  floorDisc.translate(cx, pondY - 0.4, cz);
  group.add(
    new THREE.Mesh(
      floorDisc,
      ctx.mats('red_earth', { emissive: 0.2, roughness: 0.9, alwaysEmissive: true })
    )
  );

  // Blood Pond disc (r=40m at y=-6)
  const pondGeom = new THREE.CircleGeometry(40, 32);
  pondGeom.rotateX(-Math.PI / 2);
  pondGeom.translate(cx, pondY, cz);
  group.add(
    new THREE.Mesh(
      pondGeom,
      ctx.mats('blood_water', {
        emissive: 0.45,
        roughness: 0.15,
        metalness: 0.25,
        alwaysEmissive: true,
      })
    )
  );

  // 60 ceiling holes with thin falling water threads
  const threadGeoms = [];
  for (let i = 0; i < 60; i++) {
    const ang = rand() * Math.PI * 2;
    const dist = Math.sqrt(rand()) * 36;
    const tx = cx + Math.cos(ang) * dist;
    const tz = cz + Math.sin(ang) * dist;
    const normR = dist / r;
    const ceilY = baseY + Math.sqrt(Math.max(0.05, 1 - normR * normR)) * h;
    const len = Math.max(4, ceilY - pondY);

    const thread = new THREE.CylinderGeometry(0.08, 0.08, len, 4);
    thread.translate(tx, pondY + len * 0.5, tz);
    threadGeoms.push(thread);
  }

  const threadMesh = new THREE.Mesh(
    mergeGeometries(threadGeoms, false),
    ctx.mats('water_trib', {
      emissive: 0.35,
      opacity: 0.55,
      depthWrite: false,
      alwaysEmissive: true,
    })
  );
  group.add(threadMesh);

  return {
    object: group,
    layer: 'underground',
    stats: { instances: 60 },
  };
});
