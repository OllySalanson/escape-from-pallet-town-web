import { describe, expect, it } from 'vitest';
import { VIEW_INSET, placeCaption, type Rect } from './labelPlacement';

/** The base screen: the smallest view any caption has to survive. */
const VIEW: Rect = { x: 0, y: 0, width: 320, height: 240 };
/** Roughly the raid clock, in the corner it always takes. */
const CLOCK: Rect = { x: 264, y: 4, width: 52, height: 16 };

const caption = (overrides: Partial<Parameters<typeof placeCaption>[0]> = {}) =>
  placeCaption({
    anchorX: 160,
    anchorY: 120,
    width: 60,
    height: 14,
    preferred: 'above',
    bounds: VIEW,
    obstacles: [],
    ...overrides,
  });

const rectOf = (placement: { x: number; y: number }, width = 60, height = 14): Rect => ({
  x: placement.x,
  y: placement.y,
  width,
  height,
});

const inside = (rect: Rect, bounds: Rect): boolean =>
  rect.x >= bounds.x &&
  rect.y >= bounds.y &&
  rect.x + rect.width <= bounds.x + bounds.width &&
  rect.y + rect.height <= bounds.y + bounds.height;

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe('where a map caption is allowed to sit', () => {
  it('hangs on its anchor when there is room, on the side it prefers', () => {
    expect(caption()).toEqual({ x: 130, y: 106, side: 'above' });
    expect(caption({ preferred: 'below' })).toEqual({ x: 130, y: 120, side: 'below' });
  });

  it('slides along its row rather than running off either edge of the view', () => {
    const east = caption({ anchorX: 318 });
    const west = caption({ anchorX: 2 });

    expect(inside(rectOf(east), VIEW)).toBe(true);
    expect(inside(rectOf(west), VIEW)).toBe(true);
    expect(east.x).toBe(VIEW.width - VIEW_INSET - 60);
    expect(west.x).toBe(VIEW_INSET);
  });

  it('stays inside the view on a scrolled camera, not inside an assumed origin', () => {
    const scrolled: Rect = { x: 448, y: 96, width: 320, height: 240 };

    const placement = caption({ anchorX: 766, anchorY: 100, bounds: scrolled });

    expect(inside(rectOf(placement), scrolled)).toBe(true);
  });

  it('is kept inside the view vertically too, not just along its row', () => {
    const high = caption({ anchorY: 2 });
    const low = caption({ anchorY: 239, preferred: 'below' });

    expect(inside(rectOf(high), VIEW)).toBe(true);
    expect(inside(rectOf(low), VIEW)).toBe(true);
  });

  it('flips to the other side of its anchor rather than slide under a HUD chip', () => {
    // A landmark in the top-right corner: captioned above, it lands under the
    // raid clock and is simply unreadable there.
    const placement = caption({ anchorX: 300, anchorY: 24, obstacles: [CLOCK] });

    expect(placement.side).toBe('below');
    expect(overlaps(rectOf(placement), CLOCK)).toBe(false);
  });

  it('keeps the authored side when flipping would gain nothing', () => {
    // A trainer watching north is captioned south of themselves so the caption
    // never covers the watched lane. Nothing here is in the way, so it stays.
    expect(caption({ preferred: 'below', obstacles: [CLOCK] }).side).toBe('below');
    expect(caption({ obstacles: [CLOCK] }).side).toBe('above');
  });

  it('takes the lesser evil when a caption cannot avoid the HUD on either side', () => {
    const wall: Rect = { x: 0, y: 0, width: 320, height: 40 };

    const placement = caption({ anchorX: 160, anchorY: 30, obstacles: [wall] });

    // Above the anchor is entirely inside the chip; below it, only the top ten
    // rows are. It goes below rather than being left where it was authored.
    expect(placement.side).toBe('below');
    expect(inside(rectOf(placement), VIEW)).toBe(true);
  });

  it('centres a caption too wide for the view instead of picking an edge to lose', () => {
    const placement = caption({ anchorX: 300, width: 400 });

    expect(placement.x).toBe(Math.round((VIEW.width - 400) / 2));
  });

  it('rounds to whole pixels, because a half-pixel caption is a blurred caption', () => {
    const placement = caption({ anchorX: 160.5, width: 61, height: 15 });

    expect(Number.isInteger(placement.x)).toBe(true);
    expect(Number.isInteger(placement.y)).toBe(true);
  });

  it('lets a caption leave with the landmark it names', () => {
    // Pinned to the edge instead, the bottom of the view fills up with captions
    // for things that are no longer on screen.
    const below = caption({ anchorX: 160, anchorY: 400 });
    const east = caption({ anchorX: 900, anchorY: 120 });

    expect(below.y).toBe(400 - 14);
    expect(east.x).toBe(900 - 30);
  });
});
