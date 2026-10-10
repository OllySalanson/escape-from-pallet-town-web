import type { PropDefinition, TilesetCatalogue } from './catalogue';
import { FLOOD_TOWN_TILESET } from './floodTownTileset';
import { KANTO_TILESET, type KantoPropName } from './kantoTileset';
import { OVERWORLD } from './sheets';
import { BASE_SHEET_SOURCE, solidPiece } from '../../base/baseSheet';

/**
 * What a player's map is drawn with: the Kanto catalogue Viridian City is
 * drawn on, plus every other thing the game already draws that a map maker can
 * plant - the two FireRed buildings cut for the base and the objects the
 * Floodplain stands on its FireRed grass.
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

export type PlayerMapPropName = KantoPropName | Cc0ObjectName | keyof typeof BASE_BUILDINGS;

const cc0 = Object.fromEntries(
  Object.entries(CC0_OBJECTS).map(([name, source]) => [name, FLOOD_TOWN_TILESET.props[source]]),
) as Record<Cc0ObjectName, PropDefinition>;

export const PLAYER_MAP_TILESET: TilesetCatalogue<PlayerMapPropName> = {
  ...KANTO_TILESET,
  sources: [...KANTO_TILESET.sources, OVERWORLD.source, BASE_SHEET_SOURCE.source],
  props: { ...cc0, ...BASE_BUILDINGS, ...KANTO_TILESET.props },
};
