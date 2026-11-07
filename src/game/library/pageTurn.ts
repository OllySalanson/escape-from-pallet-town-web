/**
 * A page turning over, as a pure function of the time since it was lifted.
 *
 * A turning leaf is a page pivoting about the spine. Seen from above it
 * narrows as it rises - its width is the cosine of the angle it has turned
 * through - until it stands on its edge, then widens again on the far side
 * showing its back. Its outer edge lifts off the book as it goes, more the
 * further from the spine, which is what bends it into a curl rather than a
 * card flipping; and it darkens as it stands up out of the lamp light.
 * `LibraryBookScene` draws a leaf as vertical strips of its page, each placed
 * by `leafStrip`, so the curl is the page's own pixels moved, never a smear.
 */

/** How long one turn takes. Long enough to see the page go over, short enough that reading on is not waited for. */
export const PAGE_TURN_MS = 480;

/** How many strips a leaf is drawn in. */
export const LEAF_STRIPS = 24;

/** How far the outer edge of a leaf lifts off the book at its highest, as a share of the page's height. */
export const LEAF_LIFT = 0.07;

export type TurnDirection = 'forward' | 'back';

export interface LeafPose {
  /** 0 as it is lifted, 1 once it lies flat on the other side. */
  readonly progress: number;
  /** Whether the leaf is over its starting side yet, showing the face it was lifted by. */
  readonly onStartSide: boolean;
  /** How wide the leaf shows, as a share of a page's width: 1 lying flat, 0 on its edge. */
  readonly width: number;
  /** How far it has lifted, 0 to 1. */
  readonly lift: number;
  /** How much darker it is than the page under the lamp, 0 to 1. */
  readonly shade: number;
}

export function leafPose(elapsedMs: number, durationMs: number = PAGE_TURN_MS): LeafPose {
  const t = Math.min(1, Math.max(0, elapsedMs / durationMs));
  // Lifted slowly, quickest standing up, laid down gently.
  const progress = t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
  const angle = progress * Math.PI;
  const lift = Math.sin(angle);
  return {
    progress,
    onStartSide: angle < Math.PI / 2,
    width: Math.abs(Math.cos(angle)),
    lift,
    shade: 0.45 * lift,
  };
}

/** Which side of the spine a turning leaf starts on and ends on. */
export function leafSides(direction: TurnDirection): { readonly start: 'left' | 'right'; readonly end: 'left' | 'right' } {
  return direction === 'forward' ? { start: 'right', end: 'left' } : { start: 'left', end: 'right' };
}

export interface LeafStrip {
  /** The columns of the page's own picture this strip shows. */
  readonly sourceX: number;
  readonly sourceWidth: number;
  /** Where it lands on the screen. */
  readonly x: number;
  readonly width: number;
  /** How far above the page's own top it is drawn, in pixels. */
  readonly rise: number;
  /** How far it is from the spine, 0 at the spine to 1 at the outer edge. */
  readonly reach: number;
}

/**
 * One strip of a leaf, in whole pixels: strip `index` of `LEAF_STRIPS`,
 * counted out from the spine, of a page `pageWidth` wide by `pageHeight` tall
 * lying on `side` of a spine at `spineX`. Nothing is mirrored: a page on the
 * left has its spine edge on its right, so its strips are read from its right.
 */
export function leafStrip(
  pose: LeafPose,
  side: 'left' | 'right',
  index: number,
  spineX: number,
  pageWidth: number,
  pageHeight: number,
  strips: number = LEAF_STRIPS,
): LeafStrip {
  const near = index / strips;
  const far = (index + 1) / strips;
  const nearSource = Math.round(near * pageWidth);
  const farSource = Math.round(far * pageWidth);
  const nearScreen = Math.round(near * pageWidth * pose.width);
  const farScreen = Math.round(far * pageWidth * pose.width);
  const reach = (near + far) / 2;
  const rise = Math.round(pose.lift * LEAF_LIFT * pageHeight * reach * reach);
  return side === 'right'
    ? { sourceX: nearSource, sourceWidth: farSource - nearSource, x: spineX + nearScreen, width: farScreen - nearScreen, rise, reach }
    : {
        sourceX: pageWidth - farSource,
        sourceWidth: farSource - nearSource,
        x: spineX - farScreen,
        width: farScreen - nearScreen,
        rise,
        reach,
      };
}
