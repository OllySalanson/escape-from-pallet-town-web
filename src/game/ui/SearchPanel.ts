import type Phaser from 'phaser';
import { WINDOW_CREAM, WINDOW_INK_VALUE, drawPixelWindow, toCssColor, type PixelWindowRect } from './pixelWindow';
import { GAME_FONT } from './gameFont';
import { CHIP_FONT_SIZE } from './screenType';
import { iconTextureKey, itemIconName } from './icons';
import type { SearchRow } from '../world/cacheSearch';

/**
 * The search of a cache, drawn: a window down the right of the screen with
 * the cache's name, one row a piece, and the keys that take them
 * (`world/cacheSearch.ts` decides every word). It is screen furniture like the
 * raid HUD's chips - fixed to the camera, never over the player in the middle
 * of the screen - and it is not a dialogue box: nothing about it stops the
 * world, which is the point of it.
 */
export const SEARCH_PANEL_DEPTH = 98;

const EDGE_MARGIN = 4;
const PADDING_X = 5;
const PADDING_Y = 4;
const ROW_HEIGHT = 16;
const ICON_SIZE = 16;
const ICON_GAP = 3;
const HEADER_GAP = 2;
const FOOTER_GAP = 3;
const MIN_WIDTH = 112;
/** Ink for a piece already in the pack, or one not yet come to light. */
const QUIET_INK = 0x7a7562;

export interface SearchPanelView {
  readonly title: string;
  readonly rows: readonly SearchRow[];
  /** Under the rows: the keys, or why a key was just refused. */
  readonly footer: readonly string[];
}

export class SearchPanel {
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly footer: Phaser.GameObjects.Text;
  private readonly rowTexts: Phaser.GameObjects.Text[] = [];
  private readonly rowIcons: Phaser.GameObjects.Image[] = [];
  private shown: PixelWindowRect | null = null;
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.frame = scene.add.graphics().setScrollFactor(0).setDepth(SEARCH_PANEL_DEPTH);
    this.title = this.text();
    this.footer = this.text();
  }

  /** Where the panel is on screen, for captions to keep clear of; null while it is not up. */
  get occupied(): PixelWindowRect | null {
    return this.shown;
  }

  render(view: SearchPanelView): void {
    const stageWidth = this.scene.scale.width;
    const stageHeight = this.scene.scale.height;
    this.title.setText(view.title).setColor(toCssColor(WINDOW_INK_VALUE));
    this.footer.setText([...view.footer]).setColor(toCssColor(WINDOW_INK_VALUE));
    while (this.rowTexts.length < view.rows.length) {
      this.rowTexts.push(this.text());
      this.rowIcons.push(this.scene.add.image(0, 0, iconTextureKey(itemIconName('potion'))).setOrigin(0, 0).setScrollFactor(0).setDepth(SEARCH_PANEL_DEPTH + 1));
    }
    const rowWords = view.rows.map((row) => (row.key ? `[${row.key}] ${row.text}` : row.text));
    this.rowTexts.forEach((text, index) => {
      const row = view.rows[index];
      text.setVisible(row !== undefined).setText(rowWords[index] ?? '');
      text.setColor(toCssColor(row && (row.status === 'taken' || row.status === 'hidden') ? QUIET_INK : WINDOW_INK_VALUE));
    });

    const rowsWidth = Math.max(0, ...this.rowTexts.slice(0, view.rows.length).map((text) => Math.ceil(text.width))) + ICON_SIZE + ICON_GAP;
    const width = Math.max(
      MIN_WIDTH,
      Math.ceil(this.title.width),
      Math.ceil(this.footer.width),
      rowsWidth,
    ) + PADDING_X * 2;
    const height =
      PADDING_Y * 2 + Math.ceil(this.title.height) + HEADER_GAP + view.rows.length * ROW_HEIGHT + FOOTER_GAP + Math.ceil(this.footer.height);
    const rect = {
      x: stageWidth - EDGE_MARGIN - width,
      y: stageHeight - EDGE_MARGIN - height,
      width,
      height,
    };
    this.shown = rect;
    this.frame.clear().setVisible(true);
    drawPixelWindow(this.frame, rect, { fill: WINDOW_CREAM });
    // A rule under the title, so the cache's name reads as the heading it is.
    const titleBottom = rect.y + PADDING_Y + Math.ceil(this.title.height);
    this.frame.fillStyle(QUIET_INK, 1).fillRect(rect.x + PADDING_X, titleBottom + 1, rect.width - PADDING_X * 2, 1);
    this.title.setVisible(true).setPosition(rect.x + PADDING_X, rect.y + PADDING_Y);
    let y = titleBottom + HEADER_GAP;
    view.rows.forEach((row, index) => {
      const icon = this.rowIcons[index];
      icon.setVisible(row.itemId !== null);
      if (row.itemId !== null) {
        icon.setTexture(iconTextureKey(itemIconName(row.itemId))).setPosition(rect.x + PADDING_X, y).setAlpha(row.status === 'taken' ? 0.4 : 1);
      }
      this.rowTexts[index].setPosition(rect.x + PADDING_X + ICON_SIZE + ICON_GAP, y + Math.round((ROW_HEIGHT - this.rowTexts[index].height) / 2));
      y += ROW_HEIGHT;
    });
    this.rowIcons.slice(view.rows.length).forEach((icon) => icon.setVisible(false));
    this.footer.setVisible(true).setPosition(rect.x + PADDING_X, y + FOOTER_GAP);
  }

  hide(): void {
    this.shown = null;
    this.frame.clear().setVisible(false);
    this.title.setVisible(false);
    this.footer.setVisible(false);
    this.rowTexts.forEach((text) => text.setVisible(false));
    this.rowIcons.forEach((icon) => icon.setVisible(false));
  }

  destroy(): void {
    this.frame.destroy();
    this.title.destroy();
    this.footer.destroy();
    this.rowTexts.forEach((text) => text.destroy());
    this.rowIcons.forEach((icon) => icon.destroy());
  }

  private text(): Phaser.GameObjects.Text {
    return this.scene.add
      .text(0, 0, '', { fontFamily: GAME_FONT, fontSize: CHIP_FONT_SIZE, color: toCssColor(WINDOW_INK_VALUE), lineSpacing: 1 })
      .setScrollFactor(0)
      .setDepth(SEARCH_PANEL_DEPTH + 1)
      .setVisible(false);
  }
}
