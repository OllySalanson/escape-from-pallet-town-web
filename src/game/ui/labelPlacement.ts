/**
 * Where a map caption is allowed to sit.
 *
 * A caption belongs to a thing in the world but is read on a screen, and the
 * screen already has tenants: the raid HUD owns the top corners, and the view
 * has four edges. Left to hang wherever its landmark happens to be, a caption
 * ran off the right of the screen and slid underneath the raid clock, where it
 * was simply unreadable.
 *
 * This is that rule, once, as arithmetic: slide along the row to stay inside
 * the view, and hang on whichever side of the anchor is actually clear. It is
 * Phaser-free so the rule is testable rather than eyeballed, in the manner of
 * `raidHud.ts` and `battlePresentation.ts`.
 */

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Which side of its anchor a caption hangs on. */
export type CaptionSide = 'above' | 'below';

export interface CaptionRequest {
  /** Centre of the thing being named. */
  readonly anchorX: number;
  /** The row the caption hangs from: its bottom above, its top below. */
  readonly anchorY: number;
  readonly width: number;
  readonly height: number;
  /**
   * The side the caption is authored to prefer. A trainer watching north is
   * captioned below themselves so the caption never covers the watched lane.
   */
  readonly preferred: CaptionSide;
  /** The camera view, in the same space as the anchor. */
  readonly bounds: Rect;
  /** Screen furniture the caption may not slide under, in the same space. */
  readonly obstacles: readonly Rect[];
}

export interface CaptionPlacement {
  /** Top-left of the caption window. */
  readonly x: number;
  readonly y: number;
  readonly side: CaptionSide;
}

/** Kept off the very edge so a slid caption still reads as a window. */
export const VIEW_INSET = 3;

const overlap = (a: Rect, b: Rect): number => {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return width > 0 && height > 0 ? width * height : 0;
};

const other = (side: CaptionSide): CaptionSide => (side === 'above' ? 'below' : 'above');

const contains = (bounds: Rect, x: number, y: number): boolean =>
  x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height;

/**
 * How much of a caption is somewhere it should not be: over screen furniture,
 * or outside the view. Both are counted in pixels of the caption's own area, so
 * the two failures are comparable and the better of two bad sides can be picked
 * rather than the authored one being kept out of principle.
 */
function intrusion(rect: Rect, bounds: Rect, obstacles: readonly Rect[]): number {
  const inside = overlap(rect, bounds);
  const outside = rect.width * rect.height - inside;
  return obstacles.reduce((total, obstacle) => total + overlap(rect, obstacle), outside);
}

export function placeCaption(request: CaptionRequest): CaptionPlacement {
  const { anchorX, anchorY, width, height, preferred, bounds, obstacles } = request;

  // A caption belongs to something on the map. Once that thing has scrolled off
  // the screen the caption goes with it: dragging it back to the edge would pin
  // a row of captions along the bottom of the view naming landmarks the player
  // cannot see.
  if (!contains(bounds, anchorX, anchorY)) {
    return {
      x: Math.round(anchorX - width / 2),
      y: Math.round(preferred === 'above' ? anchorY - height : anchorY),
      side: preferred,
    };
  }

  // Horizontal first: the row a caption sits on is decided by what it names, so
  // sliding along it is always cheaper than moving it off its landmark.
  const minimum = bounds.x + VIEW_INSET;
  const maximum = bounds.x + bounds.width - VIEW_INSET - width;
  const wanted = Math.round(anchorX - width / 2);
  const x =
    maximum < minimum
      ? Math.round(bounds.x + (bounds.width - width) / 2)
      : Math.min(Math.max(wanted, minimum), maximum);

  const topFor = (side: CaptionSide): number =>
    side === 'above' ? anchorY - height : anchorY;

  const candidates = [preferred, other(preferred)].map((side) => {
    const y = clampIntoRow(topFor(side), height, bounds);
    return { side, y, cost: intrusion({ x, y, width, height }, bounds, obstacles) };
  });

  // A tie keeps the authored side: flipping a caption that gains nothing by it
  // only makes captions jitter as the camera moves.
  const best = candidates[1].cost < candidates[0].cost ? candidates[1] : candidates[0];
  return { x, y: best.y, side: best.side };
}

/** Keeps a caption inside the view vertically, the way it already is horizontally. */
function clampIntoRow(top: number, height: number, bounds: Rect): number {
  const minimum = bounds.y + VIEW_INSET;
  const maximum = bounds.y + bounds.height - VIEW_INSET - height;
  return maximum < minimum ? Math.round(bounds.y + (bounds.height - height) / 2)
    : Math.min(Math.max(Math.round(top), minimum), maximum);
}
