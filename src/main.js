import * as THREE from 'three';
import terrain from './data/terrain.json' with { type: 'json' };
import registry from './data/registry.json' with { type: 'json' };
import { PALETTE } from './core/palette.js';
import { mulberry32 } from './core/rng.js';
import { heightAt } from './core/height.js';
import { BUILDERS, createMaterialCache } from './core/builders.js';
import { createStatsManager } from './core/stats.js';

import './terrain/terrainMesh.js';
import './terrain/water.js';
import './terrain/waterfall.js';
import './arch/villages.js';
import './arch/walls.js';
import './arch/pavilion.js';
import './arch/halls.js';
import './arch/rockworks.js';
import './arch/hamlets.js';
import './veg/bamboo.js';
import './veg/flora.js';
import './atmos/lanterns.js';
import './atmos/mist.js';
import './under/caves.js';
import './under/spring.js';
import './under/rockForest.js';
import './under/bloodPond.js';
import './under/tunnel.js';

import { createSkyAndLighting } from './atmos/sky.js';
import { createCutawayManager } from './under/cutaway.js';
import { createCameraController } from './ui/cameras.js';
import { createWalker } from './ui/walker.js';
import { createHud } from './ui/hud.js';
import { setupInput } from './ui/input.js';

const params = new URLSearchParams(window.location.search);
const tierParam = params.get('tier') || 'polish';
const stageParam = params.get('stage') || '';
const checkParam = params.get('check') === '1';
const camParam = Number(params.get('cam')) || 2;

const allowedTiers = new Set(['must']);
if (tierParam === 'detail' || tierParam === 'polish') allowedTiers.add('detail');
if (tierParam === 'polish') allowedTiers.add('polish');

const isSoftwareGl = (() => {
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) return true;
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
  const gpu = String(gl.getParameter(param));
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
})();

const container = document.getElementById('canvas-container');
const renderer = new THREE.WebGLRenderer({ antialias: !isSoftwareGl, powerPreference: 'high-performance' });
renderer.userData = { isSoftwareGl };
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = !isSoftwareGl && tierParam === 'polish';
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 1.0, 2600);

const surfaceGroup = new THREE.Group();
surfaceGroup.name = 'surfaceGroup';
const undergroundGroup = new THREE.Group();
undergroundGroup.name = 'undergroundGroup';
undergroundGroup.visible = false;
scene.add(surfaceGroup, undergroundGroup);

const { mats, updateEmissives } = createMaterialCache(THREE);
const tickCallbacks = [];

const ctx = {
  THREE, scene, camera, renderer, heightAt, terrain, registry, palette: PALETTE,
  mats, updateEmissives, rng: mulberry32, surfaceGroup, undergroundGroup,
  onTick(fn) { tickCallbacks.push(fn); },
  state: { night: false, nightBlend: 0, cutaway: false, underground: false, mode: 'orbit', tier: tierParam, stage: stageParam },
};

const skySystem = createSkyAndLighting(ctx);
const statsManager = createStatsManager(renderer);
ctx.statsManager = statsManager;

let totalInstances = 0;
for (const f of registry) {
  if (!allowedTiers.has(f.tier)) continue;
  const builderFn = BUILDERS[f.builder];
  if (!builderFn) {
    console.warn(`Skipping feature '${f.id}': no builder registered for '${f.builder}'`);
    continue;
  }
  const res = builderFn(f, ctx);
  if (!res || !res.object) continue;
  res.object.userData.feature = f;
  if (res.layer === 'underground' || f.builder.startsWith('cave_')) undergroundGroup.add(res.object);
  else surfaceGroup.add(res.object);
  if (res.update) tickCallbacks.push(res.update);
  if (res.stats?.instances) totalInstances += res.stats.instances;
}
statsManager.statsState.instances = totalInstances;

if (stageParam === 'ice') {
  const iceMat = new THREE.MeshStandardMaterial({ color: '#dff4ff', roughness: 0.22, metalness: 0.15, flatShading: true });
  surfaceGroup.traverse((obj) => { if (obj.isMesh && obj.name !== 'night_light_band') obj.material = iceMat; });
}

ctx.cutawayManager = createCutawayManager(ctx);
ctx.cameraController = createCameraController(ctx);
ctx.walker = createWalker(ctx);
ctx.hud = createHud(ctx);
setupInput(ctx);

ctx.cameraController.jumpToCamera(camParam, true);
skySystem.update(0.016);
if (checkParam) statsManager.runAutomatedCheck((id, inst) => ctx.cameraController.jumpToCamera(id, inst));

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
let frameId = 0;

function afterDraw(cb) {
  const gl = renderer.getContext();
  if (gl && gl.fenceSync) {
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      const st = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (st === gl.UNSIGNALED) frameId = window.setTimeout(poll, 5);
      else { gl.deleteSync(sync); frameId = window.setTimeout(cb, 80); }
    };
    frameId = window.setTimeout(poll, 5);
  } else frameId = window.setTimeout(cb, 80);
}

function tick() {
  const dt = Math.min(clock.getDelta(), 0.1);
  skySystem.update(dt);
  ctx.cameraController.update(dt);
  ctx.walker.update(dt);
  for (let i = 0; i < tickCallbacks.length; i++) tickCallbacks[i](dt, ctx.state);
  renderer.render(scene, camera);
  statsManager.update(dt);
  ctx.hud.updateStatsDom(dt);
  if (isSoftwareGl) afterDraw(tick);
  else frameId = requestAnimationFrame(tick);
}

tick();
