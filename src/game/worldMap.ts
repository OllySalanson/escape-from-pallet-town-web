export const TILE_SIZE = 16;
export const MAP_WIDTH = 32;
export const MAP_HEIGHT = 44;

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

  return data;
}

export function buildCollisionData(): boolean[][] {
  const ground = buildGroundLayerData();
  const details = buildDetailLayerData();

  return ground.map((row, y) =>
    row.map((groundTile, x) => SOLID_CLASSIC_TILES.has(groundTile) || SOLID_CLASSIC_TILES.has(details[y][x])),
  );
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
