import { CANONICAL_CAMERAS, CUTAWAY_BOX } from '../core/constants.js';

export function createCameraController(ctx) {
  const { THREE, camera, state } = ctx;
  const orbitTarget = new THREE.Vector3(-40, 60, 40);
  const desiredPos = new THREE.Vector3(380, 260, 620);
  const desiredTarget = new THREE.Vector3(-40, 60, 40);
  let activePreset = 2, transitioning = false;
  const spherical = new THREE.Spherical();
  const offset = new THREE.Vector3();

  function syncSphericalFromCamera() {
    offset.copy(camera.position).sub(orbitTarget);
    spherical.setFromVector3(offset);
  }

  function jumpToCamera(id, instant = false) {
    const preset = CANONICAL_CAMERAS[id];
    if (!preset) return;
    activePreset = id;
    state.mode = 'orbit';
    state.underground = false;
    document.body.dataset.camera = String(id);
    document.body.dataset.state = 'orbit';

    if (preset.forceNight !== undefined) {
      state.night = preset.forceNight;
      if (instant || ctx.renderer.userData.isSoftwareGl) state.nightBlend = state.night ? 1.0 : 0.0;
      document.body.dataset.night = String(state.night);
    }
    if (preset.forceCutaway !== undefined && ctx.cutawayManager) {
      ctx.cutawayManager.toggleCutaway(preset.forceCutaway);
    }
    desiredPos.set(...preset.pos);
    desiredTarget.set(...preset.target);

    if (instant || ctx.renderer.userData.isSoftwareGl) {
      camera.position.copy(desiredPos);
      orbitTarget.copy(desiredTarget);
      camera.lookAt(orbitTarget);
      syncSphericalFromCamera();
      transitioning = false;
    } else {
      transitioning = true;
    }
    if (ctx.hud) ctx.hud.refresh();
  }

  function rotateOrbit(deltaAzimuth, deltaPolar) {
    if (state.mode !== 'orbit') return;
    transitioning = false;
    syncSphericalFromCamera();
    spherical.theta -= deltaAzimuth;
    spherical.phi = Math.max(0.08, Math.min(Math.PI * 0.48, spherical.phi - deltaPolar));
    offset.setFromSpherical(spherical);
    camera.position.copy(orbitTarget).add(offset);
    camera.lookAt(orbitTarget);
  }

  function zoomOrbit(deltaDistance) {
    if (state.mode !== 'orbit') return;
    transitioning = false;
    syncSphericalFromCamera();
    spherical.radius = Math.max(20, Math.min(1350, spherical.radius * (1 + deltaDistance * 0.001)));
    offset.setFromSpherical(spherical);
    camera.position.copy(orbitTarget).add(offset);
    camera.lookAt(orbitTarget);
  }

  function update(dt) {
    if (state.mode !== 'orbit' || !transitioning) return;
    const k = 1 - Math.exp(-7.5 * dt);
    camera.position.lerp(desiredPos, k);
    orbitTarget.lerp(desiredTarget, k);
    camera.lookAt(orbitTarget);
    if (camera.position.distanceToSquared(desiredPos) < 0.25) {
      camera.position.copy(desiredPos);
      orbitTarget.copy(desiredTarget);
      camera.lookAt(orbitTarget);
      syncSphericalFromCamera();
      transitioning = false;
    }
  }

  return {
    orbitTarget,
    get activePreset() { return activePreset; },
    jumpToCamera, rotateOrbit, zoomOrbit, update,
  };
}
