import { describe, expect, it } from 'vitest';
import { focusDirectionForKey, nextFocusIndex, type FocusRect } from './spatialFocus';

const rect = (left: number, top: number, width: number, height: number): FocusRect => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
});

/**
 * The loadout screen, in game pixels: a back button in the title bar, three
 * rows down the left column, two down the right, and two buttons in the bar.
 */
const BACK = 0;
const LEFT_ROWS = [1, 2, 3];
const RIGHT_ROWS = [4, 5];
const SECURE = 6;
const ADVANCE = 7;
const LOADOUT: readonly FocusRect[] = [
  rect(4, 2, 36, 12),
  rect(8, 40, 160, 26),
  rect(8, 67, 160, 26),
  rect(8, 94, 160, 26),
  rect(188, 40, 124, 26),
  rect(188, 67, 124, 26),
  rect(150, 170, 70, 16),
  rect(224, 170, 88, 16),
];

describe('nextFocusIndex', () => {
  it('walks down a column one row at a time', () => {
    expect(nextFocusIndex(LOADOUT, LEFT_ROWS[0], 'down')).toBe(LEFT_ROWS[1]);
    expect(nextFocusIndex(LOADOUT, LEFT_ROWS[1], 'down')).toBe(LEFT_ROWS[2]);
    expect(nextFocusIndex(LOADOUT, LEFT_ROWS[2], 'up')).toBe(LEFT_ROWS[1]);
  });

  it('crosses to the other column instead of stepping down the one it is in', () => {
    expect(nextFocusIndex(LOADOUT, LEFT_ROWS[1], 'right')).toBe(RIGHT_ROWS[1]);
    expect(nextFocusIndex(LOADOUT, RIGHT_ROWS[0], 'left')).toBe(LEFT_ROWS[0]);
  });

  it('reaches the bar from the bottom of either column, under where the cursor was', () => {
    expect(nextFocusIndex(LOADOUT, LEFT_ROWS[2], 'down')).toBe(SECURE);
    expect(nextFocusIndex(LOADOUT, RIGHT_ROWS[1], 'down')).toBe(ADVANCE);
    expect(nextFocusIndex(LOADOUT, SECURE, 'right')).toBe(ADVANCE);
  });

  it('reaches the way back from the top of the screen, and only from there', () => {
    expect(nextFocusIndex(LOADOUT, LEFT_ROWS[0], 'up')).toBe(BACK);
    expect(nextFocusIndex(LOADOUT, BACK, 'down')).toBe(LEFT_ROWS[0]);
  });

  it('stays put at an edge rather than wrapping across a layout that is not a list', () => {
    expect(nextFocusIndex(LOADOUT, ADVANCE, 'down')).toBe(ADVANCE);
    expect(nextFocusIndex(LOADOUT, BACK, 'up')).toBe(BACK);
    expect(nextFocusIndex(LOADOUT, LEFT_ROWS[0], 'left')).toBe(LEFT_ROWS[0]);
  });

  it('starts on the first control when nothing has the cursor yet', () => {
    expect(nextFocusIndex(LOADOUT, -1, 'down')).toBe(0);
    expect(nextFocusIndex([], -1, 'down')).toBe(-1);
  });
});

describe('focusDirectionForKey', () => {
  it('only answers to the arrow keys', () => {
    expect(focusDirectionForKey('ArrowLeft')).toBe('left');
    expect(focusDirectionForKey('Enter')).toBeUndefined();
  });
});
