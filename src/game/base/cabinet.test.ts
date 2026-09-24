import { describe, expect, it } from 'vitest';
import type { Direction } from '../movement/gridMovement';
import { TILE_SIZE } from '../worldMap';
import { MATERIAL_IDS } from '../items';
import { TRADER_BARTERS } from '../hub/trader';
import { cabinetOddities, type Oddity } from '../hub/traderCabinet';
import { buildRoom, roomNamed } from './rooms';
import { baseGame, tradedBook } from './baseGames.testkit';
import {
  CABINET_CRATES,
  CABINET_UNITS,
  CABINET_UNITS_AT_START,
  ODDITIES_PER_CRATE,
  ODDITY_ART,
  ODDITY_HEIGHT,
  ODDITY_INK,
  SEATS_PER_UNIT,
  SHELF_SEATS,
  cabinetLayout,
  cratesLine,
  firstOddityAt,
  nextOddity,
  unitAt,
  unitNote,
} from './cabinet';

const oddities = (count: number): Oddity[] =>
  Array.from({ length: count }, (_each, index) => ({
    itemId: MATERIAL_IDS[index % MATERIAL_IDS.length],
    got: { itemId: 'moon-stone', quantity: 1 },
    day: `2026-09-${String(1 + (index % 28)).padStart(2, '0')}`,
  }));
const cottage = roomNamed('bills-cottage')!;

describe("the miniatures on Bill's shelves", () => {
  it('has one for everything the barter table takes, drawn in known colours', () => {
    const taken = new Set(TRADER_BARTERS.flatMap((barter) => barter.takes.map(({ itemId }) => itemId)));
    for (const itemId of taken) {
      expect([itemId, itemId in ODDITY_ART]).toEqual([itemId, true]);
    }
    for (const [itemId, art] of Object.entries(ODDITY_ART)) {
      // Four pixels tall is what the lower shelf has between its planks, and
      // five wide leaves a pixel between neighbours at a six-pixel pitch.
      expect([itemId, art.length]).toEqual([itemId, ODDITY_HEIGHT]);
      expect([itemId, new Set(art.map((row) => row.length)).size, art[0].length <= 5]).toEqual([
        itemId,
        1,
        true,
      ]);
      for (const ink of art.join('').replaceAll('.', '')) {
        expect([itemId, ink, ink in ODDITY_INK]).toEqual([itemId, ink, true]);
      }
    }
  });

  it('draws no two things alike, so a shelf can be read by eye', () => {
    const drawn = Object.values(ODDITY_ART).map((art) => art.join('/'));
    expect(new Set(drawn).size).toBe(drawn.length);
  });
});

describe("where things stand in Bill's cabinet", () => {
  it('stands everything inside the unit it is on, clear of its neighbours', () => {
    const { placed } = cabinetLayout(oddities(SHELF_SEATS), TILE_SIZE);
    expect(placed).toHaveLength(SHELF_SEATS);
    for (const each of placed) {
      const unit = CABINET_UNITS[each.unit];
      const left = unit.x * TILE_SIZE;
      const top = unit.y * TILE_SIZE;
      // Inside the dark back of the shelf: pixels 2-77 across, rows 6-9 and 12-15.
      expect(each.x - left >= 2 && each.x + each.width - left <= 78).toBe(true);
      expect([6, 12]).toContain(each.y - top);
    }
    for (const a of placed) {
      for (const b of placed) {
        if (a === b || a.y !== b.y) continue;
        // A pixel of shelf between any two, and the frame of the one looked at
        // never lands on its neighbour.
        expect(a.x + a.width < b.x || b.x + b.width < a.x).toBe(true);
      }
    }
  });

  /** The nth thing traded is where it was the last time you looked. */
  it('never moves a thing once it is on a shelf', () => {
    const before = cabinetLayout(oddities(30), TILE_SIZE).placed;
    const after = cabinetLayout(oddities(90), TILE_SIZE).placed;
    expect(after.slice(0, 30).map(({ x, y, unit }) => ({ x, y, unit }))).toEqual(
      before.map(({ x, y, unit }) => ({ x, y, unit })),
    );
  });

  it('fills a unit before the next, and brings the second pair in only when it is needed', () => {
    expect(cabinetLayout([], TILE_SIZE).units).toBe(CABINET_UNITS_AT_START);
    expect(cabinetLayout(oddities(2 * SEATS_PER_UNIT), TILE_SIZE).units).toBe(2);
    expect(cabinetLayout(oddities(2 * SEATS_PER_UNIT + 1), TILE_SIZE).units).toBe(3);
    expect(cabinetLayout(oddities(3 * SEATS_PER_UNIT + 1), TILE_SIZE).units).toBe(4);
    const units = cabinetLayout(oddities(SHELF_SEATS), TILE_SIZE).placed.map((each) => each.unit);
    expect(units).toEqual([...units].sort((a, b) => a - b));
  });

  it('packs what the shelves cannot hold into crates, and the last crate takes the rest', () => {
    expect(cabinetLayout(oddities(SHELF_SEATS), TILE_SIZE).crates).toEqual([]);
    const one = cabinetLayout(oddities(SHELF_SEATS + 1), TILE_SIZE).crates;
    expect(one).toEqual([{ tile: CABINET_CRATES[0], from: SHELF_SEATS, count: 1 }]);
    const many = cabinetLayout(oddities(SHELF_SEATS + 1000), TILE_SIZE).crates;
    expect(many).toHaveLength(CABINET_CRATES.length);
    expect(many.reduce((sum, crate) => sum + crate.count, 0)).toBe(1000);
    expect(many.slice(0, -1).every((crate) => crate.count === ODDITIES_PER_CRATE)).toBe(true);
  });

  it('says what is on each unit and what is in the crates', () => {
    const empty = cabinetLayout([], TILE_SIZE);
    expect(unitNote(empty, 0)).toBe('Waiting on your first trade');
    const some = cabinetLayout(oddities(25), TILE_SIZE);
    expect([unitNote(some, 0), unitNote(some, 1)]).toEqual([
      '25 things you traded him',
      '25 things you traded him',
    ]);
    expect(unitNote(cabinetLayout(oddities(1), TILE_SIZE), 0)).toBe('One thing you traded him');
    expect(unitNote(cabinetLayout(oddities(SHELF_SEATS + 4), TILE_SIZE), 3)).toBe(
      `${SHELF_SEATS + 4} things you traded him`,
    );
    expect(unitNote(cabinetLayout(oddities(3), TILE_SIZE), 1)).toBe('Room for more');
    const full = oddities(SHELF_SEATS + 14);
    expect(cratesLine(cabinetLayout(full, TILE_SIZE), full, new Date(2026, 8, 30))).toBe(
      '14 more things you traded him, packed away when the shelves were full, from 13 Sep to 26 Sep.',
    );
  });
});

