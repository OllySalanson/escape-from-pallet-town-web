import type { GridPosition } from '../movement/gridMovement';
import { WORKSHOP_UPGRADES } from '../hub/workshop';
import { pokemonNeedingRecovery } from '../hub/recovery';
import type { RestoredGame } from '../save/SaveManager';
import type { Rect } from '../ui/labelPlacement';
import { MapSketch } from '../world/mapGrid';
import { buildMapLayers, type MapLayers } from '../world/tiles';
import type { PropDefinition } from '../world/tileset/catalogue';
import { floorPiece, pieceProp, roomCatalogue, solidPiece } from './baseSheet';
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

export type RoomId = 'oaks-lab' | 'pokemon-centre' | 'brocks-workshop' | 'bills-cottage';

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
  | 'whGenerator'
  | 'whPhone'
  | 'whVent'
  | 'whCrate'
  | 'whTerminals'
  | 'whMonitorDesk'
  | 'whBox'
  | 'whStool'
  | 'whMat'
  | 'healingMachineModel';

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
  whGenerator: solidPiece('warehouse.generator', 'generator'),
  whPhone: solidPiece('warehouse.phone', 'telephone'),
  whVent: solidPiece('warehouse.vent', 'vent'),
  whCrate: solidPiece('warehouse.crate', 'crate'),
  whTerminals: solidPiece('warehouse.terminals', 'radio set'),
  whMonitorDesk: solidPiece('warehouse.monitorDesk', 'monitors'),
  whBox: solidPiece('warehouse.box', 'box'),
  whStool: solidPiece('warehouse.stool', 'stool'),
  whMat: floorPiece('warehouse.mat', 'door mat'),
  healingMachineModel: solidPiece('lab.machineLifted', 'healing machine'),
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
  readonly screen: BaseScreen;
  /** The name over the door, and so the name of the room. */
  readonly name: string;
  readonly width: number;
  readonly height: number;
  /**
   * The door mat's middle tile: where the player is put down coming in, facing
   * into the room, and the one tile a push south from leaves by.
   */
  readonly mat: GridPosition;
  readonly keeper: BaseKeeper;
  /**
   * Counter tiles the keeper serves across. Facing one is speaking to them,
   * exactly as it is in the games this is dressed as.
   */
  readonly counter: readonly GridPosition[];
}

/** What Bill's cabinet holds this visit, and where each thing in it stands. */
export interface BuiltCabinet {
  readonly oddities: readonly Oddity[];
  readonly layout: CabinetLayout;
}

export interface BuiltRoom {
  readonly room: BaseRoom;
  readonly layers: MapLayers;
  readonly collision: readonly boolean[][];
  readonly things: readonly RoomThing[];
  readonly sprites: readonly RoomSprite[];
  /** Only in Bill's cottage. */
  readonly cabinet?: BuiltCabinet;
  /** Where the wall map hangs, in the one room it hangs in. */
  readonly wallMap: Rect | null;
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
}

/**
 * Every rung of Brock's ladder, standing in his workshop once it is built.
 *
 * The workshop is where the whole ladder can be seen at once - a bay a rung,
 * empty floor until it is paid for - so a player walking in reads how much of
 * the base they have built off the room rather than off a count. The things
 * themselves are the ones FireRed's warehouse has, picked for what each rung
 * does: the aerial is a radio set on the wall, the harbour light a generator,
 * each locker a crate on its pallet, each healing machine a copy of Oak's, and the
 * ward the bank of monitors that watches it.
 */
export const WORKSHOP_DISPLAY: readonly RungDisplay[] = [
  {
    upgradeId: 'radio-mast',
    name: 'THE RADIO SET',
    note: 'It hears the hunter',
    props: [{ name: 'whTerminals', x: 1, y: 1 }],
  },
  {
    upgradeId: 'beacon',
    name: 'THE BEACON’S LAMP',
    note: 'It lights your landing',
    props: [{ name: 'whGenerator', x: 9, y: 1 }],
  },
  {
    upgradeId: 'secure-locker-1',
    name: 'THE FIRST LOCKER',
    note: 'What a lost raid cannot take',
    props: [{ name: 'whCrate', x: 1, y: 4 }],
  },
  {
    upgradeId: 'secure-locker-2',
    name: 'THE SECOND LOCKER',
    note: 'Room for a second Pokémon',
    props: [{ name: 'whCrate', x: 4, y: 4 }],
  },
  {
    upgradeId: 'recovery-bay-1',
    name: 'HEALING MACHINE I',
    note: 'Joy quotes a quarter less',
    props: [{ name: 'healingMachineModel', x: 10, y: 4 }],
  },
  {
    upgradeId: 'recovery-bay-2',
    name: 'HEALING MACHINE II',
    note: 'Joy quotes half',
    props: [{ name: 'healingMachineModel', x: 10, y: 8 }],
  },
  {
    upgradeId: 'quarantine-ward',
    name: 'THE WARD’S MONITORS',
    note: 'One heal a raid, off the clock',
    props: [{ name: 'whMonitorDesk', x: 1, y: 8 }],
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
  },
  {
    id: 'brocks-workshop',
    screen: 'workshop',
    name: 'BROCK’S WORKSHOP',
    width: 13,
    height: 12,
    mat: { x: 6, y: 11 },
    keeper: {
      id: 'brock',
      name: 'BROCK',
      design: 'brock',
      position: { x: 6, y: 9 },
      facing: 'down',
    },
    counter: [],
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
  },
];

export function roomNamed(id: string): BaseRoom | undefined {
  return BASE_ROOMS.find((room) => room.id === id);
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
    tiles: propTiles(display.props),
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
 * Brock's workshop. Everything the ladder builds has a bay here, and the bays
 * nobody has paid for are bare floor - which is the point of standing in it.
 */
function drawWorkshop(room: BaseRoom, game: RestoredGame): Drawn {
  const sketch = shell(room);
  sketch.plant(5, 1, 'whPhone');
  sketch.plant(6, 1, 'whVent');
  sketch.plant(7, 1, 'whVent');
  sketch.plant(12, 2, 'whBox');
  // What he is working on, and somewhere to sit while he does.
  sketch.plant(4, 10, 'whBox');
  sketch.plant(5, 10, 'whBox');
  sketch.plant(7, 10, 'whStool');
  sketch.plant(5, 11, 'whMat');
  const displays = standing(WORKSHOP_DISPLAY, game);
  for (const display of displays) {
    for (const prop of display.props) sketch.plant(prop.x, prop.y, prop.name);
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
};

/** A room as it stands for this save. Rebuilt on every visit; a room is small. */
export function buildRoom(room: BaseRoom, game: RestoredGame): BuiltRoom {
  const drawn = DRAWERS[room.id](room, game);
  const layers = buildMapLayers(drawn.sketch, drawn.catalogue);
  return {
    room,
    layers,
    collision: layers.collision,
    things: drawn.things,
    sprites: drawn.sprites,
    ...(drawn.cabinet ? { cabinet: drawn.cabinet } : {}),
    wallMap: drawn.wallMap ?? null,
  };
}

/** The props a room plants, by name - for the render tool and the tests. */
export function roomPropArt(name: RoomPropName): PropDefinition {
  return ROOM_PROPS[name];
}

/** Whether a tile is one the keeper serves from: facing them, or facing their counter. */
export function servesFrom(room: BaseRoom, facing: GridPosition): boolean {
  if (facing.x === room.keeper.position.x && facing.y === room.keeper.position.y) {
    return true;
  }
  return room.counter.some((tile) => tile.x === facing.x && tile.y === facing.y);
}
