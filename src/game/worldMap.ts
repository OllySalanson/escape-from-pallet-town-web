import type { Direction, GridPosition } from './movement/gridMovement';
import {
  PALLET_TALL_GRASS,
  VIRIDIAN_FOREST_TALL_GRASS,
  type WildEncounterTable,
} from './pokemon/encounters';
import type { WorldLoot } from './world/loot';
import { WORLD_ENTITIES, type WorldEntity } from './world/npcs';
import { poisForMap, type WorldPoi } from './world/pois';

export const TILE_SIZE = 16;
export const MAP_WIDTH = 32;
export const MAP_HEIGHT = 44;

export type WarpActivation = 'step' | 'interact';

export interface MapWarp {
  readonly source: GridPosition;
  readonly destinationMapId: WorldMapId;
  readonly destination: GridPosition;
  readonly facing: Direction;
  readonly activation: WarpActivation;
}

export interface TallGrassZone {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface WorldMapDefinition {
  readonly id: WorldMapId;
  readonly width: number;
  readonly height: number;
  readonly groundLayer: readonly number[][];
  readonly tallGrassLayer: readonly number[][];
  readonly detailLayer: readonly number[][];
  readonly collision: readonly boolean[][];
  readonly tallGrassZones: readonly TallGrassZone[];
  readonly encounters?: WildEncounterTable;
  readonly warps: readonly MapWarp[];
  readonly entities: readonly WorldEntity[];
  readonly loot: readonly WorldLoot[];
  /** Fixed landmarks are authored separately from randomised run loot. */
  readonly pois: readonly WorldPoi[];
}

export type WorldMapId = 'pallet-town' | 'route-1' | 'viridian-forest' | 'floodplain-relay';

export const CLASSIC_TILE = {
  GRASS: 46,
  TALL_GRASS: 47,
  DIRT_PATH: 44,
  TREE_RED: 40,
  TREE_LEAFY: 41,
  TALL_GRASS_TUFT: 41,
  FLOWER_RED: 7,
  FLOWER_BLUE: 31,
  FLOWER_YELLOW: 55,
  POND_WATER: 45,
  POND_BANK_NORTH_WEST: 58,
  POND_BANK_NORTH: 69,
  POND_BANK_NORTH_EAST: 59,
  POND_BANK_WEST: 62,
  POND_BANK_EAST: 60,
  POND_BANK_SOUTH_WEST: 66,
  POND_BANK_SOUTH: 53,
  POND_BANK_SOUTH_EAST: 67,
  FENCE_LEFT: 72,
  FENCE_MIDDLE: 73,
  FENCE_RIGHT: 74,
} as const;

export const SOLID_CLASSIC_TILES: ReadonlySet<number> = new Set([
  CLASSIC_TILE.TREE_RED,
  CLASSIC_TILE.TREE_LEAFY,
  CLASSIC_TILE.POND_WATER,
  CLASSIC_TILE.POND_BANK_NORTH_WEST,
  CLASSIC_TILE.POND_BANK_NORTH,
  CLASSIC_TILE.POND_BANK_NORTH_EAST,
  CLASSIC_TILE.POND_BANK_WEST,
  CLASSIC_TILE.POND_BANK_EAST,
  CLASSIC_TILE.POND_BANK_SOUTH_WEST,
  CLASSIC_TILE.POND_BANK_SOUTH,
  CLASSIC_TILE.POND_BANK_SOUTH_EAST,
  CLASSIC_TILE.FENCE_LEFT,
  CLASSIC_TILE.FENCE_MIDDLE,
  CLASSIC_TILE.FENCE_RIGHT,
]);

const POND_LEFT = 12;
const POND_TOP = 2;
const POND_WIDTH = 7;
const POND_HEIGHT = 6;
const TALL_GRASS_LEFT = 3;
const TALL_GRASS_TOP = 22;
const TALL_GRASS_WIDTH = MAP_WIDTH - 6;
const TALL_GRASS_HEIGHT = 12;

export function buildGroundLayerData(): number[][] {
  const data = createLayer(CLASSIC_TILE.GRASS);

  // Pallet Town's north-south road becomes Route 1 south of the pond.
  paintRectangle(data, 7, 0, 2, 22, CLASSIC_TILE.DIRT_PATH);
  paintRectangle(data, 7, 10, MAP_WIDTH - 7, 2, CLASSIC_TILE.DIRT_PATH);
  paintRectangle(data, 7, 34, 2, MAP_HEIGHT - 34, CLASSIC_TILE.DIRT_PATH);
  paintRectangle(
    data,
    TALL_GRASS_LEFT,
    TALL_GRASS_TOP,
    TALL_GRASS_WIDTH,
    TALL_GRASS_HEIGHT,
    CLASSIC_TILE.TALL_GRASS,
  );
  paintPond(data);

  return data;
}

export function buildTallGrassLayerData(): number[][] {
  const data = createLayer(-1);

  // Tile 41 is the classic tileset's dark-green leafy tuft. Rendering it over
  // the normal grass base gives the encounter zone a clear tall-grass texture.
  paintRectangle(
    data,
    TALL_GRASS_LEFT,
    TALL_GRASS_TOP,
    TALL_GRASS_WIDTH,
    TALL_GRASS_HEIGHT,
    CLASSIC_TILE.TALL_GRASS_TUFT,
  );

  return data;
}

export function buildDetailLayerData(): number[][] {
  const data = createLayer(-1);

  placeTiles(data, CLASSIC_TILE.TREE_RED, [
    [1, 1],
    [3, 2],
    [1, 5],
    [4, 6],
    [22, 2],
    [24, 5],
    [2, 16],
    [5, 18],
    [21, 16],
    [24, 18],
    [1, 21],
    [30, 21],
    [1, 25],
    [30, 25],
    [1, 30],
    [30, 30],
    [2, 34],
    [29, 34],
    [4, 39],
    [27, 40],
  ]);
  placeTiles(data, CLASSIC_TILE.TREE_LEAFY, [
    [2, 1],
    [1, 2],
    [4, 2],
    [2, 5],
    [3, 5],
    [23, 2],
    [24, 3],
    [22, 17],
    [23, 17],
    [2, 21],
    [29, 21],
    [2, 25],
    [29, 25],
    [2, 30],
    [29, 30],
    [3, 34],
    [28, 34],
    [5, 39],
    [26, 40],
  ]);

  placeTiles(data, CLASSIC_TILE.FLOWER_RED, [
    [5, 3],
    [20, 8],
  ]);
  placeTiles(data, CLASSIC_TILE.FLOWER_BLUE, [
    [10, 4],
    [4, 14],
  ]);
  placeTiles(data, CLASSIC_TILE.FLOWER_YELLOW, [
    [10, 7],
    [18, 14],
  ]);

  data[9].splice(
    12,
    5,
    CLASSIC_TILE.FENCE_LEFT,
    CLASSIC_TILE.FENCE_MIDDLE,
    CLASSIC_TILE.FENCE_MIDDLE,
    CLASSIC_TILE.FENCE_MIDDLE,
    CLASSIC_TILE.FENCE_RIGHT,
  );

  data[21].splice(
    3,
    MAP_WIDTH - 6,
    CLASSIC_TILE.FENCE_LEFT,
    ...Array.from({ length: MAP_WIDTH - 8 }, () => CLASSIC_TILE.FENCE_MIDDLE),
    CLASSIC_TILE.FENCE_RIGHT,
  );
  // Leave the road open so the route's grass is the only way south.
  data[21][7] = -1;
  data[21][8] = -1;
  sealUnlinkedMapEdges(data, [
    {
      source: { x: 7, y: MAP_HEIGHT - 1 },
      destinationMapId: 'route-1',
      destination: { x: 7, y: 1 },
      facing: 'down',
      activation: 'step',
    },
  ]);

  return data;
}

export function buildCollisionData(): boolean[][] {
  const ground = buildGroundLayerData();
  const details = buildDetailLayerData();

  return buildCollisionLayer(ground, details);
}

export function isTallGrassTile(position: { x: number; y: number }): boolean {
  return buildGroundLayerData()[position.y]?.[position.x] === CLASSIC_TILE.TALL_GRASS;
}

function createLayer(fillTile: number): number[][] {
  return Array.from({ length: MAP_HEIGHT }, () => Array<number>(MAP_WIDTH).fill(fillTile));
}

function paintRectangle(
  data: number[][],
  left: number,
  top: number,
  width: number,
  height: number,
  tile: number,
): void {
  for (let y = top; y < top + height; y += 1) {
    for (let x = left; x < left + width; x += 1) {
      data[y][x] = tile;
    }
  }
}

function paintPond(data: number[][]): void {
  const right = POND_LEFT + POND_WIDTH - 1;
  const bottom = POND_TOP + POND_HEIGHT - 1;

  data[POND_TOP][POND_LEFT] = CLASSIC_TILE.POND_BANK_NORTH_WEST;
  data[POND_TOP][right] = CLASSIC_TILE.POND_BANK_NORTH_EAST;
  data[bottom][POND_LEFT] = CLASSIC_TILE.POND_BANK_SOUTH_WEST;
  data[bottom][right] = CLASSIC_TILE.POND_BANK_SOUTH_EAST;

  paintRectangle(data, POND_LEFT + 1, POND_TOP, POND_WIDTH - 2, 1, CLASSIC_TILE.POND_BANK_NORTH);
  paintRectangle(data, POND_LEFT + 1, bottom, POND_WIDTH - 2, 1, CLASSIC_TILE.POND_BANK_SOUTH);
  paintRectangle(data, POND_LEFT, POND_TOP + 1, 1, POND_HEIGHT - 2, CLASSIC_TILE.POND_BANK_WEST);
  paintRectangle(data, right, POND_TOP + 1, 1, POND_HEIGHT - 2, CLASSIC_TILE.POND_BANK_EAST);
  paintRectangle(
    data,
    POND_LEFT + 1,
    POND_TOP + 1,
    POND_WIDTH - 2,
    POND_HEIGHT - 2,
    CLASSIC_TILE.POND_WATER,
  );
}

function placeTiles(data: number[][], tile: number, positions: readonly number[][]): void {
  for (const [x, y] of positions) {
    data[y][x] = tile;
  }
}

function buildCollisionLayer(
  ground: readonly number[][],
  details: readonly number[][],
): boolean[][] {
  return ground.map((row, y) =>
    row.map(
      (groundTile, x) =>
        SOLID_CLASSIC_TILES.has(groundTile) || SOLID_CLASSIC_TILES.has(details[y][x]),
    ),
  );
}

const PALLET_TALL_GRASS_ZONE: TallGrassZone = {
  x: TALL_GRASS_LEFT,
  y: TALL_GRASS_TOP,
  width: TALL_GRASS_WIDTH,
  height: TALL_GRASS_HEIGHT,
};

function createRoute1Map(): WorldMapDefinition {
  const width = 32;
  const height = 32;
  const tallGrassZones: readonly TallGrassZone[] = [{ x: 3, y: 8, width: 26, height: 15 }];
  const groundLayer = Array.from({ length: height }, () =>
    Array<number>(width).fill(CLASSIC_TILE.GRASS),
  );
  const tallGrassLayer = Array.from({ length: height }, () => Array<number>(width).fill(-1));
  const detailLayer = Array.from({ length: height }, () => Array<number>(width).fill(-1));

  paintRectangle(groundLayer, 7, 0, 2, height, CLASSIC_TILE.DIRT_PATH);
  for (const zone of tallGrassZones) {
    paintRectangle(groundLayer, zone.x, zone.y, zone.width, zone.height, CLASSIC_TILE.TALL_GRASS);
    paintRectangle(
      tallGrassLayer,
      zone.x,
      zone.y,
      zone.width,
      zone.height,
      CLASSIC_TILE.TALL_GRASS_TUFT,
    );
  }
  placeTiles(detailLayer, CLASSIC_TILE.TREE_RED, [
    [1, 3],
    [30, 4],
    [1, 12],
    [30, 16],
    [2, 26],
    [29, 28],
  ]);
  placeTiles(detailLayer, CLASSIC_TILE.TREE_LEAFY, [
    [2, 3],
    [29, 4],
    [2, 12],
    [29, 16],
    [3, 26],
    [28, 28],
  ]);
  placeTiles(detailLayer, CLASSIC_TILE.FLOWER_YELLOW, [
    [5, 5],
    [25, 6],
    [5, 25],
  ]);
  const warps: readonly MapWarp[] = [
    {
      source: { x: 7, y: 0 },
      destinationMapId: 'pallet-town',
      destination: { x: 7, y: 42 },
      facing: 'up',
      activation: 'step',
    },
    {
      source: { x: 7, y: height - 1 },
      destinationMapId: 'viridian-forest',
      destination: { x: 7, y: 1 },
      facing: 'down',
      activation: 'step',
    },
  ];
  sealUnlinkedMapEdges(detailLayer, warps);

  return {
    id: 'route-1',
    width,
    height,
    groundLayer,
    tallGrassLayer,
    detailLayer,
    collision: buildCollisionLayer(groundLayer, detailLayer),
    tallGrassZones,
    encounters: PALLET_TALL_GRASS,
    warps,
    entities: [],
    pois: poisForMap('route-1'),
    loot: [
      { id: 'route-1-poke-ball', position: { x: 5, y: 9 }, itemId: 'poke-ball', quantity: 2 },
      { id: 'route-1-potion', position: { x: 11, y: 15 }, itemId: 'potion', quantity: 1 },
      { id: 'route-1-great-ball', position: { x: 24, y: 20 }, itemId: 'great-ball', quantity: 1 },
    ],
  };
}

function createViridianForestMap(): WorldMapDefinition {
  const width = 32;
  const height = 36;
  const tallGrassZones: readonly TallGrassZone[] = [
    { x: 3, y: 8, width: 4, height: 16 },
    { x: 10, y: 12, width: 9, height: 14 },
    { x: 26, y: 5, width: 3, height: 22 },
  ];
  const groundLayer = Array.from({ length: height }, () =>
    Array<number>(width).fill(CLASSIC_TILE.GRASS),
  );
  const tallGrassLayer = Array.from({ length: height }, () => Array<number>(width).fill(-1));
  const detailLayer = Array.from({ length: height }, () => Array<number>(width).fill(-1));

  // A narrow north entrance opens into a fork, then bends east toward a
  // secluded southern clearing that serves as the forest's extraction point.
  paintRectangle(groundLayer, 7, 0, 2, 10, CLASSIC_TILE.DIRT_PATH);
  paintRectangle(groundLayer, 7, 9, 18, 2, CLASSIC_TILE.DIRT_PATH);
  paintRectangle(groundLayer, 23, 9, 2, height - 9, CLASSIC_TILE.DIRT_PATH);
  paintRectangle(groundLayer, 20, 31, 5, 2, CLASSIC_TILE.DIRT_PATH);
  for (const zone of tallGrassZones) {
    paintRectangle(groundLayer, zone.x, zone.y, zone.width, zone.height, CLASSIC_TILE.TALL_GRASS);
    paintRectangle(
      tallGrassLayer,
      zone.x,
      zone.y,
      zone.width,
      zone.height,
      CLASSIC_TILE.TALL_GRASS_TUFT,
    );
  }

  placeTiles(detailLayer, CLASSIC_TILE.TREE_RED, [
    [1, 1], [3, 1], [5, 1], [10, 1], [12, 1], [15, 1], [18, 1], [21, 1], [25, 1], [28, 1], [30, 1],
    [1, 5], [4, 5], [11, 5], [14, 5], [17, 5], [21, 5], [30, 6],
    [1, 10], [4, 11], [12, 8], [15, 8], [28, 10], [30, 12],
    [1, 16], [7, 15], [9, 17], [20, 15], [27, 17], [30, 18],
    [1, 22], [5, 25], [8, 24], [20, 23], [27, 24], [30, 25],
    [1, 29], [4, 31], [9, 30], [15, 31], [18, 33], [27, 31], [30, 32],
    [2, 34], [6, 34], [11, 34], [15, 34], [27, 34], [30, 34],
  ]);
  placeTiles(detailLayer, CLASSIC_TILE.TREE_LEAFY, [
    [2, 1], [4, 1], [6, 1], [11, 1], [13, 1], [16, 1], [19, 1], [22, 1], [26, 1], [29, 1],
    [2, 5], [5, 5], [12, 5], [15, 5], [18, 5], [22, 5], [29, 6],
    [2, 10], [5, 11], [13, 8], [16, 8], [29, 10], [29, 12],
    [2, 16], [6, 25], [9, 24], [19, 15], [28, 17], [29, 18],
    [2, 22], [6, 26], [7, 24], [21, 23], [28, 24], [29, 25],
    [2, 29], [5, 31], [10, 30], [16, 31], [19, 33], [28, 31], [29, 32],
    [3, 34], [7, 34], [12, 34], [16, 34], [28, 34], [29, 34],
  ]);
  placeTiles(detailLayer, CLASSIC_TILE.FLOWER_BLUE, [[10, 6], [20, 12], [25, 27]]);
  placeTiles(detailLayer, CLASSIC_TILE.FLOWER_RED, [[6, 14], [15, 28], [26, 29]]);
  placeTiles(detailLayer, CLASSIC_TILE.FLOWER_YELLOW, [[3, 27], [21, 7], [26, 14]]);
  const warps: readonly MapWarp[] = [
    {
      source: { x: 7, y: 0 },
      destinationMapId: 'route-1',
      destination: { x: 7, y: 30 },
      facing: 'up',
      activation: 'step',
    },
  ];
  sealUnlinkedMapEdges(detailLayer, warps);

  return {
    id: 'viridian-forest',
    width,
    height,
    groundLayer,
    tallGrassLayer,
    detailLayer,
    collision: buildCollisionLayer(groundLayer, detailLayer),
    tallGrassZones,
    encounters: VIRIDIAN_FOREST_TALL_GRASS,
    warps,
    entities: [],
    pois: poisForMap('viridian-forest'),
    loot: [
      { id: 'forest-poke-ball', position: { x: 4, y: 18 }, itemId: 'poke-ball', quantity: 2 },
      { id: 'forest-super-potion', position: { x: 14, y: 22 }, itemId: 'super-potion', quantity: 1 },
      { id: 'forest-great-ball', position: { x: 27, y: 21 }, itemId: 'great-ball', quantity: 1 },
      { id: 'forest-antidote', position: { x: 21, y: 30 }, itemId: 'antidote', quantity: 1 },
    ],
  };
}

function createFloodplainRelayMap(): WorldMapDefinition {
  const width = 32;
  const height = 32;
  const groundLayer = Array.from({ length: height }, () =>
    Array<number>(width).fill(CLASSIC_TILE.POND_WATER),
  );
  const tallGrassLayer = Array.from({ length: height }, () => Array<number>(width).fill(-1));
  const detailLayer = Array.from({ length: height }, () => Array<number>(width).fill(-1));

  // The centre road and west reed lane join twice, creating two deliberate
  // loops. The floodwater and fencing seal every apparent route that is not playable.
  paintRectangle(groundLayer, 14, 2, 3, 27, CLASSIC_TILE.DIRT_PATH);
  paintRectangle(groundLayer, 7, 8, 10, 2, CLASSIC_TILE.DIRT_PATH);
  paintRectangle(groundLayer, 7, 22, 10, 2, CLASSIC_TILE.DIRT_PATH);
  paintRectangle(groundLayer, 13, 4, 1, 1, CLASSIC_TILE.GRASS);
  paintRectangle(groundLayer, 6, 9, 3, 14, CLASSIC_TILE.TALL_GRASS);
  paintRectangle(tallGrassLayer, 6, 9, 3, 14, CLASSIC_TILE.TALL_GRASS_TUFT);
  paintRectangle(groundLayer, 9, 14, 6, 3, CLASSIC_TILE.TALL_GRASS);
  paintRectangle(tallGrassLayer, 9, 14, 6, 3, CLASSIC_TILE.TALL_GRASS_TUFT);

  // Floodwater makes the vault a committed east-side detour with one return.
  paintRectangle(groundLayer, 17, 7, 3, 2, CLASSIC_TILE.GRASS);
  paintRectangle(groundLayer, 17, 15, 12, 1, CLASSIC_TILE.DIRT_PATH);
  paintRectangle(groundLayer, 26, 14, 3, 3, CLASSIC_TILE.DIRT_PATH);
  paintRectangle(groundLayer, 19, 14, 1, 1, CLASSIC_TILE.GRASS);
  placeTiles(detailLayer, CLASSIC_TILE.TREE_RED, [
    [2, 3], [5, 4], [9, 3], [22, 3], [27, 5], [3, 14], [3, 25], [11, 27], [25, 25], [29, 27],
  ]);
  placeTiles(detailLayer, CLASSIC_TILE.TREE_LEAFY, [
    [3, 3], [6, 4], [10, 3], [23, 3], [28, 5], [2, 14], [4, 25], [12, 27], [24, 25], [28, 27],
  ]);
  placeTiles(detailLayer, CLASSIC_TILE.FLOWER_BLUE, [[11, 11], [18, 8], [23, 21]]);
  placeTiles(detailLayer, CLASSIC_TILE.FLOWER_YELLOW, [[4, 20], [18, 24], [27, 9]]);
  sealUnlinkedMapEdges(detailLayer, []);

  return {
    id: 'floodplain-relay',
    width,
    height,
    groundLayer,
    tallGrassLayer,
    detailLayer,
    collision: buildCollisionLayer(groundLayer, detailLayer),
    tallGrassZones: [
      { x: 6, y: 9, width: 3, height: 14 },
      { x: 9, y: 14, width: 6, height: 3 },
    ],
    encounters: PALLET_TALL_GRASS,
    warps: [],
    entities: [
      {
        id: 'floodplain-route-board',
        kind: 'sign',
        position: { x: 13, y: 4 },
        facing: 'down',
        dialogLines: [
          'FLOODPLAIN RELAY',
          'SOUTH GATE: dependable and open now.',
          'FERRY DOCK: departs on the next signal. RANGER RADIO: activate at the station.',
        ],
      },
      {
        id: 'vault-warning',
        kind: 'sign',
        position: { x: 19, y: 14 },
        facing: 'left',
        dialogLines: [
          'FLOODED SUPPLY VAULT',
          'High-value supplies inside. One narrow return through exposed water.',
          'Anything carried out banks only after extraction.',
        ],
      },
    ],
    pois: poisForMap('floodplain-relay'),
    loot: [
      { id: 'floodplain-potion', position: { x: 7, y: 12 }, itemId: 'potion', quantity: 1 },
      { id: 'floodplain-antidote', position: { x: 11, y: 15 }, itemId: 'antidote', quantity: 1 },
    ],
  };
}

export const WORLD_MAPS: Readonly<Record<WorldMapId, WorldMapDefinition>> = {
  'pallet-town': {
    id: 'pallet-town',
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    groundLayer: buildGroundLayerData(),
    tallGrassLayer: buildTallGrassLayerData(),
    detailLayer: buildDetailLayerData(),
    collision: buildCollisionData(),
    tallGrassZones: [PALLET_TALL_GRASS_ZONE],
    encounters: PALLET_TALL_GRASS,
    warps: [
      {
        source: { x: 7, y: MAP_HEIGHT - 1 },
        destinationMapId: 'route-1',
        destination: { x: 7, y: 1 },
        facing: 'down',
        activation: 'step',
      },
    ],
    entities: WORLD_ENTITIES,
    pois: poisForMap('pallet-town'),
    loot: [
      { id: 'pallet-town-poke-ball', position: { x: 10, y: 8 }, itemId: 'poke-ball', quantity: 1 },
      { id: 'pallet-town-potion', position: { x: 20, y: 14 }, itemId: 'potion', quantity: 1 },
      { id: 'pallet-town-antidote', position: { x: 26, y: 28 }, itemId: 'antidote', quantity: 1 },
    ],
  },
  'route-1': createRoute1Map(),
  'viridian-forest': createViridianForestMap(),
  'floodplain-relay': createFloodplainRelayMap(),
};

export function getWorldMap(id: WorldMapId): WorldMapDefinition {
  return WORLD_MAPS[id];
}

export function getWarpAt(
  map: WorldMapDefinition,
  position: GridPosition,
  activation: WarpActivation,
): MapWarp | undefined {
  return map.warps.find(
    (warp) =>
      warp.activation === activation &&
      warp.source.x === position.x &&
      warp.source.y === position.y,
  );
}

export function isTallGrassInMap(map: WorldMapDefinition, position: GridPosition): boolean {
  return map.tallGrassZones.some(
    (zone) =>
      position.x >= zone.x &&
      position.x < zone.x + zone.width &&
      position.y >= zone.y &&
      position.y < zone.y + zone.height,
  );
}

/**
 * An open boundary is a promise that the player can travel somewhere. Keep
 * only authored warp tiles open and close every other map edge with fencing.
 */
function sealUnlinkedMapEdges(details: number[][], warps: readonly MapWarp[]): void {
  const openTiles = new Set(warps.map((warp) => `${warp.source.x},${warp.source.y}`));
  const height = details.length;
  const width = details[0]?.length ?? 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if ((x !== 0 && x !== width - 1 && y !== 0 && y !== height - 1) || openTiles.has(`${x},${y}`)) {
        continue;
      }
      details[y][x] = CLASSIC_TILE.FENCE_MIDDLE;
    }
  }
}
