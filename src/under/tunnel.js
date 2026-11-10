import { registerBuilder } from '../core/builders.js';

registerBuilder('cave_tunnel', (feature, ctx) => {
  const { THREE } = ctx;
  const group = new THREE.Group();
  group.name = feature.id;

  // Polyline from notes: (224,62,80) (205,62,72) (175,60,64) (150,60,62) (140,60,58)
  const pts = [
    new THREE.Vector3(224, 80, 62),
    new THREE.Vector3(205, 72, 62),
    new THREE.Vector3(175, 64, 60),
    new THREE.Vector3(150, 62, 60),
    new THREE.Vector3(140, 58, 60),
  ];

  const curve = new THREE.CatmullRomCurve3(pts);
  const tubeGeom = new THREE.TubeGeometry(curve, 36, 1.35, 8, false);

  // Make first 15m stoop-height (radius ~0.85m) and rest 1.35m
  const pos = tubeGeom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    if (vx > 209) {
      // Narrower near east entrance (x=224..209)
      const vy = pos.getY(i);
      const center = 72 + ((vx - 205) / 19) * 8;
      pos.setY(i, center + (vy - center) * 0.65);
    }
  }
  tubeGeom.computeVertexNormals();

  const tubeMat = ctx.mats('red_earth', {
    emissive: 0.25,
    doubleSide: true,
    roughness: 0.9,
    alwaysEmissive: true,
  });
  group.add(new THREE.Mesh(tubeGeom, tubeMat));

  // Round boulder on the incline (x=175 -> 150)
  const boulderGeom = new THREE.IcosahedronGeometry(1.45, 1);
  boulderGeom.translate(172, 65.2, 60);
  group.add(
    new THREE.Mesh(boulderGeom, ctx.mats('rock', { emissive: 0.15, roughness: 0.88 }))
  );

  // Rock door slab at x=150
  const doorGeom = new THREE.BoxGeometry(0.6, 2.8, 2.8);
  doorGeom.translate(150, 63.2, 60);
  group.add(
    new THREE.Mesh(doorGeom, ctx.mats('rock_dark', { emissive: 0.18, roughness: 0.85 }))
  );

  return {
    object: group,
    layer: 'underground',
  };
});
