import { computeStage, type StageSize } from './stage';

/**
 * Keeps the running game's screen matched to the browser window.
 *
 * Phaser's own FIT mode was what capped the game at 960x720 and then resampled
 * it to whatever was left: the canvas backing store never changed size, so a
 * large display got a small screen and a short one got fractional pixels. The
 * screen is instead resized and re-zoomed here, in whole pixels, whenever the
 * window changes.
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
): StageSize {
  const stage = computeStage(viewportWidth, viewportHeight);
  game.scale.setZoom(stage.zoom);
  game.scale.resize(stage.width, stage.height);
  if (parent) {
    // The DOM menus are absolutely positioned inside this element, so sizing it
    // to the canvas is what keeps the lobby, the field guide and the result
    // screen lined up with the game screen rather than with the window.
    const width = stage.width * stage.zoom;
    const height = stage.height * stage.zoom;
    parent.style.width = `${width}px`;
    parent.style.height = `${height}px`;
    // Placed, not centred by the page: the room left over is odd as often as it
    // is even, and half of an odd number put the whole screen - canvas and menus
    // alike - on half a pixel, which the browser resolves by blurring all of it.
    parent.style.position = 'absolute';
    parent.style.left = `${Math.max(0, Math.floor((viewportWidth - width) / 2))}px`;
    parent.style.top = `${Math.max(0, Math.floor((viewportHeight - height) / 2))}px`;
    // One game pixel, in CSS pixels. The pixel-ui screens measure everything in
    // it, so a DOM window's border is exactly as thick as a drawn one and every
    // edge lands on the same grid the canvas under it is scaled to.
    parent.style.setProperty('--px', `${stage.zoom}px`);
    // The same number without its unit, for the one thing a length cannot do:
    // scale a sprite of unknown size by exactly the zoom, with no resampling.
    parent.style.setProperty('--zoom', `${stage.zoom}`);
  }
  return stage;
}

/**
 * Applies the stage now and on every window resize. Returns a teardown so a hot
 * reload cannot leave a second listener resizing a destroyed game.
 */
export function watchViewport(game: ScalableGame, parentId = 'app'): () => void {
  const parent = () => document.getElementById(parentId);
  const update = () => applyStage(game, parent(), window.innerWidth, window.innerHeight);
  update();
  window.addEventListener('resize', update);
  return () => window.removeEventListener('resize', update);
}
