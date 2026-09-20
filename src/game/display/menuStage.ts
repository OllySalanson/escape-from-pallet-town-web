/**
 * How the DOM screens are fitted into a browser window.
 *
 * The world view is small on purpose - that is the look - but the menus used to
 * be pinned to the same box: `#app` was sized to the canvas, the screens were
 * absolutely positioned inside it and measured themselves in `--px`, so a stash
 * on a 4K display got exactly the room a stash gets on a laptop, only magnified.
 * A list that did not fit became a scroll wheel in a small window, whatever the
 * display was capable of. The menus are therefore laid out here, against the
 * window, and the canvas keeps `display/stage.ts` to itself.
 *
 * A menu screen has the same two sizes the game screen does - how many game
 * pixels it holds and the whole-number multiple each is drawn at - and the same
 * rule: fractional scaling resamples the art and is never used. What differs is
 * which of the two the extra room is spent on.
 *
 * - **Room comes first.** The scale steps up only once the window could show a
 *   *generous* screen - `MENU_STEP_*`, well over the authored size - at the next
 *   multiple, and never past `MAX_MENU_SCALE`. The canvas takes the largest zoom
 *   that fits its own small composition, which is why a 4K display used to draw
 *   the stash at 6x with exactly the rows a laptop gets; here the same display
 *   spends the difference on rows and steps the type up once.
 * - `MENU_MAX_WIDTH` is how many game pixels a screen may hold across, so the
 *   measure of a row is the same handful of words at every scale - what grows
 *   with the scale is how big those words are drawn, not how far apart they are.
 * - `MENU_INSET` keeps the backdrop showing all round, so a screen still reads
 *   as a screen with a frame rather than as a web page filling the browser.
 * - Height is deliberately uncapped. Rows are what a taller window buys, and a
 *   screen that stopped growing at some height would go back to hiding them.
 */
export const MENU_MIN_WIDTH = 320;
export const MENU_MIN_HEIGHT = 240;
export const MENU_MAX_WIDTH = 720;

/**
 * The screen a window must be able to hold at the next scale up before it is
 * drawn at that scale. Deliberately far larger than the authored minimum: the
 * step is what decides whether a big display buys rows or magnification, and
 * rows are what the screens were short of.
 */
export const MENU_STEP_WIDTH = 560;
export const MENU_STEP_HEIGHT = 360;

/** CSS pixels of window kept clear on every side, for the frame and its margin. */
export const MENU_INSET = 8;

/** Below 2x the face is unreadable, exactly as it is on the canvas. */
export const MIN_MENU_SCALE = 2;
/** Above 4x a menu is magnified rather than roomier - see the note above. */
export const MAX_MENU_SCALE = 4;

export interface MenuStage {
  /** Logical screen width in game pixels. */
  readonly width: number;
  /** Logical screen height in game pixels. */
  readonly height: number;
  /** Whole-number multiple each game pixel is drawn at. */
  readonly scale: number;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/** Even sizes keep a centred composition on whole pixels. */
const toEven = (value: number): number => Math.floor(value / 2) * 2;

/**
 * Picks the menu's pixel scale and how many game pixels it then holds.
 *
 * The scale is the largest whole multiple the window could show a generous
 * `MENU_STEP_WIDTH` x `MENU_STEP_HEIGHT` screen at, clamped into the readable
 * band; everything the window has left over becomes logical pixels.
 */
export function computeMenuStage(viewportWidth: number, viewportHeight: number): MenuStage {
  const usableWidth = Math.max(1, Math.floor(viewportWidth) - MENU_INSET * 2);
  const usableHeight = Math.max(1, Math.floor(viewportHeight) - MENU_INSET * 2);
  const scale = clamp(
    Math.min(
      Math.floor(usableWidth / MENU_STEP_WIDTH),
      Math.floor(usableHeight / MENU_STEP_HEIGHT),
    ),
    MIN_MENU_SCALE,
    MAX_MENU_SCALE,
  );

  return {
    width: clamp(toEven(usableWidth / scale), MENU_MIN_WIDTH, MENU_MAX_WIDTH),
    height: Math.max(MENU_MIN_HEIGHT, toEven(usableHeight / scale)),
    scale,
  };
}

/**
 * Sizes and places the layer the DOM screens live in, on whole pixels.
 *
 * Nothing here touches the canvas or the element it sits in: the two boxes are
 * independent, which is the whole point of the split. A screen still measures
 * everything in `--px` - it is the same pixel-ui stylesheet - so the only thing
 * that changed for a screen is how much of it there is.
 */
export function applyMenuStage(
  layer: HTMLElement | null,
  viewportWidth: number,
  viewportHeight: number,
): MenuStage {
  const stage = computeMenuStage(viewportWidth, viewportHeight);
  if (layer) {
    const width = stage.width * stage.scale;
    const height = stage.height * stage.scale;
    layer.style.width = `${width}px`;
    layer.style.height = `${height}px`;
    layer.style.position = 'fixed';
    // Floored, never centred by the page: the room left over is odd as often as
    // it is even, and half of an odd number stands every one-pixel border on a
    // half pixel, which the browser resolves by blurring all of it.
    layer.style.left = `${Math.max(0, Math.floor((viewportWidth - width) / 2))}px`;
    layer.style.top = `${Math.max(0, Math.floor((viewportHeight - height) / 2))}px`;
    // One game pixel, in CSS pixels: `--u` on a pixel-ui screen, and the unit
    // every border, gap and glyph on it is a whole multiple of.
    layer.style.setProperty('--px', `${stage.scale}px`);
    // The same number without its unit, for the one thing a length cannot do:
    // scale a sprite of unknown size by exactly the scale, with no resampling.
    layer.style.setProperty('--zoom', `${stage.scale}`);
  }
  return stage;
}

/** The id of the element every DOM screen is appended to. */
export const MENU_LAYER_ID = 'screens';

/**
 * The menu layer, created on first use. It is a sibling of `#app` rather than a
 * child of it so that it is not bounded by the canvas box - a child could not
 * escape one, `container-type` on `#app` making it the containing block even for
 * a fixed position.
 */
export function menuLayer(host: Document = document): HTMLElement {
  const existing = host.getElementById(MENU_LAYER_ID);
  if (existing) {
    return existing;
  }
  const layer = host.createElement('div');
  layer.id = MENU_LAYER_ID;
  host.body.append(layer);
  return layer;
}
