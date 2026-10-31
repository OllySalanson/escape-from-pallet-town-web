import type { PropDefinition, TilesetCatalogue } from './catalogue';
import type { Material } from './materials';
import { FLOOD_TOWN_TILESET } from './floodTownTileset';
import { KANTO_TILESET, type KantoPropName } from './kantoTileset';
import { OVERWORLD } from './sheets';
import { BASE_SHEET_SOURCE, solidPiece } from '../../base/baseSheet';
import { TOWN_PROPS, TOWN_SHEET_SOURCE } from './townSheet';
import { AREA_SHEET_SOURCE, areaProp } from './areaSheet';
import type { TownPieceName } from '../generated/townPieces';
import { ICE_SHEET_SOURCE, iceProp, iceTile } from './iceSheet';
import { EMBER_SHEET_SOURCE, emberProp } from './emberSheet';
import { BOARDS, BOARDS_SHEET_SOURCE } from './boardsSheet';

/**
 * What a player's map is drawn with: the Kanto catalogue Viridian City is
 * drawn on, plus every other thing the game already draws that a map maker can
 * plant - the two FireRed buildings cut for the base, Kanto's town buildings
 * cut from FireRed's own maps (`townSheet.ts`) and the objects the Floodplain
 * stands on its FireRed grass.
 *
 * The CC0 objects are not FireRed art. They are offered because the captain
 * asked for as much as the maker can hold (2026-10-10, the palette board), and
 * because each of them was already chosen to stand on this grass
 * (`floodTownTileset.ts`). What is left out is left out on purpose: the CC0
 * doors and hatches that read as a way underground (a mine mouth, a culvert,
 * cellar doors, trapdoors) promise an inside, and insides are the map maker's
 * areas, not a picture.
 */
const CC0_OBJECTS = {
  timberHouse: 'house',
  hut: 'hut',
  tower: 'tower',
  roundhouse: 'roundhouse',
  stoneGatehouse: 'gatehouse',
  stoneBridge: 'stoneBridge',
  stoneArch: 'stoneArch',
  gateArch: 'gateArch',
  shrine: 'shrine',
  gravestone: 'gravestone',
  gravestoneWorn: 'gravestoneWorn',
  statue: 'statue',
  bridgeVertical: 'bridgeVertical',
  bridgeHorizontal: 'bridgeHorizontal',
  jetty: 'jetty',
  produce: 'produce',
  produceStall: 'produceStall',
  produceCrate: 'produceCrate',
  bedSeedlings: 'bedSeedlings',
  bedYellowCrop: 'bedYellowCrop',
  bedRedCrop: 'bedRedCrop',
  stallCounter: 'stallCounter',
  bigStump: 'bigStump',
  banner: 'banner',
  bannerPair: 'bannerPair',
  flag: 'flag',
  bench: 'bench',
  barrel: 'barrel',
  barrelPair: 'barrelPair',
  cratePair: 'cratePair',
  crateStack: 'crateStack',
  crateTower: 'crateTower',
  sack: 'sack',
  mooringPost: 'mooringPost',
  potPlant: 'potPlant',
  signboard: 'signboard',
  stump: 'stump',
  deadStump: 'deadStump',
  log: 'log',
  wetRock: 'wetRock',
  lilies: 'lilies',
  liliesWide: 'liliesWide',
  stoneFountain: 'stoneFountain',
  stripedStall: 'stripedStall',
  roundBoulder: 'roundBoulder',
} as const satisfies Record<string, keyof typeof FLOOD_TOWN_TILESET.props>;

type Cc0ObjectName = keyof typeof CC0_OBJECTS;

/**
 * The two FireRed buildings the base was given: Brock's corrugated shed and
 * Bill's blue-roofed cottage, each with its door shut - on a player's map
 * they are scenery, as most of FireRed's houses are.
 */
const BASE_BUILDINGS = {
  shed: solidPiece('workshop', 'shed'),
  blueCottage: solidPiece('cottage', 'cottage'),
} as const satisfies Record<string, PropDefinition>;

const cc0 = Object.fromEntries(
  Object.entries(CC0_OBJECTS).map(([name, source]) => [name, FLOOD_TOWN_TILESET.props[source]]),
) as Record<Cc0ObjectName, PropDefinition>;

