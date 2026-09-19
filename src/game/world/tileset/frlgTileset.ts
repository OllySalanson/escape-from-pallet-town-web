import {
  FRLG_MATERIALS,
  FRLG_NINE_SLICES,
  FRLG_OBJECTS,
  FRLG_SHEET_COLUMNS,
  FRLG_SHEET_ROWS,
  FRLG_TILES,
  FRLG_TILES_TEXTURE,
  frlgMaterialTileIndex,
  frlgNineSliceTileIndex,
  frlgTileIndex,
  type MaterialBlock,
  type SheetCell,
  type SheetRegion,
} from '../frlgSheet';
import type { MaterialTiles, PropCell, PropDefinition, TilesetCatalogue } from './catalogue';
import { tileReader } from './catalogue';

/**
 * The FireRed/LeafGreen terrain sheet, catalogued.
 *
 * This is the sheet the maps are drawn on. Its whole value over the 104-tile
 * set that came before is transition art: every ground material arrives as a
 * thirteen-tile block - a solid, four edges, four outside corners and the four
 * *inside* corners a nine-slice cannot draw - which is exactly the role set
 * `autotile.ts` reads off a tile's eight neighbours. So a lane turns a corner
 * here instead of ending in a rectangular step, and no map ever names an edge.
 *
 * `src/game/world/frlgSheet.ts` is the addressing layer and the authority on
 * where things sit; this file says what they *are*. Its provenance, and the
 * captain's decision to accept ripped commercial art knowingly, are in
 * `public/assets/ASSET_PROVENANCE.md`.
 */

const SHEET = tileReader(
  {
    textureKey: FRLG_TILES_TEXTURE,
    imagePath: 'assets/frlg-tiles.png',
    columns: FRLG_SHEET_COLUMNS,
    rows: FRLG_SHEET_ROWS,
  },
  2000,
);

const index = (cell: SheetCell): number => SHEET.source.firstIndex + frlgTileIndex(cell);

/**
 * A ground material with its complete edge block.
 *
 * The sheet names an edge after the side it faces - `west` is the tile whose
 * western neighbour is something else - which is the same thing `edge-w` means
 * here, so the mapping is one to one and there is nowhere for a corner to get
 * transposed.
 */
function ground(block: MaterialBlock, extra: Partial<MaterialTiles> = {}): MaterialTiles {
  const cell = (name: Parameters<typeof frlgMaterialTileIndex>[1]): number =>
    SHEET.source.firstIndex + frlgMaterialTileIndex(block, name);
  return {
    roles: {
      fill: cell('solid'),
      'edge-w': cell('west'),
      'edge-e': cell('east'),
      'edge-n': cell('north'),
      'edge-s': cell('south'),
      'corner-sw': cell('southWest'),
      'corner-se': cell('southEast'),
      'corner-nw': cell('northWest'),
      'corner-ne': cell('northEast'),
      'inner-se': cell('innerSouthEast'),
      'inner-sw': cell('innerSouthWest'),
      'inner-ne': cell('innerNorthEast'),
      'inner-nw': cell('innerNorthWest'),
    },
    ...extra,
  };
}

/**
 * A nine-slice material: corners and edges but no inside corners, so it draws a
 * convex patch and nothing else. Water and the tall-grass bed are both drawn
 * that way, which is why a reed bed wants to be a bed rather than a one-tile
 * stripe.
 */
function nineSlice(origin: SheetCell, extra: Partial<MaterialTiles> = {}): MaterialTiles {
  const cell = (name: Parameters<typeof frlgNineSliceTileIndex>[1]): number =>
    SHEET.source.firstIndex + frlgNineSliceTileIndex(origin, name);
  return {
    roles: {
      fill: cell('solid'),
      'edge-w': cell('west'),
      'edge-e': cell('east'),
      'edge-n': cell('north'),
      'edge-s': cell('south'),
      'corner-sw': cell('southWest'),
      'corner-se': cell('southEast'),
      'corner-nw': cell('northWest'),
      'corner-ne': cell('northEast'),
    },
    ...extra,
  };
}

