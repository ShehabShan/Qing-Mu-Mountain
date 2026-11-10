import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { registerBuilder } from '../core/builders.js';
import { heightAt } from '../core/height.js';
import { PALETTE } from '../core/palette.js';

function createLanternGlowTexture(THREE) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const c = canvas.getContext('2d');
  const grad = c.createRadialGradient(32, 32, 3, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255, 245, 210, 1.0)');
  grad.addColorStop(0.35, 'rgba(255, 177, 92, 0.92)');
  grad.addColorStop(0.75, 'rgba(255, 140, 50, 0.35)');
  grad.addColorStop(1, 'rgba(255, 120, 30, 0.0)');
  c.fillStyle = grad;
  c.fillRect(0, 0, 64, 64);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeLanternQuadCluster(THREE) {
  const sz = 1.85;
  const p1 = new THREE.PlaneGeometry(sz, sz);
  const p2 = new THREE.PlaneGeometry(sz, sz);
  p2.rotateY(Math.PI / 2);
  return mergeGeometries([p1, p2], false);
}

registerBuilder('lantern_band', (feature, ctx) => {
  const { THREE, terrain, rng: makeRng, registry } = ctx;
  const group = new THREE.Group();
  group.name = feature.id;

  const seed = 1 + registry.findIndex((f) => f.id === feature.id);
  const rand = makeRng(seed > 0 ? seed : 8);

  // Total 2,400 lantern points per §5 & §6.5:
  // - 1,400 on house windows/eaves
  // - 500 along main_road from south gate down to river landing (every ~1.6m in pairs)
  // - 300 in mortal hamlets
  // - 200 on pavilion and wall towers
  const points = [];

  // 1. 1,400 on house windows & eaves
  const houseAnchors = ctx.houseLanternAnchors || [];
  for (let i = 0; i < 1400; i++) {
    if (houseAnchors.length > 0) {
      const a = houseAnchors[i % houseAnchors.length];
      const jitter = i >= houseAnchors.length ? (rand() - 0.5) * 1.4 : 0;
      points.push({
        x: a.x + jitter,
        y: a.y + (i >= houseAnchors.length ? 0.5 : 0),
        z: a.z + jitter,
        flicker: false,
        phase: rand() * 6.28,
      });
    } else {
      const x = (rand() - 0.5) * 200;
      const z = 30 + rand() * 195;
      points.push({ x, y: heightAt(x, z) + 4.0, z, flicker: false, phase: rand() * 6.28 });
    }
  }

  // 2. 500 along main_road from river landing up to south gate & square (250 pairs)
  const mrPts = terrain.paths.main_road.pts;
  // Build cumulative path segments
  const segs = [];
  let totalLen = 0;
  for (let i = 0; i < mrPts.length - 1; i++) {
    const a = mrPts[i];
    const b = mrPts[i + 1];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    segs.push({ a, b, l, start: totalLen });
    totalLen += l;
  }

  for (let p = 0; p < 250; p++) {
    const dist = (p / 249) * totalLen;
    let seg = segs[segs.length - 1];
    for (const s of segs) {
      if (dist <= s.start + s.l) {
        seg = s;
        break;
      }
    }
    const t = seg.l > 0 ? (dist - seg.start) / seg.l : 0;
    const cx = seg.a[0] + (seg.b[0] - seg.a[0]) * t;
    const cz = seg.a[1] + (seg.b[1] - seg.a[1]) * t;
    const dx = seg.b[0] - seg.a[0];
    const dz = seg.b[1] - seg.a[1];
    const len = Math.hypot(dx, dz) || 1;
    const nx = -dz / len;
    const nz = dx / len;

    for (const side of [-1, 1]) {
      const lx = cx + nx * side * 2.8;
      const lz = cz + nz * side * 2.8;
      const ly = heightAt(lx, lz) + 1.8;
      points.push({
        x: lx,
        y: ly,
        z: lz,
        flicker: true,
        freq: 0.5 + rand() * 1.5,
        phase: rand() * 6.28,
      });
    }
  }

  // 3. 300 in mortal hamlets
  const hamletAnchors = ctx.hamletLanternAnchors || [];
  const hamletCenters = [
    [-60, 415],
    [30, 415],
    [105, 415],
    [-400, 425],
    [-240, -455],
  ];
  for (let i = 0; i < 300; i++) {
    if (i < hamletAnchors.length) {
      const a = hamletAnchors[i];
      points.push({ x: a.x, y: a.y, z: a.z, flicker: true, freq: 1.0, phase: rand() * 6.28 });
    } else {
      const [hcx, hcz] = hamletCenters[i % hamletCenters.length];
      const ang = rand() * Math.PI * 2;
      const rad = 4 + rand() * 14;
      const lx = hcx + Math.cos(ang) * rad;
      const lz = hcz + Math.sin(ang) * rad * 0.7;
      points.push({
        x: lx,
        y: heightAt(lx, lz) + 2.0,
        z: lz,
        flicker: true,
        freq: 0.8 + rand(),
        phase: rand() * 6.28,
      });
    }
  }

  // 4. 200 on pavilion and wall towers
  const towerAnchors = ctx.towerLanternAnchors || [];
  for (let i = 0; i < 200; i++) {
    if (towerAnchors.length > 0) {
      const a = towerAnchors[i % towerAnchors.length];
      const offset = i >= towerAnchors.length ? ((i % 5) - 2) * 0.6 : 0;
      points.push({
        x: a.x + offset,
        y: a.y,
        z: a.z,
        flicker: false,
        phase: rand() * 6.28,
      });
    } else {
      points.push({
        x: (rand() - 0.5) * 24,
        y: 85 + (i % 5) * 5,
        z: 95 + (rand() - 0.5) * 18,
        flicker: false,
        phase: 0,
      });
    }
  }

  const total = points.length; // 2400
  const geom = makeLanternQuadCluster(THREE);
  const tex = createLanternGlowTexture(THREE);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    color: PALETTE.lantern_warm,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const inst = new THREE.InstancedMesh(geom, mat, total);
  inst.frustumCulled = false;
  const dummy = new THREE.Object3D();

  for (let i = 0; i < total; i++) {
    const p = points[i];
    dummy.position.set(p.x, p.y, p.z);
    dummy.scale.setScalar(1.0);
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
  }
  inst.instanceMatrix.needsUpdate = true;
  group.add(inst);

  // 6 nearest-to-camera moving PointLights, range 40m, intensity 2
  const pointLights = [];
  const anchorClusters = [
    [60, heightAt(60, 440) + 3, 440],
    [30, heightAt(30, 350) + 3, 350],
    [0, heightAt(0, 235) + 4, 235],
    [0, heightAt(0, 132) + 4, 132],
    [0, heightAt(0, 95) + 12, 95],
    [-290, heightAt(-290, 300) + 4, 300],
  ];
  for (let i = 0; i < 6; i++) {
    const pl = new THREE.PointLight(PALETTE.lantern_warm, 0, 40);
    const [px, py, pz] = anchorClusters[i];
    pl.position.set(px, py, pz);
    group.add(pl);
    pointLights.push(pl);
  }

  let elapsed = 0;
  group.visible = false;

  return {
    object: group,
    layer: 'surface',
    lights: pointLights,
    stats: { instances: total },
    update(dt, state) {
      const nb = state.nightBlend || 0;
      const isNight = nb > 0.04;
      group.visible = isNight;
      if (!isNight) {
        for (const pl of pointLights) pl.intensity = 0;
        return;
      }

      elapsed += dt;
      mat.opacity = 0.95 * nb;

      // Subtle flicker on road lanterns (indices 1400..1900)
      for (let i = 1400; i < 1900; i += 4) {
        const p = points[i];
        const s = 1.0 + 0.1 * Math.sin(elapsed * p.freq * 6.28 + p.phase);
        dummy.position.set(p.x, p.y, p.z);
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
      }
      inst.instanceMatrix.needsUpdate = true;

      for (const pl of pointLights) {
        pl.intensity = 2.0 * nb;
      }
    },
  };
});
