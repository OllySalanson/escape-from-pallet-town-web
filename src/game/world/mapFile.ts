import type { ItemId } from '../items';
import { onlyMapFileFields } from './mapFileRebuild';
import {
  FLOODPLAIN_REED_WILDLIFE,
  FLOODPLAIN_TOWN_WILDLIFE,
  FOREST_EDGE_WILDLIFE,
  PALLET_DELVE_WILDLIFE,
  PALLET_FIELD_WILDLIFE,
  PALLET_SHORE_WILDLIFE,
  POWER_PLANT_WILDLIFE,
  SAFARI_ZONE_WILDLIFE,
  SUMMIT_WILDLIFE,
  LOST_GARDEN_WILDLIFE,
  ICEFALL_WILDLIFE,
  ROUTE_MEADOW_WILDLIFE,
  type WildEncounterTable,
} from '../pokemon/encounters';
import { Pokemon } from '../pokemon';
import type { Direction } from '../movement/gridMovement';
import type { CastCharacterDesignId } from './characterDesigns';
import type { MapDistrict } from './districts';
import type { WorldMapId } from '../worldMap';
import type { MapGate } from './gates';
import type { FieldMoveId } from './fieldMoves';
import type { MapLedge } from './ledges';
import { WeatherId } from '../pokemon/battle/weather';
import type { ExtractionPoint } from './extractionPoints';
import type { WorldEntity } from './npcs';
import { isFigureSpecies, pokemonCry, type FigureSpeciesId } from './pokemonFigures';
import { isLegendaryKind } from './legends';
import { BERRY_IDS, berryTreeLines, type BerryId } from './berries';
import { BOULDER_LINES } from './boulders';
import type { WorldSwitch } from './switches';
import type { WorldPoi } from './pois';
import { createRunTrainerEncounters, type RunTrainerEncounter } from './trainers';
import type { WorldLoot } from './loot';
import { MapSketch, type PropStamp } from './mapGrid';
import { PLAYER_MAP_TILESET, type PlayerMapPropName } from './tileset/playerMapTileset';
import { TOWN_PIECES, type TownPieceName } from './generated/townPieces';
import { MATERIAL_CHARS, MATERIALS, type Material } from './tileset/materials';
import type { PropDefinition, TilesetCatalogue } from './tileset/catalogue';
import {
  CAVE_STYLES,
  INSIDE_PROPS,
  INSIDE_STYLES,
  ROOM_STYLES,
  TUNNEL_STYLES,
  type InsidePropName,
  type InsideStyle,
} from './tileset/insideTileset';
import {
  composeMapFile,
  layOutMapFile,
  type ComposedMap,
  type PlacedArea,
} from './mapAreas';
import { foldedSlug, isMapText, typedMapText } from './mapText';
import { RAID_DURATION_MS } from '../run/raidClock';

/**
 * A raid map as one file.
 *
 * The five maps the game shipped with are each spread across a dozen modules -
 * the drawing in `maps/`, the exits in `extractionPoints.ts`, the landings in
 * `runGeneration.ts`, the loot in `worldMap.ts` - which is fine for a map the
 * game's own authors draw and impossible for a map a player draws. A map file
 * is everything one map is, in one JSON document a player's editor can write,
 * a reviewer can play and the game can load beside the five without any of
 * them knowing it is there (`playerMaps.ts` is the registry that does that).
 *
 * The vocabulary is the one the shipped maps are already authored in, so a file
 * map is drawn by exactly the machinery that draws Viridian City: the ground is
 * rows of material letters (`tileset/materials.ts`) on the Kanto sheet, with
 * the same stamps Viridian City uses for ledges, flowers and bushes; buildings
 * are planted by name. What a file never carries is a tile number, an item or a
 * Pokemon: a maker says *where* there is something to find and *what kind of
 * country* the grass is, and the game decides what is in it (the captain's P2).
 *
 * Every exit carries `opens` from the first version, because the locks, keys
 * and pickaxe planned for later are new values of that one field rather than a
 * new shape of file.
 *
 * A map may also hold **areas** - the inside of a building, and later a cave -
 * each drawn as a little map of its own, and **links** between them: a
 * building's door and the mat inside it. Both are optional, and everything
 * placed says which area it stands in with an optional `area`, so a file that
 * has none is the outdoor map it always was (`docs/maker-areas.md`).
 */

/** The version of the file format this code reads and writes. */
export const MAP_FILE_FORMAT = 1;

/** The smallest and largest map a file may describe, in tiles. */
export const MAP_FILE_LIMITS = {
  minWidth: 20,
  minHeight: 16,
  maxWidth: 256,
  maxHeight: 256,
  /** Bytes of JSON: the submission service holds the same line. */
  maxBytes: 250_000,
  maxNameLength: 24,
  maxMakerLength: 24,
  maxPlaceNameLength: 20,
  maxDescriptionLength: 160,
  maxDropIns: 8,
  maxExits: 12,
  maxItemSpots: 40,
  /** The latest an exit may open: the raid clock is five minutes. */
  maxExitDelaySeconds: 240,
  maxPeople: 30,
  maxSigns: 30,
  maxLandmarks: 16,
  maxDistricts: 16,
  maxDoors: 16,
  maxPokemon: 30,
  maxBerryTrees: 30,
  maxBoulders: 40,
  /** The highest level a standing Pokemon may fight at: the top of the ladder the game's own trainers sit on. */
  maxPokemonLevel: 50,
  /**
   * Standing Pokemon marked legendary (`legends.ts`): none on a player's map,
   * where a legend would be a boss nobody measured. The game's own maps drawn as
   * files may stand them (`BUILT_IN_MAP_FILE_LIMITS`).
   */
  maxLegends: 0,
  /** The widest or deepest a stretch of water Surf opens may be. */
  maxDoorSide: 12,
  maxTrainers: 12,
  /** What one person, sign or trainer may say: a few short lines. */
  maxLines: 4,
  maxLineLength: 120,
  /** How far a trainer may watch along the way they face. */
  maxSight: 4,
  /** Places that are not the outdoor map: insides, and later caves. */
  maxAreas: 16,
  /** Ways between places: a door and its mat are one. */
  maxLinks: 32,
  /**
   * How big an inside may be. FireRed's smallest house is eight by six and its
   * Pokemon Center fifteen by ten; a mansion floor is wider than the screen,
   * which is allowed, because a room the camera has to follow is still a room.
   */
  minInsideWidth: 6,
  minInsideHeight: 5,
  maxInsideWidth: 40,
  maxInsideHeight: 32,
  /**
   * How big a cave may be: Mt. Moon's floors are forty-eight by forty, and a
   * cave is somewhere to get lost in.
   */
  minCaveWidth: 8,
  minCaveHeight: 6,
  maxCaveWidth: 64,
  maxCaveHeight: 64,
  maxFurniture: 80,
} as const;

/** What a map file may hold, field by field: `MAP_FILE_LIMITS` is a player's. */
export type MapFileLimits = { readonly [Limit in keyof typeof MAP_FILE_LIMITS]: number };

/**
 * What the game's own maps drawn as files may hold (Greystone Vale, read by
 * `builtInFileMap` and written by `tools/mapcraft`). A vale six districts
 * square needs more landings, ways out and places than a map anybody draws
 * in an evening, and nothing a player sends is read against these:
 * `submit_map` and the map maker keep `MAP_FILE_LIMITS`. A room or a cave in
 * one is the size a player's may be.
 *
 * And it may be bigger: 384 tiles square, six 64-tile districts, where a
 * player's is 256. Measured before the vale grew to it (13 Oct 2026, the same
 * fourteen districts stitched at both sizes, docs/screens/greystone-vale/):
 * the file is 193 KB against 110 KB and 12.5 KB against 11.5 KB gzipped; the
 * map takes 0.4 s to build against 0.2 s and holds 34 MB against 16; in the
 * browser a raid there starts 0.3 s later, holds 192 MB of JavaScript heap
 * against 106, and walks at the same 57-59 frames a second. What it costs is
 * memory, and it grows with the grid's tiles, wood and sea included.
 */
export const BUILT_IN_MAP_FILE_LIMITS: MapFileLimits = {
  ...MAP_FILE_LIMITS,
  maxWidth: 384,
  maxHeight: 384,
  maxBytes: 1_000_000,
  maxDropIns: 16,
  maxExits: 32,
  maxItemSpots: 96,
  maxPeople: 64,
  maxSigns: 64,
  maxLandmarks: 32,
  maxDistricts: 32,
  maxTrainers: 32,
  maxAreas: 32,
  maxLinks: 64,
  maxLegends: 2,
};

/** Every file map's id is its own id with this in front, so none can collide with a shipped map. */
export const PLAYER_MAP_PREFIX = 'player-';

export type PlayerMapId = `${typeof PLAYER_MAP_PREFIX}${string}`;

/** The longest id a map file may carry. */
export const MAP_FILE_ID_MAX_LENGTH = 40;

/**
 * Ids the game keeps for maps of its own, so no published map may take one:
 * `try-it` is the draft being tried in the editor (`maker/tryIt.ts`), which is
 * registered over whatever map already has the id and unregistered after, and
 * `suite-fixture` is the approved map every test file runs with
 * (`publishedMapFixture.testkit.ts`). The sample's id is taken by its own file.
 */
export const RESERVED_MAP_FILE_IDS: readonly string[] = ['try-it', 'suite-fixture'];

/**
 * The id a newly published map is given: its own, unless another map already
 * holds it or the game keeps it, and then its own with -2, -3... on the end -
 * cut short first where it has to be, so the id it ends up with is still one
 * `readMapFile` takes. A 40-letter id published twice used to become 42 letters
 * and a file the game could not load.
 */
export function freeMapFileId(id: string, taken: ReadonlySet<string>): string {
  const isFree = (candidate: string): boolean =>
    !taken.has(candidate) && !RESERVED_MAP_FILE_IDS.includes(candidate);
  if (isFree(id) && id.length <= MAP_FILE_ID_MAX_LENGTH) {
    return id;
  }
  for (let suffix = 2; ; suffix += 1) {
    const end = `-${suffix}`;
    const stem = id.slice(0, MAP_FILE_ID_MAX_LENGTH - end.length).replace(/-+$/, '');
    const candidate = `${stem}${end}`;
    if (isFree(candidate)) {
      return candidate;
    }
  }
}

/**
 * A fix to a published map, made ready to replace it under the same id: every
 * drop-in that is one the published map had keeps that one's id, so a landing a
 * player reached is still reached after the fix renamed or moved it
 * (playtest 35's bug 4; the owner's call, option a). A drop-in is the same one
 * when it keeps its name, else when it stands on the same tile, else - for the
 * ones left on both sides - in the order they are listed, so a drop-in renamed
 * and nudged in the same fix still keeps its id. One the fix added keeps the
 * id its name gives it, which no published one can already hold: a name that
 * matched one would have been paired with it first.
 */
export function keepPublishedIds(published: MapFile, update: MapFile): MapFile {
  const left = published.dropIns.map((dropIn) => ({ dropIn, key: dropInKey(dropIn) }));
  const kept = new Map<number, string>();
  const take = (index: number, found: number): void => {
    kept.set(index, left[found].key);
    left.splice(found, 1);
  };
  const sameTile = (one: MapFileSpot, other: MapFileSpot): boolean =>
    one.x === other.x && one.y === other.y && one.area === other.area;
  update.dropIns.forEach((dropIn, index) => {
    const found = left.findIndex((old) => old.key === dropInKey(dropIn));
    if (found >= 0) {
      take(index, found);
    }
  });
  update.dropIns.forEach((dropIn, index) => {
    const found = kept.has(index) ? -1 : left.findIndex((old) => sameTile(old.dropIn, dropIn));
    if (found >= 0) {
      take(index, found);
    }
  });
  update.dropIns.forEach((_dropIn, index) => {
    if (!kept.has(index) && left.length > 0) {
      take(index, 0);
    }
  });
  return {
    ...update,
    id: published.id,
    dropIns: update.dropIns.map((dropIn, index) => {
      const key = kept.get(index) ?? placeSlug(dropIn.name);
      const rest = { ...dropIn };
      delete (rest as { id?: string }).id;
      return key === placeSlug(dropIn.name) ? rest : { ...rest, id: key };
    }),
  };
}

/**
 * The letters a file's ground may use: every material's own letter, plus the
 * stamps Viridian City is drawn with. A stamp is a landmark drawn as a letter -
 * a ledge's run and its two ends, flowers and a bush - so it travels with the
 * picture rather than in a list beside it.
 */
export const MAP_FILE_STAMPS: Readonly<Record<string, PropStamp<PlayerMapPropName>>> = {
  '<': { prop: 'bankWest', anchor: [0, 0], ground: '.' },
  '=': { prop: 'bank', anchor: [0, 0], ground: '.' },
  '>': { prop: 'bankEast', anchor: [0, 0], ground: '.' },
  f: { prop: 'flowers', anchor: [0, 0], ground: '.' },
  r: { prop: 'flowers', anchor: [0, 0], ground: '"' },
  o: { prop: 'shrub', anchor: [0, 0], ground: '.' },
  u: { prop: 'shrub', anchor: [0, 0], ground: '"' },
  k: { prop: 'shrub', anchor: [0, 0], ground: 'P' },
};

// Ice is a cave's floor, drawn from Icefall Cave: no outdoor sheet has it.
const GROUND_LETTERS = new Set([
  ...Object.values(MATERIAL_CHARS).filter((letter) => letter !== MATERIAL_CHARS.ice),
  ...Object.keys(MAP_FILE_STAMPS),
]);

