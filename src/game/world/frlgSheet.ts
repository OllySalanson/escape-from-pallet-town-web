/**
 * What is in `public/assets/frlg-tiles.png`, and where.
 *
 * This is a description of an asset, not behaviour: plain constants, no logic.
 * It is the addressing layer every consumer reads instead of counting tiles off
 * the image. `frlgSheet.test.ts` holds it to the art.
 *
 * The sheet is cut from Pokemon FireRed/LeafGreen rips - see
 * `public/assets/ASSET_PROVENANCE.md` for the source and the publisher's terms.
 * It was rearranged on the way in, so a coordinate here means nothing on the
 * original sheets.
 *
 * ## Why this sheet exists
 *
 * The 104-tile `classicTiles` sheet has no transition art at all: every
 * boundary it can draw is a rectangular step, which is why a map built from it
 * reads as stamped rather than drawn. The value here is not the tile count, it
 * is that eight ground materials arrive with a complete edge set - the four
 * inner corners included, which is what lets a path turn a corner.
 *
 * ## The grid
 *
 * 16x16 tiles on a plain 16px pitch with no margin or spacing, so Phaser loads
 * it exactly as it loads `classicTiles`:
 *
 * ```ts
 * map.addTilesetImage(FRLG_TILES_TEXTURE, FRLG_TILES_TEXTURE, TILE_SIZE, TILE_SIZE);
 * ```
 *
 * A tile index is `row * FRLG_SHEET_COLUMNS + column`.
 */

/** The texture key `BootScene` loads the sheet under. */
export const FRLG_TILES_TEXTURE = 'frlgTiles';

/** Columns in `frlg-tiles.png`. Multiply by `TILE_SIZE` for the pixel width. */
export const FRLG_SHEET_COLUMNS = 20;

/** Rows in `frlg-tiles.png`. */
export const FRLG_SHEET_ROWS = 31;

/** A tile's position in the sheet, in tiles. */
export interface SheetCell {
  readonly column: number;
  readonly row: number;
}

/** A rectangular region of the sheet, in tiles. */
export interface SheetRegion extends SheetCell {
  readonly width: number;
  readonly height: number;
}

/**
 * The thirteen cells of a ground material, by the neighbour case each one
 * draws. A material is laid out as a solid at its origin plus a 4x3 of edges
 * immediately to its right:
 *
 * ```
 *   column:   +0       +1     +2     +3     +4
 *   row +0:   solid    west   east   north  south
 *   row +1:            sw     se     nw     ne
 *   row +2:            innerSe innerSw innerNe innerNw
 * ```
 *
 * `west` is the tile to use when the neighbour to the *west* is not this
 * material - that is, the material's own western edge. The four `inner`
 * cells cover a diagonal neighbour missing while all four orthogonals are
 * present, which is the case a nine-slice cannot draw and the reason a path
 * drawn with this material turns a corner cleanly.
 */
export interface MaterialBlock {
  /** What the material is called on the sheet. */
  readonly name: string;
  /** Where the solid cell sits; the edges follow at `column + 1`. */
  readonly origin: SheetCell;
  /**
   * What this material's edges are drawn against. Every material here meets
   * grass except `BEACH`, whose edges are surf - laying it against grass shows
   * a shoreline with no shore.
   */
  readonly meets: 'grass' | 'water';
}

/** Offsets from a material's origin to each of its thirteen cells. */
export const MATERIAL_CELL_OFFSETS = {
  solid: { column: 0, row: 0 },
  west: { column: 1, row: 0 },
  east: { column: 2, row: 0 },
  north: { column: 3, row: 0 },
  south: { column: 4, row: 0 },
  southWest: { column: 1, row: 1 },
  southEast: { column: 2, row: 1 },
  northWest: { column: 3, row: 1 },
  northEast: { column: 4, row: 1 },
  innerSouthEast: { column: 1, row: 2 },
  innerSouthWest: { column: 2, row: 2 },
  innerNorthEast: { column: 3, row: 2 },
  innerNorthWest: { column: 4, row: 2 },
} as const satisfies Record<string, SheetCell>;

export type MaterialCell = keyof typeof MATERIAL_CELL_OFFSETS;

/** Every ground material on the sheet, each with a complete edge set. */
export const FRLG_MATERIALS = {
  SAND: { name: 'SAND', origin: { column: 0, row: 0 }, meets: 'grass' },
  TURF: { name: 'TURF', origin: { column: 5, row: 0 }, meets: 'grass' },
  DIRT: { name: 'DIRT', origin: { column: 10, row: 0 }, meets: 'grass' },
  SNOW: { name: 'SNOW', origin: { column: 15, row: 0 }, meets: 'grass' },
  PAVING: { name: 'PAVING', origin: { column: 0, row: 3 }, meets: 'grass' },
  STONE_BRICK: { name: 'STONE_BRICK', origin: { column: 5, row: 3 }, meets: 'grass' },
  GRAVEL: { name: 'GRAVEL', origin: { column: 10, row: 3 }, meets: 'grass' },
  BEACH: { name: 'BEACH', origin: { column: 15, row: 3 }, meets: 'water' },
} as const satisfies Record<string, MaterialBlock>;

export type FrlgMaterialName = keyof typeof FRLG_MATERIALS;

/**
 * Offsets from a nine-slice's origin. A nine-slice has no inner corners, so it
 * draws a convex patch and nothing else - which is all the water rings and the
 * tall-grass bed were drawn to do.
 */
