import type { Direction, GridPosition } from './movement/gridMovement';
import {
  PALLET_TALL_GRASS,
  VIRIDIAN_FOREST_TALL_GRASS,
  type WildEncounterTable,
} from './pokemon/encounters';
import { applyGates, gatesForMap, gateStateKey, type MapGate } from './world/gates';
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
import { FLOOD_TOWN_TILESET } from './world/tileset/floodTownTileset';

export { CLASSIC_TILE } from './world/tileset/classicTileset';
export type { MapLayers, TileLayer } from './world/tiles';

export type { MapGate } from './world/gates';

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
  /**
   * Every boss-held door on the map, open or shut. The layers and collision
   * above are already in the state this definition was built for - see
   * `getWorldMap` - so this is for drawing and naming the doors, not for
   * deciding what is solid.
   */
  readonly gates: readonly MapGate[];
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
  /** A fresh sketch per build: a gate state is drawn onto it, so it is never shared. */
  readonly sketch: () => MapSketch;
  /** The sheet this map is drawn from. Omitted is the plain classic catalogue. */
  readonly tileset?: TilesetCatalogue;
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
  content: MapContent,
  defeatedBosses: readonly string[] = [],
): WorldMapDefinition {
  const gates = gatesForMap(id);
  const tileset = content.tileset ?? CLASSIC_TILESET;
  const sketch = applyGates(content.sketch(), gates, defeatedBosses);
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
    gates,
    loot: content.loot,
  };
}

const MAP_CONTENT: Readonly<Record<WorldMapId, MapContent>> = {
  'pallet-town': {
    sketch: sketchPalletTown,
    tileset: FLOOD_TOWN_TILESET,
    encounters: PALLET_TALL_GRASS,
    loot: [
      { id: 'pallet-town-poke-ball', position: { x: 2, y: 18 }, itemId: 'poke-ball', quantity: 1 },
      { id: 'pallet-town-potion', position: { x: 23, y: 21 }, itemId: 'potion', quantity: 1 },
      { id: 'pallet-town-antidote', position: { x: 8, y: 37 }, itemId: 'antidote', quantity: 1 },
      { id: 'pallet-town-parts-crate', position: { x: 4, y: 26 }, itemId: 'parts-crate', quantity: 1 },
      { id: 'pallet-town-linen-roll', position: { x: 18, y: 33 }, itemId: 'linen-roll', quantity: 1 },
    ],
  },
  'route-1': {
    sketch: sketchRoute1,
    tileset: FLOOD_TOWN_TILESET,
    encounters: PALLET_TALL_GRASS,
    loot: [
      { id: 'route-1-poke-ball', position: { x: 3, y: 14 }, itemId: 'poke-ball', quantity: 2 },
      { id: 'route-1-potion', position: { x: 29, y: 12 }, itemId: 'potion', quantity: 1 },
      { id: 'route-1-great-ball', position: { x: 12, y: 15 }, itemId: 'great-ball', quantity: 1 },
      { id: 'route-1-cable-coil', position: { x: 8, y: 9 }, itemId: 'cable-coil', quantity: 1 },
      { id: 'route-1-radio-valve', position: { x: 22, y: 18 }, itemId: 'radio-valve', quantity: 1 },
    ],
  },
  'viridian-forest': {
    sketch: sketchViridianForest,
    tileset: FLOOD_TOWN_TILESET,
    encounters: VIRIDIAN_FOREST_TALL_GRASS,
    loot: [
      { id: 'forest-poke-ball', position: { x: 4, y: 18 }, itemId: 'poke-ball', quantity: 2 },
      { id: 'forest-super-potion', position: { x: 13, y: 22 }, itemId: 'super-potion', quantity: 1 },
      { id: 'forest-great-ball', position: { x: 27, y: 21 }, itemId: 'great-ball', quantity: 1 },
      { id: 'forest-antidote', position: { x: 21, y: 30 }, itemId: 'antidote', quantity: 1 },
      { id: 'forest-lamp-oil', position: { x: 9, y: 12 }, itemId: 'lamp-oil', quantity: 1 },
      { id: 'forest-mooring-rope', position: { x: 24, y: 27 }, itemId: 'mooring-rope', quantity: 1 },
    ],
  },
  // The first map drawn on the FireRed sheet, which is the only one with
  // transition art in it. The other three have since been redrawn on it in the
  // same hand; a catalogue is still chosen per map, which is what let that
  // happen one map at a time.
  'floodplain-relay': {
    sketch: sketchFloodplainRelay,
    tileset: FLOOD_TOWN_TILESET,
    encounters: PALLET_TALL_GRASS,
    // A pool, not a layout: `generateLoot` draws half to all of it and re-seats
    // every piece, so these are only where each falls back to. One for every
    // district, so a raid that only ever sees a slice of the map still finds one.
    loot: [
      { id: 'floodplain-potion', position: { x: 20, y: 10 }, itemId: 'potion', quantity: 1 },
      { id: 'floodplain-antidote', position: { x: 5, y: 21 }, itemId: 'antidote', quantity: 1 },
      { id: 'floodplain-poke-ball', position: { x: 16, y: 39 }, itemId: 'poke-ball', quantity: 2 },
      { id: 'floodplain-mill-potion', position: { x: 49, y: 27 }, itemId: 'potion', quantity: 1 },
      { id: 'floodplain-keep-super-potion', position: { x: 52, y: 7 }, itemId: 'super-potion', quantity: 1 },
      { id: 'floodplain-vault-great-ball', position: { x: 44, y: 53 }, itemId: 'great-ball', quantity: 1 },
      { id: 'floodplain-radio-valve', position: { x: 10, y: 14 }, itemId: 'radio-valve', quantity: 1 },
      { id: 'floodplain-mooring-rope', position: { x: 23, y: 36 }, itemId: 'mooring-rope', quantity: 1 },
      { id: 'floodplain-parts-crate', position: { x: 30, y: 39 }, itemId: 'parts-crate', quantity: 1 },
      { id: 'floodplain-mill-lamp-oil', position: { x: 46, y: 22 }, itemId: 'lamp-oil', quantity: 1 },
      { id: 'floodplain-keep-cable-coil', position: { x: 54, y: 9 }, itemId: 'cable-coil', quantity: 1 },
      { id: 'floodplain-linen-roll', position: { x: 6, y: 30 }, itemId: 'linen-roll', quantity: 1 },
    ],
  },
};

