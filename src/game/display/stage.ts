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
 * A window that cannot hold the screen at 2x - in practice a phone, whose pixels
 * are small - gets 1x and the whole of the game. Handed 2x, the canvas was
 * squeezed to the window one axis at a time, which drew every figure thin.
 */
export const MIN_STAGE_ZOOM = 1;
export const MAX_STAGE_ZOOM = 6;

export interface StageSize {
  /** Logical screen width in game pixels. */
  readonly width: number;
  /** Logical screen height in game pixels. */
  readonly height: number;
  /**
   * The multiple each game pixel is drawn at, in CSS pixels: a whole number of
   * the screen's own pixels (`onWholeScreenPixels`), and so a whole number of
   * CSS pixels wherever the pixel ratio is.
   */
  readonly zoom: number;
}

/**
 * A CSS zoom moved onto the screen's own pixels.
 *
 * Every zoom here is picked in CSS pixels, and on most displays a CSS pixel is
 * one screen pixel (or two, on a Mac): a whole CSS zoom is a whole number of
 * screen pixels and the art is crisp. On a Windows laptop at 125% or 150%
 * display scaling - most of the 1080p ones - a CSS pixel is 1.25 or 1.5 screen
 * pixels, so 3x was 3.75 screen pixels a game pixel: some columns three wide and
 * some four, every stroke of every letter a different weight (break-it test,
 * 23 Nov 2026). The browser's zoom (Ctrl +) does the same at any display.
 *
 * Such a zoom is moved to the nearest whole number of screen pixels, up when
 * the screen still `fits` there and down when it does not. A zoom that already
 * is whole on screen - every zoom at a pixel ratio of 1 or 2 - is returned as it
 * is, so those displays are drawn exactly as they always were.
 */
export function onWholeScreenPixels(zoom: number, pixelRatio: number, fits: (zoom: number) => boolean): number {
  if (!Number.isFinite(pixelRatio) || pixelRatio <= 0) {
    return zoom;
  }
  const onScreen = zoom * pixelRatio;
  if (Math.abs(onScreen - Math.round(onScreen)) < 1e-6) {
    return zoom;
  }
  const up = Math.ceil(onScreen) / pixelRatio;
  return fits(up) ? up : Math.max(1, Math.floor(onScreen)) / pixelRatio;
}

/**
 * A length of `count` game pixels at `zoom`, in CSS pixels, landed exactly on
 * the screen's pixel grid: `400 * 3.2` is 1280.0000000000002 in floating point,
 * and a box that size starts its last column a sliver past a screen pixel.
 */
export function cssLength(count: number, zoom: number, pixelRatio = 1): number {
  const ratio = Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1;
  return Math.round(count * zoom * ratio) / ratio;
}

/**
 * Where to start a box of `length` CSS pixels so it is centred in `room` - floored
 * onto a whole screen pixel, never on half of one, which the browser resolves
 * by blurring everything in the box.
 */
export function centredStart(room: number, length: number, pixelRatio = 1): number {
  const ratio = Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1;
  return Math.max(0, Math.floor(((room - length) / 2) * ratio) / ratio);
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/** Even sizes keep a centred 320x240 composition on whole pixels. */
const toEven = (value: number): number => Math.floor(value / 2) * 2;

/**
 * Picks the largest whole-number zoom the window can hold at the base size,
 * moves it onto whole screen pixels for the display's `pixelRatio`, then spends
 * whatever is left over on logical pixels rather than on margin.
 */
export function computeStage(viewportWidth: number, viewportHeight: number, pixelRatio = 1): StageSize {
  const usableWidth = Math.max(1, Math.floor(viewportWidth));
  const usableHeight = Math.max(1, Math.floor(viewportHeight));
  const cssZoom = clamp(
    Math.min(
      Math.floor(usableWidth / BASE_STAGE_WIDTH),
      Math.floor(usableHeight / BASE_STAGE_HEIGHT),
    ),
    MIN_STAGE_ZOOM,
    MAX_STAGE_ZOOM,
  );
  const zoom = onWholeScreenPixels(
    cssZoom,
    pixelRatio,
    (candidate) => BASE_STAGE_WIDTH * candidate <= usableWidth && BASE_STAGE_HEIGHT * candidate <= usableHeight,
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
