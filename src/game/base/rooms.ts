import type { GridPosition } from '../movement/gridMovement';
import { WORKSHOP_UPGRADES } from '../hub/workshop';
import { pokemonNeedingRecovery } from '../hub/recovery';
import type { RestoredGame } from '../save/SaveManager';
import type { Rect } from '../ui/labelPlacement';
import { MapSketch } from '../world/mapGrid';
import { buildMapLayers, type MapLayers } from '../world/tiles';
import type { PropDefinition } from '../world/tileset/catalogue';
import { floorPiece, pieceProp, pieceTile, roomCatalogue, solidPiece } from './baseSheet';
import { HOME_SHEET_PIECES } from './homeSheet';
import type { HomePieceName } from './generated/homePieces';
import type { TileSource } from '../world/tileset/catalogue';
import type { BasePieceName } from './generated/basePieces';
import type { BaseKeeper, BaseScreen } from './doors';
import { cabinetOddities, type Oddity } from '../hub/traderCabinet';
import { TILE_SIZE } from '../worldMap';
import {
  CABINET_UNITS,
  cabinetLayout,
  cratesNote,
  unitNote,
  unitTiles,
  type CabinetLayout,
} from './cabinet';
import { wallMapNote } from './wallMap';
import { badgeCaseLines, badgeCaseNote } from './badgeCase';
import { pennantLines, pennantsNote } from './pennants';
import {
  bedLines,
  calendarDay,
  calendarLines,
  nextRival,
  partnerRug,
  pcLines,
  tellyLines,
} from './homeLines';
import { hunterRival } from '../world/hunters';

/**
 * The four rooms behind the base's four doors.
 *
 * The walkable base (`baseMap.ts`) made the lobby a place; this makes each of
 * its buildings one. Walking onto a doorway takes the player inside, where the
 * keeper stands behind their counter and the room shows what the player has
 * built - which is the captain's rule for the whole base, and the reason the
 * rooms exist at all: **every upgrade puts a thing in a room**, so the base is
 * something you look at rather than a ledger.
 *
 * Each room is drawn in the FireRed/LeafGreen room it is dressed as, cut by
 * `scripts/cut-frlg-base.mjs`: Oak's Lab is Oak's Lab, the Pokémon Center is
 * the Pokémon Center, Bill's cottage is Bill's house - cell separators and all
 * - and Brock's workshop is the Rocket Warehouse, which is the one FireRed
 * room built for making and keeping things. A room only ever draws on its own
 * floor what was cut from that floor, with one exception each way, lifted off
 * the floor it was drawn on by the cut (`key`): Oak's machine, which Brock
 * copies, and the shelves in Bill's cabinet.
 *
 * **The keeper is one key from the door.** A player re-kits many times an
 * hour, so standing on the door mat and pressing the interact key opens the
 * keeper's screen exactly as speaking to them across the room does - the room
 * is there to be looked at, never to be crossed. The mat is also the way out:
 * pushing down off it leaves, which is how every FireRed room is left, and the
 * room's hint line says both while the player is standing on it.
 *
 * Nothing here is stored. What stands in a room is derived from the save the
 * way the yard's fixtures are (`fixtures.ts`), so a room and the ladder it
 * shows can never disagree.
 */

export type RoomId =
  | 'oaks-lab'
  | 'pokemon-centre'
  | 'brocks-workshop'
  | 'bills-cottage'
  | 'bolthole'
  | 'bolthole-upstairs';

export type RoomPropName =
  | 'labComputers'
  | 'labWallShelves'
  | 'labMachine'
  | 'labTable'
  | 'labShelvesWest'
  | 'labShelvesEast'
  | 'labPlant'
  | 'labPlantEast'
  | 'labMat'
  | 'pcBack'
  | 'pcSideWest'
  | 'pcSideEast'
  | 'pcEmblem'
  | 'pcLounge'
  | 'pcMat'
  | 'pcHealingMachine'
  | 'wardBed'
  | 'billPillar'
  | 'billSeparators'
  | 'billPc'
  | 'billDesk'
  | 'billPlant'
  | 'billShelves'
  | 'billBox'
  | 'billMat'
  | 'whSideWest'
  | 'whSideEast'
  | 'whShade'
  | 'whShadow'
  | 'whGenerator'
  | 'whPhone'
  | 'whVent'
  | 'whCrate'
  | 'whTerminals'
  | 'whMonitorDesk'
  | 'whTable'
  | 'whBox'
  | 'whBoxStack'
  | 'whStool'
  | 'whMat'
  | 'healingMachineModel'
  | HomePropName;

/** What THE BOLTHOLE is furnished with: FireRed's own player's house (`homeSheet.ts`). */
export type HomePropName =
  | 'homeKitchen'
  | 'homeCupboard'
  | 'homeTv'
  | 'homeWindow'
  | 'homeStairsUp'
  | 'homeStairMatUp'
  | 'homeRugTable'
  | 'homePlantWest'
  | 'homePlantEast'
  | 'homeMat'
  | 'homeShade'
  | 'homePcDesk'
  | 'homeDrawers'
  | 'homeBookcase'
  | 'homeStairsDown'
  | 'homeStairMatDown'
  | 'homePoster'
  | 'homeBed'
  | 'homeTvTop'
  | 'homeRugTv'
  | 'homeRugTvRed'
  | 'homeRugTvBlue';

/** Brock's workshop, walls included. */
const WORKSHOP_SIZE = { width: 15, height: 12 } as const;

