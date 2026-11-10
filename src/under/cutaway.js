import { CUTAWAY_BOX } from '../core/constants.js';
import { PALETTE } from '../core/palette.js';

export function createCutawayManager(ctx) {
  const { THREE, scene, surfaceGroup, undergroundGroup, state } = ctx;

  // Dedicated underground ambient/point light for cutaway and cave exploration
  const underLight = new THREE.PointLight(PALETTE.spring_glow, 0, 220);
  underLight.position.set(45, 65, 110);
  scene.add(underLight);

  const bloodLight = new THREE.PointLight(PALETTE.red_earth, 0, 160);
  bloodLight.position.set(30, 15, 150);
  scene.add(bloodLight);

  function applyCutawayState() {
    const showUnder = Boolean(state.cutaway || state.underground);
    undergroundGroup.visible = showUnder;
    underLight.intensity = showUnder ? 1.8 : 0;
    bloodLight.intensity = showUnder ? 1.4 : 0;

    // Hide terrain chunks overlapping x -30..140, z 20..200 when cutaway is active
    const terrainRoot = surfaceGroup.getObjectByName('terrain_root');
    if (terrainRoot) {
      for (const chunk of terrainRoot.children) {
        const b = chunk.userData.chunkBounds;
        if (!b) continue;
        const overlapsCutaway =
          b.maxX > CUTAWAY_BOX.minX &&
          b.minX < CUTAWAY_BOX.maxX &&
          b.maxZ > CUTAWAY_BOX.minZ &&
          b.minZ < CUTAWAY_BOX.maxZ;
        chunk.visible = state.cutaway ? !overlapsCutaway : true;
      }
    }

    // Hide surface features over hidden terrain chunks when cutaway is active
    for (const child of surfaceGroup.children) {
      if (child.name === 'terrain_root') continue;
      const f = child.userData.feature;
      if (!f || f.id === 'night_light_band') continue;
      const [fx, fz] = f.pos;
      const insideHiddenChunk =
        fx >= -250 &&
        fx <= 250 &&
        fz >= 0 &&
        fz <= 250;
      child.visible = state.cutaway ? !insideHiddenChunk : true;
    }

    document.body.dataset.cutaway = String(Boolean(state.cutaway));
    ctx.updateEmissives(state);
  }

  function toggleCutaway(forceValue, cameraController) {
    state.cutaway = forceValue !== undefined ? Boolean(forceValue) : !state.cutaway;
    if (state.cutaway) {
      state.underground = false;
      if (cameraController) {
        cameraController.orbitTarget.set(...CUTAWAY_BOX.orbitTarget);
      }
    }
    applyCutawayState();
  }

  return { applyCutawayState, toggleCutaway };
}
