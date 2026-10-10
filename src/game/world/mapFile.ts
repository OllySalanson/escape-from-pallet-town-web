import type { ItemId } from '../items';
import {
  FLOODPLAIN_REED_WILDLIFE,
  FLOODPLAIN_TOWN_WILDLIFE,
  FOREST_EDGE_WILDLIFE,
  PALLET_FIELD_WILDLIFE,
  PALLET_SHORE_WILDLIFE,
  ROUTE_MEADOW_WILDLIFE,
  type WildEncounterTable,
} from '../pokemon/encounters';
import { Pokemon } from '../pokemon';
import type { Direction } from '../movement/gridMovement';
import type { CastCharacterDesignId } from './characterDesigns';
import type { MapDistrict } from './districts';
import type { MapGate } from './gates';
import type { FieldMoveId } from './fieldMoves';
import type { MapLedge } from './ledges';
import { WeatherId } from '../pokemon/battle/weather';
import type { ExtractionPoint } from './extractionPoints';
import type { WorldEntity } from './npcs';
import { isFigureSpecies, pokemonCry, type FigureSpeciesId } from './pokemonFigures';
import type { WorldPoi } from './pois';
import { createRunTrainerEncounters, type RunTrainerEncounter } from './trainers';
import type { WorldLoot } from './loot';
import { MapSketch, type PropStamp } from './mapGrid';
import { PLAYER_MAP_TILESET, type PlayerMapPropName } from './tileset/playerMapTileset';
import { MATERIAL_CHARS, MATERIALS, type Material } from './tileset/materials';
import type { TilesetCatalogue } from './tileset/catalogue';

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
  /** The highest level a standing Pokemon may fight at: the top of the ladder the game's own trainers sit on. */
  maxPokemonLevel: 50,
  /** The widest or deepest a stretch of water Surf opens may be. */
  maxDoorSide: 12,
  maxTrainers: 12,
  /** What one person, sign or trainer may say: a few short lines. */
  maxLines: 4,
  maxLineLength: 120,
  /** How far a trainer may watch along the way they face. */
  maxSight: 4,
} as const;

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

const GROUND_LETTERS = new Set([...Object.values(MATERIAL_CHARS), ...Object.keys(MAP_FILE_STAMPS)]);

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
  'route-gate': 'routeGate',
  'league-gate': 'leagueGate',
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
  'pokemon-mansion': 'burntMansion',
  'research-lab': 'cinnabarLab',
  dojo: 'dojo',
  'bike-shop': 'bikeShop',
  'safari-gate': 'safariGate',
  'city-gate': 'cityGate',
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

export type MapFileBuildingKind = keyof typeof MAP_FILE_BUILDINGS;

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
} as const satisfies Record<string, WildEncounterTable>;

export type MapFileHabitat = keyof typeof MAP_FILE_HABITATS;

/** When an exit can be left by. Locks and keys will be more values of this. */
export type MapFileOpens =
  { readonly when: 'always' } | { readonly when: 'after'; readonly seconds: number };

export interface MapFileSpot {
  readonly x: number;
  readonly y: number;
}

/** Somewhere to find something; hidden, it is not drawn until it is stepped on. */
export interface MapFileItemSpot extends MapFileSpot {
  readonly hidden?: boolean;
}

export interface MapFileBuilding extends MapFileSpot {
  readonly kind: MapFileBuildingKind;
}

export interface MapFileDropIn extends MapFileSpot {
  readonly name: string;
  readonly description?: string;
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
}

export interface MapFileSign extends MapFileSpot {
  readonly lines: readonly string[];
}

export interface MapFileLandmark extends MapFileSpot {
  readonly name: string;
  readonly kind: MapFileLandmarkKind;
}

/** A named part of the map: a rectangle, with its own wildlife if it has any. */
export interface MapFileDistrict {
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
}

/**
 * The characters no name or line in a map file may hold. Player-written words
 * are shown on the game's DOM screens as well as on the canvas, and a file that
 * cannot carry markup is safe on every one of them without each having to
 * remember to escape it. A map has no need of any of them.
 */