/**
 * One of the workshop's two side walls, top to bottom: the corner, the run
 * beside the back wall, and the run beside the floor as far as the room goes.
 * The warehouse is walled on both sides, which is half of what makes it read
 * as a room rather than a floor that stops.
 */
function sideWall(name: 'warehouse.sideWest' | 'warehouse.sideEast'): PropDefinition {
  const { height } = WORKSHOP_SIZE;
  return {
    label: 'wall',
    width: 1,
    height,
    cells: Array.from({ length: height }, (_cell, y) => ({
      tile: pieceTile(name, 0, Math.min(y, 2)),
      solid: true,
    })),
  };
}

/**
 * THE BOLTHOLE's furniture, every piece FireRed's own and stood where FireRed
 * stands it in the player's house (`scripts/cut-frlg-home.mjs` names the
 * metatiles). The collision is FireRed's too, read off the same map: the
 * front row of a piece that stands against the wall - the counter's foot, the
 * cupboard's, the television stand's - is floor you may stand on, which is how
 * a FireRed room is walked. Three are judged instead of copied, because
 * FireRed draws a top layer over the player there and this game has none: a
 * pot plant is solid all the way up, the bed is solid from its headboard down
 * (or the player stands in its pillow), and the television's top is solid so
 * nobody stands in it.
 */
function HOME_PROPS(): Record<HomePropName, PropDefinition> {
  const home = HOME_SHEET_PIECES;
  const rugTv = (name: HomePieceName) => home.prop(name, 'rug', ['..#..', '..#..', '.....', '.....']);
  return {
    homeKitchen: home.prop('home.kitchen', 'kitchen', ['##', '..']),
    homeCupboard: home.prop('home.cupboard', 'cupboard', ['##', '##', '..']),
    homeTv: home.prop('home.tv', 'television', ['#', '#', '.']),
    homeWindow: home.solid('home.window', 'window'),
    homeStairsUp: home.prop('home.stairsUp', 'stairs', ['##', '##', '..']),
    homeStairMatUp: home.floor('home.stairMatUp', 'stair mat'),
    homeRugTable: home.prop('home.rugTable', 'table', ['......', '..##..', '..##..', '......']),
    homePlantWest: home.solid('home.plantWest', 'plant'),
    homePlantEast: home.solid('home.plantEast', 'plant'),
    homeMat: home.floor('home.mat', 'door mat'),
    homeShade: home.floor('home.floorShade', 'floor'),
    homePcDesk: home.prop('home.pcDesk', 'PC', ['##', '##', '..']),
    homeDrawers: home.prop('home.drawers', 'drawers', ['#', '.']),
    homeBookcase: home.prop('home.bookcase', 'bookcase', ['##', '##', '..']),
    homeStairsDown: home.solid('home.stairsDown', 'stairs'),
    homeStairMatDown: home.floor('home.stairMatDown', 'stair mat'),
    homePoster: home.solid('home.poster', 'calendar'),
    homeBed: home.prop('home.bed', 'bed', ['.#.', '.#.', '.#.']),
    homeTvTop: home.solid('home.tvTop', 'television'),
    homeRugTv: rugTv('home.rugTv'),
    homeRugTvRed: rugTv('home.rugTvRed'),
    homeRugTvBlue: rugTv('home.rugTvBlue'),
  };
}

const ROOM_PROPS: Readonly<Record<RoomPropName, PropDefinition>> = {
  labComputers: solidPiece('lab.computers', 'computers'),
  labWallShelves: solidPiece('lab.wallShelves', 'bookshelves'),
  labMachine: pieceProp('lab.machine', 'machine', ['###', '###', '.##']),
  labTable: solidPiece('lab.table', 'table'),
  labShelvesWest: solidPiece('lab.shelvesWest', 'bookshelves'),
  labShelvesEast: solidPiece('lab.shelvesEast', 'bookshelves'),
  labPlant: solidPiece('lab.plant', 'plant'),
  labPlantEast: solidPiece('lab.plantEast', 'plant'),
  labMat: floorPiece('lab.mat', 'door mat'),
  // The whole back of the Center in one piece - the wall, Joy's counter, her
  // machine and everything on the wall - because none of it moves. What is
  // behind the counter is solid except the one tile Joy stands on.
  pcBack: pieceProp('pc.back', 'counter', [
    '###############',
    '###############',
    '#######.#######',
    '#...#######...#',
    '#.............#',
  ]),
  pcSideWest: solidPiece('pc.sideWest', 'wall'),
  pcSideEast: solidPiece('pc.sideEast', 'wall'),
  pcEmblem: floorPiece('pc.emblem', 'floor'),
  pcLounge: solidPiece('pc.lounge', 'seats'),
  pcMat: floorPiece('pc.mat', 'door mat'),
  pcHealingMachine: solidPiece('pc.healingMachine', 'healing machine'),
  wardBed: solidPiece('house.bed', 'bed'),
  billPillar: solidPiece('bill.pillar', 'pillar'),
  billSeparators: solidPiece('bill.separators', 'cell separators'),
  billPc: solidPiece('bill.pc', 'PC'),
  billDesk: solidPiece('bill.desk', 'desk'),
  billPlant: solidPiece('bill.plant', 'plant'),
  billShelves: solidPiece('lab.shelvesEmpty', 'shelves'),
  billBox: solidPiece('bill.box', 'crate'),
  billMat: floorPiece('bill.mat', 'door mat'),
  whSideWest: sideWall('warehouse.sideWest'),
  whSideEast: sideWall('warehouse.sideEast'),
  whShade: floorPiece('warehouse.floorShade', 'floor'),
  whShadow: floorPiece('warehouse.floorShadow', 'floor'),
  // Its last row is the half shade it throws on the plate in front of it.
  whGenerator: pieceProp('warehouse.generator', 'generator', ['###', '###', '###', '...']),
  whPhone: solidPiece('warehouse.phone', 'telephone'),
  whVent: solidPiece('warehouse.vent', 'vent'),
  whCrate: solidPiece('warehouse.crate', 'crate'),
  whTerminals: solidPiece('warehouse.terminals', 'radio set'),
  whMonitorDesk: solidPiece('warehouse.monitorDesk', 'monitors'),
  // The legs and the shadow under the bench are drawn in its third row.
  whTable: solidPiece('warehouse.table', 'workbench'),
  whBox: solidPiece('warehouse.box', 'box'),
  whBoxStack: pieceProp('warehouse.boxStack', 'boxes', ['#', '#', '.']),
  whStool: solidPiece('warehouse.stool', 'stool'),
  whMat: floorPiece('warehouse.mat', 'door mat'),
  healingMachineModel: solidPiece('lab.machineLifted', 'healing machine'),
  ...HOME_PROPS(),
};

