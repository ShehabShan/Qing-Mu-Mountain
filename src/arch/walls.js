import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { registerBuilder } from '../core/builders.js';
import { heightAt } from '../core/height.js';

registerBuilder('wall_ring', (feature, ctx) => {
  const { THREE } = ctx;
  const group = new THREE.Group();
  group.name = feature.id;

  // Rect x -115..115, z 20..235.
  // Gates N(0,20) S(0,235) E(115,130) W(-115,130), each 8m wide.
  const minX = -115;
  const maxX = 115;
  const minZ = 20;
  const maxZ = 235;
  const wallH = 6.0;
  const walkH = 4.5;

  const timberGeoms = [];
  const roofGeoms = [];

  function isGateGap(x, z, side) {
    if (side === 'N' && Math.abs(x - 0) < 4.0) return true;
    if (side === 'S' && Math.abs(x - 0) < 4.0) return true;
    if (side === 'E' && Math.abs(z - 130) < 4.0) return true;
    if (side === 'W' && Math.abs(z - 130) < 4.0) return true;
    return false;
  }

  function buildSide(x0, z0, x1, z1, side, inwardX, inwardZ) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    // Palisade posts merged per 2.5m section with ribbed vertical posts
    const step = 2.0;
    const count = Math.floor(len / step);
    const isHoriz = Math.abs(z1 - z0) < 0.01;

    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      const x = x0 + (x1 - x0) * t;
      const z = z0 + (z1 - z0) * t;
      if (isGateGap(x, z, side)) continue;
      const y = heightAt(x, z);

      // Palisade log block + battlements
      const w = isHoriz ? step * 0.96 : 0.7;
      const d = isHoriz ? 0.7 : step * 0.96;
      const post = new THREE.BoxGeometry(w, wallH, d);
      post.translate(x, y + wallH * 0.5, z);
      timberGeoms.push(post);

      // Inside walkway at 4.5m (1m wide)
      const wx = x + inwardX * 0.85;
      const wz = z + inwardZ * 0.85;
      const walk = new THREE.BoxGeometry(isHoriz ? step : 1.0, 0.25, isHoriz ? 1.0 : step);
      walk.translate(wx, y + walkH, wz);
      timberGeoms.push(walk);

      // Ladder every 30m
      if (i % 15 === 0) {
        const lx = x + inwardX * 1.35;
        const lz = z + inwardZ * 1.35;
        const ladder = new THREE.BoxGeometry(0.45, walkH, 0.2);
        ladder.translate(lx, y + walkH * 0.5, lz);
        timberGeoms.push(ladder);
      }
    }
  }

  buildSide(minX, minZ, maxX, minZ, 'N', 0, 1);
  buildSide(minX, maxZ, maxX, maxZ, 'S', 0, -1);
  buildSide(minX, minZ, minX, maxZ, 'W', 1, 0);
  buildSide(maxX, minZ, maxX, maxZ, 'E', -1, 0);

  // 4 Gatehouse frames (8m gap, 9m high arch + pitched bamboo roof)
  const gates = [
    { x: 0, z: 20, horiz: true },
    { x: 0, z: 235, horiz: true },
    { x: 115, z: 130, horiz: false },
    { x: -115, z: 130, horiz: false },
  ];
  for (const g of gates) {
    const gy = heightAt(g.x, g.z);
    const beamW = g.horiz ? 9.6 : 1.8;
    const beamD = g.horiz ? 1.8 : 9.6;
    const lintel = new THREE.BoxGeometry(beamW, 1.4, beamD);
    lintel.translate(g.x, gy + 8.0, g.z);
    timberGeoms.push(lintel);

    const gRoof = new THREE.ConeGeometry(6.2, 2.4, 4);
    gRoof.rotateY(Math.PI / 4);
    gRoof.scale(g.horiz ? 1.15 : 0.45, 1, g.horiz ? 0.45 : 1.15);
    gRoof.translate(g.x, gy + 9.8, g.z);
    roofGeoms.push(gRoof);
  }

  // 8 Towers: 4 corners + 2 flanking each of S and N gates (4x4m, 10m high, pyramid roof)
  const towers = [
    [-115, 20],
    [115, 20],
    [-115, 235],
    [115, 235],
    [-7, 20],
    [7, 20],
    [-7, 235],
    [7, 235],
  ];

  if (!ctx.towerLanternAnchors) ctx.towerLanternAnchors = [];

  for (const [tx, tz] of towers) {
    const ty = heightAt(tx, tz);
    const body = new THREE.BoxGeometry(4, 10, 4);
    body.translate(tx, ty + 5, tz);
    timberGeoms.push(body);

    const pyr = new THREE.ConeGeometry(3.6, 2.8, 4);
    pyr.rotateY(Math.PI / 4);
    pyr.translate(tx, ty + 11.4, tz);
    roofGeoms.push(pyr);

    // 4 corner lanterns on each tower roof eave
    for (const dx of [-2.2, 2.2]) {
      for (const dz of [-2.2, 2.2]) {
        ctx.towerLanternAnchors.push({ x: tx + dx, y: ty + 9.8, z: tz + dz });
      }
    }
  }

  // Stretch mode: ?stage=wolftide trap trenches & bamboo spikes outside wall
  if (ctx.state?.stage === 'wolftide') {
    for (let x = -110; x <= 110; x += 6) {
      for (const z of [14, 241]) {
        if (Math.abs(x) < 6) continue;
        const sy = heightAt(x, z);
        const spike = new THREE.ConeGeometry(0.4, 2.2, 4);
        spike.translate(x, sy + 0.8, z);
        roofGeoms.push(spike);
      }
    }
  }

  const timberMesh = new THREE.Mesh(
    mergeGeometries(timberGeoms, false),
    ctx.mats('timber_dark', { roughness: 0.88 })
  );
  timberMesh.castShadow = true;
  timberMesh.receiveShadow = true;

  const roofMesh = new THREE.Mesh(
    mergeGeometries(roofGeoms, false),
    ctx.mats('bamboo_green', { roughness: 0.78 })
  );
  roofMesh.castShadow = true;

  group.add(timberMesh, roofMesh);

  return {
    object: group,
    layer: 'surface',
  };
});