/**
 * What a file calls a building, and the Kanto landmark it plants. The file has
 * its own words rather than the catalogue's prop names, so renaming a prop in
 * the code can never break a map somebody has already published.
 */
export const MAP_FILE_BUILDINGS = {
  house: 'house',
  'house-door': 'houseDoor',
  'house-flowers': 'houseFlowers',
  cottage: 'cottage',
  'cottage-door': 'cottageDoor',
  'pokemon-center': 'pokemonCenter',
  'pokemon-center-door': 'pokemonCenterDoor',
  'poke-mart': 'pokeMart',
  'poke-mart-door': 'pokeMartDoor',
  gym: 'gym',
  'forest-gate': 'forestGate',
  // Route 2's gatehouse, cut from pret's Route 2 (`townSheet.ts`), walked through.
  'route-gate': 'route2Gate',
  'league-gate': 'leagueGate',
  // The mouth of a cave, cut into the foot of a rock face: the way into one.
  'cave-mouth': 'caveMouth',
  sign: 'signTown',
  'sign-tips': 'signTips',
  // Everything below is the second palette (2026-10-10): every other thing
  // the game already draws that a map can stand, by the file's own word.
  shop: 'building',
  shed: 'shed',
  'blue-cottage': 'blueCottage',
  'timber-house': 'timberHouse',
  hut: 'hut',
  tower: 'tower',
  roundhouse: 'roundhouse',
  'stone-gatehouse': 'stoneGatehouse',
  shrine: 'shrine',
  tree: 'tree',
  'tree-2': 'treeAlt',
  pine: 'pine',
  'tall-bush': 'tallBush',
  'small-tree': 'cutTree',
  rock: 'rock',
  'rock-stair': 'rockStair',
  'round-boulder': 'roundBoulder',
  'wet-rock': 'wetRock',
  stump: 'stump',
  'big-stump': 'bigStump',
  'dead-stump': 'deadStump',
  log: 'log',
  lilies: 'lilies',
  'lilies-wide': 'liliesWide',
  fountain: 'fountain',
  'stone-fountain': 'stoneFountain',
  'plaza-steps': 'plazaSteps',
  statue: 'statue',
  gravestone: 'gravestone',
  'gravestone-worn': 'gravestoneWorn',
  'stone-arch': 'stoneArch',
  'gate-arch': 'gateArch',
  'stone-bridge': 'stoneBridge',
  bridge: 'bridgeVertical',
  'bridge-across': 'bridgeHorizontal',
  jetty: 'jetty',
  'market-stall': 'marketStall',
  'striped-stall': 'stripedStall',
  awning: 'awning',
  'produce-stall': 'produceStall',
  'stall-counter': 'stallCounter',
  banner: 'banner',
  banners: 'bannerPair',
  flag: 'flag',
  pot: 'pot',
  planter: 'planter',
  'pot-plant': 'potPlant',
  crate: 'crate',
  crates: 'crates',
  'crate-pair': 'cratePair',
  'crate-stack': 'crateStack',
  'crate-tower': 'crateTower',
  barrel: 'barrel',
  barrels: 'barrelPair',
  sack: 'sack',
  produce: 'produce',
  'produce-crate': 'produceCrate',
  bench: 'bench',
  'mooring-post': 'mooringPost',
  'fence-post': 'fencePost',
  'rail-post': 'railPost',
  seedlings: 'bedSeedlings',
  'yellow-crop': 'bedYellowCrop',
  'red-crop': 'bedRedCrop',
  signpost: 'signpost',
  'notice-board': 'noticeBoard',
  'gym-sign': 'signGym',
  signboard: 'signboard',
  // Kanto's own town buildings, cut from FireRed's maps (`townSheet.ts`).
  museum: 'museum',
  'department-store': 'deptStore',
  'silph-co': 'silphCo',
  'game-corner': 'gameCorner',
  'pokemon-tower': 'pokemonTower',
  'power-plant': 'powerPlant',
  'pokemon-mansion': 'burntMansion',
  'research-lab': 'cinnabarLab',
  dojo: 'dojo',
  'bike-shop': 'bikeShop',
  'safari-gate': 'safariGate',
  'city-gate': 'cityGate',
  'saffron-gate': 'saffronGate',
  'saffron-side-gate': 'saffronSideGate',
  'underground-path': 'pathHut',
  'pewter-gym': 'pewterGym',
  'cerulean-gym': 'ceruleanGym',
  'vermilion-gym': 'vermilionGym',
  'celadon-gym': 'celadonGym',
  'fuchsia-gym': 'fuchsiaGym',
  'saffron-gym': 'saffronGym',
  'cinnabar-gym': 'cinnabarGym',
  pier: 'pier',
  'round-fountain': 'roundFountain',
  flats: 'flats',
  'small-flats': 'smallFlats',
  apartments: 'apartments',
  terrace: 'terrace',
  diner: 'diner',
  'brick-shops': 'brickRow',
  'grey-house': 'greyHouse',
  'blue-house': 'blueHouse',
  'orange-house': 'orangeHouse',
  'flower-house': 'flowerHouse',
  'fan-club': 'fanClub',
  'purple-house': 'purpleHouse',
  'green-house': 'greenHouse',
  'green-cottage': 'greenCottage',
  'warden-house': 'wardenHouse',
  // And what stands in its fields, from the game's object graphics.
  'wooden-sign': 'woodenSign',
  'route-sign': 'metalSign',
  'gym-statue': 'gymStatue',
  'town-map': 'townMap',
  'lapras-doll': 'laprasDoll',
  'strange-stone': 'ancientStone',
  'ss-anne': 'ssAnne',
  'ferry': 'seagallop',
} as const satisfies Record<string, PlayerMapPropName>;

export type MapFileOutdoorBuildingKind = keyof typeof MAP_FILE_BUILDINGS;

/**
 * What a file calls the furniture of an inside, and the piece it plants. As
 * with buildings, the file keeps its own words.
 */
export const MAP_FILE_FURNITURE = {
  computers: 'computers',
  bookcase: 'bookshelves',
  machine: 'machine',
  table: 'table',
  'shelves-books': 'shelvesWest',
  'shelves-jars': 'shelvesEast',
  'shelves-empty': 'shelvesEmpty',
  plant: 'plant',
  'plant-pot': 'plantEast',
  'tall-plant': 'tallPlant',
  'house-plant': 'housePlant',
  bed: 'bed',
  'center-counter': 'centerCounter',
  'center-wall-west': 'centerWallWest',
  'center-wall-east': 'centerWallEast',
  'center-emblem': 'emblem',
  seats: 'seats',
  'healing-machine': 'healingMachine',
  pillar: 'pillar',
  'cell-separators': 'separators',
  pc: 'pc',
  desk: 'desk',
  'wooden-box': 'crate',
  books: 'books',
  drawers: 'drawer',
  generator: 'generator',
  telephone: 'telephone',
  vent: 'vent',
  'big-crate': 'bigCrate',
  'radio-set': 'radioSet',
  stool: 'stool',
  monitors: 'monitors',
  workbench: 'workbench',
  sofa: 'sofa',
  bunk: 'bunk',
  box: 'box',
  boxes: 'boxStack',
  'tall-box': 'tallBox',
  // FireRed's own house, cut clear of its floor, and its Poké Mart.
  window: 'window',
  cupboard: 'cupboard',
  television: 'television',
  'kitchen-sink': 'kitchenSink',
  'small-rug': 'smallRug',
  'dining-table': 'diningTable',
  'potted-plant': 'pottedPlant',
  'computer-desk': 'computerDesk',
  'tall-drawers': 'tallDrawers',
  bookshelf: 'bookshelf',
  notice: 'notice',
  'single-bed': 'singleBed',
  rug: 'rug',
  'mart-counter': 'martCounter',
  'mart-till': 'martTill',
  'mart-case': 'martCase',
  'mart-rack': 'martRack',
  'mart-racks': 'martRacks',
  'mart-fridges': 'martFridges',
  'mart-wall-shelves': 'martWallShelves',
  'mart-plant': 'martPlant',
  'mart-poster': 'martPoster',
  'mart-wall-west': 'martWallWest',
  'mart-wall-east': 'martWallEast',
  'mart-corner-west': 'martCornerWest',
  'mart-corner-east': 'martCornerEast',
  // A cave's: Mt. Moon's.
  boulder: 'caveBoulder',
  rocks: 'caveRocks',
  crater: 'caveCrater',
  'dripping-water': 'caveDrip',
  // A cave of ice's: Icefall Cave's, standing on its floor or its ice.
  'ice-boulder': 'iceBoulder',
  'ice-boulder-low': 'iceBoulderLow',
  'ice-boulder-tall': 'iceBoulderTall',
  'ice-rock': 'iceRock',
  'ice-crystal': 'iceCrystal',
  'ice-crystal-low': 'iceCrystalLow',
  // A gatehouse's: FireRed's own, from the one on Route 2 and the two kinds
  // into Saffron.
  'gate-window': 'gateWindow',
  'gate-plant': 'gatePlant',
  'gate-table': 'gateDesk',
  'gate-chair': 'gateChair',
  'gate-chair-east': 'gateChairEast',
  'gate-counter': 'gateCounter',
  'gate-long-counter': 'gateLongCounter',
  'gate-runner': 'gateRunner',
  'gate-short-runner': 'gateShortRunner',
  'gate-rug': 'gateWideRug',
  // The Underground Path entrance's: the guards' counters either side of the
  // stairwell.
  'path-counter': 'pathCounterWest',
  'path-counter-east': 'pathCounterEast',
} as const satisfies Record<string, InsidePropName>;

export type MapFileFurnitureKind = keyof typeof MAP_FILE_FURNITURE;

/** Anything a map plants: a building outdoors, or a piece of furniture inside. */
export type MapFileBuildingKind = MapFileOutdoorBuildingKind | MapFileFurnitureKind;

/** The landmark a planted thing is, wherever it stands. */
export function plantedProp(kind: MapFileBuildingKind): PropDefinition {
  if (Object.hasOwn(MAP_FILE_BUILDINGS, kind)) {
    return PLAYER_MAP_TILESET.props[MAP_FILE_BUILDINGS[kind as MapFileOutdoorBuildingKind]];
  }
  return INSIDE_PROPS[MAP_FILE_FURNITURE[kind as MapFileFurnitureKind]];
}

// Asked with `Object.hasOwn`, never `in`: a kind is a file's own text, and `in`
// also answers yes for `constructor`, `toString` and every other name a plain
// object inherits - which then indexes nothing and throws (red team F1).
export function isOutdoorBuilding(kind: string): kind is MapFileOutdoorBuildingKind {
  return Object.hasOwn(MAP_FILE_BUILDINGS, kind);
}

export function isFurniture(kind: string): kind is MapFileFurnitureKind {
  return Object.hasOwn(MAP_FILE_FURNITURE, kind);
}

/**
 * A way into a building: the first cell of its footprint that is pressed into,
 * how many cells along its wall it runs - FireRed draws a shop's door two
 * cells wide, and every cell of it takes you in - and the way it is pressed:
 * up into a door, or, on a gatehouse walked through from one side to the
 * other, down off the ridge of its roof or across into a porch. It is stood at
 * from the tile before that cell (`buildingDoorways`).
 */
export interface MapFileBuildingDoor {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly toward: MapFileFacing;
}

const door = (x: number, y: number, width = 1, toward: MapFileFacing = 'up'): MapFileBuildingDoor => ({
  x,
  y,
  width,
  toward,
});

/** A step each way, for a door's own cells: the movement module's table, kept here so the format reads standalone. */
const FACING_STEP: Readonly<Record<MapFileFacing, { readonly x: number; readonly y: number }>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/** Whether a door pressed this way runs along a row of cells, rather than down a column of them. */
const runsAlongARow = (toward: MapFileFacing): boolean => toward === 'up' || toward === 'down';

/**
 * Kanto's town buildings whose warps are no door of theirs: the pier's are the
 * S.S. Anne's gangway, and Saffron's city gate is only the front of a gatehouse,
 * whose far side FireRed draws on the route beyond it.
 */
const NOT_A_DOOR: ReadonlySet<string> = new Set(['pier', 'city-gate']);

/**
 * Kanto's gatehouses, walked through from one side to the other: every door
 * FireRed gives them is a way through, the far side's as well as the front.
 */
const WALKED_THROUGH: ReadonlySet<string> = new Set([
  'route-gate',
  'saffron-gate',
  'saffron-side-gate',
]);

/**
 * A Kanto town building's doors, where FireRed's own map puts them: the doors
 * the town cutter read off the town's map (`TOWN_PIECES[...].doors` - only
 * warps FireRed fires, each with the way it is gone through), each run of them
 * along a wall one door as wide as the run. A door FireRed walks you up into is
 * pressed up into the cell it is drawn on; an arrow warp is stood on and
 * pressed the way it points, into the building beside it. The front door - the
 * bottom row's run of doors walked into - comes first, and is the only one
 * unless the building is a gatehouse.
 */