const LAB = roomCatalogue(
  {
    floor: 'lab.floor',
    floorShade: 'lab.floorShade',
    wallUpper: 'lab.wallUpper',
    wallLower: 'lab.wallLower',
  },
  ROOM_PROPS,
);
const CENTER = roomCatalogue(
  { floor: 'pc.floor', floorShade: 'pc.floor', wallUpper: 'pc.floor', wallLower: 'pc.floor' },
  ROOM_PROPS,
);
const COTTAGE = roomCatalogue(
  {
    floor: 'bill.floor',
    floorShade: 'bill.floorShade',
    wallUpper: 'bill.wallUpper',
    wallLower: 'bill.wallLower',
  },
  ROOM_PROPS,
);
const WAREHOUSE = roomCatalogue(
  {
    floor: 'warehouse.floor',
    floorShade: 'warehouse.floorShade',
    wallUpper: 'warehouse.wallUpper',
    wallLower: 'warehouse.wallLower',
  },
  ROOM_PROPS,
);
const HOUSE = roomCatalogue(
  {
    floor: 'home.floor',
    floorShade: 'home.floorShade',
    wallUpper: 'home.wallUpper',
    wallLower: 'home.wallLower',
  },
  ROOM_PROPS,
  HOME_SHEET_PIECES,
);

export interface RoomProp {
  readonly name: RoomPropName;
  readonly x: number;
  readonly y: number;
}

/**
 * Something in a room that answers when it is walked up to: a thing the player
 * built, or the Center's line of Poké Balls. It is captioned while the player
 * stands beside it and says its line when faced, the way a yard fixture does.
 */
export interface RoomThing {
  /** What the caption over it says. */
  readonly name: string;
  /** The line under the name: what it is, not what it cost. */
  readonly note: string;
  /** The tiles the caption is seated against and speaks from. */
  readonly tiles: readonly GridPosition[];
  /** The rung of Brock's ladder it shows, if it shows one. */
  readonly upgradeId?: string;
  /**
   * Which unit of Bill's cabinet it is, if it is one: facing it and asking is
   * how the shelves are looked along, one thing at a time (`cabinet.ts`).
   */
  readonly cabinetUnit?: number;
  /** Whether it is the crates the cabinet overflows into. */
  readonly crated?: boolean;
  /**
   * A screen it opens when faced and spoken to, in place of saying its line:
   * the wall map is read on a screen, drawn as big as the window allows.
   */
  readonly opens?: 'wall-map';
  /**
   * What it says when faced and spoken to, in place of its name and note: a
   * thing in the player's own house has more to say than what it is.
   */
  readonly lines?: readonly string[];
  /**
   * Something it does when faced and spoken to, beyond saying its lines: the
   * bed is slept in (the screen goes dark first) and the console is played.
   */
  readonly does?: 'sleep' | 'play';
}

/**
 * A picture of the save painted onto a stretch of wall that the room keeps
 * bare for it, as the wall map is in Oak's Lab: the badge case in the front
 * room of the player's house, and the pennants upstairs.
 */
export interface RoomPoster {
  readonly kind: 'badge-case' | 'pennants';
  readonly area: Rect;
}

/**
 * A little sprite set on the room rather than into it - the Poké Balls on
 * Joy's counter. A tile laid over a counter tile would replace the counter,
 * so these are drawn above the room's tiles by the scene instead.
 */
export interface RoomSprite {
  readonly piece: BasePieceName;
  readonly x: number;
  readonly y: number;
}

export interface BaseRoom {
  readonly id: RoomId;
  /** The keeper's screen, or null in the player's own house, which is nobody's counter. */
  readonly screen: BaseScreen | null;
  /** The name over the door, and so the name of the room. */
  readonly name: string;
  readonly width: number;
  readonly height: number;
  /**
   * The door mat's middle tile: where the player is put down coming in, facing
   * into the room, and the one tile a push south from leaves by. Null upstairs,
   * where the way out is the stairs.
   */
  readonly mat: GridPosition | null;
  /** Who stands behind the counter, or null in a room that is the player's own. */
  readonly keeper: BaseKeeper | null;
  /**
   * Counter tiles the keeper serves across. Facing one is speaking to them,
   * exactly as it is in the games this is dressed as.
   */
  readonly counter: readonly GridPosition[];
  /** The ways to the other floors of the same building. */
  readonly stairs: readonly RoomStair[];
}

