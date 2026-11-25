import type Phaser from 'phaser';
import { FLOOR_FURNITURE_DEPTH } from '../world/depths';
import { DOOR_FRAMES, DOOR_LIGHT_ORIGIN, doorFrameAt, doorsOpenShare, paintDoorLight, paintDoorStrip } from './arenaDoors';
import { DOOR_OPENING } from './arenaHall';
import { ensureTexture } from './arenaView';

const TEXTURE = 'arena-doors';
const LIGHT_TEXTURE = 'arena-doors-light';
/** How strongly the hall's light shows through the doors, all the way open: a wash over the stone, not a lamp. */
const LIGHT_ALPHA = 0.26;

/**
 * THE RAID ARENA's great doors on the screen (`arenaDoors.ts` is what they are):
 * the leaves in their opening, shut or back against the walls, and the swing
 * between, run on the scene's own clock so a stepped or slow frame swings them as
 * far as it should. Under reduced motion they are simply open.
 */
export class ArenaDoorsView {
  private readonly image: Phaser.GameObjects.Image;
  private readonly light: Phaser.GameObjects.Image;
  private readonly still: boolean;
  private openedMs: number | null;
  private onOpen: (() => void) | null = null;

  public constructor(scene: Phaser.Scene, open: boolean, still: boolean) {
    this.still = still;
    ensureTexture(scene, TEXTURE, paintDoorStrip);
    const texture = scene.textures.get(TEXTURE);
    for (let frame = 0; frame < DOOR_FRAMES; frame += 1) {
      if (!texture.has(String(frame))) {
        texture.add(String(frame), 0, frame * DOOR_OPENING.width, 0, DOOR_OPENING.width, DOOR_OPENING.height);
      }
    }
    // Over the floor they stand on and under everybody, so whoever stands before them is in front.
    this.image = scene.add
      .image(DOOR_OPENING.left, DOOR_OPENING.top, TEXTURE, String(open ? DOOR_FRAMES - 1 : 0))
      .setOrigin(0, 0)
      .setDepth(FLOOR_FURNITURE_DEPTH + 0.05);
    ensureTexture(scene, LIGHT_TEXTURE, paintDoorLight);
    this.light = scene.add
      .image(DOOR_LIGHT_ORIGIN.x, DOOR_LIGHT_ORIGIN.y, LIGHT_TEXTURE)
      .setOrigin(0, 0)
      .setDepth(FLOOR_FURNITURE_DEPTH + 0.06)
      .setBlendMode('ADD')
      .setAlpha(open ? LIGHT_ALPHA : 0);
    this.openedMs = open ? Number.POSITIVE_INFINITY : null;
  }

  /** Whether a step can be taken through them: all the way open. */
  public get open(): boolean {
    return this.openedMs !== null && doorsOpenShare(this.openedMs) >= 1;
  }

  /** Whether they have been pushed and are still swinging. */
  public get swinging(): boolean {
    return this.openedMs !== null && !this.open;
  }

  /** A push: they start to swing, once, and `then` is called as they come to rest open. */
  public push(then: () => void): boolean {
    if (this.openedMs !== null) {
      return false;
    }
    this.openedMs = this.still ? Number.POSITIVE_INFINITY : 0;
    this.onOpen = then;
    if (this.still) {
      this.settle();
    }
    return true;
  }

  public update(deltaMs: number): void {
    if (this.openedMs === null || this.openedMs === Number.POSITIVE_INFINITY) {
      return;
    }
    this.openedMs += deltaMs;
    const share = doorsOpenShare(this.openedMs);
    this.image.setFrame(String(doorFrameAt(share)));
    this.light.setAlpha(LIGHT_ALPHA * share);
    if (this.open) {
      this.settle();
    }
  }

  private settle(): void {
    this.openedMs = Number.POSITIVE_INFINITY;
    this.image.setFrame(String(DOOR_FRAMES - 1));
    this.light.setAlpha(LIGHT_ALPHA);
    const then = this.onOpen;
    this.onOpen = null;
    then?.();
  }

  public destroy(): void {
    this.image.destroy();
    this.light.destroy();
  }
}
