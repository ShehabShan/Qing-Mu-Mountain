import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { heightAt } from '../src/core/height.js';
import { EXEMPT_OVERLAP_BUILDERS, VALID_BUILDERS } from '../src/core/constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

let errors = 0;
function fail(msg) {
  console.error(`[FAIL] ${msg}`);
  errors++;
}
function pass(msg) {
  console.log(`[PASS] ${msg}`);
}

// 1. Both JSON files parse & schema check
const terrainRaw = fs.readFileSync(path.join(rootDir, 'src/data/terrain.json'), 'utf8');
const registryRaw = fs.readFileSync(path.join(rootDir, 'src/data/registry.json'), 'utf8');
const terrain = JSON.parse(terrainRaw);
const registry = JSON.parse(registryRaw);

const requiredFields = [
  'id', 'name', 'aliases', 'tier', 'tag', 'ref',
  'pos', 'elevation', 'size', 'look', 'builder', 'notes',
];
const validTags = new Set(['CANON', 'INFERRED', 'INVENTED']);
const validTiers = new Set(['must', 'detail', 'polish']);
const seenIds = new Set();

for (const f of registry) {
  for (const field of requiredFields) {
    if (!(field in f)) fail(`Feature ${f.id || '?'} missing field '${field}'`);
  }
  if (!validTags.has(f.tag)) fail(`Feature ${f.id} has invalid tag '${f.tag}'`);
  if (!validTiers.has(f.tier)) fail(`Feature ${f.id} has invalid tier '${f.tier}'`);
  if (seenIds.has(f.id)) fail(`Duplicate feature id '${f.id}'`);
  seenIds.add(f.id);
}
pass(`Check 1: JSON parsed & ${registry.length} registry entries verified.`);

// 2. Counts: must <= 15; INVENTED share < 15%
const mustCount = registry.filter((f) => f.tier === 'must').length;
const inventedCount = registry.filter((f) => f.tag === 'INVENTED').length;
const inventedShare = inventedCount / registry.length;
if (mustCount > 15) fail(`must count ${mustCount} > 15`);
if (inventedShare >= 0.15) fail(`INVENTED share ${(inventedShare * 100).toFixed(1)}% >= 15%`);
pass(`Check 2: Counts OK (must=${mustCount}, INVENTED=${(inventedShare * 100).toFixed(1)}%).`);

// 3. Bounds: every footprint lies within +-500
for (const f of registry) {
  const [x, z] = f.pos;
  const [w, d] = f.size;
  if (x - w / 2 < -500.01 || x + w / 2 > 500.01 || z - d / 2 < -500.01 || z + d / 2 > 500.01) {
    fail(`Feature ${f.id} exceeds +-500 bounds: pos=[${x},${z}], size=[${w},${d}]`);
  }
}
pass('Check 3: All footprints lie within +-500.');

// 4. Overlap: no 2D overlap between non-exempt surface footprints; no 3D overlap between cave_* (except cave_tunnel)
const surfaceNonExempt = registry.filter(
  (f) => !f.builder.startsWith('cave_') && !EXEMPT_OVERLAP_BUILDERS.has(f.builder)
);
for (let i = 0; i < surfaceNonExempt.length; i++) {
  for (let j = i + 1; j < surfaceNonExempt.length; j++) {
    const a = surfaceNonExempt[i];
    const b = surfaceNonExempt[j];
    const overlapX = Math.abs(a.pos[0] - b.pos[0]) < (a.size[0] + b.size[0]) / 2;
    const overlapZ = Math.abs(a.pos[1] - b.pos[1]) < (a.size[1] + b.size[1]) / 2;
    if (overlapX && overlapZ) {
      fail(`2D surface overlap between '${a.id}' and '${b.id}'`);
    }
  }
}

const caves = registry.filter((f) => f.builder.startsWith('cave_') && f.builder !== 'cave_tunnel');
for (let i = 0; i < caves.length; i++) {
  for (let j = i + 1; j < caves.length; j++) {
    const a = caves[i];
    const b = caves[j];
    const overlapX = Math.abs(a.pos[0] - b.pos[0]) < (a.size[0] + b.size[0]) / 2;
    const overlapZ = Math.abs(a.pos[1] - b.pos[1]) < (a.size[1] + b.size[1]) / 2;
    const aY0 = Number(a.elevation);
    const aY1 = aY0 + a.size[2];
    const bY0 = Number(b.elevation);
    const bY1 = bY0 + b.size[2];
    const overlapY = aY0 < bY1 && bY0 < aY1;
    if (overlapX && overlapZ && overlapY) {
      fail(`3D cave overlap between '${a.id}' and '${b.id}'`);
    }
  }
}
pass('Check 4: No 2D surface overlaps or 3D cave overlaps.');

