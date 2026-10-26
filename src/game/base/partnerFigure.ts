import type Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import type { GridPosition } from '../movement/gridMovement';
import { STEP_DURATION_MS } from '../movement/stepClock';
import { CHARACTER_FEET_PIXEL_Y, CHARACTER_HEAD_PIXEL_Y } from '../playerFrames';
import type { Pokemon } from '../pokemon/Pokemon';
import { PLAYER_MARKER_DEPTH } from '../world/characterPresentation';
import { CANOPY_BAND, FIGURE_BAND, atRow } from '../world/depths';
import type { Rect } from '../ui/labelPlacement';
import { TILE_SIZE } from '../worldMap';
import { FOLLOWER_ART } from './generated/followerArt';
import {
  EMOTE_ART,
  EMOTE_BUBBLE_CREAM,
  EMOTE_BUBBLE_INK,
  EMOTE_INKS,
  EMOTE_MS,
  HOP_MS,
  IDLE_BEAT_MIN_MS,
  IDLE_BEAT_SPREAD_MS,
  LOOK_AT_PLAYER_AFTER_MS,
  PARTNER_FEET_PIXEL_Y,
  facingTowards,
  followStep,
  hopLift,
  idleBeat,
  partnerFrame,
  partnerPose,
  partnerTextureKey,
  sameTile,
  type PartnerEmote,
  type PartnerPlace,
  type PartnerSpeciesId,
} from './partner';

/**
 * The partner on screen: one Pokemon walking at the player's heel, drawn from
 * its HeartGold following sprite, with everything its frame needs to remember.
 *
 * Every rule it obeys is `partner.ts` - where it steps, where it arrives, its
 * pose, its idle beats, its bubble's art - and this is only the drawing of
 * them, shared by the two scenes it walks in: the harbour (`BaseScene`) and a
 * raid (`WorldScene`). Each scene owns the player, and hands the figure a
 * `PartnerHost` to read them through, so neither scene's walking has to be
 * shaped like the other's.
 */

/** The partner fades in over this long when it arrives, and stands still for the first part of it. */
export const PARTNER_APPEAR_MS = 220;
export const PARTNER_APPEAR_DELAY_MS = 90;
/** How faint the partner goes while a caption is seated under it, so the writing reads through it. */
export const PARTNER_VEILED_ALPHA = 0.35;
/** Left of the partner's frame relative to its tile: a 32-pixel frame centred on a 16-pixel tile. */
export const PARTNER_SPRITE_X_OFFSET = -8;
/** Top of the player's frame relative to its tile, as both scenes draw the player. */
const PLAYER_SPRITE_Y_OFFSET = TILE_SIZE - CHARACTER_FEET_PIXEL_Y;
/** Top of the partner's frame relative to its tile, so its feet land where the player's soles do. */
export const PARTNER_SPRITE_Y_OFFSET = PLAYER_SPRITE_Y_OFFSET + CHARACTER_FEET_PIXEL_Y - PARTNER_FEET_PIXEL_Y;
const FIGURE_HEIGHT = CHARACTER_FEET_PIXEL_Y - CHARACTER_HEAD_PIXEL_Y + 1;
/** The bubble's drawn size, tail and all. */
export const BUBBLE_WIDTH = 11;
export const BUBBLE_HEIGHT = 15;

/**
 * A bubble with `emote` in it, drawn at the world's origin over everything but
 * the canopy's own bubble band: the raid's spotted mark, to the pixel - an ink
 * rim, a cream inside, a tail. Its owner moves it over the head it belongs to.
 */
export function drawEmoteBubble(scene: Phaser.Scene, emote: PartnerEmote): Phaser.GameObjects.Graphics {
  const bubble = scene.add.graphics();
  const box = (colour: number, x: number, y: number, width: number, height: number): void => {
    bubble.fillStyle(colour, 1).fillRect(x, y, width, height);
  };
  box(EMOTE_BUBBLE_INK, 0, 0, 11, 13);
  box(EMOTE_BUBBLE_CREAM, 1, 1, 9, 11);
  box(EMOTE_BUBBLE_INK, 4, 13, 3, 1);
  box(EMOTE_BUBBLE_CREAM, 5, 13, 1, 1);
  box(EMOTE_BUBBLE_INK, 5, 14, 1, 1);
  EMOTE_ART[emote].forEach((row, y) =>
    [...row].forEach((ink, x) => {
      if (ink !== '.') {
        box(EMOTE_INKS[ink], 1 + x, 1 + y, 1, 1);
      }
    }),
  );
  return bubble.setDepth(CANOPY_BAND + 0.15);
}

