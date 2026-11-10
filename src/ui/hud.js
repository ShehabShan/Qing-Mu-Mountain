import { CANONICAL_CAMERAS, BUDGET } from '../core/constants.js';

export function createHud(ctx) {
  const { state, statsManager } = ctx;
  const root = document.getElementById('hud-root');
  let dockCollapsed = false;

  root.innerHTML = `
    <header class="hud-interactive" style="position:fixed;top:16px;left:16px;background:rgba(13,24,48,0.92);border:1px solid rgba(255,255,255,0.14);border-radius:10px;padding:10px 16px;max-width:440px;">
      <div style="display:flex;align-items:baseline;gap:10px;">
        <h1 style="font-family:'Cinzel',serif;font-size:17px;font-weight:700;color:#f4f4ee;letter-spacing:0.03em;white-space:nowrap;">Qing Mao Mountain</h1>
        <span style="font-size:12px;color:#9fd8a0;">·</span>
        <span style="font-size:12px;color:#9fd8a0;white-space:nowrap;">青茅山</span>
      </div>
      <div id="hud-subtitle" style="font-size:12px;color:#c9dbe3;margin-top:4px;line-height:1.4;">Cam 2 · Fore-Mountain Overview (Day) · Surface</div>
    </header>
    <aside id="hud-stats" class="hud-interactive tabular-nums" style="display:none;position:fixed;top:16px;right:16px;background:rgba(13,24,48,0.94);border:1px solid rgba(255,255,255,0.16);border-radius:10px;padding:12px 16px;font-size:12px;color:#e8eef0;min-width:230px;line-height:1.6;">
      <div style="font-weight:600;color:#9fd8a0;margin-bottom:4px;">RENDER TELEMETRY (F)</div>
      <div id="hud-stats-body"></div>
    </aside>
    <nav aria-label="Scene Controls" class="hud-interactive" style="position:fixed;bottom:16px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;max-width:min(940px,95vw);z-index:20;">
      <button id="btn-toggle-dock" type="button" aria-label="Toggle Controls Dock" style="background:rgba(13,24,48,0.92);color:#c9dbe3;border:1px solid rgba(255,255,255,0.15);border-bottom:none;border-radius:8px 8px 0 0;padding:4px 14px;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;">▾ Hide Controls (H)</button>
      <div id="hud-dock-panel" style="background:rgba(13,24,48,0.94);border:1px solid rgba(255,255,255,0.15);border-radius:12px;padding:10px 14px;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:6px;box-shadow:0 10px 30px rgba(0,0,0,0.45);">
        <button type="button" data-cam="1" aria-label="Camera 1 Night Band from Foot" class="dock-btn">1 · Night Foot</button>
        <button type="button" data-cam="2" aria-label="Camera 2 Fore-Mountain Overview" class="dock-btn">2 · Fore Slope</button>
        <button type="button" data-cam="3" aria-label="Camera 3 Back Mountain Waterfall" class="dock-btn">3 · Back Falls</button>
        <button type="button" data-cam="4" aria-label="Camera 4 Underground Cutaway" class="dock-btn">4 · Cutaway</button>
        <span style="color:rgba(255,255,255,0.2);padding:0 2px;">|</span>
        <button type="button" id="btn-night" aria-label="Toggle Day Night (N)" class="dock-btn">Day / Night (N)</button>
        <button type="button" id="btn-cutaway" aria-label="Toggle Underground Cutaway (C)" class="dock-btn">Cutaway (C)</button>
        <button type="button" id="btn-walk" aria-label="Enter Ground Walker (WASD)" class="dock-btn">Walk (WASD)</button>
        <button type="button" id="btn-p1" aria-label="Enter Portal P1 Stalactite Cave" class="dock-btn">Portal P1</button>
        <button type="button" id="btn-p2" aria-label="Enter Portal P2 Secret Cave" class="dock-btn">Portal P2</button>
        <button type="button" id="btn-stats" aria-label="Toggle Stats Overlay (F)" class="dock-btn">Stats (F)</button>
      </div>
    </nav>
  `;

  const styleEl = document.createElement('style');
  styleEl.textContent = `
    .dock-btn { background:rgba(255,255,255,0.07); color:#e8eef0; border:1px solid rgba(255,255,255,0.14); border-radius:7px; padding:6px 11px; font-size:12px; font-weight:500; font-family:'Plus Jakarta Sans',sans-serif; cursor:pointer; white-space:nowrap; transition:background 120ms ease,color 120ms ease,border-color 120ms ease; }
    .dock-btn:hover { background:rgba(159,216,160,0.18); border-color:#9fd8a0; }
    .dock-btn[data-active="true"] { background:#6fae5b; color:#0d1830; border-color:#9fd8a0; font-weight:600; }
  `;
  document.head.appendChild(styleEl);

  const subtitleEl = document.getElementById('hud-subtitle');
  const statsEl = document.getElementById('hud-stats');
  const statsBodyEl = document.getElementById('hud-stats-body');
  const dockPanelEl = document.getElementById('hud-dock-panel');
  const toggleDockBtn = document.getElementById('btn-toggle-dock');

  function toggleDock() {
    dockCollapsed = !dockCollapsed;
    dockPanelEl.style.display = dockCollapsed ? 'none' : 'flex';
    toggleDockBtn.textContent = dockCollapsed ? '▴ Show Controls (H)' : '▾ Hide Controls (H)';
  }
  toggleDockBtn.addEventListener('click', toggleDock);

  root.querySelectorAll('[data-cam]').forEach((btn) => {
    btn.addEventListener('click', () => ctx.cameraController.jumpToCamera(Number(btn.getAttribute('data-cam'))));
  });
  document.getElementById('btn-night').addEventListener('click', () => {
    state.night = !state.night;
    document.body.dataset.night = String(state.night);
    refresh();
  });
  document.getElementById('btn-cutaway').addEventListener('click', () => {
    ctx.cutawayManager.toggleCutaway(undefined, ctx.cameraController);
    refresh();
  });
  document.getElementById('btn-walk').addEventListener('click', () => {
    if (state.mode === 'walk') ctx.cameraController.jumpToCamera(2);
    else ctx.walker.enterWalkMode({ x: 0, y: 80, z: 132, yaw: 0 });
    refresh();
  });
  document.getElementById('btn-p1').addEventListener('click', () => ctx.walker.teleportToPortal('P1', !state.underground));
  document.getElementById('btn-p2').addEventListener('click', () => ctx.walker.teleportToPortal('P2', !state.underground));
  document.getElementById('btn-stats').addEventListener('click', () => {
    statsManager.statsState.visible = !statsManager.statsState.visible;
    refresh();
  });

  function refresh() {
    const camId = ctx.cameraController.activePreset;
    const camName = state.mode === 'walk'
      ? (state.underground ? 'Underground Walker' : 'Surface Walker (5 m/s)')
      : `Cam ${camId} · ${CANONICAL_CAMERAS[camId]?.name || 'Orbit'}`;
    const timeLabel = state.night ? 'Night' : 'Day';
    const layerLabel = state.cutaway ? 'Cutaway On' : state.underground ? 'Underground' : 'Surface';
    subtitleEl.textContent = `${camName} · ${timeLabel} · ${layerLabel}`;

    root.querySelectorAll('[data-cam]').forEach((btn) => {
      const id = Number(btn.getAttribute('data-cam'));
      btn.setAttribute('data-active', String(state.mode === 'orbit' && camId === id));
    });
    document.getElementById('btn-night').setAttribute('data-active', String(Boolean(state.night)));
    document.getElementById('btn-cutaway').setAttribute('data-active', String(Boolean(state.cutaway)));
    document.getElementById('btn-walk').setAttribute('data-active', String(state.mode === 'walk'));
    document.getElementById('btn-stats').setAttribute('data-active', String(Boolean(statsManager.statsState.visible)));
    statsEl.style.display = statsManager.statsState.visible ? 'block' : 'none';
  }

  let statsTimer = 0;
  function updateStatsDom(dt) {
    if (!statsManager.statsState.visible) return;
    statsTimer += dt;
    if (statsTimer < 0.2) return;
    statsTimer = 0;
    const s = statsManager.statsState, p = ctx.camera.position;
    statsBodyEl.innerHTML = `
      <div>FPS: <strong>${s.fps}</strong> (${s.frameMs.toFixed(1)} ms)</div>
      <div>Triangles: <strong>${s.triangles.toLocaleString()}</strong> / ${(BUDGET.tris / 1000).toFixed(0)}k</div>
      <div>Draw Calls: <strong>${s.calls}</strong> / ${BUDGET.calls}</div>
      <div>Instances: <strong>${s.instances.toLocaleString()}</strong></div>
      <div>Pos: (${p.x.toFixed(0)}, ${p.y.toFixed(0)}, ${p.z.toFixed(0)})</div>
      <div>Budget: <strong style="color:${s.budgetOk ? '#9fd8a0' : '#ff4d4d'}">${s.budgetOk ? 'OK' : 'EXCEEDED'}</strong></div>
    `;
  }
  refresh();
  return { refresh, updateStatsDom, toggleDock };
}
