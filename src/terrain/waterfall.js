import { registerBuilder } from '../core/builders.js';
import { PALETTE } from '../core/palette.js';

function createFallTexture(THREE) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const c = canvas.getContext('2d');
  c.fillStyle = PALETTE.water_trib;
  c.fillRect(0, 0, 128, 128);

  c.fillStyle = PALETTE.water_fall;
  for (let i = 0; i < 48; i++) {
    c.globalAlpha = 0.35 + (i % 4) * 0.15;
    const x = (i * 19) % 120;
    const y = (i * 23) % 128;
    const w = 3 + (i % 5);
    c.fillRect(x, y, w, 34);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createMistTexture(THREE) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const c = canvas.getContext('2d');
  const grad = c.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(232, 238, 240, 0.75)');
  grad.addColorStop(0.5, 'rgba(232, 238, 240, 0.35)');
  grad.addColorStop(1, 'rgba(232, 238, 240, 0)');
  c.fillStyle = grad;
  c.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

registerBuilder('waterfall', (feature, ctx) => {
  const { THREE } = ctx;
  const group = new THREE.Group();
  group.name = feature.id;

  // 1. Deep Pool disc r=28 at (60, -395), surface y=59
  const poolGeom = new THREE.CircleGeometry(28, 32);
  poolGeom.rotateX(-Math.PI / 2);
  poolGeom.translate(60, 59, -395);
  const poolMat = ctx.mats('water_pool', {
    roughness: 0.18,
    metalness: 0.2,
    opacity: 0.92,
  });
  const poolMesh = new THREE.Mesh(poolGeom, poolMat);
  group.add(poolMesh);

  // Foam impact ring at base of falls (60, 59.08, -369)
  const ringGeom = new THREE.RingGeometry(4, 11, 24);
  ringGeom.rotateX(-Math.PI / 2);
  ringGeom.translate(60, 59.08, -369);
  const ringMesh = new THREE.Mesh(
    ringGeom,
    ctx.mats('water_fall', { opacity: 0.7, depthWrite: false })
  );
  group.add(ringMesh);

  // 2. Falling sheet: 14m wide, 6 bent quads from lip (60, -345, y=97) to pool (60, -369, y=59)
  const segsY = 6;
  const sheetGeom = new THREE.PlaneGeometry(14, 38, 4, segsY);
  const pos = sheetGeom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i);
    const ly = pos.getY(i); // +19 at top, -19 at bottom
    const t = (19 - ly) / 38; // 0 at lip, 1 at pool
    const worldX = 60 + lx;
    const worldY = 97 - t * 38;
    // Slight parabolic arc outward toward -z
    const worldZ = -345 - Math.pow(t, 0.72) * 24;
    pos.setXYZ(i, worldX, worldY, worldZ);
  }
  sheetGeom.computeVertexNormals();

  const fallTex = createFallTexture(THREE);
  const fallMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: fallTex,
    roughness: 0.25,
    metalness: 0.1,
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide,
    flatShading: true,
  });
  const fallMesh = new THREE.Mesh(sheetGeom, fallMat);
  group.add(fallMesh);

  // 3. Mist puff sprites at the waterfall base
  const mistTex = createMistTexture(THREE);
  const mistMat = new THREE.SpriteMaterial({
    map: mistTex,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });

  const mistSprites = [];
  for (let i = 0; i < 8; i++) {
    const sp = new THREE.Sprite(mistMat);
    const angle = (i / 8) * Math.PI * 2;
    const bx = 60 + Math.cos(angle) * 7;
    const bz = -369 + Math.sin(angle) * 5;
    sp.position.set(bx, 61 + (i % 3) * 1.8, bz);
    const sc = 9 + (i % 3) * 3;
    sp.scale.set(sc, sc * 0.7, 1);
    sp.userData = { baseY: sp.position.y, phase: i * 0.9 };
    group.add(sp);
    mistSprites.push(sp);
  }

  let time = 0;
  return {
    object: group,
    layer: 'surface',
    update(dt) {
      time += dt;
      // V-scroll 3 m/s over 38m drop
      fallTex.offset.y += (3.0 / 38.0) * dt;
      for (const sp of mistSprites) {
        sp.position.y = sp.userData.baseY + Math.sin(time * 1.4 + sp.userData.phase) * 1.2;
      }
    },
  };
});
