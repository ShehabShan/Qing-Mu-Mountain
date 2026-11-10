import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { registerBuilder } from '../core/builders.js';
import { heightAt } from '../core/height.js';

registerBuilder('hall', (feature, ctx) => {
  const { THREE } = ctx;
  const group = new THREE.Group();
  group.name = feature.id;

  const [cx, cz] = feature.pos;
  const [w, d, h] = feature.size;
  const baseY = heightAt(cx, cz);

  const isPunishment = feature.id === 'punishment_hall';
  const isAcademy = feature.id === 'academy';
  const isMedicine = feature.id === 'medicine_hall';
  const isTavern = feature.id === 'tavern';

  const bodyKey = isPunishment ? 'timber_dark' : 'bamboo_green';
  const roofKey = isAcademy || isPunishment ? 'roof_tile' : 'roof_bamboo';

  // Downhill stilts (1.2m base platform)
  const stiltBox = new THREE.BoxGeometry(w * 0.96, 1.2, d * 0.96);
  stiltBox.translate(cx, baseY + 0.6, cz);
  const stiltMesh = new THREE.Mesh(stiltBox, ctx.mats('timber', { roughness: 0.85 }));
  group.add(stiltMesh);

  // Main hall body
  const bodyH = h - 2.6;
  const bodyGeom = new THREE.BoxGeometry(w, bodyH, d);
  bodyGeom.translate(cx, baseY + 1.2 + bodyH * 0.5, cz);
  const bodyMesh = new THREE.Mesh(bodyGeom, ctx.mats(bodyKey, { roughness: 0.78 }));
  bodyMesh.castShadow = true;
  group.add(bodyMesh);

  // Pitched overhang roof
  const roofGeom = new THREE.ConeGeometry(Math.hypot(w, d) * 0.56, 2.6, 4);
  roofGeom.rotateY(Math.PI / 4);
  roofGeom.scale(w / Math.max(w, d), 1, d / Math.max(w, d));
  roofGeom.translate(cx, baseY + 1.2 + bodyH + 1.3, cz);
  const roofMesh = new THREE.Mesh(roofGeom, ctx.mats(roofKey, { roughness: 0.72 }));
  roofMesh.castShadow = true;
  group.add(roofMesh);

  // Special details per hall
  if (isAcademy) {
    // Long east-facing window row overlooking the spear bamboo grove
    const winGeom = new THREE.BoxGeometry(0.3, 1.8, d * 0.8);
    winGeom.translate(cx + w * 0.5 + 0.05, baseY + 4.5, cz);
    group.add(
      new THREE.Mesh(
        winGeom,
        ctx.mats('lantern_warm', { emissive: 0.6, roughness: 0.4 })
      )
    );
  }

  if (isMedicine) {
    // Herb drying racks outside south side
    const rackGeoms = [];
    for (let i = -1; i <= 1; i++) {
      const r = new THREE.BoxGeometry(3.2, 1.8, 0.8);
      r.translate(cx + i * 5, baseY + 1.2, cz + d * 0.5 + 1.5);
      rackGeoms.push(r);
    }
    group.add(new THREE.Mesh(mergeGeometries(rackGeoms, false), ctx.mats('timber')));
  }

  if (isTavern) {
    // Stacked clay wine jars outside + 4 lanterns
    const jarGeoms = [];
    for (let i = 0; i < 8; i++) {
      const jar = new THREE.CylinderGeometry(0.32, 0.38, 0.85, 8);
      const row = Math.floor(i / 4);
      const col = i % 4;
      jar.translate(cx - 3 + col * 1.1, baseY + 0.5 + row * 0.8, cz + d * 0.5 + 1.2);
      jarGeoms.push(jar);
    }
    group.add(new THREE.Mesh(mergeGeometries(jarGeoms, false), ctx.mats('clay_jar')));

    if (!ctx.towerLanternAnchors) ctx.towerLanternAnchors = [];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        ctx.towerLanternAnchors.push({
          x: cx + sx * (w * 0.5 + 0.6),
          y: baseY + 1.2 + bodyH,
          z: cz + sz * (d * 0.5 + 0.6),
        });
      }
    }
  }

  return {
    object: group,
    layer: 'surface',
  };
});

registerBuilder('plaza', (feature, ctx) => {
  const { THREE } = ctx;
  const group = new THREE.Group();
  group.name = feature.id;

  const [cx, cz] = feature.pos;
  const [w, d, h] = feature.size;
  const baseY = heightAt(cx, cz);
  const slabH = Math.max(0.3, h || 0.3);

  const isAlliance = feature.id === 'alliance_slope';

  if (isAlliance) {
    // Trampled earth interior with 3m stone_paving border
    const borderGeom = new THREE.BoxGeometry(w, slabH, d);
    borderGeom.translate(cx, baseY + slabH * 0.5, cz);
    const borderMesh = new THREE.Mesh(borderGeom, ctx.mats('stone_paving', { roughness: 0.86 }));
    borderMesh.receiveShadow = true;

    const innerGeom = new THREE.BoxGeometry(w - 6, slabH + 0.06, d - 6);
    innerGeom.translate(cx, baseY + slabH * 0.5 + 0.03, cz);
    const innerMesh = new THREE.Mesh(innerGeom, ctx.mats('path_earth', { roughness: 0.92 }));
    innerMesh.receiveShadow = true;

    group.add(borderMesh, innerMesh);
  } else {
    // Pavilion Square: stone_paving grey slabs
    const slabGeom = new THREE.BoxGeometry(w, slabH, d, 12, 1, 8);
    slabGeom.translate(cx, baseY + slabH * 0.5, cz);
    const slabMesh = new THREE.Mesh(slabGeom, ctx.mats('stone_paving', { roughness: 0.82 }));
    slabMesh.receiveShadow = true;

    const kerbGeom = new THREE.BoxGeometry(w + 1.2, slabH * 0.7, d + 1.2);
    kerbGeom.translate(cx, baseY + slabH * 0.35, cz);
    const kerbMesh = new THREE.Mesh(kerbGeom, ctx.mats('rock', { roughness: 0.9 }));

    group.add(slabMesh, kerbMesh);
  }

  return {
    object: group,
    layer: 'surface',
  };
});