/**
 * The orange mat at the foot of a FireRed staircase: stepping onto it is
 * climbing the stairs, and the player arrives on the matching mat on the floor
 * it leads to, facing away from the stairs - the way the games this is dressed
 * as do it. Arriving on one does not climb it straight back: a stair, like a
 * door, is taken by a step onto it.
 */
export interface RoomStair {
  readonly tile: GridPosition;
  readonly to: RoomId;
}

/** What Bill's cabinet holds this visit, and where each thing in it stands. */
export interface BuiltCabinet {
  readonly oddities: readonly Oddity[];
  readonly layout: CabinetLayout;
}

export interface BuiltRoom {
  readonly room: BaseRoom;
  /** The sheets the room is drawn from. */
  readonly sources: readonly TileSource[];
  readonly layers: MapLayers;
  readonly collision: readonly boolean[][];
  readonly things: readonly RoomThing[];
  readonly sprites: readonly RoomSprite[];
  /** Only in Bill's cottage. */
  readonly cabinet?: BuiltCabinet;
  /** Where the wall map hangs, in the one room it hangs in. */
  readonly wallMap: Rect | null;
  /** The other pictures of the save painted on this room's walls. */
  readonly posters: readonly RoomPoster[];
}

// --- the wall map -----------------------------------------------------------

/**
 * The stretch of Oak's back wall the wall map hangs on.
 *
 * Five tiles of plain wall between the computers and the bookshelves, both
 * wall rows deep, with nothing planted over it (`rooms.test.ts` holds that).
 * The map is not a tile of the sheet - it is a picture of the save
 * (`base/wallMap.ts`) - so the room says where it hangs (`BuiltRoom.wallMap`)
 * and the scene paints it there, over plain wall.
 */
export const OAK_WALL_MAP: Rect = { x: 4, y: 0, width: 5, height: 2 };

/**
 * Every tile of the board: what a player faces to read it - its lower row is
 * the wall a player standing in front of it is looking at - and what its
 * caption is seated against, which is the whole board so the caption never
 * covers the map it is naming.
 */
export const WALL_MAP_TILES: readonly GridPosition[] = Array.from(
  { length: OAK_WALL_MAP.width * OAK_WALL_MAP.height },
  (_tile, index) => ({
    x: OAK_WALL_MAP.x + (index % OAK_WALL_MAP.width),
    y: OAK_WALL_MAP.y + Math.floor(index / OAK_WALL_MAP.width),
  }),
);

// --- what Brock has built, in his workshop ---------------------------------

interface RungDisplay {
  readonly upgradeId: string;
  readonly name: string;
  readonly note: string;
  readonly props: readonly RoomProp[];
  /** Floor it shades, laid with it: walked on, and no part of the thing itself. */
  readonly shade?: readonly RoomProp[];
}

/**
 * Every rung of Brock's ladder, standing in his workshop once it is built.
 *
 * The workshop is where the whole ladder can be seen at once - a bay a rung,
 * empty floor until it is paid for - so a player walking in reads how much of
 * the base they have built off the room rather than off a count. The things
 * themselves are the ones FireRed's warehouse has, picked for what each rung
 * does, and stood where that warehouse stands them: the aerial is a radio set
 * against the back wall, the harbour light the generator in the far corner,
 * the ward the bank of monitors against the wall between them, each locker a
 * crate on its pallet down the west side and each healing machine a copy of
 * Oak's down the east. What a thing stands in front of throws its shade on the
 * plate below it (`shade`), and the shade goes when the thing does.
 */
export const WORKSHOP_DISPLAY: readonly RungDisplay[] = [
  {
    upgradeId: 'radio-mast',
    name: 'THE RADIO SET',
    note: 'It hears the hunter',
    props: [{ name: 'whTerminals', x: 1, y: 0 }],
  },
  {
    upgradeId: 'beacon',
    name: 'THE BEACON’S LAMP',
    note: 'It lights your landing',
    props: [{ name: 'whGenerator', x: 11, y: 0 }],
  },
  {
    upgradeId: 'secure-locker-1',
    name: 'THE FIRST LOCKER',
    note: 'What a lost raid cannot take',
    props: [{ name: 'whCrate', x: 2, y: 4 }],
    shade: [
      { name: 'whShadow', x: 2, y: 6 },
      { name: 'whShadow', x: 3, y: 6 },
    ],
  },
  {
    upgradeId: 'secure-locker-2',
    name: 'THE SECOND LOCKER',
    note: 'Room for a second Pokémon',
    props: [{ name: 'whCrate', x: 2, y: 7 }],
    shade: [
      { name: 'whShadow', x: 2, y: 9 },
      { name: 'whShadow', x: 3, y: 9 },
    ],
  },
  {
    upgradeId: 'recovery-bay-1',
    name: 'HEALING MACHINE I',
    note: 'Joy quotes a quarter less',
    props: [{ name: 'healingMachineModel', x: 11, y: 4 }],
  },
  {
    upgradeId: 'recovery-bay-2',
    name: 'HEALING MACHINE II',
    note: 'Joy quotes half',
    props: [{ name: 'healingMachineModel', x: 11, y: 7 }],
  },
  {
    upgradeId: 'quarantine-ward',
    name: 'THE WARD’S MONITORS',
    note: 'One heal a raid, off the clock',
    props: [{ name: 'whMonitorDesk', x: 5, y: 2 }],
  },
];

