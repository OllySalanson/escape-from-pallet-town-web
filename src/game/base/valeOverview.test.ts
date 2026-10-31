import { describe, expect, it } from 'vitest';
import {
  OVERVIEW_BAR_HEIGHT,
  OverviewView,
  fittedPictureSize,
  mapPointOfTile,
  nextWayIn,
  overviewArea,
  overviewLevels,
  platePlace,
  wayInNear,
} from './valeOverview';

const VALE = { width: 384, height: 384 };
const SCREENS = [
  { width: 400, height: 256 },
  { width: 320, height: 240 },
  { width: 360, height: 250 },
];
const STILL = true;

/** Runs the view until it comes to rest. */
function settle(view: OverviewView, held = { x: 0, y: 0 }, frames = 240): void {
  for (let frame = 0; frame < frames; frame += 1) {
    view.advance(1000 / 60, held, false);
  }
}

describe('the view through the telescope', () => {
  it.each(SCREENS)('opens on the whole map, all of it on a $width x $height screen, above the keys', (screen) => {
    const view = new OverviewView(VALE, screen);
    const rect = view.mapRect();
    expect(rect.left).toBeGreaterThanOrEqual(0);
    expect(rect.top).toBeGreaterThanOrEqual(0);
    expect(rect.right).toBeLessThanOrEqual(screen.width);
    expect(rect.bottom).toBeLessThanOrEqual(screen.height - OVERVIEW_BAR_HEIGHT);
    expect(view.isWhole).toBe(true);
    expect(view.canPan).toBe(false);
    // As big as will fit: the map's own height is what limits it.
    expect(rect.bottom - rect.top).toBeGreaterThanOrEqual(overviewArea(screen).height - 4);
  });

  it('draws the fitted picture a whole number of pixels each way', () => {
    for (const screen of SCREENS) {
      const size = fittedPictureSize(VALE, screen);
      expect(Number.isInteger(size.width) && Number.isInteger(size.height)).toBe(true);
      expect(size.height).toBeLessThanOrEqual(overviewArea(screen).height);
    }
  });

  it('has a closer look on every screen, so panning has a purpose', () => {
    for (const screen of SCREENS) {
      const levels = overviewLevels(VALE, screen);
      expect(levels).toEqual([...levels].sort((a, b) => a - b));
      expect(levels.at(-1)).toBe(2);
      const view = new OverviewView(VALE, screen);
      view.cycleLevel(null);
      expect(view.canPan).toBe(true);
    }
  });

  it('a small map is never drawn smaller than it is', () => {
    expect(overviewLevels({ width: 128, height: 128 }, SCREENS[0])).toEqual([1, 2]);
  });

  it('holds still for keys with the whole map up, and pans once closer', () => {
    const screen = SCREENS[0];
    const view = new OverviewView(VALE, screen);
    const before = view.mapRect();
    settle(view, { x: 1, y: 1 }, 60);
    expect(view.mapRect()).toEqual(before);
    view.cycleLevel(null);
    view.cycleLevel(null);
    settle(view);
    const close = view.mapRect();
    settle(view, { x: 1, y: 0 }, 30);
    const panned = view.mapRect();
    expect(panned.left).toBeLessThan(close.left);
    expect(panned.top).toBe(close.top);
  });

  it('pans smoothly: no frame jumps, starting or stopping', () => {
    const view = new OverviewView(VALE, SCREENS[0]);
    view.cycleLevel(null);
    view.cycleLevel(null);
    settle(view);
    let last = view.mapRect().left;
    let moved = 0;
    for (let frame = 0; frame < 120; frame += 1) {
      view.advance(1000 / 60, { x: frame < 60 ? 1 : 0, y: 0 }, false);
      const now = view.mapRect().left;
      expect(Math.abs(now - last)).toBeLessThanOrEqual(4);
      moved += Math.abs(now - last);
      last = now;
    }
    expect(moved).toBeGreaterThan(40);
  });

  it.each(SCREENS)('stops at every edge of the map on a $width x $height screen, whichever way it is pushed', (screen) => {
    const area = overviewArea(screen);
    for (const held of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 1 }, { x: -1, y: -1 }]) {
      const view = new OverviewView(VALE, screen);
      view.cycleLevel(null);
      view.cycleLevel(null);
      settle(view);
      settle(view, held, 900);
      const rect = view.mapRect();
      expect(rect.left).toBeLessThanOrEqual(0);
      expect(rect.top).toBeLessThanOrEqual(0);
      expect(rect.right).toBeGreaterThanOrEqual(area.width);
      expect(rect.bottom).toBeGreaterThanOrEqual(area.height);
      if (held.x > 0) expect(rect.right).toBe(area.width);
      if (held.x < 0) expect(rect.left).toBe(0);
      if (held.y > 0) expect(rect.bottom).toBe(area.height);
      if (held.y < 0) expect(rect.top).toBe(0);
    }
  });

  it('a drag keeps the map under the pointer, and stops at the map too', () => {
    const view = new OverviewView(VALE, SCREENS[0]);
    view.cycleLevel(null);
    view.cycleLevel(null);
    settle(view);
    const under = view.pointAt({ x: 100, y: 100 });
    view.dragBy(-30, -20);
    const moved = view.screenOf(under);
    expect(moved.x).toBe(70);
    expect(moved.y).toBe(80);
    view.dragBy(5000, 5000);
    expect(view.mapRect().left).toBe(0);
    expect(view.mapRect().top).toBe(0);
  });

  it('goes closer about the pointer: what was under it stays under it', () => {
    const screen = SCREENS[0];
    const view = new OverviewView(VALE, screen);
    const anchor = { x: 180, y: 90 };
    const under = view.pointAt(anchor);
    expect(view.changeLevel(1, anchor)).toBe(true);
    settle(view);
    const seen = view.screenOf(under);
    // Within a pixel, unless the edge of the map stopped it.
    expect(Math.abs(seen.y - anchor.y)).toBeLessThanOrEqual(1);
    expect(view.changeLevel(1, anchor)).toBe(true);
    expect(view.changeLevel(1, anchor)).toBe(false);
    expect(view.isClosest).toBe(true);
  });

  it('the one key goes closer, closer, and back out to the whole map', () => {
    const view = new OverviewView(VALE, SCREENS[0]);
    view.cycleLevel(null);
    expect(view.level).toBe(1);
    view.cycleLevel(null);
    expect(view.level).toBe(2);
    view.cycleLevel(null);
    expect(view.level).toBe(0);
    settle(view);
    expect(view.isWhole).toBe(true);
  });

  it('comes to rest on whole pixels', () => {
    const view = new OverviewView(VALE, SCREENS[0]);
    view.cycleLevel(null);
    view.cycleLevel(null);
    settle(view, { x: 0.7, y: 0.3 }, 37);
    settle(view);
    const { left, top } = view.mapRect();
    expect(Number.isInteger(left) && Number.isInteger(top)).toBe(true);
    expect(view.zoom).toBe(2);
  });

  it('reduced motion goes straight there', () => {
    const view = new OverviewView(VALE, SCREENS[0]);
    view.cycleLevel(null);
    view.advance(16, { x: 0, y: 0 }, STILL);
    expect(view.zoom).toBe(1);
  });

  it('brings a way in into sight, and leaves it alone if it is', () => {
    const view = new OverviewView(VALE, SCREENS[0]);
    view.cycleLevel(null);
    view.cycleLevel(null);
    settle(view);
    const corner = { x: 20, y: 360 };
    view.reveal(corner, 44);
    settle(view);
    const seen = view.screenOf(corner);
    const area = overviewArea(SCREENS[0]);
    expect(seen.x).toBeGreaterThanOrEqual(0);
    expect(seen.x).toBeLessThan(area.width);
    expect(seen.y).toBeLessThan(area.height);
    const before = view.mapRect();
    view.reveal(view.pointAt({ x: area.width / 2, y: area.height / 2 }), 44);
    settle(view);
    expect(view.mapRect()).toEqual(before);
  });

  it('can be turned to look straight at a way in, and stops at the edge of the map doing it', () => {
    const screen = SCREENS[0];
    const area = overviewArea(screen);
    const view = new OverviewView(VALE, screen);
    view.cycleLevel(null);
    view.cycleLevel(null);
    view.lookAt({ x: 192, y: 200 });
    settle(view);
    expect(view.screenOf({ x: 192, y: 200 })).toEqual({ x: area.width / 2, y: area.height / 2 });
    view.lookAt({ x: 0, y: 0 });
    settle(view);
    expect(view.mapRect().left).toBe(0);
    expect(view.mapRect().top).toBe(0);
  });

  it('goes back to the whole map when the window changes, whatever it was looking at', () => {
    const view = new OverviewView(VALE, SCREENS[0]);
    view.cycleLevel(null);
    settle(view);
    view.resize(SCREENS[1]);
    expect(view.isWhole).toBe(true);
    expect(view.mapRect().bottom).toBeLessThanOrEqual(SCREENS[1].height - OVERVIEW_BAR_HEIGHT);
  });
});

