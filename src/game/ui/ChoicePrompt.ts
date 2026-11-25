import Phaser from 'phaser';
import { LARGE_CURSOR_HEIGHT, LARGE_CURSOR_WIDTH, drawFramedWindow, drawPopupCursor } from './pixelWindow';
import { GAME_FONT } from './gameFont';
import { DIALOG_FONT_SIZE } from './screenType';
import { FRAME_DEPTH, UI } from './uiPalette';

/**
 * A decision the player has to take before something irreversible happens.
 *
 * FireRed's way of asking: the question stands in the dialogue box's own frame
 * and geometry, and the answers stand in a window of their own on top of the
 * box's right end, one under another, with the cursor beside the one it is on.
 * They used to share the box, on its last line - so a question that wrapped to
 * a second line had YES printed over it ("Will you fetch the parcel from the
 * Old Mill for me?"), and a choice was white beside slate with a typed arrow.
 *
 * Nothing here decides anything: the caller passes the lines, the options and
 * what to do with the answer, so the wording stays in a pure module beside the
 * rule it explains.
 */

export interface ChoicePromptOptions {
  /** The question's box: where the dialogue box stands. The answers stand on top of its right end. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly padding?: number;
  readonly lines: readonly string[];
  readonly options: readonly string[];
  /** Which option starts highlighted. Should be the one that costs nothing. */
  readonly selected?: number;
  /**
   * How many options stand in a row of the answer window; the rest go on rows
   * under them. One column - FireRed's YES/NO - unless it says.
   */
  readonly columns?: number;
  /**
   * How long the answers take no click after they appear. For a question whose
   * YES cannot be taken back: it is drawn under the pointer that clicked the last
   * line away, and the second half of a double-click would answer it.
   */
  readonly clickArmingMs?: number;
  readonly onChoose: (index: number) => void;
}

const DEFAULT_PADDING = 10;
const LINE_HEIGHT = 20;
/** One answer's row: tall enough to be a finger's target at the zoom a phone gets. */
const ANSWER_ROW = 16;
/** Paper either side of the answers, inside the frame. */
const ANSWER_INSET = 4;
/** The cursor's column, left of the words: the cursor, its shadow and two pixels of paper. */
const CURSOR_COLUMN = LARGE_CURSOR_WIDTH + 3;
const ANSWER_COLUMN_GAP = 8;

export class ChoicePrompt extends Phaser.GameObjects.Container {
  private readonly optionTexts: Phaser.GameObjects.Text[];
  private readonly onChoose: (index: number) => void;
  private readonly questionLines: readonly string[];
  private readonly marks: Phaser.GameObjects.Graphics;
  /** Each answer's row in the container's space, so the lit row and the cursor are drawn where it is. */
  private readonly rows: { x: number; y: number; width: number }[];
  private selectedIndex: number;
  private readonly answerBounds: { x: number; y: number; width: number; height: number };
  private readonly boxBounds: { width: number; height: number };

