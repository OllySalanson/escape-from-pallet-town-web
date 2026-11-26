import type Phaser from 'phaser';
import {
  CURSOR_HEIGHT,
  CURSOR_WIDTH,
  WINDOW_INK_VALUE,
  drawMenuCursor,
  drawPixelWindow,
  toCssColor,
  type PixelWindowRect,
} from './pixelWindow';
import { GAME_FONT } from './gameFont';
import { CHIP_FONT_SIZE, CLOCK_FONT_SIZE } from './screenType';
import { overlaps, type Rect } from './labelPlacement';
import { iconTextureKey, itemIconName } from './icons';
import { UI } from './uiPalette';
import type {
  HunterChipTone,
  HunterChipView,
  PrizeChipView,
  RaidClockTone,
  RaidClockView,
} from '../scenes/raidHud';

/**
 * The chips' paper and line are the menus' own (`uiPalette.ts`): they were the
 * older cream under a near-black line, a third frame beside the dialogue's and
 * the panels' (critic sweep, 25 Nov 2026).
 */
const WINDOW_PAPER = UI.paper.value;
const WINDOW_BORDER = UI.frameLine.value;

/**
 * The in-raid overlays.
 *
 * Chips pinned to the top corners of the screen, each no larger than the
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
  /**
   * A second frame one pixel inside the first, so a chip can say something by
   * shape as well as by colour (playtest 40 #5: the caution clock's yellow was
   * the calm cream in greyscale).
   */
  readonly heavy?: boolean;
}

const CLOCK_STYLES: Readonly<Record<RaidClockTone, ChipStyle>> = {
  calm: { fill: WINDOW_PAPER, ink: WINDOW_INK_VALUE },
  // The last minute is a yellower fill and a frame twice as heavy: the fill
  // alone is the calm clock to anybody who does not see the yellow.
  caution: { fill: 0xf0c454, ink: 0x2a1c00, heavy: true },
  // The alarm states invert: a light box on a dark map is furniture, a dark red
  // box with light type is a warning, and the difference reads at a glance.
  urgent: { fill: 0xb0201c, ink: 0xffe8d8 },
  enraged: { fill: 0x7c0f10, ink: 0xffd8c8 },
};

const HUNTER_STYLES: Readonly<Record<HunterChipTone, ChipStyle>> = {
  'lost-you': { fill: 0x9bc48f, ink: 0x16290f },
  closing: { fill: 0xb0201c, ink: 0xffe8d8 },
  // The radio mast's standing report is furniture, not a warning, so it is the
  // same cream as the clock it sits under until the hunter is actually near.
  intel: { fill: WINDOW_PAPER, ink: WINDOW_INK_VALUE },
};

/**
 * Weather is neither furniture nor a warning: it is a standing fact about the
 * ground, so it is the cream window under a slate ink rather than either of the
 * alarm reds. It is the only chip whose fill is not plain cream, which is what
 * lets it be told from the arrival plate directly under it at a glance.
 */
const WEATHER_STYLE: ChipStyle = { fill: 0xa9c3d6, ink: 0x14232e };

/**
 * The prize chip: the furniture's cream, the find's own icon at its left and a
 * gold edge down that side, because it is the one chip on the screen that is
 * an offer rather than a fact about where you are or what is chasing you. It
 * was a slab of mustard with the find spelled out in it (the captain, 25 Nov
 * 2026: "the big yellow square saying two parts crates"); the picture says what
 * it is before the words do, and the gold still marks it out from every other
 * chip. NO ROOM is the pop-ups' red, on a line of its own.
 */
const PRIZE_EDGE = 0xe8b43c;
const PRIZE_EDGE_WIDTH = 2;
const PRIZE_ICON = 16;
const PRIZE_ICON_GAP = 3;
const PRIZE_ROOM_INK = 0xb0201c;

/**
 * A race (`world/races.ts`): chalk white under a heavy frame, the starter's
 * flag rather than the furniture's cream - for the twenty seconds it is up it
 * is the thing on the screen, and it is told from every other chip by shape
 * as well as by colour.
 */
const RACE_STYLE: ChipStyle = { fill: 0xfbfbf4, ink: 0x101418, heavy: true };

