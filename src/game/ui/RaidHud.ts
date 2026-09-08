import type Phaser from 'phaser';
import {
  CURSOR_HEIGHT,
  CURSOR_WIDTH,
  WINDOW_CREAM,
  WINDOW_INK_VALUE,
  drawMenuCursor,
  drawPixelWindow,
  toCssColor,
  type PixelWindowRect,
} from './pixelWindow';
import { GAME_FONT } from './gameFont';
import { CHIP_FONT_SIZE, CLOCK_FONT_SIZE } from './screenType';
import type { Rect } from './labelPlacement';
import type { HunterChipTone, HunterChipView, RaidClockTone, RaidClockView } from '../scenes/raidHud';

/**
 * The in-raid overlays.
 *
 * Three chips pinned to the top corners of the screen, each no larger than the
 * words in it. The overworld in the games this one is dressed as had no
 * permanent HUD at all, so the design rule here is that the map wins: the raid
 * clock and the objective earn a corner each because they are load-bearing, and
 * everything else appears only while it is true.
 */

const EDGE_MARGIN = 4;
const CHIP_GAP = 3;
const TEXT_PADDING_X = 4;
const TEXT_PADDING_Y = 3;
const CURSOR_GAP = 3;
const HUD_DEPTH = 100;

interface ChipStyle {
  readonly fill: number;
  readonly ink: number;
}

const CLOCK_STYLES: Readonly<Record<RaidClockTone, ChipStyle>> = {
  calm: { fill: WINDOW_CREAM, ink: WINDOW_INK_VALUE },
  caution: { fill: 0xf0c454, ink: 0x2a1c00 },
  // The alarm states invert: a light box on a dark map is furniture, a dark red
  // box with light type is a warning, and the difference reads at a glance.
  urgent: { fill: 0xb0201c, ink: 0xffe8d8 },
  enraged: { fill: 0x7c0f10, ink: 0xffd8c8 },
};

const HUNTER_STYLES: Readonly<Record<HunterChipTone, ChipStyle>> = {
  'off-trail': { fill: 0x9bc48f, ink: 0x16290f },
  closing: { fill: 0xb0201c, ink: 0xffe8d8 },
};

export interface RaidHudState {
  readonly clock: RaidClockView;
  readonly objectiveLines: readonly string[];
  readonly hunter: HunterChipView | null;
}

export class RaidHud {
  private readonly frames: Phaser.GameObjects.Graphics;
  /**
   * What the chips are currently covering, in screen space. Map captions are
   * kept out of it: a caption slid under the raid clock is not a caption.
   */
  private covered: Rect[] = [];
  private readonly clockText: Phaser.GameObjects.Text;
  private readonly objectiveText: Phaser.GameObjects.Text;
  private readonly hunterText: Phaser.GameObjects.Text;

  private readonly scene: Phaser.Scene;

  public constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.frames = scene.add.graphics().setScrollFactor(0).setDepth(HUD_DEPTH);
    this.clockText = this.createText(CLOCK_FONT_SIZE);
    this.objectiveText = this.createText(CHIP_FONT_SIZE);
    this.hunterText = this.createText(CHIP_FONT_SIZE);
  }

  /** The chips' screen rectangles, for anything that has to avoid them. */
  public get occupied(): readonly Rect[] {
    return this.covered;
  }

  public render(state: RaidHudState, timeMs: number): void {
    const stageWidth = this.scene.scale.width;
    this.frames.clear();
    this.covered = [];

    const clockStyle = CLOCK_STYLES[state.clock.tone];
    const clockAlpha = state.clock.pulses
      ? 0.72 + (Math.sin(timeMs / 130) + 1) * 0.14
      : 1;
    const clock = this.placeChip(
      this.clockText,
      [state.clock.label],
      clockStyle,
      clockAlpha,
      (width) => ({ x: stageWidth - EDGE_MARGIN - width, y: EDGE_MARGIN }),
    );

    this.placeChip(
      this.objectiveText,
      state.objectiveLines,
      { fill: WINDOW_CREAM, ink: WINDOW_INK_VALUE },
      1,
      () => ({ x: EDGE_MARGIN, y: EDGE_MARGIN }),
      true,
    );

    if (state.hunter) {
      this.placeChip(
        this.hunterText,
        [state.hunter.label],
        HUNTER_STYLES[state.hunter.tone],
        1,
        (width) => ({
          x: stageWidth - EDGE_MARGIN - width,
          y: clock.y + clock.height + CHIP_GAP,
        }),
      );
    } else {
      this.hunterText.setVisible(false);
    }
  }

  public destroy(): void {
    this.frames.destroy();
    this.clockText.destroy();
    this.objectiveText.destroy();
    this.hunterText.destroy();
  }

  private createText(fontSize: string): Phaser.GameObjects.Text {
    return this.scene.add
      .text(0, 0, '', {
        fontFamily: GAME_FONT,
        fontSize,
        color: toCssColor(WINDOW_INK_VALUE),
        lineSpacing: 1,
      })
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH + 1);
  }

  /**
   * Sizes a chip to its own words, then anchors it. Nothing here has a fixed
   * width: a chip that reserved room for its longest possible label would be
   * covering map for a string it is not showing.
   */
  private placeChip(
    text: Phaser.GameObjects.Text,
    lines: readonly string[],
    style: ChipStyle,
    alpha: number,
    anchor: (width: number, height: number) => { readonly x: number; readonly y: number },
    withCursor = false,
  ): PixelWindowRect {
    text.setVisible(true).setColor(toCssColor(style.ink)).setText([...lines]);
    const cursorInset = withCursor ? CURSOR_WIDTH + CURSOR_GAP : 0;
    const width = Math.ceil(text.width) + TEXT_PADDING_X * 2 + cursorInset;
    const height = Math.ceil(text.height) + TEXT_PADDING_Y * 2;
    const { x, y } = anchor(width, height);
    const rect = { x: Math.round(x), y: Math.round(y), width, height };
    this.covered.push(rect);
    drawPixelWindow(this.frames, rect, { fill: style.fill, fillAlpha: alpha });
    if (withCursor) {
      drawMenuCursor(
        this.frames,
        rect.x + TEXT_PADDING_X,
        rect.y + TEXT_PADDING_Y + Math.round((this.lineHeight(text) - CURSOR_HEIGHT) / 2),
        style.ink,
      );
    }
    text
      .setPosition(rect.x + TEXT_PADDING_X + cursorInset, rect.y + TEXT_PADDING_Y)
      .setAlpha(alpha);
    return rect;
  }

  /** Height of one line, so the cursor sits on the first one and not the block. */
  private lineHeight(text: Phaser.GameObjects.Text): number {
    return text.height / Math.max(1, text.getWrappedText(text.text).length);
  }
}
