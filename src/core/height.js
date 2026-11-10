import T from '../data/terrain.json' with { type: 'json' };

export const TERRAIN = T;

export function smoothstep(edge0, edge1, x) {
  if (edge1 === edge0) return x >= edge1 ? 1 : 0;
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function catmullRom1D(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

export function gridCatmull(x, z) {
  const rows = T.grid.rows_by_z;
  const nx = T.grid.count[0] - 1; // 10
  const nz = T.grid.count[1] - 1; // 10
  const gx = Math.max(0, Math.min(nx, (x - T.grid.origin[0]) / T.grid.spacing));
  const gz = Math.max(0, Math.min(nz, (z - T.grid.origin[1]) / T.grid.spacing));

  const ix = Math.min(nx - 1, Math.floor(gx));
  const iz = Math.min(nz - 1, Math.floor(gz));
  const tx = gx - ix;
  const tz = gz - iz;

  const colVals = [0, 0, 0, 0];
  for (let dj = -1; dj <= 2; dj++) {
    const rj = Math.max(0, Math.min(nz, iz + dj));
    const row = rows[rj];
    const c0 = row[Math.max(0, Math.min(nx, ix - 1))];
    const c1 = row[Math.max(0, Math.min(nx, ix))];
    const c2 = row[Math.max(0, Math.min(nx, ix + 1))];
    const c3 = row[Math.max(0, Math.min(nx, ix + 2))];
    colVals[dj + 1] = catmullRom1D(c0, c1, c2, c3, tx);
  }
  return catmullRom1D(colVals[0], colVals[1], colVals[2], colVals[3], tz);
}

function applyModifier(m, x, z, v) {
  if (m.op === 'bowl') {
    const [cx, cz] = m.c;
    const d = Math.hypot(x - cx, z - cz);
    if (d < m.r) {
      const ratio = d / m.r;
      return Math.min(v, m.y - m.depth * (1 - ratio * ratio));
    }
    return v;
  }
  const [cx, cz, rw, rd] = m.rect;
  const dx = Math.max(0, Math.abs(x - cx) - rw * 0.5);
  const dz = Math.max(0, Math.abs(z - cz) - rd * 0.5);
  const d = Math.hypot(dx, dz);
  if (d >= m.blend) return v;
  const wgt = 1 - smoothstep(0, m.blend, d);
  const t = v + (m.y - v) * wgt;
  if (m.op === 'flatten') return t;
  if (m.op === 'raise') return Math.max(v, t);
  return v;
}

export function nearestOnPolyline(pts, x, z) {
  let bestDist = Infinity;
  let bestBed = 0;
  let bestSegIdx = 0;
  let bestT = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const vx = b[0] - a[0];
    const vz = b[1] - a[1];
    const len2 = vx * vx + vz * vz;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - a[0]) * vx + (z - a[1]) * vz) / len2)) : 0;
    const px = a[0] + t * vx;
    const pz = a[1] + t * vz;
    const d = Math.hypot(x - px, z - pz);
    if (d < bestDist) {
      bestDist = d;
      bestBed = a[2] !== undefined && b[2] !== undefined ? a[2] + t * (b[2] - a[2]) : 0;
      bestSegIdx = i;
      bestT = t;
    }
  }
  return { dist: bestDist, bed: bestBed, segIdx: bestSegIdx, t: bestT };
}

export function heightAt(x, z) {
  let v = gridCatmull(x, z);
  for (const m of T.modifiers) v = applyModifier(m, x, z, v);
  for (const id of ['yellow_dragon_river', 'waterfall_tributary']) {
    const r = T.rivers[id];
    const { dist, bed } = nearestOnPolyline(r.pts, x, z);
    if (dist < r.halfWidth + r.bank) {
      const tgt = bed + Math.max(0, dist - r.halfWidth) * r.bankSlope;
      const w = 1 - smoothstep(r.halfWidth, r.halfWidth + r.bank, dist);
      v = v + (Math.min(v, tgt) - v) * w;
    }
  }
  return v;
}

export function slopeAt(x, z, eps = 1.5) {
  const hx1 = heightAt(x + eps, z);
  const hx0 = heightAt(x - eps, z);
  const hz1 = heightAt(x, z + eps);
  const hz0 = heightAt(x, z - eps);
  const dx = (hx1 - hx0) / (2 * eps);
  const dz = (hz1 - hz0) / (2 * eps);
  return { slope: Math.hypot(dx, dz), dx, dz };
}

export function isNearRoadOrWater(x, z, roadPad = 2, waterPad = 4) {
  for (const key of Object.keys(T.paths)) {
    const p = T.paths[key];
    const { dist } = nearestOnPolyline(p.pts, x, z);
    if (dist < p.width * 0.5 + roadPad) return true;
  }
  for (const key of Object.keys(T.rivers)) {
    const r = T.rivers[key];
    const { dist } = nearestOnPolyline(r.pts, x, z);
    if (dist < r.halfWidth + waterPad) return true;
  }
  // Also check deep_pool
  if (Math.hypot(x - 60, z - -395) < 28 + waterPad) return true;
  return false;
}