describe("looking along Bill's shelves", () => {
  const placed = cabinetLayout(oddities(3 * SEATS_PER_UNIT + 5), TILE_SIZE).placed;

  it('starts at the thing nearest the tile faced, on the upper shelf', () => {
    const faced = { x: CABINET_UNITS[1].x + 2, y: CABINET_UNITS[1].y + 1 };
    const first = placed[firstOddityAt(placed, faced, 1, TILE_SIZE)!];
    expect(first.unit).toBe(1);
    expect(first.run).toBe(0);
    expect(Math.abs(first.x + first.width / 2 - (faced.x + 0.5) * TILE_SIZE)).toBeLessThanOrEqual(3);
    expect(firstOddityAt(cabinetLayout([], TILE_SIZE).placed, faced, 1, TILE_SIZE)).toBeUndefined();
  });

  it('walks along a shelf and on across the aisle, and stops at either end', () => {
    const start = firstOddityAt(placed, CABINET_UNITS[0], 0, TILE_SIZE)!;
    expect(nextOddity(placed, start, 'left')).toBe(start);
    let at = start;
    const seen = [at];
    for (;;) {
      const next = nextOddity(placed, at, 'right');
      if (next === at) break;
      at = next;
      seen.push(at);
    }
    expect(new Set(seen.map((index) => placed[index].unit))).toEqual(new Set([0, 1]));
    expect(seen).toHaveLength(24);
  });

  /** Nothing on a shelf may be out of reach of the arrow keys. */
  it('reaches every thing on every shelf from wherever the look starts', () => {
    const moves: Direction[] = ['left', 'right', 'up', 'down'];
    for (const start of [0, placed.length - 1, 40]) {
      const reached = new Set([start]);
      const queue = [start];
      while (queue.length > 0) {
        const from = queue.shift()!;
        for (const move of moves) {
          const to = nextOddity(placed, from, move);
          if (!reached.has(to)) {
            reached.add(to);
            queue.push(to);
          }
        }
      }
      expect(reached.size).toBe(placed.length);
    }
  });
});

describe("Bill's cottage, as the cabinet fills it", () => {
  it('stands a unit on every tile the cabinet says it does, and captions it', () => {
    for (const traded of [0, 60, 400]) {
      const built = buildRoom(cottage, baseGame({ traded }));
      const layout = built.cabinet!.layout;
      for (let unit = 0; unit < layout.units; unit += 1) {
        const at = CABINET_UNITS[unit];
        expect(unitAt(at, layout.units)).toBe(unit);
        expect(built.collision[at.y][at.x]).toBe(true);
        expect(built.things.some((thing) => thing.cabinetUnit === unit)).toBe(true);
      }
      expect(built.things.some((thing) => thing.crated)).toBe(layout.crates.length > 0);
      for (const crate of layout.crates) {
        expect(built.collision[crate.tile.y][crate.tile.x]).toBe(true);
      }
    }
  });

  it('shows exactly what the book says went across the table', () => {
    const game = baseGame({ traded: 30 });
    const built = buildRoom(cottage, game);
    const given = tradedBook(30).flatMap((entry) =>
      entry.gave.flatMap(({ itemId, quantity }) => Array<string>(quantity).fill(itemId)),
    );
    expect(built.cabinet!.oddities.map((oddity) => oddity.itemId)).toEqual(given);
    expect(cabinetOddities(game.raidProgress)).toEqual(built.cabinet!.oddities);
  });
});
