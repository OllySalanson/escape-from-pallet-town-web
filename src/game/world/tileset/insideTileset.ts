import {
  BASE_SHEET_SOURCE,
  floorPiece,
  pieceProp,
  pieceTile,
  solidPiece,
} from '../../base/baseSheet';
import type { BasePieceName } from '../../base/generated/basePieces';
import { AREA_WEAVE_GROUND, AREA_WEAVES } from '../generated/areaPieces';
import { AREA_SHEET_SOURCE, areaFloorProp, areaProp, areaTile } from './areaSheet';
import { ICE_SHEET_SOURCE, iceProp, iceTile } from './iceSheet';
import { EMBER_SHEET_SOURCE, emberProp, emberTile } from './emberSheet';
import { HIDEOUT_SHEET_SOURCE, hideoutProp, hideoutTile } from './hideoutSheet';
import type { HideoutPieceName } from '../generated/hideoutPieces';
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
 *
 * A cave is the same thing in rock: Mt. Moon's floor, its sand (`d`) and its
 * rock (`B`), which is an overlay - FireRed draws every face of it on the top
 * layer, over the floor or the sand alike - and turns the corners of a room
 * with joints of its own.
 *
 * And a room need not be a box: `C` is the dark beyond its walls, drawn as
 * nothing and walked by nobody, which is how FireRed's own rooms are cut - the
 * gatehouse walked through west to east is dark down both sides but for the
 * mat let into each, which hangs over it.
 *
 * A tunnel is the Underground Path, laid cell for cell as FireRed lays it
 * (`AREA_WEAVES`): its floor fades from planks to blue to red and back down
 * its length, and every rivet of its walls is where the game puts one. Floor
 * and wall join each other, so neither draws an edge of its own and both are
 * the weave everywhere.
 *
 * A tower floor is the same thing for Lavender Town's Pokemon Tower: the round
 * room every one of its floors is, its stepped walls and its shaded floor laid
 * cell for cell from FireRed's own, with the graves, the statues, the stairs
 * and the way out standing on it as FireRed stands them.
 *
 * The Rocket Hideout is FireRed's own rooms in the dark, drawn as FireRed
 * draws them: the dark beside a room (`C`) carries the white rule of its
 * border, the last row of floor carries the rule along its foot, a back wall
 * that ends against a corridor turns its corner into the corridor's border,
 * and a partition of the maze (`F`, a wall you see the top of) is a run of
 * FireRed's own teal panels. Its floor may also spin you on - the arrows and
 * the stop plate - and its ways between floors are its own stairs and its lift.
 * The Power Plant is a hall under a wall of machinery three rows deep.
 */

/** The rooms a building's inside may be drawn as. */
export type RoomStyle =
  | 'house'
  | 'mart'
  | 'cottage'
  | 'lab'
  | 'center'
  | 'warehouse'
  | 'gatehouse'
  | 'hideout'
  | 'power-plant';
