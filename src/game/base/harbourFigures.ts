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

/**
 * How far behind this player's own figures on the same row another player is
 * drawn. Everybody arrives on the same spawn with their partner on the same
 * tile at heel, so somebody else standing on this player's partner is common -
 * and drawn level with it, their figure hid the partner whole, which reads as
 * the partner not being there. Behind the partner (a hair behind the player,
 * `partnerFigure.ts`) and the player, and still a row's worth ahead of anybody
 * on the row above, so the y-sort between rows is unchanged.
 */
export const OTHER_PLAYERS_BEHIND = 0.0001;

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
  private readonly plateDepth: (row: number) => number;

  /**
   * @param plateDepth Where a name plate is drawn for a figure on this row:
   * beneath the figures, as every caption in the harbour is, unless a place
   * says otherwise - a raid's woods would hide a friend's name under a crown.
   */
  public constructor(scene: Phaser.Scene, plateDepth: (row: number) => number = (row) => atRow(CAPTION_BAND, row)) {
    this.scene = scene;
    this.plateDepth = plateDepth;
  }

  /**
   * Draws this frame's figures: new ones stood up, gone ones taken down, the rest moved.
   *
   * @param self Where this player's own figure is drawn (its sprite's top-left).
   * Everybody arrives on the same spawn, mat or step, so another player is
   * often on this player's very tile, drawn behind them - and their name plate,
   * over the head they share, read as this player's own name (playtest 48,
   * finding 6: AMY's first sight of the harbour was herself labelled PIP). A
   * plate is not drawn while its figure is under this player's, and comes back
   * once either has walked half a tile away.
   */
  public update(figures: readonly NamedFigure<string>[], self: { readonly x: number; readonly y: number } | null = null): void {
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
      drawn.sprite.setPosition(x, y).setDepth(atRow(FIGURE_BAND, row) - OTHER_PLAYERS_BEHIND);
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
      drawn.plate.setPosition(plateX, plateY).setDepth(this.plateDepth(row));
      drawn.name.setPosition(plateX + PLATE_PAD_X, plateY).setDepth(this.plateDepth(row) + 0.0001);
      const underSelf = self !== null && Math.abs(x - self.x) < TILE_SIZE / 2 && Math.abs(y - self.y) < TILE_SIZE / 2;
      drawn.plate.setVisible(!underSelf);
      drawn.name.setVisible(!underSelf);
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
