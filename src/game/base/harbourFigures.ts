import type Phaser from 'phaser';
import type { NamedFigure } from '../harbour/harbourLink';
import { CHARACTER_FEET_PIXEL_Y, CHARACTER_HEAD_PIXEL_Y, getIdleFrame, getWalkAnimationKey } from '../playerFrames';
import { GAME_FONT } from '../ui/gameFont';
import { WINDOW_CREAM, WINDOW_INK, drawPixelWindow } from '../ui/pixelWindow';
import { CHIP_FONT_SIZE } from '../ui/screenType';
import { SHARED_CHARACTER_TEXTURE } from '../world/characterPresentation';
import { CAPTION_BAND, FIGURE_BAND, atRow } from '../world/depths';
import { TILE_SIZE } from '../worldMap';

/**
 * Everybody else in THE HARBOUR, drawn: one figure a player, walking where
 * their browser says they walked (`harbour/harbourCrowd.ts`), with the name on
 * their door over their head.
 *
 * They are drawn from the same sheet as the player and in its true colours,
 * because every one of them is a player too; what tells this player which one
 * is them is the ground ring and chevron only they wear. They are not
 * collision - walking into another player is walking past them, as walking into
 * the partner is - because a figure is only ever where a message said, and a
 * message is never believed enough to block a step. Their names are drawn
 * beneath every figure, as every caption in the game is (`world/depths.ts`).
 */

const SPRITE_Y_OFFSET = TILE_SIZE - CHARACTER_FEET_PIXEL_Y;

/** The name plate's words: ink, in the chip size, on the game's own cream window. */
const NAME_STYLE = { fontFamily: GAME_FONT, fontSize: CHIP_FONT_SIZE, color: WINDOW_INK } as const;

/** Pixels of cream either side of the name, inside the frame. */
const PLATE_PAD_X = 3;

interface Drawn {
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly plate: Phaser.GameObjects.Graphics;
  readonly name: Phaser.GameObjects.Text;
  walking: string | null;
}

export class HarbourFigures {
  private readonly scene: Phaser.Scene;
  private readonly drawn = new Map<string, Drawn>();

  public constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Draws this frame's figures: new ones stood up, gone ones taken down, the rest moved. */
  public update(figures: readonly NamedFigure<string>[]): void {
    const here = new Set(figures.map((figure) => figure.id));
    for (const [id, drawn] of this.drawn) {
      if (!here.has(id)) {
        takeDown(drawn);
        this.drawn.delete(id);
      }
    }
    for (const figure of figures) {
      const drawn = this.drawn.get(figure.id) ?? this.standUp(figure);
      const toward = figure.toward ?? figure.tile;
      const x = (figure.tile.x + (toward.x - figure.tile.x) * figure.progress) * TILE_SIZE;
      const row = figure.tile.y + (toward.y - figure.tile.y) * figure.progress;
      const y = row * TILE_SIZE + SPRITE_Y_OFFSET;
      drawn.sprite.setPosition(x, y).setDepth(atRow(FIGURE_BAND, row));
      const walking = figure.toward ? getWalkAnimationKey(figure.facing) : null;
      if (walking !== drawn.walking) {
        drawn.walking = walking;
        if (walking) {
          drawn.sprite.play(walking, true);
        } else {
          drawn.sprite.stop();
          drawn.sprite.setFrame(getIdleFrame(figure.facing));
        }
      } else if (!walking) {
        drawn.sprite.setFrame(getIdleFrame(figure.facing));
      }
      if (drawn.name.text !== figure.name) {
        drawn.name.setText(figure.name);
        drawPlate(drawn);
      }
      const plateWidth = plateWidthOf(drawn.name);
      const plateHeight = plateHeightOf(drawn.name);
      const plateX = Math.round(x + TILE_SIZE / 2 - plateWidth / 2);
      const plateY = Math.round(y + CHARACTER_HEAD_PIXEL_Y - plateHeight - 1);
      drawn.plate.setPosition(plateX, plateY).setDepth(atRow(CAPTION_BAND, row));
      drawn.name.setPosition(plateX + PLATE_PAD_X, plateY).setDepth(atRow(CAPTION_BAND, row) + 0.0001);
    }
  }

  /** How many are on screen, for a playtest to read. */
  public get count(): number {
    return this.drawn.size;
  }

  public destroy(): void {
    for (const drawn of this.drawn.values()) {
      takeDown(drawn);
    }
    this.drawn.clear();
  }

  private standUp(figure: NamedFigure<string>): Drawn {
    const sprite = this.scene.add.sprite(0, 0, SHARED_CHARACTER_TEXTURE, getIdleFrame(figure.facing)).setOrigin(0, 0);
    const plate = this.scene.add.graphics();
    const name = this.scene.add.text(0, 0, figure.name, NAME_STYLE);
    const drawn: Drawn = { sprite, plate, name, walking: null };
    drawPlate(drawn);
    this.drawn.set(figure.id, drawn);
    return drawn;
  }
}

const plateWidthOf = (name: Phaser.GameObjects.Text): number => Math.ceil(name.width) + PLATE_PAD_X * 2;
const plateHeightOf = (name: Phaser.GameObjects.Text): number => Math.ceil(name.height) + 1;

/** The plate behind a name: the game's own one-pixel framed window, sized to the name. */
function drawPlate(drawn: Drawn): void {
  drawn.plate.clear();
  drawPixelWindow(
    drawn.plate,
    { x: 0, y: 0, width: plateWidthOf(drawn.name), height: plateHeightOf(drawn.name) },
    { fill: WINDOW_CREAM },
  );
}

function takeDown(drawn: Drawn): void {
  drawn.sprite.destroy();
  drawn.plate.destroy();
  drawn.name.destroy();
}
