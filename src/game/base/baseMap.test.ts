import { describe, expect, it } from 'vitest';
import type { GridPosition } from '../movement/gridMovement';
import { WORKSHOP_UPGRADES } from '../hub/workshop';
import {
  BASE_LANDING,
  BASE_MAP_HEIGHT,
  BASE_MAP_WIDTH,
  BASE_SPAWN,
  getBaseMap,
} from './baseMap';
import { BASE_DOORS } from './doors';
import { BASE_FIXTURES, standingFixtures } from './fixtures';
import { stepsFrom as walkFrom, stepsTo } from './baseWalks';

const EVERY_RUNG = WORKSHOP_UPGRADES.map((upgrade) => upgrade.id);

/** The strictest state there is: everything built, so every fixture is a wall. */
const fullyBuilt = () => getBaseMap(EVERY_RUNG);

/**
 * Walking steps from a tile across the yard. Nobody stands in the yard any
 * more - the keepers are inside (`rooms.ts`) - so the walk is the map's.
 */
function stepsFrom(start: GridPosition): number[][] {
  return walkFrom(fullyBuilt().collision, start);
}

/** The tiles a door is reached from: its own doorway. */
function approachesTo(doorId: string): readonly GridPosition[] {
  return BASE_DOORS.find((candidate) => candidate.id === doorId)!.tiles;
}

describe('the base map', () => {
  it('is the authored size and is sealed at every edge', () => {
    const map = fullyBuilt();
    expect(map.width).toBe(BASE_MAP_WIDTH);
    expect(map.height).toBe(BASE_MAP_HEIGHT);
    for (let x = 0; x < map.width; x += 1) {
      expect(map.collision[0][x]).toBe(true);
      expect(map.collision[map.height - 1][x]).toBe(true);
    }
    for (let y = 0; y < map.height; y += 1) {
      expect(map.collision[y][0]).toBe(true);
      expect(map.collision[y][map.width - 1]).toBe(true);
    }
  });

  it('puts the player down on ground, both ways in', () => {
    const map = fullyBuilt();
    for (const tile of [BASE_SPAWN, BASE_LANDING]) {
      expect(map.collision[tile.y][tile.x]).toBe(false);
    }
  });

  /**
   * The one number this map is designed against. A player re-kits between raids
   * many times an hour, so a base that is a pleasure the first time and a
   * corridor the fourth is a base that is too big. Measured with every rung
   * built, which is the longest the walk ever gets. Inside, the keeper is one
   * key from the mat (`rooms.test.ts`), so this is the whole of the walk.
   */
  it('keeps every door within seven steps of where a raid drops the player', () => {
    const steps = stepsFrom(BASE_SPAWN);
    const walks = BASE_DOORS.map((door) => [door.id, stepsTo(steps, approachesTo(door.id))] as const);
    for (const [id, walk] of walks) {
      expect(`${id}:${walk}`).toBe(`${id}:${walk}`);
      expect(walk).toBeLessThanOrEqual(7);
    }
    // And the lab, which is what a raid is prepared in, is right in front of you.
    expect(stepsTo(steps, approachesTo('oaks-lab'))).toBeLessThanOrEqual(2);
  });

  it('lands a raid within four steps of Bill and eight of the lab', () => {
    const steps = stepsFrom(BASE_LANDING);
    expect(stepsTo(steps, approachesTo('bills-cottage'))).toBeLessThanOrEqual(4);
    expect(stepsTo(steps, approachesTo('oaks-lab'))).toBeLessThanOrEqual(8);
  });

  it('reaches every door and every fixture from both landings, whatever is built', () => {
    for (const built of [[], EVERY_RUNG, ['beacon'], ['radio-mast', 'quarantine-ward']]) {
      const map = getBaseMap(built);
      const steps = walkFrom(map.collision, BASE_SPAWN);
      expect(steps[BASE_LANDING.y][BASE_LANDING.x]).toBeLessThan(Number.POSITIVE_INFINITY);
      for (const door of BASE_DOORS) {
        expect([door.id, built.length, stepsTo(steps, door.tiles) < Infinity]).toEqual([
          door.id,
          built.length,
          true,
        ]);
      }
      // And every walkable tile is reachable: nothing built ever walls a corner
      // of the yard off from the rest of it.
      for (let y = 0; y < map.height; y += 1) {
        for (let x = 0; x < map.width; x += 1) {
          if (map.collision[y][x]) continue;
          expect([x, y, built.length, steps[y][x] < Infinity]).toEqual([x, y, built.length, true]);
        }
      }
    }
  });

  /**
   * A door is a pocket you step into, never a tile on the way to something
   * else: an open door takes whoever stands on it, exactly as a raid exit does,
   * so a door in a through-lane would swallow anybody passing.
   */
  it('cuts every doorway as a dead end', () => {
    const map = fullyBuilt();
    for (const door of BASE_DOORS) {
      for (const tile of door.tiles) {
        const ways = [
          [0, -1],
          [0, 1],
          [-1, 0],
          [1, 0],
        ].filter(([dx, dy]) => !map.collision[tile.y + dy]?.[tile.x + dx]);
        // Its own doorway may be two cells wide; nothing else leads out of it.
        const out = ways.filter(
          ([dx, dy]) =>
            !door.tiles.some(
              (other) => other.x === tile.x + dx && other.y === tile.y + dy,
            ),
        );
        expect([door.id, tile.x, tile.y, out.length]).toEqual([door.id, tile.x, tile.y, 1]);
      }
    }
  });

  it('gives every return tile its own patch of ground, off every doorway', () => {
    const map = fullyBuilt();
    for (const door of BASE_DOORS) {
      expect([door.id, map.collision[door.returnTo.y][door.returnTo.x]]).toEqual([door.id, false]);
      // Coming back out never puts the player on a doorway, or they would be
      // taken straight back in.
      expect(
        BASE_DOORS.some((other) =>
          other.tiles.some((tile) => tile.x === door.returnTo.x && tile.y === door.returnTo.y),
        ),
      ).toBe(false);
      // And it is the step in front of its own door.
      expect(
        door.tiles.some(
          (tile) => Math.abs(tile.x - door.returnTo.x) + Math.abs(tile.y - door.returnTo.y) === 1,
        ),
      ).toBe(true);
    }
  });

  /**
   * The harbour's own board, which is the one place the four keepers' jobs are
   * written down. It is read by facing it, so it has to be solid with ground in
   * front - the same rule every fixture is held to below.
   */
  it('stands the notice board where somebody coming off the boat can read it', () => {
    const map = fullyBuilt();
    const board = { x: 14, y: 15 };
    expect(map.collision[board.y][board.x]).toBe(true);
    expect(map.collision[board.y + 1][board.x]).toBe(false);
    // And it is a short walk from where a raid puts the player down.
    expect(stepsFrom(BASE_LANDING)[board.y + 1][board.x]).toBeLessThanOrEqual(6);
  });

  it('opens every doorway the catalogue cut, and nothing else in a building', () => {
    const map = fullyBuilt();
    for (const door of BASE_DOORS) {
      for (const tile of door.tiles) {
        expect([door.id, map.collision[tile.y][tile.x]]).toEqual([door.id, false]);
      }
    }
  });
});

