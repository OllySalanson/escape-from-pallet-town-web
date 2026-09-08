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
import { buildMapLayers } from './world/tiles';

export {
  CLASSIC_TILE,
  POND_TILES,
  SOLID_CLASSIC_TILES,
  WATER_TINT,
} from './world/tiles';

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
  readonly groundLayer: readonly number[][];
  readonly tallGrassLayer: readonly number[][];
  readonly detailLayer: readonly number[][];
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
function createMap(id: WorldMapId, sketch: MapSketch, content: MapContent): WorldMapDefinition {
  const layers = buildMapLayers(sketch);
  return {
    id,
    width: sketch.width,
    height: sketch.height,
    ...layers,
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
  'floodplain-relay': createMap('floodplain-relay', sketchFloodplainRelay(), {
    encounters: PALLET_TALL_GRASS,
    loot: [
      { id: 'floodplain-potion', position: { x: 7, y: 12 }, itemId: 'potion', quantity: 1 },
      { id: 'floodplain-antidote', position: { x: 11, y: 15 }, itemId: 'antidote', quantity: 1 },
    ],
  }),
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