// 5. Underground: each cave volume's top is <= min terrain height over its footprint (9 samples) - 4 m
for (const c of registry.filter((f) => f.builder.startsWith('cave_') && f.builder !== 'cave_tunnel')) {
  const [cx, cz] = c.pos;
  const [w, d, h] = c.size;
  const topY = Number(c.elevation) + h;
  let minGround = Infinity;
  for (const sx of [-0.5, 0, 0.5]) {
    for (const sz of [-0.5, 0, 0.5]) {
      const gh = heightAt(cx + sx * w, cz + sz * d);
      if (gh < minGround) minGround = gh;
    }
  }
  if (topY > minGround - 4) {
    fail(`Cave '${c.id}' top (${topY.toFixed(1)}) > minGround (${minGround.toFixed(1)}) - 4`);
  }
}
pass('Check 5: All underground volumes sit at least 4 m below terrain.');

// 6. Vertical order
const hXiong = heightAt(-290, 300);
const hSGate = heightAt(0, 235);
const hBai = heightAt(-55, -400);
const hPav = heightAt(0, 95);
const hNGate = heightAt(0, 20);
const hSummit = heightAt(0, -130);
if (!(hXiong < hSGate && hSGate < hBai && hBai < hPav && hPav < hNGate && hNGate < hSummit)) {
  fail(
    `Vertical order failed: Xiong=${hXiong.toFixed(1)}, SGate=${hSGate.toFixed(1)}, Bai=${hBai.toFixed(1)}, Pav=${hPav.toFixed(1)}, NGate=${hNGate.toFixed(1)}, Summit=${hSummit.toFixed(1)}`
  );
}
pass(
  `Check 6: Vertical order OK (${hXiong.toFixed(1)} < ${hSGate.toFixed(1)} < ${hBai.toFixed(1)} < ${hPav.toFixed(1)} < ${hNGate.toFixed(1)} < ${hSummit.toFixed(1)}).`
);

// 7. Halls, pavilion, square and tavern sit inside wall rectangle x -115..115, z 20..235
const insideWallIds = ['clan_pavilion', 'pavilion_square', 'academy', 'dormitories', 'medicine_hall', 'punishment_hall', 'tavern'];
for (const id of insideWallIds) {
  const f = registry.find((e) => e.id === id);
  if (!f) {
    fail(`Missing feature ${id}`);
    continue;
  }
  const [x, z] = f.pos;
  const [w, d] = f.size;
  if (x - w / 2 < -115 || x + w / 2 > 115 || z - d / 2 < 20 || z + d / 2 > 235) {
    fail(`Feature ${id} sits outside Gu Yue wall rectangle`);
  }
}
pass('Check 7: Halls, pavilion, square, and tavern sit inside Gu Yue wall.');

// 8. main_road 3D length at 5 m/s is 120-180 s
const mrPts = terrain.paths.main_road.pts;
let mrLen = 0;
for (let i = 0; i < mrPts.length - 1; i++) {
  const [x0, z0] = mrPts[i];
  const [x1, z1] = mrPts[i + 1];
  const y0 = heightAt(x0, z0);
  const y1 = heightAt(x1, z1);
  mrLen += Math.hypot(x1 - x0, y1 - y0, z1 - z0);
}
const mrTime = mrLen / 5;
if (mrTime < 120 || mrTime > 180) {
  fail(`main_road walk time ${mrTime.toFixed(1)}s (${mrLen.toFixed(1)}m) outside 120-180s`);
}
pass(`Check 8: main_road 3D length=${mrLen.toFixed(1)}m, walk time=${mrTime.toFixed(1)}s.`);

// 9. Every builder value is in the §6.2 list
for (const f of registry) {
  if (!VALID_BUILDERS.has(f.builder)) {
    fail(`Feature ${f.id} uses unknown builder '${f.builder}'`);
  }
}
pass('Check 9: All builders match §6.2 glossary.');

// 10. Source budget: every file in src/ is <= 300 lines; total <= 4000
function walkSrc(dir) {
  let list = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) list = list.concat(walkSrc(p));
    else list.push(p);
  }
  return list;
}
const srcFiles = walkSrc(path.join(rootDir, 'src'));
let totalLines = 0;
for (const file of srcFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n').length;
  totalLines += lines;
  const rel = path.relative(rootDir, file);
  if (lines > 300) {
    fail(`File ${rel} has ${lines} lines (> 300 limit)`);
  }
}
if (totalLines > 4000) {
  fail(`Total lines in src/ is ${totalLines} (> 4000 limit)`);
}
pass(`Check 10: Source budget OK (${srcFiles.length} files, ${totalLines} total lines).`);

if (errors > 0) {
  console.error(`\nValidation FAILED with ${errors} error(s).`);
  process.exit(1);
} else {
  console.log('\nALL VALIDATION CHECKS PASSED.');
  process.exit(0);
}
