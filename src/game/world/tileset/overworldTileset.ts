import type { PropCell, PropDefinition, TilesetCatalogue } from './catalogue';
import { OVERWORLD } from './sheets';

/**
 * ArMM1998's "Zelda-like tilesets and sprites" (`public/assets/Overworld.png`),
 * catalogued.
 *
 * The sheet is 40x36 tiles: 1073 drawn, 1012 of them distinct, against the 98
 * the game drew every map from before. It is CC0, it has shipped in this
 * repository since the first commit with nothing loading it, and the character
 * sheet the game already animates comes from the same pack - so adopting it is
 * what finally puts the figures and the ground they stand on in one drawing.
 * `public/assets/ASSET_PROVENANCE.md` carries the proof.
 *
 * Every index below was read off `docs/tilesets/overworld-contact-sheet.png`,
 * which `tools/tileset/contactSheet.mjs` regenerates for any sheet, and checked
 * on `tools/tileset/atlas.mts`, which draws this catalogue rather than the
 * sheet. Name the tile, never the number: `HEDGE.cornerNorthWest` can be caught
 * by the compiler and `521` cannot.
 *
 * What the sheet is good at, and what it is not, because it shapes every map
 * drawn from it. It is a *structure* sheet: hedges, cliffs, water, fences,
 * trees, bridges, buildings and props are complete and beautifully drawn, and
 * the water carries a full nine-piece foam shoreline. It has almost no
 * grass-to-earth transition art - three tiles on the whole sheet mix the two.
 * So earth and paving are laid where something holds their edge (a causeway
 * between two shorelines, a walled yard, a plank deck), never as a bare stripe
 * across open grass. That is how the sheet was drawn to be used.
 */

/** Reads a tile off the contact sheet by the column and row printed on it. */
const at = OVERWORLD.at;

// --- Ground -----------------------------------------------------------------

/**
 * Open grass. Eleven tiles differ only in where the tufts fall, which is what
 * keeps a bank from reading as wallpaper - used sparingly, because a sheet's
 * variants spent evenly read as noise, which is its own kind of generated.
 */
const GRASS = {
  fill: at(5, 10),
  variants: [at(5, 9), at(6, 9), at(6, 10), at(0, 29), at(2, 29), at(0, 31), at(2, 31)],
} as const;

/** Trodden earth: the causeway, and any lane worn by use. */
const EARTH = {
  fill: at(12, 13),
  variants: [at(12, 14), at(2, 32), at(13, 14), at(14, 14)],
} as const;

/** Laid cobble - a yard, a station apron, a gate road. */
const PAVING = {
  fill: at(13, 15),
  variants: [at(14, 15), at(13, 16), at(14, 16)],
} as const;

/** Timber decking: a jetty, a boardwalk, the deck of a bridge. */
const BOARDWALK = {
  fill: at(16, 21),
  variants: [at(6, 7), at(9, 7)],
} as const;

/** A crossing where the flood runs shallow enough to wade. */
const FORD = {
  fill: at(15, 6),
} as const;

// --- Water ------------------------------------------------------------------

/**
 * Open water. Eleven tiles of it, every one on the same `#1e7cb8` base, so a
 * whole map of flood has a surface instead of a flat blue field - which is
 * exactly what the last playtest said was wrong with this one.
 */
const WATER = {
  fill: at(3, 7),
  variants: [
    at(0, 1),
    at(1, 1),
    at(2, 1),
    at(3, 1),
    at(0, 2),
    at(1, 2),
    at(2, 2),
    at(3, 2),
    at(18, 6),
    at(19, 6),
    at(20, 6),
  ],
} as const;

/**
 * The foam rim, drawn on the land side of the shoreline exactly as the sheet
 * draws it: nine pieces for the four sides, the four inside corners where land
 * juts into water, and the four diagonal touches. `buildMapLayers` lays these
 * automatically wherever ground meets water, so no map ever names one - which
 * is the whole of "no bare seam where water meets land".
 */
