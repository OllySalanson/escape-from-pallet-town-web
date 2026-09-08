import { isSolidTerrain, type MapSketch, type TerrainChar } from './mapGrid';

/**
 * Tile indices into `public/assets/tileset.png` (8 columns, 16px tiles).
 *
 * The classic set ships a complete brown fence - horizontal runs, vertical runs
 * and two corners - even though the game long used only the three horizontal
 * pieces. Fenced plots are what makes a town readable as a network of yards
 * rather than one field, so the vertical and corner pieces are named here.
 */
export const CLASSIC_TILE = {
  GRASS: 46,
  TALL_GRASS: 47,
  /**
   * A low leafy fringe with a transparent top. Drawn over the tall-grass ground
   * tile it reads as grass you wade through - distinct from the round bush that
   * draws a tree, which matters now that whole maps are made of both.
   */
  TALL_GRASS_TUFT: 49,
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
  FENCE_VERTICAL: 80,
  FENCE_VERTICAL_BOTTOM: 86,
  FENCE_VERTICAL_TOP: 87,
  FENCE_CORNER_UP_RIGHT: 88,
  FENCE_CORNER_UP_LEFT: 90,
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
  CLASSIC_TILE.FENCE_VERTICAL,
  CLASSIC_TILE.FENCE_VERTICAL_BOTTOM,
  CLASSIC_TILE.FENCE_VERTICAL_TOP,
  CLASSIC_TILE.FENCE_CORNER_UP_RIGHT,
  CLASSIC_TILE.FENCE_CORNER_UP_LEFT,
]);

/**
 * The classic tileset ships no water art - its pond tiles are the same green as
 * grass - so open water reads as a lawn the player mysteriously cannot cross.
 * Multiplying the pond palette by this tint turns that green into deep water and
 * keeps the lighter bank tiles as a readable shoreline.
 */
export const WATER_TINT = 0x8073ff;

export const POND_TILES: ReadonlySet<number> = new Set([
  CLASSIC_TILE.POND_WATER,
  CLASSIC_TILE.POND_BANK_NORTH_WEST,
  CLASSIC_TILE.POND_BANK_NORTH,
  CLASSIC_TILE.POND_BANK_NORTH_EAST,
  CLASSIC_TILE.POND_BANK_WEST,
  CLASSIC_TILE.POND_BANK_EAST,
  CLASSIC_TILE.POND_BANK_SOUTH_WEST,
  CLASSIC_TILE.POND_BANK_SOUTH,
  CLASSIC_TILE.POND_BANK_SOUTH_EAST,
]);

export interface MapLayers {
  readonly groundLayer: number[][];
  readonly tallGrassLayer: number[][];
  readonly detailLayer: number[][];
  readonly collision: boolean[][];
  readonly tallGrass: boolean[][];
}

/** Turns a finished sketch into the four layers the world scene renders. */
export function buildMapLayers(sketch: MapSketch): MapLayers {
  const { width, height } = sketch;
  const surface = Array.from({ length: height }, (_unused, y) =>
    Array.from({ length: width }, (_column, x) => sketch.surfaceAt(x, y)),
  );
  const at = (x: number, y: number): TerrainChar | undefined => surface[y]?.[x];

  const groundLayer = blankLayer(width, height, CLASSIC_TILE.GRASS);
  const tallGrassLayer = blankLayer(width, height, -1);
  const detailLayer = blankLayer(width, height, -1);
  const collision = Array.from({ length: height }, () => Array<boolean>(width).fill(false));
  const tallGrass = Array.from({ length: height }, () => Array<boolean>(width).fill(false));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const terrain = surface[y][x];
      collision[y][x] = isSolidTerrain(terrain);
      switch (terrain) {
        case 'W':
          groundLayer[y][x] = pondTile(at, x, y);
          break;
        case 'T':
          detailLayer[y][x] = treeTile(x, y);
          break;
        case 'F':
          detailLayer[y][x] = fenceTile(at, x, y);
          break;
        case 'g':
          groundLayer[y][x] = CLASSIC_TILE.TALL_GRASS;
          tallGrassLayer[y][x] = CLASSIC_TILE.TALL_GRASS_TUFT;
          tallGrass[y][x] = true;
          break;
        case ',':
        case 'P':
          groundLayer[y][x] = CLASSIC_TILE.DIRT_PATH;
          break;
        case '.':
          break;
      }
    }
  }

  return { groundLayer, tallGrassLayer, detailLayer, collision, tallGrass };
}

function blankLayer(width: number, height: number, fill: number): number[][] {
  return Array.from({ length: height }, () => Array<number>(width).fill(fill));
}

/**
 * Hedges and woodland are the same material at two densities, so one scatter
 * rule draws both. It is a pure function of position, which keeps every build
 * of a map byte-identical.
 */
function treeTile(x: number, y: number): number {
  return (x * 7 + y * 5) % 9 === 0 ? CLASSIC_TILE.TREE_RED : CLASSIC_TILE.TREE_LEAFY;
}

type SurfaceLookup = (x: number, y: number) => TerrainChar | undefined;

/** Fences only read as fences when their runs have ends and corners. */
function fenceTile(at: SurfaceLookup, x: number, y: number): number {
  const north = at(x, y - 1) === 'F';
  const south = at(x, y + 1) === 'F';
  const east = at(x + 1, y) === 'F';
  const west = at(x - 1, y) === 'F';

  if (north && east && !west && !south) {
    return CLASSIC_TILE.FENCE_CORNER_UP_RIGHT;
  }
  if (north && west && !east && !south) {
    return CLASSIC_TILE.FENCE_CORNER_UP_LEFT;
  }
  if (east || west) {
    if (east && west) {
      return CLASSIC_TILE.FENCE_MIDDLE;
    }
    return east ? CLASSIC_TILE.FENCE_LEFT : CLASSIC_TILE.FENCE_RIGHT;
  }
  if (north || south) {
    if (north && south) {
      return CLASSIC_TILE.FENCE_VERTICAL;
    }
    return south ? CLASSIC_TILE.FENCE_VERTICAL_TOP : CLASSIC_TILE.FENCE_VERTICAL_BOTTOM;
  }
  return CLASSIC_TILE.FENCE_MIDDLE;
}

/**
 * Water banks are drawn where the water meets something else. Off-map counts as
 * water so a flooded map's boundary is open water rather than a painted rim.
 */
function pondTile(at: SurfaceLookup, x: number, y: number): number {
  const isWater = (nx: number, ny: number): boolean => {
    const terrain = at(nx, ny);
    return terrain === undefined || terrain === 'W';
  };
  const north = isWater(x, y - 1);
  const south = isWater(x, y + 1);
  const east = isWater(x + 1, y);
  const west = isWater(x - 1, y);

  if (!north && !west) return CLASSIC_TILE.POND_BANK_NORTH_WEST;
  if (!north && !east) return CLASSIC_TILE.POND_BANK_NORTH_EAST;
  if (!south && !west) return CLASSIC_TILE.POND_BANK_SOUTH_WEST;
  if (!south && !east) return CLASSIC_TILE.POND_BANK_SOUTH_EAST;
  if (!north) return CLASSIC_TILE.POND_BANK_NORTH;
  if (!south) return CLASSIC_TILE.POND_BANK_SOUTH;
  if (!west) return CLASSIC_TILE.POND_BANK_WEST;
  if (!east) return CLASSIC_TILE.POND_BANK_EAST;
  return CLASSIC_TILE.POND_WATER;
}