/**
 * The Center's side of the same ladder: what Brock fitted there. Joy's own
 * machine is always behind her; the two he builds stand on the back wall in
 * place of the cabinet and the map, and the ward is a bed set apart by the
 * west wall where the stairs used to go up.
 */
export const CENTER_DISPLAY: readonly RungDisplay[] = [
  {
    upgradeId: 'recovery-bay-1',
    name: 'HEALING MACHINE I',
    note: 'Every price a quarter less',
    props: [{ name: 'pcHealingMachine', x: 2, y: 0 }],
  },
  {
    upgradeId: 'recovery-bay-2',
    name: 'HEALING MACHINE II',
    note: 'Every price halved',
    props: [{ name: 'pcHealingMachine', x: 12, y: 0 }],
  },
  {
    upgradeId: 'quarantine-ward',
    name: 'THE WARD',
    note: 'One heal a raid, off the clock',
    props: [{ name: 'wardBed', x: 2, y: 5 }],
  },
];

// --- the four rooms ---------------------------------------------------------

export const BASE_ROOMS: readonly BaseRoom[] = [
  {
    id: 'oaks-lab',
    screen: 'raid',
    name: 'OAK’S LAB',
    width: 13,
    height: 12,
    mat: { x: 6, y: 11 },
    keeper: {
      id: 'oak',
      name: 'PROFESSOR OAK',
      design: 'prof-oak',
      position: { x: 6, y: 7 },
      facing: 'down',
    },
    counter: [],
    stairs: [],
  },
  {
    id: 'pokemon-centre',
    screen: 'stash',
    name: 'POKÉMON CENTER',
    width: 15,
    height: 9,
    mat: { x: 7, y: 8 },
    keeper: {
      id: 'nurse-joy',
      name: 'NURSE JOY',
      design: 'nurse-joy',
      position: { x: 7, y: 2 },
      facing: 'down',
    },
    counter: [5, 6, 7, 8, 9].map((x) => ({ x, y: 3 })),
    stairs: [],
  },
  {
    id: 'brocks-workshop',
    screen: 'workshop',
    name: 'BROCK’S WORKSHOP',
    width: WORKSHOP_SIZE.width,
    height: WORKSHOP_SIZE.height,
    mat: { x: 7, y: 11 },
    // Behind his bench, served across it the way Joy is across her counter.
    keeper: {
      id: 'brock',
      name: 'BROCK',
      design: 'brock',
      position: { x: 8, y: 5 },
      facing: 'down',
    },
    counter: [
      { x: 7, y: 8 },
      { x: 8, y: 8 },
    ],
    stairs: [],
  },
  {
    id: 'bills-cottage',
    screen: 'trader',
    name: 'BILL’S COTTAGE',
    width: 15,
    height: 12,
    mat: { x: 7, y: 11 },
    keeper: {
      id: 'bill',
      name: 'BILL',
      design: 'bill',
      position: { x: 7, y: 6 },
      facing: 'down',
    },
    counter: [],
    stairs: [],
  },
  // THE BOLTHOLE: the player's own house, downstairs and up. Nobody keeps it
  // but the player, so it has no counter and opens no screen; what it is for
  // is what stands in it.
  {
    id: 'bolthole',
    screen: null,
    name: 'THE BOLTHOLE',
    width: 15,
    height: 9,
    mat: { x: 7, y: 8 },
    keeper: null,
    counter: [],
    stairs: [{ tile: { x: 12, y: 2 }, to: 'bolthole-upstairs' }],
  },
  {
    id: 'bolthole-upstairs',
    screen: null,
    name: 'UPSTAIRS',
    width: 14,
    height: 9,
    mat: null,
    keeper: null,
    counter: [],
    stairs: [{ tile: { x: 13, y: 2 }, to: 'bolthole' }],
  },
];

export function roomNamed(id: string): BaseRoom | undefined {
  return BASE_ROOMS.find((room) => room.id === id);
}

/** Where a stair leads to: the matching stair on the floor it climbs to. */
export function stairArrival(from: RoomId, to: BaseRoom): GridPosition | undefined {
  return to.stairs.find((stair) => stair.to === from)?.tile;
}

/** The stair a tile is the foot of, in a room. */
export function stairAt(room: BaseRoom, tile: GridPosition): RoomStair | undefined {
  return room.stairs.find((stair) => stair.tile.x === tile.x && stair.tile.y === tile.y);
}

/** Every tile a planted prop covers. */
export function propTiles(props: readonly RoomProp[]): GridPosition[] {
  return props.flatMap((prop) => {
    const art = ROOM_PROPS[prop.name];
    return Array.from({ length: art.width * art.height }, (_cell, index) => ({
      x: prop.x + (index % art.width),
      y: prop.y + Math.floor(index / art.width),
    }));
  });
}

/** The tiles of a planted prop nobody can stand on: the thing itself, not the shade it throws. */
function solidTiles(props: readonly RoomProp[]): GridPosition[] {
  return props.flatMap((prop) => {
    const art = ROOM_PROPS[prop.name];
    return propTiles([prop]).filter((_tile, index) => art.cells[index].solid);
  });
}

