import Phaser from 'phaser';
import { WINDOW_CREAM, drawPixelWindow } from './pixelWindow';
import { GAME_FONT } from './gameFont';
import { DIALOG_FONT_SIZE } from './screenType';

/**
 * A decision the player has to take before something irreversible happens.
 *
 * It is the dialogue box's own frame, geometry and typeface with options in
 * place of the continue indicator, so a question reads as part of the same
 * conversation rather than as a second kind of panel. Nothing here decides
 * anything: the caller passes the lines, the options and what to do with the
 * answer, so the wording stays in a pure module beside the rule it explains.
 */

export interface ChoicePromptOptions {
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
   * How many options stand in a row; the rest go on rows below, the last row
   * on the panel's bottom line. One row of every option unless it says.
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

/** The overworld dialogue's own colours, so the two panels are one surface. */
const DIALOG_FILL = 0x0e1828;
const DEFAULT_PADDING = 10;
const LINE_HEIGHT = 20;
const OPTION_COLUMN_WIDTH = 150;
const SELECTED_COLOR = '#ffffff';
const UNSELECTED_COLOR = '#94a3b8';

export class ChoicePrompt extends Phaser.GameObjects.Container {
  private readonly optionTexts: Phaser.GameObjects.Text[];
  private readonly onChoose: (index: number) => void;
  private selectedIndex: number;

  public constructor(scene: Phaser.Scene, options: ChoicePromptOptions) {
    super(scene, options.x, options.y);
    const padding = options.padding ?? DEFAULT_PADDING;
    this.onChoose = options.onChoose;
    this.selectedIndex = options.selected ?? 0;
    const clicksFrom = scene.time.now + (options.clickArmingMs ?? 0);

    const frame = scene.add.graphics();
    drawPixelWindow(
      frame,
      { x: 0, y: 0, width: options.width, height: options.height },
      { fill: DIALOG_FILL, border: WINDOW_CREAM },
    );
    this.add(frame);

    options.lines.forEach((line, index) => {
      this.add(
        scene.add.text(padding, padding + index * LINE_HEIGHT, line, {
          fontFamily: GAME_FONT,
          fontSize: DIALOG_FONT_SIZE,
          color: '#f8fafc',
          wordWrap: { width: options.width - padding * 2 },
        }),
      );
    });

    // The options sit on the bottom line of the panel, where the dialogue box
    // puts its continue indicator - the place the eye is already looking for
    // "what happens when I press the key".
    const columns = options.columns ?? options.options.length;
    const rows = Math.ceil(options.options.length / columns);
    const optionsY = options.height - padding - LINE_HEIGHT * rows;
    this.optionTexts = options.options.map((label, index) =>
      scene.add.text(
        padding + (index % columns) * OPTION_COLUMN_WIDTH,
        optionsY + Math.floor(index / columns) * LINE_HEIGHT,
        label,
        {
          fontFamily: GAME_FONT,
          fontSize: DIALOG_FONT_SIZE,
          color: UNSELECTED_COLOR,
        },
      ),
    );
    this.optionTexts.forEach((text, index) => {
      // On the answer itself as well as on the box: a pointer is tested against
      // an object's own scroll factor, so an answer left at the default was only
      // where it is drawn on a screen whose camera had not scrolled.
      text
        .setScrollFactor(0)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => {
          if (scene.time.now >= clicksFrom) {
            this.select(index);
          }
        })
        .on('pointerdown', () => {
          if (scene.time.now < clicksFrom) {
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

  private select(index: number): void {
    this.selectedIndex = index;
    this.render();
  }

  private render(): void {
    this.optionTexts.forEach((text, index) => {
      const selected = index === this.selectedIndex;
      text.setText(`${selected ? '▶ ' : '  '}${text.text.replace(/^[▶ ]{2}/, '')}`);
      text.setColor(selected ? SELECTED_COLOR : UNSELECTED_COLOR);
    });
  }
}
