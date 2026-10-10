import {
  BASE_SHEET_SOURCE,
  floorPiece,
  pieceProp,
  pieceTile,
  solidPiece,
} from '../../base/baseSheet';
import type { BasePieceName } from '../../base/generated/basePieces';
import { AREA_SHEET_SOURCE, areaFloorProp, areaProp, areaTile } from './areaSheet';
import type { MaterialTiles, PropDefinition, TilesetCatalogue } from './catalogue';
import type { Material } from './materials';

/**
 * What the inside of a building on a player's map is drawn from.
 *
 * A room is two materials, as the base's rooms are: `paving` (`P`) is the
 * floor and `wall` (`B`) is the back wall, whose lower row carries the
 * skirting. Nothing beyond the room is drawn, so a room stands in the dark the
 * way a FireRed room does. What changes from one room to the next is its
 * **style** - which FireRed room its floor and walls are - and what stands in
 * it.
 *
 * Two kinds of furniture. The FireRed house's pieces were cut from the top
 * layer of the game's own metatiles (`scripts/cut-frlg-areas.mjs`), where
 * FireRed keeps them clear of the floor, so they stand on any floor in any
 * style. Everything else - a staircase, a rug, a Mart's fixtures and every
 * piece the base cut from its renders - was drawn with its room's floor under
 * it, and is only offered in a room of that style (`maker/palette.ts`).
 */

export type InsideStyle = 'house' | 'mart' | 'cottage' | 'lab' | 'center' | 'warehouse';

export const INSIDE_PROPS = {
  computers: solidPiece('lab.computers', 'computers'),
  bookshelves: solidPiece('lab.wallShelves', 'bookshelves'),
  machine: pieceProp('lab.machine', 'machine', ['###', '###', '.##']),
  table: solidPiece('lab.table', 'table'),
  shelvesWest: solidPiece('lab.shelvesWest', 'bookshelves'),
  shelvesEast: solidPiece('lab.shelvesEast', 'bookshelves'),
  shelvesEmpty: solidPiece('lab.shelvesEmpty', 'shelves'),
  plant: solidPiece('lab.plant', 'plant'),
  plantEast: solidPiece('lab.plantEast', 'plant'),
  tallPlant: solidPiece('pc.plant', 'plant'),
  bed: solidPiece('house.bed', 'bed'),
  centerCounter: pieceProp('pc.back', 'counter', [
    '###############',
    '###############',
    '###############',
    '#...#######...#',
    '#.............#',
  ]),
  centerWallWest: solidPiece('pc.sideWest', 'wall'),
  centerWallEast: solidPiece('pc.sideEast', 'wall'),
  emblem: floorPiece('pc.emblem', 'floor'),
  seats: solidPiece('pc.lounge', 'seats'),
  healingMachine: solidPiece('pc.healingMachine', 'healing machine'),
  pillar: solidPiece('bill.pillar', 'pillar'),
  separators: solidPiece('bill.separators', 'cell separators'),
  pc: solidPiece('bill.pc', 'PC'),
  desk: solidPiece('bill.desk', 'desk'),
  housePlant: solidPiece('bill.plant', 'plant'),
  crate: solidPiece('bill.box', 'crate'),
  books: solidPiece('bill.books', 'books'),
  drawer: solidPiece('bill.drawer', 'drawers'),
  generator: pieceProp('warehouse.generator', 'generator', ['###', '###', '###', '...']),
  telephone: solidPiece('warehouse.phone', 'telephone'),
  vent: solidPiece('warehouse.vent', 'vent'),
  bigCrate: solidPiece('warehouse.crate', 'crate'),
  radioSet: solidPiece('warehouse.terminals', 'radio set'),
  stool: solidPiece('warehouse.stool', 'stool'),
  monitors: solidPiece('warehouse.monitorDesk', 'monitors'),
  workbench: solidPiece('warehouse.table', 'workbench'),
  sofa: solidPiece('warehouse.sofa', 'sofa'),
  bunk: solidPiece('warehouse.bed', 'bunk'),
  box: solidPiece('warehouse.box', 'box'),
  boxStack: pieceProp('warehouse.boxStack', 'boxes', ['#', '#', '.']),
  tallBox: solidPiece('warehouse.boxSingle', 'box'),
  // The way out of a room, in each style's own colours. Three tiles wide and
  // walked over; its middle tile is the one you stand on to leave.
  labMat: floorPiece('lab.mat', 'door mat'),
  houseMat: floorPiece('bill.mat', 'door mat'),
  centerMat: floorPiece('pc.mat', 'door mat'),
  warehouseMat: floorPiece('warehouse.mat', 'door mat'),

  // --- FireRed's own house: stands on any floor ------------------------------
  window: areaProp('house.window', 'window'),
  cupboard: areaProp('house.cupboard', 'cupboard'),
  television: areaProp('house.tv', 'television'),
  kitchenSink: areaProp('house.sink', 'sink'),
  smallRug: areaFloorProp('house.rugSmall', 'rug'),
  diningTable: areaProp('house.tableSet', 'table'),
  pottedPlant: areaProp('house.plant', 'plant'),
  computerDesk: areaProp('house.pcDesk', 'PC'),
  tallDrawers: areaProp('house.drawers', 'drawers'),
  bookshelf: areaProp('house.bookshelf', 'bookshelf'),
  notice: areaProp('house.notice', 'notice'),
  // The bed is drawn across the middle of three columns, half a tile into
  // each side one, and its pillow's top edge is in the row above it: only the
  // bed itself is solid.
  singleBed: areaProp('house.bed', 'bed', ['...', '.#.', '.#.']),
  // --- and what the house draws on its own floor ------------------------------
  stairsUp: areaProp('house.stairsUp', 'stairs'),
  stairsDown: areaProp('house.stairsDown', 'stairs'),
  rug: areaFloorProp('house.rug', 'rug'),
  fireRedHouseMat: areaFloorProp('house.mat', 'door mat'),

  // --- the Poké Mart ---------------------------------------------------------
  martCounter: areaProp('mart.counter', 'counter', ['...', '###']),
  martTill: areaProp('mart.till', 'counter'),
  martCase: areaProp('mart.case', 'glass case', ['..', '##']),
  martRack: areaProp('mart.rack', 'shelves'),
  martRacks: areaProp('mart.racks', 'shelves'),
  martFridges: areaProp('mart.fridges', 'fridges'),
  martWallShelves: areaProp('mart.wallShelves', 'shelves'),
  martPlant: areaProp('mart.plant', 'plant'),
  martPoster: areaProp('mart.poster', 'poster'),
  martWallWest: areaProp('mart.sideWest', 'wall'),
  martWallEast: areaProp('mart.sideEast', 'wall'),
  martCornerWest: areaProp('mart.cornerWest', 'wall'),
  martCornerEast: areaProp('mart.cornerEast', 'wall'),
  martMat: areaFloorProp('mart.mat', 'door mat'),
} as const satisfies Record<string, PropDefinition>;

