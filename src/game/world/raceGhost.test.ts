import { describe, expect, it } from 'vitest';
import { ghostPlace, readTrail, trailTime, trailWith } from './raceGhost';

describe('the best run, raced again', () => {
  const trail = [10, 10, 0, 11, 10, 150, 11, 11, 300, 11, 12, 900];

  it('keeps a tile once, when it was arrived on', () => {
    let kept = trailWith([], { x: 10, y: 10 }, 0);
    kept = trailWith(kept, { x: 10, y: 10 }, 40);
    kept = trailWith(kept, { x: 11, y: 10 }, 150);
    expect(kept).toEqual([10, 10, 0, 11, 10, 150]);
  });

  it('walks each step over the step before its arrival, and stands between', () => {
    expect(ghostPlace(trail, 0)).toMatchObject({ x: 10, y: 10, stepping: true });
    expect(ghostPlace(trail, 75)).toMatchObject({ x: 10.5, y: 10, facing: 'right', stepping: true });
    expect(ghostPlace(trail, 400)).toMatchObject({ x: 11, y: 11, stepping: false, facing: 'down' });
    expect(ghostPlace(trail, 825)).toMatchObject({ x: 11, y: 11.5, stepping: true });
  });

  it('is over the line at its last arrival, which is its time', () => {
    expect(ghostPlace(trail, 900)).toMatchObject({ x: 11, y: 12, done: true });
    expect(trailTime(trail)).toBe(900);
  });

  it('reads back from a save only whole, in time order', () => {
    expect(readTrail(trail)).toEqual(trail);
    expect(readTrail([1, 2])).toBeUndefined();
    expect(readTrail([1, 2, 0, 3, 4, -1])).toBeUndefined();
    expect(readTrail([1, 2, 500, 3, 4, 100])).toBeUndefined();
    expect(readTrail('no')).toBeUndefined();
  });
});