describe('choosing a way in', () => {
  const landings = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('walks round and round, either way', () => {
    expect(nextWayIn(landings, 'a', 1)?.id).toBe('b');
    expect(nextWayIn(landings, 'c', 1)?.id).toBe('a');
    expect(nextWayIn(landings, 'a', -1)?.id).toBe('c');
    expect(nextWayIn(landings, null, 1)?.id).toBe('a');
    expect(nextWayIn([], 'a', 1)).toBeNull();
  });

  it('a click means the nearest light within reach, and nothing further off', () => {
    const lights = [
      { landing: 'near', at: { x: 100, y: 100 } },
      { landing: 'nearer', at: { x: 106, y: 100 } },
    ];
    expect(wayInNear(lights, { x: 107, y: 101 })).toBe('nearer');
    expect(wayInNear(lights, { x: 180, y: 100 })).toBeNull();
  });

  it('lays a map tile at its own middle on the floor', () => {
    expect(mapPointOfTile({ x: 3, y: 4 }, 1)).toEqual({ x: 3.5, y: 4.5 });
    expect(mapPointOfTile({ x: 3, y: 4 }, 6)).toEqual({ x: 21, y: 27 });
  });
});

describe('the name of the chosen way in', () => {
  const screen = SCREENS[1];
  const plate = { width: 90, height: 13 };
  const keepClear = { right: 70, bottom: 70 };
  const area = overviewArea(screen);

  it('sits over its light when it can, whole, and clear of the compass', () => {
    const over = platePlace({ x: 160, y: 120 }, plate, screen, keepClear);
    expect(over.points).toBeNull();
    expect(over.y).toBeLessThan(120);
    const atCompass = platePlace({ x: 30, y: 30 }, plate, screen, keepClear);
    expect(atCompass.y).toBeGreaterThanOrEqual(keepClear.bottom);
  });

  it('stays on the screen and points at a light that has been panned away', () => {
    for (const mark of [{ x: -200, y: 100 }, { x: 900, y: 100 }, { x: 160, y: -400 }, { x: 160, y: 900 }]) {
      const place = platePlace(mark, plate, screen, keepClear);
      expect(place.x).toBeGreaterThanOrEqual(0);
      expect(place.x + plate.width).toBeLessThanOrEqual(screen.width);
      expect(place.y).toBeGreaterThanOrEqual(0);
      expect(place.y + plate.height).toBeLessThanOrEqual(area.height);
      expect(place.points).not.toBeNull();
    }
    expect(platePlace({ x: 900, y: 100 }, plate, screen, keepClear).points?.x).toBe(1);
    expect(platePlace({ x: -200, y: 100 }, plate, screen, keepClear).points?.x).toBe(-1);
  });

  it('keeps clear of the FEEDBACK tab along the right of the screen', () => {
    expect(platePlace({ x: 318, y: 120 }, plate, screen, keepClear).x + plate.width).toBeLessThanOrEqual(screen.width - 14);
  });
});