/** How many Poké Balls Joy's counter holds: two to a cell, the sign's cell left clear. */
const COUNTER_SEATS = [5, 6, 8, 9];
export const COUNTER_BALLS = COUNTER_SEATS.length * 2;

/**
 * One Poké Ball on Joy's counter for every Pokémon the Center is waiting to
 * treat, as many as the counter holds. That is what handing your team over at
 * a Pokémon Center looks like, and it turns the Center's one number - who is
 * hurt - into a thing on the counter the player walks up to.
 */
export function restingBalls(waiting: number): readonly RoomSprite[] {
  const shown = Math.min(Math.max(0, waiting), COUNTER_BALLS);
  const sprites: RoomSprite[] = [];
  for (let seat = 0; seat < COUNTER_SEATS.length && seat * 2 < shown; seat += 1) {
    sprites.push({
      piece: shown - seat * 2 >= 2 ? 'ball.two' : 'ball.one',
      x: COUNTER_SEATS[seat],
      y: 3,
    });
  }
  return sprites;
}

function built(game: RestoredGame): readonly string[] {
  return game.raidProgress.workshopUpgrades;
}

function standing(displays: readonly RungDisplay[], game: RestoredGame): readonly RungDisplay[] {
  // In ladder order, so a room is drawn the same way whatever order the save
  // happens to list its rungs in.
  return WORKSHOP_UPGRADES.flatMap((upgrade) =>
    built(game).includes(upgrade.id)
      ? displays.filter((display) => display.upgradeId === upgrade.id)
      : [],
  );
}

function thingsFor(displays: readonly RungDisplay[]): RoomThing[] {
  return displays.map((display) => ({
    name: display.name,
    note: display.note,
    tiles: solidTiles(display.props),
    upgradeId: display.upgradeId,
  }));
}

interface Drawn {
  readonly sketch: MapSketch<RoomPropName>;
  readonly catalogue: typeof LAB;
  readonly things: RoomThing[];
  readonly sprites: RoomSprite[];
  readonly cabinet?: BuiltCabinet;
  readonly wallMap?: Rect;
  readonly posters?: readonly RoomPoster[];
}

/**
 * Oak's Lab, as FireRed draws it with two rows of floor taken out: his
 * computers and his bookcases along the back wall, the machine he keeps his
 * Poké Balls in, the table the starters were chosen at, and two rows of
 * shelving either side of the aisle he stands in.
 */
function drawLab(room: BaseRoom, game: RestoredGame): Drawn {
  const sketch = shell(room);
  sketch.plant(0, 1, 'labComputers');
  sketch.plant(9, 1, 'labWallShelves');
  sketch.plant(0, 3, 'labMachine');
  sketch.plant(8, 4, 'labTable');
  sketch.plant(0, 8, 'labShelvesWest');
  sketch.plant(8, 8, 'labShelvesEast');
  sketch.plant(0, 10, 'labPlant');
  sketch.plant(12, 10, 'labPlantEast');
  sketch.plant(5, 11, 'labMat');
  const wallMap: RoomThing = {
    name: 'THE WALL MAP',
    note: wallMapNote(game),
    tiles: WALL_MAP_TILES,
    opens: 'wall-map',
  };
  return { sketch, catalogue: LAB, things: [wallMap], sprites: [], wallMap: OAK_WALL_MAP };
}

/**
 * The Pokémon Center's ground floor. The staircase to the Cable Club is gone
 * - there is no upstairs - and the corner it stood in is where the ward goes
 * when Brock builds it.
 */
function drawCenter(room: BaseRoom, game: RestoredGame): Drawn {
  const sketch = shell(room);
  sketch.plant(0, 0, 'pcBack');
  sketch.plant(0, 5, 'pcSideWest');
  sketch.plant(14, 5, 'pcSideEast');
  sketch.plant(6, 5, 'pcEmblem');
  sketch.plant(11, 5, 'pcLounge');
  sketch.plant(6, 8, 'pcMat');
  const displays = standing(CENTER_DISPLAY, game);
  for (const display of displays) {
    for (const prop of display.props) sketch.plant(prop.x, prop.y, prop.name);
  }
  const waiting = pokemonNeedingRecovery(game.stash).length;
  const things = thingsFor(displays);
  const sprites = [...restingBalls(waiting)];
  if (waiting > 0) {
    things.push({
      name: waiting === 1 ? 'ONE POKÉ BALL' : `${waiting} POKÉ BALLS`,
      note: waiting === 1 ? 'Waiting to be treated' : 'Waiting on Joy to treat them',
      tiles: COUNTER_SEATS.map((x) => ({ x, y: 3 })),
    });
  }
  return { sketch, catalogue: CENTER, things, sprites };
}

/**
 * Brock's workshop, which is a room of FireRed's Rocket Warehouse: walled both
 * sides, lit from the top left, with the telephone and the grille on its back
 * wall and Brock behind his steel bench in the middle of it. Everything the
 * ladder builds has a bay here, and the bays nobody has paid for are bare
 * floor - which is the point of standing in it.
 */
