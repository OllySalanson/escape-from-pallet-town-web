import { describe, expect, it } from 'vitest';
import {
  CURSOR_WAITS_MS,
  OVERVIEW_BAR_HEIGHT,
  OverviewView,
  cardPlace,
  mapPointOfTile,
  nextWayIn,
  overviewArea,
  overviewLevels,
  townsOf,
  wayInNear,
  wayInToward,
  wholePicture,
  type OverviewLight,
} from './valeOverview';

const VALE = { width: 384, height: 384 };
const SCREENS = [
  { width: 400, height: 256 },
  { width: 320, height: 240 },
  { width: 360, height: 250 },
];
const STILL = true;
const FRAME = 1000 / 60;
const NOT_HELD = { x: 0, y: 0 };

/** The vale's own ways in, on a map of a pixel to the tile. */
const WAYS: readonly OverviewLight[] = [
  ['stepping-stones', 168, 184],
  ['mill-square', 94, 160],
  ['moor-top', 86, 101],
  ['quarry', 184, 77],
  ['dam', 286, 92],
  ['rest-house', 286, 160],
  ['salvage-camp', 299, 229],
  ['farmhouse', 216, 204],
  ['old-quay', 165, 270],
  ['strand', 169, 237],
  ['cove-steps', 96, 276],
].map(([id, x, y]) => ({ id: id as string, at: { x: (x as number) + 0.5, y: (y as number) + 0.5 } }));

/** Runs the view until it comes to rest, or for as long as a key is held. */
function settle(view: OverviewView, held = NOT_HELD, frames = 240, frameMs = FRAME): void {
  for (let frame = 0; frame < frames; frame += 1) {
    view.advance(frameMs, held, false);
  }
}

function closest(screen = SCREENS[0], lights: readonly OverviewLight[] = [], on: string | null = null): OverviewView {
  const view = new OverviewView(VALE, screen, lights, on);
  view.cycleLevel();
  view.cycleLevel();
  settle(view);
  return view;
}

describe('the map through the telescope', () => {
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

  it.each(SCREENS)('fills a $width x $height screen edge to edge: past the map is cloud, not black bars', (screen) => {
    const mapFloor = { left: 320, top: 320, ...VALE };
    const { square, size } = wholePicture(mapFloor, screen);
    expect(size).toEqual(overviewArea(screen));
    // The floor it is cut from is big enough, and the map is in the middle of it at the fitted size.
    expect(square.left).toBeGreaterThanOrEqual(0);
    expect(square.left + square.width).toBeLessThanOrEqual(1024);
    expect(square.width / size.width).toBeCloseTo(square.height / size.height, 5);
    const [fit] = overviewLevels(VALE, screen);
    expect((mapFloor.left - square.left) * fit).toBeCloseTo((size.width - VALE.width * fit) / 2, 5);
  });

  it('has a closer look on every screen', () => {
    for (const screen of SCREENS) {
      const levels = overviewLevels(VALE, screen);
      expect(levels).toEqual([...levels].sort((a, b) => a - b));
      expect(levels.at(-1)).toBe(2);
      const view = new OverviewView(VALE, screen);
      view.cycleLevel();
      expect(view.canPan).toBe(true);
    }
  });

  it('a small map is never drawn smaller than it is', () => {
    expect(overviewLevels({ width: 128, height: 128 }, SCREENS[0])).toEqual([1, 2]);
  });
});

