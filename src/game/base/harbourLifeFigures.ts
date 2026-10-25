import type Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import type { Direction, GridPosition } from '../movement/gridMovement';
import { CHARACTER_FEET_PIXEL_Y, getWalkFrames } from '../playerFrames';
import { getSpeciesById } from '../pokemon/species';
import { getWorldCharacterAppearance, worldCharacterIdleFrame } from '../world/characterPresentation';
import { FIGURE_BAND, atRow } from '../world/depths';
import {
  advanceIdleFigures,
  createIdleFigures,
  idleFrames,
  idleHeldTiles,
  type IdleFigure,
} from '../world/npcIdle';
import { TILE_SIZE } from '../worldMap';
import { HARBOUR_POKEMON_ART } from './generated/harbourPokemonArt';
import {
  HARBOUR_LIFE,
  harbourPokemonTextureKey,
  onLand,
  type HarbourFigure,
} from './harbourLife';
import { PARTNER_FEET_PIXEL_Y, partnerFrame } from './partner';

const PLAYER_SPRITE_Y_OFFSET = TILE_SIZE - CHARACTER_FEET_PIXEL_Y;
/** A HeartGold following sprite stands on the tile as the partner does (`partnerFigure.ts`). */
const POKEMON_SPRITE_X_OFFSET = -8;
const POKEMON_SPRITE_Y_OFFSET = PLAYER_SPRITE_Y_OFFSET + CHARACTER_FEET_PIXEL_Y - PARTNER_FEET_PIXEL_Y;
/** How many rows of a swimmer's frame are under the water, and so not drawn. */
const SUNK_ROWS = 7;
/** A following Pokemon steps on the spot between its two poses, as HeartGold's do. */
const POSE_MS = 420;

/**
 * The harbour's townspeople and Pokemon on the screen (`harbourLife.ts` is who
 * they are). It owns their sprites and their beats, and answers the two
 * questions the scene asks: is this tile somebody's, and who is on it.
 */
export class HarbourLifeFigures {
  private figures: IdleFigure[];
  private readonly sprites = new Map<string, Phaser.GameObjects.Sprite>();
  private readonly byId = new Map<string, HarbourFigure>();
  private poseMs = 0;

  private readonly scene: Phaser.Scene;

  public constructor(scene: Phaser.Scene) {
    this.scene = scene;
    for (const figure of HARBOUR_LIFE) {
      this.byId.set(figure.id, figure);
    }
    this.figures = createIdleFigures(
      HARBOUR_LIFE.map((figure) => ({ ...figure, kind: 'npc' as const })),
      Math.random,
    );
    const dexIds: number[] = [];
    for (const figure of HARBOUR_LIFE) {
      this.sprites.set(figure.id, this.createSprite(figure));
      if (figure.kind === 'pokemon') {
        const dexId = getSpeciesById(figure.species)?.dexId;
        if (dexId !== undefined) dexIds.push(dexId);
      }
    }
    // Fetched as they are stood up, so a cry when spoken to is its own.
    void audioManager.loadCries(dexIds);
    this.draw();
  }

  /** Whether somebody is standing on, or still stepping off, this tile. */
  public holds(tile: GridPosition): boolean {
    return this.figures.some((figure) =>
      onLand(this.byId.get(figure.id)!) &&
      idleHeldTiles(figure).some((held) => held.x === tile.x && held.y === tile.y),
    );
  }

  /** Who stands on this tile, for the interact key. */
  public at(tile: GridPosition): HarbourFigure | undefined {
    const found = this.figures.find((figure) => !figure.walk && figure.position.x === tile.x && figure.position.y === tile.y);
    return found ? this.byId.get(found.id) : undefined;
  }

  /**
   * Where every person (`kind: 'person'`) or every Pokemon stands this frame,
   * in tiles, for captions to sit clear of.
   */
  public standing(kind: HarbourFigure['kind']): readonly GridPosition[] {
    return idleFrames(this.figures)
      .filter((frame) => this.byId.get(frame.id)?.kind === kind)
      .map((frame) => ({ x: Math.round(frame.x), y: Math.round(frame.y) }));
  }

