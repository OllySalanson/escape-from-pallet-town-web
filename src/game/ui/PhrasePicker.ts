import type Phaser from 'phaser';
import { GAME_FONT } from './gameFont';
import { WINDOW_CREAM, WINDOW_INK, drawPixelWindow } from './pixelWindow';
import { CHIP_FONT_SIZE } from './screenType';
import { CANOPY_BAND } from '../world/depths';

/**
 * The harbour's quick-phrase list (`harbour/harbourPhrases.ts`), opened with
 * the key a raid room's phrase list is on: FireRed's start menu - a cream
 * window in the top right corner with a cursor - in two columns, so a dozen
 * phrases fit the smallest screen. The arrows walk it, SPACE or ENTER says
 * the phrase under the cursor, and the key that opened it or ESC shuts it; a
 * pointer points and clicks. It decides nothing: `BaseScene` says the phrase.
 *
 * The cursor is remembered for the page's life, so the phrase said last is
 * the one under it next time - saying hello twice is two presses.
 */

const PAD = 4;
const ROW_HEIGHT = 13;
const CURSOR = '▶';
const GUTTER = 8;
const COLUMN_GAP = 6;
const MARGIN = 4;
const ROWS = 6;

let remembered = 0;

export class PhrasePicker {
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly rows: Phaser.GameObjects.Text[];
  private readonly cursor: Phaser.GameObjects.Text;
  private readonly onSay: (index: number) => void;
  private selected: number;

  public constructor(scene: Phaser.Scene, phrases: readonly string[], onSay: (index: number) => void) {
    this.onSay = onSay;
    this.selected = Math.min(remembered, phrases.length - 1);
    const depth = CANOPY_BAND + 0.22;
    const style = { fontFamily: GAME_FONT, fontSize: CHIP_FONT_SIZE, color: WINDOW_INK };
    this.frame = scene.add.graphics().setScrollFactor(0).setDepth(depth);
    this.rows = phrases.map((words, index) =>
      scene.add
        .text(0, 0, words, style)
        .setScrollFactor(0)
        .setDepth(depth + 0.0001)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => this.select(index))
        .on('pointerdown', () => {
          this.select(index);
          this.say();
        }),
    );
    this.cursor = scene.add.text(0, 0, CURSOR, style).setScrollFactor(0).setDepth(depth + 0.0001);
    const columns = Math.ceil(phrases.length / ROWS);
    const columnWidth = GUTTER + Math.max(...this.rows.map((row) => Math.ceil(row.width)));
    const width = PAD * 2 + columns * columnWidth + (columns - 1) * COLUMN_GAP;
    const height = PAD * 2 + Math.min(ROWS, phrases.length) * ROW_HEIGHT;
    const x = scene.scale.width - width - MARGIN;
    const y = MARGIN;
    drawPixelWindow(this.frame, { x, y, width, height }, { fill: WINDOW_CREAM });
    this.rows.forEach((row, index) =>
      row.setPosition(
        x + PAD + GUTTER + Math.floor(index / ROWS) * (columnWidth + COLUMN_GAP),
        y + PAD + (index % ROWS) * ROW_HEIGHT,
      ),
    );
    this.select(this.selected);
  }

  /** Walks the cursor: up and down a column, left and right across them. Stops at the edges, as FireRed's menus do. */
  public move(direction: 'up' | 'down' | 'left' | 'right'): boolean {
    const last = this.rows.length - 1;
    const row = this.selected % ROWS;
    const next =
      direction === 'up'
        ? row > 0 ? this.selected - 1 : this.selected
        : direction === 'down'
          ? row < ROWS - 1 && this.selected < last ? this.selected + 1 : this.selected
          : direction === 'left'
            ? this.selected - ROWS
            : Math.min(this.selected + ROWS, last);
    if (next < 0 || next === this.selected) {
      return false;
    }
    this.select(next);
    return true;
  }

  public say(): void {
    this.onSay(this.selected);
  }

  public get index(): number {
    return this.selected;
  }

  public destroy(): void {
    this.frame.destroy();
    this.rows.forEach((row) => row.destroy());
    this.cursor.destroy();
  }

  private select(index: number): void {
    this.selected = index;
    remembered = index;
    const row = this.rows[index];
    this.cursor.setPosition(row.x - GUTTER, row.y);
  }
}
