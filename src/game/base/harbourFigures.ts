import type Phaser from 'phaser';
import type { HarbourFigure } from '../harbour/harbourCrowd';
import type { NamedFigure } from '../harbour/harbourLink';
import type { Direction, GridPosition } from '../movement/gridMovement';
import { CHARACTER_FEET_PIXEL_Y, CHARACTER_HEAD_PIXEL_Y, getIdleFrame } from '../playerFrames';
import { lookHeadDrop, lookTexture, lookWalkKey } from '../look/lookTexture';
import { GAME_FONT } from '../ui/gameFont';
import { WINDOW_CREAM, WINDOW_INK, drawPixelWindow } from '../ui/pixelWindow';
import { CHIP_FONT_SIZE } from '../ui/screenType';
import { CAPTION_BAND, FIGURE_BAND, atRow } from '../world/depths';
import { TILE_SIZE } from '../worldMap';
import { FOLLOWER_ART } from './generated/followerArt';
import {
  PARTNER_FEET_PIXEL_Y,
  arrivalPlace,
  directionBetween,
  partnerFrame,
  partnerPose,
  partnerTextureKey,
  sameTile,
  type PartnerSpeciesId,
} from './partner';
import {
  BUBBLE_HEIGHT,
  BUBBLE_WIDTH,
  PARTNER_SPRITE_X_OFFSET,
  PARTNER_SPRITE_Y_OFFSET,
  drawEmoteBubble,
} from './partnerFigure';

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
 *
 * Whoever has a partner walks with it at their heel, as this player does
 * (`partner.ts`): it stands on the tile they last walked off and takes its
 * step onto the one they are leaving in time with theirs, so somebody else's
 * Bulbasaur trails them across the yard exactly as it does on their own
 * screen. Like the player's own partner it is company, never collision, and
 * a caption would sooner sit clear of it but goes over it rather than unseated
 * (`heelRects`).
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

/** How far behind its player on the same row a partner is drawn: a hair, as this player's own is. */
export const HEEL_BEHIND = 0.00005;

/** Where another player's partner is this frame, in tiles, and which way it faces. */
export interface HeelPlace {
  readonly x: number;
  readonly y: number;
  readonly facing: Direction;
  readonly moving: boolean;
}

/**
 * Where the partner at a figure's heel stands this frame, given where it was
 * standing (`rest`): the tile the figure last walked off, or where it arrived
 * beside them. Walking, it steps from there onto the tile the figure is
 * leaving, as far along as they are; standing, it waits there facing them.
 * With nowhere to stand yet it is tucked away out of sight - and the moment
 * they step it comes out onto the tile they left, as this player's own does.
 */
export function heelOf(figure: HarbourFigure<string>, rest: GridPosition | null): HeelPlace | null {
  if (rest === null || sameTile(rest, figure.tile)) {
    return figure.toward ? { ...figure.tile, facing: figure.facing, moving: false } : null;
  }
  const facing = directionBetween(rest, figure.tile) ?? figure.facing;
  if (!figure.toward) {
    return { ...rest, facing, moving: false };
  }
  return {
    x: rest.x + (figure.tile.x - rest.x) * figure.progress,
    y: rest.y + (figure.tile.y - rest.y) * figure.progress,
    facing,
    moving: true,
  };
}

/** The name plate's words: ink, in the chip size, on the game's own cream window. */
const NAME_STYLE = { fontFamily: GAME_FONT, fontSize: CHIP_FONT_SIZE, color: WINDOW_INK } as const;

/** Pixels of cream either side of the name, inside the frame. */
const PLATE_PAD_X = 3;

/** A figure to draw, and whether its plate is carrying something it is saying. */
export type PlateFigure = NamedFigure<string> & { readonly speaking?: boolean };

interface Heel {
  readonly species: PartnerSpeciesId;
  readonly sprite: Phaser.GameObjects.Sprite;
  /** Where it stands while its player does, and the tile of theirs that was worked out for. */
  rest: GridPosition | null;
  restFor: GridPosition | null;
  /** The pose its step started on, alternating step to step. */
  walkPose: 0 | 1;
}

