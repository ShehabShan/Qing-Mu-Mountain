import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { registerBuilder } from '../core/builders.js';
import { heightAt } from '../core/height.js';
import { PALETTE } from '../core/palette.js';

function createWaterTexture(THREE, baseHex, foamHex) {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 128;
  const c = canvas.getContext('2d');
  c.fillStyle = baseHex;
  c.fillRect(0, 0, 128, 128);
  c.fillStyle = foamHex;
  c.globalAlpha = 0.75;
  c.fillRect(0, 0, 9, 128);
  c.fillRect(119, 0, 9, 128);
  c.globalAlpha = 0.22;
  for (let i = 0; i < 36; i++) c.fillRect(14 + ((i * 29) % 100), (i * 43) % 128, 3, 18);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function buildPolylineRibbon(THREE, pts, width, sampleStep, yFunc) {
  const samples = [];
  let totalDist = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const segLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const steps = Math.max(2, Math.ceil(segLen / sampleStep));
    for (let s = 0; s < steps; s++) {
      if (i > 0 && s === 0) continue;
      const t = s / steps;
      const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
      const bed = a[2] !== undefined && b[2] !== undefined ? a[2] + (b[2] - a[2]) * t : 0;
      if (samples.length > 0) {
        const prev = samples[samples.length - 1];
        totalDist += Math.hypot(x - prev.x, z - prev.z);
      }
      samples.push({ x, z, bed, y: yFunc(x, z, bed), dist: totalDist });
    }
  }
  const last = pts[pts.length - 1], prev = samples[samples.length - 1];
  totalDist += Math.hypot(last[0] - prev.x, last[1] - prev.z);
  samples.push({ x: last[0], z: last[1], bed: last[2] || 0, y: yFunc(last[0], last[1], last[2] || 0), dist: totalDist });

  const n = samples.length;
  const positions = new Float32Array(n * 2 * 3), uvs = new Float32Array(n * 2 * 2);
  const indices = [], hw = width * 0.5;

  for (let i = 0; i < n; i++) {
    const p = samples[i], pPrev = samples[Math.max(0, i - 1)], pNext = samples[Math.min(n - 1, i + 1)];
    let tx = pNext.x - pPrev.x, tz = pNext.z - pPrev.z;
    const len = Math.hypot(tx, tz) || 1;
    tx /= len; tz /= len;
    const nx = -tz, nz = tx;
    positions[i * 6] = p.x - nx * hw; positions[i * 6 + 1] = p.y; positions[i * 6 + 2] = p.z - nz * hw;
    positions[i * 6 + 3] = p.x + nx * hw; positions[i * 6 + 4] = p.y; positions[i * 6 + 5] = p.z + nz * hw;
    const vCoord = p.dist / Math.max(4, width);
    uvs[i * 4] = 0; uvs[i * 4 + 1] = vCoord; uvs[i * 4 + 2] = 1; uvs[i * 4 + 3] = vCoord;
    if (i < n - 1) {
      const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, d = (i + 1) * 2 + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return { geom, samples };
}

registerBuilder('water_river', (feature, ctx) => {
  const { THREE, terrain } = ctx;
  const rData = terrain.rivers[feature.id];
  const width = rData.halfWidth * 2 + 2;
  const colorKey = feature.id === 'yellow_dragon_river' ? 'water_yellow' : 'water_trib';
  const tex = createWaterTexture(THREE, PALETTE[colorKey], PALETTE.white_flower);
  const { geom } = buildPolylineRibbon(THREE, rData.pts, width, 8, (_x, _z, bed) => bed + rData.water);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff, map: tex, roughness: 0.25, metalness: 0.15, transparent: true, opacity: 0.9, flatShading: true,
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.name = feature.id;
  return { object: mesh, layer: 'surface', update(dt) { tex.offset.y -= (0.4 / width) * dt; } };
});

registerBuilder('water_stream', (feature, ctx) => {
  const { THREE, terrain } = ctx;
  const group = new THREE.Group();
  group.name = feature.id;
  const streamKeys = feature.id === 'rockcrack_stream' ? ['rockcrack_stream', 'rockcrack_runoff'] : [feature.id];
  const baseColor = new THREE.Color(PALETTE.water_trib), pulseColor = new THREE.Color(PALETTE.water_fall);
  const mat = new THREE.MeshStandardMaterial({
    color: baseColor.clone(), roughness: 0.2, metalness: 0.1, flatShading: true,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
  const geoms = [];
  for (const key of streamKeys) {
    const rData = terrain.rivers[key];
    if (rData) geoms.push(buildPolylineRibbon(THREE, rData.pts, 3.0, 4, (x, z) => heightAt(x, z) + 0.15).geom);
  }
  if (geoms.length > 0) group.add(new THREE.Mesh(mergeGeometries(geoms, false), mat));
  let elapsed = 0;
  return {
    object: group, layer: 'surface',
    update(dt) {
      elapsed += dt;
      mat.color.copy(baseColor).lerp(pulseColor, (0.5 + 0.5 * Math.sin(elapsed * 2.2)) * 0.28);
    },
  };
});

registerBuilder('path', (feature, ctx) => {
  const { THREE, terrain } = ctx;
  const pData = terrain.paths[feature.id];
  const group = new THREE.Group();
  group.name = feature.id;
  const { geom, samples } = buildPolylineRibbon(THREE, pData.pts, pData.width, 3.5, (x, z) => heightAt(x, z) + 0.12);
  const ribbonMesh = new THREE.Mesh(geom, ctx.mats('path_earth', { roughness: 0.92, metalness: 0.02 }));
  ribbonMesh.receiveShadow = true;
  group.add(ribbonMesh);

  const stepGeoms = [];
  for (let i = 0; i < samples.length - 1; i++) {
    const a = samples[i], b = samples[i + 1];
    const run = Math.hypot(b.x - a.x, b.z - a.z);
    if (run < 0.1) continue;
    const rise = Math.abs(b.y - a.y);
    if (rise / run > 0.35) {
      const numSteps = Math.max(1, Math.floor(rise / 0.25));
      const yaw = Math.atan2(b.x - a.x, b.z - a.z);
      for (let s = 0; s < numSteps; s++) {
        const t = (s + 0.5) / numSteps;
        const sx = a.x + (b.x - a.x) * t, sz = a.z + (b.z - a.z) * t;
        const box = new THREE.BoxGeometry(pData.width * 0.92, 0.24, Math.min(0.8, run / numSteps));
        box.rotateY(yaw);
        box.translate(sx, heightAt(sx, sz) + 0.16, sz);
        stepGeoms.push(box);
      }
    }
  }
  if (stepGeoms.length > 0) {
    const stepMesh = new THREE.Mesh(mergeGeometries(stepGeoms, false), ctx.mats('stone_paving', { roughness: 0.85 }));
    stepMesh.receiveShadow = true;
    group.add(stepMesh);
  }
  return { object: group, layer: 'surface' };
});