describe('getting about', () => {
  it('a key always does something: on the whole map the cursor moves and the map holds still', () => {
    const view = new OverviewView(VALE, SCREENS[0], [], null);
    const before = view.mapRect();
    const from = view.cursor;
    settle(view, { x: 1, y: 0 }, 30);
    expect(view.cursor.x).toBeGreaterThan(from.x);
    expect(view.cursor.y).toBe(from.y);
    expect(view.mapRect()).toEqual(before);
  });

  it('closer up the view goes with the cursor once it nears the edge, and stops at the map', () => {
    const screen = SCREENS[0];
    const area = overviewArea(screen);
    for (const held of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 1 }, { x: -1, y: -1 }]) {
      const view = closest(screen);
      const start = view.mapRect();
      settle(view, held, 40);
      settle(view, held, 900);
      settle(view);
      const rect = view.mapRect();
      expect(rect.left === start.left && rect.top === start.top).toBe(false);
      if (held.x > 0) expect(rect.right).toBe(area.width);
      if (held.x < 0) expect(rect.left).toBe(0);
      if (held.y > 0) expect(rect.bottom).toBe(area.height);
      if (held.y < 0) expect(rect.top).toBe(0);
      // The cursor ends at the edge of the map it was pushed at, whole on the screen.
      const seen = view.screenOf(view.cursor);
      expect(seen.x).toBeGreaterThanOrEqual(10);
      expect(seen.x).toBeLessThanOrEqual(area.width - 10);
      expect(seen.y).toBeGreaterThanOrEqual(10);
      expect(seen.y).toBeLessThanOrEqual(area.height - 10);
    }
  });

  it('pans smoothly: no frame jumps, starting or stopping', () => {
    const view = closest();
    let last = view.mapRect().left;
    let moved = 0;
    for (let frame = 0; frame < 240; frame += 1) {
      view.advance(FRAME, { x: frame < 180 ? 1 : 0, y: 0 }, false);
      const now = view.mapRect().left;
      expect(Math.abs(now - last)).toBeLessThanOrEqual(5);
      moved += Math.abs(now - last);
      last = now;
    }
    expect(moved).toBeGreaterThan(40);
  });

  it('a tap moves a little, and a hold gets quicker', () => {
    const view = new OverviewView(VALE, SCREENS[0], [], null);
    const from = view.cursor.x;
    settle(view, { x: 1, y: 0 }, 4);
    const tapped = view.cursor.x - from;
    expect(tapped).toBeGreaterThan(0);
    expect(tapped).toBeLessThan(10);
    settle(view, NOT_HELD, 2);
    settle(view, { x: 1, y: 0 }, 30);
    const before = view.cursor.x;
    settle(view, { x: 1, y: 0 }, 4);
    expect(view.cursor.x - before).toBeGreaterThan(tapped);
  });

  it('a drag keeps the map under the pointer, and stops at the map too', () => {
    const view = closest();
    const under = view.pointAt({ x: 100, y: 100 });
    view.dragBy(-30, -20);
    const moved = view.screenOf(under);
    expect(moved.x).toBe(70);
    expect(moved.y).toBe(80);
    view.dragBy(5000, 5000);
    expect(view.mapRect().left).toBe(0);
    expect(view.mapRect().top).toBe(0);
  });

  it('the wheel goes closer about the pointer: what was under it stays under it', () => {
    const screen = SCREENS[0];
    const view = new OverviewView(VALE, screen);
    const anchor = { x: 180, y: 90 };
    view.pointTo(anchor);
    const under = view.pointAt(anchor);
    expect(view.changeLevel(1, anchor)).toBe(true);
    settle(view);
    const seen = view.screenOf(under);
    expect(Math.abs(seen.y - anchor.y)).toBeLessThanOrEqual(1);
    expect(view.changeLevel(1, anchor)).toBe(true);
    expect(view.changeLevel(1, anchor)).toBe(false);
    expect(view.isClosest).toBe(true);
  });

  it('the one key goes closer about the cursor, closer again, and back out to the whole map', () => {
    const view = new OverviewView(VALE, SCREENS[0], WAYS, 'salvage-camp');
    view.cycleLevel();
    settle(view);
    expect(view.level).toBe(1);
    const area = overviewArea(SCREENS[0]);
    expect(Math.abs(view.screenOf(view.cursor).y - area.height / 2)).toBeLessThanOrEqual(1);
    view.cycleLevel();
    expect(view.level).toBe(2);
    view.cycleLevel();
    settle(view);
    expect(view.level).toBe(0);
    expect(view.isWhole).toBe(true);
    expect(view.wayIn).toBe('salvage-camp');
  });

  it('comes to rest on whole pixels', () => {
    const view = closest();
    settle(view, { x: 0.7, y: 0.3 }, 37);
    settle(view);
    const { left, top } = view.mapRect();
    expect(Number.isInteger(left) && Number.isInteger(top)).toBe(true);
    expect(view.zoom).toBe(2);
  });

  it('reduced motion goes straight there', () => {
    const view = new OverviewView(VALE, SCREENS[0]);
    view.cycleLevel();
    view.advance(16, NOT_HELD, STILL);
    expect(view.zoom).toBe(1);
  });

  it('goes back to the whole map when the window changes, and the cursor stays put', () => {
    const view = new OverviewView(VALE, SCREENS[0], WAYS, 'dam');
    view.cycleLevel();
    settle(view);
    view.resize(SCREENS[1]);
    expect(view.isWhole).toBe(true);
    expect(view.mapRect().bottom).toBeLessThanOrEqual(SCREENS[1].height - OVERVIEW_BAR_HEIGHT);
    expect(view.wayIn).toBe('dam');
  });

  it('what is in sight is what the little map outlines: all of it on the whole map, a part closer', () => {
    expect(new OverviewView(VALE, SCREENS[0]).inSight()).toEqual({ left: 0, top: 0, width: 384, height: 384 });
    const sight = closest().inSight();
    expect(sight.width).toBe(200);
    expect(sight.height).toBe(120);
  });

  it('never loses the cursor off the screen, whatever is done in whatever order', () => {
    const screen = SCREENS[1];
    const area = overviewArea(screen);
    const view = new OverviewView(VALE, screen, WAYS, 'mill-square');
    const moves: readonly (() => void)[] = [
      () => settle(view, { x: 1, y: 0 }, 50),
      () => settle(view, { x: 0, y: -1 }, 50),
      () => settle(view, { x: -1, y: 1 }, 50),
      () => view.cycleLevel(),
      () => view.hop('cove-steps'),
      () => view.hop('dam'),
      () => view.changeLevel(1, { x: 10, y: 10 }),
      () => view.changeLevel(-1, { x: 300, y: 200 }),
    ];
    for (let turn = 0; turn < 200; turn += 1) {
      moves[(turn * 7 + (turn % 3)) % moves.length]();
      settle(view, NOT_HELD, 60);
      const seen = view.screenOf(view.cursor);
      expect(seen.x).toBeGreaterThanOrEqual(0);
      expect(seen.x).toBeLessThanOrEqual(area.width);
      expect(seen.y).toBeGreaterThanOrEqual(0);
      expect(seen.y).toBeLessThanOrEqual(area.height);
    }
  });
});

