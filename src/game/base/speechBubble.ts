import type Phaser from 'phaser';
import { GAME_FONT } from '../ui/gameFont';
import { WINDOW_BORDER, WINDOW_CREAM, WINDOW_INK, drawPixelWindow } from '../ui/pixelWindow';
import { CHIP_FONT_SIZE } from '../ui/screenType';
import { CANOPY_BAND } from '../world/depths';

/**
 * A quick phrase over whoever said it (`harbour/harbourPhrases.ts`): the name
 * plate's own cream window and type, with the emote bubble's tail pointing
 * down at the speaker, drawn with the emotes over every figure and crown so
 * nobody walking past hides what was said.
 */

/** Pixels of cream either side of the words, inside the frame - the name plate's. */
const PAD_X = 3;

/** How far the tail hangs below the window. */
export const SPEECH_TAIL = 2;

/** The emotes' depth (`partnerFigure.ts`): over every figure, a crown and a name plate. */
const SPEECH_DEPTH = CANOPY_BAND + 0.15;

export interface BubbleBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export class SpeechBubble {
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly text: Phaser.GameObjects.Text;
  private words = '';
  private placed: BubbleBox | null = null;

  public constructor(scene: Phaser.Scene) {
    this.frame = scene.add.graphics().setDepth(SPEECH_DEPTH);
    this.text = scene.add
      .text(0, 0, '', { fontFamily: GAME_FONT, fontSize: CHIP_FONT_SIZE, color: WINDOW_INK })
      .setDepth(SPEECH_DEPTH + 0.0001);
  }

  /** The window's size with these words in it, tail left out. */
  public get width(): number {
    return Math.ceil(this.text.width) + PAD_X * 2;
  }

  public get height(): number {
    return Math.ceil(this.text.height) + 1;
  }

  /** Says these words, redrawing the window only when they change. */
  public say(words: string): this {
    if (words !== this.words) {
      this.words = words;
      this.text.setText(words);
      this.redraw();
    }
    return this;
  }

  /**
   * Seats the bubble with its tail's tip on `tipY`, centred on `centreX` and
   * slid along to stay over a place `placeWidth` wide (a room is framed on the
   * dark), the tail staying over the speaker. Returns the window, tail and all.
   */
  public place(centreX: number, tipY: number, placeWidth: number | null): BubbleBox {
    const width = this.width;
    const height = this.height;
    let x = Math.round(centreX - width / 2);
    if (placeWidth !== null && width <= placeWidth) {
      x = Math.min(Math.max(x, 0), placeWidth - width);
    }
    const y = Math.round(tipY - SPEECH_TAIL - height + 1);
    this.frame.setPosition(x, y);
    this.text.setPosition(x + PAD_X, y);
    // The tail is drawn where the speaker is, wherever the window was slid to.
    const tail = Math.round(centreX) - x;
    if (tail !== this.tailFrom) {
      this.tailFrom = tail;
      this.redraw(tail);
    }
    this.placed = { x, y, width, height: height + SPEECH_TAIL };
    return this.placed;
  }

  /** Where it was last seated, tail and all. */
  public get box(): BubbleBox | null {
    return this.placed;
  }

  public destroy(): void {
    this.frame.destroy();
    this.text.destroy();
  }

  private tailAt = -1;
  /** The tail's place as asked for, before it was kept inside the window. */
  private tailFrom = Number.NaN;

  private redraw(tail = this.tailAt): void {
    const width = this.width;
    const height = this.height;
    this.tailAt = Math.min(Math.max(tail, 2), width - 3);
    const t = this.tailAt;
    const box = (colour: number, x: number, y: number, w: number, h: number): void => {
      this.frame.fillStyle(colour, 1).fillRect(x, y, w, h);
    };
    this.frame.clear();
    drawPixelWindow(this.frame, { x: 0, y: 0, width, height }, { fill: WINDOW_CREAM });
    // The emote bubble's tail (`drawEmoteBubble`), opened into the window.
    box(WINDOW_CREAM, t, height - 1, 1, 1);
    box(WINDOW_BORDER, t - 1, height, 1, 1);
    box(WINDOW_CREAM, t, height, 1, 1);
    box(WINDOW_BORDER, t + 1, height, 1, 1);
    box(WINDOW_BORDER, t, height + 1, 1, 1);
  }
}
