import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { heightAt, slopeAt, isNearRoadOrWater } from '../core/height.js';
import { EXEMPT_OVERLAP_BUILDERS } from '../core/constants.js';
import { PALETTE } from '../core/palette.js';

let cachedParts = null;

export function makeHouseParts(THREE) {
  if (cachedParts) return cachedParts;

  // 1. Stilts: 9 posts (3x3) on a unit 1x1x1 volume (y from 0 to 1) + deck
  const stiltGeoms = [];
  const xs = [-0.42, 0, 0.42];
  const zs = [-0.42, 0, 0.42];
  for (const x of xs) {
    for (const z of zs) {
      const post = new THREE.CylinderGeometry(0.04, 0.045, 1, 4, 1, true);
      post.translate(x, 0.5, z);
      stiltGeoms.push(post);
    }
  }
  const deck = new THREE.BoxGeometry(1.04, 0.08, 1.04);
  deck.translate(0, 0.96, 0);
  stiltGeoms.push(deck);
  const stilts = mergeGeometries(stiltGeoms, false);
  stilts.computeVertexNormals();

  // 2. Body: unit 1x1x1 box (y from 0 to 1) with vertical bamboo rib vertex color stripes
  const body = new THREE.BoxGeometry(1, 1, 1, 4, 1, 4);
  body.translate(0, 0.5, 0);
  const pos = body.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vz = pos.getZ(i);
    const stripe = Math.sin((vx + vz) * 16) > 0 ? 1.0 : 0.84;
    colors[i * 3] = stripe;
    colors[i * 3 + 1] = stripe;
    colors[i * 3 + 2] = stripe;
  }
  body.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  body.computeVertexNormals();

  // 3. Roof: hip roof at ~30 deg pitch, overhang 1.22x
  const roof = new THREE.ConeGeometry(0.88, 0.55, 4);
  roof.rotateY(Math.PI / 4);
  roof.scale(1.05, 1.0, 1.05);
  roof.translate(0, 0.275, 0);
  roof.computeVertexNormals();

  cachedParts = { stilts, body, roof };
  return cachedParts;
}

