import type Phaser from 'phaser';
import { GAME_FONT } from './gameFont';
import { WINDOW_CREAM, WINDOW_INK_VALUE, drawPixelWindow, toCssColor } from './pixelWindow';
import { CHIP_FONT_SIZE, DIALOG_FONT_SIZE } from './screenType';

/**
 * The plate a raid stands under while the window is not in use
 * (`world/windowPause.ts`): the map dimmed, and in the middle of it one cream
 * window saying the raid is paused and what starts it again.
 *
 * It is drawn on the world's own canvas rather than as a menu screen, because
 * it is a word over the raid and not a place to go: the map stays where it
 * was, the clock in its corner reads what it read, and the plate is the same
 * frame and the same face as the chips round it, at the stage's own pixels.
 */

/** Above every chip, caption and the dialogue box: nothing on the map is drawn over it. */
const PLATE_DEPTH = 10_000;
/** How far the map is dimmed: enough to read as stopped, not so much the place is lost. */
const DIM_ALPHA = 0.5;
const PADDING_X = 8;
const PADDING_Y = 5;
/** Between the title and the two lines under it. */
const TITLE_GAP = 3;

/**
 * How far down the screen the plate stands: a third of the way from the edge the
 * player is furthest from. It used to be dead centre, which is where a walking
 * camera keeps the player.
 */
export function pausePlateTop(screenHeight: number, plateHeight: number, playerScreenY: number): number {
  const room = Math.max(0, Math.floor((screenHeight / 2 - plateHeight) / 2));
  return playerScreenY >= screenHeight / 2 ? room : screenHeight - plateHeight - room;
}

export class PausePlate {
  private readonly dim: Phaser.GameObjects.Rectangle;
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly body: Phaser.GameObjects.Text;

  /** @param playerScreenY Where the player stands on the screen: the plate goes in the half they are not in, so they can see where they are before going on. */
  public constructor(scene: Phaser.Scene, title: string, lines: readonly string[], playerScreenY: number = 0) {
    const { width, height } = scene.scale;
    this.dim = scene.add
      .rectangle(0, 0, width, height, 0x000000, DIM_ALPHA)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(PLATE_DEPTH);
    this.frame = scene.add.graphics().setScrollFactor(0).setDepth(PLATE_DEPTH + 1);
    const style = { fontFamily: GAME_FONT, color: toCssColor(WINDOW_INK_VALUE), align: 'center' } as const;
    this.title = scene.add
      .text(0, 0, title, { ...style, fontSize: DIALOG_FONT_SIZE })
      .setScrollFactor(0)
      .setDepth(PLATE_DEPTH + 2);
    this.body = scene.add
      .text(0, 0, [...lines], { ...style, fontSize: CHIP_FONT_SIZE, lineSpacing: 1 })
      .setScrollFactor(0)
      .setDepth(PLATE_DEPTH + 2);

    // Every edge on a whole pixel, the window centred on the screen and each
    // line centred in the window.
    const titleWidth = Math.ceil(this.title.width);
    const bodyWidth = Math.ceil(this.body.width);
    const inner = Math.max(titleWidth, bodyWidth);
    const plateWidth = inner + PADDING_X * 2;
    const plateHeight = Math.ceil(this.title.height) + TITLE_GAP + Math.ceil(this.body.height) + PADDING_Y * 2;
    const x = Math.round((width - plateWidth) / 2);
    const y = pausePlateTop(height, plateHeight, playerScreenY);
    drawPixelWindow(this.frame, { x, y, width: plateWidth, height: plateHeight }, { fill: WINDOW_CREAM });
    this.title.setPosition(x + PADDING_X + Math.floor((inner - titleWidth) / 2), y + PADDING_Y);
    this.body.setPosition(
      x + PADDING_X + Math.floor((inner - bodyWidth) / 2),
      y + PADDING_Y + Math.ceil(this.title.height) + TITLE_GAP,
    );
  }

  public destroy(): void {
    this.dim.destroy();
    this.frame.destroy();
    this.title.destroy();
    this.body.destroy();
  }
}
