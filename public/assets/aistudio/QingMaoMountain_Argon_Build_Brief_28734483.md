# Qing Mao Mountain — Build Brief for Gemini 4 Argon

BUILD_TARGET = three.js (three@0.170.0, Vite 5.4.10). Units: metres. Axes: +x east, +y up, −z north (south = +z = the fore mountain).

## 0. READ FIRST

1. Mission: build a compact, explorable 3D environment of Qing Mao Mountain (Reverend Insanity, Volume 1 opening state: all three clans intact). No characters, creatures, combat or game mechanics.
2. Target: static three.js project, `npm install && npm start`, all geometry and textures procedural. No downloads, no web access.
3. Data drives everything: `terrain.json` (§3) and `registry.json` (§5) are copied verbatim. Builders turn registry entries into geometry.
4. Write `scripts/validate.mjs` (§9) first and keep it passing.
5. Tiers: must-ship → detail → polish (§10). Start a tier only when the previous one passes its gate.
6. If you can run sub-agents, follow §8; otherwise do the same steps in the order given in §8, one after another.
7. Never ask questions. Decide, log the assumption in `README.md` under "Assumptions", continue.
8. Size each work package to one response (≤ 800 lines of code). Keep modules ≤ 300 lines and the project ≤ 4,000 lines.
9. When limits near: finish the current tier cleanly, stop, list what remains in README (cut list §11).
10. Faithfulness beats completeness: cut a feature rather than change its name, position or relationships.

## 1. Design intent and definition of done

**Intent.** Make it read like a transit map of the mountain. One peak, north of centre. The fore (south) slope falls to the Yellow Dragon River. Gu Yue Village is a walled sea of green bamboo stilt houses at the mountain waist, with a five-storey pavilion at its heart. Xiong Village sits low on the fore slope near the foot. Bai Village sits on the back (north) side, beside the deep pool under a big waterfall. Alliance Slope is a giant square on the west flank, against a rock wall. At night, a band of warm lights runs from the village down to the foot. Underground, everything sits beneath the village: the rainbow stalactite cave, the moon orchid sea, the spirit spring, the Rock Forest, and below it all the Blood Pond.

**Done when:**
- `npm start` serves the scene with no console errors; `npm run validate` exits 0.
- All 15 must-tier features render at their registry positions. Each detail-tier feature either renders or is listed as cut in README.
- Key `N` toggles day/night, `C` toggles the underground cutaway, `1`–`4` jump to the canonical cameras, `W/A/S/D` + mouse is the ground walker (5 m/s, eye height 1.7 m), and `F` toggles a stats overlay (fps, triangles, draw calls).
- Budgets in §2 hold at every canonical camera.
- README holds: run instructions, controls, Assumptions, Remaining work, and screenshots of cameras 1–4 if you can take them.

## 2. Target, conventions, budgets, rules

- **Stack:** `three@0.170.0` (import addons from `three/addons/...`), `vite@5.4.10` dev dependency. Scripts: `start` = `vite`, `build` = `vite build`, `validate` = `node scripts/validate.mjs`. Plain ES modules (JavaScript). No TypeScript, no other runtime dependencies.
- **Coordinates:** 1 unit = 1 m. y-up, right-handed. Footprint x ∈ [−500, 500], z ∈ [−500, 500]. Registry `pos` = [x, z] of the footprint centre. `size` = [w along x, d along z, h along y]. `elevation` = `"ground"` (base y = terrain height at pos) or a number (absolute base y, used for underground volumes).
- **Relief:** terrain y spans about −6 (river bed) to 207 (summit). Walker route foot → north gate along `main_road` is 813 m, so 163 s at 5 m/s.
- **Performance:** 60 fps on a mid-range laptop (integrated GPU, 1080p). ≤ 400k triangles in view, ≤ 300 draw calls. Use `InstancedMesh` for houses, huts, bamboo, orchids, lanterns, rocks and pillars. Merge static per-feature geometry with `BufferGeometryUtils.mergeGeometries`. ≤ 8 real `PointLight`s at once; everything else is emissive.
- **Look:** flat-shaded low-poly (`MeshLambertMaterial` or `MeshStandardMaterial` with `flatShading: true`) and vertex colours from §6.1. Canvas textures only where noted (≤ 256×256). No image or model files.
- **Determinism:** all scatter uses `mulberry32(seed)`, with seed = 1 + index of the feature in the registry.
- **Code:** ≤ 300 lines per module, ≤ 4,000 lines in total. Builders never hardcode coordinates that exist in the data files.

## 3. Terrain, water and paths (data)

Save the block below verbatim as `src/data/terrain.json`.

**Height function `heightAt(x, z)`.** Evaluate in this order:
1. **Base:** bicubic Catmull-Rom interpolation of `grid.rows_by_z`. Row j is z = −500 + 100·j; column i is x = −500 + 100·i. Clamp indices at the edges.
2. **Modifiers, in array order.** Let d be the 2D distance from the point to the rectangle `rect` = [cx, cz, w, d], with d = 0 inside it. Let wgt = 1 − smoothstep(0, blend, d), and t = v + (y − v)·wgt.
   - `flatten`: v = t.
   - `raise`: v = max(v, t).
   - `bowl`: inside radius r of c, v = min(v, y − depth·(1 − (d/r)²)).
3. **Carving, `yellow_dragon_river` and `waterfall_tributary` only.** Find the nearest segment of the polyline; its interpolated `pts[*][2]` gives the bed. With hw = halfWidth and wb = 1 − smoothstep(hw, hw + bank, dist), set target = bed + max(0, dist − hw)·bankSlope and v = lerp(v, min(v, target), wb).
4. **Water surface** = bed + `water`. Draw the deep pool surface flat at y = 59.
5. **Streams** (`upper_stream`, `rockcrack_stream`, `rockcrack_runoff`) are not carved. Draw each as a 3 m ribbon at heightAt + 0.15.

```js
// src/core/height.js — pure, no three import, so Node can use it in validate.mjs
export function heightAt(x, z) {
  let v = gridCatmull(x, z);
  for (const m of T.modifiers) v = applyModifier(m, x, z, v);
  for (const id of ['yellow_dragon_river', 'waterfall_tributary']) {
    const r = T.rivers[id], { dist, bed } = nearestOnPolyline(r.pts, x, z);
    if (dist < r.halfWidth + r.bank) {
      const tgt = bed + Math.max(0, dist - r.halfWidth) * r.bankSlope;
      const w = 1 - smoothstep(r.halfWidth, r.halfWidth + r.bank, dist);
      v = v + (Math.min(v, tgt) - v) * w;
    }
  }
  return v;
}
```

**Terrain mesh:** 201×201 vertices (5 m spacing), giving 80k triangles, in 4×4 chunks so the cutaway can hide chunks. Vertex colour by slope s = |∇h|:
- s < 0.45: `grass_lush`, blended toward `grass_dark` as y rises.
- 0.45–0.9: `grass_dark`.
- > 0.9: `rock`.
- Within 2 m above river water: `sand`.

**Paths:** ribbons following `paths.*.pts` at the given widths, 0.1 m above the ground, coloured `path_earth`. Where the local grade is > 0.6 (terrace edges, the north gate climb, the rock-crack bench), add stone steps at 0.25 m rise per step, coloured `stone_paving`.

