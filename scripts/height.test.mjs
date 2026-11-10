import test from 'node:test';
import assert from 'node:assert/strict';
import { heightAt, slopeAt, nearestOnPolyline, TERRAIN } from '../src/core/height.js';
import { CANONICAL_CAMERAS, PORTALS, VALID_BUILDERS } from '../src/core/constants.js';

test('heightAt respects vertical ordering of Qing Mao Mountain landmarks', () => {
  const hRiver = heightAt(0, 470);
  const hXiong = heightAt(-290, 300);
  const hSGate = heightAt(0, 235);
  const hAlliance = heightAt(-322, -60);
  const hBai = heightAt(-55, -400);
  const hPavilion = heightAt(0, 95);
  const hNGate = heightAt(0, 20);
  const hSummit = heightAt(0, -130);

  assert.ok(hRiver < 0, `Expected river bed < 0, got ${hRiver}`);
  assert.ok(Math.abs(hXiong - 21) < 0.5, `Expected Xiong bench ~21, got ${hXiong}`);
  assert.ok(Math.abs(hAlliance - 46) < 0.5, `Expected Alliance Slope ~46, got ${hAlliance}`);
  assert.ok(Math.abs(hBai - 60) < 0.5, `Expected Bai bench ~60, got ${hBai}`);
  assert.ok(Math.abs(hPavilion - 80) < 0.5, `Expected Pavilion terrace ~80, got ${hPavilion}`);
  assert.ok(hSummit > 205 && hSummit < 209, `Expected Summit ~207, got ${hSummit}`);
  assert.ok(hXiong < hSGate && hSGate < hBai && hBai < hPavilion && hPavilion < hNGate && hNGate < hSummit);
});

test('deep pool bowl modifier carves pool below y=59 surface', () => {
  const poolCenter = heightAt(60, -395);
  assert.ok(poolCenter <= 51.5, `Expected deep pool center <= 51.5, got ${poolCenter}`);
});

test('slopeAt returns flat gradient on flattened Pavilion Square terrace', () => {
  const { slope } = slopeAt(0, 112);
  assert.ok(slope < 0.05, `Expected flat terrace at (0,112), got slope=${slope}`);
});

test('canonical cameras and portals are defined with valid coordinates', () => {
  assert.equal(Object.keys(CANONICAL_CAMERAS).length, 4);
  assert.equal(PORTALS.length, 2);
  assert.equal(VALID_BUILDERS.size, 28);
  const { dist } = nearestOnPolyline(TERRAIN.paths.main_road.pts, 0, 235);
  assert.ok(dist < 0.1);
});