/** What the partner reads off the scene it walks in. */
export interface PartnerHost {
  /** The tile the player stands on, or is stepping from. */
  playerTile(): GridPosition;
  /** Whether the player is part-way through a step. */
  playerStepping(): boolean;
  /** How far through that step, 0 to 1 - the partner's own step keeps time with it. */
  stepProgress(): number;
  readonly player: Phaser.GameObjects.Sprite;
  /** The mark over the player's head, which goes behind the partner while it walks right behind them. */
  readonly playerHeadMark: Phaser.GameObjects.Graphics;
  /** Whether a line is being read: the bubble waits, and so do the idle beats. */
  reading(): boolean;
  /** Whether the player is standing about, so the partner may too - turning, glancing, hopping. */
  standingAbout(): boolean;
  /** Whether the idle beats are held this frame, for something being looked at closely. */
  quiet(): boolean;
}

/** The Pokemon the figure is of, and the walking art it is drawn with. */
export interface PartnerIdentity {
  readonly pokemon: Pokemon;
  readonly species: PartnerSpeciesId;
}

export class PartnerFigure {
  public readonly pokemon: Pokemon;
  public readonly species: PartnerSpeciesId;
  /** Its name as the game writes one, in capitals. */
  public readonly name: string;
  private readonly sprite: Phaser.GameObjects.Sprite;
  private placeValue: PartnerPlace;
  /** The step it is taking alongside the player's, timed by the player's own. */
  private step: { readonly from: GridPosition; readonly to: GridPosition } | null = null;
  /** Going after the player into their own tile - through a door, over a ledge, out of somebody's way. */
  private tuck: { readonly from: Point; readonly to: GridPosition; elapsedMs: number } | null = null;
  private walkPose: 0 | 1 = 0;
  /** How long the player has been standing still. */
  private stillMs = 0;
  private nextBeatMs: number;
  /** Time left looking away from the player. */
  private glanceMs = 0;
  private hopMs: number | null = null;
  /** Time since it began to come into view, or null once it is in view. */
  private appearMs: number | null;
  private bubble: Phaser.GameObjects.Graphics | null = null;
  private bubbleMs = 0;
  /** The bubble it greets the player with once it is in view. */
  private greeting: PartnerEmote | null;
  private veiled = false;
  private readonly scene: Phaser.Scene;
  private readonly host: PartnerHost;

  public constructor(
    scene: Phaser.Scene,
    host: PartnerHost,
    who: PartnerIdentity,
    place: PartnerPlace,
    options: { readonly greeting?: PartnerEmote | null; readonly fadeIn?: boolean } = {},
  ) {
    this.scene = scene;
    this.host = host;
    this.pokemon = who.pokemon;
    this.species = who.species;
    this.name = who.pokemon.name.toUpperCase();
    this.placeValue = place;
    this.greeting = options.greeting ?? null;
    this.appearMs = place.out && options.fadeIn !== false ? 0 : null;
    this.nextBeatMs = nextBeatDelay();
    this.sprite = scene.add
      .sprite(0, 0, partnerTextureKey(who.species), partnerFrame(place.facing, 0))
      .setOrigin(0, 0)
      .setAlpha(this.appearMs === null ? 1 : 0)
      .setVisible(place.out);
    this.draw();
  }

  public get place(): PartnerPlace {
    return this.placeValue;
  }

  /** Whether it is out, settled and standing on `tile` - not tucked away, not on its way in. */
  public standsOn(tile: GridPosition): boolean {
    return this.placeValue.out && this.tuck === null && sameTile(this.placeValue.tile, tile);
  }

