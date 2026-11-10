import { WALKER_SPEED, EYE, PORTALS } from '../core/constants.js';
import { heightAt } from '../core/height.js';

export function createWalker(ctx) {
  const { THREE, camera, state } = ctx;
  const pos = new THREE.Vector3(0, heightAt(0, 132) + EYE, 132);
  let yaw = 0, pitch = 0.05, portalCooldown = 0;
  const keys = { forward: false, backward: false, left: false, right: false };
  const forwardVec = new THREE.Vector3(), rightVec = new THREE.Vector3(), lookTarget = new THREE.Vector3();

  function syncCameraToWalker() {
    camera.position.copy(pos);
    const cosP = Math.cos(pitch);
    lookTarget.set(pos.x - Math.sin(yaw) * cosP * 10, pos.y + Math.sin(pitch) * 10, pos.z - Math.cos(yaw) * cosP * 10);
    camera.lookAt(lookTarget);
  }

  function enterWalkMode(spawnPoint) {
    state.mode = 'walk';
    document.body.dataset.state = 'walk';
    if (spawnPoint) {
      pos.set(spawnPoint.x, spawnPoint.y + EYE, spawnPoint.z);
      if (spawnPoint.yaw !== undefined) yaw = spawnPoint.yaw;
      pitch = 0;
    } else {
      const gx = THREE.MathUtils.clamp(camera.position.x, -450, 450);
      const gz = THREE.MathUtils.clamp(camera.position.z, -450, 450);
      pos.set(gx, heightAt(gx, gz) + EYE, gz);
    }
    syncCameraToWalker();
    if (ctx.hud) ctx.hud.refresh();
  }

  function teleportToPortal(portalId, toUnderground = true) {
    const p = PORTALS.find((pt) => pt.id === portalId);
    if (!p) return;
    const dest = toUnderground ? p.underground : p.surface;
    state.underground = toUnderground;
    state.cutaway = false;
    state.mode = 'walk';
    document.body.dataset.state = 'walk';
    portalCooldown = 3.0;
    pos.set(dest.x, dest.y + EYE, dest.z);
    yaw = toUnderground ? Math.PI * 0.5 : 0;
    pitch = 0;
    if (ctx.cutawayManager) ctx.cutawayManager.applyCutawayState();
    syncCameraToWalker();
    if (ctx.hud) ctx.hud.refresh();
  }

  function rotateLook(deltaYaw, deltaPitch) {
    if (state.mode !== 'walk') return;
    yaw -= deltaYaw;
    pitch = Math.max(-1.35, Math.min(1.35, pitch - deltaPitch));
    syncCameraToWalker();
  }

  function undergroundFloorAt(x, z, currentFootY) {
    if (x >= 220 && x <= 235 && Math.abs(z - 62) < 8) return 80;
    if (x >= 136 && x < 220 && Math.abs(z - 61) < 10) return 58 + ((x - 140) / 84) * 22;
    if (x >= 80 && x < 136 && z >= 35 && z <= 85) return 58;
    if (x >= -25 && x <= 70 && z >= 85 && z <= 145) return 50;
    return currentFootY;
  }

  function update(dt) {
    if (portalCooldown > 0) portalCooldown = Math.max(0, portalCooldown - dt);
    const anyKey = keys.forward || keys.backward || keys.left || keys.right;
    if (anyKey && state.mode !== 'walk') {
      const camH = camera.position.y - heightAt(camera.position.x, camera.position.z);
      if (camH > 35 || Math.abs(camera.position.x) > 480 || Math.abs(camera.position.z) > 480) {
        enterWalkMode({ x: 0, y: heightAt(0, 132), z: 132, yaw: 0 });
      } else {
        enterWalkMode({ x: camera.position.x, y: heightAt(camera.position.x, camera.position.z), z: camera.position.z, yaw });
      }
    }
    if (state.mode !== 'walk') return;

    if (anyKey) {
      forwardVec.set(-Math.sin(yaw), 0, -Math.cos(yaw)).normalize();
      rightVec.set(Math.cos(yaw), 0, -Math.sin(yaw)).normalize();
      let moveX = (keys.forward ? forwardVec.x : 0) - (keys.backward ? forwardVec.x : 0) + (keys.right ? rightVec.x : 0) - (keys.left ? rightVec.x : 0);
      let moveZ = (keys.forward ? forwardVec.z : 0) - (keys.backward ? forwardVec.z : 0) + (keys.right ? rightVec.z : 0) - (keys.left ? rightVec.z : 0);
      const len = Math.hypot(moveX, moveZ);
      if (len > 0) {
        pos.x = THREE.MathUtils.clamp(pos.x + (moveX / len) * WALKER_SPEED * dt, -490, 490);
        pos.z = THREE.MathUtils.clamp(pos.z + (moveZ / len) * WALKER_SPEED * dt, -490, 490);
      }
    }
    const targetGroundY = state.underground ? undergroundFloorAt(pos.x, pos.z, pos.y - EYE) : heightAt(pos.x, pos.z);
    pos.y = targetGroundY + EYE;

    if (portalCooldown <= 0) {
      for (const p of PORTALS) {
        const pt = state.underground ? p.underground : p.surface;
        if (Math.hypot(pos.x - pt.x, pos.z - pt.z) < 2.5) {
          teleportToPortal(p.id, !state.underground);
          break;
        }
      }
    }
    syncCameraToWalker();
  }
  return { pos, keys, enterWalkMode, teleportToPortal, rotateLook, update };
}