/** The caves a cave may be drawn as: Mt. Moon's, Icefall Cave's ice, or Mt. Ember's Ruby Path. */
export type CaveStyle = 'cave' | 'ice' | 'ember';
/** The tunnels a tunnel may be drawn as: the Underground Path's. */
export type TunnelStyle = 'underground';
/** The towers a tower floor may be drawn as: Lavender Town's Pokemon Tower. */
export type TowerStyle = 'tower';
export type InsideStyle = RoomStyle | CaveStyle | TunnelStyle | TowerStyle;

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

  // --- a cave: Mt. Moon ------------------------------------------------------
  caveBoulder: areaProp('cave.boulder', 'boulder'),
  caveRocks: areaProp('cave.rocks', 'rocks'),
  // The crater a fallen moon stone left, walked over as FireRed's are.
  caveCrater: areaFloorProp('cave.crater', 'crater'),
  // Water running down the back wall into a pool, which is walked through.
  caveDrip: areaProp('cave.drip', 'dripping water', ['##', '..']),
  // The ways between floors and out: a hole with a ladder down it, a ladder
  // up with its foot on the floor, and daylight in a notch of the south wall.
  caveHole: areaProp('cave.hole', 'ladder down'),
  caveLadder: areaProp('cave.ladder', 'ladder up', ['#', '.']),
  caveExit: areaProp('cave.exit', 'way out'),

  // --- a cave of ice: Icefall Cave --------------------------------------------
  // Boulders and ice crystals stand on the floor or the ice alike, and a slide
  // across the ice stops against them.
  iceBoulder: iceProp('ice.boulder', 'boulder'),
  iceBoulderLow: iceProp('ice.boulderLow', 'boulder'),
  iceBoulderTall: iceProp('ice.boulderTall', 'boulder'),
  iceRock: iceProp('ice.rock', 'rock'),
  iceCrystal: iceProp('ice.crystal', 'ice crystal'),
  iceCrystalLow: iceProp('ice.crystalLow', 'ice crystal'),
  iceHole: iceProp('ice.hole', 'ladder down'),
  iceLadder: iceProp('ice.ladder', 'ladder up', ['#', '.']),
  iceExit: iceProp('ice.exit', 'way out'),

  // --- a volcano's cave: Mt. Ember's Ruby Path ----------------------------------
  emberBoulder: emberProp('ember.boulder', 'boulder'),
  emberBoulderLow: emberProp('ember.boulderLow', 'boulder'),
  emberStone: emberProp('ember.stone', 'rock'),
  emberStones: emberProp('ember.stones', 'rocks'),
  // The spring seeps out of the rock and pools at its foot, where FireRed lets
  // you stand in it.
  emberSpring: emberProp('ember.spring', 'hot spring', ['##', '..']),
  emberHole: emberProp('ember.hole', 'ladder down'),
  emberLadder: emberProp('ember.ladder', 'ladder up', ['#', '.']),
  emberExit: emberProp('ember.exit', 'way out'),

  // --- a gatehouse: FireRed's on Route 2, and the two kinds into Saffron -----
  gateWindow: areaProp('gate.window', 'window'),
  gatePlant: areaProp('gate.plant', 'plant'),
  gateDesk: areaProp('gate.desk', 'table'),
  // A chair is sat on, as FireRed's are walked onto.
  gateChair: areaProp('gate.chair', 'chair', ['.']),
  gateChairEast: areaProp('gate.chairEast', 'chair', ['.']),
  gateCounter: areaProp('gate.counter', 'counter'),
  gateLongCounter: areaProp('gate.longCounter', 'counter'),
  gateRunner: areaFloorProp('gate.runner', 'rug'),
  gateShortRunner: areaFloorProp('gate.shortRunner', 'rug'),
  gateWideRug: areaFloorProp('gate.wideRug', 'rug'),
  // The ways out: the doorway in the back wall, the mat at the foot, and a
  // mat let into each side wall over the dark beyond it.
  gateBackDoor: areaProp('gate.backDoor', 'doorway'),
  gateMat: areaFloorProp('gate.mat', 'door mat'),
  gateMatWest: areaProp('gate.matWest', 'door mat', ['#.', '#.', '#.']),
  gateMatEast: areaProp('gate.matEast', 'door mat', ['.#', '.#', '.#']),

  // --- the Underground Path --------------------------------------------------
  pathCounterWest: areaProp('path.counterWest', 'counter'),
  pathCounterEast: areaProp('path.counterEast', 'counter'),
  // The stairwell down, stood beside on the floor east of it.
  pathStairwell: areaProp('path.stairwell', 'stairs down', ['##.', '##.', '##.']),
  // The tunnel's stairs up: eastward from its north end, the top of them in
  // the north wall, and westward from its south end.
  tunnelStairsEast: areaProp('tunnel.stairsEast', 'stairs up'),
  tunnelStairsWest: areaProp('tunnel.stairsWest', 'stairs up'),

  // --- the Pokemon Tower -----------------------------------------------------
  // Its stairs up on the east and down on the west, each reaching into the
  // tile stood on at its foot, which stays floor.
  towerStairsUp: areaProp('tower.stairsUp', 'stairs up', ['.##', '.##', '.##']),
  towerStairsDown: areaProp('tower.stairsDown', 'stairs down', ['##.', '##.', '##.']),
  towerMat: areaFloorProp('tower.mat', 'door mat'),
  towerGrave: areaProp('tower.grave', 'grave'),
  towerGoldGrave: areaProp('tower.goldGrave', 'grave'),
  towerStatue: areaProp('tower.statue', 'statue'),

  // --- the Rocket Hideout ------------------------------------------------------
  // Its stairs: up, climbing west from the step at their east side, the rail
  // in the wall above; down, going down east from the step at their west side.
  hideoutStairsUp: hideoutProp('hideout.stairsUp', 'stairs', ['###', '###', '##.', '##.']),
  hideoutStairsDown: hideoutProp('hideout.stairsDown', 'stairs', ['###', '.##', '.##']),
  // The lift door let into the back wall.
  hideoutLift: hideoutProp('hideout.lift', 'lift'),
  // The stairs that climb out, standing free against an east wall.
  hideoutStairsOut: hideoutProp('hideout.stairsOut', 'stairs', ['.##', '.##', '.##']),
  // The generator, its head in the back wall and its feet on the floor.
  hideoutGenerator: hideoutProp('hideout.generator', 'generator', ['###', '###', '##.']),
  hideoutVent: hideoutProp('hideout.vent', 'vent'),
  hideoutPhone: hideoutProp('hideout.phone', 'telephone'),
  hideoutDesk: hideoutProp('hideout.desk', 'desk', ['...', '###', '###', '...']),
  hideoutDeskPlain: hideoutProp('hideout.deskPlain', 'desk', ['...', '###', '###', '...']),
  hideoutStool: hideoutProp('hideout.stool', 'stool', ['.']),
  hideoutStoolEast: hideoutProp('hideout.stoolEast', 'stool', ['.']),
  hideoutPlant: hideoutProp('hideout.plant', 'plant', ['^', '#']),
  hideoutPlanTable: hideoutProp('hideout.planTable', 'table of plans', ['######', '######', '######', '......']),
  hideoutCabinet: hideoutProp('hideout.cabinet', 'cabinet'),
  hideoutSofa: hideoutProp('hideout.sofa', 'sofa', ['###', '...']),
  hideoutConsole: hideoutProp('hideout.console', 'console', ['#', '.']),
  hideoutCrate: hideoutProp('hideout.crate', 'crate'),

  // --- the Power Plant -----------------------------------------------------------
  powerGenerator: hideoutProp('power.generator', 'generator', ['###', '###', '###', '...']),
  powerGeneratorEast: hideoutProp('power.generatorEast', 'generator', ['###', '###', '###', '...']),
  powerGirderWest: hideoutProp('power.girderWest', 'girders'),
  powerGirderEast: hideoutProp('power.girderEast', 'girders'),
  powerBarrel: hideoutProp('power.barrel', 'barrel', ['^', '#']),
  powerRubble: hideoutProp('power.rubble', 'rubble'),
  powerRubbleLow: hideoutProp('power.rubbleLow', 'rubble'),
  powerConsole: hideoutProp('power.console', 'console', ['#', '.']),
  powerConsoleDials: hideoutProp('power.consoleDials', 'console', ['#', '.']),
  powerComputer: hideoutProp('power.computer', 'computer', ['#', '#', '.']),
  powerGrating: hideoutProp('power.grating', 'grating', ['.']),
  powerMat: hideoutProp('power.mat', 'door mat', ['...']),
} as const satisfies Record<string, PropDefinition>;