function drawWorkshop(room: BaseRoom, game: RestoredGame): Drawn {
  const sketch = shell(room);
  sketch.plant(0, 0, 'whSideWest');
  sketch.plant(room.width - 1, 0, 'whSideEast');
  // The west wall's shade, down the floor beside it.
  for (let y = 3; y < room.height; y += 1) sketch.plant(1, y, 'whShade');
  sketch.plant(4, 0, 'whPhone');
  sketch.plant(5, 0, 'whVent');
  sketch.plant(6, 0, 'whVent');
  sketch.plant(3, 2, 'whBox');
  // His bench and his stool, as the warehouse stands them.
  sketch.plant(7, 6, 'whTable');
  sketch.plant(9, 7, 'whStool');
  // Stores: what he has not got round to yet.
  sketch.plant(13, 9, 'whBoxStack');
  sketch.plant(6, room.height - 1, 'whMat');
  const displays = standing(WORKSHOP_DISPLAY, game);
  for (const display of displays) {
    for (const prop of [...display.props, ...(display.shade ?? [])]) {
      sketch.plant(prop.x, prop.y, prop.name);
    }
  }
  return { sketch, catalogue: WAREHOUSE, things: thingsFor(displays), sprites: [] };
}

/**
 * Bill's house from FireRed, which is to say his two cell separators and the
 * tube between them - and his cabinet of oddities, which is everything the
 * player has ever bartered to him (`cabinet.ts`). Two units of empty shelving
 * stand either side of his desk from the start; the rows below them are left
 * bare for the second pair, which is carried in when the first is full.
 */
function drawCottage(room: BaseRoom, game: RestoredGame): Drawn {
  const sketch = shell(room);
  sketch.plant(0, 0, 'billPillar');
  sketch.plant(14, 0, 'billPillar');
  sketch.plant(1, 1, 'billPc');
  sketch.plant(2, 1, 'billSeparators');
  sketch.plant(12, 1, 'billPc');
  sketch.plant(6, 4, 'billDesk');
  const oddities = cabinetOddities(game.raidProgress);
  const layout = cabinetLayout(oddities, TILE_SIZE);
  const things: RoomThing[] = [];
  for (let unit = 0; unit < layout.units; unit += 1) {
    const at = CABINET_UNITS[unit];
    sketch.plant(at.x, at.y, 'billShelves');
    things.push({
      name: 'BILL’S CABINET',
      note: unitNote(layout, unit),
      tiles: unitTiles(unit),
      cabinetUnit: unit,
    });
  }
  for (const crate of layout.crates) sketch.plant(crate.tile.x, crate.tile.y, 'billBox');
  if (layout.crates.length > 0) {
    things.push({
      name: 'BILL’S CRATES',
      note: cratesNote(layout),
      tiles: layout.crates.map((crate) => crate.tile),
      crated: true,
    });
  }
  sketch.plant(1, 10, 'billPlant');
  sketch.plant(13, 10, 'billPlant');
  sketch.plant(6, 11, 'billMat');
  return { sketch, catalogue: COTTAGE, things, sprites: [], cabinet: { oddities, layout } };
}

// --- THE BOLTHOLE -----------------------------------------------------------

/**
 * The stretch of the front room's back wall the badge case hangs on: the four
 * tiles between the window and the stair mat, both wall rows deep, with nothing
 * planted over them (`rooms.test.ts` holds that). The case is a picture of the
 * save (`badgeCase.ts`), painted there by the scene as the wall map is.
 */
export const BADGE_CASE_WALL: Rect = { x: 8, y: 0, width: 4, height: 2 };

/** And the stretch of the bedroom wall the pennants are strung along. */
export const PENNANT_WALL: Rect = { x: 5, y: 0, width: 5, height: 2 };

/** Every tile of a stretch of wall: what is faced to read it, and what its caption is seated against. */
export function wallTiles(area: Rect): readonly GridPosition[] {
  return Array.from({ length: area.width * area.height }, (_tile, index) => ({
    x: area.x + (index % area.width),
    y: area.y + Math.floor(index / area.width),
  }));
}

/**
 * Downstairs, which is the player's house in Pallet Town as FireRed draws it:
 * the sink and the hob, the glass-fronted cupboard, the family television, the
 * window, the table on its green rug, and the stairs up with the orange mat at
 * their foot - and between the window and the stairs, THE BADGE CASE, which is
 * the first thing a player coming in through the door looks up at.
 */
function drawHome(room: BaseRoom, game: RestoredGame): Drawn {
  const sketch = shell(room);
  westShade(sketch, room);
  sketch.plant(0, 1, 'homeKitchen');
  sketch.plant(2, 0, 'homeCupboard');
  sketch.plant(5, 0, 'homeTv');
  sketch.plant(6, 0, 'homeWindow');
  sketch.plant(12, 2, 'homeStairMatUp');
  sketch.plant(13, 1, 'homeStairsUp');
  sketch.plant(4, 3, 'homeRugTable');
  sketch.plant(0, 6, 'homePlantWest');
  sketch.plant(14, 6, 'homePlantEast');
  sketch.plant(6, 8, 'homeMat');
  const things: RoomThing[] = [
    {
      name: 'THE BADGE CASE',
      note: badgeCaseNote(game),
      tiles: wallTiles(BADGE_CASE_WALL),
      lines: badgeCaseLines(game),
    },
    {
      name: 'THE TELLY',
      note: `${hunterRival(nextRival(game)).name} is on`,
      tiles: [{ x: 5, y: 1 }],
      lines: tellyLines(game),
    },
    {
      name: 'THE KITCHEN',
      note: 'The kettle is always on',
      tiles: [
        { x: 0, y: 1 },
        { x: 1, y: 1 },
      ],
      lines: ['The kettle is always on. Somebody has left a Potion in the fridge again.'],
    },
    {
      name: 'THE CUPBOARD',
      note: 'The good plates',
      tiles: [
        { x: 2, y: 1 },
        { x: 3, y: 1 },
      ],
      lines: ['The good plates. Nobody has ever eaten off them.'],
    },
  ];
  return {
    sketch,
    catalogue: HOUSE,
    things,
    sprites: [],
    posters: [{ kind: 'badge-case', area: BADGE_CASE_WALL }],
  };
}