```json
{
"axes":"x east, y up, z south (north = -z); metres",
"grid":{"origin":[-500,-500],"spacing":100,"count":[11,11],"rows_by_z":[[0,4,9,15,19,21,19,15,9,4,0],[4,11,22,33,45,50,45,33,24,13,4],[9,20,38,62,95,113,95,64,47,28,10],[12,28,55,94,156,194,156,94,59,33,13],[13,30,61,101,164,203,164,97,54,29,13],[12,27,55,84,126,151,125,79,46,25,12],[9,21,41,59,80,92,80,56,36,20,9],[5,14,26,38,48,53,48,37,24,13,5],[2,7,15,22,28,30,28,21,14,7,2],[-1,2,6,11,14,15,14,10,6,2,-1],[-2,-1,1,3,5,6,5,3,1,-1,-2]]},
"modifiers":[{"id":"waterfall_lip","op":"raise","rect":[60,-335,70,30],"y":118,"blend":30},{"id":"east_knob","op":"raise","rect":[222,62,44,60],"y":102,"blend":30},{"id":"alliance_wall","op":"raise","rect":[-252,-60,24,180],"y":92,"blend":30},{"id":"pavilion_terrace","op":"flatten","rect":[0,112,70,80],"y":80,"blend":14},{"id":"alliance_square","op":"flatten","rect":[-322,-60,90,160],"y":46,"blend":12},{"id":"bai_bench","op":"flatten","rect":[-20,-400,230,90],"y":60,"blend":10},{"id":"xiong_bench","op":"flatten","rect":[-290,300,140,110],"y":21,"blend":20},{"id":"rockcrack_bench","op":"flatten","rect":[268,62,32,60],"y":80,"blend":4},{"id":"deep_pool","op":"bowl","c":[60,-395],"r":28,"y":60,"depth":9}],
"rivers":{"yellow_dragon_river":{"halfWidth":20,"bank":30,"bankSlope":0.35,"water":2.0,"depth":4,"pts":[[-500,465,-5.8],[-250,478,-6.3],[0,470,-6.3],[250,482,-6.3],[500,472,-6.3]]},"waterfall_tributary":{"halfWidth":6,"bank":20,"bankSlope":0.45,"water":1.2,"depth":2,"pts":[[88,-400,58.0],[110,-420,32.6],[150,-445,24.4],[260,-458,14.1],[380,-392,13.7],[445,-240,13.7],[452,-60,13.7],[432,100,13.2],[402,260,6.6],[420,400,-1.2],[440,460,-3.4]]},"upper_stream":{"halfWidth":1.5,"bank":6,"bankSlope":0.6,"water":0.3,"depth":1,"pts":[[20,-210,185.5],[40,-270,127.1],[55,-310,108.2],[60,-349,96.1]]},"rockcrack_stream":{"halfWidth":1.5,"bank":6,"bankSlope":0.6,"water":0.3,"depth":1,"pts":[[150,-40,114.8],[190,10,79.5],[222,50,79.5],[246,62,79.5]]},"rockcrack_runoff":{"halfWidth":1.5,"bank":6,"bankSlope":0.6,"water":0.3,"depth":1,"pts":[[254,64,79.0],[280,76,44.2],[300,84,36.2],[340,96,27.9],[380,102,21.2],[436,104,13.5]]}},
"paths":{"main_road":{"width":5,"pts":[[60,440],[110,410],[-30,370],[80,330],[-20,290],[30,262],[0,235],[0,155],[-30,140],[-30,75],[0,40],[0,20]]},"east_lane":{"width":3,"pts":[[115,130],[150,125],[190,118],[230,108],[262,96],[300,100],[350,108],[412,110]]},"west_clan_road":{"width":4,"pts":[[-115,130],[-160,200],[-225,290],[-300,240],[-330,150],[-330,20],[-330,-140],[-300,-240],[-220,-330],[-125,-395]]},"foot_road":{"width":3,"pts":[[-30,420],[-150,425],[-250,380],[-380,425]]}}
}
```

## 4. ASCII sketches

**Top-down** (each cell 20 m × 40 m; digits = terrain height ÷ 25 m; north at top):
- `~` main river and tributary; `-` streams.
- `#` Gu Yue wall; `P` pavilion; `S` square; `a` academy; `v` tavern.
- `:` main road; `.` other roads.
- `X` Xiong Village; `B` Bai Village; `o` deep pool; `W` waterfall.
- `A` Alliance Slope; `R` rock building.
- `K` rock crack; `b` beach; `m` mortal hamlets; `w` wolf dens; `t` tree house; `^` summit.

```
        x=-500                              x=0                              x=+500
z= -480 |00000000000mmmm00000000000000000000000000000000000|
z= -440 |00000000000mmmm011BBBBBBBB2222~~~~~~~~~~~~00000000|
z= -400 |00000000000111111.BBBBBBBB22o~~1111111100~~~~00000|
z= -360 |00000000011111....BBBBBBBB2--232211111111110~~0000|
z= -320 |000000011111...222333333344-443322222111wwwww~0000|
z= -280 |00000011111..2223334444555--444333222222wwwww~~000|
z= -240 |000001111..222333445556666-6555443332222211111~~00|
z= -200 |000011111.2223334556667777-76665443332222211110~00|
z= -160 |00001111..2333344556677888877665544333222111110~00|
z= -120 |000011AAAAAA3334455667788^877665544332222111110~00|
z=  -80 |000011AAAAAA33344556667777776665544332221111110~00|
z=  -40 |000011AAAAAR33334455566666666555--3322221111100~00|
z=   +0 |000001AAAAAA333334445555665555444--322211111100~00|
z=  +40 |000001AAAAAA3323t33############333----31111100~~00|
z=  +80 |00000011.1112222233#333::P3333#322344K..----00~000|
z= +120 |00000001.111112222.#233:3S33a2#.......11.....b-000|
z= +160 |00000000.11111112..#222:::2222#22111111110000~~000|
z= +200 |000000000.111111..1#122v2:2221#11111111100000~0000|
z= +240 |0000000XXXXXXXX..11############11111100000000~0000|
z= +280 |0000000XXXXXXXX111111111:::111111100000000000~0000|
z= +320 |0000000XXXXXXXX0000011111:::::000000000000000~0000|
z= +360 |0000000XXXXXXXX00000000:::::00000000000000000~0000|
z= +400 |000mmmmm00000000000000mmmmmmmmmm0000000000000~~000|
z= +440 |000mmmmm00000000000000mmmmmmmmmm00000000000000~000|
z= +480 |~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~|
```

**Side section** along x = 10, from north (left) to south (right). `*` = ground line; `:` = solid rock. Underground volumes are projected onto this plane (the Rock Forest actually sits at x = 85–135):
- `B` Bai Village; `W` waterfall lip; `^` summit; `G` north and south gates; `P` pavilion; `X` Xiong Village; `~` river.
- Underground: `C` stalactite cave; `O` orchid sea; `S` spirit spring; `F` Rock Forest; `D` Blood Pond.