export type InsidePropName = keyof typeof INSIDE_PROPS;

/** A room's floor and back wall, as the tiles each role is drawn with. */
interface StyleArt {
  readonly floor: MaterialTiles;
  readonly wall: MaterialTiles;
  /** What the way out of it is drawn as; a cave's is cut into its south wall instead. */
  readonly mat?: InsidePropName;
  /**
   * The mats let into its side walls, a column into the dark beyond each, and
   * the doorway in its back wall: a gatehouse's other ways out.
   */
  readonly sideMats?: { readonly left: InsidePropName; readonly right: InsidePropName };
  readonly backDoor?: InsidePropName;
  /** The stairwell down into the Underground Path, in the floor of its entrance. */
  readonly stairwell?: InsidePropName;
  /** The stairs up out of a tunnel, pressed into east or west from beside them. */
  readonly tunnelStairs?: { readonly left: InsidePropName; readonly right: InsidePropName };
  /**
   * A tower's own staircases, which stand a column wider than a house's: each
   * reaches into the tile stood on at its foot.
   */
  readonly towerStairs?: { readonly up: InsidePropName; readonly down: InsidePropName };
  /** A cave's sand; a room has none, and draws it as floor. */
  readonly sand?: MaterialTiles;
  /** An ice cave's ice; anywhere else it is drawn as floor. */
  readonly ice?: MaterialTiles;
  /** A cave's ways through, in its own rock: the way out, a ladder up and a hole down. */
  readonly caveWays?: { readonly exit: InsidePropName; readonly ladder: InsidePropName; readonly hole: InsidePropName };
  /** Its own stairs, where it does not have the house's. */
  readonly stairs?: { readonly up?: StairArt; readonly down?: StairArt };
  /** The lift door let into its back wall, three tiles wide and two high. */
  readonly lift?: InsidePropName;
  /**
   * The rest of what it draws: the dark beyond its walls, which a hideout
   * draws its border on; the partitions of a maze (`fence`, `F`); and the
   * spinner floor. Anything it leaves out is drawn as its floor, or as
   * nothing for the dark.
   */
  readonly dark?: MaterialTiles;
  readonly partition?: MaterialTiles;
  readonly spinners?: Partial<Record<'spin-up' | 'spin-down' | 'spin-left' | 'spin-right' | 'spin-stop', MaterialTiles>>;
}