  /** The tile it stands on while it is out and settled, for a tap towards it to turn the player. */
  public standingTile(): GridPosition | null {
    return this.placeValue.out && this.tuck === null ? this.placeValue.tile : null;
  }

  /** Whether it is going after the player into their tile. */
  public get tucking(): boolean {
    return this.tuck !== null;
  }

  /** The player has begun a step: the partner takes its own, onto the tile they are leaving. */
  public follow(from: GridPosition, to: GridPosition): void {
    if (this.tuck) {
      return;
    }
    const { move, place } = followStep(this.placeValue, from, to);
    this.placeValue = place;
    this.stillMs = 0;
    this.glanceMs = 0;
    this.nextBeatMs = nextBeatDelay();
    if (move.kind === 'step') {
      this.step = { from: move.from, to: move.to };
      this.walkPose = this.walkPose === 0 ? 1 : 0;
      return;
    }
    // Out from where it was tucked away, onto the tile the player has left.
    this.step = null;
    this.appearMs = 0;
    this.sprite.setVisible(true).setAlpha(0);
    audioManager.play('partnerAppear');
  }

  /** The player's step is over: so is the partner's. */
  public arrived(): void {
    this.step = null;
  }

  /**
   * After the player into the tile they are standing on, fading as it goes,
   * and tucked away there once it arrives - to come out again onto the first
   * tile they leave. A door, a ledge, and somebody stepping onto its tile all
   * go this way.
   */
  public tuckIn(): void {
    const player = this.host.playerTile();
    if (!this.placeValue.out || this.tuck || sameTile(this.placeValue.tile, player)) {
      this.hideAt(player);
      return;
    }
    const from = this.position();
    const facing = facingTowards(this.placeValue.tile, player) ?? this.placeValue.facing;
    this.step = null;
    this.appearMs = null;
    this.placeValue = { ...this.placeValue, facing };
    this.tuck = { from, to: { ...player }, elapsedMs: 0 };
    this.walkPose = this.walkPose === 0 ? 1 : 0;
  }

  /**
   * Stands it somewhere at once - beside a player who has just come through a
   * door, say - with no walk between. Coming out from nowhere, it fades in.
   */
  public standAt(place: PartnerPlace): void {
    this.step = null;
    this.tuck = null;
    this.hopMs = null;
    this.stillMs = 0;
    this.placeValue = place;
    this.appearMs = place.out ? 0 : null;
    this.sprite.setVisible(place.out).setAlpha(0);
    this.draw();
  }

  /** Turns it to look at the player, and keeps it looking. */
  public lookAtPlayer(): void {
    this.placeValue = {
      ...this.placeValue,
      facing: facingTowards(this.placeValue.tile, this.host.playerTile()) ?? this.placeValue.facing,
    };
    this.glanceMs = 0;
    this.stillMs = LOOK_AT_PLAYER_AFTER_MS;
  }

  /** A little hop, and the chirp that goes with it. */
  public hop(): void {
    this.hopMs = 0;
    audioManager.play('partnerHappy');
  }

  /** Whether a caption is seated under it: it goes faint so the writing reads through it. */
  public setVeiled(veiled: boolean): void {
    this.veiled = veiled;
  }

  public showBubble(emote: PartnerEmote): void {
    this.bubble?.destroy();
    this.bubble = drawEmoteBubble(this.scene, emote);
    this.bubbleMs = 0;
    // Seated now rather than on its next frame, so the captions seated this
    // frame keep clear of where it is rather than of the world's corner.
    this.draw();
  }

  /**
   * Its bubble as drawn, for the captions to keep clear of: a caption seated
   * across it hides the bubble or the writing, and a line the partner is
   * saying is what the player is looking at. Null while it says nothing.
   */
  public bubbleRect(): Rect | null {
    return this.bubble
      ? { x: this.bubble.x, y: this.bubble.y, width: BUBBLE_WIDTH, height: BUBBLE_HEIGHT }
      : null;
  }

