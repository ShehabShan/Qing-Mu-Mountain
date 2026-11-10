export const FOOTPRINT = 1000;
export const WALKER_SPEED = 5;
export const EYE = 1.7;
export const GRID_RES = 5;
export const BUDGET = { tris: 400000, calls: 300 };

export const PORTALS = [
  {
    id: 'P1',
    name: 'Clan Pavilion Stair <-> Stalactite Cave',
    surface: { x: 0, y: 80, z: 92, label: 'Clan Pavilion Stair (P1)' },
    underground: { x: -5, y: 51, z: 105, label: 'Stalactite Cave (P1)' },
  },
  {
    id: 'P2',
    name: 'Rock Crack Crevice <-> Secret Cave',
    surface: { x: 254, y: 80, z: 62, label: 'Rock Crack Entrance (P2)' },
    underground: { x: 228, y: 81, z: 62, label: 'Flower Wine Monk Secret Cave (P2)' },
  },
];

export const CUTAWAY_BOX = { minX: -30, maxX: 140, minZ: 20, maxZ: 200, orbitTarget: [40, 40, 110] };

export const CANONICAL_CAMERAS = {
  1: { id: 1, name: 'Night Band from Foot (Ch. 1)', pos: [60, 4.5, 452], target: [0, 85, 110], forceNight: true, forceCutaway: false },
  2: { id: 2, name: 'Fore-Mountain Overview (Day)', pos: [380, 260, 620], target: [-40, 60, 40], forceNight: false, forceCutaway: false },
  3: { id: 3, name: 'Back Mountain & Waterfall (Day)', pos: [120, 140, -620], target: [20, 60, -380], forceNight: false, forceCutaway: false },
  4: { id: 4, name: 'Underground Cutaway', pos: [190, 120, 260], target: [40, 30, 110], forceNight: false, forceCutaway: true },
};

export const EXEMPT_OVERLAP_BUILDERS = new Set([
  'terrain', 'water_river', 'water_stream', 'path', 'house_cluster',
  'bamboo_forest', 'lantern_band', 'meadow', 'mist', 'wall_ring',
]);

export const VALID_BUILDERS = new Set([
  'terrain', 'water_river', 'path', 'water_stream', 'waterfall',
  'wall_ring', 'house_cluster', 'village', 'hamlet_cluster', 'clan_pavilion',
  'hall', 'plaza', 'rock_terrace', 'boulder_crack', 'beach',
  'summit_rocks', 'valley_dens', 'tree_house', 'bamboo_forest', 'meadow',
  'mist', 'lantern_band', 'cave_room', 'cave_spring', 'cave_flower_sea',
  'cave_pillar_forest', 'cave_blood_pond', 'cave_tunnel',
]);
