import Phaser from 'phaser';
import { WINDOW_CREAM, drawPixelWindow } from './pixelWindow';
import { GAME_FONT } from './gameFont';

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
          fontSize: '16px',
          color: '#f8fafc',
          wordWrap: { width: options.width - padding * 2 },
        }),
      );
    });

    // The options sit on the bottom line of the panel, where the dialogue box
    // puts its continue indicator - the place the eye is already looking for
    // "what happens when I press the key".
    const optionsY = options.height - padding - LINE_HEIGHT;
    this.optionTexts = options.options.map((label, index) =>
      scene.add.text(padding + index * OPTION_COLUMN_WIDTH, optionsY, label, {
        fontFamily: GAME_FONT,
        fontSize: '16px',
        color: UNSELECTED_COLOR,
      }),
    );
    this.optionTexts.forEach((text, index) => {
      text
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => this.select(index))
        .on('pointerdown', () => {
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

  /** Moves the highlight; any non-zero step toggles a two-option prompt. */
  public moveSelection(step: number): void {
    const count = this.optionTexts.length;
    if (count === 0) {
      return;
    }
    this.select((this.selectedIndex + step + count) % count);
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