  /** Turns somebody to face the way given: spoken to, a person looks back. */
  public face(id: string, facing: Direction): void {
    this.figures = this.figures.map((figure) => (figure.id === id ? { ...figure, facing } : figure));
    this.draw();
  }

  /** Cries, for a Pokemon spoken to. */
  public cry(figure: HarbourFigure): void {
    if (figure.kind !== 'pokemon') return;
    const dexId = getSpeciesById(figure.species)?.dexId;
    if (dexId !== undefined) {
      audioManager.play('cry', { species: dexId });
    }
  }

  /**
   * One frame of beats. `frozen` while anything is on screen to read, and
   * `blocked` is everything else that stands on a tile: the player, the
   * partner, the Day-Care man.
   */
  public update(deltaMs: number, frozen: boolean, blocked: (tile: GridPosition) => boolean): void {
    this.poseMs = (this.poseMs + deltaMs) % (POSE_MS * 2);
    this.figures = advanceIdleFigures(this.figures, {
      deltaMs,
      frozen,
      random: Math.random,
      isTileFree: (tile) => !blocked(tile) && !this.holdsOther(tile),
    });
    this.draw();
  }

  public destroy(): void {
    for (const sprite of this.sprites.values()) sprite.destroy();
    this.sprites.clear();
  }

  /** Whether any figure here, swimmer or not, is on or leaving this tile. */
  private holdsOther(tile: GridPosition): boolean {
    return this.figures.some((figure) => idleHeldTiles(figure).some((held) => held.x === tile.x && held.y === tile.y));
  }

  private createSprite(figure: HarbourFigure): Phaser.GameObjects.Sprite {
    if (figure.kind === 'person') {
      const appearance = getWorldCharacterAppearance('npc', figure.design);
      return this.scene.add
        .sprite(0, 0, appearance.textureKey, worldCharacterIdleFrame(appearance, figure.facing))
        .setOrigin(0, 0);
    }
    const sprite = this.scene.add
      .sprite(0, 0, harbourPokemonTextureKey(figure.species), partnerFrame(figure.facing, 0))
      .setOrigin(0, 0);
    if (figure.swims) {
      // Sunk to the waterline: only what is above the sea is drawn.
      const art = HARBOUR_POKEMON_ART[figure.species];
      sprite.setCrop(0, 0, 32, art.bottomPixelY + 1 - SUNK_ROWS);
    }
    return sprite;
  }

  private draw(): void {
    const pose: 0 | 1 = this.poseMs < POSE_MS ? 0 : 1;
    for (const frame of idleFrames(this.figures)) {
      const figure = this.byId.get(frame.id)!;
      const sprite = this.sprites.get(frame.id);
      if (!sprite) continue;
      if (figure.kind === 'person') {
        const appearance = getWorldCharacterAppearance('npc', figure.design);
        sprite
          .setPosition(Math.round(frame.x * TILE_SIZE), Math.round(frame.y * TILE_SIZE + PLAYER_SPRITE_Y_OFFSET))
          .setDepth(atRow(FIGURE_BAND, frame.y))
          .setFrame(
            frame.striding
              ? getWalkFrames(frame.facing, appearance.sheetColumns)[0]
              : worldCharacterIdleFrame(appearance, frame.facing),
          );
        continue;
      }
      const sunk = figure.swims ? SUNK_ROWS - 2 : 0;
      sprite
        .setPosition(
          Math.round(frame.x * TILE_SIZE + POKEMON_SPRITE_X_OFFSET),
          Math.round(frame.y * TILE_SIZE + POKEMON_SPRITE_Y_OFFSET + sunk),
        )
        .setDepth(atRow(FIGURE_BAND, frame.y) - 0.0001)
        .setFrame(partnerFrame(frame.facing, frame.striding ? 1 : pose));
    }
  }
}
