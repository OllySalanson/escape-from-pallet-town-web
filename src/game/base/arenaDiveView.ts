import type Phaser from 'phaser';
import { getIdleFrame } from '../playerFrames';
import { cloudSheet, paintCloudPiece } from './arenaPit';
import { PUFF_RADII, fallFacing, fallerAt, puffsAt, windAt, JUMP_MS, type JumpPose } from './arenaDive';
import { ensureTexture } from './arenaView';
import { partnerFrame } from './partner';

/**
 * What falls and what goes past on the way down from THE RAID ARENA's rail: the
 * player, their partner, the wind, torn pieces of cloud and at the last the cloud
 * itself. Where each is, is `arenaDive.ts`; this only draws them.
 *
 * All of it is on a camera of its own, over the hall's and never zoomed, because
 * the hall's camera is going in six times over and everything here has to stay a
 * game pixel to the pixel: magnified, a figure is a smear and a dithered cloud is
 * a board of squares. So the two cameras see nothing of each other's.
 */

const CLOUD_TEXTURE = 'arena-dive-cloud';
const pieceTexture = (size: number): string => `arena-cloud-piece-${size}`;

/** Depths on this camera alone: what is behind whoever is falling, them, what is in front, and the cloud. */
const FAR_PUFF_DEPTH = 1000;
const WIND_DEPTH = 1001;
const FALLER_DEPTH = 1002;
const NEAR_PUFF_DEPTH = 1003;
const CLOUD_DEPTH = 1004;

const WIND_INK = 0xd8e0e8;
const WIND_DIM_INK = 0x90a0b0;

/** How many pieces of cloud can be in sight at once, from `puffsAt`. */
const PUFF_POOL = 10;

/** Where the player falls on the screen, from its middle, and their partner beside them. Top-left of a frame. */
const PLAYER_PLACE = { x: -8, y: -28 };
const PARTNER_PLACE = { x: 12, y: -8 };

/** The partner goes where the player goes, a little less far. */
const PARTNER_DRIFT = 0.7;

interface Faller {
  readonly image: Phaser.GameObjects.Image;
  readonly from: { readonly x: number; readonly y: number };
  readonly place: { readonly x: number; readonly y: number };
  readonly frameFor: (fallingMs: number) => number;
  readonly seed: number;
  startedAtMs: number | null;
}

export class ArenaDiveView {
  private readonly scene: Phaser.Scene;
  private readonly camera: Phaser.Cameras.Scene2D.Camera;
  private readonly own = new Set<Phaser.GameObjects.GameObject>();
  private readonly wind: Phaser.GameObjects.Graphics;
  private readonly pieces: Phaser.GameObjects.Image[] = [];
  private readonly cloud: Phaser.GameObjects.TileSprite;
  private readonly playerTexture: string;
  private partnerTexture: string | null = null;
  private player: Faller | null = null;
  private partner: Faller | null = null;

  public constructor(scene: Phaser.Scene, playerTexture: string) {
    this.scene = scene;
    this.playerTexture = playerTexture;
    this.camera = scene.cameras.add(0, 0, scene.scale.width, scene.scale.height).setRoundPixels(true);
    // Painted before the jump is under way, so nothing stutters on the way down.
    ensureTexture(scene, CLOUD_TEXTURE, cloudSheet);
    PUFF_RADII.forEach((radius, size) => ensureTexture(scene, pieceTexture(size), () => paintCloudPiece(radius, 23)));
    this.wind = this.keep(scene.add.graphics().setDepth(WIND_DEPTH));
    for (let index = 0; index < PUFF_POOL; index += 1) {
      this.pieces.push(this.keep(scene.add.image(0, 0, pieceTexture(0)).setVisible(false)));
    }
    this.cloud = this.keep(
      scene.add
        .tileSprite(0, 0, scene.scale.width, scene.scale.height, CLOUD_TEXTURE)
        .setOrigin(0, 0)
        .setDepth(CLOUD_DEPTH)
        .setVisible(false),
    );
  }