```
  y    z=-500 (north, back)             z=0            z=+500 (south, fore)
+220 |                                                   |
+210 |                 *^*                               |
+200 |                *   **                             |
+190 |               *::::::*                            |
+180 |              *                                    |
+170 |             *:::::::::*                           |
+160 |                        *                          |
+150 |            *::::::::::::*                         |
+140 |                          G                        |
+130 |           *:::::::::::::::*                       |
+120 |                                                   |
+110 |         **:::::::::::::::::* P                    |
+100 |        *                                          |
 +90 |        :::::::::::::::::::::                      |
 +80 |        W                    ****                  |
 +70 |        :::::::::::::::::::FFF:::*                 |
 +60 |   **B**                   FFFCC  *                |
 +50 |   :::::::::::::::::::::::::::OSO::**G             |
 +40 |                                     **            |
 +30 |  *:::::::::::::::::::::::::::DDDDDD:::***         |
 +20 |**                            DDDDDD    X ***      |
 +10 |::::::::::::::::::::::::::::::DDDDDD:::::::::**    |
  +0 |                              DDDDDD           *~ *|
 -10 |::::::::::::::::::::::::::::::DDDDDD::::::::::::**:|
 -20 |                                                   |
```

Vertical order (validator-checked):
- Surface: Xiong Village (y 21) < south gate (43) < Bai Village (60) < pavilion terrace (80) < north gate (139) < summit (207).
- Underground: Blood Pond (−12…28) < spring and orchid sea (50) < stalactite cave (50…62) < Rock Forest (58…74) < secret cave floor (80).

## 5. Feature registry

Save verbatim as `src/data/registry.json`.

Builders read: `pos`, `elevation`, `size`, `look` (palette keys from §6.1) and `notes` (shape and count rules).

Footprint rule: features whose builder is `terrain`, `water_river`, `water_stream`, `path`, `house_cluster`, `bamboo_forest`, `lantern_band`, `meadow`, `mist` or `wall_ring` are zones or lines. They are exempt from the overlap check. All other surface footprints must not overlap.

Layer rule: builders starting with `cave_` are underground and render only in cutaway or after entering a portal.

