/**
 * How the fixed-resolution game screen is fitted into a browser window.
 *
 * The game is pixel art, so the only two honest knobs are how many logical
 * pixels the screen holds and what whole-number multiple each of them is drawn
 * at. Fractional scaling resamples the art and is never used here.
 *
 * The screen therefore has two sizes rather than one:
 *
 * - `BASE_STAGE_*` is the composition every scene is authored against and the
 *   smallest screen the game will ever present. Nothing may be laid out
 *   assuming more room than this.
 * - `MAX_STAGE_*` is how far the screen is allowed to grow on a large display.
 *   The extra room is world, not magnification: at 400x256 the overworld shows
 *   25x16 tiles instead of 20x15, which is why the raid HUD can sit in the
 *   corners instead of over the road ahead.
 *
 * The growth is deliberately bounded. Maps are 32 tiles wide, so an unbounded
 * screen would eventually show a whole map at once and the hunter - which
 * arrives `HUNTER_SPAWN_DISTANCE` tiles away - would stop being a thing you
 * discover. 25 columns keeps the camera scrolling on every authored map.
 */
export const BASE_STAGE_WIDTH = 320;
export const BASE_STAGE_HEIGHT = 240;
export const MAX_STAGE_WIDTH = 400;
export const MAX_STAGE_HEIGHT = 256;

/**
 * Below 2x the art is too small to read, so a window that cannot fit 2x is
 * given 2x anyway and the canvas is allowed to overflow its parent - a case
 * only reachable in a window smaller than 640x480.
 */
export const MIN_STAGE_ZOOM = 2;
export const MAX_STAGE_ZOOM = 6;

export interface StageSize {
  /** Logical screen width in game pixels. */
  readonly width: number;
  /** Logical screen height in game pixels. */
  readonly height: number;
  /** Whole-number multiple each game pixel is drawn at. */
  readonly zoom: number;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/** Even sizes keep a centred 320x240 composition on whole pixels. */
const toEven = (value: number): number => Math.floor(value / 2) * 2;

/**
 * Picks the largest whole-number zoom the window can hold at the base size,
 * then spends whatever is left over on logical pixels rather than on margin.
 */
export function computeStage(viewportWidth: number, viewportHeight: number): StageSize {
  const usableWidth = Math.max(1, Math.floor(viewportWidth));
  const usableHeight = Math.max(1, Math.floor(viewportHeight));
  const zoom = clamp(
    Math.min(
      Math.floor(usableWidth / BASE_STAGE_WIDTH),
      Math.floor(usableHeight / BASE_STAGE_HEIGHT),
    ),
    MIN_STAGE_ZOOM,
    MAX_STAGE_ZOOM,
  );

  return {
    width: clamp(toEven(usableWidth / zoom), BASE_STAGE_WIDTH, MAX_STAGE_WIDTH),
    height: clamp(toEven(usableHeight / zoom), BASE_STAGE_HEIGHT, MAX_STAGE_HEIGHT),
    zoom,
  };
}

/**
 * The top-left of the authored `BASE_STAGE_WIDTH` x `BASE_STAGE_HEIGHT` box
 * inside a grown screen. Scenes composed at the base size centre themselves
 * with this instead of being re-authored for every window.
 */
export function baseCompositionOffset(stage: StageSize): { readonly x: number; readonly y: number } {
  return {
    x: Math.round((stage.width - BASE_STAGE_WIDTH) / 2),
    y: Math.round((stage.height - BASE_STAGE_HEIGHT) / 2),
  };
}