describe('pointing at a way in', () => {
  /** Holds a key until the cursor comes to a way in, and says which. */
  const heldUntilAWayIn = (view: OverviewView, held: { x: number; y: number }, frameMs = FRAME): string | null => {
    for (let frame = 0; frame < 2000 && !view.wayIn; frame += 1) {
      view.advance(frameMs, held, false);
    }
    return view.wayIn;
  };

  it('starts on the way in the player is stood over, saying so', () => {
    const view = new OverviewView(VALE, SCREENS[0], WAYS, 'farmhouse');
    expect(view.wayIn).toBe('farmhouse');
    expect(view.cursor).toEqual(WAYS.find((way) => way.id === 'farmhouse')?.at);
  });

  it('is drawn to a way in it is passing, and stops on it, on a slow frame too', () => {
    const lights = [{ id: 'east', at: { x: 300, y: 203 } }];
    for (const frameMs of [FRAME, 100]) {
      const view = new OverviewView(VALE, SCREENS[0], lights, null);
      // From the middle, along a row a few pixels off the light's.
      settle(view, { x: 0, y: 1 }, 4);
      expect(heldUntilAWayIn(view, { x: 1, y: 0 }, frameMs)).toBe('east');
      expect(view.cursor).toEqual(lights[0].at);
    }
  });

  it('waits on it with the key held, so a held key cannot overshoot, then goes on and is not drawn back', () => {
    const lights = [{ id: 'east', at: { x: 300, y: 192 } }];
    const view = new OverviewView(VALE, SCREENS[0], lights, null);
    heldUntilAWayIn(view, { x: 1, y: 0 });
    settle(view, { x: 1, y: 0 }, Math.floor(CURSOR_WAITS_MS / FRAME) - 1);
    expect(view.wayIn).toBe('east');
    settle(view, { x: 1, y: 0 }, 12);
    expect(view.wayIn).toBeNull();
    expect(view.cursor.x).toBeGreaterThan(300);
    // Back the other way, it is ahead again and takes the cursor.
    expect(heldUntilAWayIn(view, { x: -1, y: 0 })).toBe('east');
  });

  it('lets go at once for a fresh press', () => {
    const lights = [{ id: 'east', at: { x: 300, y: 192 } }];
    const view = new OverviewView(VALE, SCREENS[0], lights, null);
    heldUntilAWayIn(view, { x: 1, y: 0 });
    view.advance(FRAME, NOT_HELD, false);
    view.advance(FRAME, { x: 0, y: 1 }, false);
    expect(view.wayIn).toBeNull();
  });

  it('is not pulled back to one it has gone past', () => {
    const lights = [{ id: 'west', at: { x: 190, y: 192 } }];
    const view = new OverviewView(VALE, SCREENS[0], lights, null);
    settle(view, { x: 1, y: 0 }, 30);
    expect(view.wayIn).toBeNull();
    expect(view.cursor.x).toBeGreaterThan(192);
  });

  it('reaches every way in on the vale from every other with the keys alone', () => {
    for (const from of WAYS) {
      for (const to of WAYS) {
        if (from.id === to.id) continue;
        const view = new OverviewView(VALE, SCREENS[1], WAYS, from.id);
        // Along, then down, as a player would.
        for (let turn = 0; turn < 20 && view.wayIn !== to.id; turn += 1) {
          const dx = to.at.x - view.cursor.x;
          const dy = to.at.y - view.cursor.y;
          const held = Math.abs(dx) >= 1 ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) };
          for (let frame = 0; frame < 30 && view.wayIn !== to.id; frame += 1) {
            view.advance(FRAME, Math.abs(to.at.x - view.cursor.x) < 2 && held.x !== 0 ? { x: 0, y: Math.sign(dy) } : held, false);
          }
        }
        expect(view.wayIn).toBe(to.id);
      }
    }
  });

  it('with the mouse the cursor is the pointer, and takes a way in when it is near one', () => {
    const view = new OverviewView(VALE, SCREENS[0], WAYS, 'dam');
    const dam = view.screenOf(WAYS.find((way) => way.id === 'dam')!.at);
    const farm = view.screenOf(WAYS.find((way) => way.id === 'farmhouse')!.at);
    // Out over the country it is on nothing.
    expect(view.pointTo({ x: 20, y: 20 })).toBe(false);
    expect(view.wayIn).toBeNull();
    expect(view.pointTo({ x: farm.x + 4, y: farm.y - 3 })).toBe(true);
    expect(view.wayIn).toBe('farmhouse');
    // Still on it is not news.
    expect(view.pointTo({ x: farm.x + 3, y: farm.y - 3 })).toBe(false);
    expect(view.wayIn).toBe('farmhouse');
    view.pointTo(dam);
    expect(view.wayIn).toBe('dam');
  });

  it('keeps the cursor on the map, whatever the mouse is over', () => {
    const view = new OverviewView(VALE, SCREENS[0]);
    view.pointTo({ x: 0, y: 0 });
    expect(view.screenOf(view.cursor).x).toBeGreaterThan(80);
    view.pointTo({ x: 399, y: 239 });
    expect(view.screenOf(view.cursor).x).toBeLessThan(320);
    // Closer up, its corners are whole at the very edge of the map.
    const close = closest();
    close.pointTo({ x: 0, y: 0 });
    settle(close, { x: -1, y: -1 }, 600);
    settle(close);
    expect(close.screenOf(close.cursor)).toEqual({ x: 10, y: 10 });
  });

  it('hops straight to a way in and brings it into sight', () => {
    const view = closest(SCREENS[0], WAYS, 'mill-square');
    view.hop('salvage-camp');
    settle(view);
    const seen = view.screenOf(view.cursor);
    const area = overviewArea(SCREENS[0]);
    expect(view.wayIn).toBe('salvage-camp');
    expect(seen.x).toBeGreaterThanOrEqual(0);
    expect(seen.x).toBeLessThan(area.width);
    expect(seen.y).toBeLessThan(area.height);
  });

  it('walks round and round, either way', () => {
    const landings = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
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

describe('the arrow keys at the rim', () => {
  const ways = WAYS.map((way) => ({ id: way.id, tile: { x: Math.floor(way.at.x), y: Math.floor(way.at.y) } }));
  const toward = (from: string, x: number, y: number): string | null => wayInToward(ways, from, { x, y })?.id ?? null;

  it('go to whichever lies that way on the map', () => {
    expect(toward('mill-square', 1, 0)).toBe('stepping-stones');
    expect(toward('mill-square', 0, -1)).toBe('moor-top');
    expect(toward('dam', 0, 1)).toBe('rest-house');
    expect(toward('strand', 0, 1)).toBe('old-quay');
    expect(toward('rest-house', -1, 0)).toBe('farmhouse');
  });

  it('go nowhere when nothing lies that way', () => {
    expect(toward('salvage-camp', 1, 0)).toBeNull();
    expect(toward('quarry', 0, -1)).toBeNull();
    expect(wayInToward(ways, 'not-a-way-in', { x: 1, y: 0 })).toBeNull();
  });

  it('can get to every way in from every other', () => {
    const reached = (from: string): Set<string> => {
      const seen = new Set([from]);
      const queue = [from];
      while (queue.length > 0) {
        const at = queue.shift()!;
        for (const [x, y] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const next = toward(at, x, y);
          if (next && !seen.has(next)) {
            seen.add(next);
            queue.push(next);
          }
        }
      }
      return seen;
    };
    for (const way of ways) {
      expect(reached(way.id).size).toBe(ways.length);
    }
  });
});

describe('what is said about the thing under the cursor', () => {
  const card = { width: 150, height: 56 };
  const compass = { left: 2, top: 2, width: 46, height: 46 };
  const inside = (place: { x: number; y: number }, point: { x: number; y: number }): boolean =>
    point.x >= place.x && point.x < place.x + card.width && point.y >= place.y && point.y < place.y + card.height;

  it.each(SCREENS)('stands beside every way in on a $width x $height screen: whole, off it, clear of the compass and the tab', (screen) => {
    const area = overviewArea(screen);
    for (const level of [0, 2]) {
      const view = new OverviewView(VALE, screen, WAYS, WAYS[0].id);
      for (let turn = 0; turn < level; turn += 1) view.cycleLevel();
      for (const way of WAYS) {
        view.hop(way.id);
        settle(view);
        const mark = view.screenOf(way.at);
        const place = cardPlace(mark, card, screen, [compass]);
        expect(place.x).toBeGreaterThanOrEqual(0);
        expect(place.y).toBeGreaterThanOrEqual(0);
        expect(place.x + card.width).toBeLessThanOrEqual(area.width - 16);
        expect(place.y + card.height).toBeLessThanOrEqual(area.height);
        expect(inside(place, mark)).toBe(false);
        expect(place.x < compass.left + compass.width && place.y < compass.top + compass.height).toBe(false);
      }
    }
  });

  it('prefers the right, and takes a side that hides no other way in over one that does', () => {
    const screen = SCREENS[0];
    const mark = { x: 150, y: 120 };
    expect(cardPlace(mark, card, screen).x).toBeGreaterThan(mark.x);
    const other = { x: 200, y: 120 };
    expect(cardPlace(mark, card, screen, [], [other]).x).toBeLessThan(mark.x);
  });
});

describe('the towns on the map', () => {
  const street = [
    { x: 10, y: 10 },
    { x: 14, y: 10 },
    { x: 18, y: 12 },
    { x: 60, y: 60 },
    { x: 100, y: 10 },
    { x: 102, y: 10 },
  ];

  it('are doors standing together: three makes a town, two a farm', () => {
    expect(townsOf(street, () => true)).toEqual([{ x: 14, y: 10 }]);
  });

  it('count only what this save has walked, so nothing under the cloud is given away', () => {
    expect(townsOf(street, () => false)).toEqual([]);
    expect(townsOf(street, (door) => door.x < 12)).toEqual([]);
    expect(townsOf(street, (door) => door.x < 19)).toHaveLength(1);
  });
});