```json
[
{"id":"terrain","name":"Qing Mao Mountain","aliases":["Mount Qing Mao","Green Thatch Mountain","青茅山"],"tier":"must","tag":"CANON","ref":"Wiki: Qing Mao Mountain; Ch. 60; Ch. 183","pos":[0,0],"elevation":"ground","size":[1000,1000,213],"look":"Grass grass_lush/grass_dark by slope; slopes >0.9 rock; soil band soil_blue_black on cut banks","builder":"terrain","notes":"Heightfield from TERRAIN JSON. Single peak north of centre; fore (south) slope descends to the river."},
{"id":"yellow_dragon_river","name":"Yellow Dragon River","aliases":["Huang Long River"],"tier":"must","tag":"CANON","ref":"Ch. 117; Ch. 200; Wiki: Yellow Dragon River","pos":[0,472],"elevation":"ground","size":[1000,40,4],"look":"water_yellow, opacity 0.9, foam strips white at banks","builder":"water_river","notes":"Main course along the south edge, flowing east. Polyline rivers.yellow_dragon_river."},
{"id":"gy_wall","name":"Gu Yue Village Wall and Gates","aliases":["stockade wall","寨墙"],"tier":"must","tag":"CANON","ref":"Ch. 149; Ch. 157","pos":[0,127.5],"elevation":"ground","size":[230,215,6],"look":"Timber palisade timber_dark 6 m, walkway inside with ladders; towers 10 m bamboo_green roofs","builder":"wall_ring","notes":"Rect x -115..115, z 20..235. Gates N(0,20) S(0,235) E(115,130) W(-115,130); S is the main gate. 8 towers: 4 corners + 2 flanking each of S and N gates."},
{"id":"gy_houses","name":"Gu Yue Bamboo Houses","aliases":["bamboo buildings","竹楼","stilt houses"],"tier":"must","tag":"CANON","ref":"Ch. 3; Ch. 17; Ch. 39; Ch. 60","pos":[0,127.5],"elevation":"ground","size":[226,211,9],"look":"bamboo_green walls, bamboo_jade highlights, roof_bamboo; stilts timber","builder":"house_cluster","notes":"240 instanced houses inside the wall, rejecting other footprints and roads (2 m clearance). Narrow 3 m lanes."},
{"id":"clan_pavilion","name":"Gu Yue Clan Pavilion","aliases":["clan head pavilion","garret","ancestral hall"],"tier":"must","tag":"CANON","ref":"Ch. 1; Ch. 4","pos":[0,95],"elevation":"ground","size":[26,20,28],"look":"5 storeys timber_dark, roof_tile with sharply upswept eaves, lacquer_red trim, lanterns each eave","builder":"clan_pavilion","notes":"Faces south onto the square. Holds tablets, conference hall and the stair down to the spring cave (portal P1 at (0,92))."},
{"id":"pavilion_square","name":"Pavilion Square","aliases":["square before the pavilion"],"tier":"must","tag":"CANON","ref":"Ch. 4","pos":[0,132],"elevation":"ground","size":[50,30,0.3],"look":"stone_paving grey slabs 2x2 m","builder":"plaza","notes":"On the flattened terrace south of the pavilion. Morning gathering place of the Awakening Ceremony."},
{"id":"main_road","name":"Main Mountain Road","aliases":["mountain path"],"tier":"must","tag":"INFERRED","ref":"Ch. 1","pos":[40,230],"elevation":"ground","size":[140,420,0],"look":"packed earth path_earth 5 m; stone steps where grade >0.35","builder":"path","notes":"Polyline paths.main_road: river landing -> 5 switchbacks -> S gate -> square -> west of pavilion -> N gate. 813 m."},
{"id":"night_light_band","name":"Ch. 1 Light Band","aliases":["village lights"],"tier":"must","tag":"CANON","ref":"Ch. 1","pos":[40,230],"elevation":"ground","size":[240,430,0],"look":"lantern_warm emissive points, 2400 total","builder":"lantern_band","notes":"Lights on house windows/eaves (1900) and every 12 m along main_road down to the foot (500). Night only. Reads as one bright band from foot to mountainside."},
{"id":"xiong_village","name":"Xiong Village","aliases":["Xiong family village","Xiong Clan Village","熊家寨"],"tier":"must","tag":"CANON","ref":"Ch. 65; Ch. 157","pos":[-290,300],"elevation":"ground","size":[140,110,10],"look":"70 stilt houses in xiong_timber with hide_awning roofs; log palisade 4 m; 1 gate north-east","builder":"village","notes":"Lowest of the three villages, bench at y 21 on the fore slope near the foot."},
{"id":"bai_village","name":"Bai Village","aliases":["Bai family village","Bai Clan Village","白家寨"],"tier":"must","tag":"CANON","ref":"Ch. 14; Ch. 65; Ch. 117","pos":[-55,-400],"elevation":"ground","size":[140,70,9],"look":"60 houses in bai_timber with roof_bai; pale stone wall 4 m; 1 gate west","builder":"village","notes":"On the back-mountain bench (y 60) directly beside the deep pool east of it."},
{"id":"back_waterfall","name":"Back-Mountain Waterfall and Deep Pool","aliases":["waterfall cave pool"],"tier":"must","tag":"CANON","ref":"Ch. 14; Wiki: Qing Mao Mountain","pos":[60,-385],"elevation":"ground","size":[56,76,38],"look":"Falling sheet water_fall 14 m wide, mist puff sprites mist; pool water_pool","builder":"waterfall","notes":"Lip at (60,-345) y 97 drops 38 m to the pool, centre (60,-395) r 28, surface y 59. Outlet east at (88,-400)."},
{"id":"alliance_slope","name":"Alliance Slope","aliases":["会盟坡"],"tier":"must","tag":"CANON","ref":"Ch. 124; Ch. 125; Ch. 127","pos":[-322,-60],"elevation":"ground","size":[90,160,0.5],"look":"trampled earth path_earth with stone_paving border 3 m","builder":"plaza","notes":"Giant square, long axis north-south, running along the rock wall that rises on its east side."},
{"id":"spear_bamboo_forest","name":"Spear Bamboo Forest","aliases":["Qing Mao bamboo","green spear bamboo","青矛竹"],"tier":"must","tag":"CANON","ref":"Ch. 7; Ch. 13; Ch. 14; Ch. 200","pos":[10,120],"elevation":"ground","size":[420,360,14],"look":"Straight stalks bamboo_green to bamboo_jade, sharp tips, no branches; grass + white_flower ground cover","builder":"bamboo_forest","notes":"5000 instanced stalks around the village wall, densest east of the academy toward the rock crack. Excludes walls, roads, water, footprints."},
{"id":"stalactite_cave","name":"Spring Cave (Stalactite Hall)","aliases":["underground karst cave"],"tier":"must","tag":"CANON","ref":"Ch. 4","pos":[-5,105],"elevation":50,"size":[30,24,12],"look":"cave_rock walls; 60 stalactites emissive in the 7 rainbow colours","builder":"cave_room","notes":"Reached by stone stair from portal P1. A shallow 3 m-wide underground stream crosses its east end."},
{"id":"spirit_spring","name":"Gu Yue Spirit Spring","aliases":["spiritual spring","primeval spring","元泉"],"tier":"must","tag":"CANON","ref":"Ch. 4; Ch. 162; Ch. 182","pos":[52,125],"elevation":50,"size":[12,12,3],"look":"Clear water_spring with faint starry glow spring_glow, sand bed; crystal_wall arc on its east side","builder":"cave_spring","notes":"Dark corner at the far end of the orchid sea. Village foundation. Crystal wall faces the inheritance passage."},
{"id":"waterfall_tributary","name":"Waterfall Tributary","aliases":["tributary"],"tier":"detail","tag":"INFERRED","ref":"Ch. 200","pos":[270,1],"elevation":"ground","size":[364,918,2],"look":"water_trib, cascades white foam where grade >0.2","builder":"water_river","notes":"Drains the deep pool east and south around the mountain to the main river at (440,460). Polyline rivers.waterfall_tributary."},
{"id":"academy","name":"Gu Yue Academy","aliases":["schoolhouse","学堂"],"tier":"detail","tag":"CANON","ref":"Ch. 4; Ch. 7","pos":[78,100],"elevation":"ground","size":[30,16,9],"look":"2-storey bamboo hall bamboo_green, roof_tile, long east-facing window row","builder":"hall","notes":"East side of the village so its windows overlook the spear bamboo grove. Gu room inside."},
{"id":"dormitories","name":"Academy Dormitories","aliases":["宿舍"],"tier":"detail","tag":"CANON","ref":"Ch. 60","pos":[78,58],"elevation":"ground","size":[24,14,7],"look":"Long bamboo house, roof_bamboo","builder":"hall","notes":"Beside the academy, north. Position free (no canon placement)."},
{"id":"medicine_hall","name":"Medicine Hall","aliases":["infirmary"],"tier":"detail","tag":"CANON","ref":"Ch. 149; Ch. 157","pos":[-75,100],"elevation":"ground","size":[20,14,8],"look":"Bamboo hall, herb racks timber, roof_bamboo","builder":"hall","notes":"Position free (no canon placement)."},
{"id":"punishment_hall","name":"Punishment Hall","aliases":[],"tier":"detail","tag":"CANON","ref":"Wiki: Gu Yue Clan","pos":[-60,50],"elevation":"ground","size":[18,14,8],"look":"Dark hall timber_dark, roof_tile, no lanterns","builder":"hall","notes":"Position free (no canon placement)."},
{"id":"tavern","name":"Village Tavern","aliases":["酒肆"],"tier":"detail","tag":"CANON","ref":"Ch. 13; Ch. 117; Ch. 157","pos":[-35,210],"elevation":"ground","size":[14,10,7],"look":"Bamboo house with wine jars clay_jar stacked outside, 4 lanterns","builder":"hall","notes":"Inside the main (S) gate, where taverns stand. Sells green bamboo wine."},
{"id":"alliance_rock_building","name":"Alliance Rock Building","aliases":["stone tower","石楼"],"tier":"detail","tag":"CANON","ref":"Ch. 124; Ch. 125","pos":[-268,-60],"elevation":46,"size":[12,30,18],"look":"Carved into rock: rock_dark facade, balcony at y 60 with stone railing","builder":"rock_terrace","notes":"Cut into the rock wall on the square's east side; balcony overlooks the square."},
{"id":"rock_crack","name":"Rock Crack Entrance","aliases":["stone-crack","石缝"],"tier":"detail","tag":"CANON","ref":"Ch. 14; Ch. 163","pos":[254,62],"elevation":"ground","size":[8,8,7],"look":"Boulder rock with a 0.8 m vertical crevice, moss streaks moss; branch fall water_fall 1.5 m wide over it","builder":"boulder_crack","notes":"Boulder set against the vertical knob wall; portal P2 into the secret cave. Branch waterfall from rockcrack_stream."},
{"id":"secret_cave","name":"Flower Wine Monk Secret Cave","aliases":["stone-crack secret cave","石缝秘洞","waterfall cave"],"tier":"detail","tag":"CANON","ref":"Ch. 14; Ch. 15; Ch. 16; Ch. 60","pos":[228,62],"elevation":80,"size":[9,9,4],"look":"red_earth walls emissive 0.25, damp moss patches, withered vines; image wall 0.9 m high on west wall","builder":"cave_room","notes":"Inside the knob wall (about 80 m2). West wall is the image wall; the inheritance tunnel starts behind it."},
{"id":"inheritance_tunnel","name":"Inheritance Tunnel","aliases":["passage behind the wall","甬道"],"tier":"detail","tag":"CANON","ref":"Ch. 60; Ch. 61; Ch. 64; Ch. 79","pos":[184,61],"elevation":58,"size":[84,4,22],"look":"red_earth tube, stoop-height 1.5 m first 15 m then 2.5 m; round boulder rock on the incline; rock_door slab","builder":"cave_tunnel","notes":"Polyline (224,62,80) (205,62,72) (175,60,64) (150,60,62) (140,60,58). Boulder incline 175->150; rock door at 150."},
{"id":"rock_forest","name":"Rock Forest","aliases":["Stone Forest","石林"],"tier":"detail","tag":"CANON","ref":"Ch. 79; Ch. 100; Ch. 114; Ch. 116","pos":[110,60],"elevation":58,"size":[50,44,16],"look":"40 inverted pillars red_pillar hanging from ceiling, pitted holes, glow 0.15; bigger toward centre","builder":"cave_pillar_forest","notes":"Central pillar nearly touches floor; crude stair under it descends west to the spring's crystal wall."},
{"id":"moon_orchid_sea","name":"Moon Orchid Flower Sea","aliases":["flower sea"],"tier":"detail","tag":"CANON","ref":"Ch. 4; Ch. 5","pos":[28,125],"elevation":50,"size":[30,30,8],"look":"1200 instanced orchids moon_orchid, emissive 0.3 at night/cutaway","builder":"cave_flower_sea","notes":"Past the stream; walk 50 steps (35 m) from its west edge to the spring."},
{"id":"blood_pond_graveyard","name":"Blood Pond Graveyard","aliases":["Blood Lake","blood lake graveyard","血湖墓地"],"tier":"detail","tag":"CANON","ref":"Ch. 182; Ch. 183; Ch. 185","pos":[30,150],"elevation":-12,"size":[90,90,40],"look":"Dome of red_earth glowing 0.3; pond blood_water emissive; 60 ceiling holes with thin water threads","builder":"cave_blood_pond","notes":"Directly below the spring, deepest space. Coffin stays submerged (baseline). Shaft from spring floor."},
{"id":"gy_hamlets","name":"Gu Yue Mortal Hamlets","aliases":["mortal villages"],"tier":"detail","tag":"CANON","ref":"Ch. 65","pos":[30,415],"elevation":"ground","size":[180,40,6],"look":"3 clusters of 12 small single-storey huts thatch roofs, fields field_green","builder":"hamlet_cluster","notes":"Merged from tens of hamlets. Clusters at x -60, 30, 105."},
{"id":"xiong_hamlets","name":"Xiong Mortal Hamlets","aliases":[],"tier":"detail","tag":"CANON","ref":"Ch. 65","pos":[-400,425],"elevation":"ground","size":[80,40,6],"look":"1 cluster of 14 huts thatch","builder":"hamlet_cluster","notes":"Below Xiong Village at the foot."},
{"id":"bai_hamlets","name":"Bai Mortal Hamlets","aliases":[],"tier":"detail","tag":"CANON","ref":"Ch. 65","pos":[-240,-455],"elevation":"ground","size":[70,30,6],"look":"1 cluster of 12 huts thatch","builder":"hamlet_cluster","notes":"Back-mountain foot below Bai Village."},
{"id":"river_beach","name":"Tributary Beach","aliases":["river beach","河滩"],"tier":"detail","tag":"CANON","ref":"Ch. 60","pos":[412,110],"elevation":"ground","size":[16,30,1],"look":"Pebble bank sand + rock pebbles","builder":"beach","notes":"Pebble bank about 160 m east of the rock crack, end of east_lane."},
{"id":"summit","name":"Qing Mao Summit","aliases":["mountain top"],"tier":"detail","tag":"CANON","ref":"Ch. 117","pos":[0,-130],"elevation":"ground","size":[30,30,8],"look":"12 jagged rock instances rock_dark, no buildings","builder":"summit_rocks","notes":"Highest point about y 207."},
{"id":"west_clan_road","name":"Clan Road","aliases":["caravan road"],"tier":"detail","tag":"INFERRED","ref":"Ch. 45; Ch. 157","pos":[-222.5,-47.5],"elevation":"ground","size":[215,695,0],"look":"path_earth 4 m, steps where grade >0.35","builder":"path","notes":"Polyline paths.west_clan_road: W gate -> Xiong -> Alliance Slope -> Bai."},
{"id":"east_lane","name":"East Lane","aliases":["path to the grove"],"tier":"detail","tag":"INFERRED","ref":"Ch. 13; Ch. 14","pos":[263.5,106],"elevation":"ground","size":[297,48,0],"look":"path_earth 3 m, fades to trampled grass past the grove","builder":"path","notes":"Polyline paths.east_lane: E gate -> grove -> rock crack -> beach."},
{"id":"wolf_den_valley","name":"Wolf Den Valley","aliases":["wolf lairs","wolf pack valley"],"tier":"detail","tag":"INFERRED","ref":"Ch. 117; Ch. 134; Ch. 165","pos":[340,-300],"elevation":"ground","size":[80,60,6],"look":"8 dark den mouths rock_dark in a scrubby hollow, no animals","builder":"valley_dens","notes":"Lower north-east slope, away from all villages."},
{"id":"upper_stream","name":"Upper Stream","aliases":[],"tier":"polish","tag":"INVENTED","ref":"none","pos":[40,-280],"elevation":"ground","size":[40,139,0],"look":"water_trib ribbon 3 m","builder":"water_stream","notes":"Feeds the waterfall lip. Polyline rivers.upper_stream (ribbon, no carving)."},
{"id":"rockcrack_stream","name":"Branch Waterfall Stream","aliases":[],"tier":"detail","tag":"INFERRED","ref":"Ch. 14","pos":[198,11],"elevation":"ground","size":[96,102,0],"look":"water_trib ribbon 3 m","builder":"water_stream","notes":"Source of the branch fall over the rock crack. Ribbons rivers.rockcrack_stream and rockcrack_runoff."},
{"id":"foot_road","name":"Foot Road","aliases":[],"tier":"polish","tag":"INVENTED","ref":"none","pos":[-205,402.5],"elevation":"ground","size":[350,45,0],"look":"path_earth 3 m","builder":"path","notes":"Polyline paths.foot_road linking the hamlets along the foot."},
{"id":"hunter_tree_house","name":"Old Hunter Wang's Tree House","aliases":["hidden small tree house"],"tier":"polish","tag":"CANON","ref":"Ch. 74","pos":[-170,40],"elevation":"ground","size":[6,6,9],"look":"Plank hut timber on a tree platform 5 m up, 2 windows","builder":"tree_house","notes":"Position free (no canon placement); hidden in forest west of the village."},
{"id":"wildflower_slopes","name":"Wildflower Slopes","aliases":[],"tier":"polish","tag":"CANON","ref":"Ch. 109","pos":[-120,330],"elevation":"ground","size":[300,140,0.5],"look":"Instanced flower quads in 5 colours flowers_*","builder":"meadow","notes":"Sunny south-facing slopes between village and Xiong."},
{"id":"mist_banks","name":"Mountain Mist","aliases":["mountain fog"],"tier":"polish","tag":"CANON","ref":"Ch. 4","pos":[0,0],"elevation":"ground","size":[1000,1000,40],"look":"24 large soft sprites mist, opacity 0.25, drift 0.3 m/s","builder":"mist","notes":"Morning mist bands at y 30-70 on the fore slope."}
]
```

