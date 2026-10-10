import { describe, expect, it } from 'vitest';
import { curedLine } from '../items';
import { PrimaryStatus } from '../pokemon/battle/status';
import { boulderDestination, canStillReach } from './boulders';

describe('pushing a boulder', () => {
  it('moves it one tile the way the player is facing', () => {
    expect(boulderDestination({ x: 5, y: 5 }, 'left')).toEqual({ x: 4, y: 5 });
    expect(boulderDestination({ x: 5, y: 5 }, 'down')).toEqual({ x: 5, y: 6 });
  });

  it('is refused where it would shut the player off from every way out', () => {
    // A corridor three tiles long with the exit at its far end: a boulder
    // pushed into the middle of it is the whole way out gone.
    const size = { width: 5, height: 1 };
    const exit = [{ x: 4, y: 0 }];
    const open = (tile: { x: number }) => tile.x === 2;
    expect(canStillReach({ x: 0, y: 0 }, exit, size, () => false)).toBe(true);
    expect(canStillReach({ x: 0, y: 0 }, exit, size, open)).toBe(false);
    // Nothing to reach is never a reason to refuse.
    expect(canStillReach({ x: 0, y: 0 }, [], size, open)).toBe(true);
    // And a doorway is a way round: through a building to the far side.
    expect(
      canStillReach({ x: 0, y: 0 }, exit, size, open, [
        { source: { x: 1, y: 0 }, destination: { x: 3, y: 0 } },
      ]),
    ).toBe(true);
  });
});

describe('a cure', () => {
  it("is said in FireRed's own words for each status a berry can cure", () => {
    expect(curedLine('PIKACHU', PrimaryStatus.Poison)).toBe('PIKACHU was cured of poison!');
    expect(curedLine('PIKACHU', PrimaryStatus.Paralysis)).toBe('PIKACHU was cured of paralysis!');
    expect(curedLine('PIKACHU', PrimaryStatus.Burn)).toBe("PIKACHU's burn was healed!");
    expect(curedLine('PIKACHU', PrimaryStatus.Sleep)).toBe('PIKACHU woke up!');
    expect(curedLine('PIKACHU', PrimaryStatus.Freeze)).toBe('PIKACHU was thawed out!');
  });
});
