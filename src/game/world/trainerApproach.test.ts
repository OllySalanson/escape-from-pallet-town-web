import { describe, expect, it } from 'vitest';
import { planTrainerApproach } from './trainerApproach';

describe('the ground a watch closes over', () => {
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
});
