import { registerBuilder } from '../core/builders.js';
import { heightAt } from '../core/height.js';

function createSoftMistTexture(THREE) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const c = canvas.getContext('2d');
  const grad = c.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(232, 238, 240, 0.85)');
  grad.addColorStop(0.5, 'rgba(232, 238, 240, 0.35)');
  grad.addColorStop(1, 'rgba(232, 238, 240, 0.0)');
  c.fillStyle = grad;
  c.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

registerBuilder('mist', (feature, ctx) => {
  const { THREE, rng: makeRng, registry } = ctx;
  const group = new THREE.Group();
  group.name = feature.id;

  const seed = 1 + registry.findIndex((f) => f.id === feature.id);
  const rand = makeRng(seed > 0 ? seed : 42);

  const tex = createSoftMistTexture(THREE);
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
  });

  // 24 large soft sprites at y 30-70 on the fore slope, drifting 0.3 m/s east
  const sprites = [];
  for (let i = 0; i < 24; i++) {
    const sp = new THREE.Sprite(mat);
    const x = -420 + (i / 24) * 840 + (rand() - 0.5) * 30;
    const z = 140 + rand() * 240;
    const groundY = heightAt(x, z);
    const y = Math.max(groundY + 12, 30 + rand() * 40);
    const w = 65 + rand() * 55;
    sp.position.set(x, y, z);
    sp.scale.set(w, w * 0.38, 1);
    sp.userData = { baseW: w };
    group.add(sp);
    sprites.push(sp);
  }

  return {
    object: group,
    layer: 'surface',
    stats: { instances: 24 },
    update(dt, state) {
      group.visible = !state.cutaway && !state.underground;
      if (!group.visible) return;
      for (const sp of sprites) {
        sp.position.x += 0.3 * dt;
        if (sp.position.x > 460) sp.position.x = -460;
      }
    },
  };
});
