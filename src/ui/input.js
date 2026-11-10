export function setupInput(ctx) {
  const { state, cameraController, walker, cutawayManager, statsManager, hud, renderer } = ctx;
  const dom = renderer.domElement;

  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const code = e.code, key = e.key.toLowerCase();
    if (key === '1' || key === '2' || key === '3' || key === '4') return cameraController.jumpToCamera(Number(key));
    if (key === 'n') {
      state.night = !state.night;
      document.body.dataset.night = String(state.night);
      return hud.refresh();
    }
    if (key === 'c') {
      cutawayManager.toggleCutaway(undefined, cameraController);
      return hud.refresh();
    }
    if (key === 'f') {
      statsManager.statsState.visible = !statsManager.statsState.visible;
      return hud.refresh();
    }
    if (key === 'h') return hud.toggleDock();
    if (code === 'KeyW' || code === 'ArrowUp') walker.keys.forward = true;
    if (code === 'KeyS' || code === 'ArrowDown') walker.keys.backward = true;
    if (code === 'KeyA' || code === 'ArrowLeft') walker.keys.left = true;
    if (code === 'KeyD' || code === 'ArrowRight') walker.keys.right = true;
  });

  window.addEventListener('keyup', (e) => {
    const code = e.code;
    if (code === 'KeyW' || code === 'ArrowUp') walker.keys.forward = false;
    if (code === 'KeyS' || code === 'ArrowDown') walker.keys.backward = false;
    if (code === 'KeyA' || code === 'ArrowLeft') walker.keys.left = false;
    if (code === 'KeyD' || code === 'ArrowRight') walker.keys.right = false;
  });

  let dragging = false, prevX = 0, prevY = 0;
  dom.addEventListener('pointerdown', (e) => { dragging = true; prevX = e.clientX; prevY = e.clientY; });
  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - prevX, dy = e.clientY - prevY;
    prevX = e.clientX; prevY = e.clientY;
    if (state.mode === 'walk') walker.rotateLook(dx * 0.0045, dy * 0.0045);
    else cameraController.rotateOrbit(dx * 0.005, dy * 0.005);
  });
  window.addEventListener('pointerup', () => { dragging = false; });
  dom.addEventListener('wheel', (e) => { if (state.mode === 'orbit') cameraController.zoomOrbit(e.deltaY); }, { passive: true });
}
