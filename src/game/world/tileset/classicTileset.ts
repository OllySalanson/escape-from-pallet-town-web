import type { TilesetCatalogue } from './catalogue';
import { CLASSIC } from './sheets';

/**
 * `public/assets/tileset.png`, the 104-tile sheet the game drew every map from
 * before, catalogued so the three maps that have not been redrawn keep the look
 * they shipped with.
 *
 * It is kept for exactly that reason and no other. Its poverty is on the record
 * in `AGENTS.md`: it has no water art at all - the "pond" tiles are the same
 * green as grass and have to be tinted blue - and its hedges, trees and tall
 * grass are one leafy drawing at three densities, so a wall and a lane are told
 * apart by tint rather than by shape. Those tints are declared here rather than
 * applied by the scene, which is how the same renderer can draw both sheets.
 */

const at = CLASSIC.at;

export const CLASSIC_TILE = {
  GRASS: at(6, 5),
  TALL_GRASS: at(7, 5),
  TALL_GRASS_TUFT: at(1, 6),
  DIRT_PATH: at(4, 5),
  TREE_RED: at(0, 5),
  TREE_LEAFY: at(1, 5),
  POND_WATER: at(5, 5),
  POND_BANK_NORTH_WEST: at(2, 7),
  POND_BANK_NORTH: at(5, 8),
  POND_BANK_NORTH_EAST: at(3, 7),
  POND_BANK_WEST: at(6, 7),
  POND_BANK_EAST: at(4, 7),
  POND_BANK_SOUTH_WEST: at(2, 8),
  POND_BANK_SOUTH: at(5, 6),
  POND_BANK_SOUTH_EAST: at(3, 8),
  FENCE_LEFT: at(0, 9),
  FENCE_MIDDLE: at(1, 9),
  FENCE_RIGHT: at(2, 9),
  FENCE_VERTICAL: at(0, 10),
  FENCE_VERTICAL_BOTTOM: at(6, 10),
  FENCE_VERTICAL_TOP: at(7, 10),
  FENCE_CORNER_UP_RIGHT: at(0, 11),
  FENCE_CORNER_UP_LEFT: at(2, 11),
  /** The brown rock mass. Solid, and the only thing here that reads as height. */
  ROCK: at(5, 2),
  ROCK_LEFT: at(4, 2),
  ROCK_RIGHT: at(6, 2),
  ROCK_LOW: at(5, 4),
  /** Grass with a rock rim: the lip of the ledge the rock face hangs under. */
  LEDGE_NORTH: at(5, 0),
  LEDGE_WEST: at(4, 1),
  LEDGE_EAST: at(6, 1),
} as const;

/**
 * The classic sheet ships no water, so the pond palette is multiplied into deep
 * water; and because its hedge and its tall grass are the same drawing, the
 * wall is darkened until it reads as mass and the grass is left bright.
 */
export const WATER_TINT = 0x8073ff;
export const TREE_TINT = 0x6d8f76;
export const TALL_GRASS_TINT = 0xf4ffbe;

export const CLASSIC_TILESET: TilesetCatalogue<never> = {
  sources: [CLASSIC.source],
  materials: {
    grass: { roles: { fill: CLASSIC_TILE.GRASS } },
    'tall-grass': {
      overlay: true,
      roles: { fill: CLASSIC_TILE.TALL_GRASS_TUFT },
      tint: TALL_GRASS_TINT,
    },
    // This sheet has exactly one walkable surface that is not grass, so every
    // laid floor comes out as the same dirt and mown turf comes out as grass.
    // That poverty is left visible rather than papered over: it is the whole
    // reason the maps drawn on it looked stamped, and the maps redrawn since
    // are drawn on `frlgTileset.ts` instead.
    turf: { roles: { fill: CLASSIC_TILE.GRASS } },
    earth: { roles: { fill: CLASSIC_TILE.DIRT_PATH } },
    sand: { roles: { fill: CLASSIC_TILE.DIRT_PATH } },
    beach: { roles: { fill: CLASSIC_TILE.DIRT_PATH } },
    paving: { roles: { fill: CLASSIC_TILE.DIRT_PATH } },
    stone: { roles: { fill: CLASSIC_TILE.DIRT_PATH } },
    gravel: { roles: { fill: CLASSIC_TILE.DIRT_PATH } },
    ford: { roles: { fill: CLASSIC_TILE.DIRT_PATH } },
    water: {
      tint: WATER_TINT,
      roles: {
        fill: CLASSIC_TILE.POND_WATER,
        'edge-n': CLASSIC_TILE.POND_BANK_NORTH,
        'edge-s': CLASSIC_TILE.POND_BANK_SOUTH,
        'edge-e': CLASSIC_TILE.POND_BANK_EAST,
        'edge-w': CLASSIC_TILE.POND_BANK_WEST,
        'corner-nw': CLASSIC_TILE.POND_BANK_NORTH_WEST,
        'corner-ne': CLASSIC_TILE.POND_BANK_NORTH_EAST,
        'corner-sw': CLASSIC_TILE.POND_BANK_SOUTH_WEST,
        'corner-se': CLASSIC_TILE.POND_BANK_SOUTH_EAST,
      },
    },
    hedge: {
      overlay: true,
      tint: TREE_TINT,
      roles: { fill: CLASSIC_TILE.TREE_LEAFY },
      fillVariants: [CLASSIC_TILE.TREE_RED],
      variantRarity: 9,
    },
    tree: {
      overlay: true,
      tint: TREE_TINT,
      roles: { fill: CLASSIC_TILE.TREE_LEAFY },
      fillVariants: [CLASSIC_TILE.TREE_RED],
      variantRarity: 9,
    },
    cliff: {
      roles: {
        fill: CLASSIC_TILE.ROCK,
        'edge-w': CLASSIC_TILE.ROCK_LEFT,
        'edge-e': CLASSIC_TILE.ROCK_RIGHT,
        'edge-s': CLASSIC_TILE.ROCK_LOW,
        'run-h': CLASSIC_TILE.ROCK_LOW,
      },
    },
    fence: {
      overlay: true,
      roles: {
        fill: CLASSIC_TILE.FENCE_MIDDLE,
        'run-h': CLASSIC_TILE.FENCE_MIDDLE,
        'edge-n': CLASSIC_TILE.FENCE_MIDDLE,
        'edge-s': CLASSIC_TILE.FENCE_MIDDLE,
        'edge-e': CLASSIC_TILE.FENCE_RIGHT,
        'edge-w': CLASSIC_TILE.FENCE_LEFT,
        'cap-w': CLASSIC_TILE.FENCE_LEFT,
        'cap-e': CLASSIC_TILE.FENCE_RIGHT,
        'run-v': CLASSIC_TILE.FENCE_VERTICAL,
        'cap-n': CLASSIC_TILE.FENCE_VERTICAL_TOP,
        'cap-s': CLASSIC_TILE.FENCE_VERTICAL_BOTTOM,
        'corner-sw': CLASSIC_TILE.FENCE_CORNER_UP_RIGHT,
        'corner-se': CLASSIC_TILE.FENCE_CORNER_UP_LEFT,
        single: CLASSIC_TILE.FENCE_MIDDLE,
      },
    },
    wall: { overlay: true, tint: TREE_TINT, roles: { fill: CLASSIC_TILE.TREE_LEAFY } },
  },
  props: {},
};