function townDoors(piece: TownPieceName, walkedThrough: boolean): readonly MapFileBuildingDoor[] {
  const cells = (TOWN_PIECES[piece].doors as readonly (readonly [number, number, string])[]).map(
    ([x, y, way]) => {
      if (way === 'door') {
        return { x, y, toward: 'up' as const, walkedInto: true };
      }
      const toward = way as MapFileFacing;
      return { x: x + FACING_STEP[toward].x, y: y + FACING_STEP[toward].y, toward, walkedInto: false };
    },
  );
  const runs: (MapFileBuildingDoor & { readonly walkedInto: boolean })[] = [];
  for (const cell of [...cells].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const index = runs.findIndex(
      (run) =>
        run.toward === cell.toward &&
        run.walkedInto === cell.walkedInto &&
        (runsAlongARow(run.toward)
          ? run.y === cell.y && run.x + run.width === cell.x
          : run.x === cell.x && run.y + run.width === cell.y),
    );
    if (index >= 0) {
      runs[index] = { ...runs[index], width: runs[index].width + 1 };
    } else {
      runs.push({ ...door(cell.x, cell.y, 1, cell.toward), walkedInto: cell.walkedInto });
    }
  }
  const ordered = [...runs].sort(
    (a, b) => Number(b.walkedInto) - Number(a.walkedInto) || b.y - a.y || a.x - b.x,
  );
  const doors = walkedThrough ? ordered : ordered.filter((run) => run.walkedInto).slice(0, 1);
  return doors.map(({ x, y, width, toward }) => door(x, y, width, toward));
}

/**
 * Where each building's doors are, as cells of its footprint, the way in by
 * its front first. A building with a door can be given an inside: linking the
 * tile it is stood at to a mat in a room is what opens it, and a gatehouse's
 * second door is the way out of the room's far side. The rest - signs, the
 * buildings drawn shut - have none.
 */
export const MAP_FILE_BUILDING_DOORS: Readonly<
  Partial<Record<MapFileOutdoorBuildingKind, readonly MapFileBuildingDoor[]>>
> = {
  house: [door(1, 3)],
  'house-door': [door(1, 3)],
  'house-flowers': [door(1, 3)],
  cottage: [door(3, 2)],
  'cottage-door': [door(3, 2)],
  'pokemon-center': [door(2, 4)],
  'pokemon-center-door': [door(2, 4)],
  'poke-mart': [door(2, 3)],
  'poke-mart-door': [door(2, 3)],
  gym: [door(3, 4)],
  // The buildings the second palette brought, each measured off its own
  // drawing: the shed's plank door, the cottage's, the timber house's arch,
  // and the shop's and the hut's, which are drawn across two cells. The tower
  // and the roundhouse have none.
  shed: [door(1, 3)],
  'blue-cottage': [door(3, 2)],
  'timber-house': [door(2, 4)],
  shop: [door(1, 3, 2)],
  hut: [door(0, 2, 2)],
  // A cave mouth is all door.
  'cave-mouth': [door(0, 0)],
  // And every one of Kanto's town buildings FireRed lets you into.
  ...Object.fromEntries(
    (Object.entries(MAP_FILE_BUILDINGS) as [MapFileOutdoorBuildingKind, string][]).flatMap(
      ([kind, prop]) => {
        const doors =
          prop in TOWN_PIECES && !NOT_A_DOOR.has(kind)
            ? townDoors(prop as TownPieceName, WALKED_THROUGH.has(kind))
            : [];
        return doors.length > 0 ? [[kind, doors]] : [];
      },
    ),
  ),
};

/**
 * A way into a building where its link's end stands: the tile before its
 * door's first cell, the way that cell is pressed from there, and how many
 * tiles along its wall it is stood at from.
 */
export interface BuildingDoorway extends MapFileSpot {
  readonly toward: MapFileFacing;
  readonly width: number;
}

/** Every way into a building, its front door first. */
export function buildingDoorways(building: MapFileBuilding): readonly BuildingDoorway[] {
  return (MAP_FILE_BUILDING_DOORS[building.kind as MapFileOutdoorBuildingKind] ?? []).map(
    ({ x, y, width, toward }) => ({
      x: building.x + x - FACING_STEP[toward].x,
      y: building.y + y - FACING_STEP[toward].y,
      toward,
      width,
    }),
  );
}

/** The tile its front door is stood at - where the link's end into it stands - or undefined. */
export function doorFront(building: MapFileBuilding): MapFileSpot | undefined {
  const front = buildingDoorways(building)[0];
  return front ? { x: front.x, y: front.y } : undefined;
}

/**
 * The building outdoors, and which of its ways in, that a link's end stands
 * at and presses the way that door is pressed.
 */
export function buildingDoorAt(
  file: Pick<MapFile, 'buildings'>,
  end: Pick<MapFileLinkEnd, 'x' | 'y' | 'toward' | 'area'>,
): { readonly building: MapFileBuilding; readonly doorway: BuildingDoorway; readonly index: number } | undefined {
  if (end.area !== undefined) {
    return undefined;
  }
  for (const building of file.buildings) {
    const index = buildingDoorways(building).findIndex(
      (doorway) => doorway.x === end.x && doorway.y === end.y && doorway.toward === end.toward,
    );
    if (index >= 0) {
      return { building, doorway: buildingDoorways(building)[index], index };
    }
  }
  return undefined;
}

/** The tiles a door is stood at from, along its wall: one, or as many as FireRed draws it wide. */
export function doorwayTiles(doorway: BuildingDoorway): readonly MapFileSpot[] {
  return Array.from({ length: doorway.width }, (_, step) =>
    runsAlongARow(doorway.toward)
      ? { x: doorway.x + step, y: doorway.y }
      : { x: doorway.x, y: doorway.y + step },
  );
}

/**
 * What kind of place an area is: the inside of a building; a cave - the same
 * thing in rock, whose floor is wild ground on every step; or a tunnel, the
 * Underground Path's, gone down into by the stairs in a hut and come up out of
 * in another.
 */
export const MAP_FILE_AREA_KINDS = ['inside', 'cave', 'tunnel'] as const;
export type MapFileAreaKind = (typeof MAP_FILE_AREA_KINDS)[number];

/** How an area is dressed: which FireRed room, or which cave, its ground is. */
export const MAP_FILE_AREA_STYLES: readonly InsideStyle[] = INSIDE_STYLES;
export type MapFileAreaStyle = InsideStyle;

/** The styles each kind of area may be dressed in. */
export const MAP_FILE_STYLES_OF: Readonly<Record<MapFileAreaKind, readonly MapFileAreaStyle[]>> = {
  inside: ROOM_STYLES,
  cave: CAVE_STYLES,
  tunnel: TUNNEL_STYLES,
};

/**
 * The ground letters each kind of area may use: a floor and a wall; a room's
 * dark beyond its walls (`C`), where FireRed cuts a room to a shape that is
 * not a box; and a cave's sand.
 */
export const MAP_FILE_AREA_LETTERS: Readonly<Record<MapFileAreaKind, readonly string[]>> = {
  inside: [MATERIAL_CHARS.paving, MATERIAL_CHARS.wall, MATERIAL_CHARS.cliff],
  cave: [MATERIAL_CHARS.paving, MATERIAL_CHARS.wall, MATERIAL_CHARS.sand, MATERIAL_CHARS.ice],
  tunnel: [MATERIAL_CHARS.paving, MATERIAL_CHARS.wall],
};

/**
 * A tunnel is the size FireRed made the Underground Path north to south: its
 * floor and walls are laid cell for cell as the game's own are, so they are
 * that size or they are not the Underground Path.
 */
export const TUNNEL_SIZE = { width: 8, height: 63 } as const;

/** The sizes each kind of area may be. */
export function areaLimits(kind: MapFileAreaKind): {
  readonly minWidth: number;
  readonly minHeight: number;
  readonly maxWidth: number;
  readonly maxHeight: number;
} {
  const L = MAP_FILE_LIMITS;
  if (kind === 'tunnel') {
    const { width, height } = TUNNEL_SIZE;
    return { minWidth: width, minHeight: height, maxWidth: width, maxHeight: height };
  }
  return kind === 'cave'
    ? { minWidth: L.minCaveWidth, minHeight: L.minCaveHeight, maxWidth: L.maxCaveWidth, maxHeight: L.maxCaveHeight }
    : { minWidth: L.minInsideWidth, minHeight: L.minInsideHeight, maxWidth: L.maxInsideWidth, maxHeight: L.maxInsideHeight };
}

/**
 * How a way through looks where you go through it: a building's door you
 * walk up to, the mat inside a room you step off, or a staircase in a house -
 * up from the floor below, down from the floor above - which you walk up to
 * from the tile in front of its foot. A cave has its own three: the daylight
 * cut into its south wall that is its way out, a ladder up whose foot you
 * stand on, and a hole with a ladder down it that you walk up to. A gatehouse
 * has a doorway in its back wall, walked up into from the floor below it, and
 * its mat may be let into a side wall, stepped off sideways out of the room.
 * The Underground Path is gone down into by a stairwell in the floor of its
 * entrance, pressed into westward from beside it, and come up out of by the
 * stairs at either end of its tunnel.
 */
export const MAP_FILE_DOORWAY_LOOKS = [
  'door',
  'mat',
  'back-door',
  'stairwell',
  'tunnel-stairs',
  'stairs-up',
  'stairs-down',
  'cave-exit',
  'ladder-up',
  'ladder-down',
  // A boat moored off a jetty: boarded from the jetty, pressing out to sea,
  // and sailed to the jetty at the link's other end (`MapFileSailing`).
  'boat',
] as const;
export type MapFileDoorwayLook = (typeof MAP_FILE_DOORWAY_LOOKS)[number];

/**
 * What kind of country a map's tall grass is. The maker chooses the country and
 * the game chooses the Pokemon: each is one of the shipped places' own tables,
 * so a player map is no harder or easier than ground the game already measured
 * (`tools/encounters/report.mts`).
 */
export const MAP_FILE_HABITATS = {
  meadow: ROUTE_MEADOW_WILDLIFE,
  field: PALLET_FIELD_WILDLIFE,
  wetland: FLOODPLAIN_REED_WILDLIFE,
  shore: PALLET_SHORE_WILDLIFE,
  town: FLOODPLAIN_TOWN_WILDLIFE,
  woodland: FOREST_EDGE_WILDLIFE,
  // Under the hill: Zubat, Diglett and Sandshrew, on every step of the floor.
  cave: PALLET_DELVE_WILDLIFE,
  // A power station run down: FireRed's Power Plant, at a route's levels.
  'power-plant': POWER_PLANT_WILDLIFE,
  // A warden's reserve behind the Safari Zone's gate: FireRed's Safari Zone, at a route's levels.
  safari: SAFARI_ZONE_WILDLIFE,
  // A storm-struck summit: FireRed's climb to the Plateau, at the vale's levels.
  summit: SUMMIT_WILDLIFE,
  // A walled garden gone wild: the grass Pokemon, and Tangela, which nowhere else has.
  garden: LOST_GARDEN_WILDLIFE,
  // Ice: FireRed's Seafoam Islands and Icefall Cave, at a route's levels. A
  // cave dressed as ice rolls it on every step of its floor.
  ice: ICEFALL_WILDLIFE,
} as const satisfies Record<string, WildEncounterTable>;

export type MapFileHabitat = keyof typeof MAP_FILE_HABITATS;

/**
 * When an exit can be left by. Locks and keys are more values of this: `dug` is
 * an exit behind rubble that a Pickaxe carried in the pack digs out, for that
 * raid only (`WorldScene.tryDigAt`), and `key` a gate locked to FireRed's Card
 * Key, which a raid opens by carrying the card to it - the shipped maps' key
 * exits (`extractionPoints.ts`), with the card the key every file shares. The
 * card lies on an item spot marked `key`, one raid in five, as the shipped
 * maps lay their keys.
 */
export type MapFileOpens =
  | { readonly when: 'always' }
  | { readonly when: 'after'; readonly seconds: number }
  | { readonly when: 'dug' }
  | { readonly when: 'key' };

/** The key a file's locked exits open to: FireRed's Card Key. */
export const MAP_FILE_EXIT_KEY = 'card-key' satisfies ItemId;

/** How often the Card Key is lying on its spot: the shipped maps' keys' odds. */
export const CARD_KEY_CHANCE = 0.2;

/**
 * Whether an exit is barred - buried, or locked to the Card Key - and so a way
 * out only for a raid that brought the Pickaxe or found the card. Nothing that
 * promises a way out may count one (`isBarredExit` in `extractionPoints.ts`).
 */
export function isBarredFileExit(exit: { readonly opens: MapFileOpens }): boolean {
  return exit.opens.when === 'dug' || exit.opens.when === 'key';
}

export interface MapFileSpot {
  readonly x: number;
  readonly y: number;
  /** The area it stands in, by id; absent is outdoors. */
  readonly area?: string;
}

/**
 * Somewhere to find something; hidden, it is not drawn until it is stepped on.
 * A spot marked `key` holds the map's Card Key one raid in five and nothing
 * otherwise, and is the one spot on the map that does not take its turn in the
 * rotation of what spots hold (`itemSpotContents`).
 */
export interface MapFileItemSpot extends MapFileSpot {
  readonly hidden?: boolean;
  readonly key?: boolean;
  /**
   * A spot that holds one of the game's own finds instead of taking its turn
   * in the rotation: a piece of gear only one place has, laid at its odds as a
   * prize (`loot.ts`), seated in the place it stands in, as the Card Key is.
   */
  readonly prize?: MapFilePrize;
}

/**
 * The finds a spot may hold as a prize, and how often each is lying there: the
 * gear only one far place of the game's own maps has.
 */
