import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { registerBuilder } from '../core/builders.js';
import { heightAt } from '../core/height.js';

function makeUpsweptEaveGeom(THREE, w, d, eaveDepth, curveUp) {
  const totalW = w + eaveDepth * 2;
  const totalD = d + eaveDepth * 2;
  const geom = new THREE.BoxGeometry(totalW, 0.55, totalD, 10, 1, 10);
  const pos = geom.attributes.position;
  const hw = w * 0.5;
  const hd = d * 0.5;

  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const ex = Math.max(0, Math.abs(vx) - hw) / eaveDepth;
    const ez = Math.max(0, Math.abs(vz) - hd) / eaveDepth;
    const cornerFactor = Math.hypot(ex, ez);
    // Curve corners sharply upward up to 1.2m
    const lift = Math.pow(Math.min(1.4, cornerFactor), 1.8) * (curveUp / 1.4);
    const slopePitch = (1 - Math.max(ex, ez)) * 0.65;
    pos.setY(i, vy + lift + slopePitch);
  }
  geom.computeVertexNormals();
  return geom;
}

registerBuilder('clan_pavilion', (feature, ctx) => {
  const { THREE } = ctx;
  const group = new THREE.Group();
  group.name = feature.id;

  const [cx, cz] = feature.pos;
  const baseY = heightAt(cx, cz);

  const timberGeoms = [];
  const roofGeoms = [];
  const redGeoms = [];

  if (!ctx.towerLanternAnchors) ctx.towerLanternAnchors = [];

  // Stone podium foundation
  const podium = new THREE.BoxGeometry(28, 1.2, 22);
  podium.translate(cx, baseY + 0.6, cz);
  const podiumMesh = new THREE.Mesh(podium, ctx.mats('stone_paving', { roughness: 0.85 }));
  group.add(podiumMesh);

  // 5 stacked storeys: Storey 1 is 26x20x6m; each storey above shrinks 2m in w and d and is 5m high
  let curY = baseY + 1.0;
  for (let s = 0; s < 5; s++) {
    const w = 26 - s * 2;
    const d = 20 - s * 2;
    const h = s === 0 ? 6 : 5;

    const core = new THREE.BoxGeometry(w, h, d);
    core.translate(cx, curY + h * 0.5, cz);
    timberGeoms.push(core);

    // Lacquer red posts every 4m on storey 1, plus corner columns on upper storeys
    if (s === 0) {
      for (let x = -w * 0.5; x <= w * 0.5 + 0.01; x += 4) {
        for (const z of [-d * 0.5, d * 0.5]) {
          const col = new THREE.CylinderGeometry(0.28, 0.3, h, 8);
          col.translate(cx + x, curY + h * 0.5, cz + z);
          redGeoms.push(col);
        }
      }
      for (let z = -d * 0.5 + 4; z <= d * 0.5 - 3.9; z += 4) {
        for (const x of [-w * 0.5, w * 0.5]) {
          const col = new THREE.CylinderGeometry(0.28, 0.3, h, 8);
          col.translate(cx + x, curY + h * 0.5, cz + z);
          redGeoms.push(col);
        }
      }
    } else {
      // Lacquer red trim band per upper floor
      const trim = new THREE.BoxGeometry(w + 0.3, 0.35, d + 0.3);
      trim.translate(cx, curY + 0.25, cz);
      redGeoms.push(trim);
    }

    // Eave band 1.5m deep with corners curving up 1.2m
    const eaveY = curY + h;
    const eave = makeUpsweptEaveGeom(THREE, w, d, 1.5, 1.2);
    eave.translate(cx, eaveY, cz);
    roofGeoms.push(eave);

    // Lantern pairs at every eave corner
    const ew = w * 0.5 + 1.3;
    const ed = d * 0.5 + 1.3;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        ctx.towerLanternAnchors.push(
          { x: cx + sx * ew, y: eaveY + 0.2, z: cz + sz * ed },
          { x: cx + sx * (ew - 0.8), y: eaveY + 0.2, z: cz + sz * ed }
        );
      }
    }

    curY += h;
  }

  // Top crest ridge on 5th storey roof
  const crest = new THREE.ConeGeometry(6.5, 2.2, 4);
  crest.rotateY(Math.PI / 4);
  crest.scale(1.3, 1, 1.0);
  crest.translate(cx, curY + 1.4, cz);
  roofGeoms.push(crest);

  // Portal P1 marker: stone stair vestibule at (0, 92) descending into the spring cave
  const p1Arch = new THREE.BoxGeometry(3.2, 2.8, 3.2);
  p1Arch.translate(0, baseY + 1.4, 92);
  redGeoms.push(p1Arch);

  const timberMesh = new THREE.Mesh(
    mergeGeometries(timberGeoms, false),
    ctx.mats('timber_dark', { roughness: 0.82 })
  );
  const roofMesh = new THREE.Mesh(
    mergeGeometries(roofGeoms, false),
    ctx.mats('roof_tile', { roughness: 0.65, metalness: 0.12 })
  );
  const redMesh = new THREE.Mesh(
    mergeGeometries(redGeoms, false),
    ctx.mats('lacquer_red', { roughness: 0.5, metalness: 0.15 })
  );

  timberMesh.castShadow = true;
  roofMesh.castShadow = true;
  redMesh.castShadow = true;

  group.add(timberMesh, roofMesh, redMesh);

  return {
    object: group,
    layer: 'surface',
  };
});