const nothing: PropCell = { tile: -1, solid: false };

/**
 * An object lifted whole off the sheet. There is no edge set and no autotiling:
 * a caller places the whole footprint or none of it.
 */
function object(
  label: string,
  region: SheetRegion,
  options: {
    readonly holes?: readonly (readonly [number, number])[];
    readonly walkable?: readonly (readonly [number, number])[];
    /** Rows drawn over the figures, so the player passes behind them. */
    readonly canopyRows?: number;
    /** Take only part of the footprint, from its top-left. */
    readonly width?: number;
    readonly height?: number;
    /** Start this far into the footprint. */
    readonly offsetX?: number;
    readonly offsetY?: number;
  } = {},
): PropDefinition {
  const width = options.width ?? region.width;
  const height = options.height ?? region.height;
  const offsetX = options.offsetX ?? 0;
  const offsetY = options.offsetY ?? 0;
  const holes = new Set((options.holes ?? []).map(([x, y]) => `${x},${y}`));
  const walkable = new Set((options.walkable ?? []).map(([x, y]) => `${x},${y}`));
  const cells: PropCell[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const key = `${x},${y}`;
      if (holes.has(key)) {
        cells.push(nothing);
        continue;
      }
      cells.push({
        tile: index({ column: region.column + offsetX + x, row: region.row + offsetY + y }),
        solid: !walkable.has(key),
        ...(options.canopyRows !== undefined && y < options.canopyRows ? { canopy: true } : {}),
      });
    }
  }
  return { label, width, height, cells };
}

/** A single tile standing on its own. */
function single(label: string, cell: SheetCell, solid = true): PropDefinition {
  return { label, width: 1, height: 1, cells: [{ tile: index(cell), solid }] };
}

const PROPS = {
  // --- Woodland -------------------------------------------------------------
  /**
   * A broadleaf tree. FireRed draws one as 3x3 with the trunk on the bottom
   * row. The top of the crown is drawn *over* the figures and left walkable, so
   * a lane can pass behind a tree and the player is covered by it; everything
   * below the crown is solid. That one row is the difference between a wood you
   * are inside and a hedge with leaves on.
   */
  tree: object('tree', FRLG_OBJECTS.TREE_BROAD_A, { canopyRows: 1 }),
  treeAlt: object('tree', FRLG_OBJECTS.TREE_BROAD_B, { canopyRows: 1 }),
  pine: object('pine', FRLG_OBJECTS.TREE_PINE_A, { canopyRows: 1 }),
  pineAlt: object('pine', FRLG_OBJECTS.TREE_PINE_B, { canopyRows: 1 }),
  /** A stacked run of canopy: a wall of wood rather than a single tree. */
  treeWall: object('woodland', FRLG_OBJECTS.TREE_COLUMN, { canopyRows: 1 }),
  tallBush: object('bush', FRLG_OBJECTS.TALL_BUSH, { canopyRows: 1 }),
  bush: single('bush', FRLG_TILES.BUSH),

  // --- Rock and water -------------------------------------------------------
  cliffFace: object('cliff', FRLG_OBJECTS.CLIFF_FACE),
  /** The one-way drop. Directional: these are not interchangeable. */
  ledge: object('ledge', FRLG_OBJECTS.LEDGE_RUN),
  boulders: object('boulders', FRLG_OBJECTS.BOULDERS),
  boulder: object('boulder', FRLG_OBJECTS.BOULDERS, { width: 2, height: 2 }),
  rock: single('rock', FRLG_TILES.ROCK),

  // --- Built ----------------------------------------------------------------
  /** A shop front with its door. The relay's own office. */
  building: object('building', FRLG_OBJECTS.BUILDING_SHOP),
  marketStall: object('market stall', FRLG_OBJECTS.MARKET_STALL),
  awning: object('awning', FRLG_OBJECTS.AWNING),
  fountain: object('fountain', FRLG_OBJECTS.FOUNTAIN),
  plazaSteps: object('steps', FRLG_OBJECTS.PLAZA_STEPS),
  /** A bridge you cross: its deck is walkable, its rails are not. */
  bridge: object('bridge', FRLG_OBJECTS.BRIDGE, {
    walkable: [
      [1, 0], [2, 0],
      [1, 1], [2, 1],
      [1, 2], [2, 2],
      [1, 3], [2, 3],
      [1, 4], [2, 4],
    ],
  }),
  crates: object('crates', FRLG_OBJECTS.CRATES),
  crate: single('crate', FRLG_TILES.CRATE),
  fencePost: single('fence', FRLG_TILES.FENCE_WOOD),
  railPost: single('railing', FRLG_TILES.FENCE_RAIL),
  signpost: single('sign', FRLG_TILES.SIGN_ROUTE),
  noticeBoard: single('notice board', FRLG_TILES.SIGN_BOARD),
  pot: single('pot', FRLG_TILES.POT),
  planter: single('planter', FRLG_TILES.PLANTER),
} as const satisfies Record<string, PropDefinition>;

