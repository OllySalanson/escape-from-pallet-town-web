import { FRLG_TILESET } from './frlgTileset';
import { frlgTileIndex, type SheetCell } from '../frlgSheet';
import {
  tileReader,
  withDoorway,
  type MaterialTiles,
  type PropCell,
  type PropDefinition,
  type TilesetCatalogue,
} from './catalogue';
import { KANTO_PIECES, KANTO_SHEET, type KantoPieceName } from '../generated/kantoPieces';

/**
 * Kanto as FireRed draws it: the route conifer, the grey post-and-rail, the
 * dotted town paving, and Viridian's own buildings.
 *
 * The maps before this one were drawn on `FLOOD_TOWN_TILESET`, and it shows:
 * the FireRed ground sheet has one building and no route tree, so its woods
 * are 3x3 broadleaf standing in a lattice of one-tile bushes, and its towns are
 * CC0 timber houses. Neither is Kanto. Everything here was cut out of FireRed's
 * own maps (`scripts/cut-frlg-kanto.mjs`) and is used the way those maps use
 * it, so a town drawn on this reads as the town it is named after.
 *
 * The ground still comes from `frlg-tiles.png` - sand, turf, earth, the tall
 * grass, the ponds - because those are the same FireRed tiles, and the cut
 * script puts the new sheet's colours on that sheet's footing so the two meet
 * without a seam. What is new is drawn by rule rather than role where FireRed
 * draws it that way: the wood stands on its lattice (`lattice.ts`), the grass
 * is a weave of four tiles, fence uprights sit on the side of their corner and
 * rock stands in mounds. Provenance: `public/assets/ASSET_PROVENANCE.md`.
 */
export const KANTO_SHEET_SOURCE = tileReader(
  {
    textureKey: 'frlgKanto',
    imagePath: KANTO_SHEET.imagePath,
    columns: KANTO_SHEET.columns,
    rows: KANTO_SHEET.rows,
  },
  // Clear of every other sheet: classic from 0, Overworld from 1000, the
  // FireRed ground from 3000 and the base from 5000.
  6000,
);

/** One cell of a named piece, as a tile number in the shared index space. */
function piece(name: KantoPieceName, dx = 0, dy = 0): number {
  const at = KANTO_PIECES[name];
  if (dx < 0 || dy < 0 || dx >= at.width || dy >= at.height) {
    throw new Error(`cell ${dx},${dy} is outside '${name}'`);
  }
  return KANTO_SHEET_SOURCE.at(at.column + dx, at.row + dy);
}

/** A cell of the FireRed ground sheet this one is drawn beside. */
const FRLG_FIRST = FRLG_TILESET.sources[0].firstIndex;
const ground = (cell: SheetCell): number => FRLG_FIRST + frlgTileIndex(cell);

/**
 * A named piece as a landmark, its collision drawn beside it in the shape it
 * has on screen: `#` a wall, `.` ground, `^` ground the piece hangs over and
 * is drawn above the figures on - a roof's top edge, which FireRed lets you
 * walk behind - and `-` a cell of the piece left out.
 */
function pieceProp(name: KantoPieceName, label: string, mask: readonly string[]): PropDefinition {
  const at = KANTO_PIECES[name];
  if (mask.length !== at.height || mask.some((row) => row.length !== at.width)) {
    throw new Error(`the collision drawn for '${name}' is not ${at.width}x${at.height}`);
  }
  const cells: PropCell[] = [];
  for (let y = 0; y < at.height; y += 1) {
    for (let x = 0; x < at.width; x += 1) {
      const mark = mask[y][x];
      if (mark === '-') {
        cells.push({ tile: -1, solid: false });
      } else if (mark === '^') {
        cells.push({ tile: piece(name, x, y), solid: false, canopy: true, walkedUnder: true });
      } else {
        cells.push({ tile: piece(name, x, y), solid: mark === '#' });
      }
    }
  }
  return { label, width: at.width, height: at.height, cells };
}

/** A single cell of a piece, standing on its own. */
function cellProp(label: string, tile: number, solid: boolean): PropDefinition {
  return { label, width: 1, height: 1, cells: [{ tile, solid }] };
}

const paving: MaterialTiles = {
  roles: {
    fill: piece('paving.fill'),
    'edge-n': piece('paving.n'),
    'edge-s': piece('paving.s'),
    'edge-w': piece('paving.w'),
    'edge-e': piece('paving.e'),
    'corner-nw': piece('paving.nw'),
    'corner-ne': piece('paving.ne'),
    'corner-sw': piece('paving.sw'),
    'corner-se': piece('paving.se'),
    'inner-nw': piece('paving.innerNw'),
    'inner-ne': piece('paving.innerNe'),
    'inner-sw': piece('paving.innerSw'),
    'inner-se': piece('paving.innerSe'),
  },
};

const shrub = piece('shrub');

/** The rock mound's six rows, with the cave mouth in its foot filled back in. */
const MOUND = Array.from({ length: 6 }, (_row, y) =>
  Array.from({ length: 8 }, (_column, x) => piece('rock', y === 5 && x === 4 ? 3 : x, y)),
);