export type InsidePropName = keyof typeof INSIDE_PROPS;

/** A room's floor and back wall, as the tiles each role is drawn with. */
interface StyleArt {
  readonly floor: MaterialTiles;
  readonly wall: MaterialTiles;
  readonly mat: InsidePropName;
}

/** A shell from the base's sheet: a floor shaded under the wall, and two rows of wall. */
function baseShell(
  floor: BasePieceName,
  floorShade: BasePieceName,
  wallUpper: BasePieceName,
  wallLower: BasePieceName,
  mat: InsidePropName,
): StyleArt {
  return {
    floor: { roles: { fill: pieceTile(floor), 'edge-n': pieceTile(floorShade) } },
    wall: { roles: { fill: pieceTile(wallUpper), 'edge-s': pieceTile(wallLower) } },
    mat,
  };
}

const STYLE_ART: Readonly<Record<InsideStyle, StyleArt>> = {
  // FireRed's own house. Its parquet is shaded under the back wall and down
  // the west side, and the west side is the room's own edge, so the edge of
  // the room counts as something the floor stops against (`edgesAtMapEdge`) -
  // the south and east sides have no shade of their own and fall back to the
  // plain floor.
  house: {
    floor: {
      roles: {
        fill: areaTile('house.floor'),
        'edge-n': areaTile('house.floorShade'),
        'edge-w': areaTile('house.floorShade'),
        'corner-nw': areaTile('house.floorShade'),
      },
      edgesAtMapEdge: true,
    },
    wall: { roles: { fill: areaTile('house.wallUpper'), 'edge-s': areaTile('house.wallLower') } },
    mat: 'fireRedHouseMat',
  },
  mart: {
    floor: { roles: { fill: areaTile('mart.floor'), 'edge-n': areaTile('mart.floorShade') } },
    wall: { roles: { fill: areaTile('mart.wallUpper'), 'edge-s': areaTile('mart.wallLower') } },
    mat: 'martMat',
  },
  // Bill's house, which the base's own cottage is: grey walls over boards.
  cottage: baseShell('bill.floor', 'bill.floorShade', 'bill.wallUpper', 'bill.wallLower', 'houseMat'),
  lab: baseShell('lab.floor', 'lab.floorShade', 'lab.wallUpper', 'lab.wallLower', 'labMat'),
  // The Center's floor has no shade of its own along the wall, and its walls
  // are the plain run of its counter piece: the stretch between the television
  // and the PC, which is wall and nothing else.
  center: {
    floor: { roles: { fill: pieceTile('pc.floor') } },
    wall: { roles: { fill: pieceTile('pc.back', 10, 0), 'edge-s': pieceTile('pc.back', 10, 1) } },
    mat: 'centerMat',
  },
  warehouse: baseShell(
    'warehouse.floor',
    'warehouse.floorShade',
    'warehouse.wallUpper',
    'warehouse.wallLower',
    'warehouseMat',
  ),
};

/** Every material but the wall is the floor: a room uses two, and the catalogue asks for all sixteen. */
function styleCatalogue(style: InsideStyle): TilesetCatalogue<InsidePropName> {
  const art = STYLE_ART[style];
  const floors = Object.fromEntries(
    (
      [
        'grass',
        'turf',
        'tall-grass',
        'earth',
        'sand',
        'beach',
        'paving',
        'stone',
        'gravel',
        'ford',
        'water',
        'hedge',
        'tree',
        'cliff',
        'fence',
      ] as const
    ).map((material) => [material, art.floor]),
  ) as Record<Exclude<Material, 'wall'>, MaterialTiles>;
  return {
    sources: [BASE_SHEET_SOURCE.source, AREA_SHEET_SOURCE.source],
    materials: { ...floors, wall: art.wall },
    props: INSIDE_PROPS,
  };
}

export const INSIDE_STYLES: readonly InsideStyle[] = [
  'house',
  'mart',
  'cottage',
  'lab',
  'center',
  'warehouse',
];

export const INSIDE_TILESETS: Readonly<Record<InsideStyle, TilesetCatalogue<InsidePropName>>> =
  Object.fromEntries(INSIDE_STYLES.map((style) => [style, styleCatalogue(style)])) as Record<
    InsideStyle,
    TilesetCatalogue<InsidePropName>
  >;

/** The mat a style's way out is drawn as. */
export function insideMat(style: InsideStyle): InsidePropName {
  return STYLE_ART[style].mat;
}