Counts: 42 features (15 must, 22 detail, 5 polish). Tags: 34 CANON, 6 INFERRED, 2 INVENTED (5%).

## 6. Builder glossary and shared libraries

### 6.1 Palette (`src/core/palette.js`; hex sRGB)

**Ground and rock**

| key | hex | key | hex | key | hex |
|---|---|---|---|---|---|
| grass_lush | #5f9a3a | grass_dark | #3f6f2a | rock | #7b7d78 |
| rock_dark | #4a4c4a | soil_blue_black | #2c3a3a | sand | #c9b98f |
| path_earth | #8b7655 | stone_paving | #9a9a92 | moss | #4e7a3a |

**Buildings**

| key | hex | key | hex | key | hex |
|---|---|---|---|---|---|
| bamboo_green | #6fae5b | bamboo_jade | #9fd8a0 | roof_bamboo | #4f7d3a |
| timber | #8a6a45 | timber_dark | #4b3524 | roof_tile | #3e4a4f |
| lacquer_red | #9b2d20 | xiong_timber | #6b4a2e | hide_awning | #8c6b4a |
| bai_timber | #cfc8b8 | roof_bai | #8fa3ad | thatch | #b8a06a |
| clay_jar | #8a5a3a | field_green | #7fae4a | | |

**Water**

