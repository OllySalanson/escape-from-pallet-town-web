import { floorPiece, pieceProp, pieceTile, roomCatalogue, solidPiece } from '../../base/baseSheet';
import type { BasePieceName } from '../../base/generated/basePieces';
import type { PropDefinition, TilesetCatalogue } from './catalogue';

/**
 * What the inside of a building on a player's map is drawn from.
 *
 * A room is two materials, exactly as the base's rooms are (`roomCatalogue`):
 * `paving` (`P`) is the floor and `wall` (`B`) is the back wall, whose lower
 * row carries the skirting. Nothing beyond the room is drawn, so a room stands
 * in the dark the way a FireRed room does. What changes from one room to the
 * next is its **style** - which FireRed room its floor and walls are cut from -
 * and the furniture standing in it, which is the same set whatever the style,
 * because a bookcase is a bookcase in Oak's lab and in Bill's house.
 *
 * Every piece is one the base already cut from FireRed (`frlg-base.png`), so a
 * player's house is furnished from the same art as the player's own base.
 */

export type InsideStyle = 'house' | 'lab' | 'center' | 'warehouse';

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
} as const satisfies Record<string, PropDefinition>;

export type InsidePropName = keyof typeof INSIDE_PROPS;

interface StyleArt {
  readonly shell: {
    readonly floor: BasePieceName;
    readonly floorShade: BasePieceName;
    readonly wallUpper: BasePieceName;
    readonly wallLower: BasePieceName;
  };
  readonly mat: InsidePropName;
}

const STYLE_ART: Readonly<Record<InsideStyle, StyleArt>> = {
  house: {
    shell: {
      floor: 'bill.floor',
      floorShade: 'bill.floorShade',
      wallUpper: 'bill.wallUpper',
      wallLower: 'bill.wallLower',
    },
    mat: 'houseMat',
  },
  lab: {
    shell: {
      floor: 'lab.floor',
      floorShade: 'lab.floorShade',
      wallUpper: 'lab.wallUpper',
      wallLower: 'lab.wallLower',
    },
    mat: 'labMat',
  },
  center: {
    // The Center's floor has no shade of its own along the wall. Its walls are
    // set in `styleCatalogue`, because the base never cut them as tiles.
    shell: {
      floor: 'pc.floor',
      floorShade: 'pc.floor',
      wallUpper: 'pc.floor',
      wallLower: 'pc.floor',
    },
    mat: 'centerMat',
  },
  warehouse: {
    shell: {
      floor: 'warehouse.floor',
      floorShade: 'warehouse.floorShade',
      wallUpper: 'warehouse.wallUpper',
      wallLower: 'warehouse.wallLower',
    },
    mat: 'warehouseMat',
  },
};

function styleCatalogue(style: InsideStyle): TilesetCatalogue<InsidePropName> {
  const art = STYLE_ART[style];
  const catalogue = roomCatalogue(art.shell, INSIDE_PROPS);
  if (style !== 'center') {
    return catalogue;
  }
  // The Center's walls are the plain run of its counter piece: the stretch
  // between the television and the PC, which is wall and nothing else.
  return {
    ...catalogue,
    materials: {
      ...catalogue.materials,
      wall: {
        roles: { fill: pieceTile('pc.back', 10, 0), 'edge-s': pieceTile('pc.back', 10, 1) },
      },
    },
  };
}

export const INSIDE_STYLES: readonly InsideStyle[] = ['house', 'lab', 'center', 'warehouse'];

export const INSIDE_TILESETS: Readonly<Record<InsideStyle, TilesetCatalogue<InsidePropName>>> =
  Object.fromEntries(INSIDE_STYLES.map((style) => [style, styleCatalogue(style)])) as Record<
    InsideStyle,
    TilesetCatalogue<InsidePropName>
  >;

/** The mat a style's way out is drawn as. */
export function insideMat(style: InsideStyle): InsidePropName {
  return STYLE_ART[style].mat;
}
