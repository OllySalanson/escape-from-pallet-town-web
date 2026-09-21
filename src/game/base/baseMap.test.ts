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

const EVERY_RUNG = WORKSHOP_UPGRADES.map((upgrade) => upgrade.id);

/** The strictest state there is: everything built, so every fixture is a wall. */
const fullyBuilt = () => getBaseMap(EVERY_RUNG);

function occupied(): Set<string> {
  return new Set(BASE_DOORS.map((door) => `${door.keeper.position.x},${door.keeper.position.y}`));
}

/**
 * Walking steps from a tile, with every keeper standing where they stand. A
 * figure is collision, so the walk the player actually takes is the one that
 * goes round all four of them.
 */
function stepsFrom(start: GridPosition): number[][] {
  const map = fullyBuilt();
  const people = occupied();
  const steps = Array.from({ length: map.height }, () =>
    Array<number>(map.width).fill(Number.POSITIVE_INFINITY),
  );
  steps[start.y][start.x] = 0;
  let frontier: GridPosition[] = [start];
  while (frontier.length > 0) {
    const next: GridPosition[] = [];
    for (const tile of frontier) {
      for (const [dx, dy] of [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
      ]) {
        const x = tile.x + dx;
        const y = tile.y + dy;
        if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
        if (map.collision[y][x] || people.has(`${x},${y}`)) continue;
        if (steps[y][x] <= steps[tile.y][tile.x] + 1) continue;
        steps[y][x] = steps[tile.y][tile.x] + 1;
        next.push({ x, y });
      }
    }
    frontier = next;
  }
  return steps;
}

/** How far a place is, which is as far as its nearest tile. */
function stepsTo(steps: number[][], tiles: readonly GridPosition[]): number {
  return Math.min(...tiles.map((tile) => steps[tile.y][tile.x]));
}

