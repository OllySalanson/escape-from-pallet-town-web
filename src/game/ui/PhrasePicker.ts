import type Phaser from 'phaser';
import { GAME_FONT } from './gameFont';
import { LARGE_CURSOR_HEIGHT, drawFramedWindow, drawPopupCursor } from './pixelWindow';
import { FRAME_DEPTH, UI } from './uiPalette';
import { CHIP_FONT_SIZE } from './screenType';
import { CANOPY_BAND } from '../world/depths';

/**
 * The harbour's quick-phrase list (`harbour/harbourPhrases.ts`), opened with
 * the key a raid room's phrase list is on: FireRed's start menu - a framed
 * window in the top right corner with a cursor - in two columns, so a dozen
 * phrases fit the smallest screen. The arrows walk it, SPACE or ENTER says
 * the phrase under the cursor, and the key that opened it or ESC shuts it; a
 * pointer points and clicks. It decides nothing: `BaseScene` says the phrase.
 *
 * The cursor is remembered for the page's life, so the phrase said last is
 * the one under it next time - saying hello twice is two presses.
 */

/** Paper between the frame and the phrases. */
const PAD = FRAME_DEPTH + 2;
const ROW_HEIGHT = 13;
const GUTTER = 9;
const COLUMN_GAP = 6;
const MARGIN = 4;
const ROWS = 6;

let remembered = 0;

export class PhrasePicker {
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly rows: Phaser.GameObjects.Text[];
  /** The drawn cursor. */
  private readonly cursor: Phaser.GameObjects.Graphics;
  private readonly onSay: (index: number) => void;
  private selected: number;
  /** Where the list is drawn, on the screen: ground no caption may take (`BaseScene.containWorldLabels`). */
  public readonly rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

  public constructor(scene: Phaser.Scene, phrases: readonly string[], onSay: (index: number) => void) {
    this.onSay = onSay;
    this.selected = Math.min(remembered, phrases.length - 1);
    const depth = CANOPY_BAND + 0.22;
    const style = { fontFamily: GAME_FONT, fontSize: CHIP_FONT_SIZE, color: UI.ink.css };
    this.frame = scene.add.graphics().setScrollFactor(0).setDepth(depth);
    this.rows = phrases.map((words, index) =>
      scene.add
        .text(0, 0, words, style)
        .setScrollFactor(0)
        .setDepth(depth + 0.0001)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => this.select(index))
        .on(
          'pointerdown',
          (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: { stopPropagation(): void }) => {
            // The press is the list's: in the great hall a press on the floor walks.
            event.stopPropagation();
            this.select(index);
            this.say();
          },
        ),
    );
    this.cursor = scene.add.graphics().setScrollFactor(0).setDepth(depth + 0.00005);
    const columns = Math.ceil(phrases.length / ROWS);
    const columnWidth = GUTTER + Math.max(...this.rows.map((row) => Math.ceil(row.width)));
    // Four more on the right, so the longest phrase has the paper the cursor has on the left.
    const width = PAD * 2 + columns * columnWidth + (columns - 1) * COLUMN_GAP + 4;
    const height = PAD * 2 + Math.min(ROWS, phrases.length) * ROW_HEIGHT;
    const x = scene.scale.width - width - MARGIN;
    const y = MARGIN;
    this.rect = { x, y, width, height };
    drawFramedWindow(this.frame, this.rect);
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
    this.cursor.clear();
    drawPopupCursor(this.cursor, row.x - GUTTER + 2, row.y + Math.floor((ROW_HEIGHT - LARGE_CURSOR_HEIGHT) / 2));
  }
}