const SHORE = {
  waterSouth: at(3, 6),
  waterNorth: at(3, 8),
  waterEast: at(2, 7),
  waterWest: at(4, 7),
  waterNorthWest: at(2, 9),
  waterNorthEast: at(3, 9),
  waterSouthWest: at(2, 10),
  waterSouthEast: at(3, 10),
  diagonalSouthEast: at(2, 6),
  diagonalSouthWest: at(4, 6),
  diagonalNorthEast: at(2, 8),
  diagonalNorthWest: at(4, 8),
} as const;

// --- Walls ------------------------------------------------------------------

/**
 * The hedge: the one complete nine-slice on the sheet, with corners, edges, a
 * one-tile vertical run and a one-tile horizontal one.
 */
const HEDGE = {
  cornerNorthWest: at(1, 13),
  edgeNorth: at(2, 13),
  cornerNorthEast: at(3, 13),
  edgeWest: at(1, 14),
  fill: at(2, 14),
  edgeEast: at(3, 14),
  cornerSouthWest: at(1, 15),
  edgeSouth: at(2, 15),
  cornerSouthEast: at(3, 15),
  runVerticalTop: at(0, 14),
  runVerticalBottom: at(0, 15),
  runHorizontalLeft: at(0, 16),
  runHorizontalRight: at(1, 16),
} as const;

/**
 * Growth you wade through. It stands on the same ground as a lane and says what
 * it is with a leafy fringe over the top, so the difference between a wall and
 * a lane is the silhouette - a hedge is a rounded mass with corners, tall grass
 * is a one-tile fringe - rather than a tint applied to the same art.
 */
const REEDS = {
  fringeLeft: at(0, 16),
  fringeRight: at(1, 16),
} as const;

/** Woodland as a mass. A single tree is a prop; this is the wall of the wood. */
const WOOD = {
  fill: at(6, 18),
  variants: [at(7, 18), at(6, 16)],
  edgeSouth: at(5, 19),
} as const;

/** Rock face - the only wall on the sheet that reads as height. */
const CLIFF = {
  fill: at(5, 13),
  variants: [at(4, 13), at(6, 13)],
  edgeNorth: at(5, 12),
  edgeSouth: at(5, 14),
} as const;

/** Post and rail: the one wall you can see straight through. */
const FENCE = {
  rail: at(3, 17),
  cornerNorthWest: at(2, 17),
  cornerNorthEast: at(4, 17),
  postTop: at(0, 17),
  postBottom: at(0, 18),
} as const;

/** A building's wall, in the sheet's dark timber. */
const WALL = {
  fill: at(8, 1),
  variants: [at(9, 1), at(7, 1)],
} as const;

// --- Props ------------------------------------------------------------------

const nothing: PropCell = { tile: -1, solid: false };

/**
 * A block of art lifted straight off the sheet, as a rectangle of tiles.
 *
 * Most props are a rectangle of a building or a structure, so saying where it
 * starts and how big it is beats spelling out every cell. `holes` are the cells
 * that let the ground show through, and `walkable` the cells a player may stand
 * on - a doorway, the deck of a bridge, the lip of a fountain.
 */
function block(
  label: string,
  column: number,
  row: number,
  width: number,
  height: number,
  options: {
    readonly holes?: readonly (readonly [number, number])[];
    readonly walkable?: readonly (readonly [number, number])[];
    /** Rows drawn over the figures, so the player passes behind them. */
    readonly canopyRows?: number;
  } = {},
): PropDefinition {
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
        tile: at(column + x, row + y),
        solid: !walkable.has(key),
        ...(options.canopyRows !== undefined && y < options.canopyRows ? { canopy: true } : {}),
      });
    }
  }
  return { label, width, height, cells };
}

