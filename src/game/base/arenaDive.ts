import type { Direction, GridPosition } from '../movement/gridMovement';
import { ARENA_TILE, scatter } from './arenaHall';

/**
 * Over the fence and down: what a jump looks like, as a pure function of the
 * time since it began, so the whole of it can be asked of a number and the scene
 * only has to put things where this says.
 *
 * The view comes back to the player at the fence; a hop on to the rail and over,
 * with the partner a beat behind; then both are falling, seen from just above and
 * big on the screen, turning over and over as the view swings out over the place
 * they are falling towards. The hall goes past, the rings first because they are
 * nearest; wind goes by; pieces of cloud tear past; and last the cloud itself,
 * which is the join. It fills the screen before the scene changes and the raid
 * opens under the same cloud (`world/raidArrival.ts`), so nobody sees the seam.
 *
 * Everything that falls is drawn a game pixel to the pixel however far in the
 * camera has gone (`arenaDiveView.ts`): magnified, a dither is a board of squares.
 */

/** The view coming back from wherever the rim's panel had it looking, to the player at the fence. */
export const TURN_BACK_MS = 300;
export const HOP_MS = 340;
export const FALL_MS = 560;
export const DIVE_MS = 1500;
export const JUMP_MS = TURN_BACK_MS + HOP_MS + FALL_MS + DIVE_MS;
/** How long the partner stands looking at the rail before it goes after them. */
export const PARTNER_LAG_MS = 170;

/** How far the view has gone in when the cloud shuts over it. */
const DIVE_ZOOM = 6;
/** How much of the dive has gone before the cloud itself comes in. */
const CLOUD_FROM = 0.74;
/** How high the hop goes, in pixels. */
const HOP_RISE = 16;
/** How far over the fence the hop lands, in tiles. */
const HOP_REACH = 2;
/** How long a falling figure takes to come to its place on the screen. */
const FALLER_SETTLE_MS = 520;
/** How long it shows each of its four sides, falling. */
const SPIN_STEP_MS = 95;
/** The way it turns over: the order FireRed's spin tiles turn a figure. */
const SPIN: readonly Direction[] = ['down', 'left', 'up', 'right'];

export interface JumpPose {
  /** The figure on its way over the fence, as an offset from where it stood, until it is `falling`. */
  readonly figure: { readonly x: number; readonly y: number; readonly falling: boolean; readonly seen: boolean };
  /** How far the view has come back to the figure from where it was looking, 0 to 1. */
  readonly back: number;
  /** How far the view has swung from the figure to the place it is falling to, 0 to 1. */
  readonly swing: number;
  /** How far in the camera has gone: 1 is the hall as it is. */
  readonly zoom: number;
  /** How much of the screen the cloud has, 0 to 1. */
  readonly cloud: number;
  /** How far through going down, 0 to 1: pieces of cloud and most of the wind come with this. */
  readonly dive: number;
  /** How hard the wind is blowing, 0 to 1. */
  readonly wind: number;
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
  const cloud = dive <= CLOUD_FROM ? 0 : unit((dive - CLOUD_FROM) / (1 - CLOUD_FROM));
  return {
    figure: {
      x: Math.round(over.x * ARENA_TILE * HOP_REACH * hop),
      // An arc up over the rail.
      y: Math.round(over.y * ARENA_TILE * HOP_REACH * hop - Math.sin(hop * Math.PI) * HOP_RISE),
      falling: hop >= 1,
      seen: cloud < 1,
    },
    back: ease(unit(elapsedMs / TURN_BACK_MS)),
    swing: ease(fall),
    // Exponentially, as anything falling towards a floor sees it come: slowly
    // and then all at once.
    zoom: Math.pow(DIVE_ZOOM, dive * dive),
    cloud,
    dive,
    wind: unit(fall * 0.45 + dive * 0.8),
  };
}