export const UNSAFE_TEXT = /[<>&"]/;

/** Text with the characters a map file may not hold taken out, as a field is typed. */
export function plainText(value: string): string {
  return value.replace(/[<>&"]/g, '');
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
  options: { readonly draft?: boolean } = {},
): MapFileReading {
  const draft = options.draft === true;
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
  text('name', 'a name', MAP_FILE_LIMITS.maxNameLength);
  text('maker', "its maker's name", MAP_FILE_LIMITS.maxMakerLength);

  const { width, height } = value;
  const sized =
    isWholeNumber(width) &&
    isWholeNumber(height) &&
    width >= MAP_FILE_LIMITS.minWidth &&
    height >= MAP_FILE_LIMITS.minHeight &&
    width <= MAP_FILE_LIMITS.maxWidth &&
    height <= MAP_FILE_LIMITS.maxHeight;
  if (!sized) {
    problems.push(
      `A map is ${MAP_FILE_LIMITS.minWidth}x${MAP_FILE_LIMITS.minHeight} to ${MAP_FILE_LIMITS.maxWidth}x${MAP_FILE_LIMITS.maxHeight} tiles.`,
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

  const inBounds = (spot: Record<string, unknown>): boolean =>
    isWholeNumber(spot.x) &&
    isWholeNumber(spot.y) &&
    sized &&
    spot.x >= 0 &&
    spot.y >= 0 &&
    spot.x < width &&
    spot.y < height;

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
      if (!inBounds(spot)) {
        problems.push(`${field} ${index + 1} is not on the map.`);
      }
    });
    return raw;
  };

  for (const [index, building] of list('buildings', 200).entries()) {
    if (typeof building.kind !== 'string' || !(building.kind in MAP_FILE_BUILDINGS)) {
      problems.push(
        `Building ${index + 1} is not a building the game has: ${String(building.kind)}.`,
      );
    } else if (inBounds(building)) {
      // Its top-left corner is on the map; the rest of it has to be too, or the
      // sketch it plants into refuses it and nothing about the map can be drawn.
      const prop = PLAYER_MAP_TILESET.props[MAP_FILE_BUILDINGS[building.kind as MapFileBuildingKind]];
      if (
        (building.x as number) + prop.width > (width as number) ||
        (building.y as number) + prop.height > (height as number)
      ) {
        problems.push(`Building ${index + 1} runs off the edge of the map.`);
      }
    }
  }

  const names = (field: 'dropIns' | 'exits', max: number): void => {
    const seen = new Set<string>();
    for (const [index, spot] of list(field, max, 1).entries()) {
      const name = spot.name;
      if (typeof name !== 'string' || name.trim().length === 0) {
        problems.push(`${field === 'dropIns' ? 'Drop-in' : 'Exit'} ${index + 1} needs a name.`);
        continue;
      }
      if (name.length > MAP_FILE_LIMITS.maxPlaceNameLength) {
        problems.push(`'${name}' is longer than ${MAP_FILE_LIMITS.maxPlaceNameLength} letters.`);
      }
      const key = placeSlug(name);
      if (key.length === 0) {
        problems.push(`'${name}' needs at least one letter or digit.`);
      } else if (seen.has(key)) {
        problems.push(`Two ${field === 'dropIns' ? 'drop-ins' : 'exits'} are called '${name}'.`);
      }
      seen.add(key);
      if (
        spot.description !== undefined &&
        (typeof spot.description !== 'string' ||
          spot.description.length > MAP_FILE_LIMITS.maxDescriptionLength)
      ) {
        problems.push(
          `The description of '${name}' must be text of at most ${MAP_FILE_LIMITS.maxDescriptionLength} letters.`,
        );
      }
    }
  };
  names('dropIns', MAP_FILE_LIMITS.maxDropIns);
  names('exits', MAP_FILE_LIMITS.maxExits);

  for (const exit of Array.isArray(value.exits) ? value.exits.filter(isRecord) : []) {
    const opens = exit.opens;
    const valid =
      isRecord(opens) &&
      (opens.when === 'always' ||
        (opens.when === 'after' &&
          isWholeNumber(opens.seconds) &&
          opens.seconds > 0 &&
          opens.seconds <= MAP_FILE_LIMITS.maxExitDelaySeconds));
    if (!valid) {
      problems.push(
        `Exit '${String(exit.name)}' must open always, or after 1 to ${MAP_FILE_LIMITS.maxExitDelaySeconds} seconds.`,
      );
    }
  }

  list('itemSpots', MAP_FILE_LIMITS.maxItemSpots).forEach((spot, index) => {
    if (spot.hidden !== undefined && typeof spot.hidden !== 'boolean') {
      problems.push(`Item spot ${index + 1}'s hidden must be yes or no.`);
    }
  });

  const linesOf = (what: string, raw: unknown): void => {
    if (
      !Array.isArray(raw) ||
      raw.length > MAP_FILE_LIMITS.maxLines ||
      !raw.every((line) => typeof line === 'string' && line.length <= MAP_FILE_LIMITS.maxLineLength)
    ) {
      problems.push(
        `${what} may say up to ${MAP_FILE_LIMITS.maxLines} lines of at most ${MAP_FILE_LIMITS.maxLineLength} letters.`,
      );
    }
  };
  const nameOf = (what: string, raw: unknown): void => {
    if (
      typeof raw !== 'string' ||
      raw.trim().length === 0 ||
      raw.length > MAP_FILE_LIMITS.maxPlaceNameLength
    ) {
      problems.push(
        `${what} needs a name of at most ${MAP_FILE_LIMITS.maxPlaceNameLength} letters.`,
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

  optional('people', MAP_FILE_LIMITS.maxPeople).forEach((person, index) => {
    const what = `Person ${index + 1}`;
    nameOf(what, person.name);
    oneOf(`${what}'s look`, person.look, MAP_FILE_LOOKS);
    oneOf(`${what}'s facing`, person.facing, MAP_FILE_FACINGS);
    linesOf(what, person.lines);
  });
  optional('pokemon', MAP_FILE_LIMITS.maxPokemon).forEach((standing, index) => {
    if (!isFigureSpecies(standing.species)) {
      problems.push(`Pokémon ${index + 1} is not a Pokémon the game has.`);
    }
    if (
      standing.level !== undefined &&
      (!isWholeNumber(standing.level) ||
        standing.level < 2 ||
        standing.level > MAP_FILE_LIMITS.maxPokemonLevel)
    ) {
      problems.push(
        `Pokémon ${index + 1} fights at a level from 2 to ${MAP_FILE_LIMITS.maxPokemonLevel}.`,
      );
    }
  });
  optional('signs', MAP_FILE_LIMITS.maxSigns).forEach((sign, index) =>
    linesOf(`Sign ${index + 1}`, sign.lines),
  );
  optional('landmarks', MAP_FILE_LIMITS.maxLandmarks).forEach((landmark, index) => {
    nameOf(`Landmark ${index + 1}`, landmark.name);
    oneOf(`Landmark ${index + 1}'s kind`, landmark.kind, Object.keys(MAP_FILE_LANDMARKS));
  });
  optional('trainers', MAP_FILE_LIMITS.maxTrainers).forEach((trainer, index) => {
    const what = `Trainer ${index + 1}`;
    nameOf(what, trainer.name);
    oneOf(`${what}'s team`, trainer.team, Object.keys(MAP_FILE_TRAINER_TEAMS));
    oneOf(`${what}'s look`, trainer.look, MAP_FILE_LOOKS);
    oneOf(`${what}'s facing`, trainer.facing, MAP_FILE_FACINGS);
    if (
      !isWholeNumber(trainer.sight) ||
      trainer.sight < 0 ||
      trainer.sight > MAP_FILE_LIMITS.maxSight
    ) {
      problems.push(`${what} watches 0 to ${MAP_FILE_LIMITS.maxSight} tiles ahead.`);
    }
    linesOf(what, trainer.lines);
  });
  const districts = value.districts;
  if (districts !== undefined) {
    if (!Array.isArray(districts) || !districts.every(isRecord)) {
      problems.push(`'districts' must be a list.`);
    } else {
      if (districts.length > MAP_FILE_LIMITS.maxDistricts) {
        problems.push(`A map holds at most ${MAP_FILE_LIMITS.maxDistricts} districts.`);
      }
      districts.forEach((district, index) => {
        const what = `District ${index + 1}`;
        nameOf(what, district.name);
        const { x, y, width: w, height: h } = district;
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
          x + w <= width &&
          y + h <= height;
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
      if (doors.length > MAP_FILE_LIMITS.maxDoors) {
        problems.push(`A map holds at most ${MAP_FILE_LIMITS.maxDoors} doors.`);
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
          w <= MAP_FILE_LIMITS.maxDoorSide &&
          h <= MAP_FILE_LIMITS.maxDoorSide &&
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

  if (typeof value.wildlife !== 'string' || !(value.wildlife in MAP_FILE_HABITATS)) {
    problems.push(`'wildlife' must be one of: ${Object.keys(MAP_FILE_HABITATS).join(', ')}.`);
  }

  if (problems.length === 0 && wordsOf(value).some((text) => UNSAFE_TEXT.test(text))) {
    problems.push('Names and words in a map may not use < > & or ".');
  }

  return problems.length > 0
    ? { ok: false, problems }
    : { ok: true, file: value as unknown as MapFile };
}

/** A place's name as a piece of an id: `North Gate` is `north-gate`. */
export function placeSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
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
export interface PlayerMapInsertion {
  readonly id: PlayerMapId;
  readonly label: string;
  readonly mapId: PlayerMapId;
  readonly position: { readonly x: number; readonly y: number };
  readonly description: string;
}

/** Everything the rest of the game needs of one file map, built once. */
export interface PlayerMap {
  readonly id: PlayerMapId;
  readonly name: string;
  readonly maker: string;
  readonly file: MapFile;
  /** A fresh sketch per build, as the shipped maps' are: a gate state is drawn onto one. */
  readonly sketch: () => MapSketch<PlayerMapPropName>;
  readonly tileset: TilesetCatalogue<PlayerMapPropName>;
  readonly encounters: WildEncounterTable;
  readonly loot: readonly WorldLoot[];
  readonly insertions: readonly PlayerMapInsertion[];
  readonly exits: readonly ExtractionPoint[];
  /** Its townsfolk and signs, as the shipped maps' are authored (`npcs.ts`). */
  readonly entities: readonly WorldEntity[];
  readonly pois: readonly WorldPoi[];
  readonly districts: readonly MapDistrict[];
  /** Its Cut trees and Surf water, as the game's own field-move gates. */
  readonly gates: readonly MapGate[];
  /** Its ledges, every one a drop a player can hop down and nobody can climb. */
  readonly ledges: readonly MapLedge[];
  /** Fresh Pokemon every call, as `createRunTrainerEncounters` hands out, so no fight leaks into the next raid. */
  readonly trainers: () => readonly RunTrainerEncounter[];
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

/** The pool a file map's item spots are, by the rotation above. */
function lootFor(id: PlayerMapId, spots: readonly MapFileItemSpot[]): WorldLoot[] {
  const repeating = ITEM_SPOT_ROTATION.filter((entry) => entry.itemId !== 'money');
  return spots.map((spot, index) => {
    const entry =
      index < ITEM_SPOT_ROTATION.length
        ? ITEM_SPOT_ROTATION[index]
        : repeating[(index - ITEM_SPOT_ROTATION.length) % repeating.length];
    return {
      id: `${id}/spot-${index + 1}`,
      position: { x: spot.x, y: spot.y },
      itemId: entry.itemId,
      quantity: entry.quantity,
      ...(spot.hidden ? { hidden: true } : {}),
    };
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
    sketch.plant(building.x, building.y, MAP_FILE_BUILDINGS[building.kind]);
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
export function fileDoorGates(file: MapFile): readonly MapGate[] {
  const id = playerMapId(file);
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
export function fileLedges(file: MapFile): readonly MapLedge[] {
  const id = playerMapId(file);
  const covered = new Set<string>();
  for (const building of file.buildings) {
    const prop = PLAYER_MAP_TILESET.props[MAP_FILE_BUILDINGS[building.kind]];
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
  const places = new Set([...file.dropIns, ...file.exits].map((spot) => `${spot.x},${spot.y}`));
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

/**
 * Builds the game's view of a file that `readMapFile` has accepted. Throws on a
 * file it has not, because loading one is a bug in the caller rather than
 * something to recover from.
 */
export function buildPlayerMap(file: MapFile): PlayerMap {
  const reading = readMapFile(file);
  if (!reading.ok) {
    throw new Error(
      `map file '${String(file.id)}' cannot be loaded: ${reading.problems.join(' ')}`,
    );
  }
  const id = playerMapId(file);
  const credit = `Drawn by ${file.maker}.`;
  return {
    id,
    name: file.name,
    maker: file.maker,
    file,
    sketch: () => sketchMapFile(file),
    tileset: PLAYER_MAP_TILESET,
    encounters: MAP_FILE_HABITATS[file.wildlife],
    loot: lootFor(id, file.itemSpots),
    // The front door carries the map's name, as every shipped map's does - it
    // is the row a map is chosen by - and says which of the map's places it is
    // in its description, the way the Floodplain's says "The Landing:".
    insertions: file.dropIns.map((dropIn, index) => {
      const about = [index === 0 ? `${dropIn.name}.` : '', dropIn.description ?? '', credit]
        .filter((part) => part.length > 0)
        .join(' ');
      return {
        id: `${id}/${placeSlug(dropIn.name)}`,
        label: index === 0 ? file.name : dropIn.name,
        mapId: id,
        position: { x: dropIn.x, y: dropIn.y },
        description: about,
      };
    }),
    entities: [
      ...(file.people ?? []).map((person, index): WorldEntity => ({
        id: `${id}/person-${index + 1}`,
        mapId: id,
        kind: 'npc',
        position: { x: person.x, y: person.y },
        facing: person.facing,
        dialogLines: person.lines.length > 0 ? [...person.lines] : [`${person.name} nods at you.`],
        design: person.look,
      })),
      ...(file.pokemon ?? []).map((standing, index): WorldEntity => ({
        id: `${id}/pokemon-${index + 1}`,
        mapId: id,
        kind: 'npc',
        position: { x: standing.x, y: standing.y },
        facing: 'down',
        dialogLines: [pokemonCry(standing.species)],
        pokemon: standing.species,
        ...(standing.level !== undefined ? { wildLevel: standing.level } : {}),
      })),
      ...(file.signs ?? []).map((sign, index): WorldEntity => ({
        id: `${id}/sign-${index + 1}`,
        mapId: id,
        kind: 'sign',
        position: { x: sign.x, y: sign.y },
        facing: 'down',
        dialogLines: sign.lines.length > 0 ? [...sign.lines] : ['The sign has been left blank.'],
      })),
    ],
    pois: (file.landmarks ?? []).map((landmark, index) => {
      const kind = MAP_FILE_LANDMARKS[landmark.kind];
      return {
        id: `${id}/landmark-${index + 1}`,
        mapId: id,
        position: { x: landmark.x, y: landmark.y },
        label: landmark.name.toUpperCase(),
        description: `${kind.label}. ${kind.says}`,
        reward: kind.reward.map((entry) => ({ ...entry })),
      };
    }),
    districts: (file.districts ?? []).map((district, index) => ({
      id: `${id}/district-${index + 1}`,
      mapId: id,
      name: district.name.toUpperCase(),
      areas: [{ x: district.x, y: district.y, width: district.width, height: district.height }],
      ...(district.wildlife ? { encounters: MAP_FILE_HABITATS[district.wildlife] } : {}),
      ...(district.rain ? { weather: WeatherId.Rain } : {}),
    })),
    gates: fileDoorGates(file),
    ledges: fileLedges(file),
    trainers: () =>
      (file.trainers ?? []).map((placed, index) => {
        const template = trainerTemplate(placed.team);
        const name = placed.name.toUpperCase();
        return {
          mapId: id,
          position: { x: placed.x, y: placed.y },
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
        position: { x: exit.x, y: exit.y },
        label: exit.name.toUpperCase(),
        unlockAtMs,
        requirement:
          exit.opens.when === 'after' ? { kind: 'elapsed', unlockAtMs } : { kind: 'always' },
      };
    }),
  };
}