const PROPS = {
  // --- Buildings ------------------------------------------------------------
  /** A timber house with a door you stand in front of. The relay's own quarters. */
  house: block('house', 6, 0, 5, 5),
  /** A barn with doors wide enough for a boat. The Landing's boathouse. */
  barn: block('boathouse', 12, 0, 4, 5),
  /** A one-room shed. Cheap to scatter and it reads as somebody's. */
  hut: block('hut', 13, 5, 2, 3),
  /** A round stone tower, open at the top. The beacon on the rocks. */
  tower: block('stone tower', 0, 21, 3, 7),
  /** A roundhouse under a conical roof: the relay's own signal house. */
  roundhouse: block('roundhouse', 3, 22, 3, 6),
  /** A stone gatehouse with a passage through it. The way into a walled yard. */
  gatehouse: block('gatehouse', 26, 22, 4, 6, { walkable: [[1, 5], [2, 5]] }),
  /** A cellar mouth in a stone frame: the vault's own door. */
  cellarDoors: block('cellar doors', 31, 5, 2, 2),
  /** A tunnel driven into rock. */
  culvert: block('culvert mouth', 33, 5, 2, 2),
  /** A stone arch over a road. The south gate itself. */
  gateArch: block('gate arch', 10, 31, 4, 3, { walkable: [[1, 2], [2, 2]] }),
  /** The old stone bridge, towered at both ends, crossed down the middle. */
  stoneBridge: block('stone bridge', 20, 29, 4, 4, {
    walkable: [[1, 0], [2, 0], [1, 1], [2, 1], [1, 2], [2, 2], [1, 3], [2, 3]],
  }),

  // --- Structures -----------------------------------------------------------
  /** A footbridge you walk across, laid north to south. */
  bridgeVertical: block('footbridge', 6, 6, 2, 3, {
    walkable: [[0, 1], [1, 1], [0, 2], [1, 2]],
  }),
  /** The same, laid east to west. */
  bridgeHorizontal: block('footbridge', 8, 6, 3, 3, {
    walkable: [[1, 1], [1, 2], [2, 1], [2, 2]],
  }),
  fountain: block('fountain', 26, 9, 3, 3),
  wellHead: block('well', 33, 3, 2, 2),
  /** A market stall under a striped awning, open at the front. */
  marketStall: block('market stall', 18, 22, 5, 4, {
    holes: [[1, 3], [2, 3], [3, 3]],
  }),
  stallCounter: block('stall counter', 21, 20, 5, 2),
  produceStall: block('produce stall', 23, 20, 3, 2),
  haystack: block('haystack', 31, 3, 2, 2),
  /** A banner on a pole - the relay flew them along the causeway. */
  banner: block('banner', 5, 27, 2, 2),
  flag: block('flag', 4, 29, 2, 2),

  // --- Growing things -------------------------------------------------------
  /**
   * A tree. Its crown is drawn over whoever walks behind it and only the trunk
   * row is solid, which is what makes a wood feel like somewhere you are inside
   * rather than a hedge with leaves on.
   */
  tree: block('tree', 5, 16, 2, 2, { canopyRows: 1 }),
  /** A bigger tree, three across, for the stands that anchor a district. */
  bigTree: block('tree', 5, 16, 3, 3, { canopyRows: 2 }),
  stump: block('stump', 0, 12, 1, 1),
  deadStump: block('stump', 1, 12, 1, 1),
  log: block('fallen log', 3, 5, 3, 1),

  // --- Rock and water -------------------------------------------------------
  rockSmall: block('rock', 6, 5, 1, 1),
  rock: block('rock', 7, 5, 1, 1),
  rockPair: block('rocks', 8, 5, 2, 1),
  boulder: block('boulder', 35, 5, 2, 2),
  wetRock: block('rock', 11, 7, 2, 2),
  lilies: block('lilies', 3, 0, 1, 1, { walkable: [[0, 0]] }),
  liliesWide: block('lilies', 4, 0, 2, 1, { walkable: [[0, 0], [1, 0]] }),

  // --- Things people left ---------------------------------------------------
  signpost: block('sign', 34, 2, 1, 1),
  signboard: block('notice board', 35, 2, 2, 1),
  barrel: block('barrel', 33, 1, 1, 1),
  barrelPair: block('barrels', 33, 1, 2, 1),
  crate: block('crate', 30, 0, 1, 2),
  cratePair: block('crates', 30, 0, 2, 2),
  crateStack: block('crates', 35, 8, 2, 2),
  sack: block('sack', 32, 0, 1, 1),
  mooringPost: block('mooring post', 36, 0, 1, 2, { holes: [[0, 0]] }),
  bench: block('bench', 28, 4, 3, 2),
  potPlant: block('planter', 32, 1, 1, 1),
  flowersWhite: block('flowers', 3, 11, 1, 1, { walkable: [[0, 0]] }),
  flowersWide: block('flowers', 3, 12, 1, 1, { walkable: [[0, 0]] }),
} as const satisfies Record<string, PropDefinition>;

