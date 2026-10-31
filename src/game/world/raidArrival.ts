/**
 * Landing in a raid from THE RAID ARENA's pit, as a pure function of the time
 * since the raid opened: under the same cloud the jump came down through
 * (`base/arenaDive.ts`), which thins, and the player dropping out of it on to the
 * tile the raid starts from. It moves nobody: the figure's tile is the landing
 * from the first frame, this is only where it is drawn. The world spends this
 * time on itself, so the raid clock is not charged for it.
 */

/** How long the cloud takes to clear. */
export const ARRIVAL_CLOUD_MS = 760;
/** When the figure starts to fall, how long it takes, and how far above the tile it starts. */
export const ARRIVAL_FALL_FROM_MS = 180;
export const ARRIVAL_FALL_MS = 340;
export const ARRIVAL_FALL_HEIGHT = 150;
/** How long it stays down on landing before the raid is the player's. */
export const ARRIVAL_SETTLE_MS = 160;
export const ARRIVAL_MS = ARRIVAL_FALL_FROM_MS + ARRIVAL_FALL_MS + ARRIVAL_SETTLE_MS;

export interface ArrivalPose {
  /** How far above its tile the figure is drawn. */
  readonly height: number;
  /** How much of the cloud is left, 0 to 1, in the whole steps a GBA's blend has. */
  readonly cloud: number;
  /** Whether it has touched down. */
  readonly landed: boolean;
}

export function arrivalPose(elapsedMs: number): ArrivalPose {
  const fall = Math.max(0, Math.min(1, (elapsedMs - ARRIVAL_FALL_FROM_MS) / ARRIVAL_FALL_MS));
  const cleared = Math.max(0, Math.min(1, elapsedMs / ARRIVAL_CLOUD_MS));
  return {
    height: Math.round(ARRIVAL_FALL_HEIGHT * (1 - fall * fall)),
    cloud: Math.ceil((1 - cleared) * 6) / 6,
    landed: fall >= 1,
  };
}
