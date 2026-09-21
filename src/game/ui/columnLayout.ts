/**
 * How a list fills the width it has been given.
 *
 * The screens are laid out against the browser window (`display/menuStage.ts`),
 * but that only bought them *room*: every body was still one column down the
 * middle, so a wide window held a tall thin list with a scroll wheel on it and
 * a hand's breadth of nothing either side. A collection of twenty things on a
 * wide screen is a grid, not a column of twenty - which is what every inventory
 * screen worth reading does, from a PC box to a stash.
 *
 * Two rules decide the shape, and this module is both of them.
 *
 * - **The count follows the room.** A list says the narrowest a column of it
 *   may be - its *measure*, the width at which its rows still read - and takes
 *   as many of those as fit. The same screen is therefore one column at 640x480
 *   and four at 4K with nothing authored per size, and a single column is still
 *   the right answer in a narrow window rather than a failure to have columns.
 * - **Every track is a whole number of game pixels.** `repeat(n, 1fr)` divides
 *   the room by n and lands on fractions of a pixel at most widths, which on
 *   these screens is a one-pixel frame drawn soft and a 16-pixel icon resampled.
 *   So the tracks are counted out here instead: the room left over after the
 *   gaps is shared out a whole pixel at a time, the first few tracks taking the
 *   remainder, and they add up to exactly the width they were given.
 *
 * It is DOM-free - numbers in, numbers out - so the rule is tested rather than
 * eyeballed; `ui/MenuOverlay.ts` is what measures a pane and writes the tracks.
 */

export interface ColumnPlan {
  /** How many columns the room holds. Never less than one. */
  readonly columns: number;
  /**
   * The width of each column in game pixels, left to right. They and the gaps
   * between them add up to the room given, so nothing is left ragged at the
   * right - except where `maximum` caps them, which is a deliberate centring.
   */
  readonly tracks: readonly number[];
}

export interface ColumnRules {
  /** The narrowest a column may be before the list drops one, in game pixels. */
  readonly measure: number;
  /** Game pixels between two columns. */
  readonly gap: number;
  /** A ceiling on the count: three starter cards are three at any width. */
  readonly maximum?: number;
  /** A ceiling on a column's width, for a list of cards rather than of rows. */
  readonly widest?: number;
}

/**
 * The tracks a pane of `available` game pixels should be laid out in.
 *
 * A measure of zero or less would divide the room infinitely, so it is treated
 * as one column: a list with no stated measure is a list that did not ask.
 */
export function planColumns(available: number, rules: ColumnRules): ColumnPlan {
  const room = Math.max(0, Math.floor(available));
  const gap = Math.max(0, Math.floor(rules.gap));
  const measure = Math.floor(rules.measure);
  const ceiling = Math.max(1, Math.floor(rules.maximum ?? Number.MAX_SAFE_INTEGER));
  const columns =
    measure <= 0 ? 1 : Math.max(1, Math.min(ceiling, Math.floor((room + gap) / (measure + gap))));
  const content = Math.max(0, room - gap * (columns - 1));
  const even = Math.floor(content / columns);
  const widest = rules.widest === undefined ? even : Math.min(even, Math.floor(rules.widest));
  // Only a list with no ceiling on its width takes up the remainder; one that
  // has a ceiling is a row of cards, and cards are centred in what is left.
  const spare = widest === even ? content - even * columns : 0;
  return {
    columns,
    tracks: Array.from({ length: columns }, (_, index) => widest + (index < spare ? 1 : 0)),
  };
}

/** The plan written the way `grid-template-columns` wants it, in CSS pixels. */
export function columnTracks(plan: ColumnPlan, unit: number): string {
  return plan.tracks.map((track) => `${track * unit}px`).join(' ');
}

/**
 * How much room a screen has, as a word the stylesheet can key off.
 *
 * Columns answer "how wide is this list"; this answers the one question they
 * cannot - whether a *layout* fits at all. The stash's detail pane is the case
 * that needs it: on the windows this game is played in it stands across the
 * pane in five blocks under the list, and on a small screen those five blocks
 * stacked would be the whole of it and leave the list they belong to nothing.
 * There it is the four lines that say which Pokemon this is and how it is,
 * with the rest a scroll away.
 *
 * Both dimensions, because both can run out. The width is what it takes for
 * the band's five blocks to stand on one line inside the window that holds the
 * list - measured off them rather than chosen, which is why it is not a round
 * number - and the height is what it takes for that band and a list worth
 * having to share a screen. A window narrower or shorter than either wraps the
 * band onto a second line and cuts it through the middle, which is worse than
 * the four-line band it falls back to.
 *
 * **Tight** is the floor under that, and it is `BASE_STAGE` itself: a screen
 * where a list, the band that answers for the row it is on, *and* a second band
 * under that cannot share a pane at all. Bill's shelf is the layout
 * that runs out - a list of stock, the pane that prices the pointed-at row and
 * the berth along the bottom - and at 320x240 a band sized for a laptop left
 * the list with no rows in it and pushed the berth off the screen. A tight
 * screen therefore gets the shallowest band of the three, and everything that
 * will not fit in it is the scroll its MORE strip announces. The numbers are
 * measured off that pane rather than chosen: below 420 across, a priced row's
 * two columns stop reading, and below 300 down there is nothing left for a
 * list once a title, a help bar, a heading, a band and a berth have been paid.
 */
export const WIDE_MENU_WIDTH = 820;
export const WIDE_MENU_HEIGHT = 370;
export const TIGHT_MENU_WIDTH = 420;
export const TIGHT_MENU_HEIGHT = 300;

export type MenuRoom = 'tight' | 'narrow' | 'wide';

export function roomFor(gamePixelsWide: number, gamePixelsHigh: number): MenuRoom {
  if (gamePixelsWide >= WIDE_MENU_WIDTH && gamePixelsHigh >= WIDE_MENU_HEIGHT) {
    return 'wide';
  }
  return gamePixelsWide >= TIGHT_MENU_WIDTH && gamePixelsHigh >= TIGHT_MENU_HEIGHT
    ? 'narrow'
    : 'tight';
}
