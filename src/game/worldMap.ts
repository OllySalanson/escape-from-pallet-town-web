export const TILE_SIZE = 16;
export const MAP_WIDTH = 26;
export const MAP_HEIGHT = 20;

export const CLASSIC_TILE = {
  GRASS: 46,
  DIRT_PATH: 44,
  TREE_RED: 40,
  TREE_LEAFY: 41,
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

const POND_LEFT = 12;
const POND_TOP = 2;
const POND_WIDTH = 7;
const POND_HEIGHT = 6;

export function buildGroundLayerData(): number[][] {
  const data = createLayer(CLASSIC_TILE.GRASS);

  paintRectangle(data, 7, 0, 2, MAP_HEIGHT, CLASSIC_TILE.DIRT_PATH);
  paintRectangle(data, 7, 10, MAP_WIDTH - 7, 2, CLASSIC_TILE.DIRT_PATH);
  paintPond(data);

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

  return data;
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
