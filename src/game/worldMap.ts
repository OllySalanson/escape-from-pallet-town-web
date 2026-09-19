import type { Direction, GridPosition } from './movement/gridMovement';
import {
  PALLET_TALL_GRASS,
  VIRIDIAN_FOREST_TALL_GRASS,
  type WildEncounterTable,
} from './pokemon/encounters';
import type { WorldLoot } from './world/loot';
import type { MapSketch } from './world/mapGrid';
import { sketchFloodplainRelay } from './world/maps/floodplainRelay';
import { sketchPalletTown } from './world/maps/palletTown';
import { sketchRoute1 } from './world/maps/route1';
import { sketchViridianForest } from './world/maps/viridianForest';
import { entitiesForMap, type WorldEntity } from './world/npcs';
import { poisForMap, type WorldPoi } from './world/pois';
import { buildMapLayers, type MapLayers } from './world/tiles';
import type { TilesetCatalogue } from './world/tileset/catalogue';
import { CLASSIC_TILESET } from './world/tileset/classicTileset';
import { POKEMON_GROUND_TILESET } from './world/tileset/pokemonGround';

export { CLASSIC_TILE } from './world/tileset/classicTileset';
export type { MapLayers, TileLayer } from './world/tiles';

export const TILE_SIZE = 16;

export type WarpActivation = 'step' | 'interact';

export interface MapWarp {
  readonly source: GridPosition;
  readonly destinationMapId: WorldMapId;
  readonly destination: GridPosition;
  readonly facing: Direction;
  readonly activation: WarpActivation;
}

export interface WorldMapDefinition {
  readonly id: WorldMapId;
  readonly width: number;
  readonly height: number;
  /**
   * What is drawn, in four bands: the ground, the growth and structure standing
   * on it, planted landmarks, and the part of a landmark a figure walks behind.
   */
  readonly layers: MapLayers;
  /** The sheet this map is drawn from, so two maps may use two sheets. */
  readonly tileset: TilesetCatalogue;
  readonly collision: readonly boolean[][];
  /**
   * Per tile, not per rectangle: tall grass is authored tile by tile now, so a
   * reed shelf or a forest trail can be one tile wide and still cost the player
   * encounters for every step of it.
   */
  readonly tallGrass: readonly boolean[][];
  readonly encounters?: WildEncounterTable;
  readonly warps: readonly MapWarp[];
  readonly entities: readonly WorldEntity[];
  /**
   * The pool a raid's loot is drawn from, not what lies on the ground: for each
   * raid `generateLoot()` in `runGeneration.ts` takes half to all of it and
   * re-seats every piece on a free tile, so a `position` here is only where it
   * falls back to when a map has no free tile left.
   */
  readonly loot: readonly WorldLoot[];
  /** Fixed landmarks are authored separately from randomised run loot. */
  readonly pois: readonly WorldPoi[];
}

export type WorldMapId = 'pallet-town' | 'route-1' | 'viridian-forest' | 'floodplain-relay';

/** One place for the player-facing name of an area, so signage cannot drift. */
export const WORLD_MAP_NAMES: Readonly<Record<WorldMapId, string>> = {
  'pallet-town': 'Pallet Town',
  'route-1': 'Route 1',
  'viridian-forest': 'Viridian Forest',
  'floodplain-relay': 'Floodplain Relay',
};

interface MapContent {
  readonly encounters?: WildEncounterTable;
  readonly loot: readonly WorldLoot[];
}

/**
 * Every raid map is an arena entered at its own insertion. The warp machinery
 * stays because the engine supports it, but no authored map uses it: a raid map
 * is somewhere you drop into and extract from, not a corridor into the next
 * screen, and `WorldScene.warp()` costs a third of a second of black screen
 * that a five-minute raid should never spend ten times.
 */
function createMap(
  id: WorldMapId,
  sketch: MapSketch,
  content: MapContent,
  tileset: TilesetCatalogue = CLASSIC_TILESET,
): WorldMapDefinition {
  const layers = buildMapLayers(sketch, tileset);
  return {
    id,
    width: sketch.width,
    height: sketch.height,
    layers,
    tileset,
    collision: layers.collision,
    tallGrass: layers.tallGrass,
    ...(content.encounters ? { encounters: content.encounters } : {}),
    warps: [],
    entities: entitiesForMap(id),
    pois: poisForMap(id),
    loot: content.loot,
  };
}

export const WORLD_MAPS: Readonly<Record<WorldMapId, WorldMapDefinition>> = {
  'pallet-town': createMap('pallet-town', sketchPalletTown(), {
    encounters: PALLET_TALL_GRASS,
    loot: [
      { id: 'pallet-town-poke-ball', position: { x: 2, y: 13 }, itemId: 'poke-ball', quantity: 1 },
      { id: 'pallet-town-potion', position: { x: 1, y: 20 }, itemId: 'potion', quantity: 1 },
      { id: 'pallet-town-antidote', position: { x: 18, y: 39 }, itemId: 'antidote', quantity: 1 },
    ],
  }),
  'route-1': createMap('route-1', sketchRoute1(), {
    encounters: PALLET_TALL_GRASS,
    loot: [
      { id: 'route-1-poke-ball', position: { x: 4, y: 7 }, itemId: 'poke-ball', quantity: 2 },
      { id: 'route-1-potion', position: { x: 28, y: 9 }, itemId: 'potion', quantity: 1 },
      { id: 'route-1-great-ball', position: { x: 4, y: 22 }, itemId: 'great-ball', quantity: 1 },
    ],
  }),
  'viridian-forest': createMap('viridian-forest', sketchViridianForest(), {
    encounters: VIRIDIAN_FOREST_TALL_GRASS,
    loot: [
      { id: 'forest-poke-ball', position: { x: 4, y: 18 }, itemId: 'poke-ball', quantity: 2 },
      { id: 'forest-super-potion', position: { x: 14, y: 22 }, itemId: 'super-potion', quantity: 1 },
      { id: 'forest-great-ball', position: { x: 27, y: 21 }, itemId: 'great-ball', quantity: 1 },
      { id: 'forest-antidote', position: { x: 21, y: 30 }, itemId: 'antidote', quantity: 1 },
    ],
  }),
  // The one map drawn from the wide vocabulary: GBA-palette ground with the
  // CC0 sheet's objects standing on it. The other three keep the plain classic
  // catalogue until they are redrawn to the same standard - a catalogue is
  // chosen per map precisely so that can happen one map at a time.
  'floodplain-relay': createMap(
    'floodplain-relay',
    sketchFloodplainRelay(),
    {
      encounters: PALLET_TALL_GRASS,
      loot: [
        { id: 'floodplain-potion', position: { x: 7, y: 12 }, itemId: 'potion', quantity: 1 },
        { id: 'floodplain-antidote', position: { x: 11, y: 15 }, itemId: 'antidote', quantity: 1 },
      ],
    },
    POKEMON_GROUND_TILESET,
  ),
};

export function getWorldMap(id: WorldMapId): WorldMapDefinition {
  return WORLD_MAPS[id];
}

export function getWarpAt(
  map: WorldMapDefinition,
  position: GridPosition,
  activation: WarpActivation,
): MapWarp | undefined {
  return map.warps.find(
    (warp) =>
      warp.activation === activation &&
      warp.source.x === position.x &&
      warp.source.y === position.y,
  );
}

export function isTallGrassInMap(map: WorldMapDefinition, position: GridPosition): boolean {
  return map.tallGrass[position.y]?.[position.x] === true;
}
