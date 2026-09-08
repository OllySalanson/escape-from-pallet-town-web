import type Phaser from 'phaser';

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
export const WINDOW_CREAM = 0xebeac5;
export const WINDOW_INK_VALUE = 0x202020;
export const WINDOW_INK = '#202020';

/** Phaser wants a hex string for text and a number for graphics. */
export const toCssColor = (value: number): string => `#${value.toString(16).padStart(6, '0')}`;

export interface PixelWindowStyle {
  readonly fill: number;
  readonly border?: number;
  readonly fillAlpha?: number;
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
  graphics.fillStyle(style.border ?? WINDOW_BORDER, 1);
  graphics.fillRect(x + 1, y, width - 2, 1);
  graphics.fillRect(x + 1, y + height - 1, width - 2, 1);
  graphics.fillRect(x, y + 1, 1, height - 2);
  graphics.fillRect(x + width - 1, y + 1, 1, height - 2);
}

/**
 * The menu cursor from the games this one is dressed as: a solid right-pointing
 * triangle, drawn rather than typed so it is the same three pixels wide at every
 * zoom and never falls back to whatever arrow a browser font happens to carry.
 */
export const CURSOR_WIDTH = 3;
export const CURSOR_HEIGHT = 5;

export function drawMenuCursor(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  color: number,
): void {
  graphics.fillStyle(color, 1);
  const rows = [1, 2, 3, 2, 1];
  rows.forEach((width, row) => {
    graphics.fillRect(x, y + row, width, 1);
  });
}