  /**
   * The partner's own frame: its walk, the little things it does while the
   * player stands about, its bubble, and where it is drawn.
   */
  public update(deltaMs: number): void {
    const reading = this.host.reading();
    if (this.tuck) {
      this.tuck.elapsedMs += deltaMs;
      if (this.tuck.elapsedMs >= STEP_DURATION_MS) {
        this.hideAt(this.tuck.to);
      }
    }
    if (this.appearMs !== null) {
      this.appearMs += deltaMs;
      if (this.appearMs >= PARTNER_APPEAR_MS + PARTNER_APPEAR_DELAY_MS) {
        this.appearMs = null;
        if (this.greeting) {
          if (this.greeting === 'heart' || this.greeting === 'happy') {
            this.hop();
          }
          this.showBubble(this.greeting);
          this.greeting = null;
        }
      }
    }
    if (this.hopMs !== null) {
      this.hopMs += deltaMs;
      if (this.hopMs >= HOP_MS) {
        this.hopMs = null;
      }
    }
    if (this.bubble && !reading) {
      this.bubbleMs += deltaMs;
      if (this.bubbleMs >= EMOTE_MS) {
        this.dropBubble();
      }
    }
    const standing = this.step === null && this.tuck === null && this.host.standingAbout();
    if (standing && this.placeValue.out) {
      this.standAbout(deltaMs, reading);
    }
    this.draw();
  }

  /** Its figure on a tile, for the captions to keep clear of. */
  public rect(tile: GridPosition = this.placeValue.tile): Rect {
    const top = FOLLOWER_ART[this.species].topPixelY;
    return {
      x: tile.x * TILE_SIZE,
      y: tile.y * TILE_SIZE + PARTNER_SPRITE_Y_OFFSET + top,
      width: TILE_SIZE,
      height: PARTNER_FEET_PIXEL_Y - top + 1,
    };
  }

  /** Whether it is on screen: out, or on its way into the player's tile. */
  public get shown(): boolean {
    return this.placeValue.out || this.tuck !== null;
  }

  /** Whether it is still coming into view. */
  public get appearing(): boolean {
    return this.appearMs !== null;
  }

  public destroy(): void {
    this.dropBubble();
    this.sprite.destroy();
    this.host.playerHeadMark.setDepth(PLAYER_MARKER_DEPTH);
  }

  private hideAt(tile: GridPosition): void {
    this.tuck = null;
    this.step = null;
    this.appearMs = null;
    this.hopMs = null;
    this.dropBubble();
    this.placeValue = { ...this.placeValue, tile: { ...tile }, out: false };
    this.sprite.setVisible(false);
  }

  private dropBubble(): void {
    this.bubble?.destroy();
    this.bubble = null;
  }

  /** Standing still: turning to look at the player, glancing about, hopping. */
  private standAbout(deltaMs: number, reading: boolean): void {
    const lookingAtPlayer = facingTowards(this.placeValue.tile, this.host.playerTile());
    this.stillMs += deltaMs;
    if (this.glanceMs > 0) {
      this.glanceMs -= deltaMs;
      if (this.glanceMs <= 0 && lookingAtPlayer) {
        this.placeValue = { ...this.placeValue, facing: lookingAtPlayer };
      }
      return;
    }
    if (this.stillMs >= LOOK_AT_PLAYER_AFTER_MS && lookingAtPlayer && this.placeValue.facing !== lookingAtPlayer) {
      this.placeValue = { ...this.placeValue, facing: lookingAtPlayer };
    }
    if (reading || this.host.quiet()) {
      return;
    }
    this.nextBeatMs -= deltaMs;
    if (this.nextBeatMs > 0) {
      return;
    }
    this.nextBeatMs = nextBeatDelay();
    const beat = idleBeat(Math.random(), this.pokemon);
    if (beat === 'glance') {
      const away = (['up', 'down', 'left', 'right'] as const).filter(
        (direction) => direction !== this.placeValue.facing,
      );
      this.placeValue = { ...this.placeValue, facing: away[Math.floor(Math.random() * away.length)] };
      this.glanceMs = 900 + Math.random() * 700;
    } else if (beat === 'hop' || beat === 'hop-and-chirp') {
      this.hopMs = 0;
      if (beat === 'hop-and-chirp') {
        audioManager.play('partnerHappy');
        this.showBubble('note');
      }
    }
  }

