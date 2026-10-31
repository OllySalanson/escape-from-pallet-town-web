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

/** Whether two boxes share a pixel. */
export function overlaps(a: BubbleBox, b: BubbleBox): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** How far in from a window's ends its tail may be drawn. */
const TAIL_INSET = 2;

/**
 * Where a bubble `width` wide goes, its tail's tip on `tipY` over `centreX`:
 * centred, slid along to stay over the place, and clear of whatever is seated
 * already. Sideways first, as far as keeps the tail on the window and so on
 * the speaker, because a bubble lifted off its speaker's head is a bubble over
 * somebody else's; lifted only when there is no room either side.
 */
export function bubbleSeat(
  centreX: number,
  tipY: number,
  width: number,
  height: number,
  placeWidth: number | null,
  seated: readonly BubbleBox[],
): { readonly x: number; readonly tipY: number } {
  const within = (x: number): number =>
    placeWidth !== null && width <= placeWidth ? Math.min(Math.max(x, 0), placeWidth - width) : x;
  const centred = within(Math.round(centreX - width / 2));
  const fullHeight = height + SPEECH_TAIL;
  let tip = tipY;
  for (let lifts = 0; lifts <= seated.length; lifts += 1) {
    const y = Math.round(tip - SPEECH_TAIL - height + 1);
    const clearAt = (x: number): boolean => !seated.some((other) => overlaps({ x, y, width, height: fullHeight }, other));
    if (clearAt(centred)) {
      return { x: centred, tipY: tip };
    }
    const tail = Math.round(centreX);
    const sideways = seated
      .filter((other) => overlaps({ x: centred, y, width, height: fullHeight }, other))
      .flatMap((other) => [within(other.x - width), within(other.x + other.width)])
      .filter((x) => tail - x >= TAIL_INSET && tail - x <= width - 1 - TAIL_INSET && clearAt(x))
      .sort((a, b) => Math.abs(a - centred) - Math.abs(b - centred) || a - b);
    if (sideways.length > 0) {
      return { x: sideways[0], tipY: tip };
    }
    tip = Math.min(...seated.filter((other) => overlaps({ x: centred, y, width, height: fullHeight }, other)).map((other) => other.y - 1));
  }
  return { x: centred, tipY: tip };
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
   * dark) and clear of whatever is `seated` already (`bubbleSeat`), the tail
   * staying over the speaker. Returns the window, tail and all.
   */
  public place(centreX: number, tipY: number, placeWidth: number | null, seated: readonly BubbleBox[] = []): BubbleBox {
    const width = this.width;
    const height = this.height;
    const seat = bubbleSeat(centreX, tipY, width, height, placeWidth, seated);
    const x = seat.x;
    const y = Math.round(seat.tipY - SPEECH_TAIL - height + 1);
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
    this.tailAt = Math.min(Math.max(tail, TAIL_INSET), width - 1 - TAIL_INSET);
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
