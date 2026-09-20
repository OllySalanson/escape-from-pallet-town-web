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
import type { Material } from './world/tileset/materials';
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
   * What the ground is, tile by tile, in the map's own words - `grass`, `ford`,
   * `cliff`. The layers above are tile numbers by the time they get here, and a
   * tile number means nothing without the sheet it came from; this is the
   * vocabulary a map is authored in, kept so anything that wants to say what a
   * place looks like rather than draw it can ask. The drop-in screen's
   * bird's-eye picture is derived from this and the collision beside it, which
   * is what keeps that picture in step with a redrawn map with nothing stored.
   */
  readonly terrain: readonly Material[][];
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
    // Read off the finished sketch rather than kept as it is drawn: a gate
    // writes its own tiles onto the sketch, so the material here is the one
    // the player will actually be standing on in this gate state.
    terrain: Array.from({ length: sketch.height }, (_, y) =>
      Array.from({ length: sketch.width }, (_, x) => sketch.surfaceAt(x, y)),
    ),
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
      // Scrip. Two bundles a map on the small three and three on the vast one,
      // in unequal amounts so a find is a find rather than a tick - and never
      // more than a raid's worth of it, because the Ferryman's prices are set
      // against what a raid actually brings home (`world/hub/trader.ts`).
      { id: 'pallet-town-scrip-yard', position: { x: 11, y: 24 }, itemId: 'scrip', quantity: 25 },
      { id: 'pallet-town-scrip-shed', position: { x: 26, y: 30 }, itemId: 'scrip', quantity: 40 },
      // The valley above the town and the valley below it. Loot is a pool
      // rather than a layout - `generateLoot` re-seats every piece each raid -
      // so these positions are where a piece sits when nothing moves it, and
      // the point of them is that the new ground pays as well as the old.
      { id: 'pallet-town-wood-poke-ball', position: { x: 47, y: 7 }, itemId: 'poke-ball', quantity: 1 },
      { id: 'pallet-town-hanger-potion', position: { x: 40, y: 21 }, itemId: 'potion', quantity: 1 },
      { id: 'pallet-town-quarry-parts', position: { x: 57, y: 27 }, itemId: 'parts-crate', quantity: 1 },
      { id: 'pallet-town-kiln-lamp-oil', position: { x: 51, y: 37 }, itemId: 'lamp-oil', quantity: 1 },
      { id: 'pallet-town-drove-antidote', position: { x: 37, y: 37 }, itemId: 'antidote', quantity: 1 },
      { id: 'pallet-town-meadow-poke-ball', position: { x: 19, y: 45 }, itemId: 'poke-ball', quantity: 2 },
      { id: 'pallet-town-rickyard-potion', position: { x: 30, y: 52 }, itemId: 'potion', quantity: 1 },
      { id: 'pallet-town-withy-great-ball', position: { x: 10, y: 49 }, itemId: 'great-ball', quantity: 1 },
      { id: 'pallet-town-saltings-mooring-rope', position: { x: 21, y: 68 }, itemId: 'mooring-rope', quantity: 1 },
      { id: 'pallet-town-strand-super-potion', position: { x: 13, y: 72 }, itemId: 'super-potion', quantity: 1 },
      { id: 'pallet-town-hard-cable-coil', position: { x: 37, y: 72 }, itemId: 'cable-coil', quantity: 1 },
      { id: 'pallet-town-fields-potion', position: { x: 46, y: 62 }, itemId: 'potion', quantity: 1 },
      { id: 'pallet-town-scrip-quarry', position: { x: 60, y: 16 }, itemId: 'scrip', quantity: 55 },
      // TM28 Dig, in the town whose sheds have dug rows and produce beside
      // them. A machine is rolled on its own like the stone below rather than
      // drawn from the pool, for the same reason: at pool odds a permanent
      // change to a Pokemon would be a formality, and the point of it is the
      // raid you remember finding one on.
      { id: 'pallet-town-tm-dig', position: { x: 7, y: 36 }, itemId: 'tm28-dig', quantity: 1, chance: 0.25 },
      // A pack, rolled on its own like the machines above rather than drawn
      // from the pool: a pack is gear you own, choose and lose, so finding one
      // has to be the raid you remember rather than a tick on a list. It is
      // four squares of whatever you are already wearing to carry out.
      // The gentlest map holds the workaday pack: this is where a player who
      // went down in their last one comes to stop being in a Satchel.
      { id: 'pallet-town-raid-pack', position: { x: 21, y: 28 }, itemId: 'raid-pack', quantity: 1, chance: 0.3 },
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
      { id: 'route-1-scrip-verge', position: { x: 17, y: 7 }, itemId: 'scrip', quantity: 30 },
      { id: 'route-1-scrip-station', position: { x: 23, y: 18 }, itemId: 'scrip', quantity: 45 },
      // The south half. A pool is re-seated every raid (`generateLoot`), so
      // these positions are a fallback rather than a layout - what they set is
      // how much there is to find and in roughly which country, and the route
      // is four and a half times the map it was.
      { id: 'route-1-orchard-potion', position: { x: 44, y: 16 }, itemId: 'potion', quantity: 1 },
      { id: 'route-1-paddock-poke-ball', position: { x: 53, y: 23 }, itemId: 'poke-ball', quantity: 1 },
      { id: 'route-1-paddock-antidote', position: { x: 59, y: 22 }, itemId: 'antidote', quantity: 1 },
      { id: 'route-1-steading-parts-crate', position: { x: 47, y: 39 }, itemId: 'parts-crate', quantity: 1 },
      { id: 'route-1-steading-mooring-rope', position: { x: 60, y: 36 }, itemId: 'mooring-rope', quantity: 1 },
      { id: 'route-1-pound-poke-ball', position: { x: 20, y: 37 }, itemId: 'poke-ball', quantity: 1 },
      { id: 'route-1-common-super-potion', position: { x: 23, y: 55 }, itemId: 'super-potion', quantity: 1 },
      { id: 'route-1-common-great-ball', position: { x: 15, y: 61 }, itemId: 'great-ball', quantity: 1 },
      { id: 'route-1-meadow-potion', position: { x: 6, y: 61 }, itemId: 'potion', quantity: 1 },
      { id: 'route-1-meadow-linen-roll', position: { x: 3, y: 59 }, itemId: 'linen-roll', quantity: 1 },
      { id: 'route-1-burn-lamp-oil', position: { x: 48, y: 55 }, itemId: 'lamp-oil', quantity: 1 },
      { id: 'route-1-burn-cable-coil', position: { x: 59, y: 60 }, itemId: 'cable-coil', quantity: 1 },
      { id: 'route-1-shrine-potion', position: { x: 37, y: 54 }, itemId: 'potion', quantity: 1 },
      { id: 'route-1-dell-antidote', position: { x: 52, y: 4 }, itemId: 'antidote', quantity: 1 },
      { id: 'route-1-drove-poke-ball', position: { x: 49, y: 30 }, itemId: 'poke-ball', quantity: 1 },
      { id: 'route-1-burn-radio-valve', position: { x: 50, y: 54 }, itemId: 'radio-valve', quantity: 1 },
      { id: 'route-1-scrip-steading', position: { x: 52, y: 40 }, itemId: 'scrip', quantity: 35 },
      { id: 'route-1-scrip-burn', position: { x: 48, y: 61 }, itemId: 'scrip', quantity: 55 },
      // TM40 Aerial Ace, on the road the Pidgey flock is over. It is also the
      // only machine the bug catcher's Butterfree can read.
      { id: 'route-1-tm-aerial-ace', position: { x: 18, y: 5 }, itemId: 'tm40-aerial-ace', quantity: 1, chance: 0.25 },
      // The road out: a spare of the workaday pack at its top, and the first
      // pack bigger than the one the game starts you in, deep in the south.
      { id: 'route-1-raid-pack', position: { x: 26, y: 10 }, itemId: 'raid-pack', quantity: 1, chance: 0.25 },
      { id: 'route-1-ranger-pack', position: { x: 55, y: 58 }, itemId: 'ranger-pack', quantity: 1, chance: 0.2 },
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
      { id: 'forest-scrip-stand', position: { x: 13, y: 24 }, itemId: 'scrip', quantity: 35 },
      { id: 'forest-scrip-ridge', position: { x: 26, y: 13 }, itemId: 'scrip', quantity: 50 },
      // The one evolution stone in the game, on the one map whose tall grass
      // holds a Pikachu - so the stone and the Pokemon it answers to are found
      // in the same place. One raid in five, rolled on its own rather than out
      // of the pool above, because a stone at pool odds would be a formality
      // and the walk to it is meant to be a decision.
      {
        id: 'forest-thunder-stone',
        position: { x: 20, y: 6 },
        itemId: 'thunder-stone',
        quantity: 1,
        chance: 0.2,
      },
      // TM09 Bullet Seed: the Grass move, in the wood, and the narrowest disc
      // in the game - only the Bulbasaur line can read it. The forest is the
      // map worth walking for a rarity, and it is now the map with two.
      { id: 'forest-tm-bullet-seed', position: { x: 11, y: 7 }, itemId: 'tm09-bullet-seed', quantity: 1, chance: 0.25 },
      // The east and the south. A pool, not a layout - `generateLoot` re-seats
      // every piece each raid - so these are one per place rather than a trail
      // of crumbs, which is what keeps a map four times the size worth walking.
      { id: 'forest-burn-potion', position: { x: 42, y: 12 }, itemId: 'potion', quantity: 1 },
      { id: 'forest-burn-radio-valve', position: { x: 36, y: 16 }, itemId: 'radio-valve', quantity: 1 },
      { id: 'forest-tarn-poke-ball', position: { x: 51, y: 18 }, itemId: 'poke-ball', quantity: 2 },
      { id: 'forest-glade-antidote', position: { x: 41, y: 23 }, itemId: 'antidote', quantity: 1 },
      { id: 'forest-blowdown-super-potion', position: { x: 39, y: 37 }, itemId: 'super-potion', quantity: 1 },
      { id: 'forest-kiln-parts-crate', position: { x: 57, y: 36 }, itemId: 'parts-crate', quantity: 1 },
      { id: 'forest-kiln-scrip', position: { x: 53, y: 30 }, itemId: 'scrip', quantity: 40 },
      { id: 'forest-sawpit-cable-coil', position: { x: 22, y: 40 }, itemId: 'cable-coil', quantity: 1 },
      { id: 'forest-brook-foot-poke-ball', position: { x: 6, y: 41 }, itemId: 'poke-ball', quantity: 1 },
      { id: 'forest-stone-row-potion', position: { x: 32, y: 47 }, itemId: 'potion', quantity: 1 },
      { id: 'forest-hollow-way-great-ball', position: { x: 24, y: 55 }, itemId: 'great-ball', quantity: 1 },
      { id: 'forest-quarry-linen-roll', position: { x: 40, y: 57 }, itemId: 'linen-roll', quantity: 1 },
      { id: 'forest-mere-antidote', position: { x: 9, y: 54 }, itemId: 'antidote', quantity: 1 },
      { id: 'forest-warren-potion', position: { x: 6, y: 62 }, itemId: 'potion', quantity: 1 },
      { id: 'forest-rookery-super-potion', position: { x: 55, y: 62 }, itemId: 'super-potion', quantity: 1 },
      { id: 'forest-beech-poke-ball', position: { x: 39, y: 68 }, itemId: 'poke-ball', quantity: 1 },
      { id: 'forest-drive-scrip', position: { x: 58, y: 46 }, itemId: 'scrip', quantity: 45 },
      // Two of the four maps are vast, and both of them hold the big packs -
      // the walk is the price. The charcoal burn is somebody's working camp and
      // the quarry is the far south-east of the wood.
      { id: 'forest-kiln-ranger-pack', position: { x: 56, y: 32 }, itemId: 'ranger-pack', quantity: 1, chance: 0.22 },
      { id: 'forest-quarry-hauler-frame', position: { x: 43, y: 58 }, itemId: 'hauler-frame', quantity: 1, chance: 0.12 },
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
      { id: 'floodplain-scrip-town', position: { x: 14, y: 25 }, itemId: 'scrip', quantity: 30 },
      { id: 'floodplain-scrip-mill', position: { x: 46, y: 30 }, itemId: 'scrip', quantity: 45 },
      { id: 'floodplain-scrip-keep', position: { x: 50, y: 12 }, itemId: 'scrip', quantity: 60 },
      // Two on the vast map, because it is played a district at a time and one
      // rolled find across sixty-four tiles square is a find nobody meets.
      // TM13 Ice Beam out of the drowned reach, TM23 Iron Tail out of the mill.
      // The ground the map grew into. A piece for every new district, because
      // the pool is what stops a raid that only ever sees one slice of a vast
      // map coming home with nothing: `generateLoot` draws half to all of it
      // and re-seats every piece, so these are only where each falls back to.
      { id: 'floodplain-quarry-potion', position: { x: 74, y: 10 }, itemId: 'potion', quantity: 1 },
      { id: 'floodplain-quarry-parts-crate', position: { x: 84, y: 19 }, itemId: 'parts-crate', quantity: 1 },
      { id: 'floodplain-kilns-lamp-oil', position: { x: 108, y: 14 }, itemId: 'lamp-oil', quantity: 1 },
      { id: 'floodplain-kilns-antidote', position: { x: 114, y: 23 }, itemId: 'antidote', quantity: 1 },
      { id: 'floodplain-beck-potion', position: { x: 63, y: 32 }, itemId: 'potion', quantity: 1 },
      { id: 'floodplain-cider-super-potion', position: { x: 70, y: 45 }, itemId: 'super-potion', quantity: 1 },
      { id: 'floodplain-cider-linen-roll', position: { x: 86, y: 42 }, itemId: 'linen-roll', quantity: 1 },
      { id: 'floodplain-levels-cable-coil', position: { x: 110, y: 72 }, itemId: 'cable-coil', quantity: 1 },
      { id: 'floodplain-levels-poke-ball', position: { x: 101, y: 88 }, itemId: 'poke-ball', quantity: 2 },
      { id: 'floodplain-saltings-potion', position: { x: 21, y: 77 }, itemId: 'potion', quantity: 1 },
      { id: 'floodplain-saltings-mooring-rope', position: { x: 5, y: 86 }, itemId: 'mooring-rope', quantity: 1 },
      { id: 'floodplain-staithe-great-ball', position: { x: 26, y: 106 }, itemId: 'great-ball', quantity: 1 },
      { id: 'floodplain-staithe-radio-valve', position: { x: 12, y: 104 }, itemId: 'radio-valve', quantity: 1 },
      { id: 'floodplain-hundred-antidote', position: { x: 44, y: 78 }, itemId: 'antidote', quantity: 1 },
      { id: 'floodplain-withy-super-potion', position: { x: 73, y: 71 }, itemId: 'super-potion', quantity: 1 },
      { id: 'floodplain-wall-potion', position: { x: 50, y: 100 }, itemId: 'potion', quantity: 1 },
      { id: 'floodplain-light-great-ball', position: { x: 122, y: 99 }, itemId: 'great-ball', quantity: 1 },
      // Two more bundles of scrip, and no more: the whole map has to stay
      // short of one berth (`hub/trader.test.ts` recomputes that from here).
      { id: 'floodplain-scrip-quarry', position: { x: 90, y: 18 }, itemId: 'scrip', quantity: 20 },
      { id: 'floodplain-scrip-staithe', position: { x: 34, y: 102 }, itemId: 'scrip', quantity: 35 },
      { id: 'floodplain-tm-ice-beam', position: { x: 25, y: 18 }, itemId: 'tm13-ice-beam', quantity: 1, chance: 0.25 },
      { id: 'floodplain-tm-iron-tail', position: { x: 47, y: 23 }, itemId: 'tm23-iron-tail', quantity: 1, chance: 0.25 },
      // The starting map is also a vast one, so it holds the whole range: the
      // quay's stores, the mill, and the keep nobody reaches on a first raid.
      { id: 'floodplain-quay-raid-pack', position: { x: 16, y: 26 }, itemId: 'raid-pack', quantity: 1, chance: 0.25 },
      { id: 'floodplain-mill-ranger-pack', position: { x: 49, y: 24 }, itemId: 'ranger-pack', quantity: 1, chance: 0.22 },
      { id: 'floodplain-keep-hauler-frame', position: { x: 52, y: 10 }, itemId: 'hauler-frame', quantity: 1, chance: 0.12 },
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
