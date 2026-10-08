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
  /**
   * Which scrolling pane this control lives in, if any.
   *
   * A pane that scrolls tells lies about where its contents are: a row below
   * the fold still reports the position it would have if the pane were as tall
   * as its list, which is somewhere past the bottom of the screen. So Down from
   * the last row you can see picked the commit bar under the pane, and the row
   * that was actually next - one pixel below, just clipped - was unreachable by
   * arrow key. On the loadout screen that meant the Poké Balls could not be
   * packed without a mouse.
   *
   * The fix is to keep a vertical move inside the pane it started in while that
   * pane still has anything ahead in it, which is also what a player means by
   * Down in a list. Across panes, and in every horizontal move, the rectangles
   * are the whole rule as before.
   */
  readonly group?: string;
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

/** How far past the end of `from` the start of `to` is, in the direction pressed. */
function aheadBy(from: FocusRect, to: FocusRect, direction: FocusDirection): number {
  switch (direction) {
    case 'down':
      return to.top - from.bottom;
    case 'up':
      return from.top - to.bottom;
    case 'right':
      return to.left - from.right;
    case 'left':
      return from.left - to.right;
  }
}

/** A control counts as "that way" only if it starts past where this one ends. */
const isAhead = (from: FocusRect, to: FocusRect, direction: FocusDirection): boolean =>
  aheadBy(from, to, direction) >= 0;

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
  // Walking out of a scrolling pane is only allowed once there is nothing left
  // in it that way; see `FocusRect.group`.
  const stayInGroup =
    vertical &&
    from.group !== undefined &&
    rects.some((to, index) => index !== current && to.group === from.group && isAhead(from, to, direction));
  let best = current;
  let bestScore = Number.POSITIVE_INFINITY;
  rects.forEach((to, index) => {
    if (index === current) {
      return;
    }
    if (stayInGroup && to.group !== from.group) {
      return;
    }
    const ahead = aheadBy(from, to, direction);
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

/**
 * What one control is to the detail panes of its screen: the pane it answers
 * for (`data-shows`), the pane it stands in (`data-shown-by`), and whether it
 * does anything when pressed.
 */
export interface DetailRef {
  readonly shows?: string;
  readonly inPane?: string;
  readonly actionable: boolean;
}

/**
 * Where Tab takes the cursor: from a row into the pane it is showing, and from
 * inside a pane back to the row it answers for. Undefined when there is no such
 * place, so the key is left alone.
 *
 * A row's deeds - a Pokemon's Move, Take and Give - live in the pane under the
 * list, and the arrow keys walk the list by where things are: Down from a row
 * reaches the row below it, and only the last row of a column has the pane
 * below it. Every row the cursor crosses swaps the pane, so the arrows could
 * only ever reach the deeds of the Pokemon at the bottom of a column. Tab is
 * the way in for any row; it lands on the first thing in the pane that does
 * something, and the moves listed above the deeds stay one Up away.
 */
export function detailStepIndex(controls: readonly DetailRef[], current: number): number | undefined {
  const from = controls[current];
  if (!from) {
    return undefined;
  }
  if (from.inPane !== undefined) {
    const owner = paneOwnerIndex(controls, from.inPane);
    return owner < 0 ? undefined : owner;
  }
  if (from.shows === undefined) {
    return undefined;
  }
  const inside = controls.flatMap((control, index) => (control.inPane === from.shows ? [index] : []));
  const target = inside.find((index) => controls[index].actionable) ?? inside[0];
  return target;
}

/**
 * Where an arrow key that leaves a pane goes: back to the row the pane answers
 * for, rather than to whichever row happens to sit nearest above it - which
 * swaps the pane for another Pokemon's and loses the one Tab came in from.
 * `next` is where the spatial rule would have gone, and is kept whenever the
 * move stays in the pane or the pane has no row on this screen.
 */
export function leavingPaneIndex(controls: readonly DetailRef[], current: number, next: number): number {
  const pane = controls[current]?.inPane;
  if (pane === undefined || next === current || controls[next]?.inPane === pane) {
    return next;
  }
  const owner = paneOwnerIndex(controls, pane);
  return owner < 0 ? next : owner;
}

function paneOwnerIndex(controls: readonly DetailRef[], pane: string): number {
  return controls.findIndex((control) => control.inPane === undefined && control.shows === pane);
}
