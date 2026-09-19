import { describe, expect, it } from 'vitest';
import {
  NEIGHBOUR_GAP,
  SUBJECT_GAP,
  VIEW_INSET,
  explainSeats,
  placeCaptions,
  placeDialog,
  seatingOrder,
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
  canopy: [],
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

  /**
   * Writing is drawn beneath figures and a canopy above them, so a caption
   * seated under a crown or a roof is hidden by it. The Floodplain's gatehouse
   * is walked under, and its shut gate's caption read `SLUICE GA` on one side
   * of it and `PER DANE` on the other.
   */
  describe('under a canopy', () => {
    const subject = tile(160, 120);
    // Everything above the subject is roof, as it is over a gatehouse's arch.
    const roof: Rect = { x: 96, y: 40, width: 144, height: 78 };

    it('takes the other side rather than sit under a roof', () => {
      const placement = seat({ subject }, { canopy: [roof] });
      expect(placement.visible).toBe(true);
      expect(placement.seat).toBe('below');
      expect(overlaps(rectOf(placement), roof)).toBe(false);
    });

    it('goes beside its subject when a person stands below it and a roof is above', () => {
      // The gate's own keeper, standing under the gate he holds.
      const keeper: Rect = { x: 160, y: 138, width: 16, height: 23 };
      const placement = seat({ subject, preferred: 'below' }, { canopy: [roof], keepClear: [keeper] });
      expect(placement.visible).toBe(true);
      expect(['left', 'right']).toContain(placement.seat);
      expect(overlaps(rectOf(placement), roof)).toBe(false);
      expect(overlaps(rectOf(placement), keeper)).toBe(false);
    });

    it('slides along its row to clear a single crown, rather than leave the row', () => {
      // One tree's crown over the left of the row above. The centred seat runs
      // under it; the seat slid to line up with the subject's left edge is clear.
      const crown: Rect = { x: 120, y: 96, width: 30, height: 16 };
      const centred = seat({ subject, width: 60 });
      expect(overlaps(rectOf(centred), crown)).toBe(true);

      const placement = seat({ subject, width: 60 }, { canopy: [crown] });
      expect(placement.visible).toBe(true);
      expect(placement.seat).toBe('above');
      expect(placement.x).toBe(subject.x);
      expect(overlaps(rectOf(placement), crown)).toBe(false);
    });

    it('is not drawn rather than cover a person, even when every other seat is under canopy', () => {
      const everywhereElse: Rect[] = [
        roof,
        { x: 0, y: 118, width: 158, height: 40 },
        { x: 178, y: 118, width: 142, height: 40 },
      ];
      const crowd: Rect = { x: 120, y: 138, width: 96, height: 60 };
      expect(seat({ subject }, { canopy: everywhereElse, keepClear: [crowd] }).visible).toBe(false);
    });
  });

  it('can say why each seat was refused, so a missing caption is read rather than guessed at', () => {
    const subject = tile(160, 120);
    const roof: Rect = { x: 96, y: 40, width: 144, height: 78 };
    const keeper: Rect = { x: 160, y: 138, width: 16, height: 23 };
    const seats = explainSeats(request({ subject }), around({ canopy: [roof], keepClear: [keeper, subject] }));
    expect(seats).toHaveLength(12);
    // The authored side is under the roof and nothing else is wrong with it...
    expect(seats[0].seat).toBe('above');
    expect(seats[0].underCanopy).toBeGreaterThan(0);
    expect(seats[0].overMapArt + seats[0].outsideView + seats[0].underHud).toBe(0);
    // ...the other row is over the keeper, not under the roof...
    const below = seats.find((one) => one.seat === 'below')!;
    expect(below.overMapArt).toBeGreaterThan(0);
    expect(below.underCanopy).toBe(0);
    // ...and the seat that placeCaptions takes is the first with nothing against it.
    const clear = seats.findIndex(
      (one) => one.outsideView + one.underHud + one.overMapArt + one.underCanopy + one.againstCaption === 0,
    );
    expect(placeCaptions([request({ subject })], around({ canopy: [roof], keepClear: [keeper] }))[0].candidate).toBe(clear);
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

  /**
   * A boss stands at the gate they hold. Seated in the order they were made,
   * the gate's name took the one clear seat and `CANNOT BE FLED` went undrawn -
   * on two of the Floodplain's three doors.
   */
  describe('a warning and a name that want the same ground', () => {
    // Two subjects side by side, walled in below and beside: the only clear
    // ground is the row above them, and it holds one caption.
    const gate = tile(136, 112);
    const keeper = tile(168, 112);
    const walledIn = { keepClear: [{ x: 0, y: 110, width: 320, height: 130 }] };

    it('seats the warning first, whatever order they were asked for in', () => {
      const [name, warning] = placeCaptions(
        [request({ subject: gate }), request({ subject: keeper, warns: true })],
        around(walledIn),
      );

      expect(warning.visible).toBe(true);
      expect(warning.seat).toBe('above');
      expect(name.visible).toBe(false);
    });

    it('is decided by order alone between two names, as it always was', () => {
      const [first, second] = placeCaptions(
        [request({ subject: gate }), request({ subject: keeper })],
        around(walledIn),
      );

      expect(first.visible).toBe(true);
      expect(second.visible).toBe(false);
    });

    it('hands the placements back in the order they were asked for', () => {
      const [name, warning] = placeCaptions(
        [request({ subject: gate }), request({ subject: keeper, warns: true })],
        around(),
      );

      // The warning is centred over the keeper, and it is the name that gave
      // up the row to fit around it - so each answer is its own request's.
      expect(warning.seat).toBe('above');
      expect(warning.x + 30).toBe(keeper.x + TILE / 2);
      expect(name.seat).toBe('below');
      expect(name.x + 30).toBe(gate.x + TILE / 2);
      expect(overlaps(rectOf(name), grown(rectOf(warning), NEIGHBOUR_GAP))).toBe(false);
    });

    it('keeps the order they were asked for in within warnings and within names', () => {
      const asked = [request(), request({ warns: true }), request(), request({ warns: true })];

      expect(seatingOrder(asked)).toEqual([1, 3, 0, 2]);
    });

    it('buys a warning no ground a name could not have: it is still never drawn over a person', () => {
      const everyone: Rect = { x: 0, y: 0, width: 320, height: 240 };

      expect(seat({ warns: true }, { keepClear: [everyone] }).visible).toBe(false);
      expect(seat({ warns: true }, { canopy: [everyone] }).visible).toBe(false);
    });
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

describe('where the dialogue box sits', () => {
  const box = { x: 8, width: 304, height: 80 };
  const figure = (y: number): Rect => ({ x: 152, y, width: 16, height: 23 });

  it('stays at the bottom when it covers no one it is about', () => {
    expect(placeDialog({ viewHeight: 240, box, margin: 8, about: [figure(100)] })).toEqual({
      y: 152,
      edge: 'bottom',
    });
    expect(placeDialog({ viewHeight: 240, box, margin: 8, about: [] }).edge).toBe('bottom');
  });

  it('goes to the top rather than cover the hunter it is announcing', () => {
    expect(placeDialog({ viewHeight: 240, box, margin: 8, about: [figure(180)] })).toEqual({
      y: 8,
      edge: 'top',
    });
  });

  it('does not move when the top would cover just as many', () => {
    expect(
      placeDialog({ viewHeight: 240, box, margin: 8, about: [figure(180), figure(20)] }).edge,
    ).toBe('bottom');
  });
});