export const NINE_SLICE_CELL_OFFSETS = {
  northWest: { column: 0, row: 0 },
  north: { column: 1, row: 0 },
  northEast: { column: 2, row: 0 },
  west: { column: 0, row: 1 },
  solid: { column: 1, row: 1 },
  east: { column: 2, row: 1 },
  southWest: { column: 0, row: 2 },
  south: { column: 1, row: 2 },
  southEast: { column: 2, row: 2 },
} as const satisfies Record<string, SheetCell>;

export type NineSliceCell = keyof typeof NINE_SLICE_CELL_OFFSETS;

/**
 * The 3x3 nine-slices. `WATER_SHALLOW` and `WATER_DEEP` carry their own earth
 * bank, so they are a whole pond rather than a fill that needs a shore drawn
 * round it. `TALL_GRASS` is the encounter grass: it is drawn as a raised bed
 * with a lip, so a one-tile-wide run of it reads as a stripe - it wants to be
 * at least two tiles deep.
 */
export const FRLG_NINE_SLICES = {
  WATER_SHALLOW: { column: 0, row: 6 },
  WATER_DEEP: { column: 3, row: 6 },
  TALL_GRASS: { column: 6, row: 6 },
} as const satisfies Record<string, SheetCell>;

export type FrlgNineSliceName = keyof typeof FRLG_NINE_SLICES;

/**
 * Objects bigger than one tile, with the footprint each one occupies.
 *
 * These are drawn whole - there is no edge set and no autotiling. A caller
 * places the whole region or none of it, and the tiles carry their own ground
 * shading, so they want `GRASS` underneath rather than a different material.
 *
 * Note the trees: FireRed draws a broadleaf as 3x3 with the trunk on the bottom
 * row, so a tree is not a one-tile wall. `BUSH` in `FRLG_TILES` is the 1x1
 * stand-in for a map that needs a solid single tile.
 */
export const FRLG_OBJECTS = {
  TREE_BROAD_A: { column: 0, row: 9, width: 3, height: 3 },
  TREE_BROAD_B: { column: 3, row: 9, width: 3, height: 3 },
  /** A stacked run of canopy - a forest wall rather than a single tree. */
  TREE_COLUMN: { column: 6, row: 9, width: 3, height: 9 },
  TREE_PINE_A: { column: 9, row: 9, width: 2, height: 3 },
  TREE_PINE_B: { column: 11, row: 9, width: 2, height: 3 },
  TALL_BUSH: { column: 13, row: 9, width: 1, height: 3 },
  /** The one-way drop-down edges. Directional: these are not interchangeable. */
  LEDGE_RUN: { column: 14, row: 9, width: 4, height: 5 },
  CLIFF_FACE: { column: 0, row: 18, width: 6, height: 6 },
  MARKET_STALL: { column: 6, row: 18, width: 3, height: 3 },
  FOUNTAIN: { column: 9, row: 18, width: 2, height: 2 },
  AWNING: { column: 11, row: 18, width: 3, height: 2 },
  BUILDING_SHOP: { column: 14, row: 18, width: 4, height: 4 },
  PLAZA_STEPS: { column: 0, row: 24, width: 5, height: 6 },
  BOULDERS: { column: 5, row: 24, width: 6, height: 3 },
  BRIDGE: { column: 11, row: 24, width: 4, height: 5 },
  CRATES: { column: 15, row: 24, width: 4, height: 3 },
} as const satisfies Record<string, SheetRegion>;

export type FrlgObjectName = keyof typeof FRLG_OBJECTS;

/**
 * Single tiles. `GRASS` is the ground everything else is drawn over - every
 * object tile bakes this exact green into its own transparent corners, so a
 * different ground under a tree shows as a square.
 */
export const FRLG_TILES = {
  GRASS: { column: 0, row: 30 },
  GRASS_TUFTED: { column: 1, row: 30 },
  GRASS_FLOWERS: { column: 2, row: 30 },
  GRASS_PLANT: { column: 3, row: 30 },
  BUSH: { column: 4, row: 30 },
  ROCK: { column: 5, row: 30 },
  FENCE_WOOD: { column: 6, row: 30 },
  FENCE_RAIL: { column: 7, row: 30 },
  SIGN_ROUTE: { column: 8, row: 30 },
  SIGN_BOARD: { column: 9, row: 30 },
  POT: { column: 10, row: 30 },
  PLANTER: { column: 11, row: 30 },
  CRATE: { column: 12, row: 30 },
  WATER_OPEN: { column: 13, row: 30 },
  SAND_SOLID: { column: 14, row: 30 },
} as const satisfies Record<string, SheetCell>;

export type FrlgTileName = keyof typeof FRLG_TILES;

/** The tile index Phaser addresses a cell by. */
export function frlgTileIndex(cell: SheetCell): number {
  return cell.row * FRLG_SHEET_COLUMNS + cell.column;
}

/** The index of one cell of a ground material. */
export function frlgMaterialTileIndex(material: MaterialBlock, cell: MaterialCell): number {
  const offset = MATERIAL_CELL_OFFSETS[cell];

  return frlgTileIndex({
    column: material.origin.column + offset.column,
    row: material.origin.row + offset.row,
  });
}

/** The index of one cell of a nine-slice. */
export function frlgNineSliceTileIndex(origin: SheetCell, cell: NineSliceCell): number {
  const offset = NINE_SLICE_CELL_OFFSETS[cell];

  return frlgTileIndex({ column: origin.column + offset.column, row: origin.row + offset.row });
}

/** Every tile index an object covers, in reading order. */
export function frlgObjectTileIndices(region: SheetRegion): number[] {
  const indices: number[] = [];
  for (let row = 0; row < region.height; row += 1) {
    for (let column = 0; column < region.width; column += 1) {
      indices.push(frlgTileIndex({ column: region.column + column, row: region.row + row }));
    }
  }

  return indices;
}
