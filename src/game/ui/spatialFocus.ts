/**
 * Moving a menu cursor with the arrow keys, by where things are on screen.
 *
 * The lobby's screens are two columns over a bar, so "next control in the
 * markup" is the wrong answer half the time: Down from the last Pokemon should
 * reach the bar under it, not the insertion list beside it, and Right should
 * cross to the other column rather than step down the one you are in. This
 * picks the nearest control in the direction pressed. It is Phaser- and
 * DOM-free - rectangles in, an index out - so the rule is testable.
 */

export type FocusDirection = 'up' | 'down' | 'left' | 'right';

export interface FocusRect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

const DIRECTION_BY_KEY: Readonly<Record<string, FocusDirection>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

export function focusDirectionForKey(key: string): FocusDirection | undefined {
  return DIRECTION_BY_KEY[key];
}

/** How far apart two spans are along one axis; zero when they overlap. */
const gap = (aStart: number, aEnd: number, bStart: number, bEnd: number): number =>
  Math.max(0, bStart - aEnd, aStart - bEnd);

/**
 * Being out of line costs more than being far away, so the cursor keeps to its
 * column or its row whenever there is anything left in it to reach.
 */
const OFF_AXIS_WEIGHT = 4;

/** Between two controls equally in line, the one more nearly under the cursor wins. */
const CENTRE_WEIGHT = 0.1;

const centre = (start: number, end: number): number => (start + end) / 2;

/**
 * The index of the control the cursor moves to, or `current` when there is
 * nothing that way - a cursor at the edge of a screen stays where it is rather
 * than wrapping to the far side of a layout that is not a simple list.
 */
export function nextFocusIndex(
  rects: readonly FocusRect[],
  current: number,
  direction: FocusDirection,
): number {
  if (rects.length === 0) {
    return -1;
  }
  const from = rects[current];
  if (!from) {
    return 0;
  }

  const vertical = direction === 'up' || direction === 'down';
  let best = current;
  let bestScore = Number.POSITIVE_INFINITY;
  rects.forEach((to, index) => {
    if (index === current) {
      return;
    }
    // A control only counts as "that way" if it starts past where this one ends.
    const ahead =
      direction === 'down'
        ? to.top - from.bottom
        : direction === 'up'
          ? from.top - to.bottom
          : direction === 'right'
            ? to.left - from.right
            : from.left - to.right;
    if (ahead < 0) {
      return;
    }
    const offAxis = vertical
      ? gap(from.left, from.right, to.left, to.right)
      : gap(from.top, from.bottom, to.top, to.bottom);
    const drift = vertical
      ? Math.abs(centre(from.left, from.right) - centre(to.left, to.right))
      : Math.abs(centre(from.top, from.bottom) - centre(to.top, to.bottom));
    const score = ahead + offAxis * OFF_AXIS_WEIGHT + drift * CENTRE_WEIGHT;
    if (score < bestScore) {
      bestScore = score;
      best = index;
    }
  });
  return best;
}