/**
 * A staircase in a room: the piece, where it stands from the end of the way
 * through that goes up or down it (`dx`, `dy` to its top-left), the way you
 * press from that end, and how many of its rows stand in the room's back wall
 * - which is two rows deep, so the rows of wall above a staircase are the rest.
 */
export interface StairArt {
  readonly prop: InsidePropName;
  readonly dx: number;
  readonly dy: number;
  readonly width: number;
  readonly height: number;
  readonly toward: 'left' | 'right';
  readonly wallRows: number;
}

/**
 * The house's stairs, which every room without its own climbs: FireRed puts
 * the way onto a staircase on a little rug beside its middle row - west of a
 * staircase up, east of one down.
 */
const HOUSE_STAIRS: { readonly up: StairArt; readonly down: StairArt } = {
  up: { prop: 'stairsUp', dx: 1, dy: -1, width: 2, height: 3, toward: 'right', wallRows: 1 },
  down: { prop: 'stairsDown', dx: -2, dy: -1, width: 2, height: 3, toward: 'left', wallRows: 1 },
};

/**
 * The Rocket Hideout's, which are FireRed's the other way about: you step on
 * at the head of the stairs - the east side of a way up, the west side of a
 * way down - and press across them.
 */
const HIDEOUT_STAIRS: { readonly up: StairArt; readonly down: StairArt } = {
  up: { prop: 'hideoutStairsUp', dx: -2, dy: -2, width: 3, height: 4, toward: 'left', wallRows: 2 },
  down: { prop: 'hideoutStairsDown', dx: 0, dy: -1, width: 3, height: 3, toward: 'right', wallRows: 1 },
};

const hideout = (name: HideoutPieceName): number => hideoutTile(name);

/** What counts as the floor of a hideout's room, which its shade and its foot are read off. */
const HIDEOUT_FLOORS: readonly (Material | undefined)[] = [
  'paving',
  'spin-up',
  'spin-down',
  'spin-left',
  'spin-right',
  'spin-stop',
];
const isHideoutFloor = (material: Material | undefined): boolean => HIDEOUT_FLOORS.includes(material);
/** Anything of a room: its floor, its walls, its partitions - everything but the dark. */
const isRoom = (material: Material | undefined): boolean => material !== undefined && material !== 'cliff';

/**
 * The hideout's floor: shaded down its west side and under its back wall, and
 * its last row carrying the room's border along its foot - turned down into
 * a corridor's border where the corridor leaves the room southward.
 */
