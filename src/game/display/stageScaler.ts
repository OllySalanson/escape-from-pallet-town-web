import { applyMenuStage, menuLayer } from './menuStage';
import { centredStart, computeStage, cssLength, type StageSize } from './stage';

/**
 * Keeps the running game's screen matched to the browser window.
 *
 * Phaser's own FIT mode was what capped the game at 960x720 and then resampled
 * it to whatever was left: the canvas backing store never changed size, so a
 * large display got a small screen and a short one got fractional pixels. The
 * screen is instead resized and re-zoomed here, in whole pixels, whenever the
 * window changes - whole pixels of the screen, not of CSS, which on a display
 * scaled to 125% are not the same thing (`onWholeScreenPixels`).
 */

interface ScalableGame {
  readonly scale: {
    setZoom(zoom: number): unknown;
    resize(width: number, height: number): unknown;
  };
}

export function applyStage(
  game: ScalableGame,
  parent: HTMLElement | null,
  viewportWidth: number,
  viewportHeight: number,
  pixelRatio = 1,
): StageSize {
  const stage = computeStage(viewportWidth, viewportHeight, pixelRatio);
  // In this order: Phaser writes the canvas's CSS size only when told the zoom
  // afterwards. `resize` tells it for itself at any zoom but 1, so a window that
  // stayed at 1x (a phone) kept the canvas at the size it last was and drew the
  // art at a fractional scale.
  game.scale.resize(stage.width, stage.height);
  game.scale.setZoom(stage.zoom);
  if (parent) {
    const width = cssLength(stage.width, stage.zoom, pixelRatio);
    const height = cssLength(stage.height, stage.zoom, pixelRatio);
    parent.style.width = `${width}px`;
    parent.style.height = `${height}px`;
    // Placed, not centred by the page: the room left over is odd as often as it
    // is even, and half of an odd number put the whole screen - canvas and menus
    // alike - on half a pixel, which the browser resolves by blurring all of it.
    parent.style.position = 'absolute';
    parent.style.left = `${centredStart(viewportWidth, width, pixelRatio)}px`;
    parent.style.top = `${centredStart(viewportHeight, height, pixelRatio)}px`;
    // One game pixel, in CSS pixels. Anything the scenes hang off the canvas
    // box - the frame around it, and a driver measuring it - reads the same
    // grid the canvas is scaled to. The DOM screens have a box and a pixel of
    // their own; see `menuStage.ts` for why the two are no longer one.
    parent.style.setProperty('--px', `${stage.zoom}px`);
    // The same number without its unit, for the one thing a length cannot do:
    // scale a sprite of unknown size by exactly the zoom, with no resampling.
    parent.style.setProperty('--zoom', `${stage.zoom}`);
  }
  return stage;
}

/**
 * Applies both stages now and on every window resize - the canvas box and the
 * menu box, which are sized by different rules and laid out independently.
 * Returns a teardown so a hot reload cannot leave a second listener resizing a
 * destroyed game.
 */
export function watchViewport(game: ScalableGame, parentId = 'app'): () => void {
  const parent = () => document.getElementById(parentId);
  const update = () => {
    const ratio = window.devicePixelRatio || 1;
    applyStage(game, parent(), window.innerWidth, window.innerHeight, ratio);
    applyMenuStage(menuLayer(), window.innerWidth, window.innerHeight, ratio);
  };
  // A window dragged onto a display of another pixel ratio is not resized, so
  // the ratio is watched for itself: a query for the ratio it is now, asked
  // again for the new one each time it stops matching.
  let stopWatchingRatio = (): void => undefined;
  const watchRatio = () => {
    const query = window.matchMedia?.(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    if (!query) {
      return;
    }
    const changed = () => {
      stopWatchingRatio();
      update();
      watchRatio();
    };
    query.addEventListener('change', changed);
    stopWatchingRatio = () => query.removeEventListener('change', changed);
  };
  update();
  watchRatio();
  window.addEventListener('resize', update);
  return () => {
    window.removeEventListener('resize', update);
    stopWatchingRatio();
  };
}