export type OverworldPropName = keyof typeof PROPS;

/**
 * The object library on its own.
 *
 * Houses, bridges, crates, signposts, fountains and trees from this sheet stand
 * happily on another family's ground - the proof is that the game's own figures
 * already do - so the props are exported apart from the materials, and a
 * catalogue can take its ground from one sheet and its objects from here.
 */
export const OVERWORLD_PROPS = PROPS;

export const OVERWORLD_TILESET: TilesetCatalogue<OverworldPropName> = {
  sources: [OVERWORLD.source],
  shore: {
    material: 'water',
    onlyOver: ['grass', 'tall-grass'],
    tiles: SHORE,
  },
  materials: {
    grass: { roles: { fill: GRASS.fill }, fillVariants: [...GRASS.variants], variantRarity: 6 },
    'tall-grass': {
      overlay: true,
      roles: { fill: REEDS.fringeLeft },
      fillVariants: [REEDS.fringeRight],
      variantRarity: 2,
    },
    turf: { roles: { fill: GRASS.fill }, fillVariants: [...GRASS.variants], variantRarity: 3 },
    earth: { roles: { fill: EARTH.fill }, fillVariants: [...EARTH.variants], variantRarity: 5 },
    sand: { roles: { fill: FORD.fill } },
    beach: { roles: { fill: FORD.fill } },
    paving: { roles: { fill: PAVING.fill }, fillVariants: [...PAVING.variants], variantRarity: 3 },
    stone: {
      roles: { fill: BOARDWALK.fill },
      fillVariants: [...BOARDWALK.variants],
      variantRarity: 4,
    },
    gravel: { roles: { fill: EARTH.fill } },
    ford: { roles: { fill: FORD.fill } },
    water: {
      roles: { fill: WATER.fill },
      fillVariants: [...WATER.variants],
      variantRarity: 4,
    },
    hedge: {
      overlay: true,
      roles: {
        fill: HEDGE.fill,
        'edge-n': HEDGE.edgeNorth,
        'edge-s': HEDGE.edgeSouth,
        'edge-e': HEDGE.edgeEast,
        'edge-w': HEDGE.edgeWest,
        'corner-nw': HEDGE.cornerNorthWest,
        'corner-ne': HEDGE.cornerNorthEast,
        'corner-sw': HEDGE.cornerSouthWest,
        'corner-se': HEDGE.cornerSouthEast,
        'run-v': HEDGE.runVerticalTop,
        'cap-n': HEDGE.runVerticalTop,
        'cap-s': HEDGE.runVerticalBottom,
        'run-h': HEDGE.runHorizontalLeft,
        'cap-w': HEDGE.runHorizontalLeft,
        'cap-e': HEDGE.runHorizontalRight,
        single: HEDGE.runHorizontalLeft,
      },
    },
    tree: {
      overlay: true,
      roles: { fill: WOOD.fill, 'edge-s': WOOD.edgeSouth },
      fillVariants: [...WOOD.variants],
      variantRarity: 3,
    },
    cliff: {
      roles: { fill: CLIFF.fill, 'edge-n': CLIFF.edgeNorth, 'edge-s': CLIFF.edgeSouth },
      fillVariants: [...CLIFF.variants],
      variantRarity: 4,
    },
    fence: {
      overlay: true,
      roles: {
        fill: FENCE.rail,
        'edge-n': FENCE.rail,
        'edge-s': FENCE.rail,
        'edge-e': FENCE.rail,
        'edge-w': FENCE.rail,
        'run-h': FENCE.rail,
        'run-v': FENCE.postTop,
        'corner-nw': FENCE.cornerNorthWest,
        'corner-ne': FENCE.cornerNorthEast,
        'corner-sw': FENCE.cornerNorthWest,
        'corner-se': FENCE.cornerNorthEast,
        'cap-n': FENCE.postTop,
        'cap-s': FENCE.postBottom,
        'cap-w': FENCE.cornerNorthWest,
        'cap-e': FENCE.cornerNorthEast,
        single: FENCE.postTop,
      },
    },
    wall: { roles: { fill: WALL.fill }, fillVariants: [...WALL.variants], variantRarity: 3 },
  },
  props: PROPS,
};