  /** Something of this camera's, which the hall's camera never sees. */
  private keep<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.own.add(object);
    this.scene.cameras.main.ignore(object);
    return object;
  }

  /** Everything else in the scene is the hall's, whenever it came. */
  private seeOnlyOurOwn(): void {
    for (const object of this.scene.children.list) {
      if (!this.own.has(object)) {
        this.camera.ignore(object);
      }
    }
  }

  public partnerIs(texture: string): void {
    this.partnerTexture = texture;
  }

  /** The player has left the rail, at this place on the screen. */
  public playerFalls(from: { readonly x: number; readonly y: number }): void {
    const { width, height } = this.scene.scale;
    this.player = this.faller(this.playerTexture, from, { x: width / 2 + PLAYER_PLACE.x, y: height / 2 + PLAYER_PLACE.y }, 0, (ms) =>
      getIdleFrame(fallFacing(ms)),
    );
  }

  /** And after them, their partner. */
  public partnerFalls(from: { readonly x: number; readonly y: number }): void {
    const { width, height } = this.scene.scale;
    if (this.partnerTexture) {
      this.partner = this.faller(this.partnerTexture, from, { x: width / 2 + PARTNER_PLACE.x, y: height / 2 + PARTNER_PLACE.y }, 2.1, (ms) =>
        partnerFrame(fallFacing(ms, 2), Math.floor(ms / 95) % 2 === 0 ? 0 : 1),
      );
    }
  }

  private faller(
    texture: string,
    from: { readonly x: number; readonly y: number },
    place: { readonly x: number; readonly y: number },
    seed: number,
    frameFor: (fallingMs: number) => number,
  ): Faller {
    const image = this.keep(this.scene.add.image(from.x, from.y, texture, frameFor(0)).setOrigin(0, 0).setDepth(FALLER_DEPTH));
    return { image, from, place, seed, frameFor, startedAtMs: null };
  }

  private fall(faller: Faller | null, elapsedMs: number, seen: boolean, steer: { readonly x: number; readonly y: number }): void {
    if (!faller) {
      return;
    }
    faller.startedAtMs ??= elapsedMs;
    const fallingMs = elapsedMs - faller.startedAtMs;
    const at = fallerAt(fallingMs, faller.from, faller.place, faller.seed);
    faller.image.setPosition(at.x + Math.round(steer.x), at.y + Math.round(steer.y)).setFrame(faller.frameFor(fallingMs)).setVisible(seen);
  }

  /** `steer` is how far the arrow keys have drifted whoever is falling, in pixels. */
  public frame(elapsedMs: number, pose: JumpPose, width: number, height: number, steer: { readonly x: number; readonly y: number }): void {
    this.seeOnlyOurOwn();
    const middleX = Math.floor(width / 2);
    const middleY = Math.floor(height / 2);
    this.fall(this.player, elapsedMs, pose.figure.seen, steer);
    this.fall(this.partner, elapsedMs, pose.figure.seen, { x: steer.x * PARTNER_DRIFT, y: steer.y * PARTNER_DRIFT });

    this.wind.clear();
    for (const streak of windAt(elapsedMs, pose.wind, width, height)) {
      this.wind.fillStyle(streak.bright ? WIND_INK : WIND_DIM_INK, 1);
      const steps = Math.max(Math.abs(streak.toX - streak.fromX), Math.abs(streak.toY - streak.fromY));
      for (let step = 0; step <= steps; step += 1) {
        const share = steps === 0 ? 0 : step / steps;
        this.wind.fillRect(
          middleX + Math.round(streak.fromX + (streak.toX - streak.fromX) * share),
          middleY + Math.round(streak.fromY + (streak.toY - streak.fromY) * share),
          1,
          1,
        );
      }
    }

    const puffs = puffsAt(pose.dive, width, height);
    this.pieces.forEach((piece, index) => {
      const puff = puffs[index];
      piece.setVisible(puff !== undefined);
      if (puff) {
        piece
          .setTexture(pieceTexture(puff.size))
          .setPosition(middleX + puff.x, middleY + puff.y)
          .setDepth(puff.near ? NEAR_PUFF_DEPTH : FAR_PUFF_DEPTH)
          .setFlipX(puff.index % 2 === 0)
          .setFlipY(puff.index % 4 < 2);
      }
    });

    this.cloud.setVisible(pose.cloud > 0);
    if (pose.cloud > 0) {
      // In steps, as a GBA's blend registers go. It runs up to where the raid's
      // own sheet starts from, so the two are the same cloud at the join.
      this.cloud.setAlpha(Math.ceil(pose.cloud * 6) / 6);
      this.cloud.setTilePosition(Math.round((elapsedMs - JUMP_MS) / 4), Math.round((elapsedMs - JUMP_MS) / 2));
    }
  }

  public destroy(): void {
    this.scene.cameras.remove(this.camera);
  }
}