/** The partner's own hop over the fence, from where it stood to where the player went over. */
export function partnerLeap(
  elapsedMs: number,
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
): { readonly x: number; readonly y: number; readonly falling: boolean } {
  const hop = unit((elapsedMs - TURN_BACK_MS - PARTNER_LAG_MS) / HOP_MS);
  return {
    x: Math.round(from.x + (to.x - from.x) * hop),
    y: Math.round(from.y + (to.y - from.y) * hop - Math.sin(hop * Math.PI) * HOP_RISE),
    falling: hop >= 1,
  };
}

/** Which of its sides a figure falling for this long is showing. `offset` starts it on another, so two do not turn as one. */
export function fallFacing(fallingMs: number, offset = 0): Direction {
  return SPIN[(Math.floor(fallingMs / SPIN_STEP_MS) + offset) % SPIN.length];
}

/**
 * Where a falling figure is on the screen: from wherever it left the rail to its
 * place, then buffeted about it a pixel or two by the wind. Whole pixels. `seed`
 * buffets each figure its own way.
 */
export function fallerAt(
  fallingMs: number,
  start: { readonly x: number; readonly y: number },
  place: { readonly x: number; readonly y: number },
  seed = 0,
): { readonly x: number; readonly y: number } {
  const share = ease(unit(fallingMs / FALLER_SETTLE_MS));
  const buffet = (period: number, phase: number): number => Math.sin(fallingMs / period + phase + seed) * 2;
  return {
    x: Math.round(start.x + (place.x - start.x) * share + buffet(83, 0) * share),
    y: Math.round(start.y + (place.y - start.y) * share + buffet(61, 1.7) * share),
  };
}

/**
 * The raid's hunter comes over the rail after them. It says what the hunter's
 * arrival is, with no words: the one on the far floor has jumped too, and goes past
 * them, so it is down there first. It comes in at the top of the screen once the
 * two are settled, hangs a moment over them to be seen, and is off the bottom
 * before the cloud comes in.
 */
export const PURSUER_FROM_MS = 480;
const PURSUER_COMES_MS = 420;
const PURSUER_HANGS_MS = 260;
const PURSUER_GOES_MS = 420;
/** Where it hangs, from the middle of the screen: over the player's shoulder, clear of them both. */
const PURSUER_PLACE = { x: 34, y: -78 };
/** How far beyond the screen's edges it starts and ends, and how far it drifts out from them on its way past. */
const PURSUER_OFF_SCREEN = 40;
const PURSUER_PASSES_WIDE = 18;

/** Where the hunter is on the screen a time into the fall (top-left of a frame), or null if it is not. */
export function pursuerAt(
  fallingMs: number,
  viewWidth: number,
  viewHeight: number,
): { readonly x: number; readonly y: number } | null {
  const ms = fallingMs - PURSUER_FROM_MS;
  const comes = unit(ms / PURSUER_COMES_MS);
  const goes = unit((ms - PURSUER_COMES_MS - PURSUER_HANGS_MS) / PURSUER_GOES_MS);
  if (ms < 0 || goes >= 1) {
    return null;
  }
  const hangX = viewWidth / 2 + PURSUER_PLACE.x;
  const hangY = viewHeight / 2 + PURSUER_PLACE.y;
  const buffet = Math.sin(fallingMs / 71) * 2;
  // Slowing into its place; then, as anything falling past is, all at once.
  const y = -PURSUER_OFF_SCREEN + (hangY + PURSUER_OFF_SCREEN) * ease(comes) + (viewHeight + PURSUER_OFF_SCREEN - hangY) * goes * goes;
  return { x: Math.round(hangX + PURSUER_PASSES_WIDE * goes * goes + buffet), y: Math.round(y) };
}

/** How far the arrow keys can drift whoever is falling, and how quickly: for the feel of it, and nothing depends on it. */
const STEER_ACROSS = 34;
const STEER_DOWN = 20;
const STEER_EASE_MS = 170;

