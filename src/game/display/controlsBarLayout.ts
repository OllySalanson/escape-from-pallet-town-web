import { BASE_STAGE_HEIGHT, computeStage, phonePixelZoom, BASE_STAGE_WIDTH } from './stage';

/**
 * Where the controls bar stands (`ui/controlsBar.ts`): the keys, the team and
 * SETTINGS and HELP, drawn in the page beside the game rather than over it.
 *
 * It never costs the game a zoom step - a game drawn a size smaller to make
 * room for a row of buttons is worse at everything - so it goes where the
 * window has room left over at the zoom the game would have anyway:
 *
 * - **below** the game, when the window is tall enough to take the bar and
 *   still draw the game at its zoom (the game gives up rows of its own height,
 *   never below the 240 it is composed for);
 * - **beside** it, on the left, when it is not but the window is wide enough
 *   to leave a column the bar's tiles fit;
 * - nowhere, when neither: a phone, which has the touch pad, or a window cut
 *   to the game's own size, which is what the test-mode drivers use.
 *
 * Its own pixel is a step smaller than the game's (`unit`), as the menus' is
 * their own (`menuStage.ts`), so it reads as the page's and not as part of the
 * picture - and beside the game, as large as the column allows, but never
 * under two CSS pixels, where its words would be too small to read.
 */

/** The bar laid along the bottom: its height, in its own pixels. */
export const BAR_HEIGHT = 36;
/** The bar stood up on the left: its width, in its own pixels. */
export const BAR_COLUMN_WIDTH = 72;
/** What the column needs to stand every tile one under another, in its own pixels. */
export const BAR_COLUMN_MIN_HEIGHT = 330;
/** Room kept between the bar and the window's edge or the game, in CSS pixels. */
export const BAR_MARGIN = 8;

/** Where the bar stood up on the left starts, for a game whose left edge is at `canvasX`: clear of the game by `BAR_MARGIN`. */
export function barColumnLeft(canvasX: number, unit: number): number {
  return Math.max(BAR_MARGIN, canvasX - BAR_MARGIN - BAR_COLUMN_WIDTH * unit);
}

export interface BarPlacement {
  readonly side: 'below' | 'left';
  /** One of the bar's pixels, in CSS pixels. */
  readonly unit: number;
  /**
   * The window height the game and the menus are laid out in. Below, it is the
   * window less the bar; beside, the whole window.
   */
  readonly gameViewportHeight: number;
}

/** The bar's own pixel for a game drawn at `zoom`: a step smaller, and never less than one. */
export function barUnit(zoom: number): number {
  return Math.max(1, zoom - 1);
}

export function controlsBarPlacement(viewportWidth: number, viewportHeight: number, devicePixelRatio = 1): BarPlacement | null {
  // A phone is zoomed in its own pixels and played on the touch pad.
  if (phonePixelZoom(viewportWidth, viewportHeight, devicePixelRatio, BASE_STAGE_WIDTH, BASE_STAGE_HEIGHT, 2) !== undefined) {
    return null;
  }
  const whole = computeStage(viewportWidth, viewportHeight, devicePixelRatio);
  if (whole.zoom < 2) {
    return null;
  }
  const unit = barUnit(whole.zoom);
  const below = Math.floor(viewportHeight) - BAR_HEIGHT * unit - BAR_MARGIN;
  if (below >= BASE_STAGE_HEIGHT * whole.zoom && computeStage(viewportWidth, below, devicePixelRatio).zoom === whole.zoom) {
    return { side: 'below', unit, gameViewportHeight: below };
  }
  const beside = (Math.floor(viewportWidth) - whole.width * whole.zoom) / 2 - BAR_MARGIN * 2;
  const columnUnit = Math.min(unit, Math.floor(beside / BAR_COLUMN_WIDTH), Math.floor(Math.floor(viewportHeight) / BAR_COLUMN_MIN_HEIGHT));
  if (columnUnit >= 2) {
    return { side: 'left', unit: columnUnit, gameViewportHeight: Math.floor(viewportHeight) };
  }
  return null;
}
