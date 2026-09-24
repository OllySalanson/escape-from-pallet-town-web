import { describe, expect, it } from 'vitest';
import type { GridPosition } from '../movement/gridMovement';
import { WORKSHOP_UPGRADES } from '../hub/workshop';
import { BASE_STAGE_HEIGHT, BASE_STAGE_WIDTH } from '../display/stage';
import { TILE_SIZE } from '../worldMap';
import { BASE_DOORS } from './doors';
import {
  BASE_ROOMS,
  BILL_CABINET_SHELVES,
  CENTER_DISPLAY,
  COUNTER_BALLS,
  OAK_WALL_MAP,
  WORKSHOP_DISPLAY,
  billCabinet,
  buildRoom,
  labWallMap,
  propTiles,
  restingBalls,
  roomNamed,
  type BaseRoom,
} from './rooms';
import { BASE_PIECES } from './generated/basePieces';
import { stepsFrom, stepsTo, servingTiles, walksToKeepers, BASE_STARTS } from './baseWalks';
import { baseGame } from './baseGames.testkit';

const EVERY_RUNG = WORKSHOP_UPGRADES.map((upgrade) => upgrade.id);
const room = (id: string): BaseRoom => roomNamed(id)!;
const key = (tile: GridPosition) => `${tile.x},${tile.y}`;

/** The states a room can be in that change what stands in it. */
const STATES = [
  { built: [], hurt: 0 },
  { built: EVERY_RUNG, hurt: 0 },
  { built: EVERY_RUNG, hurt: 12 },
  { built: ['recovery-bay-1', 'quarantine-ward'], hurt: 3 },
] as const;

describe('the rooms behind the base doors', () => {
  it('puts one room behind every door, under the same name, opening the same screen', () => {
    expect(BASE_ROOMS.map((each) => each.id).sort()).toEqual(
      BASE_DOORS.map((door) => door.id).sort(),
    );
    for (const door of BASE_DOORS) {
      const inside = room(door.id);
      expect([door.id, inside.name, inside.screen]).toEqual([door.id, door.name, door.screen]);
    }
  });

  /**
   * FireRed rooms stand still in the middle of the screen, and the smallest
   * stage the game is authored against is 320x240: a room that did not fit it
   * would scroll, and would not look like the room it is dressed as.
   */
  it('fits every room on the smallest stage', () => {
    for (const each of BASE_ROOMS) {
      expect([each.id, each.width * TILE_SIZE <= BASE_STAGE_WIDTH]).toEqual([each.id, true]);
      expect([each.id, each.height * TILE_SIZE <= BASE_STAGE_HEIGHT]).toEqual([each.id, true]);
    }
  });

  it('lays the mat on the bottom row, so a push south from it is the way out', () => {
    for (const each of BASE_ROOMS) {
      const built = buildRoom(each, baseGame());
      expect([each.id, each.mat.y]).toEqual([each.id, each.height - 1]);
      expect([each.id, built.collision[each.mat.y][each.mat.x]]).toEqual([each.id, false]);
    }
  });

  /**
   * The keeper is who the room is for, so they can always be walked up to -
   * and nothing they stand on or beside is a wall anybody else needs. Asked in
   * every state a room can be in, because what Brock builds stands in rooms.
   */
  it('reaches the keeper and every tile of every room from the mat, whatever is built', () => {
    for (const state of STATES) {
      const game = baseGame(state);
      for (const each of BASE_ROOMS) {
        const built = buildRoom(each, game);
        const keeper = each.keeper.position;
        expect([each.id, built.collision[keeper.y][keeper.x]]).toEqual([each.id, false]);
        expect([each.id, key(keeper) === key(each.mat)]).toEqual([each.id, false]);
        const steps = stepsFrom(built.collision, each.mat, (tile) => key(tile) === key(keeper));
        expect([each.id, stepsTo(steps, servingTiles(each, built.collision)) < Infinity]).toEqual([
          each.id,
          true,
        ]);
        for (let y = 0; y < each.height; y += 1) {
          for (let x = 0; x < each.width; x += 1) {
            if (built.collision[y][x] || key({ x, y }) === key(keeper)) continue;
            expect([each.id, state.built.length, x, y, steps[y][x] < Infinity]).toEqual([
              each.id,
              state.built.length,
              x,
              y,
              true,
            ]);
          }
        }
      }
    }
  });

  /**
   * The captain's rule for the base: walking must never become a toll for a
   * player re-kitting many times an hour. The screen is one key from the mat,
   * so the toll is the yard; the room only asks a few steps of a player who
   * wants to walk up to the keeper and look at what is standing there.
   */
  it('keeps every keeper a short walk from the door, and every door where it was', () => {
    const game = baseGame({ built: EVERY_RUNG });
    // Seven from the middle of the yard (`baseMap.test.ts`), and from the
    // quay no further than the Center and the workshop were before any door
    // had a room behind it.
    const limits: Record<string, number> = { 'the yard': 7, 'the quay (home from a raid)': 11 };
    for (const start of BASE_STARTS) {
      for (const walk of walksToKeepers(start.tile, game)) {
        expect([start.name, walk.door.id, walk.yard <= limits[start.name]]).toEqual([
          start.name,
          walk.door.id,
          true,
        ]);
        expect([walk.door.id, walk.acrossTheRoom <= 4]).toEqual([walk.door.id, true]);
      }
    }
  });

  it('gives every thing in a room a tile to stand beside and read it from', () => {
    for (const state of STATES) {
      const game = baseGame(state);
      for (const each of BASE_ROOMS) {
        const built = buildRoom(each, game);
        for (const thing of built.things) {
          const beside = thing.tiles.some((tile) =>
            [
              [0, -1],
              [0, 1],
              [-1, 0],
              [1, 0],
            ].some(([dx, dy]) => built.collision[tile.y + dy]?.[tile.x + dx] === false),
          );
          expect([each.id, thing.name, beside]).toEqual([each.id, thing.name, true]);
          for (const tile of thing.tiles) {
            expect([each.id, thing.name, built.collision[tile.y][tile.x]]).toEqual([
              each.id,
              thing.name,
              true,
            ]);
          }
        }
      }
    }
  });
});