describe('what the base is built out of', () => {
  it("stands something for every rung of Brock's ladder, and nothing for anything else", () => {
    expect(BASE_FIXTURES.map((fixture) => fixture.upgradeId).sort()).toEqual([...EVERY_RUNG].sort());
    expect(new Set(BASE_FIXTURES.map((fixture) => fixture.upgradeId)).size).toBe(
      BASE_FIXTURES.length,
    );
  });

  it('puts a fixture up only once its rung is built', () => {
    expect(standingFixtures([])).toEqual([]);
    expect(standingFixtures(['beacon']).map((fixture) => fixture.upgradeId)).toEqual(['beacon']);
    expect(standingFixtures(EVERY_RUNG)).toHaveLength(BASE_FIXTURES.length);
  });

  it('lays no fixture over another or over a doorway', () => {
    const taken = new Map<string, string>();
    const claim = (x: number, y: number, by: string): void => {
      const key = `${x},${y}`;
      expect([key, taken.get(key) ?? by]).toEqual([key, by]);
      taken.set(key, by);
    };
    for (const door of BASE_DOORS) {
      for (const tile of door.tiles) claim(tile.x, tile.y, `door:${door.id}`);
    }
    for (const fixture of BASE_FIXTURES) {
      for (const prop of fixture.props) {
        claim(prop.x, prop.y, `fixture:${fixture.upgradeId}`);
      }
    }
  });

  /**
   * A landmark is read by facing it, and the overworld only turns in place
   * against a blocked tile, so a fixture's `at` has to be solid *and* have
   * walkable ground beside it - the same facing rule `pois.test.ts` holds the
   * raid maps' landmarks to.
   */
  it('gives every fixture a tile the player can stand in front of and read', () => {
    const map = getBaseMap(EVERY_RUNG);
    for (const fixture of BASE_FIXTURES) {
      expect([fixture.upgradeId, map.collision[fixture.at.y][fixture.at.x]]).toEqual([
        fixture.upgradeId,
        true,
      ]);
      const beside = [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
      ].filter(([dx, dy]) => map.collision[fixture.at.y + dy]?.[fixture.at.x + dx] === false);
      expect([fixture.upgradeId, beside.length > 0]).toEqual([fixture.upgradeId, true]);
    }
  });

  it('shows and hides exactly the tiles its rung pays for', () => {
    const empty = getBaseMap([]);
    for (const fixture of BASE_FIXTURES) {
      const built = getBaseMap([fixture.upgradeId]);
      let changed = 0;
      for (let y = 0; y < built.height; y += 1) {
        for (let x = 0; x < built.width; x += 1) {
          if (built.layers.detail.tiles[y][x] !== empty.layers.detail.tiles[y][x]) changed += 1;
        }
      }
      // Something has to appear, or the rung bought nothing you can see.
      expect([fixture.upgradeId, changed > 0]).toEqual([fixture.upgradeId, true]);
    }
  });
});
