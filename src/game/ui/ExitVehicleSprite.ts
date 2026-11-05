import type Phaser from 'phaser';
import {
  LOCKED_RIDE_ALPHA,
  RIDE_ARRIVAL_MS,
  rideArrival,
  rideDeparture,
  rideIdle,
  ridePicture,
  type ExitRide,
  type RidePicture,
  type RidePose,
} from '../world/exitVehicles';

const TILE = 16;
/** A bird's shadow: as dark as the harbour bird's, and as flat. */
const SHADOW_ALPHA = 0.28;
const SHADOW_HEIGHT = 4;

/**
 * One exit's ride, drawn: the picture `ridePicture` describes, posed every
 * frame by `rideIdle`, `rideArrival` and `rideDeparture` on the scene's own
 * clock. It is drawn and nothing else - the exit's tile, its rules and its
 * collision are the scene's, exactly as they were for the square it replaces.
 */
export class ExitVehicleSprite {
  public readonly ride: ExitRide;
  private readonly picture: RidePicture;
  private readonly image: Phaser.GameObjects.Image;
  private readonly shadow: Phaser.GameObjects.Graphics | undefined;
  private readonly restX: number;
  private readonly restY: number;
  private open: boolean;
  private arrivedAt: number | undefined;
  private departedAt: number | undefined;
  private readonly depths: { readonly waiting: number; readonly open: number };

  public constructor(
    scene: Phaser.Scene,
    ride: ExitRide,
    options: {
      readonly open: boolean;
      /** Where it is drawn while it waits for its exit to open, and once it has. */
      readonly depth: { readonly waiting: number; readonly open: number };
    },
  ) {
    this.ride = ride;
    this.picture = ridePicture(ride);
    this.open = options.open;
    this.depths = options.depth;
    this.restX = ride.at.x * TILE + this.picture.centre.x;
    this.restY = ride.at.y * TILE + this.picture.centre.y;
    const shadow = this.picture.shadow;
    if (shadow) {
      this.shadow = scene.add
        .graphics()
        .fillStyle(0x000000, 1)
        .fillEllipse(ride.at.x * TILE + shadow.x, ride.at.y * TILE + shadow.y, shadow.width, SHADOW_HEIGHT);
    }
    this.image = scene.add
      .image(this.restX, this.restY, this.picture.texture, this.picture.frame)
      .setFlipX(this.picture.flipX);
    this.settleDepth();
    this.pose(this.open ? rideIdle(ride.vehicle, 0) : this.lockedPose());
  }

  /** The pixels the ride covers at rest: what its caption is seated round. */
  public get rect(): { x: number; y: number; width: number; height: number } {
    const bounds = this.picture.bounds;
    return { x: this.ride.at.x * TILE + bounds.x, y: this.ride.at.y * TILE + bounds.y, width: bounds.width, height: bounds.height };
  }

  public get objects(): readonly Phaser.GameObjects.GameObject[] {
    return this.shadow ? [this.shadow, this.image] : [this.image];
  }

  /** Whether it is leaving, so nothing else poses it. */
  public get leaving(): boolean {
    return this.departedAt !== undefined;
  }

  /**
   * Opens or shuts it. A ride whose exit has just opened comes in; one shut
   * again (a new raid on the same scene) is simply there, not yet come.
   */
  public setOpen(open: boolean, nowMs: number): void {
    if (open === this.open) {
      return;
    }
    this.open = open;
    this.arrivedAt = open ? nowMs : undefined;
    this.settleDepth();
  }

  /** Leaves with the player. */
  public depart(nowMs: number): void {
    this.open = true;
    this.departedAt ??= nowMs;
    this.settleDepth();
  }

  public setVisible(visible: boolean): void {
    this.image.setVisible(visible);
    this.shadow?.setVisible(visible);
  }

  public update(nowMs: number): void {
    if (this.departedAt !== undefined) {
      this.pose(rideDeparture(this.ride, nowMs - this.departedAt));
      return;
    }
    if (!this.open) {
      this.pose(this.lockedPose());
      return;
    }
    if (this.arrivedAt !== undefined && nowMs - this.arrivedAt < RIDE_ARRIVAL_MS) {
      this.pose(rideArrival(this.ride, nowMs - this.arrivedAt));
      return;
    }
    this.pose(rideIdle(this.ride.vehicle, nowMs));
  }

  public destroy(): void {
    this.image.destroy();
    this.shadow?.destroy();
  }

  private settleDepth(): void {
    const depth = this.open ? this.depths.open : this.depths.waiting;
    this.image.setDepth(depth);
    this.shadow?.setDepth(depth - 0.0001);
  }

  private lockedPose(): RidePose {
    return { dx: 0, dy: 0, alpha: LOCKED_RIDE_ALPHA, beat: 0 };
  }

  private pose(pose: RidePose): void {
    this.image.setPosition(this.restX + pose.dx, this.restY + pose.dy);
    this.image.setAlpha(pose.alpha);
    const frames = this.picture.frames;
    if (frames) {
      this.image.setFrame(frames[pose.beat % frames.length]);
    }
    // A bird's shadow stays on the ground and thins as it climbs away.
    this.shadow?.setAlpha(SHADOW_ALPHA * pose.alpha);
  }
}
