import { TILE_ANIMATIONS, TILE_ANIMATION_SHEET } from './generated/tileAnimations';
import { tileReader } from './tileset/catalogue';
import { FRLG_TILESET } from './tileset/frlgTileset';
import { KANTO_SHEET_SOURCE } from './tileset/kantoTileset';

/**
 * FireRed's moving ground: the sea that ripples, the surf that laps a beach,
 * the flowers that sway.
 *
 * FireRed animates its general tileset by swapping 8x8 tiles on a timer
 * (`src/tileset_anims.c`); `scripts/cut-frlg-tile-anims.mjs` renders every
 * cell this game's ground sheets draw that FireRed animates, a frame a column,
 * onto `frlg-tile-anims.png` - frame 0 of each row being the still cell, so a
 * map with nothing animating looks exactly as it did. This is the whole rule
 * for showing it: which tile a still cell is at a moment in time. It knows no
 * Phaser and no scene; a scene asks it once a frame for the tiles it drew.
 *
 * Numbered from 18000, clear of every other sheet the loader fetches
 * (`catalogue.test.ts` holds the whole list apart).
 */
export const TILE_ANIMATION_SOURCE = tileReader(
  {
    textureKey: 'frlgTileAnims',
    imagePath: TILE_ANIMATION_SHEET.imagePath,
    columns: TILE_ANIMATION_SHEET.columns,
    rows: TILE_ANIMATION_SHEET.rows,
  },
  18000,
);

export interface TileAnimation {
  /** The tile index of the still cell, as a map's layers name it. */
  readonly still: number;
  /** The tile index of each frame in turn, the still cell first. */
  readonly frames: readonly number[];
  readonly frameMs: number;
}

const SHEET_FIRST_INDEX = {
  frlg: FRLG_TILESET.sources[0].firstIndex,
  kanto: KANTO_SHEET_SOURCE.source.firstIndex,
} as const;
const SHEET_COLUMNS = {
  frlg: FRLG_TILESET.sources[0].columns,
  kanto: KANTO_SHEET_SOURCE.source.columns,
} as const;

/** Every animated tile, by the still tile index a layer holds. */
export const TILE_ANIMATIONS_BY_TILE: ReadonlyMap<number, TileAnimation> = new Map(
  TILE_ANIMATIONS.map((animation, row) => {
    const still = SHEET_FIRST_INDEX[animation.sheet] + animation.row * SHEET_COLUMNS[animation.sheet] + animation.column;
    return [
      still,
      {
        still,
        frames: Array.from({ length: animation.frames }, (_, frame) => TILE_ANIMATION_SOURCE.at(frame, row)),
        frameMs: animation.frameMs,
      },
    ] as const;
  }),
);

/**
 * The tile to draw for `tile` this long into the animation: the tile itself
 * when it does not move. Every cell shares the one clock, as FireRed's do, so
 * a sea stays one sea.
 */
export function animatedTileAt(tile: number, elapsedMs: number): number {
  const animation = TILE_ANIMATIONS_BY_TILE.get(tile);
  if (!animation) {
    return tile;
  }
  return animation.frames[Math.floor(Math.max(0, elapsedMs) / animation.frameMs) % animation.frames.length];
}
