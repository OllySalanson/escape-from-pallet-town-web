import type Phaser from 'phaser';
import { UI } from './uiPalette';

/**
 * The game's window frame, drawn rather than stretched.
 *
 * `assets/battle/hud-box.png` is the shape every panel in this game is supposed
 * to be: a one-pixel `#171717` border with its four corner pixels left clear,
 * over a cream fill. It is a 32x32 texture though, so stretching it to a chip a
 * dozen pixels tall smears the border into a band - the same defect that ate the
 * first character of every dialogue line before #64. Drawing the frame keeps it
 * exactly one pixel at any size, at any zoom.
 */

/** Sampled from `assets/battle/hud-box.png`, so drawn frames match painted ones. */
export const WINDOW_BORDER = 0x171717;
/** A chip's or a label's paper: the menus' white (the round-3 look: no cream). */
export const WINDOW_PAPER = 0xffffff;
export const WINDOW_INK_VALUE = 0x202020;
export const WINDOW_INK = '#202020';

/** Phaser wants a hex string for text and a number for graphics. */
export const toCssColor = (value: number): string => `#${value.toString(16).padStart(6, '0')}`;

export interface PixelWindowStyle {
  readonly fill: number;
  readonly border?: number;
  readonly fillAlpha?: number;
  /** The frame line's own opacity: a chip seen through (`RaidHud`) fades its line with its paper. */
  readonly borderAlpha?: number;
}

export interface PixelWindowRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export function drawPixelWindow(
  graphics: Phaser.GameObjects.Graphics,
  rect: PixelWindowRect,
  style: PixelWindowStyle,
): void {
  const { x, y, width, height } = rect;
  if (width < 3 || height < 3) {
    return;
  }

  graphics.fillStyle(style.fill, style.fillAlpha ?? 1);
  graphics.fillRect(x + 1, y + 1, width - 2, height - 2);

  // Four edges rather than a stroked rectangle, so the corner pixels stay clear
  // and the frame reads as a chamfered window instead of a hard box.
  graphics.fillStyle(style.border ?? WINDOW_BORDER, style.borderAlpha ?? 1);
  graphics.fillRect(x + 1, y, width - 2, 1);
  graphics.fillRect(x + 1, y + height - 1, width - 2, 1);
  graphics.fillRect(x, y + 1, 1, height - 2);
  graphics.fillRect(x + width - 1, y + 1, 1, height - 2);
}

/**
 * The pop-up window in the menus' look: a line of ink with its corners clear
 * round white paper, as every menu card is drawn. `FRAME_DEPTH` is still the
 * inset every pop-up's words keep from its edge, so the words stand where they
 * stood when the frame was a four-pixel blue rim.
 */
export function drawFramedWindow(
  graphics: Phaser.GameObjects.Graphics,
  rect: PixelWindowRect,
  fill: number = UI.paper.value,
): void {
  drawPixelWindow(graphics, rect, { fill, border: UI.frameLine.value });
}

/**
 * The menu cursor from the games this one is dressed as: a solid right-pointing
 * triangle, drawn rather than typed so it is the same three pixels wide at every
 * zoom and never falls back to whatever arrow a browser font happens to carry.
 */
export const CURSOR_WIDTH = 3;
export const CURSOR_HEIGHT = 5;
/** The pop-ups' cursor: the same triangle, a size up, so it reads beside dialogue-sized words. */
export const LARGE_CURSOR_WIDTH = 4;
export const LARGE_CURSOR_HEIGHT = 7;

export function drawMenuCursor(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  color: number,
  size: 'small' | 'large' = 'small',
): void {
  graphics.fillStyle(color, 1);
  const rows = size === 'large' ? [1, 2, 3, 4, 3, 2, 1] : [1, 2, 3, 2, 1];
  rows.forEach((width, row) => {
    graphics.fillRect(x, y + row, width, 1);
  });
}

/**
 * The pop-ups' cursor: the large triangle in red, with a one-pixel shadow down
 * its lower-right edge and under its tip, as FireRed's has, so it holds its
 * shape on cream paper. The whole triangle offset made a ragged stair.
 */
export function drawPopupCursor(graphics: Phaser.GameObjects.Graphics, x: number, y: number): void {
  drawMenuCursor(graphics, x, y, UI.cursor.value, 'large');
  graphics.fillStyle(UI.cursorShadow.value, 1);
  // Rows 3 to 6 are 4, 3, 2 and 1 wide: the pixel after each is the edge.
  [4, 3, 2, 1].forEach((width, step) => graphics.fillRect(x + width, y + 3 + step, 1, 1));
  graphics.fillRect(x, y + LARGE_CURSOR_HEIGHT, 1, 1);
}