export type FrlgPropName = keyof typeof PROPS;

export const FRLG_TILESET: TilesetCatalogue<FrlgPropName> = {
  sources: [SHEET.source],
  materials: {
    grass: {
      roles: { fill: index(FRLG_TILES.GRASS) },
      // Three accents, spent sparingly: a sheet's variants used evenly read as
      // noise, which is its own kind of generated.
      fillVariants: [
        index(FRLG_TILES.GRASS_TUFTED),
        index(FRLG_TILES.GRASS_FLOWERS),
        index(FRLG_TILES.GRASS_PLANT),
      ],
      variantRarity: 11,
    },
    turf: ground(FRLG_MATERIALS.TURF),
    'tall-grass': nineSlice(FRLG_NINE_SLICES.TALL_GRASS),
    earth: ground(FRLG_MATERIALS.DIRT),
    sand: ground(FRLG_MATERIALS.SAND),
    // Beach is drawn against surf rather than grass, so it belongs at the
    // waterline and nowhere else: laid inland it is a shoreline with no shore.
    beach: ground(FRLG_MATERIALS.BEACH),
    paving: ground(FRLG_MATERIALS.PAVING),
    stone: ground(FRLG_MATERIALS.STONE_BRICK),
    gravel: ground(FRLG_MATERIALS.GRAVEL),
    ford: nineSlice(FRLG_NINE_SLICES.WATER_SHALLOW),
    // No variant. The sheet's other open-water tile is a flatter blue than the
    // nine-slice's fill, so spending it as an accent lays a visible lattice of
    // dark diamonds across the whole river - which is the exact failure the
    // last playtest called "one flat blue texture", arrived at from the other
    // direction. The wave fill carries the surface on its own.
    water: nineSlice(FRLG_NINE_SLICES.WATER_DEEP),
    // The sheet's hedges and tall grass are two-row beds, so there is no
    // one-tile hedge on it. The 1x1 bush is the stand-in, and a hedge is drawn
    // as a mass rather than as a line.
    hedge: { overlay: true, roles: { fill: index(FRLG_TILES.BUSH) } },
    tree: { overlay: true, roles: { fill: index(FRLG_TILES.BUSH) } },
    // The sheet's cliff is a 6x6 object with grass on top and a face below, not
    // a material with an edge set, so it is a prop. What `cliff` draws is the
    // single rock: always solid, always reads as stone, and it takes an edge
    // from nothing - which is right, because rock on this sheet has no edges.
    cliff: { overlay: true, roles: { fill: index(FRLG_TILES.ROCK) } },
    fence: { overlay: true, roles: { fill: index(FRLG_TILES.FENCE_WOOD) } },
    wall: (() => {
      const shop = FRLG_OBJECTS.BUILDING_SHOP;
      const at = (column: number, row: number): number =>
        index({ column: shop.column + column, row: shop.row + row });
      return { roles: { fill: at(1, 2), 'edge-n': at(1, 1), 'edge-s': at(1, 3) } };
    })(),
  },
  props: PROPS,
};