const MAP_IDS = Object.keys(MAP_CONTENT) as WorldMapId[];

/**
 * Every map with every gate shut - the world a fresh save deploys into, and the
 * one anything that has no save to ask (tests, the structure rules) reads.
 */
export const WORLD_MAPS: Readonly<Record<WorldMapId, WorldMapDefinition>> = Object.fromEntries(
  MAP_IDS.map((id) => [id, createMap(id, MAP_CONTENT[id])]),
) as Record<WorldMapId, WorldMapDefinition>;

const builtMaps = new Map<string, WorldMapDefinition>();

/**
 * A map as it stands for a player who has beaten these bosses.
 *
 * A shut gate is collision and an open one is not, and everything that walks
 * the map - the player, the hunter's search, the structure tests - reads that
 * collision, so a gate state is a different map rather than a flag checked at
 * the door. Maps are rebuilt from their sketch per state and remembered by
 * which doors are open, so however long the boss list grows a map is built once
 * per arrangement of its own doors.
 */
export function getWorldMap(
  id: WorldMapId,
  defeatedBosses: readonly string[] = [],
): WorldMapDefinition {
  const state = gateStateKey(gatesForMap(id), defeatedBosses);
  if (state === '') {
    return WORLD_MAPS[id];
  }
  const key = `${id}|${state}`;
  let built = builtMaps.get(key);
  if (!built) {
    built = createMap(id, MAP_CONTENT[id], defeatedBosses);
    builtMaps.set(key, built);
  }
  return built;
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
