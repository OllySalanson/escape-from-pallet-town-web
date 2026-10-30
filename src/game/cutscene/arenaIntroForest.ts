import type { GridPosition } from '../movement/gridMovement';
import { MapSketch } from '../world/mapGrid';
import { buildMapLayers, type MapLayers } from '../world/tiles';
import {
  FLOOD_TOWN_TILESET,
  type FloodTownPropName,
} from '../world/tileset/floodTownTileset';

/**
 * Where THE RAID ARENA's trailer is set (`arenaIntro.ts`): a clearing in a
 * night wood, drawn the way every raid map is - FireRed's ground carved out
 * of solid forest (`AGENTS.md`, `MapSketch`) - with an earth path in from the
 * south, a clearing with its beds of tall grass, and the way out north-east to
 * an exit. Nobody walks it but the trailer, so it is held to one rule only:
 * every tile a figure is scripted onto is open ground (`arenaIntroForest.test.ts`).
 */
export const ARENA_INTRO_FOREST_WIDTH = 44;
export const ARENA_INTRO_FOREST_HEIGHT = 29;

function sketchForest(): MapSketch<FloodTownPropName> {
  const map = new MapSketch<FloodTownPropName>({
    width: ARENA_INTRO_FOREST_WIDTH,
    height: ARENA_INTRO_FOREST_HEIGHT,
    fill: 'T',
    stamps: {
      t: {
        prop: 'tree',
        anchor: [1, 2],
        ground: '.',
        bare: 'T',
        blocks: [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0]],
      },
    },
  });
  // The wood, a tree every third tile on every third row, with three rows of
  // thicket over the top so the way out is not on the map's edge, where the
  // letterbox would cut its light off.
  map.draw(0, 0, [
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  ]);
  // Carved out of it: the path from the south, the clearing, and the way out
  // north-east. A space leaves the wood alone.
  map.draw(0, 3, [
    '                                            ',
    '                                       .,,. ',
    '                             ...........,,. ',
    '                             .,,,,,,,,,,,,. ',
    '                             .,,,,,,,,,,,,. ',
    '                             .............. ',
    '                             .,,.           ',
    '                             .,,.           ',
    '            ........,,,,,,,,,,,,            ',
    '            .ggggg..,,,,,,,,,,,,            ',
    '           ..ggggg..,,...........           ',
    '           ..ggggg..,,gg.ggggg...           ',
    '           .........,,gg.ggggg...           ',
    '           .........,,...ggggg...           ',
    '           ...ggggg.,,...........           ',
    '           ...ggggg.,,..gggggg...           ',
    '   ,,,,,,,,,,,,,,,,,,,..gggggg...           ',
    '   ,,,,,,,,,,,,,,,,,,,..gggggg..            ',
    '   ,,       ....................            ',
    '  .,,.                                      ',
    '  .,,.                                      ',
    '  .,,.                                      ',
    '  .,,.                                      ',
    '  .,,.                                      ',
    '  .,,.                                      ',
    '   ,,                                       ',
  ]);
  return map;
}

export interface ArenaIntroForest {
  readonly layers: MapLayers;
  readonly collision: readonly (readonly boolean[])[];
}

export function arenaIntroForest(): ArenaIntroForest {
  const sketch = sketchForest();
  const layers = buildMapLayers(sketch, FLOOD_TOWN_TILESET);
  return { layers, collision: layers.collision };
}

export const ARENA_INTRO_FOREST_SOURCES = FLOOD_TOWN_TILESET.sources;

/** Corners of a walk, joined by straight runs of tiles. */
export type Route = readonly GridPosition[];

/** Every tile of a route from its first corner to its last, one step apart. */
export function routeTiles(route: Route): GridPosition[] {
  const tiles: GridPosition[] = [route[0]];
  for (let index = 1; index < route.length; index += 1) {
    const from = route[index - 1];
    const to = route[index];
    if (from.x !== to.x && from.y !== to.y) {
      throw new Error(`a route turns only at right angles: ${from.x},${from.y} to ${to.x},${to.y}`);
    }
    const dx = Math.sign(to.x - from.x);
    const dy = Math.sign(to.y - from.y);
    for (let x = from.x, y = from.y; x !== to.x || y !== to.y; ) {
      x += dx;
      y += dy;
      tiles.push({ x, y });
    }
  }
  return tiles;
}

/** Up the path from the south, along it into the clearing, to the grass that moves. */
export const SNEAK_ROUTE: Route = [
  { x: 3, y: 25 },
  { x: 3, y: 19 },
  { x: 20, y: 19 },
  { x: 20, y: 15 },
];

/** Where each find lies, on the sneak route, in the order they are picked up. */
export const FIND_TILES: readonly GridPosition[] = [
  { x: 3, y: 22 },
  { x: 9, y: 19 },
  { x: 20, y: 17 },
];

/** The tall grass that moves beside the player. */
export const RUSTLE_TILE: GridPosition = { x: 22, y: 15 };

/** Where the player and the partner stand when the hunter finds them. */
export const STAND_TILE: GridPosition = { x: 20, y: 15 };
export const PARTNER_STAND_TILE: GridPosition = { x: 20, y: 16 };

/** The hunter: out of the trees on the east of the clearing, to a few steps off. */
export const HUNTER_ROUTE: Route = [
  { x: 31, y: 13 },
  { x: 24, y: 13 },
];

/** The ring the hunter's team closes round the two of them. */
export const SWARM_RING: readonly GridPosition[] = [
  { x: 18, y: 14 },
  { x: 22, y: 14 },
  { x: 18, y: 17 },
  { x: 22, y: 17 },
  { x: 19, y: 12 },
  { x: 21, y: 18 },
];

/** Where each of the team comes out of the wood from, ring place for ring place. */
export const SWARM_FROM: readonly GridPosition[] = [
  { x: 11, y: 13 },
  { x: 31, y: 15 },
  { x: 11, y: 18 },
  { x: 31, y: 19 },
  { x: 14, y: 11 },
  { x: 25, y: 21 },
];

/** Where the hero lands: between the two of them and the hunter. */
export const HERO_LANDING: GridPosition = { x: 22, y: 15 };

/** Out: north up the trail, east, north again and east to the exit. */
export const ESCAPE_ROUTE: Route = [
  { x: 20, y: 15 },
  { x: 20, y: 11 },
  { x: 30, y: 11 },
  { x: 30, y: 6 },
  { x: 40, y: 6 },
  { x: 40, y: 4 },
];

/**
 * Where the hero's fire drives the hunter, off the road, while the two of them
 * run past: the first tile of the chase.
 */
export const HUNTER_DRIVEN_TO: GridPosition = { x: 28, y: 13 };

/** The hunter breaks out behind them: onto the road and up it, to the fire. */
export const HUNTER_CHASE: Route = [
  HUNTER_DRIVEN_TO,
  { x: 28, y: 11 },
  { x: 30, y: 11 },
  { x: 30, y: 6 },
  { x: 31, y: 6 },
];

/** The fire that shuts the road behind them: across the last straight, with no way round it. */
export const FIRE_WALL: readonly GridPosition[] = [
  { x: 32, y: 5 },
  { x: 32, y: 6 },
  { x: 32, y: 7 },
  { x: 32, y: 8 },
];

/** The way out, at the end of the escape. */
export const EXIT_TILE: GridPosition = { x: 40, y: 4 };
