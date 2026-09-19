import { nextTileFromDirection, type Direction, type GridPosition } from '../movement/gridMovement';

/**
 * The beat between being seen and being spoken to.
 *
 * A watch used to hand the player straight to the trainer's intro line, so the
 * fight arrived out of nowhere from a figure ten tiles off. The beat is the
 * tutorial's own: an exclamation mark, a breath, and the trainer walks up to
 * *one tile short of the player* before a word is said.
 *
 * It costs no raid time - `WorldScene.advanceRunClock()` ticks zero while a
 * trainer battle is pending - which is the only reason it is safe to be this
 * long. The numbers are what a played watch settled on:
 *
 * - `APPROACH_ALERT_MS`: long enough to read the mark and see who it is over,
 *   short enough that the player has not yet reached for a key. Under about
 *   400ms the mark is gone before the eye finds it; over 700ms it is a stall.
 * - `APPROACH_STEP_MS`: a tile every 110ms, quicker than the player's own step,
 *   because the trainer is coming *for* them. The longest authored watch is
 *   five tiles, so the whole walk is at most ~0.45s and the whole beat under a
 *   second - an event, not an interruption. At the player's pace the walk
 *   reads as a stroll, and the drama of being run down is lost.
 *
 * Pure and driven by elapsed milliseconds rather than by frames, so a 100ms
 * test-mode frame walks exactly as far as six 16ms ones (see `stepClock.ts`).
 */
export const APPROACH_ALERT_MS = 500;
export const APPROACH_STEP_MS = 110;
/** Held on the closing tile before the trainer speaks, so the arrival lands. */
export const APPROACH_SETTLE_MS = 120;

export interface TrainerApproach {
  /** Where the trainer starts. */
  readonly from: GridPosition;
  /** Every tile the trainer walks onto, in order. Empty when already adjacent. */
  readonly path: readonly GridPosition[];
  /** The way the trainer faces on the whole walk: towards the player. */
  readonly facing: Direction;
}

/**
 * The walk from the trainer to one tile short of the player, or null when the
 * player is not in the straight run the trainer faces.
 *
 * A watch is one straight line and stops at the first wall, so the run between
 * trainer and player is always walkable ground; this only refuses what a watch
 * could never have caught.
 */
export function planTrainerApproach(
  trainer: GridPosition,
  facing: Direction,
  player: GridPosition,
  reach: number,
): TrainerApproach | null {
  const path: GridPosition[] = [];
  let tile = trainer;
  for (let step = 0; step < reach; step += 1) {
    const next = nextTileFromDirection(tile, facing);
    if (next.x === player.x && next.y === player.y) {
      return { from: trainer, path, facing };
    }
    path.push(next);
    tile = next;
  }
  return null;
}

export type ApproachPhase = 'alert' | 'walk' | 'settle' | 'done';

export interface ApproachFrame {
  readonly phase: ApproachPhase;
  /** The trainer's position in (fractional) tiles. */
  readonly x: number;
  readonly y: number;
}

/** Where the beat is `elapsedMs` after the trainer saw the player. */
export function approachFrameAt(approach: TrainerApproach, elapsedMs: number): ApproachFrame {
  const stay = (phase: ApproachPhase, at: GridPosition): ApproachFrame => ({
    phase,
    x: at.x,
    y: at.y,
  });
  if (elapsedMs < APPROACH_ALERT_MS) {
    return stay('alert', approach.from);
  }
  const walkMs = approach.path.length * APPROACH_STEP_MS;
  const walked = elapsedMs - APPROACH_ALERT_MS;
  if (walked < walkMs) {
    const index = Math.floor(walked / APPROACH_STEP_MS);
    const within = (walked - index * APPROACH_STEP_MS) / APPROACH_STEP_MS;
    const start = index === 0 ? approach.from : approach.path[index - 1];
    const end = approach.path[index];
    return {
      phase: 'walk',
      x: start.x + (end.x - start.x) * within,
      y: start.y + (end.y - start.y) * within,
    };
  }
  const arrival = approach.path[approach.path.length - 1] ?? approach.from;
  if (walked - walkMs < APPROACH_SETTLE_MS) {
    return stay('settle', arrival);
  }
  return stay('done', arrival);
}

/** The whole beat, for tests and for anyone budgeting a fight's lead-in. */
export function approachDurationMs(approach: TrainerApproach): number {
  return APPROACH_ALERT_MS + approach.path.length * APPROACH_STEP_MS + APPROACH_SETTLE_MS;
}
