import type Phaser from 'phaser';
import { ballPreviewLines } from '../base/starterTable';
import type { PokemonBase } from '../pokemon';
import { drawPixelWindow, WINDOW_CREAM, WINDOW_INK } from './pixelWindow';
import { GAME_FONT } from './gameFont';
import { CHIP_FONT_SIZE, DIALOG_FONT_SIZE } from './screenType';

const WIDTH = 92;
const PADDING = 6;
const PICTURE = 64;
const SCREEN_MARGIN = 4;
/** Under the dialogue box and the question, over everything in the room. */
const DEPTH = 950;

/**
 * What is in the ball being looked at: FireRed shows the Pokémon's picture in a
 * window beside the question (`showmonpic`), and this is that window with the
 * three lines the old starter card said. Screen furniture, so it holds still in
 * the top-left corner while the room moves under it, and it decides nothing.
 */
export class StarterPreview {
  private readonly container: Phaser.GameObjects.Container;
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly picture: Phaser.GameObjects.Image;
  private readonly name: Phaser.GameObjects.Text;
  private readonly lines: Phaser.GameObjects.Text;
  public shown: PokemonBase | null = null;

  public constructor(scene: Phaser.Scene) {
    this.frame = scene.add.graphics();
    this.picture = scene.add.image(WIDTH / 2, PADDING, '__DEFAULT').setOrigin(0.5, 0);
    this.name = scene.add.text(PADDING, 0, '', { fontFamily: GAME_FONT, fontSize: DIALOG_FONT_SIZE, color: WINDOW_INK });
    this.lines = scene.add.text(PADDING, 0, '', {
      fontFamily: GAME_FONT,
      fontSize: CHIP_FONT_SIZE,
      color: WINDOW_INK,
      wordWrap: { width: WIDTH - PADDING * 2 },
    });
    this.container = scene.add
      .container(SCREEN_MARGIN, SCREEN_MARGIN, [this.frame, this.picture, this.name, this.lines])
      .setDepth(DEPTH)
      .setScrollFactor(0, 0, true)
      .setVisible(false);
  }

  /** Shows this species, or nothing; drawn again only when that changes. */
  public show(species: PokemonBase | null): void {
    if (species === this.shown) {
      return;
    }
    this.shown = species;
    this.container.setVisible(species !== null);
    if (!species) {
      return;
    }
    this.picture.setTexture(`pokemon-front-${species.dexId}`);
    this.name.setText(species.name.toUpperCase()).setY(PADDING + PICTURE);
    const linesTop = this.name.y + Math.ceil(this.name.height);
    this.lines.setText(ballPreviewLines(species).join('\n')).setY(linesTop);
    const height = linesTop + Math.ceil(this.lines.height) + PADDING;
    this.frame.clear();
    drawPixelWindow(this.frame, { x: 0, y: 0, width: WIDTH, height }, { fill: WINDOW_CREAM });
  }

  public destroy(): void {
    this.container.destroy();
  }
}
