# Qing Mao Mountain (青茅山) — 3D Environment

Interactive procedural 3D environment of **Qing Mao Mountain** (Reverend Insanity, Volume 1 opening state: Gu Yue, Xiong, and Bai clans intact, plus the complete subterranean cavern network beneath Gu Yue Village).

## Run & Verify

```bash
npm install
npm run validate   # Verifies terrain/registry JSON, overlaps, vertical order, road length & source budget
npm start          # Starts Vite dev server on http://localhost:3000
npm run build      # Production build into dist/
```

### Query Parameters
- `?tier=must|detail|polish` — Filter rendered features by build tier (default: `polish`, all 42 features).
- `?cam=1|2|3|4` — Start directly at canonical camera 1–4.
- `?check=1` — Run automated 2-second runtime budget sweep across cameras 1–4 and log `BUDGET OK`.
- `?stage=wolftide` — Stretch toggle: adds bamboo spike trenches along the Gu Yue stockade wall.
- `?stage=ice` — Stretch toggle: applies the Ten Extreme Physique white glacier freeze across the mountain.

## Controls

| Key / Input | Action |
|---|---|
| `1` | **Camera 1 — Night Band from Foot (Ch. 1)**: `(60, 4.5, 452) → (0, 85, 110)`, forces night |
| `2` | **Camera 2 — Fore-Mountain Overview (Day)**: `(380, 260, 620) → (-40, 60, 40)` |
| `3` | **Camera 3 — Back Mountain & Waterfall (Day)**: `(120, 140, -620) → (20, 60, -380)` |
| `4` | **Camera 4 — Underground Cutaway**: `(190, 120, 260) → (40, 30, 110)`, enables cutaway |
| `N` | Toggle **Day / Night** (smooth 2-second blend; activates 2,400 lantern band & stars) |
| `C` | Toggle **Underground Cutaway** (hides surface terrain chunks `x ∈ [-30,140], z ∈ [20,200]` & shows underground caverns) |
| `W / A / S / D` | **Ground Walker** (`5 m/s`, eye height `1.7 m` following `heightAt(x, z)` or subterranean floor) |
| `Mouse Drag / Wheel` | Orbit camera in Overview mode, or look around in Ground Walker mode |
| `F` | Toggle **Render Telemetry Overlay** (FPS, frame ms, triangles, draw calls, instance count, coordinates) |
| `H` | Collapse / expand the bottom control dock |

## Portals
- **Portal P1 (`(0, 92)` ↔ `(-5, 105, y=51)`)**: Clan Pavilion stair descending into the Spring Cave (Stalactite Hall).
- **Portal P2 (`(254, 62)` ↔ `(228, 62, y=81)`)**: Rock Crack Entrance behind the branch waterfall leading into the Flower Wine Monk Secret Cave.

## Assumptions
1. **Sloping Inheritance Tunnel Check**: In `scripts/validate.mjs` Check 5, `inheritance_tunnel` is a sloping 3D polyline tube (`y = 80` at east knob `x = 224` where ground is `y = 102`, descending to `y = 58` at west end `x = 140` where ground is `y = 83.4`). Just as Check 4 exempts `cave_tunnel` from axis-aligned 3D box overlap, Check 5 evaluates axis-aligned box tops on room/cavern volumes (`cave_*` excluding `cave_tunnel`), while every point along the tunnel polyline sits > 15 m below the terrain surface above it.
2. **Lantern Band Distribution**: The 2,400 emissive lantern points (`night_light_band`) are combined into a single `InstancedMesh` (1 draw call) with 1,400 on village house windows/eaves, 500 in pairs every ~1.6 m along `main_road` from the river landing to the village, 300 across the mortal hamlets, and 200 on the Clan Pavilion and gate towers, accompanied by 6 moving/clustered `PointLight`s.
3. **Software WebGL Compatibility**: When running in a headless browser (`SwiftShader` / `llvmpipe`), the render loop uses `WebGL2RenderingContext.fenceSync` (`afterDraw`) and disables multi-pass shadow maps so automated screenshots and inspections complete deterministically without CPU starvation.

## Remaining Work
All 42 registry features across **must** (15), **detail** (22), and **polish** (5) tiers—plus both stretch toggles (`?stage=wolftide` and `?stage=ice`)—are implemented and passing `npm run validate`. No features were cut.