function hideoutFloor(at: (dx: number, dy: number) => Material | undefined): number {
  const shaded = !isHideoutFloor(at(-1, 0)) && at(-1, 0) !== 'fence' ? true : at(0, -1) === 'wall';
  if (at(0, 1) === 'cliff') {
    if (isHideoutFloor(at(1, 1))) {
      return hideout(shaded ? 'hideout.footShadeTurnsEast' : 'hideout.footTurnsEast');
    }
    if (isHideoutFloor(at(-1, 1))) {
      return hideout('hideout.footTurnsWest');
    }
    return hideout(shaded ? 'hideout.footShade' : 'hideout.foot');
  }
  return hideout(shaded ? 'hideout.floorShade' : 'hideout.floor');
}

/**
 * The dark beside a room, where FireRed draws its border: a rule down the
 * side the room is on, turned along the top of its back wall at the top and
 * along its foot at the bottom. Dark with no room beside it is nothing.
 */
function hideoutDark(at: (dx: number, dy: number) => Material | undefined): number | undefined {
  for (const [side, nw, w, sw] of [
    [1, 'hideout.borderNw', 'hideout.borderW', 'hideout.borderSw'],
    [-1, 'hideout.borderNe', 'hideout.borderE', 'hideout.borderSe'],
  ] as const) {
    const beside = at(side, 0);
    if (!isRoom(beside)) {
      continue;
    }
    if (beside === 'wall' && at(side, -1) !== 'wall') {
      return hideout(nw);
    }
    if (isHideoutFloor(beside) && at(side, 1) === 'cliff') {
      return hideout(sw);
    }
    return hideout(w);
  }
  return undefined;
}

/**
 * The hideout's back wall, two rows: the panel under its white rule, and the
 * skirting - turned into a corridor's border where the wall ends against one.
 */
function hideoutWall(at: (dx: number, dy: number) => Material | undefined): number {
  const upper = at(0, -1) !== 'wall';
  if (isHideoutFloor(at(1, 0))) {
    return hideoutTile('hideout.wallEndEast', 0, upper ? 0 : 1);
  }
  if (isHideoutFloor(at(-1, 0))) {
    return hideoutTile('hideout.wallEndWest', 0, upper ? 0 : 1);
  }
  return hideout(upper ? 'hideout.wallUpper' : 'hideout.wallLower');
}

/**
 * The Power Plant's wall of machinery, three rows deep: its top seen from
 * above, the lamps along its face and its foot, each with its own ends.
 */
function powerWall(at: (dx: number, dy: number) => Material | undefined): number {
  const row = at(0, -1) !== 'wall' ? 'Top' : at(0, 1) !== 'wall' ? 'Foot' : 'Face';
  const end = at(-1, 0) !== 'wall' ? 'West' : at(1, 0) !== 'wall' ? 'East' : '';
  // A wall standing out in the hall has floor behind it: its crown is a plate.
  if (row === 'Top' && at(0, -1) !== undefined && at(0, -1) !== 'cliff') {
    return hideout(`power.plate${end}` as HideoutPieceName);
  }
  return hideout(`power.wall${row}${end}` as HideoutPieceName);
}

