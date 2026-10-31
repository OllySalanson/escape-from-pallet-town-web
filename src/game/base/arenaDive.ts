import type { Direction, GridPosition } from '../movement/gridMovement';
import { ARENA_TILE } from './arenaHall';

/**
 * Over the fence and down: what a jump looks like, as a pure function of the
 * time since it began, so the whole of it can be asked of a number and the scene
 * only has to put things where this says.
 *
 * The view comes back to the player at the fence; a hop on to the rail and over;
 * a figure dropping away, shrinking, as the view swings out over the place it is
 * falling towards; then the hall itself going
 * past, the rings first because they are nearest, the floor coming up more
 * slowly under them; and last the cloud, which is the join. The cloud fills the
 * screen before the scene changes and the raid opens under the same cloud
 * (`world/raidArrival.ts`), so nobody ever sees the seam.
 */

/** The view coming back from wherever the rim's panel had it looking, to the player at the fence. */
export const TURN_BACK_MS = 300;
export const HOP_MS = 340;
export const FALL_MS = 560;
export const DIVE_MS = 1180;
export const JUMP_MS = TURN_BACK_MS + HOP_MS + FALL_MS + DIVE_MS;

/** How far the view has gone in when the cloud shuts over it. */
const DIVE_ZOOM = 6;
/** How much of the dive has gone before the first of the cloud comes past. */
const CLOUD_FROM = 0.42;
/** How high the hop goes, in pixels. */
const HOP_RISE = 16;
/** How far over the fence the hop lands, in tiles. */
const HOP_REACH = 2;
/** How far the figure is seen to drop past that before it is lost sight of. */
const DROP_REACH = 46;
/** How small it has got by then. */
const FARTHEST_SCALE = 0.25;

export interface JumpPose {
  /** The figure, as an offset from where it stood, and how big. */
  readonly figure: { readonly x: number; readonly y: number; readonly scale: number; readonly seen: boolean };
  /** How far the view has come back to the figure from where it was looking, 0 to 1. */
  readonly back: number;
  /** How far the view has swung from the figure to the place it is falling to, 0 to 1. */
  readonly swing: number;
  /** How far in the camera has gone: 1 is the hall as it is. */
  readonly zoom: number;
  /** How much of the screen the cloud has, 0 to 1. */
  readonly cloud: number;
}

const ease = (t: number): number => t * t * (3 - 2 * t);
const unit = (value: number): number => Math.max(0, Math.min(1, value));

/** Which way across the fence: the offset of a step over it. */
export function overTheFence(tile: GridPosition, fence: GridPosition): { readonly x: number; readonly y: number } {
  return { x: fence.x - tile.x, y: fence.y - tile.y };
}

export function jumpPose(elapsedMs: number, over: { readonly x: number; readonly y: number }): JumpPose {
  const hop = unit((elapsedMs - TURN_BACK_MS) / HOP_MS);
  const fall = unit((elapsedMs - TURN_BACK_MS - HOP_MS) / FALL_MS);
  const dive = unit((elapsedMs - TURN_BACK_MS - HOP_MS - FALL_MS) / DIVE_MS);
  const reachX = over.x * ARENA_TILE * HOP_REACH;
  const reachY = over.y * ARENA_TILE * HOP_REACH;
  const dropped = fall * fall * DROP_REACH;
  return {
    figure: {
      x: Math.round(reachX * hop + over.x * dropped),
      // An arc up over the rail, then only down.
      y: Math.round(reachY * hop - Math.sin(hop * Math.PI) * HOP_RISE + dropped * (over.y === 0 ? 1 : Math.max(over.y, 0.5))),
      scale: 1 - (1 - FARTHEST_SCALE) * ease(fall),
      seen: fall < 1,
    },
    back: ease(unit(elapsedMs / TURN_BACK_MS)),
    swing: ease(fall),
    // Exponentially, as anything falling towards a floor sees it come: slowly
    // and then all at once.
    zoom: Math.pow(DIVE_ZOOM, dive * dive),
    cloud: dive <= CLOUD_FROM ? 0 : unit((dive - CLOUD_FROM) / (1 - CLOUD_FROM)),
  };
}

/** Which way a figure stands to face a neighbouring tile. */
export function facingTowards(from: GridPosition, to: GridPosition): Direction {
  if (to.x > from.x) return 'right';
  if (to.x < from.x) return 'left';
  return to.y > from.y ? 'down' : 'up';
}

/** How long the cloud takes to lift off ground a raid has just walked, and how long the view stays. */
export const FOG_APPROACH_MS = 500;
export const FOG_LIFT_STEPS = 9;
export const FOG_STEP_MS = 170;
export const FOG_HOLD_MS = 900;
export const FOG_LIFT_MS = FOG_APPROACH_MS + FOG_LIFT_STEPS * FOG_STEP_MS + FOG_HOLD_MS;