export const MAP_FILE_PRIZES = {
  // The Lost Garden's: FireRed's Miracle Seed, one raid in four that gets
  // there - a prize's odds (`loot.test.ts` holds every prize under a third).
  'miracle-seed': 0.25,
} as const satisfies Partial<Record<ItemId, number>>;
export type MapFilePrize = keyof typeof MAP_FILE_PRIZES;

export interface MapFileBuilding extends MapFileSpot {
  readonly kind: MapFileBuildingKind;
}

export interface MapFileDropIn extends MapFileSpot {
  readonly name: string;
  readonly description?: string;
  /**
   * The id it was published under, kept when a fix renames it, so a landing
   * players have reached stays theirs (`keepPublishedIds`). Absent, the id is
   * the slug of its name. Only publishing writes one; nothing in the maker does.
   */
  readonly id?: string;
}

/** The part of a drop-in's insertion id after the map's: its kept id, else its name's slug. */
export function dropInKey(dropIn: Pick<MapFileDropIn, 'name' | 'id'>): string {
  return dropIn.id ?? placeSlug(dropIn.name);
}

export interface MapFileExit extends MapFileSpot {
  readonly name: string;
  readonly opens: MapFileOpens;
}

/** The ways a figure can face, in the words the file uses. */
export const MAP_FILE_FACINGS = [
  'down',
  'up',
  'left',
  'right',
] as const satisfies readonly Direction[];
export type MapFileFacing = (typeof MAP_FILE_FACINGS)[number];

/**
 * Who a person can look like: the townsfolk and trainer figures the game
 * already draws. Never a named character - Oak, Joy, Bill, Brock and the five
 * rivals are somebody - and never the player's own two designs.
 */
export const MAP_FILE_LOOKS = [
  'boy',
  'woman',
  'heavy-man',
  'bald-man',
  'scientist',
  'old-man',
  'old-woman',
  'straw-hat',
  'lass',
  'youngster',
  'bug-catcher',
  'hiker',
  'cooltrainer',
  'beauty',
  'sailor',
  'black-belt',
  'camper',
  'picnicker',
  'fisherman',
  'swimmer',
  'swimmer-woman',
  'tuber-boy',
  'tuber-girl',
  'little-boy',
  'little-girl',
  'rocker',
  'channeler',
  'gentleman',
  'rich-boy',
  'crush-girl',
  'cooltrainer-woman',
  'poke-maniac',
  'rocket-grunt',
  'rocket-grunt-woman',
  'policeman',
  'captain',
  'chef',
  'clerk',
  'gym-guide',
  'worker',
  'worker-woman',
  'man',
  'cameraman',
] as const satisfies readonly CastCharacterDesignId[];
export type MapFileLook = (typeof MAP_FILE_LOOKS)[number];

/**
 * What a landmark is, and so what it holds. A landmark is a cache worked once a
 * raid by walking onto it, and it pays what its place is - the rule the game's
 * own forty-one caches follow (`pois.ts`): medicine from water, balls from a
 * place that catches, a material from the place that makes it, and never money.
 * The maker chooses the place; the game chooses the payout.
 */
export const MAP_FILE_LANDMARKS = {
  spring: {
    label: 'Spring',
    says: 'Clean water, and someone keeps medicine beside it.',
    reward: [{ itemId: 'potion', quantity: 2 }],
  },
  hide: {
    label: 'Bird hide',
    says: "A watcher's hide. Whoever used it left their spare balls.",
    reward: [{ itemId: 'poke-ball', quantity: 2 }],
  },
  shed: {
    label: 'Tool shed',
    says: 'A shed of tools and spare parts.',
    reward: [{ itemId: 'parts-crate', quantity: 1 }],
  },
  kiln: {
    label: 'Kiln',
    says: 'A cold kiln with the lamp store beside it.',
    reward: [{ itemId: 'lamp-oil', quantity: 1 }],
  },
  jetty: {
    label: 'Jetty',
    says: 'A mooring with rope left coiled on it.',
    reward: [{ itemId: 'mooring-rope', quantity: 1 }],
  },
  shrine: {
    label: 'Shrine',
    says: 'A wayside shrine with offerings of cloth.',
    reward: [{ itemId: 'linen-roll', quantity: 1 }],
  },
  mast: {
    label: 'Radio mast',
    says: 'An old relay mast, its spares still in the box.',
    reward: [{ itemId: 'radio-valve', quantity: 1 }],
  },
  herbs: {
    label: 'Herb garden',
    says: 'Somebody grows their own cures here.',
    reward: [{ itemId: 'antidote', quantity: 2 }],
  },
} as const satisfies Record<
  string,
  {
    readonly label: string;
    readonly says: string;
    readonly reward: readonly { readonly itemId: ItemId; readonly quantity: number }[];
  }
>;
export type MapFileLandmarkKind = keyof typeof MAP_FILE_LANDMARKS;

/**
 * The teams a maker's trainer can field: every one is the party of one of the
 * game's own toll trainers, already measured over the real engine against the
 * starters (`trainerMeasure.ts`), so a maker places a fight without ever
 * authoring one. None is a boss's - a boss holds a door, and doors are later work.
 */
export const MAP_FILE_TRAINER_TEAMS = {
  scout: 'grass-scout-lee',
  raider: 'floodplain-checkpoint-maya',
  drover: 'route-drover-gil',
  breaker: 'pallet-quarry-breaker-finn',
  orchardist: 'route-orchardist-nell',
  collier: 'route-collier-osk',
  netter: 'pallet-netter-pike',
  lengthsman: 'floodplain-levels-lengthsman-quill',
} as const;
export type MapFileTrainerTeam = keyof typeof MAP_FILE_TRAINER_TEAMS;

/** The measured trainer a team is taken from. */
export function trainerTemplate(team: MapFileTrainerTeam): RunTrainerEncounter {
  const id = MAP_FILE_TRAINER_TEAMS[team];
  const template = createRunTrainerEncounters().find((encounter) => encounter.trainer.id === id);
  if (!template || template.bossId !== undefined) {
    throw new Error(`team '${team}' names no toll trainer: ${id}`);
  }
  return template;
}

/** A team as a maker reads it: "Pidgey 5, Squirtle 6". */
export function teamLine(team: MapFileTrainerTeam): string {
  return trainerTemplate(team)
    .trainer.party.map((pokemon) => `${pokemon.base.name} ${pokemon.level}`)
    .join(', ');
}

export interface MapFilePerson extends MapFileSpot {
  readonly name: string;
  readonly look: MapFileLook;
  readonly facing: MapFileFacing;
  readonly lines: readonly string[];
}

/** A Pokemon standing in the world: any species the game has (`pokemonFigures.ts`). */
export interface MapFilePokemon extends MapFileSpot {
  readonly species: FigureSpeciesId;
  /**
   * The level it fights at when spoken to, once a raid, as a wild Pokemon you
   * can beat or catch. Absent, it only says its name.
   */
  readonly level?: number;
  /**
   * A legend (`legends.ts`): fought at `level` with no ball until it is beaten,
   * then one throw, and gone for good once the Pokedex owns its kind. Only one of
   * `LEGENDARY_KINDS`, and only on a map the game draws (`maxLegends`).
   */
  readonly legendary?: boolean;
}

/** A berry tree (`berries.ts`): picked once a raid for one berry. */
export interface MapFileBerryTree extends MapFileSpot {
  readonly berry: BerryId;
}

/** A Strength boulder: a wall until something that knows Strength pushes it (`boulders.ts`). */
export type MapFileBoulder = MapFileSpot;

export interface MapFileSign extends MapFileSpot {
  readonly lines: readonly string[];
}

export interface MapFileLandmark extends MapFileSpot {
  readonly name: string;
  readonly kind: MapFileLandmarkKind;
}

/** A named part of the map: a rectangle, with its own wildlife if it has any. */
export interface MapFileDistrict {
  readonly area?: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly wildlife?: MapFileHabitat;
  /** Whether it rains there: every fight in it is fought in the rain (`weather.ts`). */
  readonly rain?: boolean;
}

/**
 * The doors a field move opens, as a maker places them: a small tree Cut clears
 * (one tile), a cracked rock Rock Smash breaks (one tile) and a stretch of deep
 * water Surf crosses (a rectangle). Each is the
 * game's own field-move gate (`gates.ts`), opened for good once worked.
 */
export const MAP_FILE_DOOR_KINDS = ['cut-tree', 'surf', 'smash-rock'] as const;
export type MapFileDoorKind = (typeof MAP_FILE_DOOR_KINDS)[number];

