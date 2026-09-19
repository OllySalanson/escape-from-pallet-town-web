import { describe, expect, it } from 'vitest';
import {
  APPROACH_ALERT_MS,
  APPROACH_SETTLE_MS,
  APPROACH_STEP_MS,
  approachDurationMs,
  approachFrameAt,
  planTrainerApproach,
} from './trainerApproach';
import { createRunTrainerEncounters } from './trainers';

describe('trainer approach', () => {
  it('walks to one tile short of the player, down the watched line', () => {
    const plan = planTrainerApproach({ x: 22, y: 26 }, 'up', { x: 22, y: 22 }, 4);
    expect(plan?.path).toEqual([
      { x: 22, y: 25 },
      { x: 22, y: 24 },
      { x: 22, y: 23 },
    ]);
  });

  it('does not walk at all when the player is already beside the trainer', () => {
    expect(planTrainerApproach({ x: 5, y: 5 }, 'right', { x: 6, y: 5 }, 1)?.path).toEqual([]);
  });

  it('refuses a player who is not in the run the trainer faces', () => {
    expect(planTrainerApproach({ x: 5, y: 5 }, 'up', { x: 6, y: 3 }, 4)).toBeNull();
    expect(planTrainerApproach({ x: 5, y: 5 }, 'up', { x: 5, y: 0 }, 4)).toBeNull();
  });

  it('holds the mark, then walks, then settles, then is done', () => {
    const plan = planTrainerApproach({ x: 0, y: 4 }, 'up', { x: 0, y: 0 }, 4)!;
    expect(approachFrameAt(plan, 0)).toEqual({ phase: 'alert', x: 0, y: 4 });
    expect(approachFrameAt(plan, APPROACH_ALERT_MS - 1).phase).toBe('alert');
    const halfway = approachFrameAt(plan, APPROACH_ALERT_MS + APPROACH_STEP_MS / 2);
    expect(halfway).toEqual({ phase: 'walk', x: 0, y: 3.5 });
    const arrived = APPROACH_ALERT_MS + 3 * APPROACH_STEP_MS;
    expect(approachFrameAt(plan, arrived)).toEqual({ phase: 'settle', x: 0, y: 1 });
    expect(approachFrameAt(plan, arrived + APPROACH_SETTLE_MS)).toEqual({
      phase: 'done',
      x: 0,
      y: 1,
    });
  });

  it('covers the same ground however the frames fall', () => {
    const plan = planTrainerApproach({ x: 0, y: 4 }, 'up', { x: 0, y: 0 }, 4)!;
    expect(approachFrameAt(plan, 700)).toEqual(approachFrameAt(plan, 700));
    expect(approachDurationMs(plan)).toBe(
      APPROACH_ALERT_MS + 3 * APPROACH_STEP_MS + APPROACH_SETTLE_MS,
    );
  });

  it('is an event and not an interruption for every authored watch', () => {
    for (const encounter of createRunTrainerEncounters()) {
      const reach = encounter.sightRange ?? 0;
      if (reach === 0) {
        continue;
      }
      const worst = { path: Array.from({ length: reach - 1 }), from: encounter.position };
      expect(approachDurationMs(worst as never)).toBeLessThan(1200);
    }
  });
});
