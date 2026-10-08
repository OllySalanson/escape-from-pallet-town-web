import { describe, expect, it } from 'vitest';
import {
  detailStepIndex,
  focusDirectionForKey,
  leavingPaneIndex,
  nextFocusIndex,
  type DetailRef,
  type FocusRect,
} from './spatialFocus';

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

describe('a list that scrolls', () => {
  /**
   * A row below a pane's fold reports the position it would have if the pane
   * were as tall as its list, so by rectangles alone the commit bar under the
   * pane is nearer than the next row in it. That is how the loadout screen came
   * to have supplies no arrow key could reach.
   */
  const pane = (top: number): FocusRect => ({ left: 0, top, right: 100, bottom: top + 20, group: 'list' });
  const bar: FocusRect = { left: 0, top: 200, right: 300, bottom: 230 };

  it('keeps a vertical move inside the pane it started in', () => {
    const rects = [pane(0), pane(30), pane(300), bar];

    expect(nextFocusIndex(rects, 1, 'down')).toBe(2);
    expect(nextFocusIndex(rects, 2, 'up')).toBe(1);
  });

  it('leaves the pane once there is nothing ahead in it', () => {
    const rects = [pane(0), pane(30), bar];

    expect(nextFocusIndex(rects, 1, 'down')).toBe(2);
  });

  it('crosses out of a pane sideways, where nothing is hidden by it', () => {
    const rects = [pane(0), { left: 200, top: 0, right: 300, bottom: 20 }];

    expect(nextFocusIndex(rects, 0, 'right')).toBe(1);
  });
});

/**
 * Playtest 32 #5 (and 26 #31): the Pokemon Center, a box in two columns with
 * the pane under it showing whichever row the cursor is on. Down walks the
 * column, each row swaps the pane, so the arrows only ever reached the deeds of
 * the Pokemon at the bottom of a column.
 */
describe('a row and the pane it shows', () => {
  // Charizard and Pidgey on the top row, Kakuna and Rattata under them; the
  // pane is Charizard's: one move listed (it does nothing), then MOVE and TAKE.
  const CHARIZARD = 0;
  const KAKUNA = 2;
  const MOVE_ROW = 4;
  const MOVE_CHIP = 5;
  const TAKE_CHIP = 6;
  const rects: readonly FocusRect[] = [
    { ...rect(8, 40, 140, 26), group: 'list' },
    { ...rect(152, 40, 140, 26), group: 'list' },
    { ...rect(8, 67, 140, 26), group: 'list' },
    { ...rect(152, 67, 140, 26), group: 'list' },
    { ...rect(8, 110, 284, 14), group: 'pane' },
    rect(8, 140, 70, 14),
    rect(82, 140, 70, 14),
  ];
  const refs: readonly DetailRef[] = [
    { shows: 'charizard', actionable: true },
    { shows: 'pidgey', actionable: true },
    { shows: 'kakuna', actionable: true },
    { shows: 'rattata', actionable: true },
    { shows: 'charizard', inPane: 'charizard', actionable: false },
    { shows: 'charizard', inPane: 'charizard', actionable: true },
    { shows: 'charizard', inPane: 'charizard', actionable: true },
  ];

  it('cannot reach a top-row Pokemon\'s deeds by arrow key alone', () => {
    expect(nextFocusIndex(rects, CHARIZARD, 'down')).toBe(KAKUNA);
  });

  it('steps from any row into its own pane with Tab, onto the first thing that does something', () => {
    expect(detailStepIndex(refs, CHARIZARD)).toBe(MOVE_CHIP);
    expect(detailStepIndex(refs, TAKE_CHIP)).toBe(CHARIZARD);
    expect(detailStepIndex(refs, MOVE_ROW)).toBe(CHARIZARD);
  });

  it('goes back up to the row it came from, not the row nearest above the pane', () => {
    const spatial = nextFocusIndex(rects, MOVE_ROW, 'up');
    expect(spatial).toBe(KAKUNA);
    expect(leavingPaneIndex(refs, MOVE_ROW, spatial)).toBe(CHARIZARD);
    // Inside the pane the arrows are the spatial rule's.
    expect(leavingPaneIndex(refs, TAKE_CHIP, MOVE_CHIP)).toBe(MOVE_CHIP);
  });

  it('leaves the key alone where there is no pane to step into', () => {
    expect(detailStepIndex([{ actionable: true }], 0)).toBeUndefined();
    expect(detailStepIndex([{ shows: 'potion', actionable: true }], 0)).toBeUndefined();
  });
});