export function scatterVillageHouses(ctx, feature, targetCount, style) {
  const { THREE, rng: makeRng, registry } = ctx;
  const seed = 1 + registry.findIndex((f) => f.id === feature.id);
  const rand = makeRng(seed > 0 ? seed : 101);

  const { stilts, body, roof } = makeHouseParts(THREE);
  const [cx, cz] = feature.pos;
  const [fw, fd] = feature.size;
  const margin = style.wallMargin || 6;
  const halfW = fw * 0.5 - margin;
  const halfD = fd * 0.5 - margin;

  // Non-exempt surface footprints to avoid (excluding self)
  const obstacles = registry.filter(
    (f) =>
      f.id !== feature.id &&
      !f.builder.startsWith('cave_') &&
      !EXEMPT_OVERLAP_BUILDERS.has(f.builder)
  );

  const placed = [];
  const minSpacing = style.minSpacing || 9.0;
  const maxAttempts = targetCount * 35;

  for (let attempt = 0; attempt < maxAttempts && placed.length < targetCount; attempt++) {
    const x = cx + (rand() * 2 - 1) * halfW;
    const z = cz + (rand() * 2 - 1) * halfD;

    // Check spacing against already placed houses
    let tooClose = false;
    for (let i = 0; i < placed.length; i++) {
      const p = placed[i];
      if (Math.hypot(x - p.x, z - p.z) < minSpacing) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    // Check slope
    const { slope, dx, dz } = slopeAt(x, z, 2.0);
    if (slope > 0.7) continue;

    // Check roads (2m clearance) and water
    if (isNearRoadOrWater(x, z, 2.5, 4.0)) continue;

    // Check obstacle footprints (2m clearance)
    let hitsObstacle = false;
    for (const ob of obstacles) {
      const ox = ob.pos[0];
      const oz = ob.pos[1];
      const ow = ob.size[0] * 0.5 + 4.5;
      const od = ob.size[1] * 0.5 + 4.5;
      if (Math.abs(x - ox) < ow && Math.abs(z - oz) < od) {
        hitsObstacle = true;
        break;
      }
    }
    if (hitsObstacle) continue;

    const w = 6 + rand() * 3; // 6-9m
    const d = 5 + rand() * 2; // 5-7m
    const rRoll = rand();
    const h = rRoll < 0.6 ? 3 : rRoll < 0.95 ? 6 : 9;

    // Sample 4 corners for stilt height
    const c1 = heightAt(x - w * 0.5, z - d * 0.5);
    const c2 = heightAt(x + w * 0.5, z - d * 0.5);
    const c3 = heightAt(x - w * 0.5, z + d * 0.5);
    const c4 = heightAt(x + w * 0.5, z + d * 0.5);
    const minC = Math.min(c1, c2, c3, c4);
    const maxC = Math.max(c1, c2, c3, c4);
    const stiltH = 2.5 + (maxC - minC);

    // Door faces downhill (-dx, -dz)
    const yaw = Math.atan2(-dx, -dz) + (rand() - 0.5) * 0.25;

    placed.push({ x, z, baseY: minC, stiltH, w, d, h, yaw, tone: rand() });
  }

  const count = placed.length;
  const stiltMat = ctx.mats(style.stiltKey, { roughness: 0.88 });
  const bodyMat = ctx.mats(style.bodyKey, { vertexColors: true, roughness: 0.75 });
  const roofMat = ctx.mats(style.roofKey, { roughness: 0.82 });

  const stiltInst = new THREE.InstancedMesh(stilts, stiltMat, count);
  const bodyInst = new THREE.InstancedMesh(body, bodyMat, count);
  const roofInst = new THREE.InstancedMesh(roof, roofMat, count);

  const dummy = new THREE.Object3D();
  const colA = new THREE.Color(PALETTE[style.bodyKey]);
  const colB = new THREE.Color(PALETTE[style.highlightKey || style.bodyKey]);
  const tmpCol = new THREE.Color();

  if (!ctx.houseLanternAnchors) ctx.houseLanternAnchors = [];

  for (let i = 0; i < count; i++) {
    const p = placed[i];

    // Stilts
    dummy.position.set(p.x, p.baseY, p.z);
    dummy.rotation.set(0, p.yaw, 0);
    dummy.scale.set(p.w, p.stiltH, p.d);
    dummy.updateMatrix();
    stiltInst.setMatrixAt(i, dummy.matrix);

    // Body
    const bodyY = p.baseY + p.stiltH;
    dummy.position.set(p.x, bodyY, p.z);
    dummy.rotation.set(0, p.yaw, 0);
    dummy.scale.set(p.w, p.h, p.d);
    dummy.updateMatrix();
    bodyInst.setMatrixAt(i, dummy.matrix);

    tmpCol.copy(colA).lerp(colB, p.tone * 0.65);
    bodyInst.setColorAt(i, tmpCol);

    // Roof
    const roofY = bodyY + p.h;
    dummy.position.set(p.x, roofY, p.z);
    dummy.rotation.set(0, p.yaw, 0);
    dummy.scale.set(p.w + 1.6, 2.2, p.d + 1.6);
    dummy.updateMatrix();
    roofInst.setMatrixAt(i, dummy.matrix);

    // Record lantern/window anchor points
    if (style.recordLanterns) {
      const cos = Math.cos(p.yaw);
      const sin = Math.sin(p.yaw);
      const storeys = Math.round(p.h / 3);
      for (let s = 0; s < storeys; s++) {
        const wy = bodyY + s * 3 + 1.6;
        for (const side of [-1, 1]) {
          for (const along of [-0.25, 0.25]) {
            const lx = along * p.w;
            const lz = side * (p.d * 0.5 + 0.18);
            ctx.houseLanternAnchors.push({
              x: p.x + lx * cos + lz * sin,
              y: wy,
              z: p.z - lx * sin + lz * cos,
              village: feature.id,
            });
          }
        }
      }
    }
  }

  stiltInst.instanceMatrix.needsUpdate = true;
  bodyInst.instanceMatrix.needsUpdate = true;
  if (bodyInst.instanceColor) bodyInst.instanceColor.needsUpdate = true;
  roofInst.instanceMatrix.needsUpdate = true;

  stiltInst.computeBoundingSphere();
  bodyInst.computeBoundingSphere();
  roofInst.computeBoundingSphere();
  bodyInst.castShadow = true;
  roofInst.castShadow = true;

  const group = new THREE.Group();
  group.name = `${feature.id}_houses`;
  group.add(stiltInst, bodyInst, roofInst);

  return { group, instances: count * 3, placed };
}
