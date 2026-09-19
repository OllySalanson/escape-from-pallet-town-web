import { describe, expect, it } from 'vitest';
import {
  NEIGHBOUR_GAP,
  SUBJECT_GAP,
  VIEW_INSET,
  placeCaptions,
  type CaptionRequest,
  type CaptionSurroundings,
  type Rect,
} from './labelPlacement';

/** The base screen: the smallest view any caption has to survive. */
const VIEW: Rect = { x: 0, y: 0, width: 320, height: 240 };
/** Roughly the raid clock, in the corner it always takes. */
const CLOCK: Rect = { x: 264, y: 4, width: 52, height: 16 };
const TILE = 16;

const tile = (x: number, y: number): Rect => ({ x, y, width: TILE, height: TILE });

const request = (overrides: Partial<CaptionRequest> = {}): CaptionRequest => ({
  subject: tile(152, 112),
  width: 60,
  height: 14,
  preferred: 'above',
  ...overrides,
});

const around = (overrides: Partial<CaptionSurroundings> = {}): CaptionSurroundings => ({
  bounds: VIEW,
  furniture: [],
  keepClear: [],
  ...overrides,
});

const seat = (one: Partial<CaptionRequest> = {}, surroundings: Partial<CaptionSurroundings> = {}) =>
  placeCaptions([request(one)], around(surroundings))[0];

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

const grown = (rect: Rect, by: number): Rect => ({
  x: rect.x - by,
  y: rect.y - by,
  width: rect.width + by * 2,
  height: rect.height + by * 2,
});

describe('where a map caption is allowed to sit', () => {
  it('sits centred over what it names, a gap clear of it, on the side it prefers', () => {
    expect(seat()).toMatchObject({ x: 130, y: 112 - SUBJECT_GAP - 14, seat: 'above', visible: true });
    expect(seat({ preferred: 'below' })).toMatchObject({
      x: 130,
      y: 128 + SUBJECT_GAP,
      seat: 'below',
    });
  });

  it('slides along its row rather than running off either edge of the view', () => {
    const east = seat({ subject: tile(302, 112) });
    const west = seat({ subject: tile(0, 112) });

    expect(east).toMatchObject({ seat: 'above', x: VIEW.width - VIEW_INSET - 60 });
    expect(west).toMatchObject({ seat: 'above', x: VIEW_INSET });
  });

  it('stays inside the view on a scrolled camera, not inside an assumed origin', () => {
    const scrolled: Rect = { x: 448, y: 96, width: 320, height: 240 };

    const placement = seat({ subject: tile(750, 100) }, { bounds: scrolled });

    expect(placement.visible).toBe(true);
    expect(inside(rectOf(placement), scrolled)).toBe(true);
  });

  it('moves to the other side rather than slide under a HUD chip, or show a sliver beside one', () => {
    // A landmark in the top-right corner: captioned above, it lands under the
    // raid clock and is simply unreadable there.
    const placement = seat({ subject: tile(292, 24) }, { furniture: [CLOCK] });

    expect(placement.seat).toBe('below');
    expect(overlaps(rectOf(placement), grown(CLOCK, NEIGHBOUR_GAP))).toBe(false);
  });

  it('keeps the authored side when moving would gain nothing', () => {
    // A trainer watching north is captioned south of themselves so the caption
    // never covers the watched lane. Nothing here is in the way, so it stays.
    expect(seat({ preferred: 'below' }, { furniture: [CLOCK] }).seat).toBe('below');
    expect(seat({}, { furniture: [CLOCK] }).seat).toBe('above');
  });

  it('never covers what it names, or what its neighbour names', () => {
    // The Floodplain's first screen: the ranger station, and the exit it opens
    // one tile down and to the right. The exit's caption used to sit on the
    // station, flush under the station's own caption.
    const station = request({ subject: tile(160, 64), width: 76, height: 26 });
    const exit = request({ subject: tile(176, 80), width: 140, height: 14 });

    const placements = placeCaptions([station, exit], around());
    const [stationRect, exitRect] = [
      rectOf(placements[0], 76, 26),
      rectOf(placements[1], 140, 14),
    ];

    expect(placements.every((placement) => placement.visible)).toBe(true);
    for (const caption of [stationRect, exitRect]) {
      expect(overlaps(caption, station.subject)).toBe(false);
      expect(overlaps(caption, exit.subject)).toBe(false);
    }
    expect(overlaps(stationRect, grown(exitRect, NEIGHBOUR_GAP))).toBe(false);
  });

  it('never covers map art or a person that has no caption of its own', () => {
    // A cache whose caption, hung above it, would cover the warning sign there.
    const sign = tile(152, 92);
    const figure: Rect = { x: 152, y: 131, width: 16, height: 23 };

    const placement = seat({}, { keepClear: [sign, figure] });

    expect(placement.visible).toBe(true);
    expect(overlaps(rectOf(placement), sign)).toBe(false);
    expect(overlaps(rectOf(placement), figure)).toBe(false);
  });

  it('is never drawn cut by the edge of the screen, wherever the camera is', () => {
    const subject = tile(400, 300);
    for (let x = 60; x <= 420; x += 7) {
      for (let y = 40; y <= 320; y += 7) {
        const bounds: Rect = { x, y, width: 320, height: 240 };
        const placement = seat({ subject }, { bounds });
        if (placement.visible) {
          expect(inside(rectOf(placement), bounds)).toBe(true);
          expect(overlaps(rectOf(placement), subject)).toBe(false);
        }
      }
    }
  });

  it('leaves with the landmark it names', () => {
    // Pinned to the edge instead, the view fills up with captions for things
    // that are no longer on screen.
    expect(seat({ subject: tile(152, 400) }).visible).toBe(false);
    expect(seat({ subject: tile(900, 112) }).visible).toBe(false);
  });

  it('is not drawn at all when nowhere around its subject is clear', () => {
    const wall: Rect = { x: 0, y: 0, width: 320, height: 240 };

    expect(seat({}, { furniture: [wall] }).visible).toBe(false);
    expect(seat({ width: 400 }).visible).toBe(false);
  });

  it('keeps the seat it holds while that seat is clear, so a walking camera cannot make it flicker', () => {
    const below = seat({ subject: tile(292, 24) }, { furniture: [CLOCK] });
    expect(below.seat).toBe('below');

    // The chip is gone, so above is clear again - and it stays where it is.
    expect(seat({ subject: tile(292, 24), held: below.candidate }).seat).toBe('below');
    // Once the held seat is blocked it moves like any other caption.
    const blocked = seat(
      { subject: tile(292, 24), held: below.candidate },
      { keepClear: [rectOf(below)] },
    );
    expect(blocked.visible).toBe(true);
    expect(overlaps(rectOf(blocked), rectOf(below))).toBe(false);
  });

  it('rounds to whole pixels, because a half-pixel caption is a blurred caption', () => {
    const placement = seat({ subject: { x: 152.5, y: 112, width: 16, height: 16 }, width: 61, height: 15 });

    expect(Number.isInteger(placement.x)).toBe(true);
    expect(Number.isInteger(placement.y)).toBe(true);
  });
});
