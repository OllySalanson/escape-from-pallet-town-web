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

/** A tile layer as far as the animator cares: the tile it drew at a place. */
export interface AnimatedLayer {
  readonly getTileAt: (x: number, y: number) => { index: number } | null;
  /** The still tile a map's layers hold at each place. */
  readonly still: readonly (readonly number[])[];
}

/** A rectangle of a map, in tiles. */
export interface TileView {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** The shortest time any cell shows one frame: nothing changes any sooner. */
const SHORTEST_FRAME_MS = Math.min(...[...TILE_ANIMATIONS_BY_TILE.values()].map((animation) => animation.frameMs));

/**
 * Moves the ground of a map too big to walk over every frame. The harbour is 64
 * wide and asks every tile it animates each frame; Greystone Vale holds fifty
 * thousand tiles of sea and a player is shown four hundred tiles of anything, so
 * this asks only the tiles in view, and only when a frame has turned over or
 * the view has crossed a tile - a tile out of view catches up as it comes in.
 */
export class TileAnimator {
  private elapsedMs = 0;
  private lastStep = -1;
  private lastView = '';

  private readonly layers: readonly AnimatedLayer[];

  public constructor(layers: readonly AnimatedLayer[]) {
    this.layers = layers;
  }

  public advance(deltaMs: number, view: TileView): void {
    this.elapsedMs += deltaMs;
    const step = Math.floor(this.elapsedMs / SHORTEST_FRAME_MS);
    const key = `${view.x},${view.y},${view.width},${view.height}`;
    if (step === this.lastStep && key === this.lastView) {
      return;
    }
    this.lastStep = step;
    this.lastView = key;
    for (const layer of this.layers) {
      for (let y = view.y; y < view.y + view.height; y += 1) {
        const row = layer.still[y];
        if (!row) continue;
        for (let x = view.x; x < view.x + view.width; x += 1) {
          const still = row[x];
          if (still === undefined || !TILE_ANIMATIONS_BY_TILE.has(still)) continue;
          const tile = layer.getTileAt(x, y);
          const index = animatedTileAt(still, this.elapsedMs);
          if (tile && tile.index !== index) {
            tile.index = index;
          }
        }
      }
    }
  }
}
