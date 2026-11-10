import { BUDGET, CANONICAL_CAMERAS } from './constants.js';

export function createStatsManager(renderer) {
  let fps = 60, frameCount = 0, accumTime = 0, avgFrameMs = 8.0, visible = false;
  const statsState = {
    fps: 60, frameMs: 8.0, triangles: 0, calls: 0, instances: 0, budgetOk: true,
    get visible() { return visible; },
    set visible(v) { visible = Boolean(v); },
  };

  function update(dt) {
    frameCount++;
    accumTime += dt;
    if (accumTime >= 0.25) {
      fps = Math.round(frameCount / accumTime);
      avgFrameMs = (accumTime / frameCount) * 1000;
      frameCount = 0;
      accumTime = 0;
    }
    const info = renderer.info.render;
    statsState.fps = fps;
    statsState.frameMs = avgFrameMs;
    statsState.triangles = info.triangles;
    statsState.calls = info.calls;
    statsState.budgetOk = info.triangles <= BUDGET.tris && info.calls <= BUDGET.calls;
  }

  function runAutomatedCheck(jumpToCamera) {
    const camIds = [1, 2, 3, 4];
    let step = 0, failed = false;
    const advance = () => {
      if (step >= camIds.length) {
        if (!failed) console.log('BUDGET OK');
        return;
      }
      const id = camIds[step];
      jumpToCamera(id, true);
      setTimeout(() => {
        const info = renderer.info.render;
        if (info.triangles > BUDGET.tris) {
          console.error(`BUDGET BREACH at Cam ${id} (${CANONICAL_CAMERAS[id].name}): triangles=${info.triangles}`);
          failed = true;
        }
        if (info.calls > BUDGET.calls) {
          console.error(`BUDGET BREACH at Cam ${id} (${CANONICAL_CAMERAS[id].name}): calls=${info.calls}`);
          failed = true;
        }
        if (statsState.frameMs > 16.7 && !renderer.userData.isSoftwareGl) {
          console.error(`BUDGET BREACH at Cam ${id}: avgFrameMs=${statsState.frameMs.toFixed(1)}`);
          failed = true;
        }
        step++;
        advance();
      }, 2000);
    };
    advance();
  }
  return { statsState, update, runAutomatedCheck };
}
