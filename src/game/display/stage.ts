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
 *
 * A window that can only hold 1x - a phone - is zoomed in the screen's own
 * pixels instead (`phonePixelZoom`), because there one CSS pixel is 2.625 or 3
 * of them: 1x drew every game pixel two device pixels wide and the next three,
 * and smaller than the screen could have held it.
 */
export function computeStage(viewportWidth: number, viewportHeight: number, devicePixelRatio = 1): StageSize {
  const usableWidth = Math.max(1, Math.floor(viewportWidth));
  const usableHeight = Math.max(1, Math.floor(viewportHeight));
  const devicePixels = phonePixelZoom(
    viewportWidth,
    viewportHeight,
    devicePixelRatio,
    BASE_STAGE_WIDTH,
    BASE_STAGE_HEIGHT,
    2,
  );
  if (devicePixels !== undefined) {
    return {
      width: clamp(toEven(devicePixels.deviceWidth / devicePixels.devicePerPixel), BASE_STAGE_WIDTH, MAX_STAGE_WIDTH),
      height: clamp(toEven(devicePixels.deviceHeight / devicePixels.devicePerPixel), BASE_STAGE_HEIGHT, MAX_STAGE_HEIGHT),
      zoom: devicePixels.zoom,
    };
  }
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

/** A zoom in device pixels: how many of the screen's own pixels one game pixel takes, and that in CSS pixels. */
export interface DevicePixelZoom {
  /** Whole device pixels per game pixel. */
  readonly devicePerPixel: number;
  /** The same in CSS pixels: `devicePerPixel / devicePixelRatio`, rarely a whole number. */
  readonly zoom: number;
  /** The room in device pixels. */
  readonly deviceWidth: number;
  readonly deviceHeight: number;
}

/**
 * The zoom for a high-density screen too small for `cssZoomFloor` CSS pixels a
 * game pixel: the most whole *device* pixels a game pixel can take while the
 * smallest screen (`minWidth` x `minHeight`) still fits. Undefined where CSS
 * pixels already serve - a desktop, a screen of ratio 1, a window that holds
 * the floor - or where whole device pixels would draw smaller than one CSS
 * pixel does, which is the old 1x and the larger of the two.
 */
export function phonePixelZoom(
  viewportWidth: number,
  viewportHeight: number,
  devicePixelRatio: number,
  minWidth: number,
  minHeight: number,
  cssZoomFloor: number,
): DevicePixelZoom | undefined {
  const ratio = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  if (ratio <= 1 || (viewportWidth >= minWidth * cssZoomFloor && viewportHeight >= minHeight * cssZoomFloor)) {
    return undefined;
  }
  const deviceWidth = Math.floor(viewportWidth * ratio);
  const deviceHeight = Math.floor(viewportHeight * ratio);
  const devicePerPixel = Math.min(Math.floor(deviceWidth / minWidth), Math.floor(deviceHeight / minHeight));
  if (devicePerPixel < ratio) {
    return undefined;
  }
  return { devicePerPixel, zoom: devicePerPixel / ratio, deviceWidth, deviceHeight };
}

/** A CSS length that falls on a whole device pixel, at or before `cssPixels`. */
export function onDevicePixel(cssPixels: number, devicePixelRatio = 1): number {
  const ratio = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.floor(cssPixels * ratio) / ratio;
}