/** Which of the upstairs rug's three colours this save's partner is. */
const RUG_PIECES: Readonly<Record<ReturnType<typeof partnerRug>, HomePropName>> = {
  green: 'homeRugTv',
  red: 'homeRugTvRed',
  blue: 'homeRugTvBlue',
};

/**
 * Upstairs is the player's room from the same house: the PC on its desk, the
 * chest of drawers and the bookcase of toys along the wall, the clipboard by
 * the stairs, the bed, and the telly on the rug with the console in front of
 * it - the room every one of these games begins in. The rug is the colour of
 * the player's partner, and along the wall hang the pennants of
 * every place the player has come home from.
 */
function drawUpstairs(room: BaseRoom, game: RestoredGame): Drawn {
  const sketch = shell(room);
  westShade(sketch, room);
  sketch.plant(0, 0, 'homePcDesk');
  sketch.plant(2, 1, 'homeDrawers');
  sketch.plant(3, 0, 'homeBookcase');
  sketch.plant(10, 0, 'homePoster');
  sketch.plant(11, 1, 'homeStairsDown');
  sketch.plant(13, 2, 'homeStairMatDown');
  sketch.plant(0, 4, 'homeBed');
  sketch.plant(7, 3, 'homeTvTop');
  sketch.plant(5, 4, RUG_PIECES[partnerRug(game)]);
  const things: RoomThing[] = [
    {
      name: 'PENNANTS',
      note: pennantsNote(game),
      tiles: wallTiles(PENNANT_WALL),
      lines: pennantLines(game),
    },
    {
      name: 'YOUR BED',
      note: 'Nobody hunts you here',
      tiles: [
        { x: 1, y: 5 },
        { x: 1, y: 6 },
      ],
      lines: bedLines(game),
      does: 'sleep',
    },
    {
      name: 'YOUR PC',
      note: 'The raid log',
      tiles: [{ x: 0, y: 1 }],
      lines: pcLines(game),
    },
    {
      name: 'THE CONSOLE',
      note: 'One more go',
      tiles: [
        { x: 7, y: 4 },
        { x: 7, y: 5 },
      ],
      lines: ['You play a quick game.'],
      does: 'play',
    },
    {
      name: 'THE BOOKCASE',
      note: 'Toys on top, books below',
      tiles: [
        { x: 3, y: 1 },
        { x: 4, y: 1 },
      ],
      lines: ['Toys on top, and below them every book about Kanto you have ever been given.'],
    },
    {
      name: 'THE CALENDAR',
      note: `Day ${calendarDay(game)}`,
      tiles: [{ x: 10, y: 1 }],
      lines: calendarLines(game),
    },
  ];
  return {
    sketch,
    catalogue: HOUSE,
    things,
    sprites: [],
    posters: [{ kind: 'pennants', area: PENNANT_WALL }],
  };
}

/**
 * The shade the house's west wall throws down the floor beside it, as FireRed
 * draws both of the player's rooms - planted first, so the furniture against
 * that wall stands over it.
 */
function westShade(sketch: MapSketch<RoomPropName>, room: BaseRoom): void {
  for (let y = 3; y < room.height; y += 1) sketch.plant(0, y, 'homeShade');
}

/** Two rows of back wall and floor to the room's edge. */
function shell(room: BaseRoom): MapSketch<RoomPropName> {
  const sketch = new MapSketch<RoomPropName>({ width: room.width, height: room.height, fill: 'P' });
  sketch.draw(0, 0, ['B'.repeat(room.width), 'B'.repeat(room.width)]);
  return sketch;
}

const DRAWERS: Readonly<Record<RoomId, (room: BaseRoom, game: RestoredGame) => Drawn>> = {
  'oaks-lab': drawLab,
  'pokemon-centre': drawCenter,
  'brocks-workshop': drawWorkshop,
  'bills-cottage': drawCottage,
  bolthole: drawHome,
  'bolthole-upstairs': drawUpstairs,
};

/** A room as it stands for this save. Rebuilt on every visit; a room is small. */
export function buildRoom(room: BaseRoom, game: RestoredGame): BuiltRoom {
  const drawn = DRAWERS[room.id](room, game);
  const layers = buildMapLayers(drawn.sketch, drawn.catalogue);
  return {
    room,
    sources: drawn.catalogue.sources,
    layers,
    collision: layers.collision,
    things: drawn.things,
    sprites: drawn.sprites,
    ...(drawn.cabinet ? { cabinet: drawn.cabinet } : {}),
    wallMap: drawn.wallMap ?? null,
    posters: drawn.posters ?? [],
  };
}

/** The props a room plants, by name - for the render tool and the tests. */
export function roomPropArt(name: RoomPropName): PropDefinition {
  return ROOM_PROPS[name];
}

/** Whether a tile is one the keeper serves from: facing them, or facing their counter. */
export function servesFrom(room: BaseRoom, facing: GridPosition): boolean {
  if (!room.keeper) {
    return false;
  }
  if (facing.x === room.keeper.position.x && facing.y === room.keeper.position.y) {
    return true;
  }
  return room.counter.some((tile) => tile.x === facing.x && tile.y === facing.y);
}
