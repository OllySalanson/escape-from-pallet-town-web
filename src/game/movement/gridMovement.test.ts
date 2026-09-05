import { describe, expect, it } from 'vitest';
import { isWithinBounds, nextTileFromDirection, planNextGridStep } from './gridMovement';

describe('nextTileFromDirection', () => {
  it('returns the adjacent tile in the requested direction', () => {
    expect(nextTileFromDirection({ x: 3, y: 4 }, 'left')).toEqual({ x: 2, y: 4 });
    expect(nextTileFromDirection({ x: 3, y: 4 }, 'up')).toEqual({ x: 3, y: 3 });
  });
});

describe('planNextGridStep', () => {
  it('keeps facing and does not step when there is no input', () => {
    expect(
      planNextGridStep({
        position: { x: 5, y: 5 },
        facing: 'down',
        input: { up: false, down: false, left: false, right: false },
        bounds: { width: 10, height: 10 },
      }),
    ).toEqual({
      facing: 'down',
      target: null,
    });
  });

  it('continues current direction while held, even with other keys pressed', () => {
    expect(
      planNextGridStep({
        position: { x: 5, y: 5 },
        facing: 'right',
        input: { up: true, down: false, left: false, right: true },
        bounds: { width: 10, height: 10 },
      }),
    ).toEqual({
      facing: 'right',
      target: { x: 6, y: 5 },
    });
  });

  it('updates facing but blocks movement when target is out of bounds', () => {
    expect(
      planNextGridStep({
        position: { x: 0, y: 0 },
        facing: 'down',
        input: { up: true, down: false, left: false, right: false },
        bounds: { width: 8, height: 8 },
      }),
    ).toEqual({
      facing: 'up',
      target: null,
    });
  });

  it('prevents stepping onto blocked tiles', () => {
    expect(
      planNextGridStep({
        position: { x: 4, y: 4 },
        facing: 'down',
        input: { up: false, down: false, left: true, right: false },
        bounds: { width: 10, height: 10 },
        isBlocked: (tile) => tile.x === 3 && tile.y === 4,
      }),
    ).toEqual({
      facing: 'left',
      target: null,
    });
  });
});

describe('isWithinBounds', () => {
  it('accepts in-bounds tiles and rejects out-of-bounds tiles', () => {
    expect(isWithinBounds({ x: 2, y: 2 }, { width: 3, height: 3 })).toBe(true);
    expect(isWithinBounds({ x: -1, y: 2 }, { width: 3, height: 3 })).toBe(false);
    expect(isWithinBounds({ x: 3, y: 2 }, { width: 3, height: 3 })).toBe(false);
  });
});