/** The Power Plant's floor, shaded under its wall and down its west side. */
function powerFloor(at: (dx: number, dy: number) => Material | undefined): number {
  const north = at(0, -1) === 'wall';
  const west = at(-1, 0) === 'wall' || at(-1, 0) === 'cliff' || at(-1, 0) === undefined;
  return hideout(
    north && west
      ? 'power.floorShadeCorner'
      : north
        ? 'power.floorShade'
        : west
          ? 'power.floorShadeWest'
          : 'power.floor',
  );
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
  // FireRed's gatehouses, shaded under the back wall and down the west side
  // as the house is.
  gatehouse: {
    floor: {
      roles: {
        fill: areaTile('gate.floor'),
        'edge-n': areaTile('gate.floorShade'),
        'edge-w': areaTile('gate.floorShade'),
        'corner-nw': areaTile('gate.floorShade'),
      },
      edgesAtMapEdge: true,
    },
    wall: { roles: { fill: areaTile('gate.wallUpper'), 'edge-s': areaTile('gate.wallLower') } },
    mat: 'gateMat',
    sideMats: { left: 'gateMatWest', right: 'gateMatEast' },
    backDoor: 'gateBackDoor',
    stairwell: 'pathStairwell',
  },
  // The Underground Path, laid as FireRed lays it.
  underground: {
    floor: { roles: { fill: areaTile('tunnel.floor.649') }, weave: woven('tunnel.floor'), joins: ['wall'] },
    wall: { roles: { fill: areaTile('tunnel.wall.645') }, weave: woven('tunnel.wall'), joins: ['paving'] },
    tunnelStairs: { left: 'tunnelStairsWest', right: 'tunnelStairsEast' },
  },
  // Lavender Town's Pokemon Tower, laid as FireRed lays it.
  tower: {
    floor: { roles: { fill: areaTile('tower.floor.642') }, weave: woven('tower.floor'), joins: ['wall'] },
    // The wall meets the dark round the room as well as the floor, and draws
    // its own caps and edges, so it joins both.
    wall: { roles: { fill: areaTile('tower.wall.641') }, weave: woven('tower.wall'), joins: ['paving', 'cliff'] },
    mat: 'towerMat',
    towerStairs: { up: 'towerStairsUp', down: 'towerStairsDown' },
  },
  // Mt. Moon. The rock's top row is the lumps of its back wall and every face
  // that meets the ground stands on it from the top layer; the corners of a
  // room are FireRed's own joints, and the south wall is the rock's top seen
  // from above, rimmed where it meets the floor. The map's edge is more rock,
  // so a back wall along the top of a cave is no rim.
  cave: {
    floor: { roles: { fill: areaTile('cave.floor') } },
    wall: {
      overlay: true,
      edgesAtMapEdge: false,
      roles: {
        fill: areaTile('cave.wallUpper'),
        'edge-s': areaTile('cave.wallLower'),
        'edge-e': areaTile('cave.faceEast'),
        'edge-w': areaTile('cave.faceWest'),
        'edge-n': areaTile('cave.rim'),
        'inner-se': areaTile('cave.cornerNw'),
        'inner-sw': areaTile('cave.cornerNe'),
        'inner-ne': areaTile('cave.cornerSw'),
        'inner-nw': areaTile('cave.cornerSe'),
      },
    },
    caveWays: { exit: 'caveExit', ladder: 'caveLadder', hole: 'caveHole' },
    // The sand runs on under the rock, as FireRed's does: against a wall it is
    // more sand, and only where it meets the floor does it grow an edge.
    sand: {
      joins: ['wall'],
      roles: {
        fill: areaTile('cave.sand'),
        'edge-n': areaTile('cave.sandN'),
        'edge-s': areaTile('cave.sandS'),
        'edge-e': areaTile('cave.sandE'),
        'edge-w': areaTile('cave.sandW'),
        'corner-nw': areaTile('cave.sandNw'),
        'corner-ne': areaTile('cave.sandNe'),
        'corner-sw': areaTile('cave.sandSw'),
        'corner-se': areaTile('cave.sandSe'),
        'inner-nw': areaTile('cave.sandInNw'),
        'inner-ne': areaTile('cave.sandInNe'),
        'inner-sw': areaTile('cave.sandInSw'),
        'inner-se': areaTile('cave.sandInSe'),
      },
    },
  },
  // Icefall Cave, on Four Island: a floor of FireRed's cave stone, the rock
  // round it the lumps FireRed heaps between its rooms with a face where it
  // stands over the floor - its back wall and its sides, as Icefall Cave B1F
  // draws them - and the sheet of ice a step slides across, which runs up to
  // the rock and the floor without an edge, as FireRed's own does. The rock
  // under a room's south side is the same lumps: FireRed's snow-capped rim is
  // two tiles of wall, and one tile of it alone reads as no wall at all.
  ice: {
    floor: { roles: { fill: iceTile('ice.floor') } },
    wall: {
      overlay: true,
      edgesAtMapEdge: false,
      roles: {
        fill: iceTile('ice.crag'),
        'edge-s': iceTile('ice.faceSouth'),
        'edge-e': iceTile('ice.faceEast'),
        'edge-w': iceTile('ice.faceWest'),
        'corner-sw': iceTile('ice.spurSw'),
        'corner-se': iceTile('ice.spurSe'),
        'inner-se': iceTile('ice.cornerNw'),
        'inner-sw': iceTile('ice.cornerNe'),
      },
    },
    ice: { roles: { fill: iceTile('ice.sheet') } },
    caveWays: { exit: 'iceExit', ladder: 'iceLadder', hole: 'iceHole' },
  },
  // Mt. Ember's Ruby Path, on One Island: an ash floor, and the red rock round
  // it laid as Mt. Moon's is - its back wall a face standing on the floor, its
  // sides, the rim where it stands south of a room with its two ends, and the
  // joints in a room's corners. The map's edge is more rock.
  ember: {
    floor: { roles: { fill: emberTile('ember.floor') } },
    wall: {
      overlay: true,
      edgesAtMapEdge: false,
      roles: {
        fill: emberTile('ember.rock'),
        'edge-s': emberTile('ember.faceSouth'),
        'edge-e': emberTile('ember.faceEast'),
        'edge-w': emberTile('ember.faceWest'),
        'edge-n': emberTile('ember.rim'),
        'corner-nw': emberTile('ember.rimWest'),
        'corner-ne': emberTile('ember.rimEast'),
        'corner-sw': emberTile('ember.spurSw'),
        'corner-se': emberTile('ember.spurSe'),
        'inner-se': emberTile('ember.cornerNw'),
        'inner-sw': emberTile('ember.cornerNe'),
      },
    },
    caveWays: { exit: 'emberExit', ladder: 'emberLadder', hole: 'emberHole' },
  },
  // FireRed's Rocket Hideout, under the Game Corner: rooms in the dark with a
  // white rule round them, a maze of partitions, a floor of spinner arrows,
  // and its own stairs and lift. There is no mat: its ways out are its stairs.
  hideout: {
    floor: { roles: { fill: hideout('hideout.floor') }, pick: hideoutFloor },
    wall: { roles: { fill: hideout('hideout.wallUpper') }, pick: hideoutWall },
    dark: { roles: {}, pick: hideoutDark },
    partition: {
      roles: {
        single: hideout('hideout.partition'),
        fill: hideout('hideout.partition'),
        'cap-w': hideout('hideout.partitionCapW'),
        'run-h': hideout('hideout.partitionRunH'),
        'cap-e': hideout('hideout.partitionCapE'),
        'cap-n': hideout('hideout.partitionCapN'),
        'run-v': hideout('hideout.partitionRunV'),
        'cap-s': hideout('hideout.partitionCapS'),
        'corner-nw': hideout('hideout.partitionNw'),
        'corner-ne': hideout('hideout.partitionNe'),
        'corner-sw': hideout('hideout.partitionSw'),
        'corner-se': hideout('hideout.partitionSe'),
      },
      // A partition run up to the back wall stands in its skirting.
      pick: (at) => (at(0, -1) === 'wall' ? hideout('hideout.partitionWall') : undefined),
    },
    spinners: {
      'spin-up': { roles: { fill: hideout('hideout.spinUp') } },
      'spin-down': { roles: { fill: hideout('hideout.spinDown') } },
      'spin-left': { roles: { fill: hideout('hideout.spinLeft') } },
      'spin-right': { roles: { fill: hideout('hideout.spinRight') } },
      'spin-stop': { roles: { fill: hideout('hideout.spinStop') } },
    },
    stairs: HIDEOUT_STAIRS,
    lift: 'hideoutLift',
  },
  // FireRed's Power Plant on Route 10: a hall under a wall of machinery, its
  // red mat on a grating at the door. Its way down is the hideout's own
  // stairs, because what goes down from it is the hideout.
  'power-plant': {
    floor: { roles: { fill: hideout('power.floor') }, pick: powerFloor },
    wall: { roles: { fill: hideout('power.wallFace') }, pick: powerWall },
    mat: 'powerMat',
    stairs: { down: HIDEOUT_STAIRS.down },
  },
};

