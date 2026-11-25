import type Phaser from 'phaser';
import { FRAME_DEPTH, UI } from './uiPalette';

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
 * The pop-up window: FireRed's frame - a dark line with its corners clear, a
 * two-pixel blue rim, and a one-pixel bevel inside it lit on the top and left
 * and shaded on the bottom and right - round the paper. `FRAME_DEPTH` deep on
 * every side. Below a size that can hold all of that it is the plain window.
 */
export function drawFramedWindow(
  graphics: Phaser.GameObjects.Graphics,
  rect: PixelWindowRect,
  fill: number = UI.paper.value,
): void {
  const { x, y, width, height } = rect;
  if (width < FRAME_DEPTH * 2 + 2 || height < FRAME_DEPTH * 2 + 2) {
    drawPixelWindow(graphics, rect, { fill, border: UI.frameLine.value });
    return;
  }
  // The line, corners clear.
  graphics.fillStyle(UI.frameLine.value, 1);
  graphics.fillRect(x + 1, y, width - 2, 1);
  graphics.fillRect(x + 1, y + height - 1, width - 2, 1);
  graphics.fillRect(x, y + 1, 1, height - 2);
  graphics.fillRect(x + width - 1, y + 1, 1, height - 2);
  // The rim, and the corner pixel inside the line that keeps the chamfer round.
  graphics.fillStyle(UI.frameRim.value, 1);
  graphics.fillRect(x + 1, y + 1, width - 2, height - 2);
  // The bevel: lit top and left, shaded bottom and right.
  graphics.fillStyle(UI.frameLight.value, 1);
  graphics.fillRect(x + 3, y + 3, width - 6, 1);
  graphics.fillRect(x + 3, y + 3, 1, height - 6);
  graphics.fillStyle(UI.frameShade.value, 1);
  graphics.fillRect(x + 4, y + height - 4, width - 7, 1);
  graphics.fillRect(x + width - 4, y + 4, 1, height - 7);
  // The paper.
  graphics.fillStyle(fill, 1);
  graphics.fillRect(x + FRAME_DEPTH, y + FRAME_DEPTH, width - FRAME_DEPTH * 2, height - FRAME_DEPTH * 2);
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
 * its lower right as FireRed's has, so it holds its shape on cream paper.
 */
export function drawPopupCursor(graphics: Phaser.GameObjects.Graphics, x: number, y: number): void {
  drawMenuCursor(graphics, x + 1, y + 1, UI.cursorShadow.value, 'large');
  drawMenuCursor(graphics, x, y, UI.cursor.value, 'large');
}
