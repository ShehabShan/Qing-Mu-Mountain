import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PALETTE } from '../core/palette.js';
import { mulberry32 } from '../core/rng.js';

export function createSkyAndLighting(ctx) {
  const { THREE, scene, renderer, state } = ctx;

  // Studio environment reflection for realistic PBR materials
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
  pmremGenerator.dispose();

  // Sky dome (radius 1800m) with day/night vertex shader blend
  const skyGeom = new THREE.SphereGeometry(1800, 24, 16);
  const cSkyDay = new THREE.Color(PALETTE.sky_day);
  const cHorizonDay = new THREE.Color('#eef6fa');
  const cSkyNight = new THREE.Color(PALETTE.sky_night);
  const cHorizonNight = new THREE.Color(PALETTE.fog_night);

  const skyMat = new THREE.MeshBasicMaterial({
    side: THREE.BackSide,
    vertexColors: true,
    depthWrite: false,
  });

  const skyPos = skyGeom.attributes.position;
  const skyColors = new Float32Array(skyPos.count * 3);
  skyGeom.setAttribute('color', new THREE.BufferAttribute(skyColors, 3));
  const skyMesh = new THREE.Mesh(skyGeom, skyMat);
  skyMesh.name = 'sky_dome';
  scene.add(skyMesh);

  // 800 star points on upper hemisphere (visible at night)
  const rand = mulberry32(777);
  const starCount = 800;
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(0.12 + rand() * 0.88);
    const r = 1720;
    starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = r * Math.cos(phi);
    starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const starGeom = new THREE.BufferGeometry();
  starGeom.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xe8f4ff,
    size: 4.5,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const stars = new THREE.Points(starGeom, starMat);
  stars.name = 'night_stars';
  scene.add(stars);

  // Lights: Hemisphere fill + Directional Sun/Moon
  const hemiLight = new THREE.HemisphereLight(PALETTE.sky_day, PALETTE.grass_dark, 0.85);
  scene.add(hemiLight);

  // Sun from south-east at 50 deg elevation
  const sunLight = new THREE.DirectionalLight(0xfff5e4, 1.45);
  sunLight.position.set(420, 640, 420);
  if (!renderer.userData.isSoftwareGl && state.tier === 'polish') {
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.near = 100;
    sunLight.shadow.camera.far = 1600;
    const d = 520;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
  }
  scene.add(sunLight);

  // Fog
  const fogColor = new THREE.Color(PALETTE.fog_day);
  scene.fog = new THREE.Fog(fogColor, 250, 1400);
  scene.background = fogColor.clone();

  const tmpTop = new THREE.Color();
  const tmpBot = new THREE.Color();
  const tmpVert = new THREE.Color();
  const cSunDay = new THREE.Color(0xfff5e4);
  const cMoonNight = new THREE.Color('#9fb4ff');
  const cFogDay = new THREE.Color(PALETTE.fog_day);
  const cFogNight = new THREE.Color(PALETTE.fog_night);

  let lastBlend = -1;
  let lastCutaway = null;
  let lastUnder = null;

  function update(dt) {
    const targetBlend = state.night ? 1.0 : 0.0;
    if (state.nightBlend === undefined) state.nightBlend = targetBlend;

    // Toggle N blends over 2s (rate = 0.5/s)
    if (Math.abs(state.nightBlend - targetBlend) > 0.001) {
      const step = dt * 0.5;
      if (state.nightBlend < targetBlend) {
        state.nightBlend = Math.min(targetBlend, state.nightBlend + step);
      } else {
        state.nightBlend = Math.max(targetBlend, state.nightBlend - step);
      }
    } else {
      state.nightBlend = targetBlend;
    }

    const nb = state.nightBlend;
    const dimFactor = state.cutaway ? 0.3 : 1.0;

    if (
      Math.abs(nb - lastBlend) > 0.002 ||
      state.cutaway !== lastCutaway ||
      state.underground !== lastUnder
    ) {
      lastBlend = nb;
      lastCutaway = state.cutaway;
      lastUnder = state.underground;

      // Update sky dome vertex colors
      tmpTop.copy(cSkyDay).lerp(cSkyNight, nb).multiplyScalar(dimFactor);
      tmpBot.copy(cHorizonDay).lerp(cHorizonNight, nb).multiplyScalar(dimFactor);
      const colAttr = skyGeom.attributes.color;
      for (let i = 0; i < skyPos.count; i++) {
        const h = Math.max(0, Math.min(1, skyPos.getY(i) / 1400));
        tmpVert.copy(tmpBot).lerp(tmpTop, Math.pow(h, 0.55));
        colAttr.setXYZ(i, tmpVert.r, tmpVert.g, tmpVert.b);
      }
      colAttr.needsUpdate = true;

      starMat.opacity = nb * (state.cutaway ? 0.4 : 0.95);
      stars.visible = nb > 0.02 && !state.underground;

      // Update lights
      sunLight.color.copy(cSunDay).lerp(cMoonNight, nb);
      sunLight.intensity = (1.45 * (1 - nb) + 0.25 * nb) * (state.underground ? 0.2 : dimFactor);
      hemiLight.intensity = (0.85 * (1 - nb) + 0.22 * nb) * (state.underground ? 0.25 : dimFactor);

      // Update fog
      if (state.underground) {
        scene.fog.near = 9000;
        scene.fog.far = 10000;
        scene.background.set('#120c10');
      } else {
        scene.fog.color.copy(cFogDay).lerp(cFogNight, nb).multiplyScalar(dimFactor);
        scene.background.copy(scene.fog.color);
        scene.fog.near = 250 * (1 - nb) + 150 * nb;
        scene.fog.far = 1400 * (1 - nb) + 900 * nb;
      }

      ctx.updateEmissives(state);
    }
  }

  return { update, sunLight, hemiLight };
}