/**
 * A lily pad is a stepping stone, walked over wherever it is planted; this is the
 * same pad as a thing floating on deep water, which stays deep water.
 */
const WATER_PLANTS = {
  waterLily: {
    ...FLOOD_TOWN_TILESET.props.lilies,
    cells: FLOOD_TOWN_TILESET.props.lilies.cells.map((cell) => ({ ...cell, solid: true })),
  },
} as const satisfies Record<string, PropDefinition>;

/**
 * Ice, out of doors: Icefall Cave's sheet of it, which FireRed only ever lays
 * underground, laid where a map freezes over - a frozen lagoon, an ice shelf -
 * with the snowy boulders that stand on it, which are what a slide across it
 * stops against (`slidingFloor.ts`). The ice runs into the water it froze on
 * without a bank.
 */
const ICE = {
  snowyBoulder: iceProp('ice.boulder', 'boulder'),
  snowyBoulderLow: iceProp('ice.boulderLow', 'boulder'),
  snowyBoulderTall: iceProp('ice.boulderTall', 'boulder'),
  iceRocks: iceProp('ice.rock', 'rock'),
  iceSpire: iceProp('ice.crystal', 'ice crystal'),
} as const satisfies Record<string, PropDefinition>;

/**
 * A mountain's own, out of doors: the stone steps FireRed cuts through a band
 * of rock on Mt. Ember's slopes, which are ground - laid over a gap in the
 * rock, they are the way up it.
 */
const MOUNTAIN = {
  cliffSteps: emberProp('ember.steps', 'steps', ['..']),
} as const satisfies Record<string, PropDefinition>;

/**
 * The Pokemon Tower's graves and statues, cut from the top layer of its floors
 * (`scripts/cut-frlg-areas.mjs`) and so clear of any ground: FireRed's own
 * graves, stood out of doors as no FireRed map stands them.
 */
const TOWER_STONES = {
  graveStone: areaProp('tower.grave', 'grave'),
  goldGraveStone: areaProp('tower.goldGrave', 'grave'),
  graveStatue: areaProp('tower.statue', 'statue'),
} as const satisfies Record<string, PropDefinition>;

export type PlayerMapPropName =
  | KantoPropName
  | Cc0ObjectName
  | keyof typeof BASE_BUILDINGS
  | keyof typeof ICE
  | keyof typeof MOUNTAIN
  | keyof typeof TOWER_STONES
  | keyof typeof WATER_PLANTS
  | TownPieceName;

const BEACH_MEETS: readonly Material[] = [
  'grass',
  'turf',
  'tall-grass',
  'earth',
  'sand',
  'gravel',
  'paving',
  'stone',
  'hedge',
  'tree',
  'cliff',
  'fence',
  'wall',
  'boards',
];

export const PLAYER_MAP_TILESET: TilesetCatalogue<PlayerMapPropName> = {
  ...KANTO_TILESET,
  sources: [
    ...KANTO_TILESET.sources,
    OVERWORLD.source,
    BASE_SHEET_SOURCE.source,
    TOWN_SHEET_SOURCE.source,
    ICE_SHEET_SOURCE.source,
    EMBER_SHEET_SOURCE.source,
    AREA_SHEET_SOURCE.source,
    BOARDS_SHEET_SOURCE.source,
  ],
  materials: {
    ...KANTO_TILESET.materials,
    ice: { roles: { fill: iceTile('ice.sheet') } },
    boards: BOARDS,
    // A beach draws its surf where it meets the sea and nowhere else, or the tide
    // comes in against the cliff at the back of a cove and round every tree on the
    // shore. FireRed draws a waterline in the sand, so the sea gives up its bank.
    beach: { ...KANTO_TILESET.materials.beach, joins: BEACH_MEETS },
    // A deck stands over water with no bank under it: the bank is for land.
    water: {
      ...KANTO_TILESET.materials.water,
      joins: [...(KANTO_TILESET.materials.water.joins ?? []), 'boards', 'beach'],
    },
  },
  props: {
    ...cc0,
    ...BASE_BUILDINGS,
    ...TOWER_STONES,
    ...WATER_PLANTS,
    ...TOWN_PROPS,
    ...ICE,
    ...MOUNTAIN,
    ...KANTO_TILESET.props,
  },
};