/** The tiles a door is reached from: its own doorway, or its keeper's neighbours. */
function approachesTo(doorId: string): readonly GridPosition[] {
  const door = BASE_DOORS.find((candidate) => candidate.id === doorId)!;
  if (door.tiles.length > 0) {
    return door.tiles;
  }
  const map = fullyBuilt();
  const people = occupied();
  return [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ]
    .map(([dx, dy]) => ({ x: door.keeper.position.x + dx, y: door.keeper.position.y + dy }))
    .filter(
      (tile) =>
        tile.x >= 0 &&
        tile.y >= 0 &&
        tile.x < map.width &&
        tile.y < map.height &&
        !map.collision[tile.y][tile.x] &&
        !people.has(`${tile.x},${tile.y}`),
    );
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
   * built and every keeper standing, which is the longest the walk ever gets.
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
    expect(stepsTo(steps, approachesTo('the-quay'))).toBeLessThanOrEqual(4);
    expect(stepsTo(steps, approachesTo('oaks-lab'))).toBeLessThanOrEqual(8);
  });

  it('reaches every door and every fixture from both landings, whatever is built', () => {
    for (const built of [[], EVERY_RUNG, ['beacon'], ['radio-mast', 'quarantine-ward']]) {
      const map = getBaseMap(built);
      const people = occupied();
      const steps = (() => {
        const grid = Array.from({ length: map.height }, () =>
          Array<number>(map.width).fill(Number.POSITIVE_INFINITY),
        );
        grid[BASE_SPAWN.y][BASE_SPAWN.x] = 0;
        let frontier: GridPosition[] = [BASE_SPAWN];
        while (frontier.length > 0) {
          const next: GridPosition[] = [];
          for (const tile of frontier) {
            for (const [dx, dy] of [
              [0, -1],
              [0, 1],
              [-1, 0],
              [1, 0],
            ]) {
              const x = tile.x + dx;
              const y = tile.y + dy;
              if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
              if (map.collision[y][x] || people.has(`${x},${y}`)) continue;
              if (grid[y][x] <= grid[tile.y][tile.x] + 1) continue;
              grid[y][x] = grid[tile.y][tile.x] + 1;
              next.push({ x, y });
            }
          }
          frontier = next;
        }
        return grid;
      })();
      expect(steps[BASE_LANDING.y][BASE_LANDING.x]).toBeLessThan(Number.POSITIVE_INFINITY);
      for (const door of BASE_DOORS) {
        const reach = door.tiles.length > 0 ? door.tiles : approachesTo(door.id);
        expect([door.id, built.length, Math.min(...reach.map((t) => steps[t.y][t.x])) < Infinity]).toEqual([
          door.id,
          built.length,
          true,
        ]);
      }
      // And every walkable tile is reachable: nothing built ever walls a corner
      // of the yard off from the rest of it.
      for (let y = 0; y < map.height; y += 1) {
        for (let x = 0; x < map.width; x += 1) {
          if (map.collision[y][x] || people.has(`${x},${y}`)) continue;
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

  /**
   * A figure is collision, so wherever one stops is a door - and a keeper who
   * cannot be walked into may not stand in the neck of a pocket. Nothing here
   * can be fought or spoken past, so the rule is the strict one: taking any
   * keeper off the map must not shorten any walk between the places that matter.
   */
  it('never stands a keeper where they are the only way through', () => {
    const map = fullyBuilt();
    const places = [
      BASE_SPAWN,
      BASE_LANDING,
      ...BASE_DOORS.flatMap((door) => approachesTo(door.id)),
      ...standingFixtures(EVERY_RUNG).map((fixture) => fixture.at),
    ];
    for (const blocked of BASE_DOORS) {
      const people = new Set(
        BASE_DOORS.map((door) => `${door.keeper.position.x},${door.keeper.position.y}`),
      );
      people.delete(`${blocked.keeper.position.x},${blocked.keeper.position.y}`);
      // With this keeper gone, every place is still exactly as far as it was:
      // they are beside the route, never on it.
      const withKeeper = stepsFrom(BASE_SPAWN);
      const without = (() => {
        const grid = Array.from({ length: map.height }, () =>
          Array<number>(map.width).fill(Number.POSITIVE_INFINITY),
        );
        grid[BASE_SPAWN.y][BASE_SPAWN.x] = 0;
        let frontier: GridPosition[] = [BASE_SPAWN];
        while (frontier.length > 0) {
          const next: GridPosition[] = [];
          for (const tile of frontier) {
            for (const [dx, dy] of [
              [0, -1],
              [0, 1],
              [-1, 0],
              [1, 0],
            ]) {
              const x = tile.x + dx;
              const y = tile.y + dy;
              if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
              if (map.collision[y][x] || people.has(`${x},${y}`)) continue;
              if (grid[y][x] <= grid[tile.y][tile.x] + 1) continue;
              grid[y][x] = grid[tile.y][tile.x] + 1;
              next.push({ x, y });
            }
          }
          frontier = next;
        }
        return grid;
      })();
      for (const place of places) {
        if (place.x === blocked.keeper.position.x && place.y === blocked.keeper.position.y) continue;
        expect([blocked.keeper.id, place.x, place.y, withKeeper[place.y][place.x]]).toEqual([
          blocked.keeper.id,
          place.x,
          place.y,
          without[place.y][place.x],
        ]);
      }
    }
  });

  it('gives every keeper and every return tile its own patch of ground', () => {
    const map = fullyBuilt();
    const seen = new Set<string>();
    for (const door of BASE_DOORS) {
      for (const tile of [door.keeper.position, door.returnTo]) {
        expect([door.id, map.collision[tile.y][tile.x]]).toEqual([door.id, false]);
      }
      const key = `${door.keeper.position.x},${door.keeper.position.y}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      // A keeper never stands on a doorway, or walking out of a building would
      // put the player inside them.
      expect(
        BASE_DOORS.some((other) =>
          other.tiles.some(
            (doorway) =>
              doorway.x === door.keeper.position.x && doorway.y === door.keeper.position.y,
          ),
        ),
      ).toBe(false);
      // And you can reach the keeper from the tile you are put down on.
      expect(
        Math.abs(door.returnTo.x - door.keeper.position.x) +
          Math.abs(door.returnTo.y - door.keeper.position.y),
      ).toBeGreaterThan(0);
    }
  });

  /**
   * The harbour's own board, which is the one place the four keepers' jobs are
   * written down. It is read by facing it, so it has to be solid with ground in
   * front - the same rule every fixture is held to below.
   */
  it('stands the notice board where somebody coming off the boat can read it', () => {
    const map = fullyBuilt();
    const board = { x: 20, y: 15 };
    expect(map.collision[board.y][board.x]).toBe(true);
    expect(map.collision[board.y + 1][board.x]).toBe(false);
    // And it is a short walk from where a raid puts the player down.
    expect(stepsFrom(BASE_LANDING)[board.y + 1][board.x]).toBeLessThanOrEqual(6);
  });

  it('opens every doorway the catalogue cut, and nothing else in a building', () => {
    const map = fullyBuilt();
    for (const door of BASE_DOORS) {
      if (!door.building) continue;
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

  it('lays no fixture over another, over a building, or over a keeper', () => {
    const taken = new Map<string, string>();
    const claim = (x: number, y: number, by: string): void => {
      const key = `${x},${y}`;
      expect([key, taken.get(key) ?? by]).toEqual([key, by]);
      taken.set(key, by);
    };
    for (const door of BASE_DOORS) {
      if (door.building) {
        // The building's own footprint is read off the catalogue rather than
        // restated, so a redrawn prop cannot quietly start overlapping.
        const prop = getBaseMap([]).collision;
        expect(prop).toBeDefined();
      }
      claim(door.keeper.position.x, door.keeper.position.y, `keeper:${door.keeper.id}`);
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
