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
    parent.style.width = `${stage.width * stage.zoom}px`;
    parent.style.height = `${stage.height * stage.zoom}px`;
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