  public constructor(scene: Phaser.Scene, options: ChoicePromptOptions) {
    super(scene, options.x, options.y);
    const padding = options.padding ?? DEFAULT_PADDING;
    this.onChoose = options.onChoose;
    this.questionLines = options.lines;
    this.selectedIndex = options.selected ?? 0;
    this.boxBounds = { width: options.width, height: options.height };
    const clicksFrom = options.clickArmingMs ? scene.time.now + options.clickArmingMs : 0;
    const armed = (): boolean => clicksFrom === 0 || scene.time.now >= clicksFrom;

    const frame = scene.add.graphics();
    drawFramedWindow(frame, { x: 0, y: 0, width: options.width, height: options.height });
    this.add(frame);

    options.lines.forEach((line, index) => {
      this.add(
        scene.add.text(padding, padding + index * LINE_HEIGHT, line, {
          fontFamily: GAME_FONT,
          fontSize: DIALOG_FONT_SIZE,
          color: UI.ink.css,
          wordWrap: { width: options.width - padding * 2 },
        }),
      );
    });

    this.optionTexts = options.options.map((label) =>
      scene.add.text(0, 0, label, { fontFamily: GAME_FONT, fontSize: DIALOG_FONT_SIZE, color: UI.ink.css }),
    );
    // The answer window is as wide as its longest answer, in as many columns as asked.
    const columns = Math.max(1, Math.min(options.columns ?? 1, options.options.length));
    const answerRows = Math.ceil(options.options.length / columns);
    const columnWidth = CURSOR_COLUMN + Math.max(0, ...this.optionTexts.map((text) => Math.ceil(text.width ?? 0))) + 2;
    const innerWidth = columns * columnWidth + (columns - 1) * ANSWER_COLUMN_GAP;
    const windowWidth = Math.min(options.width, innerWidth + (FRAME_DEPTH + ANSWER_INSET) * 2);
    const windowHeight = answerRows * ANSWER_ROW + (FRAME_DEPTH + ANSWER_INSET / 2) * 2;
    const windowX = options.width - windowWidth;
    // One pixel down, so the two windows share one frame line rather than
    // stacking two lines and two rims between their papers.
    const windowY = 1 - windowHeight;
    this.answerBounds = { x: windowX, y: windowY, width: windowWidth, height: windowHeight };
    const answerFrame = scene.add.graphics();
    drawFramedWindow(answerFrame, { x: windowX, y: windowY, width: windowWidth, height: windowHeight });
    this.add(answerFrame);
    this.marks = scene.add.graphics();
    this.add(this.marks);

    const left = windowX + FRAME_DEPTH + ANSWER_INSET / 2;
    const top = windowY + FRAME_DEPTH + ANSWER_INSET / 2;
    const rowWidth = columns === 1 ? windowWidth - (FRAME_DEPTH + ANSWER_INSET / 2) * 2 : columnWidth + ANSWER_INSET;
    this.rows = this.optionTexts.map((_, index) => ({
      x: left + (index % columns) * (columnWidth + ANSWER_COLUMN_GAP),
      y: top + Math.floor(index / columns) * ANSWER_ROW,
      width: rowWidth,
    }));
    this.optionTexts.forEach((text, index) => {
      const row = this.rows[index];
      text.setPosition(row.x + ANSWER_INSET / 2 + CURSOR_COLUMN, row.y + Math.floor((ANSWER_ROW - LINE_HEIGHT) / 2) + 2);
      // The whole row answers a press, not just the letters: a finger is wider
      // than a word. On the answer itself, because a pointer is tested against
      // an object's own scroll factor, and an answer left at the default was only
      // where it is drawn on a screen whose camera had not scrolled.
      const hit = new Phaser.Geom.Rectangle(row.x - text.x, row.y - text.y, row.width, ANSWER_ROW);
      text
        .setScrollFactor(0)
        .setInteractive({ hitArea: hit, hitAreaCallback: (area: Phaser.Geom.Rectangle, x: number, y: number) => Phaser.Geom.Rectangle.Contains(area, x, y), useHandCursor: true })
        .on('pointerover', () => {
          if (armed()) {
            this.select(index);
          }
        })
        .on('pointerdown', () => {
          if (!armed()) {
            return;
          }
          this.select(index);
          this.confirm();
        });
      this.add(text);
    });

    this.setDepth(1000);
    this.setScrollFactor(0, 0, true);
    scene.add.existing(this);
    this.render();
  }

  /**
   * Moves the highlight towards the end the key points at, and stops there:
   * FireRed's YES/NO box does not wrap (`Menu_ProcessInputNoWrap`). Wrapping
   * made a key a toggle, so Right on BACK AWAY - the safe answer, and the side
   * the key points at - flipped the cursor onto the fight it was guarding.
   * Says whether the highlight moved, so a key at the end makes no sound.
   */
  public moveSelection(step: number): boolean {
    const last = this.optionTexts.length - 1;
    const index = Math.max(0, Math.min(last, this.selectedIndex + Math.sign(step)));
    if (last < 0 || index === this.selectedIndex) {
      return false;
    }
    this.select(index);
    return true;
  }

  public confirm(): void {
    this.onChoose(this.selectedIndex);
  }

  public get selected(): number {
    return this.selectedIndex;
  }

  /** What is being asked, as the lines above the answers read: for test mode's `describe()`. */
  public get question(): readonly string[] {
    return this.questionLines;
  }

  /** The answers as the player reads them: for test mode's `describe()`. */
  public get optionLabels(): readonly string[] {
    return this.optionTexts.map((text) => text.text);
  }

  /**
   * Everything the question covers on the screen - its box and the answer
   * window on top of it - for whatever must keep clear of it (a caption).
   */
  public get bounds(): { x: number; y: number; width: number; height: number } {
    const top = this.y + this.answerBounds.y;
    return { x: this.x, y: top, width: this.boxBounds.width, height: this.y + this.boxBounds.height - top };
  }

  /** The answer the cursor is on, as it reads. */
  public get highlighted(): string {
    return this.optionTexts[this.selectedIndex]?.text ?? '';
  }

  private select(index: number): void {
    this.selectedIndex = index;
    this.render();
  }

  /**
   * The cursor stands in its column beside the answer it is on, and that is
   * the whole of the mark: FireRed's YES/NO lights no row and greys no answer,
   * and an answer in soft ink read as one that could not be chosen.
   */
  private render(): void {
    this.marks.clear();
    const row = this.rows[this.selectedIndex];
    if (row) {
      drawPopupCursor(this.marks, row.x + ANSWER_INSET / 2, row.y + Math.floor((ANSWER_ROW - LARGE_CURSOR_HEIGHT) / 2) + 1);
    }
  }
}