| key | hex | key | hex | key | hex |
|---|---|---|---|---|---|
| water_yellow | #b39a55 | water_trib | #6f9fa0 | water_pool | #3f6f78 |
| water_fall | #dfeef0 | water_spring | #bfe8ff | spring_glow | #e8f4ff |
| crystal_wall | #cfefff | | | | |

**Underground**

| key | hex | key | hex | key | hex |
|---|---|---|---|---|---|
| red_earth | #8a2a1e | red_pillar | #6e2418 | blood_water | #7a0f12 |
| cave_rock | #3b3f44 | moon_orchid | #d9d4ff | | |

**Flora, light and sky**

| key | hex | key | hex | key | hex |
|---|---|---|---|---|---|
| white_flower | #f4f4ee | mist | #e8eef0 | lantern_warm | #ffb15c |
| sky_day | #a9cde8 | sky_night | #0d1830 | fog_day | #c9dbe3 |
| fog_night | #142033 | | | | |

Other colour sets:
- **flowers_1…5:** #e85a6a, #f2c14e, #f5f5f5, #9a7fe0, #ff8c42.
- **rainbow (stalactites):** #ff4d4d, #ff9a3c, #ffe14d, #5fdc6a, #4dc3ff, #4d6bff, #b05cff.

Material rules:
- `crystal_wall`: opacity 0.35, double-sided.
- Emissive features: emissiveIntensity = 0 by day, 1 by night or underground. Values written in `look` (e.g. "emissive 0.3") are the night intensity.

Clan colour cues:
- Gu Yue: green bamboo (CANON).
- Bai: pale timber and cool blue-grey roofs (INFERRED from the water/ice path and pale skin, Ch. 124).
- Xiong: dark timber and hide awnings (INFERRED from the bear emblem).

### 6.2 Builders (interface §7.3)

**Terrain and water**
- `terrain`: chunked mesh, §3.
- `water_river`: a strip mesh along the polyline at bed + water. Width = 2·halfWidth + 2 m. UV-scrolled canvas-noise normal tint at 0.4 m/s downstream.
- `path`: ribbon and steps, §3.
- `water_stream`: 3 m ribbon. Its colour pulses with a sin offset.
- `waterfall`: a 14 m-wide vertical strip of 6 bent quads from the lip (60, −345, y 97) to the pool (y 59), V-scroll 3 m/s. Mist sprites at the base. Pool disc r 28 at y 59.

**Settlements**
- `wall_ring`: palisade of instanced 0.4 m posts at 0.5 m pitch (merged per side) along the rectangle in notes, 6 m high, with a 1 m walkway inside at 4.5 m and a ladder every 30 m. Four gate gaps 8 m wide with gatehouse frames 9 m high. 8 towers: 4×4 m, 10 m high, pyramid roof.
- `house_cluster` and `village`: scatter houses with the bamboo-house generator (§6.3) by Poisson-disc sampling (min spacing 9 m) inside the footprint. Reject points on roads (width + 2 m), water, other footprints, and ground slope > 0.7. Each house's door faces downhill. `village` also builds its own wall per the `look` field.
- `hamlet_cluster`: N single-storey huts (4×4×3.5 m, thatch roof) in tight rings of radius 14 m, with two 10×6 m `field_green` plots each. Clusters are spaced across the footprint.
- `clan_pavilion`: 5 stacked storeys. Storey 1 is 26×20×6 m; each storey above shrinks 2 m in w and d and is 5 m high. Every storey gets a roof_tile eave band 1.5 m deep whose corners curve up 1.2 m (upswept). A lacquer_red post at every 4 m on storey 1. Lantern pairs at every eave corner. Its south face looks onto `pavilion_square`.
- `hall`: 1–2 storey bamboo block (`size`), pitched roof, 1 m stilts on the downhill side.
- `plaza`: flat tessellated slab at ground + 0.3, with an edge kerb.

**Rock, ground features and atmosphere**
- `rock_terrace`: carved facade box set into the east wall of the Alliance Slope, with 3 openings and a balcony at y 60 (2 m deep, stone railing 1.1 m).
- `boulder_crack`: an icosahedron boulder (detail 1, jittered) 8×8×7 m with a 0.8×4 m crevice cut. A 1.5 m-wide water_fall strip runs from the knob top over it. Portal P2 sits at the crevice.
- `beach`: a pebble patch of 300 instanced rocks 0.2–0.6 m.
- `summit_rocks`: 12 jittered icosahedra, 3–8 m.
- `valley_dens`: 8 half-buried dark torus/arch mouths, 3 m, in a shallow bowl. Purely terrain dressing.
- `tree_house`: a 6×6 m plank hut on 4 posts at 5 m, plus one broad-leaf tree (cone stack).
- `bamboo_forest`: §6.4.
- `meadow`: 4,000 instanced crossed quads, 0.4 m.
- `mist`: §6.6.
- `lantern_band`: §6.5.

**Underground**
- `cave_room`: inverted box, rounded by jittering vertices ±0.8 m, with a back-face material.
- `cave_spring`: a 12 m pool disc of water_spring with additive point sprites (spring_glow, 400 points). The crystal wall is a 14 m arc, 4 m high, on the spring's east side.
- `cave_flower_sea`: 1,200 instanced orchids (3 crossed quads, 0.5 m) plus 150 rising Hope-light sprites at night.
- `cave_pillar_forest`: an inverted box shell plus 40 hanging cones (ceiling to 2–10 m above the floor, radius 1–3 m, growing toward the centre). The central cone is r 4 m and ends 0.5 m above the floor; a stair beneath it leads to a tunnel.
- `cave_blood_pond`: a hemisphere dome, r 45 m, with the floor at −12. The pond is a disc r 40 at y −6. 60 ceiling holes are thin cylinders carrying falling water_trib threads.
- `cave_tunnel`: a tube along the polyline in notes (radius 1.25 m; first 15 m radius 0.8 m). A 3 m round boulder sits at the start of the incline. The rock door is a 3×3 m slab at the end.

### 6.3 Bamboo-house generator (`src/arch/bambooHouse.js`)

`makeHouseParts(rng)` returns three geometries (stilts, body, roof), shared by every instance. Per-instance variation is carried by the instance matrix and instance colour.

- **Stilt level:** 9 posts, 0.3 m diameter, height = 2.5 m plus the downhill drop under the footprint (sample 4 corners and use max − min).
- **Body:** w 6–9 m, d 5–7 m. Height: 3 m (60%), 6 m for two storeys (35%), or 9 m (5%). Vertical bamboo ribs every 0.4 m, baked as vertex-colour stripes alternating bamboo_green and bamboo_jade.
- **Roof:** hip roof at 30° pitch, roof_bamboo, eave 0.8 m.
- **Windows:** 2 per storey per long side. A dark quad by day; an emissive lantern_warm quad at night for 70% of houses.

Three InstancedMeshes per village gives 9 draw calls in total.