/** A weave cut from FireRed's own ground, as the tiles each of its cells is. */
function woven(name: keyof typeof AREA_WEAVES): readonly (readonly number[])[] {
  return AREA_WEAVES[name].map((row) => row.map((piece) => areaTile(piece)));
}

/** The dark beyond a room's walls: nothing drawn. */
const DARK: MaterialTiles = { roles: {} };

/**
 * Every material but the wall and the dark is the floor: a room uses three,
 * and the catalogue asks for all sixteen.
 */
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
        'fence',
        'ice',
        'spin-up',
        'spin-down',
        'spin-left',
        'spin-right',
        'spin-stop',
      ] as const
    ).map((material) => [material, art.floor]),
  ) as Record<Exclude<Material, 'wall' | 'cliff'>, MaterialTiles>;
  return {
    sources: [
      BASE_SHEET_SOURCE.source,
      AREA_SHEET_SOURCE.source,
      ICE_SHEET_SOURCE.source,
      EMBER_SHEET_SOURCE.source,
      HIDEOUT_SHEET_SOURCE.source,
    ],
    materials: {
      ...floors,
      wall: art.wall,
      cliff: art.dark ?? DARK,
      ...(art.sand ? { sand: art.sand } : {}),
      ...(art.ice ? { ice: art.ice } : {}),
      ...(art.partition ? { fence: art.partition } : {}),
      ...art.spinners,
    },
    props: INSIDE_PROPS,
  };
}

