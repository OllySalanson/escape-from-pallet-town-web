import type Phaser from 'phaser';
import { getIdleFrame } from '../playerFrames';
import { cloudSheet, paintCloudPiece } from './arenaPit';
import { PUFF_RADII, PURSUER_FROM_MS, fallFacing, fallerAt, pursuerAt, puffsAt, windAt, JUMP_MS, type JumpPose } from './arenaDive';
import { audioManager } from '../audio/AudioManager';
import { getWorldCharacterAppearance, worldCharacterIdleFrame } from '../world/characterPresentation';
import type { HunterRival } from '../world/hunters';
import { ensureTexture } from './arenaView';
import { partnerFrame } from './partner';
import { FIRE_LETTERING, stampedWord } from '../ui/stampedLettering';

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
/** Behind whoever is falling: it is above them and going past. */
const PURSUER_DEPTH = FALLER_DEPTH - 0.5;

const WIND_INK = 0xd8e0e8;
const WIND_DIM_INK = 0x90a0b0;

/** How many pieces of cloud can be in sight at once, from `puffsAt`. */
const PUFF_POOL = 10;

/** What is going over, stamped over the pit: as big as the screen can hold them all at, from the top down. */
const STAKE_DEPTH = CLOUD_DEPTH + 1;
const STAKE_FONTS = ['30px', '20px'] as const;
/** Three of the big ones fit above the player on the smallest screen, and six of the small. */
const STAKE_BIG_MOST = 3;
const STAKE_TOP = 12;
const STAKE_GAP = 1;
const STAKE_SIDE_ROOM = 16;
/** How long a word stands at twice its size as it lands. */
const STAKE_POP_MS = 70;

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
  /** The raid's hunter, once it has come over the rail after them. */
  private pursuer: { readonly rival: HunterRival; image: Phaser.GameObjects.Image | null } | null = null;
  /** What is going over the fence with them, for as long as they are on the rail. */
  private stakes: Phaser.GameObjects.Image[] = [];

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

  /** Stamps what is at risk, out of sight until it is called for. */
  public stakesAre(words: readonly string[]): void {
    const { width } = this.scene.scale;
    const stamp = (font: string) =>
      words.map((word, index) => stampedWord(this.scene, `arena-stake-${index}`, word, { fontSize: font, depthPx: 3, ...FIRE_LETTERING }));
    let sizes = stamp(words.length <= STAKE_BIG_MOST ? STAKE_FONTS[0] : STAKE_FONTS[1]);
    if (words.length <= STAKE_BIG_MOST && sizes.some((size) => size.width > width - STAKE_SIDE_ROOM)) {
      sizes = stamp(STAKE_FONTS[1]);
    }
    let top = STAKE_TOP;
    this.stakes = sizes.map((size, index) => {
      const image = this.keep(
        this.scene.add
          .image(Math.floor((width - size.width) / 2), top, `arena-stake-${index}`)
          .setOrigin(0, 0)
          .setDepth(STAKE_DEPTH)
          .setVisible(false),
      );
      top += size.height + STAKE_GAP;
      return image;
    });
  }

  /** So many of the words are up. The newest lands from twice its size, a whole step at a time. */
  public stakesUp(count: number, newestMs: number): void {
    this.stakes.forEach((image, index) => {
      const pops = index === count - 1 && newestMs < STAKE_POP_MS;
      const homeX = Math.floor((this.scene.scale.width - image.width) / 2);
      image
        .setVisible(index < count)
        .setScale(pops ? 2 : 1)
        .setX(pops ? Math.floor((this.scene.scale.width - image.width * 2) / 2) : homeX);
    });
  }

  public stakesGone(): void {
    this.stakes.forEach((image) => image.destroy());
    this.stakes = [];
  }

  public get isPursued(): boolean {
    return this.pursuer !== null;
  }

  /** Who comes over the rail after them. */
  public pursuedBy(rival: HunterRival): void {
    this.pursuer = { rival, image: null };
  }

  /** The hunter, a time into the fall. Its own sprite and no words; the sting is the one it arrives to in the raid. */
  private chase(fallingMs: number): void {
    const pursuer = this.pursuer;
    if (!pursuer || fallingMs < PURSUER_FROM_MS) {
      return;
    }
    const appearance = getWorldCharacterAppearance('npc', pursuer.rival.design);
    const frame = worldCharacterIdleFrame(appearance, fallFacing(fallingMs, 1));
    if (!pursuer.image) {
      pursuer.image = this.keep(this.scene.add.image(0, 0, appearance.textureKey, frame).setOrigin(0, 0).setDepth(PURSUER_DEPTH));
      audioManager.play('hunterArrival');
    }
    const at = pursuerAt(fallingMs, this.scene.scale.width, this.scene.scale.height);
    pursuer.image.setVisible(at !== null).setFrame(frame);
    if (at) {
      pursuer.image.setPosition(at.x, at.y);
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
    if (this.player?.startedAtMs !== null && this.player?.startedAtMs !== undefined) {
      this.chase(elapsedMs - this.player.startedAtMs);
    }

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