### 6.4 Instanced vegetation (`src/veg/bamboo.js`)

- **Stalk:** a 6-sided prism, 0.12 m radius, 8–14 m high, with a nodal colour band every 1.2 m and a 0.8 m pyramid tip (spear-sharp, no branches). Add a few 1 m leaf tufts in the top 2 m only.
- **Scatter:** clustered Poisson clumps (12–30 stalks within r 3 m) inside the `spear_bamboo_forest` footprint.
  - Density weights: 1.0 in the strip x 125–245, z 60–150 (the grove between the academy and the rock crack); 0.35 elsewhere.
  - Exclusions: inside the wall rectangle, roads + 3 m, water + 4 m, every other footprint + 4 m.
- **Wind:** vertex-shader sway via `onBeforeCompile`: offset = 0.15·sin(t·1.3 + x·0.05)·(y/h)².
- **Ground cover:** 6,000 instanced white_flower and grass tufts under the bamboo.

### 6.5 Lantern lights (`src/atmos/lanterns.js`)

The Ch. 1 band.
- One InstancedMesh of 0.5 m emissive billboards (canvas radial gradient, lantern_warm), additive blending, `depthWrite: false`.
- Placement:
  - 1,400 on Gu Yue house windows and eaves.
  - 500 every 1.6 m in pairs along `main_road`, from the south gate down to the river landing, flickering ±10% at 0.5–2 Hz.
  - 300 in the mortal hamlets.
  - 200 on the pavilion and wall towers.
- Point lights: 6 nearest-to-camera moving PointLights, range 40 m, intensity 2.
- Visible only at night.

### 6.6 Sky, fog, day/night (`src/atmos/sky.js`)

- **Day:** a sky-dome gradient from sky_day to white near the horizon, plus a HemisphereLight. The DirectionalLight sun comes from the south-east at 50° elevation. Fog colour fog_day, from 250 to 1,400 m (Fog).
- **Night:** sky_night with 800 star points, a moonlight DirectionalLight at 0.25 intensity tinted #9fb4ff, fog_night at 150–900 m. Lanterns and emissive materials on.
- **Toggle:** `N` blends over 2 s.
- **Mist (`src/atmos/mist.js`):** 24 soft sprites, 60–120 m wide, at y 30–70 on the fore slope, opacity 0.25, drifting 0.3 m/s east.
- **Polish only:** shadows (one 2048 shadow map on the sun, terrain receiving) and an UnrealBloomPass (strength 0.6) at night.

## 7. Architecture

### 7.1 File tree and ownership

```
qingmao/
  package.json  index.html  vite.config.js  README.md              [O]
  scripts/validate.mjs                                             [O]
  src/main.js  src/core/{constants,palette,rng,height,builders,stats}.js   [O]
  src/data/{terrain.json,registry.json}                            [O, verbatim]
  src/terrain/{terrainMesh,water,waterfall}.js                     [SA1]
  src/arch/{bambooHouse,villages,walls,pavilion,halls,rockworks,hamlets}.js  [SA2]
  src/veg/{bamboo,flora}.js  src/atmos/{sky,lanterns,mist}.js      [SA3]
  src/under/{caves,spring,rockForest,bloodPond,tunnel,cutaway}.js  [SA4]
  src/ui/{cameras,walker,hud,input}.js                             [SA5]
```

No agent edits another agent's files. To request a change to a shared contract, report it; the orchestrator makes the change.

### 7.2 Data flow

`main.js` does the following, in order:
1. Load the JSON files.
2. Create the renderer, scene and `ctx`.
3. Call `BUILDERS[f.builder](f, ctx)` for every registry entry whose tier is enabled (`?tier=must|detail|polish`, default polish).
4. Add the results to `ctx.surfaceGroup` or `ctx.undergroundGroup`.
5. Start the UI.

Each builder module self-registers through `registerBuilder(name, fn)` in `builders.js`. If a feature has no registered builder, log one warning and skip it; that is allowed only for detail and polish tiers.

### 7.3 Interface contracts (written by the orchestrator first)

```js
// src/core/builders.js
/** ctx: { THREE, heightAt(x,z), terrain, registry, palette, mats(key,opts),
 *         rng(seed), surfaceGroup, undergroundGroup, onTick(fn), state:{night:false,cutaway:false} } */
/** returns { object: THREE.Object3D, layer: 'surface'|'underground',
 *            lights?: THREE.Light[], update?(dt,state), stats?: {instances:number} } */
export const BUILDERS = {};
export function registerBuilder(name, fn) { BUILDERS[name] = fn; }
// mats(key,{emissive,opacity,flat=true}) caches one material per key+opts → keeps draw calls low
```

- `constants.js` exports: `FOOTPRINT = 1000`, `WALKER_SPEED = 5`, `EYE = 1.7`, `GRID_RES = 5`, `BUDGET = { tris: 400000, calls: 300 }`, and `PORTALS`:
  - P1: pavilion (0, 92), surface y 80 → stalactite cave (−5, 105, y 51).
  - P2: rock crack (254, 62), y 80 → secret cave (228, 62, y 81).
- **Cutaway (`C`):** hide terrain chunks overlapping x −30…140, z 20…200 and the surface features inside that box; show `undergroundGroup`. Dim the sky to 30% and put the camera in orbit around (40, 40, 110).
- **Portals:** walking within 2 m of a portal teleports the walker to its pair and sets `state.underground` (fog off, ambient 0.15, emissives on).

## 8. Sub-agent plan

**Step 0 — orchestrator (O), one work package:**
- Scaffold the project.
- Write `terrain.json` and `registry.json` verbatim.
- Write `constants.js`, `palette.js`, `rng.js`, `height.js`, `builders.js`, `stats.js` and `validate.mjs`.
- Write a `main.js` that renders flat-coloured placeholder boxes for every registry entry.
- Gate: `npm run validate` passes and the boxes appear at the right places.

**Step 1 — parallel.** At most 5 at once, each in its own folder or worktree, each owning only its files (§7.1).

| Agent | Scope | Package order |
|---|---|---|
| SA1 terrain & water | terrainMesh (chunks, colours), rivers, streams, waterfall, pool | must → detail |
| SA2 architecture | bamboo-house generator, Gu Yue wall + houses, pavilion, square, Xiong/Bai villages, halls, rock terrace, boulder crack, hamlets, tree house | must (houses, wall, pavilion, villages) → detail |
| SA3 vegetation & atmosphere | bamboo forest, flora, meadow, sky, day/night, lanterns, mist, summit rocks, dens, beach | must (bamboo, sky, lanterns) → detail → polish |
| SA4 underground | all `cave_*`, portals, cutaway | must (stalactite cave, spring) → detail |
| SA5 camera & UI | walker with ground collision via heightAt, 4 cameras, HUD/stats, keys | must |

Every agent:
- Builds against `ctx` only and uses `heightAt` for every y.
- Codes to the palette keys.
- Reports back in ≤ 10 lines: files written, line counts, triangle/instance totals, open issues, contract-change requests.

**Step 2 — orchestrator integrates.** Import each module in `main.js`, run validate, and check the console and budgets at cameras 1–4.