  /** Where the partner is, in tiles, which mid-step is part of the way between two. */
  private position(): Point {
    if (this.tuck) {
      return between(this.tuck.from, this.tuck.to, Math.min(1, this.tuck.elapsedMs / STEP_DURATION_MS));
    }
    if (this.step && this.host.playerStepping()) {
      return between(this.step.from, this.step.to, this.host.stepProgress());
    }
    return { x: this.placeValue.tile.x, y: this.placeValue.tile.y };
  }

  private draw(): void {
    const at = this.position();
    const moving = this.tuck !== null || (this.step !== null && this.host.playerStepping());
    const progress = this.tuck ? Math.min(1, this.tuck.elapsedMs / STEP_DURATION_MS) : this.host.stepProgress();
    const pose = partnerPose({ moving, progress, walkPose: this.walkPose });
    const lift = this.hopMs === null ? 0 : hopLift(this.hopMs);
    const x = at.x * TILE_SIZE + PARTNER_SPRITE_X_OFFSET;
    const y = at.y * TILE_SIZE + PARTNER_SPRITE_Y_OFFSET - lift;
    const depth = atRow(FIGURE_BAND, at.y) - 0.00005;
    this.sprite
      .setFrame(partnerFrame(this.placeValue.facing, pose))
      .setPosition(x, y)
      // A hair behind the player on the same row, so a swap passes behind them.
      .setDepth(depth);
    // The player's head mark rides above every figure so the player can always
    // be found - but the partner walking right behind them would wear it on its
    // own face, which reads as the Pokemon being the one marked. While it is
    // there, and only then, the mark goes behind it.
    const player = this.host.player;
    const playerY = (player.y - PLAYER_SPRITE_Y_OFFSET) / TILE_SIZE;
    const behind = this.sprite.visible && at.y < playerY && Math.abs(at.x - player.x / TILE_SIZE) < 1;
    this.host.playerHeadMark.setDepth(behind ? depth - 0.00001 : PLAYER_MARKER_DEPTH);
    let alpha = 1;
    if (this.appearMs !== null) {
      alpha = Math.min(1, Math.max(0, (this.appearMs - PARTNER_APPEAR_DELAY_MS) / PARTNER_APPEAR_MS));
    }
    if (this.tuck) {
      alpha = 1 - progress;
    }
    this.sprite.setAlpha(this.veiled ? Math.min(alpha, PARTNER_VEILED_ALPHA) : alpha);
    if (this.bubble) {
      const art = FOLLOWER_ART[this.species];
      let bubbleX = Math.round(at.x * TILE_SIZE + TILE_SIZE / 2 - 5);
      const bubbleY = Math.round(at.y * TILE_SIZE + PARTNER_SPRITE_Y_OFFSET + art.topPixelY - 16 - lift);
      // Over its head is where a bubble goes - unless the player is standing
      // there, as they are whenever the partner is right behind them on the way
      // down the screen. Then it is seated at the player's shoulder, so it
      // never covers the player's face.
      const face = {
        x: player.x,
        y: player.y + CHARACTER_HEAD_PIXEL_Y,
        width: TILE_SIZE,
        height: FIGURE_HEIGHT,
      };
      if (bubbleX < face.x + face.width && bubbleX + BUBBLE_WIDTH > face.x && bubbleY < face.y + face.height && bubbleY + BUBBLE_HEIGHT > face.y) {
        bubbleX = Math.round(face.x + face.width);
      }
      this.bubble.setPosition(bubbleX, bubbleY);
    }
  }
}

/** A place in tiles, which mid-step is part of the way between two. */
interface Point {
  readonly x: number;
  readonly y: number;
}

function between(from: Point, to: Point, t: number): Point {
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
}

function nextBeatDelay(): number {
  return IDLE_BEAT_MIN_MS + Math.random() * IDLE_BEAT_SPREAD_MS;
}