export const ROOM_STYLES: readonly RoomStyle[] = [
  'house',
  'mart',
  'cottage',
  'lab',
  'center',
  'warehouse',
  'gatehouse',
  'hideout',
  'power-plant',
];
export const CAVE_STYLES: readonly CaveStyle[] = ['cave', 'ice', 'ember'];
export const TUNNEL_STYLES: readonly TunnelStyle[] = ['underground'];
export const TOWER_STYLES: readonly TowerStyle[] = ['tower'];
export const INSIDE_STYLES: readonly InsideStyle[] = [
  ...ROOM_STYLES,
  ...CAVE_STYLES,
  ...TUNNEL_STYLES,
  ...TOWER_STYLES,
];

/** The ground of a Pokemon Tower floor, cell for cell as FireRed's: floor, wall and the dark round it. */
export const TOWER_GROUND: readonly string[] = AREA_WEAVE_GROUND['tower.floor'];

export const INSIDE_TILESETS: Readonly<Record<InsideStyle, TilesetCatalogue<InsidePropName>>> =
  Object.fromEntries(INSIDE_STYLES.map((style) => [style, styleCatalogue(style)])) as Record<
    InsideStyle,
    TilesetCatalogue<InsidePropName>
  >;

/** The mat a style's way out is drawn as; a cave has none. */
export function insideMat(style: InsideStyle): InsidePropName | undefined {
  return STYLE_ART[style].mat;
}

/** The mat let into a side wall of a style's room, west or east; a style that has none, undefined. */
export function insideSideMat(style: InsideStyle, side: 'left' | 'right'): InsidePropName | undefined {
  return STYLE_ART[style].sideMats?.[side];
}

/** The doorway a style's room has in its back wall; a style that has none, undefined. */
export function insideBackDoor(style: InsideStyle): InsidePropName | undefined {
  return STYLE_ART[style].backDoor;
}

/** The stairwell down into the Underground Path a style's room has; a style that has none, undefined. */
export function insideStairwell(style: InsideStyle): InsidePropName | undefined {
  return STYLE_ART[style].stairwell;
}

/** A tower style's own staircase, up or down; a style that has none, undefined. */
export function towerStairs(style: InsideStyle, way: 'up' | 'down'): InsidePropName | undefined {
  return STYLE_ART[style].towerStairs?.[way];
}

/** The stairs up out of a tunnel of a style, pressed into west or east; a style that has none, undefined. */
export function tunnelStairs(style: InsideStyle, toward: 'left' | 'right'): InsidePropName | undefined {
  return STYLE_ART[style].tunnelStairs?.[toward];
}

/** The staircase up or down a style's room climbs: its own, or the house's. */
export function insideStairs(style: InsideStyle, look: 'stairs-up' | 'stairs-down'): StairArt {
  const own = STYLE_ART[style].stairs;
  return (look === 'stairs-up' ? own?.up : own?.down) ?? (look === 'stairs-up' ? HOUSE_STAIRS.up : HOUSE_STAIRS.down);
}

/** The lift door let into a style's back wall; a style that has none, undefined. */
export function insideLift(style: InsideStyle): InsidePropName | undefined {
  return STYLE_ART[style].lift;
}

/** A cave style's ways through, in its own rock; none for a style that is no cave. */
export function caveWays(style: InsideStyle): StyleArt['caveWays'] {
  return STYLE_ART[style].caveWays;
}
