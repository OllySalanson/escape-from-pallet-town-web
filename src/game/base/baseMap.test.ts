import { describe, expect, it } from 'vitest';
import type { GridPosition } from '../movement/gridMovement';
import { WORKSHOP_UPGRADES } from '../hub/workshop';
import {
  BASE_LANDING,
  BASE_MAP_HEIGHT,
  BASE_MAP_WIDTH,
  BASE_SPAWN,
  HOME_SIGN,
  NOTICE_BOARD,
  getBaseMap,
} from './baseMap';
import { BASE_DOORS } from './doors';
import { BASE_FIXTURES, standingFixtures } from './fixtures';
import { HARBOUR_LANDMARKS } from './landmarks';
import { BASE_TILESET } from './baseTileset';
import { DAY_CARE_KEEPER, PEN_HOME, nextPenTile, penTiles } from './dayCarePen';
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
   * The walks this map is designed against, measured with every rung built,
   * which is the longest they ever get. The harbour was a tight yard with
   * every door seven steps from the spawn; the captain asked for room
   * (2026-10-23: "more open space, all the pathways need to be a bit wider"),
   * so the lanes between buildings are two tiles of lawn and the yard is
   * deeper, and what is held now is the walk that is taken every raid: the
   * Raid Arena, which every raid starts from, is a short walk from where the
   * game opens and from the boat that brings a raid home.
   */
  it('keeps the Raid Arena a short walk from where the player is put down, both ways in', () => {
    expect(stepsTo(stepsFrom(BASE_SPAWN), approachesTo('raid-arena'))).toBeLessThanOrEqual(10);
    expect(stepsTo(stepsFrom(BASE_LANDING), approachesTo('raid-arena'))).toBeLessThanOrEqual(12);
  });

  it("keeps every keeper's door within a stroll of where the game opens", () => {
    const steps = stepsFrom(BASE_SPAWN);
    for (const door of BASE_DOORS.filter((each) => each.screen !== null)) {
      expect([door.id, stepsTo(steps, approachesTo(door.id)) <= 18]).toEqual([door.id, true]);
    }
  });

  /**
   * The player's own house is not on the way to re-kitting - nothing in it is
   * a screen a raid needs - so it is a stroll up the yard instead, held so
   * that it stays one.
   */
  it('keeps THE BOLTHOLE a stroll from both landings', () => {
    expect(stepsTo(stepsFrom(BASE_SPAWN), approachesTo('bolthole'))).toBeLessThanOrEqual(24);
    expect(stepsTo(stepsFrom(BASE_LANDING), approachesTo('bolthole'))).toBeLessThanOrEqual(34);
  });

  it('lands a raid within four steps of Bill', () => {
    expect(stepsTo(stepsFrom(BASE_LANDING), approachesTo('bills-cottage'))).toBeLessThanOrEqual(4);
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
      // of the yard off from the rest of it. The Day-Care's pen is the one
      // patch of grass that is shut on purpose (below).
      const pen = new Set(penTiles().map((tile) => `${tile.x},${tile.y}`));
      for (let y = 0; y < map.height; y += 1) {
        for (let x = 0; x < map.width; x += 1) {
          if (map.collision[y][x] || pen.has(`${x},${y}`)) continue;
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
  it("stands THE BOLTHOLE's sign in its garden, readable from the path to its door", () => {
    const map = fullyBuilt();
    expect(map.collision[HOME_SIGN.y][HOME_SIGN.x]).toBe(true);
    const door = BASE_DOORS.find((candidate) => candidate.id === 'bolthole')!;
    // Beside the path up to the step: the tile in front of the step is next to it.
    const path = { x: door.returnTo.x, y: door.returnTo.y + 1 };
    expect(map.collision[path.y][path.x]).toBe(false);
    expect(Math.abs(path.x - HOME_SIGN.x) + Math.abs(path.y - HOME_SIGN.y)).toBe(1);
    expect(HOME_SIGN.lines[0]).toBe('THE BOLTHOLE');
  });

  it('stands the notice board where somebody coming off the boat can read it', () => {
    const map = fullyBuilt();
    const board = NOTICE_BOARD;
    expect(map.collision[board.y][board.x]).toBe(true);
    expect(map.collision[board.y + 1][board.x]).toBe(false);
    // And it is a short walk from where a raid puts the player down.
    expect(stepsFrom(BASE_LANDING)[board.y + 1][board.x]).toBeLessThanOrEqual(7);
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

describe('the Day-Care', () => {
  /** The yard's walk with the man standing where he stands. */
  const aroundHim = (from: GridPosition) =>
    walkFrom(fullyBuilt().collision, from, (tile) =>
      tile.x === DAY_CARE_KEEPER.position.x && tile.y === DAY_CARE_KEEPER.position.y,
    );

  /** The ground beside him a player can stand on and face him from. */
  const besideHim = (): GridPosition[] =>
    [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ]
      .map(([dx, dy]) => ({ x: DAY_CARE_KEEPER.position.x + dx, y: DAY_CARE_KEEPER.position.y + dy }))
      .filter((tile) => fullyBuilt().collision[tile.y][tile.x] === false);

  it('stands the man on the lawn, with ground in front of him to speak to him from', () => {
    for (const built of [[], EVERY_RUNG]) {
      expect(getBaseMap(built).collision[DAY_CARE_KEEPER.position.y][DAY_CARE_KEEPER.position.x]).toBe(false);
    }
    expect(besideHim().length).toBeGreaterThan(0);
  });

  /**
   * Like THE BOLTHOLE he is not on the way to re-kitting - a Pokémon is left
   * with him and fetched back, not visited every raid - so he is a stroll
   * past the house, held so that it stays one.
   */
  it('keeps him a stroll up the lawn past THE BOLTHOLE', () => {
    expect(stepsTo(aroundHim(BASE_SPAWN), besideHim())).toBeLessThanOrEqual(30);
    expect(stepsTo(aroundHim(BASE_LANDING), besideHim())).toBeLessThanOrEqual(40);
  });

  it('fences the pen in: grass inside, and no way in from the yard', () => {
    for (const built of [[], EVERY_RUNG]) {
      const map = getBaseMap(built);
      const steps = walkFrom(map.collision, BASE_SPAWN);
      for (const tile of penTiles()) {
        expect([tile.x, tile.y, map.collision[tile.y][tile.x], steps[tile.y][tile.x]]).toEqual([
          tile.x,
          tile.y,
          false,
          Number.POSITIVE_INFINITY,
        ]);
      }
      // The fence itself is solid all the way round.
      const pen = penTiles();
      const ring = pen.flatMap((tile) =>
        [
          [0, -1],
          [0, 1],
          [-1, 0],
          [1, 0],
        ]
          .map(([dx, dy]) => ({ x: tile.x + dx, y: tile.y + dy }))
          .filter((next) => !pen.some((inside) => inside.x === next.x && inside.y === next.y)),
      );
      expect(ring.every((tile) => map.collision[tile.y][tile.x])).toBe(true);
    }
  });

  it('lets the Pokémon in it wander a tile at a time and never out of the fence', () => {
    const inside = (tile: GridPosition) => penTiles().some((pen) => pen.x === tile.x && pen.y === tile.y);
    expect(inside(PEN_HOME)).toBe(true);
    let at = PEN_HOME;
    for (let step = 0; step < 400; step += 1) {
      const next = nextPenTile(at, (step * 0.618) % 1);
      expect(inside(next)).toBe(true);
      expect(Math.abs(next.x - at.x) + Math.abs(next.y - at.y)).toBeLessThanOrEqual(1);
      at = next;
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

  /**
   * The harbour's landmarks (`landmarks.ts`) are read the way a fixture is, so
   * each `at` is solid with walkable ground beside it; none stands on a door
   * or a fixture; and the sea under a ship is sea - the only water a player
   * stands on is a pier or a jetty, and the long pier walks out to the S.S.
   * Anne from the yard.
   */
  describe('its landmarks', () => {
    it('can each be faced and read', () => {
      const map = fullyBuilt();
      for (const landmark of HARBOUR_LANDMARKS) {
        expect([landmark.id, map.collision[landmark.at.y][landmark.at.x]]).toEqual([landmark.id, true]);
        const beside = [
          [0, -1],
          [0, 1],
          [-1, 0],
          [1, 0],
        ].filter(([dx, dy]) => map.collision[landmark.at.y + dy]?.[landmark.at.x + dx] === false);
        expect([landmark.id, beside.length > 0]).toEqual([landmark.id, true]);
      }
    });

    it('stands clear of every door and every fixture', () => {
      const taken = new Set<string>();
      for (const door of BASE_DOORS) {
        for (const tile of door.tiles) taken.add(`${tile.x},${tile.y}`);
      }
      for (const fixture of BASE_FIXTURES) {
        for (const prop of fixture.props) taken.add(`${prop.x},${prop.y}`);
      }
      for (const landmark of HARBOUR_LANDMARKS) {
        for (const prop of landmark.props) {
          expect([landmark.id, taken.has(`${prop.x},${prop.y}`)]).toEqual([landmark.id, false]);
        }
      }
    });

    it('keeps the sea under a ship solid, and walks out along the pier to the S.S. Anne', () => {
      const map = fullyBuilt();
      for (const landmark of HARBOUR_LANDMARKS.filter((each) => each.id !== 'warehouses')) {
        for (const prop of landmark.props) {
          const art = BASE_TILESET.props[prop.name];
          for (let y = prop.y; y < prop.y + art.height; y += 1) {
            for (let x = prop.x; x < prop.x + art.width; x += 1) {
              expect([landmark.id, x, y, map.collision[y][x]]).toEqual([landmark.id, x, y, true]);
            }
          }
        }
      }
      const ship = HARBOUR_LANDMARKS.find((each) => each.id === 'ss-anne')!;
      const steps = stepsFrom(BASE_SPAWN);
      expect(stepsTo(steps, ship.near ?? [ship.at])).toBeLessThan(Infinity);
    });
  });
});
