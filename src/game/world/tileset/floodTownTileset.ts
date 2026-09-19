import type { PropDefinition, TilesetCatalogue } from './catalogue';
import { FRLG_TILESET, type FrlgPropName } from './frlgTileset';
import { OVERWORLD_PROPS, type OverworldPropName } from './overworldTileset';
import { OVERWORLD } from './sheets';

/**
 * The ground the maps are drawn on, with a town's worth of things standing on
 * it.
 *
 * The FireRed sheet has the ground - eight materials, every one with its inside
 * corners - and almost nothing built: one shop front, one stall, one fountain.
 * A river town cannot be drawn with one building. ArMM1998's CC0 sheet is the
 * other way round: its grass cannot meet this grass (hue 123 against 152), but
 * a timber house or a stone tower carries its own shadow and its own outline
 * and stands on either. That was argued in `pokemonGround.ts`; this is the same
 * split made on the sheet the maps now use.
 *
 * The objects are chosen, not merged. Every name below was looked at standing
 * on this grass before it went in (`tools/tileset/props.mts -- flood-town`),
 * and what is left out was left out on purpose: the CC0 sheet's trees and
 * hedges are its own green and read as transplanted, its cliffs carry its own
 * water, and its skulls belong to a different game.
 */
const CHOSEN = [
  // Buildings - timber and stone, which is what a river town is made of.
  'house',
  'barn',
  'hut',
  'tower',
  'roundhouse',
  'gatehouse',
  'stoneBridge',
  'stoneArch',
  'gateArch',
  'shrine',
  'gravestone',
  'gravestoneWorn',
  'statue',
  'mineMouth',
  'cellarDoors',
  'culvert',
  'trapdoor',
  'trapdoorOpen',
  // Structures.
  'bridgeVertical',
  'bridgeHorizontal',
  'jetty',
  'produce',
  'produceStall',
  'stallCounter',
  'bigStump',
  'banner',
  'bannerPair',
  'flag',
  'bench',
  // What people left.
  'barrel',
  'barrelPair',
  'cratePair',
  'crateStack',
  'crateTower',
  'sack',
  'mooringPost',
  'potPlant',
  'signboard',
  'stump',
  'deadStump',
  'log',
  'wetRock',
  'lilies',
  'liliesWide',
] as const satisfies readonly OverworldPropName[];

type ChosenName = (typeof CHOSEN)[number];

/**
 * The few objects both sheets have. The FireRed one keeps the plain name,
 * because it is the one drawn in this ground's own hand; the CC0 one is named
 * for what makes it different.
 */
const RENAMED = {
  stoneFountain: 'fountain',
  stripedStall: 'marketStall',
  roundBoulder: 'boulder',
} as const satisfies Record<string, OverworldPropName>;

type RenamedName = keyof typeof RENAMED;

export type FloodTownPropName = FrlgPropName | ChosenName | RenamedName;

const chosen = Object.fromEntries(CHOSEN.map((name) => [name, OVERWORLD_PROPS[name]])) as Record<
  ChosenName,
  PropDefinition
>;

const renamed = Object.fromEntries(
  Object.entries(RENAMED).map(([name, source]) => [name, OVERWORLD_PROPS[source]]),
) as Record<RenamedName, PropDefinition>;

export const FLOOD_TOWN_TILESET: TilesetCatalogue<FloodTownPropName> = {
  sources: [...FRLG_TILESET.sources, OVERWORLD.source],
  materials: FRLG_TILESET.materials,
  props: { ...chosen, ...renamed, ...FRLG_TILESET.props },
};