export interface RaidHudState {
  readonly clock: RaidClockView;
  readonly objectiveLines: readonly string[];
  readonly hunter: HunterChipView | null;
  /** The district just walked into, while that is news; null otherwise. */
  readonly place: string | null;
  /** The weather of the district being stood in, for as long as it is true. */
  readonly weather: string | null;
  /** A rare find this raid has laid eyes on and not yet picked up. */
  readonly prize: PrizeChipView | null;
  /** Everybody else in a raid room, while one is held (`friendChipLines`). */
  readonly friend?: readonly string[] | null;
  /** A race under way (`raceChipLines`): the clock, the racer, the line. */
  readonly race?: readonly string[] | null;
}

export class RaidHud {
  private readonly frames: Phaser.GameObjects.Graphics;
  /**
   * What the chips are currently covering, in screen space. Map captions are
   * kept out of it: a caption slid under the raid clock is not a caption.
   */
  private covered: Rect[] = [];
  /** What this render is drawn under, if anything (see `render`). */
  private under: readonly Rect[] = [];
  private readonly clockText: Phaser.GameObjects.Text;
  private readonly objectiveText: Phaser.GameObjects.Text;
  private readonly hunterText: Phaser.GameObjects.Text;
  private readonly placeText: Phaser.GameObjects.Text;
  private readonly weatherText: Phaser.GameObjects.Text;
  private readonly prizeText: Phaser.GameObjects.Text;
  private readonly prizeRoomText: Phaser.GameObjects.Text;
  private readonly prizeIcon: Phaser.GameObjects.Image;
  private readonly friendText: Phaser.GameObjects.Text;
  private readonly raceText: Phaser.GameObjects.Text;

  private readonly scene: Phaser.Scene;

