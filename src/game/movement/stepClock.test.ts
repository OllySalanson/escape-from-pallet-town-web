import { describe, expect, it } from 'vitest';
import { advanceStepClock, STEP_DURATION_MS } from './stepClock';

/**
 * A held direction key, walked the way `WorldScene.update` walks it: a frame at
 * rest begins a step, a finished step hands its overflow to the step the next
 * frame begins. Returns the game time at which each tile was reached.
 */
function walk(frameMs: number, tiles: number): number[] {
  const arrivals: number[] = [];
  let now = 0;
  let progress: number | null = null;
  let carryMs: number | null = null;
  while (arrivals.length < tiles) {
    now += frameMs;
    const carried = carryMs;
    carryMs = null;
    let deltaMs = frameMs;
    if (progress === null) {
      progress = 0;
      if (carried === null) {
        continue;
      }
      deltaMs += carried;
    }
    const tick = advanceStepClock(progress, deltaMs);
    progress = tick.progress;
    if (tick.progress === 1) {
      arrivals.push(now - tick.overflowMs);
      carryMs = tick.overflowMs;
      progress = null;
    }
  }
  return arrivals;
}

describe('step clock', () => {
  it('charges the same game time per tile at sixty frames a second and at ten', () => {
    for (const frameMs of [1000 / 144, 1000 / 60, 1000 / 30, 100, 200]) {
      const arrivals = walk(frameMs, 40);
      const perTile = (arrivals[39] - arrivals[0]) / 39;
      expect(perTile).toBeCloseTo(STEP_DURATION_MS, 6);
    }
  });

  it('never reports more than a finished step, and keeps what the frame had left', () => {
    expect(advanceStepClock(0, 100)).toEqual({ progress: 100 / STEP_DURATION_MS, overflowMs: 0 });
    expect(advanceStepClock(100 / STEP_DURATION_MS, 100).progress).toBe(1);
    expect(advanceStepClock(100 / STEP_DURATION_MS, 100).overflowMs).toBeCloseTo(50, 6);
    expect(advanceStepClock(0.5, -20)).toEqual({ progress: 0.5, overflowMs: 0 });
  });
});