describe("Brock's workshop, where the whole ladder can be seen", () => {
  it('has a bay for every rung, and one only', () => {
    expect(WORKSHOP_DISPLAY.map((display) => display.upgradeId).sort()).toEqual(
      [...EVERY_RUNG].sort(),
    );
  });

  it('keeps every bay to itself, clear of the keeper and the mat', () => {
    const workshop = room('brocks-workshop');
    const taken = new Map<string, string>([
      [key(workshop.keeper.position), 'keeper'],
      [key(workshop.mat), 'mat'],
    ]);
    for (const display of WORKSHOP_DISPLAY) {
      for (const tile of propTiles(display.props)) {
        expect([key(tile), taken.get(key(tile)) ?? display.upgradeId]).toEqual([
          key(tile),
          display.upgradeId,
        ]);
        taken.set(key(tile), display.upgradeId);
      }
    }
  });

  /** A rung you cannot see is the bookkeeping the rooms exist to replace. */
  it('stands something new in the room for every rung built, and nothing before', () => {
    const workshop = room('brocks-workshop');
    const empty = buildRoom(workshop, baseGame());
    expect(empty.things).toEqual([]);
    for (const upgrade of WORKSHOP_UPGRADES) {
      const built = buildRoom(workshop, baseGame({ built: [upgrade.id] }));
      let changed = 0;
      for (let y = 0; y < workshop.height; y += 1) {
        for (let x = 0; x < workshop.width; x += 1) {
          if (built.layers.detail.tiles[y][x] !== empty.layers.detail.tiles[y][x]) changed += 1;
        }
      }
      expect([upgrade.id, changed > 0]).toEqual([upgrade.id, true]);
      expect(built.things.map((thing) => thing.upgradeId)).toEqual([upgrade.id]);
    }
  });
});