export interface MapFileDoor {
  readonly kind: MapFileDoorKind;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface MapFileTrainer extends MapFileSpot {
  readonly name: string;
  readonly team: MapFileTrainerTeam;
  readonly look: MapFileLook;
  readonly facing: MapFileFacing;
  /** How many tiles ahead they challenge on sight; nought is a trainer you walk up to. */
  readonly sight: number;
  readonly lines: readonly string[];
}

/**
 * A place that is not the outdoor map: the inside of a building. It is drawn
 * as a little map of its own - its ground and what is planted on it - and is
 * reached through a link.
 */
export interface MapFileArea {
  /** Lower-case letters, digits and dashes, unique in the file. */
  readonly id: string;
  /** What the plate says when you walk in. */
  readonly name: string;
  readonly kind: MapFileAreaKind;
  readonly style: MapFileAreaStyle;
  readonly width: number;
  readonly height: number;
  readonly ground: readonly string[];
  /** Its furniture. */
  readonly buildings: readonly MapFileBuilding[];
  /** Floor switches and levers (`switches.ts`), and the barriers they open. */
  readonly switches?: readonly MapFileSwitch[];
  readonly barriers?: readonly MapFileBarrier[];
}

/**
 * How a switch is thrown: a `plate` is FireRed's Victory Road floor switch,
 * thrown when a Strength boulder comes to rest on it, and a `lever` is
 * whatever stands on its tile (a generator, a wall panel) faced with the
 * interact key.
 */
export const MAP_FILE_SWITCH_KINDS = ['plate', 'lever'] as const;
export type MapFileSwitchKind = (typeof MAP_FILE_SWITCH_KINDS)[number];

/**
 * A switch in an area: thrown once, for the rest of the raid, and it opens the
 * barrier it names - which may stand in another area of the same file, so a
 * generator on one floor can open a way on another. A barrier with several
 * switches opens only once every one of them is thrown.
 */
export interface MapFileSwitch {
  readonly x: number;
  readonly y: number;
  readonly kind: MapFileSwitchKind;
  /** The id of the barrier it opens. */
  readonly opens: string;
}

/**
 * A barrier in an area: FireRed's rock barrier, a wall across a way until its
 * switches are thrown, then floor for the rest of the raid. A rectangle, drawn
 * a column at a time as the barrier's top over its foot.
 */
export interface MapFileBarrier {
  /** Lower-case letters, digits and dashes, unique in the file. */
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * One end of a way through: the tile you stand on to go through it, and come
 * out on from the other end; the way you press to go through; and what is
 * there to go through. A building's door is the `door` look on the tile in
 * front of the building's door cell, pressing up.
 */
export interface MapFileLinkEnd extends MapFileSpot {
  readonly toward: MapFileFacing;
  readonly look: MapFileDoorwayLook;
}

/** A way between two places on the map, the same both ways. */
export interface MapFileLink {
  readonly ends: readonly [MapFileLinkEnd, MapFileLinkEnd];
  /**
   * A boat's, and only a boat's: a link whose two ends are `boat` jetties
   * outdoors is not gone through but sailed, along `course`, and only while
   * the tide lets it (`world/sailing.ts`).
   */
  readonly sails?: MapFileSailing;
}

/**
 * A boat between two jetties across open water. It runs both ways, carrying
 * whoever boards it tile by tile across the water - charged to the raid clock
 * as walking is - and nobody can follow it over the water. It sails only from
 * `from` until `until` seconds into a raid: the tide.
 */
export interface MapFileSailing {
  /** What the boat is called, on its caption and in its lines. */
  readonly name: string;
  readonly from: number;
  readonly until: number;
  /**
   * Where it turns, in the outdoors' tiles, in order from the first end's
   * boat to the second's; every leg between is a straight line of deep water.
   */
  readonly course: readonly { readonly x: number; readonly y: number }[];
}

/** Whether a link is a boat: sailed rather than gone through. */
export function isSailing(link: MapFileLink): boolean {
  return link.sails !== undefined || link.ends.some((end) => end.look === 'boat');
}

export interface MapFile {
  readonly format: typeof MAP_FILE_FORMAT;
  /** Lower-case letters, digits and dashes: it becomes part of the map's id. */
  readonly id: string;
  readonly name: string;
  /** Who drew it, as they want to be credited. */
  readonly maker: string;
  readonly width: number;
  readonly height: number;
  /** `height` rows of `width` ground letters each. */
  readonly ground: readonly string[];
  readonly buildings: readonly MapFileBuilding[];
  /** The first is the map's front door. */
  readonly dropIns: readonly MapFileDropIn[];
  readonly exits: readonly MapFileExit[];
  /** Where something can be found. The game decides what. */
  readonly itemSpots: readonly MapFileItemSpot[];
  readonly wildlife: MapFileHabitat;
  /**
   * Everything after this was added in the first version's second part, and is
   * optional so a file written before it still reads: townsfolk who talk,
   * signs that say something, landmarks to work, named places and trainers.
   */
  readonly people?: readonly MapFilePerson[];
  readonly signs?: readonly MapFileSign[];
  readonly landmarks?: readonly MapFileLandmark[];
  readonly districts?: readonly MapFileDistrict[];
  readonly trainers?: readonly MapFileTrainer[];
  /** Added with the second palette: doors a Pokémon's field move opens. */
  readonly doors?: readonly MapFileDoor[];
  /** And Pokémon standing in the world, who say their own name when spoken to. */
  readonly pokemon?: readonly MapFilePokemon[];
  /** Insides, and the ways into them: see `MapFileArea` and `MapFileLink`. */
  readonly areas?: readonly MapFileArea[];
  readonly links?: readonly MapFileLink[];
  /** Added with the third: berry trees, picked once a raid. */
  readonly berryTrees?: readonly MapFileBerryTree[];
  /** And boulders, pushed with Strength. */
  readonly boulders?: readonly MapFileBoulder[];
}

/**
 * Every key a map file may have, in the order the format lists them. The
 * submission service refuses a map with any other key, so nothing a reviewer
 * cannot see can ride an approval into the game (the security review's M3):
 * `submit_map` in `supabase/migrations/` holds this same list, and
 * `maker/submissionLimits.test.ts` fails when the two disagree - a new part of
 * the format needs a migration that lets it through, or every map using it is
 * refused at SEND. `submissionLimits.test.ts` also fails to compile when
 * `MapFile` gains a key this list does not name.
 */
export const MAP_FILE_KEYS = [
  'format',
  'id',
  'name',
  'maker',
  'width',
  'height',
  'ground',
  'buildings',
  'dropIns',
  'exits',
  'itemSpots',
  'wildlife',
  'people',
  'signs',
  'landmarks',
  'districts',
  'trainers',
  'doors',
  'pokemon',
  'areas',
  'links',
  'berryTrees',
  'boulders',
] as const satisfies readonly (keyof MapFile)[];

/**
 * The characters no name or line in a map file may hold. Player-written words
 * are shown on the game's DOM screens as well as on the canvas, and a file that
 * cannot carry markup is safe on every one of them without each having to
 * remember to escape it. A map has no need of any of them.
 */
export const UNSAFE_TEXT = /[<>&"]/;

/**
 * Text with the characters a map file may not hold taken out, as a field is
 * typed: `< > & "`, and everything beyond the writing a map may use
 * (`mapText.ts`). A line break is kept, because a box of lines is split on it.
 */
export function plainText(value: string): string {
  return typedMapText(value, { lines: true }).text;
}

/** Every piece of player-written text in a map file. */
export function wordsOf(file: Partial<MapFile>): readonly string[] {
  return [
    file.name ?? '',
    file.maker ?? '',
    ...(file.dropIns ?? []).flatMap((spot) => [spot.name, spot.description ?? '']),
    ...(file.exits ?? []).map((spot) => spot.name),
    ...(file.people ?? []).flatMap((person) => [person.name, ...person.lines]),
    ...(file.signs ?? []).flatMap((sign) => sign.lines),
    ...(file.landmarks ?? []).map((landmark) => landmark.name),
    ...(file.districts ?? []).map((district) => district.name),
    ...(file.trainers ?? []).flatMap((trainer) => [trainer.name, ...trainer.lines]),
    ...(file.areas ?? []).map((area) => area.name),
    ...(file.links ?? []).map((link) => link.sails?.name ?? ''),
  ].filter((text): text is string => typeof text === 'string');
}

export type MapFileReading =
  | { readonly ok: true; readonly file: MapFile }
  | { readonly ok: false; readonly problems: readonly string[] };

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isWholeNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value);

/**
 * Reads a map file, refusing anything the game could not load.
 *
 * This is the shape of the file and nothing else - it never asks whether the
 * map is any good, or even whether it can be walked out of; that is
 * `mapFileChecks.ts`. Every problem is listed rather than the first, because a
 * file is fixed in one sitting or not at all.
 */
export function readMapFile(
  value: unknown,
  /**
   * A draft is a map still being drawn: it may have no name or maker yet and
   * no way in or out, and the editor still has to be able to open it. Every
   * other rule - the shape, the letters, the bounds - holds for a draft too.
   */
  options: {
    readonly draft?: boolean;
    /** What the file may hold: a player's map is held to `MAP_FILE_LIMITS`, the default. */
    readonly limits?: MapFileLimits;
  } = {},
): MapFileReading {
  const draft = options.draft === true;
  const limits = options.limits ?? MAP_FILE_LIMITS;
  const problems: string[] = [];
  if (!isRecord(value)) {
    return { ok: false, problems: ['The file is not a map.'] };
  }
  if (value.format !== MAP_FILE_FORMAT) {
    return {
      ok: false,
      problems: [
        `The file is format ${String(value.format)}; this game reads format ${MAP_FILE_FORMAT}.`,
      ],
    };
  }
  const text = (field: string, what: string, max: number): string | undefined => {
    const raw = value[field];
    if (typeof raw !== 'string' || (raw.trim().length === 0 && !draft)) {
      problems.push(`The map needs ${what}.`);
      return undefined;
    }
    if (raw.length > max) {
      problems.push(`The map's ${field} is longer than ${max} letters.`);
    }
    return raw;
  };

  const id = text('id', 'an id', MAP_FILE_ID_MAX_LENGTH);
  if (id !== undefined && !ID_PATTERN.test(id)) {
    problems.push(`'id' may only hold lower-case letters, digits and single dashes.`);
  }
  text('name', 'a name', limits.maxNameLength);
  text('maker', "its maker's name", limits.maxMakerLength);

  const { width, height } = value;
  const sized =
    isWholeNumber(width) &&
    isWholeNumber(height) &&
    width >= limits.minWidth &&
    height >= limits.minHeight &&
    width <= limits.maxWidth &&
    height <= limits.maxHeight;
  if (!sized) {
    problems.push(
      `A map is ${limits.minWidth}x${limits.minHeight} to ${limits.maxWidth}x${limits.maxHeight} tiles.`,
    );
  }

  const ground = value.ground;
  if (!Array.isArray(ground) || !ground.every((row) => typeof row === 'string')) {
    problems.push(`'ground' must be rows of letters.`);
  } else if (sized) {
    if (ground.length !== height) {
      problems.push(`'ground' has ${ground.length} rows; the map is ${height} tall.`);
    }
    ground.forEach((row: string, y) => {
      if (row.length !== width) {
        problems.push(`Ground row ${y} is ${row.length} letters; the map is ${width} wide.`);
      }
      const unknown = [...new Set([...row].filter((letter) => !GROUND_LETTERS.has(letter)))];
      if (unknown.length > 0) {
        problems.push(`Ground row ${y} uses letters the game does not draw: ${unknown.join(' ')}`);
      }
    });
  }

  // The areas come first, because everything placed is measured against the
  // area it says it stands in rather than against the outdoor map.
  const areaSizes = readAreas(value.areas, problems, limits);
  const sizeOf = (spot: Record<string, unknown>): { width: number; height: number } | undefined => {
    if (spot.area === undefined) {
      return sized ? { width: width, height: height } : undefined;
    }
    return typeof spot.area === 'string' ? areaSizes.get(spot.area) : undefined;
  };
  const inBounds = (spot: Record<string, unknown>): boolean => {
    const size = sizeOf(spot);
    return (
      size !== undefined &&
      isWholeNumber(spot.x) &&
      isWholeNumber(spot.y) &&
      spot.x >= 0 &&
      spot.y >= 0 &&
      spot.x < size.width &&
      spot.y < size.height
    );
  };

  const list = (field: string, max: number, min = 0): Record<string, unknown>[] => {
    const raw = value[field];
    if (!Array.isArray(raw) || !raw.every(isRecord)) {
      problems.push(`'${field}' must be a list.`);
      return [];
    }
    if (raw.length < min && !draft) {
      problems.push(`A map needs at least ${min} ${field === 'dropIns' ? 'drop-in' : 'exit'}.`);
    }
    if (raw.length > max) {
      problems.push(`A map holds at most ${max} ${field}.`);
    }
    raw.forEach((spot, index) => {
      if (spot.area !== undefined && (typeof spot.area !== 'string' || !areaSizes.has(spot.area))) {
        problems.push(`${field} ${index + 1} is in an area the map does not have.`);
      } else if (!inBounds(spot)) {
        problems.push(`${field} ${index + 1} is not on the map.`);
      }
    });
    return raw;
  };

  for (const [index, building] of list('buildings', 200).entries()) {
    if (building.area !== undefined) {
      problems.push(`Building ${index + 1} is listed outdoors but says it is in an area.`);
    } else if (typeof building.kind !== 'string' || !isOutdoorBuilding(building.kind)) {
      problems.push(
        `Building ${index + 1} is not a building the game has: ${String(building.kind)}.`,
      );
    } else if (inBounds(building)) {
      // Its top-left corner is on the map; the rest of it has to be too, or the
      // sketch it plants into refuses it and nothing about the map can be drawn.
      const prop = plantedProp(building.kind);
      if (
        (building.x as number) + prop.width > (width as number) ||
        (building.y as number) + prop.height > (height as number)
      ) {
        problems.push(`Building ${index + 1} runs off the edge of the map.`);
      }
    }
  }

  const names = (field: 'dropIns' | 'exits', max: number): Record<string, unknown>[] => {
    const seen = new Set<string>();
    const spots = list(field, max, 1);
    for (const [index, spot] of spots.entries()) {
      const name = spot.name;
      if (typeof name !== 'string' || name.trim().length === 0) {
        problems.push(`${field === 'dropIns' ? 'Drop-in' : 'Exit'} ${index + 1} needs a name.`);
        continue;
      }
      if (name.length > limits.maxPlaceNameLength) {
        problems.push(`'${name}' is longer than ${limits.maxPlaceNameLength} letters.`);
      }
      const key = placeSlug(name);
      if (key.length === 0) {
        problems.push(`'${name}' needs at least one letter or digit.`);
      } else if (seen.has(key)) {
        problems.push(`Two ${field === 'dropIns' ? 'drop-ins' : 'exits'} are called '${name}'.`);
      }
      seen.add(key);
      if (field === 'dropIns' && spot.id !== undefined) {
        if (typeof spot.id !== 'string' || !ID_PATTERN.test(spot.id) || spot.id.length > MAP_FILE_ID_MAX_LENGTH) {
          problems.push(`The id kept for '${name}' is not one the game can use.`);
        }
      }
      if (
        spot.description !== undefined &&
        (typeof spot.description !== 'string' ||
          spot.description.length > limits.maxDescriptionLength)
      ) {
        problems.push(
          `The description of '${name}' must be text of at most ${limits.maxDescriptionLength} letters.`,
        );
      }
    }
    return spots;
  };
  const dropInSpots = names('dropIns', limits.maxDropIns);
  // A kept id stands in for its drop-in's name, so no two may come out the same.
  const landings = dropInSpots.flatMap((spot) =>
    typeof spot.name === 'string' && (spot.id === undefined || typeof spot.id === 'string')
      ? [spot.id ?? placeSlug(spot.name)]
      : [],
  );
  if (new Set(landings).size !== landings.length && problems.every((problem) => !problem.startsWith('Two drop-ins'))) {
    problems.push('Two drop-ins would be the same landing: give one another name.');
  }
  names('exits', limits.maxExits);

  for (const exit of Array.isArray(value.exits) ? value.exits.filter(isRecord) : []) {
    const opens = exit.opens;
    const valid =
      isRecord(opens) &&
      (opens.when === 'always' ||
        opens.when === 'dug' ||
        opens.when === 'key' ||
        (opens.when === 'after' &&
          isWholeNumber(opens.seconds) &&
          opens.seconds > 0 &&
          opens.seconds <= limits.maxExitDelaySeconds));
    if (!valid) {
      problems.push(
        `Exit '${String(exit.name)}' must open always, after 1 to ${limits.maxExitDelaySeconds} seconds, when dug out, or to the Card Key.`,
      );
    }
  }

  list('itemSpots', limits.maxItemSpots).forEach((spot, index) => {
    if (spot.hidden !== undefined && typeof spot.hidden !== 'boolean') {
      problems.push(`Item spot ${index + 1}'s hidden must be yes or no.`);
    }
    if (spot.key !== undefined && typeof spot.key !== 'boolean') {
      problems.push(`Item spot ${index + 1}'s key must be yes or no.`);
    }
    if (spot.prize !== undefined) {
      if (typeof spot.prize !== 'string' || !Object.hasOwn(MAP_FILE_PRIZES, spot.prize)) {
        problems.push(
          `Item spot ${index + 1}'s prize must be one of: ${Object.keys(MAP_FILE_PRIZES).join(', ')}.`,
        );
      } else if (spot.key === true) {
        problems.push(`Item spot ${index + 1} holds the Card Key or a prize, not both.`);
      }
    }
  });

  const linesOf = (what: string, raw: unknown): void => {
    if (
      !Array.isArray(raw) ||
      raw.length > limits.maxLines ||
      !raw.every((line) => typeof line === 'string' && line.length <= limits.maxLineLength)
    ) {
      problems.push(
        `${what} may say up to ${limits.maxLines} lines of at most ${limits.maxLineLength} letters.`,
      );
    }
  };
  const nameOf = (what: string, raw: unknown): void => {
    if (
      typeof raw !== 'string' ||
      raw.trim().length === 0 ||
      raw.length > limits.maxPlaceNameLength
    ) {
      problems.push(
        `${what} needs a name of at most ${limits.maxPlaceNameLength} letters.`,
      );
    }
  };
  const oneOf = (what: string, raw: unknown, allowed: readonly string[]): void => {
    if (typeof raw !== 'string' || !allowed.includes(raw)) {
      problems.push(`${what} must be one of: ${allowed.join(', ')}.`);
    }
  };
  const optional = (field: string, max: number): Record<string, unknown>[] =>
    value[field] === undefined ? [] : list(field, max);

  optional('people', limits.maxPeople).forEach((person, index) => {
    const what = `Person ${index + 1}`;
    nameOf(what, person.name);
    oneOf(`${what}'s look`, person.look, MAP_FILE_LOOKS);
    oneOf(`${what}'s facing`, person.facing, MAP_FILE_FACINGS);
    linesOf(what, person.lines);
  });
  optional('pokemon', limits.maxPokemon).forEach((standing, index) => {
    if (!isFigureSpecies(standing.species)) {
      problems.push(`Pokémon ${index + 1} is not a Pokémon the game has.`);
    }
    if (
      standing.level !== undefined &&
      (!isWholeNumber(standing.level) ||
        standing.level < 2 ||
        standing.level > limits.maxPokemonLevel)
    ) {
      problems.push(
        `Pokémon ${index + 1} fights at a level from 2 to ${limits.maxPokemonLevel}.`,
      );
    }
    if (standing.legendary !== undefined) {
      if (standing.legendary !== true) {
        problems.push(`Pokémon ${index + 1} is legendary or says nothing about it.`);
      } else if (typeof standing.species !== 'string' || !isLegendaryKind(standing.species) || standing.level === undefined) {
        problems.push(`Pokémon ${index + 1} is legendary, which only a legend that fights may be.`);
      }
    }
  });
  const legends = Array.isArray(value.pokemon)
    ? value.pokemon.filter((standing) => (standing as { legendary?: unknown })?.legendary === true).length
    : 0;
  if (legends > limits.maxLegends) {
    problems.push(
      limits.maxLegends === 0
        ? 'A legend may stand only on a map the game draws.'
        : `The map stands ${legends} legends; a map file holds ${limits.maxLegends}.`,
    );
  }
  optional('berryTrees', limits.maxBerryTrees).forEach((tree, index) => {
    oneOf(`Berry tree ${index + 1}'s berry`, tree.berry, BERRY_IDS);
  });
  optional('boulders', limits.maxBoulders);
  optional('signs', limits.maxSigns).forEach((sign, index) =>
    linesOf(`Sign ${index + 1}`, sign.lines),
  );
  optional('landmarks', limits.maxLandmarks).forEach((landmark, index) => {
    nameOf(`Landmark ${index + 1}`, landmark.name);
    oneOf(`Landmark ${index + 1}'s kind`, landmark.kind, Object.keys(MAP_FILE_LANDMARKS));
  });
  optional('trainers', limits.maxTrainers).forEach((trainer, index) => {
    const what = `Trainer ${index + 1}`;
    nameOf(what, trainer.name);
    oneOf(`${what}'s team`, trainer.team, Object.keys(MAP_FILE_TRAINER_TEAMS));
    oneOf(`${what}'s look`, trainer.look, MAP_FILE_LOOKS);
    oneOf(`${what}'s facing`, trainer.facing, MAP_FILE_FACINGS);
    if (
      !isWholeNumber(trainer.sight) ||
      trainer.sight < 0 ||
      trainer.sight > limits.maxSight
    ) {
      problems.push(`${what} watches 0 to ${limits.maxSight} tiles ahead.`);
    }
    linesOf(what, trainer.lines);
  });
  const districts = value.districts;
  if (districts !== undefined) {
    if (!Array.isArray(districts) || !districts.every(isRecord)) {
      problems.push(`'districts' must be a list.`);
    } else {
      if (districts.length > limits.maxDistricts) {
        problems.push(`A map holds at most ${limits.maxDistricts} districts.`);
      }
      districts.forEach((district, index) => {
        const what = `District ${index + 1}`;
        nameOf(what, district.name);
        const { x, y, width: w, height: h } = district;
        const size = sizeOf(district);
        const fits =
          isWholeNumber(x) &&
          isWholeNumber(y) &&
          isWholeNumber(w) &&
          isWholeNumber(h) &&
          size !== undefined &&
          x >= 0 &&
          y >= 0 &&
          w > 0 &&
          h > 0 &&
          x + w <= size.width &&
          y + h <= size.height;
        if (!fits) {
          problems.push(`${what} is not on the map.`);
        }
        if (district.wildlife !== undefined) {
          oneOf(`${what}'s wildlife`, district.wildlife, Object.keys(MAP_FILE_HABITATS));
        }
        if (district.rain !== undefined && typeof district.rain !== 'boolean') {
          problems.push(`${what}'s rain must be yes or no.`);
        }
      });
    }
  }
  const doors = value.doors;
  if (doors !== undefined) {
    if (!Array.isArray(doors) || !doors.every(isRecord)) {
      problems.push(`'doors' must be a list.`);
    } else {
      if (doors.length > limits.maxDoors) {
        problems.push(`A map holds at most ${limits.maxDoors} doors.`);
      }
      doors.forEach((door, index) => {
        const what = `Door ${index + 1}`;
        oneOf(`${what}'s kind`, door.kind, MAP_FILE_DOOR_KINDS);
        const { x, y, width: w, height: h } = door;
        const fits =
          isWholeNumber(x) &&
          isWholeNumber(y) &&
          isWholeNumber(w) &&
          isWholeNumber(h) &&
          sized &&
          x >= 0 &&
          y >= 0 &&
          w > 0 &&
          h > 0 &&
          w <= limits.maxDoorSide &&
          h <= limits.maxDoorSide &&
          x + w <= width &&
          y + h <= height;
        if (!fits) {
          problems.push(`${what} is not on the map.`);
        }
        if (door.kind !== 'surf' && (w !== 1 || h !== 1)) {
          problems.push(`${what} stands on one tile.`);
        }
      });
    }
  }

  readLinks(
    value.links,
    sized ? { width: width, height: height } : undefined,
    areaSizes,
    problems,
    limits,
  );

  if (typeof value.wildlife !== 'string' || !Object.hasOwn(MAP_FILE_HABITATS, value.wildlife)) {
    problems.push(`'wildlife' must be one of: ${Object.keys(MAP_FILE_HABITATS).join(', ')}.`);
  }

  if (problems.length === 0 && wordsOf(value).some((text) => UNSAFE_TEXT.test(text))) {
    problems.push('Names and words in a map may not use < > & or ".');
  } else if (problems.length === 0 && !wordsOf(value).every(isMapText)) {
    problems.push(
      'Names and words in a map use letters (accents too), digits and common punctuation - no emoji or other scripts yet.',
    );
  }

  return problems.length > 0
    ? { ok: false, problems }
    : // Only what was checked leaves: see `mapFileRebuild.ts` (the security review's M3).
      { ok: true, file: onlyMapFileFields(value as unknown as MapFile) };
}

/**
 * Reads a file's areas, listing what is wrong with them, and answers the size
 * of every area that has an id - so the things standing in an area can be
 * held to it even while something else about the area is wrong.
 */
function readAreas(
  raw: unknown,
  problems: string[],
  held: MapFileLimits,
): ReadonlyMap<string, { readonly width: number; readonly height: number }> {
  const sizes = new Map<string, { width: number; height: number }>();
  if (raw === undefined) {
    return sizes;
  }
  if (!Array.isArray(raw) || !raw.every(isRecord)) {
    problems.push(`'areas' must be a list.`);
    return sizes;
  }
  if (raw.length > held.maxAreas) {
    problems.push(`A map holds at most ${held.maxAreas} areas.`);
  }
  const barrierIds = new Set<string>();
  const switchTargets: string[] = [];
  raw.forEach((area, index) => {
    const what = `Area ${index + 1}`;
    const id = area.id;
    if (typeof id !== 'string' || !ID_PATTERN.test(id) || id.length > MAP_FILE_ID_MAX_LENGTH) {
      problems.push(`${what} needs an id of lower-case letters, digits and single dashes.`);
    } else if (sizes.has(id)) {
      problems.push(`Two areas have the id '${id}'.`);
    }
    if (
      typeof area.name !== 'string' ||
      area.name.trim().length === 0 ||
      area.name.length > held.maxPlaceNameLength
    ) {
      problems.push(
        `${what} needs a name of at most ${held.maxPlaceNameLength} letters.`,
      );
    }
    const kind: MapFileAreaKind | undefined = (MAP_FILE_AREA_KINDS as readonly unknown[]).includes(
      area.kind,
    )
      ? (area.kind as MapFileAreaKind)
      : undefined;
    if (!kind) {
      problems.push(`${what} must be one of: ${MAP_FILE_AREA_KINDS.join(', ')}.`);
    }
    const styles = kind ? MAP_FILE_STYLES_OF[kind] : MAP_FILE_AREA_STYLES;
    if (typeof area.style !== 'string' || !(styles as readonly string[]).includes(area.style)) {
      problems.push(`${what}'s style must be one of: ${styles.join(', ')}.`);
    }
    const { width, height } = area;
    const limits = areaLimits(kind ?? 'inside');
    const sized =
      isWholeNumber(width) &&
      isWholeNumber(height) &&
      width >= limits.minWidth &&
      height >= limits.minHeight &&
      width <= limits.maxWidth &&
      height <= limits.maxHeight;
    if (!sized) {
      const fixed = limits.minWidth === limits.maxWidth && limits.minHeight === limits.maxHeight;
      problems.push(
        fixed
          ? `${what} is ${limits.minWidth}x${limits.minHeight} tiles, the size FireRed made it.`
          : `${what} is ${limits.minWidth}x${limits.minHeight} to ${limits.maxWidth}x${limits.maxHeight} tiles.`,
      );
    } else if (typeof id === 'string' && !sizes.has(id)) {
      sizes.set(id, { width, height });
    }
    const ground = area.ground;
    if (!Array.isArray(ground) || !ground.every((row) => typeof row === 'string')) {
      problems.push(`${what}'s ground must be rows of letters.`);
    } else if (sized) {
      if (ground.length !== height) {
        problems.push(`${what}'s ground has ${ground.length} rows; it is ${height} tall.`);
      }
      ground.forEach((row: string, y) => {
        if (row.length !== width) {
          problems.push(`${what}'s ground row ${y} is ${row.length} letters; it is ${width} wide.`);
        }
        // Ice is drawn only in a cave of ice: anywhere else it would be a
        // floor that looked like stone and slid like ice.
        const letters = MAP_FILE_AREA_LETTERS[kind ?? 'inside'].filter(
          (letter) => letter !== MATERIAL_CHARS.ice || area.style === 'ice',
        );
        const unknown = [...new Set([...row].filter((letter) => !letters.includes(letter)))];
        if (unknown.length > 0) {
          problems.push(
            `${what}'s ground row ${y} uses letters ${kind === 'cave' ? 'a cave' : kind === 'tunnel' ? 'a tunnel' : 'an inside'} does not draw: ${unknown.join(' ')}`,
          );
        }
      });
    }
    const furniture = area.buildings;
    if (!Array.isArray(furniture) || !furniture.every(isRecord)) {
      problems.push(`${what}'s furniture must be a list.`);
      return;
    }
    if (furniture.length > held.maxFurniture) {
      problems.push(`${what} holds at most ${held.maxFurniture} pieces of furniture.`);
    }
    readSwitches(area, what, sized ? { width, height } : undefined, barrierIds, switchTargets, problems);
    furniture.forEach((piece, at) => {
      if (typeof piece.kind !== 'string' || !isFurniture(piece.kind)) {
        problems.push(`${what}'s furniture ${at + 1} is not furniture the game has: ${String(piece.kind)}.`);
        return;
      }
      const prop = plantedProp(piece.kind);
      const fits =
        sized &&
        isWholeNumber(piece.x) &&
        isWholeNumber(piece.y) &&
        piece.x >= 0 &&
        piece.y >= 0 &&
        piece.x + prop.width <= width &&
        piece.y + prop.height <= height;
      if (!fits) {
        problems.push(`${what}'s furniture ${at + 1} is not inside it.`);
      }
    });
  });
  for (const target of new Set(switchTargets)) {
    if (!barrierIds.has(target)) {
      problems.push(`A switch opens '${target}', and the map has no barrier called that.`);
    }
  }
  for (const id of barrierIds) {
    if (!switchTargets.includes(id)) {
      problems.push(`The barrier '${id}' has no switch to open it.`);
    }
  }
  return sizes;
}

/**
 * Reads one area's switches and barriers, gathering every barrier's id and
 * every switch's target so a switch may open a barrier in another area.
 */
function readSwitches(
  area: Record<string, unknown>,
  what: string,
  size: { readonly width: number; readonly height: number } | undefined,
  barrierIds: Set<string>,
  switchTargets: string[],
  problems: string[],
): void {
  const inside = (x: unknown, y: unknown, width = 1, height = 1): boolean =>
    size !== undefined &&
    isWholeNumber(x) &&
    isWholeNumber(y) &&
    x >= 0 &&
    y >= 0 &&
    x + width <= size.width &&
    y + height <= size.height;
  if (area.switches !== undefined) {
    if (!Array.isArray(area.switches) || !area.switches.every(isRecord)) {
      problems.push(`${what}'s switches must be a list.`);
    } else {
      area.switches.forEach((spot, at) => {
        if (!(MAP_FILE_SWITCH_KINDS as readonly unknown[]).includes(spot.kind)) {
          problems.push(`${what}'s switch ${at + 1} must be one of: ${MAP_FILE_SWITCH_KINDS.join(', ')}.`);
        }
        if (!inside(spot.x, spot.y)) {
          problems.push(`${what}'s switch ${at + 1} is not inside it.`);
        }
        if (typeof spot.opens !== 'string') {
          problems.push(`${what}'s switch ${at + 1} has to name the barrier it opens.`);
        } else {
          switchTargets.push(spot.opens);
        }
      });
    }
  }
  if (area.barriers !== undefined) {
    if (!Array.isArray(area.barriers) || !area.barriers.every(isRecord)) {
      problems.push(`${what}'s barriers must be a list.`);
    } else {
      area.barriers.forEach((barrier, at) => {
        const id = barrier.id;
        if (typeof id !== 'string' || !ID_PATTERN.test(id) || id.length > MAP_FILE_ID_MAX_LENGTH) {
          problems.push(`${what}'s barrier ${at + 1} needs an id of lower-case letters, digits and single dashes.`);
        } else if (barrierIds.has(id)) {
          problems.push(`Two barriers have the id '${id}'.`);
        } else {
          barrierIds.add(id);
        }
        const { width, height } = barrier;
        if (!isWholeNumber(width) || !isWholeNumber(height) || width < 1 || height < 1 || !inside(barrier.x, barrier.y, width, height)) {
          problems.push(`${what}'s barrier ${at + 1} is not inside it.`);
        }
      });
    }
  }
}

/** Reads a file's links, listing what is wrong with their shape. */
function readLinks(
  raw: unknown,
  outdoors: { readonly width: number; readonly height: number } | undefined,
  areaSizes: ReadonlyMap<string, { readonly width: number; readonly height: number }>,
  problems: string[],
  limits: MapFileLimits,
): void {
  if (raw === undefined) {
    return;
  }
  if (!Array.isArray(raw) || !raw.every(isRecord)) {
    problems.push(`'links' must be a list.`);
    return;
  }
  if (raw.length > limits.maxLinks) {
    problems.push(`A map holds at most ${limits.maxLinks} ways through.`);
  }
  raw.forEach((link, index) => {
    const what = `Way through ${index + 1}`;
    const ends = link.ends;
    if (!Array.isArray(ends) || ends.length !== 2 || !ends.every(isRecord)) {
      problems.push(`${what} must have two ends.`);
      return;
    }
    for (const end of ends) {
      if (end.area !== undefined && (typeof end.area !== 'string' || !areaSizes.has(end.area))) {
        problems.push(`${what} ends in an area the map does not have.`);
        continue;
      }
      const size = end.area === undefined ? outdoors : areaSizes.get(end.area);
      if (
        size === undefined ||
        !isWholeNumber(end.x) ||
        !isWholeNumber(end.y) ||
        end.x < 0 ||
        end.y < 0 ||
        end.x >= size.width ||
        end.y >= size.height
      ) {
        problems.push(`${what} ends somewhere that is not on the map.`);
      }
      if (typeof end.toward !== 'string' || !(MAP_FILE_FACINGS as readonly string[]).includes(end.toward)) {
        problems.push(`${what}'s ends must each face one of: ${MAP_FILE_FACINGS.join(', ')}.`);
      }
      if (typeof end.look !== 'string' || !(MAP_FILE_DOORWAY_LOOKS as readonly string[]).includes(end.look)) {
        problems.push(`${what}'s ends must each be one of: ${MAP_FILE_DOORWAY_LOOKS.join(', ')}.`);
      }
    }
    const boats = ends.filter((end) => end.look === 'boat').length;
    if (boats === 0 && link.sails === undefined) {
      return;
    }
    if (boats !== 2 || ends.some((end) => end.area !== undefined)) {
      problems.push(`${what} is a boat: both its ends are jetties outdoors.`);
    }
    const sails = link.sails;
    if (!isRecord(sails)) {
      problems.push(`${what} is a boat, and says when it sails and where.`);
      return;
    }
    if (typeof sails.name !== 'string' || sails.name.length === 0 || sails.name.length > limits.maxPlaceNameLength) {
      problems.push(`${what} needs a name of at most ${limits.maxPlaceNameLength} letters.`);
    }
    const raidSeconds = RAID_DURATION_MS / 1_000;
    if (
      !isWholeNumber(sails.from) ||
      !isWholeNumber(sails.until) ||
      sails.from < 0 ||
      sails.from >= sails.until ||
      sails.until > raidSeconds
    ) {
      problems.push(`${what} sails for some of the raid's ${raidSeconds} seconds, from one whole second until a later one.`);
    }
    const course = sails.course;
    if (
      !Array.isArray(course) ||
      course.length > MAX_COURSE_TURNS ||
      !course.every(
        (turn) =>
          isRecord(turn) &&
          isWholeNumber(turn.x) &&
          isWholeNumber(turn.y) &&
          outdoors !== undefined &&
          turn.x >= 0 &&
          turn.y >= 0 &&
          turn.x < outdoors.width &&
          turn.y < outdoors.height,
      )
    ) {
      problems.push(`${what}'s course is a list of at most ${MAX_COURSE_TURNS} turns on the map.`);
    }
  });
}

/** How many times a boat's course may turn. */
export const MAX_COURSE_TURNS = 16;

/** A place's name as a piece of an id: `North Gate` is `north-gate`. */
export function placeSlug(name: string): string {
  return foldedSlug(name);
}

export function playerMapId(file: Pick<MapFile, 'id'>): PlayerMapId {
  return `${PLAYER_MAP_PREFIX}${file.id}`;
}

export function isPlayerMapId(id: string): id is PlayerMapId {
  return id.startsWith(PLAYER_MAP_PREFIX);
}

/**
 * A landing on a file map, in the shape the shipped landings have
 * (`RUN_INSERTIONS`). Its id is the map's id and the place's own name, so it
 * can never be one of the shipped landings' ids.
 */
export interface FileMapInsertion {
  readonly id: string;
  readonly label: string;
  readonly mapId: WorldMapId;
  readonly position: { readonly x: number; readonly y: number };
  readonly description: string;
}

export interface PlayerMapInsertion extends FileMapInsertion {
  readonly id: PlayerMapId;
  readonly mapId: PlayerMapId;
}

/**
 * A player's map: everything the rest of the game needs of one map file, built
 * once under its `player-` id.
 */
export interface PlayerMap extends FileMap {
  readonly id: PlayerMapId;
  readonly insertions: readonly PlayerMapInsertion[];
}

/**
 * Everything the rest of the game needs of one map drawn as a file, built once:
 * a player's map (`PlayerMap`), or a shipped map the game's own tools drew as a
 * file (`builtInFileMap` in `playerMaps.ts`), built under its shipped id.
 */
export interface FileMap {
  readonly id: WorldMapId;
  readonly name: string;
  readonly maker: string;
  readonly file: MapFile;
  /** A fresh sketch per build, as the shipped maps' are: a gate state is drawn onto one. */
  readonly sketch: () => MapSketch<PlayerMapPropName>;
  readonly tileset: TilesetCatalogue<PlayerMapPropName>;
  readonly encounters: WildEncounterTable;
  readonly loot: readonly WorldLoot[];
  readonly insertions: readonly FileMapInsertion[];
  readonly exits: readonly ExtractionPoint[];
  /** Its townsfolk and signs, as the shipped maps' are authored (`npcs.ts`). */
  readonly entities: readonly WorldEntity[];
  readonly pois: readonly WorldPoi[];
  readonly districts: readonly MapDistrict[];
  /** Its Cut trees and Surf water, as the game's own field-move gates. */
  readonly gates: readonly MapGate[];
  /** Its ledges, every one a drop a player can hop down and nobody can climb. */
  readonly ledges: readonly MapLedge[];
  /** Its floor switches and levers, each opening a barrier for the raid (`switches.ts`). */
  readonly switches: readonly WorldSwitch[];
  /** Fresh Pokemon every call, as `createRunTrainerEncounters` hands out, so no fight leaks into the next raid. */
  readonly trainers: () => readonly RunTrainerEncounter[];
  /**
   * The map as the one grid it is played on, outdoors and every area together
   * (`mapAreas.ts`), with the doors named in `opened` open (`gateKey`).
   * `getWorldMap` keeps what it builds, one per arrangement of the doors.
   */
  readonly compose: (opened?: readonly string[]) => ComposedMap;
  /** Where each place of the map lies in that grid, the outdoors first. */
  readonly areas: readonly PlacedArea[];
}

/**
 * What an item spot holds, in turn. A maker says where; this says what, and it
 * is the shipped maps' own mix - supplies first, then Brock's materials - so a
 * player map pays like ground the game already priced. Pokedollars come twice
 * and never again, which is under every shipped map's bundles: the faucet Bill's
 * prices are set against is measured off the maps (`hub/trader.test.ts`).
 */
const ITEM_SPOT_ROTATION: readonly { readonly itemId: ItemId; readonly quantity: number }[] = [
  { itemId: 'potion', quantity: 1 },
  { itemId: 'poke-ball', quantity: 2 },
  { itemId: 'antidote', quantity: 1 },
  { itemId: 'money', quantity: 30 },
  { itemId: 'parts-crate', quantity: 1 },
  { itemId: 'super-potion', quantity: 1 },
  { itemId: 'great-ball', quantity: 1 },
  { itemId: 'lamp-oil', quantity: 1 },
  { itemId: 'money', quantity: 45 },
  { itemId: 'cable-coil', quantity: 1 },
  { itemId: 'potion', quantity: 1 },
  { itemId: 'linen-roll', quantity: 1 },
  { itemId: 'poke-ball', quantity: 1 },
  { itemId: 'mooring-rope', quantity: 1 },
  { itemId: 'radio-valve', quantity: 1 },
];

/** What the nth item spot of a file holds, by the rotation above. */
export function itemSpotContents(index: number): {
  readonly itemId: ItemId;
  readonly quantity: number;
} {
  const repeating = ITEM_SPOT_ROTATION.filter((entry) => entry.itemId !== 'money');
  return index < ITEM_SPOT_ROTATION.length
    ? ITEM_SPOT_ROTATION[index]
    : repeating[(index - ITEM_SPOT_ROTATION.length) % repeating.length];
}

/**
 * The pool a file map's item spots are, by the rotation above. A spot marked
 * `key` holds the Card Key instead, as a prize: rolled on its own odds and
 * seated in the district it stands in, as the shipped maps' keys are, and
 * left out of the rotation so every other spot holds what it always held.
 */
function lootFor(
  id: WorldMapId,
  spots: readonly MapFileItemSpot[],
  at: (spot: MapFileSpot) => { x: number; y: number },
  districts: readonly MapFileDistrict[],
): WorldLoot[] {
  let turn = 0;
  return spots.map((spot, index) => {
    const common = {
      id: `${id}/spot-${index + 1}`,
      position: at(spot),
      ...(spot.hidden ? { hidden: true } : {}),
    };
    if (spot.key || spot.prize) {
      const home = districts.findIndex(
        (district) =>
          district.area === spot.area &&
          spot.x >= district.x &&
          spot.x < district.x + district.width &&
          spot.y >= district.y &&
          spot.y < district.y + district.height,
      );
      return {
        ...common,
        itemId: spot.prize ?? MAP_FILE_EXIT_KEY,
        quantity: 1,
        chance: spot.prize ? MAP_FILE_PRIZES[spot.prize] : CARD_KEY_CHANCE,
        ...(home >= 0 ? { district: `${id}/district-${home + 1}` } : {}),
      };
    }
    const entry = itemSpotContents(turn);
    turn += 1;
    return { ...common, itemId: entry.itemId, quantity: entry.quantity };
  });
}

/** The sketch a file's ground and buildings make. */
export function sketchMapFile(file: MapFile): MapSketch<PlayerMapPropName> {
  const sketch = new MapSketch<PlayerMapPropName>({
    width: file.width,
    height: file.height,
    fill: MATERIAL_CHARS.tree,
    stamps: MAP_FILE_STAMPS,
  });
  sketch.draw(0, 0, file.ground);
  for (const building of file.buildings) {
    if (isOutdoorBuilding(building.kind)) {
      sketch.plant(building.x, building.y, MAP_FILE_BUILDINGS[building.kind]);
    }
  }
  return sketch;
}

/** What a door is called over it, and what it looks like shut and open. */
const DOOR_LOOKS: Readonly<
  Record<MapFileDoorKind, { readonly label: string; readonly fieldMove: FieldMoveId }>
> = {
  'cut-tree': { label: 'SMALL TREE', fieldMove: 'cut' },
  surf: { label: 'DEEP WATER', fieldMove: 'surf' },
  'smash-rock': { label: 'CRACKED ROCK', fieldMove: 'rock-smash' },
};

/** The material a ground letter is, reading a stamp as what it stands on. */
function materialOf(letter: string | undefined): Material | undefined {
  if (letter === undefined) {
    return undefined;
  }
  const ground = MAP_FILE_STAMPS[letter]?.ground ?? letter;
  return (Object.keys(MATERIAL_CHARS) as Material[]).find(
    (material) => MATERIAL_CHARS[material] === ground,
  );
}

/**
 * A file's doors as the game's own field-move gates: a small tree on whatever
 * ground was painted under it, cleared for good by Cut, and a stretch of deep
 * water Surf turns into water shallow enough to wade - the pair the
 * Floodplain's SHOAL CROSSING already uses, so the open door looks like a way
 * and the shut one like a wall. A gate is drawn over the sketch in the state
 * the save has earned (`applyGates`), never into the sketch itself.
 */
export function fileDoorGates(file: MapFile, id: WorldMapId = playerMapId(file)): readonly MapGate[] {
  return (file.doors ?? []).map((door, index): MapGate => {
    const look = DOOR_LOOKS[door.kind];
    const tiles = Array.from({ length: door.width * door.height }, (_tile, cell) => ({
      x: door.x + (cell % door.width),
      y: door.y + Math.floor(cell / door.width),
    }));
    const base = { id: `${id}/door-${index + 1}`, mapId: id, label: look.label, tiles };
    if (door.kind !== 'surf') {
      const under = materialOf(file.ground[door.y]?.[door.x]);
      const ground: Material = under && !MATERIALS[under].solid ? under : 'grass';
      const stands = door.kind === 'cut-tree' ? 'cutTree' : 'smashRock';
      return {
        ...base,
        fieldMove: look.fieldMove,
        closed: { material: ground, props: [{ name: stands, x: door.x, y: door.y }] },
        open: { material: ground },
      };
    }
    return {
      ...base,
      fieldMove: look.fieldMove,
      closed: { material: 'water' },
      open: { material: 'ford' },
    };
  });
}

const LEDGE_LETTERS = new Set(['<', '=', '>']);

/**
 * A file's ledges as drops a player can hop down, as every ledge in FireRed is:
 * each row of painted ledge is one, its brow the walkable ground along the top
 * of it. A tile of it only hops where there is ground to land on below, that is
 * not a way in or out of the map - a hop that ended a raid or landed on a
 * drop-in would be a door nobody chose - and that no building or door stands
 * on. Nothing else about the map changes: a ledge is solid either way, so every
 * check is still asked of the collision alone, and the hunter cannot follow.
 */
export function fileLedges(file: MapFile, id: WorldMapId = playerMapId(file)): readonly MapLedge[] {
  const covered = new Set<string>();
  for (const building of file.buildings) {
    const prop = plantedProp(building.kind);
    prop?.cells.forEach((cell, index) => {
      if (cell.solid) {
        covered.add(`${building.x + (index % prop.width)},${building.y + Math.floor(index / prop.width)}`);
      }
    });
  }
  for (const door of file.doors ?? []) {
    for (let dy = 0; dy < door.height; dy += 1) {
      for (let dx = 0; dx < door.width; dx += 1) {
        covered.add(`${door.x + dx},${door.y + dy}`);
      }
    }
  }
  // Ledges are painted outdoors, so only an outdoor way in or out can be landed on.
  const places = new Set(
    [...file.dropIns, ...file.exits]
      .filter((spot) => spot.area === undefined)
      .map((spot) => `${spot.x},${spot.y}`),
  );
  const ground = (x: number, y: number): boolean => {
    const material = materialOf(file.ground[y]?.[x]);
    const letter = file.ground[y]?.[x];
    return (
      material !== undefined &&
      !MATERIALS[material].solid &&
      letter !== MAP_FILE_STAMPS.o?.prop &&
      !['o', 'u', 'k'].includes(letter ?? '') &&
      !LEDGE_LETTERS.has(letter ?? '') &&
      !covered.has(`${x},${y}`)
    );
  };
  const ledges: MapLedge[] = [];
  file.ground.forEach((row, y) => {
    let run: { x: number; y: number }[] = [];
    const close = (): void => {
      if (run.length > 0) {
        ledges.push({
          id: `${id}/ledge-${ledges.length + 1}`,
          mapId: id,
          label: 'LEDGE',
          drop: 'down',
          brow: run,
          depth: 1,
        });
      }
      run = [];
    };
    for (let x = 0; x <= row.length; x += 1) {
      if (!LEDGE_LETTERS.has(row[x] ?? '')) {
        close();
        continue;
      }
      if (ground(x, y - 1) && ground(x, y + 1) && !places.has(`${x},${y + 1}`)) {
        run.push({ x, y: y - 1 });
      }
    }
  });
  return ledges;
}

/** Whether any outdoor ground of a file lies outside every district the file names. */
function hasUnnamedOutdoorGround(file: MapFile): boolean {
  const outdoorDistricts = (file.districts ?? []).filter((district) => district.area === undefined);
  return file.ground.some((row, y) =>
    [...row].some((letter, x) => {
      const material = materialOf(letter);
      return (
        material !== undefined &&
        !MATERIALS[material].solid &&
        !outdoorDistricts.some(
          (district) =>
            x >= district.x &&
            x < district.x + district.width &&
            y >= district.y &&
            y < district.y + district.height,
        )
      );
    }),
  );
}

/**
 * Builds the game's view of a file that `readMapFile` has accepted. Throws on a
 * file it has not, because loading one is a bug in the caller rather than
 * something to recover from.
 */
export function buildPlayerMap(file: MapFile, limits: MapFileLimits = MAP_FILE_LIMITS): PlayerMap {
  return buildFileMap(file, playerMapId(file), limits) as PlayerMap;
}

/** A map file built into game content under `id`: a player's `player-` id, or a shipped map's own. */
export function buildFileMap(
  file: MapFile,
  id: WorldMapId,
  limits: MapFileLimits = MAP_FILE_LIMITS,
): FileMap {
  const reading = readMapFile(file, { limits });
  if (!reading.ok) {
    throw new Error(
      `map file '${String(file.id)}' cannot be loaded: ${reading.problems.join(' ')}`,
    );
  }
  const credit = `Drawn by ${file.maker}.`;
  // Everything a file places is placed in its own area's tiles; the game plays
  // one grid with every area in it, so each is moved to where its area lies.
  const { areas } = layOutMapFile(file);
  const origins = new Map(areas.map((placed) => [placed.id, placed.rect]));
  const at = (spot: MapFileSpot): { x: number; y: number } => {
    const origin = origins.get(spot.area) ?? areas[0].rect;
    return { x: origin.x + spot.x, y: origin.y + spot.y };
  };
  return {
    id,
    name: file.name,
    maker: file.maker,
    file,
    sketch: () => sketchMapFile(file),
    tileset: PLAYER_MAP_TILESET,
    compose: (opened = []) => composeMapFile(file, opened, id),
    areas,
    encounters: MAP_FILE_HABITATS[file.wildlife],
    loot: lootFor(id, file.itemSpots, at, file.districts ?? []),
    // The front door carries the map's name, as every shipped map's does - it
    // is the row a map is chosen by - and says which of the map's places it is
    // in its description, the way the Floodplain's says "The Landing:".
    insertions: file.dropIns.map((dropIn, index) => {
      const about = [index === 0 ? `${dropIn.name}.` : '', dropIn.description ?? '', credit]
        .filter((part) => part.length > 0)
        .join(' ');
      return {
        id: `${id}/${dropInKey(dropIn)}`,
        label: index === 0 ? file.name : dropIn.name,
        mapId: id,
        position: at(dropIn),
        description: about,
      };
    }),
    entities: [
      ...(file.people ?? []).map((person, index): WorldEntity => ({
        id: `${id}/person-${index + 1}`,
        mapId: id,
        kind: 'npc',
        position: at(person),
        facing: person.facing,
        dialogLines: person.lines.length > 0 ? [...person.lines] : [`${person.name} nods at you.`],
        design: person.look,
      })),
      ...(file.pokemon ?? []).map((standing, index): WorldEntity => ({
        id: `${id}/pokemon-${index + 1}`,
        mapId: id,
        kind: 'npc',
        position: at(standing),
        facing: 'down',
        dialogLines: [pokemonCry(standing.species)],
        pokemon: standing.species,
        ...(standing.level !== undefined ? { wildLevel: standing.level } : {}),
        ...(standing.legendary ? { legendary: true } : {}),
      })),
      ...(file.berryTrees ?? []).map((tree, index): WorldEntity => ({
        id: `${id}/berry-tree-${index + 1}`,
        mapId: id,
        kind: 'npc',
        position: at(tree),
        facing: 'down',
        dialogLines: [...berryTreeLines(tree.berry, false)],
        berry: tree.berry,
      })),
      ...(file.boulders ?? []).map((boulder, index): WorldEntity => ({
        id: `${id}/boulder-${index + 1}`,
        mapId: id,
        kind: 'npc',
        position: at(boulder),
        facing: 'down',
        dialogLines: [...BOULDER_LINES],
        boulder: true,
      })),
      // A barrier is a wall a tile at a time, drawn as the rock's top over
      // its foot, until its switches are thrown (`switches.ts`).
      ...(file.areas ?? []).flatMap((area) =>
        (area.barriers ?? []).flatMap((barrier) =>
          Array.from({ length: barrier.width * barrier.height }, (_tile, cell): WorldEntity => {
            const dx = cell % barrier.width;
            const dy = Math.floor(cell / barrier.width);
            return {
              id: `${id}/barrier-${barrier.id}-${dx}-${dy}`,
              mapId: id,
              kind: 'npc',
              position: at({ x: barrier.x + dx, y: barrier.y + dy, area: area.id }),
              facing: 'down',
              // FireRed's barrier is scenery and says nothing when faced.
              dialogLines: [],
              barrier: { id: barrier.id, top: dy === 0 },
            };
          }),
        ),
      ),
      ...(file.signs ?? []).map((sign, index): WorldEntity => ({
        id: `${id}/sign-${index + 1}`,
        mapId: id,
        kind: 'sign',
        position: at(sign),
        facing: 'down',
        dialogLines: sign.lines.length > 0 ? [...sign.lines] : ['The sign has been left blank.'],
      })),
    ],
    pois: (file.landmarks ?? []).map((landmark, index) => {
      const kind = MAP_FILE_LANDMARKS[landmark.kind];
      return {
        id: `${id}/landmark-${index + 1}`,
        mapId: id,
        position: at(landmark),
        label: landmark.name.toUpperCase(),
        description: `${kind.label}. ${kind.says}`,
        reward: kind.reward.map((entry) => ({ ...entry })),
      };
    }),
    // The maker's own districts first, because the first listed wins a tile;
    // then each area, which is a place of its own and is named on the plate
    // as you walk in; then, on a map that has areas to come back out of, the
    // outdoors, so walking out of a house names where you are again - unless
    // the maker's districts already name all of it (Greystone Vale's do), when
    // it would be a place with no ground.
    districts: [
      ...(file.districts ?? []).map((district, index) => {
        const origin = at({ x: district.x, y: district.y, area: district.area });
        return {
          id: `${id}/district-${index + 1}`,
          mapId: id,
          name: district.name.toUpperCase(),
          areas: [{ ...origin, width: district.width, height: district.height }],
          ...(district.wildlife ? { encounters: MAP_FILE_HABITATS[district.wildlife] } : {}),
          ...(district.rain ? { weather: WeatherId.Rain } : {}),
        };
      }),
      ...areas.slice(1).map((placed) => ({
        id: `${id}/area-${String(placed.id)}`,
        mapId: id,
        name: placed.name.toUpperCase(),
        areas: [placed.rect],
        // A cave's floor is wild ground on every step, and what lives there
        // is the cave's own.
        ...(placed.kind === 'cave'
          ? {
              encounters:
                file.areas?.find((area) => area.id === placed.id)?.style === 'ice'
                  ? MAP_FILE_HABITATS.ice
                  : MAP_FILE_HABITATS.cave,
            }
          : {}),
      })),
      ...(areas.length > 1 && hasUnnamedOutdoorGround(file)
        ? [
            {
              id: `${id}/outdoors`,
              mapId: id,
              name: file.name.toUpperCase(),
              areas: [areas[0].rect],
            },
          ]
        : []),
    ],
    gates: fileDoorGates(file, id),
    ledges: fileLedges(file, id),
    switches: (file.areas ?? []).flatMap((area) =>
      (area.switches ?? []).map(
        (spot, index): WorldSwitch => ({
          id: `${id}/switch-${area.id}-${index + 1}`,
          mapId: id,
          position: at({ x: spot.x, y: spot.y, area: area.id }),
          kind: spot.kind,
          opens: spot.opens,
        }),
      ),
    ),
    trainers: () =>
      (file.trainers ?? []).map((placed, index) => {
        const template = trainerTemplate(placed.team);
        const name = placed.name.toUpperCase();
        return {
          mapId: id,
          position: at(placed),
          facing: placed.facing,
          fixedPosition: true,
          ...(placed.sight > 0 ? { sightRange: placed.sight } : {}),
          design: placed.look,
          introLines: placed.lines.length > 0 ? [...placed.lines] : [`${name} wants to battle!`],
          trainer: {
            id: `${id}/trainer-${index + 1}`,
            name,
            party: template.trainer.party.map(
              (pokemon) => new Pokemon(pokemon.base, pokemon.level),
            ),
            defeatText: 'You win. The way is yours.',
            unitCount: template.trainer.unitCount,
          },
        };
      }),
    exits: file.exits.map((exit) => {
      const unlockAtMs = exit.opens.when === 'after' ? exit.opens.seconds * 1_000 : 0;
      return {
        mapId: id,
        position: at(exit),
        label: exit.name.toUpperCase(),
        unlockAtMs,
        requirement:
          exit.opens.when === 'after'
            ? { kind: 'elapsed', unlockAtMs }
            : exit.opens.when === 'dug'
              ? { kind: 'dug' }
              : exit.opens.when === 'key'
                ? { kind: 'key', keyId: MAP_FILE_EXIT_KEY }
                : { kind: 'always' },
      };
    }),
  };
}
