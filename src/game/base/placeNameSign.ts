import type Phaser from 'phaser';
import { GAME_FONT } from '../ui/gameFont';
import type { Rect } from '../ui/labelPlacement';
import { WINDOW_CREAM, WINDOW_INK, drawPixelWindow } from '../ui/pixelWindow';
import { DIALOG_FONT_SIZE } from '../ui/screenType';
import { CANOPY_BAND } from '../world/depths';

/**
 * FireRed's map-name sign: walk into a town and its name drops in at the top
 * of the screen on a little board, sits there long enough to read, and goes
 * back up. The harbour says each of its parts this way (`harbourPlaces.ts`),
 * and the harbour itself as a player arrives in it.
 *
 * Its timing is a pure function of how long it has been up (`signDrop`), so
 * the rule is tested without Phaser; the class only draws what that says.
 */

/** How long the board takes to drop in, and to go back up. */
export const SIGN_SLIDE_MS = 220;
/** How long it rests where it can be read. */
export const SIGN_HOLD_MS = 2_400;
const SIGN_MARGIN = 4;
const SIGN_PADDING_X = 10;
const SIGN_PADDING_Y = 4;
/** The board's wood, round a cream face: FireRed's sign is a framed plank, not a window. */
const SIGN_WOOD = 0x6b4423;
const SIGN_RULE = 0xc9b78a;

/**
 * How far down the board has come, from 0 (out of sight above the screen) to
 * 1 (resting), `ms` after it was put up; null once it has gone back up.
 */
export function signDrop(ms: number): number | null {
  if (ms < 0) return 0;
  if (ms < SIGN_SLIDE_MS) return ms / SIGN_SLIDE_MS;
  if (ms < SIGN_SLIDE_MS + SIGN_HOLD_MS) return 1;
  const leaving = ms - SIGN_SLIDE_MS - SIGN_HOLD_MS;
  return leaving < SIGN_SLIDE_MS ? 1 - leaving / SIGN_SLIDE_MS : null;
}

export class PlaceNameSign {
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly text: Phaser.GameObjects.Text;
  private upMs: number | null = null;
  private shown: Rect | null = null;

  public constructor(scene: Phaser.Scene) {
    this.frame = scene.add.graphics().setScrollFactor(0).setDepth(CANOPY_BAND + 0.3);
    this.text = scene.add
      .text(0, 0, '', { fontFamily: GAME_FONT, fontSize: DIALOG_FONT_SIZE, color: WINDOW_INK })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(CANOPY_BAND + 0.31)
      .setVisible(false);
  }

  /** Puts a name up, replacing whatever was up. */
  public show(name: string): void {
    this.text.setText(name);
    this.upMs = 0;
    this.draw();
  }

  public update(deltaMs: number): void {
    if (this.upMs === null) return;
    this.upMs += deltaMs;
    this.draw();
  }

  /** Where the board is on the screen, while it is: ground a caption must not take. */
  public rect(): Rect | null {
    return this.shown;
  }

  public destroy(): void {
    this.frame.destroy();
    this.text.destroy();
  }

  private draw(): void {
    this.frame.clear();
    const drop = this.upMs === null ? null : signDrop(this.upMs);
    if (drop === null) {
      this.upMs = null;
      this.shown = null;
      this.text.setVisible(false);
      return;
    }
    const width = Math.ceil(this.text.width) + SIGN_PADDING_X * 2;
    const height = Math.ceil(this.text.height) + SIGN_PADDING_Y * 2;
    const x = SIGN_MARGIN;
    const y = Math.round(SIGN_MARGIN - (height + SIGN_MARGIN) * (1 - drop));
    drawPixelWindow(this.frame, { x, y, width, height }, { fill: WINDOW_CREAM, border: SIGN_WOOD });
    // The plank's inner rule, a pixel in from the wood all round.
    this.frame.lineStyle(1, SIGN_RULE, 1);
    this.frame.strokeRect(x + 2.5, y + 2.5, width - 5, height - 5);
    this.text.setPosition(x + SIGN_PADDING_X, y + SIGN_PADDING_Y).setVisible(true);
    this.shown = { x, y, width, height };
  }
}