interface Drawn {
  readonly sprite: Phaser.GameObjects.Sprite;
  /** The sheet the figure is drawn from: their look's, or the classic one. */
  texture: string;
  readonly plate: Phaser.GameObjects.Graphics;
  readonly name: Phaser.GameObjects.Text;
  walking: string | null;
  heel: Heel | null;
  /** The hand up over their head while they wave. */
  wave: Phaser.GameObjects.Graphics | null;
}

export class HarbourFigures {
  private readonly scene: Phaser.Scene;
  private readonly drawn = new Map<string, Drawn>();
  private readonly plateDepth: (row: number) => number;
  private readonly canStand: ((tile: GridPosition) => boolean) | null;
  private readonly placeWidth: (() => number) | null;

  /**
   * @param plateDepth Where a name plate is drawn for a figure on this row:
   * beneath the figures, as every caption in the harbour is, unless a place
   * says otherwise - a raid's woods would hide a friend's name under a crown.
   * @param canStand The place's word on where a partner may arrive beside
   * somebody who has just come into view (`arrivalPlace`), as this player's own
   * arrives. Without it a partner waits out of sight for its player's first step.
   * @param placeWidth How wide the place is, in pixels, so a name plate stays
   * over it: a room is framed on the dark, and a plate wider than the tile its
   * owner stands on hung past the wall into the dark beside the stairs.
   */
  public constructor(
    scene: Phaser.Scene,
    plateDepth: (row: number) => number = (row) => atRow(CAPTION_BAND, row),
    canStand: ((tile: GridPosition) => boolean) | null = null,
    placeWidth: (() => number) | null = null,
  ) {
    this.scene = scene;
    this.plateDepth = plateDepth;
    this.canStand = canStand;
    this.placeWidth = placeWidth;
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
   * once either has walked half a tile away - unless the plate is carrying
   * something its figure is saying (`speaking`, a raid room's quick phrase):
   * "AMY: OVER HERE!" names its speaker, and hiding it would lose what was said.
   */
  public update(figures: readonly PlateFigure[], self: { readonly x: number; readonly y: number } | null = null): void {
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
      const texture = lookTexture(this.scene, figure.look ?? null);
      if (drawn.texture !== texture) {
        // A look bought or changed: the figure is redrawn in it, standing.
        drawn.texture = texture;
        drawn.sprite.stop();
        drawn.sprite.setTexture(texture, getIdleFrame(figure.facing));
        drawn.walking = null;
      }
      const walking = figure.toward ? lookWalkKey(texture, figure.facing) : null;
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
      // The partner first: a tall one walking behind its player stands
      // where the plate would go, and the plate is lifted over it.
      this.drawHeel(drawn, figure);
      const plateWidth = plateWidthOf(drawn.name);
      const plateHeight = plateHeightOf(drawn.name);
      const plateX = withinPlace(
        clearOfSelf(Math.round(x + TILE_SIZE / 2 - plateWidth / 2), plateWidth, x, y, self),
        plateWidth,
        this.placeWidth?.() ?? null,
      );
      const plateY = clearOfHeel(
        { x: plateX, y: Math.round(y + headOf(drawn) - plateHeight - 1), width: plateWidth, height: plateHeight },
        heelArt(drawn.heel),
      );
      drawn.plate.setPosition(plateX, plateY).setDepth(this.plateDepth(row));
      drawn.name.setPosition(plateX + PLATE_PAD_X, plateY).setDepth(this.plateDepth(row) + 0.0001);
      const underSelf = self !== null && Math.abs(x - self.x) < TILE_SIZE / 2 && Math.abs(y - self.y) < TILE_SIZE / 2;
      const named = !underSelf || figure.speaking === true;
      drawn.plate.setVisible(named);
      drawn.name.setVisible(named);
      this.drawWave(drawn, figure, x, named ? plateY : y + headOf(drawn) - 1);
    }
  }

  /**
   * Where every other player's partner is drawn, in world pixels: company a
   * caption would rather sit clear of, as it would of this player's own
   * (`CaptionSurroundings.follower`).
   */
  public heelRects(): { x: number; y: number; width: number; height: number }[] {
    return [...this.drawn.values()].flatMap(({ heel }) => {
      const art = heelArt(heel);
      return art ? [{ ...art }] : [];
    });
  }

  /**
   * Where every other player is drawn, figure and name plate together, in
   * world pixels: ground a caption must keep clear of, as it keeps clear of
   * the harbour's own people (`BaseScene.containWorldLabels`) - a building's
   * name seated across another player read as their head on a sign.
   */
  public rects(): { x: number; y: number; width: number; height: number }[] {
    return [...this.drawn.values()].map((drawn) => {
      const { sprite, plate, name, wave } = drawn;
      const head = name.visible ? Math.min(plate.y, sprite.y + headOf(drawn)) : sprite.y + headOf(drawn);
      const top = wave ? Math.min(head, wave.y) : head;
      return { x: sprite.x, y: top, width: TILE_SIZE, height: sprite.y + CHARACTER_FEET_PIXEL_Y + 1 - top };
    });
  }

  /** Every name plate being drawn, in world pixels: a hand going up beside one is lifted clear of it. */
  public plateRects(): { x: number; y: number; width: number; height: number }[] {
    return [...this.drawn.values()]
      .filter(({ name }) => name.visible)
      .map(({ plate, name }) => ({ x: plate.x, y: plate.y, width: plateWidthOf(name), height: plateHeightOf(name) }));
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

  /** A hand up over somebody while they wave, seated over the top of their name plate (or their head). */
  private drawWave(drawn: Drawn, figure: PlateFigure, x: number, over: number): void {
    if (!figure.waving) {
      drawn.wave?.destroy();
      drawn.wave = null;
      return;
    }
    drawn.wave ??= drawEmoteBubble(this.scene, 'wave');
    drawn.wave.setPosition(Math.round(x + TILE_SIZE / 2 - BUBBLE_WIDTH / 2), Math.round(over - BUBBLE_HEIGHT));
  }

  /** The partner at a figure's heel, stood up, moved on, swapped or taken down as the figure says. */
  private drawHeel(drawn: Drawn, figure: PlateFigure): void {
    if (drawn.heel && drawn.heel.species !== figure.partner) {
      drawn.heel.sprite.destroy();
      drawn.heel = null;
    }
    if (!figure.partner) {
      return;
    }
    const heel =
      drawn.heel ??
      (drawn.heel = {
        species: figure.partner,
        sprite: this.scene.add.sprite(0, 0, partnerTextureKey(figure.partner), 0).setOrigin(0, 0),
        rest: null,
        restFor: null,
        walkPose: 0,
      });
    if (figure.behind) {
      if (!heel.restFor || !sameTile(heel.restFor, figure.tile)) {
        // A step taken: the next one starts on the other foot.
        heel.walkPose = heel.walkPose === 0 ? 1 : 0;
      }
      heel.rest = figure.behind;
      heel.restFor = figure.tile;
    } else if (!heel.restFor || !sameTile(heel.restFor, figure.tile)) {
      // Just come into view, or put somewhere new: it arrives beside them.
      const arrived = this.canStand ? arrivalPlace(figure.tile, figure.facing, this.canStand) : null;
      heel.rest = arrived?.out ? arrived.tile : null;
      heel.restFor = figure.tile;
    }
    const at = heelOf(figure, heel.rest);
    heel.sprite.setVisible(at !== null);
    if (!at) {
      return;
    }
    const pose = partnerPose({ moving: at.moving, progress: figure.progress, walkPose: heel.walkPose });
    heel.sprite
      .setFrame(partnerFrame(at.facing, pose))
      .setPosition(at.x * TILE_SIZE + PARTNER_SPRITE_X_OFFSET, at.y * TILE_SIZE + PARTNER_SPRITE_Y_OFFSET)
      // A hair behind its player, who is a hair behind this player's own figures.
      .setDepth(atRow(FIGURE_BAND, at.y) - OTHER_PLAYERS_BEHIND - HEEL_BEHIND);
  }

  private standUp(figure: PlateFigure): Drawn {
    const texture = lookTexture(this.scene, figure.look ?? null);
    const sprite = this.scene.add.sprite(0, 0, texture, getIdleFrame(figure.facing)).setOrigin(0, 0);
    const plate = this.scene.add.graphics();
    const name = this.scene.add.text(0, 0, figure.name, NAME_STYLE);
    const drawn: Drawn = { sprite, texture, plate, name, walking: null, heel: null, wave: null };
    drawPlate(drawn);
    this.drawn.set(figure.id, drawn);
    return drawn;
  }
}

/**
 * Where a name plate goes across, slid clear of this player's own column when
 * its owner stands beside them on the same row. A plate is wider than a tile,
 * so centred over somebody next door it reached over this player's head - and
 * the chevron that marks them is drawn over everything, so it sat on the
 * first letter of the name (playing two players side by side: "OLLY" read
 * "-LLY"). Still over its owner's own head, only no further over this one's.
 */
export function clearOfSelf(
  plateX: number,
  plateWidth: number,
  x: number,
  y: number,
  self: { readonly x: number; readonly y: number } | null,
): number {
  if (self === null || Math.abs(y - self.y) >= TILE_SIZE || Math.abs(x - self.x) < TILE_SIZE / 2) {
    return plateX;
  }
  return x > self.x ? Math.max(plateX, self.x + TILE_SIZE) : Math.min(plateX, self.x - plateWidth);
}

/** A plate's left edge, slid along so the whole plate is over the place, where the place is wide enough for it. */
export function withinPlace(plateX: number, plateWidth: number, placeWidth: number | null): number {
  if (placeWidth === null || plateWidth > placeWidth) {
    return plateX;
  }
  return Math.min(Math.max(plateX, 0), placeWidth - plateWidth);
}

type Box = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

/**
 * Where a name plate goes up and down: over its owner's head, unless the
 * partner at their heel is standing there - walking down the yard, a
 * Blastoise behind its player is drawn over the plate (plates are beneath
 * every figure, `world/depths.ts`) and the name read as nobody's. Then it is
 * lifted to sit on top of the partner instead. Only ever lifted.
 */
export function clearOfHeel(plate: Box, heel: Box | null): number {
  if (
    heel === null ||
    plate.x >= heel.x + heel.width ||
    plate.x + plate.width <= heel.x ||
    plate.y >= heel.y + heel.height ||
    plate.y + plate.height <= heel.y
  ) {
    return plate.y;
  }
  return Math.min(plate.y, heel.y - plate.height);
}

/** The drawn art of a partner at heel, from the top of its head to its feet, while it is shown. */
function heelArt(heel: Heel | null): Box | null {
  if (!heel?.sprite.visible) {
    return null;
  }
  const top = FOLLOWER_ART[heel.species].topPixelY;
  return {
    x: heel.sprite.x - PARTNER_SPRITE_X_OFFSET,
    y: heel.sprite.y + top,
    width: TILE_SIZE,
    height: PARTNER_FEET_PIXEL_Y - top + 1,
  };
}

const plateWidthOf = (name: Phaser.GameObjects.Text): number => Math.ceil(name.width) + PLATE_PAD_X * 2;
const plateHeightOf = (name: Phaser.GameObjects.Text): number => Math.ceil(name.height) + 1;

/** Where a figure's head starts in its frame: the classic one's, or lower for a look's (`look/lookTexture.ts`). */
const headOf = (drawn: Drawn): number => CHARACTER_HEAD_PIXEL_Y + lookHeadDrop(drawn.texture);

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
  drawn.heel?.sprite.destroy();
  drawn.wave?.destroy();
  drawn.sprite.destroy();
  drawn.plate.destroy();
  drawn.name.destroy();
}