const PROPS = {
  // --- Standing things -----------------------------------------------------------
  /** A round bush: one tile of wall, and the undergrowth a wood thins out into. */
  shrub: cellProp('bush', shrub, true),
  /** A bed of red flowers. Walked through, as FireRed's are. */
  flowers: cellProp('flowers', piece('flowers'), false),
  signTown: cellProp('sign', piece('signTown'), true),
  signTips: cellProp('sign', piece('signTips'), true),
  signGym: pieceProp('signGym', 'sign', ['^', '#']),
  /** The small tree Cut clears. */
  cutTree: cellProp('small tree', piece('cutTree'), true),
  /** The mouth of a cave in a mound's foot: the one tile of it that is ground. */
  caveMouth: cellProp('cave', piece('rock', 4, 5), false),

  // --- Buildings -------------------------------------------------------------------
  // The top row of every roof hangs over the ground behind the building, as it
  // does in FireRed: walk along the back of the Pokemon Center and its roof is
  // drawn over your feet. The door is a wall here; a map that means a door to be
  // gone through opens it with `withDoorway`.
  pokemonCenter: pieceProp('pokemonCenter', 'Pokemon Center', [
    '^^^^^',
    '#####',
    '#####',
    '#####',
    '#####',
  ]),
  pokeMart: pieceProp('pokeMart', 'Poke Mart', ['^^^^', '####', '####', '####']),
  gym: pieceProp('gym', 'Gym', ['^^^^^^', '######', '######', '######', '######']),
  house: pieceProp('house', 'house', ['^^^^^', '#####', '#####', '#####']),
  /** The same house with window boxes either side of its step. */
  houseFlowers: pieceProp('houseFlowers', 'house', [
    '^^^^^',
    '#####',
    '#####',
    '#####',
    '#.###',
  ]),
  cottage: pieceProp('cottage', 'cottage', ['^^^^^', '#####', '#####']),
  /** The long gatehouse on the road to Viridian Forest, with its steps. */
  forestGate: pieceProp('forestGate', 'gatehouse', [
    '########',
    '########',
    '########',
    '########',
    '########',
    '########',
    '###..###',
    '##....##',
  ]),
  /** The short gatehouse, open to a path behind it and steps in front. */
  routeGate: pieceProp('routeGate', 'gatehouse', [
    '#....#',
    '######',
    '######',
    '######',
    '######',
    '##..##',
    '#....#',
  ]),
  /** The Pokemon League Front Gate. Its roof runs on out of sight above it. */
  leagueGate: pieceProp('leagueGate', 'League gate', [
    '#########',
    '#########',
    '#########',
    '#########',
    '#########',
    '####.####',
    '#.......#',
  ]),
} as const satisfies Record<string, PropDefinition>;

/**
 * The same buildings with their door open: a doorway is a pocket the player
 * steps into, which is how a landmark at a door is worked and how an exit in a
 * gatehouse is left by. Filler houses keep a shut door - FireRed leaves most of
 * its houses without one you can use, and a town where every door opens is a
 * town where none of them means anything.
 */
const DOORS = {
  pokemonCenterDoor: withDoorway(PROPS.pokemonCenter, [[2, 4]]),
  pokeMartDoor: withDoorway(PROPS.pokeMart, [[2, 3]]),
  houseDoor: withDoorway(PROPS.house, [[1, 3]]),
  cottageDoor: withDoorway(PROPS.cottage, [[3, 2]]),
} as const satisfies Record<string, PropDefinition>;

export type KantoPropName = keyof typeof PROPS | keyof typeof DOORS | keyof typeof FRLG_TILESET.props;

export const KANTO_TILESET: TilesetCatalogue<KantoPropName> = {
  sources: [...FRLG_TILESET.sources, KANTO_SHEET_SOURCE.source],
  materials: {
    ...FRLG_TILESET.materials,
    // Four tiles, two by two, exactly as Route 1 lays them.
    grass: {
      roles: { fill: piece('grass.plain') },
      weave: [
        [piece('grass.blades'), piece('grass.bladesEast')],
        [piece('grass.plain'), piece('grass.tuft')],
      ],
    },
    paving,
    tree: {
      overlay: true,
      floor: 'grass',
      roles: { fill: piece('tree.bodyWest') },
      lattice: {
        tip: [piece('tree.tipWest'), piece('tree.tipEast')],
        body: [piece('tree.bodyWest'), piece('tree.bodyEast')],
        bodyEdge: [piece('tree.bodyEdgeWest'), piece('tree.bodyEdgeEast')],
        overlap: [piece('tree.overlapWest'), piece('tree.overlapEast')],
        overlapEdge: [piece('tree.overlapEdgeWest'), piece('tree.overlapEdgeEast')],
        base: [piece('tree.baseWest'), piece('tree.baseEast')],
        baseEdge: [piece('tree.baseEdgeWest'), piece('tree.baseEdgeEast')],
        stray: shrub,
      },
    },
    // FireRed's hedge is a clipped strip one tile deep with a rounded end each
    // side - Cerulean's, and Route 24's.
    hedge: {
      overlay: true,
      floor: 'grass',
      roles: {
        fill: ground({ column: 7, row: 6 }),
        'run-h': ground({ column: 7, row: 6 }),
        'cap-w': ground({ column: 6, row: 6 }),
        'cap-e': ground({ column: 8, row: 6 }),
        single: shrub,
      },
    },
    cliff: {
      overlay: true,
      floor: 'grass',
      roles: { fill: MOUND[2][2] },
      mound: MOUND,
    },
    fence: {
      overlay: true,
      roles: {
        fill: piece('fence.run'),
        'run-h': piece('fence.run'),
        'cap-e': piece('fence.run'),
        'cap-w': piece('fence.run'),
        'corner-nw': piece('fence.nw'),
        'corner-ne': piece('fence.ne'),
        'corner-sw': piece('fence.sw'),
        'corner-se': piece('fence.se'),
        single: piece('fence.nw'),
      },
      railSides: {
        west: piece('fence.west'),
        east: piece('fence.east'),
        capWest: piece('fence.nw'),
        capEast: piece('fence.ne'),
      },
    },
  },
  props: { ...FRLG_TILESET.props, ...PROPS, ...DOORS },
  shore: FRLG_TILESET.shore,
};