/** Whoever is falling, drifted on by a frame of the keys held: -1, 0 or 1 each way. */
export function steered(
  steer: { readonly x: number; readonly y: number },
  held: { readonly x: number; readonly y: number },
  deltaMs: number,
): { readonly x: number; readonly y: number } {
  const share = Math.min(1, deltaMs / STEER_EASE_MS);
  return {
    x: steer.x + (held.x * STEER_ACROSS - steer.x) * share,
    y: steer.y + (held.y * STEER_DOWN - steer.y) * share,
  };
}

/** How many pieces of cloud tear past on the way down. */
const PUFFS = 16;
/** How much of the dive a piece takes to go from the middle of the screen past its edge. */
const PUFF_LIFE = 0.3;
/** Its three sizes, each painted at that size: a piece is never magnified. */
export const PUFF_RADII = [26, 52, 104] as const;
const PUFF_CLEAR_OF_THE_MIDDLE = 70;

export interface PuffPose {
  readonly index: number;
  /** Its middle, from the middle of the screen, in whole pixels. */
  readonly x: number;
  readonly y: number;
  /** Which of `PUFF_RADII` it has got to. */
  readonly size: 0 | 1 | 2;
  /** Whether it goes past in front of whoever is falling, rather than behind. */
  readonly near: boolean;
}

/** The pieces of cloud in sight, for how far through the dive it is. A pure function, so it plays the same every time. */
export function puffsAt(dive: number, viewWidth: number, viewHeight: number): readonly PuffPose[] {
  const puffs: PuffPose[] = [];
  const reach = Math.hypot(viewWidth, viewHeight) / 2 + PUFF_RADII[2];
  for (let index = 0; index < PUFFS; index += 1) {
    const age = (dive - (index / PUFFS) * (1 - PUFF_LIFE * 0.5)) / PUFF_LIFE;
    if (age <= 0 || age >= 1) {
      continue;
    }
    // Round the screen by the golden angle, so no two go the same way together.
    const angle = index * 2.39996;
    const distance = 16 + age * age * age * reach;
    puffs.push({
      index,
      x: Math.round(Math.cos(angle) * distance * (viewWidth / viewHeight) * 0.8),
      y: Math.round(Math.sin(angle) * distance * 0.8),
      size: age < 0.45 ? 0 : age < 0.75 ? 1 : 2,
      // Never in front while it is still in the middle, where whoever is falling is.
      near: index % 3 === 0 && distance > PUFF_CLEAR_OF_THE_MIDDLE,
    });
  }
  return puffs;
}

/** How many streaks of wind blow at the most, and how long a streak takes to go from the middle past the edge. */
const STREAKS = 44;
const STREAK_LIFE_MS = 430;

export interface WindStreak {
  readonly fromX: number;
  readonly fromY: number;
  readonly toX: number;
  readonly toY: number;
  readonly bright: boolean;
}

/**
 * The air going past: thin lines running out from the middle of the screen, more
 * and longer the harder it blows. From the middle of the screen, in whole pixels.
 */
export function windAt(elapsedMs: number, wind: number, viewWidth: number, viewHeight: number): readonly WindStreak[] {
  const streaks: WindStreak[] = [];
  const count = Math.round(STREAKS * wind);
  const reach = Math.hypot(viewWidth, viewHeight) / 2;
  for (let index = 0; index < count; index += 1) {
    const age = (elapsedMs / STREAK_LIFE_MS + scatter(index, 3)) % 1;
    const angle = scatter(index, 11) * Math.PI * 2;
    const distance = 34 + age * age * reach;
    const length = 2 + age * (6 + wind * 34);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    streaks.push({
      fromX: Math.round(cos * distance),
      fromY: Math.round(sin * distance),
      toX: Math.round(cos * (distance + length)),
      toY: Math.round(sin * (distance + length)),
      bright: index % 3 === 0,
    });
  }
  return streaks;
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