  public constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.frames = scene.add.graphics().setScrollFactor(0).setDepth(HUD_DEPTH);
    this.clockText = this.createText(CLOCK_FONT_SIZE);
    this.objectiveText = this.createText(CHIP_FONT_SIZE);
    this.hunterText = this.createText(CHIP_FONT_SIZE);
    this.placeText = this.createText(CHIP_FONT_SIZE);
    this.weatherText = this.createText(CHIP_FONT_SIZE);
    this.prizeText = this.createText(CHIP_FONT_SIZE);
    this.prizeRoomText = this.createText(CHIP_FONT_SIZE);
    this.prizeIcon = scene.add.image(0, 0, '__MISSING').setOrigin(0, 0).setScrollFactor(0).setDepth(HUD_DEPTH + 1).setVisible(false);
    this.friendText = this.createText(CHIP_FONT_SIZE);
    this.raceText = this.createText(CHIP_FONT_SIZE);
  }

  /** The chips' screen rectangles, for anything that has to avoid them. */
  public get occupied(): readonly Rect[] {
    return this.covered;
  }

  /**
   * @param under A box drawn over the HUD - the world's dialogue box, which is
   * seated at the top whenever the person a line is about is below the player.
   * A chip it would cut through is not drawn at all rather than drawn sticking
   * out either side of it (`▸FIND LO`, `AID 4:55`), and every other chip keeps
   * its own seat, so nothing jumps when the box goes.
   * @param covered How much of the screen's right a side panel is standing over
   * (`ui/sidePanel.ts`). The right column moves over to stay beside it, because
   * the clock and the hunter are what the panel is opened with an eye on.
   */
  public render(state: RaidHudState, timeMs: number, under: Rect | readonly Rect[] | null = null, covered = 0): void {
    const stageWidth = this.scene.scale.width - covered;
    this.frames.clear();
    this.covered = [];
    // A question is two boxes - its own and its answers' - and a chip is only
    // under it where it is under one of them.
    this.under = under === null ? [] : Array.isArray(under) ? under : [under as Rect];

    const objective = this.placeChip(
      this.objectiveText,
      state.objectiveLines,
      { fill: WINDOW_PAPER, ink: WINDOW_INK_VALUE },
      1,
      () => ({ x: EDGE_MARGIN, y: EDGE_MARGIN }),
      true,
    );

    const clockStyle = CLOCK_STYLES[state.clock.tone];
    const clockAlpha = state.clock.pulses
      ? 0.72 + (Math.sin(timeMs / 130) + 1) * 0.14
      : 1;
    const clock = this.placeChip(
      this.clockText,
      [state.clock.label],
      clockStyle,
      clockAlpha,
      (width) => {
        const x = stageWidth - EDGE_MARGIN - width;
        // Beside a panel there may be no room for the two side by side.
        const clear = objective.x + objective.width + CHIP_GAP <= x;
        return { x, y: clear ? EDGE_MARGIN : objective.y + objective.height + CHIP_GAP };
      },
    );

    // The left column is where the raid says where you are going, so it is
    // where it says where you are: the weather under the objective, and the
    // arrival plate under the weather. The weather is the one of the two that
    // stays, so it takes the fixed seat - a plate that pushed it down and let
    // it jump back up three seconds later would be movement in the corner of
    // the eye for no news at all.
    let column = objective;
    // A race is where the player is going for as long as it is on, so it takes
    // the seat under the objective, ahead of everything that merely stays.
    if (state.race) {
      column = this.placeChip(
        this.raceText,
        state.race,
        RACE_STYLE,
        1,
        () => ({ x: EDGE_MARGIN, y: column.y + column.height + CHIP_GAP }),
      );
    } else {
      this.raceText.setVisible(false);
    }
    if (state.weather) {
      column = this.placeChip(
        this.weatherText,
        [state.weather],
        { fill: WEATHER_STYLE.fill, ink: WEATHER_STYLE.ink },
        1,
        () => ({ x: EDGE_MARGIN, y: column.y + column.height + CHIP_GAP }),
      );
    } else {
      this.weatherText.setVisible(false);
    }
    // Who is raiding with you stays as long as the weather does, so it takes
    // the seat under it for the same reason: the plate is the one that comes
    // and goes. It is a fact about the raid rather than an alarm, so it is the
    // furniture's cream, as the plate is.
    if (state.friend) {
      column = this.placeChip(
        this.friendText,
        state.friend,
        { fill: WINDOW_PAPER, ink: WINDOW_INK_VALUE },
        1,
        () => ({ x: EDGE_MARGIN, y: column.y + column.height + CHIP_GAP }),
      );
    } else {
      this.friendText.setVisible(false);
    }
    if (state.place) {
      this.placeChip(
        this.placeText,
        [state.place],
        { fill: WINDOW_PAPER, ink: WINDOW_INK_VALUE },
        1,
        () => ({ x: EDGE_MARGIN, y: column.y + column.height + CHIP_GAP }),
      );
    } else {
      this.placeText.setVisible(false);
    }

    // The right column is the clock and what is running against it: the hunter
    // under the clock, and the prize under the hunter. That is the order the two
    // are read in - what is coming for me, then what I am about to give up - and
    // it puts the offer directly beneath the number it is costing.
    let right = clock;
    if (state.hunter) {
      right = this.placeChip(
        this.hunterText,
        state.hunter.detail ? [state.hunter.label, state.hunter.detail] : [state.hunter.label],
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

    if (state.prize) {
      this.placePrize(state.prize, stageWidth, right.y + right.height + CHIP_GAP);
    } else {
      this.prizeText.setVisible(false);
      this.prizeRoomText.setVisible(false);
      this.prizeIcon.setVisible(false);
    }
  }

  public destroy(): void {
    this.frames.destroy();
    this.clockText.destroy();
    this.objectiveText.destroy();
    this.hunterText.destroy();
    this.placeText.destroy();
    this.weatherText.destroy();
    this.prizeText.destroy();
    this.prizeRoomText.destroy();
    this.prizeIcon.destroy();
    this.friendText.destroy();
    this.raceText.destroy();
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
    // Still measured and seated, so the chip under it in the column keeps its
    // place; only the drawing is withheld.
    if (this.under.some((box) => overlaps(rect, box))) {
      text.setVisible(false);
      return rect;
    }
    this.covered.push(rect);
    drawPixelWindow(this.frames, rect, { fill: style.fill, fillAlpha: alpha, border: WINDOW_BORDER });
    if (style.heavy) {
      this.frames.fillStyle(WINDOW_BORDER, alpha);
      this.frames.fillRect(rect.x + 2, rect.y + 1, rect.width - 4, 1);
      this.frames.fillRect(rect.x + 2, rect.y + rect.height - 2, rect.width - 4, 1);
      this.frames.fillRect(rect.x + 1, rect.y + 2, 1, rect.height - 4);
      this.frames.fillRect(rect.x + rect.width - 2, rect.y + 2, 1, rect.height - 4);
    }
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

  /**
   * The prize chip (`PRIZE_EDGE`): cream, a gold edge, the find's icon, its
   * name and way in ink and, when it would not go in, the room it needs in red
   * under them. Right-aligned under the column it stands in, as every chip there is.
   */
  private placePrize(prize: PrizeChipView, stageWidth: number, top: number): void {
    const iconKey = prize.itemId ? iconTextureKey(itemIconName(prize.itemId)) : null;
    const hasIcon = iconKey !== null && this.scene.textures.exists(iconKey);
    this.prizeText.setVisible(true).setColor(toCssColor(WINDOW_INK_VALUE)).setText([prize.label, prize.detail]);
    this.prizeRoomText.setVisible(prize.room !== undefined).setColor(toCssColor(PRIZE_ROOM_INK)).setText([prize.room ?? '']);
    const lead = PRIZE_EDGE_WIDTH + (hasIcon ? PRIZE_ICON + PRIZE_ICON_GAP : 0);
    const wordsWidth = Math.max(Math.ceil(this.prizeText.width), prize.room ? Math.ceil(this.prizeRoomText.width) : 0);
    const wordsHeight = Math.ceil(this.prizeText.height) + (prize.room ? Math.ceil(this.prizeRoomText.height) : 0);
    const width = TEXT_PADDING_X * 2 + lead + wordsWidth;
    const height = TEXT_PADDING_Y * 2 + Math.max(wordsHeight, hasIcon ? PRIZE_ICON : 0);
    const rect = { x: Math.round(stageWidth - EDGE_MARGIN - width), y: Math.round(top), width, height };
    // Beside a panel the two columns close up, and the prize, as wide as its
    // find's name, landed on the place chip (critic sweep, 25 Nov 2026): it
    // steps down under whatever it would touch, a chip's gap clear of it.
    for (let guard = 0; guard < this.covered.length; guard += 1) {
      const hit = this.covered.find((chip) => overlaps({ ...rect, height: rect.height + CHIP_GAP, y: rect.y - CHIP_GAP }, chip));
      if (!hit) {
        break;
      }
      rect.y = hit.y + hit.height + CHIP_GAP;
    }
    if (this.under.some((box) => overlaps(rect, box))) {
      this.prizeText.setVisible(false);
      this.prizeRoomText.setVisible(false);
      this.prizeIcon.setVisible(false);
      return;
    }
    this.covered.push(rect);
    drawPixelWindow(this.frames, rect, { fill: WINDOW_PAPER, border: WINDOW_BORDER });
    // The gold edge, inside the frame down the left.
    this.frames.fillStyle(PRIZE_EDGE, 1);
    this.frames.fillRect(rect.x + 1, rect.y + 1, PRIZE_EDGE_WIDTH, rect.height - 2);
    const wordsLeft = rect.x + TEXT_PADDING_X + lead;
    if (hasIcon && iconKey) {
      this.prizeIcon
        .setTexture(iconKey)
        .setDisplaySize(PRIZE_ICON, PRIZE_ICON)
        .setPosition(rect.x + TEXT_PADDING_X + PRIZE_EDGE_WIDTH, rect.y + Math.round((height - PRIZE_ICON) / 2))
        .setVisible(true);
    } else {
      this.prizeIcon.setVisible(false);
    }
    this.prizeText.setPosition(wordsLeft, rect.y + TEXT_PADDING_Y);
    this.prizeRoomText.setPosition(wordsLeft, rect.y + TEXT_PADDING_Y + Math.ceil(this.prizeText.height));
  }

  /** Height of one line, so the cursor sits on the first one and not the block. */
  private lineHeight(text: Phaser.GameObjects.Text): number {
    return text.height / Math.max(1, text.getWrappedText(text.text).length);
  }
}
