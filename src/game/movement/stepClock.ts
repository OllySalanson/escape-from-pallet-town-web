/**
 * What one walked tile costs, in game time, at any frame rate.
 *
 * A step used to be 130ms of animation that could only end on a frame, followed
 * by a frame spent planning the next one - so its real price was nine frames:
 * 150ms at sixty frames a second, 300ms at ten, and about 230ms in a headless
 * browser struggling to draw. The raid clock is spent on walking, so the same
 * route cost a different share of the raid depending on how fast the machine
 * drew it. 150ms is what the game played at sixty has always charged; it is now
 * charged everywhere, because the part of a frame a step did not need is carried
 * into the next step instead of being dropped.
 */
export const STEP_DURATION_MS = 150;

export interface StepClockTick {
  /** How far through the step the figure now is, from 0 to 1. */
  readonly progress: number;
  /** Game time this frame had left over once the step was finished. */
  readonly overflowMs: number;
}

export function advanceStepClock(
  progress: number,
  deltaMs: number,
  durationMs: number = STEP_DURATION_MS,
): StepClockTick {
  const elapsedMs = progress * durationMs + Math.max(0, deltaMs);
  if (elapsedMs < durationMs) {
    return { progress: elapsedMs / durationMs, overflowMs: 0 };
  }
  return { progress: 1, overflowMs: elapsedMs - durationMs };
}