**Step 3 — critic sub-agent.**
- Input: only `registry.json` and screenshots from cameras 1–4, day and night. If screenshots are impossible, a `renderer.info` dump plus a list of object names and bounding boxes.
- Output: ≤ 20 lines listing mismatches (missing feature, wrong side, wrong relative height, wrong colour cue, budget breach). The orchestrator fixes or logs each one.

**Sequential fallback:** O → SA1 → SA2 → SA3 → SA5 → SA4 → step 2 → step 3 (do the critic pass yourself, using only the registry and screenshots). Run this order once per tier.

## 9. Verification kit

**`scripts/validate.mjs`** — Node 18+, imports `src/core/height.js`. Exit 1 on any failure. Checks:
1. Both JSON files parse. Every entry has all 12 fields; `tag` ∈ {CANON, INFERRED, INVENTED}; `tier` ∈ {must, detail, polish}; ids are unique.
2. Counts: must ≤ 15; INVENTED share < 15%.
3. Bounds: every footprint lies within ±500.
4. Overlap: no 2D overlap between non-exempt surface footprints (§5). No 3D overlap between `cave_*` volumes, except `cave_tunnel`.
5. Underground: each cave volume's top is ≤ the minimum terrain height over its footprint (9 samples) − 4 m.
6. Vertical order (§4). heightAt values: Xiong (−290, 300) < south gate (0, 235) < Bai (−55, −400) < pavilion (0, 95) < north gate (0, 20).
7. Halls, pavilion, square and tavern sit inside the wall rectangle x −115…115, z 20…235.
8. The `main_road` 3D length at 5 m/s is 120–180 s.
9. Every `builder` value is in the §6.2 list.
10. Source budget: every file in `src/` is ≤ 300 lines; the total is ≤ 4,000.

**Runtime budget check** (`stats.js`): with `?check=1`, visit cameras 1–4 for 2 s each. `console.error` if `renderer.info.render.triangles` exceeds 400k, `.calls` exceeds 300, or the frame time averages above 16.7 ms. Otherwise print `BUDGET OK`.

**Canonical cameras** (position → look-at):
1. **Night band from the foot (Ch. 1):** (60, 4.5, 452) → (0, 85, 110). Force night. Expect a continuous warm band rising from the river landing to the walled village, with the pavilion lanterns at the top and Xiong's few lights low on the left.
2. **Fore-mountain overview, day:** (380, 260, 620) → (−40, 60, 40). Expect the river in front, Xiong low on the left, Gu Yue mid-slope with the pavilion, the bamboo east of the wall, the Alliance Slope on the far left, and the summit behind.
3. **Back mountain, day:** (120, 140, −620) → (20, 60, −380). Expect the waterfall over the cliff into the deep pool, Bai Village west of the pool, the tributary leaving east, and the summit above.
4. **Underground cutaway:** (190, 120, 260) → (40, 30, 110), cutaway on. Expect the stalactite cave under the pavilion, then the orchid sea, then the spring with its crystal wall; the Rock Forest east of them; the tunnel climbing east to the secret cave; and the Blood Pond dome below.

## 10. Build tiers and gates

**Must-ship.** The 15 `must` features, plus `N`, `C` (stalactite cave and spring only), cameras 1–4, the walker, and the stats overlay.
Gate: validate passes; there are no console errors; cameras 1–3 match their expectations; BUDGET OK.

**Detail.** All `detail` features, the full cutaway, and portals P1 and P2.
Gate: the same, plus the critic list is resolved or logged.

**Polish.** All `polish` features, shadows, bloom, mist drift, waterfall and river animation, and wind sway.
Gate: the same, plus a 60 fps target at camera 2.

**Stretch (only after polish, each behind its own toggle):**
- `?stage=wolftide`: trap trenches with bamboo-slat spikes and thorned vines along the Gu Yue wall (Ch. 149, Ch. 157).
- `?stage=ice`: a white glacier material on everything from peak to foot (Ch. 195–199).
No wolves or people in either.

## 11. Operating rules and cut list

- Never ask clarifying questions. When something is unspecified, pick the simplest option consistent with this file and add one line to README "Assumptions".
- Never invent named places. Unnamed filler (rocks, trees, extra huts) is allowed.
- Never rename features or move them by more than 5 m. If a builder needs room, shrink the feature.
- Fix console errors before adding features.
- When context or time nears its limit, finish the work package in progress, make sure the current tier's gate passes (disable unfinished features via tier filtering), write README "Remaining work", then stop.

**Ordered cut list** (cut from the top; never cut must-tier):
1. mist_banks
2. wildflower_slopes
3. hunter_tree_house
4. foot_road
5. upper_stream (keep the waterfall fed visually from the lip)
6. bloom, then shadows
7. wolf_den_valley
8. river_beach
9. bai_hamlets
10. xiong_hamlets
11. summit
12. dormitories
13. punishment_hall
14. medicine_hall
15. inheritance_tunnel detail (keep a plain tube)
16. rock_forest pillars reduced to 15
17. blood_pond_graveyard ceiling threads
18. waterfall_tributary (keep the pool)

## 12. Canon and ambiguity log (for the human reader)

| # | Topic | Sources | Resolution |
|---|---|---|---|
| 1 | Xiong placement | Ch. 65 puts Xiong on the fore mountain; Ch. 157 says lowest, at the foot | Low bench (y 21) on the fore slope, just above the foot hamlets. Satisfies both |
| 2 | The river | Yellow Dragon = Huang Long (Ch. 117, Ch. 200). Red Dragon River is a different river in the far north-west | Yellow Dragon only; Red Dragon dropped |
| 3 | River course | Main course near the foot (Ch. 117); tributaries cross the mountain (Ch. 200) | Main course along the south edge. Tributary from the back waterfall (INFERRED) |
| 4 | Soil colour | "Green" (Ch. 60) vs blue-black (Ch. 183); both render 青 | Grass on top; blue-black soil on cut banks only |
| 5 | Spring water | Clear with a faint starry glow (Ch. 4) vs milky (generic wiki) | Ch. 4 |
| 6 | Secret cave | Inside the wall, not a pit (Ch. 16); wiki says "waterfall cave" | Crack in a boulder under a branch waterfall; chamber in the knob |
| 7 | Gates | Four gates (Ch. 149); "main gate" (Ch. 157) | South gate made the main gate (INFERRED). East gate exists (Ch. 149) |
| 8 | Positions not given in canon | Academy (beside the bamboo grove, Ch. 7), halls, tavern, dormitories, tree house | Placed inside or near the village; the notes say "position free" |
| 9 | Naming | Gu Yue Village = Gu Yue Mountain Stockade = 古月山寨; Blood Pond Graveyard = Blood Lake (Ch. 182–183); Rock Forest = Stone Forest; Awakening Ceremony = Aperture Opening; Qing Mao = Green Thatch | Official translation (Webnovel) names are primary |
| 10 | Underground scale | The Blood Pond is larger than the village (Ch. 182) | Compressed to a 90 m dome to stay under the village. The Rock Forest (over 30 mu) is compressed to 50 × 44 m |
| 11 | Excluded from baseline | Caravan tents (arrive Ch. 39), the merit board (Ch. 127), wolf-tide defences (Ch. 149), the glacier (Ch. 195), the coffin rising (Ch. 185) | Left out of baseline; some are stretch toggles |
| 12 | Overall scale | Southern Border mountains exceed 10,000 ft (wiki) | 213 m relief by brief rule; topology kept |