describe('the Pokémon Center, which shows who is being treated', () => {
  const center = room('pokemon-centre');

  it('sets a Poké Ball on the counter for everyone waiting, as many as it holds', () => {
    const count = (waiting: number) =>
      restingBalls(waiting).reduce((sum, sprite) => sum + (sprite.piece === 'ball.two' ? 2 : 1), 0);
    expect(count(0)).toBe(0);
    expect(count(1)).toBe(1);
    expect(count(5)).toBe(5);
    expect(count(COUNTER_BALLS + 4)).toBe(COUNTER_BALLS);
    for (const sprite of restingBalls(COUNTER_BALLS)) {
      expect(center.counter.some((tile) => key(tile) === key(sprite))).toBe(true);
      // Never on the cell of the counter Joy is served across.
      expect(sprite.x).not.toBe(center.keeper.position.x);
    }
  });

  it('says how many are waiting over the counter, and says nothing when nobody is', () => {
    expect(buildRoom(center, baseGame()).things).toEqual([]);
    const waiting = buildRoom(center, baseGame({ hurt: 3 }));
    expect(waiting.things.map((thing) => thing.name)).toEqual(['3 POKÉ BALLS']);
    expect(waiting.sprites.length).toBeGreaterThan(0);
  });

  it('stands what Brock fitted there once it is built', () => {
    for (const display of CENTER_DISPLAY) {
      expect(EVERY_RUNG).toContain(display.upgradeId);
      const built = buildRoom(center, baseGame({ built: [display.upgradeId] }));
      expect(built.things.map((thing) => thing.upgradeId)).toEqual([display.upgradeId]);
    }
  });
});

/**
 * Two later pieces of work fill these rooms - the wall map in Oak's Lab and
 * the oddities on Bill's shelves - and the room is built so that neither has
 * to move anything to do it. These hold the space they were promised.
 */
describe('the hooks the rooms leave for what comes next', () => {
  it("keeps a stretch of Oak's wall bare for the wall map", () => {
    const lab = room('oaks-lab');
    const game = baseGame({ built: EVERY_RUNG });
    const built = buildRoom(lab, game);
    const plain = buildRoom(lab, baseGame()).layers.ground;
    for (let y = OAK_WALL_MAP.y; y < OAK_WALL_MAP.y + OAK_WALL_MAP.height; y += 1) {
      for (let x = OAK_WALL_MAP.x; x < OAK_WALL_MAP.x + OAK_WALL_MAP.width; x += 1) {
        // Wall, both rows of it, with the plain wall drawn and nothing over it.
        expect([x, y, built.collision[y][x]]).toEqual([x, y, true]);
        expect([x, y, plain.tiles[y][x] >= 0]).toEqual([x, y, true]);
        if (labWallMap(game).length === 0) {
          expect([x, y, built.layers.detail.tiles[y][x]]).toEqual([x, y, -1]);
        }
      }
    }
    // What hangs there stays there.
    for (const tile of propTiles(labWallMap(game))) {
      expect(
        tile.x >= OAK_WALL_MAP.x &&
          tile.y >= OAK_WALL_MAP.y &&
          tile.x < OAK_WALL_MAP.x + OAK_WALL_MAP.width &&
          tile.y < OAK_WALL_MAP.y + OAK_WALL_MAP.height,
      ).toBe(true);
    }
  });

  it("stands Bill's shelves empty, where the cabinet says they are", () => {
    const cottage = room('bills-cottage');
    const game = baseGame();
    const built = buildRoom(cottage, game);
    const shelf = BASE_PIECES['lab.shelvesEmpty'];
    for (const rect of BILL_CABINET_SHELVES) {
      expect([rect.width, rect.height]).toEqual([shelf.width, shelf.height]);
      for (let y = rect.y; y < rect.y + rect.height; y += 1) {
        for (let x = rect.x; x < rect.x + rect.width; x += 1) {
          expect([x, y, built.collision[y][x], built.layers.detail.tiles[y][x] >= 0]).toEqual([
            x,
            y,
            true,
            true,
          ]);
        }
      }
    }
    for (const sprite of billCabinet(game)) {
      expect(
        BILL_CABINET_SHELVES.some(
          (rect) =>
            sprite.x >= rect.x &&
            sprite.y >= rect.y &&
            sprite.x < rect.x + rect.width &&
            sprite.y < rect.y + rect.height,
        ),
      ).toBe(true);
    }
  });
});
